/**
 * Danganronpa RPG - the Mastermind and the Final Trial.
 * ---------------------------------------------------------------------------
 * Guide, pp. 32–33: "Wśród graczy ukryty jest mastermind" - hidden AMONG the
 * players. This is the single most important secret the game has, and it gets
 * treated that way: nothing about it ever touches an actor document.
 *
 * WHY NOT A FLAG. Every other role in this module - Monokuma, Monocub, dead -
 * is public knowledge at the table, so a plain actor flag (world data, which
 * D6 already established Foundry ships to every client regardless of
 * ownership) costs nothing to use. The Mastermind's identity is exactly the
 * opposite: it must be unreadable from ANY client but a GM's. So it lives in a
 * client-scoped setting on GM browsers only, synced GM-to-GM over a socket the
 * server addresses to named recipients - the same treatment `truth-bullets.mjs`
 * gives the answer key, just for a single actor id instead of a ledger.
 *
 * Everything else the guide asks for is either already built or genuinely
 * small:
 *   private intel        the messenger from Stage B - no new code
 *   Despair → Hope        `despair.mjs`'s `convertDespairToHope`, shared with
 *                         Monocub rather than reimplemented
 *   Final Truth Remnant   `type: "final"` on the existing Remnant system,
 *                         reinforced by its own config entry
 *   the Final Trial       the SAME floor, Present/OBJECTION and vote as any
 *                         other Class Trial (Stage 9) - only the verdict's
 *                         consequences differ, so only the verdict is new here
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS, myMastermindLair } from "./settings.mjs";
import { getClock, setClock } from "./clock.mjs";
import { isDeceased, killCharacter } from "./chapter.mjs";
import { remnantsOn, remnantData } from "./remnants.mjs";
import { studentActors } from "./monokuma.mjs";
import { announce, dialogContent, whisperToGms, ownerOf, primaryGmId, isPrimaryGm, log, error } from "./utils.mjs";
import { mastermindStore, doorCopy, mastermindUndecided } from "./gm-stores.mjs";
import { RECORD, onGmStoresHydrated, gmStoresHydrated, gmStoresQuiet, whenGmStoresAudible, onGmStoresAudible } from "./gm-store.mjs";
import { alreadyOpen, keepLive } from "./live.mjs";

const DialogV2 = foundry.applications.api.DialogV2;
const SOCKET_EVENT = `module.${MODULE_ID}`;
/** GM -> the one player who already knows they hold the part, and "not you" to the rest. See below. */
const ACTION_DOOR = "mastermind.door";
/** A player's client, catching up after a reload or when a GM connects. See below. */
const ACTION_DOOR_REQUEST = "mastermind.doorRequest";

/* ==========================================================================
 * IDENTITY - GM browsers only, never world data
 * --------------------------------------------------------------------------
 * A GM STORE SINCE E04 (1.2.63; audit S06-19): `mastermindStore`
 * (gm-stores.mjs), one record `{ actorId, room }` whose fields are stamped one
 * by one and merged with the other GMs. The socket that synced it went with it:
 * its SET kept the newest whole entry, and its REQUEST was answered only by a GM
 * holding a pick, so a clear never reached a GM who had been offline.
 * ========================================================================== */

function readStore() {
    return game.user.isGM ? mastermindStore.record() : {};
}

/**
 * The pick, and the lair when one is given. `actorId` is always stamped - naming
 * the Mastermind, or naming nobody, is a decision; `room === undefined` stamps
 * nothing for the lair, so a caller that only meant the identity cannot drop a
 * lair another GM set a moment ago.
 */
async function writeStore(actorId, room) {
    if (!game.user.isGM) return;
    const previous = readStore().actorId ?? null;
    const fields = { actorId: actorId || null };
    if (room !== undefined) fields.room = room || null;
    await ownWrite(() => mastermindStore.patch(RECORD, fields));
    const now = readStore();
    notifyDoorAccess(previous, now.actorId ?? null, now.room ?? null);
}

/** While this module's own write of the record is in flight: its change event is not a merge. */
let writingDoor = 0;
async function ownWrite(write) {
    writingDoor++;
    try { return await write(); } finally { writingDoor--; }
}

/**
 * The record as this GM last saw the players told about it - who, where, and the two
 * stamps - so a merge that changes it can be told too (`registerMastermind`). Kept on
 * every GM, not the primary alone (the round-2 review's R2-m3): a GM that became the
 * primary later took the first change it merged as its baseline and told nobody. It
 * does not move while the suite holds the stores (`tellDoorChange`).
 */
let told = null;
function doorView() {
    const r = readStore();
    return { actorId: r.actorId ?? null, room: r.room ?? null,
        actorAt: mastermindStore.stampOf(RECORD, "actorId"), roomAt: mastermindStore.stampOf(RECORD, "room") };
}

