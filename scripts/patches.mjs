/**
 * Danganronpa RPG - the contract register: every place this module reaches into
 * Foundry's, Daggerheart's or another module's code.
 * ---------------------------------------------------------------------------
 * Each reach - a method of theirs replaced, a CONFIG entry written, a hook of
 * another package listened to - has its reasons written beside it in its own
 * file; what none of them had was a list (audit A18, S17-50), so a system
 * update that moved one of the targets was found by whichever feature stopped
 * working first - a critical paying the system's numbers, captions floating
 * off tokens again - rather than by a question anybody could ask.
 *
 * NOTHING HERE PATCHES ANYTHING. This is a table, and `diagnosePatches` reads
 * it: is the target still where the code expects it, and is what sits there
 * ours? A new reach is registered by adding a row here and, for an override, by
 * leaving a mark on its wrapper that the row's `probe` can recognise - a
 * `Symbol.for` key, a property, or simply a name on the function. R1537 (tier 0)
 * reads the source for overrides and other packages' hooks that have no row.
 *
 * Since E52 C2 the primary GM runs it at every load (`announceContract`, from
 * module.mjs's ready, after the requirements): each row is ok, failed or
 * unknown, a failed row is one permanent notice to that GM naming its target,
 * its file and function and what the table gets instead, and Pre-season's
 * checks list the same (season-setup.mjs `preSessionReport`). It only reads:
 * a failed row's fallback is the one its own file has always had (D24 as the
 * spec reads it, Q-6), and the trust rows - the relay guard, the roll draw -
 * read their own files' states and never turn a failed one into a looser one.
 * Also fetched by `game.drpg.diagnosePatches()` and the newer-system warning
 * (requirements.mjs); nothing imports this file statically.
 */

import { refreshStateParked } from "./iso-shield.mjs";
import { chatLogClass } from "./secret.mjs";
import { rollDialogClass } from "./roll-dialog.mjs";
import { hourColour } from "./own-ring.mjs";
import { ACTIONS_DEFINITION } from "./resources.mjs";
import { ACTIONS_RESOURCE, MODULE_ID } from "./config.mjs";
import { relayGuardStatus } from "./relay-guard.mjs";
import { rollDrawState } from "./roll-draw.mjs";
import { visibleGetterOf } from "./fog.mjs";
import { levelFailure } from "./rooms.mjs";
import { plural, warn } from "./utils.mjs";

const AV_MODULE = "avclient-livekit";

/**
 * The kinds a row may be (E52 Q-3): a method or class of theirs replaced or a
 * CONFIG entry written (override), a hook of another package (hook), a setting
 * of another package's the module reads or writes (setting-entry), a flag of
 * another package's (flag), another package's socket (socket), a DOM selector of
 * theirs (anchor), a method or constant of theirs the code calls or relies on
 * (call).
 */
export const KINDS = Object.freeze(["override", "hook", "setting-entry", "flag", "socket", "anchor", "call"]);

/**
 * One row per reach.
 *
 *   id       a stable name for the row, lower-case words joined by "-"
 *   kind     one of KINDS
 *   target   what is reached, as a person would name it
 *   owner    whose code the target is (below)
 *   file     where the module's side lives, with its reasons; several files
 *            that reach the same target are listed with ", "
 *   symbol   the function of each file that makes the reach, one per file of
 *            `file` and in its order (E52 C2: the notice names file:symbol)
 *   why      the one-line reason
 *   when     "always", or the condition under which it is installed
 *   probe    () => { present, ours, note? } - `present` says the target
 *            exists at all (null where a probe cannot tell); `ours` says the
 *            function sitting there is the module's, and is null when the
 *            wrapper leaves no mark to read, or the row is not an override
 *   fallback what the table gets when the target is not there: the code's own
 *            answer today, read in its file
 *
 * And two the contract reads where it has them (E52 C2):
 *   inUse    () => boolean - false where the reach is not made on this world
 *            (its package off, its switch off): the row is ok, not in use
 *   marked   false on an override whose wrapper leaves no mark by design (it
 *            is installed only for a moment, or per window): present is ok
 * A probe may answer its own `state` ("ok", "failed", "unknown") where its
 * file keeps one (the relay guard, the roll draw, the Levels call).
 */
/*
 * `owner` is whose code the target is: "foundry", the system's id, or a module's id
 * (E01, 24.09.2026; the review of E01). The newer-Daggerheart warning lists only the
 * rows whose owner is the system: it used to list every row that answered
 * `present: false`, which put Isometric Perspective's override - absent whenever that
 * module is off - under the heading "places the module changes in Daggerheart" on
 * every world without it. (It was only recommended then; since E13 C10 this module
 * does not start without it.)
 */
