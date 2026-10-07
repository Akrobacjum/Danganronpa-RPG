/**
 * Danganronpa RPG - making Calls actually happen.
 * ---------------------------------------------------------------------------
 * A Call that only deducts a resource and prints a sentence is a receipt, not a
 * rule. These apply the effect:
 *
 *   · effects that land now      - damage, stress, project progress, sealed rooms
 *   · effects that arm the dice  - advantage, experiences, a free critical
 *
 * The second kind is stored as a *pending call* on the character. The roll
 * dialog keeps those controls disabled until one is armed, which is what makes
 * them Calls rather than free checkboxes - see roll-dialog.mjs.
 *
 * THE FACADE (E34, 1.2.70). The pickers moved to call-pickers.mjs, and the seals,
 * the restrictions and the called assembly to call-world.mjs, by pure moves that
 * `node tools/moved-only.mjs` proves. This file keeps its name and every name it
 * exported - `pickTarget` and eleven of call-world.mjs's are re-exported under
 * the imports - so every importer still imports call-effects.mjs, and neither new
 * file imports it. What stays is the shield and the situational dice, the armed
 * Calls, the Confusions' store, copy and socket, the effects and `applyCall`; new
 * code of those goes here, a picker into call-pickers.mjs, and a seal, a
 * restriction or the assembly into call-world.mjs.
 */

import { MODULE_ID, FLAGS, HOPE_CALLS, DESPAIR_CALLS, STARTING } from "./config.mjs";
import { trustedWrite } from "./resource-guard.mjs";
import { resourceValue, resourceMax } from "./character.mjs";
// The darkening's own reader, and a leaf: static so `refusalBeforePaying` can
// stay synchronous for the sheet, which asks it between two windows.
import { overflowBlocksHope } from "./overflow.mjs";
// projects.mjs is NOT imported here statically: it reaches this file through
// fog.mjs and movement.mjs, and a top-level import back would close a static
// cycle - the notes on the imports in both of those files say there is none.
// Every use below is lazy.
import {
    announce, whisperToOwner, log, error, plural, cardHead, isPrimaryGm, primaryGmId, forcedDeletion
} from "./utils.mjs";
// A Confusion's armed Calls are the GMs' store and the owner's copy (E06 fix r2-G4), read
// synchronously beside the flag - gm-stores.mjs reaches a domain module only by `import()`.
import { confusionStore, confusionCopy, rollStore } from "./gm-stores.mjs";
import { gmStoresQuiet, whenGmStoresAudible } from "./gm-store.mjs";
import { senderOf, ownsActor, replyForMe } from "./bridge-guards.mjs";
import {
    isSealed, sealRoom, isCallSilenced, isChained, restrict, scheduleGather, gatherEveryone
} from "./call-world.mjs";
export { pickTarget } from "./call-pickers.mjs";
export {
    sealedRooms, isSealed, restrictions, isCallSilenced, isChained, clearSeals, pendingGather, scheduleGather,
    cancelGather, runPendingGather, gatherEveryone
} from "./call-world.mjs";

/** Let the victim of a Call know what has been done to them. */
async function tell(actor, key) {
    try {
        await whisperToOwner(actor, `<p class="drpg-warning">${game.i18n.localize(key)}</p>`);
    } catch {
        // The restriction stands whether or not the notice got through.
    }
}

/* ==========================================================================
 * PENDING CALLS
 * ========================================================================== */

/**
 * Supporting rolls must not touch an armed Call.
 *
 * Sabotage rolls to conceal itself before it rolls to sabotage; an indirect
 * murder rolls to conceal intent and again to hide its traces. Every one of
 * those went through the same pipeline as the real roll, so a Call bought for
 * the sabotage was applied to - and consumed by - the concealment roll instead.
 * The player paid for advantage on the thing that mattered and got it on the
 * thing that did not.
 *
 * Held as a module-level flag rather than threaded through every call site: the
 * roll dialog reads the armed Call from its own hook, with no access to the
 * action's arguments.
 */
let shielded = 0;

export function shieldCalls() { shielded += 1; }
export function unshieldCalls() { shielded = Math.max(0, shielded - 1); }

/**
 * Advantage that nobody paid Hope for.
 *
 * Some advantage comes from the situation rather than from a Call: looking for
 * bandages in the medic's office, digging through a stash somebody has taken
 * pains to hide. It is armed around one roll and cleared straight after, and it
 * hides behind the same shield as a Call so a supporting roll cannot eat it.
 *
 * A module-level value for the same reason `shielded` is one: the roll dialog
 * reads this from its own hook and never sees the action's arguments.
 *
 * IT IS A COUNT, NOT A SIGN (E7). This used to store `Math.sign(value)`, and
 * the arithmetic it flattened was already being done: `performSearch` adds a
 * favouring room, a hindering room and (until E06 C11 moved it after the roll,
 * `searchOdds`) somebody's concealed stash, whose disadvantage die is taken on the
 * dice once they have landed since E32+E07 C11e (`stashStep`); a crisis
 * roll adds a weapon in hand, a second try after a miss and the guide's
 * "the victim gets advantage on every roll" for dying alone to a trap. All of
 * that was summed, carefully, and then thrown away at this line. A victim with
 * three reasons to be helped got exactly as much as one with a single reason.
 */
let situational = 0;

/**
 * @param {number} value  Signed, and its SIZE matters: +2 means two dice.
 *   Truncated because a die count is a whole number and a caller that computed
 *   a fraction has made a mistake this file should not carry forward.
 */
export function armSituational(value) {
    situational = Math.trunc(Number(value)) || 0;
}

export function clearSituational() { situational = 0; }

/**
 * THE ROLL'S OWN DIE, WHICH THE SHIELD LEAVES ALONE (E32+E07 fix r2-G1, 03.10.2026; the
 * round-2 correctness review's M1). A murder's opening roll is thrown as a supporting
 * roll (`remember: false`, murder.mjs `throwOpeningRoll`), so no Call is spent on it -
 * and its Night die, the killer's advantage and a trap's victim's disadvantage, was
 * armed as the action's (`armSituational`), where the same shield hid it: every
 * opening at Night rolled flat, measured at d9ee6e9 and read so in the oldest commit
 * here (1.2.50). A die handed to one roll by name (`rollTrait`'s `situational`) is
 * that roll's and no other roll's to eat, so it is held here, armed as the roll
 * starts and cleared as it ends. Read off the tier-2 test "at Night the opening roll
 * carries its die ..." as the dice are thrown: 0 at Night for both sides at d9ee6e9,
 * +1 for the killer and -1 for a trap's victim since.
 */
let own = 0;

export function armOwnSituational(value) { own = Math.trunc(Number(value)) || 0; }
export function clearOwnSituational() { own = 0; }

/**
 * A signed count: the action's die, zero while a supporting roll is shielded, and
 * the roll's own (`armOwnSituational`), which is not.
 *
 * The shield is why trap 57 needs nothing done to it: a concealment roll sees
 * zero here and `null` from `pendingCall`, so BOTH bought sources vanish
 * together, whatever their size. The character's own Breakdown is deliberately
 * not shielded and never was - see `stateGrant` in roll-dialog.mjs.
 */
export function situationalAdvantage() {
    return (shielded ? 0 : situational) + own;
}

/**
 * Every Call armed on this character, oldest first.
 *
 * THEY STACK (CALL-02, Dawid 17.09). It was one slot, and arming a second Call
 * silently deleted the first with nothing refunded: a Monokuma's Obstacle ate
 * the Support a player had just paid a Hope for, and six Hope of Loaded Die went
 * the same way. A Call is a purchase, and two purchases are two Calls - so
 * advantage and disadvantage add up on the dice, and the ones that are not dice
 * (a Loaded Die, an Experience, Determination, a Confusion's flat bonus) all
 * apply to the same roll. A second copy of the SAME Call is refused before
 * anything is paid; see `refusalBeforePaying`.
 *
 * A world armed before this change holds one payload object rather than a list,
 * so that shape is still read.
 *
 * A Confusion's are not on the flag (E06 fix r2-G4): they are the GMs' store and the
 * owner's copy, read here beside it (`armedConfusions`).
 */
