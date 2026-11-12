/**
 * Danganronpa RPG - Analyze.
 * ---------------------------------------------------------------------------
 * The Analyze action: the one Class Trial filter of its rows
 * (`ANALYZE_TRIAL_FILTER`, `analyzeRowShut`) and the request each row asks of
 * the primary GM (`ANALYZE_ROW_REQUEST`, the `passage` row among them),
 * `performAnalyze` and its picker (`askWhatToAnalyze`), and its four roads: a
 * Truth Bullet (`analyseBullet`, with the refusals that hand its price back,
 * `KEY_REFUSALS`), a GM's hint (`askForHint`), a stash (`locateStash`) and a
 * passage (`locatePassage`, the owner's A10 of 11.10).
 *
 * WHERE IT SITS. Moved out of action-rolls.mjs by E41 C4 (1.2.97), a pure move
 * that `node tools/moved-only.mjs` proves line by line. action-rolls.mjs
 * re-exports `ANALYZE_TRIAL_FILTER` and `analyzeRowShut`, the two names here
 * it exported before, and nothing here imports it back (the facade rule,
 * .claude/rules/code.md). `performAnalyze` is exported now because
 * `performAction`, which stays there, dispatches to it; action-rolls.mjs does
 * not re-export it. Of the action family it reads the shared layer alone.
 */

import { getClock } from "./settings.mjs";
// The chains, and the one payer (T-1). Static, and safe to be: price.mjs imports
// nothing but leaves and never reaches back into the action pipeline.
import { quotePrice, payPrice, refundPrice } from "./price.mjs";
import { roomOfActor } from "./movement.mjs";
import { callGm } from "./gm-bridge.mjs";
import { whisperToOwner, plural } from "./utils.mjs";
import { rollTrait, rollInHand, noteRollContext, gmRulingActions } from "./action-pipeline.mjs";
import { rollCardFlags, rollHead } from "./action-report.mjs";
import { briefingBlock } from "./action-briefing.mjs";
import { requestFieldHtml, readRequestField, chooseVariant } from "./action-menus.mjs";

/*
 * ONE CLASS TRIAL FILTER FOR ANALYZE (E16 part 2 C3, 26.10.2026; audit S02-70, the owner's D16: "Płatne opcje Analyze w
 * procesie odfiltrować" ... "odmawia choice 'hint' i 'stash' w classTrial, także z pakietu"). In a trial Analyze only
 * identifies Truth Bullets: its picker offered a GM's hint and a stash hunt there, each paid with an action and then with
 * Hope or Sanity, and only the passage was taken off (E80 C3, by a phase test of its own). One list now, read by the
 * picker (`askWhatToAnalyze`) and by `performAnalyze` before the price, whatever the picker returned: a row of the picker
 * (`row`: "bullet", "hint", "stash", "passage") with the condition that shuts it in a Class Trial (`shut`, handed the
 * row's context: for "bullet" the bullet). Outside a trial no row is shut, so none is greyed (the owner, 11.10 A10:
 * "E16 zostawia jeden filtr, a wiersz poza rozprawą nigdy nie jest wyszarzony"). E70 C9 appends its Key Remnant read here
 * (the Reveal's copy, below), tested in tier 2 E70-T11 and scenario 67-trial-modes (66 is 66-rooms); Frisk is no row (13.10 A11: the GM-online check covers it). The
 * GMs refuse the stash hunt in a trial on their side too (stash-reach.mjs `resolveStashSearch`), and the passage
 * (passages-gm.mjs `resolvePassageSearch`): this list is the player's window, not the protection.
 */
