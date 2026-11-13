/**
 * The Key Remnants (E54, the plan's K1): the plan and its store (`keyPlan`, `setKeyPlan`, `archiveKeyPlan`, `liftKeyPlan` ...),
 * the keys a case holds and those still to place (`caseKeyCount`, `keysToPlace`, `keyPlanStatus`, `missingKeyRows`), the fee for
 * a key not found (`keyFeeOf`, `chargeForUnfoundKeys`), the plan saved (`saveKeyPlan`), and the placing road (`randomPointIn`,
 * `createKeyRemnant`, `openKeyRemnantHere`, `placeInSlot`, `placeKeyRow`). Moved out of investigation.mjs, which re-exports
 * every name it exported and keeps `openNewTrace` and the dashboard. The bedroom keys are bedroom-keys.mjs's (F4).
 */

import { KEY_REMNANTS, MODULE_ID, REMNANT_VISIBILITY, REMNANT_VISIBILITY_LABELS } from "./config.mjs";
import { SETTINGS, sameSeason } from "./settings.mjs";
import { getClock } from "./clock.mjs";
import { remnantsOn, remnantData, remnantById, setRemnantPublic, traceLabel, authorOptions } from "./remnants.mjs";
import { bulletsOf, secretOf, isTruthBullet } from "./truth-bullets.mjs";
import { studentActors } from "./monokuma.mjs";
import { livingStudentsForGm } from "./chapter.mjs";
import { log, isPrimaryGm, error, plural, whisperToGms, workingScene, esc } from "./utils.mjs";
import { drpgWindow } from "./ui-kit.mjs";
import { keyPlanStore, remnantStore } from "./gm-stores.mjs";
import { murderState } from "./incident-store.mjs";
import { bridgeRequest } from "./bridge-guards.mjs";
import { roomRegions } from "./rooms.mjs";
import { registerSeasonState } from "./season-reset.mjs";

export const ICON = "icons/svg/hazard.svg";

/** The five difficulty steps, named where the scale itself is defined. */
export const SCALE_LABELS = KEY_REMNANTS.scaleLabels;

/* ==========================================================================
 * THE PLAN
 * ========================================================================== */

/** A plan row's fields, in the order a row is written. */
// `room` (13.11.2026): where a slot not on the map is to go, the realization's and Place's first choice
const PLAN_FIELDS = ["scale", "name", "text", "analysis", "note", "tokenId", "sceneId", "room"];
const planKey = (chapter, slot) => `${chapter}:${slot}`;
/** A chapter's case row (E09 C6, `recordCaseKeys`): beside its slots, and not one of them. */
const caseKey = chapter => `${chapter}:case`;
const isCaseKey = key => String(key).endsWith(":case");
/**
 * A chapter's reveal row (E70 C9, 28.10.2026; amend 4 (h)): `{ paid, revealed }` - how many Key Remnants the chapter's
 * fee charged Despair for (`chargeForUnfoundKeys`, written with the fee and never counted again) and the rows of
 * `missingKeys` Monokuma's Reveal has shown (trial-modes.mjs `revealMissingKey`). Beside the slots and the case row, read
 * by no slot reader (`chapterRows` takes integer slots), dropped by a reset that keeps the plan (`keepOnlyKeyPlanChapter`).
 * The GMs' store and not the trial's record, which every browser holds: the fee's count is whispered to the GMs alone
 * (trap 116's "whispered, not announced"), and a count of the Key Remnants the table missed in the world record would
 * tell a player's console what the whisper keeps from them.
 */
const revealKey = chapter => `${chapter}:reveal`;
const isRevealKey = key => String(key).endsWith(":reveal");

/** The chapter's reveal row as this GM holds it: `{ paid, revealed }`, 0 and none where nothing was written. */
export function keyRevealRecord(chapter = getClock().chapter) {
    const row = game.user?.isGM ? keyPlanStore.get(revealKey(Number(chapter))) ?? {} : {};
    return {
        paid: Math.max(Number(row.paid) || 0, 0),
        revealed: Array.isArray(row.revealed) ? row.revealed.map(String) : []
    };
}

/** A row of `missingKeys` the Reveal has shown, added to the chapter's reveal row (trial-modes.mjs `revealMissingKey`). */
export async function recordKeyRevealed(chapter, id) {
    if (!game.user.isGM) return null;
    const { revealed } = keyRevealRecord(chapter);
    if (revealed.includes(String(id))) return revealed;
    const next = [...revealed, String(id)];
    await keyPlanStore.patch(revealKey(Number(chapter)), { revealed: next });
    return next;
}
const blank = value => value === undefined || value === null || value === "";
/** Whether a row says anything a GM wrote: the scale alone is the slot's, not the GM's. */
const worthKeeping = row => Boolean(row?.name || row?.text || row?.analysis || row?.note || row?.tokenId);

/** One chapter's rows on this GM's browser, by slot. */
function chapterRows(chapter) {
    const prefix = `${chapter}:`;
    const rows = new Map();
    for (const [key, row] of Object.entries(keyPlanStore.entries())) {
        if (!key.startsWith(prefix)) continue;
        const slot = Number(key.slice(prefix.length));
        if (Number.isInteger(slot) && slot >= 0) rows.set(slot, row);
    }
    return rows;
}

/**
 * Every chapter a case was closed for - the one it opened in since E09 fix r1-G3 - as
 * this GM's browser holds their case rows (`recordCaseKeys`), newest first. What `chargeForUnfoundKeys` asks whether the trial
 * opening now is too late for (E09 C7): the slots' chapters, which it asked until then
 * (`plannedChapters`, gone with C7), were written by any Save of the planner.
 */
function closedCaseChapters() {
    return Object.keys(keyPlanStore.entries()).filter(isCaseKey)
        .map(key => Number(String(key).split(":")[0])).filter(Number.isFinite).sort((a, b) => b - a);
}

/**
 * The plan for the chapter the clock is on: five slots, scaled trivial to desperate, and
 * any a row names beyond them.
 *
 * A PLAN BELONGS TO ONE MURDER, and until 1.2.64 that was enforced by throwing the old one
 * away: the world setting held one chapter's plan, and a clock on another chapter was
 * given blanks - last murder's clues are not this murder's blanks. The GM store keeps a row
 * per chapter and slot (E05 C5, gm-stores.mjs `keyPlanStore`), so the clock's chapter reads
 * its own rows and no other's, and the chapter before is still there, untouched, when the
 * clock comes back to it.
 *
 * ONLY ON A GM'S BROWSER (audit S01-01, S05-02). The rows are the GMs' store; anywhere else
 * this is the clock's chapter and five blank slots - `game.drpg.keyPlan()` has no GM guard,
 * and until 1.2.64 it read the whole plan off the world on any player's console.
 */
export function keyPlan() {
    const chapter = getClock().chapter;
    const rows = game.user?.isGM ? chapterRows(chapter) : new Map();
    const slots = Math.max(KEY_REMNANTS.scale.length, ...[...rows.keys()].map(slot => slot + 1));
    return {
        chapter,
        /* `name` and `text` ARE THE PLAYER'S HALF, and until 1.2.42 a plan row had
           neither. The one field it did have was labelled "Clue" and placeholdered "What
           this clue tells them", and it wrote `note` - a GM-private field. Measured: a Key
           Remnant placed from this planner reached its finder as a Truth Bullet called
           "Trace" with an empty description, while the sentence the GM wrote sat in the
           ledger where no player could ever reach it. The three fields say what they are.
           `analysis` is the fourth since 21.09: what the finder reads once they analyse it. */
        entries: Array.from({ length: slots }, (_, slot) => {
            const row = rows.get(slot) ?? {};
            return {
                scale: row.scale ?? KEY_REMNANTS.scale[slot] ?? "standard",
                name: row.name ?? "", text: row.text ?? "", analysis: row.analysis ?? "", note: row.note ?? "",
                tokenId: row.tokenId ?? null, sceneId: row.sceneId ?? null, room: row.room ?? ""
            };
        })
    };
}

