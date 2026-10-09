/**
 * Danganronpa RPG - the GMs' audit of what a player writes on their own student.
 * ---------------------------------------------------------------------------
 * A player owns their student, and an owner may write anything on it: Daggerheart's
 * sheet, the token HUD, a console. resource-guard.mjs refuses the fields a player
 * should not edit, on the player's own browser - a courtesy a console steps past
 * with the option it stands aside for. This file is the protection behind it (E29
 * C3, 05.10.2026; audit S02-41, S08-57's ground; the plan's 2.1-2.4): every write a
 * player's browser makes on a student is judged on the primary GM against what the
 * GMs hold, and what a roll is built from is put back at once.
 *
 * WHAT THE GMS HOLD (`sheetMarks`, gm-stores.mjs). Per student, the last judged
 * values: its statistics (`system.traits`), experiences, each resource's value and
 * maximum, `system.rules` and `system.bonuses`, Daggerheart's level-up selections
 * (`system.levelData`, since E29 fix r1-G2), Daggerheart's scars (`system.scars`, which set Hope's
 * maximum; since E29 fix r2-H25), the module flags below, its effects and, per
 * item, the effects on its items (`itemEffects`, since E29 fix r1-G3).
 * A GM's write is never judged, and what it names is the new mark; so is
 * whatever a verdict leaves standing of what a player's write named. Either is taken
 * as the write's hook saw it, never read off the document when its judgement ends
 * (E29 fix r1-G1: `pathsSeen`, `markAfter`). A write that replaces or deletes a whole
 * part - `system.resources`, the module's flags, an item's `flags` - is judged on every
 * leaf under it, as the comparison at ready reads a sheet (G2: `reachOf`). Filled from
 * the documents when the primary's stores hydrate and a student has none, and since E29
 * fix r1-G6 as a character is made and as a reset's cut takes the marks (`refillMarks`).
 *
 * WHAT IS PUT BACK, with the world setting `lockPlayerResources` on (its default):
 * any change to a statistic, an experience, a maximum, `system.rules`,
 * `system.bonuses`, `system.levelData` or `system.scars`; any change to a GM-only flag (`GM_FLAGS`); an effect that
 * changes anything the GMs hold - a statistic, an experience, a resource's value or maximum,
 * a rule, a bonus, a level-up selection, the scars, a module flag (`HELD_PATH`, G3; until then only what
 * a roll is built from) - or is one of the module's own statuses, on the student or,
 * transferred, on one of its items (G3) - created (deleted), changed (written back) or deleted
 * (made again under its id). A statistic or a maximum goes back to its mark, not by a
 * delta: nothing a player does moves either since C2. The writer is told once per
 * write (`sheetPutBack`, the field named in their language) and the GMs are
 * whispered once, with each field before and after. With the setting off, the
 * fields its text names - the statistics and the maxima of actions, Hope, Health
 * and Sanity - are listed in `sheetWrites` and left standing (the owner's Q2 (a));
 * the rest is put back either way.
 *
 * AN ARMED CALL IS THE GMS' (C8, 05.10.2026; the plan's 2.4, 3.3). A player's Call is armed on
 * the primary GM (gm-bridge.mjs `call.arm`), on any character, so an entry a player's browser
 * adds to `pendingCall` is put back whatever the setting says - the player's own entries it took
 * away stand, as a roll spends them; a hindering or Despair Call, or one a GM armed, stands taken
 * only behind a roll of theirs (fix r2-H7, `gmsCall`) - and a drawn roll applies only the entries
 * the mark holds (`armedCallsHeld`, roll-draw.mjs `throwDrawn`), once this student's writes are judged.
 *
 * HOPE, AND WHAT A GAIN NEEDS (C4, 05.10.2026; the plan's 2.4, 2.5). The mark keeps
 * each resource as the GMs hold it - Hope, actions, Health and Sanity marks, the
 * Burst and Sprint grants - and a `credit`: what each fell by (or, for marks, rose
 * by), kept a Reroll's window. A fall stands and is credit. A gain stands as far as
 * the write's reason covers it: a refund (`refund`, `reroll`, `concealment`) takes
 * credit, oldest first, and never more - a GM's refund too, which stands whatever the credit
 * holds (E29 fix r1-G4), so the one a GM's client gives back on a packet's word - a refused
 * clean-up's price - is held to the credit before it is written (`creditRefund`, E09 fix
 * r2-G3); a Rest takes its stamp, its room, its action and its picks; an item
 * used takes the item and its consumption by the same user - its count fallen below, or the
 * item broken where whole in, the GMs' copy (G4); a Call's grant takes that Call's price. What nothing covers in Hope is put back as a
 * delta - the GMs' value moves by what was covered, so a forged Hope spent at once
 * still costs real Hope - and told as a statistic is; with `lockPlayerResources` off
 * it is listed and stands. Health, Sanity, actions and grants are judged the same way
 * and flagged (below). A `restsTaken` stamp no Rest covers is put back. The relay
 * asks the same of a gain Daggerheart writes for a player (`relayGainRefusal`,
 * relay-guard.mjs). A write the primary makes of a student's means for a player - a Call
 * bought on the GM, a drawn roll's resource step - is paid from the GMs' value, in that
 * student's queue (`gmMeansWrite`, E29 fix r1-G5).
 *
 * WHAT IS FLAGGED (C5, 05.10.2026; the plan's 2.4, 2.8, 2.9). A gain in Health, Sanity
 * or actions that nothing covers, and the free Move given back (G4), stands, and the GMs
 * get one card per write - who,
 * which student, each field before and after - with Undo and Keep, which only a GM's
 * browser wires (`onRenderFlagged`). The player is told nothing. With
 * `lockPlayerResources` off those three are listed instead, and no card is posted; the
 * Burst and Sprint grants and the free Move are flags the setting does not name, flagged either way (the
 * owner's Q2 (a)). A click is decided on the primary GM, as Grant all is since
 * E08+E28 fix r2-H7: another GM's asks it (`audit.decide`, gm-bridge.mjs), its decisions
 * run one after another, and the row is marked decided before anything is written, so
 * two GMs' clicks write once. Undo writes a field back only while it still holds what
 * the write left; a field that moved since is not written over, and the card says so.
 *
 * THE MODULE'S ITEMS (C6, 05.10.2026; audit S08-57; the plan's 2.6). The mark holds each
 * module item of a student (one with a `category`) whole, as a GM's write or the last
 * verdict left it, and since G2 each of its classes, whose hit points Daggerheart adds to
 * the Health maximum: those are put back as a maximum is. A `category`, `tier`,
 * `drpgItemId`, `roles` or `usableKind` (the last two since G2) changed is put back; so is a
 * `broken` cleared, a `wear` lowered or a count raised - each one's other way stands, as
 * a use or a break spends it. A move into or out of a stash (`location`, `stashRoom`)
 * stands when the student stands, as this GM sees it, in a room with a stash of theirs
 * (vault.mjs `myStashHere`'s rule), the stash holds fewer than `VAULT_LIMIT` besides it,
 * a retrieve takes from that room's stash and the carry cap has room for it; else it is
 * put back. A module item a player deletes stands when it is a `discard` of an item broken
 * on the GMs' copy; an item a player creates stands when it is a Search's find - its
 * `ref` the record of a Search of that student by that player, not yet used for a find,
 * and its tier at most what the record's total earns on the Search's table. Anything else
 * deleted or created is flagged: Undo makes a deleted item again under its id, from the
 * row's copy with the effects the GMs held on it, or deletes a created one. An item made
 * carrying an effect that counts (above) is put back - deleted - whatever else it is, a
 * Search's find too (G3). The setting `lockPlayerResources` does not govern items (the
 * owner's Q2 (a)).
 *
 * WHAT IS LISTED, AND WHAT STOOD (E29 fix r1-G4, 05.10.2026; the plan's 2.4, 2.8). Any other
 * field, flag or effect a player writes - no judgement above reads it - goes into `sheetWrites`
 * as `listed`, and so does an item the GMs hold no copy of taken off the sheet; a write that
 * stood on credit or a judge - a refund, a Rest, an item used, a Call's grant, a Search's find -
 * gets a `covered` row. Neither is told to anyone: they are the GMs' to read.
 *
 * WITH NO GM WATCHING (C7, 05.10.2026; the plan's 2.9). Nothing judges a write that lands
 * while no GM is connected, nor one the primary had not judged when it reloaded. So when
 * the primary's stores hydrate (`compareAtReady`) every student's document is compared
 * with its mark, each difference judged as a write naming it would be: a statistic, an
 * experience, a maximum, a rule, a bonus, a GM-only flag, a Call armed (since C8) or an effect that
 * counts - on the student or on one of its items (G3) - is put back at once, and so is a module
 * item's protected flag and a module item made carrying such an effect; every other difference
 * that a write would have had to account for - a gain in Hope, Health, Sanity, actions or
 * the grants, the free Move given back (G4), a Rest stamp, a module item deleted or created - goes on one card, "Sheet
 * changes made while no GM was watching", a row per field and per item with Undo and Keep
 * and Undo all / Accept all, decided once on the primary as the card of a flagged write
 * is. A fall stands, as it does when judged live. `lockPlayerResources` off lists the
 * fields its text names instead (the owner's Q2 (a)), as it does live, and what a write would
 * have been listed for - an effect that does not count, a field the mark keeps that no judgement
 * reads, a module item's other field - is listed (G4). The marks are the
 * GMs' browsers' (gm-stores.mjs: synced, not backed up), so the comparison is as good as
 * the copy the returning GM's browser holds: a GM on a browser that never held them takes
 * the sheets as it finds them, which is the limit of this design, not measured at a table.
 * What a GM writes on this browser before its stores hydrate is the GM's, not a difference
 * (`unmarked`). A GM that becomes the primary because the primary left compares the same way as
 * it hears it go (`primaryLeft`, G6): what that primary had not judged is judged then.
 *
 * ONE WRITE AFTER ANOTHER, PER STUDENT. Each write is queued behind the ones before
 * it on that student (`inOrder`), so a put-back is computed against the writes
 * that landed before it, and a GM's write is the baseline only once the player's
 * writes before it have been judged. The writes after it may have landed by then:
 * a put-back writes back only what the document still holds as its own write left
 * it, and Hope is corrected by what its own judgement changed (`hopeLeft`), so a
 * later write - a GM's included - is not written over but judged in its turn.
 */

import { MODULE_ID, FLAGS, STATES, ACTIONS_RESOURCE, TIMING, REST, HOPE_CALLS, USABLE_EFFECTS, USABLE_KINDS, CRITICAL, VAULT_LIMIT, BEDROOM_KEY_FLAG } from "./config.mjs";
import { SETTINGS, getSetting, getClock } from "./settings.mjs";
import { isPrimaryGm, primaryGmId, whisperToGms, esc, error, debug, forcedDeletion } from "./utils.mjs";
import { onGmStoresHydrated, gmStoresHydrated, gmStoresQuiet, stableJson } from "./gm-store.mjs";
import { sheetMarkStore, sheetWriteStore, rollStore } from "./gm-stores.mjs";
import { trustedWrite, trustedCreate, trustedDelete, HOPE_REFUND, GIVE_BACK } from "./resource-guard.mjs";
import { tellRefused, bridgeRequest } from "./bridge-guards.mjs";
import { cardFlag, cardWriter, updateSecret } from "./secret.mjs";
import { ITEM_FLAGS, CAP_OVERRIDE, isBroken, isStashed, canCarry } from "./inventory.mjs";
import { readDuality } from "./despair-award.mjs";
import { forgedFlagsOf, gmOnlyFlagsIn } from "./private-rolls.mjs";
import { spentByGm } from "./call-effects.mjs";
import { WARN_EVERY_MS, TRACE_PATHS } from "./relay-guard.mjs";

/** The module flags only a GM writes (the plan's 2.4), held in the mark and put back. */
const GM_FLAGS = ["deceased", "monocub", "silencedChapter", "advances", "sheetAtStart", "lootTrace", "swungWeapon",
    "betrayalWindow", "monokuma"].map(key => FLAGS[key]);

/**
 * What the GMs hold of a student's means (C4): each with the direction its price moves
 * it - Hope, actions and the grants fall when spent, Health and Sanity marks rise. The
 * mark's value of each is the GMs' (`ledgerOf`), not the document's.
 */
const LEDGER = Object.freeze({
    hope: { path: "system.resources.hope.value", cost: -1, kind: "hope" },
    actions: { path: `system.resources.${ACTIONS_RESOURCE}.value`, cost: -1, kind: "actions" },
    hitPoints: { path: "system.resources.hitPoints.value", cost: 1, kind: "hitPoints" },
    stress: { path: "system.resources.stress.value", cost: 1, kind: "stress" },
    freeActionGrants: { path: `flags.${MODULE_ID}.${FLAGS.freeActionGrants}`, cost: -1, kind: "grant" },
    freeMoveGrants: { path: `flags.${MODULE_ID}.${FLAGS.freeMoveGrants}`, cost: -1, kind: "grant" }
});
const LEDGER_FLAGS = [FLAGS.freeActionGrants, FLAGS.freeMoveGrants];
const RESTS_PATH = `flags.${MODULE_ID}.${FLAGS.restsTaken}`;
const CALLS_PATH = `flags.${MODULE_ID}.${FLAGS.pendingCall}`;

/*
 * Every module flag the mark holds: the GM-only ones, `pendingCall`, whose additions are put back (C8), the Rest
 * stamps, the grants and, since E29 fix r1-G4, the free Move (`freeMoveUsed`): used, it stands; given back by a
 * player's write it is flagged, as a grant's rise is: no road of the module's gives it back on a player's browser
 * (`resetAllActions` runs on a GM at a new time of day, and `restoreFreeMove` is a GM's correction, actions.mjs).
 * Until this fix it was no part of the mark, and the review's probe on 69deef0 measured a console's
 * `restoreFreeMove` and a player's own `resetActionsFor` each giving it back with no row (review round 1 cor m9 =
 * sec m3); at fd7c61f (05.10.2026, e29run/r1g4red) tier 2's and scenario 30's free Move given back stood so too.
 */
const MARKED_FLAGS = [...GM_FLAGS, FLAGS.pendingCall, FLAGS.restsTaken, ...LEDGER_FLAGS, FLAGS.freeMoveUsed];

/** The reasons whose gain is a refund (the plan's 2.5): it takes credit and never more. A concealment's Sanity comes back as a refund too. */
const REFUNDS = new Set(["refund", "reroll", "concealment"]);
/** The reasons that only ever spend Hope (the payment that crosses a put-back, `movesOf`). */
const PAYMENTS = new Set(["price", "call", "meddle"]);
/** How long credit is kept: a Reroll's window, the longest a module refund comes after its price. */
const CREDIT_KEPT_MS = TIMING.rerollWindowMinutes * 60_000;
/** How long an item used waits for its consumption by the same user (the plan's 2.5, chosen). */
export const JUDGE_WAIT_MS = 2000;
/** How recent a Daggerheart roll must be to cover the Hope the relay writes for it (the plan's 2.5, chosen). */
const ROLL_COVER_MS = 60_000;

/** The fields `lockPlayerResources`'s text names that this file judges: statistics, and these maxima. */
const LOCK_NAMED_MAX = new Set([ACTIONS_RESOURCE, "hope", "hitPoints", "stress"].map(r => `system.resources.${r}.max`));

/*
 * What an effect may not change without the GMs' say: what they hold of a student (E29 fix r1-G3,
 * 05.10.2026; review round 1 cor M3) - its statistics, experiences, resources (each value as well as
 * each maximum), rules, bonuses and level-up selections (G2's root), any maximum, and the module's
 * flags. Until this fix it was what a roll is built from alone (`ROLL_PATH`), and measured by the
 * review's probe on 69deef0, a player's effects adding 5 Hope, overriding Health to 0 and setting the
 * Monokuma flag stood with no row: Daggerheart 2.10.5 applies an effect to the prepared data through
 * Foundry's own application (activeEffect.mjs `applyChangeField`, read), and the module reads prepared
 * values and flags (`resourceValue`, `getFlag`) while this file reads only the source. The harness
 * applies no effect to prepared data, so that half is read, not run. The comparison at ready asks the same.
 */
const HELD_PATH = new RegExp(`^system\\.(?:traits|experiences|rules|bonuses|resources|levelData|scars)(?:\\.|$)|\\.max$|^flags\\.${MODULE_ID}\\.`);

/** The statuses the module itself sets (chapter.mjs `dead`, states.mjs Breakdown and Wounded). */
const MODULE_STATUSES = new Set(["dead", ...Object.values(STATES).map(state => state.id)]);

/** A write by a GM carrying this is not taken as the mark: tier 2 writes as the GM and hands it to `judgeWrite`. */
export const AUDIT_ASIDE = "drpgAuditAside";

/** The flag of the GMs' card of a flagged write (C5): the id of the row it asks about. */
const FLAGGED_CARD = "sheetFlagged";

/** The item hooks (C6): a module item's flags and count, a deletion, a creation. */
const ITEM_WRITES = new Set(["updateItem", "createItem", "deleteItem"]);

/*
 * A module item's flags only a GM changes, whichever way (the plan's 2.6). Since E29 fix r1-G2 also
 * what it serves as besides its category (`roles`: inventory.mjs `servesAs`, which murder.mjs reads
 * for a swung weapon and use-items.mjs `equippedFor` for a role's tool) and what a usable restores
 * (`usableKind`). `grantItem` sets them on the item it makes, which is judged as an item created,
 * and only migrate.mjs writes `roles` on one that exists, on the primary GM (review round 1 sec M3
 * = cor M5, which measured a console's `roles` making a carried item serve as a crime tool, no row).
 *
 * AND THE ROOM A BEDROOM KEY OPENS (E29 fix r2-H19, 06.10.2026; found by fix r2-H17). A flag outside `ITEM_FLAGS`
 * (config.mjs `BEDROOM_KEY_FLAG`) that only a GM writes: vault.mjs `grantBedroomKey` on the key it makes, and the copy
 * roads carry it over (inventory.mjs `preservedFlags`). It was no part of this list, so a player's write of one was
 * listed and stood, and a hand-over of the item it stood on made the receiver a real key to that room (handover.mjs
 * `shareKey`, through `grantBedroomKey`), as a plant's copy carried it: at 68150ec (e29run/r2h19red) a key written by
 * a player on a Tool and on an item not the module's was listed and left on each, a hand-over of a Tool or of an item
 * not the module's that carried one made the receiver a key, and a plant's copy carried it; in scenario 30 p2's key
 * and at once a hand-over made Aiko a key to Dorm B on every client, its row listed with no message to the GMs. It is
 * the only such flag - a sweep of every module flag a road writes on an item (06.10.2026) found besides these the
 * Truth Bullet's, which truth-bullets.mjs guards on its own, and `equipped`, which is the player's (use-items.mjs
 * `toggleEquipped`).
 */
const ITEM_FIXED = [ITEM_FLAGS.category, ITEM_FLAGS.tier, ITEM_FLAGS.identity, ITEM_FLAGS.roles, ITEM_FLAGS.kind, BEDROOM_KEY_FLAG];

/** Where a module item is kept: carried, or which stash. */
const ITEM_PLACE = [ITEM_FLAGS.location, ITEM_FLAGS.stashRoom];

/*
 * A student's class (G2; review round 1 sec B4): Daggerheart 2.10.5 adds the first class item's
 * `system.hitPoints` to the Health maximum (data/actor/character.mjs, `prepareBaseData`, read
 * 05.10.2026), so the mark holds a student's class items whole beside its module items, and a
 * player's change of their hit points is put back as a maximum is. Which class item counts
 * (`isMulticlass`) is not judged: a second one comes only as an item created, which the GMs are
 * asked about (C6).
 */
const CLASS_HIT_POINTS = "system.hitPoints";

/** Every path of an item's write this file judges (the plan's 2.6): its count and the flags above, and a class's hit points. */
const ITEM_JUDGED = ["system.quantity", ...[...ITEM_FIXED, ITEM_FLAGS.broken, ITEM_FLAGS.wear, ...ITEM_PLACE].map(flag => `flags.${MODULE_ID}.${flag}`)];

/*
 * The judged paths an item the GMs hold no copy of is read without (`itemFindings`' `before`, `itemsAsHeld`,
 * `itemCovers`): its category, which would make it the module's, and since E29 fix r2-H19 a bedroom key's room, which
 * makes any item a key where a key is read (handover.mjs `giveItem`, vault.mjs `keysHeldBy`). A player's write of
 * either on such an item is put back, and neither is read off it as the GMs hold it.
 */
const ITEM_UNHELD = [ITEM_FLAGS.category, BEDROOM_KEY_FLAG].map(flag => `flags.${MODULE_ID}.${flag}`);

/** The flag of the GMs' card of the changes made with no GM watching (C7): the ids of the rows it asks about. */
const AWAY_CARD = "sheetAway";

/*
 * The parts of a student's document the mark holds and the comparison at ready reads, besides
 * `MARKED_FLAGS`. `system.levelData` since G2 (review round 1 sec B4): Daggerheart's level-up
 * selections, which with its `levelupAuto` on - its default, which the module never sets - add to
 * a statistic, an experience, the Health and Sanity maxima and a roll's dice (character.mjs
 * `prepareBaseData`, read 05.10.2026). No player road writes them: the module's Level Up is
 * `applyAdvancement`, on a GM (R79), and the module writes no `levelData` at all.
 * `system.scars` since E29 fix r2-H25: Daggerheart's scars, a number, which set Hope's maximum - the world's setting
 * less them (character.mjs `prepareDerivedData`, 2.10.5 :752). No road writes them: not the module's, and Daggerheart's
 * one, the Death Move's Avoid Death, is no road in this game (states.mjs switches off the automation that offers it,
 * danganronpa.css hides the sheet's button); so they are judged as the fields only a GM writes are, put back with
 * `lockPlayerResources` on or off (`kindOf`). Until this fix a player's write of them was listed and stood, and with it
 * a Hope maximum the GMs' readers took as theirs (`maxHeld`). A mark or a sheet with none reads 0, Daggerheart's
 * initial (character.mjs :79): a mark taken before this fix holds none.
 */
const MARK_ROOTS = ["system.traits", "system.experiences", "system.resources", "system.rules", "system.bonuses", "system.levelData", "system.scars"];

/** Every root of a student's document the mark keeps: the seven above and each marked flag. */
const MARKED_PATHS = [...MARK_ROOTS, ...MARKED_FLAGS.map(key => `flags.${MODULE_ID}.${key}`)];

/** The means' paths (`LEDGER`): a judgement moves them through its ledger alone, never as a path put back to its mark. */
const LEDGER_PATHS = new Set(Object.values(LEDGER).map(({ path }) => path));

/** How long a row of `sheetWrites` is kept (the plan's 2.3, chosen): a day, swept as the next is written. */
const ROW_KEPT_MS = 24 * 60 * 60_000;

/* By the constructor's name, not by identity: a write's changes may be built in another realm (the
   harness expands them outside the browser's window), and an operator - v14's forced deletion or
   replacement - is an instance of its own class, a leaf. */
const isPlain = value => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === null || proto.constructor?.name === "Object";
};
const clone = value => value === undefined ? undefined : foundry.utils.deepClone(value);

/** An effect's or an item's data as the mark keeps it: its source, without Foundry's write stamp, which moves on every write. */
function docData(doc) {
    const { _stats, ...data } = doc?.toObject?.() ?? doc ?? {};
    return data;
}

/**
 * Whether an effect's data changes what the GMs hold (`HELD_PATH`), or is one of the module's own statuses. One on
 * an item (`onItem`, G3) counts only where Daggerheart applies it to the student: transferred, which a new effect
 * is unless it says otherwise (Daggerheart 2.10.5 `baseEffect.mjs`, actor.mjs `allApplicableEffects`, read).
 */
export function touchesHeld(data, { onItem = false } = {}) {
    if (!data || (onItem && data.transfer === false)) return false;
    if ([...(data.statuses ?? [])].some(id => MODULE_STATUSES.has(id))) return true;
    // Daggerheart 2.10.5 keeps an effect's changes in `system.changes` (read in its source, 05.10.2026); older ones at the top.
    const changes = [...(data.system?.changes ?? []), ...(data.changes ?? [])];
    return changes.some(change => HELD_PATH.test(String(change?.key ?? "")));
}

/** An effect as a row and the GMs' whisper show it. */
const effectSummary = data => data ? { name: data.name ?? null, statuses: [...(data.statuses ?? [])],
    changes: [...(data.system?.changes ?? []), ...(data.changes ?? [])].map(c => `${c?.key}=${c?.value}`) } : null;

/** A student's mark, from the document as it stands. */
function markFrom(actor) {
    const src = actor._source ?? actor.toObject();
    const system = src.system ?? {};
    const flags = src.flags?.[MODULE_ID] ?? {};
    return {
        traits: clone(system.traits ?? {}), experiences: clone(system.experiences ?? {}), resources: clone(system.resources ?? {}),
        rules: clone(system.rules ?? {}), bonuses: clone(system.bonuses ?? {}), levelData: clone(system.levelData ?? {}), scars: system.scars ?? 0,
        flags: Object.fromEntries(MARKED_FLAGS.filter(key => flags[key] !== undefined).map(key => [key, clone(flags[key])])),
        effects: Object.fromEntries((actor.effects?.contents ?? []).map(effect => [effect.id, docData(effect)])),
        items: Object.fromEntries((actor.items?.contents ?? []).map(item => [item.id, docData(item)]).filter(([, data]) => heldItem(data))
            .map(([id, data]) => [id, itemCopy(data)])),
        itemEffects: Object.fromEntries((actor.items?.contents ?? []).map(item => [item.id, effectsIn(docData(item))])
            .filter(([, effects]) => Object.keys(effects).length))
    };
}

