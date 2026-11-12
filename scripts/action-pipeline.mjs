/**
 * Danganronpa RPG - an action's roll and what is kept of it.
 * ---------------------------------------------------------------------------
 * What every action throws through: the roll (`rollTrait`, `throwDice`) and the
 * marks on its config (`DRPG_ACTION_ROLL`, `DRAWN_ROLL`, `TRAIT_BY_GM`), what a
 * readied Tool takes off a threshold (`toolRelief`) and the "needed N" a card
 * shows (`neededNote`); the roll this browser holds and what it tells the GMs of
 * it (`rollInHand`, `rememberRoll`, `tellGmsOfRoll`, `noteRollContext`, the
 * claims and the facts), the GMs' Reroll bookmark (`keepGmBookmark`,
 * `dropRollBookmarks`); a roll's two dice (`dualityOf`) and the resources it
 * commits (`commitResources`); an action's price and its refund (`canAfford`,
 * `abort`, `spentAfterRoll`); and the buttons of a card a GM rules on
 * (`roomAudience`, `declineAction`, `ruledMissAction`, `missAction`,
 * `gmRulingActions`).
 *
 * WHERE IT SITS. Moved out of action-rolls.mjs by E41 C3 (1.2.97), a pure move
 * that `node tools/moved-only.mjs` proves line by line. action-rolls.mjs
 * re-exports the 24 names here it exported before, so every importer still
 * imports action-rolls.mjs, and nothing here imports it back (the facade rule,
 * .claude/rules/code.md). Seven names are exported that were not (`remnantRef`,
 * `canAfford`, `roomAudience`, `declineAction`, `ruledMissAction`, `missAction`,
 * `gmRulingActions`), because the actions call them (in action-rolls.mjs at
 * E41 C3, each in a file of its own since C4); action-rolls.mjs does not
 * re-export them. It imports nothing of the
 * action family; call-effects.mjs and gm-bridge.mjs, other families' facades,
 * and forced-roll.mjs, secret.mjs and reroll.mjs are read by `import()` where
 * the roll needs them, as before the move.
 */

import { MODULE_ID, FLAGS, ACTIONS, TRAITS, TRAIT_BY_DH, TOOL_IN_HAND, TIMING } from "./config.mjs";
import { actionsLeft, refundAction, canPayFor } from "./actions.mjs";
import { roomOfActor, othersInRoom } from "./movement.mjs";
import {
    whisperToOwner, forcedDeletion, isPrimaryGm, log, warn, error, plural, cardHead, gmIds, ownerIdsOf, MESSAGE_FLAG
} from "./utils.mjs";
// Static, and safe to be: nothing private-rolls.mjs imports leads back here.
import { supersedingRoll, reportRollSubject, isClaimedRoll, ROLL_NONCE } from "./private-rolls.mjs";
import { carryMarks, fillRollFacts } from "./roll-marks.mjs";
import { rerollBookmarkStore } from "./gm-stores.mjs";

/** What a readied Tool takes off a threshold. 0 for bare hands. Exported for the GM's band of a Sabotage's trace (bridge-runs-records.mjs `traceBandOf`). */
export function toolRelief(tool, tierOf) {
    return TOOL_IN_HAND.tierReducesThreshold && tool ? tierOf(tool) : 0;
}

/**
 * The flag that says "this roll came from an action", carried on the roll
 * config from here to the roll dialog and on to the chat message.
 *
 * A plain string key rather than a Symbol: the config is serialised into the
 * roll's options and read back off the message, and a Symbol does not survive
 * that trip.
 */
export const DRPG_ACTION_ROLL = "drpgActionRoll";

/**
 * The roll was drawn by the primary GM (E08+E28 C12a; roll-draw.mjs): `{ rollId, messageId,
 * stash, loaded }` on the config the roller's browser plays the GM's faces into. The GM wrote
 * the message, settled the roll's resources and spent the Calls it applied, so
 * `commitResources` commits nothing for it and `throwDice` spends nothing; `stash` is the
 * hidden stash's step the GM drew (`stashStepOf`), `loaded` whether it loaded the die (C12b).
 * Never sent: it is put on the config after the roll has left for the GM.
 */
export const DRAWN_ROLL = "drpgDrawn";

/**
 * The trait on this roll is a GM's pick (E32+E07 C11b; trait-ruling.mjs): the roll
 * window keeps its Statistic select locked and says who chose it (roll-dialog.mjs
 * `lockTrait`). A string key for the reason above. The GM that draws the roll does not
 * read it: whether a GM picked is that GM's own reading (E08+E28 fix r2-H8; roll-draw.mjs
 * `TRAIT_SOURCES`, its `gm` row, since E29 fix r1-G10).
 */
export const TRAIT_BY_GM = "drpgTraitByGm";

/**
 * Is the regression suite throwing these dice?
 *
 * A global rather than an import, and deliberately: the suite imports this file
 * and half the module besides, so the arrow has to point this way. Read at roll
 * time, never cached, and false for everything a player ever does.
 */
function suiteRolling() {
    return Boolean(globalThis.game?.drpg?.suiteRolling);
}

/* ==========================================================================
 * ROLLING
 * ========================================================================== */

/**
 * Roll through the system so dice, skins and chat cards behave normally.
 *
 * Daggerheart's roll pipeline only *prepares* the resource changes a duality
 * roll causes - +1 Hope, -1 Sanity on a critical, +1 Fear - and leaves them in
 * `result.resourceUpdates` for the caller to commit. The sheet's own trait
 * button calls `updateResources()`; ours has to as well, or actions roll dice
 * and quietly hand out nothing.
 */
/**
 * @param {Actor} actor
 * @param {string} drpgTrait
 * @param {object} [options]
 * @param {boolean} [options.remember]  Is this *the* roll of the action?
 *   Several actions throw more than one - sabotage rolls to conceal itself
 *   first, an indirect-murder project rolls to conceal intent and again to hide
 *   its traces. Only one of them is the action's result, and only that one is
 *   what Reroll should take back. Without this the bookmark ended up pointing at
 *   whichever supporting roll happened to come last, so Reroll appeared to pick
 *   a roll at random.
 * @param {string} [options.actionKey]  WHICH action this roll belongs to.
 *   Reroll dispatches on it to undo and replay the right thing. Only Work on
 *   Project ever recorded one, and only afterwards through `noteRollContext` -
 *   which is exactly why Reroll looked like it worked on projects and nothing
 *   else. Every other action left the bookmark with no action to replay, so the
 *   Call re-rolled the dice in the chat card and changed nothing in the world.
 * @param {object} [options.context]  Everything about the action that is already
 *   known BEFORE the dice land - which room, which category, what was being
 *   looked for. Recorded here rather than in the `noteRollContext` at the end of
 *   the action, because every one of those calls sits after a chain of early
 *   returns. A Search whose room ran out of tokens between the picker and the
 *   spend left a bookmark saying "search" and nothing else, and Reroll then had
 *   an action name it could not act on - which reads exactly like Reroll not
 *   working on Search at all.
 *
 * @param {boolean|string} [options.byGm]  The trait is a GM's pick (`TRAIT_BY_GM`), and the
 *   window says so on its locked select: "approved" or "changed" a proposal (E68 C1), else true.
 * @param {number} [options.situational]  This roll's own advantage (+) or disadvantage
 *   (-) in dice, which a supporting roll's shield does not hide (call-effects.mjs
 *   `armOwnSituational`): the Night's die on a murder's opening roll, its one caller.
 * @param {number} [options.hindrance]  Hindrance dice given to this roll by name, its cause not said (call-effects.mjs
 *   `armOwnHindrance`): a watch's die on the killer's opening roll (E74, DA44), its one caller.
 *
 * Exported because the murder engine rolls through it too: a crisis action and
 * an opening roll are ordinary trait rolls that must commit resources, honour
 * an armed Call and record a Reroll bookmark exactly like a Search does.
 * `murder.mjs` already imported it - but it was module-private, so the import
 * resolved to `undefined` and every crisis action died on
 * "rollTrait is not a function" before a single die was thrown.
 */