/**
 * Save a chapter's plan: each slot the plan names, and in it only what this save changes.
 *
 * WHAT IT DOES NOT WRITE IS THE POINT (E05 C5). The world setting was replaced whole, so
 * of two GMs saving the plan the later one's copy of every slot won - a clue the other had
 * just written went back to what the later one had on screen. A row per slot and a stamp
 * per field let each keep theirs, as long as a save writes only what its GM changed, and
 * "changed" is measured against what that GM was looking at: `base`, the plan a window was
 * drawn from. A field equal to it is not written, whatever the store holds now - so a
 * window opened before another GM's edit arrived does not take that edit back with the
 * stale copy it still shows. Without a `base` (the console, a macro) the plan is taken to
 * be read just now: a field equal to the row this browser holds is not stamped again
 * (`changedOnly`, which a write with a base keeps as well), and a blank where the row holds
 * nothing is not written at all - a slot nobody has written here is not one this GM
 * emptied. A hole in `entries` is a slot left alone (`openKeyRemnantHere` writes one slot).
 * The one field written either way is a slot's scale where the row has none: it is the
 * slot's, never a GM's word, so every slot `entries` names is left a row. Until E09 C7 a chapter
 * with rows was a planned one to `chargeForUnfoundKeys`, which charged nothing for a chapter
 * without them while another had some; the dashboard's Save names only the slots the GM
 * changed (E09 C3, S05-16's planner half), and until then it handed every slot over, so
 * pressing Save on a chapter nobody had planned made it a planned one. Since C7 the charge
 * reads the closed cases instead (`keyFeeOf`), and a Save decides nothing there.
 *
 * Nothing is filed when the chapter changes, because nothing is replaced: until 1.2.64 a
 * plan saved for another chapter moved the one it replaced under `archive` first (the GM
 * lost the index to their own case, measured 10.09), and the rows are a chapter's now.
 *
 * @param {{chapter?: number, entries: Array}} plan
 * @param {{base?: {chapter: number, entries: Array}|null}} [options]
 */
export async function setKeyPlan(plan, { base = null } = {}) {
    if (!game.user.isGM) return null;
    const chapter = plan?.chapter ?? getClock().chapter;
    const from = base && base.chapter === chapter && Array.isArray(base.entries) ? base : null;
    const same = (a, b) => (blank(a) && blank(b)) || JSON.stringify(a) === JSON.stringify(b);
    const rows = {};
    (plan?.entries ?? []).forEach((entry, slot) => {
        if (!entry || typeof entry !== "object") return;
        const key = planKey(chapter, slot);
        const held = keyPlanStore.get(key) ?? {};
        const was = from ? (from.entries[slot] ?? {}) : held;
        const fields = {};
        for (const field of PLAN_FIELDS) {
            const value = entry[field];
            if (value === undefined) continue;
            const fill = field === "scale" && !blank(value) && blank(held.scale);
            if (!fill && (from ? same(value, was[field]) : blank(value) && blank(was[field]))) continue;
            fields[field] = value;
        }
        if (Object.keys(fields).length) rows[key] = fields;
    });
    await keyPlanStore.patchMany(rows, { changedOnly: true });
    return plan;
}

/**
 * Whether a chapter's plan holds anything a GM wrote.
 *
 * Until 1.2.64 this filed the chapter's plan under `archive` at the chapter's end, because
 * `setKeyPlan` filed an old plan only when one for another chapter was saved over it - and
 * a GM who ended a chapter and carried on never did that (the archive measured empty a
 * chapter later). The rows are a chapter's already (E05 C5), so there is nothing to file;
 * what is left is the question the filing asked first.
 */
export async function archiveKeyPlan(chapter) {
    if (!game.user.isGM) return false;
    return [...chapterRows(chapter).values()].some(worthKeeping);
}

/**
 * A world from before 1.2.64 holds the plan in the world setting `keyRemnantPlan`, which
 * every browser reads (audit S01-01, S05-02). The clause `liftKeyPlan` (migrate.mjs, since
 * 1.2.64) runs this once, on the primary, after the store holds the other GMs' copies
 * (E05 C5).
 *
 * Every chapter the key holds: each `archive[chapter]`, then `chapter`'s own entries over
 * the archive's of the same number - a chapter filed at its end and planned again is the
 * newer one. A slot's fields go in weak and fill-only, so a field a GM has written since
 * the update keeps its value; a blank field carries nothing and is left out, and a slot
 * with nothing but its scale is still a row, as a Save leaves one (a planned chapter, to
 * `chargeForUnfoundKeys` until E09 C7). The key is emptied only once every field reads back from
 * storage; otherwise it is left whole, and the lift throws with the count of what did not
 * read back, so the world is not stamped and the next load tries again (E05 fix r1-G1;
 * migrate.mjs, above the lifts) - as it does when the emptied key does not read back
 * empty. Idempotent: a world already through this holds nothing.
 *
 * @returns {Promise<null|{notPrimary: true}|{lifted: number, kept: number, emptied: boolean}>}  `kept` 0 and
 *   `emptied` true: anything else throws.
 */
export async function liftKeyPlan() {
    if (!isPrimaryGm()) return { notPrimary: true };
    if (await keyPlanStore.whenHydrated() === "timedOut") {
        throw new Error("the other GMs' copies of the Key Remnant plan did not arrive; the next load tries again");
    }
    const old = game.settings.get(MODULE_ID, SETTINGS.legacyKeyRemnantPlan) ?? {};
    if (!Object.keys(old).length) return null;
    // A chapter's entries, whole: the current plan replaces its chapter's filed copy, blanks and all.
    const chapters = new Map(Object.entries(old.archive && typeof old.archive === "object" ? old.archive : {}));
    if (!blank(old.chapter)) chapters.set(String(old.chapter), old.entries);
    const rows = {};
    for (const [chapter, entries] of chapters) {
        (Array.isArray(entries) ? entries : []).forEach((entry, slot) => {
            if (!entry || typeof entry !== "object") return;
            const fields = Object.fromEntries(PLAN_FIELDS.filter(f => !blank(entry[f])).map(f => [f, entry[f]]));
            if (Object.keys(fields).length) rows[planKey(chapter, slot)] = fields;
        });
    }
    if (Object.keys(rows).length) {
        await keyPlanStore.patchMany(rows, { weak: true, fillOnly: true });
        await keyPlanStore.idle();
    }
    let lifted = 0, kept = 0;
    for (const [key, fields] of Object.entries(rows)) {
        const held = keyPlanStore.persisted(key) ?? {};
        for (const field of Object.keys(fields)) {
            if (Object.hasOwn(held, field)) lifted++;
            else kept++;
        }
    }
    if (kept) throw new Error(`${kept} field(s) of the Key Remnant plan did not read back from the GM store, so the world's key is left as it was; the next load tries again`);
    await game.settings.set(MODULE_ID, SETTINGS.legacyKeyRemnantPlan, {});
    const left = Object.keys(game.settings.get(MODULE_ID, SETTINGS.legacyKeyRemnantPlan) ?? {}).length;
    if (left) throw new Error("the world's Key Remnant plan did not read back empty; the next load tries again");
    if (lifted) log(`Lifted the Key Remnant plan out of world data: ${lifted} field(s) in ${Object.keys(rows).length} row(s).`);
    return { lifted, kept, emptied: true };
}

/** Every chapter's plan this GM's browser holds, taken away (the season reset) - each chapter's case row with it. */
export async function clearKeyPlan() {
    if (!game.user.isGM) return;
    if (isPrimaryGm()) await keyPlanStore.clear();
    else await keyPlanStore.dropMany(Object.keys(keyPlanStore.entries()));
}

/**
 * Every chapter's rows but one, taken away (E05 fix r1-G5, M3).
 *
 * `clearKeyPlan` runs when the season reset's "keyPlan" group is TICKED; this runs
 * instead when a GM UNTICKS it to keep the plan. Kept meant kept whole until this fix - the
 * rows have no season stamped on them (`keyPlanStore`'s own comment says so), so
 * `plannedChapters()` read every chapter the old season had ever written a row for, and a
 * fresh season's chapter with an old row was "planned" before anybody opened the planner
 * this season: `chargeForUnfoundKeys` billed its unfound slots against a plan nobody made,
 * and a chapter revisited later inherited fields (a `tokenId` among them) a GM here never
 * saw and never wrote, because `setKeyPlan`'s diff reads them as this chapter's already-held
 * row. 1.2.63's single world setting could only ever keep one chapter's plan, and this keeps
 * the same one: `chapter`, read by the caller BEFORE the reset's own "clock" step sends the
 * clock back to 1 - the chapter the season was ending on, shown again once a new season's
 * clock reaches that number, exactly as 1.2.63's did. Called on the primary alone
 * (`wipeSeason` is), so `dropMany` needs no `clearKeyPlan`-style branch for another GM.
 *
 * THE KEPT CHAPTER'S CASE ROW GOES WITH THE SEASON (E09 fix r1-G3, 08.10.2026; the round-1
 * correctness review's F8). E09 C6 kept it with the slots, as the size of the case they were
 * planned for - but that case is the old season's, and `caseKeyCount` reads the row before a
 * running incident's own count: a new season's case in the kept chapter read the old one's
 * (tier 2, "a season reset clears the case's Key count whether it keeps the plan or not ...",
 * red before this fix on 08.10.2026: the kept chapter's dashboard still drew the old case's limit
 * of three, and a new case of five there read 3). The slots stay; the next case's close writes
 * its own row.
 */
