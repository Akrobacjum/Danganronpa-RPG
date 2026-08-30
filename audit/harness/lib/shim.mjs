/**
 * Foundry VTT v14 shim — faithful-where-it-matters mock for auditing the
 * Danganronpa RPG module headlessly, multi-client.
 *
 * REALISM RULES (do not weaken to make the module pass — failures are findings):
 *  - Documents replicate through the parent process (the "server").
 *  - pre* hooks fire only on the initiating client; post hooks on every client.
 *  - Whisper/blind chat messages are only delivered to their audience (like the
 *    real server).
 *  - The server rejects writes the real Foundry server would reject
 *    (world settings / other users' actors / world documents from non-GM).
 */

import * as U from "./futil.mjs";
import fs from "node:fs";
import path from "node:path";

export const REPO = process.env.DRPG_REPO || "/home/user/Danganronpa-RPG";
export const MODULE_ID = "danganronpa-rpg";

/* ============================== Hooks ==================================== */

export class HooksImpl {
    constructor(log) { this._hooks = new Map(); this._log = log; this.fired = []; }
    get events() { return Object.fromEntries([...this._hooks.entries()].map(([k, v]) => [k, v.map(e => ({ fn: e.fn, once: e.once }))])); }
    on(name, fn, opts = {}) {
        if (!this._hooks.has(name)) this._hooks.set(name, []);
        this._hooks.get(name).push({ fn, once: !!opts.once });
        return fn;
    }
    once(name, fn) { return this.on(name, fn, { once: true }); }
    off(name, fn) {
        const list = this._hooks.get(name) ?? [];
        const i = list.findIndex(e => e.fn === fn);
        if (i >= 0) list.splice(i, 1);
    }
    call(name, ...args) {
        this.fired.push(name);
        for (const entry of [...(this._hooks.get(name) ?? [])]) {
            if (entry.once) this.off(name, entry.fn);
            let out;
            try { out = entry.fn(...args); }
            catch (err) { this._log?.(`Hook ${name} listener threw: ${err.stack}`); continue; }
            if (out === false) return false;
        }
        return true;
    }
    callAll(name, ...args) {
        this.fired.push(name);
        for (const entry of [...(this._hooks.get(name) ?? [])]) {
            if (entry.once) this.off(name, entry.fn);
            try { entry.fn(...args); }
            catch (err) { this._log?.(`Hook ${name} listener threw: ${err.stack}`); }
        }
        return true;
    }
    onError(loc, err) { this._log?.(`Hooks.onError ${loc}: ${err?.stack}`); }
}

/* ============================ Collections ================================ */

export class Collection extends Map {
    /** Foundry's Collection iterates VALUES, not [key, value] pairs. */
    [Symbol.iterator]() { return this.values(); }
    get contents() { return [...this.values()]; }
    getName(name) { return this.contents.find(d => d.name === name); }
    find(fn) { return this.contents.find(fn); }
    filter(fn) { return this.contents.filter(fn); }
    some(fn) { return this.contents.some(fn); }
    map(fn) { return this.contents.map(fn); }
    reduce(fn, init) { return this.contents.reduce(fn, init); }
    forEach(fn) { this.contents.forEach(fn); }
    get documentName() { return this._documentName; }
}

/* ========================== Document classes ============================= */

const EMBEDDED = {
    Actor: { Item: "items", ActiveEffect: "effects" },
    Scene: { Token: "tokens", Region: "regions", Wall: "walls", AmbientLight: "lights", AmbientSound: "sounds", Note: "notes", Drawing: "drawings", MeasuredTemplate: "templates", Tile: "tiles" },
    RollTable: { TableResult: "results" },
    Playlist: { PlaylistSound: "sounds" },
    Item: { ActiveEffect: "effects" },
    Region: { RegionBehavior: "behaviors" }
};

