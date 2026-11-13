/**
 * Danganronpa RPG - the Search.
 * ---------------------------------------------------------------------------
 * The Search from its window to its trace: the category and the goal it asks
 * for (`chooseSearchCategory`), `performSearch` itself, its odds (`searchOdds`)
 * and the tier a roll reaches (`searchTier`); its three ends - nothing
 * (`searchNothing`), something specific handed to a GM (`searchSpecific`) and
 * an unclaimed find (`unclaimedOutcome`, `searchUnclaimed`) - with the tell a
 * trap hears (`searchTold`); the draw and
 * the item granted on the roller's sheet (`searchDraw`, `findOf`,
 * `grantDrawn`), and the trace it leaves (`traceTheFind`,
 * `leaveSearchTrace`).
 *
 * WHERE IT SITS. Moved out of action-rolls.mjs by E41 C4 (1.2.97), a pure move
 * that `node tools/moved-only.mjs` proves line by line. action-rolls.mjs
 * re-exports the 13 names here it exported before (7 since 1.2.112, when the
 * stash's step and its lines went with the Search's reach into a stash), so every importer still
 * imports action-rolls.mjs, and nothing here imports it back (the facade rule,
 * .claude/rules/code.md). `performSearch` is exported now because
 * `performAction`, which stays there, dispatches to it; action-rolls.mjs does
 * not re-export it. Of the action family it reads the shared layer alone
 * (action-pipeline.mjs, action-report.mjs, action-briefing.mjs,
 * action-menus.mjs).
 */

import { MODULE_ID, ACTIONS, ITEM_CATEGORIES } from "./config.mjs";
import { spendAction, refundAction } from "./actions.mjs";
import { leavesTraceFor } from "./inventory.mjs";
import { SearchTokens } from "./search-tokens.mjs";
import { drawItem, foundAs, ITEM_POOLS } from "./tables.mjs";
import { locateActor, sceneOfActor } from "./movement.mjs";
import { callGm } from "./gm-bridge.mjs";
import { resolveThreshold } from "./utils.mjs";
import { playSfx } from "./sfx.mjs";
import {
    DRAWN_ROLL, rollTrait, rollInHand, remnantRef, noteRollContext, abort, canAfford, declineAction, ruledMissAction
} from "./action-pipeline.mjs";
import { report } from "./action-report.mjs";
import { briefingBlock } from "./action-briefing.mjs";
import { chooseVariant, traitFieldHtml, readProposal } from "./action-menus.mjs";

/* ==========================================================================
 * SEARCH
 * ========================================================================== */

/**
 * What the room is worth to this particular search: `situational`, the dice the roll window shows and arms.
 *
 *   +1  it is a sensible place to look for this - the medic's office for
 *       bandages. Set per room by the GM when the map is built.
 *   -1  it is a POOR place to look for this - bandages in the boiler
 *       room. The favour's mirror, set on the same Room Setup screen.
 *
 * NO STASH (1.2.112; the owner's decision of 13.11.2026: "a roll to discover, no roll to search or take an item").
 * Until then a successful Search in a room where somebody else kept a stash with something in it took a random thing
 * out of that stash instead of drawing from the room - an open one first, a hidden one with one more step of
 * disadvantage taken once the dice had landed (`stashStep`, E32+E07 C11e; drawn on the GM since E08+E28 C12b), and a
 * Despair told the owner. A hidden stash is found by Analyze's Find Stash (stash-reach.mjs `resolveStashSearch`), which
 * opens it for good; an open or found one is gone through with the free rifle (`rifleStashDialog`, once a stash a time
 * of day). So a Search reads no stash, and its loot is the room's whatever stash is there.
 *
 * `vault` is vault.mjs, which `performSearch` imports when a Search runs.
 *
 * Read on the searcher's scene (`sceneOfActor`, E12 C6), which the window's count
 * (roll-draw.mjs) and the GM drawing the roll read alike. Until 1.2.74 the favours and
 * the hindrances were read on the scene on screen, so a GM looking at another map
 * drew the dice of a room of the same name there.
 */
export function searchOdds(actor, room, category, vault) {
    const { favoursCategory, hindersCategory } = vault;
    const scene = sceneOfActor(actor);
    let situational = 0;
    if (favoursCategory(room, category, scene)) situational += 1;
    if (hindersCategory(room, category, scene)) situational -= 1;
    return { situational };
}

/**
 * The tier a Search's roll reaches, with `change` on its total first - the one reading
 * `performSearch` and a Reroll's `settleSearch` share. `change` is a 1.2.65 bookmark's -1 (a
 * hidden stash's step until 1.2.112, `searchOdds`); `score` is the total the tiers read.
 */