export async function keepOnlyKeyPlanChapter(chapter) {
    if (!game.user.isGM) return 0;
    // The reveal row with the case row (E70 C9): the fee it counts was the old case's.
    const drop = Object.keys(keyPlanStore.entries()).filter(key => isCaseKey(key) || isRevealKey(key) || Number(key.split(":")[0]) !== Number(chapter));
    if (drop.length) await keyPlanStore.dropMany(drop);
    return drop.length;
}

/**
 * The season reset's keyPlan group (E42 C3; a run of season-setup.mjs `wipeSeason` until then). The Key Remnant plan
 * is a GM store since E05 (a row per chapter and slot): the reset's cut takes every chapter's rows on every GM, one
 * away now included, and this clears what this browser holds.
 */
export async function clearSeasonKeyPlan() {
    await clearKeyPlan();
}

/**
 * KEPT IS NOT WHOLE (E05 fix r1-G5, M3; the reset's keep hook since E42 C3). Unticked, every chapter's rows would ride
 * into the new season - which is not what 1.2.63's single stored plan ever did: it held one chapter's plan and showed
 * it again only once the clock reached that number, so a season that never revisited it never had it "planned". Read
 * before the "clock" step sends the chapter back to 1, because after that every chapter is "other than the clock's".
 * Its failure is logged and the group stays kept.
 */
export async function keepSeasonKeyPlan() {
    const keptChapter = getClock().chapter;
    try {
        const dropped = await keepOnlyKeyPlanChapter(keptChapter);
        if (dropped) log(`Season reset: the Key Remnant plan is kept for chapter ${keptChapter} only (${dropped} other row(s) dropped).`);
    } catch (err) {
        error(`Season reset: could not trim the kept Key Remnant plan to chapter ${keptChapter}`, err);
    }
}

registerSeasonState({ group: "keyPlan", clear: clearSeasonKeyPlan, keep: keepSeasonKeyPlan });

/**
 * THE CASE'S KEY COUNT OUTLIVES THE CLOSE (E09 C6, 08.10.2026; audit S05-17). The opening
 * roll decides how many Key Remnants a case gets - five on Hope, four on Despair, three on a
 * critical (`MURDER_OPENING`) - and the number lived in the incident state alone, which the
 * close wipes (murder-rules.mjs `closeIncident`). The checklist the close shows said "3 Key
 * Remnants still to place", and the planner, opened after the close as it usually is, had no
 * limit any more and let the GM plan five. The close keeps the number here, a row of the Key
 * Remnant plan's store beside the chapter's slots, `${chapter}:case` - a GM store, on GM
 * browsers only, and written by the GM who closes. The slot readers do not take it
 * (`chapterRows` reads integer slots; `plannedChapters`, until E09 C7, skipped it), and a
 * season reset takes it whether it keeps the plan or not (`keepOnlyKeyPlanChapter`, since
 * E09 fix r1-G3). Kept under the chapter the incident opened in since that fix
 * (murder-rules.mjs `closeIncident` reads the state's `chapter`): the clock's at the close
 * until then, so a case closed once the clock had moved on was kept under the next chapter.
 *
 * @param {number} chapter  The chapter the case was opened in (an incident opened before E09 fix r1-G3: the clock's at its close).
 * @param {number} keys     The incident's `keyRemnants`.
 * @returns {Promise<boolean>} Whether a row was written.
 */
export async function recordCaseKeys(chapter, keys) {
    if (!game.user.isGM || !Number.isFinite(Number(chapter)) || !Number.isFinite(keys)) return false;
    await keyPlanStore.patch(caseKey(Number(chapter)), { keys });
    return true;
}

/**
 * How many Key Remnants a chapter's case has (E09 C6): the close's row (`recordCaseKeys`), or
 * while an incident runs and before its close the incident's own count, or null - no case yet,
 * "plan freely". The row first: once a case is closed its count is the one its opening roll
 * gave, and the incident state is empty, or a later incident's of the same chapter (a
 * betrayal's), whose own close writes the row again. The running incident's count is the
 * chapter's it opened in alone since E09 fix r1-G3 (the state's `chapter`, murder-rules.mjs
 * `freshIncidentState`): until then a clock moved on while it ran handed the next chapter
 * the case's count - its planner's limit and its trial's bar. An incident opened before that
 * fix names no chapter and counts for the one asked, as before.
 *
 * @param {number} [chapter]  The clock's chapter by default.
 * @returns {number|null}
 */
export function caseKeyCount(chapter = getClock().chapter) {
    const kept = game.user?.isGM ? keyPlanStore.get(caseKey(chapter))?.keys : null;
    if (Number.isFinite(kept)) return kept;
    const live = murderState();
    if (!Number.isFinite(live?.keyRemnants)) return null;
    const own = live.chapter === undefined || live.chapter === null || Number(live.chapter) === Number(chapter);
    return own ? live.keyRemnants : null;
}

/**
 * How many of a chapter's case's Key Remnants are not on the map yet (E11 fix r1-G4; audit S13-14): the
 * case's count (`caseKeyCount`) less the chapter's Key Remnants standing on any scene, the plan's and any
 * placed off it, an unstamped one read as this chapter's as `keyPlanStatus` reads it - or 0 with no case.
 * What the GM panel's next line asks for after a body is announced (gm-panel.mjs `nextStep`).
 * This season's only (E11 fix r2-H2; round 2's cor COR2-2, sec S2): a reset that leaves the Remnants
 * standing sends the clock back to chapter 1, and last season's chapter-1 Key Remnants were counted
 * as placed, so the new chapter 1's line asked for fewer Keys than stood on no map, or for none
 * (tier 2 "this season's chapter reads none of last season's Key Remnants nor its autopsy nor its silence";
 * scenario 65's K, through a real reset).
 */
export function keysToPlace(chapter = getClock().chapter) {
    const count = caseKeyCount(chapter);
    if (!Number.isFinite(count)) return 0;
    const placed = placedKeyRemnants().filter(r => Number(r.data?.chapter ?? chapter) === Number(chapter) && sameSeason(r.data)).length;
    return Math.max(0, count - placed);
}

/** Every Key Remnant currently on the map, across every scene. */
export function placedKeyRemnants() {
    const out = [];
    for (const scene of game.scenes) {
        for (const token of remnantsOn(scene)) {
            const data = remnantData(token);
            if (data?.type !== "key") continue;
            out.push({ token, data, scene });
        }
    }
    return out;
}

/**
 * Who has copied which Key Remnant.
 *
 * Read off the ledger rather than off what the players can see: a Key bullet
 * arrives identified, but a GM who issued one by hand as "unidentified" would
 * otherwise vanish from this count - and this count is what decides whether the
 * trial is solvable.
 *
 * THE LIVING, FOR THE GMS (E09 fix r1-G3, 08.10.2026; the round-1 goal review's S05-16,
 * decision Q2 (a)): what reached the trial, as the fee counts it (`keyFeeOf`) and "Who has
 * what" lists it (`evidenceByStudent`). Every student was walked until then, so the find of
 * a student dead for the GMs was "found" through `keyPlanStatus` - on the Key tab (its
 * "Found by", its summary, the thin-case warning), on the GM's line of a body's discovery
 * (events.mjs) and in the panel's "start the trial" (gm-panel.mjs) - while the fee charged for it.
 */
function findersByRemnant() {
    const map = new Map();
    for (const actor of livingStudentsForGm()) {
        for (const item of bulletsOf(actor)) {
            const secret = secretOf(item.uuid);
            if (secret.realType !== "key" || !secret.remnantId) continue;
            if (!map.has(secret.remnantId)) map.set(secret.remnantId, new Set());
            map.get(secret.remnantId).add(actor.name);
        }
    }
    return map;
}

