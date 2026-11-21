/**
 * THE CASE MAP (E97 C5, 12.11.2026; STAGE E97+E98 C5, the owner's 09.11 decisions and his 11.11 correction: "the case
 * plan was meant to be part of the Investigation panel"). The Investigation panel's Map view: the chapter's case as a
 * graph - evidence on the left (every Remnant, the Key Remnant plan's slots, the Final Truth), what follows from it in
 * the middle (deductions and counters), the solution on the right. Since the E97 fix (the owner's review of 12.11.2026)
 * there is no side panel: a node shows its whole content, opens its own fields under itself, and the schema has a camera
 * (case-view.mjs).
 *
 * HTML NODES OVER ONE SVG EDGE LAYER (design notes 2). Each node is a `<button>` placed where case-layout.mjs
 * `layoutCase` puts it, at a pitch case-view.mjs states (`MAP_GEOMETRY`), so the lines between them are computed from the
 * same numbers (jsdom lays nothing out; E99 draws the same graph in the trial's middle); in a browser case-view.mjs
 * `relayoutCaseMap` then measures each node at its whole content and places the nodes and the lines again through the
 * same `mapPlace`. A button wraps its words, takes the kit's type rules, is focusable and is read by a screen reader with
 * its kind, name, state, author and words (`aria-label`); SVG text would do none of that.
 *
 * WHAT IS DRAWN, NOT WHAT IS EDITED. This file draws; the panel's write road is the Table's (investigation.mjs
 * `readDashboardForm`, `applyDashboardSave`), reached by the fields C6 built, which stand on each node since the fix. A player never draws a
 * map: the panel is the GMs' (`openInvestigationDashboard` refuses anyone else) and the schema is a GM store.
 *
 * E99 READS: `caseGraphHtml` (the graph alone, any size of container), `mapPlace`, `edgePath` and `nodeState`.
 */
import { esc } from "./utils.mjs";
import { tipAttr } from "./ui-kit.mjs";
import { REMNANT_TYPES, TRUTH_BULLET_TYPES } from "./config.mjs";
import { MAP_GEOMETRY, mapPlace, routeEdges, relayoutCaseMap, wireCaseCamera, lightEdges, CAMERA_LIMITS, TILE_GUTTER } from "./case-view.mjs";

/* THE GEOMETRY, MEASURED (E97 fix): `MAP_GEOMETRY`, `mapPlace` and `edgePath` live in case-view.mjs, the leaf that also
   places the drawn nodes at their measured size and moves the camera; read here, and by E99, under these names. */
export { MAP_GEOMETRY, mapPlace, edgePath, TILE_GUTTER, placeTileControls } from "./case-view.mjs";
/**
 * A node's state for the map: evidence "planned" (a Key slot with no Remnant yet), "held" (a student holds a copy:
 * `finders` names one), "onMap" (placed, nobody has it); a schema node "schema". Pure.
 */
export function nodeState(node, finders = null) {
    if (!node?.evidence) return "schema";
    // a planned Autopsy once sent (13.11.2026), a planned Truth Bullet once given (E104)
    if (node.kind === "autopsy" || node.kind === "bullet") return node.sent ? "sent" : "planned";
    if (node.planned) return "planned";
    const names = finders?.get?.(tokenIdOf(node.trace)) ?? null;
    return names && names.size ? "held" : "onMap";
}

/** The token id of a ledger key `sceneId.tokenId` (the bullets' answer keys name the token, investigation.mjs). */
function tokenIdOf(key) {
    const s = String(key ?? "");
    const dot = s.indexOf(".");
    return dot < 0 ? s : s.slice(dot + 1);
}

const L = key => game.i18n.localize(key);
const F = (key, data) => game.i18n.format(key, data);

/** A node's kind as its strip reads: the Remnant's type for evidence, the schema's kind otherwise. */
export function kindLabel(node) {
    if (node.evidence) {
        if (node.kind === "autopsy") {
            const label = TRUTH_BULLET_TYPES.autopsy?.label ?? L("DRPG.CaseMap.kind.remnant");
            // numbered where the chapter plans more than one (13.11.2026)
            return node.of > 1 && Number.isInteger(node.n) ? F("DRPG.CaseMap.autopsyNth", { label, n: node.n }) : label;
        }
        if (node.planned && node.kind === "final") return REMNANT_TYPES.final?.label ?? L("DRPG.CaseMap.kind.remnant");
        // a planned Truth Bullet by its real type (E104)
        if (node.kind === "bullet") return TRUTH_BULLET_TYPES[node.realType]?.label ?? L("DRPG.CaseMap.kind.remnant");
        if (node.planned) return node.kind === "incident" ? (REMNANT_TYPES[node.type ?? "incident"]?.label ?? L("DRPG.CaseMap.kind.remnant")) : L("DRPG.CaseMap.kind.slot");
        return REMNANT_TYPES[node.type]?.label ?? REMNANT_TYPES[node.kind]?.label ?? L("DRPG.CaseMap.kind.remnant");
    }
    return L(`DRPG.CaseMap.kind.${node.kind}`);
}

/** A trial mode's name, the floor's own words (`DRPG.Floor.mode.*`); a mode the floor does not know, as written. */
export function modeLabel(mode) {
    const key = `DRPG.Floor.mode.${mode}`;
    return game.i18n.has?.(key) ? L(key) : String(mode ?? "");
}

/* A state's word and glyph, each state `nodeState` answers but "schema". "sent" since audit A113-C3-1 (13.11.2026): 6964661f
   taught `nodeState` the answer and both files its word, and this table neither, so a sent Autopsy or a given Truth Bullet
   lost its state on the node and its State row on the panel (R5902 reads the states off `nodeState` itself). */
const STATE_KEYS = { held: "DRPG.CaseMap.state.held", onMap: "DRPG.CaseMap.state.onMap", planned: "DRPG.CaseMap.state.planned",
    sent: "DRPG.CaseMap.state.sent" };
const STATE_GLYPHS = { held: "held", onMap: "on-map", planned: "planned", sent: "send" };
/**
 * A glyph's slot (E48's inventory names the drawing: tests-glyphs.mjs rows 33, 34, 92-94). The drawings of E97's and E98's
 * rows are in tools/glyphs.json but not yet declared as `--drpg-pix-*` in styles/pixel-icons.css, which tools/glyph-map.mjs
 * generates (E48); drawn now, the mask would read an undeclared variable and paint a square (Chromium, E97 C5). So the
 * slot names its glyph and draws nothing until the generator declares it (STATUS, open to the coordinator).
 */
export const glyphHtml = name => `<span class="drpg-case-glyph" data-drpg-glyph="${name}" aria-hidden="true"></span>`;

/**
 * A REMNANT'S TYPE BY ITS COLOUR (1.2.119, the owner: "Kodowanie kolorystyczne typów remnantów"). The eight types of
 * config.mjs REMNANT_TYPES in the order the legend names them; each has a colour and an ink in both themes
 * (components.css `--drpg-case-type-<type>`, `--drpg-case-type-ink`; tools/contrast-pairs.json `case-type-*` holds each
 * pair at AA). The colour is never the only cue: the node's first line still names its type in words.
 */
