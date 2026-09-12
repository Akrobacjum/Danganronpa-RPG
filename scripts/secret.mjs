/**
 * Danganronpa RPG - private narration that is actually private.
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
 * victim. This module's entire investigation rests on private narration - what
 * a trace really is, who took what from whom, what the GM ruled - and all of it
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
 *      store in Foundry that never leaves the browser it was written in - the
 *      same reason `remnantSecrets` lives there.
 *   4. `renderChatMessageHTML` swaps the real text in for anyone who holds it.
 *
 * WHAT STILL LEAKS, said plainly rather than left for somebody to discover: a
 * non-recipient can still see THAT a private card exists, when, from which
 * speaker, and who it was addressed to. That is metadata, and for most cards
 * it is harmless - "somebody Searched at 21:03" is not a secret. For an
 * incident's cards it is the whole secret, and those are posted VEILED (see
 * `VEILED_FLAG` below): a neutral speaker, the whole table as the recipient
 * list, and a card that clients holding no words never draw. What a veiled
 * card still tells a reader of the database is that a private card was posted
 * at that moment by that user - the author is the one field Foundry stamps
 * server-side, and every incident card is posted by a GM's client.
 *
 * WHAT IT COSTS. A GM who was not connected when a secret was posted will never
 * see that sentence: there is no server-side copy to catch up from. Before this,
 * every GM saw every whisper forever. That is the trade, and it is the right way
 * round - a second GM reading yesterday's private narration is a convenience; a
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
 * The flag that says "and its audience is nobody's business either".
 *
 * THE OTHER HALF OF THE LEAK, the one the header above admits to: a bystander
 * could still read WHO a private card was addressed to and WHICH actor it
 * spoke as. For an incident's cards that metadata is the whole secret - the
 * recipient list of a crisis card IS the cast. A veiled card carries a neutral
 * speaker and the whole table as its `whisper` list, so the document says
 * nothing about anybody; the words still travel only to the real readers,
 * and a client holding no words hides the card instead of drawing a stub.
 */
export const VEILED_FLAG = "veiled";

/** Is this a card whose document deliberately names nobody? */
export function isVeiled(message) {
    return Boolean(message?.flags?.[MODULE_ID]?.[VEILED_FLAG]);
}

/** Everybody: the audience a veiled card is written to. */
function everyone() {
    return game.users.filter(u => Boolean(u?.id)).map(u => u.id);
}

/**
 * What a client that is not holding the words sees in the document.
 *
 * Deliberately empty of information AND deliberately not empty of markup: a
 * message whose content is the empty string renders as a blank card, and a
 * blank card in the log looks like the module lost something. This never
 * reaches a recipient's screen - the render hook replaces it - so its only
 * audience is somebody reading the database, and what it tells them is nothing.
 */
const STUB = '<p class="notes" data-drpg-secret>-</p>';

/**
 * Is this card's document still clean?
 *
 * BY MARK, NOT BY STRING EQUALITY, and the first run of the suite is why:
 * Foundry normalises the HTML it stores, so the stub's own text came back
 * changed and a straight comparison against STUB reported the module leaking
 * its own stub. The attribute survives whatever the round trip does to the
 * text. (The text used to be an em-dash HTML entity, which is exactly the kind
 * of round trip that put back the character the module does not want anywhere;
 * it is a plain hyphen now.)
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

/** Drop the parsed copy - something else wrote the store. */
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
 * a reader that does not is a reader that shows the stub - and the stub is a
 * dash. See the R15 criterion, which exists to keep that true.
 */
/**
 * Anyone waiting for a card's words to arrive, by message id.
 *
 * THE STUB LANDS FIRST AND IT ALWAYS WILL. `postSecret` has to create the
 * message before it can address the socket, because the id it keys the words
 * with does not exist until then - so on a recipient's client the document
 * arrives, `createChatMessage` fires, and the words are still in flight. The
 * chat log survives that: `refresh()` redraws the card in place when they
 * land. A POPUP DOES NOT - it is drawn once and never asked again, which is
 * why every private notice has been coming up blank (Dawid, 28.08).
 */
