/**
 * Danganronpa RPG — private narration that is actually private.
 * ---------------------------------------------------------------------------
 *
 * WHAT THIS FIXES, AND IT WAS MEASURED, NOT SUSPECTED.
 *
 * A whisper is a courtesy, not a secret. Foundry sends every chat message to
 * every connected client and hides the ones you are not a recipient of in the
 * interface. Measured in E17, on a fresh reload of a player's browser: the
 * player's client held 717 messages, the same count as the GM's, including
 * cards it was not addressed on. Among them, in full:
 *
 *     "You lift SUITE loot out of Player A's pocket. Nobody saw you do it."
 *
 * `visible: false`, not in the DOM, and one line of console away from the
 * victim. This module's entire investigation rests on private narration — what
 * a trace really is, who took what from whom, what the GM ruled — and all of it
 * was going out the same way.
 *
 * THE SHAPE OF THE FIX. The card stays a real chat message: same place in the
 * log, same scrollback, same deletion, same ordering, same everything a player
 * expects. What changes is that the SENTENCE does not travel with it.
 *
 *   1. The message is created with a neutral stub for content and a flag saying
 *      a secret belongs to it.
 *   2. The real HTML goes over an addressed socket to exactly the recipients.
 *   3. Each recipient keeps it in a CLIENT-scoped setting, which is the one
 *      store in Foundry that never leaves the browser it was written in — the
 *      same reason `remnantSecrets` lives there.
 *   4. `renderChatMessageHTML` swaps the real text in for anyone who holds it.
 *
 * WHAT STILL LEAKS, said plainly rather than left for somebody to discover: a
 * non-recipient can still see THAT a private card exists, when, from which
 * speaker, and who it was addressed to. That is metadata and it cannot be
 * removed without giving up the chat log itself — the recipient list is what
 * Foundry routes on. The content is the thing that was worth moving, and the
 * content is gone.
 *
 * WHAT IT COSTS. A GM who was not connected when a secret was posted will never
 * see that sentence: there is no server-side copy to catch up from. Before this,
 * every GM saw every whisper forever. That is the trade, and it is the right way
 * round — a second GM reading yesterday's private narration is a convenience; a
 * player reading it is the game.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS, getSetting } from "./settings.mjs";
import { debug, error } from "./utils.mjs";

const SOCKET_EVENT = `module.${MODULE_ID}`;
const ACTION_SECRET = "secret.card";

/** The flag that says "this card's words are somewhere else". */
export const SECRET_FLAG = "secret";

/**
 * What a client that is not holding the words sees in the document.
 *
 * Deliberately empty of information AND deliberately not empty of markup: a
 * message whose content is the empty string renders as a blank card, and a
 * blank card in the log looks like the module lost something. This never
 * reaches a recipient's screen — the render hook replaces it — so its only
 * audience is somebody reading the database, and what it tells them is nothing.
 */
const STUB = '<p class="notes" data-drpg-secret>&mdash;</p>';

/**
 * Is this card's document still clean?
 *
 * BY MARK, NOT BY STRING EQUALITY, and the first run of the suite is why:
 * Foundry normalises the HTML it stores, so `&mdash;` comes back as an em dash
 * and a straight comparison against STUB reported the module leaking its own
 * stub. The attribute survives whatever the round trip does to the text.
 */
const isStub = content => String(content ?? "").includes("data-drpg-secret");

/** How many secrets a browser keeps. Beyond this the oldest go. */
const KEEP = 500;

/* ==========================================================================
 * THE STORE
 * ========================================================================== */

/**
 * Held between writes, like the Remnant ledger and for the same measured
 * reason: a client-scoped setting is a string in localStorage and every read
 * re-parses it. This one is read once per rendered card.
 */
let cache = null;

function read() {
    if (cache) return cache;
    try {
        cache = getSetting(SETTINGS.secretCards) ?? {};
    } catch (err) {
        debug("Could not read the private-card store", err);
        cache = {};
    }
    return cache;
}

async function write(next) {
    cache = next;
    try {
        await game.settings.set(MODULE_ID, SETTINGS.secretCards, next);
    } catch (err) {
        error("Could not keep a private card", err);
        cache = null;
    }
}

/** Drop the parsed copy — something else wrote the store. */
export function forgetSecrets() {
    cache = null;
}

/** The words belonging to a card, if this browser is holding them. */
export function secretHtml(message) {
    if (!message?.id) return null;
    if (!message.flags?.[MODULE_ID]?.[SECRET_FLAG]) return null;
    return read()[message.id]?.html ?? null;
}

/**
 * What a card SAYS on this client.
 *
 * Every reader of `message.content` in this module goes through here, because
 * a reader that does not is a reader that shows the stub — and the stub is a
 * dash. See the R15 criterion, which exists to keep that true.
 */
