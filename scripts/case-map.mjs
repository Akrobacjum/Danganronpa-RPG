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
import { esc, plural } from "./utils.mjs";
import { REMNANT_TYPES } from "./config.mjs";
import { caseRows, caseNodeOf } from "./case-schema.mjs";
import { remnantById } from "./remnants.mjs";

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
        if (node.planned) return node.kind === "incident" ? (REMNANT_TYPES.incident?.label ?? L("DRPG.CaseMap.kind.remnant")) : L("DRPG.CaseMap.kind.slot");
        return REMNANT_TYPES[node.type]?.label ?? REMNANT_TYPES[node.kind]?.label ?? L("DRPG.CaseMap.kind.remnant");
    }
    return L(`DRPG.CaseMap.kind.${node.kind}`);
}

/** A trial mode's name, the floor's own words (`DRPG.Floor.mode.*`); a mode the floor does not know, as written. */
export function modeLabel(mode) {
    const key = `DRPG.Floor.mode.${mode}`;
    return game.i18n.has?.(key) ? L(key) : String(mode ?? "");
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

/** A schema node's "x of y" (E97 C7): what the students other than the culprit hold of its inputs, and whether it is past
 *  half (`reachability`). Null for evidence and for a node with no input. */
function reachOf(node, reach) {
    return !node.evidence && reach && Number.isInteger(reach.of) && reach.of > 0 ? reach : null;
}

function nodeButton(node, p, { state, selected, loose, author, reach = null, warn = false }) {
    const kind = kindLabel(node);
    const name = nameOf(node);
    const stateText = STATE_KEYS[state] ? L(STATE_KEYS[state]) : "";
    const r = reachOf(node, reach);
    const reachText = r ? F(r.reachable ? "DRPG.CaseMap.reachYes" : "DRPG.CaseMap.reachNo", { held: r.held, of: r.of }) : "";
    const said = [kind, name, stateText, reachText, author ? F("DRPG.CaseMap.leftBy", { name: author }) : "", warn ? L("DRPG.CaseMap.hasProblem") : ""].filter(Boolean).join(", ");
    const cls = ["drpg-case-node", `drpg-case-node--${node.kind}`, `is-${state}`, ...(loose ? ["is-loose"] : []),
        ...(selected ? ["is-selected"] : []), ...(warn ? ["has-warn"] : []), ...(node.evidence && node.type ? [`drpg-case-type--${node.type}`] : [])];
    const mode = !node.evidence && node.mode ? `<span class="drpg-case-node-mode">${esc(modeLabel(node.mode))}</span>` : "";
    return `<button type="button" class="${cls.join(" ")}" data-drpg-node="${esc(node.id)}" style="left: ${p.x}px; top: ${p.y}px"`
        + `${selected ? ` aria-current="true"` : ""} aria-label="${esc(said)}" title="${esc(name)}">`
        + `<span class="drpg-case-node-head"><span class="drpg-case-node-kind">${esc(kind)}</span>${mode}`
        + (STATE_GLYPHS[state] ? `<span class="drpg-case-node-state">${glyphHtml(STATE_GLYPHS[state])}<span>${esc(stateText)}</span></span>` : "")
        + (warn ? `<span class="drpg-case-node-warn" title="${esc(L("DRPG.CaseMap.hasProblem"))}">${glyphHtml("case-warn")}!</span>` : "")
        + (r ? `<span class="drpg-case-node-reach${r.reachable ? " is-reachable" : ""}" title="${esc(reachText)}">${glyphHtml("reachable")}${r.held}/${r.of}</span>` : "")
        + `</span><span class="drpg-case-node-name">${esc(name)}</span></button>`;
}

/**
 * THE GRAPH ALONE (E99 draws it too): `graph` of case-schema.mjs `graphOf`, `layout` of case-layout.mjs `layoutCase`,
 * `finders` a Map of token id to the names holding a copy, `authors` a Map of node id to who left it (GMs only),
 * `selected` a node id, `fold` true to fold the unrelated evidence (its nodes and their space left out, the head kept).
 * The scroll box (`.drpg-case-graph`) is the container's to size.
 */
export function caseGraphHtml({ graph, layout, finders = null, authors = null, selected = null, fold = false, label = "", reach = null, problems = [] } = {}) {
    const warned = new Set((problems ?? []).map(p => p.node).filter(Boolean));
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
        buttons.push(nodeButton(node, p, { state: nodeState(node, finders), selected: id === selected, loose: unrelated.has(id), author: authors?.get?.(id) ?? null,
            reach: reach?.[id] ?? null, warn: warned.has(id) }));
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
/** A problem of `checkCase` as the GM reads it: its words, naming the node and what it names. */
export function problemText(p, graph) {
    const nameOfId = id => {
        const n = (graph?.nodes ?? []).find(x => x.id === id);
        return n ? nameOf(n) : String(id ?? "");
    };
    return F(`DRPG.CaseMap.problem.${p.code}`, { node: nameOfId(p.node), ref: p.code === "badMode" || p.code === "tooManyKeys" ? String(p.ref ?? "") : nameOfId(p.ref) });
}

export function casePanelHtml({ graph, node = null, finders = null, authors = null, cycle = [], reach = null, problems = [] } = {}) {
    if (node) {
        const r = reachOf(node, reach?.[node.id]);
        const ev = node.evidence ? reach?.[node.id] : null;
        const state = nodeState(node, finders);
        const names = node.evidence && !node.planned ? [...(finders?.get?.(tokenIdOf(node.trace)) ?? [])] : [];
        const lines = [row(L("DRPG.CaseMap.panelKind"), kindLabel(node))];
        if (STATE_KEYS[state]) lines.push(row(L("DRPG.CaseMap.panelState"), L(STATE_KEYS[state])));
        if (node.room) lines.push(row(L("DRPG.CaseMap.panelRoom"), node.room));
        if (node.evidence) lines.push(row(L("DRPG.CaseMap.panelAuthor"), authors?.get?.(node.id) || L("DRPG.Remnant.authorUnknown")));
        if (node.evidence && !node.planned) lines.push(row(L("DRPG.CaseMap.panelWhoHas"), names.length ? names.join(", ") : L("DRPG.CaseMap.nobodyYet")));
        if (!node.evidence && node.mode) lines.push(row(L("DRPG.CaseMap.panelMode"), modeLabel(node.mode)));
        if (r) lines.push(row(L("DRPG.CaseMap.panelReach"), F(r.reachable ? "DRPG.CaseMap.reachYes" : "DRPG.CaseMap.reachNo", { held: r.held, of: r.of })));
        if (ev?.culpritOnly) lines.push(`<p class="drpg-case-panel-note">${esc(L("DRPG.CaseMap.culpritOnly"))}</p>`);
        for (const p of (problems ?? []).filter(x => x.node === node.id)) lines.push(`<p class="drpg-case-panel-note drpg-case-panel-warn">${esc(problemText(p, graph))}</p>`);
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
    const list = (problems ?? []).map(p => `<li>${esc(problemText(p, graph))}</li>`);
    notes.push(`<div class="drpg-case-check-head"><button type="button" data-drpg-case-check>${esc(L("DRPG.CaseMap.checkCase"))}</button>`
        + `<span class="drpg-case-check-count">${esc(list.length ? F("DRPG.CaseMap.problemsFound", { n: list.length }) : L("DRPG.CaseMap.noProblems"))}</span></div>`);
    if (list.length) notes.push(`<ul class="drpg-case-problems">${list.join("")}</ul>`);
    return `<section class="drpg-case-panel-summary"><h4>${esc(F("DRPG.CaseMap.summaryTitle", { chapter: graph?.chapter ?? "-" }))}</h4>`
        + counts.map(([label, n]) => row(label, String(n))).join("") + notes.join("") + `</section>`;
}

/**
 * THE MAP VIEW, WHOLE: the graph's scroll box and the side panel, side by side in the view's box. `reading` is what the
 * panel's closure holds (`node` the picked node id, `fold`); the rest is read off the world by the caller.
 */
export function caseMapHtml({ graph, layout, finders = null, authors = null, reading = {}, editors = null, summary = "", tools = "", reach = null, problems = [] } = {}) {
    const picked = reading.node && (graph?.nodes ?? []).find(n => n.id === reading.node) || null;
    const label = F("DRPG.CaseMap.graphLabel", { chapter: graph?.chapter ?? "-" });
    return `<div class="drpg-case-map">`
        + `<div class="drpg-case-graph" tabindex="-1">${caseGraphHtml({ graph, layout, finders, authors, selected: picked?.id ?? null, fold: Boolean(reading.fold), label, reach, problems })}</div>`
        + `<aside class="drpg-case-panel">${tools}`
        + `<div class="drpg-case-panel-read" aria-live="polite">${casePanelHtml({ graph, node: picked, finders, authors, cycle: layout?.cycle ?? [], reach, problems })}</div>`
        + editorsHtml(editors, picked?.id ?? null, summary)
        + `</aside></div>`;
}

/**
 * THE TABLE'S FIELDS, IN THE SIDE PANEL (E97 C6; design notes 4, "the same write path, literally"). `editors` maps a node
 * id to the markup of its fields - the very cells the Table draws for that Remnant or Key slot, built by investigation.mjs
 * from the same functions, so each field has the Table's name and the value it was drawn with - and `summary` is the
 * chapter's own (the Final Truth Remnant form, the Key limit's override). Every node's fields are in the form, the picked
 * node's shown and the rest `hidden` (a hidden field is still the form's: `readDashboardForm` reads what the GM changed,
 * by name, wherever it stands), so the Table's one Save writes a Map edit unchanged and a switch of view carries a typed
 * field by its name (live.mjs). Nothing picked shows the summary's.
 */
function editorsHtml(editors, picked, summary) {
    const out = [];
    for (const [id, html] of editors ?? []) {
        if (!html) continue;
        out.push(`<fieldset class="drpg-case-edit" data-drpg-edit="${esc(id)}"${id === picked ? "" : " hidden"}>${html}</fieldset>`);
    }
    if (summary) out.push(`<fieldset class="drpg-case-edit drpg-case-edit-summary" data-drpg-edit=""${picked ? " hidden" : ""}>${summary}</fieldset>`);
    return out.join("");
}

/** One field of a node's editor: its column's words over the Table's own cell. */
export function editRow(label, cell) {
    return `<div class="drpg-case-edit-row"><span class="drpg-case-edit-label">${esc(label)}</span><div class="drpg-case-edit-field">${cell}</div></div>`;
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

/**
 * The side panel's tools (E97 C6): add a deduction, a counter or the solution; the column order (case-layout.mjs
 * LAYOUT_SORTS); move the picked node up or down its column (the order becomes "by hand"). Plain buttons and a select
 * with no name: each is written at once to the GMs' store, never through Save, as a GM's arrangement of the map.
 */
export function caseToolsHtml({ sort = "kind", picked = null, sorts = [] } = {}) {
    const b = (attr, value, key, extra = "") => `<button type="button" ${attr}="${esc(value)}"${extra}>${esc(L(key))}</button>`;
    return `<div class="drpg-case-tools">`
        + `<div class="drpg-case-tools-row">${b("data-drpg-case-add", "deduction", "DRPG.CaseMap.addDeduction")}${b("data-drpg-case-add", "counter", "DRPG.CaseMap.addCounter")}`
        + `${b("data-drpg-case-add", "solution", "DRPG.CaseMap.addSolution")}${b("data-drpg-case-add", "incident", "DRPG.CaseMap.addIncident")}</div>`
        + `<div class="drpg-case-tools-row"><label class="drpg-case-sort">${esc(L("DRPG.CaseMap.sortLabel"))} <select data-drpg-case-sort>`
        + sorts.map(k => `<option value="${esc(k)}"${k === sort ? " selected" : ""}>${esc(L(`DRPG.CaseMap.sort.${k}`))}</option>`).join("")
        + `</select></label>${b("data-drpg-case-move", "-1", "DRPG.CaseMap.moveUp", picked ? "" : " disabled")}`
        + `${b("data-drpg-case-move", "1", "DRPG.CaseMap.moveDown", picked ? "" : " disabled")}</div></div>`;
}

/** Wire the map inside `root`: a node's click picks it, the fold folds, the arrows walk the nodes; the side panel's tools
 *  (`onAdd(kind)`, `onSort(sort)`, `onMove(step)`, `onDrop(id)`). The focus is handed to the node the arrows reach. */
export function wireCaseMap(root, { onPick = () => {}, onFold = () => {}, onAdd = () => {}, onSort = () => {}, onMove = () => {}, onDrop = () => {}, onCheck = () => {}, onPlace = () => {} } = {}) {
    const panel = root?.querySelector?.(".drpg-case-panel");
    if (panel && !panel.dataset.drpgWired) {
        panel.dataset.drpgWired = "1";
        panel.addEventListener("click", event => {
            const add = event.target?.closest?.("[data-drpg-case-add]");
            if (add) { onAdd(add.dataset.drpgCaseAdd); return; }
            const move = event.target?.closest?.("[data-drpg-case-move]");
            if (move && !move.disabled) { onMove(Number(move.dataset.drpgCaseMove)); return; }
            const drop = event.target?.closest?.("[data-drpg-case-drop]");
            if (drop) onDrop(drop.dataset.drpgCaseDrop);
            if (event.target?.closest?.("[data-drpg-case-check]")) onCheck();
            const place = event.target?.closest?.("[data-drpg-case-place]");
            if (place) onPlace(place.dataset.drpgCasePlace);
        });
        panel.querySelector("[data-drpg-case-sort]")?.addEventListener("change", event => onSort(event.target.value));
    }
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

/**
 * THE CASE'S INCIDENT REMNANTS TO PLACE, IN THE GM PANEL (E97 C12; the goal: "the list of Incident Remnants still to
 * place is in the GM panel"). The chapter's planned Incident Remnants: each not on the map yet with "Place on the map"
 * (New Remnant, filled in), each placed with "Show" (the Investigation panel on its node). Nothing when the case plans
 * none. A GM's (the schema is a GM store; a player's panel has no standing block).
 */
export function incidentAsksHtml(chapter) {
    if (!game.user?.isGM) return "";
    const rows = Object.entries(caseRows(chapter).rows).map(([id, raw]) => [id, caseNodeOf(raw)]).filter(([, n]) => n?.kind === "incident");
    if (!rows.length) return "";
    const placed = n => {
        if (!n.trace) return false;
        const [sceneId, tokenId] = n.trace.split(".");
        return Boolean(remnantById(sceneId, tokenId));
    };
    const waiting = rows.filter(([, n]) => !placed(n)).length;
    const line = ([id, n]) => {
        const on = placed(n);
        const what = [n.label || L("DRPG.CaseMap.noName"), n.room].filter(Boolean).join(" · ");
        return `<li class="drpg-case-ask${on ? " is-placed" : ""}"><span>${esc(what)}</span>`
            + (on ? `<button type="button" class="drpg-mini-button" data-drpg-case-show="${esc(n.trace)}">${esc(L("DRPG.CaseMap.showOnMap"))}</button>`
                : `<button type="button" class="drpg-mini-button" data-drpg-case-place="${esc(`${chapter}:${id}`)}">${esc(L("DRPG.CaseMap.placeOnMap"))}</button>`)
            + `</li>`;
    };
    const head = waiting ? plural("DRPG.CaseMap.waiting", { n: waiting }) : L("DRPG.CaseMap.waitingNone");
    return `<div class="drpg-case-asks"><p><strong>${esc(head)}</strong></p><ul>${rows.map(line).join("")}</ul></div>`;
}
