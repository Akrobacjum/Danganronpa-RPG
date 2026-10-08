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
import { SETTINGS, isEclipse } from "./settings.mjs";
import { getClock } from "./clock.mjs";
import {
    remnantsOn, remnantData, setRemnantFlags, setRemnantPublic, markRemnantEdited,
    confirmClearFaint,
    traceContextLine
} from "./remnants.mjs";
import { bulletsOf, isTruthBullet, secretOf, truthBulletData } from "./truth-bullets.mjs";
import { studentActors } from "./monokuma.mjs";
import { livingStudentsForGm, sweepPlan, sweepTruthBullets } from "./chapter.mjs";
import {
    dialogContent, plural, tableDialog, wirePortraitPickers, whisperToGms, log, isPrimaryGm,
    workingScene, esc, wireDashboardTabs } from "./utils.mjs";
import { alreadyOpen, keepLive, keepFresh, drawnOf, heldIn, isDirty } from "./live.mjs";
import { keyPlanStore, remnantStore } from "./gm-stores.mjs";
import { murderState } from "./incident-store.mjs";
import { bridgeRequest } from "./bridge-guards.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

const ICON = "icons/svg/hazard.svg";

/** The five difficulty steps, named where the scale itself is defined. */
const SCALE_LABELS = KEY_REMNANTS.scaleLabels;

/* ==========================================================================
 * THE PLAN
 * ========================================================================== */

