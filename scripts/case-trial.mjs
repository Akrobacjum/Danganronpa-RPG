/**
 * THE CASE SCHEMA AT THE TRIAL (E99 C5, C4; 12.11.2026; the owner's goal for E99: "at the trial the GM opens Case schema
 * from the console: the schema with check boxes on conclusions, counters and the solution, and the trial's minigames
 * started from their nodes"; the owner's 11.11: "always the graph", whatever the Investigation toggle says).
 *
 * IN THE CONSOLE, NOT A WINDOW (the owner, 12.11.2026 13:15, via the coordinator: "Chce zeby konsola rozprawy wygladala
 * tak, bez przycisku schemat sprawy. Schemat sprawy wstawic w pustej czesci okna po prawej"). The Class Trial console
 * (E73's mockup B) draws an empty slot outside its live read-out; `mountTrialSchema` fills it, before a trial and while
 * one runs, and keeps it live. The separate "Case schema" window and its footer button, C5's first shape, are gone.
 *
 * WHAT IT DRAWS. The graph read-only (case-map.mjs `caseGraphHtml`, the Map's own drawing, its nodes whole, the unrelated
 * evidence folded, the Map's camera), each presented Remnant and each hinted conclusion marked (case-hints.mjs; a hint
 * is never a tick). While a Class Trial runs, each deduction, counter and solution carries on its tile its tick (C3's
 * store, any GM, Q-E99-8) and, where its trial mode has a start in trial-floor.mjs `MODE_STARTS`, that start, greyed by
 * the console's mode picker's rule (since 1.2.122, CTRL-45): a mode other than the open debate holding the floor greys
 * every start, and an open debate greys only the debate's own - the picker and the primary's machine start a round, the
 * Closing or a zone mode over an open debate. A mode a player raises (an Objection, a Rebuttal) has none. Before a trial, the schema alone (the owner, 12.11 ~12:00).
 */
import { esc, error, plural } from "./utils.mjs";
import { keepLive } from "./live.mjs";
import { getClock } from "./clock.mjs";
import { caseGraphHtml, modeLabel, cameraHtml, wireCaseMap, placeTileControls } from "./case-map.mjs";
import { layoutCase } from "./case-layout.mjs";
import { caseGraph, caseTicks, setCaseTick } from "./case-schema.mjs";
import { presentationHints, casePresentations } from "./case-hints.mjs";
import { MODE_STARTS, trialFloor } from "./trial-floor.mjs";
import { caseTickStore, caseSchemaStore, keyPlanStore, blackenedStore, remnantStore } from "./gm-stores.mjs";
import { SETTINGS } from "./settings.mjs";
import { caseCulprit } from "./investigation.mjs";

const L = key => game.i18n.localize(key);

/**
 * Pure over its state: `{ graph, layout, ticks, presented, hints, unknown, floorOpen, noTrial }` (`trialSchemaState`)
 * and the mount's kept `camera`, for the zoom's readout. The Map's graph, its nodes whole and its camera (case-map.mjs,
 * case-view.mjs), read only, filling the slot's box (E73's mockup B gives the schema that box and no more); while a Class
 * Trial runs each deduction, counter and solution carries its tick - a button on its tile - and its mode's start; before
 * a trial, the schema alone. The unknown cards' line stands over the graph and the camera's bar in a strip under it
 * (round 5: over the graph it lay over a node).
 */
