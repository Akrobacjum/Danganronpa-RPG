/**
 * Danganronpa RPG — Advancement.
 * ---------------------------------------------------------------------------
 * Replaces the Daggerheart level-up entirely. The guide gives two flavours:
 *
 *   Standard    — everyone who voted for the correct Blackened picks ONE.
 *   Reinforced  — a Blackened who survived a wrong vote picks THREE.
 *
 * Options (repeatable — picking "+1 max HP" three times means +3):
 *   +1 max HP · +1 max Stress · +1 to a trait · +1 to an experience ·
 *   a new experience at +2
 */

import { MODULE_ID, FLAGS, LEVEL_UP, LEVEL_UP_OPTIONS, TRAITS, STARTING } from "./config.mjs";
import { listExperiences, resourceMax } from "./character.mjs";
import { log, error } from "./utils.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/**
 * Resolved on use, not at import time. Foundry moved FormDataExtended under
 * `foundry.applications.ux` and keeps a deprecated global alias; resolving it
 * eagerly would throw during module load on any build that drops the global,
 * taking the whole file down instead of one dialog.
 */
function readFormData(form) {
    const FDE = foundry.applications?.ux?.FormDataExtended ?? globalThis.FormDataExtended;
    if (FDE) return new FDE(form).object;

    // Last resort: plain FormData still gives us every named control.
    return Object.fromEntries(new FormData(form).entries());
}

/**
 * Ask which advancement was earned, then open the picker. This is what the
 * button on the character sheet calls, so the GM never has to remember the
 * argument names.
 *
 * @param {Actor} actor
 */