/*
 * THE EFFECTS ON A STUDENT'S ITEMS (E29 fix r1-G3, 05.10.2026; review round 1 sec B3 = cor M4). Daggerheart
 * 2.10.5 applies an item's transferred effects to the actor that carries it (actor.mjs `allApplicableEffects`),
 * so the mark holds them per item, every item's - the module's, a class, any other - in `itemEffects`
 * (`{ <item id>: { <effect id>: data } }`, an item with none left out), and an item's copy in `items` holds the
 * item without them: an effect is held in one place. An effect created, changed or deleted on an item is
 * judged as one on the student (`effectFindings`); an item comes and goes with its effects (`itemEffectsAfter`),
 * while an item's update moves none of them - they are written by their own hooks, each judged in turn. Until
 * this fix the judge answered null for an effect whose parent is an item, and the mark held none: measured by
 * the review's probe on 69deef0 for a +5 to every roll on a tool given to Aiko, and at b5769e7 (05.10.2026,
 * e29run/r1g3red, on the harness's new model of such an effect) by tier 2 and scenario 30 - a player's +5 on a
 * carried Tool stood on every client with no row, a GM's penalty on it deleted stayed deleted, an item made
 * carrying an Agility rise was only flagged, and a deleted Tool's Undo brought it back without its penalty.
 */
const itemCopy = data => {
    if (!data) return data;
    const { effects, ...item } = data;
    return item;
};

/** The effects of an item's data, by id, each as the mark keeps an effect. */
const effectsIn = data => Object.fromEntries((data?.effects ?? []).map(effect => [effect._id, docData(clone(effect))]));

/** A student's items, by id, each as an item's own write is seen and the mark is taken (`docData`, its effects on it): fix r2-H10. */
const itemsIn = actor => Object.fromEntries((actor.items?.contents ?? []).map(item => [item.id, docData(item)]));

/** The item an effect is on, or null for one on the student itself. */
const itemOf = effect => effect?.parent?.documentName === "Item" ? effect.parent : null;

/** Where the mark holds an effect, and a row names it: `effects.<id>`, or `itemEffects.<item id>.<id>` (G3). */
const effectPath = (itemId, id) => itemId ? `itemEffects.${itemId}.${id}` : `effects.${id}`;

/** The mark's copy of an effect - the student's own, or one on its item `itemId` (G3) - or null. */
const effectHeld = (mark, itemId, id) => (itemId ? mark?.itemEffects?.[itemId] : mark?.effects)?.[id] ?? null;

/** Sets one effect in a mark - the student's own, or one on its item `itemId` (G3) - or takes it out where `data` is null. */
function setEffect(mark, itemId, id, data) {
    mark.itemEffects ??= {};
    const slot = itemId ? (mark.itemEffects[itemId] ??= {}) : (mark.effects ??= {});
    if (data) slot[id] = clone(data);
    else delete slot[id];
    if (itemId && !Object.keys(slot).length) delete mark.itemEffects[itemId];
}

/*
 * THE MARK TAKES WHAT A WRITE REACHED (E29 fix r2-H15, 06.10.2026; found by fix r2-H14). An item's or an effect's
 * update moves the mark's copy of that document by the paths it reached (`reachOf`; an entry's, written through its
 * student or its item), each as its hook saw it, and by nothing else of the hook's copy: that copy holds every write
 * before it, and one of those may still wait for its put-back. A document the mark holds no copy of is taken whole,
 * as one made is. Until this fix an item's or an effect's write took the hook's copy whole, though G1 had made a
 * student's own paths move only so and refreshMark's comment said it of every write: measured on the harness by
 * scenario 30 at d1445c0 (06.10.2026, e29run/r2h15red), p2's console wrote a Tool's `roles` and at once renamed it,
 * the rename's hook holding the roles; the roles were put back on every client and stood in the mark, and the same
 * roles written again then stood with no row. So did a count raised behind a rename, the roles through Botan's
 * update, a penalty's +5 behind a write of its old name, and the roles behind a GM's rename in the window.
 */
function reached(held, data, changes) {
    return held && data ? withPaths(held, data, reachOf(changes)) : clone(data) ?? null;
}

/** A write's `key` (`items`, `effects`) written as a list of entries named by their `_id`: id -> what the entry writes. Null for the list written whole. */
function entriesNamed(changes, key) {
    const list = changes?.[key];
    if (!Array.isArray(list)) return null;
    return new Map(list.filter(entry => entry?._id).map(({ _id, ...entry }) => [_id, foundry.utils.expandObject(entry)]));
}

/** The effects the mark holds on one host (`held`, by id) with each `named` one (id -> what its entry wrote) taken in by what its entry reached. */
function effectsReached(held = {}, now = {}, named) {
    const out = { ...held };
    for (const [id, entry] of named) if (now[id]) out[id] = reached(held[id] ?? null, now[id], entry);
    return out;
}

/**
 * The mark's items' effects with one item's taken in as its data holds them, or gone with it (G3) - or, where its write named them
 * by their id (`named`), only those, each by what its entry reached (fix r2-H15).
 */
function itemEffectsAfter(mark, itemId, data, named = null) {
    const out = { ...(mark?.itemEffects ?? {}) };
    const effects = named ? effectsReached(mark?.itemEffects?.[itemId], effectsIn(data), named) : effectsIn(data);
    if (Object.keys(effects).length) out[itemId] = effects;
    else delete out[itemId];
    return out;
}

/**
 * What an item's write that stands moves the mark by: made or deleted, the item as its hook saw it (C6) and its effects with it
 * (G3); updated, the paths it reached (`reached`, fix r2-H15) and, where its `changes` wrote them (fix r2-H8, `parentEffects`),
 * its effects - each it named by what its entry reached, every one as the hook saw it where it wrote the list whole.
 */
const itemMoves = (kind, mark, item, data, changes = {}) => kind !== "updateItem"
    ? { items: itemsAfter(mark, item, data), itemEffects: itemEffectsAfter(mark, item.id, data) }
    : { items: itemsAfter(mark, item, reached(mark?.items?.[item.id] ?? null, data, changes)),
        ...(names(changes, "effects") ? { itemEffects: itemEffectsAfter(mark, item.id, data, entriesNamed(changes, "effects")) } : {}) };

/** An item the mark holds, whole: its copy with the effects held on it (G3), as a deleted one is made again. */
const wholeItem = (mark, id) => ({ ...clone(mark.items[id]), effects: Object.values(mark.itemEffects?.[id] ?? {}).map(clone) });

/** Whether an item's data is the module's: one with a category (vault.mjs `vaultContents` reads the same). */
function isModuleItem(data) {
    return Boolean(data?.flags?.[MODULE_ID]?.[ITEM_FLAGS.category]);
}

/** Whether an item's data is a Daggerheart class (`CLASS_HIT_POINTS`). */
const isClassItem = data => data?.type === "class";

/** Whether the mark holds an item whole: a module item, or a class (G2). */
const heldItem = data => isModuleItem(data) || isClassItem(data);

/** An item's data read as the module's readers read an item (`getFlag`, `id`, `system`), with no document behind it. */
function itemLike(src) {
    return { id: src._id, name: src.name, system: src.system,
        getFlag: (scope, key) => foundry.utils.getProperty(src.flags ?? {}, `${scope}.${key}`) };
}

/** A student's module items and classes in the mark with one item's write taken in: its data as it now stands, or gone. */
function itemsAfter(mark, item, data) {
    const items = { ...(mark?.items ?? {}) };
    if (data && heldItem(data)) items[item.id] = itemCopy(data);
    else delete items[item.id];
    return items;
}

/** The GMs' value of each of a student's means: the mark's (nothing held is 0), or the document's where there is no mark. */
function ledgerOf(mark, actor) {
    const doc = mark ? markAsDocument(mark) : actor?._source ?? {};
    return Object.fromEntries(Object.entries(LEDGER).map(([key, { path }]) => [key, Number(foundry.utils.getProperty(doc, path)) || 0]));
}

/** A mark with the GMs' means written into its resources and flags, and its credit. */
function withLedger(mark, values, credit) {
    const doc = markAsDocument(mark);
    for (const [key, { path }] of Object.entries(LEDGER)) {
        // A resource this student does not have stays absent, and so does a grant never written.
        if (foundry.utils.getProperty(doc, path) === undefined && (path.startsWith("system.") || !values[key])) continue;
        foundry.utils.setProperty(doc, path, values[key]);
    }
    mark.credit = credit;
    return mark;
}

/** A student's credit, each entry older than a Reroll's window dropped. */
function creditOf(mark, at = Date.now()) {
    return Object.fromEntries(Object.entries(mark?.credit ?? {}).map(([key, entries]) =>
        [key, (entries ?? []).filter(entry => entry?.at >= at - CREDIT_KEPT_MS && entry.n > 0).map(entry => ({ ...entry }))]));
}

const creditHeld = (credit, key) => (credit[key] ?? []).reduce((sum, entry) => sum + entry.n, 0);

/** Takes up to `n` of a student's credit, oldest first; answers what it took. */
function takeCredit(credit, key, n) {
    let taken = 0;
    for (const entry of credit[key] ?? []) {
        const part = Math.min(entry.n, n - taken);
        entry.n -= part;
        taken += part;
        if (taken >= n) break;
    }
    credit[key] = (credit[key] ?? []).filter(entry => entry.n > 0);
    return taken;
}

/** Takes exactly `n` of a student's credit, or nothing. */
const takeAll = (credit, key, n) => creditHeld(credit, key) >= n && takeCredit(credit, key, n) === n;

/** The mark as the document it was taken from, so a write's paths read straight off it. */
function markAsDocument(mark) {
    return {
        system: { traits: mark.traits ?? {}, experiences: mark.experiences ?? {}, resources: mark.resources ?? {},
            rules: mark.rules ?? {}, bonuses: mark.bonuses ?? {}, levelData: mark.levelData ?? {}, scars: mark.scars ?? 0 },
        flags: { [MODULE_ID]: mark.flags ?? {} }
    };
}

/** Every leaf a write names, as a dotted path: a plain object is walked, anything else (an operator, a list) is a leaf. */
function pathsOf(changes, at = "") {
    return Object.entries(changes ?? {}).flatMap(([key, value]) => {
        if (key === "_id" || key === "_stats") return [];
        const path = at ? `${at}.${key}` : key;
        return isPlain(value) && Object.keys(value).length ? pathsOf(value, path) : [path];
    });
}

/** Which of this file's judgements a path of a student's update falls under, or null. */
function kindOf(path) {
    if (/^system\.traits(?:\.|$)/.test(path)) return "traits";
    if (/^system\.experiences(?:\.|$)/.test(path)) return "experience";
    if (/^system\.levelData(?:\.|$)/.test(path)) return "levelData";
    if (path === "system.scars") return "scars";
    if (/^system\..+\.max$/.test(path)) return "max";
    if (/^system\.rules(?:\.|$)/.test(path)) return "rules";
    if (/^system\.bonuses(?:\.|$)/.test(path)) return "bonuses";
    const prefix = `flags.${MODULE_ID}.`;
    if (!path.startsWith(prefix)) return null;
    const flag = path.slice(prefix.length).split(".")[0];
    if (flag === FLAGS.pendingCall) return "pendingCall";
    // The free Move (G4) is named with the grants it is judged as: "Free actions and moves".
    if (flag === FLAGS.freeMoveUsed) return "grant";
    return GM_FLAGS.includes(flag) ? "flag" : null;
}

/*
 * The write that puts `paths` back to `before`. A path that was not there is deleted at its
 * highest missing part - a new experience goes whole, not as an empty entry - with v14's
 * forced deletion (`-=key` removes nothing in this Foundry: utils.mjs `forcedDeletion`), or
 * written null where there is none. A path that was an object is written whole over what
 * the player made of it.
 */
function putBackPatch(before, paths) {
    const patch = {};
    for (const path of paths) {
        const parts = path.split(".");
        let depth = parts.length;
        while (depth > 1 && foundry.utils.getProperty(before, parts.slice(0, depth - 1).join(".")) === undefined) depth--;
        const at = parts.slice(0, depth).join(".");
        if (Object.keys(patch).some(done => at === done || at.startsWith(`${done}.`))) continue;
        const value = foundry.utils.getProperty(before, at);
        patch[at] = value === undefined ? forcedDeletion() : wholeValue(value);
    }
    return patch;
}

/** An object written in place whole (v14's forced replacement); anything else as it is. */
function wholeValue(value) {
    const Operator = foundry.data?.operators?.ForcedReplacement;
    if (!Operator || !value || typeof value !== "object" || Array.isArray(value)) return clone(value);
    return Operator.create ? Operator.create(clone(value)) : new Operator(clone(value));
}

/* An experience's value, an experience added or taken away, or the list written whole: what a roll adds.
   Its name and description are words a player keeps on their sheet (the plan's 2.4: "experiences' values
   and new experiences"). */
function experienceCounts(path, before) {
    const [, , id, field] = path.split(".");
    return !id || !field || field === "value" || foundry.utils.getProperty(before, `system.experiences.${id}`) === undefined;
}

/** The entries of a flag's new value that its old one did not have (a list's items, or the value itself). */
function addedEntries(before, after) {
    const list = value => value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];
    const had = new Set(list(before).map(stableJson));
    return list(after).filter(entry => !had.has(stableJson(entry)));
}

/*
 * A CALL THE PLAYER MAY NOT DROP (E29 fix r2-H7, 06.10.2026; review round 2 sec M3 = cor M4; the
 * owner's Q3 (a), and the orchestrator's decision (b) of 06.10.2026). Plan 2.4 let every entry a
 * player's write took off the armed list stand, as a roll on their browser spends its Calls so - and a
 * console took the GM's Obstacle off its own student, and the next drawn roll threw no hostile die:
 * measured by the review's probe 99 P2 at 070b72b, and on 82830f9 by this fix's probe
 * (e29run/scratch/r2h7-probe): document, mark and held list all lost it, with no row. Q3 (a) makes
 * a hostile Call armed past its grace count whether the roll names it or not; plan 2.4 was written
 * before it. So an entry the mark holds that is not the player's to drop - a hindering Call (a
 * disadvantage, a bonus below nothing: roll-draw.mjs `hinders` reads the same), a Despair Call, or
 * one a GM armed (call-effects.mjs `appendArmedCall` stamps `by`) - stands taken only behind a roll
 * that covers it (`callsCover`): a duality roll of that player about that student, not drawn by a
 * GM, heard after the entry was armed, each roll covering one write's removal once; else it is put
 * back with a row. A spend the GMs made themselves is theirs (call-effects.mjs `spentByGm`). Not a
 * roll drawn by the GM: that one is spent by the GM (roll-draw.mjs `throwDrawn`), and a roll not drawn
 * - no GM, a Daggerheart build the seam was not written for, Daggerheart's own item rolls - spends the
 * window's Calls with a roll in the chat, which is the plan's 3.8. What this cannot tell: a console
 * that posts a roll of its own first and then takes the entry off. That roll is in the chat for the
 * GMs to see, and the covered row keeps its message's id (`ref`, in the GMs' store - `sheetWrites`
 * does not show it): it is layer two's to check.
 */
function gmsCall(entry) {
    if (!entry || typeof entry !== "object") return false;
    if (entry.kind === "despair" || entry.grants === "disadvantage" || (entry.grants === "bonus" && Number(entry.amount) < 0)) return true;
    return typeof entry.by === "string" && game.users?.get(entry.by)?.isGM === true;
}

/**
 * An armed list without the entries a write added (`calls.added`, each as `stableJson`) and with
 * the GMs' entries it took that nothing covered (`calls.taken`), save one a GM's spend has named
 * since (`spentByGm`); undefined where nothing is left.
 */
function keptCalls(list, calls) {
    const kept = (Array.isArray(list) ? list : list ? [list] : []).filter(entry => !calls.added.has(stableJson(entry)));
    const held = new Set(kept.map(stableJson));
    const owed = (calls.taken ?? []).filter(entry => !held.has(stableJson(entry)) && !spentByGm(entry?.nonce));
    return kept.length || owed.length ? clone([...kept, ...owed]) : undefined;
}

/*
 * The armed list put back (C8): what the document holds now, without the entries the write added
 * (`calls.added`, read as its hook saw it: `actorFindings`). The player's own entries the write took
 * away stay away - a roll on their browser spends its Calls with such a write - so the mark's list
 * is not written back whole; and the list is read when the put-back is written, so a Call a GM armed
 * after the write landed stays armed (G1). The GMs' entries it took that no roll covered come back
 * beside whatever the list holds then (`calls.taken`, fix r2-H7), save one the GMs' own spend has
 * named since (`spentByGm`). Not only while the list is as the write left it, as every other path
 * put back is: the audit's own put-back of a write before it moves the list too, and with that guard
 * a console's writes in a row - an entry added, then the GM's Obstacle taken off - kept the Obstacle
 * off (tier 2's "... right behind a write the audit is putting back ...", red with the guard put in:
 * e29run/r2h7m m11, 06.10.2026). A GM's arming and a GM's spend wait for this judgement
 * (call-effects.mjs `appendArmedCall`, `spendCallsByNonce`; the same tier's "a Call the GM arms
 * while ..." and "a Call the GMs spend while ...", each red without its wait: m10, m13).
 * Nothing left takes the flag off.
 */
function armedPutBack(actor, calls) {
    return keptCalls(foundry.utils.getProperty(actor._source ?? {}, CALLS_PATH), calls) ?? forcedDeletion();
}

/** Whether `lockPlayerResources` is on (its default, and what an unreadable setting counts as). */
function locked() {
    try { return getSetting(SETTINGS.lockPlayerResources) !== false; } catch { return true; }
}

/* ---------------------------------------------------------------------------
 * The queue, the mark
 * ------------------------------------------------------------------------- */

/** actorId -> the last job queued on that student. */
const chains = new Map();

function inOrder(actorId, job) {
    const run = (chains.get(actorId) ?? Promise.resolve()).then(job).catch(err => {
        error("The GMs' audit of a sheet could not judge a write", err);
        return null;
    });
    chains.set(actorId, run);
    void run.then(() => { if (chains.get(actorId) === run) chains.delete(actorId); });
    return run;
}

/** Resolves once every write queued on any student has been judged, and every trace queued kept (tier 2, and anything that reads the stores after a write). */
export async function sheetAuditIdle() {
    while (chains.size || tracesQueued) await Promise.all([...chains.values(), traces]);
}

/** Resolves once every write queued on these students has been judged (C8: a Call's purchase and a drawn roll). Anything else in `ids` is passed over. */
export async function judgedFor(...ids) {
    const named = ids.filter(id => typeof id === "string" && id);
    for (let queued = named.filter(id => chains.has(id)); queued.length; queued = named.filter(id => chains.has(id))) {
        await Promise.all(queued.map(id => chains.get(id)));
    }
}

/**
 * The nonces of the Calls the GMs hold armed on this student (C8): its mark's `pendingCall`, once
 * every write queued on it has been judged - so an entry a player's browser added is not among
 * them, whether its put-back has landed or failed (`markAfter`). Null where there is no mark to
 * ask (this browser's stores not hydrated, a character never marked) or the mark is a Monokuma's:
 * the document is then the record, as it was before C8.
 */
export async function armedCallsHeld(actor) {
    await judgedFor(actor?.id);
    const mark = gmStoresHydrated() ? sheetMarkStore.get(actor?.id ?? "") : null;
    // A Monokuma is no student (`judgeNow`): what it holds stands, so its document is the record.
    if (!mark || mark.flags?.[FLAGS.monokuma]) return null;
    const stored = mark.flags?.[FLAGS.pendingCall] ?? null;
    return new Set((Array.isArray(stored) ? stored : stored ? [stored] : []).map(entry => entry?.nonce).filter(nonce => typeof nonce === "string"));
}

/*
 * A STUDENT'S ITEMS AS THE GMS HOLD THEM (E29 fix r2-H17, 06.10.2026; found by fix r2-H16). A GM's road that makes
 * a copy of a student's item on another sheet - handover.mjs `giveItem` and `lootBody`, vault.mjs `stealFromVault`,
 * `stealFromPerson` and `plantOnPerson` - reads the item here: once every write queued on the student has been
 * judged (`judgedFor`), the fields this file judges (`ITEM_JUDGED`, a class's hit points) as the mark holds them,
 * whether their put-back landed or failed, as `armedCallsHeld` reads a Call; every other field as the document
 * holds it, and every field where the GMs keep no mark of their own here - on a GM who is not the primary (its copy
 * may lag, `meansHeld`), the stores not hydrated, a Monokuma's, no student's. An item the mark holds no copy of is
 * read without a category or a key (`ITEM_UNHELD`), as its judgement reads one (`itemFindings`' `before`): the GMs
 * hold no module item there.
 * Each item is plain data read as an item is read (`itemLike`, with its `img`), taken in one step as the wait ends;
 * a write heard after it is judged on its own and moves nothing read here. A wait alone is enough for these roads,
 * unlike a GM's write of a student's means (`gmMeansWrite`): none writes a field of the item a put-back writes - each
 * makes a new item elsewhere and deletes this one, whose put-back then finds nothing to write (fix r2-H16) - and, by
 * reading, no judgement waits for anything they do (an item used waits for its consumption, a Call taken for a roll's
 * card, a Search's find for its roll's record), so the wait holds up nothing that holds it up. Until this fix the
 * roads read the document as it stood: at ebdf1ba (e29run/r2h17red, 06.10.2026) a Tool given roles and tier 3 where
 * the mark did not see them (the mark: no roles, tier 1) was copied with both by a hand-over, a loot, a plant and
 * both thefts, and in scenario 30 a hand-over and a plant p2 asked for at once after writing a Tool's roles, or its
 * tier and a mend, left that write on Aiko's copy on every client and in her mark.
 * READ HERE SINCE, each road saying why its wait holds up nothing: through `itemAsHeld` the Rot's wear (overflow.mjs
 * `rotEverything`, fix r2-H19), a GM's ruling on an item used (use-items.mjs `grantItemEffect`, H19) and an
 * Objection's evidence (trial.mjs `seizeFloor`, H20); the object a tie of a trace to the crime names
 * (bridge-guards.mjs `guardTieTraceHolder`, H21); and through this list itself a Reroll's plant (reroll.mjs
 * `settleSearch`, H22) and the Truth Bullets a death and a sweep take (chapter.mjs `bulletsHeldBy`, H22); and through
 * `itemAsHeld` the count a Reroll gives a used item's charge back to (murder-rules.mjs `undoLastCrisis`, H23).
 */
export async function itemsAsHeld(actor) {
    await judgedFor(actor?.id);
    return itemsHeldNow(actor);
}

/*
 * `itemsAsHeld` without its wait, for a road that has made the wait itself and reads in one step from its end: a GM's
 * draw (roll-draw.mjs `expectedFor`, through `actorHeldNow`; the merge of the side line's fix r2-H20 with the main
 * line's fix r2-H3, 06.10.2026). Read without the wait, a write heard and not judged yet is read as the mark held the
 * item before it - a write the judgement would keep included.
 * And for two that take no wait of their own (fix r2-H21): a GM's break (inventory.mjs `breakItem`), whose callers
 * on a GM have waited already (a discovery's and a close's `destroyTools`, a swing's and the Rot's wear, a ruling's
 * consumption) and on a player's browser find no mark, and the count Daggerheart's relay may lower (relay-guard.mjs
 * `itemRefusal`), whose judge answers at once, as it measures the Hope from the mark as it stands
 * (`relayGainRefusal`). So a player's break not judged yet is read whole and the GM's break is written over it - the
 * item broken either way - and a GM's rise of a count not judged yet is not counted, so a fall below it asked in
 * that moment is refused.
 */
export function itemsHeldNow(actor) {
    const mark = actor?.type === "character" && isPrimaryGm() && gmStoresHydrated() ? sheetMarkStore.get(actor.id) : null;
    // A Monokuma is no student (`judgeNow`): what it holds stands, so its document is the record.
    const copies = mark && !mark.flags?.[FLAGS.monokuma] ? mark.items ?? {} : null;
    return (actor?.items?.contents ?? []).map(item => {
        const data = docData(item), copy = copies?.[item.id] ?? null;
        const held = !copies ? data : copy ? withPaths(data, copy, isClassItem(data) ? [...ITEM_JUDGED, CLASS_HIT_POINTS] : ITEM_JUDGED)
            : withPaths(data, {}, ITEM_UNHELD);
        return { ...itemLike(held), img: held.img ?? null };
    });
}

/*
 * A STUDENT'S ITEM AS THE MARK HELD IT BEFORE THE WRITE BEING HEARD (E09 fix r2-G10, 09.10.2026): the mark's whole copy
 * of one module item, or null where this browser keeps no mark of the student (as `itemsHeldNow`) or none of the item.
 * Read in the synchronous part of an item's update hook, this is the item before that write: the audit's judgement of
 * the write, which moves the copy, is queued at its own hook and runs in a later job (`inOrder`). A write queued before
 * it and not judged yet is not in it either. For truth-bullets.mjs `onBulletWrite`, whose write reached a bullet's
 * description and its words at once.
 */
export function itemMarkedBefore(actor, id) {
    const mark = actor?.type === "character" && isPrimaryGm() && gmStoresHydrated() ? sheetMarkStore.get(actor.id) : null;
    return mark && !mark.flags?.[FLAGS.monokuma] ? clone(mark.items?.[id]) ?? null : null;
}

/** One of a student's items as the GMs hold it (`itemsAsHeld`), or null where it is no longer on the student. */
export async function itemAsHeld(actor, id) {
    return (await itemsAsHeld(actor)).find(item => item.id === id) ?? null;
}

/*
 * A STUDENT'S MODULE FLAGS AS THE GMS HOLD THEM (E29 fix r2-H19, 06.10.2026), for a GM's road that decides by one
 * through a reader a player's browser shares, handed this in the actor's place as `actorAsHeld` is: its id, name and
 * type, and a `getFlag` that answers - once every write queued on the student has been judged (`judgedFor`) - a flag
 * the mark holds (`MARKED_FLAGS`) with the mark's value and any other with the document's, and every flag with the
 * document's wherever the GMs keep no mark of their own here, as `itemsAsHeld` reads. The mark's flags are taken in
 * one step as the wait ends. The road: the Rot's death (overflow.mjs `rotEverything`, through settings.mjs
 * `isDeceased`, one of the two readers of the flag R192 allows) - a death a player's console wrote, a GM's flag the
 * audit puts back, spared every item of that student until the put-back landed, or for good where it failed. The
 * wait holds up nothing that holds it up, by reading: no judgement waits for a GM's write.
 */
export async function flagsAsHeld(actor) {
    await judgedFor(actor?.id);
    return flagsHeldNow(actor);
}

