/**
 * One Foundry "client" - a forked child process. env: DRPG_USER, DRPG_REPO.
 * Talks to cluster.mjs over IPC. Boots jsdom + shim, imports the module,
 * walks init → i18nInit → setup → ready → canvasReady, then serves eval()s.
 */

import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import * as U from "./lib/futil.mjs";
import { HooksImpl, Collection, buildDocumentClasses, buildPIXI, buildApplications, RollImpl, REPO, MODULE_ID } from "./lib/shim.mjs";

const WHO = process.env.DRPG_USER ?? "gm";
const send = m => process.send?.(m);
const logLine = s => send({ t: "log", line: String(s) });

process.on("uncaughtException", err => logLine(`UNCAUGHT: ${err.stack}`));
process.on("unhandledRejection", err => logLine(`UNHANDLED REJECTION: ${err?.stack ?? err}`));

/* ------------------------------ jsdom ----------------------------------- */

const dom = new JSDOM(`<!doctype html><html><head></head><body>
  <div id="interface"><div id="ui-left"></div><div id="ui-top"></div><div id="ui-middle"></div><div id="ui-right"></div><div id="ui-bottom"></div></div>
  <div id="sidebar"><section id="chat"><ol id="chat-log"></ol><div id="chat-controls"></div></section></div>
  <div id="players"></div><div id="hotbar"></div><nav id="controls"></nav><div id="navigation"></div><div id="pause"></div>
</body></html>`, { url: "http://localhost:30000/game", pretendToBeVisual: true });

globalThis.window = dom.window;
globalThis.document = dom.window.document;
for (const k of ["HTMLElement", "HTMLInputElement", "HTMLSelectElement", "HTMLTextAreaElement", "HTMLButtonElement", "HTMLFormElement", "HTMLAnchorElement", "HTMLImageElement", "Element", "Node", "NodeList", "Event", "CustomEvent", "KeyboardEvent", "MouseEvent", "PointerEvent", "DragEvent", "FocusEvent", "InputEvent", "MutationObserver", "DOMParser", "FileReader", "Image", "navigator", "localStorage", "sessionStorage", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "CSS"]) {
    // ALWAYS take jsdom's class: Node ships its own Event/CustomEvent globals,
    // and dispatching a Node-realm Event on a jsdom EventTarget throws.
    if (dom.window[k] !== undefined) {
        try { globalThis[k] = dom.window[k]; } catch {}
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

/*
 * Serve CSS custom properties from the REAL stylesheets, so the module's
 * stylesheet-version and theme-token checks measure the actual shipped files
 * (jsdom does not cascade custom props itself). Later declarations win,
 * matching the cascade for same-specificity :root rules.
 */
const cssVars = new Map();
for (const cssFile of ["styles/motion.css", "styles/danganronpa.css", "styles/messenger.css"]) {
    try {
        const text = fs.readFileSync(path.join(process.env.DRPG_REPO || "/home/user/Danganronpa-RPG", cssFile), "utf8");
        for (const m of text.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)[;}]/g)) cssVars.set(m[1], m[2].trim());
    } catch {}
}
{
    const realGCS = window.getComputedStyle.bind(window);
    const wrap = el => {
        const cs = realGCS(el);
        return new Proxy(cs, {
            get(target, prop) {
                if (prop === "getPropertyValue") {
                    return p => {
                        if (String(p).startsWith("--") && cssVars.has(p)) return cssVars.get(p);
                        return target.getPropertyValue(p);
                    };
                }
                const v = target[prop];
                return typeof v === "function" ? v.bind(target) : v;
            }
        });
    };
    window.getComputedStyle = wrap;
    globalThis.getComputedStyle = wrap;
}
{
    // The three module stylesheets Foundry would attach are "on the page".
    for (const href of ["modules/danganronpa-rpg/styles/motion.css", "modules/danganronpa-rpg/styles/danganronpa.css", "modules/danganronpa-rpg/styles/messenger.css"]) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        document.head.appendChild(link);
    }
}

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
globalThis.__errors = [];

const ctx = {
    bus,
    hooks: () => hooks,
    gameRef: () => game,
    userId: () => game.userId,
    log: logLine,
    classes: null
};
const classes = buildDocumentClasses(ctx);
const PIXI = buildPIXI();
globalThis.PIXI = PIXI;
const apps = buildApplications(ctx);

/* ------------------------------ i18n ------------------------------------- */

const enJson = JSON.parse(fs.readFileSync(path.join(REPO, "lang/en.json"), "utf8"));
const i18n = {
    lang: "en",
    translations: enJson,
    localize(key) {
        const v = U.getProperty(enJson, key);
        if (typeof v === "string") return v;
        globalThis.__missingI18n.add(key);
        return key;
    },
    format(key, data = {}) {
        let s = this.localize(key);
        for (const [k, v] of Object.entries(data)) s = s.replaceAll(`{${k}}`, String(v));
        return s;
    },
    has(key) { return typeof U.getProperty(enJson, key) === "string"; }
};