export async function rollTrait(actor, drpgTrait,
    { remember = true, actionKey = null, context = null, title = null, dc = null, byGm = false, situational = 0, hindrance = 0, titled = false } = {}) {
    // "Beat 12" on the window that throws the dice (D1). `dc` may be a number
    // or a ladder written as text ("12 / 18"); a window with no title of its
    // own takes the action's label so the number has something to hang on.
    // `titled`: the title says its number already, in its own words (`palmTitle`, E51 C1).
    const shown = dc !== null && dc !== undefined && dc !== "";
    if (shown && !titled) {
        const heading = title ?? ACTIONS[actionKey]?.label ?? null;
        const beat = game.i18n.format("DRPG.Action.beat", { n: dc });
        title = heading ? `${heading} · ${beat}` : beat;
    }
    const calls = await import("./call-effects.mjs");

    // `remember: false` marks a supporting roll - concealing an intent, hiding
    // traces. Those must not eat the Call the player bought for the action's own
    // roll, so the Call is hidden from this roll and from its dialog entirely. A die
    // given to this roll by name is its own, and is not hidden (`situational`).
    const supporting = !remember;
    if (supporting) calls.shieldCalls();
    if (situational) calls.armOwnSituational(situational);
    if (hindrance) calls.armOwnHindrance(hindrance);
    try {
        /* THE NUMBER RIDES ON THE ROLL TO ITS CARD (E51 C1; the owner's amendment of 14.10: "modul w zaden sposob nie
           informuje ani gracza, ani gma o thresholdach akcji"). The window said "beat N" and the card said the total
           alone, so a reader of the card had to know the table. `dc` is kept on the outcome for the card that reports
           it (`rollHead`, `report`, a concealment's line: "needed N") and is read by nothing that judges - every
           judgement reads its own number (the GM's `applyCrisisAction`, `stealFromPerson`, the bands). */
        const outcome = await throwDice(actor, drpgTrait, { remember, actionKey, context, title, byGm });
        if (outcome && shown) outcome.dc = dc;
        return outcome;
    } finally {
        if (situational) calls.clearOwnSituational();
        if (hindrance) calls.clearOwnHindrance();
        if (supporting) calls.unshieldCalls();
    }
}

/** " (needed N)" after a total written into a card's own line - a concealment's (E51 C1), "" with no number. */
export function neededNote(n) {
    return n === null || n === undefined || n === "" ? "" : ` (${game.i18n.format("DRPG.Action.needed", { n })})`;
}

/** The roll itself, once it has been decided whether a Call may touch it. */
async function throwDice(actor, drpgTrait, { remember, actionKey, context, title = null, byGm = false }) {
    const dhTrait = TRAITS[drpgTrait]?.dh ?? drpgTrait;

    const { pendingCalls, consumeCallsByNonce } = await import("./call-effects.mjs");
    // Every Call armed for this roll, because they stack (CALL-02). The Loaded
    // Die is the one this roll has to be marked with.
    const armedCalls = pendingCalls(actor);
    const armed = armedCalls.find(entry => entry.grants === "critical") ?? null;

    // A Free Critical still throws the dice - it just decides in advance what
    // they will say. See forced-roll.mjs for why a real roll matters.
    const free = armed?.grants === "critical";
    const { LOADED_DIE, loadedDieHeld } = await import("./forced-roll.mjs");

    // Always open the configuration window.
    //
    // Daggerheart derives `dialog.configure` from `config.event`, reading
    // modifier keys off it. Called from our own code there is no event, so the
    // window was being skipped - actions rolled straight to chat with no chance
    // to use a Call. Both are supplied explicitly.
    // The system's own card for this roll is claimed as it is created and
    // never rendered: this module reports the same roll in its own card,
    // with the same two faces and the same total. See `supersedingRoll` in
    // private-rolls.mjs - and note the claim covers only THIS roll, so a
    // trait rolled straight off the sheet keeps Daggerheart's card, even
    // while this roll's window is open: the claim takes the message whose
    // roll carries its nonce (`ROLL_NONCE`, E08+E28 C11), not the first one.
    // The options' marks carried on their own event (roll-marks.mjs, E76b): Daggerheart 2.12's MoveContext keeps the
    // event and none of the module's keys, and the build puts them back from it (roll-draw.mjs `drawnBuild`, the
    // `daggerheart.preRollDuality` hook). Up to 2.10 the keys reach the build on the options as they always did.
    const result = await supersedingRoll(nonce => actor.rollTrait(dhTrait, carryMarks({
        event: { shiftKey: false, altKey: false, ctrlKey: false },
        /*
         * ALWAYS OPEN THE WINDOW - except for the regression suite, which
         * has nobody to press the button.
         *
         * Daggerheart derives `dialog.configure` from `config.event`,
         * reading modifier keys off it; called from our own code there is
         * no event, so the window was skipped and actions rolled straight
         * to chat with no chance to use a Call. Both are supplied
         * explicitly.
         *
         * `suiteRolling` is the one exception and it is not a shortcut: the
         * scenarios test what the engine does with a NUMBER, and a modal
         * per roll turns a forty-second run into minutes and times the
         * scenarios out - measured, three failures, none of them about the
         * thing under test. Whether the window opens at all is its own
         * question with its own scenario. See `autoRollForSuite`.
         */
        dialog: { configure: !suiteRolling() },
        /*
         * THIS ROLL IS AN ACTION, AND SAYING SO IS WHAT MAKES THE OTHER
         * KIND TELLABLE.
         *
         * `actor.rollTrait` is the same door for two very different things:
         * an action from the grid, and a player clicking a statistic on
         * their own sheet because a GM asked them to roll Body. Only the
         * first is part of the economy - it costs an action, it was
         * declared, and its Hope and Despair are earned. The second is
         * forced to a reaction roll and pays nothing, which it cannot be
         * unless something distinguishes them, and the roll's own config is
         * the only thing that travels all the way to both the dialog and
         * the chat card. See roll-dialog.mjs and despair-award.mjs.
         */
        [DRPG_ACTION_ROLL]: true,
        // The claim's own mark, so the claim takes this roll's message and no other.
        [ROLL_NONCE]: nonce,
        // The roll the Loaded Die was bought for, marked on the roll itself -
        // see `LOADED_DIE` in forced-roll.mjs.
        ...(free ? { [LOADED_DIE]: armed?.nonce ?? foundry.utils.randomID() } : {}),
        // A GM picked the trait: the window's select stays locked and says so - "approved" or "changed" where the
        // player proposed one (E68 C1, trait-ruling.mjs `traitFor`), else true.
        ...(byGm ? { [TRAIT_BY_GM]: byGm === "approved" || byGm === "changed" ? byGm : true } : {}),
        // Say what the roll is FOR.
        //
        // Left alone, Daggerheart titles the window from the trait - "Body
        // Roll: Player A" - which is true and useless: the opening roll of
        // a murder and a shove in a corridor are the same two words. Worse
        // for the murder project, where three windows open one after the
        // other, all called "Shadow Roll", and the player answers the same
        // question three times without being told which is which.
        ...(title ? { title, headerTitle: title } : {})
    })), { subject: actor, actionKey, facts: { calls: armedCalls.map(entry => entry.nonce), context } });
    if (!result) return null;
    // Which character the roll is about: told to the primary GM as the message
    // was created (the claim's `subject`, E06 fix r1-G2), because the Despair
    // award is waiting for it (`rollSubject`, private-rolls.mjs, E06 C5a). Asked
    // again here for a roll the claim did not see created; a repeat says nothing.
    reportRollSubject(result.message ?? result.raw?.message, actor);

    // On Daggerheart 2.12 the outcome is the evaluated Roll, not `config.roll` (roll-marks.mjs `fillRollFacts`, E76b).
    fillRollFacts(result);
    const roll = result.roll ?? result;
    const total = roll?.total ?? result?.total;
    if (typeof total !== "number") return null;

    await commitResources(result);
    // Whatever the Calls bought, they bought it for this roll and no other - the ones
    // read above, before the window opened. The window opened with each of them
    // (roll-dialog.mjs `windowCalls`) and its close has spent them already where
    // there was a window; this spends them where there was none. One armed after
    // that stays armed for the next roll (S02-20, E08+E28 C7): `consumeCalls` spent
    // the whole list, whatever this roll had applied. A roll the GM drew had its Calls
    // spent by the GM, who read them first (E08+E28 C12b, roll-draw.mjs `drawOnGm`); the
    // claim's `facts` told it which.
    const drawn = result?.[DRAWN_ROLL] ?? null;
    if (armedCalls.length && !drawn) await consumeCallsByNonce(actor, armedCalls.map(entry => entry.nonce));
    // The Loaded Die is the GM's to load on a drawn roll, and it says whether it did (E28). On a roll this browser
    // threw, it counts only where the die held (forced-roll.mjs `loadedDieHeld`; E16 part 2 C5, audit S02-44): a d12
    // drawn by another dice method shows an honest face, and the roll was told "freeCritUsed" all the same.
    const loaded = drawn ? drawn.loaded === true : free && loadedDieHeld(result);
    // One that did not hold gives its Call back (E64, D052; call-effects.mjs `giveBackLoadedDie`): here only where this
    // browser threw the dice, which with a Loaded Die armed is a GM's - a player's roll is drawn, and the GM that drew it
    // gave it back there (roll-draw.mjs `throwDrawn`).
    if (free && !drawn && !loaded) {
        const { giveBackLoadedDie } = await import("./call-effects.mjs");
        await giveBackLoadedDie(actor, armed);
    }

    const outcome = {
        total,
        ...dualityOf(roll),
        // What the dialog actually rolled, not what was asked for: Search and a
        // Determination grant unlock the statistic select, and every reader of
        // this - the card header, the duality chip, the bookmark - mislabelled
        // a Hand roll as Eye (ROLL-06). Falls back to the argument when the
        // system's result does not say.
        trait: traitRolled(result, drpgTrait),
        freeCritical: loaded,
        raw: result
    };

    if (loaded) {
        await whisperToOwner(actor, `${cardHead({
            action: game.i18n.localize("DRPG.Calls.freeCritTitle")
        })}<p>${
            game.i18n.format("DRPG.Calls.freeCritUsed", { name: foundry.utils.escapeHTML(actor.name) })
        }</p>`);
    }

    if (remember) await rememberRoll(actor, outcome, result, actionKey, context);
    return outcome;
}