/*
 * `flagsAsHeld` without its wait (E10 C2, 1.2.71), as `actorHeldNow` is `actorAsHeld`'s: for a GM's decision about
 * several students at once, which waits once for all of them (`judgedFor(...ids)`) and then reads each in one
 * synchronous pass - so no write is judged between two of the reads. The road: who is handed a ballot and whose
 * ballot counts (vote.mjs `eligibleVoters`, behind `studentsJudged` at the open, a player's ask and a cast). The mark is
 * `heldMark`'s, whose rules are the ones `flagsAsHeld` read inline until C2 - the primary's, of a student, not a
 * Monokuma's - and its flags are taken in one step here, as they were there as the wait ended.
 */
export function flagsHeldNow(actor) {
    const mark = heldMark(actor);
    const flags = mark ? clone(mark.flags ?? {}) : null;
    return { id: actor?.id ?? null, name: actor?.name ?? null, type: actor?.type ?? null,
        getFlag: (scope, key) => flags && scope === MODULE_ID && MARKED_FLAGS.includes(key) ? flags[key] : actor?.getFlag?.(scope, key) };
}

/*
 * A STUDENT AS THE GMS HOLD ITS ITEMS, FOR A GM'S DECISION (E29 fix r2-H18, 06.10.2026; H17's seam). A GM's road
 * that decides by a student's items through the readers a player's browser shares - inventory.mjs `canCarry` and
 * `carriedFor`, use-items.mjs `equippedFor` - hands them this in the actor's place: its id, name and type, and its
 * items as `itemsAsHeld` reads them, in a list read as an actor's collection (`filter`, `find`, `some`, `get`). The
 * readers stay synchronous, and the player's browser's own reads stay on its document (its sheet and its quotes: the
 * GM decides). Nothing is written through it - a road writes to the documents. The roads: the crisis on the GM
 * (murder-rules.mjs `applyCrisisAction`), a tool's relief on a project's roll (action-rolls.mjs `reliefHeld`), and the
 * receiver's hands on the copy roads (handover.mjs `giveItem`, `lootBody`; vault.mjs `stealFromVault`,
 * `stealFromPerson`, `plantOnPerson`). The wait is `itemsAsHeld`'s, and on these roads, as on H17's, it holds up
 * nothing that holds it up, by reading: a crisis action, a project's packet and a copy each come after the roll and
 * the use they follow, and none writes what a judgement waits for (a use's consumption, a roll's card).
 * And since fix r2-H20, each saying the same of its own wait: a clean-up's and Stage 6's gloves (cleanup.mjs
 * `resolveCleanup`, `resolveStageSix`), the gloves and the weapons the discovery and the close break (`destroyTools`),
 * and the searcher's hands a Reroll's find is carried in (reroll.mjs `settleSearch`).
 */
export async function actorAsHeld(actor) {
    await judgedFor(actor?.id);
    return actorHeldNow(actor);
}

/** `actorAsHeld` without its wait (`itemsHeldNow`'s note): a GM's draw reads a weapon, a tool and a Cleaning Tool in hand off it in its one step (roll-draw.mjs `situationReading`). */
export function actorHeldNow(actor) {
    const items = itemsHeldNow(actor);
    return { id: actor?.id ?? null, name: actor?.name ?? null, type: actor?.type ?? null,
        items: Object.assign([...items], { get: id => items.find(item => item.id === id) }) };
}

/*
 * A PLAYER'S ITEM NO GM HAS DECIDED ON CHANGES NO HANDS (E29 fix r2-H21, 06.10.2026; the orchestrator's decision (a),
 * as for fixes r2-H7 and r2-H11 - the owner may overrule it). An item a player's browser makes on a student is
 * flagged whole (`itemFindings`, the plan's 2.6) and stands until a GM decides (2.8), and the mark takes it in as it
 * stands - so a copy road read it as any item the GMs hold: a hand-over, a plant, a theft or a loot made a GM's copy
 * of it on another sheet, a write that stands as the GMs', and deleted the original, whose card's Undo then found
 * nothing to undo. The copy roads (handover.mjs `giveItem` - its key's and its bullet's branches included - and
 * `lootBody`; vault.mjs `plantOnPerson`, `stealFromVault` and `stealFromPerson`) ask this after their wait, which
 * has judged every write queued on the student and so written the creation's row, and before anything is written:
 * an item whose creation row (`sheetWrites`, verdict "flagged", the change `items.<id>` from null) holds no decision
 * is refused, and the asker told (`itemNotDecided`). The decision is read as the card's Undo and Keep write it
 * (`decideNow`: `decided`, written before anything else, on a card's row and on a row of the card of changes made
 * with no GM watching alike): kept, the item copies as any item; undone, it is gone, and there is nothing to copy.
 * A row swept a day after it was written (`keepRows`) or cut by the reset's "actions" group (gm-stores.mjs
 * `sheetWriteStore`) is a decision no GM can make any more - by the plan's 2.3 and 2.8 the window has closed and the
 * write stands - so the item copies then too. A created item on its owner's own roads (an Objection with it, Use an
 * item) stands until a GM decides, as 2.8 says, and is not asked here. Null on a browser that holds no rows.
 */
export function creationRefusal(actor, itemId) {
    if (!game.user?.isGM || !gmStoresHydrated() || !actor?.id || !itemId) return null;
    const whole = `items.${itemId}`;
    const open = Object.values(sheetWriteStore.entries() ?? {}).some(row => row?.actorId === actor.id && row.itemId === itemId
        && row.verdict === "flagged" && !row.decided && Array.isArray(row.change?.[whole]) && row.change[whole][0] === null);
    return open ? `no GM has decided yet on an item a player made on a sheet: "${actor.items?.get(itemId)?.name ?? itemId}"` : null;
}

/*
 * THE ITEMS A PLAYER'S WRITE TOOK OFF A STUDENT THAT A GM'S UNDO WOULD MAKE AGAIN (E29 fix r2-H22, 06.10.2026): each
 * undecided row of an item the GMs held that a player deleted (`itemFindings`: flagged, the change `items.<id>` to
 * null, the GMs' copy kept as `data`; a row of the card of changes made with no GM watching alike), while the item is
 * still off the sheet - the copy `decideNow`'s Undo makes again under its id - read as an item (`itemLike`, with the
 * uuid it had). For a road that takes such an item for good (chapter.mjs `keepBulletDeletions`). Empty on a browser
 * that holds no rows.
 */
export function deletedHeldBy(actor) {
    if (!game.user?.isGM || !gmStoresHydrated() || !actor?.id) return [];
    return Object.entries(sheetWriteStore.entries() ?? {}).filter(([, row]) => row?.actorId === actor.id && row.itemId && row.data
        && row.verdict === "flagged" && !row.decided && Array.isArray(row.change?.[`items.${row.itemId}`])
        && row.change[`items.${row.itemId}`][1] === null && !actor.items?.has(row.itemId))
        .map(([rowId, row]) => ({ rowId, item: { ...itemLike({ ...row.data, _id: row.itemId }), uuid: `${actor.uuid}.Item.${row.itemId}` } }));
}

/**
 * The GMs' value of each of a student's means (`hope`, `actions`, `hitPoints`, `stress` and the two
 * grants): their mark's, on the primary, where the judge keeps it current; the document's on any other
 * browser - its copy of the mark may not have caught up yet - and where they hold none of their own:
 * no mark, a Monokuma, the stores not hydrated, not a student (E29 fix r1-G5).
 */
export function meansHeld(actor) {
    return ledgerOf(heldMark(actor), actor);
}

/** The mark the held readers read: the primary's, of a student; none for a Monokuma - no student (`judgeNow`): what it holds stands, so its document is the record. */
function heldMark(actor) {
    const mark = actor?.type === "character" && isPrimaryGm() && gmStoresHydrated() ? sheetMarkStore.get(actor.id) : null;
    return mark && !mark.flags?.[FLAGS.monokuma] ? mark : null;
}

/*
 * A STUDENT'S RESOURCE MAXIMUM AS THE GMS HOLD IT (E29 fix r2-H23, 06.10.2026), where `meansHeld` holds the value: the
 * prepared maximum with the mark's sheet maximum for the sheet's - Hope's with the mark's scars for the sheet's, since
 * fix r2-H25 (`maxHeld`, as a judgement bounds the mark) - on the primary; the document's on any other browser and where
 * the GMs hold no mark of their own. A player's write of a maximum is put back with `lockPlayerResources` on
 * (`LOCK_NAMED_MAX`) and stands on the sheet until its put-back lands, and for good where it fails. For a GM's
 * give-back held to the end of a track - a Reroll's rewind of a crisis action's marks (murder-rules.mjs
 * `undoLastCrisis`) and of a clean-up's Sanity (cleanup.mjs `undoLastCleanup`) - read in the job `gmMeansWrite` runs,
 * as the value is; so too, since fix r2-H27, for a Reroll's price given back (reroll.mjs `giveBack`) and a critical's
 * second Hope (despair-award.mjs `adjustCritHopeTopUp`), the last two jobs that read Hope's maximum off the document
 * (tier 1's R290 holds the census of such reads). Prepared: the end of a track, not a sheet's maximum to write over
 * (`numberHeld`).
 */
export function meansMaxHeld(actor, key) {
    return maxHeld(actor, heldMark(actor), key);
}

/*
 * ANY OTHER NUMBER OF A STUDENT'S AS THE GMS HOLD IT (E29 fix r2-H24, 06.10.2026): a statistic, an experience's value,
 * the advances taken and, since fix r2-H25, a sheet's maximum - what level-up.mjs `applyAdvancement` adds to. The sheet's
 * value as the mark holds it, on the primary, and nothing where the mark holds none (the GMs hold none: a module flag the
 * player wrote); the sheet's own on any other browser and where the GMs hold no mark of their own. The sheet's, not the
 * prepared value (fix r2-H25): what is written into the sheet Daggerheart prepares again - a class's hit points added to
 * Health's maximum, a Level Up's picks to a statistic or a maximum (character.mjs `prepareBaseData`, 2.10.5 :678-700,
 * :741), an effect's changes - so a prepared value written there takes them a second time. H24 read the prepared value
 * with the mark's for the sheet's, and the maxima as `meansMaxHeld` answers them, prepared: measured at 525a186
 * (06.10.2026, e29run/r2h25red) by tier 2 ("a GM's Level Up rises from the sheet's maximum"), +1 Health and +1 to a
 * statistic over a class's 5 hit points and a pick of +1 wrote 12 and 2 for 7 and 1. Read in the job `gmMeansWrite` runs.
 */
export function numberHeld(actor, path) {
    const mark = heldMark(actor);
    return foundry.utils.getProperty(mark ? markAsDocument(mark) : actor?._source ?? {}, path);
}

/*
 * A GM'S WRITE OF A STUDENT'S MEANS, MADE FOR A PLAYER (E29 fix r1-G5, 05.10.2026; review round 1
 * sec M1). A Call bought on the GM (gm-bridge.mjs `call.arm`) and a drawn roll's resource step
 * (roll-draw.mjs `DrawnResources`) write a student's Hope on the primary for the player who asked,
 * and the judge takes a GM's write as the GMs' value (`gmLedger`). Read off the document, such a
 * write carried a forged Hope the judge had not put back yet: the review's probe at 69deef0 bought a
 * Support from 0 real Hope behind a forged 3 and left Botan at 2 in the mark. C8's wait before the
 * purchase's guards (`judgedFor`) closed that order - refused in 12 runs of 12 at 6c7f9d2 (the
 * forged write sent unawaited before the request, after it, and 0 or 5 ms before it, three times
 * each; e29run/r1g5q/head-probe.log) - but not a forged write the primary heard while its own write
 * was on its way: the put-back, computed from the GMs' value before the GM's write was heard, landed
 * after that write and wrote it over. With 1 real Hope under a forged 3, in the same four orders, the
 * Support was bought and paid in the mark, and the document went back to 1 on every client in 5 runs
 * of 12 (3 of 3 with the request sent first, 2 of 3 with the forged write sent first, none of 6 with a
 * timer between them). So such a write is a job in the student's queue (`inOrder`): it starts once
 * every write heard on the student has been judged, reads the GMs' value (`meansHeld`) and holds the
 * queue until its own write has been heard - an awaited `trustedWrite` does - so a write heard
 * meanwhile is judged after it, from it (`hopeLeft`). With it, the same probe read as expected in 24
 * runs of 24 (e29run/r1g5q/q1-probe.log). `write(held)` answers what its caller needs; an error in it
 * is the caller's, and the queue goes on.
 * Since fix r2-H23 a Reroll's rewind writes in such a job too: the Hope a use gave taken back and the marks put back
 * to the end of the track the GMs hold (murder-rules.mjs `undoLastCrisis`), and a clean-up's Sanity (cleanup.mjs
 * `undoLastCleanup`); since E09 fix r2-G3 a refused clean-up's price given back as far as the credit holds it
 * (`creditRefund`), the one job that moves the mark itself.
 */
export function gmMeansWrite(actor, write) {
    if (actor?.documentName !== "Actor" || actor.type !== "character") return (async () => write(meansHeld(actor)))();
    return new Promise((resolve, reject) => {
        void inOrder(actor.id, async () => {
            try {
                resolve(await write(meansHeld(actor)));
            } catch (err) {
                reject(err);
            }
        });
    });
}

/*
 * A ROAD'S WRITE OF A STUDENT'S MEANS, ON A GM'S CLIENT OR A PLAYER'S (E29 fix r2-H24, 06.10.2026; found by fix r2-H23,
 * which read `refundAction` and measured nothing). `write(held, maxOf)`: on a GM's client a `gmMeansWrite` job, `held`
 * the values the GMs hold (`meansHeld`) and `maxOf(key)` the maximum they hold (`meansMaxHeld`; undefined where there is
 * none), read in its one step (H3); on a player's browser the document's prepared values and maxima, read as its roads
 * read them before this fix (`resourceValue`, `resourceMax`) - the player's own write, which the GMs judge when it lands.
 * Until this fix each road below read what it writes from off the document on a GM's client as well, where a player's
 * write the audit puts back with `lockPlayerResources` on - the Hope, a statistic, a maximum (`LOCK_NAMED_MAX`), the
 * advances - stands until its put-back lands, and for good where it fails, and where a GM's write over the same path
 * supersedes the put-back pending on it (READ WHEN WRITTEN). Measured at 85fdf9d (06.10.2026, e29run/r2h24red; tier 2,
 * the five tests named "... the GMs hold"), the put-back held by a GM's hook: an action given back came to 4 under the
 * GMs' maximum of 2 and a refill gave a wounded student the whole budget; a Level Up raised a Health maximum to 10 for
 * 7; seven roads wrote Hope from the console's 5 for the GMs' 2; a raised Sanity maximum let an Objection be paid with a
 * seventh mark on a track of 6; and a lowered one kept an Observe's, a resolution's, Paranoia's and the incident's marks
 * off a track the GMs held room on.
 * The roads: an action given back (actions.mjs `refundAction`) or set by a GM (`setActions`), and a time of day's
 * refill, which reads the Health that wounds (`resetActionsFor`); a price paid on the GM - the Objection - or given back
 * (price.mjs `payPrice`, `refundPrice`); Despair turned into Hope (despair.mjs `convertDespairToHope`); what an item a
 * GM rules on restores (use-items.mjs `restore`); a Despair Call's Hope and marks (call-effects.mjs
 * `hopeFromDespairEffect`, `damageEffect`); a Hope Call bought on a GM's client and its price given back (calls.mjs
 * `spendHopeCall`); a rest (rest.mjs `applyRest`); an advancement (level-up.mjs `applyAdvancement`, with `numberHeld`);
 * a missed Observe's Sanity (observe.mjs `chargeObserveMiss`) and a resolution's (cleanup.mjs `markResolutionStress`);
 * and the incident's marks - a Despair opening's Sanity, a hit, a drain, a resolution's blood (murder-rules.mjs
 * `resolveKillerOpening`, `takeReserves`, `spendStress`). A Hope maximum is Daggerheart's world setting less the scars,
 * whatever the sheet's maximum says: on a GM's client less the scars the GMs hold, since fix r2-H25 (`maxHeld`).
 * No job here waits on itself, by reading (H17's caution): each reads, computes and makes its one `trustedWrite`
 * (`convertDespairToHope` records the pool's debt first, a GM store's write), so nothing it awaits is a judgement that
 * waits on the student's queue; every other wait a road makes - `itemAsHeld` in `grantItemEffect`, a judgement's; the
 * GM's yes in `spendHopeCall` - comes before its job or after it, never in it; no judgement calls any of these roads;
 * and no `gmMeansWrite` job calls one (the jobs before this fix make their writes and call no road: reroll.mjs
 * `makeReroll` and `giveBack`, gm-bridge.mjs `armPaidByPlayer`, despair-award.mjs `adjustCritHopeTopUp`, roll-draw.mjs
 * `modifyFromHeld`, murder-rules.mjs `undoLastCrisis`, cleanup.mjs `undoLastCleanup`).
 */
export function meansWrite(actor, write) {
    if (game.user?.isGM) {
        return gmMeansWrite(actor, held => write(held, key => {
            const max = meansMaxHeld(actor, key);
            return Number.isFinite(max) ? max : undefined;
        }));
    }
    const own = Object.fromEntries(Object.entries(LEDGER).map(([key, { path }]) => [key, Number(foundry.utils.getProperty(actor ?? {}, path)) || 0]));
    return (async () => write(own, key => actor?.system?.resources?.[key]?.max))();
}

/*
 * A PRICE GIVEN BACK NO FURTHER THAN THE GMS SAW IT PAID (E09 fix r2-G3, 08.10.2026; review round 2 sec S2-1). A GM's
 * refund stands whatever the credit holds (`gmLedger`), so a GM's client that gives back the step a packet says its
 * player's browser paid - a refused clean-up's step of Tamper's price (cleanup.mjs `refundRefused`) - gave it back
 * whether anything was paid or not: measured at 97e0eef by tier 2 ("a clean-up the GM refuses gives back no price the
 * GMs did not see paid"), a student with nothing in the credit had a refused clean-up give back the action and the
 * Sanity step its packets named. This gives back at most `n` of the means `key` (a key of LEDGER), no more than the
 * credit the GMs hold of it - what a payment they saw left, a player's write judged or a GM's - and takes that credit,
 * so one payment comes back once. All of it in one job (`gmMeansWrite`): the credit read and taken, the write, and the
 * mark moved by both before the queue goes on. Not left to the write's own judgement, which takes a GM's refund from
 * the credit too: that judgement is queued at the write's hook, behind any job queued meanwhile, so the next refusal's
 * job read the credit and the value before it moved them - measured on this fix (08.10.2026,
 * e09run/scratch/r2g3-m7probe.log) by tier 2's "Stage 6's own refusals give the killer back the step they paid and no
 * more", two Sanity steps paid and three trails refused at once: with the mark left to that judgement, 2 marks where 1
 * was owed, and three refund lines for the one step that came back. The judgement now finds the mark holding what the
 * job wrote, and moves nothing and takes nothing. Answers what came back, in the means' own units (0 for nothing), or
 * null where this browser holds no mark of the student (`heldMark`: not the primary, its stores not hydrated, a
 * Monokuma) - what stands for it there is the caller's to say.
 */
export function creditRefund(actor, key, n) {
    if (!LEDGER[key] || !heldMark(actor)) return Promise.resolve(null);
    return gmMeansWrite(actor, async held => {
        const mark = heldMark(actor);
        if (!mark) return null;
        const credit = creditOf(mark), taken = takeCredit(credit, key, n);
        if (!taken) return 0;
        const value = bounded(actor, mark, key, held[key] - LEDGER[key].cost * taken);
        if (value !== held[key]) await trustedWrite(actor, { [LEDGER[key].path]: value }, { reason: "refund" });
        const now = heldMark(actor) ?? mark;
        await markWritten(actor, withLedger(clone(now), { ...ledgerOf(now, actor), [key]: value }, credit));
        return (held[key] - value) * LEDGER[key].cost;
    });
}

/** A path a write names, without v14's `-=` and `==` on its parts: the path it writes. */
const plainPath = path => path.replace(/(^|\.)[-=]=/g, "$1");

/*
 * WHAT A WRITE REACHES (E29 fix r1-G2, 05.10.2026; review round 1 sec B2). Each leaf a write names
 * (`pathsOf`), as the path it writes: a key spelled the old way, `==key` or `-=key`, replaces or
 * deletes all of that key, so the path is cut there and stripped (`system.==resources.hope.value`
 * reaches `system.resources`). A leaf is everything under it that it was written over - v14's
 * forced replacement or deletion is a leaf (`isPlain`), and so is any value but a plain object
 * with keys - and each judgement reads it so: `names` takes a means under it as named, `judgedPaths` every leaf
 * under it the mark and the write's hook disagree on, `itemPathsOf` every judged path of an item.
 * Until this fix such a write was judged as the one path it named, which no judgement reads:
 * measured on the harness by the review's probe on 69deef0, `system.resources` replaced whole raised
 * Hope 2 to 6 and its maximum 6 to 8 and healed two Health marks, the module's flags replaced whole
 * made the student a Monokuma, and all of it stood with no row. What v14 hands a hook for an operator
 * - the instance, a plain value, or nothing at that key - is LIVE-E30-03: the harness hands the
 * instance (lib/operators.mjs), and there a key spelled the old way changes nothing; Foundry is not
 * measured. truth-bullets.mjs reads a bullet's write with it too (`guardedPathsIn`, fix r2-H13), so the
 * two judges of an item's write read its forms one way.
 */
export function reachOf(changes) {
    return [...new Set(pathsOf(changes).map(raw => {
        const parts = raw.split("."), cut = parts.findIndex(part => /^[-=]=/.test(part));
        return plainPath(cut < 0 ? raw : parts.slice(0, cut + 1).join("."));
    }))];
}

/*
 * A WRITE AS ITS HOOK SAW IT (E29 fix r1-G1, 05.10.2026; review round 1 sec B1 = cor B1). The value
 * of every path a write names, read off the document while its hook runs - a path the write left
 * absent as undefined - and, for a named ancestor of what the mark keeps (`system` written whole),
 * each root of the mark under it. The judge reads the write here, and the mark moves by nothing
 * else (`markAfter`): by the time a judgement comes, the document may hold the writes queued behind
 * it. Until this fix the mark was read off the document when each judgement ended, so a write that
 * landed meanwhile was in the mark before its own judgement, which then found nothing - measured on
 * the harness by the review's probes on 69deef0: a second statistic, the Monokuma flag (after which
 * every write on that student stood) and a GM's penalty effect deleted, each behind a forged write
 * the judge was putting back, all stood with no row. C8 had kept the armed list so (`heldCalls`) and
 * said the same held of every other field; it now holds of all of them.
 */
function pathsSeen(src, changes) {
    const seen = {};
    for (const named of reachOf(changes)) {
        const roots = MARKED_PATHS.filter(root => root.startsWith(`${named}.`));
        for (const path of roots.length ? roots : [named]) seen[path] = clone(foundry.utils.getProperty(src, path));
    }
    return seen;
}

/** A write as its hook saw it (`pathsSeen`), as a document holding those paths alone. */
function asSource(seen) {
    const doc = {};
    for (const [path, value] of Object.entries(seen ?? {})) if (value !== undefined) foundry.utils.setProperty(doc, path, clone(value));
    return doc;
}

/** Sets one path of a student's document in a mark, absent where `value` is undefined; a path the mark keeps no root of is passed over. */
function setMarked(mark, path, value) {
    const root = MARKED_PATHS.find(each => path === each || path.startsWith(`${each}.`));
    if (!root) return;
    const flag = root.startsWith("flags.");
    const field = flag ? "flags" : root.slice("system.".length);
    const within = flag ? path.slice(`flags.${MODULE_ID}.`.length) : path.slice(root.length + 1);
    if (!within) {
        // The scars are a number, 0 where there are none (fix r2-H25); every other root an object.
        mark[field] = root === "system.scars" ? value ?? 0 : isPlain(value) ? clone(value) : {};
        return;
    }
    mark[field] ??= {};
    if (value !== undefined) {
        foundry.utils.setProperty(mark[field], within, clone(value));
        return;
    }
    const parts = within.split("."), key = parts.pop();
    const parent = parts.length ? foundry.utils.getProperty(mark[field], parts.join(".")) : mark[field];
    if (parent && typeof parent === "object") delete parent[key];
}

/*
 * The mark after one judged write (G1): the mark as held, with each path the write's hook saw set
 * (`paths`), then each path put back given its held value again (`back`; the armed list, the
 * entries of the hook's list the GMs held: `calls`), the one effect that stood (`effect`, on the
 * student or on its item `effect.itemId`, G3) or those of a student's update that wrote them
 * (`effects`, fix r2-H8), the module items as the verdict leaves them (`items`, C6) and their
 * effects as an item made, deleted or updated with them leaves them (`itemEffects`, G3), and the
 * means as the judgement hands them (`ledger`) or as held - never as written: the GMs' means are
 * the ledger's alone (C4).
 */
function markAfter(actor, held, { paths = {}, back = [], calls = null, effect = null, effects = [], items = null, itemEffects = null, ledger = null } = {}) {
    const next = Object.fromEntries(["traits", "experiences", "resources", "rules", "bonuses", "levelData", "flags", "effects", "items", "itemEffects"]
        .map(field => [field, clone(held[field] ?? {})]));
    next.scars = held.scars ?? 0;
    for (const [path, value] of Object.entries(paths)) setMarked(next, path, value);
    const was = markAsDocument(held);
    for (const path of back) setMarked(next, path, path === CALLS_PATH && calls ? keptCalls(paths[CALLS_PATH], calls) : foundry.utils.getProperty(was, path));
    if (effect) setEffect(next, effect.itemId ?? null, effect.id, effect.data);
    for (const each of effects) setEffect(next, each.itemId ?? null, each.id, each.data);
    if (items) next.items = items;
    if (itemEffects) next.itemEffects = itemEffects;
    return withLedger(next, ledger?.values ?? ledgerOf(held, actor), ledger?.credit ?? held.credit ?? {});
}

/** Writes the fields of `next` that differ from the student's mark (all of them where it has none). Answers whether it wrote. */
async function markWritten(actor, next) {
    const held = sheetMarkStore.get(actor.id) ?? {};
    const moved = Object.fromEntries(Object.entries(next).filter(([field, value]) => stableJson(value) !== stableJson(held[field] ?? null)));
    if (!Object.keys(moved).length) return false;
    await sheetMarkStore.patch(actor.id, moved);
    return true;
}

