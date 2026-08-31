/**
 * Danganronpa RPG - the Despair Overflow.
 * ---------------------------------------------------------------------------
 * A Monokuma's pool caps at twelve. The season run measured what that costs:
 * 950 points of Despair earned and 628 of them evaporating on a full pool.
 * Two thirds of the income never existed.
 *
 * The cap stays - it is the limiter that keeps a Monokuma from banking a
 * chapter's worth of Calls - but the spill stops vanishing. Every point that
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
 * THE DESIGN IS IN config.mjs, under `OVERFLOW` - the arithmetic behind X = 20,
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
 * clock.mjs already imports actions.mjs. The cycle would have worked - every
 * binding in it is called at runtime rather than while the modules evaluate -
 * but a cycle that works by luck is one somebody breaks later by hoisting a
 * single line. settings.mjs imports config.mjs and nothing else, which leaves
 * this file a leaf.
 */
function getClock() {
    return { ...DEFAULT_CLOCK, ...(game.settings.get(MODULE_ID, SETTINGS.clock) ?? {}) };
}

/* ==========================================================================
 * THE RULES - config, then the GM's edits on top
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
    const before = current;
    const next = { threshold: current.threshold, effects: {} };

    const wanted = Number(threshold);
    if (Number.isFinite(wanted)) next.threshold = Math.min(max, Math.max(min, Math.round(wanted)));

    for (const [key, base] of Object.entries(OVERFLOW.effects)) {
        const edit = effects?.[key] ?? {};
        const by = Number(edit.by);
        next.effects[key] = {
            ...base,
            on: edit.on === undefined ? current.effects[key].on : Boolean(edit.on),
            // Some of the eight have no size at all - Despair, Silence and Fog
            // are on or off - so an edit that carries no number leaves `by`
            // exactly as the catalogue had it rather than writing NaN.
            by: Number.isFinite(by) && by >= 0 ? Math.round(by) : current.effects[key].by
        };
    }

    await game.settings.set(MODULE_ID, SETTINGS.overflowRules, next);

    /*
     * AN EDIT IS ANNOUNCED, NOT JUST SAVED (Dawid, 28.08: "upewnijmy sie, ze
     * wysylaja powiadomienie").
     *
     * X is public - it is half of the "?/X" every player is reading - so
     * changing it changes something the whole table can see, and letting it
     * change silently would leave everyone looking at a number whose meaning
     * moved. Announced only when it actually differs: opening the editor and
     * pressing Save without touching anything is not news.
     */
    const changed = before.threshold !== next.threshold
        || Object.keys(next.effects).some(key =>
            before.effects[key].on !== next.effects[key].on
            || before.effects[key].by !== next.effects[key].by);

    if (changed) {
        try {
            await announce({
                content: `<h3>${game.i18n.localize("DRPG.Overflow.title")}</h3>
                    <p>${game.i18n.format("DRPG.Overflow.rulesChanged",
                        { n: next.threshold })}</p>`
            });
        } catch (err) {
            error("The overflow rules were saved but the announcement failed", err);
        }
    }

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
 * would not fit in a full pool - income the Monokuma never chose to lose. The
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

    /*
     * THE THRESHOLD IS EXAMINED WHEN THE COUNTER MOVES (Dawid, 30.08).
     *
     * Until now the only moment anything asked "is it full?" was a time-of-day
     * boundary. So a GM could watch the caption arrive at 20/20 and have the
     * game carry on around it, which reads as broken and was reported as
     * broken. Worse, it could be eaten: a boundary already armed by an Eclipse
     * finds its own stamp and does nothing, so a counter refilled during that
     * Eclipse paid nothing and waited a further time of day. Both measured in
     * the sandbox on 30.08 before this line existed.
     *
     * ARMED FOR THE TIME OF DAY THAT HAS NOT STARTED, not for the one running.
     * That is not caution, it is the only correct target: three of the eight
     * debuffs are CONSUMED at a boundary - `shift` by `SearchTokens.reset`,
     * `panic` by `resetAllActions`, `darkness` by the Eclipse's own crossing
     * allowance - and all three have already run for the hour in progress. Fired
     * into the current slot they would announce themselves and change nothing,
     * which is the exact class of failure this file's own ordering note exists
     * to prevent.
     *
     * So the card comes now and the bite comes at the boundary, whole. The
     * boundary check then finds the stamp already armed and does not pay twice.
     */
    await armAhead();
    return after;
}