/** The module's trait key for whatever statistic the system's result says was rolled. */
function traitRolled(result, fallback) {
    const dh = result?.roll?.options?.roll?.trait
        ?? result?.roll?.options?.trait
        ?? result?.config?.roll?.trait
        ?? result?.data?.roll?.trait
        ?? result?.roll?.trait
        ?? null;
    return (dh && TRAIT_BY_DH[dh]) || fallback;
}

/* ==========================================================================
 * WHAT THIS BROWSER TELLS THE GMS OF ITS NEWEST ROLL
 * ==========================================================================
 *
 * E05 C7 moved the Reroll's bookmark off the actor flag `lastAction` (on every
 * browser: 72-canary read Chie's crisis context off p1's copy of her actor) into the
 * roller's own client setting `rollBookmarks`, and the Reroll read it there. Since
 * E08+E28 C4a (03.10.2026; audit S02-47, the owner's answer to E05's Q6) the Reroll
 * is made on a GM from the GMs' own bookmark ("ON THE GMS" below), and this browser
 * keeps nothing a Reroll reads. What is left here is the roll this browser threw last
 * for each character, in memory and for this session only, so an action that learns
 * more of its roll (`noteRollContext`) can tell the GMs the roller's claims again
 * whole - `keepGmBookmark` takes them whole. A reload loses it, and loses nothing:
 * the GMs were told as the roll returned.
 *
 * The retired setting is unregistered, and its value is taken out of this browser's
 * client storage once (`forgetRollBookmarks`), where Foundry keeps a client setting
 * under `<namespace>.<key>` - read in Foundry's `ClientSettings`, not measured at a
 * real table; the harness keeps no client storage, so there it does nothing.
 */
const rollsInHand = new Map();

/** What this browser last told the GMs of its newest roll of this character, or null. Exported for the suite. */
export function rollInHand(actor) {
    return actor?.id ? rollsInHand.get(actor.id) ?? null : null;
}

/**
 * Forget the roll this browser holds for `actor`, as a reload forgets it (E68 C11; D047). The suite's reload: the
 * Reroll's window then reads what calls.mjs `rollAfterReload` can.
 */
export function forgetRollInHand(actor) {
    if (actor?.id) rollsInHand.delete(actor.id);
}

/** The retired client setting `rollBookmarks`, out of this browser's client storage (E08+E28 C4a). At ready. */
export function forgetRollBookmarks() {
    const storage = game.settings?.storage?.get?.("client");
    const key = `${MODULE_ID}.rollBookmarks`;
    if (typeof storage?.getItem === "function" && storage.getItem(key) !== null) storage.removeItem(key);
}

/**
 * Record what was just rolled, so the Reroll Hope Call has something to take
 * back: the GMs are told (`tellGmsOfRoll`). Only the newest roll is kept - the
 * guide's Reroll undoes an action, not a history.
 *
 * The record is written fresh here rather than merged, so leftovers from the
 * previous action - a project id, a Remnant token, an item - can never be
 * attributed to this one. Each action then attaches its own context with
 * `noteRollContext` once it knows what it did.
 *
 * "Fresh" had to be spelled out while this was a flag: `setFlag` merges, and the
 * flag accumulated every field every action had ever written. The one that hurt
 * was `gmRuled` - `replayAction` tests it before it looks at the action key, so
 * a single Observe earlier in the session sent every subsequent Reroll down the
 * "ask the GM again" path instead of replaying the Search or the project that
 * was actually rerolled. The GMs' row is started afresh for a new roll the same
 * way (`keepGmBookmark`).
 */
async function rememberRoll(actor, outcome, result, actionKey = null, context = null) {
    try {
        const messageId = result?.message?.id ?? result?.message?._id ?? null;
        const bookmark = {
            ...(context ?? {}),
            messageId,
            actionKey,
            trait: outcome.trait,
            // The experiences the dialog picked, which the roll's message no longer
            // holds and a Reroll's rebuilt formula needs (reroll.mjs `rollAsThrown`,
            // E06 fix r1-G1): Daggerheart keeps them on the config it hands back.
            experiences: Array.isArray(result?.experiences) ? [...result.experiences] : [],
            total: outcome.total,
            withFear: outcome.withFear,
            isCritical: outcome.isCritical,
            freeCritical: Boolean(outcome.freeCritical),
            at: game.time?.worldTime ?? 0
        };
        if (actor?.id) rollsInHand.set(actor.id, bookmark);
        // Before the action asks the GM for anything it does: see `tellGmsOfRoll`.
        await tellGmsOfRoll(actor, bookmark);
    } catch {
        // Losing the record costs a Reroll, not the roll itself.
    }
}

