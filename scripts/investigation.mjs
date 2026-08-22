/**
 * Danganronpa RPG — the GM's side of an Investigation.
 * ---------------------------------------------------------------------------
 * Guide, p. 28: "DM szykuje 5 poszlak przed morderstwem: Banalną, Standardową,
 * Standardową, Skomplikowaną, Desperacką. Ich ostateczna ilość jest zależna od
 * rzutów kością na otwarciu morderstwa, ale nigdy mniejsza, niż 3. Wszystkie 5
 * Key Remnants łącznie powinno zawężać krąg podejrzanych do 3-8 graczy."
 *
 * Two screens, and between them they answer the only two questions a GM has
 * during an Investigation:
 *
 *   the planner    what are my five clues, and have I actually put them on the
 *                  map — or am I one session in with three of them still in my
 *                  head?
 *   the dashboard  who has found what, how much of the case is reachable, and
 *                  is this trial about to fail because nobody found the
 *                  evidence that makes it work?
 *
 * The dashboard is the one place in this module that reads the answer key in
 * bulk, which is why it is GM-only in the strongest sense: it runs nowhere else
 * (see D6 — the ledger only exists on a GM's browser).
 */

import {
    MODULE_ID, KEY_REMNANTS, TRUTH_BULLET_TYPES,
    REMNANT_VISIBILITY, REMNANT_VISIBILITY_LABELS
} from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { getClock } from "./clock.mjs";
import {
    remnantsOn, remnantData, setRemnantFlags, setRemnantPublic, confirmClearFaint, difficultyTag
} from "./remnants.mjs";
import { bulletsOf, secretOf, truthBulletData } from "./truth-bullets.mjs";
import { studentActors } from "./monokuma.mjs";
import { isDeceased } from "./chapter.mjs";
import { dialogContent, plural, tableDialog, wirePortraitPickers } from "./utils.mjs";

const ICON = "icons/svg/hazard.svg";

/** Human labels for the guide's five difficulty steps. */
const SCALE_LABELS = {
    trivial: "Trivial",
    standard: "Standard",
    complex: "Complex",
    desperate: "Desperate"
};

/* ==========================================================================
 * THE PLAN
 * ========================================================================== */

/** The plan as stored, or a fresh one for this chapter. */
export function keyPlan() {
    const stored = game.settings.get(MODULE_ID, SETTINGS.keyRemnantPlan) ?? {};
    const chapter = getClock().chapter;

    // A plan belongs to one murder. When the chapter has moved on, the previous
    // chapter's clues are not this chapter's blanks — start clean rather than
    // present stale text as though it were the current case.
    if (stored.chapter !== chapter) {
        return {
            chapter,
            entries: KEY_REMNANTS.scale.map(scale => ({
                scale, note: "", tokenId: null, sceneId: null
            }))
        };
    }
    return stored;
}