export const CASE_TYPE_ORDER = Object.freeze(["key", "incident", "prep", "resolution", "autopsy", "neutral", "faint", "final"]);

/**
 * An evidence node's type for its colour: a Key slot, and a Remnant placed in one, Key; a planned Incident Remnant its
 * planned type, Incident where none is written (as `kindLabel` reads it); a planned Truth Bullet its real type; an
 * Autopsy and a Final Truth their own; a placed Remnant its type. Null for a schema node and a type the list lacks. Pure.
 */
export function caseTypeOf(node) {
    if (!node?.evidence) return null;
    const t = node.kind === "key" ? "key" : node.kind === "autopsy" ? "autopsy" : node.kind === "final" ? "final"
        : node.kind === "incident" && node.planned ? (node.type ?? "incident") : node.kind === "bullet" ? (node.realType ?? node.type) : node.type;
    return CASE_TYPE_ORDER.includes(t) ? t : null;
}

/** The schema's kinds that carry a colour (round 2), in the legend's order after the types. */
export const CASE_KIND_ORDER = Object.freeze(["deduction", "counter", "solution"]);

/**
 * THE TRIAL MODES A DEDUCTION MAY CARRY, EACH A COLOUR (1.2.119 round 4; the owner: "dedukcje niech maja tez rozne kolory i
 * kolory strzalek zaleznie od tego, jaki class trial mode maja przypisany"): case-schema.mjs `caseModes()` as it lists them
 * (floor-machine.mjs `MODES` less Objection and Rebuttal, which a player starts), spelled here so this file imports no
 * trial code; R7831 holds the two lists equal. A deduction with a mode takes the mode's colour - its band, its kind's chip
 * and its lines - and keeps its kind's class after it; one with none keeps the Deduction's; a counter and the solution
 * keep their own whatever mode they carry. `data-drpg-trial-mode`, not `data-drpg-mode`: the kit's mode bars and the
 * trial console's start button answer to that one.
 */
export const CASE_MODE_ORDER = Object.freeze(["debate", "testimony", "panic", "closing", "straw", "dive", "scrum"]);

/** A node's type, kind or mode classes and attributes, or nothing: an evidence node by `caseTypeOf`, a schema node by its
 *  kind, a deduction with a trial mode by the mode first (its colour wins; `colourOf` reads the first class). */
function typeAttrs(t, node = null) {
    if (t) return { cls: [`drpg-case-type--${t}`], attr: ` data-drpg-type="${t}"` };
    const k = !node?.evidence && CASE_KIND_ORDER.includes(node?.kind) ? node.kind : null;
    if (!k) return { cls: [], attr: "" };
    const m = k === "deduction" && CASE_MODE_ORDER.includes(node?.mode) ? node.mode : null;
    return m ? { cls: [`drpg-case-mode--${m}`, `drpg-case-kind--${k}`], attr: ` data-drpg-kind="${k}" data-drpg-trial-mode="${m}"` }
        : { cls: [`drpg-case-kind--${k}`], attr: ` data-drpg-kind="${k}"` };
}

/**
 * THE LEGEND (1.2.119): each type the drawn case holds, once, in CASE_TYPE_ORDER, its colour's swatch beside the type's
 * own name (REMNANT_TYPES' label, the words the nodes use). Drawn at the left of the camera's strip under the graph, which
 * stands there anyway; since round 2 the schema's kinds after the types (`CASE_KIND_ORDER`). Measured in Chromium (audit/case-map-sweep.mjs, a case holding all eight types, 20.11.2026): under
 * the glass the graph's viewport keeps its height (972x295 at 1366x768, 972x599 at 1920x1080); under Legacy, whose pixel
 * font is wider, the legend wraps to three lines and the viewport loses 29 px (319 -> 290, 623 -> 594); the owner kept it
 * visible (20.11.2026). Nothing for a case with neither typed evidence nor a schema node.
 */
export function caseLegendHtml(graph) {
    const held = new Set((graph?.nodes ?? []).map(caseTypeOf).filter(Boolean));
    const types = CASE_TYPE_ORDER.filter(t => held.has(t));
    // the schema's kinds after the types (round 2), named by the words their chips carry
    const kinds = CASE_KIND_ORDER.filter(k => (graph?.nodes ?? []).some(n => !n.evidence && n.kind === k));
    // the trial modes the Map's deductions carry, after the kinds (round 4), by the floor's own words
    const modes = CASE_MODE_ORDER.filter(m => (graph?.nodes ?? []).some(n => !n.evidence && n.kind === "deduction" && n.mode === m));
    if (!types.length && !kinds.length) return "";
    const swatch = `<span class="drpg-case-legend-swatch" aria-hidden="true"></span>`;
    return `<ul class="drpg-case-legend" aria-label="${esc(L("DRPG.CaseMap.legendLabel"))}">`
        + types.map(t => `<li class="drpg-case-legend-item drpg-case-type--${t}" data-drpg-type="${t}">${swatch}${esc(REMNANT_TYPES[t]?.label ?? t)}</li>`).join("")
        + kinds.map(k => `<li class="drpg-case-legend-item drpg-case-kind--${k}" data-drpg-kind="${k}">${swatch}${esc(L(`DRPG.CaseMap.kind.${k}`))}</li>`).join("")
        + modes.map(m => `<li class="drpg-case-legend-item drpg-case-mode--${m}" data-drpg-trial-mode="${m}">${swatch}${esc(modeLabel(m))}</li>`).join("")
        + `</ul>`;
}

/* THE ARROWHEADS (1.2.119, "Czytelność strzałek"): in this canvas's own SVG and named for it alone, since the Map and the
   Class Trial console can stand in one page. Drawn in user space (the head the same size whatever the line's width) with
   its tip as its reference point, so the head ends where the path ends, on the target's left edge (case-view.mjs
   `edgeEnd`), not under the node. 8 px tall since round 3: a target's ports stand `ROUTE.port` (10 px) apart. ONE PAIR
   PER COLOUR (round 3, the owner: "Niech maja kolory pasujace do typu bulleta"): a line takes its source's colour, so
   each source type or kind drawn has a head and a lit head carrying its class (`drpg-case-type--*`, `drpg-case-kind--*`),
   whose fill is `--drpg-case-type` (components.css); "plain" for a source with neither. */
