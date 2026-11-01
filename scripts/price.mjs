/**
 * Danganronpa RPG - the price chains, and the one place they are paid.
 * ---------------------------------------------------------------------------
 * T-1 (Dawid, 17.09) priced three things as a CHAIN rather than as one cost: an
 * Objection, Analyze inside a Class Trial, and a Tamper attempt. You pay the
 * first step you can still pay - an action, then Hope, then a Sanity mark - and
 * when you can pay none of them you cannot do it.
 *
 * ONE TABLE, ONE PAYER, ONE RECEIPT. The table is `PRICE_CHAINS` in config.mjs.
 * This file is the payer, and everything it charges comes back as a receipt:
 * which chain, which step, how much, and whether a banked Burst is what paid.
 * That last field is why the receipt exists at all - a critical Tamper hands back
 * the step that actually paid instead of "a Sanity mark" the attempt may never
 * have spent, and a Burst comes back as a Burst rather than as an action out of
 * thin air.
 *
 * THE QUOTE IS SYNCHRONOUS, and that is a requirement rather than a
 * convenience: `briefingFacts` and `actionButton` are both synchronous, and R8
 * drives the briefing block directly. So every dependency here is a static
 * import of a leaf - and the three character flags are read straight off the
 * actor the way `resetActionsFor` does, so this file never imports chapter.mjs,
 * monocub.mjs or cleanup.mjs and closes no cycle.
 *
 * `blocked` IS A SENTENCE, NEVER A KEY. Callers print it into a tooltip or a
 * warning without looking at it, and R8 fails on a rendered "DRPG.".
 *
 * TWO KINDS OF REFUSAL, because the difference decides what the interface does.
 * `blockedKind: "noPrice"` is a floor - the dead, a Monocub, a Monokuma, or a key
 * with no chain - and the control is greyed with nothing offered instead.
 * `blockedKind: "nothingLeft"` is an empty pocket, and that is the one an
 * Objection answers with the free Present that does not take the floor.
 */

import { MODULE_ID, FLAGS, PRICE_CHAINS, STARTING } from "./config.mjs";
import { getClock, isDeadForGm } from "./settings.mjs";
import { canPayFor, freeActionsLeft, actionsLeft, spendAction, refundAction } from "./actions.mjs";
import { resourceValue, resourceMax } from "./character.mjs";
import { trustedWrite, HOPE_REFUND } from "./resource-guard.mjs";
import { overflowBlocksHope } from "./overflow.mjs";
import { plural, whisperToOwner, debug } from "./utils.mjs";

/** The chain for one priced thing, or null when it has none. */
export function chainFor(key) {
    return PRICE_CHAINS[key] ?? null;
}

/**
 * Which steps of a chain are on offer right now.
 *
 * `stepsBeyondFirst` names the phase the later steps live in: Analyze pays its
 * action anywhere, and its Hope or its Sanity only inside a Class Trial (T-1).
 * Outside that phase the chain is one step long, which is exactly how Analyze
 * behaved before this file existed.
 *
 * `skip` drops a step the caller has already settled - the killer in their own
 * Stage 6, whose clean-up is free of the action economy for the rest of that time
 * of day (D3) and who therefore starts the chain at its Sanity step.
 */
function stepsNow(chain, skip = []) {
    const offered = stepsOffered(chain);
    return skip.length ? offered.filter(step => !skip.includes(step.pay)) : offered;
}

/* The chain's steps this phase offers, before a caller's `skip` (E66 C2): the quote says which of them it skipped and
   whether the phase cut the chain to its first step, so its sentence can say so (S09-40). */
function stepsOffered(chain) {
    if (!chain?.steps?.length) return [];
    const gate = chain.stepsBeyondFirst;
    let phase = null;
    try {
        phase = getClock()?.phase ?? null;
    } catch {
        // Before `ready`. One step is the safe answer: it is what each of these
        // actions cost before the chains existed.
        phase = null;
    }
    return !gate || phase === gate ? chain.steps : chain.steps.slice(0, 1);
}

