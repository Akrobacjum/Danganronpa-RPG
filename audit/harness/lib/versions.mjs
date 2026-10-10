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
 *
 * E05's (C16, 27.09.2026) are the seven the harness stands in for: the
 * console's world scan (01), the lifts on planted world data (02), the
 * crossing card (06), the owed Despair (07), the verdict's pickers (08),
 * `replaceFlag` and `forcedDeletion()` (09) and the note that waits for a GM
 * (10); the fix round added two (E05 fix r2-G5, 27.09.2026; review S2-m10), a
 * deletion on a token's delta, which the harness keeps as plain data (12), and
 * a drag through two rooms, which it makes one update (13). LIVE-E05-03, -05
 * and -14 (a canvas), -04 (LiveKit) and -11 (avclient-livekit's own setting)
 * are not modelled at all, so nothing here stands in for them: they stay in
 * AUDIT section 9.2 only.
 *
 * E06's (C14, 28.09.2026) are all eight, because each is a question the
 * harness answers on its own model of Foundry, Daggerheart or Dice So Nice
 * (read in the scenarios and the suite on the release tree): the victim's
 * view of the opening (13-murder-signals, 01); a module roll's document on a
 * bystander (the harness's roll written as Daggerheart's source, R190's
 * fixtures, 02); Dice So Nice's dice (13's `game.dice3d`, 03); the chat pip
 * (the suite's recorder behind the chat log's method, 04); the safeword card
 * and its three seconds (40-flow, timed on this machine, 05); the trap's
 * receipt in the killer's thread and its Plant button (a tier-2 test, 06);
 * the old cards' clause on planted cards, not an owner's world (61, 07); and
 * a ruling card on a player's Chat tab (a tier-2 test, 08).
 */
export const UNCONFIRMED = [
    "LIVE-E30-01", "LIVE-E30-02", "LIVE-E30-03", "LIVE-E30-04",
    "LIVE-E30-05", "LIVE-E30-06", "LIVE-E30-07", "LIVE-E30-08", "LIVE-E30-09",
    "LIVE-E30-10",
    "LIVE-E31-01", "LIVE-E31-02", "LIVE-E31-03", "LIVE-E31-04", "LIVE-E31-05", "LIVE-E31-06",
    "LIVE-E04-01", "LIVE-E04-02", "LIVE-E04-03", "LIVE-E04-04", "LIVE-E04-05", "LIVE-E04-06",
    "LIVE-E04-07", "LIVE-E04-08", "LIVE-E04-09", "LIVE-E04-10", "LIVE-E04-11", "LIVE-E04-12",
    "LIVE-E05-01", "LIVE-E05-02", "LIVE-E05-06", "LIVE-E05-07", "LIVE-E05-08", "LIVE-E05-09",
    "LIVE-E05-10", "LIVE-E05-12", "LIVE-E05-13",
    "LIVE-E06-01", "LIVE-E06-02", "LIVE-E06-03", "LIVE-E06-04", "LIVE-E06-05", "LIVE-E06-06",
    "LIVE-E06-07", "LIVE-E06-08"
];

function readJson(file) {
    try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}

/** The Daggerheart tag lib/dh-relay.mjs names in its header ("tag 2.10.11"). */
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
