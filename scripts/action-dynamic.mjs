/**
 * Danganronpa RPG - the Dynamic action.
 * ---------------------------------------------------------------------------
 * The action the GM sets the difficulty of: its definition (`dynamicDef`),
 * `performDynamic`, the GM's window that sets its band and its statistic
 * (`askDynamicDifficulty`) with the number a band is shown by (`dynamicBar`),
 * and the GMs' card a success offers and a Reroll ends (`offerDynamicFind`,
 * `withdrawDynamicFind`).
 *
 * WHERE IT SITS. Moved out of action-rolls.mjs by E41 C4 (1.2.97), a pure move
 * that `node tools/moved-only.mjs` proves line by line. action-rolls.mjs
 * re-exports the 4 names here it exported before, so every importer still
 * imports action-rolls.mjs, and nothing here imports it back (the facade
 * rule, .claude/rules/code.md). `dynamicDef` and `performDynamic` are exported
 * now because `performAction`, which stays there, reads both;
 * action-rolls.mjs does not re-export them. Of the action family it reads the
 * shared layer alone.
 */

import { MODULE_ID, TRAITS, DYNAMIC_THRESHOLDS } from "./config.mjs";
import { spendAction } from "./actions.mjs";
import { roomOfActor } from "./movement.mjs";
import { callGm, promptForRequest } from "./gm-bridge.mjs";
import { whisperToOwner, esc } from "./utils.mjs";
import { rollTrait, rollInHand, remnantRef, noteRollContext, abort, canAfford } from "./action-pipeline.mjs";
import { report } from "./action-report.mjs";
import { briefingBlock } from "./action-briefing.mjs";
import { drpgWindow } from "./ui-kit.mjs";

export function dynamicDef() {
    return {
        label: game.i18n.localize("DRPG.Action.dynamicLabel"),
        icon: "fa-wand-magic-sparkles",
        cost: 1,
        traits: Object.keys(TRAITS),
        description: game.i18n.localize("DRPG.Action.dynamicDescription"),
        /* A GM sets the difficulty or refuses, every time (E22 C5c; audit S02-49): the flag that paints the tile red
           (sheet.mjs, its own copy of this row) prints the briefing's "The GM judges this one" (action-briefing.mjs
           `briefingFacts`), which this definition, missing it, left out. */
        callsGm: true
    };
}

/* ==========================================================================
 * DYNAMIC
 * ========================================================================== */

