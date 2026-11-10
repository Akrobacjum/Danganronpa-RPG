/**
 * Danganronpa RPG - the windows an action asks its question in.
 * ---------------------------------------------------------------------------
 * The one menu five actions ask "which flavour of this?" with (`chooseVariant`,
 * its confirm button following the picked row: `followConfirmLabel`), the
 * statistic picker inside it (`traitFieldHtml`, `readTraitField`), the box for
 * the player's own words in an action's first window (`requestFieldHtml`,
 * `readRequestField`), and the sentence a parked declaration asks before it is
 * sent (`promptForNote`).
 *
 * WHERE IT SITS. Moved out of action-rolls.mjs by E41 C3 (1.2.97), a pure move
 * that `node tools/moved-only.mjs` proves line by line. action-rolls.mjs
 * re-exports `chooseVariant`, the one name here it exported before (level-up.mjs
 * reads it through it), and nothing here imports it back (the facade rule,
 * .claude/rules/code.md). `requestFieldHtml`, `readRequestField` and
 * `promptForNote` are exported now because the actions that stay in
 * action-rolls.mjs call them; action-rolls.mjs does not re-export them. It
 * imports nothing of the action family.
 */

import { TRAITS } from "./config.mjs";
import { esc } from "./utils.mjs";
import { drpgWindow } from "./ui-kit.mjs";
import { WIDE, choiceRowHtml, wideWindow } from "./ui-columns.mjs";
import { PROPOSAL_NOTE_MAX } from "./trait-ruling.mjs";

/**
 * The "which statistic?" field, as HTML to drop into somebody else's form.
 *
 * Three windows built this select by hand, which is why the trait choice kept
 * turning up as a window of its own: it was easier to open a new dialog than to
 * repeat fifteen lines inside an existing one. As one function it costs a line,
 * so an action that already asks something can ask this too.
 *
 * Returns "" when there is nothing to choose - one allowed trait, or none -
 * and the caller falls back to it without a field. See `readTraitField`.
 *
 * THE PLAYER'S PROPOSAL (E68 C4, 10.11.2026; DA18). With `propose` the select is the statistic the player
 * proposes to a GM (trait-ruling.mjs `traitFor`), named `proposed` so it is never read as a pick of the
 * roller's own, and `how` adds "How do you do it? (optional)", the words the GM's card quotes, bounded by
 * `PROPOSAL_NOTE_MAX`. The first listed statistic is checked, so a trap victim's table proposes Body unless
 * the player changes it. Read back by `readProposal`. Exported for the callers outside this file that ask a
 * proposal in a window of their own (action-murder.mjs, action-project.mjs, action-dynamic.mjs, action-search.mjs).
 * A proposal is one container, `drpg-trait-proposal` (E68 C7, 10.11.2026): the select and the words together, so a
 * layout can place the field as one block (the orchestrator's note for E68 C12's right column).
 */
export function traitFieldHtml(actor, traits, { note = "", propose = false, how = propose, howLabel = "DRPG.TraitRuling.howLabel" } = {}) {
    const allowed = traits ?? [];
    if (allowed.length < 2) return "";

    const options = allowed.map(key => {
        const t = TRAITS[key];
        const value = actor.system.traits?.[t.dh]?.value ?? 0;
        return `<option value="${key}">${t.label} (${value > 0 ? "+" : ""}${value})</option>`;
    }).join("");

    const words = how ? `<label class="drpg-trait-how"><span>${game.i18n.localize(howLabel)}</span>
        <input type="text" name="note" maxlength="${PROPOSAL_NOTE_MAX}"></label>` : "";
    const field = `<label class="drpg-trait-field"><span>${game.i18n.localize(propose ? "DRPG.TraitRuling.proposeLabel" : "DRPG.Advance.whichTrait")}</span>
        <select name="${propose ? "proposed" : "trait"}">${options}</select>
        ${note ? `<small class="notes">${note}</small>` : ""}
    </label>`;
    return propose ? `<div class="drpg-trait-proposal">${field}${words}</div>` : `${field}${words}`;
}