export function searchTier(roll, change = 0, def = ACTIONS.search) {
    const score = (Number(roll?.total) || 0) + (Number(change) || 0);
    const hit = resolveThreshold(score, def.thresholds);
    const baseTier = hit?.tier ?? 0;
    const tier = roll?.isCritical ? Math.min(3, baseTier + (def.critical?.tierBonus ?? 1)) : baseTier;
    return { score, hit, tier };
}

/**
 * What a Search whose token was refused says, whether its action comes back, and whether the room counts as
 * searched out - from the claim's why (search-tokens.mjs `claimOf`) and the room's count as this browser reads it
 * now. A SEALED ROOM SAYS SO (E17 C4, 26.10.2026; audit S07-20): the GM's refusal of a room it sealed after this
 * browser's map was drawn read as "The search was not counted."; it reads the seal now, the action back, as an
 * unanswered request's is - the player could not have known. Pure (tier 2 E17-T7).
 */
export function unclaimedOutcome(why, left) {
    if (why === "sealed") return { text: "DRPG.SearchTokens.sealed", refund: true, exhausted: false };
    const empty = why === "empty" || left <= 0;
    return { text: empty ? "DRPG.SearchTokens.pickedClean" : "DRPG.SearchTokens.timeout", refund: !empty, exhausted: empty };
}

/** The token was refused: an empty room, a sealed one, or nobody there to answer. Which one decides what the player keeps. */
async function searchUnclaimed(actor, def, roll, { room, scene, category, goalKey, paid, why = null }) {
    // WHY the token was refused decides what the player is told and whether
    // they keep the action.
    //
    // `spend()` answers false for two completely different things: the room
    // really is empty, and nobody was there to say. A player's spend is a
    // socket round trip to the GMs, so no GM connected - or one that did not
    // answer inside five seconds, which a hosted server makes ordinary - came
    // back as a flat false and was reported as "somebody got here first, 0
    // tokens left" on a room that still had all three. The action went with
    // it.
    //
    // The counter itself tells them apart. It is authoritative on this point
    // and, on the unanswered path, uncached: nothing wrote a fresh count,
    // so this reads the world setting.
    //
    // Only the genuinely-empty branch keeps charging. That is the branch the
    // charge was introduced for - "a room they knew was empty" is the Hope
    // generator, and it still costs - while an unanswered request is the
    // module failing the player, not the player gaming it.
    //
    // A third answer since E17 C4: the GM refused a room it has sealed, which the
    // reply names (`why`) - said as the seal, the action back (`unclaimedOutcome`).
    const outcome = unclaimedOutcome(why, SearchTokens.left(room, scene));
    // With the receipt the spend handed back, so a Burst returns as a Burst.
    if (outcome.refund && paid) await refundAction(actor, paid.amount, paid);

    // `claimed: false` is what a Reroll reads: a room that was never
    // searched is not searched by rerolling the dice (ROLL-02).
    await noteRollContext(actor, { actionKey: "search", room, category, goal: goalKey, tier: null, claimed: false });
    await report(actor, def, roll, {
        text: game.i18n.localize(outcome.text),
        room, tokensLeft: SearchTokens.left(room, scene)
    });
    return { success: false, exhausted: outcome.exhausted, unanswered: outcome.refund && why !== "sealed", sealed: why === "sealed" };
}

