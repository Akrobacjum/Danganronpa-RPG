/**
 * Danganronpa RPG — the messenger.
 * ---------------------------------------------------------------------------
 * One shared conversation per player: the player and every current GM read
 * and write into the same thread. There is no per-(player, GM) copy — a GM
 * opening "chat with Alice" sees exactly what every other GM sees, because it
 * is the same conversation, not their own private copy of it. There is no
 * player-to-player channel; in-room talk is voice, not text — that lives in
 * its own subsystem, not here.
 *
 * A thread is not a document of its own — it is every ChatMessage whispered
 * to `[playerUserId, ...gmIds()]` and flagged with which player it belongs
 * to. That whisper target is exactly what `whisperToOwner()` in utils.mjs
 * already sends; this file gives it persistence (read with `threadMessages`
 * instead of scrolling past it) and a window instead of the sidebar.
 *
 * `callGm()` in gm-bridge.mjs posts into these same threads — an action that
 * needs a human ruling (Observe, Analyze, Direct Murder…) shows up right next
 * to the player's own typed messages, in the same conversation.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { gmIds, error, warn } from "./utils.mjs";
import { playSfx } from "./sfx.mjs";

/** Flag keys, all stored under `flags["danganronpa-rpg"]` on a ChatMessage. */
export const MESSENGER_FLAGS = {
    /** Which player's thread this message belongs to — a User id. */
    thread: "thread",
    /** "dm" (typed in the messenger window) | "action" (a callGm() ruling card). */
    kind: "kind",
    /** This card ASKS the GM for something and waits on the answer.
     *  Carried as its own flag rather than derived from the author, because
     *  several asks are posted BY a GM client on a player's behalf — the
     *  bridge writes a parked murder's card from the GM's own session — and
     *  an author check reads those as the GM talking to themselves. */
    gmAsk: "gmAsk",
    /** This card HAS been answered — see `settleCall` in gm-bridge.mjs. The
     *  card's own text already says so; the flag is what lets a renderer know
     *  without reading the HTML back. */
    settled: "settled"
};

export const THREAD_KIND = {
    dm: "dm",
    action: "action"
};

export function registerMessenger() {
    Hooks.on("createChatMessage", onCreateChatMessage);
    Hooks.on("updateChatMessage", onUpdateChatMessage);
}

/* ==========================================================================
 * WHO HAS A THREAD
 * ========================================================================== */

/** Every user a thread can exist for — one per non-GM user. */
export function threadUsers() {
    return game.users.filter(u => !u.isGM);
}

/** Guards against ever opening or writing into a "thread" for a GM. */
export function isThreadUser(userId) {
    const user = game.users.get(userId);
    return Boolean(user && !user.isGM);
}

/* ==========================================================================
 * READING
 * ========================================================================== */

/** Every message in a player's thread, oldest first. */
export function threadMessages(playerUserId) {
    return game.messages
        .filter(m => m.getFlag(MODULE_ID, MESSENGER_FLAGS.thread) === playerUserId)
        .sort((a, b) => a.timestamp - b.timestamp);
}

export function lastMessage(playerUserId) {
    const all = threadMessages(playerUserId);
    return all[all.length - 1] ?? null;
}

/* ---- read state, per client ------------------------------------------------
 * The player and each individual GM has their own idea of what they have
 * read. A world-scoped setting would make one GM's read state clear
 * everyone else's badge, so this is deliberately client-scoped.
 * -------------------------------------------------------------------------- */

function readMap() {
    try {
        return game.settings.get(MODULE_ID, SETTINGS.messengerLastRead) ?? {};
    } catch {
        // Not registered yet (settings run before this does, but stay quiet
        // rather than throwing if module load order ever changes).
        return {};
    }
}

export function lastReadAt(playerUserId) {
    return readMap()[playerUserId] ?? 0;
}

export async function markThreadRead(playerUserId) {
    const map = { ...readMap(), [playerUserId]: Date.now() };
    await game.settings.set(MODULE_ID, SETTINGS.messengerLastRead, map);
    Hooks.callAll("drpgMessengerRead", playerUserId);
}

/** Unread messages in one thread, for the CURRENT client. Never counts your own. */
export function unreadCount(playerUserId) {
    const since = lastReadAt(playerUserId);
    return threadMessages(playerUserId)
        .filter(m => m.timestamp > since && (m.author?.id ?? m.user?.id) !== game.user.id)
        .length;
}

/** Total unread across every thread this client can see. */
export function totalUnread() {
    const mine = game.user.isGM ? threadUsers().map(u => u.id) : [game.user.id];
    return mine.reduce((sum, id) => sum + unreadCount(id), 0);
}

