/**
 * Danganronpa RPG — the Despair Overflow.
 * ---------------------------------------------------------------------------
 * A Monokuma's pool caps at twelve. The season run measured what that costs:
 * 950 points of Despair earned and 628 of them evaporating on a full pool.
 * Two thirds of the income never existed.
 *
 * The cap stays — it is the limiter that keeps a Monokuma from banking a
 * chapter's worth of Calls — but the spill stops vanishing. Every point that
 * does not fit feeds a shared world counter, and when that counter reaches X
 * the world itself gets worse for one time of day: fewer crossings in the dark,
 * fewer search tokens in every room, one action less each.
 *
 * WHAT THIS FILE OWNS is the counter, the moment it fires, and the readers that
 * answer "is it dark right now, and by how much". It owns no effect of its own:
 * `actionBudget`, `SearchTokens.max` and `eclipseAllowance` each ask it a
 * question and apply their own answer, because each of those is already the
 * single place its number is decided and a second place would be a second
 * truth.
 *
 * THE DESIGN IS IN config.mjs, under `OVERFLOW` — the arithmetic behind X = 20,
 * why the floors exist, and why this is pressure now rather than a bank saved
 * for the finale.
 */

import { MODULE_ID, OVERFLOW, TIMES_OF_DAY } from "./config.mjs";
import { SETTINGS, DEFAULT_CLOCK } from "./settings.mjs";
import { announce, log, error } from "./utils.mjs";

/**
 * The clock, read from its own setting.
 *
 * `getClock` in clock.mjs is this line plus a re-export, and calling it from
 * here would close a static import cycle: `actionBudget` and `SearchTokens.max`
 * are synchronous, so they must import this file at the top level, and
 * clock.mjs already imports actions.mjs. The cycle would have worked — every
 * binding in it is called at runtime rather than while the modules evaluate —
 * but a cycle that works by luck is one somebody breaks later by hoisting a
 * single line. settings.mjs imports config.mjs and nothing else, which leaves
 * this file a leaf.
 */
function getClock() {
    return { ...DEFAULT_CLOCK, ...(game.settings.get(MODULE_ID, SETTINGS.clock) ?? {}) };
}

/* ==========================================================================
 * THE RULES — config, then the GM's edits on top
 * ========================================================================== */

/**
 * The GM's dial, with config.mjs supplying everything they did not set.
 *
 * MERGED RATHER THAN REPLACED, so a rule added to `OVERFLOW` later appears at
 * every table that has already saved a partial edit. A stored object that
 * simply overwrote the defaults would freeze a world on the shape it happened
 * to be saved with.
 */
export function overflowRules() {
    const stored = game.settings.get(MODULE_ID, SETTINGS.overflowRules) ?? {};
    const effects = {};
    for (const [key, base] of Object.entries(OVERFLOW.effects)) {
        effects[key] = { ...base, ...(stored.effects?.[key] ?? {}) };
    }
    const threshold = Number(stored.threshold);
    return {
        threshold: Number.isFinite(threshold) && threshold > 0
            ? Math.round(threshold)
            : OVERFLOW.threshold,
        effects
    };
}

/** Save an edit. GM only; anything out of range is clamped rather than refused. */
export async function setOverflowRules({ threshold, effects } = {}) {
    if (!game.user.isGM) return null;

    const { min, max } = OVERFLOW.range;
    const current = overflowRules();
    const next = { threshold: current.threshold, effects: {} };

    const wanted = Number(threshold);
    if (Number.isFinite(wanted)) next.threshold = Math.min(max, Math.max(min, Math.round(wanted)));

    for (const [key, base] of Object.entries(OVERFLOW.effects)) {
        const edit = effects?.[key] ?? {};
        const by = Number(edit.by);
        next.effects[key] = {
            ...base,
            on: edit.on === undefined ? current.effects[key].on : Boolean(edit.on),
            by: Number.isFinite(by) && by >= 0 ? Math.round(by) : current.effects[key].by
        };
    }

    await game.settings.set(MODULE_ID, SETTINGS.overflowRules, next);
    log(`Despair Overflow rules saved: X = ${next.threshold}.`);
    return next;
}

/* ==========================================================================
 * THE COUNTER
 * ========================================================================== */