let arrowSets = 0;
function arrowDefs(colours) {
    const base = `drpg-case-arrow-${++arrowSets}`;
    const keys = [...new Set(colours.map(c => c ?? "plain"))];
    const ids = Object.fromEntries(keys.map(k => [k, `${base}-${String(k).replace(/[^\w-]/g, "")}`]));
    const marker = (id, cls) => `<marker id="${id}" class="drpg-case-arrow ${cls}" viewBox="0 0 10 8" refX="10" refY="4" markerUnits="userSpaceOnUse"`
        + ` markerWidth="10" markerHeight="8" orient="auto"><path d="M0 0 L10 4 L0 8 z"/></marker>`;
    const defs = `<defs>${keys.map(k => marker(ids[k], k === "plain" ? "" : esc(k)) + marker(`${ids[k]}-lit`, `drpg-case-arrow--lit${k === "plain" ? "" : ` ${esc(k)}`}`)).join("")}</defs>`;
    return { defs, head: c => ids[c ?? "plain"], lit: c => `${ids[c ?? "plain"]}-lit` };
}

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

/** The trial's marks on a node (E99 C5; case-trial.mjs): a class each, and its words in the node's label. */
const MARK_KEYS = Object.freeze({ presented: "DRPG.CaseTrial.presented", hinted: "DRPG.CaseTrial.hint", ticked: "DRPG.CaseTrial.ticked" });

function nodeButton(node, p, { state, selected, loose, author, reach = null, warn = false, marks = [], controlled = false, editing = false, editable = false }) {
    const kind = kindLabel(node);
    const name = nameOf(node);
    const stateText = STATE_KEYS[state] ? L(STATE_KEYS[state]) : "";
    const r = reachOf(node, reach);
    const reachText = r ? F(r.reachable ? "DRPG.CaseMap.reachYes" : "DRPG.CaseMap.reachNo", { held: r.held, of: r.of }) : "";
    const text = String(node.text ?? "").trim();
    const typed = typeAttrs(caseTypeOf(node), node);
    const said = [kind, name, stateText, reachText, author ? F("DRPG.CaseMap.leftBy", { name: author }) : "", warn ? L("DRPG.CaseMap.hasProblem") : "", text,
        ...marks.filter(m => MARK_KEYS[m]).map(m => L(MARK_KEYS[m]))].filter(Boolean).join(", ");
    const cls = ["drpg-case-node", `drpg-case-node--${node.kind}`, `is-${state}`, ...(loose ? ["is-loose"] : []),
        ...(selected ? ["is-selected"] : []), ...(editing ? ["is-editing"] : []), ...(warn ? ["has-warn"] : []), ...marks.filter(m => MARK_KEYS[m]).map(m => `is-${m}`), ...(controlled ? ["has-controls"] : []), ...typed.cls];
    /* THE WHOLE CONTENT, ALWAYS (E97 fix; the owner's "zawsze wyswietlaly cala swoja zawartosc"): the head's parts wrap
       onto a second line rather than cut the kind, the name is whole, and the node's own words (a schema node's note, a
       Remnant's or a slot's description) stand under it whole. The button opens its fields (`aria-expanded`). */
    // its tooltip only on the Map (`editable`): the Class Trial console draws the same face read only, a press opening nothing
    return `<button type="button" class="${cls.join(" ")}" data-drpg-node="${esc(node.id)}"${typed.attr} style="left: ${p.x}px; top: ${p.y}px"`
        + `${selected ? ` aria-current="true"` : ""} aria-expanded="${selected ? "true" : "false"}" aria-label="${esc(said)}"${editable ? tipAttr("DRPG.Tips.Case.nodeOnTheMapTooltip") : ""}>`
        + nodeHeadHtml(node, { state, reach, warn })
        + `<span class="drpg-case-node-name">${esc(name)}</span>`
        + (text ? `<span class="drpg-case-node-text">${esc(text)}</span>` : "") + `</button>`;
}

/**
 * A NODE'S HEAD: its kind, its trial mode, its state, a warning and its reach, on one line that wraps (E97 fix). The
 * face's first line, and since owner-116 (15.11.2026; the owner's option A: every node open) the first line of an open
 * node's fields too, where the face that carried them is hidden: a deduction's fields hold its name, note and mode, a
 * Remnant's its name and words, and none of them says the node's kind, whether the class holds it or how many of its
 * inputs are held.
 */
export function nodeHeadHtml(node, { state, reach = null, warn = false } = {}) {
    const kind = kindLabel(node);
    const stateText = STATE_KEYS[state] ? L(STATE_KEYS[state]) : "";
    const r = reachOf(node, reach);
    const reachText = r ? F(r.reachable ? "DRPG.CaseMap.reachYes" : "DRPG.CaseMap.reachNo", { held: r.held, of: r.of }) : "";
    const mode = !node.evidence && node.mode ? `<span class="drpg-case-node-mode">${esc(modeLabel(node.mode))}</span>` : "";
    return `<span class="drpg-case-node-head"><span class="drpg-case-node-kind">${esc(kind)}</span>${mode}`
        + (STATE_GLYPHS[state] ? `<span class="drpg-case-node-state">${glyphHtml(STATE_GLYPHS[state])}<span>${esc(stateText)}</span></span>` : "")
        + (warn ? `<span class="drpg-case-node-warn" title="${esc(L("DRPG.CaseMap.hasProblem"))}">${glyphHtml("case-warn")}!</span>` : "")
        + (r ? `<span class="drpg-case-node-reach${r.reachable ? " is-reachable" : ""}" title="${esc(reachText)}">${glyphHtml("reachable")}${r.held}/${r.of}</span>` : "")
        + `</span>`;
}

/**
 * THE GRAPH ALONE (E99 draws it too): `graph` of case-schema.mjs `graphOf`, `layout` of case-layout.mjs `layoutCase`,
 * `finders` a Map of token id to the names holding a copy, `authors` a Map of node id to who left it (GMs only),
 * `selected` the open node's id, `fold` true to fold the unrelated evidence (its nodes and their space left out, the head
 * kept). `editors` (the Map's, optional) a Map of node id to the markup of its fields: each node's fields drawn in the
 * canvas under it (`nodeEditHtml`), the open node's shown and the rest `hidden`. `marks` the trial's marks by node id
 * (E99 C5: "presented", "hinted", "ticked"), `controls` the trial's controls by node id (E99 C5). The canvas carries what
 * case-view.mjs `relayoutCaseMap` needs to place the nodes again at their measured size (`data-drpg-place`); the viewport
 * (`.drpg-case-graph`) is the container's to size.
 */