/**
 * The record against what the players were last told: unchanged, nothing; changed, the
 * primary tells it as it tells a change of its own (`notifyDoorAccess`, which keeps the
 * new baseline), and any other GM keeps it as the baseline. Run on a merge, and once
 * the suite lets the stores go (the fix round's 61 E6 and F5, 26.09.2026): a change
 * merged while they were held, from a GM that was not, was ignored then - no player may
 * be sent anything while they are - and a baseline taken afresh at the release told
 * nobody of it. Tier 2 puts each store's key back raw, stamps and all, so what it wrote
 * compares equal and is told to nobody (01 counts the packets).
 */
function tellDoorChange() {
    const now = doorView();
    const was = told;
    if (!was) { told = now; return; }
    if (now.actorAt === was.actorAt && now.roomAt === was.roomAt) return;
    if (isPrimaryGm()) notifyDoorAccess(was.actorId, now.actorId, now.room);
    else told = now;
}

/**
 * Tell the clients that need to know, and nothing more than a boolean.
 *
 * Nothing here ever names the Mastermind. The message is a bare boolean,
 * addressed by Foundry's own `recipients`, and every one carries the record's
 * stamp: a player's copy (`doorCopy`) takes only a newer one, so an answer from a
 * GM whose browser holds less cannot undo a newer one.
 *
 * The incoming Mastermind's player gets `true` and the lair on every write - the
 * lair moving is the other thing this copy carries. On a CHANGE of pick (a new
 * one, or a clear), every other connected player gets `false` as well (E04, the
 * owner's Q3): the outgoing Mastermind's player loses lair sight at once even
 * when this browser never knew who the outgoing one was, and every player's copy
 * holds the newest stamp. That every player hears a pick changed at that moment
 * is the price, and it says nothing about who; nothing is sent to anybody else
 * when the pick is unchanged.
 *
 * ON HOLD WHILE THE UPGRADE DAY'S CLEAR IS UNDECIDED (the review's M1, 26.09.2026;
 * `mastermindUndecided`): a pick older than a clear some GM's old store held may be
 * one a GM took away, so its player is told "no" with everybody else until the
 * primary GM keeps it (a fresh stamp, and then "yes") or clears it. A player who
 * already holds the part at the pick's own stamp keeps it until then: a "no" at an
 * equal stamp is refused (`doorCombine`), and the window that decides it is open on
 * the primary.
 */
function notifyDoorAccess(previousActorId, nextActorId, room = null) {
    const view = doorView();
    // While the stores are quiet nothing goes out, and what the players were told stays (`tellDoorChange`).
    if (!gmStoresQuiet()) told = view;
    const incoming = nextActorId ? ownerOf(game.actors.get(nextActorId)) : null;
    // While the upgrade day's clear is undecided, the pick's player is one of "the rest".
    const player = incoming && !incoming.isGM && !mastermindUndecided() ? incoming : null;
    if (previousActorId !== nextActorId) {
        for (const user of game.users) {
            if (!user.active || user.isGM || user.id === player?.id) continue;
            sendDoorFlag(user.id, false, null, doorStamps(false, view));
        }
    }
    if (player) sendDoorFlag(player.id, true, room, doorStamps(true, view));
}

/**
 * The stamps a door answer carries (the review's B1): the pick's for "yes" and "no",
 * and the room's only with a "yes" - see `doorCombine` in gm-stores.mjs.
 */
function doorStamps(value, view = doorView()) {
    return value ? { actorId: view.actorAt, room: view.roomAt } : { actorId: view.actorAt };
}

/**
 * AFTER A RESTORE (gm-stores.mjs `restoreCase`; the reviews' S-m3 = C-m7): every
 * connected player told where they stand at the record's stamps - the pick's player
 * "yes" with the lair, everybody else "no" - so a player whose copy was refused while
 * this browser held nothing (stamp 0) has it back without asking, and one whose copy
 * already holds it changes nothing (`doorCombine`). Nothing for a pick nobody ever
 * made (stamp 0), and nothing while the suite holds the stores or stands in another
 * world (`gmStoresQuiet`). Answers how many players were sent a flag.
 */
export function retellDoor() {
    if (!game.user?.isGM || gmStoresQuiet()) return 0;
    const view = doorView();
    if (!view.actorAt) return 0;
    told = view;
    const owner = view.actorId ? ownerOf(game.actors.get(view.actorId)) : null;
    const player = owner && !owner.isGM && !mastermindUndecided() ? owner : null;
    let sent = 0;
    for (const user of game.users) {
        if (!user.active || user.isGM) continue;
        if (user.id === player?.id) sendDoorFlag(user.id, true, view.room, doorStamps(true, view));
        else sendDoorFlag(user.id, false, null, doorStamps(false, view));
        sent++;
    }
    return sent;
}

