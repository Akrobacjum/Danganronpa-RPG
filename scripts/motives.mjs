/**
 * Danganronpa RPG - the players' motives: the record, its secrecy, its rules and its reward.
 * ---------------------------------------------------------------------------
 * 2.0 line T5, D2-23 and D2-24 (the owner, 27.11.2026; docs/dev/v2/SPEC-MOTIVES.md with the owner's nine answers, which
 * bind). Three motives replace the old Monokuma's Motive, a public "reason to kill" with a deadline and a price
 * (rules.mjs until 1.2.129, and migrate.mjs `oldMotiveGone`):
 *
 *   - THE MONOKUMA MOTIVE: the class's, public, always about working together; one at a time (#4), with a deadline
 *     only if the GM gives one (#5) and a penalty that is the GM's words, carried out by hand (#1). It may be hidden:
 *     the players see that there is one and not what it says (#2). Bought with the Despair Call "Monokuma Motive"
 *     (call-pickers.mjs `pickMotive`, call-effects.mjs `motiveEffect`, rules.mjs `setMotive`); changing or withdrawing
 *     it asks whether the last one was passed, and a pass gives every living student 3 Hope.
 *   - THE PERSONAL MOTIVE and THE RELATIONSHIP MOTIVE: each player's, secret, one of each a chapter (#4), the second
 *     always about another living student. Written by a GM by hand, no templates. A player reports one done
 *     (`motive.report`), a GM passes or rejects it (`motive.rule`), or passes it unasked; a pass gives that student 3
 *     Hope and a sound only that player hears (`SFX_EVENTS.motivePassed`, #8).
 *
 * After a Class Trial the GM is asked who did all of the chapter's motives (verdict.mjs, the step `motives`): the rows
 * the record says did are ticked already, each with its reason (#6); the ticked take one Level Up. The dead and the
 * Spectators hold none (#7). The whole is optional and run by hand (#1): the world setting `motivesEnabled`, on by
 * default (the line's question 8.7), and a chapter with no motive asks nothing after its trial.
 *
 * WHERE EACH PART LIVES, AND WHO MAY READ IT (the trust model, D2; .claude/rules/trust-model.md). The private motives
 * are a GM store (gm-stores.mjs `motiveStore`, a row per student keyed by its actor id, with two rows of the Monokuma
 * Motive: `monokuma`, a hidden one's words, and `monokumaLog`, the chapter's Monokuma Motives and how each ended), and
 * each player holds a copy of their own students' rows alone (`motiveCopy`, SETTINGS.mineMotives), sent by the primary
 * GM on a change and when asked - addressed, as the pick's passes are (lockpick-gm.mjs). The Monokuma Motive's public
 * part is the world setting `monokumaMotive`, which every browser holds: a hidden one's words are never written there
 * (world-secrets.mjs `WORLD_SECRET_RULES`, the rule `motives`). A report and a card about a private motive go through
 * secret.mjs, to the GMs or to the owner alone. Nothing a player's packet says is taken: a report is a claim the GM
 * reads, and only a GM passes, rejects, writes or rewards.
 *
 * THE REWARD (#3). 3 Hope (`MOTIVES.hope`, the owner's number), never past the maximum: `Math.min(max, hope + 3)`, read
 * as the GMs hold the Hope (sheet-audit.mjs `meansWrite`), the GM's own write (`gmRuling`, R220's census). What landed
 * (0-3) is said on the card; a full Hope is no fault. Under the Despair darkening that holds Hope down the write is the
 * GM's like any GM's gift, and where it did not land the card says so (the line's question 8.5).
 */

import { MODULE_ID, MOTIVES, STARTING } from "./config.mjs";
import { SETTINGS, getClock, getSetting, setSetting, seasonEpoch, sameSeason, isDeadForGm } from "./settings.mjs";
import { isPrimaryGm, primaryGmId, log, error, esc, plural, whisperToGms, whisperToOwner, announce } from "./utils.mjs";
import { motiveStore, motiveCopy } from "./gm-stores.mjs";
import { gmStoresQuiet, whenGmStoresAudible } from "./gm-store.mjs";
import { replyForMe } from "./bridge-guards.mjs";
import { registerSeasonState } from "./season-reset.mjs";

