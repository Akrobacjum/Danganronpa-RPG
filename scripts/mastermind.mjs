/**
 * Danganronpa RPG — the Mastermind and the Final Trial.
 * ---------------------------------------------------------------------------
 * Guide, pp. 32–33: "Wśród graczy ukryty jest mastermind" — hidden AMONG the
 * players. This is the single most important secret the game has, and it gets
 * treated that way: nothing about it ever touches an actor document.
 *
 * WHY NOT A FLAG. Every other role in this module — Monokuma, Monocub, dead —
 * is public knowledge at the table, so a plain actor flag (world data, which
 * D6 already established Foundry ships to every client regardless of
 * ownership) costs nothing to use. The Mastermind's identity is exactly the
 * opposite: it must be unreadable from ANY client but a GM's. So it lives in a
 * client-scoped setting on GM browsers only, synced GM-to-GM over a socket the
 * server addresses to named recipients — the same treatment `truth-bullets.mjs`
 * gives the answer key, just for a single actor id instead of a ledger.
 *
 * Everything else the guide asks for is either already built or genuinely
 * small:
 *   private intel        the messenger from Stage B — no new code
 *   Despair → Hope        `despair.mjs`'s `convertDespairToHope`, shared with
 *                         Monocub rather than reimplemented
 *   Final Truth Remnant   `type: "final"` on the existing Remnant system,
 *                         reinforced by its own config entry
 *   the Final Trial       the SAME floor, Present/OBJECTION and vote as any
 *                         other Class Trial (Stage 9) — only the verdict's
 *                         consequences differ, so only the verdict is new here
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS, iAmTheMastermind } from "./settings.mjs";
import { getClock, setClock } from "./clock.mjs";
import { isDeceased, killCharacter } from "./chapter.mjs";
import { remnantsOn, remnantData } from "./remnants.mjs";
import { studentActors } from "./monokuma.mjs";
import { announce, dialogContent, whisperToGms, gmIds, ownerOf, log, warn, error } from "./utils.mjs";

const DialogV2 = foundry.applications.api.DialogV2;
const SOCKET_EVENT = `module.${MODULE_ID}`;
const ACTION_SET = "mastermind.set";
const ACTION_REQUEST = "mastermind.request";
/** GM -> the one player who already knows they hold the part. See below. */
const ACTION_DOOR = "mastermind.door";
/** A player's client, catching up after a reload. See below. */
const ACTION_DOOR_REQUEST = "mastermind.doorRequest";

/* ==========================================================================
 * IDENTITY — GM browsers only, never world data
 * ========================================================================== */

function readStore() {
    if (!game.user.isGM) return {};
    try {
        return game.settings.get(MODULE_ID, SETTINGS.mastermind) ?? {};
    } catch {
        return {};
    }
}

async function writeStore(actorId, room) {
    if (!game.user.isGM) return;
    const before = readStore();
    const previous = before.actorId ?? null;
    // The lair rides in the same entry as the identity because it is the same
    // kind of secret: where the Mastermind's own room is says almost as much
    // as who they are. `room === undefined` keeps whatever is stored, so the
    // callers that only ever meant the identity cannot silently drop it.
    const entry = {
        actorId: actorId || null,
        room: room === undefined ? (before.room ?? null) : (room || null),
        updated: Date.now()
    };
    await game.settings.set(MODULE_ID, SETTINGS.mastermind, entry);
    syncToGms(entry);
    notifyDoorAccess(previous, entry.actorId, entry.room);
}

function syncToGms(entry) {
    const recipients = gmIds().filter(id => id !== game.user.id);
    if (!recipients.length) return;
    try {
        game.socket.emit(SOCKET_EVENT, { action: ACTION_SET, from: game.user.id, entry }, { recipients });
    } catch (err) {
        error("Could not sync the Mastermind to the other GMs", err);
    }
}

/**
 * Tell the ONE client that needs to know: the Mastermind's own player.
 *
 * Nothing here ever names the Mastermind. The message is a bare boolean,
 * addressed by Foundry's own `recipients` — the same mechanism `syncToGms`
 * above uses — to whichever single user id owns the actor. A player who is
 * not that owner receives nothing at all, not even an empty envelope.
 *
 * Both ends of a change are handled: the outgoing Mastermind's player (if
 * there was one, and if somebody actually owns that character) has their flag
 * cleared, and the incoming one's is set — in that order, so a single player
 * who somehow owns both never ends up cleared by the second half of their own
 * promotion.
 */
function notifyDoorAccess(previousActorId, nextActorId, room = null) {
    if (previousActorId && previousActorId !== nextActorId) {
        const outgoing = ownerOf(game.actors.get(previousActorId));
        if (outgoing && !outgoing.isGM) sendDoorFlag(outgoing.id, false);
    }
    if (nextActorId) {
        const incoming = ownerOf(game.actors.get(nextActorId));
        // Sent on every write, not only on a change of WHO — the lair moving
        // is the other thing this flag carries now, and the recipient's copy
        // must follow it.
        if (incoming && !incoming.isGM) sendDoorFlag(incoming.id, true, room);
    }
}