function sendDoorFlag(userId, value, room, stamps) {
    // While tier 2 holds the stores the record is a fixture's: no player is told it (R2-M1).
    if (gmStoresQuiet()) return;
    try {
        game.socket.emit(SOCKET_EVENT,
            // `room` travels only alongside `value: true` - a "you are not the
            // Mastermind" carries no location, so a cleared player's client
            // holds nothing worth reading.
            { action: ACTION_DOOR, value, room: value ? (room ?? null) : null, stamps },
            { recipients: [userId] });
    } catch (err) {
        error("Could not deliver the Mastermind's private door flag", err);
    }
}

/**
 * `iAmTheMastermind()` used to live here and now lives in settings.mjs, beside
 * the copy it reads. It was the single edge every static import cycle in the
 * module passed through - movement.mjs had to reach into this file for it - and
 * the note above the function there says why moving it was the fix rather than
 * a workaround.
 */

/**
 * The Mastermind's own room, on the client that holds the part - null for
 * everyone else, including every GM (they read the store instead). Delivered
 * over the same private whisper as the door flag; see `sendDoorFlag`.
 *
 * What standing in it buys is decided elsewhere: visibility.mjs shows the
 * whole cast to a Mastermind whose own token is in this room, and takes it
 * away the moment they leave.
 */
export function myLairRoom() {
    return myMastermindLair();
}

/** The lair as the GMs know it. `null` off a non-GM client - not an error. */
export function mastermindLair() {
    if (!game.user.isGM) return null;
    return readStore().room ?? null;
}

/** The Mastermind's actor. `null` for anyone who is not a GM - not an error. */
export function mastermindActor() {
    if (!game.user.isGM) return null;
    const id = readStore().actorId;
    return id ? (game.actors.get(id) ?? null) : null;
}

/** Is this actor the Mastermind? Always `false` off a non-GM client. */
export function isMastermind(actor) {
    return Boolean(game.user.isGM && actor && mastermindActor()?.id === actor.id);
}

/**
 * Choose the Mastermind. GM only, and singular - the guide's "DMowie wybierają
 * go" is one student, picked "w uzgodnieniu z samym graczem" before the season
 * starts. That agreement is a conversation this module cannot have for you;
 * the dialog only says so.
 */
export async function setMastermind(actor, { room } = {}) {
    if (!game.user.isGM || !actor) return null;
    await writeStore(actor.id, room);
    log(`Mastermind set (visible to GMs only).`);
    return actor;
}

/** Point the Mastermind's lair at a room, or clear it, without touching WHO. */
export async function setMastermindLair(room) {
    if (!game.user.isGM) return;
    await ownWrite(() => mastermindStore.patch(RECORD, { room: room || null }));
    const now = readStore();
    notifyDoorAccess(now.actorId ?? null, now.actorId ?? null, now.room ?? null);
}

/** Clear the pick - a fresh season, or a correction. The lair goes with it: both stamped null. */
export async function clearMastermind() {
    if (!game.user.isGM) return;
    await writeStore(null, null);
}

/**
 * Ask the primary GM whether this browser holds the part (a player's client).
 * The primary alone answers - from the store the GMs share, once it has the other
 * GMs' copies - and its answer is stamped, so asking twice, or an answer that
 * crosses a newer one, changes nothing.
 */
function askForDoor() {
    const primary = primaryGmId();
    if (!primary || game.user.isGM) return;
    try {
        game.socket.emit(SOCKET_EVENT, { action: ACTION_DOOR_REQUEST }, { recipients: [primary] });
    } catch (err) {
        error("Could not ask the GM for door access", err);
    }
}