/**
 * THE MARK MOVES BY WHAT WAS JUDGED (G1). After a GM's write, by the paths it named, as its hook
 * saw them; after a player's, by what of it stood (`markAfter`) - never by the document as it
 * stands when the judgement ends, nor, for an item or an effect, by the rest of the copy its hook
 * saw, which holds the writes before it (`reached`, fix r2-H15). An item or an effect made, or one
 * the mark holds no copy of, is taken whole. A student with no mark takes the document whole (`markFrom`),
 * as `fillMarks` does. Only the fields that differ are written, so a write the mark already holds
 * patches nothing. Answers whether it wrote.
 */
async function refreshMark(actor, moves = {}) {
    if (!gmStoresHydrated() || !game.actors?.has(actor?.id)) return false;
    const held = sheetMarkStore.get(actor.id);
    return markWritten(actor, held ? markAfter(actor, held, moves) : markFrom(actor));
}

/*
 * A mark for every character that has none, on the primary, once its stores hold the other GMs'
 * copies: in one write, as the hydration is heard. One write per character, each awaited, was the
 * first version, and its last marks landed while the suite had begun: measured on the harness
 * 05.10.2026 (e29run/c3a1), tier 0/1's "changed nothing" check found three characters' marks
 * written during it.
 */
function fillMarks() {
    const missing = (game.actors?.contents ?? []).filter(actor => actor.type === "character" && !sheetMarkStore.has(actor.id));
    if (!missing.length) return Promise.resolve();
    return sheetMarkStore.patchMany(Object.fromEntries(missing.map(actor => [actor.id, markFrom(actor)])));
}

/*
 * THE MARKS A RESET TOOK, AND A STUDENT MADE SINCE (E29 fix r1-G6, 05.10.2026; review round 1 sec m2).
 * A reset that wipes the "advancement" group cuts every mark (gm-stores.mjs `sheetMarkStore`), and a
 * student the reset's steps then write nothing on - its sheet already its start, an empty diff - had
 * none until the primary's next hydration; nor had a character made after it. A player's write on
 * either became its mark. So the primary fills them as the cut is applied (the store's `onCut`) and
 * as a character is made - not while the suite holds the stores or stands them in another world, as
 * at the hydration. Measured by scenario 61's J5 on 8895265 (05.10.2026, e29run/r1g6red): after a
 * reset with "advancement" ticked the Monokuma - a character the reset's steps write nothing on - had
 * no mark, nor had a character made after it; with the fill (e29run/r1g6) every character has one.
 */
export function refillMarks() {
    if (!isPrimaryGm() || !gmStoresHydrated() || gmStoresQuiet()) return Promise.resolve();
    return fillMarks();
}

/* ---------------------------------------------------------------------------
 * The judge
 * ------------------------------------------------------------------------- */

/**
 * JUDGE ONE WRITE (exported so tier 2 can hand it a write with a real player's id; the
 * hooks below hand it every write on the primary). `kind` is the hook's name:
 * `updateActor` with the student and its changes, or `createActiveEffect`,
 * `updateActiveEffect`, `deleteActiveEffect` with the effect (and the changes of an
 * update), or `updateItem`, `createItem`, `deleteItem` with the item (C6). A GM's write - `game.users.get(userId).isGM` - is the new mark. Answers
 * `{ verdict, change }` (`putBack`, `listed`, `stands`, `mark`), or null for a write
 * on no character. Queued behind the writes before it on that student. `priors` is
 * what the hook heard before this write (`noteWrite`); a write handed in without
 * them is measured from the GMs' values.
 */
export function judgeWrite(kind, doc, changes, userId, options = {}, priors = null) {
    // An effect on one of the student's items is the student's (G3): Daggerheart applies it to the student.
    const actor = kind === "updateActor" ? doc : itemOf(doc) && !ITEM_WRITES.has(kind) ? itemOf(doc).parent : doc?.parent;
    if (actor?.documentName !== "Actor" || actor.type !== "character") return Promise.resolve(null);
    // The write as its hook saw it (G1): by the time its judgement comes, a later write may have moved the document.
    const data = kind === "updateActor" || kind.startsWith("delete") ? null : docData(doc);
    const seen = kind === "updateActor" ? seenNow(actor, changes, options, priors)
        : ITEM_WRITES.has(kind) ? { at: Date.now(), item: data } : { at: Date.now(), effect: data };
    return inOrder(actor.id, () => judgeNow(kind, doc, actor, changes, userId, options, seen));
}

async function judgeNow(kind, doc, actor, changes, userId, options, seen) {
    const user = game.users?.get(userId ?? "");
    const early = !gmStoresHydrated() && !options?.[AUDIT_ASIDE];
    // What a write that stands moves the mark by: the paths, the item or the effect as its hook saw them - an update of
    // either by the paths it reached (r2-H15) -, the effects written through either (r2-H8) and the items written through
    // the student (r2-H10).
    const stood = mark => ITEM_WRITES.has(kind) ? itemMoves(kind, mark, doc, seen.item, changes)
        : kind === "updateActor" ? { paths: seen.paths, effects: seen.effects ? effectMoves(mark?.effects, seen.effects, entriesNamed(changes, "effects")) : [],
            ...(seen.items ? itemsMoved(mark, seen.items, itemsNamed(changes)) : {}) }
            : { effect: { id: doc.id, itemId: itemOf(doc)?.id ?? null, data: kind === "updateActiveEffect"
                ? reached(effectHeld(mark, itemOf(doc)?.id ?? null, doc.id), seen.effect, changes) : seen.effect } };
    if (user?.isGM) {
        if (early) noteUnmarked(kind, doc, actor, changes);
        /* The GMs' own put-back moves nothing they hold: it writes back what the mark holds, and since G1
           nothing else - what else the document then holds is the writes after it, each judged in turn.
           Any other GM's write is their value of what it names.
           A GM'S REFUND WITHOUT ITS REASON (the merge of the side fix line, 05.10.2026). Since fix r1-G7 a
           GM's write carries no reason but the audit's own (resource-guard.mjs `stampOf`), and fix r1-G4's
           `gmLedger` reads a refund off that reason: merged as they were, a GM's refund took no credit, and
           tier 2's "a refund a GM writes takes the credit" and 30's console refund stood on the payment
           (Hope 5 and 4; e29run/mergee29fixy-run1). `HOPE_REFUND` still travels on every write that names
           `refund`, a GM's included, so it stands for the reason here; and since fix r2-H6 a GM's give-back
           under another name - a Reroll's take-back of an Observe's, a clean-up's or a crisis action's
           Sanity and Health, named `reroll` - carries `GIVE_BACK` (resource-guard.mjs `stampOf`), which
           stands for it too. */
        const reason = options?.drpgWrite?.reason ?? (options?.[HOPE_REFUND] || options?.[GIVE_BACK] ? "refund" : null);
        if (options?.[AUDIT_ASIDE] || reason === "auditPutBack") return { verdict: "mark", change: {} };
        const moves = stood(sheetMarkStore.get(actor.id));
        if (kind === "updateActor") moves.ledger = gmLedger(actor, seen, reason, Boolean(options?.[GIVE_BACK]));
        await refreshMark(actor, moves);
        return { verdict: "mark", change: {} };
    }
    const mark = sheetMarkStore.get(actor.id);
    if (!mark) return unmarkedWrite(kind, doc, actor, changes, user, options, seen);
    // Judged against this browser's own copy of the mark before the others' arrive: what it named is as judged.
    if (early) noteUnmarked(kind, doc, actor, changes);
    // A Monokuma is no student; the mark's flag decides, so a write that makes one is still judged.
    if (mark.flags?.[FLAGS.monokuma]) {
        await refreshMark(actor, stood(mark));
        return { verdict: "stands", change: {} };
    }
    const found = kind === "updateActor" ? await updateFindings(actor, mark, changes, user, options, seen)
        : ITEM_WRITES.has(kind) ? await itemFindings(kind, doc, actor, mark, changes, user, options, seen)
            : effectFindings(kind, doc, mark, changes, seen.effect);
    // A student's update answers for the items written through it as well (fix r2-H10): each its own findings.
    const parts = [found, ...(found.byItem ?? [])];
    const any = key => parts.some(part => part[key]?.length);
    const change = Object.assign({}, ...parts.map(part => part.change));
    if (any("back") || found.fix) {
        try {
            await found.undo();
        } catch (err) {
            error(`The GMs' audit could not put back a write on ${actor.name}`, err);
            return { verdict: "failed", change };
        }
    }
    await record(actor, user, found, options);
    if (found.finds) await sheetMarkStore.patch(actor.id, { finds: found.finds });
    await refreshMark(actor, ITEM_WRITES.has(kind) ? { items: found.items, itemEffects: found.itemEffects } : found.moves);
    const verdict = any("back") ? "putBack" : any("flagged") ? "flagged" : any("listed") ? "listed" : "stands";
    return { verdict, change };
}

/*
 * A PLAYER'S WRITE ON A STUDENT WITH NO MARK (E29 fix r1-G6, 05.10.2026; review round 1 sec m2).
 * Nothing to judge it against, so the document becomes the mark - and the write that made it is
 * recorded, `listed`, each path as its hook left it, the value before it being "-" (the GMs held
 * none). Until this fix the mark took it in silently: measured by the review's probe 90 on 69deef0,
 * a mark dropped and p1's Agility +3 stood with no row and in the mark, and on 8895265 (05.10.2026,
 * e29run/r1g6red) by tier 2 - the verdict "mark", no row, the mark holding the +3. The primary now fills a missing mark as a
 * character is made and as a reset's cut takes the marks (`refillMarks`), so this is the window between
 * those and the fill's write. Before this browser's stores hydrate nothing is written or recorded:
 * the other GMs' marks may arrive with the hydration, and the comparison then judges this write as
 * a difference (`noteUnmarked` leaves it out).
 */
async function unmarkedWrite(kind, doc, actor, changes, user, options, seen) {
    if (!gmStoresHydrated() || !game.actors?.has(actor.id)) return { verdict: "mark", change: {} };
    const change = {};
    if (kind === "updateActor") for (const [path, value] of Object.entries(seen.paths ?? {})) change[path] = [null, value ?? null];
    else if (ITEM_WRITES.has(kind)) {
        const whole = `items.${doc.id}`;
        if (kind !== "updateItem") change[whole] = [null, seen.item ?? null];
        else for (const path of reachOf(changes)) change[`${whole}.${path}`] = [null, foundry.utils.getProperty(seen.item ?? {}, path) ?? null];
    } else change[effectPath(itemOf(doc)?.id, doc.id)] = [null, seen.effect ?? null];
    const listed = Object.entries(change).map(([path, moved]) => ({ path, kind: fieldKind(path, moved) }));
    await record(actor, user, { back: [], flagged: [], listed, change }, options);
    await refreshMark(actor);
    return { verdict: listed.length ? "listed" : "mark", change };
}

/**
 * A student's update, as its hook saw it (G1): what it changed of what a roll is built from
 * (`actorFindings`) and of its means (`meansFindings`), put back in one write (`putBackNow`), the
 * effects it wrote, each put back through its own document (`parentEffects`, fix r2-H8), the
 * items it wrote, each judged as a write of that item (`byItem`, `parentItems`, fix r2-H10), and
 * what the mark takes of it (`moves`). The GMs' armed entries it took wait for the roll that covers
 * them (`callsCover`, fix r2-H7).
 */
async function updateFindings(actor, mark, changes, user, options, seen) {
    const was = asSource(seen.paths);
    const read = actorFindings(mark, changes, was);
    const sheet = read.taken.length ? callsOwed(read, await callsCover(actor, user, read.taken, seen.at)) : read;
    const means = await meansFindings(actor, mark, user, options, seen);
    const effects = seen.effects ? parentEffects(actor, null, mark, seen.effects, entriesNamed(changes, "effects")) : { back: [], listed: [], change: {}, undos: [], stood: [] };
    const items = seen.items ? await parentItems(actor, mark, changes, user, options, seen.items) : null;
    const back = [...sheet.back, ...means.back];
    return { back: [...back, ...effects.back], listed: [...sheet.listed, ...means.listed, ...effects.listed], flagged: [...sheet.flagged, ...means.flagged],
        stood: [...(sheet.stood ?? []), ...means.stood], roll: sheet.roll ?? null,
        change: { ...sheet.change, ...means.change, ...effects.change },
        covered: means.covered, fix: means.fix, byItem: items?.found ?? [], finds: items?.finds ?? null,
        moves: { paths: seen.paths, back: back.map(entry => entry.path), calls: sheet.calls, ledger: means.ledger, effects: effects.stood,
            ...(items ? { items: items.items, itemEffects: items.itemEffects } : {}) },
        undo: async () => {
            await putBackNow(actor, mark, was, back, sheet.calls, means.patch);
            for (const undo of effects.undos) await undo();
            for (const one of items?.found ?? []) if (one.back.length) await one.undo();
        } };
}

/**
 * A student's update: what it changed that the statistics' half of this file judges, against the
 * mark - read in `src`, the write as its hook saw it (G1), or the document as the comparison at
 * ready read it. `calls.added` holds the armed entries it added, each as `stableJson`, and
 * `taken` the GMs' entries it took off (`gmsCall`), which its caller puts back or lets stand on a
 * roll (`callsOwed`). The free Move given back is flagged (G4, `MARKED_FLAGS`); what no judgement
 * here or in `meansFindings` covers is listed (`otherField`).
 */
function actorFindings(mark, changes, src) {
    const before = markAsDocument(mark);
    const lock = locked(), back = [], listed = [], flagged = [], change = {};
    let calls = null, taken = [];
    for (const path of judgedPaths(before, changes, src)) {
        const kind = kindOf(path);
        const was = foundry.utils.getProperty(before, path), now = foundry.utils.getProperty(src, path);
        if (!kind || (kind === "experience" && !experienceCounts(path, before))) {
            if (otherField(path, was, now)) {
                change[path] = [clone(was) ?? null, clone(now) ?? null];
                listed.push({ path, kind: "other" });
            }
            continue;
        }
        if (stableJson(was ?? null) === stableJson(now ?? null)) continue;
        if (kind === "grant") {
            if (was && !now) {
                change[path] = [clone(was), clone(now) ?? null];
                flagged.push({ path, kind });
            }
            continue;
        }
        if (kind === "pendingCall") {
            const all = [foundry.utils.getProperty(before, CALLS_PATH), foundry.utils.getProperty(src, CALLS_PATH)];
            const added = addedEntries(...all);
            // What it took of the GMs' (fix r2-H7): put back, or stood on a roll, once its cover is asked (`callsOwed`).
            const gone = addedEntries(all[1], all[0]).filter(entry => gmsCall(entry) && !spentByGm(entry?.nonce));
            if ((added.length || gone.length) && !calls && !taken.length) {
                if (added.length) {
                    calls = { added: new Set(added.map(stableJson)), taken: [] };
                    back.push({ path: CALLS_PATH, kind });
                }
                taken = clone(gone);
                change[CALLS_PATH] = all.map(v => clone(v) ?? null);
            }
            continue;
        }
        change[path] = [clone(was) ?? null, clone(now) ?? null];
        // The owner's Q2 (a): with the setting off, what its text names is listed and stands.
        if (!lock && (kind === "traits" || LOCK_NAMED_MAX.has(path))) listed.push({ path, kind });
        else back.push({ path, kind });
    }
    return { back, listed, flagged, change, calls, taken };
}

/*
 * ANY OTHER FIELD, FLAG OR EFFECT IS LISTED (E29 fix r1-G4, 05.10.2026; review round 1 sec m3 = cor
 * m9; the plan's 2.4, last row). A leaf of a player's write no judgement covers - not what a roll is
 * built from, not a GM-only or a marked flag, not a means or a Rest stamp (`meansFindings` judges
 * those) - goes into `sheetWrites` as `listed`: no card, nothing told, for a GM reading
 * `game.drpg.sheetWrites()`. One the mark keeps (an experience's words, a resource's other field) is
 * listed when it moved from the mark, with the mark's value before it; one it does not keep - the
 * module's other flags, Daggerheart's other fields - is listed as the write named it, and its row has
 * no before-value (`-`): the GMs hold no copy of it. Of a write over a whole part (G2) only what the
 * mark keeps below it is read. Until this fix all of these stood with no row: measured at fd7c61f
 * (05.10.2026, e29run/r1g4red) by tier 2 for the player's own flag (`ultimate`), a condition with no
 * changes taken off and an item that is not the module's taken off, and at ready for a condition taken
 * off and a module item renamed. The student's `effects` written through its update are no field of
 * it: each is judged as an effect (`parentEffects`, fix r2-H8); nor are its `items`, each judged as a
 * write of that item (`parentItems`, fix r2-H10).
 */
function otherField(path, was, now) {
    if (LEDGER_PATHS.has(path) || path === RESTS_PATH || path.startsWith(`${RESTS_PATH}.`)) return false;
    if (path === "effects" || path.startsWith("effects.") || path === "items" || path.startsWith("items.")) return false;
    const held = MARKED_PATHS.some(root => path === root || path.startsWith(`${root}.`));
    return !held || stableJson(was ?? null) !== stableJson(now ?? null);
}

/*
 * The leaves a student's update is judged on (G2): what it reaches (`reachOf`), each read as the
 * comparison at ready reads a sheet (`differing`) - every leaf under it, or under each root of the
 * mark below it, that the mark (`before`) and `src` hold differently. A path outside what the mark
 * keeps is judged as it is named. On a write of plain values the leaves are the paths it names.
 */
function judgedPaths(before, changes, src) {
    return [...new Set(reachOf(changes).flatMap(path => {
        const roots = MARKED_PATHS.filter(root => root.startsWith(`${path}.`));
        if (roots.length) return differing(before, src, roots);
        return MARKED_PATHS.some(root => path === root || path.startsWith(`${root}.`)) ? differing(before, src, [path]) : [path];
    }))];
}

/*
 * A STUDENT'S PUT-BACK, WRITTEN (G1). Each path put back goes to its mark only while the document
 * still holds it as the write left it (`was`): a path a later write moved is that write's to
 * judge. Written over regardless, a GM's statistic landed meanwhile is lost, and the mark - which
 * moves by what the GM's write named - ends at the GM's value with the document at the old one: 2
 * and 1 in tier 2's test of a busy queue, its last round, with this check taken out (05.10.2026,
 * e29run/r1g1m). The armed list loses the entries the write added
 * (`armedPutBack`), Hope is written as its judgement corrected it (`patch`, `meansFindings`); the
 * means are never put back as paths. Read when written, after the judgement's awaits, not when
 * judged. A put-back with nothing left to write writes nothing.
 */
function putBackNow(actor, mark, was, back, calls, patch = {}) {
    const src = actor._source ?? {};
    const paths = back.map(entry => entry.path).filter(path => path !== CALLS_PATH && !LEDGER_PATHS.has(path)
        && stableJson(foundry.utils.getProperty(src, path) ?? null) === stableJson(foundry.utils.getProperty(was, path) ?? null));
    const write = { ...putBackPatch(markAsDocument(mark), paths), ...patch };
    if (calls) write[CALLS_PATH] = armedPutBack(actor, calls);
    return Object.keys(write).length ? trustedWrite(actor, write, { reason: "auditPutBack" }) : Promise.resolve(null);
}

/* ---------------------------------------------------------------------------
 * The means: Hope, actions, marks and grants (C4)
 * ------------------------------------------------------------------------- */

/**
 * Whether a write names a path: a value at it or under it, v14's forced deletion of it (an operator
 * is a value here), or anything written over an ancestor of it - `system.resources` replaced whole
 * names Hope and Health (G2, `reachOf`).
 */
function names(changes, path) {
    return reachOf(changes).some(at => at === path || at.startsWith(`${path}.`) || path.startsWith(`${at}.`));
}

/**
 * actorId -> each means as the last write this GM heard left it: `{ value, own, before, n, moved, set }`,
 * `own` a put-back of the GMs' (`noteWrite` says what the others are).
 */
const heard = new Map();

/*
 * The means a write names, as the value the write before it left, in the order this GM heard
 * them - which is the order they landed. Kept as each hook runs, because the judge comes to a
 * write later, and by then the document may hold the writes after it. With each, what a Hope
 * correction keeps of the writes heard after its own (G1, `hopeLeft`): how many writes named it
 * (`n`), what the players' writes moved it by, each from the value the write before it left
 * (`moved`, summed), and the last value a GM wrote (`set`: its `n`, its value and `moved` then).
 * The GMs' own put-backs are none of these: each takes back a write the judge counted already.
 * A write tier 2 makes for a player (`AUDIT_ASIDE`) is a player's here, as its judge takes it.
 */
function noteWrite(actor, changes, options, userId) {
    if (actor?.type !== "character") return null;
    const held = heard.get(actor.id) ?? {};
    const gm = game.users?.get(userId ?? "")?.isGM === true && !options?.[AUDIT_ASIDE];
    const own = gm && options?.drpgWrite?.reason === "auditPutBack";
    const priors = {};
    for (const [key, { path }] of Object.entries(LEDGER)) {
        if (!names(changes, path)) continue;
        const value = Number(foundry.utils.getProperty(actor._source ?? {}, path)) || 0, last = held[key] ?? null;
        const n = (last?.n ?? 0) + 1, moved = (last?.moved ?? 0) + (gm || !last ? 0 : value - last.value);
        priors[key] = last;
        held[key] = { value, own, before: own ? last?.value ?? null : null, n, moved, set: gm && !own ? { n, value, moved } : last?.set ?? null };
    }
    heard.set(actor.id, held);
    return priors;
}

/*
 * What a write's judgement needs from the moment it was heard: every path it names as it left
 * them (`pathsSeen`, G1), the means and the Rest stamps among them (the document holds them as
 * the hook runs; a later write may have moved them by the time the judge reaches this one), the
 * item an item use names as it stood before its consumption landed, where this GM's hearing of
 * each means stood (`heard`, `hopeLeft`), the student's effects where the write reaches them
 * (`effects`, fix r2-H8: `parentEffects`), its items likewise (`items`, fix r2-H10: `parentItems`),
 * and when.
 */
function seenNow(actor, changes, options, priors) {
    const src = actor._source ?? {};
    const values = Object.fromEntries(Object.entries(LEDGER).filter(([, { path }]) => names(changes, path))
        .map(([key, { path }]) => [key, Number(foundry.utils.getProperty(src, path)) || 0]));
    const rests = names(changes, RESTS_PATH) ? clone(foundry.utils.getProperty(src, RESTS_PATH)) ?? null : undefined;
    const stamp = options?.drpgWrite;
    const item = stamp?.reason === "itemUse" && stamp.ref ? actor.items?.get(stamp.ref)?.toObject?.() ?? null : null;
    const then = Object.fromEntries(Object.keys(values).map(key => [key, heard.get(actor.id)?.[key] ?? null]));
    const effects = names(changes, "effects") ? effectsIn(src) : undefined;
    const items = names(changes, "items") ? itemsIn(actor) : undefined;
    return { at: Date.now(), paths: pathsSeen(src, changes), values, rests, item, priors, heard: then, effects, items };
}

/*
 * A GM's write: the GMs' value of each means it names, and what it spent added to the credit ("by
 * anyone", the plan's 2.5). An Undo (`auditUndo`, C5) adds none: it takes back a gain nothing paid
 * for, and as credit the same gain would stand again as the next refund.
 *
 * A GM'S REFUND TAKES WHAT IT GIVES BACK (E29 fix r1-G4, 05.10.2026; review round 1 cor M1). A gain a
 * GM writes with a reason of `REFUNDS` - a Reroll that did not stand (reroll.mjs `giveBack`), an
 * Objection's floor taken back (trial.mjs), a Call the bridge could not arm (gm-bridge.mjs), and since
 * fix r2-H6 what a Reroll's take-back gives back under its own name (`GIVE_BACK`, `judgeNow`) - takes
 * the credit its payment left, oldest first, as a player's refund does; it stands whatever the
 * credit holds, being a GM's. Until this fix the payment stayed in the credit after it was given
 * back, and a console's "refund" of the same amount stood on it: measured by the review's probe on
 * 69deef0 (a GM's 3 Hope paid and given back, then p1's 5 -> 8 stamped `refund`: 8 stood, no row), and
 * at fd7c61f (05.10.2026, e29run/r1g4red) by tier 2 - the 2 paid and given back still in the credit, the
 * player's 2 standing on it - and scenario 30's console (Hope 4 on every client, no row).
 *
 * A GIVE-BACK'S FALL PAYS FOR NOTHING (E29 fix r2-H8, 06.10.2026; fix r2-H6's open point, decided (a) by
 * the orchestrator). A Reroll's take-back that removes what the action gave - the Hope an item's use
 * gave in a crisis action, murder-rules.mjs `restoreResource` - carries `GIVE_BACK` (`giveBack`) and is a fall,
 * which added credit as any GM's fall does: a console's refund of the same Hope then stood on it, the
 * shape C5 closed for the Undo. It adds none now. Measured at 0d86603 (06.10.2026, e29run/r2h8red) by
 * tier 2: the 2 Hope taken back stayed in the credit and the player's refund of them stood (credit 2,
 * `stands`, Hope 2 up); after it 0, put back.
 */
function gmLedger(actor, seen, reason = null, giveBack = false) {
    const mark = sheetMarkStore.get(actor.id);
    if (!mark || !Object.keys(seen.values).length) return null;
    const values = ledgerOf(mark, actor), credit = creditOf(mark, seen.at);
    for (const [key, value] of Object.entries(seen.values)) {
        const spent = (value - values[key]) * LEDGER[key].cost;
        if (spent > 0 && reason !== "auditUndo" && !giveBack) (credit[key] ??= []).push({ n: spent, at: seen.at });
        if (spent < 0 && REFUNDS.has(reason)) takeCredit(credit, key, -spent);
        values[key] = value;
    }
    return { values, credit };
}

