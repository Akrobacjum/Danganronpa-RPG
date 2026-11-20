/**
 * THE CASE MAP'S GEOMETRY AND CAMERA (E97 fix, 12.11.2026; the owner's review of the case map: "Rozmiar pol wnioskow,
 * truth bullets i generalnie kazdego modulu jest za maly, przez co opisy sa poucinane. Powiekszmy je by zawsze
 * wyswietlaly cala swoja zawartosc, a edycja niech nie odbywa sie po prawej stronie ekranu (usuwamy panel), tylko na
 * samych modulach. Dodajmy ruch i oddalanie i przyblizanie 'kamery' na schemacie jesli jeszcze go nie ma.").
 *
 * A LEAF, WITH NO IMPORT. case-map.mjs draws the map and re-exports `MAP_GEOMETRY`, `mapPlace` and `edgePath` from here
 * (E99 reads them there); this file holds the numbers and what a real browser does with the drawn markup: each node
 * measured at its whole content and placed so none overlaps another (`relayoutCaseMap`), and the camera on the schema
 * (`wireCaseCamera`). It imports nothing so that a page outside Foundry can run it on a captured window
 * (audit/case-map-sweep.mjs), which is how the look is measured: the same code, not a copy of it.
 *
 * WHY MEASURED, AND WHY STILL PURE WHERE IT CAN BE. Until this fix a node was 196 x 54 px whatever it held, and its name
 * was cut at two lines and its kind at one (C5's `line-clamp` and ellipsis): the owner's "descriptions are cut". A
 * node's height now follows its text, which only a browser knows (jsdom lays nothing out, and the fonts differ by theme
 * and language). So the drawing places every node at MAP_GEOMETRY's numbers as before - what jsdom reads, and what a
 * browser shows for the moment before it measures - and `relayoutCaseMap` reads each node's box and places them again
 * through the same pure `mapPlace`, given the sizes it read. A column is a stack: a node stands `rowGap` below the one
 * above it, so a taller node pushes the rest of its column down and nothing overlaps by construction; a column is as
 * wide as its widest node, so a wider node widens its column and pushes the next ones right (an open node's fields take
 * its face's width since 13.11.2026, so opening one no longer does). With no size given, a node is `nodeW` x `nodeH` and stands where C5's arithmetic puts it (R3651 holds those).
 * `nodeW` is 240 since the fix (196 at C5; the owner's "Powiekszmy je"): at 196 a Remnant's description under the glass
 * made a node 449 px tall at 1366x768, taller than the 289 px the graph had to show it in (audit/case-map-sweep.mjs).
 */

/**
 * The map's geometry in CSS pixels at the root's 16 px: a node's least box (`nodeW` x `nodeH`; a node grows from it), an
 * open node's face's width where it is drawn (`openW`: a map with no fields; on the Map its fields take the face's width
 * as clicked, `relayoutCaseMap`), the gap between columns, the pitch between rows when every node
 * is its least height (so the gap between two nodes of a column is `pitch - nodeH`), the margin around the graph and the
 * room the column heads take above it. Read by `mapPlace` and by the stylesheet's node rule (components.css "THE CASE
 * MAP", whose least width and height and open width are these three numbers).
 *
 * THE COLUMNS 80 PX APART (the owner, 13.11.2026: "Wnioski w planerze/schemacie sprawy sa za blisko bulletow i za blisko
 * siebie. Chodzi o odstep miedzy kolumnami"): 48 px until then. Measured in Chromium at 1366x768 (STATUS): the Map's
 * three columns 840 -> 904 px in its 972 px viewport, with a node open 952 -> 1016 px (dragged to, as a tall node is).
 *
 * 200 PX SINCE THE OWNER'S SECOND LOOK (13.11.2026, a 1.2.112 table: "The columns are still too close to each other"; five
 * columns, the lines crossing densely in a gap a third of a node wide). Measured in Chromium on a built case of five
 * columns and 42 lines (12 Remnants, deductions of 5, 4, 3 and 2, two counters): widening a gap does not change how many
 * lines cross in it - 64 and 63 in the first two at 80 px, 64 and 70 at 200, the same order of rows - it gives them room:
 * the gap 0.33 -> 0.83 of a node, the smallest crossing angle in the first gap 6 -> 13 degrees. Its price is the fit:
 * at 1920x1080 under glass that case fits at 0.623 -> 0.480 (the node text 13.1 -> 10.1 px); at 1366x768 its fit is
 * bound by the height and stays 0.308. 160 px gave 0.67 of a node and 11 degrees; 240 px one node and 15 degrees, at a
 * fit of 0.445. The curves keep their shape (a spread bend moved the crossings out of the gap's middle fifth, 48% ->
 * 12%, but added crossings and left a crossing at 3 degrees).
 */
/* A NODE 300 PX WIDE (owner-116, 15.11.2026; the owner: "Poszerzmy je też trochę", option A: every node open). 240 until
 * then. Measured in Chromium (STATUS, item 1c), every node open: each 20 px of width took 3-8% off a tall node's height,
 * and 300 is the coordinator's number; 280 and 320 read alike within that. The node rule's width in components.css is the
 * same number, and the fields take it (R5821, R7520). */
export const MAP_GEOMETRY = Object.freeze({ nodeW: 300, nodeH: 54, openW: 352, colGap: 200, pitch: 66, pad: 12, head: 28 });