/** A plan row's fields, in the order a row is written. */
const PLAN_FIELDS = ["scale", "name", "text", "analysis", "note", "tokenId", "sceneId"];
const planKey = (chapter, slot) => `${chapter}:${slot}`;
/** A chapter's case row (E09 C6, `recordCaseKeys`): beside its slots, and not one of them. */
const caseKey = chapter => `${chapter}:case`;
const isCaseKey = key => String(key).endsWith(":case");
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
                tokenId: row.tokenId ?? null, sceneId: row.sceneId ?? null
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
    const drop = Object.keys(keyPlanStore.entries()).filter(key => isCaseKey(key) || Number(key.split(":")[0]) !== Number(chapter));
    if (drop.length) await keyPlanStore.dropMany(drop);
    return drop.length;
}

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
    const entries = plan.entries.map(entry => {
        const placed = Boolean(entry.tokenId && onMap.has(entry.tokenId));
        const retyped = Boolean(entry.tokenId && !placed && standing(entry.tokenId));
        const who = entry.tokenId ? Array.from(finders.get(entry.tokenId) ?? []) : [];
        return { ...entry, placed, retyped, finders: who, found: who.length > 0 };
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
     * discovery uses, so last chapter's leftovers cannot pay for this one.
     */
    const planned = new Set(plan.entries.map(e => e.tokenId).filter(Boolean));
    const chapter = getClock().chapter;
    const offPlan = placedKeys
        .filter(r => !planned.has(r.token.id)
            && (r.data?.chapter ?? chapter) === chapter
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
 *          its trace is gone.
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
            const foundIn = trace ? trace.chapter ?? now : secret.chapter ?? null;
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
        await whisperToGms(`<p class="drpg-warning">${plural("DRPG.Case.chargeHeld", { n: fee.held })}</p>`);
        return null;
    }
    const short = fee.short;

    // Stamped even at zero. "Nothing was owed" and "this has not been asked
    // yet" have to stay different states, or a second press would re-ask a
    // question whose answer has since changed - a Key Remnant found during the
    // trial itself would suddenly owe Despair backwards.
    await setTrialProgress({ keysCharged: true });
    if (!short) return null;

    const amount = short * KEY_REMNANTS.unfoundDespair;
    const { adjustDespair, monokumas } = await import("./despair.mjs");
    const paid = [];
    for (const user of monokumas()) {
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
 * @returns {Promise<{entries: Array, created: number, refused: Array}>}
 */
async function saveKeyPlan(plan, rows) {
    // A row with a room chosen and no existing token means "make this one".
    //
    // The planner used to be able to do exactly one thing: point an entry at a
    // Key Remnant somebody had already placed by hand. That is backwards - the
    // plan IS the five clues, written before the murder, and the whole reason a
    // GM opens this screen is to turn them into traces on the map. Marking an
    // existing Prep Remnant as Key also silently rewrote evidence that had
    // already been found.
    const placed = placedKeyRemnants();
    const entries = [];
    const refused = [];
    let created = 0;
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
        for (const field of ["name", "text", "analysis", "note"]) if (field in take) entry[field] = take[field];
        if ("token" in take) Object.assign(entry, { tokenId: tokenId || null, sceneId: sceneId || null });
        if (tokenId || !take.room) {
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
            const token = tokenId ? game.scenes.get(sceneId)?.tokens?.get(tokenId) ?? null : null;
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
            continue;
        }

        const words = field => take[field] ?? now[field];
        const token = await createKeyRemnant({
            scale: row.scale, name: words("name"), text: words("text"), analysis: words("analysis"),
            note: words("note"), createIn: take.room, visibility: row.visibility
        });
        if (token) {
            created += 1;
            entries[row.slot] = stripDraft({
                scale: row.scale, name: words("name"), text: words("text"), analysis: words("analysis"),
                note: words("note"), tokenId: token.id, sceneId: token.parent?.id ?? canvas?.scene?.id ?? null
            });
        } else {
            entries[row.slot] = entry;
        }
    }

    await setKeyPlan({ chapter: plan.chapter, entries });
    return { entries, created, refused };
}

/** The stored shape - the room/visibility pickers are input, not plan data. */
function stripDraft(row) {
    return {
        scale: row.scale, name: row.name ?? "", text: row.text ?? "",
        analysis: row.analysis ?? "", note: row.note ?? "",
        tokenId: row.tokenId ?? null, sceneId: row.sceneId ?? null
    };
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
        token: here ? `${here.token.id}|${here.scene.id}` : ""
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
export async function openNewTrace({ room = null, sceneId = null } = {}) {
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
        .map(([key, def]) => `<option value="${key}"${key === "prep" ? " selected" : ""}>${
            esc(def.label ?? key)}</option>`).join("");
    const visOptions = REMNANT_VISIBILITY.map(v =>
        `<option value="${v}"${v === "evident" ? " selected" : ""}>${
            esc(REMNANT_VISIBILITY_LABELS[v] ?? v)}</option>`).join("");

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Investigation.newTraceTitle") },
        classes: ["drpg-panel", "drpg-window-newtrace"],
        content: dialogContent(`<form>
            <p class="notes">${game.i18n.localize("DRPG.Investigation.newTraceIntro")}</p>
            <label>${game.i18n.localize("DRPG.Investigation.pickRoom")}
                <select name="room">${roomOptions}</select></label>
            <label>${game.i18n.localize("DRPG.Investigation.traceType")}
                <select name="type">${typeOptions}</select></label>
            <label>${game.i18n.localize("DRPG.Investigation.difficulty")}
                <select name="vis">${visOptions}</select></label>
            <label>${game.i18n.localize("DRPG.Investigation.traceName")}
                <input type="text" name="tname" value="" maxlength="60"
                       placeholder="${esc(game.i18n.localize("DRPG.Remnant.tokenName"))}" /></label>
            <label>${game.i18n.localize("DRPG.Investigation.traceText")}
                <input type="text" name="ttext" value="" maxlength="400"
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
                    `<option value="${value}">${esc(game.i18n.localize(label))}</option>`).join("")}</select></label>
            <label class="drpg-checkbox"><input type="checkbox" name="reinforced" />
                ${game.i18n.localize("DRPG.Investigation.newTraceReinforced")}</label>
            <p class="notes">${game.i18n.localize("DRPG.Investigation.newTraceNote")}</p>
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Investigation.createHere"),
                default: true,
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
                        reinforced: f.reinforced.checked
                    };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
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

    const region = Array.from(scene?.regions ?? []).find(r => r.name === result.room);
    if (!region) {
        ui.notifications.warn(game.i18n.format("DRPG.Calls.noSuchRoom", { room: result.room }));
        return null;
    }

    const spot = randomPointIn(region, scene);
    const { placeRemnant } = await import("./remnants.mjs");
    const clock = getClock();
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
async function createKeyRemnant(row, scene = workingScene()) {
    const region = Array.from(scene?.regions ?? []).find(r => r.name === row.createIn);
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
        /* NO `subject`, AND NO `action`. Both were carrying the wrong kind of thing.
           `subject` elsewhere says what a Search was ABOUT, and this put the difficulty label
           in it - so the trace card read "Subject: Standardowa", and worse, `createFind` in
           observe.mjs uses `data.subject` to prefill the name box, so a GM observing a planned
           clue was offered "Standardowa" as its name and one press away from keeping it. The
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
    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Investigation.createHereTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p class="notes">${game.i18n.localize("DRPG.Investigation.createHereIntro")}</p>
            <label>${game.i18n.localize("DRPG.Investigation.room")}
                <select name="room">${roomOptions}</select></label>
            <label>${game.i18n.localize("DRPG.Investigation.visibility")}
                <select name="vis">${visOptions}</select></label>
            <label>${game.i18n.localize("DRPG.Investigation.traceName")}
                <input type="text" name="keyname" value=""
                       placeholder="${esc(game.i18n.localize("DRPG.Remnant.tokenName"))}" /></label>
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
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Investigation.createHere"),
                default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return {
                        room: f.room.value,
                        visibility: f.vis.value,
                        name: f.keyname?.value.trim() ?? "",
                        text: f.keytext?.value.trim() ?? "",
                        analysis: f.keyanalysis?.value.trim() ?? "",
                        note: f.note.value.trim(),
                        slot: f.slot.value === "" ? null : Number(f.slot.value)
                    };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel" || !result.room) return null;

    const scale = result.slot === null
        ? "standard"
        : plan.entries[result.slot]?.scale ?? "standard";

    const token = await createKeyRemnant({
        createIn: result.room, visibility: result.visibility,
        name: result.name, text: result.text, analysis: result.analysis, note: result.note, scale
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
function findersByAnyRemnant() {
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
export async function confirmSweepBullets() {
    if (!game.user.isGM) return 0;

    const { remove, keep } = await sweepPlan();
    const doomed = remove.length;
    const kept = keep.length;

    if (!doomed) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.sweepNone"));
        return 0;
    }

    const sure = await DialogV2.confirm({
        window: { title: game.i18n.localize("DRPG.Panel.sweepBullets") },
        classes: ["drpg-panel"],
        content: dialogContent(`<div>
            <p>${plural("DRPG.Panel.sweepConfirm", { n: doomed })}</p>
            <p class="notes">${game.i18n.format("DRPG.Panel.sweepConfirmNote", { kept })}</p>
        </div>`),
        rejectClose: false
    });
    if (!sure) return 0;

    const { removed } = await sweepTruthBullets();
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

/** Who has what: one row per student, shown whichever tab is open. */
function caseStudentRows(students) {
    return students.map(s => {
        const breakdown = Object.entries(s.types)
            .map(([type, n]) => `${esc(TRUTH_BULLET_TYPES[type]?.label ?? type)} ×${n}`)
            .join(", ");
        return `<tr>
            <td>${esc(s.actor.name)}</td>
            <td>${s.total}</td>
            <td>${s.keys}</td>
            <td>${s.unidentified}</td>
            <td class="notes">${breakdown || "-"}</td>
        </tr>`;
    }).join("");
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
const TRACE_FIELDS = ["img", "name", "text", "analysis", "type", "faint", "crime", "reinf"];

/** What a refusal calls each field: the column it is under. */
const FIELD_LABELS = {
    img: "DRPG.Investigation.traceImage", name: "DRPG.Investigation.traceName",
    text: "DRPG.Investigation.traceText", analysis: "DRPG.Investigation.traceAnalysis",
    type: "DRPG.Investigation.traceType", faint: "DRPG.Remnant.faintColumn",
    crime: "DRPG.Remnant.crimeColumn", reinf: "DRPG.Remnant.reinforcedColumn",
    note: "DRPG.Investigation.keyNoteLabel", token: "DRPG.Investigation.onMap"
};

/** A refused value as the GM typed or picked it: a box, a type, a trace by its name. */
function refusedAs(field, value, traces) {
    if (typeof value === "boolean") return game.i18n.localize(value ? "DRPG.Live.ticked" : "DRPG.Live.unticked");
    if (field === "type") return REMNANT_TYPES[value]?.label ?? value;
    if (field === "crime") return game.i18n.localize(TIE_OPTIONS[value] ?? TIE_OPTIONS[""]);
    if (field === "token") {
        const trace = traces.find(t => `${t.token.id}|${t.scene.id}` === value);
        return trace ? trace.data.public?.name || traceContextLine(trace.data) || value
            : game.i18n.localize("DRPG.Investigation.notPlaced");
    }
    return value;
}

/** One editable row per trace the reader is shown. */
function caseTraceRows(shown, finders) {
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
        return `<tr>
            <td>
                <img src="${esc(shows.img)}" alt="" class="drpg-project-portrait"
                     data-drpg-portrait="${key}" />
                <input type="hidden" name="img.${key}" value="${esc(shows.img)}" data-drpg-drawn="${esc(shows.img)}" />
                <input type="text" name="name.${key}"${aria("DRPG.Investigation.traceName")} value="${esc(shows.name)}" />
                <div class="notes drpg-trace-context">${esc(traceContextLine(data))}</div>
            </td>
            <td><textarea name="text.${key}" rows="2"${aria("DRPG.Investigation.traceText")}>${esc(shows.text)}</textarea></td>
            ${/* The second tier, edited in the same row as the first. Side by
                  side on purpose: the two sentences describe one object and a
                  GM writing the lab reading wants the observation in view, not
                  on another tab. See TRUTH_BULLET_FLAGS.analyzedText for who
                  ever gets to read this one. */ ""}
            <td><textarea name="analysis.${key}" rows="2"${aria("DRPG.Investigation.traceAnalysis")}
                placeholder="${game.i18n.localize("DRPG.TruthBullet.analyzedTextPlaceholder")}"
                >${esc(shows.analysis)}</textarea></td>
            ${/* WHAT IT REALLY IS, CORRECTED BY HAND. The column that used to be
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
                  trace is and a Save leaves it alone. */ ""}
            <td><select name="type.${key}"${aria("DRPG.Investigation.traceType")}>${Object.entries(REMNANT_TYPES)
                .filter(([value]) => findableKind(value) || value === shows.type).map(([value, def]) =>
                `<option value="${esc(value)}"${value === shows.type ? " selected" : ""}>${
                    esc(def.label)}</option>`).join("")}</select></td>
            <td style="text-align:center"><input type="checkbox" name="faint.${key}"${aria("DRPG.Remnant.faintColumn")} ${shows.faint ? "checked" : ""} /></td>
            <td><select name="crime.${key}"${aria("DRPG.Remnant.crimeColumn")}>${Object.entries(TIE_OPTIONS).map(([value, label]) =>
                `<option value="${value}"${value === shows.crime ? " selected" : ""}>${esc(game.i18n.localize(label))}</option>`).join("")}</select></td>
            <td style="text-align:center"><input type="checkbox" name="reinf.${key}"${aria("DRPG.Remnant.reinforcedColumn")} ${shows.reinf ? "checked" : ""} /></td>
            <td>${found}</td>
        </tr>`;
    }).join("");
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

/** The Traces tab: the filter bar, the rule, and the table or the reason it is empty. */
function caseTracesPanel({ traces, shown, finders, reading }) {
    const traceRows = caseTraceRows(shown, finders);
    return `<div data-drpg-panel="traces">
        ${caseTraceFilters(traces, shown, reading)}
        <p class="notes drpg-clue-rule">${
            game.i18n.localize("DRPG.Investigation.neverOnePerson")}</p>
        ${shown.length ? `<table class="drpg-vault-table"><thead><tr>
            <th>${game.i18n.localize("DRPG.Investigation.traceName")}</th>
            <th>${game.i18n.localize("DRPG.Investigation.traceText")}</th>
            <th>${game.i18n.localize("DRPG.Investigation.traceAnalysis")}</th>
            <th>${game.i18n.localize("DRPG.Investigation.traceType")}</th>
            <th>${game.i18n.localize("DRPG.Remnant.faintColumn")}</th>
            <th>${game.i18n.localize("DRPG.Remnant.crimeColumn")}</th>
            <th>${game.i18n.localize("DRPG.Remnant.reinforcedColumn")}</th>
            <th>${game.i18n.localize("DRPG.Investigation.foundBy")}</th>
        </tr></thead><tbody>${traceRows}</tbody></table>`
            : `<p class="notes">${game.i18n.localize(traces.length
                ? "DRPG.Investigation.noneMatch" : "DRPG.Investigation.noTraces")}</p>`}
    </div>`;
}

/**
 * The planner's rows: one per planned Key Remnant, with the placed traces to
 * pick from.
 *
 * Exported for the suite, which hands it a synthetic plan and a synthetic
 * placed trace: every input it reads is an argument, so the one thing worth
 * testing about it - that a placed row's pickers say what is on the map - can
 * be measured without writing anything to the world.
 */
export function caseKeyRows({ plan, status, placed, limit, roomOptionsFor, visOptionsFor }) {
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
        const state = !entry.tokenId
            ? `<em>${game.i18n.localize("DRPG.Investigation.notPlaced")}</em>`
            : !st.placed
                ? `<strong>${game.i18n.localize(st.retyped ? "DRPG.Investigation.keyRetyped" : "DRPG.Investigation.tokenGone")}</strong>`
                : st.found
                    ? esc(st.finders.join(", "))
                    : `<em>${game.i18n.localize("DRPG.Investigation.notFound")}</em>`;

        /* Named for a screen reader: the column, and which of the planned clues this
           row is. The headers name them only for the eye (21.09, the a11y sweep). */
        const aria = (...keys) => ` aria-label="${esc(
            `${keys.map(k => game.i18n.localize(k)).join(": ")} - ${i + 1}`)}"`;
        return `<tr${overLimit ? ' style="opacity:.6"' : ""}>
            <td><strong>${esc(SCALE_LABELS[entry.scale] ?? entry.scale)}</strong></td>
            <td><input type="text" name="keyname:${i}"${aria("DRPG.Investigation.traceName")} value="${esc(shows.name)}"
                placeholder="${game.i18n.localize("DRPG.Remnant.tokenName")}" /></td>
            <td><textarea name="keytext:${i}" rows="2"${aria("DRPG.Investigation.traceText")}
                placeholder="${game.i18n.localize("DRPG.Investigation.notePlaceholder")}">${
                esc(shows.text)}</textarea>
                ${context ? `<div class="notes drpg-trace-context">${esc(context)}</div>` : ""}</td>
            ${/* The second tier, as on the Traces tab (21.09). A placed row falls back
                  on the trace's own reading: a plan saved before this column existed
                  holds none, and an empty box would read as "nothing written". */ ""}
            <td><textarea name="keyanalysis:${i}" rows="2"${aria("DRPG.Investigation.traceAnalysis")}
                placeholder="${game.i18n.localize("DRPG.TruthBullet.analyzedTextPlaceholder")}">${
                esc(shows.analysis)}</textarea></td>
            <td><input type="text" name="note:${i}"${aria("DRPG.Investigation.keyNoteLabel")} value="${esc(shows.note)}"
                placeholder="${game.i18n.localize("DRPG.Investigation.keyNotePlaceholder")}" /></td>
            <td>
                <select name="token:${i}"${aria("DRPG.Investigation.onMap")}>
                    <option value=""${live ? "" : " selected"}>${
                        game.i18n.localize("DRPG.Investigation.notPlaced")}</option>
                    ${picker}
                </select>
            </td>
            <td>
                <select name="room:${i}"${aria("DRPG.Investigation.createHere", "DRPG.Vault.room")} class="${overLimit ? "drpg-key-limited" : ""}"${
                    here || overLimit ? " disabled" : ""}>
                    ${here ? "" : `<option value="">${game.i18n.localize("DRPG.Investigation.pickRoom")}</option>`}
                    ${roomOptionsFor(here?.room ?? null)}
                </select>
                <select name="vis:${i}"${aria("DRPG.Investigation.createHere", "DRPG.Investigation.difficulty")} class="${overLimit ? "drpg-key-limited" : ""}"${
                    here || overLimit ? " disabled" : ""}>${visOptionsFor(here?.visibility ?? null)}</select>
            </td>
            <td>${state}</td>
        </tr>`;
    }).join("");
}