/*
 * A MEANS HELD WITHIN ITS BOUNDS: 0, and the maximum the GMs hold (E29 fix r2-H8, 06.10.2026; review
 * round 2 cor m1). The document's maximum is what Daggerheart prepares from the sheet's, which the write
 * being judged can raise - put back as `max`, but after this has read it: a rise of marks then banked
 * credit up to the raised maximum, and a gain covered by credit kept a value above the one put back.
 * So the sheet's maximum the write left is taken out of the document's and the mark's put in. Not the
 * mark's maximum alone, as the review proposed: Daggerheart adds the class's hit points and a level-up's
 * picks to the sheet's Health maximum, and the picks to Sanity's (character.mjs `prepareBaseData`, read
 * in 2.6.5 and 2.10.5) - the sheet's Health maximum is a bonus, 0 on a fresh sheet, and bounding by it
 * would hold every Health value at it. Hope's maximum is Daggerheart's world setting less scars,
 * whatever the sheet's maximum holds (`prepareBaseData`, `prepareDerivedData`, both versions): a write
 * of that maximum cannot raise it at a table; one of the scars can, and since E29 fix r2-H25 the scars
 * the write left are taken out and the mark's put in, as a sheet's maximum is. The harness prepares
 * nothing, so there a raised sheet's Hope maximum still raises the document's, which no table does,
 * and the scars move nothing (tier 2 prepares them as Daggerheart does, `preparedAs`). Measured at 0d86603
 * (06.10.2026, e29run/r2h8red) by tier 2: a player's write of Sanity's marks and maximum to 9, over
 * the GMs' 1 mark of 6, banked 8 marks of credit; after it 5.
 */
function bounded(actor, mark, key, n) {
    const max = LEDGER[key].path.startsWith("system.") ? maxHeld(actor, mark, key) : NaN;
    return Math.max(0, Number.isFinite(max) ? Math.min(max, n) : n);
}

/** A resource's maximum as the GMs hold it (`bounded`, `meansMaxHeld`): the document's, with the mark's sheet maximum for the one the write left - Hope's with the mark's scars, which it is less. */
function maxHeld(actor, mark, key) {
    const prepared = Number(actor.system?.resources?.[key]?.max);
    const [path, held, sign] = key === "hope" ? ["system.scars", mark?.scars, -1] : [`system.resources.${key}.max`, mark?.resources?.[key]?.max, 1];
    const sheet = foundry.utils.getProperty(actor._source ?? {}, path);
    return typeof sheet === "number" && typeof held === "number" ? prepared + sign * (held - sheet) : prepared;
}

/*
 * THE HOPE A JUDGEMENT LEAVES (E29 fix r1-G1, 05.10.2026; review round 1 cor M6). A player's write
 * judged behind others may find the document moved since its hook ran - a GM's Hope written
 * meanwhile, the player's next write. C4 wrote the GMs' value over it, which erased that write (a
 * GM's charge or award included) while its own judgement made it the mark: Hope 4 on every client
 * and 9 in the mark, the review's probe on 69deef0. So the GMs' value stands for this write
 * (`value`), and what was heard after it is laid on top: from the last value a GM wrote, where one
 * did, else from `value`, what the players' writes after that moved it by - each of those is
 * judged in its turn. Not below 0. The GMs' own put-backs are left out: each takes back what a
 * write the judge counted already added, which a later write built on it also carries. The fix
 * list's arithmetic - the document's Hope less this write's excess, `hopeNow - (seen - values)` -
 * counts that excess twice and reads a GM's Hope as a move: with it, tier 2's test of a busy
 * queue (05.10.2026, e29run/r1g1m) ended two forged Hopes at 0 with the GMs' 2 in the mark, and a
 * GM's 3 written behind a forged Hope at 0 with the GM's 3 in the mark.
 */
function hopeLeft(actor, seen, value) {
    const now = heard.get(actor.id)?.hope ?? null, then = seen.heard?.hope ?? { n: 0, moved: 0 };
    if (!now) return value;
    const set = now.set?.n > then.n ? now.set : null;
    return Math.max(0, set ? set.value + now.moved - set.moved : value + now.moved - then.moved);
}

/*
 * Each means a write names, as the move it made: from the value the write before it left
 * (`noteWrite`), or from the GMs' value where this GM heard none. A payment - a reason that only
 * spends Hope - that reads as a rise straight after a put-back of Hope was paid from the value the
 * put-back replaced, by a browser the put-back had not reached yet: it is measured from that one.
 * Without it a forged Hope spent at once on a Call cost nothing whenever the put-back landed
 * between the two. How often the two cross at a table is not measured, and no live check of AUDIT
 * section 9 counts it (the LIVE-E29-02 cited here until fix r2-H8 is the Party sheet's read-only check).
 */
function movesOf(seen, values, stamp) {
    return Object.fromEntries(Object.entries(seen.values).map(([key, value]) => {
        const prior = seen.priors?.[key] ?? null;
        let base = prior ? prior.value : values[key];
        if (key === "hope" && prior?.own && PAYMENTS.has(stamp.reason) && prior.before !== null && value > prior.value && value < prior.before) base = prior.before;
        return [key, { base, value, d: value - base }];
    }));
}

/**
 * A student's means in a player's write (the plan's 2.4, 2.5): each fall - each rise of marks -
 * stands and is credit; each gain stands as far as the write's reason covers it (`coverOf`). What
 * nothing covers in Hope is put back as a delta with `lockPlayerResources` on: the GMs' Hope moves
 * by what was covered only, and the document is written to it, with what was written after this
 * write laid on top (`hopeLeft`, G1) - so a forged Hope spent at once
 * still costs real Hope. What nothing covers of the others stands and is flagged (`gainVerdict`),
 * its change the part uncovered: from the value the cover allowed - what Undo writes back - to the
 * value written. A Rest stamp nothing covers is put back. A legal payment that crossed a put-back
 * brings the document to the GMs' Hope too (`fix`), without a word: the put-back was told already.
 * A gain its reason covered whole, and a Rest stamp its judge took, are what the write stood on
 * (`stood`): its row says so (`record`, G4).
 */
async function meansFindings(actor, mark, user, options, seen) {
    const stamp = options?.drpgWrite ?? {}, lock = locked();
    const out = { back: [], listed: [], flagged: [], stood: [], change: {}, patch: {}, covered: {}, ledger: null, fix: false };
    const restsMoved = seen.rests !== undefined && stableJson(seen.rests ?? null) !== stableJson(mark.flags?.[FLAGS.restsTaken] ?? null);
    if (!Object.keys(seen.values).length && !restsMoved) return out;
    const values = ledgerOf(mark, actor), credit = creditOf(mark, seen.at);
    const moves = movesOf(seen, values, stamp), gains = {};
    for (const [key, move] of Object.entries(moves)) {
        const spent = move.d * LEDGER[key].cost;
        if (spent < 0) {
            gains[key] = -spent;
            continue;
        }
        const next = bounded(actor, mark, key, values[key] + move.d), n = Math.abs(next - values[key]);
        if (n) (credit[key] ??= []).push({ n, at: seen.at });
        values[key] = next;
    }
    const judged = Object.keys(gains).length || restsMoved
        ? await coverOf(actor, mark, credit, gains, moves, stamp, user, seen) : { covers: {}, rest: false, taken: {} };
    for (const [key, gain] of Object.entries(gains)) {
        const covered = Math.min(gain, judged.covers[key] ?? 0), verdict = gainVerdict(key, lock);
        values[key] = bounded(actor, mark, key, values[key] - LEDGER[key].cost * (verdict === "back" ? covered : gain));
        const { path, kind, cost } = LEDGER[key];
        if (covered === gain) {
            out.stood.push({ path, kind });
            out.change[path] = [moves[key].base, moves[key].value];
            continue;
        }
        const from = verdict === "flagged" ? moves[key].value + (gain - covered) * cost : moves[key].base;
        out.change[path] = [from, moves[key].value];
        out[verdict].push({ path, kind });
    }
    if (restsMoved) {
        out[judged.rest ? "stood" : "back"].push({ path: RESTS_PATH, kind: "flag" });
        out.change[RESTS_PATH] = [clone(mark.flags?.[FLAGS.restsTaken]) ?? null, clone(seen.rests) ?? null];
    }
    // Hope as this judgement leaves it: the GMs' value, and what was written after this write (`hopeLeft`, G1).
    const hopeNow = Number(foundry.utils.getProperty(actor._source ?? {}, LEDGER.hope.path)) || 0;
    const hopeAfter = "hope" in seen.values ? hopeLeft(actor, seen, values.hope) : hopeNow;
    if (lock && hopeAfter !== hopeNow) {
        out.patch[LEDGER.hope.path] = hopeAfter;
        out.fix = true;
    }
    out.covered = judged.taken;
    out.ledger = { values, credit };
    return out;
}

/*
 * What becomes of a gain nothing covers (the plan's 2.4; the owner's Q2 (a), 05.10.2026): `back`,
 * `flagged` or `listed`. With `lockPlayerResources` on, Hope is put back and Health, Sanity and
 * actions are flagged; off, the fields its text names are listed and stand. The Burst and Sprint
 * grants are flags the setting does not name: flagged either way.
 */
function gainVerdict(key, lock) {
    if (LEDGER[key].kind === "grant") return "flagged";
    if (!lock) return "listed";
    return key === "hope" ? "back" : "flagged";
}

/** What a write's reason covers of its gains (the plan's 2.5's judges): `{ covers, rest, taken }`, `taken` the credit a refund took. */
async function coverOf(actor, mark, credit, gains, moves, stamp, user, seen) {
    const none = { covers: {}, rest: false, taken: {} };
    if (REFUNDS.has(stamp.reason)) {
        const covers = Object.fromEntries(Object.entries(gains).map(([key, gain]) => [key, takeCredit(credit, key, gain)]));
        return { covers, rest: false, taken: Object.fromEntries(Object.entries(covers).filter(([, n]) => n > 0)) };
    }
    if (stamp.reason === "rest") {
        const covers = await restCovers(actor, mark, credit, gains, moves, stamp.ref, seen);
        return covers ? { ...none, covers, rest: true } : none;
    }
    if (stamp.reason === "itemUse") return { ...none, covers: (await itemCovers(gains, stamp.ref, user, seen, mark)) ?? {} };
    if (stamp.reason === "call") return { ...none, covers: callCovers(credit, gains, stamp.ref) };
    return none;
}

/*
 * A Rest (the plan's 2.5): its stamp moves to the clock's for one kind and was not there; the room
 * the GM sees the character in allows that kind; its action was paid - an action, or a Burst, spent
 * and not yet taken back; each gain is within its pick (all marks for a long rest, half rounded up
 * for a short; Breath 2 or 1 Hope) and no more picks than the kind allows. A Relief's free rest
 * (`ref` "relief") moves no stamp and is paid by that Call's price instead of the room and the
 * action. Answers what it covers, or null - and then its stamp goes back too.
 */
async function restCovers(actor, mark, credit, gains, moves, ref, seen) {
    const { restStamp, roomAllows } = await import("./rest.mjs");
    const relief = ref === "relief";
    const was = mark.flags?.[FLAGS.restsTaken] ?? {}, now = seen.rests === undefined ? was : seen.rests ?? {};
    const moved = Object.keys({ ...was, ...now }).filter(key => was[key] !== now[key]);
    let kind = HOPE_CALLS.relief?.freeRest;
    if (relief ? moved.length : moved.length !== 1) return null;
    if (!relief) {
        kind = moved[0];
        if (!REST[kind] || now[kind] !== restStamp(kind, getClock())) return null;
        const { roomOfActor } = await import("./movement.mjs");
        if (!roomAllows(roomOfActor(actor), kind)) return null;
    }
    const rules = REST[kind];
    if (!rules) return null;
    const full = kind === "long";
    const marks = key => moves[key]?.base ?? 0;
    const allowed = { hope: full ? 2 : 1, hitPoints: full ? marks("hitPoints") : Math.ceil(marks("hitPoints") / 2),
        stress: full ? marks("stress") : Math.ceil(marks("stress") / 2) };
    const picked = Object.keys(gains);
    if (picked.length > rules.picks || picked.some(key => !(gains[key] <= (allowed[key] ?? 0)))) return null;
    const paid = relief ? takeAll(credit, "hope", HOPE_CALLS.relief.cost)
        : takeAll(credit, "actions", rules.actionCost) || takeAll(credit, "freeActionGrants", 1);
    return paid ? { ...gains } : null;
}

/*
 * An item used (the plan's 2.5): the item the write names - this student's, usable, not broken, not
 * stashed, of a tier with a row in `USABLE_EFFECTS` - each gain within that row (one of Health or
 * Sanity, Hope only where the row adds it), and its consumption (a count lowered, or broken) by the
 * same user within `JUDGE_WAIT_MS` of the write.
 *
 * READ AS THE GMS HOLD IT (E29 fix r2-H19, 06.10.2026). The fields this file judges (`ITEM_JUDGED`: the category,
 * tier, kind, break and place among them) are the mark's, as the writes heard before the use left it (`mark`, its
 * judgement's); the rest - the name, which a kind may be read from (fix r2-H8) - as the use's hook heard the item; an
 * item the mark holds no copy of is read without a category (`ITEM_UNHELD`), so it is no usable. Until this fix the
 * item was read whole as the hook heard it, where a write of the player's the audit puts back stands until its
 * put-back lands, or for good where it fails: at 68150ec (e29run/r2h19red) a tier-1 kit raised there to tier 3 covered
 * a use's 2 Hope and both Health marks, and a kind, a mend and a stash undone there each covered its use; in scenario
 * 30 p1's tier and at once the use left Hope 4 on every client, the use's row covered.
 */
async function itemCovers(gains, ref, user, seen, mark) {
    const src = seen.item;
    if (!src || src._id !== ref || !user) return null;
    const copy = mark?.items?.[ref] ?? null;
    const item = itemLike(copy ? withPaths(src, copy, ITEM_JUDGED) : withPaths(src, {}, ITEM_UNHELD));
    const { isUsable, tierOf, usableKindOf } = await import("./use-items.mjs");
    if (!isUsable(item) || isBroken(item) || isStashed(item)) return null;
    const effect = USABLE_EFFECTS[tierOf(item)];
    if (!effect || effect.creative) return null;
    const resource = USABLE_KINDS[usableKindOf(item)]?.resource;
    const healing = effect.choose ?? (resource ? [resource] : ["hitPoints", "stress"]);
    const allowed = { hope: effect.bonus?.hope ?? 0, ...Object.fromEntries(healing.map(key => [key, effect.amount])) };
    if (Object.keys(gains).filter(key => key !== "hope").length > 1 || Object.entries(gains).some(([key, gain]) => !(gain <= (allowed[key] ?? 0)))) return null;
    return await consumedBy(src._id, user.id, seen.at) ? { ...gains } : null;
}

/* A Call's grant (the plan's 2.5): a Burst's or a Sprint's count rises by what that Call banks, paid by its price in Hope spent and not taken back. */
function callCovers(credit, gains, ref) {
    const covers = {};
    for (const [key, field] of [["freeActionGrants", "freeActions"], ["freeMoveGrants", "freeMoves"]]) {
        const gain = gains[key];
        const call = gain ? Object.entries(HOPE_CALLS).find(([id, def]) => (!ref || id === ref) && def[field] === gain)?.[1] : null;
        if (call && takeAll(credit, "hope", call.cost)) covers[key] = gain;
    }
    return covers;
}

/** Each module item's consumption this GM heard, `{ itemId, userId, at }`, oldest first, kept half a minute. */
const consumptions = [];
const consumptionWaiters = new Set();

/** Resolves true once that user's consumption of that item, heard within `JUDGE_WAIT_MS` of `from`, is matched (once). */
function consumedBy(itemId, userId, from) {
    const match = () => {
        const at = consumptions.findIndex(c => c.itemId === itemId && c.userId === userId && c.at >= from && c.at <= from + JUDGE_WAIT_MS);
        if (at >= 0) consumptions.splice(at, 1);
        return at >= 0;
    };
    if (match()) return Promise.resolve(true);
    return new Promise(resolve => {
        const done = found => { clearTimeout(timer); consumptionWaiters.delete(waiter); resolve(found); };
        const waiter = () => { if (match()) done(true); };
        const timer = setTimeout(() => done(match()), Math.max(0, from + JUDGE_WAIT_MS - Date.now()));
        consumptionWaiters.add(waiter);
    });
}

/**
 * WHAT A GM'S HOOK HEARS OF AN ITEM (exported for tier 2, as `onSheetWrite`): on the primary, a
 * write that leaves a module item of a character with a smaller count than the GMs' copy of it, or
 * broken where that copy is whole, is a consumption the item-use judge waits for. The write itself
 * is judged as any other (`itemFindings`, C6).
 *
 * WHAT THE GMS HELD, NOT WHAT THE WRITE NAMED (E29 fix r1-G4, 05.10.2026; review round 1 cor M2).
 * The item is read as the hook saw it, against the mark's copy - the judge's own reading of a count
 * or a break that stands (`itemFindings`). Until this fix every write naming the count was one, a
 * rise included, which the judge then put back: measured by the review's probe on 69deef0, a
 * console's use of a tier-3 kit (Hope 2 -> 4, both Health marks healed) followed by its count raised
 * 1 -> 2 kept the Hope and the Health, and the kit was whole again - again and again; so did tier 2's
 * and scenario 30's at fd7c61f (05.10.2026, e29run/r1g4red): Hope 4 and both marks stood, and the only
 * row was the count's put-back. The mark is as the judged writes left it: a GM's write of the count
 * still queued when the use's consumption lands is not in it yet (read, not measured at a table).
 */
export function onItemWrite(item, changes, options, userId, { primary = isPrimaryGm() } = {}) {
    if (!primary || item?.parent?.type !== "character") return;
    const held = sheetMarkStore.get(item.parent.id)?.items?.[item.id];
    if (!held) return;
    const now = docData(item), count = data => Number(data?.system?.quantity ?? 1);
    if (!(count(now) < count(held)) && !(isBroken(itemLike(now)) && !isBroken(itemLike(held)))) return;
    const at = Date.now();
    consumptions.push({ itemId: item.id, userId, at });
    while (consumptions.length && consumptions[0].at < at - 30_000) consumptions.shift();
    for (const waiter of [...consumptionWaiters]) waiter();
}

/** The Daggerheart rolls whose gain a relay write was covered by, on this GM (a reload forgets them - their `covered` rows do not, fix r1-G1; each covers for a minute). */
const rollsCounted = new Set();

/** The latest Daggerheart roll that covers `need`: that user's, about that student, recent, not drawn, not a reaction, not counted - here or by a row. */
function rollCovering(actor, sender, need) {
    const since = Date.now() - ROLL_COVER_MS, messages = game.messages?.contents ?? [];
    // A roll a `covered` row names covered a gain already: here, or on the primary before a reload or a change of primary (fix r1-G1).
    const named = new Set(Object.values(sheetWriteStore.entries() ?? {}).filter(row => row?.verdict === "covered" && row.kind === "rollGain" && row.ref).map(row => row.ref));
    for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        if ((message.timestamp ?? 0) < since || rollsCounted.has(message.id) || named.has(message.id)) continue;
        if (message.author?.id !== sender.id || message.speaker?.actor !== actor.id) continue;
        // A player's message carrying a flag only a GM's browser writes covers nothing (E33 C5a, `onForgedCard`).
        if (message.getFlag?.(MODULE_ID, "drawn") || forgedFlagsOf(message).length || message.rolls?.[0]?.options?.actionType === "reaction") continue;
        const duality = readDuality(message);
        if (!duality) continue;
        const gives = { hope: duality.isCritical ? CRITICAL.hope : duality.withHope ? 1 : 0, stress: duality.isCritical && CRITICAL.clearsStress ? 1 : 0 };
        if (Object.entries(need).every(([key, n]) => n <= (gives[key] ?? 0))) return message;
    }
    return null;
}

/**
 * WHAT THE RELAY ASKS (the plan's 2.7; relay-guard.mjs `actorRefusal`), on the primary, of a
 * write Daggerheart sends for a player on their own student: Hope or actions may fall and marks
 * rise; a gain, measured from the GMs' value, stands only as far as a Daggerheart roll covers it -
 * a duality roll that user wrote about that student in the last `ROLL_COVER_MS`, with Hope or a
 * critical (`CRITICAL`'s Hope), not drawn by the GM, not a reaction, not counted before. Answers
 * why not, or null; a gain a roll covers leaves a `covered` row naming the roll (`keepGainRow`).
 * With `lockPlayerResources` off, null (the owner's Q2 (a)).
 */
export function relayGainRefusal(actor, flat, sender) {
    if (actor?.type !== "character" || !sender || sender.isGM || !locked()) return null;
    const mark = sheetMarkStore.get(actor.id);
    if (!mark || mark.flags?.[FLAGS.monokuma]) return null;
    const values = ledgerOf(mark, actor), need = {};
    for (const [key, { path, cost }] of Object.entries(LEDGER)) {
        const gain = path in flat ? (values[key] - Number(flat[path])) * cost : 0;
        if (gain > 0) need[key] = gain;
    }
    if (!Object.keys(need).length) return null;
    const roll = rollCovering(actor, sender, need);
    if (!roll) return `${Object.keys(need).join(", ")} raised on ${actor.name} with no roll of theirs to give it`;
    rollsCounted.add(roll.id);
    void keepGainRow(actor, sender, roll, flat, values, need);
    return null;
}

/**
 * THE GAIN'S ROW (E33 fix r1-G1, 07.10.2026; review round 1's sec m5 = cor M5; E29's plan 2.5 and 2.8,
 * "a write that stood on credit or a judge has a covered row"). A `covered` row of the gain a roll
 * gave: the sender, the student, each gained path from the GMs' value to the one asked, `ref` the
 * roll's message, `kind` `rollGain` - so the GMs can read which roll covered it, and so "a roll
 * covers once" outlives this browser's memory of it (`rollsCounted`): `rollCovering` skips a roll a
 * row names, after a reload or a change of primary too. Nothing is said: the row is the GMs' to read,
 * as a Rest's is (`record`). Until this fix the gain left no row: 83's L10 and F4b read none at
 * c618bf9 (e33run/c5b-a1/it2.log). On the primary, whose store it is.
 */
function keepGainRow(actor, sender, roll, flat, values, need) {
    if (!isPrimaryGm()) return Promise.resolve();
    const at = Date.now();
    const change = Object.fromEntries(Object.keys(need).map(key => [LEDGER[key].path, [values[key], Number(flat[LEDGER[key].path])]]));
    return keepRows({ [foundry.utils.randomID()]: { actorId: actor.id, itemId: null, userId: sender.id, reason: null, ref: roll.id, change, covered: null,
        verdict: "covered", kind: "rollGain", messageId: null, decided: null, at } }, at)
        .catch(err => error("Could not keep the GMs' row of the gain a roll covered", err));
}

/** The rolls a write's taking of the GMs' armed Calls stood on, on this GM (`callsCover`; a reload forgets them). */
const callRolls = new Set();
/** messageId -> when this GM heard a player's message, by its own clock, kept `ROLL_COVER_MS` (`onRollHeard`). */
const rollsHeard = new Map();
/** The judgements waiting for a roll (`callsCover`), woken by every message heard. */
const rollWaiters = new Set();

/** When this GM heard a message, or - one from before it loaded, or older than it keeps - the message's own time. */
const heardAt = message => rollsHeard.get(message.id) ?? (Number(message.timestamp) || 0);

/*
 * THE ROLL A CALL TAKEN OFF STANDS ON (E29 fix r2-H7, 06.10.2026; see `gmsCall`). The newest duality
 * roll heard after the earliest of the GMs' entries a write took (`taken`) was armed, by its writer
 * (with none known - the comparison at ready - by a player who owns the student), about that
 * student, not drawn by a GM (its Calls are the GM's to spend), and not counted for another write's:
 * counted for this one. A live write waits for it up to `JUDGE_WAIT_MS` from when it was heard
 * (`from`), as an item used waits for its consumption: a roll window spends its Calls as it closes
 * (roll-dialog.mjs `onCloseApplication`), before Daggerheart throws the roll and writes its card
 * (dhRoll.mjs `build`, read in 2.10.5), while the module's own roll spends them after its card
 * (action-rolls.mjs `throwDice`); live, the roll is one of the last `ROLL_COVER_MS`. How long a
 * table's card takes after the window closes is not measured here - the harness's roll windows are
 * stand-ins that throw nothing (LIVE-E29 candidate). Answers the message, or null.
 */
function callsCover(actor, user, taken, from = null) {
    const earliest = Math.min(...taken.map(entry => Number(entry.at) || 0));
    const find = () => {
        const messages = game.messages?.contents ?? [];
        for (let i = messages.length - 1; i >= 0; i--) {
            const message = messages[i], at = heardAt(message);
            if (callRolls.has(message.id) || !(at > earliest) || (from !== null && at < from - ROLL_COVER_MS)) continue;
            if (message.speaker?.actor !== actor.id || message.getFlag?.(MODULE_ID, "drawn")) continue;
            const author = message.author;
            if (!author || author.isGM || (user ? author.id !== user.id : !actor.testUserPermission?.(author, "OWNER"))) continue;
            if (!readDuality(message)) continue;
            callRolls.add(message.id);
            return message;
        }
        return null;
    };
    const found = find();
    if (found || from === null) return Promise.resolve(found);
    return new Promise(resolve => {
        const done = roll => { clearTimeout(timer); rollWaiters.delete(waiter); resolve(roll); };
        const waiter = () => { const roll = find(); if (roll) done(roll); };
        const timer = setTimeout(() => done(find()), Math.max(0, from + JUDGE_WAIT_MS - Date.now()));
        rollWaiters.add(waiter);
    });
}

/**
 * The GMs' entries a write took (`read.taken`, `actorFindings`), judged on the roll that covers them
 * (`callsCover`): each armed before the roll stood on it - a `covered` row naming the roll - and the
 * rest are put back with the ones the write added (`calls.taken`, `keptCalls`), with a row.
 */
function callsOwed(read, roll) {
    const rolled = roll ? heardAt(roll) : -Infinity;
    const owed = read.taken.filter(entry => !((Number(entry.at) || 0) < rolled));
    const out = { ...read, stood: owed.length < read.taken.length ? [{ path: CALLS_PATH, kind: "pendingCall" }] : [],
        roll: owed.length < read.taken.length ? roll.id : null };
    if (!owed.length) return out;
    return { ...out, calls: { added: read.calls?.added ?? new Set(), taken: owed },
        back: read.calls ? read.back : [...read.back, { path: CALLS_PATH, kind: "pendingCall" }] };
}

/** A message the primary hears: when, for `callsCover`, and every judgement waiting on a roll woken. A GM's is no player's roll. */
function onRollHeard(message) {
    if (!isPrimaryGm() || !message?.id || message.author?.isGM) return;
    const at = Date.now();
    rollsHeard.set(message.id, at);
    for (const [id, when] of rollsHeard) {
        if (when >= at - ROLL_COVER_MS) break;
        rollsHeard.delete(id);
    }
    for (const waiter of [...rollWaiters]) waiter();
}