export function pendingCalls(actor) {
    if (shielded) return [];
    return [...pendingCallsRaw(actor), ...armedConfusions(actor)];
}

/**
 * Every Call armed on this character as this browser holds it, the shield aside: the sheet's badges.
 * `held`, where given, is the nonces of the armed list the GMs hold (sheet-audit.mjs `armedCallsHeld`,
 * E29 C8): an entry of the flag outside it is left out. A Confusion is the GMs' store already.
 */
export function armedCallsShown(actor, { held = null } = {}) {
    const listed = pendingCallsRaw(actor);
    return [...(held ? listed.filter(entry => held.has(entry.nonce)) : listed), ...armedConfusions(actor)];
}

/** The first Call armed on this character, for the readers that want just one. */
export function pendingCall(actor) {
    return pendingCalls(actor)[0] ?? null;
}

/**
 * Which grants a Call rides on the dice. Everything else is a permission or a
 * flat number, and two of those on one roll are two different things happening -
 * two of the SAME are one purchase made twice, which is what gets refused.
 */
const DICE_GRANTS = new Set(["advantage", "disadvantage"]);

/**
 * Why a player's client may not arm this Call on somebody else's character, or
 * null when it may (E03, 24.09.2026; audit S10-09). The one Call that honestly
 * travels this way is a Hope Call aimed at another player - Support - with the
 * `grants` the table gives it. A Despair Call is a Monokuma's, and a Monokuma is a
 * GM, whose client arms it directly. Pure, for the suite.
 */
export function playerArmRefusal(call) {
    const def = HOPE_CALLS[call?.key];
    if (!def) return `"${call?.key}" is not a Hope Call a player can buy for somebody else`;
    if (def.target !== "player") return `"${call.key}" is not aimed at another player`;
    if (!def.grants || def.grants !== call.grants) return `"${call.key}" does not grant "${call?.grants}"`;
    return null;
}

/**
 * Why a player's client may not arm this Call on the buyer's own character, or null when it may
 * (E29 C8, 05.10.2026; the plan's 3.3): a Hope Call aimed at nobody else (`target: "none"`) with
 * the `grants` the table gives it - Experience, Ultimate, Resolve, the Loaded Die. The rules
 * `refusalBeforePaying` states for them are the other guards' (a second copy, the buyer's Hope,
 * a Hope Call barred). Pure, for the suite.
 */
export function ownArmRefusal(call) {
    const def = HOPE_CALLS[call?.key];
    if (!def) return `"${call?.key}" is not a Hope Call a player can buy for their own character`;
    if (def.target !== "none") return `"${call.key}" is aimed at somebody else`;
    if (!def.grants || def.grants !== call.grants) return `"${call.key}" does not grant "${call?.grants}"`;
    return null;
}

/** Is this Call already armed on this character, in a way a second copy adds nothing to? */
export function alreadyArmed(actor, call) {
    if (!call?.grants || DICE_GRANTS.has(call.grants)) return false;
    return pendingCalls(actor).some(entry => entry.key === call.key || entry.grants === call.grants);
}

/**
 * Arm a Call so the next roll can use what it bought.
 *
 * A PLAYER'S CALL IS ARMED BY THE GM, ON ANY CHARACTER (E29 C8, 05.10.2026; decision D2, the plan's
 * 3.3; left to E29 by E08+E28 fix r2-H8, H8-6). Support arms somebody else's character, which a
 * player cannot write, so it went through the GM from the start, and the GM took its price there
 * (E03). A Call on the buyer's own character - Experience, Ultimate, Resolve, a Loaded Die - was
 * written here, on the player's own flag, and paid here: a console armed a Loaded Die it never paid
 * for, and the GM forced its 12 on the roll it drew (the plan's 1.5, item 5, by reading). Every
 * player's Call goes the bridge's way now, `call.arm`, where the GM checks it, takes the buyer's
 * Hope and appends the entry; an entry a player's browser adds itself is put back by the GMs' audit
 * (sheet-audit.mjs), and a drawn roll applies only what the GMs hold (roll-draw.mjs `throwDrawn`).
 * With no GM connected the bridge says so (`noGm`), and nothing is armed or paid. A GM - a
 * Monokuma, a Monocub's Meddle resolved on the GM - writes it directly.
 */
export async function armCall(actor, { key, kind, grants, amount = null, from = null, nonce = null }) {
    if (!actor || !grants) return null;

    // `amount` only means something for `grants: "bonus"` - Monocub's Meddle is
    // the one caller that needs it, for the +1/-1 tier of its table. Every
    // other grant ignores it; carried through unconditionally so this stays a
    // small, boring change rather than a bonus-specific code path.
    // `nonce` names this one purchase. The Loaded Die is spent by the first roll
    // that throws it, and two windows opened on the same Call carry the same
    // name - see `LOADED_DIE` in forced-roll.mjs. A Hope Call's is its buyer's,
    // the name its GM's yes was kept for (E29 fix r2-H4; calls.mjs `spendHopeCall`).
    const payload = { key, kind, grants, amount, from, nonce: nonce ?? foundry.utils.randomID() };

    if (!game.user?.isGM) {
        // Answered now, not just sent (E03): the GM charges the buyer and may
        // refuse, and null here is "not armed, and nothing was charged".
        const { requestArmCall } = await import("./gm-bridge.mjs");
        const res = await requestArmCall(actor.id, payload);
        if (!res.ok || !res.value) return null;
        log(`The GM armed ${key} on ${actor.name} (${grants}).`);
        return true;
    }

    await appendArmedCall(actor, payload);
    log(`${actor.name} has ${key} armed (${grants}).`);

    // Tell the beneficiary, when they are not the buyer.
    //
    // A GM owns every actor, so a Monokuma arming Obstacle or Approval took
    // this branch and set the flag in silence - the player then met a roll
    // window with disadvantage already switched on and locked, and no reason
    // given. The socket path told them; the path that actually matters did not.
    if (from && from !== actor.id) {
        // "Another student spent Hope on you" was said for Monokuma's Obstacle
        // too, and for a Monocub's Meddle - whose author must stay unnamed.
        const voice = kind === "despair" ? "DRPG.Calls.armedByMonokuma"
            : kind === "hope" ? "DRPG.Calls.armedForYou"
            : "DRPG.Calls.armedByNobody";
        // Veiled for that one (E06 C10, 28.09.2026; audit S09-10): its list named the target to
        // every console at the moment a Monocub rolled Confusion in the room, and the roll does not
        // say whom it was aimed at. Confusion's own two cards are veiled for the same reason.
        await whisperToOwner(actor, `${cardHead({
            action: game.i18n.localize("DRPG.Calls.armedTitle")
        })}<p>${
            game.i18n.format(voice, {
                what: game.i18n.localize(`DRPG.Calls.grants.${grants}`)
            })
        }</p>`, voice === "DRPG.Calls.armedByNobody" ? { veiled: true } : {});
    }

    return true;
}

/**
 * The armed list as stored on the actor, shield and all - the one reader that must see
 * what is really on the flag, because it is about to write the list back.
 */
function pendingCallsRaw(actor) {
    const stored = actor?.getFlag?.(MODULE_ID, FLAGS.pendingCall) ?? null;
    if (!stored) return [];
    return (Array.isArray(stored) ? stored : [stored]).filter(entry => entry?.grants);
}

/**
 * An armed entry as it is stored: without `from`, who bought it.
 *
 * THE ARMED LIST NAMES NO BUYER (E06 C10, 28.09.2026; audit S09-10). `from` was stored on the
 * beneficiary's flag, which every browser holds, so a Monocub's Confusion named the Monocub to
 * every console, and a Support its buyer, while the target's own card says only that somebody
 * did something. The room sees a Monocub's dice (Confusion's too, the owner's answer of
 * 27.09), not who they were aimed at; the flag told everybody else both. Nothing reads the
 * stored `from`: the payer is read from the request as it arrives (bridge-guards.mjs
 * `armBuyerId`), and the beneficiary's notice from `armCall`'s argument. An entry written
 * before 1.2.65 loses it the next time its list is written.
 */
