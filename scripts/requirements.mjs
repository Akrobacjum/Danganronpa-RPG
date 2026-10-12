/**
 * Danganronpa RPG - the modules this one asks for.
 * ---------------------------------------------------------------------------
 * THREE ARE NOT OPTIONAL (amendment d, the owner's answer of 09.10.2026; E13
 * C10). The dice everyone watches are the module's own idea of a roll, the
 * academy maps are drawn isometric, and the rooms are voice rooms, so a world
 * without Dice So Nice, Isometric Perspective or LiveKit stops, and says which.
 * From 17.09 (M-1) through 1.2.73 the last two were only recommended, with a
 * window the GM could silence; the owner made them required, as Dice So Nice
 * is, and that window, its setting and its texts went with it. Required means
 * installed and switched on, nothing more: no LiveKit server is asked whether
 * it answers and nothing checks that voice is on (the owner's d2).
 *
 * For what is required the layer refuses to start, and says which ones and
 * what to do about it.
 * It does NOT install anything, and deliberately: what is installed on a server
 * is the person's decision, and a module that reaches for the internet on
 * someone's behalf is a different kind of thing from a module that says what it
 * needs (Dawid, 26.08).
 *
 * THE LIST LIVES IN THE MANIFEST, not here. `relationships.requires` in
 * module.json is where Foundry itself reads it - it is what makes the module
 * browser offer to install them and what the Forge shows beside the entry - so
 * a second copy in this file would be a second thing to keep in step, and the
 * one people edit would be the wrong one. This reads the manifest back.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { error, esc} from "./utils.mjs";

/** Every module the manifest marks as required, whatever their state. */
function required() {
    const rel = game.modules.get(MODULE_ID)?.relationships?.requires;
    if (!rel) return [];
    // A Set in current Foundry, an array in older ones. Both spread.
    return [...rel].filter(entry => (entry?.type ?? "module") === "module" && entry?.id);
}

/**
 * The ones that are not there, or are there and switched off.
 *
 * The two are told apart because the fix is different - one is a download and
 * one is a checkbox - and a message that says "missing" about a module sitting
 * disabled in the list sends the reader looking in the wrong place.
 *
 * The module map is an argument so R442 can ask about a world this one is not -
 * a companion switched off, one never installed - without touching the map
 * every other part of the module reads. The list of what is required still
 * comes from this world's own manifest.
 *
 * @returns {Array<{id: string, title: string, state: "absent"|"disabled", reason: string}>}
 */
export function missingRequirements(modules = game.modules) {
    return required().reduce((out, entry) => {
        const installed = modules.get(entry.id);
        if (installed?.active) return out;
        out.push({
            id: entry.id,
            title: installed?.title ?? entry.id,
            state: installed ? "disabled" : "absent",
            reason: entry.reason ?? ""
        });
        return out;
    }, []);
}

export function requirementsMet(modules = game.modules) {
    try {
        return missingRequirements(modules).length === 0;
    } catch (err) {
        // A check that cannot run must not be the thing that stops the module:
        // that would turn a bad read of the manifest into a dead world.
        error("Could not check the required modules; carrying on without the check.", err);
        return true;
    }
}

/**
 * Say what is missing, once the interface exists to say it in.
 *
 * The GM gets a window, because the GM is the only person who can fix it and a
 * notification is dismissible by accident. Everyone else gets a notification
 * that does not time out - they cannot act on it, but a player whose sheet has
 * no actions on it is owed the reason.
 */
export async function announceMissingRequirements() {
    const missing = missingRequirements();
    if (!missing.length) return;

    const names = missing.map(m => m.title).join(", ");
    error(`Not starting: required modules unavailable - ${
        missing.map(m => `${m.id} (${m.state})`).join(", ")}.`);

    if (!game.user.isGM) {
        ui.notifications.error(
            game.i18n.format("DRPG.Requirements.playerNotice", { modules: names }),
            { permanent: true });
        return;
    }

    const rows = missing.map(m => `
        <li>
            <strong>${esc(m.title)}</strong>
            <span class="notes">${game.i18n.localize(`DRPG.Requirements.state.${m.state}`)}</span>
            ${m.reason ? `<div class="notes">${esc(m.reason)}</div>` : ""}
        </li>`).join("");

    try {
        const DialogV2 = foundry.applications.api.DialogV2;
        await DialogV2.wait({
            window: { title: game.i18n.localize("DRPG.Requirements.title") },
            classes: ["drpg-panel"],
            content: `<div class="drpg-requirements">
                <p>${game.i18n.localize("DRPG.Requirements.intro")}</p>
                <ul>${rows}</ul>
                <p class="notes">${game.i18n.localize("DRPG.Requirements.how")}</p>
            </div>`,
            buttons: [{
                action: "ok",
                label: game.i18n.localize("DRPG.Requirements.understood"),
                default: true
            }],
            rejectClose: false
        });
    } catch (err) {
        // Whatever happens to the window, the GM still gets told.
        error("Could not show the missing-requirements window", err);
        ui.notifications.error(
            game.i18n.format("DRPG.Requirements.playerNotice", { modules: names }),
            { permanent: true });
    }
}