export const ANALYZE_TRIAL_FILTER = [
    { row: "hint", shut: () => true },
    { row: "stash", shut: () => true },
    { row: "passage", shut: () => true },
    /* MONOKUMA'S REVEAL'S COPY STAYS OPEN (E70 C9, amend 5 (c); the owner's Q-p2-2 of 27.10: "typed Key with the player's
       text, not analysed; Analyze at its usual cost"). The copy a Reveal hands every participant (trial-modes.mjs
       `revealInStep`) is a Truth Bullet to identify like any other in the trial: the row shuts no bullet, and is here so
       that a later rule for the trial's bullets is written beside the one that keeps this read open. Tier 2 E70-T11. */
    { row: "bullet", reveal: true, shut: () => false }
];

/** Whether `row` of the Analyze picker is shut now (`ANALYZE_TRIAL_FILTER`): only in a Class Trial, by one of its conditions. */
export function analyzeRowShut(row, { phase = getClock()?.phase, ...context } = {}) {
    return phase === "classTrial" && ANALYZE_TRIAL_FILTER.some(entry => entry.row === row && entry.shut(context));
}

/* The request whose refusal a shut row is told as (bridge-guards.mjs `sayNotDone`). */
const ANALYZE_ROW_REQUEST = Object.freeze({ bullet: "analyze.resolve", hint: "analyze.resolve", stash: "vault.findStash", passage: "passage.find" });

/**
 * Analyze: one action, two uses, and they no longer end the same way.
 *
 * Analysing evidence is a table lookup - Head against ANALYZE_DC - so it is
 * scored rather than ruled, on the GM's client because half the lookup is the
 * secret the roll is buying. Asking for a hint has no table and never will: it
 * stays a human ruling, and stays marked as one so a Reroll re-asks instead of
 * pretending to recompute it.
 */
export async function performAnalyze(actor, def, options) {
    /*
     * ANALYZE PAYS A CHAIN (T-1, Dawid 17.09): an action, and inside a Class
     * Trial a Hope or a Sanity mark once the actions are gone. That the later
     * steps exist only in a trial is `stepsBeyondFirst` in PRICE_CHAINS, not a
     * question this function asks the clock - one table, one answer.
     *
     * `free` is a GM's bypass only. It used to skip an action; it would now skip
     * Hope and Sanity too, and `performAction` is on the API, so a player's macro
     * could analyse for nothing all trial.
     */
    const free = Boolean(options.free) && game.user.isGM;
    if (!free) {
        const quote = quotePrice(actor, "analyze");
        if (quote.blocked) {
            ui.notifications.warn(quote.blocked);
            return null;
        }
    }

    // Only bullets there is still something to learn about. A read one is
    // finished - a Key or a Final showing its kind is not, until its reading is
    // bought (21.09) - and one this character already burned an attempt on this
    // chapter is closed to them until the next - guide, p. 30.
    const { analysableBullets } = await import("./truth-bullets.mjs");
    const bullets = analysableBullets(actor);

    // Launched from the Analyze button on one specific bullet (see sheet.mjs):
    // the player has already said which one, so the picker would be asking a
    // question that is answered.
    const preselected = options.bulletId
        ? (bullets.find(b => b.id === options.bulletId) ?? null)
        : null;

    const asked = preselected
        ? { choice: preselected.id, request: "" }
        : await askWhatToAnalyze(actor, def, bullets);
    const choice = asked?.choice ?? null;
    if (!choice || choice === "cancel") return null;

    // "hint", "stash" and "passage" are literal action ids; anything else is the
    // bullet id the "bullet" row's own select returned above.
    const ruled = choice === "hint" || choice === "stash" || choice === "passage";
    const subject = ruled ? null : (bullets.find(b => b.id === choice) ?? null);
    if (!ruled && !subject) return null;

    /*
     * ALL THREE ROADS END WITH A HUMAN, so a road with nobody on it is refused
     * BEFORE the price and before the dice (T-1). Without this the action was
     * paid for, the dice were thrown, and the packet was dropped on the way out.
     */
    const { gmOnline, sayNotDone } = await import("./bridge-guards.mjs");
    // A row the Class Trial filter shuts (`ANALYZE_TRIAL_FILTER`; E80 C3 for the passage, E16 part 2 C3 for the hint and
    // the stash) is not offered there, and an Analyze that names it anyway is refused here, before the price - the GMs
    // refuse the stash hunt and the passage too.
    const row = ruled ? choice : "bullet";
    if (analyzeRowShut(row, { bullet: subject })) {
        sayNotDone(ANALYZE_ROW_REQUEST[row], "trialLocked", { nothingSpent: true });
        return null;
    }
    if (!gmOnline()) {
        // The bridge's own sentence for a request with no GM (E31), and nothing was paid.
        sayNotDone("analyze.resolve", "noGm", { nothingSpent: true });
        return null;
    }

    // Paid before the dice - see `abort` and ACT-07 above it. `payPrice` quotes
    // again for itself, so a second window opened over this one pays the next
    // step in the chain rather than this step twice.
    const charge = free ? null : await payPrice(actor, "analyze");
    if (!free && !charge) return null;
    const roll = await rollTrait(actor, "head", {
        actionKey: "analyze",
        // A bullet's own difficulty is read off its REAL type, which is the
        // answer the roll exists to find - so only the two ruled routes show one.
        dc: choice === "hint" ? (def.hintThresholds ?? []).map(t => t.min).join(" / ")
            : choice === "stash" ? def.stashThreshold
            : choice === "passage" ? def.passageThreshold : null,
        // What the GMs' record of the roll keeps for gm-bridge.mjs `passage.find` (roll-draw.mjs `CONTEXT_SENT`).
        ...(choice === "passage" ? { context: { findPassage: true } } : {})
    });
    if (!roll) {
        // The window was closed. Whatever the chain took, it gives back - the
        // step that paid, and a Burst as a Burst.
        if (charge) await refundPrice(actor, charge);
        return null;
    }

    if (choice === "stash") return locateStash(actor, def, roll, asked?.request ?? "", charge);
    if (choice === "passage") return locatePassage(actor, def, roll, asked?.request ?? "", charge);
    return subject
        ? analyseBullet(actor, def, roll, subject, charge)
        : askForHint(actor, def, roll, asked?.request ?? "", charge);
}