function unsigned(entry) {
    const stored = { ...entry };
    delete stored.from;
    return stored;
}

/**
 * THE ARMED CALLS 1.2.64 WROTE, WITHOUT THEIR BUYER (E06 fix r2-G1, 28.09.2026; review round
 * 2's mn5 = m4) - the `unsignArmedCalls` clause. `unsigned` above applies as a list is next
 * written, so a Call armed before the upgrade kept its `from` until it was spent: a Monocub's
 * id on its Confusion's target, a Support's buyer - and R9 at the table, which reads the live
 * world against world-secrets.mjs's rule `pendingCall.*.from`, failed until then. Once, on
 * the primary: each list that holds one written back without it, as a list (the shape
 * `appendArmedCall` writes, which `pendingCalls` reads beside a bare object from before
 * CALL-02). An array replaces the stored value whole, where an object would be merged into
 * it and keep the key. Every actor, and every unlinked token's own actor data, whose flags
 * live in its delta (`dropRollBookmarks`, action-rolls.mjs, and its note on what a real
 * Foundry does on that path). Read back; one still signed throws with the count, so the
 * world is not stamped and the next load tries again.
 *
 * @returns {Promise<null|{notPrimary: true}|{unsigned: number}>}
 */
export async function unsignArmedCalls() {
    if (!isPrimaryGm()) return { notPrimary: true };
    const listOf = flags => flags?.[MODULE_ID]?.[FLAGS.pendingCall] ?? null;
    const signed = flags => {
        const stored = listOf(flags);
        return Boolean(stored) && (Array.isArray(stored) ? stored : [stored])
            .some(entry => entry && typeof entry === "object" && Object.hasOwn(entry, "from"));
    };
    const holding = () => [
        ...(game.actors?.contents ?? []).filter(actor => signed(actor.flags)),
        ...(game.scenes?.contents ?? []).flatMap(scene => scene.tokens?.contents ?? [])
            .filter(token => signed(token.toObject()?.delta?.flags))
    ];
    const found = holding();
    if (!found.length) return null;
    for (const doc of found) {
        const onToken = doc.documentName === "Token";
        const stored = listOf(onToken ? doc.toObject().delta.flags : doc.flags);
        const list = (Array.isArray(stored) ? stored : [stored])
            .map(entry => entry && typeof entry === "object" ? unsigned(entry) : entry);
        try {
            await doc.update({ [`${onToken ? "delta." : ""}flags.${MODULE_ID}.${FLAGS.pendingCall}`]: list });
        } catch (err) {
            error(`Could not unsign the armed Calls of ${doc.name}`, err);
        }
    }
    const left = holding().length;
    if (left) throw new Error(`${left} of ${found.length} actor(s) or token(s) still name who bought an armed Call; the next load tries again`);
    log(`Took the buyer off the armed Calls of ${found.length} actor(s) or token(s).`);
    return { unsigned: found.length };
}

/**
 * Add one ready payload to the armed list. GM-side, and the one writer: the
 * bridge arms every player's Call through here (E29 C8; Support on somebody
 * else's sheet since E03), so stacking (CALL-02) holds on that road too.
 *
 * `at` is when this GM armed it, by this GM's clock, written over whatever the
 * payload says (E29 C8, for C9's reading of a hostile Call: the owner's Q3 (a),
 * applied when armed more than 60 s before the draw). An entry armed before
 * 1.2.68 has none.
 *
 * `by` is the GM it was armed on the word of, where that is a GM (E29 fix r2-H7,
 * 06.10.2026): this GM unless the caller names somebody else - the bridge names the
 * player it arms for, whose entry carries none. The GMs' audit gives back an entry
 * a GM armed that a player's write takes off with no roll of theirs to cover it
 * (sheet-audit.mjs `gmsCall`); a payload's own `by` is never kept.
 */
export async function appendArmedCall(actor, payload, { by = game.user } = {}) {
    if (!actor || !payload?.grants || !game.user?.isGM) return null;
    const entry = { ...payload, at: Date.now() };
    delete entry.by;
    if (by?.isGM) entry.by = by.id;
    if (entry.key === CONFUSION) return armConfusion(actor, entry);
    // The list as the GMs hold it (E29 fix r2-H7): a player's write still being judged - one that took a
    // Call of the GMs' off waits a moment for a roll to cover it - is judged, and given back, before this
    // reads the list; read before it, this write would leave the Call off in the GMs' mark.
    const { judgedFor } = await import("./sheet-audit.mjs");
    await judgedFor(actor.id);
    await actor.setFlag(MODULE_ID, FLAGS.pendingCall, [...pendingCallsRaw(actor), entry].map(unsigned));
    return true;
}

/**
 * Spend the armed Calls. Called by the roll pipeline once they have been used.
 *
 * All of them, because all of them applied: they were bought for the next roll
 * and the next roll has happened (CALL-02).
 *
 * ON THE ROAD, NAMED `call` (E33 C1b, 06.10.2026; R220's census). This and
 * `spendCallsByNonce` wrote the armed list with a bare `setFlag`/`unsetFlag`, which a
 * roll on a player's browser still makes (roll-dialog.mjs, action-rolls.mjs `throwDice`
 * when the GM drew nothing); the GMs' audit judges that write by the entries it takes
 * off (sheet-audit.mjs `actorFindings`, `callsOwed`), not by its reason (read on this day), so
 * the name changes no verdict - it says on the row what the write was. No `ref`: no judge reads
 * one on the armed list, and the row of a Call of the GMs' that stood on a roll names
 * that roll instead (sheet-audit.mjs `record`). One write takes the flag off where
 * `unsetFlag` did - its deletion operator; a Foundry with none (utils.mjs
 * `forcedDeletion`) leaves `null`, which every reader of the list reads as none
 * (`pendingCallsRaw`).
 */
export async function consumeCalls(actor) {
    if (shielded) return [];
    const pending = pendingCallsRaw(actor);
    const confusions = armedConfusions(actor);
    if (!pending.length && !confusions.length) return [];
    if (pending.length) await trustedWrite(actor, { [`flags.${MODULE_ID}.${FLAGS.pendingCall}`]: forcedDeletion() ?? null }, { reason: "call" });
    if (confusions.length) await spendConfusions(actor, confusions);
    return [...pending, ...confusions];
}

/**
 * Spend the armed Calls named by `nonces`, and leave every other one armed.
 *
 * A roll spends what it applied (E08+E28 C7, 03.10.2026; audit S02-20): the roll
 * window the Calls it opened with (roll-dialog.mjs `windowCalls`), `throwDice` the
 * ones it read before its window opened. A Call armed after that was spent with
 * the rest by `consumeCalls`, on a roll it never touched; it waits for the next
 * one now. One window, two fates still holds (CALL-02 with CALL-03): a Loaded Die
 * a statistic rolled off the sheet cannot load is not among the window's names.
 * Returns what was spent.
 */
export async function consumeCallsByNonce(actor, nonces) {
    if (shielded) return [];
    return spendCallsByNonce(actor, nonces);
}

/**
 * The spend itself, which no shield stands in front of: a GM spends with it the Calls a
 * player's roll applied as it draws that roll (roll-draw.mjs `drawOnGm`, E08+E28 C12b), and
 * this GM's own supporting roll, if one is open here, has nothing to do with somebody
 * else's. The roller's browser spends nothing of a drawn roll (`throwDice`, roll-dialog.mjs
 * `onCloseApplication`): the GM read what it applied before it threw the dice, so a spend
 * landing first on the roller's side would have taken the Calls out from under the GM's
 * reading.
 *
 * On a GM's browser the names are kept a minute (`spentByGm`), whether the flag still
 * held them or not (E29 fix r2-H7, 06.10.2026): a drawn roll reads the armed list before
 * its dice and spends after them, so a player's write that took an entry off between the
 * two is judged while the roll that applied it is still on its way - and the GMs' audit,
 * which gives back an entry of the GMs' a player's write took (sheet-audit.mjs
 * `keptCalls`), gives back none their own spend named. A reload forgets them. And the
 * spend then waits for that student's judgements, as `appendArmedCall` does: a spend
 * that read the list while such a write was judged would write it without the Call the
 * audit gives back, and the GMs' mark, which moves by a GM's write as it is written, would
 * lose that Call while the document holds it.
 */
