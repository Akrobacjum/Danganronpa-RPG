/**
 * Danganronpa RPG - Stage 6, the killer cleaning up.
 * ---------------------------------------------------------------------------
 * Guide: once the incident is over the killer can finally see the Remnants they
 * left, and spend Sanity trying to make them go away. "Przedmioty sprzątające
 * ułatwiają rozwiązanie morderstwa" - this is the stage the Cleaning Tool exists
 * for.
 *
 * Until now the module wrote `stage: "resolution"` and stopped. Everything the
 * stage needed was already modelled and unused: the `reinforced` flag on a
 * Remnant is documented in remnants.mjs as "cannot be removed by the killer in
 * Stage 6", `resolution` is a real Remnant type described as "left by the
 * killer's mistakes while cleaning up the scene", `RESOLUTION_STRESS_COST` is
 * declared, and `removeRemnant` refuses reinforced traces on its own. There was
 * simply nothing that called any of it. This is the missing half.
 *
 * WHY THE SCORING RUNS ON THE GM'S CLIENT. Same reason as Observe (see
 * observe.mjs): the threshold comes from how visible the trace is, which is a
 * flag on a hidden token - and Foundry ships every token to every client, so the
 * killer's own browser physically holds the answer. Their client picks a target
 * and throws the dice; the number travels here, and the verdict, the deletion
 * and the new trace are all produced on this side.
 *
 * WHAT IS NOT AUTOMATED. Whether the killer is standing in the right room, and
 * whether Stage 6 has gone on long enough - both the GM's, as everywhere else in
 * murder.mjs. This owns the numbers and the tokens.
 *
 * TWO DOORS INTO THE SAME ROOM - `viaAction`, added in E12.
 * ---------------------------------------------------------------------------
 * Everything here was reachable only from the Stage 6 panel, which made the
 * guide's own "akcje rozwiązania w Etapie 2" unreachable and made planting a
 * false trail a privilege of the killer. The Tamper tile is the second door,
 * and it is the SAME code: same rolls, same thresholds, same traces, same
 * verdicts. What differed used to be two things; since 29.08 it is one - the
 * PRICE is the same on both roads, and since T-1 (17.09) it is one chain rather
 * than two charges - and only the entry conditions still differ. `viaAction` is
 * what carries the difference:
 *
 *   WHO MAY.   Stage 6 asks `isCleaner` - this is your crime scene. The action
 *              asks nothing of the sort, but it does ask something Stage 6 does
 *              not: the trace you are erasing has to be one you have FOUND, or
 *              an incident trace you watched being made (ACT-02, see
 *              `cleanupRefusal`). A killer in their own Stage 6 may wipe
 *              anything in the room, including traces nobody has found yet.
 *   WHAT IT    `PRICE_CHAINS.tamper` on both roads: an action, or a Sanity mark
 *   COSTS.     when there is no action. The killer on their own night skips
 *              the action step (`tamperPriceSkip`, D3) and pays the mark.
 *
 * The concealment roll happens on BOTH routes, and it is the one thing that can
 * still cost Sanity outside Stage 6. That is not the tile's price being
 * understated - it is the cost of being watched, which is the entire risk of
 * the action, and removing it would make tampering in a crowded corridor safer
 * than tampering over a corpse while doing exactly the same thing.
 *
 * `viaAction` is a claim from a client, like every other flag that crosses the
 * bridge. It buys the sender nothing: it waives a check that would only ever
 * have refused them, and adds one - the found-it test above - that is verified
 * on this side against the ledger the sender cannot read.
 */

import { PRICE_CHAINS, ACTIONS } from "./config.mjs";
// The chain, and the one payer (T-1). Tamper's price is an action, or a Sanity
// mark when there is no action - never both, which is what this file used to do.
import { quotePrice, payPrice, refundPrice, paidLine, priceLabel } from "./price.mjs";
import { MODULE_ID, CLEANUP, RESOLUTION_STRESS_COST, REMNANT_VISIBILITY, REMNANT_VISIBILITY_LABELS, REMNANT_TYPES }
    from "./config.mjs";
import { getClock } from "./clock.mjs";
import { bodyDiscovery, seasonEpoch } from "./settings.mjs";
import { murderState, killerIds, blackenedIds, refOf, swungWeaponOf, spendFreeCleanup } from "./murder.mjs";
import { usedToolStore, blackenedStore, cleanupAttemptStore, caseMark } from "./gm-stores.mjs";
import {
    remnantsInRoom, remnantData, removeRemnant, dropRemnant, setRemnantPublic, tieState
} from "./remnants.mjs";
import { locateActor } from "./movement.mjs";
import { equippedFor, breakOnDespair } from "./use-items.mjs";
import { isMonokuma } from "./monokuma.mjs";
// What this character has copied into their inventory as a Truth Bullet, which
// is this module's only record of "they know this trace is there".
import { copiedRemnants, bulletsOf, secretOf, heldCopiesOf } from "./truth-bullets.mjs";
import { ITEM_FLAGS, isBroken, isStashed } from "./inventory.mjs";
import { resourceValue, resourceMax } from "./character.mjs";
import { trustedWrite } from "./resource-guard.mjs";
import {
    announce as announcePlain, whisperToGms, whisperToOwner as whisperToOwnerPlain,
    dialogContent, log, error, cardHead, isPrimaryGm, plural } from "./utils.mjs";

// Veiled, every one of them: a Stage 6 card's speaker is the killer and its
// audience is the incident, and the document must not say so. See murder.mjs.
const whisperToOwner = (actor, content, extra = {}) =>
    whisperToOwnerPlain(actor, content, { veiled: true, ...extra });
const announce = data =>
    announcePlain(data?.whisper?.length ? { veiled: true, ...data } : data);

const DialogV2 = foundry.applications.api.DialogV2;

/* ==========================================================================
 * WHO MAY CLEAN, AND WHAT
 * ========================================================================== */

/**
 * WHY this actor cannot clean, or null if they can.
 *
 * Four different situations used to collapse into one refusal - "You are not
 * the one cleaning up this scene" - and only one of them was that. A killer
 * standing over a body they had just killed with the GM's death tool was told
 * the scene was not theirs, which sent the GM looking for the wrong problem
 * entirely: the truth was that the incident had never reached Stage 6.
 *
 * Role reversal can have swapped the two sides mid-incident, so the killer is
 * read from the state rather than remembered from who opened the murder - the
 * person who ends up cleaning is whoever the state calls the killer when the
 * fight stopped.
 *
 * @returns {"noIncident"|"notYet"|"notYours"|"monokuma"|null}
 */
export function cleanupBlocker(actor) {
    const state = murderState();
    if (!state?.active) return "noIncident";
    if (state.stage !== "resolution") return "notYet";
    // Both of them, when there are two. An accomplice who joined the killers
    // during the incident stood in the room while it happened and leaves traces
    // of their own - refusing them the clean-up screen meant half a crime scene
    // could never be touched, and the accomplice was told "this is not your
    // scene to clean" about a murder they had just taken part in.
    if (!killerIds(state).includes(actor?.id)) return "notYours";
    // Guide, p. 26: "Jeśli Monokuma jest zabójcą, to nie ma on możliwości
    // sprzątania miejsca zbrodni - nie chce tego robić." A Monokuma who kills
    // is making a point, not covering their tracks.
    if (isMonokuma(actor)) return "monokuma";
    return null;
}

/** The killer of the incident currently in Stage 6, if this is them. */
export function isCleaner(actor) {
    return cleanupBlocker(actor) === null;
}

/** Is the victim's body in the same room as this killer? Read by the sheet. */
export function bodyIsHere(actor) {
    const victim = game.actors.get(murderState()?.victimId ?? "");
    if (!victim) return false;
    const mine = locateActor(actor);
    const theirs = locateActor(victim);
    return Boolean(mine?.room) && mine.room === theirs?.room;
}

/** Say which of the four it is, and refuse. @returns {null} always. */
function refuseCleanup(actor) {
    ui.notifications.warn(game.i18n.localize(
        `DRPG.Cleanup.blocked.${cleanupBlocker(actor) ?? "notYours"}`));
    return null;
}

/**
 * Every trace in the killer's own room that a clean-up could be aimed at.
 *
 * Reinforced ones are INCLUDED and marked, not filtered out. A killer who can
 * see the smear they cannot get rid of is being told something true and
 * important about their case; silently omitting it would read as "there is
 * nothing else here".
 *
 * @returns {Array<{token: TokenDocument, data: object, dc: number|null}>}
 */
export function cleanableRemnants(actor, where = null) {
    if (!actor) return [];

    const spot = where ?? locateActor(actor);
    if (!spot?.room) return [];

    return remnantsInRoom(spot.room, spot.scene)
        .map(token => {
            const data = remnantData(token);
            if (!data) return null;
            return { token, data, dc: data.reinforced ? null : cleanupDc(data.visibility, actor) };
        })
        .filter(Boolean)
        // Reinforced last: they are the ones that cannot be acted on.
        .sort((a, b) => {
            if (a.data.reinforced !== b.data.reinforced) return a.data.reinforced ? 1 : -1;
            return (a.dc ?? 0) - (b.dc ?? 0);
        });
}

/**
 * What a killer's own client may know about a trace: which one it is, a label
 * built from what Stage 6 already lets them see, and whether it can be acted
 * on at all. GM-side only - this is the function `requestCleanableTraces` (in
 * gm-bridge.mjs) actually calls, on behalf of a killer's client that cannot
 * run `cleanableRemnants` itself and get anything back from it.
 *
 * The DC (`cleanupDc`) and `tiedToCrime` never leave this function - that is
 * the answer key `openCleanupDialog` used to have no business rendering
 * client-side and now has no way to, because it never receives them. The label
 * is built from `visibilityLabel`/`typeLabel` for the killer at Stage 6, which
 * the guide already gives them - see the note on `openCleanupDialog` - and off
 * it from the character's own copy (E05 C14, below).
 */
export function cleanableTracesForPlayer(actorId, { mine = false } = {}) {
    const actor = game.actors.get(actorId);
    if (!actor) return [];

    /*
     * `mine` IS THE TAMPER ACTION, AND IT CANNOT BE ASKED ANYWHERE ELSE.
     *
     * Which traces are yours is `sourceActor` in the Remnant ledger, which is a
     * client-scoped setting on GM browsers - see remnants.mjs. A player's own
     * client physically cannot answer "what did I leave in this room", however
     * reasonable a question that is about their own character, which is why
     * this list is built here and travels back over the bridge.
     *
     * TWO FILTERS, NOT ONE - AND THE SECOND IS THE POINT (Dawid, 28.08).
     *
     * `sourceActor` alone said "you left it". `copiedRemnants` says "and you
     * know it is there". Without the second, Tamper was a trace detector: open
     * the menu, read the list, and learn exactly what you left in this room and
     * how visible it is - for free, before spending anything, and including
     * traces the character has no idea exist. A player could sweep the map
     * opening Tamper in every room.
     *
     * Stage 6 is the deliberate exception and takes the other branch: the guide
     * opens the killer's eyes to their own scene there, and that is a privilege
     * of the stage rather than of the character.
     *
     * So the loop the game actually wants becomes the loop the game requires:
     * Observe -> "follow my traces" copies one into your inventory as a Truth
     * Bullet, and the Bullet is the record of knowing. Erasing a trace you
     * never found is not a thing you can do, because finding it is the action
     * that costs something.
     *
     * Note what a player still does not get either way: a LIST, not tokens.
     * Being able to erase your own trace is not being able to see it on the map.
     */
    /*
     * THE SECOND FILTER BRANCHES BY TYPE NOW (D11).
     *
     * "You left it AND you found it" was written against a player sweeping the
     * map with the Tamper menu to learn what they had left lying around. That
     * is still the right rule for PREPARATION traces - the project you built,
     * the weapon you took out of a Search - because nobody watched you make
     * those and finding them really is an action.
     *
     * It was the wrong rule for the crime scene. You were standing there. The
     * traces of the incident were made in front of you, which is why their
     * tokens are now visible to you (see `placeRemnant` and
     * `applyToRemnantToken`), and requiring an Observe to "find" what you
     * watched happen was asking a character to discover their own memory.
     *
     * So an incident trace of your own needs no `known`; everything else still
     * does. Stage 6 keeps its own branch below and is unchanged: the guide
     * opens the killer's eyes to the WHOLE room there, other people's traces
     * included, and that is a privilege of the stage rather than of memory.
     */
    /*
      * SEEING IT IS THE ENTITLEMENT, NOT HAVING LEFT IT (Dawid, 31.08).
      *
      * The filter used to be `sourceActor === actor.id`: your own traces and
      * nobody else's. That made Tamper a killer's tool, and it does not need to
      * be - an investigator who found a trace should be able to destroy it, an
      * accomplice should be able to tidy after somebody else, and a person who
      * turns up their own name in the evidence should be able to do something
      * about it. All of it costs an action and leaves its own Tamper trace,
      * which is what keeps it a decision rather than a free erase.
      *
      * The test is now exactly the one that decides whether the token is on
      * your screen at all - see `applyToRemnantToken` in visibility.mjs. You
      * hold a copy, or you were standing in the incident that made it. What was
      * protected before is still protected: a trace nobody has found is a trace
      * nobody can reach, so the Tamper menu is still not a trace detector.
      */
    /*
     * THE WHOLE ROOM IS STAGE 6'S, AND THIS SIDE DECIDES WHETHER IT IS STAGE 6
     * (E03, 24.09.2026; audit S05-04). `mine` came from the asking client,
     * which works out `isCleaner` for itself - so a forged `false` handed any
     * player every trace in the room they stood in, with its type, its
     * visibility and whether it was reinforced: the Tamper menu as the trace
     * detector the note above says it is not, and without an Observe or an
     * Analyze. The unfiltered list goes to the killer of the incident that is
     * in Stage 6, and to nobody else, whatever the request says.
     */
    const unfiltered = !mine && isCleaner(actor);
    const known = copiedRemnants(actor);
    const watched = incidentParticipant(actor);
    const wanted = !unfiltered
        ? cleanableRemnants(actor).filter(t =>
              known.has(t.token.id) || (t.data.type === "incident" && watched))
        : cleanableRemnants(actor);

    /*
     * A TRACE OF YOUR OWN IS NAMED BY YOUR OWN COPY (E05 C14, 27.09.2026; audit S05-14).
     * Every row was labelled with the trace's band and its real category off the ledger -
     * "Subtle Incident Remnant": an investigator holding an unanalysed copy opened Tamper,
     * which costs nothing until a road is picked, and read the category an Analyze exists to
     * price; and a reshaped trace's category said that somebody had reworked it. Off Stage 6
     * a trace this character holds a copy of is labelled by that copy's name, which is theirs
     * already, and by nothing of the ledger (`DRPG.Tamper.yourCopy`). One they watched being
     * made keeps its label: only the running incident's own traces reach this list that way,
     * and its category is the incident they stood in. Stage 6's whole room keeps the whole
     * label - the guide opens the killer's eyes to their own scene.
     */
    const copies = unfiltered ? null : copyNamesOf(actor);
    return wanted.map(t => {
        const copy = copies?.get(t.token.id);
        return {
            id: t.token.id,
            label: [
                copy !== undefined ? game.i18n.format("DRPG.Tamper.yourCopy", { name: copy }) : `${t.data.visibilityLabel} ${t.data.typeLabel}`,
                t.data.reinforced ? game.i18n.localize("DRPG.Cleanup.reinforcedFlag") : null
            ].filter(Boolean).join(" · "),
            reinforced: Boolean(t.data.reinforced)
        };
    });
}

/**
 * The name of this character's own copy of each trace they hold one of, by the trace's
 * token id - the id `copiedRemnants` answers by, so every trace that list lets through
 * has a name here. The first copy's, if they hold two. GM-side, like the rows it reads.
 */
function copyNamesOf(actor) {
    const names = new Map();
    for (const item of bulletsOf(actor)) {
        const id = secretOf(item.uuid).remnantId;
        if (id && !names.has(id)) names.set(id, item.name);
    }
    return names;
}

/**
 * How hard this trace is to erase, with the tool in hand taken off the top.
 *
 * Only an EQUIPPED Cleaning Tool counts, matching the weapon rule in murder.mjs:
 * the guide's tools are objects in a hand, not entries on an inventory list.
 */
/**
 * Was this character standing in the incident that is running?
 *
 * The GM-side twin of `myIncidentTrace` in visibility.mjs, and deliberately the
 * same set: the victim, the killer, and an accomplice who threw in with them. A
 * third party who merely walked in is a witness, and a witness has to find a
 * trace like everybody else.
 */
function incidentParticipant(actor) {
    try {
        const state = murderState();
        if (!state?.active || !actor?.id) return false;

        const ids = new Set([state.victimId, state.killerId].filter(Boolean));
        if (state.thirdId && state.thirdSide === "killer") ids.add(state.thirdId);
        return ids.has(actor.id);
    } catch {
        return false;
    }
}

export function cleanupDc(visibility, actor) {
    const base = CLEANUP.dc[visibility];
    if (base === undefined) return null;
    const tool = CLEANUP.toolTierReducesDc ? cleaningTier(actor) : 0;
    return Math.max(0, base - tool - freshSceneBonus());
}

/**
 * −3 while the body is still lying where it fell (Z5).
 *
 * Read off the world rather than stored here, because the world already carries
 * this fact and one fact with two homes is one fact that will disagree with
 * itself: `discoverBody` writes `SETTINGS.bodyFound`, and that IS the moment
 * the corridor fills with people. The phase is the second half of the same
 * answer, for the stretch after the record has been cleared.
 *
 * Exported so the briefing can say WHY the number in front of the player is
 * lower than the one in the handbook. A discount nobody is told about is not a
 * discount, it is a bug they will report.
 */
export function freshSceneBonus() {
    const rule = CLEANUP.freshScene;
    if (!rule?.bonus) return 0;
    try {
        // THE CORRIDOR IS FULL OF PEOPLE THE MOMENT THE BODY IS FOUND, and
        // since D5 that is no longer the same event as the phase moving. The
        // record is cleared when Stage 7 starts, which is exactly when the
        // phase read below takes over.
        if (bodyDiscovery()) return 0;
        const phase = getClock().phase;
        return rule.until?.includes(phase) ? 0 : rule.bonus;
    } catch {
        // No clock is not a fresh scene. Failing towards the harder number is
        // the safe direction: it never hands out a discount nobody earned.
        return 0;
    }
}

/** The tier of the readied Cleaning Tool, or 0 for bare hands. */
export function cleaningTier(actor) {
    const tool = equippedFor(actor, "cleaningTool");
    if (!tool) return 0;
    return Number(tool.getFlag(MODULE_ID, ITEM_FLAGS.tier) ?? 0);
}

export function cleaningTool(actor) {
    return equippedFor(actor, "cleaningTool");
}

/**
 * THE GLOVES ARE WRITTEN DOWN WHEN THEY ARE USED (E32+E07 C12, 02.10.2026; audit S05-38; the
 * owner's D13, "the Cleaning Tool remembered like the weapon"). The discovery breaks the
 * Cleaning Tools a clean-up used, and until 1.2.66 it read them off the killers' hands at the
 * moment the body was found: one click putting the gloves away after the clean-up kept them
 * whole through the discovery. So the tool readied at an attempt the GM scores goes into the
 * GMs' `usedTools` row of the character, with the clock's chapter and season - every attempt
 * and every tool, since several rags are as much evidence as one.
 *
 * A KILLER'S ATTEMPT ONLY: the running incident's killers (`killerIds`, the Stage 6 clean-up)
 * and this chapter's Blackened (a Tamper after the close). The guide breaks the killer's tool,
 * as the swing memo remembers only a fight's weapon; an investigator who scrubs a trace with
 * their own gloves on an ordinary afternoon is not made to lose them when a body turns up.
 *
 * A row of another chapter or season is started again. Read after the store has heard the
 * other GMs (as `applyRecordedMove` reads its row), so another GM's tool is kept, and written
 * with no await between the read and the patch. GM-side; a failed write is logged and the
 * attempt is scored anyway - the discovery then falls back on the hand, as it always did.
 *
 * WITH THE BODIES IT CLEANED UP AFTER (E32+E07 fix r2-G3, 03.10.2026; the round-2 review's
 * C2-m2): `victims`, the running incident's victim for its killers, a Blackened's register row's
 * victims after the close - so the discovery breaks the gloves of the bodies it found, and not
 * a betrayer's whose victim nobody has found yet (`destroyCleaningTools`).
 *
 * The tool is read off `asHeld`: the character as the GMs hold its items, on a GM's attempt (E29 fix r2-H20,
 * `resolveCleanup`'s note); a tool a player's write made, readied or kept whole is not the one written down.
 */
