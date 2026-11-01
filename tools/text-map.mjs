/**
 * The screen map (E65 C10, I10, E65-19): which keys each window, card and flow of the module says.
 * ---------------------------------------------------------------------------
 *     node tools/text-map.mjs            writes audit/harness/results/text/screens.json, prints the counts
 *
 * Read off the scripts with espree (audit/harness/node_modules, as `node tools/check.mjs names` reads them),
 * every file under scripts/ but the suite's own (tests.mjs, tests-*.mjs: they quote what they hunt for).
 *
 * UNITS. Each top-level declaration of a file is a unit - a function, a class (its methods with it), a
 * `const` (an arrow, a table), or a statement (`@<line>`: a top-level `Hooks.on(...)`, say) - and a unit's
 * keys are the `DRPG.*` names its own text spells: a string literal that is a key of en.json, pl.json or
 * config.mjs's prose ("literal"); a literal that is the start of keys (a plural family's base, a group
 * handed to a helper that appends to it) or a template whose fixed pieces match keys
 * (`DRPG.Trap.trigger.${kind}`, `DRPG.X.${a}.label`) - every key it matches, "by prefix"; and a config
 * table it imports from config.mjs (`ACTIONS`, `CRISIS_ACTIONS`) - every `DRPG.Config.<TABLE>.*` prose key,
 * "by table", the way i18n-config.mjs swaps them in. A template whose first piece names no group past
 * `DRPG.` (`DRPG.${x}`) matches too much to say anything and is counted, `open`; a literal that names no key
 * of either file is counted, `missing` (a key the code asks for and the files do not hold - or a
 * `DRPG.`-shaped string that is no key).
 *
 * ENTRY POINTS. A unit is a screen's entry point when it is one of: a class that extends ApplicationV2 or
 * HandlebarsApplicationMixin (`app`); a unit that names DialogV2 (`dialog`); a unit that posts a chat card
 * (`ChatMessage.create`, or a call of utils.mjs's `announce`, `whisperToOwner`, `whisperToOwnerOnly`,
 * `whisperToGms`, murder-rules.mjs's `announceCrisis` - by the name it was imported as, and through a
 * same-file arrow whose body is one such call, as murder-rules.mjs wraps two of them: `card`); a unit that
 * raises a notification (`ui.notifications.*`: `toast`); a unit that writes markup or text into the page itself
 * (an `innerHTML`, `outerHTML`, `textContent` or `innerText` assigned, `insertAdjacentHTML`: `draw` - a tile, a
 * tray, a ticker; not in the slice's list, added 31.10 because tests-text.mjs's T13 counts such a file as one that draws,
 * and without it 7 of T13's 103 drawing files had no entry point); a hook that draws into a sheet or a window
 * (`Hooks.on`/`Hooks.once` with an event that starts "render" or "get": `hook`, the unit holding the
 * call, or the named function it hands on). A unit that reads one of those (of its own file, or by an import)
 * posts through it - frisk.mjs's `endAsk` hands its words to `cardTo` - and is an entry point too (`via`), one level
 * up from the direct ones: measured 31.10, with no such level 701 entry points leave 510 keys unassigned, with one
 * 1059 and 195, with two 1194 and 154, to the end 1354 and 136 - past one level a flow's callers are taken for
 * screens and the keys they name are reached anyway. A SCREENS row may also name a unit outright (the settings'
 * registration): it is an entry point then (`named`).
 *
 * A SCREEN'S KEYS are those of its entry points and of every unit of the same file they reach that is no
 * entry point itself (an entry point's helpers, transitively; another entry point is a screen of its own),
 * and of each unit of another file those reach by an import (one hop, its own text only, not what it calls
 * in turn: the slice's "imported helper that only formats"), and of the SCREENS row's own `prefixes`. A
 * reach is a name read, not only a call: a handler handed to a button is reached.
 *
 * SCREENS is the hand table: the windows, cards and flows by name, the entry points each groups
 * (`file:name`, or `file:*` for every entry point of a file not named by another row), who reads it
 * (`reader`: "gm", "player" or "both" - decision 38 of 31.10: the window surfaces split by reader, which
 * a key's name cannot tell), and `texts` where the screen states a game rule or a safety tool ("rule",
 * "safety": decision 52, the mark T19 reads). The entry points no row groups are put together by file,
 * as a screen of their own each (`file:<path>`, reader "unknown"). A key no screen reaches is `unassigned`.
 *
 * What it does not read: a key built at run time from data (a table's row id read from a world, the
 * `open` templates), a key handed through a variable from another file (a module-level const another
 * file imports is a unit of its own, reached only by the import), and what a screen shows of Foundry's
 * own windows. So `unassigned` is a list to read, not a list of dead keys.
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");

/* The senders by name (E65 C6's SENDERS less the two audience functions, which are whisper lists, not posts). */
export const POSTERS = Object.freeze(["announce", "announceCrisis", "whisperToOwner", "whisperToOwnerOnly", "whisperToGms"]);
const KEYISH = /^DRPG\.[\w-]+(?:\.[\w-]*)*$/;

