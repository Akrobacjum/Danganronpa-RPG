/**
 * Danganronpa RPG — GM panel.
 * ---------------------------------------------------------------------------
 * The handful of things a GM does every time of day, behind one button in the
 * token toolbar: move the clock, refill actions, restock search tokens, check
 * where everyone stands.
 */

import { MODULE_ID, BUILD, FLAGS, TIMES_OF_DAY, TIME_OF_DAY_LABELS, PHASES,
    CHAPTERS_PER_SEASON } from "./config.mjs";
import { getClock, setClock, setTimeOfDay, clockSummary, timeOfDayLabel, phaseLabel, campaignName } from "./clock.mjs";
import { actionsLeft, actionsMax, hasFreeMove } from "./actions.mjs";
import { isEclipse } from "./eclipse.mjs";
import { dialogContent, error, plural, tableDialog } from "./utils.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/**
 * The panel's launcher — a standalone red button above the scene controls.
 *
 * It used to be one more tool in the token toolbar, which made the single
 * most-used GM control in the module a 26th grey icon in a column of grey
 * icons (Dawid, 26.08: out of there, bigger, named, red). It sits at the TOP
 * of the left column now, above the controls: the corner a GM's eye already
 * visits for tools, but outside the toolbar's grammar — solid crimson where
 * everything below it is translucent, with a label where everything below it
 * is an icon. Red is the module's "this goes through the GM" colour, and this
 * button is the purest case of it on the screen.
 *
 * Re-injected on every scene-controls render because the left column is
 * core's and a re-render may rebuild it.
 */
export function registerGmPanel() {
    Hooks.once("ready", injectLauncher);
    Hooks.on("renderSceneControls", injectLauncher);
}

function injectLauncher() {
    try {
        if (!game.user?.isGM) return;

        /* The GM-only styling is keyed on classes THIS function puts on the
         * elements themselves, not on `body.drpg-gm`: on a long-lived client
         * an ancestor-class selector was measured matching the element and
         * still not applying — present in the sheet, `matches()` true,
         * computed style ignoring it — while a same-element class works
         * everywhere. The scene navigation is hidden by default in the
         * stylesheet and only a GM's client ever runs this line to show it,
         * so a player needs no selector gymnastics at all. */
        document.getElementById("scene-controls")?.classList.add("drpg-gm-rail");
        document.getElementById("scene-navigation")?.classList.add("drpg-gm-nav");

        if (document.getElementById("drpg-gm-launcher")) return;
        const column = document.getElementById("ui-left-column-1");
        if (!column) return;

        const btn = document.createElement("button");
        btn.id = "drpg-gm-launcher";
        btn.type = "button";
        btn.dataset.tooltip = game.i18n.localize("DRPG.Panel.title");
        btn.innerHTML = `<i class="fa-solid fa-clock" inert></i>
            <span>${game.i18n.localize("DRPG.Panel.launcher")}</span>`;
        btn.addEventListener("click", () => openGmPanel());
        column.prepend(btn);
    } catch (err) {
        error("Could not place the GM panel launcher", err);
    }
}

/**
 * Everything the panel can do, grouped by WHEN a GM reaches for it.
 *
 * This used to be two flat rows of dialog buttons — one on the panel and one
 * behind "More…" — and by the time the murder engine landed the second row was
 * sixteen buttons long, in the order they happened to be written. Ordering by
 * moment instead means the answer to "where is that thing" is "when do I use
 * it", which is a question a GM can actually answer mid-session.
 *
 * `dim` marks the ones that are situational rather than part of the flow, so
 * they read as a toolbox rather than as steps.
 */
/*
 * WHAT OPENS, AND WHEN.
 * --------------------------------------------------------------------------
 * The panel is thirty tiles long and a GM uses about five of them in any given
 * minute. Which five is not a mystery — it is written on the clock. So each
 * section declares the phases it belongs to, and the panel opens with those
 * expanded and everything else folded away.
 *
 * `always` marks the sections that are never out of season: the clock itself,
 * and the toolbox. `collapsed` is the default for a section that is neither.
 * Nothing is hidden — every tile is one click from where it was — but the
 * screen a GM lands on is the one for the scene they are actually running.
 */