/* The refusals of an Analyze that hand its price back (`analyseBullet`): the GM's side scored nothing. */
const KEY_REFUSALS = new Set(["answerKeyMissing", "keysNotOpen"]);

/**
 * Analysing evidence. The roll goes to the GM's client to be scored, because
 * the difficulty depends on what the bullet really is - which is precisely what
 * the roll is trying to find out. See analyze.mjs.
 */
async function analyseBullet(actor, def, roll, subject, charge = null) {
    const { requestAnalyzeResolve } = await import("./gm-bridge.mjs");
    const { gmOnline, sayNotDone, reasonOf } = await import("./bridge-guards.mjs");

    /*
     * THE LAST GM CAN LEAVE WHILE THE DICE ARE IN THE AIR, and then there is
     * nobody to score this against the answer key. Refunded on THAT, and on the
     * two refusals below that say by their code that nothing was scored: on a
     * GM's client `requestAnalyzeResolve` answers the resolver's own value, which
     * may legitimately be null, so a refund keyed on anything else it answered
     * would hand the price back for a resolution that happened (T-1).
     */
    if (!gmOnline()) {
        if (charge) await refundPrice(actor, charge);
        sayNotDone("analyze.resolve", "noGm", { nothingSpent: true });
        return null;
    }

    // No `gmRuled` here, unlike the hint branch: this outcome follows from a
    // table, so a Reroll can genuinely replay it rather than re-ask a human.
    await noteRollContext(actor, {
        actionKey: "analyze",
        bulletId: subject.id,
        label: game.i18n.format("DRPG.Analyze.onBullet", { name: subject.name }),
        room: roomOfActor(actor)
    });

    const res = await requestAnalyzeResolve({
        actorId: actor.id,
        itemId: subject.id,
        total: roll.total,
        isCritical: Boolean(roll.isCritical),
        // The roll the GMs' fact of the bullet goes on (fix r1-G2).
        rollId: rollInHand(actor)?.messageId ?? null
    });

    /*
     * A KEY THE GM'S BROWSER CANNOT READ IS NOT THE PLAYER'S TO PAY FOR (E04's fix
     * round 10, 26.09.2026). Two refusals come before anything is scored, for a
     * reason that is no part of the rules: the bullet has no answer key on the GM's
     * browser (`answerKeyMissing`), or the GM's stores did not open in time
     * (`keysNotOpen`). Each hands back the step that paid, as a closed window does.
     * Measured on 05ac984: the missing key left p1's actions 3 -> 2, nothing given
     * back, though analyze.mjs said a refusal did. Those two codes and no other: "no
     * answer" can follow a resolution that happened, and so can a run that failed
     * part-way. On a GM's own client the refusal is the resolver's value, read alike.
     */
    const refusedFor = res.ok ? (res.value?.refused ? reasonOf(res.value.refused) : null) : (res.refused ? res.reason : null);
    if (charge && KEY_REFUSALS.has(refusedFor)) await refundPrice(actor, charge);

    // Silent on the outcome on purpose: this client does not know the number it
    // was measured against, and must not be told. "The GM is working it out" only
    // when the GM's client has done so (E31 review); a refusal has been said.
    // A GM's own refused Analyze settles as done with `{ refused }` as its value, said already (E14 fix e1-G4, the class of E14R-05).
    await whisperToOwner(actor, `${rollHead(def, roll)}${res.ok && !res.value?.refused ? `<p><small>${
        game.i18n.format("DRPG.Analyze.sent", {
            name: foundry.utils.escapeHTML(subject.name)
        })}</small></p>` : ""}`, rollCardFlags(def, roll));

    return { roll, subject: subject.name };
}

