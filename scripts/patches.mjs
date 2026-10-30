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
 *
 * Since E52 C3 the register also holds what the code relies on without
 * replacing it: other packages' hooks, ok once their listener marked them
 * fired in the load (utils.mjs `markFired`); the settings and flags the module
 * writes, read from enforced.mjs's ENFORCED and FOUNDRY_WRITES; the calls and
 * constants of Foundry and avclient-livekit, unknown where only a table can
 * read them; and the DOM places the code finds by selector (SHEET_ANCHORS,
 * read on the first character sheet drawn; R1549 holds each to its file).
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
import { ENFORCED, FOUNDRY_WRITES } from "./enforced.mjs";
import { broadcastAudioKnown } from "./voice.mjs";
import { firedAt, isPrimaryGm, markFired, plural, warn } from "./utils.mjs";

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
 *            answer today, read in its file - English, for the console and the
 *            author's report; the table reads the same in its own language
 *            from lang's DRPG.Contract.instead.<id> (`insteadOf`, E52 C7)
 *
 * And these the contract reads where it has them (E52 C2, C7):
 *   inUse    () => boolean - false where the reach is not made on this world
 *            (its package off, its switch off): the row is ok, not in use
 *   insteadKey  the key of lang's sentence when it is not the id (a held row's
 *            template: held-flag, held-permissions, held-rtc, held-setting)
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
/**
 * A hook row's answer (E52 C3, E52-09): ok once its listener marked the hook fired in this load (utils.mjs
 * `markFired`), else `present` as the row reads it - the package or the class that fires it is here - with the
 * road that would fire it, which the contract reads as unknown, never ok. `fired` is handed in by R1545.
 */
export function hookState(target, present, road, fired = firedAt) {
    if (fired(target) !== null) return { present: true, ours: null, state: "ok", note: "fired in this load" };
    return { present, ours: null, note: `not seen firing in this load; it fires when ${road}` };
}
/* A hook row: its probe asks `present` and the mark. */
const hookRow = (row, present) => ({ kind: "hook", ...row, probe: () => hookState(row.target, present(), row.road) });
/* A call row no probe can read (a behaviour, not a name): unknown, naming the table check that reads it. */
const tableRow = row => ({
    kind: "call", ...row,
    probe: () => ({ present: null, ours: null, note: `a probe cannot read it: checked at a table (${row.table})` })
});
/* Whether `key` is in one of Foundry's registries (a Map), null where the registry is not there to read. */
const registryProbe = (map, key, unreadable) => (map instanceof Map
    ? { present: map.has(key), ours: null } : { present: null, ours: null, note: unreadable });
/*
 * Whether Foundry's AV defaults (`AVSettings.DEFAULT_CLIENT_SETTINGS`, `DEFAULT_USER_SETTINGS`: v13's names, read
 * from memory, not on v14 here) hold each of `keys`; null where they cannot be read (the harness has none).
 */
function avDefaultsHave(which, keys) {
    const defaults = foundry.av?.AVSettings?.[which];
    if (!defaults || typeof defaults !== "object") return null;
    return keys.every(key => Object.hasOwn(defaults, key));
}
/* The system or an active module of that id. */
const packageHere = id => game.system?.id === id || moduleActive(id);
const kebab = id => id.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);

/*
 * The setting and flag rows (E52 C3, E52-10), from enforced.mjs's two lists and no third: each ENFORCED row, and each
 * FOUNDRY_WRITES row ENFORCED does not hold that names a `reach`. A missing entry is failed, and its fallback is the
 * writer's own: enforced.mjs `entryOf` writes nothing to a setting that is not registered and says so in the console.
 * Both lists can be handed in (R1546).
 */