/** Save the plan. GM only. */
export async function setKeyPlan(plan) {
    if (!game.user.isGM) return null;
    await game.settings.set(MODULE_ID, SETTINGS.keyRemnantPlan, plan);
    return plan;
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
 * otherwise vanish from this count — and this count is what decides whether the
 * trial is solvable.
 */
function findersByRemnant() {
    const map = new Map();
    for (const actor of studentActors()) {
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
 * @returns {{entries: Array, placed: number, found: number, missing: number}}
 */
export function keyPlanStatus() {
    const plan = keyPlan();
    const finders = findersByRemnant();
    const onMap = new Set(placedKeyRemnants().map(r => r.token.id));

    const entries = plan.entries.map(entry => {
        const placed = Boolean(entry.tokenId && onMap.has(entry.tokenId));
        const who = entry.tokenId ? Array.from(finders.get(entry.tokenId) ?? []) : [];
        return { ...entry, placed, finders: who, found: who.length > 0 };
    });

    return {
        entries,
        placed: entries.filter(e => e.placed).length,
        found: entries.filter(e => e.found).length,
        missing: entries.filter(e => !e.found).length
    };
}

/**
 * Apply the Key Remnant planner's five rows, exactly as `openKeyPlanner()`
 * used to on its own Save — now called from the Investigation Dashboard's
 * single Save instead of a dialog of its own. See the "Key Remnants" tab in
 * `openInvestigationDashboard`.
 */
async function saveKeyPlan(plan, rows) {
    // A row with a room chosen and no existing token means "make this one".
    //
    // The planner used to be able to do exactly one thing: point an entry at a
    // Key Remnant somebody had already placed by hand. That is backwards — the
    // plan IS the five clues, written before the murder, and the whole reason a
    // GM opens this screen is to turn them into traces on the map. Marking an
    // existing Prep Remnant as Key also silently rewrote evidence that had
    // already been found.
    const entries = [];
    let created = 0;
    for (const row of rows) {
        if (row.tokenId || !row.createIn) {
            entries.push(stripDraft(row));
            continue;
        }

        const token = await createKeyRemnant(row);
        if (token) {
            created += 1;
            entries.push({
                scale: row.scale, note: row.note,
                tokenId: token.id, sceneId: token.parent?.id ?? canvas?.scene?.id ?? null
            });
        } else {
            entries.push(stripDraft(row));
        }
    }

    await setKeyPlan({ chapter: plan.chapter, entries });
    return { entries, created };
}

/** The stored shape — the room/visibility pickers are input, not plan data. */
function stripDraft(row) {
    return {
        scale: row.scale, note: row.note,
        tokenId: row.tokenId ?? null, sceneId: row.sceneId ?? null
    };
}

/**
 * A random point actually inside the region.
 *
 * Not the centre. Five clues stacked on five room centres reads as five pins on
 * a diagram rather than as things lying about a building — and if two of them
 * land in the same room they sit exactly on top of each other, which is the one
 * arrangement a GM cannot click apart.
 *
 * Rejection sampling against the region's own hit test, because a bounding box
 * is not the room: an L-shaped or circular region has plenty of box that is
 * outside it. Falls back to the centre after a bounded number of tries, so an
 * exotic shape delays the placement rather than losing it.
 */
function randomPointIn(region, scene) {
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
    // no elevation outright, and `false` is not nullish — so the old `?? true`
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
    const test = point => !canTest   // cannot ask — the bounding box is the best we have
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
 * because a Key Remnant is the GM's own construction — nobody left it, so
 * `dropRemnant`'s "where is this actor standing" has no answer to give.
 * `REMNANT_TYPES.key` already carries `reinforced: true`, so `placeRemnant`
 * marks it unremovable without being told.
 */
async function createKeyRemnant(row) {
    const scene = canvas?.scene;
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
        subject: SCALE_LABELS[row.scale] ?? row.scale,
        action: "manual",
        room: row.createIn,
        chapter: clock.chapter,
        day: clock.day,
        timeOfDay: clock.timeOfDay
    });
}

/* ==========================================================================
 * THE DASHBOARD
 * ========================================================================== */

/** Stable form-field id for a trace — unique across every scene. */
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
        if (a.data.tiedToCrime !== b.data.tiedToCrime) return a.data.tiedToCrime ? -1 : 1;
        return (a.data.room ?? "").localeCompare(b.data.room ?? "");
    });
}