/* The countdown tray's class, as projects-ui.mjs `wrapCountdownMenu` finds it. */
const trayClass = () => {
    const Tray = game.system?.api?.applications?.ui?.DhCountdowns ?? CONFIG.ui?.countdowns ?? null;
    return typeof Tray === "function" ? Tray : null;
};
/* A hook's row: present when the package or the class that fires it is here (null: cannot tell), never "ours". */
const hookProbe = present => ({ present, ours: null, note: "whether it fires is not read here" });
/* Whether a character sheet class named CharacterSheet is registered (its render and close hooks carry the name);
   null while no character sheet class is registered at all. */
const characterSheetNamed = () => {
    const classes = Object.values(CONFIG.Actor?.sheetClasses?.character ?? {});
    return classes.length ? classes.some(entry => entry?.cls?.name === "CharacterSheet") : null;
};
const moduleActive = id => game.modules?.get?.(id)?.active === true;

export const PATCHES = [
    {
        id: "critical-rule",
        kind: "override",
        target: "DualityRoll.addDualityResourceUpdates",
        owner: "daggerheart",
        file: "critical.mjs",
        symbol: "registerCriticalRule",
        why: "The module's own numbers on a critical - see CRITICAL in config.mjs.",
        when: "always",
        fallback: "not installed, and the console says so: a critical keeps Daggerheart's own numbers",
        probe: () => {
            const fn = game.system?.api?.dice?.DualityRoll?.addDualityResourceUpdates;
            return {
                present: typeof fn === "function",
                ours: Boolean(fn?.[Symbol.for("drpgCriticalRule")])
            };
        }
    },
    {
        id: "roll-dialog-context",
        kind: "override",
        target: "D20RollDialog.prototype._prepareContext",
        owner: "daggerheart",
        file: "roll-dialog.mjs",
        symbol: "wrapPrepareContext",
        why: "What a Call forces on a roll window (an experience's cost out, the reaction, the advantage, the bonus, one experience) is written before the window works out its Roll button and formula (E16 C1, audit S02-04).",
        when: "always, from setup; on a method of another shape, never, and the console says so once",
        fallback: "not wrapped, said once per class in the console: what a Call forces is written by the render hook after the window is drawn, as before",
        probe: () => {
            const fn = rollDialogClass()?.prototype?._prepareContext;
            return {
                present: typeof fn === "function",
                ours: Boolean(fn?.[Symbol.for("drpgRollContext")])
            };
        }
    },
    {
        id: "roll-draw",
        kind: "override",
        target: "DualityRoll.build",
        owner: "daggerheart",
        file: "roll-draw.mjs",
        symbol: "registerRollDraw",
        why: "A player's action roll is configured in their browser and drawn by the primary GM (E08+E28 C12a), who throws it from its own list of what may add to it (E29 C10); its Reroll is thrown from the same (E29 C11).",
        when: "always, unless the build is not the one the draw was written for (then never, and the GMs are told once per version)",
        fallback: "left alone, the GMs told once per version: rolls are thrown in the player's browser as in 1.2.66 (D1)",
        probe: () => rollDrawRow()
    },
    {
        id: "dice-random-uniform",
        kind: "override",
        target: "CONFIG.Dice.randomUniform",
        owner: "foundry",
        file: "forced-roll.mjs, roll-draw.mjs",
        symbol: "loadDie, rollerCopyOf",
        why: "One die of the next duality roll lands on its highest face (Free Critical).",
        when: "only while a Free Critical's own roll evaluates, or a roll the GM drew is played back with its faces (roll-draw.mjs); lifted in a finally (A4)",
        fallback: "none: nothing in the module stands in for Foundry's randomiser",
        marked: false,
        probe: () => ({
            present: typeof CONFIG.Dice?.randomUniform === "function",
            ours: null
        })
    },
    {
        id: "no-scrolling-text",
        kind: "override",
        target: "InterfaceCanvasGroup.prototype.createScrollingText",
        owner: "foundry",
        file: "no-scrolling-text.mjs",
        symbol: "registerNoScrollingText",
        why: "No floating captions over tokens at all.",
        when: "always",
        fallback: "not installed, and the console says so: captions float over tokens as Foundry draws them",
        probe: () => {
            const group = foundry.canvas?.groups?.InterfaceCanvasGroup
                ?? globalThis.InterfaceCanvasGroup;
            const fn = group?.prototype?.createScrollingText;
            return {
                present: typeof fn === "function",
                ours: Boolean(fn?.[Symbol.for("drpgNoScrollingText")])
            };
        }
    },
    {
        id: "window-close",
        kind: "override",
        target: "ApplicationV2.prototype.close",
        owner: "foundry",
        file: "motion.mjs",
        symbol: "markClosingWindows",
        why: "Marks a module window as closing so its exit plays, and plays the close sound.",
        when: "always",
        fallback: "not installed, and the console says so: windows close without the module's exit or its sound",
        probe: () => {
            const fn = foundry.applications?.api?.ApplicationV2?.prototype?.close;
            return { present: typeof fn === "function", ours: fn?.name === "drpgClose" };
        }
    },
    {
        id: "window-await-transition",
        kind: "override",
        target: "ApplicationV2.prototype._awaitTransition",
        owner: "foundry",
        file: "motion.mjs",
        symbol: "waitOnlyForRealTransitions",
        why: "Returns at once when the window has no transition running, instead of waiting out Foundry's one-second fallback.",
        when: "always",
        fallback: "not installed, and the console says so: a window without a running transition waits out Foundry's fallback",
        probe: () => {
            const fn = foundry.applications?.api?.ApplicationV2?.prototype?._awaitTransition;
            return { present: typeof fn === "function", ours: fn?.name === "drpgAwaitTransition" };
        }
    },
    {
        id: "livekit-toasts",
        kind: "override",
        target: "ui.notifications.info and .warn",
        owner: "foundry",
        file: "voice.mjs",
        symbol: "suppressBreakoutToasts",
        why: "Silences avclient-livekit's own toasts, which the module reports in its own words.",
        when: `only while ${AV_MODULE} is active`,
        fallback: "none: avclient-livekit's own notices show beside the module's",
        inUse: () => moduleActive(AV_MODULE),
        probe: () => {
            const levels = ["info", "warn"].map(level => ui.notifications?.[level]);
            return {
                present: levels.every(fn => typeof fn === "function"),
                ours: levels.every(fn => Boolean(fn?.__drpgVoicePatched))
            };
        }
    },
    {
        id: "iso-refresh-state",
        kind: "override",
        target: "Token _refreshState (Isometric Perspective's own override)",
        owner: "isometric-perspective",
        file: "iso-shield.mjs",
        symbol: "parkRefreshStateOverride",
        why: "Keeps the isometric module's override out of the way while a token is edited.",
        when: "only while Isometric Perspective is active and the shield is on",
        fallback: "nothing parked: Isometric Perspective's override runs while a token is edited",
        // Parked only while a token is edited, so `ours` is false between edits: the override's presence is the contract.
        inUse: () => moduleActive("isometric-perspective"),
        marked: false,
        probe: () => {
            // Present if any prototype between the token class and core's
            // Token still owns the override this shield parks.
            let proto = CONFIG.Token?.objectClass?.prototype;
            const floor = foundry.canvas?.placeables?.Token?.prototype ?? null;
            // E52 C2: with no Foundry Token class under the token class there is no chain to read (the harness
            // models no placeable Token: its objectClass is Object, measured 30.10), so the probe cannot tell.
            if (!floor || !proto || !(proto === floor || Object.prototype.isPrototypeOf.call(floor, proto))) {
                return { present: null, ours: null, note: "the token class here is not Foundry's Token" };
            }
            let present = false;
            while (proto && proto !== Object.prototype && proto !== floor) {
                if (Object.prototype.hasOwnProperty.call(proto, "_refreshState")) {
                    present = true;
                    break;
                }
                proto = Object.getPrototypeOf(proto);
            }
            return { present, ours: refreshStateParked() };
        }
    },
    {
        id: "chat-notify",
        kind: "override",
        target: "the chat log's notify",
        owner: "foundry",
        file: "secret.mjs",
        symbol: "quietVeiledPip",
        why: "A veiled card this client holds no words for does not light the Chat tab (E06 C6).",
        when: "always, when the chat log's class has the method (LIVE-E06-04)",
        fallback: "not installed, and the console says so: a veiled card may light the Chat tab on every screen",
        probe: () => {
            const fn = chatLogClass()?.prototype?.notify;
            return { present: typeof fn === "function", ours: Boolean(fn?.[Symbol.for("drpgVeiledNotify")]) };
        }
    },
    {
        id: "chat-content-visible",
        kind: "override",
        target: "ChatMessage.prototype.isContentVisible",
        owner: "foundry",
        file: "private-rolls.mjs",
        symbol: "readableRule",
        why: "A roll the GM drew is read on its roller's browser, and where a GM sent its dice, without a whisper naming them (E08+E28 C13).",
        when: "always",
        fallback: "not installed, and the console says so: a roll the GM drew is not readable on its roller's browser",
        probe: () => {
            let proto = (CONFIG.ChatMessage?.documentClass ?? foundry.documents?.ChatMessage)?.prototype ?? null;
            while (proto && !Object.hasOwn(proto, "isContentVisible")) proto = Object.getPrototypeOf(proto);
            const get = proto ? Object.getOwnPropertyDescriptor(proto, "isContentVisible")?.get : null;
            return { present: typeof get === "function", ours: Boolean(get?.[Symbol.for("drpgReadableHere")]) };
        }
    },
    {
        id: "sheet-render-guard",
        kind: "override",
        target: "render, as an own property on each open character sheet",
        owner: "foundry",
        file: "sheet.mjs",
        symbol: "armRenderGuard",
        why: "A resource-only update skips one redraw, so the sheet does not flicker on every Hope or Health change.",
        when: "per sheet, armed by the first resource-only update it sees",
        fallback: "not armed: a character sheet redraws on every resource change, as Foundry draws it",
        // Armed per sheet by its first resource-only update, so an open sheet not yet updated carries none.
        marked: false,
        probe: () => {
            const sheets = [...(foundry.applications?.instances?.values?.() ?? [])]
                .filter(app => app?.document?.type === "character");
            const armed = sheets.filter(app => Object.hasOwn(app, "render")).length;
            return {
                present: typeof foundry.applications?.api?.ApplicationV2?.prototype?.render === "function",
                ours: sheets.length ? armed === sheets.length : null,
                note: `${armed} of ${sheets.length} open character sheets carry it`
            };
        }
    },
    {
        id: "passages-move",
        kind: "override",
        target: "CONFIG.Canvas.polygonBackends.move._identifyEdges",
        owner: "foundry",
        file: "passages.mjs",
        symbol: "registerPassageMovement",
        why: "A token's move passes a secret passage its character knows: the wall's edge is cut there, for a move and nothing else (E79 C2).",
        when: "always, from setup; when the class cannot be extended, never, and a GM is told at every load",
        fallback: "never installed, a GM told at every load: no token passes a secret passage on this browser",
        probe: () => {
            const Move = CONFIG.Canvas?.polygonBackends?.move;
            let proto = Move?.prototype ?? null, ours = false;
            for (; proto && proto !== Object.prototype && !ours; proto = Object.getPrototypeOf(proto)) {
                ours = Object.hasOwn(proto, "_identifyEdges") && Boolean(proto._identifyEdges?.[Symbol.for("drpgPassages")]);
            }
            return { present: typeof Move?.prototype?._identifyEdges === "function", ours };
        }
    },
    {
        id: "selection-drag-rectangle",
        kind: "override",
        target: "ControlsLayer.prototype.drawSelect",
        owner: "foundry",
        file: "selection.mjs",
        symbol: "patchDragRectangle",
        why: "The rectangle a drag draws takes the interface colour, read from the controlled border's config instead of Foundry's orange written into the method.",
        when: "always, from init, when the method is there",
        fallback: "not installed: the drag rectangle stays Foundry's orange",
        probe: () => {
            const fn = foundry.canvas?.layers?.ControlsLayer?.prototype?.drawSelect;
            return { present: typeof fn === "function", ours: fn?.drpgPatched === true };
        }
    },
    {
        id: "selection-controlled-colour",
        kind: "override",
        target: "CONFIG.Canvas.dispositionColors.CONTROLLED",
        owner: "foundry",
        file: "selection.mjs",
        symbol: "applySelectionColour",
        why: "A controlled token's, tile's, drawing's, note's, region's or template's border takes the interface colour, and follows the hour and the phase.",
        when: "at ready, on every canvas and whenever the body's hour, phase or theme changes",
        fallback: "no dispositionColors: nothing is written, and the borders stay Foundry's orange",
        probe: () => {
            const colours = CONFIG.Canvas?.dispositionColors;
            return { present: typeof colours?.CONTROLLED === "number", ours: colours?.CONTROLLED === hourColour() };
        }
    },
    {
        id: "countdown-row-menu",
        kind: "override",
        target: "DhCountdowns.prototype._getCountdownContextOptions",
        owner: "daggerheart",
        file: "projects-ui.mjs",
        symbol: "wrapCountdownMenu",
        why: "A project's row in the countdown tray offers no Reveal or Hide, and its Delete deletes the project (E36).",
        when: "at init when the system has set its class, else at ready",
        fallback: "not wrapped: a project row's menu is Daggerheart's, its Reveal and Hide shown and its Delete removing only the countdown",
        probe: () => {
            const fn = trayClass()?.prototype?._getCountdownContextOptions;
            return { present: typeof fn === "function", ours: Boolean(fn?.[Symbol.for("drpgProjectRowMenu")]) };
        }
    },
    {
        id: "door-controls",
        kind: "override",
        target: "CONFIG.Canvas.doorControlClass",
        owner: "foundry",
        file: "fog.mjs",
        symbol: "registerDoorControls",
        why: "A player is shown only the door controls of rooms the fog leaves them, never a secret door's (E12 C13).",
        when: "always, from setup",
        fallback: "no class there, or one without isVisible: left as Foundry's, every door control shown as Foundry shows it, and the console says so",
        probe: () => {
            const Door = CONFIG.Canvas?.doorControlClass;
            if (typeof Door !== "function") return { present: false, ours: null, note: "no door control class" };
            // E52-07: a class without the getter is left as Foundry's (fog.mjs `doorControlFor`), so the row fails on it.
            if (!visibleGetterOf(Door)) return { present: false, ours: false, note: "Foundry's door control class has no isVisible to ask" };
            return { present: true, ours: Door.name === "RoomDoorControl" };
        }
    },
    {
        id: "actions-resource",
        kind: "override",
        target: "CONFIG.DH.RESOURCE.character: custom and all (the Actions resource)",
        owner: "daggerheart",
        file: "resources.mjs",
        symbol: "registerActionResource",
        why: "The Actions resource is one of Daggerheart's own resources on a character.",
        when: "at init and setup, when the system has built both tables",
        fallback: "not registered, and the console says so: a character has no Actions resource",
        probe: () => {
            const config = CONFIG.DH?.RESOURCE?.character;
            return {
                present: Boolean(config?.custom && config?.all),
                ours: config?.custom?.[ACTIONS_RESOURCE] === ACTIONS_DEFINITION && config?.all?.[ACTIONS_RESOURCE] === ACTIONS_DEFINITION
            };
        }
    },
    {
        id: "sidebar-calls",
        kind: "override",
        target: "ui.sidebar.toggleExpanded and .changeTab (the instance marked drpgWindowed)",
        owner: "foundry",
        file: "foundry-windows.mjs",
        symbol: "wrapSidebar",
        why: "Opening the sidebar or changing its tab shows and places the Foundry tools window that holds it (E77 C5).",
        when: "only while Foundry's rails are in the module's windows",
        fallback: "no ui.sidebar, or no such method: not wrapped, and Foundry's own calls neither show nor place the Foundry tools window",
        probe: () => {
            const bar = globalThis.ui?.sidebar;
            return {
                present: typeof bar?.toggleExpanded === "function" && typeof bar?.changeTab === "function",
                ours: bar?.drpgWindowed === true && Object.hasOwn(bar, "toggleExpanded") && Object.hasOwn(bar, "changeTab")
            };
        }
    },
    {
        id: "relay-guard",
        kind: "socket",
        target: "Daggerheart's GM relay (the system's socket channel)",
        owner: "daggerheart",
        file: "relay-guard.mjs",
        symbol: "ensureWrapped",
        why: "A player's request Daggerheart relays to the GM's client is judged there before Daggerheart's own handler writes it (E03; D2).",
        when: "always, from init, again at setup and ready",
        fallback: "unreviewed packets refused on the GM's client and the GMs told once per version; with no listener to wrap the backstop stands in; with neither the relay is not guarded, told at every load",
        probe: () => relayGuardRow()
    },
    {
        id: "region-included-in-level",
        kind: "call",
        target: "RegionDocument.prototype.includedInLevel (Levels)",
        owner: "foundry",
        file: "rooms.mjs",
        symbol: "onLevel",
        why: "Whether a room is on the floor a token stands on, or the floor on screen, is Foundry's answer (E12).",
        when: "on a scene with floors",
        fallback: "a region that cannot be asked, or whose answer throws, is on every floor, said once a load",
        probe: () => {
            const threw = levelFailure();
            if (threw) return { present: true, ours: null, state: "failed", note: threw.message };
            const Region = CONFIG.Region?.documentClass ?? foundry.documents?.RegionDocument;
            return { present: typeof Region?.prototype?.includedInLevel === "function", ours: null };
        }
    },
    {
        id: "hook-duality-configured",
        kind: "hook",
        target: "daggerheart.postDualityRollConfiguration",
        owner: "daggerheart",
        file: "forced-roll.mjs",
        symbol: "registerForcedRolls",
        why: "A Free Critical loads one die of the roll this hook hands over.",
        when: "always",
        fallback: "none: a Free Critical's die is not loaded",
        probe: () => hookProbe(typeof game.system?.api?.dice?.DualityRoll === "function")
    },
    {
        id: "hook-roll-dialog-render",
        kind: "hook",
        target: "renderD20RollDialog",
        owner: "daggerheart",
        file: "murder-rules.mjs",
        symbol: "registerMurder",
        why: "The opening's own roll window is marked as it is drawn.",
        when: "always",
        fallback: "none: the opening's roll window is not marked as the opening's",
        probe: () => hookProbe(typeof rollDialogClass() === "function")
    },
    {
        id: "hook-character-sheet-render",
        kind: "hook",
        target: "renderCharacterSheet",
        owner: "daggerheart",
        file: "sheet.mjs",
        symbol: "registerSheetTweaks",
        why: "The character sheet is dressed as a student's file at every render.",
        when: "always",
        fallback: "none: the character sheet is drawn as Daggerheart draws it",
        probe: () => hookProbe(characterSheetNamed())
    },
    {
        id: "hook-character-sheet-close",
        kind: "hook",
        target: "closeCharacterSheet",
        owner: "daggerheart",
        file: "sheet.mjs",
        symbol: "registerSheetTweaks",
        why: "A closed sheet's tile-fit observer is let go.",
        when: "always",
        fallback: "none: the observer of a closed sheet watches a detached element for the rest of the session",
        probe: () => hookProbe(characterSheetNamed())
    },
    {
        id: "hook-countdowns-render",
        kind: "hook",
        target: "renderDhCountdowns",
        owner: "daggerheart",
        file: "projects-ui.mjs, hud.mjs",
        symbol: "registerProjectsUi, registerHud",
        why: "The countdown tray shows projects as the module keeps them, and the HUD is redrawn with it.",
        when: "always",
        fallback: "none: the tray is drawn as Daggerheart draws it and the HUD is not redrawn with it",
        probe: () => hookProbe(trayClass() !== null)
    },
    {
        id: "hook-dice-so-nice-ready",
        kind: "hook",
        target: "diceSoNiceReady",
        owner: "dice-so-nice",
        file: "dice-sync.mjs",
        symbol: "registerDiceSync",
        why: "The players' dice appearances are swept once Dice So Nice is up.",
        when: "only while Dice So Nice is active, and not up yet when the module is",
        fallback: "none: the dice appearances are not swept",
        inUse: () => moduleActive("dice-so-nice"),
        probe: () => hookProbe(moduleActive("dice-so-nice"))
    },
    {
        id: "hook-dice-so-nice-message",
        kind: "hook",
        target: "diceSoNiceMessagePreProcess",
        owner: "dice-so-nice",
        file: "private-rolls.mjs",
        symbol: "registerPrivateRolls",
        why: "A roll the GM drew is thrown only on the screens that may read it, with the roller's dice.",
        when: "only while Dice So Nice is active",
        fallback: "none: Dice So Nice throws such a roll on every screen, in the GM's colours",
        inUse: () => moduleActive("dice-so-nice"),
        probe: () => hookProbe(moduleActive("dice-so-nice"))
    },
    {
        id: "hook-livekit-initialized",
        kind: "hook",
        target: "liveKitClientInitialized",
        owner: AV_MODULE,
        file: "voice-client.mjs, voice-tile.mjs, trial-speakers.mjs",
        symbol: "registerVoiceClient, registerVoiceTile, registerTrialSpeakers",
        why: "Each new LiveKit room is watched for a drop, and read for the voice tile and the trial's speakers.",
        when: `only while ${AV_MODULE} is active`,
        fallback: "none: the voice rooms, the voice tile and the trial's speakers do not follow the A/V client",
        inUse: () => moduleActive(AV_MODULE),
        probe: () => hookProbe(moduleActive(AV_MODULE))
    }
];

