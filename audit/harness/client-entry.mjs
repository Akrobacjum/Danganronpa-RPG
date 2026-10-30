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
import { AUTOMATION_DEFAULT, resourceTables, ResourceUpdateMap, modifyResource, updateFear } from "./lib/daggerheart.mjs";
import { HooksImpl, Collection, buildDocumentClasses, buildPolygonBackends, buildPIXI, buildApplications, RollImpl, Die, NumericTerm, OperatorTerm, REPO, MODULE_ID, recordError } from "./lib/shim.mjs";

const WHO = process.env.DRPG_USER ?? "gm";
const send = m => process.send?.(m);
/*
 * THE SERVER'S CLOCK AND THIS MACHINE'S (E04, 26.09.2026). Every client runs on one
 * machine, so the server's time is this process's own clock, read before anything can
 * move it: `game.time.serverTime` answers it. DRPG_CLOCK_SKEW_MS moves `Date.now` alone,
 * the way a GM's computer whose clock is off moves it while Foundry's server time does
 * not (cluster.mjs `connect`, `clockSkewMs`). How v14 computes serverTime is LIVE-E04-01.
 */
const serverNow = Date.now.bind(Date);
const CLOCK_SKEW_MS = Number(process.env.DRPG_CLOCK_SKEW_MS ?? 0) || 0;
if (CLOCK_SKEW_MS) Date.now = () => serverNow() + CLOCK_SKEW_MS;
const logLine = s => send({ t: "log", line: String(s) });

/*
 * WHAT ARRIVED, IN ORDER (E30, 24.09.2026; lib/canary.mjs). Everything the cluster
 * sends this browser as Foundry traffic - the snapshot, document changes, settings,
 * socket packets, acks - is copied here with the scenario's phase, by a listener
 * registered before the message loop's, so Node calls it first and a handler that
 * throws cannot hide what arrived. eval, dump and shutdown are the harness's control
 * channel and are not recorded: a scenario's code is not Foundry traffic. The cap is
 * far above a scenario's traffic (the busiest, 30-security, is some thousands of
 * messages); a dump reports what it dropped, and the canary fails a truncated record.
 */
let PHASE = "boot", wireDropped = 0;
const WIRE = [], WIRE_CAP = 50000;
const WIRE_KINDS = { snapshot: "snapshot", apply: "document", settingApplied: "setting", socketMsg: "socket", ack: "ack" };
process.on("message", msg => {
    if (msg?.t === "phase") { PHASE = String(msg.name); return; }
    const kind = WIRE_KINDS[msg?.t];
    if (!kind) return;
    if (WIRE.length >= WIRE_CAP) { wireDropped++; return; }
    WIRE.push({ n: WIRE.length, at: Date.now(), phase: PHASE, kind, msg: JSON.parse(JSON.stringify(msg)) });
});

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
    /* AND A FORM IS STILL AN HTMLElement (E33 C2b, 07.10.2026). The proxy above stands in the form's
       prototype chain where HTMLElement.prototype stood, and `instanceof` walks past it without meeting
       that prototype: every form here answered `form instanceof HTMLElement` false, which no browser
       does. Measured on C2b's roll window, Daggerheart's a `form` (d20RollDialog.mjs:26): roll-dialog.mjs's
       render hook read the element as jQuery's - its `[0]`, a form's first control - and did nothing
       (e33run/scratch/c2b/logs/t2-dbg1.log: HTMLFormElement, instanceof false). Answered here for
       HTMLElement itself; its subclasses keep the plain test. */
    const HE = dom.window.HTMLElement, plain = Function.prototype[Symbol.hasInstance];
    Object.defineProperty(HE, Symbol.hasInstance, { configurable: true,
        value(v) { return plain.call(this, v) || (this === HE && plain.call(dom.window.HTMLFormElement, v)); } });
}
if (!globalThis.requestAnimationFrame) {
    globalThis.requestAnimationFrame = fn => setTimeout(() => fn(performance.now()), 16);
    globalThis.cancelAnimationFrame = id => clearTimeout(id);
}
/*
 * A WINDOW'S OWN FUNCTIONS REFUSE ANY OTHER RECEIVER, as a browser's do (14.10.2026).
 * `setTimeout` and its kin are methods of the Window interface: called with `this` an
 * object that is not the window - `clock.set(fn, ms)` where `clock = { set: setTimeout }`
 * - a browser throws ("'setTimeout' called on an object that does not implement interface
 * Window." in Firefox, "Illegal invocation" in Chromium). Node's and jsdom's ignore their
 * receiver, so here such a call ran. Measured at the owner's table on 1.2.77 (The Forge,
 * Foundry v14 365, Firefox): bridge-guards.mjs's `createWaiter` kept exactly that default
 * clock from 1.2.62 (E31), and every request a player's client waited on threw at its
 * first `clock.set` - the action grid said "could not be completed" and a statistic
 * clicked on the sheet, drawn on the GM since 1.2.67, rolled nothing. Every headless run
 * since passed, through this gap. Bare calls (`this` undefined), `window.x(...)` and
 * `globalThis.x(...)` pass, as in a browser, where null and undefined stand for the window.
 */
{
    const strict = (name, fn, owner) => function (...args) {
        if (this !== undefined && this !== null && this !== globalThis && this !== dom.window) {
            throw new TypeError(`'${name}' called on an object that does not implement interface Window.`);
        }
        return fn.apply(owner, args);
    };
    for (const k of ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "requestAnimationFrame",
        "cancelAnimationFrame", "queueMicrotask", "fetch", "structuredClone"]) {
        if (typeof globalThis[k] === "function") globalThis[k] = strict(k, globalThis[k], undefined);
        if (typeof dom.window[k] === "function") dom.window[k] = strict(k, dom.window[k], dom.window);
    }
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
            // A scenario may hold one of this client's writes on its way to the server (E10 fix r2-G8, 10.10.2026):
            // `__holdOp(op)` answers a promise to hold it until that settles, or nothing to send it now. Scenario 30
            // holds a GM's put-back until the player's ask it is to follow has been heard - the order its checks test,
            // which until then only arrived first most of the time (e10run/scratch/h19-diagnosis.md). Unset, it is one
            // optional call that answers undefined and the op leaves as before (read in the code, not timed).
            const held = globalThis.__holdOp?.(op);
            if (held) void Promise.resolve(held).finally(() => send({ t: "op", id, op }));
            else send({ t: "op", id, op });
        });
    },
    setSetting(key, value, { noHook = false } = {}) {
        return new Promise((resolve, reject) => {
            const id = `${WHO}-${++reqSeq}`;
            pending.set(id, { resolve, reject });
            send({ t: "setting", id, key, value, ...(noHook ? { noHook: true } : {}) });
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
// Every file the module asked this browser to save (foundry.utils.saveDataToFile, below; E04).
globalThis.__savedFiles = [];
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
    /* v14's name for it, as Daggerheart 2.10.5 reads it for every roll it makes (dhRoll.mjs :159,
       actionField.mjs :328; E33 C11). The keys of `CONFIG.ChatMessage.modes` below are its values. */
    "core.messageMode": { scope: "client", default: "public" },
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
 * DAGGERHEART'S OWN SETTINGS, REGISTERED AS DAGGERHEART DOES, AT INIT (E06 C5a, 27.09.2026).
 * They were registered here on their first read, and tier 2's world dump files a setting that
 * was not registered when the world was first read as one that "appeared": C5a's by-name run
 * failed "could not restore the world" after a test that only read Fear, to put it back after a
 * roll. At a table the system has registered them before any module runs.
 */
for (const [full, def] of Object.entries(FOREIGN_SETTING_DEFAULTS)) {
    if (full.startsWith("daggerheart.")) settingDefs.set(full, def);
}

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
    /* ...and the flag Daggerheart's own `ready` reads before it opens its welcome journal (E79 C9; 2.6.5
       daggerheart.mjs:340-345, read during the design): the system's hooks are registered before any
       module's, as this one is. */
    globalThis.__dhWelcomeAtReady = game.user?.flags?.daggerheart?.["welcome-message"] ?? null;
});

/*
 * FOUNDRY'S OWN TABLE OF WHO MAY DO WHAT (E79 C9, 16.10.2026). `core.permissions` is a world setting
 * Foundry registers itself, an object of permission names to role lists, with no box in Configure
 * Settings; enforced.mjs holds two of its rows (N4). Registered here as the module's notes say
 * Foundry registers it - an empty object by default, not shown - and the table in force is
 * `game.permissions` below: each permission's default roles (CONST.USER_PERMISSIONS here) and over
 * them what the world stored. v14's own defaults and whether its `game.permissions` fills a permission
 * the world never stored are not read here (LIVE-E79-11).
 */
settingDefs.set("core.permissions", { name: "Permissions", scope: "world", config: false, type: Object, default: {} });
/*
 * FOUNDRY'S A/V CLIENT SETTING, REGISTERED AS FOUNDRY DOES (E52 C3, 30.10.2026). The contract register (patches.mjs)
 * reads each entry enforced.mjs holds as registered or not, and Foundry registers `core.rtcClientSettings` itself; the
 * harness's A/V settings live on `game.webrtc.settings`, as before. Its scope and `config` are this harness's guess.
 * avclient-livekit's `useExternalAV` stays registered by the LiveKit stand-in alone (lib/livekit.mjs), which the
 * contract's row reads only while this world's voice is on.
 */
settingDefs.set("core.rtcClientSettings", { name: "Client RTC Settings", scope: "client", config: false, type: Object, default: {} });

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
    async set(ns, key, value, options = {}) {
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
            /* `noHook` as Foundry's update operation takes it (E16 fix r1b-G2): the value lands and `onChange` runs on every
               client, and no client's `updateSetting` listener hears it, as the harness's document writes do (applyRemote). */
            await bus.setSetting(full, JSON.parse(JSON.stringify(value ?? null)), { noHook: options?.noHook === true });
        } else {
            clientValues.set(full, JSON.parse(JSON.stringify(value ?? null)));
            try { def.onChange?.(value); } catch (err) { logLine(`setting onChange ${full}: ${err.stack}`); recordError(`setting onChange ${full}`, err); }
            hooks.callAll("clientSettingChanged", full, value);
        }
        return value;
    },
    storage: { get: scope => (scope === "world" ? worldValues : clientStore) }
};
/* v14's world storage is a collection of Setting documents that answers `getSetting(key)`
   with the stored document, or nothing when the world never wrote that key (the E04
   design's LIVE-E04-10). The harness keeps world values in a Map; this reads it the same way. */