export async function openAdvancementFor(actor) {
    if (!actor || actor.type !== "character") {
        ui.notifications.warn(game.i18n.localize("DRPG.Character.notACharacter"));
        return null;
    }

    const kind = await DialogV2.wait({
        window: { title: game.i18n.format("DRPG.Advance.title", { actor: actor.name }) },
        content: `<p>${game.i18n.format("DRPG.Advance.whichKind", {
            actor: foundry.utils.escapeHTML(actor.name)
        })}</p>`,
        buttons: [
            { action: "standard", label: game.i18n.localize("DRPG.Advance.kind.standard"), default: true },
            { action: "reinforced", label: game.i18n.localize("DRPG.Advance.kind.reinforced") },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!kind || kind === "cancel") return null;
    return openAdvancement(actor, kind);
}

/**
 * Open the advancement dialog for an actor.
 *
 * @param {Actor} actor
 * @param {"standard"|"reinforced"} kind
 */
export async function openAdvancement(actor, kind = "standard") {
    // Advancement is the GM's to award. The sheet button is already GM-only, but
    // this is also on `game.drpg`, so without the check any player could call it
    // from the console and raise their own max HP and traits.
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    if (!actor || actor.type !== "character") {
        ui.notifications.warn(game.i18n.localize("DRPG.Character.notACharacter"));
        return null;
    }

    const picks = LEVEL_UP[kind]?.picks;
    if (!picks) {
        ui.notifications.error(game.i18n.format("DRPG.Advance.unknownKind", { kind }));
        return null;
    }

    const experiences = listExperiences(actor);

    const result = await DialogV2.wait({
        window: { title: game.i18n.format("DRPG.Advance.title", { actor: actor.name }) },
        classes: ["drpg-advance"],
        content: buildContent(actor, kind, picks, experiences),
        buttons: [
            {
                action: "apply",
                label: game.i18n.localize("DRPG.Advance.apply"),
                default: true,
                callback: (event, button, dialog) => readForm(dialog, picks)
            },
            {
                action: "cancel",
                label: game.i18n.localize("DRPG.Advance.cancel")
            }
        ],
        render: (event, dialog) => wireForm(dialog, picks, actor, experiences),
        rejectClose: false
    });

    if (!result || result === "cancel") return null;
    return applyAdvancement(actor, result, kind);
}

/* ==========================================================================
 * FORM
 * ========================================================================== */

function buildContent(actor, kind, picks, experiences) {
    const intro = game.i18n.format(
        picks === 1 ? "DRPG.Advance.introOne" : "DRPG.Advance.introMany",
        { picks, reason: game.i18n.localize(`DRPG.Advance.reason.${kind}`) }
    );

    const rows = Array.from({ length: picks }, (_, i) => `
        <fieldset class="drpg-advance-pick" data-index="${i}">
            <legend>${game.i18n.format("DRPG.Advance.choice", { n: i + 1 })}</legend>
            <select name="pick.${i}.option" data-pick="${i}">
                ${Object.entries(LEVEL_UP_OPTIONS)
                    .map(([key, opt]) => `<option value="${key}">${opt.label}</option>`)
                    .join("")}
            </select>
            <div class="drpg-advance-detail" data-detail="${i}"></div>
        </fieldset>
    `).join("");

    const warning = experiences.length
        ? ""
        : `<p class="notification warning">${game.i18n.localize("DRPG.Advance.noExperiences")}</p>`;

    return `<form><p>${intro}</p>${warning}${rows}</form>`;
}

/** Swap the detail control whenever a pick's option changes. */
function wireForm(dialog, picks, actor, experiences) {
    const root = dialog.element;

    for (let i = 0; i < picks; i++) {
        const select = root.querySelector(`select[data-pick="${i}"]`);
        const detail = root.querySelector(`[data-detail="${i}"]`);
        if (!select || !detail) continue;

        const refresh = () => {
            detail.innerHTML = buildDetail(select.value, i, actor, experiences);
        };
        select.addEventListener("change", refresh);
        refresh();
    }
}

function buildDetail(option, index, actor, experiences) {
    switch (option) {
        case "trait": {
            const options = Object.entries(TRAITS)
                .map(([, t]) => {
                    const value = actor.system.traits?.[t.dh]?.value ?? 0;
                    const sign = value > 0 ? `+${value}` : `${value}`;
                    return `<option value="${t.dh}">${t.label} (${sign})</option>`;
                })
                .join("");
            return `<label>${game.i18n.localize("DRPG.Advance.whichTrait")}
                        <select name="pick.${index}.trait">${options}</select>
                    </label>`;
        }

        case "experienceUp": {
            if (!experiences.length) {
                return `<p class="notification warning">${game.i18n.localize("DRPG.Advance.noExperiences")}</p>`;
            }
            const options = experiences
                .map(e => `<option value="${e.id}">${foundry.utils.escapeHTML(e.name || "—")} (+${e.value ?? 0})</option>`)
                .join("");
            return `<label>${game.i18n.localize("DRPG.Advance.whichExperience")}
                        <select name="pick.${index}.experience">${options}</select>
                    </label>`;
        }

        case "experienceNew":
            return `<label>${game.i18n.localize("DRPG.Advance.newExperienceName")}
                        <input type="text" name="pick.${index}.name" placeholder="${game.i18n.localize("DRPG.Advance.newExperiencePlaceholder")}" />
                    </label>`;

        default:
            return "";
    }
}

function readForm(dialog, picks) {
    const form = dialog.element.querySelector("form");
    if (!form) return null;

    const flat = readFormData(form);
    const data = foundry.utils.expandObject(flat);
    const list = [];

    for (let i = 0; i < picks; i++) {
        const pick = data.pick?.[i];
        if (!pick?.option) continue;
        list.push(pick);
    }
    return list;
}

/* ==========================================================================
 * APPLY
 * ========================================================================== */

/**
 * Turn a list of picks into a single actor update, so three "+1 max HP" picks
 * accumulate instead of overwriting each other.
 */
export async function applyAdvancement(actor, picks, kind = "standard") {
    // Same guard as `openAdvancement`, and for the same reason. This is also on
    // `game.drpg`, and it writes through `automatedUpdate` — which bypasses the
    // resource guard by design — so without it a player could raise their own
    // max HP and traits from the console with a single call, walking straight
    // past the check the dialog in front of it makes.
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }
    if (!actor || !picks?.length) return null;

    const update = {};
    const summary = [];

    // Start from current values and accumulate.
    let hpMax = resourceMax(actor, "hitPoints");
    let stressMax = resourceMax(actor, "stress");
    const traitDeltas = {};
    const experienceDeltas = {};
    const newExperiences = {};

    for (const pick of picks) {
        switch (pick.option) {
            case "hp":
                hpMax += 1;
                summary.push(LEVEL_UP_OPTIONS.hp.label);
                break;

            case "stress":
                stressMax += 1;
                summary.push(LEVEL_UP_OPTIONS.stress.label);
                break;

            case "trait": {
                const key = pick.trait;
                if (!key) break;
                traitDeltas[key] = (traitDeltas[key] ?? 0) + 1;
                const label = Object.values(TRAITS).find(t => t.dh === key)?.label ?? key;
                summary.push(`+1 ${label}`);
                break;
            }

            case "experienceUp": {
                const id = pick.experience;
                if (!id) break;
                experienceDeltas[id] = (experienceDeltas[id] ?? 0) + 1;
                const name = actor.system.experiences?.[id]?.name ?? id;
                summary.push(`+1 ${name}`);
                break;
            }

            case "experienceNew": {
                const name = String(pick.name ?? "").trim();
                if (!name) {
                    ui.notifications.warn(game.i18n.localize("DRPG.Advance.experienceNeedsName"));
                    break;
                }
                newExperiences[foundry.utils.randomID()] = {
                    name,
                    value: STARTING.experienceValue,
                    description: "",
                    core: false
                };
                summary.push(`${name} (+${STARTING.experienceValue})`);
                break;
            }
        }
    }

    if (hpMax !== resourceMax(actor, "hitPoints")) update["system.resources.hitPoints.max"] = hpMax;
    if (stressMax !== resourceMax(actor, "stress")) update["system.resources.stress.max"] = stressMax;

    for (const [key, delta] of Object.entries(traitDeltas)) {
        const current = actor.system.traits?.[key]?.value ?? 0;
        update[`system.traits.${key}.value`] = current + delta;
    }

    for (const [id, delta] of Object.entries(experienceDeltas)) {
        const current = actor.system.experiences?.[id]?.value ?? 0;
        update[`system.experiences.${id}.value`] = current + delta;
    }

    for (const [id, data] of Object.entries(newExperiences)) {
        update[`system.experiences.${id}`] = data;
    }

    if (!Object.keys(update).length) {
        ui.notifications.info(game.i18n.localize("DRPG.Advance.nothingToApply"));
        return null;
    }

    try {
        // Marked as automation: `system.traits` is guarded against hand-editing,
        // so a plain update would have the trait rise silently stripped while the
        // HP and Stress rises went through — a half-applied advancement.
        const { automatedUpdate } = await import("./resource-guard.mjs");
        await automatedUpdate(actor, update);
        const taken = (actor.getFlag(MODULE_ID, FLAGS.advances) ?? 0) + 1;
        await actor.setFlag(MODULE_ID, FLAGS.advances, taken);

        log(`Advancement (${kind}) applied to ${actor.name}: ${summary.join(", ")}`);
        await tellPlayer(actor, kind, summary, taken);
        return summary;
    } catch (err) {
        error("Could not apply the advancement", err);
        ui.notifications.error(game.i18n.localize("DRPG.Advance.failed"));
        return null;
    }
}

/** Private note to the player and the GMs. Advancement is not public knowledge. */
async function tellPlayer(actor, kind, summary, taken) {
    const { whisperToOwner } = await import("./utils.mjs");
    const title = game.i18n.localize(`DRPG.Advance.reason.${kind}`);
    const items = summary.map(s => `<li>${foundry.utils.escapeHTML(s)}</li>`).join("");
    return whisperToOwner(
        actor,
        `<h3>${game.i18n.format("DRPG.Advance.chatTitle", { n: taken })}</h3>
         <p><em>${title}</em></p>
         <ul>${items}</ul>`
    );
}