export function caseGraphHtml({ graph, layout, finders = null, authors = null, selected = null, fold = false, label = "", reach = null, problems = [], editors = null, marks = {}, controls = null, allOpen = false } = {}) {
    /* EVERY NODE OPEN (owner-116, 15.11.2026; the owner: "W planerze niech od teraz widok edycji modułu będzie domyślnym
       widokiem modułu", option A): on the Map (`editors`) with `allOpen`, every node is drawn as its fields - each face
       hidden (`is-editing`), each fieldset shown, with the face's head on top and no Close - and the canvas says so
       (`data-drpg-all-open`, read by case-view.mjs `relayoutCaseMap` and `wireCaseMap`). Without it, one node opens at a
       time as before (the toolbar's "All open" off). The Class Trial console draws no editors and is not touched. */
    const open = Boolean(editors) && Boolean(allOpen);
    const warned = new Set((problems ?? []).map(p => p.node).filter(Boolean));
    const nodes = new Map((graph?.nodes ?? []).map(n => [n.id, n]));
    const unrelated = new Set(layout?.unrelated ?? []);
    const shown = fold && unrelated.size
        ? { ...layout, positions: Object.fromEntries(Object.entries(layout.positions).filter(([id]) => !unrelated.has(id))), unrelated: [...unrelated] }
        : layout;
    const place = mapPlace(shown, MAP_GEOMETRY, null, { edges: graph?.edges ?? [] });
    if (fold && unrelated.size) place.height = Math.max(place.height, (place.gapY ?? 0) + MAP_GEOMETRY.pitch);
    const heads = [];
    const cols = (layout?.columns ?? []).length;
    for (let c = 0; c < cols; c++) {
        const ids = layout.columns[c];
        const kinds = new Set(ids.map(id => nodes.get(id)?.kind));
        const key = c === 0 ? "DRPG.CaseMap.colEvidence" : kinds.size === 1 && kinds.has("solution") ? "DRPG.CaseMap.colSolution" : "DRPG.CaseMap.colDeductions";
        heads.push(`<span class="drpg-case-col-head" data-drpg-col-head="${c}" style="left: ${place.cols[c]?.x ?? MAP_GEOMETRY.pad + c * (MAP_GEOMETRY.nodeW + MAP_GEOMETRY.colGap)}px">${esc(L(key))}</span>`);
    }
    const shownEdges = (graph?.edges ?? []).filter(e => place.at[e.from] && place.at[e.to]);
    /* EACH EDGE OVER A HALO (1.2.119, "Czytelność strzałek"): the same path, wider and in the graph's ground
       (components.css), so a line keeps a margin from the column heads and the lines it crosses. The halos stand in one
       layer under every line (round 2): the square routes meet in trunks (case-view.mjs `routeEdges`), and a halo drawn
       between two lines cut a branch off its trunk where they join. A halo carries no `data-drpg-ends`, so case-view.mjs
       reads the edges alone (`relayoutCaseMap` routes it again with its edge, `lightEdges` lights it with its edge). */
    // a line in its source's colour (round 3): the source's type or kind class, as its band takes it
    const colourOf = e => { const n = nodes.get(e.from); return n ? typeAttrs(caseTypeOf(n), n).cls[0] ?? null : null; };
    const arrows = arrowDefs(shownEdges.map(colourOf));
    const routes = routeEdges(shownEdges, place.at, MAP_GEOMETRY);
    const halos = [], edges = [];
    for (const e of shownEdges) {
        const d = routes.get(`${e.from}>${e.to}`) ?? "";
        const colour = colourOf(e);
        const head = arrows.head(colour);
        halos.push(`<path class="drpg-case-edge-halo" data-drpg-halo="${esc(e.from)}>${esc(e.to)}" d="${d}"/>`);
        edges.push(`<path class="drpg-case-edge drpg-case-edge--${esc(e.kind)}${colour ? ` ${colour}` : ""}" data-drpg-edge="${esc(e.from)}>${esc(e.to)}" data-drpg-ends="${esc(JSON.stringify([e.from, e.to]))}"`
            + ` data-drpg-arrow="${head}" data-drpg-arrow-lit="${arrows.lit(colour)}" marker-end="url(#${head})" d="${d}"/>`);
    }
    const buttons = [], fields = [];
    for (const [id, p] of Object.entries(place.at)) {
        const node = nodes.get(id);
        if (!node) continue;
        const state = nodeState(node, finders);
        buttons.push(nodeButton(node, p, { state, selected: id === selected, loose: unrelated.has(id), author: authors?.get?.(id) ?? null,
            reach: reach?.[id] ?? null, warn: warned.has(id), marks: marks?.[id] ?? [], controlled: Boolean(controls?.[id]),
            // THE OPEN NODE IS ITS EDITOR (the owner at a real table, 12.11.2026): on the Map its face is hidden while open
            // (`is-editing`, components.css) and its fields take its place (`nodeEditHtml`).
            editing: Boolean(editors) && (open || id === selected), editable: Boolean(editors) }));
        if (editors) fields.push(nodeEditHtml({ graph, node, p, open: open || id === selected, allOpen: open, state, finders, authors, reach, problems, warn: warned.has(id), html: editors.get?.(id) ?? "" }));
    }
    /* THE TRIAL'S CONTROLS ON THE TILE (E99 C5, round 4; the owner's 12:00: "jako przycisk na kaflu"): `controls` by node
       id - `{ tick: bool, start: { action, mode, label, disabled, reason } }`. Each is a sibling of the node's button (a
       button inside a button is not valid markup) drawn inside the tile's box, in the right-hand gutter the tile keeps
       for them (`has-controls`), so no word of the node is covered: the tick, pressed or not, named by the node, at the
       top; the start, named by its mode, under it. Placed again on the measured tile by `placeTileControls`. Neither
       carries `data-drpg-node`: case-view.mjs `relayoutCaseMap` measures every child button that does as a node. */
    const controlled = [];
    for (const [id, c] of Object.entries(controls ?? {})) {
        const p = place.at[id];
        const node = nodes.get(id);
        if (!p || !node || !c) continue;
        const x = p.x + (p.w ?? MAP_GEOMETRY.nodeW) - TILE_GUTTER;
        const name = nameOf(node);
        if (c.tick !== undefined && c.tick !== null) {
            const said = F("DRPG.CaseTrial.tickLabel", { name });
            // the name in its accessible name; what a tick does in its tooltip (the title "Ticked: {name}" read the same either way)
            controlled.push(`<button type="button" class="drpg-case-node-tick" data-drpg-case-tick="${esc(id)}" aria-pressed="${c.tick ? "true" : "false"}"${tipAttr("DRPG.Tips.Case.onANodeTooltip")}`
                + ` style="left: ${x}px; top: ${p.y + 4}px" aria-label="${esc(said)}">&#10003;</button>`);
        }
        if (c.start?.action) {
            const said = F("DRPG.CaseTrial.startLabel", { mode: c.start.label, name });
            controlled.push(`<button type="button" class="drpg-case-node-start" data-drpg-case-start-node="${esc(id)}" data-drpg-case-start="${esc(c.start.action)}"`
                + ` data-drpg-mode="${esc(c.start.mode)}" style="left: ${x}px; top: ${p.y + 28}px" aria-label="${esc(said)}"`
                + ` title="${esc(c.start.disabled ? c.start.reason || said : said)}"${c.start.disabled ? " disabled" : ""}>&#9656;</button>`);
        }
    }
    // the fold's tooltip only on the Map (the trial console's press folds and unfolds as well since 1.2.122, untitled there)
    const gap = place.gapY === null ? "" : `<div class="drpg-case-gap" style="top: ${place.gapY}px; width: ${MAP_GEOMETRY.nodeW}px; left: ${MAP_GEOMETRY.pad}px">`
        + `<button type="button" class="drpg-case-fold" data-drpg-case-fold aria-expanded="${fold ? "false" : "true"}"${editors ? tipAttr("DRPG.Tips.Case.notTiedToTheTooltip") : ""}>${esc(F("DRPG.CaseMap.unrelated", { n: unrelated.size }))}</button></div>`;
    // the sort too (line P, 1.2.120): under every sort but "uncrossed" `mapPlace` keeps its order in every column, and the relayout must
    const data = JSON.stringify({ positions: shown?.positions ?? {}, gapAt: shown?.gapAt ?? null, unrelated: [...unrelated], fold: Boolean(fold && unrelated.size), sort: layout?.sort ?? null });
    const width = place.width;
    return `<div class="drpg-case-canvas" style="width: ${width}px; height: ${place.height}px" role="group" aria-label="${esc(label)}" data-drpg-place="${esc(data)}"${open ? ` data-drpg-all-open="1"` : ""}>`
        + heads.join("")
        + `<svg class="drpg-case-edges" width="${width}" height="${place.height}" aria-hidden="true" focusable="false">${arrows.defs}<g class="drpg-case-halos">${halos.join("")}</g><g class="drpg-case-lines">${edges.join("")}</g></svg>`
        + gap + buttons.join("") + fields.join("") + controlled.join("") + `</div>`;
}