/** A node's size from `sizes` (a Map or an object of id to `{ w, h }`); a size not read, or read as 0 (jsdom), is the least. */
function sizeOf(sizes, id, g) {
    const s = sizes ? (typeof sizes.get === "function" ? sizes.get(id) : sizes[id]) : null;
    const w = Number(s?.w), h = Number(s?.h);
    return { w: Number.isFinite(w) && w > 0 ? Math.max(w, g.nodeW) : g.nodeW, h: Number.isFinite(h) && h > 0 ? Math.max(h, g.nodeH) : g.nodeH };
}

/**
 * Where each node of `layout` stands, in pixels: `{ at: { id: { x, y, w, h } }, cols: [{ x, w }], width, height, gapY }` -
 * `gapY` the middle of the empty row before the unrelated evidence (null without any). Each column a stack of its nodes
 * in row order, `pitch - nodeH` apart; an empty row (the gap before the unrelated evidence) takes one `pitch`, or in
 * the first column, where the gap's line and fold stand from its middle down, as much as the gap's measured height
 * `gapH` needs (E99 round 5: under glass the fold took two lines, 60 px, of the 39 the row left under the line, and lay
 * over the first unrelated Remnant). `sizes` (optional) the measured `{ w, h }` of each node. Pure.
 *
 * A DEDUCTION CENTRES ON WHAT IT RESTS ON (the owner, 13.11.2026: "Deductions should also centre themselves in height
 * relative to the clues they require"). With `edges` given (`[{ from, to, kind }]`), each node past the first column
 * whose "input" edges come from earlier columns aims its middle at the mean of those inputs' middles, as already placed -
 * the columns left to right, so a deduction centres on earlier deductions where they finally stand. The mean (the
 * coordinator's default; the middle of the topmost and bottommost input was not measured). Chromium, a built case of five
 * columns and 42 lines at colGap 200, glass: a deduction's middle from its inputs' mean 176 px on average and 405 at most
 * before, 24 and 92 after (0 wherever no neighbour was in the way), the steepest line 72 -> 61 degrees, no overlap. Where
 * two aims collide, the column is packed in the order of its aims (ties by row)
 * with the column's row gap (`pitch - nodeH`, so least nodes stand `pitch` apart) between boxes, at the least total
 * squared shift from the aims (adjacent blocks pooled while they overlap: one sweep down, each block centred on its
 * members' aims), and never above the column's top. A node with no input from an earlier column (a counter beside
 * what it refutes, a deduction resting on nothing) keeps its row order under the placed ones. The first column, and a
 * layout given no edges, stand as before. Deterministic: the same layout, sizes and edges give the same places.
 */
export function mapPlace(layout, g = MAP_GEOMETRY, sizes = null, { gapH = 0, edges = null } = {}) {
    const at = {};
    const rowGap = g.pitch - g.nodeH;
    const byCol = [];
    for (const [id, p] of Object.entries(layout?.positions ?? {})) {
        if (!Number.isInteger(p?.col) || !Number.isInteger(p?.row)) continue;
        (byCol[p.col] ??= []).push({ id, row: p.row });
    }
    const colCount = Math.max(1, byCol.length);
    const cols = [];
    let x = g.pad;
    for (let c = 0; c < colCount; c++) {
        const w = Math.max(g.nodeW, ...(byCol[c] ?? []).map(n => sizeOf(sizes, n.id, g).w));
        cols.push({ x, w });
        x += w + g.colGap;
    }
    const top = g.head + g.pad;
    const colOf = new Map();
    byCol.forEach((list, c) => { for (const n of list ?? []) colOf.set(n.id, c); });
    /* Each node's aim in column `c`: the mean middle of its inputs from earlier columns, as placed. */
    const aimsOf = (list, c) => {
        const out = new Map();
        for (const n of list) {
            const mids = edges.filter(e => e?.to === n.id && (e.kind ?? "input") === "input" && colOf.get(e.from) < c && at[e.from])
                .map(e => at[e.from].y + at[e.from].h / 2);
            if (mids.length) out.set(n.id, mids.reduce((a, b) => a + b, 0) / mids.length);
        }
        return out;
    };
    /* The column packed (pooled adjacent violators): the aimed nodes by aim, then the rest by row under them. Answers the
       y under the last node, its row gap included. */
    const packColumn = (list, aims, top, c) => {
        const aimed = list.filter(n => aims.has(n.id)).sort((a, b) => aims.get(a.id) - aims.get(b.id) || a.row - b.row);
        const blocks = [];
        for (const n of aimed) {
            const h = sizeOf(sizes, n.id, g).h;
            // a block: its nodes, its height with the gaps between them, and the sum of each member's wanted top less
            // its offset in the block, whose mean is the block's best top
            let b = { ids: [n.id], hs: [h], height: h, sum: aims.get(n.id) - h / 2, count: 1 };
            b.y = b.sum / b.count;
            while (blocks.length) {
                const p = blocks[blocks.length - 1];
                if (p.y + p.height + rowGap <= b.y) break;
                blocks.pop();
                const shift = p.height + rowGap;
                b = { ids: [...p.ids, ...b.ids], hs: [...p.hs, ...b.hs], height: p.height + rowGap + b.height,
                    sum: p.sum + b.sum - shift * b.count, count: p.count + b.count };
                b.y = b.sum / b.count;
            }
            blocks.push(b);
        }
        let y = top;
        for (const b of blocks) {
            let by = Math.max(y, Math.round(b.y));
            b.ids.forEach((id, i) => {
                const s = sizeOf(sizes, id, g);
                at[id] = { x: cols[c].x, y: by, w: s.w, h: s.h };
                by += b.hs[i] + rowGap;
            });
            y = by;
        }
        for (const n of list.filter(m => !aims.has(m.id))) {
            const s = sizeOf(sizes, n.id, g);
            at[n.id] = { x: cols[c].x, y, w: s.w, h: s.h };
            y += s.h + rowGap;
        }
        return y;
    };
    const gapRow = Number.isInteger(layout?.gapAt) && (layout?.unrelated?.length ?? 0) > 0 ? layout.gapAt : null;
    let gapY = null, bottom = top + g.pitch;
    for (let c = 0; c < colCount; c++) {
        const list = (byCol[c] ?? []).sort((a, b) => a.row - b.row);
        let y = top, row = 0;
        const skipTo = target => {
            for (; row < target; row++) {
                if (c === 0 && row === gapRow) {
                    gapY = y + Math.round(g.nodeH / 2);
                    y += Math.max(g.pitch, Math.round(g.nodeH / 2) + (Number(gapH) > 0 ? Math.ceil(gapH) : 0) + rowGap);
                    continue;
                }
                y += g.pitch;
            }
        };
        const aims = c > 0 && Array.isArray(edges) ? aimsOf(list, c) : null;
        if (aims && aims.size) {
            y = packColumn(list, aims, top, c);
            bottom = Math.max(bottom, y);
            continue;
        }
        for (const n of list) {
            skipTo(n.row);
            const s = sizeOf(sizes, n.id, g);
            at[n.id] = { x: cols[c].x, y, w: s.w, h: s.h };
            y += s.h + rowGap;
            row = n.row + 1;
        }
        // The gap's row is still drawn when every node after it is folded away (`caseGraphHtml`'s fold).
        if (c === 0 && gapRow !== null && gapY === null) skipTo(gapRow + 1);
        bottom = Math.max(bottom, y);
    }
    return { at, cols, width: g.pad * 2 + cols.reduce((sum, col) => sum + col.w, 0) + (colCount - 1) * g.colGap,
        height: bottom + g.pad, gapY };
}

