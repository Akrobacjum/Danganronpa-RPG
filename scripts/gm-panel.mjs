/**
 * Danganronpa RPG - GM panel.
 * ---------------------------------------------------------------------------
 * The handful of things a GM does every time of day, behind one button, a red
 * hexagon in the corner cluster (E77 C6): move the clock, refill actions, restock search tokens, check
 * where everyone stands.
 *
 * Two of its windows live in files of their own since E41 C7a (1.2.97): the
 * Students window in gm-students.mjs and Edit campaign in gm-campaign.mjs. This
 * file re-exports the four names they export, so an importer of the panel
 * imports this file as before.
 */

import { MODULE_ID, moduleVersion, FLAGS, TIMES_OF_DAY } from "./config.mjs";
import { getClock, clockSummary, phaseLabel, campaignName } from "./clock.mjs";
import { actionsLeft, actionsMax, hasFreeMove } from "./actions.mjs";
import { isEclipse } from "./eclipse.mjs";
import { studentActors, actingStudents } from "./monokuma.mjs";
import { dialogContent, error, plural, esc, primaryGmId } from "./utils.mjs";
import { keepLive, alreadyOpen, RAISED } from "./live.mjs";
import { launcher } from "./ui-kit.mjs";
import { SETTINGS, bodyDiscovery, bodyFoundSinceTrial, seasonEpoch, sameSeason } from "./settings.mjs";
import { bodiesToDiscover, announcedIn, chapterEndStopped } from "./chapter.mjs";
import { flagsHeldNow, itemsHeldNow } from "./sheet-audit.mjs";
import { roomOfToken } from "./movement.mjs";
import { keyPlanStatus, keysToPlace } from "./investigation.mjs";
import { isTruthBullet, secretOf } from "./truth-bullets.mjs";
import { caseMark, caseWarning, healthLine, keyPlanStore } from "./gm-stores.mjs";
import { firstOutstandingStep } from "./season-setup.mjs";
import { roundOf, readyRecord } from "./boundary.mjs";
import { openWhoIsAliveDialog } from "./gm-students.mjs";
import { openClockDialog } from "./gm-campaign.mjs";
export { openWhoIsAliveDialog, applyAliveStates } from "./gm-students.mjs";
export { correctsTheHour, openClockDialog } from "./gm-campaign.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/**
 * The panel's launcher - a red hexagon in the corner cluster (E77 C6, 13.10.2026).
 *
 * It used to be one more tool in the token toolbar, which made the single
 * most-used GM control in the module a 26th grey icon in a column of grey
 * icons (Dawid, 26.08: out of there, bigger, named, red). From 26.08 to E77 C5
 * it sat at the top of Foundry's left column, above the scene controls; C5 took
 * the scene controls out of that column and into a window of their own, and C6
 * moves the button into the corner beside the messenger (the AM-21 variant B
 * grid: over the settings button, two rows up). It stays red where the rest of
 * the cluster wears the accent: red is the module's "this goes through the GM"
 * colour, and this button is the purest case of it on the screen.
 *
 * A CHILD OF THE BODY, WITH NO `drpg-` CLASS ON IT OR ABOVE IT. pixel-icons.css
 * paints any `i.fa-eye` under a `[class*="drpg-"]` ancestor as the plain eye,
 * and that rule would win over the Monokuma eye keyed to `#drpg-gm-launcher i`.
 * The button joins the cluster through `data-drpg-cluster` (glass.mjs's
 * LAUNCHERS), set before it is appended - and module.mjs makes it before the
 * glass's first measurement, which a button made in this file's own ready hook
 * would have missed (the hook is registered later than module.mjs's).
 *
 * The scene-controls hook stays for the GM's chrome marks; the button itself is
 * the module's and no render of Foundry's rebuilds it.
 */
export function registerGmPanel() {
    Hooks.once("ready", injectLauncher);
    Hooks.on("renderSceneControls", injectLauncher);
}

/**
 * The GM's chrome (GM_CHROME below), registered by module.mjs BEFORE its requirements check and
 * apart from the panel (E13 fix r1-F3, 12.10.2026; S12-18). The stylesheet hides the Scenes tab
 * unless the element carries the class this puts on it, and a Foundry that links the module's
 * stylesheet links it whether or not the module's script went on to start - so while this sat in
 * `registerGmPanel`, after the check, a world missing Dice So Nice, Isometric Perspective or LiveKit
 * (C10) stopped the module and took the tab from the GM as well, the directory to enable the
 * missing module in included. Measured headless on 12.10.2026: a GM's client booted with LiveKit
 * off (00-boot, "the GM's chrome when the module stops") computed the tab (then with the scene
 * navigation and the hotbar) `display: none` before this moved, shown after. Whether Foundry v14
 * links the sheet of a module whose requirements are missing is LIVE-E13-11. Nothing here reads a
 * setting: none is registered on that road.
 */
export function registerGmChrome() {
    /* The sidebar is an application of its own, and a tab bar it draws anew carries no class;
     * `ready` stamps what is drawn by then. The render names are Foundry's `render` + the
     * application's class name, read from memory and not measured on v14: headless, 00-boot's
     * "GM's chrome" fires them itself (LIVE-E13-09 looks at the table). The scene controls' render
     * stamps the rail as the launcher did. The scene navigation's and the hotbar's renders were
     * hooked here too until DZ5 (the owner, 12.10.2026) hid both for everybody: nothing of theirs
     * is stamped any more. */
    Hooks.once("ready", markGmChrome);
    for (const hook of ["renderSceneControls", "renderSidebar"]) Hooks.on(hook, markGmChrome);
}

/**
 * The parts of Foundry's interface the stylesheet styles or shows by the class a GM's client
 * puts on the element (E13 C7, 12.10.2026; S12-18): the rail, and the Scenes tab - hidden for
 * the GM as well until then, and shown again by Stained Glass alone, so under Legacy a GM had no
 * scene directory to build the trial hall in (D7: the hall is a scene the GM makes and links in
 * Room Setup > Scenes). E13 C7 gave the GM the scene navigation (`drpg-gm-nav`) and the hotbar
 * (`drpg-gm-hotbar`) in every theme too; the owner asked for both gone again (DZ5, 12.10.2026:
 * "niepotrzebne", on a tablet under Stained Glass), so the base sheet now hides them from
 * everybody in every theme - the hotbar as in 1.2.73, and the navigation under Legacy as Stained
 * Glass already did for the GM. Scenes switch from the Scenes tab; the five macros the repository
 * carries (macros/) and a GM's own run from the Macro Directory.
 * Since E77 C5 the rail and the sidebar stand in the GM's two Foundry windows (foundry-windows.mjs). Re-read then
 * (13.10.2026): neither selector names a column of Foundry's, nor does any rule danganronpa.css keys on these
 * two classes, and `markGmChrome` searches the whole document - so both are found and styled in the windows too.
 */
const GM_CHROME = [
    ["#scene-controls", "drpg-gm-rail"],
    ['#sidebar-tabs button[data-tab="scenes"], #sidebar .tabs button[data-tab="scenes"]', "drpg-gm-scenes"]
];

/* The GM-only styling is keyed on classes THIS function puts on the
 * elements themselves, not on `body.drpg-gm`: on a long-lived client
 * an ancestor-class selector was measured matching the element and
 * still not applying - present in the sheet, `matches()` true,
 * computed style ignoring it - while a same-element class works
 * everywhere. The Scenes tab GM_CHROME names is hidden by default in the
 * stylesheet and only a GM's client ever runs this to show it, so a
 * player needs no selector gymnastics at all - and a client where the
 * module never ran shows nobody any of it. A module that stopped at
 * its requirements check still runs this for the GM (`registerGmChrome`,
 * E13 fix r1-F3); a client that never loaded the script shows the GM none
 * of it, as the stylesheet cannot tell a GM without it. */
function markGmChrome() {
    if (!game.user?.isGM) return;
    for (const [selector, mark] of GM_CHROME) {
        for (const element of document.querySelectorAll(selector)) element.classList.add(mark);
    }
}

/** The GM's button in the corner, once; a player gets none. Exported for module.mjs's ready sequence. */
export function injectLauncher() {
    try {
        if (!game.user?.isGM) return;
        markGmChrome();
        if (document.getElementById("drpg-gm-launcher")) return;

        /* The kit's launcher (E44 C6): one of the corner's cluster, its name its tooltip, in the page's language - its
           name is the module's words (E66 C1); the panel it opens is a module window, marked by module.mjs. `fa-eye` is
           the fallback if the pixel mask ever fails to load - the sprite itself is keyed to `#drpg-gm-launcher i` and
           ignores the class. */
        const btn = launcher({ id: "drpg-gm-launcher", cluster: true, label: game.i18n.localize("DRPG.Panel.launcher"), icon: "fa-solid fa-eye", lang: true });
        btn.addEventListener("click", () => openGmPanel());
        document.body.append(btn);
    } catch (err) {
        error("Could not place the GM panel launcher", err);
    }
}

/**
 * Everything the panel can do, grouped by WHEN a GM reaches for it.
 *
 * This used to be two flat rows of dialog buttons - one on the panel and one
 * behind "More…" - and by the time the murder engine landed the second row was
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
 * minute. Which five is not a mystery - it is written on the clock. So each
 * section declares the phases it belongs to, and the panel opens with those
 * expanded and everything else folded away.
 *
 * `always` marks the sections that are never out of season: the clock itself,
 * and the toolbox. `collapsed` is the default for a section that is neither.
 * Nothing is hidden - every tile is one click from where it was - but the
 * screen a GM lands on is the one for the scene they are actually running.
 */
const PANEL_SECTIONS = [
    {
        key: "now",
        always: true,
        items: [
            /*
             * PLAYERS FIRST (Dawid, 03.09).
             *
             * It is the cast: who is alive, as what, what each of them is
             * carrying and what is in their stash - and it is the way in to
             * giving somebody a thing, one button on their own row. A GM
             * deciding "Sayaka should have this" is already looking at Sayaka.
             *
             * "Players", not "Player status": the window stopped being a
             * read-out the moment it grew the row buttons.
             */
            { key: "whoIsAlive", icon: "fa-heart-pulse", labelKey: "DRPG.Panel.whoIsAlive",
              run: () => openWhoIsAliveDialog() },
            // The tray's own manager: the screen a GM opens most often during a
            // Daily Life once the cast is settled.
            { key: "projects", icon: "fa-list-check", labelKey: "DRPG.Project.manageTitle",
              run: () => import("./projects-ui.mjs").then(m => m.openProjectManager()) },
            // Moved UP from Season setup, where it sat because it was only a
            // state-to-playlist mapping table. It now also puts a track on and
            // takes it off again - something a GM reaches for in the middle of
            // a scene, which is what this section is.
            // "Sound" rather than "Music" since E3: the window grew a third
            // tab of sound-effect files and the two volume sliders, so naming
            // the tile after one of its three tabs stopped being true.
            { key: "sound", icon: "fa-volume-high", labelKey: "DRPG.Sound.title",
              run: () => import("./music.mjs").then(m => m.openSoundDialog()) },
            { key: "rules", icon: "fa-gavel", labelKey: "DRPG.Rules.manageTitle",
              run: () => import("./rules.mjs").then(m => m.openRulesManager()) }
            // GONE FROM HERE:
            //   Public roll - removed (the owner, 03.11.2026: "Usunmy funkcje public roll
            //     z gm panel"; E60 C5a). E33 C12 put it here with its window; the roll
            //     itself stays a GM's macro, `game.drpg.publicRoll` (private-rolls.mjs).
            //   Dice look - E60 C5b put it where Public roll stood; it is a check before
            //     the session, so it went to Season setup's Pre-season checks (the owner,
            //     03.11.2026: "ten kafelek raczej powinien byc w season setup"; E60 C5b2).
            //   Give / take items - it is the Items button in the footer of
            //     Players, and a tile as well was a second door to the same
            //     window (Dawid, 03.09). The hub itself is unchanged; only this
            //     way in is gone.
            //   Edit campaign - moved to Between sessions. Naming the campaign
            //     and jumping the clock are setting-up, not mid-scene.
            //   Eclipse - the HUD's own chevron has done both halves of it for
            //     several versions; a second door to it was a second thing to
            //     keep in step. `nextStep` still offers it when one is running,
            //     see EXTRA_ACTIONS.
            //   Listen in on a voice room - removed outright (Dawid, 13.09):
            //     LiveKit shows the listener's tile to the room, so it never
            //     was a way to listen unseen. The voice reset it also carried
            //     is a tile under Between sessions.
        ]
    },
    {
        key: "case",
        // Also open during a Class Trial, because the trial console lives here
        // now - and during Daily Life, because that is when a GM decides to
        // hold one.
        phases: ["dailyLife", "investigation", "classTrial"],
        items: [
            // IN THE ORDER THEY HAPPEN.
            //
            // Greys out while an Eclipse runs rather than rejecting silently on
            // click: `openMurder` refuses the call either way (see the notes
            // there), but a GM should see WHY before pressing, not after.
            // `judgePendingMurders` still opens a parked Direct Murder once the
            // Eclipse it was declared in has ended - that path never goes
            // through this tile.
            { key: "murder", icon: "fa-skull", labelKey: "DRPG.Murder.openTitle",
              disabled: () => isEclipse(), disabledReason: "DRPG.Eclipse.panelLocked",
              run: () => import("./murder.mjs").then(m => m.openMurderDialog()), gmRoute: true },
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
            // Down from "Right now" (Dawid, 03.09): the campaign's name and the
            // clock are things a GM sets between sessions, not mid-scene.
            { key: "jump", icon: "fa-calendar-days", labelKey: "DRPG.Panel.jump",
              run: () => openClockDialog() },
            { key: "gmTeam", icon: "fa-users-gear", labelKey: "DRPG.Panel.despairFlow",
              run: () => import("./gm-team-dialog.mjs").then(m => m.openGmTeamDialog()) },
            // Room Setup carries the locks and the search-token counters now, so
            // the two quick toggles that used to live in the panel are columns
            // on the table that already says everything else about a room.
            { key: "roomSetup", icon: "fa-door-closed", labelKey: "DRPG.Vault.manageTitle",
              run: () => import("./vault.mjs").then(m => m.openRoomSetupDialog()) },
            // The editor, not the installer. Installing is still in there, as a
            // button - it is a thing you do once, and everything after that
            // first minute is editing.
            { key: "tables", icon: "fa-table-list", labelKey: "DRPG.Tables.editorTitle",
              run: () => import("./tables.mjs").then(m => m.openItemTables()) },
            // "Re-send everybody's voice room" - the one button the removed eavesdrop
            // window also carried, kept as its own tile. A resync since E19 C4
            // (voice.mjs `resetAllVoice`), no longer everybody to the main room.
            { key: "voiceReset", icon: "fa-microphone-lines", labelKey: "DRPG.Panel.voiceReset",
              run: async () => {
                  const { resetAllVoice } = await import("./voice.mjs");
                  const { avclientActive } = await import("./voice-client.mjs");
                  const n = await resetAllVoice();
                  if (n !== null) return ui.notifications.info(plural("DRPG.Voice.resetDone", { n }));
                  const name = game.users.get(primaryGmId())?.name ?? "";
                  ui.notifications.warn(avclientActive()
                      ? game.i18n.format("DRPG.Voice.resetRefused.primary", { name })
                      : game.i18n.localize("DRPG.Voice.resetRefused.livekit"));
              } },
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
            // A chapter that ends without a verdict - stretched because nobody
            // died, closed on a confession, a one-chapter season - had no door
            // on screen at all: the trial console's button waited on a verdict.
            { key: "chapterEndTile", icon: "fa-flag-checkered", labelKey: "DRPG.Chapter.endTitle",
              run: () => import("./chapter.mjs").then(m => m.openChapterEndDialog()) },
            // THE CASE (E04): what lives only in GM browsers - the answer keys, the
            // traces, the cast, the Mastermind - to one file and back. Before the
            // reset, which is the thing a backup is most often taken against.
            { key: "backupCase", icon: "fa-box-archive", labelKey: "DRPG.Case.backupTile", subtitle: () => backupAge(),
              run: () => import("./gm-stores.mjs").then(m => m.backupCase({ ask: true })) },
            { key: "restoreCase", icon: "fa-box-open", labelKey: "DRPG.Case.restoreTile",
              run: () => import("./gm-stores.mjs").then(m => m.openRestoreDialog()) },
            // Last in the section and red: it is the only control here that
            // destroys anything, and it destroys a chapter's worth at once.
            { key: "seasonReset", icon: "fa-trash-arrow-up", labelKey: "DRPG.Season.resetTitle",
              gmRoute: true, destructive: true,
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
            // built on - a tile that hands them out without moving the clock is
            // a way to lose track of which time of day the table is actually
            // in. `game.drpg.resetAllActions()` is still there for a GM who
            // genuinely needs to repair a botched advance.
        ]
    }
];

/**
 * Things `nextStep()` can suggest that are not tiles.
 *
 * The suggestion line is not a list of tools, it is one instruction - so it is
 * allowed to point at something the tile grid deliberately does not carry. The
 * Eclipse is the whole of it: the HUD owns that button, but "the Eclipse is
 * open, close it once everyone has placed" is still the right next step to be
 * told, and the "Do it" beside it should work.
 */
const EXTRA_ACTIONS = {
    // One road (E37 C2, D44b): the HUD's chevron calls the same function (boundary.mjs `toggleEclipse`; R1194).
    eclipse: { key: "eclipse", run: () => import("./boundary.mjs").then(m => m.toggleEclipse()) },
    /*
     * THE MOST REPEATED GESTURE OF A SESSION, IN ONE PRESS.
     *
     * "Everyone has spent their actions" used to point at the campaign editor:
     * six presses, the day and session bumped by hand at Night, and with the
     * refill box left off (the hint says to) none of the boundary work ran -
     * no restock, no seals cleared, no motive ticked, no overflow check. This
     * is the same call the Eclipse's end makes, refilling included; the day
     * and the session tick over at Night on their own. Refused during an
     * Eclipse, whose own end already advances - a second budget is exactly
     * what a table must never be handed.
     */
    // The readiness round asks first (E37 C3): boundary.mjs `nextTimeOfDay`, which refuses during an Eclipse as this did.
    advance: {
        key: "advance",
        run: () => import("./boundary.mjs").then(m => m.nextTimeOfDay())
    },
    chapterEnd: {
        key: "chapterEnd",
        run: () => import("./chapter.mjs").then(m => m.openChapterEndDialog())
    },
    // Starting Stage 7 has never had a tile - it was a side effect of finding
    // the body - so the suggestion line points at something the grid does not
    // carry, which is what EXTRA_ACTIONS is for.
    startInvestigation: {
        key: "startInvestigation",
        run: () => import("./clock.mjs").then(m => m.setPhase("investigation"))
    },
    // The GM's own announcement, for the Next line's body nobody has found yet (E11 C2).
    bodyDialog: {
        key: "bodyDialog",
        run: () => import("./chapter.mjs").then(m => m.openBodyDiscoveryDialog())
    },
    // The autopsy, for the Next line once the Investigation is on (E11 fix r1-G4).
    autopsy: {
        key: "autopsy",
        run: () => import("./gm-items.mjs").then(m => m.issueAutopsyDialog())
    },
    // The trial console, for the Next line once the Investigation is done.
    trial: {
        key: "trial",
        run: () => import("./trial-floor-ui.mjs").then(m => m.manageClassTrial())
    }
};

/**
 * The tiles, and whether each of them can be pressed right now.
 *
 * SEPARATE FROM `openGmPanel` BECAUSE IT HAS TO BE CALLED AGAIN. This was
 * inline in the opener, which meant `item.disabled?.()` was asked exactly once
 * - when the window opened - and every answer it gave was frozen there for as
 * long as the GM left the panel up. Dawid, 28.08: start an Eclipse from the HUD
 * and the murder tile stays lit, because nothing ever asked `isEclipse()` a
 * second time. Reproduced before it was fixed: with the panel open across a
 * whole Eclipse the tile's `disabled` stayed `false` and the button was the
 * same DOM node throughout, while the standing block above it correctly moved
 * from Night to Morning. Half a window updating is worse than none of it: the
 * fresh line is a promise that the rest is fresh too.
 *
 * `data-drpg-key` on each section is for `live.mjs`, which uses it to put the
 * GM's folded sections back after a rebuild. Without it the fold state is keyed
 * positionally, which is fine until a section is added or removed.
 */
function buildSections() {
    // The clock decides what opens. See the note on PANEL_SECTIONS.
    const phase = getClock().phase;
    return `<div class="drpg-gmp-sections">${PANEL_SECTIONS.map(section => {
        const inSeason = section.always || section.phases?.includes(phase);
        const open = inSeason && !section.collapsed;
        return `
        <details class="drpg-gmp-section${section.dim ? " dim" : ""}${
            inSeason ? " in-season" : ""}" data-drpg-key="${section.key}"${open ? " open" : ""}>
            <summary>${game.i18n.localize(`DRPG.Panel.section.${section.key}`)}</summary>
            <div class="drpg-gmp-grid">${section.items.map(item => {
                const blocked = Boolean(item.disabled?.());
                return `
                <button type="button" class="drpg-gmp-button${
                    item.gmRoute ? " drpg-gm-route" : ""}${item.destructive ? " drpg-destructive" : ""}${
                    blocked ? " drpg-disabled" : ""}" data-drpg-run="${item.key}"${
                    blocked ? ` disabled title="${foundry.utils.escapeHTML(game.i18n.localize(item.disabledReason))}"` : ""}>
                    <i class="fa-solid ${item.icon}" inert></i>
                    <span>${game.i18n.localize(item.labelKey)}</span>${
                    item.subtitle ? `<small class="notes">${esc(item.subtitle())}</small>` : ""}
                </button>`;
            }).join("")}</div>
        </details>`;
    }).join("")}</div>`;
}

/** Open the panel. */
export async function openGmPanel() {
    // ONE OF THESE, NOT FOUR - see `alreadyOpen` in live.mjs. Two copies of a
    // window each read the world when they opened and neither knows about the
    // other, so the older one goes on looking authoritative while showing
    // something that stopped being true. Raised rather than refused: pressing
    // twice usually means the window is behind something.
    if (alreadyOpen("drpg-window-panel")) return RAISED;

    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return;
    }

    const sections = buildSections();

    // Which version is running, on the screen a GM opens most.
    //
    // One number, read off the manifest, so it cannot go stale - see the note
    // on `moduleVersion` in config.mjs for the second stamp that used to sit
    // beside it and why it is gone. It is on the panel rather than in the
    // console because the question it answers ("is the fix I was sent actually
    // loaded?") is asked by somebody looking at the interface, not a debugger.
    const version = moduleVersion();
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
        classes: ["drpg-panel", "drpg-gm-panel-window", "drpg-window-panel"],
        content: body,
        buttons: [{ action: "close", label: game.i18n.localize("DRPG.Panel.close"), default: true }],
        // Each tile closes the panel, does its thing, and the panel comes BACK.
        //
        // Closing first has always mattered: most of these open a dialog of
        // their own, and stacking one on top of the panel it came from is how a
        // GM loses track of which window they are answering. What was missing
        // was the other half. A GM's work is rarely one tile - place a Remnant,
        // check the dashboard, advance the clock - and each of those meant
        // finding the panel again from the scene controls. The incident tracker
        // has always reopened itself after every action; this is the same idea,
        // applied to the screen that is opened more often than any other.
        //
        // Every tile here awaits a dialog of its own, so by the time `run()`
        // resolves the screen is clear again and the panel can come back.
        // Reopened only when a tile was actually used, never when the panel was
        // dismissed.
        render: (event, dialog) => {
            // ONE delegated listener, not one per button. The standing block
            // above the tiles redraws itself while the panel is open (see
            // below), and a listener bound to a button that has since been
            // replaced is a "Do it" that does nothing.
            dialog.element.addEventListener("click", async ev => {
                const button = ev.target.closest?.("[data-drpg-run]");
                if (!button || !dialog.element.contains(button)) return;
                ev.preventDefault();
                const item = lookup.get(button.dataset.drpgRun);
                if (!item) return;
                await dialog.close();
                let answer = null;
                try {
                    answer = await item.run();
                } catch (err) {
                    error(`GM panel action "${item.key}" failed`, err);
                    ui.notifications.error(game.i18n.localize("DRPG.Panel.failed"));
                }
                /* NOT BACK OVER A WINDOW THE TILE RAISED (E44 C2c, 04.11.2026; audit S10-59). A tile whose window
                   was already open behind the panel raises it and answers RAISED (live.mjs) at once - the GM has
                   not used it yet, and a panel reopened now stood over the window the GM had just asked to see. */
                if (answer === RAISED) return;
                openGmPanel().catch(err =>
                    error("Could not reopen the GM panel", err));
            });

            keepPanelFresh(dialog);
        },
        rejectClose: false
    });
}

