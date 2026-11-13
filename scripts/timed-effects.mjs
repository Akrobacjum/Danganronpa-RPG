/**
 * Danganronpa RPG - the timed effects a room action gives, the GMs' half, the owner's copy and the sheet's line.
 * ---------------------------------------------------------------------------
 * The owner's answer to Q-E93-3, 12.11.2026 (DRPG-D1, through the coordinator): "Dodajemy teraz". The design is
 * docs/dev/e93/STATUS.md's "Timed effects".
 *
 * WHAT ONE IS. An effect of a room action (config.mjs `FACILITIES.effects`, a kind with `untils`) that lasts a while. The
 * primary GM gives it (facilities-gm.mjs `applyEffects` calls `giveTimed`): it does what the kind does (`KINDS[kind].give`,
 * a GM's write) and keeps a row, in the character's list in the GMs' store `timedEffects` (gm-stores.mjs
 * `timedEffectStore`, keyed by character, the list written whole), with its end, `until`:
 *
 *   - `timeOfDay`: when the time of day it was given in ends (`mark`, facilities.mjs `facilityMark`);
 *   - `day`: when the clock's day changes (`day`, `dayMark`).
 *
 * WHEN IT ENDS. On the primary at `drpgTimeOfDayChanged` (`endTimedEffects`): each row past its end is taken back
 * (`KINDS[kind].take`) and dropped; a row that lasts until an Eclipse at its end (`endEclipseEffects`). Those two are
 * the only callers of `endTimedEffect` outside the tests: no window, button or game.drpg command ends a row by hand
 * (A113-C6-5, 13.11.2026; this line said "a GM may end one by hand" until then). A GM who edits a trait the row raised
 * back to its number by hand does not end the row, and its end takes the bonus again from whatever the sheet holds:
 * measured headless on 13.11.2026, a +2 on a trait of 0, edited back to 0, read -2 after `endTimedEffect`.
 *
 * WHO SEES IT. The GMs (the store), and each owner of the character, through a copy of their own characters' rows
 * (gm-stores.mjs `timedEffectCopy`), sent by the primary when a row is given or ends and when the owner asks (at load, at
 * `drpgPrimaryReady`), as the pick's passes are (lockpick-gm.mjs). The sheet's line reads it (`effectLines`, sheet.mjs
 * `paintStateBadges`); what a kind writes on the sheet (a trait's number) every browser that sees the sheet sees, as any
 * sheet value.
 */

import { MODULE_ID, TRAITS } from "./config.mjs";
import { getClock } from "./settings.mjs";
import { isPrimaryGm, primaryGmId, log, error } from "./utils.mjs";
import { timedEffectStore, timedEffectCopy } from "./gm-stores.mjs";
import { gmStoresQuiet, whenGmStoresAudible } from "./gm-store.mjs";
import { replyForMe } from "./bridge-guards.mjs";
import { facilityMark } from "./facilities.mjs";

const SOCKET_EVENT = `module.${MODULE_ID}`;
const ACTION_TIMED = "timed.effects";
const ACTION_TIMED_ASK = "timed.effectsAsk";

/** The day a row belongs to: the season, the chapter and the clock's day. Pure. */
export function dayMark(clock = getClock()) {
    return [clock?.seasonStartedAt ?? 0, clock?.chapter ?? 1, clock?.day ?? 1].join(".");
}

/** A trait's number as the sheet holds it. */
const traitValue = (actor, trait) => Number(actor?.system?.traits?.[TRAITS[trait]?.dh]?.value) || 0;