const PANEL_SECTIONS = [
    {
        key: "now",
        always: true,
        items: [
            // The tray's own manager, first: it is the screen a GM opens most
            // often during a Daily Life.
            { key: "projects", icon: "fa-list-check", labelKey: "DRPG.Project.manageTitle",
              run: () => import("./projects-ui.mjs").then(m => m.openProjectManager()) },
            { key: "jump", icon: "fa-calendar-days", labelKey: "DRPG.Panel.jump",
              run: () => openClockDialog() },
            { key: "rules", icon: "fa-gavel", labelKey: "DRPG.Rules.manageTitle",
              run: () => import("./rules.mjs").then(m => m.openRulesManager()) },
            // Moved up from "People and things", which no longer exists: giving
            // somebody a thing is a mid-scene act, not a between-sessions one.
            { key: "items", icon: "fa-box-open", labelKey: "DRPG.Items.manage",
              run: () => import("./gm-items.mjs").then(m => m.openItemManager()) },
            // Moved UP from Season setup, where it sat because it was only a
            // state-to-playlist mapping table. It now also puts a track on and
            // takes it off again — something a GM reaches for in the middle of
            // a scene, which is what this section is.
            { key: "music", icon: "fa-music", labelKey: "DRPG.Music.title",
              run: () => import("./music.mjs").then(m => m.openMusicDialog()) },
            // Three windows in one: "A character dies", the Monocub manager and
            // the alive/dead/Monocub repair table. All three were about the same
            // question — who in this cast is still breathing, and as what.
            { key: "whoIsAlive", icon: "fa-heart-pulse", labelKey: "DRPG.Panel.whoIsAlive",
              run: () => openWhoIsAliveDialog() }
            // GONE FROM HERE:
            //   Eclipse — the HUD's own chevron has done both halves of it for
            //     several versions; a second door to it was a second thing to
            //     keep in step. `nextStep` still offers it when one is running,
            //     see EXTRA_ACTIONS.
            //   Listen in on a voice room — reachable from the console
            //     (`game.drpg.voiceEavesdropDialog()`) and from nowhere a GM
            //     goes twice a session.
        ]
    },
    {
        key: "case",
        // Also open during a Class Trial, because the trial console lives here
        // now — and during Daily Life, because that is when a GM decides to
        // hold one.
        phases: ["dailyLife", "investigation", "classTrial"],
        items: [
            // IN THE ORDER THEY HAPPEN.
            //
            // Greys out while an Eclipse runs rather than rejecting silently on
            // click: `openMurder` refuses the call either way (see the notes
            // there), but a GM should see WHY before pressing, not after.
            // `judgePendingMurders` still opens a parked Direct Murder once the
            // Eclipse it was declared in has ended — that path never goes
            // through this tile.
            { key: "murder", icon: "fa-skull", labelKey: "DRPG.Murder.openTitle",
              disabled: () => isEclipse(), disabledReason: "DRPG.Eclipse.panelLocked",
              run: () => import("./murder.mjs").then(m => m.openMurderDialog()) },
            // "A body is discovered" is a button on the dashboard: a GM
            // announces the body while looking at the case, not while deciding
            // which screen to open. Same for the autopsy and the evidence log.
            { key: "investigation", icon: "fa-magnifying-glass-chart",
              labelKey: "DRPG.Investigation.dashboardTitle",
              run: () => import("./investigation.mjs").then(m => m.openInvestigationDashboard()) },
            // Start, floor, vote, verdict and the chapter's end, behind one
            // name. Two tiles for one scene meant a GM mid-trial had to know
            // which of them held the button they wanted.
            { key: "trial", icon: "fa-scale-balanced", labelKey: "DRPG.Floor.manageTrial",
              run: () => import("./trial-floor-ui.mjs").then(m => m.manageClassTrial()) }
        ]
    },
    {
        key: "between",
        collapsed: true,
        items: [
            { key: "gmTeam", icon: "fa-users-gear", labelKey: "DRPG.Panel.gmTeam",
              run: () => import("./gm-team-dialog.mjs").then(m => m.openGmTeamDialog()) },
            // Room Setup carries the locks and the search-token counters now, so
            // the two quick toggles that used to live in the panel are columns
            // on the table that already says everything else about a room.
            { key: "roomSetup", icon: "fa-door-closed", labelKey: "DRPG.Vault.manageTitle",
              run: () => import("./vault.mjs").then(m => m.openRoomSetupDialog()) },
            // The editor, not the installer. Installing is still in there, as a
            // button — it is a thing you do once, and everything after that
            // first minute is editing.
            { key: "tables", icon: "fa-table-list", labelKey: "DRPG.Tables.editorTitle",
              run: () => import("./tables.mjs").then(m => m.openItemTables()) },
            // Beside the checks it answers: the season checklist carries the
            // pre-session diagnostics as a button now, because "what is missing"
            // and "fix it" are the same list read from the two ends.
            { key: "seasonSetup", icon: "fa-wand-magic-sparkles", labelKey: "DRPG.Season.title",
              run: () => import("./season-setup.mjs").then(m => m.openSeasonSetup()) },
            // Moved out of the trial-only section it used to sit in. The
            // endgame is prepared between sessions, and this is the one place
            // it is edited: the Mastermind's identity, the Final Trial and the
            // Final Key Remnants, all on one window.
            { key: "mastermind", icon: "fa-user-secret", labelKey: "DRPG.Mastermind.dialogTitle",
              run: () => import("./mastermind.mjs").then(m => m.openMastermindDialog()) },
            // Last in the section and red: it is the only control here that
            // destroys anything, and it destroys a chapter's worth at once.
            { key: "seasonReset", icon: "fa-trash-arrow-up", labelKey: "DRPG.Season.resetTitle",
              gmRoute: true,
              run: () => import("./season-setup.mjs").then(m => m.resetSeason()) }
        ]
    },
    {
        key: "fixes",
        dim: true,
        collapsed: true,
        items: [
            // What has gone wrong since this page loaded. See `openFailureLog`.
            { key: "failureLog", icon: "fa-bug", labelKey: "DRPG.Failures.title",
              run: () => openFailureLog() },
            // GONE FROM HERE: the search-token report is two columns in Room
            // Setup, editing a Remnant's flags is the dashboard's Traces tab,
            // and "Alive / dead / Monocub" is the top section's Player status.
            // Each of them is now a control on the window that already held the
            // rest of its subject.
            //
            // "Refill everyone's actions" went too, and for a different reason:
            // it was a button that undid the clock. Actions come back when the
            // time of day advances, which is the one event the whole economy is
            // built on — a tile that hands them out without moving the clock is
            // a way to lose track of which time of day the table is actually
            // in. `game.drpg.resetAllActions()` is still there for a GM who
            // genuinely needs to repair a botched advance.
        ]
    }
];