/**
 * Keep the whole panel true for as long as it is open - not just its first line.
 *
 * THE HALF THAT WAS MISSING. This used to redraw only the standing block, and
 * said so: "the tiles below it are a fixed list and redrawing them would take
 * the GM's open sections and scroll position with it". The list is fixed; what
 * each tile ALLOWS is not, and that was the part nobody was refreshing. So the
 * tiles are redrawn too, and the objection is answered rather than avoided -
 * `keepLive` carries the folded sections and the scroll across a rebuild, and
 * refuses to redraw at all while the GM has focus inside the region.
 *
 * Two regions rather than one, deliberately. They change on different clocks:
 * the suggestion line moves whenever anybody spends anything, the tiles only
 * when the world opens or closes a door. Rebuilding the tiles on every actor
 * update would be forty buttons redrawn each time a player marks a Stress.
 *
 * Every input to both answers is either a flag on an actor (actions left, the
 * free Move, dead or a Monocub) or one of this module's world settings (the
 * clock, the incident, the Eclipse, the trial's floor and progress), which is
 * exactly what `keepLive` listens to. Since E11 fix r1-G4 the next line also reads
 * the students' items (an autopsy issued), the Key Remnants' tokens and the case's
 * Key count in the Key plan's store (`keysToPlace`), so the standing block watches
 * those three as well (tier 0 R19 asks the items of a window that reads bullets;
 * the redraw on a token or a store row is read in the code, not measured).
 */
