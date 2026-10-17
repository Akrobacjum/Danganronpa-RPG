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
 * own assignment stands. No account the GMs have word on is assigned again: the
 * record (`SETTINGS.accountCharacters`, below) holds a row for each player account seen
 * with a character, given one or written by a GM in this season, and an account with a
 * row keeps what a GM left it - a GM who clears the character has the last word. In a
 * new season an account with no character is matched again. No student named like the
 * account, several, two accounts named alike, a student another player owns or plays
 * (plan E79 part 4, question 2's default), or an account that already owns another
 * student: nothing is assigned to anybody, and the GMs are told which accounts, once
 * per account and reason in this browser's session - when the account is connected,
 * or was made or renamed just now. An account nobody connects with is told about when
 * it connects, not at every GM's start.
 *
 * THE RECORD, AND WHY NOT A FLAG ON THE ACCOUNT (E79 fix r3-G1, 17.10.2026; review
 * round 3's SEC S1 and S3). Until this fix the GM's clear was kept by a flag the match
 * wrote on the account (`matchedCharacter`), and only for an account the match itself
 * had given its student. Measured at 2399885 on scenario 15: an account a GM assigned
 * by hand - every account of a world from before 1.2.79 - had no flag, and after the
 * GM took its character and Owner away the next pass (a new account, a student made, the
 * account's own reconnect) wrote both back; and the flag is the account's own to
 * change (a player may update its own account), so a player could undo a GM's clear
 * from the console. The record is a world setting the primary GM writes and no player
 * can (Foundry gives SETTINGS_MODIFY from the Assistant up; modelled so in
 * cluster.mjs's `setting` case, not read on v14 here - LIVE-E79-12): every account
 * a pass finds with a character, every account it assigns, and every GM's write of an
 * account's `character` (`updateUser`, authored by a GM, a clear as well as a pick).
 * A world setting and not a GM store: a store lives in the GMs' browsers, so a GM on a
 * new browser with no other GM connected would open it empty and the match would give
 * back every student a GM had cleared. A row is the season it was written in (the
 * clock's `season`), not the student: every browser holds the world settings, and no
 * module world data may name a student's actor id - 72-canary's scan for Chie's, the
 * killer's, failed seven phases on a first version of this fix that kept the student
 * (17.10.2026). The season does what the student did there: a new season's cast
 * matches again, and a clock put back to an earlier season keeps the rows a later one
 * wrote. A row of an account that is gone, or of a season before this one, is dropped
 * at the next write. The account's own flags are not read for this at all.
 *
 * AN ACCOUNT THAT OWNS ANOTHER STUDENT (SEC S3). An account with no character that is
 * Owner of a student was handed the one named like it as well, with Owner (measured at
 * 2399885: PlayerThree, Owner of Chie, cleared its own character and was given a
 * second student). The record shuts that for an account a pass saw with a character;
 * an account that owns a student it never held as its character has no row, so the
 * plan skips an account that owns any student other than the one named like it, and
 * the GMs are told on the same card.
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
import { SETTINGS, getClock } from "./settings.mjs";
import { isMonokuma } from "./monokuma.mjs";
import { esc, warn, isPrimaryGm, whisperToGms } from "./utils.mjs";

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
 * `seen` is the account's row of the record, the season it was written in, or absent
 * (undefined) for no row; `season` is the clock's.
 * @param {{ id: string, name: string, isGM: boolean, role: number, character: string|null, seen?: number }[]} world.users
 * @param {{ id: string, name: string, student: boolean, ownership: object }[]} world.actors
 * @returns {{ assign: { userId: string, actorId: string, own: boolean }[], none: string[], several: string[],
 *             same: string[], owned: { userId: string, actorId: string, owners: string[] }[],
 *             owns: { userId: string, actorId: string, owns: string[] }[], kept: string[] }}
 */
export function matchPlan({ users = [], actors = [], owner = 3, season = 1 } = {}) {
    const plan = { assign: [], none: [], several: [], same: [], owned: [], owns: [], kept: [] };
    const players = users.filter(u => !u.isGM && Number(u.role) >= 1);
    // The GMs' word: a row of this season, or of a later one the clock was put back from.
    const held = u => Number.isFinite(u.seen) && u.seen >= season;
    const unset = players.filter(u => !u.character && nameKey(u.name));
    plan.kept = unset.filter(held).map(u => u.id);
    const open = unset.filter(u => !held(u));
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
        const owners = players.filter(u => u.id !== user.id
            && ((student.ownership?.[u.id] ?? 0) >= owner || u.character === student.id)).map(u => u.id);
        if (owners.length) { plan.owned.push({ userId: user.id, actorId: student.id, owners }); continue; }
        const mine = students.filter(a => a.id !== student.id && (a.ownership?.[user.id] ?? 0) >= owner).map(a => a.id);
        if (mine.length) { plan.owns.push({ userId: user.id, actorId: student.id, owns: mine }); continue; }
        plan.assign.push({ userId: user.id, actorId: student.id, own: (student.ownership?.[user.id] ?? 0) < owner });
    }
    return plan;
}

let timer = null;
/** Accounts an event named since the last pass: made, renamed or connected. */
const named = new Set();
/** `${userId}|${nameKey}|${reason}` the GMs were told this session. */
const told = new Set();
/** The first pass after `ready` on the primary GM, for the suite's wait (tests.mjs `loadSettled`). */
let firstPass = null, firstDone = null;

function schedule(userId = null) {
    if (!isPrimaryGm()) return;
    if (userId) named.add(userId);
    clearTimeout(timer);
    timer = setTimeout(() => {
        timer = null;
        void matchAccounts().catch(err => warn("The account match failed", err)).finally(() => { firstDone?.(); firstDone = null; });
    }, PASS_DELAY_MS);
}

/** Settles once the first pass after `ready` has written what it writes; at once where none is due. */
export function matchSettled() {
    return firstPass ?? Promise.resolve();
}

const isPlayer = u => Boolean(u) && !u.isGM && Number(u.role) >= 1;

/** The clock's season, 1 where it cannot be read. */
function seasonNow() {
    try {
        return Number(getClock().season) || 1;
    } catch {
        return 1;
    }
}

/** The record as stored, a copy: `{ <userId>: <season> }`. */
function readRecord() {
    try {
        const value = game.settings.get(MODULE_ID, SETTINGS.accountCharacters);
        return value && typeof value === "object" ? { ...value } : {};
    } catch {
        return {};
    }
}

/* One write of the record at a time: a pass and a GM's write of an account can land together,
   and two writes from one read would lose a row. */
let recordQueue = Promise.resolve();

/**
 * Change the record on the primary GM: `change(rows, season)` edits a copy, the rows of
 * accounts that are gone and of past seasons are dropped, and the setting is written only
 * when a row differs.
 */
function writeRecord(change) {
    const run = recordQueue.then(async () => {
        if (!isPrimaryGm()) return false;
        const season = seasonNow(), was = readRecord(), next = change({ ...was }, season) ?? was;
        for (const id of Object.keys(next)) if (!game.users.get(id) || !(Number(next[id]) >= season)) delete next[id];
        const keys = Object.keys(next);
        if (keys.length === Object.keys(was).length && keys.every(id => Object.hasOwn(was, id) && was[id] === next[id])) return false;
        await game.settings.set(MODULE_ID, SETTINGS.accountCharacters, next);
        return true;
    });
    recordQueue = run.catch(() => false);
    return run;
}

/** A GM's write of a player account's character, a clear as well, on the primary: the record keeps it. */
function noteGmChoice(user, authorId) {
    if (!isPrimaryGm() || !isPlayer(user) || !game.users.get(authorId)?.isGM) return;
    writeRecord((rows, season) => {
        rows[user.id] = season;
        return rows;
    }).catch(err => warn(`Could not keep the GM's choice of character for "${user.name}"`, err));
}

/**
 * One pass on the primary GM: the plan's writes, then one card to the GMs for what it
 * could not do. Answers the plan, or null on any other browser.
 */
export async function matchAccounts() {
    if (!isPrimaryGm()) return null;
    const asked = new Set(named);
    named.clear();
    const record = readRecord(), season = seasonNow();
    const plan = matchPlan({
        users: game.users.map(u => ({ id: u.id, name: u.name, isGM: u.isGM, role: u.role,
            character: u.character?.id ?? null, seen: Object.hasOwn(record, u.id) ? record[u.id] : undefined })),
        actors: game.actors.filter(a => a.type === "character")
            .map(a => ({ id: a.id, name: a.name, student: !isMonokuma(a), ownership: a.ownership ?? {} })),
        owner: ownerLevel(),
        season
    });
    const given = new Set();
    for (const { userId, actorId, own } of plan.assign) {
        const user = game.users.get(userId), actor = game.actors.get(actorId);
        if (!user || !actor) continue;
        try {
            // Owner first, so the player's browser never holds a character it cannot open.
            if (own) await actor.update({ [`ownership.${userId}`]: ownerLevel() });
            await user.update({ character: actorId });
            given.add(userId);
        } catch (err) {
            warn(`Could not give "${user.name}" the student "${actor.name}"`, err);
        }
    }
    try {
        await writeRecord((rows, now) => {
            for (const user of game.users) if (isPlayer(user) && user.character?.id) rows[user.id] = now;
            for (const userId of given) rows[userId] = now;
            return rows;
        });
    } catch (err) {
        warn("Could not keep which character each account was given", err);
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
    for (const { userId, owns } of plan.owns) {
        if (fresh(userId, "owns")) lines.push(game.i18n.format("DRPG.Users.match.owns",
            { account: nameOf(userId), students: owns.map(id => esc(game.actors.get(id)?.name ?? id)).join(", ") }));
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
    Hooks.once("ready", () => {
        if (isPrimaryGm()) firstPass = new Promise(resolve => { firstDone = resolve; });
        schedule();
    });
    Hooks.on("userConnected", (user, connected) => { if (connected) schedule(user?.id); });
    Hooks.on("createUser", user => schedule(user?.id));
    Hooks.on("updateUser", (user, changes, _options, userId) => {
        if (changes?.character !== undefined) noteGmChoice(user, userId);
        if (changes?.name !== undefined) schedule(user?.id);
    });
    // A row of an account that is gone leaves the record at the pass this schedules.
    Hooks.on("deleteUser", () => schedule());
    Hooks.on("createActor", actor => { if (actor?.type === "character") schedule(); });
    Hooks.on("updateActor", (actor, changes) => { if (actor?.type === "character" && changes?.name !== undefined) schedule(); });
}