/**
 * Things `nextStep()` can suggest that are not tiles.
 *
 * The suggestion line is not a list of tools, it is one instruction — so it is
 * allowed to point at something the tile grid deliberately does not carry. The
 * Eclipse is the whole of it: the HUD owns that button, but "the Eclipse is
 * open, close it once everyone has placed" is still the right next step to be
 * told, and the "Do it" beside it should work.
 */
const EXTRA_ACTIONS = {
    eclipse: { key: "eclipse", run: () => toggleEclipse() }
};

/** Open the panel. */
export async function openGmPanel() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return;
    }

    // The clock decides what opens. See the note on PANEL_SECTIONS.
    const phase = getClock().phase;
    const sections = PANEL_SECTIONS.map(section => {
        const inSeason = section.always || section.phases?.includes(phase);
        const open = inSeason && !section.collapsed;
        return `
        <details class="drpg-gmp-section${section.dim ? " dim" : ""}${
            inSeason ? " in-season" : ""}"${open ? " open" : ""}>
            <summary>${game.i18n.localize(`DRPG.Panel.section.${section.key}`)}</summary>
            <div class="drpg-gmp-grid">${section.items.map(item => {
                const blocked = Boolean(item.disabled?.());
                return `
                <button type="button" class="drpg-gmp-button${
                    item.gmRoute ? " drpg-gm-route" : ""}${blocked ? " drpg-disabled" : ""}" data-drpg-run="${item.key}"${
                    blocked ? ` disabled title="${foundry.utils.escapeHTML(game.i18n.localize(item.disabledReason))}"` : ""}>
                    <i class="fa-solid ${item.icon}" inert></i>
                    <span>${game.i18n.localize(item.labelKey)}</span>
                </button>`;
            }).join("")}</div>
        </details>`;
    }).join("");

    // Which version is actually running, on the screen a GM opens most.
    //
    // It is read off the manifest rather than written here, so it cannot go
    // stale — and it is on the panel rather than in the console because the
    // question it answers ("is the fix I was sent actually loaded?") is asked
    // by somebody looking at the interface, not at a debugger. On a hosted
    // world that is the first thing worth knowing when something looks wrong.
    // The build that is RUNNING, which is the useful one — see the note on
    // `BUILD` in config.mjs. The manifest is shown beside it only when they
    // disagree, because on a hosted world that gap is normal and the question
    // it answers ("did my upload land?") is worth being able to see.
    const manifest = game.modules.get(MODULE_ID)?.version ?? "?";
    const version = manifest === BUILD ? BUILD : `${BUILD} (manifest ${manifest})`;
    const body = dialogContent(`<div class="drpg-gm-panel">
        ${buildPanelContent()}
        ${sections}
        <p class="drpg-gmp-version">Danganronpa RPG v${foundry.utils.escapeHTML(version)}</p>
    </div>`);

    // The suggestion's own actions are in the same lookup as the tiles, so the
    // "Do it" button works whether or not what it points at is on screen.
    const lookup = new Map([
        ...PANEL_SECTIONS.flatMap(s => s.items.map(i => [i.key, i])),
        ...Object.entries(EXTRA_ACTIONS)
    ]);

    await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Panel.title") },
        classes: ["drpg-panel", "drpg-gm-panel-window"],
        content: body,
        buttons: [{ action: "close", label: game.i18n.localize("DRPG.Panel.close"), default: true }],
        // Each tile closes the panel, does its thing, and the panel comes BACK.
        //
        // Closing first has always mattered: most of these open a dialog of
        // their own, and stacking one on top of the panel it came from is how a
        // GM loses track of which window they are answering. What was missing
        // was the other half. A GM's work is rarely one tile — place a Remnant,
        // check the dashboard, advance the clock — and each of those meant
        // finding the panel again from the scene controls. The incident tracker
        // has always reopened itself after every action; this is the same idea,
        // applied to the screen that is opened more often than any other.
        //
        // Every tile here awaits a dialog of its own, so by the time `run()`
        // resolves the screen is clear again and the panel can come back.
        // Reopened only when a tile was actually used, never when the panel was
        // dismissed.
        render: (event, dialog) => {
            for (const button of dialog.element.querySelectorAll("[data-drpg-run]")) {
                button.addEventListener("click", async ev => {
                    ev.preventDefault();
                    const item = lookup.get(button.dataset.drpgRun);
                    if (!item) return;
                    await dialog.close();
                    try {
                        await item.run();
                    } catch (err) {
                        error(`GM panel action "${item.key}" failed`, err);
                        ui.notifications.error(game.i18n.localize("DRPG.Panel.failed"));
                    }
                    openGmPanel().catch(err =>
                        error("Could not reopen the GM panel", err));
                });
            }
        },
        rejectClose: false
    });
}