function keepPanelFresh(dialog) {
    keepLive(dialog, {
        region: ".drpg-gmp-standing",
        build: () => buildPanelContent(),
        watch: { actors: true, items: true, tokens: true, stores: [keyPlanStore] }
    });

    /* THE TILES WAKE ON THEIR OWN KEYS (E44 C2b, 04.11.2026; audit S10-58). Without `settings` every write of a
       module setting redrew forty buttons, a player's action among them. What the tiles print is the clock (the
       phase opens a section, `clock.eclipse` shuts the murder tile: `isEclipse`) and the case's backup mark (the
       Back up tile's age, `backupAge`), read by `buildSections` and nothing else, in every state; R1317 builds the
       region with `game.settings.get` counted and holds the reads to this list.
       The standing block above keeps no list, deliberately: `nextStep` reads a different setting on each of its
       branches (the incident, the readiness round, a stopped chapter's end, the trial's progress and floor, the
       body's hold), and one build reads only the branch the world is on - a list measured from it would leave the
       block stale on every other. A press on either region is never lost to a redraw (live.mjs, rule 1 for a hand). */
    keepLive(dialog, {
        region: ".drpg-gmp-sections",
        build: () => buildSections(),
        watch: { settings: [SETTINGS.clock, SETTINGS.caseMark] }
    });
}

