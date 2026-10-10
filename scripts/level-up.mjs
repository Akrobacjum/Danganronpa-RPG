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

import { MODULE_ID, FLAGS, LEVEL_UP, LEVEL_UP_OPTIONS, TRAITS, STARTING, TRIAL } from "./config.mjs";
import { listExperiences } from "./character.mjs";
import { log, error, isPrimaryGm, ownerIdsOf, plural } from "./utils.mjs";
import { offerStore, offerCopy, deferredOfferStore } from "./gm-stores.mjs";
import { gmStoresQuiet } from "./gm-store.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

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

    // The module's one menu shape - see `chooseVariant` in action-rolls.mjs.
    // Imported dynamically because this window is opened from a sheet button
    // and a GM console, neither of which is on a path that has already paid
    // for that module.
    const { chooseVariant } = await import("./action-rolls.mjs");

    /* WHAT STANDS, AND TAKING IT BACK (E10 C6; audit S03-17). The GM's sheet showed no offer
       and this menu had no way back from one: an offer made by mistake stood until it was
       spent. Each standing offer is a third choice here, oldest first. */
    const standing = standingOffers(actor).map(offer => ({
        value: `take:${offer.id}`, icon: "fa-rotate-left",
        label: game.i18n.format("DRPG.Advance.takeBack", { kind: game.i18n.localize(`DRPG.Advance.kind.${offer.kind}`) })
    }));

    const picked = await chooseVariant({
        actor,
        title: game.i18n.format("DRPG.Advance.title", { actor: actor.name }),
        prompt: game.i18n.format("DRPG.Advance.whichKind", {
            actor: foundry.utils.escapeHTML(actor.name)
        }),
        options: [
            { value: "standard", icon: "fa-arrow-up",
              label: game.i18n.localize("DRPG.Advance.kind.standard"),
              hint: game.i18n.localize("DRPG.Advance.kind.standardHint") },
            { value: "reinforced", icon: "fa-shield-halved",
              label: game.i18n.localize("DRPG.Advance.kind.reinforced"),
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
                at: Number(offer.at) || 0 }));
    }
    return LEVEL_UP[row.kind]?.picks ? [{ id: LEGACY_OFFER, kind: row.kind, extra: 0, deferred: 0, at: Number(row.at) || 0 }] : [];
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
        added = { id: foundry.utils.randomID(), kind: asked.kind, extra: wholeCount(asked.extra), deferred: wholeCount(asked.deferred),
            at: Date.now() };
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
        // What the owner's picker needs and nothing more: not when, nor which one waited for the class.
        const list = offerList(held[actor.id]).map(({ id, kind, extra }) => ({ id, kind, extra }));
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

