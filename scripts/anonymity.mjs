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
 * gives them.
 *
 * SO THE SHEET KEEPS ITS SHAPE (Dawid, 27.08, second pass). The first attempt
 * used Daggerheart's own `limited` part, which is safe — the other parts are
 * never built at all — and wrong to look at: no tabs, no traits, no anything,
 * just a card. A sheet that has been emptied tells you nothing about the person;
 * a sheet that has been CENSORED tells you there is a person there. So the whole
 * sheet renders, and this file takes things out of it:
 *
 *     shown        name, portrait, Ultimate, Health, Sanity, what is in their
 *                  hands, and how many Experiences they have
 *     "?"          every trait value, every Action pip, every Hope pip (in the
 *                  Hope gold, because a redacted Hope is still Hope)
 *     "???" / "+?" each Experience — that they have one, and that it is worth
 *                  something, without saying what or how much
 *     greyed       every tab, unclickable, and its contents removed from the
 *                  page rather than merely hidden
 *
 * THE PANES ARE EMPTIED, NOT HIDDEN, and that is the one place this file works
 * harder than it looks. A greyed-out tab whose inventory is still sitting in the
 * DOM is a curtain drawn over an open window: `display: none` is one devtools
 * click from undone. The tab STAYS so the sheet still reads as a sheet; what was
 * inside it goes.
 *
 * FAIL CLOSED. Everything below runs inside one try/catch, and the catch CLOSES
 * THE SHEET. This is the trade the second pass made: the old design could not
 * leak because nothing was rendered, and this one can if the redaction does not
 * finish. So a redaction that throws must not leave a readable sheet on screen.
 *
 * AND IT IS STILL A CURTAIN, NOT A WALL. Foundry sends every world document to
 * every client, so a player with a console can read anything here regardless.
 * That was equally true of the old closed sheet. It means one thing, worth
 * writing down: nothing may sit behind this whose leak would spoil the game.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { whisperToGms, warn, debug, error } from "./utils.mjs";

const NONE = 0;     // CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE
const OBSERVER = 2; // …OBSERVER — enough to render the sheet, never to edit it.

export function registerAnonymity() {
    Hooks.on("preCreateActor", onPreCreateActor);
    Hooks.on("preUpdateActor", onPreUpdateActor);
    // ONE hook only. ApplicationV2 fires a render hook for every class in the
    // inheritance chain, so listening to both the concrete sheet and its base
    // class ran this twice and produced two identical errors.
    Hooks.on("renderActorSheetV2", onRenderSheet);
}

/**
 * Somebody else's sheet: everything is there, and almost nothing is readable.
 *
 * Fails CLOSED — see the header. If any step throws, the sheet is shut rather
 * than left half-redacted.
 */
function onRenderSheet(app, element) {
    const root = element instanceof HTMLElement ? element : element?.[0];

    try {
        if (!enforcing()) return;
        const actor = app?.document;
        if (!actor || actor.type !== "character") return;

        // Nobody may open the settings sheet, their own included (Dawid,
        // 27.08). It is Daggerheart's configuration for the character, and it
        // is the GM's business — a player who opens it is looking at knobs no
        // rule in this game lets them turn.
        if (!game.user.isGM) lockSettings(root);

        if (game.user.isGM || actor.testUserPermission(game.user, "OWNER")) return;
        if (!root) return;

        redactTabs(root);
        redactValues(root);
        root.classList.add("drpg-redacted-sheet");
    } catch (err) {
        error("Could not redact a character sheet — closing it instead", err);
        try {
            if (root) root.style.display = "none";
            app?.close?.({ force: true, animate: false })?.catch?.(() => {});
        } catch {
            // Nothing left to try. The error above is the record.
        }
    }
}

/**
 * The tabs stay, greyed, and their contents go.
 *
 * Greyed rather than removed (Dawid, 27.08): a sheet with no tabs says nothing
 * about the person, while a sheet whose tabs are shut says there is something
 * behind them. `data-action` is stripped as well as the click being swallowed,
 * because ApplicationV2 dispatches on that attribute — leaving it and relying on
 * the listener alone would mean one missed event is one opened tab.
 *
 * EMPTIED, NOT HIDDEN. A pane left in the page with `display: none` is a
 * devtools click from being read; there is no version of this where the
 * inventory may stay in the DOM.
 */