/* ---------------------------------------------------------------------------
 * The module's items (C6)
 * ------------------------------------------------------------------------- */

/** The module flag an item's path writes (`flags.<module>.broken.at` is `broken`'s, `-=wear` is `wear`'s), or null. */
function itemFlagOf(path) {
    const prefix = `flags.${MODULE_ID}.`;
    return path.startsWith(prefix) ? path.slice(prefix.length).split(".")[0].replace(/^-=/, "") : null;
}

/*
 * The paths of an item's update this file judges (`ITEM_JUDGED`; a class's hit points on a class), as
 * far as the write reaches (`reachOf`, G2): a path under one of them is that one's, and a path over
 * them - `flags.<module>` or `system` replaced whole - is each of them below it.
 */
function itemPathsOf(changes, data) {
    const judged = isClassItem(data) ? [...ITEM_JUDGED, CLASS_HIT_POINTS] : ITEM_JUDGED;
    return [...new Set(reachOf(changes).flatMap(path =>
        judged.filter(each => each === path || each.startsWith(`${path}.`) || path.startsWith(`${each}.`))))];
}

/** The paths of an item's update no judgement of an item reads (`itemPathsOf`), its effects aside (G3): listed (G4). */
function otherItemPaths(changes, data) {
    const judged = isClassItem(data) ? [...ITEM_JUDGED, CLASS_HIT_POINTS] : ITEM_JUDGED;
    return reachOf(changes).filter(path => path !== "effects" && !path.startsWith("effects.")
        && !judged.some(each => each === path || each.startsWith(`${path}.`) || path.startsWith(`${each}.`)));
}

/** An item's data with `paths` as they were in `before` (absent where they were absent). */
function withPaths(data, before, paths) {
    const out = clone(data);
    for (const path of paths) {
        const value = foundry.utils.getProperty(before, path);
        if (value !== undefined) {
            foundry.utils.setProperty(out, path, clone(value));
            continue;
        }
        const parts = path.split("."), key = parts.pop(), parent = foundry.utils.getProperty(out, parts.join("."));
        if (parent && typeof parent === "object") delete parent[key];
    }
    return out;
}

/*
 * A WRITE ON AN ITEM OF A STUDENT (the plan's 2.6), answered as `updateFindings` answers, with
 * the items the mark holds after it (`items`) and their effects (`itemEffects`, G3), the item's id
 * for the row, a deleted item's data for an Undo (`data`, with the effects held on it) and a
 * Search's finds (`finds`). A row names the item itself as `items.<id>` and a field of it as
 * `items.<id>.<path>`. A module item is judged against its copy in the mark; an item the GMs hold
 * no copy of is not the module's, and only a category written onto it - which would make it one -
 * is put back, and since fix r2-H19 a bedroom key's room (`ITEM_UNHELD`). Any item made with an
 * effect that counts (`carriedEffects`, G3) is put back whole.
 * Any other field of an item, and an item the GMs hold no copy of taken off the sheet - with the
 * effects it took with it named in its row - is listed; a Search's find is what its write stood
 * on (`stood`, G4). An item's effects are judged as their own, never as a field of the item -
 * those its update wrote too (`parentEffects`, fix r2-H8).
 */
async function itemFindings(kind, item, actor, mark, changes, user, options, seen) {
    const id = item.id, held = mark.items?.[id] ?? null, now = seen?.item ?? null, stamp = options?.drpgWrite ?? {};
    const whole = `items.${id}`;
    const out = { back: [], listed: [], flagged: [], change: {}, itemId: id, ...itemMoves(kind, mark, item, now), undo: async () => null };
    out.itemEffects ??= clone(mark.itemEffects ?? {});
    if (kind === "deleteItem") {
        if (!held) {
            const effects = Object.entries(mark.itemEffects?.[id] ?? {}).map(([eid, effect]) => [effectPath(id, eid), effect]);
            out.listed.push({ path: whole, kind: "itemDeleted" }, ...effects.map(([path]) => ({ path, kind: "effect" })));
            out.change = { [whole]: [item.name ?? null, null], ...Object.fromEntries(effects.map(([path, effect]) => [path, [effectSummary(effect), null]])) };
            return out;
        }
        if (stamp.reason === "discard" && isBroken(itemLike(held))) return out;
        out.flagged.push({ path: whole, kind: "itemDeleted" });
        out.change[whole] = [held.name ?? null, null];
        out.data = wholeItem(mark, id);
        return out;
    }
    const carried = kind === "createItem" ? carriedEffects(id, now) : null;
    if (carried) {
        return { ...out, ...carried, items: itemsAfter(mark, item, null), itemEffects: itemEffectsAfter(mark, id, null),
            undo: async () => actor.items?.get(id) ? trustedDelete(actor.items.get(id), { reason: "auditPutBack" }) : null };
    }
    if (kind === "createItem") {
        const finds = now ? await searchFind(actor, mark, now, stamp, user) : null;
        if (finds) return { ...out, finds, stood: [{ path: whole, kind: "itemCreated" }], change: { [whole]: [null, now.name ?? item.name ?? null] } };
        out.flagged.push({ path: whole, kind: "itemCreated" });
        out.change[whole] = [null, now?.name ?? item.name ?? null];
        return out;
    }
    if (!now) return out;
    const before = held ?? withPaths(now, {}, ITEM_UNHELD);
    const moved = itemPathsOf(changes, held ?? now).filter(path => (held || ITEM_UNHELD.includes(path))
        && stableJson(foundry.utils.getProperty(before, path) ?? null) !== stableJson(foundry.utils.getProperty(now, path) ?? null));
    const back = [];
    for (const path of moved) {
        const flag = itemFlagOf(path), was = foundry.utils.getProperty(before, path), is = foundry.utils.getProperty(now, path);
        if (ITEM_PLACE.includes(flag)) continue;
        // The ways a use, a break and wear spend an item: broken (or broken again), worn further, fewer left.
        if (flag === ITEM_FLAGS.broken && is) continue;
        if (flag === ITEM_FLAGS.wear && Number(is ?? 0) > Number(was ?? 0)) continue;
        if (path === "system.quantity" && Number(is) < Number(was)) continue;
        back.push({ path, kind: path === "system.quantity" ? "itemQuantity" : path === CLASS_HIT_POINTS ? "max" : "itemFlag" });
    }
    if (moved.some(path => ITEM_PLACE.includes(itemFlagOf(path))) && !await placeStands(actor, item, before, now)) {
        back.push(...moved.filter(path => ITEM_PLACE.includes(itemFlagOf(path))).map(path => ({ path, kind: "itemLocation" })));
    }
    for (const path of otherItemPaths(changes, held ?? now)) {
        const was = held ? foundry.utils.getProperty(held, path) : undefined, is = foundry.utils.getProperty(now, path);
        if (held && stableJson(was ?? null) === stableJson(is ?? null)) continue;
        out.listed.push({ path: `${whole}.${path}`, kind: "other" });
        out.change[`${whole}.${path}`] = [clone(was) ?? null, clone(is) ?? null];
    }
    // The effects it wrote (fix r2-H8): each judged as one on the student, the ones that stand into the mark - each it named by
    // its id by what its entry reached (fix r2-H15), every one as the hook saw it where the student's list was written whole.
    const effects = names(changes, "effects") ? parentEffects(item, id, mark, effectsIn(now), seen?.whole ? null : entriesNamed(changes, "effects")) : null;
    if (effects) {
        out.listed.push(...effects.listed);
        Object.assign(out.change, effects.change);
        for (const each of effects.stood) setEffect(out, id, each.id, each.data);
    }
    const undos = [...(effects?.undos ?? [])], paths = back.map(entry => entry.path);
    // The mark takes the paths the write reached as its hook saw them, less what is put back (fix r2-H15); an item it holds no
    // copy of, whole, its category and key put back.
    out.items = itemsAfter(mark, item, withPaths(reached(held, now, changes), before, paths));
    if (back.length) {
        for (const path of paths) out.change[`${whole}.${path}`] = [clone(foundry.utils.getProperty(before, path)) ?? null, clone(foundry.utils.getProperty(now, path)) ?? null];
        /*
         * READ WHEN WRITTEN (E29 fix r2-H16, 06.10.2026; found by fix r2-H15): only the paths the item still holds as
         * the write left them (`now`), as a student's put-back (`putBackNow`) and an effect's (`effectFindings`) - a
         * path a later write moved is that write's to judge - and nothing on an item no longer on the student. Until
         * this fix the put-back was built in the judgement and written regardless: at c5ac507 a GM's count written as
         * the GM's hook heard p2's console raise a Tool's 1 to 3 was overwritten on every client by the put-back's 1,
         * the mark at the GM's 2, and p2's raise at once lowered to 0 ended at 1 on every client, the mark at 0
         * (scenario 30's `count` and `lowered`, e29run/r2h16red). The item gone is by reading: the harness skips a
         * write of an embedded document that is not there, so no scenario tells the two apart, and what Foundry does
         * with one is not measured.
         */
        undos.unshift(() => {
            const live = actor.items?.get(id) ?? null, src = live ? docData(live) : null;
            const still = src ? paths.filter(path => stableJson(foundry.utils.getProperty(src, path) ?? null) === stableJson(foundry.utils.getProperty(now, path) ?? null)) : [];
            return still.length ? trustedWrite(live, putBackPatch(before, still), { reason: "auditPutBack" }) : null;
        });
    }
    out.back = [...back.map(entry => ({ ...entry, path: `${whole}.${entry.path}` })), ...(effects?.back ?? [])];
    if (undos.length) out.undo = async () => {
        for (const undo of undos) await undo();
    };
    return out;
}

/*
 * A STASH OR A RETRIEVE (the plan's 2.6), read on this GM. The student stands in a room with a
 * stash of theirs (vault.mjs `myStashHere`, as `stow` and `retrieve` ask it on the player's
 * browser); a thing put away goes into that room's stash, is no Truth Bullet, and the stash holds
 * fewer than `VAULT_LIMIT` besides it; a thing taken out comes from that room's stash, and the carry
 * cap has room for it besides. Which stash an item is in is read as `stashRoomOfItem` reads it (an
 * unaddressed one is in the primary). A move from one stash to another is no road of the module's.
 */
async function placeStands(actor, item, before, now) {
    const V = await import("./vault.mjs");
    const stashOf = data => isStashed(itemLike(data)) ? V.stashRoomOfItem(itemLike(data), actor) : null;
    const was = stashOf(before), is = stashOf(now);
    if (was === is) return true;
    const room = await V.myStashHere(actor);
    if (!room) return false;
    const category = foundry.utils.getProperty(now, `flags.${MODULE_ID}.${ITEM_FLAGS.category}`);
    if (is !== null) {
        return was === null && is === room && category !== "truthBullet"
            && V.stashItemsIn(actor, room).filter(other => other.id !== item.id).length < VAULT_LIMIT;
    }
    if (was !== room) return false;
    const cap = canCarry(actor, category);
    return cap.limit === null || cap.held - (isStashed(item) ? 0 : 1) < cap.limit;
}

/*
 * A SEARCH'S FIND (the plan's 2.6): an item created `searchFind`, its `ref` the GMs' record of a
 * Search (roll-draw.mjs `rollRecord`; action-rolls.mjs `grantDrawn` names it) of this student by
 * this player that hit, not used for a find before, and the item's tier at most what the record's
 * total - with the hidden stash's step the GM drew - earns on the Search's table (action-rolls.mjs
 * `searchTier`, the reading the Search itself makes). Answers the student's finds with this one in
 * them, or null. A find whose record is swept is forgotten with it: a record past a Reroll's reach
 * names no find any more.
 *
 * NOT A SEARCH THAT ENDED WITHOUT A DRAW (round 1's m6, 05.10.2026). A hit asked of the GM ("something
 * specific", action-rolls.mjs `searchSpecific`) or taken from a stash (`searchStash`) creates nothing
 * through `grantDrawn`, so its record stayed unused and a console's item named after it stood - a
 * second item for one Search. The record now keeps the Search's goal as the roller sent it (roll-draw.mjs
 * `CONTEXT_SENT`, the roller's word like the category beside it), and a stash's theft settles the
 * record's "search" (bridge-guards.mjs `rollsFor`); a find on either is refused. The other way round,
 * a theft named after a record a find already stood on is refused by gm-bridge.mjs `searchTheftOf`.
 *
 * NOR A SEARCH WHOSE TOKEN THE GM NEVER SPENT (E29 fix r2-H11, 06.10.2026). A Search spends its
 * room's token after its roll, and a refused spend settles the record (search-tokens.mjs
 * `settleUnclaimed`, fix r2-H9) - but a console that drew a Search and never asked for the token
 * left the record as the draw wrote it, and a find named after it stood (red at 3654512, the tier-2
 * test "a find named after a Search whose token was never spent"). A spend that succeeds marks the
 * record (`tokenSpentAt`, search-tokens.mjs `SearchTokens.markSpent`); a record without that mark
 * takes no find.
 */
async function searchFind(actor, mark, data, stamp, user) {
    if (stamp.reason !== "searchFind" || typeof stamp.ref !== "string" || !user || !isModuleItem(data)) return null;
    const { rollRecord } = await import("./roll-draw.mjs");
    const record = rollRecord(stamp.ref);
    if (record?.actorId !== actor.id || record.userId !== user.id || record.actionKey !== "search" || mark.finds?.[stamp.ref]) return null;
    if (!record.tokenSpentAt) return null;
    if (record.goal === "specific" || (Array.isArray(record.resolved) && record.resolved.includes("search"))) return null;
    const { searchTier } = await import("./action-rolls.mjs");
    const { hit, tier } = searchTier({ total: record.total, isCritical: record.isCritical }, record.used?.stash?.change ?? 0);
    const found = foundry.utils.getProperty(data, `flags.${MODULE_ID}.${ITEM_FLAGS.tier}`);
    if ((!hit && !record.isCritical) || !Number.isInteger(found) || found > tier) return null;
    const kept = Object.entries(mark.finds ?? {}).filter(([rollId]) => rollStore.has(rollId));
    return { ...Object.fromEntries(kept), [stamp.ref]: data._id };
}

/*
 * An effect created, changed or deleted on a student or on one of its items (G3), as its hook saw it
 * (`now`; G1): put back when it changes what the GMs hold (`touchesHeld`), before or after. One that
 * stands moves the mark (`moves`) - made, whole; changed, by the paths the write reached (`reached`,
 * fix r2-H15); one put back leaves the mark's copy as it was. Each put-back writes
 * only what is still as the write left it, as a student's does (`putBackNow`): an effect a later write
 * deleted, made again or changed is that write's, and so is one whose item is gone since. Any other
 * effect made, changed or taken off - a Daggerheart condition, one an item does not transfer - is
 * listed, as it was and as it is (G4, `otherField`).
 */
function effectFindings(kind, effect, mark, changes, now) {
    const item = itemOf(effect), host = effect.parent, id = effect.id, itemId = item?.id ?? null;
    const held = effectHeld(mark, itemId, id);
    const counts = data => touchesHeld(data, { onItem: Boolean(item) });
    const path = effectPath(itemId, id);
    const standing = () => !item || Boolean(item.parent?.items?.get(itemId));
    const there = () => standing() ? host?.effects?.get(id) ?? null : null;
    const taken = kind === "updateActiveEffect" ? reached(held, now, changes) : now;
    const none = { back: [], listed: [], change: {}, itemId, moves: { effect: { id, itemId, data: taken } }, undo: async () => null };
    const back = (change, undo) => ({ back: [{ path, kind: "effect" }], listed: [], change: { [path]: change }, itemId, moves: {}, undo });
    const takeOff = async () => there() ? trustedDelete(there(), { reason: "auditPutBack" }) : null;
    const listed = (was, is) => ({ ...none, listed: [{ path, kind: "effect" }], change: { [path]: [effectSummary(was), effectSummary(is)] } });
    if (kind === "createActiveEffect") return counts(now) ? back([null, effectSummary(now)], takeOff) : listed(null, now);
    if (kind === "deleteActiveEffect") {
        if (!counts(held)) return listed(held ?? { name: effect.name ?? null }, null);
        return back([effectSummary(held), null], async () => there() || !standing() ? null
            : trustedCreate(host, [held], { reason: "auditPutBack", documentName: "ActiveEffect", keepId: true }));
    }
    if (!counts(held) && !counts(now)) return stableJson(held) === stableJson(now) ? none : listed(held, now);
    // Changed into one that counts with no mark of what it was: taken off whole.
    if (!held) return back([null, effectSummary(now)], takeOff);
    const differs = (a, b, p) => stableJson(foundry.utils.getProperty(a, p) ?? null) !== stableJson(foundry.utils.getProperty(b, p) ?? null);
    const paths = pathsOf(changes).filter(p => differs(held, now, p));
    if (!paths.length) return none;
    return back([effectSummary(held), effectSummary(now)], async () => {
        const live = there(), still = live ? paths.filter(p => !differs(docData(live), now, p)) : [];
        return still.length ? trustedWrite(live, putBackPatch(held, still), { reason: "auditPutBack" }) : null;
    });
}

/*
 * AN EFFECT WRITTEN THROUGH ITS PARENT (E29 fix r2-H8, 06.10.2026; review round 2 cor M5). A student's
 * or an item's update can carry its `effects`: each changed where it is, named by its id, or the whole
 * list replaced (v14's forced replacement), which makes and deletes them. The harness fires no effect
 * hook for such a write, only the parent's (measured by the fix's probe at 0d86603, e29run/scratch/
 * r2h8-probe: `updateActor`, `updateItem`); whether Foundry v14 does is not measured - its source is not
 * on this machine, and it is recalled as the same. So the effects as the parent's hook saw them (`now`,
 * by id) are compared with the mark's, and each that differs is judged as `effectFindings` judges one
 * written on its own - made, changed or deleted - and put back through its own document (`undos`); one
 * that stands goes into the mark (`stood`). Until this fix a student's were one field, listed
 * (`otherField`), and an item's were read by nothing (`otherItemPaths`): in the probe a +5 to every roll
 * written over a GM's penalty by p1's console stood on Aiko with a listed row, and on her Tool with none.
 * Were Foundry to fire the effect's own hook as well, the later of the two judgements (`inOrder`) would
 * write nothing - a put-back writes only what still stands as the write left it - and add a second row.
 * One that stands moves the mark by what the write reached (fix r2-H15): each the write named by its id
 * (`named`: id -> what its entry wrote) by what its entry reached, none it did not name; the list written
 * whole, each as the hook saw it.
 */
function parentEffects(host, itemId, mark, now, named = null) {
    const held = (itemId ? mark.itemEffects?.[itemId] : mark.effects) ?? {};
    const out = { back: [], listed: [], change: {}, undos: [], stood: [] };
    for (const id of new Set([...Object.keys(held), ...Object.keys(now)])) {
        const was = held[id] ?? null, is = now[id] ?? null;
        if (stableJson(was) === stableJson(is)) continue;
        const kind = !is ? "deleteActiveEffect" : was ? "updateActiveEffect" : "createActiveEffect";
        const one = effectFindings(kind, host.effects?.get(id) ?? { id, parent: host }, mark, was && is ? bothPaths(was, is) : {}, is);
        out.back.push(...one.back);
        out.listed.push(...one.listed);
        Object.assign(out.change, one.change);
        if (one.back.length) out.undos.push(one.undo);
        else if (!named) out.stood.push({ id, itemId, data: is });
        else if (named.has(id) && is) out.stood.push({ id, itemId, data: reached(was, is, named.get(id)) });
    }
    return out;
}

/**
 * A GM's write of a student's effects through its update (r2-H8): each it named by its id, by what its entry reached (fix r2-H15),
 * or - the list written whole - every one that differs from the mark's, as the hook saw it, is the mark's.
 */
const effectMoves = (held = {}, now = {}, named = null) => named
    ? [...named.keys()].filter(id => now[id]).map(id => ({ id, itemId: null, data: reached(held[id] ?? null, now[id], named.get(id)) }))
    : [...new Set([...Object.keys(held), ...Object.keys(now)])]
        .filter(id => stableJson(held[id] ?? null) !== stableJson(now[id] ?? null)).map(id => ({ id, itemId: null, data: now[id] ?? null }));

/*
 * AN ITEM WRITTEN THROUGH ITS STUDENT (E29 fix r2-H10, 06.10.2026; found by fix r2-H8's probe). A student's
 * update can carry its `items` as it can its effects: each changed where it is, named by its id, or the whole
 * list replaced (v14's forced replacement), which makes and deletes them. The harness fires no item hook for
 * such a write, only `updateActor` (the probe's P3); Foundry v14 is not measured, as for the effects - were it
 * to fire the item's own hook as well, each item would be judged twice (by reading: a second row and a second
 * word to the player, the second put-back writing what the first did). So each item the write reaches is judged
 * as a write of the item itself (`itemFindings`, the plan's 2.6), on the item as the student's hook saw it
 * (`seen.items`): one named by its id as that item's update, on what its entry wrote - a protected flag or a
 * count raised put back through the item's own document, a name or a picture listed; with the list written
 * whole, each item against what the GMs hold, as the comparison at ready reads them - a module item or a class
 * changed as its update, one new to them as its creation; any other item by its effects alone, the one part of
 * it they hold. One the GMs hold gone from the student is its deletion, whichever way it was written (in the
 * harness only the whole list loses one). Each has rows of its own, naming its item (`record`); what stands
 * goes into the mark, and a GM's such write is the mark's (`itemsMoved`). Until this fix the student's `items`
 * were one field of it, listed (`otherField`): in the probe, at 0d86603 (06.10.2026, e29run/scratch/
 * r2h8-probe), p1's console wrote a Tool's tier 1 -> 3 through Aiko's update, and it stood on the GM's copy
 * with the mark at 1 and one row, `listed:items`.
 */
async function parentItems(actor, mark, changes, user, options, now) {
    const named = itemsNamed(changes), found = [];
    const gone = [...new Set([...Object.keys(mark.items ?? {}), ...Object.keys(mark.itemEffects ?? {})])].filter(id => !now[id]);
    let held = mark;
    for (const id of [...gone, ...(named ? [...named.keys()] : Object.keys(now)).filter(each => now[each])]) {
        const data = now[id] ?? null, copy = held.items?.[id] ?? null, doc = actor.items?.get(id) ?? null;
        let kind = "updateItem", write = named?.get(id) ?? null;
        if (!data) kind = "deleteItem";
        // Gone since the hook: its deletion is judged on its own.
        else if (!doc) continue;
        else if (!write) {
            const effectsMoved = stableJson(held.itemEffects?.[id] ?? {}) !== stableJson(effectsIn(data));
            if (!copy && heldItem(data)) kind = "createItem";
            else if (!effectsMoved && (!copy || stableJson(copy) === stableJson(itemCopy(data)))) continue;
            else write = { ...(copy ? bothPaths(copy, itemCopy(data)) : {}), ...(effectsMoved ? { effects: data.effects ?? [] } : {}) };
        }
        const one = await itemFindings(kind, doc ?? { id, name: copy?.name ?? null }, actor, held, write ?? {}, user, options, { item: data, whole: !named });
        held = { ...held, items: one.items, itemEffects: one.itemEffects, ...(one.finds ? { finds: one.finds } : {}) };
        if (one.back.length || one.flagged.length || one.listed.length || one.stood?.length) found.push(one);
    }
    return { found, items: held.items ?? {}, itemEffects: held.itemEffects ?? {}, finds: held.finds === mark.finds ? null : held.finds };
}

/** A student's update's `items` written as a list of entries named by their `_id`: id -> what the entry writes. Null for the list written whole. */
function itemsNamed(changes) {
    return entriesNamed(changes, "items");
}

/**
 * The items a student's update writes, read as `parentItems` reads them: id -> what its entry writes, or - the
 * list written whole - each item the student holds now -> null. Null when it writes no `items`. truth-bullets.mjs
 * finds a bullet written through its student here (fix r2-H12) rather than reading the list a third way.
 */
export function itemsWritten(actor, changes) {
    if (!names(changes, "items")) return null;
    return itemsNamed(changes) ?? new Map((actor.items?.contents ?? []).map(item => [item.id, null]));
}

/**
 * A GM's write of a student's items through its update (r2-H10): each it names as that item's own update moves the mark
 * (`itemMoves`, fix r2-H15: by what its entry reached) - every one as the hook saw it, the list written whole - and each
 * the GMs held that is gone, are the mark's.
 */
function itemsMoved(mark, now, named) {
    let moved = { items: { ...(mark?.items ?? {}) }, itemEffects: { ...(mark?.itemEffects ?? {}) } };
    const ids = [...Object.keys(moved.items), ...Object.keys(moved.itemEffects)].filter(id => !now[id]);
    for (const id of new Set([...ids, ...(named ? [...named.keys()] : Object.keys(now)).filter(each => now[each])])) {
        const entry = now[id] ? named?.get(id) : null;
        moved = entry ? { ...moved, ...itemMoves("updateItem", moved, { id }, now[id], entry) }
            : { items: itemsAfter(moved, { id }, now[id] ?? null), itemEffects: itemEffectsAfter(moved, id, now[id] ?? null) };
    }
    return moved;
}

/*
 * AN ITEM MADE CARRYING AN EFFECT THAT COUNTS (G3; review round 1 sec B3): the effects of an item's
 * data that Daggerheart applies to the student and that change what the GMs hold (`touchesHeld`), as
 * the entries of a put-back of the whole item - the item (`items.<id>`) and each such effect - with
 * their change; null where it carries none. Until this fix such an item was flagged as any other made
 * by a player, and its effects stood with it until a GM's Undo - a Search's find with them for good.
 */
function carriedEffects(id, data) {
    const counted = Object.entries(effectsIn(data)).filter(([, effect]) => touchesHeld(effect, { onItem: true }))
        .map(([eid, effect]) => [effectPath(id, eid), effect]);
    if (!counted.length) return null;
    const whole = `items.${id}`;
    return { back: [{ path: whole, kind: "itemCreated" }, ...counted.map(([path]) => ({ path, kind: "effect" }))],
        change: { [whole]: [null, data.name ?? null], ...Object.fromEntries(counted.map(([path, effect]) => [path, [null, effectSummary(effect)]])) } };
}