export async function spendCallsByNonce(actor, nonces) {
    const names = new Set(nonces ?? []);
    if (!names.size) return [];
    if (game.user?.isGM) {
        noteGmSpend(names);
        const { judgedFor } = await import("./sheet-audit.mjs");
        await judgedFor(actor.id);
    }
    const pending = pendingCallsRaw(actor);
    const spent = pending.filter(entry => names.has(entry.nonce));
    const kept = pending.filter(entry => !names.has(entry.nonce));
    const confusions = armedConfusions(actor).filter(entry => names.has(entry.nonce));
    if (spent.length) await trustedWrite(actor, { [`flags.${MODULE_ID}.${FLAGS.pendingCall}`]: kept.length ? kept.map(unsigned) : forcedDeletion() ?? null }, { reason: "call" });
    if (confusions.length) await spendConfusions(actor, confusions);
    return [...spent, ...confusions];
}

/** How long a GM's spend is remembered (`spentByGm`): longer than a judgement waits for a roll. Chosen, not measured. */
const GM_SPENT_MS = 60_000;
/** nonce -> when this GM's `spendCallsByNonce` named it, oldest first. */
const gmSpent = new Map();

function noteGmSpend(names) {
    const at = Date.now();
    for (const name of names) {
        gmSpent.delete(name);
        gmSpent.set(name, at);
    }
    for (const [name, when] of gmSpent) {
        if (when >= at - GM_SPENT_MS) break;
        gmSpent.delete(name);
    }
}

/** Whether a GM's spend on this browser named this armed Call in the last minute (E29 fix r2-H7; see `spendCallsByNonce`). */
export function spentByGm(nonce) {
    return typeof nonce === "string" && (gmSpent.get(nonce) ?? -Infinity) >= Date.now() - GM_SPENT_MS;
}

/**
 * The single-slot name, kept so a caller written before CALL-02 still spends
 * every armed Call rather than none. Answers with the first one spent.
 */
export async function consumeCall(actor) {
    return (await consumeCalls(actor))[0] ?? null;
}

/** Does this character have permission for a given roll control right now? */
export function grants(actor, what) {
    return pendingCalls(actor).some(entry => entry.grants === what);
}

/* ==========================================================================
 * A CONFUSION'S ARMED CALLS, IN THE GMS' STORE (E06 fix r2-G4)
 * --------------------------------------------------------------------------
 * A Confusion that lands arms a Call on its target, and until 1.2.65 that was
 * an entry of the target's `pendingCall` flag - world data, which every browser
 * holds - written at the moment the room watched the Monocub roll. The roll
 * says neither whom it was aimed at nor, past "Help" or "Hinder", what it did;
 * the flag told every console both (review round 2's mn2, 28.09.2026: C10's
 * decision that the room's view covers it did not hold, the room does not see
 * the target). So a Confusion's Call is a row of the GMs' store
 * (gm-stores.mjs `confusionStore`), and each owner holds a copy of their own
 * characters' rows (`confusionCopy`), sent by a GM when one is armed or spent,
 * and when the owner asks - at load, when a primary GM's world has loaded
 * (`drpgPrimaryReady`), and after a roll spent one. Asking is the owner's;
 * answering the primary's, about the asker's own characters, found from
 * Foundry's `senderId`; the copy is taken only from a GM, and only for a
 * character this user owns. The other Calls stay on the flag: Support and
 * Approval are announced where they are bought, and a Monokuma's is the GM's.
 *
 * A roll on the owner's browser spends the Confusion there at once - off the
 * copy, with the nonce kept as `spent` - and the ask tells the primary. Since
 * E08+E28 C12b a roll the GM draws is spent by the GM as it draws it, and the
 * primary takes an ask's `spent` only for a nonce a drawn roll's record names
 * (`answerConfusions`): a roll thrown with no GM connected keeps its Confusion
 * spent in this browser's copy for the session and armed in the store. What a
 * real table's two GMs do with one ask each has not been measured; the ask goes
 * to the primary alone.
 *
 * What the store does not hide: a Confusion's critical wastes or refunds an
 * action on the target, and action budgets are actor data every browser holds
 * (the GM handbook's "What every browser holds anyway").
 * ========================================================================== */

const CONFUSION = "meddle";
const SOCKET_EVENT = `module.${MODULE_ID}`;
const ACTION_CONFUSIONS = "confusion.calls";
const ACTION_CONFUSIONS_ASK = "confusion.ask";
/** Nonce -> actor id: what a roll on this browser spent, for the rest of the session. */
const spentHere = new Map();

/** The Confusions armed on this character, as this browser holds them: the GMs' store on a GM's, the owner's copy on a player's. */
function armedConfusions(actor) {
    if (!actor?.id) return [];
    const row = game.user?.isGM ? confusionStore.get(actor.id) : (confusionCopy.read() ?? {})[actor.id];
    return (Array.isArray(row?.calls) ? row.calls : []).filter(entry => entry?.grants && !spentHere.has(entry.nonce));
}

/** GM: a Confusion armed in its target's row, and the target's owners sent their copy. */
async function armConfusion(actor, payload) {
    if (!game.user?.isGM) return null;
    await confusionStore.whenHydrated();
    const held = confusionStore.get(actor.id)?.calls;
    await confusionStore.patch(actor.id, { calls: [...(Array.isArray(held) ? held : []), unsigned(payload)] });
    tellConfusionOwners(actor.id);
    return true;
}

/** GM: these nonces taken out of a character's row; answers whether anything went. */
async function dropConfusions(actorId, nonces) {
    const calls = confusionStore.get(actorId)?.calls;
    if (!Array.isArray(calls)) return false;
    const left = calls.filter(entry => !nonces.includes(entry?.nonce));
    if (left.length === calls.length) return false;
    if (left.length) await confusionStore.patch(actorId, { calls: left });
    else await confusionStore.drop(actorId);
    return true;
}

/** The Confusions a roll on this browser spent: off the store on a GM's; off the copy, and told to the primary, on a player's. */
async function spendConfusions(actor, spent) {
    const nonces = spent.map(entry => entry?.nonce).filter(nonce => typeof nonce === "string" && nonce);
    if (!nonces.length) return;
    if (game.user?.isGM) {
        if (await dropConfusions(actor.id, nonces)) tellConfusionOwners(actor.id);
        return;
    }
    // Before any await: the window's close and the roll pipeline both spend one roll's Calls.
    for (const nonce of nonces) spentHere.set(nonce, actor.id);
    const held = confusionCopy.read() ?? {};
    const row = held[actor.id] ?? {};
    const stamps = confusionCopy.stamps();
    try {
        await confusionCopy.receive({ ...held, [actor.id]: {
            calls: (Array.isArray(row.calls) ? row.calls : []).filter(entry => !nonces.includes(entry?.nonce)),
            spent: [...new Set([...(Array.isArray(row.spent) ? row.spent : []), ...nonces])]
        } }, { ...stamps, [actor.id]: (Number(stamps[actor.id]) || 0) + 1 });
    } catch (err) {
        error("Could not keep a spent Confusion off this browser's copy", err);
    }
    askForConfusions();
}

/**
 * GM: one user's own characters' Confusions, and only those, with a stamp per character
 * they own - the newest decision about its row, 0 for one this browser never held.
 */
export function confusionsFor(userId) {
    const user = game.users.get(userId);
    const confusions = {}, stamps = {};
    if (!game.user?.isGM || !user || user.isGM) return { confusions, stamps };
    for (const actor of game.actors ?? []) {
        if (actor.type !== "character" || !actor.testUserPermission?.(user, "OWNER")) continue;
        stamps[actor.id] = confusionStore.newest(actor.id);
        const calls = confusionStore.get(actor.id)?.calls;
        if (Array.isArray(calls) && calls.length) confusions[actor.id] = { calls };
    }
    return { confusions, stamps };
}

