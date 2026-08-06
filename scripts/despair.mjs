/**
 * Danganronpa RPG — Despair pools, one per Monokuma.
 * ---------------------------------------------------------------------------
 * Guide: "There are at least two GMs. […] Each GM has their own Despair pool —
 * a maximum of 12 per GM."
 *
 * Daggerheart only models a single shared Fear pool, so this replaces its
 * tracker with one row per full Gamemaster. Assistant GMs are deliberately
 * excluded: they are helpers, not Monokumas, and the guide gives Despair only
 * to the two people running the killing game.
 *
 * Pools are public. When Monokuma spends Despair the table is meant to see it.
 */

import { MODULE_ID, STARTING, DESPAIR_CALLS } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { log, error } from "./utils.mjs";


// assignments.mjs imports from this file, so the student counts shown on the
// gear are read through game.drpg at render time instead of a static import.

const WIDGET_ID = "drpg-despair";

export function registerDespair() {
    Hooks.once("ready", renderDespair);
    Hooks.on("canvasReady", () => renderDespair());
    // Keep every client's rows in step when a pool changes.
    Hooks.on("userConnected", () => renderDespair());
}

/* ==========================================================================
 * DATA
 * ========================================================================== */

/** Maximum any one Monokuma can hold. */
export function despairMax() {
    return STARTING.despairMax;
}

/**
 * The users who get a pool: full Gamemasters only.
 *
 * `User#isGM` is true for Assistant GMs too, which is why this checks the role
 * directly — an assistant helping at the table should not get a Monokuma pool.
 */
export function monokumas() {
    return game.users
        .filter(u => u.role === CONST.USER_ROLES.GAMEMASTER)
        .sort((a, b) => a.name.localeCompare(b.name));
}

/** Raw pool store: { [userId]: number }. */
function pools() {
    return game.settings.get(MODULE_ID, SETTINGS.despairPools) ?? {};
}

/** Despair currently held by one Monokuma. */
export function getDespair(userId) {
    const raw = Number(pools()[userId] ?? 0);
    if (!Number.isFinite(raw)) return 0;
    return Math.min(Math.max(Math.round(raw), 0), despairMax());
}

/** Set one Monokuma's pool. GM only. */
export async function setDespair(userId, value) {
    if (!game.user.isGM) return null;

    const next = Math.min(Math.max(Math.round(value), 0), despairMax());
    const store = { ...pools(), [userId]: next };
    await game.settings.set(MODULE_ID, SETTINGS.despairPools, store);
    return next;
}

/** Add to (or subtract from) a pool. */
export async function adjustDespair(userId, delta) {
    return setDespair(userId, getDespair(userId) + delta);
}

/**
 * Fill every Monokuma to maximum. The guide does this when the vote convicts
 * the wrong person: "Each GM (Monokuma) fills their Despair pool to max (12)."
 */
export async function fillAllDespair() {
    if (!game.user.isGM) return null;

    const store = { ...pools() };
    for (const user of monokumas()) store[user.id] = despairMax();
    await game.settings.set(MODULE_ID, SETTINGS.despairPools, store);

    log("Every Monokuma's Despair pool filled to maximum.");
    return store;
}

/**
 * Spend Despair on one of the guide's Despair Calls. Refuses when the pool is
 * short, and announces the spend publicly — these are Monokuma's moves.
 *
 * @param {string} userId  Which Monokuma is paying.
 * @param {string} callKey Key from DESPAIR_CALLS.
 */
export async function spendDespairCall(userId, callKey) {
    const call = DESPAIR_CALLS[callKey];
    if (!call) {
        ui.notifications.error(game.i18n.format("DRPG.Despair.unknownCall", { key: callKey }));
        return false;
    }

    const held = getDespair(userId);
    if (held < call.cost) {
        ui.notifications.warn(game.i18n.format("DRPG.Despair.notEnough", {
            call: call.label, cost: call.cost, held
        }));
        return false;
    }

    await adjustDespair(userId, -call.cost);

    // The announcement must never be able to swallow the effect. Despair has
    // already been paid at this point; if the chat card fails, the caller still
    // has to go on and apply what was bought.
    try {
        const user = game.users?.get?.(userId) ?? game.users?.find?.(u => u.id === userId);
        await ChatMessage.create({
            content: `<h3>${game.i18n.localize("DRPG.Despair.callTitle")}</h3>
                      <p><strong>${foundry.utils.escapeHTML(call.label)}</strong> — ${foundry.utils.escapeHTML(call.effect)}</p>
                      <p><em>${game.i18n.format("DRPG.Despair.spent", {
                          name: foundry.utils.escapeHTML(user?.name ?? "?"),
                          cost: call.cost,
                          left: getDespair(userId)
                      })}</em></p>`
        });
    } catch (err) {
        error("Despair was spent but the announcement failed", err);
    }

    return true;
}