const waiting = new Map();

/**
 * Resolve when this message's words are here, or when waiting stops being
 * worth it.
 *
 * A CEILING RATHER THAN A PROMISE THAT MIGHT NEVER SETTLE: if the socket never
 * arrives - the poster went offline mid-send, the card was not secret at all -
 * the caller gets whatever the document says instead of a notice that never
 * appears. A blank card is a bug; a missing one is a bug nobody can even
 * report.
 *
 * @param {ChatMessage} message
 * @param {number} [ms]  How long to wait before giving up.
 * @returns {Promise<string>} the words, or the document's own content.
 */
export function wordsOf(message, ms = 4000) {
    const known = secretHtml(message);
    if (known !== undefined && known !== null) return Promise.resolve(known);
    if (!message?.id || !isStub(message.content)) {
        return Promise.resolve(message?.content ?? "");
    }

    return new Promise(resolve => {
        const done = html => {
            clearTimeout(timer);
            waiting.delete(message.id);
            resolve(html ?? message.content ?? "");
        };
        const timer = setTimeout(() => {
            debug(`Secret cards: the words for ${message.id} never arrived; `
                + "drawing what the card itself says.");
            done(null);
        }, ms);
        waiting.set(message.id, done);
    });
}

export function contentOf(message) {
    return secretHtml(message) ?? message?.content ?? "";
}

async function remember(id, html, at, pin = false) {
    // Anything holding a notice open for these words gets them now.
    const pending = waiting.get(id);
    if (pending) pending(html);

    const store = { ...read(), [id]: { html, at: at ?? Date.now(), ...(pin ? { pin: true } : {}) } };

    // Oldest first, and only as many as we are over by. A store that emptied
    // itself on every overflow would lose a whole session's narration to one
    // busy evening. PINNED cards - the messenger's threads, the longest-lived
    // cards in the world - are never the ones to go: a thread that aged out
    // of the store would show its oldest bubbles as dashes.
    const ids = Object.keys(store).filter(key => !store[key].pin);
    if (ids.length > KEEP) {
        ids.sort((a, b) => (store[a].at ?? 0) - (store[b].at ?? 0));
        for (const stale of ids.slice(0, ids.length - KEEP)) delete store[stale];
    }
    await write(store);

    // A thread's window draws its bubbles from this store: the one whose
    // words just landed is redrawn in place, the way a settled card is.
    const message = game.messages?.get(id);
    const thread = message?.flags?.[MODULE_ID]?.thread;
    if (thread) Hooks.callAll("drpgMessengerEdited", thread, message);
}

