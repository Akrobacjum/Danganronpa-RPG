/**
 * Danganronpa RPG - a player's character, found by the account's name.
 * ---------------------------------------------------------------------------
 * WHY (E79 C10, 16.10.2026; the owner's N3 of 14.10.2026). A GM made each player's
 * account and then had to open User Configuration for every one of them to pick its
 * character, and give the player Owner of the student on the sheet's Ownership
 * window besides. The account is already named after the student at most tables, so
 * the primary GM's browser does both: an account of a player (Player or Trusted
 * Player, never a GM's or an Assistant's) with no character, named exactly like ONE
 * student, gets that student as its character and, when no other player owns the
 * student, Owner of it.
 *
 * WHAT "EXACTLY" MEANS (`nameKey`): case, Polish letters and white space aside, and
 * nothing else - "lucja  ŻAK " is "Łucja Żak", "Aiko" is not "Aiko Hoshino" and "Ai ko"
 * is not "Aiko". The owner's rule: no partial match. ł is spelt out because Unicode
 * gives it no decomposition (NFD leaves U+0142 whole), so stripping the marks alone
 * would leave "łucja" and "lucja" two names; every other Polish letter loses its mark
 * under NFD. A Monokuma is never a student here (monokuma.mjs `isMonokuma`).
 *
 * WHAT IS NEVER DONE. No account that already has a character is touched, so a GM's
 * own assignment stands. The student a match assigned is written beside it on the
 * account (`flags.<module>.matchedCharacter`), and that student is never assigned to
 * that account again: a GM who clears the character has the last word. A new season's
 * student is another actor, and matches. No student named like the account, several,
 * two accounts named alike, or a student another player owns or plays (plan E79 part
 * 4, question 2's default): nothing is assigned to anybody, and the GMs are told which
 * accounts, once per account and reason in this browser's session - when the account
 * is connected, or was made or renamed just now. An account nobody connects with is
 * told about when it connects, not at every GM's start.
 *
 * WHO WRITES. The primary GM alone (utils.mjs `isPrimaryGm`), at its ready and when a
 * user connects, a user is made or renamed, or a student is made or renamed; one pass
 * 500 ms after the last of them. With no GM connected nothing happens until the next
 * primary GM's ready. An account's name is a GM's to write: Foundry refuses a player's
 * own change of `name` (BaseUser's restricted fields, recalled from Foundry's source,
 * not read on v14 here; LIVE-E79-12). The harness's server lets a player rename its own
 * account (audit/harness/cluster.mjs `canWrite`), so no scenario leans on that refusal.
 */

import { MODULE_ID } from "./config.mjs";
import { isMonokuma } from "./monokuma.mjs";
import { esc, warn, isPrimaryGm, whisperToGms } from "./utils.mjs";

/** The user flag naming the student a match assigned to that account. */
export const MATCH_FLAG = "matchedCharacter";

/** One pass this long after the last event that asks for one. */
const PASS_DELAY_MS = 500;

/** Foundry's OWNER level; CONST is read at the call, not at import. */
const ownerLevel = () => CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;

/**
 * A name as the match compares it: marks taken off (NFD), lower case, ł as l, white
 * space - tabs and no-break spaces included - run together and trimmed.
 * @param {string} name
 * @returns {string}
 */