export function trialSchemaHtml({ graph, layout, ticks = {}, presented = [], hints = [], unknown = 0, floorOpen = false, floorMode = null, noTrial = false, camera = null, fold = true } = {}) {
    const nodes = graph?.nodes ?? [];
    if (!nodes.length) return `<p class="notes">${esc(L("DRPG.CaseTrial.empty"))}</p>`;
    const marks = {};
    for (const id of presented) marks[id] = ["presented"];
    for (const id of hints) marks[id] = [...(marks[id] ?? []), "hinted"];
    for (const [id, on] of Object.entries(ticks ?? {})) if (on === true) marks[id] = [...(marks[id] ?? []), "ticked"];
    const unknownLine = unknown > 0 ? `<p class="notes" data-drpg-case-unknown>${esc(plural("DRPG.CaseTrial.unknown", { n: unknown }))}</p>` : "";
    const controls = noTrial ? null : {};
    // The picker's rule (trial-floor-ui.mjs `modePickerHtml`): over the open debate only the debate's own start is greyed.
    const overDebate = floorOpen && floorMode === "debate";
    const held = action => (action === "openDebate" ? floorOpen : floorOpen && !overDebate);
    for (const n of noTrial ? [] : nodes.filter(n => !n.evidence)) {
        const start = n.mode ? MODE_STARTS[n.mode] : null;
        controls[n.id] = { tick: ticks?.[n.id] === true,
            start: start?.action ? { action: start.action, mode: n.mode, label: modeLabel(n.mode), disabled: held(start.action),
                reason: !held(start.action) ? "" : overDebate ? L("DRPG.Floor.bar.inDebate") : L("DRPG.CaseTrial.floorOpen") } : null };
    }
    return `<div class="drpg-case-trial is-console">${unknownLine}<div class="drpg-case-graph" tabindex="-1">`
        // a node's press opens it on the Investigation's Map (`liveSchema`'s `onPick`), and its face says so (`opensMap`)
        + `${caseGraphHtml({ graph, layout, fold, marks, controls, label: L("DRPG.CaseTrial.title"), opensMap: true })}</div>${cameraHtml(camera?.z ?? 1)}</div>`;
}

/** What the console's schema draws now (a GM's read): the chapter's graph, its ticks, the presentations' marks and hints. */
export function trialSchemaState(chapter = getClock().chapter) {
    const graph = caseGraph(chapter);
    const ticks = caseTicks(chapter);
    // The culprit the hints leave out, as the Map's reach does (investigation.mjs `caseCulprit`).
    const culpritId = caseCulprit(chapter);
    const { presented, hints, unknown } = presentationHints(graph, casePresentations(chapter), { culpritId, ticks });
    return { graph, layout: layoutCase(graph, { sort: graph.meta?.sort, manual: graph.meta?.manual }), ticks, presented, hints, unknown, floorOpen: Boolean(trialFloor()),
        floorMode: trialFloor()?.mode ?? null,
        // No start outside a running Class Trial, as the console offers none then (trial-floor.mjs `readTrial`'s `running`)
        noTrial: getClock().phase !== "classTrial" };
}

/** A tick from a tile (any GM; Q-E99-8): answers the store's row, or null on a player. */
export async function tickFromSchema(chapter, nodeId, ticked) {
    if (!game.user?.isGM) return null;
    return setCaseTick(chapter, nodeId, Boolean(ticked));
}

/**
 * THE HOOK IN THE TRIAL CONSOLE (E99 C5 placed, 12.11.2026; the owner's answer to Q-E99-1 as the coordinator relayed it:
 * the schema in the middle of the Class Trial screen, the trial's status on top and its management at the bottom). The
 * console draws one empty element with this attribute in its middle, outside its own live read-out (which redraws
 * every second while a floor runs), and calls `mountTrialSchema` on it at render. E73's console (mockup B) keeps the
 * same hook, and since the owner's 13:15 it is the only way to the schema at the trial.
 */
const TRIAL_SCHEMA_SLOT = "[data-drpg-trial-schema]";

/*
 * The schema's region in `dialog` kept live on its own watches, answering the stop. Its graph is wired read only by the
 * Map's own code (case-map.mjs `wireCaseMap` with no editors: nodes measured whole, the camera; a click on a node opens
 * it on the Investigation's Map, `onPick` below, and its face's tooltip says so, `opensMap`), the trial's controls placed
 * on their tiles after each measure, a tick button toggling the GMs' tick and a start starting its mode. The camera is the mount's, kept across redraws.
 */