/**
 * The plan, scored against reality.
 *
 * `found` counts the plan's own rows, because that is what the planner's table
 * is about. `foundAny` adds the Key Remnants of this chapter that somebody found
 * and the plan never knew about - see below.
 *
 * @returns {{entries: Array, placed: number, found: number, offPlan: Array,
 *   foundAny: number, missing: number}}
 */
export function keyPlanStatus() {
    const plan = keyPlan();
    const finders = findersByRemnant();
    const placedKeys = placedKeyRemnants();
    const onMap = new Set(placedKeys.map(r => r.token.id));

    /* A ROW'S TRACE STANDS, RETYPED (E09 C13, 08.10.2026; audit S05-20). A planned Key Remnant a
       GM made another kind on the Traces tab is not one of `placedKeys`, and the planner said of it
       what it says of a deleted one, "gone from the map", with the trace standing in its room.
       `retyped` tells the two apart; neither counts as placed. */
    const standing = id => [...game.scenes].some(scene => remnantsOn(scene).some(token => token.id === id));
    const revealedNow = new Set(keyRevealRecord(plan.chapter).revealed);
    const entries = plan.entries.map((entry, slot) => {
        const placed = Boolean(entry.tokenId && onMap.has(entry.tokenId));
        const retyped = Boolean(entry.tokenId && !placed && standing(entry.tokenId));
        const who = entry.tokenId ? Array.from(finders.get(entry.tokenId) ?? []) : [];
        // Revealed by Monokuma (E70 C9) is found: a slot with no trace has no copy that names it, and its row says so.
        const revealed = revealedNow.has(String(slot));
        return { ...entry, slot, placed, retyped, finders: who, found: who.length > 0 || revealed, revealed };
    });

    /*
     * A KEY REMNANT OFF THE PLAN IS STILL A KEY REMNANT (F18, Dawid 17.09).
     *
     * "No slot" is the only option once five rows are filled, and it is also what
     * a GM picks when a clue occurs to them mid-investigation. Such a trace is a
     * real Key clue that the cast can find and argue from - and the count that
     * bills Despair for an investigation nobody finished could not see it, so a
     * table that found six Key Remnants, one of them off the plan, was billed as
     * though five had reached the trial.
     *
     * This chapter's only: `deathRecord`-style dating, the same rule the body
     * discovery uses, so last chapter's leftovers cannot pay for this one. And
     * this season's (E11 fix r2-H2; cor COR2-2): a reset that leaves the Remnants
     * and the Truth Bullets starts again at chapter 1, and last season's chapter-1
     * Key Remnant with a finder was counted here as found this chapter.
     */
    const planned = new Set(plan.entries.map(e => e.tokenId).filter(Boolean));
    const chapter = getClock().chapter;
    const offPlan = placedKeys
        .filter(r => !planned.has(r.token.id)
            && (r.data?.chapter ?? chapter) === chapter && sameSeason(r.data)
            && (finders.get(r.token.id)?.size ?? 0) > 0)
        .map(r => ({
            tokenId: r.token.id,
            name: r.data?.public?.name ?? "",
            finders: Array.from(finders.get(r.token.id) ?? [])
        }));

    const found = entries.filter(e => e.found).length;
    return {
        entries,
        placed: entries.filter(e => e.placed).length,
        found,
        offPlan,
        foundAny: found + offPlan.length,
        missing: entries.filter(e => !e.found).length
    };
}

/**
 * THE KEY REMNANTS NOBODY FOUND, FOR MONOKUMA'S REVEAL (E70 C9, 28.10.2026; S18-71, amend 4 (h)): this chapter's plan
 * slots that no living student holds a copy of and the Reveal has not shown (`keyPlanStatus`'s `found`) - a slot with a
 * trace standing on the map, or one the GM wrote a name or a text for and never placed (or whose trace was wiped) - and
 * this chapter's Key Remnants off the plan with no living finder. A slot with nothing written and no trace is no Key
 * Remnant and is not listed. Each row: `id` (the slot's number, or the trace's `sceneId.tokenId` off the plan), `slot`,
 * the name and the text the players will read (the trace's own words once a GM described it, else the slot's), the
 * analysis, and the trace's `sceneId`/`tokenId` with `hasTrace`. On a GM's browser; none elsewhere.
 */
export function missingKeyRows() {
    if (!game.user?.isGM) return [];
    const status = keyPlanStatus();
    const placed = new Map(placedKeyRemnants().map(r => [r.token.id, r]));
    // A name nobody wrote is empty (remnants.mjs `defaultPublic`, `publicOf`; E51 C5), in every language.
    const said = (pub, field) => (pub?.[field] ? String(pub[field]) : "");
    const rows = [];
    for (const entry of status.entries) {
        if (entry.found) continue;
        const trace = entry.placed ? placed.get(entry.tokenId) : null;
        if (!trace && !entry.name && !entry.text) continue;
        const pub = trace?.data?.public ?? null;
        rows.push({
            id: String(entry.slot), slot: entry.slot,
            name: said(pub, "name") || entry.name || "", text: said(pub, "playerText") || entry.text || "",
            analysis: said(pub, "analyzedText") || entry.analysis || "",
            sceneId: trace ? trace.scene.id : null, tokenId: trace ? trace.token.id : null, hasTrace: Boolean(trace)
        });
    }
    const planned = new Set(status.entries.map(e => e.tokenId).filter(Boolean));
    const finders = findersByRemnant();
    const chapter = getClock().chapter;
    const revealed = new Set(keyRevealRecord(chapter).revealed);
    for (const r of placed.values()) {
        const id = `${r.scene.id}.${r.token.id}`;
        if (planned.has(r.token.id) || revealed.has(id) || (finders.get(r.token.id)?.size ?? 0) > 0) continue;
        if ((r.data?.chapter ?? chapter) !== chapter || !sameSeason(r.data)) continue;
        const pub = r.data?.public ?? null;
        rows.push({ id, slot: null, name: said(pub, "name"), text: said(pub, "playerText"), analysis: said(pub, "analyzedText"),
            sceneId: r.scene.id, tokenId: r.token.id, hasTrace: true });
    }
    return rows;
}

/**
 * THE KEY FEE, ONE RULE (E09 C7, 08.10.2026; audit S05-16, S05-36; decision D14, option 1).
 *
 * What a chapter's investigation owes: the bar, the Key Remnants of the chapter that reached
 * the trial, and how many short of the bar that is. Until C7 the charge counted through the
 * planner (`keyPlanStatus`): the bar was always `KEY_REMNANTS.unfoundBar`, four, though a
 * critical opening gives a case three (`MURDER_OPENING`), so a table that found all three
 * paid for a fourth; a dead student's find counted, though "Who has what" (`evidenceByStudent`)
 * lists only the living; and every find was read off the documents.
 *
 *   bar    min(`unfoundBar`, the case's own count - `caseKeyCount`, which outlives the close
 *          since E09 C6); `unfoundBar` where the chapter has no case.
 *   found  the chapter's distinct Key Remnants that a living student holds a copy of, living
 *          for the GMs (`livingStudentsForGm`, decision Q2 (a): what reached the trial, as
 *          "Who has what" counts). A copy is a Key by its answer key (`secretOf`: the real
 *          type and the trace), and the chapter's by its trace's row (`remnantStore`, an
 *          unstamped row is the clock's chapter, as the planner's off-plan count reads it) or,
 *          where the trace is gone - wiped, or deleted by a GM after it was found - by the
 *          chapter its answer key names (`chapter`, written with it: truth-bullets.mjs
 *          `createTruthBullet`, `foundIn`). Until E09 fix r1-G3 (the round-1 reviews' F2)
 *          that was the item's own stamp, a flag its holder writes and no audit judges:
 *          rewritten to the clock's chapter, or removed - an unstamped copy read as the
 *          clock's - it made an earlier chapter's Key one found in this chapter. A copy
 *          whose answer key names no chapter, made before that fix, is found in none once
 *          its trace is gone. A trace's row of another season finds nothing in this one
 *          (`sameSeason`; E11 fix r2-H2, round 2's sec S2): a reset that leaves the Remnants
 *          and the Truth Bullets starts again at chapter 1, and last season's chapter-1 Key
 *          copies were counted as found in it. The answer key itself names no season, so
 *          after a reset that wipes the Remnants and keeps the Truth Bullets a copy is still
 *          read by its chapter alone (read in the code, not closed here).
 *   held   copies the GMs hold whose answer key this browser lacks: the count would come out
 *          short, so the charge holds (E04, `bulletsWithoutAnswer`'s rule on the GMs' items).
 *
 * THE ITEMS AS THE GMS HOLD THEM: one wait for every student's queued writes to be judged
 * (sheet-audit.mjs `judgedFor`), then each student's items read in one synchronous pass
 * (`itemsHeldNow`), so a Key copy a player's write made, which the GMs do not hold, counts
 * nothing and holds nothing while its judgement is on its way. The wait holds up nothing that
 * holds it up: the charge starts from a phase change (clock.mjs `reconcilePhase`), and no
 * judgement waits for one. The marks are the primary GM's, and since E09 fix r1-G3 the
 * charge is made there whichever GM moved the phase (`askToChargeForUnfoundKeys`); asked on
 * another GM - a console's call - `itemsHeldNow` reads the documents, as every road through
 * it does there.
 *
 * @param {number} [chapter]  The clock's chapter by default.
 * @returns {Promise<{chapter: number, bar: number, found: number, short: number, held: number}|null>}
 */