function state() {
    const raw = game.settings.get(MODULE_ID, SETTINGS.overflow) ?? {};
    const count = Number(raw.count);
    return {
        count: Number.isFinite(count) && count > 0 ? Math.round(count) : 0,
        active: raw.active ?? null
    };
}

/** Spilled Despair waiting to be spent. */
export function overflowCount() {
    return state().count;
}

/** X, as this world has it set. */
export function overflowThreshold() {
    return overflowRules().threshold;
}

/**
 * Feed the counter. GM only.
 *
 * TWO CALLERS, AND THEY MEAN DIFFERENT THINGS. `adjustDespair` sends whatever
 * would not fit in a full pool — income the Monokuma never chose to lose. The
 * Feed the Overflow Call sends a point they chose to spend. The counter does
 * not distinguish them, and should not: what darkens the world is the quantity
 * of Despair loose in it, not the mood in which it got there.
 */
export async function addOverflow(amount, { reason = "spill" } = {}) {
    if (!game.user.isGM) return null;
    const n = Math.round(Number(amount));
    if (!Number.isFinite(n) || n <= 0) return null;

    const before = state();
    const after = before.count + n;
    await game.settings.set(MODULE_ID, SETTINGS.overflow, { ...before, count: after });
    log(`Despair overflow +${n} (${reason}) -> ${after}/${overflowThreshold()}.`);
    return after;
}

/**
 * Empty it. The guide refills every pool when a verdict lands, and this rides
 * the same moment: a chapter opens on clean air.
 */
export async function resetOverflow() {
    if (!game.user.isGM) return null;
    await game.settings.set(MODULE_ID, SETTINGS.overflow, { count: 0, active: null });
    log("Despair overflow cleared by the verdict.");
    return true;
}

/* ==========================================================================
 * WHEN IT FIRES, AND FOR HOW LONG
 * --------------------------------------------------------------------------
 * A darkening covers "this Eclipse and the time of day it opens". That is one
 * span with two names, and the trap is that the clock does not move until the
 * Eclipse ends — so the Eclipse half and the daylight half read as different
 * clocks even though they are the same event.
 *
 * So a darkening is STAMPED with the time of day it is for, and is active while
 * either of two things is true: the clock has reached that stamp, or an Eclipse
 * is running and that stamp is the one it will open. Nothing has to clear it —
 * the stamp simply stops matching. Which also means a rewound clock un-darkens
 * itself, and that is right: the time of day was undone.
 *
 * THE BOUNDARY IS CHECKED TWICE AND PAYS ONCE. `startEclipse` asks, so a
 * darkening can shorten the crossings of the very Eclipse that triggered it;
 * `applyTimeOfDayChange` asks, so a table that never opens an Eclipse still
 * gets one. When an Eclipse was used, the second call finds the stamp already
 * armed for that exact time of day and does nothing — no second payment, and
 * no second card.
 * ========================================================================== */

function stampOf(clock) {
    return { session: clock.session, day: clock.day ?? 1, timeOfDay: clock.timeOfDay };
}

/**
 * The stamp of the time of day a running Eclipse opens.
 *
 * Repeats one line of `advanceTimeOfDay`'s arithmetic rather than importing it:
 * that function MOVES the clock, and what is wanted here is the answer without
 * the move. Both read `TIMES_OF_DAY`, and the invariant checks they agree.
 */
function upcoming(clock) {
    const index = TIMES_OF_DAY.indexOf(clock.timeOfDay);
    if (index < 0) return null;
    const nextIndex = (index + 1) % TIMES_OF_DAY.length;
    const rolled = nextIndex === 0;
    return {
        session: rolled ? clock.session + 1 : clock.session,
        day: rolled ? (clock.day ?? 1) + 1 : (clock.day ?? 1),
        timeOfDay: TIMES_OF_DAY[nextIndex]
    };
}

function same(a, b) {
    return Boolean(a && b
        && a.session === b.session
        && a.day === b.day
        && a.timeOfDay === b.timeOfDay);
}

/** Is the world darkened right now? */
export function overflowActive() {
    try {
        const { active } = state();
        if (!active) return false;
        const clock = getClock();
        if (same(active, stampOf(clock))) return true;
        // The Eclipse half: the clock has not moved yet, so compare against the
        // time of day this Eclipse is about to open.
        return Boolean(clock.eclipse && same(active, upcoming(clock)));
    } catch {
        // Asked on every action, every search and every crossing — a throw here
        // would break the game rather than the feature.
        return false;
    }
}

