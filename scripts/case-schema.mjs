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
import { caseSchemaStore, keyPlanStore } from "./gm-stores.mjs";
import { remnantsOn, remnantData, keyOf } from "./remnants.mjs";
import { getClock } from "./clock.mjs";
import { sameSeason } from "./settings.mjs";

/** The three kinds of a schema row; evidence nodes are "trace", "key" and "final". */
export const CASE_KINDS = Object.freeze(["deduction", "counter", "solution"]);
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

/** The trial's modes a node may name (E99 draws one minigame per node): floor-machine.mjs `MODES`, as it lists them. */
export function caseModes() {
    return Object.values(MODES);
}

const ids = list => [...new Set((Array.isArray(list) ? list : []).filter(v => typeof v === "string" && v))];
const isPlain = o => o !== null && typeof o === "object" && !Array.isArray(o);

/**
 * A schema row as the map reads it, or null for a row of no kind of `CASE_KINDS`. Every field has its empty value; a
 * `mode` is kept as written, known or not (C8's consistency check names one `caseModes` lacks). Pure.
 */
export function caseNodeOf(raw) {
    if (!isPlain(raw) || !CASE_KINDS.includes(raw.kind)) return null;
    return {
        kind: raw.kind,
        label: typeof raw.label === "string" ? raw.label : "",
        text: typeof raw.text === "string" ? raw.text : "",
        inputs: ids(raw.inputs),
        refutes: ids(raw.refutes),
        mode: typeof raw.mode === "string" && raw.mode ? raw.mode : null,
        order: Number.isFinite(raw.order) ? raw.order : null,
        made: typeof raw.made === "string" && raw.made ? raw.made : null
    };
}

/** A chapter's meta row as the map reads it: a sort it does not know is "kind"; `manual` keeps numbers only. Pure. */
export function caseMetaOf(raw) {
    const row = isPlain(raw) ? raw : {};
    return {
        sort: CASE_SORTS.includes(row.sort) ? row.sort : "kind",
        manual: Object.fromEntries(Object.entries(isPlain(row.manual) ? row.manual : {}).filter(([, v]) => Number.isFinite(v))),
        run: typeof row.run === "string" && row.run ? row.run : null,
        askedAt: Number.isFinite(row.askedAt) ? row.askedAt : null
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
export function graphOf({ chapter = null, rows = {}, meta = null, traces = [], slots = [] } = {}) {
    const nodes = [];
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
            faint: Boolean(t.faint), room: t.room ?? null, chapter: t.chapter ?? null, foundAt: t.foundAt ?? null
        });
    }
    for (const s of slots ?? []) {
        if (!Number.isInteger(s?.slot) || placed.has(s.slot)) continue;
        nodes.push({ id: `${SLOT}${s.slot}`, kind: "key", evidence: true, planned: true, slot: s.slot, trace: null, type: "key",
            label: s.name || s.text || "", tied: true, faint: false, room: s.createIn ?? null, chapter, foundAt: null, scale: s.scale ?? null });
    }
    for (const [id, raw] of Object.entries(rows ?? {})) {
        const node = validNodeId(id) ? caseNodeOf(raw) : null;
        if (node) nodes.push({ id, evidence: false, planned: false, ...node });
    }
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
 * with `chapters: "all"`), the Key plan's slots of the chapter that a GM wrote, the schema's rows. `{}`-shaped and
 * empty on any other browser, which holds none of the three.
 */
export function caseGraph(chapter = getClock().chapter, { chapters = "this" } = {}) {
    if (!game.user?.isGM) return graphOf({ chapter });
    const traces = [];
    for (const scene of game.scenes ?? []) {
        for (const token of remnantsOn(scene)) {
            const data = remnantData(token);
            if (!data || (chapters !== "all" && (data.chapter !== chapter || !sameSeason(data)))) continue;
            traces.push({ ...data, key: keyOf(token), name: data.public?.name ?? "" });
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
    return graphOf({ chapter, rows, meta, traces, slots });
}

const NODE_FIELDS = Object.freeze(["kind", "label", "text", "inputs", "refutes", "mode", "order", "made"]);
const META_FIELDS = Object.freeze(["sort", "manual", "run", "askedAt"]);
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
    const patch = patchOf(fields, NODE_FIELDS, raw => caseNodeOf(raw) ?? {}, base);
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