export function buildDocumentClasses(ctx) {
    // ctx: { bus, hooks(), gameRef(), userId(), log }

    class BaseDocument {
        constructor(data = {}, context = {}) {
            this._source = U.deepClone(data);
            if (!this._source._id) this._source._id = U.randomID();
            this.parent = context.parent ?? null;
            this._collections = {};
            const emb = EMBEDDED[this.documentName] ?? {};
            for (const [docName, key] of Object.entries(emb)) {
                const coll = new Collection();
                coll._documentName = docName;
                this._collections[key] = coll;
                for (const d of (this._source[key] ?? [])) {
                    const cls = ctx.classes[docName] ?? BaseDocument;
                    const child = new cls(d, { parent: this });
                    coll.set(child.id, child);
                }
            }
        }
        static get documentName() { return this.name.replace(/Document$/, ""); }
        get documentName() { return this.constructor.documentName; }
        get id() { return this._source._id; }
        get name() { return this._source.name ?? ""; }
        get type() { return this._source.type; }
        get flags() { return this._source.flags ?? (this._source.flags = {}); }
        get system() { return this._source.system ?? (this._source.system = {}); }
        get ownership() { return this._source.ownership ?? { default: 0 }; }
        get folder() { return null; }
        get img() { return this._source.img; }
        get sort() { return this._source.sort ?? 0; }
        get uuid() {
            return this.parent ? `${this.parent.uuid}.${this.documentName}.${this.id}` : `${this.documentName}.${this.id}`;
        }
        get isOwner() { return this.testUserPermission(ctx.gameRef().user, "OWNER"); }
        get limited() { return !this.testUserPermission(ctx.gameRef().user, "OBSERVER"); }
        get visible() { return this.testUserPermission(ctx.gameRef().user, "LIMITED"); }
        get isEmbedded() { return !!this.parent; }
        get documentCollection() { return null; }
        get pack() { return null; }
        get collections() { return this._collections; }

        getEmbeddedCollection(name) {
            const key = (EMBEDDED[this.documentName] ?? {})[name] ?? name;
            return this._collections[key];
        }

        testUserPermission(user, permission = "OWNER") {
            if (!user) return false;
            if (user.isGM) return true;
            const root = this.parent ?? this;
            const levels = { NONE: 0, LIMITED: 1, OBSERVER: 2, OWNER: 3 };
            const want = typeof permission === "number" ? permission : (levels[permission] ?? 3);
            const own = root.ownership ?? { default: 0 };
            const have = own[user.id] ?? own.default ?? 0;
            return have >= want;
        }
        canUserModify(user) { return user?.isGM || this.testUserPermission(user, "OWNER"); }
        getUserLevel(user) {
            if (!user) return null;
            if (user.isGM) return 3;
            const own = (this.parent ?? this).ownership ?? { default: 0 };
            return own[user.id] ?? own.default ?? 0;
        }

        getFlag(scope, key) { return U.getProperty(this._source.flags, `${scope}.${key}`); }
        async setFlag(scope, key, value) { return this.update({ [`flags.${scope}.${key}`]: value }); }
        async unsetFlag(scope, key) {
            const parts = `${scope}.${key}`.split(".");
            const tail = parts.pop();
            return this.update({ [`flags.${parts.join(".")}.-=${tail}`]: null });
        }

        updateSource(changes = {}) {
            U.mergeObject(this._source, changes, { performDeletions: true });
            return changes;
        }
        toObject() { return U.deepClone(this._source); }
        toJSON() { return this.toObject(); }
        clone(changes = {}) {
            const data = U.mergeObject(this.toObject(), changes, { inplace: false, performDeletions: true });
            return new this.constructor(data, { parent: this.parent });
        }
        prepareData() {}

        /* ------- CRUD (routes through the server) ------- */
        static async create(data, context = {}) {
            const arr = Array.isArray(data) ? data : [data];
            const parent = context.parent ?? null;
            if (parent) {
                const created = await parent.createEmbeddedDocuments(this.documentName, arr, context);
                return Array.isArray(data) ? created : created[0];
            }
            const hooks = ctx.hooks();
            const kept = [];
            for (const d of arr) {
                // pre-hooks fire on the initiator with a mutable document; a
                // hook's updateSource() must reach the server (real semantics).
                const doc = new this(sanitize(d));
                const pre = hooks.call(`preCreate${this.documentName}`, doc, doc.toObject(), opts(context), ctx.userId());
                if (pre !== false) kept.push(doc.toObject());
            }
            if (!kept.length) return Array.isArray(data) ? [] : undefined;
            const ids = await ctx.bus.op({ action: "create", coll: this.documentName, data: kept, options: opts(context) });
            const docs = ids.map(id => ctx.gameRef().collections.get(this.documentName)?.get(id)).filter(Boolean);
            return Array.isArray(data) ? docs : docs[0];
        }
        static async createDocuments(data = [], context = {}) {
            const out = await this.create(data, context);
            return Array.isArray(out) ? out : [out];
        }
        static async updateDocuments(updates = [], context = {}) {
            const results = [];
            for (const u of updates) {
                const doc = ctx.gameRef().collections.get(this.documentName)?.get(u._id);
                if (doc) results.push(await doc.update(u, context));
            }
            return results;
        }
        static async deleteDocuments(ids = [], context = {}) {
            for (const id of ids) {
                const doc = ctx.gameRef().collections.get(this.documentName)?.get(id);
                if (doc) await doc.delete(context);
            }
            return [];
        }

        async update(changes = {}, context = {}) {
            changes = sanitize(changes);
            delete changes._id;
            if (U.isEmpty(changes)) return this;
            const hooks = ctx.hooks();
            const pre = hooks.call(`preUpdate${this.documentName}`, this, U.expandObject(U.deepClone(changes)), opts(context), ctx.userId());
            if (pre === false) return this;
            if (this.parent) {
                await this.parent._embeddedOp("update", this.documentName, [{ _id: this.id, ...changes }], context);
            } else {
                await ctx.bus.op({ action: "update", coll: this.documentName, docId: this.id, changes, options: opts(context) });
            }
            return this;
        }

        async delete(context = {}) {
            const hooks = ctx.hooks();
            const pre = hooks.call(`preDelete${this.documentName}`, this, opts(context), ctx.userId());
            if (pre === false) return this;
            if (this.parent) {
                await this.parent._embeddedOp("delete", this.documentName, [this.id], context);
            } else {
                await ctx.bus.op({ action: "delete", coll: this.documentName, docId: this.id, options: opts(context) });
            }
            return this;
        }

        async createEmbeddedDocuments(embeddedName, data = [], context = {}) {
            const hooks = ctx.hooks();
            const cls = ctx.classes[embeddedName] ?? BaseDocument;
            const kept = [];
            for (const d of data) {
                const doc = new cls(sanitize(d), { parent: this });
                const pre = hooks.call(`preCreate${embeddedName}`, doc, doc.toObject(), opts(context), ctx.userId());
                if (pre !== false) kept.push(doc.toObject());
            }
            if (!kept.length) return [];
            const ids = await this._embeddedOp("create", embeddedName, kept, context);
            const collKey = (EMBEDDED[this.documentName] ?? {})[embeddedName];
            return ids.map(id => this._collections[collKey]?.get(id)).filter(Boolean);
        }
        async updateEmbeddedDocuments(embeddedName, updates = [], context = {}) {
            await this._embeddedOp("update", embeddedName, updates.map(sanitize), context);
            const collKey = (EMBEDDED[this.documentName] ?? {})[embeddedName];
            return updates.map(u => this._collections[collKey]?.get(u._id)).filter(Boolean);
        }
        async deleteEmbeddedDocuments(embeddedName, ids = [], context = {}) {
            await this._embeddedOp("delete", embeddedName, ids, context);
            return [];
        }
        _embeddedOp(action, embeddedName, payload, context = {}) {
            return ctx.bus.op({
                action: `embedded-${action}`, coll: this.documentName, docId: this.id,
                embeddedName, payload, options: opts(context)
            });
        }
    }

    function sanitize(d) {
        // strip class instances → plain data
        return JSON.parse(JSON.stringify(d ?? {}));
    }
    function opts(context) {
        const { parent, ...rest } = context ?? {};
        return sanitize(rest);
    }

    class ActorImpl extends BaseDocument {
        static get documentName() { return "Actor"; }
        get items() { return this._collections.items; }
        get effects() { return this._collections.effects; }
        get prototypeToken() { return this._source.prototypeToken ?? { name: this.name, texture: { src: this.img } }; }
        get token() { return null; }
        get isToken() { return false; }
        getActiveTokens(linked = false, document = false) {
            const g = ctx.gameRef();
            const out = [];
            for (const scene of g.scenes.contents) {
                for (const t of scene.tokens.contents) {
                    if (t._source.actorId === this.id) out.push(document ? t : (t.object ?? t));
                }
            }
            return out;
        }
        getRollData() { return U.deepClone(this.system); }
        async toggleStatusEffect(statusId, { active, overlay = false } = {}) {
            // v12+ semantics: a status is an ActiveEffect carrying `statuses`.
            const existing = this.effects.contents.find(e => e.statuses.has(statusId));
            const want = active ?? !existing;
            if (want && !existing) {
                const def = (globalThis.CONFIG?.statusEffects ?? []).find(s => s.id === statusId);
                const [eff] = await this.createEmbeddedDocuments("ActiveEffect", [{
                    name: def?.name ?? statusId, img: def?.img, statuses: [statusId],
                    flags: overlay ? { core: { overlay: true } } : {}
                }]);
                return eff;
            }
            if (!want && existing) { await this.deleteEmbeddedDocuments("ActiveEffect", [existing.id]); return false; }
            return existing ?? false;
        }
        get statuses() {
            const out = new Set(this._source.statuses ?? []);
            for (const e of this.effects.contents) for (const s of e.statuses) out.add(s);
            return out;
        }
        get appliedEffects() { return this.effects?.contents ?? []; }
        get sheet() {
            const self = this;
            return { render() { return this; }, close() {}, rendered: false, element: null, document: self };
        }
    }

    class ItemImpl extends BaseDocument {
        static get documentName() { return "Item"; }
        get actor() { return this.parent; }
        get effects() { return this._collections.effects; }
        get sheet() { return { render() { return this; }, close() {}, rendered: false }; }
    }

    class TokenDocumentImpl extends BaseDocument {
        static get documentName() { return "Token"; }
        get actor() {
            const g = ctx.gameRef();
            if (this._source.actorLink === false && this._source.delta) {
                // unlinked: give the base actor (good enough for the audit)
            }
            return g.actors.get(this._source.actorId) ?? null;
        }
        get actorId() { return this._source.actorId; }
        get scene() { return this.parent; }
        get x() { return this._source.x ?? 0; }
        get y() { return this._source.y ?? 0; }
        get hidden() { return !!this._source.hidden; }
        get elevation() { return this._source.elevation ?? 0; }
        get width() { return this._source.width ?? 1; }
        get height() { return this._source.height ?? 1; }
        get texture() { return this._source.texture ?? {}; }
        get disposition() { return this._source.disposition ?? 0; }
        get object() {
            const cv = ctx.gameRef().canvas;
            if (!cv?.scene || cv.scene.id !== this.parent?.id) return null;
            return cv.tokens._wrap(this);
        }
        get isOwner() {
            const a = this.actor;
            return a ? a.testUserPermission(ctx.gameRef().user, "OWNER") : ctx.gameRef().user.isGM;
        }
        get center() {
            const gs = 100;
            return { x: this.x + (this.width * gs) / 2, y: this.y + (this.height * gs) / 2 };
        }
        /** Foundry v12+: the Regions this token is inside (kept live by the server; here: measured). */
        get regions() {
            const out = new Set();
            for (const r of this.parent?.regions?.contents ?? []) {
                if (r.pointInside(this.center)) out.add(r);
            }
            return out;
        }
        getFlag(scope, key) { return U.getProperty(this._source.flags, `${scope}.${key}`); }
    }

    class SceneImpl extends BaseDocument {
        static get documentName() { return "Scene"; }
        get tokens() { return this._collections.tokens; }
        get regions() { return this._collections.regions; }
        get walls() { return this._collections.walls; }
        get lights() { return this._collections.lights; }
        get notes() { return this._collections.notes; }
        get drawings() { return this._collections.drawings; }
        get active() { return !!this._source.active; }
        get isView() { return ctx.gameRef().canvas?.scene?.id === this.id; }
        get grid() { return { size: this._source.grid?.size ?? 100, distance: this._source.grid?.distance ?? 5, type: this._source.grid?.type ?? 1, units: "ft" }; }
        get dimensions() {
            const w = this._source.width ?? 4000, h = this._source.height ?? 3000, s = this.grid.size;
            return { width: w, height: h, size: s, sceneX: 0, sceneY: 0, sceneWidth: w, sceneHeight: h, rect: { x: 0, y: 0, width: w, height: h }, sceneRect: { x: 0, y: 0, width: w, height: h } };
        }
        async view() { ctx.gameRef()._viewScene(this); return this; }
        async activate() { await this.update({ active: true }); ctx.gameRef()._viewScene(this); return this; }
    }

    class RegionImpl extends BaseDocument {
        static get documentName() { return "Region"; }
        get scene() { return this.parent; }
        get shapes() { return this._source.shapes ?? []; }
        get behaviors() { return this._collections.behaviors; }
        get tokens() {
            // tokens whose centre is inside one of the region's polygon/rect shapes
            const out = new Set();
            for (const t of this.parent?.tokens?.contents ?? []) {
                if (this.pointInside(t.center)) out.add(t);
            }
            return out;
        }
        pointInside({ x, y }) {
            for (const s of this.shapes) {
                if (s.type === "rectangle") {
                    if (x >= s.x && x <= s.x + s.width && y >= s.y && y <= s.y + s.height) return true;
                } else if (s.type === "polygon" && Array.isArray(s.points)) {
                    if (pointInPolygon(x, y, s.points)) return true;
                }
            }
            return false;
        }
        testPoint(point) { return this.pointInside(point); }
    }

    function pointInPolygon(x, y, pts) {
        let inside = false;
        for (let i = 0, j = pts.length - 2; i < pts.length; i += 2) {
            const xi = pts[i], yi = pts[i + 1], xj = pts[j], yj = pts[j + 1];
            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
            j = i;
        }
        return inside;
    }

    class ChatMessageImpl extends BaseDocument {
        static get documentName() { return "ChatMessage"; }
        get author() { return ctx.gameRef().users.get(this._source.author ?? this._source.user) ?? null; }
        get user() { return this.author; }
        get speaker() { return this._source.speaker ?? {}; }
        get whisper() { return this._source.whisper ?? []; }
        get blind() { return !!this._source.blind; }
        get content() { return this._source.content ?? ""; }
        get rolls() { return (this._source.rolls ?? []).map(r => typeof r === "string" ? JSON.parse(r) : r); }
        get isRoll() { return (this._source.rolls ?? []).length > 0; }
        get visible() {
            const u = ctx.gameRef().user;
            if (this.whisper.length) return u.isGM || this.whisper.includes(u.id) || (this._source.author === u.id && !this.blind);
            return true;
        }
        get alias() { return this.speaker.alias ?? this.author?.name ?? ""; }
        static getSpeaker({ actor, token, alias } = {}) {
            const g = ctx.gameRef();
            const a = actor ?? g.user.character;
            return { scene: g.canvas?.scene?.id ?? null, actor: a?.id ?? null, token: token?.id ?? null, alias: alias ?? a?.name ?? g.user.name };
        }
        static getWhisperRecipients(name) {
            const g = ctx.gameRef();
            if (/^(gm|dm)$/i.test(name)) return g.users.filter(u => u.isGM);
            return g.users.filter(u => u.name === name || u.character?.name === name);
        }
        static applyRollMode(data, mode) {
            const g = ctx.gameRef();
            if (mode === "gmroll" || mode === "blindroll") data.whisper = g.users.filter(u => u.isGM).map(u => u.id);
            if (mode === "blindroll") data.blind = true;
            if (mode === "selfroll") data.whisper = [g.user.id];
            return data;
        }
    }

    class UserImpl extends BaseDocument {
        static get documentName() { return "User"; }
        get isGM() { return (this._source.role ?? 1) >= 4; }
        get active() { return !!this._source.active; }
        get role() { return this._source.role ?? 1; }
        get character() { return ctx.gameRef().actors.get(this._source.character) ?? null; }
        get color() { return U.Color.from(this._source.color ?? 0x888888); }
        get isSelf() { return this.id === ctx.userId(); }
        get viewedScene() { return this._source.viewedScene ?? ctx.gameRef().canvas?.scene?.id ?? null; }
        hasRole(role) {
            const levels = { NONE: 0, PLAYER: 1, TRUSTED: 2, ASSISTANT: 3, GAMEMASTER: 4 };
            return this.role >= (typeof role === "number" ? role : levels[role] ?? 4);
        }
        can(perm) { return this.isGM; }
        get targets() { return new Set(); }
        async query(name, data, options = {}) {
            // Foundry v13+ user queries: run on the target client. The harness
            // relays it and the target executes its registered CONFIG.queries handler.
            return ctx.bus.userQuery(this.id, name, data, options);
        }
    }

    class RollTableImpl extends BaseDocument {
        static get documentName() { return "RollTable"; }
        get results() { return this._collections.results; }
        get formula() { return this._source.formula ?? `1d${this.results?.size || 1}`; }
        async draw({ displayChat = true } = {}) {
            const results = this.results.contents;
            if (!results.length) return { roll: null, results: [] };
            const pick = results[Math.floor(Math.random() * results.length)];
            if (displayChat) {
                await ctx.classes.ChatMessage.create({
                    content: `Drew: ${pick?.description ?? pick?._source?.text ?? ""}`,
                    speaker: { alias: this.name }, flags: { core: { RollTable: this.id } }
                });
            }
            return { roll: { total: results.indexOf(pick) + 1 }, results: [pick] };
        }
        async drawMany(n, opts2 = {}) {
            const out = [];
            for (let i = 0; i < n; i++) out.push(...(await this.draw(opts2)).results);
            return { results: out };
        }
        getResultsForRoll(total) {
            return this.results.contents.filter(r => {
                const [lo, hi] = r._source.range ?? [1, 1];
                return total >= lo && total <= hi;
            });
        }
    }

    class TableResultImpl extends BaseDocument {
        static get documentName() { return "TableResult"; }
        get description() { return this._source.description ?? this._source.text ?? ""; }
        get range() { return this._source.range ?? [1, 1]; }
        get weight() { return this._source.weight ?? 1; }
    }

    class PlaylistImpl extends BaseDocument {
        static get documentName() { return "Playlist"; }
        get sounds() { return this._collections.sounds; }
        get playing() { return !!this._source.playing; }
        async playAll() { return this.update({ playing: true }); }
        async stopAll() { return this.update({ playing: false }); }
        async playSound(sound) { return sound?.update({ playing: true }); }
        async stopSound(sound) { return sound?.update({ playing: false }); }
    }
    class PlaylistSoundImpl extends BaseDocument {
        static get documentName() { return "PlaylistSound"; }
        get playing() { return !!this._source.playing; }
        get sound() { return { addEventListener() {}, stop() {} }; }
    }
    class MacroImpl extends BaseDocument {
        static get documentName() { return "Macro"; }
        async execute(scope = {}) {
            const fn = new Function("scope", `return (async () => { ${this._source.command} })()`);
            return fn(scope);
        }
    }
    class JournalEntryImpl extends BaseDocument { static get documentName() { return "JournalEntry"; } }
    class ActiveEffectImpl extends BaseDocument {
        static get documentName() { return "ActiveEffect"; }
        get disabled() { return !!this._source.disabled; }
        get statuses() { return new Set(this._source.statuses ?? []); }
    }
    class RegionBehaviorImpl extends BaseDocument { static get documentName() { return "RegionBehavior"; } }
    class WallImpl extends BaseDocument { static get documentName() { return "Wall"; } }
    class SettingImpl extends BaseDocument { static get documentName() { return "Setting"; } }

    const classes = {
        Actor: ActorImpl, Item: ItemImpl, Token: TokenDocumentImpl, Scene: SceneImpl,
        Region: RegionImpl, ChatMessage: ChatMessageImpl, User: UserImpl,
        RollTable: RollTableImpl, TableResult: TableResultImpl, Playlist: PlaylistImpl,
        PlaylistSound: PlaylistSoundImpl, Macro: MacroImpl, JournalEntry: JournalEntryImpl,
        ActiveEffect: ActiveEffectImpl, RegionBehavior: RegionBehaviorImpl, Wall: WallImpl,
        Setting: SettingImpl, BaseDocument
    };
    ctx.classes = classes;
    return classes;
}

