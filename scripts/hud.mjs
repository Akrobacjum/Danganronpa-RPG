/**
 * Danganronpa RPG — the campaign HUD.
 * ---------------------------------------------------------------------------
 * The clock is world state, not character state, so it belongs on screen once
 * rather than repeated on every sheet. This renders it into `#ui-top`, which
 * Foundry lays out inside `#ui-middle` — top centre of the screen, clear of the
 * scene navigation on the left.
 *
 *      Hope's Peak: Drowned Summer      <- campaign name
 *              Chapter 2
 *              Daily Life
 *          ◀   Afternoon   ▶  ⚙        <- GM-only controls
 *
 * Players see the same four lines without the controls.
 */

import { MODULE_ID } from "./config.mjs";
import { getClock, campaignName, phaseLabel, timeOfDayLabel, advanceTimeOfDay, rewindTimeOfDay } from "./clock.mjs";
import { error } from "./utils.mjs";

const HUD_ID = "drpg-hud";

export function registerHud() {
    Hooks.once("ready", renderHud);

    // Foundry rebuilds parts of the interface on scene changes; re-assert.
    Hooks.on("canvasReady", () => renderHud());
}

/** Build or rebuild the HUD in place. Safe to call as often as you like. */
export function renderHud() {
    try {
        const host = document.querySelector("#ui-top") ?? document.querySelector("#ui-middle") ?? document.body;
        if (!host) return;

        document.getElementById(HUD_ID)?.remove();

        const clock = getClock();
        const isGM = game.user.isGM;

        const hud = document.createElement("div");
        hud.id = HUD_ID;
        hud.classList.toggle("gm", isGM);

        hud.append(
            line("drpg-hud-campaign", campaignName(clock)),
            line("drpg-hud-chapter", game.i18n.format("DRPG.Hud.chapter", { n: clock.chapter })),
            line("drpg-hud-day", game.i18n.format("DRPG.Hud.day", { n: clock.day ?? 1 })),
            line("drpg-hud-phase", phaseLabel(clock.phase)),
            buildTimeRow(clock, isGM)
        );

        // The HUD must never swallow clicks meant for the canvas behind it.
        hud.addEventListener("pointerdown", event => event.stopPropagation());

        host.append(hud);
    } catch (err) {
        error("Could not render the campaign HUD", err);
    }
}

function line(className, text) {
    const el = document.createElement("div");
    el.className = className;
    el.textContent = text ?? "";
    if (!text) el.classList.add("empty");
    return el;
}

function buildTimeRow(clock, isGM) {
    const row = document.createElement("div");
    row.className = "drpg-hud-time-row";

    if (isGM) {
        row.append(control("fa-chevron-left", "DRPG.Hud.rewind", async () => {
            await rewindTimeOfDay();
        }));
    }

    const time = document.createElement("div");
    time.className = "drpg-hud-time";
    time.textContent = timeOfDayLabel(clock.timeOfDay);
    time.dataset.tooltip = game.i18n.format("DRPG.Hud.sessionTooltip", { session: clock.session });
    row.append(time);

    if (isGM) {
        // One button, two steps: the Eclipse always sits between two times of
        // day, so the first press opens the placement window and the second
        // closes it and starts the time of day. No separate button to forget.
        const eclipseRunning = clock.eclipse === true;
        row.append(control(
            eclipseRunning ? "fa-play" : "fa-chevron-right",
            eclipseRunning ? "DRPG.Hud.endEclipse" : "DRPG.Hud.startEclipse",
            async () => {
                const { isEclipse, startEclipse, endEclipse } = await import("./eclipse.mjs");
                if (isEclipse()) await endEclipse({ advance: true });
                else await startEclipse();
            }
        ));
        row.append(control("fa-gear", "DRPG.Hud.edit", async () => {
            const { openClockDialog } = await import("./gm-panel.mjs");
            await openClockDialog();
        }));
    }

    return row;
}

function control(icon, tooltipKey, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "drpg-hud-button";
    button.dataset.tooltip = game.i18n.localize(tooltipKey);
    button.setAttribute("aria-label", game.i18n.localize(tooltipKey));
    button.innerHTML = `<i class="fa-solid ${icon}" inert></i>`;
    button.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        button.disabled = true;
        try {
            await handler();
        } finally {
            button.disabled = false;
        }
    });
    return button;
}

/** Remove the HUD, e.g. when the module is disabled at runtime. */
export function removeHud() {
    document.getElementById(HUD_ID)?.remove();
}

export { HUD_ID, MODULE_ID };