/* With the document's `_stats.lastModifiedBy`, the user whose write the server last applied (E16 fix r1c-G1;
   cluster.mjs `settingWriters`, null for a value the seed wrote): dice-sync.mjs reads who wrote the world's copy
   of the GMs' dice looks from it. v14's own stamp on a Setting is not read here: LIVE-E16-04. */
const worldWriters = new Map();
worldValues.getSetting = key => (worldValues.has(key)
    ? { key, value: worldValues.get(key), _stats: { lastModifiedBy: worldWriters.get(key) ?? null } } : undefined);
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
// A companion this browser finds switched off (cluster.mjs `connect`'s `modulesOff`; E13 fix r1-F3).
for (const id of String(process.env.DRPG_MODULES_OFF ?? "").split(",").filter(Boolean)) if (modulesMap.has(id)) modulesMap.get(id).active = false;

/* A face the harness was told to show, as the `randomUniform` that draws it: Foundry maps u to
   `ceil((1 - u) * faces)`, so the middle of the face's band, u = 1 - (f - 0.5) / faces, lands on f
   whatever the rounding (the plan's 3.2 reads the GM's faces back the same way). */
const uniformFor = (face, faces) => 1 - (face - 0.5) / faces;

/*
 * A PLAYER'S FACES, FOR THE GM'S DRAW (E08+E28 C12a, 04.10.2026). From C12a a player's action roll
 * is thrown on the primary GM (roll-draw.mjs), and the scenarios name its faces on the player's
 * client, as they always have (`__forceRoll`, read where the roll is evaluated). So the harness
 * carries them: a `roll.draw` packet a player sends while `__forceRoll` is set takes a copy under
 * `__harnessForceRoll` (`socket.emit` below), the GM keeps it by the roll's nonce as the packet
 * arrives (the "socketMsg" case), and the GM's evaluation of that roll reads it before its own
 * `__forceRoll` (`buildEvaluate`). Nothing in the module reads the field - the guards and the
 * run see only what the declaration lists - and nothing like it exists at a table, where the
 * GM's randomiser is the GM's. The roller's copy, played back from the GM's faces, reads no
 * `__forceRoll` of its own (`config.drpgDrawn`, action-rolls.mjs `DRAWN_ROLL`).
 */
const relayedFaces = new Map();
const relayedFacesOf = roll => {
    const nonce = roll?.options?.drpgRollNonce;
    const faces = nonce ? relayedFaces.get(nonce) : null;
    if (faces) relayedFaces.delete(nonce);
    return faces ?? null;
};

/*
 * DAGGERHEART'S OWN ROLL (E33 C2a, 07.10.2026; the owner's decision P6 of 06.10.2026). From C2a the class
 * the module finds at game.system.api.dice.DualityRoll is Daggerheart 2.10.5's own, copied verbatim into
 * lib/dh-dice/ with the dice it builds; audit/harness/README.md ("Daggerheart's dice") names what is
 * Daggerheart's, what is Foundry's (lib/shim.mjs) and what is the harness's. Until C2a it was a model of
 * those files written from reading them (DualityRollMock, E08+E28 C10, E29 C9, fix r2-H1), and a model can
 * be wrong in the module's favour. The line numbers below are the tag's; a copy's line is 16 further on,
 * past its header.
 *
 * It is Daggerheart's class itself, not a subclass of it: its `buildPost` and `dualityUpdate` call
 * `DualityRoll.dualityUpdate` and `DualityRoll.addDualityResourceUpdates` on their own binding
 * (dualityRoll.mjs:249, :333), and critical.mjs patches the second on the class the module finds - on a
 * subclass the patch would sit where Daggerheart never calls it. So the harness's two seams are assigned
 * onto the class at boot (`installDualityRoll`), and the files stay Daggerheart's byte for byte:
 *   - `buildEvaluate`: Daggerheart's own (dualityRoll.mjs:213-243 on d20Roll.mjs:152-191 on dhRoll.mjs:88-101),
 *     run with `CONFIG.Dice.randomUniform` scripted by the faces a test names (`harnessEvaluate`), and
 *     `config.total` written after it, the harness's key since E30;
 *   - `toMessage`: the harness's message, as before C2a (`harnessMessage`). Daggerheart's (dhRoll.mjs:119-170)
 *     reads the item's actions and the reload setting off a `parent` the harness's roll data does not carry
 *     (lib/shim.mjs `getRollData`), and the suite's readers were written against this card.
 */

/*
 * The faces a test names in `globalThis.__forceRoll = { hope, fear }` are a script of
 * `CONFIG.Dice.randomUniform` for this one evaluation: the next draws, in the order the dice
 * ask for them, then the randomiser again - as a scripted randomiser is at a table. So a
 * Loaded Die, which answers its die's draw itself (forced-roll.mjs; Hope or Fear at random since
 * E15 C5, named on the roll's `drpgLoadedAt`), hands the script's first face to the other die:
 * `{ hope: 5, fear: 3 }` with a Loaded Die throws 12 and 5, or 5 and 12. An
 * `advantage` face scripts the third draw, the one advantage die a roll throws after its two
 * (E29 C10: from then the GM throws the die its own list holds - a tool in hand, a trap's
 * victim - which no window of the harness put on, and a scenario reading a band names its face).
 * Daggerheart's `buildEvaluate` evaluates the roll once (dhRoll.mjs:89), so the script spans it whole.
 */
function harnessEvaluate(daggerheart) {
    return async function buildEvaluate(roll, config = {}, message = {}) {
        const D = globalThis.CONFIG.Dice;
        const forced = config?.drpgDrawn ? null : relayedFacesOf(roll) ?? globalThis.__forceRoll;
        const script = forced ? [forced.hope, forced.fear, forced.advantage].map((face, i) => typeof face === "number" ? uniformFor(face, roll.dice[i]?.faces ?? 12) : null) : null;
        const real = D.randomUniform;
        if (script) D.randomUniform = () => script.shift() ?? real();
        try {
            await daggerheart.call(this, roll, config, message);
        } finally {
            if (script) D.randomUniform = real;
        }
        // The harness's key since E30, not Daggerheart's: the total on the config itself, which
        // the message's options carried before C10 and a caller may read.
        config.total = roll.total;
    };
}

/*
 * The message, as the harness wrote it before C10 (E06 C1 and its fixes, the block comment
 * above `rollTrait`): a chat card faithful enough for despair-award.readDuality - two d12
 * dice in Hope-then-Fear order, plus the actionType the reaction guard reads.
 */
async function harnessMessage(roll, config) {
    // The harness's own `config.actor` (E30), or - for a roll the GM drew (E08+E28 C12a), whose
    // config came over the wire without it - the character its `source.actor` names, as
    // Daggerheart's `toMessage` reads the speaker off the roll's data rather than a key of ours.
    const actor = config.actor ?? (config.source?.actor ? globalThis.fromUuidSync(config.source.actor) : null);
    const traitKey = config.roll?.trait;
    const mod = traitValue(actor, traitKey);
    const hope = roll.dHope.total, fear = roll.dFear.total, total = roll.total;
    const rollJson = {
        class: "DualityRoll", formula: roll.formula, total, evaluated: true,
        dHope: { total: hope }, dFear: { total: fear },
        dice: [{ faces: 12, total: hope, results: [{ result: hope, active: true }] },
               { faces: 12, total: fear, results: [{ result: fear, active: true }] }],
        options: { ...configKeys(config), title: config.title ?? "", headerTitle: config.headerTitle ?? "", source: { actor: config.source.actor },
            data: config.data, effects: [...(actor?.effects?.contents ?? [])].map(e => e.toObject?.() ?? e),
            experiences: [...(config.experiences ?? [])],
            // The roll's own modifiers where its options hold them, as Daggerheart's message keeps the
            // roll whole (a roll the GM drew, whose modifiers it wrote, E29 C10); else the statistic's,
            // the one the harness's formula adds.
            roll: { trait: traitKey, type: config.actionType,
                modifiers: Array.isArray(roll.options?.roll?.modifiers) ? JSON.parse(JSON.stringify(roll.options.roll.modifiers))
                    : traitKey ? [{ label: `DAGGERHEART.CONFIG.Traits.${traitKey}.name`, value: mod }] : [] },
            actionType: config.actionType }
    };
    const message = await classes.ChatMessage.create({
        author: game.userId,
        speaker: classes.ChatMessage.getSpeaker({ actor }),
        content: `<div class="dice-roll">Duality: ${total}</div>`,
        // dhRoll.mjs:150 (2.10.5): a muted roll's message has no sound (the GM's draw, C12a).
        sound: config.mute ? null : globalThis.CONFIG.sounds.dice,
        rolls: [rollJson],
        system: { title: config.title ?? "", source: { actor: config.source.actor }, targets: [], roll: { ...rollJson, options: { actionType: config.actionType } } },
        flags: {}
    });
    // dhRoll.mjs:162-165 (2.6.5), :164-166 (2.10.5): the message is created, then Dice So
    // Nice's animation is waited for, and only then does the roll return (E06 fix r1-G2).
    // Daggerheart asks `game.dice3d`, which a table has only with Dice So Nice on; the
    // harness's is always there, so the module's state stands in for it.
    if (roll.formula !== "" && game.modules.get("dice-so-nice")?.active) await game.dice3d?.waitFor3DAnimationByMessageID(message.id);
    return message;
}

/*
 * Daggerheart's roll and dice, put where Daggerheart puts them, with what its own code calls that is
 * neither its dice nor Foundry's - each the harness's glue, found by running the copy and reading
 * what threw (E33 C2a):
 *   - `game.system.api.dice` names the roll and the dice (daggerheart.mjs:135, 2.10.5), and the dice
 *     are Foundry term types, so a roll's JSON rebuilds them by class (daggerheart.mjs:43);
 *   - the triggers a duality roll runs (dualityRoll.mjs:253-276): none is registered in the harness,
 *     so `runTrigger` answers none, as Daggerheart's registry does with none registered;
 *   - the countdowns a roll ticks (dualityRoll.mjs:318-331, helpers.mjs): the harness has none to tick;
 *   - the ids those read off Daggerheart's config (generalConfig.mjs:742-776, triggerConfig.mjs:3-14),
 *     only the ones the copied files read.
 */
