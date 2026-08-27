/**
 * Danganronpa RPG — what one student may see of another.
 * ---------------------------------------------------------------------------
 * THE GUIDE SAYS SHEETS ARE PRIVATE, AND THIS FILE USED TO ENFORCE THAT:
 * "Character sheets are anonymous during play — other players have no access to
 * someone else's sheet." Ownership was pinned at NONE and any sheet that reached
 * a non-owner was closed on sight.
 *
 * Since E9 it is a REDACTION rather than a refusal (Dawid, 27.08 — recorded as
 * G-44). Some of what a sheet holds is not secret in the fiction at all: you can
 * see that somebody is hurt, and you can see what they are holding. Making the
 * interface hide those was making players ask for information the room already
 * gives them. So another student's sheet opens, and shows:
 *
 *     name, portrait, Ultimate, Health, Sanity, and the one thing in their hands
 *
 * and everything else — actions, Hope, the inventory, the biography, the Truth
 * Bullets — sits behind a pixel question mark. The lock is decoration: it does
 * not open, and it is not meant to. Its job is to say THERE IS SOMETHING HERE,
 * because an empty panel and a hidden one must not look alike.
 *
 * HOW THE HIDING ACTUALLY WORKS, and it is not this file.
 *
 * Daggerheart's character sheet declares a `limited` part and
 * `_configureRenderParts` returns THAT PART ALONE to a viewer whose permission
 * is exactly LIMITED. So the sidebar, the tabs, the inventory and the biography
 * are never built, never sent to the DOM, and never in reach of a right-click.
 * This file's job is therefore the smaller and safer one: keep the permission at
 * exactly LIMITED, trim the handful of Daggerheart concepts the limited view
 * shows and this game does not use, and add the six things above.
 *
 * "EXACTLY" IS LOAD-BEARING. `testUserPermission(user, "LIMITED", {exact: true})`
 * is what the system checks, so OBSERVER does not mean "a bit more" — it means
 * the whole sheet. Raising a student above LIMITED is the one mistake that
 * undoes all of this, which is why the guard below now watches that direction.
 *
 * AND IT IS A CURTAIN, NOT A WALL. Foundry sends every world document to every
 * client, so a player with a console can read anything here regardless. That was
 * equally true of the old closed sheet. It means only one thing, and it is worth
 * writing down: nothing may sit behind that lock whose leak would spoil the
 * game.
 */

import { MODULE_ID, FLAGS, ITEM_CATEGORIES } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { remaining, resourceMax } from "./character.mjs";
import { rolesOf } from "./inventory.mjs";
import { readiedItem } from "./use-items.mjs";
import { whisperToGms, warn, debug, error } from "./utils.mjs";

const NONE = 0;    // CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE
const LIMITED = 1; // …LIMITED — exactly this, or the whole sheet opens.

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
 * Somebody else's sheet: keep the six public things, lock the rest.
 *
 * Runs only on the limited view, which is the only thing the system built for
 * this viewer. Everything removed below is a Daggerheart concept this game does
 * not use (class, subclass, community, ancestry, level, domains) or something
 * the decision above puts behind the lock (the biography characteristics —
 * pronouns, age and faith are biography, and biography is not public).
 */
function onRenderSheet(app, element) {
    try {
        if (game.user.isGM || !enforcing()) return;

        const actor = app?.document;
        if (!actor || actor.type !== "character") return;
        if (actor.testUserPermission(game.user, "OWNER")) return;

        const root = element instanceof HTMLElement ? element : element?.[0];
        const box = root?.querySelector(".limited-container");
        // No limited view means the system rendered something else entirely —
        // a sheet class we do not know, or a permission above LIMITED that the
        // guard failed to hold. Say so rather than dressing the wrong window.
        if (!box) {
            warn(`No limited view on ${actor.name}'s sheet; leaving it alone.`);
            return;
        }

        for (const gone of box.querySelectorAll(
            ".character-details, .level-details, .domain-details, .bio-details"
        )) gone.remove();

        // Idempotent: the sheet re-renders on every change to the actor, and a
        // second card under the first is worse than no card.
        box.querySelector(".drpg-redacted")?.remove();
        box.append(buildRedactedCard(actor));
        root.classList.add("drpg-redacted-sheet");
    } catch (err) {
        // A sheet that failed to be dressed is still only the limited view —
        // the system never built the rest of it — so this can fail safely.
        error("Could not redact a character sheet", err);
    }
}