/* ---------------------------- settings ----------------------------------- */

const settingDefs = new Map();   // "ns.key" -> def
const worldValues = new Map();   // "ns.key" -> value (synced)
const clientValues = new Map();  // "ns.key" -> value (local)

/** Foreign namespaces whose settings the system/other modules would register. */
const FOREIGN_SETTING_DEFAULTS = {
    "daggerheart.Countdowns": { scope: "world", default: { countdowns: {} } },
    "daggerheart.Appearance": { scope: "world", default: {} },
    "daggerheart.Automation": { scope: "world", default: { hope: true } },
    "dice-so-nice.Appearance": { scope: "client", default: {} },
    "core.rollMode": { scope: "client", default: "publicroll" }
};

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
        const def = settingDefs.get(full);
        if (!def) throw new Error(`Setting ${full} is not registered`);
        if (def.scope === "world") {
            await bus.setSetting(full, JSON.parse(JSON.stringify(value ?? null)));
        } else {
            clientValues.set(full, JSON.parse(JSON.stringify(value ?? null)));
            try { def.onChange?.(value); } catch (err) { logLine(`setting onChange ${full}: ${err.stack}`); }
            hooks.callAll("clientSettingChanged", full, value);
        }
        return value;
    },
    storage: { get: scope => (scope === "world" ? worldValues : clientValues) }
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
addModule(MODULE_ID, { title: moduleManifest.title, version: moduleManifest.version, relationships: moduleManifest.relationships, socket: true });
addModule("dice-so-nice", { title: "Dice So Nice!", version: "5.1.1" });
addModule("isometric-perspective", { title: "Isometric Perspective", version: "1.9.4" });
addModule("avclient-livekit", { title: "LiveKit AV Client", version: "0.6.1" });

/**
 * Daggerheart's ResourceUpdateMap stand-in: a Map keyed by resource whose
 * values are entry objects {key, value, enabled}, plus the two methods the
 * module drives (addResources / updateResources). updateResources applies the
 * pending entries to the actor and clears the map, so a second call is a no-op.
 */
class ResourceUpdateMap extends Map {
    constructor(actor) { super(); this.actor = actor; }
    addResources(entries = []) {
        for (const c of entries) {
            const prev = this.get(c.key)?.value ?? 0;
            this.set(c.key, { key: c.key, enabled: c.enabled ?? true, ...c, value: prev + (c.value ?? 0) });
        }
    }
    async updateResources() {
        if (!this.actor || !this.size) { this.clear(); return; }
        const changes = {};
        for (const [key, entry] of this) {
            if (entry?.enabled === false) continue;
            const res = this.actor.system?.resources?.[key];
            if (!res) continue;
            const max = Number(res.max ?? 99);
            const next = Math.max(0, Math.min(max, Number(res.value ?? 0) + Number(entry.value ?? 0)));
            changes[`system.resources.${key}.value`] = next;
        }
        this.clear();
        if (Object.keys(changes).length) await this.actor.update(changes);
    }
}

class DualityRollMock {
    /**
     * Daggerheart 2.6.5 stand-in for the resource funnel the module patches:
     * hope-side pays +1 Hope; a critical pays +1 Hope and clears 1 Stress.
     * The module's critical.mjs is expected to rewrite the critical to
     * +2 Hope / no Stress (G-16).
     */
    get advantageNumber() { return this._adv ?? 1; }
    set advantageNumber(v) { this._adv = v; }
    applyAdvantage(count = 1) { this._adv = count; return `${count}d6kh`; }
    static applyAdvantage(count = 1) { return `${count}d6kh`; }

