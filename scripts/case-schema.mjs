/**
 * THE CASE SCHEMA (E97 C3, 11.11.2026; STAGE E97+E98 C3, the owner's answers of 09.11 and 11.11).
 *
 * What a GM builds on top of a chapter's evidence in the Investigation panel's Map view: the deductions the evidence
 * leads to, the counters that refute them and the one solution, each a row of the GMs' store `caseSchemaStore`
 * (gm-stores.mjs) keyed `${chapter}:${nodeId}` - `{ kind, label, text, inputs, refutes, mode, order, made }` - beside one
 * meta row per chapter, `${chapter}:meta` - `{ sort, manual, run, askedAt }`. The evidence is NOT a row: a trace is a
 * node under its ledger key (`sceneId.tokenId`, remnants.mjs `keyOf`), a Key Remnant slot under `key:<slot>` while it
 * is planned and as its trace once placed, the Final Truth as the trace it is - joined here by key (`graphOf`), so a
 * trace edited on the Table is the same node on the Map with nothing copied.
 *
 * GM-ONLY, LIKE THE ANSWER KEY (Q8: any GM, an Assistant too). The schema is the case worked out ahead of the trial;
 * a player's browser holds none of it (gm-store.mjs `makeHandle` refuses a write there, `gmsRefusal` a packet), and the
 * writers below ask for a GM before they touch it. No bridge action, socket, flag or world setting (R3374).
 *
 * WHAT E99 READS: `caseGraph`, `caseModes` and the node `mode` (a trial minigame per node, the floor's own modes,
 * floor-machine.mjs `MODES`), the counters' `refutes`, the solution node, and `reachability` below (C4), what the
 * students hold; case-layout.mjs (C4) lays the graph out.
 */

import { MODES } from "./floor-machine.mjs";
import { caseSchemaStore, keyPlanStore, caseTickStore } from "./gm-stores.mjs";
import { remnantsOn, remnantData, keyOf } from "./remnants.mjs";
import { getClock } from "./clock.mjs";
import { sameSeason, SETTINGS } from "./settings.mjs";
import { MODULE_ID, REMNANT_VISIBILITY, TRUTH_BULLET_TYPES } from "./config.mjs";

/** The kinds of a schema row: three the GM reasons with, and (E97 C12) "incident", an Incident Remnant the case plans and
 *  a GM places by hand - evidence, planned until its `trace` is on the map. Evidence nodes are "trace", "key", "final". */
/* E104: and "final", a planned Final Truth Remnant: the Final Truth form's fields, kept until it is placed from its node;
   and "bullet", a planned Truth Bullet made by hand: the Give Truth Bullet window's Write new fields, given from its node */
export const CASE_KINDS = Object.freeze(["deduction", "counter", "solution", "incident", "autopsy", "final", "bullet"]);
/* THE PLANNED AUTOPSY (the owner, 13.11.2026: "Dodajmy tez opcje zaplanowania autopsy truth bullet zamiast wysylania go od
   razu. Niech dziala tak samo jak key remnanty ... gracze dostaja od razu po odkryciu ciala. Bez kliku GMa"): one row a
   chapter, kind "autopsy", under this id - its name (`label`), the players' words (`text`) and the GM's note (`note`).
   case-realize.mjs `sendPlannedAutopsy` sends it at the body's discovery.
   SEVERAL A CHAPTER (the owner, 13.11.2026: "zaplanowane autopsy moga byc wiecej niz 1. Ogolnie cel jest taki by gm mial
   preset pokazujacy ile powinno tego byc, ale by mogl zrobic ostatecznie ile chce"): the first under this id, the n-th
   under `autopsy-<n>` (`autopsyId`), up to AUTOPSY_MAX. How many the chapter plans is its meta row's `autopsies`, or
   the preset where none is written (investigation.mjs `autopsyCount`); each goes out when the chapter's `atBody`-th
   body is found (its own number by default; `autopsiesDue`), and its meta row's `autopsySent` marks it gone. */
export const AUTOPSY_NODE = "autopsy";
export const AUTOPSY_MAX = 9;

/** The node id of a chapter's `n`-th planned Autopsy (1 is AUTOPSY_NODE), and an id's number, or null for no Autopsy's. */
export function autopsyId(n) {
    return n === 1 ? AUTOPSY_NODE : `${AUTOPSY_NODE}-${n}`;
}
export function autopsyNumber(id) {
    const m = /^autopsy(?:-([2-9]))?$/.exec(String(id ?? ""));
    return m ? (m[1] ? Number(m[1]) : 1) : null;
}

/** A chapter's bodies in the order they were found: the victims of its discovery stamps (settings.mjs `bodiesFoundIn`),
 *  each once, the stamps by their `at` (a stamp's own order kept). Pure. */
export function bodiesInOrder(stamps = []) {
    const out = [];
    const rows = (Array.isArray(stamps) ? stamps : []).map((row, i) => ({ row, i }))
        .sort((a, b) => ((Number(a.row?.at) || 0) - (Number(b.row?.at) || 0)) || a.i - b.i);
    for (const { row } of rows) for (const id of row?.victimIds ?? []) if (id && !out.includes(String(id))) out.push(String(id));
    return out;
}