/*
 * RE-ENTRANCY, SHUT BY CONSTRUCTION.
 *
 * `checkOverflow` can write actors (Rot) and projects (Earthquake), and this is
 * now reachable from `adjustDespair`. Nothing in either path grants Despair
 * today, so nothing loops today - and "today" is the word that makes a guard
 * worth three lines rather than a comment.
 */
let arming = false;

async function armAhead() {
    if (arming) return null;
    arming = true;
    try {
        return await checkOverflow({ ahead: true });
    } catch (err) {
        error("Could not arm the Despair overflow as the counter filled", err);
        return null;
    } finally {
        arming = false;
    }
}

/**
 * Empty it. The guide refills every pool when a verdict lands, and this rides
 * the same moment: a chapter opens on clean air.
 *
 * TWO CALLERS AND THE LOG HAS TO SAY WHICH. The verdict clears it between
 * chapters; the season reset clears it between seasons. A line that always
 * blamed the verdict was wrong half the time in the one place a GM looks when
 * asking why a counter they were watching went to zero.
 */
export async function resetOverflow({ reason = "the verdict" } = {}) {
    if (!game.user.isGM) return null;
    await game.settings.set(MODULE_ID, SETTINGS.overflow, { count: 0, active: null });
    log(`Despair overflow cleared by ${reason}.`);
    return true;
}

/* ==========================================================================
 * WHEN IT FIRES, AND FOR HOW LONG
 * --------------------------------------------------------------------------
 * A darkening covers "this Eclipse and the time of day it opens". That is one
 * span with two names, and the trap is that the clock does not move until the
 * Eclipse ends - so the Eclipse half and the daylight half read as different
 * clocks even though they are the same event.
 *
 * So a darkening is STAMPED with the time of day it is for, and is active while
 * either of two things is true: the clock has reached that stamp, or an Eclipse
 * is running and that stamp is the one it will open. Nothing has to clear it -
 * the stamp simply stops matching. Which also means a rewound clock un-darkens
 * itself, and that is right: the time of day was undone.
 *
 * THE BOUNDARY IS CHECKED TWICE AND PAYS ONCE. `startEclipse` asks, so a
 * darkening can shorten the crossings of the very Eclipse that triggered it;
 * `applyTimeOfDayChange` asks, so a table that never opens an Eclipse still
 * gets one. When an Eclipse was used, the second call finds the stamp already
 * armed for that exact time of day and does nothing - no second payment, and
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

/**
 * Which debuff is running right now, or null.
 *
 * THE STAMP CARRIES THE KEY, not just "dark / not dark". One of eight happens,
 * so every reader has to ask which one - and the caption and the card have to
 * be able to name it.
 */
export function overflowEffect() {
    try {
        const { active } = state();
        if (!active?.effect) return null;
        const clock = getClock();
        if (same(active, stampOf(clock))) return active.effect;
        // The Eclipse half: the clock has not moved yet, so compare against the
        // time of day this Eclipse is about to open.
        if (clock.eclipse && same(active, upcoming(clock))) return active.effect;
        return null;
    } catch {
        // Asked on every action, every search and every crossing - a throw here
        // would break the game rather than the feature.
        return null;
    }
}

/** Is this particular debuff the one that was drawn? */
export function overflowIs(key) {
    return overflowEffect() === key;
}

/** Is anything running at all? For the caption's own state. */
export function overflowActive() {
    return overflowEffect() !== null;
}