/**
 * Start the placement window, or close it and begin the time of day.
 * When closing, shows who has actually finished placing.
 */
/**
 * Announce (or end) the Final Trial. World-scoped and public on purpose — the
 * table already knows the endgame trial is happening the moment it starts;
 * only the Mastermind's identity stays hidden, and that lives elsewhere.
 */
/**
 * Alive / dead / Monocub, in one place, in both directions.
 *
 * The module already had every one of these operations and no honest way to
 * reach them. `A character dies` only kills; the Monocub dialog only opts in
 * somebody the module already believes is dead; and `reviveCharacter` existed
 * solely on `game.drpg`. So a GM who mis-clicked a death, or wanted to bring
 * somebody back as a Monocub on the spot rather than after a trial, was writing
 * console commands mid-session.
 *
 * Deliberately does NOT re-run the death procedure. `killCharacter` destroys an
 * inventory and cannot be undone, and this is the repair tool — it moves the two
 * flags and nothing else. Killing somebody properly is still `A character dies`,
 * one section up, where the warning about the inventory lives.
 */

/**
 * Everything this client has failed at since the page loaded.
 *
 * The module reports 181 different failures through `error()`, and until now
 * every one of them went to `console.error` and stopped there — which is to say
 * to nobody, because nobody runs a session with DevTools open. A feature could
 * be completely dead and the only symptom was that it did not happen.
 *
 * THIS SESSION ONLY, and that is not a filter — the log is an array in memory,
 * so a reload empties it. A failure from before the reload is not something the
 * GM can act on now, and a log that accumulates across weeks is a log nobody
 * opens.
 *
 * Newest last, the way a log reads. Repeats are one row with a count: the first
 * occurrence explains the cause, the four hundredth only proves it continued.
 */
async function openFailureLog() {
    const { sessionFailures, clearSessionFailures } = await import("./utils.mjs");
    const rows = sessionFailures();
    const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
    const when = at => new Date(at).toLocaleTimeString();

    const body = rows.length
        ? `<ul class="drpg-failure-log">${rows.map(r => `
            <li class="drpg-failure ${esc(r.level)}">
                <div class="drpg-failure-head">
                    <span class="drpg-failure-time">${esc(when(r.at))}</span>
                    ${r.count > 1 ? `<span class="drpg-failure-count">×${r.count}</span>` : ""}
                </div>
                <div class="drpg-failure-message">${esc(r.message)}</div>
                ${r.stack ? `<pre class="drpg-failure-stack">${esc(r.stack.split("\n").slice(0, 4).join("\n"))}</pre>` : ""}
            </li>`).join("")}</ul>`
        : `<p>${esc(game.i18n.localize("DRPG.Failures.none"))}</p>`;

    const action = await DialogV2.wait({
        classes: ["drpg-panel", "drpg-wide"],
        window: { title: game.i18n.localize("DRPG.Failures.title") },
        content: dialogContent(`<div>
            <p class="notes">${esc(game.i18n.localize("DRPG.Failures.intro"))}</p>
            ${body}
        </div>`),
        buttons: [
            { action: "close", label: game.i18n.localize("DRPG.Panel.close"), default: true },
            ...(rows.length ? [{ action: "clear", label: game.i18n.localize("DRPG.Failures.clear") }] : [])
        ],
        rejectClose: false
    });

    if (action === "clear") {
        clearSessionFailures();
        ui.notifications.info(game.i18n.localize("DRPG.Failures.cleared"));
    }
}

/**
 * WHO IS ALIVE — three windows, one table.
 * ---------------------------------------------------------------------------
 * "A character dies", the Monocub manager and the alive/dead/Monocub repair
 * table were three tiles in two sections answering one question about one
 * cast, and each of them could only see part of it: the death dialog listed
 * only the living, the Monocub dialog only the dead, and the repair table
 * could move the flags but refused to run either procedure properly.
 *
 * THE DROPDOWN IS STILL THE REPAIR TOOL, exactly as it was — it moves the two
 * flags and nothing else, which is what you want after a mis-click. The two
 * row buttons are the real procedures:
 *
 *   Kill                 `openDeathDialog` for that one character, with the
 *                        warning about the inventory it destroys.
 *   Invite as a Monocub  the guide's offer to somebody already dead.
 *
 * The Monocub half of the old window comes across whole: how much Hope a cub
 * is holding, the donation control that spends a real Despair pool, and the
 * silence a cub is put under after a crime they watched.
 *
 * Built from a list of everything the three windows did, checked off after the
 * merge — see the stage's verification. The one thing deliberately NOT carried
 * across is the death dialog's own character picker: this table is the picker.
 */