/** The planned Autopsies' preset: one a body - the bodies found and the open incident's victim not found yet - and one
 *  where the chapter has none yet (the case plans one murder a chapter); at most AUTOPSY_MAX. Pure. */
export function autopsyPresetOf({ found = [], victimId = null } = {}) {
    const bodies = new Set((found ?? []).filter(Boolean).map(String));
    if (victimId) bodies.add(String(victimId));
    return Math.min(AUTOPSY_MAX, Math.max(1, bodies.size));
}

/**
 * The planned Autopsies that go out now: of the first `count`, each with a name or words written, not marked sent
 * (`sent`, the meta row's `autopsySent`), whose body has been found (`atBody`, its own number where none is written,
 * at most `bodies`, the chapter's bodies found). In their order. Answers `[{ id, n, atBody }]`. Pure.
 */
export function autopsiesDue({ count = 1, rows = {}, sent = {}, bodies = 0 } = {}) {
    const out = [];
    for (let n = 1; n <= Math.min(AUTOPSY_MAX, count); n++) {
        const id = autopsyId(n);
        const plan = caseNodeOf(rows?.[id]);
        if (plan?.kind !== "autopsy" || !(plan.label || plan.text) || sent?.[id]) continue;
        const atBody = plan.atBody ?? n;
        if (atBody <= bodies) out.push({ id, n, atBody });
    }
    return out;
}
/** The kinds a trial mode stands on, and a planned minigame's fields on them (13.11.2026, `caseNodeOf`). */
const SCHEMA_KINDS = Object.freeze(["deduction", "counter", "solution"]);
const ZONE_FIELDS = Object.freeze(["zoneQuestion", "zoneA", "zoneB", "zoneThesis", "diveSet"]);
/* A PLANNED REMNANT'S TYPE (the owner, 13.11.2026: "opcje w planerze dodawania zaplanowanych remnantow innego typu niz
   incident i keys"): an "incident" row plans a Remnant of one of these, Incident by default (every row before this).
   Not a Key Remnant (the Key plan's slots plan those), a Final Truth Remnant (the Final Truth form places it) or an
   Autopsy Remnant (handed over from the GM panel, never found: Observe has no number for it, New Remnant offers none). */
export const PLANNED_TYPES = Object.freeze(["incident", "prep", "neutral", "faint", "resolution"]);
/** The column orders (STAGE C4): by the GM's arrows, by kind, by room, by state, and with the fewest crossings. */
export const CASE_SORTS = Object.freeze(["manual", "kind", "room", "state", "uncrossed"]);
const META = "meta";
const SLOT = "key:";

/** A node id a GM's row may take: letters, digits, `-` and `_`, never the meta row's own name. */
export function validNodeId(id) {
    return typeof id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id) && id !== META;
}
export const caseKeyOf = (chapter, nodeId) => `${chapter}:${nodeId}`;
export const caseMetaKey = chapter => `${chapter}:${META}`;
/** A fresh id for a new node of `kind`; `random` is Foundry's by default and the suite's to hand. */
export function newCaseNodeId(kind, random = () => foundry.utils.randomID(10)) {
    return `${CASE_KINDS.includes(kind) ? kind : "node"}-${random()}`;
}

/* NOT A NODE'S (the owner, 13.11.2026: "usuwamy objection i rebuttal"): a player starts an Objection and its Rebuttal
   follows, so no node plans one; a node stored with either reads as no mode (`caseNodeOf`), and its next Save writes what
   its select then holds. */
const PLAYER_MODES = Object.freeze([MODES.objection, MODES.rebuttal]);

/** The trial's modes a node may name (E99 draws one minigame per node): floor-machine.mjs `MODES`, as it lists them,
 *  less the two a player starts. */
export function caseModes() {
    return Object.values(MODES).filter(m => !PLAYER_MODES.includes(m));
}

const TIES = Object.freeze(["", "tied", "untied"]);
function incidentFields(raw) {
    // a planned Remnant's and a planned Final Truth's (E104); the Final Truth is tied and reinforced by its kind
    const on = raw.kind === "incident" || raw.kind === "final";
    const own = raw.kind === "incident";
    // a planned Truth Bullet (E104) has a visibility and an analysis too
    const bullet = raw.kind === "bullet";
    const str = v => (on ? (typeof v === "string" ? v : "") : null);
    return {
        scene: on ? (typeof raw.scene === "string" && raw.scene ? raw.scene : null) : null,
        author: str(raw.author),
        vis: on || bullet ? (REMNANT_VISIBILITY.includes(raw.vis) ? raw.vis : "evident") : null,
        tie: own ? (TIES.includes(raw.tie) ? raw.tie : ((PLANNED_TYPES.includes(raw.type) ? raw.type : "incident") === "incident" ? "tied" : "")) : null,
        reinforced: own ? raw.reinforced === true : null,
        analysis: on || bullet ? (typeof raw.analysis === "string" ? raw.analysis : "") : null,
        img: str(raw.img),
        ...bulletFields(raw)
    };
}