/* ==========================================================================
 * THE CONTRACT (E52 C2)
 * --------------------------------------------------------------------------
 * The register read as three answers a row: ok, failed or unknown (E52-04).
 * Failed: the target is not there, a probe threw, another function stands
 * where the module's was, or the row's own file says so. Unknown: nothing
 * could be read - "cannot tell" is a warning, never a pass (the plan's risk).
 * A probe is read-only and runs at ready and when asked, never per frame.
 * ========================================================================== */

/** The three answers a row of the contract may give. */
export const CONTRACT_STATES = Object.freeze(["ok", "failed", "unknown"]);

/* The own property relay-guard.mjs's wrapper carries (`ensureWrapped`). */
const GUARD_MARK = "__drpgRelayGuard";

/* The listeners on Daggerheart's channel, in the order the socket calls them. */
function relayListeners() {
    const channel = game.system?.id ? `system.${game.system.id}` : null;
    const sock = game.socket;
    return channel && typeof sock?.listeners === "function" ? [...sock.listeners(channel)] : [];
}

/* What each of the guard's states other than "ok" and "idle" means for the row (relay-guard.mjs `ensureWrapped`). */
const RELAY_FAILED = {
    changed: "Daggerheart's relay has cases the guard has not reviewed",
    unnamed: "Daggerheart's relay listener is not the one the guard knows by name",
    backstop: "no listener could be wrapped, so only the backstop stands in front of the relay",
    notFound: "no listener on the channel to stand in front of: the relay is not guarded",
    noApi: "the socket offers no way to wrap the listener: the relay is not guarded"
};

