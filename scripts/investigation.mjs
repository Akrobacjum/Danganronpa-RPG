/**
 * Danganronpa RPG - the GM's side of an Investigation.
 * ---------------------------------------------------------------------------
 * Guide, p. 28: "DM szykuje 5 poszlak przed morderstwem: Banalną, Standardową,
 * Standardową, Skomplikowaną, Desperacką. Ich ostateczna ilość jest zależna od
 * rzutów kością na otwarciu morderstwa, ale nigdy mniejsza, niż 3. Wszystkie 5
 * Key Remnants łącznie powinno zawężać krąg podejrzanych do 3-8 graczy."
 * (The suspect range has since been ruled 2-4: `KEY_REMNANTS.suspectRange`,
 * which is what the planner prints. The quotation stays as the source.)
 *
 * Two screens, and between them they answer the only two questions a GM has
 * during an Investigation:
 *
 *   the planner    what are my five clues, and have I actually put them on the
 *                  map - or am I one session in with three of them still in my
 *                  head?
 *   the dashboard  who has found what, how much of the case is reachable, and
 *                  is this trial about to fail because nobody found the
 *                  evidence that makes it work?
 *
 * The dashboard is the one place in this module that reads the answer key in
 * bulk, which is why it is GM-only in the strongest sense: it runs nowhere else
 * (see D6 - the ledger only exists on a GM's browser).
 */

import {
    MODULE_ID, KEY_REMNANTS, TRUTH_BULLET_TYPES, OBSERVE_DC, REMNANT_TYPES,
    REMNANT_VISIBILITY, REMNANT_VISIBILITY_LABELS, TIMES_OF_DAY, observeDc } from "./config.mjs";
import { SETTINGS, isEclipse, sameSeason } from "./settings.mjs";
import { getClock } from "./clock.mjs";
import {
    remnantsOn, remnantById, remnantData, setRemnantFlags, setRemnantPublic, markRemnantEdited,
    confirmClearFaint, shownBand, bandOptions, removeRemnant,
    traceContextLine, traceLabel, authorOptions
} from "./remnants.mjs";
import { bulletsOf, isTruthBullet, secretOf, truthBulletData } from "./truth-bullets.mjs";
import { studentActors } from "./monokuma.mjs";
import { livingStudentsForGm, sweepPlan, sweepTruthBullets } from "./chapter.mjs";
import {
    plural, wirePortraitPickers, whisperToGms, log, isPrimaryGm,
    workingScene, esc, placeRoomOptions, listOf, error } from "./utils.mjs";
import { kitTabs, wireKitTabs, emptyOption, drpgWindow, drpgConfirm, box, dataTable } from "./ui-kit.mjs";
import { WIDE } from "./ui-columns.mjs";
import { caseGraph, caseRows, caseNodeOf, caseModes, PLANNED_TYPES, setCaseNode, setCaseMeta, dropCaseNode, newCaseNodeId, CASE_SORTS, reachability, checkCase } from "./case-schema.mjs";
import { layoutCase } from "./case-layout.mjs";
import { caseMapHtml, wireCaseMap, glyphHtml, editRow, caseToolsHtml } from "./case-map.mjs";
import { alreadyOpen, keepLive, keepFresh, drawnOf, heldIn, isDirty, keepDrawn, RAISED } from "./live.mjs";
import { keyPlanStore, remnantStore, caseSchemaStore, blackenedStore, castStore, deathStore } from "./gm-stores.mjs";
import { murderState, blackenedIds, killerIds } from "./incident-store.mjs";
import { bridgeRequest } from "./bridge-guards.mjs";
import { roomRegions } from "./rooms.mjs";
// A leaf (season-exceptions.mjs alone): the registry of season state the reset walks (E42 C3).
import { registerSeasonState } from "./season-reset.mjs";

const ICON = "icons/svg/hazard.svg";

