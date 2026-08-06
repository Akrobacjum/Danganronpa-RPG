/**
 * Danganronpa RPG — GM panel.
 * ---------------------------------------------------------------------------
 * The handful of things a GM does every time of day, behind one button in the
 * token toolbar: move the clock, refill actions, restock search tokens, check
 * where everyone stands.
 */

import { TIMES_OF_DAY, TIME_OF_DAY_LABELS, PHASES, CHAPTERS_PER_SEASON } from "./config.mjs";
import { getClock, setClock, advanceTimeOfDay, setTimeOfDay, clockSummary, timeOfDayLabel, phaseLabel, campaignName } from "./clock.mjs";
import { resetAllActions, actionsLeft, actionsMax, hasFreeMove } from "./actions.mjs";
import { SearchTokens } from "./search-tokens.mjs";
import { auditAnonymity } from "./anonymity.mjs";
import { error } from "./utils.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/** Add the panel button to the token toolbar, GM only. */
export function registerGmPanel() {
    Hooks.on("getSceneControlButtons", controls => {
        if (!game.user.isGM) return;
        const tokens = controls.tokens;
        if (!tokens?.tools) return;

        tokens.tools.drpgGmPanel = {
            name: "drpgGmPanel",
            title: "DRPG.Panel.title",
            icon: "fa-solid fa-clock",
            button: true,
            visible: true,
            onChange: () => openGmPanel()
        };
    });
}

/** Open the panel. */
export async function openGmPanel() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return;
    }

    const action = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Panel.title") },
        classes: ["drpg-panel"],
        content: buildPanelContent(),
        buttons: [
            { action: "eclipse", label: game.i18n.localize("DRPG.Eclipse.button"), default: true },
            { action: "advance", label: game.i18n.localize("DRPG.Panel.advance") },
            { action: "jump", label: game.i18n.localize("DRPG.Panel.jump") },
            { action: "more", label: game.i18n.localize("DRPG.Panel.more") },
            { action: "handbook", label: game.i18n.localize("DRPG.Panel.handbook") },
            { action: "close", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        rejectClose: false
    });

    try {
        switch (action) {
            case "eclipse": return void await toggleEclipse();
            case "advance": return void await advanceTimeOfDay();
            case "jump": return void await openClockDialog();
            case "more": return void await openMoreDialog();
            case "handbook": {
                const { installHandbook } = await import("./handbook.mjs");
                return void await installHandbook();
            }
        }
    } catch (err) {
        error("GM panel action failed", err);
        ui.notifications.error(game.i18n.localize("DRPG.Panel.failed"));
    }
}

/**
 * Start the placement window, or close it and begin the time of day.
 * When closing, shows who has actually finished placing.
 */
async function toggleEclipse() {
    const { isEclipse, startEclipse, endEclipse, placementStatus, ECLIPSE_MOVES } = await import("./eclipse.mjs");

    if (!isEclipse()) return startEclipse();

    const rows = placementStatus().map(s => `
        <tr${s.left === ECLIPSE_MOVES ? ' style="opacity:.55"' : ""}>
            <td>${foundry.utils.escapeHTML(s.actor.name)}</td>
            <td>${foundry.utils.escapeHTML(s.room ?? "—")}</td>
            <td style="text-align:center">${s.moved} / ${ECLIPSE_MOVES}</td>
        </tr>`).join("");

    const choice = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Eclipse.title") },
        classes: ["drpg-panel"],
        content: `<p>${game.i18n.localize("DRPG.Eclipse.endPrompt")}</p>
            <table><thead><tr>
                <th>${game.i18n.localize("DRPG.Panel.character")}</th>
                <th>${game.i18n.localize("DRPG.Project.room")}</th>
                <th>${game.i18n.localize("DRPG.Eclipse.movesColumn")}</th>
            </tr></thead><tbody>${rows}</tbody></table>`,
        buttons: [
            { action: "end", label: game.i18n.localize("DRPG.Eclipse.endAndAdvance"), default: true },
            { action: "endOnly", label: game.i18n.localize("DRPG.Eclipse.endOnly") },
            { action: "cancel", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        rejectClose: false
    });

    if (choice === "end") return endEclipse({ advance: true });
    if (choice === "endOnly") return endEclipse({ advance: false });
    return null;
}

/** Current standing: where the clock is and what everyone has left. */
function buildPanelContent() {
    const clock = getClock();

    const rows = game.actors
        .filter(a => a.type === "character")
        .map(a => {
            const left = actionsLeft(a);
            const max = actionsMax(a);
            const move = hasFreeMove(a)
                ? `<i class="fa-solid fa-shoe-prints" title="free Move available"></i>`
                : "—";
            const low = left === 0 ? ' style="opacity:.55"' : "";
            return `<tr${low}>
                        <td>${foundry.utils.escapeHTML(a.name)}</td>
                        <td style="text-align:center">${left} / ${max}</td>
                        <td style="text-align:center">${move}</td>
                    </tr>`;
        })
        .join("");

    const table = rows
        ? `<table>
             <thead><tr>
               <th>${game.i18n.localize("DRPG.Panel.character")}</th>
               <th style="text-align:center">${game.i18n.localize("DRPG.Actions.label")}</th>
               <th style="text-align:center">${game.i18n.localize("DRPG.Panel.freeMove")}</th>
             </tr></thead>
             <tbody>${rows}</tbody>
           </table>`
        : `<p>${game.i18n.localize("DRPG.Panel.noCharacters")}</p>`;

    return `<div>
                <h3>${foundry.utils.escapeHTML(campaignName(clock))}</h3>
                <p><strong>${game.i18n.format("DRPG.Hud.chapter", { n: clock.chapter })}
                   · ${phaseLabel(clock.phase)}
                   · ${timeOfDayLabel(clock.timeOfDay)}</strong></p>
                <p>${clockSummary(clock)}</p>
                <p><em>${game.i18n.localize("DRPG.Panel.advanceHint")}</em></p>
                ${table}
            </div>`;
}