/** The other half of the action: no evidence, just a nudge from the GM. */
async function askForHint(actor, def, roll, request = "", charge = null) {
    const rows = def.hintThresholds.map(t =>
        `<li>${t.min}+ - ${foundry.utils.escapeHTML(t.result)}</li>`).join("");
    const body = `<ul class="drpg-gm-reference">${rows}
            <li><em>${game.i18n.localize("DRPG.Action.critical")} - ${
                foundry.utils.escapeHTML(def.hintCritical.result)}</em></li></ul>`;

    const title = game.i18n.localize("DRPG.Analyze.askHint");

    // The question was typed in the variant window, with the two branches in
    // front of the player - see "THE SENTENCE COMES FIRST".
    const sent = await callGm(actor, {
        title,
        request,
        roll,
        room: roomOfActor(actor),
        body,
        // The hint IS the answer, so it goes back down the thread the question
        // came up. The price has already been paid by the time this runs, so the
        // refusal hands back the STEP that paid - see `decline` in
        // `runCallAction`.
        actions: gmRulingActions(actor, charge),
        // `callGm` says the refusal itself since E18 C0; the price comes back just below.
        what: "analyze.resolve",
        nothingSpent: true
    });

    // Nobody to ask. `callGm` answers false for that, which is a real refusal
    // rather than a ruling, so the price comes back (T-1).
    if (!sent) {
        if (charge) await refundPrice(actor, charge);
        return null;
    }

    await noteRollContext(actor, {
        actionKey: "analyze", gmRuled: true, request, label: title, room: roomOfActor(actor)
    });

    await whisperToOwner(actor, `${rollHead(def, roll)}${body}`, rollCardFlags(def, roll));

    return { calledGm: true, roll, subject: null };
}