/** The Key Remnants tab: the planner and its warnings. */
function caseKeyPanel({ plan, status, placed, limit, roomOptionsFor, visOptionsFor }) {
    const keyRows = caseKeyRows({ plan, status, placed, limit, roomOptionsFor, visOptionsFor });
    // The guide's floor is three Key Remnants; the plan's own warning threshold
    // is one above it, so a GM is told the trial is getting thin BEFORE it is
    // actually unsolvable rather than at the moment it already is.
    const thin = status.foundAny < KEY_REMNANTS.minimum + 1;
    return `<div data-drpg-panel="key" style="display:none">
        <p>${game.i18n.format("DRPG.Investigation.plannerIntro", {
            chapter: plan.chapter, n: KEY_REMNANTS.prepared,
            min: KEY_REMNANTS.suspectRange[0], max: KEY_REMNANTS.suspectRange[1]
        })}</p>
        <p>${game.i18n.format("DRPG.Investigation.keySummary", {
            found: status.found, placed: status.placed, total: status.entries.length
        })}</p>
        ${status.offPlan.length ? `<p class="notes">${plural("DRPG.Investigation.keyOffPlan", {
            n: status.offPlan.length,
            names: esc(status.offPlan.map(r => r.name || game.i18n.localize("DRPG.Remnant.cardTitle")).join(", "))
        })}</p>` : ""}
        ${thin ? `<p class="drpg-warning">${game.i18n.format("DRPG.Investigation.tooThin", {
            found: status.foundAny, min: KEY_REMNANTS.minimum
        })}</p>` : ""}
        ${limit !== null ? `<p class="notes">${game.i18n.format("DRPG.Investigation.keyLimitLine", {
            used: Math.min(plan.entries.length, limit), limit, min: KEY_REMNANTS.minimum
        })}</p>
        <label><input type="checkbox" name="keyOverride" /> ${
            game.i18n.localize("DRPG.Investigation.keyLimitOverride")}</label>` : ""}
        <table class="drpg-vault-table"><thead><tr>
            <th>${game.i18n.localize("DRPG.Investigation.difficulty")}</th>
            <th>${game.i18n.localize("DRPG.Investigation.traceName")}</th>
            <th>${game.i18n.localize("DRPG.Investigation.traceText")}</th>
            <th>${game.i18n.localize("DRPG.Investigation.traceAnalysis")}</th>
            <th>${game.i18n.localize("DRPG.Investigation.keyNoteLabel")}</th>
            <th>${game.i18n.localize("DRPG.Investigation.onMap")}</th>
            <th>${game.i18n.localize("DRPG.Investigation.createHere")}</th>
            <th>${game.i18n.localize("DRPG.Investigation.foundBy")}</th>
        </tr></thead><tbody>${keyRows}</tbody></table>
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
               the answer is. */
            const old = placed.filter(r => r.data.chapter != null
                && r.data.chapter !== plan.chapter).length;
            return old ? `<p class="notes drpg-warning">${
                game.i18n.format("DRPG.Investigation.leftoverKeys", { n: old })}</p>` : "";
        })()}
    </div>`;
}

