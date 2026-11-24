/**
 * What the Forge runners share (the road to 2.0, F3; 24.11.2026): the environment, the refusals that keep the campaign
 * world out of reach, the browser and the logins.
 * ---------------------------------------------------------------------------
 * The campaign world shares this Forge account with the test world (D2-05), and a test writes to the world it runs in:
 * every runner logs in through `openTable`, which refuses a world that is not the one named in DRPG_FORGE_WORLD or whose
 * id and title do not match /(gate|copy|qa)/i. The logins are audit/live/foundry.mjs `login`, which never types a password.
 *
 * Environment (README.md has the whole list): DRPG_FORGE_URL, DRPG_FORGE_WORLD, DRPG_FORGE_USERS, DRPG_FORGE_OUT,
 * DRPG_CHROMIUM, DRPG_FAKE_MEDIA, DRPG_FULL_RENDER, DRPG_BROWSER (chromium | firefox).
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, "../..");
export const COPY_RE = /(gate|copy|qa)/i;

export const config = {
    base: process.env.DRPG_FORGE_URL || "",
    worldId: process.env.DRPG_FORGE_WORLD || "",
    users: { gm1: "GM1", gm2: "GM2", p1: "P1", p2: "P2", p3: "P3", p4: "P4", ...JSON.parse(process.env.DRPG_FORGE_USERS || "{}") },
    fakeMedia: process.env.DRPG_FAKE_MEDIA === "1",
    engine: process.env.DRPG_BROWSER === "firefox" ? "firefox" : "chromium",
    /* The test browsers' own Foundry client settings (doctor.mjs, the third and fourth Forge runs of 24.11.2026): the
       lowest performance mode and 10 frames a second, for a machine without a GPU. Never a world setting. */
    light: process.env.DRPG_FULL_RENDER === "1" ? null : { "core.performanceMode": "0", "core.maxFPS": "10" }
};

export function refuse(name, why) { console.log(`${name}: refused - ${why}`); process.exit(2); }

/** The folder a run writes its report to: audit/forge/out/<name>-<timestamp>, or DRPG_FORGE_OUT. */
export function outDir(name) {
    const dir = process.env.DRPG_FORGE_OUT || path.join(HERE, "out", `${name}-${new Date().toISOString().replace(/[:.]/g, "-")}`);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

/** The browser, through the session's HTTPS proxy when there is one, with a fake microphone when asked. */
export async function launch() {
    const pw = createRequire(path.join(REPO, "audit", "harness", "package.json"))("playwright");
    const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
    if (config.engine === "firefox") {
        const prefs = config.fakeMedia ? { "media.navigator.streams.fake": true, "media.navigator.permission.disabled": true } : {};
        return pw.firefox.launch({ firefoxUserPrefs: prefs, ...(proxy ? { proxy: { server: proxy } } : {}) });
    }
    const args = ["--use-gl=angle", "--ignore-gpu-blocklist"];
    if (config.fakeMedia) args.push("--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream");
    return pw.chromium.launch({ args, ...(proxy ? { proxy: { server: proxy } } : {}),
        ...(process.env.DRPG_CHROMIUM ? { executablePath: process.env.DRPG_CHROMIUM } : {}) });
}

/**
 * Log the named roles in, in order, and answer `{ pages, failures }`. Refuses (exit 2) before the first login when no
 * world is launched, and after it when the world is not the test world. Three tries per account, 10 s apart.
 */
export async function openTable(browser, roles, { name = "forge" } = {}) {
    const { base, worldId, users, light } = config;
    if (!/^https?:\/\//.test(base)) refuse(name, "DRPG_FORGE_URL is not set (https://<game>.forge-vtt.com)");
    if (!COPY_RE.test(worldId)) refuse(name, `DRPG_FORGE_WORLD "${worldId}" does not match ${COPY_RE}: the campaign world shares this account`);
    const { login } = await import(url.pathToFileURL(path.join(REPO, "audit", "live", "foundry.mjs")).href);
    const probe = await browser.newPage();
    await probe.goto(new URL("/join", base).href, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const idle = await probe.evaluate(() => /no active game session/i.test(document.body.innerText));
    await probe.close();
    if (idle) refuse(name, "no world is launched on this Forge game: launch the test world first");
    const pages = {}, failures = [];
    for (const role of roles) {
        let page = null, lastErr = null;
        for (let attempt = 1; attempt <= 3 && !page; attempt++) {
            try { page = await login(browser, base, users[role], { storage: light }); }
            catch (err) {
                lastErr = err;
                if (err.reason === "password-required") break;
                await new Promise(r => setTimeout(r, 10_000));
            }
        }
        if (!page) { failures.push(`${role} (${users[role]}): ${lastErr?.reason ?? "error"} - ${String(lastErr?.message).split("\n")[0]}`); continue; }
        const active = await page.evaluate(() => ({ id: game.world.id, title: game.world.title }));
        const named = [active.id, active.title].map(v => String(v ?? "").toLowerCase());
        if (!named.includes(worldId.toLowerCase()) || (!COPY_RE.test(active.id ?? "") && !COPY_RE.test(active.title ?? ""))) {
            await page.context().close();
            refuse(name, `the active world is "${active.id}" ("${active.title}"), not "${worldId}"`);
        }
        pages[role] = page;
    }
    return { pages, failures };
}
