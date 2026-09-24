/**
 * One Foundry "client" - a forked child process. env: DRPG_USER, DRPG_REPO.
 * Talks to cluster.mjs over IPC. Boots jsdom + shim, imports the module,
 * walks init → i18nInit → setup → ready → canvasReady, then serves eval()s.
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { JSDOM, requestInterceptor } from "jsdom";
import * as U from "./lib/futil.mjs";
import { DataFieldOperator, ForcedDeletion, ForcedReplacement, revive } from "./lib/operators.mjs";
import { readVersions } from "./lib/versions.mjs";
import { attachModuleStyles, wrapGetComputedStyle } from "./lib/css.mjs";
import { AUTOMATION_DEFAULT, resourceTables, ResourceUpdateMap, addDualityResourceUpdates, modifyResource, updateFear } from "./lib/daggerheart.mjs";
import { HooksImpl, Collection, buildDocumentClasses, buildPIXI, buildApplications, RollImpl, REPO, MODULE_ID, recordError } from "./lib/shim.mjs";

const WHO = process.env.DRPG_USER ?? "gm";
const send = m => process.send?.(m);
const logLine = s => send({ t: "log", line: String(s) });

// Before the handlers below, which write to it: an error during import is an error too.
globalThis.__errors = [];
process.on("uncaughtException", err => { logLine(`UNCAUGHT: ${err.stack}`); recordError("uncaughtException", err); });
process.on("unhandledRejection", err => { logLine(`UNHANDLED REJECTION: ${err?.stack ?? err}`); recordError("unhandledRejection", err); });
/* A client exists only for its cluster. Its channel closing means the cluster
   has ended - crashed, or killed by a signal, where its own "exit" handler never
   runs - and a client left alone did not end (measured 24.09.2026: with the
   cluster killed by SIGKILL mid-run, all four clients were still running five
   seconds later; see cluster.mjs, NO CLIENT OUTLIVES THE CLUSTER). */
process.on("disconnect", () => process.exit(0));

/* ------------------------------ jsdom ----------------------------------- */

/*
 * WHAT THE PAGE CAN LOAD (E30, 24.09.2026): this checkout's files under
 * /modules/danganronpa-rpg/, as Foundry serves them, and nothing else - any other
 * address is a 404, so no run reaches the network. The stylesheets are the reason
 * (lib/css.mjs); jsdom loads only stylesheets here (no scripts run, no images
 * without the canvas package).
 */
const CONTENT_TYPES = { ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2" };
function serveCheckout(request) {
    const match = new URL(request.url).pathname.match(/^\/modules\/danganronpa-rpg\/(.+)$/);
    const file = match ? path.resolve(REPO, decodeURIComponent(match[1])) : null;
    if (!file || !file.startsWith(REPO + path.sep) || !fs.existsSync(file)) return new Response("", { status: 404 });
    return new Response(fs.readFileSync(file), { headers: { "Content-Type": CONTENT_TYPES[path.extname(file)] ?? "application/octet-stream" } });
}

const dom = new JSDOM(`<!doctype html><html><head></head><body>
  <div id="interface"><div id="ui-left"></div><div id="ui-top"></div><div id="ui-middle"></div><div id="ui-right"></div><div id="ui-bottom"></div></div>
  <div id="sidebar"><section id="chat"><ol id="chat-log"></ol><div id="chat-controls"></div></section></div>
  <div id="players"></div><div id="hotbar"></div><nav id="controls"></nav><div id="navigation"></div><div id="pause"></div>
</body></html>`, {
    url: "http://localhost:30000/game", pretendToBeVisual: true,
    resources: { interceptors: [requestInterceptor(serveCheckout)] }
});

globalThis.window = dom.window;
globalThis.document = dom.window.document;
for (const k of ["HTMLElement", "HTMLInputElement", "HTMLSelectElement", "HTMLTextAreaElement", "HTMLButtonElement", "HTMLFormElement", "HTMLAnchorElement", "HTMLImageElement", "Element", "Node", "NodeList", "Event", "CustomEvent", "KeyboardEvent", "MouseEvent", "PointerEvent", "DragEvent", "FocusEvent", "InputEvent", "MutationObserver", "DOMParser", "FileReader", "Image", "navigator", "localStorage", "sessionStorage", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "CSS"]) {
    // ALWAYS take jsdom's class: Node ships its own Event/CustomEvent globals,
    // and dispatching a Node-realm Event on a jsdom EventTarget throws.
    if (dom.window[k] !== undefined) {
        try { globalThis[k] = dom.window[k]; } catch {}
    }
}
// A browser's `form.killer` (named access to a form's controls); jsdom has only
// `form.elements.killer`. Reached only when nothing on the chain has that name.
{
    const F = dom.window.HTMLFormElement.prototype;
    const base = Object.getPrototypeOf(F);
    Object.setPrototypeOf(F, new Proxy(base, {
        get(target, key, receiver) {
            if (typeof key === "string" && receiver instanceof dom.window.HTMLFormElement) {
                const named = receiver.elements?.namedItem?.(key);
                if (named) return named;
            }
            return Reflect.get(target, key, receiver);
        }
    }));
    /* AND OVER THE FORM'S OWN ATTRIBUTES, as a browser does (E03, 24.09.2026). A
       form is `[LegacyOverrideBuiltIns]` in the HTML spec, so a control named
       "name" wins over `form.name` - Observe's "describe the find" dialog reads
       `f.name.value` that way. The proxy above is only reached for a key nothing
       on the chain has, and `name` is on the prototype, so jsdom answered with the
       form's own name attribute and the dialog's callback threw here alone. */
    for (const key of ["name", "action", "method", "target", "id", "title"]) {
        const own = Object.getOwnPropertyDescriptor(F, key)
            ?? Object.getOwnPropertyDescriptor(dom.window.HTMLElement.prototype, key)
            ?? Object.getOwnPropertyDescriptor(dom.window.Element.prototype, key);
        if (!own?.get) continue;
        Object.defineProperty(F, key, {
            configurable: true,
            get() { return this.elements?.namedItem?.(key) ?? own.get.call(this); },
            set(value) { own.set?.call(this, value); }
        });
    }
}
if (!globalThis.requestAnimationFrame) {
    globalThis.requestAnimationFrame = fn => setTimeout(() => fn(performance.now()), 16);
    globalThis.cancelAnimationFrame = id => clearTimeout(id);
}
window.matchMedia ??= q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent() { return false; } });
globalThis.matchMedia = window.matchMedia;
window.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
globalThis.ResizeObserver = window.ResizeObserver;
document.fonts ??= { ready: Promise.resolve(), add() {}, load: async () => [], check: () => true };
globalThis.Audio = class { constructor(src) { this.src = src; } play() { return Promise.resolve(); } pause() {} addEventListener() {} removeEventListener() {} load() {} };
globalThis.AudioContext = class { constructor() { this.state = "running"; this.destination = {}; } resume() { return Promise.resolve(); } createGain() { return { connect() {}, gain: { value: 1 } }; } };
window.scrollTo ??= () => {};
// Bare `innerWidth` / `innerHeight` (the module reads them as globals, as a
// browser allows): jsdom keeps them on `window` only.
for (const k of ["innerWidth", "innerHeight", "outerWidth", "outerHeight", "devicePixelRatio", "scrollX", "scrollY"]) {
    if (globalThis[k] === undefined) Object.defineProperty(globalThis, k, { get: () => dom.window[k], configurable: true });
}
/*
 * WINDOW'S OWN LISTENER METHODS, CALLED BARE - a browser's global object IS the
 * window, so `addEventListener("resize", ...)` is `window.addEventListener`.
 * Node's global is not an EventTarget, and jsdom keeps them on `window` only.
 *
 * Measured the day `__errors` started being filled (1.2.56, the ten numbered
 * scenarios): every client threw "addEventListener is not defined" three times
 * at boot, 40 of each across the ten logs - once as an unhandled rejection out
 * of glass.mjs's `observe`, and twice inside the module's own catches, "Could
 * not register the stained glass" (glass.mjs `registerGlass`) and "Could not
 * register the theme" (settings.mjs `watchScreen`). So headless, neither the
 * glass nor the theme ever finished registering, and nobody noticed because the
 * harness only printed the line. The module is right - the suite's R22 lists
 * these three names as ambient for exactly this reason - and the harness was
 * not a browser here.
 */
