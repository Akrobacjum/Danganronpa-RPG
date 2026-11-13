/**
 * Danganronpa RPG - Advancement.
 * ---------------------------------------------------------------------------
 * Replaces the Daggerheart level-up entirely. The guide gives two flavours:
 *
 *   Standard    - everyone who voted for the correct Blackened picks ONE.
 *   Reinforced  - a Blackened who survived a wrong vote picks THREE - with the
 *                 class's next Standard, or at the Final Trial (E05 C11).
 *
 * Options (repeatable - picking "+1 max Health" three times means +3):
 *   +1 max Health · +1 max Sanity · +1 to a trait · +1 to an experience ·
 *   a new experience at +2
 */

import { MODULE_ID, FLAGS, LEVEL_UP, LEVEL_UP_OPTIONS, LEVEL_UP_TRAIT_RESOURCES, TRAITS, STARTING, TRIAL } from "./config.mjs";
import { listExperiences } from "./character.mjs";
import { log, error, isPrimaryGm, ownerIdsOf, plural, proseOf } from "./utils.mjs";
import { offerStore, offerCopy, deferredOfferStore } from "./gm-stores.mjs";
import { gmStoresQuiet } from "./gm-store.mjs";
import { drpgWindow } from "./ui-kit.mjs";


/**
 * Resolved on use, not at import time. Foundry moved FormDataExtended under
 * `foundry.applications.ux` and keeps a deprecated global alias; resolving it
 * eagerly would throw during module load on any build that drops the global,
 * taking the whole file down instead of one dialog.
 */
function readFormData(form) {
    const FDE = foundry.applications?.ux?.FormDataExtended ?? globalThis.FormDataExtended;
    if (FDE) return new FDE(form).object;

    // Last resort: plain FormData still gives us every named control.
    return Object.fromEntries(new FormData(form).entries());
}

/**
 * Ask which advancement was earned, then open the picker. This is what the
 * button on the character sheet calls, so the GM never has to remember the
 * argument names.
 *
 * @param {Actor} actor
 */
export async function openAdvancementFor(actor) {
    if (!actor || actor.type !== "character") {
        ui.notifications.warn(game.i18n.localize("DRPG.Character.notACharacter"));
        return null;
    }

    // The module's one menu shape - see `chooseVariant` in action-menus.mjs.
    // Imported dynamically because this window is opened from a sheet button
    // and a GM console, neither of which is on a path that has already paid
    // for that module.
    const { chooseVariant } = await import("./action-rolls.mjs");

    /* WHAT STANDS, AND TAKING IT BACK (E10 C6; audit S03-17). The GM's sheet showed no offer
       and this menu had no way back from one: an offer made by mistake stood until it was
       spent. Each standing offer is a third choice here, oldest first. */
    const standing = standingOffers(actor).map(offer => ({
        value: `take:${offer.id}`, icon: "fa-rotate-left",
        label: game.i18n.format("DRPG.Advance.takeBack", { kind: advanceKindName(offer.kind) })
    }));

    const picked = await chooseVariant({
        actor,
        // Level Up keeps its one column (E68 C12; Q12: a reward, not an action of the table).
        columns: false,
        title: game.i18n.format("DRPG.Advance.title", { actor: actor.name }),
        prompt: game.i18n.format("DRPG.Advance.whichKind", {
            actor: foundry.utils.escapeHTML(actor.name)
        }),
        options: [
            { value: "standard", icon: "fa-arrow-up",
              label: advanceKindName("standard"),
              hint: game.i18n.localize("DRPG.Advance.kind.standardHint") },
            { value: "reinforced", icon: "fa-shield-halved",
              label: advanceKindName("reinforced"),
              hint: game.i18n.localize("DRPG.Advance.kind.reinforcedHint") },
            ...standing
        ]
    });

    if (!picked) return null;
    if (picked.value.startsWith("take:")) return takeBackOffer(actor, picked.value.slice("take:".length));
    // Nobody would see an offer (`offerAdvancement`): said, and the GM picks.
    if (!ownerIdsOf(actor).length) {
        ui.notifications.info(game.i18n.format("DRPG.Advance.nobodyPlays", { name: actor.name }));
        return openAdvancement(actor, picked.value);
    }

    /*
     * WHO PICKS (N-2, Dawid 20.09).
     *
     * The GM decides WHAT was earned - standard or reinforced - and that stays
     * theirs; who chooses the buff is a separate question, and at most tables the
     * answer is the player. Asked as a second menu rather than as four options in
     * the first, because the two questions are not the same kind of question: the
     * first is a ruling about what happened, the second is about who is at the
     * keyboard next.
     */
    const who = await chooseVariant({
        actor,
        // Level Up keeps its one column (E68 C12; Q12: a reward, not an action of the table).
        columns: false,
        title: game.i18n.format("DRPG.Advance.title", { actor: actor.name }),
        prompt: game.i18n.format("DRPG.Advance.whoPicks", {
            actor: foundry.utils.escapeHTML(actor.name)
        }),
        options: [
            { value: "gm", icon: "fa-user-pen",
              label: game.i18n.localize("DRPG.Advance.who.gm"),
              hint: game.i18n.localize("DRPG.Advance.who.gmHint") },
            { value: "player", icon: "fa-paper-plane",
              label: game.i18n.localize("DRPG.Advance.who.player"),
              hint: game.i18n.localize("DRPG.Advance.who.playerHint") }
        ]
    });
    if (!who) return null;

    if (who.value === "player") return offerAdvancement(actor, picked.value);
    return openAdvancement(actor, picked.value);
}

/* ==========================================================================
 * WHERE AN OFFER LIVES (review of stage D, 21.09)
 * ==========================================================================
 *
 * N-2 kept the offer as a flag on the character, and a flag is world data:
 *
 *   - AN OWNER CAN WRITE IT. A player may set flags on their own actor, and the
 *     GM's client checked that same flag before writing a Level Up - so one line
 *     in the console gave a player a Reinforced Level Up, as often as they liked.
 *   - EVERYONE CAN READ IT. After a wrong verdict the GM hands the Blackened a
 *     Reinforced Level Up; until they spent it, any player's console could list
 *     who carried one - the surviving killer, by name.
 *
 * So the offer lives where the module keeps every other secret: in a CLIENT-scoped
 * setting (see secret.mjs, observe.mjs). The PRIMARY GM's copy is the authority,
 * holding every offer; an owner's browser holds only its own characters', written
 * from an addressed message, and uses it for nothing but lighting the button. The
 * primary never reads anything a player can write.
 *
 * DELIVERY, AND AN OWNER WHO WAS NOT THERE. A message sent on `userConnected`
 * arrives before the newcomer's listeners exist (gm-bridge.mjs records the
 * measurement), so the owner ASKS: once when their bridge is up, and again when
 * a primary GM announces itself. The answer is their whole set, so asking twice
 * costs nothing and a withdrawn offer disappears the same way a new one arrives.
 *
 * A GM STORE SINCE E04 (1.2.63; audit S03-11): every GM holds the offers
 * (gm-stores.mjs `offerStore`, synced), the primary still writes them, and an
 * owner holds a stamped copy (`offerCopy`) - a primary whose browser held no
 * offers used to answer an owner with an empty set, which the owner's browser
 * took, and the lit button went out.
 */
function readOffers() {
    try {
        return game.user?.isGM ? offerStore.entries() : { ...offerCopy.read() };
    } catch {
        return {};
    }
}

/*
 * A LIST PER CHARACTER (E10 C6, 1.2.71; audit S03-17). The row was one offer, `{ kind, at }`,
 * written whole: a second offer took the first one's place, so a player with two unspent
 * Standards kept one, and a GM's own Level Up of the character spent the offer standing on it
 * without a word (`applyAdvancement` withdrew whatever stood). A row is `{ offers: [{ id, kind,
 * extra, deferred, at }] }` now, oldest first: a new offer is appended, an apply or a take-back
 * removes the one it names, and the last one going is the stamped drop it always was. `extra`
 * is picks on top of the kind's own and `deferred` how many of the offer's picks are the
 * Blackened's Reinforced that waited for the class (E05 C11; E10 C7 writes both, and gives the
 * waited row back to the GMs' store when the offer is taken back), so an offer buys
 * `offerPicks` picks. A row a 1.2.70
 * browser wrote, `{ kind, at }`, is read as a list of one under the id `legacy` - no migration
 * step: the first write after it is a list, and nulls the two old fields so a GM that still
 * holds them cannot merge them back (a ledger merges field by field). An owner's copy holds the
 * list of their own characters, `{ offers: [{ id, kind, extra }] }`, or the old `{ kind }`.
 */
const LEGACY_OFFER = "legacy";

const wholeCount = value => Math.max(0, Math.trunc(Number(value) || 0));

/** The offers a row of the store, or of an owner's copy, stands for - oldest first; [] for anything else. */
export function offerList(row) {
    if (!row || typeof row !== "object") return [];
    if (Array.isArray(row.offers)) {
        return row.offers.filter(offer => typeof offer?.id === "string" && offer.id && LEVEL_UP[offer.kind]?.picks)
            .map(offer => ({ id: offer.id, kind: offer.kind, extra: wholeCount(offer.extra), deferred: wholeCount(offer.deferred),
                at: Number(offer.at) || 0, ...(offer.only === "trait" ? { only: "trait" } : {}) }));
    }
    return LEVEL_UP[row.kind]?.picks ? [{ id: LEGACY_OFFER, kind: row.kind, extra: 0, deferred: 0, at: Number(row.at) || 0 }] : [];
}

/**
 * A Level Up kind's name as the texts show it, "Level Up (pick 1)" / "Level Up (wybierz 1)": `DRPG.Advance.kind.<kind>`
 * with `{picks}` the kind's own picks off config.mjs `LEVEL_UP` (E66 C7, 01.11.2026; STATUS Open 51), where the count was
 * typed into both languages beside the number the code holds. The kind's, not an offer's: an offer's extra picks are
 * `Advance.offered`'s {n} (`offerPicks`). A name in its hosts (docs/text-style.md section 14): opening the sentence, after a
 * colon or standing alone, so one form serves them all.
 */
export function advanceKindName(kind) {
    return game.i18n.format(`DRPG.Advance.kind.${kind}`, { picks: LEVEL_UP[kind]?.picks ?? 0 });
}