/**
 * The pool the GM has ticked. Empty means the mechanic is off - see the note
 * in config.mjs; the counter still climbs, nothing is ever drawn from it.
 */
export function overflowPool() {
    const { effects } = overflowRules();
    return Object.keys(OVERFLOW.effects).filter(key => effects[key]?.on);
}

/**
 * A time-of-day boundary just happened. Fire if the counter has reached X.
 *
 * @param {object} [options]
 * @param {boolean} [options.ahead]  Target the time of day that has NOT begun
 *   rather than the one running. Two callers want it and they want it for the
 *   same reason: `startEclipse`, because the clock does not move until the
 *   Eclipse ends, and `addOverflow`, because the hour in progress has already
 *   had its actions dealt and its rooms stocked. It was called `opening` while
 *   the Eclipse was the only caller, which described the caller instead of the
 *   behaviour.
 * @returns {Promise<object|null>} the stamp armed, or null if nothing fired.
 */
export async function checkOverflow({ ahead = false } = {}) {
    if (!game.user.isGM) return null;

    try {
        const clock = getClock();
        const target = ahead ? upcoming(clock) : stampOf(clock);
        if (!target) return null;

        const now = state();

        // Already armed for exactly this time of day: the Eclipse got there
        // first. Not a failure and not worth a log line - it is the normal path
        // whenever a table uses Eclipses at all.
        if (same(now.active, target)) return null;

        const threshold = overflowThreshold();
        if (now.count < threshold) return null;

        /*
         * NOTHING IN THE HAT, NOTHING HAPPENS - AND NOTHING IS PAID.
         *
         * A GM who has unticked all eight has turned the mechanic off; charging
         * the threshold for a debuff that cannot be drawn would quietly empty a
         * counter they are watching climb, which is the opposite of off.
         */
        const pool = overflowPool();
        if (!pool.length) {
            log("Despair overflow reached its threshold with an empty pool: nothing drawn, "
                + "nothing paid.");
            return null;
        }

        // One of them, evenly. A weighted draw was tempting and is a second
        // dial nobody asked for; eight equal chances is a rule a table can hold
        // in its head.
        const drawn = pool[Math.floor(Math.random() * pool.length)];

        // PAYS X, KEEPS THE REST. A counter that zeroed itself would punish a
        // Monokuma for the timing of a boundary they do not control.
        const left = now.count - threshold;
        await game.settings.set(MODULE_ID, SETTINGS.overflow,
            { count: left, active: { ...target, effect: drawn } });

        // The two that are events happen HERE and never again. Before the card,
        // so a GM reading "every project lost a point" can look at the projects
        // and see it has already happened.
        await runOverflowEvent(drawn);

        await announceOverflow(drawn, left, threshold);
        log(`Despair overflow fired: ${drawn}, paid ${threshold}, ${left} left.`);
        return { ...target, effect: drawn };
    } catch (err) {
        error("Could not check the Despair overflow", err);
        return null;
    }
}

/**
 * The two that are events rather than conditions.
 *
 * Both run exactly once, here, and have nothing to answer afterwards. Both are
 * wrapped: a school with one un-wearable item must still get the rest of the
 * effect, and a failure in either has to leave the counter already paid rather
 * than fire again on the next boundary.
 */
async function runOverflowEvent(key) {
    const rule = overflowRules().effects[key];
    if (rule?.kind !== "event") return null;

    try {
        if (key === "rot") return await rotEverything(rule.by ?? 1);
        if (key === "earthquake") return await shakeProjects(rule.by ?? 1);
    } catch (err) {
        error(`The overflow drew ${key} and could not carry it out`, err);
    }
    return null;
}

