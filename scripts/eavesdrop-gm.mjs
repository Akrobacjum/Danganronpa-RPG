/**
 * Danganronpa RPG - Listen's eavesdrop, the GMs' half and the owner's copy.
 * ---------------------------------------------------------------------------
 * E69 C6, 13.11.2026 (the owner's 10.11 (a), the plan's C6 and its answers (a)-(d); docs/dev/plans/E69.md on the plan
 * branch; the audit A113-C5-2). Until this file Listen was a card and nothing else.
 *
 * WHAT IT IS. After a good Listen roll the card comes first (Q-E69-2's default), then the listener's voice is moved into
 * the voice channel of the room they listened at, with their microphone blocked: they hear that room and nobody there
 * hears them. One channel at a time (a new eavesdrop replaces the row). Nobody in that room is told (the answer (a)): no
 * card, no notice. What LiveKit itself shows there - the listener is one more participant of the channel, and the voice
 * tile's speaker button counts every participant (voice-tile.mjs `channelCount`, R550) - is not hidden here: hiding it
 * would tell those browsers who listens. LIVE-E69-03 measures it at a real table.
 *
 * WHERE THE DECISION IS. The voice room is decided where every voice room is, on the primary GM (voice.mjs
 * `placeVoices`'s eavesdrop rule, `listeningRow`); this file holds the rows that rule reads (`listensInForce`) and ends
 * those that no longer stand. The block is the trial's own write (voice.mjs `settleTrialVoices`, BROADCAST_AUDIO on the
 * user, a row of `trialMuteStore`), so a GM's own block is never touched and the block is put back exactly as found.
 * This is the forced-mute helper Q-E69-4's default asks E69 to lay for the murder's privacy, a later stage.
 *
 * WHEN IT ENDS (the answer (c), and the plan's C6): the listener's settled crossing out of the room they listen from -
 * not a step inside it, nor a step into a doorway's gap (`eavesdropEnd` reads the room, and a gap is no room); a new time
 * of day; an Eclipse; an incident; a Class Trial; the listener's death; the Stop listening button (`listen.stop`). The
 * voice goes back first and the block is lifted `EAVESDROP_GRACE_MS` later, so the room never hears the first words.
 *
 * A FREE REPEAT. A row stays, ended, for the rest of its time of day: a new eavesdrop on the same room of the same scene
 * in it costs no action and no roll (`freeRepeat`; a default, written in docs/dev/e69/STATUS.md).
 *
 * WITHOUT LIVEKIT (or with the world's voice per room off): the card alone and no move; the GMs are told once a load.
 *
 * THE OWNER'S COPY. As the pick's passes (lockpick-gm.mjs): `eavesdropCopy`, sent by the primary GM when a row changes
 * and when the owner asks; read by the voice tile and the Listen window. A stale copy can show a Stop button that stops
 * nothing; it never moves a voice.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS, getSetting, getClock, isDeadForGm, isEclipse } from "./settings.mjs";
import { isPrimaryGm, primaryGmId, log, error, whisperToGms, esc } from "./utils.mjs";
import { eavesdropStore, eavesdropCopy } from "./gm-stores.mjs";
import { gmStoresQuiet, whenGmStoresAudible } from "./gm-store.mjs";
import { replyForMe } from "./bridge-guards.mjs";
import { CROSSING_SETTLED } from "./crossing-settle.mjs";

const SOCKET_EVENT = `module.${MODULE_ID}`;
const ACTION_ROWS = "eavesdrop.rows";
const ACTION_ROWS_ASK = "eavesdrop.rowsAsk";

/** The hook fired on every browser where a row of the store changes: voice.mjs settles the block on it. */
export const EAVESDROP_CHANGED = "drpgEavesdropChanged";

/**
 * How long the microphone stays blocked after an eavesdrop ends: the move back is sent first, and a reconnect takes a
 * moment (voice-client.mjs `applyBreakout`). A design number, not a measurement; LIVE-E69-03 reads it at a table.
 */
export const EAVESDROP_GRACE_MS = 4000;

/** The time of day a row is counted in: the clock's chapter, day and time of day, as one mark. */
export const markNow = (clock = getClock()) => `${clock?.chapter ?? 0}:${clock?.day ?? 0}:${clock?.timeOfDay ?? ""}`;

/** The users who own `actor`, players only. */
const ownersOf = actor => (game.users ?? []).filter(u => !u.isGM && actor?.testUserPermission?.(u, "OWNER")).map(u => u.id);