/* ==========================================================================
 * WIDGET
 * ========================================================================== */

/** Build or rebuild the Despair rows. Safe to call repeatedly. */
export function renderDespair() {
    try {
        const host = document.querySelector("#ui-top") ?? document.querySelector("#ui-middle");
        if (!host) return;

        document.getElementById(WIDGET_ID)?.remove();

        const gms = monokumas();
        if (!gms.length) return;

        const wrapper = document.createElement("div");
        wrapper.id = WIDGET_ID;
        wrapper.classList.toggle("single", gms.length === 1);
        wrapper.classList.toggle("gm-editable", game.user.isGM);

        for (const user of gms) wrapper.append(buildRow(user, gms.length > 1));

        // One gear for the whole widget: who looks after which student.
        if (game.user.isGM) wrapper.append(buildAssignmentButton());

        wrapper.addEventListener("pointerdown", event => event.stopPropagation());
        host.append(wrapper);
    } catch (err) {
        error("Could not render the Despair tracker", err);
    }
}

function buildRow(user, showName) {
    const held = getDespair(user.id);
    const max = despairMax();
    const isGM = game.user.isGM;
    const isOwnPool = game.user.id === user.id;

    const row = document.createElement("div");
    row.className = "drpg-despair-row";
    row.dataset.userId = user.id;

    if (showName) {
        const name = document.createElement("span");
        name.className = "drpg-despair-name";
        name.textContent = user.name;
        // Each Monokuma is colour-coded so two rows never blur together.
        name.style.color = user.color?.css ?? user.color ?? "";
        row.append(name);
    } else {
        const label = document.createElement("span");
        label.className = "drpg-despair-name";
        label.textContent = game.i18n.localize("DRPG.Despair.label");
        row.append(label);
    }

    const pips = document.createElement("div");
    pips.className = "drpg-despair-pips";

    for (let i = 1; i <= max; i++) {
        const pip = document.createElement("span");
        pip.className = `drpg-despair-pip${i <= held ? " filled" : ""}`;
        pip.dataset.value = String(i);

        if (isGM) {
            pip.dataset.tooltip = game.i18n.format("DRPG.Despair.pipTooltip", { n: i, name: user.name });
            pip.addEventListener("click", () => setDespair(user.id, i === held ? i - 1 : i));
        }
        pips.append(pip);
    }
    row.append(pips);

    const count = document.createElement("span");
    count.className = "drpg-despair-count";
    count.textContent = `${held}/${max}`;
    row.append(count);

    if (isGM) {
        row.append(
            stepper("fa-minus", () => adjustDespair(user.id, -1), held <= 0),
            stepper("fa-plus", () => adjustDespair(user.id, +1), held >= max)
        );
        if (isOwnPool) row.classList.add("own");
    }

    return row;
}

/**
 * The gear that opens the student-division dialog. Also shows how many students
 * each Monokuma currently carries, since an uneven split is easy to miss.
 */
function buildAssignmentButton() {
    const bar = document.createElement("div");
    bar.className = "drpg-despair-gear";

    const counts = document.createElement("span");
    counts.className = "drpg-despair-counts";
    try {
        const gms = monokumas();
        counts.textContent = gms
            .map(u => `${u.name.slice(0, 10)}: ${studentsOfSafe(u.id)}`)
            .join("  ·  ");
    } catch {
        counts.textContent = "";
    }
    bar.append(counts);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "drpg-despair-button";
    button.dataset.tooltip = game.i18n.localize("DRPG.Assign.tooltip");
    button.setAttribute("aria-label", game.i18n.localize("DRPG.Assign.tooltip"));
    button.innerHTML = `<i class="fa-solid fa-gear" inert></i>`;
    button.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        const { openAssignmentDialog } = await import("./assignment-dialog.mjs");
        await openAssignmentDialog();
    });
    bar.append(button);

    return bar;
}

/** Student count for a Monokuma, without exploding if assignments are absent. */
function studentsOfSafe(userId) {
    try {
        // Imported lazily to keep despair.mjs free of a circular dependency.
        const mod = globalThis.game?.drpg;
        if (mod?.studentsOf) return mod.studentsOf(userId).length;
    } catch { /* fall through */ }
    return "?";
}

function stepper(icon, handler, disabled) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "drpg-despair-button";
    button.disabled = disabled;
    button.innerHTML = `<i class="fa-solid ${icon}" inert></i>`;
    button.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        await handler();
    });
    return button;
}

export { WIDGET_ID };