/** How many picks an offer buys: its kind's and its extra. */
export function offerPicks(offer) {
    return (LEVEL_UP[offer?.kind]?.picks ?? 0) + wholeCount(offer?.extra);
}

/** The offers standing on this character as THIS browser holds them: every GM's store, an owner's copy, nothing elsewhere. */
export function standingOffers(actor) {
    return actor ? offerList(readOffers()[actor.id]) : [];
}

/** The fields a list is written with: the list, and the old row's two fields nulled where they stand. */
function listFields(row, offers) {
    return { offers, ...(row && Object.hasOwn(row, "kind") ? { kind: null, at: null } : {}) };
}

/** Primary GM: each owner of the character is sent their set again. */
async function tellOwners(actorId) {
    const actor = game.actors.get(actorId);
    const { sendOffersTo } = await import("./gm-bridge.mjs");
    for (const userId of actor ? ownerIdsOf(actor) : []) sendOffersTo(userId);
}

/**
 * Primary GM: append one offer to the character's list - `offer` is `{ kind, extra, deferred }`
 * or a kind - and answer it; or, for null, take back every offer standing on it. The read and
 * the write are one synchronous step after the store has heard from the other GMs, so two
 * offers in a row both stand.
 */
export async function recordOffer(actorId, offer) {
    if (!isPrimaryGm()) return null;
    const asked = typeof offer === "string" ? { kind: offer } : offer;
    let added = null;
    if (!asked) {
        await offerStore.drop(actorId);
    } else {
        if (!LEVEL_UP[asked.kind]?.picks) return null;
        await offerStore.whenHydrated();
        const row = offerStore.get(actorId);
        /* `only: "trait"`: an offer of statistic points alone, the DA39 migration's (E64; `applyDa39Migration`), which
           the picker draws with that option alone and the GMs hold a player's picks to (bridge-runs-acts.mjs
           `handleAdvancement`). Recorded on the primary only: a second GM's offer goes through the bridge, which carries
           none. */
        added = { id: foundry.utils.randomID(), kind: asked.kind, extra: wholeCount(asked.extra), deferred: wholeCount(asked.deferred),
            at: Date.now(), ...(asked.only === "trait" ? { only: "trait" } : {}) };
        await offerStore.patch(actorId, listFields(row, [...offerList(row), added]));
    }
    await tellOwners(actorId);
    return added;
}

/**
 * Primary GM: take one offer off the character's list - spent or taken back. An offer is a
 * row, a withdrawal a stamped drop: a GM that still holds it cannot write it back. Answers
 * whether it stood.
 */
export async function dropOffer(actorId, offerId) {
    if (!isPrimaryGm()) return false;
    await offerStore.whenHydrated();
    const row = offerStore.get(actorId);
    const standing = offerList(row);
    const left = standing.filter(offer => offer.id !== offerId);
    if (left.length === standing.length) return false;
    if (left.length) await offerStore.patch(actorId, listFields(row, left));
    else await offerStore.drop(actorId);
    await tellOwners(actorId);
    /* AND THIS GM'S OWN SHEET (E45-C3b, 09.11.2026; C3a's Open 1). The owners redraw on the set they are sent; the GM's
       button reads this store, and nothing drew the GM's open sheet again after a player's take: `applyAdvancement`
       writes the rises first (the sheet renders for them, the offer still standing) and withdraws the offer after.
       Scenario 71 H4 read the GM's button lit with no offer standing ({"offered":true,"standing":0}). A take-back
       draws its own GM's sheet as well (`takeBackOffer`); a second render there is the old one's cost. */
    game.actors.get(actorId)?.sheet?.render(false);
    return true;
}

/**
 * Primary GM: the offers standing on this user's own characters - and only those -
 * with a stamp per character they own: the newest decision about it (`newest`: the
 * offer's, or a withdrawal's tombstone), or 0 for one this browser never held, which
 * changes nothing on the owner's side. `stampOf` would be wrong here: it reads live
 * fields only, so a withdrawal went out at 0 and the owner kept the spent offer lit
 * (61 H2a, measured on the first C8 tree, 26.09).
 */
export function offersFor(userId) {
    const user = game.users.get(userId);
    const offers = {}, stamps = {};
    if (!user || user.isGM) return { offers, stamps };
    const held = readOffers();
    for (const actor of game.actors ?? []) {
        if (actor.type !== "character" || !actor.testUserPermission?.(user, "OWNER")) continue;
        stamps[actor.id] = offerStore.newest(actor.id);
        // What the owner's picker needs and nothing more: not when, nor which one waited for the class (`ownerCopyOf`).
        const list = ownerCopyOf(held[actor.id]);
        if (list.length) offers[actor.id] = { offers: list };
    }
    return { offers, stamps };
}

/**
 * AFTER A RESTORE (gm-stores.mjs `restoreCase`; the design's 6.2): every connected
 * player is sent the offers on their own characters again, with their stamps - an
 * owner refused while this browser held none (stamp 0) has the lit button back, and
 * one who holds it changes nothing (`offerCopy`). Any GM may send it, as any GM's
 * answer is weighed by its stamps. Nothing while the suite holds the stores or stands
 * in another world (`gmStoresQuiet`). Answers how many players were sent their set.
 */
export async function retellOffers() {
    if (!game.user?.isGM || gmStoresQuiet()) return 0;
    const { sendOffersTo } = await import("./gm-bridge.mjs");
    let sent = 0;
    for (const user of game.users) {
        if (!user.active || user.isGM) continue;
        await sendOffersTo(user.id);
        sent++;
    }
    return sent;
}

/**
 * The offers as an owner's browser holds them, from a row of the GMs' (or the copy the primary sent): what the owner's
 * picker needs and nothing more - the id, the kind, the extra picks, and a statistics-only offer's mark (`only: "trait"`,
 * the DA39 migration's; the E101 line's review of 1.2.110, V2, 13.11.2026: until then the copy kept `{ id, kind, extra }`
 * alone, the player's picker drew every option and the GM refused all but a statistic). Not when, nor which one waited
 * for the class. `offersFor` sends it, `receiveOffers` keeps it; exported for tier 2's "E64 DA39 migration".
 */
export function ownerCopyOf(row) {
    return offerList(row).map(({ id, kind, extra, only }) => ({ id, kind, extra, ...(only === "trait" ? { only } : {}) }));
}

/** Owner: take the set the primary sent where it is newer (`offerCopy`), and redraw. */
export async function receiveOffers(offers, stamps) {
    const before = readOffers();
    const mine = {};
    for (const [actorId, row] of Object.entries(offers ?? {})) {
        // Bounded here as well: only a character this user owns, only a real kind.
        if (!game.actors.get(actorId)?.isOwner) continue;
        const list = ownerCopyOf(row);
        if (list.length) mine[actorId] = { offers: list };
    }
    if (!await offerCopy.receive(mine, stamps)) return false;
    for (const id of new Set([...Object.keys(before), ...Object.keys(readOffers())])) {
        game.actors.get(id)?.sheet?.render(false);
    }
    return true;
}

/**
 * Owner: a season reset cut this browser's copy (E04 C10, the owner's Q4 - a reset
 * with "advancement" ticked withdraws the Level Ups on offer). Nothing is sent for it:
 * the cut is in the clock, and the copy reads empty under it from then on, so each of
 * this user's own characters' sheets is drawn again here (gm-stores.mjs `offerCopy`'s
 * `onCut`). Answers how many were asked to draw.
 */
export function redrawOwnSheets() {
    if (game.user?.isGM) return 0;
    let n = 0;
    for (const actor of game.actors ?? []) {
        if (actor.type !== "character" || !actor.isOwner) continue;
        actor.sheet?.render(false);
        n++;
    }
    return n;
}

/** Any GM: one offer is spent or taken back. The primary writes it; others ask it to. */
async function withdrawOffer(actorId, offerId) {
    if (isPrimaryGm()) return dropOffer(actorId, offerId);
    const { requestOfferRecord } = await import("./gm-bridge.mjs");
    const res = await requestOfferRecord(actorId, null, offerId);
    return res.ok;
}

/**
 * Characters whose Level Up is being written on this browser - the primary GM's, which judges a
 * player's picks (bridge-runs-acts.mjs `handleAdvancement` takes and lets go of the latch) and every
 * take-back of an offer (`takeBackOffer` here, the bridge's `take` for another GM, which read it
 * and hold it from their check to their drop).
 */
export const advancing = new Set();

/*
 * Characters whose offer is being taken back on this browser, while `advancing` holds them too (E10 fix
 * r2-G6, 1.2.71): a second take-back of one character in that time was refused with the words of a Level Up
 * being written, which names what is not happening. Its own words now (`DRPG.Advance.takeBackTaking`);
 * measured in tier 2 "a second take-back of one character while the first is written is told as a take-back".
 */
export const takingBack = new Set();

/**
 * A GM takes one offer back (E10 C6; audit S03-17): the third choice of the sheet's Level Up
 * menu, one per standing offer. Its owner's button goes out with the set the primary sends.
 * An offer carrying a Reinforced that waited for the class (`deferred`, E10 C7) gives it back
 * to the GMs' store, waiting for the next batch as it was before the offer: taking the offer
 * back takes back the class's Standard, not what the Blackened earned. Answers whether it was
 * taken.
 *
 * NOT WHILE ITS LEVEL UP IS BEING WRITTEN (E10 fix r1-G2, 1.2.71; the round-1 security review's
 * F1). A player's Level Up reads its offer, waits in the student's queue (`meansWrite`), writes,
 * and only then spends the offer. A take-back in that wait found the offer standing and took it:
 * the GM was told "taken back", the Level Up landed on the sheet anyway, and the Blackened's
 * waiting Reinforced went back to the GMs' store to be given a second time. Measured on the
 * harness at 1a9a07e (tier 2, "a take-back of an offer whose Level Up is being written is
 * refused on both roads"): with the apply held in the queue, this road answered true and put the
 * Reinforced back, and the Level Up was written as well. Refused now while that character's
 * latch is held, and the GM told; on another GM the primary refuses the bridge's `take` the same
 * way and the bridge tells it.
 *
 * AND THE TAKE HOLDS THE LATCH UNTIL ITS DROP (E10 fix r2-G4; the round-2 security review's
 * S2-1). Round 1 let a take hold none, reading its drop as written in the same synchronous step
 * as its check. It is not while the primary's offers store waits for the other GMs' copies after
 * a load (up to `TIMING.gmStoreSyncMs`): `dropOffer` awaits `whenHydrated` first, and a player's
 * Level Up that arrived in that wait found the offer and no latch, and was written. Measured on
 * the harness at 7ff93ec (tier 2, "a take-back that waits for the offers store holds a player's
 * Level Up off on both roads", the store's wait stood in for): on both roads the take answered
 * taken and the Level Up was written as well (+4, one step of advances), and on this one the
 * Reinforced went back to the GMs' store. Now this road and the bridge's `take` hold the
 * character's latch from their check to their drop, so that Level Up is refused as busy.
 */
