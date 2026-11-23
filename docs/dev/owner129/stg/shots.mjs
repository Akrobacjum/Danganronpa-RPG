import { createRequire } from "node:module";
const require = createRequire("/home/user/Danganronpa-RPG/audit/harness/package.json");
const { chromium } = require("playwright");
const out = "/home/user/Danganronpa-RPG/docs/dev/owner129/stg";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const made = [];
for (const [w, h] of [[1920, 1080], [1366, 768]]) for (const theme of ["stained-glass", "legacy"]) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    await page.goto(`http://127.0.0.1:8765/audit/glass-harness.html${theme === "legacy" ? "?theme=legacy" : ""}`);
    await page.waitForTimeout(1500);
    const ok = await page.evaluate(() => {
        const tile = document.getElementById("drpg-voice-tile");
        if (!tile) return false;
        const controls = tile.querySelector(".drpg-voice-tile-controls");
        const mic = controls.querySelector(".drpg-voice-mic");
        // The microphone held by the module (ui-kit.mjs LAUNCH_STATES.held, voice.mjs micHold "hiding").
        mic.classList.add("is-held");
        mic.setAttribute("aria-label", "Jesteś w ukryciu: mikrofon zostaje wyłączony, dopóki się nie ujawnisz.");
        // Reveal yourself as voice-tile.mjs paintUnhide builds it: a mini launcher with the `averted-eyes` glyph after the speaker.
        const b = document.createElement("button");
        b.type = "button"; b.className = "drpg-launch-mini drpg-voice-unhide";
        b.setAttribute("aria-label", "Ujawnij się"); b.dataset.tooltipText = "Ujawnij się";
        b.innerHTML = '<i class="drpg-pxi" style="--drpg-glyph: var(--drpg-pix-averted-eyes)" aria-hidden="true" inert></i>';
        controls.querySelector(".drpg-voice-speaker").after(b);
        return true;
    });
    if (!ok) { console.log("no tile", w, h, theme); continue; }
    if (typeof (await page.evaluate(() => typeof window.refreshGlass)) === "string") await page.evaluate(() => window.refreshGlass?.());
    await page.waitForTimeout(600);
    const base = `${out}/voice-tile-ujawnij-${theme}-${w}x${h}`;
    await page.locator("#drpg-voice-tile").screenshot({ path: `${base}.png` });
    await page.screenshot({ path: `${base}-page.png` });
    made.push(base);
    await page.close();
}
await browser.close();
console.log(made.join("\n"));