async function noteCleaningTool(actor, asHeld = actor) {
    const tool = cleaningTool(asHeld);
    if (!game.user.isGM || !tool) return;
    const state = murderState();
    const running = killerIds(state).includes(actor.id);
    if (!running && !blackenedIds().includes(actor.id)) return;
    try {
        await usedToolStore.whenHydrated();
        const chapter = getClock()?.chapter ?? null, epoch = seasonEpoch();
        const row = usedToolStore.get(actor.id);
        const held = isThisChapters(row) ? row.cleaning : [];
        const had = isThisChapters(row) && Array.isArray(row.victims) ? row.victims : [];
        const after = running ? [state.victimId] : blackenedStore.get(actor.id)?.victims ?? [];
        const victims = [...new Set([...had, ...after.filter(id => typeof id === "string" && id)])];
        if (held.includes(tool.id) && victims.length === had.length) return;
        await usedToolStore.patch(actor.id, { chapter, epoch, cleaning: [...new Set([...held, tool.id])], victims });
    } catch (err) {
        error(`Could not write down the Cleaning Tool ${actor.name} used`, err);
    }
}

/** Is this `usedTools` row of the clock's chapter and season? */
function isThisChapters(row) {
    return row?.chapter === (getClock()?.chapter ?? null) && (row.epoch ?? 0) === seasonEpoch()
        && Array.isArray(row.cleaning);
}

/** One Remnant token by id, from whichever scene it is on. */
function findRemnantToken(tokenId) {
    if (!tokenId) return null;
    for (const scene of game.scenes) {
        const token = scene.tokens.get(tokenId);
        if (token) return token;
    }
    return null;
}

/* ==========================================================================
 * THE ROLL - player side
 * ========================================================================== */

/**
 * THE STATISTIC A CLEAN-UP ROLLS IS THE GM'S PICK (E32+E07 C11c, 02.10.2026; audit S04-23,
 * the owner's Q4 as corrected on 28.09). Stage 6's rolls list three - Shadow / Hand / Head
 * (`CLEANUP.traits`), which an erase and a misleading trail roll - and threw the first,
 * Shadow, with nobody asked; moving the body lists its own Body alone. A GM picks now
 * (trait-ruling.mjs `traitFor`: a card in the player's thread, or a window on a GM's
 * browser; with Resolve armed the roll window's picker), and the caller asks before the
 * concealment and the price, so a refusal costs nothing. The same rolls
 * through Tamper's door (`viaAction`, any afternoon) are Tamper's, which lists Shadow
 * alone (`ACTIONS.tamper`): nobody is asked - and the GM's judgement of a ruling
 * (bridge-guards.mjs `guardTraitRuling`) takes one for Stage 6's cleaner alone.
 * `{ trait, byGm }`, or null when there is to be no roll.
 */
async function cleanupTrait(actor, key, viaAction) {
    if (viaAction) return { trait: ACTIONS.tamper.traits[0], byGm: false };
    const { traitFor } = await import("./trait-ruling.mjs");
    return traitFor(actor, { kind: "cleanup", key });
}

/**
 * Attempt to erase one trace.
 *
 * Costs Tamper's price chain (T-1): an action, or a Sanity mark when there is no
 * action. The killer on their own night starts at the mark, as the guide has it:
 * Stage 6 is not part of the day's economy, and a killer with nothing left to
 * give simply cannot keep scrubbing. Refused before the dice when the chain
 * cannot be paid, so nobody rolls for something they cannot pay for.
 *
 * The threshold is not computed here and never travels to this client - see the
 * note at the top of the file. What goes over the socket is which token was
 * aimed at and what the dice said.
 */
export async function attemptCleanup(actor, tokenId, {
    viaAction = false,
    /*
     * "erase" or "transform" (Z5). One function for both because everything
     * around the roll is the same job: the same trace, the same ownership and
     * found-it tests, the same Sanity, the same receipt, the same card. What
     * differs is three lines - the threshold gets a discount, the verdict
     * relabels instead of deleting, and the title says which was attempted.
     *
     * A second `attemptTransform` would have been a copy of ninety lines with
     * three changed, and the two would have parted company at the first guard
     * somebody remembered to add to only one of them.
     */
    mode = "erase",
    /** What the player is trying to turn it into. See `askTransformChange`. */
    change = null
} = {}) {
    if (!actor || !tokenId) return null;

    // Whose scene this is, is Stage 6's question and only Stage 6 asks it.
    if (!viaAction && !isCleaner(actor)) return refuseCleanup(actor);

    /*
     * ONE PRICE ON BOTH ROADS, AND ONLY ONE (T-1, Dawid 17.09).
     *
     * Tamper used to cost an action AND a Sanity mark - the action here, the mark
     * on the GM's side - which made the tile more expensive than the stage rule
     * it was standing in for. It is a chain now: an action, or a Sanity mark when
     * there is no action, and the killer on their own night starts at the mark.
     *
     * THE ORDER IS THE RULE. Refused before the dice, because an action that
     * takes a price it cannot take either forgives it silently or breaks somebody
     * down; and PAID AFTER the concealment, because the concealment's own Sanity
     * can take the very point the price was going to use - which `payPrice`
     * notices, because it quotes again for itself.
     */
    const { gmOnline, sayNotDone } = await import("./bridge-guards.mjs");
    if (!gmOnline()) {
        // Nothing scores this without a GM: the roll would be thrown and the
        // packet dropped, and since T-1 there is no GM-side charge left to be the
        // backstop either. Said in the bridge's own words (E31).
        sayNotDone("murder.cleanup", "noGm", { nothingSpent: true });
        return null;
    }

    const watched = await tamperWatchBlock(actor);
    if (watched) {
        ui.notifications.warn(watched);
        return null;
    }

    const quote = tamperQuote(actor);
    if (quote.blocked) {
        ui.notifications.warn(quote.blocked);
        return null;
    }

    // The statistic, before anything is rolled or paid (`cleanupTrait`).
    const ruled = await cleanupTrait(actor, "cleanup", viaAction);
    if (!ruled) return null;

    // Somebody is watching. Cover it before you do it - and learn the answer
    // while there is still a choice about how to behave afterwards. Nothing has
    // been charged yet, so a closed concealment window costs nothing (ACT-04).
    const cover = await concealFromWitnesses(actor);
    if (!cover) return null;

    const charge = await chargeTamper(actor);
    if (!charge) {
        // The cover story took the point this attempt was going to cost. The
        // concealment's Sanity stays spent - that is the price of being watched.
        ui.notifications.warn(game.i18n.localize("DRPG.Cleanup.priceGone"));
        return null;
    }

    const { rollTrait } = await import("./action-rolls.mjs");
    const calls = await import("./call-effects.mjs");

    // The tool in hand is worth advantage on top of the threshold it lowers -
    // the guide's "ułatwiają" applied to both halves of "easier".
    const tool = cleaningTool(actor);
    if (CLEANUP.toolAdvantage && tool) calls.armSituational(1);

    // The number this roll will be scored against, on the window (D1): the
    // same reading `settle` makes below, made once more before the dice.
    const dcShown = (() => {
        try {
            const data = remnantData(findRemnantToken(tokenId));
            if (!data || data.reinforced) return null;
            const base = cleanupDc(data.visibility, actor);
            const relief = mode === "transform" ? (CLEANUP.transformAction?.dcRelief ?? 0) : 0;
            return base === null ? null : Math.max(0, base - relief);
        } catch { return null; }
    })();

    let roll;
    try {
        roll = await rollTrait(actor, ruled.trait, {
            dc: dcShown,
            byGm: ruled.byGm,
            // `cleanupKey` and `cleanupVia` ride along so a Reroll can tell the
            // three Stage 6 actions apart. Without them the bookmark said only
            // "cleanup" and a rerolled misleading trail was replayed as an
            // erase against a token id that was really an action name.
            actionKey: "cleanup",
            context: {
                cleanup: tokenId,
                cleanupKey: mode === "transform" ? "transformTrace" : "eraseTrace",
                // What was declared before the dice, so a Reroll can declare it
                // again. Without it a replayed transform would arrive with
                // nothing to apply and quietly do nothing - the exact failure
                // `cleanupKey` was added to stop, one road further along.
                cleanupChange: change,
                cleanupVia: viaAction,
                // WHICH STEP PAID, so a critical hands back the same one and a
                // Reroll replays the same claim (T-1).
                cleanupPrice: charge.pay,
                cleanupGrant: Boolean(charge.grant)
            },
            title: game.i18n.localize(mode === "transform"
                ? "DRPG.Cleanup.transformAction"
                : viaAction ? "DRPG.Tamper.coverAction" : "DRPG.Cleanup.action")
        });
    } finally {
        calls.clearSituational();
    }
    // A closed window is not an attempt (CASE-15): the price comes back - unless
    // a concealment roll has already paid out, see `releaseTamper`.
    if (!roll) return releaseTamper(actor, charge, { rolled: cover === "rolled" });

    // One crime scene, one set of gloves - and Despair is what wears them out
    // early. The reference was taken before the dice; see `breakOnDespair`.
    await breakOnDespair(actor, tool, roll);

    // G-20. Only on a critical, and only if the table's rules still allow it -
    // read from config rather than assumed, so turning the permission off is one
    // field rather than a code change.
    // Only on the erase road. On the transform road the player already said
     // what they were trying to do, before the dice - asking again after a
     // critical would be asking them to choose twice for one action.
    const transform = mode !== "transform" && roll.isCritical
        && CLEANUP.outcome.critical?.mayTransform
        ? await askTransform(actor)
        : null;

    const { requestCleanup } = await import("./gm-bridge.mjs");
    const { rollInHand } = await import("./action-rolls.mjs");
    await requestCleanup({
        actorId: actor.id,
        tokenId,
        // The roll the GMs' fact of the attempt goes on (fix r1-G2).
        rollId: rollInHand(actor)?.messageId ?? null,
        total: roll.total,
        isCritical: Boolean(roll.isCritical),
        withHope: Boolean(roll.withHope),
        transform,
        key: mode === "transform" ? "transformTrace" : "eraseTrace",
        change,
        viaAction,
        // What paid, so the GM's side does not charge a second time and a critical
        // gives back the step that was really taken (T-1).
        price: charge.pay,
        grant: Boolean(charge.grant)
    });

    return { roll };
}

/**
 * G-20: on a critical, erase it - or leave something arguing for another story.
 *
 * ASKED HERE, NOT GM-SIDE, and for the reason a critical Strike's target is:
 * this is the killer's decision about the story they are telling, and the GM's
 * client has no way to guess it. The dice are still on screen when it opens.
 *
 * ERASE IS NO LONGER WHAT ENTER PRESSES (E09 C11, 08.10.2026; audit S05-50).
 * It was the first button and the default, on the argument that a player who
 * did not want a second decision got the ordinary answer by pressing on - and
 * Enter in the name field, pressed by a player moving on to the description,
 * erased the trace they were halfway through rewriting. Enter in a field moves
 * to the next one now (`enterMovesOn`), "Leave something else" is the first
 * button, so what a browser's own submission presses can never be the erase,
 * and the player who wants no second decision closes the window, which has
 * always meant the same erase.
 *
 * AN UNFINISHED FORM ASKS AGAIN. One field filled and "Leave something else"
 * pressed used to warn and answer null - which is the erase, so the trace went
 * while the toast asked for the second field. The window opens again holding
 * what was typed; Erase and closing are the ways out.
 *
 * THE SAME RESHAPE AS THE TAMPER ROAD, ASKED LATER (Dawid, 29.08). It used to
 * offer a type menu, and it stopped for the reason argued in
 * `CLEANUP.transformAction`: the lie a killer tells is a sentence. What this
 * road keeps that the other does not is the BAND - a critical earned the right
 * to say how loudly the fake reads, which is a real choice and the reward for
 * rolling that well. Exported for the suite.
 *
 * @returns {Promise<object|null>} `{ name, text, visibility }`, or null for "erase it".
 */
export async function askTransform(actor) {
    const { REMNANT_VISIBILITY_LABELS } = await import("./config.mjs");
    const rules = CLEANUP.transform ?? {};
    const bands = rules.visibilities ?? [];
    const limits = CLEANUP.transformAction?.limits ?? {};
    if (!bands.length) return null;

    let typed = { name: "", text: "", visibility: bands[0] };
    for (;;) {
        const options = bands
            .map(key => `<option value="${key}"${key === typed.visibility ? " selected" : ""}>${
                foundry.utils.escapeHTML(REMNANT_VISIBILITY_LABELS[key] ?? key)}</option>`)
            .join("");

        const picked = await DialogV2.wait({
            window: { title: game.i18n.localize("DRPG.Cleanup.transformTitle") },
            classes: ["drpg-panel", "drpg-narrow"],
            content: dialogContent(`<form>
                <p>${game.i18n.localize("DRPG.Cleanup.transformIntro")}</p>
                ${reshapeFields(limits, typed)}
                <label>${game.i18n.localize("DRPG.Cleanup.transformVisibility")}
                    <select name="visibility">${options}</select></label>
                <p class="notes">${game.i18n.localize("DRPG.Cleanup.transformNote")}</p>
            </form>`),
            buttons: [
                {
                    action: "change", label: game.i18n.localize("DRPG.Cleanup.transformChange"), default: true,
                    callback: (e, b, d) => ({
                        name: d.element.querySelector("[name=name]").value,
                        text: d.element.querySelector("[name=text]").value,
                        visibility: d.element.querySelector("[name=visibility]").value
                    })
                },
                {
                    action: "erase", label: game.i18n.localize("DRPG.Cleanup.transformErase"),
                    callback: () => null
                }
            ],
            render: (event, dialog) => enterMovesOn(dialog),
            rejectClose: false
        });

        // "erase" comes back as null, and so does closing the window - which is the
        // same answer and should be: backing out of a bonus question must not cost
        // the critical that earned it.
        if (!picked || picked === "erase") return null;

        const name = plainText(picked.name, limits.name ?? 60);
        const text = plainText(picked.text, limits.text ?? 400);
        if (name && text) return { name, text, visibility: picked.visibility };
        ui.notifications.warn(game.i18n.localize("DRPG.Cleanup.reshapeNeedsBoth"));
        typed = { name: picked.name ?? "", text: picked.text ?? "", visibility: picked.visibility ?? bands[0] };
    }
}

/** The two fields of a reshape, holding what was typed when the window opens again. */
function reshapeFields(limits, typed = {}) {
    const esc = value => foundry.utils.escapeHTML(String(value ?? ""));
    return `<label>${game.i18n.localize("DRPG.Cleanup.reshapeName")}
                <input type="text" name="name" maxlength="${limits.name ?? 60}" value="${esc(typed.name)}" autofocus
                    placeholder="${game.i18n.localize("DRPG.Cleanup.reshapeNamePlaceholder")}" /></label>
            <label>${game.i18n.localize("DRPG.Cleanup.reshapeText")}
                <textarea name="text" rows="3" maxlength="${limits.text ?? 400}"
                    placeholder="${game.i18n.localize("DRPG.Cleanup.reshapeTextPlaceholder")}">${esc(typed.text)}</textarea></label>`;
}

/**
 * Enter in a reshape's one-line fields moves to the next field, and never answers the window.
 *
 * WHY THESE TWO WINDOWS DO IT THEMSELVES (E09 C11, 08.10.2026; audit S05-50). DialogV2 puts the content and the
 * footer in one form and its footer buttons are submits, so Enter in the name field is the browser's implicit
 * submission, which presses the first submit in tree order (read in the code and in `guardTextFields`'s note, not
 * measured here: jsdom does not submit a form on a synthetic key). In the critical's window that was Erase, and in
 * the Tamper's it sent the description empty. `guardTextFields` (utils.mjs) has no rule for "move on": its
 * `data-drpg-enter` presses a button, which is the very thing this must not do. The description is a textarea, where
 * Enter is a new line; the band's select moves on to the footer, whose focused button Enter then presses as a
 * button, on purpose.
 */
function enterMovesOn(dialog) {
    const root = dialog?.element;
    if (!root) return;
    root.addEventListener("keydown", event => {
        if (event.key !== "Enter" || event.isComposing) return;
        const field = event.target;
        if (!field?.matches?.("input, select")) return;
        event.preventDefault();
        const order = [...root.querySelectorAll("input, textarea, select, footer button")].filter(el => !el.disabled);
        order[order.indexOf(field) + 1]?.focus();
    });
}

/**
 * A player's sentence, made safe to store and print.
 *
 * THIS IS THE ONLY FREE TEXT A PLAYER WRITES INTO THE WORLD in this module, so
 * it is the only place that needs this, and it is worth being exact about what
 * each step is for rather than reaching for a general-purpose "sanitise".
 *
 *   tags stripped   - the value ends up in a token's `name` and in a chat card.
 *                     Foundry escapes most of those paths and this module escapes
 *                     the rest, but a string that has crossed a socket from a
 *                     client should not be relying on every future reader
 *                     remembering to escape it. Removed at the boundary, once.
 *   runs collapsed  - a name made of four hundred newlines is a name that breaks
 *                     the layout of whatever prints it.
 *   length capped   - `CLEANUP.transformAction.limits`. A socket packet is not
 *                     bounded by the `maxlength` on the input that was supposed
 *                     to produce it.
 *
 * Empty in, empty out, and callers read empty as "they did not fill this in".
 */
export function plainText(value, max) {
    return String(value ?? "")
        .replace(/<[^>]*>/g, " ")
        /* AND EVERY ANGLE BRACKET LEFT OVER (E02, 24.09.2026; audit S05-05). The
           pattern above only matches a CLOSED tag, so `<img src=x onerror=alert(1)//`
           - 29 characters, inside the 60 a name may have - came through whole,
           was printed into the GM's secret card by `innerHTML`, and ran there with
           the GM's permissions. Measured. Nothing a killer writes on a trace needs
           either character. */
        .replace(/[<>]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, Math.max(0, max));
}

/**
 * Write the killer's story onto a trace. GM-side, and the ONLY writer.
 *
 * Both reshape roads end here - the Tamper action's own (declared before the
 * dice) and the erase road's critical bonus (offered after them) - because the
 * two differ only in when the question is asked. Everything after the answer is
 * the same job, and the file has already been bitten once by two branches that
 * were supposed to stay in step and did not.
 *
 * TWO WRITES, AND THEY ARE DIFFERENT KINDS OF FACT. `retuneRemnant` moves what
 * the trace IS - type and band - which is engine state the GM reads.
 * `setRemnantPublic` moves what it SAYS, which is the answer a finder gets. The
 * ledger's own `label` is untouched by both, so the GM keeps a true reading of
 * a trace the killer has lied about: that asymmetry is the whole point of the
 * remnant architecture and this is the feature that exercises it hardest.
 *
 * The undo snapshot carries both, or a Reroll would put the type back and leave
 * the killer's sentence standing on a roll that no longer produced it.
 *
 * THE TRACE, NOT THE COPIES ALREADY HELD (E09 C9, 08.10.2026; audit S05-24). The words
 * went on through `propagateRemnantPublic` to every Truth Bullet copied from the trace,
 * so an approved reshape renamed and reworded what other players had found and read -
 * measured in scenario 62's phase T at the code before C9 (08.10.2026): p1's copy, found
 * and analysed before p2's reshape, read the reshaped name and words, and so did p2's own.
 * A copy is what its finder found; the reshape is what the next finder finds. The ledger
 * takes the story, the copies keep theirs (`propagate: false`), and the card the GMs
 * approve says how many that is (`reshapeCardParts`). Tier 2 "a reshape leaves the copies
 * already held".
 */