/** The five difficulty steps, named where the scale itself is defined. */
const SCALE_LABELS = KEY_REMNANTS.scaleLabels;

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
function placedKeyRemnants() {
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
async function saveKeyPlan(plan, rows) {
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
function keyRowShows(entry, placed) {
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
function writable(fields, now, refused, row) {
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
function same(a, b) {
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
 * Put a trace of any kind on the map, by hand (N-4, Dawid 21.09).
 *
 * THERE WAS NO WAY TO DO THIS AT ALL, which is the finding. Traces arrive from
 * actions (`dropRemnant`), from the Key planner's own per-row button, from the
 * Mastermind's Final Remnant and from the ruling card an Observe produces - and
 * every one of those roads places a KEY Remnant or a trace somebody's action
 * earned. A GM who wanted to put a Prep trace in the kitchen because that is what
 * happened in the fiction had to make a token by hand and flag it by hand.
 *
 * THE KEY PLANNER IS NOT THIS, and stays where it is. That screen is about the
 * five clues the chapter's case is built on: they are planned, counted against the
 * opening roll's limit, and reinforced so nothing can sweep them. This is the other
 * half - a trace the GM is simply stating exists.
 *
 * THE TWO FLAGS ARE ASKED RATHER THAN ASSUMED. A Key Remnant gets `tiedToCrime` and
 * `reinforced` implicitly because that is what a Key Remnant IS; a hand-placed trace
 * can be either, and the difference decides whether the chapter-end sweep takes it
 * and whether a killer can clean it up. Both default off, which is the ordinary
 * trace.
 *
 * Opened from the case dashboard, so the room list is the scene that dashboard was
 * built from - `workingScene`, the same answer `createKeyRemnant` uses.
 */
export async function openNewTrace({ room = null, sceneId = null, type = null, name = "", text = "", tied = "" } = {}) {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const { allRooms } = await import("./movement.mjs");
    const scene = (sceneId ? game.scenes.get(sceneId) : null) ?? workingScene();
    const rooms = allRooms(scene);
    if (!rooms.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Investigation.noRooms"));
        return null;
    }

    const roomOptions = rooms.map(r =>
        `<option value="${esc(r)}"${r === room ? " selected" : ""}>${esc(r)}</option>`).join("");
    /* EVERY TYPE THE MAP CAN HOLD, including the two with screens of their own.
       A GM repairing a case - a Key Remnant lost with its plan row, a Final Remnant
       that has to move - has nowhere else to say so, and refusing them here would
       send them back to editing token flags by hand, which is the thing this window
       exists to stop.

       EXCEPT A KIND OBSERVE HAS NO NUMBER FOR (review of stage D). An Autopsy
       Remnant is handed over from the GM panel (Issue Autopsy Truth Bullet, D2) and
       never found, so one placed here sat in the room behind a difficulty nothing
       rolls against. Asked of the Observe table rather than named, so a kind that
       gains a column appears and one that loses it goes. */
    const typeOptions = Object.entries(REMNANT_TYPES)
        .filter(([key]) => findableKind(key))
        .map(([key, def]) => `<option value="${key}"${key === (type && findableKind(type) ? type : "prep") ? " selected" : ""}>${
            esc(def.label ?? key)}</option>`).join("");
    const visOptions = REMNANT_VISIBILITY.map(v =>
        `<option value="${v}"${v === "evident" ? " selected" : ""}>${
            esc(REMNANT_VISIBILITY_LABELS[v] ?? v)}</option>`).join("");

    // The room's field is labelled "Room" (E09 C14, 08.10.2026; audit S05-35): it borrowed
    // `pickRoom`, the empty option of the Remnants tab's room select, and read "- create in -".
    const result = await drpgWindow({
        title: game.i18n.localize("DRPG.Investigation.newTraceTitle"),
        classes: ["drpg-panel", "drpg-window-newtrace"],
        body: `<form>
            <p class="notes">${game.i18n.localize("DRPG.Investigation.newTraceIntro")}</p>
            <label>${game.i18n.localize("DRPG.Investigation.room")}
                <select name="room">${roomOptions}</select></label>
            <label>${game.i18n.localize("DRPG.Investigation.traceType")}
                <select name="type">${typeOptions}</select></label>
            <label>${game.i18n.localize("DRPG.Remnant.authorLabel")}
                <select name="author">${authorOptions(null, studentActors())}</select></label>
            <label>${game.i18n.localize("DRPG.Investigation.difficulty")}
                <select name="vis">${visOptions}</select></label>
            <label>${game.i18n.localize("DRPG.Investigation.traceName")}
                <input type="text" name="tname" value="${esc(name ?? "")}" maxlength="60"
                       placeholder="${esc(traceLabel(null))}" /></label>
            <label>${game.i18n.localize("DRPG.Investigation.traceText")}
                <input type="text" name="ttext" value="${esc(text ?? "")}" maxlength="400"
                       placeholder="${esc(game.i18n.localize(
                           "DRPG.Investigation.notePlaceholder"))}" /></label>
            <label>${game.i18n.localize("DRPG.Investigation.traceAnalysis")}
                <input type="text" name="tanalysis" value="" maxlength="400"
                       placeholder="${esc(game.i18n.localize(
                           "DRPG.TruthBullet.analyzedTextPlaceholder"))}" /></label>
            <label>${game.i18n.localize("DRPG.Investigation.keyNoteLabel")}
                <input type="text" name="note" value=""
                       placeholder="${esc(game.i18n.localize(
                           "DRPG.Investigation.keyNotePlaceholder"))}" /></label>
            <label>${game.i18n.localize("DRPG.Investigation.newTraceTied")}
                <select name="tied">${Object.entries(TIE_OPTIONS).map(([value, label]) =>
                    `<option value="${value}"${value === tied ? " selected" : ""}>${esc(game.i18n.localize(label))}</option>`).join("")}</select></label>
            <label class="drpg-checkbox"><input type="checkbox" name="reinforced" />
                ${game.i18n.localize("DRPG.Investigation.newTraceReinforced")}</label>
            <p class="notes">${game.i18n.localize("DRPG.Investigation.newTraceNote")}</p>
        </form>`,
        footer: {
            primary: {
                action: "ok", label: game.i18n.localize("DRPG.Investigation.createHere"),
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return {
                        room: f.room.value,
                        type: f.type.value,
                        visibility: f.vis.value,
                        name: f.tname.value.trim(),
                        text: f.ttext.value.trim(),
                        analysis: f.tanalysis.value.trim(),
                        note: f.note.value.trim(),
                        tied: f.tied.value,
                        reinforced: f.reinforced.checked,
                        author: f.author?.value ?? ""
                    };
                }
            },
            close: "cancel"
        },
        rejectClose: false
    });

    if (!result || result === "cancel" || !result.room) return null;
    if (!REMNANT_TYPES[result.type]) {
        ui.notifications.warn(game.i18n.localize("DRPG.Investigation.newTraceBadType"));
        return null;
    }
    // A form is a claim too: the list above is not the only road to a kind.
    if (observeDc(result.visibility, result.type) === null) {
        ui.notifications.warn(game.i18n.localize("DRPG.Investigation.newTraceUnfindable"));
        return null;
    }

    const region = roomRegions(scene, result.room)[0];
    if (!region) {
        ui.notifications.warn(game.i18n.format("DRPG.Calls.noSuchRoom", { room: result.room }));
        return null;
    }

    const spot = randomPointIn(region, scene);
    const { placeRemnant } = await import("./remnants.mjs");
    const clock = getClock();
    // Who left it, as the GM says (E97 C1; Q6: "- unknown -" is nobody, the default).
    const author = result.author ? game.actors.get(result.author) ?? null : null;
    const token = await placeRemnant({
        x: spot.x,
        y: spot.y,
        sceneId: scene?.id ?? null,
        type: result.type,
        visibility: result.visibility,
        faint: result.type === "faint",
        // The tie's three states, as the Traces tab's (E09 C4): an unticked box was `false`, a GM's
        // "not tied", for a trace the GM had said nothing about; "-" is `null`, which an incident
        // running or a victim's death decides.
        tiedToCrime: tieTaken(result.tied),
        // A Key Remnant is reinforced by its own definition whatever this says -
        // `placeRemnant` reads the type - so the box only ever ADDS the mark.
        reinforced: result.reinforced,
        // The GM's own line stays the GM's. `note` is the ledger's private field.
        note: result.note || "",
        // The stamp every other road puts on a trace, so the dashboard can sort
        // this one by chapter and `traceContextLine` has a room to print. No
        // `action`: nobody performed one, exactly as for a planned clue.
        room: result.room,
        sourceActor: author?.id ?? null,
        sourceName: author?.name ?? "",
        chapter: clock.chapter,
        day: clock.day,
        timeOfDay: clock.timeOfDay
    });

    if (!token) return null;

    /*
     * AND THE WORDS GO WHERE A PLAYER CAN REACH THEM.
     *
     * `placeRemnant` has no `name` and no `text` - it names every token the same
     * public word on purpose, because a token's name travels to every client, and
     * the meaning lives in the GM-side ledger. The player-facing pair is a separate
     * write, and `createKeyRemnant` and `createFind` both make it for the same
     * reason: a Truth Bullet called "Trace" with no description is a clue the
     * finder cannot use, and two names for one object is a false contradiction the
     * table then has to spend the trial resolving.
     */
    if (result.name || result.text || result.analysis) {
        await setRemnantPublic(token, {
            ...(result.name ? { name: result.name } : {}),
            ...(result.text ? { playerText: result.text } : {}),
            ...(result.analysis ? { analyzedText: result.analysis } : {})
        });
    }
    log(`Case panel: a ${result.type} trace placed by hand in ${result.room}.`);
    ui.notifications.info(game.i18n.format("DRPG.Investigation.newTraceDone", {
        room: result.room,
        type: REMNANT_TYPES[result.type]?.label ?? result.type
    }));
    return token;
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

/* ==========================================================================
 * THE DASHBOARD
 * ========================================================================== */

/** Stable form-field id for a trace - unique across every scene. */
function rowKey(sceneId, tokenId) {
    return `${sceneId}__${tokenId}`;
}

/** Every Remnant across every scene the GM can see, tied-to-crime first. */
function allTraces() {
    const out = [];
    for (const scene of game.scenes) {
        for (const token of remnantsOn(scene)) {
            const data = remnantData(token);
            if (data) out.push({ token, data, scene });
        }
    }
    return out.sort((a, b) => {
        // Tied first, by `=== true`: "not tied" and undecided sort alike (E09 C4's third state).
        const aTied = a.data.tiedToCrime === true, bTied = b.data.tiedToCrime === true;
        if (aTied !== bTied) return aTied ? -1 : 1;
        return (a.data.room ?? "").localeCompare(b.data.room ?? "");
    });
}

/**
 * Who has copied which trace - every type, not only Key. Same read as
 * `findersByRemnant`, minus its `realType === "key"` filter.
 */
export function findersByAnyRemnant() {
    const map = new Map();
    for (const actor of studentActors()) {
        for (const item of bulletsOf(actor)) {
            const secret = secretOf(item.uuid);
            if (!secret.remnantId) continue;
            if (!map.has(secret.remnantId)) map.set(secret.remnantId, new Set());
            map.get(secret.remnantId).add(actor.name);
        }
    }
    return map;
}

/** What each living student is holding, summarised: the students the Key fee counts the finds of (`keyFeeOf`). */
function evidenceByStudent() {
    return livingStudentsForGm()
        .map(actor => {
            const bullets = bulletsOf(actor).map(item => ({
                item,
                data: truthBulletData(item),
                real: secretOf(item.uuid).realType ?? "neutral"
            }));
            return {
                actor,
                total: bullets.length,
                keys: bullets.filter(b => b.real === "key").length,
                unidentified: bullets.filter(b => !b.data?.analyzed).length,
                types: bullets.reduce((acc, b) => {
                    acc[b.real] = (acc[b.real] ?? 0) + 1;
                    return acc;
                }, {})
            };
        });
}

/**
 * The Investigation at a glance - and, now, the one place a GM edits any of
 * it. One window, three tabs sharing a single Save, because the questions
 * they answer ("what are my clues", "have I placed them", "who has found
 * what") are one GM's one sitting, not three separate trips through the panel.
 *
 *   Traces        every Remnant on every scene - the old per-scene Remnant
 *                 Manager, widened to the whole world, plus the `public`
 *                 record a player will eventually see (see remnants.mjs's
 *                 "ONE RECORD, THREE VIEWS").
 *   Key Remnants  the planner, folded in, now showing how many the opening
 *                 roll actually allows this chapter.
 *
 * THE ENDGAME IS NOT HERE. This window used to carry a third tab holding the
 * Mastermind's identity and the Final Truth Remnant, which meant two screens
 * could write the same two records - and two screens that write one record are
 * two chances to write it differently. Both live on the Mastermind window now,
 * which is the one place the endgame is edited; traces typed `final` still
 * appear in the Traces table here like every other trace, because reading them
 * is not the same act as deciding them.
 *
 * Information only beyond that: an earlier version also handed each Monokuma
 * Despair for every Key Remnant nobody reached, which turned the GM's own
 * planning miss into a resource the GM side got to spend. A clue the players
 * never found is already its own consequence - the trial gets harder - and
 * the "this is getting thin" warning is what a GM actually needs from here.
 */

/**
 * The Truth Bullet sweep, asked for by a person (Z7).
 *
 * The twin of `confirmClearFaint` in remnants.mjs, and deliberately the same
 * shape: count first, say the number, take the answer, report what happened.
 * Two permanent clean-ups sitting next to each other in one row must not behave
 * differently - a GM who has pressed one has learnt how the other works.
 *
 * The count is the sweep's own answer (chapter.mjs `sweepPlan`, E09 C1), so the
 * confirm cannot promise a number the sweep will not deliver. It was the same
 * rule written again, over the documents, keeping a bullet by the Faint flag on
 * the item - which is false on every Faint bullet nobody has analysed, since
 * Faint is published there at analysis - so an unanalysed Faint, a Neutral and
 * a Final were offered as 2 and swept as 1 (S05-21).
 */
export async function confirmSweepBullets({ actors = null } = {}) {
    if (!game.user.isGM) return 0;

    // `actors`: the students to count and sweep, every one where unsaid (the suite's, `runDashboardButton`).
    const { remove, keep } = await sweepPlan({ actors });
    const doomed = remove.length;
    const kept = keep.length;

    if (!doomed) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.sweepNone"));
        return 0;
    }

    // What cannot be undone, named by its effect (E22 rules 4, 9): destructive, Cancel the default and first under Enter.
    const sure = await drpgConfirm({
        yes: { role: "destructive", label: game.i18n.localize("DRPG.Panel.sweepBullets") },
        no: "cancel",
        title: game.i18n.localize("DRPG.Panel.sweepBullets"),
        classes: ["drpg-panel"],
        body: `<div>
            <p>${plural("DRPG.Panel.sweepConfirm", { n: doomed })}</p>
            <p class="notes">${game.i18n.format("DRPG.Panel.sweepConfirmNote", { kept })}</p>
        </div>`,
        rejectClose: false
    });
    if (!sure) return 0;

    const { removed } = await sweepTruthBullets({ actors });
    ui.notifications.info(plural("DRPG.Panel.sweptBullets", { n: removed }));
    return removed;
}

    /** The list as the reader asked for it: filtered, then ordered. */
function readTracesAs(list, reading) {
        /*
         * THE FIRST READ SHOWS THE CHAPTER NOW RUNNING (E9).
         *
         * It used to open on every chapter at once, which by chapter three is a
         * few hundred rows of which a handful are about tonight. The GM then
         * sets the filter by hand, every time, to the one answer the module
         * already knows.
         *
         * Resolved HERE rather than at the declaration because it needs the
         * list: if this chapter has left no traces yet, the current chapter is
         * not among the select's options, and a filter pointing at an option
         * that does not exist would show an empty table with nothing selected.
         * So it falls back to every chapter, which is where it started.
         *
         * Once only. After this the field holds a string, and a GM who widens
         * it to every chapter keeps that for as long as the window is open.
         */
        if (reading.chapter === null) {
            const here = String(getClock().chapter);
            reading.chapter = list.some(({ data }) => String(data.chapter ?? "") === here)
                ? here : "";
        }

        const kept = list.filter(({ data }) =>
            (!reading.player || data.sourceActor === reading.player)
            && (!reading.room || (data.room ?? "") === reading.room)
            // Stamped on the trace when it was left, so this is the chapter it
            // BELONGS to rather than the chapter the GM happens to be in.
            && (!reading.chapter || String(data.chapter ?? "") === reading.chapter));

        if (reading.order !== "newest") return kept;

        // NEWEST FIRST, and "newest" is the fiction's clock rather than the
        // file's: chapter, then day, then time of day, because that is the
        // order the table lived them in. The ledger's own timestamp settles
        // two traces from the same time of day - which, during an incident,
        // is most of them.
        const when = data => [
            Number(data.chapter) || 0,
            Number(data.day) || 0,
            Math.max(0, TIMES_OF_DAY.indexOf(data.timeOfDay)),
            Number(data.updated) || 0
        ];
        return [...kept].sort((a, b) => {
            const left = when(a.data), right = when(b.data);
            for (let i = 0; i < left.length; i++) {
                if (left[i] !== right[i]) return right[i] - left[i];
            }
            return 0;
        });
}

/**
 * Who has what: one row per student, shown whichever tab is open. Exported for the suite, which
 * hands it a synthetic student: every input is the argument.
 *
 * READ AT A GLANCE (E09 C16, 08.10.2026; audit S05-29, S12-52). The three counts are number
 * cells - narrow and centred by the stylesheet, where they were columns of 150-420 px with a
 * digit lost in each; the kit's `num` cells of the `case-count` column since E47-C4 (`drpg-num`
 * until then) - and a kind's count is "(2)", because "×2" in the theme's pixel face read
 * as part of the kind's name ("Neutral Truth Bullet X2"). The table's body rows since E47-C4
 * (`caseStudentTable` draws the table).
 */
export function caseStudentRows(students) {
    return students.length ? tableBody(caseStudentTable(students)) : "";
}

/* ---- the dashboard's three tables on the kit (E47-C4, 09.11.2026; card M5, S17-42) ----------------------------------
   WHO HAS WHAT, the Traces tab's table and the Key Remnants planner are the kit's `dataTable`, their columns and their
   order the hand tables' (D31), each input's `name` as before (`readDashboardForm` reads them). Every column carries a
   `cls` (`drpg-data-col-case-*`): components.css's dashboard section states the narrow ones' widths and holds each table
   to the window (under Legacy the Traces table was 1583 px in a 1284 px window at 1366x768, a sideways scroll - the
   E46/E47 measure of 3c952c67). A long head is cut at two lines with its whole name in its tooltip (`lines: 2`), and the
   two text cells - the Breakdown and Found by - at two lines with their whole text in `title` (`cellLines: 2`). The
   `case*Rows` functions are each table's body rows, for the suite's builders' tests. R2067, R2068. */

/** A dataTable's body rows: what lies between its `<tbody>` and `</tbody>` (cells escape what a person typed). */
function tableBody(markup) {
    const from = markup.indexOf("<tbody>");
    return from < 0 ? "" : markup.slice(from + "<tbody>".length, markup.lastIndexOf("</tbody>"));
}

/**
 * WHO HAS WHAT's columns, in the hand table's order: Student; Bullets, Keys held, Not analysed as numbers; Breakdown,
 * the head "Really" with its tooltip (S12-52: it is what the bullets are by the GMs' answer key). Every head of the
 * dashboard's tables is cut at two lines with its whole name in `title` (`lines: 2`; under Legacy's pixel face a one-word
 * head such as "Reinforced" is as wide as the column) - but the Breakdown's, one short word whose tooltip is the
 * sentence, not its name. Exported for R2067.
 */
export function caseStudentColumns() {
    const L = key => game.i18n.localize(key);
    return [
        { key: "student", label: L("DRPG.Investigation.student"), cls: "case-student", lines: 2 },
        { key: "bullets", label: L("DRPG.Investigation.bullets"), num: true, cls: "case-count", lines: 2 },
        { key: "keys", label: L("DRPG.Investigation.keysHeld"), num: true, cls: "case-count", lines: 2 },
        { key: "unidentified", label: L("DRPG.Investigation.unidentified"), num: true, cls: "case-count", lines: 2 },
        { key: "breakdown", label: L("DRPG.Investigation.breakdown"), cls: "case-breakdown", cellLines: 2 }
    ];
}

/**
 * WHO HAS WHAT as the kit's table. "Really" read as nothing at a table (S12-52): its head carries the tooltip that says
 * it is what the bullets are by the GMs' answer key, whatever their holders were shown - written on the kit's head (no
 * builder of the kit names a head's tooltip; a dataTable head's markup is fixed, `<th scope="col" class="...">`).
 * Exported for R2067.
 */
export function caseStudentTable(students) {
    const rows = students.map(s => {
        const breakdown = Object.entries(s.types)
            .map(([type, n]) => `${esc(TRUTH_BULLET_TYPES[type]?.label ?? type)} (${n})`)
            .join(", ");
        return { student: esc(s.actor.name), bullets: String(s.total), keys: String(s.keys),
            unidentified: String(s.unidentified), breakdown: `<span class="notes">${breakdown || "-"}</span>` };
    });
    // The Breakdown head's tooltip ("Really", S12-52) is its column's `tooltip` since E47-KFa (a string replace before it).
    return dataTable({ columns: caseStudentColumns().map(c => (c.cls === "case-breakdown" ? { ...c, tooltip: game.i18n.localize("DRPG.Investigation.breakdownTooltip") } : c)), rows });
}

/**
 * A kind of trace Observe has a number for: what "New trace" offers, and what the Traces tab
 * offers a trace to become (E09 C13, S05-20) - the reason is `openNewTrace`'s.
 */
function findableKind(key) {
    return REMNANT_VISIBILITY.some(v => observeDc(v, key) !== null);
}

/**
 * What a Traces tab row draws for a trace, keyed as the form names its fields (`name.<row>`,
 * `crime.<row>`...) - E09 C3. `caseTraceRows` draws from it and a Save reads the ledger now
 * through it, so what was drawn and what is there now are compared in one shape. A type the
 * list does not know is drawn as the first option, because that is what the select shows.
 */
function traceShows(data) {
    return {
        img: data.public?.img || ICON,
        name: data.public?.name || "",
        text: data.public?.playerText || "",
        analysis: data.public?.analyzedText || "",
        type: REMNANT_TYPES[data.type] ? data.type : Object.keys(REMNANT_TYPES).find(findableKind),
        // The band, for every trace (E60 C4a): what the select shows (remnants.mjs `shownBand`).
        vis: shownBand(data.visibility),
        faint: Boolean(data.faint),
        crime: tieShown(data.tiedToCrime),
        reinf: Boolean(data.reinforced)
    };
}

/*
 * THE TIE'S THREE STATES, AS THE TRACES TAB DRAWS THEM (E09 C4, 08.10.2026; audit S05-37, the
 * owner's D14). The column was a checkbox, so it could say "tied" and "not" and nothing else, and
 * an unticked box saved as `false` - a GM's "not tied" - for a trace nobody had decided about.
 * A select now: "-" nobody has said (the ledger's `null`, which a victim's death ties), "Tied",
 * and "Not tied", which nothing but a GM moves (remnants.mjs `tieState`). The values are the
 * option values; `tieTaken` turns one back into the ledger's.
 */
const TIE_OPTIONS = Object.freeze({ "": "DRPG.Remnant.tieOpen", tied: "DRPG.Remnant.tieTied", untied: "DRPG.Remnant.tieUntied" });
const tieShown = tie => tie === true ? "tied" : tie === false ? "untied" : "";
const tieTaken = shown => shown === "tied" ? true : shown === "untied" ? false : null;

/** The Traces tab's fields, by the prefix of their names in the form. */
const TRACE_FIELDS = ["img", "name", "text", "analysis", "type", "vis", "faint", "crime", "reinf"];

/** What a refusal calls each field: the column it is under. */
const FIELD_LABELS = {
    img: "DRPG.Investigation.traceImage", name: "DRPG.Investigation.traceName",
    text: "DRPG.Investigation.traceText", analysis: "DRPG.Investigation.traceAnalysis",
    type: "DRPG.Investigation.traceType", vis: "DRPG.Investigation.visibility", faint: "DRPG.Remnant.faintColumn",
    crime: "DRPG.Remnant.crimeColumn", reinf: "DRPG.Remnant.reinforcedColumn",
    note: "DRPG.Investigation.keyNoteLabel", token: "DRPG.Investigation.onMap",
    // E97 C6: a schema node's fields, on its node on the Map (in the side panel until the E97 fix)
    label: "DRPG.CaseMap.field.label", gmText: "DRPG.CaseMap.field.text", mode: "DRPG.CaseMap.field.mode",
    inputs: "DRPG.CaseMap.field.inputs", refutes: "DRPG.CaseMap.field.refutes"
};

/** A refused value as the GM typed or picked it: a box, a type, a trace by its name. */
function refusedAs(field, value, traces) {
    if (typeof value === "boolean") return game.i18n.localize(value ? "DRPG.Live.ticked" : "DRPG.Live.unticked");
    if (field === "type") return REMNANT_TYPES[value]?.label ?? value;
    if (field === "vis") return REMNANT_VISIBILITY_LABELS[value] ?? value;
    if (field === "crime") return game.i18n.localize(TIE_OPTIONS[value] ?? TIE_OPTIONS[""]);
    if (field === "token") {
        const trace = traces.find(t => `${t.token.id}|${t.scene.id}` === value);
        return trace ? trace.data.public?.name || traceContextLine(trace.data) || value
            : game.i18n.localize("DRPG.Investigation.notPlaced");
    }
    return value;
}

/**
 * One editable row per trace the reader is shown. Exported for the suite, which hands it a
 * synthetic trace (`{ token, data, scene }`) and an empty `finders` map.
 *
 * The Player description carries the hint the Key tab's has (E09 C16, audit S12-52: it had
 * none), and both hints are short and dim - a full-colour sentence in an empty box read as a
 * description already written, and the analysis one was cut mid-sentence (S05-29).
 */
export function caseTraceRows(shown, finders) {
    return shown.length ? tableBody(caseTraceTable(shown, finders)) : "";
}

/** The Traces tab's columns, in the hand table's order (D31). Exported for R2067 and R2068. */
export function caseTraceColumns() {
    const L = key => game.i18n.localize(key);
    return [
        { key: "name", label: L("DRPG.Investigation.traceName"), cls: "case-trace-name", lines: 2 },
        { key: "text", label: L("DRPG.Investigation.traceText"), cls: "case-text", lines: 2 },
        { key: "analysis", label: L("DRPG.Investigation.traceAnalysis"), cls: "case-text", lines: 2 },
        { key: "type", label: L("DRPG.Investigation.traceType"), cls: "case-pick", lines: 2 },
        { key: "vis", label: L("DRPG.Investigation.visibility"), cls: "case-pick", lines: 2 },
        { key: "faint", label: L("DRPG.Remnant.faintColumn"), cls: "case-check", lines: 2 },
        { key: "crime", label: L("DRPG.Remnant.crimeColumn"), cls: "case-pick", lines: 2 },
        { key: "reinf", label: L("DRPG.Remnant.reinforcedColumn"), cls: "case-check", lines: 2 },
        { key: "found", label: L("DRPG.Investigation.foundBy"), cls: "case-found", cellLines: 2, lines: 2 },
        { key: "delete", label: L("DRPG.Investigation.deleteTrace"), act: true, cls: "case-act", lines: 2 }
    ];
}

/** The Traces tab's table: one editable row per trace the reader is shown. Exported for R2067 and R2068. */
export function caseTraceTable(shown, finders) {
    return dataTable({ columns: caseTraceColumns(), rows: caseTraceCells(shown, finders) });
}

function caseTraceCells(shown, finders) {
    return shown.map(({ token, data, scene }) => {
        const key = rowKey(scene.id, token.id);
        const shows = traceShows(data);
        const who = Array.from(finders.get(token.id) ?? []);
        const found = who.length
            ? esc(who.join(", "))
            : `<em>${game.i18n.localize("DRPG.Investigation.notFound")}</em>`;

        /* Named for a screen reader - the column, and which trace. The Key planner's
           rows got the same on 21.09; these were missed because the sweep ran on a
           scene with no traces, and the suite's own run had some. */
        const row = data.public?.name || traceContextLine(data) || key;
        const aria = column => ` aria-label="${esc(`${game.i18n.localize(column)}: ${row}`)}"`;
        return { name: `
                <img src="${esc(shows.img)}" alt="" class="drpg-project-portrait"
                     data-drpg-portrait="${key}" />
                <input type="hidden" name="img.${key}" value="${esc(shows.img)}" data-drpg-drawn="${esc(shows.img)}" />
                <input type="text" name="name.${key}"${aria("DRPG.Investigation.traceName")} value="${esc(shows.name)}" />
                <div class="notes drpg-trace-context">${esc(traceContextLine(data))}</div>`,
            text: `<textarea name="text.${key}" rows="2"${aria("DRPG.Investigation.traceText")}
                placeholder="${game.i18n.localize("DRPG.Investigation.notePlaceholder")}">${esc(shows.text)}</textarea>`,
            /* The second tier, edited in the same row as the first. Side by
               side on purpose: the two sentences describe one object and a
               GM writing the lab reading wants the observation in view, not
               on another tab. See TRUTH_BULLET_FLAGS.analyzedText for who
               ever gets to read this one. */
            analysis: `<textarea name="analysis.${key}" rows="2"${aria("DRPG.Investigation.traceAnalysis")}
                placeholder="${game.i18n.localize("DRPG.Investigation.analysisPlaceholder")}"
                >${esc(shows.analysis)}</textarea>`,
            /* WHAT IT REALLY IS, CORRECTED BY HAND. The column that used to be
               free-text tags. The module decides the type from whatever action
               left the trace and gets the common cases right; the rest are
               judgements only the GM can make - the killer moved the body
               after the Search, the "cleaning" was actually preparation. The
               value written here reaches the answer key of every copy already
               in a player's pack (`propagateVerdicts`), and changes what they
               are SHOWN only where they have already analysed it.

               THE KINDS "NEW TRACE" OFFERS, AND THE ROW'S OWN (E09 C13, 08.10.2026;
               audit S05-20). Every kind was listed, Autopsy among them, which "New
               trace" refuses because Observe has no number for it: a trace retyped
               here sat in its room behind a difficulty nothing rolls against (read in
               the code: Observe's list drops a kind with no number). A row
               already of such a kind keeps it in its list, so the select says what the
               trace is and a Save leaves it alone. */
            type: `<select name="type.${key}"${aria("DRPG.Investigation.traceType")}>${Object.entries(REMNANT_TYPES)
                .filter(([value]) => findableKind(value) || value === shows.type).map(([value, def]) =>
                `<option value="${esc(value)}"${value === shows.type ? " selected" : ""}>${
                    esc(def.label)}</option>`).join("")}</select>`,
            /* HOW HARD IT IS TO SPOT, FOR EVERY TRACE (E60 C4a, 03.11.2026; the owner's ask of 28.10, Q-E60-3's
               alternative): the band Observe reads its number from, found or not - a found trace's copies keep
               the band they were made with (remnants.mjs `setRemnantFlags`). */
            vis: `<select name="vis.${key}"${aria("DRPG.Investigation.visibility")}>${bandOptions(shows.vis)}</select>`,
            // the two checkboxes centred by the column's rule (components.css `drpg-data-col-case-check`), not inline
            faint: `<input type="checkbox" name="faint.${key}"${aria("DRPG.Remnant.faintColumn")} ${shows.faint ? "checked" : ""} />`,
            crime: `<select name="crime.${key}"${aria("DRPG.Remnant.crimeColumn")}>${Object.entries(TIE_OPTIONS).map(([value, label]) =>
                `<option value="${value}"${value === shows.crime ? " selected" : ""}>${esc(game.i18n.localize(label))}</option>`).join("")}</select>`,
            reinf: `<input type="checkbox" name="reinf.${key}"${aria("DRPG.Remnant.reinforcedColumn")} ${shows.reinf ? "checked" : ""} />`,
            found,
            /* DELETE, THE GM'S (E44 C8d): asked first, then the row and the token together (`deleteTraceRow`). A plain
               button, so it submits nothing: the form's Save is the window's own. */
            delete: `<button type="button" class="drpg-trace-delete" data-drpg-trace-delete="${key}"${aria("DRPG.Investigation.deleteTrace")}>${
                game.i18n.localize("DRPG.Investigation.deleteTrace")}</button>`
        };
    });
}

/** The filter bar over the trace list, built from the traces themselves. */
function caseTraceFilters(traces, shown, reading) {
    // Built from the traces THEMSELVES, not from the cast and
    // the map: a filter offering a room with nothing in it, or
    // a student who has left nothing, is a filter that answers
    // "none" and teaches the GM to stop trying it.
    const people = new Map();
    const rooms = new Set();
    const chapters = new Set();
    for (const { data } of traces) {
        if (data.sourceActor) {
            people.set(data.sourceActor,
                data.sourceName || game.actors.get(data.sourceActor)?.name
                || data.sourceActor);
        }
        if (data.room) rooms.add(data.room);
        if (data.chapter !== undefined && data.chapter !== null) {
            chapters.add(String(data.chapter));
        }
    }
    const option = (value, label, chosen) =>
        `<option value="${esc(value)}"${value === chosen ? " selected" : ""}>${
            esc(label)}</option>`;
    return `<div class="drpg-trace-filters">
        <label>${game.i18n.localize("DRPG.Investigation.filterOrder")}
            <select name="traceOrder" data-drpg-filter="order">
                ${option("room", game.i18n.localize("DRPG.Investigation.orderRoom"), reading.order)}
                ${option("newest", game.i18n.localize("DRPG.Investigation.orderNewest"), reading.order)}
            </select></label>
        <label>${game.i18n.localize("DRPG.Investigation.filterPlayer")}
            <select name="tracePlayer" data-drpg-filter="player">
                ${option("", game.i18n.localize("DRPG.Investigation.filterAll"), reading.player)}
                ${[...people].sort((a, b) => a[1].localeCompare(b[1]))
                    .map(([id, name]) => option(id, name, reading.player)).join("")}
            </select></label>
        <label>${game.i18n.localize("DRPG.Investigation.filterRoom")}
            <select name="traceRoom" data-drpg-filter="room">
                ${option("", game.i18n.localize("DRPG.Investigation.filterAnywhere"), reading.room)}
                ${[...rooms].sort((a, b) => a.localeCompare(b))
                    .map(name => option(name, name, reading.room)).join("")}
            </select></label>
        <label>${game.i18n.localize("DRPG.Investigation.filterChapter")}
            <select name="traceChapter" data-drpg-filter="chapter">
                ${option("", game.i18n.localize("DRPG.Investigation.filterEveryChapter"), reading.chapter)}
                ${[...chapters].sort((a, b) => Number(a) - Number(b))
                    .map(n => option(String(n),
                        game.i18n.format("DRPG.Investigation.chapterN", { n }),
                        reading.chapter)).join("")}
            </select></label>
        <span class="notes">${game.i18n.format("DRPG.Investigation.filterCount", {
            shown: shown.length, total: traces.length
        })}</span>
    </div>`;
}

/** The Traces tab's pane (the kit draws its frame, `kitTabs`): the filter bar, the rule, and the table or the reason it is empty. */
function caseTracesPanel({ traces, shown, finders, reading }) {
    return `
        ${caseTraceFilters(traces, shown, reading)}
        <p class="notes drpg-clue-rule">${
            game.i18n.localize("DRPG.Investigation.neverOnePerson")}</p>
        ${shown.length ? caseTraceTable(shown, finders)
            : `<p class="notes">${game.i18n.localize(traces.length
                ? "DRPG.Investigation.noneMatch" : "DRPG.Investigation.noTraces")}</p>`}`;
}

/**
 * The planner's rows: one per planned Key Remnant, with the placed traces to
 * pick from.
 *
 * Exported for the suite, which hands it a synthetic plan and a synthetic
 * placed trace: every input it reads is an argument, so the one thing worth
 * testing about it - that a placed row's pickers say what is on the map - can
 * be measured without writing anything to the world.
 *
 * ONE STATUS, AND A BUTTON THAT PLACES (E09 C16, 08.10.2026; audit S05-28). The row had eight
 * columns at 1400 px: "Which Remnant" and "Found by" each said "Not placed yet" on every row
 * nobody had placed, and "Create on the map" was two selects - "- create in -" and "Evident" -
 * with no button, so a GM who had not built the planner could not see that picking a room and
 * pressing Save put a token on the map. One Status column now says where the row stands (not
 * placed, its Remnant gone or retyped, who found it, nobody yet), holds the picker of placed
 * traces (its empty option "- no Remnant -" since E44 C4b, a bare "-" before) and, on a row with nothing on the
 * map, a Place button that asks the room and the visibility in a small window and places the
 * clue then (`placeKeyRow`). Save places nothing any more. A row past the opening roll's limit
 * draws the button `drpg-key-limited` and disabled, as it drew the two selects.
 */
export function caseKeyRows({ plan, status, placed, limit }) {
    return plan.entries.length ? tableBody(caseKeyTable({ plan, status, placed, limit })) : "";
}

/** The Key Remnants planner's columns, in the hand table's order (D31). Exported for R2067 and R2068. */
export function caseKeyColumns() {
    const L = key => game.i18n.localize(key);
    return [
        { key: "scale", label: L("DRPG.Investigation.difficulty"), cls: "case-scale", lines: 2 },
        { key: "name", label: L("DRPG.Investigation.traceName"), cls: "case-key-name", lines: 2 },
        { key: "text", label: L("DRPG.Investigation.traceText"), cls: "case-key-text", lines: 2 },
        { key: "analysis", label: L("DRPG.Investigation.traceAnalysis"), cls: "case-key-text", lines: 2 },
        { key: "note", label: L("DRPG.Investigation.keyNoteLabel"), cls: "case-key-note", lines: 2 },
        { key: "status", label: L("DRPG.Investigation.keyStatus"), cls: "case-key-status", lines: 2 }
    ];
}

/**
 * The planner as the kit's table; a row past the opening roll's limit dimmed as the hand table dimmed it (its `<tr>`'s
 * opacity, by `rowAttrs`). Exported for R2067 and R2068.
 */
export function caseKeyTable({ plan, status, placed, limit }) {
    return dataTable({ columns: caseKeyColumns(), rows: caseKeyCells({ plan, status, placed, limit }),
        rowAttrs: row => ({ style: row.overLimit ? "opacity:.6" : null }) });
}

function caseKeyCells({ plan, status, placed, limit }) {
    // The same six facts the trace rows carry, in the same order - see
    // `traceContextLine`. A GM picking which placed trace an entry means was
    // choosing between "Evident · Kitchen · note" lines that said nothing about
    // who had left them or when, which is exactly what tells two clues apart.
    const tokenOptions = placed.map(r => {
        const context = traceContextLine(r.data);
        const label = `${r.data.visibilityLabel}${context ? ` · ${context}` : ""}`
            + `${r.data.note ? ` · ${r.data.note}` : ""}`
            + `${game.scenes.size > 1 ? ` · ${r.scene.name}` : ""}`;
        return { id: r.token.id, sceneId: r.scene.id, label };
    });

    return plan.entries.map((entry, i) => {
        const st = status.entries[i];
        const overLimit = limit !== null && i >= limit;
        const picker = tokenOptions.map(o =>
            `<option value="${o.id}|${o.sceneId}"${o.id === entry.tokenId ? " selected" : ""}>${
                esc(o.label)}</option>`).join("");
        const live = entry.tokenId && tokenOptions.some(o => o.id === entry.tokenId);
        // Read off the placed trace itself rather than off the plan: the plan
        // stores a scale and a sentence, and everything a GM wants to compare
        // between two clues - who left them, where, when - belongs to the trace.
        const here = placed.find(r => r.token.id === entry.tokenId)?.data ?? null;
        const shows = keyRowShows(entry, placed);
        const context = traceContextLine(here);
        /* REVEALED BY MONOKUMA (E70 fix p2-G4; the review's BEH-5, P2R-08, E70P2-R13): the plan's reveal row (keyPlanStatus
           `revealed`) is the find's source; a slot with no trace has copies with no trace behind them, so "Found by" named
           nobody, and a trace's finders read as if they had found it. */
        const revealedBy = `<strong>${game.i18n.localize("DRPG.Investigation.revealedByMonokuma")}</strong>`;
        const state = st?.revealed
            ? `${revealedBy}${st.finders?.length ? ` · ${game.i18n.localize("DRPG.Investigation.foundBy")}: ${esc(st.finders.join(", "))}` : ""}`
            : !entry.tokenId
            ? `<em>${game.i18n.localize("DRPG.Investigation.notPlaced")}</em>`
            : !st.placed
                ? `<strong>${game.i18n.localize(st.retyped ? "DRPG.Investigation.keyRetyped" : "DRPG.Investigation.tokenGone")}</strong>`
                : st.found
                    ? `${game.i18n.localize("DRPG.Investigation.foundBy")}: ${esc(st.finders.join(", "))}`
                    : `<em>${game.i18n.localize("DRPG.Investigation.notFound")}</em>`;

        /* Named for a screen reader: the column, and which of the planned clues this
           row is. The headers name them only for the eye (21.09, the a11y sweep). */
        const aria = (...keys) => ` aria-label="${esc(
            `${keys.map(k => game.i18n.localize(k)).join(": ")} - ${i + 1}`)}"`;
        return {
            overLimit,
            scale: `<strong>${esc(SCALE_LABELS[entry.scale] ?? entry.scale)}</strong>`,
            name: `<input type="text" name="keyname:${i}"${aria("DRPG.Investigation.traceName")} value="${esc(shows.name)}"
                placeholder="${esc(traceLabel(null))}" />`,
            text: `<textarea name="keytext:${i}" rows="1"${aria("DRPG.Investigation.traceText")}
                placeholder="${game.i18n.localize("DRPG.Investigation.notePlaceholder")}">${
                esc(shows.text)}</textarea>
                ${context ? `<div class="notes drpg-trace-context">${esc(context)}</div>` : ""}`,
            /* The second tier, as on the Traces tab (21.09). A placed row falls back
               on the trace's own reading: a plan saved before this column existed
               holds none, and an empty box would read as "nothing written". */
            analysis: `<textarea name="keyanalysis:${i}" rows="1"${aria("DRPG.Investigation.traceAnalysis")}
                placeholder="${game.i18n.localize("DRPG.Investigation.analysisPlaceholder")}">${
                esc(shows.analysis)}</textarea>`,
            note: `<input type="text" name="note:${i}"${aria("DRPG.Investigation.keyNoteLabel")} value="${esc(shows.note)}"
                placeholder="${game.i18n.localize("DRPG.Investigation.keyNotePlaceholder")}" />`,
            status: `
                <div class="drpg-key-state">${state}</div>
                <select name="token:${i}"${aria("DRPG.Investigation.onMap")}>
                    ${emptyOption("DRPG.Investigation.noRemnant", { selected: !live })}
                    ${picker}
                </select>
                ${here ? "" : `<select name="keyroom:${i}"${aria("DRPG.Investigation.plannedRoom")}><option value="">${
                    esc(game.i18n.localize("DRPG.CaseRealize.noRoom"))}</option>${placeRoomOptions({ room: shows.room })}</select>`}
                ${here ? "" : `<button type="button" name="place:${i}" data-drpg-key-place="${i}"${
                    aria("DRPG.Investigation.place")} class="drpg-key-place${overLimit ? " drpg-key-limited" : ""}"${
                    overLimit ? " disabled" : ""}>${game.i18n.localize("DRPG.Investigation.place")}</button>`}`
        };
    });
}

/** The Key Remnants tab: the planner and its warnings. */
/**
 * The warning that the case is getting thin (E66 C3; S13-29, E66-14): a plural family on the Key Remnants found, and
 * its own sentence for none, which the family's "Only 0 Key Remnants" was. Exported for R1156.
 */
export function tooThinLine(found) {
    return found > 0
        ? plural("DRPG.Investigation.tooThin", { found, min: KEY_REMNANTS.minimum }, "found")
        : game.i18n.format("DRPG.Investigation.tooThinNone", { min: KEY_REMNANTS.minimum });
}

function caseKeyPanel({ plan, status, placed, limit }) {
    // The guide's floor is three Key Remnants; the plan's own warning threshold
    // is one above it, so a GM is told the trial is getting thin BEFORE it is
    // actually unsolvable rather than at the moment it already is.
    const bar = KEY_REMNANTS.minimum + 1;
    const thin = status.foundAny < bar;
    return `
        <p>${plural("DRPG.Investigation.plannerIntro", {
            chapter: plan.chapter, n: KEY_REMNANTS.prepared,
            min: KEY_REMNANTS.suspectRange[0], max: KEY_REMNANTS.suspectRange[1]
        })}</p>
        <p>${game.i18n.format("DRPG.Investigation.keySummary", {
            found: status.found, placed: status.placed, total: status.entries.length
        })}</p>
        ${status.offPlan.length ? `<p class="notes">${plural("DRPG.Investigation.keyOffPlan", {
            n: status.offPlan.length, bar,
            names: esc(listOf(status.offPlan.map(r => r.name || game.i18n.localize("DRPG.Remnant.cardTitle"))))
        })}</p>` : ""}
        ${/* a warning, in the kit's box (E47-C4; E21's carried sites, homed in E47 here): the trial is getting thin */ ""}
        ${thin ? box("warning", `<p>${tooThinLine(status.foundAny)}</p>`) : ""}
        ${limit !== null ? `<p class="notes">${game.i18n.format("DRPG.Investigation.keyLimitLine", {
            used: Math.min(plan.entries.length, limit), limit, min: KEY_REMNANTS.minimum
        })}</p>
        <label><input type="checkbox" name="keyOverride" /> ${
            game.i18n.localize("DRPG.Investigation.keyLimitOverride")}</label>` : ""}
        ${caseKeyTable({ plan, status, placed, limit })}
        <p class="notes">${game.i18n.localize("DRPG.Investigation.createNote")}</p>
        <p class="notes">${game.i18n.format("DRPG.Investigation.keyDcNote", {
            // Read off OBSERVE_DC so the sentence cannot drift from the rule it
            // describes (S-5): the numbers are already there, and the first audit
            // read them as a proposal because nothing said so.
            list: REMNANT_VISIBILITY
                .map(band => `${REMNANT_VISIBILITY_LABELS[band] ?? band} ${
                    OBSERVE_DC[band]?.key ?? "?"}`)
                .join(", ")
        })}</p>
        <p class="notes">${game.i18n.localize("DRPG.Investigation.keyPublicNote")}</p>
        ${(() => {
            /* THE COUNT THE PLANNER COULD NOT SEE. Its rows reset with the chapter and
               Key Remnants do not - they are `reinforced`, so no sweep touches them - so
               "0 of 5 found" can be true of the plan and false of the map at the same
               time. Counted off the map rather than the plan, which is the only place
               the answer is. A counted sentence since E09 C14 (audit S05-35): "Key Remnant(s)"
               read wrong in both languages, and Polish took the wrong case of the number.
               Last season's clue of the same chapter is a leftover too (E11 C12, `sameSeason`). */
            const old = placed.filter(r => r.data.chapter != null
                && (r.data.chapter !== plan.chapter || !sameSeason(r.data))).length;
            // a warning in the kit's box since E47-C4 (E21's carried sites, homed in E47 here), a `drpg-warning` line before
            return old ? box("warning", `<p>${plural("DRPG.Investigation.leftoverKeys", { n: old })}</p>`) : "";
        })()}`;
}

/**
 * The Final Key Remnant tab: what is placed, who has it, and the form to plant one.
 *
 * ONE EMPTY STATE, AND A FORM THAT SAYS WHAT IT DOES (E11 C13, 1.2.73; audit S13-08; tier 1 R358). With nothing
 * placed the tab said "None placed yet.", then a box telling the GM to drop a Final Truth Remnant "with the ordinary
 * Remnant tools", with this tab's own form right under it, then "Leave the room empty to change nothing" over a Room
 * field whose empty option read "-": three ways in and the GM could not tell which was meant. Now an empty list says
 * nothing of its own and the reminder is the one empty state, pointing at the form below. The plan asked for a Room
 * field with no empty option; it keeps one, named for what it does: the form rides the dashboard's one Save
 * (`placeFinalFromDashboard` runs on any Save whose `finalRoom` is set, read in the code), so a field that always
 * held a room would place a Final on every Save of a trace or a Key row. Exported for R358.
 */
export function caseFinalPanel({ roomOptions, visOptions, finalRemnants, finalTruthPlacedThisChapter }) {
    return `
        <p class="notes">${game.i18n.localize("DRPG.Mastermind.finalRemnantsNote")}</p>
        ${(() => {
            const placedFinals = finalRemnants();
            /* WHO HAS IT, which this tab alone did not say. The other two carry a
               "found by" and this is the one clue whose being missed ends the season
               differently. Same reading as `findersByRemnant`, off the ledger. */
            const finalFinders = findersByAnyRemnant();
            return placedFinals.length
                ? `<ul class="drpg-final-list">${placedFinals.map(f => {
                    const who = Array.from(finalFinders.get(f.token.id) ?? []);
                    return `<li>
                    <strong>${esc(f.data.public?.name
                        || game.i18n.localize("DRPG.Remnant.finalSubject"))}</strong>
                    <span class="notes">${esc(traceContextLine(f.data))}</span>
                    ${f.data.note ? `<span class="notes">${esc(f.data.note)}</span>` : ""}
                    <span class="notes">${game.i18n.localize(
                        "DRPG.Investigation.finalFoundBy")}: ${who.length
                            ? esc(who.join(", "))
                            : `<em>${game.i18n.localize("DRPG.Investigation.finalNobody")}</em>`}</span>
                </li>`; }).join("")}</ul>`
                : "";
        })()}
        ${/* information, not a warning (D11; audit S12-59, E22 C6b): none placed yet is the kit's neutral box */ ""}
        ${finalTruthPlacedThisChapter() ? `<p class="notes">${game.i18n.localize("DRPG.Mastermind.finalTruthPlaced")}</p>`
            : box("info", `<p class="notes">${game.i18n.localize("DRPG.Mastermind.finalTruthReminder")}</p>`)}
        <label>${game.i18n.localize("DRPG.Investigation.room")}
            <select name="finalRoom">
                <option value="">${esc(game.i18n.localize("DRPG.Mastermind.finalPickRoom"))}</option>
                ${roomOptions}
            </select></label>
        <label>${game.i18n.localize("DRPG.Investigation.visibility")}
            <select name="finalVis">${visOptions}</select></label>
        <label>${game.i18n.localize("DRPG.Remnant.authorLabel")}
            <select name="finalAuthor">${authorOptions(null, studentActors())}</select></label>
        <label>${game.i18n.localize("DRPG.Investigation.traceName")}
            <input type="text" name="finalName" value=""
                placeholder="${esc(game.i18n.localize("DRPG.Remnant.finalSubject"))}" /></label>
        <label>${game.i18n.localize("DRPG.Investigation.traceText")}
            <input type="text" name="finalText" value=""
                placeholder="${esc(game.i18n.localize(
                    "DRPG.Investigation.notePlaceholder"))}" /></label>
        <label>${game.i18n.localize("DRPG.Investigation.traceAnalysis")}
            <input type="text" name="finalAnalysis" value=""
                placeholder="${esc(game.i18n.localize(
                    "DRPG.TruthBullet.analyzedTextPlaceholder"))}" /></label>
        <label>${game.i18n.localize("DRPG.Investigation.keyNoteLabel")}
            <input type="text" name="finalNote"
                placeholder="${game.i18n.localize(
                    "DRPG.Investigation.finalNotePlaceholder")}" /></label>
        <p class="notes">${game.i18n.localize("DRPG.Mastermind.finalAddNote")}</p>`;
}

/** The whole dashboard as markup - a function of the world, so `keepLive` can call it again. */
function caseHtml(reading, { finalRemnants, finalTruthPlacedThisChapter }) {
    if (reading.view === "map") return caseMapRegion(reading, { finalRemnants, finalTruthPlacedThisChapter });
    const students = evidenceByStudent();
    const traces = allTraces();
    const finders = findersByAnyRemnant();
    const plan = keyPlan();
    const status = keyPlanStatus();
    // The opening roll's own limit on how many Key Remnants this chapter gets
    // - `null` before a murder has happened, meaning "no limit yet, plan
    // freely". See `def.keyRemnants` in config.mjs and `caseKeyCount`, which
    // keeps it past the incident's close (E09 C6).
    const limit = caseKeyCount(plan.chapter);

    /* THE TWO PICKERS SAY WHAT IS THERE, NOT WHAT THE LAST DEFAULT WAS. They were stamped into
       every Key row, and on a row already on the map (16.09) they read "Evident" and "Pick a room"
       for a clue placed Subtle in the Kitchen, so a placed row's pickers became the trace's own,
       selected and disabled. Since E09 C16 a Key row has no pickers: its Place button asks in a
       window of its own (`placeKeyRow`), and a placed row's room and visibility read in its
       picker of placed traces. The Final tab is what is left here, and it is always an input. */
    const visOptionsFor = chosen => REMNANT_VISIBILITY.map(v =>
        `<option value="${v}"${v === (chosen || "evident") ? " selected" : ""}>${
            esc(REMNANT_VISIBILITY_LABELS[v] ?? v)}</option>`).join("");

    const shown = readTracesAs(traces, reading);
    const placed = placedKeyRemnants();

    /* THE VIEW'S BOX IS THE LIVE REGION ITSELF (E97 C2): it is the one box of the window that scrolls, at a height the
       stylesheet states (components.css, "THE CASE PANEL'S FIXED FRAME"), so what it holds - any tab, either view - moves
       neither the window's frame nor its footer. `keepLive` carries a region's own scroll ("self", live.mjs `keysOf`),
       so a redraw keeps where the GM had scrolled to as it did when the window's body scrolled. */
    /* WHO HAS WHAT, A TAB OF ITS OWN, BY NAME (E98 C4; the owner's comparison 2, E47-21: "the students on a separate tab,
       showing not only how many they have found and analysed but which ones"; Q-E98-5's default). Until E98 the counts
       stood above the tabs on every tab; now they are the tab's first table, each student's Truth Bullets and items by
       name under it, the same list the Map's summary shows. */
    return `<div class="drpg-case-live drpg-case-view" data-drpg-view="table"><form>
        ${kitTabs([
            { key: "traces", label: game.i18n.localize("DRPG.Investigation.tabTraces"),
              html: caseTracesPanel({ traces, shown, finders, reading }) },
            { key: "key", label: game.i18n.localize("DRPG.Investigation.tabKeyRemnants"),
              html: caseKeyPanel({ plan, status, placed, limit }) },
            { key: "final", label: game.i18n.localize("DRPG.Mastermind.finalRemnantsTitle"), html: caseFinalPanel({
            /* The Final Key Remnant is always an input - it is being placed, not
               read back - so it takes the plain lists: every room, none chosen,
               and Evident as the default. Every room of every place scene, each
               option carrying its scene, which Save hands to the placement (E12 fix
               r1-G2; utils.mjs `placeRoomOptions`): it listed the camera's rooms
               and placed on the school's room of the name. */
            roomOptions: placeRoomOptions(), visOptions: visOptionsFor(null),
            finalRemnants, finalTruthPlacedThisChapter }) },
            { key: "who", label: game.i18n.localize("DRPG.Investigation.whoHasWhat"),
              html: `<div data-drpg-part="who">${caseStudentTable(students)}</div>${studentsListHtml()}` }
        ])}
    </form></div>`;
}

/**
 * THE VIEW THIS GM OPENS ON (E97 C5; the owner's Q-B, 11.11.2026: "the Map/Table switch is remembered per GM account, a
 * flag on their own user"). "map" or "table", read off the GM's own User; anything else - no flag yet - reads "map"
 * since C9 (the owner's E: "Map by default"; Q-E: the parity test green, R3653, and the owner shown both views, round
 * 1 of 12.11.2026). Not a secret: world-secrets.mjs forbids one User flag only (`preSessionNote.text`).
 */
export const INVESTIGATION_VIEWS = Object.freeze(["map", "table"]);
export function investigationView(user = game.user) {
    const v = user?.getFlag?.(MODULE_ID, "investigationView");
    return INVESTIGATION_VIEWS.includes(v) ? v : "map";
}

/** The view switch's markup, in the toolbar's switch slot (outside the live region: a redraw never replaces it). */
function viewSwitchHtml(view) {
    const button = (key, glyph, label) => `<button type="button" data-drpg-mode="${key}" aria-pressed="${view === key}">`
        + `${glyphHtml(glyph)}<span>${esc(game.i18n.localize(label))}</span></button>`;
    return `<div class="drpg-mode-bar drpg-case-switch-bar" role="toolbar" aria-label="${esc(game.i18n.localize("DRPG.CaseMap.viewSwitch"))}">`
        + button("map", "map-view", "DRPG.CaseMap.viewMap") + button("table", "table-view", "DRPG.CaseMap.viewTable") + `</div>`;
}

/**
 * The chapter the Map draws: the Remnants tab's chapter filter where it names one, else the chapter now running. A filter
 * of every chapter ("") draws every Remnant of the world beside this chapter's schema and Key slots.
 */
function mapChapterOf(reading) {
    const named = Number(reading.chapter);
    return reading.chapter && Number.isInteger(named) ? { chapter: named, chapters: "this" }
        : { chapter: getClock().chapter, chapters: reading.chapter === "" ? "all" : "this" };
}

/**
 * THE MAP'S REGION (E97 C5): the same live region as the Table's (`.drpg-case-live`, the view's box), with the map
 * inside its form, so C6's fields ride the Table's one Save. Read off the world here, as `caseHtml` reads the Table.
 */
function caseMapRegion(reading, { finalRemnants, finalTruthPlacedThisChapter }) {
    const { chapter, chapters } = mapChapterOf(reading);
    /* EVERY SLOT THE TABLE DRAWS (E97 C6): the Key plan as the planner reads it (`keyPlan`, its slots no GM wrote
       included), so each Table row of the planner has its node here. The plan is the chapter now running's, as the
       planner's is. */
    const plan = keyPlan();
    const status = keyPlanStatus();
    const placed = placedKeyRemnants();
    const limit = caseKeyCount(plan.chapter);
    const slots = plan.entries.map((e, slot) => ({ ...e, slot }));
    const graph = caseGraph(chapter, { chapters, slots: chapter === plan.chapter ? slots : null });
    const layout = layoutCase(graph, { sort: graph.meta?.sort, manual: graph.meta?.manual });
    const finders = findersByAnyRemnant();
    const authors = new Map();
    const traces = allTraces();
    for (const { token, data, scene } of traces) if (data.sourceName) authors.set(`${scene.id}.${token.id}`, data.sourceName);
    const editors = mapEditors({ graph, traces, finders, plan, status, placed, limit });
    const summary = studentsListHtml() + mapSummaryEditor({ plan, status, limit, finalRemnants, finalTruthPlacedThisChapter });
    const reach = caseReach(graph);
    // The case's consistency (E97 C8): warnings on their nodes and in the summary; nothing is refused for them.
    const problems = checkCase(graph, { reach, cycle: layout.cycle ?? [], keyMax: KEY_REMNANTS.prepared });
    const tools = caseToolsHtml({ sort: graph.meta?.sort ?? "kind", sorts: CASE_SORTS });
    return `<div class="drpg-case-live drpg-case-view" data-drpg-view="map" data-drpg-chapter="${esc(graph.chapter)}"><form class="drpg-case-form">${
        caseMapHtml({ graph, layout, finders, authors, reading, editors, summary, tools, reach, problems })}</form></div>`;
}

/**
 * WHAT THE STUDENTS CAN REACH, LIVE (E97 C7; the owner's A and B of 09.11): each evidence node's holders - the students
 * holding a Truth Bullet whose answer key names its Remnant (the dead included here; `reachability` keeps the living) -
 * and the chapter's culprits, from the Blackened register and the incident's killers. A culprit's copy never counts: the
 * register names more than one when a third party sided with the killer, and every one but the first is taken out of
 * the holders here, the first by `reachability` itself, which then says "only the culprit". Answers its reading by node.
 */
function caseReach(graph) {
    const byToken = new Map();
    for (const n of graph.nodes) if (n.evidence && n.trace) byToken.set(String(n.trace).split(".").pop(), n.id);
    const holders = new Map();
    for (const actor of studentActors()) {
        for (const item of bulletsOf(actor)) {
            const id = byToken.get(secretOf(item.uuid).remnantId);
            if (!id) continue;
            if (!holders.has(id)) holders.set(id, new Set());
            holders.get(id).add(actor.id);
        }
    }
    const culprits = caseCulprits(graph.chapter);
    for (const set of holders.values()) for (const c of culprits.slice(1)) set.delete(c);
    return reachability(graph, holders, { culpritId: culprits[0] ?? null, living: livingStudentsForGm().map(a => a.id) });
}

/** The chapter's culprits the reach leaves out (the Blackened, then the incident's killers), and the first of them (E99 C4). */
function caseCulprits(chapter) {
    return [...new Set([...blackenedIds(chapter), ...killerIds()])];
}
export function caseCulprit(chapter) {
    return caseCulprits(chapter)[0] ?? null;
}

/**
 * WHO HAS WHAT, BY NAME (E97 C7; the owner's Q-A of 11.11 and comparison 2's E47-21: "not only how many, but which"):
 * each living student, their Truth Bullets by name with what each really is (the GMs' answer key), then the rest of
 * what they carry by name. In the Map's overview (the side panel's summary until the E97 fix).
 */
function studentsListHtml() {
    const L = key => game.i18n.localize(key);
    const rows = livingStudentsForGm().map(actor => {
        const bullets = bulletsOf(actor).map(item => {
            const real = secretOf(item.uuid).realType;
            const kind = real ? (TRUTH_BULLET_TYPES[real]?.label ?? real) : "";
            return `<li>${esc(item.name)}${kind ? ` <span class="notes">(${esc(kind)})</span>` : ""}</li>`;
        });
        const items = (actor.items?.contents ?? [...(actor.items ?? [])]).filter(i => !isTruthBullet(i)).map(i => `<li>${esc(i.name)}</li>`);
        return `<div class="drpg-case-student"><strong>${esc(actor.name)}</strong>`
            + `<div class="drpg-case-student-part"><span class="drpg-case-edit-label">${esc(L("DRPG.CaseMap.studentBullets"))}</span>`
            + (bullets.length ? `<ul>${bullets.join("")}</ul>` : `<em>${esc(L("DRPG.CaseMap.none"))}</em>`) + `</div>`
            + `<div class="drpg-case-student-part"><span class="drpg-case-edit-label">${esc(L("DRPG.CaseMap.studentItems"))}</span>`
            + (items.length ? `<ul>${items.join("")}</ul>` : `<em>${esc(L("DRPG.CaseMap.none"))}</em>`) + `</div></div>`;
    });
    return `<section class="drpg-case-students"><h5>${esc(L("DRPG.Investigation.whoHasWhat"))}</h5>${rows.join("")}</section>`;
}

/**
 * EACH NODE'S FIELDS, THE TABLE'S OWN CELLS (E97 C6): a Remnant's from `caseTraceCells` (name, its picture, the two
 * descriptions, what it really is, visibility, Faint, tied to the murder, reinforced, who found it, Delete), a Key slot's
 * from `caseKeyCells` (its name, descriptions, note, its Remnant on the map and Place) - on the slot's own node, or on
 * its Remnant's when placed, beside the Remnant's. The words over each are the Table's column heads.
 */
function mapEditors({ graph, traces, finders, plan, status, placed, limit }) {
    const L = key => game.i18n.localize(key);
    const byKey = new Map(traces.map(r => [`${r.scene.id}.${r.token.id}`, r]));
    const editors = new Map();
    const add = (id, html) => editors.set(id, (editors.get(id) ?? "") + html);
    for (const node of graph.nodes) {
        if (!node.evidence || node.planned || !byKey.has(node.trace)) continue;
        const [c] = caseTraceCells([byKey.get(node.trace)], finders);
        add(node.id, [
            editRow(L("DRPG.Investigation.traceName"), c.name), editRow(L("DRPG.Investigation.traceText"), c.text),
            editRow(L("DRPG.Investigation.traceAnalysis"), c.analysis), editRow(L("DRPG.Investigation.traceType"), c.type),
            editRow(L("DRPG.Investigation.visibility"), c.vis), editRow(L("DRPG.Remnant.faintColumn"), c.faint),
            editRow(L("DRPG.Remnant.crimeColumn"), c.crime), editRow(L("DRPG.Remnant.reinforcedColumn"), c.reinf),
            editRow(L("DRPG.Investigation.foundBy"), c.found), `<div class="drpg-case-edit-actions">${c.delete}</div>`
        ].join(""));
    }
    /* A PLANNED REMNANT'S FIELDS TOO (13.11.2026): it is evidence on the map, so until then it drew none, and its room,
       its type and its Place on the map were reached only from the GM panel's list (E97 C12's editor, never drawn). */
    for (const node of graph.nodes) if (!node.evidence || (node.planned && node.kind === "incident")) add(node.id, schemaEditor(graph, node));
    const slotNode = new Map(graph.nodes.filter(n => Number.isInteger(n.slot)).map(n => [n.slot, n.id]));
    caseKeyCells({ plan, status, placed, limit }).forEach((c, i) => {
        const id = slotNode.get(i);
        if (!id) return;
        add(id, `<div class="drpg-case-edit-group"${c.overLimit ? ` data-drpg-over-limit="1"` : ""}>`
            + `<h5>${esc(game.i18n.format("DRPG.CaseMap.slotNumber", { n: i + 1 }))}</h5>`
            + editRow(L("DRPG.Investigation.difficulty"), c.scale) + editRow(L("DRPG.Investigation.traceName"), c.name)
            + editRow(L("DRPG.Investigation.traceText"), c.text) + editRow(L("DRPG.Investigation.traceAnalysis"), c.analysis)
            + editRow(L("DRPG.Investigation.keyNoteLabel"), c.note) + editRow(L("DRPG.Investigation.keyStatus"), c.status) + `</div>`);
    });
    return editors;
}

/**
 * A SCHEMA NODE'S EDITOR (E97 C6): its name, the GM's words on it, the trial mode it plays out in (the floor's own modes,
 * case-schema.mjs `caseModes`, E99's minigame), and what it rests on - a deduction's and the solution's inputs, a
 * counter's targets - as a checklist of the chapter's other nodes. Fields named `case:<chapter>:<node>:<field>` (a
 * checklist's boxes `...:in:<node>` and `...:ref:<node>`), drawn with their values, read by `readDashboardForm` as the
 * Table's are and written by the same Save through `setCaseNode` (`applySchemaSave`), a field another GM moved under the
 * window refused and told. Remove is at once, asked first.
 */
function schemaEditor(graph, node) {
    const L = key => game.i18n.localize(key);
    const base = `case:${graph.chapter}:${node.id}`;
    const name = field => `${base}:${field}`;
    const others = graph.nodes.filter(n => n.id !== node.id);
    const nameOf = n => n.label || (n.planned ? game.i18n.format("DRPG.CaseMap.slotNumber", { n: (n.slot ?? 0) + 1 }) : L("DRPG.CaseMap.noName"));
    const box = (field, n, on) => `<label class="drpg-case-check"><input type="checkbox" name="${esc(name(`${field}:${n.id}`))}"${on ? " checked" : ""} /> `
        + `${esc(nameOf(n))}</label>`;
    const modes = [`<option value=""${node.mode ? "" : " selected"}>${esc(L("DRPG.CaseMap.noMode"))}</option>`,
        ...caseModes().map(m => `<option value="${esc(m)}"${m === node.mode ? " selected" : ""}>${esc(L(`DRPG.Floor.mode.${m}`))}</option>`)];
    if (node.mode && !caseModes().includes(node.mode)) modes.push(`<option value="${esc(node.mode)}" selected>${esc(node.mode)}</option>`);
    const rows = [
        editRow(L("DRPG.CaseMap.field.label"), `<input type="text" name="${esc(name("label"))}" value="${esc(node.label)}" />`),
        editRow(L("DRPG.CaseMap.field.text"), `<textarea name="${esc(name("text"))}" rows="3">${esc(node.text)}</textarea>`),
        editRow(L("DRPG.CaseMap.field.mode"), `<select name="${esc(name("mode"))}">${modes.join("")}</select>`)
    ];
    if (node.kind === "incident") {
        // E97 C12: a planned Incident Remnant: its room, and the road onto the map (New Remnant, filled in from here)
        const rooms = placeRoomOptions({ room: node.room });
        // 13.11.2026: its Remnant type (case-schema.mjs PLANNED_TYPES), Incident by default
        const types = PLANNED_TYPES.map(t => `<option value="${esc(t)}"${t === (node.type ?? "incident") ? " selected" : ""}>${
            esc(REMNANT_TYPES[t]?.label ?? t)}</option>`).join("");
        rows.splice(2, 1, editRow(L("DRPG.Investigation.traceType"), `<select name="${esc(name("type"))}">${types}</select>`),
            editRow(L("DRPG.Investigation.room"), `<select name="${esc(name("room"))}"><option value="">${
            esc(L("DRPG.CaseRealize.noRoom"))}</option>${rooms}</select>`));
        rows.push(`<div class="drpg-case-edit-actions"><button type="button" data-drpg-case-place="${esc(`${graph.chapter}:${node.id}`)}">${
            esc(L("DRPG.CaseMap.placeOnMap"))}</button><button type="button" data-drpg-case-drop="${esc(node.id)}">${esc(L("DRPG.CaseMap.removeNode"))}</button></div>`);
        return rows.join("");
    }
    if (node.kind === "counter") {
        const targets = others.filter(n => !n.evidence);
        rows.push(editRow(L("DRPG.CaseMap.field.refutes"), `<div class="drpg-case-checklist">${targets.map(n => box("ref", n, node.refutes.includes(n.id))).join("")
            || `<em>${esc(L("DRPG.CaseMap.nothingToRefute"))}</em>`}</div>`));
    } else {
        const inputs = new Set(node.inputs);
        const candidates = others.filter(n => n.kind !== "solution");
        rows.push(editRow(L("DRPG.CaseMap.field.inputs"), `<div class="drpg-case-checklist">${candidates.map(n => box("in", n, inputs.has(n.id) || (n.trace && inputs.has(n.trace)))).join("")}</div>`));
    }
    rows.push(`<div class="drpg-case-edit-actions"><button type="button" data-drpg-case-drop="${esc(node.id)}">${esc(L("DRPG.CaseMap.removeNode"))}</button></div>`);
    return rows.join("");
}

/** Two field values the same: both blank, or equal as JSON (the Key plan's `same`, investigation.mjs `setKeyPlan`). */
const sameValue = (a, b) => ((a ?? "") === "" && (b ?? "") === "") || JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** The schema's fields the GM changed, read off the form as the Table's are: `[{ chapter, id, fields: { field: { value,
 *  drawn } } }]`, a checklist as the ids ticked now against the ids drawn. */
function readSchemaForm(form) {
    const nodes = new Map();
    const at = (chapter, id) => {
        const k = `${chapter}:${id}`;
        if (!nodes.has(k)) nodes.set(k, { chapter: Number(chapter), id, text: {}, lists: {} });
        return nodes.get(k);
    };
    for (const el of form.querySelectorAll('[name^="case:"]')) {
        const parts = el.getAttribute("name").split(":");
        const [, chapter, id, field] = parts;
        const ref = parts.slice(4).join(":");
        const node = at(chapter, id);
        if (field === "in" || field === "ref") {
            const list = node.lists[field] ??= { now: [], drawn: [], dirty: false };
            if (el.checked) list.now.push(ref);
            if (el.defaultChecked) list.drawn.push(ref);
            if (isDirty(el)) list.dirty = true;
        } else if (isDirty(el)) {
            const held = heldIn(el);
            const value = typeof held === "string" ? held.trim() : held;
            const drawn = drawnOf(el);
            if (!sameValue(value, drawn)) node.text[field] = { value, drawn };
        }
    }
    const out = [];
    for (const node of nodes.values()) {
        const fields = {};
        for (const [field, change] of Object.entries(node.text)) fields[field === "text" ? "gmText" : field] = change;
        for (const [field, list] of Object.entries(node.lists)) {
            if (!list.dirty || sameValue([...list.now].sort(), [...list.drawn].sort())) continue;
            fields[field === "in" ? "inputs" : "refutes"] = { value: list.now, drawn: list.drawn };
        }
        if (Object.keys(fields).length) out.push({ chapter: node.chapter, id: node.id, fields });
    }
    return out;
}

/**
 * The schema's part of the one Save (E97 C6): each node's changed fields written through `setCaseNode` where the GMs'
 * store still holds what the window drew; a field another GM moved meanwhile is refused and named in the Save's
 * permanent warning, as a Remnant's field is. A list keeps what it held beside the drawn ids it did not name (a GM
 * linked an input another GM added under the window: both stay). Answers the refused fields.
 */
async function applySchemaSave(schema = []) {
    const refused = [];
    for (const { chapter, id, fields } of schema) {
        const now = caseNodeOf(caseRows(chapter).rows[id]);
        if (!now) continue;
        const write = {};
        for (const [field, { value, drawn }] of Object.entries(fields)) {
            const key = field === "gmText" ? "text" : field;
            if (key === "inputs" || key === "refutes") {
                const keep = now[key].filter(x => !drawn.includes(x));
                write[key] = [...new Set([...keep, ...value])];
                continue;
            }
            const held = key === "mode" ? (now.mode ?? "") : now[key];
            if (!sameValue(held ?? "", drawn ?? "")) { refused.push({ field, value, row: now.label || id }); continue; }
            write[key] = key === "mode" ? (value || null) : value;
        }
        if (Object.keys(write).length) await setCaseNode(chapter, id, write);
    }
    return refused;
}

/** The chapter's own fields on the Map (E97 C6): the Key limit's override, as the planner draws it, and the Final Truth
 *  Remnant's form (`caseFinalPanel`), in the Map's overview over the graph (the side panel's summary until the E97 fix). */
function mapSummaryEditor({ plan, status, limit, finalRemnants, finalTruthPlacedThisChapter }) {
    const visOptions = REMNANT_VISIBILITY.map(v => `<option value="${v}"${v === "evident" ? " selected" : ""}>${
        esc(REMNANT_VISIBILITY_LABELS[v] ?? v)}</option>`).join("");
    const override = limit !== null ? `<p class="notes">${game.i18n.format("DRPG.Investigation.keyLimitLine", {
        used: Math.min(plan.entries.length, limit), limit, min: KEY_REMNANTS.minimum
    })}</p><label><input type="checkbox" name="keyOverride" /> ${game.i18n.localize("DRPG.Investigation.keyLimitOverride")}</label>` : "";
    return `${override}<h5>${esc(game.i18n.localize("DRPG.Mastermind.finalRemnantsTitle"))}</h5>`
        + caseFinalPanel({ roomOptions: placeRoomOptions(), visOptions, finalRemnants, finalTruthPlacedThisChapter });
}

/** What Save hands back: the three tabs' fields, read fresh off the form. */
function readDashboardForm(d) {
    /*
     * READ FRESH HERE TOO, and the first version of the live
     * rebuild did not - it left `traces` and `plan` behind in
     * `buildCase` and this callback went on naming them. Save
     * threw `ReferenceError: traces is not defined` INSIDE
     * DialogV2's submit, which does not close a window it could
     * not submit, so the dashboard sat there refusing every
     * button including its own X. Dawid found it in a minute.
     *
     * Re-reading is not merely the repair: the region may have
     * been rebuilt since the window opened, so the rows on
     * screen are the ones to walk, not the ones it opened with.
     */
    const traces = allTraces();
    const plan = keyPlan();
    const form = d.element.querySelector("form");
    const q = name => form.querySelector(`[name="${CSS.escape(name)}"]`);
    /* ONLY WHAT THE GM CHANGED, AND WHAT IT WAS DRAWN FROM (E09 C3, S05-26). Every field read
       back as it stood, and Save wrote whatever differed from the world at that moment - so a
       ruling or another GM's Save that merged in under the open window (a GM store write, which
       redrew nothing until C3) differed from the stale field and was written back over. A field
       is handed on now only when the GM changed it, as `{ value, drawn }`: `applyDashboardSave`
       writes it only where the ledger still holds `drawn`. The drawn value is the field's own
       default, which `keepLive` carries across a redraw (live.mjs `drawnOf`). */
    const changed = pairs => {
        const fields = {};
        for (const [field, name] of pairs) {
            const node = q(name);
            if (!node || !isDirty(node)) continue;
            const held = heldIn(node);
            const value = typeof held === "string" ? held.trim() : held;
            const drawn = drawnOf(node);
            if (!same(value, drawn)) fields[field] = { value, drawn };
        }
        return fields;
    };
    return {
        // The Final Key Remnant fields ride the same Save the
        // whole dashboard uses - same reasoning their old home
        // gave for riding Apply: planting the endgame clue must
        // not need a second button to remember.
        finalRoom: q("finalRoom")?.value ?? "",
        finalSceneId: q("finalRoom")?.selectedOptions?.[0]?.dataset.scene ?? "",
        finalVis: q("finalVis")?.value || "evident",
        finalAuthor: q("finalAuthor")?.value ?? "",
        finalName: q("finalName")?.value.trim() ?? "",
        finalText: q("finalText")?.value.trim() ?? "",
        finalAnalysis: q("finalAnalysis")?.value.trim() ?? "",
        finalNote: q("finalNote")?.value.trim() ?? "",
        // ONLY THE ROWS THAT ARE ON SCREEN. The table renders what the
        // filter shows (by default: this chapter), so a trace the filter
        // hides has no fields in the form - and `?? ""` / `?? false` on
        // an absent field read as "blank the name, untie, un-reinforce".
        // Saving with the chapter filter on wiped every earlier chapter's
        // Key Remnants that way.
        traces: traces.filter(({ token, scene }) =>
            q(`name.${rowKey(scene.id, token.id)}`)
        ).map(({ token, scene }) => {
            const key = rowKey(scene.id, token.id);
            return { key, fields: changed(TRACE_FIELDS.map(field => [field, `${field}.${key}`])) };
        }),
        // Every slot, its `fields` empty where nothing changed: `saveKeyPlan` skips those, which
        // is what keeps a Save from filling in the chapter's scales by itself.
        // The case schema's fields (E97 C6), on their nodes on the Map; none in the Table's view.
        schema: readSchemaForm(form),
        keyRows: plan.entries.map((entry, i) => ({
            slot: i, scale: entry.scale,
            fields: changed([
                ["name", `keyname:${i}`], ["text", `keytext:${i}`], ["analysis", `keyanalysis:${i}`],
                ["note", `note:${i}`], ["token", `token:${i}`], ["room", `keyroom:${i}`]
            ])
        }))
    };
}

/**
 * The Key Remnant limit's override: wired, AND applied as it currently stands.
 *
 * The opening roll decides how many Key Remnants a chapter gets, so rows past
 * that number are drawn disabled and the tick box is the GM's explicit "yes, I
 * mean it" rather than a silent cap.
 *
 * BOTH HALVES, BECAUSE A REDRAW ONLY RESTORES ONE OF THEM (F14). This used to be
 * a `change` listener and nothing else, which is right exactly once - on the
 * markup the window opened with. `keepLive` rebuilds this region from
 * `buildCase`, which draws every over-limit row `disabled` again, and then
 * `restore` puts the GM's ticked box back by SETTING `checked` - a property
 * write, which fires no `change` event. So after any redraw at all (a trace
 * found, an actor written, an Eclipse starting) the box read yes and the rows it
 * was the yes for were locked again, and the only way out was to untick and
 * retick.
 *
 * Called from `wireCase`, which `keepLive` runs from its `after` hook - and
 * `after` runs AFTER `restore`, so the state read here is the GM's and not the
 * markup's. That order is load-bearing; see `rebuild` in live.mjs.
 *
 * @param {HTMLElement} root  The dialog element.
 * @returns {boolean} Whether there was an override to wire at all.
 */
export function wireKeyLimitOverride(root) {
    const override = root?.querySelector('[name="keyOverride"]');
    // No limit line means no murder has set one yet, and then no row is over it.
    if (!override) return false;

    const limited = root.querySelectorAll(".drpg-key-limited");
    const apply = () => { for (const el of limited) el.disabled = !override.checked; };
    override.addEventListener("change", apply);
    apply();
    return true;
}

/*
 * WIRED IN A FUNCTION, because `keepLive` replaces this region's DOM
 * and every listener goes with the nodes. A live dashboard whose
 * tabs stopped switching would be a worse window than a stale one.
 */
function wireCase(dialog) {
    const root = dialog.element;
    wirePortraitPickers(root, { defaultImg: ICON });

    // `win` and `app` (E21 C2a): the bar may widen the window, and a press puts it back on the screen (C1b).
    wireKitTabs(root, { win: root, app: dialog });

    // A Key row's Place button (E09 C16). Bound on the nodes, which a redraw replaces.
    for (const button of root.querySelectorAll("[data-drpg-key-place]")) {
        button.addEventListener("click", () => placeKeyRow(root, Number(button.dataset.drpgKeyPlace)));
    }

    // Rows past the opening roll's limit, and the GM's explicit override of it
    // - applied as well as wired, because a redraw restores the tick and not what
    // it unlocked. See `wireKeyLimitOverride`.
    wireKeyLimitOverride(root);

    // A Remnant row's Delete (E44 C8d). Bound on the nodes, which a redraw replaces; the redraw that takes the row away
    // is the ledger's own (the live region watches `remnantStore`, whose row `removeRemnant` tombstones).
    for (const button of root.querySelectorAll("[data-drpg-trace-delete]")) {
        button.addEventListener("click", () => {
            deleteTraceRow(button.dataset.drpgTraceDelete).catch(err => error("Could not delete a Remnant from the dashboard", err));
        });
    }
}

/*
 * A NODE SAVES WHEN ITS EDITING CLOSES (the owner, 12.11.2026: "Moduly przy edycji nie powinny czekac na save, tylko
 * zapisywac sie po zamknieciu edycji"). The open node's fields are read as Save reads the form, scoped to that node's
 * fieldset, and written then: on its Close or Escape, on a pick of another node, on a switch to the Table, and when
 * the window closes (by its X, Escape or a footer button other than Save, whose own write covers every field). One
 * write per close, none per keystroke; the writes run one after another. A field that is written takes its value as
 * drawn, so the Save after it hands nothing on twice; a field the world moved under is refused and told as Save tells
 * it. A write that throws keeps the typed text in its fields, still the GM's change, and says so in one line.
 */
let nodeWrites = Promise.resolve();

/** The open node's changed fields in `root`, written. Answers what `applyDashboardSave` answered, or null. */
function saveOpenNode(root) {
    const open = root?.querySelector?.(".drpg-case-edit:not([hidden])");
    const fields = open ? [...open.querySelectorAll("[name]")].filter(isDirty) : [];
    if (!fields.length) return nodeWrites;
    const result = readDashboardForm({ element: { querySelector: () => open } });
    const drawn = fields.map(field => [field, keepDrawn(field)]);
    const write = () => applyDashboardSave(result, { traces: allTraces(), plan: keyPlan(), quiet: true }).catch(err => {
        for (const [field, was] of drawn) keepDrawn(field, was);
        error("A case node's fields could not be saved", err);
        ui.notifications.error(game.i18n.localize("DRPG.CaseMap.notSaved"));
        return null;
    });
    nodeWrites = nodeWrites.then(write, write);
    return nodeWrites;
}

/** The Map's nodes, fold, overview and camera (E97 C5; on the nodes since the E97 fix): an open node, a fold, the
 *  overview and the camera are the window's own state, the first three redrawn; the focus goes back to the node the GM
 *  was on, which a redraw replaced. */
function wireMap(dialog, reading, refresh) {
    const root = dialog.element;
    const chapterNow = () => Number(root?.querySelector(".drpg-case-live")?.dataset.drpgChapter ?? mapChapterOf(reading).chapter);
    const fail = what => err => error(`The case map could not ${what}`, err);
    wireCaseMap(root, {
        // A pick closes the node open before it, and its fields are written first (the owner, 12.11.2026)
        onPick: id => {
            saveOpenNode(root).then(() => { reading.node = reading.node === id ? null : id; reading.focus = id; refresh(); });
        },
        // Close, Escape on the open node, or a click on the graph's empty space: its fields written, then shut, the
        // focus on its face
        onClose: id => {
            if (reading.node !== id) return;
            saveOpenNode(root).then(() => { reading.node = null; reading.focus = id; refresh(); });
        },
        onFold: () => { reading.fold = !reading.fold; refresh(); },
        onOverview: open => { reading.overview = open; },
        camera: { get: () => reading.camera, set: cam => { reading.camera = cam; } },
        /* ADD, SORT, MOVE, REMOVE: AT ONCE (E97 C6; Q-E97-6's default keeps the fields on Save). A node added is the
           schema's arrangement, as New Remnant's trace is the world's: written now, opened, its fields then edited and
           saved with the rest. The column's order is the GMs' shared arrangement of the map, not a field of a node. */
        onAdd: kind => {
            const id = newCaseNodeId(kind);
            setCaseNode(chapterNow(), id, { kind, label: game.i18n.localize(`DRPG.CaseMap.newLabel.${kind}`) })
                .then(() => { reading.node = id; reading.focus = id; refresh(); }, fail("add a node"));
        },
        onSort: sort => { setCaseMeta(chapterNow(), { sort }).then(() => refresh(), fail("set the column order")); },
        onMove: (id, step) => { reading.focus = id; moveCaseNode(chapterNow(), id, step).then(() => refresh(), fail("move a node")); },
        onDrop: id => dropMapNode(chapterNow(), id).then(gone => { if (gone) { reading.node = null; refresh(); } }, fail("remove a node")),
        // "Check consistency" (Q-C): the overview's list read again now, the overview left open.
        onCheck: () => { reading.overview = true; refresh(); },
        onPlace: ref => {
            const [chapter, id] = ref.split(":");
            placeIncident(Number(chapter), id).then(() => refresh(), fail("place an Incident Remnant"));
        }
    });
    if (reading.focus) {
        root?.querySelector?.(`[data-drpg-node="${CSS.escape(reading.focus)}"]`)?.focus();
        reading.focus = null;
    }
}

/**
 * A PLANNED INCIDENT REMNANT PUT ON THE MAP (E97 C12): New Remnant opened with its room, kind, name and words filled in
 * and tied to the murder; the Remnant it places becomes the node (`trace`). Cancelled, nothing changes. Answers the token.
 */
export async function placeIncident(chapter, id) {
    if (!game.user?.isGM) return null;
    const row = caseNodeOf(caseRows(chapter).rows[id]);
    if (row?.kind !== "incident") return null;
    // the plan's type (13.11.2026); an Incident Remnant is tied to the murder, any other as the GM says in the window
    const type = row.type ?? "incident";
    // its planned room, said in one line when the scene no longer has it (New Remnant then starts on its first room)
    const { allRooms } = await import("./movement.mjs");
    if (row.room && !allRooms(workingScene()).includes(row.room)) ui.notifications.warn(game.i18n.format("DRPG.Investigation.plannedRoomGone", { room: row.room }));
    const token = await openNewTrace({ room: row.room, type, name: row.label, text: row.text, tied: type === "incident" ? "tied" : "" });
    if (token) await setCaseNode(chapter, id, { trace: `${token.parent?.id}.${token.id}` });
    return token;
}

/**
 * A node one place up or down its column (E97 C6, the proposal's arrows; its open fields' buttons since the E97 fix): the column as it is drawn now, the
 * two swapped, and every node of that column given its place in the chapter's `manual` order, the sort set to "manual"
 * so the drawn order is the one kept. A node at the column's end stays.
 */
async function moveCaseNode(chapter, id, step) {
    if (!id || !game.user?.isGM) return;
    const graph = caseGraph(chapter);
    const layout = layoutCase(graph, { sort: graph.meta?.sort, manual: graph.meta?.manual });
    const column = layout.columns.find(c => c.includes(id));
    if (!column) return;
    const at = column.indexOf(id), to = at + step;
    if (to < 0 || to >= column.length || (layout.gapAt !== null && layout.columns[0] === column && (at < layout.gapAt) !== (to < layout.gapAt))) return;
    const order = [...column];
    [order[at], order[to]] = [order[to], order[at]];
    const manual = { ...(graph.meta?.manual ?? {}) };
    order.forEach((nodeId, i) => { manual[nodeId] = i; });
    await setCaseMeta(chapter, { sort: "manual", manual });
}

/** A schema node removed from the case, asked first (E97 C6): what rested on it keeps naming it, and the consistency
 *  check says so (C8). Answers whether it went. */
async function dropMapNode(chapter, id) {
    if (!id || !game.user?.isGM) return false;
    const name = caseNodeOf(caseRows(chapter).rows[id])?.label || id;
    const sure = await drpgConfirm({
        yes: { role: "destructive", label: game.i18n.localize("DRPG.CaseMap.removeNode") },
        no: "cancel",
        title: game.i18n.localize("DRPG.CaseMap.removeNode"),
        classes: ["drpg-panel"],
        body: `<p>${esc(game.i18n.format("DRPG.CaseMap.removeAsk", { name }))}</p>`
    });
    if (!sure) return false;
    await dropCaseNode(chapter, id);
    return true;
}

/**
 * A Remnant deleted from the dashboard's Remnants tab (E44 C8d, 04.11.2026; E44-29, the owner on 1.2.98: "Do
 * investigation (gm panel) dodalbym tez opcje usuwania remnantow"). E60 left the tab with no Delete, since a GM deletes
 * a trace's token on the map (D38 = 1: a trace is its token); the owner wants it here as well. The GM's alone: the
 * dashboard opens for a GM only and this asks `game.user.isGM` before anything; it is no packet and no bridge row, and
 * no module file but this one names it, so a player has no road to it. Asked first, in a window naming the Remnant,
 * as the dashboard's other permanent clean-ups ask; then remnants.mjs `removeRemnant`, the one road that takes the
 * ledger's row and the token together, which refuses a reinforced trace with its notice and keeps both. A row whose
 * trace went meanwhile asks nothing. Answers true when the Remnant went, false when the GM said no or it was refused,
 * null when there was nothing to ask about. Exported for the suite (E44-T10).
 */
export async function deleteTraceRow(key) {
    if (!game.user.isGM || !key) return null;
    const trace = allTraces().find(t => rowKey(t.scene.id, t.token.id) === key);
    if (!trace) return null;
    const name = trace.data.public?.name || traceContextLine(trace.data) || key;
    // A Remnant deleted does not come back (E22 rule 4): destructive, named by its effect, Cancel the default.
    const sure = await drpgConfirm({
        yes: { role: "destructive", label: game.i18n.localize("DRPG.Investigation.deleteTraceTitle") },
        no: "cancel",
        title: game.i18n.localize("DRPG.Investigation.deleteTraceTitle"),
        classes: ["drpg-panel"],
        body: `<p>${esc(game.i18n.format("DRPG.Investigation.deleteTraceAsk", { name }))}</p>`,
        rejectClose: false
    });
    if (!sure) return false;
    return Boolean(await removeRemnant(trace.token));
}

/*
 * A FILTER IS A REBUILD, not a second way of drawing the table.
 *
 * The handler writes the reader's choice down and asks the live
 * region to redraw itself - the same path a trace being found takes,
 * so the scroll, the folded sections, the half-typed fields and the
 * tab that is showing all survive a filter change exactly as they
 * survive anything else. Wiring it after `wireCase` is what keeps it
 * working after that redraw replaces these very selects.
 */
function wireCaseFilters(dialog, reading, refresh) {
    for (const control of dialog.element.querySelectorAll("[data-drpg-filter]")) {
        control.addEventListener("change", () => {
            reading[control.dataset.drpgFilter] = control.value;
            refresh();
        });
    }
}

/**
 * The footer buttons that open something else. Each comes back to the
 * dashboard afterwards, so the GM lands here rather than on the map - the
 * same pattern the GM panel uses for its tiles. Answers false for an action
 * that is none of them, else `{ said }`: what the dashboard it reopens says it
 * did, or null.
 *
 * THE TWO CLEAN-UPS SAY WHAT THEY DID IN THE WINDOW (E51 C5, 31.10.2026; audit
 * S05-55). Clear Faint and Sweep confirmed with the count and toasted the result,
 * and the dashboard came back looking as it did before - the toast gone in
 * seconds. Their count is the dashboard's first line now (`openInvestigationDashboard`'s
 * `said`), over the region a redraw rebuilds, until the window closes. A cancelled
 * or empty one says nothing. `tokens` is the suite's (Clear Faint's own fixtures,
 * remnants.mjs `clearFaintRemnants`); exported for it (tier 2 E51-T15). `actors` is
 * the suite's too, Sweep's students (chapter.mjs `sweepTruthBullets`, E51 fix round FG9):
 * a sweep of the world would take every student's bullets.
 */
export async function runDashboardButton(action, { tokens = null, actors = null } = {}) {
    // N-4: the one road to a trace the GM is simply stating exists. It sits with
    // the sweeps rather than on a tab because it is an action, not a view.
    if (action === "newTrace") {
        await openNewTrace();
        return { said: null };
    }
    if (action === "clearFaint") {
        const cleared = await confirmClearFaint({ tokens });
        return { said: cleared ? plural("DRPG.Panel.faintCleared", { n: cleared }) : null };
    }
    if (action === "sweepBullets") {
        const swept = await confirmSweepBullets({ actors });
        return { said: swept ? plural("DRPG.Panel.sweptBullets", { n: swept }) : null };
    }
    if (action === "autopsy") {
        const { issueAutopsyDialog } = await import("./gm-items.mjs");
        await issueAutopsyDialog();
        return { said: null };
    }
    if (action === "log") {
        const { openObjectionLog } = await import("./trial.mjs");
        await openObjectionLog();
        return { said: null };
    }
    if (action === "bodyFound") {
        const { openBodyDiscoveryDialog } = await import("./chapter.mjs");
        await openBodyDiscoveryDialog();
        return { said: null };
    }
    // E97 C10: the case's realization, its preview first, and its undo (case-realize.mjs; by `import()`: that file reads
    // this one's planner, so a static import here would close a cycle).
    if (action === "realize") {
        const { openRealization } = await import("./case-realize.mjs");
        return { said: await openRealization() };
    }
    if (action === "unrealize") {
        const { confirmUndoRealization } = await import("./case-realize.mjs");
        return { said: await confirmUndoRealization() };
    }
    return false;
}

// The clue first, because it is the half that can fail: a room that no
// longer exists warns and places nothing, and the GM should see that on
// the window they pressed Save on. Same order its old home kept.
// On the scene of the option picked (E12 fix r1-G2): the placement used to look the room's
// name up on the school first, so a GM who picked the Annex's Kitchen got the school's.
async function placeFinalFromDashboard(action) {
    const { placeFinalRemnant } = await import("./mastermind.mjs");
    const placedFinal = await placeFinalRemnant({
        room: action.finalRoom, scene: game.scenes.get(action.finalSceneId) ?? null, visibility: action.finalVis, note: action.finalNote,
        name: action.finalName, text: action.finalText, analysis: action.finalAnalysis, author: action.finalAuthor ?? ""
    });
    if (placedFinal) {
        ui.notifications.info(game.i18n.format("DRPG.Mastermind.finalPlacedIn",
            { room: action.finalRoom }));
    }
}

export async function openInvestigationDashboard({ said = null, node = null, view = null } = {}) {
    // ONE OF THESE, NOT FOUR - see `alreadyOpen` in live.mjs. Two copies of a
    // window each read the world when they opened and neither knows about the
    // other, so the older one goes on looking authoritative while showing
    // something that stopped being true. Raised rather than refused: pressing
    // twice usually means the window is behind something.
    if (alreadyOpen("drpg-window-case")) return RAISED;

    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    // The Final Key Remnant planner lived on the Mastermind screen, where it
    // shared a window with the one secret the module guards hardest - a GM
    // planting the endgame clue had the Mastermind's name on screen every
    // time. It is a tab of the case dashboard now (Dawid, 26.08); the
    // Mastermind screen keeps only the role and the lair.
    const { finalRemnants, finalTruthPlacedThisChapter } = await import("./mastermind.mjs");

    /*
     * THE WHOLE DASHBOARD, REBUILDABLE (E22, measured in E17).
     *
     * This window is open while an incident starts, while players find
     * Truth Bullets, while traces are placed and cleaned. It used to read
     * all of that once and then sit there - measured, byte-identical across
     * an Eclipse starting and ending underneath it.
     *
     * Everything below is a function of the world, so `keepLive` can call it
     * again in place. It is a form, and that is the interesting part: the
     * helper refuses to redraw while the GM has focus inside the region, and
     * carries their scroll, their folded sections, WHICH TAB IS SHOWING and
     * every half-typed field across the rebuild. Without those a live
     * dashboard would be worse than a stale one.
     */
    /*
     * HOW THE TRACE LIST IS BEING READ (Dawid, 28.08).
     *
     * Held here rather than in the DOM, and that is the whole of why it works
     * with a live window: `keepLive` rebuilds the region from `buildCase`, and
     * a rebuild that read the filter off the select would render the list
     * BEFORE `restore` put the select back - one frame of the wrong list every
     * time anything in the world moved. Read from here, the markup and the
     * rows are decided by the same value in the same pass.
     */
    /*
     * A FOURTH AXIS: WHICH CHAPTER (D4).
     *
     * The fog is cumulative and the season is six chapters long, so by the
     * third one this table is mostly other people's old Tuesdays. A GM
     * preparing a trial wants the traces of THIS murder, and until now the only
     * way to get them was to read the context line on every row.
     *
     * Empty means every chapter, like the other two - the filter bar's own
     * idiom, so nothing has to learn a new one.
     */
    // `chapter: null` means "not chosen yet" and is resolved on the first read
    // below. "" is a real value here - it means every chapter.
    /* THE MAP'S OWN (E97 C5): which view, the node the GM picked, whether the unrelated evidence is folded, and the node
       to hand the focus back to after a redraw (keepLive carries a field's focus, not a button's). */
    /* Since the E97 fix: `node` is the node whose fields are open on it, `overview` the chapter's overview strip open,
       `camera` the schema's camera ({ x, y, z }, null until the GM moves it), kept here so a redraw keeps the view. */
    const reading = { order: "room", player: "", room: "", chapter: null, view: node ? "map" : INVESTIGATION_VIEWS.includes(view) ? view : investigationView(), node, fold: false, focus: null,
        overview: false, camera: null };
    /** The live region's handle, so a filter can ask it to redraw. */
    let live = null;
    /** The window's element as drawn: the open node's fields are read off it after the window closed. */
    let drawnRoot = null;

    const buildCase = () => caseHtml(reading, { finalRemnants, finalTruthPlacedThisChapter });

    /* THE FIXED FRAME (E97 C2; the owner's Q-D of 11.11.2026, "one fixed size for both views; a wide table scrolls in its
       own box", and the fixed-layout rule of 10.11: a state changes look, never layout). Above the view, one toolbar row
       of a stated height in two slots: the view switch's (E97 C5) and the view's own controls'. What the button that
       reopened this window did (`runDashboardButton`) is told in the controls' slot, one line, so a said line no longer
       adds a row to the window as it did over the live region until C2. */
    const body = `<div class="drpg-case-toolbar"><div class="drpg-case-switch" data-drpg-slot="switch">${viewSwitchHtml(reading.view)}</div>`
        + `<div class="drpg-case-controls" data-drpg-slot="controls">${said
            ? `<p class="drpg-case-result notes" role="status" title="${esc(said)}">${esc(said)}</p>` : ""}</div></div>${buildCase()}`;

    /* THE FOOTER BY ROLE (E21 C2a, E22): Save the primary; the views and the body secondary; Clear Faint and Sweep,
       which take what cannot be put back, destructive - each asks first (`confirmClearFaint`, `confirmSweepBullets`)
       and is never the default; Cancel, since Save is still to answer (E21 rule 3), its answer "close" as before. */
    const action = await drpgWindow({
        title: game.i18n.localize("DRPG.Investigation.dashboardTitle"),
        classes: ["drpg-panel", "drpg-projects", "drpg-window-case"],
        /* One stated width, the action windows' (ui-columns.mjs WIDE, 1120 px; E97 C2, Q-D). Until C2 the window was
           as wide as its widest table (`fit`, ui-kit.mjs `fitKitWidth`), so its frame followed what it held; the Map
           beside the Table would have moved it at every switch. The kit holds a stated width to the screen less 16 px
           (`kitWidth`). */
        width: WIDE.width,
        body,
        /* The view switch (E97 C5): the kit presses the button (ui-kit.mjs `wireKit`); the choice is written on this GM's
           own User and the region redrawn in the other view, the frame, header and footer untouched (C2). */
        onMode: key => {
            if (!INVESTIGATION_VIEWS.includes(key) || key === reading.view) return;
            // Leaving the Map closes its open node: written first (the owner, 12.11.2026)
            if (reading.view === "map") saveOpenNode(drawnRoot);
            reading.view = key;
            Promise.resolve(game.user.setFlag?.(MODULE_ID, "investigationView", key))
                .catch(err => error("Could not remember the Investigation view on this user", err));
            live?.refresh?.();
        },
        footer: {
            primary: {
                action: "save", label: game.i18n.localize("DRPG.Assign.save"),
                callback: (e, b, d) => readDashboardForm(d)
            },
            secondary: [
            // N-4: the one road to a trace the GM is simply stating exists. Beside
            // the sweeps rather than on a tab, because it is an action rather than a
            // view - the same place "clear the Faint traces" lives.
            { action: "newTrace", label: game.i18n.localize("DRPG.Investigation.newTraceTitle") },
            // The Truth Bullet sweep lands here for the same reason as the rest
            // of this row (Z7): it stopped being a step in the end-of-chapter
            // window, and a clean-up with no button is a clean-up only somebody
            // who reads `api.mjs` can run. (Its button, and Clear Faint's, are destructive: below.)
            // All three used to be tiles in the GM panel, or windows of their
            // own. They belong here: a GM issues the autopsy, reads the
            // evidence log or reports a body while looking at the case, not
            // while deciding which screen to open.
            { action: "autopsy", label: game.i18n.localize("DRPG.TruthBullet.autopsyTitle") },
            { action: "log", label: game.i18n.localize("DRPG.Trial.logTitle") },
            // A STATE CHANGE, NOT ONE MORE VIEW (E09 C16, audit S05-29): the six buttons around it
            // open a window or tidy something; this one starts a case. Its class and icon set it
            // apart in both themes - one of seven equal buttons is what the audit saw.
            { action: "bodyFound", label: game.i18n.localize("DRPG.Chapter.bodyTitle"),
                icon: "fa-solid fa-skull", class: "drpg-state-change" },
            // E97 C10 (Q-C): the realization's preview, in both views; it writes nothing until its own Run.
            { action: "realize", label: game.i18n.localize("DRPG.CaseRealize.preview") }
            ],
            destructive: [
                { action: "clearFaint", label: game.i18n.localize("DRPG.Panel.clearFaint") },
                { action: "sweepBullets", label: game.i18n.localize("DRPG.Panel.sweepBullets") },
                // E97 C10: takes back only what nobody found, asked first
                { action: "unrealize", label: game.i18n.localize("DRPG.CaseRealize.undo") }
            ],
            close: { role: "cancel", action: "close" },
            // Two rows at every width, in both views (E97 C2; the owner's Q-C): the kit's grid footer.
            rows: 2
        },
        render: (event, dialog) => {
            drawnRoot = dialog.element;
            wireCase(dialog);
            wireCaseFilters(dialog, reading, () => live?.refresh?.());
            wireMap(dialog, reading, () => live?.refresh?.());

            /*
             * THE BODY BUTTON IS GREYED WHILE AN ECLIPSE RUNS (F12).
             *
             * "A body is discovered" was a GM panel tile until it moved into this
             * footer, and the greying stayed behind with the tile: the murder tile
             * beside it has carried `disabled: () => isEclipse()` since 28.08, and
             * this button - the other half of the same rule - was lit through an
             * entire Eclipse. `openBodyDiscoveryDialog` refuses the call either way
             * now, but a GM should see WHY before pressing rather than after, which
             * is the reason the murder tile greys instead of refusing on click.
             *
             * NOT IN `wireCase`, AND THAT IS THE POINT. The footer sits outside
             * `.drpg-case-live`, so a rebuild never replaces these nodes - and
             * `keepLive` DEFERS a rebuild while focus is inside the region, so
             * hanging the paint on `after` would leave the button lit for as long
             * as somebody was mid-sentence when the Eclipse started. `keepFresh` is
             * the subscription for exactly this shape: a node nobody edits, written
             * in place, with no focus rule.
             *
             * SAFE TO DISABLE because `save` is the primary, the first button in the
             * kit's tree and the default. Enter in a field presses the FIRST submit in
             * DOM order and a disabled first submit kills Enter outright, so the one
             * button that may never be greyed is the first one.
             */
            const paintBodyButton = () => {
                const button = dialog.element
                    ?.querySelector('footer.form-footer button[data-action="bodyFound"]');
                if (!button) return;
                const locked = isEclipse();
                button.disabled = locked;
                if (locked) button.title = game.i18n.localize("DRPG.Eclipse.bodyLocked");
                else button.removeAttribute("title");
            };
            paintBodyButton();
            keepFresh(dialog, { run: paintBodyButton });
            /*
             * `watch: { actors: true }` as well as the settings, because a Truth
             * Bullet arriving in somebody's bag is an item on an actor, and the
             * "who has what" table at the top of this window is the half a GM
             * looks at while an investigation is running.
             */
            /* ITEMS TOO, AND THE WINDOW WAS BLIND WITHOUT THEM.
               A Truth Bullet is an embedded Item, and every "found by" on all three tabs is
               read off the bullets people hold - so a find, which is the one event a GM has
               this window open to watch, was the one event it could not see. Measured on 10.09:
               a player copied down the Final Remnant, `createItem` fired, and the open dashboard
               went on saying "Nobody has found it" with `refreshes: 0`. A freshly opened copy
               said "Player A", which is how a rendering bug and a liveness bug tell themselves
               apart. The ledger write does not save us either - it is a setting, and no
               `updateSetting` reached the listener for it.

               AND THE TWO GM STORES (E09 C3, S05-26). The ledger and the Key plan are client
               settings now, and their writes - this browser's, and another GM's merged in -
               reach `clientSettingChanged` and nothing else, so a ruling or another GM's Save
               left this window drawing the world from before it, and its Save wrote that back
               over. `stores` hears both (live.mjs `listenFor`). */
            live = keepLive(dialog, {
                region: ".drpg-case-live",
                build: buildCase,
                watch: { actors: true, items: true, stores: [remnantStore, keyPlanStore, caseSchemaStore, blackenedStore, castStore, deathStore] },
                after: () => {
                    wireCase(dialog);
                    wireCaseFilters(dialog, reading, () => live?.refresh?.());
                    wireMap(dialog, reading, () => live?.refresh?.());
                }
            });
        },
        rejectClose: false
    });

    /* CLOSED WITH A NODE OPEN, NOT BY SAVE (the owner, 12.11.2026): its fields written now, off the element as it was
       closed (a closed window's element keeps its fields), before a button's reopened window reads the world. Save
       hands on every changed field, the node's among them, so it writes nothing here. */
    if (!action || typeof action === "string") await saveOpenNode(drawnRoot);
    if (!action || action === "close") return null;

    const ran = await runDashboardButton(action);
    if (ran) return openInvestigationDashboard({ said: ran.said ?? null });

    if (action.finalRoom) await placeFinalFromDashboard(action);

    // `traces` and `plan` read fresh, for the same reason the callback above does: the window
    // has been standing open and rebuilding itself, so what a row is APPLIED to (which token,
    // which stored slot) and what a changed field is checked against are the world now. What
    // the window drew each field from rides in the form itself (E09 C3; until then the
    // `shownTraces`/`shownKeyPlan` snapshots of S1-m7 and E05 C5).
    /* SAVE SAVES AND CLOSES (E24 C6; the owner, 09.11.2026: "Przycisk save nie zamyka okna investigation").
       Since E09 C13 the window reopened itself here so the GM saw the saved state; the owner calls that a
       defect. The six other buttons keep their reopen (`runDashboardButton` above, with `said`). What a Save
       did not save is told by a toast that stays up until the GM dismisses it, so it outlives the window:
       a field refused because the world moved under it (`applyDashboardSave`, its own permanent warning
       with the GM's typed value - the one place that value still exists, which a window redrawn from the
       world would not show), and a Final Key Remnant whose room is gone (mastermind.mjs
       `placeFinalRemnant`, permanent since this commit). A Save that throws part-way is the one case the
       window comes back: what it wrote before the throw stands, nothing else says which fields that was,
       and the window drawn from the world is that list (R1493; tier 2's "the dashboard's Save with a
       change closes it"). */
    try {
        await applyDashboardSave(action, { traces: allTraces(), plan: keyPlan() });
    } catch (err) {
        error("the Investigation dashboard's Save stopped part-way", err);
        ui.notifications.error(game.i18n.format("DRPG.Investigation.saveStopped", { error: err?.message ?? String(err) }), { permanent: true });
        return openInvestigationDashboard();
    }
    return null;
}

/**
 * Commit the dashboard's single Save across all three tabs.
 *
 * `result.traces` and `result.keyRows` hold only the fields the GM changed, each with what the
 * window drew it from (`readDashboardForm`); `traces` and `plan` are the world now. A field is
 * written where the world still holds what was drawn, and refused and told where a ruling or
 * another GM's Save moved it under the open window (E09 C3, S05-26) - the rest of the Save goes
 * on. A field nobody touched is not written at all, which is S1-m7's rule per field: the form's
 * own defaults replaced its `shown` snapshot of the traces as drawn.
 *
 * Exported for the suite, which hands it a synthetic result beside a trace changed as if by
 * another GM: every input it reads is an argument.
 *
 * @returns {Promise<{tracesChanged: number, refused: number}>}
 */
export async function applyDashboardSave(result, { traces, plan, quiet = false }) {
    let tracesChanged = 0;
    const refused = [];
    for (const row of result.traces) {
        const trace = traces.find(t => rowKey(t.scene.id, t.token.id) === row.key);
        if (!trace) continue;
        const { token, data } = trace;
        const take = writable(row.fields, traceShows(data), refused,
            data.public?.name || traceContextLine(data) || row.key);

        const publicPatch = {};
        if ("name" in take) publicPatch.name = take.name;
        if ("img" in take) publicPatch.img = take.img;
        if ("text" in take) publicPatch.playerText = take.text;
        if ("analysis" in take) publicPatch.analyzedText = take.analysis;
        if (Object.keys(publicPatch).length) {
            await setRemnantPublic(token, publicPatch);
            // A human GM has now decided what this trace says, so a player
            // copying it later raises no separate whisper - it goes in the
            // digest with the rest (E7).
            await markRemnantEdited(token);
            tracesChanged++;
        }

        /* THE FOUR VERDICTS AND THE BAND, WRITTEN ONE AT A TIME (S1-m7's second half; the band since E60 C4a). They used to ride
           together: any one of them changing sent all three booleans as the form showed them,
           so ticking Faint on a stale form wrote Tied-to-crime and Reinforced back over another
           GM's verdict of either. `setRemnantFlags` treats a field left out as untouched (see
           there), so a patch of only what was taken leaves the rest alone - the tie's "-" is
           written, as `null` (E09 C4). */
        const flagPatch = {};
        if (take.type) flagPatch.type = take.type;
        // The band (E60 C4a), for a found trace too: written on its row, its copies' left as they were made.
        if ("vis" in take) flagPatch.visibility = take.vis;
        if ("faint" in take) flagPatch.faint = take.faint;
        if ("crime" in take) flagPatch.tiedToCrime = tieTaken(take.crime);
        if ("reinf" in take) flagPatch.reinforced = take.reinf;
        if (Object.keys(flagPatch).length) {
            await setRemnantFlags(token, flagPatch);
            tracesChanged++;
        }
    }

    const { refused: unplanned } = await saveKeyPlan(plan, result.keyRows);
    refused.push(...unplanned);
    refused.push(...await applySchemaSave(result.schema ?? []));

    const parts = [];
    if (tracesChanged) parts.push(plural("DRPG.Investigation.tracesSaved", { n: tracesChanged }));
    // A node's write when its editing closes is said only when it refused something (the owner, 12.11.2026)
    if (parts.length && !quiet) ui.notifications.info(parts.join(" "));

    /* SAID, AND IT STAYS UP. The window closes after a Save (E24 C6; it reopened on the ledger from
       E09 C13 until then), and the GM's own value of a refused field is in no window - this message
       is the only place it still exists, for them to type again, so it waits to be dismissed. */
    if (refused.length) {
        const list = refused.map(r => game.i18n.format("DRPG.Investigation.savedOverItem", {
            field: game.i18n.localize(FIELD_LABELS[r.field]), row: r.row, value: refusedAs(r.field, r.value, traces)
        })).join("; ");
        ui.notifications.warn(plural("DRPG.Investigation.savedOver", { n: refused.length, list }), { permanent: true });
    }
    return { tracesChanged, refused: refused.length };
}