/**
 * Why an eavesdrop under way ends now, or null while it stands. Pure: every fact is handed in (R6021).
 *   - `mark` the time of day now (`markNow`); `eclipse`, `trial`, `incident`, `dead` the four phases that end it;
 *   - `place` where the GMs read the listener standing, `{ sceneId, room }`, or null (no token). A room of null - a
 *     doorway's gap, an undrawn corridor - is no step out: only standing in another room, or on another scene, ends it.
 * @returns {null|"off"|"timeOfDay"|"eclipse"|"trial"|"incident"|"death"|"left"|"gone"}
 */
export function eavesdropEnd(row, { mark, eclipse = false, trial = false, incident = false, dead = false, place = null } = {}) {
    if (!row?.active) return "off";
    if (row.mark !== mark) return "timeOfDay";
    if (eclipse) return "eclipse";
    if (trial) return "trial";
    if (incident) return "incident";
    if (dead) return "death";
    if (!place) return "gone";
    if (place.sceneId !== row.sceneId) return "left";
    if (place.room && place.room !== row.from) return "left";
    return null;
}

/** Whether a new eavesdrop on `into` of `sceneId` is a free repeat of `row` (an earlier one this time of day). Pure (R6021). */
export function freeRepeat(row, { mark, sceneId, into }) {
    return Boolean(row && row.mark === mark && row.sceneId === sceneId && row.into === into);
}

/** Whether the world's voice per room can move anybody: avclient-livekit active and the module's switch on. */
async function voiceCanMove() {
    const { avclientActive } = await import("./voice-client.mjs");
    return Boolean(avclientActive() && getSetting(SETTINGS.voiceEnabled) === true);
}

/** The phase facts every end and every start reads, on the GM. */
async function phaseNow() {
    const { murderState } = await import("./murder.mjs");
    return { mark: markNow(), eclipse: isEclipse(), trial: getClock()?.phase === "classTrial", incident: Boolean(murderState()?.active) };
}

/** Where the GMs read `actor` standing: `{ sceneId, room }` or null. */
async function placeOf(actor) {
    const { gmPlaceOf } = await import("./movement.mjs");
    const place = gmPlaceOf(actor);
    return place?.scene ? { sceneId: place.scene.id, room: place.room ?? null } : null;
}

let saidNoVoice = false;

/**
 * Begin an eavesdrop on the primary GM (the run of `listen.eavesdrop`): `actor` listens at `into`, a neighbour of the
 * room the GMs read them in. `rolled` true when a good Listen roll paid for it, false for a free repeat, which needs
 * a row of this time of day on that room. Answers `{ refused }` (English, the bridge maps it to a code) or
 * `{ moved, free }` - `moved` false where voice cannot move anybody (the card alone). `voice` is the suite's (E69-T5).
 */
export async function startEavesdrop({ actor, into, userId = null, rolled = false, voice = voiceCanMove }) {
    if (!actor) return { refused: "no such character" };
    await eavesdropStore.whenHydrated();
    const phase = await phaseNow();
    if (phase.eclipse) return { refused: "an Eclipse is running" };
    if (phase.trial) return { refused: "that waits until the Class Trial is over" };
    if (phase.incident || isDeadForGm(actor)) return { refused: "that cannot be done now" };
    const place = await placeOf(actor);
    if (!place?.room) return { refused: "the character is not standing in any room" };
    const { neighbouringRooms } = await import("./movement.mjs");
    const scene = game.scenes.get(place.sceneId);
    if (typeof into !== "string" || !neighbouringRooms(scene, place.room).includes(into)) {
        return { refused: "nothing was carried out: that room is not next to the character's" };
    }
    const before = eavesdropStore.get(actor.id);
    const free = !rolled && freeRepeat(before, { mark: phase.mark, sceneId: place.sceneId, into });
    if (!rolled && !free) return { refused: "nothing was carried out: no roll and no eavesdrop on that room this time of day" };
    if (!(await voice())) {
        if (!saidNoVoice) {
            saidNoVoice = true;
            await whisperToGms(`<p>${esc(game.i18n.localize("DRPG.Listen.eavesdrop.noVoiceGm"))}</p>`);
        }
        return { moved: false, free };
    }
    await eavesdropStore.patch(actor.id, { actorId: actor.id, userId, sceneId: place.sceneId, from: place.room, into,
        mark: phase.mark, active: true, endedAt: null, at: Date.now() });
    // The block before the move: the room never hears the listener (voice.mjs `settleTrialVoices`).
    await settleBlock();
    changed(actor);
    log(`${actor.name} listens at the door of ${into}, from ${place.room}.`);
    return { moved: true, free };
}