function installDualityRoll(DualityRoll, diceTypes) {
    game.system.api.dice.DualityRoll = DualityRoll;
    game.system.api.dice.diceTypes = diceTypes;
    Object.assign(globalThis.CONFIG.Dice.termTypes, diceTypes);
    DualityRoll.buildEvaluate = harnessEvaluate(DualityRoll.buildEvaluate);
    DualityRoll.toMessage = harnessMessage;
    game.system.registeredTriggers = { runTrigger: async () => [] };
    /* The countdown tray's class, as far as the module reaches into it: the static `updateCountdowns` a roll ticks, and
       the row menu's builder projects-ui.mjs wraps (`_getCountdownContextOptions`; the contract register's
       "countdown-row-menu", E52 C1). Its menu has no entries here: the harness draws no tray. */
    game.system.api.applications = { ui: { DhCountdowns: class DhCountdowns {
        static async updateCountdowns() {}
        _getCountdownContextOptions() { return []; }
    } } };
    Object.assign(globalThis.CONFIG.DH.GENERAL, {
        rollTypes: { spellcast: { id: "spellcast" } },
        countdownProgressionTypes: { actionRoll: { id: "actionRoll" }, fear: { id: "fear" } }
    });
    globalThis.CONFIG.DH.TRIGGER = { triggers: { dualityRoll: { id: "dualityRoll" }, fearRoll: { id: "fearRoll" } } };
    wrapWindowCosts(DualityRoll.DefaultDialog);
}

/*
 * THE ROLL WINDOW'S COSTS AND USES DECIDE ROLL (E16 p1 C0, 18.10.2026). The window's stand-in
 * (lib/dh-dice/applications/dialogs/d20RollDialog.mjs, whose header still says it leaves this out)
 * answers `canRoll: true` always, so a window Daggerheart greys out - S02-04: an experience clicked
 * at 0 Hope - rolled here, and no test of the module's forced costs could fail. Read in 2.10.5's
 * d20RollDialog.mjs `_prepareContext` (:85-107 of the tag) with costField.mjs and usesField.mjs:
 * with costs, `CostField.calcCosts` fills each one's total, enabled and max from the actor's
 * resources, `canRoll` is `CostField.hasCost` of them, and the first cost's total becomes the roll
 * data's `scale`; with `uses.max`, `canRoll` also needs `UsesField.hasUses`. Wrapped onto the stand-in
 * here at boot, after its own context, because no byte under lib/dh-dice/ is edited (STAGE E16
 * p1's line rule); 2.10.5 does it before the roll's formula, which reads neither the costs nor
 * `scale` (dualityRoll.mjs, d20Roll.mjs: no `scale`, grep 18.10).
 *
 * As written there, a cost whose key the actor holds no resource for (not Fear) throws a TypeError
 * in `calcCosts`, here too (S02-04's unlocked case). Taken out: the costs' labels (:90-95, not in the
 * stand-in's markup), an inventory item's quantity filter and an item's own resource (`itemId`):
 * both of the action, which the stand-in does not look up; `calcUses`'s remaining uses and a formula
 * as `uses.max` (no action to read them from; no module code sets `config.uses`, grep 18.10). A
 * resource's `isReversed`, which Daggerheart's prepared actor carries (creature.mjs, from
 * `CONFIG.DH.RESOURCE`'s `reverse`) and the harness's source-data actors do not (lib/seed.mjs), is
 * taken from the same table here, so a Stress cost counts up as there. On a roll with no actor -
 * every roll the harness throws (the stand-in's THE PLAYER) - nothing of it runs: 2.10.5's
 * `{ actor: undefined }` would throw on the first cost, and a table's roll has its actor. A GM's
 * own window holds no costs, so its Roll stays as it was. Whether 2.6.5 or a later Daggerheart
 * computes the same is LIVE-E16-01's: not measured. Measured on a scratch tier-2 probe (18.10, the
 * GM's window on a character at Hope 2, Fear 0): a Fear cost of 1 greys Roll out, a Stress cost of 1
 * leaves it on (its max 6), a cost keyed to no resource throws in `_prepareContext` (the shim logs
 * it and draws Roll off); before this wrap all three windows had Roll on.
 */
function costResources(actor) {
    const resources = U.deepClone(actor.system.resources ?? {});
    if (actor.system.partner) resources.hope = U.deepClone(actor.system.partner.system.resources.hope);
    const table = globalThis.CONFIG.DH.RESOURCE?.[actor.type]?.all ?? {};
    for (const [key, resource] of Object.entries(resources)) {
        if (resource && typeof resource === "object" && !("isReversed" in resource) && table[key]) resource.isReversed = table[key].reverse;
    }
    return resources;
}

/* costField.mjs `calcCosts` (2.10.5), without the item's quantity filter. */
function calcCosts(actor, costs) {
    const resources = costResources(actor);
    const fear = () => game.settings.get(globalThis.CONFIG.DH.id, globalThis.CONFIG.DH.SETTINGS.gameSettings.Resources.Fear);
    return costs.map(c => {
        c.scale = c.scale ?? 0;
        c.step = c.step ?? 1;
        c.total = c.value + c.scale * c.step;
        c.enabled = Object.hasOwn(c, "enabled") ? c.enabled : true;
        c.max = c.key === "fear" ? fear()
            : resources[c.key].isReversed ? resources[c.key].max - resources[c.key].value : resources[c.key].value;
        if (c.scalable) c.maxStep = Math.floor((c.max - c.value) / c.step);
        return c;
    });
}

/* costField.mjs `getRealCosts` and `hasCost` (2.10.5), whole. */
function hasCost(actor, costs) {
    const merged = [];
    for (const c of U.deepClone(costs).filter(c => c.enabled)) {
        const same = merged.find(m => m.key === c.key);
        if (same) same.total += c.total;
        else merged.push(c);
    }
    const fearAt = merged.findIndex(c => c.key === "fear");
    if (fearAt > -1) {
        const fearCost = merged.splice(fearAt, 1)[0];
        if (!game.user.isGM || fearCost.total > game.settings.get(globalThis.CONFIG.DH.id, globalThis.CONFIG.DH.SETTINGS.gameSettings.Resources.Fear)) return false;
    }
    const resources = costResources(actor);
    // As written there: `a &&` binds to the reversed test alone, so a false so far is dropped at a
    // cost on a resource that counts the other way.
    return merged.reduce((a, c) => !resources[c.key] ? a
        : a && resources[c.key].isReversed ? resources[c.key].value + (c.total ?? c.value) <= resources[c.key].max
            : resources[c.key]?.value >= (c.total ?? c.value), true);
}

/* usesField.mjs `hasUses` (2.10.5), its max a number. */
function hasUses(uses) {
    if (!uses) return true;
    return (Object.hasOwn(uses, "enabled") && !uses.enabled) || uses.value + 1 <= Number(uses.max ?? 0);
}

function wrapWindowCosts(Dialog) {
    const prepare = Dialog.prototype._prepareContext;
    Dialog.prototype._prepareContext = async function _prepareContext(options) {
        const context = await prepare.call(this, options);
        const actor = this.actor;
        if (!actor) return context;
        if (this.config.costs?.length) {
            const updated = calcCosts(actor, this.config.costs);
            context.costs = updated;
            context.canRoll = hasCost(actor, updated);
            this.config.data.scale = this.config.costs[0].total;
        }
        if (this.config.uses?.max) {
            context.uses = { ...this.config.uses, enabled: Object.hasOwn(this.config.uses, "enabled") ? this.config.uses.enabled : true };
            context.canRoll = context.canRoll && hasUses(context.uses);
        }
        return context;
    };
}

/* A statistic's value off the character, as the harness's formula and message read it. */
function traitValue(actor, traitKey) {
    return Number(actor?.system?.traits?.[traitKey]?.value ?? 0);
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
            // Daggerheart's own roll and dice, put here at boot (`installDualityRoll`, E33 C2a).
            dice: {},
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
    // DRPG_WORLD: the same browser opening another world on one server (cluster.mjs `connect`, E04).
    world: { id: process.env.DRPG_WORLD || "drpg-audit-world", title: "DRPG Audit World" },
    version: versions.foundry.version,
    release: { generation: versions.foundry.generation, build: versions.foundry.build },
    ready: false,
    /* The permissions in force (E79 C9): see `core.permissions` above. */
    get permissions() {
        const out = {};
        for (const [name, def] of Object.entries(CONST.USER_PERMISSIONS)) {
            out[name] = Object.values(CONST.USER_ROLES).filter(role => role > 0 && role >= def.defaultRole);
        }
        return { ...out, ...settingsApi.get("core", "permissions") };
    },
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
        /* socket.io-client v4's list of the catch-alls, a copy (E52 fix round, SEC-2: the contract's relay row reads it). */
        listenersAny() { return [...this._any]; },
        emit(channel, ...args) {
            // A player's faces for the GM's draw (E08+E28 C12a): see `relayedFaces` above.
            if (args[0]?.action === "roll.draw" && globalThis.__forceRoll && !game.user?.isGM) {
                args = [{ ...args[0], __harnessForceRoll: { ...globalThis.__forceRoll } }, ...args.slice(1)];
            }
            bus.socketEmit(channel, args);
        }
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
        // Every call kept, drawn nowhere (E06 C6): see "DICE SO NICE'S DECISION" below.
        showForRoll: async (roll, user = game.user, synchronize = false, users = null, blind = false, messageID = null) => {
            globalThis.__dsnShown.push({ user: user?.id ?? user ?? null, synchronize: Boolean(synchronize),
                users: users ? [...users].map(u => u?.id ?? u) : null, blind: Boolean(blind), messageID, total: roll?.total ?? null });
            return true;
        },
        addSystem() {}, addColorset() {}, addDicePreset() {},
        // The animation a roll's message waits for (Daggerheart's `toMessage`, below): over at
        // once, unless a scenario or a test holds it with `__dsnAnimation`, an async function of
        // the message's id - a long throw, or a tab in the background (E06 fix r1-G2).
        waitFor3DAnimationByMessageID: async id => {
            if (typeof globalThis.__dsnAnimation === "function") await globalThis.__dsnAnimation(id);
            return true;
        }
    },
    keybindings: { register() {}, get: () => [] },
    tooltip: { activate() {}, deactivate() {} },
    time: { worldTime: 0, get serverTime() { return serverNow(); }, advance: async () => {} },
    canvas: null,
    drpg: undefined,
    data: { version: versions.foundry.version }
};
globalThis.game = game;