/**
 * Where a Remnant this action dropped ended up, in a form the record can carry: a
 * GM's own trace, which `noteRollContext` writes onto the GMs' row as a fact. A
 * player's Remnant is placed by the GM over the socket, and that GM writes the fact
 * itself (bridge-runs-records.mjs `handleRemnant`).
 */
export function remnantRef(placed) {
    const doc = placed?.document ?? placed;
    if (!doc?.id) return { remnantId: null, remnantScene: null };
    return { remnantId: doc.id, remnantScene: doc.parent?.id ?? null };
}

/**
 * Attach the action's own context to the roll, once it is known.
 *
 * Replacement rather than merge, like `rememberRoll` - the spread of `current`
 * is what carries the rest forward, so a caller passing `{itemId: null}` here
 * genuinely clears the field.
 */
export async function noteRollContext(actor, data) {
    try {
        const current = rollInHand(actor);
        if (!current) return;
        const next = { ...current, ...data };
        rollsInHand.set(actor.id, next);
        // Told again only when it changes what the GMs keep of the roller's word: most
        // contexts add facts the GM did, which the GM wrote itself. The roll's card is
        // named once it is posted (`report`).
        if (next.actionKey !== current.actionKey || next.reportMessageId !== current.reportMessageId
            || JSON.stringify(rollClaims(next.actionKey, next)) !== JSON.stringify(rollClaims(current.actionKey, current))) {
            await tellGmsOfRoll(actor, next);
        }
        // A GM's own action placed its trace, froze its project and added its progress on
        // this client, not through the bridge's handlers that write those facts for a player.
        if (game.user?.isGM) await noteRollFact(actor.id, next.messageId, ownFacts(data));
    } catch {
        // Same again: informational only.
    }
}

/* ==========================================================================
 * THE REROLL BOOKMARK, ON THE GMS
 * ==========================================================================
 *
 * E08+E28 C2, 03.10.2026; audit S05-08, S08-04, S04-18; the plan's 2.2. A Reroll
 * is to be made on a GM (C4a), and the GM cannot take a roll's word for what its
 * action did: the bookmark above is the roller's own browser's. So the GMs keep a
 * row per character in a store of their own (gm-stores.mjs `rerollBookmarkStore`),
 * and it holds two kinds of thing.
 *
 * THE GM'S OWN FACTS, written by the GM that did the thing for that roll: the trace
 * `handleRemnant` placed (whose id a player's browser is never told - S05-08), the
 * plant `takePlant` handed over with its identity (S08-04), the project a sabotage
 * froze and the repair it made, the progress added, the Observe's key and result,
 * the bullet an Analyze read, the crisis action's pick, item, weapon and the
 * resources before the item (S04-18), the clean-up attempt. `noteRollFact` writes
 * one only on the row of the roll it was asked for: each writer reads the row's
 * message as it starts (`rollOfNow`) and names it as it writes, so a fact that took
 * a GM's dialog long enough for the character to roll again is dropped, not pinned
 * on the newer roll. Every packet that leads to a fact names its roll now, and the fact
 * waits for that roll's row (`noteFactOfRoll`): the Sabotage and the trace since fix
 * r1-G1, the resolvers' since fix r1-G2 (`rollOfFact`); a Reroll's replay still writes on
 * the row it read as it started.
 *
 * THE ROLLER'S CLAIMS, sent once after the roll by `roll.bookmark` and again when
 * the action adds one (`tellGmsOfRoll`): what the GM cannot see - which item the
 * Search put on the roller's own sheet, the category, the relief a Project's tool
 * gave. Picked per action (`ROLL_CLAIMS`) on the GM, whatever the packet holds. The
 * rule: a claim touches only the roller's own sheet; anything else a Reroll's
 * replay touches comes from a GM fact - or, for what only the roller saw of a
 * project's roll (a Work's relief and bonus, a Sabotage's penalty and relief), from
 * the claim held to what the GM sees, as the first throw's was (`projectExtrasHeld`,
 * `sabotageExtrasHeld`; fix r2-H3). A Dynamic action's band is no claim since the
 * same fix - a GM's ruling, or a GM's own pick kept as a fact (`OWN_FACTS`): the
 * replay read the roller's `bandIndex`, any of four.
 *
 * The roll itself - its total, its duality, its rolls as first thrown - is read off
 * the message on the GM; the trait and the experiences are the roller's (the message
 * does not hold the experiences, see `rememberRoll`), and so is the room the character
 * stood in as the row started, read on the GM. The Reroll reads this row on the GM
 * since C4a (reroll.mjs `rerollOnGm`): its replay is handed the claims with the facts
 * over them (`replayBookmark`).
 *
 * WHAT A REPLAY NEEDS OF THE ROLLER (E08+E28 C4a). The replays read more of the roll
 * than C2's claims held, and each was a field of the roller's own bookmark: a Listen's
 * room, a ruling's request, the clean-up's declaration, whether a Project's critical
 * gave its action back and from what. They are claims now, of the same kinds; none of
 * them names a document the replay writes but the roller's own sheet, and the clean-up's
 * are judged again where they were judged for the first throw - `resolveCleanup` holds
 * the trace to the GMs' receipt of the attempt (`undoLastCleanup`) and bounds the
 * declaration and the price.
 *
 * ORDER. `roll.bookmark` leaves as the roll returns, before the action sends anything
 * else, and packets from one sender reach the GM in order. Its guards wait only when
 * the message has not reached the GM yet (`guardRollAuthor`); a fact asked in that
 * wait finds the row of the roll before, and is dropped with it when the new row
 * replaces it. The harness's runs measured the row there first; a table's timing is
 * not measured.
 */

/**
 * What a roller's browser may say about its roll, per action, and as what. An action
 * not listed claims nothing.
 */
export const ROLL_CLAIMS = Object.freeze({
    search: Object.freeze({ itemId: "id", category: "text", goal: "text", tier: "num", stashDie: "bool", claimed: "bool", fromVault: "bool",
        gmRuled: "bool", label: "text", request: "text" }),
    project: Object.freeze({ relief: "num", bonus: "num", refunded: "bool", burst: "bool" }),
    sabotage: Object.freeze({ penalty: "num", relief: "num" }),
    dynamic: Object.freeze({ description: "text" }),
    listen: Object.freeze({ target: "text" }),
    observe: Object.freeze({ gmRuled: "bool", label: "text", request: "text" }),
    analyze: Object.freeze({ gmRuled: "bool", label: "text", request: "text" }),
    cleanup: Object.freeze({ cleanup: "text", cleanupKey: "text", cleanupChange: "obj", cleanupVia: "bool", cleanupPrice: "text",
        cleanupGrant: "bool", cleanupTarget: "id" })
});

const CLAIM_AS = Object.freeze({
    id: v => typeof v === "string" && v.length > 0 && v.length <= 128 ? v : null,
    text: v => typeof v === "string" ? v.slice(0, 400) : null,
    num: v => typeof v === "number" && Number.isFinite(v) ? v : null,
    bool: v => typeof v === "boolean" ? v : null,
    obj: v => {
        if (!v || typeof v !== "object" || Array.isArray(v)) return null;
        try { return JSON.stringify(v).length <= 400 ? JSON.parse(JSON.stringify(v)) : null; } catch { return null; }
    }
});