/**
 * Announce (or end) the Final Trial. World-scoped and public on purpose - the
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
 * inventory and cannot be undone, and this is the repair tool - it moves the two
 * flags and nothing else. Killing somebody properly is still `A character dies`,
 * one section up, where the warning about the inventory lives.
 */

/**
 * Everything this client has failed at since the page loaded.
 *
 * The module reports 181 different failures through `error()`, and until now
 * every one of them went to `console.error` and stopped there - which is to say
 * to nobody, because nobody runs a session with DevTools open. A feature could
 * be completely dead and the only symptom was that it did not happen.
 *
 * THIS SESSION ONLY, and that is not a filter - the log is an array in memory,
 * so a reload empties it. A failure from before the reload is not something the
 * GM can act on now, and a log that accumulates across weeks is a log nobody
 * opens.
 *
 * Newest last, the way a log reads. Repeats are one row with a count: the first
 * occurrence explains the cause, the four hundredth only proves it continued.
 */
async function openFailureLog() {
    // ONE OF THESE, NOT FOUR - see `alreadyOpen` in live.mjs. Two copies of a
    // window each read the world when they opened and neither knows about the
    // other, so the older one goes on looking authoritative while showing
    // something that stopped being true. Raised rather than refused: pressing
    // twice usually means the window is behind something.
    if (alreadyOpen("drpg-window-failures")) return RAISED;

    const { sessionFailures, clearSessionFailures, localeFormat } = await import("./utils.mjs");
    const rows = sessionFailures();
    // The page's language (E66 C1), where it was the browser's locale.
    const when = at => localeFormat("time", at);

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
        classes: ["drpg-panel", "drpg-wide", "drpg-window-failures"],
        window: { title: game.i18n.localize("DRPG.Failures.title") },
        content: dialogContent(`<div>
            <p class="notes">${esc(game.i18n.localize("DRPG.Failures.intro"))}</p>
            ${body}
        </div>`),
        buttons: [
            { action: "close", label: game.i18n.localize("DRPG.Panel.close"), default: true },
            ...(rows.length ? [
                { action: "copy", label: game.i18n.localize("DRPG.Failures.copy") },
                { action: "clear", label: game.i18n.localize("DRPG.Failures.clear") }
            ] : [])
        ],
        rejectClose: false
    });

    // Plain text, with the WHOLE stack - the window truncates each trace to
    // four lines because a wall of frames is noise to read past, but the copy
    // exists to be pasted at whoever will debug it, and they want the rest.
    // The header line carries the versions, because a pasted log always
    // arrives without them and they are always the first question back.
    if (action === "copy") {
        const text = [
            `Danganronpa RPG ${game.modules.get(MODULE_ID)?.version ?? "?"} - `
                + `Foundry ${game.version} - ${game.user.name} - ${new Date().toISOString()}`,
            ...rows.map(r => [
                `[${when(r.at)}] (${r.level}${r.count > 1 ? ` ×${r.count}` : ""}) ${r.message}`,
                ...(r.stack ? [r.stack.split("\n").map(l => `    ${l}`).join("\n")] : [])
            ].join("\n"))
        ].join("\n\n");
        try {
            await game.clipboard.copyPlainText(text);
            ui.notifications.info(game.i18n.localize("DRPG.Failures.copied"));
        } catch (err) {
            error("Could not copy the debug log", err);
        }
        // Back to the log - the button copied, it did not mean "and close".
        return openFailureLog();
    }

    if (action === "clear") {
        clearSessionFailures();
        ui.notifications.info(game.i18n.localize("DRPG.Failures.cleared"));
    }
}

