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
 *
 * E54 (the plan's K1): the Key Remnants - the plan and its store, the fee, the placing road - live in key-remnants.mjs,
 * re-exported here; this file keeps `openNewTrace` and the dashboard.
 */

import { MODULE_ID, KEY_REMNANTS, TRUTH_BULLET_TYPES, OBSERVE_DC, REMNANT_TYPES, TRIAL, REMNANT_VISIBILITY, REMNANT_VISIBILITY_LABELS, TIMES_OF_DAY, observeDc, RECIPIENT_EVERYONE } from "./config.mjs";
import { isEclipse, sameSeason, bodiesFoundIn } from "./settings.mjs";
import { getClock } from "./clock.mjs";
import { remnantsOn, remnantData, setRemnantFlags, setRemnantPublic, markRemnantEdited, shownBand, bandOptions, removeRemnant, traceContextLine, traceLabel, authorOptions } from "./remnants.mjs";
import { bulletsOf, isTruthBullet, secretOf, truthBulletData } from "./truth-bullets.mjs";
import { studentActors } from "./monokuma.mjs";
import { itemsHeldNow } from "./sheet-audit.mjs";
import { livingStudentsForGm, sweepPlan, sweepTruthBullets } from "./chapter.mjs";
import { plural, wirePortraitPickers, log, workingScene, esc, placeRoomOptions, listOf, error } from "./utils.mjs";
import { kitTabs, wireKitTabs, emptyOption, drpgWindow, drpgConfirm, box, dataTable } from "./ui-kit.mjs";
import { WIDE, columnsHtml } from "./ui-columns.mjs";
import { caseGraph, caseRows, caseNodeOf, caseModes, PLANNED_TYPES, AUTOPSY_MAX, autopsyNumber, autopsyPresetOf, bodiesInOrder, caseMetaOf, setCaseNode, setCaseMeta, dropCaseNode, newCaseNodeId, CASE_SORTS, reachability, checkCase } from "./case-schema.mjs";
import { layoutCase } from "./case-layout.mjs";
import { caseMapHtml, wireCaseMap, glyphHtml, editRow, caseToolsHtml } from "./case-map.mjs";
import { alreadyOpen, keepLive, keepFresh, drawnOf, heldIn, isDirty, keepDrawn, RAISED } from "./live.mjs";
import { keyPlanStore, remnantStore, caseSchemaStore, blackenedStore, castStore, deathStore, diveSetStore } from "./gm-stores.mjs";
import { murderState, blackenedIds, killerIds } from "./incident-store.mjs";

import { roomRegions } from "./rooms.mjs";
// A leaf (season-exceptions.mjs alone): the registry of season state the reset walks (E42 C3).
import { PLANNED_GLYPH, randomPointIn, SCALE_LABELS, keyRowShows, keyPlan, caseKeyCount, placedKeyRemnants, keyPlanStatus, same, placeKeyRow, saveKeyPlan, writable } from "./key-remnants.mjs";
export { keyRevealRecord, recordKeyRevealed, keyPlan, setKeyPlan, archiveKeyPlan, liftKeyPlan, clearKeyPlan, keepOnlyKeyPlanChapter, clearSeasonKeyPlan, recordCaseKeys, caseKeyCount, keysToPlace, keyPlanStatus, missingKeyRows, keyFeeOf, chargeForUnfoundKeys, askToChargeForUnfoundKeys, randomPointIn, openKeyRemnantHere, placeInSlot, placeKeyRow } from "./key-remnants.mjs";

/**
 * A KEY SLOT NOT YET PLACED PLANS WHAT ITS PLACE ASKS AND WHAT THE REMNANT CARRIES (E104; the owner, 13.11.2026:
 * "lokalizacje, trudnosc i wszystkie parametry"): its visibility (with the Key column, how hard it is to find; the Place
 * window's own field and words), who left it (New Remnant's field) and its picture (the Table's). Beside its planned
 * room, in the slot's status cell, on the Table and in the slot's node on the Map.
 */
function keyPlanExtras(i, shows, aria) {
    const L = key => game.i18n.localize(key);
    const vis = REMNANT_VISIBILITY.map(v => `<option value="${v}"${v === (shows.vis ?? "evident") ? " selected" : ""}>${
        esc(REMNANT_VISIBILITY_LABELS[v] ?? v)}</option>`).join("");
    const img = shows.img || "";
    /* THE PICTURE'S FIELD IS `keypicture:<slot>`, NOT `keyimg:`: R503's census of the room tile's roads reads every form field
       whose name ends in "img:" as a room picture's (Room Setup's `img:<room>`), and this is a Remnant's.
       Each with its word over it: in the slot's status cell, beside the Remnant picker and Place, a bare select did not say
       which of the four it was (the review page's shots, 13.11.2026) */
    const field = (key, html) => `<label class="drpg-key-plan-field"><span class="notes">${esc(L(key))}</span>${html}</label>`;
    return field("DRPG.Investigation.visibility", `<select name="keyvis:${i}"${aria("DRPG.Investigation.visibility")}>${vis}</select>`)
        + field("DRPG.Remnant.authorLabel", `<select name="keyauthor:${i}"${aria("DRPG.Remnant.authorLabel")}>${authorOptions(shows.author || null, studentActors())}</select>`)
        + `<div class="drpg-key-plan-field"><span class="notes">${esc(L("DRPG.CaseMap.field.img"))}</span><img src="${esc(img || PLANNED_GLYPH)}" alt="" title="${
            esc(L("DRPG.CaseMap.field.img"))}" class="drpg-project-portrait" data-drpg-portrait="key-${i}" data-drpg-portrait-field="keypicture:${i}" /><input type="hidden" name="keypicture:${i}" value="${
            esc(img)}" data-drpg-drawn="${esc(img)}" /></div>`;
}


/* New Remnant's width (E64-inv round 2): its two columns at 1366x768 in both themes, measured in Chromium (the fit pass). */
const NEW_TRACE_WIDTH = 900;

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
export async function openNewTrace({ room = null, sceneId = null, type = null, name = "", text = "", tied = "", author: plannedAuthor = "", vis = "evident",
    reinforced = false, analysis = "", note = "", img = "", askRoom = false } = {}) {
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

    /* A plan with no room (E104) starts on "pick a room", which Create refuses, instead of the scene's first room */
    const roomOptions = (askRoom ? `<option value="" selected>${esc(game.i18n.localize("DRPG.CaseMap.pickRoom"))}</option>` : "") + rooms.map(r =>
        `<option value="${esc(r)}"${r === room && !askRoom ? " selected" : ""}>${esc(r)}</option>`).join("");
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
        `<option value="${v}"${v === (REMNANT_VISIBILITY.includes(vis) ? vis : "evident") ? " selected" : ""}>${
            esc(REMNANT_VISIBILITY_LABELS[v] ?? v)}</option>`).join("");

    // The room's field is labelled "Room" (E09 C14, 08.10.2026; audit S05-35): it borrowed
    // `pickRoom`, the empty option of the Remnants tab's room select, and read "- create in -".
    const result = await drpgWindow({
        title: game.i18n.localize("DRPG.Investigation.newTraceTitle"),
        classes: ["drpg-panel", "drpg-window-newtrace"],
        /* TWO COLUMNS (E64-inv round 2, 12.11.2026; the coordinator's ask after the Investigation review): in one column
           of the kit's default width the window scrolled 61 px under Stained Glass at 1366x768 (audit/style-sweep.mjs
           `--fit`, STILL `new-trace`). Where and what the trace is on the left, what a student reads on the right
           (ui-columns.mjs `columnsHtml`), in a stated width the kit holds under the screen. */
        width: NEW_TRACE_WIDTH,
        body: `<form>
            <p class="notes">${game.i18n.localize("DRPG.Investigation.newTraceIntro")}</p>
            ${columnsHtml([`
            <label>${game.i18n.localize("DRPG.Investigation.room")}
                <select name="room">${roomOptions}</select></label>
            <label>${game.i18n.localize("DRPG.Investigation.traceType")}
                <select name="type">${typeOptions}</select></label>
            <label>${game.i18n.localize("DRPG.Remnant.authorLabel")}
                <select name="author">${authorOptions(plannedAuthor || null, studentActors())}</select></label>
            <label>${game.i18n.localize("DRPG.Investigation.visibility")}
                <select name="vis">${visOptions}</select></label>
            <label>${game.i18n.localize("DRPG.Investigation.newTraceTied")}
                <select name="tied">${Object.entries(TIE_OPTIONS).map(([value, label]) =>
                    `<option value="${value}"${value === tied ? " selected" : ""}>${esc(game.i18n.localize(label))}</option>`).join("")}</select></label>
            <label class="drpg-checkbox"><input type="checkbox" name="reinforced"${reinforced ? " checked" : ""} />
                ${game.i18n.localize("DRPG.Investigation.newTraceReinforced")}</label>`, `
            <label>${game.i18n.localize("DRPG.Investigation.traceName")}
                <input type="text" name="tname" value="${esc(name ?? "")}" maxlength="60"
                       placeholder="${esc(traceLabel(null))}" /></label>
            <label>${game.i18n.localize("DRPG.Investigation.traceText")}
                <input type="text" name="ttext" value="${esc(text ?? "")}" maxlength="400"
                       placeholder="${esc(game.i18n.localize(
                           "DRPG.Investigation.notePlaceholder"))}" /></label>
            <label>${game.i18n.localize("DRPG.Investigation.traceAnalysis")}
                <input type="text" name="tanalysis" value="${esc(analysis ?? "")}" maxlength="400"
                       placeholder="${esc(game.i18n.localize(
                           "DRPG.TruthBullet.analyzedTextPlaceholder"))}" /></label>
            <label>${game.i18n.localize("DRPG.Investigation.keyNoteLabel")}
                <input type="text" name="note" value="${esc(note ?? "")}"
                       placeholder="${esc(game.i18n.localize(
                           "DRPG.Investigation.keyNotePlaceholder"))}" /></label>
            <p class="notes">${game.i18n.localize("DRPG.Investigation.newTraceNote")}</p>`])}
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
    // and a planned picture (E104), the Table's field, which New Remnant itself does not ask
    if (result.name || result.text || result.analysis || img) {
        await setRemnantPublic(token, {
            ...(result.name ? { name: result.name } : {}),
            ...(result.text ? { playerText: result.text } : {}),
            ...(result.analysis ? { analyzedText: result.analysis } : {}),
            ...(img ? { img } : {})
        });
    }
    log(`Case panel: a ${result.type} trace placed by hand in ${result.room}.`);
    ui.notifications.info(game.i18n.format("DRPG.Investigation.newTraceDone", {
        room: result.room,
        type: REMNANT_TYPES[result.type]?.label ?? result.type
    }));
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
                }, {}),
                // By name (E64-inv): what the Map's list of each student reads (`studentsListHtml`), for the one table.
                named: bullets.map(b => ({ name: b.item.name, real: secretOf(b.item.uuid).realType ?? null })),
                items: (actor.items?.contents ?? [...(actor.items ?? [])]).filter(i => !isTruthBullet(i)).map(i => i.name)
            };
        });
}

/**
 * The Truth Bullet sweep, asked for by a person (Z7).
 *
 * The twin of `confirmClearFaint` in remnants.mjs, and deliberately the same
 * shape: count first, say the number, take the answer, report what happened.
 * Neither has a button since E64-inv (End the chapter runs both clean-ups,
 * chapter.mjs `chapterEndForm`); both stay the confirmed road scenario 62 and
 * the suite sweep through.
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

    // `actors`: the students to count and sweep, every one where unsaid (the suite's).
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
 * the head "Really" with its tooltip (S12-52: it is what the bullets are by the GMs' answer key), each bullet by name
 * since E64-inv; then the other items by name (E64-inv). Every head of the dashboard's tables is cut at two lines with its
 * whole name in `title` (`lines: 2`; under Legacy's pixel face a one-word head such as "Reinforced" is as wide as the
 * column) - but the last two, short words, the Breakdown's tooltip the sentence. Exported for R2067.
 */
function caseStudentColumns() {
    const L = key => game.i18n.localize(key);
    return [
        { key: "student", label: L("DRPG.Investigation.student"), cls: "case-student", lines: 2 },
        { key: "bullets", label: L("DRPG.Investigation.bullets"), num: true, cls: "case-count", lines: 2 },
        { key: "keys", label: L("DRPG.Investigation.keysHeld"), num: true, cls: "case-count", lines: 2 },
        { key: "unidentified", label: L("DRPG.Investigation.unidentified"), num: true, cls: "case-count", lines: 2 },
        { key: "breakdown", label: L("DRPG.Investigation.breakdown"), cls: "case-breakdown" },
        { key: "items", label: L("DRPG.CaseMap.studentItems"), cls: "case-items" }
    ];
}

/**
 * WHO HAS WHAT as the kit's table. "Really" read as nothing at a table (S12-52): its head carries the tooltip that says
 * it is what the bullets are by the GMs' answer key, whatever their holders were shown - written on the kit's head (no
 * builder of the kit names a head's tooltip; a dataTable head's markup is fixed, `<th scope="col" class="...">`).
 * Exported for R2067.
 */
export function caseStudentTable(students) {
    /* ONE VIEW (E64-inv, 12.11.2026; the owner's pick of the Investigation review): the tab drew this table and, under
       it, the same students again by name (`studentsListHtml`, the Map's list). The names are the table's cells now - a
       line per Truth Bullet with what it really is, the other items by name - so the counts and the names are one row a
       student. Not cut at two lines, as the Breakdown's kinds were: a list a GM reads whole. */
    const line = parts => (parts.length ? parts.join("<br>") : "-");
    const rows = students.map(s => {
        const breakdown = (s.named ?? []).map(b => {
            const kind = b.real ? (TRUTH_BULLET_TYPES[b.real]?.label ?? b.real) : "";
            return `${esc(b.name)}${kind ? ` <span class="notes">(${esc(kind)})</span>` : ""}`;
        });
        return { student: esc(s.actor.name), bullets: String(s.total), keys: String(s.keys),
            unidentified: String(s.unidentified), breakdown: line(breakdown), items: line((s.items ?? []).map(esc)) };
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
        img: data.public?.img || PLANNED_GLYPH,
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
/* The same three in the Remnants table's narrow column (E64-inv): "?", "Yes", "No" under the column's head, which names the tie. */
const TIE_SHORT = Object.freeze({ "": "DRPG.Remnant.tieShortOpen", tied: "DRPG.Remnant.tieShortTied", untied: "DRPG.Remnant.tieShortUntied" });
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
            /* THE KIND'S OWN WORD IN THE CELL (E64-inv, 12.11.2026): "Prep Remnant" was wider than the 9 % column, cut under
               Stained Glass and drawn over the next cell under Monokuma Legacy (Chromium, 1366x768 and 1920x1080, both
               languages). Every option is a Remnant, so the column says the kind alone ("Prep", "Final Truth"); New
               Remnant's window keeps the whole name. */
            type: `<select name="type.${key}"${aria("DRPG.Investigation.traceType")}>${Object.entries(REMNANT_TYPES)
                .filter(([value]) => findableKind(value) || value === shows.type).map(([value, def]) =>
                `<option value="${esc(value)}"${value === shows.type ? " selected" : ""}>${
                    esc(String(def.label).replace(/ Remnant$/, ""))}</option>`).join("")}</select>`,
            /* HOW HARD IT IS TO SPOT, FOR EVERY TRACE (E60 C4a, 03.11.2026; the owner's ask of 28.10, Q-E60-3's
               alternative): the band Observe reads its number from, found or not - a found trace's copies keep
               the band they were made with (remnants.mjs `setRemnantFlags`). */
            vis: `<select name="vis.${key}"${aria("DRPG.Investigation.visibility")}>${bandOptions(shows.vis)}</select>`,
            // the two checkboxes centred by the column's rule (components.css `drpg-data-col-case-check`), not inline
            faint: `<input type="checkbox" name="faint.${key}"${aria("DRPG.Remnant.faintColumn")} ${shows.faint ? "checked" : ""} />`,
            // the tie's short words in the cell (E64-inv, as the kind's above): "- nie rozstrzygnięto -" ran 178 px past it
            crime: `<select name="crime.${key}"${aria("DRPG.Remnant.crimeColumn")}>${Object.entries(TIE_SHORT).map(([value, label]) =>
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
function caseKeyColumns() {
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
                ${here ? "" : `<label class="drpg-key-plan-field"><span class="notes">${esc(game.i18n.localize("DRPG.Investigation.plannedRoom"))}</span><select name="keyroom:${i}"${
                    aria("DRPG.Investigation.plannedRoom")} data-drpg-scene-drawn="${esc(shows.scene ?? "")}"><option value="">${
                    esc(game.i18n.localize("DRPG.CaseRealize.noRoom"))}</option>${placeRoomOptions({ room: shows.room, sceneId: shows.scene })}</select></label>`}
                ${here ? "" : keyPlanExtras(i, shows, aria)}
                ${here ? "" : `<button type="button" name="place:${i}" data-drpg-key-place="${i}"${
                    aria("DRPG.Investigation.place")} class="drpg-key-place${overLimit ? " drpg-key-limited" : ""}"${
                    overLimit ? " disabled" : ""}>${game.i18n.localize("DRPG.Investigation.place")}</button>`}`
        };
    });
}

/**
 * The warning that the case is getting thin (E66 C3; S13-29, E66-14): a plural family on the Key Remnants found, and
 * its own sentence for none, which the family's "Only 0 Key Remnants" was. Exported for R1156.
 */
export function tooThinLine(found) {
    return found > 0
        ? plural("DRPG.Investigation.tooThin", { found, min: KEY_REMNANTS.minimum }, "found")
        : game.i18n.format("DRPG.Investigation.tooThinNone", { min: KEY_REMNANTS.minimum });
}

/**
 * The Key Remnants tab: the planner and its warnings.
 */
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
              html: `<div data-drpg-part="who">${caseStudentTable(students)}</div>` }
        ])}
    </form></div>`;
}

/**
 * THE VIEW THIS GM OPENS ON (E97 C5; the owner's Q-B, 11.11.2026: "the Map/Table switch is remembered per GM account, a
 * flag on their own user"). "map" or "table", read off the GM's own User; anything else - no flag yet - reads "map"
 * since C9 (the owner's E: "Map by default"; Q-E: the parity test green, R3653, and the owner shown both views, round
 * 1 of 12.11.2026). Not a secret: world-secrets.mjs forbids one User flag only (`preSessionNote.text`).
 */
const INVESTIGATION_VIEWS = Object.freeze(["map", "table"]);
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
    // the planned Autopsy's node, empty until written, as the slots are: the chapter now running's (13.11.2026)
    /* 13.11.2026: as many as the chapter plans (`autopsyCount`); a chapter not running draws those its GM wrote, up to
       its count, and the ones that went out (case-schema.mjs `graphOf`) */
    const written = Object.keys(caseRows(chapter).rows).map(autopsyNumber).filter(n => n !== null);
    const autopsies = chapter === plan.chapter ? autopsyCount(chapter)
        : Math.min(caseMetaOf(caseRows(chapter).meta).autopsies ?? AUTOPSY_MAX, Math.max(0, ...written));
    const graph = caseGraph(chapter, { chapters, slots: chapter === plan.chapter ? slots : null, autopsy: autopsies });
    for (const n of graph.nodes) if (n.kind === "autopsy") n.of = autopsies;
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
 * Whether a student holds an Autopsy Truth Bullet of `chapter` (moved from gm-panel.mjs on 13.11.2026: the planned
 * Autopsy reads it too, case-realize.mjs `sendPlannedAutopsy`, and gm-panel.mjs imports this file), by the GMs' answer keys (`secretOf`: the
 * real type and the chapter `createTruthBullet` wrote with it) over the items as the GMs hold them
 * (`itemsHeldNow`, the key fee's reading in `keyFeeOf`). GM-side; a player's console cannot write an answer key.
 * Of this season (E11 fix r2-H2; round 1's res R6, round 2's goal S06-42): a reset that keeps the Truth
 * Bullets starts again at chapter 1, and last season's chapter-1 autopsy read as issued, so the new
 * chapter's line never asked for one. An autopsy's answer key names its season since (truth-bullets.mjs
 * `createTruthBullet`, a copy its original's); one issued before 1.2.73 names none and is read by its chapter alone, as before (`sameSeason`; tier 2
 * "this season's chapter reads none of last season's Key Remnants nor its autopsy nor its silence").
 */
export function autopsyIssued(chapter) {
    return studentActors().some(actor => itemsHeldNow(actor).some(item => {
        if (!isTruthBullet(item)) return false;
        const secret = secretOf(actor.items.get(item.id)?.uuid);
        return secret.realType === "autopsy" && Number(secret.chapter) === Number(chapter) && sameSeason(secret);
    }));
}

/**
 * HOW MANY AUTOPSIES THE CHAPTER PLANS (the owner, 13.11.2026: "gm mial preset pokazujacy ile powinno tego byc, ale by
 * mogl zrobic ostatecznie ile chce"): the count the GM wrote on the first planned Autopsy (the meta row's `autopsies`),
 * else the preset (`autopsyPreset`). On a GM; read off the GMs' case store.
 */
export function autopsyCount(chapter) {
    return caseMetaOf(caseRows(chapter).meta).autopsies ?? autopsyPreset(chapter);
}

/** The preset (case-schema.mjs `autopsyPresetOf`): one a body - this season's bodies found in the chapter, and the open
 *  incident's victim where the incident is the chapter's - and one where the chapter has none yet. */
export function autopsyPreset(chapter) {
    const live = murderState();
    const own = live?.victimId && (live.chapter === undefined || live.chapter === null || Number(live.chapter) === Number(chapter));
    return autopsyPresetOf({ found: bodiesInOrder(bodiesFoundIn(chapter)), victimId: own ? live.victimId : null });
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
            const secret = secretOf(item.uuid);
            /* an Autopsy's node is held by whoever holds this chapter's Autopsy of its name (13.11.2026; several a chapter
               since the owner's 13.11), and one of no planned name by the first */
            const id = secret.realType === "autopsy" && Number(secret.chapter) === Number(graph.chapter) && sameSeason(secret)
                ? autopsyHolderNode(graph, item.name)
                // a planned Truth Bullet given by hand (E104): held by whoever holds one of its name with no Remnant behind it
                : !secret.remnantId ? graph.nodes.find(n => n.kind === "bullet" && n.sent && n.label && n.label === item.name)?.id ?? null
                : byToken.get(secret.remnantId);
            if (!id) continue;
            if (!holders.has(id)) holders.set(id, new Set());
            holders.get(id).add(actor.id);
        }
    }
    const culprits = caseCulprits(graph.chapter);
    for (const set of holders.values()) for (const c of culprits.slice(1)) set.delete(c);
    return reachability(graph, holders, { culpritId: culprits[0] ?? null, living: livingStudentsForGm().map(a => a.id) });
}