/**
 * The relay guard's row, read from its own state (E52-06): ok only while the guard wrapped a reviewed
 * listener AND is the first listener on the channel - one before it would act on a packet before the guard
 * judged it. Every other state of the guard is failed, its fallback the guard's own; "idle" (not looked at
 * yet) is unknown. Both inputs can be handed in (R1542).
 */
export function relayGuardRow(status = relayGuardStatus(), listeners = relayListeners()) {
    const state = status?.state;
    const at = listeners.findIndex(fn => fn?.[GUARD_MARK] === true);
    const present = state !== "notFound" && state !== "noApi";
    if (state === "ok") {
        if (at === 0) return { present, ours: true, state: "ok" };
        return { present, ours: false, state: "failed",
            note: at < 0 ? "the guard is not on Daggerheart's channel" : `${at} other listener(s) on Daggerheart's channel run before the guard` };
    }
    if (Object.hasOwn(RELAY_FAILED, state)) {
        const cases = Array.isArray(status?.unreviewed) && status.unreviewed.length ? ` (${status.unreviewed.join(", ")})` : "";
        return { present, ours: at === 0 ? true : null, state: "failed", note: RELAY_FAILED[state] + cases };
    }
    return { present: null, ours: null, state: "unknown", note: "the guard has not looked at Daggerheart's channel yet" };
}