const SOCKET_EVENT = `module.${MODULE_ID}`;
const ACTION_MINE = "motives.mine";
const ACTION_MINE_ASK = "motives.mineAsk";

/** The store's two rows of the Monokuma Motive (no actor's id: a Foundry id is 16 letters and digits). */
export const MONOKUMA_ROW = "monokuma";
export const MONOKUMA_LOG_ROW = "monokumaLog";

/** The two private motives a student holds. */
export const MOTIVE_KINDS = Object.freeze(["personal", "relationship"]);

/** What a private motive can be: given, reported done by its player, passed by a GM, rejected by one. */
export const MOTIVE_STATES = Object.freeze(["open", "reported", "done", "rejected"]);

/** The users who own `actor`, players only. */
const ownersOf = actor => (game.users ?? []).filter(u => !u.isGM && actor?.testUserPermission?.(u, "OWNER")).map(u => u.id);

/* ==========================================================================
 * THE SWITCH AND WHO HOLDS MOTIVES
 * ========================================================================== */

/** Whether the table plays with the players' motives (`motivesEnabled`, on by default; the line's question 8.7). */
export function motivesEnabled() {
    try {
        return getSetting(SETTINGS.motivesEnabled) !== false;
    } catch {
        return true;
    }
}

/**
 * Who holds motives: a living student as this browser may know it - no Monokuma, no NPC, no Spectator (monokuma.mjs
 * `studentActors`), no dead student and so no Monocub (#7). `students` is the roster (monokuma.mjs `studentActors()`),
 * handed in so this file reaches no family that reaches it back. Pure over what it is handed.
 */
export function holdsMotives(actor, students = []) {
    if (!actor || actor.type !== "character") return false;
    if (!students.some(a => a?.id === actor.id)) return false;
    return !isDeadForGm(actor);
}

/** The roster, read where it lives (monokuma.mjs), by `import()`: that family imports this file's readers. */
async function roster() {
    const { studentActors } = await import("./monokuma.mjs");
    return studentActors();
}

/* ==========================================================================
 * THE PRIVATE ROWS
 * ========================================================================== */

/** The chapter and season a row belongs to now: `{ chapter, epoch }`. */
export function chapterStamp(clock = getClock()) {
    return { chapter: clock?.chapter ?? 1, epoch: seasonEpoch() };
}

/**
 * A row of this chapter and season, or null: a row of another chapter, or of the season a reset ended, is nobody's
 * now (the end of a chapter clears nothing; the season reset cuts the store). Pure but for the clock and the season.
 */
export function currentRow(row, clock = getClock()) {
    if (!row || typeof row !== "object") return null;
    if (row.chapter !== (clock?.chapter ?? 1) || !sameSeason(row)) return null;
    return row;
}

/** One private motive of a row, cleaned to its fields. */
function motivePart(part, kind) {
    if (!part || typeof part !== "object" || typeof part.text !== "string" || !part.text.trim()) return null;
    const status = MOTIVE_STATES.includes(part.status) ? part.status : "open";
    const out = { text: part.text, status, report: typeof part.report === "string" ? part.report : "",
        reason: typeof part.reason === "string" ? part.reason : "", at: Number(part.at) || 0 };
    if (kind === "relationship") out.withActorId = typeof part.withActorId === "string" ? part.withActorId : null;
    return out;
}

/**
 * THE OWNER'S COPY OF ONE ROW: the two motives, their state, the report and the GM's reason - not who wrote it. Pure.
 */
export function copyRow(row) {
    if (!row || typeof row !== "object") return null;
    const out = { chapter: row.chapter ?? null, epoch: row.epoch ?? null };
    for (const kind of MOTIVE_KINDS) {
        const part = motivePart(row[kind], kind);
        if (part) out[kind] = part;
    }
    return out;
}

/**
 * THE ROWS ONE PLAYER IS SENT (R9334): the rows of the characters in `ownedIds` alone, each as `copyRow` cleans it.
 * Another student's Relationship Motive is not sent to the student it names, nor anything of the Monokuma Motive's
 * hidden words. Pure over what it is handed.
 */
