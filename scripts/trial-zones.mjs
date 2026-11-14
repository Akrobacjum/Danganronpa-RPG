/**
 * Danganronpa RPG - the trial hall's zones at work: who stands on which side, the stands kept and given back, the zone
 * modes' starts and what their steps leave behind (E73 C2-C4, 12.11.2026; plan E73 C2).
 * ---------------------------------------------------------------------------
 * The rows of the three modes are zone-machine.mjs's, written in the floor's one queue on the primary GM
 * (trial-floor.mjs `zoneStartInStep`, `zoneStepInStep`, steps of trial.mjs `SEIZE_KEY`). This file holds what those
 * steps read and do around the rows:
 *
 * WHO STANDS WHERE (`sidesNow`), on every client from the world alone, so the console, the HUD and the primary's count
 * read one answer: each trial participant (vote.mjs `trialParticipants` - one student per connected player, no
 * Monocub, nobody on the trial's list of the dead, an undiscovered death among them; TR30 = 2, TR33) is on the side
 * whose zone holds their hall token (zone-geometry.mjs `tokenZone`); a participant with no token in the hall is on the
 * side they picked in the side-pick window (`zone.picks`, bridge "trial.side"); a token on the line, or outside both
 * zones, and no pick, is on neither side. One student per player, so a player with two characters is counted once.
 * The hall's tokens of anybody else - a Monocub, a muted dead student, a Monokuma - are not counted wherever they stand.
 *
 * THE STANDS (`snapshotStands`, `returnToStands`). A zone mode starts with the participants' hall tokens where the
 * trial put them; their places are kept on the floor (`zone.stands`, public: they are where everybody already saw the
 * tokens) and given back in one write of the hall's tokens when the mode ends (trial-floor.mjs `endFloorInStep`). A
 * token a player moved into a zone is the player's answer; a player who never moves answers with the zone their stand
 * lies in (the GM handbook's section 15 says so).
 *
 * A MOVE BETWEEN ZONES IS NO CROSSING. The hall is a place for nobody (rooms.mjs `roomPieces`): no veto, no charge, no
 * fog, no Eclipse move, no Remnant, no `auditMove`, no `move.sentBack`, no `passage.cross` reads it. Tier 2 "E73 C2: a
 * move between the zones" holds that, and the entry's own sound and outline are this file's (`onZoneEntered`).
 */

import { MODULE_ID, TRIAL } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { trialScene } from "./rooms.mjs";
import { zoneRegions, zonesReady, tokenZone } from "./zone-geometry.mjs";
import { ZONE_MODES, isZoneMode, zoneOf, unanimous, countsOf, zoneStart } from "./zone-machine.mjs";
import { trialParticipants } from "./vote.mjs";
import { diveSetStore } from "./gm-stores.mjs";
import { isPrimaryGm, serialWrite, serverNow, error, esc } from "./utils.mjs";

/** The floor as stored, for the readers here that may not import trial-floor.mjs (it imports this file). */
function storedFloor() {
    const stored = game.settings.get(MODULE_ID, SETTINGS.trialQueue) ?? {};
    return stored.active ? stored : null;
}

/** The hall token of `actor` in `hall`: the first of its tokens there, or null. */
export function hallTokenOf(actor, hall = trialScene()) {
    if (!actor || !hall) return null;
    return Array.from(hall.tokens ?? []).find(t => t.actorId === actor.id) ?? null;
}

/**
 * WHO STANDS ON WHICH SIDE NOW: `{ a, b, none, line, picked }`, each a list of actor ids in the participants' order
 * (`picked` those of `a` and `b` that stand by a pick, not a token). `floor` the zone floor (its picks), `participants`
 * vote.mjs `trialParticipants`' rows, `hall` the linked hall, `regions` its zones.
 */
