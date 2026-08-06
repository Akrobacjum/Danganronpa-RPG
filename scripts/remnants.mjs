/**
 * Danganronpa RPG — Remnants on the map.
 * ---------------------------------------------------------------------------
 * Guide: "Remnants as hidden tokens, so nobody loses track of them."
 *
 * A Remnant is dropped where the character was standing when they left it, and
 * is hidden from players until someone Observes it. Rendering choices, all from
 * the brief: half transparent, and sorted BELOW character tokens so a cluttered
 * crime scene never hides the people in it.
 *
 * They are Tokens rather than Tiles or Notes because tokens carry flags, can be
 * hidden and revealed per-document, and sit on a layer the GM already knows how
 * to manipulate.
 */

import { MODULE_ID, REMNANT_TYPES, REMNANT_VISIBILITY_LABELS } from "./config.mjs";
import { log, warn, error } from "./utils.mjs";

/**
 * Everything the guide says a Remnant carries, recorded on the token so an
 * investigation two sessions later can still answer "where did this come from".
 */
export const REMNANT_FLAGS = {
    isRemnant: "isRemnant",
    /** key | neutral | faint | prep | incident | resolution | autopsy | final */
    type: "remnantType",
    /** obvious | evident | subtle | hidden — how hard it is to spot. */
    visibility: "visibility",
    /** Cannot be removed by the killer in Stage 6. */
    reinforced: "reinforced",
    /** Wiped at chapter end unless tied to a murder. */
    faint: "faint",
    /** Free-text note for the GM. */
    note: "note",
    /** Which action produced it: search | sabotage | project | incident | resolution | manual */
    action: "action",
    /** What was found or done — the item drawn, the project sabotaged. */
    subject: "subject",
    /** Who left it. */
    sourceActor: "sourceActor",
    sourceName: "sourceName",
    /** Room, chapter, day and time of day at the moment it was left. */
    room: "room",
    chapter: "chapter",
    day: "day",
    timeOfDay: "timeOfDay",
    /** Points the finger at this character — used by "Misleading trail". */
    pointsAt: "pointsAt"
};

/** Name of the hidden actor every Remnant token is built from. */
const REMNANT_ACTOR = "Remnant";

const ICON = "icons/svg/hazard.svg";

/** Colour per Remnant type, so a glance at the map reads. */
const TINTS = {
    key: "#f3c267",
    prep: "#9d4edd",
    incident: "#b3324a",
    resolution: "#4ea3dd",
    autopsy: "#c9c9c9",
    faint: "#6b6b6b",
    neutral: "#8a8a8a",
    final: "#ffffff"
};

/* ==========================================================================
 * CREATION
 * ========================================================================== */

/**
 * Drop a Remnant where a character is standing.
 *
 * @param {Actor} actor            Whose position to use.
 * @param {object} options
 * @param {string} options.type    Key from REMNANT_TYPES.
 * @param {string} options.visibility  obvious | evident | subtle | hidden
 * @param {boolean} [options.faint]
 * @param {boolean} [options.reinforced]
 * @param {string} [options.note]  What it actually is, for the GM.
 */
export async function dropRemnant(actor, {
    type = "prep", visibility = "evident", faint = false, reinforced = false,
    note = "", action = "manual", subject = "", pointsAt = null
} = {}) {
    const token = actor?.getActiveTokens?.()?.[0];
    if (!token) {
        warn(`No token for ${actor?.name}; the Remnant was not placed.`);
        return null;
    }

    // Stamp when and where, so an investigation can reconstruct the timeline.
    const { getClock } = await import("./clock.mjs");
    const { roomOfActor } = await import("./movement.mjs");
    const clock = getClock();

    return placeRemnant({
        x: token.document.x,
        y: token.document.y,
        // A scene id, not the Scene itself: this object may travel over a
        // socket to the GM, and a live document does not survive that.
        sceneId: token.document.parent?.id,
        type, visibility, faint, reinforced, note, action, subject, pointsAt,
        sourceActor: actor.id,
        sourceName: actor.name,
        room: roomOfActor(actor),
        chapter: clock.chapter,
        day: clock.day,
        timeOfDay: clock.timeOfDay
    });
}

/**
 * Place a Remnant at explicit coordinates. GM-only: creating tokens needs it,
 * so a player action routes through the GM bridge.
 */
