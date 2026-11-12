/**
 * THE CASE MAP'S LAYOUT (E97 C4, 11.11.2026; STAGE E97+E98 C4, the owner's 09.11 Q5: "auto layout: yes, with
 * sortable/adjustable column order"). Pure, and importing nothing: a graph of case-schema.mjs `graphOf` in, columns
 * and rows out. C5 places each node's button where this puts it and draws the edges between; E99 draws the same
 * layout in the middle of the GM's trial screen, so nothing here knows a pixel.
 *
 * COLUMNS BY DEPTH. Evidence (traces, Key slots, the Final Truth) is column 0; a deduction or a counter stands one
 * column past its deepest input, a counter with no input beside what it refutes; the solution stands last, past
 * everything else. A cycle of inputs has no depth, and the layout refuses it (`cycle`, the nodes on it) rather than
 * drawing one: C8's consistency check says so to the GM.
 *
 * THE UNRELATED BELOW A GAP (the owner, 09.11: "remnants not tied to the murder at the bottom of the evidence column
 * after a gap"): evidence that is not tied to the murder and that no edge names stands below the rest of column 0,
 * one empty row between (`gapAt`). Ticking "tied to the murder" moves a trace up at the next redraw.
 *
 * THE ORDERS (`LAYOUT_SORTS`): "manual", the GM's arrows (the chapter's meta row's `manual`, node id to place); "kind",
 * Key Remnants, the Final Truth, then other traces, and deductions, counters, the solution - each by its `order`, then
 * its name; "room", by room, a node in none last; "state", found first and earliest, then on the map, then planned;
 * "uncrossed", the fewest crossings found by sweeping each column to the mean row of its neighbours and then swapping
 * neighbours while that removes a crossing - a heuristic, not a proof of the fewest (R3375 measures the proposal's
 * case at 0). Rows are a column's indices from the top; `crossings` counts the pairs of edges whose straight lines
 * between those points cross, an edge within one column not counted.
 */

export const LAYOUT_SORTS = Object.freeze(["manual", "kind", "room", "state", "uncrossed"]);

const KIND_RANK = { key: 0, final: 1, trace: 2, deduction: 0, counter: 1, solution: 2 };
const byText = (a, b) => String(a ?? "").localeCompare(String(b ?? ""));
const rankOf = n => KIND_RANK[n.kind] ?? 3;
const orderOf = n => (Number.isFinite(n.order) ? n.order : Infinity);

function kindCompare(a, b) {
    return rankOf(a) - rankOf(b) || (orderOf(a) === orderOf(b) ? 0 : orderOf(a) < orderOf(b) ? -1 : 1)
        || byText(a.label, b.label) || byText(a.id, b.id);
}

function stateRank(n) {
    if (!n.evidence) return [0, 0];
    if (n.planned) return [2, 0];
    return Number.isFinite(n.foundAt) ? [0, n.foundAt] : [1, 0];
}

/** The comparator of one of the orders (uncrossed starts from kind's). */
function comparatorOf(sort, manual = {}) {
    if (sort === "room") {
        return (a, b) => (a.room == null) - (b.room == null) || byText(a.room, b.room) || kindCompare(a, b);
    }
    if (sort === "state") {
        return (a, b) => {
            const [ra, ta] = stateRank(a), [rb, tb] = stateRank(b);
            return ra - rb || ta - tb || kindCompare(a, b);
        };
    }
    if (sort === "manual") {
        const at = n => (Number.isFinite(manual?.[n.id]) ? manual[n.id] : Infinity);
        return (a, b) => (at(a) === at(b) ? kindCompare(a, b) : at(a) < at(b) ? -1 : 1);
    }
    return kindCompare;
}

/** The nodes on a cycle of `inputs` edges, sorted; empty for none. */
function cycleOf(nodes, inputEdges) {
    const into = new Map(nodes.map(n => [n.id, []]));
    for (const e of inputEdges) into.get(e.to)?.push(e.from);
    const on = [];
    for (const n of nodes) {
        const seen = new Set();
        const stack = [...(into.get(n.id) ?? [])];
        while (stack.length) {
            const id = stack.pop();
            if (id === n.id) { on.push(n.id); break; }
            if (seen.has(id)) continue;
            seen.add(id);
            stack.push(...(into.get(id) ?? []));
        }
    }
    return on.sort();
}

/**
 * The layout of `graph` under `sort` (`manual` the GM's places for "manual"). Answers `{ sort, columns: [[id]],
 * unrelated: [id], gapAt, positions: { id: { col, row } }, cycle }` - `cycle` null, or the nodes on one with no
 * columns at all.
 */
