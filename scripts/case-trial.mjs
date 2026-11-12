/**
 * THE CASE SCHEMA AT THE TRIAL (E99 C5, C4; 12.11.2026; the owner's goal for E99: "at the trial the GM opens Case schema
 * from the console: the schema with check boxes on conclusions, counters and the solution, and the trial's minigames
 * started from their nodes"; the owner's 11.11: "always the graph", whatever the Investigation toggle says).
 *
 * A WINDOW OF ITS OWN, NOT YET THE CONSOLE'S MIDDLE (Q-E99-1's default puts the schema in the console's middle and this
 * same schema in a larger window from the frame's button). The console's body is redrawn by its live region every
 * second and its rebuild is E73's; this stage builds the window, the console's button that opens it, and everything the
 * middle will draw - the graph, the ticks, the marks and the starts - so that placing it there is one call. A deviation
 * from the default, written in docs/dev/e99/STATUS.md for the owner.
 *
 * WHAT IT DRAWS. The graph read-only (case-map.mjs `caseGraphHtml`, the Map's own drawing, the unrelated evidence
 * folded), each presented Remnant and each hinted conclusion marked (case-hints.mjs; a hint is never a tick), and
 * beside it one row per deduction, counter and solution: its tick box (C3's store, any GM, Q-E99-8) and, where its
 * trial mode has a start in trial-floor.mjs `MODE_STARTS`, that start's button, greyed with the console's reason while a
 * floor is open (the console offers no start then either). A mode a player raises (an Objection, a Rebuttal) has none.
 */
import { esc, error, plural } from "./utils.mjs";
import { drpgWindow } from "./ui-kit.mjs";
import { alreadyOpen, keepLive, RAISED } from "./live.mjs";
import { getClock } from "./clock.mjs";
import { caseGraphHtml, kindLabel, modeLabel } from "./case-map.mjs";
import { layoutCase } from "./case-layout.mjs";
import { caseGraph, caseTicks, setCaseTick } from "./case-schema.mjs";
import { presentationHints, casePresentations } from "./case-hints.mjs";
import { MODE_STARTS, trialFloor } from "./trial-floor.mjs";
import { caseTickStore, caseSchemaStore, keyPlanStore, blackenedStore } from "./gm-stores.mjs";
import { SETTINGS } from "./settings.mjs";
import { WIDE } from "./ui-columns.mjs";
import { caseCulprit } from "./investigation.mjs";

const L = key => game.i18n.localize(key);
const WINDOW_CLASS = "drpg-window-case-trial";

/** One row beside the graph: the tick box and, where the node's mode has a start, its button. */
function tickRow(node, { ticked, hinted, floorOpen, noTrial = false }) {
    const name = node.label || node.name || L("DRPG.CaseMap.noName");
    const start = node.mode ? MODE_STARTS[node.mode] : null;
    const button = start?.action
        ? `<button type="button" class="drpg-case-trial-start" data-drpg-node="${esc(node.id)}" data-drpg-case-start="${esc(start.action)}" data-drpg-mode="${esc(node.mode)}"`
            + `${noTrial || floorOpen ? ` disabled title="${esc(L(noTrial ? "DRPG.CaseTrial.noTrial" : "DRPG.CaseTrial.floorOpen"))}"` : ""}>${esc(modeLabel(node.mode))}</button>`
        : "";
    return `<li class="drpg-case-trial-row${hinted ? " is-hinted" : ""}"><label class="drpg-case-trial-tick">`
        + `<input type="checkbox" data-drpg-case-tick="${esc(node.id)}"${ticked ? " checked" : ""}>`
        + `<span class="drpg-case-trial-kind">${esc(kindLabel(node))}</span><span class="drpg-case-trial-name">${esc(name)}</span></label>`
        + (hinted ? `<span class="drpg-case-trial-hint">${esc(L("DRPG.CaseTrial.hint"))}</span>` : "")
        + button + `</li>`;
}

/**
 * Pure over its state: `{ graph, layout, ticks, presented, hints, unknown, floorOpen }` (`trialSchemaState`). The
 * graph, then the rows; the unknown cards' line when any card named no Remnant of the schema.
 */
export function trialSchemaHtml({ graph, layout, ticks = {}, presented = [], hints = [], unknown = 0, floorOpen = false, noTrial = false, inConsole = false } = {}) {
    const nodes = graph?.nodes ?? [];
    if (!nodes.length) return `<p class="notes">${esc(L("DRPG.CaseTrial.empty"))}</p>`;
    const hinted = new Set(hints);
    const marks = {};
    for (const id of presented) marks[id] = ["presented"];
    for (const id of hints) marks[id] = [...(marks[id] ?? []), "hinted"];
    for (const [id, on] of Object.entries(ticks ?? {})) if (on === true) marks[id] = [...(marks[id] ?? []), "ticked"];
    const unknownLine = unknown > 0 ? `<p class="notes" data-drpg-case-unknown>${esc(plural("DRPG.CaseTrial.unknown", { n: unknown }))}</p>` : "";
    /* IN THE CONSOLE (E73's mockup B gives the schema the graph's height and no more): the boxes and the starts are the
       graph's own controls beside each node, and nothing is drawn under the graph; the unknown cards' line stands above
       it, inside the same box. The window keeps the list. */
    if (inConsole) {
        const controls = {};
        for (const n of nodes.filter(n => !n.evidence)) {
            const start = n.mode ? MODE_STARTS[n.mode] : null;
            controls[n.id] = { tick: ticks?.[n.id] === true,
                start: start?.action ? { action: start.action, mode: n.mode, label: modeLabel(n.mode), disabled: noTrial || floorOpen,
                    reason: noTrial ? L("DRPG.CaseTrial.noTrial") : floorOpen ? L("DRPG.CaseTrial.floorOpen") : "" } : null };
        }
        return `<div class="drpg-case-trial is-console"><div class="drpg-case-graph">${unknownLine}`
            + `${caseGraphHtml({ graph, layout, fold: true, marks, controls, label: L("DRPG.CaseTrial.title") })}</div></div>`;
    }
    const rows = nodes.filter(n => !n.evidence).map(n => tickRow(n, { ticked: ticks?.[n.id] === true, hinted: hinted.has(n.id), floorOpen, noTrial })).join("");
    return `<div class="drpg-case-trial">`
        + `<div class="drpg-case-graph">${caseGraphHtml({ graph, layout, fold: true, marks, label: L("DRPG.CaseTrial.title") })}</div>`
        + `<div class="drpg-case-trial-side"><p class="notes">${esc(L("DRPG.CaseTrial.intro"))}</p>`
        + unknownLine
        + `<ul class="drpg-case-trial-rows">${rows}</ul></div></div>`;
}