/**
 * What to do next.
 * ---------------------------------------------------------------------------
 * The panel is a list of tools, and a list of tools is the answer to "what can
 * I do", which is not the question a GM has mid-session. The question is "what
 * happens now" - and the module already knows, because every input to that
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
 * `incident` and `eclipse` are the world's unless handed: R1512 asks about Daily Life with neither,
 * and the suite runs tier 1 with an incident open as well (01-runtests A1, where the world's
 * incident answered first and R1512 read the incident's line on CI at e52a60ef).
 *
 * @returns {{text: string, action: string|null}}
 */
export function nextStep(clock, { setupList, incident = game.drpg?.murderState?.()?.active, eclipse = isEclipse(), round = roundOf(readyRecord(), clock),
    endStopped = Boolean(chapterEndStopped()) } = {}) {
    const students = actingStudents();
    const stillActing = students.filter(a => actionsLeft(a) > 0);

    if (incident) {
        return { text: game.i18n.localize("DRPG.Panel.nextIncident"), action: "murder" };
    }

    /* A READINESS ROUND STANDS OPEN (E37 fix FG1, 02.11.2026; the end review's G-m3, the slice's edge "nextStep says a
       round is open"). A GM whose page loaded mid-round - a reload, a second GM - had nothing saying the players were
       asked. The line names it, and its "Do it" is the same road the round was opened by (boundary.mjs `nextTimeOfDay`
       or `toggleEclipse`): it joins the round and opens the window, or, when the GM who opened it is not connected,
       ends it and asks again. `round` is the world's unless handed (R1204). */
    if (round) {
        return { text: game.i18n.localize("DRPG.Panel.nextReady"), action: round.kind === "next" ? "advance" : "eclipse" };
    }

    if (eclipse) {
        return { text: game.i18n.localize("DRPG.Panel.nextEclipse"), action: "eclipse" };
    }

    /* A CHAPTER'S END THAT STOPPED PART WAY (E42 C2, 1.2.97; E42-10). It stands until it is finished or dropped, and no
       new end starts meanwhile (chapter.mjs `applyChapterEnd`), so the line says so whatever the phase, and its "Do it"
       opens End the chapter, which asks Finish the chapter's end, Drop the rest or Cancel. `endStopped` is the world's
       unless handed (E42-T5). */
    if (endStopped) {
        return { text: game.i18n.localize("DRPG.Panel.nextChapterEndStopped"), action: "chapterEnd" };
    }

    if (clock.phase === "classTrial") {
        /* A TRIAL THAT HAS OUTLIVED ITS CHAPTER, WHICH IS THE STATE THIS LINE COULD
           NOT SEE. End the chapter with the trial still sitting and the clock moves
           while the phase does not - so every question below is asked about a trial
           whose chapter is over, and the honest answer to all of them is the same
           one: close it. Measured on 10.09, the line said "The debate is open -
           Nonstop Debate." and pointed the GM back at the trial they had just
           finished, one press after they ended the chapter.

           The STORED chapter, because `trialProgress()` answers blank for a record
           from another chapter and the blank is precisely what hides this. The
           chapter-end screen now closes the trial itself, so this is the backstop
           for the GM who unticks that box, ends the chapter from somewhere else, or
           comes back to a world saved in the middle of it. */
        const trialWas = game.drpg?.trialProgressChapter?.() ?? null;
        if (trialWas != null && trialWas < clock.chapter) {
            return { text: game.i18n.localize("DRPG.Panel.nextTrialOutlived"), action: "trial" };
        }

        // THE TRIAL HAS AN ORDER NOW, so this line follows it rather than
        // asking for a debate for the rest of the trial. The two finished steps
        // are read from the trial's own progress record; see vote.mjs.
        const progress = game.drpg?.trialProgress?.() ?? {};
        if (progress.verdictApplied) {
            return { text: game.i18n.localize("DRPG.Panel.nextChapterEnd"), action: "chapterEnd" };
        }
        if (progress.voteClosed) {
            return { text: game.i18n.localize("DRPG.Panel.nextVerdict"), action: "trial" };
        }

        const floor = game.drpg?.trialFloor?.() ?? null;
        if (!floor) {
            return { text: game.i18n.localize("DRPG.Panel.nextNoFloor"), action: "trial" };
        }
        // The floor no longer has a single "speaker" to name - in a discussion
        // everybody may talk, and in the two restrictive modes the interesting
        // fact is the mode itself, not one name. So the line reports the mode,
        // and adds who holds it only when somebody actually does.
        const holder = game.drpg?.trialHolder?.()?.name ?? null;
        const mode = game.i18n.localize(`DRPG.Floor.mode.${floor.mode}`);
        return {
            text: holder
                // Escaped: the panel is drawn with `innerHTML`, and the holder's name
                // is their player's to write (E02, audit S10-13).
                ? game.i18n.format("DRPG.Panel.nextFloorHeld", { mode, who: esc(holder) })
                : game.i18n.format("DRPG.Panel.nextFloor", { mode }),
            action: "trial"
        };
    }

    /* A body found and not yet answered. The phase has deliberately NOT moved (D5), so nothing
       else in this function would notice it - and it is the one state where the game is
       genuinely waiting on the GM.
       The phase is read as well, because there is one route that reaches the discovery with
       Stage 7 already running: a GM who moves the phase first and announces the body second.
       The record is written on that route too (it is the only thing that still knows the victim
       and the room, since `endMurder` wipes the incident before any of this), but the game is
       not waiting on anybody - and a "Do it" that calls `setPhase("investigation")` when the
       phase is already investigation is a button that does nothing. */
    const holding = bodyDiscovery() && clock.phase !== "investigation";

    /* WHAT COMES AFTER THE ANNOUNCEMENT (E11 fix r1-G4; audit S13-14). The issue's harm runs on past
       the body: the after-incident window lists the Key Remnants still to place and the autopsy, and
       once it was dismissed this line said only "start the Investigation" and then "check what has
       been found" - nothing of four Key Remnants not on the map or an autopsy nobody had issued. Both
       come now in the handbook's order ("Place the remaining Key Remnants", then "Body found: ...
       start the Investigation ... Issue the autopsy"), each with the window that does it: the Key
       Remnants from the moment the body is announced, until the case's count (`caseKeyCount`)
       stands on the map; the autopsy once the Investigation is on, until a student holds one of this
       chapter. Only after an announcement - the hold, or an Investigation with a discovery since the
       chapter's last trial (`bodyFoundSinceTrial`) - because both are about a body (tier 2 "after a
       body is announced the GM's next line names the Key Remnants to place and then the autopsy";
       65-season B1). */
    const announced = holding || (clock.phase === "investigation" && Boolean(bodyFoundSinceTrial(clock)));
    if (announced) {
        let keys = 0;
        try {
            keys = keysToPlace(clock.chapter);
        } catch {
            keys = 0;
        }
        if (keys > 0) return { text: plural("DRPG.Panel.nextKeysToPlace", { n: keys }), action: "investigation" };
    }

    if (holding) {
        return { text: game.i18n.localize("DRPG.Panel.nextBodyFound"), action: "startInvestigation" };
    }

    if (clock.phase === "investigation") {
        if (announced && !autopsyIssued(clock.chapter)) {
            return { text: game.i18n.localize("DRPG.Panel.nextAutopsy"), action: "autopsy" };
        }
        // Once every planned Key Remnant has been found the one step that ends
        // the phase is the trial (CORE-19); the line used to describe the
        // Investigation for the whole of it.
        let status = null;
        try {
            status = keyPlanStatus();
        } catch {
            status = null;
        }
        if (status?.entries?.length && status.missing === 0) {
            return { text: game.i18n.localize("DRPG.Panel.nextStartTrial"), action: "trial" };
        }
        return { text: game.i18n.localize("DRPG.Panel.nextInvestigation"), action: "investigation" };
    }

    /* A BODY NOBODY HAS FOUND YET (E11 C2, 1.2.73; audit S13-14). Once the incident closed, the
       one guide through a murder was the window that closes it: dismissed, this line went back to
       counting actions while the victim lay unannounced, and nothing told a new GM the case was
       waiting on a discovery (tier 2 "the GM's next line names a body nobody has found yet";
       65-season B0). The bodies are the watcher's own (`bodiesToDiscover`, with the deaths the GMs
       hold and the flags as the GMs hold them, `flagsHeldNow`), so the line names the bodies the
       watcher would take: this chapter's and season's, not an execution, not announced by a
       discovery of this chapter. Only here, in Daily Life with no hold and no Eclipse, because
       those are when a walk-in can find it (`checkBodyFound`). A walk-in also needs the body's
       token on the walk's scene, not hidden and in a room, which C2's line did not ask: a hidden or
       token-less body was told "Two witnesses find it", which cannot happen (E11 fix r1-G3; early
       review EARLY-C2-3). So the line reads the body's tokens on every scene: one a witness could
       find on the scene this GM is viewing names its room; one only on another scene gets the line
       without the room; none, the line without the witnesses (tier 2 "the GM's next line tells a
       hidden body to be announced by hand"). */
    const waiting = bodyWaiting(clock);
    if (waiting) {
        let findable = [];
        try {
            findable = (game.scenes?.contents ?? []).flatMap(scene => scene.tokens?.filter?.(t =>
                t.actor?.id === waiting.id && !t.hidden && roomOfToken(t)) ?? []);
        } catch { /* a scene not readable here: no witness road the line can name */ }
        const here = findable.find(t => t.parent?.id === canvas?.scene?.id);
        const room = here ? roomOfToken(here) : null;
        return {
            // Escaped: a room's name is the scene author's, and the panel is drawn with `innerHTML`.
            text: room
                ? game.i18n.format("DRPG.Panel.nextBodyWaiting", { room: esc(room) })
                : game.i18n.localize(findable.length ? "DRPG.Panel.nextBodyWaitingNoRoom" : "DRPG.Panel.nextBodyWaitingUnseen"),
            action: "bodyDialog"
        };
    }

    /* A SEASON NOT SET UP YET (E20 C4, S10-57; Q-8). On a fresh world - no student, no room - the line below said
       "Everyone has spent their actions. Start the Eclipse" with a Do it that started an Eclipse over nobody, on the
       first screen a new GM opens. Until every required row of Set the season up holds, Daily Life's line names its
       first row not done and opens that window (R1512). Read only here, where the line would otherwise count actions:
       a murder, an Eclipse, a trial and a body come first. `setupList` is the checklist as `steps()` draws it, handed
       in by R1512. */
    let outstanding = null;
    try {
        outstanding = firstOutstandingStep(setupList);
    } catch (err) {
        error("Could not read Set the season up for the Next line", err);
    }
    /* BEFORE THE SEASON STARTS, NOT IN A RUNNING GAME (the owner's Q-8 amended, 30.10.2026). In a game under way a
       required row not done - a student added mid-season with no Ultimate, a room check that found a fault - took the
       line from "N students still have actions", the one number a GM running a time of day reads. Before the season
       starts (`seasonUnderway`) the setup line replaces it, as C4 built; once it runs, Daily Life's line stays first and
       the row comes under it as a second, quieter line (`setup`, drawn by `nextLineHtml`). R1522. */
    const stepName = outstanding ? game.i18n.localize(`DRPG.Season.step.${outstanding.key}`) : "";
    if (outstanding && !seasonUnderway(clock)) {
        return { text: game.i18n.format("DRPG.Panel.nextSeasonSetup", { step: stepName }), action: "seasonSetup" };
    }

    // Daily Life. The one number that decides whether the time of day is over.
    // The boundary between two times of day IS the Eclipse (`startEclipse`
    // refills, `endEclipse` advances), so that is what the line suggests; the
    // "Next time of day" button beside the clock is the road for a table that
    // skips one. Neither goes near the campaign editor, which is for corrections.
    const line = stillActing.length
        ? { text: plural("DRPG.Panel.nextStillActing", { n: stillActing.length }),
            action: null }
        : { text: game.i18n.localize("DRPG.Panel.nextAllDone"), action: "eclipse" };
    return outstanding
        ? { ...line, setup: { text: game.i18n.format("DRPG.Panel.nextSeasonSetupAside", { step: stepName }), action: "seasonSetup" } }
        : line;
}

