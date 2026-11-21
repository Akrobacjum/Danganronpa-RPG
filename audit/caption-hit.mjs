/*
 * THE OVERFLOW CAPTION TAKES THE POINTER ON A DESK LAYOUT (line DESP of 1.2.122; the audit's CTRL-28: "the overflow
 * caption's tooltip, which holds the GM's real count and why a full counter has not fired, can never show on a desk
 * layout: the caption takes no pointer").
 *
 *   cd audit/harness && npm ci        (once: Playwright comes from there; it downloads no browser)
 *   node audit/caption-hit.mjs [--chromium <executable>] [--repo <checkout>]     (from the repository's root)
 *
 * The module's stylesheets (styles/danganronpa.css, and styles/stained-glass.css under its body class) on a page of
 * their own, at 1366x768, with the Despair panel as despair.mjs draws it on a desk layout: `#ui-top` > `#drpg-despair`,
 * one pool row (name, pips, count, a stepper) and the overflow caption under it, carrying a `title`. Foundry's own
 * `pointer-events: none` on the UI's columns is stood in on `#ui-top`. In each theme: `document.elementFromPoint` at the
 * centre of the caption must answer the caption (or a child of it), and Playwright's mouse moved there must find the
 * caption under `:hover`. THE CONTROL FIRST (CLAUDE.md, the stackShapes lesson): the same page with the caption's
 * selector taken out of the panel's opt-in rule must read the caption as not hit, or the check measures nothing.
 * Exit 1 on a case that fails or a control that reads the caption hit. Writes nothing.
 */
/* global document */ // read inside the page (`page.evaluate`), not in Node
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const repoAt = args.indexOf("--repo");
const REPO = repoAt >= 0 ? path.resolve(args[repoAt + 1]) : path.resolve(HERE, "..");
const chromeAt = args.indexOf("--chromium");
const { chromium } = createRequire(path.join(HERE, "harness", "package.json"))("playwright");

const OPT_IN = "#drpg-despair .drpg-overflow-caption {";
const css = name => fs.readFileSync(path.join(REPO, "styles", name), "utf8");

function page(theme, { control = false } = {}) {
    let main = css("danganronpa.css");
    if (control) {
        // The caption's selector out of the opt-in list: the line before it ends with a comma, which becomes the brace.
        const at = main.indexOf(`,\n${OPT_IN}`);
        if (at < 0) throw new Error("the control could not find the caption in the panel's opt-in rule");
        main = `${main.slice(0, at)} {${main.slice(at + OPT_IN.length + 2)}`;
    }
    const glass = theme === "stained-glass" ? `<style>${css("stained-glass.css")}</style>` : "";
    return `<!doctype html><html><head><meta charset="utf-8"><style>${main}</style>${glass}
<style>#ui-top { pointer-events: none; position: fixed; top: 0; left: 0; right: 0; display: flex; justify-content: center; }
#board { position: fixed; inset: 0; }</style></head>
<body class="${theme === "stained-glass" ? "drpg-theme-stained-glass" : ""}"><div id="board"></div><div id="ui-top"><div id="drpg-despair">
  <div class="drpg-despair-row" data-user-id="u1"><span class="drpg-despair-name">Monokuma</span><div class="drpg-despair-pips">
    <span class="drpg-despair-pip" data-value="1"></span><span class="drpg-despair-pip" data-value="2"></span></div>
    <span class="drpg-despair-count">2/12</span><button type="button" class="drpg-despair-button">+</button></div>
  <div class="drpg-overflow-caption" title="Spilled Despair: 23 of 20">Despair overflow · 20/20</div>
</div></div></body></html>`;
}

async function read(browser, theme, options) {
    const tab = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    try {
        await tab.setContent(page(theme, options));
        const box = await tab.locator(".drpg-overflow-caption").boundingBox();
        if (!box || box.width < 2 || box.height < 2) return { drawn: false };
        const x = box.x + box.width / 2, y = box.y + box.height / 2;
        const hit = await tab.evaluate(([px, py]) => {
            const at = document.elementFromPoint(px, py);
            return { onCaption: Boolean(at?.closest(".drpg-overflow-caption")), tag: at ? `${at.tagName.toLowerCase()}${at.id ? `#${at.id}` : ""}` : null };
        }, [x, y]);
        await tab.mouse.move(x, y);
        const hovered = await tab.evaluate(() => document.querySelector(".drpg-overflow-caption")?.matches(":hover") ?? false);
        return { drawn: true, ...hit, hovered };
    } finally {
        await tab.close();
    }
}

const launch = chromeAt >= 0 ? { executablePath: args[chromeAt + 1] } : {};
const browser = await chromium.launch(launch);
let bad = 0;
try {
    for (const theme of ["default", "stained-glass"]) {
        const real = await read(browser, theme);
        const good = real.drawn && real.onCaption && real.hovered;
        console.log(`${good ? "ok  " : "FAIL"} ${theme}: elementFromPoint at the caption's centre ${real.onCaption ? "answers the caption" : `answers ${real.tag}`}; under the mouse it ${real.hovered ? "is" : "is not"} :hover`);
        if (!good) bad++;
        let control = null;
        try { control = await read(browser, theme, { control: true }); } catch (err) { control = { drawn: false, why: err.message }; }
        const ok = control.drawn && !control.onCaption && !control.hovered;
        console.log(`${ok ? "ok  " : "FAIL"} control ${theme}: the caption out of the opt-in rule reads ${control.why ?? (control.drawn ? (control.onCaption ? "hit" : `not hit (${control.tag})`) : "not drawn")}${ok ? "" : " - the check would measure nothing"}`);
        if (!ok) bad++;
    }
} finally {
    await browser.close();
}
console.log(`caption-hit: ${bad ? `${bad} case(s) failed` : "every case holds"}`);
process.exit(bad ? 1 : 0);