export function registerMastermind() {
    /*
     * A PLAYER ASKING "AM I THE MASTERMIND", answered by the primary GM alone and
     * about the one who asked - Foundry's own `senderId`, never a field in the
     * packet. Until E04 every GM answered from its own copy, and a second GM whose
     * browser held no pick answered "no" and took the part away from the player
     * who had it (S06-19). The primary answers once its store holds the other GMs'
     * copies, with the stamps of the record's fields (`doorStamps`); a pick nobody
     * made yet is stamp 0, and a player's copy takes no stamp 0. While the upgrade
     * day's clear is undecided the answer is "no" (see `notifyDoorAccess`).
     */
    game.socket.on(SOCKET_EVENT, async (payload, senderId) => {
        if (payload?.action !== ACTION_DOOR_REQUEST || !isPrimaryGm()) return;
        const sender = game.users.get(senderId);
        if (!sender?.active || sender.isGM) return;
        // Asked while tier 2 holds the stores: answered once it lets them go, from this world's record (R2-M1).
        await whenGmStoresAudible();
        await mastermindStore.whenHydrated();
        const mine = readStore();
        const owns = Boolean(mine.actorId && ownerOf(game.actors.get(mine.actorId))?.id === sender.id) && !mastermindUndecided();
        sendDoorFlag(sender.id, owns, owns ? (mine.room ?? null) : null, doorStamps(owns));
    });

    /*
     * A MERGE THAT CHANGES THE RECORD IS TOLD TOO, by the primary (the review's B1).
     * The GM that wrote tells the players itself; one that had not merged a newer pick
     * sends answers that are older in the part that decides them, and they are refused
     * (`doorCombine`) - so once the primary's store has the write, it tells the players
     * as it would have told them of its own: a change of pick to everybody (Q3), a
     * moved lair to the Mastermind's player. Measured (61 E6, 26.09, on the C5 tree and
     * on this one without the watch): the Mastermind's player still held no lair once
     * the GMs agreed on the Kitchen a stale GM had moved it to.
     */
    Hooks.on("clientSettingChanged", key => {
        if (key !== `${MODULE_ID}.${SETTINGS.mastermind}` || writingDoor || !game.user.isGM || gmStoresQuiet()) return;
        tellDoorChange();
    });
    // What the players were told is what the store holds once the other GMs' copies are in - on every GM.
    const settled = () => { if (!told && !gmStoresQuiet()) told = doorView(); };
    // Once the suite lets the stores go, the record is held against what the players were told before it began.
    onGmStoresAudible(() => { if (game.user.isGM) tellDoorChange(); });
    onGmStoresHydrated(settled);
    if (gmStoresHydrated()) settled();

    /*
     * The private half: a GM -> this player, and nobody else.
     *
     * A SEPARATE listener rather than a branch inside the one above - this is the
     * one message in the whole module that a PLAYER client is meant to act on.
     * Foundry's `recipients` addressing already means only the intended player's
     * browser ever receives a payload here at all; the sender check below is the
     * same discipline as every GM-bound handler regardless, so a forged message
     * from a player cannot plant this flag on themselves - `senderId` is
     * Foundry's own, not a claim inside the payload. What it holds is the copy's,
     * taken only when its stamp is newer than the one held (gm-store.mjs,
     * `receiveCopy`).
     */
    game.socket.on(SOCKET_EVENT, async (payload, senderId) => {
        if (payload?.action !== ACTION_DOOR) return;
        if (!game.users.get(senderId)?.isGM) return;
        try {
            // The lair travels with the flag and dies with it - a cleared
            // player keeps no record of where the room was.
            const value = { mastermind: Boolean(payload.value), room: payload.value ? (payload.room || null) : null };
            if (!await doorCopy.receive(value, payload.stamps)) return;
            // Standing in the lair may already be true the moment the part
            // arrives - repaint rather than waiting for the next token move.
            const { applyAll } = await import("./visibility.mjs");
            applyAll();
        } catch (err) {
            error("Could not record the Mastermind's private door flag", err);
        }
    });

    if (game.user.isGM) return;

    // A player's copy is kept in this browser, and a GM's answer is what starts
    // and corrects it: every player asks when it loads, and again when a GM
    // connects (a player who loaded first asked nobody). The answer is a single
    // boolean about this one user, so asking is free for the players who get
    // "no" back.
    askForDoor();
    Hooks.on("userConnected", (user, connected) => {
        if (connected && user?.isGM) askForDoor();
    });
}

/**
 * Pick, clear, or top up the Mastermind. The one screen for all of it, since
 * showing the current pick and the controls to change it on two different
 * screens is two more places this secret could end up on somebody's shared
 * screen than it needs to be.
 */
/**
 * Announce or withdraw the Final Trial. Moved here from the GM panel, which used
 * to own a tile for it; it is the same subject as the Mastermind screen and
 * belongs on the same window.
 */
/**
 * Exported for the Class Trial console, which is where the button lives now
 * (Dawid, 26.08): announcing the Final Trial is a trial-table act, and the
 * Mastermind screen - the one window that names the season's secret - keeps
 * only the role and the lair.
 */