/**
 * THE HAND TABLE (E65 C10). Each row: `id`, `name` (as the module names the window, card or flow), `kind`
 * ("window", "card", "flow", "tiles"), `reader`, `entries`, optional `texts`, `prefixes` (keys by hand) and
 * `stage` (the stage that built or rebuilt it, for the windows of E09-E19 and after). Read off the code
 * 31.10.2026: each row's file and function names were looked up on this tree before they were written.
 */
const row = (id, name, kind, reader, entries, more = {}) => Object.freeze({ id, name, kind, reader, entries: Object.freeze(entries), ...more });
export const SCREENS = Object.freeze([
    /* The windows the slice names first. */
    row("room-setup", "Room Setup", "window", "gm", ["scripts/vault.mjs:openRoomSetupDialog", "scripts/passages-tab.mjs:*"],
        { stage: "E12", note: "a GM's window (passages-tab.mjs: \"the GMs' table\"); its Passages tab is E79's" }),
    row("stash-inspector", "the stashes, every one (game.drpg.inspectVaults)", "window", "gm", ["scripts/vault.mjs:openVaultInspector"], { stage: "E13" }),
    row("stash", "the stash: a character's items and gear", "window", "both", ["scripts/vault.mjs:*"]),
    row("season-setup", "Season setup", "window", "gm", ["scripts/season-setup.mjs:*"], { note: "setting a season up and taking one down: the GM's" }),
    row("gm-panel", "the GM panel", "window", "gm", ["scripts/gm-panel.mjs:*"], { stage: "E13" }),
    row("trial-console", "the trial console: the GM's controls for a Class Trial", "window", "gm", ["scripts/trial-floor-ui.mjs:*"], { stage: "E10" }),
    row("trial-turn", "a round's turn on a participant's browser", "window", "player", ["scripts/trial-prompt.mjs:*"], { stage: "E70" }),
    row("trial-evidence", "evidence put in front of the table, and the Objection", "flow", "both", ["scripts/trial.mjs:*"]),
    row("murder-window", "the murder window", "window", "gm", ["scripts/murder-ui.mjs:openMurderDialog"], { note: "murder-ui.mjs: \"the window a GM opens a murder from\"" }),
    row("incident-tracker", "the GM's incident tracker", "window", "gm", ["scripts/murder-ui.mjs:*"]),
    row("notice-history", "the notice history", "window", "both", ["scripts/notice-history-app.mjs:*"],
        { stage: "E81", note: "player and GM, each their own (A7): every card this browser showed this login" }),
    row("room-tile", "the room tile and the room's window", "tiles", "both", ["scripts/room-tile.mjs:*"], { stage: "E77" }),
    row("voice-tile", "the voice tile and its list", "tiles", "both", ["scripts/voice-tile.mjs:*", "scripts/voice-panel.mjs:voiceFieldset"], { stage: "E78" }),
    row("frisk", "Frisk: the ask, the answer and the cards", "flow", "both", ["scripts/frisk.mjs:*"], { stage: "E80" }),
    row("passages-gm", "the secret passages as the GMs keep them", "window", "gm", ["scripts/passages-gm.mjs:*"], { note: "passages-gm.mjs: \"as the GMs keep them\"" }),
    row("find-passage", "Find Passage and Breach the Wall, and what a player's browser knows of a passage", "flow", "both",
        ["scripts/action-rolls.mjs:locatePassage", "scripts/passages.mjs:*"]),
    /* The windows E09-E19 built or rebuilt, by the stage the comment above each names (read 31.10). */
    row("death-window", "a death: the window and its cards", "window", "gm", ["scripts/chapter.mjs:openDeathDialog"], { stage: "E09" }),
    row("body-discovery", "the body discovery", "window", "gm", ["scripts/chapter.mjs:openBodyDiscoveryDialog", "scripts/chapter.mjs:promoteFaintPrep"], { stage: "E11" }),
    row("chapter", "a chapter's end and Stage Six", "flow", "both", ["scripts/chapter.mjs:*"]),
    row("transform", "a weapon or a body changed by the cleanup", "window", "player", ["scripts/cleanup.mjs:askTransform", "scripts/cleanup.mjs:askTransformChange"], { stage: "E09" }),
    row("cleanup", "Stage 6: the killer cleaning up", "flow", "both", ["scripts/cleanup.mjs:*"], { stage: "E16" }),
    row("key-remnant", "a key Remnant placed, and the bullets swept", "window", "gm",
        ["scripts/investigation.mjs:placeKeyRow", "scripts/investigation.mjs:confirmSweepBullets"], { stage: "E09" }),
    row("investigation", "the GM's side of an Investigation", "window", "gm", ["scripts/investigation.mjs:*"], { note: "investigation.mjs: \"the GM's side\"" }),
    row("observe", "Observe and Analyze", "flow", "both", ["scripts/observe.mjs:*", "scripts/analyze.mjs:*"], { stage: "E09" }),
    row("advancement", "Advancement", "window", "both", ["scripts/level-up.mjs:*"], { stage: "E10" }),
    row("vote", "the vote and the verdict", "window", "both", ["scripts/vote.mjs:*"], { stage: "E10" }),
    row("clock", "the GM's clock and its corrections", "window", "gm", ["scripts/gm-panel.mjs:openClockDialog", "scripts/gm-panel.mjs:confirmCorrection"], { stage: "E11" }),
    row("project-start", "a project started from an action", "window", "both", ["scripts/action-rolls.mjs:startProject"], { stage: "E12" }),
    row("move-body", "moving a body", "window", "player", ["scripts/cleanup.mjs:openMoveBodyDialog"], { stage: "E12" }),
    row("tier-zero", "a crisis action rated at tier zero", "window", "gm", ["scripts/murder-rules.mjs:rateTierZero"], { stage: "E13" }),
    row("trial-exit", "leaving the trial hall", "window", "gm", ["scripts/trial-floor-ui.mjs:askTrialExit"], { stage: "E13" }),
    row("give-items", "the GM gives a key or an item", "window", "gm", ["scripts/gm-items.mjs:giveKeyDialog", "scripts/gm-items.mjs:gmGiveItemDialog"], { stage: "E14" }),
    row("gm-items", "the GM hands things out and takes them away", "window", "gm", ["scripts/gm-items.mjs:*"]),
    row("table-names", "an item table named and its pane", "window", "gm", ["scripts/tables.mjs:promptForTableName", "scripts/tables.mjs:wirePaneHeading"], { stage: "E14" }),
    row("item-tables", "the item tables", "window", "gm", ["scripts/tables.mjs:*"], { note: "tables.mjs: the guide \"tells the GM to improvise\"" }),
    row("sheet-other", "the sheet's Other section", "window", "both", ["scripts/sheet.mjs:buildOtherSection"], { stage: "E14" }),
    row("projects", "projects and the countdown tray", "window", "both", ["scripts/projects-ui.mjs:*", "scripts/projects-tray.mjs:*", "scripts/projects.mjs:*"], { stage: "E15" }),
    row("betrayal", "the betrayal and a dynamic difficulty", "window", "both", ["scripts/action-rolls.mjs:performBetrayal", "scripts/action-rolls.mjs:askDynamicDifficulty"], { stage: "E16" }),
    row("roll-window", "the roll window", "window", "both", ["scripts/roll-dialog.mjs:*"], { stage: "E16" }),
    row("eclipse-hud", "the Eclipse asked from the HUD", "window", "gm", ["scripts/hud.mjs:askEclipse"], { stage: "E17" }),
    row("bridge-request", "a player's request the GM is asked about", "window", "gm", ["scripts/gm-bridge.mjs:askForRequest"], { stage: "E18" }),
    row("item-effect", "an item's effect ruled from the messenger", "window", "gm", ["scripts/messenger-app.mjs:askItemEffect"], { stage: "E18" }),
    row("after-incident", "after an incident", "window", "gm", ["scripts/murder-rules.mjs:afterIncident"], { stage: "E18" }),
    row("which-resource", "which resource an item restores", "window", "both", ["scripts/use-items.mjs:askWhichResource"], { stage: "E18" }),
    row("camera-views", "the camera dock's views", "tiles", "both", ["scripts/camera-view.mjs:*"], { stage: "E19" }),
    /* The rest of the module's windows and flows, a row a file or a family. */
    row("action-tiles", "the action tiles and the actions", "tiles", "both", ["scripts/action-rolls.mjs:*", "scripts/actions.mjs:*"],
        { texts: "rule", prefixes: ["DRPG.Config.ACTIONS."], note: "an action's hint states its rule" }),
    row("calls", "Hope and Despair Calls", "flow", "both", ["scripts/calls.mjs:*", "scripts/call-effects.mjs:*", "scripts/call-pickers.mjs:*", "scripts/call-world.mjs:*"],
        { texts: "rule", note: "a Call's effect states its rule" }),
    row("explain", "the panels explain themselves", "window", "both", ["scripts/explain.mjs:*"], { texts: "rule", note: "explain.mjs: \"Four widgets ... none of them said what\"" }),
    row("safeword", "the safeword", "flow", "both", ["scripts/safeword.mjs:*"], { texts: "safety", note: "Player Handbook ch. 13" }),
    row("murder-cards", "an incident's cards and windows", "flow", "both", ["scripts/murder-rules.mjs:*"]),
    row("handbooks", "the handbooks", "window", "both", ["scripts/handbooks.mjs:*"]),
    row("messenger", "the messenger", "window", "both", ["scripts/messenger-app.mjs:*", "scripts/messenger.mjs:*"]),
    row("gm-stores", "the GM stores: back up, restore, the health check", "window", "gm", ["scripts/gm-stores.mjs:*"]),
    row("gm-team", "the GM team panel (Despair Flow)", "window", "gm", ["scripts/gm-team-dialog.mjs:*"]),
    row("mastermind", "the Mastermind and the Final Trial", "window", "both", ["scripts/mastermind.mjs:*"]),
    row("diagnostics", "the GM's reports (diagnostics and the map's checks)", "window", "gm", ["scripts/diagnostics.mjs:*", "scripts/fog-diagnostics.mjs:*"]),
    row("sheet", "the character sheet", "window", "both", ["scripts/sheet.mjs:*", "scripts/sheet-audit.mjs:*", "scripts/anonymity.mjs:*"]),
    row("hud", "the HUD", "tiles", "both", ["scripts/hud.mjs:*"]),
    row("settings", "Foundry's settings window: the module's settings", "window", "both", ["scripts/settings.mjs:registerSettings"],
        { prefixes: ["DRPG.Settings."], note: "world settings a GM sets, client settings every user" }),
    row("daggerheart", "Daggerheart's own windows: the system's keys this module's files override", "window", "both", [], { prefixes: ["DAGGERHEART.", "GAME."] }),
    row("suite", "the suite's runner (scripts/tests.mjs, a suite file the map does not read)", "window", "gm", [], { prefixes: ["DRPG.Tests."] })
]);