export async function takeBackOffer(actor, offerId) {
    if (!game.user.isGM || !actor) return false;
    const offer = standingOffers(actor).find(standing => standing.id === offerId);
    if (!offer) return false;
    if (takingBack.has(actor.id)) {
        ui.notifications.warn(game.i18n.format("DRPG.Advance.takeBackTaking", { name: actor.name }));
        return false;
    }
    if (advancing.has(actor.id)) {
        ui.notifications.warn(game.i18n.format("DRPG.Advance.takeBackBusy", { name: actor.name }));
        return false;
    }
    advancing.add(actor.id);
    takingBack.add(actor.id);
    try {
        if (!await withdrawOffer(actor.id, offerId)) return false;
    } finally {
        advancing.delete(actor.id);
        takingBack.delete(actor.id);
    }
    if (offer.deferred) {
        const kind = TRIAL.wrong.blackenedLevelUp;
        await deferAdvancement(actor, kind, null, { count: Math.max(1, Math.round(offer.deferred / (LEVEL_UP[kind]?.picks || 1))) });
    }
    ui.notifications.info(game.i18n.format("DRPG.Advance.takenBack", {
        name: actor.name, kind: advanceKindName(offer.kind)
    }));
    actor.sheet?.render(false);
    log(`${actor.name}'s ${offer.kind} Level Up on offer was taken back.`);
    return true;
}

/**
 * Hand the choice to the player (N-2).
 *
 * The offer is the whole mechanism: it lights the button on their sheet, tells
 * the picker which kind was earned, and is what the primary GM checks before it
 * applies anything. It lives in the primary GM's client store, not on the
 * character - see "WHERE AN OFFER LIVES" above. Nothing is written to the
 * character until they have chosen - an offer is not an advancement.
 *
 * WHISPERED, NOT ANNOUNCED. Which advancement somebody earned is between them and
 * the GM until they spend it; a public card would also tell the table who voted
 * correctly, which is the one thing a trial keeps quiet.
 *
 * FROM THE VERDICT'S WINDOW (E10 C7) an offer carries `extra` picks and how many of them
 * waited for the class (`deferred`) - the surviving Blackened's Reinforced rides on their
 * Standard as one offer - and is told on a veiled card (`veiled`: speaking as nobody, as
 * `tellPlayer`'s is) with no word to the GM for each (`quiet`: the verdict's line counts them).
 */
export async function offerAdvancement(actor, kind = "standard", { extra = 0, deferred = 0, veiled = false, quiet = false } = {}) {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }
    if (!actor || actor.type !== "character") {
        ui.notifications.warn(game.i18n.localize("DRPG.Character.notACharacter"));
        return null;
    }
    if (!LEVEL_UP[kind]?.picks) {
        ui.notifications.error(game.i18n.format("DRPG.Advance.unknownKind", { kind }));
        return null;
    }
    /* NOBODY TO HAND IT TO (E10 C6; audit S03-17). An offer lights a button on its owner's
       sheet, and a character no player owns has nobody to see it: it was recorded and the GM
       told "sent" all the same. Refused and said; the sheet's menu opens the GM's own picker. */
    if (!ownerIdsOf(actor).length) {
        ui.notifications.warn(game.i18n.format("DRPG.Advance.nobodyPlays", { name: actor.name }));
        return null;
    }

    const asked = { kind, extra: wholeCount(extra), deferred: wholeCount(deferred) };
    const offer = { ...asked, by: game.user.id, at: Date.now() };
    try {
        if (isPrimaryGm()) {
            await recordOffer(actor.id, asked);
        } else {
            // Awaited since E31: "offer sent" is said, and the owner told, only
            // once the primary has the offer - a refusal has been said already.
            const { requestOfferRecord } = await import("./gm-bridge.mjs");
            const res = await requestOfferRecord(actor.id, asked);
            if (!res.ok) return null;
        }
    } catch (err) {
        error(`Could not offer ${actor.name} a Level Up`, err);
        ui.notifications.error(game.i18n.localize("DRPG.Advance.offerFailed"));
        return null;
    }

    const { whisperToOwner } = await import("./utils.mjs");
    const line = plural("DRPG.Advance.offered", {
        kind: advanceKindName(kind),
        n: offerPicks(asked)
    });
    const waited = asked.deferred ? `<p>${game.i18n.localize("DRPG.Advance.reason.withClass")}</p>` : "";
    await whisperToOwner(actor, `<p><strong>${
        game.i18n.localize("DRPG.Advance.offerTitle")}</strong></p><p>${line}</p>${waited}`, veiled ? { veiled: true } : {});

    // The sheet is what lights up, and it is open in front of them right now as
    // often as not.
    actor.sheet?.render(false);
    log(`${actor.name} was offered a ${kind} Level Up; the choice is theirs.`);
    if (!quiet) ui.notifications.info(game.i18n.format("DRPG.Advance.offerSent", { name: actor.name }));
    return offer;
}

/**
 * The offer standing on this character that a press spends next, if any (N-2) - the
 * oldest of its list (E10 C6), with the picks it buys - as THIS browser holds it: every
 * offer on a GM's, a character's own on its owner's, nothing anywhere else.
 */
export function pendingAdvance(actor) {
    const [offer] = standingOffers(actor);
    return offer ? { ...offer, picks: offerPicks(offer) } : null;
}


/**
 * Open the advancement dialog for an actor.
 *
 * @param {Actor} actor
 * @param {"standard"|"reinforced"} kind
 * @param {object} [options]
 * @param {number} [options.extraPicks]   Picks on top of the kind's own, in the same window
 *                                        and the same write: a Reinforced Level Up that waited
 *                                        for the class (E05 C11). A GM's only - a player's
 *                                        picker takes the offer's count and nothing else.
 * @param {string[]} [options.reasons]    The translation keys the window and the card give as
 *                                        the reason; the kind's own when none.
 */
export async function openAdvancement(actor, kind = "standard", { extraPicks = 0, reasons = null } = {}) {
    /*
     * THE PICKER IS THE PLAYER'S TOO NOW (N-2), AND THE APPLY IS STILL NOT.
     *
     * Advancement is the GM's to award, and this is on `game.drpg` - so without a
     * check any player could call it from the console and raise their own maxima.
     * What opens that door exactly as far as it needs to go is the OFFER: a player
     * may open this window for their own character when the GM has left an offer
     * on it, and what they press sends their picks to the GM's client, which
     * checks the offer again and does the writing. `applyAdvancement` below stays
     * GM-only, because it is the thing that writes.
     */
    const offer = !game.user.isGM ? pendingAdvance(actor) : null;
    const asPlayer = Boolean(offer);
    if (!game.user.isGM && !asPlayer) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }
    if (asPlayer && !actor.isOwner) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }
    // The GM's argument, or the kind the offer was made for - never a kind the
    // player chose, which is the half of this a forged call would reach for.
    if (asPlayer) kind = offer.kind;

    if (!actor || actor.type !== "character") {
        ui.notifications.warn(game.i18n.localize("DRPG.Character.notACharacter"));
        return null;
    }

    const own = LEVEL_UP[kind]?.picks;
    if (!own) {
        ui.notifications.error(game.i18n.format("DRPG.Advance.unknownKind", { kind }));
        return null;
    }
    // A player's count is the offer's (`offerPicks`: the kind's and its extra), never an argument.
    const picks = own + (asPlayer ? offer.extra : Math.max(0, Math.trunc(Number(extraPicks) || 0)));
    const why = asPlayer || !Array.isArray(reasons) || !reasons.length ? [`DRPG.Advance.reason.${kind}`] : reasons;

    const experiences = listExperiences(actor);

    /* ON M9'S CARD (E21 C6a; docs/design/windows.md M9, approved 04.11.2026): the kit's frame, Cancel on the left and
       Apply on the right, the default; the rows as they were (D31). Cancel answers "cancel", as before. */
    const result = await drpgWindow({
        title: game.i18n.format("DRPG.Advance.title", { actor: actor.name }),
        /* A MODULE PANEL, AS EVERY OTHER WINDOW OF THE MODULE (E10 C9, 1.2.71; audit S01-16, S03-19). It carried
           `drpg-advance` alone, and the module's rules read `drpg-panel`: chrome.mjs `dressChrome` (the selects'
           arrow) and a11y.mjs (focus into a new window) match it and nothing else, and the audit saw the buttons
           and the title bar come out unlike the module's; stacking.mjs read it too until E23 C5a, and keeps the
           picker above the sheet by `prompt` (below) since. `drpg-advance` stays beside it: the widths, the
           pick rows and the notes are stated on it. Tier 2 "the Level Up window is a module panel" reads the
           classes; what a browser then shows (the arrow, the focus) is not something the harness draws - LIVE
           check at a table, not measured here; the order of the windows is E23-T2's (tier 2). */
        classes: ["drpg-panel", "drpg-advance"],
        // A prompt the game waits on: kept above the sheet the player compares it with (stacking.mjs; E23 C5a).
        prompt: true,
        // The GM's window says for whom it is; a player's own picker is their own character's.
        body: asPlayer ? playerPickerBody(actor, offer) : buildContent(picks, experiences, why, actor.name),
        footer: {
            primary: {
                action: "apply",
                label: game.i18n.localize("DRPG.Advance.apply"),
                callback: (event, button, dialog) => readForm(dialog, picks)
            },
            close: { role: "cancel", action: "cancel", callback: () => "cancel" }
        },
        render: (event, dialog) => wireForm(dialog, picks, actor, experiences),
        rejectClose: false
    });

    if (!result || result === "cancel") return null;

    /* AN EXPERIENCE TO RAISE THAT IS NOT THERE is refused HERE, on the screen of the person who
       picked it (E10 C8, 1.2.71; audit S03-22), a GM's as well as a player's. The window warned that
       there was nothing to raise and applied all the same: the pick went with no experience, the
       apply skipped it, and the rest were written - a Reinforced's three picks became two, and a
       player's offer was spent on them. `buildContent` no longer lets the option be chosen with no
       experience; this is for a form that sends it anyway. Nothing is written or sent: a player's
       offer and its lit button stand, as for a new experience with no name below. */
    if (result.some(p => p?.option === "experienceUp" && !p.experience)) {
        ui.notifications.warn(game.i18n.localize("DRPG.Advance.noExperienceToRaise"));
        return null;
    }

    /*
     * A PLAYER'S PICKS GO TO THE GM, WHO CHECKS THEM AGAINST THE OFFER. The picks
     * are a claim: the count, the options and the character are all checked again
     * on the GM's client before anything is written - see `requestAdvancement` and
     * its handler in gm-bridge.mjs. The offer is cleared by the apply, so pressing
     * twice cannot buy two - and since E10 C6 the packet names WHICH offer it spends,
     * and the GM checks that one.
     */
    if (asPlayer) {
        /* A NEW EXPERIENCE WITH NO NAME is caught HERE, on the screen of the person
           who left it blank. The apply's own warning fires on the GM's client, so a
           player's blank name used to warn the GM, spend the offer on the picks that
           did work, and tell the player nothing. The offer is untouched and the
           button is still lit; they press it again. */
        if (result.some(p => p?.option === "experienceNew" && !String(p.name ?? "").trim())) {
            ui.notifications.warn(game.i18n.localize("DRPG.Advance.experienceNeedsNameKept"));
            return null;
        }
        const { requestAdvancement } = await import("./gm-bridge.mjs");
        const res = await requestAdvancement({ actorId: actor.id, picks: result, kind, offerId: offer.id });
        return res.ok ? { pending: true } : null;
    }
    return applyAdvancement(actor, result, kind, { reasons: why });
}