export async function toggleFinalTrialFlag() {
    const DialogV2 = foundry.applications.api.DialogV2;
    const next = !inFinalTrial();

    const sure = await DialogV2.confirm({
        window: { title: game.i18n.localize("DRPG.Mastermind.toggleFinalTrial") },
        classes: ["drpg-panel"],
        content: `<p>${game.i18n.localize(
            next ? "DRPG.Mastermind.confirmStart" : "DRPG.Mastermind.confirmEnd")}</p>`,
        rejectClose: false
    });
    if (!sure) return;

    await setFinalTrial(next);
    ui.notifications.info(game.i18n.localize(
        next ? "DRPG.Mastermind.started" : "DRPG.Mastermind.ended"));

    // Say it out loud, because the window promised to.
    //
    // "Announce the Final Trial? This is public - everyone sees it start" is
    // what the GM agreed to, and then the only thing that happened was a local
    // notification on their own screen. Checked twice while testing: the flag
    // flipped, the players saw nothing at all. The one moment the season has
    // been building to arrived in silence.
    //
    // Starting is public. ENDING is not announced: the flag comes down after
    // the verdict, which has its own card, and a second "the Final Trial is
    // over" underneath it would be the module talking to itself.
    if (!next) return;

    await announce({
        content: `<div class="drpg-evidence-card objection">
            <div class="drpg-objection-banner">${
                game.i18n.localize("DRPG.Mastermind.finalBanner")}</div>
            <p>${game.i18n.localize("DRPG.Mastermind.finalAnnounce")}</p>
        </div>`
    });
}

/*
 * FUNCTIONS, BECAUSE A DONATION CHANGES BOTH OF THESE (E6).
 *
 * The window used to close and reopen itself after every donation to show
 * the new numbers, which threw away the room the GM had picked in the
 * select above and put the window back at its default position. The
 * fieldset is a live region now, so the two figures a donation moves - the
 * Mastermind's Hope and the pool it came out of - redraw where they stand.
 */
function mastermindHopeBox({ monokumas, poolLabel, getDespair }) {
    const buildDonors = () => monokumas().map(u =>
        `<option value="${u.id}">${foundry.utils.escapeHTML(poolLabel(u))} (${getDespair(u.id)})</option>`
    ).join("");

    /*
     * ENTER IN THIS FIELDSET MEANS GIVE, NOT APPLY (MM-02, 20.09).
     *
     * The note above covers the whole box; this is about its two fields. They
     * sit inside the dialog's form, and this window's footer starts with
     * Apply - so Enter here pressed Apply, which saves the role and the lair,
     * CLOSES the window and gives no Hope at all. Read from source rather than
     * measured: DialogV2 puts the content and the footer in one form and its
     * footer buttons carry no `type`, so they are submits, and implicit
     * submission takes the first one in tree order however `default` is set.
     * The marker is the third rule in `guardTextFields` (utils.mjs), which
     * presses the named button instead.
     *
     * ON BOTH FIELDS, because Enter in a select submits exactly like Enter in a
     * number, and a GM who picks the pool with the keyboard is in the select
     * when they press it.
     */
    return `
        <p class="notes">${game.i18n.format("DRPG.Mastermind.hopeReadout", {
            held: mastermindActor()?.system?.resources?.hope?.value ?? 0
        })}</p>
        <select name="donor" data-drpg-enter="[data-drpg-give]">${buildDonors()}</select>
        <input type="number" name="amount" min="1" value="1" style="width:4em"
            data-drpg-enter="[data-drpg-give]" />
        <button type="button" class="drpg-mini-button" data-drpg-give>
            ${game.i18n.localize("DRPG.Monocub.give")}</button>`;
}

// Rewired after every redraw: `keepLive` replaces the region's
// nodes, and the listener would go with the button it was on.
function wireMastermindGive(dialog, current) {
        dialog.element.querySelector("[data-drpg-give]")
            ?.addEventListener("click", async () => {
                const donorId = dialog.element.querySelector("[name=donor]")?.value;
                const amount = Number(
                    dialog.element.querySelector("[name=amount]")?.value) || 0;
                if (!donorId || !current) return;
                // SAYS WHY (MM-02, 20.09). This bailed silently on 0 or a
                // blank, and the "At least 1" hint beside the stepper is
                // painted by chrome.mjs, which dresses this window under
                // one theme only - so under Monokuma Legacy the button
                // simply did nothing. Now that Enter presses this button,
                // an empty field is a keystroke away rather than a
                // deliberate click.
                if (amount <= 0) {
                    ui.notifications.warn(game.i18n.format("DRPG.Monocub.giveAtLeast", { n: 1 }));
                    return;
                }

                const { convertDespairToHope } = await import("./despair.mjs");
                await convertDespairToHope(donorId, current, amount);
                // No close and reopen: this writes two actors, and the
                // region below watches them (E6).
            });
}

// Only the Apply button reaches here, and it always brings an object - so
// an empty `who` is the GM choosing "Nobody" on purpose.
async function applyMastermindChoice(result, current) {
    const who = result.who ?? null;

    if (!who) {
        if (current) {
            await clearMastermind();
            ui.notifications.info(game.i18n.localize("DRPG.Mastermind.cleared"));
        }
        return null;
    }

    if (who !== current?.id) {
        const picked = game.actors.get(who);
        await setMastermind(picked, { room: result.lair || null });
        // Setting it used to confirm nothing at all: no notification, no
        // whisper, no entry. The secret must not go to chat, but the person who
        // just set it is entitled to know it took.
        ui.notifications.info(game.i18n.format("DRPG.Mastermind.confirmed",
            { name: picked?.name ?? "?" }));
    } else if ((result.lair || null) !== (readStore().room ?? null)) {
        // Same Mastermind, different lair: the private whisper follows the
        // room without renaming anybody.
        await setMastermindLair(result.lair || null);
    }

    return who;
}