async function reshapeTrace(token, data, {
    name = "", text = "", softer = null, tie = false, receipt = null, done = []
} = {}) {
    const { retuneRemnant, setRemnantPublic, remnantData } = await import("./remnants.mjs");
    const { REMNANT_VISIBILITY_LABELS, REMNANT_TYPES } = await import("./config.mjs");

    const patch = { type: CLEANUP.transformAction?.becomes ?? "resolution" };
    if (softer) patch.visibility = softer;

    /*
     * A TRACE THE KILLER RESHAPED IS THE KILLER'S (D2).
     *
     * Reshaping is the one road that changes what a trace is, so it is also the
     * one road that could launder a tie away. `retuneRemnant` writes the fields
     * it is given and nothing else, so an already-tied trace survives by
     * construction - trap 163's shape. What is added is the other direction: a
     * killer who reshapes an untied trace ties it, because they have now handled
     * it as part of their crime. An innocent doing the same in Tamper leaves it
     * exactly as untied as they found it.
     */
    if (tie && !data.tiedToCrime) patch.tiedToCrime = true;

    /*
     * THE AFTER-ANALYSIS SENTENCE IS NOT TOUCHED, AND THAT IS THE DECISION (T-2).
     *
     * A reshape changes what a trace IS - an Incident Remnant becomes a Tamper
     * Remnant - and what a finder reads about it. It does not change the object,
     * and the GM's sentence about the object goes on being true: a killer who
     * rewrote a smear has not altered what analysing it would reveal. So the
     * `story` below never carries `analyzedText`, and `setRemnantPublic` merges
     * rather than replaces, so the sentence survives the reshape as the GM wrote
     * it. A reader who finds it missing from this patch has found the rule rather
     * than an oversight.
     */
    if (receipt) {
        receipt.transformed = {
            id: token.id,
            sceneId: token.parent?.id ?? null,
            // The tie with the type (E08+E28 C3; audit S05-44): a killer's reshape ties an
            // untied trace (above), and a Reroll that took the reshape back left it tied. As one
            // of its three states since E09 C4 (remnants.mjs `tieState`): undecided goes back
            // undecided, where `Boolean()` put it back as a GM's "not tied".
            from: { type: data.type, visibility: data.visibility, tiedToCrime: tieState(data.tiedToCrime) },
            publicFrom: remnantData(token)?.public ?? null
        };
    }

    await retuneRemnant(token.parent?.id ?? null, token.id, patch);

    // Only the halves they actually filled in. Passing an empty string would
    // overwrite a description the GM had already written for a finder.
    const story = {};
    if (name) story.name = name;
    if (text) story.playerText = text;
    if (Object.keys(story).length) await setRemnantPublic(token, story, { propagate: false });

    done.push(game.i18n.format("DRPG.Cleanup.reshaped", {
        from: `${data.visibilityLabel} ${data.typeLabel}`,
        band: REMNANT_VISIBILITY_LABELS[patch.visibility ?? data.visibility]
            ?? data.visibilityLabel,
        kind: REMNANT_TYPES[patch.type]?.label ?? patch.type,
        // Escaped where it is printed as well as cleaned where it arrived: the card
        // is drawn with `innerHTML` on the GM's screen (S05-05).
        name: foundry.utils.escapeHTML(name || game.i18n.localize("DRPG.Cleanup.reshapeUnnamed"))
    }));
}


/* ==========================================================================
 * A RESHAPE IS A PROPOSAL (N-3, Dawid 21.09)
 * ========================================================================== */

/**
 * The reshape card's two halves (E05 C14, 27.09.2026; audit S05-14). What the player
 * reads: the name and the words they asked for, and whether the dice made the trace
 * quieter. What only the GMs read: what the trace was and would become - its band and
 * category off the ledger ("was/now") - and, for the killer, that approving ties it to
 * the murder. The card goes to the player's own thread (`proposeReshape`, `callGm`), and
 * both lines were in its body: the player read the category an Analyze exists to price,
 * and a line about them in the third person meant for the GM. They are `gmBody` now,
 * which the card on a player's screen leaves out (COMM-06) - and since E06 C7b is not
 * sent to that player's browser at all. Since E06 C8 the card is veiled (`callGm`'s
 * `veiled`): its document names neither the thread nor the player (S05-15). Since E09 C9
 * the GMs' part also counts the Truth Bullets already copied from the trace (`copies`,
 * truth-bullets.mjs `heldCopiesOf`), which an approval leaves as they were found: how many
 * others hold a copy is the answer key's, not the player's. Pure, for the suite.
 */
export function reshapeCardParts(data, { name = "", text = "", softer = null, tie = false, copies = 0 } = {}) {
    const esc = foundry.utils.escapeHTML;
    const becomes = CLEANUP.transformAction?.becomes ?? "resolution";
    const was = `${data.visibilityLabel} ${data.typeLabel}`;
    const now = `${REMNANT_VISIBILITY_LABELS[softer ?? data.visibility]
        ?? data.visibilityLabel} ${REMNANT_TYPES[becomes]?.label ?? becomes}`;
    const body = [
        `<strong>${esc(name || game.i18n.localize("DRPG.Cleanup.reshapeUnnamed"))}</strong>`,
        text ? `<br><em>${esc(text)}</em>` : "",
        softer ? `<br>${esc(game.i18n.localize("DRPG.Cleanup.reshapeRulingQuieter"))}` : ""
    ].join("");
    const gmBody = `<p>${esc(game.i18n.format("DRPG.Cleanup.reshapeRulingWas", { was, now }))}${
        tie ? `<br><span class="drpg-warning">${esc(game.i18n.localize("DRPG.Cleanup.reshapeRulingTies"))}</span>` : ""}${
        copies > 0 ? `<br>${esc(plural("DRPG.Cleanup.reshapeRulingCopies", { n: copies }))}` : ""}</p>`;
    return { body, gmBody };
}

/**
 * Ask the GM to rule on a lie, instead of writing it into their evidence.
 *
 * WHAT WAS WRONG. A Tamper that succeeded applied the player's words the moment
 * the dice landed: their name and their sentence went onto the GM's own trace,
 * and the next person through the door read them as the truth of the room. The
 * packet was BOUNDED - `plainText` caps both halves, the visibility list is
 * checked - but bounding is not ruling. Nobody had said yes.
 *
 * Starting a project is the precedent and Dawid named it: the player fills in
 * the form, the form becomes a card, and nothing exists in the world until the
 * GM presses a button. The same three reasons apply here and are stronger,
 * because this writes over something that already exists.
 *
 * THE ROLL AND THE PRICE STAY SPENT. A decline is a ruling, not a refund: they
 * spent the turn and the Sanity scrubbing at a trace, and the critical's
 * Sanity-back is the critical's, not the approval's. So this sits exactly where
 * the write used to sit - after the price, before the report - and the report
 * says the same thing it always said about the dice.
 *
 * WHAT IT DOES NOT DO. It does not touch the Tamper Remnant a failure leaves,
 * the erase road, or the reshape's OWN consequence of becoming a Tamper
 * Remnant. Those are the rules answering; this is a player writing prose.
 */
async function proposeReshape(actor, token, data, {
    name = "", text = "", softer = null, tie = false, done = [], erases = false, receipt
} = {}) {
    const { body, gmBody } = reshapeCardParts(data, { name, text, softer, tie, copies: heldCopiesOf(token.id) });

    /*
     * THE PROPOSAL IS KEPT BY THE GMS, ON THE ATTEMPT'S ROW, BEFORE THE CARD EXISTS (E09 C10,
     * 08.10.2026). Until this commit the words, the quieter band, the tie and the erase rode on
     * the card's buttons as `data-*`, and the ruling took them off the click: whoever could press
     * Approve chose what Approve wrote, the row knew nothing of a proposal, and a card a GM could
     * press already existed while the row of its attempt was not yet written - the receipt was kept
     * only when the attempt ended, after the card. Now the row holds the proposal from before the
     * card goes, and the buttons carry the attempt alone; the ruling reads what it writes off the
     * row (`claimRuling`). The row is the attempt's own receipt, so a later attempt by the same
     * character replaces it, and a card from the earlier one is refused as a Reroll's is.
     */
    receipt.proposal = { name, text, softer: softer ?? null, tie: Boolean(tie), erases: Boolean(erases) };
    await keepAttempt(receipt);
    const attempt = receipt.attempt;

    const { callGm } = await import("./gm-bridge.mjs");
    const sent = await callGm(actor, {
        title: game.i18n.localize("DRPG.Cleanup.reshapeRulingTitle"),
        room: data.room ?? null,
        body,
        gmBody,
        // Put to the GMs in its player's thread, which is nobody else's to know of (E06 C8).
        veiled: true,
        actions: [
            {
                action: "approveReshape",
                label: game.i18n.localize("DRPG.Cleanup.reshapeApprove"),
                // Lowercase keys only: `data-*` arrives through `dataset`, which
                // lowercases everything, so `tokenId` would read back undefined.
                // What the approval writes is the row's, not the button's (above).
                data: { by: actor.id, scene: token.parent?.id ?? "", trace: token.id, attempt }
            },
            {
                action: "declineReshape",
                label: game.i18n.localize("DRPG.Cleanup.reshapeDecline"),
                /* The trace travels too: on the erase road the dice bought an ERASE and the
                   rewrite was the upgrade the player chose on top of it, so a GM who refuses
                   the story still owes them the erase - which the row's `erases` says. */
                data: { by: actor.id, scene: token.parent?.id ?? "", trace: token.id, attempt }
            }
        ]
    });

    /*
     * A CARD THAT DID NOT GO IS NOT A PROPOSAL, and the player must not be told
     * one is waiting. Same `=== false` care as ACT-15: the messenger answers
     * with a document or with false, and a lie left in limbo with nobody asked
     * is the one outcome this change must not create.
     */
    if (sent === false) {
        await whisperToGms(`<p class="drpg-warning">${
            game.i18n.localize("DRPG.Cleanup.reshapeUnsent")}</p>`);
        done.push(game.i18n.localize("DRPG.Cleanup.reshapeUnsentPlayer"));
        return false;
    }

    done.push(game.i18n.format("DRPG.Cleanup.reshapeWaiting", {
        name: foundry.utils.escapeHTML(name || game.i18n.localize("DRPG.Cleanup.reshapeUnnamed"))
    }));
    return true;
}

/** Where a ruling's notices go when nobody asked for them back: this browser's own. */
function tellHere(level, key, data = null) {
    ui.notifications[level](data ? game.i18n.format(key, data) : game.i18n.localize(key));
}

/**
 * ONE RULING PER PROPOSAL, AND IT IS TAKEN BEFORE ANYTHING WAITS (E09 C10, 08.10.2026).
 *
 * Measured at the parent (08.10.2026): Approve and Decline on one card at once both
 * answered true (tier 2, "two rulings of one reshape at once run once"), and in
 * scenario 62 the GM's Approve on its own open copy of the card, pressed after gm2's,
 * ran again and told the player a second time (T9: 3 messages, then 4). Nothing
 * marked a proposal as ruled; each ruling read the row, awaited, and wrote. Here the
 * row is read and marked `ruled` in one synchronous step, so of two rulings on one
 * browser exactly one finds it unmarked; `askReshapeRuling` (gm-bridge.mjs) sends
 * every GM's ruling to the primary, which makes that one browser.
 *
 * The proposal is the row's (`proposeReshape`), and a row that does not hold one for
 * this trace under this attempt is refused: a Reroll's replay, a later attempt by the
 * same character, a chapter's reset. No row is no longer "proves nothing": the row is
 * where the words are, so without it there is nothing to rule on.
 */
function claimRuling(actorId, tokenId, attempt, by, verdict) {
    const row = cleanupAttemptStore.get(actorId ?? "") ?? null;
    const tag = String(attempt ?? "").slice(0, 32);
    if (!row?.proposal || !tokenId || row.tokenId !== tokenId || !tag || row.attempt !== tag) {
        log(`Reshape ruling refused: the GMs hold no proposal of attempt ${tag || "(none)"} on ${tokenId}.`);
        return { refused: "DRPG.Cleanup.reshapeTakenBack", value: false };
    }
    if (row.ruled) {
        const name = game.users.get(row.ruled.by)?.name ?? String(row.ruled.by ?? "");
        log(`Reshape ruling refused: attempt ${tag} was ruled already (${row.ruled.verdict}).`);
        return { refused: "DRPG.Cleanup.alreadyRuled", data: { name }, value: null };
    }
    const marking = cleanupAttemptStore.patch(actorId, { ruled: { by, on: game.user.id, verdict } }, { ifLive: true });
    return { proposal: { ...row.proposal }, marking };
}

/**
 * The GM pressed Approve. NOW the words land.
 *
 * Read fresh rather than from the card: minutes may have passed, and the trace
 * the ruling is about is the trace as it stands when the ruling is made. A
 * chapter sweep, another killer's clean-up or the GM's own hand may have taken
 * it - in which case there is nothing to relabel and both sides are told.
 *
 * THE WORDS ARE THE ROW'S (E09 C10), and still bounded again on arrival: the
 * module's habit is that a field is bounded by the code that uses it rather than
 * by the code that was supposed to produce it. It costs two lines.
 *
 * `tell` is where the notices go: this browser's, or back to the GM who asked the
 * primary to rule (`ruleReshape`); `by` is the GM who pressed.
 */
export async function applyReshapeRuling({ actorId, tokenId, attempt = "" } = {}, { tell = tellHere, by = game.user.id } = {}) {
    if (!game.user.isGM) return null;
    await cleanupAttemptStore.whenHydrated();
    const actor = game.actors.get(actorId) ?? null;
    const token = findRemnantToken(tokenId);
    const data = token ? remnantData(token) : null;
    /*
     * A CARD FROM AN ATTEMPT A REROLL TOOK BACK RULES ON NOTHING (review of
     * stage D). The card carries the attempt it was raised for; a Reroll replays
     * the attempt under a new id, which the row then holds - measured the way the
     * review wrote it: a lost Reroll, then Approve on the older card, used to put
     * the lie on the trace anyway. `claimRuling`, with no wait before it: only a
     * trace that stands and is not reinforced is claimed, and the two refusals
     * below leave the proposal to be ruled on again.
     */
    const claim = data && !data.reinforced ? claimRuling(actorId, tokenId, attempt, by, "approve") : null;
    if (!data) {
        tell("warn", "DRPG.Cleanup.reshapeRulingGone");
        if (actor) await whisperToOwner(actor, `<p>${
            game.i18n.localize("DRPG.Cleanup.vanished")}</p>`);
        return null;
    }

    /*
     * REINFORCED SINCE THE ROLL IS A REFUSAL, and this is the one guard that
     * could not be asked when the dice landed. A GM who has decided in the
     * meantime that this trace is what makes the case solvable has said no to
     * every road that edits it, including one they are being offered a button
     * for.
     */
    if (data.reinforced) {
        tell("warn", "DRPG.Cleanup.reinforced", { what: `${data.visibilityLabel} ${data.typeLabel}` });
        return null;
    }
    if (claim.refused) {
        tell("warn", claim.refused, claim.data);
        return claim.value;
    }
    await claim.marking;

    const { name = "", text = "", softer = null, tie = false } = claim.proposal;
    const limits = CLEANUP.transformAction?.limits ?? {};
    const safeName = plainText(name, limits.name ?? 60);
    const safeText = plainText(text, limits.text ?? 400);
    const quieter = REMNANT_VISIBILITY.includes(softer) ? softer : null;

    const done = [];
    /*
     * THE RECEIPT IS FILLED IN WHEN THE CHANGE HAPPENS, not when it was asked
     * for. A Reroll between the roll and the ruling finds `transformed: null`,
     * which is the truth - nothing had been written yet - and one after the
     * ruling finds the snapshot `reshapeTrace` takes below, written onto the
     * row the roll opened (E08+E28 C3: a GM store now, where it was a Map whose
     * object this wrote through) - and only onto a row still standing.
     */
    const receipt = {};
    await reshapeTrace(token, data, {
        name: safeName, text: safeText, softer: quieter, tie: Boolean(tie),
        receipt,
        done
    });
    if (receipt.transformed) {
        await cleanupAttemptStore.patch(actorId, { transformed: receipt.transformed }, { ifLive: true });
    }

    if (actor && done.length) {
        await whisperToOwner(actor, `${cardHead({
            action: game.i18n.localize("DRPG.Cleanup.reshapeRulingTitle")
        })}<p>${done.join("</p><p>")}</p>`);
    }
    log(`Reshape approved: ${actor?.name ?? actorId} relabelled a ${
        data.visibility} ${data.type}.`);
    return true;
}

/**
 * The GM pressed Decline. The trace stands, and the player is told so.
 *
 * Nothing to refund, for the reason written at the top of this block: the price
 * bought the attempt, and the attempt happened.
 */
export async function declineReshapeRuling({ actorId, tokenId = null, attempt = "" } = {}, { tell = tellHere, by = game.user.id } = {}) {
    if (!game.user.isGM) return null;
    await cleanupAttemptStore.whenHydrated();
    const actor = game.actors.get(actorId);
    if (!actor) return null;

    // The same claim as the approval, and it matters MORE here: the erase below
    // would otherwise remove a trace a Reroll's replay had left standing.
    const claim = claimRuling(actorId, tokenId, attempt, by, "decline");
    if (claim.refused) {
        tell("warn", claim.refused, claim.data);
        return claim.value;
    }
    await claim.marking;

    /*
     * THE ERASE THE CRITICAL BOUGHT (review of stage D). On the erase road the
     * rewrite was an upgrade the player chose instead of erasing, and N-3 made it
     * a proposal - so a decline used to leave the trace exactly as it was, the
     * critical's erase gone with the story, and nothing telling the player the
     * trace was still there. The GM refuses the story, not the dice: the trace is
     * erased as a plain critical would have erased it, through `removeRemnant`
     * like every erase, with the receipt filled in first so a Reroll can put it
     * back. Read fresh, as the approval reads it: a trace swept or reinforced in
     * the meantime is left alone. No refund, and no price call - the critical's
     * hand-back already ran when the dice landed. Whether it erases is the row's
     * `erases` since E09 C10, not the button's.
     */
    let said = "DRPG.Cleanup.reshapeDeclined";
    if (claim.proposal.erases) {
        const token = findRemnantToken(tokenId);
        const data = token ? remnantData(token) : null;
        if (data && !data.reinforced) {
            await cleanupAttemptStore.patch(actorId, { erased: recreationDataFor(token) }, { ifLive: true });
            await removeRemnant(token);
            said = "DRPG.Cleanup.reshapeDeclinedErased";
        }
    }

    await whisperToOwner(actor, `${cardHead({
        action: game.i18n.localize("DRPG.Cleanup.reshapeRulingTitle")
    })}<p><em>${foundry.utils.escapeHTML(game.i18n.format(
        said, { name: game.users.get(by)?.name ?? game.user.name }))}</em></p>`);
    tell("info", "DRPG.Cleanup.reshapeDeclinedGm", { name: actor.name });
    return true;
}

/**
 * A ruling on a reshape card, on the primary GM's browser (E09 C10; `cleanup.ruling`
 * in gm-bridge.mjs). Answers what the ruling answered and the notices it raised, as
 * `[level, key, data]`, for the GM who pressed to be shown on their own screen. `by`
 * is that GM's id.
 */