/*
 * A LIVEKIT ROOM, ONLY WHEN A SCENARIO ASKS (E78 C1, 13.10.2026; the E78 plan's 2.2). The `webrtc`
 * block above has no `_liveKitClient`, so on every client the module reads "not LiveKit" and its
 * voice rooms settle as unavailable - which every scenario before 75 was measured on. A scenario that
 * needs a room calls `await __liveKit.install({ roster })` inside an eval; the shim (lib/livekit.mjs)
 * is loaded then and not before, so a boot that does not ask is the boot it always was.
 */
globalThis.__liveKit = {
    installed: false,
    async install(options) {
        const { installLiveKit } = await import("./lib/livekit.mjs");
        globalThis.__liveKit = installLiveKit(options);
        return globalThis.__liveKit.installed;
    }
};

/*
 * DICE SO NICE'S DECISION, AS 6.3.1 MAKES IT ON EVERY CLIENT (E06 C6, 27.09.2026). main.js
 * `shouldInterceptMessage` (:458-516, read in 6.3.1's source): a new message with dice animates
 * where its content is visible, or on every client when the world's "Hide 3D dice on secret
 * rolls" is off (`hide3dDiceOnSecretRolls`, registered with `default: true`, main.js:199-206;
 * here `globalThis.__dsnHideSecret`) - ghost dice stay at their default, off. Then it calls
 * `diceSoNiceMessagePreProcess` with the message's id and `{ willTrigger3DRoll }`, which a
 * listener may turn off, and what is left decides. Kept here in `__dsnAnimated` (the ids this
 * client would animate); `__dsnShown` keeps every `showForRoll` call. Nothing is drawn. With
 * `game.dice3d` gone (a scenario deletes it to play a table without the module) nothing is
 * decided, as Dice So Nice's own `game.dice3d &&` has it. Rolls added by an update and the
 * inline rolls in a card's text are not modelled. Where it animates it takes the core dice
 * sound off the message (main.js:573-576), so the chat log's notifier, below, plays none.
 */
globalThis.__dsnShown = [];
globalThis.__dsnAnimated = [];
globalThis.__dsnHideSecret = true;
hooks.on("createChatMessage", message => {
    if (!game.dice3d || !message?.isRoll) return;
    if (!(message.rolls ?? []).some(roll => (roll?.dice?.length ?? 0) > 0)) return;
    const interception = { willTrigger3DRoll: message.isContentVisible || globalThis.__dsnHideSecret === false };
    hooks.callAll("diceSoNiceMessagePreProcess", message.id, interception);
    if (!interception.willTrigger3DRoll) return;
    globalThis.__dsnAnimated.push(message.id);
    if (message.sound === "sounds/dice.wav") delete message.sound;
});

/*
 * THE CHAT LOG TOLD OF A NEW MESSAGE (E06 fix r1-G2, 28.09.2026; review m2). Foundry posts a
 * created message to the chat log where it is `visible` and calls the log's notifier, which
 * lights the Chat tab's pip and plays the message's sound. That order is the review's reading
 * and the E06 plan's, not a reading of v14's source, which is not on this machine (LIVE-E06-04);
 * the call comes after every `createChatMessage` listener, as Foundry's comes after the card is
 * rendered. The notifier is `HarnessChatLog#notify`, below, as secret.mjs wraps it.
 */
hooks.on("createChatMessage", message => {
    if (message?.visible) setTimeout(() => globalThis.ui?.chat?.notify?.(message), 0);
});

/*
 * THE HARNESS'S GM PICKS A STATISTIC (E32+E07 C11b, 02.10.2026). A crisis action thrown
 * from a player's browser waits for a GM to pick its statistic on a card in that player's
 * thread (scripts/trait-ruling.mjs); nobody sits at the harness's GM, so the primary GM
 * presses one of the card's trait buttons - through the card's own wiring
 * (messenger-app.mjs `wireCallActions`), so the answer, the settled card and its record
 * are the module's. Beside `__dialogAuto`, and like it on unless a scenario says
 * otherwise: `__traitRulingAuto` true presses the first listed trait, a trait's key that
 * one, false nothing. Each press is noted in `__traitRulings`. A crisis action thrown on
 * the GM's own browser asks its local window instead, which `__dialogAuto` answers. Not
 * while the suite runs on this GM (`suiteRolling`): its tests press their own cards, as a
 * GM at a real table would, and measured on the first run (02.10.2026) this press settled
 * the card two of them were about to read.
 */