/* ==========================================================================
 * FORM
 * ========================================================================== */

/**
 * A player's own picker for one offer (N-2): the offer's picks (`LEVEL_UP[kind].picks` and its extra), its kind's
 * reason, and only the options the offer allows (`only`, V2 of the 1.2.110 review). `openAdvancement` draws it for a
 * player; exported for tier 2's "E64 DA39 migration", which reads it from the GM for the owner's copy.
 */
export function playerPickerBody(actor, offer) {
    const picks = (LEVEL_UP[offer?.kind]?.picks ?? 0) + wholeCount(offer?.extra);
    return buildContent(picks, listExperiences(actor), [`DRPG.Advance.reason.${offer?.kind}`], null, { only: offer?.only ?? null });
}

/**
 * The window's markup (E10 C9, 1.2.71; audit S03-19).
 *
 * @param {string|null} forName  the character's name when a GM is picking: the GM's window then says
 *                               "For {name}: {reason}" once and the intro does not repeat the reason; null
 *                               for a player's own picker, which keeps the reason in its intro
 */
function buildContent(picks, experiences, reasons, forName = null, { only = null } = {}) {
    const why = reasons.map(key => game.i18n.localize(key)).join(" ");
    const intro = game.i18n.format(
        picks === 1 ? "DRPG.Advance.introOne" : "DRPG.Advance.introMany",
        { picks, reason: forName === null ? why : "" }
    ).trim();
    const forLine = forName === null ? ""
        : `<p class="drpg-advance-for">${game.i18n.format("DRPG.Advance.forWhom", { name: foundry.utils.escapeHTML(forName), reason: why })}</p>`;

    /* "CHOICE 1" OVER A WINDOW OF ONE CHOICE numbered nothing (S03-19): a Standard Level Up is one pick
       (config.mjs `LEVEL_UP`), the Reinforced three. The legend is for telling several apart; a lone select
       is named by its own label instead. */
    const rows = Array.from({ length: picks }, (_, i) => `
        <fieldset class="drpg-advance-pick" data-index="${i}">
            ${picks > 1 ? `<legend>${game.i18n.format("DRPG.Advance.choice", { n: i + 1 })}</legend>` : ""}
            <select name="pick.${i}.option" data-pick="${i}" aria-label="${game.i18n.localize("DRPG.Advance.whichImprovement")}">
                ${Object.entries(LEVEL_UP_OPTIONS).filter(([key]) => !only || key === only)
                    .map(([key, opt]) => `<option value="${key}"${key === "experienceUp" && !experiences.length ? " disabled" : ""}>${proseOf(opt, "label")}</option>`)
                    .join("")}
            </select>
            <div class="drpg-advance-detail" data-detail="${i}"></div>
        </fieldset>
    `).join("");

    /* A new character with no experiences is the ordinary case, not a fault: a dim note, not Foundry's amber
       warning (S03-19). The option itself is drawn disabled above (E10 C8). */
    const warning = experiences.length
        ? ""
        : `<p class="drpg-advance-note">${game.i18n.localize("DRPG.Advance.noExperiences")}</p>`;

    return `<form>${forLine}<p>${intro}</p>${warning}${rows}</form>`;
}

/**
 * What a point in this statistic raises beside it, in the reader's language, or "" (E64 C6; DA39): read off
 * `LEVEL_UP_TRAIT_RESOURCES`, so the picker and the summary say what the write does.
 */
export function traitRaisesNote(dh) {
    const rises = LEVEL_UP_TRAIT_RESOURCES[dh] ?? {};
    return [rises.hitPoints ? game.i18n.localize("DRPG.Advance.raisesHealth") : "", rises.stress ? game.i18n.localize("DRPG.Advance.raisesSanity") : ""]
        .filter(Boolean).join(", ");
}

/** Swap the detail control whenever a pick's option changes. */
function wireForm(dialog, picks, actor, experiences) {
    const root = dialog.element;

    for (let i = 0; i < picks; i++) {
        const select = root.querySelector(`select[data-pick="${i}"]`);
        const detail = root.querySelector(`[data-detail="${i}"]`);
        if (!select || !detail) continue;

        const refresh = () => {
            detail.innerHTML = buildDetail(select.value, i, actor, experiences);
        };
        select.addEventListener("change", refresh);
        refresh();
    }
}

function buildDetail(option, index, actor, experiences) {
    switch (option) {
        case "trait": {
            const options = Object.entries(TRAITS)
                .map(([, t]) => {
                    const value = actor.system.traits?.[t.dh]?.value ?? 0;
                    const sign = value > 0 ? `+${value}` : `${value}`;
                    // What the point raises with it (E64 C6, DA39): said on the option, before the pick.
                    const also = traitRaisesNote(t.dh);
                    return `<option value="${t.dh}">${t.label} (${sign})${also ? ` - ${also}` : ""}</option>`;
                })
                .join("");
            return `<label>${game.i18n.localize("DRPG.Advance.whichTrait")}
                        <select name="pick.${index}.trait">${options}</select>
                    </label>`;
        }

        case "experienceUp": {
            if (!experiences.length) {
                return `<p class="drpg-advance-note">${game.i18n.localize("DRPG.Advance.noExperiences")}</p>`;
            }
            const options = experiences
                .map(e => `<option value="${e.id}">${foundry.utils.escapeHTML(e.name || "-")} (+${e.value ?? 0})</option>`)
                .join("");
            return `<label>${game.i18n.localize("DRPG.Advance.whichExperience")}
                        <select name="pick.${index}.experience">${options}</select>
                    </label>`;
        }

        case "experienceNew":
            return `<label>${game.i18n.localize("DRPG.Advance.newExperienceName")}
                        <input type="text" name="pick.${index}.name" placeholder="${game.i18n.localize("DRPG.Advance.newExperiencePlaceholder")}" />
                    </label>`;

        default:
            return "";
    }
}

function readForm(dialog, picks) {
    const form = dialog.element.querySelector("form");
    if (!form) return null;

    const flat = readFormData(form);
    const data = foundry.utils.expandObject(flat);
    const list = [];

    for (let i = 0; i < picks; i++) {
        const pick = data.pick?.[i];
        if (!pick?.option) continue;
        list.push(pick);
    }
    return list;
}

/* ==========================================================================
 * APPLY
 * ========================================================================== */

/**
 * Turn a list of picks into a single actor update, so three "+1 max Health" picks
 * accumulate instead of overwriting each other.
 *
 * ONE WRITE, ONE ADVANCE (E05 C11, 27.09.2026). The rises and the `advances` count went
 * as two updates, a rise and then `setFlag`; they are one now, so a Standard and a
 * Reinforced that waited for the class (`runAdvancementBatch`) are one write and one step
 * of `advances`, and a batch of survivors is as many writes as survivors.
 *
 * @param {object} [options]
 * @param {string[]} [options.reasons]  the translation keys the card gives as the reason
 * @param {string} [options.offerId]    the offer this spends (a player's picks); none for a GM's own
 */