export async function ruleReshape({ actorId, tokenId, attempt, verdict } = {}, by = game.user.id) {
    const told = [];
    const tell = (level, key, data = null) => { told.push([level, key, data]); };
    const asked = { actorId, tokenId, attempt };
    const value = verdict === "approve" ? await applyReshapeRuling(asked, { tell, by })
        : verdict === "decline" ? await declineReshapeRuling(asked, { tell, by })
            : null;
    return { value, told };
}

/**
 * What are you trying to make this look like? Asked BEFORE the dice (Z5).
 *
 * The erase road's `askTransform` is a reward, so it comes after a critical.
 * This one is the action's content: you declare the lie, then find out whether
 * you told it well. Cancelling here costs nothing, which is why it is asked
 * before the action is charged.
 *
 * TWO FIELDS, AND THEY ARE THE LIE ITSELF (Dawid, 29.08). The killer writes
 * what the next person through the door will read: a name for the thing, and a
 * sentence about it. There is no type menu any more - see the argument in
 * `CLEANUP.transformAction` - and there is no "just make it quieter" option,
 * because that was the other half of a choice the menu created.
 *
 * BOTH ARE REQUIRED. A reshape with nothing written in it is not a quiet
 * reshape, it is a player who pressed the wrong button: the action would charge
 * Sanity and a turn to leave the trace saying exactly what it said before.
 * Cancelling here costs nothing, which is the reason this is asked before the
 * action is charged at all - and an unfinished form asks again rather than
 * cancelling (E09 C11, 08.10.2026; audit S05-50): Enter in the name field
 * pressed "Reshape it" with the description empty, and the warning that
 * followed threw away the name that had been typed. Enter moves on now
 * (`enterMovesOn`), and the window opens again holding what was written; the
 * GM's side holds the same rule (`resolveTransformRoad`).
 *
 * @returns {Promise<{name: string, text: string}|null>} null when they backed out.
 */
