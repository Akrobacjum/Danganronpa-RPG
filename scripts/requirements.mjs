/**
 * Danganronpa RPG - the modules this one cannot do without.
 * ---------------------------------------------------------------------------
 * Four modules are not optional here: the dice everyone watches, the isometric
 * projection the maps are drawn in, the library those patches go through, and
 * the voice layer the rooms are wired to. A world missing any of them is not a
 * slightly reduced version of this game - it is a game whose maps are laid out
 * wrong, whose rolls happen invisibly and whose rooms are silent.
 *
 * So the layer refuses to start, and says which ones and what to do about it.
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
import { error } from "./utils.mjs";

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

    const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
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