export async function applyAdvancement(actor, picks, kind = "standard", { reasons = null, offerId = null } = {}) {
    // Same guard as `openAdvancement`, and for the same reason. This is also on
    // `game.drpg`, and it writes through `trustedWrite` - which bypasses the
    // resource guard by design - so without it a player could raise their own
    // max Health and traits from the console with a single call, walking straight
    // past the check the dialog in front of it makes. Since E29 C3 the primary GM
    // puts such a rise from a player's browser back as well (sheet-audit.mjs); this
    // gate keeps the road a GM's, which is what makes its write the student's new mark.
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }
    if (!actor || !picks?.length) return null;

    const update = {};
    const summary = [];

    // Accumulate the rises; what they rise from is read as the GMs hold it, when the write is made (below).
    let hpUp = 0;
    let stressUp = 0;
    const traitDeltas = {};
    const experienceDeltas = {};
    const newExperiences = {};
    /* A PICK THIS SHEET CANNOT TAKE STOPS THE WHOLE LEVEL UP (E10 C8, 1.2.71; audit S03-22). A
       statistic that is not one, or an experience to raise that is not named, was skipped and the
       rest written - one write, one step of `advances`, a pick gone without a word; and an
       experience the sheet did not have took a value of its own. A GM's console and any picker reach
       this as well as the bridge, whose handler refuses the same picks first and tells the player. */
    const statistics = new Set(Object.values(TRAITS).map(trait => trait.dh));
    if (picks.some(pick => !Object.hasOwn(LEVEL_UP_OPTIONS, pick?.option ?? "")
        || (pick?.option === "trait" && !statistics.has(pick.trait))
        || (pick?.option === "experienceUp" && typeof pick.experience !== "string"))) {
        ui.notifications.warn(game.i18n.format("DRPG.Advance.notOnSheet", { name: actor.name }));
        return null;
    }

    for (const pick of picks) {
        switch (pick.option) {
            /*
             * NO "+1 HEALTH" OR "+1 SANITY" ANY MORE (E64 C6, 12.11.2026; the owner's DA39, approved 12.11 with the
             * migration of past picks, `applyDa39Migration`). They were options until 1.2.105; a statistic's point raises a maximum instead - Head the
             * Sanity's, Body and Leg the Health's (`LEVEL_UP_TRAIT_RESOURCES`), counted here into the same rises.
             * A pick naming either old option is no option: refused above with the rest (`LEVEL_UP_OPTIONS`).
             */
            case "trait": {
                const key = pick.trait;
                traitDeltas[key] = (traitDeltas[key] ?? 0) + 1;
                const label = Object.values(TRAITS).find(t => t.dh === key)?.label ?? key;
                const rises = LEVEL_UP_TRAIT_RESOURCES[key] ?? {};
                hpUp += Number(rises.hitPoints) || 0;
                stressUp += Number(rises.stress) || 0;
                const also = traitRaisesNote(key);
                summary.push(`+1 ${label}${also ? ` (${also})` : ""}`);
                break;
            }

            case "experienceUp": {
                const id = pick.experience;
                experienceDeltas[id] = (experienceDeltas[id] ?? 0) + 1;
                const name = actor.system.experiences?.[id]?.name ?? id;
                summary.push(`+1 ${name}`);
                break;
            }

            case "experienceNew": {
                const name = String(pick.name ?? "").trim();
                if (!name) {
                    ui.notifications.warn(game.i18n.localize("DRPG.Advance.experienceNeedsName"));
                    break;
                }
                newExperiences[foundry.utils.randomID()] = {
                    name,
                    value: STARTING.experienceValue,
                    description: "",
                    core: false
                };
                summary.push(`${name} (+${STARTING.experienceValue})`);
                break;
            }
        }
    }

    for (const [id, data] of Object.entries(newExperiences)) {
        update[`system.experiences.${id}`] = data;
    }

    if (!hpUp && !stressUp && !Object.keys(traitDeltas).length && !Object.keys(experienceDeltas).length && !Object.keys(update).length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Advance.nothingToApply"));
        return null;
    }

    let taken;
    try {
        // The one road, named `levelUp`. Until E29 C2 this said the road kept the
        // resource guard from stripping the trait rise and leaving a half-applied
        // advancement - true of a player's browser, but the gate above makes this a
        // GM's, where the guard stands aside (audit S03-45: "guarded against
        // hand-editing" overstated it). That guard runs on the writer's own browser and
        // is a courtesy; what keeps the module's own roads off a student's traits and
        // Health and Sanity maxima on a player's console is that each road writing
        // them - this one, `initCharacter` and `restoreStartingSheet` - is a GM's
        // (R79, R221). And since E29 C3 what a console writes there by hand is put back
        // by the primary GM (sheet-audit.mjs), which takes this write, a GM's, as the
        // student's new mark.
        //
        // AS THE GMS HOLD THEM (E29 fix r2-H24, 06.10.2026). The maxima, the statistics, the experiences and the
        // advances each rise from what the GMs hold, read in one job of the student's queue (sheet-audit.mjs
        // `meansWrite`, `numberHeld`): read off the sheet, a console's rise the audit had not put back yet was
        // written on as this GM's, the student's mark from then on. The job writes and awaits nothing else.
        //
        // AS THE SHEET HOLDS THEM, NOT AS DAGGERHEART PREPARES THEM (E29 fix r2-H25, 06.10.2026; found by fix
        // r2-H24). This writes the sheet, which Daggerheart prepares again: it adds a class's hit points to Health's
        // maximum and a Level Up's picks to a statistic or a maximum (character.mjs `prepareBaseData`, 2.10.5). The
        // maxima rose from the prepared one (`meansWrite`'s `maxOf`, the end of a track) and the rest from the
        // prepared value with the GMs' for the sheet's, so the sheet took the class's hit points and a pick a second
        // time: at 525a186 (06.10.2026, e29run/r2h25red; tier 2, "a GM's Level Up rises from the sheet's maximum"), +1
        // Health and +1 to a statistic over a class's 5 hit points and a pick of +1 wrote 12 and 2 for 7 and 1. Each
        // now rises from the sheet's value as the GMs hold it (`numberHeld`).
        const { trustedWrite } = await import("./resource-guard.mjs");
        const { meansWrite, numberHeld, flagsHeldNow } = await import("./sheet-audit.mjs");
        //
        // A NEW EXPERIENCE IS WRITTEN DOWN AS A LEVEL UP'S (E11 C11, 1.2.73; audit S03-21, D12 option 1). The
        // season reset put back the values of the experiences the season began with and kept every other
        // entry, so a Level Up's experience outlived the season it was earned in. Its id now goes into the GM
        // flag `levelUpExperiences` in this same write, added to the list as the GMs hold it (`flagsHeldNow`:
        // this job starts once every write heard on the student has been judged, so it is `flagsAsHeld`
        // without a wait that would be this queue's own); the reset deletes those entries
        // (character.mjs `restoreStartingSheet`) and keeps an experience the GM wrote by hand.
        //
        // THE EXPERIENCE RAISED IS ONE THE GMS HOLD (E10 C8, 1.2.71; audit S03-22), read in the same job as the
        // numbers: one a player's console wrote on the sheet that the audit had not put back yet took this GM's
        // write as its value, and stood from then on in the GMs' mark - an experience nobody named. Held means an
        // entry with a value: such a write, put back, leaves its entry in the mark empty ({}; read on 10.10.2026).
        // Nothing is written then, and the caller is told by the answer, null.
        taken = await meansWrite(actor, async () => {
            const from = path => numberHeld(actor, path) ?? 0;
            const held = numberHeld(actor, "system.experiences") ?? {};
            if (Object.keys(experienceDeltas).some(id => !(Object.hasOwn(held, id) && typeof held[id]?.value === "number"))) return null;
            if (hpUp) update["system.resources.hitPoints.max"] = from("system.resources.hitPoints.max") + hpUp;
            if (stressUp) update["system.resources.stress.max"] = from("system.resources.stress.max") + stressUp;
            for (const [key, delta] of Object.entries(traitDeltas)) {
                update[`system.traits.${key}.value`] = from(`system.traits.${key}.value`) + delta;
            }
            for (const [id, delta] of Object.entries(experienceDeltas)) {
                update[`system.experiences.${id}.value`] = from(`system.experiences.${id}.value`) + delta;
            }
            const added = Object.keys(newExperiences);
            if (added.length) {
                const recorded = flagsHeldNow(actor).getFlag(MODULE_ID, FLAGS.levelUpExperiences);
                update[`flags.${MODULE_ID}.${FLAGS.levelUpExperiences}`] =
                    [...new Set([...(Array.isArray(recorded) ? recorded.filter(id => typeof id === "string") : []), ...added])];
            }
            /* WHAT DA39 GAVE, WRITTEN DOWN (E64; the owner's DRPG-D1 of 12.11.2026): the maxima a statistic's point
               raised, added to `da39Rises`, so the migration (`da39Row`) never takes a rise of the rule for an old pick. */
            if (hpUp || stressUp) {
                const given = flagsHeldNow(actor).getFlag(MODULE_ID, FLAGS.da39Rises) ?? {};
                update[`flags.${MODULE_ID}.${FLAGS.da39Rises}`] = { hitPoints: wholeCount(given.hitPoints) + hpUp, stress: wholeCount(given.stress) + stressUp };
            }
            const taken = from(`flags.${MODULE_ID}.${FLAGS.advances}`) + 1;
            update[`flags.${MODULE_ID}.${FLAGS.advances}`] = taken;
            await trustedWrite(actor, update, { reason: "levelUp" });
            return taken;
        });
    } catch (err) {
        error("Could not apply the advancement", err);
        ui.notifications.error(game.i18n.localize("DRPG.Advance.failed"));
        return null;
    }
    if (taken === null) {
        ui.notifications.warn(game.i18n.format("DRPG.Advance.notOnSheet", { name: actor.name }));
        return null;
    }
    /* WRITTEN IS WRITTEN (E10 fix r1-G1, 1.2.71; the round-1 correctness review's F4). The offer's
       withdrawal, the log and the player's card sat in the try of the write, whose catch answers
       null: a throw in any of them after the write read as a Level Up that failed - the GM told
       "could not be saved", and a GM's row of the class's window, answered null, offered the same
       student a second Level Up. The try ends at the write now; what follows has its own, and the
       answer is the summary of what was written.

       AN OFFER IS SPENT BY BEING TAKEN (N-2) - the one it names, and only that one
       (E10 C6; audit S03-17). Every apply withdrew the character's offer, so a GM's own
       Level Up of a student spent the player's standing one without a word; a GM's
       picker names none now, and a player's picks name theirs (`handleAdvancement`).
       Through the primary GM, which holds the offers. One that cannot be withdrawn still stands,
       and the GM is told to take it back. One already gone is logged (E10 fix r1-G2): a take-back is
       refused while this write is under way (`takeBackOffer`), so it would be news. */
    if (offerId) await withdrawOffer(actor.id, offerId).then(stood => {
        if (!stood) log(`The offer ${offerId} ${actor.name}'s Level Up spent no longer stood.`);
    }).catch(err => {
        error(`Could not withdraw the offer ${actor.name}'s Level Up spent`, err);
        ui.notifications.warn(game.i18n.format("DRPG.Advance.offerStillStands", { name: actor.name }));
    });
    try {
        log(`Advancement (${kind}) applied to ${actor.name}: ${summary.join(", ")}`);
        await tellPlayer(actor, Array.isArray(reasons) && reasons.length ? reasons : [`DRPG.Advance.reason.${kind}`], summary, taken);
    } catch (err) {
        error(`Could not tell ${actor.name}'s player of the Level Up written`, err);
    }
    return summary;
}

