/**
 * Danganronpa RPG - the card that reports an action's roll.
 * ---------------------------------------------------------------------------
 * `report`, the card every action's roll ends on, and what it is built of: the
 * header of a card that reports a roll and nothing more (`rollHead`), the
 * card's flags (`rollCardFlags`), the roll's colour (`rollTone`), the duality
 * bar of the two dice and what the rest was (`dualityBar`), the wait for the
 * dice to land (`DICE_SETTLE_MS`, `diceSettled`), and the card named on the
 * GMs' bookmark of the roll, so a Reroll can mark it (`nameReportCard`).
 *
 * WHERE IT SITS. Moved out of action-rolls.mjs by E41 C3 (1.2.97), a pure move
 * that `node tools/moved-only.mjs` proves line by line. action-rolls.mjs
 * re-exports `rollTone` and `report`, the two names here it exported before,
 * and nothing here imports it back (the facade rule, .claude/rules/code.md).
 * `rollHead` and `rollCardFlags` are exported now because the actions write
 * their own cards with them (each in a file of its own since E41 C4);
 * action-rolls.mjs does not re-export them. Of the action family it reads action-pipeline.mjs
 * alone (`rollInHand`, `noteRollContext`).
 */

import { MODULE_ID, TRAITS, TIMING } from "./config.mjs";
import { roomOfActor } from "./movement.mjs";
import { whisperToOwner, log, plural, cardHead, esc } from "./utils.mjs";
import { playSfx } from "./sfx.mjs";
import { rollInHand, noteRollContext } from "./action-pipeline.mjs";

/**
 * The two dice, the modifier and the total - drawn in the module's own card.
 *
 * The card said "14" and stopped there. Which way the roll went was carried by
 * the popup's title colour alone, and the two faces that decided it were only
 * ever on Daggerheart's own chat card: a second card, in a second visual
 * language, that a player had to look away to read. This draws the same
 * sentence the system rolled, in this module's language, next to the result it
 * produced - one card, one paper trail, in chat and in the popup alike.
 *
 * NOT a clone of the system's card, deliberately. That was the other option and
 * it loses three ways: its CSS is outside our layer, it carries interactive
 * buttons this card has no business re-firing, and it arrives on Dice So Nice's
 * schedule rather than ours.
 *
 * WHERE THE NUMBERS COME FROM, and why three ways of asking. A live roll
 * answers `roll.hope` / `roll.fear`; the same roll read back off a chat message
 * does not - those are gone by the time `Roll.fromData` has rebuilt it, which
 * is measured, not assumed. The terms survive, so `HopeDie` / `FearDie` by
 * class name is the fallback, and the last resort is the dice in formula order.
 *
 * The modifier is `total - hope - fear` rather than a sum of the numeric terms:
 * an advantage or disadvantage die is a term too, and a card that printed "+0"
 * while a d6 was quietly making up the difference would be lying about the one
 * line it exists to explain.
 *
 * @returns {string} the bar, or "" when this was not a duality roll at all.
 */
