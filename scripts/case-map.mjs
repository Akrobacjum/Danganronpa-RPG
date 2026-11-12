/**
 * THE CASE MAP (E97 C5, 12.11.2026; STAGE E97+E98 C5, the owner's 09.11 decisions and his 11.11 correction: "the case
 * plan was meant to be part of the Investigation panel"). The Investigation panel's Map view: the chapter's case as a
 * graph - evidence on the left (every Remnant, the Key Remnant plan's slots, the Final Truth), what follows from it in
 * the middle (deductions and counters), the solution on the right - and a side panel for the node the GM picked.
 *
 * HTML NODES OVER ONE SVG EDGE LAYER (design notes 2). Each node is a `<button>` placed where case-layout.mjs
 * `layoutCase` puts it, at a pitch this file states (`MAP_GEOMETRY`), so the lines between them are computed from the
 * same numbers and never read off a box (jsdom lays nothing out; E99 draws the same graph in the trial's middle). A
 * button wraps its words, takes the kit's type rules, is focusable and is read by a screen reader with its kind, name,
 * state and author (`aria-label`); SVG text would do none of that.
 *
 * WHAT IS DRAWN, NOT WHAT IS EDITED. This file draws; the panel's write road is the Table's (investigation.mjs
 * `readDashboardForm`, `applyDashboardSave`), reached by the fields C6 puts in the side panel. A player never draws a
 * map: the panel is the GMs' (`openInvestigationDashboard` refuses anyone else) and the schema is a GM store.
 *
 * E99 READS: `caseGraphHtml` (the graph alone, any size of container), `mapPlace`, `edgePath` and `nodeState`.
 */
import { esc } from "./utils.mjs";
import { REMNANT_TYPES } from "./config.mjs";

/**
 * The map's geometry in CSS pixels at the root's 16 px: a node's box, the gap between columns, the pitch between rows,
 * the margin around the graph and the room the column heads take above it. Read by `mapPlace` and by the stylesheet's
 * node rule (components.css "THE CASE MAP", whose width and height are these two numbers).
 */
export const MAP_GEOMETRY = Object.freeze({ nodeW: 196, nodeH: 54, colGap: 48, pitch: 66, pad: 12, head: 28 });

/**
 * Where each node of `layout` stands, in pixels: `{ at: { id: { x, y } }, width, height, gapY }` - `gapY` the middle of
 * the empty row before the unrelated evidence (null without any). Pure.
 */
export function mapPlace(layout, g = MAP_GEOMETRY) {
    const at = {};
    let cols = 0, rows = 0;
    for (const [id, p] of Object.entries(layout?.positions ?? {})) {
        at[id] = { x: g.pad + p.col * (g.nodeW + g.colGap), y: g.head + g.pad + p.row * g.pitch };
        cols = Math.max(cols, p.col + 1);
        rows = Math.max(rows, p.row + 1);
    }
    const gapY = Number.isInteger(layout?.gapAt) && (layout?.unrelated?.length ?? 0) > 0
        ? g.head + g.pad + layout.gapAt * g.pitch + Math.round(g.nodeH / 2) : null;
    return { at, width: g.pad * 2 + Math.max(1, cols) * g.nodeW + Math.max(0, cols - 1) * g.colGap,
        height: g.head + g.pad * 2 + Math.max(1, rows) * g.pitch, gapY };
}

/**
 * One edge's path: from the right edge of `from` to the left edge of `to`, a curve of two halves; between two nodes of
 * one column (a counter beside what it refutes) a bracket on their left, as the proposal drew it, instead of a curve
 * through the nodes. Pure.
 */
export function edgePath(from, to, g = MAP_GEOMETRY) {
    if (to.x <= from.x) {
        const x = Math.min(from.x, to.x) - Math.round(g.colGap / 4);
        return `M${from.x} ${from.y + g.nodeH / 2} H${x} V${to.y + g.nodeH / 2} H${to.x}`;
    }
    const x1 = from.x + g.nodeW, y1 = from.y + g.nodeH / 2, x2 = to.x, y2 = to.y + g.nodeH / 2;
    const mid = Math.round((x1 + x2) / 2);
    return `M${x1} ${y1} C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`;
}

/**
 * A node's state for the map: evidence "planned" (a Key slot with no Remnant yet), "held" (a student holds a copy:
 * `finders` names one), "onMap" (placed, nobody has it); a schema node "schema". Pure.
 */