    static async addDualityResourceUpdates(config) {
        const map = config.resourceUpdates;
        if (!map) return config;
        const roll = config.roll ?? config;
        const duality = roll?.result?.duality;
        if (roll?.isCritical) {
            map.addResources([{ key: "hope", value: 1 }, { key: "stress", value: -1 }]);
        } else if (duality === 1) {
            map.addResources([{ key: "hope", value: 1 }]);
        }
        return config;
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
        id: "daggerheart", version: "2.6.5", title: "Daggerheart",
        api: { dice: { DualityRoll: DualityRollMock } }
    },
    world: { id: "drpg-audit-world", title: "DRPG Audit World" },
    version: "14.365",
    release: { generation: 14, build: 365 },
    ready: false,
    paused: false,
    togglePause(state) { game.paused = state ?? !game.paused; hooks.callAll("pauseGame", game.paused); },
    socket: {
        _handlers: new Map(),
        on(channel, fn) {
            if (!this._handlers.has(channel)) this._handlers.set(channel, []);
            this._handlers.get(channel).push(fn);
        },
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
    data: { version: "14.365" }
};
globalThis.game = game;

/*
 * Daggerheart actor surface the module drives. The roll skips the dialog when
 * game.drpg.suiteRolling is set (mirroring the real system's `dialog.configure`
 * contract); a scenario can force faces via globalThis.__forceRoll = {hope, fear}.
 */
classes.Actor.prototype.rollTrait = async function rollTrait(traitKey, config = {}) {
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

    const cfg = {
        ...config,
        actor: this,
        roll,
        total,
        costs: config.costs ?? [],
        resourceUpdates: new ResourceUpdateMap(this)
    };
    await game.system.api.dice.DualityRoll.addDualityResourceUpdates(cfg);
    // the system applies its own updates at the end of its pipeline
    await cfg.resourceUpdates.updateResources().catch(() => {});

    // A chat card faithful enough for despair-award.readDuality: two d12 dice in
    // Hope-then-Fear order, plus the actionType the reaction guard reads.
    const actionType = config[Symbol.for("drpgActionRoll")] || config.__drpgAction ? "action"
        : (config.reaction ? "reaction" : "action");
    const rollJson = {
        class: "DualityRoll", formula: roll.formula, total, evaluated: true,
        dHope: { total: hope }, dFear: { total: fear },
        dice: [{ faces: 12, total: hope, results: [{ result: hope, active: true }] },
               { faces: 12, total: fear, results: [{ result: fear, active: true }] }],
        options: { actionType }
    };
    cfg.message = await classes.ChatMessage.create({
        author: game.userId,
        speaker: classes.ChatMessage.getSpeaker({ actor: this }),
        content: `<div class="dice-roll">Duality: ${total}</div>`,
        rolls: [rollJson],
        system: { roll: rollJson },
        flags: {}
    });
    return cfg;
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
    DH: {
        RESOURCE: { character: { custom: {} } },
        GENERAL: {}
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
    REGION_EVENTS: { TOKEN_ENTER: "tokenEnter", TOKEN_EXIT: "tokenExit", TOKEN_MOVE_IN: "tokenMoveIn", TOKEN_MOVE_OUT: "tokenMoveOut" }
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
        animation: { animateLinear: async () => {} },
        loadTexture: async p => {
            const rel = String(p).replace(/^\/?modules\/danganronpa-rpg\//, "");
            const file = path.join(REPO, rel);
            return fs.existsSync(file) ? new PIXI.Texture(p) : null;
        }
    },
    documents: {},
    dice: { Roll: RollImpl, terms: {} },
    abstract: { DataModel: class {}, TypeDataModel: class {} },
    data: { fields: {}, validators: { isValidId: s => /^[A-Za-z0-9]{16}$/.test(s) } },
    helpers: { media: { ImageHelper: {} } },
    packages: {}
};

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
        for (const doc of docs) hooks.callAll(`create${collName}`, doc, options, userId);
        return;
    }
    if (action === "update") {
        const doc = coll(collName).get(msg.docId);
        if (!doc) return;
        U.applyDocChanges(collName, doc._source, msg.changes);
        // refresh embedded collections if raw arrays were replaced wholesale
        rebuildEmbedded(doc);
        hooks.callAll(`update${collName}`, doc, U.expandObject(U.deepClone(msg.changes)), options, userId);
        return;
    }
    if (action === "delete") {
        const c = coll(collName);
        const doc = c.get(msg.docId);
        if (!doc) return;
        c.delete(msg.docId);
        hooks.callAll(`delete${collName}`, doc, options, userId);
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
                U.mergeObject(raw, changes, { performDeletions: true });
                U.mergeObject(doc._source, changes, { performDeletions: true });
                hooks.callAll(`update${msg.embeddedName}`, doc, U.expandObject(U.deepClone(changes)), options, userId);
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
                if (def) { try { def.onChange?.(coerce(def, msg.value)); } catch (err) { logLine(`setting onChange ${msg.key}: ${err.stack}`); } }
                hooks.callAll("updateSetting", { key: msg.key, value: msg.value }, {}, msg.userId);
                break;
            }
            case "socketMsg": {
                const handlers = game.socket._handlers.get(msg.channel) ?? [];
                for (const fn of handlers) {
                    try { await fn(...msg.args); } catch (err) { logLine(`socket handler ${msg.channel}: ${err.stack}`); }
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
            case "shutdown": process.exit(0);
        }
    } catch (err) {
        logLine(`message loop error on ${msg.t}: ${err.stack}`);
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

async function boot() {
    try {
        await import(`file://${path.join(REPO, "scripts/module.mjs")}`);
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
            notifications: globalThis.__notifications,
            hooksFired: hooks.fired.slice(0, 60)
        });
    } catch (err) {
        logLine(`BOOT FAILED: ${err.stack}`);
        send({ t: "bootFailed", error: String(err.stack) });
    }
}

send({ t: "hello", who: WHO });