export async function keyFeeOf(chapter = getClock().chapter) {
    if (!game.user.isGM) return null;
    const now = Number(chapter);
    const students = studentActors();
    const { judgedFor, itemsHeldNow } = await import("./sheet-audit.mjs");
    await judgedFor(...students.map(actor => actor.id));
    const living = new Set(livingStudentsForGm().map(actor => actor.id));
    const found = new Set();
    let held = 0;
    for (const actor of students) {
        for (const item of itemsHeldNow(actor)) {
            if (!isTruthBullet(item)) continue;
            const secret = secretOf(actor.items.get(item.id)?.uuid);
            if (!secret.realType) {
                held++;
                continue;
            }
            if (secret.realType !== "key" || !secret.remnantId || !living.has(actor.id)) continue;
            const trace = remnantStore.get(`${secret.sceneId}.${secret.remnantId}`);
            const foundIn = trace ? (sameSeason(trace) ? trace.chapter ?? now : null) : secret.chapter ?? null;
            if (foundIn !== null && Number(foundIn) === now) found.add(secret.remnantId);
        }
    }
    const count = caseKeyCount(now);
    const bar = Math.min(KEY_REMNANTS.unfoundBar, Number.isFinite(count) ? count : KEY_REMNANTS.unfoundBar);
    return { chapter: now, bar, found: found.size, short: Math.max(0, bar - found.size), held };
}

/**
 * G-32: what the investigation failed to turn up, paid for in Despair.
 *
 * Guide: every Key Remnant below four that nobody found is worth 3 Despair to
 * Monokuma - below the case's own count where the opening gave fewer than four
 * (`keyFeeOf`, E09 C7). `found` is the bar rather than `placed` - a clue nobody
 * found did its job exactly as badly as one that was never put out, and the guide
 * is counting what reached the trial.
 *
 * WHEN, AND ONLY ONCE (trap 117). "Fewer than four were found" is not true of
 * anything until the investigation is over, so this is charged as the Class
 * Trial opens. It is stamped with the chapter in the same record the trial's
 * own progress lives in, because `startClassTrial` is a button and a button
 * gets pressed twice - a GM correcting a misclick would otherwise pay Monokuma
 * a second time.
 *
 * PER MONOKUMA, NOT SPLIT (trap 116). The reasoning is on `KEY_REMNANTS` in
 * config.mjs, and so is the consequence: four Monokumas and a completely failed
 * investigation is +12 each.
 *
 * Whispered, not announced. The size of the shortfall is a statement about how
 * much the table missed, and telling them at the top of the trial would hand
 * them a number they were supposed to earn by arguing.
 *
 * ON THE PRIMARY GM since E09 fix r1-G3: a trial's opening asks it there
 * (`askToChargeForUnfoundKeys`, below), so another GM runs this only from a console.
 *
 * @returns {Promise<object|null>} what was paid, or null when nothing was.
 */
export async function chargeForUnfoundKeys() {
    if (!game.user.isGM) return null;

    const { trialProgress, setTrialProgress } = await import("./vote.mjs");
    if (trialProgress().keysCharged) return null;

    /* THE CASE HAS TO STILL BE THIS CHAPTER'S, OR THERE IS NOTHING HONEST TO CHARGE.
       A charge asked for after the chapter moved would find none of the old case's Keys in
       the new chapter, conclude the whole bar was missed, and bill the maximum for a case
       nobody can look at any more - and stamp `keysCharged`, so the honest charge could
       never be asked again. Run against the real thing, the first guard (`keyPlan().chapter`
       against the clock, which agree by construction) billed 12 Despair to two pools for a
       case that had just been closed.

       THE CLOSED CASES, NOT THE PLAN (E09 C7, audit S05-16). From E05 C5 until C7 the guard
       read the chapters the planner's store held rows for: the clock's chapter without rows,
       while another had some, was too late. But any Save of the planner writes a row (of
       every slot, until E09 C3), so a chapter-2 trial after a chapter-1 plan charged nothing
       without a Save and charged after one. Too late is now what the case says: the newest
       chapter a case was closed for (`recordCaseKeys`, E09 C6; the chapter it opened in
       since E09 fix r1-G3, whatever the clock read at its close) is earlier than the clock's,
       and the clock's chapter has no case of its own, closed or running (`caseKeyCount`).
       A world where no case has been closed is charged against the bar, as it always was. */
    const now = Number(getClock().chapter);
    const [was] = closedCaseChapters();
    if (was !== undefined && was < now && caseKeyCount(now) === null) {
        await whisperToGms(`<p>${game.i18n.format("DRPG.Investigation.chargeTooLate", { now, was })}</p>`);
        return null;
    }

    /* NOT WHILE AN ANSWER KEY IS MISSING HERE (E04, 1.2.63). The count below reads
       each bullet's answer key; on a browser that lacks one, a Key somebody found
       reads as nothing, the count comes out short, the bill comes out high - and the
       stamp below makes it final. So it holds, says why, and stamps nothing: once
       the case is restored the charge can be asked again. Counted over the bullets
       the GMs hold since E09 C7 (`keyFeeOf`), so a bullet a player's write made, with
       no answer key anywhere, does not hold it. */
    const fee = await keyFeeOf(now);
    if (fee.held) {
        await whisperToGms({ tone: "warning", body: `<p>${plural("DRPG.Case.chargeHeld", { n: fee.held })}</p>` });
        return null;
    }
    const short = fee.short;

    // Stamped even at zero. "Nothing was owed" and "this has not been asked
    // yet" have to stay different states, or a second press would re-ask a
    // question whose answer has since changed - a Key Remnant found during the
    // trial itself would suddenly owe Despair backwards.
    await setTrialProgress({ keysCharged: true });
    const { adjustDespair, monokumas } = await import("./despair.mjs");
    /* THE COUNT MONOKUMA'S REVEAL READS (E70 C9; amend 4 (h), TR28 = 1): how many Key Remnants this fee charged for,
       written with the fee - before any pool moves, so a payment that throws half way still leaves the count it was
       for - and never counted again: a Key placed or found after the charge changes what the trial holds, not what
       was paid. 0 where no Monokuma holds a pool (nobody was charged). Read by trial-modes.mjs `revealLeft`. */
    const pools = monokumas();
    await keyPlanStore.patch(revealKey(now), { paid: pools.length ? short : 0, revealed: [] });
    if (!short) return null;

    const amount = short * KEY_REMNANTS.unfoundDespair;
    const paid = [];
    for (const user of pools) {
        await adjustDespair(user.id, amount);
        paid.push(user.name);
    }

    if (paid.length) {
        // WHAT THEY FOUND, not only what they missed. The line read "4 Key Remnants
        // short of four were never found", which is a sentence a GM has to decode; the
        // number they are actually being told about is how much of the case reached the
        // trial. `short` still drives the plural, because it is what the Despair is for.
        await whisperToGms(`<p>${plural("DRPG.Investigation.unfoundKeys", {
            n: short, found: fee.found, despair: amount, bar: fee.bar,
            who: foundry.utils.escapeHTML(paid.join(", "))
        })}</p>`);
    }
    log(`G-32: ${short} Key Remnant(s) unfound of ${fee.bar} - ${amount} Despair to each of ${paid.length} pool(s).`);
    return { short, amount, pools: paid };
}