/**
 * Looking for somebody's hiding place.
 *
 * THE ROLL EXISTS AND THE BOOKKEEPING DOES NOT, and that is the whole design.
 * There is no register of who found whose stash, no world setting, no automatic
 * grant of access. The number goes to the GM as a card and a person decides
 * what it bought, exactly the way "ask for a hint" already does.
 *
 * That is not laziness, it is the cheaper of two correct answers. A
 * world-scoped "who has found what" register is readable from the console by
 * the person it is being kept from - Foundry ships the whole world to every
 * client - and the airtight version means asking a GM every time a sheet opens.
 * Since a human is answering anyway, there is nothing left to hide.
 *
 * THE OPTION IS NEVER GREYED OUT, and that is deliberate too. Dimming it in a
 * room with no stash in it would answer the question the action is asking, for
 * free, without a roll - so it is always offered and the answer always comes
 * from the GM. In practice: they lift the padlock in the Stashes tab for that
 * one player, or simply tell them what is in it.
 */
async function locateStash(actor, def, roll, request = "", charge = null) {
    const room = roomOfActor(actor);
    const title = game.i18n.localize("DRPG.Analyze.findStash");

    // The number travels; the verdict is made where the answer key is. Same
    // division as Observe, and the same reason: this client must not be the one
    // that decides whether it found something.
    /*
     * NOT ANNOUNCED HERE ANY MORE (E80 fix r1-G1, 18.10.2026; the review's
     * E80-SEC-1). Dawid, 28.08: a trap watching for a stash hunt fires on EVERY
     * attempt, including one that finds nothing, before the dice are read. This
     * client raised it, and its relay was the only thing that told the GM: a
     * console that searched without raising it hunted past every trap. It is
     * raised by the GM that judges the search now (stash-reach.mjs
     * `resolveStashSearch`), before the roll is scored.
     */
    const { requestStashSearch } = await import("./gm-bridge.mjs");
    const { gmOnline, sayNotDone } = await import("./bridge-guards.mjs");

    // The same rule as `analyseBullet`: only a road with nobody left on it hands
    // the price back (T-1).
    if (!gmOnline()) {
        if (charge) await refundPrice(actor, charge);
        sayNotDone("vault.findStash", "noGm", { nothingSpent: true });
        return null;
    }
    /* A CLASS TRIAL OPENED WHILE THE DICE WERE IN THE AIR (E16 part 2 C3): the GMs refuse the hunt before its throw is
       read (stash-reach.mjs `resolveStashSearch`), so the price comes back - by analogy with E14 part 1's Q3 ("a refusal before
       the rolls are read refunds", 18.10). Asked here first, where the price is known, and again on the GMs' answer
       below: a trial opened while the packet was in flight is refused there (E16 fix e1-G2). */
    if (analyzeRowShut("stash")) {
        if (charge) await refundPrice(actor, charge);
        sayNotDone("vault.findStash", "trialLocked", { nothingSpent: true });
        return null;
    }

    /* THE ATTEMPT BEFORE ITS ANSWER (E16 fix e1-G2, 26.10.2026), as `locatePassage`'s since E80 fix r1-G3: `vault.findStash`
       is answered "reply" now, once the GMs have judged the search and whispered what it found, so this card, posted after
       the answer, would come under the result. Posted before the request; a refusal is said after it. The roll the GM
       scores the search on is the one in hand as it is posted, from the GMs' record of it (E08+E28 C14). */
    const rollId = rollInHand(actor)?.messageId ?? null;
    await whisperToOwner(actor, `${rollHead(def, roll)}<p>${game.i18n.localize("DRPG.Analyze.stashSent")}</p>`, rollCardFlags(def, roll));

    const res = await requestStashSearch({
        actorId: actor.id,
        total: roll.total,
        isCritical: Boolean(roll.isCritical),
        rollId
    });
    /* A REFUSAL GIVES THE PRICE BACK (E16 fix e1-G2; the review's E16p2-BEH-1 = E16R-04 = E16P2-R4): every refusal of the
       row comes before the throw is read - its guards, the roll's record, a Class Trial opened while the packet was in
       flight (`resolveStashSearch`). A GM's own search refused settles as done with `{ refused }` as its value; a
       player's is the bridge's refusal, said already in both. No fact of a search on the roll. A wait that ends with no
       answer is no refusal: what the GMs did is not known here, and the price stays. */
    if (res.ok ? Boolean(res.value?.refused) : Boolean(res.refused)) {
        if (charge) await refundPrice(actor, charge);
        return null;
    }

    // NOT `gmRuled`. A Reroll replays this from a threshold (reroll.mjs `settleStashFind`, E80 C4), on the GMs'
    // facts that this roll was a Find Stash and whether it opened one: a player's written by bridge-runs-acts.mjs
    // `handleFindStash`, a GM's own here (`OWN_FACTS`, from the answer of its own search). A roll that opened
    // one opens no second, however often it is rerolled.
    await noteRollContext(actor, {
        actionKey: "analyze", findStash: true, request, label: title, room,
        ...(game.user?.isGM ? { stashFound: Boolean(res.value?.found), ...(res.value?.place ? { findPlace: res.value.place } : {}) } : {})
    });

    // The card above is silent on the outcome, like `analyseBullet`'s: this client does not know what is in the room and
    // must not be told by the shape of its own card. The result is the GMs' own whisper.
    return { roll, subject: null };
}