/** What each kind does when given, what taking it back does, and its line. A kind with no `take` changes nothing to undo. */
const KINDS = Object.freeze({
    traitBonus: Object.freeze({
        give: async (actor, row) => {
            const { trustedWrite } = await import("./resource-guard.mjs");
            await trustedWrite(actor, { [`system.traits.${TRAITS[row.trait].dh}.value`]: traitValue(actor, row.trait) + row.n }, { reason: "facility" });
        },
        take: async (actor, row) => {
            const { trustedWrite } = await import("./resource-guard.mjs");
            await trustedWrite(actor, { [`system.traits.${TRAITS[row.trait].dh}.value`]: traitValue(actor, row.trait) - row.n }, { reason: "facility" });
        },
        line: row => game.i18n.format("DRPG.Facility.timed.traitBonus", { n: row.n, trait: TRAITS[row.trait]?.label ?? row.trait }),
        short: row => game.i18n.format("DRPG.Facility.badge.traitBonus", { n: row.n, trait: TRAITS[row.trait]?.label ?? row.trait })
    }),
    // An Experience of the GM's name and value X, added to the sheet under an id of its own kept on the row (`ref`), and
    // deleted by that id at the end - never one the character had.
    experience: Object.freeze({
        give: async (actor, row) => {
            const { trustedWrite } = await import("./resource-guard.mjs");
            row.ref = foundry.utils.randomID(16);
            await trustedWrite(actor, { [`system.experiences.${row.ref}`]: { name: row.label, value: row.n } }, { reason: "facility" });
        },
        take: async (actor, row) => {
            if (!row.ref || !actor.system?.experiences?.[row.ref]) return;
            const { trustedWrite } = await import("./resource-guard.mjs");
            const { forcedDeletion } = await import("./utils.mjs");
            await trustedWrite(actor, { [`system.experiences.${row.ref}`]: forcedDeletion() ?? null }, { reason: "facility" });
        },
        line: row => game.i18n.format("DRPG.Facility.timed.experience", { n: row.n, label: row.label ?? "" }),
        short: row => game.i18n.format("DRPG.Facility.badge.experience", { n: row.n })
    }),
    // Nothing is written when it is given: the award reads the row (`takeDespairShield`) and the first point it stops uses
    // it up.
    despairShield: Object.freeze({
        give: async () => {},
        line: () => game.i18n.localize("DRPG.Facility.timed.despairShield"),
        short: () => game.i18n.localize("DRPG.Facility.badge.despairShield")
    }),
    // Nothing is written when it is given: the Ultimate's arming reads the row (`boostUltimate`) and uses it up.
    ultimateBoost: Object.freeze({
        give: async () => {},
        line: () => game.i18n.localize("DRPG.Facility.timed.ultimateBoost"),
        short: () => game.i18n.localize("DRPG.Facility.badge.ultimateBoost")
    }),
    // Nothing is written when it is given: the Eclipse's judges read the rows (gm-stores.mjs `timedCrossingsOf`).
    eclipseCrossing: Object.freeze({
        give: async () => {},
        line: row => game.i18n.format("DRPG.Facility.timed.eclipseCrossing", { n: row.n }),
        short: row => game.i18n.format("DRPG.Facility.badge.eclipseCrossing", { n: row.n })
    })
});

/** On the primary, at an Eclipse's end: every row that lasts until one ended. Answers how many. */
export async function endEclipseEffects() {
    let n = 0;
    for (const actorId of Object.keys(timedEffectStore.entries() ?? {})) {
        for (const row of timedEffectsOf(actorId)) if (row.until === "eclipse" && (await endTimedEffect(row.id))) n++;
    }
    return n;
}

/**
 * On the primary, for a fresh roll's point of Despair (despair-award.mjs `awardRollDespair`): whether `actor` holds a
 * protection from Despair, which is then used up and the roll's message marked (`despairShielded`, a GM's flag) so a
 * Reroll of it moves no Despair either way (reroll.mjs `settleDespair`). Answers whether the point is stopped.
 */
export async function takeDespairShield(actor, message = null) {
    if (!actor?.id || !isPrimaryGm()) return false;
    const row = timedEffectsOf(actor.id).find(r => r.kind === "despairShield");
    if (!row) return false;
    await writeList(actor.id, timedEffectsOf(actor.id).filter(r => r.id !== row.id));
    tellOwners(actor);
    if (message?.setFlag) await message.setFlag(MODULE_ID, "despairShielded", true).catch(err => error("Could not mark a shielded roll", err));
    log(`${actor.name}'s protection from Despair stopped a roll's point.`);
    return true;
}

/**
 * On a GM, once the character's Ultimate Call is armed (call-effects.mjs `appendArmedCall`, where the GM's road and the
 * player's both end): when `actor` holds a stronger next Ultimate, one more Call of advantage armed beside it, from this
 * GM (key "facility", spent with the same roll as every armed Call), and the row used up. Answers whether it did.
 */
export async function boostUltimate(actor) {
    if (!actor?.id || !game.user?.isGM) return false;
    const row = timedEffectsOf(actor.id).find(r => r.kind === "ultimateBoost");
    if (!row) return false;
    await writeList(actor.id, timedEffectsOf(actor.id).filter(r => r.id !== row.id));
    tellOwners(actor);
    const { appendArmedCall } = await import("./call-effects.mjs");
    await appendArmedCall(actor, { key: "facility", kind: "hope", grants: "advantage", amount: null, nonce: foundry.utils.randomID(16) }, { by: game.user });
    log(`${actor.name}'s Ultimate is stronger this once: a second die of advantage.`);
    return true;
}

/** The kinds this file keeps. */
export const TIMED_KINDS = Object.freeze(Object.keys(KINDS));