function liveSchema(dialog, chapter) {
    const regionOf = () => dialog.element?.querySelector(".drpg-case-trial-live");
    let camera = null;
    /* FOLDED UNTIL THE GM UNFOLDS IT (1.2.122; CTRL-02, STG-16): the schema opens with the evidence not tied to the murder
       folded, and "Not tied to the murder: N" unfolds it and folds it again, as on the Investigation's Map - it did
       nothing here, so a folded Remnant and a "presented" mark on one could not be seen in the console. */
    let folded = true;
    let live = null;
    const wire = () => {
        const region = regionOf();
        if (!region) return;
        wireCaseMap(region, { camera: { get: () => camera, set: cam => { camera = cam; } },
            onFold: () => { folded = !folded; live?.refresh?.(); },
            /* A NODE'S FACE OPENS IT ON THE MAP (1.2.122; probe-42's group C, 22 node buttons of the console's schema): the
               press ran the wiring's empty default, so a focusable button did nothing. The schema here is read-only, so
               the press opens the Investigation's Map on that node, where its fields are (raised, not reopened, when the
               Map already stands). */
            onPick: id => {
                import("./investigation.mjs").then(m => m.openInvestigationDashboard({ node: id, view: "map" }))
                    .catch(err => error("Could not open the node on the Map", err));
            } });
        const canvas = region.querySelector(".drpg-case-canvas");
        const place = () => { if (canvas?.isConnected) placeTileControls(canvas); };
        place();
        document.fonts?.ready?.then?.(place, () => {});
        if (canvas && typeof ResizeObserver === "function") {
            const watch = new ResizeObserver(() => { if (!canvas.isConnected) { watch.disconnect(); return; } requestAnimationFrame(place); });
            for (const el of canvas.querySelectorAll(":scope > button[data-drpg-node]")) watch.observe(el);
        }
        for (const button of region.querySelectorAll("button[data-drpg-case-tick]")) {
            button.addEventListener("click", () => {
                const next = button.getAttribute("aria-pressed") !== "true";
                tickFromSchema(chapter, button.dataset.drpgCaseTick, next).catch(err => error("The tick was not written", err));
            });
        }
        for (const button of region.querySelectorAll("[data-drpg-case-start]")) {
            button.addEventListener("click", async () => {
                await startFromNode(chapter, button.dataset.drpgCaseStartNode, button.dataset.drpgCaseStart, button.dataset.drpgMode ?? null)
                    .catch(err => error("The trial mode did not start", err));
            });
        }
    };
    wire();
    live = keepLive(dialog, {
        region: ".drpg-case-trial-live",
        // live.mjs replaces the region with what `build` returns, so it returns the region's own element: without it the
        // first redraw dropped `.drpg-case-trial-live`, and no later redraw found it (found by the round-4 sweep)
        build: () => `<div class="drpg-case-trial-live">${trialSchemaHtml({ ...trialSchemaState(chapter), camera, fold: folded })}</div>`,
        watch: { items: true, settings: [SETTINGS.trialQueue, SETTINGS.clock, SETTINGS.murderState, SETTINGS.trialProgress], stores: [caseTickStore, caseSchemaStore, keyPlanStore, blackenedStore, remnantStore],
            /* The trace ledger and a trace's token (1.2.122, REFR-69): a trace placed during the trial, or an unfound one
               renamed on its Remnant card, writes the ledger or a token alone, and the schema's node stood as drawn. A
               token's move is no event of the schema's, so only its making and its deleting are heard. */
            hooks: ["createChatMessage", "updateChatMessage", "deleteChatMessage", "createToken", "deleteToken"] },
        after: wire
    });
    return live;
}

/**
 * Fills the console's slot (TRIAL_SCHEMA_SLOT) with this chapter's schema and keeps it live: on a GM, once per slot.
 * Answers the stop, or null where there is nothing to fill. keepLive stops itself when the window closes.
 */
export function mountTrialSchema(dialog) {
    if (!game.user?.isGM) return null;
    const slot = dialog?.element?.querySelector(TRIAL_SCHEMA_SLOT);
    if (!slot || slot.dataset.drpgMounted) return null;
    slot.dataset.drpgMounted = "1";
    const chapter = getClock().chapter;
    slot.innerHTML = `<div class="drpg-case-trial-live">${trialSchemaHtml(trialSchemaState(chapter))}</div>`;
    return liveSchema(dialog, chapter);
}

/**
 * A NODE'S MODE STARTED FROM THE CONSOLE, ITS PLAN WITH IT (13.11.2026; case-schema.mjs ZONE_FIELDS): the node's planned
 * minigame - a question and two answers, a thesis, a Logic Dive's set - handed to the start, which opens the zones'
 * window filled in (trial-zones-ui.mjs `openZonePicker`); the GM still presses Start there. A mode with no window of
 * that kind starts as before.
 */
export async function startFromNode(chapter, nodeId, action, mode = null) {
    const { startTrialMode } = await import("./trial-floor-ui.mjs");
    const { caseRows, caseNodeOf } = await import("./case-schema.mjs");
    const node = caseNodeOf(caseRows(chapter).rows[nodeId]);
    const plan = node ? { question: node.zoneQuestion ?? "", a: node.zoneA ?? "", b: node.zoneB ?? "", thesis: node.zoneThesis ?? "", setId: node.diveSet ?? "" } : null;
    return startTrialMode(action, mode, { plan });
}