export async function placeRemnant(data = {}) {
    if (!game.user.isGM) {
        const { requestRemnant } = await import("./gm-bridge.mjs");
        return requestRemnant(data);
    }

    const {
        x, y, scene = null, sceneId = null, type = "prep", visibility = "evident",
        faint = false, reinforced = false, note = "", action = "manual",
        subject = "", pointsAt = null, sourceActor = null, sourceName = "",
        room = null, chapter = null, day = null, timeOfDay = null
    } = data;

    const target = scene ?? (sceneId ? game.scenes.get(sceneId) : null) ?? canvas?.scene;
    if (!target) return null;

    const actor = await ensureRemnantActor();
    if (!actor) return null;

    // A Remnant is the GM's own note. Players never see one — Observing it
    // produces a separate Truth Bullet, which the GM fills in. So the name can
    // and should carry everything: who, what, and from which action.
    const kind = `${REMNANT_VISIBILITY_LABELS[visibility] ?? visibility} ${faint ? "Faint " : ""}${REMNANT_TYPES[type]?.label ?? "Remnant"}`;
    const who = sourceName ? ` · ${sourceName}` : "";
    const what = subject
        ? ` · ${actionLabel(action)}: ${subject}`
        : (action && action !== "manual" ? ` · ${actionLabel(action)}` : "");
    const label = `${kind}${who}${what}`;
    const size = canvas?.grid?.size ?? 100;

    try {
        const [created] = await target.createEmbeddedDocuments("Token", [{
            name: label,
            actorId: actor.id,
            actorLink: false,
            x, y,
            width: 0.5,
            height: 0.5,
            texture: { src: ICON, tint: TINTS[type] ?? TINTS.neutral },
            // Half transparent, and below characters: the map must still read
            // as "people in a room", not "a pile of clues".
            alpha: 0.5,
            sort: -10,
            // Always hidden. A Remnant is never revealed to players: Observing
            // one copies it into a Truth Bullet, and that is what they see.
            hidden: true,
            disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL,
            lockRotation: true,
            flags: {
                [MODULE_ID]: {
                    [REMNANT_FLAGS.isRemnant]: true,
                    [REMNANT_FLAGS.type]: type,
                    [REMNANT_FLAGS.visibility]: visibility,
                    [REMNANT_FLAGS.faint]: faint,
                    [REMNANT_FLAGS.reinforced]: reinforced || Boolean(REMNANT_TYPES[type]?.reinforced),
                    [REMNANT_FLAGS.note]: note,
                    [REMNANT_FLAGS.action]: action,
                    [REMNANT_FLAGS.subject]: subject,
                    [REMNANT_FLAGS.pointsAt]: pointsAt,
                    [REMNANT_FLAGS.sourceActor]: sourceActor,
                    [REMNANT_FLAGS.sourceName]: sourceName,
                    [REMNANT_FLAGS.room]: room,
                    [REMNANT_FLAGS.chapter]: chapter,
                    [REMNANT_FLAGS.day]: day,
                    [REMNANT_FLAGS.timeOfDay]: timeOfDay
                }
            }
        }]);

        log(`Remnant placed: ${label} (by ${sourceName || "?"})`);
        if (created) await announceRemnant(created);
        return created ?? null;
    } catch (err) {
        error("Could not place the Remnant", err);
        return null;
    }
}

/** Human-readable name for the action that produced a Remnant. */
function actionLabel(action) {
    const key = `DRPG.Remnant.action.${action}`;
    const label = game.i18n.localize(key);
    return label === key ? action : label;
}

/**
 * Tell the GMs, in chat, the moment a Remnant appears — who left it, doing
 * what, where and when.
 *
 * This replaces an attempted hover tooltip, which could never have worked:
 * `hoverToken` hands you the PIXI placeable, while the tooltip manager needs an
 * HTML element.
 *
 * The culprit is deliberately kept OUT of the token's name. Remnants get
 * revealed to players during an investigation, and a token labelled
 * "…left by Kaede" would hand them the answer instead of a clue.
 */
async function announceRemnant(tokenDoc) {
    const data = remnantData(tokenDoc);
    if (!data) return;

    const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
    const when = [
        data.chapter ? `Chapter ${data.chapter}` : null,
        data.day ? `Day ${data.day}` : null,
        data.timeOfDay
    ].filter(Boolean).join(" · ");

    const { whisperToGms } = await import("./utils.mjs");
    await whisperToGms(`
        <h3>${esc(data.visibilityLabel)} ${esc(data.typeLabel)}${data.faint ? " (Faint)" : ""}</h3>
        <p><strong>${game.i18n.localize("DRPG.Remnant.leftBy")}:</strong> ${esc(data.sourceName || "—")}</p>
        ${data.note ? `<p>${esc(data.note)}</p>` : ""}
        <p><small>${esc(data.room ?? "—")}${when ? ` · ${when}` : ""}${
            data.reinforced ? ` · ${game.i18n.localize("DRPG.Remnant.reinforcedShort")}` : ""
        }</small></p>`);
}

/** The hidden actor Remnant tokens are instances of. Created once. */
async function ensureRemnantActor() {
    let actor = game.actors.getName(REMNANT_ACTOR);
    if (actor) return actor;

    if (!game.user.isGM) return null;

    try {
        actor = await Actor.create({
            name: REMNANT_ACTOR,
            type: "npc",
            img: ICON,
            ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE },
            flags: { [MODULE_ID]: { [REMNANT_FLAGS.isRemnant]: true } }
        });
        log("Created the hidden Remnant actor.");
        return actor;
    } catch (err) {
        error("Could not create the Remnant actor", err);
        return null;
    }
}