/** This GM's rows of `actorId`, oldest first, each with its `id` (the store holds a character's whole list, `effects`). */
export function timedEffectsOf(actorId) {
    const list = timedEffectStore.get(actorId)?.effects;
    return (Array.isArray(list) ? list : []).filter(row => row && typeof row.id === "string").sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
}

/** Write `actorId`'s list whole, or drop the character's row when it is empty. */
async function writeList(actorId, list) {
    if (list.length) await timedEffectStore.patch(actorId, { actorId, effects: list });
    else if (timedEffectStore.get(actorId)) await timedEffectStore.drop(actorId);
}

/** The row `id` and its character, or null. */
function rowById(id) {
    for (const [actorId, entry] of Object.entries(timedEffectStore.entries() ?? {})) {
        const row = (entry?.effects ?? []).find(r => r?.id === id);
        if (row) return { actorId, row };
    }
    return null;
}

/**
 * Give `actor` the timed effect `effect` (a cleaned effect of `FACILITIES.effects`: `{ kind, n, trait?, until }`), on the
 * primary: what its kind does, and a row with its end. Answers the row's id, or null for a kind this file does not keep.
 */
export async function giveTimed(actor, effect, clock = getClock()) {
    const kind = KINDS[effect?.kind];
    if (!kind || !actor) return null;
    await timedEffectStore.whenHydrated();
    const id = foundry.utils.randomID(16);
    const row = { id, kind: effect.kind, n: Number(effect.n) || 1, until: effect.until ?? "timeOfDay",
        mark: facilityMark(clock), day: dayMark(clock), at: Date.now() };
    if (effect.trait) row.trait = effect.trait;
    if (effect.label) row.label = effect.label;
    await kind.give(actor, row);
    await writeList(actor.id, [...timedEffectsOf(actor.id), row]);
    tellOwners(actor);
    log(`${actor.name} has a timed effect: ${effect.kind} ${row.n}${row.trait ? ` ${row.trait}` : ""}, until ${row.until}.`);
    return id;
}

/** End one row: what it did taken back, the row dropped, its owners told. Answers whether there was one. */
export async function endTimedEffect(id) {
    const found = rowById(id);
    if (!found) return false;
    const actor = game.actors.get(found.actorId);
    try {
        if (actor) await KINDS[found.row.kind]?.take?.(actor, found.row);
    } finally {
        await writeList(found.actorId, timedEffectsOf(found.actorId).filter(r => r.id !== id));
        tellOwners(actor ?? { id: found.actorId });
    }
    return true;
}

/** Whether `row` is past its end at `clock`. Pure. */
export function pastItsEnd(row, clock = getClock()) {
    if (row?.until === "timeOfDay") return row.mark !== facilityMark(clock);
    if (row?.until === "day") return row.day !== dayMark(clock);
    return false;
}

/** On the primary, at a new time of day: every row past its end ended. Answers how many. */
export async function endTimedEffects({ clock = getClock() } = {}) {
    let n = 0;
    for (const actorId of Object.keys(timedEffectStore.entries() ?? {})) {
        for (const row of timedEffectsOf(actorId)) if (pastItsEnd(row, clock) && (await endTimedEffect(row.id))) n++;
    }
    return n;
}

/** The rows `actor`'s sheet shows on this browser: the GMs' store on a GM, the owner's copy on a player's. */
function rowsHere(actor) {
    if (!actor?.id) return [];
    if (game.user?.isGM) return timedEffectsOf(actor.id);
    const list = (timedEffectCopy.read() ?? {})[actor.id];
    return Array.isArray(list) ? list : [];
}

/** One effect or row as a line: what it does and what ends it ("+2 Body - until the time of day ends"). */
export function timedLine(row) {
    return KINDS[row?.kind] ? `${KINDS[row.kind].line(row)} - ${game.i18n.localize(`DRPG.Facility.until.${row.until}`)}` : "";
}

/**
 * The sheet's badges of `actor`'s timed effects on this browser, beside the armed Calls (sheet.mjs `pendingStack`; the
 * owner's asks of 12.11.2026): `{ short, what, until }` - a name of one or two words on the badge, what it does and what
 * ends it in the tooltip.
 */
export function effectBadges(actor) {
    return rowsHere(actor).filter(row => KINDS[row?.kind])
        .map(row => ({ short: KINDS[row.kind].short(row), what: KINDS[row.kind].line(row), until: game.i18n.localize(`DRPG.Facility.until.${row.until}`) }));
}

/** The sheet's lines of `actor`'s timed effects on this browser. */
export function effectLines(actor) {
    return rowsHere(actor).filter(row => KINDS[row?.kind]).map(timedLine);
}