function dualityBar(outcome) {
    const roll = outcome?.raw?.roll ?? outcome?.raw ?? null;
    if (!roll) return "";

    const byClass = name => (roll.terms ?? []).find(t => t?.constructor?.name === name);
    const dieAt = i => roll.dice?.[i]?.total ?? roll.dice?.[i]?.results?.[0]?.result;

    const hope = Number(roll.hope?.total ?? roll.hope?.value ?? byClass("HopeDie")?.total ?? dieAt(0));
    const fear = Number(roll.fear?.total ?? roll.fear?.value ?? byClass("FearDie")?.total ?? dieAt(1));
    const total = Number(outcome?.total ?? roll.total);
    if (![hope, fear, total].every(Number.isFinite)) return "";

    const modifier = total - hope - fear;
    const side = outcome?.isCritical ? "critical" : outcome?.withHope ? "hope" : outcome?.withFear ? "despair" : null;
    const L = key => game.i18n.localize(`DRPG.Action.duality.${key}`);

    /* WHICH STATISTIC, AND WHAT THE REST WAS.
     *
     * The card named the dice and lumped everything else into one unlabelled
     * number - so it never said WHAT was rolled (the one fact Dawid flagged as
     * missing from the result), and an advantage die hid inside the same
     * figure as the trait. The roll carries its own RollData, so the trait's
     * value is read back off `roll.data.traits` and split out: the statistic
     * as a chip that names itself, and whatever remains - advantage,
     * disadvantage, an experience - as a second chip only when it is not
     * nothing. A roll whose data cannot answer keeps the old single figure.
     */
    const trait = TRAITS[outcome?.trait];
    // On a LIVE result the RollData hangs off the result itself and `.roll` is
    // a summary object without it; a roll rebuilt from a chat message carries
    // `.data` directly. Measured both ways - ask both.
    const rollData = roll.data ?? outcome?.raw?.data;
    const statValue = Number(rollData?.traits?.[trait?.dh]?.value);
    const hasStat = Boolean(trait) && Number.isFinite(statValue);
    const bonus = hasStat ? modifier - statValue : modifier;
    const signed = n => `${n < 0 ? "−" : "+"}${Math.abs(n)}`;

    /* THE RESULT FIRST, ITS WORKING UNDER IT.
     *
     * This was one line - `1 + 10 + 1 = 12  with Despair` - which is the same
     * facts and a worse card: the total, the thing the whole roll is for, was
     * the fourth item on a row of seven and the same size as the operators
     * around it. Daggerheart's own card gets this right and it is why it reads
     * better, so the composition follows it: the answer large and centred, the
     * arithmetic beneath it as a quiet second line for anyone checking.
     */
    const formula = [
        `<span class="drpg-duality-die is-hope" data-tooltip="${esc(L("hopeDie"))}">${esc(hope)}</span>`,
        `<span class="drpg-duality-op">+</span>`,
        `<span class="drpg-duality-die is-despair" data-tooltip="${esc(L("despairDie"))}">${esc(fear)}</span>`
    ];

    // The statistic is shown even at +0: its job is to NAME what was rolled,
    // and the name is information at any value. The remainder and the
    // unattributed fallback keep the zero rule - "+ 0" asks the reader to
    // check that the nothing really is nothing.
    if (hasStat) {
        formula.push(`<span class="drpg-duality-op">+</span>`);
        formula.push(`<span class="drpg-duality-stat" data-tooltip="${esc(L("statistic"))}">${
            esc(trait.label)} ${esc(signed(statValue))}</span>`);
    }
    if (bonus !== 0) {
        formula.push(`<span class="drpg-duality-op">${bonus < 0 ? "−" : "+"}</span>`);
        formula.push(`<span class="drpg-duality-mod" data-tooltip="${esc(L(hasStat ? "bonus" : "modifier"))}">${
            esc(Math.abs(bonus))}</span>`);
    }

    return `<div class="drpg-duality"${side ? ` data-side="${side}"` : ""}>
        <div class="drpg-duality-result">
            <span class="drpg-duality-total">${esc(total)}</span>
            ${side ? `<span class="drpg-duality-badge">${esc(L(side))}</span>` : ""}
        </div>
        <div class="drpg-duality-formula">${formula.join("")}</div>
    </div>`;
}

/**
 * How long the card will wait for 3D dice before giving up on them.
 *
 * The animation is a courtesy. The card is not: a roll whose animation never
 * reports itself finished - a client that lost focus mid-throw is the ordinary
 * way - must not be able to swallow the result of an action somebody paid for.
 */
const DICE_SETTLE_MS = TIMING.diceSettleMs;

/**
 * Wait for Dice So Nice to finish throwing, if it is throwing at all.
 *
 * The card prints the two faces now, so posting it while the dice are still
 * tumbling hands the reader the answer to the animation they are watching.
 * Resolves immediately when Dice So Nice is not installed, when this roll had
 * no chat message to animate, and - via the race - when the animation takes
 * longer than anyone should be made to wait for it.
 */
async function diceSettled(messageId) {
    const wait = game.dice3d?.waitFor3DAnimationByMessageID;
    if (!messageId || typeof wait !== "function") return;
    try {
        await Promise.race([
            wait.call(game.dice3d, messageId),
            new Promise(resolve => setTimeout(resolve, DICE_SETTLE_MS))
        ]);
    } catch { /* see DICE_SETTLE_MS */ }
}

/* ==========================================================================
 * REPORTING
 * ========================================================================== */

/**
 * The header for a card that reports a roll and nothing more about it.
 *
 * Five call sites in this file had these exact three slots written out
 * longhand, and they had drifted: four used `Label - total · <em>Critical</em>`
 * and Listen used `Label · Shadow · total`, with the trait name typed in as an
 * English literal rather than read off the roll. Same card, three shapes.
 *
 * `report()` does not go through here because it has a room and an outcome to
 * put in the other two slots.
 *
 * The duality bar comes with it. These cards replace Daggerheart's - the
 * system's copy of the roll is claimed and never rendered, see
 * `supersedingRoll` - so a card that showed only a total would have taken the
 * two faces off the table rather than moved them.
 */
