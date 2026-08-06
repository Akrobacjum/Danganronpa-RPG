/**
 * Danganronpa RPG — the student-division dialog.
 * ---------------------------------------------------------------------------
 * One row per student, one dropdown per row: which Monokuma carries them.
 * "Split evenly" fills the whole table in one click, which is what the guide
 * assumes at the start of a season.
 */

import { monokumas } from "./despair.mjs";
import { students, assignments, monokumaFor, setAssignments, autoAssign, NO_MONOKUMA } from "./assignments.mjs";
import { error } from "./utils.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

export async function openAssignmentDialog() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return;
    }

    const gms = monokumas();
    if (!gms.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Assign.noMonokumas"));
        return;
    }

    const roster = students();
    if (!roster.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.noCharacters"));
        return;
    }

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Assign.title") },
        classes: ["drpg-panel", "drpg-assign"],
        content: buildContent(roster, gms),
        buttons: [
            {
                action: "save",
                label: game.i18n.localize("DRPG.Assign.save"),
                default: true,
                callback: (event, button, dialog) => readForm(dialog, roster)
            },
            { action: "auto", label: game.i18n.localize("DRPG.Assign.splitEvenly") },
            { action: "cancel", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        render: (event, dialog) => wireLiveCounts(dialog, gms),
        rejectClose: false
    });

    try {
        if (result === "auto") {
            await autoAssign();
            ui.notifications.info(game.i18n.localize("DRPG.Assign.splitDone"));
            return openAssignmentDialog();
        }
        if (result && result !== "cancel") {
            await setAssignments(result);
            ui.notifications.info(game.i18n.localize("DRPG.Assign.saved"));
        }
    } catch (err) {
        error("Could not save the student division", err);
        ui.notifications.error(game.i18n.localize("DRPG.Assign.failed"));
    }
}

function buildContent(roster, gms) {
    const current = assignments();

    const rows = roster.map(actor => {
        const raw = current[actor.id];
        const excluded = raw === NO_MONOKUMA;
        const assigned = excluded ? NO_MONOKUMA : (raw ?? monokumaFor(actor)?.id ?? gms[0].id);

        const options = [
            ...gms.map(u => `<option value="${u.id}"${u.id === assigned ? " selected" : ""}>${foundry.utils.escapeHTML(u.name)}</option>`),
            `<option value="${NO_MONOKUMA}"${excluded ? " selected" : ""}>${game.i18n.localize("DRPG.Assign.nobody")}</option>`
        ].join("");

        const explicit = excluded || gms.some(u => u.id === raw);

        return `<tr${excluded ? ' class="drpg-assign-excluded"' : ""}>
                    <td>${foundry.utils.escapeHTML(actor.name)}${explicit ? "" : ` <span class="drpg-assign-implicit" data-tooltip="${game.i18n.localize("DRPG.Assign.implicitHint")}">*</span>`}</td>
                    <td><select name="${actor.id}" data-drpg-assign>${options}</select></td>
                </tr>`;
    }).join("");

    return `<form>
                <p>${game.i18n.localize("DRPG.Assign.intro")}</p>
                <div class="drpg-assign-counts"></div>
                <table>
                    <thead><tr>
                        <th>${game.i18n.localize("DRPG.Panel.character")}</th>
                        <th>${game.i18n.localize("DRPG.Assign.monokuma")}</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table>
                <p class="notes">${game.i18n.localize("DRPG.Assign.footnote")}</p>
            </form>`;
}

/** Live tally per Monokuma, so an uneven split is obvious before saving. */
function wireLiveCounts(dialog, gms) {
    const root = dialog.element;
    const box = root.querySelector(".drpg-assign-counts");
    if (!box) return;

    const update = () => {
        const tally = Object.fromEntries(gms.map(u => [u.id, 0]));
        let excluded = 0;

        for (const select of root.querySelectorAll("[data-drpg-assign]")) {
            if (select.value === NO_MONOKUMA) excluded++;
            else if (select.value in tally) tally[select.value]++;
            select.closest("tr")?.classList.toggle("drpg-assign-excluded", select.value === NO_MONOKUMA);
        }

        const counts = gms.map(u =>
            `<span class="drpg-assign-count"><strong>${foundry.utils.escapeHTML(u.name)}</strong>: ${tally[u.id]}</span>`
        );
        if (excluded) {
            counts.push(`<span class="drpg-assign-count drpg-assign-none">${game.i18n.localize("DRPG.Assign.nobody")}: ${excluded}</span>`);
        }
        box.innerHTML = counts.join("");
    };

    root.querySelectorAll("[data-drpg-assign]").forEach(s => s.addEventListener("change", update));
    update();
}

function readForm(dialog, roster) {
    const map = {};
    for (const actor of roster) {
        const select = dialog.element.querySelector(`[name="${CSS.escape(actor.id)}"]`);
        if (select?.value) map[actor.id] = select.value;
    }
    return map;
}