/** GM: one user's own characters' rows, and only those, with a stamp per character they own. */
export function timedEffectsFor(userId) {
    const user = game.users.get(userId);
    const effects = {}, stamps = {};
    if (!game.user?.isGM || !user || user.isGM) return { effects, stamps };
    for (const actor of game.actors ?? []) {
        if (actor.type !== "character" || !actor.testUserPermission?.(user, "OWNER")) continue;
        const rows = timedEffectsOf(actor.id);
        stamps[actor.id] = timedEffectStore.newest(actor.id);
        if (rows.length) effects[actor.id] = rows.map(({ kind, n, trait, label, until }) => ({ kind, n, trait: trait ?? null, label: label ?? null, until }));
    }
    return { effects, stamps };
}

/** Primary GM: send one user their rows. Addressed, and only while they are here; nothing while the suite holds the stores. */
export function sendTimedEffectsTo(userId) {
    const user = game.users.get(userId);
    if (!game.user?.isGM || !user?.active || user.isGM || gmStoresQuiet()) return false;
    const { effects, stamps } = timedEffectsFor(userId);
    game.socket.emit(SOCKET_EVENT, { action: ACTION_TIMED, userId, effects, stamps }, { recipients: [userId] });
    return true;
}

/** Tell `actor`'s owners their rows again (one given or ended). */
function tellOwners(actor) {
    const doc = game.actors.get(actor?.id ?? "");
    if (!doc || !isPrimaryGm()) return;
    for (const user of game.users ?? []) {
        if (!user.isGM && doc.testUserPermission?.(user, "OWNER")) sendTimedEffectsTo(user.id);
    }
}

/** After a restore (gm-stores.mjs `restoreCase`): every connected player is sent their rows again. Answers how many. */
export async function retellTimedEffects() {
    if (!game.user?.isGM || gmStoresQuiet()) return 0;
    let sent = 0;
    for (const user of game.users ?? []) if (user.active && !user.isGM && sendTimedEffectsTo(user.id)) sent++;
    return sent;
}

/** Owner: take the primary's answer where it is newer (`timedEffectCopy`), for this user's own characters only. */
export async function receiveTimedEffects(effects, stamps) {
    const mine = {}, own = {};
    for (const [actorId, s] of Object.entries(stamps ?? {})) {
        if (!game.actors.get(actorId)?.isOwner) continue;
        own[actorId] = Number(s) || 0;
        const list = Array.isArray(effects?.[actorId]) ? effects[actorId] : [];
        const rows = list.filter(row => KINDS[row?.kind] && typeof row.until === "string")
            .map(row => ({ kind: row.kind, n: Number(row.n) || 1, trait: typeof row.trait === "string" ? row.trait : null,
                label: typeof row.label === "string" ? row.label.slice(0, 60) : null, until: row.until }));
        if (rows.length) mine[actorId] = rows;
    }
    return timedEffectCopy.receive(mine, own);
}

/** Owner: ask the primary for this user's rows. */
function askForTimedEffects(primary = primaryGmId()) {
    if (!primary || game.user.isGM) return;
    try {
        game.socket.emit(SOCKET_EVENT, { action: ACTION_TIMED_ASK }, { recipients: [primary] });
    } catch (err) {
        error("Could not ask the GM for this character's timed effects", err);
    }
}

function onTimedSocket(payload, senderId) {
    if (payload?.action === ACTION_TIMED_ASK) {
        if (!isPrimaryGm()) return;
        const sender = game.users.get(senderId);
        if (!sender?.active || sender.isGM) return;
        whenGmStoresAudible().then(() => timedEffectStore.whenHydrated()).then(() => sendTimedEffectsTo(sender.id))
            .catch(err => error("Could not answer an owner's timed effects", err));
        return;
    }
    if (payload?.action !== ACTION_TIMED || game.user.isGM) return;
    // A GM's, and addressed to this user: a player cannot hand another an effect.
    if (!replyForMe(payload, senderId)) return;
    receiveTimedEffects(payload.effects, payload.stamps).catch(err => error("Could not keep a timed effect", err));
}

/** At ready: the copy's listener on every client, an owner's first ask, and the primary's clock listener. */
export function registerTimedEffects() {
    game.socket.on(SOCKET_EVENT, onTimedSocket);
    Hooks.on("drpgTimeOfDayChanged", () => {
        if (isPrimaryGm()) endTimedEffects().catch(err => error("The timed effects past their end could not be ended", err));
    });
    Hooks.on("drpgEclipseChanged", active => {
        if (active === false && isPrimaryGm()) endEclipseEffects().catch(err => error("The Eclipse's extra crossings could not be ended", err));
    });
    if (game.user.isGM) return;
    askForTimedEffects();
    Hooks.on("drpgPrimaryReady", primary => askForTimedEffects(primary));
}