export function layoutCase(graph, { sort = "kind", manual = {} } = {}) {
    const order = LAYOUT_SORTS.includes(sort) ? sort : "kind";
    const nodes = [...(graph?.nodes ?? [])];
    const edges = [...(graph?.edges ?? [])];
    const byId = new Map(nodes.map(n => [n.id, n]));
    const inputs = edges.filter(e => e.kind === "input" && byId.has(e.from) && byId.has(e.to));
    const cycle = cycleOf(nodes, inputs);
    if (cycle.length) return { sort: order, columns: [], unrelated: [], gapAt: null, positions: {}, cycle };

    const depth = new Map();
    const into = new Map(nodes.map(n => [n.id, inputs.filter(e => e.to === n.id).map(e => e.from)]));
    const depthOf = id => {
        if (depth.has(id)) return depth.get(id);
        const n = byId.get(id);
        let d = 0;
        if (!n.evidence) {
            const from = into.get(id) ?? [];
            if (from.length) d = 1 + Math.max(...from.map(depthOf));
            else if (n.kind === "counter") {
                const targets = edges.filter(e => e.kind === "refutes" && e.from === id && byId.has(e.to) && !byId.get(e.to).evidence);
                d = Math.max(1, ...targets.map(e => depthOf(e.to)));
            } else d = 1;
        }
        depth.set(id, d);
        return d;
    };
    for (const n of nodes) if (n.kind !== "solution") depthOf(n.id);
    const last = Math.max(0, ...[...depth.values()]) + 1;
    for (const n of nodes) if (n.kind === "solution") depth.set(n.id, Math.max(last, 1 + Math.max(0, ...(into.get(n.id) ?? []).map(id => depth.get(id) ?? 0))));

    const named = new Set(edges.flatMap(e => [e.from, e.to]));
    const loose = n => n.evidence && n.tied !== true && !named.has(n.id);
    const cmp = comparatorOf(order === "uncrossed" ? "kind" : order, manual);
    const width = nodes.length ? Math.max(...nodes.map(n => depth.get(n.id))) + 1 : 0;
    const columns = Array.from({ length: width }, (_, i) => nodes.filter(n => depth.get(n.id) === i && !loose(n)).sort(cmp).map(n => n.id));
    const unrelated = nodes.filter(loose).sort(cmp).map(n => n.id);
    if (order === "uncrossed") untangle(columns, edges);
    if (!columns.length && unrelated.length) columns.push([]);
    const gapAt = unrelated.length ? columns[0].length : null;
    if (unrelated.length) columns[0] = [...columns[0], ...unrelated];
    return { sort: order, columns, unrelated, gapAt, positions: positionsOf(columns, gapAt), cycle: null };
}

function positionsOf(columns, gapAt = null) {
    const out = {};
    columns.forEach((ids, col) => ids.forEach((id, row) => {
        out[id] = { col, row: col === 0 && gapAt !== null && row >= gapAt ? row + 1 : row };
    }));
    return out;
}

const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/** How many pairs of `edges` cross as straight lines between `layout`'s positions (an edge within one column left out). */
export function crossings(layout, edges = []) {
    const at = layout?.positions ?? {};
    const segs = edges.map(e => [at[e.from], at[e.to]])
        .filter(([p, q]) => p && q && p.col !== q.col)
        .map(([p, q]) => [{ x: p.col, y: p.row }, { x: q.col, y: q.row }]);
    let n = 0;
    for (let i = 0; i < segs.length; i++) {
        for (let j = i + 1; j < segs.length; j++) {
            const [a, b] = segs[i], [c, d] = segs[j];
            const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
            if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) n++;
        }
    }
    return n;
}

/** Reorder `columns` in place toward fewer crossings: barycentre sweeps, then neighbour swaps; the best order kept. */
function untangle(columns, edges) {
    const count = () => crossings({ positions: positionsOf(columns) }, edges);
    let best = columns.map(c => [...c]);
    let bestCount = count();
    const keep = () => {
        const now = count();
        if (now < bestCount) { bestCount = now; best = columns.map(c => [...c]); }
    };
    const rows = () => positionsOf(columns);
    const sweep = (i, side) => {
        const at = rows();
        const mean = id => {
            const near = edges.map(e => (e.from === id ? e.to : e.to === id ? e.from : null))
                .filter(other => other && at[other] && (side < 0 ? at[other].col < i : at[other].col > i))
                .map(other => at[other].row);
            return near.length ? near.reduce((s, r) => s + r, 0) / near.length : at[id].row;
        };
        const keyed = columns[i].map((id, k) => [id, mean(id), k]);
        keyed.sort((a, b) => a[1] - b[1] || a[2] - b[2]);
        columns[i] = keyed.map(([id]) => id);
    };
    for (let pass = 0; pass < 6 && bestCount > 0; pass++) {
        for (let i = 1; i < columns.length; i++) { sweep(i, -1); keep(); }
        for (let i = columns.length - 2; i >= 0; i--) { sweep(i, 1); keep(); }
    }
    columns.splice(0, columns.length, ...best.map(c => [...c]));
    for (let pass = 0; pass < 20 && bestCount > 0; pass++) {
        let moved = false;
        for (const col of columns) {
            for (let k = 0; k + 1 < col.length; k++) {
                [col[k], col[k + 1]] = [col[k + 1], col[k]];
                const now = count();
                if (now < bestCount) { bestCount = now; moved = true; } else [col[k], col[k + 1]] = [col[k + 1], col[k]];
            }
        }
        if (!moved) break;
    }
}