/**
 * One edge's path: from the right edge of `from` to the left edge of `to`, a curve of two halves; between two nodes of
 * one column (a counter beside what it refutes) a bracket on their left, as the proposal drew it, instead of a curve
 * through the nodes. Each end at its node's middle; a node's `w` and `h` where measured, MAP_GEOMETRY's least
 * otherwise. Pure.
 */
export function edgePath(from, to, g = MAP_GEOMETRY) {
    const fw = from.w ?? g.nodeW, fh = from.h ?? g.nodeH, th = to.h ?? g.nodeH;
    const y1 = from.y + fh / 2, y2 = to.y + th / 2;
    /* A BRACKET STANDS OUT AS FAR AS IT IS LONG (13.11.2026): 12 px from its column, and a share of the gap's half more
       the longer it is (a whole share from six rows), so a bracket inside a longer one stands inside it and two of
       different lengths never share one vertical line. At `colGap / 4` every bracket of a column stood on one line
       (Chromium, the built case: C2 -> D2a and C3 -> D2c read as one dashed bar). */
    if (to.x <= from.x) {
        const reach = Math.min(1, Math.abs(y2 - y1) / (6 * g.pitch));
        const x = Math.min(from.x, to.x) - Math.round(12 + reach * Math.max(0, g.colGap / 2 - 24));
        return `M${from.x} ${y1} H${x} V${y2} H${to.x}`;
    }
    const x1 = from.x + fw, x2 = to.x;
    const mid = Math.round((x1 + x2) / 2);
    return `M${x1} ${y1} C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`;
}

/**
 * WHERE AN ARROW ENDS (1.2.119, the owner: "Czytelność strzałek"): the last point of `edgePath`, the middle of the target's
 * left edge, across columns and within one. The arrowhead is drawn with its tip on this point (case-map.mjs `arrowDefs`:
 * the marker's reference point is its tip), so it stops at the node's border and is never drawn under the node, which
 * stands over the edge layer. Pure; R7822.
 */
export function edgeEnd(from, to, g = MAP_GEOMETRY) {
    return { x: to.x, y: to.y + (to.h ?? g.nodeH) / 2 };
}

/**
 * SQUARE, GROUPED ROUTES (1.2.119 round 2; the owner: "Same strzalki niech beda bardziej kwadratowe, pogrupowane - ... niech
 * polaczenia strzalkami beda czytelniejsze"). Every edge is drawn horizontal - vertical - horizontal, its two corners rounded
 * (`ROUTE.radius`): out of its source's right edge (a counter into its own column: out of its left edge), along its source's
 * middle to its target's lane, along the lane to the target's middle, and into the target's left edge, where its head ends
 * (`edgeEnd`). A LANE is one vertical line per target and meaning (an input and a counter's refutation into one node are
 * two lanes, the counter's dashed), in the gutter left of the target's column, between the widest node of the columns
 * before and the target, the head's room kept (`ROUTE.inset`, `ROUTE.stub`). So every line into one node runs down one
 * trunk and ends in one last stretch with one head - the lines grouped - and lines into two nodes never share a vertical.
 * A gutter's lanes are spread evenly in it, ordered by their targets' height, top to bottom from the left or from the
 * right, whichever crosses fewer lines (`routeCrossings`; ties from the left). Replaces `edgePath`'s curves on the Map and
 * the Class Trial console; `edgePath` stays exported, as E99 reads it. Answers a Map of `from>to` to the path. Pure; R7825.
 */