export async function askTransformChange(actor) {
    const limits = CLEANUP.transformAction?.limits ?? {};

    let typed = { name: "", text: "" };
    for (;;) {
        const picked = await DialogV2.wait({
            window: { title: game.i18n.localize("DRPG.Cleanup.transformAction") },
            classes: ["drpg-panel", "drpg-narrow"],
            content: dialogContent(`<form>
                <p>${game.i18n.localize("DRPG.Cleanup.transformActionIntro")}</p>
                ${reshapeFields(limits, typed)}
                <p class="notes">${game.i18n.localize("DRPG.Cleanup.transformActionNote")}</p>
            </form>`),
            buttons: [
                {
                    action: "go", label: game.i18n.localize("DRPG.Cleanup.transformGo"), default: true,
                    callback: (e, b, d) => ({
                        name: d.element.querySelector("[name=name]").value,
                        text: d.element.querySelector("[name=text]").value
                    })
                },
                { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
            ],
            render: (event, dialog) => enterMovesOn(dialog),
            rejectClose: false
        });

        if (!picked || picked === "cancel") return null;

        const name = plainText(picked.name, limits.name ?? 60);
        const text = plainText(picked.text, limits.text ?? 400);
        if (name && text) return { name, text };
        ui.notifications.warn(game.i18n.localize("DRPG.Cleanup.reshapeNeedsBoth"));
        typed = { name: picked.name ?? "", text: picked.text ?? "" };
    }
}

/* ==========================================================================
 * THE VERDICT - GM side
 * ========================================================================== */

/**
 * The refusals, checked after the trace has been found and before the GM's side
 * charges anything. Answers the result object to hand back, or null when the
 * attempt may go ahead. `price` is the step the player's browser says it paid
 * (T-1): a refusal gives it back and says so (`refundRefused`).
 */
async function cleanupRefusal(actor, token, data, viaAction, price = null) {
    /*
     * NOT "ONLY YOUR OWN" ANY MORE (ACT-02, 17.09).
     *
     * This guard used to refuse any trace somebody else had left. The picker
     * stopped asking that on 31.08 - seeing a trace is the entitlement, not
     * having left it, see `cleanableTracesForPlayer` - and this half was never
     * told: an investigator erasing a trace they had found paid the action and
     * the roll and was always refused. The one rule both halves keep is below.
     *
     * ONLY ONE THEY HAVE FOUND. The same rule the picker was built from,
     * re-asked here because the picker travelled over a socket and what came
     * back is a token id. A packet naming a trace they left and never found
     * would otherwise erase it blind - which is the whole leak, arriving by the
     * other road.
     *
     * INCIDENT TRACES ARE EXEMPT, EXACTLY AS THEY ARE IN THE PICKER (D11).
     *
     * Found on the E23 live round, and it is the failure mode this pair of
     * mirrored guards exists to prevent - running in the wrong direction.
     * `cleanableTracesForPlayer` was taught that you do not have to "find" what
     * you watched being made in front of you; this guard was not. So the menu
     * offered the killer their own crime scene and the resolution answered
     * "you have not found that trace", which is the list and the rule
     * disagreeing about the same trace in the same click.
     *
     * The two conditions have to be edited together. That is what it costs to
     * state a rule twice, and stating it twice is still right: one of them is
     * a menu and the other is a socket boundary.
     */
    const watchedItHappen = data.type === "incident" && incidentParticipant(actor);
    if (viaAction && !watchedItHappen && !copiedRemnants(actor).has(token.id)) {
        error(`Refused a Tamper by ${actor.name}: they have not found that trace.`);
        await whisperToOwner(actor, `<p>${game.i18n.localize("DRPG.Tamper.notFound")}</p>${
            await refundRefused(actor, price)}`);
        return { removed: false, notFound: true };
    }

    // Reinforced traces refuse to be removed at all - remnants.mjs has said so
    // since the flag was introduced. Checked here as well as there so the attempt
    // is refused before the GM's side charges anything or the trace is touched;
    // what the player's browser paid before the dice comes back with the refusal.
    if (data.reinforced) {
        await whisperToOwner(actor, `<p>${game.i18n.format("DRPG.Cleanup.reinforced", {
            what: foundry.utils.escapeHTML(`${data.visibilityLabel} ${data.typeLabel}`)
        })}</p>${await refundRefused(actor, price)}`);
        return { removed: false, reinforced: true };
    }
    return null;
}

/**
 * Score the attempt: the threshold after every relief, the band, and the outcome row the table gives it. `held` is
 * the character as the GMs hold its items (E29 fix r2-H20, `resolveCleanup`'s note): its readied tool's tier.
 */
function cleanupVerdict(held, data, { total, isCritical, withHope, mode }) {
    /*
     * LYING IS EASIER THAN ERASING (Z5) - the transform road takes its relief
     * off the same threshold, after the tool and after the fresh-scene window.
     * Clamped at zero by `cleanupDc`; taken here rather than inside it because
     * a discount that depends on WHICH action was attempted is not a property
     * of the trace.
     */
    const transforming = mode === "transform";
    const relief = transforming ? (CLEANUP.transformAction?.dcRelief ?? 0) : 0;
    const dc = (() => {
        const base = cleanupDc(data.visibility, held);
        return base === null ? null : Math.max(0, base - relief);
    })();
    const success = isCritical || (dc !== null && total >= dc);
    const band = isCritical ? "critical" : (success ? (withHope ? "hope" : "despair") : "failure");
    // `band` stays four-valued for the report - `DRPG.Cleanup.band.*` is written
    // for it - but the OUTCOME distinguishes the two kinds of failure, because
    // the guide does: a Hope failure just does not work, while a Despair failure
    // is the one that "Powstaje Jawny Resolution Remnant".
    const outcome = success
        ? (CLEANUP.outcome[band] ?? CLEANUP.outcome.hope)
        : (withHope ? CLEANUP.outcome.failureHope : CLEANUP.outcome.failureDespair);
    return { transforming, dc, success, band, outcome };
}

    /*
     * G-20: THE CRITICAL'S SECOND OPTION.
     *
     * Checked before the removal rather than instead of it, and every clause
     * here is load-bearing:
     *
     *   the outcome must allow it   - `mayTransform`, so the permission lives
     *                                 in the rules table with everything else
     *   it must be a critical       - a Hope success erases and nothing more
     *   the lists must accept it    - trap 115. A packet naming `key` or
     *                                 `final` would turn a piece of evidence
     *                                 the GM placed to make the case solvable
     *                                 into whatever the killer fancied.
     *
     * Reinforced traces never get here: they are refused above, before the
     * Sanity is spent, and a critical does not lift that.
     */
    /*
     * THE TRANSFORM ROAD'S OWN VERDICT (Z5).
     *
     * Placed before the erase branch and returning through the same report, so
     * the two roads cannot drift apart on anything except what they do to the
     * trace.
     *
     * A success applies what the player declared: a new type, or one band of
     * quiet. A critical applies BOTH - and where the player asked for the quiet
     * half there is no second thing to give, so the critical's extra is the
     * Sanity back. That asymmetry is deliberate and is argued in config.mjs.
     *
     * A failure falls through to the Tamper Remnant below, which is the same
     * consequence the erase road takes, for the same reason: you disturbed it
     * and left signs of the disturbing (D8).
     */
async function resolveTransformRoad(actor, token, data, verdict, {
    change, isCritical, total, viaAction, receipt, done, paidStep = null, charged = null
}) {
    const { band, success, dc } = verdict;
    const byTheKiller = isCleaner(actor);
    const limits = CLEANUP.transformAction?.limits ?? {};

    /*
     * BOUNDED ON ARRIVAL, like every other field in this packet.
     *
     * `change` crossed a socket, so the `maxlength` on the inputs that were
     * supposed to produce it is decoration. The ceiling that counts is here.
     */
    const name = plainText(change?.name, limits.name ?? 60);
    const text = plainText(change?.text, limits.text ?? 400);

    // A packet without both a name and a description cannot be honoured: there
    // is no longer a second thing a reshape could mean. The roll is still spent,
    // which is the same answer any action gets when its declaration is
    // unusable, and it is reported rather than silently succeeding.
    // BOTH, NOT EITHER (E09 C11, 08.10.2026; audit S05-50). The windows have
    // asked for both since they were written (`askTransformChange`) and this
    // side took one: a packet with a name alone put a card carrying half a lie
    // to the GMs that no window of the module could have sent. One rule now,
    // the windows' - and the erase road's critical keeps it too
    // (`resolveEraseRoad`).
    if (!name || !text) {
        done.push(game.i18n.localize("DRPG.Cleanup.reshapeNothingSaid"));
    } else {
        // The critical's second half: one band quieter. A plain success
        // buys the story alone - see `CLEANUP.transformAction`.
        const ladder = REMNANT_VISIBILITY;              // obvious → hidden
        const at = ladder.indexOf(data.visibility);
        const step = CLEANUP.transformAction?.quieter ?? 1;
        const softer = isCritical && at >= 0 && at < ladder.length - 1
            ? ladder[Math.min(ladder.length - 1, at + step)]
            : null;

        try {
            // N-3: the GM rules on the lie. See the block above `proposeReshape`.
            await proposeReshape(actor, token, data, {
                name, text, softer, tie: byTheKiller, done, receipt
            });
        } catch (err) {
            error("Could not put a transform's reshape to the GM", err);
        }
    }

    // The critical hands back the step that paid, not "a Sanity mark" (T-1).
    const back = CLEANUP.transformAction?.refundStress?.[band];
    if (back) {
        const gave = await handBack(actor, paidStep?.pay ?? null, back, receipt);
        done.push(game.i18n.format(gave === "action"
            ? "DRPG.Cleanup.actionBack" : "DRPG.Cleanup.stressBack", { n: back }));
    }

    await report(actor, data, { band, success, total, dc, done, viaAction, charged });
    // What this attempt left the Sanity track at, so a Reroll takes back what it
    // moved and not everything since (E03; audit S05-40).
    receipt.stressAfter = resourceValue(actor, "stress");
    await keepAttempt(receipt);
    log(`Transform: ${actor.name} rolled ${total} against DC ${dc} on a ${
        data.visibility} ${data.type} - ${band}.`);
    return { removed: false, transformed: true, band, success };
}

/**
 * The erase road's own verdict: a critical may rewrite the trace, a success
 * removes it, anything else leaves it standing. Answers what was rewritten,
 * if anything, for the log line.
 */
async function resolveEraseRoad(actor, token, data, { outcome, transforming, isCritical, transform, receipt, done }) {
    /*
     * BOUNDED ON ARRIVAL (trap 115), and the bound moved with the feature.
     *
     * The type half is gone - a reshape always produces a Tamper Remnant now,
     * decided here rather than asked for - so the only thing left to validate
     * from the packet is the band, and it is still checked against the table
     * rather than trusted. The words are capped by `plainText` inside
     * `reshapeTrace`'s callers, and a packet without both a name and a
     * description is not a reshape (E09 C11, the windows' rule, as on the
     * Tamper road in `resolveTransformRoad`): the critical erases instead.
     */
    const rules = CLEANUP.transform ?? {};
    const rewriteName = plainText(transform?.name, CLEANUP.transformAction?.limits?.name ?? 60);
    const rewriteText = plainText(transform?.text, CLEANUP.transformAction?.limits?.text ?? 400);
    const rewrite = isCritical && outcome.mayTransform && transform
        && rewriteName && rewriteText
        && rules.visibilities?.includes(transform.visibility)
        ? transform
        : null;

    const erase = async () => {
        try {
            receipt.erased = recreationDataFor(token);
            // Through `removeRemnant` rather than `token.delete()`: it owns the
            // refusal of reinforced traces, and one place deciding that is the
            // difference between a rule and two rules that can drift apart.
            await removeRemnant(token);
            done.push(game.i18n.format("DRPG.Cleanup.removed", {
                what: `${data.visibilityLabel} ${data.typeLabel}`
            }));
        } catch (err) {
            error("Could not remove the Remnant a clean-up erased", err);
        }
    };

    let put = null;
    if (rewrite) {
        /*
         * THE SAME RULING, BY THE SAME ARGUMENT (N-3).
         *
         * This is the erase road's critical reward rather than the Tamper
         * action, but what lands on the trace is identical: a name and a
         * sentence a player wrote, on the GM's own evidence. Gating one and
         * not the other would leave a road where the words apply themselves,
         * and a rule with a door next to it is not a rule.
         *
         * A PROPOSAL NOBODY CAN RULE ON STILL ERASES (E09 C10, 08.10.2026). The
         * rewrite is the upgrade chosen on top of an erase the dice bought, and
         * only the Decline button carried that erase - so a card that did not go
         * (`proposeReshape` answers false) or a throw on the way to it left the
         * trace standing with no button that would ever take it, while the GMs
         * were told to "relabel it by hand if you allow it". Anything but a card
         * that went erases here as a plain critical does, and the attempt reports
         * an erase and no reshape.
         */
        try {
            put = await proposeReshape(actor, token, data, {
                name: rewriteName,
                text: rewriteText,
                softer: rewrite.visibility,
                tie: isCleaner(actor),
                done,
                erases: true,
                receipt
            });
        } catch (err) {
            error("Could not put a critical clean-up's reshape to the GM", err);
        }
        if (put !== true && outcome.removes && !transforming) await erase();
    } else if (outcome.removes && !transforming) {
        await erase();
    } else {
        done.push(game.i18n.localize("DRPG.Cleanup.stillThere"));
    }
    return { rewrite: put === true ? rewrite : null, rewriteName };
}

    /*
     * THE VISIBILITY BUMP IS GONE, AND SO IS ITS BRANCH (D8).
     *
     * Z5 answered a failure by making the disturbed trace one band louder. D8
     * replaces that with leaving a Tamper Remnant - see `CLEANUP.outcome` for
     * the argument - and no outcome carries `raisesVisibility` any more.
     *
     * The code went with the field rather than being left standing for nothing.
     * An unreachable handler is how a deleted rule comes back by accident, and
     * this module has already paid that lesson once, on `wipesProgress`.
     */
async function leaveTamperTrace(actor, data, outcome, { isCritical, withHope, receipt, done }) {
    const { traceFeedback } = await import("./remnants.mjs");
    /*
     * THE KILLER'S MESS STICKS; EVERYBODY ELSE'S FADES (D2 + D8).
     *
     * This used to tie every trace unconditionally, which was right while
     * only the killer could reach this code. Tamper opened it to the whole
     * cast, and an unconditional tie would have made every innocent's bad
     * Wednesday permanent evidence in a murder that had not happened yet.
     *
     * `isCleaner` is the killer in Stage 6. Their tidying is tied, so the
     * chapter-end sweep spares it and the trial gets to see it. Anybody
     * else's stays faint and untied, so it fades with the chapter - and
     * while it exists, it is an honest, organic focus for a wrong suspicion:
     * somebody really did tidy something here, and it really was not the
     * killer. That is the misdirection this game wants and nobody has to
     * author it.
     */
    const byTheKiller = isCleaner(actor);
    const placed = await dropRemnant(actor, {
        type: CLEANUP.remnantType,
        visibility: outcome.leaves.visibility,
        faint: outcome.leaves.faint,
        tiedToCrime: byTheKiller,
        // "resolution", not "cleanup": `DRPG.Remnant.action.resolution` is
        // already defined as "Cleanup" - the vocabulary was written for this
        // stage before there was anything to fill it.
        action: "resolution",
        note: game.i18n.format("DRPG.Cleanup.remnantNote", {
            what: `${data.visibilityLabel} ${data.typeLabel}`
        })
    });
    if (placed) {
        receipt.leftBehind = refOf(placed);
        /*
         * THIS GATE NOW ACTUALLY FIRES, and the note under it used to say
         * the opposite.
         *
         * `outcome.leaves` was despair-only, so the old comment could
         * correctly record that the branch never ran and was written
         * "through the shared gate anyway" against a future rebalance.
         * D8 is that rebalance: both failure bands leave a trace now, and a
         * failure with HOPE reaches this line.
         *
         * The rule it enforces is unchanged and is the reason it was
         * written defensively: a fresh trace the actor did not select and
         * does not know about is told to them on Hope or a critical, and
         * never on a plain Despair. So a botched tidy-up with Hope says
         * "you left something"; the same botch with Despair leaves the same
         * thing and says nothing, and they find out at the trial.
         */
        if (traceFeedback({ isCritical, withHope }, placed)) {
            done.push(game.i18n.localize("DRPG.Cleanup.leftTrace"));
        }
    }
}

/**
 * Score one clean-up attempt and apply it.
 *
 * @param {object} options
 * @param {string} options.actorId
 * @param {string} options.tokenId  The Remnant token being wiped.
 * @param {number} options.total
 * @param {boolean} [options.isCritical]
 * @param {boolean} [options.withHope]
 */
export async function resolveCleanup({
    actorId, tokenId, total, isCritical = false, withHope = false, undo = false,
    // G-20: `{ type, visibility }` when a critical chose to rewrite the trace
    // rather than erase it. Validated here against `CLEANUP.transform`, never
    // trusted - it arrives over the same socket as everything else.
    transform = null,
    // Z5: "erase" or "transform", and what the player declared before the dice.
    // Bounded here like everything else that crossed a socket.
    mode = "erase",
    change = null,
    viaAction = false,
    // T-1: which step of `PRICE_CHAINS.tamper` the client paid, and whether a
    // Burst paid it. Bounded on arrival by `validPrice` - a packet may claim any
    // string, and only a step the table knows is honoured.
    price = null, grant = false,
    // The roll it was thrown with and who threw it, for the GMs' fact of the attempt (fix
    // r1-G2): action-rolls.mjs `rollOfFact`.
    rollId = null, by = null
} = {}) {
    if (!game.user.isGM) return null;

    const actor = game.actors.get(actorId);
    if (!actor) return null;
    // Said and paid back (`blockedOnGm`); a GM's Reroll of an attempt that stands is refused as before.
    if (!viaAction && !isCleaner(actor)) return undo ? null : blockedOnGm(actor, price);

    // A Reroll: put the scene back the way it was before scoring the new number,
    // or the second attempt would be measured against a room the first one had
    // already changed - and the Sanity would be charged twice for one attempt.
    //
    // A rewind that could not happen aborts the replay rather than scoring on
    // top of the first attempt. `undoLastCleanup` has already told the GMs what
    // to put right by hand.
    // Whether the attempt being replaced was the free one, read before the rewind takes its receipt.
    const replayFree = Boolean(undo && (await attemptOf(actorId))?.free);
    // The roll this attempt is for (E08+E28 C2; the one its packet names since fix r1-G2): see `keepAttemptFact`.
    const rolls = await import("./action-rolls.mjs");
    const roll = rolls.rollOfFact({ undo, rollId, by, actorId, actions: ["cleanup"] });
    if (undo && !await undoLastCleanup(actor, tokenId)) return null;

    // Searched across every scene rather than only the one the killer is
    // standing on. The two are the same in the normal case, and are NOT the same
    // if the killer's token was moved between picking a trace and the dice
    // landing - where scoping to their current scene would report the trace as
    // vanished and charge them for it.
    const token = findRemnantToken(tokenId);
    const data = token ? remnantData(token) : null;
    if (!data) {
        // The trace is gone - another attempt got it, or the GM removed it by
        // hand between the player picking and the dice landing. The price is
        // still spent: they scrubbed at something. Charged here only when no
        // step arrived to say it was paid on the client (T-1). The free attempt
        // is spent on it too: an attempt, hit or miss (`consumeFreeCleanup`).
        const free = replayFree || await consumeFreeCleanup(actor);
        if (!validPrice(price) && !free) await spendStress(actor);
        if (free) await waivePrice(actor, validPrice(price));
        // An attempt that kept no receipt, as the refusal below (E08+E28 C3; audit S05-44).
        await forgetAttempt(actorId);
        await whisperToOwner(actor, `<p>${game.i18n.localize("DRPG.Cleanup.vanished")}</p>`);
        return { removed: false, gone: true };
    }

    /*
     * A REFUSED ATTEMPT TAKES THE LAST ONE'S RECEIPT WITH IT (E08+E28 C3, 03.10.2026; audit
     * S05-44). It kept none of its own and left the previous attempt's standing, so a Reroll
     * of the refused attempt on the same trace took back the attempt before it - its trace,
     * its Sanity - and scored the new number on top. With no row, the Reroll is not replayed
     * and the GMs are told (`undoLastCleanup`).
     */
    const refused = await cleanupRefusal(actor, token, data, viaAction, price);
    if (refused) {
        await forgetAttempt(actorId);
        return refused;
    }
    /*
     * THE GLOVES AS THE GMS HOLD THEM (E29 fix r2-H20, 06.10.2026; H18's seam). The tool written down for the
     * discovery (`noteCleaningTool`) and the tier that lowers the trace's number (`cleanupDc`) are read off the
     * character's items as the GMs hold them (sheet-audit.mjs `actorAsHeld`): a tier, a role, a break or a stash a
     * player's browser wrote and the audit puts back is not read, nor one whose put-back failed. Read once, after the
     * refusals and before anything is written; the wait holds up nothing that holds it up, by reading: the attempt
     * comes after its roll and writes no use's consumption and no roll's card. The player's own quote (`attemptCleanup`,
     * the dialog) still reads the sheet: the GM decides. Until this fix (4d1532c, e29run/r2h20red, 06.10.2026) Tier 1
     * gloves given tier 3 where the GMs' mark did not see it scrubbed an evident trace on a total one short of the
     * number Tier 1 gloves leave, and Move the body succeeded on 14.
     */
    const { actorAsHeld } = await import("./sheet-audit.mjs");
    const held = await actorAsHeld(actor);
    await noteCleaningTool(actor, held);

    const verdict = cleanupVerdict(held, data, { total, isCritical, withHope, mode });
    const { transforming, dc, success, band, outcome } = verdict;

    // Everything needed to put this attempt back, recorded before it happens.
    // The erased trace is stored as its full creation data rather than as an id,
    // because by the time a Reroll asks for it the token no longer exists.
    const receipt = {
        actorId,
        tokenId,
        stressBefore: resourceValue(actor, "stress"),
        erased: null,
        leftBehind: null,
        // G-20: what the trace was before it was relabelled. A Reroll putting
        // back a DELETED trace re-creates it; putting back a transformed one
        // only has to say what it used to be.
        transformed: null,
        // Which attempt this is. A reshape card carries it, so a card raised by
        // dice a Reroll has since replaced can tell it no longer rules on anything.
        attempt: foundry.utils.randomID()
    };

    // THE SERVER-SIDE PRICE - see the long note in `resolveStageSix`. A client
    // that paid the chain and says which step is not charged again; a packet with
    // no claim pays the Sanity here, as every packet used to.
    const paidStep = validPrice(price);
    const free = replayFree || await consumeFreeCleanup(actor);
    receipt.free = free;
    if (!paidStep && !free) await spendStress(actor);
    if (free) await waivePrice(actor, paidStep);
    // What the report says was paid: the step the client claimed, with the
    // amount read off the table rather than off the packet - and nothing for
    // the free attempt, which says so instead.
    const charged = paidStep && !free ? { pay: paidStep.pay, amount: paidStep.amount, grant } : null;

    const done = [];
    if (free) done.push(game.i18n.localize("DRPG.Cleanup.freeAttempt"));

    if (transforming && success) {
        const road = await resolveTransformRoad(actor, token, data, verdict,
            { change, isCritical, total, viaAction, receipt, done, paidStep, charged });
        await keepAttemptFact(rolls, roll, actorId, receipt);
        return road;
    }

    const { rewrite, rewriteName } = await resolveEraseRoad(actor, token, data, { outcome, transforming, isCritical, transform, receipt, done });

    if (outcome.leaves) await leaveTamperTrace(actor, data, outcome, { isCritical, withHope, receipt, done });

    // "Morderca odzyskuje 1 stres" - the critical's own line, and the only
    // outcome in Stage 6 that gives the Sanity back. Applied after `spendStress`
    // rather than instead of it, so the receipt's `stressBefore` still describes
    // the state a Reroll has to restore.
    // Handed back on both roads now, because both roads paid - and as the step
    // that paid, which is an action as often as a mark since T-1 (`handBack`).
    if (outcome.refundStress) {
        const gave = await handBack(actor, paidStep?.pay ?? null, outcome.refundStress, receipt);
        done.push(game.i18n.format(gave === "action"
            ? "DRPG.Cleanup.actionBack" : "DRPG.Cleanup.stressBack", { n: outcome.refundStress }));
    }

    await report(actor, data, { band, success, total, dc, done, viaAction, charged });
    // What this attempt left the Sanity track at - see the transform road above.
    receipt.stressAfter = resourceValue(actor, "stress");
    await keepAttempt(receipt);
    await keepAttemptFact(rolls, roll, actorId, receipt);

    log(`Cleanup: ${actor.name} rolled ${total} against DC ${dc} on a ${data.visibility} ${data.type} - ${band}${
        rewrite ? `, reshaped into "${rewriteName}" at ${rewrite.visibility}` : ""}.`);
    return { removed: Boolean(outcome.removes && !rewrite), transformed: Boolean(rewrite), band, done };
}

/* ==========================================================================
 * STAGE 6'S OTHER TWO ACTIONS
 * --------------------------------------------------------------------------
 * "Zatarcie śladów" above removes evidence. These two do the opposite and the
 * unrelated: one manufactures evidence against somebody else, the other moves
 * the largest piece of evidence in the room.
 *
 * They share the erase-trace shape - the same price chain (T-1), rolled on
 * this client and scored on the GM's - but not its difficulty: both have a flat
 * threshold from the guide rather than one read off how visible a trace is.
 * ========================================================================== */

/**
 * Cover what you are doing, when somebody is watching you do it.
 *
 * Guide, p. 27: "Jeśli min. jeden inny gracz zadeklaruje obecność w
 * pomieszczeniu, w którym zabójca realizuje akcje rozwiązania, zabójca na
 * początku akcji musi rzucić kośćmi za ukrycie swoich intencji." Thresh 16,
 * Shadow - the same shape as the sabotage and indirect-murder concealment rolls,
 * and priced the way neither of those is: entirely in Sanity.
 *
 * It never blocks the action. Failing means the room watched you scrub a murder
 * scene, which is a social catastrophe rather than a mechanical one, and the
 * guide gives it no "you may not continue" clause. What it costs is Sanity -
 * the currency Stage 6 runs on - so a botched cover story really does shorten
 * how long the killer can keep cleaning.
 *
 * Rolled with `remember: false`: a supporting roll must not eat a Call armed for
 * the clean-up itself, nor overwrite the Reroll bookmark. Same rule as
 * `INDIRECT_MURDER.concealIntent`.
 *
 * @returns {Promise<"alone"|"rolled"|null>} null only when the roll was
 *   abandoned, which is the one case the caller should read as "they backed
 *   out" - see the note at the top of `concealFromWitnesses` for the other two.
 */
/**
 * Who in this room could tell on you (D13, Dawid 29.08).
 *
 * AN ACCOMPLICE IS NOT A WITNESS, and the roll this feeds exists entirely to
 * ask "can they see what you are doing". Two killers who committed the incident
 * together already know: there is nothing to hide from the person who held the
 * other end of it, and rolling Shadow against them made the second killer's
 * presence a PENALTY on the clean-up rather than the help it obviously is.
 *
 * Measured against the same list `cleanupBlocker` uses to decide who may clean
 * at all - `killerIds` - so the two answers cannot disagree: everybody the
 * stage lets into the crime scene is somebody the crime scene does not hide
 * from.
 *
 * ONLY FOR THE KILLERS. An innocent using Tamper is not in the conspiracy, so
 * nobody is exempt from their roll - least of all a killer standing over them,
 * who is exactly the person an innocent has reason to hide from. The
 * `isCleaner` test is what makes this a rule about accomplices rather than a
 * rule about anyone who happens to be indexed in the incident.
 *
 * The dead are already gone from `othersInRoom` (`countsAsPresent` drops them),
 * so the victim never had to be handled here.
 */
export function witnessesTo(actor, present) {
    if (!isCleaner(actor)) return present;
    const partners = new Set(killerIds(murderState()));
    return present.filter(other => !partners.has(other?.id));
}

/**
 * Which step of Tamper's chain this character has already settled.
 *
 * D3 SURVIVES T-1 (Dawid, 17.09: "Zabojca w swoim Stage 6 placi za Tamper bez
 * kroku akcji, 1 Zdrowia psychicznego - jak dzis"). The killer's own clean-up is
 * free of the action economy from the victim's death to the end of that time of
 * day, so their chain starts at its Sanity step.
 *
 * ONE HELPER, THREE READERS - this file's charge, the Tamper tile's refusal and
 * the sheet's price label - so the tile cannot advertise a price the charge does
 * not take.
 */
export function tamperPriceSkip(actor) {
    return isCleaner(actor) ? ["action"] : [];
}

/**
 * WHAT A TAMPER COSTS THIS CHARACTER NOW, THE FREE ATTEMPT INCLUDED (E32+E07 fix r2-G3,
 * 03.10.2026; the round-2 review's C2-m1). A critical Finishing blow makes the striker's next
 * clean-up attempt cost no Sanity (`consumeFreeCleanup`), and until this fix only the GMs knew
 * it: the striker's own browser quoted the Sanity step, so a striker whose bar the blow had
 * filled was refused before any GM was asked - measured by the review on d9ee6e9 at 6/6
 * ("No action left, and no Sanity to give instead."), the grant left unspent. The killers' copy
 * of the cast carries the grant now (incident-store.mjs `castCopyFor`), so the quote reads it here and
 * says the attempt is free. A character the chain cannot charge at all (`noPrice`: dead, a
 * Monocub) stays refused - a grant is no reason to clean.
 *
 * The readers are the ones `tamperPriceSkip` names: this file's charge (`chargeTamper`), the
 * Tamper tile's refusal and briefing (action-rolls.mjs), and the sheet's price label.
 */
export function tamperQuote(actor) {
    const quote = quotePrice(actor, "tamper", { skip: tamperPriceSkip(actor) });
    if (quote.blockedKind === "noPrice" || !holdsFreeCleanup(actor)) return quote;
    return { ...quote, pay: null, amount: 0, grant: false, lastSanity: false, blocked: null, blockedKind: null };
}

/** Is this character's next clean-up attempt the free one, as this browser's copy of the cast says? */
function holdsFreeCleanup(actor) {
    return Boolean(actor?.id) && murderState()?.freeCleanup === actor.id;
}

/**
 * Why a WATCHED attempt is refused on a full Sanity track, or null.
 *
 * The unconditional refusal that used to stand here - no Sanity, no Tamper - was
 * the old double price showing through: the attempt itself is paid for by the
 * chain now, and an action is a perfectly good way to pay for it. What a full
 * track really stops is the CONCEALMENT (Dawid, review line 112): being watched
 * costs Sanity on top of the price, `spendStress` silently does nothing at a full
 * track, and a watched Tamper would otherwise be free of the one cost that is
 * supposed to make being seen matter.
 *
 * `conceals: false` for moving a body, which rolls no concealment at all.
 */
export async function tamperWatchBlock(actor, { conceals = true } = {}) {
    if (!conceals) return null;
    if (resourceValue(actor, "stress") < resourceMax(actor, "stress")) return null;
    const { othersInRoom } = await import("./movement.mjs");
    if (!witnessesTo(actor, othersInRoom(actor)).length) return null;
    return game.i18n.localize("DRPG.Tamper.watchedNoSanity");
}

async function concealFromWitnesses(actor) {
    // Three answers, not two (ACT-04): "alone" nothing was rolled, "rolled" a
    // concealment roll landed and paid out, null its window was closed. The
    // callers charge the price only after this answers, so null costs nothing;
    // a main roll closed after "alone" gets the price back, after "rolled" not.
    const def = CLEANUP.conceal;
    if (!def) return "alone";

    const { othersInRoom } = await import("./movement.mjs");
    if (!witnessesTo(actor, othersInRoom(actor)).length) return "alone";

    const { rollTrait } = await import("./action-rolls.mjs");
    const roll = await rollTrait(actor, def.trait,
        { remember: false, title: game.i18n.localize("DRPG.Roll.concealIntent"), dc: def.threshold });
    if (!roll) return null;

    const hidden = roll.isCritical || roll.total >= def.threshold;
    const band = roll.isCritical ? "critical" : (roll.withHope ? "hope" : "despair");

    let cost = 0;
    if (hidden && band === "despair") cost = def.stress?.successDespair ?? 0;
    else if (!hidden) {
        cost = roll.withHope ? (def.stress?.failureHope ?? 0) : (def.stress?.failureDespair ?? 0);
    }
    for (let i = 0; i < cost; i++) await spendStress(actor);

    const refund = hidden ? (def.refundStress?.[band] ?? 0) : 0;
    if (refund) await restoreStress(actor, refund);

    const line = hidden
        ? (band === "despair" ? def.successWithDespair : def.success)
        : def.failure;

    await whisperToOwner(actor, `${cardHead({ action: def.label, total: roll.total })}<p>${
        foundry.utils.escapeHTML(line)}</p>`);

    /*
     * A failure is public TO THE ROOM, and to nowhere else.
     *
     * This used to `announce()`, which is a message to the whole table - so a
     * botched cover story in the Closet told sixteen students, most of them on
     * the other side of the building, that somebody had been caught cleaning.
     * That is the investigation handed over for free, by the one roll whose
     * entire subject is who can see you.
     *
     * Who can see you is `othersInRoom`, which this function has already asked
     * - it is the reason the roll happened at all. So the message goes to those
     * people's owners, plus the GMs, and the killer's own copy is the whisper
     * above.
     */
    if (!hidden) {
        const line = `<p><em>${game.i18n.format("DRPG.Cleanup.seenCleaning", {
            actor: foundry.utils.escapeHTML(actor.name),
            room: foundry.utils.escapeHTML(locateActor(actor)?.room ?? "-")
        })}</em></p>`;

        const { ownerOf, gmIds, whisperToGms } = await import("./utils.mjs");
        const witnesses = othersInRoom(actor).map(a => ownerOf(a)?.id).filter(Boolean);
        const recipients = Array.from(new Set([...witnesses, ...gmIds()]));

        if (recipients.length) {
            await announce({
                content: line,
                whisper: recipients,
                flags: { [MODULE_ID]: { drpgMessage: true } }
            });
        } else {
            // Nobody in the room has an owner online - an NPC, a player away
            // from the table. The GMs still hear it, because the fiction still
            // happened and somebody has to be able to narrate it.
            await whisperToGms(line);
        }
    }

    // NOT `true` (review of ACT-04, 17.09). The comment at the top promises
    // "rolled" here, and the callers only refuse a refund when they see it: with
    // `true` a closed main roll after this roll had paid out refunded the action.
    return "rolled";
}

/**
 * A resolution action costs an action - unless it is the killer's own night.
 *
 * THE ORIGINAL RULE, AND IT WAS RIGHT FOR THE PROBLEM IT SOLVED. Stage 6 ran on
 * Sanity alone, which meant it ran on nothing the table could see: a killer
 * with Sanity to spare scrubbed every trace in the room one after another.
 * Charging an action capped it at two per time of day and made "what do I do
 * with the time I have" a real question.
 *
 * IT CAPPED THE WRONG THING (D3, measured in E18c). Two actions is the budget
 * for an ordinary afternoon, and the hours after a murder are not one. A killer
 * who had just fought somebody had, in practice, one action left - so the whole
 * of Stage 6 came down to picking a single trace and walking away from the
 * rest, and the measured season cleaned about 2.9 traces from start to finish.
 *
 * So the killer's own clean-up is free of the action economy from the victim's
 * death to the end of that time of day, and pays in Sanity only - one per
 * attempt, with a full bar refusing up front. "The night of the murder belongs
 * to the killer; they pay for it with their mind, not with their clock."
 *
 * MEASURED, AND THE SECOND NUMBER IS WHY THIS IS SAFE: cleaning went 2.9 → 5.25
 * a season (+81%), and the evidence chain the trial runs on did not move
 * (5.61 → 5.63), with 59 of 60 trials still solved. The killer gets to finish
 * the job; the case survives, because what Stage 6 can reach was never the part
 * that convicts - Key, Final and reinforced traces are untouchable by
 * construction.
 *
 * `isCleaner` is exactly that window and nothing wider: an active incident, at
 * stage `resolution`, and this actor one of its killers - `tamperPriceSkip` is
 * where it takes the action step off the chain. Outside it - the Tamper tile on
 * an ordinary Tuesday - the chain starts at the action, and falls to a Sanity
 * mark only when no action is left (T-1).
 *
 * @returns {Promise<{key: string, pay: string, amount: number, grant: boolean}|null>}
 *   what `payPrice` took, or null when the chain could not be paid - by then
 *   only because the concealment's own Sanity took the point, since the quote
 *   before the dice refuses a chain that was never payable. Decided HERE, and
 *   `releaseTamper` reads `pay` rather than asking `isCleaner` again after a
 *   roll window a GM could have changed the incident under (review of ACT-04).
 */
export async function chargeTamper(actor) {
    /* The free attempt pays nothing here (`tamperQuote`), and claims no step: the GM's side
       spends the grant, and charges the Sanity itself if the grant was gone by then - a packet
       with no claim pays there (`resolveCleanup`). Exported for the suite. */
    if (holdsFreeCleanup(actor)) return { key: "tamper", pay: null, amount: 0, grant: false };
    return payPrice(actor, "tamper", { skip: tamperPriceSkip(actor) });
}

/**
 * Give the price back when a roll window is closed, and stop.
 *
 * ACT-04, 17.09: closing the concealment roll or the main one used to lose the
 * action, where Sabotage, Work on Project and Palm give it back.
 *
 * NOT AFTER A CONCEALMENT ROLL HAS LANDED. That roll has paid its Hope or a
 * Monokuma's Despair and has told a room full of people what it saw; a refund
 * then would be ACT-05's generator again. The price is KEPT and the player is
 * told it was kept - and nothing else happens, because the price was taken after
 * the concealment (T-1) and the receipt is the whole of what there is to keep.
 *
 * @param {object|null} charge  What `chargeTamper` returned.
 * @returns {Promise<null>}
 */
async function releaseTamper(actor, charge, { rolled = false } = {}) {
    // The free attempt took nothing, so nothing is kept or handed back (`chargeTamper`), and the
    // grant stands: no GM was asked to spend it.
    if (!charge?.pay) return null;
    if (rolled) {
        // An action kept is said the way every other action says it (ROLL-05's
        // `spentAfterRoll`); a Sanity mark kept has its own sentence.
        ui.notifications.warn(charge?.pay === "action"
            ? game.i18n.format("DRPG.Action.spentAfterRoll", { action: ACTIONS.tamper?.label ?? "" })
            : game.i18n.localize("DRPG.Cleanup.keptSanity"));
        return null;
    }
    if (charge) await refundPrice(actor, charge);
    return null;
}

/** Common guard for the two below. @returns {object|null} the action def. */
function stageSixDef(actor, key, { viaAction = false } = {}) {
    const def = CLEANUP.actions?.[key];
    if (!def) {
        // The one refusal with nothing to say to a player: a key that is not in
        // the table cannot come from the sheet, only from a bad call. It still
        // has to reach somebody, so it goes to the log rather than nowhere.
        error(`No Stage 6 action named "${key}".`);
        return null;
    }
    // Whose scene this is, is Stage 6's question. Being able to pay is
    // everybody's, and the two attempts below ask it - see `attemptCleanup`.
    if (!viaAction && !isCleaner(actor)) {
        refuseCleanup(actor);
        return null;
    }
    /*
     * THE FULL-TRACK REFUSAL MOVED (T-1). It is `tamperWatchBlock` now, asked by
     * the two attempts below: a full track only stops an attempt somebody is
     * WATCHING, because that is the cost a full track cannot pay. The attempt
     * itself is paid for by the chain, and an action pays it perfectly well.
     */
    return def;
}

/**
 * Who a false trail can point at.
 *
 * Shared by Stage 6's picker and the Tamper tile, because they must not be able
 * to disagree about it. Two exclusions and both matter: yourself, because a
 * trail pointing at you is not a frame-up, and a Monokuma, because they are not
 * in the suspect pool the trial draws from.
 *
 * The murder victim is excluded only when there IS one. Framing the person
 * lying dead in the room is a confession with extra steps - but outside an
 * incident `murderState()` has no victim and the filter simply does not bite.
 */
export async function framingCandidates(actor) {
    const { livingStudents } = await import("./chapter.mjs");
    const victimId = murderState()?.victimId;
    return livingStudents()
        .filter(a => a.id !== actor?.id && a.id !== victimId && !isMonokuma(a));
}

/**
 * Roll one of the two, on the killer's own client.
 *
 * @param {Actor} actor
 * @param {"misleadingTrail"|"moveBody"} key
 * @param {string|null} targetId  The framed player, for a misleading trail.
 */
export async function attemptStageSix(actor, key, targetId = null, { viaAction = false } = {}) {
    const def = stageSixDef(actor, key, { viaAction });
    if (!def) return null;

    // You cannot carry a body you are not standing next to.
    //
    // `applyMoveBody` walks outwards from the KILLER's room, so a killer in a
    // different room from the body teleported it out of a room they had never
    // been in - measured, Round Table to Closet from the Dinner Hall. In a real
    // incident the two are together and this never fires; it fires for the
    // states that get there some other way, which is now a supported route.
    if (key === "moveBody" && !bodyIsHere(actor)) {
        ui.notifications.warn(game.i18n.localize("DRPG.Cleanup.bodyNotHere"));
        return null;
    }

    const { gmOnline, sayNotDone } = await import("./bridge-guards.mjs");
    if (!gmOnline()) {
        sayNotDone("murder.cleanup", "noGm", { nothingSpent: true });
        return null;
    }

    // Moving a body rolls no concealment, so a full Sanity track does not stop it
    // - there is nothing for the full track to fail to pay.
    const watched = await tamperWatchBlock(actor, { conceals: key !== "moveBody" });
    if (watched) {
        ui.notifications.warn(watched);
        return null;
    }

    const quote = tamperQuote(actor);
    if (quote.blocked) {
        ui.notifications.warn(quote.blocked);
        return null;
    }

    // The statistic, before anything is rolled or paid (`cleanupTrait`).
    const ruled = await cleanupTrait(actor, key, viaAction);
    if (!ruled) return null;

    // The guide's concealment roll covers "akcje rozwiązania" as a whole -
    // planting a false trail or dragging a body past a witness is if anything
    // harder to explain away than wiping a smear.
    //
    // Moving the body is out. You are not concealing an intent while you carry
    // a corpse across the hall - there is nothing left to be coy about, and the
    // action already announces itself by leaving an Evident trace every single
    // time. Two rolls to move one body, where the first could stop the second
    // from happening at all, was a stack the stage does not need.
    const cover = key === "moveBody" ? "alone" : await concealFromWitnesses(actor);
    if (!cover) return null;

    // After the concealment, for the reason argued in `attemptCleanup`.
    const charge = await chargeTamper(actor);
    if (!charge) {
        ui.notifications.warn(game.i18n.localize("DRPG.Cleanup.priceGone"));
        return null;
    }

    const { rollTrait } = await import("./action-rolls.mjs");
    const calls = await import("./call-effects.mjs");

    // Moving a body is the one Stage 6 action a Cleaning Tool helps with by
    // lowering the number rather than by granting advantage - see
    // `toolBonusPerTier`, applied on the GM side where the threshold lives.
    const tool = cleaningTool(actor);
    if (CLEANUP.toolAdvantage && tool && key !== "moveBody") calls.armSituational(1);

    let roll;
    try {
        roll = await rollTrait(actor, ruled.trait, {
            dc: def.threshold ?? null,
            byGm: ruled.byGm,
            // `cleanupKey` names WHICH of the three this was. `cleanup` keeps
            // holding the same value it always did so nothing that reads the
            // old bookmark shape breaks - see `settleCleanup` in reroll.mjs.
            actionKey: "cleanup",
            context: {
                cleanup: key, cleanupKey: key,
                cleanupTarget: targetId, cleanupVia: viaAction,
                cleanupPrice: charge.pay,
                cleanupGrant: Boolean(charge.grant)
            },
            title: game.i18n.localize(key === "moveBody"
                ? "DRPG.Cleanup.moveAction"
                : viaAction ? "DRPG.Tamper.trailAction" : "DRPG.Cleanup.trailAction")
        });
    } finally {
        calls.clearSituational();
    }
    if (!roll) return releaseTamper(actor, charge, { rolled: cover === "rolled" });

    // Including "move the body", where the tool lowers the threshold instead of
    // granting advantage: it is still the thing in their hands.
    await breakOnDespair(actor, tool, roll);

    const { requestCleanup } = await import("./gm-bridge.mjs");
    const { rollInHand } = await import("./action-rolls.mjs");
    await requestCleanup({
        actorId: actor.id,
        tokenId: null,
        key,
        targetId,
        // The roll the GM scores it on, as the two that aim at a trace name theirs (E08+E28 C17).
        rollId: rollInHand(actor)?.messageId ?? null,
        total: roll.total,
        isCritical: Boolean(roll.isCritical),
        withHope: Boolean(roll.withHope),
        viaAction,
        price: charge.pay,
        grant: Boolean(charge.grant)
    });
    return { roll };
}

/** Score a misleading trail or a body move. GM side. */
export async function resolveStageSix({
    actorId, key, targetId = null, total = 0, isCritical = false, withHope = false,
    viaAction = false,
    // Which step of the chain the client says it paid, and whether a Burst paid
    // it. Bounded here, like every other field that crossed a socket (T-1).
    price = null, grant = false
} = {}) {
    if (!game.user.isGM) return null;
    const actor = game.actors.get(actorId);
    const def = CLEANUP.actions?.[key];
    if (!actor || !def) return null;
    if (!viaAction && !isCleaner(actor)) return blockedOnGm(actor, price);

    /*
     * ONE OF THE THREE IS STAGE 6 ONLY, AND IT IS THE OBVIOUS ONE.
     *
     * Erasing a trace and planting one are things anybody can do on an ordinary
     * afternoon. Carrying a body is not: there has to be a body, `applyMoveBody`
     * reads it off `murderState()`, and a Tamper packet naming "moveBody" would
     * otherwise reach a function that assumes an incident it is not in.
     */
    if (viaAction && key === "moveBody") {
        error(`Refused a Tamper by ${actor.name}: a body is not an ordinary action.`);
        return null;
    }

    // The tool lowers the number it has to beat, "+(1*tier narzędzia)".
    /*
     * WHO MAY BE FRAMED, AND WHERE THE BODY HAS TO BE (E03, 24.09.2026; audit
     * S05-40). Both were asked on the killer's own client and nowhere else, so a
     * packet from the console could plant a trail pointing at the killer
     * themselves, the victim or a Monokuma - the three `framingCandidates`
     * leaves out - or carry the body off from a room the killer was not in.
     * Asked here before anything is paid.
     */
    if (key === "misleadingTrail" && !(await framingCandidates(actor)).some(a => a.id === targetId)) {
        return { refused: "that student cannot be framed" };
    }
    if (key === "moveBody" && !bodyIsHere(actor)) return { refused: "the body is not in the killer's room" };
    // The tool written down and the tier of its relief, as the GMs hold them (`resolveCleanup`'s note, fix r2-H20).
    const { actorAsHeld } = await import("./sheet-audit.mjs");
    const held = await actorAsHeld(actor);
    await noteCleaningTool(actor, held);

    const relief = def.toolBonusPerTier ? cleaningTier(held) * def.toolBonusPerTier : 0;
    const threshold = Math.max(0, (def.threshold ?? 0) - relief);
    const success = isCritical || total >= threshold;
    const band = isCritical ? "critical" : (withHope ? "hope" : "despair");

    /*
     * THE SERVER-SIDE PRICE, AND IT IS THE ONE THAT REPLACED THE OLD DOUBLE
     * CHARGE (T-1).
     *
     * A legitimate client has already paid the chain and says which step, so
     * charging here would be the second price this commit exists to delete. But
     * `requestCleanup`'s socket branch checks only that the sender owns the actor,
     * so a forged packet can simply omit the step - and then the Sanity is taken
     * here, exactly as it was before. One price per attempt, and the GM decides
     * which when the claim is missing.
     */
    const paidStep = validPrice(price);
    const free = await consumeFreeCleanup(actor);
    if (!paidStep && !free) await spendStress(actor);
    if (free) await waivePrice(actor, paidStep);
    const done = [];
    if (free) done.push(game.i18n.localize("DRPG.Cleanup.freeAttempt"));

    if (key === "misleadingTrail") await applyMisleadingTrail(actor, def, targetId, success, band, done);
    else if (key === "moveBody") await applyMoveBody(actor, def, success, band, done, targetId);

    const refund = success ? def.refundStress?.[band] : null;
    if (refund) {
        const gave = await handBack(actor, paidStep?.pay ?? null, refund);
        done.push(game.i18n.format(gave === "action"
            ? "DRPG.Cleanup.actionBack" : "DRPG.Cleanup.stressBack", { n: refund }));
    }

    // Three shapes for one idea lived here: this card led with an `<h3>`, the
    // one above with `<strong>Label</strong> -`, and the GM's copy below with a
    // third. All three are the same sentence - what was done, what it rolled,
    // what came of it - so all three are the header now.
    await whisperToOwner(actor, `${cardHead({
        action: def.label, total, result: `${success ? "≥" : "<"} ${threshold}`
    })}${done.length ? `<ul>${done.map(d => `<li>${d}</li>`).join("")}</ul>` : ""}`);
    await whisperToGms(`${cardHead({ action: def.label, total, result: band })}<p>${
        foundry.utils.escapeHTML(actor.name)} vs ${threshold}</p>`);

    log(`Stage 6 ${key}: ${actor.name} rolled ${total} vs ${threshold} - ${band}.`);
    return { success, band, done };
}

/**
 * Plant something that points at somebody else.
 *
 * A failure still plants it, which is the guide's own reading - "Nieudane:
 * Morderca zostawia Faint Ukryty Prep Remnant wskazujący na wybranego gracza"
 * - so a botched frame-up is a bad frame-up rather than nothing. Only a Despair
 * failure leaves the room clean.
 */
async function applyMisleadingTrail(actor, def, targetId, success, band, done) {
    const visibility = success ? def.remnant?.[band] : def.failureRemnant?.[band];
    if (!visibility) {
        done.push(game.i18n.localize("DRPG.Cleanup.trailFailed"));
        return;
    }

    const framed = game.actors.get(targetId ?? "");
    await dropRemnant(actor, {
        type: def.remnantType ?? "prep",
        visibility,
        faint: success ? false : Boolean(def.failureFaint),
        /* THE KILLER'S TRAIL IS THE CRIME'S; ANYBODY ELSE'S IS NOBODY'S YET (E09 C4, 08.10.2026;
           audit S05-25). This was `true` for everybody, and a Tamper's frame is anybody's: an
           innocent's trail on a plain day was filed as evidence of a murder, ranked first in the
           dashboard and Observe, and spared by the chapter's sweep (tier 2 "an innocent's
           misleading trail is not tied to the crime"). The killer in
           Stage 6 ties it, as `leaveTamperTrace` does; anybody else leaves it undecided, so
           `placeRemnant`'s incident rule decides it and a GM can answer it. */
        tiedToCrime: isCleaner(actor) ? true : null,
        action: "resolution",
        pointsAt: framed?.id ?? null,
        subject: framed?.name ?? "",
        // TRAP 88 - WHO PLANTED IT, IN THE COLUMN A GM ACTUALLY READS.
        //
        // Now that an innocent player can plant these, the dashboard is the
        // only place the table's one deliberate lie can be seen for what it is.
        // The ledger already stores `sourceActor`/`sourceName`, but the note is
        // the line the Remnant list prints under the action - so it says both
        // ends of the lie: who left it, and who it accuses.
        note: game.i18n.format("DRPG.Cleanup.trailNote", {
            name: framed?.name ?? "?", visibility, by: actor.name
        })
    });

    done.push(game.i18n.format("DRPG.Cleanup.trailPlanted", {
        // A character's name is its owner's to write (S05-05, S04-10).
        name: foundry.utils.escapeHTML(framed?.name ?? "?"), visibility
    }));
}

/**
 * Carry the body out of the room it died in.
 *
 * The destination comes from the killer, picked before the roll and carried
 * here as `chosenRoom`. It is checked against `bodyDestinations` on this side
 * rather than trusted: the packet is a claim, and a body must not be moved
 * somewhere a living character could not walk to.
 *
 * The trace it leaves is dropped where the killer is standing, which is the
 * room the body left. That is the point of it: the guide gives every band an
 * Evident Resolution Remnant, because dragging a corpse is not subtle.
 */
async function applyMoveBody(actor, def, success, band, done, chosenRoom = null) {
    if (!success) {
        done.push(game.i18n.localize("DRPG.Cleanup.bodyStayed"));
        return;
    }

    const state = murderState();
    const victim = game.actors.get(state?.victimId ?? "");
    const here = locateActor(actor);
    if (!victim || !here?.room) {
        done.push(game.i18n.localize("DRPG.Cleanup.noBody"));
        return;
    }

    /*
     * WHERE IT GOES IS THE KILLER'S DECISION, NOT THE DICE'S.
     *
     * This used to take `def.rooms[band]` steps outward and pick a RANDOM room
     * at each one. Two things were wrong with that, and the second is the one
     * that matters: the killer could not aim. Dragging a body is the most
     * deliberate thing anybody does in this game - you move it because of what
     * is in the other room, or who is not - and the engine was rolling a die to
     * decide which door you went through. On a map with four exits it was three
     * chances in four of putting the body somewhere you would not have chosen.
     *
     * So the destination is chosen up front, before the roll, and travels as
     * `targetId`. The roll still decides WHETHER it moves; it no longer decides
     * where. `def.rooms` stays in the table as the reach - the picker offers the
     * rooms connected to this one - and the random walk is gone.
     */
    const reachable = await bodyDestinations(here.room);
    let room = reachable.includes(chosenRoom) ? chosenRoom : reachable[0];

    if (!room) {
        // Nowhere to take it. Said out loud rather than silently leaving the
        // body where it is and reporting a success.
        done.push(game.i18n.localize("DRPG.Cleanup.bodyNowhere"));
        return;
    }

    const region = Array.from(here.scene?.regions ?? []).find(r => r.name === room);
    const tokenDoc = here.scene?.tokens?.find(t => t.actorId === victim.id) ?? null;

    /*
     * A BODY THAT DID NOT MOVE LEAVES NO DRAG MARKS (E09 C11, 08.10.2026; audit S05-47). A teleport that threw, or a
     * room or a body token this scene does not hold, said "There is nowhere to take it" - `bodyNowhere`'s words for a
     * different thing - and went on to drop the evident trace "dragged from here towards" the room, so the GMs held a
     * trail of a move that never happened, beside a body still lying where it fell. It stops here now, as the other
     * two answers above do; `bodyStuck` says the body would not move, and the critical's hand-back stands, as it does
     * for those two.
     */
    let moved = false;
    if (region && tokenDoc) {
        try {
            await region.teleportTokens([tokenDoc], { placement: "random", snap: true, pan: false });
            moved = true;
        } catch (err) {
            error("Could not move the body", err);
        }
    }
    if (!moved) {
        done.push(game.i18n.localize("DRPG.Cleanup.bodyStuck"));
        return;
    }
    done.push(game.i18n.format("DRPG.Cleanup.bodyMoved", { room }));

    const visibility = def.remnant?.[band] ?? "evident";
    await dropRemnant(actor, {
        type: def.remnantType ?? "resolution",
        visibility,
        tiedToCrime: true,
        action: "resolution",
        subject: victim.name,
        note: game.i18n.format("DRPG.Cleanup.bodyNote", { name: victim.name, room })
    });
    done.push(game.i18n.format("DRPG.Cleanup.leftTrace", { visibility }));
}

/* ==========================================================================
 * TAKING A CLEAN-UP BACK - the Reroll's other half
 * --------------------------------------------------------------------------
 * Kept on the GMs' browsers rather than in a world setting, unlike the incident's
 * own receipt in murder.mjs. What it holds is the answer key: the full creation
 * data of a Remnant, including how visible it is and what it really is. Writing
 * that into the murder state would publish it to every player's console - see
 * truth-bullets.mjs for the same reasoning about the ledger.
 *
 * A GM STORE SINCE E08+E28 C3 (1.2.67; audit S05-44): `cleanupAttemptStore`, a row
 * per character. It was a Map on the browser that resolved the attempt, so a GM
 * who reloaded mid-Stage-6 could not replay a clean-up, and another GM never
 * could. A row is written whole when an attempt ends (`keepAttempt`), amended by
 * the reshape ruling that fills in what it changed, and dropped by the undo and by
 * an attempt that ends without one (`forgetAttempt`).
 * ========================================================================== */

/**
 * Every field of a receipt, each written, so a row holds one attempt's and nothing of the one before it.
 * `proposal` is a reshape's words as the card put them (`proposeReshape`); `ruled` is never on a
 * receipt - the ruling writes it (`claimRuling`) - and is listed so a new attempt clears it.
 */
const RECEIPT_FIELDS = ["actorId", "tokenId", "attempt", "free", "stressBefore", "stressAfter",
    "erased", "leftBehind", "transformed", "handedBack", "proposal", "ruled"];

/**
 * What a character's last clean-up attempt did, as the GMs' store holds it; null for none.
 * Exported for the Reroll's question before its payment (reroll.mjs `replayRefusal`).
 */
export async function attemptOf(actorId) {
    await cleanupAttemptStore.whenHydrated();
    return cleanupAttemptStore.get(actorId ?? "") ?? null;
}

/**
 * The receipt of an attempt, over whatever the row held. A reshape keeps it twice - once before its
 * card goes (`proposeReshape`), once when the attempt ends - and a ruling may land between the two
 * (E09 C10, 08.10.2026): its `ruled`, its `transformed`, a decline's `erased`. So the second write
 * of the SAME attempt leaves what the receipt does not hold as the row has it, and only a new
 * attempt nulls every field.
 */
function keepAttempt(receipt) {
    const again = cleanupAttemptStore.get(receipt.actorId)?.attempt === receipt.attempt;
    return cleanupAttemptStore.patch(receipt.actorId,
        Object.fromEntries(RECEIPT_FIELDS.map(f => [f, receipt[f] ?? (again ? undefined : null)])));
}

/** No receipt: the last attempt is not this character's to take back any more. */
async function forgetAttempt(actorId) {
    await cleanupAttemptStore.whenHydrated();
    if (cleanupAttemptStore.has(actorId)) await cleanupAttemptStore.drop(actorId);
}

/**
 * The attempt a clean-up roll made, on the GMs' bookmark of that roll (E08+E28 C2): the
 * receipt's `attempt` id, which a reshape card carries too. Only once the attempt is the one
 * the GMs keep - a road that refused kept none. A replay writes its own attempt over the
 * first, as it replaces the first's receipt in the store.
 */
async function keepAttemptFact(rolls, roll, actorId, receipt) {
    if (cleanupAttemptStore.get(actorId)?.attempt !== receipt.attempt) return;
    await rolls.noteFactOn(roll, { cleanupAttempt: receipt.attempt });
}

/**
 * Enough to build this Remnant again where it stood, with everything it knew.
 *
 * `placeRemnant` takes exactly this shape, so recreating is handing the flags
 * back rather than reconstructing them from a summary.
 *
 * THE TOKEN'S ID COMES BACK TOO (E08+E28 C3, 03.10.2026; audit S05-07). It was
 * the one thing that did not: the undo re-placed the trace without it, so
 * Foundry minted a new one and the replay that followed looked for the old id -
 * "vanished", the trace standing, the Sanity charged. `_id` here and `keepId` in
 * `undoLastCleanup` put it back under the id it had, so what keys off the id
 * holds as it was: a Truth Bullet's `remnantId`, the already-copied check that
 * stops one character copying one trace twice, and the ledger row's key.
 */
function recreationDataFor(token) {
    // FROM THE LEDGER, NOT THE TOKEN (CASE-06). Since the answer key moved
    // off the tokens a token carries only `isRemnant`, and reading the flags
    // here brought every trace back as an Evident Prep Remnant with no
    // source, no room, no stamp and an explicit "not tied" - a Reroll that
    // rewrote the evidence. Captured before `removeRemnant` tombstones the row.
    const d = remnantData(token);
    if (!d) return null;
    return {
        _id: token.id,
        x: token.x,
        y: token.y,
        sceneId: token.parent?.id ?? null,
        type: d.type,
        visibility: d.visibility,
        faint: Boolean(d.faint),
        reinforced: Boolean(d.reinforced),
        // Three states (E09 C4): put back as it stood, undecided included (`placeRemnant`'s `keepId`).
        tiedToCrime: tieState(d.tiedToCrime),
        note: d.note ?? "",
        action: d.action ?? "manual",
        subject: d.subject ?? "",
        pointsAt: d.pointsAt ?? null,
        sourceActor: d.sourceActor ?? null,
        sourceName: d.sourceName ?? "",
        itemIdentity: d.itemIdentity ?? null,
        room: d.room ?? null,
        chapter: d.chapter ?? null,
        day: d.day ?? null,
        timeOfDay: d.timeOfDay ?? null,
        // How old it is: a trace put back is not a fresh one (E03 third review).
        placedAt: d.placedAt ?? token._stats?.createdTime ?? null,
        // What a player was to be shown, re-applied after re-placing.
        public: d.public ?? null
    };
}

/*
 * A RECEIPT'S "NOT TIED" FROM BEFORE THE THIRD STATE (E09 fix r1-G2, 08.10.2026; the round-1
 * correctness review's F5). A receipt holds the trace's tie as it stood (`erased`, the reshape's
 * `transformed.from`) - through `Boolean()` until E09 C4, so a receipt kept from before the upgrade
 * says "not tied" for a trace nobody had decided, and gm-stores.mjs `settleTieStates` reads the
 * ledger's rows only: its undo wrote the old `false` back as a GM's "not tied" after the step, and
 * a death then left the trace alone. A `false` in a receipt field stamped before the step's mark
 * (`caseMark().tiesSettledAt`, a store stamp), or in a world whose step has not run, goes back
 * undecided; one stamped since is a GM's of today and goes back as it was (tier 2 "a clean-up
 * receipt's not tied from before the upgrade goes back undecided"). A receipt written in the
 * seconds between a load and its step reads as old - read in the code, not measured at a table.
 * Anything but `false` goes back as the receipt holds it: a receipt from before E08+E28 C3 has no
 * tie in `from`, and `retuneRemnant` leaves the tie alone for an `undefined`.
 */
function receiptTie(actorId, field, tie) {
    if (tie !== false) return tie;
    const settledAt = caseMark().tiesSettledAt;
    return Number.isFinite(settledAt) && cleanupAttemptStore.stampOf(actorId, field) >= settledAt ? false : null;
}

/**
 * Put the room back the way it was before this actor's last clean-up attempt.
 *
 * Order matters: the trace it left behind goes first, then the one it erased
 * comes back, then the Sanity. Doing it the other way round would briefly leave
 * two traces describing the same wipe, and `cleanableRemnants` runs off exactly
 * that list.
 */
async function undoLastCleanup(actor, tokenId) {
    const receipt = await attemptOf(actor.id);
    if (!receipt) {
        await whisperToGms(`<p class="drpg-warning">${
            game.i18n.localize("DRPG.Cleanup.rerollLost")}</p>`);
        return false;
    }
    if (receipt.tokenId !== tokenId) {
        error(`Cleanup reroll: the recorded attempt was on a different trace (${receipt.tokenId}).`);
        // Same contract as a lost receipt: the caller aborts, and the GMs are
        // told. The Reroll asks this before its payment (reroll.mjs `replayRefusal`),
        // so only a receipt that changed while the dice were thrown again reaches
        // here, and that Reroll is given back (fix r1-G3).
        await whisperToGms(`<p class="drpg-warning">${
            game.i18n.localize("DRPG.Cleanup.rerollLost")}</p>`);
        return false;
    }

    if (receipt.leftBehind?.id) {
        try {
            const scene = receipt.leftBehind.sceneId
                ? game.scenes.get(receipt.leftBehind.sceneId)
                : null;
            await scene?.tokens?.get(receipt.leftBehind.id)?.delete();
        } catch (err) {
            error("Could not take back the trace a rerolled clean-up left", err);
        }
    }

    if (receipt.erased) {
        try {
            const { placeRemnant } = await import("./remnants.mjs");
            const { public: pub, ...data } = receipt.erased;
            data.tiedToCrime = receiptTie(actor.id, "erased", data.tiedToCrime);
            // Under the id it had (`recreationDataFor`).
            const back = await placeRemnant(data, { keepId: true });
            // The words it had, onto the ledger alone: the copies already held kept theirs
            // through the erase, and through a reshape before it (E09 C9, `reshapeTrace`).
            if (back && pub) await setRemnantPublic(back, pub, { propagate: false });
            // Marked as put back: a later Reroll does not lift or retune it, found
            // or not (`removalRefusal`, asked by reroll.mjs `traceKept`).
            if (back) {
                const { setRemnantSecret } = await import("./remnants.mjs");
                await setRemnantSecret(back, { restored: true });
            }
        } catch (err) {
            error("Could not put back the Remnant a rerolled clean-up erased", err);
        }
    }

    // G-20's other half. A rewritten trace was never deleted, so putting it
    // back is a second retune rather than a re-creation - and it has to happen,
    // or a Reroll would leave the relabelling standing on top of a roll that no
    // longer produced it.
    //
    // BOTH HALVES, since a reshape now writes two different kinds of fact: what
    // the trace is, and what it says. Restoring only the type would put a Tamper
    // Remnant back to being an Incident Remnant while leaving the killer's
    // invented name on it - a state no roll has ever produced.
    if (receipt.transformed?.from) {
        try {
            const { retuneRemnant, setRemnantPublic } = await import("./remnants.mjs");
            // `from` carries the tie (E08+E28 C3), so a reshape's tie goes back with it.
            const from = receipt.transformed.from;
            await retuneRemnant(receipt.transformed.sceneId, receipt.transformed.id,
                { ...from, tiedToCrime: receiptTie(actor.id, "transformed", from.tiedToCrime) });

            // `publicFrom` is null when nothing had ever been written for a
            // finder, and that is a real state rather than a missing one: the
            // empty payload is what `defaultPublic` rebuilds from.
            const back = receipt.transformed.publicFrom;
            const scene = receipt.transformed.sceneId
                ? game.scenes.get(receipt.transformed.sceneId) : canvas?.scene;
            const tokenDoc = scene?.tokens?.get(receipt.transformed.id);
            if (tokenDoc) {
                // The ledger alone (E09 C9): the reshape left the copies already held as they
                // were found, so there is nothing on them to take back. A copy found between the
                // reshape and this Reroll keeps the words its finder read (tier 2 "the Undo
                // restores the trace and leaves the copies").
                await setRemnantPublic(tokenDoc, {
                    name: back?.name ?? game.i18n.localize("DRPG.Remnant.tokenName"),
                    playerText: back?.playerText ?? ""
                }, { propagate: false });
            }
        } catch (err) {
            error("Could not put back the Remnant a rerolled clean-up rewrote", err);
        }
    }

    if (typeof receipt.stressBefore === "number") {
        try {
            /* THE ATTEMPT'S OWN SANITY, NOT THE TRACK AS IT STOOD (E03, 24.09.2026;
               audit S05-40). Writing `stressBefore` back also took away every mark
               earned since the attempt - so an undo sent long after, with other
               marks in between, wiped those too. Now the undo takes back what the
               attempt moved; a receipt from before `stressAfter` existed still
               writes the old value, which is what it recorded. A give-back, so the
               GMs' audit takes the credit the attempt left (fix r2-H6,
               resource-guard.mjs `stampOf`).
               HELD TO THE MAXIMUM THE GMS HOLD (E29 fix r2-H23, 06.10.2026). The ceiling
               was the Sanity maximum on the sheet, where a player's lowered maximum
               stands until the audit's put-back lands, and for good where it fails;
               written as the GM's, the marks given back are the GMs' from then on.
               Measured at e253b3a (e29run/r2h23red): a clean-up attempted at 3 marks
               and charged, then the player's console lowering the maximum to 1, its
               put-back refused: its Reroll left 1 mark on the sheet and in the GMs'
               mark, not the 3 before it. Now the ceiling is the GMs' (sheet-audit.mjs
               `meansMaxHeld`), read and written in one job of the student's queue
               (`gmMeansWrite`), as murder-rules.mjs `undoLastCrisis` reads the end of its
               marks. The marks themselves are read off the sheet as before: a
               player's write of them stands - a mark taken as a price, one cleared
               flagged or listed (`gainVerdict`) - and the mark moves with it. The
               wait holds up nothing that holds it up, by reading: all a judgement
               waits for that it does not do itself is its own writer's consumption
               of an item or roll card, and this rewind writes as a GM;
               `resolveCleanup` waits on the same queue after it (`actorAsHeld`). */
            const moved = typeof receipt.stressAfter === "number"
                ? receipt.stressAfter - receipt.stressBefore : null;
            const { gmMeansWrite, meansMaxHeld } = await import("./sheet-audit.mjs");
            await gmMeansWrite(actor, async () => {
                const ceiling = meansMaxHeld(actor, "stress") || Infinity;
                const value = moved === null
                    ? receipt.stressBefore
                    : Math.min(ceiling, Math.max(0, resourceValue(actor, "stress") - moved));
                await trustedWrite(actor, {
                    "system.resources.stress.value": value
                }, { reason: "reroll", giveBack: true });
            });
        } catch (err) {
            error("Could not refund the Sanity a rerolled clean-up spent", err);
        }
    }

    /*
     * AND AN ACTION THE CRITICAL HANDED BACK (T-1).
     *
     * `stressBefore` rewinds the Sanity track and nothing else, so every replay
     * of an action-paid critical erase would have minted one action. `takeBackRefund`
     * takes what was given rather than spending afresh, which is the same tool the
     * Reroll's own action settlement drives.
     */
    if (receipt.handedBack?.pay === "action") {
        try {
            const { takeBackRefund } = await import("./actions.mjs");
            await takeBackRefund(actor, receipt.handedBack.amount, receipt.handedBack);
        } catch (err) {
            error("Could not take back the action a rerolled critical handed over", err);
        }
    }

    await cleanupAttemptStore.drop(actor.id);
    return true;
}

/**
 * The step of Tamper's chain a packet claims, or null.
 *
 * BOUNDED BECAUSE IT CROSSED A SOCKET. The amount comes from the table rather
 * than from the packet - there is nothing to gain by claiming "stress" and a lot
 * to gain by claiming five of it.
 */
function validPrice(price) {
    return PRICE_CHAINS.tamper.steps.find(step => step.pay === price) ?? null;
}

/**
 * Give back what a refused attempt paid on the player's browser, and answer the line that says so ("" for none).
 *
 * A REFUSAL ON THE GM KEPT THE PRICE (E09 C11, 08.10.2026; audit S05-46). Since T-1 the price is paid on the player's
 * browser before the dice (`chargeTamper`), so the GM's side has nothing of its own to hold back when it refuses: a
 * trace the GM reinforced while the dice were in the air answered "it will not come off" and the action or the Sanity
 * mark stayed spent, and the comment above the check said the Sanity was not taken. Given back here as the step
 * `validPrice` names, read off the table, never off the packet; a Burst claimed comes back as an action, as the
 * critical's does (`handBack`), since this side cannot tell a Burst from an action. Quiet, because the line goes
 * into the refusal's own whisper rather than a second card.
 */
async function refundRefused(actor, price) {
    const step = validPrice(price);
    if (!step) return "";
    const receipt = { pay: step.pay, amount: step.amount, grant: false };
    const landed = await refundPrice(actor, receipt, { quiet: true });
    return landed ? `<p>${game.i18n.format("DRPG.Price.refunded", { what: priceLabel(receipt) })}</p>` : "";
}

/**
 * An attempt that reaches the GM after its Stage 6 has stopped being the asker's: said, and the price given back.
 *
 * A SILENT NULL UNTIL E09 C11 (08.10.2026; audit S05-46). A GM who closed the incident while the killer's dice were
 * in the air left both resolvers answering null and telling nobody: the killer had paid on their own browser and
 * heard nothing. The reason is `cleanupBlocker`'s, in the words the sheet uses before the dice (`refuseCleanup`).
 * Not null, so the bridge does not add a refusal of its own to the whisper.
 */
async function blockedOnGm(actor, price) {
    const why = cleanupBlocker(actor) ?? "notYours";
    log(`Refused a clean-up by ${actor.name} on the GM: ${why}.`);
    await whisperToOwner(actor, `<p>${game.i18n.localize(`DRPG.Cleanup.blocked.${why}`)}</p>${
        await refundRefused(actor, price)}`);
    return { removed: false, success: false, blocked: why };
}

/**
 * Give back what the attempt paid: the step, not "a Sanity mark".
 *
 * The critical's own line is "Morderca odzyskuje 1 stres", and until T-1 that was
 * literally what happened - so a critical Tamper paid for with an action cleared
 * a Sanity mark the attempt never made, healing the killer for cleaning up.
 *
 * WRITTEN FOR A BAND TABLE, not for `critical`. Two of the three callers read
 * `refundStress?.[band]`, so a rebalance that hands something back on an ordinary
 * success arrives here unchanged.
 *
 * A BURST COMES BACK AS AN ACTION, not as a Burst. This runs on the GM's client
 * on a claim it cannot verify, and a Burst pays for a whole call however much it
 * costs - so it is worth more than the action it replaced. The exposure is capped
 * at one action per critical, which is the cheaper of the two mistakes.
 *
 * @returns {Promise<"action"|"stress">} what was handed back.
 */
async function handBack(actor, price, amount = 1, receipt = null) {
    if (price === "action") {
        const { refundAction } = await import("./actions.mjs");
        await refundAction(actor, amount);
        // Recorded so a Reroll can take it back: `stressBefore` rewinds Sanity
        // and nothing else, so an action handed back once per replay would be
        // minted out of nothing.
        if (receipt) receipt.handedBack = { pay: "action", amount, grant: false };
        return "action";
    }
    await restoreStress(actor, amount);
    return "stress";
}

/**
 * Mark the resolution's Sanity cost on an actor - the raw write, thrown on
 * failure. The clean-up's `spendStress` below swallows the error; the
 * incident's (murder.mjs) lets it surface and pays in Health when the track
 * is full. Both used to carry their own copy of this line.
 *
 * A PRICE (E29 fix r1-G7, 05.10.2026; the round-1 security review's M2). It named
 * `concealment`, and a bystander's browser read that word on the killer's Sanity -
 * written on the GM for a crisis action and a clean-up's or a Stage 6 attempt's price,
 * on the killer's own browser for a concealment roll (`concealFromWitnesses`). A rise of
 * marks stands without a judge, so it names what it is, the action's price, which says
 * nothing of who is in the incident; from a GM no reason goes at all (resource-guard.mjs
 * `stampOf`).
 */
export async function markResolutionStress(actor) {
    // Held to the marks and the maximum the GMs hold on a GM's client (sheet-audit.mjs `meansWrite`, E29 fix r2-H24): a
    // console's lowered maximum, not put back yet, read as a full track there and sent the price to Health. The
    // killer's own concealment roll reads its sheet, as before.
    const { meansWrite } = await import("./sheet-audit.mjs");
    return meansWrite(actor, async ({ stress: marks }, maxOf) => {
        const max = maxOf("stress") ?? 0;
        if (marks >= max) return false;
        await trustedWrite(actor, {
            "system.resources.stress.value": Math.min(max, marks + RESOLUTION_STRESS_COST)
        }, { reason: "price" });
        return true;
    });
}

async function spendStress(actor) {
    try {
        await markResolutionStress(actor);
    } catch (err) {
        error("Could not charge the Sanity for a clean-up", err);
    }
}

/**
 * THE FREE CLEAN-UP ATTEMPT (E32+E07 C13, 03.10.2026; audit S04-07, the owner's D13): whether
 * this attempt is the one a critical Finishing blow paid for, and if it is, spent - the first
 * attempt that reaches its price, hit or miss, and no other. Asked where each attempt pays
 * (`resolveCleanup`, both roads, and `resolveStageSix`), after every refusal, so a refused
 * attempt keeps it. GM-side: the grant is in the GMs' cast (murder.mjs `freeCleanup`, held
 * null in every player's copy).
 */
export async function consumeFreeCleanup(actor) {
    if (!game.user.isGM || !actor) return false;
    try {
        return await spendFreeCleanup(actor.id);
    } catch (err) {
        error("Could not spend the free clean-up attempt", err);
        return false;
    }
}

/**
 * The price the free attempt does not owe (E32+E07 C13). The GM's side charges it nothing -
 * a packet that claims no step skips `spendStress` - but a legitimate client has already paid
 * its mark before the dice (`chargeTamper`: the killer's own chain starts at the Sanity), and
 * it cannot know the mark is not owed, since the grant is the GMs'. So that mark is lifted
 * again. Only a Sanity step: an action is never the killer's price in their own Stage 6
 * (`tamperPriceSkip`), and handing an action back on a claim nobody can check is what
 * `handBack` already weighs for the critical. Lifted after `stressBefore` is read, so a
 * Reroll's rewind puts the mark back and the replay, told by its receipt that it was the
 * free one, lifts it again.
 */
async function waivePrice(actor, paidStep) {
    if (paidStep?.pay === "stress") await restoreStress(actor, paidStep.amount);
}

/**
 * Hand Sanity back. Sanity is a reverse resource, so "restoring" it is
 * subtracting marks - the same direction `use-items.mjs` moves it.
 */
async function restoreStress(actor, amount = 1) {
    const marks = resourceValue(actor, "stress");
    if (marks <= 0) return;
    try {
        await trustedWrite(actor, {
            "system.resources.stress.value": Math.max(0, marks - amount)
        }, { reason: "refund" });
    } catch (err) {
        error("Could not give back the Sanity a critical clean-up earned", err);
    }
}

/**
 * Two different messages on purpose.
 *
 * The killer is told what happened to the scene. The GMs are told that plus the
 * threshold it was measured against, because that number is the answer key and
 * the killer must not learn how visible their own traces are by subtraction.
 */
async function report(actor, data, {
    band, success, total, dc, done, viaAction = false,
    /** What the attempt paid, as a price receipt, or null when nothing said. */
    charged = null
}) {
    const summary = done.map(line => `<li>${line}</li>`).join("");

    /*
     * The killer's card, and on a miss it carries a sound.
     *
     * `resolveCleanup` is GM-side, so this goes on the message rather than
     * through `playSfx` - same reason as the broken tool. Failure only: a
     * successful wipe removes a trace the killer selected and is already
     * watching, while a miss spends the Sanity, leaves what they were scrubbing
     * at, and on Despair adds an Obvious one they did NOT choose and are not
     * told about.
     */
    await whisperToOwner(actor, `
        <h3>${game.i18n.localize("DRPG.Cleanup.title")}</h3>
        <p><strong>${game.i18n.localize(`DRPG.Cleanup.band.${band}`)}</strong></p>
        ${summary ? `<ul>${summary}</ul>` : ""}
        ${charged
            // What was really taken, rather than which door the attempt came
            // through: since T-1 the two no longer decide each other (a killer
            // pays Sanity from the tile, and an investigator in Stage 6's window
            // pays an action).
            ? `<p><small>${paidLine(charged)}</small></p>`
            : `<p><small>${game.i18n.format("DRPG.Cleanup.stressSpent", {
                n: RESOLUTION_STRESS_COST })}</small></p>`}`,
        success ? {} : { flags: { [MODULE_ID]: { sfx: "cleanupFailed" } } });

    await whisperToGms(`
        <h3>${game.i18n.localize("DRPG.Cleanup.title")}</h3>
        <p>${game.i18n.format("DRPG.Cleanup.gmLine", {
            actor: foundry.utils.escapeHTML(actor.name),
            what: foundry.utils.escapeHTML(`${data.visibilityLabel} ${data.typeLabel}`),
            total,
            dc: dc ?? "-",
            verdict: game.i18n.localize(success ? "DRPG.Cleanup.hit" : "DRPG.Cleanup.miss")
        })}</p>
        ${summary ? `<ul>${summary}</ul>` : ""}`);
}

/* ==========================================================================
 * THE KILLER'S SCREEN
 * ========================================================================== */

/**
 * Pick something to wipe.
 *
 * What the killer is shown is what their character can now see - Stage 6 is the
 * point at which the guide lets them look at their own traces - but NOT how hard
 * any of it is to erase. The threshold comes from a Remnant's visibility, and
 * showing it would hand them a reading of how much evidence they left, which is
 * the trial's whole question. Reinforced traces are the exception and are named
 * outright: "this one is not going anywhere" is a decision they have to be able
 * to make.
 *
 * `cleanableRemnants(actor)` cannot be called here directly and expect
 * anything back - `remnantData()`, underneath it, answers `null` for every
 * client that is not a GM, which is the correct answer to "what does this
 * client know about the ledger" and the wrong list to hand a killer. The GM
 * client that actually holds the ledger has to compute this, which is exactly
 * what `requestCleanableTraces` asks for: a GM runs it locally, a player asks
 * over the bridge and gets back only what `cleanableTracesForPlayer` (in this
 * same file) is willing to say - no DC, no `tiedToCrime`.
 */
export async function openCleanupDialog(actor) {
    if (!isCleaner(actor)) return refuseCleanup(actor);

    const { requestCleanableTraces } = await import("./gm-bridge.mjs");
    const traces = await requestCleanableTraces(actor.id);
    if (!traces.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Cleanup.nothingHere"));
        return null;
    }

    // Every trace here refuses to be removed. The picker would open with every
    // option disabled, no value to submit, and a confirm button that did nothing
    // - a dead end that looks like a bug. Say what is actually true instead.
    if (traces.every(t => t.reinforced)) {
        ui.notifications.warn(game.i18n.localize("DRPG.Cleanup.allReinforced"));
        return null;
    }

    const options = traces.map(t =>
        `<option value="${t.id}"${t.reinforced ? " disabled" : ""}>${
            foundry.utils.escapeHTML(t.label)}</option>`
    ).join("");

    const tool = cleaningTool(actor);
    const DialogV2 = foundry.applications.api.DialogV2;
    const { dialogContent } = await import("./utils.mjs");

    const picked = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Cleanup.title") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p>${game.i18n.format("DRPG.Cleanup.intro", { n: RESOLUTION_STRESS_COST })}</p>
            <p class="notes">${tool
                ? game.i18n.format("DRPG.Cleanup.withTool", {
                    item: foundry.utils.escapeHTML(tool.name), tier: cleaningTier(actor)
                })
                : game.i18n.localize("DRPG.Cleanup.bareHands")}</p>
            <label>${game.i18n.localize("DRPG.Cleanup.which")}
                <select name="trace">${options}</select></label>
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Cleanup.confirm"), default: true,
                callback: (e, b, d) => d.element.querySelector("[name=trace]").value
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!picked || picked === "cancel") return null;
    return attemptCleanup(actor, picked);
}