async function openWhoIsAliveDialog() {
    const { isDeceased, reviveCharacter, killCharacter, openDeathDialog } =
        await import("./chapter.mjs");
    const { isMonocub, setMonocub, isSilenced, setSilenced } = await import("./monocub.mjs");
    const { isMonokuma } = await import("./monokuma.mjs");
    const { monokumas, poolLabel, getDespair } = await import("./despair.mjs");
    const { resourceValue, resourceMax } = await import("./character.mjs");

    const students = game.actors.filter(a => a.type === "character" && !isMonokuma(a));
    if (!students.length) {
        ui.notifications.info(game.i18n.localize("DRPG.Panel.noCharacters"));
        return;
    }

    const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
    const stateOf = a => isMonocub(a) ? "monocub" : isDeceased(a) ? "dead" : "alive";
    const donors = monokumas().map(u =>
        `<option value="${u.id}">${esc(poolLabel(u))} (${getDespair(u.id)})</option>`).join("");

    const rows = students.map(a => {
        const state = stateOf(a);
        const cub = state === "monocub";

        return `<tr data-actor="${a.id}">
            <td>${esc(a.name)}</td>
            <td><select name="state.${a.id}">
                ${["alive", "dead", "monocub"].map(sKey =>
                    `<option value="${sKey}"${sKey === state ? " selected" : ""}>${
                        game.i18n.localize(`DRPG.Panel.state.${sKey}`)}</option>`).join("")}
            </select></td>
            <td>${cub ? `${resourceValue(a, "hope")} / ${resourceMax(a, "hope")}` : "—"}</td>
            <td>${cub && donors ? `
                <select name="donor:${a.id}">${donors}</select>
                <input type="number" name="amount:${a.id}" min="1" value="1" style="width:3.5em" />
                <button type="button" class="drpg-mini-button" data-drpg-give="${a.id}">
                    ${game.i18n.localize("DRPG.Monocub.give")}</button>` : "—"}</td>
            <td style="text-align:center">${cub
                ? `<input type="checkbox" name="silenced:${a.id}" ${
                    isSilenced(a) ? "checked" : ""} />`
                : "—"}</td>
            <td>${state === "alive"
                ? `<button type="button" class="drpg-mini-button drpg-gm-route"
                       data-drpg-kill="${a.id}">${
                       game.i18n.localize("DRPG.Chapter.deathTitle")}</button>`
                : state === "dead"
                    ? `<button type="button" class="drpg-mini-button" data-drpg-cub="${a.id}">${
                        game.i18n.localize("DRPG.Monocub.invite")}</button>`
                    : "—"}</td>
        </tr>`;
    }).join("");

    // The per-row buttons act at once rather than waiting for Apply: each one
    // runs a real procedure — a death that empties an inventory, a donation
    // that spends a Despair pool — and a GM who then cancels the form should
    // not find those undone with it. The window closes and reopens so the table
    // is rebuilt around what actually happened.
    const wireRow = (dialog, attribute, run) => {
        for (const button of dialog.element.querySelectorAll(`[${attribute}]`)) {
            button.addEventListener("click", async ev => {
                ev.preventDefault();
                const actor = game.actors.get(button.getAttribute(attribute));
                if (!actor) return;
                await dialog.close();
                try {
                    await run(actor, dialog);
                } catch (err) {
                    error(`GM panel: "${attribute}" failed`, err);
                }
                await openWhoIsAliveDialog();
            });
        }
    };

    const chosen = await tableDialog({
        window: { title: game.i18n.localize("DRPG.Panel.whoIsAlive") },
        classes: ["drpg-panel", "drpg-projects"],
        content: dialogContent(`<form>
            <p class="notes">${game.i18n.localize("DRPG.Panel.whoIsAliveNote")}</p>
            <table class="drpg-vault-table"><thead><tr>
                <th>${game.i18n.localize("DRPG.Panel.character")}</th>
                <th>${game.i18n.localize("DRPG.Panel.stateColumn")}</th>
                <th>${game.i18n.localize("DRPG.Monocub.hope")}</th>
                <th>${game.i18n.localize("DRPG.Monocub.giveHope")}</th>
                <th>${game.i18n.localize("DRPG.Monocub.silenced")}</th>
                <th>${game.i18n.localize("DRPG.Panel.doColumn")}</th>
            </tr></thead><tbody>${rows}</tbody></table>
            <p class="notes">${game.i18n.localize("DRPG.Monocub.silencedNote")}</p>
        </form>`),
        buttons: [
            {
                action: "save", label: game.i18n.localize("DRPG.Panel.apply"), default: true,
                callback: (e, b, d) => Object.fromEntries(students.map(a => [a.id, {
                    state: d.element.querySelector(`[name="state.${a.id}"]`)?.value ?? null,
                    silenced: Boolean(d.element.querySelector(`[name="silenced:${a.id}"]`)?.checked)
                }]))
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        render: (event, dialog) => {
            // The full death procedure, on the one character the row is about.
            // `openDeathDialog` owns the warning about the inventory and the
            // "keep their things" choice; repeating either here would be a
            // second copy of a rule that can only be right in one place.
            wireRow(dialog, "data-drpg-kill", actor => openDeathDialog({ actor }));
            wireRow(dialog, "data-drpg-cub", actor => setMonocub(actor, true));

            for (const button of dialog.element.querySelectorAll("[data-drpg-give]")) {
                button.addEventListener("click", async ev => {
                    ev.preventDefault();
                    const id = button.dataset.drpgGive;
                    const actor = game.actors.get(id);
                    const donorId = dialog.element.querySelector(`[name="donor:${id}"]`)?.value;
                    const amount = Number(
                        dialog.element.querySelector(`[name="amount:${id}"]`)?.value) || 0;
                    if (!actor || !donorId || amount <= 0) return;

                    const { convertDespairToHope } = await import("./despair.mjs");
                    await convertDespairToHope(donorId, actor, amount);
                    await dialog.close();
                    await openWhoIsAliveDialog();
                });
            }
        },
        rejectClose: false
    });

    if (!chosen || chosen === "cancel") return;

    let changed = 0;
    for (const actor of students) {
        const want = chosen[actor.id];
        if (!want?.state) continue;

        // Order matters: a Monocub is a dead student with a second flag, so the
        // flags are set from the outside in — deceased first, then Monocub.
        //
        // Dying through the DROPDOWN keeps the inventory. This half of the
        // window is the repair tool: nobody expects a select to empty a bag,
        // and the row's own Kill button is the one that runs the real
        // procedure, warning and all.
        if (want.state !== stateOf(actor)) {
            if (want.state === "alive") {
                await setMonocub(actor, false);
                await reviveCharacter(actor);
            } else if (want.state === "dead") {
                await setMonocub(actor, false);
                if (!isDeceased(actor)) await killCharacter(actor, { keepItems: true });
            } else {
                if (!isDeceased(actor)) await killCharacter(actor, { keepItems: true });
                await setMonocub(actor, true);
            }
            changed++;
        }

        // Silence only means anything for a cub, and only after the state above
        // has settled — a student promoted to Monocub in this same pass can be
        // silenced in it too.
        if (isMonocub(actor) && want.silenced !== isSilenced(actor)) {
            await setSilenced(actor, want.silenced);
            changed++;
        }
    }

    ui.notifications.info(changed
        ? plural("DRPG.Panel.stateSaved", { n: changed })
        : game.i18n.localize("DRPG.Panel.stateUnchanged"));
}

async function toggleEclipse() {
    const { isEclipse, startEclipse, endEclipse, placementStatus, eclipseLabel } =
        await import("./eclipse.mjs");

    if (!isEclipse()) return startEclipse();

    const rows = placementStatus().map(s => `
        <tr${s.moved === 0 ? ' style="opacity:.55"' : ""}>
            <td>${foundry.utils.escapeHTML(s.actor.name)}</td>
            <td>${foundry.utils.escapeHTML(s.room ?? "—")}</td>
            <td style="text-align:center">${
                // A free-placement Eclipse has no budget, so the column reports
                // whether they have placed at all — which is the question the GM
                // is actually holding this dialog open to answer.
                s.allowance === null ? s.moved : `${s.moved} / ${s.allowance}`
            }</td>
        </tr>`).join("");

    const choice = await tableDialog({
        window: { title: eclipseLabel() },
        classes: ["drpg-panel"],
        content: `<p>${game.i18n.localize("DRPG.Eclipse.endPrompt")}</p>
            <table><thead><tr>
                <th>${game.i18n.localize("DRPG.Panel.character")}</th>
                <th>${game.i18n.localize("DRPG.Project.room")}</th>
                <th>${game.i18n.localize("DRPG.Eclipse.movesColumn")}</th>
            </tr></thead><tbody>${rows}</tbody></table>`,
        buttons: [
            { action: "end", label: game.i18n.localize("DRPG.Eclipse.endAndAdvance"), default: true },
            { action: "endOnly", label: game.i18n.localize("DRPG.Eclipse.endOnly") },
            { action: "cancel", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        rejectClose: false
    });

    if (choice === "end") return endEclipse({ advance: true });
    if (choice === "endOnly") return endEclipse({ advance: false });
    return null;
}

/**
 * What to do next.
 * ---------------------------------------------------------------------------
 * The panel is a list of tools, and a list of tools is the answer to "what can
 * I do", which is not the question a GM has mid-session. The question is "what
 * happens now" — and the module already knows, because every input to that
 * answer is a flag it wrote itself: the phase, the queue, whether an incident
 * is running, how many students still have actions.
 *
 * So one line at the top says it, with the button that does it. The tiles below
 * are unchanged and still reachable; this only saves the GM from working out
 * which of thirty of them the current state calls for.
 *
 * Ordered by urgency, and the first match wins. An incident interrupts
 * everything, an Eclipse is a window everyone is waiting inside, and the rest
 * follows the phase.
 *
 * @returns {{text: string, action: string|null}}
 */
function nextStep(clock) {
    const students = game.actors.filter(a =>
        a.type === "character"
        && !a.getFlag(MODULE_ID, FLAGS.monokuma)
        && (!a.getFlag(MODULE_ID, FLAGS.deceased) || a.getFlag(MODULE_ID, FLAGS.monocub)));
    const stillActing = students.filter(a => actionsLeft(a) > 0);

    if (game.drpg?.murderState?.()?.active) {
        return { text: game.i18n.localize("DRPG.Panel.nextIncident"), action: "murder" };
    }

    if (isEclipse()) {
        return { text: game.i18n.localize("DRPG.Panel.nextEclipse"), action: "eclipse" };
    }

    if (clock.phase === "classTrial") {
        // THE TRIAL HAS AN ORDER NOW, so this line follows it rather than
        // asking for a debate for the rest of the trial. The two finished steps
        // are read from the trial's own progress record; see vote.mjs.
        const progress = game.drpg?.trialProgress?.() ?? {};
        if (progress.verdictApplied) {
            return { text: game.i18n.localize("DRPG.Panel.nextChapterEnd"), action: "trial" };
        }
        if (progress.voteClosed) {
            return { text: game.i18n.localize("DRPG.Panel.nextVerdict"), action: "trial" };
        }

        const floor = game.drpg?.trialFloor?.() ?? null;
        if (!floor) {
            return { text: game.i18n.localize("DRPG.Panel.nextNoFloor"), action: "trial" };
        }
        // The floor no longer has a single "speaker" to name — in a discussion
        // everybody may talk, and in the two restrictive modes the interesting
        // fact is the mode itself, not one name. So the line reports the mode,
        // and adds who holds it only when somebody actually does.
        const holder = game.drpg?.trialHolder?.()?.name ?? null;
        const mode = game.i18n.localize(`DRPG.Floor.mode.${floor.mode}`);
        return {
            text: holder
                ? game.i18n.format("DRPG.Panel.nextFloorHeld", { mode, who: holder })
                : game.i18n.format("DRPG.Panel.nextFloor", { mode }),
            action: "trial"
        };
    }

    if (clock.phase === "investigation") {
        return { text: game.i18n.localize("DRPG.Panel.nextInvestigation"), action: "investigation" };
    }

    // Daily Life. The one number that decides whether the time of day is over.
    return stillActing.length
        ? { text: plural("DRPG.Panel.nextStillActing", { n: stillActing.length }),
            action: null }
        : { text: game.i18n.localize("DRPG.Panel.nextAllDone"), action: "jump" };
}

/** Current standing: where the clock is and what everyone has left. */
function buildPanelContent() {
    const clock = getClock();

    // The living cast, and only them.
    //
    // This listed every `character` actor, which meant the GM's own Monokumas
    // sat in the middle of it reading "0 / 0" — they have no action economy by
    // design — and so did every corpse. The one question this table answers is
    // "who still has actions left", and neither of those can have any. A
    // Monocub stays: they spend a real budget on Move and Meddle.
    const roster = game.actors.filter(a => {
        if (a.type !== "character") return false;
        if (a.getFlag(MODULE_ID, FLAGS.monokuma)) return false;
        if (a.getFlag(MODULE_ID, FLAGS.deceased) && !a.getFlag(MODULE_ID, FLAGS.monocub)) return false;
        return true;
    });

    const rows = roster
        .map(a => {
            const left = actionsLeft(a);
            const max = actionsMax(a);
            const move = hasFreeMove(a)
                ? `<i class="fa-solid fa-shoe-prints drpg-pix-foot" title="free Move available"></i>`
                : "—";
            const cub = a.getFlag(MODULE_ID, FLAGS.monocub)
                ? ` <span class="notes">(${game.i18n.localize("DRPG.Monocub.isOne")})</span>` : "";
            const low = left === 0 ? ' style="opacity:.55"' : "";
            return `<tr${low}>
                        <td>${foundry.utils.escapeHTML(a.name)}${cub}</td>
                        <td style="text-align:center">${left} / ${max}</td>
                        <td style="text-align:center">${move}</td>
                    </tr>`;
        })
        .join("");

    const table = rows
        ? `<table>
             <thead><tr>
               <th>${game.i18n.localize("DRPG.Panel.character")}</th>
               <th style="text-align:center">${game.i18n.localize("DRPG.Actions.label")}</th>
               <th style="text-align:center">${game.i18n.localize("DRPG.Panel.freeMove")}</th>
             </tr></thead>
             <tbody>${rows}</tbody>
           </table>`
        : `<p>${game.i18n.localize("DRPG.Panel.noCharacters")}</p>`;

    // The suggestion sits ABOVE the standing, because it is the thing being
    // looked for. Its button carries an ordinary `data-drpg-run`, so the panel's
    // existing delegate runs it and reopens the panel afterwards like any tile.
    const step = nextStep(clock);
    const suggestion = `<div class="drpg-gmp-next">
            <span class="drpg-gmp-next-label">${game.i18n.localize("DRPG.Panel.nextLabel")}</span>
            <span class="drpg-gmp-next-text">${step.text}</span>
            ${step.action
                ? `<button type="button" class="drpg-gmp-next-go" data-drpg-run="${step.action}">
                       ${game.i18n.localize("DRPG.Panel.nextGo")}</button>`
                : ""}
        </div>`;

    return `<div>
                <h3>${foundry.utils.escapeHTML(campaignName(clock))}</h3>
                <p><strong>${game.i18n.format("DRPG.Hud.chapter", { n: clock.chapter })}
                   · ${phaseLabel(clock.phase)}
                   · ${timeOfDayLabel(clock.timeOfDay)}</strong></p>
                <p>${clockSummary(clock)}</p>
                ${suggestion}
                ${table}
            </div>`;
}

/* ==========================================================================
 * SUB-DIALOGS
 * ========================================================================== */

/**
 * Edit everything the HUD shows: campaign name, chapter, phase, session and
 * time of day. Reachable only from the GM panel — deliberately not on the
 * HUD itself, which every player is looking at for the rest of the session.
 */
export async function openClockDialog() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return;
    }

    const clock = getClock();

    const times = TIMES_OF_DAY
        .map(t => `<option value="${t}"${t === clock.timeOfDay ? " selected" : ""}>${TIME_OF_DAY_LABELS[t]}</option>`)
        .join("");

    const phases = Object.entries(PHASES)
        .map(([key, p]) => `<option value="${key}"${key === clock.phase ? " selected" : ""}>${p.label}</option>`)
        .join("");

    const chapters = Array.from({ length: CHAPTERS_PER_SEASON }, (_, i) => i + 1)
        .map(n => `<option value="${n}"${n === clock.chapter ? " selected" : ""}>${n}</option>`)
        .join("");

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Panel.jump") },
        classes: ["drpg-panel"],
        content: `<form>
                    <label>${game.i18n.localize("DRPG.Clock.campaignName")}
                        <input type="text" name="campaignName"
                               value="${foundry.utils.escapeHTML(clock.campaignName ?? "")}"
                               placeholder="${foundry.utils.escapeHTML(game.world?.title ?? "")}" />
                    </label>
                    <label>${game.i18n.localize("DRPG.Clock.chapter")}
                        <select name="chapter">${chapters}</select>
                    </label>
                    <label>${game.i18n.localize("DRPG.Clock.phase")}
                        <select name="phase">${phases}</select>
                    </label>
                    <label>${game.i18n.localize("DRPG.Clock.day")}
                        <input type="number" name="day" value="${clock.day ?? 1}" min="1" step="1" />
                    </label>
                    <label>${game.i18n.localize("DRPG.Clock.session")}
                        <input type="number" name="session" value="${clock.session}" min="1" step="1" />
                    </label>
                    <label>${game.i18n.localize("DRPG.Clock.timeOfDay")}
                        <select name="timeOfDay">${times}</select>
                    </label>
                    <hr />
                    <label class="drpg-checkbox">
                        <input type="checkbox" name="reset" />
                        ${game.i18n.localize("DRPG.Panel.alsoReset")}
                    </label>
                    <p class="notes">${game.i18n.localize("DRPG.Panel.resetHint")}</p>
                  </form>`,
        buttons: [
            {
                action: "ok",
                label: game.i18n.localize("DRPG.Panel.apply"),
                default: true,
                callback: (event, button, dialog) => {
                    const form = dialog.element.querySelector("form");
                    return {
                        campaignName: form.campaignName.value.trim(),
                        chapter: Number(form.chapter.value) || 1,
                        day: Number(form.day.value) || 1,
                        phase: form.phase.value,
                        session: Number(form.session.value) || 1,
                        timeOfDay: form.timeOfDay.value,
                        reset: form.reset.checked
                    };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return;

    await setClock({
        campaignName: result.campaignName,
        chapter: result.chapter,
        day: result.day,
        phase: result.phase,
        session: result.session,
        timeOfDay: result.timeOfDay
    });

    // Editing the clock is bookkeeping. Only refill when explicitly asked,
    // otherwise a typo correction would hand everyone fresh actions.
    if (result.reset) {
        await setTimeOfDay(result.timeOfDay, {
            resetActions: true,
            resetSearchTokens: true,
            announce: true
        });
    }
}