/** The planned Autopsy's node a held Autopsy of `name` stands for: the one planned under that name (its default name where
 *  none is written), else the chapter's first; null where the graph draws none. */
function autopsyHolderNode(graph, name) {
    const nodes = graph.nodes.filter(n => n.kind === "autopsy").sort((a, b) => a.n - b.n);
    const named = nodes.find(n => (n.label || TRUTH_BULLET_TYPES.autopsy.label) === name);
    return (named ?? nodes[0])?.id ?? null;
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
    for (const node of graph.nodes) if (!node.evidence || (node.planned && ["incident", "autopsy", "final", "bullet"].includes(node.kind))) add(node.id, schemaEditor(graph, node));
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
    const F = (key, data) => game.i18n.format(key, data);
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
        editRow(L("DRPG.CaseMap.field.mode"), `<select name="${esc(name("mode"))}">${modes.join("")}</select>`),
        ...zoneRows(node, name)
    ];
    if (node.kind === "autopsy") {
        /* THE PLANNED AUTOPSY (13.11.2026): the GM panel's Autopsy window's three fields, and whether it went out. It goes to
           every living student when the body is found (case-realize.mjs `sendPlannedAutopsy`); sent, its fields stay, read
           as what was planned. */
        const at = node.atBody ?? node.n ?? 1;
        const said = node.sent ? L("DRPG.CaseMap.autopsySent") : F("DRPG.CaseMap.autopsyWhen", { n: at });
        /* SEVERAL A CHAPTER (the owner, 13.11.2026): which body sends this one (its own number by default), and on the
           first, how many the chapter plans - the preset named beside it (investigation.mjs `autopsyCount`, `autopsyPreset`) */
        const bodies = Array.from({ length: AUTOPSY_MAX }, (_, i) => i + 1).map(k => `<option value="${k}"${k === at ? " selected" : ""}>${
            esc(F("DRPG.CaseMap.autopsyBody", { n: k }))}</option>`).join("");
        const count = node.n === 1 ? (() => {
            const chapter = Number(graph.chapter);
            const now = autopsyCount(chapter);
            const options = Array.from({ length: AUTOPSY_MAX }, (_, i) => i + 1).map(k => `<option value="${k}"${k === now ? " selected" : ""}>${k}</option>`).join("");
            return editRow(L("DRPG.CaseMap.autopsyCount"), `<select name="${esc(name("autopsies"))}">${options}</select>`)
                + `<p class="notes">${esc(F("DRPG.CaseMap.autopsyPreset", { n: autopsyPreset(chapter) }))}</p>`;
        })() : "";
        return [
            `<p class="drpg-case-info-note">${esc(said)}</p>`,
            count,
            editRow(L("DRPG.CaseMap.autopsyAt"), `<select name="${esc(name("atBody"))}">${bodies}</select>`),
            editRow(L("DRPG.TruthBullet.name"), `<input type="text" name="${esc(name("label"))}" value="${esc(node.label)}" placeholder="${
                esc(L("DRPG.TruthBullet.autopsyNamePlaceholder"))}" />`),
            editRow(L("DRPG.TruthBullet.playerText"), `<textarea name="${esc(name("text"))}" rows="3" placeholder="${
                esc(L("DRPG.TruthBullet.autopsyTextPlaceholder"))}">${esc(node.text)}</textarea>`),
            editRow(L("DRPG.TruthBullet.gmNote"), `<textarea name="${esc(name("note"))}" rows="2">${esc(node.note ?? "")}</textarea>`)
        ].join("");
    }
    if (node.kind === "bullet") {
        /* A PLANNED TRUTH BULLET MADE BY HAND (E104; the owner, 13.11.2026: "kazdemu zaplanowanemu remnantowi/bulletowi"):
           the Give Truth Bullet window's Write new fields in its order and words (gm-items.mjs `bulletCreatePane`: name,
           real type, shown as, visibility, Faint, tied, the player's words, the analysis, the GM's note), its picture as a
           planned Remnant has (1.2.113; the owner's "yes", 13.11.2026), then its recipient rows (who gets it, Tell the
           player). Give opens that window filled in (`placeIncident` -> `givePlannedBullet`), the picture with it. */
        const types = Object.entries(TRUTH_BULLET_TYPES).map(([key, t]) => `<option value="${key}"${key === (node.realType ?? "neutral") ? " selected" : ""}>${
            esc(t.label)}</option>`).join("");
        const shown = [["auto", "DRPG.TruthBullet.shownAuto"], ["neutral", "DRPG.TruthBullet.shownNeutral"], ["real", "DRPG.TruthBullet.shownReal"]]
            .map(([v, k]) => `<option value="${v}"${v === (node.shown ?? "auto") ? " selected" : ""}>${esc(L(k))}</option>`).join("");
        const vis = REMNANT_VISIBILITY.map(v => `<option value="${v}"${v === (node.vis ?? "evident") ? " selected" : ""}>${
            esc(REMNANT_VISIBILITY_LABELS[v] ?? v)}</option>`).join("");
        const check = (field, key, on) => editRow(L(key), `<input type="checkbox" name="${esc(name(field))}" aria-label="${esc(L(key))}"${on ? " checked" : ""} />`);
        const recipients = `<option value=""${node.recipient ? "" : " selected"}>${esc(L("DRPG.CaseMap.noRecipient"))}</option>`
            + studentActors().map(a => `<option value="${esc(a.id)}"${a.id === node.recipient ? " selected" : ""}>${esc(a.name)}</option>`).join("")
            // every living student, a copy each (1.2.113; config.mjs `RECIPIENT_EVERYONE`)
            + `<option value="${RECIPIENT_EVERYONE}"${node.recipient === RECIPIENT_EVERYONE ? " selected" : ""}>${esc(L("DRPG.Items.everyone"))}</option>`;
        return [
            ...(node.sent ? [`<p class="drpg-case-info-note">${esc(L("DRPG.CaseMap.bulletGiven"))}</p>`] : []),
            editRow(L("DRPG.TruthBullet.name"), `<input type="text" name="${esc(name("label"))}" value="${esc(node.label)}" placeholder="${
                esc(L("DRPG.TruthBullet.namePlaceholder"))}" />`),
            editRow(L("DRPG.TruthBullet.realType"), `<select name="${esc(name("realType"))}">${types}</select>`),
            editRow(L("DRPG.TruthBullet.shown"), `<select name="${esc(name("shown"))}">${shown}</select>`),
            editRow(L("DRPG.TruthBullet.visibility"), `<select name="${esc(name("vis"))}">${vis}</select>`),
            check("faint", "DRPG.TruthBullet.faintField", node.faint === true),
            check("tied", "DRPG.TruthBullet.tiedField", node.tied === true),
            editRow(L("DRPG.TruthBullet.playerText"), `<textarea name="${esc(name("text"))}" rows="2" placeholder="${
                esc(L("DRPG.TruthBullet.playerTextPlaceholder"))}">${esc(node.text)}</textarea>`),
            editRow(L("DRPG.TruthBullet.analyzedText"), `<textarea name="${esc(name("analysis"))}" rows="2" placeholder="${
                esc(L("DRPG.TruthBullet.analyzedTextPlaceholder"))}">${esc(node.analysis ?? "")}</textarea>`),
            editRow(L("DRPG.TruthBullet.gmNote"), `<textarea name="${esc(name("note"))}" rows="2" placeholder="${
                esc(L("DRPG.TruthBullet.gmNotePlaceholder"))}">${esc(node.note ?? "")}</textarea>`),
            editRow(L("DRPG.CaseMap.field.img"), `<img src="${esc(node.img || PLANNED_GLYPH)}" alt="" title="${esc(L("DRPG.CaseMap.field.img"))}" class="drpg-project-portrait" data-drpg-portrait="${
                esc(node.id)}" data-drpg-portrait-field="${esc(name("img"))}" /><input type="hidden" name="${esc(name("img"))}" value="${esc(node.img ?? "")}" data-drpg-drawn="${esc(node.img ?? "")}" />`),
            editRow(L("DRPG.Items.recipient"), `<select name="${esc(name("recipient"))}">${recipients}</select>`),
            check("tell", "DRPG.Items.tellPlayer", node.tell !== false),
            `<div class="drpg-case-edit-actions"><button type="button" data-drpg-case-place="${esc(`${graph.chapter}:${node.id}`)}">${
                esc(L("DRPG.TruthBullet.give"))}</button><button type="button" data-drpg-case-drop="${esc(node.id)}">${esc(L("DRPG.CaseMap.removeNode"))}</button></div>`
        ].join("");
    }
    if (node.kind === "final") {
        /* A PLANNED FINAL TRUTH (E104; the owner, 13.11.2026: "kazdy rodzaj i kazdy szczegol"): the Final Truth form's
           fields, in its order and words (`caseFinalPanel`: room, visibility, who left it, name, words, analysis, the GM's
           note), and the Table's picture; kept until its Place puts it on the map (`placeIncident`). */
        const vis = REMNANT_VISIBILITY.map(v => `<option value="${v}"${v === (node.vis ?? "evident") ? " selected" : ""}>${
            esc(REMNANT_VISIBILITY_LABELS[v] ?? v)}</option>`).join("");
        const img = node.img || "";
        return [
            editRow(L("DRPG.Investigation.room"), `<select name="${esc(name("room"))}" data-drpg-scene-drawn="${esc(node.scene ?? "")}"><option value="">${
                esc(L("DRPG.Mastermind.finalPickRoom"))}</option>${placeRoomOptions({ room: node.room, sceneId: node.scene })}</select>`),
            editRow(L("DRPG.Investigation.visibility"), `<select name="${esc(name("vis"))}">${vis}</select>`),
            editRow(L("DRPG.Remnant.authorLabel"), `<select name="${esc(name("author"))}">${authorOptions(node.author || null, studentActors())}</select>`),
            editRow(L("DRPG.Investigation.traceName"), `<input type="text" name="${esc(name("label"))}" value="${esc(node.label)}" placeholder="${
                esc(L("DRPG.Remnant.finalSubject"))}" />`),
            editRow(L("DRPG.Investigation.traceText"), `<textarea name="${esc(name("text"))}" rows="3" placeholder="${
                esc(L("DRPG.Investigation.notePlaceholder"))}">${esc(node.text)}</textarea>`),
            editRow(L("DRPG.Investigation.traceAnalysis"), `<textarea name="${esc(name("analysis"))}" rows="2" placeholder="${
                esc(L("DRPG.TruthBullet.analyzedTextPlaceholder"))}">${esc(node.analysis ?? "")}</textarea>`),
            editRow(L("DRPG.Investigation.keyNoteLabel"), `<textarea name="${esc(name("note"))}" rows="2" placeholder="${
                esc(L("DRPG.Investigation.finalNotePlaceholder"))}">${esc(node.note ?? "")}</textarea>`),
            editRow(L("DRPG.CaseMap.field.img"), `<img src="${esc(img || PLANNED_GLYPH)}" alt="" title="${esc(L("DRPG.CaseMap.field.img"))}" class="drpg-project-portrait" data-drpg-portrait="${
                esc(node.id)}" data-drpg-portrait-field="${esc(name("img"))}" /><input type="hidden" name="${esc(name("img"))}" value="${esc(img)}" data-drpg-drawn="${esc(img)}" />`),
            `<div class="drpg-case-edit-actions"><button type="button" data-drpg-case-place="${esc(`${graph.chapter}:${node.id}`)}">${
                esc(L("DRPG.CaseMap.placeOnMap"))}</button><button type="button" data-drpg-case-drop="${esc(node.id)}">${esc(L("DRPG.CaseMap.removeNode"))}</button></div>`
        ].join("");
    }
    if (node.kind === "incident") {
        /* A PLANNED REMNANT (E97 C12; its type 13.11.2026): EVERY FIELD NEW REMNANT ASKS, IN ITS ORDER AND ITS WORDS (E104;
           the owner, 13.11.2026: "niech pozwala przypisac od razu lokalizacje, trudnosc i wszystkie parametry"; the
           default "the planner's editor shows the same fields, same order and same words as the real creation window").
           `openNewTrace`'s left column - room (on its scene), type, who left it, band, the tie, reinforced - then its
           right - name, words, analysis, the GM's note - and the Table's picture. Place hands every one to New Remnant
           (`placeIncident`). */
        const types = PLANNED_TYPES.map(t => `<option value="${esc(t)}"${t === (node.type ?? "incident") ? " selected" : ""}>${
            esc(REMNANT_TYPES[t]?.label ?? t)}</option>`).join("");
        const vis = REMNANT_VISIBILITY.map(v => `<option value="${v}"${v === (node.vis ?? "evident") ? " selected" : ""}>${
            esc(REMNANT_VISIBILITY_LABELS[v] ?? v)}</option>`).join("");
        const ties = Object.entries(TIE_OPTIONS).map(([value, label]) => `<option value="${value}"${value === (node.tie ?? "") ? " selected" : ""}>${
            esc(L(label))}</option>`).join("");
        const img = node.img || "";
        return [
            editRow(L("DRPG.Investigation.room"), `<select name="${esc(name("room"))}" data-drpg-scene-drawn="${esc(node.scene ?? "")}"><option value="">${
                esc(L("DRPG.CaseRealize.noRoom"))}</option>${placeRoomOptions({ room: node.room, sceneId: node.scene })}</select>`),
            editRow(L("DRPG.Investigation.traceType"), `<select name="${esc(name("type"))}">${types}</select>`),
            editRow(L("DRPG.Remnant.authorLabel"), `<select name="${esc(name("author"))}">${authorOptions(node.author || null, studentActors())}</select>`),
            editRow(L("DRPG.Investigation.visibility"), `<select name="${esc(name("vis"))}">${vis}</select>`),
            editRow(L("DRPG.Investigation.newTraceTied"), `<select name="${esc(name("tie"))}">${ties}</select>`),
            editRow(L("DRPG.Investigation.newTraceReinforced"), `<input type="checkbox" name="${esc(name("reinforced"))}" aria-label="${
                esc(L("DRPG.Investigation.newTraceReinforced"))}"${node.reinforced ? " checked" : ""} />`),
            editRow(L("DRPG.Investigation.traceName"), `<input type="text" name="${esc(name("label"))}" value="${esc(node.label)}" maxlength="60" placeholder="${
                esc(traceLabel(null))}" />`),
            editRow(L("DRPG.Investigation.traceText"), `<textarea name="${esc(name("text"))}" rows="3" maxlength="400" placeholder="${
                esc(L("DRPG.Investigation.notePlaceholder"))}">${esc(node.text)}</textarea>`),
            editRow(L("DRPG.Investigation.traceAnalysis"), `<textarea name="${esc(name("analysis"))}" rows="2" maxlength="400" placeholder="${
                esc(L("DRPG.TruthBullet.analyzedTextPlaceholder"))}">${esc(node.analysis ?? "")}</textarea>`),
            editRow(L("DRPG.Investigation.keyNoteLabel"), `<textarea name="${esc(name("note"))}" rows="2" placeholder="${
                esc(L("DRPG.Investigation.keyNotePlaceholder"))}">${esc(node.note ?? "")}</textarea>`),
            editRow(L("DRPG.CaseMap.field.img"), `<img src="${esc(img || PLANNED_GLYPH)}" alt="" title="${esc(L("DRPG.CaseMap.field.img"))}" class="drpg-project-portrait" data-drpg-portrait="${
                esc(node.id)}" data-drpg-portrait-field="${esc(name("img"))}" /><input type="hidden" name="${esc(name("img"))}" value="${esc(img)}" data-drpg-drawn="${esc(img)}" />`),
            `<div class="drpg-case-edit-actions"><button type="button" data-drpg-case-place="${esc(`${graph.chapter}:${node.id}`)}">${
                esc(L("DRPG.CaseMap.placeOnMap"))}</button><button type="button" data-drpg-case-drop="${esc(node.id)}">${esc(L("DRPG.CaseMap.removeNode"))}</button></div>`
        ].join("");
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

/**
 * A NODE'S PLANNED MINIGAME (13.11.2026; case-schema.mjs ZONE_FIELDS): the zones' window's own fields, under the mode's
 * select - a Straw Poll's and a Scrum Debate's question and two answers (a Scrum's thesis too), a Logic Dive's saved set
 * and the sets' editor. Each row names the modes it is for and is drawn hidden for the others; a change of the select
 * shows the mode's (`wireMap`). Saved as every field of the node, on its close.
 */
function zoneRows(node, name) {
    const L = key => game.i18n.localize(key);
    const z = TRIAL.modes.zones;
    const row = (modes, label, field) => `<div data-drpg-zone-for="${modes.join(" ")}"${modes.includes(node.mode) ? "" : " hidden"}>${editRow(label, field)}</div>`;
    const text = (field, max) => `<input type="text" name="${esc(name(field))}" value="${esc(node[field] ?? "")}" maxlength="${max}" />`;
    const sets = Object.entries(diveSetStore.entries() ?? {}).filter(([, s]) => Array.isArray(s?.questions))
        .map(([id, s]) => `<option value="${esc(id)}"${id === node.diveSet ? " selected" : ""}>${esc(s.name ?? id)} (${s.questions.length})</option>`).join("");
    const gone = node.diveSet && !diveSetStore.get(node.diveSet) ? `<option value="${esc(node.diveSet)}" selected>${esc(L("DRPG.CaseMap.diveSetGone"))}</option>` : "";
    return [
        row(["straw", "scrum"], L("DRPG.Zones.picker.question"), text("zoneQuestion", z.questionLength)),
        row(["straw", "scrum"], L("DRPG.Zones.picker.a"), text("zoneA", z.answerLength)),
        row(["straw", "scrum"], L("DRPG.Zones.picker.b"), text("zoneB", z.answerLength)),
        row(["scrum"], L("DRPG.Zones.picker.thesis"), text("zoneThesis", z.scrum.thesisLength)),
        row(["dive"], L("DRPG.Zones.picker.set"), `<select name="${esc(name("diveSet"))}"><option value="">${esc(L("DRPG.CaseMap.noDiveSet"))}</option>${gone}${sets}</select>`
            + ` <button type="button" data-drpg-dive-sets>${esc(L("DRPG.Zones.picker.editSets"))}</button>`)
    ];
}

/** Two field values the same: both blank, or equal as JSON (the Key plan's `same`, key-remnants.mjs `setKeyPlan`). */
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
            /* a room picked carries its scene (E104): the option's `data-scene`, against the scene the row was drawn
               with (`data-drpg-scene-drawn`), so a plan names where its room is, not only what it is called */
            if (field === "room" && el.tagName === "SELECT") Object.assign(node.text, roomScene(el));
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
        // a planned Autopsy's node is drawn before it is written (13.11.2026): its first write makes its row
        const n = autopsyNumber(id);
        const now = caseNodeOf(caseRows(chapter).rows[id]) ?? (n !== null ? caseNodeOf({ kind: "autopsy" }) : null);
        if (!now) continue;
        const write = {};
        for (const [field, { value, drawn }] of Object.entries(fields)) {
            const key = field === "gmText" ? "text" : field;
            /* the chapter's count of planned Autopsies, on its first one's fields: the meta row's, where it still reads as
               the window drew it (the preset counts as drawn where none is written) */
            if (key === "autopsies" && n !== null) {
                if (String(autopsyCount(chapter)) !== String(drawn)) { refused.push({ field, value, row: now.label || id }); continue; }
                await setCaseMeta(chapter, { autopsies: Number(value) });
                continue;
            }
            if (key === "atBody" && n !== null) {
                if (String(now.atBody ?? n) !== String(drawn)) { refused.push({ field, value, row: now.label || id }); continue; }
                write.atBody = Number(value);
                continue;
            }
            if (key === "inputs" || key === "refutes") {
                const keep = now[key].filter(x => !drawn.includes(x));
                write[key] = [...new Set([...keep, ...value])];
                continue;
            }
            const held = key === "mode" ? (now.mode ?? "") : now[key];
            if (!sameValue(held ?? "", drawn ?? "")) { refused.push({ field, value, row: now.label || id }); continue; }
            write[key] = key === "mode" ? (value || null) : value;
        }
        if (Object.keys(write).length) await setCaseNode(chapter, id, caseRows(chapter).rows[id] ? write : { kind: now.kind, ...write });
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
    const form = d.element.querySelector("form");
    const q = name => form.querySelector(`[name="${CSS.escape(name)}"]`);
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
        ...readCaseFields(form)
    };
}