export async function performDynamic(actor, options) {
    // Read once (E22 C5c; audit S02-49): the window, the waiting card and the report read the same definition.
    const def = dynamicDef();
    if (!canAfford(actor, options.free ? 0 : 1)) return null;

    // Describe it FIRST. The GM cannot set a sensible difficulty for something
    // they have not heard yet, and asking the player to pick a threshold before
    // saying what they are doing is backwards.
    /*
     * ONE CARD (E16 part 2 C1, 26.10.2026; audit S02-34). The description went out through
     * `promptAndCallGm`, a card with a Reply alone, and the difficulty below asked again with the
     * card that carries Set difficulty and Refuse (call-gm.mjs `askDynamicByCard`): two cards
     * with one description, and the first stayed "Awaiting a ruling." in the thread for the rest of
     * the season. The window is asked alone now (`promptForRequest`, no card), and the GMs' one
     * card is the difficulty's; a GM's own action is ruled in a window and posts none. Tier 2's
     * E16-T25 counts the cards.
     */
    const description = await promptForRequest({
        title: def.label,
        intro: briefingBlock(actor, "dynamic", def),
        prompt: game.i18n.localize("DRPG.Action.dynamicDescribe"),
        placeholder: game.i18n.localize("DRPG.Action.dynamicPlaceholder"),
        // An empty description is no action for the GM to price (E18 C0, S10-52): asked again.
        required: true
    });
    if (description === null) return null;

    // The GM sets the difficulty, never the player. A GM running their own
    // character answers their own dialog; everyone else waits on the socket.
    const request = {
        description,
        actorName: actor.name,
        actorId: actor.id,
        room: roomOfActor(actor)
    };

    // The sticky "waiting" card (COMM-04), raised before the fork so the GM
    // guard stays within sight of the bridge call (R6).
    const waiting = game.user.isGM ? () => {} : (await import("./popup.mjs"))
        .showWaiting(game.i18n.localize("DRPG.Action.dynamicWaiting"), def.label);
    let picked;
    try {
        if (game.user.isGM) {
            picked = await askDynamicDifficulty(request);
        } else {
            const { requestDynamicDifficulty } = await import("./gm-bridge.mjs");
            const res = await requestDynamicDifficulty(request);
            picked = res.ok ? res.value : null;
        }
    } finally {
        waiting();
    }

    // `false` is the GM's no (ROLL-08); `null` is a request not carried out, already said.
    if (picked === false) {
        await whisperToOwner(actor, `<p>${game.i18n.localize("DRPG.Action.dynamicRefused")}</p>`);
        return null;
    }
    if (!picked) return null;

    const band = DYNAMIC_THRESHOLDS[picked.tier];
    if (!band) return null;
    // Paid before the dice - see `abort` and ACT-07 above it.
    const cost = options.free ? 0 : 1;
    const paid = cost > 0 ? await spendAction(actor, cost) : null;
    if (cost > 0 && !paid) return null;
    const roll = await rollTrait(actor, picked.trait, {
        actionKey: "dynamic",
        // The number the band passes from (`dynamicBar`), as "beat N" (E16 C0).
        dc: dynamicBar(band),
        context: { bandIndex: picked.tier, description, room: roomOfActor(actor) }
    });
    if (!roll) return abort(actor, paid);

    const success = roll.isCritical || roll.total >= dynamicBar(band);
    const visibility = success ? band.remnant : null;
    let placed = null;

    // Actually leave the trace.
    //
    // The guide gives Dynamic actions their own Remnant column, and the outcome
    // below has always reported one - but nothing ever created it. The action
    // told the player and the GM that a trace had been left and the map stayed
    // empty, which is the one kind of lie an investigation cannot recover from.
    let leftTrace = false;
    if (visibility) {
        const { dropRemnant, traceFeedback } = await import("./remnants.mjs");
        placed = await dropRemnant(actor, {
            type: "prep",
            visibility,
            faint: true,
            action: "dynamic",
            rollId: rollInHand(actor)?.messageId ?? null,
            subject: description.slice(0, 60),
            note: game.i18n.format("DRPG.Remnant.dynamicNote", {
                actor: actor.name,
                room: roomOfActor(actor) ?? "?",
                what: description,
                total: roll.total
            })
        });
        leftTrace = traceFeedback(roll, placed);
    }

    const outcome = {
        success,
        tier: success ? band.tier : null,
        leftTrace,
        text: success ? game.i18n.format("DRPG.Action.dynamicSuccess", { tier: band.tier })
                      : game.i18n.localize("DRPG.Action.nothing")
    };
    // The GMs' card, a miss's too (E51 C1; the session notes of 27.10: a failure gave the GM no card with the result).
    await offerDynamicFind(actor, { success, tier: band.tier, room: roomOfActor(actor), description, roll,
        rollId: rollInHand(actor)?.messageId ?? null, dc: dynamicBar(band) });

    // The GM's difficulty band is the one thing a reroll must NOT re-ask for:
    // the ruling was about what the player described, not about the dice.
    await noteRollContext(actor, {
        actionKey: "dynamic",
        bandIndex: picked.tier,
        description,
        room: roomOfActor(actor),
        ...remnantRef(placed)
    });

    await report(actor, def, roll, outcome);
    Hooks.callAll("drpgActionResolved", { actor, actionKey: "dynamic", roll, outcome });
    return outcome;
}