/* ============================== Roll ===================================== */

export class RollImpl {
    constructor(formula = "1d20", data = {}) {
        this.formula = String(formula);
        this.data = data;
        this.terms = [];
        this._evaluated = false;
        this.total = undefined;
        this.dice = [];
    }
    static create(formula, data) { return new RollImpl(formula, data); }
    async evaluate() {
        // deterministic-ish: parse XdY+Z
        let total = 0;
        const cleaned = this.formula.replace(/\s+/g, "");
        const re = /([+-]?)(\d*)d(\d+)|([+-]?)(\d+)(?!d)/g;
        let m;
        while ((m = re.exec(cleaned))) {
            if (m[3]) {
                const sign = m[1] === "-" ? -1 : 1;
                const count = parseInt(m[2] || "1");
                const faces = parseInt(m[3]);
                const results = [];
                for (let i = 0; i < count; i++) results.push(1 + Math.floor(Math.random() * faces));
                this.dice.push({ faces, number: count, results: results.map(r => ({ result: r, active: true })), total: results.reduce((a, b) => a + b, 0) });
                total += sign * results.reduce((a, b) => a + b, 0);
            } else if (m[5]) {
                total += (m[4] === "-" ? -1 : 1) * parseInt(m[5]);
            }
        }
        this.total = total;
        this._evaluated = true;
        return this;
    }
    async roll() { return this.evaluate(); }
    evaluateSync() { this.evaluate(); return this; }
    async toMessage(messageData = {}, { rollMode, create = true } = {}) {
        const CM = globalThis.ChatMessage;
        const data = { content: String(this.total), rolls: [JSON.stringify({ formula: this.formula, total: this.total })], sound: null, ...messageData };
        if (rollMode && rollMode !== "publicroll") CM.applyRollMode(data, rollMode);
        if (create) return CM.create(data);
        return data;
    }
    toJSON() { return { class: "Roll", formula: this.formula, total: this.total, evaluated: this._evaluated }; }
    static fromJSON(json) { const d = typeof json === "string" ? JSON.parse(json) : json; const r = new RollImpl(d.formula); r.total = d.total; r._evaluated = true; return r; }
}