/**
 * THE KEY FEE, CHARGED ON THE PRIMARY GM (E09 fix r1-G3, 08.10.2026; the round-1 goal review's
 * G3a). A trial opens through `setClock` on whichever GM moved the phase (clock.mjs
 * `reconcilePhase`), and the charge ran there until this fix - while `keyFeeOf` reads the
 * GMs' marks on the primary alone (sheet-audit.mjs `itemsHeldNow`) and the documents on any
 * other GM. Measured in scenario 62's phase P (08.10.2026): beside two finds of a case of three,
 * a Key copy the GMs' mark does not hold, and gm2 opens the trial - before this fix the pools
 * moved by 0 in each of three runs, because gm2 counted that copy as a bullet with no answer
 * key and held the charge (its `keyFeeOf` held 1, the primary's 0); with it, by 3. Here when
 * this is the primary, asked of it otherwise (`keys.charge`, gm-bridge.mjs) - the shape
 * `askToDecideWrite` gives a flagged write's decision. Answers what was paid, or null.
 */
export async function askToChargeForUnfoundKeys() {
    const res = await bridgeRequest("keys.charge", {}, { settle: "reply", onPrimary: true, local: () => chargeForUnfoundKeys() });
    return res.ok ? res.value ?? null : null;
}

/**
 * Apply the Key Remnant planner's rows the GM changed, exactly as `openKeyPlanner()`
 * used to on its own Save - now called from the Investigation Dashboard's
 * single Save instead of a dialog of its own. See the "Key Remnants" tab in
 * `openInvestigationDashboard`.
 *
 * `rows` holds only the changed fields of the changed rows (`readDashboardForm`), each with
 * what it was drawn from; a field another GM changed since is refused (`writable`), and the
 * slots nobody touched are holes `setKeyPlan` leaves alone - so they take no scale either.
 *
 * NOTHING IS PLACED HERE (E09 C16, audit S05-28). A row with a room picked and no trace used to
 * mean "make this one" on Save, and nothing on screen said a Save would put a token on the map;
 * a row's Place button does that now, at once (`placeKeyRow`). A Save writes words and pointers.
 *
 * @returns {Promise<{entries: Array, refused: Array}>}
 */
export async function saveKeyPlan(plan, rows) {
    const placed = placedKeyRemnants();
    const entries = [];
    const refused = [];
    for (const row of rows) {
        const stored = plan.entries?.[row.slot] ?? {};
        const now = keyRowShows(stored, placed);
        const take = writable(row.fields, now, refused, keyRowLabel(row.slot));
        // NOTHING TO WRITE, NOTHING WRITTEN: a slot the GM did not touch, or one whose every
        // change was refused, stays a hole, and `setKeyPlan` neither fills its scale nor
        // creates the chapter's plan for it (E09 C3, S05-16's planner half).
        if (!Object.keys(take).length) continue;
        const [tokenId, sceneId] = ("token" in take ? take.token : now.token)?.split("|") ?? [];
        const entry = { scale: row.scale };
        for (const field of ["name", "text", "analysis", "note", "room"]) if (field in take) entry[field] = take[field];
        if ("token" in take) Object.assign(entry, { tokenId: tokenId || null, sceneId: sceneId || null });
        /* AN EDIT ON A PLACED ROW IS AN EDIT ON THE TRACE. The two public fields are the
           Remnant's, not the plan's - `setRemnantPublic` writes them to the ledger and
           pushes them down onto every Truth Bullet already copied from it, which is what
           the Traces tab has always done and what this tab never did. Only when there is
           something to say: a blank row must not wipe a name typed on the other tab.

           ONLY WHEN IT IS AN EDIT, EITHER (F6, 17.09). This runs after the Traces tab has
           been written, and the row still carried the plan's old name - so renaming a Key
           Remnant on the Traces tab lasted until the next line, and every later Save put
           the plan's version back onto the trace and every bullet copied from it. A field
           is pushed now only when the GM changed it on this tab (E09 C3: measured against
           what the tab drew, where F6 compared with the stored plan), or the row was
           pointed at a different trace, which takes the plan's words; and the stored plan
           then takes the trace's words for what was pushed. */
        const token = tokenId ? remnantById(sceneId, tokenId) : null;
        if (token) {
            const repointed = "token" in take;
            const words = {
                name: take.name ?? (repointed ? stored.name : ""),
                text: take.text ?? (repointed ? stored.text : ""),
                analysis: take.analysis ?? (repointed ? stored.analysis : "")
            };
            const patch = {};
            if (words.name) patch.name = words.name;
            if (words.text) patch.playerText = words.text;
            if (words.analysis) patch.analyzedText = words.analysis;
            if (Object.keys(patch).length) {
                await setRemnantPublic(token, patch);
                const said = remnantData(token)?.public ?? {};
                if (patch.name) entry.name = said.name || words.name;
                if (patch.playerText) entry.text = said.playerText || words.text;
                if (patch.analyzedText) entry.analysis = said.analyzedText || words.analysis;
            }
        }
        entries[row.slot] = entry;
    }

    await setKeyPlan({ chapter: plan.chapter, entries });
    return { entries, refused };
}

/**
 * What a Key Remnant row draws for a stored entry (E09 C3): the plan's words, the trace's own
 * reading where the plan holds none, and the trace it points at as the picker's value - "" when
 * there is none or it is gone. `caseKeyRows` draws from this and a Save reads the plan now
 * through it, so what was drawn and what is there now are compared in one shape.
 *
 * A PLACED ROW'S WORDS ARE THE TRACE'S (E09 fix r1-G4, 08.10.2026; the round-1 goal check's S05-26/G1).
 * A Save pushes a placed row's changed words onto the trace (`saveKeyPlan`), and the row drew and was
 * compared with the plan's: a reshape, a ruling or the Traces tab rewrote the trace and left the plan
 * as it was, so the row went on showing the plan's words, `writable` found them unmoved, and the GM's
 * edit was written over a trace the tab had never shown. Read off the trace now, a write the window
 * did not draw is refused and told like the Traces tab's (tier 2 "a placed Key row draws its trace's
 * words and refuses an edit over a write it never drew"). The analysis with them: it is pushed the
 * same way. A row whose trace is gone, or was placed before the trace kept public words, draws the
 * plan's.
 */
export function keyRowShows(entry, placed) {
    const here = entry.tokenId ? placed.find(r => r.token.id === entry.tokenId) ?? null : null;
    const pub = here?.data?.public ?? null;
    return {
        name: (pub ? pub.name : entry.name) ?? "",
        text: (pub ? pub.playerText : entry.text) ?? "",
        analysis: (pub ? pub.analyzedText : entry.analysis) ?? "",
        note: entry.note ?? "",
        token: here ? `${here.token.id}|${here.scene.id}` : "",
        room: entry.room ?? ""
    };
}

/** How a refusal names a Key Remnant row: the tab, and which planned clue. */
function keyRowLabel(slot) {
    return `${game.i18n.localize("DRPG.Investigation.tabKeyRemnants")} ${slot + 1}`;
}

/**
 * The part of a row's changes a Save may write (E09 C3, S05-26). `fields` holds only what the
 * GM changed, each as `{ value, drawn }` - what the field holds and what the window drew it
 * from (`readDashboardForm`); `now` is the same row read off the ledger at the Save. A field the
 * ledger still holds as drawn is the GM's to write. One the ledger has moved since - another
 * GM's Save merged in, a ruling - is refused and listed in `refused`, unless it now says what
 * the GM typed anyway. A field `now` does not describe (the Key tab's room picker, an input and
 * not a stored value) is taken as it is.
 */
export function writable(fields, now, refused, row) {
    const take = {};
    for (const [field, { value, drawn }] of Object.entries(fields)) {
        if (!(field in now)) take[field] = value;
        else if (same(now[field], value)) continue;
        else if (same(now[field], drawn)) take[field] = value;
        else refused.push({ row, field, value });
    }
    return take;
}

/**
 * Two field values the same as the form holds them. A textarea drops a leading line break and
 * gives back `\n` for every line ending, and the text fields are saved trimmed, so text is
 * compared past both; anything else exactly.
 */
export function same(a, b) {
    const plain = v => typeof v === "string" ? v.replace(/\r\n?/g, "\n").trim() : v;
    return plain(a) === plain(b);
}

/**
 * A random point actually inside the region.
 *
 * Not the centre. Five clues stacked on five room centres reads as five pins on
 * a diagram rather than as things lying about a building - and if two of them
 * land in the same room they sit exactly on top of each other, which is the one
 * arrangement a GM cannot click apart.
 *
 * Rejection sampling against the region's own hit test, because a bounding box
 * is not the room: an L-shaped or circular region has plenty of box that is
 * outside it. Falls back to the centre after a bounded number of tries, so an
 * exotic shape delays the placement rather than losing it.
 */