export function copyRowsFor(rows, ownedIds) {
    const owned = new Set(ownedIds ?? []);
    const out = {};
    for (const [key, row] of Object.entries(rows ?? {})) {
        if (key === MONOKUMA_ROW || key === MONOKUMA_LOG_ROW || !owned.has(key)) continue;
        const copied = copyRow(row);
        if (copied) out[key] = copied;
    }
    return out;
}

/**
 * The motives `actorId` holds this chapter, as this browser may know them: a GM's from the store, a player's from the
 * copy of their own characters. `{ personal, relationship }`, each null when not given. Never another player's: a
 * player's copy holds only the rows of the characters they own.
 */
export function motivesOf(actorId, clock = getClock()) {
    const raw = game.user?.isGM ? motiveStore.get(actorId) : (motiveCopy.read() ?? {})[actorId];
    const row = currentRow(raw, clock);
    return {
        personal: row ? motivePart(row.personal, "personal") : null,
        relationship: row ? motivePart(row.relationship, "relationship") : null
    };
}

/** Whether any student holds a private motive this chapter (GM). */
export function anyPrivateMotive(clock = getClock()) {
    for (const [key, row] of Object.entries(motiveStore.entries() ?? {})) {
        if (key === MONOKUMA_ROW || key === MONOKUMA_LOG_ROW) continue;
        const now = currentRow(row, clock);
        if (now && MOTIVE_KINDS.some(kind => motivePart(now[kind], kind))) return true;
    }
    return false;
}

/* ==========================================================================
 * THE MONOKUMA MOTIVE'S HISTORY AND HIDDEN WORDS (the store's two rows)
 * ========================================================================== */

/** This chapter's Monokuma Motives that ended, `[{ id, outcome: "done" | "failed" }]` (GM). */
export function monokumaLog(clock = getClock()) {
    const row = motiveStore.get(MONOKUMA_LOG_ROW);
    const stamp = chapterStamp(clock);
    const entries = Array.isArray(row?.entries) ? row.entries : [];
    return entries.filter(entry => entry && entry.chapter === stamp.chapter && sameSeason(entry))
        .map(entry => ({ id: entry.id, outcome: entry.outcome === "done" ? "done" : "failed" }));
}

/** A Monokuma Motive ended: its outcome kept for the chapter's Level Up list (GM; `rules.mjs` `setMotive`). */
export async function keepMonokumaOutcome(record, passed) {
    if (!game.user?.isGM || !record?.id) return;
    await motiveStore.whenHydrated();
    const row = motiveStore.get(MONOKUMA_LOG_ROW);
    const entries = (Array.isArray(row?.entries) ? row.entries : []).filter(entry => entry?.id !== record.id);
    entries.push({ id: record.id, chapter: record.chapter, epoch: record.epoch ?? seasonEpoch(), outcome: passed ? "done" : "failed", at: Date.now() });
    await motiveStore.patch(MONOKUMA_LOG_ROW, { entries });
}

/** A hidden Monokuma Motive's words, as the GMs hold them (`{ id, text, penalty }`), or null. GM only. */
export function hiddenMonokumaWords(id) {
    if (!game.user?.isGM) return null;
    const row = motiveStore.get(MONOKUMA_ROW);
    return row && row.id === id ? { id, text: String(row.text ?? ""), penalty: String(row.penalty ?? "") } : null;
}

/** Keep a hidden Monokuma Motive's words where only the GMs read them, or take them away (null). GM only. */
export async function keepHiddenMonokumaWords(words) {
    if (!game.user?.isGM) return;
    await motiveStore.whenHydrated();
    if (words) await motiveStore.patch(MONOKUMA_ROW, { id: words.id, text: words.text, penalty: words.penalty ?? "" });
    else if (motiveStore.get(MONOKUMA_ROW)) await motiveStore.drop(MONOKUMA_ROW);
}

/* ==========================================================================
 * WRITING A STUDENT'S MOTIVES (the primary GM; `motive.set`)
 * ========================================================================== */

/** The longest a motive's words or a report may be: secret.mjs's cap on a player's words, in characters. */
export function tooLong(text) {
    return new Blob([String(text ?? "")]).size > MOTIVES.maxBytes;
}