/** How much room is left under a reverse track's maximum. */
function roomLeft(actor, key) {
    return resourceMax(actor, key) - resourceValue(actor, key);
}

/** Can this character pay this one step? */
function canPayStep(actor, step) {
    if (!step) return false;
    // A banked Burst pays the action step whatever the amount, which is what
    // `canPayFor` already knows (trap 96).
    if (step.pay === "action") return canPayFor(actor, step.amount);
    if (step.pay === "hope") return resourceValue(actor, "hope") >= step.amount;
    // Sanity is a REVERSE track: paying ADDS marks, so what matters is the room
    // left under the maximum. The last mark is a Breakdown and is still payable -
    // Dawid's rule is that the window warns, not that it refuses.
    if (step.pay === "stress") return roomLeft(actor, "stress") >= step.amount;
    return false;
}

/**
 * Nobody who is not playing pays these prices.
 *
 * The Monokuma and Monocub flags are read off the actor directly and death is asked
 * of settings.mjs (E05 C9), so this file stays importable from everywhere. It runs
 * on the payer's browser and the GM's, so it asks what that browser may know (rules
 * B and C). A Monocub IS deceased and DOES act - but not
 * in a trial and not on the evidence, so unlike the action economy this asks both
 * flags for the same answer.
 */
function cannotPayAtAll(actor) {
    if (!actor || actor.type !== "character") return true;
    if (actor.getFlag(MODULE_ID, FLAGS.monokuma)) return true;
    if (actor.getFlag(MODULE_ID, FLAGS.monocub)) return true;
    return isDeadForGm(actor);
}

/**
 * What this would cost this character right now.
 *
 * @param {Actor} actor
 * @param {string} key                 A key of `PRICE_CHAINS`.
 * @param {object} [options]
 * @param {string[]} [options.skip]    Steps the caller has already settled.
 * `skipped` (E66 C2, 01.11.2026; S09-40) names the steps of the chain this phase offered that `skip` took out - a
 * cleaner's Tamper in their own Stage 6 starts at Sanity with actions in hand, and its line said "No actions left".
 *
 * @returns {{
 *   key: string, pay: string|null, amount: number, grant: boolean,
 *   left: number, held: number, lastSanity: boolean, skipped: string[],
 *   blocked: string|null, blockedKind: "noPrice"|"nothingLeft"|null
 * }}
 */
export function quotePrice(actor, key, { skip = [] } = {}) {
    const base = {
        key,
        pay: null,
        amount: 0,
        grant: false,
        left: actor ? actionsLeft(actor) : 0,
        held: actor ? resourceValue(actor, "hope") : 0,
        lastSanity: false,
        skipped: [],
        blocked: null,
        blockedKind: null
    };

    const chain = chainFor(key);
    if (!chain || cannotPayAtAll(actor)) {
        return {
            ...base,
            blocked: game.i18n.localize("DRPG.Price.noPrice"),
            blockedKind: "noPrice"
        };
    }

    const offered = stepsOffered(chain);
    base.skipped = offered.filter(entry => skip.includes(entry.pay)).map(entry => entry.pay);
    const step = stepsNow(chain, skip).find(entry => canPayStep(actor, entry)) ?? null;
    if (!step) {
        /* Outside the phase its later steps live in, a gated chain is one step long (`stepsBeyondFirst`): Analyze
           outside the Class Trial is paid with an action or not at all, so its refusal names no Hope and no Sanity
           (E66 C2; S09-40) - `nothingLeft.<key>OneStep` where the file has one. A chain whose action step the caller
           skipped (a cleaner's Tamper in their own Stage 6, cleanup.mjs `tamperPriceSkip`) has no action to run out of: its
           refusal names what is left to pay with, `nothingLeft.<key>SkippedAction` (E66 fix r1 F3; STATUS Open 11). */
        const oneStep = offered.length < chain.steps.length && game.i18n.has(`DRPG.Price.nothingLeft.${key}OneStep`);
        const skippedAction = base.skipped.includes("action") && game.i18n.has(`DRPG.Price.nothingLeft.${key}SkippedAction`);
        const line = skippedAction ? `DRPG.Price.nothingLeft.${key}SkippedAction`
            : oneStep ? `DRPG.Price.nothingLeft.${key}OneStep` : `DRPG.Price.nothingLeft.${key}`;
        return {
            ...base,
            blocked: game.i18n.has(line)
                ? game.i18n.localize(line)
                : game.i18n.localize("DRPG.Price.noPrice"),
            blockedKind: "nothingLeft"
        };
    }

    return {
        ...base,
        pay: step.pay,
        amount: step.amount,
        grant: step.pay === "action" && freeActionsLeft(actor) > 0,
        lastSanity: step.pay === "stress" && roomLeft(actor, "stress") <= step.amount
    };
}