/** Owner: take the set the primary sent where it is newer (`offerCopy`), and redraw. */
export async function receiveOffers(offers, stamps) {
    const before = readOffers();
    const mine = {};
    for (const [actorId, row] of Object.entries(offers ?? {})) {
        // Bounded here as well: only a character this user owns, only a real kind.
        if (!game.actors.get(actorId)?.isOwner) continue;
        const list = offerList(row).map(({ id, kind, extra }) => ({ id, kind, extra }));
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
 * A GM takes one offer back (E10 C6; audit S03-17): the third choice of the sheet's Level Up
 * menu, one per standing offer. Its owner's button goes out with the set the primary sends.
 * An offer carrying a Reinforced that waited for the class (`deferred`, E10 C7) gives it back
 * to the GMs' store, waiting for the next batch as it was before the offer: taking the offer
 * back takes back the class's Standard, not what the Blackened earned. Answers whether it was
 * taken.
 */
export async function takeBackOffer(actor, offerId) {
    if (!game.user.isGM || !actor) return false;
    const offer = standingOffers(actor).find(standing => standing.id === offerId);
    if (!offer || !await withdrawOffer(actor.id, offerId)) return false;
    if (offer.deferred) {
        const kind = TRIAL.wrong.blackenedLevelUp;
        await deferAdvancement(actor, kind, null, { count: Math.max(1, Math.round(offer.deferred / (LEVEL_UP[kind]?.picks || 1))) });
    }
    ui.notifications.info(game.i18n.format("DRPG.Advance.takenBack", {
        name: actor.name, kind: game.i18n.localize(`DRPG.Advance.kind.${offer.kind}`)
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
    const line = game.i18n.format("DRPG.Advance.offered", {
        kind: game.i18n.localize(`DRPG.Advance.kind.${kind}`),
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

    const result = await DialogV2.wait({
        window: { title: game.i18n.format("DRPG.Advance.title", { actor: actor.name }) },
        classes: ["drpg-advance"],
        content: buildContent(picks, experiences, why),
        buttons: [
            {
                action: "apply",
                label: game.i18n.localize("DRPG.Advance.apply"),
                default: true,
                callback: (event, button, dialog) => readForm(dialog, picks)
            },
            {
                action: "cancel",
                label: game.i18n.localize("DRPG.Advance.cancel")
            }
        ],
        render: (event, dialog) => wireForm(dialog, picks, actor, experiences),
        rejectClose: false
    });

    if (!result || result === "cancel") return null;

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

function buildContent(picks, experiences, reasons) {
    const intro = game.i18n.format(
        picks === 1 ? "DRPG.Advance.introOne" : "DRPG.Advance.introMany",
        { picks, reason: reasons.map(key => game.i18n.localize(key)).join(" ") }
    );

    const rows = Array.from({ length: picks }, (_, i) => `
        <fieldset class="drpg-advance-pick" data-index="${i}">
            <legend>${game.i18n.format("DRPG.Advance.choice", { n: i + 1 })}</legend>
            <select name="pick.${i}.option" data-pick="${i}">
                ${Object.entries(LEVEL_UP_OPTIONS)
                    .map(([key, opt]) => `<option value="${key}">${opt.label}</option>`)
                    .join("")}
            </select>
            <div class="drpg-advance-detail" data-detail="${i}"></div>
        </fieldset>
    `).join("");

    const warning = experiences.length
        ? ""
        : `<p class="notification warning">${game.i18n.localize("DRPG.Advance.noExperiences")}</p>`;

    return `<form><p>${intro}</p>${warning}${rows}</form>`;
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
                    return `<option value="${t.dh}">${t.label} (${sign})</option>`;
                })
                .join("");
            return `<label>${game.i18n.localize("DRPG.Advance.whichTrait")}
                        <select name="pick.${index}.trait">${options}</select>
                    </label>`;
        }

        case "experienceUp": {
            if (!experiences.length) {
                return `<p class="notification warning">${game.i18n.localize("DRPG.Advance.noExperiences")}</p>`;
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

    for (const pick of picks) {
        switch (pick.option) {
            case "hp":
                hpUp += 1;
                summary.push(LEVEL_UP_OPTIONS.hp.label);
                break;

            case "stress":
                stressUp += 1;
                summary.push(LEVEL_UP_OPTIONS.stress.label);
                break;

            case "trait": {
                const key = pick.trait;
                if (!key) break;
                traitDeltas[key] = (traitDeltas[key] ?? 0) + 1;
                const label = Object.values(TRAITS).find(t => t.dh === key)?.label ?? key;
                summary.push(`+1 ${label}`);
                break;
            }

            case "experienceUp": {
                const id = pick.experience;
                if (!id) break;
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
        const { meansWrite, numberHeld } = await import("./sheet-audit.mjs");
        const taken = await meansWrite(actor, async () => {
            const from = path => numberHeld(actor, path) ?? 0;
            if (hpUp) update["system.resources.hitPoints.max"] = from("system.resources.hitPoints.max") + hpUp;
            if (stressUp) update["system.resources.stress.max"] = from("system.resources.stress.max") + stressUp;
            for (const [key, delta] of Object.entries(traitDeltas)) {
                update[`system.traits.${key}.value`] = from(`system.traits.${key}.value`) + delta;
            }
            for (const [id, delta] of Object.entries(experienceDeltas)) {
                update[`system.experiences.${id}.value`] = from(`system.experiences.${id}.value`) + delta;
            }
            const taken = from(`flags.${MODULE_ID}.${FLAGS.advances}`) + 1;
            update[`flags.${MODULE_ID}.${FLAGS.advances}`] = taken;
            await trustedWrite(actor, update, { reason: "levelUp" });
            return taken;
        });
        /* AN OFFER IS SPENT BY BEING TAKEN (N-2) - the one it names, and only that one
           (E10 C6; audit S03-17). Every apply withdrew the character's offer, so a GM's own
           Level Up of a student spent the player's standing one without a word; a GM's
           picker names none now, and a player's picks name theirs (`handleAdvancement`).
           Through the primary GM, which holds the offers. */
        if (offerId) await withdrawOffer(actor.id, offerId);

        log(`Advancement (${kind}) applied to ${actor.name}: ${summary.join(", ")}`);
        await tellPlayer(actor, Array.isArray(reasons) && reasons.length ? reasons : [`DRPG.Advance.reason.${kind}`], summary, taken);
        return summary;
    } catch (err) {
        error("Could not apply the advancement", err);
        ui.notifications.error(game.i18n.localize("DRPG.Advance.failed"));
        return null;
    }
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
 * which exists only at a correct verdict (vote.mjs `applyVerdict`), so the Reinforced
 * waits for the class's next correct verdict and is picked with that survivor's
 * Standard, 1 + 3 picks in one window and one write; or for the Final Trial's verdict,
 * when the season's secrets are out anyway (the owner's Q7, option b). It lapses at a
 * kill (chapter.mjs `killCharacter`) and a season reset (the "advancement" group).
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
        <p>${game.i18n.format("DRPG.Advance.deferred", { n: deferredPicks(row) })}</p>`, { veiled: true });
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
 */
export async function runAdvancementBatch(actors, kind = "standard") {
    if (!game.user.isGM) return null;
    await deferredOfferStore.whenHydrated();
    const byId = new Map((actors ?? []).filter(Boolean).map(a => [a.id, a]));
    const { entries, drop } = advancementPlan([...byId.keys()], deferredOfferStore.entries(), kind);
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
            const choice = !who ? (playable ? "player" : null) : who[actor.id] ?? (playable && here ? "player" : "gm");
            if (choice === "gm" && await openAdvancement(actor, entry.kind, { extraPicks: entry.extraPicks, reasons: entry.reasons })) {
                done.applied++;
                if (entry.deferred) await deferredOfferStore.drop(actor.id);
                continue;
            }
            // The waited picks: all of them at the Final Trial (no kind of the batch's own), the extra otherwise.
            const waited = entry.deferred ? (LEVEL_UP[kind]?.picks ? entry.extraPicks : entry.picks) : 0;
            if (playable && await offerAdvancement(actor, entry.kind,
                { extra: entry.extraPicks, deferred: waited, veiled: true, quiet: true })) {
                done.offered++;
                if (entry.deferred) await deferredOfferStore.drop(actor.id);
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

/**
 * The class's one Level Up window (E10 C7): a row per entry, who picks it. Answers each row's
 * choice by actor id - "player" or "gm" - or null when the window is closed. A row with nobody
 * to hand it to reads "gm" whatever the form says.
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
    return DialogV2.wait({
        window: { title: L("DRPG.Advance.queueTitle") },
        classes: ["drpg-panel", "drpg-advance-queue"],
        content: `<p>${L("DRPG.Advance.queueIntro")}</p><ul class="drpg-advance-queue-list">${items}</ul>`,
        buttons: [
            { action: "allPlayers", label: L("DRPG.Advance.allPlayers"), callback: (event, button, dialog) => read(dialog, true) },
            { action: "give", label: L("DRPG.Advance.queueGive"), default: true, callback: (event, button, dialog) => read(dialog, false) }
        ],
        rejectClose: false
    });
}