/** The claims an action's context makes, as `ROLL_CLAIMS` lists them; anything else is dropped. */
export function rollClaims(actionKey, context) {
    const fields = Object.hasOwn(ROLL_CLAIMS, actionKey ?? "") ? ROLL_CLAIMS[actionKey] : {};
    const out = {};
    for (const [field, kind] of Object.entries(fields)) {
        if (context?.[field] === undefined) continue;
        out[field] = CLAIM_AS[kind](context[field]);
    }
    return out;
}

/**
 * The facts a GM's own action wrote into its context, which a player's are written by the bridge's handlers.
 * A Dynamic action's band is one since fix r2-H3: a GM's own picks it in its own window (`askDynamicDifficulty`)
 * and leaves no ruling on a card, where a player's band is read (bridge-runs-records.mjs `dynamicRulingOf`).
 */
// A GM's own Find Stash (E80 C4): what a player's is given by bridge-runs-acts.mjs `handleFindStash`, for its Reroll's replay;
// `findPlace` the place it searched (E80 fix r1-G4).
const OWN_FACTS = ["remnantId", "remnantScene", "repairId", "targetProjectId", "projectId", "progress", "bandIndex", "findStash", "stashFound",
    "findPlace"];

function ownFacts(data) {
    return Object.fromEntries(OWN_FACTS.filter(f => data?.[f] !== undefined).map(f => [f, data[f]]));
}

/**
 * Tell the GMs what was rolled: `roll.bookmark`, judged on the primary, kept by a GM
 * here (bridge-asks.mjs `requestRollBookmark`). Nobody waits on it; a refusal is the
 * GM's log line.
 */
async function tellGmsOfRoll(actor, bookmark) {
    if (!actor?.id || !bookmark?.messageId) return;
    const { requestRollBookmark } = await import("./gm-bridge.mjs");
    await requestRollBookmark({
        actorId: actor.id, messageId: bookmark.messageId, actionKey: bookmark.actionKey ?? null,
        trait: bookmark.trait ?? null, experiences: bookmark.experiences ?? [],
        context: rollClaims(bookmark.actionKey, bookmark), reportMessageId: bookmark.reportMessageId ?? null
    });
}

/** The message of the roll the GMs keep for this character, or null - what a fact names as its writer starts. */
export function rollOfNow(actorId) {
    return game.user?.isGM ? rerollBookmarkStore.get(actorId ?? "")?.messageId ?? null : null;
}

/** The character and roll of `userId`'s newest kept roll of this action - for a request that names no character. */
export function rollOfSender(userId, actionKey) {
    if (!game.user?.isGM || !userId) return null;
    let found = null;
    for (const [actorId, row] of Object.entries(rerollBookmarkStore.entries())) {
        if (row?.by !== userId || row.actionKey !== actionKey) continue;
        if (!found || (row.at ?? 0) > found.at) found = { actorId, messageId: row.messageId, at: row.at ?? 0 };
    }
    return found;
}

/**
 * `rollOfSender`, once it names `messageId` - or what it names after `ms` (E08+E28 C4a,
 * 03.10.2026). A Work's progress names its roll, and leaves the roller's browser after the
 * roll's report; but the report's run awaits before it keeps the row, and the progress was
 * judged first in 40-flow's player Work (measured 03.10: the row's facts empty, so its Reroll
 * replayed nothing). Asked only for a progress that names a roll; a report the GM refused
 * keeps no row, and the wait ends at `ms`.
 */
export async function rollOfSenderNaming(userId, actionKey, messageId, ms = 1500) {
    const end = Date.now() + ms;
    let found = rollOfSender(userId, actionKey);
    while (messageId && found?.messageId !== messageId && Date.now() < end) {
        await new Promise(resolve => setTimeout(resolve, 50));
        found = rollOfSender(userId, actionKey);
    }
    return found;
}

/**
 * THE CARD A ROLL WAS REPORTED ON (E08+E28 C5, 03.10.2026; audit S02-21; the plan's 2.7).
 * `report()` posts the action's card from the roller's browser after the roll, and its
 * outcome paragraphs are built there from facts a replay changes, so the GM making a
 * Reroll cannot rebuild them: it marks the card instead (reroll.mjs `markReplacedCard`).
 * The roller names the card in its roll's bookmark; it is kept only when it is a card of
 * the module's, not a roll, written by the roll's own sender, no older than the roll and
 * under a minute old - as `guardRollAuthor` bounds the roll's own message. A card the GM
 * has not seen yet is waited for (secret.mjs `messageArrives`). Null otherwise.
 */
const REPORT_CARD_MS = 60_000;

async function reportCardOf(id, roll, by) {
    if (typeof id !== "string" || !id || !by?.id) return null;
    const { messageArrives, cardWriter } = await import("./secret.mjs");
    const card = game.messages.get(id) ?? await messageArrives(id);
    if (!card || card.id === roll.id || !card.getFlag?.(MODULE_ID, MESSAGE_FLAG) || isClaimedRoll(card)) return null;
    // Its writer: in an incident the GM posts the roller's card for them (E08+E28 fix r2-H5).
    if (cardWriter(card)?.id !== by.id) return null;
    const at = card.timestamp ?? 0;
    return at >= (roll.timestamp ?? 0) && Date.now() - at <= REPORT_CARD_MS ? card.id : null;
}

/**
 * The run of `roll.bookmark`, and a GM's own roll's (E08+E28 C2). The guards tied the
 * message to the sender and the character to them. The same roll again patches its
 * row - the action's claims, which grow as it goes - and keeps its facts and the action,
 * trait and experiences it was first told (fix r1-G1); another
 * roll starts the row afresh, unless it is older than the one kept. The roll's card,
 * once named, is kept beside them (`reportCardOf`, C5).
 */
export async function keepGmBookmark({ actorId, messageId, actionKey = null, trait = null, experiences = [], context = null,
    reportMessageId = null } = {}, by = null) {
    if (!game.user?.isGM) return null;
    const actor = game.actors.get(actorId ?? "");
    const message = game.messages.get(messageId ?? "");
    if (!actor || !message) return null;
    await rerollBookmarkStore.whenHydrated();
    const key = typeof actionKey === "string" && /^[a-zA-Z]{1,32}$/.test(actionKey) ? actionKey : null;
    const told = {
        actionKey: key,
        trait: Object.hasOwn(TRAITS, trait ?? "") ? trait : null,
        experiences: (Array.isArray(experiences) ? experiences : []).filter(e => typeof e === "string" && e.length <= 128).slice(0, 12),
        claims: rollClaims(key, context)
    };
    const card = await reportCardOf(reportMessageId, message, by);
    if (card) told.reportMessageId = card;
    const held = rerollBookmarkStore.get(actor.id);
    if (held?.messageId === message.id) {
        // The same roll again: its claims, and its card once named. The action is the first
        // one told (fix r1-G1; the review's S2): it chooses which replay reads the GM's facts,
        // and a packet sent again for the same message within `guardRollAuthor`'s minute
        // could rename it. Palm's Take is told as "steal" and renamed "palm" by its context -
        // one replay (reroll.mjs `settleSteal`), and no claims under either. A Frisk's hand
        // ("rummage") and its force ("frisk") keep their keys: no context renames them, as
        // each names a replay of its own (`settleRummage`, `settleForce`; the review's
        // er-cor-5). Every other action names its key as it throws (`rollTrait`), so the
        // first is the action's.
        const again = { claims: rollClaims(held.actionKey ?? null, context), ...(card ? { reportMessageId: card } : {}) };
        const facts = takeFactsAwaiting(message.id, actor.id, held);
        if (Object.keys(facts).length) again.facts = { ...(held.facts ?? {}), ...facts };
        return rerollBookmarkStore.patch(actor.id, again);
    }
    const kept = held ? game.messages.get(held.messageId ?? "") : null;
    if (kept && (kept.timestamp ?? 0) > (message.timestamp ?? 0)) {
        takeFactsAwaiting(message.id, actor.id, null);
        return null;
    }
    const { dualityOfRoll } = await import("./reroll.mjs");
    const { total, withFear, isCritical } = dualityOfRoll(message.rolls?.[0]);
    // Every field, so a new roll leaves nothing of the last one behind - and the facts the GM
    // wrote for this roll before its row was kept (`noteFactOfRoll`), taken with no await
    // between them and the patch.
    const row = { messageId: message.id, reportMessageId: null, ...told, total, withFear, isCritical,
        first: foundry.utils.deepClone(message.toObject().rolls ?? []), stands: null,
        room: roomOfActor(actor) ?? null, at: Date.now(), by: by?.id ?? null };
    return rerollBookmarkStore.patch(actor.id, { ...row, facts: takeFactsAwaiting(message.id, actor.id, row) });
}