/**
 * WHAT THE DICE DID, AS A COLOUR.
 *
 * The card prints the total; what it cannot say at a glance is which way the
 * roll went, and that is the one thing a player wants from across the table.
 * It reaches the popup's title bar and the chat card's whole ground from here.
 *
 * A Critical is checked first because a roll can be critical AND carry a side,
 * and the rarer fact is the one worth the colour. Exported for the Reroll, whose
 * mark on the card it replaced is drawn in the new roll's colour (E08+E28 C5).
 */
export function rollTone(roll) {
    return roll?.isCritical ? "critical"
        : roll?.withHope ? "hope"
            : roll?.withFear ? "fear" : null;
}

/**
 * The flags every roll card carries - its header, and its outcome as a colour.
 *
 * Five cards in this file went out with neither, so they arrived in flat
 * neutral ink and with no title on their popup while `report()`'s carried both.
 * Same roll, same kind of card, two different surfaces.
 */
export function rollCardFlags(def, roll) {
    return { flags: { [MODULE_ID]: { popupTitle: def.label, popupTone: rollTone(roll) } } };
}

export function rollHead(def, roll) {
    return cardHead({
        action: def.label,
        total: roll?.total,
        result: roll?.isCritical ? game.i18n.localize("DRPG.Action.critical") : null,
        resultKind: roll?.isCritical ? "critical" : null,
        trait: TRAITS[roll?.trait]?.label,
        // The number its window said (`rollTrait`'s `dc`), "needed N" on the card (E51 C1).
        dc: roll?.dc ?? null
    }) + dualityBar(roll);
}

/**
 * The action's card: posted from the roller's browser, to the owner and the GMs. Answers the
 * card (null when there was nothing to report or nothing was posted), and names it to the GMs
 * as the card of the roll it reports (`nameReportCard`, E08+E28 C5). Exported for the suite.
 */