for (const k of ["addEventListener", "removeEventListener", "dispatchEvent"]) {
    if (globalThis[k] === undefined) globalThis[k] = dom.window[k].bind(dom.window);
}

/* The module's six stylesheets are attached at boot, before the module is imported
   (lib/css.mjs); custom properties are read through the page's own cascade. */
globalThis.getComputedStyle = wrapGetComputedStyle(window);

/* ------------------------------ fetch ------------------------------------ */

globalThis.fetch = async (url, _opts = {}) => {
    const u = String(url);
    const m = u.match(/^\/?modules\/danganronpa-rpg\/(.+?)(\?.*)?$/);
    if (m) {
        const file = path.join(REPO, m[1]);
        if (fs.existsSync(file)) {
            const body = fs.readFileSync(file);
            return {
                ok: true, status: 200, url: u,
                text: async () => body.toString("utf8"),
                json: async () => JSON.parse(body.toString("utf8")),
                arrayBuffer: async () => body.buffer,
                headers: { get: () => null }
            };
        }
        return { ok: false, status: 404, url: u, text: async () => "Not Found", json: async () => { throw new Error("404"); }, headers: { get: () => null } };
    }
    return { ok: false, status: 502, url: u, text: async () => "harness: external fetch blocked", json: async () => { throw new Error("blocked"); }, headers: { get: () => null } };
};

/* --------------------------- IPC bus ------------------------------------- */

let reqSeq = 0;
const pending = new Map();
const bus = {
    op(op) {
        return new Promise((resolve, reject) => {
            const id = `${WHO}-${++reqSeq}`;
            pending.set(id, { resolve, reject });
            send({ t: "op", id, op });
        });
    },
    setSetting(key, value) {
        return new Promise((resolve, reject) => {
            const id = `${WHO}-${++reqSeq}`;
            pending.set(id, { resolve, reject });
            send({ t: "setting", id, key, value });
        });
    },
    socketEmit(channel, args) { send({ t: "socket", channel, args }); },
    userQuery() { return Promise.resolve(undefined); }
};

/* --------------------------- client state -------------------------------- */

const hooks = new HooksImpl(logLine);
globalThis.Hooks = hooks;

globalThis.__notifications = [];
globalThis.__dialogLog = [];
globalThis.__dialogAnswers = [];
globalThis.__missingI18n = new Set();
// `globalThis.__errors` is created at the top of this file, before anything can throw.

/* A legacy key met where no server applies it - a document's updateSource or
   clone, or foundry.utils.mergeObject - is reported to the cluster, which keeps
   every report in one list (cluster.mjs, legacyKeys). */
const reportLegacy = record => send({ t: "legacyKey", ...record });
U.reportLegacyKeysTo(reportLegacy);

const ctx = {
    bus,
    hooks: () => hooks,
    gameRef: () => game,
    userId: () => game.userId,
    log: logLine,
    reportLegacy,
    classes: null
};
const classes = buildDocumentClasses(ctx);
const PIXI = buildPIXI();
globalThis.PIXI = PIXI;
const apps = buildApplications(ctx);

/* ------------------------------ i18n ------------------------------------- */

// Foundry expands dotted keys ("step.name" inside "Season") when it merges a
// language file, so a lookup by path finds them. Mirror that, or the suite's
// i18n coverage test fails on keys that resolve fine in the real client.
const enJson = U.expandObject(JSON.parse(fs.readFileSync(path.join(REPO, "lang/en.json"), "utf8")));
const i18n = {
    lang: process.env.DRPG_LANG ?? "en",
    translations: enJson,
    localize(key) {
        const v = U.getProperty(this.translations, key);
        if (typeof v === "string") return v;
        globalThis.__missingI18n.add(key);
        return key;
    },
    format(key, data = {}) {
        let s = this.localize(key);
        for (const [k, v] of Object.entries(data)) s = s.replaceAll(`{${k}}`, String(v));
        return s;
    },
    has(key) { return typeof U.getProperty(this.translations, key) === "string"; }
};

/* ---------------------------- settings ----------------------------------- */

const settingDefs = new Map();   // "ns.key" -> def
const worldValues = new Map();   // "ns.key" -> value (synced)
/*
 * CLIENT SETTINGS LIVE IN THIS BROWSER'S localStorage, AS FOUNDRY KEEPS THEM (E30,
 * 24.09.2026). They were a Map beside jsdom's localStorage, so two things could not
 * be modelled: `game.settings.storage.get("client")` is localStorage in Foundry, and
 * the suite's world dump reads it for keys under the module's name that no setting
 * claims; and a test that cleans up after itself by removing its key from
 * localStorage (the held-settings scenario) removed it from a store the settings did
 * not use. Values are JSON, as Foundry writes them.
 */
