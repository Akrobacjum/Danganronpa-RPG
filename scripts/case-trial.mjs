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
function tickRow(node, { ticked, hinted, floorOpen }) {
    const name = node.label || node.name || L("DRPG.CaseMap.noName");
    const start = node.mode ? MODE_STARTS[node.mode] : null;
    const button = start?.action
        ? `<button type="button" class="drpg-case-trial-start" data-drpg-node="${esc(node.id)}" data-drpg-case-start="${esc(start.action)}" data-drpg-mode="${esc(node.mode)}"`
            + `${floorOpen ? ` disabled title="${esc(L("DRPG.CaseTrial.floorOpen"))}"` : ""}>${esc(modeLabel(node.mode))}</button>`
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
export function trialSchemaHtml({ graph, layout, ticks = {}, presented = [], hints = [], unknown = 0, floorOpen = false } = {}) {
    const nodes = graph?.nodes ?? [];
    if (!nodes.length) return `<p class="notes">${esc(L("DRPG.CaseTrial.empty"))}</p>`;
    const hinted = new Set(hints);
    const marks = {};
    for (const id of presented) marks[id] = ["presented"];
    for (const id of hints) marks[id] = [...(marks[id] ?? []), "hinted"];
    for (const [id, on] of Object.entries(ticks ?? {})) if (on === true) marks[id] = [...(marks[id] ?? []), "ticked"];
    const rows = nodes.filter(n => !n.evidence).map(n => tickRow(n, { ticked: ticks?.[n.id] === true, hinted: hinted.has(n.id), floorOpen })).join("");
    return `<div class="drpg-case-trial">`
        + `<div class="drpg-case-graph">${caseGraphHtml({ graph, layout, fold: true, marks, label: L("DRPG.CaseTrial.title") })}</div>`
        + `<div class="drpg-case-trial-side"><p class="notes">${esc(L("DRPG.CaseTrial.intro"))}</p>`
        + (unknown > 0 ? `<p class="notes" data-drpg-case-unknown>${esc(plural("DRPG.CaseTrial.unknown", { n: unknown }))}</p>` : "")
        + `<ul class="drpg-case-trial-rows">${rows}</ul></div></div>`;
}

/** What the window draws now (a GM's read): the chapter's graph, its ticks, the presentations' marks and hints. */
export function trialSchemaState(chapter = getClock().chapter) {
    const graph = caseGraph(chapter);
    const ticks = caseTicks(chapter);
    // The culprit the hints leave out, as the Map's reach does (investigation.mjs `caseCulprit`).
    const culpritId = caseCulprit(chapter);
    const { presented, hints, unknown } = presentationHints(graph, casePresentations(chapter), { culpritId, ticks });
    return { graph, layout: layoutCase(graph, { sort: graph.meta?.sort, manual: graph.meta?.manual }), ticks, presented, hints, unknown, floorOpen: Boolean(trialFloor()) };
}

/** A tick from the window (any GM; Q-E99-8): answers the store's row, or null on a player. */
export async function tickFromSchema(chapter, nodeId, ticked) {
    if (!game.user?.isGM) return null;
    return setCaseTick(chapter, nodeId, Boolean(ticked));
}

/** THE WINDOW (C5): one at a time, a GM's; redrawn when the schema, the ticks, the floor or a Present card change. */
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
        render: (event, dialog) => {
            const wire = () => {
                for (const box of dialog.element?.querySelectorAll("input[data-drpg-case-tick]") ?? []) {
                    box.addEventListener("change", () => {
                        tickFromSchema(chapter, box.dataset.drpgCaseTick, box.checked).catch(err => error("The tick was not written", err));
                    });
                }
                for (const button of dialog.element?.querySelectorAll("[data-drpg-case-start]") ?? []) {
                    button.addEventListener("click", async () => {
                        const { startTrialMode } = await import("./trial-floor-ui.mjs");
                        await startTrialMode(button.dataset.drpgCaseStart).catch(err => error("The trial mode did not start", err));
                    });
                }
            };
            wire();
            live = keepLive(dialog, {
                region: ".drpg-case-trial-live",
                build: () => trialSchemaHtml(trialSchemaState(chapter)),
                watch: { items: true, settings: [SETTINGS.trialQueue, SETTINGS.clock, SETTINGS.murderState], stores: [caseTickStore, caseSchemaStore, keyPlanStore, blackenedStore], hooks: ["createChatMessage", "updateChatMessage", "deleteChatMessage"] },
                after: wire
            });
        },
        rejectClose: false
    }).finally(() => live?.stop?.());
}