/* A PLANNED TRUTH BULLET MADE BY HAND (E104): the rest of the Write new tab (gm-items.mjs `bulletCreatePane`) and the
   window's recipient rows - who gets it, whether the player is told (ticked, as the window draws it), its real type
   (Neutral, as there), how it shows (auto, as there), Faint and tied - and `given`, when it went out from its node. */
const SHOWN = Object.freeze(["auto", "neutral", "real"]);
function bulletFields(raw) {
    const on = raw.kind === "bullet";
    return {
        recipient: on ? (typeof raw.recipient === "string" ? raw.recipient : "") : null,
        tell: on ? raw.tell !== false : null,
        realType: on ? (TRUTH_BULLET_TYPES[raw.realType] ? raw.realType : "neutral") : null,
        shown: on ? (SHOWN.includes(raw.shown) ? raw.shown : "auto") : null,
        faint: on ? raw.faint === true : null,
        tied: on ? raw.tied === true : null,
        given: on && Number.isFinite(raw.given) ? raw.given : null
    };
}

const atBodyOf = v => {
    const n = typeof v === "string" && v.trim() ? Number(v) : v;
    return Number.isInteger(n) && n >= 1 && n <= AUTOPSY_MAX ? n : null;
};
const ids = list => [...new Set((Array.isArray(list) ? list : []).filter(v => typeof v === "string" && v))];
const isPlain = o => o !== null && typeof o === "object" && !Array.isArray(o);

/**
 * A schema row as the map reads it, or null for a row of no kind of `CASE_KINDS`. Every field has its empty value; a
 * `mode` is kept as written, known or not (C8's consistency check names one `caseModes` lacks), but for an Objection or a
 * Rebuttal, read as none (13.11.2026). Pure.
 */
export function caseNodeOf(raw) {
    if (!isPlain(raw) || !CASE_KINDS.includes(raw.kind)) return null;
    return {
        kind: raw.kind,
        label: typeof raw.label === "string" ? raw.label : "",
        text: typeof raw.text === "string" ? raw.text : "",
        inputs: ids(raw.inputs),
        refutes: ids(raw.refutes),
        mode: typeof raw.mode === "string" && raw.mode && !PLAYER_MODES.includes(raw.mode) ? raw.mode : null,
        order: Number.isFinite(raw.order) ? raw.order : null,
        made: typeof raw.made === "string" && raw.made ? raw.made : null,
        // E97 C12: a planned Incident Remnant's room, and the Remnant that stands for it once placed
        room: typeof raw.room === "string" && raw.room ? raw.room : null,
        trace: typeof raw.trace === "string" && raw.trace ? raw.trace : null,
        // 13.11.2026: a planned Remnant's type, Incident where none is written; no other kind has one
        type: raw.kind === "incident" ? (PLANNED_TYPES.includes(raw.type) ? raw.type : "incident") : null,
        // 13.11.2026: a planned Autopsy's note for the GMs, its answer key's `gmNote`; a planned Remnant's (E104) too
        note: ["autopsy", "incident", "final", "bullet"].includes(raw.kind) ? (typeof raw.note === "string" ? raw.note : "") : null,
        /* E104 (the owner, 13.11.2026: "niech pozwala przypisac od razu lokalizacje, trudnosc i wszystkie parametry kazdemu
           zaplanowanemu remnantowi"): a planned Remnant holds every field New Remnant asks (investigation.mjs
           `openNewTrace`) and the Table's picture - its room's scene, who left it, its band (with its type, its Observe
           DC), the tie (open, tied, not tied; an Incident's reads tied where none is written), reinforced, the
           analysis and the picture. Null on every other kind. */
        ...incidentFields(raw),
        // 13.11.2026: which of the chapter's bodies, in the order found, sends a planned Autopsy; null is its own number
        atBody: raw.kind === "autopsy" ? atBodyOf(raw.atBody) : null,
        /* THE PLANNED MINIGAME (the owner, 13.11.2026: "mozliwosc zaplanowania logic dive i innych minigier class triala z
           poziomu planera sprawy"): what the zones' window asks for the node's zone mode - a Straw Poll's or a Scrum Debate's
           question and two answers (a Scrum's thesis too), a Logic Dive's saved set (the GMs' `diveSetStore`, its truths
           there). The GMs' store, as every row; the console's node button fills the window in (case-trial.mjs
           `startFromNode`). Strings on the three kinds a trial mode stands on, null on the rest. */
        ...Object.fromEntries(ZONE_FIELDS.map(f => [f, SCHEMA_KINDS.includes(raw.kind) ? (typeof raw[f] === "string" ? raw[f] : "") : null]))
    };
}

/** A chapter's meta row as the map reads it: a sort it does not know is "kind"; `manual` keeps numbers only; `made` the
 *  realization's marks, each `{ run, slot }` (E97 C10). Pure. */
