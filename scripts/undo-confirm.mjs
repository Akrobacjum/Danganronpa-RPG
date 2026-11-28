/**
 * Danganronpa RPG - the question before an undo: what it takes back, said before it is done.
 * ---------------------------------------------------------------------------
 * ONE QUESTION FOR EVERY UNDO (2.0 line T2b, EXP-GM-13 with DAY-02, 28.11.2026; F1-blind-gm EXP-GM-13, E-GM-87: "I undo
 * my own mistake and see, before the undo, what it will take back"). The HUD's left chevron stepped the clock back at
 * once (DAY-02), and Apply in the Students window brought a dead student back to life with nothing said first; each
 * said what it had done only afterwards ("Taken back: ...", "N characters changed"). Both ask here now: a title, a line
 * that says what is asked, the list of what the undo writes - worded by the caller, from what the code it runs really
 * writes - and the yes, named by the caller. Cancel stands on the left and is the default, as boundary.mjs `noFirst` asks
 * the Eclipse's start: with no field in the window Enter and Space press Cancel, and a window closed by its X or Esc
 * answers no. Answers true only for the yes.
 *
 * `open` is the kit's window unless handed another (R9041 hands a recorder, so the question is read without a window).
 */

import { drpgWindow } from "./ui-kit.mjs";
import { esc } from "./utils.mjs";

/** The question's body: the intro line, then one item per effect, each escaped. Pure but for nothing (R9041). */
export function undoBody({ intro = "", effects = [] } = {}) {
    const lines = (effects ?? []).filter(Boolean).map(line => `<li>${esc(String(line))}</li>`).join("");
    return `<div class="drpg-undo-confirm">${intro ? `<p>${esc(String(intro))}</p>` : ""}${lines ? `<ul>${lines}</ul>` : ""}</div>`;
}

/**
 * Ask before an undo: `title` the window's, `intro` the line above the list, `effects` the list of what the undo writes
 * (strings, in the reader's language), `yesLabel` the button that does it, `tip` its tooltip. Answers true for the yes,
 * false for Cancel and for a window closed any other way.
 */
export async function confirmUndo({ title, intro = "", effects = [], yesLabel, tip = "" } = {}, { open = drpgWindow } = {}) {
    const answer = await open({
        classes: ["drpg-panel", "drpg-window-undo"],
        title,
        body: undoBody({ intro, effects }),
        footer: {
            primary: { action: "yes", label: yesLabel, tooltip: tip, callback: () => true },
            close: { role: "cancel", action: "no", callback: () => false },
            default: "no"
        },
        rejectClose: false
    });
    return answer === true;
}
