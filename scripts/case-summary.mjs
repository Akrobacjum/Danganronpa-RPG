/**
 * THE CASE'S SUMMARY FOR THE PLAYERS (E99 C6, 12.11.2026; the owner's goal for E99: "after the verdict the players get a
 * summary ... only what was discovered (no undiscovered Remnants, Truth Bullets or conclusions), and the solution only
 * when the class voted right. The GM composes the summary and sends only what was discovered"; his C of 09.11; Q-E99-2,
 * -3, -4, -12's defaults).
 *
 * ONE PURE FUNCTION, AN ALLOWLIST. `composeCaseSummary` builds the payload a player's browser may receive from the GMs'
 * graph, and nothing else crosses: each piece of evidence ON THE SCHEMA (tied to the murder) that a student found, by its
 * public name and the words its players read; each deduction and counter the GMs ticked at the trial, by its name; the
 * solution, name and words, only when the class voted right (whole, Q-E99-4); the links among what is in it. No node id,
 * no author (E97 Q1), no real kind, no GM note on evidence, no count of what is not in it (Q-E99-12): each entry is an
 * index into the payload's own list. What the GMs typed on a ticked node's name is theirs and is sent as typed - the
 * preview is the GM's look at it (E99 C7); the module does not judge prose.
 */

/** The payload's roles, in the order its list holds them. */
export const SUMMARY_ROLES = Object.freeze(["evidence", "deduction", "counter", "solution"]);

/**
 * `graph` of case-schema.mjs `graphOf`; `ticks` node id -> true (case-schema.mjs `caseTicks`); `found` the evidence
 * node ids a student holds a copy of; `correct` the verdict's (verdict.mjs, `record.correct`). Answers
 * `{ chapter, correct, nodes: [{ role, name, text }], links: [{ from, to, kind }] }`.
 */
export function composeCaseSummary({ graph, ticks = {}, found = [], correct = false } = {}) {
    const held = new Set(found);
    const take = [];
    for (const n of graph?.nodes ?? []) {
        if (n.evidence) {
            if (!n.planned && n.tied === true && held.has(n.id)) take.push([n.id, { role: "evidence", name: String(n.label ?? ""), text: String(n.text ?? "") }]);
            continue;
        }
        if ((n.kind === "deduction" || n.kind === "counter") && ticks?.[n.id] === true) take.push([n.id, { role: n.kind, name: String(n.label ?? ""), text: "" }]);
        if (n.kind === "solution" && correct === true) take.push([n.id, { role: "solution", name: String(n.label ?? ""), text: String(n.text ?? "") }]);
    }
    take.sort((a, b) => SUMMARY_ROLES.indexOf(a[1].role) - SUMMARY_ROLES.indexOf(b[1].role));
    const index = new Map(take.map(([id], i) => [id, i]));
    const links = (graph?.edges ?? []).filter(e => index.has(e.from) && index.has(e.to))
        .map(e => ({ from: index.get(e.from), to: index.get(e.to), kind: e.kind === "refutes" ? "refutes" : "input" }));
    return { chapter: Number.isInteger(graph?.chapter) ? graph.chapter : null, correct: correct === true, nodes: take.map(([, v]) => v), links };
}

/** The summary as its card draws it (E99 C7): one column per role present, each entry its name and words, then the
 *  links in words. Every string escaped; nothing but the payload read. */
export function caseSummaryHtml(payload, { esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[c]), L = k => k } = {}) {
    const cols = SUMMARY_ROLES.map(role => [role, (payload?.nodes ?? []).map((n, i) => [n, i]).filter(([n]) => n.role === role)]).filter(([, list]) => list.length);
    const name = i => esc(payload.nodes[i]?.name || "-");
    const links = (payload?.links ?? []).map(l => `<li>${name(l.from)} ${l.kind === "refutes" ? "&#8856;" : "&#8594;"} ${name(l.to)}</li>`);
    return `<div class="drpg-case-summary"><div class="drpg-case-summary-cols">${cols.map(([role, list]) =>
        `<div class="drpg-case-summary-col"><h4>${esc(L(`DRPG.CaseSummary.role.${role}`))}</h4><ul>${list.map(([n]) =>
            `<li><strong>${esc(n.name || "-")}</strong>${n.text ? `<br><span>${esc(n.text)}</span>` : ""}</li>`).join("")}</ul></div>`).join("")}</div>`
        + (links.length ? `<ul class="drpg-case-summary-links">${links.join("")}</ul>` : "")
        + (payload?.correct ? "" : `<p class="drpg-case-summary-note">${esc(L("DRPG.CaseSummary.noSolution"))}</p>`) + `</div>`;
}

