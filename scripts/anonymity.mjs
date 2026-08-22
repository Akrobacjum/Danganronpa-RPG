/**
 * Danganronpa RPG — sheet anonymity.
 * ---------------------------------------------------------------------------
 * Guide: "Character sheets are anonymous during play — other players have no
 * access to someone else's sheet."
 *
 * In Foundry that means `ownership.default` must stay at NONE on every
 * character. A single stray OBSERVER hands the whole table someone's stats,
 * inventory and Truth Bullets, so this guards both creation and updates and
 * gives the GM an audit they can run before a session.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { whisperToGms, warn, debug } from "./utils.mjs";

const NONE = 0; // CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE

export function registerAnonymity() {
    Hooks.on("preCreateActor", onPreCreateActor);
    Hooks.on("preUpdateActor", onPreUpdateActor);
    // ONE hook only. ApplicationV2 fires a render hook for every class in the
    // inheritance chain, so listening to both the concrete sheet and its base
    // class ran this twice and produced two identical errors.
    Hooks.on("renderActorSheetV2", onRenderSheet);
}

/** Sheets already refused this render, so we only complain once. */
const refused = new Set();

/**
 * Last line of defence: close a character sheet a player should not be reading.
 *
 * Ownership already stops most routes, but a sheet can still be reached through
 * a token they can see, a chat card, or a compendium copy. In a killing game a
 * single glance at someone else's inventory is the whole mystery, so the sheet
 * is closed outright rather than trusted to be empty.
 */
function onRenderSheet(app, element) {
    try {
        if (game.user.isGM || !enforcing()) return;

        const actor = app?.document;
        if (!actor || actor.type !== "character") return;
        if (actor.testUserPermission(game.user, "OWNER")) return;

        // Not ours. Shut it, quietly and exactly once.
        const root = element instanceof HTMLElement ? element : element?.[0];
        if (root) root.style.display = "none";

        const key = `${actor.id}:${app.id}`;
        if (!refused.has(key)) {
            refused.add(key);
            setTimeout(() => refused.delete(key), 2000);
            ui.notifications.warn(game.i18n.localize("DRPG.Anonymity.notYours"));
            warn(`Closed ${actor.name}'s sheet — not owned by ${game.user.name}.`);
        }

        // `force` skips the submit/close pipeline that was throwing.
        app.close({ force: true, animate: false }).catch(() => {});
    } catch {
        // Never let this break a sheet the player is entitled to.
    }
}

function enforcing() {
    try {
        return game.settings.get(MODULE_ID, SETTINGS.enforceAnonymity);
    } catch {
        return false;
    }
}

/** New characters are private by default, whatever the folder says. */
function onPreCreateActor(actor, data) {
    if (actor.type !== "character" || !enforcing()) return;
    if ((data.ownership?.default ?? NONE) <= NONE) return;

    actor.updateSource({ "ownership.default": NONE });
    warn(`Forced default ownership to NONE on new character "${data.name}".`);
    if (game.user.isGM) ui.notifications.info(game.i18n.localize("DRPG.Anonymity.forcedOnCreate"));
}

/** Block anyone raising default ownership on an existing character. */
function onPreUpdateActor(actor, changes) {
    if (actor.type !== "character" || !enforcing()) return;

    const next = changes.ownership?.default;
    if (next === undefined || next <= NONE) return;

    delete changes.ownership.default;
    if (!Object.keys(changes.ownership).length) delete changes.ownership;

    ui.notifications.warn(game.i18n.format("DRPG.Anonymity.blocked", { actor: actor.name }));
    debug(`Blocked a default-ownership raise on "${actor.name}".`);
}

/* ==========================================================================
 * AUDIT
 * ========================================================================== */

/**
 * Everyone who can open this actor's sheet, with enough detail to explain why.
 *
 * Note: `User#isGM` is true for Assistant GMs as well as full GMs. An Assistant
 * playing a student would be invisible to a naive "not a GM" filter *and* able
 * to read every other sheet, so assistants are reported separately rather than
 * quietly skipped.
 */