export function nodeState(node, finders = null) {
    if (!node?.evidence) return "schema";
    if (node.planned) return "planned";
    const names = finders?.get?.(tokenIdOf(node.trace)) ?? null;
    return names && names.size ? "held" : "onMap";
}

/** The token id of a ledger key `sceneId.tokenId` (the bullets' answer keys name the token, investigation.mjs). */
export function tokenIdOf(key) {
    const s = String(key ?? "");
    const dot = s.indexOf(".");
    return dot < 0 ? s : s.slice(dot + 1);
}

const L = key => game.i18n.localize(key);
const F = (key, data) => game.i18n.format(key, data);

/** A node's kind as its strip reads: the Remnant's type for evidence, the schema's kind otherwise. */
export function kindLabel(node) {
    if (node.evidence) {
        if (node.planned) return L("DRPG.CaseMap.kind.slot");
        return REMNANT_TYPES[node.type]?.label ?? REMNANT_TYPES[node.kind]?.label ?? L("DRPG.CaseMap.kind.remnant");
    }
    return L(`DRPG.CaseMap.kind.${node.kind}`);
}

const STATE_KEYS = { held: "DRPG.CaseMap.state.held", onMap: "DRPG.CaseMap.state.onMap", planned: "DRPG.CaseMap.state.planned" };
const STATE_GLYPHS = { held: "held", onMap: "on-map", planned: "planned" };
/**
 * A glyph's slot (E48's inventory names the drawing: tests-glyphs.mjs rows 33, 34, 92-94). The drawings of E97's and E98's
 * rows are in tools/glyphs.json but not yet declared as `--drpg-pix-*` in styles/pixel-icons.css, which tools/glyph-map.mjs
 * generates (E48); drawn now, the mask would read an undeclared variable and paint a square (Chromium, E97 C5). So the
 * slot names its glyph and draws nothing until the generator declares it (STATUS, open to the coordinator).
 */
export const glyphHtml = name => `<span class="drpg-case-glyph" data-drpg-glyph="${name}" aria-hidden="true"></span>`;

/** The name a node shows: its label, else a slot's number, else "(no name)". */
function nameOf(node) {
    if (node.label) return node.label;
    if (node.planned && Number.isInteger(node.slot)) return F("DRPG.CaseMap.slotNumber", { n: node.slot + 1 });
    return L("DRPG.CaseMap.noName");
}

function nodeButton(node, p, { state, selected, loose, author }) {
    const kind = kindLabel(node);
    const name = nameOf(node);
    const stateText = STATE_KEYS[state] ? L(STATE_KEYS[state]) : "";
    const said = [kind, name, stateText, author ? F("DRPG.CaseMap.leftBy", { name: author }) : ""].filter(Boolean).join(", ");
    const cls = ["drpg-case-node", `drpg-case-node--${node.kind}`, `is-${state}`, ...(loose ? ["is-loose"] : []),
        ...(selected ? ["is-selected"] : []), ...(node.evidence && node.type ? [`drpg-case-type--${node.type}`] : [])];
    const mode = !node.evidence && node.mode ? `<span class="drpg-case-node-mode">${esc(node.mode)}</span>` : "";
    return `<button type="button" class="${cls.join(" ")}" data-drpg-node="${esc(node.id)}" style="left: ${p.x}px; top: ${p.y}px"`
        + `${selected ? ` aria-current="true"` : ""} aria-label="${esc(said)}" title="${esc(name)}">`
        + `<span class="drpg-case-node-head"><span class="drpg-case-node-kind">${esc(kind)}</span>${mode}`
        + (STATE_GLYPHS[state] ? `<span class="drpg-case-node-state">${glyphHtml(STATE_GLYPHS[state])}<span>${esc(stateText)}</span></span>` : "")
        + `</span><span class="drpg-case-node-name">${esc(name)}</span></button>`;
}

/**
 * THE GRAPH ALONE (E99 draws it too): `graph` of case-schema.mjs `graphOf`, `layout` of case-layout.mjs `layoutCase`,
 * `finders` a Map of token id to the names holding a copy, `authors` a Map of node id to who left it (GMs only),
 * `selected` a node id, `fold` true to fold the unrelated evidence (its nodes and their space left out, the head kept).
 * The scroll box (`.drpg-case-graph`) is the container's to size.
 */
