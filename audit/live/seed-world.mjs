/**
 * Build the harness's world in an empty sandbox world (E30, 24.09.2026).
 * ---------------------------------------------------------------------------
 *     DRPG_SANDBOX_WORLD=drpg-gate node audit/live/seed-world.mjs
 *
 * NEVER RUN against a real Foundry (audit/live/README.md).
 *
 * The sandbox scenarios expect the world the headless harness boots
 * (audit/harness/lib/seed.mjs): three players with their characters, Daichi,
 * Monokuma, the academy scene with its tokens and rooms. This creates those
 * documents with their ids kept (`keepId`), logged in as the world's GM. The
 * world's own GM account stands in for the seed's GM, and the players are
 * created without passwords, since the runner never types one.
 *
 * It refuses a world that already holds anything but its GM: seeding on top of
 * a real campaign is how a test world and a table's world get mixed, and there
 * is no undo. It also refuses a world whose id does not match /(gate|copy|qa)/i.
 */

import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../..");
const base = process.env.DRPG_SANDBOX_URL || "http://localhost:30099";
const worldId = process.env.DRPG_SANDBOX_WORLD || "";
const gmName = JSON.parse(process.env.DRPG_SANDBOX_USERS || "{}").gm ?? "GM";

function stop(why) { console.log(`seed-world: refused - ${why}`); process.exit(2); }

if (!/(gate|copy|qa)/i.test(worldId)) stop(`DRPG_SANDBOX_WORLD "${worldId}" does not match /(gate|copy|qa)/i`);
const { world } = await import(url.pathToFileURL(path.join(REPO, "audit", "harness", "lib", "seed.mjs")).href);
const { chromium } = createRequire(path.join(REPO, "audit", "harness", "package.json"))("playwright");
const { login } = await import(url.pathToFileURL(path.join(HERE, "foundry.mjs")).href);

const browser = await chromium.launch();
try {
    const page = await login(browser, base, gmName);
    const result = await page.evaluate(async ({ collections, worldId }) => {
        if (game.world.id !== worldId) return { refused: `the active world is ${game.world.id}, not ${worldId}` };
        const held = Object.entries(game.collections ? Object.fromEntries(game.collections.entries()) : {})
            .map(([name, c]) => [name, name === "User" ? c.size - 1 : c.size]).filter(([, n]) => n > 0);
        if (held.length) return { refused: `the world is not empty: ${held.map(([n, k]) => `${k} ${n}`).join(", ")}` };
        const made = {};
        for (const [name, docs] of Object.entries(collections)) {
            const wanted = name === "User" ? docs.filter(d => d.role < 4) : docs;
            if (!wanted.length) continue;
            const cls = CONFIG[name]?.documentClass;
            if (!cls) return { refused: `no document class for ${name}` };
            made[name] = (await cls.createDocuments(wanted, { keepId: true })).length;
        }
        return { made };
    }, { collections: world.collections, worldId });
    if (result.refused) stop(result.refused);
    console.log(`seed-world: created ${Object.entries(result.made).map(([n, k]) => `${k} ${n}`).join(", ")} in ${worldId}`);
} finally {
    await browser.close();
}