export function heldRows(enforced = ENFORCED, writes = FOUNDRY_WRITES) {
    const held = enforced.map(row => {
        const base = {
            id: `held-${kebab(row.id)}`, from: `ENFORCED ${row.id}`, file: "enforced.mjs",
            why: `Held for the table while its switch (${row.toggle}) is on; Give back Foundry's settings lists it.`
        };
        if (row.kind === "userFlag") {
            return { ...base, insteadKey: "held-flag", kind: "flag", target: `${row.scope}.${row.flag} on each account`, owner: row.system, symbol: "holdUserFlag",
                when: `on a world of ${row.system}, while its switch is on`,
                fallback: "not held: the system reads the account's flag as it stands",
                inUse: () => game.system?.id === row.system,
                // A flag has no entry to look up: what is read is that its system is the one here.
                probe: () => ({ present: game.system?.id === row.system, ours: null, note: "a flag: only its system is read" }) };
        }
        const full = `${row.module}.${row.key}`;
        const registered = () => Boolean(game.settings?.settings?.has?.(full));
        if (row.kind === "permissions") {
            return { ...base, insteadKey: "held-permissions", kind: "setting-entry", target: `${full}: ${row.permissions.join(", ")}`, owner: "foundry", symbol: "holdPermissions",
                when: "always, on the primary GM, while its switch is on",
                fallback: "not held: the permissions stay as the world has them",
                probe: () => {
                    const perms = globalThis.CONST?.USER_PERMISSIONS;
                    if (!registered()) return { present: false, ours: null, note: `${full} is not registered` };
                    if (!perms || typeof perms !== "object") return { present: null, ours: null, note: "Foundry's permission list is not readable here" };
                    const gone = row.permissions.filter(name => !Object.hasOwn(perms, name));
                    return { present: !gone.length, ours: null, ...(gone.length ? { note: `Foundry names no ${gone.join(", ")}` } : {}) };
                } };
        }
        if (row.kind === "rtc") {
            const fields = Object.keys(row.fields ?? {}), users = Object.keys(row.userFields ?? {});
            return { ...base, insteadKey: "held-rtc", kind: "setting-entry", target: `${full}: ${fields.join(", ")} and each user's ${users.join(", ")}`, owner: "foundry",
                symbol: "holdRtcDock", when: "while its switch is on",
                fallback: "the dock is not held: each browser keeps its own dock and popouts",
                probe: () => {
                    if (!registered()) return { present: false, ours: null, note: `${full} is not registered` };
                    const client = avDefaultsHave("DEFAULT_CLIENT_SETTINGS", fields), user = avDefaultsHave("DEFAULT_USER_SETTINGS", users);
                    if (client === false || user === false) return { present: false, ours: null, note: "a field it holds is not among Foundry's AV defaults" };
                    return { present: true, ours: null, ...(client === null || user === null ? { note: "registered; its fields are not readable here" } : {}) };
                } };
        }
        // The A/V client's own setting matters to the table only while this world's voice is on: off, nothing
        // reads whether LiveKit runs inside the Foundry window.
        const voiceOnly = row.module === AV_MODULE;
        return { ...base, insteadKey: "held-setting", kind: "setting-entry", target: full, owner: row.module, symbol: "applyEnforced",
            when: `while ${row.module} is active${voiceOnly ? ", voice is on in this world" : ""} and its switch is on`,
            fallback: "not held, and the console says so: the setting stays as each browser has it",
            inUse: () => packageHere(row.module) && (!voiceOnly || (game.webrtc?.mode ?? 0) > 0),
            probe: () => ({ present: registered(), ours: null }) };
    });
    const reached = writes.filter(write => write.reach && !enforced.some(row => row.id === write.id)).map(write => {
        const { kind, owner, key, file, symbol, fallback } = write.reach;
        const target = `${owner}.${key}`;
        return { id: `held-${kebab(write.id)}`, from: `FOUNDRY_WRITES ${write.id}`, kind, target, owner, file, symbol, fallback,
            why: "Written for the table; Give back Foundry's settings lists it.", when: `while ${owner} is here`,
            inUse: () => packageHere(owner),
            probe: kind === "flag"
                ? () => ({ present: packageHere(owner), ours: null, note: "a flag: only its package is read" })
                : () => ({ present: Boolean(game.settings?.settings?.has?.(target)), ours: null }) };
    });
    return [...held, ...reached];
}

/**
 * The character sheet's places the module fills (E52 C3, E52-12; Q-7): Daggerheart's selectors sheet.mjs looks up
 * to lay the student's file in, one per entry, each a string literal of sheet.mjs that R1549 (tier 0) holds this list
 * to. Read once a load, on the first sheet of the system's own class (`watchSheetRenders`); the places sheet.mjs only
 * takes away (the item sheet's tabs, the editor and toggle buttons) are not here, since their absence leaves nothing
 * undrawn.
 */