export async function openMastermindDialog() {
    // ONE OF THESE, NOT FOUR - see `alreadyOpen` in live.mjs. Two copies of a
    // window each read the world when they opened and neither knows about the
    // other, so the older one goes on looking authoritative while showing
    // something that stopped being true. Raised rather than refused: pressing
    // twice usually means the window is behind something.
    if (alreadyOpen("drpg-window-mastermind")) return null;

    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }
    // The pick another GM holds, first (E04): a browser that has not heard from
    // the others yet would open on "nobody", and a GM would pick again on top.
    await mastermindStore.whenHydrated();

    const students = studentActors();
    const current = mastermindActor();

    const options = students.map(a =>
        `<option value="${a.id}"${a.id === current?.id ? " selected" : ""}>${
            foundry.utils.escapeHTML(a.name)}</option>`).join("");

    const { monokumas, poolLabel, getDespair } = await import("./despair.mjs");
    const hopeBox = () => mastermindHopeBox({ monokumas, poolLabel, getDespair });

    const { allRooms } = await import("./movement.mjs");

    // The Final Key Remnant planner that used to sit here lives on the
    // Investigation dashboard now (Dawid, 26.08) - this screen names the one
    // secret the module guards hardest, and planting endgame clues gave a GM
    // reasons to have it open. What is left is the role and the lair.
    const lair = readStore().room ?? "";
    const roomOptions = allRooms().map(r =>
        `<option value="${foundry.utils.escapeHTML(r)}"${r === lair ? " selected" : ""}>${
            foundry.utils.escapeHTML(r)}</option>`).join("");

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Mastermind.dialogTitle") },
        classes: ["drpg-panel", "drpg-window-mastermind"],
        content: dialogContent(`<form>
            <p class="drpg-warning">${game.i18n.localize("DRPG.Mastermind.privacyWarning")}</p>
            <label>${game.i18n.localize("DRPG.Mastermind.whoIs")}
                <select name="who">
                    <option value="">${game.i18n.localize("DRPG.Mastermind.nobody")}</option>
                    ${options}
                </select></label>
            <p class="notes">${game.i18n.localize("DRPG.Mastermind.dialogIntro")}</p>

            <label>${game.i18n.localize("DRPG.Mastermind.lairLabel")}
                <select name="lair">
                    <option value="">-</option>
                    ${roomOptions}
                </select></label>
            <p class="notes">${game.i18n.localize("DRPG.Mastermind.lairNote")}</p>

            ${current ? `
            <fieldset>
                <legend>${game.i18n.localize("DRPG.Monocub.giveHope")}</legend>
                <div class="drpg-mm-live">${hopeBox()}</div>
            </fieldset>` : ""}
        </form>`),
        buttons: [
            {
                action: "save", label: game.i18n.localize("DRPG.Panel.apply"), default: true,
                // An OBJECT, not the bare value.
                //
                // "Apply with nobody selected" and "the GM shut the window"
                // both used to arrive here as a falsy `result`, and the code
                // below read either of them as "clear the Mastermind". So
                // closing this window with the X - changing nothing, touching
                // nothing - deleted the secret of the season. Measured: set the
                // Mastermind, open, close, gone.
                //
                // Wrapping the answer makes the two distinguishable: a dismissal
                // is `null`, a deliberate clear is `{ who: "" }`.
                callback: (e, b, d) => {
                    const q = name => d.element.querySelector(`[name=${name}]`);
                    return {
                        who: q("who").value,
                        lair: q("lair")?.value ?? ""
                    };
                }
            },
            // The start/end Final Trial button that used to sit here is gone
            // (Dawid, 26.08): the Class Trial console already owns that toggle,
            // and a second copy next to the button that can wipe the season was
            // a duplicate with worse neighbours. The verdict stays - it has no
            // other home.
            { action: "finalVerdict", label: game.i18n.localize("DRPG.Mastermind.verdictTitle") },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        render: (event, dialog) => {
            const wireGive = () => wireMastermindGive(dialog, current);
            wireGive();

            keepLive(dialog, {
                region: ".drpg-mm-live",
                build: hopeBox,
                watch: { actors: true },
                after: wireGive
            });
        },
        rejectClose: false
    });

    // Anything that is not one of this dialog's own answers is a dismissal, and
    // a dismissal changes nothing. `rejectClose: false` turns the X and Escape
    // into a `null` that used to fall all the way through to the clear.
    if (!result || result === "cancel") return null;

    // Opens a window of its own and then comes back here, so the GM lands on
    // the screen they pressed the button from rather than on the scene. Same
    // pattern the GM panel uses for its own tiles.
    if (result === "finalVerdict") {
        await openFinalVerdictDialog();
        return openMastermindDialog();
    }

    return applyMastermindChoice(result, current);
}