/**
 * WHY A GM'S WRITE OF A STUDENT'S MOTIVE IS REFUSED, or null (R9339). `actor` the student, `kind` personal or
 * relationship, `text` the motive's words (empty takes the motive away), `withActor` the other student of a
 * Relationship Motive. `students` the roster. Each reason is a sentence of the bridge's closed list (bridge-guards.mjs
 * `REASON_PATTERNS`). Pure over what it is handed.
 */
export function setRefusal({ actor, kind, text, withActor = null, students = [] } = {}) {
    if (!motivesEnabled()) return "the players' motives are off at this table";
    if (!actor) return "no such character";
    if (!MOTIVE_KINDS.includes(kind)) return "that is not a kind of motive";
    if (!holdsMotives(actor, students)) return "that character holds no motives";
    const words = String(text ?? "").trim();
    if (tooLong(words)) return "the note is longer than a player's words may be";
    if (kind === "relationship" && words) {
        if (!withActor) return "a Relationship Motive names another living student";
        if (withActor.id === actor.id) return "a character cannot do that to itself";
        if (!holdsMotives(withActor, students)) return "a Relationship Motive names another living student";
    }
    return null;
}

/**
 * The primary GM writes `kind` of `actorId`'s motives (the run of `motive.set`, a GM's own window on the primary, or
 * asked by another GM). Empty words take that motive away. A new motive in the same chapter replaces the last (#4):
 * the GM's window asked first. The owner is sent the copy and told a GM gave them a motive, with no words in the chat.
 * Answers `{ refused }` or `{ reply: { kind, status } }`.
 */
export async function setMotiveOnPrimary({ actorId, kind, text, withActorId = null }, sender = null) {
    if (!isPrimaryGm()) return { refused: "that cannot be done now" };
    const students = await roster();
    const actor = game.actors.get(actorId ?? "") ?? null;
    const withActor = withActorId ? (game.actors.get(withActorId) ?? null) : null;
    const why = setRefusal({ actor, kind, text, withActor, students });
    if (why) return { refused: why };
    await motiveStore.whenHydrated();
    const stamp = chapterStamp();
    const was = currentRow(motiveStore.get(actor.id));
    const words = String(text ?? "").trim();
    // Both kinds written every time, a taken-away one as null: a row of an earlier chapter keeps nothing into this one.
    const row = { actorId: actor.id, ...stamp, personal: was?.personal ?? null, relationship: was?.relationship ?? null };
    row[kind] = words ? { text: words, status: "open", report: "", reason: "", at: Date.now(), by: sender?.id ?? game.user.id,
        ...(kind === "relationship" ? { withActorId: withActor.id } : {}) } : null;
    if (!MOTIVE_KINDS.some(k => motivePart(row[k], k))) await motiveStore.drop(actor.id);
    else await motiveStore.patch(actor.id, row);
    Hooks.callAll("drpgMotivesChanged");
    tellOwners(actor);
    if (words) {
        await whisperToOwnerOnlyPlayers(actor, `<p>${esc(game.i18n.localize(kind === "personal" ? "DRPG.Motives.givenPersonal" : "DRPG.Motives.givenRelationship"))}</p>`);
    }
    log(`${actor.name}'s ${kind} motive ${words ? "written" : "taken away"}.`);
    return { reply: { kind, status: words ? "open" : null } };
}

/** A whisper to `actor`'s players alone - not the GMs, who wrote it; nothing when no player owns the student. */
async function whisperToOwnerOnlyPlayers(actor, html) {
    const owners = ownersOf(actor);
    if (!owners.length) return null;
    const { whisperToOwnerOnly } = await import("./utils.mjs");
    return whisperToOwnerOnly(actor, html).catch(err => error("Could not tell a player about their motive", err));
}

/* ==========================================================================
 * A PLAYER'S REPORT (`motive.report`) AND A GM'S RULING (`motive.rule`)
 * ========================================================================== */

/**
 * WHY A PLAYER'S REPORT IS REFUSED, or null (R9341): the motive given this chapter, open or rejected (a rejected one may
 * be reported again, the line's question 8.8), the student holding motives, the words within the cap. Pure over what it
 * is handed.
 */