/** One line of a node's facts: a label and its value, both text. */
const row = (label, value) => `<div class="drpg-case-info-row"><span class="drpg-case-info-label">${esc(label)}</span><span class="drpg-case-info-value">${esc(value)}</span></div>`;

/** A problem of `checkCase` as the GM reads it: its words, naming the node and what it names. */
export function problemText(p, graph) {
    const nameOfId = id => {
        const n = (graph?.nodes ?? []).find(x => x.id === id);
        return n ? nameOf(n) : String(id ?? "");
    };
    // an incomplete plan's field by its word (E104, `DRPG.CaseMap.needs`)
    const ref = p.code === "incomplete" ? L(`DRPG.CaseMap.needs.${p.ref}`)
        : p.code === "badMode" || p.code === "tooManyKeys" ? String(p.ref ?? "") : nameOfId(p.ref);
    return F(`DRPG.CaseMap.problem.${p.code}`, { node: nameOfId(p.node), ref });
}

/**
 * WHAT A NODE SAYS WHEN IT IS OPEN (the side panel's reading until the E97 fix, now on the node itself): its state, room,
 * who left it and who holds a copy, its trial mode and reach, "only the culprit", and each problem naming it. Text only.
 */
export function nodeInfoHtml({ graph, node, finders = null, authors = null, reach = null, problems = [], rows = true } = {}) {
    if (!node) return "";
    const r = reachOf(node, reach?.[node.id]);
    const ev = node.evidence ? reach?.[node.id] : null;
    const state = nodeState(node, finders);
    const names = node.evidence && !node.planned ? [...(finders?.get?.(tokenIdOf(node.trace)) ?? [])] : [];
    const lines = [];
    // `rows` false: the notes alone (an open node with fields of its own shows no read-only rows, the owner, 12.11.2026)
    if (rows) {
        if (STATE_KEYS[state]) lines.push(row(L("DRPG.CaseMap.panelState"), L(STATE_KEYS[state])));
        if (node.room) lines.push(row(L("DRPG.CaseMap.panelRoom"), node.room));
        if (node.evidence) lines.push(row(L("DRPG.CaseMap.panelAuthor"), authors?.get?.(node.id) || L("DRPG.Remnant.authorUnknown")));
        if (node.evidence && !node.planned) lines.push(row(L("DRPG.CaseMap.panelWhoHas"), names.length ? names.join(", ") : L("DRPG.CaseMap.nobodyYet")));
        if (!node.evidence && node.mode) lines.push(row(L("DRPG.CaseMap.panelMode"), modeLabel(node.mode)));
        if (r) lines.push(row(L("DRPG.CaseMap.panelReach"), F(r.reachable ? "DRPG.CaseMap.reachYes" : "DRPG.CaseMap.reachNo", { held: r.held, of: r.of })));
    }
    if (ev?.culpritOnly) lines.push(`<p class="drpg-case-info-note">${esc(L("DRPG.CaseMap.culpritOnly"))}</p>`);
    for (const p of (problems ?? []).filter(x => x.node === node.id)) lines.push(`<p class="drpg-case-info-note drpg-case-info-warn">${esc(problemText(p, graph))}</p>`);
    return lines.length ? `<div class="drpg-case-info">${lines.join("")}</div>` : "";
}

/**
 * A NODE'S FIELDS, IN THE NODE'S PLACE (E97 fix; the owner's "edycja ... na samych modulach"; until the fix in the side
 * panel, E97 C6). One fieldset per node, drawn in the canvas at its node's place and the open width - the open node's face
 * hidden (`is-editing`; the owner at a real table, 12.11.2026: "the editing part replaces the node entirely", no read-only
 * part above it; until then the fields stood under the face and opened with the node's facts): the node's own warnings,
 * the Table's own cells for it (`html`, built by investigation.mjs from the Table's functions, so each field keeps the
 * Table's name and the value it was drawn with), and its column's arrows. Every node's fields stay in the form, the open
 * one's shown and the rest `hidden` (a hidden field is still the form's: `readDashboardForm` reads what the GM changed,
 * by name, wherever it stands), so the Table's one Save writes a Map edit unchanged and a redraw carries a typed field by
 * its name (live.mjs). A node with no field of its own (another chapter's Remnant) shows its facts alone.
 */
function nodeEditHtml({ graph, node, p, open, allOpen = false, state = null, finders, authors, reach, problems, warn = false, html }) {
    const b = (step, key) => `<button type="button" data-drpg-case-move="${step}"${tipAttr("DRPG.Tips.Case.moveUpMoveDownTooltip")}>${esc(L(key))}</button>`;
    // Close beside the arrows: the face that closed the fields by a second click is hidden while they are open. With
    // every node open (owner-116) there is nothing to close to, so no Close; the face's head stands on top instead.
    const close = allOpen ? "" : `<button type="button" data-drpg-case-close${tipAttr("DRPG.Tips.Case.closeNodeTooltip")}>${esc(L("DRPG.Panel.close"))}</button>`;
    const head = allOpen ? nodeHeadHtml(node, { state: state ?? nodeState(node, finders), reach: reach?.[node.id] ?? null, warn }) : "";
    const moves = `<div class="drpg-case-edit-actions drpg-case-edit-moves">${b(-1, "DRPG.CaseMap.moveUp")}${b(1, "DRPG.CaseMap.moveDown")}${close}</div>`;
    const cells = String(html ?? "");
    // The node's facts only where it has no field of its own (another chapter's Remnant); otherwise its warnings alone
    const said = nodeInfoHtml({ graph, node, finders, authors, reach, problems, rows: !cells.trim() });
    // its type's or kind's colour on its fields too (1.2.119): with every node open, the fields are all of the node that shows
    const typed = typeAttrs(caseTypeOf(node), node);
    return `<fieldset class="${["drpg-case-edit", ...typed.cls].join(" ")}" data-drpg-edit="${esc(node.id)}"${typed.attr} aria-label="${esc(F("DRPG.CaseMap.editLabel", { name: nameOf(node) }))}"`
        // with every node open the fields are the node: they take the focus the hidden face cannot (owner-116, 16.11.2026)
        + ` style="left: ${p.x}px; top: ${p.y}px"${allOpen ? ` tabindex="0"` : ""}${open ? "" : " hidden"}>` + head + said + cells + moves + `</fieldset>`;
}