/**
 * The roll draw's row, read from roll-draw.mjs's seam (E52-06): "changed" is D1's fallback - rolls thrown
 * in the player's browser - and so failed, never ok; "ok" holds only while the draw's wrapper still stands
 * on the build; "none" (not decided yet) is unknown. Both inputs can be handed in (R1542).
 */
export function rollDrawRow(seam = rollDrawState(), build = game.system?.api?.dice?.DualityRoll?.build) {
    const present = typeof build === "function";
    const ours = Boolean(build?.[Symbol.for("drpgRollDraw")]);
    if (seam?.state === "changed") return { present, ours, state: "failed", note: `rolls are not drawn by the GM: ${seam.why || "the build changed"}` };
    if (seam?.state === "ok") {
        return ours ? { present, ours, state: "ok" } : { present, ours, state: "failed", note: "another function stands where the draw's wrapper was" };
    }
    return { present, ours, state: "unknown", note: "the build has not been looked at yet" };
}

/* "file:symbol" for each file of a row, as the notice and Pre-season name it. */
function whereOf(entry) {
    const list = value => String(value ?? "").split(/\s*,\s*/).filter(Boolean);
    const symbols = list(entry.symbol);
    return list(entry.file).map((file, i) => (symbols[i] ? `${file}:${symbols[i]}` : file)).join(", ");
}