/** GM: send one user their Confusions. Addressed, and only while they are here; nothing while the suite holds the stores. */
export function sendConfusionsTo(userId) {
    const user = game.users.get(userId);
    if (!game.user?.isGM || !user?.active || user.isGM || gmStoresQuiet()) return false;
    const { confusions, stamps } = confusionsFor(userId);
    game.socket.emit(SOCKET_EVENT, { action: ACTION_CONFUSIONS, userId, confusions, stamps }, { recipients: [userId] });
    return true;
}

/** GM: every connected owner of this character sent their copy. */
function tellConfusionOwners(actorId) {
    const actor = game.actors.get(actorId);
    if (!actor) return;
    for (const user of game.users ?? []) {
        if (user.active && !user.isGM && actor.testUserPermission?.(user, "OWNER")) sendConfusionsTo(user.id);
    }
}

/** After a restore (gm-stores.mjs `restoreCase`): every connected player sent their Confusions again. */
export async function retellConfusions() {
    if (!game.user?.isGM || gmStoresQuiet()) return 0;
    let sent = 0;
    for (const user of game.users ?? []) {
        if (user.active && !user.isGM && sendConfusionsTo(user.id)) sent++;
    }
    return sent;
}

/** Owner: take a GM's answer where it is newer (`confusionCopy`), for this user's own characters only. */
export async function receiveConfusions(confusions, stamps) {
    const mine = {}, own = {};
    const shape = entry => entry && typeof entry === "object" && typeof entry.grants === "string" && typeof entry.nonce === "string"
        ? { key: CONFUSION, kind: typeof entry.kind === "string" ? entry.kind : null, grants: entry.grants,
            amount: Number.isFinite(Number(entry.amount)) && entry.amount !== null ? Number(entry.amount) : null, nonce: entry.nonce }
        : null;
    for (const [actorId, s] of Object.entries(stamps ?? {})) {
        if (!game.actors.get(actorId)?.isOwner) continue;
        own[actorId] = Number(s) || 0;
        const calls = Array.isArray(confusions?.[actorId]?.calls) ? confusions[actorId].calls.map(shape).filter(Boolean) : [];
        if (calls.length) mine[actorId] = { calls };
    }
    return confusionCopy.receive(mine, own);
}

/** Owner: ask the primary for this user's Confusions, telling it the ones a roll here spent. */
function askForConfusions(primary = primaryGmId()) {
    if (!primary || game.user.isGM) return;
    const spent = {};
    for (const [actorId, row] of Object.entries(confusionCopy.read() ?? {})) {
        if (Array.isArray(row?.spent) && row.spent.length) spent[actorId] = [...row.spent];
    }
    for (const [nonce, actorId] of spentHere) {
        if (!(spent[actorId] ??= []).includes(nonce)) spent[actorId].push(nonce);
    }
    try {
        game.socket.emit(SOCKET_EVENT, { action: ACTION_CONFUSIONS_ASK, spent }, { recipients: [primary] });
    } catch (err) {
        error("Could not ask the GM for this user's Confusions", err);
    }
}

/*
 * A REPORT OF A CONFUSION SPENT IS TAKEN FOR A ROLL THE GM DREW (E08+E28 C12b, 04.10.2026; the
 * owner's note of 28.09.2026 on E06 fix r2-G4). The ask's `spent` was the owner's word for their
 * own characters, and a Confusion that hinders is one a player gains by calling spent with no
 * roll at all. Since C12b the GM spends the Calls a drawn roll applied as it draws it, and
 * writes their nonces in the roll's record (`used.calls`, roll-draw.mjs `drawOnGm`); a report
 * is taken for a nonce a record names, for that record's character, and no other - the rest
 * stays armed. Where the players' rolls are thrown in their own browsers - a Daggerheart the
 * draw was not written for (roll-draw.mjs `reviewBuild`) - there is no record to name anything,
 * and the report is taken as in 1.2.66: without it a Confusion would stay armed for good.
 */
function namedByRecords() {
    const named = new Map();
    for (const row of Object.values(rollStore.entries() ?? {})) {
        for (const nonce of Array.isArray(row?.used?.calls) ? row.used.calls : []) named.set(nonce, row.actorId);
    }
    return named;
}

/**
 * Primary: drop what the asker spent on their own characters - a nonce a drawn roll's record
 * names, above - then answer them and every other owner of what changed. Exported for the suite.
 */
export async function answerConfusions(sender, spent) {
    const { rollDrawState } = await import("./roll-draw.mjs");
    const named = rollDrawState().state === "ok" ? namedByRecords() : null;
    for (const [actorId, nonces] of Object.entries(spent && typeof spent === "object" ? spent : {})) {
        // A packet's actor ids are claims: only a character the asker owns has its Confusion spent.
        if (!Array.isArray(nonces) || !ownsActor(sender, actorId)) continue;
        const taken = nonces.filter(nonce => typeof nonce === "string" && (!named || named.get(nonce) === actorId));
        if (taken.length && await dropConfusions(actorId, taken)) tellConfusionOwners(actorId);
    }
    sendConfusionsTo(sender.id);
}

function onConfusionsSocket(payload, senderId) {
    if (payload?.action === ACTION_CONFUSIONS_ASK) {
        if (!isPrimaryGm()) return;
        const sender = senderOf(senderId);
        if (!sender || sender.isGM) return;
        // Asked while the suite holds the stores: answered once it lets them go, from the other GMs' rows too.
        whenGmStoresAudible().then(() => confusionStore.whenHydrated()).then(() => answerConfusions(sender, payload.spent))
            .catch(err => error("Could not answer a player's Confusions", err));
        return;
    }
    if (payload?.action !== ACTION_CONFUSIONS || game.user.isGM) return;
    // A GM's, and addressed to this user: a player cannot hand another a Confusion.
    if (!replyForMe(payload, senderId)) return;
    receiveConfusions(payload.confusions, payload.stamps).catch(err => error("Could not keep this user's Confusions", err));
}

/** At ready: the copy's listener on every client, and an owner's first ask. */
export function registerConfusionCopy() {
    Hooks.once("ready", () => {
        game.socket.on(SOCKET_EVENT, onConfusionsSocket);
        if (game.user.isGM) return;
        askForConfusions();
        Hooks.on("drpgPrimaryReady", primary => askForConfusions(primary));
    });
}

/**
 * THE CONFUSIONS 1.2.64 ARMED ON THEIR TARGET'S FLAG (E06 fix r2-G4, 28.09.2026; review round
 * 2's mn2) - the `liftArmedConfusions` clause. Once, on the primary, after the store holds the
 * other GMs' copies: each world actor's `meddle` entries go into its row (one a GM's browser
 * already holds, by its nonce, is not added twice), and leave the flag - written back as a list
 * without them, or unset - once the row reads back from storage; then its owners are sent their
 * copy. World actors only: a Confusion is armed on `game.actors.get(targetId)`
 * (monocub.mjs `cubAbilityOnGm`), never on a token's own data. One still on a flag throws with
 * the count, so the world is not stamped and the next load tries again.
 *
 * @returns {Promise<null|{notPrimary: true}|{lifted: number}>}
 */