/**
 * Write what a GM did for a roll onto that roll's row (E08+E28 C2): `messageId` is the
 * row's as the writer started (`rollOfNow`); a row that has moved on since - or none -
 * takes nothing. Merged into the row's facts. A GM's only.
 */
export async function noteRollFact(actorId, messageId, facts) {
    if (!game.user?.isGM || !actorId || !messageId || !facts || !Object.keys(facts).length) return false;
    const held = rerollBookmarkStore.get(actorId);
    if (held?.messageId !== messageId) return false;
    await rerollBookmarkStore.patch(actorId, { facts: { ...(held.facts ?? {}), ...facts } });
    return true;
}

/*
 * A FACT FOR THE ROLL ITS PACKET NAMES (E08+E28 fix r1-G1, 04.10.2026; the round-1 review's B1
 * and M3 = S2). A player's Sabotage and a player's trace are carried out by the GM's handler
 * (bridge-runs-records.mjs `handleSabotage`, `handleRemnant`), and that handler wrote the fact on the row
 * it found as the packet arrived: the sender's newest Sabotage row, or the character's newest
 * row of any kind. Both were wrong. `roll.bookmark` leaves the roller's browser first, but its
 * run - three guards, the store's hydration, the card's lookup, an import - ended after the
 * Sabotage's handler had read the store (the review's 97a/97b: 5 of 5 runs at f941051, and 2 of
 * 3 of its 97 at d20fadb, no `targetProjectId` on the row, so the Reroll into a miss left the
 * project frozen), and a trace
 * of a roll that keeps no row (a discarded item's) was written on whatever the character had
 * rolled before (99c, probe B: the Search's Reroll then lifted the discard's trace).
 *
 * So the packet names its roll's message (`rollId`, the roller's `rollInHand`; from C14 the
 * record's id) and the fact goes on the row of that message only, and only when the row's `by`
 * is the packet's sender, its character the one the packet names (when it names one) and its
 * action one of `actions` - the replay that reads the fact. A row not kept yet is waited for: the
 * fact is parked under the message's id and merged by `keepGmBookmark` as it creates the row
 * (`takeFactsAwaiting`), in the same synchronous step as the store's patch, which writes its
 * section before it awaits (gm-store.mjs `patch`) - so no reading in between can miss both. A
 * fact still parked after the Reroll window (`TIMING.rerollWindowMinutes`), or whose row turned
 * out to be another's, another action's or older than the row kept, is dropped and logged on
 * this GM. The map is this client's, in memory: the primary GM judges every player's packet
 * (gm-bridge.mjs, the `isPrimaryGm` gate), `roll.bookmark` included; a fact parked as the primary
 * leaves, or reloads, is lost with it - its Reroll then takes back what the row holds, as before.
 */
const factsAwaitingRow = new Map();

function dropStaleFacts(now = Date.now()) {
    for (const [messageId, waiting] of factsAwaitingRow) {
        const left = waiting.filter(w => now - w.at <= TIMING.rerollWindowMinutes * 60_000);
        if (left.length === waiting.length) continue;
        log(`Dropped ${waiting.length - left.length} fact(s) for roll ${messageId}: its row never came within the Reroll window.`);
        if (left.length) factsAwaitingRow.set(messageId, left);
        else factsAwaitingRow.delete(messageId);
    }
}

/** Does a row of `actorId` take a fact asked for `by` this sender, for these actions? */
function rowTakes(row, actorId, wanted) {
    return row?.by === wanted.by && (!wanted.actorId || wanted.actorId === actorId) && wanted.actions.includes(row.actionKey);
}

/**
 * The facts parked for `messageId`, as its row is created or patched: those the row takes,
 * merged; the rest dropped and logged - nothing else will ever name that message's row.
 */
function takeFactsAwaiting(messageId, actorId, row) {
    const waiting = factsAwaitingRow.get(messageId);
    if (!waiting) return {};
    factsAwaitingRow.delete(messageId);
    const taken = {};
    for (const w of waiting) {
        if (rowTakes(row, actorId, w)) Object.assign(taken, w.facts);
        else log(`Dropped a fact for roll ${messageId}: its row was not kept as ${w.by}'s ${w.actions.join("/")} roll.`, Object.keys(w.facts));
    }
    return taken;
}

/**
 * Write `facts` on the row of the roll `messageId` names, or park them until `keepGmBookmark`
 * keeps it (above). `by` is the user Foundry names as the packet's sender, `actorId` the
 * character the packet names (null when it names none), `actions` the row's actions that take
 * the fact. True when written or parked; false for a row that does not take it. A GM's only.
 */
export async function noteFactOfRoll(messageId, { by, actorId = null, actions }, facts) {
    if (!game.user?.isGM || typeof messageId !== "string" || !messageId || !by || !facts || !Object.keys(facts).length) return false;
    await rerollBookmarkStore.whenHydrated();
    dropStaleFacts();
    const wanted = { by, actorId, actions, facts, at: Date.now() };
    const [rowActor, row] = Object.entries(rerollBookmarkStore.entries()).find(([, r]) => r?.messageId === messageId) ?? [];
    if (!row) {
        factsAwaitingRow.set(messageId, [...(factsAwaitingRow.get(messageId) ?? []), wanted]);
        return true;
    }
    if (!rowTakes(row, rowActor, wanted)) {
        log(`Refused a fact for roll ${messageId}: its row is not ${by}'s ${actions.join("/")} roll.`, Object.keys(facts));
        return false;
    }
    await rerollBookmarkStore.patch(rowActor, { facts: { ...(row.facts ?? {}), ...facts } });
    return true;
}

/**
 * The facts the GMs hold for the roll `messageId` names, read the way `noteFactOfRoll` writes
 * them (E09 C5, 08.10.2026): the row's, when that row is `by`'s roll of `actorId` for one of
 * `actions`; while no row of that message is kept, the facts parked for it under the same sender,
 * character and action, merged - a Sabotage's packet can come before its roll's `roll.bookmark`
 * has kept the row (above), and so can the trace that follows it. Null when neither holds any:
 * a row that is another's, another character's or another action's answers nothing. Read in one
 * synchronous step after the store's hydration. A GM's only.
 */