export function caseMetaOf(raw) {
    const row = isPlain(raw) ? raw : {};
    return {
        sort: CASE_SORTS.includes(row.sort) ? row.sort : "kind",
        manual: Object.fromEntries(Object.entries(isPlain(row.manual) ? row.manual : {}).filter(([, v]) => Number.isFinite(v))),
        run: typeof row.run === "string" && row.run ? row.run : null,
        askedAt: Number.isFinite(row.askedAt) ? row.askedAt : null,
        // E97 C10: what a realization placed, by the Remnant's key: `{ run, slot }`
        made: Object.fromEntries(Object.entries(isPlain(row.made) ? row.made : {})
            .filter(([, v]) => isPlain(v) && typeof v.run === "string" && v.run && Number.isInteger(v.slot)).map(([k, v]) => [k, { run: v.run, slot: v.slot }])),
        // 13.11.2026: how many Autopsies the chapter plans (null: the preset), and when each planned one went out
        autopsies: atBodyOf(row.autopsies),
        autopsySent: Object.fromEntries(Object.entries(isPlain(row.autopsySent) ? row.autopsySent : {})
            .filter(([k, v]) => autopsyNumber(k) !== null && Number.isFinite(v)))
    };
}

/**
 * THE GRAPH, JOINED BY KEY. Pure: `rows` the chapter's schema rows by node id (the meta row apart, as `meta`), `traces`
 * `[{ key, type, name, label, tiedToCrime, faint, room, ... }]`, `slots` the Key plan's `[{ slot, name, scale, tokenId,
 * sceneId }]`. Evidence first in the order given - each trace a node under its key ("key" for a Key Remnant, "final"
 * for the Final Truth, "trace" for the rest), a slot whose token is one of `traces` standing for it (`slot` on the
 * trace's node, and `key:<slot>` read as the trace's key), every other slot a planned node `key:<slot>` - then the
 * schema's nodes in row order. Edges: an input to its node ("input"), a counter to what it refutes ("refutes").
 * A reference to no node is named in `missing`, never dropped. Answers `{ chapter, meta, nodes, edges, missing }`.
 */