function sendDoorFlag(userId, value, room = null) {
    try {
        game.socket.emit(SOCKET_EVENT,
            // `room` travels only alongside `value: true` — a "you are not the
            // Mastermind" carries no location, so a cleared player's client
            // holds nothing worth reading.
            { action: ACTION_DOOR, from: game.user.id, value, room: value ? (room ?? null) : null },
            { recipients: [userId] });
    } catch (err) {
        error("Could not deliver the Mastermind's private door flag", err);
    }
}

/**
 * `iAmTheMastermind()` used to live here and now lives in settings.mjs, beside
 * the client-scoped setting it reads. It was the single edge every static
 * import cycle in the module passed through — movement.mjs had to reach into
 * this file for it — and the note above the function there says why moving it
 * was the fix rather than a workaround.
 *
 * Still imported here, because `myLairRoom` asks the same question.
 */

/**
 * The Mastermind's own room, on the client that holds the part — null for
 * everyone else, including every GM (they read the store instead). Delivered
 * over the same private whisper as the door flag; see `sendDoorFlag`.
 *
 * What standing in it buys is decided elsewhere: visibility.mjs shows the
 * whole cast to a Mastermind whose own token is in this room, and takes it
 * away the moment they leave.
 */
export function myLairRoom() {
    if (!iAmTheMastermind()) return null;
    try {
        return game.settings.get(MODULE_ID, SETTINGS.myMastermindLair) || null;
    } catch {
        return null;
    }
}

/** The lair as the GMs know it. `null` off a non-GM client — not an error. */
export function mastermindLair() {
    if (!game.user.isGM) return null;
    return readStore().room ?? null;
}

/** The Mastermind's actor. `null` for anyone who is not a GM — not an error. */
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
 * Choose the Mastermind. GM only, and singular — the guide's "DMowie wybierają
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
    await writeStore(readStore().actorId ?? null, room ?? null);
}

/** Clear the pick — a fresh season, or a correction. The lair goes with it. */
export async function clearMastermind() {
    if (!game.user.isGM) return;
    await writeStore(null, null);
}

