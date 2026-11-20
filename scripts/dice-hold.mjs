/**
 * What a roll moved, shown on this browser once this browser's dice of that roll have landed (1.2.119; the owner,
 * 20.11.2026: "Despair powinno sie aktualizowac dopiero po zakonczeniu animacji kosci dice so nice, tak samo z hope").
 *
 * THE VALUES ARE WRITTEN AS BEFORE. A roll's Hope and its Monokuma's Despair land in the world at once: the guards, the
 * GMs' audit (sheet-audit.mjs) and the GMs' records read them as they arrive. Only what each browser SHOWS waits, and
 * for that browser's own animation of the roll: the sheet's Hope (sheet-repaint.mjs `installRenderPlan`) and the Despair
 * rows (settings.mjs, the pools' `onChange`) - a pip that moved while the dice still tumbled told the table the answer
 * to the throw it was watching.
 *
 * WHICH WRITE IS A ROLL'S: THE WRITER SAYS SO, IN THE UPDATE'S OPTIONS. The browser that writes a roll's resources
 * names the roll's message in the write's options (`DICE_OPTION`): the primary GM, around a drawn roll's resource step
 * (roll-draw.mjs `throwDrawn`, `stampRollWrites`, which stamps every `preUpdateActor` of the roll's character while the
 * step runs - Daggerheart's own `modifyResource` writes the Hope where the GMs' maxima agree, and takes no options from
 * the module), and its Despair point (despair-award.mjs `awardRollDespair` -> despair.mjs `adjustDespair`, the pools'
 * setting written with the option). Foundry hands an update's options to every browser's `updateActor` and to a
 * setting's `onChange` (v13's `Setting#_onUpdate` as remembered, not read in v14's source: LIVE-S119-01). A write
 * without the option - a GM's hand edit, a Call's price - is painted at once, and so is a roll's with no dice in
 * flight here: no Dice So Nice, its animation off, a message it does not animate, or past `TIMING.diceSettleMs`.
 *
 * THIS BROWSER'S DICE OF A MESSAGE (`diceSettledHere`): Dice So Nice's wait for the message's animation
 * (`waitFor3DAnimationByMessageID`, which answers at once for a message it is not animating - private-rolls.mjs
 * `keepDiceToReaders`' note, read in 6.3.1), and the module's own throws of it (`noteThrow`: a drawn roll's dice on the
 * roller's screen, roll-draw.mjs `startOnMessage`, or at the draw's answer where they did not start at the message; on
 * the primary GM's, `throwOnThisScreen`; on its audience's, private-rolls.mjs `showRelayedDice`, noted as the relay
 * arrives, before it waits for the message), each bounded by `TIMING.diceSettleMs` from the first ask, as action-report.mjs
 * `diceSettled` bounds the card's wait.
 *
 * WHAT IS HELD IS A PAINT, NOT A VALUE. A held paint runs when every roll it waits on has landed here, and reads the
 * world then: a second change that arrived meanwhile is shown, never the one before it (`holdPaint`). A paint without
 * the option drops what was held under the same name and paints the world as it is.
 *
 * It imports config.mjs and utils.mjs alone; settings.mjs reads it by `import()` (utils.mjs imports settings.mjs, so a
 * static import there would close a cycle: R161).
 */

import { TIMING } from "./config.mjs";
import { error } from "./utils.mjs";

/** The update option that names the chat message whose roll a write carries out (Foundry passes it to every browser). */
export const DICE_OPTION = "drpgDiceOf";

/** This browser's own throws of a message's dice: message id -> promises (`noteThrow`). */
const THROWS = new Map();
/** A message's dice on this browser: message id -> { done, deadline, settled } (`diceSettledHere`). */
const SETTLES = new Map();
/** The paints held, by name: name -> { paint, waits: Set of message ids } (`holdPaint`). */
const HELD = new Map();
/** While a roll's resource step writes on this browser: actor id -> message id (`stampRollWrites`). */
const STAMPING = new Map();
/** The option an actor's last update carried on this browser, read by the sheet's repaint (`takeActorDice`). */
const LAST_ACTOR_DICE = new Map();

/** The module's throws noted and not landed yet, on this browser (`anyDiceFalling`). */
let throwsInFlight = 0;

/** Forget a message's bookkeeping a while after its deadline, so neither map grows with the session. */
const forgetLater = id => setTimeout(() => { THROWS.delete(id); SETTLES.delete(id); }, 2 * TIMING.diceSettleMs);

/** A throw of `messageId`'s dice on this screen, played by the module (`promise` settles when the dice have landed). */
export function noteThrow(messageId, promise) {
    if (!messageId || !promise || typeof promise.then !== "function") return;
    if (!THROWS.has(messageId)) THROWS.set(messageId, new Set());
    throwsInFlight++;
    THROWS.get(messageId).add(Promise.resolve(promise).catch(() => {}).finally(() => { throwsInFlight--; }));
    forgetLater(messageId);
}

/** Dice So Nice's wait for `messageId`'s animation on this browser, or null when there is none to wait for. */
function dsnWait(messageId) {
    const wait = game.dice3d?.waitFor3DAnimationByMessageID;
    if (typeof wait !== "function") return null;
    try { return Promise.resolve(wait.call(game.dice3d, messageId)).catch(() => {}); } catch { return null; }
}

/**
 * Whether `messageId`'s dice may still be falling on this browser: false with no message, and with neither Dice So
 * Nice nor a throw of the module's noted for it - so a browser without dice never holds a paint.
 */
export function diceMayFall(messageId) {
    if (!messageId) return false;
    const known = SETTLES.get(messageId);
    if (known) return !known.done;
    return typeof game.dice3d?.waitFor3DAnimationByMessageID === "function" || (THROWS.get(messageId)?.size ?? 0) > 0;
}