/**
 * A time-of-day boundary just happened. Fire if the counter has reached X.
 *
 * @param {object} [options]
 * @param {boolean} [options.opening]  True when called from `startEclipse`,
 *   where the clock has not moved yet and the target is the time of day the
 *   Eclipse leads into.
 * @returns {Promise<object|null>} the stamp armed, or null if nothing fired.
 */
export async function checkOverflow({ opening = false } = {}) {
    if (!game.user.isGM) return null;

    try {
        const clock = getClock();
        const target = opening ? upcoming(clock) : stampOf(clock);
        if (!target) return null;

        const now = state();

        // Already armed for exactly this time of day: the Eclipse got there
        // first. Not a failure and not worth a log line — it is the normal path
        // whenever a table uses Eclipses at all.
        if (same(now.active, target)) return null;

        const threshold = overflowThreshold();
        if (now.count < threshold) return null;

        // PAYS X, KEEPS THE REST. A counter that zeroed itself would punish a
        // Monokuma for the timing of a boundary they do not control.
        const left = now.count - threshold;
        await game.settings.set(MODULE_ID, SETTINGS.overflow, { count: left, active: target });
        await announceOverflow(left, threshold);
        log(`Despair overflow fired: paid ${threshold}, ${left} left.`);
        return target;
    } catch (err) {
        error("Could not check the Despair overflow", err);
        return null;
    }
}

/** The card the whole table gets. Public by design — this is weather, not a secret. */
async function announceOverflow(left, paid) {
    const { effects } = overflowRules();
    const lines = [];

    if (effects.crossings.on) {
        lines.push(game.i18n.format("DRPG.Overflow.effectCrossings", { n: effects.crossings.by }));
    }
    if (effects.searchTokens.on) {
        lines.push(game.i18n.format("DRPG.Overflow.effectTokens", { n: effects.searchTokens.by }));
    }
    if (effects.actions.on) {
        lines.push(game.i18n.format("DRPG.Overflow.effectActions", { n: effects.actions.by }));
    }

    // Every condition switched off is a legitimate table setting — somebody who
    // wants the counter as pure atmosphere — so it says so rather than posting
    // a card with an empty list under a promise of consequences.
    const body = lines.length
        ? `<ul>${lines.map(l => `<li>${l}</li>`).join("")}</ul>`
        : `<p><em>${game.i18n.localize("DRPG.Overflow.nothingOn")}</em></p>`;

    await announce({
        flags: { [MODULE_ID]: { sfx: { key: "despairOverflow", gm: true } } },
        content: `<h3>${game.i18n.localize("DRPG.Overflow.cardTitle")}</h3>
            <p>${game.i18n.format("DRPG.Overflow.cardBody", { n: paid })}</p>
            ${body}
            <p class="notes">${game.i18n.format("DRPG.Overflow.cardLeft", { n: left })}</p>`
    });
}

/* ==========================================================================
 * THE READERS
 * --------------------------------------------------------------------------
 * Each answers in the units its caller works in, and each stops at the floor.
 * A darkened time of day still has to be playable: a budget of zero is not a
 * harder game, it is a player with nothing to do, and a room with no tokens
 * cannot be investigated at all.
 * ========================================================================== */

function penalty(key) {
    if (!overflowActive()) return 0;
    const rule = overflowRules().effects[key];
    return rule?.on ? Math.max(0, rule.by) : 0;
}

/** Actions to subtract from a character's budget this time of day. */
export function overflowActionPenalty() {
    return penalty("actions");
}

/** Search tokens to subtract from every room's maximum. */
export function overflowTokenPenalty() {
    return penalty("searchTokens");
}

/** The lowest a number this overflow reduced is allowed to go. */
export function overflowFloor(key) {
    return overflowRules().effects[key]?.floor ?? 1;
}

/**
 * Eclipse crossings under a darkening.
 *
 * @param {number|null} allowance  What the Eclipse would give normally; `null`
 *   for a free-placement Eclipse, which has no number to reduce.
 * @returns {number|null}
 */
export function overflowCrossings(allowance) {
    if (!overflowActive()) return allowance;
    const rule = overflowRules().effects.crossings;
    if (!rule?.on) return allowance;

    // Free placement has no "minus one" to take, so the darkening hands it a
    // number instead of a subtraction: the run of the whole map becomes the
    // ordinary two rooms. A real loss, without being a smaller number than the
    // penalised ordinary allowance — which would read as nonsense.
    if (allowance === null) return rule.freeBecomes ?? 2;
    return Math.max(rule.floor ?? 1, allowance - rule.by);
}