/**
 * WHETHER THE SEASON HAS STARTED (the owner's Q-8 amended, 30.10.2026): the clock has left the first time of day of
 * its first day - a time of day, a day, a session or a chapter on, a phase other than Daily Life - or a boundary has
 * refilled the cast (`refilledFor`, written by the first Eclipse). A fresh world's clock and the one a season reset
 * writes (chapter 1, day 1, session 1, the first time of day, Daily Life, `refilledFor` forgotten) read not started.
 * Pure over the clock handed in; exported for R1522.
 */
export function seasonUnderway(clock) {
    if (!clock) return false;
    const first = TIMES_OF_DAY[0];
    return clock.refilledFor != null
        || (Number(clock.chapter) || 1) > 1 || (Number(clock.day) || 1) > 1 || (Number(clock.session) || 1) > 1
        || (clock.timeOfDay ?? first) !== first || (clock.phase ?? "dailyLife") !== "dailyLife";
}

/**
 * The Next line as the panel draws it (E11's line; the owner's Q-8 amended): the label, the text and its Do it, and
 * under them, while a game under way still has a required Season setup row not done, that row as a second, quieter
 * line with its own Open (`step.setup`). The second line's classes are its own, so a reader of the first
 * (`.drpg-gmp-next-text`, `.drpg-gmp-next-go`; scenario 65) reads the line it read before. Exported for R1522.
 */