/* One row's answer: `{ state, present, ours, note }`. A probe, or an `inUse`, that throws is failed with its message. */
function judged(entry) {
    let result;
    try {
        if (typeof entry.inUse === "function" && entry.inUse() === false) {
            return { state: "ok", present: null, ours: null, note: `not in use on this world (${entry.when})` };
        }
        result = entry.probe() ?? {};
    } catch (err) {
        return { state: "failed", present: false, ours: null, note: String(err?.message ?? err) };
    }
    const present = result.present ?? null, ours = result.ours ?? null, note = result.note ?? "";
    const answer = (state, why = "") => ({ state, present, ours, note: note || why });
    if (CONTRACT_STATES.includes(result.state)) return answer(result.state);
    if (present === false) return answer("failed", "not found where the module expects it");
    if (present !== true) return answer("unknown", "the probe cannot tell");
    if (entry.kind === "hook") return answer("unknown", "whether it fires is not read here");
    if (entry.kind !== "override" || entry.marked === false) return answer("ok");
    if (ours === true) return answer("ok");
    if (ours === false) return answer("failed", "another function stands where the module's was");
    return answer("unknown", "the module's wrapper leaves no mark to read");
}

/* This load's run over the whole register, for `contractState`. */
let lastContract = null;

/**
 * Run the contract: every row of `rows` (the register unless handed in) judged as ok, failed or unknown.
 * Read-only: it writes nothing to the world and changes no fallback - each failed row's fallback is the one
 * its file already has. A run over the register is kept as this load's (`contractState`); a run over rows
 * handed in (the suite's stand-ins) is not.
 *
 * @returns {{at: number, rows: object[], ok: object[], failed: object[], unknown: object[]}}
 */