export function registerMastermind() {
    /*
     * GM-to-GM only, and that has to be checked on BOTH ends.
     *
     * It used to be checked on one. "A player's client never receives this — the
     * server filters by `recipients`" was true and beside the point: nothing
     * stopped a player from SENDING one. Two consequences, and the second is the
     * worst hole this module has had:
     *
     *   · a forged `set` with a large `updated` rewrote every GM's copy of who
     *     the Mastermind is;
     *   · a forged `request` was answered — the reply went to `payload.from`,
     *     an id the sender chose, so any player could ask the GMs to send them
     *     the Mastermind's identity and be given it.
     *
     * Both are closed the same way: trust Foundry's own `senderId` argument and
     * nothing inside the payload. `from` is kept only so a GM ignores its own
     * broadcast, and the reply is addressed to whoever actually asked.
     */
    game.socket.on(SOCKET_EVENT, async (payload, senderId) => {
        if (!game.user.isGM) return;

        // A player asking "am I the Mastermind" is the one legitimate non-GM
        // sender on this channel — see the reload note on ACTION_DOOR_REQUEST
        // below. Every GM answers, from their own (synced) copy of the pick,
        // so a duplicate reply here is harmless: the player's client just
        // writes the same boolean twice.
        if (payload?.action === ACTION_DOOR_REQUEST) {
            const mine = readStore();
            const owns = Boolean(mine.actorId
                && ownerOf(game.actors.get(mine.actorId))?.id === senderId);
            sendDoorFlag(senderId, owns, owns ? (mine.room ?? null) : null);
            return;
        }

        if (!game.users.get(senderId)?.isGM) {
            if (payload?.action === ACTION_SET || payload?.action === ACTION_REQUEST) {
                warn(`Refused a Mastermind "${payload.action}" from a non-GM (${
                    game.users.get(senderId)?.name ?? senderId}).`);
            }
            return;
        }
        if (senderId === game.user.id) return;

        if (payload?.action === ACTION_SET) {
            const mine = readStore();
            if ((mine.updated ?? 0) >= (payload.entry?.updated ?? 0)) return;
            await game.settings.set(MODULE_ID, SETTINGS.mastermind, payload.entry);
            return;
        }

        if (payload?.action === ACTION_REQUEST) {
            const mine = readStore();
            if (!mine.actorId) return;
            try {
                game.socket.emit(SOCKET_EVENT,
                    { action: ACTION_SET, from: game.user.id, entry: mine },
                    { recipients: [senderId] });
            } catch (err) {
                error("Could not answer a Mastermind request", err);
            }
        }
    });

    /*
     * The private half: GM -> the Mastermind's own player, and nobody else.
     *
     * A SEPARATE listener rather than a branch inside the one above, because
     * that one starts with `if (!game.user.isGM) return` — this is the one
     * message in the whole module that a PLAYER client is meant to act on.
     * Foundry's `recipients` addressing already means only the intended
     * player's browser ever receives a payload here at all; the sender check
     * below is the same discipline as the GM-to-GM handler regardless, so a
     * forged message from a player cannot plant this flag on themselves —
     * `senderId` is Foundry's own, not a claim inside the payload.
     */
    game.socket.on(SOCKET_EVENT, async (payload, senderId) => {
        if (payload?.action !== ACTION_DOOR) return;
        if (!game.users.get(senderId)?.isGM) return;
        try {
            await game.settings.set(MODULE_ID, SETTINGS.iAmMastermind, Boolean(payload.value));
            // The lair travels with the flag and dies with it — a cleared
            // player keeps no record of where the room was.
            await game.settings.set(MODULE_ID, SETTINGS.myMastermindLair,
                payload.value ? (payload.room ?? "") : "");
            // Standing in the lair may already be true the moment the part
            // arrives — repaint rather than waiting for the next token move.
            const { applyAll } = await import("./visibility.mjs");
            applyAll();
        } catch (err) {
            error("Could not record the Mastermind's private door flag", err);
        }
    });

    // A GM who just joined, or whose browser storage was cleared, asks the
    // others rather than starting the season blind.
    //
    // EVERY GM asks, not only the primary one — the same unconditional catch-up
    // `truth-bullets.mjs` does for the answer key. Gating it on `isPrimaryGm()`
    // meant the one client most likely to be missing the pick, a second GM
    // joining after the season started, was the one client that never asked.
    if (game.user.isGM) {
        const recipients = gmIds().filter(id => id !== game.user.id);
        if (recipients.length) {
            try {
                game.socket.emit(SOCKET_EVENT,
                    { action: ACTION_REQUEST, from: game.user.id }, { recipients });
            } catch (err) {
                error("Could not ask the other GMs for the Mastermind", err);
            }
        }
        return;
    }

    // A player's browser storage does not survive a reload the way a GM's
    // synced copy does — `iAmMastermind` is client-scoped precisely so it
    // never becomes world data, and the cost of that is that nobody re-sends
    // it unasked. Every player asks, every time; the GM's answer is a single
    // boolean about this one user and nothing else, so asking is free even
    // for the vast majority of players who get "no" back.
    const gms = gmIds();
    if (gms.length) {
        try {
            game.socket.emit(SOCKET_EVENT,
                { action: ACTION_DOOR_REQUEST, from: game.user.id }, { recipients: gms });
        } catch (err) {
            error("Could not ask the GMs for door access", err);
        }
    }
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
 * Mastermind screen — the one window that names the season's secret — keeps
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
    // "Announce the Final Trial? This is public — everyone sees it start" is
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

export async function openMastermindDialog() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const students = studentActors();
    const current = mastermindActor();

    const options = students.map(a =>
        `<option value="${a.id}"${a.id === current?.id ? " selected" : ""}>${
            foundry.utils.escapeHTML(a.name)}</option>`).join("");

    const { monokumas, poolLabel, getDespair } = await import("./despair.mjs");
    const gms = monokumas();
    const donors = gms.map(u =>
        `<option value="${u.id}">${foundry.utils.escapeHTML(poolLabel(u))} (${getDespair(u.id)})</option>`
    ).join("");

    const { allRooms } = await import("./movement.mjs");

    // The Final Key Remnant planner that used to sit here lives on the
    // Investigation dashboard now (Dawid, 26.08) — this screen names the one
    // secret the module guards hardest, and planting endgame clues gave a GM
    // reasons to have it open. What is left is the role and the lair.
    const lair = readStore().room ?? "";
    const roomOptions = allRooms().map(r =>
        `<option value="${foundry.utils.escapeHTML(r)}"${r === lair ? " selected" : ""}>${
            foundry.utils.escapeHTML(r)}</option>`).join("");

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Mastermind.dialogTitle") },
        classes: ["drpg-panel"],
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
                    <option value="">—</option>
                    ${roomOptions}
                </select></label>
            <p class="notes">${game.i18n.localize("DRPG.Mastermind.lairNote")}</p>

            ${current ? `
            <fieldset>
                <legend>${game.i18n.localize("DRPG.Monocub.giveHope")}</legend>
                <p class="notes">${game.i18n.format("DRPG.Mastermind.hopeReadout", {
                    held: current.system?.resources?.hope?.value ?? 0
                })}</p>
                <select name="donor">${donors}</select>
                <input type="number" name="amount" min="1" value="1" style="width:4em" />
                <button type="button" class="drpg-mini-button" data-drpg-give>
                    ${game.i18n.localize("DRPG.Monocub.give")}</button>
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
                // closing this window with the X — changing nothing, touching
                // nothing — deleted the secret of the season. Measured: set the
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
            // a duplicate with worse neighbours. The verdict stays — it has no
            // other home.
            { action: "finalVerdict", label: game.i18n.localize("DRPG.Mastermind.verdictTitle") },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        render: (event, dialog) => {
            dialog.element.querySelector("[data-drpg-give]")?.addEventListener("click", async () => {
                const donorId = dialog.element.querySelector("[name=donor]")?.value;
                const amount = Number(dialog.element.querySelector("[name=amount]")?.value) || 0;
                if (donorId && amount > 0 && current) {
                    const { convertDespairToHope } = await import("./despair.mjs");
                    await convertDespairToHope(donorId, current, amount);
                    await dialog.close();
                    await openMastermindDialog();
                }
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

    // Only the Apply button reaches here, and it always brings an object — so
    // an empty `who` is the GM choosing "Nobody" on purpose.
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

/* ==========================================================================
 * THE FINAL TRUTH REMNANT
 * --------------------------------------------------------------------------
 * Nothing new mechanically — `type: "final"` already exists in REMNANT_TYPES,
 * already carries `reinforced: true`, and `dropRemnant`/`placeRemnant` already
 * know how to place it. This is only the "did I remember this chapter" check
 * the guide's cadence ("co rozdział") asks for.
 * ========================================================================== */

/**
 * Every trace typed `final`, across every scene, newest chapter first.
 *
 * The endgame's own clues, listed where they are decided. They also appear in
 * the Investigation Dashboard's Traces table like every other trace — reading
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
 * Same shape as the Key Remnant planner's own placement — a GM construction
 * dropped at a random point in the named room, not something an actor left
 * behind — but typed `final`. `REMNANT_TYPES.final` already carries
 * `reinforced: true`, so `placeRemnant` makes it un-cleanable without this
 * having to say so: the one clue a chapter's endgame turns on is not something
 * a killer gets to wipe off the floor.
 *
 * Lived on the Investigation Dashboard's third tab until now, which meant two
 * windows could write the same record. One entry, one place it is changed.
 */
export async function placeFinalRemnant({ room, visibility = "evident", note = "" } = {}) {
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

    return placeRemnant({
        x: spot.x, y: spot.y, sceneId: scene?.id ?? null,
        type: "final", visibility, faint: false,
        tiedToCrime: true, reinforced: true, note,
        subject: game.i18n.localize("DRPG.Remnant.finalSubject"),
        action: "manual", room,
        chapter: clock.chapter, day: clock.day, timeOfDay: clock.timeOfDay
    });
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

/** Toggle the flag. Announces to the table — this part is not a secret. */
export async function setFinalTrial(value) {
    if (!game.user.isGM) return null;
    return setClock({ finalTrial: Boolean(value) });
}

/**
 * The Final Trial's verdict.
 *
 * Deliberately not `vote.mjs`'s `applyVerdict`: the guide's consequences here
 * are a different shape entirely. A normal wrong guess executes an innocent
 * and pays the Monokumas; a wrong Final Trial guess does neither — it reveals
 * that the game was never what it looked like, and nobody new dies for it.
 *
 * "Correct" branches on the Mastermind being alive to answer for it — if they
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
        buttons: [
            {
                action: "correct", label: game.i18n.localize("DRPG.Mastermind.correctlyNamed"),
                default: !alreadyDead,
                disabled: alreadyDead,
                callback: (e, b, d) => ({
                    correct: true, accusedId: d.element.querySelector("[name=accused]").value
                })
            },
            {
                action: "wrong", label: game.i18n.localize("DRPG.Mastermind.notCorrectlyNamed"),
                default: alreadyDead,
                callback: (e, b, d) => ({
                    correct: false, accusedId: d.element.querySelector("[name=accused]").value
                })
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
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
            accused: foundry.utils.escapeHTML(accused?.name ?? "—"),
            outcome: game.i18n.localize(executed ? "DRPG.Mastermind.outcomeExecuted"
                : dead ? "DRPG.Mastermind.outcomeAlreadyDead" : "DRPG.Mastermind.outcomeEscaped")
        })}</p>`);

    // The season is over either way — a Final Trial is the guide's ending, not
    // a chapter like the others. Clearing the pick here rather than leaving it
    // set is what makes `mastermindActor()` honestly answer "nobody" afterwards.
    await clearMastermind();

    log(`Final Trial verdict applied: ${executed ? "executed" : "revealed, not executed"}.`);
    return { executed, dead };
}
