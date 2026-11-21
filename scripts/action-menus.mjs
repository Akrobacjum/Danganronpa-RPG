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

import { MODULE_ID, TRAITS } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { esc } from "./utils.mjs";
import { drpgWindow, tipAttr, tipText } from "./ui-kit.mjs";
import { WIDE, choiceRowHtml, wideWindow } from "./ui-columns.mjs";
import { PROPOSAL_NOTE_MAX } from "./trait-ruling.mjs";
import { holdRowLines } from "./ui-hold.mjs";
import { keepLive } from "./live.mjs";


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

/**
 * THE ROWS FOLLOW THE TABLE WHILE THE MENU STANDS (1.2.122 line MURDER; 1.2.121's line K left the crisis menu with no
 * live refresh; the audit's REFR-21; the owner's rule "Zawsze odswiezamy okna od razu przy zmianie"). A caller hands
 * `live`: `options()` reads the rows again, `watch` is keepLive's (`actors`, `settings`, `hooks` ...), and `closeWhen()`,
 * when it answers a key of lang, closes the menu and says that sentence - the crisis menu's turn gone to the other side or
 * its incident over. The list (`.drpg-choice-list`) is rebuilt from the fresh rows, the first usable one checked, and
 * keepLive carries the row the player picked (live.mjs keys a radio by its name and value). A row's details, fields and
 * facts stay as drawn: the menu's own rows are the turn's numbers and shut reasons. Chromium's press order on a rebuilt
 * row is not measured here (jsdom; the 1.2.120 lesson, r120-P-1).
 */
function keepRowsLive(dialog, live, rowsOf) {
    keepLive(dialog, {
        region: ".drpg-choice-list",
        build: () => {
            const list = live.options?.() ?? [];
            const first = list.find(o => !o.disabled)?.value ?? null;
            return `<div class="drpg-choice-list">${rowsOf(list, first)}</div>`;
        },
        watch: live.watch ?? {},
        after: () => {
            const why = live.closeWhen?.();
            if (!why) return;
            ui.notifications.info(game.i18n.localize(why));
            dialog.close().catch(() => {});
        }
    });
}

/** Whatever was typed into that field, from a dialog that has already closed. */
export function readRequestField(root) {
    return root?.querySelector('[name="request"]')?.value.trim() ?? "";
}