/** End `actorId`'s eavesdrop (`why` for the log). The voice goes back at once, the block after the grace. */
export async function endEavesdrop(actorId, why = "off") {
    const row = eavesdropStore.get(actorId);
    if (!row?.active) return false;
    await eavesdropStore.patch(actorId, { active: false, endedAt: Date.now() });
    changed(game.actors.get(actorId));
    setTimeout(() => settleBlock().catch(err => error("The listener's microphone could not be given back", err)), EAVESDROP_GRACE_MS + 50);
    log(`An eavesdrop of ${game.actors.get(actorId)?.name ?? actorId} ended (${why}).`);
    return true;
}

/** Every row's end, read now on the primary: the rows that ended are ended. Answers how many. */
export async function sweepEavesdrops() {
    if (!isPrimaryGm()) return 0;
    const phase = await phaseNow();
    let n = 0;
    for (const [actorId, row] of Object.entries(eavesdropStore.entries() ?? {})) {
        if (!row?.active) {
            // A row of another time of day is worth nothing: no free repeat is left in it.
            if (row?.mark !== phase.mark) await eavesdropStore.drop(actorId);
            continue;
        }
        const actor = game.actors.get(actorId);
        const why = eavesdropEnd(row, { ...phase, dead: !actor || isDeadForGm(actor), place: actor ? await placeOf(actor) : null });
        if (why && (await endEavesdrop(actorId, why))) n++;
    }
    return n;
}

/**
 * The eavesdrops the voice pass places (voice.mjs `voiceTargets`): actor id -> `{ sceneId, from, into }`, for every row
 * that stands now. On the primary each row read here is judged first, and one that ended is ended; another browser (a
 * GM's dry run) reads the rows as they are.
 */
export async function listensInForce() {
    if (isPrimaryGm()) await sweepEavesdrops();
    const out = new Map();
    for (const [actorId, row] of Object.entries(eavesdropStore.entries() ?? {})) {
        if (row?.active) out.set(actorId, { sceneId: row.sceneId, from: row.from, into: row.into });
    }
    return out;
}

/** The users whose microphone an eavesdrop holds blocked now: an active row's, or one ended less than the grace ago. */
export function eavesdropMutedIds(now = Date.now()) {
    const ids = new Set();
    for (const row of Object.values(eavesdropStore.entries() ?? {})) {
        if (!row?.userId) continue;
        if (row.active || (Number(row.endedAt) && now - Number(row.endedAt) < EAVESDROP_GRACE_MS)) ids.add(row.userId);
    }
    return ids;
}