/**
 * A promise that settles when `messageId`'s dice have landed on this browser: Dice So Nice's animation and every throw
 * of the module's noted for it, by `TIMING.diceSettleMs` from the first ask at the latest. A throw noted after the first
 * ask is waited for too, within the same deadline.
 */
export function diceSettledHere(messageId) {
    if (!messageId) return Promise.resolve();
    const known = SETTLES.get(messageId);
    if (known) return known.settled;
    const entry = { done: false, deadline: Date.now() + TIMING.diceSettleMs, settled: null };
    SETTLES.set(messageId, entry);
    entry.settled = (async () => {
        const dsn = dsnWait(messageId);
        let seen = -1;
        for (;;) {
            const throws = [...(THROWS.get(messageId) ?? [])];
            if (throws.length === seen) break;
            seen = throws.length;
            const left = entry.deadline - Date.now();
            if (left <= 0) break;
            await Promise.race([Promise.all([dsn, ...throws].filter(Boolean)), new Promise(resolve => setTimeout(resolve, left))]);
        }
        entry.done = true;
    })();
    forgetLater(messageId);
    return entry.settled;
}

/**
 * Paint now, or once `messageId`'s dice have landed here. `name` says what the paint draws (one sheet, the Despair
 * rows): a later paint of the same name takes the place of a held one and waits for its roll as well as the rolls the
 * held one waited for. A paint with no message, or one whose dice are not falling here, runs at once, and drops what
 * was held under its name - it draws the world as it is now, the held change with it. Answers whether the paint waits.
 */
export function holdPaint(messageId, name, paint) {
    const run = fn => { try { fn(); } catch (err) { error(`Could not draw ${name} after a roll's dice`, err); } };
    if (!diceMayFall(messageId)) {
        HELD.delete(name);
        run(paint);
        return false;
    }
    const held = HELD.get(name) ?? { paint, waits: new Set() };
    held.paint = paint;
    held.waits.add(messageId);
    HELD.set(name, held);
    diceSettledHere(messageId).then(() => {
        const now = HELD.get(name);
        if (now !== held) return;
        held.waits.delete(messageId);
        if (held.waits.size) return;
        HELD.delete(name);
        run(held.paint);
    });
    return true;
}

/** Whether a paint is held under `name` now (the suite's reading). */
export function paintHeld(name) {
    return HELD.has(name);
}

/**
 * Run `write` - a roll's resource step on this browser - with every update of the actors `actorIds` stamped with
 * `messageId` (`DICE_OPTION`), in `preUpdateActor` (`registerDiceHold`), so that each browser holds the paint until the
 * roll's dice have landed there. An actor already stamped for another message keeps the newer stamp until this step ends.
 */
export async function stampRollWrites(messageId, actorIds, write) {
    const ids = [...new Set((actorIds ?? []).filter(Boolean))];
    if (!messageId || !ids.length) return write();
    for (const id of ids) STAMPING.set(id, messageId);
    try {
        return await write();
    } finally {
        for (const id of ids) if (STAMPING.get(id) === messageId) STAMPING.delete(id);
    }
}

/**
 * The roll the last update of `actorId` on this browser carried, null when none: read by every repaint that update asked
 * for. Not taken on reading: one update renders each window open on the actor (two sheets, or the harness's shim and the
 * test's stand-in) and a stamp taken by the first left the second to paint at once (S119-T1 at its first build). The
 * actor's next update replaces it (`registerDiceHold`).
 */
export function takeActorDice(actorId) {
    return LAST_ACTOR_DICE.get(actorId) ?? null;
}

/**
 * Whether any roll's dice may still be falling on this browser (the sheet's repaint asks before it waits): a roll's
 * message whose settle has not ended (started as it arrives, `noteRollMessage`) or a throw of the module's not landed.
 * False otherwise, and then the repaint is drawn in the render's own turn, as before 1.2.119: with Dice So Nice merely
 * installed, every repaint went through a microtask, and a repaint that threw no longer fell back to the render (R1477)
 * and nothing was drawn when the render returned (R1479), tiers 0-1 at fff080ad.
 */
export function anyDiceFalling() {
    return throwsInFlight > 0 || [...SETTLES.values()].some(entry => !entry.done);
}

/**
 * A chat message with dice has arrived on this browser: its settle starts now (`diceSettledHere`), so its deadline
 * runs from the message and `anyDiceFalling` knows of it before the roll's writes arrive. The `createChatMessage` hook's,
 * and the suite's stand-in for one (S119-T1).
 */
export function noteRollMessage(message) {
    if (!message?.id || !((message.rolls?.length ?? 0) > 0)) return;
    void diceSettledHere(message.id);
}

/**
 * The hooks: a stamp on a roll's writes on the writer's browser, and on every browser the stamp an actor's update
 * carried, kept for the sheet's repaint that the same update asked for (Foundry runs the sheet's render inside the
 * update, before `updateActor`, on 14.365: sheet-repaint.mjs "THE ORDER"; the repaint reads it a microtask later).
 */
export function registerDiceHold() {
    Hooks.on("createChatMessage", message => noteRollMessage(message));
    Hooks.on("preUpdateActor", (actor, changes, options) => {
        const id = STAMPING.get(actor?.id);
        if (id && options && typeof options === "object") options[DICE_OPTION] = id;
    });
    Hooks.on("updateActor", (actor, changes, options) => {
        const id = options?.[DICE_OPTION];
        if (typeof id === "string" && id) LAST_ACTOR_DICE.set(actor.id, id);
        else LAST_ACTOR_DICE.delete(actor?.id);
    });
}