export const SHEET_ANCHORS = Object.freeze([
    { selector: ".window-content", what: "the window's body" },
    { selector: "nav.sheet-tabs, .sheet-tabs, nav.tabs", what: "the tab bar (the Rules tab)" },
    { selector: ".character-header-sheet .name-row", what: "the header's name row" },
    { selector: ".character-header-sheet .character-row", what: "the header's character row" },
    { selector: ".resource-section", what: "the header's resources" },
    { selector: ".character-header-sheet .character-details", what: "the header's details" },
    { selector: ".character-header-sheet .hope-section .hope-value", what: "the header's Hope" },
    { selector: ".hope-section .hope-value", what: "Hope's pips" },
    { selector: ".character-traits .trait-value, .trait .trait-value", what: "the traits' values" },
    { selector: ".character-sidebar-sheet", what: "the sidebar" },
    { selector: ".character-sidebar-sheet .resources-section .status-bar", what: "the sidebar's bars" },
    { selector: "input.bar-input", what: "a bar's input" },
    { selector: "progress.progress-bar", what: "a bar's progress" },
    { selector: ".equipment-section h3", what: "the equipment heading" },
    { selector: ".loadout-section h3", what: "the loadout heading" },
    { selector: ".character-sidebar-sheet .equipment-section .items-sidebar-list", what: "the equipped list" },
    { selector: ".character-sidebar-sheet .shortcut-items-section", what: "the sidebar's shortcuts" },
    { selector: ".experience-section", what: "the Experience" }
]);

/* The first sheet of the system's class drawn in this load: `{ at, missing, of }`, null before. */
const sheetRead = { done: null };

