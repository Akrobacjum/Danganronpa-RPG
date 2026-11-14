/**
 * Danganronpa RPG - Direct Murder, the betrayal and the fight's menu.
 * ---------------------------------------------------------------------------
 * What the Direct Murder tile does, by when it is pressed: in a fight it opens
 * the incident's own actions (`openCrisisMenu`, with the row's details,
 * `crisisDetails`), with a partner still standing it is the betrayal
 * (`performBetrayal`), and in an Eclipse it declares a killing for later
 * (`performDirectMurder`).
 *
 * WHERE IT SITS. Moved out of action-rolls.mjs by E41 C4 (1.2.97), a pure move
 * that `node tools/moved-only.mjs` proves line by line. Nothing here was
 * exported before; `openCrisisMenu`, `performBetrayal` and
 * `performDirectMurder` are exported now because `performAction`, which stays
 * in action-rolls.mjs, calls them, and action-rolls.mjs does not re-export
 * them. Nothing here imports action-rolls.mjs (the facade rule,
 * .claude/rules/code.md). Of the action family it reads the shared layer
 * alone.
 */

import { TRAITS, RESOLUTION_STRESS_COST } from "./config.mjs";
import { spendAction } from "./actions.mjs";
import { isEclipse } from "./eclipse.mjs";
import { roomOfActor } from "./movement.mjs";
import { whisperToOwner, cardHead, esc, proseOf } from "./utils.mjs";
import { abort, canAfford } from "./action-pipeline.mjs";
import { briefingBlock } from "./action-briefing.mjs";
import { actionWindow, chooseVariant, promptForNote, traitFieldHtml, readProposal } from "./action-menus.mjs";
import { drpgConfirm } from "./ui-kit.mjs";

/**
 * The incident's own actions, behind the Direct Murder tile - which a fight draws as
 * "Fight back" on the victim's side and "Crisis actions" on the others
 * (murder-rules.mjs `crisisTileLabel`, E32+E07 C16).
 *
 * THE CRISIS GRID USED TO BE A SECOND GRID ON THE SHEET, drawn in place of the
 * ordinary one. It is a menu now, for the same reason the clean-up panel became
 * a menu: a second grid underneath the first is a second place to look for
 * actions, and the sheet already has a place for actions.
 *
 * NOTHING ABOUT WHO MAY DO WHAT IS DECIDED HERE. `availableCrisisActions` still
 * answers what this character is offered - it is the function that knows their
 * side, what a Pin has blocked, what Self-defence has not unlocked yet and what
 * they have already spent - and `takeCrisisAction` still decides what happens.
 * This draws the same list with the same four reasons a row can be shut, in the
 * same order of precedence the tiles used.
 *
 * The hidden one stays hidden: using an item is reached by pressing "use" on
 * the thing you want to use, which is where a player already looks for it.
 *
 * ONE MENU, ONE ROLL (E32+E07 C15, 03.10.2026; audit S02-32, S04-27, S02-31). The
 * menu was followed by a confirmation (`confirmCrisisAction`) that repeated the
 * row's sentence and its threshold, started the miss with "Nothing happens." under
 * no label, and made Cancel its filled default: three windows to one roll. What it
 * said that the row did not now unfolds under the picked row (`crisisDetails`), and
 * the menu's own button - the default - says "Roll it", or "Do it" for a row that
 * throws no dice. Then the GM's pick where the action lists several statistics,
 * then the roll window.
 */