/** espree from the harness's install, or null. */
export function loadEspree(repo = REPO) {
    try { return createRequire(path.join(repo, "audit", "harness", "package.json"))("espree"); } catch { return null; }
}

/* A walker over espree's nodes: every child that is a node, with the field it sits in. */
export function eachChild(node, fn) {
    for (const [field, v] of Object.entries(node)) {
        if (field === "loc" || field === "range" || field === "start" || field === "end") continue;
        if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === "string") fn(c, field, node); }
        else if (v && typeof v.type === "string") fn(v, field, node);
    }
}

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const memberName = n => (n?.type === "MemberExpression" && !n.computed ? n.property?.name : null);
/* `a.b.c` as text, for the callee shapes this reads (ui.notifications.warn, ChatMessage.create, Hooks.on). */
export function dotted(n) {
    if (!n) return null;
    if (n.type === "Identifier") return n.name;
    if (n.type === "ChainExpression") return dotted(n.expression);
    if (n.type === "MemberExpression" && !n.computed) { const o = dotted(n.object); return o === null ? null : `${o}.${n.property.name}`; }
    return null;
}
const stringOf = n => (n?.type === "Literal" && typeof n.value === "string" ? n.value
    : n?.type === "TemplateLiteral" && n.expressions.length === 0 ? n.quasis[0].value.cooked : null);