export function reportRefusal({ actor, kind, text, motive, students = [] } = {}) {
    if (!motivesEnabled()) return "the players' motives are off at this table";
    if (!actor) return "no such character";
    if (!MOTIVE_KINDS.includes(kind)) return "that is not a kind of motive";
    if (!holdsMotives(actor, students)) return "that character holds no motives";
    if (!motive) return "no such motive this chapter";
    if (motive.status === "done") return "that motive is already passed";
    if (motive.status === "reported") return "that motive is already reported";
    if (tooLong(text)) return "the note is longer than a player's words may be";
    return null;
}

/**
 * The primary takes a player's report: the motive marked `reported` with the player's words, and a card to the GMs
 * alone with Pass and Reject (motives-ui.mjs `wireRulingCard`). The words are a claim; the GM decides.
 */
export async function reportMotiveOnPrimary({ actorId, kind, text }, sender = null) {
    if (!isPrimaryGm()) return { refused: "that cannot be done now" };
    const students = await roster();
    const actor = game.actors.get(actorId ?? "") ?? null;
    await motiveStore.whenHydrated();
    const motive = actor ? motivesOf(actor.id)[kind] ?? null : null;
    const why = reportRefusal({ actor, kind, text, motive, students });
    if (why) return { refused: why };
    const row = currentRow(motiveStore.get(actor.id));
    const words = String(text ?? "").trim();
    await motiveStore.patch(actor.id, { [kind]: { ...row[kind], status: "reported", report: words, reason: "", at: Date.now(), reportedBy: sender?.id ?? null } });
    tellOwners(actor);
    Hooks.callAll("drpgMotivesChanged");
    const { rulingCardHtml } = await import("./motives-ui.mjs");
    // The buttons ride in the words, which reach the GMs alone (secret.mjs), as a find's "Write it here" does (observe.mjs).
    await whisperToGms(rulingCardHtml(actor, kind, { ...motive, report: words }));
    log(`${actor.name} reported their ${kind} motive done.`);
    return {};
}

/**
 * WHY A GM'S RULING IS REFUSED, or null (R9342): a motive of this chapter; a pass of one not yet passed (once: a
 * second press on the card is refused), a reject of one reported. Pure over what it is handed.
 */
export function ruleRefusal({ actor, kind, pass, motive, students = [] } = {}) {
    if (!motivesEnabled()) return "the players' motives are off at this table";
    if (!actor) return "no such character";
    if (!MOTIVE_KINDS.includes(kind)) return "that is not a kind of motive";
    if (!holdsMotives(actor, students)) return "that character holds no motives";
    if (!motive) return "no such motive this chapter";
    if (motive.status === "done") return "that motive is already passed";
    if (!pass && motive.status !== "reported") return "that motive has no report to reject";
    return null;
}

/**
 * The primary rules on a motive: a pass marks it `done`, gives the student its Hope (`giveMotiveHope`) and the sound
 * only its player hears (`SFX_EVENTS.motivePassed`), and tells the player; a reject marks it `rejected` with the GM's
 * reason, which the player is told, and the player may report it again. Answers `{ refused }` or `{ reply }` with what
 * landed.
 */
export async function ruleMotiveOnPrimary({ actorId, kind, pass, reason = "" }, sender = null) {
    if (!isPrimaryGm()) return { refused: "that cannot be done now" };
    const students = await roster();
    const actor = game.actors.get(actorId ?? "") ?? null;
    await motiveStore.whenHydrated();
    const motive = actor ? motivesOf(actor.id)[kind] ?? null : null;
    const why = ruleRefusal({ actor, kind, pass: Boolean(pass), motive, students });
    if (why) return { refused: why };
    const row = currentRow(motiveStore.get(actor.id));
    const by = sender?.id ?? game.user.id;
    const said = String(reason ?? "").trim().slice(0, 2000);
    await motiveStore.patch(actor.id, { [kind]: { ...row[kind], status: pass ? "done" : "rejected", reason: pass ? "" : said, ruledBy: by, ruledAt: Date.now() } });
    tellOwners(actor);
    Hooks.callAll("drpgMotivesChanged");
    const label = game.i18n.localize(kind === "personal" ? "DRPG.Motives.personal" : "DRPG.Motives.relationship");
    let landed = 0;
    if (pass) {
        landed = await giveMotiveHope(actor);
        await whisperToOwner(actor, `<p>${esc(plural("DRPG.Motives.passedYou", { n: landed, what: label }))}</p>`)
            .catch(err => error("Could not tell a player their motive was passed", err));
        try {
            const { playSfxForUsers } = await import("./sfx-play.mjs");
            playSfxForUsers(ownersOf(actor), "motivePassed");
        } catch (err) {
            error("Could not play the motive's sound for its player", err);
        }
    } else {
        await whisperToOwner(actor, `<p>${esc(game.i18n.format(said ? "DRPG.Motives.rejectedWhy" : "DRPG.Motives.rejectedYou", { what: label, why: said }))}</p>`)
            .catch(err => error("Could not tell a player their report was rejected", err));
    }
    const name = game.users.get(by)?.name ?? "?";
    await whisperToGms(`<p>${esc(pass ? plural("DRPG.Motives.passedGm", { name: actor.name, what: label, gm: name, n: landed })
        : game.i18n.format("DRPG.Motives.rejectedGm", { name: actor.name, what: label, gm: name }))}</p>`).catch(err => error("Could not tell the GMs a motive was ruled", err));
    log(`${actor.name}'s ${kind} motive ${pass ? `passed (${landed} Hope)` : "rejected"} by ${name}.`);
    return { reply: { status: pass ? "done" : "rejected", landed } };
}

