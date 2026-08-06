/**
 * MACRO: Advancement
 * ---------------------------------------------------------------------------
 * Runs the guide's advancement for a character.
 *
 *   Standard    — for everyone who voted for the correct Blackened. Pick 1.
 *   Reinforced  — for a Blackened who survived a wrong vote. Pick 3.
 *
 * Select a token first and it uses that character; otherwise it asks which one.
 * The result is whispered to the player and the GMs, never to the table.
 *
 * Macro type: Script.  Run by: GM.
 */

const DialogV2 = foundry.applications.api.DialogV2;

if (!game.user.isGM) {
    ui.notifications.warn("Only the GM runs advancement.");
} else if (!game.drpg) {
    ui.notifications.error("The Danganronpa RPG module is not active.");
} else {
    await run();
}

async function run() {
    const actor = await pickActor();
    if (!actor) return;

    const kind = await DialogV2.wait({
        window: { title: `Advancement — ${actor.name}` },
        content: `<p>Which advancement did <strong>${foundry.utils.escapeHTML(actor.name)}</strong> earn?</p>`,
        buttons: [
            { action: "standard", label: "Standard (pick 1)", default: true },
            { action: "reinforced", label: "Reinforced (pick 3)" },
            { action: "cancel", label: "Cancel" }
        ],
        rejectClose: false
    });

    if (!kind || kind === "cancel") return;
    await game.drpg.advance(actor, kind);
}

/** Selected token's actor, or a picker over every character. */
async function pickActor() {
    const selected = canvas.tokens?.controlled?.map(t => t.actor).filter(a => a?.type === "character") ?? [];
    if (selected.length === 1) return selected[0];

    const characters = game.actors.filter(a => a.type === "character");
    if (!characters.length) {
        ui.notifications.warn("There are no characters in this world yet.");
        return null;
    }

    const options = characters
        .map(a => `<option value="${a.id}">${foundry.utils.escapeHTML(a.name)}</option>`)
        .join("");

    const id = await DialogV2.wait({
        window: { title: "Advancement" },
        content: `<form><label>Character
                    <select name="actorId">${options}</select>
                  </label></form>`,
        buttons: [
            {
                action: "ok",
                label: "Continue",
                default: true,
                callback: (event, button, dialog) => dialog.element.querySelector("[name=actorId]").value
            },
            { action: "cancel", label: "Cancel" }
        ],
        rejectClose: false
    });

    if (!id || id === "cancel") return null;
    return game.actors.get(id);
}