/**
 * The keys a literal (`value`) or a template's fixed pieces (`pieces`) names, as `[key, how]` pairs: the key itself
 * ("literal"), or every key it starts or whose shape it matches ("prefix"). With `why`, an answer that names no key carries
 * `open` (a piece that names no group past `DRPG.`) or `missing` (it names a key no file holds) and `shown`.
 */
export function keysOfLiteral(value, pieces, universe, keySet, why = false, minSegments = 2) {
    const none = (kind, shown) => Object.assign([], why ? { [kind]: true, shown } : {});
    /* How many whole segments a prefix names before what it leaves open: "DRPG.Trap.trigger." 3, "DRPG.Monocub." 2. */
    const segments = head => head.split(".").filter(Boolean).length - (head.endsWith(".") ? 0 : 1);
    if (pieces === null || pieces === undefined) {
        if (typeof value !== "string" || !value.startsWith("DRPG.") || !KEYISH.test(value)) return [];
        if (keySet.has(value)) return [[value, "literal"]];
        const head = value.endsWith(".") ? value : `${value}.`;
        const under = universe.filter(k => k.startsWith(head));
        if (under.length && head.split(".").length > 2 && segments(head) >= minSegments) return under.map(k => [k, "prefix"]);
        return none(under.length ? "open" : "missing", value);
    }
    if (pieces.length === 1) return keysOfLiteral(pieces[0], null, universe, keySet, why, minSegments);
    if (!pieces[0].startsWith("DRPG.")) return [];
    const shown = pieces.join("${...}");
    if (!/^DRPG\.[\w-]+/.test(pieces[0]) || pieces[0] === "DRPG." || segments(pieces[0]) < minSegments) return none("open", shown);
    const re = new RegExp(`^${pieces.map(escapeRe).join(".+?")}$`);
    const under = universe.filter(k => re.test(k));
    return under.length ? under.map(k => [k, "prefix"]) : none("missing", shown);
}

/**
 * The scripts parsed: `{ files, resolve, problems }` - `files` a Map of path to its units, imports, exports and stars
 * (`unitsOf`), `resolve(file, name)` the unit a file exports under a name, followed through re-exports and `export *`.
 * tools/text-audience.mjs reads the scripts through this too.
 */