globalThis.__traitRulingAuto = true;
globalThis.__traitRulings = [];
const moduleFile = file => url.pathToFileURL(path.join(REPO, "scripts", file)).href;
hooks.on("drpgMessengerMessage", (thread, message) => {
    const choice = globalThis.__traitRulingAuto;
    if (choice === false || !game.user?.isGM || game.drpg?.suiteRolling) return;
    setTimeout(async () => {
        try {
            if (!(await import(moduleFile("utils.mjs"))).isPrimaryGm()) return;
            const html = String(await (await import(moduleFile("secret.mjs"))).wordsOf(message) ?? "");
            if (!html.includes('data-drpg-call="pickTrait"')) return;
            const body = document.createElement("div");
            body.innerHTML = html;
            (await import(moduleFile("messenger-app.mjs"))).wireCallActions(body, message);
            const buttons = [...body.querySelectorAll('[data-drpg-call="pickTrait"]')];
            const button = (typeof choice === "string" && buttons.find(b => b.dataset.trait === choice)) || buttons[0];
            globalThis.__traitRulings.push({ message: message.id, offered: buttons.map(b => b.dataset.trait), picked: button?.dataset.trait ?? null });
            button?.click();
        } catch (err) {
            recordError("the harness GM's statistic ruling", err);
        }
    }, 0);
});

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
 * that, as the sheet's trait button and this module's `commitResources` do. Since
 * E08+E28 C10 `diceRoll` hands the config to the roll class's `build`
 * (Daggerheart's own classes, `installDualityRoll` above): the dice are drawn from `CONFIG.Dice.randomUniform`,
 * which globalThis.__forceRoll = {hope, fear} scripts for one evaluation, and the
 * roll window is the harness's stand-in, the module's hooks running on it (since E33 C2b;
 * lib/dh-dice/applications/dialogs/d20RollDialog.mjs); game.drpg.suiteRolling asks for none.
 *
 * THE MESSAGE AS 2.6.5 WRITES IT (E06 C1, 27.09.2026), read in its source, not measured on a
 * real message (LIVE-E06-02 does that). actor.mjs `rollTrait` (:568-590) gives the config a
 * `title` (the trait's check) and a `headerTitle` carrying the actor's name, which the
 * caller's options override - written here in English with the trait's key, as the harness
 * loads no Daggerheart language file and an unknown key would count as a missing one;
 * `diceRoll` (:560-566) sets `source.actor` to the actor's uuid
 * and `data` to `getRollData()`; the roll
 * is built with the config as its options (dhRoll.mjs:45), and `toMessage` (:118, :144-157) writes
 * the speaker by `getSpeaker`, `system` as the config through actorRoll.mjs's schema (a
 * `title`, `source.actor`, `targets`) and the roll. Here the roll's options are that config: a
 * JSON copy of every key but the roll, the actor and the message the harness hangs on it
 * (`configKeys`), with title, headerTitle, source.actor, data, effects, the experiences picked,
 * `roll` with its statistic and actionType written as below. Until E06 fix r2-G2 (28.09.2026;
 * review round 2's mn1 = m1) the options were those keys alone, and a key the module passes on
 * the config - the Loaded Die's mark, the nonce its Call keeps on the character - reached no
 * check that reads a roll.
 * `data` AS IT IS WRITTEN (E06 fix r1-G1, 28.09.2026; review M1 = F1). Until this fix the
 * harness wrote `data` as `{ id, name }`, and C5b's neutral roll was measured against that
 * shape alone. `getRollData()` (actor.mjs:636-645) is a shallow proxy over the character's
 * system whose `set` keeps `id`, `name`, `system`, `prof` and `cast` in a table of its own
 * (helpers/utils.mjs:792-814, no `ownKeys`), so a roll serialised to its message carries the
 * system - named experiences, a biography, a companion's uuid - and not the id or the name.
 * Written here as the shim's `getRollData()`, the system's source; read in the source, not
 * measured on a real message (LIVE-E06-02). The seed gives every student such a system
 * (lib/seed.mjs `studentActor`). And
 * `system.roll` stays as E30 wrote it, the options its actionType alone: it stands in for
 * actorRoll.mjs's `roll` getter (:64), which finds the roll among the message's rolls and is
 * no field of the source - despair-award and private-rolls read it.
 */
classes.Actor.prototype.rollTrait = async function rollTrait(traitKey, options = {}) {
    return this.diceRoll({ title: `${traitKey} Check`, headerTitle: `Duality Roll: ${this.name}`,
        roll: { trait: traitKey, type: "trait" }, hasRoll: true, actionType: "action", ...options });
};

/* actor.mjs `modifyResource` (lib/daggerheart.mjs): a GM writes, a player asks the GM relay (E30, G9). */
classes.Actor.prototype.modifyResource = function (resources) { return modifyResource(this, resources); };

/* The config's keys as its roll's options carry them: a JSON copy, less what the harness hangs on it. */
function configKeys(config) {
    const out = {};
    for (const [key, value] of Object.entries(config ?? {})) {
        if (["roll", "actor", "message"].includes(key) || value === undefined || typeof value === "function") continue;
        try { out[key] = JSON.parse(JSON.stringify(value)); } catch { /* not JSON, so not on a message either */ }
    }
    return out;
}

classes.Actor.prototype.diceRoll = async function diceRoll(config) {
    config.source = { ...(config.source ?? {}), actor: this.uuid };
    config.data = this.getRollData();
    config.resourceUpdates = new ResourceUpdateMap(this);
    // The experiences the roll dialog would have picked (d20RollDialog.mjs keeps them on the
    // config): none, unless a test names them in globalThis.__forceExperiences, as __forceRoll
    // names the dice (E06 fix r1-G1: the Reroll's bookmark keeps them). Where the window opens
    // (E33 C2b) they are the chips its stand-in clicks: the window empties the list it is given
    // (d20RollDialog.mjs:12), and a chip the module locked refuses the click.
    config.experiences = [...(config.experiences ?? globalThis.__forceExperiences ?? [])];

    // The harness's own keys since E30, on the config before the roll is built as they were
    // before C10, so the message's options carry them as they did: the character, and costs.
    config.actor = this;
    config.costs = config.costs ?? [];
    // actor.mjs `diceRoll` (:649-655, 2.10.5): the actor's roll class builds the roll, through
    // the class the module finds, so a wrap of its `build` is what runs (E08+E28 C10).
    return game.system.api.dice.DualityRoll.build(config);
};

/*
 * A CHAT CARD'S HEADER, AS DAGGERHEART 2.10.5 DRAWS IT (E08+E28 fix r2-H4, 05.10.2026; review S2-2).
 * The harness drew no card: its log draws nothing (`postOne`), and a test drew a card's hooks onto a
 * bare element. Who a card's header names is Daggerheart's: its `renderHTML` (chatMessage.mjs:26-36)
 * hands the template the speaker's actor where the card is readable here, else the author's avatar
 * (Daggerheart's mystery man where there is none) and no name; the template (chat-message.hbs:3-44)
 * draws that portrait, then the message's title, else the author's name where the actor has none, else
 * the alias, and under it the alias with "(GM)" for a GM's titled card, or the author's name again.
 * Written here from that reading, the header and the content alone, and Foundry's
 * `renderChatMessageHTML` called on it as core's `renderHTML` calls it, so a test reads the header a
 * table's log draws - and at a table the suite calls the real one. Not drawn: the time, the delete
 * button, the whisper's names, the system's enrichment and listeners. Foundry's `User#avatar` is not
 * written here (no Foundry source on this machine): a user has none, so an author's portrait is the
 * mystery man.
 */
classes.ChatMessage.prototype.renderHTML = async function renderHTML() {
    const actor = game.actors.get(this.speaker?.actor ?? "");
    const shown = actor && this.isContentVisible ? actor : { img: this.author?.avatar ? this.author.avatar : "icons/svg/mystery-man.svg", name: "" };
    const li = document.createElement("li");
    li.className = "chat-message message flexcol";
    li.dataset.messageId = this.id;
    li.innerHTML = '<header class="message-header flexrow"><div class="portrait"><img class="actor-img"></div>'
        + '<div class="message-header-main"><h4></h4><span class="message-metadata"></span><div class="subtitle"><div class="name"></div></div></div>'
        + '</header><div class="message-content"></div>';
    li.querySelector(".actor-img").setAttribute("src", shown.img ?? "");
    li.querySelector(".message-header-main > h4").textContent = this.title || (!shown.name ? this.author?.name ?? "" : this.alias);
    li.querySelector(".subtitle .name").textContent = this.title ? `${this.alias} ${this.author?.isGM ? "(GM)" : ""}`.trim()
        : !shown.name ? this.author?.name ?? "" : "";
    li.querySelector(".message-content").innerHTML = this.content;
    hooks.callAll("renderChatMessageHTML", this, li, {});
    return li;
};

/* ------------------------------ canvas ----------------------------------- */

const tokenWrappers = new Map();
const canvas = {
    ready: false,
    /* True until this client's first `canvasReady` (E13 C0): the boot below clears it as its draw ends. */
    loading: true,
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
                /* A TOKEN'S REFRESH, AS FAR AS THE MODULE'S LISTENERS SEE IT (E88 C0, 27.10.2026). Until C0 this token had
                   no `renderFlags`, so `applyAll`'s `renderFlags?.set?.(...)` asked for nothing and `refreshToken` never
                   fired headless; and its `visible` was a getter alone, so `hide()` threw inside `applyToToken`'s catch.
                   Every canvas count was zero by construction (R1009 red at 768af5fb). Modelled now, from Foundry's
                   documented render flags and not from v14's source (LIVE-E88-05, environment.unconfirmed): `set` gathers
                   the flags asked of this token, and on the next animation frame - one refresh a token a frame, however
                   many times it was asked - a `refreshVisibility` among them puts Foundry's own answer back (`!hidden`,
                   or a GM; the room fog leaves token vision off), on the token and its mesh, and `refreshToken` fires
                   with the flags. `visible` holds what the module last wrote until a refresh gives Foundry's answer back,
                   which is what makes `applyAll`'s flag the un-hide road it is at a table. Not modelled: a move's slide,
                   which at a table refreshes the moving token on every frame of it (a table measures that); the order
                   of Foundry's own refresh steps inside one flush.
                   E89 C0 (30.10.2026; E89-01, E89-02): a slide and a drag's preview, both on the model, neither read in
                   v14's source. `__holdDrawn()` keeps the sprite where it stands while its document moves on (Foundry
                   draws the token at its old spot when the update lands); `__slideTo(frames)` then walks the drawn
                   spot to the document's, one `refreshPosition` a frame, the last frame at rest - a slide refreshes the
                   moving token every frame of it (LIVE-E88-05). `{ sightRefresh: true }` also fires `sightRefresh` each
                   frame of it: whether v14 does during a move is LIVE-E89-02. `__preview()` is the drag's preview: a
                   second object over the same token, owned like it, absent from `placeables`, refreshed by its own
                   `__dragTo(x, y)` (LIVE-E89-02). */
                let written;
                let drawn = null;
                const foundryVisible = () => !tokenDoc.hidden || game.user.isGM;
                const asked = {};
                let queued = false;
                const flush = () => {
                    queued = false;
                    const flags = { ...asked };
                    for (const key of Object.keys(asked)) delete asked[key];
                    if (canvas.scene?.tokens?.get(tokenDoc.id) !== tokenDoc) return;
                    if (flags.refreshVisibility) {
                        written = undefined;
                        w.mesh.visible = foundryVisible();
                    }
                    hooks.callAll("refreshToken", w, flags);
                };
                w = {
                    get id() { return tokenDoc.id; },
                    document: tokenDoc,
                    get actor() { return tokenDoc.actor; },
                    get name() { return tokenDoc._source.name ?? tokenDoc.actor?.name ?? ""; },
                    get x() { return drawn ? drawn.x : tokenDoc.x; }, get y() { return drawn ? drawn.y : tokenDoc.y; },
                    __holdDrawn() { drawn = { x: tokenDoc.x, y: tokenDoc.y }; return drawn; },
                    async __slideTo(frames = 20, { sightRefresh = false } = {}) {
                        const from = drawn ?? { x: tokenDoc.x, y: tokenDoc.y };
                        for (let k = 1; k <= frames; k++) {
                            drawn = k === frames ? null
                                : { x: from.x + (tokenDoc.x - from.x) * k / frames, y: from.y + (tokenDoc.y - from.y) * k / frames };
                            w.renderFlags.set({ refreshPosition: true });
                            if (sightRefresh) hooks.callAll("sightRefresh");
                            await new Promise(r => globalThis.requestAnimationFrame(r));
                        }
                        return frames;
                    },
                    __preview() {
                        const at = { x: tokenDoc.x, y: tokenDoc.y };
                        const doc = Object.create(tokenDoc, { x: { get: () => at.x }, y: { get: () => at.y }, isPreview: { value: true } });
                        const asked = {};
                        let due = false;
                        const preview = Object.create(w, {
                            document: { value: doc }, isPreview: { value: true }, _original: { value: w },
                            x: { get: () => at.x }, y: { get: () => at.y },
                            visible: { value: true, writable: true },
                            mesh: { value: new PIXI.Sprite() }, children: { value: [] },
                            renderFlags: { value: { set(flags) {
                                for (const [key, on] of Object.entries(flags ?? {})) if (on) asked[key] = true;
                                if (due) return;
                                due = true;
                                globalThis.requestAnimationFrame(() => {
                                    due = false;
                                    const f = { ...asked };
                                    for (const key of Object.keys(asked)) delete asked[key];
                                    hooks.callAll("refreshToken", preview, f);
                                });
                            } } },
                            __dragTo: { value(x, y) { at.x = x; at.y = y; preview.renderFlags.set({ refreshPosition: true }); } }
                        });
                        return preview;
                    },
                    get w() { return (tokenDoc.width ?? 1) * 100; }, get h() { return (tokenDoc.height ?? 1) * 100; },
                    get center() { return tokenDoc.center; },
                    // Foundry's PlaceableObject#isOwner, the document's (E88 C0): visibility.mjs asks it for the viewer's own
                    // token, and without it a player's own token was judged another's and hidden from its owner.
                    get isOwner() { return Boolean(tokenDoc.isOwner); },
                    get visible() { return written ?? foundryVisible(); },
                    set visible(value) { written = Boolean(value); },
                    renderFlags: {
                        set(flags) {
                            for (const [key, on] of Object.entries(flags ?? {})) if (on) asked[key] = true;
                            if (queued) return;
                            queued = true;
                            globalThis.requestAnimationFrame(flush);
                        }
                    },
                    get controlled() { return canvas.tokens.controlled.includes(w); },
                    control() { if (!canvas.tokens.controlled.includes(w)) canvas.tokens.controlled.push(w); return true; },
                    release() { const i = canvas.tokens.controlled.indexOf(w); if (i >= 0) canvas.tokens.controlled.splice(i, 1); return true; },
                    refresh() { return w; },
                    destroyed: false,
                    mesh: new PIXI.Sprite(),
                    border: new PIXI.Graphics(),
                    tooltip: new PIXI.Text(""),
                    children: [],
                    addChild(c) { c.parent = this; this.children.push(c); return c; },
                    // PIXI's own (E88 C0): own-ring.mjs `ringParts` puts the frame under everything else at index 0.
                    addChildAt(c, i) { c.parent = this; this.children.splice(i, 0, c); return c; },
                    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parent = null; return c; },
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
/* WHAT FOUNDRY REFRESHES WHEN A TOKEN'S DOCUMENT CHANGES (E88 C0; LIVE-E88-05). `Token#_onUpdate` asks the drawn token
   for the refresh its changed fields need; modelled for the fields the module's listeners read - a move (x, y,
   elevation, a floor), a resize, `hidden` - as one refresh of that token, on the scene on screen. A new token is drawn
   and refreshed whole. Foundry's slide, a refresh on every frame of it, is not modelled (one refresh for a move). */
hooks.on("updateToken", (doc, changes) => {
    if (doc?.parent !== canvas.scene) return;
    const c = changes ?? {};
    const flags = {};
    if (["x", "y", "elevation", "level"].some(k => k in c)) flags.refreshPosition = true;
    if ("width" in c || "height" in c) flags.refreshSize = true;
    if ("hidden" in c) flags.refreshVisibility = true;
    if (Object.keys(flags).length) canvas.tokens._wrap(doc).renderFlags.set(flags);
});
hooks.on("createToken", doc => {
    if (doc?.parent !== canvas.scene) return;
    canvas.tokens._wrap(doc).renderFlags.set({ refreshVisibility: true, refreshPosition: true, refreshSize: true, refreshState: true });
});
/* `canvas.rendered` IS A GROUP, NOT A FLAG (E11 fix r2-H5, 11.10.2026; the round-2 goal review's five Fog
   "reveal on arrival" TypeErrors in 65's log). Foundry's `canvas.rendered` is the canvas group that holds
   `canvas.primary` and `canvas.interface`, and the fog mounts its layer there, just below the interface
   (fog.mjs `mountLayer`, `canvas?.rendered ?? canvas?.stage`). This shim set it to `true` at boot, so the
   mount read `true.children` and threw - "Cannot read properties of undefined (reading 'indexOf')" in
   `placeLayer`, under `revealStartingRooms` (scenario 65 at bc20730: five, four on gm2 and one on gm).
   Nothing in scripts/ reads it as a flag (git grep, 11.10.2026). Mounted, the reveal went further and met
   two more gaps of the shim's: a Container without `setChildIndex` (lib/shim.mjs) and no `CanvasAnimation`
   (below, `foundry.canvas.animation`). */
canvas.rendered = new PIXI.Container();
canvas.rendered.addChild(canvas.primary, canvas.interface);
canvas.stage.addChild(canvas.rendered);

/* A DOOR CONTROL, AS FAR AS WHETHER IT IS DRAWN (E12 C13, 11.10.2026; audit S07-04). Foundry makes each
   door's control from `CONFIG.Canvas.doorControlClass` and keeps them in `canvas.controls.doors`; the audit
   read in its door-control.mjs that `isVisible` answers true at once while the scene's token vision is off,
   as the room fog leaves every scene with rooms. That answer is the one modelled, on every scene: Foundry's
   sight test with vision on is not (the harness has no vision), and true is the least this could hide. A
   scenario adds the controls it asks about itself; no seeded scene has a wall. What a real canvas draws is
   LIVE-E12-05. */
class DoorControl extends PIXI.Container {
    constructor(wall) {
        super();
        this.wall = wall;
        this.visible = false;
    }
    get isVisible() { return true; }
}
canvas.controls = { doors: new PIXI.Container() };

/* THE FLOOR ON SCREEN AND THE WAY A SCENE IS VIEWED (E12 C0, 11.10.2026; plan-E12 2.1 and 1.x item 7).
   `canvas.level` is the floor this client looks at: the one a view named, while it is a floor of the viewed
   scene, else that scene's lowest (by elevation, the order the owner's item 5 gives the floors), else null - every
   seeded scene, which has none. Which floor v14 opens a scene on was not read (LIVE-E12-02). `_viewScene` is what
   `Scene#view` and `#activate` call (lib/shim.mjs): it puts the scene on this canvas and fires `canvasReady`, as a
   draw ends; a scenario that only assigns `canvas.scene` fires nothing, as before. */
let viewedLevelId = null;
Object.defineProperty(canvas, "level", {
    configurable: true, enumerable: true,
    get() {
        const levels = canvas.scene?.levels ?? [];
        return levels.find(level => level.id === viewedLevelId) ?? [...levels].sort((a, b) => a.elevation - b.elevation)[0] ?? null;
    },
    set(level) { viewedLevelId = level?.id ?? level ?? null; }
});
game._viewScene = (scene, { level = null } = {}) => {
    canvas.scene = scene ?? null;
    viewedLevelId = level?.id ?? level ?? null;
    hooks.callAll("canvasReady", canvas);
    return canvas;
};

// Foundry's WorldCollection getters the mock's plain Collection lacks.
Object.defineProperty(game.scenes, "active", { get: () => game.scenes.find(s => s._source.active) });
Object.defineProperty(game.scenes, "viewed", { get: () => canvas.scene });
/* `Scenes#preload(sceneId, push)` (E13 C0, 11.10.2026; plan-E13 2.1 item 3): loads a scene's textures ahead
   of its draw, and with `push` asks every connected client to. The harness loads no texture, so the stub
   only keeps each call, on the client that made it, in `__scenePreloads`; whether a pushed preload reaches
   the other clients is not modelled. Nothing in scripts/ called it at 48efd99 (git grep). */
globalThis.__scenePreloads = [];
game.scenes.preload = async (sceneId, push = false) => {
    globalThis.__scenePreloads.push({ sceneId, push: Boolean(push) });
    return [];
};

/* -------------------------------- ui ------------------------------------- */

function record(level) {
    return (msg, opts = {}) => {
        globalThis.__notifications.push({ level, msg: String(msg), opts, at: Date.now() });
        logLine(`[notify:${level}] ${msg}`);
        return globalThis.__notifications.length;
    };
}
/*
 * THE CHAT LOG'S CLASS, as far as its notifier (E06 C6): the class `ui.chat` is made from, with a
 * `notify` that keeps the ids it was handed in `__chatNotified`, and in `__chatRung` those whose
 * message had a sound to play. secret.mjs wraps it (`quietVeiledPip`). It is called as a message
 * is created (the hook above, E06 fix r1-G2); which method lights the pip in v14 is LIVE-E06-04.
 */
class HarnessChatLog {
    notify(message) {
        (globalThis.__chatNotified ??= []).push(message?.id ?? null);
        if (message?.sound) (globalThis.__chatRung ??= []).push(message.id ?? null);
    }
    // Foundry's `ChatLog#updateMessage`, which draws a card in the log again: kept, not drawn, as
    // this log draws nothing (`postOne`). A test draws the card itself (`renderHTML` below).
    // A card whose li the log does not hold is not passed over by Foundry: it is posted anew, before the next
    // visible message (v12/v13 source, as the E18 review read it; v14's is LIVE-E18-04), so for an old card under
    // the newest one. Kept apart (`__chatPostedAnew`), for a test that draws an li of its own (E18 fix early-C4-G3).
    updateMessage(message) {
        const id = message?.id ?? null;
        (globalThis.__chatRedrawn ??= []).push(id);
        const drawn = typeof id === "string" && /^[A-Za-z0-9]+$/.test(id)
            && Boolean(this.element?.querySelector?.(`[data-message-id="${id}"]`));
        if (!drawn) (globalThis.__chatPostedAnew ??= []).push(id);
    }
}
globalThis.ui = {
    notifications: { info: record("info"), warn: record("warn"), error: record("error"), notify: record("notify"), remove() {}, clear() {} },
    // Daggerheart's Fear tracker, as far as modifyResource uses it (lib/daggerheart.mjs).
    resources: { updateFear },
    chat: Object.assign(new HarnessChatLog(), { element: document.querySelector("#chat"), scrollBottom() {}, render() {}, postOne() {}, collapsed: false }),
    /* `expanded`, `toggleExpanded` and `changeTab` as foundry-windows.mjs calls them (E77 C5): the state only, read
       from memory of v13's Sidebar and not measured on v14 - R511 reads the wrappers against this, a table the rest. */
    sidebar: { element: document.querySelector("#sidebar"), tabs: {}, render() {}, expand() { this.toggleExpanded(true); }, collapse() { this.toggleExpanded(false); }, activateTab() {},
        expanded: false, toggleExpanded(expanded) { this.expanded = expanded ?? !this.expanded; }, changeTab(tab) { this.activeTab = tab; } },
    windows: {},
    players: { render() {}, element: document.querySelector("#players") },
    /* `control` and `activate` as foundry-windows.mjs asks a player's layer back to Tokens (E77 C5; v13's shape,
       from memory - LIVE-E77-11). */
    controls: { render() {}, controls: [], activeControl: "token", control: { name: "tokens" }, activate({ control } = {}) { if (control) this.control = { name: control }; } },
    nav: { render() {}, element: document.querySelector("#navigation") },
    hotbar: { render() {}, element: document.querySelector("#hotbar") },
    pause: { render() {} },
    activeWindow: null
};

/* ------------------------------ CONFIG ----------------------------------- */

/* v14's message modes as Daggerheart 2.10.5's roll dialog lists them - `Object.entries(CONFIG.ChatMessage.modes)`
   to `{ action, label, icon }` (d20RollDialog.mjs :75) - and as the module's `privateModeFields` looks one up by
   key. The keys are the audit's reading of v14; what the real table holds is LIVE-E33-03. */
const MESSAGE_MODES = {
    public: { label: "Public Roll", icon: "fa-solid fa-globe" },
    gm: { label: "Private GM Roll", icon: "fa-solid fa-user-secret" },
    blind: { label: "Blind GM Roll", icon: "fa-solid fa-eye-slash" },
    self: { label: "Self Roll", icon: "fa-solid fa-user" }
};

function polygonBackends() {
    const { ClockwiseSweepPolygon } = buildPolygonBackends();
    return { sight: ClockwiseSweepPolygon, light: ClockwiseSweepPolygon, sound: ClockwiseSweepPolygon, move: ClockwiseSweepPolygon };
}

globalThis.CONFIG = {
    debug: { hooks: false },
    // Foundry's own selection colours (CONTROLLED is its orange).
    /* One class for each polygon type (shim.mjs buildPolygonBackends, E79 C2). */
    Canvas: { dispositionColors: { CONTROLLED: 0xFF9829 }, doorControlClass: DoorControl, polygonBackends: polygonBackends() },
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
    ChatMessage: { documentClass: classes.ChatMessage, template: "", modes: MESSAGE_MODES },
    User: { documentClass: classes.User },
    RollTable: { documentClass: classes.RollTable },
    Playlist: { documentClass: classes.Playlist },
    Macro: { documentClass: classes.Macro },
    ActiveEffect: { documentClass: classes.ActiveEffect },
    Region: { documentClass: classes.Region },
    /* Foundry's randomiser, which every die draws from (lib/shim.mjs `Die`): `Math.random` here,
       a Mersenne Twister at a table. A test may script it, as forced-roll.mjs does (E08+E28 C10). */
    Dice: { rolls: [RollImpl], types: [], terms: {}, termTypes: {}, randomUniform: () => Math.random() },
    queries: {},
    canvasTextStyle: {},
    fontDefinitions: {},
    // Foundry's core dice sound, which Daggerheart puts on a roll's message (dhRoll.mjs:150).
    sounds: { dice: "sounds/dice.wav" },
    TextEditor: {}
};

/* ------------------------- foundry namespace ----------------------------- */

const CONST = {
    USER_ROLES: { NONE: 0, PLAYER: 1, TRUSTED: 2, ASSISTANT: 3, GAMEMASTER: 4 },
    /* The two permissions the module holds (E79 C9, N4), each from the Trusted Player up: v14's own
       default roles are not readable here (fvtt-types names the permissions only; LIVE-E79-11), and
       from role 2 is the more open of the two readings the design weighed, so a Trusted Player browses
       here until the module holds it - never less than a Foundry whose default stands higher. */
    USER_PERMISSIONS: {
        FILES_BROWSE: { label: "PERMISSION.FilesBrowse", defaultRole: 2 },
        FILES_UPLOAD: { label: "PERMISSION.FilesUpload", defaultRole: 2 },
        /* The microphone permission both blocks write on a user (voice-tile.mjs `toggleBlock`, voice.mjs `blockForTrial`),
           which now write nothing on a Foundry without it (E52 C3, E52-13). Its default role as an older Foundry's
           constants state it, from memory: v14's is not read here. */
        BROADCAST_AUDIO: { label: "PERMISSION.BroadcastAudio", defaultRole: 2 }
    },
    DOCUMENT_OWNERSHIP_LEVELS: { INHERIT: -1, NONE: 0, LIMITED: 1, OBSERVER: 2, OWNER: 3 },
    TOKEN_DISPOSITIONS: { SECRET: -2, HOSTILE: -1, NEUTRAL: 0, FRIENDLY: 1 },
    CHAT_MESSAGE_STYLES: { OTHER: 0, OOC: 1, IC: 2, EMOTE: 3 },
    REGION_EVENTS: { TOKEN_ENTER: "tokenEnter", TOKEN_EXIT: "tokenExit", TOKEN_MOVE_IN: "tokenMoveIn", TOKEN_MOVE_OUT: "tokenMoveOut" },
    KEYBINDING_PRECEDENCE: { PRIORITY: 0, NORMAL: 1, DEFERRED: 2 },
    WALL_DOOR_TYPES: { NONE: 0, DOOR: 1, SECRET: 2 }
};
globalThis.CONST = CONST;
/* v13's roll-mode constant as v14 has it (E33 C11, 07.10.2026): a deprecation. Daggerheart 2.10.5 reads
   the modes off `CONFIG.ChatMessage.modes` and the `core.messageMode` setting instead (d20RollDialog.mjs
   :74-75, dhRoll.mjs :159); that the constant is deprecated in 14 and gone in 16 is the audit's reading
   (U05-roll-pipeline-15; foundryvtt.com is refused here, so it is second-hand). A getter, so that a read
   is counted (`__diceRollModesReads`) and warned, and a scenario can put a throwing one in its place. */
Object.defineProperty(CONST, "DICE_ROLL_MODES", {
    configurable: true, enumerable: false,
    get() {
        globalThis.__diceRollModesReads = (globalThis.__diceRollModesReads ?? 0) + 1;
        console.warn("(harness) CONST.DICE_ROLL_MODES read: deprecated in v14 and gone in v16 - CONFIG.ChatMessage.modes is the v14 road");
        return { PUBLIC: "publicroll", PRIVATE: "gmroll", BLIND: "blindroll", SELF: "selfroll" };
    }
});


globalThis.foundry = {
    CONST,
    utils: {
        ...U,
        Color: U.Color,
        fetchWithTimeout: globalThis.fetch,
        fromUuid: uuid => globalThis.fromUuid(uuid),
        benchmark: async fn => fn(),
        /* A file the module hands the browser to save, kept instead (E04): a scenario reads
           `__savedFiles` and gives the text back to a restore. What a real browser does with
           the download is LIVE-E04-05. */
        saveDataToFile: (data, type, filename) => { globalThis.__savedFiles.push({ data: String(data), type, filename }); },
        /* A chosen file's text. A harness "file" is the text itself, or `{ text }`. */
        readTextFromFile: async file => (typeof file === "string" ? file : String(file?.text ?? ""))
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
        sidebar: { tabs: { ChatLog: HarnessChatLog } },
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
        /* `CanvasAnimation.animate` ends at once: every attribute at its `to`, one tick, true - what Foundry's
           answers when an animation completes. Headless there is no ticker to run it on, and the fog's reveal
           (fog-reveal.mjs, fog.mjs) reached it once its layer could mount (E11 fix r2-H5, 11.10.2026). */
        animation: {
            animateLinear: async () => {},
            CanvasAnimation: {
                animate: async (attributes, { ontick } = {}) => {
                    for (const { parent, attribute, to } of attributes) parent[attribute] = to;
                    ontick?.(0, { attributes });
                    return true;
                }
            }
        },
        /* The group whose `createScrollingText` no-scrolling-text.mjs wraps. Headless it draws
           nothing and answers null, what the real one answers when it declines to draw. */
        groups: { InterfaceCanvasGroup: class InterfaceCanvasGroup { createScrollingText() { return null; } } },
        loadTexture: async p => {
            const rel = String(p).replace(/^\/?modules\/danganronpa-rpg\//, "");
            const file = path.join(REPO, rel);
            return fs.existsSync(file) ? new PIXI.Texture(p) : null;
        }
    },
    /* The fields whose change is a move (E12 C0): plan-E12 3.2's list, which C9's `MOVE_FIELDS` falls back to. v13's
       BaseToken names x, y, elevation, width, height and shape, as recalled, not read; v14's `level` and `depth` are
       the plan's reading - LIVE-E12-02. */
    documents: { BaseToken: { MOVEMENT_FIELDS: Object.freeze(["x", "y", "elevation", "width", "height", "depth", "shape", "level"]) } },
    dice: { Roll: RollImpl, terms: { Die, NumericTerm, OperatorTerm } },
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

/*
 * Two of Foundry's own additions to the language that Daggerheart's dice call (dhRoll.mjs:59, :232) -
 * shim, written from Foundry's documented behaviour, not measured against its source (E33 C2a).
 */
Object.defineProperty(String.prototype, "capitalize", { configurable: true, writable: true, value: function capitalize() {
    return this.length ? this.charAt(0).toUpperCase() + this.slice(1) : String(this);
} });
Number.isNumeric = n => !Array.isArray(n) && ![null, ""].includes(n) && +n === +n;

/* Daggerheart's dice classes extend Foundry's (`foundry.dice.Roll`, `foundry.dice.terms.Die`) as their
   files are evaluated, so they are imported here, once the namespace above stands. */
const { default: DaggerheartDualityRoll } = await import("./lib/dh-dice/dice/dualityRoll.mjs");
const { diceTypes: daggerheartDice } = await import("./lib/dh-dice/dice/die/_module.mjs");
installDualityRoll(DaggerheartDualityRoll, daggerheartDice);
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
    for (const [k, id] of Object.entries(snap.settingWriters ?? {})) worldWriters.set(k, id);
    // users wiring
    game.user = game.users.get(snap.you);
    game.userId = snap.you;
    const active = game.scenes.find(s => s.active);
    if (active) { canvas.scene = active; }
}

function findEmbKey(parentName, embName) {
    // A region's behaviours as cluster.mjs `embKey` has them (E12 fix r2-S2, 11.10.2026; scenario 66 X3 and X4).
    const map = { Actor: { Item: "items", ActiveEffect: "effects" }, Scene: { Token: "tokens", Region: "regions", Wall: "walls" }, RollTable: { TableResult: "results" }, Playlist: { PlaylistSound: "sounds" }, Item: { ActiveEffect: "effects" }, Region: { RegionBehavior: "behaviors" } };
    return map[parentName]?.[embName];
}

/* What this client has been sent created and deleted, by document name - `createToken`, `deleteScene` - for a
   scenario that asks whether anything was (E13 C0, 11.10.2026; plan-E13 2.1 item 4). */
globalThis.__documentCounts = {};
const counted = (kind, name, n = 1) => { const key = `${kind}${name}`; globalThis.__documentCounts[key] = (globalThis.__documentCounts[key] ?? 0) + n; };

function applyRemote(msg) {
    const { action, collName, userId, options = {} } = msg;
    if (action === "create" || action === "delete") counted(action, collName, action === "create" ? msg.docs.length : 1);
    if (action === "embedded-create" || action === "embedded-delete") counted(action.slice("embedded-".length), msg.embeddedName, (msg.docs ?? msg.ids).length);
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
        /* A FIELD AN UPDATE BRINGS IS READ AS A PROPERTY (E13 fix n1-N1, 12.10.2026). The shim put a document's
           fields on it at construction only (lib/shim.mjs `_exposeSource`; `updateSource` already re-ran it), so a
           field the create had not written read `undefined` after the update that wrote it: 66 X7's
           `behavior.update({ disabled: true })` read `disabled` null, and a scene made without `fog` never read the
           fog the room fog wrote, so `prepareScenes` counted every scene with rooms again at each call (three for
           one, the tier-2 test "one scene put into room-based vision is said as one scene and two as two"). In v14
           every field of the schema is on the document from its creation and follows each update (fvtt-types
           14.366.0-beta: common/abstract/data.d.mts `_initialize` copies the source to the instance, and
           common/documents/region-behavior.d.mts:328 has `disabled` a BooleanField) - read in the typings, not
           at a table. The shim still holds no defaults: a field nobody wrote reads `undefined`, as before. */
        doc._exposeSource?.();
        // refresh embedded collections if raw arrays were replaced wholesale
        rebuildEmbedded(doc);
        if (!options.noHook) hooks.callAll(`update${collName}`, doc, revive(U.expandObject(U.deepClone(msg.changes))), options, userId);
        /* A SCENE MADE ACTIVE IS VIEWED BY EVERY CLIENT (E13 C0, 11.10.2026; plan-E13 2.1 item 1, A5's reading
           of Foundry: `Scene#_onUpdate` calls `view()` when `active` turns true, on every client that hears the
           update, the GM who made it included). Until C0 only `Scene#activate`'s caller moved its own canvas
           (lib/shim.mjs), and no other client followed. After the hook, because Foundry's draw that ends in
           `canvasReady` is awaited after `_onUpdate` returns and the hook has fired. A client still loading
           only warns (`Scene#view`). `active: false` moves nobody's canvas, here as in what A5 read. */
        if (collName === "Scene" && msg.changes?.active === true) doc.view();
        return;
    }
    if (action === "delete") {
        const c = coll(collName);
        const doc = c.get(msg.docId);
        if (!doc) return;
        c.delete(msg.docId);
        /* WITHOUT `deleteAll`, AS FOUNDRY HANDS IT (E81 C5, 12.10.2026; the A7 design's P5-0). Foundry 14.365
           takes `deleteAll` out of the options before the delete hooks run (client-backend.mjs:439, :466 - the
           design's reading of Foundry's file, not re-read here; whether a real 14.x still does is LIVE-E81-11),
           so a hook cannot tell a cleared log from a single deletion. The harness passed it through, and a
           history that kept entries on `deleteAll` would have passed here and failed at a table. */
        const hookOptions = { ...options };
        delete hookOptions.deleteAll;
        if (!options.noHook) hooks.callAll(`delete${collName}`, doc, hookOptions, userId);
        return;
    }
    if (action.startsWith("embedded-")) {
        const root = coll(collName).get(msg.docId);
        /* An effect on an actor's item comes `via` that item (E29 fix r1-G3; lib/shim.mjs `_embeddedOp`): it lands
           in the item's own list and collection, and in the actor's raw copy of the item where that is another object. */
        const viaKey = msg.via ? findEmbKey(collName, msg.via.embeddedName) : null;
        const parent = msg.via ? root?._collections[viaKey]?.get(msg.via.id) : root;
        if (!parent) return;
        const embKey = findEmbKey(parent.documentName, msg.embeddedName);
        const held = msg.via ? (root._source[viaKey] ?? []).find(d => d._id === msg.via.id) : null;
        const lists = [parent._source, ...(held && held !== parent._source ? [held] : [])];
        const cls = classes[msg.embeddedName] ?? classes.BaseDocument;
        const kind = action.slice("embedded-".length);
        if (kind === "create") {
            for (const d of msg.docs) {
                for (const src of lists) (src[embKey] = src[embKey] ?? []).push(U.deepClone(d));
                const doc = new cls(d, { parent });
                parent._collections[embKey]?.set(doc.id, doc);
                hooks.callAll(`create${msg.embeddedName}`, doc, options, userId);
            }
        } else if (kind === "update") {
            for (const u of msg.updates) {
                const raws = lists.map(src => (src[embKey] ?? []).find(d => d._id === u._id)).filter(Boolean);
                const doc = parent._collections[embKey]?.get(u._id);
                if (!raws.length || !doc) continue;
                const { _id, ...changes } = u;
                /* E89 C0 (30.10.2026; LIVE-E89-03): a token's `movement`, on the model - what the update's own `movement`
                   option names for it (`{ pending: { waypoints } }`), the request and v14's record of the move not told
                   apart; null for an update that names none. One dragged path is N updates, every one but the last with
                   waypoints still pending: how many v14 delivers is LIVE-E89-03. */
                if (msg.embeddedName === "Token") doc._drpgMovement = options.movement?.[u._id] ?? null;
                // An item's own `effects` merge by id, and its collection follows them, as an actor's do (fix r2-H8; cluster.mjs).
                for (const raw of raws) U.applyDocChanges(msg.embeddedName, raw, changes);
                // One object, not two, once a parent's update has rebuilt the collection (rebuildEmbedded).
                if (!raws.includes(doc._source)) U.applyDocChanges(msg.embeddedName, doc._source, changes);
                doc._exposeSource?.();   // the field the update brought, as for a world document above
                rebuildEmbedded(doc);
                hooks.callAll(`update${msg.embeddedName}`, doc, revive(U.expandObject(U.deepClone(changes))), options, userId);
            }
        } else if (kind === "delete") {
            for (const id of msg.ids) {
                const doc = parent._collections[embKey]?.get(id);
                for (const src of lists) src[embKey] = (src[embKey] ?? []).filter(d => d._id !== id);
                parent._collections[embKey]?.delete(id);
                if (doc) hooks.callAll(`delete${msg.embeddedName}`, doc, options, userId);
            }
        }
    }
}

function rebuildEmbedded(doc) {
    const emb = { Actor: { Item: "items", ActiveEffect: "effects" }, Item: { ActiveEffect: "effects" }, Scene: { Token: "tokens", Region: "regions", Wall: "walls" }, RollTable: { TableResult: "results" }, Playlist: { PlaylistSound: "sounds" } }[doc.documentName];
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
            if (existing) { existing._source = d; existing._exposeSource?.(); }
            else c.set(d._id, new cls(d, { parent: doc }));
        }
        for (const id of [...c.keys()]) if (!seen.has(id)) c.delete(id);
    }
}

/* --------------------------- message loop --------------------------------- */

let booted = false;
/* Held at the end of the canvas's load until the cluster says "loaded" (cluster.mjs `connect`, `holdLoading`). */
let holdLoading = false, releaseLoading = null;

process.on("message", async msg => {
    try {
        switch (msg.t) {
            case "snapshot": {
                applySnapshot(msg);
                if (!booted) {
                    // A browser that has been here before (cluster.mjs `connect`, E04): its
                    // localStorage as it was, before the module reads a setting.
                    for (const [key, raw] of Object.entries(msg.storage ?? {})) globalThis.localStorage.setItem(key, String(raw));
                    holdLoading = Boolean(msg.holdLoading);
                    booted = true;
                    await boot();
                }
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
            case "loaded": {
                releaseLoading?.();
                break;
            }
            case "settingApplied": {
                worldValues.set(msg.key, msg.value);
                if (msg.userId) worldWriters.set(msg.key, msg.userId);
                const def = settingDefs.get(msg.key);
                if (def) { try { def.onChange?.(coerce(def, msg.value)); } catch (err) { logLine(`setting onChange ${msg.key}: ${err.stack}`); recordError(`setting onChange ${msg.key}`, err); } }
                /* Foundry's shape, `(document, changed, options, userId)`: until E16 fix r1b-G1 (19.10.2026) the writer's
                   id was handed third, where a listener reads the options, so no listener could tell who wrote a world
                   setting (dice-sync.mjs `onSwitchWritten`, tests-kit.mjs `watchWrites`, which took every write for
                   this client's own). */
                if (!msg.noHook) hooks.callAll("updateSetting", { key: msg.key, value: msg.value }, { value: msg.value }, {}, msg.userId);
                break;
            }
            case "socketMsg": {
                // Foundry hands a module socket handler `(payload, senderId)`. The
                // emit's options (`{ recipients }`) are for the server, not the handler.
                const drawn = msg.args?.[0];
                if (drawn?.action === "roll.draw" && drawn.__harnessForceRoll && typeof drawn.nonce === "string" && game.user?.isGM) {
                    relayedFaces.set(drawn.nonce, drawn.__harnessForceRoll);
                }
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
                // Another client left or came (cluster.mjs `disconnect`, `connect`): this browser
                // learns it the way the module listens for it, `userConnected`. v14's flow is
                // LIVE-E30-05 for one leaving and LIVE-E04-12 for one joining.
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
            case "dump": {
                // Not through eval: safeJson turns a document into { _doc, id, name }.
                let value = null, error = null;
                try { value = dumpForCanary(); } catch (err) { error = String(err?.stack ?? err); }
                send({ t: "dumpResult", id: msg.id, value, error });
                break;
            }
            case "shutdown": {
                // The peak memory of this client's whole life, for the results file
                // (cluster.mjs, PEAK MEMORY). The exit waits for send's callback:
                // Node documents that process.exit() does not wait for pending writes.
                // And what this browser's localStorage holds as it closes (E04): a GM who
                // disconnects keeps its store, for `storageOf` and a later `connect`.
                const kept = {};
                for (let i = 0; i < globalThis.localStorage.length; i++) {
                    const key = globalThis.localStorage.key(i);
                    kept[key] = globalThis.localStorage.getItem(key);
                }
                const bye = { t: "bye", maxRSS: process.resourceUsage().maxRSS, storage: kept };
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

/*
 * THIS BROWSER, WHOLE, FOR THE CANARY (E30, 24.09.2026). The shape does not depend
 * on the harness - a live driver can build it on a real table - and lib/canary.mjs
 * reads it: the wire record, every document's source, world settings, client
 * settings (this browser's localStorage, as Foundry keeps them), both storages, the
 * page, the notifications and the dialogs. isGM is the client's own answer, so an
 * Assistant GM counts as a GM.
 */
function dumpForCanary() {
    const entries = store => {
        const out = {};
        for (let i = 0; i < (store?.length ?? 0); i++) { const k = store.key(i); out[k] = store.getItem(k); }
        return out;
    };
    return JSON.parse(JSON.stringify({
        who: WHO, userId: game.userId ?? game.user?.id ?? null, isGM: Boolean(game.user?.isGM), phase: PHASE,
        wire: WIRE, wireDropped,
        world: Object.fromEntries([...worldColls].map(([name, c]) => [name, c.contents.map(d => d.toObject())])),
        settings: { world: Object.fromEntries(worldValues), client: Object.fromEntries(clientValues.entries()) },
        storage: { local: entries(globalThis.localStorage), session: entries(globalThis.sessionStorage) },
        dom: document.documentElement.outerHTML,
        notifications: globalThis.__notifications, dialogs: globalThis.__dialogLog
    }));
}

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
        if (holdLoading) {
            send({ t: "loading" });
            await new Promise(resolve => { releaseLoading = resolve; });
        }
        canvas.loading = false;
        canvas.ready = true;
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