/**
 * SHOW SUMMARY (E99 C7; D2's answer: the GM presses it after the verdict; Q-E99-9: once per trial). On a GM: the
 * chapter's graph, the trial's ticks, what the students found and the verdict's `correct`, composed by
 * `composeCaseSummary`; a preview of exactly what goes out (Close, the default; Send, never under Enter); Send posts one
 * public card that is the summary (Q-E99-6: a chat card, no notice), with its sound (`SFX_EVENTS.caseSummary`, Q-E99-7),
 * and marks it sent in the trial's record (`summaryShown`, a time; trial-progress.mjs `TRIAL_RECORD`), so a second press
 * in the same trial says so and sends nothing, and a second trial in the chapter has a summary of its own (Q-E99-9).
 * Until the round of 12.11 the mark was a row of the GMs' ticks store per chapter. The animated board is E61's verdict board's (not in this
 * tree yet): the card is its static form.
 */
export async function showCaseSummary() {
    if (!game.user?.isGM) return null;
    const { MODULE_ID } = await import("./config.mjs");
    const { esc } = await import("./utils.mjs");
    const { drpgWindow } = await import("./ui-kit.mjs");
    const { caseGraph, caseTicks } = await import("./case-schema.mjs");
    const { findersByAnyRemnant } = await import("./investigation.mjs");
    const { trialProgress, setTrialProgress } = await import("./vote.mjs");
    const { getClock } = await import("./clock.mjs");
    const { chatCard } = await import("./chat-card.mjs");
    const L = k => game.i18n.localize(k);
    const chapter = getClock().chapter;
    const progress = trialProgress();
    if (progress?.summaryShown) { ui.notifications.info(L("DRPG.CaseSummary.already")); return null; }
    if (!progress?.verdictApplied) { ui.notifications.warn(L("DRPG.CaseSummary.noVerdict")); return null; }
    const graph = caseGraph(chapter);
    const finders = findersByAnyRemnant();
    const found = graph.nodes.filter(n => n.evidence && n.trace && (finders.get(String(n.trace).split(".").pop())?.size ?? 0) > 0).map(n => n.id);
    const payload = composeCaseSummary({ graph, ticks: caseTicks(chapter), found, correct: progress.verdict?.correct === true });
    const html = caseSummaryHtml(payload, { esc, L });
    const answer = await drpgWindow({
        title: L("DRPG.CaseSummary.previewTitle"),
        classes: ["drpg-panel", "drpg-window-case-summary"],
        body: `<p>${esc(L("DRPG.CaseSummary.intro"))}</p>${html}`,
        footer: { close: { role: "close", action: "close" }, secondary: [{ action: "send", label: L("DRPG.CaseSummary.send"), class: "drpg-state-change" }], default: "close" },
        rejectClose: false
    });
    if (answer !== "send") return null;
    if (trialProgress()?.summaryShown) return null;
    await setTrialProgress({ summaryShown: Date.now() });
    await ChatMessage.create({
        // On the chat kit (chat-card.mjs `chatCard`, E49 B5a's one road for a card): the title in the card's head
        content: chatCard({ glyph: "scale-balanced", title: game.i18n.format("DRPG.CaseSummary.title", { chapter }), body: html }),
        speaker: { alias: L("DRPG.CaseSummary.speaker") },
        flags: { [MODULE_ID]: { caseSummary: true, sfx: "caseSummary" } }
    });
    return L("DRPG.CaseSummary.sent");
}
