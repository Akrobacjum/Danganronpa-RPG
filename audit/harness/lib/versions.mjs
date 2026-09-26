/**
 * Which Foundry, Daggerheart and companion modules the harness says it is,
 * and where each number came from (E30, 24.09.2026; audit S14-28).
 *
 * They were written into client-entry.mjs: Foundry 14.365, Daggerheart 2.6.5,
 * Dice So Nice 5.1.1, Isometric Perspective 1.9.4 and LiveKit 0.6.1, while the
 * audit read 6.2.9, 14.0.2 and 0.6.8 off an installed Data folder. Now:
 *   - Foundry and Daggerheart are the versions module.json says the module is
 *     verified on, so the harness claims what the manifest claims;
 *   - the companions are the ones module.json requires or recommends, and their
 *     versions come from `$DRPG_FOUNDRY_DATA/Data/modules/<id>/module.json`
 *     when that points at an installed Foundry, else from versions.json;
 *   - with DRPG_FOUNDRY_DATA set, Daggerheart comes from its installed
 *     system.json too, and one newer than module.json's verified version meets
 *     the module's newer-system warning (requirements.mjs) as it would at a
 *     table - not run here, where no Foundry is installed;
 *   - Daggerheart's relay code is whatever lib/dh-relay.mjs says it copied.
 * Every value carries `from`. No test or scenario reads these numbers (grep,
 * 24.09.2026); they reach the module's diagnostics lines and the results file,
 * where `environment` also lists the live checks this harness models without
 * having run them (`unconfirmed`, audit/AUDIT-1.2.42.md section 9.2).
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));

/**
 * The LIVE-E30 checks: what the harness models of v14 that nobody has yet
 * tried on it. One leaves this list when audit/live has run it at a table.
 */
export const UNCONFIRMED = [
    "LIVE-E30-01", "LIVE-E30-02", "LIVE-E30-03", "LIVE-E30-04",
    "LIVE-E30-05", "LIVE-E30-06", "LIVE-E30-07", "LIVE-E30-08", "LIVE-E30-09",
    "LIVE-E30-10",
    "LIVE-E31-01", "LIVE-E31-02", "LIVE-E31-03", "LIVE-E31-04", "LIVE-E31-05", "LIVE-E31-06"
];

function readJson(file) {
    try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}

/** The Daggerheart tag lib/dh-relay.mjs names in its header ("tag 2.10.5"). */
function relayCode() {
    const text = fs.readFileSync(path.join(HERE, "dh-relay.mjs"), "utf8");
    return /\btag (\d+\.\d+\.\d+)/.exec(text)?.[1] ?? null;
}

/**
 * @param {string} repo  The checkout the clients boot.
 * @param {object} env   Where DRPG_FOUNDRY_DATA is read from.
 * @returns {{foundry: object, system: object, modules: object[], unconfirmed: string[]}}
 */
export function readVersions(repo, env = process.env) {
    const manifest = readJson(path.join(repo, "module.json")) ?? {};
    const data = env.DRPG_FOUNDRY_DATA ? path.resolve(env.DRPG_FOUNDRY_DATA) : null;
    const pins = readJson(path.join(HERE, "..", "versions.json")) ?? {};

    const verified = manifest.compatibility?.verified ?? null;
    const [generation, build] = String(verified ?? "").split(".").map(Number);
    const foundry = {
        version: verified, generation: generation || null, build: build || null,
        from: verified ? "module.json compatibility.verified" : null
    };

    const pinned = manifest.relationships?.systems?.find(s => s.id === "daggerheart")?.compatibility?.verified ?? null;
    const installed = data ? readJson(path.join(data, "Data", "systems", "daggerheart", "system.json"))?.version : null;
    const system = installed
        ? { id: "daggerheart", version: installed, from: "DRPG_FOUNDRY_DATA Data/systems/daggerheart/system.json" }
        : { id: "daggerheart", version: pinned, from: pinned ? "module.json relationships.systems daggerheart compatibility.verified" : null };
    system.relayCode = { version: relayCode(), from: "lib/dh-relay.mjs" };

    const companions = [...(manifest.relationships?.requires ?? []), ...(manifest.relationships?.recommends ?? [])]
        .filter(r => r.type === "module").map(r => r.id);
    const modules = companions.map(id => {
        const read = data ? readJson(path.join(data, "Data", "modules", id, "module.json"))?.version : null;
        if (read) return { id, version: read, from: `DRPG_FOUNDRY_DATA Data/modules/${id}/module.json` };
        const pin = pins.modules?.[id] ?? null;
        return { id, version: pin, from: pin ? "audit/harness/versions.json" : null };
    });

    return { foundry, system, modules, unconfirmed: [...UNCONFIRMED] };
}