/**
 * THE CHAPTER'S OVERVIEW (the side panel's summary until the E97 fix): a strip over the graph, folded to one line by
 * default - the chapter, its counts and how many problems - and open, the Check consistency button, every problem in
 * words and `summary` (the chapter's own fields: who has what, the Key limit's override, the Final Truth Remnant form).
 * Not a node's, so on no node: the one block of the Map that is not, and it stands above the graph, not beside it.
 */
export function caseOverviewHtml({ graph, finders = null, problems = [], open = false, summary = "" } = {}) {
    const all = graph?.nodes ?? [];
    const evidence = all.filter(n => n.evidence);
    const counts = [
        [L("DRPG.CaseMap.sumEvidence"), evidence.length],
        [L("DRPG.CaseMap.sumTied"), evidence.filter(n => n.tied).length],
        [L("DRPG.CaseMap.sumHeld"), evidence.filter(n => nodeState(n, finders) === "held").length],
        [L("DRPG.CaseMap.sumDeductions"), all.filter(n => n.kind === "deduction").length],
        [L("DRPG.CaseMap.sumCounters"), all.filter(n => n.kind === "counter").length]
    ];
    const list = (problems ?? []).map(p => `<li>${esc(problemText(p, graph))}</li>`);
    const count = list.length ? F("DRPG.CaseMap.problemsFound", { n: list.length }) : L("DRPG.CaseMap.noProblems");
    const notes = [];
    if (!all.some(n => !n.evidence)) notes.push(`<p class="drpg-case-info-note">${esc(L("DRPG.CaseMap.noSchema"))}</p>`);
    notes.push(`<div class="drpg-case-check-head"><button type="button" data-drpg-case-check${tipAttr("DRPG.Tips.Case.checkConsistencyTooltip")}>${esc(L("DRPG.CaseMap.checkCase"))}</button>`
        + `<span class="drpg-case-check-count">${esc(count)}</span></div>`);
    if (list.length) notes.push(`<ul class="drpg-case-problems">${list.join("")}</ul>`);
    return `<details class="drpg-case-overview" data-drpg-case-overview${open ? " open" : ""}>`
        + `<summary${tipAttr("DRPG.Tips.Sweep.Case.overviewFoldTooltip")}><strong>${esc(F("DRPG.CaseMap.summaryTitle", { chapter: graph?.chapter ?? "-" }))}</strong>`
        + counts.map(([label, n]) => `<span class="drpg-case-count">${esc(label)}: ${n}</span>`).join("")
        + `<span class="drpg-case-count${list.length ? " has-warn" : ""}">${esc(count)}</span></summary>`
        + `<div class="drpg-case-overview-body">${notes.join("")}${summary ? `<fieldset class="drpg-case-edit-summary">${summary}</fieldset>` : ""}</div></details>`;
}

/**
 * THE MAP VIEW, WHOLE (E97 fix: no side panel): the map's tools (`tools`), the chapter's overview, and the graph's
 * viewport with the camera's buttons in its corner, one under another in the view's box. `reading` is what the window's
 * closure holds (`node` the open node's id, `fold`, `overview` the overview open, `camera`); the rest is read off the
 * world by the caller.
 */
export function caseMapHtml({ graph, layout, finders = null, authors = null, reading = {}, editors = null, summary = "", tools = "", reach = null, problems = [] } = {}) {
    const picked = reading.node && (graph?.nodes ?? []).find(n => n.id === reading.node) || null;
    const label = F("DRPG.CaseMap.graphLabel", { chapter: graph?.chapter ?? "-" });
    return `<div class="drpg-case-map">${tools}`
        + caseOverviewHtml({ graph, finders, problems, open: Boolean(reading.overview), summary })
        + `<div class="drpg-case-graph" tabindex="-1">${caseGraphHtml({ graph, layout, finders, authors, selected: picked?.id ?? null, fold: Boolean(reading.fold), label, reach, problems,
            editors: editors ?? new Map(), allOpen: reading.allOpen === true })}</div>${cameraHtml(reading.camera?.z ?? 1, caseLegendHtml(graph))}`
        + `</div>`;
}