export const ROUTE = Object.freeze({ radius: 6, inset: 18, stub: 22 });

/** One route's three segments and its path, given its lane's x. */
function routeOf(e, at, x, g) {
    const from = at[e.from], to = at[e.to];
    const fw = from.w ?? g.nodeW, fh = from.h ?? g.nodeH;
    const back = to.x <= from.x;
    const ex = back ? from.x : from.x + fw;
    const ys = from.y + fh / 2;
    const end = edgeEnd(from, to, g);
    const segs = [{ h: true, y: ys, a: Math.min(ex, x), b: Math.max(ex, x) }, { h: false, x, a: Math.min(ys, end.y), b: Math.max(ys, end.y) },
        { h: true, y: end.y, a: x, b: end.x }];
    const r6 = n => Math.round(n * 10) / 10;
    if (Math.abs(end.y - ys) < 0.5) return { segs, d: `M${r6(ex)} ${r6(ys)} H${r6(end.x)}` };
    const dx = Math.sign(x - ex) || 1, dy = Math.sign(end.y - ys);
    const r = Math.max(0, Math.min(ROUTE.radius, Math.abs(end.y - ys) / 2, Math.abs(x - ex), Math.abs(end.x - x)));
    return { segs, d: `M${r6(ex)} ${r6(ys)} H${r6(x - dx * r)} Q${r6(x)} ${r6(ys)} ${r6(x)} ${r6(ys + dy * r)} V${r6(end.y - dy * r)}`
        + ` Q${r6(x)} ${r6(end.y)} ${r6(x + r)} ${r6(end.y)} H${r6(end.x)}` };
}

/** How many times the segments of routes into different lanes cross (a horizontal through a vertical, inside both). */
function crossingsOf(routes) {
    let n = 0;
    for (let i = 0; i < routes.length; i++) {
        for (let j = 0; j < routes.length; j++) {
            if (i === j || routes[i].lane === routes[j].lane) continue;
            for (const h of routes[i].segs) {
                if (!h.h) continue;
                for (const v of routes[j].segs) {
                    if (v.h) continue;
                    if (v.x > h.a + 0.5 && v.x < h.b - 0.5 && h.y > v.a + 0.5 && h.y < v.b - 0.5) n++;
                }
            }
        }
    }
    return n;
}

/** The lanes' x by group, each gutter's order `pick`: "best" (fewer crossings), "other" (the one "best" did not take). */
function laneXs(edges, at, g, pick = "best") {
    const shown = edges.filter(e => at[e.from] && at[e.to]);
    const groupOf = e => `${e.to}|${e.kind ?? "input"}`;
    const gutters = new Map();
    for (const e of shown) {
        const tx = at[e.to].x;
        if (!gutters.has(tx)) gutters.set(tx, new Map());
        gutters.get(tx).set(groupOf(e), at[e.to].y + (at[e.to].h ?? g.nodeH) / 2);
    }
    const xs = new Map();
    const routesWith = () => shown.map(e => ({ lane: groupOf(e), ...routeOf(e, at, xs.get(groupOf(e)), g) }));
    for (const tx of [...gutters.keys()].sort((a, b) => a - b)) {
        const groups = [...gutters.get(tx).entries()].sort((a, b) => a[1] - b[1] || String(a[0]).localeCompare(String(b[0])));
        const before = Object.values(at).filter(p => p.x < tx).map(p => p.x + (p.w ?? g.nodeW));
        const lo = (before.length ? Math.max(...before) : tx - g.colGap) + ROUTE.inset, hi = tx - ROUTE.stub;
        const place = order => order.forEach(([k], i) => xs.set(k, order.length === 1 ? Math.round((lo + hi) / 2) : Math.round(lo + (hi - lo) * i / (order.length - 1))));
        const scored = [groups, [...groups].reverse()].map(order => {
            place(order);
            return { order, n: crossingsOf(routesWith().filter(r => xs.has(r.lane))) };
        });
        const best = scored[1].n < scored[0].n ? 1 : 0;
        place(scored[pick === "other" ? 1 - best : best].order);
    }
    return { shown, xs, groupOf };
}

export function routeEdges(edges, at, g = MAP_GEOMETRY, { order = "best" } = {}) {
    const { shown, xs, groupOf } = laneXs(edges ?? [], at ?? {}, g, order);
    return new Map(shown.map(e => [`${e.from}>${e.to}`, routeOf(e, at, xs.get(groupOf(e)), g).d]));
}

/** How many crossings the routes of `edges` make, in the order drawn or ({ order: "other" }) the other. Pure; R7825. */
export function routeCrossings(edges, at, g = MAP_GEOMETRY, { order = "best" } = {}) {
    const { shown, xs, groupOf } = laneXs(edges ?? [], at ?? {}, g, order);
    return crossingsOf(shown.map(e => ({ lane: groupOf(e), ...routeOf(e, at, xs.get(groupOf(e)), g) })));
}