// "Something specific" is the one goal no table can answer. The roll still
// happens - and the tier it reaches is exactly the information the GM needs
// to decide what was really there - so the result goes to them with the
// player's own description attached.
async function searchSpecific(actor, def, roll, { room, scene, category, request, tier, hit, paid }) {
    const sent = await callGm(actor, {
        title: def.label,
        // The action is handed back below when this is not posted, so the refusal may say so.
        nothingSpent: true,
        request,
        roll,
        room,
        // "Create an item" leaves this card open on purpose - the other two
        // answers stay reachable if the editor is cancelled - and the card
        // says so, because a button that does not close its card looks
        // broken to anyone who does not know that (audit E11).
        gmBody: `<p>${hit || roll.isCritical
            ? game.i18n.format("DRPG.Action.specificFound", { tier })
            : game.i18n.localize("DRPG.Action.specificNothing")} <em>${
            game.i18n.localize("DRPG.Bridge.createItemStays")}</em></p>`,
        // Three answers, because those are the three a GM actually gives to
        // "I am looking for X": it exists and I will make it, it exists
        // already and here it is, or there is none. Each opens the window
        // that does the thing with everything the card already knows filled
        // in - see `runCallAction`.
        //
        // Lowercase data keys only: `dataset` lowercases everything, so a
        // `tierWanted` would come back as `tierwanted` and read undefined.
        actions: [
            {
                action: "createItem",
                label: game.i18n.localize("DRPG.Bridge.createItem"),
                data: {
                    by: actor.id, category, tier: String(tier),
                    room: room ?? "", want: request ?? ""
                }
            },
            {
                action: "giveItem",
                label: game.i18n.localize("DRPG.Bridge.giveItem"),
                data: { by: actor.id }
            },
            // The GM's "there is none" is the Search's result, paid; the refusal is its own button (E16 C1).
            ruledMissAction(actor),
            declineAction(actor, paid)
        ]
    });

    /*
     * NOT POSTED, NOT PAID FOR (E18 C0, 19.10.2026; audit S10-26). No GM to rule - the
     * last one left after the action started - so the player gets the action back, as
     * with a window closed before the dice. A GM gone before the dice or during them is
     * found before the room's search token is taken (`performSearch`, E18 fix e1-G5); one
     * who left during the token's own write leaves it taken: no road gives one back from a
     * player's client. Reroll is offered nothing to re-ask (`claimed: false`, as
     * `searchUnclaimed` notes it).
     */
    /* AND THE TOKEN WITH IT, WHERE IT CAN BE (E91 C7; the owner's deferred item D072). The room's token was taken after
       the dice and kept when the card was not posted. On the primary GM's own browser it is given back below
       (`SearchTokens.giveBack`, the primary's alone). A player's browser whose last GM left holds no road back (the
       spend's request id stays in the bridge, and no GM is there to ask), nor does another GM's: those keep it taken,
       as before. Above the branch: R837 reads the branch's first 400 characters for its `abort`. */
    if (!sent) {
        if (game.user.isGM) await SearchTokens.giveBack(room, scene?.id ?? null);
        await noteRollContext(actor, { actionKey: "search", room, category, goal: "specific", tier: null, claimed: false });
        return abort(actor, paid);
    }

    // Ruled by a human, so Reroll can only re-ask - see reroll.mjs.
    await noteRollContext(actor, {
        actionKey: "search", goal: "specific", gmRuled: true,
        label: def.label, room, request
    });

    const outcome = {
        success: Boolean(hit) || roll.isCritical,
        text: game.i18n.localize("DRPG.Action.specificSent"),
        room, tokensLeft: SearchTokens.left(room, scene)
    };
    await report(actor, def, roll, outcome);
    // A Search that ran, told as the ordinary one is (E37 C6; `searchTold`): what the dice said, whatever the GM answers.
    searchTold(actor, roll, outcome);
    return { calledGm: true, roll, tier, request };
}

/**
 * EVERY SEARCH THAT RAN TELLS (E37 C6, 01.11.2026; E37-25, audit S02-48). `performSearch`'s road through the room's table
 * ended with `drpgActionResolved`, and the two roads beside it - a Search that took something out of a stash
 * (`searchStash`, gone in 1.2.112) and one for something specific, handed to a GM (`searchSpecific`) - ended without it,
 * so a trap armed for "somebody searches" a room (traps.mjs `onActionResolved`, on the primary GM; a player's browser
 * relays the event, `trap.event`) never heard either. Both told it after their card, with the ordinary Search's shape: `actionKey`
 * "search" and the outcome, whose `success` is what the dice said (a specific Search: a hit or a critical, as its card
 * says, whatever the GM answers later - the token was spent and the room was searched) and whose `room` is the room
 * searched; a trap reads only a `success` (traps.mjs). A miss of the room's table (`searchNothing`) and a Search whose
 * token was refused tell nothing, as before. Tier 2 E37-T5.
 */
function searchTold(actor, roll, outcome) {
    Hooks.callAll("drpgActionResolved", { actor, actionKey: "search", roll, outcome });
}