/**
 * The case's fields inside `form`, the window's form or one open node's editor: the traces' rows, the case schema's
 * fields and the Key slots' rows, each field only where the GM changed it. No Final Key Remnant field: a node's save
 * (`saveOpenNode`) reads its editor here, so a field of the Table that a node does not hold is never read as empty and
 * written by a node's close (perf-open's review for 1.2.111, section 2; 13.11.2026).
 */
/* A planned room's scene (E104): a room select changed carries the picked option's scene, against the one it was drawn
   with (`data-drpg-scene-drawn`), as `{ scene: { value, drawn } }`; nothing where the room was not changed. */
function roomScene(select) {
    if (!select || select.dataset?.drpgSceneDrawn === undefined || !isDirty(select)) return {};
    return { scene: { value: select.selectedOptions?.[0]?.dataset.scene || null, drawn: select.dataset.drpgSceneDrawn || null } };
}

function readCaseFields(form) {
    const traces = allTraces();
    const plan = keyPlan();
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
            fields: { ...changed([
                ["name", `keyname:${i}`], ["text", `keytext:${i}`], ["analysis", `keyanalysis:${i}`],
                ["note", `note:${i}`], ["token", `token:${i}`], ["room", `keyroom:${i}`],
                ["vis", `keyvis:${i}`], ["author", `keyauthor:${i}`], ["img", `keypicture:${i}`]
            ]), ...roomScene(q(`keyroom:${i}`)) }
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
    wirePortraitPickers(root, { defaultImg: PLANNED_GLYPH });

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
    return saveFieldsIn(root?.querySelector?.(".drpg-case-edit:not([hidden])"));
}