/* ---------------------------------------------------------------------------
 * What is said, and kept
 * ------------------------------------------------------------------------- */

/** A value as the GMs' whisper shows it: short JSON, a dash for nothing. */
function shown(value) {
    if (value === null || value === undefined) return "-";
    const text = typeof value === "string" ? value : JSON.stringify(value);
    return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

/**
 * A put-back is told to its writer once (`sheetPutBack`, its first field's kind named in
 * their language: bridge-guards.mjs `requestLabel`) and whispered to the GMs once, each
 * field before and after; what is flagged gets the GMs' card (`flaggedCard`) and nothing
 * for the writer; a row for each, and one for what was listed, go into `sheetWrites`. The items
 * a student's update wrote (`byItem`, fix r2-H10) have rows of their own, each naming its item as
 * a write of the item's own does, and are told and whispered with the rest of the write.
 *
 * WHAT STOOD ON CREDIT OR A JUDGE HAS ITS ROW (E29 fix r1-G4, 05.10.2026; review round 1 cor m10;
 * the plan's 2.8). A gain a refund's credit, a Rest, an item used or a Call's price covered, a Rest
 * stamp and a Search's find (`stood`) go into one row, `covered`, with the reason and - for a refund -
 * the credit it took, and nothing is said: a refund taken from real spends is the GMs' to read in
 * `game.drpg.sheetWrites()`. Until this fix only a write that was also put back or flagged had a
 * row (C4's departure from the plan): at fd7c61f (05.10.2026, e29run/r1g4red) tier 2's Rest, item used
 * and refund, and its Search's find, each stood with none.
 */
async function record(actor, user, found, options) {
    const stamp = options?.drpgWrite ?? {};
    const at = Date.now();
    const rows = {};
    const parts = [found, ...(found.byItem ?? [])];
    const row = (part, verdict, entries, messageId) => ({
        actorId: actor.id, itemId: part.itemId ?? null, userId: user?.id ?? null, reason: stamp.reason ?? null, ref: stamp.ref ?? null,
        change: Object.fromEntries(entries.map(entry => [entry.path, part.change[entry.path]]).filter(([, v]) => v !== undefined)),
        covered: Object.keys(part.covered ?? {}).length ? part.covered : null,
        verdict, messageId, decided: null, at
    });
    const back = parts.filter(part => part.back.length);
    if (back.length) {
        tellRefused(user?.id ?? null, `sheet.${back[0].back[0].kind}`, null, "sheetPutBack");
        const lines = back.flatMap(part => part.back.map(entry => {
            const [was, now] = part.change[entry.path] ?? [];
            return `<li>${esc(game.i18n.localize(`DRPG.Audit.field.${entry.kind}`))} (${esc(entry.path)}): ${esc(shown(was))} -> ${esc(shown(now))}</li>`;
        })).join("");
        let message = null;
        try {
            message = await whisperToGms(`<p class="drpg-warning">${esc(game.i18n.format("DRPG.Audit.putBack", {
                player: user?.name ?? "?", name: actor.name }))}</p><ul>${lines}</ul>`, { flags: { [MODULE_ID]: { sheetAudit: actor.id } } });
        } catch (err) {
            error("Could not tell the GMs of a write put back", err);
        }
        for (const part of back) rows[foundry.utils.randomID()] = row(part, "putBack", part.back, message?.id ?? null);
    }
    for (const part of parts.filter(each => each.flagged?.length)) {
        // A deleted item's data goes with its row, for an Undo to make it again (C6).
        const id = foundry.utils.randomID(), flagged = { ...row(part, "flagged", part.flagged, null), ...(part.data ? { data: part.data } : {}) };
        let message = null;
        try {
            message = await whisperToGms(flaggedCard(flagged), { flags: { [MODULE_ID]: { sheetAudit: actor.id, [FLAGGED_CARD]: id } } });
        } catch (err) {
            error("Could not ask the GMs about a write flagged to them", err);
        }
        rows[id] = { ...flagged, messageId: message?.id ?? null };
    }
    for (const part of parts.filter(each => each.listed.length)) rows[foundry.utils.randomID()] = row(part, "listed", part.listed, null);
    // A Call of the GMs' taken off stood on a roll (fix r2-H7): its row names the roll's message.
    for (const part of parts.filter(each => each.stood?.length)) {
        rows[foundry.utils.randomID()] = { ...row(part, "covered", part.stood, null), ...(part.roll ? { ref: part.roll } : {}) };
    }
    if (!Object.keys(rows).length) return;
    await keepRows(rows, at);
    debug(`The GMs' audit: ${user?.name ?? "?"} on ${actor.name}: ${Object.values(rows).map(r => r.verdict).join(", ")}.`);
}

/** Rows into `sheetWrites`, every row older than a day swept as they go in. */
async function keepRows(rows, at) {
    const old = Object.entries(sheetWriteStore.entries() ?? {}).filter(([, kept]) => !(kept?.at >= at - ROW_KEPT_MS)).map(([id]) => id);
    if (old.length) await sheetWriteStore.dropMany(old);
    await sheetWriteStore.patchMany(rows);
}

/*
 * THREE TRACES THAT NAME THEIR SENDER (E33 C5a, 07.10.2026; the plan's 2.4). Beside the rows of a
 * player's own writes, the primary keeps a row of three things it refused or undid for a user it can
 * name: a Daggerheart request about a student refused on this browser (`refused`, relay-guard.mjs
 * `reportRefusal`: the request's sub-operation and what it asked of each path), a message whose author
 * is not a GM carrying a flag only a GM's browser writes (`forged`, `onForgedCard` below: the message
 * and its flags - no browser reads it as drawn, and no GM's card lists, decides or takes it over,
 * roll-draw.mjs `awayRowOf` since fix r1-G2), and a roll's dice a player rewrote, put back (`rewrite`, reroll-receipts.mjs
 * `judgeRewrite`: the message and its total before and after). The user is the one Foundry named as
 * the sender or the author, never a field of what was sent. Listed by `sheetWrites` with the others,
 * each with its words (`TRACE_WORDS`); none waits for a GM's decision. Until C5a none of them left a
 * row: at 214cb0b (07.10.2026, tier 2) each of the three left the store as it found it.
 *
 * ONE ROW PER BURST (E33 fix r1-G1, 07.10.2026; review round 1's sec M1). A trace repeated inside
 * `WARN_EVERY_MS` of its row counts on that row (`n`, listed as `times`) instead of adding one: a
 * refused request of the same sender, student, sub-operation and kind - the key the toast is said by
 * (relay-guard.mjs `reportRefusal`) - and a forged message of the same author about the same student,
 * whose row then names every message it counted (`messages`) so the scan at ready below finds each of
 * them traced. The traces are kept one after another (`traces`): a fold reads the row the trace
 * before it wrote. Measured at ba0cade (e33-review/secprobe1.log, P3): 40 refused requests from one
 * console were 40 rows, 329 -> 12089 bytes of a store every GM's browser holds; now a row per key
 * per 30 s. A `rewrite` row is not folded: round 1 measured no burst of them (a doubt of fix r1-G1's
 * note).
 *
 * A FOLD KEEPS WHAT IT FOLDS (E33 fix r2-G1, 07.10.2026; review round 2's sec m1). Until this fix a
 * fold patched the count and the message and nothing else, and a forged row was keyed by its author
 * alone: measured at 51c5e9e (e33-review/secprobe2.log, R1 and F1), p1's refused Hope and then Stress
 * about one student inside 30 s read as one row "hope.value: 2 -> 4" times 2, and three forged
 * messages about three students as one row naming the first student and the first flag. Now a fold
 * adds the trace's paths to the row (`foldChange`: a path already there keeps its first value and
 * takes the latest asked, the union capped at `TRACE_PATHS`, names already cut by their judge, an
 * item's paths under `items.<id>.` on a row that is not that item's), an item the row's own `itemId`
 * is not to `items` (capped the same), and a forged row is one author's about one student, so each
 * student a burst named has a row of its own. A refused request about another student's item is
 * judged "forged" (relay-guard.mjs `itemRefusal`), a key apart from a refused Hope: a burst of both
 * is two rows (measured 07.10.2026 by the tier-2 test "a burst of refused relay requests about one
 * student keeps every path and item it asked on the row of its key").
 */
const TRACE_WORDS = Object.freeze({
    refused: "DRPG.Audit.verdict.refused",
    forged: "DRPG.Audit.verdict.forged",
    rewrite: "DRPG.Audit.verdict.rewrite"
});

/** The fields a trace must share with a row to count on it (null: a row of its own every time). */
const TRACE_KEYS = Object.freeze({ refused: ["userId", "actorId", "sub", "kind"], forged: ["userId", "actorId"], rewrite: null });

/** The traces queued (`recordTrace`), kept one after another; how many are still to land. */
let traces = Promise.resolve();
let tracesQueued = 0;

/** One trace row (a verdict of `TRACE_WORDS`) into `sheetWrites`, on the primary, or a count, its paths and its item on the row it folds into. Answers the row's id, or null. */
export function recordTrace(verdict, fields = {}) {
    if (!TRACE_WORDS[verdict] || !isPrimaryGm()) return Promise.resolve(null);
    tracesQueued++;
    const run = traces.then(() => traceNow(verdict, fields)).finally(() => { tracesQueued--; });
    traces = run.catch(() => null);
    return run;
}

async function traceNow(verdict, { actorId = null, itemId = null, userId = null, messageId = null, change = {}, ...more }) {
    const at = Date.now();
    const folded = traceFolds(verdict, { actorId, userId, messageId, ...more }, at);
    if (folded) {
        const [id, kept] = folded, n = (kept.n ?? 1) + 1;
        const names = kept.messageId === messageId || (kept.messages ?? []).includes(messageId);
        const itemNamed = !itemId || kept.itemId === itemId || (kept.items ?? []).includes(itemId) || (kept.items ?? []).length >= TRACE_PATHS;
        const whose = itemId && itemId !== kept.itemId ? `items.${itemId}.` : "";
        await sheetWriteStore.patch(id, { n, change: foldChange(kept.change, change, whose), ...(itemNamed ? {} : { items: [...(kept.items ?? []), itemId] }),
            ...(verdict === "forged" && messageId && !names ? { messages: [...(kept.messages ?? []), messageId] } : {}) });
        debug(`The GMs' audit: ${verdict} from ${game.users.get(userId ?? "")?.name ?? userId ?? "?"}, counted on its row (${n}).`);
        return id;
    }
    const id = foundry.utils.randomID();
    await keepRows({ [id]: { ...more, actorId, itemId, userId, reason: null, ref: null, change, covered: null, verdict, messageId, decided: null, at } }, at);
    debug(`The GMs' audit: ${verdict} from ${game.users.get(userId ?? "")?.name ?? userId ?? "?"}.`);
    return id;
}

/**
 * A row's paths with a folded trace's added (fix r2-G1): a path the row names keeps its first value and takes the
 * trace's asked one; a new one while the row names fewer than `TRACE_PATHS`. A trace about another document than
 * the row's (an item, on a row of the student or of another item) names its paths under `whose` (`items.<id>.`), so
 * one item's `name` is not read as the row's own.
 */
function foldChange(kept, change, whose = "") {
    const merged = { ...(kept ?? {}) };
    for (const [own, pair] of Object.entries(change ?? {})) {
        const path = `${whose}${own}`;
        if (Object.hasOwn(merged, path)) merged[path] = [merged[path]?.[0] ?? null, pair?.[1] ?? null];
        else if (Object.keys(merged).length < TRACE_PATHS) merged[path] = pair;
    }
    return merged;
}

/** The newest row a trace counts on, as `[id, row]`, or null: the verdict's `TRACE_KEYS` equal and the row younger than `WARN_EVERY_MS`. */
function traceFolds(verdict, fields, at) {
    const keys = TRACE_KEYS[verdict];
    if (!keys) return null;
    const same = (a, b) => (a ?? null) === (b ?? null);
    let found = null;
    for (const entry of Object.entries(sheetWriteStore.entries() ?? {})) {
        const kept = entry[1], age = at - (Number(kept?.at) || 0);
        if (kept?.verdict !== verdict || age < 0 || age >= WARN_EVERY_MS || !keys.every(key => same(kept[key], fields[key]))) continue;
        if (!found || kept.at > found[1].at) found = entry;
    }
    return found;
}

/**
 * `createChatMessage`, on the primary: a message whose author is not a GM and that carries a flag
 * only a GM's browser writes (private-rolls.mjs `forgedFlagsOf`) gets one `forged` row - the message,
 * its speaker's character, its author, each flag with its value - and one line to the GMs. Nothing
 * else is done to it: no browser reads it as drawn and no award is paid for it (`forgedFlagsOf`'s
 * readers). Answers the row's id, or null. Exported for the suite. Since fix r1-G1 also called for
 * an update that writes such a flag (`onForgedUpdate`) and at the primary's ready for a message no
 * hook saw (`traceForgedAtReady`); a message of the same author about the same student inside
 * `WARN_EVERY_MS` counts on that row, which names it and its flags (`recordTrace`'s fold), and is
 * still told once.
 */
export async function onForgedCard(message) {
    if (!isPrimaryGm() || !message?.id) return null;
    const flags = forgedFlagsOf(message);
    if (!flags.length) return null;
    const author = message.author ?? null, actor = game.actors.get(message.speaker?.actor ?? "") ?? null;
    const change = Object.fromEntries(flags.map(path => [path, [null, shown(foundry.utils.getProperty(message, path))]]));
    const id = await recordTrace("forged", { actorId: actor?.id ?? null, userId: author?.id ?? null, messageId: message.id, change });
    try {
        await whisperToGms(`<p class="drpg-warning">${esc(game.i18n.format("DRPG.Audit.forgedCard", {
            player: author?.name ?? "?", name: actor?.name ?? message.speaker?.alias ?? "?",
            flags: flags.map(path => path.split(".").slice(2).join(".")).join(", ") }))}</p>`,
        { flags: { [MODULE_ID]: { sheetAudit: actor?.id ?? null, forgedCard: message.id } } });
    } catch (err) {
        error("Could not tell the GMs of a message carrying a GM's flags", err);
    }
    return id;
}

/**
 * `updateChatMessage`, on the primary (E33 fix r1-G1, 07.10.2026; review round 1's sec m4): a
 * message's author may write its flags, so one of a GM's flags can reach a player's message after
 * its creation's check above - until this fix untraced. An update whose changes name one of them
 * (private-rolls.mjs `gmOnlyFlagsIn`), written by a user who is not a GM, is traced as a create is
 * (`onForgedCard`: the message's flags as they stand now, the GMs told; a repeat counts on the row).
 * A GM's own update of a player's message is nobody's forgery and leaves none standing: the grant of
 * a roll thrown with no GM writes its mark and the GM as author in one update (roll-draw.mjs
 * `decideNow`). Answers the row's id, or null. Exported for the suite, whose writes are all a GM's.
 */
export async function onForgedUpdate(message, changes, userId) {
    if (!isPrimaryGm() || !message?.id || game.users.get(userId ?? "")?.isGM || !gmOnlyFlagsIn(changes).length) return null;
    return onForgedCard(message);
}

/**
 * THE SCAN AT READY (E33 fix r1-G1, 07.10.2026; review round 1's sec m3, C5a's doubt (d)). On the
 * primary once its stores hold the rows (`registerSheetAudit`, with the comparison at ready): every
 * message carrying a GM's flags under another author (`forgedFlagsOf`) that no `forged` row names -
 * one written while no GM was connected, which no `createChatMessage` hook saw - is traced as a
 * create is (`onForgedCard`: its row, the GMs told once). A message older than a row is kept
 * (`ROW_KEPT_MS`) is let be: its row, if it had one, is swept, and tracing it at every ready would
 * tell the GMs of it at every ready. Measured at ba0cade (15-held's G4, e33run/c6): such a message
 * left the GM who returned with rows 0, told 0. Answers the ids traced. Exported for the suite.
 *
 * A message's age is Foundry's own stamp of its creation (`_stats.createdTime`), not its `timestamp`
 * (E33 fix r2-G1, 07.10.2026; review round 2's sec m2): `timestamp` is a field of the create, which
 * its author writes, and until this fix a forged message dated over a day back by its author was let
 * be. The harness's server keeps a client's `timestamp` and stamps `createdTime` itself (cluster.mjs
 * `applyOp`); whether v13 and v14 do both on a player's create has not been read at a table
 * (LIVE-E33-10). A message with no `createdTime` is aged by its `timestamp`, as before.
 */
export async function traceForgedAtReady() {
    if (!isPrimaryGm() || !gmStoresHydrated()) return [];
    const named = new Set(Object.values(sheetWriteStore.entries() ?? {}).filter(row => row?.verdict === "forged")
        .flatMap(row => [row.messageId, ...(row.messages ?? [])]));
    const since = Date.now() - ROW_KEPT_MS, traced = [];
    for (const message of [...(game.messages?.contents ?? [])]) {
        if (named.has(message.id) || (Number(message._stats?.createdTime ?? message.timestamp) || 0) < since || !forgedFlagsOf(message).length) continue;
        try {
            if (await onForgedCard(message)) traced.push(message.id);
        } catch (err) {
            error("Could not trace a message carrying a GM's flags written while no GM was connected", err);
        }
    }
    return traced;
}

/* ---------------------------------------------------------------------------
 * The GMs' card: Undo and Keep (C5)
 * ------------------------------------------------------------------------- */

/**
 * The kind of field a row's path is, for its label: an item deleted or created (C6) by its change, an
 * item's field or an effect (C7) as their judges name them, a means by its ledger's kind, anything else
 * as `kindOf` reads it.
 */
function fieldKind(path, [, now] = []) {
    if (/^items\.[^.]+$/.test(path)) return now === null ? "itemDeleted" : "itemCreated";
    // A field of an item or an effect put back at ready (C7), as `itemFindings` and `effectFindings` name theirs.
    if (/^(?:effects|itemEffects)\./.test(path)) return "effect";
    const inItem = /^items\.[^.]+\.(.+)$/.exec(path)?.[1];
    if (inItem) return inItem === "system.quantity" ? "itemQuantity" : inItem === CLASS_HIT_POINTS ? "max" : ITEM_PLACE.includes(itemFlagOf(inItem)) ? "itemLocation" : "itemFlag";
    return Object.values(LEDGER).find(entry => entry.path === path)?.kind ?? kindOf(path) ?? "flag";
}

/**
 * THE CARD OF A FLAGGED WRITE (the plan's 2.8): who, which student, each field before and after,
 * and Undo and Keep while nobody has decided - then, in their place, what was decided and by
 * whom. Built from the row alone, so the primary writes it whole again once a GM decides.
 */
function flaggedCard(row) {
    const name = game.actors.get(row.actorId)?.name ?? "?", player = game.users.get(row.userId ?? "")?.name ?? "?";
    const label = path => game.i18n.localize(`DRPG.Audit.field.${fieldKind(path, row.change?.[path])}`);
    const lines = Object.entries(row.change ?? {}).map(([path, [was, now] = []]) =>
        `<li>${esc(label(path))} (${esc(path)}): ${esc(shown(was))} -> ${esc(shown(now))}</li>`).join("");
    const foot = row.decided ? decidedWords(row.decided, label)
        : `<div class="drpg-audit-actions"><button type="button" data-drpg-audit="undo">${esc(game.i18n.localize("DRPG.Audit.undo"))}</button>`
        + `<button type="button" data-drpg-audit="keep">${esc(game.i18n.localize("DRPG.Audit.keep"))}</button></div>`;
    return `<div class="drpg-audit-card"><p class="drpg-warning">${esc(game.i18n.format("DRPG.Audit.flagged", { player, name }))}</p><ul>${lines}</ul>${foot}</div>`;
}

/** What a GM decided of a row, in the words both cards give it: kept, undone, and what had moved since. */
function decidedWords(decided, label) {
    const gm = game.users.get(decided.by ?? "")?.name ?? "?", said = [];
    if (decided.how === "keep") said.push(["drpg-audit-kept", game.i18n.format("DRPG.Audit.kept", { gm })]);
    if (decided.undone?.length) said.push(["drpg-audit-undone", game.i18n.format("DRPG.Audit.undone", { gm })]);
    if (decided.moved?.length) said.push(["drpg-audit-moved", game.i18n.format("DRPG.Audit.changedSince", { gm, fields: decided.moved.map(label).join(", ") })]);
    return said.map(([cls, text]) => `<p class="${cls}">${esc(text)}</p>`).join("");
}

/** This GM's decisions, one after another (`decideWrite`). */
let decisions = Promise.resolve();

/**
 * UNDO OR KEEP, DECIDED ONCE (the plan's 2.8, 2.9). Made on the primary GM - a click on another
 * GM's browser asks it (`askToDecideWrite`) - one decision after another, so a second click, from
 * this GM or another, finds the row decided and does nothing. The row is marked decided - who,
 * when, which, what was written back and what had moved - before anything is written. Keep writes
 * nothing. Undo writes each field back to its before-value only while the field still holds the
 * value the write left: a field moved since is not written over, and the card names it. Queued
 * behind the writes on that student (`inOrder`), so a later change is the document's by the time
 * it reads. The card is written again for every GM. Answers the decision, or null where there
 * was none to make. Exported for tier 2, as `judgeWrite`.
 *
 * A before-value that is an object goes back whole (`wholeValue`), as a put-back writes it
 * (`putBackPatch`). Written plainly, Foundry merged it into what the player made of it: the
 * review's probe (round 1's m1, 05.10.2026) undid a Rest stamp row of `{short}` -> `{short, long}`,
 * the row and the card said "undone" and the flag still held `{short, long}`.
 *
 * AN ITEM (C6): a deleted one still gone is made again under its id from the row's copy - the
 * carry cap does not refuse what was there - and a created one still there is deleted; one made
 * again or deleted since is the field that moved.
 */
export function decideWrite(rowId, keep, by = game.user?.id ?? null) {
    const run = decisions.then(() => decideNow(rowId, keep === true, by));
    decisions = run.catch(() => null);
    return run;
}

async function decideNow(rowId, keep, by) {
    const row = typeof rowId === "string" ? sheetWriteStore.get(rowId) : null;
    if (!game.user?.isGM || row?.verdict !== "flagged" || row.decided) return null;
    return inOrder(row.actorId, async () => {
        const actor = game.actors.get(row.actorId) ?? null, src = actor?._source ?? {};
        const paths = Object.keys(row.change ?? {}), whole = row.itemId ? `items.${row.itemId}` : null;
        const deleted = whole && row.change[whole]?.[1] === null;
        const holds = path => path === whole ? Boolean(actor.items?.get(row.itemId)) !== deleted && (!deleted || Boolean(row.data))
            : stableJson(foundry.utils.getProperty(src, path) ?? null) === stableJson(row.change[path]?.[1] ?? null);
        const undone = keep || !actor ? [] : paths.filter(holds);
        const decided = { by, at: Date.now(), how: keep ? "keep" : "undo", undone, moved: keep ? [] : paths.filter(path => !undone.includes(path)) };
        await sheetWriteStore.patch(rowId, { decided });
        const fields = undone.filter(path => path !== whole);
        if (fields.length) await trustedWrite(actor, Object.fromEntries(fields.map(path => [path, wholeValue(row.change[path][0])])), { reason: "auditUndo" });
        if (undone.includes(whole) && deleted) await trustedCreate(actor, [row.data], { reason: "auditUndo", keepId: true, [CAP_OVERRIDE]: true });
        else if (undone.includes(whole)) await trustedDelete(actor.items.get(row.itemId), { reason: "auditUndo" });
        const card = game.messages.get(row.messageId ?? "");
        // A row of the card of changes made with no GM watching (C7): that card, every row of it, as the store now holds them.
        if (card && row.away) await updateSecret(card, awayCard(awayRowsOf(row.messageId)), null, { [AWAY_CARD]: cardFlag(card, AWAY_CARD) ?? [] });
        else if (card) await updateSecret(card, flaggedCard({ ...row, decided }), null, { sheetAudit: row.actorId, [FLAGGED_CARD]: rowId });
        return decided;
    });
}

/**
 * A GM's click on the card, decided on the primary GM (`audit.decide`, gm-bridge.mjs): here when
 * this is the primary, asked of it otherwise - the shape roll-draw.mjs `askToDecide` gives Grant
 * all (E08+E28 fix r2-H7). Answers the decision, or null.
 */
export async function askToDecideWrite(rowId, keep) {
    const res = await bridgeRequest("audit.decide", { rowId, keep: keep === true }, {
        settle: "reply", onPrimary: true, local: () => decideWrite(rowId, keep) });
    return res.ok ? res.value ?? null : null;
}

/*
 * A CARD WHOSE ROWS ARE SWEPT (round 1's m8, 05.10.2026). A row is kept a day (`keepRows`), its
 * card for as long as the chat log keeps it; until this fix such a card kept its buttons, a click
 * took them off, `decideNow` found no row and answered null, and the next render drew them again -
 * buttons that decided nothing and said nothing. A card is swept when every row it names is gone
 * from the hydrated store and the card is older than a row is kept: a younger card without its row
 * is one whose row is still on its way (the card is posted before the row is written, `record`), and
 * a row older than a day is only dropped when the next rows go in, so until then it still decides.
 * Read by tier 2 on a card of its own; not seen at a table, where a card that old is a day's play away.
 *
 * Drawn a microtask later, once the hook has run every listener: secret.mjs's swap - a listener of
 * the same hook, registered after this one - writes the card's words into it again, buttons and all.
 * Taken off at once, they were back by the time the hook returned (05.10.2026, e29run/r1g8probe:
 * the sweep's test was true and the drawn card still held its button).
 */
function sweptCard(message, ids) {
    return gmStoresHydrated() && ids.length > 0 && ids.every(id => !sheetWriteStore.has(id))
        && Number(message?.timestamp) < Date.now() - ROW_KEPT_MS;
}

/** A swept card drawn without its buttons, and one line that it can no longer be decided. */
function drawSwept(element) {
    element.querySelectorAll(".drpg-audit-actions, .drpg-audit-all").forEach(el => el.remove());
    if (element.querySelector(".drpg-audit-expired")) return;
    const line = document.createElement("p");
    line.className = "drpg-audit-expired";
    line.textContent = game.i18n.localize("DRPG.Audit.expired");
    (element.querySelector(".drpg-audit-card") ?? element).append(line);
}

/**
 * The card's two buttons, wired on a GM's browser for a card a GM posted, as roll-draw.mjs
 * `onRenderUnwitnessed` wires Grant all; taken off once the row every GM holds is decided. A row
 * not here yet - the card can arrive before the store's sync - leaves them on; a row swept
 * (`sweptCard`) takes them off and says so.
 */
function onRenderFlagged(message, element) {
    try {
        if (!game.user?.isGM || !cardWriter(message)?.isGM) return;
        const away = cardFlag(message, AWAY_CARD);
        if (Array.isArray(away)) return void (sweptCard(message, away) ? queueMicrotask(() => drawSwept(element)) : wireAwayCard(away, element));
        const rowId = cardFlag(message, FLAGGED_CARD);
        if (typeof rowId !== "string") return;
        if (sweptCard(message, [rowId])) return void queueMicrotask(() => drawSwept(element));
        if (sheetWriteStore.get(rowId)?.decided) return void element.querySelector(".drpg-audit-actions")?.remove();
        element.addEventListener("click", async event => {
            const button = event.target?.closest?.("[data-drpg-audit]");
            if (!button) return;
            event.preventDefault();
            element.querySelector(".drpg-audit-actions")?.remove();
            await askToDecideWrite(rowId, button.dataset.drpgAudit === "keep");
        });
    } catch (err) {
        error("Could not draw the GMs' card of a flagged write", err);
    }
}

/* ---------------------------------------------------------------------------
 * With no GM watching (C7)
 * ------------------------------------------------------------------------- */

/** actorId -> what the writes judged on this browser before its stores hydrated named: the mark could not take them then. */
const unmarked = new Map();

/**
 * A write judged before this browser's stores hydrated (`refreshMark` waits for them): a GM's -
 * the primary's own writes at its `ready` - or a player's judged against the copy of the mark
 * this browser held already. The comparison at ready takes what it names as it stands rather
 * than as a difference nobody judged. An effect or an item is named whole, an effect on an item
 * as the mark holds it (`effectPath`, G3). A player's write on a student this browser held no
 * mark of is not noted (E29 fix r1-G6; review round 1 sec m1): nobody judged it, and until the
 * fix the comparison skipped what it named and the mark then took it in - a GM on a new browser,
 * primary while the other GMs' marks were on their way, so the window is the hydration's (at
 * most `gmStoreSyncMs`). Now the comparison judges it as any difference: measured by scenario 61's
 * W1 on 8895265 (05.10.2026, e29run/r1g6red), a console's Agility +3 that landed in that window
 * stood with no row.
 */
function noteUnmarked(kind, doc, actor, changes) {
    const held = unmarked.get(actor.id) ?? new Set();
    if (kind === "updateActor") for (const path of reachOf(changes)) held.add(path);
    else held.add(ITEM_WRITES.has(kind) ? `items.${doc.id}` : effectPath(itemOf(doc)?.id, doc.id));
    unmarked.set(actor.id, held);
}

/*
 * Every leaf the mark and the document hold differently in what the mark keeps (or under `roots`: a
 * write's reach, G2), the shallowest where one holds an object and the other a value. An empty
 * object is nothing: the mark keeps `rules` and
 * `bonuses` as `{}` where the document has none (`markFrom`), and read as a difference that put an
 * empty object onto every student of the harness's world at every ready - the first run of the
 * suite's "finds nothing on an untouched world" (05.10.2026, e29run/c7a1: 8 put-backs, 4 students).
 */
function differing(before, src, roots = MARKED_PATHS) {
    const read = (doc, path) => {
        const value = foundry.utils.getProperty(doc, path);
        return isPlain(value) && !Object.keys(value).length ? null : value ?? null;
    };
    const leaves = new Set();
    for (const root of roots) {
        for (const doc of [before, src]) {
            const value = foundry.utils.getProperty(doc, root);
            if (isPlain(value) && Object.keys(value).length) for (const path of pathsOf(value, root)) leaves.add(path);
            else if (value !== undefined) leaves.add(root);
        }
    }
    const moved = [...leaves].filter(path => stableJson(read(before, path)) !== stableJson(read(src, path)));
    return moved.filter(path => !moved.some(other => path.startsWith(`${other}.`)));
}

/** Two copies of a document's data as one write naming every path either holds. */
const bothPaths = (held, now) => foundry.utils.mergeObject(clone(held), now, { inplace: false });

/**
 * ONE STUDENT AT READY (the plan's 2.9): the document against its mark, each difference judged as
 * a write naming it would be, with no writer and no stamp - `actorFindings`, `effectFindings` and
 * `itemFindings` decide what is put back, and it is put back now - while a gain of the means
 * (`LEDGER`), a Rest stamp and a module item deleted or created go to the card (`flagged`), or, the
 * fields `lockPlayerResources` names with the setting off, to the list. A fall stands. What a write
 * judged before the stores hydrated named is the mark's (`unmarked`). The document is read once,
 * at the start, and the mark then settles on that reading with the put-backs applied, the means
 * as it held them (G1): a write that lands while the put-backs are written is queued behind this
 * comparison and judged on its own, as any other - until G1 the settling read the document again
 * at the end and took such a write in unjudged. The effects on its items are compared as its own
 * (G3), each item's against the mark's `itemEffects`; a module item or a class made with one that
 * counts is put back whole, as it is when judged live (`carriedEffects`), and one deleted took its
 * effects with it. Answers the findings, or null.
 */
async function compareOne(actor) {
    const mark = sheetMarkStore.get(actor.id);
    if (!mark || !game.actors?.has(actor.id)) return null;
    const early = [...(unmarked.get(actor.id) ?? [])];
    const byGm = path => early.some(seen => path === seen || path.startsWith(`${seen}.`) || seen.startsWith(`${path}.`));
    // What a GM wrote before the stores hydrated - an armed list included (C8) - is the GMs' as this reads it.
    const start = markFrom(actor), src = markAsDocument(start), lock = locked();
    const effectDocs = new Map((actor.effects?.contents ?? []).map(effect => [effect.id, effect]));
    const itemDocs = new Map((actor.items?.contents ?? []).map(item => [item.id, [item, docData(item)]]));
    const settle = ({ back = [], calls = null, effects = [], items = {}, itemEffects = [], gone = [] } = {}) => {
        const was = markAsDocument(mark);
        for (const path of back) setMarked(start, path, path === CALLS_PATH && calls
            ? keptCalls(foundry.utils.getProperty(src, CALLS_PATH), calls) : foundry.utils.getProperty(was, path));
        for (const id of effects) {
            if (mark.effects?.[id]) start.effects[id] = clone(mark.effects[id]);
            else delete start.effects[id];
        }
        for (const [itemId, id] of itemEffects) setEffect(start, itemId, id, mark.itemEffects?.[itemId]?.[id] ?? null);
        for (const [id, data] of Object.entries(items)) {
            if (data) start.items[id] = data;
            else delete start.items[id];
        }
        for (const id of gone) {
            delete start.items[id];
            delete start.itemEffects[id];
        }
        return markWritten(actor, { ...start, credit: creditOf(mark) });
    };
    // A Monokuma is no student (`judgeNow`): what it holds stands.
    if (mark.flags?.[FLAGS.monokuma]) {
        await settle();
        return null;
    }
    const paths = differing(markAsDocument(mark), src).filter(path => !byGm(path));
    const read = actorFindings(mark, foundry.utils.expandObject(Object.fromEntries(paths.map(path => [path, true]))), src);
    // A GM's armed entry taken off with no GM watching stands on a roll in the chat as it does live (fix r2-H7), with no wait.
    const sheet = read.taken.length ? callsOwed(read, await callsCover(actor, null, read.taken)) : read;
    const out = { actor, back: [...sheet.back], listed: [...sheet.listed], flagged: [...sheet.flagged], change: { ...sheet.change }, items: [] };
    const values = ledgerOf(mark, actor), now = ledgerOf(start, actor);
    for (const [key, { path, cost, kind }] of Object.entries(LEDGER)) {
        if (byGm(path) || (now[key] - values[key]) * cost >= 0) continue;
        out.change[path] = [values[key], now[key]];
        out[lock || kind === "grant" ? "flagged" : "listed"].push({ path, kind });
    }
    const rests = [mark.flags?.[FLAGS.restsTaken] ?? null, foundry.utils.getProperty(src, RESTS_PATH) ?? null];
    if (!byGm(RESTS_PATH) && stableJson(rests[0]) !== stableJson(rests[1])) {
        out.change[RESTS_PATH] = rests.map(clone);
        out.flagged.push({ path: RESTS_PATH, kind: "flag" });
    }
    const undos = sheet.back.length ? [() => putBackNow(actor, mark, src, sheet.back, sheet.calls)] : [];
    const effectsBack = [], itemsBack = {}, itemEffectsBack = [], gone = [];
    for (const id of new Set([...Object.keys(mark.effects ?? {}), ...Object.keys(start.effects)])) {
        const held = mark.effects?.[id] ?? null, data = start.effects[id] ?? null;
        if (byGm(`effects.${id}`) || stableJson(held) === stableJson(data)) continue;
        const kind = !data ? "deleteActiveEffect" : held ? "updateActiveEffect" : "createActiveEffect";
        const found = effectFindings(kind, effectDocs.get(id) ?? { id, parent: actor }, mark, held && data ? bothPaths(held, data) : {}, data);
        out.listed.push(...found.listed);
        if (found.listed.length) Object.assign(out.change, found.change);
        if (!found.back.length) continue;
        out.back.push(...found.back);
        Object.assign(out.change, found.change);
        undos.push(found.undo);
        effectsBack.push(id);
    }
    for (const id of new Set([...Object.keys(mark.items ?? {}), ...Object.keys(start.items)])) {
        const held = mark.items?.[id] ?? null, [item, data] = itemDocs.get(id) ?? [null, null], whole = `items.${id}`;
        if (byGm(whole) || stableJson(held) === stableJson(start.items[id] ?? null)) continue;
        const carried = held ? null : carriedEffects(id, data);
        if (!item) out.items.push({ itemId: id, back: [], flagged: [{ path: whole, kind: "itemDeleted" }], change: { [whole]: [held.name ?? null, null] }, data: wholeItem(mark, id) });
        else if (carried) {
            out.items.push({ itemId: id, flagged: [], ...carried });
            undos.push(async () => actor.items?.get(id) ? trustedDelete(actor.items.get(id), { reason: "auditPutBack" }) : null);
            gone.push(id);
        } else if (!held) out.items.push({ itemId: id, back: [], flagged: [{ path: whole, kind: "itemCreated" }], change: { [whole]: [null, item.name ?? null] } });
        else {
            // Its fields only: its effects are compared below, each as its own (G3), not as written through it (r2-H8).
            const found = await itemFindings("updateItem", item, actor, mark, bothPaths(held, itemCopy(data)), null, {}, { item: data });
            if (!found.back.length && !found.listed.length) continue;
            out.items.push(found);
            if (!found.back.length) continue;
            undos.push(found.undo);
            itemsBack[id] = found.items[id] ?? null;
        }
    }
    for (const itemId of new Set([...Object.keys(mark.itemEffects ?? {}), ...Object.keys(start.itemEffects)])) {
        const [item] = itemDocs.get(itemId) ?? [null];
        if (!item || gone.includes(itemId) || byGm(`items.${itemId}`)) continue;
        const heldOnes = mark.itemEffects?.[itemId] ?? {}, nowOnes = start.itemEffects[itemId] ?? {};
        const found = { itemId, back: [], flagged: [], listed: [], change: {} };
        for (const id of new Set([...Object.keys(heldOnes), ...Object.keys(nowOnes)])) {
            const held = heldOnes[id] ?? null, data = nowOnes[id] ?? null;
            if (byGm(effectPath(itemId, id)) || stableJson(held) === stableJson(data)) continue;
            const kind = !data ? "deleteActiveEffect" : held ? "updateActiveEffect" : "createActiveEffect";
            const one = effectFindings(kind, item.effects?.get(id) ?? { id, parent: item }, mark, held && data ? bothPaths(held, data) : {}, data);
            found.listed.push(...one.listed);
            if (one.listed.length) Object.assign(found.change, one.change);
            if (!one.back.length) continue;
            found.back.push(...one.back);
            Object.assign(found.change, one.change);
            undos.push(one.undo);
            itemEffectsBack.push([itemId, id]);
        }
        if (found.back.length || found.listed.length) out.items.push(found);
    }
    for (const undo of undos) {
        try {
            await undo();
        } catch (err) {
            error(`The GMs' audit could not put back a change made on ${actor.name} with no GM watching`, err);
        }
    }
    await settle({ back: sheet.back.map(entry => entry.path), calls: sheet.calls, effects: effectsBack, items: itemsBack, itemEffects: itemEffectsBack, gone });
    return out.back.length || out.listed.length || out.flagged.length || out.items.length ? out : null;
}

/**
 * The rows of the comparison, and its one card (`awayCard`): a put-back row per student and per
 * item, a flagged row per field and per item deleted or created - so each has its own Undo and
 * Keep - and a listed row per student and per item (G4). Rows carry `away` and no writer: nobody is
 * known to have written them. Answers the card, or null.
 */
async function recordAway(found) {
    const at = Date.now(), rows = [];
    const row = (actor, verdict, entries, change, extra = {}) => [foundry.utils.randomID(), {
        actorId: actor.id, itemId: null, userId: null, reason: null, ref: null,
        change: Object.fromEntries(entries.map(entry => [entry.path, change[entry.path]]).filter(([, v]) => v !== undefined)),
        covered: null, verdict, messageId: null, decided: null, at, away: true, n: rows.length, ...extra }];
    for (const each of found) {
        if (each.back.length) rows.push(row(each.actor, "putBack", each.back, each.change));
        for (const entry of each.flagged) rows.push(row(each.actor, "flagged", [entry], each.change));
        if (each.listed.length) rows.push(row(each.actor, "listed", each.listed, each.change));
        for (const item of each.items) {
            if (item.back.length) rows.push(row(each.actor, "putBack", item.back, item.change, { itemId: item.itemId }));
            for (const entry of item.flagged) rows.push(row(each.actor, "flagged", [entry], item.change, { itemId: item.itemId, ...(item.data ? { data: item.data } : {}) }));
            if (item.listed?.length) rows.push(row(each.actor, "listed", item.listed, item.change, { itemId: item.itemId }));
        }
    }
    if (!rows.length) return null;
    const told = rows.filter(([, r]) => r.verdict !== "listed");
    let message = null;
    if (told.length) {
        try {
            message = await whisperToGms(awayCard(told), { flags: { [MODULE_ID]: {
                [AWAY_CARD]: told.filter(([, r]) => r.verdict === "flagged").map(([id]) => id) } } });
        } catch (err) {
            error("Could not tell the GMs of the changes made with no GM watching", err);
        }
    }
    await keepRows(Object.fromEntries(rows.map(([id, r]) => [id, r.verdict === "listed" ? r : { ...r, messageId: message?.id ?? null }])), at);
    debug(`The GMs' audit at ready: ${rows.map(([, r]) => `${game.actors.get(r.actorId)?.name ?? "?"} ${r.verdict}`).join(", ")}.`);
    return message;
}

/** The rows a card of the comparison shows, from the store, in the order it first showed them. */
function awayRowsOf(messageId) {
    return Object.entries(sheetWriteStore.entries() ?? {})
        .filter(([, row]) => row?.away && row.messageId === messageId && row.verdict !== "listed")
        .sort(([, a], [, b]) => (a.n ?? 0) - (b.n ?? 0));
}

/**
 * THE CARD OF THE CHANGES MADE WITH NO GM WATCHING (the plan's 2.9): what was put back, then each
 * row asked about - student, field, before and after - with Undo and Keep while nobody has decided
 * it and what was decided after, and Undo all / Accept all while any row is open. Built from the
 * rows alone, so the primary writes it whole again after each decision (`decideNow`).
 */
function awayCard(rows) {
    const label = (row, path) => game.i18n.localize(`DRPG.Audit.field.${fieldKind(path, row.change?.[path])}`);
    const line = row => Object.entries(row.change ?? {}).map(([path, [was, now] = []]) => esc(game.i18n.format("DRPG.Audit.awayLine", {
        name: game.actors.get(row.actorId)?.name ?? "?", field: label(row, path), path, before: shown(was), after: shown(now) }))).join("; ");
    const button = (attr, how, key, id = null) => `<button type="button" data-drpg-${attr}="${how}"${id ? ` data-drpg-row="${esc(id)}"` : ""}>`
        + `${esc(game.i18n.localize(key))}</button>`;
    const back = rows.filter(([, row]) => row.verdict === "putBack"), asked = rows.filter(([, row]) => row.verdict === "flagged");
    const open = asked.some(([, row]) => !row.decided);
    return `<div class="drpg-audit-card drpg-audit-away"><h3>${esc(game.i18n.localize("DRPG.Audit.awayTitle"))}</h3>`
        + (back.length ? `<p class="drpg-warning">${esc(game.i18n.localize("DRPG.Audit.awayPutBack"))}</p><ul>${back.map(([, row]) => `<li>${line(row)}</li>`).join("")}</ul>` : "")
        + (asked.length ? `<ul>${asked.map(([id, row]) => `<li data-drpg-row="${esc(id)}">${line(row)}${row.decided
            ? decidedWords(row.decided, path => label(row, path))
            : `<span class="drpg-audit-actions">${button("audit", "undo", "DRPG.Audit.undo", id)}${button("audit", "keep", "DRPG.Audit.keep", id)}</span>`}</li>`).join("")}</ul>` : "")
        + (open ? `<div class="drpg-audit-all">${button("audit-all", "undo", "DRPG.Audit.undoAll")}${button("audit-all", "keep", "DRPG.Audit.acceptAll")}</div>` : "")
        + "</div>";
}

/**
 * The card's buttons, wired on a GM's browser as `onRenderFlagged` wires a flagged write's: a row's
 * Undo or Keep decides that row, Undo all or Accept all every row of the card still open, each on the
 * primary GM (`askToDecideWrite`). Taken off once every row the card asks about is decided here.
 */
function wireAwayCard(ids, element) {
    const open = () => ids.filter(id => !sheetWriteStore.get(id)?.decided);
    if (!open().length) return void element.querySelectorAll(".drpg-audit-actions, .drpg-audit-all").forEach(el => el.remove());
    element.addEventListener("click", async event => {
        const button = event.target?.closest?.("[data-drpg-audit], [data-drpg-audit-all]");
        if (!button) return;
        event.preventDefault();
        const one = button.dataset.drpgRow;
        if (one) {
            button.closest(".drpg-audit-actions")?.remove();
            if (ids.includes(one)) await askToDecideWrite(one, button.dataset.drpgAudit === "keep");
            return;
        }
        element.querySelectorAll(".drpg-audit-actions, .drpg-audit-all").forEach(el => el.remove());
        const keep = button.dataset.drpgAuditAll === "keep";
        for (const id of open()) await askToDecideWrite(id, keep);
    });
}

/**
 * THE COMPARISON AT READY (the plan's 2.9; exported for tier 2): on the primary GM once its stores
 * hold the other GMs' copies (`registerSheetAudit`), every student with a mark compared with it
 * (`compareOne`, queued behind the writes on that student), and one card for the GMs. Answers the
 * rows' verdicts counted and the card's id, or null where this is not the primary or nothing could
 * be read. `leaving`: a GM this browser was just told has gone (`primaryLeft`).
 */
export async function compareAtReady({ leaving = null } = {}) {
    if (!isPrimaryGm({ leaving }) || !gmStoresHydrated()) return null;
    try {
        const students = (game.actors?.contents ?? []).filter(actor => actor.type === "character" && sheetMarkStore.has(actor.id))
            .sort((a, b) => a.name.localeCompare(b.name));
        const found = (await Promise.all(students.map(actor => inOrder(actor.id, () => compareOne(actor))))).filter(Boolean);
        unmarked.clear();
        const card = await recordAway(found);
        const count = key => found.reduce((n, each) => n + each[key].length + each.items.reduce((m, item) => m + (item[key]?.length ?? 0), 0), 0);
        return { putBack: count("back"), flagged: count("flagged"), listed: count("listed"), card: card?.id ?? null };
    } catch (err) {
        error("The GMs' audit could not compare the sheets with what it held", err);
        return null;
    }
}

/**
 * THE LIST (`game.drpg.sheetWrites()`): every write this GM holds a row of, newest first,
 * kept a day. A table of them goes to the console under `DRPG.Audit.listTitle`; a player's
 * browser holds no row and answers an empty list.
 */
export function sheetWrites({ quiet = false } = {}) {
    if (!game.user?.isGM) return [];
    const rows = Object.entries(sheetWriteStore.entries() ?? {})
        .sort(([, a], [, b]) => (b?.at ?? 0) - (a?.at ?? 0))
        .map(([id, row]) => ({
            id, at: new Date(row.at ?? 0).toISOString(), character: game.actors.get(row.actorId)?.name ?? row.actorId,
            player: game.users.get(row.userId)?.name ?? row.userId, verdict: row.verdict, reason: row.reason ?? "-",
            change: Object.entries(row.change ?? {}).map(([path, [was, now] = []]) => `${path}: ${shown(was)} -> ${shown(now)}`).join("; "),
            // What a refund took back of what was paid before it (C4); the rest of its gain is what the row is for.
            credit: row.covered ? game.i18n.format("DRPG.Audit.credit", { what: Object.entries(row.covered).map(([key, n]) => `${key} ${n}`).join(", ") }) : "-",
            // A flagged write's decision (C5): which, and the GM who made it.
            decided: row.decided ? `${row.decided.how} (${game.users.get(row.decided.by ?? "")?.name ?? row.decided.by ?? "?"})` : "-",
            // A trace's words (C5a): what was refused, forged or put back, as the GMs read it; "-" for a write's row.
            what: TRACE_WORDS[row.verdict] ? game.i18n.format(TRACE_WORDS[row.verdict], { sub: row.sub ?? "?" }) : "-",
            // How many traces inside WARN_EVERY_MS the row counts (fix r1-G1); 1 for a write's row.
            times: row.n ?? 1
        }));
    if (!quiet) {
        console.log(game.i18n.format("DRPG.Audit.listTitle", { n: rows.length }));
        if (rows.length) console.table(rows);
    }
    return rows;
}

/* ---------------------------------------------------------------------------
 * The hooks
 * ------------------------------------------------------------------------- */

/**
 * WHAT A GM'S HOOK DOES WITH A WRITE (exported for tier 2, which has one GM: `primary` false
 * is a second GM's hook). Only the primary judges and writes; the others hold the stores
 * it writes, synced, so the next primary judges against the same marks.
 */
export function onSheetWrite(kind, doc, changes, options, userId, { primary = isPrimaryGm() } = {}) {
    if (!primary) return null;
    const priors = kind === "updateActor" ? noteWrite(doc, changes, options, userId) : null;
    return judgeWrite(kind, doc, changes, userId, options, priors);
}

/*
 * WHEN THE PRIMARY LEAVES (E29 fix r1-G6, 05.10.2026; review round 1 cor m7). Only the primary judges,
 * and its queue is its browser's: the writes it had heard and not judged when it left, and those that
 * reached the next GM while that GM still counted it here, were judged by nobody, and the comparison
 * ran only at a primary's own hydration - long past for a GM that becomes the primary because
 * another left. So that GM, hydrated, compares every sheet with its marks as it hears the primary go:
 * what nobody judged is a difference, judged as at ready. A write the old primary had judged has
 * moved the marks this GM holds only once that primary's patch has arrived; one still on its way
 * when the GM hears it leave would read as a difference too - the harness sends both in the order
 * they left, and on Foundry the order is not measured (the harness has the hook only). Measured by
 * scenario 61's W2 on 8895265 (05.10.2026, e29run/r1g6red): a console's Agility +3 queued behind a
 * held job on the primary stood with no row after the primary left.
 */
function primaryLeft(user, connected) {
    if (connected || !user?.isGM || gmStoresQuiet()) return;
    // Whether the GM that left was the primary: counted here whatever its `active` still says.
    if (primaryGmId({ arriving: user.id }) !== user.id || !isPrimaryGm({ leaving: user.id }) || !gmStoresHydrated()) return;
    void compareAtReady({ leaving: user.id });
}

/** On every browser; each hook stands aside unless this is the primary GM. At `init`, so the hydration below is not missed. */
export function registerSheetAudit() {
    Hooks.on("updateActor", (actor, changes, options, userId) => { onSheetWrite("updateActor", actor, changes, options, userId); });
    Hooks.on("createActiveEffect", (effect, options, userId) => { onSheetWrite("createActiveEffect", effect, {}, options, userId); });
    Hooks.on("updateActiveEffect", (effect, changes, options, userId) => { onSheetWrite("updateActiveEffect", effect, changes, options, userId); });
    Hooks.on("deleteActiveEffect", (effect, options, userId) => { onSheetWrite("deleteActiveEffect", effect, {}, options, userId); });
    Hooks.on("updateItem", (item, changes, options, userId) => {
        onItemWrite(item, changes, options, userId);
        onSheetWrite("updateItem", item, changes, options, userId);
    });
    Hooks.on("createItem", (item, options, userId) => { onSheetWrite("createItem", item, {}, options, userId); });
    Hooks.on("deleteItem", (item, options, userId) => { onSheetWrite("deleteItem", item, {}, options, userId); });
    Hooks.on("renderChatMessageHTML", onRenderFlagged);
    Hooks.on("createChatMessage", onRollHeard);
    Hooks.on("createChatMessage", message => { void onForgedCard(message); });
    Hooks.on("updateChatMessage", (message, changes, options, userId) => { void onForgedUpdate(message, changes, userId); });
    Hooks.on("createActor", actor => { if (actor?.type === "character") void refillMarks(); });
    Hooks.on("userConnected", primaryLeft);
    Hooks.on("deleteActor", actor => {
        heard.delete(actor.id);
        if (isPrimaryGm() && gmStoresHydrated() && sheetMarkStore.has(actor.id)) void sheetMarkStore.drop(actor.id);
    });
    // Not while the suite holds the stores or stands them in another world: a hydration then is the suite's. The
    // comparison reads only the students that have a mark and the filling writes only those that have none (C7).
    onGmStoresHydrated(() => {
        if (!isPrimaryGm() || gmStoresQuiet()) return;
        void compareAtReady();
        void fillMarks();
        void traceForgedAtReady();
    });
}
