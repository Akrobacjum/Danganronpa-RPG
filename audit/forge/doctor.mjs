/**
 * S0 on Forge: the whole table logs in, and every browser says what it runs (the road to 2.0, F3; 24.11.2026).
 * ---------------------------------------------------------------------------
 *     DRPG_FORGE_URL=https://<game>.forge-vtt.com DRPG_FORGE_WORLD=<world id> node audit/forge/doctor.mjs
 *
 * NEVER RUN against Forge yet: written in a container with no access to it. Its first run is its test; what it assumes
 * about Forge is marked UNMEASURED. It reads and photographs, and writes nothing to the world.
 *
 * What it does: logs the six accounts of the test world in through /join (audit/live/foundry.mjs `login`, which never
 * types a password), refuses to go past the first login when the active world is not the one named or its id does not
 * match /(gate|copy|qa)/i (the campaign world shares this Forge account: D2-05), then reads on every browser the
 * versions (Foundry, Daggerheart, every active module), the users and who is connected, the module's own errors, missing
 * Polish or English keys and notifications, and the A/V client's state, and takes a screenshot at 1366x768 and 1920x1080.
 *
 * Environment:
 *   DRPG_FORGE_URL     the game's address (required)
 *   DRPG_FORGE_WORLD   the test world's id, the name of its folder (required)
 *   DRPG_FORGE_USERS   JSON {gm1, gm2, p1, p2, p3, p4} -> account names; default GM1, GM2, P1..P4
 *   DRPG_FORGE_OUT     where the report goes; default audit/forge/out/<timestamp>
 *   DRPG_FAKE_MEDIA=1  Chromium with a fake camera and microphone, so A/V can connect (voice tests, S5)
 *   DRPG_SETTLE_MS     how long each browser idles after ready before it is read; default 15000
 *
 * Exit: 0 when every account logged in and no browser recorded an error from the module; 1 otherwise; 2 on a refusal.
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../..");
const COPY_RE = /(gate|copy|qa)/i;

const base = process.env.DRPG_FORGE_URL || "";
const worldId = process.env.DRPG_FORGE_WORLD || "";
const users = { gm1: "GM1", gm2: "GM2", p1: "P1", p2: "P2", p3: "P3", p4: "P4", ...JSON.parse(process.env.DRPG_FORGE_USERS || "{}") };
const outDir = process.env.DRPG_FORGE_OUT || path.join(HERE, "out", new Date().toISOString().replace(/[:.]/g, "-"));
const fakeMedia = process.env.DRPG_FAKE_MEDIA === "1";
const settleMs = Number(process.env.DRPG_SETTLE_MS || 15000);

function refuse(why) { console.log(`forge doctor: refused - ${why}`); process.exit(2); }

if (!/^https?:\/\//.test(base)) refuse("DRPG_FORGE_URL is not set (https://<game>.forge-vtt.com)");
if (!COPY_RE.test(worldId)) refuse(`DRPG_FORGE_WORLD "${worldId}" does not match ${COPY_RE}: the campaign world shares this account`);

const { chromium } = createRequire(path.join(REPO, "audit", "harness", "package.json"))("playwright");
const { login } = await import(url.pathToFileURL(path.join(REPO, "audit", "live", "foundry.mjs")).href);

/* Read in the page. UNMEASURED: the A/V client's fields (avclient-livekit's `liveKitRoom`, its `state` and `name`) are
   read defensively and recorded raw; the first run says which of them exist on Forge's build. */
const READ = () => {
    const mod = id => game.modules.get(id);
    const av = game.webrtc?.client;
    const room = av?._liveKitClient?.liveKitRoom ?? av?.liveKitRoom ?? null;
    return {
        user: { name: game.user.name, role: game.user.role, isGM: game.user.isGM },
        world: game.world.id,
        foundry: game.version,
        system: { id: game.system.id, version: game.system.version },
        module: mod("danganronpa-rpg")?.version ?? null,
        modules: [...game.modules.values()].filter(m => m.active).map(m => `${m.id} ${m.version ?? "?"}`).sort(),
        users: game.users.map(u => ({ name: u.name, role: u.role, active: u.active, character: u.character?.name ?? null })),
        /* The primary GM by the module's rule (utils.mjs `primaryGmId`: the connected full GM with the smallest id), and
           whether this browser thinks it is the one (`game.drpg.isPrimaryGm`). */
        primaryGm: game.users.get(game.users.filter(u => u.active && u.role === 4).map(u => u.id).sort()[0] ?? "")?.name ?? null,
        thisIsPrimary: (() => { try { return game.drpg?.isPrimaryGm?.() ?? null; } catch { return null; } })(),
        theme: [...document.body.classList].filter(c => c.startsWith("drpg-theme")),
        av: { mode: game.webrtc?.mode ?? null, client: av?.constructor?.name ?? null, roomState: room?.state ?? null, roomName: room?.name ?? null },
        errors: [...(window.__errors ?? [])],
        missingI18n: [...new Set(window.__missingI18n ?? [])],
        notifications: [...(window.__notifications ?? [])]
    };
};

fs.mkdirSync(outDir, { recursive: true });
const args = ["--use-gl=angle", "--ignore-gpu-blocklist"];
if (fakeMedia) args.push("--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream");
const browser = await chromium.launch({ args });
const report = { startedAt: new Date().toISOString(), base, worldId, fakeMedia, settleMs, clients: {}, failures: [] };
const pages = {};
try {
    for (const [role, name] of Object.entries(users)) {
        const consoleLines = [];
        let page;
        try {
            page = await login(browser, base, name);
        } catch (err) {
            report.failures.push(`${role} (${name}): ${err.reason ?? "error"} - ${String(err.message).split("\n")[0]}`);
            continue;
        }
        page.on("console", m => { if (["error", "warning"].includes(m.type())) consoleLines.push(`${m.type()}: ${m.text()}`.slice(0, 500)); });
        const active = await page.evaluate(() => game.world.id);
        if (active !== worldId) {
            await page.context().close();
            refuse(`the active world is "${active}", not "${worldId}"`);
        }
        pages[role] = { page, consoleLines };
    }
    await new Promise(r => setTimeout(r, settleMs));
    for (const [role, { page, consoleLines }] of Object.entries(pages)) {
        const read = await page.evaluate(READ);
        const shots = [];
        for (const [w, h] of [[1366, 768], [1920, 1080]]) {
            await page.setViewportSize({ width: w, height: h });
            await new Promise(r => setTimeout(r, 1500));
            const file = `${role}-${w}x${h}.png`;
            await page.screenshot({ path: path.join(outDir, file) });
            shots.push(file);
        }
        const moduleErrors = read.errors.filter(e => /danganronpa-rpg/.test(e));
        if (moduleErrors.length) report.failures.push(`${role}: ${moduleErrors.length} error(s) from the module`);
        report.clients[role] = { ...read, moduleErrors, console: consoleLines, shots };
    }
} finally {
    await browser.close().catch(() => {});
}
report.finishedAt = new Date().toISOString();
fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
const logged = Object.keys(report.clients).length;
console.log(`forge doctor: ${logged} of ${Object.keys(users).length} logged in; ${report.failures.length} failure(s); report in ${path.relative(REPO, outDir)}`);
for (const f of report.failures) console.log(`  - ${f}`);
process.exit(report.failures.length ? 1 : 0);