/* AND EVERY CHANGED FIELD OF THE WINDOW AT ITS CLOSE (the owner, 13.11.2026: "Nie, ma zapisywac" - closing never loses
   what was typed; the coordinator asked whether the Table's changes were lost without a word, and they were: a close by
   the X, Escape or Close, or by a footer button that reopens the window, wrote the open node alone). The drawn form's
   changed fields, the Table's rows, the Key slots' and every node's, as Save writes them (`readCaseFields`): only where
   the GM changed them and the world still holds what was drawn, a refusal told. The Final Truth Remnant is not placed
   here: placing it puts a token on the map, so a close with its room picked asks first (`offerFinalOnClose`). */
function saveDrawnForm(root) {
    return saveFieldsIn(root?.querySelector?.("form"));
}

/** The changed fields inside `scope` (a node's editor or the window's form), written one write after another. */
function saveFieldsIn(scope) {
    const fields = scope ? [...scope.querySelectorAll("[name]")].filter(isDirty) : [];
    if (!fields.length) return nodeWrites;
    const result = readCaseFields(scope);
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
    /* A node's mode select shows that mode's planned-minigame rows (`zoneRows`), and its button opens the Logic Dive sets
       (13.11.2026). Once per window: a redraw keeps the root. */
    if (root && !root.dataset.drpgZoneRows) {
        root.dataset.drpgZoneRows = "1";
        root.addEventListener("change", event => {
            const select = event.target?.closest?.('.drpg-case-edit select[name$=":mode"]');
            if (!select) return;
            for (const row of select.closest(".drpg-case-edit").querySelectorAll("[data-drpg-zone-for]")) row.hidden = !row.dataset.drpgZoneFor.split(" ").includes(select.value);
        });
        root.addEventListener("click", event => {
            if (!event.target?.closest?.("[data-drpg-dive-sets]")) return;
            import("./trial-zones-ui.mjs").then(Z => Z.openDiveSets()).catch(err => error("The Logic Dive sets did not open", err));
        });
    }
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
            placeIncident(Number(chapter), id).then(() => refresh(), fail("place a planned Remnant"));
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
    if (row?.kind === "final") return placePlannedFinal(chapter, id, row);
    if (row?.kind === "bullet") return givePlannedBullet(chapter, id, row);
    if (row?.kind !== "incident") return null;
    // the plan's type (13.11.2026); an Incident Remnant is tied to the murder, any other as the GM says in the window
    const type = row.type ?? "incident";
    // its planned room, said in one line when the scene no longer has it (New Remnant then starts on its first room)
    const { allRooms } = await import("./movement.mjs");
    if (row.room && !allRooms(workingScene()).includes(row.room)) ui.notifications.warn(game.i18n.format("DRPG.Investigation.plannedRoomGone", { room: row.room }));
    // every field it plans (E104); with no room planned, New Remnant asks for one instead of starting on the first
    const token = await openNewTrace({ room: row.room, sceneId: row.scene, type, name: row.label, text: row.text, tied: row.tie ?? "",
        author: row.author || "", vis: row.vis, reinforced: row.reinforced === true, analysis: row.analysis || "", note: row.note || "",
        img: row.img || PLANNED_GLYPH, askRoom: !row.room });
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
 * WHAT A BUTTON DID IS SAID IN THE WINDOW (E51 C5, 31.10.2026; audit S05-55): the realization's answer is the
 * dashboard's first line (`openInvestigationDashboard`'s `said`), over the region a redraw rebuilds, until the window
 * closes. Clear Faint and Sweep said theirs the same way until E64-inv took them off the bar (End the chapter runs both).
 */
