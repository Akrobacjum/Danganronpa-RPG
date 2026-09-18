/**
 * Danganronpa RPG - the modules this one asks for.
 * ---------------------------------------------------------------------------
 * ONE IS NOT OPTIONAL, TWO ARE RECOMMENDED (M-1, Dawid 17.09). The dice
 * everyone watches are the module's own idea of a roll, so a world without
 * Dice So Nice still stops. The isometric projection and the voice layer are
 * how Dawid's own table plays, but a table on a square map with one open
 * channel is playing the same game - and refusing to start over a scene format
 * was the module telling somebody their table was wrong. They warn once now,
 * with what each one does, and the warning can be silenced.
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
 * @returns {Array<{id: string, title: string, state: "absent"|"disabled", reason: string}>}
 */
export function missingRequirements() {
    return required().reduce((out, entry) => {
        const installed = game.modules.get(entry.id);
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

export function requirementsMet() {
    try {
        return missingRequirements().length === 0;
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
 * THE TWO THIS GAME ASKS FOR BUT DOES NOT DEMAND (M-1, Dawid 17.09)
 * ========================================================================== */

/** Every module the manifest marks as recommended, whatever their state. */
function recommended() {
    const rel = game.modules.get(MODULE_ID)?.relationships?.recommends;
    if (!rel) return [];
    return [...rel].filter(entry => (entry?.type ?? "module") === "module" && entry?.id);
}

/** Which of them are not there to help, and why each one was asked for. */
export function missingRecommendations() {
    return recommended().reduce((out, entry) => {
        const installed = game.modules.get(entry.id);
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

/**
 * Say what is missing that the game would rather have, once, to the GM.
 *
 * A warning, not a stop: everything in the module runs without these two. The
 * window carries the reason each was asked for, because "install this" without
 * "here is what you are playing without" is a demand rather than advice - and a
 * checkbox that silences it for good, because a table that has decided to play
 * on square maps should not be asked again every reload.
 */
export async function announceMissingRecommendations() {
    if (!game.user.isGM) return;

    let silenced = false;
    try {
        silenced = Boolean(game.settings.get(MODULE_ID, SETTINGS.recommendsSilenced));
    } catch {
        // A world where the setting never registered still gets the warning.
        silenced = false;
    }
    if (silenced) return;

    const missing = missingRecommendations();
    if (!missing.length) return;

    const rows = missing.map(m => `
        <li>
            <strong>${esc(m.title)}</strong>
            <span class="notes">${game.i18n.localize(`DRPG.Requirements.state.${m.state}`)}</span>
            ${m.reason ? `<div class="notes">${esc(m.reason)}</div>` : ""}
        </li>`).join("");

    try {
        const DialogV2 = foundry.applications.api.DialogV2;
        const answer = await DialogV2.wait({
            window: { title: game.i18n.localize("DRPG.Requirements.recommendTitle") },
            classes: ["drpg-panel"],
            content: `<form class="drpg-requirements">
                <p>${game.i18n.localize("DRPG.Requirements.recommendIntro")}</p>
                <ul>${rows}</ul>
                <p class="notes">${game.i18n.localize("DRPG.Requirements.how")}</p>
                <label class="drpg-inline-check"><input type="checkbox" name="silence" />
                    ${game.i18n.localize("DRPG.Requirements.recommendSilence")}</label>
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
        if (answer?.silence) await game.settings.set(MODULE_ID, SETTINGS.recommendsSilenced, true);
    } catch (err) {
        // The advice is worth less than the session: say it in one line and move on.
        error("Could not show the recommended-modules window", err);
        ui.notifications.warn(game.i18n.format("DRPG.Requirements.recommendNotice",
            { modules: missing.map(m => m.title).join(", ") }));
    }
}