export function nextLineHtml(step) {
    const setup = step?.setup ? `<div class="drpg-gmp-next-setup">
            <span class="drpg-gmp-next-setup-text">${step.setup.text}</span>
            <button type="button" class="drpg-mini-button drpg-gmp-next-setup-go" data-drpg-run="${step.setup.action}">
                ${game.i18n.localize("DRPG.Season.openIt")}</button>
        </div>` : "";
    return `<div class="drpg-gmp-next">
            <span class="drpg-gmp-next-label">${game.i18n.localize("DRPG.Panel.nextLabel")}</span>
            <span class="drpg-gmp-next-text">${step.text}</span>
            ${step.action
                ? `<button type="button" class="drpg-gmp-next-go" data-drpg-run="${step.action}">
                       ${game.i18n.localize("DRPG.Panel.nextGo")}</button>`
                : ""}
            ${setup}
        </div>`;
}

/** The first body a walk-in would discover now, as the watcher picks them (`bodiesToDiscover`), or null. GM-side. */
function bodyWaiting(clock) {
    const epoch = seasonEpoch();
    const [id] = bodiesToDiscover({ actors: studentActors(), clock, epoch, announced: announcedIn(clock.chapter, epoch), held: flagsHeldNow });
    return id ? game.actors.get(id) ?? null : null;
}