/** Private note to the player and the GMs. Advancement is not public knowledge. */
async function tellPlayer(actor, reasons, summary, taken) {
    const { whisperToOwner } = await import("./utils.mjs");
    const title = reasons.map(key => game.i18n.localize(key)).join(" ");
    const items = summary.map(s => `<li>${foundry.utils.escapeHTML(s)}</li>`).join("");
    /*
     * On the card that already reaches the player, and NOT marked for the GMs.
     *
     * Advancement is the survivor's reward and the GMs are on this whisper as
     * witnesses - the same reason the popup diet leaves them out of a card they
     * were merely copied into. A GM applying an advancement already knows: they
     * are the one who pressed it.
     *
     * VEILED, AND THE SOUND ADDRESSED (E05 C11, 27.09.2026; audit S06-01). The card was a
     * whisper spoken by the character with the sound as a flag of the message, and every
     * console receives the document whoever it is whispered to: after a wrong verdict it
     * named the Blackened the class had just missed. It speaks as nobody and is addressed
     * to everybody now (secret.mjs), and the sound goes to the owner alone (`playSfxFor`).
     */
    const card = await whisperToOwner(
        actor,
        `<h3>${game.i18n.format("DRPG.Advance.chatTitle", { n: taken })}</h3>
         <p><em>${title}</em></p>
         <ul>${items}</ul>`,
        { veiled: true }
    );
    try {
        const { playSfxFor } = await import("./sfx.mjs");
        playSfxFor(actor, "levelUp");
    } catch (err) {
        error("Could not play the Level Up's sound to its owner", err);
    }
    return card;
}

/* ==========================================================================
 * THE REINFORCED LEVEL UP WAITS FOR THE CLASS (E05 C11, 27.09.2026; D4; audit
 * S03-01, S06-01)
 * ==========================================================================
 *
 * A wrong verdict applied the surviving Blackened's Reinforced Level Up at once: new
 * maxima and `advances` on the actor and a card spoken by it with the Level Up's sound,
 * all of it world data every console holds - the one student the class had just failed
 * to name, named by the reward. D4 gives everybody's advancement at the chapter's end,
 * which exists only at a correct verdict (verdict.mjs `applyVerdict`), so the Reinforced
 * waits for the class's next correct verdict and is picked with that survivor's
 * Standard, 1 + 3 picks in one window and one write; or for the Final Trial's verdict,
 * when the season's secrets are out anyway (the owner's Q7, option b). It lapses at a
 * kill (death.mjs `killCharacter`) and a season reset (the "advancement" group).
 *
 * A picker the GM closes spends nothing: the Standard is lost as it always was, and the
 * row stays for the next batch rather than going with a misclick.
 */

/** How many picks a deferred row stands for: its kind's, once per wrong verdict it waited through. */
function deferredPicks(row) {
    const per = LEVEL_UP[row?.kind]?.picks ?? 0;
    return per * Math.max(1, Math.trunc(Number(row?.count) || 1));
}

/**
 * Who picks what in one verdict's batch - pure (R195). `survivorIds` are the living
 * students, `rows` the deferred store's rows by actor id, `kind` the Level Up the batch
 * hands out (null at the Final Trial, which hands out only what waited). One entry per
 * survivor who picks anything, with the picker's arguments and `picks`, its total; `drop`
 * names the rows whose character is not among the living, which lapse here if a kill did
 * not already take them, and any row that names no kind there is.
 */
export function advancementPlan(survivorIds, rows = {}, kind = "standard") {
    const own = LEVEL_UP[kind]?.picks ?? 0;
    const alive = new Set(survivorIds ?? []);
    const entries = [];
    for (const actorId of alive) {
        const row = rows?.[actorId];
        const extra = deferredPicks(row);
        if (!own && !extra) continue;
        const base = own ? kind : row.kind;
        entries.push({
            actorId, kind: base, picks: own + extra,
            extraPicks: own ? extra : extra - LEVEL_UP[base].picks,
            deferred: extra > 0,
            reasons: own && extra
                ? [`DRPG.Advance.reason.${kind}`, "DRPG.Advance.reason.withClass"]
                : [`DRPG.Advance.reason.${base}`]
        });
    }
    const drop = Object.keys(rows ?? {}).filter(actorId => !alive.has(actorId) || !deferredPicks(rows[actorId]));
    return { entries, drop };
}

/**
 * A wrong verdict: the surviving Blackened's Level Up is written down for the class's next
 * one, and its owner is told on a veiled card. Nothing is written on the actor. `count` is
 * how many wrong verdicts it stands for - more than one only when an offer that carried
 * several is taken back (`takeBackOffer`, E10 C7). Answers the row, or null.
 */
export async function deferAdvancement(actor, kind = "reinforced", chapter = null, { count: times = 1 } = {}) {
    if (!game.user.isGM || !actor || !LEVEL_UP[kind]?.picks) return null;
    await deferredOfferStore.whenHydrated();
    const held = deferredOfferStore.get(actor.id);
    const count = (held?.kind === kind ? Math.max(1, Math.trunc(Number(held.count) || 1)) : 0) + Math.max(1, wholeCount(times));
    const row = { kind, chapter, at: Date.now(), count };
    await deferredOfferStore.patch(actor.id, row, { whole: true });

    const { whisperToOwner } = await import("./utils.mjs");
    await whisperToOwner(actor, `<p><strong>${game.i18n.localize("DRPG.Advance.offerTitle")}</strong></p>
        <p>${plural("DRPG.Advance.deferred", { n: deferredPicks(row) })}</p>`, { veiled: true });
    log(`${actor.name}'s ${kind} Level Up waits for the class's next one.`);
    return row;
}

/*
 * ONE WINDOW FOR THE CLASS (E10 C7, 1.2.71; D4; audit S06-25, S03-32). The batch opened one
 * picker per survivor in turn on the GM's screen - a verdict with eight survivors was eight
 * windows while the players waited - and a picker the GM closed spent nothing and said nothing,
 * though the verdict's line had already told the GMs that every survivor took one. Now one
 * window asks, row by row, who picks: the player (an offer that lights their sheet,
 * `offerAdvancement`) or the GM (the picker, in turn, after the window). A row opens on the
 * player when a connected player owns the student, on "I pick" otherwise, and a student nobody
 * plays has "I pick" only; "All: the players pick" hands every row a player owns to its player.
 * Closing the window is the players picking where there is one, and so is closing a picker;
 * what is left - a student nobody plays whose picker was closed, or the window - is "not yet
 * given", said to the GM and named in the verdict's line, and the sheet's Level Up gives it.
 *
 * THE BLACKENED'S WAITING REINFORCED IS THE SAME ROW (D4, option 1). With the GM picking it is
 * one picker of 1 + 3, as since E05 C11; with the player, one offer of the Standard whose
 * `extra` is the waited picks - one offer, one write, one step of `advances` when it is spent.
 * That a row carries it is said in the window, which is the GM's, and on the veiled card to its
 * owner; the copy of the offer the owner's browser is sent has no `deferred` (`offersFor`). Its row
 * in the GMs' store goes as soon as the offer stands, not when it is spent: a second correct
 * verdict before the player picks would otherwise hand the waited picks out again. Taking the
 * offer back puts the row back (`takeBackOffer`).
 *
 * Answers `{ opened, applied, offered, notGiven, lapsed }`: the rows, how many the GM picked
 * and wrote, how many wait for their players, the names not yet given, the rows that lapsed.
 *
 * `given` are the students a verdict's batch gave one already before it stopped, and `onGiven`
 * is told each row given here, written or offered, once its waiting row is gone (verdict.mjs
 * `verdictLevelUps`; E10 fix r1-G1). The given are still among the living: their rows are
 * not drawn, and their waiting rows do not lapse.
 *
 * THE ROW IN FLIGHT (E42 C1c, 1.2.97; E42-05). `onGiving(actor, { offers, advances })` is told each row before
 * its write - the offers standing on the student and their `advances` as this GM holds them (`givenCounts`) - and
 * `giving` is that snapshot of a batch that stopped (verdict.mjs `verdictStore.giving`). A `giving` row not in
 * `given` is settled first: given when either count grew since the snapshot - its write landed and its record did
 * not, a closed tab between the two - and then its waiting Reinforced is dropped if it still stands and `onGiven`
 * told; drawn again otherwise. A GM who also gave that student a Level Up by hand between the snapshot and the
 * Finish reads as given too (the counts grew): said here, not measured.
 */
export async function runAdvancementBatch(actors, kind = "standard", { given = [], giving = null, onGiving = null, onGiven = null } = {}) {
    if (!game.user.isGM) return null;
    await deferredOfferStore.whenHydrated();
    const byId = new Map((actors ?? []).filter(Boolean).map(a => [a.id, a]));
    const handled = new Set(given);
    const { entries: planned, drop } = advancementPlan([...byId.keys()], deferredOfferStore.entries(), kind);
    const flying = giving?.actorId && !handled.has(giving.actorId) ? byId.get(giving.actorId) : null;
    if (flying && await rowGrew(flying, giving)) {
        if (planned.find(entry => entry.actorId === flying.id)?.deferred) await deferredOfferStore.drop(flying.id);
        handled.add(flying.id);
        await onGiven?.(flying);
    }
    const entries = planned.filter(entry => !handled.has(entry.actorId));
    if (drop.length) await deferredOfferStore.dropMany(drop);
    const done = { opened: entries.length, applied: 0, offered: 0, notGiven: [], lapsed: drop.length };
    if (!entries.length) return done;
    const rows = entries.map(entry => {
        const actor = byId.get(entry.actorId);
        const owners = ownerIdsOf(actor);
        return { entry, actor, playable: owners.length > 0, here: owners.some(id => game.users.get(id)?.active) };
    });
    const who = await askWhoPicks(rows);
    for (const { entry, actor, playable, here } of rows) {
        try {
            await onGiving?.(actor, await givenCounts(actor));
            const choice = !who ? (playable ? "player" : null) : who[actor.id] ?? (playable && here ? "player" : "gm");
            if (choice === "gm" && await openAdvancement(actor, entry.kind, { extraPicks: entry.extraPicks, reasons: entry.reasons })) {
                done.applied++;
                if (entry.deferred) await deferredOfferStore.drop(actor.id);
                await onGiven?.(actor);
                continue;
            }
            // The waited picks: all of them at the Final Trial (no kind of the batch's own), the extra otherwise.
            const waited = entry.deferred ? (LEVEL_UP[kind]?.picks ? entry.extraPicks : entry.picks) : 0;
            if (playable && await offerAdvancement(actor, entry.kind,
                { extra: entry.extraPicks, deferred: waited, veiled: true, quiet: true })) {
                done.offered++;
                if (entry.deferred) await deferredOfferStore.drop(actor.id);
                await onGiven?.(actor);
                continue;
            }
            done.notGiven.push(actor.name);
            ui.notifications.warn(game.i18n.format("DRPG.Advance.notYetGiven", { name: actor.name }));
        } catch (err) {
            error(`Could not open the advancement for ${actor.name}`, err);
        }
    }
    return done;
}