/** What the window draws now (a GM's read): the chapter's graph, its ticks, the presentations' marks and hints. */
export function trialSchemaState(chapter = getClock().chapter) {
    const graph = caseGraph(chapter);
    const ticks = caseTicks(chapter);
    // The culprit the hints leave out, as the Map's reach does (investigation.mjs `caseCulprit`).
    const culpritId = caseCulprit(chapter);
    const { presented, hints, unknown } = presentationHints(graph, casePresentations(chapter), { culpritId, ticks });
    return { graph, layout: layoutCase(graph, { sort: graph.meta?.sort, manual: graph.meta?.manual }), ticks, presented, hints, unknown, floorOpen: Boolean(trialFloor()),
        // No start outside a running Class Trial, as the console offers none then (trial-floor.mjs `readTrial`'s `running`)
        noTrial: getClock().phase !== "classTrial" };
}

/** A tick from the window (any GM; Q-E99-8): answers the store's row, or null on a player. */
export async function tickFromSchema(chapter, nodeId, ticked) {
    if (!game.user?.isGM) return null;
    return setCaseTick(chapter, nodeId, Boolean(ticked));
}

/**
 * THE HOOK IN THE TRIAL CONSOLE (E99 C5 placed, 12.11.2026; the owner's answer to Q-E99-1 as the coordinator relayed it:
 * the schema in the middle of the Class Trial screen, the trial's status on top and its management at the bottom). The
 * console draws one empty element with this attribute in its middle, outside its own live read-out (which redraws
 * every second while a floor runs), and calls `mountTrialSchema` on it at render. E73's console (mockup B) keeps the
 * same hook; the window below stays as a second way to the same schema.
 */
export const TRIAL_SCHEMA_SLOT = "[data-drpg-trial-schema]";

/* The schema's region in `dialog` kept live on its own watches, its boxes and starts wired; answers the stop. */
function liveSchema(dialog, chapter, { inConsole = false } = {}) {
    const regionOf = () => dialog.element?.querySelector(".drpg-case-trial-live");
    const wire = () => {
        const region = regionOf();
        for (const box of region?.querySelectorAll("input[data-drpg-case-tick]") ?? []) {
            box.addEventListener("change", () => {
                tickFromSchema(chapter, box.dataset.drpgCaseTick, box.checked).catch(err => error("The tick was not written", err));
            });
        }
        for (const button of region?.querySelectorAll("[data-drpg-case-start]") ?? []) {
            button.addEventListener("click", async () => {
                const { startTrialMode } = await import("./trial-floor-ui.mjs");
                await startTrialMode(button.dataset.drpgCaseStart).catch(err => error("The trial mode did not start", err));
            });
        }
    };
    wire();
    return keepLive(dialog, {
        region: ".drpg-case-trial-live",
        build: () => trialSchemaHtml({ ...trialSchemaState(chapter), inConsole }),
        watch: { items: true, settings: [SETTINGS.trialQueue, SETTINGS.clock, SETTINGS.murderState], stores: [caseTickStore, caseSchemaStore, keyPlanStore, blackenedStore], hooks: ["createChatMessage", "updateChatMessage", "deleteChatMessage"] },
        after: wire
    });
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
    slot.innerHTML = `<div class="drpg-case-trial-live">${trialSchemaHtml({ ...trialSchemaState(chapter), inConsole: true })}</div>`;
    return liveSchema(dialog, chapter, { inConsole: true });
}

/** THE WINDOW (C5; the second way since the console holds the schema): one at a time, a GM's. */
export async function openTrialSchema() {
    if (!game.user?.isGM) return null;
    if (alreadyOpen(WINDOW_CLASS)) return RAISED;
    let live = null;
    const chapter = getClock().chapter;
    return drpgWindow({
        title: L("DRPG.CaseTrial.title"),
        classes: ["drpg-panel", WINDOW_CLASS],
        width: WIDE.width,
        body: `<div class="drpg-case-trial-live">${trialSchemaHtml(trialSchemaState(chapter))}</div>`,
        footer: { close: { role: "close", action: "close" } },
        render: (event, dialog) => { live = liveSchema(dialog, chapter); },
        rejectClose: false
    }).finally(() => live?.stop?.());
}