export async function openCrisisMenu(actor) {
    const { availableCrisisActions, isTheirTurn, takeCrisisAction, crisisVariant } =
        await import("./murder.mjs");
    const { listedTraits, resolveArmed } = await import("./trait-ruling.mjs");
    const { isBrokenDown } = await import("./character.mjs");

    const options = availableCrisisActions(actor).filter(o => !o.hidden);
    if (!options.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Murder.nothingToDo"));
        return null;
    }

    /*
     * NOT YOUR TURN IS SAID, NOT DRAWN.
     *
     * The old panel greyed every tile and put "waiting for them" in its
     * heading, which a menu cannot do: `chooseVariant` refuses to open when
     * every row is disabled, and off-turn every row is. Measured - the tile did
     * nothing at all and warned "no variants", which is true and useless.
     *
     * So the answer comes as a sentence. What is lost is being able to READ the
     * list while waiting; what is gained is that the one live tile on the sheet
     * always does something when pressed. The list is one press away the moment
     * the turn comes round. Until E32+E07 C16 the sentence was the panel's old
     * heading, "Incident - waiting for them", which says what the screen is and
     * not what the player can do (audit S02-33); the tile is dimmed off-turn now
     * and says the same sentence on hover (sheet-actions.mjs `actionButton`).
     */
    const yours = isTheirTurn(actor);
    if (!yours) {
        ui.notifications.info(game.i18n.localize("DRPG.Murder.offTurn"));
        return null;
    }

    const brokenDown = isBrokenDown(actor);
    const youPick = resolveArmed(actor);
    // What each row lists (a trap victim's own table where the incident gives one), and whether its roll asks a GM.
    const listed = Object.fromEntries(options.map(({ key }) => [key, listedTraits({ kind: "crisis", key, variant: crisisVariant(actor, key) })]));
    const asks = ({ key, def, free }) => !free && !def.noRoll && !youPick && listed[key].length > 1;
    const picked = await chooseVariant({
        actor,
        title: game.i18n.localize("DRPG.Murder.yourTurn"),
        // The left column of every action's window (E68 C12, layout B): the menu had no briefing, so one sentence.
        intro: `<div class="drpg-briefing-block"><p>${game.i18n.localize("DRPG.Murder.crisisBrief")}</p></div>`,
        prompt: game.i18n.localize("DRPG.Murder.crisisPrompt"),
        confirm: game.i18n.localize("DRPG.Murder.briefRoll"),
        options: options.map(({ key, def, threshold, defense, free, hindered, blocked, locked, spent, lockedBy, denied, why }) => ({
            value: key,
            icon: def.icon ?? "fa-burst",
            label: def.label,
            // The number to beat, which the guide prints in its own crisis
            // table - a player choosing between Strike at 15 and Pin at 12 is
            // making the decision that table is for. The three third-party
            // decisions have no dice and say so, and so does a free take: its
            // threshold is no number to beat when nothing is thrown (S04-27).
            hint: `${free
                ? game.i18n.localize("DRPG.Murder.noRollItWorks")
                : threshold === null || threshold === undefined
                    ? game.i18n.localize("DRPG.Murder.noRollNeeded")
                    // With the other side's defence in it (E64; DA6/DA23): "Beat 16 (+1 for the victim's Body)".
                    : defense > 0 && def.defense
                        ? game.i18n.format(`DRPG.Murder.thresholdDefended.${def.defense.side}`, {
                            n: threshold, d: defense, trait: TRAITS[def.defense.trait]?.label ?? def.defense.trait })
                        : game.i18n.format("DRPG.Murder.thresholdShort", { n: threshold })}${
                // The row's one sentence (E68 C13; the owner's Q5 of round M): `short`, its full hint first in the details.
                def.short ? ` - ${proseOf(def, "short")}` : def.hint ? ` - ${proseOf(def, "hint")}` : ""}${
                hindered && !free ? ` · ${game.i18n.localize("DRPG.Murder.actionHindered")}` : ""}`,
            // The whole hint stacked under the lead, the facts in the window's Details by row (E49 A8.1).
            details: crisisDetails(def, { free, brokenDown }),
            facts: crisisFacts(def, { free, brokenDown, youPick, traits: listed[key] }),
            // The player's proposal, for the row that asks a GM (E68 C4; DA18): the first listed checked. In the right
            // column's statistic slot while the row is picked (E68 C13's merge; the owner's Q3 of round M), not with
            // the row's details on the left.
            field: asks({ key, def, free }) ? traitFieldHtml(actor, listed[key], { propose: true }) : "",
            // A roll that sends a card wears the GM's road (D11; utils.mjs `GM_ROUTE_CLASS`), as a project's does.
            gmRoute: asks({ key, def, free }),
            confirm: game.i18n.localize(free || def.noRoll ? "DRPG.Murder.briefTake" : "DRPG.Murder.briefRoll"),
            disabled: blocked,
            // Taken away by the incident (`deniedToVictim`): drawn struck through, with why (E51 C1; S02-51 (g)).
            struck: Boolean(denied),
            // Say WHICH kind of shut this is, in the same precedence the tiles
            // used: taken away by the incident, locked behind another action,
            // already spent, or blocked by something the other side did.
            why: denied
                ? game.i18n.localize(why ?? "DRPG.Murder.deniedByIncident")
                : locked
                ? game.i18n.format("DRPG.Murder.actionLocked", { name: lockedBy ?? "?" })
                : spent
                    ? game.i18n.localize("DRPG.Murder.actionSpent")
                    : game.i18n.localize("DRPG.Murder.actionBlocked")
        }))
    });

    if (!picked) return null;
    const scope = picked.form?.querySelector(`[data-drpg-field="${picked.value}"]`) ?? null;
    // A pass after a GM's "Change to" spends nothing and gives the turn's choice back (QUESTIONS.md Q11): the menu again.
    let passed = false;
    const done = await takeCrisisAction(actor, picked.value, { ...readProposal(scope, listed[picked.value]), onPass: () => { passed = true; } });
    return passed ? openCrisisMenu(actor) : done;
}