/**
 * Everything with a durability track wears - but nothing ever breaks.
 *
 * BY DURABILITY, NOT BY CATEGORY. `EQUIPPABLE` names three kinds and the track
 * carries more than that, so "has durability and is not already broken" is one
 * rule where a list of categories would be a list that goes stale.
 *
 * IT NEVER TAKES THE LAST POINT (D1), and the first version did.
 *
 * Written as "one durability off everything", it was measured destroying about
 * 23 items a season - because the Z6 ladder gives T0 and T1 a durability of
 * ONE, so for the cheap half of the school "minus one" and "destroyed" are the
 * same sentence. A weather effect that quietly empties every pocket in the
 * building is not the rule anybody wrote; it is an arithmetic accident of where
 * the ladder starts.
 *
 * So Rot spends SPARE durability only. An item on its last point is skipped
 * entirely, and one with three points loses at most two. Measured after the
 * change: zero items broken by Rot across forty seasons, with the wear itself
 * still landing - about ninety-nine points a season that used to be deaths are
 * now just damage. Breaking things stays the business of Despair rolls, where a
 * player chose the risk.
 */
async function rotEverything(amount) {
    const { durabilityLeft, isBroken, wearItem } = await import("./inventory.mjs");
    const { isDeceased } = await import("./chapter.mjs");

    let worn = 0, spared = 0;
    for (const actor of game.actors) {
        if (actor.type !== "character") continue;
        // The dead carry nothing that can get worse.
        if (isDeceased(actor)) continue;
        for (const item of actor.items) {
            if (isBroken(item)) continue;

            // What can be taken without taking the last point. `durabilityLeft`
            // already answers zero for anything broken, so this is the whole
            // guard: one point left means nothing spare, means skip.
            const spare = durabilityLeft(item) - 1;
            if (spare <= 0) {
                if (durabilityLeft(item) > 0) spared++;
                continue;
            }

            for (let i = 0; i < Math.min(amount, spare); i++) {
                const result = await wearItem(item);
                if (!result) break;
                worn++;
                // Cannot happen while `spare` is respected, and checked anyway:
                // if it ever does, the loop stops rather than grinding an item
                // that is already gone.
                if (result.broke) break;
            }
        }
    }
    log(`Rot: ${worn} point(s) of wear, ${spared} thing(s) too fragile to touch.`);
    return { worn, spared };
}

/** Every project loses progress. */
async function shakeProjects(amount) {
    const { allProjects, addProgress } = await import("./projects.mjs");
    let moved = 0;
    for (const project of allProjects()) {
        if (!project.current) continue;          // nothing to take
        const took = Math.min(amount, project.current);
        if (await addProgress(project.id, -took)) moved++;
    }
    log(`Earthquake: ${moved} project(s) set back.`);
    return { moved };
}