/**
 * Charge the chain and hand back the receipt.
 *
 * RE-QUOTED HERE, never trusted from the window that showed the price. Between a
 * quote and this call a player can spend the action on another tile, a Monokuma
 * can take the Hope, and a concealment roll can take the Sanity the price was
 * going to use - so what is charged is whatever the chain can pay at the moment
 * of paying. Two windows open at once therefore pay two different steps rather
 * than the same step twice. `null` means it could pay nothing.
 *
 * `quiet` is for the one caller that charges somebody else's character on the
 * primary GM's client (the Objection): the pip sound and any warning belong on
 * the objector's own screen, which gets them with the whisper.
 *
 * @returns {Promise<{key: string, pay: string, amount: number, grant: boolean}|null>}
 */
export async function payPrice(actor, key, { skip = [], quiet = false } = {}) {
    const quote = quotePrice(actor, key, { skip });
    if (quote.blocked) {
        if (!quiet) ui.notifications.warn(quote.blocked);
        return null;
    }

    if (quote.pay === "action") {
        const receipt = await spendAction(actor, quote.amount, { quiet });
        if (!receipt) return null;
        return { key, pay: "action", amount: quote.amount, grant: Boolean(receipt.grant) };
    }

    /* The Hope, the marks and the Sanity maximum as the GMs hold them on a GM's client - the Objection's, charged on the
       primary (sheet-audit.mjs `meansWrite`, E29 fix r2-H24): a console's Hope or maximum, not put back yet, paid
       there. A player's browser reads its sheet, as before. */
    const { meansWrite } = await import("./sheet-audit.mjs");
    const pay = quote.pay === "hope" ? "hope" : "stress";
    const paid = await meansWrite(actor, async (held, maxOf) => {
        const room = pay === "hope" ? held.hope : (maxOf("stress") ?? 0) - held.stress;
        if (room < quote.amount) return false;
        const next = pay === "hope" ? held.hope - quote.amount : held.stress + quote.amount;
        await trustedWrite(actor, { [`system.resources.${pay}.value`]: next }, { reason: "price" });
        return true;
    });
    return paid ? { key, pay, amount: quote.amount, grant: false } : null;
}