export function graphOf({ chapter = null, rows = {}, meta = null, traces = [], slots = [], autopsy = false } = {}) {
    const nodes = [];
    /* `autopsy`: how many planned Autopsies the Map draws (true is one, as before 13.11's several); a written one past
       that count is drawn only when it went out (its mark), so a lowered count hides nothing that was sent */
    const autopsies = autopsy === true ? 1 : Number.isInteger(autopsy) ? Math.min(AUTOPSY_MAX, Math.max(0, autopsy)) : 0;
    const sentMarks = caseMetaOf(meta).autopsySent;
    const alias = new Map();
    const bySlot = new Map();
    for (const s of slots ?? []) {
        if (Number.isInteger(s?.slot) && s.tokenId && s.sceneId) bySlot.set(`${s.sceneId}.${s.tokenId}`, s);
    }
    const placed = new Set();
    for (const t of traces ?? []) {
        if (!t?.key) continue;
        const s = bySlot.get(t.key) ?? null;
        if (s) { placed.add(s.slot); alias.set(`${SLOT}${s.slot}`, t.key); }
        nodes.push({
            id: t.key, kind: t.type === "final" ? "final" : (t.type === "key" || s ? "key" : "trace"), evidence: true, planned: false,
            slot: s ? s.slot : null, trace: t.key, type: t.type ?? null, label: t.name || t.label || "", tied: t.tiedToCrime === true,
            faint: Boolean(t.faint), room: t.room ?? null, chapter: t.chapter ?? null, foundAt: t.foundAt ?? null,
            // its description (the player's words): drawn whole on its node since the E97 fix, and E99 C6's summary words
            text: typeof t.text === "string" ? t.text : typeof t.playerText === "string" ? t.playerText : ""
        });
    }
    for (const s of slots ?? []) {
        if (!Number.isInteger(s?.slot) || placed.has(s.slot)) continue;
        /* a slot not yet placed needs a room to be placed by (E104; `checkCase`'s "incomplete"): Place and the realization
           ask for one, and the Map says so beforehand */
        const room = s.room || s.createIn || null;
        nodes.push({ id: `${SLOT}${s.slot}`, kind: "key", evidence: true, planned: true, slot: s.slot, trace: null, type: "key",
            label: s.name || s.text || "", tied: true, faint: false, room, chapter, foundAt: null, scale: s.scale ?? null,
            text: s.name && typeof s.text === "string" ? s.text : "", scene: s.scene ?? null, vis: s.vis ?? null, author: s.author ?? "",
            img: s.img ?? "", needs: room ? [] : ["room"] });
    }
    const traceKeys = new Set(nodes.filter(n => n.trace).map(n => n.trace));
    for (const [id, raw] of Object.entries(rows ?? {})) {
        const node = validNodeId(id) ? caseNodeOf(raw) : null;
        if (!node) continue;
        /* A PLANNED INCIDENT REMNANT (E97 C12) is evidence: placed, it is its Remnant (the row's id read as the trace's
           key, the trace's node marked with the row); not yet, a planned node of its own in the evidence column. */
        if (node.kind === "incident") {
            if (node.trace && traceKeys.has(node.trace)) {
                alias.set(id, node.trace);
                const t = nodes.find(n => n.id === node.trace);
                if (t) t.incident = id;
                continue;
            }
            /* every field it plans (E104), and in `needs` what New Remnant cannot place it without - a room - so the Map
               says so (`checkCase`'s "incomplete") and placing asks for it (investigation.mjs `placeIncident`) */
            nodes.push({ id, kind: "incident", evidence: true, planned: true, slot: null, trace: null, type: node.type, label: node.label,
                tied: node.tie === "tied", faint: node.type === "faint", room: node.room, chapter, foundAt: null, incident: id, text: node.text,
                scene: node.scene, author: node.author, vis: node.vis, tie: node.tie, reinforced: node.reinforced, analysis: node.analysis,
                note: node.note, img: node.img, needs: node.room ? [] : ["room"] });
            continue;
        }
        /* A PLANNED FINAL TRUTH (E104) is evidence as a planned Remnant is: placed, its Remnant (`trace`); not yet, a planned
           node holding the Final Truth form's fields, needing a room to be placed by */
        if (node.kind === "final") {
            if (node.trace && traceKeys.has(node.trace)) {
                alias.set(id, node.trace);
                const t = nodes.find(n => n.id === node.trace);
                if (t) t.finalPlan = id;
                continue;
            }
            nodes.push({ id, kind: "final", evidence: true, planned: true, slot: null, trace: null, type: "final", label: node.label, tied: true,
                faint: false, room: node.room, chapter, foundAt: null, finalPlan: id, text: node.text, scene: node.scene, author: node.author,
                vis: node.vis, analysis: node.analysis, note: node.note, img: node.img, needs: node.room ? [] : ["room"] });
            continue;
        }
        /* A PLANNED TRUTH BULLET (E104) is evidence: planned until given, then marked sent (`given`), as an Autopsy is; it
           needs a name (the window refuses one without) and a recipient to be given by */
        if (node.kind === "bullet") {
            nodes.push({ id, kind: "bullet", evidence: true, planned: true, slot: null, trace: null, type: node.realType, label: node.label,
                tied: node.tied === true, faint: node.faint === true, room: null, chapter, foundAt: null, text: node.text, recipient: node.recipient,
                tell: node.tell, realType: node.realType, shown: node.shown, vis: node.vis, analysis: node.analysis, note: node.note,
                given: node.given, sent: node.given !== null, needs: [...(node.label ? [] : ["name"]), ...(node.recipient ? [] : ["recipient"])] });
            continue;
        }
        // A PLANNED AUTOPSY (13.11.2026) is evidence too, planned until it is sent; its holders are its bullets' (investigation.mjs `caseReach`)
        if (node.kind === "autopsy") {
            const n = autopsyNumber(id);
            if (n === null || (n > autopsies && !sentMarks[id])) continue;
            nodes.push(autopsyNode(chapter, n, node, Boolean(sentMarks[id])));
            continue;
        }
        nodes.push({ id, evidence: false, planned: false, ...node });
    }
    for (let n = 1; n <= autopsies; n++) if (!nodes.some(x => x.id === autopsyId(n))) nodes.push(autopsyNode(chapter, n, null, Boolean(sentMarks[autopsyId(n)])));
    // the Autopsies in their order, where the evidence column draws them
    const order = nodes.filter(x => x.kind === "autopsy").sort((a, b) => a.n - b.n);
    if (order.length > 1) { let i = 0; for (let k = 0; k < nodes.length; k++) if (nodes[k].kind === "autopsy") nodes[k] = order[i++]; }
    const known = new Set(nodes.map(n => n.id));
    const edges = [];
    const missing = [];
    const ref = (node, id) => {
        const to = alias.get(id) ?? id;
        if (known.has(to)) return to;
        missing.push({ node: node.id, ref: id });
        return null;
    };
    for (const node of nodes) {
        if (node.evidence) continue;
        for (const id of node.inputs) {
            const from = ref(node, id);
            if (from) edges.push({ from, to: node.id, kind: "input" });
        }
        for (const id of node.refutes) {
            const to = ref(node, id);
            if (to) edges.push({ from: node.id, to, kind: "refutes" });
        }
    }
    return { chapter, meta: caseMetaOf(meta), nodes, edges, missing };
}

/** The chapter's schema rows by node id, and its meta row: a GM's store, so nothing on any other browser. */
export function caseRows(chapter) {
    const prefix = `${chapter}:`;
    const rows = {};
    let meta = null;
    for (const [key, row] of Object.entries(game.user?.isGM ? caseSchemaStore.entries() ?? {} : {})) {
        if (!key.startsWith(prefix)) continue;
        const id = key.slice(prefix.length);
        if (id === META) meta = row;
        else rows[id] = row;
    }
    return { rows, meta };
}