/** The other half of `traitFieldHtml`: what the form says, or the only option. */
function readTraitField(element, traits) {
    const allowed = traits ?? [];
    if (!allowed.length) return null;
    if (allowed.length === 1) return allowed[0];
    return element.querySelector("[name=trait]")?.value ?? allowed[0];
}

/** A proposal field's answer under `root`, as `traitFor` takes it: `{ proposed, note }`, the statistic one `traits` lists or null. */
export function readProposal(root, traits) {
    const proposed = root?.querySelector("[name=proposed]")?.value ?? null;
    return { proposed: (traits ?? []).includes(proposed) ? proposed : null,
        note: String(root?.querySelector("[name=note]")?.value ?? "").trim().slice(0, PROPOSAL_NOTE_MAX) };
}

/* ==========================================================================
 * ONE MENU, FIVE PLACES
 * --------------------------------------------------------------------------
 * Five actions ask the same shape of question - which flavour of this do you
 * want - and until now each answered it in a different idiom: Search had a
 * radio list with icons and hints, Observe and Project had rows of footer
 * buttons, Analyze had a select, Rest had a bulleted list with the buttons
 * underneath. Same decision, four layouts, and only one of them could say why
 * an option was not available.
 *
 * This is Search's list, lifted out: an icon, a title, a line of explanation,
 * and the two things the button rows could never carry.
 *
 *   UNAVAILABLE OPTIONS STAY ON THE LIST, struck through, with the reason
 *   where the hint goes. Seeing what you cannot do is half of what a menu is
 *   for - the same rule the Calls panel already follows.
 *
 *   OPTIONS THAT SUMMON A HUMAN ARE RED, with `drpg-gm-route` (utils.mjs
 *   `GM_ROUTE_CLASS`), the class of the kit's `gmRoute` buttons. Red means
 *   "this waits for a GM" everywhere else in the module, and a red row's hint
 *   says so in its own words (R121, A4).
 *
 * @param {object}   config
 * @param {Actor}    config.actor
 * @param {string}   config.title      Window title.
 * @param {string}   [config.intro]    HTML above the list - usually a briefing.
 * @param {string}   [config.prompt]   One line asking the question.
 * @param {Array}    config.options    `{ value, label, hint, icon, gmRoute,
 *                                        disabled, why, details, confirm }` -
 *                                        `label`/`hint`/`why`/`confirm` are
 *                                        literal text, already localised;
 *                                        `details` is markup, already escaped,
 *                                        unfolded under the row while it is the
 *                                        one picked; `confirm` names the confirm
 *                                        button while that row is picked;
 *                                        `field` is markup for the statistic's
 *                                        slot while that row is picked (the
 *                                        crisis menu's proposal, E68 C13).
 * @param {string[]} [config.traits]   Show a trait picker for these.
 * @param {string}   [config.extra]    Extra HTML inside the form, under the list.
 * @param {string}   [config.confirm]  Label for the confirm button.
 * @param {boolean}  [config.columns]  The briefing beside the list (`actionWindow`, below), true by default since
 *                                        E68 C12; false only for Level Up's two questions, which keep their look (Q12).
 * @returns {Promise<{value: string, trait: string|null, form: HTMLFormElement}|null>}
 */
/* ==========================================================================
 * THE SENTENCE COMES FIRST
 * --------------------------------------------------------------------------
 * Every action that can end in a GM ruling used to ask for the player's own
 * words AFTER the dice: choose the action, choose the trait, roll, and only
 * then a second window asking what you were actually trying to do. Search was
 * the exception - its box sits in the first window, next to the goal - and
 * Search is the one that reads right.
 *
 * The order matters for more than clicks. Typing "I check whether the lock has
 * been forced" before the roll is a declaration; typing it after a 6 is a
 * negotiation. The guide asks for the first.
 *
 * So the box is offered in the FIRST window of every action that has a GM
 * branch, and the answer travels with the roll. Nothing else about those
 * actions changes: the roll still happens where it happened, the card still
 * carries the same three parts.
 * ========================================================================== */