/**
 * Every room a body can be dragged into from here.
 *
 * ONE LIST, BOTH SIDES. The picker offers these and the resolver honours these,
 * from this one function, because the alternative is two copies of a rule that
 * have to be remembered together - and D11 shipped with exactly that shape and
 * exactly one of the two copies updated. A destination the picker cannot show
 * is a destination the resolver will not use, by construction.
 *
 * ADJACENCY (Dawid, 29.08). `neighbouringRooms` is the same reach a living
 * character walks by, so dragging a corpse cannot cross a building. Where a map
 * measures badly - bounding boxes overlap where rooms do not - the GM's
 * `drpgNeighbours` flag on the region is the override, and it is the same
 * override ordinary movement reads.
 *
 * BEDROOMS ARE NEVER A DESTINATION (Dawid, 29.08, new rule). A bedroom belongs
 * to one student, it locks, and the only people who can open it are its owner
 * and whoever holds the key - so a body left in one is not hidden, it is
 * ADDRESSED: it names a suspect the map chose rather than the killer. Framing
 * somebody is a move this game already sells, by name, for a price ("Misleading
 * trail"), and letting Move the body do it for free undercuts the action that
 * is supposed to cost something.
 *
 * `vaultOwnerOf` is the same flag the doors and keys read, so a room stops
 * being a legal destination the moment a GM assigns it, with nothing to keep in
 * step.
 *
 * Every neighbour being a bedroom returns an empty list, which the callers
 * already read as "there is nowhere to take it" - the honest answer.
 */