/* ==========================================================================
 * THE SYSTEM, NEWER THAN ANYBODY MEASURED (E01, 24.09.2026; audit S01-09, D1)
 * ========================================================================== */

/**
 * The Daggerheart versions the manifest states: `{ minimum, verified }`.
 *
 * Read back from `relationships.systems` for the same reason the required
 * modules are: that is where Foundry reads it, so it is the copy people keep up
 * to date. `module.mjs` used to hold its own "2.6.0", which nobody had measured.
 */
export function systemCompatibility() {
    const systems = game.modules.get(MODULE_ID)?.relationships?.systems;
    const entry = [...(systems ?? [])].find(s => s?.id === game.system?.id);
    return {
        minimum: entry?.compatibility?.minimum ?? null,
        verified: entry?.compatibility?.verified ?? null
    };
}

/**
 * What the newer-system warning would say, or null when the system is not newer
 * than the one verified. The versions can be handed in, which is how R130 asks
 * about a Daggerheart this world is not running.
 *
 * @returns {Promise<{found: string, verified: string, missing: string[]}|null>}
 */
export async function newerSystemFindings({
    found = game.system?.version, verified = systemCompatibility().verified
} = {}) {
    if (!verified || !found || !foundry.utils.isNewerVersion(found, verified)) return null;
    let missing = [];
    try {
        const { diagnosePatches } = await import("./patches.mjs");
        missing = diagnosePatches()
            .filter(row => row.owner === game.system?.id && !row.present)
            .map(row => row.target);
    } catch (err) {
        error("Could not probe the patches against this Daggerheart", err);
    }
    return { found, verified, missing };
}

/**
 * Tell the GM, once per Daggerheart version, that the system is newer than the
 * one this module was measured on.
 *
 * WHY THIS AND NOT A BLOCK (decision D1). The manifest states no maximum, so a
 * newer Daggerheart loads - which is what a table that updates its system wants,
 * and what makes this warning the only thing standing between a stranger's GM
 * and a roll window that stopped working without a word. Foundry's own notice
 * says "unverified" and nothing about what. This says what the module leans on,
 * and runs the patch probe (`diagnosePatches`) so a wrapper that no longer finds
 * its target is named here rather than discovered mid-trial.
 *
 * Silenced per version (`systemWarningSilenced`), per browser, by the checkbox
 * in its own window.
 */
export async function announceNewerSystem() {
    if (!game.user.isGM) return;
    // Silenced first, so a table that said "not again" is not probed on every load.
    let silenced = "";
    try {
        silenced = String(game.settings.get(MODULE_ID, SETTINGS.systemWarningSilenced) ?? "");
    } catch {
        silenced = "";
    }
    if (silenced && silenced === game.system?.version) return;

    const findings = await newerSystemFindings();
    if (!findings) return;
    const { found, verified, missing } = findings;

    const system = game.system?.title ?? game.system?.id;
    const probe = missing.length
        ? `<p>${game.i18n.localize("DRPG.Requirements.newerSystemPatches")}</p>
           <ul>${missing.map(target => `<li><code>${esc(target)}</code></li>`).join("")}</ul>`
        : `<p class="notes">${game.i18n.localize("DRPG.Requirements.newerSystemAllPatches")}</p>`;

    try {
        const DialogV2 = foundry.applications.api.DialogV2;
        const answer = await DialogV2.wait({
            window: { title: game.i18n.format("DRPG.Requirements.newerSystemTitle", { system }) },
            classes: ["drpg-panel"],
            content: `<form class="drpg-requirements">
                <p>${game.i18n.format("DRPG.Requirements.newerSystemIntro",
                    { system: esc(system), found: esc(found), verified: esc(verified) })}</p>
                ${probe}
                <label class="drpg-inline-check"><input type="checkbox" name="silence" />
                    ${game.i18n.format("DRPG.Requirements.newerSystemSilence", { found: esc(found) })}</label>
            </form>`,
            buttons: [{
                action: "ok",
                label: game.i18n.localize("DRPG.Requirements.understood"),
                default: true,
                callback: (event, button, dialog) => ({
                    silence: Boolean(dialog.element.querySelector("[name=silence]")?.checked)
                })
            }],
            rejectClose: false
        });
        if (answer?.silence) await game.settings.set(MODULE_ID, SETTINGS.systemWarningSilenced, found);
    } catch (err) {
        error("Could not show the newer-system window", err);
        ui.notifications.warn(game.i18n.format("DRPG.Requirements.newerSystemNotice",
            { system, found, verified }));
    }
}