export async function runDashboardButton(action) {
    if (action === "newTrace") {
        await openNewTrace();
        return { said: null };
    }
    if (action === "autopsy") {
        const { issueAutopsyDialog } = await import("./gm-items.mjs");
        await issueAutopsyDialog();
        return { said: null };
    }
    if (action === "bodyFound") {
        const { openBodyDiscoveryDialog } = await import("./chapter.mjs");
        await openBodyDiscoveryDialog();
        return { said: null };
    }
    // E97 C10: the case's realization, its preview first, its undo inside it (case-realize.mjs; by `import()`: that file
    // reads this one's planner, so a static import here would close a cycle).
    if (action === "realize") {
        const { openRealization } = await import("./case-realize.mjs");
        return { said: await openRealization() };
    }
    return false;
}

// The clue first, because it is the half that can fail: a room that no
// longer exists warns and places nothing, and the GM should see that on
// the window they pressed Save on. Same order its old home kept.
// On the scene of the option picked (E12 fix r1-G2): the placement used to look the room's
// name up on the school first, so a GM who picked the Annex's Kitchen got the school's.
/**
 * A PLANNED TRUTH BULLET GIVEN (E104): the Give Truth Bullet window (gm-items.mjs `giveTruthBulletDialog`) opens on Write
 * new with every field the plan holds, on its planned recipient (else the first student, which the window shows), and
 * the GM gives it there; given, the plan is marked so (`given`). The window refuses one with no name, as ever. Answers
 * whether it was given. A plan to Everyone (1.2.113) opens on Everyone, and is marked only when every living student got
 * a copy: the window names those who did not, and the plan stays to be given again.
 */