/**
 * The chapter's graph, read off the world on a GM: this season's traces of the chapter (`sameSeason`; every chapter's
 * with `chapters: "all"`), the Key plan's slots of the chapter that a GM wrote (or `slots`, as given), the schema's rows. `{}`-shaped and
 * empty on any other browser, which holds none of the three.
 */
export function caseGraph(chapter = getClock().chapter, { chapters = "this", slots: given = null, autopsy = false } = {}) {
    if (!game.user?.isGM) return graphOf({ chapter });
    const traces = [];
    for (const scene of game.scenes ?? []) {
        for (const token of remnantsOn(scene)) {
            const data = remnantData(token);
            if (!data || (chapters !== "all" && (data.chapter !== chapter || !sameSeason(data)))) continue;
            traces.push({ ...data, key: keyOf(token), name: data.public?.name ?? "", text: data.public?.playerText ?? "" });
        }
    }
    const slots = [];
    const prefix = `${chapter}:`;
    for (const [key, row] of Object.entries(keyPlanStore.entries() ?? {})) {
        if (!key.startsWith(prefix)) continue;
        const slot = Number(key.slice(prefix.length));
        if (Number.isInteger(slot) && slot >= 0) slots.push({ ...row, slot });
    }
    slots.sort((a, b) => a.slot - b.slot);
    const { rows, meta } = caseRows(chapter);
    /* `slots` given (E97 C6): the Key plan's every slot as investigation.mjs `keyPlan` reads it, a slot no GM wrote among
       them, so the Map has a node - and the Table's fields - for each slot the Table draws a row for. */
    return graphOf({ chapter, rows, meta, traces, slots: Array.isArray(given) ? given : slots, autopsy });
}

/** The chapter's `n`-th planned Autopsy's evidence node, from its row or, unwritten, empty (the Map draws it as the Key plan's
 *  slots are); `sent` its meta row's mark. */
function autopsyNode(chapter, n = 1, node = null, sent = false) {
    return { id: autopsyId(n), n, kind: "autopsy", evidence: true, planned: true, slot: null, trace: null, type: "autopsy",
        label: node?.label ?? "", text: node?.text ?? "", note: node?.note ?? "", atBody: node?.atBody ?? null, sent, tied: true,
        faint: false, room: null, chapter, foundAt: null, written: Boolean(node), inputs: [], refutes: [], mode: null };
}

const NODE_FIELDS = Object.freeze(["kind", "label", "text", "inputs", "refutes", "mode", "order", "made", "room", "trace", "type", "note", "atBody", "scene", "author", "vis", "tie", "reinforced", "analysis", "img",
    "recipient", "tell", "realType", "shown", "faint", "tied", "given",
    "zoneQuestion", "zoneA", "zoneB", "zoneThesis", "diveSet"]);