/**
 * Whether a student holds an Autopsy Truth Bullet of `chapter`, by the GMs' answer keys (`secretOf`: the
 * real type and the chapter `createTruthBullet` wrote with it) over the items as the GMs hold them
 * (`itemsHeldNow`, the key fee's reading in `keyFeeOf`). GM-side; a player's console cannot write an answer key.
 * Of this season (E11 fix r2-H2; round 1's res R6, round 2's goal S06-42): a reset that keeps the Truth
 * Bullets starts again at chapter 1, and last season's chapter-1 autopsy read as issued, so the new
 * chapter's line never asked for one. An autopsy's answer key names its season since (truth-bullets.mjs
 * `createTruthBullet`, a copy its original's); one issued before 1.2.73 names none and is read by its chapter alone, as before (`sameSeason`; tier 2
 * "this season's chapter reads none of last season's Key Remnants nor its autopsy nor its silence").
 */
function autopsyIssued(chapter) {
    return studentActors().some(actor => itemsHeldNow(actor).some(item => {
        if (!isTruthBullet(item)) return false;
        const secret = secretOf(actor.items.get(item.id)?.uuid);
        return secret.realType === "autopsy" && Number(secret.chapter) === Number(chapter) && sameSeason(secret);
    }));
}

/** Current standing: where the clock is and what everyone has left. */
function buildPanelContent() {
    const clock = getClock();

    // The living cast, and only them.
    //
    // This listed every `character` actor, which meant the GM's own Monokumas
    // sat in the middle of it reading "0 / 0" - they have no action economy by
    // design - and so did every corpse. The one question this table answers is
    // "who still has actions left", and neither of those can have any. A
    // Monocub stays: they spend a real budget on Move and Meddle.
    const roster = actingStudents();

    const rows = roster
        .map(a => {
            const left = actionsLeft(a);
            const max = actionsMax(a);
            // The sheet says this with a PAIR - solid when the free Move is
            // there, outline when it has been used - exactly as the action pips
            // do with `fa-circle`. This column used to answer with a footprint
            // or an em dash, which is a second language for the same fact. An
            // empty outline says "used" in the one the rest of the interface
            // already speaks.
            const move = `<i class="${hasFreeMove(a) ? "fa-solid" : "fa-regular"} `
                + `fa-shoe-prints drpg-pix-foot" title="${esc(game.i18n.localize(
                    hasFreeMove(a) ? "DRPG.Actions.freeMoveAvailable" : "DRPG.Actions.freeMoveSpent"))}"></i>`;
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
    const suggestion = nextLineHtml(nextStep(clock));

    // One press for the clock, on the line that shows it. Hidden during an
    // Eclipse (its end advances) and in a trial (the chapter's end does).
    const canAdvance = !isEclipse() && clock.phase !== "classTrial";
    const advance = canAdvance
        ? `<button type="button" class="drpg-gmp-next-go drpg-gmp-advance" data-drpg-run="advance"
                data-tooltip="${esc(game.i18n.localize("DRPG.Panel.advanceTooltip"))}">
               <i class="fa-solid fa-forward-step" inert></i> ${esc(game.i18n.localize("DRPG.Panel.advance"))}</button>`
        : "";

    // THE CASE IS INCOMPLETE ON THIS BROWSER (E04): the primary's health check
    // found a row missing and the GM chose Continue. It stays, at the top, until
    // a check passes - a restore, or the next load with the copy in place.
    const warning = caseWarning();
    const caseLine = warning
        ? `<p class="drpg-warning">${esc(game.i18n.localize("DRPG.Case.panelWarning"))} ${esc(warning.rows
            .filter(r => r.level === "missing").map(healthLine).join(" "))}</p>`
        : "";

    return `<div class="drpg-gmp-standing">
                ${caseLine}
                <h3>${foundry.utils.escapeHTML(campaignName(clock))}</h3>
                <p><strong>${clockSummary(clock)}</strong>
                   <span class="drpg-gmp-phase">${phaseLabel(clock.phase)}</span>
                   ${advance}</p>
                ${suggestion}
                ${table}
            </div>`;
}

/** The Back up tile's second line: when the case was last backed up, from the world's case mark (E04). */
function backupAge() {
    const at = caseMark().lastBackupAt;
    if (!at) return game.i18n.localize("DRPG.Case.backupNever");
    const days = Math.floor((Date.now() - at) / 86400000);
    return days < 1 ? game.i18n.localize("DRPG.Case.backupToday") : plural("DRPG.Case.backupAgo", { n: days });
}