/** What one student may see of another. */
function buildRedactedCard(actor) {
    const card = document.createElement("div");
    card.className = "drpg-redacted";

    const esc = foundry.utils.escapeHTML;
    const ultimate = actor.getFlag(MODULE_ID, FLAGS.ultimate) || "—";

    /*
     * POINTS, NOT A STATE (Dawid, 27.08).
     *
     * Both are reverse resources — the stored value counts marks taken — so
     * what a player reads is max minus marks, which is what `remaining` gives.
     * Exact numbers make the morning after a body is found into a list of
     * suspects, and that is the intended cost.
     */
    const hp = `${remaining(actor, "hitPoints")} / ${resourceMax(actor, "hitPoints")}`;
    const sanity = `${remaining(actor, "stress")} / ${resourceMax(actor, "stress")}`;

    card.innerHTML = `
        <dl class="drpg-redacted-vitals">
            <div><dt>${game.i18n.localize("DRPG.Redacted.ultimate")}</dt><dd>${esc(ultimate)}</dd></div>
            <div><dt>${game.i18n.localize("DRPG.Redacted.health")}</dt><dd>${hp}</dd></div>
            <div><dt>${game.i18n.localize("DRPG.Redacted.sanity")}</dt><dd>${sanity}</dd></div>
        </dl>
        <div class="drpg-redacted-hand">${handLine(actor)}</div>
        <div class="drpg-redacted-locked">
            <p class="notes">${game.i18n.localize("DRPG.Redacted.lockedNote")}</p>
            <div class="drpg-redacted-tiles">${LOCKED_PANELS.map(key =>
                `<div class="drpg-redacted-tile"><i aria-hidden="true"></i><span>${
                    game.i18n.localize(`DRPG.Redacted.panel.${key}`)}</span></div>`).join("")}</div>
        </div>`;

    return card;
}

/**
 * What is in their hands, and nothing about what else they are carrying.
 *
 * The sharpest line on this card. One thing may be readied at a time (E9), so
 * this is a single legible public fact: a student walking around with a knife
 * out is a student who chose to. It also makes readying a social act, which is
 * the point rather than a side effect.
 */
function handLine(actor) {
    const esc = foundry.utils.escapeHTML;
    const label = game.i18n.localize("DRPG.Redacted.inHand");
    const item = readiedItem(actor);
    if (!item) {
        return `<span class="dt">${label}</span>
                <span class="dd empty">${game.i18n.localize("DRPG.Redacted.emptyHanded")}</span>`;
    }

    const tags = [actor.items.get(item.id)?.getFlag(MODULE_ID, "category"), ...rolesOf(item)]
        .filter(Boolean)
        .map(role => `<span class="drpg-tb-badge drpg-role-${role}">${
            esc(ITEM_CATEGORIES[role]?.label ?? role)}</span>`).join("");

    return `<span class="dt">${label}</span>
            <span class="dd"><img src="${item.img}" alt="" />${esc(item.name)}
            <span class="drpg-tb-badges">${tags}</span></span>`;
}

/** The panels that exist and are not yours to read. */
const LOCKED_PANELS = ["actions", "hope", "inventory", "biography", "evidence"];

function enforcing() {
    try {
        return game.settings.get(MODULE_ID, SETTINGS.enforceAnonymity);
    } catch {
        return false;
    }
}

/**
 * New characters open at exactly LIMITED.
 *
 * Not NONE any more: at NONE the sheet does not open at all, and the redacted
 * view is a window nobody could reach. Not higher either — see the header.
 */
function onPreCreateActor(actor, data) {
    if (actor.type !== "character" || !enforcing()) return;
    if ((data.ownership?.default ?? NONE) === LIMITED) return;

    actor.updateSource({ "ownership.default": LIMITED });
    debug(`Set default ownership to LIMITED on new character "${data.name}".`);
}

/**
 * Stop anyone raising a student ABOVE limited.
 *
 * The direction of the danger has turned over. It used to be that any sharing
 * at all was the leak; now the leak is precisely OBSERVER, because the system
 * asks for LIMITED *exactly* and anything above it renders the entire sheet —
 * inventory, Truth Bullets and all. Lowering to NONE is not blocked: a GM who
 * wants one character sealed shut is making a ruling, and the only thing they
 * lose is a window that would have shown a portrait.
 */
function onPreUpdateActor(actor, changes) {
    if (actor.type !== "character" || !enforcing()) return;

    const next = changes.ownership?.default;
    if (next === undefined || next <= LIMITED) return;

    delete changes.ownership.default;
    if (!Object.keys(changes.ownership).length) delete changes.ownership;

    ui.notifications.warn(game.i18n.format("DRPG.Anonymity.blocked", { actor: actor.name }));
    debug(`Blocked a default-ownership raise on "${actor.name}" — LIMITED is the ceiling.`);
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