export async function report(actor, def, roll, outcome) {
    if (!outcome) return null;

    // The one moment at a roll the whole table waits for. Local: this runs on
    // the client that rolled, and the card it is about is on its way.
    if (roll?.isCritical) playSfx("critical");

    const traitLabel = TRAITS[roll?.trait]?.label ?? "";
    const lines = [];

    /* ---- a header with fixed slots ------------------------------------
     *
     * Every action card opened differently: some led with the label, some with
     * the trait, the room was never there at all, and what actually happened
     * was somewhere in the paragraphs below. Reading the log after the fact -
     * which is the whole reason the log exists - meant reading each card whole.
     *
     * The grammar itself now lives in `cardHead()` (utils.mjs), because it was
     * written here and stayed here: this was the only card in the module that
     * had it. Everything about the four slots, and what goes in them, is
     * documented there.
     */
    const room = roomOfActor(actor);
    // Only two outcomes are short enough to be a header slot and precise enough
    // to be worth one. Anything else leaves the slot out rather than paraphrase
    // the paragraph below it, which is where the detail belongs.
    const result = outcome.item
        ? game.i18n.format("DRPG.Action.tierShort", { tier: outcome.tier })
        : roll?.isCritical
            ? game.i18n.localize("DRPG.Action.critical")
            : "";

    lines.push(cardHead({
        action: def.label,
        room,
        total: roll?.total,
        result,
        // The two the slot can name are also the two it can colour: something
        // found is evidence, a critical is a critical.
        resultKind: outcome.item ? "evidence" : roll?.isCritical ? "critical" : null,
        trait: traitLabel,
        // "needed N", the number its window said (`rollTrait`'s `dc`; E51 C1): a Palm's hand, a Search's ladder.
        dc: roll?.dc ?? null
    }));

    // Directly under the header, because it is the header's own number shown
    // its working. Empty for anything that reached here without a duality roll
    // behind it - an unanswered Search, a GM's ruling - and an empty string
    // joins into nothing.
    lines.push(dualityBar(roll));

    if (outcome.extra) lines.push(outcome.extra);

    if (outcome.item) {
        lines.push(`<p>${game.i18n.format("DRPG.Action.found", { tier: outcome.tier, item: esc(outcome.item) })}${
            outcome.carried === false ? ` <em>${game.i18n.localize("DRPG.Inventory.notCarried")}</em>` : ""
        }</p>`);
        if (outcome.substitute) {
            lines.push(`<p><em>${game.i18n.localize("DRPG.Action.substitute")}</em></p>`);
        }
    } else if (outcome.text) {
        // Plain text, escaped here once: a name formatted into it goes in raw (an escaped one showed "D&#x27;Arcy").
        lines.push(`<p>${esc(outcome.text)}</p>`);
    }

    // Only a GM's own write knows the resulting numbers. A player's is applied
    // over the socket and answered by a separate whisper, so printing "now ?/?"
    // here would be inventing a figure.
    if (outcome.applied?.changed === true) {
        lines.push(`<p><small>${game.i18n.format("DRPG.Project.now", {
            project: esc(outcome.applied.name), current: outcome.applied.to, target: outcome.applied.target
        })}</small></p>`);
    } else if (outcome.applied?.changed === false) {
        lines.push(`<p><small>${game.i18n.format("DRPG.Project.alreadyFull", {
            name: esc(outcome.applied.name), current: outcome.applied.from, target: outcome.applied.target
        })}</small></p>`);
    }

    // Never the exact visibility band - see `traceFeedback` in remnants.mjs.
    // A plain Despair leaves `outcome.leftTrace` false and prints nothing at
    // all, which is itself the point: it must read the same as leaving no
    // trace whatsoever, or its absence would say as much as its presence.
    if (outcome.leftTrace) {
        lines.push(`<p><em>${game.i18n.localize("DRPG.Action.leavesRemnant")}</em></p>`);
    }

    if (outcome.room) {
        lines.push(`<p><small>${plural("DRPG.Action.tokensLeft", {
            room: esc(outcome.room), n: outcome.tokensLeft
        })}</small></p>`);
    }

    // Reporting only reports. The refund itself is applied by whoever resolved
    // the action - a render function with a side effect hands out a second
    // action every time anything re-renders the same outcome.
    if (outcome.refundAction) {
        lines.push(`<p><em>${game.i18n.localize("DRPG.Action.actionReturned")}</em></p>`);
    }

    const html = lines.join("");

    // The dice land before the card says what they landed on. See `diceSettled`.
    await diceSettled(roll?.raw?.message?.id ?? roll?.raw?.message?._id);

    // Whispered to the player as well as the GMs, and left to popup.mjs to
    // surface on both.
    //
    // This used to be `whisperToGms` plus a `showPopup` here for the player.
    // Two problems with that. The player was not among the whisper's recipients,
    // so they were left with a twelve-second card and no record at all: what the
    // Search turned up, how loud a trace they left, how many searches the room
    // has left - gone the moment it faded. And the popup was raised from the
    // ACTING client, so a card only ever appeared where the code happened to be
    // running.
    //
    // One whisper to everyone entitled to it, and popup.mjs's catch-all raises
    // the card on each of their screens, is both fixes at once. `popupTitle`
    // carries the header the explicit call used to supply. Since E81 (1.2.75)
    // the card itself is kept as well: popup.mjs's recorder puts it in each
    // reader's notice history as it is drawn, so a closed card can be read
    // again in that browser, within the history's budgets, until the season's reset, and the chat log is no
    // longer the player's only record of it.
    // The same facts the header prints, kept as data beside the card's words.
    //
    // The time-of-day summary is assembled by reading these back, and reading
    // them back is only reliable if they were written down: parsing the
    // rendered HTML would tie the summary to the exact wording of the card and
    // break the first time either is reworded. Nothing new is recorded here -
    // every field is one the card already shows. NOT ON THE DOCUMENT (E05 C7,
    // 26.09.2026; audit S10-05, S02-11): they were `flags.summary`, which every
    // browser holds, and 40-flow read p1's find off p2's copy of this card. They
    // travel with the words to the card's readers (secret.mjs `plainSummary`).
    const card = await whisperToOwner(actor, html, {
        flags: {
            [MODULE_ID]: {
                popupTitle: def.label,
                // See `rollTone`, which the five cards that go through
                // `rollHead` share with this one.
                popupTone: rollTone(roll)
            }
        },
        summary: {
            actorId: actor?.id ?? null,
            action: def.label,
            room: room ?? null,
            total: roll?.total ?? null,
            critical: Boolean(roll?.isCritical),
            item: outcome.item ?? null,
            tier: outcome.tier ?? null,
            leftTrace: outcome.leftTrace ?? false,
            at: Date.now()
        }
    });

    await nameReportCard(actor, roll, card);
    log(`${actor.name}: ${def.label} = ${roll?.total}`);
    return card ?? null;
}

/**
 * The card a roll was reported on, told to the GMs with the roll's bookmark (E08+E28 C5; the
 * plan's 2.7), so the Reroll that replaces the roll can mark it. Only for the roll this browser
 * last told them of: a card that reports no roll message, or one this character has rolled
 * again since, names nothing. The GM judges the card (`reportCardOf`).
 */
async function nameReportCard(actor, roll, card) {
    const rollId = roll?.raw?.message?.id ?? roll?.raw?.message?._id ?? null;
    if (!card?.id || !rollId || rollInHand(actor)?.messageId !== rollId) return;
    await noteRollContext(actor, { reportMessageId: card.id });
}