/* ==========================================================================
 * THE REWARD (#3)
 * ========================================================================== */

/** How much of a reward of `amount` Hope lands on `held` of `max`: never past the maximum (#3). Pure (R9340). */
export function rewardAmount(held, max, amount = MOTIVES.hope) {
    const top = Number(max) > 0 ? Number(max) : STARTING.hopeMax;
    return Math.max(0, Math.min(Number(amount) || 0, top - (Number(held) || 0)));
}

/**
 * Give `actor` a motive's Hope, as the GMs hold it, up to the maximum (`rewardAmount`). The GM's own write (`gmRuling`).
 * Answers the Hope that landed (0-3): 0 for a full Hope, and 0 where the write did not land - the Despair darkening's
 * hold on Hope, which a GM's gift does not pass (overflow.mjs; the line's question 8.5) - and the card says what landed.
 */
export async function giveMotiveHope(actor, amount = MOTIVES.hope) {
    if (!actor || !game.user?.isGM) return 0;
    const { meansWrite } = await import("./sheet-audit.mjs");
    const { trustedWrite } = await import("./resource-guard.mjs");
    const { resourceValue } = await import("./character.mjs");
    let meant = 0;
    const before = resourceValue(actor, "hope");
    await meansWrite(actor, async ({ hope }, maxOf) => {
        meant = rewardAmount(hope, maxOf("hope") ?? STARTING.hopeMax, amount);
        if (meant > 0) await trustedWrite(actor, { "system.resources.hope.value": hope + meant }, { reason: "gmRuling" });
        return meant;
    });
    const after = resourceValue(actor, "hope");
    return Math.max(0, Math.min(meant, after - before));
}

/**
 * A MONOKUMA MOTIVE PASSED: every student who holds motives (a living student, #7) gets its Hope, and the table one
 * card with what each got (rules.mjs `setMotive`, when the GM answered "yes" to "was the last one passed?"). GM only.
 * Answers `[{ name, landed }]`.
 */
export async function rewardMonokumaMotive() {
    if (!game.user?.isGM) return [];
    const students = (await roster()).filter(actor => holdsMotives(actor, [actor]));
    const got = [];
    for (const actor of students) got.push({ name: actor.name, landed: await giveMotiveHope(actor) });
    if (got.length) {
        const rows = got.map(({ name, landed }) => `<li>${esc(plural("DRPG.Motives.monokumaRow", { n: landed, name }))}</li>`).join("");
        await announce({ content: `<div class="drpg-evidence-card"><p><strong>${esc(game.i18n.localize("DRPG.Motives.monokumaPassedTitle"))}</strong></p>
            <ul class="drpg-motive-hope">${rows}</ul></div>` });
    }
    return got;
}

/* ==========================================================================
 * THE LEVEL UP AFTER A CLASS TRIAL (#6; verdict.mjs, the step `motives`)
 * ========================================================================== */

