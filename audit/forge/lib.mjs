/**
 * What the Forge runners share (the road to 2.0, F3; 24.11.2026): the environment, the refusals that keep the campaign
 * world out of reach, the browser and the logins.
 * ---------------------------------------------------------------------------
 * The campaign world shares this Forge account with the test world (D2-05), and a test writes to the world it runs in:
 * every runner logs in through `openTable`, which refuses a world that is not the one named in DRPG_FORGE_WORLD or whose
 * id and title do not match /(gate|copy|qa)/i. The logins are `login` below: audit/live/foundry.mjs's road, with longer limits,
 * and it never types a password.
 *
 * Environment (README.md has the whole list): DRPG_FORGE_URL, DRPG_FORGE_WORLD, DRPG_FORGE_USERS, DRPG_FORGE_OUT,
 * DRPG_CHROMIUM, DRPG_FAKE_MEDIA, DRPG_FULL_RENDER, DRPG_BROWSER (chromium | firefox), DRPG_HEADFUL, DRPG_SIZES, DRPG_JOIN_MS.
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
    light: process.env.DRPG_FULL_RENDER === "1" ? null : { "core.performanceMode": "0", "core.maxFPS": "10" },
    /* A browser with a window (DRPG_HEADFUL=1): Firefox without one gets no WebGL on a machine without a GPU and Foundry
       never draws /join (F3-forge-PC.md, 24.11.2026: 0 of 6 headless, 6 of 6 under Xvfb with a window). */
    headful: process.env.DRPG_HEADFUL === "1",
    /* The screen sizes the table plays at (the owner, 25.11.2026, D2-20): 1920x1080 and 2560x1440; 1366x768 is not a target. */
    sizes: (process.env.DRPG_SIZES || "1920x1080,2560x1440").split(",").map(s => s.trim().split("x").map(Number)).filter(([w, h]) => w > 0 && h > 0),
    /* How long /join may take to list the accounts. audit/live's login waits 30 s, and in every Forge run so far one account
       of six missed it on its first load (F3-forge-S0.md, F3-forge-PC.md). */
    joinMs: Number(process.env.DRPG_JOIN_MS || 120_000)
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
        return pw.firefox.launch({ headless: !config.headful, firefoxUserPrefs: prefs, ...(proxy ? { proxy: { server: proxy } } : {}) });
    }
    const args = ["--use-gl=angle", "--ignore-gpu-blocklist"];
    if (config.fakeMedia) args.push("--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream");
    return pw.chromium.launch({ headless: !config.headful, args, ...(proxy ? { proxy: { server: proxy } } : {}),
        ...(process.env.DRPG_CHROMIUM ? { executablePath: process.env.DRPG_CHROMIUM } : {}) });
}

/**
 * Log one account in on /join and answer its page once `game.ready`: audit/live/foundry.mjs `login`'s road (the join
 * form's selectors measured on Foundry 14.370), with the limits a slow first load needs. The password field is never
 * touched: an account that needs one stays on /join and throws with `reason` "password-required". `storage` is written to
 * the page's localStorage before Foundry loads, where it holds no value yet. The page opens at the first of
 * `config.sizes`.
 */
export async function login(browser, base, userName, { storage = null } = {}) {
    const [width, height] = config.sizes[0] ?? [1920, 1080];
    const context = await browser.newContext({ viewport: { width, height } });
    await context.addInitScript({ path: path.join(REPO, "audit", "live", "page-hooks.js") });
    if (storage && Object.keys(storage).length) {
        await context.addInitScript(entries => {
            const store = globalThis.localStorage;
            for (const [k, v] of Object.entries(entries)) if (store.getItem(k) === null) store.setItem(k, v);
        }, storage);
    }
    const page = await context.newPage();
    try {
        await page.goto(new URL("/join", base).href, { waitUntil: "domcontentloaded", timeout: config.joinMs });
        const select = 'form#join-game-form select[name="userId"]';
        await page.waitForSelector(select, { timeout: config.joinMs });
        await page.selectOption(select, { label: userName }, { timeout: config.joinMs });
        await page.click('form#join-game-form button[name="join"]', { timeout: config.joinMs });
        await page.waitForURL(u => !u.pathname.startsWith("/join"), { timeout: 60_000 }).catch(() => {});
        if (new URL(page.url()).pathname.startsWith("/join")) {
            const e = new Error(`${userName} stayed on /join: the account needs a password, and the runner never types one`);
            e.reason = "password-required";
            throw e;
        }
        await page.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: 300_000 });
        return page;
    } catch (err) {
        await context.close().catch(() => {});
        throw err;
    }
}

/**
 * Log the named roles in, in order, and answer `{ pages, failures }`. Refuses (exit 2) before the first login when no
 * world is launched, and after it when the world is not the test world. Three tries per account, 10 s apart.
 */
export async function openTable(browser, roles, { name = "forge" } = {}) {
    const { base, worldId, users, light } = config;
    if (!/^https?:\/\//.test(base)) refuse(name, "DRPG_FORGE_URL is not set (https://<game>.forge-vtt.com)");
    if (!COPY_RE.test(worldId)) refuse(name, `DRPG_FORGE_WORLD "${worldId}" does not match ${COPY_RE}: the campaign world shares this account`);
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