const clientStore = globalThis.localStorage;
const clientValues = {
    has: key => clientStore.getItem(key) !== null,
    get: key => JSON.parse(clientStore.getItem(key)),
    set: (key, value) => clientStore.setItem(key, JSON.stringify(value ?? null)),
    entries: () => Array.from({ length: clientStore.length }, (_, i) => clientStore.key(i))
        .map(key => { try { return [key, JSON.parse(clientStore.getItem(key))]; } catch { return [key, clientStore.getItem(key)]; } })
};

/** Foreign namespaces whose settings the system/other modules would register. */
const FOREIGN_SETTING_DEFAULTS = {
    "daggerheart.Countdowns": { scope: "world", default: { countdowns: {} } },
    "daggerheart.Appearance": { scope: "world", default: {} },
    /* Daggerheart's own default, every field (lib/daggerheart.mjs). It was
       `{ hope: true }`, a shape no Daggerheart has: reroll.mjs reads `hopeFear`
       off it. The world the harness seeds states its own value (lib/seed.mjs). */
    "daggerheart.Automation": { scope: "world", default: AUTOMATION_DEFAULT },
    /* Fear and its ceiling, which Daggerheart's relay writes and reads (E03): the
       security scenario sends a player's Fear step through the real relay. */
    "daggerheart.ResourcesFear": { scope: "world", default: 0 },
    "daggerheart.Homebrew": { scope: "world", default: { maxFear: 12 } },
    "dice-so-nice.Appearance": { scope: "client", default: {} },
    "core.rollMode": { scope: "client", default: "publicroll" },
    /* How loud playlists are ON THIS BROWSER. Foundry's own, client-scoped, and
       the module reads and writes it in two places: the Sound panel's Music
       slider proxies it rather than keeping a second volume beside it
       (`SFX_SLIDERS.music.proxiesFoundryMusic`), and the murder music ducks it
       while the incident has this client. Neither path could be exercised
       headless until the shim modelled it - the first assertion written against
       the duck died on "Setting core.globalPlaylistVolume is not registered". */
    "core.globalPlaylistVolume": { scope: "client", default: 1 }
};

/*
 * ANOTHER MODULE'S OWN SETTING, REGISTERED THE WAY THAT MODULE DOES (E27, 24.09.2026).
 * Isometric Perspective registers `showWelcome` in its `init` - client-scoped,
 * shown in Configure Settings, on by default - and reads it in its `ready`.
 * enforced.mjs holds it off for the table; without the entry here, "is it
 * registered" answered no and the held-settings test could only skip.
 */
settingDefs.set("isometric-perspective.showWelcome", {
    name: "Show Welcome Screen", scope: "client", config: true, type: Boolean, default: true
});
/* ...and READ the way that module does: once, in its `ready`, which is what decides
   whether the window opens. Recorded so 15-held can ask what Isometric Perspective
   would have seen at that moment - the stage's real risk is the value arriving after
   it, which a reading taken later cannot tell apart (the review of E27 moved the
   write into `ready` and every other check still passed). Registered here, before
   the module is imported, as a module earlier in the load order would be. */
hooks.once("ready", () => {
    try { globalThis.__isoWelcomeAtReady = settingsApi.get("isometric-perspective", "showWelcome"); }
    catch (err) { globalThis.__isoWelcomeAtReady = `unreadable: ${err.message}`; }
});

const settingsApi = {
    register(ns, key, def) { settingDefs.set(`${ns}.${key}`, def); },
    registerMenu() {},
    get settings() { return settingDefs; },
    get(ns, key) {
        const full = `${ns}.${key}`;
        let def = settingDefs.get(full);
        if (!def && FOREIGN_SETTING_DEFAULTS[full]) {
            def = FOREIGN_SETTING_DEFAULTS[full];
            settingDefs.set(full, def);
            logLine(`(harness) auto-registered foreign setting ${full}`);
        }
        if (!def) throw new Error(`Setting ${full} is not registered`);
        const store = def.scope === "world" ? worldValues : clientValues;
        if (store.has(full)) {
            const raw = store.get(full);
            return coerce(def, raw);
        }
        return U.deepClone(def.default);
    },
    async set(ns, key, value) {
        const full = `${ns}.${key}`;
        let def = settingDefs.get(full);
        /* THE SAME FALLBACK `get` HAS, and it was missing here only because
           nothing had written a foreign setting before. `core.globalPlaylist
           Volume` is written by the module (the Music slider, and the murder
           music's duck), so a shim that can read a foreign setting but not
           write one turned every such write into a thrown scenario. */
        if (!def && FOREIGN_SETTING_DEFAULTS[full]) {
            def = FOREIGN_SETTING_DEFAULTS[full];
            settingDefs.set(full, def);
            logLine(`(harness) auto-registered foreign setting ${full}`);
        }
        if (!def) throw new Error(`Setting ${full} is not registered`);
        if (def.scope === "world") {
            await bus.setSetting(full, JSON.parse(JSON.stringify(value ?? null)));
        } else {
            clientValues.set(full, JSON.parse(JSON.stringify(value ?? null)));
            try { def.onChange?.(value); } catch (err) { logLine(`setting onChange ${full}: ${err.stack}`); recordError(`setting onChange ${full}`, err); }
            hooks.callAll("clientSettingChanged", full, value);
        }
        return value;
    },
    storage: { get: scope => (scope === "world" ? worldValues : clientStore) }
};
function coerce(def, raw) {
    if (def.type === Number) return Number(raw);
    if (def.type === Boolean) return typeof raw === "string" ? raw === "true" : !!raw;
    if (def.type === String) return raw == null ? raw : String(raw);
    return U.deepClone(raw);
}

/* --------------------------- collections --------------------------------- */

const worldColls = new Map(); // documentName -> Collection

function coll(name) {
    if (!worldColls.has(name)) {
        const c = new Collection();
        c._documentName = name;
        worldColls.set(name, c);
    }
    return worldColls.get(name);
}

/* ------------------------------ game ------------------------------------- */

const moduleManifest = JSON.parse(fs.readFileSync(path.join(REPO, "module.json"), "utf8"));

const modulesMap = new Map();
function addModule(id, extra = {}) {
    modulesMap.set(id, { id, active: true, title: extra.title ?? id, version: extra.version ?? "1.0.0", esmodules: [], flags: {}, ...extra });
}
/* Foundry's, Daggerheart's and the companions' versions, each read with where it
   came from (lib/versions.mjs, E30); the cluster writes the same reading into
   every results file as `environment`. */
const versions = readVersions(REPO);
const COMPANION_TITLES = { "dice-so-nice": "Dice So Nice!", "isometric-perspective": "Isometric Perspective", "avclient-livekit": "LiveKit AV Client" };
addModule(MODULE_ID, { title: moduleManifest.title, version: moduleManifest.version, relationships: moduleManifest.relationships, socket: true });
for (const { id, version } of versions.modules) addModule(id, { title: COMPANION_TITLES[id] ?? id, version });