export function randomPointIn(region, scene) {
    const bounds = region.object?.bounds ?? region.bounds;
    // That scene's grid, not the canvas's: the planner plants clues on the scene
    // the plan names, which is very often not the one the GM is looking at, and
    // a 200px map measured with a 100px canvas insets the token by half a square
    // and centres it on the wrong point.
    const size = scene?.grid?.size ?? canvas?.grid?.size ?? 100;

    if (!bounds || !Number.isFinite(bounds.x) || !Number.isFinite(bounds.width)) {
        return {
            x: Math.round((scene?.width ?? 1000) / 2),
            y: Math.round((scene?.height ?? 1000) / 2)
        };
    }

    const centre = {
        x: Math.round(bounds.x + bounds.width / 2 - size / 2),
        y: Math.round(bounds.y + bounds.height / 2 - size / 2)
    };

    // Keep a full token clear of the edges, so a 1×1 Remnant does not hang out
    // of the room it belongs to.
    const inset = size;
    const spanX = bounds.width - inset * 2;
    const spanY = bounds.height - inset * 2;
    if (spanX <= 0 || spanY <= 0) return centre;

    // The same hit test `roomAt` uses in movement.mjs, and the same two traps.
    // `RegionDocument#testPoint` wants an ElevatedPoint and rejects a point with
    // no elevation outright, and `false` is not nullish - so the old `?? true`
    // was never reached and all 24 candidates below were discarded every time.
    // The result was that this function always returned `centre`, which is the
    // one arrangement it exists to avoid: two clues in one room landing exactly
    // on top of each other, unclickable.
    //
    // The region's own floor is used as the elevation, so a room the GM raised
    // off the ground still accepts points inside it. `bottom` defaults to
    // -Infinity, which is not finite, hence the 0.
    const bottom = region.elevation?.bottom;
    const elevation = Number.isFinite(bottom) ? bottom : 0;
    const canTest = typeof region.testPoint === "function";
    const test = point => !canTest   // cannot ask - the bounding box is the best we have
        || region.testPoint({ ...point, elevation });

    for (let attempt = 0; attempt < 24; attempt++) {
        const cx = bounds.x + inset + Math.random() * spanX;
        const cy = bounds.y + inset + Math.random() * spanY;
        if (!test({ x: cx, y: cy })) continue;
        // Token x/y is the top-left corner; the hit test wants the centre.
        return { x: Math.round(cx - size / 2), y: Math.round(cy - size / 2) };
    }

    return centre;
}

/**
 * Put one planned clue on the map.
 *
 * Dropped at a random spot in the named region rather than on a character,
 * because a Key Remnant is the GM's own construction - nobody left it, so
 * `dropRemnant`'s "where is this actor standing" has no answer to give.
 * `REMNANT_TYPES.key` already carries `reinforced: true`, so `placeRemnant`
 * marks it unremovable without being told.
 *
 * @param {object} row
 * @param {Scene|null} [scene]  The scene the clue belongs on. Defaults to the
 *   one this GM is looking at, which is right for the dashboard's planner -
 *   its own room list was built from that scene. It is NOT right for the
 *   ruling card an Observe produces: that card is answered by a GM who is very
 *   often looking at a different map from the player who rolled, and placing
 *   the clue on the viewer's scene either warned "there is no region called X"
 *   or, worse, dropped it on a room of the same name somewhere else entirely
 *   (audit A6). The card carries the player's scene; `openKeyRemnantHere`
 *   passes it through.
 */
async function createKeyRemnant(row, scene) {
    const region = roomRegions(scene, row.createIn)[0];
    if (!region) {
        ui.notifications.warn(game.i18n.format("DRPG.Calls.noSuchRoom", { room: row.createIn }));
        return null;
    }

    const spot = randomPointIn(region, scene);

    const { placeRemnant } = await import("./remnants.mjs");
    const clock = getClock();

    return placeRemnant({
        x: spot.x,
        y: spot.y,
        sceneId: scene?.id ?? null,
        type: "key",
        visibility: row.visibility,
        faint: false,
        // A Key Remnant exists to make the case solvable, so it must survive
        // both the chapter-end sweep and the killer's clean-up.
        tiedToCrime: true,
        reinforced: true,
        note: row.note,
        // Who left it, as the GM says on the Observe card's window (E97 C1); a Key row's Place names nobody.
        sourceActor: row.author || null,
        sourceName: (row.author && game.actors.get(row.author)?.name) || "",
        /* NO `subject`, AND NO `action`. Both were carrying the wrong kind of thing.
           `subject` elsewhere says what a Search was ABOUT, and this put the difficulty label
           in it - so the trace card read "Subject: Standardowa", and worse, `createFind` in
           observe.mjs offers `data.subject` in the name box of a trace nobody has described (it
           offered the stored name, the neutral word, until E51 C5 - this note was written ahead
           of it), so a GM observing a planned clue would be offered "Standardowa" as its name and
           be one press away from keeping it. The
           difficulty lives in the plan, which is where the planner reads it from anyway.
           `action` was "manual", which is not one of `ACTIONS` at all - it is a project trigger
           - so `traceContextLine` printed the raw word and every planned clue read
           "Main Hall - manual". A clue nobody performed an action to leave simply has none. */
        room: row.createIn,
        chapter: clock.chapter,
        day: clock.day,
        timeOfDay: clock.timeOfDay
    }).then(async token => {
        /* AND THE WORDS GO WHERE A PLAYER CAN REACH THEM. This is the whole of the 10.09
           finding: the planner wrote its sentence to `note`, which is the GM's, and never to
           the public record - so a finder held a bullet called "Trace" with no description
           while the clue sat in the ledger. `createFind` in observe.mjs has always done this
           correctly and says why: two names for one object is a false contradiction the table
           has to spend the trial resolving. Same call, same fields, same reason. */
        if (token && (row.name || row.text || row.analysis)) {
            await setRemnantPublic(token, {
                ...(row.name ? { name: row.name } : {}),
                ...(row.text ? { playerText: row.text } : {}),
                // What the finder reads once they analyse it (21.09) - kept back
                // until then like any trace's, however self-evident the kind.
                ...(row.analysis ? { analyzedText: row.analysis } : {})
            });
        }
        return token;
    });
}

/**
 * "Create a Key Remnant here" - the button on an Observe ruling card.
 *
 * The guide's Observe has a branch nothing in the module could answer: a player
 * examines a point of interest they have named, the roll goes to the GM, and
 * the GM decides there IS something there. Deciding it was the whole of the
 * interaction; putting it on the map meant opening the dashboard, finding the
 * planner, picking the room off a list of twenty and typing the sentence again.
 *
 * So the card carries the room and the player's own words across, and this asks
 * only what the card cannot know: how hard it is to spot, and which of the
 * five planned clues it is - if it is one of them at all.
 *
 * ATTACHING IT TO THE PLAN IS THE POINT of offering the choice. A Key Remnant
 * created outside the plan is a real clue that the "have I placed my five"
 * count cannot see, which is exactly the miscount the planner exists to
 * prevent. The default is therefore the first row still waiting for a trace.
 *
 * @param {object} [options]
 * @param {string} [options.room]  Prefilled room name.
 * @param {string} [options.note]  Prefilled clue text - the player's request.
 */