async function bodyDestinations(room) {
    if (!room) return [];
    const { neighbouringRooms } = await import("./movement.mjs");
    const { vaultOwnerOf } = await import("./vault.mjs");
    return neighbouringRooms(room)
        .filter(r => r !== room)
        .filter(r => !vaultOwnerOf(r));
}

/**
 * Where the body is going.
 *
 * Asked before the roll, because it is a decision and not a result: the killer
 * is choosing which room to leave a corpse in, and that choice is most of what
 * Stage 6 is about. The list is `bodyDestinations`: the rooms connected to the
 * one the body is lying in, minus anybody's bedroom.
 */
export async function openMoveBodyDialog(actor) {
    if (!isCleaner(actor)) return refuseCleanup(actor);
    if (!bodyIsHere(actor)) {
        ui.notifications.warn(game.i18n.localize("DRPG.Cleanup.bodyNotHere"));
        return null;
    }

    const here = locateActor(actor);
    const rooms = await bodyDestinations(here?.room ?? "");

    if (!rooms.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Cleanup.bodyNowhere"));
        return null;
    }

    const DialogV2 = foundry.applications.api.DialogV2;
    const { dialogContent } = await import("./utils.mjs");

    const picked = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Cleanup.moveTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p>${game.i18n.format("DRPG.Cleanup.moveIntro", {
                room: foundry.utils.escapeHTML(here?.room ?? "-"),
                n: RESOLUTION_STRESS_COST
            })}</p>
            <p class="notes">${game.i18n.localize("DRPG.Cleanup.moveAlwaysTrace")}</p>
            <label>${game.i18n.localize("DRPG.Cleanup.moveWhere")}
                <select name="room">${rooms.map(r =>
                    `<option value="${foundry.utils.escapeHTML(r)}">${foundry.utils.escapeHTML(r)}</option>`
                ).join("")}</select></label>
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Cleanup.moveConfirm"), default: true,
                callback: (e, b, d) => d.element.querySelector("[name=room]").value
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!picked || picked === "cancel") return null;
    return attemptStageSix(actor, "moveBody", picked);
}