export async function chooseVariant({
    actor, title, intro = "", prompt = "", options = [], traits = null,
    extra = "", confirm = null, traitNote = "", showShut = false, columns = true, live = null, onRender = null
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
    // E49 A8.1: in the columns the blocks are stacked in one place and the unpicked ones only unlit (`UNPICKED`), never
    // `hidden`: the left column is as tall as its tallest block, whatever is picked (the rule of 10.11).
    const detailsOf = o => (o.details && !o.disabled
        ? `<div class="drpg-choice-details${columns && o.value !== first ? ` ${UNPICKED}` : ""}" data-drpg-for="${esc(o.value)}">${o.details}</div>` : "");
    const rowsOf = (list, checked) => list.map(o => `${choiceRowHtml(o, { checked: o.value === checked })}${columns ? "" : detailsOf(o)}`).join("");
    const rows = rowsOf(options, first);
    /* ROWS THAT FOLLOW WHAT THEY LIST (the audit's CTRL-21, 1.2.122). `live`: `{ rows(), watch }` - the window's row list
       rebuilt from `rows()` on `watch` (live.mjs `keepLive`), the row checked kept where it still stands, else the first
       usable. Level Up's take-back rows were drawn once: an offer spent or taken back meanwhile stood on the menu. A
       one-column window's alone (`columns: false`): an action's columns hold the rows' details beside them. */
    let checkedNow = first, drawn = null;
    const liveRows = live && !columns && typeof live.rows === "function" ? {
        region: ".drpg-choice-list",
        build: () => {
            const list = live.rows();
            const keep = list.some(o => o.value === checkedNow && !o.disabled) ? checkedNow : list.find(o => !o.disabled)?.value ?? null;
            checkedNow = keep;
            options.splice(0, options.length, ...list);
            return `<div class="drpg-choice-list">${rowsOf(list, keep)}</div>`;
        },
        // The confirm button says the row checked after the rebuild (a row gone takes its own word with it).
        after: () => {
            const button = drawn?.element?.querySelector('footer button[data-action="ok"]');
            if (button) (button.querySelector("span") ?? button).textContent = confirmFor(checkedNow);
        },
        watch: live.watch ?? {}
    } : null;
    const beside = columns ? options.map(detailsOf).join("") : "";
    // A row's fact lines (`facts`: the crisis menu's, `crisisDetails`) go into the window's Details (E49 A8.1), one layer
    // a row in one stack: into the briefing's own box where the intro drew one (`DETAILS_ROWS`), else a Details of their own.
    const rowFacts = columns ? detailsStack(options.filter(o => o.facts?.length && !o.disabled)
        .map(o => ({ when: o.value, html: factsList(o.facts) }))) : "";
    const lead = `${intro}${beside ? `<div class="drpg-variant-details">${beside}</div>` : ""}`;
    const brief = !rowFacts ? lead
        : lead.includes(DETAILS_ROWS) ? lead.replace(DETAILS_ROWS, () => rowFacts) : `${lead}${detailsHtml(rowFacts)}`;
    // A row's own statistic field (`field`: the crisis menu's proposal, E68 C4) stands in the right column's slot, not
    // with its details on the left: the owner's Q3 of round M keeps the field under the rows. One block a row, stacked
    // in one place and the picked row's alone lit (`syncDetails`; E49 A8.3: `hidden` until then, which made the slot as
    // tall as the picked row's field).
    // Whatever a caller reads back off the answer's `form` goes here, never in `details`: the left column is outside
    // the <form>. A Frisk's ways stood there from C12 to E68 fix CI 77d3e66a and were read as Openly every time.
    const fields = options.map(o => (o.field && !o.disabled
        ? `<div data-drpg-field="${esc(o.value)}"${o.value !== first ? ` class="${UNPICKED}"` : ""}>${o.field}</div>` : "")).join("");

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
        ...(columns ? { brief, ask: form }
            : { body: `${intro}${form}` }),
        ...(liveRows ? { live: liveRows } : {}),
        render: (event, dialog) => {
            if (liveRows) {
                drawn = dialog;
                dialog.element?.addEventListener("change", e => { if (e.target?.name === "variant") checkedNow = e.target.value; });
            }
            if (live && typeof live.options === "function") keepRowsLive(dialog, live, rowsOf);
            if (liveRows || options.some(o => o.confirm)) followConfirmLabel(dialog, confirmFor);
            if (columns) {
                holdFields(dialog);
                syncDetails(dialog, first);
                // The rows' floor (E49 A8.4), read once drawn and again once the fonts are in (a line's height is the font's).
                holdRowLines(dialog.element);
                globalThis.document?.fonts?.ready?.then(() => holdRowLines(dialog.element)).catch(() => {});
            }
            atTop(dialog);
            /* A caller's live regions in `extra` (`live(dialog)`; palm.mjs's targets, the audit's REFR-52, 1.2.122). `live`
               comes in three shapes, one per line of 1.2.122 that gave it one, told apart by what it holds: a function
               (palm.mjs, line WORLD), `{ rows(), watch }` (level-up.mjs, line DESP: `liveRows` above, a one-column window's)
               and `{ options(), watch, closeWhen() }` (action-murder.mjs, line MURDER: `keepRowsLive`). Until the assembly
               this line called an object too, and Level Up's menu threw once drawn. */
            if (typeof live === "function") live(dialog);
            // The caller's own wiring once drawn (1.2.122: the Projects window keeps its rows live, REFR-36).
            onRender?.(event, dialog);
        },
        footer: !usable.length ? { close: "close" } : {
            primary: {
                action: "ok",
                label: confirmFor(first),
                callback: (e, b, d) => {
                    const form = d.element.querySelector("form");
                    return {
                        value: form.querySelector('input[name="variant"]:checked')?.value ?? (liveRows ? checkedNow : first),
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
 * (Listen's room, a project picked to work on; Move's briefing went with the Move window, E100 item 1); R3200 holds the list. The right column ends in the
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
 * stylesheet; its width is `WIDE.width` unless the caller states one. Its Details (E49 A8.1, `detailsHtml`) are wired
 * on every render (`wireDetails`), before the caller's own `render`.
 */
export function actionWindow({ brief = "", ask = "", classes = [], render = null, ...rest } = {}) {
    // A window that asks nothing is its left column alone, at half the width: an empty right column would be 540 px of
    // nothing. Move's briefing was the one such window until E100 item 1 took it away; the branch is kept for the next.
    return wideWindow({
        ...(ask ? {} : { width: WIDE.width / 2 }),
        ...rest,
        render: (event, dialog) => { wireDetails(dialog); wireLiveBriefings(dialog); return render?.(event, dialog); },
        classes: [...new Set(["drpg-panel", ...classes, "drpg-action-window"])],
        columns: [{ cls: "drpg-variant-brief", html: brief }, ...(ask ? [{ cls: "drpg-variant-ask", html: ask }] : [])]
    });
}

/* ==========================================================================
 * DETAILS (E49 A8, 11.11.2026; the owner's of the same day: "Proponuję wrzucić też szczegóły (koszt akcji, statystyka,
 * lokacja, itd., teksty mniejsze) razem z thresholdami do wspólnej rozwijanej zakładki 'Details'")
 * --------------------------------------------------------------------------
 * Every fact line of an action's briefing - the price, the statistic, the room, the searches left, a miss's cost, every
 * threshold, the GM's note - stands in one box under the lead (action-briefing.mjs `briefingBlock`), and a button opens
 * and shuts it. "All thresholds", the <details> it replaces, grew Observe's window by 193 px under the glass and 148
 * under Legacy at 1366x768 when opened (measured in Chromium on probe 08's captures: S/stages/E49/A8-details.md 1).
 *
 * THE BOX IS IN THE FLOW SHUT AS OPEN. Shut it is only invisible (the stylesheet's `visibility`, on the toggle's
 * `aria-expanded`) and `inert` (neither Tab nor a screen reader enters lines nobody sees), never `hidden` or
 * `display: none`, so it holds its place and the window has one size, open or shut (the rule of 10.11: a state changes
 * look, never layout). Not a <details>: a shut one renders nothing of its content, so it cannot hold its place.
 *
 * A LINE BOUND TO A ROW (`data-drpg-when`, Analyze's hint and stash, Tamper's ladder and trail, a crisis row's list)
 * is a layer of one stack (`detailsStack`): every row's layer stands in the same place, the picked row's lit and the
 * others `UNPICKED` (`syncDetails`), so the box is as tall as its tallest row and a pick changes no size.
 *
 * REMEMBERED (the owner's Q2): one client setting, settings.mjs `actionDetailsOpen`, per player and browser, one value
 * for every action window, shut at first. `detailsHtml` draws the state it reads; a press writes it (`wireDetails`).
 * ========================================================================== */

/** Where a menu's row-bound facts go inside a briefing's box (`chooseVariant`): a comment, so an unused one draws nothing. */
const DETAILS_ROWS = "<!--drpg-details-rows-->";
/** A block or layer of a row not picked: drawn in its place, unlit (the stylesheet's `visibility`), never `hidden`. */
const UNPICKED = "drpg-unpicked";
let detailsDrawn = 0;

/** Whether this browser's player left Details open (settings.mjs `actionDetailsOpen`); shut where it cannot be read. */
function detailsOpen() {
    try { return game.settings.get(MODULE_ID, SETTINGS.actionDetailsOpen) === true; } catch { return false; }
}

/** The toggle and its box, `inner` (markup, already escaped) inside; open or shut as this browser last left them. */
export function detailsHtml(inner) {
    const id = `drpg-details-${++detailsDrawn}`;
    const open = detailsOpen();
    return `<div class="drpg-action-details">
        <button type="button" class="drpg-action-details-toggle" id="${id}-toggle" aria-expanded="${open}" aria-controls="${id}"${tipAttr("DRPG.Tips.Actions.detailsTooltip")}><span class="drpg-action-details-mark" aria-hidden="true"></span><span>${esc(game.i18n.localize("DRPG.Kit.details"))}</span></button>
        <div class="drpg-action-details-box" id="${id}" role="region" aria-labelledby="${id}-toggle"${open ? "" : " inert"}>${inner}${DETAILS_ROWS}</div>
    </div>`;
}

/** Fact lines (markup each, already escaped) as the briefing's list, or "" for none. */
export function factsList(lines = []) {
    return lines.length ? `<ul class="drpg-briefing-facts">${lines.map(line => `<li>${line}</li>`).join("")}</ul>` : "";
}

/** `{ when, html }` layers in one place: the rows' lines over one another, each named by its row(s), or "" for none. */
export function detailsStack(layers = []) {
    const shown = layers.filter(layer => layer?.html);
    return shown.length ? `<div class="drpg-details-stack">${shown.map(layer =>
        `<div class="drpg-details-layer" data-drpg-when="${esc(layer.when)}">${layer.html}</div>`).join("")}</div>` : "";
}

/*
 * THE BRIEFINGS KEPT LIVE (the auditor's probe 43, p43-1, 1.2.123; action-briefing.mjs `briefingBlock`). A briefing drawn
 * under an id keeps its builder here (`keepBriefing`, the newest 64: a builder lives as long as its window is likely to);
 * `wireLiveBriefings` stands keepLive on its two regions in a drawn window - the lead (`.drpg-briefing-block`) and its own
 * lines in Details (`.drpg-briefing-live`) - each rebuilt from a fresh draw of the whole block. The lines bound to a row
 * are lit again for the row picked (`syncDetails`'s rule). Kept here, not in action-briefing.mjs, which imports this file.
 */
const liveBriefings = new Map();
/** The writes a briefing reads: the character's budget and Sanity, its items (tools, bullets), the tokens (the room, who is there), and the hour (WORLD_HOOKS). */
const BRIEFING_WATCH = Object.freeze({ actors: true, items: true, tokens: true, hooks: ["drpgDeathsChanged"] });

export function keepBriefing(id, build) {
    liveBriefings.set(id, build);
    while (liveBriefings.size > 64) liveBriefings.delete(liveBriefings.keys().next().value);
}

function wireLiveBriefings(dialog) {
    const root = dialog?.element;
    if (!root) return;
    for (const id of new Set([...root.querySelectorAll("[data-drpg-brief]")].map(node => node.dataset.drpgBrief))) {
        const build = liveBriefings.get(id);
        if (typeof build !== "function") continue;
        const part = cls => () => {
            const holder = document.createElement("div");
            holder.innerHTML = build();
            return holder.querySelector(`.${cls}[data-drpg-brief="${CSS.escape(id)}"]`)?.outerHTML ?? `<div class="${cls}" data-drpg-brief="${esc(id)}"></div>`;
        };
        keepLive(dialog, { region: `.drpg-briefing-block[data-drpg-brief="${CSS.escape(id)}"]`, build: part("drpg-briefing-block"), watch: BRIEFING_WATCH });
        keepLive(dialog, {
            region: `.drpg-briefing-live[data-drpg-brief="${CSS.escape(id)}"]`, build: part("drpg-briefing-live"), watch: BRIEFING_WATCH,
            after: element => {
                const value = root.querySelector('input[name="variant"]:checked')?.value;
                if (value === undefined) return;
                for (const layer of element?.querySelectorAll?.(".drpg-details-layer") ?? []) {
                    layer.classList.toggle(UNPICKED, !String(layer.dataset.drpgWhen ?? "").split(/\s+/).includes(value));
                }
            }
        });
    }
}

/** The toggle opens and shuts its box and writes the setting; Enter on it does what a click does (the kit's form takes no part). */
export function wireDetails(dialog) {
    const root = dialog?.element;
    if (!root) return;
    for (const toggle of root.querySelectorAll(".drpg-action-details-toggle")) {
        const box = root.querySelector(`[id="${toggle.getAttribute("aria-controls")}"]`);
        if (!box || toggle.dataset.drpgWired) continue;
        toggle.dataset.drpgWired = "1";
        const show = open => {
            toggle.setAttribute("aria-expanded", String(open));
            box.toggleAttribute("inert", !open);
            // A box past its cap scrolls in itself, and a keyboard can scroll it only if it can take the focus.
            if (open && box.scrollHeight > box.clientHeight) box.tabIndex = 0;
            else box.removeAttribute("tabindex");
        };
        const flip = () => {
            const open = toggle.getAttribute("aria-expanded") !== "true";
            show(open);
            game.settings.set(MODULE_ID, SETTINGS.actionDetailsOpen, open).catch(() => {});
        };
        toggle.addEventListener("click", flip);
        // Enter's default on a button is its click; taken here, so the window's own Enter (its primary) never sees it.
        toggle.addEventListener("keydown", event => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            event.stopPropagation();
            flip();
        });
        show(toggle.getAttribute("aria-expanded") === "true");
    }
}

/**
 * The window follows the picked row (E68 C12; E49 A8.1, A8.3): in the left column the picked row's block and Details
 * layers lit, in the right the fields that row shows (`holdFields`' stacks) and its own field in the statistic's slot;
 * every other one `UNPICKED` in its place, never `hidden`.
 */
function syncDetails(dialog, first = null) {
    const root = dialog?.element;
    if (!root) return;
    const pick = value => {
        for (const block of root.querySelectorAll(".drpg-variant-details > .drpg-choice-details")) {
            block.classList.toggle(UNPICKED, block.dataset.drpgFor !== value);
        }
        for (const layer of root.querySelectorAll(".drpg-action-details-box .drpg-details-layer")) {
            layer.classList.toggle(UNPICKED, !String(layer.dataset.drpgWhen ?? "").split(/\s+/).includes(value));
        }
        for (const field of root.querySelectorAll(`.${HELD} > [data-drpg-when]`)) {
            field.classList.toggle(UNPICKED, !String(field.dataset.drpgWhen ?? "").split(/\s+/).includes(value));
        }
        for (const block of root.querySelectorAll(`.${TRAIT_SLOT} > [data-drpg-field]`)) {
            block.classList.toggle(UNPICKED, block.dataset.drpgField !== value);
        }
    };
    pick(root.querySelector('input[name="variant"]:checked')?.value ?? first);
    root.addEventListener("change", event => {
        if (event.target?.name === "variant") pick(event.target.value);
    });
}

/** A run of the right column's row-bound fields, held in one place (`holdFields`). */
const HELD = "drpg-held-stack";

/**
 * THE RIGHT COLUMN HOLDS ITS PLACE TOO (E49 A8.3, 11.11.2026; the owner's answer 4: "tak"). A field a row shows - the
 * request box of Observe's two rows and of Search's Something specific, Analyze's hint box, Tamper's three selects,
 * Palm's plant, a project's two - carries `data-drpg-when` after the rows, and the stylesheet's sibling rules showed it
 * (`display`) with its row alone: measured at A8.2 under the glass at 1366x768 (style-sweep `--details --every-pick`),
 * Observe 584.4 to 612.1 px, Search 621.7 to 692.8, Analyze 486.1 to 543.6 by the pick. Each run of such fields is put
 * in one stack when the window is drawn (the callers write them as markup in `extra`, so the run is found in the tree,
 * not in the string), all of it in one grid cell, the picked row's lit and the others `UNPICKED` (`syncDetails`): the
 * column is as tall as its tallest field. A field that shows with every row stays where it was, outside the stack.
 */
function holdFields(dialog) {
    const root = dialog?.element;
    // The right column's own <form>, or the column itself where the window's form swallowed it (a nested form is dropped).
    const holder = root?.querySelector(".drpg-variant-ask > form") ?? root?.querySelector(".drpg-variant-ask");
    if (!holder) return;
    let stack = null;
    for (const child of [...holder.children]) {
        if (!child.matches("[data-drpg-when]")) { stack = null; continue; }
        if (!stack) {
            stack = document.createElement("div");
            stack.className = HELD;
            child.before(stack);
        }
        stack.append(child);
    }
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
 *
 * `traits` (E68 C9; S18-10): the statistics the killer's opening lists, and the window asks which one they propose
 * (`traitFieldHtml`, the first checked; the sentence is the "how"). Then the answer is `{ note, proposed }`
 * (`readProposal`), a closed window `{ note: "", proposed: null }`; without it, the sentence alone.
 *
 * Such a window is an action's (the merge of E68 C9 into the line, 10.11.2026): it opens through `actionWindow`, the
 * caller's `brief` in the left column and the question in the right - the sentence, then the statistic's slot
 * (`TRAIT_SLOT`) under it, where every proposal stands since C12 (the owner's Q3 of round M: the field stays in the
 * right column). C9 had drawn the field above the sentence, in one column. Without `traits` the window is the one
 * column it was.
 */
export async function promptForNote(actor, { title, prompt, placeholder, traits = null, brief = "" }) {
    const propose = (traits ?? []).length > 1;
    const form = `<form>
            <p>${prompt}</p>
            <textarea name="note" rows="3"${tipAttr("DRPG.Tips.Sweep.Actions.murderNoteTooltip")} placeholder="${
                foundry.utils.escapeHTML(placeholder ?? "")}"></textarea>
            ${propose ? `<div class="${TRAIT_SLOT}">${traitFieldHtml(actor, traits, { propose: true, how: false })}</div>` : ""}
        </form>`;
    // On the kit's frame (E21 C5a): one answer, the primary; a closed window answers "" below, as it did.
    const result = await (propose ? actionWindow : drpgWindow)({
        title,
        classes: ["drpg-panel"],
        // The second half of a declaration: a prompt, as `chooseVariant`'s window (E23 C5a).
        prompt: true,
        ...(propose ? { brief, ask: form } : { body: form }),
        footer: {
            primary: {
                action: "ok", label: game.i18n.localize("DRPG.Action.murderParkedConfirm"), tooltip: tipText("DRPG.Tips.Actions.makeTheAttemptTooltip"),
                callback: (e, b, d) => propose ? readProposal(d.element, traits) : d.element.querySelector("[name=note]")?.value.trim() ?? ""
            }
        },
        rejectClose: false
    }).catch(() => "");
    return noteAnswerOf(result, traits);
}

/**
 * `promptForNote`'s answer, in one shape for each caller (the audit's ROLL-32, 1.2.122): a caller that hands `traits` -
 * Direct Murder's declaration - reads `{ note, proposed }` whatever the list holds, and one that hands none the sentence
 * alone. Until 1.2.122 a list of one statistic answered the string, and the declaration's destructuring lost the
 * sentence (latent: MURDER_OPENING's killer lists two). A list of one proposes nothing: `proposed` is null, as a closed
 * window's. Pure (R8223).
 */
export function noteAnswerOf(result, traits = null) {
    if (traits === null || traits === undefined) return typeof result === "string" ? result : "";
    if (result && typeof result === "object") return { note: String(result.note ?? ""), proposed: result.proposed ?? null };
    return { note: typeof result === "string" ? result : "", proposed: null };
}
