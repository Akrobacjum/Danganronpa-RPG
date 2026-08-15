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
import { remnantsOn, remnantData } from "./remnants.mjs";
import { bulletsOf, secretOf, truthBulletData } from "./truth-bullets.mjs";
import { studentActors } from "./monokuma.mjs";
import { isDeceased } from "./chapter.mjs";
import { dialogContent } from "./utils.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

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

/** The planner: five clues, their notes, and which token each one is. */
export async function openKeyPlanner() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const plan = keyPlan();
    const placed = placedKeyRemnants();
    const { allRooms } = await import("./movement.mjs");
    const rooms = allRooms();

    const options = placed.map(r => {
        const label = `${r.data.visibilityLabel}${r.data.room ? ` · ${r.data.room}` : ""}`
            + `${r.data.note ? ` · ${r.data.note}` : ""}`
            + `${game.scenes.size > 1 ? ` · ${r.scene.name}` : ""}`;
        return { id: r.token.id, sceneId: r.scene.id, label };
    });

    const roomOptions = rooms.map(r =>
        `<option value="${foundry.utils.escapeHTML(r)}">${foundry.utils.escapeHTML(r)}</option>`
    ).join("");
    const visOptions = REMNANT_VISIBILITY.map(v =>
        `<option value="${v}"${v === "evident" ? " selected" : ""}>${
            foundry.utils.escapeHTML(REMNANT_VISIBILITY_LABELS[v] ?? v)}</option>`).join("");

    const rows = plan.entries.map((entry, i) => {
        const picker = options.map(o =>
            `<option value="${o.id}|${o.sceneId}"${o.id === entry.tokenId ? " selected" : ""}>${
                foundry.utils.escapeHTML(o.label)}</option>`).join("");
        const live = entry.tokenId && options.some(o => o.id === entry.tokenId);

        return `<tr>
            <td><strong>${foundry.utils.escapeHTML(SCALE_LABELS[entry.scale] ?? entry.scale)}</strong></td>
            <td><input type="text" name="note:${i}"
                value="${foundry.utils.escapeHTML(entry.note ?? "")}"
                placeholder="${game.i18n.localize("DRPG.Investigation.notePlaceholder")}" /></td>
            <td>
                <select name="token:${i}">
                    <option value=""${live ? "" : " selected"}>${
                        game.i18n.localize("DRPG.Investigation.notPlaced")}</option>
                    ${picker}
                </select>
            </td>
            <td>
                <select name="room:${i}">
                    <option value="">${game.i18n.localize("DRPG.Investigation.pickRoom")}</option>
                    ${roomOptions}
                </select>
                <select name="vis:${i}">${visOptions}</select>
            </td>
        </tr>`;
    }).join("");

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Investigation.plannerTitle") },
        classes: ["drpg-panel", "drpg-projects"],
        content: dialogContent(`<form>
            <p>${game.i18n.format("DRPG.Investigation.plannerIntro", {
                chapter: plan.chapter,
                min: KEY_REMNANTS.suspectRange[0],
                max: KEY_REMNANTS.suspectRange[1]
            })}</p>
            <table class="drpg-vault-table"><thead><tr>
                <th>${game.i18n.localize("DRPG.Investigation.difficulty")}</th>
                <th>${game.i18n.localize("DRPG.Investigation.clue")}</th>
                <th>${game.i18n.localize("DRPG.Investigation.onMap")}</th>
                <th>${game.i18n.localize("DRPG.Investigation.createHere")}</th>
            </tr></thead><tbody>${rows}</tbody></table>
            <p class="notes">${game.i18n.localize("DRPG.Investigation.createNote")}</p>
            <p class="notes">${game.i18n.format("DRPG.Investigation.plannerNote", {
                min: KEY_REMNANTS.minimum
            })}</p>
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Panel.apply"), default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return plan.entries.map((entry, i) => {
                        const raw = f.querySelector(`[name="token:${i}"]`)?.value ?? "";
                        const [tokenId, sceneId] = raw ? raw.split("|") : [null, null];
                        return {
                            scale: entry.scale,
                            note: f.querySelector(`[name="note:${i}"]`)?.value.trim() ?? "",
                            tokenId: tokenId || null,
                            sceneId: sceneId || null,
                            createIn: f.querySelector(`[name="room:${i}"]`)?.value || null,
                            visibility: f.querySelector(`[name="vis:${i}"]`)?.value || "evident"
                        };
                    });
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!Array.isArray(result)) return null;

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
    for (const row of result) {
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
    ui.notifications.info(created
        ? game.i18n.format("DRPG.Investigation.plannerCreated", { n: created })
        : game.i18n.localize("DRPG.Investigation.plannerSaved"));
    return entries;
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
 * The Investigation at a glance.
 *
 * Information only. An earlier version also handed each Monokuma Despair for
 * every Key Remnant nobody reached, which nobody had asked for and which turned
 * the GM's own planning mistake into a resource the GM side got to spend. A
 * clue the players never found is already its own consequence — the trial gets
 * harder — and the "this is getting thin" warning below is what a GM actually
 * needs from this screen.
 */
export async function openInvestigationDashboard() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const status = keyPlanStatus();
    const students = evidenceByStudent();

    const keyRows = status.entries.map(entry => {
        const state = !entry.tokenId
            ? `<em>${game.i18n.localize("DRPG.Investigation.notPlaced")}</em>`
            : !entry.placed
                ? `<strong>${game.i18n.localize("DRPG.Investigation.tokenGone")}</strong>`
                : entry.found
                    ? foundry.utils.escapeHTML(entry.finders.join(", "))
                    : `<em>${game.i18n.localize("DRPG.Investigation.notFound")}</em>`;
        return `<tr>
            <td>${foundry.utils.escapeHTML(SCALE_LABELS[entry.scale] ?? entry.scale)}</td>
            <td>${foundry.utils.escapeHTML(entry.note || "—")}</td>
            <td>${state}</td>
        </tr>`;
    }).join("");

    const studentRows = students.map(s => {
        const breakdown = Object.entries(s.types)
            .map(([type, n]) => `${foundry.utils.escapeHTML(
                TRUTH_BULLET_TYPES[type]?.label ?? type)} ×${n}`)
            .join(", ");
        return `<tr>
            <td>${foundry.utils.escapeHTML(s.actor.name)}</td>
            <td>${s.total}</td>
            <td>${s.keys}</td>
            <td>${s.unidentified}</td>
            <td class="notes">${breakdown || "—"}</td>
        </tr>`;
    }).join("");

    // The guide's floor is three Key Remnants; the plan's own warning threshold
    // is one above it, so a GM is told the trial is getting thin BEFORE it is
    // actually unsolvable rather than at the moment it already is.
    const thin = status.found < KEY_REMNANTS.minimum + 1;

    const action = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Investigation.dashboardTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<div>
            <h4>${game.i18n.localize("DRPG.Investigation.keyHeading")}</h4>
            <p>${game.i18n.format("DRPG.Investigation.keySummary", {
                found: status.found, placed: status.placed, total: status.entries.length
            })}</p>
            <table class="drpg-vault-table"><thead><tr>
                <th>${game.i18n.localize("DRPG.Investigation.difficulty")}</th>
                <th>${game.i18n.localize("DRPG.Investigation.clue")}</th>
                <th>${game.i18n.localize("DRPG.Investigation.foundBy")}</th>
            </tr></thead><tbody>${keyRows}</tbody></table>

            ${thin ? `<p class="drpg-warning">${game.i18n.format("DRPG.Investigation.tooThin", {
                found: status.found, min: KEY_REMNANTS.minimum
            })}</p>` : ""}

            <h4>${game.i18n.localize("DRPG.Investigation.whoHasWhat")}</h4>
            <table class="drpg-vault-table"><thead><tr>
                <th>${game.i18n.localize("DRPG.Investigation.student")}</th>
                <th>${game.i18n.localize("DRPG.Investigation.bullets")}</th>
                <th>${game.i18n.localize("DRPG.Investigation.keysHeld")}</th>
                <th>${game.i18n.localize("DRPG.Investigation.unidentified")}</th>
                <th>${game.i18n.localize("DRPG.Investigation.breakdown")}</th>
            </tr></thead><tbody>${studentRows}</tbody></table>
        </div>`),
        buttons: [
            { action: "plan", label: game.i18n.localize("DRPG.Investigation.plannerTitle") },
            { action: "close", label: game.i18n.localize("DRPG.Panel.close"), default: true }
        ],
        rejectClose: false
    });

    if (action === "plan") return openKeyPlanner();
    return null;
}
