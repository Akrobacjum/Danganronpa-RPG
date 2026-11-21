/*
 * ENTER ON A FOCUSED BUTTON OF THE TRIAL CONSOLE, IN CHROMIUM (1.2.122; the audit's CTRL-39 and CASE-63).
 *
 *   cd audit/harness && npm ci        (once: Playwright comes from there; it downloads no browser)
 *   node audit/live-enter.mjs [--chromium <executable>]      (from the repository's root)
 *
 * The console (scripts/trial-floor-ui.mjs `manageClassTrial`) holds Enter in the capture phase on its window while an
 * exchange runs, so Enter does not press the footer's default (E70 fix p1-G3). Until 1.2.122 it held every Enter, and a
 * GM who reached Skip or +30 s by Tab and pressed Enter moved nothing: in a browser a button's press by Enter is the
 * default action of its keydown, which a prevented keydown never gets (jsdom presses nothing on a key either way, so the
 * suite cannot see this). The hold since 1.2.122 lets a focused button other than the footer's default through.
 *
 * The listener here is the console's, copied from trial-floor-ui.mjs as it stands in 1.2.122 (`HOLD_NOW`; the console's
 * module is not loaded here: it imports most of the module). A page of its own: a form as a DialogV2 draws one - a body
 * with a bar button and a text field, a footer whose first submit button is the default - driven by Playwright's keyboard:
 *   bar        the bar's button focused, Enter: its click heard once, the form not submitted;
 *   field      the text field focused, Enter: no submit (the hold);
 *   default    the footer's default focused, Enter: no submit (the hold);
 * and THE CONTROL FIRST: the hold of 21bf5d18 (`HOLD_BEFORE`, every Enter held), the bar's button focused, Enter: its
 * click must be read as lost - or the page measures nothing. Exit 1 on a case that fails or a control that reads nothing.
 * Writes nothing. Not measured: Foundry v14's own DialogV2 around it (its keydown handlers, its form) - LIVE item proposed.
 */
/* global window */ // read inside the page (`page.evaluate`), not in Node
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const chromeAt = args.indexOf("--chromium");
const { chromium } = createRequire(path.join(HERE, "harness", "package.json"))("playwright");

// trial-floor-ui.mjs's listener, 1.2.122 and 21bf5d18 (`exchangeRuns()` true: an exchange is running).
const HOLD_NOW = `event => {
    if (event.key !== "Enter" || !exchangeRuns()) return;
    const button = event.target?.closest?.("button");
    if (button && !button.matches("footer button.default, footer button[autofocus]")) return;
    event.preventDefault();
    event.stopPropagation();
}`;
const HOLD_BEFORE = `event => {
    if (event.key !== "Enter" || !exchangeRuns()) return;
    event.preventDefault();
    event.stopPropagation();
}`;

const page = hold => `<!doctype html><html><head><meta charset="utf-8"></head><body>
<div id="win"><form id="f"><div class="body"><button type="button" id="bar" data-drpg-bar="skip">Skip</button>
<input type="text" id="field" value="typed"></div>
<footer class="form-footer"><button type="submit" id="def" class="default" autofocus data-action="closeDebate">Close Debate</button>
<button type="submit" data-action="close">Close</button></footer></form></div>
<script>
window.read = { bar: 0, submits: 0 };
const exchangeRuns = () => true;
document.getElementById("bar").addEventListener("click", () => { window.read.bar++; });
document.getElementById("f").addEventListener("submit", e => { e.preventDefault(); window.read.submits++; });
document.getElementById("win").addEventListener("keydown", ${hold}, true);
</script></body></html>`;

const browser = await chromium.launch(chromeAt >= 0 ? { executablePath: args[chromeAt + 1] } : {});
const results = [];
const run = async (name, hold, focus) => {
    const p = await browser.newPage();
    await p.setContent(page(hold));
    await p.focus(focus);
    await p.keyboard.press("Enter");
    await p.waitForTimeout(150);
    const read = await p.evaluate(() => window.read);
    await p.close();
    return { name, read };
};
const control = await run("control (21bf5d18's hold): Enter on the bar's button", HOLD_BEFORE, "#bar");
const controlOk = control.read.bar === 0;
results.push([control.name, controlOk, control.read]);
for (const [name, focus, want] of [
    ["bar: Enter on the bar's button presses it, submits nothing", "#bar", r => r.bar === 1 && r.submits === 0],
    ["field: Enter in the text field submits nothing", "#field", r => r.bar === 0 && r.submits === 0],
    ["default: Enter on the footer's default submits nothing", "#def", r => r.bar === 0 && r.submits === 0]
]) {
    const out = await run(name, HOLD_NOW, focus);
    results.push([name, want(out.read), out.read]);
}
await browser.close();
let failed = 0;
for (const [name, ok, read] of results) {
    if (!ok) failed++;
    console.log(`${ok ? "ok  " : "FAIL"} ${name} ${JSON.stringify(read)}`);
}
if (!controlOk) console.log("the control read no lost press - this page measures nothing");
console.log(`live-enter: ${results.length - failed}/${results.length} hold`);
process.exit(failed ? 1 : 0);
