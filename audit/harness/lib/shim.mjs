/**
 * Foundry VTT v14 shim - faithful-where-it-matters mock for auditing the
 * Danganronpa RPG module headlessly, multi-client.
 *
 * REALISM RULES (do not weaken to make the module pass - failures are findings):
 *  - Documents replicate through the parent process (the "server").
 *  - pre* hooks fire only on the initiating client; post hooks on every client.
 *  - EVERY chat message reaches EVERY client, whispers included, and each
 *    client decides for itself what to show (`ChatMessageImpl#visible` below).
 *    This rule said the opposite until 1.2.56 - "only delivered to their
 *    audience (like the real server)" - and the real server does not do that
 *    in v14: `server-backend.mjs` broadcasts `modifyDocument` with no
 *    filter and the word "whisper" is not in the server's dist at all (audit
 *    S14-04, read on the installed v14). The module measured it too: a
 *    player's browser held 717 messages, the GM's count (secret.mjs header).
 *    A harness that filtered for the module made every "a player cannot see
 *    it" check pass by never handing the player the document.
 *  - The server rejects writes the real Foundry server would reject
 *    (world settings / other users' actors / world documents from non-GM).
 *  - An exception that escapes module code into "Foundry" - a hook listener,
 *    a socket handler, a dialog callback, a setting's onChange, a window's
 *    render - is recorded in `globalThis.__errors` (see `recordError`), which
 *    the scenarios' "no uncaught errors" checks read. Errors the module
 *    catches itself and reports with console.error are NOT recorded: those
 *    are the module handling a failure, not failing to.
 */

import * as U from "./futil.mjs";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

/*
 * THE CHECKOUT THIS HARNESS SITS IN, unless DRPG_REPO says otherwise.
 *
 * It was "/home/user/Danganronpa-RPG" - the machine the harness was written on -
 * so a clone anywhere else booted a module that was not there, and a worktree
 * quietly booted the main checkout's copy instead of its own. Two directories up
 * from lib/ is audit/, three is the repository.
 */
const HERE = path.dirname(url.fileURLToPath(import.meta.url));
export const REPO = path.resolve(process.env.DRPG_REPO || path.resolve(HERE, "../../.."));
/** The same directory as a file: URL - what `import()` needs, on Windows too. */
export const REPO_URL = url.pathToFileURL(REPO).href;
export const MODULE_ID = "danganronpa-rpg";

/**
 * An exception that escaped module code into the host, as the scenarios see it.
 *
 * `globalThis.__errors` was read by every "no uncaught errors" check and written
 * by nothing: the array was created empty and stayed empty, so those checks
 * passed whatever happened (audit S14-09). Everything that plays Foundry's part
 * and catches a module callback's exception now reports it here, as well as to
 * the log the cluster prints.
 */