export function caseGraphHtml({ graph, layout, finders = null, authors = null, selected = null, fold = false, label = "" } = {}) {
    const nodes = new Map((graph?.nodes ?? []).map(n => [n.id, n]));
    const unrelated = new Set(layout?.unrelated ?? []);
    const shown = fold && unrelated.size
        ? { ...layout, positions: Object.fromEntries(Object.entries(layout.positions).filter(([id]) => !unrelated.has(id))), unrelated: [...unrelated] }
        : layout;
    const place = mapPlace(shown);
    if (fold && unrelated.size) place.height = Math.max(place.height, (place.gapY ?? 0) + MAP_GEOMETRY.pitch);
    const heads = [];
    const cols = (layout?.columns ?? []).length;
    for (let c = 0; c < cols; c++) {
        const ids = layout.columns[c];
        const kinds = new Set(ids.map(id => nodes.get(id)?.kind));
        const key = c === 0 ? "DRPG.CaseMap.colEvidence" : kinds.size === 1 && kinds.has("solution") ? "DRPG.CaseMap.colSolution" : "DRPG.CaseMap.colDeductions";
        heads.push(`<span class="drpg-case-col-head" style="left: ${MAP_GEOMETRY.pad + c * (MAP_GEOMETRY.nodeW + MAP_GEOMETRY.colGap)}px">${esc(L(key))}</span>`);
    }
    const edges = (graph?.edges ?? []).filter(e => place.at[e.from] && place.at[e.to]).map(e =>
        `<path class="drpg-case-edge drpg-case-edge--${esc(e.kind)}" data-drpg-edge="${esc(e.from)}>${esc(e.to)}" d="${edgePath(place.at[e.from], place.at[e.to])}"/>`);
    const buttons = [];
    for (const [id, p] of Object.entries(place.at)) {
        const node = nodes.get(id);
        if (!node) continue;
        buttons.push(nodeButton(node, p, { state: nodeState(node, finders), selected: id === selected, loose: unrelated.has(id), author: authors?.get?.(id) ?? null }));
    }
    const gap = place.gapY === null ? "" : `<div class="drpg-case-gap" style="top: ${place.gapY}px; width: ${MAP_GEOMETRY.nodeW}px; left: ${MAP_GEOMETRY.pad}px">`
        + `<button type="button" class="drpg-case-fold" data-drpg-case-fold aria-expanded="${fold ? "false" : "true"}">${esc(F("DRPG.CaseMap.unrelated", { n: unrelated.size }))}</button></div>`;
    return `<div class="drpg-case-canvas" style="width: ${place.width}px; height: ${place.height}px" role="group" aria-label="${esc(label)}">`
        + heads.join("")
        + `<svg class="drpg-case-edges" width="${place.width}" height="${place.height}" aria-hidden="true" focusable="false">${edges.join("")}</svg>`
        + gap + buttons.join("") + `</div>`;
}

/** One row of the side panel: a label and its value, both text. */
const row = (label, value) => `<div class="drpg-case-panel-row"><span class="drpg-case-panel-label">${esc(label)}</span><span class="drpg-case-panel-value">${esc(value)}</span></div>`;

/**
 * The side panel: the picked node - its kind, name, state, room, who left it and who holds a copy - or, with none
 * picked, the chapter's summary. `cycle` the nodes on a cycle of inputs (the layout draws none of them).
 */
export function casePanelHtml({ graph, node = null, finders = null, authors = null, cycle = [] } = {}) {
    if (node) {
        const state = nodeState(node, finders);
        const names = node.evidence && !node.planned ? [...(finders?.get?.(tokenIdOf(node.trace)) ?? [])] : [];
        const lines = [row(L("DRPG.CaseMap.panelKind"), kindLabel(node))];
        if (STATE_KEYS[state]) lines.push(row(L("DRPG.CaseMap.panelState"), L(STATE_KEYS[state])));
        if (node.room) lines.push(row(L("DRPG.CaseMap.panelRoom"), node.room));
        if (node.evidence) lines.push(row(L("DRPG.CaseMap.panelAuthor"), authors?.get?.(node.id) || L("DRPG.Remnant.authorUnknown")));
        if (node.evidence && !node.planned) lines.push(row(L("DRPG.CaseMap.panelWhoHas"), names.length ? names.join(", ") : L("DRPG.CaseMap.nobodyYet")));
        if (!node.evidence && node.mode) lines.push(row(L("DRPG.CaseMap.panelMode"), node.mode));
        if (!node.evidence && node.text) lines.push(`<p class="drpg-case-panel-text">${esc(node.text)}</p>`);
        return `<section class="drpg-case-panel-node" data-drpg-panel-node="${esc(node.id)}"><h4>${esc(nameOf(node))}</h4>${lines.join("")}</section>`;
    }
    const all = graph?.nodes ?? [];
    const evidence = all.filter(n => n.evidence);
    const counts = [
        [L("DRPG.CaseMap.sumEvidence"), evidence.length],
        [L("DRPG.CaseMap.sumTied"), evidence.filter(n => n.tied).length],
        [L("DRPG.CaseMap.sumHeld"), evidence.filter(n => nodeState(n, finders) === "held").length],
        [L("DRPG.CaseMap.sumDeductions"), all.filter(n => n.kind === "deduction").length],
        [L("DRPG.CaseMap.sumCounters"), all.filter(n => n.kind === "counter").length]
    ];
    const notes = [];
    if (!all.some(n => !n.evidence)) notes.push(`<p class="drpg-case-panel-note">${esc(L("DRPG.CaseMap.noSchema"))}</p>`);
    if (cycle.length) notes.push(`<p class="drpg-case-panel-note drpg-case-panel-warn">${esc(F("DRPG.CaseMap.cycle", { nodes: cycle.join(", ") }))}</p>`);
    return `<section class="drpg-case-panel-summary"><h4>${esc(F("DRPG.CaseMap.summaryTitle", { chapter: graph?.chapter ?? "-" }))}</h4>`
        + counts.map(([label, n]) => row(label, String(n))).join("") + notes.join("") + `</section>`;
}