/** The sheet row's answer from a reading (`readSheetAnchors`): unknown before one, failed naming each missing place. */
export function sheetAnchorsAnswer(read) {
    if (!read) return { present: null, ours: null, note: "no character sheet drawn on this browser yet in this load" };
    if (read.missing.length) return { present: false, ours: null, note: `not on the sheet: ${read.missing.join(" | ")}` };
    return { present: true, ours: null, note: `all ${read.of} places found on the first sheet` };
}
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
    hookRow({
        id: "hook-duality-configured",
        target: "daggerheart.postDualityRollConfiguration",
        owner: "daggerheart",
        file: "forced-roll.mjs",
        symbol: "registerForcedRolls",
        why: "A Free Critical loads one die of the roll this hook hands over.",
        when: "always",
        road: "a duality roll is configured (any action roll)",
        fallback: "none: a Free Critical's die is not loaded"
    }, () => typeof game.system?.api?.dice?.DualityRoll === "function"),
    hookRow({
        id: "hook-roll-dialog-render",
        target: "renderD20RollDialog",
        owner: "daggerheart",
        file: "murder-rules.mjs",
        symbol: "registerMurder",
        why: "The opening's own roll window is marked as it is drawn.",
        when: "always",
        road: "a roll window opens on this browser",
        fallback: "none: the opening's roll window is not marked as the opening's"
    }, () => typeof rollDialogClass() === "function"),
    hookRow({
        id: "hook-character-sheet-render",
        target: "renderCharacterSheet",
        owner: "daggerheart",
        file: "sheet.mjs",
        symbol: "registerSheetTweaks",
        why: "The character sheet is dressed as a student's file at every render.",
        when: "always",
        // Marked by this file's own listener (`watchSheetRenders`): sheet.mjs is left as it is (E52 Q-7).
        road: "a character sheet is drawn on this browser",
        fallback: "none: the character sheet is drawn as Daggerheart draws it"
    }, () => characterSheetNamed()),
    hookRow({
        id: "hook-character-sheet-close",
        target: "closeCharacterSheet",
        owner: "daggerheart",
        file: "sheet.mjs",
        symbol: "registerSheetTweaks",
        why: "A closed sheet's tile-fit observer is let go.",
        when: "always",
        road: "a character sheet is closed on this browser",
        fallback: "none: the observer of a closed sheet watches a detached element for the rest of the session"
    }, () => characterSheetNamed()),
    hookRow({
        id: "hook-countdowns-render",
        target: "renderDhCountdowns",
        owner: "daggerheart",
        file: "projects-ui.mjs, hud.mjs",
        symbol: "registerProjectsUi, registerHud",
        why: "The countdown tray shows projects as the module keeps them, and the HUD is redrawn with it.",
        when: "always",
        road: "the countdown tray is drawn",
        fallback: "none: the tray is drawn as Daggerheart draws it and the HUD is not redrawn with it"
    }, () => trayClass() !== null),
    hookRow({
        id: "hook-dice-so-nice-ready",
        target: "diceSoNiceReady",
        owner: "dice-so-nice",
        file: "dice-sync.mjs",
        symbol: "registerDiceSync",
        why: "The players' dice appearances are swept once Dice So Nice is up.",
        when: "only while Dice So Nice is active, and not up yet when the module is",
        road: "Dice So Nice finishes starting (marked at once when it was up first)",
        fallback: "none: the dice appearances are not swept",
        inUse: () => moduleActive("dice-so-nice")
    }, () => moduleActive("dice-so-nice")),
    hookRow({
        id: "hook-dice-so-nice-message",
        target: "diceSoNiceMessagePreProcess",
        owner: "dice-so-nice",
        file: "private-rolls.mjs",
        symbol: "registerPrivateRolls",
        why: "A roll the GM drew is thrown only on the screens that may read it, with the roller's dice.",
        when: "only while Dice So Nice is active",
        road: "a chat message with dice arrives while Dice So Nice is on",
        fallback: "none: Dice So Nice throws such a roll on every screen, in the GM's colours",
        inUse: () => moduleActive("dice-so-nice")
    }, () => moduleActive("dice-so-nice")),
    hookRow({
        id: "hook-livekit-initialized",
        target: "liveKitClientInitialized",
        owner: AV_MODULE,
        file: "voice-client.mjs, voice-tile.mjs, trial-speakers.mjs",
        symbol: "registerVoiceClient, registerVoiceTile, registerTrialSpeakers",
        why: "Each new LiveKit room is watched for a drop, and read for the voice tile and the trial's speakers.",
        when: `only while ${AV_MODULE} is active`,
        road: "the A/V client starts a room (voice on in this world)",
        fallback: "none: the voice rooms, the voice tile and the trial's speakers do not follow the A/V client",
        inUse: () => moduleActive(AV_MODULE)
    }, () => moduleActive(AV_MODULE)),
    hookRow({
        id: "hook-image-popout-header",
        target: "getHeaderControlsImagePopout",
        owner: "foundry",
        file: "room-tile.mjs",
        symbol: "registerRoomTile",
        why: "The room tile's picture window keeps no header control, not Foundry's share, not one a module adds (amend 11.10 A9).",
        when: "always",
        road: "a picture window (ImagePopout) opens on this browser",
        fallback: "none: the room picture's window shows Foundry's share control and any a module adds"
    }, () => (typeof foundry.applications?.apps?.ImagePopout === "function" ? true : null)),

    /* ---- Setting entries and flags (E52 C3, E52-10): read from enforced.mjs's ENFORCED and FOUNDRY_WRITES ---- */
    ...heldRows(),
    {
        id: "user-permission-broadcast-audio",
        kind: "setting-entry",
        target: "the user permission BROADCAST_AUDIO (a user's permissions.BROADCAST_AUDIO)",
        owner: "foundry",
        file: "voice-tile.mjs, voice.mjs",
        symbol: "toggleBlock, blockForTrial",
        why: "The GM's block in the voice list and the trial's block of a dead student's microphone are Foundry's own permission, written on the user (amend 05.10 C).",
        when: "whenever a GM blocks a microphone, or a trial blocks the dead's",
        fallback: "nobody's microphone is blocked: neither block writes, the GM's button says why and the console says it for the trial",
        probe: () => {
            const perms = globalThis.CONST?.USER_PERMISSIONS;
            return { present: perms && typeof perms === "object" ? broadcastAudioKnown(perms) : null, ours: null };
        }
    },
    {
        id: "rtc-client-keys",
        kind: "setting-entry",
        target: "core.rtcClientSettings: muteAll and each user's muted, volume and blocked",
        owner: "foundry",
        file: "voice-tile.mjs",
        symbol: "audible",
        why: "The voice tile reads Foundry's mute-all and each speaker's mute, volume and hide on this browser, and writes them as the dock does (amend 11.10 A9).",
        when: "while voice is on in this world",
        fallback: "a key Foundry no longer keeps reads as its default (not muted, full volume, shown), and a write to it changes nothing",
        probe: () => {
            const client = avDefaultsHave("DEFAULT_CLIENT_SETTINGS", ["muteAll"]), user = avDefaultsHave("DEFAULT_USER_SETTINGS", ["muted", "volume", "blocked"]);
            if (client === null || user === null) return { present: null, ours: null, note: "Foundry's AV defaults are not readable here" };
            return { present: client && user, ours: null };
        }
    },
    {
        id: "push-to-talk-key",
        kind: "setting-entry",
        target: "the keybinding core.pushToTalk",
        owner: "foundry",
        file: "voice-tile.mjs",
        symbol: "pushToTalkKey",
        why: "The microphone's push-to-talk line names the key Foundry's controls bind (amend 11.10 A9).",
        when: "while Foundry's voice mode is push-to-talk",
        fallback: "the push-to-talk line names no key",
        probe: () => registryProbe(game.keybindings?.actions, "core.pushToTalk", "Foundry's keybinding list is not readable here")
    },
    {
        id: "av-config-menu",
        kind: "setting-entry",
        target: "the settings menu core.webrtc (Audio/Video Configuration, avclient-livekit's class over it)",
        owner: "foundry",
        file: "enforced.mjs",
        symbol: "registerEnforced",
        why: "The fields the table holds (the dock folded, no camera popped out) are greyed in that window when it draws (amend 11.10 A9).",
        when: "while the camera dock is held",
        fallback: "the held fields are not greyed in the window; their values are held all the same",
        probe: () => registryProbe(game.settings?.menus, "core.webrtc", "Foundry's settings menus are not readable here")
    },

    /* ---- Calls (E52 C3, E52-11): a presence probe where Foundry or a module exposes the name; a behaviour no
       probe can read is unknown and names the table check that reads it (`table`, the stage's B-E52 rows) ---- */
    tableRow({
        id: "chat-delete-options",
        target: "the deleteChatMessage hook's options: deleteAll taken out before it runs, the module's own options reaching other browsers",
        owner: "foundry",
        file: "notice-history.mjs",
        symbol: "noticeCardDeleted",
        why: "A notice's card deleted keeps or drops its history entry by those options: kept on Clear chat, withdrawn on the module's own delete (amend 11.10 A7).",
        when: "always",
        fallback: "a history entry may stay after its card is withdrawn, or go on Clear chat",
        table: "B-E52-2"
    }),
    tableRow({
        id: "notifications-lifetime",
        target: "Notifications.LIFETIME_MS (how long a toast stays)",
        owner: "foundry",
        file: "notice-history.mjs",
        symbol: "registerNoticeHistory",
        why: "The notice history's timing follows how long Foundry keeps a toast up (amend 11.10 A7).",
        when: "always",
        fallback: "the history keeps its own timing, whatever Foundry's toasts do",
        table: "B-E52-2"
    }),
    tableRow({
        id: "tooltip-clean-html",
        target: "TooltipManager: data-tooltip-html and aria-label passed through cleanHTML",
        owner: "foundry",
        file: "notice-history.mjs",
        symbol: "tooltipWords",
        why: "A notice's tooltip words are read as Foundry's tooltip shows them, cleaned (amend 11.10 A7).",
        when: "always",
        fallback: "a tooltip's words in the history may differ from what Foundry's tooltip showed",
        table: "B-E52-2"
    }),
    tableRow({
        id: "client-setting-sync-write",
        target: "a client setting's write stored at once, before the page can unload",
        owner: "foundry",
        file: "notice-history.mjs",
        symbol: "registerNoticeHistory",
        why: "The notice history is kept on this browser as the page closes (amend 11.10 A7).",
        when: "always",
        fallback: "the last notices before a reload may be missing from the history",
        table: "B-E52-2"
    }),
    {
        id: "livekit-room-events",
        kind: "call",
        // The events are LiveKit's speaker and participant events; their names stay in the two files that listen (R591).
        target: "the LiveKit Room's events (who speaks, who joins and leaves)",
        owner: AV_MODULE,
        file: "voice-tile.mjs, trial-speakers.mjs",
        symbol: "attachRoom, attachSpeakers",
        why: "Who speaks and who is in the room come from avclient-livekit's Room (amend 11.10 A9).",
        when: `only while ${AV_MODULE} is active`,
        fallback: "the voice tile and the trial's speakers show nobody speaking and follow no one joining or leaving",
        inUse: () => moduleActive(AV_MODULE),
        probe: () => {
            const room = game.webrtc?.client?._liveKitClient?.liveKitRoom;
            if (!room) return { present: null, ours: null, note: "no LiveKit Room on this browser now" };
            return { present: typeof room.on === "function", ours: null };
        }
    },
    {
        id: "livekit-participant-user",
        kind: "call",
        // avclient-livekit's getParticipantFVTTUser: named here as a property only, since no string of the module may
        // carry the letters of Foundry's logo file (R509).
        target: "avclient-livekit's call that names a participant's user",
        owner: AV_MODULE,
        file: "voice-tile.mjs",
        symbol: "participantUser",
        why: "A LiveKit participant is named as this world's user (amend 11.10 A9).",
        when: `only while ${AV_MODULE} is active`,
        fallback: "a participant the call cannot name is left out of the voice tile and the trial's speakers",
        inUse: () => moduleActive(AV_MODULE),
        probe: () => {
            const client = game.webrtc?.client?._liveKitClient;
            if (!client) return { present: null, ours: null, note: "no LiveKit client on this browser now" };
            return { present: typeof client.getParticipantFVTTUser === "function", ours: null };
        }
    },
    tableRow({
        id: "livekit-attach-audio",
        target: "avclient-livekit's attachAudioTrack setting volume and muted at every attach",
        owner: AV_MODULE,
        file: "voice-tile.mjs",
        symbol: "audible",
        why: "A speaker muted on this browser stays muted because every attach writes the element's volume and muted from the settings (amend 11.10 A9).",
        when: `only while ${AV_MODULE} is active`,
        fallback: "a speaker muted here may be heard again after LiveKit attaches their audio anew",
        inUse: () => moduleActive(AV_MODULE),
        table: "B-E52-3"
    }),
    tableRow({
        id: "voice-modes",
        target: "the voice modes (always and push-to-talk, no activity mode)",
        owner: AV_MODULE,
        file: "voice-tile.mjs",
        symbol: "micState",
        why: "The microphone's states are read from the voice mode, and no voice-activity mode is offered (amend 11.10 A9).",
        when: `only while ${AV_MODULE} is active`,
        fallback: "a mode the tile does not know is shown as an open microphone",
        inUse: () => moduleActive(AV_MODULE),
        table: "B-E52-3"
    }),
    tableRow({
        id: "livekit-connected-users",
        target: "avclient-livekit's getConnectedUsers (who is in voice)",
        owner: AV_MODULE,
        file: "voice-client.mjs",
        symbol: "roomState",
        why: "Whether this browser's room holds anybody is read from avclient-livekit (amend 11.10 A9).",
        when: `only while ${AV_MODULE} is active`,
        fallback: "the room's state is read from the Room alone",
        inUse: () => moduleActive(AV_MODULE),
        table: "B-E52-3"
    }),
    {
        id: "scene-controls-activate",
        kind: "call",
        target: "ui.controls.activate({ control, tool })",
        owner: "foundry",
        file: "foundry-windows.mjs",
        symbol: "askTokensLayer",
        why: "A player's layer is asked back to Tokens after the map tools window closes (amend 11.10 A8).",
        when: "on a player's browser, while Foundry's rails are in the module's windows",
        fallback: "the layer stays as it was",
        probe: () => ({ present: typeof globalThis.ui?.controls?.activate === "function", ours: null, note: "its arguments are not read here" })
    },
    tableRow({
        id: "chat-notifications",
        target: "#chat-notifications and the chat log's _shouldShowNotifications and _toggleNotifications",
        owner: "foundry",
        file: "foundry-windows.mjs",
        symbol: "wrapSidebar",
        why: "With the Foundry tools window closed the sidebar is collapsed, so Foundry shows its chat notifications and keeps the chat's input outside (amend 11.10 A8).",
        when: "while Foundry's rails are in the module's windows",
        fallback: "with the window closed, chat notifications may not show and the chat's input may stay hidden",
        table: "B-E52-3"
    }),
    tableRow({
        id: "escape-dismiss-order",
        target: "core.dismiss's order of steps (drag, menus, tour, framed windows, selection, main menu)",
        owner: "foundry",
        file: "foundry-windows.mjs",
        symbol: "escapeFallsToWindows",
        why: "Escape closes the module's two windows only where Foundry's own Escape would open the main menu (amend 11.10 A8).",
        when: "while either of the two windows is open",
        fallback: "Escape may close the windows before Foundry's own steps, or never",
        table: "B-E52-3"
    }),
    tableRow({
        id: "focus-chat",
        target: "core.focusChat focusing #chat-message at once",
        owner: "foundry",
        file: "foundry-windows.mjs",
        symbol: "wrapSidebar",
        why: "The chat key opens the Foundry tools window first, synchronously, so the focus lands in a shown input (amend 11.10 A8).",
        when: "while Foundry's rails are in the module's windows",
        fallback: "the chat key may focus an input in a hidden window",
        table: "B-E52-3"
    }),
    tableRow({
        id: "image-popout-options",
        target: "ImagePopout's options (window.controls, showTitle)",
        owner: "foundry",
        file: "room-tile.mjs",
        symbol: "openRoomImage",
        why: "A room's picture opens in Foundry's picture window with no title bar controls and no title (amend 11.10 A8).",
        when: "whenever a room's picture is opened",
        fallback: "the picture window may show Foundry's title and controls",
        table: "B-E52-3"
    }),

    /* ---- Anchors (E52 C3, E52-12): DOM places of theirs the code finds by selector or id. R1549 (tier 0) holds each
       of `literals` (and each selector of SHEET_ANCHORS) to a string literal in its file. A page anchor is found or
       not yet: one not on the page now (a camera not popped out, a theme not drawn) is unknown, never failed ---- */
    {
        id: "sheet-anchors",
        kind: "anchor",
        target: "the character sheet's places the module fills (SHEET_ANCHORS)",
        owner: "daggerheart",
        file: "sheet.mjs",
        symbol: "onRenderCharacterSheet",
        why: "The student's file is laid into Daggerheart's own sheet: its header rows, traits, Hope, sidebar bars and sections.",
        when: "read at the first character sheet of the system's own class drawn in a load",
        fallback: "what the module puts at a missing place is not drawn there; sheet.mjs looks each place up and skips one it cannot find",
        probe: () => sheetAnchorsAnswer(sheetRead.done)
    },
    {
        id: "foundry-rails",
        kind: "anchor",
        target: "#sidebar and #scene-controls (Foundry's two rails the module's windows hold)",
        owner: "foundry",
        file: "foundry-windows.mjs",
        symbol: "adoptFoundryNodes",
        literals: ["sidebar", "scene-controls"],
        why: "The sidebar and the scene controls are moved into the Foundry tools and Map tools windows and kept there (amend 11.10 A8).",
        when: "while Foundry's rails are in the module's windows",
        fallback: "a rail not found by its id stays where Foundry puts it, outside the module's window",
        probe: () => {
            const ids = [globalThis.ui?.sidebar?.element?.id, globalThis.ui?.controls?.element?.id];
            if (ids.some(id => id === undefined)) return { present: null, ours: null, note: "Foundry's sidebar or scene controls have not drawn here" };
            return { present: ids[0] === "sidebar" && ids[1] === "scene-controls", ours: null, note: `ids read: ${ids.join(", ")}` };
        }
    },
    {
        id: "interface-theme",
        kind: "anchor",
        target: "the theme classes on #interface (themed, theme-dark or theme-light)",
        owner: "foundry",
        file: "foundry-windows.mjs",
        symbol: "wearInterfaceTheme",
        literals: ["interface", "theme-"],
        why: "The module's two windows wear the interface's theme, so Foundry's rails inside them keep their colours (amend 11.10 A8).",
        when: "while Foundry's rails are in the module's windows",
        fallback: "the windows wear no theme class, and the rails inside take the page's",
        probe: () => {
            const classes = [...(document.getElementById("interface")?.classList ?? [])];
            if (classes.some(c => c.startsWith("theme-"))) return { present: true, ours: null };
            return { present: null, ours: null, note: "no theme class on #interface now" };
        }
    },
    {
        id: "camera-popout-id",
        kind: "anchor",
        target: "a camera popout's id, camera-view-<user id>",
        owner: "foundry",
        file: "voice-tile.mjs",
        symbol: "foundryDock",
        literals: ['.application[id^="camera-view-"]'],
        why: "A camera popped out of the dock is still read for its speaker's audio (amend 11.10 A9).",
        when: "while voice is on and a camera is popped out",
        fallback: "a popped-out camera's speaker is not found, and reads as not audible",
        probe: () => {
            if (document.querySelector('.application[id^="camera-view-"]')) return { present: true, ours: null };
            return { present: null, ours: null, note: "no camera popped out now" };
        }
    },
    {
        id: "mic-audio-anchor",
        kind: "anchor",
        target: "a speaker's audio element, .camera-view[data-user] audio.user-microphone-audio",
        owner: AV_MODULE,
        file: "voice-tile.mjs",
        symbol: "audible",
        literals: [".camera-view[data-user] audio.user-microphone-audio"],
        why: "Whether a speaker is audible on this browser is read from the audio element avclient-livekit attaches (amend 11.10 A9).",
        when: `only while ${AV_MODULE} is active and someone is heard`,
        fallback: "a speaker whose element is not found reads as not audible",
        inUse: () => moduleActive(AV_MODULE),
        probe: () => {
            if (document.querySelector(".camera-view[data-user] audio.user-microphone-audio")) return { present: true, ours: null };
            return { present: null, ours: null, note: "no speaker's audio element on this page now" };
        }
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

/**
 * What the table gets while a row is failed, in the table's language (E52 C7, R1562): lang's
 * DRPG.Contract.instead.<key>, the key being the row's `insteadKey` (a held row's template) or its id. The row's
 * own `fallback` is English, written for the console and the author's report; it stands in for a row with no
 * sentence of its own (a stand-in a test draws) and is never what a GM reads in a sentence of the table's language
 * when the register has one.
 */
export function insteadOf(entry) {
    const key = `DRPG.Contract.instead.${entry.insteadKey ?? entry.id}`;
    return game.i18n?.has?.(key) ? game.i18n.localize(key) : entry.fallback;
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
    if (entry.kind === "hook") return answer("unknown", "not seen firing in this load");
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
        where: whereOf(entry), when: entry.when, fallback: entry.fallback, instead: insteadOf(entry), ...judged(entry)
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
                rows: contract.failed.map(r => `${r.target} (${r.where}): ${r.instead}`).join("; ") }), { permanent: true });
        }
    }
    return contract;
}