/** The Final Key Remnant tab: what is placed, who has it, and the form to plant one. */
function caseFinalPanel({ roomOptions, visOptions, finalRemnants, finalTruthPlacedThisChapter }) {
    return `<div data-drpg-panel="final" style="display:none">
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
                : `<p class="notes">${game.i18n.localize("DRPG.Mastermind.noFinals")}</p>`;
        })()}
        <p class="notes${finalTruthPlacedThisChapter() ? "" : " drpg-warning"}">${game.i18n.localize(
            finalTruthPlacedThisChapter() ? "DRPG.Mastermind.finalTruthPlaced"
                : "DRPG.Mastermind.finalTruthReminder")}</p>
        <label>${game.i18n.localize("DRPG.Investigation.room")}
            <select name="finalRoom">
                <option value="">-</option>
                ${roomOptions}
            </select></label>
        <label>${game.i18n.localize("DRPG.Investigation.visibility")}
            <select name="finalVis">${visOptions}</select></label>
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
        <p class="notes">${game.i18n.localize("DRPG.Mastermind.finalAddNote")}</p>
    </div>`;
}

/** The whole dashboard as markup - a function of the world, so `keepLive` can call it again. */
function caseHtml(reading, { allRooms, finalRemnants, finalTruthPlacedThisChapter }) {
    const students = evidenceByStudent();
    const traces = allTraces();
    const finders = findersByAnyRemnant();
    const plan = keyPlan();
    const status = keyPlanStatus();
    const rooms = allRooms();
    // The opening roll's own limit on how many Key Remnants this chapter gets
    // - `null` before a murder has happened, meaning "no limit yet, plan
    // freely". See `def.keyRemnants` in config.mjs and `caseKeyCount`, which
    // keeps it past the incident's close (E09 C6).
    const limit = caseKeyCount(plan.chapter);

    /* THE TWO PICKERS SAY WHAT IS THERE, NOT WHAT THE LAST DEFAULT WAS.
       -----------------------------------------------------------------------
       Both used to be one string built here and stamped into every row, with
       `selected` hardcoded on "evident" and no room chosen at all. On an EMPTY
       row that is right: they are an input, "create this one here, this
       visible", and Evident is the sensible default.

       On a row whose Key Remnant is already ON THE MAP it was a lie, and the
       one the GM reported (16.09): a clue placed as Subtle showed "Evident" in
       its own row, and one placed in the Kitchen showed "Pick a room". The
       picker is not even an input there - `applyDashboardSave` leaves rows that
       already point at a token alone, which the note under the table says - so
       it was a control that did nothing, reading out a value nobody had chosen.

       So a placed row's pickers are the TRACE's own room and visibility,
       selected and disabled: a fact rather than a control. An empty row keeps
       the input it was. */
    const roomOptionsFor = chosen => rooms.map(r =>
        `<option value="${esc(r)}"${r === chosen ? " selected" : ""}>${esc(r)}</option>`).join("");
    const visOptionsFor = chosen => REMNANT_VISIBILITY.map(v =>
        `<option value="${v}"${v === (chosen || "evident") ? " selected" : ""}>${
            esc(REMNANT_VISIBILITY_LABELS[v] ?? v)}</option>`).join("");

    const studentRows = caseStudentRows(students);
    const shown = readTracesAs(traces, reading);
    const placed = placedKeyRemnants();

    return `<div class="drpg-case-live"><form>
        <h4>${game.i18n.localize("DRPG.Investigation.whoHasWhat")}</h4>
        <table class="drpg-vault-table"><thead><tr>
            <th>${game.i18n.localize("DRPG.Investigation.student")}</th>
            <th>${game.i18n.localize("DRPG.Investigation.bullets")}</th>
            <th>${game.i18n.localize("DRPG.Investigation.keysHeld")}</th>
            <th>${game.i18n.localize("DRPG.Investigation.unidentified")}</th>
            <th>${game.i18n.localize("DRPG.Investigation.breakdown")}</th>
        </tr></thead><tbody>${studentRows}</tbody></table>

        <nav class="drpg-dashboard-tabs">
            <button type="button" class="drpg-dashboard-tab active" data-drpg-tab="traces">${
                game.i18n.localize("DRPG.Investigation.tabTraces")}</button>
            <button type="button" class="drpg-dashboard-tab" data-drpg-tab="key">${
                game.i18n.localize("DRPG.Investigation.tabKeyRemnants")}</button>
            <button type="button" class="drpg-dashboard-tab" data-drpg-tab="final">${
                game.i18n.localize("DRPG.Mastermind.finalRemnantsTitle")}</button>
        </nav>

        ${caseTracesPanel({ traces, shown, finders, reading })}

        ${caseKeyPanel({ plan, status, placed, limit, roomOptionsFor, visOptionsFor })}

        ${caseFinalPanel({
            /* The Final Key Remnant is always an input - it is being placed, not
               read back - so it takes the plain lists: every room, none chosen,
               and Evident as the default. */
            roomOptions: roomOptionsFor(null), visOptions: visOptionsFor(null),
            finalRemnants, finalTruthPlacedThisChapter })}

    </form></div>`;
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
        finalVis: q("finalVis")?.value || "evident",
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
        keyRows: plan.entries.map((entry, i) => ({
            slot: i, scale: entry.scale, visibility: q(`vis:${i}`)?.value || "evident",
            fields: changed([
                ["name", `keyname:${i}`], ["text", `keytext:${i}`], ["analysis", `keyanalysis:${i}`],
                ["note", `note:${i}`], ["token", `token:${i}`], ["room", `room:${i}`]
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

    wireDashboardTabs(root);

    // Rows past the opening roll's limit, and the GM's explicit override of it
    // - applied as well as wired, because a redraw restores the tick and not what
    // it unlocked. See `wireKeyLimitOverride`.
    wireKeyLimitOverride(root);
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
 * same pattern the GM panel uses for its tiles. Answers whether it handled one.
 */
async function runDashboardButton(action) {
    // N-4: the one road to a trace the GM is simply stating exists. It sits with
    // the sweeps rather than on a tab because it is an action, not a view.
    if (action === "newTrace") {
        await openNewTrace();
        return true;
    }
    if (action === "clearFaint") {
        await confirmClearFaint();
        return true;
    }
    if (action === "sweepBullets") {
        await confirmSweepBullets();
        return true;
    }
    if (action === "autopsy") {
        const { issueAutopsyDialog } = await import("./gm-items.mjs");
        await issueAutopsyDialog();
        return true;
    }
    if (action === "log") {
        const { openObjectionLog } = await import("./trial.mjs");
        await openObjectionLog();
        return true;
    }
    if (action === "bodyFound") {
        const { openBodyDiscoveryDialog } = await import("./chapter.mjs");
        await openBodyDiscoveryDialog();
        return true;
    }
    return false;
}

// The clue first, because it is the half that can fail: a room that no
// longer exists warns and places nothing, and the GM should see that on
// the window they pressed Save on. Same order its old home kept.
async function placeFinalFromDashboard(action) {
    const { placeFinalRemnant } = await import("./mastermind.mjs");
    const placedFinal = await placeFinalRemnant({
        room: action.finalRoom, visibility: action.finalVis, note: action.finalNote,
        name: action.finalName, text: action.finalText, analysis: action.finalAnalysis
    });
    if (placedFinal) {
        ui.notifications.info(game.i18n.format("DRPG.Mastermind.finalPlacedIn",
            { room: action.finalRoom }));
    }
}

export async function openInvestigationDashboard() {
    // ONE OF THESE, NOT FOUR - see `alreadyOpen` in live.mjs. Two copies of a
    // window each read the world when they opened and neither knows about the
    // other, so the older one goes on looking authoritative while showing
    // something that stopped being true. Raised rather than refused: pressing
    // twice usually means the window is behind something.
    if (alreadyOpen("drpg-window-case")) return null;

    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const { allRooms } = await import("./movement.mjs");
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
    const reading = { order: "room", player: "", room: "", chapter: null };
    /** The live region's handle, so a filter can ask it to redraw. */
    let live = null;

    const buildCase = () => caseHtml(reading, { allRooms, finalRemnants, finalTruthPlacedThisChapter });

    const content = dialogContent(buildCase());

    const action = await tableDialog({
        window: { title: game.i18n.localize("DRPG.Investigation.dashboardTitle") },
        classes: ["drpg-panel", "drpg-projects", "drpg-window-case"],
        content,
        buttons: [
            {
                action: "save", label: game.i18n.localize("DRPG.Assign.save"), default: true,
                callback: (e, b, d) => readDashboardForm(d)
            },
            // N-4: the one road to a trace the GM is simply stating exists. Beside
            // the sweeps rather than on a tab, because it is an action rather than a
            // view - the same place "clear the Faint traces" lives.
            { action: "newTrace", label: game.i18n.localize("DRPG.Investigation.newTraceTitle") },
            { action: "clearFaint", label: game.i18n.localize("DRPG.Panel.clearFaint") },
            // The Truth Bullet sweep lands here for the same reason as the rest
            // of this row (Z7): it stopped being a step in the end-of-chapter
            // window, and a clean-up with no button is a clean-up only somebody
            // who reads `api.mjs` can run.
            { action: "sweepBullets", label: game.i18n.localize("DRPG.Panel.sweepBullets") },
            // All three used to be tiles in the GM panel, or windows of their
            // own. They belong here: a GM issues the autopsy, reads the
            // evidence log or reports a body while looking at the case, not
            // while deciding which screen to open.
            { action: "autopsy", label: game.i18n.localize("DRPG.TruthBullet.autopsyTitle") },
            { action: "log", label: game.i18n.localize("DRPG.Trial.logTitle") },
            { action: "bodyFound", label: game.i18n.localize("DRPG.Chapter.bodyTitle") },
            { action: "close", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        render: (event, dialog) => {
            wireCase(dialog);
            wireCaseFilters(dialog, reading, () => live?.refresh?.());

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
             * SAFE TO DISABLE because `save` is the first entry in `buttons` and
             * carries `default: true`. Enter in a field presses the FIRST submit in
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
                watch: { actors: true, items: true, stores: [remnantStore, keyPlanStore] },
                after: () => { wireCase(dialog); wireCaseFilters(dialog, reading, () => live?.refresh?.()); }
            });
        },
        rejectClose: false
    });

    if (!action || action === "close") return null;

    if (await runDashboardButton(action)) return openInvestigationDashboard();

    if (action.finalRoom) await placeFinalFromDashboard(action);

    // `traces` and `plan` read fresh, for the same reason the callback above does: the window
    // has been standing open and rebuilding itself, so what a row is APPLIED to (which token,
    // which stored slot) and what a changed field is checked against are the world now. What
    // the window drew each field from rides in the form itself (E09 C3; until then the
    // `shownTraces`/`shownKeyPlan` snapshots of S1-m7 and E05 C5).
    await applyDashboardSave(action, { traces: allTraces(), plan: keyPlan() });
    return openInvestigationDashboard();
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
 * @returns {Promise<{tracesChanged: number, created: number, refused: number}>}
 */
export async function applyDashboardSave(result, { traces, plan }) {
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

        /* THE FOUR VERDICTS, WRITTEN ONE AT A TIME (S1-m7's second half). They used to ride
           together: any one of them changing sent all three booleans as the form showed them,
           so ticking Faint on a stale form wrote Tied-to-crime and Reinforced back over another
           GM's verdict of either. `setRemnantFlags` treats a field left out as untouched (see
           there), so a patch of only what was taken leaves the rest alone - the tie's "-" is
           written, as `null` (E09 C4). */
        const flagPatch = {};
        if (take.type) flagPatch.type = take.type;
        if ("faint" in take) flagPatch.faint = take.faint;
        if ("crime" in take) flagPatch.tiedToCrime = tieTaken(take.crime);
        if ("reinf" in take) flagPatch.reinforced = take.reinf;
        if (Object.keys(flagPatch).length) {
            await setRemnantFlags(token, flagPatch);
            tracesChanged++;
        }
    }

    const { created, refused: unplanned } = await saveKeyPlan(plan, result.keyRows);
    refused.push(...unplanned);

    const parts = [];
    if (tracesChanged) parts.push(plural("DRPG.Investigation.tracesSaved", { n: tracesChanged }));
    if (created) parts.push(plural("DRPG.Investigation.plannerCreated", { n: created }));
    if (parts.length) ui.notifications.info(parts.join(" "));

    /* SAID, AND IT STAYS UP. The window reopens on the ledger after a Save, so a refused field
       comes back showing what the world holds and the GM's own value is gone from it - this
       message is the only place it still exists, for them to type again. */
    if (refused.length) {
        const list = refused.map(r => game.i18n.format("DRPG.Investigation.savedOverItem", {
            field: game.i18n.localize(FIELD_LABELS[r.field]), row: r.row, value: refusedAs(r.field, r.value, traces)
        })).join("; ");
        ui.notifications.warn(plural("DRPG.Investigation.savedOver", { n: refused.length, list }), { permanent: true });
    }
    return { tracesChanged, created, refused: refused.length };
}