/** A miss: recorded for Reroll, sounded, and reported as the action's own failure line. */
async function searchNothing(actor, def, roll, { room, scene, category, goalKey }) {
    await noteRollContext(actor, { actionKey: "search", room, category, goal: goalKey, tier: null });

    /*
     * THE ONE COMMON FAILURE IN THIS GAME THAT WAS COMPLETELY SILENT.
     *
     * A Search that finds nothing still costs an action and still burns one
     * of the room's three tokens, and until now the only sign of either was
     * a card saying so. Local, on the searcher's client: this branch runs
     * where the roll was made.
     *
     * The two other ways a Search ends nothing are deliberately NOT here. A
     * critical is not a failure, and a "something specific" request has gone
     * to a GM rather than come up empty - that one is waiting, not lost.
     */
    playSfx("searchNothing");

    await report(actor, def, roll, { text: def.failure, room, tokensLeft: SearchTokens.left(room, scene) });
    return { success: false };
}

    /*
     * SOMEBODY LEFT SOMETHING HERE - E21, traps 165 and 166.
     *
     * Dawid, 28.08: if a player plants an item as an indirect murder project,
     * the FIRST search in that room always pulls out the planted item, whatever
     * the player was looking for.
     *
     * Without it the fifth trigger does not exist. The trap rides an object and
     * the object is lying in a room where it might not be found for three
     * sessions or ever, because a Search draws from the room's pool and the
     * chance of hitting that one thing gets worse the better stocked the room
     * is. The killer would be paying a project's full price for a lottery
     * ticket - which is not tension, it is a raffle.
     *
     * INSTEAD OF THE DRAW, NEVER ADDED TO IT (trap 165). Dropping the plant
     * into the room's table would make it likely rather than certain.
     *
     * AND DOWN THE `substitute` PATH, which the module has had since v1.1.33
     * for "the room had none of what you asked for and gave you this instead"
     * (trap 166). Same sentence, same token, same everything. A planted-item
     * card that differed by so much as a comma would teach the table the
     * difference inside three sessions, and then the best defence against an
     * indirect murder would be reading your own chat more carefully than the
     * fiction.
     *
     * The GM decided this, not us - a player's client is never told a room has
     * something waiting in it until the item is in their hands. Asked HERE, past
     * every way a Search can end without finding anything: `performSearch` comes
     * this far only once a failure and a request sent to a GM have both returned,
     * and each of those leaves the plant in the room (ACT-03).
     * Exported for the suite (E14 part 2 C4: a plant drawn into full hands).
     */
export async function searchDraw(room, scene, category, tier, goalKey, actor = null) {
    // The roll it is drawn for, so the GMs' fact of it goes on that roll's row (fix r1-G2).
    const plant = await SearchTokens.takePlant(room, scene?.id ?? null,
        { actorId: actor?.id ?? null, rollId: actor ? rollInHand(actor)?.messageId ?? null : null });

    return plant
        ? {
            name: plant.name,
            img: plant.img ?? null,
            description: plant.description ?? "",
            roles: plant.roles ?? [],
            // The one thing that makes the card read like an ordinary
            // unexpected find rather than an announcement.
            substitute: true,
            identity: plant.drpgItemId,
            // Its way back to the room when it cannot be handed over (`grantDrawn`, E14 part 2 C4).
            back: plant.back ?? null,
            // And what it is, read off its name as a room table's entry is (tables-pools.mjs `foundAs`, E14 part 2 C3):
            // "Cold tea" planted in an armoury is a Sanity Relief usable on the sheet, as the same tea drawn there.
            ...foundAs(plant.name, { category, tier, goal: goalKey ?? null })
        }
        : await drawItem(category, tier, { goal: goalKey, room, scene });
}

/**
 * WHAT THE FIND IS (E14 part 2 C3, 24.10.2026; audit S08-09): the category, tier and goal `drawItem` drew (a plant's
 * read by `searchDraw`), the tier never above what the Search earned - the GM judges that tier (sheet-audit.mjs
 * `searchFind`: a spent token, a hit, at most the record's tier), and a find above it was flagged; the category and
 * the goal the GM does not judge (the review's). A draw that says nothing - a caller's own object - is the request,
 * as every find was until C3. Exported for `settleSearch` (reroll.mjs) and the suite.
 *
 * @returns {{category: string, tier: number, goal: string|null}}
 */
export function findOf(drawn, { category, tier, goalKey = null }) {
    // A category a Search draws (`ITEM_POOLS`, E14 fix e1-G4; the review's E14p2-END-02, R5): a Truth Bullet or a room key
    // a caller's draw named is the request, never a bullet with no trace or a key with no room.
    const own = Object.hasOwn(ITEM_POOLS, drawn?.category ?? "") ? drawn.category : category;
    const drawnTier = Number(drawn?.tier);
    return {
        category: own,
        tier: Number.isInteger(drawnTier) && drawnTier >= 0 ? Math.min(drawnTier, tier) : tier,
        goal: drawn?.goal !== undefined && own === drawn?.category ? drawn.goal ?? null : own === category ? goalKey ?? null : null
    };
}

    // The item actually goes into the inventory, subject to the carry limits.
    // Named after the GMs' record of the roll (`rollId`, E29 C6): the find stands on a GM as far as
    // that record's total reaches (sheet-audit.mjs `searchFind`). A roll the GM did not draw has none.
    // Made as what was drawn, at most at the earned tier (`findOf`, E14 part 2 C3). Exported for the suite.