/* ==========================================================================
 * CLOSING THE STAGE
 * ========================================================================== */

/**
 * Stage 6 is over: destroy the tools it used up.
 *
 * `CLEANUP.destroysTools` has declared for some time that a crime tool used in
 * an incident is destroyed, and nothing was destroying anything. The cleaning tool
 * goes the same way and for the same reason - one crime scene, one set of
 * gloves, broken at the discovery (`destroyCleaningTools`). Both are read from
 * what the incident wrote down (`rememberedTools`): an unopened spare in the
 * stash is not a thing that was used.
 *
 * Called by `endMurder` for every killer of an incident that reached Stage 6, so
 * it also covers a GM closing an incident by hand - and only then (E32+E07 C12;
 * audit S04-17): the rules use the crime tool up in Stage 6, so a fight closed
 * before it breaks nothing, a weapon swung in it included.
 */
export async function endResolution(actor) {
    return destroyTools(actor, CLEANUP.destroysTools);
}

/**
 * Stage 7's half: the gloves come off when the body turns up.
 *
 * Called by `discoverBody`, which is the moment the guide names, with the bodies it
 * found (`found`: the named victim and every dead body in the room). The killer is
 * read off the incident state rather than passed in, because by then whoever
 * closed the murder is not necessarily the person holding the tool.
 *
 * Every killer, not the first one. An accomplice cleaning alongside them is
 * holding a tool of their own, and leaving it in their bag after the body turns
 * up is a Truth Bullet the guide says should no longer exist.
 *
 * AND A CLOSED INCIDENT'S KILLERS TOO (E32+E07 C12, 02.10.2026; audit S04-20,
 * S05-23). The table's usual order is the GM closing the night and somebody
 * finding the body in the morning, and by then `endMurder` has wiped the incident:
 * `killerIds()` answered nobody, and nothing broke. So the killers are the running
 * incident's, this chapter's Blackened (the register outlives the close), and
 * everybody the GMs' `usedTools` ledger wrote a tool down for - each once.
 *
 * ONLY THE KILLERS OF THE BODIES FOUND (E32+E07 fix r2-G3, 03.10.2026; the round-2 review's
 * C2-m2). This broke for every killer of the chapter whatever body was found, so with two
 * incidents in a chapter - a betrayal, an ordinary evening - the first discovery broke the
 * betrayer's gloves while their victim was a death nobody had found (the owner's Q3: it counts
 * nowhere until found), and took the rows, so a second discovery broke by the hand whatever a
 * Blackened had readied since. A killer counts now when a body found is theirs: the running
 * incident's killers for its victim, a Blackened whose register row names one, a ledger row
 * whose `victims` names one (`noteCleaningTool`). A row or a register row that names no
 * victims - written before this fix - counts at every discovery, as all of them did. The
 * bodies found come off a row's `victims`, and the row goes when none is left: the tools it
 * named are broken now, or were stashed, lost or broken before, and a later discovery of the
 * killer's other victim reads the row (its broken tools left alone) rather than the hand. A
 * row is a killer's, not a body's: one who killed twice and cleaned up after both loses every
 * tool it names at the first of the two bodies found.
 */
export async function destroyCleaningTools(found = []) {
    if (!game.user.isGM) return [];
    await usedToolStore.whenHydrated();
    const bodies = new Set(found);
    const named = victims => (Array.isArray(victims) ? victims.filter(id => typeof id === "string" && id) : []);
    const meets = victims => !named(victims).length || named(victims).some(id => bodies.has(id));
    const rows = usedToolRows();
    const state = murderState();
    const killers = new Set([
        ...(state?.victimId && bodies.has(state.victimId) ? killerIds(state) : []),
        ...blackenedIds().filter(id => meets(blackenedStore.get(id)?.victims)),
        ...Object.keys(rows).filter(id => meets(rows[id].victims))
    ]);
    const destroyed = [];
    for (const id of killers) {
        const killer = game.actors.get(id);
        if (!killer) continue;
        destroyed.push(...await destroyTools(killer, CLEANUP.destroysToolsOnDiscovery ?? []));
    }
    const read = [...killers].filter(id => rows[id]);
    const left = Object.fromEntries(read
        .map(id => [id, named(rows[id].victims).filter(v => !bodies.has(v))])
        .filter(([, victims]) => victims.length));
    const gone = read.filter(id => !left[id]);
    try {
        if (gone.length) await usedToolStore.dropMany(gone);
        for (const [id, victims] of Object.entries(left)) await usedToolStore.patch(id, { victims });
    } catch (err) {
        error("Could not take the used Cleaning Tools off the ledger after the discovery", err);
    }
    return destroyed;
}

/** The `usedTools` rows of the clock's chapter and season, by character. GM-side. */
function usedToolRows() {
    return Object.fromEntries(Object.entries(usedToolStore.entries()).filter(([, row]) => isThisChapters(row)));
}

/**
 * Every row this GM's browser holds, of any chapter, taken away: the chapter's end
 * (chapter.mjs `applyChapterEnd`) and the season reset. Another GM's browser drops
 * its copy by the tombstones, as `clearBlackened` does it.
 */
export async function clearUsedTools() {
    if (!game.user.isGM) return;
    if (isPrimaryGm()) await usedToolStore.clear();
    else await usedToolStore.dropMany(Object.keys(usedToolStore.entries()));
}

/**
 * RUINED, NOT VANISHED.
 *
 * These used to be deleted, and deleting them is the one outcome that costs the
 * killer nothing: the murder weapon left the world by itself, tidily, the
 * instant it stopped being useful. The guide's sentence is that the tool "zostaje
 * usunięte z ekwipunku" - removed from what you can use - and the module read
 * that as removed from existence.
 *
 * It stays now, marked Broken, in the same slot and against the same carry
 * limit. Getting rid of it is the killer's own problem and their own decision:
 * throw it away and leave a trace somewhere, or put it in their bedroom stash.
 * See BROKEN_ITEMS in config.mjs and `discardBroken` in use-items.mjs.
 */
/**
 * The things this character used in the incident, as far as anything wrote them
 * down - or null when nothing could have, and the hand is the answer.
 *
 * THE WEAPON ONLY BY MEMORY (E32+E07 C12, 02.10.2026; audit S04-17). The swing is
 * a single identifiable moment and the cast wrote it down (CASE-04); a weapon
 * nobody swung was not used, so a failed opening, a trap or a fourth walking in
 * breaks nothing, however the killer is armed. There is no hand to fall back on.
 *
 * THE CLEANING TOOLS BY MEMORY TOO (the owner's D13; S05-38). They were left to
 * the hand - "several actions with possibly several rags" - and the hand let one
 * click put the gloves away before the body was found. Every tool a killer's scored
 * attempt had readied is in the `usedTools` row now; the hand answers only for a
 * character with no row this chapter - a killer the ledger never heard clean: an
 * older world's, a write that failed, or one who never cleaned, whose readied
 * gloves the discovery took before 1.2.66 too (the grid's DM02).
 *
 * Either way, a remembered thing gone from them, already ruined, or put in their
 * stash since is left alone - the weapon's old rule, without its fall back to the
 * hand.
 */
function rememberedTools(actor, category) {
    const kept = item => item && !isBroken(item) && !isStashed(item);
    if (category === "crimeTool") return [swungWeaponOf(actor)].filter(kept);
    if (category !== "cleaningTool") return null;
    const row = usedToolRows()[actor.id];
    return row ? row.cleaning.map(id => actor.items.get(id)).filter(kept) : null;
}

async function destroyTools(actor, categories) {
    if (!game.user.isGM || !actor || !categories?.length) return [];

    const { breakItem } = await import("./inventory.mjs");
    /*
     * AS THE GMS HOLD THEM (E29 fix r2-H20, 06.10.2026; H18's seam). What is broken is chosen off the killer's items
     * as the GMs hold them (sheet-audit.mjs `actorAsHeld`) - a stash, a break or a role a player's browser wrote and
     * the audit puts back spares nothing and arms nothing - and the documents are broken. The wait holds up nothing
     * that holds it up, by reading: a close and a discovery write no use's consumption and no roll's card. Until this
     * fix (4d1532c, e29run/r2h20red, 06.10.2026) gloves a clean-up wrote down, put in a stash where the GMs' mark did
     * not see it, were neither broken nor named by the discovery.
     */
    const { actorAsHeld } = await import("./sheet-audit.mjs");
    const held = await actorAsHeld(actor);
    const destroyed = [];
    for (const category of categories) {
        /*
         * WHAT WAS USED, and only then what is in hand.
         *
         * BY ROLE: the killer who wiped the scene with a rag filed under Tools
         * used a cleaning tool, and the guide's "the gloves come off when the
         * body turns up" is about what was used, not which row it sits in.
         *
         * BY MEMORY: with one hand (E9) a killer holds the knife for the murder
         * and the gloves for the clean-up, so reading the hand at closing time
         * would spare the murder weapon every single time. The swing wrote down
         * what it swung, and the clean-up what it cleaned with (`rememberedTools`);
         * those are the things this destroys.
         *
         * NAMED ONCE BROKEN (E32+E07 C12; audit S05-23): the name went on the
         * list before the write, so a write that failed was still reported to
         * the owner as ruined. `breakItem` answers whether it held.
         */
        const items = rememberedTools(held, category) ?? [equippedFor(held, category)].filter(Boolean);
        for (const item of items.map(each => actor.items.get(each.id)).filter(Boolean)) {
            try {
                if (await breakItem(item, { reason: "incident" })) destroyed.push(item.name);
            } catch (err) {
                error(`Could not ruin the ${category} used in the incident`, err);
            }
        }
    }

    if (destroyed.length) {
        await whisperToOwner(actor, `<p>${game.i18n.format("DRPG.Cleanup.toolsBroken", {
            items: foundry.utils.escapeHTML(destroyed.join(", "))
        })}</p>`);
        log(`Cleanup: ${destroyed.join(", ")} used by ${actor.name} is broken and still on them.`);
    }
    return destroyed;
}