/** The textarea, with whatever prompt the action wants above it. */
export function requestFieldHtml({ prompt, placeholder, optional = true, when = null }) {
    // `when`: the row whose pick shows it (the stylesheet's `data-drpg-when`), or the rows (a list: E21 C5b, Observe's
    // two that send words), or shown with every row.
    when = Array.isArray(when) ? when.join(" ") : when;
    return `<label class="drpg-specific-note"${when ? ` data-drpg-when="${esc(when)}"` : ""}>
        <span>${prompt}</span>
        <textarea name="request" rows="2" placeholder="${
            foundry.utils.escapeHTML(placeholder ?? "")}"></textarea>
        ${optional ? `<small class="notes">${
            game.i18n.localize("DRPG.Action.requestOptional")}</small>` : ""}
    </label>`;
}

/** Whatever was typed into that field, from a dialog that has already closed. */
export function readRequestField(root) {
    return root?.querySelector('[name="request"]')?.value.trim() ?? "";
}

export async function chooseVariant({
    actor, title, intro = "", prompt = "", options = [], traits = null,
    extra = "", confirm = null, traitNote = "", showShut = false, columns = true
} = {}) {
    const usable = options.filter(o => !o.disabled);
    // `showShut`: a window whose every row is shut still opens, the rows greyed with their reasons and one button
    // that closes it (E16 part 2 C4; S02-26, the Rest window) - the reasons are the answer the player needs.
    if (!usable.length && !(showShut && options.length)) {
        ui.notifications.warn(game.i18n.localize("DRPG.Action.noVariants"));
        return null;
    }

    const first = usable[0]?.value ?? null;

    // A row's details are a sibling of its <label>, not a child: a list is no phrasing
    // content, and the stylesheet unfolds the block right after the picked row.
    // The row itself is ui-columns.mjs `choiceRowHtml` since E68 C12 (the shared blocks E49 reuses). What a picked row
    // unfolds (`details`) follows its row in one column; in an action's columns it stands in the left one, under the
    // briefing, one block a row and the picked row's alone shown (`syncDetails`): measured on round M's page with C12's
    // markup, the crisis menu's two facts under its first row made the right column 140 px taller under the glass at
    // 1366x768 (body 808 px of 571; 668 with them on the left; S/stages/E68/STATUS.md E68-C12).
    const detailsOf = o => (o.details && !o.disabled
        ? `<div class="drpg-choice-details" data-drpg-for="${esc(o.value)}"${columns && o.value !== first ? " hidden" : ""}>${o.details}</div>` : "");
    const rows = options.map(o => `${choiceRowHtml(o, { checked: o.value === first })}${columns ? "" : detailsOf(o)}`).join("");
    const beside = columns ? options.map(detailsOf).join("") : "";
    // A row's own statistic field (`field`: the crisis menu's proposal, E68 C4) stands in the right column's slot, not
    // with its details on the left: the owner's Q3 of round M keeps the field under the rows. One block a row, the
    // picked row's alone shown (`syncDetails`); no class of its own, so the hidden attribute alone shuts it.
    const fields = options.map(o => (o.field && !o.disabled
        ? `<div data-drpg-field="${esc(o.value)}"${o.value !== first ? " hidden" : ""}>${o.field}</div>` : "")).join("");

    const fallback = confirm ?? game.i18n.localize("DRPG.Action.proceed");
    // A row's `confirm` is its label, or a function of the drawn window that reads the row's own fields (a Frisk's mode).
    const confirmFor = (value, root = null) => {
        const label = options.find(o => o.value === value)?.confirm;
        return typeof label === "function" ? label(root) : label ?? fallback;
    };

    /* ON THE KIT'S FRAME (E21 C5a, 06.11.2026): `drpgWindow`, its footer by roles - the confirm the primary and the
       default, the closing word Cancel; a window whose every row is shut has the closing word alone, Close. The answer
       is the one DialogV2.wait gave: the picked row's `{ value, trait, form }`, or null. */
    const form = `<form>
            ${prompt ? `<p>${prompt}</p>` : ""}
            <div class="drpg-choice-list">${rows}</div>
            ${extra}
            <div class="${TRAIT_SLOT}">${fields}${traits?.length ? traitFieldHtml(actor, traits, { note: traitNote })
                // A window that asks no statistic still says its note (fix r2-G3, 03.10.2026; the
                // round-2 review's C2-m9 (b)): the Tamper menu's readied Cleaning Tool was only ever
                // drawn inside the trait field it does not have, so no Tamper window showed it.
                : traitNote ? `<p class="notes">${traitNote}</p>` : ""}</div>
        </form>`;
    const picked = await (columns ? actionWindow : drpgWindow)({
        title,
        classes: ["drpg-panel"],
        /* AN ACTION'S DECLARATION IS A PROMPT (E23 C5a, 07.11.2026; S01-15, the owner's Q-E23-5): kept above the sheet the
           player checks while deciding (stacking.mjs). Every caller of this menu is an action's declaration the game waits
           on - Analyze, the crisis menu, Observe, a project, Rest, Search, Tamper, Palm and Level Up's two questions - so
           the menu asks for it itself; R1404 holds that list of callers, and a new one is judged there. */
        prompt: true,
        ...(columns ? { brief: `${intro}${beside ? `<div class="drpg-variant-details">${beside}</div>` : ""}`, ask: form }
            : { body: `${intro}${form}` }),
        render: (event, dialog) => {
            if (options.some(o => o.confirm)) followConfirmLabel(dialog, confirmFor);
            if (beside || fields) syncDetails(dialog);
            atTop(dialog);
        },
        footer: !usable.length ? { close: "close" } : {
            primary: {
                action: "ok",
                label: confirmFor(first),
                callback: (e, b, d) => {
                    const form = d.element.querySelector("form");
                    return {
                        value: form.querySelector('input[name="variant"]:checked')?.value ?? first,
                        trait: traits?.length ? readTraitField(d.element, traits) : null,
                        form
                    };
                }
            },
            close: "cancel"
        },
        rejectClose: false
    });

    if (!picked || picked === "cancel" || picked === "close") return null;
    return picked;
}