/**
 * Find Passage (E80 C3; the owner's A10, proposal 13): Head against `def.passageThreshold`, judged on
 * the primary GM from its own record of the roll (passages-gm.mjs `resolvePassageSearch`), which tells
 * the character's owner on a card of its own what was found - one shape whatever came of it. Like the
 * stash's, the row is offered in every room and never greyed: one that dimmed where there is no passage
 * would answer the question for free. A trap watching for it fires on every first throw, hit or miss, before
 * the answer - raised since E80 fix r1-G1 on the primary GM that judges it (`resolvePassageSearch`, the review's
 * E80-SEC-1), where until then this client raised it and a console that did not was hunted past every trap. This
 * card says only that the walls were gone over.
 */
async function locatePassage(actor, def, roll, request = "", charge = null) {
    const room = roomOfActor(actor);

    const { requestPassageFind } = await import("./gm-bridge.mjs");
    const { gmOnline, sayNotDone } = await import("./bridge-guards.mjs");
    if (!gmOnline()) {
        if (charge) await refundPrice(actor, charge);
        sayNotDone("passage.find", "noGm", { nothingSpent: true });
        return null;
    }

    /* THE ATTEMPT BEFORE ITS ANSWER (E80 fix r1-G3, the review's E80-C3-5). `passage.find` is answered "reply", once the
       primary has judged the search and whispered its card, so this card, posted after the answer, came under the result:
       the chat read the passage found, then the walls being gone over. It is posted once a GM is connected and before
       the request; a refusal is said after it, in the player's words, as every refusal is. */
    const rollId = rollInHand(actor)?.messageId ?? null;
    await whisperToOwner(actor, `${rollHead(def, roll)}<p>${game.i18n.localize("DRPG.Analyze.passageSent")}</p>`, rollCardFlags(def, roll));

    await requestPassageFind({
        actorId: actor.id,
        total: roll.total,
        isCritical: Boolean(roll.isCritical),
        rollId
    });

    // Not `gmRuled`: a Reroll replays it from a threshold (reroll.mjs `settleAnalyze`), on the GMs' fact
    // that this roll was a Find Passage (passages-gm.mjs `noteFindFact`).
    await noteRollContext(actor, {
        actionKey: "analyze", request, label: game.i18n.localize("DRPG.Analyze.findPassage"), room
    });

    return { roll, subject: null };
}

/**
 * Which bullet, a hint, somebody's hiding place, or a secret passage.
 *
 * The bullet picker used to be its own dialog, shown only after choosing
 * "Analyze a bullet" - two windows every time there was a bullet to analyze.
 * It is folded into one instead: the select is simply ignored when "Ask for a
 * hint" is the button actually pressed.
 *
 * @returns {Promise<string|null>}  "hint", a bullet id, "cancel", or null.
 */