/** One field of a node's editor: its column's words over the Table's own cell. */
export function editRow(label, cell) {
    /* THE LABEL IS A <span>, SO IT NAMES NOTHING (12.11.2026, CI run 43144994202, suite 3/8: the schema editor's
       Name, Note and Trial mode fields, "3 control kinds carry no name a screen reader can read"). A cell of one field
       with no name of its own takes the row's label as its aria-label; a field that has one, a checkbox inside its
       own <label>, and a cell of several fields stay as they are (R3659). */
    const html = String(cell ?? "");
    const fields = html.match(/<(?:input|select|textarea)\b[^>]*>/g) ?? [];
    const one = fields.length === 1 ? fields[0] : "";
    const bare = one && !/\saria-label(?:ledby)?=/.test(one) && !/\stype="(?:checkbox|radio|hidden)"/.test(one);
    const named = bare ? html.replace(/<(input|select|textarea)\b/, `<$1 aria-label="${esc(label)}"`) : html;
    return `<div class="drpg-case-edit-row"><span class="drpg-case-edit-label">${esc(label)}</span><div class="drpg-case-edit-field">${named}</div></div>`;
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
 * THE MAP'S TOOLS, ONE ROW OVER THE GRAPH (E97 C6, out of the side panel by the E97 fix): add a deduction, a counter,
 * the solution or a plan (a Remnant, a Final Truth or a Truth Bullet, E104), and the column order (case-layout.mjs LAYOUT_SORTS). Written at once to the GMs'
 * store, never through Save, as a GM's arrangement of the map. A node's own arrows (up and down its column) and Remove
 * are on the node, with its fields; the camera's buttons in the graph's corner (`cameraHtml`).
 */
export function caseToolsHtml({ sort = "kind", sorts = [], allOpen = null } = {}) {
    /* THE "ALL OPEN" SWITCH (owner-116, 15.11.2026; the owner's option A): pressed, every node is drawn as its fields;
       off, one node opens at a time. Drawn where the caller hands a state (the Map's window), never otherwise. */
    const view = allOpen === null ? "" : `<button type="button" class="drpg-case-view-switch" data-drpg-case-view aria-pressed="${allOpen ? "true" : "false"}"${
        tipAttr("DRPG.Tips.Case.allOpenTooltip")}>${esc(L("DRPG.CaseMap.allOpen"))}</button>`;
    const b = (attr, value, key, extra = "") => `<button type="button" ${attr}="${esc(value)}"${tipAttr("DRPG.Tips.Case.addDeductionCounterSolutionTooltip")}${extra}>${esc(L(key))}</button>`;
    return `<div class="drpg-case-tools" role="toolbar" aria-label="${esc(L("DRPG.CaseMap.toolsLabel"))}">`
        + `<div class="drpg-case-tools-row">${b("data-drpg-case-add", "deduction", "DRPG.CaseMap.addDeduction")}${b("data-drpg-case-add", "counter", "DRPG.CaseMap.addCounter")}`
        + `${b("data-drpg-case-add", "solution", "DRPG.CaseMap.addSolution")}`
        /* THE PLANS IN ONE SELECT (E104): a planned Remnant, Final Truth or Truth Bullet. As three buttons the row went to two
           lines and took the graph's viewport from 297 to 226 px under the glass and from 319 to 273 under Legacy at
           1366x768 (audit/case-map-sweep.mjs, investigation--map-planned, Polish and English alike); a pick adds that
           plan and the select goes back to its first line */
        + `<select class="drpg-case-add-plan" data-drpg-case-add-plan aria-label="${esc(L("DRPG.CaseMap.addPlan"))}" title="${esc(L("DRPG.CaseMap.addPlan"))}">`
        + `<option value="" selected>${esc(L("DRPG.CaseMap.addPlan"))}</option>`
        + ["incident", "final", "bullet"].map(k => `<option value="${k}">${esc(L(`DRPG.CaseMap.plan.${k}`))}</option>`).join("")
        + `</select></div>`
        /* the order's picker named by `aria-label` and its title, not a visible label: with one, the row was 1005 px under
           the glass at 1366x768, over the 972 px it has, and took a second row from the graph (the E97 fix's sweep) */
        + `<select class="drpg-case-sort" data-drpg-case-sort aria-label="${esc(L("DRPG.CaseMap.sortLabel"))}" title="${esc(L("DRPG.CaseMap.sortLabel"))}">`
        + sorts.map(k => `<option value="${esc(k)}"${k === sort ? " selected" : ""}>${esc(L(`DRPG.CaseMap.sort.${k}`))}</option>`).join("")
        + `</select>${view}</div>`;
}

/**
 * THE CAMERA'S BUTTONS (E97 fix), over the graph's bottom right corner, so the tools above keep one row at 1366x768: zoom
 * out, the zoom read out, zoom in, fit the case to the view. This window's alone; nothing is written.
 */
export function cameraHtml(zoom = 1, legend = "") {
    const cam = (what, text, key) => `<button type="button" class="drpg-case-cam" data-drpg-case-camera="${what}" aria-label="${esc(L(key))}" title="${esc(L(key))}">${esc(text)}</button>`;
    // the Map's legend at the strip's left (1.2.119, `caseLegendHtml`); the Class Trial console hands none
    return `<div class="drpg-case-camera${legend ? " has-legend" : ""}" role="group" aria-label="${esc(L("DRPG.CaseMap.cameraLabel"))}">${legend}`
        + cam("out", "-", "DRPG.CaseMap.zoomOut")
        + `<output class="drpg-case-zoom" data-drpg-case-zoom-level aria-label="${esc(L("DRPG.CaseMap.zoomLevel"))}">${Math.round(clampZoomOf(zoom) * 100)}%</output>`
        + cam("in", "+", "DRPG.CaseMap.zoomIn")
        + `<button type="button" class="drpg-case-cam" data-drpg-case-camera="fit"${tipAttr("DRPG.Tips.Sweep.Case.fitViewTooltip")}>${esc(L("DRPG.CaseMap.zoomFit"))}</button></div>`;
}

const clampZoomOf = z => Math.min(CAMERA_LIMITS.max, Math.max(CAMERA_LIMITS.min, Number(z) || 1));

/** Motion reduced on this browser: the module's class (the client setting or the system's, motion.mjs) or the system's
 *  own query where the class is not stamped yet. */
function motionStill() {
    try {
        return document.body.classList.contains("drpg-reduced-motion") || Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
    } catch {
        return false;
    }
}

/**
 * Wire the map inside `root`. The tools: `onAdd(kind)`, `onSort(sort)`; the camera's buttons, in their strip under the graph. The overview: its Check
 * consistency (`onCheck`), its fold (`onOverview(open)`). The graph: a node's face opens or shuts its fields (`onPick(id)`),
 * Escape on an open node or a click on empty space shuts them (`onClose(id)`; a drag is no click), the fold folds
 * (`onFold`), the arrows walk the nodes; an open node's buttons - up and down its column (`onMove(id, step)`), Remove
 * (`onDrop(id)`), Place on the map (`onPlace(ref)`). The camera keeps its state through `camera.get` and `camera.set`.
 * Every node is measured and placed at its whole content first (case-view.mjs `relayoutCaseMap`), again when the fonts
 * have loaded and whenever a node's box changes size. Answers the camera's handle.
 */
export function wireCaseMap(root, { onPick = () => {}, onClose = () => {}, onFold = () => {}, onAdd = () => {}, onSort = () => {}, onMove = () => {}, onDrop = () => {},
    onCheck = () => {}, onPlace = () => {}, onOverview = () => {}, onView = () => {}, camera: keep = {} } = {}) {
    const graph = root?.querySelector?.(".drpg-case-graph");
    const canvas = graph?.querySelector?.(":scope > .drpg-case-canvas") ?? null;
    const readout = () => root?.querySelector?.("[data-drpg-case-zoom-level]");
    const camera = wireCaseCamera(graph, { get: keep.get ?? (() => null), set: keep.set ?? (() => {}), still: motionStill,
        onZoom: cam => { const out = readout(); if (out) out.textContent = `${Math.round(cam.z * 100)}%`; } });
    const tools = root?.querySelector?.(".drpg-case-tools");
    if (tools && !tools.dataset.drpgWired) {
        tools.dataset.drpgWired = "1";
        tools.addEventListener("click", event => {
            const add = event.target?.closest?.("[data-drpg-case-add]");
            if (add) onAdd(add.dataset.drpgCaseAdd);
            // the "All open" switch (owner-116): the state it asks for, the opposite of what it shows
            const view = event.target?.closest?.("[data-drpg-case-view]");
            if (view) onView(view.getAttribute("aria-pressed") !== "true");
        });
        tools.querySelector("[data-drpg-case-sort]")?.addEventListener("change", event => onSort(event.target.value));
        tools.querySelector("[data-drpg-case-add-plan]")?.addEventListener("change", event => {
            const kind = event.target.value;
            event.target.value = "";
            if (kind) onAdd(kind);
        });
    }
    const overview = root?.querySelector?.("[data-drpg-case-overview]");
    if (overview && !overview.dataset.drpgWired) {
        overview.dataset.drpgWired = "1";
        overview.addEventListener("click", event => { if (event.target?.closest?.("[data-drpg-case-check]")) onCheck(); });
        overview.addEventListener("toggle", () => onOverview(Boolean(overview.open)));
    }
    /* THE CAMERA'S BAR IN A STRIP OF ITS OWN, under the graph and outside its viewport (E99 round 5, 12.11.2026: over the
       graph's corner it lay over a node - the owner's round-4 shot, "- 100% + / Dopasuj do widoku" over "Wniosek / Nonstop
       Debate" at 1366x768 - and Fit to view fills the viewport edge to edge, so no place inside it is free of nodes). */
    const bar = graph?.nextElementSibling?.matches?.(".drpg-case-camera") ? graph.nextElementSibling : null;
    if (bar && !bar.dataset.drpgWired) {
        bar.dataset.drpgWired = "1";
        bar.addEventListener("click", event => {
            const cam = event.target?.closest?.("[data-drpg-case-camera]")?.dataset.drpgCaseCamera;
            if (cam === "in") camera.zoomBy(CAMERA_LIMITS.step, undefined, undefined, { ease: true });
            else if (cam === "out") camera.zoomBy(1 / CAMERA_LIMITS.step, undefined, undefined, { ease: true });
            else if (cam === "fit") camera.fit();
        });
    }
    // with every node open (owner-116) no node is "the open one": nothing to shut by Escape or a click outside, nothing to reveal
    const allOpen = () => graph?.querySelector?.(":scope > .drpg-case-canvas")?.dataset.drpgAllOpen === "1";
    const openId = () => (allOpen() ? null : graph?.querySelector?.(":scope > .drpg-case-canvas > .drpg-case-edit[data-drpg-edit]:not([hidden])")?.dataset.drpgEdit ?? null);
    if (graph && !graph.dataset.drpgWired) {
        graph.dataset.drpgWired = "1";
        graph.addEventListener("click", event => {
            const t = event.target;
            if (t?.closest?.("[data-drpg-case-fold]")) { onFold(); return; }
            const edit = t?.closest?.(".drpg-case-edit[data-drpg-edit]");
            if (edit) {
                const id = edit.dataset.drpgEdit;
                if (t.closest("[data-drpg-case-close]")) { onClose(id); return; }
                const move = t.closest("[data-drpg-case-move]");
                if (move && !move.disabled) { onMove(id, Number(move.dataset.drpgCaseMove)); return; }
                const drop = t.closest("[data-drpg-case-drop]");
                if (drop) { onDrop(drop.dataset.drpgCaseDrop); return; }
                const place = t.closest("[data-drpg-case-place]");
                if (place) onPlace(place.dataset.drpgCasePlace);
                return;
            }
            const node = t?.closest?.("[data-drpg-node]");
            if (node && graph.contains(node)) { onPick(node.dataset.drpgNode); return; }
            // A CLICK OUTSIDE THE OPEN NODE, on the graph's empty space: its fields shut (a drag that panned is no click).
            const dragged = graph.dataset.drpgDragged === "1";
            graph.dataset.drpgDragged = "";
            const open = openId();
            if (open && !dragged) onClose(open);
        });
        graph.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                const open = openId();
                if (!open) return;
                // the window's own Escape closes the window: here it shuts the node's fields, and goes no further
                event.preventDefault();
                event.stopPropagation();
                onClose(open);
                return;
            }
            /* THE ARROWS WALK WHAT IS DRAWN (owner-116, 16.11.2026; the coordinator: "Focus must never land on something not
               drawn"): with every node open the faces are hidden, so an arrow on an open node's fields (the fieldset itself,
               never a field in it, whose arrows are the text's) moves the focus to the open node the faces' places put
               next; with one node open at a time the faces walk as before. */
            if (!/^Arrow/.test(event.key)) return;
            const fields = allOpen() && event.target?.matches?.(".drpg-case-edit[data-drpg-edit]") ? event.target : null;
            const node = fields ? null : event.target?.closest?.("[data-drpg-node]");
            if (!fields && !node) return;
            const points = [...graph.querySelectorAll("[data-drpg-node]")].map(b => ({
                id: b.dataset.drpgNode, x: parseFloat(b.style.left) || 0, y: parseFloat(b.style.top) || 0 }));
            const next = neighbourOf(points, fields ? fields.dataset.drpgEdit : node.dataset.drpgNode, event.key);
            if (!next) return;
            event.preventDefault();
            graph.querySelector(fields ? `.drpg-case-edit[data-drpg-edit="${CSS.escape(next)}"]` : `[data-drpg-node="${CSS.escape(next)}"]`)?.focus();
        });
    }
    /* A NODE'S ARROWS LIT (1.2.119, "Czytelność strzałek"; case-view.mjs `lightEdges`): the node under the pointer, else
       the one holding the focus - its face or anything in its fields - lights the edges it has at an end and the rest dim;
       off every node, and with the focus gone from the nodes, all are drawn alike again. Wired once per viewport, and it
       reads the canvas drawn now, so a redraw keeps it. */
    if (graph && !graph.dataset.drpgLitWired) {
        graph.dataset.drpgLitWired = "1";
        let hover = null, focus = null;
        const nodeOf = el => { const n = el?.closest?.("[data-drpg-node], .drpg-case-edit[data-drpg-edit]") ?? null; return n && graph.contains(n) ? n : null; };
        const idOf = el => { const n = nodeOf(el); return n ? (n.dataset.drpgNode ?? n.dataset.drpgEdit ?? null) : null; };
        const light = () => { const c = graph.querySelector(":scope > .drpg-case-canvas"); if (c) lightEdges(c, hover ?? focus); };
        graph.addEventListener("pointerover", event => { const id = idOf(event.target); if (id !== hover) { hover = id; light(); } });
        graph.addEventListener("pointerleave", () => { if (hover !== null) { hover = null; light(); } });
        graph.addEventListener("focusin", event => { focus = idOf(event.target); light(); });
        graph.addEventListener("focusout", event => { focus = idOf(event.relatedTarget); light(); });
    }
    if (canvas) {
        relayoutCaseMap(canvas);
        camera.apply(keep.get?.() ?? { x: 0, y: 0, z: 1 });
        const open = openId();
        if (open) camera.reveal([canvas.querySelector(`[data-drpg-node="${CSS.escape(open)}"]`), canvas.querySelector(`.drpg-case-edit[data-drpg-edit="${CSS.escape(open)}"]`)]);
        const again = () => { if (canvas.isConnected) relayoutCaseMap(canvas); };
        document.fonts?.ready?.then?.(again, () => {});
        if (typeof ResizeObserver === "function") {
            const watch = new ResizeObserver(() => { if (!canvas.isConnected) { watch.disconnect(); return; } again(); });
            for (const el of canvas.querySelectorAll(":scope > button[data-drpg-node], :scope > .drpg-case-edit:not([hidden])")) watch.observe(el);
        }
    }
    return camera;
}