/**
 * THE ARROWS OF ONE NODE LIT (1.2.119; the owner's "Czytelność strzałek"): every edge with `id` at an end gets `is-lit`,
 * its halo too, its lit arrowhead (`data-drpg-arrow-lit`), and is moved to the top of the lines' layer, so it is drawn over
 * the lines it crosses; a target lights its whole trunk, every line into it (round 2); the canvas gets `has-lit`, under which the stylesheet dims every edge not lit (components.css). `id`
 * null puts every edge back. What it means is unchanged: only the drawing. Answers how many edges are lit. R7823.
 */
export function lightEdges(canvas, id = null) {
    const svg = canvas?.querySelector?.(":scope > svg.drpg-case-edges");
    if (!svg) return 0;
    let lit = 0;
    const halos = new Map([...svg.querySelectorAll("path[data-drpg-halo]")].map(h => [h.dataset.drpgHalo, h]));
    for (const path of [...svg.querySelectorAll("path[data-drpg-edge]")]) {
        let ends = [];
        try { ends = JSON.parse(path.dataset.drpgEnds || "[]"); } catch { ends = []; }
        const on = id !== null && ends.includes(id);
        // its halo by its key, in the halo layer under every line (round 2)
        const halo = halos.get(path.dataset.drpgEdge) ?? null;
        path.classList.toggle("is-lit", on);
        halo?.classList.toggle("is-lit", on);
        const head = on ? path.dataset.drpgArrowLit : path.dataset.drpgArrow;
        if (head) path.setAttribute("marker-end", `url(#${head})`);
        if (on) {
            lit++;
            path.parentNode?.appendChild(path);
        }
    }
    canvas.classList.toggle("has-lit", lit > 0);
    return lit;
}

/* ---- THE CAMERA (the owner's "ruch i oddalanie i przyblizanie 'kamery' na schemacie"). The graph's box is a viewport
   that never scrolls (`overflow: clip`, so focusing a node off screen cannot scroll it under the camera); the canvas
   inside it is moved and scaled by one transform, `translate(x, y) scale(z)` about its top left corner. A drag on empty
   space pans, the wheel zooms about the pointer, the toolbar's buttons and the keys + - 0 zoom about the viewport's
   middle and fit. The zoom is clamped to CAMERA_LIMITS and the pan keeps a margin of the graph in view. ---- */

/** The zoom's bounds and one step of the buttons and keys: a quarter of the size at the least (the whole of a
 *  sixty-Remnant chapter in the view's box at 1366x768), twice at the most. */
export const CAMERA_LIMITS = Object.freeze({ min: 0.25, max: 2, step: 1.25, margin: 48 });

/** `z` held to the limits (a value that is no number reads 1). Pure. */
export function clampZoom(z, limits = CAMERA_LIMITS) {
    const n = Number(z);
    return Number.isFinite(n) && n > 0 ? Math.min(limits.max, Math.max(limits.min, n)) : 1;
}

/** The camera held so at least `margin` px of the content (`{ w, h }`, unscaled) stays inside the box (`{ w, h }`),
 *  its zoom clamped. Pure. */
export function clampCamera(cam, content, box, limits = CAMERA_LIMITS) {
    const z = clampZoom(cam?.z, limits);
    const m = limits.margin;
    const hold = (v, size, room) => {
        const n = Number.isFinite(Number(v)) ? Number(v) : 0;
        if (!(room > 0) || !(size > 0)) return n;
        return Math.min(room - m, Math.max(m - size * z, n));
    };
    return { x: Math.round(hold(cam?.x, content?.w, box?.w)), y: Math.round(hold(cam?.y, content?.h, box?.h)), z };
}

/** The camera zoomed by `factor` about the point (`px`, `py`) of the box, so that point of the graph stays under it;
 *  the zoom clamped first, so a zoom at a limit moves nothing. Pure. */
export function zoomAt(cam, factor, px, py, limits = CAMERA_LIMITS) {
    const z0 = clampZoom(cam?.z, limits);
    const z = clampZoom(z0 * Number(factor), limits);
    const x0 = Number(cam?.x) || 0, y0 = Number(cam?.y) || 0;
    return { x: px - (px - x0) * (z / z0), y: py - (py - y0) * (z / z0), z };
}

/** The camera that shows the whole content (`{ w, h }`) in the box (`{ w, h }`), centred, at most at 1 (fit never
 *  enlarges a small case) and never under the limit. Pure. */
export function fitCamera(content, box, limits = CAMERA_LIMITS) {
    if (!(content?.w > 0) || !(content?.h > 0) || !(box?.w > 0) || !(box?.h > 0)) return { x: 0, y: 0, z: 1 };
    const z = clampZoom(Math.min(1, box.w / content.w, box.h / content.h), limits);
    return { x: Math.round((box.w - content.w * z) / 2), y: Math.round(Math.max(0, (box.h - content.h * z) / 2)), z };
}

/** The camera moved the least so `rect` (`{ x, y, w, h }`, in the graph's unscaled pixels) is in the box, its top left
 *  corner first when it is larger than the box. Pure. */