class DualityRollMock {
    /* The class the module finds at game.system.api.dice.DualityRoll. Its
       resource step is Daggerheart 2.6.5's own (lib/daggerheart.mjs), called
       through this class so critical.mjs's patch of it is what runs. */
    get advantageNumber() { return this._adv ?? 1; }
    set advantageNumber(v) { this._adv = v; }
    applyAdvantage(count = 1) { this._adv = count; return `${count}d6kh`; }
    static applyAdvantage(count = 1) { return `${count}d6kh`; }

    static async addDualityResourceUpdates(config) {
        return addDualityResourceUpdates(config);
    }
}

const game = {
    userId: null,
    user: null,
    users: coll("User"),
    actors: coll("Actor"),
    items: coll("Item"),
    scenes: coll("Scene"),
    messages: coll("ChatMessage"),
    tables: coll("RollTable"),
    playlists: coll("Playlist"),
    macros: coll("Macro"),
    journal: coll("JournalEntry"),
    folders: coll("Folder"),
    collections: worldColls,
    packs: { get: () => undefined, filter: () => [], contents: [], find: () => undefined },
    settings: settingsApi,
    i18n,
    modules: modulesMap,
    system: {
        id: "daggerheart", version: versions.system.version, title: "Daggerheart",
        api: {
            dice: { DualityRoll: DualityRollMock },
            // What Daggerheart's relay calls for a save (saveField.mjs, 2.10.5):
            // the same one write, so the relay copied into lib/dh-relay.mjs runs as is.
            fields: { ActionFields: { SaveField: { updateSaveMessage: async (result, message, targetId) => {
                if (!result) return;
                await game.messages.get(message?._id ?? message?.id)?.update({
                    [`system.targetSaves.${targetId}`]: { value: result.roll.total, isCritical: result.roll.isCritical }
                });
            } } } }
        },
        // `game.system.settings` as Daggerheart 2.10.5 builds it from its own settings, kept
        // in step with them (2.6.5 has none; relay-guard.mjs reads either). `automation` is
        // the setting itself, so the stated `hopeFear` below and the one read here agree.
        settings: {
            homebrew: { maxFear: 12 },
            get automation() { return settingsApi.get("daggerheart", "Automation"); }
        }
    },
    world: { id: "drpg-audit-world", title: "DRPG Audit World" },
    version: versions.foundry.version,
    release: { generation: versions.foundry.generation, build: versions.foundry.build },
    ready: false,
    paused: false,
    togglePause(state) { game.paused = state ?? !game.paused; hooks.callAll("pauseGame", game.paused); },
    socket: {
        _handlers: new Map(),
        /* The three calls of socket.io's own client that the relay guard uses
           (E03, relay-guard.mjs): read a channel's listeners, take one off, and
           listen to everything before anybody else. Same shapes as
           component-emitter and socket.io-client v4 - `listeners` hands back
           the live array, which is why the guard copies it. */
        _any: [],
        on(channel, fn) {
            if (!this._handlers.has(channel)) this._handlers.set(channel, []);
            this._handlers.get(channel).push(fn);
        },
        listeners(channel) { return this._handlers.get(channel) ?? []; },
        off(channel, fn) {
            const list = this._handlers.get(channel);
            const at = list ? list.indexOf(fn) : -1;
            if (at >= 0) list.splice(at, 1);
            return this;
        },
        prependAny(fn) { this._any.unshift(fn); return this; },
        emit(channel, ...args) { bus.socketEmit(channel, args); }
    },
    audio: { play: async () => ({ stop() {} }), context: new globalThis.AudioContext(), unlock: Promise.resolve() },
    video: { render: () => {} },
    webrtc: {
        mode: 0,
        client: { isVoiceEnabled: false, settings: {}, disconnect: async () => {}, connect: async () => {} },
        settings: {
            world: { mode: 0 }, client: { voice: { mode: "always" } }, activity: {},
            get(scope, key) { return U.getProperty(this[scope], key); },
            set() {}
        },
        render() {}
    },
    dice3d: {
        showForRoll: async () => true,
        addSystem() {}, addColorset() {}, addDicePreset() {},
        waitFor3DAnimationByMessageID: async () => true
    },
    keybindings: { register() {}, get: () => [] },
    tooltip: { activate() {}, deactivate() {} },
    time: { worldTime: 0, advance: async () => {} },
    canvas: null,
    drpg: undefined,
    data: { version: versions.foundry.version }
};
globalThis.game = game;

/*
 * THE HARNESS'S OWN READING OF THIS CLIENT'S WORLD (E30, 24.09.2026). The suite's
 * worldDump judges whether a run changed the world; this is the oracle it is
 * checked against in 01-runtests, read straight from the stores the shim keeps -
 * world settings, this browser's client settings, every document's source - and
 * so independent of the dump's rules and of the module.
 */
globalThis.__harnessWorldState = () => JSON.parse(JSON.stringify({
    world: Object.fromEntries(worldValues),
    client: Object.fromEntries(clientValues.entries()),
    docs: Object.fromEntries([...worldColls].map(([name, c]) => [name, c.contents.map(d => d.toObject())])),
    paused: game.paused
}));

/*
 * DAGGERHEART'S TRAIT ROLL, IN 2.6.5'S ORDER (E30, 24.09.2026; lib/daggerheart.mjs).
 *
 * `rollTrait` builds the config the way actor.mjs does - an action unless the
 * options say otherwise - and `diceRoll` stamps the roll's actor, data and its
 * own resource map. The card comes first and the resource step after it, as
 * `DualityRoll.buildPost` has them, and nothing is committed: the caller does
 * that, as the sheet's trait button and this module's `commitResources` do. The
 * dice are the harness's: random, or the faces in globalThis.__forceRoll =
 * {hope, fear}. The dialog is not modelled; game.drpg.suiteRolling asks for none.
 */
classes.Actor.prototype.rollTrait = async function rollTrait(traitKey, options = {}) {
    return this.diceRoll({ roll: { trait: traitKey, type: "trait" }, hasRoll: true, actionType: "action", ...options });
};

/* actor.mjs `modifyResource` (lib/daggerheart.mjs): a GM writes, a player asks the GM relay (E30, G9). */
classes.Actor.prototype.modifyResource = function (resources) { return modifyResource(this, resources); };