/**
 * The GMs' card for a Dynamic action that succeeded: Create an item, prefilled with the band's tier,
 * the room and the player's words; Give an existing item; and Reply, for a success that is no item.
 *
 * A SUCCESS THE GM CAN GIVE (E16 part 2 C2, 26.10.2026; audit S02-09, the owner's D16: "przy sukcesie
 * Dynamic GM dostaje kartę z przyciskiem createItem, jak w searchSpecific"). A success told the player
 * "Tier 1" and nothing else, and the GMs had no card to answer it from; the handbook's Dynamic action
 * "can yield" an item, so whether one is made stays the GM's. The card is searchSpecific's shape, read
 * by the same rules (messenger-app.mjs `ruleCreateItem` opens the tables prefilled and gives nothing;
 * `ruleGiveItem` opens the GM's give window), with Reply in place of its two "nothing" answers: the
 * roll succeeded, and the action stays paid. Posted by the client that judged the success - the
 * roller's own here, a GM's for a Reroll that turns a miss (reroll.mjs `settleDynamic`). Tier 2's
 * E16-T26 reads the card's data after a success, a Reroll of it and a Reroll from a miss.
 */
export async function offerDynamicFind(actor, { success = true, tier, room = null, description = "", roll = null, rollId = null,
    dc = roll?.dc ?? null } = {}) {
    /* THE ROLL AND ITS NUMBER, ON A MISS TOO (E51 C1; the session notes of 27.10). The GMs' card came on a success
       alone, so the thread showed the difficulty card's "Answered by" and then nothing: a GM did not see what a miss
       had rolled against what. A miss posts the same card, its roll and "needed N", as a receipt - nothing to rule:
       the miss is the roll's - with no button. E51-T8 reads both. */
    const needed = dc === null || dc === undefined || dc === ""
        ? "" : `<p><small>${esc(game.i18n.format("DRPG.Action.needed", { n: dc }))}</small></p>`;
    const sent = await callGm(actor, {
        title: dynamicDef().label,
        request: description,
        roll,
        room,
        gmBody: success
            ? `<p>${game.i18n.format("DRPG.Action.dynamicFound", { tier })} <em>${
                game.i18n.localize("DRPG.Bridge.createItemStays")}</em></p>${needed}`
            : `<p>${game.i18n.localize("DRPG.Action.dynamicMissedGm")}</p>${needed}`,
        receipt: !success,
        // Lowercase data keys only, as searchSpecific's: `dataset` lowercases them.
        actions: !success ? [] : [
            {
                action: "createItem",
                label: game.i18n.localize("DRPG.Bridge.createItem"),
                // `roll`: the roll's message, by which a Reroll that misses ends this card (`withdrawDynamicFind`).
                data: { by: actor.id, tier: String(tier), room: room ?? "", want: description ?? "", roll: rollId ?? "" }
            },
            { action: "giveItem", label: game.i18n.localize("DRPG.Bridge.giveItem"), data: { by: actor.id } },
            { action: "reply", label: game.i18n.localize("DRPG.Bridge.reply"), data: { by: actor.id } }
        ]
    });
    // Not posted (no GM connected, said once by `callGm`): the roll and its price stand - the success is the
    // roll's, not the card's - and the player asks a GM for the item once one is back.
    if (!sent) return false;
    return true;
}

/**
 * A SUCCESS A REROLL TOOK BACK ENDS ITS CARD (E16 fix e1-G3, 26.10.2026; the review's E16p2-BEH-3 = E16R-02 = E16P2-R3).
 * A Dynamic success posts the GMs' card above, and a Reroll that turned it into a miss took the trace back and told
 * the player "Nothing" - but the card still read "The roll succeeded" with Create an item on it, and a GM who did not
 * watch the Reroll made an item for a roll that had missed. On the GM that settles the Reroll (reroll.mjs
 * `settleDynamic`): every card not yet answered whose Create an item names this character and this roll's message
 * (`data-roll`, written by `offerDynamicFind`) is ended through call-gm.mjs `settleCall`, its buttons off, with
 * the line that the success no longer stands. A card already answered is left as it was: what a GM gave on it is the
 * GMs' to take back. A card a player's console wrote naming the roll is that player's own, and ends the same way.
 * Answers how many cards it ended. Tier 2's E16-T26 reads it.
 */