async function askWhatToAnalyze(actor, def, bullets) {
    // Two variants and one select, rather than two buttons and one select: the
    // select belongs to the first variant only, and as a footer button pair
    // there was nothing to say so. It rides along as `extra` and is simply not
    // read when the hint is what was chosen.
    const picked = await chooseVariant({
        actor,
        title: def.label,
        intro: briefingBlock(actor, "analyze", def),
        // Every row rolls (E100 item 6, R3922: one word per kind of button; "Do it" until then).
        confirm: game.i18n.localize("DRPG.Action.roll"),
        options: [
            {
                value: "bullet", icon: "fa-magnifying-glass-chart",
                label: game.i18n.localize("DRPG.Analyze.analyseBullet"),
                hint: plural("DRPG.Analyze.analyseBulletHint", { n: bullets.length }),
                disabled: !bullets.length,
                why: game.i18n.localize("DRPG.Analyze.noBullets")
            },
            {
                value: "hint", icon: "fa-comment-question", gmRoute: true,
                label: game.i18n.localize("DRPG.Analyze.askHint"),
                hint: game.i18n.localize("DRPG.Analyze.askHintHint")
            },
            {
                // Never disabled - see `locateStash`. An option that greys out
                // in rooms with no stash is a stash detector you do not have to
                // roll for.
                //
                // And no longer red: red means "this hands the turn to a person
                // and comes back at their pace", and this one does not any more.
                // The other two rows keep it, which is what makes the colour
                // mean something in a menu where it is not unanimous.
                value: "stash", icon: "fa-box-archive",
                label: game.i18n.localize("DRPG.Analyze.findStash"),
                hint: game.i18n.format("DRPG.Analyze.findStashHint", {
                    n: def.stashThreshold
                })
            },
            // Never disabled either (`locatePassage`), and in every room.
            {
                value: "passage", icon: "fa-dungeon",
                label: game.i18n.localize("DRPG.Analyze.findPassage"),
                hint: game.i18n.format("DRPG.Analyze.findPassageHint", { n: def.passageThreshold })
            }
        // In a Class Trial the rows the filter shuts are not offered at all (`ANALYZE_TRIAL_FILTER`), never greyed.
        ].filter(option => !analyzeRowShut(option.value)),
        extra: `${bullets.length
            ? `<label>${game.i18n.localize("DRPG.Analyze.whichBullet")}
                <select name="bullet">${bullets
                    .map(b => `<option value="${b.id}">${
                        foundry.utils.escapeHTML(b.name)}</option>`).join("")}</select></label>`
            : ""}${requestFieldHtml({
                prompt: game.i18n.format("DRPG.Action.gmPrompt", { action: def.label }),
                placeholder: game.i18n.localize("DRPG.Action.placeholder.analyze"),
                // A GM reads it on the hint alone (E51 C1; audit S02-51 (a)): shown with every row, it asked the
                // stash hunt and the passage, which no person reads, for a sentence. R1103 reads it.
                when: "hint"
            })}`
    });

    if (!picked) return null;
    // Read for the hint alone, as it is shown: what was typed before another row was picked is not that row's.
    const request = picked.value === "hint" ? readRequestField(picked.form) : "";
    // Both of the rows that end in a person are their own answer. Only the
    // first has a `<select>` underneath it, so anything else falling through to
    // the line below reads an element that is not there and comes back `null`,
    // which `performAnalyze` treats as "cancelled" - measured: picking "Locate
    // a hidden stash" spent nothing, rolled nothing and closed in silence.
    if (picked.value === "hint" || picked.value === "stash" || picked.value === "passage") {
        return { choice: picked.value, request };
    }
    return { choice: picked.form.querySelector("[name=bullet]")?.value ?? null, request };
}