classes.Actor.prototype.diceRoll = async function diceRoll(config) {
    config.source = { ...(config.source ?? {}), actor: this.uuid };
    config.data = this.getRollData();
    config.resourceUpdates = new ResourceUpdateMap(this);

    const traitKey = config.roll?.trait;
    const forced = globalThis.__forceRoll;
    const hope = forced?.hope ?? 1 + Math.floor(Math.random() * 12);
    const fear = forced?.fear ?? 1 + Math.floor(Math.random() * 12);
    const mod = Number(this.system?.traits?.[traitKey]?.value ?? 0);
    const total = hope + fear + mod + Number(config.bonus ?? 0);
    const isCritical = hope === fear;
    const duality = isCritical ? 0 : (hope > fear ? 1 : -1);

    const roll = new RollImpl(`1d12 + 1d12 + ${mod}`);
    roll.total = total;
    roll._evaluated = true;
    roll.isCritical = isCritical;
    roll.result = { duality, total };
    roll.hope = { value: hope, total: hope };
    roll.fear = { value: fear, total: fear };
    roll.dice = [
        { faces: 12, number: 1, total: hope, results: [{ result: hope, active: true }] },
        { faces: 12, number: 1, total: fear, results: [{ result: fear, active: true }] }
    ];
    roll.terms = [
        { constructor: { name: "HopeDie" }, total: hope },
        { constructor: { name: "FearDie" }, total: fear },
        { constructor: { name: "NumericTerm" }, total: mod }
    ];
    config.actor = this;
    config.roll = roll;
    config.total = total;
    config.costs = config.costs ?? [];

    // A chat card faithful enough for despair-award.readDuality: two d12 dice in
    // Hope-then-Fear order, plus the actionType the reaction guard reads.
    const rollJson = {
        class: "DualityRoll", formula: roll.formula, total, evaluated: true,
        dHope: { total: hope }, dFear: { total: fear },
        dice: [{ faces: 12, total: hope, results: [{ result: hope, active: true }] },
               { faces: 12, total: fear, results: [{ result: fear, active: true }] }],
        options: { actionType: config.actionType }
    };
    config.message = await classes.ChatMessage.create({
        author: game.userId,
        speaker: classes.ChatMessage.getSpeaker({ actor: this }),
        content: `<div class="dice-roll">Duality: ${total}</div>`,
        rolls: [rollJson],
        system: { roll: rollJson },
        flags: {}
    });
    await game.system.api.dice.DualityRoll.addDualityResourceUpdates(config);
    return config;
};

/* ------------------------------ canvas ----------------------------------- */

const tokenWrappers = new Map();
const canvas = {
    ready: false,
    rendered: false,
    scene: null,
    initialized: true,
    stage: new PIXI.Container(),
    interface: new PIXI.Container(),
    primary: new PIXI.Container(),
    effects: { visibility: { refresh() {} }, illumination: {} },
    perception: { update() {}, refresh() {} },
    hud: { render() {}, align() {} },
    app: { ticker: new PIXI.Ticker(), renderer: { screen: { width: 1920, height: 1080 }, view: {} } },
    grid: { size: 100, distance: 5, type: 1, units: "ft", measurePath: p => ({ distance: 0, spaces: 0 }) },
    get dimensions() { return this.scene?.dimensions ?? { width: 4000, height: 3000, size: 100, sceneX: 0, sceneY: 0, sceneWidth: 4000, sceneHeight: 3000, rect: { x: 0, y: 0, width: 4000, height: 3000 } }; },
    tokens: {
        controlled: [],
        get placeables() { return (canvas.scene?.tokens?.contents ?? []).map(t => canvas.tokens._wrap(t)); },
        get(id) { const t = canvas.scene?.tokens?.get(id); return t ? canvas.tokens._wrap(t) : undefined; },
        _wrap(tokenDoc) {
            let w = tokenWrappers.get(tokenDoc.id);
            if (!w) {
                w = {
                    get id() { return tokenDoc.id; },
                    document: tokenDoc,
                    get actor() { return tokenDoc.actor; },
                    get name() { return tokenDoc._source.name ?? tokenDoc.actor?.name ?? ""; },
                    get x() { return tokenDoc.x; }, get y() { return tokenDoc.y; },
                    get w() { return (tokenDoc.width ?? 1) * 100; }, get h() { return (tokenDoc.height ?? 1) * 100; },
                    get center() { return tokenDoc.center; },
                    get visible() { return !tokenDoc.hidden || game.user.isGM; },
                    get controlled() { return canvas.tokens.controlled.includes(w); },
                    control() { if (!canvas.tokens.controlled.includes(w)) canvas.tokens.controlled.push(w); return true; },
                    release() { const i = canvas.tokens.controlled.indexOf(w); if (i >= 0) canvas.tokens.controlled.splice(i, 1); return true; },
                    refresh() { return w; },
                    destroyed: false,
                    mesh: new PIXI.Sprite(),
                    border: new PIXI.Graphics(),
                    tooltip: new PIXI.Text(""),
                    children: [],
                    addChild(c) { this.children.push(c); return c; },
                    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; },
                    getChildByName(n) { return this.children.find(c => c.name === n) ?? null; },
                    sortableChildren: true
                };
                tokenWrappers.set(tokenDoc.id, w);
            }
            return w;
        }
    },
    regions: { get placeables() { return (canvas.scene?.regions?.contents ?? []).map(r => ({ id: r.id, document: r })); } },
    walls: { placeables: [] },
    templates: { placeables: [] },
    notes: { placeables: [] },
    drawings: { placeables: [] },
    lighting: { placeables: [] },
    sounds: { placeables: [] },
    animatePan: async () => {}, pan() {}, draw: async () => canvas,
    fog: { configured: false }
};
globalThis.canvas = canvas;
game.canvas = canvas;

// Foundry's WorldCollection getters the mock's plain Collection lacks.
Object.defineProperty(game.scenes, "active", { get: () => game.scenes.find(s => s._source.active) });
Object.defineProperty(game.scenes, "viewed", { get: () => canvas.scene });

/* -------------------------------- ui ------------------------------------- */

function record(level) {
    return (msg, opts = {}) => {
        globalThis.__notifications.push({ level, msg: String(msg), opts, at: Date.now() });
        logLine(`[notify:${level}] ${msg}`);
        return globalThis.__notifications.length;
    };
}
globalThis.ui = {
    notifications: { info: record("info"), warn: record("warn"), error: record("error"), notify: record("notify"), remove() {}, clear() {} },
    // Daggerheart's Fear tracker, as far as modifyResource uses it (lib/daggerheart.mjs).
    resources: { updateFear },
    chat: { element: document.querySelector("#chat"), scrollBottom() {}, render() {}, postOne() {}, collapsed: false },
    sidebar: { element: document.querySelector("#sidebar"), tabs: {}, render() {}, expand() {}, collapse() {}, activateTab() {} },
    windows: {},
    players: { render() {}, element: document.querySelector("#players") },
    controls: { render() {}, controls: [], activeControl: "token" },
    nav: { render() {}, element: document.querySelector("#navigation") },
    hotbar: { render() {}, element: document.querySelector("#hotbar") },
    pause: { render() {} },
    activeWindow: null
};