/**
 * WHO DID EVERY MOTIVE OF THE CHAPTER, BY THE RECORD (R9345): a row ticked when the student's Personal and Relationship
 * Motives are passed and every Monokuma Motive of the chapter ended passed (#6), with the reason in words. A motive not
 * given is not done (the line's question 8.3); a Monokuma Motive still running at the verdict counts as not passed
 * (question 8.4). `row` the student's motives (`motivesOf`), `log` the chapter's ended Monokuma Motives
 * (`monokumaLog`), `running` whether one runs now. Pure: `{ ticked, parts: [[kind, word]] }` where word is
 * "done", "reported", "open", "rejected" or "none", and the Monokuma part `[done, total]`.
 */
export function levelUpReading(row, log = [], running = false) {
    const parts = [];
    for (const kind of MOTIVE_KINDS) parts.push([kind, row?.[kind]?.status ?? "none"]);
    const total = log.length + (running ? 1 : 0);
    const done = log.filter(entry => entry.outcome === "done").length;
    const ticked = parts.every(([, word]) => word === "done") && done === total;
    return { ticked, parts, monokuma: [done, total] };
}

/** The reading's words for the window's row: "Personal: passed; Relationship: reported, not passed; Monokuma Motive: 2 of 2". */
export function levelUpReason(reading) {
    const word = w => game.i18n.localize(`DRPG.Motives.state.${w}`);
    const parts = reading.parts.map(([kind, w]) => game.i18n.format("DRPG.Motives.reasonPart",
        { what: game.i18n.localize(kind === "personal" ? "DRPG.Motives.personal" : "DRPG.Motives.relationship"), state: word(w) }));
    const [done, total] = reading.monokuma;
    parts.push(total ? plural("DRPG.Motives.reasonMonokuma", { n: done, total }) : game.i18n.localize("DRPG.Motives.reasonNoMonokuma"));
    return parts.join("; ");
}

/** Whether this chapter used the motives at all: a private motive given, or a Monokuma Motive run (GM). */
export async function chapterHasMotives() {
    const { motive } = await import("./rules.mjs");
    return anyPrivateMotive() || monokumaLog().length > 0 || Boolean(motive());
}

/* ==========================================================================
 * THE OWNER'S COPY (as the pick's passes: lockpick-gm.mjs)
 * ========================================================================== */

/** GM: one user's own characters' rows and stamps; nothing for a GM. */
export function motivesFor(userId) {
    const user = game.users.get(userId);
    const stamps = {};
    if (!game.user?.isGM || !user || user.isGM) return { rows: {}, stamps };
    const owned = [];
    for (const actor of game.actors ?? []) {
        if (actor.type !== "character" || !actor.testUserPermission?.(user, "OWNER")) continue;
        owned.push(actor.id);
        stamps[actor.id] = motiveStore.newest(actor.id);
    }
    return { rows: copyRowsFor(motiveStore.entries() ?? {}, owned), stamps };
}

/** Primary GM: send one user their motives. Addressed, and only while they are here; nothing while the suite holds the stores. */
function sendMotivesTo(userId) {
    const user = game.users.get(userId);
    if (!game.user?.isGM || !user?.active || user.isGM || gmStoresQuiet()) return false;
    const { rows, stamps } = motivesFor(userId);
    game.socket.emit(SOCKET_EVENT, { action: ACTION_MINE, userId, rows, stamps }, { recipients: [userId] });
    return true;
}

/** Tell `actor`'s owners their motives again (a row written). */
export function tellOwners(actor) {
    if (!actor || !isPrimaryGm()) return;
    for (const userId of ownersOf(actor)) sendMotivesTo(userId);
}

/** After a restore (gm-stores.mjs `restoreCase`): every connected player is sent their motives again. Answers how many. */
export async function retellMotives() {
    if (!game.user?.isGM || gmStoresQuiet()) return 0;
    let sent = 0;
    for (const user of game.users ?? []) if (user.active && !user.isGM && sendMotivesTo(user.id)) sent++;
    return sent;
}

/** Owner: take the primary's answer where it is newer, for this user's own characters only. */
async function receiveMotives(rows, stamps) {
    const mine = {}, own = {};
    for (const [actorId, s] of Object.entries(stamps ?? {})) {
        if (!game.actors.get(actorId)?.isOwner) continue;
        own[actorId] = Number(s) || 0;
        const row = copyRow(rows?.[actorId]);
        if (row && MOTIVE_KINDS.some(kind => row[kind])) mine[actorId] = row;
    }
    return motiveCopy.receive(mine, own);
}