/* ==========================================================================
 * QUERYING
 * ========================================================================== */

/** Everything recorded on a Remnant, as a plain object. */
export function remnantData(tokenDoc) {
    const f = key => tokenDoc?.getFlag(MODULE_ID, REMNANT_FLAGS[key]);
    if (!f("isRemnant")) return null;

    return {
        id: tokenDoc.id,
        type: f("type"),
        typeLabel: REMNANT_TYPES[f("type")]?.label ?? f("type"),
        visibility: f("visibility"),
        visibilityLabel: REMNANT_VISIBILITY_LABELS[f("visibility")] ?? f("visibility"),
        faint: Boolean(f("faint")),
        reinforced: Boolean(f("reinforced")),
        action: f("action"),
        subject: f("subject"),
        note: f("note"),
        pointsAt: f("pointsAt"),
        sourceName: f("sourceName"),
        room: f("room"),
        chapter: f("chapter"),
        day: f("day"),
        timeOfDay: f("timeOfDay"),
        hidden: tokenDoc.hidden
    };
}

/** GM-readable summary of every Remnant on the scene. */
export async function reportRemnants(scene = canvas?.scene) {
    const rows = remnantsOn(scene).map(t => remnantData(t)).filter(Boolean).map(r => `
        <tr>
            <td>${foundry.utils.escapeHTML(r.visibilityLabel)} ${foundry.utils.escapeHTML(r.typeLabel)}${r.faint ? " (Faint)" : ""}${r.reinforced ? " ★" : ""}</td>
            <td>${foundry.utils.escapeHTML(r.room ?? "—")}</td>
            <td>${foundry.utils.escapeHTML(r.sourceName ?? "—")}<br><small>${foundry.utils.escapeHTML(r.action ?? "")}${r.subject ? `: ${foundry.utils.escapeHTML(r.subject)}` : ""}</small></td>
            <td>Ch ${r.chapter ?? "?"} · D ${r.day ?? "?"}<br><small>${foundry.utils.escapeHTML(r.timeOfDay ?? "")}</small></td>
            <td>${r.hidden ? "hidden" : "revealed"}</td>
        </tr>`).join("");

    const { whisperToGms } = await import("./utils.mjs");
    return whisperToGms(rows
        ? `<h3>Remnants</h3><table><thead><tr><th>What</th><th>Room</th><th>Left by</th><th>When</th><th></th></tr></thead><tbody>${rows}</tbody></table>
           <p><small>★ = reinforced, cannot be removed by the killer.</small></p>`
        : `<h3>Remnants</h3><p>None on this scene.</p>`);
}

/** Every Remnant token on a scene. */
export function remnantsOn(scene = canvas?.scene) {
    if (!scene) return [];
    return scene.tokens.filter(t => t.getFlag(MODULE_ID, REMNANT_FLAGS.isRemnant));
}

/** Remnants inside a named room region. */
export function remnantsInRoom(room, scene = canvas?.scene) {
    if (!room) return [];
    return remnantsOn(scene).filter(t => {
        const names = Array.from(t.regions ?? [])
            .map(r => (typeof r === "string" ? scene.regions?.get(r) : r))
            .filter(Boolean).map(r => r.name);
        return names.includes(room);
    });
}

/**
 * Reveal a Remnant on the map.
 *
 * Rarely what you want: the intended flow is that a player Observes a Remnant
 * and receives a Truth Bullet, leaving the Remnant itself the GM's note. This
 * exists for the cases where the GM genuinely wants the token on the table.
 */
export async function revealRemnant(tokenDoc) {
    if (!game.user.isGM || !tokenDoc) return null;
    ui.notifications.warn(game.i18n.localize("DRPG.Remnant.revealWarning"));
    return tokenDoc.update({ hidden: false });
}

/** Remove one — the killer wiped it clean. */
export async function removeRemnant(tokenDoc) {
    if (!game.user.isGM || !tokenDoc) return null;
    if (tokenDoc.getFlag(MODULE_ID, REMNANT_FLAGS.reinforced)) {
        ui.notifications.warn(game.i18n.localize("DRPG.Remnant.reinforced"));
        return null;
    }
    return tokenDoc.delete();
}

/**
 * Chapter end: the guide clears every Faint Remnant not tied to a murder,
 * a crime tool or a cleaning tool.
 */
export async function clearFaintRemnants(scene = canvas?.scene) {
    if (!game.user.isGM) return 0;

    const doomed = remnantsOn(scene).filter(t =>
        t.getFlag(MODULE_ID, REMNANT_FLAGS.faint) &&
        !t.getFlag(MODULE_ID, REMNANT_FLAGS.reinforced));

    if (!doomed.length) return 0;
    await scene.deleteEmbeddedDocuments("Token", doomed.map(t => t.id));
    log(`Cleared ${doomed.length} Faint Remnant(s).`);
    return doomed.length;
}