/* ------------------------------ CONFIG ----------------------------------- */

globalThis.CONFIG = {
    debug: { hooks: false },
    // Foundry's own selection colours (CONTROLLED is its orange).
    Canvas: { dispositionColors: { CONTROLLED: 0xFF9829 } },
    DH: {
        id: "daggerheart",
        // Built as resourceConfig.mjs builds it (lib/daggerheart.mjs). It was `{ character: { custom: {} } }`,
        // and resources.mjs could not register the Actions resource on any client (E30).
        RESOURCE: resourceTables(),
        GENERAL: {},
        // Daggerheart's setting keys and hook names, as its config.mjs defines them.
        SETTINGS: { gameSettings: {
            Countdowns: "Countdowns", Automation: "Automation", Homebrew: "Homebrew",
            Resources: { Fear: "ResourcesFear" }
        } },
        HOOKS: { hooksConfig: {
            downtimeTrigger: "DhDowntimeTrigger", tagTeamStart: "DhTagTeamStart", groupRollStart: "DhGroupRollStart"
        } }
    },
    statusEffects: [
        { id: "dead", name: "Dead", img: "icons/svg/skull.svg" },
        { id: "unconscious", name: "Unconscious", img: "icons/svg/unconscious.svg" },
        { id: "sleep", name: "Sleep", img: "icons/svg/sleep.svg" },
        { id: "blind", name: "Blind", img: "icons/svg/blind.svg" }
    ],
    Actor: { documentClass: classes.Actor, typeLabels: { character: "Character", npc: "NPC" }, dataModels: {} },
    Item: { documentClass: classes.Item, typeLabels: {}, dataModels: {} },
    Token: { documentClass: classes.Token, objectClass: Object },
    Scene: { documentClass: classes.Scene },
    ChatMessage: { documentClass: classes.ChatMessage, template: "" },
    User: { documentClass: classes.User },
    RollTable: { documentClass: classes.RollTable },
    Playlist: { documentClass: classes.Playlist },
    Macro: { documentClass: classes.Macro },
    ActiveEffect: { documentClass: classes.ActiveEffect },
    Region: { documentClass: classes.Region },
    Dice: { rolls: [RollImpl], types: [], terms: {} },
    queries: {},
    canvasTextStyle: {},
    fontDefinitions: {},
    sounds: {},
    TextEditor: {}
};

/* ------------------------- foundry namespace ----------------------------- */

const CONST = {
    USER_ROLES: { NONE: 0, PLAYER: 1, TRUSTED: 2, ASSISTANT: 3, GAMEMASTER: 4 },
    DOCUMENT_OWNERSHIP_LEVELS: { INHERIT: -1, NONE: 0, LIMITED: 1, OBSERVER: 2, OWNER: 3 },
    TOKEN_DISPOSITIONS: { SECRET: -2, HOSTILE: -1, NEUTRAL: 0, FRIENDLY: 1 },
    CHAT_MESSAGE_STYLES: { OTHER: 0, OOC: 1, IC: 2, EMOTE: 3 },
    DICE_ROLL_MODES: { PUBLIC: "publicroll", PRIVATE: "gmroll", BLIND: "blindroll", SELF: "selfroll" },
    REGION_EVENTS: { TOKEN_ENTER: "tokenEnter", TOKEN_EXIT: "tokenExit", TOKEN_MOVE_IN: "tokenMoveIn", TOKEN_MOVE_OUT: "tokenMoveOut" },
    KEYBINDING_PRECEDENCE: { PRIORITY: 0, NORMAL: 1, DEFERRED: 2 }
};
globalThis.CONST = CONST;