export function sidesNow({ floor = storedFloor(), participants = null, hall = trialScene(), regions = null } = {}) {
    const rows = participants ?? trialParticipants();
    const zones = regions ?? zoneRegions(hall);
    const picks = zoneOf(floor)?.picks ?? {};
    const out = { a: [], b: [], none: [], line: [], picked: [] };
    for (const { actor } of rows) {
        const token = hallTokenOf(actor, hall);
        const side = token ? tokenZone(zones, token) : (picks[actor.id] === "a" || picks[actor.id] === "b" ? picks[actor.id] : null);
        if (side === "a" || side === "b") {
            out[side].push(actor.id);
            if (!token) out.picked.push(actor.id);
        } else if (side === "line") out.line.push(actor.id);
        else out.none.push(actor.id);
    }
    return out;
}

/**
 * What a zone mode's rows read on the primary in the step (zone-machine.mjs `zoneStep`'s `ctx`): the sides, how many
 * take part, whether the zones are there, and for a Logic Dive question its truth, the set's next question and its
 * conclusion, off the GMs' store - handed to the machine, never written to the floor.
 */
export function zoneCtxOf(floor) {
    const participants = trialParticipants();
    const sides = sidesNow({ floor, participants });
    const ctx = { sides: { a: sides.a, b: sides.b }, participants: participants.length, zonesReady: zonesReady() };
    const zone = zoneOf(floor);
    if (floor?.mode === ZONE_MODES.dive && zone?.set?.id) {
        const set = diveSetStore.get(zone.set.id) ?? null;
        const questions = Array.isArray(set?.questions) ? set.questions : [];
        const index = Number(zone.set.index) || 0;
        const now = questions[index] ?? null;
        const next = questions[index + 1] ?? null;
        ctx.truth = now?.truth === "a" || now?.truth === "b" ? now.truth : null;
        ctx.next = next ? { question: next.question, answers: { a: next.a, b: next.b }, index: index + 1 } : null;
        ctx.conclusion = typeof set?.conclusion === "string" ? set.conclusion : null;
    }
    return ctx;
}

/**
 * Whether a zone floor should move before its clock runs out, as the primary's heartbeat asks every second (trial-floor.mjs
 * `isDue`): Logic Dive's vote with everybody on one side past its grace, or a Scrum turn whose camp has emptied. The
 * machine judges again in the step.
 */
export function zoneEarly(floor) {
    const zone = zoneOf(floor);
    if (!zone) return false;
    if (floor.mode === ZONE_MODES.dive && zone.phase === "vote") {
        const ran = (serverNow() - (Number(floor.startedAt) || 0)) / 1000;
        if (ran < (Number(TRIAL.modes.zones.dive.earlyAfterSeconds) || 10)) return false;
        const participants = trialParticipants();
        return unanimous(sidesNow({ floor, participants }), participants.length);
    }
    if (floor.mode === ZONE_MODES.scrum && zone.phase === "speak") {
        const counts = countsOf(sidesNow({ floor }));
        return counts.a === 0 || counts.b === 0;
    }
    return false;
}

/** The participants' hall tokens' places now: `{ tokenId: { x, y } }`, the stands a zone mode gives back. */
export function snapshotStands(hall = trialScene(), participants = trialParticipants()) {
    const out = {};
    for (const { actor } of participants) {
        const token = hallTokenOf(actor, hall);
        if (token) out[token.id] = { x: Number(token.x) || 0, y: Number(token.y) || 0 };
    }
    return out;
}

/**
 * The hall's tokens back on their stands, in one write of the hall on the primary GM (`stands` as `snapshotStands`
 * kept them): only a token still there and not on its stand. Answers how many it moved.
 */
async function returnToStands(stands, hall = trialScene()) {
    if (!isPrimaryGm() || !hall || !stands || typeof stands !== "object") return 0;
    const rows = Object.entries(stands).flatMap(([id, at]) => {
        const token = hall.tokens?.get?.(id);
        if (!token || !Number.isFinite(at?.x) || !Number.isFinite(at?.y)) return [];
        return token.x === at.x && token.y === at.y ? [] : [{ _id: id, x: at.x, y: at.y }];
    });
    if (!rows.length) return 0;
    try {
        await hall.updateEmbeddedDocuments("Token", rows, { animate: false, drpgStands: true });
    } catch (err) {
        error("Could not put the hall's tokens back on their stands", err);
        return 0;
    }
    return rows.length;
}