export function recordError(where, err) {
    try {
        (globalThis.__errors ??= []).push({
            where: String(where),
            message: String(err?.message ?? err),
            stack: String(err?.stack ?? "").split("\n").slice(0, 6).join("\n")
        });
    } catch {
        // Recording a failure must never become a second one.
    }
}

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
    /* A throwing listener is caught and the next one still runs, as this shim
       always did; the catch now also lands in `__errors`. A listener that
       returns a rejected promise is not caught here - it surfaces as an
       unhandled rejection, which client-entry.mjs records. */
    call(name, ...args) {
        this.fired.push(name);
        for (const entry of [...(this._hooks.get(name) ?? [])]) {
            if (entry.once) this.off(name, entry.fn);
            let out;
            try { out = entry.fn(...args); }
            catch (err) {
                this._log?.(`Hook ${name} listener threw: ${err.stack}`);
                recordError(`Hooks.call ${name}`, err);
                continue;
            }
            if (out === false) return false;
        }
        return true;
    }
    callAll(name, ...args) {
        this.fired.push(name);
        for (const entry of [...(this._hooks.get(name) ?? [])]) {
            if (entry.once) this.off(name, entry.fn);
            try { entry.fn(...args); }
            catch (err) {
                this._log?.(`Hook ${name} listener threw: ${err.stack}`);
                recordError(`Hooks.callAll ${name}`, err);
            }
        }
        return true;
    }
    /* Not recorded: in Foundry this is the REPORTING call - a caller that
       reaches it has already caught the error, which is the module handling
       it (nothing in scripts/ calls it today; measured with grep on 1.2.56). */
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
            this._exposeSource();
        }

        /*
         * A DOCUMENT'S OWN FIELDS READ AS PROPERTIES, THE WAY FOUNDRY'S DO.
         *
         * This class carried getters for the fields the shim happened to need -
         * `name`, `type`, `flags`, `system` - and everything else lived only in
         * `_source`. Foundry puts a document's whole schema on the document, so
         * module code reads `wall.c`, `region.shapes`, `light.config`, and in here
         * every one of those was `undefined`.
         *
         * It cost a real test a year. "A diagonal wall closes the staircase drawn
         * along it" builds three walls and asks fog.mjs whether the region's border
         * has walls alongside it - pure geometry, no canvas needed - and it has
         * failed since the day it was written, reported as "32.0 squares read as
         * open". The module was right: `wall.c` was undefined, so `wallAlongEdge`
         * skipped every wall and correctly found none. The test was measuring the
         * harness. It was carried in the accepted-failures bucket under the label
         * "needs a real canvas", which was never true of it.
         *
         * Defined rather than assigned, so a write goes to `_source` and `update`
         * keeps working; and never over a name the class already has, so a field
         * called `update` or `parent` cannot shadow a method.
         */
        _exposeSource() {
            for (const key of Object.keys(this._source)) {
                if (key === "_id" || key in this) continue;
                Object.defineProperty(this, key, {
                    configurable: true,
                    enumerable: false,
                    get: () => this._source[key],
                    set: v => { this._source[key] = v; }
                });
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
            this._exposeSource();   // a field that only arrives with an update is still a field
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
            // `noHook` skips the `pre` hook, as Foundry's client backend does - the
            // road Configure Ownership takes, which anonymity.mjs guards after the fact.
            const pre = context?.noHook ? undefined
                : hooks.call(`preUpdate${this.documentName}`, this, U.expandObject(U.deepClone(changes)), opts(context), ctx.userId());
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
        // Foundry stamps every message with its creation time; the messenger's
        // read state and unread badge are built on it.
        //
        // AND WITH ITS AUTHOR - the creating user, unless the data names one.
        // secret.mjs calls it "the one field Foundry stamps", and its socket
        // handler only accepts a card's words from a GM or from that author.
        // The shim stamped the time and not the author, so every private card a
        // PLAYER posted arrived at the GM authorless and its words were refused
        // ("not the author"): measured on 40-flow's Search card (1.2.56), whose
        // words the GM never held. It went unseen because the only check on it
        // matched the time-of-day card instead.
        static async create(data, context = {}) {
            const stamp = d => ({ timestamp: Date.now(), ...d, author: d?.author ?? d?.user ?? ctx.userId() });
            return super.create(Array.isArray(data) ? data.map(stamp) : stamp(data), context);
        }
        get timestamp() { return this._source.timestamp ?? 0; }
        get author() { return ctx.gameRef().users.get(this._source.author ?? this._source.user) ?? null; }
        get user() { return this.author; }
        get speaker() { return this._source.speaker ?? {}; }
        get whisper() { return this._source.whisper ?? []; }
        get blind() { return !!this._source.blind; }
        get content() { return this._source.content ?? ""; }
        get rolls() { return (this._source.rolls ?? []).map(r => typeof r === "string" ? JSON.parse(r) : r); }
        get isRoll() { return (this._source.rolls ?? []).length > 0; }
        get isAuthor() { return (this._source.author ?? this._source.user ?? null) === ctx.gameRef().user?.id; }
        /*
         * FOUNDRY'S OWN TWO GETTERS, AND THE ONLY PLACE A WHISPER IS A WHISPER.
         *
         * Every client holds every message (see REALISM RULES); these decide what
         * the chat log draws. Written to v14's `client/documents/chat-message.mjs`
         * as the audit quoted it from the installed build (S14-04, two readers,
         * lines 100-107) - no Foundry source is on the machine this was written
         * on, so this is their reading, not a fresh one:
         *
         *   visible           whispered -> a roll is visible to all (the card shows
         *                     that somebody rolled); anything else only to its
         *                     author and the users on its list.
         *   isContentVisible  of a visible message: whispered -> on the list, or
         *                     its author unless it is blind.
         *
         * No clause for GMs in either: a GM reads a whisper by being on its list,
         * and every private card this module writes puts the GMs there. The shim
         * this replaced gave GMs a pass and folded `blind` into `visible`, and
         * had no `isContentVisible` at all - which private-rolls.mjs asks.
         */
        get visible() {
            const u = ctx.gameRef().user;
            if (this.whisper.length) {
                if (this.isRoll) return true;
                return this.isAuthor || this.whisper.includes(u?.id);
            }
            return true;
        }
        get isContentVisible() {
            if (!this.visible) return false;
            const whisper = this.whisper;
            if (whisper.length) return whisper.includes(ctx.gameRef().user?.id) || (this.isAuthor && !this.blind);
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
            // Foundry concatenates `classes` down the DEFAULT_OPTIONS chain (DialogV2's
            // "dialog" + the caller's); mergeObject alone would replace the array.
            const chain = [];
            for (let c = this.constructor; c && c !== Object && c !== Function.prototype; c = Object.getPrototypeOf(c)) {
                if (Object.hasOwn(c, "DEFAULT_OPTIONS")) chain.unshift(c.DEFAULT_OPTIONS);
            }
            // `content` may be an element, which mergeObject would flatten to {}.
            const { content, ...rest } = options ?? {};
            this.options = {};
            for (const o of [...chain, rest]) this.options = U.mergeObject(this.options, o ?? {}, { inplace: false });
            this.options.classes = [...new Set(chain.concat([rest]).flatMap(o => o?.classes ?? []))];
            if (content !== undefined) this.options.content = content;
            this.element = null;
            this._rendered = false;
            this.id = this.options.id ?? `app-${U.randomID(8)}`;
            this.tabGroups = {};
            this._listeners = new Map();
            this.position = { ...(this.options.position ?? {}) };
        }
        static DEFAULT_OPTIONS = {};
        static PARTS = {};
        get rendered() { return this._rendered; }
        get title() { return this.options.window?.title ?? this.constructor.name; }
        get window() { return { title: this.title, controls: [] }; }
        // EventEmitterMixin: DialogV2.wait listens for "render" and "close".
        addEventListener(type, fn, { once = false } = {}) {
            if (!this._listeners.has(type)) this._listeners.set(type, []);
            this._listeners.get(type).push({ fn, once });
        }
        removeEventListener(type, fn) {
            const l = this._listeners.get(type) ?? [];
            const i = l.findIndex(e => e.fn === fn);
            if (i >= 0) l.splice(i, 1);
        }
        dispatchEvent(event) {
            let threw = false;
            for (const e of [...(this._listeners.get(event.type) ?? [])]) {
                if (e.once) this.removeEventListener(event.type, e.fn);
                try { e.fn.call(this, event); } catch (err) { threw = true; ctx.log(`${this.constructor.name} ${event.type} listener threw: ${err.stack}`); }
            }
            return !threw;
        }
        async render(opts2 = {}) {
            const doc = globalThis.document;
            const first = !this.element;
            if (first) {
                this.element = doc.createElement(this.options.tag ?? "div");
                this.element.id = this.id;
                this.element.classList.add("application", ...(this.options.classes ?? []));
                if (this.element.tagName === "DIALOG") this.element.setAttribute("open", "");
                // Foundry registers every rendered application here, and removes it on close.
                globalThis.foundry?.applications?.instances?.set(this.id, this);
            }
            let context = {};
            try { context = await this._prepareContext?.(opts2) ?? {}; } catch (err) { ctx.log(`_prepareContext threw in ${this.constructor.name}: ${err.stack}`); recordError(`${this.constructor.name}._prepareContext`, err); }
            // Handlebars parts are not rendered headlessly; call the lifecycle anyway.
            // Not recorded: with no template rendered, a part's context has nothing
            // real to be prepared against, so a throw here says more about the shim.
            try { await this._preparePartContext?.("main", context, opts2); } catch {}
            try {
                const html = await this._renderHTML?.(context, opts2);
                await this._replaceHTML?.(html, this.element, opts2);
            } catch (err) { ctx.log(`_renderHTML threw in ${this.constructor.name}: ${err.stack}`); recordError(`${this.constructor.name}._renderHTML`, err); }
            // Inserted once its HTML is in it, as Foundry's `_insertElement` does.
            if (first) doc.body.appendChild(this.element);
            try { await this._onRender?.(context, opts2); } catch (err) { ctx.log(`_onRender threw in ${this.constructor.name}: ${err.stack}`); recordError(`${this.constructor.name}._onRender`, err); }
            this._rendered = true;
            // Foundry's `_doEvent`: the "render" event (DialogV2's `render` option) BEFORE
            // the render hooks - the a11y sweep on the hook relies on it. A render that
            // throws stops there: no position (the window stays at 0,0) and no hooks.
            if (!this.dispatchEvent(new globalThis.window.Event("render"))) return this;
            if (first) this.setPosition(this.position);
            ctx.hooks().callAll("renderApplicationV2", this, this.element, context);
            ctx.hooks().callAll(`render${this.constructor.name}`, this, this.element, context);
            return this;
        }
        async close(opts2 = {}) {
            try { await this._onClose?.(opts2); } catch {}
            this.element?.remove();
            this._rendered = false;
            globalThis.foundry?.applications?.instances?.delete(this.id);
            ctx.hooks().callAll("closeApplicationV2", this, this.element);
            this.dispatchEvent(new globalThis.window.Event("close"));
            return this;
        }
        async minimize() {} async maximize() {}
        /*
         * Foundry writes the position inline and, on a first render with no left/top,
         * centres the window. jsdom has no layout, so an "auto" height measures 0 here.
         */
        setPosition(pos = {}) {
            const el = this.element;
            const width = typeof pos.width === "number" ? pos.width : (this.options.position?.width ?? 400);
            const height = typeof pos.height === "number" ? pos.height : (el?.offsetHeight ?? 0);
            const left = typeof pos.left === "number" ? pos.left : Math.max(0, (globalThis.innerWidth - width) / 2);
            const top = typeof pos.top === "number" ? pos.top : Math.max(0, (globalThis.innerHeight - height) / 2);
            Object.assign(this.position, { width, height, left, top });
            if (el) {
                el.style.left = `${left}px`;
                el.style.top = `${top}px`;
            }
            return this.position;
        }
        // Foundry: resolve on the element's own transitionend or after the timeout.
        async _awaitTransition(element, timeout) {
            return Promise.race([
                new Promise(resolve => element?.addEventListener?.("transitionend", resolve, { once: true })),
                new Promise(resolve => setTimeout(resolve, timeout))
            ]);
        }
        bringToFront() {} bringToTop() {}
        changeTab() {}
    }

    const HandlebarsApplicationMixin = Base => class extends Base {
        async _renderHTML() { return {}; }
        async _replaceHTML() {}
    };

    /**
     * DialogV2 - headless: answers come from a programmable queue.
     * Default behaviour: press the default button (or the first).
     * Scenarios push answers via globalThis.__dialogAnswers.push(fnOrValue).
     * Every dialog shown is recorded in globalThis.__dialogLog.
     */
    // `content` may be a string or an element (the module's `dialogContent` hands over a div).
    const contentText = c => typeof c === "string" ? c : (c?.outerHTML ?? "");
    // Headless, a window that reopens itself after its default button (the trial console,
    // the item tables) would recurse forever: the default is pressed, the callback reopens
    // the window, the default is pressed again. A human never does that. Past this depth
    // the window counts as dismissed.
    const openDepth = new Map();
    const MAX_DEPTH = 2;
    const autoAnswered = new Map();
    class DialogV2 extends ApplicationV2 {
        static DEFAULT_OPTIONS = { classes: ["dialog"], tag: "dialog", window: { minimizable: false }, position: { width: 400 }, form: { closeOnSubmit: true } };
        /* The instance form, as Foundry's: a form holding the content and a footer of buttons. */
        async _renderHTML() {
            const doc = globalThis.document;
            const form = doc.createElement("form");
            form.className = "dialog-form standard-form";
            // The content is parsed INTO the dialog's own form, so a `<form>` the content
            // brings is dropped by the parser and its fields belong to this one. A bare
            // <div> element is taken as markup (utils.mjs `dialogContent`).
            const c = this.options.content;
            const markup = (c && typeof c !== "string") ? (c.hasAttributes?.() ? c.outerHTML : c.innerHTML) : (c ?? "");
            form.innerHTML = `<div class="dialog-content standard-form">${markup}</div>`;
            const body = form.firstElementChild;
            const footer = doc.createElement("footer");
            footer.className = "form-footer";
            for (const b of this.options.buttons ?? []) {
                const btn = doc.createElement("button");
                btn.type = "submit";
                btn.dataset.action = b.action;
                if (b.default) btn.classList.add("default");
                btn.textContent = b.label ?? b.action;
                footer.append(btn);
            }
            form.append(body, footer);
            form.addEventListener("submit", event => { event.preventDefault(); this._onSubmit(event.submitter, event); });
            form.addEventListener("click", event => {
                const target = event.target?.closest?.("[data-action]");
                if (!target) return;
                const handler = this.options.actions?.[target.dataset.action];
                if (typeof handler === "function") { handler.call(this, event, target); return; }
                // jsdom does not submit a form from a button click; a browser does.
                if (target.closest("footer.form-footer")) { event.preventDefault(); this._onSubmit(target, event); }
            });
            return form;
        }
        async _replaceHTML(result, element) { if (result) element.replaceChildren(result); }
        async _onSubmit(target, event) {
            const button = (this.options.buttons ?? []).find(b => b.action === target?.dataset?.action);
            let result = null;
            try { result = (await button?.callback?.(event, target, this)) ?? button?.action; }
            catch (err) { ctx.log(`DialogV2 callback threw: ${err.stack}`); }
            await this.options.submit?.(result, this);
            return this.options.form?.closeOnSubmit !== false ? this.close({ submitted: true }) : this;
        }
        /* Foundry's own wait: resolve on submit (BEFORE the close), null on a dismissal. */
        static _openWindow({ rejectClose = false, close, render, ...options } = {}) {
            return new Promise((resolve, reject) => {
                const originalSubmit = options.submit;
                options.submit = async (result, dialog) => { await originalSubmit?.(result, dialog); resolve(result); };
                const dialog = new this(options);
                dialog.addEventListener("close", event => {
                    if (close instanceof Function) close(event, dialog);
                    if (rejectClose) reject(new Error("Dialog was dismissed without pressing a button."));
                    else resolve(null);
                }, { once: true });
                if (render instanceof Function) dialog.addEventListener("render", event => render(event, dialog), { once: true });
                dialog.render({ force: true });
            });
        }
        static async wait(config = {}) {
            const title = config.window?.title ?? "?";
            globalThis.__dialogLog.push({ kind: "wait", title, content: contentText(config.content).slice(0, 400), buttons: (config.buttons ?? []).map(b => b.action) });
            const queued = globalThis.__dialogAnswers.shift();
            if (queued !== undefined) {
                const v = typeof queued === "function" ? await queued(config) : queued;
                return v;
            }
            // A client told to behave like a person at a real table: the window is drawn,
            // registered, and stays until a button is pressed or it is closed.
            if (globalThis.__dialogWindows === true) return this._openWindow(config);
            // A client told to sit still (the suite runs on the GM alone; a player
            // auto-answering an opening roll would race it) closes every window.
            if (globalThis.__dialogAuto === false) return null;
            const buttons = config.buttons ?? [];
            const def = buttons.find(b => b.default) ?? buttons[0];
            if (!def) return null;
            const depth = (openDepth.get(title) ?? 0);
            if (depth >= MAX_DEPTH) return null;
            // ...and the tail-recursive shape too (window -> action -> window -> the same
            // action): the same title auto-answered many times in a second is a loop no
            // human is driving, so the window counts as dismissed.
            const now = Date.now();
            const recent = (autoAnswered.get(title) ?? []).filter(t => now - t < 1500);
            recent.push(now); autoAnswered.set(title, recent);
            if (recent.length > 6) return null;
            openDepth.set(title, depth + 1);
            try {
                if (typeof def.callback === "function") {
                    // Foundry passes (event, button, dialog); button.form?.elements is used to read inputs.
                    const fakeButton = { form: makeForm(config) };
                    try { return await def.callback(new globalThis.window.Event("click"), fakeButton, { element: makeDialogElement(config) }); }
                    // A throwing callback is a dialog that produced no answer; treat it as
                    // dismissed (`rejectClose: false` -> null) - and record it, because it
                    // is an exception that escaped module code, which is what __errors counts.
                    catch (err) { ctx.log(`DialogV2 callback threw: ${err.stack}`); recordError(`DialogV2.wait "${title}" callback`, err); return null; }
                }
                return def.action;
            } finally {
                openDepth.set(title, (openDepth.get(title) ?? 1) - 1);
            }
        }
        static async confirm(config = {}) {
            globalThis.__dialogLog.push({ kind: "confirm", title: config.window?.title, content: contentText(config.content).slice(0, 400) });
            const queued = globalThis.__dialogAnswers.shift();
            if (queued !== undefined) return typeof queued === "function" ? queued(config) : queued;
            if (globalThis.__dialogAuto === false) return null;
            // The catch used to be bare, so a throwing Yes was a silent "yes".
            if (config.yes?.callback) { try { return await config.yes.callback(new globalThis.window.Event("click"), { form: makeForm(config) }, { element: makeDialogElement(config) }); } catch (err) { ctx.log(`DialogV2.confirm callback threw: ${err.stack}`); recordError(`DialogV2.confirm "${config.window?.title ?? "?"}" callback`, err); return true; } }
            return true;
        }
        static async prompt(config = {}) {
            globalThis.__dialogLog.push({ kind: "prompt", title: config.window?.title });
            const queued = globalThis.__dialogAnswers.shift();
            if (queued !== undefined) return typeof queued === "function" ? queued(config) : queued;
            if (globalThis.__dialogAuto === false) return null;
            if (config.ok?.callback) { try { return await config.ok.callback(new globalThis.window.Event("click"), { form: makeForm(config) }, { element: makeDialogElement(config) }); } catch (err) { ctx.log(`DialogV2.prompt callback threw: ${err.stack}`); recordError(`DialogV2.prompt "${config.window?.title ?? "?"}" callback`, err); return "ok"; } }
            return "ok";
        }
        static async input(config = {}) { return this.prompt(config); }
    }

    function makeDialogElement(config) {
        const doc = globalThis.document;
        const el = doc.createElement("dialog");
        if (config.content && typeof config.content !== "string") el.append(config.content.cloneNode(true));
        else el.innerHTML = config.content ?? "";
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