export async function grantDrawn(actor, drawn, { category, tier, goalKey, rollId = null }) {
    let granted = null;
    if (drawn?.name) {
        const find = findOf(drawn, { category, tier, goalKey });
        const { grantItem, ITEM_FLAGS } = await import("./inventory.mjs");
        // The icon and the sentence the GM wrote on the table entry travel with
        // it - see `drawItem`. Both are `null` for a built-in pool, which is
        // exactly what `grantItem` already treats as "use the category icon and
        // the tier line".
        try {
            granted = await grantItem(actor, {
                reason: "searchFind", ref: rollId,
                name: drawn.name, category: find.category, tier: find.tier, goal: find.goal,
                img: drawn.img ?? null, description: drawn.description ?? "",
                // What else it can do, from the table entry it came out of.
                roles: drawn.roles ?? [],
                // A planted item arrives with its identity already minted by the
                // GM, and it has to keep it: the GM's ledger was written against
                // that name the moment the thing was planted, and an item that is
                // renamed on the way into somebody's bag is an item the trap will
                // never recognise again.
                ...(drawn.identity ? { extraFlags: { [ITEM_FLAGS.identity]: drawn.identity } } : {})
            });
        } finally {
            // A plant the hands could not take goes back to its room, the GMs told (E14 part 2 C4; S08-10):
            // it was out of the store from the take on, and a refused grant - or one that threw - lost it
            // and the killer's project.
            if (!granted && drawn.back) await SearchTokens.returnPlant(drawn);
        }
    }
    return granted;
}

    /*
     * THE TRACE FOLLOWS WHAT WAS FOUND, NOT WHAT WAS ASKED FOR.
     *
     * This read `category !== "usable"`, which was the same answer as the rule
     * below for as long as the only non-usable things you could ask for were a
     * crime tool and a cleaning tool. Adding "something to work with" broke it
     * in both directions at once, and neither was acceptable: counting `tool`
     * as incriminating buries the investigation under a trace for every hunt
     * for a screwdriver, while exempting it opens a door - from tier 2 half the
     * tools ARE weapons, so a killer asking for "something to work with" would
     * walk out with a crowbar and no trace.
     *
     * By the time this runs the dice have settled and the item is known, so the
     * question can be asked about the object instead of the intention. A trace
     * is physical evidence of having handled a THING; it has never been
     * evidence of what you meant. That makes this the more honest rule as well
     * as the only workable one.
     *
     * Read off `category` plus the roles the table entry declared, rather than
     * off the granted Item: the carry limit can refuse to grant it, and picking
     * something up and finding you cannot hold it still means you touched it.
     */
/**
 * What a Search's hit found and the trace it leaves: the trace and the card follow what was found (C3) - its category
 * decides a trace, its tier is the card's - so a weapon a room handed over for a Healing ask leaves one and an apple
 * handed over for a weapon none. Out of `performSearch` and exported for the suite (E14 fix e1-G7, 25.10.2026; the
 * review's E14p2-R7: passing the asked category here instead turned no test red).
 */
export async function traceTheFind(actor, def, roll, { hit, category, tier, goalKey, drawn, granted, room }) {
    const find = drawn?.name ? findOf(drawn, { category, tier, goalKey }) : { category, tier, goal: goalKey };
    const { placed, leftTrace } = await leaveSearchTrace(actor, def, roll, { hit, category: find.category, drawn, granted, room, tier: find.tier });
    return { find, placed, leftTrace };
}