/* ============================ PIXI stub ================================== */

export function buildPIXI() {
    class DisplayObject {
        constructor() {
            this.children = []; this.visible = true; this.alpha = 1; this.zIndex = 0;
            this.position = { x: 0, y: 0, set: (x, y) => { this.position.x = x; this.position.y = y ?? x; } };
            this.scale = { x: 1, y: 1, set: (x, y) => { this.scale.x = x; this.scale.y = y ?? x; } };
            this.pivot = { x: 0, y: 0, set: () => {} };
            this.rotation = 0; this.parent = null; this.destroyed = false;
            this.filters = []; this.mask = null; this.eventMode = "auto"; this.cursor = null;
            this.x = 0; this.y = 0; this.width = 0; this.height = 0;
            this.name = null; this.sortableChildren = false; this.angle = 0; this.tint = 0xFFFFFF;
            this.blendMode = 0;
        }
        addChild(...cs) { for (const c of cs) { c.parent = this; this.children.push(c); } return cs[0]; }
        addChildAt(c, i) { c.parent = this; this.children.splice(i, 0, c); return c; }
        removeChild(...cs) { for (const c of cs) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parent = null; } return cs[0]; }
        removeChildren() { const cs = this.children; this.children = []; return cs; }
        getChildByName(n) { return this.children.find(c => c.name === n) ?? null; }
        destroy() { this.destroyed = true; this.removeChildren(); this.parent?.removeChild(this); }
        on() { return this; } off() { return this; } once() { return this; }
        removeAllListeners() { return this; }
        getBounds() { return { x: 0, y: 0, width: this.width, height: this.height }; }
        toGlobal(p) { return { ...p }; } toLocal(p) { return { ...p }; }
        updateTransform() {}
        sortChildren() {}
    }
    class Container extends DisplayObject {}
    class Graphics extends Container {
        constructor() { super(); this._calls = []; }
        clear() { this._calls = []; return this; }
        beginFill(...a) { this._calls.push(["beginFill", a]); return this; }
        endFill() { return this; }
        lineStyle(...a) { this._calls.push(["lineStyle", a]); return this; }
        drawRect(...a) { this._calls.push(["drawRect", a]); return this; }
        drawRoundedRect(...a) { this._calls.push(["drawRoundedRect", a]); return this; }
        drawCircle(...a) { this._calls.push(["drawCircle", a]); return this; }
        drawEllipse(...a) { this._calls.push(["drawEllipse", a]); return this; }
        drawPolygon(...a) { this._calls.push(["drawPolygon", a]); return this; }
        moveTo(...a) { this._calls.push(["moveTo", a]); return this; }
        lineTo(...a) { this._calls.push(["lineTo", a]); return this; }
        arc(...a) { return this; } arcTo(...a) { return this; }
        bezierCurveTo(...a) { return this; } quadraticCurveTo(...a) { return this; }
        closePath() { return this; } beginHole() { return this; } endHole() { return this; }
        fill(...a) { this._calls.push(["fill", a]); return this; }
        stroke(...a) { this._calls.push(["stroke", a]); return this; }
        rect(...a) { this._calls.push(["rect", a]); return this; }
        circle(...a) { this._calls.push(["circle", a]); return this; }
        poly(...a) { this._calls.push(["poly", a]); return this; }
        roundRect(...a) { this._calls.push(["roundRect", a]); return this; }
        ellipse(...a) { return this; }
        setStrokeStyle() { return this; } setFillStyle() { return this; }
    }
    class Sprite extends Container {
        constructor(texture) { super(); this.texture = texture ?? Texture.EMPTY; this.anchor = { x: 0, y: 0, set: () => {} }; }
        static from(src) { return new Sprite(new Texture(src)); }
    }
    class Texture {
        constructor(src) { this.src = src; this.baseTexture = { valid: true, destroy() {} }; this.valid = true; }
        static from(src) { return new Texture(src); }
        destroy() {}
    }
    Texture.EMPTY = new Texture(null);
    Texture.WHITE = new Texture("white");
    class Text extends Container {
        constructor(text, style) { super(); this.text = text; this.style = style ?? {}; this.anchor = { x: 0, y: 0, set: () => {} }; }
    }
    class TextStyle { constructor(o) { Object.assign(this, o); } }
    class Rectangle { constructor(x = 0, y = 0, w = 0, h = 0) { this.x = x; this.y = y; this.width = w; this.height = h; } contains(px, py) { return px >= this.x && px <= this.x + this.width && py >= this.y && py <= this.y + this.height; } }
    class Circle { constructor(x = 0, y = 0, r = 0) { this.x = x; this.y = y; this.radius = r; } }
    class Polygon { constructor(points) { this.points = Array.isArray(points) ? points : [...arguments]; } contains() { return false; } }
    class Point { constructor(x = 0, y = 0) { this.x = x; this.y = y; } set(x, y) { this.x = x; this.y = y ?? x; } }
    class Filter { constructor() { this.enabled = true; this.uniforms = {}; } }
    class BlurFilter extends Filter { constructor(strength = 8) { super(); this.strength = strength; this.blur = strength; } }
    class AlphaFilter extends Filter { constructor(alpha = 1) { super(); this.alpha = alpha; } }
    class ColorMatrixFilter extends Filter { brightness() {} saturate() {} desaturate() {} tint() {} }
    class RenderTexture extends Texture { static create() { return new RenderTexture(null); } }
    class Ticker { constructor() { this.started = false; } add() {} addOnce() {} remove() {} start() {} stop() {} destroy() {} }
    Ticker.shared = new Ticker();

    return {
        Container, Graphics, Sprite, Texture, Text, TextStyle, Rectangle, Circle, Polygon,
        Point, Filter, BlurFilter, AlphaFilter, ColorMatrixFilter, RenderTexture, Ticker,
        DisplayObject, BLEND_MODES: { NORMAL: 0, ADD: 1, MULTIPLY: 2, SCREEN: 3 },
        filters: { BlurFilter, AlphaFilter, ColorMatrixFilter },
        utils: { destroyTextureCache() {} }
    };
}

