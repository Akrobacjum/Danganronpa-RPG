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
    "LIVE-E06-07", "LIVE-E06-08",
    /* E88's (C0, 27.10.2026): a token's refresh as client-entry.mjs models it - render flags gathered and flushed once
       a token a frame, `refreshVisibility` giving Foundry's own `visible` back, one refresh for a move where v14 slides
       it frame by frame. Every canvas count scenario 86 and R1009 read stands on it. */
    "LIVE-E88-05",
    /* E89's (C0, 30.10.2026): a drag's preview refreshed each frame, and `sightRefresh` fired each frame of a slide when
       scenario 86 asks it (client-entry.mjs `__preview`, `__slideTo`); one dragged path as N updates, the document's
       `movement.pending.waypoints` taken from the update's option (client-entry.mjs `applyRemote`). */
    "LIVE-E89-02", "LIVE-E89-03",
    /* E50's (C1, 30.10.2026): the window in front, `ui.activeWindow`, set by a first render and `bringToFront` and
       cleared by a close (lib/shim.mjs), what the messenger reads for "seen" (01); a page hidden and shown again,
       `document.visibilityState` and its `visibilitychange` (client-entry.mjs `__pageVisibility`, 02). E50 C3: the
       Music slider's curve, AudioHelper's `volumeToInput`/`inputToVolume` read in fvtt-types 14.366 - the harness's
       AudioHelper has neither, so the module's fallback of the same curve runs here (03). */
    "LIVE-E50-01", "LIVE-E50-02", "LIVE-E50-03",
    /* E44's (fix FG2, 05.11.2026): a window folded to its title bar - ApplicationV2's `minimized`, `minimize` and `maximize`
       and DialogV2's default `minimizable: false` - read from memory: lib/shim.mjs's ApplicationV2 has no fold, so R1339
       reads the options the module hands its windows and `alreadyOpen` on stand-ins (01); Escape on a DialogV2, modelled in
       lib/shim.mjs from the module's note on 14.365, not from v14's source (02). */
    "LIVE-E44-08", "LIVE-E44-09",
    /* E23's (fix G4, 08.11.2026; STATUS E23 Open 70): the windows' order - a running z-index that `bringToFront` writes,
       raised on a first render, on a pointerdown in the window and on `render(true)` of a window already open - modelled
       in lib/shim.mjs from v13's ApplicationV2 as remembered and the module's notes (stacking.mjs), not from v14's source.
       R1404 and E23-T2 read the prompts over the sheets on that model. The other E23 rows are not modelled by the
       harness (the glass harness's stand-ins in Chromium, or nothing), so they stay in AUDIT section 9.2 only. */
    "LIVE-E23-04",
    /* E24's (C1b, 08.11.2026; C4b wrote its AUDIT item): `TokenDocument#getBarAttribute` as lib/shim.mjs models it - the
       attribute a bar names read off the actor's system data, `{ type: "bar", value, max }` for an object with both and
       `editable` true - from v13 as remembered, not v14's source. states.mjs `wrapBarAttribute` and R1447 read the
       student's bars on that model (LIVE-E24-01). The other nine of E24's rows (the pips, the Party sheet, the
       biography's type and saves, a light client, a step that throws, the victim's reading, the Breakdown icon and a
       roll made in Breakdown) are read on stand-ins in the tests or Chromium, or not drawn here at all: the harness
       models none of them, so they stay in AUDIT section 9.2 only. */
    "LIVE-E24-01",
    /* E45's (C3a, 08.11.2026): the render after a write - each open app in a document's `apps` asked for
       `render(false, { renderContext: "update<Doc>", renderData: <the changes> })` after the update hook on every
       client, the writer's included, and a descendant's create, update or delete rendering its root's apps the same
       (client-entry.mjs `renderApps`) - from v13/v14 notes as remembered, not from v14's source. Scenario 71 and the
       sheet's own render (sheet.mjs `renderPlan`) read the repaint on that model. E45's other live rows (the wrapper's
       way out, 71's parts at a table, a Monocub's tile) are read on the same model: */
    "LIVE-E45-01",
    /* E45-C3b's (09.11.2026; AUDIT items 425-427): the wrapper's way out for a render signature it does not know (R1477 on
       stand-in arguments; 02), 71's parts A, B, F, H and I at a table (03) and a Monocub's Confusion tile after a Hope
       write (71 C; 04), each read headless on `renderApps` and the stand-in sheet, neither of them v14's. */
    "LIVE-E45-02", "LIVE-E45-03", "LIVE-E45-04"
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