/*
 * What a row's Level Up raises (E42 C1c): the offers standing on the student and their `advances`, as this GM holds
 * them. The advances AS THE GMS HOLD THEM since E42 fix FG4 (the end review's S-M3): they were read off the document,
 * where a player's own raised value stands until the primary puts it back, and a Finish then read that row as given.
 * Read through the GMs' mark after the student's audit (`judgedFor`, `flagsHeldNow`; R311).
 */
async function givenCounts(actor) {
    const { judgedFor, flagsHeldNow } = await import("./sheet-audit.mjs");
    await judgedFor(actor.id);
    const advances = flagsHeldNow(actor).getFlag(MODULE_ID, FLAGS.advances);
    return { offers: standingOffers(actor).length, advances: Math.max(0, Math.trunc(Number(advances) || 0)) };
}

/** Whether a row's Level Up landed since `snapshot` (`givenCounts` before its write): either count grew. */
async function rowGrew(actor, snapshot) {
    const now = await givenCounts(actor);
    return now.offers > (Number(snapshot?.offers) || 0) || now.advances > (Number(snapshot?.advances) || 0);
}

/**
 * The class's one Level Up window (E10 C7): a row per entry, who picks it. Answers each row's
 * choice by actor id - "player" or "gm" - or null when the window is closed. A row with nobody
 * to hand it to reads "gm" whatever the form says.
 *
 * "HAND THEM OUT" FIRST (E10 fix r1-G2, 1.2.71; the round-1 goal verifier's item (b)). C7 marked
 * it the default - the window's answer is what its rows say - but listed "All: the players pick"
 * first, and Enter in a DialogV2 presses the first submit button in DOM order whatever carries
 * `default` (verdict.mjs `openVerdictDialog`, E10 C4): a GM who set rows to "I pick" and pressed
 * Enter handed every row to its player. Measured on the harness at 1a9a07e (tier 2, "Enter in
 * the class's Level Up window gives what its rows say"): every row "I pick", the form submitted
 * by its first button, the answer was "player" for each. The key itself in Foundry's window is
 * not measured here (the verdict window's is LIVE-E10-02).
 */
async function askWhoPicks(rows) {
    const L = key => game.i18n.localize(key);
    const esc = foundry.utils.escapeHTML;
    const radio = (actor, value, label, checked) =>
        `<label><input type="radio" name="who-${actor.id}" value="${value}"${checked ? " checked" : ""}> ${L(label)}</label>`;
    const items = rows.map(({ entry, actor, playable, here }) => `<li class="drpg-advance-queue-row" data-actor-id="${actor.id}">
            <strong>${esc(actor.name)}</strong> <span>${plural("DRPG.Advance.queuePicks", { n: entry.picks })}</span>
            ${entry.deferred ? `<small>${L("DRPG.Advance.reason.withClass")}</small>` : ""}
            <span class="drpg-advance-queue-who">${playable ? radio(actor, "player", "DRPG.Advance.pickPlayer", here) : ""}${
                radio(actor, "gm", "DRPG.Advance.pickMe", !(playable && here))}</span>
        </li>`).join("");
    const read = (dialog, everyPlayer) => Object.fromEntries(rows.map(({ actor, playable, here }) => {
        const checked = everyPlayer ? "player" : dialog?.element?.querySelector?.(`input[name="who-${actor.id}"]:checked`)?.value;
        return [actor.id, playable && (checked ?? (here ? "player" : "gm")) === "player" ? "player" : "gm"];
    }));
    /* On the kit (E21 C6a): Hand them out on the right, the default and the first submit button; All: the players pick a
       secondary on the left. No closing word: a close already answers null, which hands every row its player (below),
       so a Cancel would say "nothing" and do that. */
    return drpgWindow({
        title: L("DRPG.Advance.queueTitle"),
        classes: ["drpg-panel", "drpg-advance-queue"],
        prompt: true,
        body: `<p>${L("DRPG.Advance.queueIntro")}</p><ul class="drpg-advance-queue-list">${items}</ul>`,
        footer: {
            primary: { action: "give", label: L("DRPG.Advance.queueGive"), callback: (event, button, dialog) => read(dialog, false) },
            secondary: [{ action: "allPlayers", label: L("DRPG.Advance.allPlayers"), callback: (event, button, dialog) => read(dialog, true) }]
        },
        rejectClose: false
    });
}

/* ==========================================================================
 * THE DA39 MIGRATION (E64; the owner's DRPG-D1 of 12.11.2026)
 * --------------------------------------------------------------------------
 * The owner: "co z graczami ktorzy juz rozdali level up w maks health/sanity? Trzeba to jakos zmigrowac" and
 * "Rekompensujemy by lvl upy byly spojne"; the proposal accepted as written ("Akceptuje nowe E64"). A world played
 * before DA39 holds +1 Health and +1 Sanity picks, and statistic points that raised no maximum. No pick is recorded:
 * `applyAdvancement` writes its rises onto the sheet and counts `advances`. A sheet the module set up
 * (`initCharacter`: Health STARTING.hp, Sanity STARTING.stress, and the season's stamp `sheetAtStart`) shows the old
 * picks as the maxima above those, and the points since the stamp as the statistics above it. A maximum a GM raised by
 * hand reads the same, so the pass is shown to the GM first and applied only on the GM's word (`offerDa39Migration`).
 * ========================================================================== */

/**
 * One sheet's row, pure (R3963): `hpMax`, `stressMax`, `traits` (Daggerheart's statistic keys) as the GMs hold them,
 * `snapshot` the stamp's statistics (null for none) and `rises` the `da39Rises` the rule gave already. Old picks are the
 * maxima above STARTING less those rises, never below 0, and each is handed out as one statistic point; the points since
 * the stamp in a statistic of `LEVEL_UP_TRAIT_RESOURCES` owe their rise, less what was given. Answers the counts and
 * the maxima after.
 */
export function da39Row({ hpMax = 0, stressMax = 0, traits = {}, snapshot = null, rises = null } = {}) {
    const whole = value => Math.max(0, Math.trunc(Number(value) || 0));
    const given = { hitPoints: whole(rises?.hitPoints), stress: whole(rises?.stress) };
    const hpOld = whole(Number(hpMax) - STARTING.hp - given.hitPoints);
    const sanOld = whole(Number(stressMax) - STARTING.stress - given.stress);
    /* The rises owed, per statistic (`retroByTrait`), each one a change the GM confirms on its own
       (`offerDa39Migration`): the points since the stamp, less the rises the rule gave already - taken off the
       statistics in LEVEL_UP_TRAIT_RESOURCES' order, as the flag does not say which point a rise was for. */
    const left = { ...given };
    const retroByTrait = {};
    if (snapshot && typeof snapshot === "object") {
        for (const [key, rise] of Object.entries(LEVEL_UP_TRAIT_RESOURCES)) {
            const points = whole((Number(traits?.[key]) || 0) - (Number(snapshot[key]) || 0));
            const resource = whole(rise.hitPoints) ? "hitPoints" : "stress";
            const covered = Math.min(points, left[resource]);
            left[resource] -= covered;
            if (points - covered) retroByTrait[key] = points - covered;
        }
    }
    const owed = resource => Object.entries(retroByTrait)
        .reduce((sum, [key, n]) => sum + n * whole(LEVEL_UP_TRAIT_RESOURCES[key]?.[resource]), 0);
    const hpRetro = owed("hitPoints");
    const sanRetro = owed("stress");
    return { hpOld, sanOld, hpRetro, sanRetro, retroByTrait, points: hpOld + sanOld,
        hpMax: Number(hpMax) - hpOld + hpRetro, stressMax: Number(stressMax) - sanOld + sanRetro };
}

/**
 * A row held to the changes the GM said yes to (`take`: `{ hpOld, sanOld, rises: { [trait]: n } }`, each a count no
 * larger than the row's; the owner's DRPG-D1 of 12.11.2026, "oba wymagajace potwierdzenia gma do kazdego przypadku"):
 * a change refused is left as it was - its pick kept and no point for it, its rise not given. Pure.
 */
export function da39Taken(row, take = {}) {
    const whole = value => Math.max(0, Math.trunc(Number(value) || 0));
    const hpOld = Math.min(row.hpOld, whole(take.hpOld));
    const sanOld = Math.min(row.sanOld, whole(take.sanOld));
    const retroByTrait = {};
    for (const [key, n] of Object.entries(row.retroByTrait ?? {})) {
        const yes = Math.min(n, whole(take.rises?.[key]));
        if (yes) retroByTrait[key] = yes;
    }
    const owed = resource => Object.entries(retroByTrait)
        .reduce((sum, [key, n]) => sum + n * whole(LEVEL_UP_TRAIT_RESOURCES[key]?.[resource]), 0);
    const hpRetro = owed("hitPoints"), sanRetro = owed("stress");
    const hpMax = row.hpMax + row.hpOld - row.hpRetro, stressMax = row.stressMax + row.sanOld - row.sanRetro;
    return { ...row, hpOld, sanOld, hpRetro, sanRetro, retroByTrait, points: hpOld + sanOld,
        hpMax: hpMax - hpOld + hpRetro, stressMax: stressMax - sanOld + sanRetro };
}