/* ==========================================================================
 * THE FINAL TRUTH REMNANT
 * --------------------------------------------------------------------------
 * Nothing new mechanically - `type: "final"` already exists in REMNANT_TYPES,
 * already carries `reinforced: true`, and `dropRemnant`/`placeRemnant` already
 * know how to place it. This is only the "did I remember this chapter" check
 * the guide's cadence ("co rozdział") asks for.
 * ========================================================================== */

/**
 * Every trace typed `final`, across every scene, newest chapter first.
 *
 * The endgame's own clues, listed where they are decided. They also appear in
 * the Investigation Dashboard's Traces table like every other trace - reading
 * them there is fine, and is not the same act as adding one.
 */
export function finalRemnants() {
    const out = [];
    for (const scene of game.scenes) {
        for (const token of remnantsOn(scene)) {
            const data = remnantData(token);
            if (data?.type === "final") out.push({ token, data, scene });
        }
    }
    return out.sort((a, b) => (b.data.chapter ?? 0) - (a.data.chapter ?? 0));
}

/**
 * Put a Final Key Remnant on the map.
 *
 * Same shape as the Key Remnant planner's own placement - a GM construction
 * dropped at a random point in the named room, not something an actor left
 * behind - but typed `final`. `REMNANT_TYPES.final` already carries
 * `reinforced: true`, so `placeRemnant` makes it un-cleanable without this
 * having to say so: the one clue a chapter's endgame turns on is not something
 * a killer gets to wipe off the floor.
 *
 * Lived on the Investigation Dashboard's third tab until now, which meant two
 * windows could write the same record. One entry, one place it is changed.
 */
export async function placeFinalRemnant({ room, visibility = "evident", note = "",
                                          name = "", text = "", analysis = "" } = {}) {
    if (!game.user.isGM || !room) return null;

    const scene = canvas?.scene;
    const region = Array.from(scene?.regions ?? []).find(r => r.name === room);
    if (!region) {
        ui.notifications.warn(game.i18n.format("DRPG.Calls.noSuchRoom", { room }));
        return null;
    }

    // Dynamic, both of them: investigation.mjs imports this file, and the
    // scatter is the only thing wanted from it.
    const { randomPointIn } = await import("./investigation.mjs");
    const { placeRemnant } = await import("./remnants.mjs");

    const spot = randomPointIn(region, scene);
    const clock = getClock();

    /* `subject` STAYS HERE and the difficulty label does not, which is the difference between
       this and the planner: a Final Remnant's subject really is what it is. `action` goes for
       the reason it went there - "manual" is a project trigger, not one of `ACTIONS`, so the
       context line printed the raw word. */
    const token = await placeRemnant({
        x: spot.x, y: spot.y, sceneId: scene?.id ?? null,
        type: "final", visibility, faint: false,
        tiedToCrime: true, reinforced: true, note,
        subject: game.i18n.localize("DRPG.Remnant.finalSubject"),
        room,
        chapter: clock.chapter, day: clock.day, timeOfDay: clock.timeOfDay
    });

    /* And the words a player will read, for the same reason the planner now writes them: the
       endgame clue reaching its finder as "Trace" with no description is the worst instance of
       the fault, not the mildest. And the reading, which waits for its finder's Analyze like
       any trace's (21.09) - the form had no box for it. */
    if (token && (name || text || analysis)) {
        const { setRemnantPublic } = await import("./remnants.mjs");
        await setRemnantPublic(token, {
            ...(name ? { name } : {}),
            ...(text ? { playerText: text } : {}),
            ...(analysis ? { analyzedText: analysis } : {})
        });
    }
    return token;
}

/** Has a Final Truth Remnant been placed this chapter, on any scene? */
export function finalTruthPlacedThisChapter() {
    const chapter = getClock().chapter;
    for (const scene of game.scenes) {
        for (const token of remnantsOn(scene)) {
            const data = remnantData(token);
            if (data?.type === "final" && data.chapter === chapter) return true;
        }
    }
    return false;
}

/* ==========================================================================
 * FINAL TRIAL
 * ========================================================================== */

/** Is a Final Trial the kind of Class Trial running right now? Flavour only. */
export function inFinalTrial() {
    return Boolean(getClock().finalTrial);
}

/** Toggle the flag. Announces to the table - this part is not a secret. */
export async function setFinalTrial(value) {
    if (!game.user.isGM) return null;
    return setClock({ finalTrial: Boolean(value) });
}