/**
 * Give back exactly what a receipt says was paid.
 *
 * A Burst comes back as a Burst - the receipt already carries `.grant`, which is
 * the field `refundAction` reads. Hope comes back marked as a refund so the
 * Despair darkening lets it through, and when the darkening swallows it anyway the
 * character is told rather than left believing they were repaid. A Sanity mark is
 * lifted, not healed: it is the same mark going away.
 *
 * SAID ONLY WHEN IT LANDED (E66 C2, 01.11.2026; S09-40): an action comes back as `refundAction` answers, and until
 * E66 this whispered "You get ... back" and answered true whatever it answered, so cleanup's give-back (`paidBack`)
 * would record the step as returned and a refused Objection's line say it came back. Read in actions.mjs on this
 * tree: `refundAction` answers false only with no actor or an amount of 0 or less (a Burst's `grantFreeActions` the
 * same, and it is asked for 1), and both of those roads hand it the table's amount, 1 - so neither meets a false
 * today; tier 2's E66-T2 holds the answer on a receipt of 0. Hope answers whether it landed, as before; a Sanity mark
 * lifted always lands.
 *
 * WHAT THE ANSWER IS, EXACTLY (E66 fix r2, 01.11.2026; review correctness n2): whether the refund was written. False
 * with no actor or no receipt, where `refundAction` (or a Burst's `grantFreeActions`) answers false, and for Hope a
 * darkened hour held back. True, with the "you get it back" whisper, also where nothing could move: actions already at
 * their maximum (`refundAction` writes the cap again) and a Sanity mark at 0 (`Math.max(0, marks - amount)`), as Hope
 * already at its maximum counts as landed - there was nowhere for it to go, which is not the refund being eaten. Kept
 * so rather than answered false: the two callers that read the answer (cleanup.mjs `paidBack`, trial.mjs
 * `objectionRefusedLine`) would then say a step that cost nothing to give back "could not come back".
 *
 * `quiet`: true keeps the "you get it back" whisper for a caller that tells the refund itself; "all" keeps the
 * "could not come back" one as well, for a caller that words the loss itself (E51 fix round FG7, 31.10.2026; review
 * correctness F3: a refused Objection whose Hope a darkening held back was told the loss twice, here and in trial.mjs
 * `objectionRefusedLine`; tier 2's E51-T18 counts the two).
 *
 * @returns {Promise<boolean>} whether the refund was written (see above: a refund with nowhere to go answers true).
 */
export async function refundPrice(actor, receipt, { quiet = false } = {}) {
    if (!actor || !receipt?.pay) return false;

    if (receipt.pay === "action") {
        const ok = await refundAction(actor, receipt.amount, receipt);
        if (ok && !quiet) await tellRefund(actor, receipt);
        return Boolean(ok);
    }

    if (receipt.pay === "hope") {
        // From the Hope the GMs hold on a GM's client (sheet-audit.mjs `meansWrite`, E29 fix r2-H24): a console's raised
        // Hope, not put back yet, was given back on top there. A player's browser reads its sheet, as before.
        const { meansWrite } = await import("./sheet-audit.mjs");
        const { held, max } = await meansWrite(actor, async ({ hope }, maxOf) => {
            const top = maxOf("hope") || STARTING.hopeMax;
            await trustedWrite(actor, { "system.resources.hope.value": Math.min(top, hope + receipt.amount) }, { reason: "refund" });
            return { held: hope, max: top };
        });
        // Already full counts as landed: there was nowhere for it to go, and that
        // is not the same as the refund being eaten.
        const landed = resourceValue(actor, "hope") > held || held >= max;
        if (!landed) {
            /*
             * SAID, NOT ASSUMED. A darkened hour holds Hope down (Z10), and
             * `HOPE_REFUND` is what lets a refund through it - but the setting can
             * be off, and then the refund silently does not arrive. A player who
             * was told they were repaid and was not is worse off than one who
             * knows to ask the GM.
             */
            if (overflowBlocksHope() && quiet !== "all") {
                await whisperToOwner(actor, `<p>${game.i18n.format("DRPG.Price.refundLost",
                    { what: plural("DRPG.Price.label.hope", { n: receipt.amount }) })}</p>`);
            }
            debug(`A Hope refund for ${actor.name} did not land.`);
            return false;
        }
        if (!quiet) await tellRefund(actor, receipt);
        return true;
    }

    const marks = resourceValue(actor, "stress");
    await trustedWrite(actor, {
        "system.resources.stress.value": Math.max(0, marks - receipt.amount)
    }, { reason: "refund" });
    if (!quiet) await tellRefund(actor, receipt);
    return true;
}