/**
 * Whether the voices can be split into the camps' rooms here: the world's regional voice on and avclient-livekit active
 * (voice-client.mjs `avclientActive`). Without either the voice decision is a no-op (voice.mjs), and a Scrum's Confer
 * runs as a timer alone. The facts can be handed in (R5914).
 */
export async function voicesSplit({ enabled, active } = {}) {
    const on = enabled ?? Boolean(game.settings.get(MODULE_ID, SETTINGS.voiceEnabled));
    if (!on) return false;
    if (active !== undefined) return Boolean(active);
    const { avclientActive } = await import("./voice-client.mjs");
    return Boolean(avclientActive());
}

/**
 * A SCRUM DEBATE'S CONFER BEGUN, on the primary after the floor is written (trial-floor.mjs `commitFloor`, the machine's
 * `conferBegun`): where the voices cannot be split (`voicesSplit`), one whisper to the GMs that the camps confer however
 * the table does - once per Confer, from the primary alone, so a second GM is not told twice. Answers whether it told.
 */
export async function conferNotice({ split } = {}) {
    if (!isPrimaryGm()) return false;
    const can = split ?? await voicesSplit();
    if (can) return false;
    try {
        const { whisperToGms } = await import("./utils.mjs");
        // A GMs' warning is a warning card (E49 B5a's census, R3510).
        await whisperToGms({ tone: "warning", body: `<p>${esc(game.i18n.localize("DRPG.Zones.scrum.noVoice"))}</p>` });
    } catch (err) {
        error("Could not tell the GMs that the camps' voices are not split", err);
        return false;
    }
    return true;
}

/** A finding's id, new each time. */
function findingId() {
    return foundry.utils.randomID(10);
}

/**
 * WHAT A ZONE STEP LEAVES BEHIND, on the primary after the floor is written (trial-floor.mjs `commitFloor`): the
 * Straw Poll's count in the trial's record (its split makes Scrum Debate the next step) and a Finding the step made
 * (`trialProgress().findings`), in the record's own step; a Logic Dive set's end in the GMs' store (`usedAt`, `endedAt`,
 * `outcome`, `stoppedAt`). The cards are the step's own.
 */
export async function afterZoneStep(result) {
    if (!isPrimaryGm() || !result) return;
    const rec = result.zoneRecord ?? null;
    if (rec) {
        const { setTrialProgress } = await import("./vote.mjs");
        await setTrialProgress(record => {
            const patch = {};
            if (rec.strawPoll) patch.strawPoll = { ...rec.strawPoll, at: Date.now() };
            if (rec.finding) {
                const list = Array.isArray(record.findings) ? record.findings : [];
                patch.findings = [...list, { id: findingId(), ...rec.finding, at: Date.now(), confirmed: false, edited: false }];
            }
            return patch;
        });
    }
    if (result.dive?.setId) {
        await diveSetStore.whenHydrated();
        const row = diveSetStore.get(result.dive.setId);
        if (row) {
            const ended = result.dive.outcome !== "stopped";
            await diveSetStore.patch(result.dive.setId, {
                endedAt: Date.now(), outcome: result.dive.outcome,
                stoppedAt: ended ? null : Number(result.dive.index) || 0
            });
        }
    }
}

/**
 * The stands of the zone floor that ends here, given back (trial-floor.mjs `endFloorInStep`, every road that closes a
 * floor: the mode's end, End this mode, the trial's exit). Nothing for any other floor.
 */
export async function zoneFloorEnded(prev) {
    const zone = zoneOf(prev);
    if (!zone) return 0;
    return returnToStands(zone.stands);
}

/* ==========================================================================
 * STARTS, ON WHICHEVER GM ASKS (the console's picker window, `game.drpg.startStrawPoll` ...)
 * ========================================================================== */