export async function factsOfRoll(messageId, { by, actorId = null, actions }) {
    if (!game.user?.isGM || typeof messageId !== "string" || !messageId || !by) return null;
    await rerollBookmarkStore.whenHydrated();
    const wanted = { by, actorId, actions };
    const [rowActor, row] = Object.entries(rerollBookmarkStore.entries()).find(([, r]) => r?.messageId === messageId) ?? [];
    if (row) return rowTakes(row, rowActor, wanted) ? { ...(row.facts ?? {}) } : null;
    const parked = (factsAwaitingRow.get(messageId) ?? []).filter(w => w.by === by
        && (!actorId || w.actorId === actorId) && w.actions.some(action => actions.includes(action)));
    return parked.length ? Object.assign({}, ...parked.map(w => w.facts)) : null;
}

/*
 * AND THE RESOLVERS' FACTS THE SAME WAY (E08+E28 fix r1-G2, 04.10.2026; the round-1 review's B1,
 * its rest). A crisis action, an Analyze, a clean-up, an Observe and a Search's plant are carried
 * out by a resolver on the GM, which read the character's row as it started (`rollOfNow`) - the
 * same read as the Sabotage's, and as early: a Strike's packet leaves right after its roll's
 * `roll.bookmark`. A row not kept yet took no fact, and a crisis row without one was settled as
 * "the dice are the whole result" while the first throw's damage, trace and turn stood. Each
 * packet names its roll now (`rollId`, the roller's `rollInHand`), and the resolver writes on that
 * roll's row for the sender (`by`, the user Foundry names; this GM for its own) through
 * `noteFactOfRoll`. A resolver run with no roll named - a crisis action taken without dice, a
 * GM's macro - writes none. A Reroll's replay (`undo`) is a GM's alone (the bridge's
 * `guardUndoIsTheGms`) and runs on the row the Reroll is being made on, so it keeps writing on
 * the row it read as it started.
 */

/** Where a resolver's fact goes: `{ actorId, messageId }` for a replay, `{ actorId, rollId, by, actions }` for a first throw. */
export function rollOfFact({ undo = false, rollId = null, by = null, actorId = null, actions = [] } = {}) {
    if (undo) return { actorId, messageId: rollOfNow(actorId) };
    return { actorId, rollId, by: by ?? game.user?.id ?? null, actions };
}

/** Write `facts` where `rollOfFact` said: true when written, or parked for its row. */
export function noteFactOn(roll, facts) {
    if (!roll) return false;
    if ("messageId" in roll) return noteRollFact(roll.actorId, roll.messageId, facts);
    return noteFactOfRoll(roll.rollId, { by: roll.by, actorId: roll.actorId, actions: roll.actions }, facts);
}

/**
 * THE OLD BOOKMARKS OUT OF WORLD DATA (E05 C7; audit S02-01) - the `dropRollBookmarks`
 * clause. Once, on the primary. Nothing is lifted: a bookmark is the newest roll, and a
 * Reroll does not reach across an update - since E08+E28 C4a it reads the GMs' row of the
 * roll (`keepGmBookmark`), which a roll made before it never had. Every actor's
 * `lastAction` flag is deleted in one write (`forcedDeletion()`, `unsetFlag` in a
 * Foundry without it) and read back; one still there throws, so the world is not
 * stamped and the next load tries again.
 * Idempotent: a world already through it holds none.
 *
 * AND EVERY TOKEN'S OWN ACTOR DATA (E05's fix round, S1-m4, 27.09.2026). 1.2.63 wrote the
 * flag on whatever actor rolled, and a sheet opened from an unlinked token is that
 * token's synthetic actor, whose flags are kept in the token's delta on its scene -
 * world data too. Those are deleted on the delta's path through the token, and read
 * back from the token's source. Whether any table rolled from an unlinked character
 * token is not known; the suite plants one (the tier-2 bookmarks' drop), in a harness
 * whose tokens keep their delta as plain data - how a real Foundry applies a deletion
 * on that path is not measured here.
 *
 * @returns {Promise<null|{notPrimary: true}|{dropped: number}>}
 */
export async function dropRollBookmarks() {
    if (!isPrimaryGm()) return { notPrimary: true };
    const held = flags => Object.hasOwn(flags?.[MODULE_ID] ?? {}, FLAGS.lastAction);
    const holding = () => [
        ...(game.actors?.contents ?? []).filter(actor => held(actor.flags)),
        ...(game.scenes?.contents ?? []).flatMap(scene => scene.tokens?.contents ?? [])
            .filter(token => held(token.toObject()?.delta?.flags))
    ];
    const found = holding();
    if (!found.length) return null;
    const deletion = forcedDeletion();
    for (const doc of found) {
        const onToken = doc.documentName === "Token";
        const path = `${onToken ? "delta." : ""}flags.${MODULE_ID}`;
        if (deletion) await doc.update({ [`${path}.${FLAGS.lastAction}`]: deletion });
        // A token's synthetic actor writes its flags into the token's delta.
        else await (onToken ? doc.actor : doc)?.unsetFlag(MODULE_ID, FLAGS.lastAction);
    }
    const left = holding().length;
    if (left) {
        warn(`Reroll bookmarks: ${left} actor(s) or token(s) still carry one in world data after the deletion.`);
        throw new Error(`${left} Reroll bookmark(s) stayed in world data; the next load tries again`);
    }
    log(`Took ${found.length} Reroll bookmark(s) out of world data.`);
    return { dropped: found.length };
}

/**
 * Read Hope / Despair / critical off a finished roll.
 *
 * What `rollTrait` hands back is the roll *config*, not the Roll object, and the
 * config does not carry `withHope`/`withFear` - it records the same fact as
 * `result.duality`: 1 for Hope, -1 for Despair, 0 for a tie, which is a
 * critical. Reading the getters instead silently produced `false` for both, so
 * "with Despair" consequences - the sabotage reveal, the indirect-murder bonus -
 * could never fire. The dice are compared as a fallback for any other shape.
 */
export function dualityOf(roll) {
    const isCritical = Boolean(roll?.isCritical);
    const duality = roll?.result?.duality;

    if (typeof duality === "number") {
        return { isCritical: isCritical || duality === 0, withHope: duality === 1, withFear: duality === -1 };
    }

    const hope = roll?.hope?.value;
    const fear = roll?.fear?.value;
    if (typeof hope === "number" && typeof fear === "number") {
        return { isCritical: isCritical || hope === fear, withHope: hope > fear, withFear: hope < fear };
    }

    return {
        isCritical,
        withHope: Boolean(roll?.withHope),
        withFear: Boolean(roll?.withFear)
    };
}

/** Apply the Hope/Sanity/Fear changes the roll produced, plus any costs. */
async function commitResources(result) {
    // A roll the GM drew was settled on the GM's client, costs and all (roll-draw.mjs
    // `drawOnGm`, E08+E28 C12a): committing it here as well paid its Hope twice.
    if (result?.[DRAWN_ROLL]) return;
    const updates = result?.resourceUpdates;
    if (!updates?.updateResources) return;

    try {
        const costs = (result.costs ?? [])
            .filter(c => c.enabled)
            .map(c => ({ ...c, value: -c.value }));
        if (costs.length) updates.addResources(costs);
        await updates.updateResources();
    } catch (err) {
        error("Could not apply the roll's resource changes", err);
    }
}