/**
 * ONE LAYOUT FOR EVERY ACTION (E68 C12, 10.11.2026; layout B of round M, the owner's answers of 10.11.2026: "layout B for
 * every action window"). `actionWindow` is the one builder of an action's window, as call-pickers.mjs `callWindow` is the
 * Calls': the briefing in the left column, the question in the right, in ui-columns.mjs's window of one stated width
 * (`WIDE`, 1120 px). `chooseVariant` opens through it (every action menu), and so do the windows an action draws itself
 * (Listen's room, Move's briefing, a project picked to work on); R3200 holds the list. The right column ends in the
 * statistic's slot (`TRAIT_SLOT`: `traitFieldHtml`'s field, and E68 C4's proposal and the player's "how"), under the rows
 * and the caller's `extra`: the owner's Q3 of round M keeps the field there. What it measured: S/stages/E68/STATUS.md E68-C12.
 *
 * THE BRIEFING BESIDE THE LIST (E21 fix G2, 07.11.2026; E21-04, the end review's B1: "Observe fits with no scrolling").
 * Observe's window was 544 px wide under Stained Glass (the popup measure on `.dialog-content`) and its body 1140 px tall:
 * the briefing, then five rows of two to five lines each. At 1366x768 the body had 571 px (glass) and 616 px (Legacy),
 * so it scrolled there and at 1920x1080 under the glass (883 px of 1140). Measured in Chromium on the style harness's
 * capture: the briefing on the left and the question on the right, in a window of a stated width (so the popup measure is
 * lifted), with a row's line of explanation shown while it is the picked row (an unavailable row keeps its reason). At
 * 1000 px Focus your gaze (its line and the request box) and an open "All thresholds" still scrolled 15-16 px under the
 * glass at 1366x768; at 1120 px, the question's column 1.1 to the briefing's 1, every pick and "All thresholds" open read
 * still in both themes, the tallest 555 px of the glass's 571 (Legacy 426 of 616), and so at 1280x800 and 1920x1080; at
 * 1024x768 (the window held to 1008 px) those two still scroll 15-16 px under the glass. The stylesheet stacks the two columns
 * when the window is narrower than both (a phone, where the body scrolls as before). A real Foundry's fonts and header
 * are LIVE-E21-01's.
 */
const TRAIT_SLOT = "drpg-action-trait";