/** A student's row as the GMs hold the sheet, or null for one the module did not set up (no stamp) or with nothing to change. */
async function da39RowOf(actor) {
    const { numberHeld, flagsHeldNow } = await import("./sheet-audit.mjs");
    const flags = flagsHeldNow(actor);
    const stamp = flags.getFlag(MODULE_ID, FLAGS.sheetAtStart);
    if (!stamp?.traits || flags.getFlag(MODULE_ID, FLAGS.monokuma)) return null;
    const traits = Object.fromEntries(Object.keys(LEVEL_UP_TRAIT_RESOURCES)
        .map(key => [key, numberHeld(actor, `system.traits.${key}.value`) ?? 0]));
    const row = da39Row({ hpMax: numberHeld(actor, "system.resources.hitPoints.max"), stressMax: numberHeld(actor, "system.resources.stress.max"),
        traits, snapshot: stamp.traits, rises: flags.getFlag(MODULE_ID, FLAGS.da39Rises) });
    return row.hpOld || row.sanOld || row.hpRetro || row.sanRetro ? { actorId: actor.id, name: actor.name, ...row } : null;
}

/** The pass as it would run now, a row per student that changes: read only. A GM's. */
export async function da39MigrationPlan() {
    if (!game.user?.isGM) return [];
    const rows = [];
    for (const actor of game.actors ?? []) {
        if (actor.type !== "character") continue;
        const row = await da39RowOf(actor);
        if (row) rows.push(row);
    }
    return rows;
}

/** A row's change in the table's words: "-2 Health max, +1 Sanity max, 3 statistic points". */
function da39Words(row) {
    const parts = [];
    const net = (old, retro, key) => {
        const delta = retro - old;
        if (delta) parts.push(game.i18n.format(key, { n: delta > 0 ? `+${delta}` : `${delta}` }));
    };
    net(row.hpOld, row.hpRetro, "DRPG.Advance.da39.health");
    net(row.sanOld, row.sanRetro, "DRPG.Advance.da39.sanity");
    if (row.points) parts.push(plural("DRPG.Advance.da39.points", { n: row.points }));
    return parts.join(", ");
}

/**
 * The pass, on the primary GM, with what the GM said yes to: `takes` is `[{ actorId, hpOld, sanOld, rises }]`, each a
 * student's counts of confirmed changes (`da39Taken`; the owner's DRPG-D1 of 12.11.2026, "oba wymagajace potwierdzenia
 * gma do kazdego przypadku"). Each student's row is read again in their queue (`meansWrite`), held to those counts and
 * written in one write - the maxima, the marks held to them, the rises given (`da39Rises`); then the points of the
 * picks taken back are handed out as one offer limited to statistics (`only: "trait"`), its owner told. A student no
 * player owns gets no offer; the GMs' card says so. The world is marked done (`levelUpsMigrated`) whatever was
 * confirmed: a change refused stays as it is. Answers the rows written.
 */
export async function applyDa39Migration(takes) {
    if (!isPrimaryGm()) return [];
    const { meansWrite, numberHeld, flagsHeldNow } = await import("./sheet-audit.mjs");
    const { trustedWrite } = await import("./resource-guard.mjs");
    const { whisperToOwner, whisperToGms, esc } = await import("./utils.mjs");
    const { SETTINGS } = await import("./settings.mjs");
    const done = [];
    for (const take of Array.isArray(takes) ? takes : []) {
        const actor = game.actors.get(take?.actorId ?? "");
        if (!actor) continue;
        const row = await meansWrite(actor, async () => {
            const found = await da39RowOf(actor);
            const now = found ? da39Taken(found, take) : null;
            if (!now || !(now.hpOld || now.sanOld || now.hpRetro || now.sanRetro)) return null;
            const given = flagsHeldNow(actor).getFlag(MODULE_ID, FLAGS.da39Rises) ?? {};
            const whole = value => Math.max(0, Math.trunc(Number(value) || 0));
            const update = {
                "system.resources.hitPoints.max": now.hpMax,
                "system.resources.stress.max": now.stressMax,
                [`flags.${MODULE_ID}.${FLAGS.da39Rises}`]: { hitPoints: whole(given.hitPoints) + now.hpRetro, stress: whole(given.stress) + now.sanRetro }
            };
            const hp = numberHeld(actor, "system.resources.hitPoints.value") ?? 0;
            const san = numberHeld(actor, "system.resources.stress.value") ?? 0;
            if (hp > now.hpMax) update["system.resources.hitPoints.value"] = now.hpMax;
            if (san > now.stressMax) update["system.resources.stress.value"] = now.stressMax;
            await trustedWrite(actor, update, { reason: "levelUp" });
            return now;
        });
        if (!row) continue;
        let offered = false;
        if (row.points && ownerIdsOf(actor).length) {
            offered = Boolean(await recordOffer(actor.id, { kind: "standard", extra: row.points - 1, only: "trait" }));
            if (offered) {
                await whisperToOwner(actor, `<p><strong>${game.i18n.localize("DRPG.Advance.offerTitle")}</strong></p><p>${
                    plural("DRPG.Advance.da39.toPlayer", { n: row.points })}</p>`, { veiled: true });
            }
        }
        done.push({ ...row, offered });
        log(`DA39 migration: ${actor.name} - Health max ${row.hpMax}, Sanity max ${row.stressMax}, ${row.points} statistic point(s)${row.points && !offered ? " not offered (no player)" : ""}.`);
    }
    await game.settings.set(MODULE_ID, SETTINGS.levelUpsMigrated, true);
    if (done.length) {
        const items = done.map(row => `<li>${esc(row.name)}: ${esc(da39Words(row))}${row.points && !row.offered
            ? ` - ${esc(game.i18n.localize("DRPG.Advance.da39.noPlayer"))}` : ""}</li>`).join("");
        await whisperToGms(`<p><strong>${esc(game.i18n.localize("DRPG.Advance.da39.title"))}</strong></p><ul>${items}</ul>`)
            .catch(err => error("Could not tell the GMs what the DA39 migration changed", err));
    }
    return done;
}

/**
 * On the primary GM's load (migrate.mjs `runMigrationOnLoad`, after the data migration's pass): once per world, the
 * plan; with nothing to do the world is marked done, awaited; else the window (`offerDa39Migration`) opens and is not
 * waited on. Answers the plan's length, or null where nothing was asked.
 */
export async function startDa39Migration() {
    if (!isPrimaryGm()) return null;
    const { SETTINGS } = await import("./settings.mjs");
    if (game.settings.get(MODULE_ID, SETTINGS.levelUpsMigrated)) return null;
    const plan = await da39MigrationPlan();
    if (!plan.length) {
        await game.settings.set(MODULE_ID, SETTINGS.levelUpsMigrated, true);
        return 0;
    }
    void offerDa39Migration(plan).catch(err => error("The DA39 migration's window could not open", err));
    return plan.length;
}

/** The statistic's name as the table reads it (Head, Body, Leg), from Daggerheart's key. */
function traitName(dh) {
    return Object.values(TRAITS).find(trait => trait.dh === dh)?.label ?? dh;
}

/**
 * The window's changes, one box each, none ticked (pure): a +1 Health pick, a +1 Sanity pick, a point's rise. Each box's
 * name is `da39.<actorId>.<what>.<n>`, `what` one of `hpOld`, `sanOld` or `rise-<trait>` - what `readDa39Answers` counts.
 */
export function da39Boxes(plan) {
    const esc = text => foundry.utils.escapeHTML(String(text ?? ""));
    return plan.map(row => {
        const boxes = [];
        const box = (what, n, text) => boxes.push(`<label class="drpg-choice"><input type="checkbox" name="da39.${esc(row.actorId)}.${what}.${n}">`
            + `<span class="drpg-choice-text">${esc(text)}</span></label>`);
        for (let n = 0; n < row.hpOld; n++) box("hpOld", n, game.i18n.localize("DRPG.Advance.da39.takeHealth"));
        for (let n = 0; n < row.sanOld; n++) box("sanOld", n, game.i18n.localize("DRPG.Advance.da39.takeSanity"));
        for (const [key, count] of Object.entries(row.retroByTrait ?? {})) {
            const what = LEVEL_UP_TRAIT_RESOURCES[key]?.hitPoints ? "DRPG.Advance.da39.riseHealth" : "DRPG.Advance.da39.riseSanity";
            for (let n = 0; n < count; n++) box(`rise-${key}`, n, game.i18n.format(what, { trait: traitName(key) }));
        }
        return `<fieldset class="drpg-da39-row" data-drpg-da39="${esc(row.actorId)}"><legend>${esc(row.name)}</legend>${boxes.join("")}</fieldset>`;
    }).join("");
}

/** The ticked boxes as `applyDa39Migration`'s `takes` (pure on the names): a count per student and change. */
export function readDa39Answers(names) {
    const takes = new Map();
    for (const name of names ?? []) {
        const [head, actorId, what] = String(name).split(".");
        if (head !== "da39" || !actorId || !what) continue;
        const take = takes.get(actorId) ?? { actorId, hpOld: 0, sanOld: 0, rises: {} };
        if (what === "hpOld" || what === "sanOld") take[what] += 1;
        else if (what.startsWith("rise-")) take.rises[what.slice(5)] = (take.rises[what.slice(5)] ?? 0) + 1;
        takes.set(actorId, take);
    }
    return [...takes.values()];
}

/**
 * The window: every change of every student a box of its own, none ticked; Apply writes the ticked ones
 * (`applyDa39Migration`), and a box left empty leaves its change as it was; Cancel writes nothing, and the next load asks
 * again. `plan` read now when none is given. Answers the rows written, or null.
 */
export async function offerDa39Migration(plan = null) {
    if (!isPrimaryGm()) return null;
    plan ??= await da39MigrationPlan();
    if (!plan.length) return null;
    const { esc } = await import("./utils.mjs");
    const answer = await drpgWindow({
        title: game.i18n.localize("DRPG.Advance.da39.title"),
        classes: ["drpg-panel"],
        body: `<form><p>${esc(game.i18n.localize("DRPG.Advance.da39.intro"))}</p>${da39Boxes(plan)}<p class="drpg-help">${
            esc(game.i18n.localize("DRPG.Advance.da39.handNote"))}</p></form>`,
        footer: {
            primary: { action: "apply", label: game.i18n.localize("DRPG.Advance.da39.apply"), callback: (event, button, dialog) => {
                const root = dialog?.element ?? dialog;
                return { ticked: [...(root?.querySelectorAll?.('input[type="checkbox"]:checked') ?? [])].map(input => input.name) };
            } },
            close: { role: "cancel", action: "later", callback: () => "later" }
        },
        rejectClose: false
    });
    return answer && typeof answer === "object" ? applyDa39Migration(readDa39Answers(answer.ticked)) : null;
}