globalThis.foundry = {
    CONST,
    utils: {
        ...U,
        Color: U.Color,
        fetchWithTimeout: globalThis.fetch,
        fromUuid: uuid => globalThis.fromUuid(uuid),
        benchmark: async fn => fn()
    },
    applications: {
        api: {
            ApplicationV2: apps.ApplicationV2,
            DialogV2: apps.DialogV2,
            HandlebarsApplicationMixin: apps.HandlebarsApplicationMixin
        },
        apps: { FilePicker: { implementation: apps.FilePickerImpl } },
        handlebars: { renderTemplate: async () => "", loadTemplates: async () => [] },
        ux: {
            TextEditor: { implementation: { enrichHTML: async s => s } },
            ContextMenu: class { constructor() {} render() {} }
        },
        sidebar: { tabs: {} },
        sheets: {
            TokenConfig: class TokenConfig {},
            PrototypeTokenConfig: class PrototypeTokenConfig {},
            ActorSheetV2: class ActorSheetV2 {},
            ItemSheetV2: class ItemSheetV2 {}
        },
        instances: new Map()
    },
    audio: { AudioHelper: { play: async () => ({ stop() {} }), preloadSound: async () => {} } },
    av: { AVSettings: { AV_MODES: { DISABLED: 0, AUDIO: 1, VIDEO: 2, AUDIO_VIDEO: 3 } } },
    canvas: {
        // Foundry's drag rectangle, with its orange written in, as core has it.
        layers: { ControlsLayer: class ControlsLayer { drawSelect({ x, y, width, height }) { this.select.clear().lineStyle(3, 0xFF9829, 0.9).drawRect(x, y, width, height); } } },
        animation: { animateLinear: async () => {} },
        /* The group whose `createScrollingText` no-scrolling-text.mjs wraps. Headless it draws
           nothing and answers null, what the real one answers when it declines to draw. */
        groups: { InterfaceCanvasGroup: class InterfaceCanvasGroup { createScrollingText() { return null; } } },
        loadTexture: async p => {
            const rel = String(p).replace(/^\/?modules\/danganronpa-rpg\//, "");
            const file = path.join(REPO, rel);
            return fs.existsSync(file) ? new PIXI.Texture(p) : null;
        }
    },
    documents: {},
    dice: { Roll: RollImpl, terms: {} },
    abstract: { DataModel: class {}, TypeDataModel: class {} },
    // The operators as lib/operators.mjs models them (E30); `_del` and `_replace` below.
    data: {
        fields: {}, validators: { isValidId: s => /^[A-Za-z0-9]{16}$/.test(s) },
        operators: { DataFieldOperator, ForcedDeletion, ForcedReplacement }
    },
    helpers: { media: { ImageHelper: {} } },
    packages: {}
};

/* The two globals Daggerheart deletes and replaces with (both of its builds
   declare them in eslint.config.mjs). A value and a function here; whether v14's
   `_del` is also callable is LIVE-E30-02 (lib/operators.mjs). */
globalThis._del = ForcedDeletion.create();
globalThis._replace = value => ForcedReplacement.create(value);

globalThis.ChatMessage = classes.ChatMessage;
globalThis.Actor = classes.Actor;
globalThis.Item = classes.Item;
globalThis.Scene = classes.Scene;
globalThis.TokenDocument = classes.Token;
globalThis.User = classes.User;
globalThis.RollTable = classes.RollTable;
globalThis.Playlist = classes.Playlist;
globalThis.Macro = classes.Macro;
globalThis.JournalEntry = classes.JournalEntry;
globalThis.ActiveEffect = classes.ActiveEffect;
globalThis.Roll = RollImpl;
globalThis.Handlebars = { compile: () => () => "", registerHelper() {}, registerPartial() {} };
globalThis.TextEditor = { enrichHTML: async s => s };
globalThis.renderTemplate = async () => "";
globalThis.loadTemplates = async () => [];
globalThis.getDocumentClass = name => classes[name] ?? classes.BaseDocument;
globalThis.fromUuidSync = uuid => {
    const parts = U.fromUuidParts(uuid);
    let doc = null;
    for (let i = 0; i < parts.length; i += 2) {
        const [dn, id] = [parts[i], parts[i + 1]];
        if (!doc) doc = coll(dn)?.get(id) ?? null;
        else {
            const embKey = Object.entries({ Actor: { Item: "items" }, Scene: { Token: "tokens", Region: "regions" } }[doc.documentName] ?? {}).find(([n]) => n === dn)?.[1];
            doc = doc._collections?.[embKey ?? dn.toLowerCase() + "s"]?.get(id) ?? null;
        }
        if (!doc) return null;
    }
    return doc;
};
globalThis.fromUuid = async uuid => globalThis.fromUuidSync(uuid);

/* ------------------------ world sync (mirror) ----------------------------- */

function instantiate(collName, data) {
    const cls = classes[collName] ?? classes.BaseDocument;
    return new cls(data);
}

function applySnapshot(snap) {
    for (const [collName, docs] of Object.entries(snap.collections)) {
        const c = coll(collName);
        c.clear();
        for (const d of docs) {
            const doc = instantiate(collName, d);
            c.set(doc.id, doc);
        }
    }
    for (const [k, v] of Object.entries(snap.settings)) worldValues.set(k, v);
    // users wiring
    game.user = game.users.get(snap.you);
    game.userId = snap.you;
    const active = game.scenes.find(s => s.active);
    if (active) { canvas.scene = active; }
}

function findEmbKey(parentName, embName) {
    const map = { Actor: { Item: "items", ActiveEffect: "effects" }, Scene: { Token: "tokens", Region: "regions", Wall: "walls" }, RollTable: { TableResult: "results" }, Playlist: { PlaylistSound: "sounds" }, Item: { ActiveEffect: "effects" } };
    return map[parentName]?.[embName];
}

function applyRemote(msg) {
    const { action, collName, userId, options = {} } = msg;
    if (action === "create") {
        const c = coll(collName);
        const docs = msg.docs.map(d => instantiate(collName, d));
        for (const doc of docs) c.set(doc.id, doc);
        if (!options.noHook) for (const doc of docs) hooks.callAll(`create${collName}`, doc, options, userId);
        return;
    }
    /* The cluster has applied this write and reported any legacy key in it; the
       client applies the same write the same way (futil.mjs applyUpdate) and says
       nothing more. A hook is handed the operators as instances (lib/operators.mjs). */
    if (action === "update") {
        const doc = coll(collName).get(msg.docId);
        if (!doc) return;
        U.applyDocChanges(collName, doc._source, msg.changes);
        // refresh embedded collections if raw arrays were replaced wholesale
        rebuildEmbedded(doc);
        if (!options.noHook) hooks.callAll(`update${collName}`, doc, revive(U.expandObject(U.deepClone(msg.changes))), options, userId);
        return;
    }
    if (action === "delete") {
        const c = coll(collName);
        const doc = c.get(msg.docId);
        if (!doc) return;
        c.delete(msg.docId);
        if (!options.noHook) hooks.callAll(`delete${collName}`, doc, options, userId);
        return;
    }
    if (action.startsWith("embedded-")) {
        const parent = coll(collName).get(msg.docId);
        if (!parent) return;
        const embKey = findEmbKey(collName, msg.embeddedName);
        const cls = classes[msg.embeddedName] ?? classes.BaseDocument;
        const kind = action.slice("embedded-".length);
        if (kind === "create") {
            parent._source[embKey] = parent._source[embKey] ?? [];
            for (const d of msg.docs) {
                parent._source[embKey].push(U.deepClone(d));
                const doc = new cls(d, { parent });
                parent._collections[embKey]?.set(doc.id, doc);
                hooks.callAll(`create${msg.embeddedName}`, doc, options, userId);
            }
        } else if (kind === "update") {
            for (const u of msg.updates) {
                const raw = (parent._source[embKey] ?? []).find(d => d._id === u._id);
                const doc = parent._collections[embKey]?.get(u._id);
                if (!raw || !doc) continue;
                const { _id, ...changes } = u;
                U.applyUpdate(raw, changes);
                // One object, not two, once a parent's update has rebuilt the collection (rebuildEmbedded).
                if (doc._source !== raw) U.applyUpdate(doc._source, changes);
                hooks.callAll(`update${msg.embeddedName}`, doc, revive(U.expandObject(U.deepClone(changes))), options, userId);
            }
        } else if (kind === "delete") {
            for (const id of msg.ids) {
                const doc = parent._collections[embKey]?.get(id);
                parent._source[embKey] = (parent._source[embKey] ?? []).filter(d => d._id !== id);
                parent._collections[embKey]?.delete(id);
                if (doc) hooks.callAll(`delete${msg.embeddedName}`, doc, options, userId);
            }
        }
    }
}

function rebuildEmbedded(doc) {
    const emb = { Actor: { Item: "items", ActiveEffect: "effects" }, Scene: { Token: "tokens", Region: "regions", Wall: "walls" }, RollTable: { TableResult: "results" }, Playlist: { PlaylistSound: "sounds" } }[doc.documentName];
    if (!emb) return;
    for (const [docName, key] of Object.entries(emb)) {
        const raw = doc._source[key];
        if (!Array.isArray(raw)) continue;
        const c = doc._collections[key];
        const cls = classes[docName] ?? classes.BaseDocument;
        const seen = new Set();
        for (const d of raw) {
            seen.add(d._id);
            const existing = c.get(d._id);
            if (existing) existing._source = d;
            else c.set(d._id, new cls(d, { parent: doc }));
        }
        for (const id of [...c.keys()]) if (!seen.has(id)) c.delete(id);
    }
}

/* --------------------------- message loop --------------------------------- */

let booted = false;

process.on("message", async msg => {
    try {
        switch (msg.t) {
            case "snapshot": {
                applySnapshot(msg);
                if (!booted) { booted = true; await boot(); }
                break;
            }
            case "ack": {
                const p = pending.get(msg.id);
                if (p) { pending.delete(msg.id); msg.ok ? p.resolve(msg.result) : p.reject(new Error(msg.error)); }
                break;
            }
            case "apply": {
                applyRemote(msg);
                break;
            }
            case "settingApplied": {
                worldValues.set(msg.key, msg.value);
                const def = settingDefs.get(msg.key);
                if (def) { try { def.onChange?.(coerce(def, msg.value)); } catch (err) { logLine(`setting onChange ${msg.key}: ${err.stack}`); recordError(`setting onChange ${msg.key}`, err); } }
                hooks.callAll("updateSetting", { key: msg.key, value: msg.value }, {}, msg.userId);
                break;
            }
            case "socketMsg": {
                // Foundry hands a module socket handler `(payload, senderId)`. The
                // emit's options (`{ recipients }`) are for the server, not the handler.
                for (const fn of game.socket._any) {
                    try { fn(msg.channel, ...(msg.args ?? []).slice(0, 1), msg.senderId); } catch (err) {
                        recordError(`socket any-listener ${msg.channel}`, err);
                    }
                }
                const handlers = [...(game.socket._handlers.get(msg.channel) ?? [])];
                for (const fn of handlers) {
                    try { await fn(msg.args?.[0], msg.senderId); } catch (err) {
                        logLine(`socket handler ${msg.channel}: ${err.stack}`);
                        recordError(`socket handler ${msg.channel} (${msg.args?.[0]?.action ?? "?"})`, err);
                    }
                }
                break;
            }
            case "userActivity": {
                // Another client left (cluster.mjs `disconnect`): this browser learns it the
                // way the module listens for it, `userConnected`. v14's flow is LIVE-E30-05.
                const user = game.users.get(msg.userId);
                if (user) {
                    user._source.active = Boolean(msg.active);
                    hooks.callAll("userConnected", user, Boolean(msg.active));
                }
                break;
            }
            case "eval": {
                let ok = true, value;
                try {
                    value = await (0, eval)(`(async () => { ${msg.code} })()`);
                } catch (err) { ok = false; value = `${err?.stack ?? err}`; }
                send({ t: "evalResult", id: msg.id, ok, value: safeJson(value) });
                break;
            }
            case "shutdown": {
                // The peak memory of this client's whole life, for the results file
                // (cluster.mjs, PEAK MEMORY). The exit waits for send's callback:
                // Node documents that process.exit() does not wait for pending writes.
                const bye = { t: "bye", maxRSS: process.resourceUsage().maxRSS };
                if (!process.send) process.exit(0);
                process.send(bye, () => process.exit(0));
                break;
            }
        }
    } catch (err) {
        // The client missed whatever this message carried, so everything it
        // reads afterwards may be wrong: recorded, not only printed.
        logLine(`message loop error on ${msg.t}: ${err.stack}`);
        recordError(`harness message loop (${msg.t})`, err);
    }
});

function safeJson(v) {
    const seen = new WeakSet();
    try {
        return JSON.parse(JSON.stringify(v ?? null, (k, val) => {
            if (typeof val === "bigint") return String(val);
            if (typeof val === "function") return `[fn ${val.name}]`;
            if (val instanceof Error) return { error: val.message, stack: val.stack };
            if (val && typeof val === "object") {
                if (seen.has(val)) return "[circular]";
                seen.add(val);
                if (val._source) return { _doc: val.documentName ?? true, id: val._source._id, name: val._source.name };
            }
            return val;
        }));
    } catch (err) { return { unserializable: String(v) }; }
}

/* ------------------------------- boot ------------------------------------- */

let stylesheets = null;

async function boot() {
    try {
        /* DAGGERHEART'S OWN RELAY, registered the way Daggerheart registers it
           (E03): its listener in its `init`, which runs before any module's, and
           its GM handlers at `ready`, also first. The real code, copied - see
           lib/dh-relay.mjs - so the guard in front of it is tested against it. */
        /* The stylesheets first, as Foundry has them on the page before any module
           script runs. An attach that did not complete is a failed boot: every
           colour and size the module reads would come back empty. */
        stylesheets = await attachModuleStyles(document, moduleManifest.styles ?? []);
        if (!stylesheets.complete) throw new Error(`the module's stylesheets did not attach: ${stylesheets.files}/${stylesheets.of} in ${stylesheets.ms} ms`);
        const relay = await import("./lib/dh-relay.mjs");
        game.socket.on("system.daggerheart", relay.handleSocketEvent);
        hooks.once("ready", relay.registerSocketHooks);
        // A file: URL built by Node, not by string: "file://" + "C:\..." is not one.
        await import(url.pathToFileURL(path.join(REPO, "scripts/module.mjs")).href);
        logLine("module.mjs imported");
    } catch (err) {
        logLine(`IMPORT FAILED: ${err.stack}`);
        send({ t: "bootFailed", error: String(err.stack) });
        return;
    }
    try {
        hooks.callAll("init");
        hooks.callAll("i18nInit");
        hooks.callAll("setup");
        game.ready = true;
        hooks.callAll("ready");
        canvas.ready = true;
        canvas.rendered = true;
        hooks.callAll("canvasReady", canvas);
        // give not-awaited ready tasks a beat
        await new Promise(r => setTimeout(r, 250));
        send({
            t: "ready",
            drpg: !!game.drpg,
            drpgKeys: game.drpg ? Object.keys(game.drpg).length : 0,
            settingsRegistered: [...settingDefs.keys()].filter(k => k.startsWith(MODULE_ID)).length,
            stylesheets,
            notifications: globalThis.__notifications,
            hooksFired: hooks.fired.slice(0, 60)
        });
    } catch (err) {
        logLine(`BOOT FAILED: ${err.stack}`);
        send({ t: "bootFailed", error: String(err.stack) });
    }
}

send({ t: "hello", who: WHO });