export function revealCamera(cam, rect, box, edge = 8) {
    const z = clampZoom(cam?.z);
    let { x, y } = { x: Number(cam?.x) || 0, y: Number(cam?.y) || 0 };
    const left = rect.x * z + x, top = rect.y * z + y, right = left + rect.w * z, bottom = top + rect.h * z;
    if (right > box.w - edge) x -= right - (box.w - edge);
    if (bottom > box.h - edge) y -= bottom - (box.h - edge);
    const left2 = rect.x * z + x, top2 = rect.y * z + y;
    if (left2 < edge) x += edge - left2;
    if (top2 < edge) y += edge - top2;
    return { x: Math.round(x), y: Math.round(y), z };
}

/** The canvas's transform for a camera. Pure. */
export const cameraTransform = cam => `translate(${Math.round(Number(cam?.x) || 0)}px, ${Math.round(Number(cam?.y) || 0)}px) scale(${clampZoom(cam?.z)})`;

/* ---- WHAT A BROWSER DOES WITH THE DRAWN MAP ---- */

/** The place data `caseGraphHtml` writes on the canvas (`data-drpg-place`): the shown layout's positions, the gap, the
 *  fold and the edges. Null where there is none or it does not read. */
function placeData(canvas) {
    try {
        const d = JSON.parse(canvas?.dataset?.drpgPlace ?? "null");
        return d && typeof d === "object" ? d : null;
    } catch {
        return null;
    }
}

/**
 * Every node of the drawn canvas measured at its whole content and placed again (a real browser; in jsdom every box
 * reads 0 and the drawn numbers stand): each node button's box, with its open fields (`.drpg-case-edit[data-drpg-edit]`
 * not hidden) under it, through `mapPlace`; the fields placed under their node at its width, the column heads over
 * their columns, the gap and the canvas resized, and every edge drawn again from the new places. Answers the place, or
 * null when the canvas carries no place data.
 */
export function relayoutCaseMap(canvas, g = MAP_GEOMETRY) {
    const data = placeData(canvas);
    if (!data) return null;
    const buttons = new Map();
    for (const b of canvas.querySelectorAll(":scope > button[data-drpg-node]")) buttons.set(b.dataset.drpgNode, b);
    const edits = new Map();
    for (const f of canvas.querySelectorAll(":scope > .drpg-case-edit[data-drpg-edit]")) if (!f.hidden && f.dataset.drpgEdit) edits.set(f.dataset.drpgEdit, f);
    /* THE OPEN FIELDS AT THE CLICKED NODE'S WIDTH (the owner, 13.11.2026: "the pop-up windows for typed text should have
       the same width as the field we click to edit the text"): the face measured as it stood when clicked - neither open
       (`is-selected` draws it at `openW`) nor hidden (`is-editing`) - and its fields given that width, their text boxes
       filling it (components.css). Its layout width, so the same at every zoom: the fields stand in the same scaled
       canvas. Measured in Chromium at 1366x768 and 1920x1080, both themes: the node 240 px, its fields 352 until then.
       In jsdom a face reads 0 and the stylesheet's width (the node's) stands. */
    // every node open (owner-116): every face hidden and every field at the node rule's width, so no face is measured -
    // toggling each face's classes forced a layout a node (Chromium, item 1c: 45-53 ms a relayout for 39 open nodes)
    const allOpen = canvas.dataset?.drpgAllOpen === "1";
    for (const [id, f] of allOpen ? [] : edits) {
        const b = buttons.get(id);
        if (!b) continue;
        const had = ["is-selected", "is-editing"].filter(c => b.classList.contains(c));
        b.classList.remove(...had);
        const w = b.offsetWidth || 0;
        b.classList.add(...had);
        if (w > 0) f.style.width = `${w}px`;
    }
    const sizes = new Map();
    for (const [id, b] of buttons) {
        const f = edits.get(id);
        sizes.set(id, { w: Math.max(b.offsetWidth || 0, f?.offsetWidth || 0), h: (b.offsetHeight || 0) + (f ? f.offsetHeight || 0 : 0) });
    }
    const gap = canvas.querySelector(":scope > .drpg-case-gap");
    // the edges as drawn (each path names its ends and its kind), so a deduction centres on its inputs at their measured places
    const drawn = [...canvas.querySelectorAll(":scope > svg.drpg-case-edges path[data-drpg-ends]")].map(p => {
        const [from, to] = JSON.parse(p.dataset.drpgEnds || "[]");
        return { from, to, kind: p.classList.contains("drpg-case-edge--input") ? "input" : p.classList.contains("drpg-case-edge--refutes") ? "refutes" : "other" };
    });
    const place = mapPlace({ positions: data.positions ?? {}, gapAt: data.gapAt ?? null, unrelated: data.unrelated ?? [] }, g, sizes,
        { gapH: gap?.offsetHeight || 0, edges: drawn });
    if (data.fold && place.gapY !== null) place.height = Math.max(place.height, place.gapY + Math.max(g.pitch, (gap?.offsetHeight || 0) + g.pad));
    for (const [id, b] of buttons) {
        const p = place.at[id];
        if (!p) continue;
        b.style.left = `${p.x}px`;
        b.style.top = `${p.y}px`;
        const f = edits.get(id);
        if (f) {
            f.style.left = `${p.x}px`;
            // the open node's fields stand in its place, its face hidden (`is-editing`, the owner, 12.11.2026)
            f.style.top = `${p.y + (b.classList.contains("is-editing") ? 0 : (b.offsetHeight || g.nodeH))}px`;
        }
    }
    for (const head of canvas.querySelectorAll(":scope > [data-drpg-col-head]")) {
        const col = place.cols[Number(head.dataset.drpgColHead)];
        if (col) head.style.left = `${col.x}px`;
    }
    if (gap && place.gapY !== null) { gap.style.top = `${place.gapY}px`; gap.style.width = `${place.cols[0]?.w ?? g.nodeW}px`; }
    canvas.style.width = `${place.width}px`;
    canvas.style.height = `${place.height}px`;
    const svg = canvas.querySelector(":scope > svg.drpg-case-edges");
    if (svg) { svg.setAttribute("width", String(place.width)); svg.setAttribute("height", String(place.height)); }
    /* An edge meets a node at its face's middle, not the middle of its face and open fields together: a line into an
       open node pointed into its fields (the sweep's screenshot). */
    const face = id => {
        const p = place.at[id], b = buttons.get(id);
        return p && b?.offsetHeight ? { ...p, h: b.offsetHeight } : p;
    };
    // the square routes again at the measured places (round 2, `routeEdges`), each halo on its line
    const faces = Object.fromEntries(Object.keys(place.at).map(id => [id, face(id)]));
    const routes = routeEdges(drawn, faces, g);
    const halos = new Map([...(svg?.querySelectorAll("path[data-drpg-halo]") ?? [])].map(h => [h.dataset.drpgHalo, h]));
    for (const path of svg?.querySelectorAll("path[data-drpg-edge]") ?? []) {
        const d = routes.get(path.dataset.drpgEdge);
        if (!d) continue;
        path.setAttribute("d", d);
        halos.get(path.dataset.drpgEdge)?.setAttribute("d", d);
    }
    canvas.dataset.drpgMeasured = sizes.size && [...sizes.values()].some(s => s.h > 0) ? "1" : "0";
    return place;
}