export function parseScripts(scripts, espree) {
    const files = new Map(), problems = [];
    for (const [file, text] of scripts) {
        let tree;
        try { tree = espree.parse(text, { ecmaVersion: "latest", sourceType: "module", loc: true }); }
        catch (err) { problems.push(`${file}: does not parse (${err.message})`); continue; }
        files.set(file, unitsOf(file, tree));
    }
    const resolve = (file, name, seen = new Set()) => {
        const f = files.get(file);
        if (!f || seen.has(`${file}:${name}`)) return null;
        seen.add(`${file}:${name}`);
        const e = f.exports.get(name);
        if (e && e.from !== file) return resolve(e.from, e.name, seen);
        const local = e ? e.name : name;
        const u = f.units.find(x => x.name === local);
        if (u) return u;
        const imp = f.imports.get(local);
        if (imp && imp.name !== "*") return resolve(imp.from, imp.name, seen);
        for (const st of f.stars) { const r = resolve(st, name, seen); if (r) return r; }
        return null;
    };
    return { files, resolve, problems };
}

/** One unit's own reading: the strings and templates it spells, the names it reads, what makes it an entry point. */
function readUnit(node, posters) {
    /* `const DialogV2 = foundry.applications.api.DialogV2`: a name for the class, no window of its own. */
    const alias = node.type === "VariableDeclarator" && (node.init?.type === "MemberExpression" || node.init?.type === "Identifier");
    const strings = [], templates = [], refs = new Set(), marks = new Set(), hooked = [];
    const visit = (n, field, parent) => {
        if (n.type === "Literal" && typeof n.value === "string") strings.push({ value: n.value, line: n.loc.start.line });
        else if (n.type === "TemplateLiteral") {
            if (n.expressions.length === 0) strings.push({ value: n.quasis[0].value.cooked, line: n.loc.start.line });
            else templates.push({ pieces: n.quasis.map(q => q.value.cooked ?? ""), line: n.loc.start.line });
        } else if (n.type === "Identifier") {
            const isKey = (parent?.type === "MemberExpression" && field === "property" && !parent.computed)
                || ((parent?.type === "Property" || parent?.type === "MethodDefinition" || parent?.type === "PropertyDefinition") && field === "key" && !parent.computed && !parent.shorthand);
            if (!isKey) refs.add(n.name);
            if (n.name === "DialogV2" && !alias) marks.add("dialog");
        }
        if (memberName(n) === "DialogV2" && !alias) marks.add("dialog");
        /* A unit that writes markup or text into the page itself (a tile, a tray, a ticker): it draws. */
        if (n.type === "AssignmentExpression" && ["innerHTML", "outerHTML", "textContent", "innerText"].includes(memberName(n.left))) marks.add("draw");
        if (n.type === "CallExpression" && memberName(n.callee) === "insertAdjacentHTML") marks.add("draw");
        if (n.type === "CallExpression") {
            const callee = dotted(n.callee);
            if (callee !== null) {
                if (/^ui\.notifications\.\w+$/.test(callee)) marks.add("toast");
                else if (/(?:^|\.)ChatMessage\.create$/.test(callee) || posters.has(callee)) marks.add("card");
                else if (/^Hooks\.(?:on|once)$/.test(callee)) {
                    const event = stringOf(n.arguments[0]);
                    if (event !== null && /^(?:render|get)[A-Z]/.test(event)) {
                        const fn = n.arguments[1];
                        if (fn?.type === "Identifier") hooked.push(fn.name); else marks.add("hook");
                    }
                }
            }
        }
        if ((n.type === "ClassDeclaration" || n.type === "ClassExpression") && n.superClass) {
            const sup = JSON.stringify(n.superClass, (k, v) => (k === "loc" ? undefined : v));
            if (/"(?:ApplicationV2|HandlebarsApplicationMixin)"/.test(sup)) marks.add("app");
        }
        eachChild(n, visit);
    };
    visit(node, null, null);
    return { strings, templates, refs, marks, hooked };
}

/** The top-level units of one parsed file, and its imports and re-exports. */
function unitsOf(file, tree) {
    const units = [], imports = new Map(), exports = new Map(), stars = [];
    const add = (name, node, kind) => units.push({ file, name, node, kind, line: node.loc.start.line });
    const dir = path.posix.dirname(file);
    const target = src => path.posix.normalize(path.posix.join(dir, src));
    for (const stmt of tree.body) {
        if (stmt.type === "ImportDeclaration") {
            for (const s of stmt.specifiers) {
                imports.set(s.local.name, { from: target(stmt.source.value), name: s.type === "ImportSpecifier" ? (s.imported.name ?? s.imported.value) : s.type === "ImportDefaultSpecifier" ? "default" : "*" });
            }
            continue;
        }
        if (stmt.type === "ExportAllDeclaration") { if (!stmt.exported) stars.push(target(stmt.source.value)); continue; }
        if (stmt.type === "ExportNamedDeclaration" && !stmt.declaration) {
            for (const s of stmt.specifiers) {
                const as = s.exported.name ?? s.exported.value, local = s.local.name ?? s.local.value;
                exports.set(as, stmt.source ? { from: target(stmt.source.value), name: local } : { from: file, name: local });
            }
            continue;
        }
        const decl = (stmt.type === "ExportNamedDeclaration" || stmt.type === "ExportDefaultDeclaration") && stmt.declaration ? stmt.declaration : stmt;
        if ((decl.type === "FunctionDeclaration" || decl.type === "ClassDeclaration") && decl.id) {
            add(decl.id.name, decl, decl.type === "ClassDeclaration" ? "class" : "function");
            if (stmt.type !== decl.type) exports.set(stmt.type === "ExportDefaultDeclaration" ? "default" : decl.id.name, { from: file, name: decl.id.name });
        } else if (decl.type === "VariableDeclaration") {
            for (const d of decl.declarations) {
                if (d.id.type === "Identifier") {
                    add(d.id.name, d, "const");
                    if (stmt.type === "ExportNamedDeclaration") exports.set(d.id.name, { from: file, name: d.id.name });
                } else add(`@${d.loc.start.line}`, d, "statement");
            }
        } else add(`@${stmt.loc.start.line}`, stmt, "statement");
    }
    return { units, imports, exports, stars };
}

