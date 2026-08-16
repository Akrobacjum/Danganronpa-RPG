/**
 * Danganronpa RPG — GM panel.
 * ---------------------------------------------------------------------------
 * The handful of things a GM does every time of day, behind one button in the
 * token toolbar: move the clock, refill actions, restock search tokens, check
 * where everyone stands.
 */

import { MODULE_ID, FLAGS, TIMES_OF_DAY, TIME_OF_DAY_LABELS, PHASES, CHAPTERS_PER_SEASON } from "./config.mjs";
import { getClock, setClock, setTimeOfDay, clockSummary, timeOfDayLabel, phaseLabel, campaignName } from "./clock.mjs";
import { resetAllActions, actionsLeft, actionsMax, hasFreeMove } from "./actions.mjs";
import { SearchTokens } from "./search-tokens.mjs";
import { isEclipse } from "./eclipse.mjs";
import { dialogContent, error } from "./utils.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/** Add the panel button to the token toolbar, GM only. */
export function registerGmPanel() {
    Hooks.on("getSceneControlButtons", controls => {
        if (!game.user.isGM) return;
        const tokens = controls.tokens;
        if (!tokens?.tools) return;

        tokens.tools.drpgGmPanel = {
            name: "drpgGmPanel",
            title: "DRPG.Panel.title",
            icon: "fa-solid fa-clock",
            button: true,
            visible: true,
            onChange: () => openGmPanel()
        };
    });
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
            { key: "eclipse", icon: "fa-moon", labelKey: "DRPG.Eclipse.button",
              run: () => toggleEclipse() },
            { key: "music", icon: "fa-music", labelKey: "DRPG.Music.title",
              run: () => import("./music.mjs").then(m => m.openMusicDialog()) },
            { key: "voiceEavesdrop", icon: "fa-headphones", labelKey: "DRPG.Panel.voiceEavesdrop",
              run: () => import("./voice.mjs").then(m => m.openEavesdropDialog()) },
            { key: "jump", icon: "fa-calendar-days", labelKey: "DRPG.Panel.jump",
              run: () => openClockDialog() },
            { key: "rules", icon: "fa-gavel", labelKey: "DRPG.Rules.manageTitle",
              run: () => import("./rules.mjs").then(m => m.openRulesManager()) }
        ]
    },
    {
        key: "case",
        phases: ["dailyLife", "investigation"],
        items: [
            { key: "murder", icon: "fa-skull", labelKey: "DRPG.Murder.openTitle",
              run: () => import("./murder.mjs").then(m => m.openMurderDialog()) },
            { key: "investigation", icon: "fa-magnifying-glass-chart",
              labelKey: "DRPG.Investigation.dashboardTitle",
              run: () => import("./investigation.mjs").then(m => m.openInvestigationDashboard()) },
            { key: "bodyFound", icon: "fa-person-falling", labelKey: "DRPG.Chapter.bodyTitle",
              run: () => import("./chapter.mjs").then(m => m.openBodyDiscoveryDialog()) },
            { key: "autopsy", icon: "fa-notes-medical", labelKey: "DRPG.TruthBullet.autopsyTitle",
              run: () => import("./gm-items.mjs").then(m => m.issueAutopsyDialog()) },
            // `fa-hazard` is not a Font Awesome icon, so this tile rendered with
            // an empty square where every other one has a glyph.
            { key: "manageRemnants", icon: "fa-triangle-exclamation", labelKey: "DRPG.Remnant.manageTooltip",
              run: () => import("./remnants.mjs").then(m => m.openRemnantManager()) },
            { key: "objectionLog", icon: "fa-gavel", labelKey: "DRPG.Trial.logTitle",
              run: () => import("./trial.mjs").then(m => m.openObjectionLog()) },
            // The trial is started from HERE, in the phase you are leaving —
            // which is the phase you are in when you decide to hold one. It
              // used to be reachable only after the phase had already been
            // changed by hand somewhere else.
            { key: "startTrial", icon: "fa-scale-balanced", labelKey: "DRPG.Floor.startTrial",
              run: () => import("./trial-floor-ui.mjs").then(m => m.startClassTrial()) }
        ]
    },
    {
        key: "trial",
        phases: ["classTrial"],
        items: [
            { key: "floor", icon: "fa-microphone-lines", labelKey: "DRPG.Floor.manageTitle",
              run: () => import("./trial-floor-ui.mjs").then(m => m.openFloorDialog()) },
            // `The vote` and `The verdict` are steps on the floor window now. A
            // trial runs floor -> vote -> verdict every time, in that order.
            { key: "endTrial", icon: "fa-flag-checkered", labelKey: "DRPG.Floor.endTrial",
              run: () => import("./trial-floor-ui.mjs").then(m => m.endClassTrial()) }
        ]
    },
    {
        key: "season",
        phases: ["classTrial"],
        items: [
            { key: "mastermind", icon: "fa-user-secret", labelKey: "DRPG.Mastermind.dialogTitle",
              run: () => import("./mastermind.mjs").then(m => m.openMastermindDialog()) },
            // `Start or end the Final Trial` and `Final Trial verdict` are
            // buttons on the Mastermind window now. All three were one subject
            // split across three trips through the panel.
        ]
    },
    {
        key: "people",
        phases: ["dailyLife", "investigation", "classTrial"],
        items: [
            { key: "items", icon: "fa-box-open", labelKey: "DRPG.Items.manage",
              run: () => import("./gm-items.mjs").then(m => m.openItemManager()) },
            // `Look inside the stashes` is a button on Give / take items: a stashed
            // item is an ordinary item on its owner's sheet, so the two screens
            // were always about the same thing.
            { key: "death", icon: "fa-skull-crossbones", labelKey: "DRPG.Chapter.deathTitle",
              run: () => import("./chapter.mjs").then(m => m.openDeathDialog()) },
            { key: "monocub", icon: "fa-ghost", labelKey: "DRPG.Monocub.manageTitle",
              run: () => import("./monocub.mjs").then(m => m.openMonocubDialog()) },
            { key: "chapterEnd", icon: "fa-flag-checkered", labelKey: "DRPG.Chapter.endTitle",
              run: () => import("./chapter.mjs").then(m => m.openChapterEndDialog()) }
        ]
    },
    {
        key: "setup",
        collapsed: true,
        items: [
            { key: "gmTeam", icon: "fa-users-gear", labelKey: "DRPG.Panel.gmTeam",
              run: () => import("./gm-team-dialog.mjs").then(m => m.openGmTeamDialog()) },
            // Room Setup now carries the rest columns too, so the separate
            // "which rooms allow rest" entry would open the same window twice.
            { key: "roomSetup", icon: "fa-door-closed", labelKey: "DRPG.Vault.manageTitle",
              run: () => import("./vault.mjs").then(m => m.openRoomSetupDialog()) },
            { key: "installTables", icon: "fa-table-list", labelKey: "DRPG.Panel.installTables",
              run: () => import("./tables.mjs").then(m => m.installTables()) },
            // Two checks that were only ever reachable from the console, and both
            // of them answer a question you want answered BEFORE a session rather
            // than after: is everybody set up, and can anybody read a sheet they
            // should not.
            // Both of these answer "is the table ready", both are run at the
            // same moment — before a session — and neither is worth its own
            // trip through the panel. One tile runs both.
            { key: "preSessionChecks", icon: "fa-clipboard-check", labelKey: "DRPG.Panel.checks",
              run: async () => {
                  const [{ diagnoseCharacters }, { auditAnonymity }] = await Promise.all([
                      import("./diagnostics.mjs"), import("./anonymity.mjs")
                  ]);
                  await diagnoseCharacters();
                  await auditAnonymity();
              } }
        ]
    },
    {
        key: "fixes",
        dim: true,
        collapsed: true,
        items: [
            // The state-of-a-character tools. Everything else in this section
            // repairs the world; these three repair a person, and until now the
            // only routes to them were the console and a dialog that refused to
            // touch anybody still breathing.
            { key: "whoIsWhat", icon: "fa-user-pen", labelKey: "DRPG.Panel.whoIsWhat",
              run: () => openCharacterStateDialog() },
            { key: "resetActions", icon: "fa-rotate-left", labelKey: "DRPG.Panel.resetActions",
              run: async () => {
                  const results = await resetAllActions();
                  ui.notifications.info(game.i18n.format("DRPG.Panel.actionsReset",
                      { count: results.length }));
              } },
            // One tile, not two. "Show search tokens" and "Restock search
            // tokens" were the same errand split in half: you look because you
            // are deciding whether to restock, and you restock having looked. So
            // the report IS the dialog, and restocking is a button on it.
            { key: "searchTokens", icon: "fa-list-check", labelKey: "DRPG.Panel.searchTokens",
              run: () => openSearchTokenDialog() },
            // `Clear Faint Remnants` and `Reset all voice rooms` used to be tiles
            // here. Both are now buttons on the window they were always about —
            // the Remnant table and the voice room list — because each is a
            // decision you make while looking at that window, not before opening it.
        ]
    }
];

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
            <div class="drpg-gmp-grid">${section.items.map(item => `
                <button type="button" class="drpg-gmp-button" data-drpg-run="${item.key}">
                    <i class="fa-solid ${item.icon}" inert></i>
                    <span>${game.i18n.localize(item.labelKey)}</span>
                </button>`).join("")}</div>
        </details>`;
    }).join("");

    const body = dialogContent(`<div class="drpg-gm-panel">
        ${buildPanelContent()}
        ${sections}
    </div>`);

    const lookup = new Map(PANEL_SECTIONS.flatMap(s => s.items.map(i => [i.key, i])));

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
async function openCharacterStateDialog() {
    const { isDeceased, reviveCharacter } = await import("./chapter.mjs");
    const { isMonocub, setMonocub } = await import("./monocub.mjs");
    const { isMonokuma } = await import("./monokuma.mjs");

    const students = game.actors.filter(a => a.type === "character" && !isMonokuma(a));
    if (!students.length) {
        ui.notifications.info(game.i18n.localize("DRPG.Panel.noCharacters"));
        return;
    }

    const stateOf = a => isMonocub(a) ? "monocub" : isDeceased(a) ? "dead" : "alive";

    const rows = students.map(a => {
        const state = stateOf(a);
        return `<tr data-actor="${a.id}">
            <td>${foundry.utils.escapeHTML(a.name)}</td>
            <td><select name="state.${a.id}">
                ${["alive", "dead", "monocub"].map(s =>
                    `<option value="${s}"${s === state ? " selected" : ""}>${
                        game.i18n.localize(`DRPG.Panel.state.${s}`)}</option>`).join("")}
            </select></td>
        </tr>`;
    }).join("");

    const chosen = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Panel.whoIsWhat") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p class="notes">${game.i18n.localize("DRPG.Panel.whoIsWhatNote")}</p>
            <table><thead><tr>
                <th>${game.i18n.localize("DRPG.Panel.character")}</th>
                <th>${game.i18n.localize("DRPG.Panel.stateColumn")}</th>
            </tr></thead><tbody>${rows}</tbody></table>
        </form>`),
        buttons: [
            {
                action: "save", label: game.i18n.localize("DRPG.Panel.apply"), default: true,
                callback: (e, b, d) => Object.fromEntries(students.map(a =>
                    [a.id, d.element.querySelector(`[name="state.${a.id}"]`).value]))
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        rejectClose: false
    });

    if (!chosen || chosen === "cancel") return;

    let changed = 0;
    for (const actor of students) {
        const want = chosen[actor.id];
        if (!want || want === stateOf(actor)) continue;

        // Order matters: a Monocub is a dead student with a second flag, so the
        // flags are set from the outside in — deceased first, then Monocub.
        if (want === "alive") {
            await setMonocub(actor, false);
            await reviveCharacter(actor);
        } else if (want === "dead") {
            await setMonocub(actor, false);
            if (!isDeceased(actor)) await actor.setFlag(MODULE_ID, FLAGS.deceased, deathStamp());
        } else {
            if (!isDeceased(actor)) await actor.setFlag(MODULE_ID, FLAGS.deceased, deathStamp());
            await setMonocub(actor, true);
        }
        changed++;
    }

    ui.notifications.info(changed
        ? game.i18n.format("DRPG.Panel.stateSaved", { n: changed })
        : game.i18n.localize("DRPG.Panel.stateUnchanged"));
}