export function nameKey(name) {
    return String(name ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
        .replace(/ł/g, "l").replace(/\s+/gu, " ").trim();
}

/**
 * What a pass would do, from plain rows; it reads and writes nothing of the world.
 * @param {object} world
 * @param {{ id: string, name: string, isGM: boolean, role: number, character: string|null, marker: string|null }[]} world.users
 * @param {{ id: string, name: string, student: boolean, ownership: object }[]} world.actors
 * @returns {{ assign: { userId: string, actorId: string, own: boolean }[], none: string[], several: string[],
 *             same: string[], owned: { userId: string, actorId: string, owners: string[] }[], kept: string[] }}
 */
export function matchPlan({ users = [], actors = [], owner = 3 } = {}) {
    const plan = { assign: [], none: [], several: [], same: [], owned: [], kept: [] };
    const players = users.filter(u => !u.isGM && Number(u.role) >= 1);
    const open = players.filter(u => !u.character && nameKey(u.name));
    const students = actors.filter(a => a.student);
    const alike = new Map();
    for (const user of open) alike.set(nameKey(user.name), (alike.get(nameKey(user.name)) ?? 0) + 1);
    for (const user of open) {
        const key = nameKey(user.name);
        if (alike.get(key) > 1) { plan.same.push(user.id); continue; }
        const found = students.filter(a => nameKey(a.name) === key);
        if (!found.length) { plan.none.push(user.id); continue; }
        if (found.length > 1) { plan.several.push(user.id); continue; }
        const [student] = found;
        if (user.marker === student.id) { plan.kept.push(user.id); continue; }
        const owners = players.filter(u => u.id !== user.id
            && ((student.ownership?.[u.id] ?? 0) >= owner || u.character === student.id)).map(u => u.id);
        if (owners.length) { plan.owned.push({ userId: user.id, actorId: student.id, owners }); continue; }
        plan.assign.push({ userId: user.id, actorId: student.id, own: (student.ownership?.[user.id] ?? 0) < owner });
    }
    return plan;
}

let timer = null;
/** Accounts an event named since the last pass: made, renamed or connected. */
const named = new Set();
/** `${userId}|${nameKey}|${reason}` the GMs were told this session. */
const told = new Set();

function schedule(userId = null) {
    if (!isPrimaryGm()) return;
    if (userId) named.add(userId);
    clearTimeout(timer);
    timer = setTimeout(() => { timer = null; void matchAccounts(); }, PASS_DELAY_MS);
}

/**
 * One pass on the primary GM: the plan's writes, then one card to the GMs for what it
 * could not do. Answers the plan, or null on any other browser.
 */
export async function matchAccounts() {
    if (!isPrimaryGm()) return null;
    const asked = new Set(named);
    named.clear();
    const plan = matchPlan({
        users: game.users.map(u => ({ id: u.id, name: u.name, isGM: u.isGM, role: u.role,
            character: u.character?.id ?? null, marker: u.getFlag?.(MODULE_ID, MATCH_FLAG) ?? null })),
        actors: game.actors.filter(a => a.type === "character")
            .map(a => ({ id: a.id, name: a.name, student: !isMonokuma(a), ownership: a.ownership ?? {} })),
        owner: ownerLevel()
    });
    for (const { userId, actorId, own } of plan.assign) {
        const user = game.users.get(userId), actor = game.actors.get(actorId);
        if (!user || !actor) continue;
        try {
            // Owner first, so the player's browser never holds a character it cannot open.
            if (own) await actor.update({ [`ownership.${userId}`]: ownerLevel() });
            await user.update({ character: actorId, [`flags.${MODULE_ID}.${MATCH_FLAG}`]: actorId });
        } catch (err) {
            warn(`Could not give "${user.name}" the student "${actor.name}"`, err);
        }
    }
    await tellGms(plan, asked);
    return plan;
}

async function tellGms(plan, asked) {
    const fresh = (id, why) => {
        const user = game.users.get(id);
        if (!user || !(user.active || asked.has(id))) return false;
        const key = `${id}|${nameKey(user.name)}|${why}`;
        if (told.has(key)) return false;
        told.add(key);
        return true;
    };
    const nameOf = id => esc(game.users.get(id)?.name ?? id);
    const lines = [];
    for (const [why, key, ids] of [["none", "DRPG.Users.match.none", plan.none], ["several", "DRPG.Users.match.several", plan.several],
        ["same", "DRPG.Users.match.same", plan.same]]) {
        const now = ids.filter(id => fresh(id, why));
        if (now.length) lines.push(game.i18n.format(key, { names: now.map(nameOf).join(", ") }));
    }
    for (const { userId, owners } of plan.owned) {
        if (fresh(userId, "owned")) lines.push(game.i18n.format("DRPG.Users.match.owned", { account: nameOf(userId), owner: owners.map(nameOf).join(", ") }));
    }
    if (!lines.length) return;
    try {
        await whisperToGms(`<div data-drpg-match>${lines.map(line => `<p>${line}</p>`).join("")}</div>`);
    } catch (err) {
        warn("Could not tell the GMs which accounts have no character", err);
    }
}

/** The hooks; the pass itself runs on the primary GM alone. */
export function registerUserMatch() {
    Hooks.once("ready", () => schedule());
    Hooks.on("userConnected", (user, connected) => { if (connected) schedule(user?.id); });
    Hooks.on("createUser", user => schedule(user?.id));
    Hooks.on("updateUser", (user, changes) => { if (changes?.name !== undefined) schedule(user?.id); });
    Hooks.on("createActor", actor => { if (actor?.type === "character") schedule(); });
    Hooks.on("updateActor", (actor, changes) => { if (actor?.type === "character" && changes?.name !== undefined) schedule(); });
}