/** Why a zone mode cannot start now, in the GM's words, or null: no Class Trial, no zones, another mode on the floor. */
export function zoneStartRefusal(floor = storedFloor(), { inTrial = game.settings.get(MODULE_ID, SETTINGS.clock)?.phase === "classTrial" } = {}) {
    if (!inTrial) return game.i18n.localize("DRPG.Floor.bar.notTrial");
    if (!zonesReady()) return game.i18n.localize("DRPG.Zones.noZones");
    if (floor && floor.mode !== "debate") return game.i18n.localize("DRPG.Zones.busy");
    return null;
}

/**
 * WHY THIS START WOULD BE REFUSED, read as the primary's machine will read it (the needsCode line, 14.11.2026; R6909):
 * zone-machine.mjs `zoneStart` on the event the start makes - for a Logic Dive the set's question as `diveStartEvent`
 * would take it, read without marking the set played. A key of the machine's (`Zones.noAnswers`, `noQuestion`,
 * `noSet`), or null. The floor and the trial are `zoneStartRefusal`'s, and a set that is gone or empty the primary's:
 * those stay `Zones.notStarted`. Until this, the machine's refusal came back as null and the GM read notStarted's list.
 */
export async function zoneArgsRefusal(op, args = {}) {
    if (op === "dive") {
        if (!String(args.set ?? "")) return "DRPG.Zones.noSet";
        const event = await diveEventOf(args.set, Number(args.from) > 0 ? Math.round(Number(args.from)) - 1 : -1);
        return event ? zoneStart(null, event, { zonesReady: true })?.refused ?? null : null;
    }
    const mode = op === "straw" ? ZONE_MODES.straw : op === "scrum" ? ZONE_MODES.scrum : null;
    if (!mode) return null;
    return zoneStart(null, { type: "zone", mode, question: args.text ?? "", answers: { a: args.a ?? "", b: args.b ?? "" }, thesis: args.thesis ?? "" },
        { zonesReady: true })?.refused ?? null;
}

/** A zone mode started on whichever GM asks: refused here with the reason first, judged again on the primary. */
async function startZone(op, args) {
    if (!game.user.isGM) return null;
    const refused = zoneStartRefusal();
    if (refused) {
        ui.notifications.warn(refused);
        return null;
    }
    const why = await zoneArgsRefusal(op, args);
    if (why) {
        ui.notifications.warn(game.i18n.localize(why));
        return null;
    }
    const { floorStep } = await import("./trial-floor.mjs");
    const written = await floorStep(op, args);
    if (!written?.zone) ui.notifications.warn(game.i18n.localize("DRPG.Zones.notStarted"));
    return written ?? null;
}

/** `game.drpg.startStrawPoll({ question, a, b })` (E73 C3): a Straw Poll of 45 s. */
export function startStrawPoll({ question = "", a = "", b = "" } = {}) {
    return startZone("straw", { text: String(question ?? ""), a: String(a ?? ""), b: String(b ?? "") });
}

/** `game.drpg.startScrumDebate({ question, a, b, thesis })` (E73 C5): the camps' 45 s, then the turns. */
export function startScrumDebate({ question = "", a = "", b = "", thesis = "" } = {}) {
    return startZone("scrum", { text: String(question ?? ""), a: String(a ?? ""), b: String(b ?? ""), thesis: String(thesis ?? "") });
}

/**
 * `game.drpg.startLogicDive(setId, { from })` (E73 C4): the set from its question `from` (its number, from 1), or with
 * none from the question it stopped at when it stopped, else the first. A set already played is played again (TR32 = 2);
 * the GM's window warns where it ended.
 */
export function startLogicDive(setId, { from = null } = {}) {
    return startZone("dive", { set: String(setId ?? ""), from: Number(from) > 0 ? Math.round(Number(from)) : 0 });
}

/** Count now (the bar's): a Straw Poll or a Logic Dive question counted at once. */
export async function countNow() {
    if (!game.user.isGM) return null;
    const { floorStep } = await import("./trial-floor.mjs");
    return floorStep("zoneCount");
}