/** The size the canvas states (its inline width and height, which `relayoutCaseMap` and the drawing write). */
const canvasSize = canvas => ({ w: parseFloat(canvas?.style?.width) || 0, h: parseFloat(canvas?.style?.height) || 0 });

/** The viewport's size: its client box (0 in jsdom). */
const boxSize = el => ({ w: el?.clientWidth || 0, h: el?.clientHeight || 0 });

/**
 * THE CAMERA, WIRED on the graph's viewport (`.drpg-case-graph`) and its canvas. `get()` and `set(cam)` keep the camera
 * where the window keeps its state, so a redraw keeps the view; `still()` true while motion is to be reduced (the
 * buttons' and keys' zoom then jumps, as the wheel's and the drag's always do); `onZoom(cam)` after each change, for the
 * readout. Answers `{ apply, zoomBy, fit, reveal }`. Wired once per viewport element.
 */
export function wireCaseCamera(graph, { get = () => null, set = () => {}, still = () => false, onZoom = () => {} } = {}) {
    const canvas = () => graph?.querySelector?.(":scope > .drpg-case-canvas");
    const apply = (cam, { ease = false } = {}) => {
        const c = canvas();
        const held = clampCamera(cam, canvasSize(c), boxSize(graph));
        set(held);
        if (c) {
            c.classList.toggle("is-easing", Boolean(ease) && !still());
            c.style.transform = cameraTransform(held);
        }
        if (graph) { graph.scrollLeft = 0; graph.scrollTop = 0; }
        onZoom(held);
        return held;
    };
    const now = () => ({ x: 0, y: 0, z: 1, ...(get() ?? {}) });
    const middle = () => { const b = boxSize(graph); return [b.w / 2, b.h / 2]; };
    const zoomBy = (factor, px, py, opts) => {
        const [mx, my] = middle();
        return apply(zoomAt(now(), factor, px ?? mx, py ?? my), opts);
    };
    const fit = () => apply(fitCamera(canvasSize(canvas()), boxSize(graph)), { ease: true });
    /* `els` one element or several (an open node's face and its fields): their union brought into view. */
    const reveal = els => {
        const c = canvas();
        const list = (Array.isArray(els) ? els : [els]).filter(el => el && c?.contains?.(el));
        if (!c || !list.length) return;
        const cam = now();
        const z = clampZoom(cam.z);
        const cr = c.getBoundingClientRect?.();
        const rs = list.map(el => el.getBoundingClientRect?.()).filter(r => r && (r.width || r.height));
        if (!cr || !rs.length) return;
        const left = Math.min(...rs.map(r => r.left)), top = Math.min(...rs.map(r => r.top));
        const right = Math.max(...rs.map(r => r.right)), bottom = Math.max(...rs.map(r => r.bottom));
        const rect = { x: (left - cr.left) / z, y: (top - cr.top) / z, w: (right - left) / z, h: (bottom - top) / z };
        const next = revealCamera(cam, rect, boxSize(graph));
        if (next.x !== Math.round(cam.x) || next.y !== Math.round(cam.y)) apply(next);
    };
    if (!graph || graph.dataset.drpgCamera) return { apply, zoomBy, fit, reveal };
    graph.dataset.drpgCamera = "1";
    /* THE MIDDLE BUTTON PANS, ANYWHERE ON THE MAP (the owner, 13.11.2026: "moving the camera should be done with the
       middle mouse button"): over a node too, since a middle press opens nothing there, and at once, since it is never a
       click. Not over a text field, where a middle press may paste (Linux's selection). Its press is held from the
       browser, so no autoscroll starts (`mousedown`, and `auxclick` after it). A DRAG ON EMPTY SPACE WITH THE LEFT BUTTON
       PANS AS WELL (kept, so a touchpad with no middle button still moves the map): a press on the canvas or the
       viewport, not on a node, its fields, the fold or a control. Moved less than 4 px it is a click, which `wireCaseMap`
       reads as a click outside the open node; a middle drag is no click and leaves that reading alone. */
    const INTERACTIVE = "button, input, select, textarea, label, a, summary, .drpg-case-edit";
    const TYPED = "input, select, textarea";
    const midPress = event => event.button === 1 && !event.target?.closest?.(TYPED);
    let drag = null;
    graph.addEventListener("pointerdown", event => {
        const mid = midPress(event);
        if (!mid && (event.button !== 0 || event.target?.closest?.(INTERACTIVE))) return;
        if (mid) event.preventDefault();
        const cam = now();
        drag = { id: event.pointerId, sx: event.clientX, sy: event.clientY, x: cam.x, y: cam.y, z: cam.z, moved: false, mid };
        if (mid) graph.classList.add("is-panning");
        graph.setPointerCapture?.(event.pointerId);
    });
    for (const type of ["mousedown", "auxclick"]) graph.addEventListener(type, event => { if (midPress(event)) event.preventDefault(); });
    graph.addEventListener("pointermove", event => {
        if (!drag || event.pointerId !== drag.id) return;
        const dx = event.clientX - drag.sx, dy = event.clientY - drag.sy;
        if (!drag.mid && !drag.moved && Math.hypot(dx, dy) < 4) return;
        drag.moved = true;
        graph.classList.add("is-panning");
        apply({ x: drag.x + dx, y: drag.y + dy, z: drag.z });
    });
    const end = event => {
        if (!drag || event.pointerId !== drag.id) return;
        if (!drag.mid) graph.dataset.drpgDragged = drag.moved ? "1" : "";
        drag = null;
        graph.classList.remove("is-panning");
        graph.releasePointerCapture?.(event.pointerId);
    };
    graph.addEventListener("pointerup", end);
    graph.addEventListener("pointercancel", end);
    /* THE WHEEL ZOOMS ABOUT THE POINTER, except over a text box or a picker of an open node, which scrolls as it would
       anywhere (a node itself never scrolls: it is as tall as its content). A line of wheel (deltaMode 1) is read as
       16 px, a page as the box's height. */
    graph.addEventListener("wheel", event => {
        if (event.target?.closest?.("textarea, select")) return;
        event.preventDefault();
        const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? (graph.clientHeight || 400) : 1;
        const r = graph.getBoundingClientRect?.() ?? { left: 0, top: 0 };
        zoomBy(Math.exp(-(Number(event.deltaY) || 0) * unit * 0.0015), event.clientX - r.left, event.clientY - r.top);
    }, { passive: false });
    /* THE KEYS, while the focus is on the map and not in a field: + and = zoom in, - zooms out, 0 fits. */
    graph.addEventListener("keydown", event => {
        if (event.ctrlKey || event.metaKey || event.altKey || event.target?.closest?.("input, select, textarea")) return;
        const act = { "+": () => zoomBy(CAMERA_LIMITS.step, undefined, undefined, { ease: true }), "=": () => zoomBy(CAMERA_LIMITS.step, undefined, undefined, { ease: true }),
            "-": () => zoomBy(1 / CAMERA_LIMITS.step, undefined, undefined, { ease: true }), "0": () => fit() }[event.key];
        if (!act) return;
        event.preventDefault();
        act();
    });
    /* THE FOCUS IS NEVER OFF SCREEN: a node the arrows reach, or a field Tab reaches in an open node, is brought into view. */
    graph.addEventListener("focusin", event => reveal(event.target));
    return { apply, zoomBy, fit, reveal };
}