export async function liftArmedConfusions() {
    if (!isPrimaryGm()) return { notPrimary: true };
    if (await confusionStore.whenHydrated() === "timedOut") {
        throw new Error("the other GMs' copies of the Confusions did not arrive; the next load tries again");
    }
    const onFlag = actor => pendingCallsRaw(actor).filter(entry => entry.key === CONFUSION);
    const holding = () => (game.actors?.contents ?? []).filter(actor => onFlag(actor).length);
    const found = holding();
    if (!found.length) return null;
    for (const actor of found) {
        const held = confusionStore.get(actor.id)?.calls;
        const calls = Array.isArray(held) ? [...held] : [];
        for (const entry of onFlag(actor)) {
            const nonce = typeof entry.nonce === "string" && entry.nonce ? entry.nonce : foundry.utils.randomID();
            if (!calls.some(call => call?.nonce === nonce)) calls.push(unsigned({ ...entry, nonce }));
        }
        await confusionStore.patch(actor.id, { calls });
    }
    await confusionStore.idle();
    for (const actor of found) {
        if (!confusionStore.persisted(actor.id)) continue;
        const rest = pendingCallsRaw(actor).filter(entry => entry.key !== CONFUSION);
        try {
            if (rest.length) await actor.setFlag(MODULE_ID, FLAGS.pendingCall, rest.map(unsigned));
            else await actor.unsetFlag(MODULE_ID, FLAGS.pendingCall);
        } catch (err) {
            error(`Could not take the Confusions off ${actor.name}'s flag`, err);
        }
        tellConfusionOwners(actor.id);
    }
    const left = holding().length;
    if (left) throw new Error(`${left} of ${found.length} character(s) still hold a Confusion in world data; the next load tries again`);
    log(`Moved the Confusions armed on ${found.length} character(s) into the GM store.`);
    return { lifted: found.length };
}

/* ==========================================================================
 * APPLYING A CALL
 * ========================================================================== */

/**
 * Would this Call change nothing? Asked before a Despair Call is PAID.
 *
 * Review of CALL-15 and CALL-05 (17.09): `applyCall` refuses these and hands the
 * price back. The public "spent" card waits for the effect on both lines now
 * (DESP-11, CALL-13), so a refusal there no longer tells the table about a
 * purchase that did not happen - but it still charges the pool, refunds it, and
 * only then says why. The same questions, asked of the picker's answer before
 * the pool is touched, give the reason first and move nothing. `applyCall` keeps
 * its own checks: the world can move between the two.
 *
 * ONE DARKENING CHECK, NOT TWO. DESP-04 asked `overflowBlocksHope` in
 * `spendDespairCallFor` itself; it is this function's `grantsHope` question now,
 * with the same `hopeBlocked` sentence, so the Monokuma is told once.
 *
 * Synchronous, because the sheet asks it between the picker and the
 * confirmation. The project question needs projects.mjs, which this file can
 * only import lazily, so it is `projectRefusal` below and is awaited separately.
 *
 * @returns {string|null}  Why not, ready to show; null when the Call would land.
 */
export function refusalBeforePaying(call, choice = {}) {
    const i18n = game.i18n;
    const target = choice.target ?? null;
    if (call?.sealsRoom && choice.room && isSealed(choice.room)) {
        return i18n.format("DRPG.Calls.alreadySealed", { room: choice.room });
    }
    if (call?.silences && target && isCallSilenced(target)) {
        return i18n.format("DRPG.Calls.alreadySilenced", { name: target.name });
    }
    if (call?.chains && target && isChained(target)) {
        return i18n.format("DRPG.Calls.alreadyChained", { name: target.name });
    }
    if (call?.damage && target && Object.keys(call.damage)
        .every(resource => resourceValue(target, resource) >= resourceMax(target, resource))) {
        return i18n.format("DRPG.Calls.nothingToMark", { name: target.name });
    }
    // A second copy of the same Call adds nothing, and the first is still there
    // to be used (CALL-02). Dice Calls are exempt: those stack by design.
    if (call?.grants && target && alreadyArmed(target, call)) {
        return i18n.format("DRPG.Calls.alreadyArmed", { name: target.name, call: call.label });
    }
    if (call?.grantsHope && target) {
        if (overflowBlocksHope()) return i18n.localize("DRPG.Overflow.hopeBlocked");
        const max = resourceMax(target, "hope") || STARTING.hopeMax;
        if (resourceValue(target, "hope") >= max) return i18n.localize("DRPG.Despair.hopeAlreadyFull");
    }
    return null;
}

/**
 * The project half of `refusalBeforePaying`, which has to await (CALL-10).
 *
 * The API and a stale picker can both name a project that cannot move: a
 * finished one, or one a sabotage has frozen. `pickProject` already leaves those
 * out of the list; this is the boundary behind it, asked by `spendDespairCallFor`
 * before the pool is touched.
 *
 * @returns {Promise<string|null>}  Why not, ready to show; null when it can move.
 */
export async function projectRefusal(call, choice = {}) {
    if (!call?.progress || !choice.project) return null;
    const { allProjects, isComplete, isFrozen } = await import("./projects.mjs");
    const project = allProjects().find(p => p.id === choice.project);
    if (!project || isComplete(project) || isFrozen(project.id)) {
        return game.i18n.localize("DRPG.Project.noneToMove");
    }
    return null;
}

/**
 * Thrown by a branch whose target is already where the Call would put it - a
 * full Health track, a room already sealed. The price goes back like any other
 * failure, but it is not a fault, so it is neither logged as an error nor given
 * the "could not be applied" line a fault gets; the branch has already said what
 * was wrong (CALL-15).
 */
class NothingToDo extends Error {}

/* --------------------------------------------------------------------------
 * ONE FUNCTION PER EFFECT, run by `applyCall` below in the order they have
 * always run. The split is Hygiene C - bodies moved, nothing else; the guards
 * inside them are the far side of the rule `refusalBeforePaying` states at the
 * door. The picker's answer can go stale between the two, so the branch that is
 * about to write asks again, and throws `NothingToDo` when there is nothing
 * left to do - which refunds without calling it a fault.
 * -------------------------------------------------------------------------- */

// --- effects that arm the next roll ---
async function grantEffect(actor, call, choice, done, { key, kind, nonce = null }) {
    // Support and Approval arm someone else; the rest arm the caller.
    const beneficiary = choice.target ?? actor;

    // The boundary for CALL-02: the picker refuses this before paying, and
    // a world that moved in between refuses here and hands the price back.
    if (alreadyArmed(beneficiary, call)) {
        ui.notifications.warn(game.i18n.format("DRPG.Calls.alreadyArmed",
            { name: beneficiary.name, call: call.label }));
        throw new NothingToDo(`${beneficiary.name} already holds ${call.key}`);
    }

    const armed = await armCall(beneficiary, { key, kind, grants: call.grants, from: actor.id, nonce });

    // `armCall` returns null when the flag could not be written - no GM
    // online to forward it, or the write itself failed. Announcing it
    // anyway is how six Hope bought a Free Critical that was never armed
    // and never refunded, because the receipt line made the Call look
    // like it had done something.
    if (!armed) throw new Error(`could not arm ${key} on ${beneficiary.name}`);

    done.push(game.i18n.format("DRPG.Calls.armed", {
        name: beneficiary.name,
        what: game.i18n.localize(`DRPG.Calls.grants.${call.grants}`)
    }));
}

// --- Despair spent as somebody else's Hope ---
//
// The pool has ALREADY been charged by `spendDespairCall`, so this only
// credits the Hope. Routing it through `convertDespairToHope` would take
// the Despair a second time - the exchange rate is the Call's own cost.
async function hopeFromDespairEffect(actor, call, choice, done) {
    // No Hope is earned under the Despair darkening, and this is Hope earned:
    // the write would be stripped and the Call would still report "gains 1
    // Hope" and keep its Despair (DESP-04, CALL-05). `refusalBeforePaying`
    // asks first; this is the far side of it, for a darkening that began while
    // the picker was open. Not a fault, so no "tell the GM".
    if (overflowBlocksHope()) {
        ui.notifications.warn(game.i18n.localize("DRPG.Overflow.hopeBlocked"));
        throw new NothingToDo("the darkening blocks Hope");
    }
    // From the Hope the GMs hold (sheet-audit.mjs `meansWrite`, E29 fix r2-H24): a console's raised Hope,
    // not put back yet, was granted on top.
    const { meansWrite } = await import("./sheet-audit.mjs");
    const { held, next } = await meansWrite(choice.target, async ({ hope }, maxOf) => {
        const next = Math.min(maxOf("hope") || STARTING.hopeMax, hope + call.grantsHope);
        if (next !== hope) await trustedWrite(choice.target, { "system.resources.hope.value": next }, { reason: "call" });
        return { held: hope, next };
    });

    if (next === held) {
        ui.notifications.warn(game.i18n.localize("DRPG.Despair.hopeAlreadyFull"));
        throw new NothingToDo(`${choice.target.name} is already at maximum Hope`);
    }

    done.push(game.i18n.format("DRPG.Calls.hopeGranted", {
        name: choice.target.name, n: next - held
    }));
    await whisperToOwner(choice.target, `<p>${game.i18n.format("DRPG.Despair.hopeConverted", {
        n: next - held, who: foundry.utils.escapeHTML(actor?.name ?? "Monokuma")
    })}</p>`);
}