/** The card the whole table gets. Public by design - this is weather, not a secret. */
async function announceOverflow(drawn, left, paid) {
    const rule = overflowRules().effects[drawn];
    const name = game.i18n.localize(`DRPG.Overflow.name.${drawn}`);
    const what = game.i18n.format(`DRPG.Overflow.what.${drawn}`, { n: rule?.by ?? 1 });

    await announce({
        flags: { [MODULE_ID]: { sfx: { key: "despairOverflow", gm: true } } },
        content: `<h3>${game.i18n.localize("DRPG.Overflow.cardTitle")}</h3>
            <p>${game.i18n.format("DRPG.Overflow.cardBody", { n: paid })}</p>
            <p><strong>${foundry.utils.escapeHTML(name)}</strong> - ${what}</p>
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

/**
 * How much this debuff takes, if it is the one that was drawn.
 *
 * Reads the size from the rules rather than the stamp: a GM who retunes the
 * numbers mid-darkening should see the new ones, and the stamp's job is to say
 * WHICH and WHEN, not how much.
 */
function penalty(key) {
    if (!overflowIs(key)) return 0;
    return Math.max(0, overflowRules().effects[key]?.by ?? 0);
}

/** Actions to subtract from a character's budget this time of day (Panic). */
export function overflowActionPenalty() {
    return penalty("panic");
}

/** Search tokens to subtract from every room's maximum (Shift). */
export function overflowTokenPenalty() {
    return penalty("shift");
}

/** No Hope is earned while Despair runs. */
export function overflowBlocksHope() {
    return overflowIs("despair");
}

/** No Hope Calls while Silence runs. */
export function overflowBlocksCalls() {
    return overflowIs("silence");
}

/** No free Move while Fog runs. */
export function overflowBlocksFreeMove() {
    return overflowIs("fog");
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
    if (!overflowIs("darkness")) return allowance;
    const rule = overflowRules().effects.darkness;

    // Free placement has no "minus one" to take, so the darkening hands it a
    // number instead of a subtraction: the run of the whole map becomes the
    // ordinary two rooms. A real loss, without being a smaller number than the
    // penalised ordinary allowance - which would read as nonsense.
    if (allowance === null) return rule.freeBecomes ?? 2;
    return Math.max(rule.floor ?? 1, allowance - rule.by);
}

/* ==========================================================================
 * THE GM'S EDITOR - a pane in Despair Flow, not a window of its own
 * --------------------------------------------------------------------------
 * It was a DialogV2 with a tile on the GM panel. It is now the fourth tab of
 * the window that already holds the pools, the Monokumas who spend them and
 * the students they are assigned to (Dawid, 29.08) - one subject with four
 * faces. Two doors into one form is one door too many, so the tile and the
 * standalone window both went.
 *
 * The markup lives here rather than in gm-team-dialog.mjs because the rules it
 * edits live here: a checkbox whose meaning is decided in another file is a
 * checkbox somebody will eventually mis-wire.
 * ========================================================================== */

/** The pane's HTML, for `panelTabs`. */
export function overflowSection() {
    const status = overflowStatus();
    const { min, max } = OVERFLOW.range;
    const esc = str => foundry.utils.escapeHTML(String(str ?? ""));

    const row = key => {
        const rule = status.rules.effects[key];
        const name = esc(game.i18n.localize(`DRPG.Overflow.name.${key}`));
        const what = esc(game.i18n.format(`DRPG.Overflow.what.${key}`, { n: rule.by ?? 1 }));
        // Only some of the eight have a size. Despair, Silence and Fog are on
        // or off, and a spin box beside them would be a control that does
        // nothing - which is worse than no control at all.
        const size = rule.by === undefined ? "" : `
            <label class="drpg-overflow-by">
                <span>${esc(game.i18n.localize("DRPG.Overflow.amount"))}</span>
                <input type="number" name="ovf-${key}-by" value="${rule.by}" min="0" max="5">
            </label>`;

        return `<li class="drpg-overflow-rule${status.effect === key ? " is-drawn" : ""}">
            <label class="drpg-overflow-on">
                <input type="checkbox" name="ovf-${key}-on"${rule.on ? " checked" : ""}>
                <strong>${name}</strong>
            </label>
            ${size}
            <div class="notes">${what}</div>
        </li>`;
    };

    const states = Object.entries(OVERFLOW.effects)
        .filter(([, rule]) => rule.kind === "state").map(([key]) => key);
    const events = Object.entries(OVERFLOW.effects)
        .filter(([, rule]) => rule.kind === "event").map(([key]) => key);

    const nowLine = status.active
        ? game.i18n.format("DRPG.Overflow.currentDrawn",
            { count: status.count, max: status.threshold, what: status.effectName })
        : game.i18n.format("DRPG.Overflow.current", { count: status.count, max: status.threshold });

    // An empty pool is a real setting and not an error, so it is stated where
    // the GM is looking rather than discovered when nothing ever fires.
    const empty = status.pool.length ? "" :
        `<p class="notes drpg-overflow-empty">${
            esc(game.i18n.localize("DRPG.Overflow.emptyPool"))}</p>`;

    return `<p>${esc(game.i18n.localize("DRPG.Overflow.setupIntro"))}</p>
        <p class="notes">${esc(nowLine)}</p>

        <label class="drpg-overflow-threshold">
            <span>${esc(game.i18n.localize("DRPG.Overflow.threshold"))}</span>
            <input type="number" name="ovf-threshold" value="${status.threshold}"
                   min="${min}" max="${max}">
        </label>
        <p class="notes">${esc(game.i18n.format("DRPG.Overflow.thresholdHint", { min, max }))}</p>

        <h4>${esc(game.i18n.localize("DRPG.Overflow.pool"))}</h4>
        <p class="notes">${esc(game.i18n.localize("DRPG.Overflow.poolHint"))}</p>
        ${empty}
        <ul class="drpg-overflow-rules">${states.map(row).join("")}</ul>
        <h4>${esc(game.i18n.localize("DRPG.Overflow.oneOff"))}</h4>
        <p class="notes">${esc(game.i18n.localize("DRPG.Overflow.oneOffHint"))}</p>
        <ul class="drpg-overflow-rules">${events.map(row).join("")}</ul>
        <p class="notes">${esc(game.i18n.localize("DRPG.Overflow.floorNote"))}</p>`;
}

/**
 * Read the pane back. Takes the dialog's root element.
 *
 * Every field is prefixed `ovf-` because this form shares a window with three
 * others, and a `name="threshold"` in a dialog that also holds a pool table is
 * a collision waiting for whoever adds the next field.
 */
export function readOverflowForm(root) {
    if (!root) return null;
    const effects = {};
    for (const key of Object.keys(OVERFLOW.effects)) {
        const on = root.querySelector(`[name="ovf-${key}-on"]`);
        const by = root.querySelector(`[name="ovf-${key}-by"]`);
        // A pane that never rendered returns nothing rather than a form full of
        // undefined, which `setOverflowRules` would read as "untick everything".
        if (!on) return null;
        effects[key] = { on: on.checked, ...(by ? { by: Number(by.value) } : {}) };
    }
    return {
        threshold: Number(root.querySelector('[name="ovf-threshold"]')?.value),
        effects
    };
}

/** Everything a caption, a tooltip or the editor's preview needs, in one read. */
export function overflowStatus() {
    const drawn = overflowEffect();
    return {
        count: state().count,
        threshold: overflowThreshold(),
        active: drawn !== null,
        effect: drawn,
        effectName: drawn ? game.i18n.localize(`DRPG.Overflow.name.${drawn}`) : null,
        pool: overflowPool(),
        rules: overflowRules()
    };
}

/* ==========================================================================
 * THE ONE DEBUFF WITH NO SINGLE SOURCE TO ASK
 * ========================================================================== */

/**
 * Despair: no Hope is earned while it runs.
 *
 * A HOOK, BECAUSE THERE IS NOWHERE ELSE TO PUT IT. Hope arrives from eight
 * places in this module and from Daggerheart's own roll pipeline with a plain
 * `actor.update()` carrying none of our flags - resource-guard.mjs says exactly
 * this, and is why it deliberately does not guard `hope.value`. Any reader we
 * added would be one of nine, and the ninth would be the one that mattered.
 *
 * ONLY THE INCREASE. Spending Hope, and a GM correcting a number downward, both
 * go through untouched: this stops the tap, not the drain. And only while the
 * draw is Despair - every other hour this hook costs one comparison.
 */
function onPreUpdateActor(actor, changes) {
    try {
        if (!overflowBlocksHope()) return true;
        if (actor?.type !== "character") return true;

        const next = foundry.utils.getProperty(changes, "system.resources.hope.value");
        if (next === undefined) return true;

        const held = Number(actor.system?.resources?.hope?.value ?? 0);
        if (!(Number(next) > held)) return true;

        // Deleted rather than the whole update refused: a roll that grants Hope
        // usually writes other things in the same breath, and cancelling all of
        // it would take those too.
        delete changes.system.resources.hope.value;
        return true;
    } catch {
        // A throw here would block every actor update in the world.
        return true;
    }
}

export function registerOverflow() {
    Hooks.on("preUpdateActor", onPreUpdateActor);
}