/** A card the store must never age out: a messenger thread's. */
function pinned(flags) {
    return Boolean(flags?.[MODULE_ID]?.thread);
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
 * @param {string[]} data.whisper      Who may read it. Required - a secret with
 *                                     no audience is a bug, not a broadcast.
 * @param {boolean}  [data.veiled]     Hide the audience and the speaker too:
 *                                     the document is addressed to everybody
 *                                     and speaks as nobody in particular. For
 *                                     cards whose recipient list would itself
 *                                     be a secret - an incident's.
 * @returns {Promise<ChatMessage|null>}
 */
export async function postSecret(data = {}) {
    const { veiled = false, ...rest } = data ?? {};
    const recipients = [...new Set((rest.whisper ?? []).filter(Boolean))];
    if (!recipients.length) {
        error("Refused to post a private card with nobody to read it.");
        return null;
    }

    const html = rest.content ?? "";
    const message = await ChatMessage.create({
        ...rest,
        ...(veiled ? { speaker: { alias: game.i18n.localize("DRPG.Secret.speaker") } } : {}),
        content: STUB,
        whisper: veiled ? everyone() : recipients,
        flags: foundry.utils.mergeObject(
            rest.flags ?? {},
            { [MODULE_ID]: { [SECRET_FLAG]: true, ...(veiled ? { [VEILED_FLAG]: true } : {}) } },
            { inplace: false }
        )
    });
    if (!message) return null;

    const at = message.timestamp ?? Date.now();
    const pin = pinned(rest.flags);

    // Ourselves first and without the socket: a GM posting a card they are a
    // recipient of should never be waiting on their own network round trip to
    // read what they just wrote.
    if (recipients.includes(game.user.id)) {
        await remember(message.id, html, at, pin);
        refresh(message);
    }

    const others = recipients.filter(id => id !== game.user.id);
    if (others.length) {
        try {
            game.socket.emit(SOCKET_EVENT,
                { action: ACTION_SECRET, id: message.id, html, at, pin },
                { recipients: others });
        } catch (err) {
            // The card exists and says nothing. Better than the reverse.
            error("Could not deliver a private card's words", err);
        }
    }

    return message;
}

/**
 * Replace a private card's words, on every client that holds them.
 *
 * For a card that changes after it was posted - a ruling card settling into a
 * receipt. `message.update({ content })` would put the words into the
 * document, which is the leak this file exists to close; so the document is
 * left alone and the new words travel the road the old ones did.
 *
 * @param {ChatMessage} message
 * @param {string} html
 * @param {string[]} [recipients]  Who holds the words. Defaults to the card's
 *   whisper list, which is right for every card that is not veiled.
 */
export async function updateSecret(message, html, recipients = null) {
    if (!message?.id) return null;
    const readers = [...new Set((recipients ?? message.whisper ?? []).filter(Boolean))];
    const at = read()[message.id]?.at ?? message.timestamp ?? Date.now();
    const pin = pinned(message.flags);
    if (readers.includes(game.user.id) || !readers.length) {
        await remember(message.id, html, at, pin);
        refresh(message);
    }
    const others = readers.filter(id => id !== game.user.id);
    if (others.length) {
        try {
            game.socket.emit(SOCKET_EVENT,
                { action: ACTION_SECRET, id: message.id, html, at, pin }, { recipients: others });
        } catch (err) {
            error("Could not deliver a private card's new words", err);
        }
    }
    return message;
}

/** The document a socket packet named, once Foundry delivers it - or null after a while. */
function messageArrives(id, ms = 4000) {
    return new Promise(resolve => {
        const hook = Hooks.on("createChatMessage", message => {
            if (message?.id !== id) return;
            Hooks.off("createChatMessage", hook);
            clearTimeout(timer);
            resolve(message);
        });
        const timer = setTimeout(() => {
            Hooks.off("createChatMessage", hook);
            resolve(game.messages.get(id) ?? null);
        }, ms);
    });
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
    game.socket.on(SOCKET_EVENT, async (payload, senderId) => {
        if (payload?.action !== ACTION_SECRET) return;
        if (!payload.id || typeof payload.html !== "string") return;
        try {
            /*
             * WHO MAY PUT WORDS ON A CARD (CASE-13): a GM, or the card's own
             * author. Anybody else sending `secret.card` for somebody else's
             * message was writing spoofed narration - "the GM ruled..." -
             * into a real card on another player's screen. The document
             * usually lands before its words; when it has not yet, the check
             * waits for it rather than trusting the packet.
             */
            const sender = game.users.get(senderId ?? "");
            if (!sender?.isGM) {
                const message = game.messages.get(payload.id) ?? await messageArrives(payload.id);
                const author = message?.author?.id ?? message?.user?.id ?? null;
                if (!message || author !== senderId) {
                    debug(`Refused private words for ${payload.id} from ${sender?.name ?? senderId}: not the author.`);
                    return;
                }
            }
            await remember(payload.id, payload.html, payload.at, Boolean(payload.pin));
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
            if (!html) {
                // A veiled card this client was not sent the words of is not
                // this client's card: hidden, not blanked, so the log shows
                // neither a dash nor a gap where somebody else's secret sits.
                if (isVeiled(message)) {
                    element.classList.add("drpg-veiled");
                    element.style.display = "none";
                }
                return;
            }
            element.classList.remove("drpg-veiled");
            element.style.display = "";
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