/**
 * What a crisis row unfolds into once picked: the facts the confirmation used to
 * list after the menu (E32+E07 C15), markup for `chooseVariant`'s `details`, or ""
 * when there is nothing to add to the row. The threshold and a Pin's disadvantage
 * stay in the row's own line, which every row shows; this says the rest.
 *
 *   - what the action costs: a resolution action's Sanity, a free take's too - the
 *     critical buys certainty about the dice, not the price (`takeCrisisAction`);
 *   - the statistics it lists, and who picks among several: the player proposes one
 *     under the row and the GM approves or changes it (trait-ruling.mjs `traitFor`; E68
 *     C4, DA18), or the player picks in the roll window with Resolve armed;
 *   - Breakdown's disadvantage (S02-31): `stateGrant` in roll-dialog.mjs sets it on
 *     every roll of a character with no Sanity left - a Despair opening fills the
 *     victim's - and the roll window showed it locked with nothing here saying why;
 *   - and what a miss does, under a label, so it does not read as what the action does.
 *
 * A free take and the third's decisions throw nothing, so only the price is said.
 *
 * TWO HALVES SINCE E49 A8.1 (11.11.2026): `crisisFacts` the lines, which go into the window's Details as the row's
 * layer (`chooseVariant`'s `facts`), and `crisisDetails` the whole hint alone, which the menu stacks under the lead
 * (its `details`, `drpg-variant-details`). Both exported for R3382.
 */
export function crisisFacts(def, { free, youPick, traits }) {
    const facts = [];
    if (def.kind === "resolution" && !def.noRoll) {
        facts.push(game.i18n.format("DRPG.Murder.briefCostStress", { n: RESOLUTION_STRESS_COST }));
    }
    if (!free && !def.noRoll) {
        const named = traits.map(t => TRAITS[t]?.label ?? t).join(" / ");
        if (traits.length > 1) {
            facts.push(game.i18n.format(youPick ? "DRPG.Murder.youPickTrait" : "DRPG.Murder.gmPicksTrait", { traits: named }));
        } else if (traits.length) {
            facts.push(game.i18n.format("DRPG.Action.usesTrait", { traits: named }));
        }
        if (def.failure) facts.push(game.i18n.format("DRPG.Murder.onAMiss", { text: esc(proseOf(def, "failure")) }));
    }
    return facts;
}

/**
 * What a row's one-sentence caption gave up (E68 C13): the action's whole hint, the picked row's details, which stand in
 * the left column under the briefing (E68 C12), stacked with the other rows' (E49 A8.1); or "".
 *
 * BREAKDOWN'S DISADVANTAGE STAYS IN SIGHT (E49 A8 fix, 11.11.2026; CI on 470eb255): A8.1 put it with the row's facts in
 * Details, shut by default, and a player chose a roll without reading that it would be thrown at disadvantage. It is
 * a condition that changes the roll about to be made, as Tamper's watchers are a price about to be paid (the owner's
 * answer 3 of 11.11: on top), so it stands here, under the lead, in the picked row's block, for a row that rolls.
 */
export function crisisDetails(def, { free = false, brokenDown = false } = {}) {
    const whole = def.short && def.hint ? `<p>${esc(proseOf(def, "hint"))}</p>` : "";
    const rolls = !free && !def.noRoll;
    return whole + (brokenDown && rolls ? `<p class="drpg-briefing-watched">${esc(game.i18n.localize("DRPG.Murder.breakdownDisadvantage"))}</p>` : "");
}

/**
 * Kill the person you just helped.
 *
 * A CONFIRMATION, AND THE OLD PANEL'S REASONS FOR NOT HAVING ONE DO NOT SURVIVE
 * THE MOVE. The tile used to say "Turn on your partner" in its own panel, so
 * what a click meant was written on the thing being clicked and a dialog in
 * front of it would have turned the newcomer's own decision into a request.
 *
 * Inside Direct Murder the label says "Direct Murder", and the same click means
 * three different things depending on the hour. Naming the partner before
 * anything happens is the whole of what the old tile's text was doing, and it
 * costs one press.
 *
 * The decision still belongs to the player - the GM is not asked. What goes to
 * the GM is the WRITE, like every other world change in this module.
 *
 * IN AN ECLIPSE IT IS A DECLARATION (E32 C5b, 28.09.2026; audit S02-24, S04-13, the
 * owner's Q3): it costs an action and opens when the Eclipse ends, like any action
 * declared there - so it goes the way `performDirectMurder` goes below: the confirmation
 * says so, no GM connected spends nothing, the action is paid, a note is asked, and a
 * declaration the GM's client did not park gives the action back. Until 1.2.66 the click
 * spent the offer and the GM's side then refused to open a murder in an Eclipse, so the offer
 * was lost with nothing declared (read at 1.2.65); since C5a it was refused with the offer
 * kept, and still nothing declared.
 */