/** Skip question (the bar's, Logic Dive): the next question, no answer kept. */
export async function skipQuestion() {
    if (!game.user.isGM) return null;
    const { floorStep } = await import("./trial-floor.mjs");
    return floorStep("zoneSkipQuestion");
}

/**
 * What the primary's start step reads for a Logic Dive (trial-floor.mjs `zoneStartInStep`): the set's question at
 * `from` (-1: the one it stopped at, else the first), as the machine's start event; the set marked played. Null for no
 * set, an empty one or an index past its end.
 */
export async function diveStartEvent(setId, from = -1) {
    const event = await diveEventOf(setId, from);
    if (!event) return null;
    await diveSetStore.patch(setId, { usedAt: Date.now() });
    return event;
}

/** `diveStartEvent`'s reading alone, the set left unmarked (`zoneArgsRefusal` asks it on whichever GM pressed Start). */
async function diveEventOf(setId, from = -1) {
    await diveSetStore.whenHydrated();
    const set = diveSetStore.get(String(setId ?? ""));
    const questions = Array.isArray(set?.questions) ? set.questions : [];
    if (!questions.length) return null;
    const index = Number(from) >= 0 ? Number(from) : Number.isInteger(set.stoppedAt) ? set.stoppedAt : 0;
    const q = questions[index];
    if (!q) return null;
    return { type: "zone", mode: ZONE_MODES.dive, question: q.question, answers: { a: q.a, b: q.b }, set: { id: setId, index, total: questions.length } };
}

/* ==========================================================================
 * A PARTICIPANT'S SIDE, PICKED FROM THE WINDOW (bridge "trial.side")
 * ========================================================================== */

/**
 * "trial.side" on the primary (bridge-runs-records.mjs `handleTrialSide`): a participant with no token in the hall picks
 * Zone A or Zone B. The sender's ownership of `actorId` is the bridge's guard; here, in a step of the floor's key: a
 * zone mode on the floor, the character taking part, no token of theirs in the hall (a token answers by where it
 * stands), and the machine's `pick` row. `{ reply: { side } }` or `{ refused }` in the bridge's closed words.
 */
export async function sideOnPrimary({ actorId, side }) {
    if (!isPrimaryGm()) return { refused: "nothing was carried out: this GM's browser is not the primary" };
    const floorMod = await import("./trial-floor.mjs");
    const { SEIZE_KEY } = await import("./trial.mjs");
    return serialWrite(SEIZE_KEY, async () => {
        if (!floorMod.inClassTrial()) return { refused: "no Class Trial is in session" };
        const floor = floorMod.trialFloor();
        if (!isZoneMode(floor?.mode)) return { refused: "no zone mode holds the floor now" };
        const row = trialParticipants().find(p => p.actor.id === actorId);
        if (!row) return { refused: "that character takes no part in the round" };
        if (hallTokenOf(row.actor)) return { refused: "that character stands in the hall: their token answers" };
        const out = await floorMod.zoneStepInStep({ type: "pick", actorId, side });
        if (out?.refused === "DRPG.Zones.samePick") return { refused: "that character has already picked that side" };
        if (out?.refused) return { refused: "no zone mode holds the floor now" };
        return { reply: { side } };
    });
}

/**
 * A Scrum speaker's thesis on the primary ("trial.keyword", bridge-runs-records.mjs `handleTrialKeyword`): the speaker
 * alone, during their turn, a short text posted as a card of the mode. `{ reply: { ok } }` or `{ refused }`.
 */