/** Owner: ask the primary for this user's motives. */
function askForMotives(primary = primaryGmId()) {
    if (!primary || game.user.isGM) return;
    try {
        game.socket.emit(SOCKET_EVENT, { action: ACTION_MINE_ASK }, { recipients: [primary] });
    } catch (err) {
        error("Could not ask the GM for this character's motives", err);
    }
}

function onMotivesSocket(payload, senderId) {
    if (payload?.action === ACTION_MINE_ASK) {
        if (!isPrimaryGm()) return;
        const sender = game.users.get(senderId);
        if (!sender?.active || sender.isGM) return;
        whenGmStoresAudible().then(() => motiveStore.whenHydrated()).then(() => sendMotivesTo(sender.id))
            .catch(err => error("Could not answer an owner's motives", err));
        return;
    }
    if (payload?.action !== ACTION_MINE || game.user.isGM) return;
    // A GM's, and addressed to this user: a player cannot hand another a motive.
    if (!replyForMe(payload, senderId)) return;
    receiveMotives(payload.rows, payload.stamps).catch(err => error("Could not keep a motive", err));
}

/** At init: the copy's listener on every client, an owner's first ask at ready, and again when a primary is ready. */
export function registerMotives() {
    game.socket.on(SOCKET_EVENT, onMotivesSocket);
    Hooks.once("ready", () => {
        if (!game.user?.isGM) askForMotives();
    });
    Hooks.on("drpgPrimaryReady", primary => askForMotives(primary));
    // The store merged from another GM, or the copy written: the windows and sheets that show motives redraw
    // (motives-ui.mjs hears `drpgMotivesChanged`). A store's and a copy's keys are client settings (gm-store.mjs), named
    // here by the engine's rows (`spec.key`), never by their settings (R171: only the engine names a store's key).
    // The Monokuma Motive is a world setting: `updateSetting` tells it, below (R14).
    const keys = new Set([`${MODULE_ID}.${motiveStore.spec.key}`, `${MODULE_ID}.${motiveCopy.spec.key}`]);
    /* Told only when what this browser holds of the motives changed. Every GM store is written once on the primary when
       another GM connects (the merge of its section, measured 28.11.2026: one write of each of 71 stores), and this was
       the one store whose write redrew the open sheets, 120 ms later (motives-ui.mjs `registerMotivesUi`) - on the
       primary, while the newcomer's first writes were arriving. Scenario 76 G read the primary's record in that window:
       its passage there, its grant 10 ms behind (red on 0432888, b7619b9 and 8028f21 in CI; green 6 of 6 on 31d5812). */
    let held = null;
    const holding = () => {
        try {
            return JSON.stringify(game.user?.isGM ? (motiveStore.entries() ?? {}) : (motiveCopy.read() ?? {}));
        } catch {
            return null;
        }
    };
    Hooks.once("ready", () => { held = holding(); });
    Hooks.on("clientSettingChanged", key => {
        if (!keys.has(key)) return;
        const now = holding();
        if (now !== null && now === held) return;
        held = now;
        Hooks.callAll("drpgMotivesChanged");
    });
    Hooks.on("updateSetting", setting => {
        if (setting?.key === `${MODULE_ID}.${SETTINGS.monokumaMotive}` || setting?.key === `${MODULE_ID}.${SETTINGS.motivesEnabled}`) Hooks.callAll("drpgMotivesChanged");
    });
}

/* ==========================================================================
 * THE SEASON RESET (#11)
 * ========================================================================== */

/**
 * The season reset's group `motives`: the Monokuma Motive (the public setting) and the old motive's key from before
 * 2.0, if a world still held one; the store `motives` and every player's copy are cut by the group's watermark
 * (gm-stores.mjs, `resetGroup: "motives"`). Written raw: nobody is told a motive is over during a reset.
 */
export async function clearSeasonMotives() {
    await setSetting(SETTINGS.monokumaMotive, {});
    await setSetting(SETTINGS.motive, {});
}

registerSeasonState({ group: "motives", clear: clearSeasonMotives, settings: [SETTINGS.monokumaMotive, SETTINGS.motive] });