/* ==========================================================================
 * SENDING
 * ========================================================================== */

/**
 * Send free text into a player's thread. Called from the messenger window —
 * either the player themself, or any GM, may call this. The whisper target
 * is always the full roster, so there is only ever one copy of the message.
 */
export async function sendMessage(playerUserId, text, { kind = THREAD_KIND.dm } = {}) {
    const body = String(text ?? "").trim();
    if (!body) return null;
    if (!isThreadUser(playerUserId)) {
        warn(`Messenger: ${playerUserId} is not a player — refusing to send.`);
        return null;
    }

    const esc = foundry.utils.escapeHTML(body).replace(/\n/g, "<br>");
    return createThreadMessage(playerUserId, `<p>${esc}</p>`, kind);
}

/**
 * Post pre-built HTML — the callGm() ruling cards — into a player's thread.
 * The caller is responsible for escaping anything it interpolated.
 */
export async function postToThread(playerUserId, html, { kind = THREAD_KIND.action, gmAsk = false } = {}) {
    if (!isThreadUser(playerUserId)) return null;
    return createThreadMessage(playerUserId, html, kind, gmAsk);
}

async function createThreadMessage(playerUserId, content, kind, gmAsk = false) {
    const whisper = Array.from(new Set([playerUserId, ...gmIds()]));

    // The SENDER's sound, and it is deliberately not carried on the message:
    // the message already plays `chatReceive` for everyone it reaches, and the
    // sender is one of those people. Played here instead, on the one client
    // that is doing the sending.
    playSfx("chatSend");

    try {
        return await ChatMessage.create({
            content,
            whisper,
            flags: {
                [MODULE_ID]: {
                    [MESSENGER_FLAGS.thread]: playerUserId,
                    [MESSENGER_FLAGS.kind]: kind,
                    ...(gmAsk ? { [MESSENGER_FLAGS.gmAsk]: true } : {})
                }
            }
        });
    } catch (err) {
        error("Messenger: could not send.", err);
        return null;
    }
}

/* ==========================================================================
 * LIVE UPDATES
 * --------------------------------------------------------------------------
 * `drpgMessengerMessage` lets an open window append the new message without a
 * full re-render (and without losing whatever the player was mid-typing).
 * `drpgMessengerRead` lets the launcher badge and the roster popover refresh
 * the moment a window is opened, on whichever client that happened.
 * `drpgMessengerEdited` carries a message that CHANGED — a ruling card being
 * closed out, today — so an open window can redraw that one bubble instead of
 * re-rendering itself and throwing away whatever is half-typed in the box.
 * ========================================================================== */

function onCreateChatMessage(message) {
    const thread = message.getFlag(MODULE_ID, MESSENGER_FLAGS.thread);
    if (!thread) return;

    // Relevant to this client only if it is their own thread, or they are a
    // GM — every GM sees every thread.
    if (!game.user.isGM && game.user.id !== thread) return;

    Hooks.callAll("drpgMessengerMessage", thread, message);

    const authorId = message.author?.id ?? message.user?.id;
    if (authorId === game.user.id) return; // do not ping yourself

    /*
     * A REQUEST FOR A GM GETS ITS OWN SOUND, AND ONLY ONE.
     *
     * Every GM sees every thread, so without this a ruling request and a
     * player's chatter arrive identically — and the request is the one that is
     * waiting on somebody. The more specific sound REPLACES the general one
     * rather than joining it: two sounds for one message is how a table learns
     * to stop hearing either.
     */
    if (game.user.isGM && message.getFlag(MODULE_ID, MESSENGER_FLAGS.gmAsk)) {
        playSfx("gmAsk");
        return;
    }

    // Was a hard-coded chime. It is a mapped event now, and NOT a mapped event
    // by default: this module ships no audio and assigns none, so a world that
    // has not been through the Sound panel hears nothing here. That is the
    // bargain the playlists already make, and Season setup carries the row that
    // says so. `playSfx` swallows its own failures; there is nothing to guard.
    playSfx("chatReceive");
}

/**
 * A message in a thread changed. No sound and no badge: nothing new arrived,
 * something already read said something different.
 */
function onUpdateChatMessage(message) {
    const thread = message.getFlag(MODULE_ID, MESSENGER_FLAGS.thread);
    if (!thread) return;
    if (!game.user.isGM && game.user.id !== thread) return;
    Hooks.callAll("drpgMessengerEdited", thread, message);
}