const META_FIELDS = Object.freeze(["sort", "manual", "run", "askedAt", "made", "autopsies", "autopsySent"]);
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * The fields of `fields` a write takes (pure): each of `names` given, read through `read` into the stored shape, and -
 * with `base`, the row as the GM's window drew it - only those that differ from it, so a Save keeps another GM's write
 * of a field this GM did not touch (the Key plan's rule, investigation.mjs `setKeyPlan`).
 */
function patchOf(fields, names, read, base) {
    const shaped = read({ ...(isPlain(base) ? base : {}), ...fields });
    const patch = {};
    for (const name of names) {
        if (!isPlain(fields) || fields[name] === undefined) continue;
        if (isPlain(base) && same(shaped[name], read(base)[name])) continue;
        patch[name] = shaped[name];
    }
    return patch;
}

/**
 * Write one node of the chapter's schema, on a GM: the fields named, each with its own stamp (two GMs editing two
 * fields of one node keep both; one field written twice keeps the later - `inputs` is one field, STAGE risk 6). A new
 * node needs its kind. Answers the row, or null where nothing may be written.
 */
export async function setCaseNode(chapter, nodeId, fields = {}, { base = null } = {}) {
    if (!game.user?.isGM || !Number.isInteger(chapter) || !validNodeId(nodeId)) return null;
    const key = caseKeyOf(chapter, nodeId);
    const held = caseSchemaStore.get(key);
    if (!caseNodeOf({ ...(held ?? {}), ...(isPlain(fields) ? fields : {}) })) return null;
    /* Shaped over the row held (E97 C6): a write of one field carries no `kind`, and `caseNodeOf` reads a row with no
       kind as none - the field came out undefined and nothing was written (the Map's Save, measured in tier 2). */
    const patch = patchOf(fields, NODE_FIELDS, raw => caseNodeOf({ ...(held ?? {}), ...raw }) ?? {}, base);
    if (Object.keys(patch).length) await caseSchemaStore.patch(key, patch, { changedOnly: true });
    return caseSchemaStore.get(key) ?? null;
}

/** Write the chapter's meta row (its sort, the GM's arrows, the realization's run, when the question was asked), on a GM. */
export async function setCaseMeta(chapter, fields = {}, { base = null } = {}) {
    if (!game.user?.isGM || !Number.isInteger(chapter)) return null;
    const key = caseMetaKey(chapter);
    const patch = patchOf(fields, META_FIELDS, caseMetaOf, base);
    if (Object.keys(patch).length) await caseSchemaStore.patch(key, patch, { changedOnly: true });
    return caseSchemaStore.get(key) ?? null;
}

/** Remove one node, on a GM: a tombstone every GM gets. What named it keeps the reference (`missing`, C8). */
export async function dropCaseNode(chapter, nodeId) {
    if (!game.user?.isGM || !Number.isInteger(chapter) || !validNodeId(nodeId)) return false;
    await caseSchemaStore.drop(caseKeyOf(chapter, nodeId));
    return true;
}

/**
 * WHAT THE STUDENTS CAN REACH (E97 C4, 11.11.2026; the owner's A and B of 09.11; R3376). Pure: `graph` of `graphOf`,
 * `holders` each evidence node's holders - actor ids, an object or a Map by node id (C7 builds it from the bullets'
 * answer keys) - `culpritId` the murder's culprit (`castStore` `killerId`), `living` the living students' ids (null:
 * every holder counts), `ticks` E99's ticked nodes (empty until then).
 *
 * An evidence input is held when a living student other than the culprit holds a bullet of it: B, "a bullet held only
 * by the culprit does not count" (it counts once someone else holds it). A schema input is held when it is reachable
 * itself or ticked. A node is reachable when it holds STRICTLY more than half its inputs: A, "2 inputs = both, 4 =
 * three", so 1, 2, 2, 3 and 3 of 1 to 5 (`needed`); a node with no input is never reachable (C8 names it), nor one on
 * a cycle. Answers, by node id, `{ held, holders, culpritOnly }` for evidence and `{ held, of, needed, reachable }` for
 * the schema's nodes - the "x z y" C7 draws.
 */
export function reachability(graph, holders = {}, { culpritId = null, living = null, ticks = {} } = {}) {
    const nodes = graph?.nodes ?? [];
    const byId = new Map(nodes.map(n => [n.id, n]));
    const alive = living ? new Set(living) : null;
    const holdersOf = id => (holders instanceof Map ? holders.get(id) : holders?.[id]) ?? [];
    const out = {};
    for (const n of nodes) {
        if (!n.evidence) continue;
        const all = [...new Set([...holdersOf(n.id)].filter(a => typeof a === "string" && a && (!alive || alive.has(a))))];
        const counted = all.filter(a => a !== culpritId);
        out[n.id] = { held: counted.length > 0, holders: counted, culpritOnly: !counted.length && culpritId !== null && all.includes(culpritId) };
    }
    const into = new Map(nodes.map(n => [n.id, []]));
    for (const e of graph?.edges ?? []) if (e.kind === "input" && into.has(e.to) && byId.has(e.from)) into.get(e.to).push(e.from);
    const visiting = new Set();
    const reach = id => {
        if (out[id]) return byId.get(id).evidence ? out[id].held : out[id].reachable;
        if (visiting.has(id)) return false;
        visiting.add(id);
        const inputs = into.get(id) ?? [];
        const held = inputs.filter(src => (byId.get(src).evidence ? reach(src) : ticks?.[src] === true || reach(src))).length;
        const needed = Math.floor(inputs.length / 2) + 1;
        visiting.delete(id);
        out[id] = { held, of: inputs.length, needed, reachable: inputs.length > 0 && held >= needed };
        return out[id].reachable;
    };
    for (const n of nodes) if (!n.evidence) reach(n.id);
    return out;
}

/** The codes `checkCase` names, in the order it reads them. */
export const CASE_PROBLEMS = Object.freeze(["noInputs", "cycle", "missing", "noTarget", "noSolution", "twoSolutions", "solutionUnreached", "badMode", "culpritOnly", "tooManyKeys", "incomplete"]);

/**
 * THE CASE'S CONSISTENCY (E97 C8; STAGE C8, Q-E97-7's default: warnings that block nothing). Pure: `graph` of `graphOf`,
 * `reach` of `reachability`, `cycle` the nodes the layout found on a cycle, `modes` the trial's modes, `keyMax` the Key
 * Remnants a chapter prepares. Answers `[{ code, node, ref }]`, one per problem, in CASE_PROBLEMS' order:
 * - noInputs: a deduction or the solution resting on nothing;
 * - cycle: a node on a circle of inputs (the map leaves those out);
 * - missing: a node naming a node, Remnant or Key slot that is not there (`ref` the name);
 * - noTarget: a counter refuting nothing;
 * - noSolution: a schema with deductions and no solution; twoSolutions: more than one (each after the first);
 * - solutionUnreached: a solution that names inputs none of which is on the map (every one gone), so nothing leads to it;
 * - badMode: a trial mode the trial does not have (a stage that renamed or dropped one);
 * - culpritOnly: a deduction an input of which only the culprit holds (B: it does not count until someone else does);
 * - tooManyKeys: more Key Remnant nodes than a chapter prepares;
 * - incomplete (E104): a planned item lacking a field its real road cannot place or give it without (`ref` the field,
 *   one problem a field; the node's `needs`, `graphOf`).
 */
export function checkCase(graph, { reach = {}, cycle = [], modes = caseModes(), keyMax = Infinity } = {}) {
    const nodes = graph?.nodes ?? [];
    const out = [];
    const into = new Map(nodes.map(n => [n.id, []]));
    for (const e of graph?.edges ?? []) if (e.kind === "input" && into.has(e.to)) into.get(e.to).push(e.from);
    const schema = nodes.filter(n => !n.evidence);
    for (const n of schema) if (n.kind !== "counter" && !n.inputs.length) out.push({ code: "noInputs", node: n.id });
    for (const id of cycle ?? []) out.push({ code: "cycle", node: id });
    for (const m of graph?.missing ?? []) out.push({ code: "missing", node: m.node, ref: m.ref });
    for (const n of schema) if (n.kind === "counter" && !n.refutes.length) out.push({ code: "noTarget", node: n.id });
    const solutions = schema.filter(n => n.kind === "solution");
    if (!solutions.length && schema.some(n => n.kind === "deduction")) out.push({ code: "noSolution", node: null });
    for (const n of solutions.slice(1)) out.push({ code: "twoSolutions", node: n.id });
    for (const n of solutions) if (n.inputs.length && !(into.get(n.id) ?? []).length) out.push({ code: "solutionUnreached", node: n.id });
    for (const n of schema) if (n.mode && !modes.includes(n.mode)) out.push({ code: "badMode", node: n.id, ref: n.mode });
    for (const n of schema) {
        if (n.kind !== "deduction") continue;
        const only = (into.get(n.id) ?? []).filter(id => reach?.[id]?.culpritOnly);
        for (const ref of only) out.push({ code: "culpritOnly", node: n.id, ref });
    }
    const keys = nodes.filter(n => n.evidence && n.kind === "key").length;
    if (keys > keyMax) out.push({ code: "tooManyKeys", node: null, ref: String(keys) });
    for (const n of nodes) for (const field of n.needs ?? []) out.push({ code: "incomplete", node: n.id, ref: field });
    return out;
}

/*
 * THE TICKS ARE A TRIAL'S (E99 next, 12.11.2026; the plan's Q-E99-9 and C3: "a second trial in the chapter starts with
 * none"). Each row carries the trial it was ticked in - the trial record's `trialStartedAt`, which every trial's entry
 * writes afresh (trial-progress.mjs `TRIAL_RECORD`) - and only the rows of the chapter's current trial are read, so a
 * second Class Trial in the chapter starts with no ticks and the first trial's stay where they were, unread, until the
 * season's reset cuts the store. Read off the record's world setting here, not through trial-progress.mjs, which this
 * leaf does not import. A row ticked before this stamp existed carries none and reads under a record with none.
 *
 * AND A ROW WITH NO STAMP, WRITTEN IN THE RUNNING TRIAL (the planner's review for 1.2.111, minor 1; 13.11.2026; R4455).
 * 1.2.108 and 1.2.109 wrote `{ ticked, by, at }` while their record already stamped every trial's entry, so a trial
 * entered before the update and continued after it read every tick unticked. A row with no `trial` is read as the
 * running trial's where its `at` is at or after `trialStartedAt`, an earlier trial's before it; so a second trial still
 * starts with none. `at` is the ticking GM's clock and the stamp the server's (`serverNow`): a tick in the first moments
 * of a trial can read either way by their difference.
 */
function tickTrialOf(row, trial) {
    if (row?.trial !== undefined && row?.trial !== null) return row.trial;
    return trial !== null && Number(row?.at) >= Number(trial) ? trial : null;
}
function trialStamp(chapter) {
    try {
        const stored = game.settings.get(MODULE_ID, SETTINGS.trialProgress) ?? {};
        return stored.chapter === chapter ? (stored.trialStartedAt ?? null) : null;
    } catch {
        return null;
    }
}

/** The chapter's ticks at its current trial (E99 C3; a trial's since E99 next): node id -> true, on a GM; empty on any other browser. */
export function caseTicks(chapter) {
    if (!game.user?.isGM) return {};
    const prefix = `${chapter}:`;
    const trial = trialStamp(chapter);
    const out = {};
    for (const [key, row] of Object.entries(caseTickStore.entries() ?? {})) {
        if (key.startsWith(prefix) && row?.ticked === true && tickTrialOf(row, trial) === trial) out[key.slice(prefix.length)] = true;
    }
    return out;
}

/** Tick or untick one node at the trial, on a GM (E99 C3): `{ ticked, by, at, trial }`. Answers the row, or null. */
export async function setCaseTick(chapter, nodeId, ticked) {
    if (!game.user?.isGM || !Number.isInteger(chapter) || !validNodeId(nodeId)) return null;
    const key = caseKeyOf(chapter, nodeId);
    await caseTickStore.patch(key, { ticked: Boolean(ticked), by: game.user.id, at: Date.now(), trial: trialStamp(chapter) });
    return caseTickStore.get(key) ?? null;
}