/**
 * The map. `scripts`: a Map of path (from the repository's root) to text; `keys`: every key of en.json, pl.json
 * and config.mjs's prose (a Set or an array); `espree`; `screens`: the hand table (SCREENS by default);
 * `configTables`: the tables of config.mjs whose prose is keyed `DRPG.Config.<TABLE>.*`.
 */
export function buildScreenMap({ scripts, keys, espree, screens = SCREENS, configTables = [] } = {}) {
    const universe = [...new Set(keys)].sort();
    const keySet = new Set(universe);
    const { files, resolve, problems } = parseScripts(scripts, espree);
    /* The posters of each file: the senders as this file imported them (any local name), the ones it declares,
       and a same-file arrow whose whole body is one call of a poster (murder-rules.mjs's two wrappers). */
    const postersOf = new Map();
    for (const [file, f] of files) {
        const set = new Set();
        for (const [local, imp] of f.imports) if (POSTERS.includes(imp.name)) set.add(local);
        for (const u of f.units) if (POSTERS.includes(u.name) && u.kind === "function") set.add(u.name);
        let grew = true;
        while (grew) {
            grew = false;
            for (const u of f.units) {
                const init = u.node.init;
                if (set.has(u.name) || u.kind !== "const" || init?.type !== "ArrowFunctionExpression") continue;
                const body = init.body.type === "CallExpression" ? init.body : null;
                if (body && set.has(dotted(body.callee))) { set.add(u.name); grew = true; }
            }
        }
        postersOf.set(file, set);
    }
    const tables = new Set(configTables);
    const counts = { files: files.size, units: 0, entries: 0, literal: 0, prefix: 0, table: 0, open: 0, missing: 0 };
    const open = [], missing = [];
    for (const [file, f] of files) {
        for (const u of f.units) {
            counts.units++;
            const r = readUnit(u.node, postersOf.get(file));
            u.marks = r.marks; u.hooked = r.hooked; u.refs = r.refs;
            u.keys = new Map();   // key -> how ("literal", "prefix", "table")
            const put = (k, how) => { if (!u.keys.has(k) || u.keys.get(k) !== "literal") u.keys.set(k, how); };
            for (const s of [...r.strings.map(x => ({ ...x, pieces: null })), ...r.templates.map(x => ({ ...x, value: null }))]) {
                const read = keysOfLiteral(s.value, s.pieces, universe, keySet, true);
                if (read.open) { counts.open++; open.push({ file, unit: u.name, line: s.line, text: read.shown }); }
                else if (read.missing) { counts.missing++; missing.push({ file, unit: u.name, line: s.line, key: read.shown }); }
                else read.forEach(([k, how]) => put(k, how));
            }
            for (const name of r.refs) {
                const imp = f.imports.get(name);
                if (imp && imp.from === "scripts/config.mjs" && tables.has(imp.name)) {
                    for (const k of universe) if (k.startsWith(`DRPG.Config.${imp.name}.`)) put(k, "table");
                }
            }
        }
    }
    /* Entry points: by the markers, by a hook's named handler, and by a SCREENS row naming the unit. */
    const unitAt = new Map();
    for (const [, f] of files) for (const u of f.units) unitAt.set(`${u.file}:${u.name}`, u);
    for (const [, f] of files) {
        for (const u of f.units) {
            for (const h of u.hooked) { const t = f.units.find(x => x.name === h); if (t) t.marks.add("hook"); }
        }
    }
    /* A row's entry that names no unit is red in `text` - most often a function moved or renamed by a later stage, which
       `tools/moved-only.mjs` may pass - so the line names the row and the edit that fixes it (E65 fix round, 01.11.2026). */
    const named = new Map();
    for (const row of screens) for (const e of row.entries) if (!e.endsWith(":*") && !named.has(e)) named.set(e, row.id);
    for (const [e, id] of named) {
        const u = unitAt.get(e);
        if (!u) problems.push(`SCREENS row ${id} names ${e}, which is no top-level unit of the scripts - if it moved or was renamed, update that row of SCREENS in tools/text-map.mjs`);
        else u.marks.add("named");
    }
    /* A unit that posts through another (`via`, the header's measured levels): it reads a unit, of its own file or by an
       import, that posts a card, raises a notification, opens a dialog or draws itself. One level up from those. */
    const VIA_LEVELS = 1;
    const direct = u => ["app", "dialog", "card", "toast", "hook", "draw"].some(m => u.marks.has(m));
    for (let level = 0; level < VIA_LEVELS; level++) {
        const add = [];
        for (const [file, f] of files) {
            for (const u of f.units) {
                if (u.marks.size) continue;
                for (const name of u.refs) {
                    const imp = f.imports.get(name);
                    const t = f.units.find(x => x.name === name) ?? (imp && imp.name !== "*" ? resolve(imp.from, imp.name) : null);
                    if (t && t !== u && (level === 0 ? direct(t) : t.marks.size > 0)) { add.push(u); break; }
                }
            }
        }
        if (!add.length) break;
        for (const u of add) u.marks.add("via");
    }
    const isEntry = u => u.marks.size > 0;
    /* A screen's units: its entry points, the same file's non-entry units they reach (transitively), then one hop
       into another file's non-entry unit by an import. */
    const reach = entry => {
        const f = files.get(entry.file), inFile = new Set([entry]), queue = [entry];
        while (queue.length) {
            const u = queue.shift();
            for (const name of u.refs) {
                const t = f.units.find(x => x.name === name);
                if (t && !inFile.has(t) && !isEntry(t)) { inFile.add(t); queue.push(t); }
            }
        }
        const out = new Set(inFile);
        for (const u of inFile) {
            for (const name of u.refs) {
                const imp = f.imports.get(name);
                if (!imp || imp.name === "*") continue;
                const t = resolve(imp.from, imp.name);
                if (t && !isEntry(t)) out.add(t);
            }
        }
        return out;
    };
    const entries = [];
    for (const [, f] of files) for (const u of f.units) if (isEntry(u)) entries.push(u);
    counts.entries = entries.length;
    const grouped = new Map();   // entry id -> screen id
    for (const row of screens) {
        for (const e of row.entries) {
            if (e.endsWith(":*")) continue;
            if (grouped.has(e)) problems.push(`SCREENS groups ${e} twice (${grouped.get(e)} and ${row.id})`);
            else grouped.set(e, row.id);
        }
    }
    for (const row of screens) {
        for (const e of row.entries) {
            if (!e.endsWith(":*")) continue;
            const file = e.slice(0, -2);
            if (!files.has(file)) { problems.push(`SCREENS row ${row.id} names ${file}, which is no script - if it moved or was renamed, update that row of SCREENS in tools/text-map.mjs`); continue; }
            for (const u of entries.filter(x => x.file === file)) if (!grouped.has(`${u.file}:${u.name}`)) grouped.set(`${u.file}:${u.name}`, row.id);
        }
    }
    const rows = screens.map(row => ({ ...row, auto: false, units: [] }));
    const byId = new Map(rows.map(r => [r.id, r]));
    for (const u of entries) {
        const id = `${u.file}:${u.name}`;
        let row = byId.get(grouped.get(id));
        if (!row) {
            const auto = `file:${u.file}`;
            row = byId.get(auto);
            if (!row) { row = { id: auto, name: `${u.file} (entry points no SCREENS row groups)`, kind: "file", reader: "unknown", entries: [], auto: true, units: [] }; rows.push(row); byId.set(auto, row); }
        }
        row.units.push(u);
    }
    const keyScreens = new Map();
    const out = [];
    for (const row of rows) {
        const keysOf = new Map();
        const put = (k, how) => { if (!keysOf.has(k) || how === "literal") keysOf.set(k, how); };
        for (const entry of row.units) for (const u of reach(entry)) for (const [k, how] of u.keys) put(k, how);
        for (const p of row.prefixes ?? []) for (const k of universe) if (k.startsWith(p)) put(k, keysOf.get(k) === "literal" ? "literal" : "prefix");
        for (const k of keysOf.keys()) { if (!keyScreens.has(k)) keyScreens.set(k, []); keyScreens.get(k).push(row.id); }
        out.push({
            id: row.id, name: row.name, kind: row.kind, reader: row.reader, texts: row.texts ?? null, stage: row.stage ?? null, auto: row.auto,
            entries: row.units.map(u => ({ unit: `${u.file}:${u.name}`, line: u.line, as: [...u.marks].sort() })),
            keys: [...keysOf].sort((a, b) => a[0].localeCompare(b[0])).map(([key, how]) => ({ key, how }))
        });
        if (!row.auto && !row.units.length && !(row.prefixes ?? []).length) problems.push(`SCREENS row ${row.id} groups no entry point`);
    }
    const unassigned = universe.filter(k => !keyScreens.has(k));
    counts.screens = out.length; counts.hand = out.filter(s => !s.auto).length; counts.keys = universe.length;
    counts.assigned = keyScreens.size; counts.unassigned = unassigned.length;
    counts.byPrefixOnly = [...keyScreens.keys()].filter(k => out.every(s => s.keys.find(x => x.key === k)?.how !== "literal")).length;
    return { counts, screens: out, keyScreens, unassigned, open, missing, problems };
}