/* ==========================================================================
 * SUB-DIALOGS
 * ========================================================================== */

/**
 * Edit everything the HUD shows: campaign name, chapter, phase, session and
 * time of day. Opened from the HUD's gear or the panel.
 */
export async function openClockDialog() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return;
    }

    const clock = getClock();

    const times = TIMES_OF_DAY
        .map(t => `<option value="${t}"${t === clock.timeOfDay ? " selected" : ""}>${TIME_OF_DAY_LABELS[t]}</option>`)
        .join("");

    const phases = Object.entries(PHASES)
        .map(([key, p]) => `<option value="${key}"${key === clock.phase ? " selected" : ""}>${p.label}</option>`)
        .join("");

    const chapters = Array.from({ length: CHAPTERS_PER_SEASON }, (_, i) => i + 1)
        .map(n => `<option value="${n}"${n === clock.chapter ? " selected" : ""}>${n}</option>`)
        .join("");

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Panel.jump") },
        classes: ["drpg-panel"],
        content: `<form>
                    <label>${game.i18n.localize("DRPG.Clock.campaignName")}
                        <input type="text" name="campaignName"
                               value="${foundry.utils.escapeHTML(clock.campaignName ?? "")}"
                               placeholder="${foundry.utils.escapeHTML(game.world?.title ?? "")}" />
                    </label>
                    <label>${game.i18n.localize("DRPG.Clock.chapter")}
                        <select name="chapter">${chapters}</select>
                    </label>
                    <label>${game.i18n.localize("DRPG.Clock.phase")}
                        <select name="phase">${phases}</select>
                    </label>
                    <label>${game.i18n.localize("DRPG.Clock.day")}
                        <input type="number" name="day" value="${clock.day ?? 1}" min="1" step="1" />
                    </label>
                    <label>${game.i18n.localize("DRPG.Clock.session")}
                        <input type="number" name="session" value="${clock.session}" min="1" step="1" />
                    </label>
                    <label>${game.i18n.localize("DRPG.Clock.timeOfDay")}
                        <select name="timeOfDay">${times}</select>
                    </label>
                    <hr />
                    <label class="drpg-checkbox">
                        <input type="checkbox" name="reset" />
                        ${game.i18n.localize("DRPG.Panel.alsoReset")}
                    </label>
                    <p class="notes">${game.i18n.localize("DRPG.Panel.resetHint")}</p>
                  </form>`,
        buttons: [
            {
                action: "ok",
                label: game.i18n.localize("DRPG.Panel.apply"),
                default: true,
                callback: (event, button, dialog) => {
                    const form = dialog.element.querySelector("form");
                    return {
                        campaignName: form.campaignName.value.trim(),
                        chapter: Number(form.chapter.value) || 1,
                        day: Number(form.day.value) || 1,
                        phase: form.phase.value,
                        session: Number(form.session.value) || 1,
                        timeOfDay: form.timeOfDay.value,
                        reset: form.reset.checked
                    };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return;

    await setClock({
        campaignName: result.campaignName,
        chapter: result.chapter,
        day: result.day,
        phase: result.phase,
        session: result.session,
        timeOfDay: result.timeOfDay
    });

    // Editing the clock is bookkeeping. Only refill when explicitly asked,
    // otherwise a typo correction would hand everyone fresh actions.
    if (result.reset) {
        await setTimeOfDay(result.timeOfDay, {
            resetActions: true,
            resetSearchTokens: true,
            announce: true
        });
    }
}

/** The maintenance jobs that do not belong on the main panel. */
async function openMoreDialog() {
    const action = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Panel.more") },
        content: `<p>${game.i18n.localize("DRPG.Panel.moreHint")}</p>`,
        buttons: [
            { action: "resetActions", label: game.i18n.localize("DRPG.Panel.resetActions"), default: true },
            { action: "resetSearch", label: game.i18n.localize("DRPG.Panel.resetSearch") },
            { action: "showSearch", label: game.i18n.localize("DRPG.Panel.showSearch") },
            { action: "installTables", label: game.i18n.localize("DRPG.Panel.installTables") },
            { action: "restRooms", label: game.i18n.localize("DRPG.Rest.manageTooltip") },
            { action: "listRemnants", label: game.i18n.localize("DRPG.Panel.listRemnants") },
            { action: "clearFaint", label: game.i18n.localize("DRPG.Panel.clearFaint") },
            { action: "audit", label: game.i18n.localize("DRPG.Panel.audit") },
            { action: "cancel", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        rejectClose: false
    });

    switch (action) {
        case "resetActions": {
            const results = await resetAllActions();
            ui.notifications.info(game.i18n.format("DRPG.Panel.actionsReset", { count: results.length }));
            break;
        }
        case "resetSearch":
            await SearchTokens.reset();
            break;
        case "showSearch":
            await SearchTokens.report();
            break;
        case "installTables": {
            const { installTables } = await import("./tables.mjs");
            await installTables();
            break;
        }
        case "restRooms": {
            const { openRestRoomsDialog } = await import("./rest.mjs");
            await openRestRoomsDialog();
            break;
        }
        case "listRemnants": {
            const { reportRemnants } = await import("./remnants.mjs");
            await reportRemnants();
            break;
        }
        case "clearFaint": {
            const { clearFaintRemnants } = await import("./remnants.mjs");
            const n = await clearFaintRemnants();
            ui.notifications.info(game.i18n.format("DRPG.Panel.faintCleared", { n }));
            break;
        }
        case "audit":
            await auditAnonymity();
            break;
    }
}
