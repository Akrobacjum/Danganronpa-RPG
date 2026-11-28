/**
 * A WRONG VERDICT'S STEPS THE GM MAY LEAVE OUT (2.0 line T3 EXP-GM-12, 27.11.2026; the owner's recommendation: "Kroki
 * złego werdyktu jako pola do odznaczenia w oknie werdyktu (domyślnie zaznaczone)"). A wrong verdict always gave the
 * Blackened their Reinforced Level Up (`verdictOffers`), asked their new rule (`verdictRule`, `askBlackenedRule`) and
 * filled every Monokuma's Despair pool (`verdictDespair`, `fillAllDespair`); the verdict's window asked only whom to
 * execute. It draws the three as ticks now, ticked as config.mjs `TRIAL.wrong` says, and the ones left unticked go on
 * the world's record of the verdict (`verdict.skip`: a choice of the table's, no secret), which the step runner reads:
 * a step named there is written done without running (verdict.mjs `runVerdict`), so a Finish does not run it either,
 * and the GMs' summary names it (`DRPG.Vote.verdictSkipped`). The ordinary verdict alone: the Final Trial's steps are
 * its own. A file of its own because verdict.mjs stands at the 1500 lines of a split file (tools/check.mjs `lengths`).
 */
import { TRIAL } from "./config.mjs";
import { listOf, esc } from "./utils.mjs";
import { tipAttr, box } from "./ui-kit.mjs";
import { goneBallotsLine } from "./vote-gone.mjs";

/** The wrong verdict's steps that may be left out, in the window's order. */
export const WRONG_SKIPPABLE = Object.freeze(["offers", "rule", "despair"]);
/** Ticked by default: what config.mjs `TRIAL.wrong` gives (a Reinforced Level Up, a rule, the pools filled). */
function tickedByDefault(key) {
    if (key === "offers") return Boolean(TRIAL.wrong?.blackenedLevelUp);
    if (key === "rule") return TRIAL.wrong?.newRule !== false;
    return TRIAL.wrong?.fillDespair !== false;
}

/** The verdict window's fieldset of the three, read only when the GM presses "Got it wrong" (`wrongSkipsOf`). Each tick's
 *  tooltip is named in its own tag, so the tooltip census reads it (tests-tips.mjs `tipPlacement`, R4752). */
export function wrongStepsHtml() {
    const on = key => (tickedByDefault(key) ? " checked" : "");
    const label = key => `<span class="drpg-choice-text">${esc(game.i18n.localize(`DRPG.Vote.wrongSteps.${key}`))}</span>`;
    return `<fieldset class="drpg-verdict-wrong-steps"><legend>${esc(game.i18n.localize("DRPG.Vote.wrongSteps.legend"))}</legend>`
        + `<label class="drpg-choice"><input type="checkbox" name="wrongStep" value="offers"${on("offers")}${tipAttr("DRPG.Tips.Trial.wrongStepOffersTooltip")}>${label("offers")}</label>`
        + `<label class="drpg-choice"><input type="checkbox" name="wrongStep" value="rule"${on("rule")}${tipAttr("DRPG.Tips.Trial.wrongStepRuleTooltip")}>${label("rule")}</label>`
        + `<label class="drpg-choice"><input type="checkbox" name="wrongStep" value="despair"${on("despair")}${tipAttr("DRPG.Tips.Trial.wrongStepDespairTooltip")}>${label("despair")}</label>`
        + `</fieldset>`;
}

/** The steps a form's ticks leave out: each of the three not ticked; all ticked, none. Pure on the form (R9139). */
export function wrongSkipsOf(form) {
    const boxes = [...(form?.querySelectorAll?.('input[name="wrongStep"]') ?? [])];
    return boxes.filter(box => !box.checked).map(box => box.value).filter(key => WRONG_SKIPPABLE.includes(key));
}

/** The record's field for `skip` on a verdict: `{ skip }` for a wrong one leaving any out, else nothing. */
export function skipField(correct, skip) {
    const list = correct ? [] : [...new Set((Array.isArray(skip) ? skip : []).filter(key => WRONG_SKIPPABLE.includes(key)))];
    return list.length ? { skip: list } : {};
}

/** Whether the runner writes `key` done without running it: a wrong, ordinary verdict that left it out. */
export function skipsStep(record, key) {
    return !record?.correct && !record?.final && Array.isArray(record?.skip) && record.skip.includes(key);
}

/** The GMs' summary line naming the steps left out, or none. */
export function skippedLines(record) {
    const list = WRONG_SKIPPABLE.filter(key => skipsStep(record, key));
    if (!list.length) return [];
    return [game.i18n.format("DRPG.Vote.verdictSkipped", { steps: listOf(list.map(key => game.i18n.localize(`DRPG.Vote.verdictSteps.${key}`))) })];
}

/** The verdict window's warning of the ballots disconnected players hold (2.0 line T3 TRIAL-06; vote-gone.mjs), or "". */
export function goneVerdictHtml() {
    const line = goneBallotsLine();
    return line ? box("warning", line) : "";
}