/**
 * Give the action back and stop.
 *
 * Used by the actions that must pay before rolling - an indirect murder or a
 * watched sabotage throws a concealment roll first, and every roll commits its
 * Hope, Sanity and Despair. Charging afterwards let a player collect those and
 * then cancel; charging first means an honest cancel has to be refunded.
 *
 * AND THE ONE-ROLL ACTIONS PAY FIRST TOO (ACT-07, 17.09).
 *
 * Search, Observe, Analyze, Listen and a Dynamic action used to charge after
 * the dice and ignore the answer. The sheet disables only
 * the tile that was clicked and none of these windows is modal, so a student
 * with one action could open two, roll both, and get both results for one
 * action - and with more windows, keep every roll's Hope while the spend was
 * refused. Charging before the roll makes the second window stop at "not
 * enough actions", and a closed roll window gets its action back here -
 * except Analyze's, which pays a price chain and gives back the step that
 * paid through `refundPrice` (T-1).
 *
 * `paid` is the receipt `spendAction` handed back - null for an action that
 * cost nothing - so a Burst that paid comes back as a Burst (trap 98). A
 * window closed AFTER one of the action's own rolls has landed does not come
 * here: that is `spentAfterRoll`, below, and the action stays spent (ROLL-05).
 */
export async function abort(actor, paid) {
    if (paid) await refundAction(actor, paid.amount, paid);
    return null;
}

/**
 * A later roll of the same action closed unanswered, after an earlier roll of
 * it already landed. The action stays spent (ROLL-05): the first roll paid
 * out its Hope, its Despair to the Monokuma, and refunding here made a free
 * generator of "throw the supporting roll, cancel the main one, repeat".
 * The first dialog of an action is the one a player may still back out of.
 */
export async function spentAfterRoll(actor, def) {
    ui.notifications.warn(game.i18n.format("DRPG.Action.spentAfterRoll", { action: def?.label ?? "" }));
    return null;
}

/** Common guard: enough actions left? */
export function canAfford(actor, cost) {
    // `canPayFor`, not `actionsLeft`: a banked Burst pays for this (trap 96).
    if (canPayFor(actor, cost)) return true;
    ui.notifications.warn(plural("DRPG.Actions.notEnough", {
        actor: actor.name, left: actionsLeft(actor), needed: cost
    }, "left"));
    return false;
}

/**
 * Who hears what happened in a room: the GMs, the actor's own player, and the
 * players of everyone standing in the same room. "You hear only your room"
 * is the module's rule for voice and dice; a sabotage caught in the act is a
 * scene in one room too (D6). Every player who owns one of them (`ownerIdsOf`, E18 fix e1-G7).
 */
export function roomAudience(actor) {
    const ids = new Set(gmIds());
    for (const a of [actor, ...othersInRoom(actor)]) {
        for (const id of ownerIdsOf(a)) ids.add(id);
    }
    return [...ids];
}

/**
 * The refusal button every GM ruling card ends with, and the receipt that makes
 * the refund honest (ACT-14, 20.09).
 *
 * THE DATA SHAPE IS THE FIX. The refund on the far side reads `data.paid` to find
 * which step of a price chain to hand back, and two of the three cards that carry
 * this button were hand-written with `{ by, cost }` and no receipt at all - so the
 * far side fell into its legacy branch and refunded ONE ACTION, whatever had
 * actually been paid. A Burst spent on the action came back as an ordinary action,
 * which is a downgrade nobody chose, and a Hope or a Sanity mark came back as an
 * action, which is worse.
 *
 * `"none"` RATHER THAN AN EMPTY STRING, and that is the other half. An absent
 * attribute reads as `undefined` on the far side and means "a card posted before
 * this release"; an empty string was what a FREE action produced, and the two were
 * indistinguishable - so a card for an action that cost nothing refunded an action
 * that was never spent. `options.free` reaches this through a free Search's
 * "something specific" card and through `askForHint`, so that is not a
 * hypothetical.
 *
 * `paid` KEEPS THE NAME the 1.2.43 cards gave it (ROLL-13), because those cards
 * are still in live chat logs with "grant" or "action" written there, and the far
 * side reads a "grant" off one of them as a Burst. A card written here names the
 * chain STEP instead - "action", "hope" or "stress" - and says in `grant` whether
 * a Burst paid for it.
 */
export function declineAction(actor, receipt = null) {
    return {
        action: "decline",
        label: game.i18n.localize("DRPG.Bridge.refuseAttempt"),
        data: {
            by: actor.id,
            paid: receipt ? (receipt.pay ?? "action") : "none",
            amount: String(receipt?.amount ?? 0),
            // A Burst comes back as a Burst, which is the one thing the far side
            // cannot work out for itself.
            grant: String(Boolean(receipt?.grant)),
            // The words the far side answers a free card with - this button's own
            // (`ruleDecline`, E09 fix r2-G7; "refused" since E16 C1, when the
            // button stopped reading "Nothing was there").
            words: "refused"
        }
    };
}

/**
 * "NOTHING WAS THERE" IS A SEARCH'S RESULT, AND "NO HELP" A HINT'S (E16 part 2 C1, 26.10.2026;
 * audit S02-16). The "something specific" card and the hint card offered one way to say there
 * was nothing, and it was the refusal (`declineAction`): it handed the action back and told the
 * thread the GM "turned the attempt down", so a specific Search that found nothing cost nothing
 * but the room's token, and a hint the GM had no help for was free. The split ACT-17 made for
 * Observe (`missAction`), made here: this button keeps the price and says the GM's ruling in its
 * own words (messenger-app.mjs `ruleSearchMiss`); "Refuse the attempt" beside it still gives the
 * price back. `words` picks between the two sentences and nothing else - the card is the
 * player's to rewrite, and either sentence costs nothing more than the other.
 */
export function ruledMissAction(actor, words = "there") {
    return {
        action: "searchMiss",
        label: game.i18n.localize(words === "help" ? "DRPG.Bridge.noHelp" : "DRPG.Bridge.nothingThere"),
        data: { by: actor.id, words }
    };
}

/**
 * The Observe card's third answer, which is not a refusal at all (ACT-17, 20.09).
 *
 * "Nothing was there" IS THE RESULT OF AN OBSERVE, not a refusal to rule on one.
 * The scored road charges `OBSERVE_FAIL_STRESS` for exactly this outcome - the
 * tile's own briefing prints the figure before the roll - and the GM-ruled road
 * sent the generic `decline`, which REFUNDED the action and charged nothing. So
 * the one branch where a human decides there is nothing to find was the branch
 * where looking cost nothing at all, and a player who asked the GM rather than
 * rolling against a table was better off for it.
 */
export function missAction(actor) {
    return {
        action: "observeMiss",
        label: game.i18n.localize("DRPG.Bridge.nothingThere"),
        data: { by: actor.id }
    };
}

/**
 * The two buttons every ruling gets when there is nothing mechanical to apply.
 *
 * "Reply" posts the GM's sentence into the thread the question arrived in;
 * "No help" is an answer, and keeps the price (`ruledMissAction`, E16 C1);
 * "Refuse the attempt" hands the price back, because a question that is never
 * answered has not been paid for. All three are handled in `runCallAction`.
 *
 * THE STEP TRAVELS, AND THE FAR SIDE PRICES IT (T-1). This card is authored on
 * the PLAYER's client - `callGm` posts it into their own thread - so anything
 * written here can be rewritten there before a GM presses it. `data-cost` used to
 * be read back verbatim and handed to `refundAction`, which would have bought five
 * Sanity of healing from any GM pressing "There is nothing". The far side takes
 * the amount from `PRICE_CHAINS` by the step's name instead, and a name the table
 * does not know buys nothing.
 */
export function gmRulingActions(actor, receipt = null) {
    return [
        {
            action: "reply",
            label: game.i18n.localize("DRPG.Bridge.reply"),
            data: { by: actor.id }
        },
        ruledMissAction(actor, "help"),
        declineAction(actor, receipt)
    ];
}