/**
 * THE MAP VIEW, WHOLE: the graph's scroll box and the side panel, side by side in the view's box. `reading` is what the
 * panel's closure holds (`node` the picked node id, `fold`); the rest is read off the world by the caller.
 */
export function caseMapHtml({ graph, layout, finders = null, authors = null, reading = {} } = {}) {
    const picked = reading.node && (graph?.nodes ?? []).find(n => n.id === reading.node) || null;
    const label = F("DRPG.CaseMap.graphLabel", { chapter: graph?.chapter ?? "-" });
    return `<div class="drpg-case-map">`
        + `<div class="drpg-case-graph" tabindex="-1">${caseGraphHtml({ graph, layout, finders, authors, selected: picked?.id ?? null, fold: Boolean(reading.fold), label })}</div>`
        + `<aside class="drpg-case-panel" aria-live="polite">${casePanelHtml({ graph, node: picked, finders, authors, cycle: layout?.cycle ?? [] })}</aside>`
        + `</div>`;
}

/**
 * The arrow keys between nodes (`wireCaseMap`): the nearest node in the arrow's direction from `from`, among
 * `points` `[{ id, x, y }]`; null where there is none. Up and down look within a band of the column first. Pure.
 */
export function neighbourOf(points, from, key) {
    const here = points.find(p => p.id === from);
    if (!here) return points[0]?.id ?? null;
    const dir = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[key];
    if (!dir) return null;
    let best = null, bestScore = Infinity;
    for (const p of points) {
        if (p.id === from) continue;
        const dx = p.x - here.x, dy = p.y - here.y;
        const along = dx * dir[0] + dy * dir[1];
        if (along <= 0) continue;
        const across = Math.abs(dir[0] ? dy : dx);
        const score = along + across * 3;
        if (score < bestScore) { bestScore = score; best = p.id; }
    }
    return best;
}

/** Wire the map inside `root`: a node's click picks it, the fold folds, the arrows walk the nodes. `onPick(id)` and
 *  `onFold()` are the panel's; the focus is handed to the node the arrows reach. */
export function wireCaseMap(root, { onPick = () => {}, onFold = () => {} } = {}) {
    const graph = root?.querySelector?.(".drpg-case-graph");
    if (!graph || graph.dataset.drpgWired) return;
    graph.dataset.drpgWired = "1";
    graph.addEventListener("click", event => {
        const fold = event.target?.closest?.("[data-drpg-case-fold]");
        if (fold) { onFold(); return; }
        const node = event.target?.closest?.("[data-drpg-node]");
        if (node && graph.contains(node)) onPick(node.dataset.drpgNode);
    });
    graph.addEventListener("keydown", event => {
        const node = event.target?.closest?.("[data-drpg-node]");
        if (!node || !/^Arrow/.test(event.key)) return;
        const points = [...graph.querySelectorAll("[data-drpg-node]")].map(b => ({
            id: b.dataset.drpgNode, x: parseFloat(b.style.left) || 0, y: parseFloat(b.style.top) || 0 }));
        const next = neighbourOf(points, node.dataset.drpgNode, event.key);
        if (!next) return;
        event.preventDefault();
        graph.querySelector(`[data-drpg-node="${CSS.escape(next)}"]`)?.focus();
    });
}