/* ==========================================================================
 * THE CHARACTER SHEET'S FIRST RENDER (E52 C3, E52-09, E52-12)
 * --------------------------------------------------------------------------
 * sheet.mjs is left as it is (Q-7): this file listens to the sheet's render
 * and close hooks itself, marks each fired, and reads SHEET_ANCHORS on the
 * first sheet of the system's own class - a stand-in a test draws is not one.
 * Read once a load, on that render alone: nothing per frame.
 * ========================================================================== */

/** Which of `anchors` the element lacks: `{ at, missing, of }`, or null when there is no element to read. */
export function readSheetAnchors(element, anchors = SHEET_ANCHORS) {
    const root = element instanceof HTMLElement ? element : element?.[0];
    if (!root?.querySelector) return null;
    const missing = anchors.filter(anchor => {
        try {
            return !root.querySelector(anchor.selector);
        } catch {
            return true;
        }
    }).map(anchor => anchor.selector);
    return { at: Date.now(), missing, of: anchors.length };
}

/* Whether `app` is a sheet of a character sheet class the world registered. */
const systemSheet = app => Object.values(CONFIG.Actor?.sheetClasses?.character ?? {})
    .some(entry => typeof entry?.cls === "function" && app instanceof entry.cls);

/**
 * A character sheet drawn: the first of the system's own class in this load is read for its anchors, and a missing
 * one is said in the console. Answers the reading, or null when this render was not read. `state` and `isSheet` are
 * handed in by R1548.
 */
export function noteSheetRender(app, element, { state = sheetRead, isSheet = systemSheet } = {}) {
    if (state.done || !isSheet(app)) return null;
    const read = readSheetAnchors(element ?? app?.element);
    if (!read) return null;
    state.done = read;
    if (read.missing.length) warn(`The contract: the character sheet has no ${read.missing.join(" | ")}; what the module puts there is not drawn.`);
    return read;
}

let watchingSheets = false;

/**
 * From module.mjs's ready, on every client: listen to the two sheet hooks of the register (their names read from
 * its rows), mark each fired, and read the first sheet's anchors; on the primary GM a missing one runs the contract
 * again, so a GM not told yet this load is told now.
 */
export function watchSheetRenders() {
    if (watchingSheets) return false;
    watchingSheets = true;
    const render = PATCHES.find(row => row.id === "hook-character-sheet-render")?.target;
    const close = PATCHES.find(row => row.id === "hook-character-sheet-close")?.target;
    if (render) {
        Hooks.on(render, (app, element) => {
            markFired(render);
            if (noteSheetRender(app, element)?.missing.length && isPrimaryGm()) announceContract();
        });
    }
    if (close) Hooks.on(close, () => markFired(close));
    return true;
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