export function contentOf(message) {
    return secretHtml(message) ?? message?.content ?? "";
}

async function remember(id, html, at) {
    const store = { ...read(), [id]: { html, at: at ?? Date.now() } };

    const ids = Object.keys(store);
    if (ids.length > KEEP) {
        // Oldest first, and only as many as we are over by. A store that
        // emptied itself on every overflow would lose a whole session's
        // narration to one busy evening.
        ids.sort((a, b) => (store[a].at ?? 0) - (store[b].at ?? 0));
        for (const stale of ids.slice(0, ids.length - KEEP)) delete store[stale];
    }
    await write(store);
}

/** A card that is gone takes its words with it. */
async function forget(ids = []) {
    const store = read();
    const doomed = ids.filter(id => store[id]);
    if (!doomed.length) return;
    const next = { ...store };
    for (const id of doomed) delete next[id];
    await write(next);
}

/* ==========================================================================
 * POSTING
 * ========================================================================== */

/**
 * Post a card whose words only the recipients ever hold.
 *
 * @param {object}   data              Everything `ChatMessage.create` takes.
 * @param {string}   data.content      The sentence that must not travel.
 * @param {string[]} data.whisper      Who may read it. Required — a secret with
 *                                     no audience is a bug, not a broadcast.
 * @returns {Promise<ChatMessage|null>}
 */
export async function postSecret(data = {}) {
    const recipients = [...new Set((data.whisper ?? []).filter(Boolean))];
    if (!recipients.length) {
        error("Refused to post a private card with nobody to read it.");
        return null;
    }

    const html = data.content ?? "";
    const message = await ChatMessage.create({
        ...data,
        content: STUB,
        whisper: recipients,
        flags: foundry.utils.mergeObject(
            data.flags ?? {},
            { [MODULE_ID]: { [SECRET_FLAG]: true } },
            { inplace: false }
        )
    });
    if (!message) return null;

    const at = message.timestamp ?? Date.now();

    // Ourselves first and without the socket: a GM posting a card they are a
    // recipient of should never be waiting on their own network round trip to
    // read what they just wrote.
    if (recipients.includes(game.user.id)) {
        await remember(message.id, html, at);
        refresh(message);
    }

    const others = recipients.filter(id => id !== game.user.id);
    if (others.length) {
        try {
            game.socket.emit(SOCKET_EVENT,
                { action: ACTION_SECRET, id: message.id, html, at },
                { recipients: others });
        } catch (err) {
            // The card exists and says nothing. Better than the reverse.
            error("Could not deliver a private card's words", err);
        }
    }

    return message;
}

/** Redraw one card in place, once its words have arrived. */
function refresh(message) {
    try {
        if (message && ui.chat?.rendered) ui.chat.updateMessage(message);
    } catch (err) {
        // A card that will be right on the next render is not worth an error.
        debug("Could not redraw a private card", err);
    }
}

/* ==========================================================================
 * WIRING
 * ========================================================================== */

export function registerSecrets() {
    game.socket.on(SOCKET_EVENT, async payload => {
        if (payload?.action !== ACTION_SECRET) return;
        if (!payload.id || typeof payload.html !== "string") return;
        try {
            await remember(payload.id, payload.html, payload.at);
            refresh(game.messages.get(payload.id));
        } catch (err) {
            error("Could not keep a private card that arrived", err);
        }
    });

    /*
     * THE SWAP. Runs on the recipient's own client, against their own store, on
     * a document that never carried the sentence.
     */
    Hooks.on("renderChatMessageHTML", (message, element) => {
        try {
            const html = secretHtml(message);
            if (!html) return;
            const body = element.querySelector(".message-content") ?? element;
            body.innerHTML = html;
        } catch (err) {
            debug("Could not show a private card", err);
        }
    });

    // A deleted card's words go with it, on every client that held them.
    Hooks.on("deleteChatMessage", message => {
        forget([message?.id]).catch(() => {});
    });

    // `clientSettingChanged`, not `updateSetting`: this store is client-scoped
    // and the document hook never fires for it (R14).
    Hooks.on("clientSettingChanged", key => {
        if (key === `${MODULE_ID}.${SETTINGS.secretCards}`) forgetSecrets();
    });
}

/** For the diagnostics window, and for the suite. */
export function diagnoseSecrets() {
    const store = read();
    const ids = Object.keys(store);
    return {
        held: ids.length,
        cap: KEEP,
        oldest: ids.length ? new Date(Math.min(...ids.map(id => store[id].at ?? 0))).toISOString() : null,
        // The question this file exists to answer, asked of the live world.
        leaking: game.messages.filter(m =>
            m.flags?.[MODULE_ID]?.[SECRET_FLAG] && !isStub(m.content)).map(m => m.id)
    };
}