function redactTabs(root) {
    for (const tab of root.querySelectorAll('[data-action="tab"]')) {
        delete tab.dataset.action;
        tab.classList.add("drpg-locked");
        tab.setAttribute("aria-disabled", "true");
        tab.dataset.tooltip = game.i18n.localize("DRPG.Redacted.tabLocked");
        tab.addEventListener("click", stop, { capture: true });
    }

    for (const pane of root.querySelectorAll("section.tab[data-tab]")) {
        pane.replaceChildren(lockedPlaceholder());
        pane.classList.add("drpg-redacted-pane");
    }
}

/** One pixel question mark, so an emptied pane does not read as a broken one. */
function lockedPlaceholder() {
    const box = document.createElement("div");
    box.className = "drpg-redacted-empty";
    box.innerHTML = `<i aria-hidden="true"></i><span>${
        game.i18n.localize("DRPG.Redacted.tabLocked")}</span>`;
    return box;
}

/**
 * Numbers become question marks; names become nothing at all.
 *
 * WHAT SURVIVES IS THE POINT. Health and Sanity keep their figures and the
 * Equipped panel keeps its item, because those are the things the fiction shows
 * anyone in the room. Everything with a number attached to it — traits, Actions,
 * Hope — becomes a question mark, and an Experience keeps its ROW while losing
 * both its name and its size: you can see that they have two of them and that
 * both are worth something, which is exactly what watching somebody work would
 * tell you.
 */
function redactValues(root) {
    const mark = (el, text, cls) => {
        el.textContent = text;
        el.classList.add("drpg-redacted-value");
        if (cls) el.classList.add(cls);
    };

    for (const value of root.querySelectorAll(".trait-value")) mark(value, "?");
    for (const pip of root.querySelectorAll(".drpg-action-pip")) {
        pip.classList.remove("filled");
        mark(pip, "?");
    }
    // Hope keeps its colour. A hidden Hope is still Hope, and the gold is how
    // this module says so everywhere else.
    for (const pip of root.querySelectorAll(".hope-value")) mark(pip, "?", "drpg-redacted-hope");

    for (const row of root.querySelectorAll(".experience-row")) {
        const value = row.querySelector(".experience-value");
        const name = row.querySelector(".experience-name");
        if (value) mark(value, "+?");
        if (name) mark(name, "???");
        // The little "send to chat" control belongs to whoever owns it.
        row.querySelector(".controls")?.remove();
        row.removeAttribute("data-tooltip-text");
    }
}

/**
 * The settings sheet is nobody's but the GM's.
 *
 * Left in place and greyed for the same reason the tabs are: a button that
 * disappears teaches nothing about who it belongs to.
 */
function lockSettings(root) {
    for (const button of root?.querySelectorAll('[data-action="openSettings"]') ?? []) {
        delete button.dataset.action;
        button.classList.add("drpg-locked");
        button.setAttribute("aria-disabled", "true");
        button.dataset.tooltip = game.i18n.localize("DRPG.Redacted.settingsLocked");
        button.addEventListener("click", stop, { capture: true });
    }
}

function stop(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
}

function enforcing() {
    try {
        return game.settings.get(MODULE_ID, SETTINGS.enforceAnonymity);
    } catch {
        return false;
    }
}

/**
 * New characters open at OBSERVER.
 *
 * Which is the level that renders the sheet in full and still refuses every
 * edit — `isEditable` is false below OWNER, so every field arrives disabled
 * without this file touching one. NONE would leave a window nobody can open and
 * a redaction with nothing to redact.
 */
function onPreCreateActor(actor, data) {
    if (actor.type !== "character" || !enforcing()) return;
    if ((data.ownership?.default ?? NONE) === OBSERVER) return;

    actor.updateSource({ "ownership.default": OBSERVER });
    debug(`Set default ownership to OBSERVER on new character "${data.name}".`);
}

/**
 * Stop anyone handing a student to the whole table as OWNER.
 *
 * OBSERVER is the ceiling because it is exactly enough: the sheet opens, the
 * redaction below runs, and nothing can be changed. OWNER by default would give
 * every player the run of somebody else's character — and it would skip the
 * redaction entirely, since that only runs for a viewer who is not the owner.
 *
 * Lowering is not blocked. A GM sealing one character shut is making a ruling,
 * and all they lose is a window.
 */
function onPreUpdateActor(actor, changes) {
    if (actor.type !== "character" || !enforcing()) return;

    const next = changes.ownership?.default;
    if (next === undefined || next <= OBSERVER) return;

    delete changes.ownership.default;
    if (!Object.keys(changes.ownership).length) delete changes.ownership;

    ui.notifications.warn(game.i18n.format("DRPG.Anonymity.blocked", { actor: actor.name }));
    debug(`Blocked a default-ownership raise on "${actor.name}" — OBSERVER is the ceiling.`);
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