export async function openKeyRemnantHere({ room = null, note = "", sceneId = null } = {}) {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const { allRooms } = await import("./movement.mjs");
    const plan = keyPlan();
    const onMap = new Set(placedKeyRemnants().map(r => r.token.id));

    // THE PLAYER'S SCENE, NOT THE VIEWER'S (audit A6). The ruling card carries
    // it; opened from anywhere else there is nothing to carry and the scene on
    // screen is the only answer there is.
    const scene = (sceneId ? game.scenes.get(sceneId) : null) ?? workingScene();

    const roomOptions = allRooms(scene).map(r =>
        `<option value="${esc(r)}"${r === room ? " selected" : ""}>${esc(r)}</option>`).join("");
    const visOptions = REMNANT_VISIBILITY.map(v =>
        `<option value="${v}"${v === "evident" ? " selected" : ""}>${
            esc(REMNANT_VISIBILITY_LABELS[v] ?? v)}</option>`).join("");

    const open = plan.entries
        .map((entry, i) => ({ entry, i }))
        .filter(({ entry }) => !entry.tokenId || !onMap.has(entry.tokenId));
    const slotOptions = open.map(({ entry, i }, n) =>
        `<option value="${i}"${n === 0 ? " selected" : ""}>${
            esc(SCALE_LABELS[entry.scale] ?? entry.scale)}${
            entry.name || entry.text || entry.note
                ? ` · ${esc(entry.name || entry.text || entry.note)}` : ""}</option>`).join("");

    /* THE PLAYER'S OWN SENTENCE ARRIVES AS THE PLAYER DESCRIPTION, NOT AS A GM NOTE.
       This dialog is opened from an Observe ruling card, which prefills it with what the player
       said they were examining - and until 1.2.42 that sentence went into the GM-private note
       and never reached them. Their words, in the field they will read back; the note beside it
       is for what the GM keeps. */
    const result = await drpgWindow({
        title: game.i18n.localize("DRPG.Investigation.createHereTitle"),
        classes: ["drpg-panel"],
        body: `<form>
            <p class="notes">${plural("DRPG.Investigation.createHereIntro", { n: plan.entries.length })}</p>
            <label>${game.i18n.localize("DRPG.Investigation.room")}
                <select name="room">${roomOptions}</select></label>
            <label>${game.i18n.localize("DRPG.Investigation.visibility")}
                <select name="vis">${visOptions}</select></label>
            <label>${game.i18n.localize("DRPG.Remnant.authorLabel")}
                <select name="author">${authorOptions(null, studentActors())}</select></label>
            <label>${game.i18n.localize("DRPG.Investigation.traceName")}
                <input type="text" name="keyname" value=""
                       placeholder="${esc(traceLabel(null))}" /></label>
            <label>${game.i18n.localize("DRPG.Investigation.traceText")}
                <input type="text" name="keytext" value="${esc(note)}"
                       placeholder="${esc(game.i18n.localize(
                           "DRPG.Investigation.notePlaceholder"))}" /></label>
            <label>${game.i18n.localize("DRPG.Investigation.traceAnalysis")}
                <input type="text" name="keyanalysis" value=""
                       placeholder="${esc(game.i18n.localize(
                           "DRPG.TruthBullet.analyzedTextPlaceholder"))}" /></label>
            <label>${game.i18n.localize("DRPG.Investigation.keyNoteLabel")}
                <input type="text" name="note" value=""
                       placeholder="${esc(game.i18n.localize(
                           "DRPG.Investigation.keyNotePlaceholder"))}" /></label>
            <label>${game.i18n.localize("DRPG.Investigation.whichSlot")}
                <select name="slot">
                    ${slotOptions}
                    <option value="">${game.i18n.format(
                        "DRPG.Investigation.noSlot", { n: KEY_REMNANTS.prepared })}</option>
                </select></label>
        </form>`,
        footer: {
            primary: {
                action: "ok", label: game.i18n.localize("DRPG.Investigation.createHere"),
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return {
                        room: f.room.value,
                        visibility: f.vis.value,
                        name: f.keyname?.value.trim() ?? "",
                        text: f.keytext?.value.trim() ?? "",
                        analysis: f.keyanalysis?.value.trim() ?? "",
                        note: f.note.value.trim(),
                        author: f.author?.value ?? "",
                        slot: f.slot.value === "" ? null : Number(f.slot.value)
                    };
                }
            },
            close: "cancel"
        },
        rejectClose: false
    });

    if (!result || result === "cancel" || !result.room) return null;

    return placeInSlot(plan, scene, result);
}

/**
 * Put a Key Remnant on the map in `result.room` and hang it on `result.slot` of `plan` (null:
 * on none) - the end of `openKeyRemnantHere` and of a Key row's Place button (`placeKeyRow`).
 * `result` holds the room, the visibility and the words; answers the token, or null.
 */
export async function placeInSlot(plan, scene, result) {
    const scale = result.slot === null
        ? "standard"
        : plan.entries[result.slot]?.scale ?? "standard";

    const token = await createKeyRemnant({
        createIn: result.room, visibility: result.visibility,
        name: result.name, text: result.text, analysis: result.analysis, note: result.note, scale, author: result.author ?? ""
    }, scene);
    if (!token) return null;

    if (result.slot !== null) {
        /* THE ONE SLOT, AND ONLY WHAT THIS WINDOW CHANGED IN IT (E05 C5). `plan` was read when
           this window opened, so the rest of it is what this GM saw then: written back, it would
           take back whatever another GM wrote since. A hole in `entries` is a slot `setKeyPlan`
           leaves alone, and `base` keeps the slot's own untouched fields out. */
        const entry = plan.entries[result.slot] ?? {};
        const entries = [];
        entries[result.slot] = { ...entry,
            name: result.name || entry.name,
            text: result.text || entry.text,
            analysis: result.analysis || entry.analysis || "",
            note: result.note || entry.note,
            tokenId: token.id, sceneId: token.parent?.id ?? scene?.id ?? null };
        await setKeyPlan({ chapter: plan.chapter, entries }, { base: plan });
    }

    ui.notifications.info(game.i18n.format("DRPG.Investigation.createdHere", { room: result.room }));
    return token;
}

/**
 * A KEY ROW'S PLACE BUTTON (E09 C16, 08.10.2026; audit S05-28). Asks what the row cannot say -
 * the room, and how hard the clue is to spot - in a small window of its own, and places the clue
 * then, in this row's slot, with the words typed on the row (read when the window closes, so a
 * redraw under it loses nothing). It replaced the row's "- create in -" select, which placed on
 * Save and said so nowhere on the row. A row another GM placed while the window was open is
 * refused and told: a second token would leave the first off the plan.
 *
 * @param {HTMLElement} root  The dashboard's element.
 * @param {number} slot       The plan row.
 * @returns {Promise<TokenDocument|null>}
 */
export async function placeKeyRow(root, slot) {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }
    const { allRooms } = await import("./movement.mjs");
    const scene = workingScene();
    const rooms = allRooms(scene);
    if (!rooms.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Investigation.noRooms"));
        return null;
    }
    const drawn = keyPlan().entries[slot] ?? {};
    /* THE PLANNED ROOM FIRST (13.11.2026): the row's picker as the GM left it, else the plan's; one the scene no longer
       has is said in one line, and the window starts on its first room, as before. */
    const typedRoom = root?.querySelector(`[name="${CSS.escape(`keyroom:${slot}`)}"]`)?.value ?? "";
    const planned = typedRoom || drawn.room || "";
    if (planned && !rooms.includes(planned)) ui.notifications.warn(game.i18n.format("DRPG.Investigation.plannedRoomGone", { room: planned }));
    const result = await drpgWindow({
        title: game.i18n.localize("DRPG.Investigation.placeTitle"),
        classes: ["drpg-panel", "drpg-window-keyplace"],
        body: `<form>
            <p class="notes">${esc(SCALE_LABELS[drawn.scale] ?? drawn.scale ?? "")}</p>
            <label>${game.i18n.localize("DRPG.Investigation.room")}
                <select name="room">${rooms.map(r => `<option value="${esc(r)}"${r === planned ? " selected" : ""}>${esc(r)}</option>`).join("")}</select></label>
            <label>${game.i18n.localize("DRPG.Investigation.visibility")}
                <select name="vis">${REMNANT_VISIBILITY.map(v => `<option value="${v}"${v === "evident" ? " selected" : ""}>${
                    esc(REMNANT_VISIBILITY_LABELS[v] ?? v)}</option>`).join("")}</select></label>
        </form>`,
        footer: {
            primary: {
                action: "ok", label: game.i18n.localize("DRPG.Investigation.place"),
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return { room: f.room.value, visibility: f.vis.value };
                }
            },
            close: "cancel"
        },
        rejectClose: false
    });
    if (!result || result === "cancel" || !result.room) return null;

    const plan = keyPlan();
    const pointed = plan.entries[slot]?.tokenId ?? null;
    if (pointed && placedKeyRemnants().some(r => r.token.id === pointed)) {
        ui.notifications.warn(game.i18n.localize("DRPG.Investigation.placedMeanwhile"));
        return null;
    }
    const typed = field => root?.querySelector(`[name="${CSS.escape(`${field}:${slot}`)}"]`)?.value.trim() ?? "";
    return placeInSlot(plan, scene, { ...result, slot,
        name: typed("keyname"), text: typed("keytext"), analysis: typed("keyanalysis"), note: typed("note") });
}