/**
 * The marks the map gives keys (decision 52): a key on a screen whose `texts` is "rule" or "safety", to that mark;
 * "safety" over "rule" when a key is on both kinds.
 */
export function marksOf(map) {
    const marks = new Map();
    for (const s of map.screens) {
        if (!s.texts) continue;
        for (const { key } of s.keys) if (marks.get(key) !== "safety") marks.set(key, s.texts);
    }
    return marks;
}

/**
 * Decision 38's split: for each surface named, its keys (by `surfaceOf`) by who reads the screens that say them -
 * `gm` when every screen of the key is a GM's, `player` when one is a player's or both's, `unknown` when only a screen of
 * unknown reader (a file's own) or a GM's beside one says it, `unassigned` when none does.
 */
export function readerSplit(map, surfaceOf, surfaces) {
    const readers = new Map();
    for (const s of map.screens) for (const { key } of s.keys) { if (!readers.has(key)) readers.set(key, new Set()); readers.get(key).add(s.reader); }
    const out = Object.fromEntries(surfaces.map(id => [id, { gm: 0, player: 0, unknown: 0, unassigned: 0 }]));
    for (const key of new Set([...map.keyScreens.keys(), ...map.unassigned])) {
        const surface = surfaceOf(key);
        if (!out[surface]) continue;
        const r = readers.get(key);
        out[surface][!r ? "unassigned" : r.has("player") || r.has("both") ? "player" : [...r].every(x => x === "gm") ? "gm" : "unknown"]++;
    }
    return out;
}