/** The GMs' list for the voice panel: `[{ actorId, name, from, into }]`, every eavesdrop under way. */
export function eavesdropsUnderWay() {
    return Object.entries(eavesdropStore.entries() ?? {}).filter(([, row]) => row?.active)
        .map(([actorId, row]) => ({ actorId, name: game.actors.get(actorId)?.name ?? actorId, from: row.from, into: row.into }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

/** The block settled to the rows (voice.mjs `settleTrialVoices`), on the primary. */
async function settleBlock() {
    if (!isPrimaryGm()) return null;
    const { settleTrialVoices } = await import("./voice.mjs");
    return settleTrialVoices();
}

/** A row changed: the owners told, the voice placed again at once, every browser's hook. */
function changed(actor) {
    tellOwners(actor);
    Hooks.callAll(EAVESDROP_CHANGED, { actorId: actor?.id ?? null });
    import("./voice.mjs").then(m => m.scheduleReconcile({ immediate: true })).catch(err => error("The listener's voice could not be placed", err));
}

/* ------------------------------ the owner's copy ------------------------------ */

/** GM: one user's own characters' rows, with a stamp per character they own. */
export function eavesdropsFor(userId) {
    const user = game.users.get(userId);
    const rows = {}, stamps = {};
    if (!game.user?.isGM || !user || user.isGM) return { rows, stamps };
    for (const actor of game.actors ?? []) {
        if (actor.type !== "character" || !actor.testUserPermission?.(user, "OWNER")) continue;
        stamps[actor.id] = eavesdropStore.newest(actor.id);
        const row = eavesdropStore.get(actor.id);
        if (row) rows[actor.id] = { sceneId: row.sceneId, from: row.from, into: row.into, mark: row.mark, active: Boolean(row.active) };
    }
    return { rows, stamps };
}

/** Primary GM: send one user their rows. Addressed, and only while they are here; nothing while the suite holds the stores. */
export function sendEavesdropsTo(userId) {
    const user = game.users.get(userId);
    if (!game.user?.isGM || !user?.active || user.isGM || gmStoresQuiet()) return false;
    const { rows, stamps } = eavesdropsFor(userId);
    game.socket.emit(SOCKET_EVENT, { action: ACTION_ROWS, userId, rows, stamps }, { recipients: [userId] });
    return true;
}

function tellOwners(actor) {
    if (!actor || !isPrimaryGm()) return;
    for (const userId of ownersOf(actor)) sendEavesdropsTo(userId);
}

/** After a restore: every connected player is sent their rows again. Answers how many. */
export async function retellEavesdrops() {
    if (!game.user?.isGM || gmStoresQuiet()) return 0;
    let sent = 0;
    for (const user of game.users ?? []) if (user.active && !user.isGM && sendEavesdropsTo(user.id)) sent++;
    return sent;
}

/** Owner: take the primary's answer where it is newer, for this user's own characters only. */
export async function receiveEavesdrops(rows, stamps) {
    const mine = {}, own = {};
    for (const [actorId, s] of Object.entries(stamps ?? {})) {
        if (!game.actors.get(actorId)?.isOwner) continue;
        own[actorId] = Number(s) || 0;
        const row = rows?.[actorId];
        if (row && typeof row === "object" && typeof row.into === "string" && typeof row.sceneId === "string") {
            mine[actorId] = { sceneId: row.sceneId, from: typeof row.from === "string" ? row.from : null, into: row.into,
                mark: typeof row.mark === "string" ? row.mark : "", active: row.active === true };
        }
    }
    return eavesdropCopy.receive(mine, own);
}

/** This browser's own eavesdrop under way, `{ actorId, sceneId, from, into }`, or null: the copy on a player, the store on a GM. */
export function myEavesdrop(user = game.user) {
    const rows = user?.isGM ? {} : (eavesdropCopy.read() ?? {});
    for (const [actorId, row] of Object.entries(rows)) {
        if (row?.active && game.actors.get(actorId)?.isOwner) return { actorId, sceneId: row.sceneId, from: row.from, into: row.into };
    }
    return null;
}

/** This browser's copy of `actorId`'s row (a free repeat's question in the Listen window), or null. */
export function ownEavesdropRow(actorId) {
    return (eavesdropCopy.read() ?? {})[actorId] ?? null;
}

function askForRows(primary = primaryGmId()) {
    if (!primary || game.user.isGM) return;
    try {
        game.socket.emit(SOCKET_EVENT, { action: ACTION_ROWS_ASK }, { recipients: [primary] });
    } catch (err) {
        error("Could not ask the GM for this character's eavesdrop", err);
    }
}

function onEavesdropSocket(payload, senderId) {
    if (payload?.action === ACTION_ROWS_ASK) {
        if (!isPrimaryGm()) return;
        const sender = game.users.get(senderId);
        if (!sender?.active || sender.isGM) return;
        whenGmStoresAudible().then(() => eavesdropStore.whenHydrated()).then(() => sendEavesdropsTo(sender.id))
            .catch(err => error("Could not answer an owner's eavesdrop", err));
        return;
    }
    if (payload?.action !== ACTION_ROWS || game.user.isGM) return;
    // A GM's, and addressed to this user: a player cannot hand another a channel.
    if (!replyForMe(payload, senderId)) return;
    receiveEavesdrops(payload.rows, payload.stamps).catch(err => error("Could not keep an eavesdrop", err));
}

/** At ready: the copy's listener on every client, an owner's first ask, and the primary's listeners of every end. */
export function registerEavesdrops() {
    game.socket.on(SOCKET_EVENT, onEavesdropSocket);
    const sweep = () => { if (isPrimaryGm()) sweepEavesdrops().catch(err => error("The eavesdrops could not be judged", err)); };
    // A settled crossing out of the room listened from (crossing-settle.mjs); the voice pass's sweep catches a GM's drag.
    Hooks.on(CROSSING_SETTLED, event => {
        if (!isPrimaryGm() || !event?.actorId) return;
        const row = eavesdropStore.get(event.actorId);
        if (row?.active && event.from === row.from && event.to !== row.from) {
            endEavesdrop(event.actorId, "left").catch(err => error("An eavesdrop could not end", err));
        }
    });
    for (const hook of ["drpgTimeOfDayChanged", "drpgEclipseChanged", "drpgPhaseChanged", "drpgDeathsChanged"]) Hooks.on(hook, sweep);
    if (game.user.isGM) return;
    askForRows();
    Hooks.on("drpgPrimaryReady", primary => askForRows(primary));
}