export async function performBetrayal(actor, partner, def, options = {}) {
    const dark = isEclipse();
    const cost = dark && !options.free ? def.cost : 0;
    if (cost > 0 && !canAfford(actor, cost)) return null;
    /* THE BETRAYER PROPOSES THE OPENING'S STATISTIC (E68 C9, 10.11.2026; S18-10): the killer's opening lists Body and
       Hand, and the confirmation asks which, pre-checked on the first (`traitFieldHtml`), with how outside an Eclipse (in
       one, the declaration's sentence below says how). No GM's leave is asked for a betrayal, so the proposal goes with
       the incident to the opening's window, where a GM approves or changes it (murder-rules.mjs `openingTraitFor`).
       Merged into the line (10.11.2026): the confirmation is an action's window (`actionWindow`), what a betrayal is on
       the left and the field in the right column's statistic slot (`drpg-action-trait`), as every proposal since E68
       C12 (the owner's Q3 of round M); its two buttons are the question's, yes and Cancel. */
    const { listedTraits } = await import("./trait-ruling.mjs");
    const listed = listedTraits({ kind: "opening", key: "killer" });
    // Yes the primary, Cancel withdraws it (E21 C5a's question): the proposal, "cancel" or null.
    const confirmed = await actionWindow({
        classes: ["drpg-panel"],
        title: game.i18n.localize("DRPG.Murder.betrayalTitle"),
        brief: `<p>${game.i18n.format("DRPG.Murder.betrayalIntro", {
                third: esc(actor.name), killer: esc(partner.name)
            })}</p>
            <p class="notes">${game.i18n.localize("DRPG.Murder.betrayalRule")}</p>`,
        ask: `<form>${dark ? `<p>${game.i18n.localize("DRPG.Murder.betrayalConfirmEclipse")}</p>` : ""}
            <div class="drpg-action-trait">${traitFieldHtml(actor, listed, { propose: true, how: !dark })}</div></form>`,
        footer: {
            primary: { action: "yes", label: game.i18n.localize("DRPG.Dialog.yes"), callback: (e, b, d) => readProposal(d.element, listed) },
            close: "cancel"
        },
        rejectClose: false
    });
    if (!confirmed || confirmed === "cancel") return null;
    const { proposed = null, note: how = "" } = typeof confirmed === "object" ? confirmed : {};

    const { requestBetrayal } = await import("./gm-bridge.mjs");
    if (!dark) {
        const res = await requestBetrayal({ actorId: actor.id, note: how, proposed });
        if (!res.ok) return null;
        return game.user.isGM ? res.value : { pending: true };
    }

    const { gmOnline, sayNotDone } = await import("./bridge-guards.mjs");
    if (!game.user.isGM && !gmOnline()) {
        sayNotDone("murder.betrayal", "noGm", { nothingSpent: true });
        return null;
    }
    const paid = cost > 0 ? await spendAction(actor, cost) : null;
    if (cost > 0 && !paid) return null;

    const note = await promptForNote(actor, {
        title: game.i18n.localize("DRPG.Murder.betrayalTitle"),
        prompt: game.i18n.localize("DRPG.Action.murderPromptParked"),
        placeholder: game.i18n.localize("DRPG.Action.placeholder.directMurder")
    });

    // A player's client is answered `true` once the GM's has parked it; a GM's own, the row.
    const res = await requestBetrayal({ actorId: actor.id, note, proposed });
    if (!res.ok || !res.value) return abort(actor, paid);

    await whisperToOwner(actor,
        `${cardHead({ action: def.label })}<p>${game.i18n.localize("DRPG.Murder.betrayalParked")}</p>`);
    ui.notifications.info(game.i18n.localize("DRPG.Action.murderParkedToast"));
    return { parked: true };
}