/**
 * The search-token report, with the restock button on it.
 *
 * `SearchTokens.report()` whispers a table to the GMs, which is the right place
 * for a record and the wrong place for a decision — you end up reading the chat
 * log, then hunting the panel again for the button the table just told you to
 * press. Here the same table is the dialog, and the button is under it.
 */
async function openSearchTokenDialog() {
    const max = SearchTokens.max;
    const scene = canvas?.scene;

    const rooms = Array.from(scene?.regions ?? [])
        .map(r => r.name).filter(Boolean).sort((a, b) => a.localeCompare(b));

    const rows = rooms.map(room => {
        const n = SearchTokens.left(room, scene);
        return `<tr${n === 0 ? ' style="opacity:.5"' : ""}>
            <td>${foundry.utils.escapeHTML(room)}</td>
            <td style="text-align:center">${n} / ${max}</td></tr>`;
    }).join("");

    const table = rows
        ? `<table><thead><tr>
               <th>${game.i18n.localize("DRPG.Vault.room")}</th>
               <th>${game.i18n.localize("DRPG.SearchTokens.title")}</th>
           </tr></thead><tbody>${rows}</tbody></table>`
        : `<p>${game.i18n.format("DRPG.SearchTokens.allFull", { max })}</p>`;

    const action = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Panel.searchTokens") },
        classes: ["drpg-panel"],
        content: dialogContent(table),
        buttons: [
            { action: "restock", label: game.i18n.localize("DRPG.Panel.resetSearch"), default: true },
            { action: "close", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        rejectClose: false
    });

    if (action === "restock") await SearchTokens.reset();
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

    const choice = await DialogV2.wait({
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
        const queue = game.drpg?.trialQueue?.() ?? null;
        return queue
            ? { text: game.i18n.format("DRPG.Panel.nextFloor", {
                  who: game.drpg.trialSpeaker?.()?.name ?? "—" }), action: "floor" }
            : { text: game.i18n.localize("DRPG.Panel.nextNoFloor"), action: "startTrial" };
    }

    if (clock.phase === "investigation") {
        return { text: game.i18n.localize("DRPG.Panel.nextInvestigation"), action: "investigation" };
    }

    // Daily Life. The one number that decides whether the time of day is over.
    return stillActing.length
        ? { text: game.i18n.format("DRPG.Panel.nextStillActing", { n: stillActing.length }),
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
                ? `<i class="fa-solid fa-shoe-prints" title="free Move available"></i>`
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