/* ==========================================================================
 * THE GM'S EDITOR
 * ========================================================================== */

/**
 * Three switches, three sizes and X.
 *
 * ONE OF THESE, NOT FOUR (see `alreadyOpen` in live.mjs): two copies each read
 * the rules when they opened, and the older one would go on looking
 * authoritative while showing something that stopped being true.
 *
 * The current reading is printed rather than editable. A GM who wants to move
 * the counter by hand has `game.drpg.addOverflow()`, and a spin box beside the
 * threshold would invite exactly the edit that makes the number stop meaning
 * "Despair this world could not hold".
 */
export async function openOverflowSetup() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const { alreadyOpen } = await import("./live.mjs");
    if (alreadyOpen("drpg-window-overflow")) return null;

    const { dialogContent } = await import("./utils.mjs");
    const DialogV2 = foundry.applications.api.DialogV2;

    const status = overflowStatus();
    const { min, max } = OVERFLOW.range;
    const esc = s => foundry.utils.escapeHTML(String(s ?? ""));

    const row = (key, labelKey) => {
        const rule = status.rules.effects[key];
        return `<li class="drpg-overflow-rule">
            <label class="drpg-overflow-on">
                <input type="checkbox" name="${key}-on"${rule.on ? " checked" : ""}>
                <span>${esc(game.i18n.localize(labelKey))}</span>
            </label>
            <label class="drpg-overflow-by">
                <span>${esc(game.i18n.localize("DRPG.Overflow.amount"))}</span>
                <input type="number" name="${key}-by" value="${rule.by}" min="0" max="5">
            </label>
        </li>`;
    };

    const picked = await DialogV2.wait({
        id: "drpg-window-overflow",
        window: { title: game.i18n.localize("DRPG.Overflow.setupTitle") },
        classes: ["drpg-panel", "drpg-overflow-setup"],
        content: dialogContent(`<form>
            <p>${esc(game.i18n.localize("DRPG.Overflow.setupIntro"))}</p>
            <p class="notes">${esc(game.i18n.format(
                status.active ? "DRPG.Overflow.currentActive" : "DRPG.Overflow.current",
                { count: status.count, max: status.threshold }))}</p>

            <label class="drpg-overflow-threshold">
                <span>${esc(game.i18n.localize("DRPG.Overflow.threshold"))}</span>
                <input type="number" name="threshold" value="${status.threshold}"
                       min="${min}" max="${max}">
            </label>
            <p class="notes">${esc(game.i18n.format("DRPG.Overflow.thresholdHint",
                { min, max }))}</p>

            <h4>${esc(game.i18n.localize("DRPG.Overflow.conditions"))}</h4>
            <ul class="drpg-overflow-rules">
                ${row("crossings", "DRPG.Overflow.condCrossings")}
                ${row("searchTokens", "DRPG.Overflow.condTokens")}
                ${row("actions", "DRPG.Overflow.condActions")}
            </ul>
            <p class="notes">${esc(game.i18n.localize("DRPG.Overflow.floorNote"))}</p>
        </form>`),
        buttons: [
            {
                action: "save", label: game.i18n.localize("DRPG.Overflow.save"), default: true,
                callback: (event, button, dialog) => {
                    const form = dialog.element;
                    const read = key => ({
                        on: form.querySelector(`[name="${key}-on"]`)?.checked,
                        by: Number(form.querySelector(`[name="${key}-by"]`)?.value)
                    });
                    return {
                        threshold: Number(form.querySelector("[name=threshold]")?.value),
                        effects: {
                            crossings: read("crossings"),
                            searchTokens: read("searchTokens"),
                            actions: read("actions")
                        }
                    };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!picked || picked === "cancel") return null;

    const saved = await setOverflowRules(picked);
    ui.notifications.info(game.i18n.format("DRPG.Overflow.saved", { n: saved.threshold }));
    return saved;
}

/** Everything a caption, a tooltip or the editor's preview needs, in one read. */
export function overflowStatus() {
    return {
        count: state().count,
        threshold: overflowThreshold(),
        active: overflowActive(),
        rules: overflowRules()
    };
}