/** The scripts the map reads: git's list under scripts/, the suite's own files out (as `node tools/check.mjs text`). */
export function moduleScripts(repo = REPO) {
    const listed = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "scripts"], { cwd: repo, encoding: "utf8" }).split("\n").filter(Boolean);
    const lf = s => s.replace(/\r\n?/g, "\n");
    return new Map(listed.filter(f => f.endsWith(".mjs") && !/^tests(-[\w-]+)?\.mjs$/.test(path.basename(f))).sort()
        .map(f => [f, lf(fs.readFileSync(path.join(repo, f), "utf8"))]));
}

/** Every key the map knows: en.json's and pl.json's, flat, and config.mjs's prose keys; and the prose tables' names. */
export async function moduleKeys(repo = REPO) {
    const flat = (o, p = "", out = []) => { for (const [k, v] of Object.entries(o ?? {})) { const key = p ? `${p}.${k}` : k; if (v && typeof v === "object") flat(v, key, out); else out.push(key); } return out; };
    const read = rel => JSON.parse(fs.readFileSync(path.join(repo, rel), "utf8"));
    const config = await import(url.pathToFileURL(path.join(repo, "scripts", "config.mjs")).href);
    const { walkConfigProse } = await import(url.pathToFileURL(path.join(repo, "scripts", "i18n-config.mjs")).href);
    const prose = [];
    walkConfigProse(config, key => prose.push(key));
    const tables = [...new Set(prose.map(k => k.split(".")[2]))].sort();
    return { keys: [...flat(read("lang/en.json")), ...flat(read("lang/pl.json")), ...prose], tables };
}

/** The map as screens.json writes it. */
export function mapJson(map) {
    return {
        $comment: "Written by node tools/text-map.mjs (E65 C10, E65-19); generated, never committed. See the tool's header for what it reads.",
        counts: map.counts,
        screens: map.screens,
        unassigned: map.unassigned,
        open: map.open,
        missing: map.missing,
        problems: map.problems
    };
}

if (process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url)) {
    const espree = loadEspree();
    if (!espree) { console.log("text-map: espree is not installed - run `npm ci` in audit/harness first"); process.exit(2); }
    const { keys, tables } = await moduleKeys();
    const map = buildScreenMap({ scripts: moduleScripts(), keys, espree, configTables: tables });
    const dir = path.join(REPO, "audit", "harness", "results", "text");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "screens.json"), JSON.stringify(mapJson(map), null, 1) + "\n");
    const c = map.counts;
    console.log(`text-map: ${c.files} script(s), ${c.units} unit(s), ${c.entries} entry point(s); ${c.screens} screen(s), ${c.hand} by SCREENS; `
        + `keys ${c.keys}: ${c.assigned} assigned (${c.byPrefixOnly} by prefix or table only), ${c.unassigned} unassigned; open templates ${c.open}, missing ${c.missing}`);
    for (const p of map.problems) console.log(`text-map: problem: ${p}`);
    console.log(`text-map: wrote ${path.relative(REPO, path.join(dir, "screens.json"))}`);
    process.exitCode = map.problems.length ? 1 : 0;
}