export function explainOwnership(actor) {
    const roles = CONST.USER_ROLES;
    const entries = [];

    for (const user of game.users) {
        const level = actor.getUserLevel(user);
        if (level === null || level <= NONE) continue;

        entries.push({
            user,
            level,
            levelName: Object.entries(CONST.DOCUMENT_OWNERSHIP_LEVELS).find(([, v]) => v === level)?.[0] ?? String(level),
            isFullGm: user.role === roles.GAMEMASTER,
            isAssistant: user.role === roles.ASSISTANT,
            isPlayer: user.role < roles.ASSISTANT
        });
    }

    return {
        actor,
        defaultLevel: actor.ownership?.default ?? NONE,
        entries,
        playerOwners: entries.filter(e => e.isPlayer && e.level >= 3),
        assistantOwners: entries.filter(e => e.isAssistant && e.level >= 3)
    };
}

/**
 * Inspect every character and report anything that leaks. Returns the findings
 * and, unless told otherwise, whispers a report to the GMs.
 */
export async function auditAnonymity({ toChat = true } = {}) {
    const exposed = [];
    const shared = [];
    const orphaned = [];
    const assistants = [];

    for (const actor of game.actors) {
        if (actor.type !== "character") continue;

        const info = explainOwnership(actor);

        if (info.defaultLevel > NONE) exposed.push(info);
        if (info.assistantOwners.length) assistants.push(info);
        if (info.playerOwners.length > 1) shared.push(info);
        if (info.playerOwners.length === 0 && info.assistantOwners.length === 0) orphaned.push(info);
    }

    const findings = { exposed, shared, orphaned, assistants };

    const sections = [];

    if (exposed.length) {
        sections.push(section("DRPG.Anonymity.audit.exposed", exposed.map(i =>
            `${escape(i.actor.name)} — default is <strong>${levelName(i.defaultLevel)}</strong>`
        )));
    }

    if (assistants.length) {
        sections.push(section("DRPG.Anonymity.audit.assistants", assistants.map(i =>
            `${escape(i.actor.name)} — ${i.assistantOwners.map(e => escape(e.user.name)).join(", ")}`
        )));
    }

    if (shared.length) {
        sections.push(section("DRPG.Anonymity.audit.shared", shared.map(i =>
            `${escape(i.actor.name)} — ${i.playerOwners.map(e => escape(e.user.name)).join(", ")}`
        )));
    }

    if (orphaned.length) {
        sections.push(section("DRPG.Anonymity.audit.orphaned", orphaned.map(i => {
            // Say who *does* have access, so "no owner" is never a mystery.
            const others = i.entries.length
                ? i.entries.map(e => `${escape(e.user.name)}: ${levelName(e.level)}${e.isFullGm ? " (GM)" : e.isAssistant ? " (Assistant GM)" : ""}`).join(", ")
                : game.i18n.localize("DRPG.Anonymity.audit.nobody");
            return `${escape(i.actor.name)} — ${others}`;
        })));
    }

    const body = sections.length
        ? sections.join("")
        : `<p>${game.i18n.localize("DRPG.Anonymity.audit.clean")}</p>`;

    // The rendered body travels back with the findings, so a caller that puts
    // the answer on screen itself gets the same prose the whisper would have
    // carried instead of reassembling it worse.
    findings.body = body;

    if (!toChat) return findings;

    await whisperToGms(`<h3>${game.i18n.localize("DRPG.Anonymity.audit.title")}</h3>${body}`);
    return findings;
}

function levelName(level) {
    return Object.entries(CONST.DOCUMENT_OWNERSHIP_LEVELS).find(([, v]) => v === level)?.[0] ?? String(level);
}

function section(labelKey, lines) {
    const items = lines.map(l => `<li>${l}</li>`).join("");
    return `<p><strong>${game.i18n.localize(labelKey)}</strong></p><ul>${items}</ul>`;
}

function escape(text) {
    return foundry.utils.escapeHTML(String(text ?? ""));
}
