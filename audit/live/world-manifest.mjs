/**
 * What a world copy is, so a baseline can say which one it was taken on (E30, 24.09.2026).
 * ---------------------------------------------------------------------------
 *     node audit/live/world-manifest.mjs <worldDir>            print it
 *     node audit/live/world-manifest.mjs <worldDir> --write    ...and record it as audit/perf-baseline.json's worldCopy
 *
 * Hashes every file under the world folder (sorted by path, so the same copy
 * always gives the same digest) and reads world.json's id, Foundry and system
 * versions. Nothing of the world's content is written anywhere: the copy stays
 * in DRPG_FIXTURES, outside the repository, pristine, and every run works on a
 * scratch copy of it. NEVER RUN on a real world (audit/live/README.md); it reads
 * files only, so it can be tried on any folder.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const FILE = path.resolve(HERE, "../perf-baseline.json");

/** Every file's path and sha256, one digest over them, and world.json's facts. */
export function manifest(dir) {
    const root = path.resolve(dir);
    const files = [];
    const walk = rel => {
        for (const entry of fs.readdirSync(path.join(root, rel), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            const next = rel ? `${rel}/${entry.name}` : entry.name;
            if (entry.isDirectory()) walk(next);
            else if (entry.isFile()) files.push([next, crypto.createHash("sha256").update(fs.readFileSync(path.join(root, next))).digest("hex")]);
        }
    };
    walk("");
    let world = null;
    try { world = JSON.parse(fs.readFileSync(path.join(root, "world.json"), "utf8")); } catch { /* not a world folder: said below */ }
    return {
        files: files.length,
        sha256: crypto.createHash("sha256").update(files.map(([p, h]) => `${h}  ${p}`).join("\n")).digest("hex"),
        worldId: world?.id ?? null,
        foundry: world?.compatibility?.verified ?? world?.coreVersion ?? null,
        system: world ? `${world.system ?? "?"} ${world.systemVersion ?? "?"}` : null,
        isWorld: Boolean(world)
    };
}

if (process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url)) {
    const dir = process.argv[2];
    if (!dir || !fs.existsSync(dir)) { console.log("usage: node audit/live/world-manifest.mjs <worldDir> [--write]"); process.exit(2); }
    const m = manifest(dir);
    console.log(JSON.stringify(m, null, 2));
    if (!m.isWorld) { console.log("world-manifest: no world.json there - not a world folder"); process.exit(1); }
    if (process.argv.includes("--write")) {
        const doc = JSON.parse(fs.readFileSync(FILE, "utf8"));
        doc.worldCopy = { ...doc.worldCopy, status: "taken", takenAt: new Date().toISOString(), worldId: m.worldId, foundry: m.foundry,
            system: m.system, files: m.files, sha256: m.sha256, why: null };
        fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n");
        console.log("world-manifest: worldCopy recorded in audit/perf-baseline.json (migratedVersionAtFirstLoad is the first run's to fill)");
    }
}