/**
 * Who has copied which trace — every type, not only Key. Same read as
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

/** What each living student is holding, summarised. */
function evidenceByStudent() {
    return studentActors()
        .filter(a => !isDeceased(a))
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
 * Put a Final Truth Remnant on the map. Same shape as `createKeyRemnant` — a
 * GM construction dropped at a random point in the named room, not something
 * an actor left behind — but typed `final` and worded for the one clue a
 * chapter ever gets.
 */
async function createFinalRemnant({ room, visibility = "evident", note = "" } = {}) {
    const scene = canvas?.scene;
    const region = Array.from(scene?.regions ?? []).find(r => r.name === room);
    if (!region) {
        ui.notifications.warn(game.i18n.format("DRPG.Calls.noSuchRoom", { room }));
        return null;
    }

    const spot = randomPointIn(region, scene);
    const { placeRemnant } = await import("./remnants.mjs");
    const clock = getClock();

    return placeRemnant({
        x: spot.x, y: spot.y, sceneId: scene?.id ?? null,
        type: "final", visibility, faint: false,
        tiedToCrime: true, reinforced: true, note,
        subject: game.i18n.localize("DRPG.Remnant.finalSubject"),
        action: "manual", room,
        chapter: clock.chapter, day: clock.day, timeOfDay: clock.timeOfDay
    });
}

/**
 * The Investigation at a glance — and, now, the one place a GM edits any of
 * it. One window, three tabs sharing a single Save, because the questions
 * they answer ("what are my clues", "have I placed them", "who has found
 * what") are one GM's one sitting, not three separate trips through the panel.
 *
 *   Traces        every Remnant on every scene — the old per-scene Remnant
 *                 Manager, widened to the whole world, plus the `public`
 *                 record a player will eventually see (see remnants.mjs's
 *                 "ONE RECORD, THREE VIEWS").
 *   Key Remnants  the planner, folded in, now showing how many the opening
 *                 roll actually allows this chapter.
 *   Final         the Final Truth Remnant and the Mastermind's identity —
 *                 editable here too, per your decision to keep your original
 *                 note, alongside the dedicated Mastermind window.
 *
 * Information only beyond that: an earlier version also handed each Monokuma
 * Despair for every Key Remnant nobody reached, which turned the GM's own
 * planning miss into a resource the GM side got to spend. A clue the players
 * never found is already its own consequence — the trial gets harder — and
 * the "this is getting thin" warning is what a GM actually needs from here.
 */
export async function openInvestigationDashboard() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
    const { allRooms } = await import("./movement.mjs");
    const { mastermindActor, finalTruthPlacedThisChapter } = await import("./mastermind.mjs");
    const { murderState } = await import("./murder.mjs");

    const students = evidenceByStudent();
    const traces = allTraces();
    const finders = findersByAnyRemnant();
    const plan = keyPlan();
    const status = keyPlanStatus();
    const rooms = allRooms();
    const currentMastermind = mastermindActor();
    const finalPlaced = finalTruthPlacedThisChapter();
    // The opening roll's own limit on how many Key Remnants this chapter gets
    // — `null` before a murder has happened, meaning "no limit yet, plan
    // freely". See `def.keyRemnants` in config.mjs and `murderState()`.
    const limit = murderState()?.keyRemnants ?? null;

    const roomOptions = rooms.map(r => `<option value="${esc(r)}">${esc(r)}</option>`).join("");
    const visOptions = REMNANT_VISIBILITY.map(v =>
        `<option value="${v}"${v === "evident" ? " selected" : ""}>${
            esc(REMNANT_VISIBILITY_LABELS[v] ?? v)}</option>`).join("");

    /* ---- Who has what, shown regardless of tab ------------------------- */
    const studentRows = students.map(s => {
        const breakdown = Object.entries(s.types)
            .map(([type, n]) => `${esc(TRUTH_BULLET_TYPES[type]?.label ?? type)} ×${n}`)
            .join(", ");
        return `<tr>
            <td>${esc(s.actor.name)}</td>
            <td>${s.total}</td>
            <td>${s.keys}</td>
            <td>${s.unidentified}</td>
            <td class="notes">${breakdown || "—"}</td>
        </tr>`;
    }).join("");

    /* ---- Traces ---------------------------------------------------------- */
    const traceRows = traces.map(({ token, data, scene }) => {
        const key = rowKey(scene.id, token.id);
        const difficulty = difficultyTag(data.visibility, data.type);
        // The difficulty tag is appended live by `remnantPublic()` and never
        // stored — editing it back into the saved list would freeze a
        // difficulty that is meant to track `retuneRemnant` automatically.
        const manualTags = (data.public?.tags ?? []).filter(t => t !== difficulty);
        const who = Array.from(finders.get(token.id) ?? []);
        const found = who.length
            ? esc(who.join(", "))
            : `<em>${game.i18n.localize("DRPG.Investigation.notFound")}</em>`;

        return `<tr>
            <td>
                <img src="${esc(data.public?.img || ICON)}" alt="" class="drpg-project-portrait"
                     data-drpg-portrait="${key}" />
                <input type="hidden" name="img.${key}" value="${esc(data.public?.img || ICON)}" />
                <input type="text" name="name.${key}" value="${esc(data.public?.name || "")}" />
            </td>
            <td><textarea name="text.${key}" rows="2">${esc(data.public?.playerText || "")}</textarea></td>
            <td><input type="text" name="tags.${key}" value="${esc(manualTags.join(", "))}"
                placeholder="${game.i18n.localize("DRPG.Investigation.traceTagsPlaceholder")}" /></td>
            <td>${esc(data.room ?? "—")}</td>
            <td>${esc(data.sourceName ?? "—")}</td>
            <td style="text-align:center"><input type="checkbox" name="faint.${key}" ${data.faint ? "checked" : ""} /></td>
            <td style="text-align:center"><input type="checkbox" name="crime.${key}" ${data.tiedToCrime ? "checked" : ""} /></td>
            <td style="text-align:center"><input type="checkbox" name="reinf.${key}" ${data.reinforced ? "checked" : ""} /></td>
            <td>${found}</td>
        </tr>`;
    }).join("");

    /* ---- Key Remnants ------------------------------------------------------ */
    const placed = placedKeyRemnants();
    const tokenOptions = placed.map(r => {
        const label = `${r.data.visibilityLabel}${r.data.room ? ` · ${r.data.room}` : ""}`
            + `${r.data.note ? ` · ${r.data.note}` : ""}`
            + `${game.scenes.size > 1 ? ` · ${r.scene.name}` : ""}`;
        return { id: r.token.id, sceneId: r.scene.id, label };
    });

    const keyRows = plan.entries.map((entry, i) => {
        const st = status.entries[i];
        const overLimit = limit !== null && i >= limit;
        const picker = tokenOptions.map(o =>
            `<option value="${o.id}|${o.sceneId}"${o.id === entry.tokenId ? " selected" : ""}>${
                esc(o.label)}</option>`).join("");
        const live = entry.tokenId && tokenOptions.some(o => o.id === entry.tokenId);
        const state = !entry.tokenId
            ? `<em>${game.i18n.localize("DRPG.Investigation.notPlaced")}</em>`
            : !st.placed
                ? `<strong>${game.i18n.localize("DRPG.Investigation.tokenGone")}</strong>`
                : st.found
                    ? esc(st.finders.join(", "))
                    : `<em>${game.i18n.localize("DRPG.Investigation.notFound")}</em>`;

        return `<tr${overLimit ? ' style="opacity:.6"' : ""}>
            <td><strong>${esc(SCALE_LABELS[entry.scale] ?? entry.scale)}</strong></td>
            <td><input type="text" name="note:${i}" value="${esc(entry.note ?? "")}"
                placeholder="${game.i18n.localize("DRPG.Investigation.notePlaceholder")}" /></td>
            <td>
                <select name="token:${i}">
                    <option value=""${live ? "" : " selected"}>${
                        game.i18n.localize("DRPG.Investigation.notPlaced")}</option>
                    ${picker}
                </select>
            </td>
            <td>
                <select name="room:${i}" class="${overLimit ? "drpg-key-limited" : ""}"${overLimit ? " disabled" : ""}>
                    <option value="">${game.i18n.localize("DRPG.Investigation.pickRoom")}</option>
                    ${roomOptions}
                </select>
                <select name="vis:${i}" class="${overLimit ? "drpg-key-limited" : ""}"${overLimit ? " disabled" : ""}>${visOptions}</select>
            </td>
            <td>${state}</td>
        </tr>`;
    }).join("");

    // The guide's floor is three Key Remnants; the plan's own warning threshold
    // is one above it, so a GM is told the trial is getting thin BEFORE it is
    // actually unsolvable rather than at the moment it already is.
    const thin = status.found < KEY_REMNANTS.minimum + 1;

    /* ---- Final -------------------------------------------------------------- */
    const mastermindOptions = studentActors().map(a =>
        `<option value="${a.id}"${a.id === currentMastermind?.id ? " selected" : ""}>${
            esc(a.name)}</option>`).join("");

    const content = dialogContent(`<form>
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
                game.i18n.localize("DRPG.Investigation.tabFinal")}</button>
        </nav>

        <div data-drpg-panel="traces">
            ${traces.length ? `<table class="drpg-vault-table"><thead><tr>
                <th>${game.i18n.localize("DRPG.Investigation.traceName")}</th>
                <th>${game.i18n.localize("DRPG.Investigation.traceText")}</th>
                <th>${game.i18n.localize("DRPG.Investigation.traceTags")}</th>
                <th>${game.i18n.localize("DRPG.Investigation.traceRoom")}</th>
                <th>${game.i18n.localize("DRPG.Investigation.traceLeftBy")}</th>
                <th>${game.i18n.localize("DRPG.Remnant.faintColumn")}</th>
                <th>${game.i18n.localize("DRPG.Remnant.crimeColumn")}</th>
                <th>${game.i18n.localize("DRPG.Remnant.reinforcedColumn")}</th>
                <th>${game.i18n.localize("DRPG.Investigation.foundBy")}</th>
            </tr></thead><tbody>${traceRows}</tbody></table>`
                : `<p class="notes">${game.i18n.localize("DRPG.Investigation.noTraces")}</p>`}
        </div>

        <div data-drpg-panel="key" style="display:none">
            <p>${game.i18n.format("DRPG.Investigation.plannerIntro", {
                chapter: plan.chapter,
                min: KEY_REMNANTS.suspectRange[0], max: KEY_REMNANTS.suspectRange[1]
            })}</p>
            <p>${game.i18n.format("DRPG.Investigation.keySummary", {
                found: status.found, placed: status.placed, total: status.entries.length
            })}</p>
            ${thin ? `<p class="drpg-warning">${game.i18n.format("DRPG.Investigation.tooThin", {
                found: status.found, min: KEY_REMNANTS.minimum
            })}</p>` : ""}
            ${limit !== null ? `<p class="notes">${game.i18n.format("DRPG.Investigation.keyLimitLine", {
                used: Math.min(plan.entries.length, limit), limit, min: KEY_REMNANTS.minimum
            })}</p>
            <label><input type="checkbox" name="keyOverride" /> ${
                game.i18n.localize("DRPG.Investigation.keyLimitOverride")}</label>` : ""}
            <table class="drpg-vault-table"><thead><tr>
                <th>${game.i18n.localize("DRPG.Investigation.difficulty")}</th>
                <th>${game.i18n.localize("DRPG.Investigation.clue")}</th>
                <th>${game.i18n.localize("DRPG.Investigation.onMap")}</th>
                <th>${game.i18n.localize("DRPG.Investigation.createHere")}</th>
                <th>${game.i18n.localize("DRPG.Investigation.foundBy")}</th>
            </tr></thead><tbody>${keyRows}</tbody></table>
            <p class="notes">${game.i18n.localize("DRPG.Investigation.createNote")}</p>
        </div>

        <div data-drpg-panel="final" style="display:none">
            <h4>${game.i18n.localize("DRPG.Mastermind.dialogTitle")}</h4>
            <p class="drpg-warning">${game.i18n.localize("DRPG.Mastermind.privacyWarning")}</p>
            <label>${game.i18n.localize("DRPG.Mastermind.whoIs")}
                <select name="mastermind">
                    <option value="">${game.i18n.localize("DRPG.Mastermind.nobody")}</option>
                    ${mastermindOptions}
                </select></label>

            <h4>${game.i18n.localize("DRPG.Investigation.finalHeading")}</h4>
            ${finalPlaced ? `<p class="notes">${game.i18n.localize("DRPG.Investigation.finalAlreadyPlaced")}</p>` : ""}
            <label><input type="checkbox" name="finalCreate" /> ${
                game.i18n.localize("DRPG.Investigation.finalCreateLabel")}</label>
            <select name="finalRoom">
                <option value="">${game.i18n.localize("DRPG.Investigation.pickRoom")}</option>
                ${roomOptions}
            </select>
            <select name="finalVis">${visOptions}</select>
            <input type="text" name="finalNote"
                placeholder="${game.i18n.localize("DRPG.Investigation.finalNotePlaceholder")}" />
        </div>
    </form>`);

    const action = await tableDialog({
        window: { title: game.i18n.localize("DRPG.Investigation.dashboardTitle") },
        classes: ["drpg-panel", "drpg-projects"],
        content,
        buttons: [
            {
                action: "save", label: game.i18n.localize("DRPG.Assign.save"), default: true,
                callback: (e, b, d) => {
                    const form = d.element.querySelector("form");
                    const q = name => form.querySelector(`[name="${CSS.escape(name)}"]`);
                    return {
                        traces: traces.map(({ token, scene }) => {
                            const key = rowKey(scene.id, token.id);
                            return {
                                key,
                                img: q(`img.${key}`)?.value ?? "",
                                name: q(`name.${key}`)?.value.trim() ?? "",
                                text: q(`text.${key}`)?.value.trim() ?? "",
                                tags: (q(`tags.${key}`)?.value ?? "")
                                    .split(",").map(t => t.trim()).filter(Boolean),
                                faint: q(`faint.${key}`)?.checked ?? false,
                                tiedToCrime: q(`crime.${key}`)?.checked ?? false,
                                reinforced: q(`reinf.${key}`)?.checked ?? false
                            };
                        }),
                        keyRows: plan.entries.map((entry, i) => {
                            const raw = q(`token:${i}`)?.value ?? "";
                            const [tokenId, sceneId] = raw ? raw.split("|") : [null, null];
                            return {
                                scale: entry.scale,
                                note: q(`note:${i}`)?.value.trim() ?? "",
                                tokenId: tokenId || null,
                                sceneId: sceneId || null,
                                createIn: q(`room:${i}`)?.value || null,
                                visibility: q(`vis:${i}`)?.value || "evident"
                            };
                        }),
                        mastermind: q("mastermind")?.value ?? "",
                        finalCreate: q("finalCreate")?.checked
                            ? {
                                room: q("finalRoom")?.value || null,
                                visibility: q("finalVis")?.value || "evident",
                                note: q("finalNote")?.value.trim() ?? ""
                            }
                            : null
                    };
                }
            },
            { action: "clearFaint", label: game.i18n.localize("DRPG.Panel.clearFaint") },
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
            const root = dialog.element;
            wirePortraitPickers(root, { defaultImg: ICON });

            const tabs = root.querySelectorAll("[data-drpg-tab]");
            const panels = root.querySelectorAll("[data-drpg-panel]");
            for (const tab of tabs) {
                tab.addEventListener("click", () => {
                    for (const t of tabs) t.classList.toggle("active", t === tab);
                    for (const p of panels) {
                        p.style.display = p.dataset.drpgPanel === tab.dataset.drpgTab ? "" : "none";
                    }
                });
            }

            // Rows past the opening roll's limit start disabled; the checkbox
            // is the GM's explicit "yes, I mean it" rather than a silent cap.
            const override = root.querySelector('[name="keyOverride"]');
            const limited = root.querySelectorAll(".drpg-key-limited");
            override?.addEventListener("change", () => {
                for (const el of limited) el.disabled = !override.checked;
            });
        },
        rejectClose: false
    });

    if (!action || action === "close") return null;

    if (action === "clearFaint") {
        await confirmClearFaint();
        return openInvestigationDashboard();
    }
    // Each comes back here afterwards, so the dashboard is where the GM lands
    // rather than on the map — the same pattern the GM panel uses for its tiles.
    if (action === "autopsy") {
        const { issueAutopsyDialog } = await import("./gm-items.mjs");
        await issueAutopsyDialog();
        return openInvestigationDashboard();
    }
    if (action === "log") {
        const { openObjectionLog } = await import("./trial.mjs");
        await openObjectionLog();
        return openInvestigationDashboard();
    }
    if (action === "bodyFound") {
        const { openBodyDiscoveryDialog } = await import("./chapter.mjs");
        await openBodyDiscoveryDialog();
        return openInvestigationDashboard();
    }

    await applyDashboardSave(action, { traces, plan });
    return openInvestigationDashboard();
}