async function givePlannedBullet(chapter, id, row) {
    const { giveTruthBulletDialog } = await import("./gm-items.mjs");
    const given = await giveTruthBulletDialog(row.recipient ? game.actors.get(row.recipient) ?? null : null, { fill: row });
    if (given) await setCaseNode(chapter, id, { given: Date.now() });
    return given;
}

/**
 * A PLANNED FINAL TRUTH PUT ON THE MAP (E104): by the Final Truth form's own road (mastermind.mjs `placeFinalRemnant`),
 * with every field the plan holds - its room on its scene, visibility, who left it, name, words, analysis and the GM's
 * note - then its picture, as the Table writes it; the plan's row then points at it. With no room planned it asks for
 * one ("- pick a room -" first, which places nothing) instead of guessing. Answers the token, or null.
 */
async function placePlannedFinal(chapter, id, row) {
    let room = row.room, scene = row.scene ? game.scenes.get(row.scene) ?? null : null;
    if (!room) {
        const L = key => game.i18n.localize(key);
        const answer = await drpgWindow({
            title: L("DRPG.CaseMap.finalAskRoomTitle"),
            classes: ["drpg-panel", "drpg-window-final-room"],
            body: `<form><label>${esc(L("DRPG.Investigation.room"))}<select name="room"><option value="">${esc(L("DRPG.Mastermind.finalPickRoom"))}</option>${
                placeRoomOptions()}</select></label></form>`,
            footer: { primary: { action: "place", label: L("DRPG.Investigation.finalAskPlace"), callback: (e, b, d) => {
                const select = d.element.querySelector('[name="room"]');
                return { room: select?.value ?? "", sceneId: select?.selectedOptions?.[0]?.dataset.scene ?? "" };
            } }, close: { role: "cancel", action: "cancel" } },
            rejectClose: false
        });
        if (!answer?.room) return null;
        room = answer.room;
        scene = game.scenes.get(answer.sceneId) ?? null;
    }
    const { placeFinalRemnant } = await import("./mastermind.mjs");
    const token = await placeFinalRemnant({ room, scene, visibility: row.vis ?? "evident", note: row.note ?? "", name: row.label ?? "",
        text: row.text ?? "", analysis: row.analysis ?? "", author: row.author ?? "" });
    if (!token) return null;
    await setRemnantPublic(token, { img: row.img || PLANNED_GLYPH });
    await setCaseNode(chapter, id, { trace: `${token.parent?.id}.${token.id}` });
    ui.notifications.info(game.i18n.format("DRPG.Mastermind.finalPlacedIn", { room }));
    return token;
}