async function leaveSearchTrace(actor, def, roll, { hit, category, drawn, granted, room, tier }) {
    const leaves = leavesTraceFor(category, drawn?.roles);
    // The trace's type and its Faint mark are the Search's `leavesRemnant` (config.mjs), not spelt here (E41 C1b).
    const { type, faint } = def.leavesRemnant;
    const visibility = roll.isCritical ? def.critical?.remnant : hit?.remnant;

    let placed = null;
    let leftTrace = false;
    if (leaves && visibility) {
        const { dropRemnant, traceFeedback } = await import("./remnants.mjs");
        const catLabel = ITEM_CATEGORIES[category]?.label ?? category;
        placed = await dropRemnant(actor, {
            type,
            visibility,
            faint,
            /*
             * NOT TIED BY CATEGORY ANY MORE (Dawid, 28.08).
             *
             * This used to say `true` because the thing found was crime or
             * cleaning gear - a fact about the category, not about the chapter.
             * A penknife nobody picked up again sat at the top of the case
             * dashboard's murder-first sort beside the knife out of the body.
             *
             * What ties this trace is the object being USED, which nobody can
             * know yet. So the trace remembers WHICH object it handed over and
             * `tieTraceForItem` comes back for it the moment that object is
             * swung. Left `null` rather than `false`: the incident rule in
             * `placeRemnant` still gets to say yes if this Search is happening
             * in the middle of one.
             */
            tiedToCrime: null,
            itemIdentity: granted?.getFlag?.(MODULE_ID, "drpgItemId") ?? null,
            action: "search",
            // The roll this trace is the Search's of, for the GMs' row (fix r1-G1).
            rollId: rollInHand(actor)?.messageId ?? null,
            subject: drawn?.name ?? "",
            note: game.i18n.format("DRPG.Remnant.searchNote", {
                actor: actor.name,
                room: room ?? "?",
                category: catLabel,
                item: drawn?.name ?? "?",
                tier,
                total: roll.total
            })
        });
        leftTrace = traceFeedback(roll, placed);
    }
    return { placed, leftTrace };
}