/**
 * The Final Trial's verdict.
 *
 * Deliberately not `vote.mjs`'s `applyVerdict`: the guide's consequences here
 * are a different shape entirely. A normal wrong guess executes an innocent
 * and pays the Monokumas; a wrong Final Trial guess does neither - it reveals
 * that the game was never what it looked like, and nobody new dies for it.
 *
 * "Correct" branches on the Mastermind being alive to answer for it - if they
 * already died earlier in the season, the guide's own text is the reveal
 * branch regardless of who the table names: "W wypadku gdy ten nie żyje -
 * zdemaskować, że gra w którą grają właściwie już się nie toczy."
 */
export async function openFinalVerdictDialog() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const mastermind = mastermindActor();
    if (!mastermind) {
        ui.notifications.warn(game.i18n.localize("DRPG.Mastermind.noneSet"));
        return null;
    }

    const alreadyDead = isDeceased(mastermind);
    const students = studentActors();
    const options = students
        .map(a => `<option value="${a.id}">${foundry.utils.escapeHTML(a.name)}</option>`).join("");

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Mastermind.verdictTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p>${game.i18n.localize("DRPG.Mastermind.verdictIntro")}</p>
            ${alreadyDead
                ? `<p class="drpg-warning">${game.i18n.localize("DRPG.Mastermind.alreadyDeadNote")}</p>`
                : ""}
            <label>${game.i18n.localize("DRPG.Mastermind.whoWasAccused")}
                <select name="accused">${options}</select></label>
            <p class="notes">${game.i18n.localize("DRPG.Mastermind.verdictNote")}</p>
        </form>`),
        /*
         * CANCEL FIRST, AND CANCEL THE DEFAULT (MM-01, Dawid 17.09).
         *
         * Both verdicts are irreversible and public - the Mastermind dies, the
         * banner goes up, the pick is cleared - and the one that answered Enter
         * or Space the moment the window opened was "They named the Mastermind".
         * Enter presses the first submit button in DOM order and `default` only
         * decides the focus, so Cancel has to be both. The two verdicts stay one
         * click each; the ordinary trial verdict (G-31, vote.mjs) keeps defaulting
         * to the likely outcome, because a GM meets that window every chapter.
         */
        buttons: [
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel"), default: true },
            {
                action: "correct", label: game.i18n.localize("DRPG.Mastermind.correctlyNamed"),
                disabled: alreadyDead,
                callback: (e, b, d) => ({
                    correct: true, accusedId: d.element.querySelector("[name=accused]").value
                })
            },
            {
                action: "wrong", label: game.i18n.localize("DRPG.Mastermind.notCorrectlyNamed"),
                callback: (e, b, d) => ({
                    correct: false, accusedId: d.element.querySelector("[name=accused]").value
                })
            }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return null;
    return applyFinalVerdict({ ...result, alreadyDead });
}

export async function applyFinalVerdict({ correct, accusedId, alreadyDead = null } = {}) {
    if (!game.user.isGM) return null;

    const mastermind = mastermindActor();
    if (!mastermind) return null;
    const dead = alreadyDead ?? isDeceased(mastermind);
    const accused = accusedId ? game.actors.get(accusedId) : null;

    const executed = correct && !dead;

    if (executed) {
        await killCharacter(mastermind);
    }

    await announce({
        content: `<div class="drpg-evidence-card objection">
            <div class="drpg-objection-banner">${game.i18n.localize(
                executed ? "DRPG.Mastermind.defeatedBanner" : "DRPG.Mastermind.revealedBanner")}</div>
            <p>${game.i18n.localize(
                executed ? "DRPG.Mastermind.defeatedText" : "DRPG.Mastermind.revealedText")}</p>
        </div>`
    });

    await whisperToGms(`
        <h3>${game.i18n.localize("DRPG.Mastermind.verdictTitle")}</h3>
        <p>${game.i18n.format("DRPG.Mastermind.verdictSummary", {
            mastermind: foundry.utils.escapeHTML(mastermind.name),
            accused: foundry.utils.escapeHTML(accused?.name ?? "-"),
            outcome: game.i18n.localize(executed ? "DRPG.Mastermind.outcomeExecuted"
                : dead ? "DRPG.Mastermind.outcomeAlreadyDead" : "DRPG.Mastermind.outcomeEscaped")
        })}</p>`);

    // The season is over either way - a Final Trial is the guide's ending, not
    // a chapter like the others. Clearing the pick here rather than leaving it
    // set is what makes `mastermindActor()` honestly answer "nobody" afterwards.
    await clearMastermind();

    log(`Final Trial verdict applied: ${executed ? "executed" : "revealed, not executed"}.`);
    return { executed, dead };
}
