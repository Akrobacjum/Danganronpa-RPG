/**
 * Danganronpa RPG - what a critical is worth (G-16).
 * ---------------------------------------------------------------------------
 * Daggerheart pays a critical +1 Hope and clears 1 Stress. The Full Guide says
 * +2 Hope and says nothing about Stress. This module had never overridden
 * either, so for its whole life it has been running Daggerheart's rule by
 * omission - not by decision.
 *
 * It follows the guide on both halves. Keeping the cleared Stress as well would
 * hand a critical more than either document describes; the reasoning for
 * dropping it is on `CRITICAL` in config.mjs, which is where the numbers live.
 *
 * WHY A WRAPPER AND NOT A HOOK. There is no hook between the dice and the
 * resource write: Daggerheart fires `postRollDuality` inside `buildPost`, and
 * `dualityUpdate` - which is what adds the Hope and the Stress - runs
 * afterwards. A listener would be handed a config whose resource updates had
 * not happened yet, so there is nothing to correct and nothing to correct it
 * on. `addDualityResourceUpdates` is the funnel itself.
 *
 * NOT libWrapper, for the same reasons no-scrolling-text.mjs gives: it is not a
 * dependency of this module (see requirements.mjs), this is one method wrapped
 * once, the original is kept on the wrapper, and the marker makes a second
 * registration a no-op instead of a second layer.
 *
 * IT CORRECTS, IT DOES NOT REPLACE. Reimplementing the method would mean
 * carrying Daggerheart's reroll arithmetic, its dead/defeated check and its
 * automation setting in this file forever, and silently keeping the 2.6.5
 * version of all three after the system moves on. So the original runs, and
 * only what it did to `hope` and `stress` on a critical is rewritten - measured
 * against a snapshot rather than assumed, so a build where the system stops
 * touching those two leaves this doing nothing at all.
 */

import { CRITICAL } from "./config.mjs";
import { log, error } from "./utils.mjs";

/** Marks our wrapper so re-registering cannot stack another one on top. */
const PATCHED = Symbol.for("drpgCriticalRule");

export function registerCriticalRule() {
    const DualityRoll = game.system?.api?.dice?.DualityRoll;

    if (typeof DualityRoll?.addDualityResourceUpdates !== "function") {
        // A Daggerheart that renamed or moved it. Worth a line in the log
        // rather than a silent no-op: criticals would carry on paying the
        // system's numbers, and "the rule quietly did not apply" is exactly the
        // kind of drift this stage exists to remove.
        error("Could not find Daggerheart's duality resource step - criticals keep the system's rule");
        return;
    }
    if (DualityRoll.addDualityResourceUpdates[PATCHED]) return;

    const original = DualityRoll.addDualityResourceUpdates;

    async function patched(config) {
        const map = config?.resourceUpdates;

        /*
         * The snapshot is the whole safety of this.
         *
         * `ResourceUpdateMap` is a Map keyed by resource, and `addResources`
         * replaces the entry object rather than mutating it - so holding the
         * old entries is enough to tell afterwards what THIS call changed, and
         * to put back anything that came from somewhere else. Other things add
         * resources to the same map before and after: domain-card triggers, the
         * roll's own costs, this module's own writes.
         */
        const before = map
            ? { hope: map.get("hope"), stress: map.get("stress") }
            : null;

        const result = await original.call(this, config);

        if (!map || !before || !config?.roll?.isCritical) return result;

        /*
         * DID THE ORIGINAL ACTUALLY PAY ANYTHING?
         *
         * It declines in several cases that have nothing to do with us - Hope
         * automation switched off in the world settings, a reaction roll, an
         * actor who is dead or defeated, `skips.resources`. In every one of
         * them the map is untouched, and inventing two Hope there would be this
         * module handing out a reward the system had deliberately withheld.
         */
        if (map.get("hope") === before.hope && map.get("stress") === before.stress) return result;

        // Stress goes back to whatever it was before this call - which is
        // usually "no entry at all", and is occasionally somebody else's.
        if (!CRITICAL.clearsStress) {
            if (before.stress === undefined) map.delete("stress");
            else map.set("stress", before.stress);
        }

        // …and Hope is topped up to the guide's number. Added to what was
        // already there rather than set outright: a Call or a trigger that
        // granted Hope in the same breath must not be swallowed by this.
        const base = Number(before.hope?.value ?? 0);
        map.set("hope", {
            ...(before.hope ?? { key: "hope", enabled: true }),
            value: base + CRITICAL.hope
        });

        return result;
    }

    patched[PATCHED] = true;
    /** Kept so the rule can be lifted again without a reload. */
    patched.original = original;

    DualityRoll.addDualityResourceUpdates = patched;
    log(`A critical pays ${CRITICAL.hope} Hope${CRITICAL.clearsStress ? "" : " and clears no Sanity"}.`);
}

/** Put Daggerheart's own rule back. For diagnosis, not for play. */
export function unregisterCriticalRule() {
    const DualityRoll = game.system?.api?.dice?.DualityRoll;
    const current = DualityRoll?.addDualityResourceUpdates;
    if (!current?.[PATCHED]) return false;
    DualityRoll.addDualityResourceUpdates = current.original;
    log("The critical rule is off; Daggerheart's own numbers are back.");
    return true;
}