/** Commit the dashboard's single Save across all three tabs. */
async function applyDashboardSave(result, { traces, plan }) {
    let tracesChanged = 0;
    for (const row of result.traces) {
        const trace = traces.find(t => rowKey(t.scene.id, t.token.id) === row.key);
        if (!trace) continue;
        const { token, data } = trace;

        const difficulty = difficultyTag(data.visibility, data.type);
        const currentTags = (data.public?.tags ?? []).filter(t => t !== difficulty);

        const publicPatch = {};
        if (row.name !== (data.public?.name ?? "")) publicPatch.name = row.name;
        if (row.img !== (data.public?.img ?? "")) publicPatch.img = row.img;
        if (row.text !== (data.public?.playerText ?? "")) publicPatch.playerText = row.text;
        if (row.tags.join("") !== currentTags.join("")) publicPatch.tags = row.tags;
        if (Object.keys(publicPatch).length) {
            await setRemnantPublic(token, publicPatch);
            tracesChanged++;
        }

        if (row.faint !== data.faint || row.tiedToCrime !== data.tiedToCrime || row.reinforced !== data.reinforced) {
            await setRemnantFlags(token, {
                faint: row.faint, tiedToCrime: row.tiedToCrime, reinforced: row.reinforced
            });
            tracesChanged++;
        }
    }

    const { created } = await saveKeyPlan(plan, result.keyRows);

    const { mastermindActor, setMastermind, clearMastermind } = await import("./mastermind.mjs");
    const current = mastermindActor();
    if (result.mastermind !== (current?.id ?? "")) {
        if (result.mastermind) {
            await setMastermind(game.actors.get(result.mastermind));
        } else if (current) {
            await clearMastermind();
        }
    }

    const finalCreated = result.finalCreate?.room ? await createFinalRemnant(result.finalCreate) : null;

    const parts = [];
    if (tracesChanged) parts.push(plural("DRPG.Investigation.tracesSaved", { n: tracesChanged }));
    if (created) parts.push(plural("DRPG.Investigation.plannerCreated", { n: created }));
    if (finalCreated) parts.push(game.i18n.localize("DRPG.Investigation.finalCreated"));
    if (parts.length) ui.notifications.info(parts.join(" "));
}