/** The right-hand gutter a tile keeps for its trial controls (E99 round 4), in px: the controls' width and their margin. */
export const TILE_GUTTER = 30;

/**
 * The trial's controls placed on their tiles as drawn now (E99 round 4): after `relayoutCaseMap` has moved
 * and sized the nodes, each tick and start goes to its tile's right-hand gutter - the tick at the top, the start under
 * it. In jsdom a tile measures 0 wide and the drawn width (`MAP_GEOMETRY.nodeW`) stands.
 */
export function placeTileControls(canvas) {
    for (const el of canvas?.querySelectorAll?.(":scope > [data-drpg-case-tick], :scope > [data-drpg-case-start-node]") ?? []) {
        const id = el.dataset.drpgCaseTick ?? el.dataset.drpgCaseStartNode;
        const tile = canvas.querySelector(`:scope > button[data-drpg-node="${CSS.escape(id)}"]`);
        if (!tile) continue;
        const x = (parseFloat(tile.style.left) || 0) + (tile.offsetWidth || MAP_GEOMETRY.nodeW) - TILE_GUTTER;
        el.style.left = `${x}px`;
        el.style.top = `${(parseFloat(tile.style.top) || 0) + (el.dataset.drpgCaseTick !== undefined ? 4 : 28)}px`;
    }
}