/* ======================= Applications & dialogs ========================== */

export function buildApplications(ctx) {
    class ApplicationV2 {
        constructor(options = {}) {
            this.options = U.mergeObject(U.deepClone(this.constructor.DEFAULT_OPTIONS ?? {}), options, { inplace: false });
            this.element = null;
            this._rendered = false;
            this.id = this.options.id ?? `app-${U.randomID(8)}`;
            this.tabGroups = {};
        }
        static DEFAULT_OPTIONS = {};
        static PARTS = {};
        get rendered() { return this._rendered; }
        get title() { return this.options.window?.title ?? this.constructor.name; }
        get window() { return { title: this.title, controls: [] }; }
        async render(opts2 = {}) {
            const doc = globalThis.document;
            if (!this.element) {
                this.element = doc.createElement("div");
                this.element.id = this.id;
                this.element.classList.add(...(this.options.classes ?? []));
                doc.body.appendChild(this.element);
            }
            let context = {};
            try { context = await this._prepareContext?.(opts2) ?? {}; } catch (err) { ctx.log(`_prepareContext threw in ${this.constructor.name}: ${err.stack}`); }
            // Handlebars parts are not rendered headlessly; call the lifecycle anyway.
            try { await this._preparePartContext?.("main", context, opts2); } catch {}
            try { await this._onRender?.(context, opts2); } catch (err) { ctx.log(`_onRender threw in ${this.constructor.name}: ${err.stack}`); }
            this._rendered = true;
            ctx.hooks().callAll("renderApplicationV2", this, this.element, context);
            ctx.hooks().callAll(`render${this.constructor.name}`, this, this.element, context);
            return this;
        }
        async close(opts2 = {}) {
            try { await this._onClose?.(opts2); } catch {}
            this.element?.remove();
            this._rendered = false;
            ctx.hooks().callAll("closeApplicationV2", this, this.element);
            return this;
        }
        async minimize() {} async maximize() {}
        setPosition(pos = {}) { return pos; }
        bringToFront() {} bringToTop() {}
        changeTab() {}
    }

    const HandlebarsApplicationMixin = Base => class extends Base {
        async _renderHTML() { return {}; }
        async _replaceHTML() {}
    };

    /**
     * DialogV2 — headless: answers come from a programmable queue.
     * Default behaviour: press the default button (or the first).
     * Scenarios push answers via globalThis.__dialogAnswers.push(fnOrValue).
     * Every dialog shown is recorded in globalThis.__dialogLog.
     */
    class DialogV2 {
        static async wait(config = {}) {
            globalThis.__dialogLog.push({ kind: "wait", title: config.window?.title, content: (config.content ?? "").slice(0, 400), buttons: (config.buttons ?? []).map(b => b.action) });
            const queued = globalThis.__dialogAnswers.shift();
            if (queued !== undefined) {
                const v = typeof queued === "function" ? await queued(config) : queued;
                return v;
            }
            const buttons = config.buttons ?? [];
            const def = buttons.find(b => b.default) ?? buttons[0];
            if (!def) return null;
            if (typeof def.callback === "function") {
                // Foundry passes (event, button, dialog); button.form?.elements is used to read inputs.
                const fakeButton = { form: makeForm(config) };
                try { return await def.callback(new globalThis.window.Event("click"), fakeButton, { element: makeDialogElement(config) }); }
                catch (err) { ctx.log(`DialogV2 callback threw: ${err.stack}`); return def.action; }
            }
            return def.action;
        }
        static async confirm(config = {}) {
            globalThis.__dialogLog.push({ kind: "confirm", title: config.window?.title, content: (config.content ?? "").slice(0, 400) });
            const queued = globalThis.__dialogAnswers.shift();
            if (queued !== undefined) return typeof queued === "function" ? queued(config) : queued;
            if (config.yes?.callback) { try { return await config.yes.callback(new globalThis.window.Event("click"), { form: makeForm(config) }, { element: makeDialogElement(config) }); } catch { return true; } }
            return true;
        }
        static async prompt(config = {}) {
            globalThis.__dialogLog.push({ kind: "prompt", title: config.window?.title });
            const queued = globalThis.__dialogAnswers.shift();
            if (queued !== undefined) return typeof queued === "function" ? queued(config) : queued;
            if (config.ok?.callback) { try { return await config.ok.callback(new globalThis.window.Event("click"), { form: makeForm(config) }, { element: makeDialogElement(config) }); } catch { return "ok"; } }
            return "ok";
        }
        static async input(config = {}) { return this.prompt(config); }
    }

    function makeDialogElement(config) {
        const doc = globalThis.document;
        const el = doc.createElement("dialog");
        el.innerHTML = config.content ?? "";
        return el;
    }
    function makeForm(config) {
        const el = makeDialogElement(config);
        const form = globalThis.document.createElement("form");
        form.append(...el.childNodes);
        return form;
    }

    class FilePickerImpl {
        static get implementation() { return FilePickerImpl; }
        static async browse(source, target) {
            // serve real repo files so icon/audio existence checks are honest
            const dir = path.join(REPO, String(target ?? "").replace(/^modules\/danganronpa-rpg\/?/, ""));
            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                return {
                    target,
                    files: entries.filter(e => e.isFile()).map(e => `${target}/${e.name}`),
                    dirs: entries.filter(e => e.isDirectory()).map(e => `${target}/${e.name}`)
                };
            } catch { return { target, files: [], dirs: [] }; }
        }
        constructor(o = {}) { this.options = o; }
        render() { return this; }
    }

    return { ApplicationV2, HandlebarsApplicationMixin, DialogV2, FilePickerImpl };
}