/*
 * --- Despair poured into the overflow (Z14) ---
 *
 * No target of its own: the thing it acts on is the world. That is why
 * the Call is `target: "none"` and why this branch runs above the ones
 * that need somebody to point at.
 *
 * The pool has already been charged by `spendDespairCall`, exactly as
 * with `grantsHope` above - this only moves the point to its
 * destination. It pushes a receipt line for the same reason every
 * branch here does: `applyCall` calls a Call with an empty receipt
 * FAILED and hands the price back, so a branch that worked silently
 * would be a Call that worked and then refunded itself (trap 100).
 */
async function feedOverflowEffect(actor, call, choice, done) {
    const { addOverflow, overflowCount, overflowThreshold } =
        await import("./overflow.mjs");
    const after = await addOverflow(call.feedsOverflow, { reason: "Feed the Overflow" });
    if (after === null) throw new Error("the overflow refused the Despair");
    done.push(game.i18n.format("DRPG.Calls.overflowFed", {
        n: call.feedsOverflow, count: overflowCount(), max: overflowThreshold()
    }));
}

// --- damage and stress ---
async function damageEffect(actor, call, choice, done) {
    // What actually lands, not what the Call is worth: Pain on a student
    // with one mark left used to report "takes 2 Health" and keep all of
    // its price, and on a full track it did nothing at all (CALL-15).
    // Held to the marks and the maxima the GMs hold (sheet-audit.mjs `meansWrite`, E29 fix r2-H24):
    // a console's lowered maximum, not put back yet, took the marks off the Call.
    const { meansWrite } = await import("./sheet-audit.mjs");
    const landed = await meansWrite(choice.target, async (held, maxOf) => {
        const update = {};
        const landed = [];
        for (const [resource, amount] of Object.entries(call.damage)) {
            // Health and Sanity are reverse resources: marks count up to max.
            const marks = held[resource];
            const next = Math.min(maxOf(resource) ?? 0, marks + amount);
            if (next === marks) continue;
            update[`system.resources.${resource}.value`] = next;
            landed.push(`${next - marks} ${resource === "hitPoints" ? "Health" : "Sanity"}`);
        }
        if (landed.length) await trustedWrite(choice.target, update, { reason: "call" });
        return landed;
    });
    if (!landed.length) {
        ui.notifications.warn(game.i18n.format("DRPG.Calls.nothingToMark", { name: choice.target.name }));
        throw new NothingToDo(`${choice.target.name} has nothing left to mark`);
    }
    done.push(game.i18n.format("DRPG.Calls.damaged", {
        name: choice.target.name,
        what: landed.join(", ")
    }));
}

// --- project progress ---
//
// Named from the local project list rather than from what `addProgress`
// returns: a player's write is forwarded to the GM and comes back as a
// bare acknowledgement, so reading the name off it produced a receipt
// saying "progress on ?" - which reads exactly like nothing happened.
// `wipesProgress` went with the Call that carried it (29.08) - see the
// note above the project Calls in config.mjs. The branch went too rather
// than being left standing for nothing: an unreachable handler is how a
// deleted rule comes back by accident.
async function progressEffect(actor, call, choice, done, { key }) {
    const { addProgress, allProjects } = await import("./projects.mjs");
    const project = allProjects().find(p => p.id === choice.project);

    if (!project) {
        ui.notifications.warn(game.i18n.localize("DRPG.Project.gone"));
        throw new Error(`project ${choice.project} no longer exists`);
    } else {
        // Who pays, as the bridge asks it of a player's (E08+E28 C16: gm-bridge.mjs `project.progress`), and
        // for which Call (fix r2-H2): a player's is held to that Call's progress and to its price paid.
        const applied = await addProgress(choice.project, call.progress, { actorId: actor?.id ?? null, call: key });
        if (!applied) throw new Error(`addProgress refused ${choice.project}`);

        // A GM's write says outright whether the bar moved. A player's
        // is forwarded, so the answer comes back as a whisper instead -
        // never claim a number this side of the socket.
        if (applied.changed === false) {
            done.push(game.i18n.format("DRPG.Calls.progressRefused", { name: project.name }));
        } else if (applied.changed) {
            done.push(game.i18n.format("DRPG.Calls.progressedTo", {
                name: project.name, current: applied.to, target: applied.target
            }));
        } else {
            done.push(game.i18n.format("DRPG.Calls.progressSent", {
                name: project.name, n: call.progress > 0 ? `+${call.progress}` : call.progress
            }));
        }
    }
}

/*
 * --- crossings, actions and a rest bought with Hope (E13) ---
 *
 * None of the three touches `pendingCall`, and every one of them pushes
 * a receipt line: `applyCall` reports `failed` when nothing was pushed,
 * and a Call that failed hands the Hope back. A branch that did its work
 * silently would be a Call that worked and then refunded itself (trap
 * 100).
 */
/** A Hope Call's key, as the GMs' audit reads a grant's `ref` (E29 C4). */
const callKeyOf = call => Object.keys(HOPE_CALLS).find(key => HOPE_CALLS[key] === call) ?? null;

async function freeMovesEffect(actor, call, choice, done) {
    const { grantFreeMoves, freeMovesLeft } = await import("./actions.mjs");
    if (!await grantFreeMoves(actor, call.freeMoves, { reason: "call", ref: callKeyOf(call) })) {
        throw new Error(`could not bank ${call.freeMoves} crossing(s)`);
    }
    done.push(plural("DRPG.Calls.sprinted", { n: freeMovesLeft(actor) }));
}

async function freeActionsEffect(actor, call, choice, done) {
    const { grantFreeActions, freeActionsLeft } = await import("./actions.mjs");
    if (!await grantFreeActions(actor, call.freeActions, { reason: "call", ref: callKeyOf(call) })) {
        throw new Error(`could not bank ${call.freeActions} action(s)`);
    }
    done.push(plural("DRPG.Calls.burst", { n: freeActionsLeft(actor) }));
}

async function freeRestEffect(actor, call, choice, done) {
    const { takeRest } = await import("./rest.mjs");
    // Every gate a Short Rest normally has, waived - decision 4, and
    // the reasoning is on `relief` in config.mjs. `quiet` because the
    // Call is already printing a card and this is one purchase.
    const rested = await takeRest(actor, call.freeRest, {
        free: true, ignoreRoom: true, ignoreLimit: true, quiet: true
    });
    // Backing out of the "what do you want back" picker is a real
    // cancel: nothing was restored, so the five Hope come back.
    // NothingToDo, not a fault, when the player chose not to (live check,
    // 17.09 - the refund arrived under a "Tell the GM" error toast). A rest
    // that FAILED is a fault and is logged as one: `takeRest` answers false
    // for the first and null for the second.
    if (rested === false) throw new NothingToDo("the rest was not taken");
    if (!rested) throw new Error("the rest failed");
    done.push(...(rested.applied ?? []));
}