export async function performSearch(actor, def, options) {
    const cost = options.free ? 0 : def.cost;
    if (!canAfford(actor, cost)) return null;

    // Where the searcher stands, read once (E12 C6): the room, and the scene whose seal,
    // tokens, plant and table answer for it - not the scene on the screen of the browser that
    // runs the Search, which until 1.2.74 they each read. With no token, the school, as
    // `searchOdds` reads it (`sceneOfActor`).
    const place = locateActor(actor);
    const room = options.room ?? place?.room ?? null;
    const scene = place ? place.scene : sceneOfActor(actor);
    if (!room) {
        ui.notifications.warn(game.i18n.localize("DRPG.Action.noRoom"));
        return null;
    }

    // BEFORE the picker, not after it. A sealed room is not a question about
    // what you are looking for - there is nothing in there to look for - so
    // asking is a form the answer to which was always going to be no.
    if (SearchTokens.sealed(room, scene)) {
        ui.notifications.warn(game.i18n.localize("DRPG.SearchTokens.sealed"));
        return null;
    }

    const goal = await chooseSearchCategory(actor, def);
    if (!goal) return null;
    const { category, goal: goalKey, request } = goal;

    // Refuse early when the room is already spent, so the player is not walked
    // through a roll only to be told there was nothing left.
    if (SearchTokens.left(room, scene) <= 0) {
        ui.notifications.warn(game.i18n.localize("DRPG.SearchTokens.exhausted"));
        return null;
    }
    // Eye asks nobody; another statistic waits for the GM here, before the action and the room's token are spent.
    const ruled = await searchTrait(actor, goal);
    if (!ruled) return null;
    const { trait, byGm } = ruled;

    const { situational } = searchOdds(actor, room, category, await import("./vault.mjs"));

    /*
     * SOMETHING SPECIFIC ENDS WITH A HUMAN, SO NO GM, NO TOKEN (E18 fix e1-G5, 24.10.2026; the end review's E18-END-7
     * and F8, STATUS's C0 gap 1). The room's search token was taken after the dice and before the call on the GM
     * (`searchSpecific`); with the last GM gone by then the call posted nothing and the action came back, but the token
     * did not - no road gives one back from a player's client - so the room read "exhausted" for a search that never
     * happened. Such a Search is refused now before the price and the dice when no GM is connected, as an Analyze is
     * (`performAnalyze`), and again after the dice, before the token is spent, for a GM who left during the roll: the
     * action comes back (`abort`) and the room keeps its token. What is left is a GM leaving between the spend and the
     * post, the length of the spend's own write. Tier 2's "a Search for something specific and an Observe of anything
     * whose last GM left during the roll" reads it; at 42c0e0d9 the token was taken.
     */
    const { gmOnline, sayNotDone } = await import("./bridge-guards.mjs");
    if (goalKey === "specific" && !gmOnline()) {
        sayNotDone("gm.call", "noGm", { nothingSpent: true });
        return null;
    }

    const paid = cost > 0 ? await spendAction(actor, cost) : null;
    if (cost > 0 && !paid) return null;

    const calls = await import("./call-effects.mjs");
    if (situational) calls.armSituational(situational);

    /*
     * EYE, AND NO CHOICE (the owner's rule of 28.09.2026; E32+E07 C11d). The roll
     * window used to offer Eye or Hand here - "a careful look or a quick rummage"
     * (Dawid, 29.08) - which let the searcher pick their own better statistic. A
     * Search rolls Eye alone now (ACTIONS.search), its select locked like any fixed
     * trait; Resolve still buys the whole picker, as for every roll. Since E68 C6
     * (DA2) a Search lists six: Eye with nobody asked, or the statistic a GM approved
     * or changed to (`searchTrait`), locked either way and said which (`byGm`).
     */
    let roll;
    try {
        roll = await rollTrait(actor, trait, {
            actionKey: "search",
            byGm,
            dc: (def.thresholds ?? []).map(t => t.min).join(" / "),
            // Recorded before anything can bail out below, so a Reroll always
            // knows what was being looked for and where.
            context: { room, category, goal: goalKey, request }
        });
    } finally {
        // Cleared whatever happened. A situational modifier that outlived its
        // roll would silently attach itself to the next unrelated one.
        calls.clearSituational();
    }
    if (!roll) return abort(actor, paid);

    // A GM who left during the roll (above): the action back, the room's token not taken, nothing noted for Reroll to re-ask.
    if (goalKey === "specific" && !gmOnline()) {
        sayNotDone("gm.call", "noGm", { nothingSpent: true });
        await noteRollContext(actor, { actionKey: "search", room, category, goal: "specific", tier: null, claimed: false });
        return abort(actor, paid);
    }

    // The token is claimed only once the dice are actually on the table.
    // Spending it up front meant backing out of the trait picker or the roll
    // window burned one of the room's three searches for nothing - twice and
    // the room was closed for the rest of the time of day.
    const { ok: claimed, why } = await SearchTokens.claim(room, scene?.id ?? null, { actorId: actor.id });

    // Kept whatever the token says - it was paid before the roll. The check
    // above the picker reads this client's copy of the counter, which can be a
    // moment behind the GM's - so two players searching the same room with one
    // token left both get through it and both roll. Letting the loser off meant
    // they kept their action AND banked whatever the duality granted them: a
    // Hope generator anybody could run by searching a room they knew was empty.
    //
    // Paying for it is also just what happened in the fiction. They searched a
    // room somebody else had already picked clean.

    if (!claimed) return searchUnclaimed(actor, def, roll, { room, scene, category, goalKey, paid, why });

    // The dice's own total, on the room's table: a Search reaches into no stash (`searchOdds`, 1.2.112).
    const { hit, tier } = searchTier(roll, 0, def);

    if (goalKey === "specific") return searchSpecific(actor, def, roll, { room, scene, category, request, tier, hit, paid });

    if (!hit && !roll.isCritical) return searchNothing(actor, def, roll, { room, scene, category, goalKey });

    const drawn = await searchDraw(room, scene, category, tier, goalKey, actor);
    const granted = await grantDrawn(actor, drawn, { category, tier, goalKey, rollId: roll.raw?.[DRAWN_ROLL]?.rollId ?? null });
    const { find, placed, leftTrace } = await traceTheFind(actor, def, roll, { hit, category, tier, goalKey, drawn, granted, room });

    const outcome = {
        success: true, tier: find.tier, category: find.category,
        item: drawn?.name ?? null,
        carried: Boolean(granted),
        // The room had nothing of what was asked for and answered with what it
        // does hold - see `drawItem`. Said out loud, because a player who asked
        // for a bandage and got a crowbar should not have to work out whether
        // the module is broken.
        substitute: Boolean(drawn?.substitute),
        leftTrace,
        room, tokensLeft: SearchTokens.left(room, scene)
    };

    // Everything Reroll needs to take this Search back: the item to remove, the
    // trace to retune, and what was being looked for so a new draw comes from
    // the same pool.
    await noteRollContext(actor, {
        actionKey: "search",
        room, category, goal: goalKey, tier,
        itemId: granted?.id ?? null,
        ...remnantRef(placed)
    });

    await report(actor, def, roll, outcome);
    Hooks.callAll("drpgActionResolved", { actor, actionKey: "search", roll, outcome });
    return outcome;
}

/**
 * What are you looking for?
 *
 * Five buttons in a row overflowed the screen, so this is a radio list in a
 * narrow panel - the same width as every other dialog the module opens.
 *
 * The guide splits usable items by what they restore, and the player declares
 * which they want before rolling. "Something specific" is the escape hatch: the
 * roll happens normally and then the GM is asked to say what was actually there,
 * because a described search is exactly the case a table cannot answer.
 *
 * @returns {Promise<{category: string, goal: string, request: string}|null>}
 */