export async function withdrawDynamicFind(actor, rollId) {
    if (!game.user?.isGM || !actor?.id || !rollId) return 0;
    const { contentOf } = await import("./secret.mjs");
    const { MESSENGER_FLAGS } = await import("./messenger.mjs");
    const { settleCall } = await import("./gm-bridge.mjs");
    const names = message => {
        const words = String(contentOf(message) ?? "");
        if (!words.includes(rollId)) return false;
        const box = document.createElement("template");
        box.innerHTML = words;
        return [...box.content.querySelectorAll('[data-drpg-call="createItem"]')]
            .some(button => button.dataset.by === actor.id && button.dataset.roll === rollId);
    };
    const cards = (game.messages?.contents ?? []).filter(m => !m.getFlag?.(MODULE_ID, MESSENGER_FLAGS.settled) && names(m));
    for (const card of cards) await settleCall(card, game.i18n.localize("DRPG.Action.dynamicRerollMissed"));
    return cards.length;
}

/**
 * The number a Dynamic band passes from: its lower one, or its only one.
 *
 * "BEAT N", NOT A RANGE (E16 part 2 C0, 26.10.2026; audit S13-30, the owner's D16: "pasmo zdaje się
 * od dolnej liczby"). The GM's window offered "8-12 · Trivial" and the roll window read "beat 8-12",
 * while the engine passes a band from its lower number - here, in reroll.mjs `settleDynamic` and on
 * the GM who places the trace (gm-bridge.mjs, `ruled.range[0]`) - so a GM who picked Trivial thinking
 * of 11 saw a 9 succeed. The engine is unchanged; what is shown is its number. Tier 2's E16-T21
 * reads the GM's window, the roll window and a pass at the number.
 */
export function dynamicBar(band) {
    const range = Array.isArray(band?.range) ? band.range : [band?.range];
    const n = Number(range[0]);
    return Number.isFinite(n) ? n : null;
}

/**
 * The GM's side of a Dynamic action: read what the player described, then set
 * the band and the trait it is rolled against.
 *
 * Exported because gm-bridge calls it when the request arrives over the socket.
 * Returning null is a real answer - it means "no, you cannot do that" - and the
 * player's action is refused without costing them anything.
 *
 * @returns {Promise<{tier: number, trait: string}|null>}
 */
export async function askDynamicDifficulty({ description, actorName, room } = {}) {
    const rows = DYNAMIC_THRESHOLDS.map((t, i) =>
        `<option value="${i}">${game.i18n.format("DRPG.Action.beat", { n: dynamicBar(t) })} · ${t.difficulty}</option>`).join("");

    // On the kit's frame (E21 C5a): Set the primary, Refuse - the GM's no, an answer and not a withdrawal - a secondary.
    const picked = await drpgWindow({
        title: game.i18n.localize("DRPG.Action.dynamicTitle"),
        classes: ["drpg-panel"],
        body: `<form>
                    <p>${game.i18n.format("DRPG.Action.dynamicFrom", {
                        actor: foundry.utils.escapeHTML(actorName ?? "?"),
                        room: foundry.utils.escapeHTML(room ?? "-")
                    })}</p>
                    <blockquote>${foundry.utils.escapeHTML(description ?? "")}</blockquote>
                    <label>${game.i18n.localize("DRPG.Action.difficulty")}
                        <select name="tier">${rows}</select></label>
                    <label>${game.i18n.localize("DRPG.Advance.whichTrait")}
                        <select name="trait">${Object.entries(TRAITS)
                            .map(([k, t]) => `<option value="${k}">${t.label}</option>`).join("")}</select></label>
                  </form>`,
        footer: {
            primary: {
                action: "ok", label: game.i18n.localize("DRPG.Action.dynamicSet"),
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return { tier: Number(f.tier.value), trait: f.trait.value };
                }
            },
            secondary: [{ action: "refuse", label: game.i18n.localize("DRPG.Action.dynamicRefuse") }]
        },
        rejectClose: false
    });

    if (!picked || picked === "refuse") return null;
    return picked;
}