/** Direct Murder: never automatic, always a conversation. */
export async function performDirectMurder(actor, def, options) {
    const cost = options.free ? 0 : def.cost;
    if (!canAfford(actor, cost)) return null;

    // No preview of the room. The guide's whole point is that you do not know
    // who else is standing in the dark with you - showing "you are alone with
    // X" or listing everyone present here would hand the killer the verdict
    // before they have even declared. `judgePendingMurders` (eclipse.mjs) reads
    // the room once, for real, after the Eclipse ends and the map has settled;
    // that is also the only moment the killer learns anything about it, in the
    // whisper it sends.
    const room = roomOfActor(actor);

    // The Eclipse's words alone (E41 C1a; audit S02-60): this runs only in an Eclipse - `performAction` refuses a
    // Direct Murder outside one (`DRPG.Eclipse.murderOnlyInEclipse`) and hands a betrayal to `performBetrayal` before
    // it - so the other key, `DRPG.Action.murderConfirm`, was never shown and is deleted.
    // A question on the kit's frame (E21 C5a). Its yes on the GM's road (E22 C5c; A4, audit S03-26): it parks the
    // declaration for a GM to rule on when the Eclipse ends, which the window's last line says.
    const confirmed = await drpgConfirm({
        yes: { role: "gmRoute", label: game.i18n.localize("DRPG.Dialog.yes") },
        classes: ["drpg-panel"],
        title: def.label,
        body: `${briefingBlock(actor, "directMurder", def)}
            <p class="notes">${game.i18n.localize("DRPG.Action.murderSpendsAnyway")}</p>
            <p>${game.i18n.localize("DRPG.Action.murderConfirmEclipse")}</p>`,
        rejectClose: false
    });
    if (!confirmed) return null;

    /*
     * THE ATTEMPT IS PARKED, NOT JUDGED.
     *
     * This used to read the room a second time, decide there and then, and hand
     * the GM a button that opened the incident immediately - in the middle of
     * the Eclipse. Three things were wrong with that, and they are one thing:
     * an Eclipse is a placement window, and nobody has finished placing.
     *
     *   · Everybody is crossing the map, so the moment the incident opened,
     *     the third-party watch fired on the first person to walk through the
     *     room. A corridor became a witness.
     *   · Hope Calls are locked while `isEclipse()` is true, so the victim of
     *     an incident opened during one had nothing to reach for.
     *   · The killer learned they had got away with it while half the cast had
     *     yet to move, so "alone with your victim" was decided on a snapshot of
     *     a room that was still filling up.
     *
     * So the declaration is stored and the answer waits for the lights. What
     * counts is where everyone ENDS UP: see `judgePendingMurders` in eclipse.mjs,
     * which runs as the Eclipse closes and opens the incident then - into a time
     * of day that has actually begun, with Calls available and the map settled.
     *
     * The action is spent here either way, which is the guide's rule and does
     * not change. What the player does not get here is the outcome.
     */
    // Before the action is spent: the declaration only exists once a GM's
    // client has written it, and with no GM connected `requestParkMurder`
    // refuses. Charging first and then telling the player "your move is made"
    // left them one action down with nothing declared anywhere.
    const { gmOnline, sayNotDone } = await import("./bridge-guards.mjs");
    if (!game.user.isGM && !gmOnline()) {
        sayNotDone("murder.park", "noGm", { nothingSpent: true });
        return null;
    }

    const paid = cost > 0 ? await spendAction(actor, cost) : null;
    if (cost > 0 && !paid) return null;

    /* THE KILLER PROPOSES THE OPENING'S STATISTIC WITH THE DECLARATION (E68 C9, 10.11.2026; S18-10, DA18): Body or
       Hand, under the sentence of how (the right column's statistic slot; the briefing on the left), and the GM's card answers "Allow: {stat}", "Change to: {stat}" or "Refuse"
       (eclipse.mjs `askGmToAllow`). The statistic allowed is the opening's at the lights, with no second window. */
    const { listedTraits } = await import("./trait-ruling.mjs");
    const { note, proposed } = await promptForNote(actor, {
        title: def.label,
        prompt: game.i18n.localize("DRPG.Action.murderPromptParked"),
        placeholder: game.i18n.localize("DRPG.Action.placeholder.directMurder"),
        traits: listedTraits({ kind: "opening", key: "killer" }),
        brief: briefingBlock(actor, "directMurder", def)
    });

    const { parkDirectMurder } = await import("./eclipse.mjs");
    const parked = await parkDirectMurder({ killerId: actor.id, room, note, proposed });
    if (!parked) {
        // The GM went away between the check and the write. Nothing was
        // declared, so nothing is owed - and a Burst that paid comes back as one.
        return abort(actor, paid);
    }

    await whisperToOwner(actor,
        `${cardHead({ action: def.label })}<p>${
            game.i18n.localize("DRPG.Action.murderParked")}</p>`);
    ui.notifications.info(game.i18n.localize("DRPG.Action.murderParkedToast"));

    return { parked: true, room };
}