async function chooseSearchCategory(actor, def = ACTIONS.search) {
    const options = [
        { value: "healing", category: "usable", icon: "fa-heart",
          label: "DRPG.Action.goalHealing", hint: "DRPG.Action.goalHealingHint" },
        { value: "stress", category: "usable", icon: "fa-brain",
          label: "DRPG.Action.goalStress", hint: "DRPG.Action.goalStressHint" },
        { value: "crimeTool", category: "crimeTool", icon: "fa-skull",
          label: "DRPG.Action.goalCrime", hint: "DRPG.Action.goalCrimeHint" },
        { value: "cleaningTool", category: "cleaningTool", icon: "fa-broom",
          label: "DRPG.Action.goalCleaning", hint: "DRPG.Action.goalCleaningHint" },
        // The category that had four tables, a real bonus and no way in.
        //
        // `tool` was introduced with its own tables and its advantage on
        // project work, and the only routes to one were finding it by accident
        // in a room's own table or being handed it by the GM. A category with
        // no entrance is a category nothing can reach on purpose - and Projects
        // are the slowest thing in this game to push without help.
        //
        // The rest of the pipeline needs nothing: `drawItem`, `grantItem`, the
        // slot limits and the room tables all key off the category, and this is
        // a category they already know.
        { value: "tool", category: "tool", icon: "fa-screwdriver-wrench",
          label: "DRPG.Action.goalTool", hint: "DRPG.Action.goalToolHint" },
        { value: "specific", category: null, icon: "fa-magnifying-glass-plus",
          label: "DRPG.Action.goalSpecific", hint: "DRPG.Action.goalSpecificHint" }
    ];

    // The list this menu was lifted from - see `chooseVariant`. The textarea
    // rides along as `extra`, because "what specifically" belongs to exactly
    // one of the five rows and a second window for it would be the friction
    // this whole pattern removes.
    const picked = await chooseVariant({
        actor,
        title: ACTIONS.search.label,
        intro: briefingBlock(actor, "search", ACTIONS.search),
        prompt: game.i18n.localize("DRPG.Action.searchGoalHint"),
        confirm: game.i18n.localize("DRPG.Action.roll"),
        // NO PICK OF THE ROLLER'S OWN HERE (Dawid, 29.08): since E68 C6 (DA2) the statistic is the
        // player's proposal, Eye checked, in `extra` below - Eye asks nobody (DA49), another a GM.
        traits: null,
        options: options.map(o => ({
            value: o.value,
            icon: o.icon,
            gmRoute: o.value === "specific",
            label: game.i18n.localize(o.label),
            hint: game.i18n.localize(o.hint)
        })),
        extra: `<label class="drpg-specific-note" data-drpg-when="specific">
                <span>${game.i18n.localize("DRPG.Action.goalSpecificPrompt")}</span>
                <textarea name="request" rows="2"
                    placeholder="${game.i18n.localize("DRPG.Action.goalSpecificPlaceholder")}"></textarea>
            </label>${traitFieldHtml(actor, def.traits, { propose: true, howLabel: "DRPG.TraitRuling.howSearch" })}`
    });

    if (!picked) return null;

    const option = options.find(o => o.value === picked.value);
    const request = picked.form.querySelector('[name="request"]')?.value.trim() ?? "";

    if (picked.value === "specific" && !request) {
        ui.notifications.warn(game.i18n.localize("DRPG.Action.goalSpecificNeeded"));
        return null;
    }

    // The proposal (E68 C6): a statistic the catalogue lists, and the player's words of how; `searchTrait` rules on it.
    return { goal: picked.value, category: option?.category, request, ...readProposal(picked.form, def.traits) };
}

/** The statistic a Search is checked against and needs no card for (DA49). */
export const SEARCH_DEFAULT = "eye";

/**
 * The statistic a Search rolls, `{ trait, byGm }`, or null when it is not to be rolled (E68 C6, 10.11.2026; DA2, DA49).
 * Eye - the default, and what a window with no field answers - asks nobody and waits for nothing; any other listed
 * statistic is the player's proposal, ruled on a GM's card (trait-ruling.mjs `traitFor`, `{ kind: "action", key:
 * "search" }`, the valve's scope), with the player's words. Nothing is spent before it: the caller pays after.
 */
async function searchTrait(actor, { proposed = null, note = "" } = {}) {
    const listed = ACTIONS.search.traits ?? [];
    if (!proposed || proposed === SEARCH_DEFAULT || !listed.includes(proposed)) {
        return listed.includes(SEARCH_DEFAULT) ? { trait: SEARCH_DEFAULT, byGm: false } : null;
    }
    const { traitFor } = await import("./trait-ruling.mjs");
    return traitFor(actor, { kind: "action", key: "search" }, { proposed, note });
}