// --- a new rule, announced to everyone AND written down ---
//
// Twelve Despair used to buy a chat message that scrolled away. The
// rule now lands on the standing list every character sheet carries,
// which is the only form in which a rule can actually bind anybody.
async function newRuleEffect(actor, call, choice, done) {
    const { addRule } = await import("./rules.mjs");
    const recorded = await addRule(choice.text);
    if (recorded) done.push(game.i18n.localize("DRPG.Rules.recorded"));

    await announce({
        // The catalogue has had a `newRule` sound since v1.1.8 and this
        // card - the only thing that announces one - carried no flag, so
        // it was a sound a GM could map a file to and never hear. Found
        // in E17 by asking the question R3 does not: not "does every
        // sound played exist", but "is every sound that exists played".
        // Public, no whisper list, so the whole table hears it - which
        // is what the catalogue entry says it is for.
        flags: { [MODULE_ID]: { sfx: "newRule" } },
        content: `<div class="drpg-new-rule">
            <h3>${game.i18n.localize("DRPG.Calls.newRuleTitle")}</h3>
            <p>${foundry.utils.escapeHTML(choice.text)}</p>
        </div>`
    });
    done.push(game.i18n.localize("DRPG.Calls.newRuleAnnounced"));
}

// --- sealed rooms ---
async function sealRoomEffect(actor, call, choice, done) {
    if (isSealed(choice.room)) {
        ui.notifications.warn(game.i18n.format("DRPG.Calls.alreadySealed", { room: choice.room }));
        throw new NothingToDo(`${choice.room} is already sealed`);
    }
    // Announced only when written (E03; audit S09-11): `writeWorld` answers
    // null on a client that cannot write, and the card said "sealed" anyway.
    if (!await sealRoom(choice.room)) throw new Error(`could not seal ${choice.room}`);
    done.push(game.i18n.format("DRPG.Calls.sealed", { room: choice.room }));
}

// --- silence: no Hope Calls until this time of day ends ---
async function silenceEffect(actor, call, choice, done) {
    if (isCallSilenced(choice.target)) {
        ui.notifications.warn(game.i18n.format("DRPG.Calls.alreadySilenced", { name: choice.target.name }));
        throw new NothingToDo(`${choice.target.name} is already silenced`);
    }
    await restrict(choice.target, { silenced: true });
    done.push(game.i18n.format("DRPG.Calls.silenced", { name: choice.target.name }));
    await tell(choice.target, "DRPG.Calls.silencedNotice");
}

// --- chained: pinned to the room they are standing in ---
async function chainEffect(actor, call, choice, done) {
    if (isChained(choice.target)) {
        ui.notifications.warn(game.i18n.format("DRPG.Calls.alreadyChained", { name: choice.target.name }));
        throw new NothingToDo(`${choice.target.name} is already chained`);
    }
    const { roomOfActor } = await import("./movement.mjs");
    const here = roomOfActor(choice.target);
    await restrict(choice.target, { chained: true, room: here });
    done.push(game.i18n.format("DRPG.Calls.chained", {
        name: choice.target.name, room: here ?? "-"
    }));
    await tell(choice.target, "DRPG.Calls.chainedNotice");
}

/* --- a motive: a demand, a deadline and a price for missing it ---
 *
 * The whole record comes from the picker, so this branch does nothing
 * but hand it over and report. `setMotive` announces publicly - the
 * guide requires it - which means the receipt below is the SECOND
 * thing the table sees, not the first.
 */
async function motiveEffect(actor, call, choice, done) {
    const { setMotive } = await import("./rules.mjs");
    const record = await setMotive(choice.motive);
    if (!record) throw new Error("the motive was not announced");
    done.push(plural("DRPG.Calls.motiveSet", { n: record.timesOfDay }));
}

/* --- gather everyone, now or at the start of the next time of day ---
 *
 * `defers` is the E14 change and it is the whole Call: nobody moves
 * now, everybody is told where and when, and the crossing they make to
 * get there is their own. The immediate branch is kept because
 * `chapter.mjs` still gathers the cast for a body discovery and a
 * trial, and those are not announcements - they are the game moving
 * the cast because the fiction just did.
 */
async function gatherEffect(actor, call, choice, done) {
    if (call.defers) {
        const order = await scheduleGather(choice.room, actor?.name);
        if (!order) throw new Error(`could not call an assembly in ${choice.room}`);
        done.push(game.i18n.format("DRPG.Calls.gatherCalled", { room: choice.room }));
    } else {
        const moved = await gatherEveryone(choice.room);
        done.push(plural("DRPG.Calls.gathered", { room: choice.room, n: moved }));
    }
}

// --- destroy an item ---
async function destroyItemEffect(actor, call, choice, done) {
    // A GM'S (E33 C1a, 06.10.2026; R220's census). Contraband is a Despair Call, bought on a GM's
    // browser (calls.mjs `spendDespairCallFor`); `applyCall` is exported, and handed it on a
    // player's console this deleted the item, with no Despair spent.
    if (!game.user.isGM) throw new NothingToDo();
    const name = choice.item.name;
    await choice.item.delete();
    done.push(game.i18n.format("DRPG.Calls.destroyed", { item: name }));
}

/**
 * Apply everything a Call does, after it has been paid for.
 *
 * @param {Actor} actor    Who made the Call.
 * @param {string} key
 * @param {"hope"|"despair"} kind
 * @param {object} choice  { target, project, room, item } from the picker.
 * @param {object} [opts]  { nonce }: the purchase's own name, the one its GM's yes was kept for.
 * @returns {Promise<{lines: string[], failed: boolean}>} what happened, and
 *   whether the Call delivered nothing - in which case the caller must hand the
 *   price back. A Call that has been paid for and did nothing is a theft: the
 *   Reroll costs 3 Hope, and "there was nothing to reroll" used to keep all
 *   three of them.
 */
export async function applyCall(actor, key, kind, choice = {}, { nonce = null } = {}) {
    const call = kind === "despair" ? DESPAIR_CALLS[key] : HOPE_CALLS[key];
    if (!call) return { lines: [], failed: true };

    const done = [];

    try {
        // The branches, in the order they have always run.
        if (call.grants) await grantEffect(actor, call, choice, done, { key, kind, nonce });
        if (call.grantsHope && choice.target) await hopeFromDespairEffect(actor, call, choice, done);
        if (call.feedsOverflow) await feedOverflowEffect(actor, call, choice, done);
        if (call.damage && choice.target) await damageEffect(actor, call, choice, done);
        if (call.progress && choice.project) await progressEffect(actor, call, choice, done, { key });
        if (call.freeMoves) await freeMovesEffect(actor, call, choice, done);
        if (call.freeActions) await freeActionsEffect(actor, call, choice, done);
        if (call.freeRest) await freeRestEffect(actor, call, choice, done);
        // No branch for `reroll`: since E08+E28 C4a the GM pays for it and makes it, asked by
        // calls.mjs `askReroll` instead of this (reroll.mjs `rerollOnGm`).
        if (call.announces && choice.text) await newRuleEffect(actor, call, choice, done);
        if (call.sealsRoom && choice.room) await sealRoomEffect(actor, call, choice, done);
        if (call.silences && choice.target) await silenceEffect(actor, call, choice, done);
        if (call.chains && choice.target) await chainEffect(actor, call, choice, done);
        if (call.setsMotive && choice.motive) await motiveEffect(actor, call, choice, done);
        if (call.gathersEveryone && choice.room) await gatherEffect(actor, call, choice, done);
        if (call.target === "item" && choice.item) await destroyItemEffect(actor, call, choice, done);
    } catch (err) {
        if (err instanceof NothingToDo) return { lines: done, failed: true };
        // A Call that has been paid for and did nothing must say so, and must
        // give the price back. Failing quietly is how "Contribution adds no
        // progress, no error" happened.
        error(`Could not fully apply ${key}`, err);
        // One message, from the caller: it refunds and says so (DESP-19). A
        // toast here as well contradicted it a second later ("paid for, but
        // could not be applied" then "did nothing, so it has been returned").
        done.push(game.i18n.format("DRPG.Calls.effectFailed", { call: call.label }));
        return { lines: done, failed: true };
    }

    // Nothing thrown, but nothing happened either: a Call whose every branch was
    // skipped because the picker came back empty is still a Call that took the
    // resource and delivered none of what it promised.
    return { lines: done, failed: done.length === 0 };
}
