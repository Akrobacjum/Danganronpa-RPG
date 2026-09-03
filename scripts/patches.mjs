/**
 * Danganronpa RPG - the register of every method this module overrides.
 * ---------------------------------------------------------------------------
 * Seven places reach into Foundry's or Daggerheart's objects and put a
 * function of ours where theirs was. Each has its reasons written beside it in
 * its own file; what none of them had was a list (audit A18), so a system
 * update that moved one of the targets was found by whichever feature stopped
 * working first - a critical paying the system's numbers, captions floating
 * off tokens again - rather than by a question anybody could ask.
 *
 * NOTHING HERE PATCHES ANYTHING. This is a table, and `diagnosePatches` reads
 * it: is the target still where the override expects it, and is what sits
 * there ours? A new override is registered by adding a row here and by
 * leaving a mark on its wrapper that the row's `probe` can recognise - a
 * `Symbol.for` key, a property, or simply a name on the function.
 *
 * Fetched on demand from `game.drpg.diagnosePatches()`; nothing imports this
 * file at start-up.
 */

import { refreshStateParked } from "./iso-shield.mjs";

const AV_MODULE = "avclient-livekit";

/**
 * One row per override.
 *
 *   target   what is replaced, as a person would name it
 *   file     where the replacement lives, with its reasons
 *   why      the one-line reason
 *   when     "always", or the condition under which it is installed
 *   probe    () => { present, ours, note? } - `present` says the target
 *            exists at all; `ours` says the function sitting there is the
 *            module's, and is null when the wrapper leaves no mark to read
 */
export const PATCHES = [
    {
        target: "DualityRoll.addDualityResourceUpdates",
        file: "critical.mjs",
        why: "The module's own numbers on a critical - see CRITICAL in config.mjs.",
        when: "always",
        probe: () => {
            const fn = game.system?.api?.dice?.DualityRoll?.addDualityResourceUpdates;
            return {
                present: typeof fn === "function",
                ours: Boolean(fn?.[Symbol.for("drpgCriticalRule")])
            };
        }
    },
    {
        target: "CONFIG.Dice.randomUniform",
        file: "forced-roll.mjs",
        why: "One die of the next duality roll lands on its highest face (Free Critical).",
        when: "only while a Free Critical's own roll evaluates; lifted in a finally (A4)",
        probe: () => ({
            present: typeof CONFIG.Dice?.randomUniform === "function",
            ours: null
        })
    },
    {
        target: "InterfaceCanvasGroup.prototype.createScrollingText",
        file: "no-scrolling-text.mjs",
        why: "No floating captions over tokens at all.",
        when: "always",
        probe: () => {
            const group = foundry.canvas?.groups?.InterfaceCanvasGroup
                ?? globalThis.InterfaceCanvasGroup;
            const fn = group?.prototype?.createScrollingText;
            return {
                present: typeof fn === "function",
                ours: Boolean(fn?.[Symbol.for("drpgNoScrollingText")])
            };
        }
    },
    {
        target: "ApplicationV2.prototype.close",
        file: "motion.mjs",
        why: "Marks a module window as closing so its exit plays, and plays the close sound.",
        when: "always",
        probe: () => {
            const fn = foundry.applications?.api?.ApplicationV2?.prototype?.close;
            return { present: typeof fn === "function", ours: fn?.name === "drpgClose" };
        }
    },
    {
        target: "ui.notifications.info and .warn",
        file: "voice.mjs",
        why: "Silences avclient-livekit's own toasts, which the module reports in its own words.",
        when: `only while ${AV_MODULE} is active`,
        probe: () => {
            const levels = ["info", "warn"].map(level => ui.notifications?.[level]);
            return {
                present: levels.every(fn => typeof fn === "function"),
                ours: levels.every(fn => Boolean(fn?.__drpgVoicePatched))
            };
        }
    },
    {
        target: "Token _refreshState (Isometric Perspective's own override)",
        file: "iso-shield.mjs",
        why: "Keeps the isometric module's override out of the way while a token is edited.",
        when: "only while Isometric Perspective is active and the shield is on",
        probe: () => {
            // Present if any prototype between the token class and core's
            // Token still owns the override this shield parks.
            let proto = CONFIG.Token?.objectClass?.prototype;
            const floor = foundry.canvas?.placeables?.Token?.prototype ?? null;
            let present = false;
            while (proto && proto !== Object.prototype && proto !== floor) {
                if (Object.prototype.hasOwnProperty.call(proto, "_refreshState")) {
                    present = true;
                    break;
                }
                proto = Object.getPrototypeOf(proto);
            }
            return { present, ours: refreshStateParked() };
        }
    },
    {
        target: "render, as an own property on each open character sheet",
        file: "sheet.mjs",
        why: "A resource-only update skips one redraw, so the sheet does not flicker on every Hope or Health change.",
        when: "per sheet, armed by the first resource-only update it sees",
        probe: () => {
            const sheets = [...(foundry.applications?.instances?.values?.() ?? [])]
                .filter(app => app?.document?.type === "character");
            const armed = sheets.filter(app => Object.hasOwn(app, "render")).length;
            return {
                present: typeof foundry.applications?.api?.ApplicationV2?.prototype?.render === "function",
                ours: sheets.length ? armed === sheets.length : null,
                note: `${armed} of ${sheets.length} open character sheets carry it`
            };
        }
    }
];

/**
 * Read the table. Prints one row per override and returns the rows, so a
 * macro can look at the answer as well as a person.
 *
 * `present: false` is the finding this exists for: the method the override
 * expects is not there, which means a Foundry or Daggerheart update moved it
 * and the feature has quietly stopped. `ours: false` on a row whose `when` is
 * "always" means something else replaced our wrapper after it was installed.
 */
export function diagnosePatches() {
    const rows = PATCHES.map(entry => {
        let result;
        try {
            result = entry.probe();
        } catch (err) {
            result = { present: false, ours: null, note: String(err?.message ?? err) };
        }
        return {
            target: entry.target,
            file: entry.file,
            why: entry.why,
            when: entry.when,
            present: result.present,
            ours: result.ours,
            note: result.note ?? ""
        };
    });
    console.table(rows);
    return rows;
}