/**
 * A FINAL TRUTH REMNANT LEFT WITH ITS ROOM PICKED (13.11.2026). Save places it; a close that was not Save writes the
 * window's text (`saveDrawnForm`) but does not place a token on the map unasked: where the form's Final Truth Remnant
 * has a room, the GM is asked, "Place it" the default, and it is placed as Save places it. Answers whether it was.
 */
async function offerFinalOnClose(root) {
    if (!root?.querySelector?.("form")) return false;
    const final = readDashboardForm({ element: root });
    if (!final.finalRoom) return false;
    const L = key => game.i18n.localize(key);
    const answer = await drpgWindow({
        title: L("DRPG.Investigation.finalAskTitle"),
        classes: ["drpg-panel", "drpg-window-final-ask"],
        body: `<p>${esc(L("DRPG.Investigation.finalAskBody"))}</p>`,
        footer: { primary: { action: "place", label: L("DRPG.Investigation.finalAskPlace") },
            close: { role: "close", action: "later", label: L("DRPG.CaseRealize.notNow") }, default: "place" },
        rejectClose: false
    });
    if (answer !== "place") return false;
    await placeFinalFromDashboard(final);
    return true;
}

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

    /* THE FOOTER BY ROLE (E21 C2a, E22): Save the primary; the windows it opens and the body secondary; Close, which
       keeps what was typed in an open node (below). No destructive button since E64-inv. */
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
            // N-4: the one road to a trace the GM is simply stating exists - an action rather than a view, so here and
            // not on a tab.
            { action: "newTrace", label: game.i18n.localize("DRPG.Investigation.newTraceTitle") },
            // The autopsy and the body moved here from GM panel tiles: a GM issues one or reports the other while
            // looking at the case, not while deciding which screen to open.
            { action: "autopsy", label: game.i18n.localize("DRPG.TruthBullet.autopsyTitle") },
            // A STATE CHANGE, NOT ONE MORE VIEW (E09 C16, audit S05-29): the buttons around it
            // open a window; this one starts a case. Its class and icon set it apart in both themes.
            { action: "bodyFound", label: game.i18n.localize("DRPG.Chapter.bodyTitle"),
                icon: "fa-solid fa-skull", class: "drpg-state-change" },
            // E97 C10 (Q-C): the realization's preview, in both views; it writes nothing until its own Run. Its undo is
            // in that window since E64-inv (case-realize.mjs `realizationFooter`), shown once a run has placed anything.
            { action: "realize", label: game.i18n.localize("DRPG.CaseRealize.preview") }
            ],
            /* NO DESTRUCTIVE ROW, AND NO EVIDENCE LOG (E64-inv, 12.11.2026; the owner's pick of the Investigation review:
               "Na reszte sie zgadzam"). Clear the Faint Remnants and Collect the Truth Bullets were here and in End the
               chapter both (chapter.mjs `chapterEndForm`: `faint`, `sweep`), so they are End the chapter's alone; the
               Class Trial's evidence log is the trial console's (trial-floor-ui.mjs `logButton`); Undo realization went
               into the realization's preview, behind its own question. R3967 holds the bar to these actions. */
            /* CLOSE, NOT CANCEL (the owner, 13.11.2026: "Nie, ma zapisywac" - the footer's closing word keeps what was
               typed). A word that saves is not a Cancel (docs/glossary.json `cancel-word` withdraws a question,
               `close-word` closes a window with nothing left to answer), so it is the kit's Close. Its action is
               "close", ApplicationV2's own: at a table the press never reaches DialogV2 and the wait answers null, the
               X's answer (ui-kit.mjs, "A CLOSING WORD WHOSE ACTION IS "close""; LIVE-E21-06), and the harness answers
               "close"; both write the open node below. From the planner's review until then it was a Cancel that
               discarded (4bab7361, da352a81). */
            close: { role: "close", action: "close" },
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
       hands on every changed field, the node's among them, so it writes nothing here. EVERY CLOSE WRITES IT (the owner,
       13.11.2026: "Nie, ma zapisywac"): the X, Escape and the footer's Close (null at a table, "close" headless) and
       the footer's other buttons, which reopen the window. And the Table's changed fields with it (`saveDrawnForm`,
       13.11.2026): until then they waited for Save, and every other close dropped them without a word. From the
       planner's review until the owner's answer a Cancel discarded both (4bab7361, da352a81). */
    if (!action || typeof action === "string") {
        await saveDrawnForm(drawnRoot);
        await offerFinalOnClose(drawnRoot);
    }
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