export function runContract({ rows = PATCHES } = {}) {
    const out = rows.map(entry => ({
        id: entry.id, kind: entry.kind, target: entry.target, owner: entry.owner, file: entry.file, symbol: entry.symbol ?? "",
        where: whereOf(entry), when: entry.when, fallback: entry.fallback, ...judged(entry)
    }));
    const contract = {
        at: Date.now(), rows: out,
        ok: out.filter(r => r.state === "ok"), failed: out.filter(r => r.state === "failed"), unknown: out.filter(r => r.state === "unknown")
    };
    if (rows === PATCHES) lastContract = contract;
    return contract;
}

/** This load's contract over the register (the last `runContract()`), or null before the first. */
export function contractState() {
    return lastContract;
}

/* Whether this load's notice of a failed row was given. */
const toldThisLoad = { done: false };

/**
 * At ready, on the primary GM (module.mjs, after `requirementsMet`): run the contract, say the unknown rows in
 * the console as a warning, and tell a GM of the failed rows in one permanent notice, once a load - each row's
 * target, file:symbol and what the table gets instead. `told` and `notify` can be handed in (R1540, R1541).
 */
export function announceContract({ rows = PATCHES, told = toldThisLoad,
    notify = (text, options) => ui.notifications?.warn(text, options) } = {}) {
    const contract = runContract({ rows });
    const line = r => `${r.target} (${r.where}): ${r.note}`;
    if (contract.unknown.length) {
        warn(`The contract: ${contract.unknown.length} row(s) could not be read here, a warning and not a pass - ${contract.unknown.map(line).join("; ")}`);
    }
    if (contract.failed.length) {
        warn(`The contract: ${contract.failed.length} row(s) failed - ${contract.failed.map(r => `${line(r)}; instead: ${r.fallback}`).join(" | ")}`);
        if (!told.done && game.user?.isGM) {
            told.done = true;
            notify(plural("DRPG.Contract.notice", { n: contract.failed.length,
                rows: contract.failed.map(r => `${r.target} (${r.where}): ${r.fallback}`).join("; ") }), { permanent: true });
        }
    }
    return contract;
}

/**
 * Read the register. Prints one row per reach and returns the rows, so a
 * macro can look at the answer as well as a person.
 *
 * `present: false` is the finding this exists for: the target the code
 * expects is not there, which means a Foundry or Daggerheart update moved it
 * and the feature has quietly stopped - the row's `fallback` says what the
 * table gets instead. `present: null` is "cannot tell", never a pass. `ours:
 * false` on an override whose `when` is "always" means something else replaced
 * our wrapper after it was installed. A probe that throws is `present: false`
 * with its message as the note. `state` is the contract's answer for the row
 * (`runContract`, E52 C2).
 */
export function diagnosePatches() {
    const rows = PATCHES.map(entry => {
        const result = judged(entry);
        return {
            id: entry.id,
            kind: entry.kind,
            target: entry.target,
            owner: entry.owner,
            file: entry.file,
            why: entry.why,
            when: entry.when,
            fallback: entry.fallback,
            state: result.state,
            present: result.present,
            ours: result.ours,
            note: result.note ?? ""
        };
    });
    console.table(rows);
    return rows;
}