export async function thesisOnPrimary({ actorId, text }) {
    if (!isPrimaryGm()) return { refused: "nothing was carried out: this GM's browser is not the primary" };
    const floorMod = await import("./trial-floor.mjs");
    const { SEIZE_KEY } = await import("./trial.mjs");
    return serialWrite(SEIZE_KEY, async () => {
        if (!floorMod.inClassTrial()) return { refused: "no Class Trial is in session" };
        const floor = floorMod.trialFloor();
        if (floor?.mode !== ZONE_MODES.scrum) return { refused: "no zone mode holds the floor now" };
        const out = await floorMod.zoneStepInStep({ type: "thesis", actorId, text: String(text ?? "") });
        if (out?.refused === "DRPG.Floor.round.notSpeaker") return { refused: "it is not that character's turn" };
        if (out?.refused) return { refused: "no zone mode holds the floor now" };
        return { reply: { ok: true } };
    });
}

/* ==========================================================================
 * FINDINGS (E73 C6; TR21, TR28 = 1: the GM has full control, of content too - every press public on its card)
 * ========================================================================== */

/** The trial's Findings now: `trialProgress().findings`, a copy. */
export async function findingsNow() {
    const { trialProgress } = await import("./vote.mjs");
    return [...(trialProgress().findings ?? [])];
}

/** The record's Findings written whole (another GM's write goes to the primary as the record's own patch). */
async function writeFindings(list) {
    const { setTrialProgress } = await import("./vote.mjs");
    await setTrialProgress({ findings: list });
}

/** A card of a GM's press on the Findings, public (TR28 = 1). */
async function findingCard(key, words) {
    const { announce } = await import("./utils.mjs");
    const { trialEventCard } = await import("./trial-floor-ui.mjs");
    await announce({ content: trialEventCard("DRPG.Zones.findings.title", game.i18n.format(key, zoneCardWords(words))) });
}

/**
 * `game.drpg.addFinding(text)`: a Finding the GM writes, with no mode behind it (a Scrum Debate's end, a ruling) - told
 * on a public card. Answers its id, or null.
 */
export async function addFinding(text) {
    if (!game.user.isGM) return null;
    const words = String(text ?? "").trim().slice(0, (Number(TRIAL.modes.zones.answerLength) || 80) * 3);
    if (!words) return null;
    const id = findingId();
    await writeFindings([...(await findingsNow()), { id, text: words, question: null, mode: null, at: Date.now(), confirmed: false, edited: true }]);
    await findingCard("DRPG.Zones.findings.added", { text: words });
    return id;
}

/** `game.drpg.editFinding(id, text)`: a Finding's words changed by the GM, the change told on a public card. */
export async function editFinding(id, text) {
    if (!game.user.isGM) return false;
    const list = await findingsNow();
    const row = list.find(f => f.id === id);
    const words = String(text ?? "").trim().slice(0, (Number(TRIAL.modes.zones.answerLength) || 80) * 3);
    if (!row || !words || words === row.text) return false;
    await writeFindings(list.map(f => (f.id === id ? { ...f, text: words, edited: true } : f)));
    await findingCard("DRPG.Zones.findings.edited", { was: row.text, text: words });
    return true;
}

/** `game.drpg.deleteFinding(id)`: a Finding taken off the list by the GM, told on a public card. */
export async function deleteFinding(id) {
    if (!game.user.isGM) return false;
    const list = await findingsNow();
    const row = list.find(f => f.id === id);
    if (!row) return false;
    await writeFindings(list.filter(f => f.id !== id));
    await findingCard("DRPG.Zones.findings.deleted", { text: row.text });
    return true;
}

/** `game.drpg.confirmFinding(id)`: "Monokuma confirms" on a Finding (TR28 = 1), marked on the list and told on a card. */
export async function confirmFinding(id) {
    if (!game.user.isGM) return false;
    const list = await findingsNow();
    const row = list.find(f => f.id === id);
    if (!row || row.confirmed) return false;
    await writeFindings(list.map(f => (f.id === id ? { ...f, confirmed: true } : f)));
    await findingCard("DRPG.Zones.findings.confirmed", { text: row.text });
    return true;
}

/** The words a zone card is formatted with, escaped (trial-floor.mjs `postFloorCard`). */
export function zoneCardWords(words = {}) {
    return Object.fromEntries(Object.entries(words ?? {}).map(([k, v]) => [k, esc(String(v ?? ""))]));
}

