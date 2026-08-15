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

import { MODULE_ID, REMNANT_TYPES, REMNANT_VISIBILITY_LABELS, observeDc } from "./config.mjs";
// Statically imported: `remnantsInRoom` is synchronous, and movement.mjs does
// not reach back into this file, so there is no cycle to break.
import { roomOfToken } from "./movement.mjs";
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
    /**
     * Left by a crime tool, a cleaning tool or the murder itself. The guide's
     * exception to the chapter-end sweep: "wiped at chapter end **unless tied
     * to the murder or a tool**". Without this the sweep deleted exactly the
     * traces the investigation was supposed to find.
     */
    tiedToCrime: "tiedToCrime",
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

/**
 * The token to drop a Remnant on.
 *
 * `getActiveTokens()` only returns tokens that are *rendered* and on the scene
 * this client is currently looking at, so it comes back empty often enough to
 * matter — a GM resolving something on another scene, a canvas mid-load. The
 * scene's own token list is checked as well, which needs neither.
 */
function tokenFor(actor) {
    if (!actor) return null;

    const active = actor.getActiveTokens?.()?.[0];
    if (active?.document) return active;

    for (const scene of [canvas?.scene, ...game.scenes]) {
        if (!scene) continue;
        const doc = scene.tokens.find(t => t.actorId === actor.id);
        if (doc) return { document: doc };
    }
    return null;
}

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
    note = "", action = "manual", subject = "", pointsAt = null, tiedToCrime = false
} = {}) {
    const token = tokenFor(actor);
    if (!token) {
        // Loud, not silent. This used to warn to the console and return null, so
        // an action reported "you leave a trace behind" while no Remnant existed
        // anywhere — the one failure the investigation can never recover from.
        warn(`No token for ${actor?.name}; the Remnant was not placed.`);
        ui.notifications.error(game.i18n.format("DRPG.Remnant.noToken", {
            actor: actor?.name ?? "?"
        }));
        const { whisperToGms } = await import("./utils.mjs");
        await whisperToGms(`<p class="drpg-warning">${game.i18n.format("DRPG.Remnant.noTokenGm", {
            actor: foundry.utils.escapeHTML(actor?.name ?? "?"),
            action: foundry.utils.escapeHTML(action)
        })}</p>`);
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
        type, visibility, faint, reinforced, note, action, subject, pointsAt, tiedToCrime,
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
        subject = "", pointsAt = null, tiedToCrime = false,
        sourceActor = null, sourceName = "",
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
            // Full grid square, same as a character.
            //
            // At half size these were genuinely hard to see and harder to click,
            // which matters for the one kind of token a GM manipulates most: a
            // crime scene ends up with several of them and they have to be
            // told apart at a glance. `sort: -10` below still keeps them under
            // the cast, so a crowded room still reads as people first.
            width: 1,
            height: 1,
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
                    [REMNANT_FLAGS.tiedToCrime]: Boolean(tiedToCrime),
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
        tiedToCrime: Boolean(f("tiedToCrime")),
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

/**
 * GM-readable summary of every Remnant.
 *
 * Every scene by default, matching `clearFaintRemnants`: the two were reading
 * from different worlds — the sweep already covered every scene, so a GM
 * checking this report first could be told "None" while Remnants the very next
 * chapter-end sweep was about to delete sat untouched on a scene the report
 * never looked at. Pass an explicit `scene` to scope it to one, same as before.
 */
export async function reportRemnants(scene = null) {
    const scenes = scene ? [scene] : Array.from(game.scenes);
    const multi = scenes.length > 1;

    const rows = scenes.flatMap(s =>
        remnantsOn(s).map(t => remnantData(t)).filter(Boolean).map(r => `
        <tr>
            <td>${foundry.utils.escapeHTML(r.visibilityLabel)} ${foundry.utils.escapeHTML(r.typeLabel)}${r.faint ? " (Faint)" : ""}${r.reinforced ? " ★" : ""}</td>
            ${multi ? `<td>${foundry.utils.escapeHTML(s.name)}</td>` : ""}
            <td>${foundry.utils.escapeHTML(r.room ?? "—")}</td>
            <td>${foundry.utils.escapeHTML(r.sourceName ?? "—")}<br><small>${foundry.utils.escapeHTML(r.action ?? "")}${r.subject ? `: ${foundry.utils.escapeHTML(r.subject)}` : ""}</small></td>
            <td>Ch ${r.chapter ?? "?"} · D ${r.day ?? "?"}<br><small>${foundry.utils.escapeHTML(r.timeOfDay ?? "")}</small></td>
            <td>${r.hidden ? "hidden" : "revealed"}</td>
        </tr>`)
    ).join("");

    const { whisperToGms } = await import("./utils.mjs");
    return whisperToGms(rows
        ? `<h3>Remnants</h3><table><thead><tr><th>What</th>${multi ? "<th>Scene</th>" : ""}<th>Room</th><th>Left by</th><th>When</th><th></th></tr></thead><tbody>${rows}</tbody></table>
           <p><small>★ = reinforced, cannot be removed by the killer.</small></p>`
        : `<h3>Remnants</h3><p>${scene ? "None on this scene." : "None anywhere."}</p>`);
}

/* ==========================================================================
 * GM: EDITING WHAT A REMNANT IS
 * --------------------------------------------------------------------------
 * Three flags decide whether a trace is still on the map when the chapter ends,
 * and until now all three could only be chosen at the moment it was created —
 * which is exactly the wrong moment. Whether a Remnant turns out to be tied to
 * the crime is usually only clear once the murder has happened, several times of
 * day after the Search that dropped it.
 *
 * So the GM can change their mind here:
 *   Faint          wiped at chapter end (guide: "doubtful connection to the case")
 *   Tied to crime  the guide's exception to that sweep — survives it
 *   Reinforced     the killer cannot remove it at all
 * ========================================================================== */

/** Set the sweep-related flags on one Remnant token. GM only. */
export async function setRemnantFlags(tokenDoc, { faint = null, tiedToCrime = null, reinforced = null } = {}) {
    if (!game.user.isGM || !tokenDoc) return null;

    const update = {};
    if (faint !== null) update[`flags.${MODULE_ID}.${REMNANT_FLAGS.faint}`] = Boolean(faint);
    if (tiedToCrime !== null) update[`flags.${MODULE_ID}.${REMNANT_FLAGS.tiedToCrime}`] = Boolean(tiedToCrime);
    if (reinforced !== null) update[`flags.${MODULE_ID}.${REMNANT_FLAGS.reinforced}`] = Boolean(reinforced);
    if (!Object.keys(update).length) return null;

    await tokenDoc.update(update);
    return tokenDoc;
}

/**
 * Table of every Remnant on the scene, with its three flags editable.
 *
 * Deliberately a table rather than a per-token control: the question the GM is
 * actually asking at chapter end is "which of these survive", and that is a
 * question about the whole scene at once.
 */
/**
 * Count the Faint traces that would go, confirm, then clear them.
 *
 * Counted BEFORE the confirmation, not after: these tokens do not come back,
 * and "delete 14 things?" is a question a GM can answer while "deleted 14
 * things" is only a report. Lives here rather than in the GM panel because the
 * button that calls it now sits on the Remnant table.
 */
export async function confirmClearFaint() {
    const DialogV2 = foundry.applications.api.DialogV2;

    let doomed = 0;
    for (const scene of game.scenes) {
        doomed += remnantsOn(scene).filter(t => {
            const d = remnantData(t);
            return d?.faint && !d.reinforced && !d.tiedToCrime;
        }).length;
    }

    if (!doomed) {
        ui.notifications.info(game.i18n.localize("DRPG.Panel.faintNone"));
        return 0;
    }

    const sure = await DialogV2.confirm({
        window: { title: game.i18n.localize("DRPG.Panel.clearFaint") },
        classes: ["drpg-panel"],
        content: `<p>${game.i18n.format("DRPG.Panel.faintConfirm", { n: doomed })}</p>
                  <p class="notes">${game.i18n.localize("DRPG.Panel.faintConfirmNote")}</p>`,
        rejectClose: false
    });
    if (!sure) return 0;

    const cleared = await clearFaintRemnants();
    ui.notifications.info(game.i18n.format("DRPG.Panel.faintCleared", { n: cleared }));
    return cleared;
}

export async function openRemnantManager(scene = canvas?.scene) {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const DialogV2 = foundry.applications.api.DialogV2;
    const tokens = remnantsOn(scene);

    if (!tokens.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Remnant.noneHere"));
        return null;
    }

    const esc = s => foundry.utils.escapeHTML(String(s ?? ""));

    const rows = tokens.map(t => {
        const r = remnantData(t);
        if (!r) return "";
        const when = [r.chapter ? `Ch ${r.chapter}` : null, r.day ? `D ${r.day}` : null, r.timeOfDay]
            .filter(Boolean).join(" · ");
        return `<tr>
            <td>
                <strong>${esc(r.visibilityLabel)} ${esc(r.typeLabel)}</strong>
                <br><small>${esc(r.room ?? "—")}${when ? ` · ${esc(when)}` : ""}</small>
                <br><small>${esc(r.sourceName ?? "—")}${r.subject ? ` · ${esc(r.subject)}` : ""}</small>
            </td>
            <td style="text-align:center"><input type="checkbox" name="faint.${t.id}" ${r.faint ? "checked" : ""} /></td>
            <td style="text-align:center"><input type="checkbox" name="crime.${t.id}" ${r.tiedToCrime ? "checked" : ""} /></td>
            <td style="text-align:center"><input type="checkbox" name="reinf.${t.id}" ${r.reinforced ? "checked" : ""} /></td>
        </tr>`;
    }).join("");

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Remnant.manageTitle") },
        classes: ["drpg-panel", "drpg-projects"],
        content: `<form>
            <p>${game.i18n.localize("DRPG.Remnant.manageIntro")}</p>
            <table>
                <thead><tr>
                    <th>${game.i18n.localize("DRPG.Remnant.what")}</th>
                    <th>${game.i18n.localize("DRPG.Remnant.faintColumn")}</th>
                    <th>${game.i18n.localize("DRPG.Remnant.crimeColumn")}</th>
                    <th>${game.i18n.localize("DRPG.Remnant.reinforcedColumn")}</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
            <p class="notes">${game.i18n.localize("DRPG.Remnant.manageNote")}</p>
        </form>`,
        buttons: [
            {
                action: "save",
                label: game.i18n.localize("DRPG.Assign.save"),
                default: true,
                callback: (e, b, d) => {
                    const form = d.element.querySelector("form");
                    return tokens.map(t => ({
                        id: t.id,
                        faint: form.querySelector(`[name="faint.${CSS.escape(t.id)}"]`)?.checked ?? false,
                        tiedToCrime: form.querySelector(`[name="crime.${CSS.escape(t.id)}"]`)?.checked ?? false,
                        reinforced: form.querySelector(`[name="reinf.${CSS.escape(t.id)}"]`)?.checked ?? false
                    }));
                }
            },
            // Used to be its own GM-panel tile. Clearing the Faint traces is a
            // decision made while looking at exactly this table — which ones are
            // Faint, which are tied to the crime — so the button belongs on it.
            { action: "clearFaint", label: game.i18n.localize("DRPG.Panel.clearFaint") },
            { action: "cancel", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return null;

    if (result === "clearFaint") {
        await confirmClearFaint();
        return openRemnantManager();          // back to the table it was pressed on
    }

    let changed = 0;
    for (const entry of result) {
        const token = tokens.find(t => t.id === entry.id);
        if (!token) continue;
        const before = remnantData(token);
        if (before.faint === entry.faint
            && before.tiedToCrime === entry.tiedToCrime
            && before.reinforced === entry.reinforced) continue;

        await setRemnantFlags(token, entry);
        changed += 1;
    }

    ui.notifications.info(game.i18n.format("DRPG.Remnant.manageSaved", { n: changed }));
    log(`Remnant flags updated on ${changed} token(s).`);
    return changed;
}

/**
 * Change or remove a Remnant that has already been placed.
 *
 * Reroll needs this: a trace whose visibility came from a roll that has just
 * been taken back is wrong, and a trace left by an action that no longer
 * succeeds should not be on the map at all. Creating and deleting tokens is
 * GM-only, so a player's reroll routes through the bridge exactly as placing one
 * does.
 *
 * @param {string} sceneId
 * @param {string} tokenId
 * @param {object} patch
 * @param {string} [patch.visibility]  New visibility band.
 * @param {boolean} [patch.remove]     Delete it outright.
 * @returns {Promise<boolean|object|null>}
 */
export async function retuneRemnant(sceneId, tokenId, { visibility = null, remove = false } = {}) {
    if (!tokenId) return null;

    if (!game.user.isGM) {
        const { requestRemnantEdit } = await import("./gm-bridge.mjs");
        return requestRemnantEdit(sceneId, tokenId, { visibility, remove });
    }

    const scene = (sceneId ? game.scenes.get(sceneId) : null) ?? canvas?.scene;
    const token = scene?.tokens?.get(tokenId);
    if (!token) return null;

    if (remove) {
        // A reinforced Remnant is one the killer may not wipe. A reroll is not
        // the killer, but the rule is worth honouring: the GM placed it to make
        // the case solvable.
        if (token.getFlag(MODULE_ID, REMNANT_FLAGS.reinforced)) return null;
        await token.delete();
        return true;
    }

    if (!visibility) return null;

    // The band is carried in the flag and echoed in the token's name, which is
    // what the GM actually reads on the map — so both have to move together.
    const current = remnantData(token);
    const label = String(token.name ?? "");
    const oldLabel = REMNANT_VISIBILITY_LABELS[current?.visibility] ?? current?.visibility ?? "";
    const newLabel = REMNANT_VISIBILITY_LABELS[visibility] ?? visibility;

    await token.update({
        name: oldLabel && label.startsWith(oldLabel)
            ? `${newLabel}${label.slice(oldLabel.length)}`
            : label,
        [`flags.${MODULE_ID}.${REMNANT_FLAGS.visibility}`]: visibility
    });
    return true;
}

/**
 * The Remnants in a room, ordered the way Observe wants to read them.
 *
 * Two rules from the guide, applied in this order:
 *
 *   "DM zawsze w pierwszej kolejności pokazuje Remnants związane z zabójstwem"
 *      — anything tied to the crime outranks everything else, whichever end of
 *        the difficulty scale the player asked for.
 *   "Najłatwiejszy / najtrudniejszy remnant w pokoju"
 *      — within a group, order by the actual Observe DC rather than by
 *        visibility alone. A Hidden Key Remnant (15) really is easier to find
 *        than a Subtle Prep one (15 as well) is to beat by luck, and an Obvious
 *        Faint (12) is harder than an Obvious Key (6) despite being "obvious".
 *        Visibility is only half of the number the guide prints.
 *
 * Autopsy Remnants are dropped: their column says "no roll", because the
 * Autopsy bullet is handed out rather than found.
 *
 * @returns {Array<{token: TokenDocument, data: object, dc: number}>} easiest first.
 */
export function rankForObserve(room, scene = canvas?.scene) {
    const ranked = remnantsInRoom(room, scene)
        .map(token => {
            const data = remnantData(token);
            if (!data) return null;
            const dc = observeDc(data.visibility, data.type);
            return dc === null ? null : { token, data, dc };
        })
        .filter(Boolean);

    return ranked.sort((a, b) => {
        if (a.data.tiedToCrime !== b.data.tiedToCrime) return a.data.tiedToCrime ? -1 : 1;
        return a.dc - b.dc;
    });
}

/** Every Remnant token on a scene. */
export function remnantsOn(scene = canvas?.scene) {
    if (!scene) return [];
    return scene.tokens.filter(t => t.getFlag(MODULE_ID, REMNANT_FLAGS.isRemnant));
}

/**
 * Remnants inside a named room region.
 *
 * Resolved through `roomOfToken`, which falls back to a geometric test when a
 * token's region set is empty. Reading `t.regions` directly returned nothing at
 * all here: Remnant tokens are created by script, and Foundry has not populated
 * their region membership at that point.
 */
export function remnantsInRoom(room, scene = canvas?.scene) {
    if (!room) return [];
    return remnantsOn(scene).filter(t => roomOfToken(t) === room);
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
export async function clearFaintRemnants(scene = null) {
    if (!game.user.isGM) return 0;

    // Every scene by default, not just the one on screen. A chapter ends for the
    // whole season, and Remnants left in rooms nobody is currently looking at
    // were quietly surviving the sweep.
    const scenes = scene ? [scene] : Array.from(game.scenes);
    let cleared = 0;

    for (const target of scenes) {
        const doomed = remnantsOn(target).filter(t => {
            if (!t.getFlag(MODULE_ID, REMNANT_FLAGS.faint)) return false;
            if (t.getFlag(MODULE_ID, REMNANT_FLAGS.reinforced)) return false;
            // The guide's exception, which this function claimed to honour and
            // did not: anything left by a crime tool, a cleaning tool or the
            // murder stays. Those are the traces the trial is built on.
            if (t.getFlag(MODULE_ID, REMNANT_FLAGS.tiedToCrime)) return false;
            return true;
        });

        if (!doomed.length) continue;
        await target.deleteEmbeddedDocuments("Token", doomed.map(t => t.id));
        cleared += doomed.length;
    }

    log(`Cleared ${cleared} Faint Remnant(s) across ${scenes.length} scene(s).`);
    return cleared;
}