/**
 * An action's window: `brief` (markup, the left column) and `ask` (markup, the right), every other key ui-kit.mjs
 * `drpgWindow`'s (`title`, `classes`, `footer`, `render`, `prompt`, ...). `drpg-action-window` names it for the
 * stylesheet; its width is `WIDE.width` unless the caller states one.
 */
export function actionWindow({ brief = "", ask = "", classes = [], ...rest } = {}) {
    // A window that asks nothing (Move's briefing) is its left column alone, at half the width: an empty right column
    // would be 540 px of nothing.
    return wideWindow({
        ...(ask ? {} : { width: WIDE.width / 2 }),
        ...rest,
        classes: [...new Set(["drpg-panel", ...classes, "drpg-action-window"])],
        columns: [{ cls: "drpg-variant-brief", html: brief }, ...(ask ? [{ cls: "drpg-variant-ask", html: ask }] : [])]
    });
}

/** The left column's details follow the picked row (E68 C12): the block of the row picked shown, the others hidden. */
function syncDetails(dialog) {
    const root = dialog?.element;
    if (!root) return;
    root.addEventListener("change", event => {
        if (event.target?.name !== "variant") return;
        for (const block of root.querySelectorAll(".drpg-variant-details > .drpg-choice-details")) {
            block.hidden = block.dataset.drpgFor !== event.target.value;
        }
        for (const block of root.querySelectorAll(`.${TRAIT_SLOT} > [data-drpg-field]`)) {
            block.hidden = block.dataset.drpgField !== event.target.value;
        }
    });
}

/**
 * The window opens at its top (E21 C5b, 06.11.2026; audit S02-06): a field's `autofocus` scrolls the kit's body to
 * it, so Observe opened on the end of its briefing's first sentence. The body is put back at its top once the focus
 * has landed (a frame later), and the focus stays where it is.
 */
function atTop(dialog) {
    const body = dialog?.element?.querySelector(".drpg-kit-body");
    if (!body) return;
    body.scrollTop = 0;
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => { body.scrollTop = 0; });
    else setTimeout(() => { body.scrollTop = 0; }, 0);
}

/**
 * The confirm button says what the picked row does (E32+E07 C15, 03.10.2026; audit
 * S04-27): the crisis menu's "Roll it" became "Do it" on a free take, which throws no
 * dice. Foundry draws a button's label in a <span> beside its icon; the harness's
 * window draws the bare text, so either is written.
 */
function followConfirmLabel(dialog, confirmFor) {
    const root = dialog?.element;
    const button = root?.querySelector('footer button[data-action="ok"]');
    if (!button) return;
    const sync = () => {
        const label = confirmFor(root.querySelector('input[name="variant"]:checked')?.value, root);
        (button.querySelector("span") ?? button).textContent = label;
    };
    // A row's own field can change what it does as well as the row (E80 part 2 C2: a Frisk's mode, `friskModes`).
    root.addEventListener("change", event => {
        if (["variant", "friskMode"].includes(event.target?.name)) sync();
    });
    sync();
}

/**
 * Ask for the sentence that goes to the GM, without calling them yet.
 *
 * `promptAndCallGm` does both in one step, and a parked declaration needs the
 * halves separated: the GM hears about this when the Eclipse ends, not now.
 * Cancelling the box is not cancelling the attempt - the action is already
 * spent by the time this opens, and a dismissed dialog must never be a way to
 * get it back.
 */
export async function promptForNote(actor, { title, prompt, placeholder }) {
    // On the kit's frame (E21 C5a): one answer, the primary; a closed window answers "" below, as it did.
    const result = await drpgWindow({
        title,
        classes: ["drpg-panel"],
        // The second half of a declaration: a prompt, as `chooseVariant`'s window (E23 C5a).
        prompt: true,
        body: `<form>
            <p>${prompt}</p>
            <textarea name="note" rows="3" placeholder="${
                foundry.utils.escapeHTML(placeholder ?? "")}"></textarea>
        </form>`,
        footer: {
            primary: {
                action: "ok", label: game.i18n.localize("DRPG.Action.murderParkedConfirm"),
                callback: (e, b, d) => d.element.querySelector("[name=note]")?.value.trim() ?? ""
            }
        },
        rejectClose: false
    }).catch(() => "");
    return typeof result === "string" ? result : "";
}
