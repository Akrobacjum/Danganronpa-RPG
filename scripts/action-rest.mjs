/**
 * Danganronpa RPG - Rest, the action's window.
 * ---------------------------------------------------------------------------
 * `performRest`: the short or the long rest picked in one window, each with
 * its price and its reason for being shut; the rest itself is rest.mjs's. Since E93 C3 the window lists the room's
 * actions after them (action-facilities.mjs), and a picked one is carried out there.
 *
 * WHERE IT SITS. Moved out of action-rolls.mjs by E41 C4 (1.2.97), a pure move
 * that `node tools/moved-only.mjs` proves line by line. `performRest` is
 * exported now because `performAction`, which stays in action-rolls.mjs,
 * dispatches to it; action-rolls.mjs does not re-export it. Nothing here
 * imports action-rolls.mjs (the facade rule, .claude/rules/code.md). Of the
 * action family it reads action-briefing.mjs and action-menus.mjs.
 */

import { ACTIONS } from "./config.mjs";
import { briefingBlock } from "./action-briefing.mjs";
import { chooseVariant } from "./action-menus.mjs";

/**
 * Rest: pick short or long. Each option shows its cost and whether the room
 * you are standing in actually allows it, so the choice is informed.
 */
export async function performRest(actor) {
    const { takeRest, restVariants } = await import("./rest.mjs");
    // One row per rest, each with its price and its reason for being unavailable (rest.mjs `restVariants`, which the
    // sheet's tile reads too). With both shut the window still opens, the two rows greyed with their reasons
    // (`showShut`; E16 part 2 C4, 26.10.2026, audit S02-26): it used to answer "Nothing here can be done right now."
    // alone, and a player was not told where a rest could be taken, nor that it was taken already.
    // E93 C3: the room's actions after the two rests - the GM's for this room, then the completed projects' standing in
    // it (action-facilities.mjs `facilityRows`), each greyed with its reason as the rests are.
    const { facilityRows, useFacility } = await import("./action-facilities.mjs");
    const picked = await chooseVariant({
        actor,
        title: ACTIONS.rest.label,
        intro: briefingBlock(actor, "rest", ACTIONS.rest),
        options: [...restVariants(actor), ...await facilityRows(actor)],
        showShut: true
    });

    if (!picked) return null;
    if (picked.value === "short" || picked.value === "long") return takeRest(actor, picked.value);
    return useFacility(actor, picked.value);
}