/** "You get 1 action back." - on the owner's own client. */
async function tellRefund(actor, receipt) {
    try {
        await whisperToOwner(actor, `<p>${game.i18n.format("DRPG.Price.refunded",
            { what: priceLabel(receipt) })}</p>`);
    } catch (err) {
        debug("Could not whisper a price refund", err);
    }
}

/**
 * The words for an amount: "1 action", "1 Hope", "1 Sanity". Takes a quote or a
 * receipt - they carry the same two fields, which is the point of the shape.
 */
export function priceLabel(quote) {
    if (!quote?.pay) return game.i18n.localize("DRPG.Price.label.free");
    return plural(`DRPG.Price.label.${quote.pay}`, { n: quote.amount });
}

/**
 * The sentence a window shows BEFORE paying: what this will cost, and what is
 * left. The Sanity step says which of the earlier steps ran out, because "no
 * actions left" and "no actions and no Hope left" are different situations and the
 * player is about to mark their Sanity over the difference - and, when the caller
 * skipped the action step (`quote.skipped`), that no action is needed, never "no
 * actions left" (E66 C2; S09-40).
 *
 * EVERY COUNT ITS OWN FAMILY (E66 C2, 01.11.2026; S18-36, E66-12): the cost and what
 * is held are two families joined with a space, each through `plural()`, so a Polish
 * page reads "Kosztuje 2 akcje. Masz 5 akcji." where the flat strings wrote "Kosztuje
 * 2 akcję. Masz 5.".
 */
export function priceLine(actor, quote) {
    if (quote?.blocked) return quote.blocked;
    if (!quote?.pay) return game.i18n.localize("DRPG.Price.will.free");

    if (quote.pay === "action") {
        if (quote.grant) return plural("DRPG.Price.will.burst", { n: quote.amount });
        const left = actor ? actionsLeft(actor) : quote.left;
        return `${plural("DRPG.Price.will.action", { n: quote.amount })} ${plural("DRPG.Price.will.actionsLeft", { left }, "left")}`;
    }

    if (quote.pay === "hope") {
        const held = actor ? resourceValue(actor, "hope") : quote.held;
        return `${plural("DRPG.Price.will.hope", { n: quote.amount })} ${plural("DRPG.Price.will.hopeHeld", { held }, "held")}`;
    }

    const afterHope = Boolean(chainFor(quote.key)?.steps?.some(step => step.pay === "hope"));
    const line = plural((quote.skipped ?? []).includes("action")
        ? "DRPG.Price.will.skippedAction"
        : afterHope
            ? "DRPG.Price.will.stressAfterHope"
            : "DRPG.Price.will.stressAfterAction", { n: quote.amount });
    // The last mark, said in the same breath as the price: this is the one step
    // that changes what the character is.
    return quote.lastSanity
        ? `${line} ${game.i18n.localize("DRPG.Price.will.breakdown")}`
        : line;
}

/** What a card says AFTER paying. */
export function paidLine(receipt) {
    if (!receipt?.pay) return game.i18n.localize("DRPG.Price.will.free");
    if (receipt.pay === "action" && receipt.grant) {
        return game.i18n.localize("DRPG.Price.paid.burst");
    }
    return plural(`DRPG.Price.paid.${receipt.pay}`, { n: receipt.amount });
}

/**
 * The action tile's stripe colour for a priced tile.
 *
 * FOUR KINDS EXIST AND NO FIFTH IS ADDED. The Sanity step takes the "stress"
 * stripe both stylesheets already carry; the Hope step falls back to the caller's
 * own kind, because there is no `hope` stripe in either sheet and adding one means
 * two new rules that R2 would then police for a colour a player meets on a tile
 * once a season. `fallback` is what the tile derived for itself, so an action that
 * hands the turn to the GM keeps its "gm" stripe while it is being paid for with
 * an action or with Hope.
 */
export function stripeKindFor(quote, fallback = "action") {
    if (!quote?.pay) return quote?.blocked ? fallback : "free";
    if (quote.pay === "stress") return "stress";
    return fallback;
}
