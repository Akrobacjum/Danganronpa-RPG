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
 * speaker, and who it was addressed to. Since E06 (27.09.2026) nothing more
 * of what it is: the module's flags that say what a card is - its popup's
 * title and tone, its sound, whether it is a ruling - travel with the words
 * (`splitFlags`, C7a), and the GMs' own prose goes to the GMs alone (C7b).
 * That is metadata, and for most cards it is harmless - "somebody Searched at
 * 21:03" is not a secret. For an incident's cards it is the whole secret, and
 * those are posted VEILED (see `VEILED_FLAG` below): a neutral speaker, the
 * whole table as the recipient list, the messenger's placement flags among the
 * words (C8), and a card that clients holding no words never draw - and while
 * an incident runs, every private card that would name a character or a player
 * is posted so, whoever posts it (`incidentVeils`). What a veiled card still
 * tells a reader of the database is that a private card was posted at that
 * moment by that user - the author is the one field Foundry stamps
 * server-side. A card a player's browser posts - among an incident's, a Loaded
 * Die's notice, a tool worn in the fight, an item used, a Call's receipt,
 * Stage 6's reshape card - carries that player as its author, veiled or not,
 * and the owner's answer Q2 (a) of 27.09.2026 leaves the author as it is until
 * E28. The GM handbook's section 1 lists what the chat still says.
 *
 * WHAT IT COSTS. A GM who was not connected when a secret was posted will never
 * see that sentence: there is no server-side copy to catch up from. Before this,
 * every GM saw every whisper forever. That is the trade, and it is the right way
 * round - a second GM reading yesterday's private narration is a convenience; a
 * player reading it is the game.
 */

import { MODULE_ID, TIMING } from "./config.mjs";
import { SETTINGS, getSetting } from "./settings.mjs";
import { debug, warn, error, isPrimaryGm, log, forcedDeletion, gmIds, MESSAGE_FLAG } from "./utils.mjs";
import { ownsActor } from "./bridge-guards.mjs";

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
export const STUB = '<p class="notes" data-drpg-secret>-</p>';

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
export const isStub = content => String(content ?? "").includes("data-drpg-secret");

/** How many secrets a browser keeps. Beyond this the oldest go. */
const KEEP = TIMING.secretCardsKept;

/*
 * WHAT A PLAYER MAY PUT IN THIS STORE (E02, 24.09.2026; audit S01-03, S11-01,
 * S11-28, S11-29).
 *
 * The store is the one place in the module where HTML goes into `innerHTML`
 * without passing the server: a document's `content` is cleaned by Foundry
 * before anybody sees it, and the whole point of this file is that the words
 * never touch the document. So the cleaning the server would have done is done
 * here. Words sent by a player - their own messenger bubble, the only honest
 * case - are run through `cleanHTML` when they arrive; words written by a GM are
 * stored as the GM wrote them, because a GM's card carries its own buttons and a
 * GM can already run anything they like. Every entry that was not stored by a
 * GM this way - a player's, and every entry written before this existed - is
 * cleaned again when it is read, once per session.
 *
 * `cleanHTML` keeps `data-*` attributes and `<button>`, which is what a card's
 * actions are made of; it removes `on*` handlers and `javascript:` addresses,
 * which is what `<img src=x onerror=...>` is made of.
 */

/** Past this, a player's packet is not a messenger bubble - nor, since E05, a pre-session note (pre-session-note.mjs). 32 KB is a long letter. */
export const MAX_PLAYER_BYTES = 32 * 1024;

/*
 * A CARD'S FACTS TRAVEL WITH ITS WORDS (E05 C7, 26.09.2026; audit S10-05, S02-11).
 *
 * An action's result card carried what its header says as data - actor, action,
 * room, total, critical, what was found and at which tier, whether a trace was left
 * - in `flags.summary`, for the time of day's summary to read back (day-summary.mjs).
 * A flag is on the document, and the document is in every browser: 40-flow measured
 * p2 holding "Cereal bar" at `flags.danganronpa-rpg.summary.item` of p1's Search
 * card. The facts are the words' now: `postSecret` takes them as `summary`, sends
 * them in the same packet, and each recipient keeps them beside the words in this
 * store; `secretSummaries` answers them. Whoever sent them, they are kept as the
 * plain fields below and nothing else, and a player's facts that name a character
 * the player does not own are not kept at all.
 */
const SUMMARY_TEXT = 200;

/** The card's facts as plain fields - strings bounded, numbers finite - or null. Pure. */
export function plainSummary(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const text = v => (typeof v === "string" && v ? v.slice(0, SUMMARY_TEXT) : null);
    const number = v => (typeof v === "number" && Number.isFinite(v) ? v : null);
    const tier = number(raw.tier) ?? (typeof raw.tier === "string" && raw.tier ? raw.tier.slice(0, 20) : null);
    return {
        actorId: typeof raw.actorId === "string" && /^[A-Za-z0-9]{1,64}$/.test(raw.actorId) ? raw.actorId : null,
        action: text(raw.action),
        room: text(raw.room),
        total: number(raw.total),
        critical: raw.critical === true,
        item: text(raw.item),
        tier,
        leftTrace: raw.leftTrace === true,
        at: number(raw.at)
    };
}

/*
 * A CARD'S FACTS OF ITSELF TRAVEL WITH ITS WORDS TOO (E06 C7a, 27.09.2026; audit L16, S02-02).
 *
 * `summary` above took the day summary's facts off the document; the rest of what a
 * private card's module flags said stayed on it - the action it is about (`popupTitle`),
 * which way its roll went (`popupTone`), its sound, the item it used, that it asks the
 * GMs to rule (`callCard`, `gmPopup`) and that they have (`settled`). Every browser holds
 * the document, so p2 read "Search" and "hope" off p1's card. `postSecret` splits the
 * flags now: the document keeps what a client that holds no words needs to place the
 * card - that it is secret, veiled, the module's - and an ordinary thread card its
 * placement, because its whisper list names the thread's player already; the rest is
 * the card's `meta`, sent with the words and kept beside them. A veiled card's
 * placement is meta as well, since a veiled card is one whose audience is the secret.
 * `cardFlag` reads the document's flag, else the meta this browser holds.
 */
const DOCUMENT_FLAGS = Object.freeze([SECRET_FLAG, VEILED_FLAG, MESSAGE_FLAG]);
/** The messenger's (messenger.mjs `MESSENGER_FLAGS`): on an ordinary thread card's document, in a veiled one's meta. */
const PLACEMENT_FLAGS = Object.freeze(["thread", "kind", "gmAsk"]);
/**
 * What a player's meta may not say, judged where it arrives as a player's summary is: a
 * card that interrupts the GMs (`gmPopup`, `popupForce`) or carries a ruling's buttons
 * (`callCard`) is the module's to post, not a console's. Nor is the safeword's marker
 * (`safeword`): the real card is public and carries it on its document, and in a
 * private card's meta it rang the siren on the GMs' screens without pausing anything
 * (E06 fix r1-G5, 28.09.2026; the round-1 review's m3 - sfx.mjs reads it off the
 * document now as well).
 */
const GM_META = Object.freeze(["gmPopup", "popupForce", "callCard", "safeword"]);

/** A card's meta as a plain object without the document's own flags, or null. Pure. */
function plainMeta(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const out = Object.fromEntries(Object.entries(raw).filter(([key]) => !DOCUMENT_FLAGS.includes(key)));
    return Object.keys(out).length ? out : null;
}

/** `{ flags, meta }`: the module flags a private card's document keeps, and the rest. Pure. */
function splitFlags(flags, veiled) {
    const own = flags?.[MODULE_ID] ?? {};
    const keep = veiled ? DOCUMENT_FLAGS : [...DOCUMENT_FLAGS, ...PLACEMENT_FLAGS];
    const kept = Object.fromEntries(Object.entries(own).filter(([key]) => keep.includes(key)));
    const meta = plainMeta(Object.fromEntries(Object.entries(own).filter(([key]) => !keep.includes(key))));
    return {
        flags: { ...(flags ?? {}), [MODULE_ID]: { ...kept, [SECRET_FLAG]: true, ...(veiled ? { [VEILED_FLAG]: true } : {}) } },
        meta
    };
}

/**
 * The module flags an old private card's document gives up at the rewrite of 1.2.65's first
 * load (E06 C12, migrate.mjs `neutraliseOldCards`): what `splitFlags` sends with the words of
 * a card posted today, but `settled` on a card that is not veiled - a ruling settled before
 * 1.2.65 has no meta in anybody's store, and without the flag its buttons would come back.
 * The rest goes with nothing kept: the words of a card that old are in its readers' stores
 * already and cannot be given meta from here. Pure; `[]` for a card that is not private.
 *
 * AND `callCard` ON A RULING NOBODY HAS SETTLED (E06 fix r2-G1, 28.09.2026; review round 2's
 * mn3 = m3). A card with no thread to live in - a trap's alert, a Direct Murder declared in
 * the dark (gm-bridge.mjs `callGm`) - is wired in a GM's chat log only while `cardFlag` finds
 * `callCard`, and no store holds meta for a card that old: a ruling still waiting at the
 * upgrade showed its buttons dead on every GM. The flag says that the GMs were asked, which
 * the card's list of GMs says already. `veil`: the card is being veiled as well (`veilOldCard`),
 * and gives up everything its meta would carry.
 */
export function flagsOffOldCard(message, { veil = false } = {}) {
    const own = message?.flags?.[MODULE_ID];
    if (!own?.[SECRET_FLAG]) return [];
    const veiled = veil || own[VEILED_FLAG] === true;
    const kept = veiled ? [] : ["settled", ...(own.settled ? [] : ["callCard"])];
    return Object.keys(splitFlags(message.flags, veiled).meta ?? {}).filter(key => !kept.includes(key));
}

/**
 * An old private card rewritten as a veiled one (E06 fix r2-G1, 28.09.2026; review round 2's
 * MJ1): `{ changes, meta }` - what its document is given, as `postSecret` writes a veiled card
 * (the whole table as its list, the neutral speaker, the flag), and what its words would carry
 * if it were posted today, placement included. The flags `meta` names come off with
 * `flagsOffOldCard(message, { veil: true })`. Null for a card that is not private or is veiled
 * already. Pure but for the table and the speaker's word.
 */
export function veilOldCard(message) {
    const own = message?.flags?.[MODULE_ID];
    if (!own?.[SECRET_FLAG] || own[VEILED_FLAG]) return null;
    return {
        changes: {
            whisper: everyone(),
            speaker: { alias: game.i18n.localize("DRPG.Secret.speaker"), actor: null, token: null, scene: null },
            [`flags.${MODULE_ID}.${VEILED_FLAG}`]: true
        },
        meta: splitFlags(message.flags, true).meta
    };
}

/** How much a player's packet weighs: its words and its meta, against `MAX_PLAYER_BYTES`. */
const packetBytes = (html, meta) => new Blob([String(html ?? ""), meta ? JSON.stringify(meta) : ""]).size;

/*
 * THE GMS' PROSE STAYS THEIRS (E06 C7b, 27.09.2026; audit L17, S11-05). A ruling card
 * (gm-bridge.mjs `callGm`) lives in the player's thread and carries the GMs' half of it -
 * the reference table, the critical's reminder (`.drpg-gm-only`) and the ruling's buttons
 * (`.drpg-call-actions`). The messenger took both off its bubbles on a player's screen, but
 * the words went to the player whole: into their browser's store, and into their Chat tab
 * through the swap below, which drew them as they came. A player is sent the words
 * without the two blocks now; a GM gets them as written.
 *
 * Parsed only when the words hold one of the two class names, so every other card reaches
 * a player byte for byte as before; the module writes the two blocks in `callGm` alone.
 * A `<template>`, as `settleCall` parses: its content is
 * inert, so an image in the words loads nothing here.
 */
const GM_PROSE = ".drpg-gm-only, .drpg-call-actions";

/** A card's words as a player may hold them: without the GMs' prose and the ruling's buttons. */
function playerWords(html) {
    const text = String(html ?? "");
    if (!/drpg-(?:gm-only|call-actions)/.test(text)) return text;
    const wrap = document.createElement("template");
    wrap.innerHTML = text;
    wrap.content.querySelectorAll(GM_PROSE).forEach(el => el.remove());
    return wrap.innerHTML;
}

/**
 * A card's packet to the other readers: a GM gets the words as written, a player
 * `playerWords` of them - one packet to all of them when the two are the same.
 */
function sendWords(readers, packet) {
    const theirs = playerWords(packet.html);
    if (theirs === String(packet.html ?? "")) {
        game.socket.emit(SOCKET_EVENT, packet, { recipients: readers });
        return;
    }
    const gms = readers.filter(id => game.users.get(id)?.isGM);
    const players = readers.filter(id => !gms.includes(id));
    if (gms.length) game.socket.emit(SOCKET_EVENT, packet, { recipients: gms });
    if (players.length) game.socket.emit(SOCKET_EVENT, { ...packet, html: theirs }, { recipients: players });
}

/**
 * Pinned cards are a messenger's threads and are never aged out with the
 * ordinary ones - but "never" was also "without limit", and a thread of years
 * fills the browser's storage, after which every write failed silently and the
 * answer keys in the same storage stopped saving (S11-28). The newest this many
 * stay.
 */
const KEEP_PINNED = 2000;

/** HTML a browser will not run, from HTML somebody else wrote. */
function sanitize(html) {
    const text = String(html ?? "");
    try {
        if (typeof foundry.utils.cleanHTML === "function") return foundry.utils.cleanHTML(text);
    } catch (err) {
        debug("cleanHTML refused a private card's words; showing them as text", err);
    }
    // No cleaner here, or it threw: the words as text, which cannot run anything.
    return foundry.utils.escapeHTML(text);
}

/** Cleaned readings of untrusted entries, by id, for this session. */
const cleaned = new Map();

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

/** Said once per session: a store that cannot be written is losing every card after this one. */
let toldFull = false;

async function write(next) {
    cache = next;
    try {
        await game.settings.set(MODULE_ID, SETTINGS.secretCards, next);
    } catch (err) {
        error("Could not keep a private card", err);
        cache = null;
        /* OUT LOUD FOR A GM (S11-28). The usual cause is a full localStorage, and
           the answer keys live in the same storage - so from here on the Truth
           Bullet and Remnant ledgers stop saving too. A line in the console was
           the only sign. */
        if (game.user?.isGM && !toldFull) {
            toldFull = true;
            ui.notifications?.error(game.i18n.localize("DRPG.Secret.storeFull"), { permanent: true });
        }
    }
}

/** Drop the parsed copy - something else wrote the store. */
export function forgetSecrets() {
    cache = null;
    cleaned.clear();
}

/**
 * The words belonging to a card, if this browser is holding them - for this
 * user only (S11-29): one browser, two logins, and the second used to read the
 * first one's veiled cards. An entry from before the owner was recorded has no
 * owner and is shown as before.
 */
export function secretHtml(message) {
    if (!message?.id) return null;
    if (!message.flags?.[MODULE_ID]?.[SECRET_FLAG]) return null;
    const entry = read()[message.id];
    if (!entry || typeof entry.html !== "string") return null;
    if (entry.user && entry.user !== game.user?.id) return null;
    if (entry.trusted) return entry.html;
    if (!cleaned.has(message.id)) cleaned.set(message.id, sanitize(entry.html));
    return cleaned.get(message.id);
}

/**
 * One of a card's module flags, as this browser can know it: the document's, else the
 * meta that came with the words (E06 C7a) - for this user only, as the words are. A
 * reader that runs as the document arrives waits for the words first (`wordsOf`), or it
 * reads a private card's meta before it is here.
 */
export function cardFlag(message, key) {
    const own = typeof message?.getFlag === "function" ? message.getFlag(MODULE_ID, key) : message?.flags?.[MODULE_ID]?.[key];
    if (own !== undefined && own !== null) return own;
    if (!message?.id || !message.flags?.[MODULE_ID]?.[SECRET_FLAG]) return own;
    const entry = read()[message.id];
    if (!entry || (entry.user && entry.user !== game.user?.id)) return own;
    return entry.meta?.[key] ?? own;
}

/**
 * What a card SAYS on this client.
 *
 * Every reader of `message.content` in this module goes through here, because
 * a reader that does not is a reader that shows the stub - and the stub is a
 * dash. See the R15 criterion, which exists to keep that true.
 */
/**
 * Anyone waiting for a card's words to arrive, by message id - a list: a popup, a
 * sound and the Chat pip wait for the same card's words (E06 C6), and a single
 * waiter per card let the last one to ask push the others out, to be answered
 * only by the ceiling below.
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
            const rest = (waiting.get(message.id) ?? []).filter(wake => wake !== done);
            if (rest.length) waiting.set(message.id, rest);
            else waiting.delete(message.id);
            resolve(html ?? message.content ?? "");
        };
        const timer = setTimeout(() => {
            debug(`Secret cards: the words for ${message.id} never arrived; `
                + "drawing what the card itself says.");
            done(null);
        }, ms);
        waiting.set(message.id, [...(waiting.get(message.id) ?? []), done]);
    });
}

export function contentOf(message) {
    return secretHtml(message) ?? message?.content ?? "";
}

/**
 * @param {boolean} [trusted]  Written by a GM, as the GM wrote it. Anything else
 *   is cleaned before it is shown - see the note above `MAX_PLAYER_BYTES`.
 */
async function remember(id, html, at, pin = false, trusted = false, summary = undefined, meta = undefined) {
    const words = trusted ? html : sanitize(html);

    cleaned.delete(id);
    // New words for a card keep the facts it was posted with (`updateSecret` sends none).
    const facts = summary === undefined ? (read()[id]?.summary ?? null) : plainSummary(summary);
    // And its meta, with whatever the new packet adds to it - `settleCall`'s `settled`.
    const kept = plainMeta({ ...(read()[id]?.meta ?? {}), ...(plainMeta(meta) ?? {}) });
    const store = { ...read(), [id]: {
        html: words, at: at ?? Date.now(), user: game.user?.id ?? null,
        ...(facts ? { summary: facts } : {}),
        ...(kept ? { meta: kept } : {}),
        // Which world the card is in: the store is a CLIENT setting, one per
        // browser for every world it opens, and `pruneOrphans` must only ever
        // judge this world's cards against this world's chat log.
        world: game.world?.id ?? null,
        ...(pin ? { pin: true } : {}), ...(trusted ? { trusted: true } : {})
    } };

    // Oldest first, and only as many as we are over by. A store that emptied
    // itself on every overflow would lose a whole session's narration to one
    // busy evening. PINNED cards - the messenger's threads, the longest-lived
    // cards in the world - are not aged out with the rest: a thread that aged
    // out would show its oldest bubbles as dashes. They have a ceiling of their
    // own (`KEEP_PINNED`), far above any thread a table writes in a season.
    for (const [pinnedToo, cap] of [[false, KEEP], [true, KEEP_PINNED]]) {
        const ids = Object.keys(store).filter(key => Boolean(store[key].pin) === pinnedToo);
        if (ids.length <= cap) continue;
        ids.sort((a, b) => (store[a].at ?? 0) - (store[b].at ?? 0));
        for (const stale of ids.slice(0, ids.length - cap)) delete store[stale];
    }
    // `write` holds the new store before its first await, so anything holding a notice
    // open for these words - woken now - reads the card's meta with them (E06 C7a).
    const saving = write(store);
    for (const wake of waiting.get(id) ?? []) wake(words);
    await saving;

    // A thread's window draws its bubbles from this store: the one whose
    // words just landed is redrawn in place, the way a settled card is.
    const message = game.messages?.get(id);
    const thread = cardFlag(message, "thread");
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
 * WHILE AN INCIDENT RUNS, A PRIVATE CARD THAT WOULD NAME A CHARACTER OR A PLAYER IS VEILED,
 * WHOEVER POSTS IT (E06 fix r2-G2, 28.09.2026; review round 2's MJ2 and m6).
 *
 * murder.mjs and cleanup.mjs veil every card they post, and fix r1-G3 veiled three more at
 * their call sites (`incidentVeil`: a Loaded Die's notice, a tool worn or broken, a Hope
 * Call's receipt). The round-2 review measured the next one that was missed: "Use an item" in
 * a direct incident posted its "used" card from the killer's browser speaking as her, to the
 * GMs and her player, and the bystander's browser held it so (this fix's red run measured the
 * victim's the same way, 13-murder-signals). Read in the code, a card a use
 * posts speaks as its character to the GMs and its player (`whisperToOwner`) or lands in its
 * player's thread (`callGm`, `postToThread`), and nothing locks the rest of them in a fight:
 * a tier 0 item's ruling card and its receipt, the GM's ruling on it, a Call armed on a
 * participant (the bridge's notice to the beneficiary, `armCall`'s), an improvised weapon that
 * lands in a stash, a broken item thrown away, a hand-over, a message in the messenger. So the
 * rule is here, where every private card is posted, not at the call sites.
 *
 * And it is asked of what every browser holds - that an incident is running, the world
 * half's `active` (murder.mjs `PUBLIC_INCIDENT`) - never of the cast. `incidentVeil` veiled a
 * card only while the cast this browser holds named its character (review m6): the same card
 * went plain from a bystander, so a veiled one from a player's browser in a fight told every
 * console that player's character was in it. A bystander's cards are veiled now as a
 * participant's are, and the flag says only that an incident was running, which the table
 * knows. A card to the GMs alone that speaks as no character names nobody else and stays as
 * it is - a ruling card with no thread among them, which `settleCall` rewrites for every GM
 * (`readersOf`; a veiled one only on the browser that settles it). The author stays (Q2 (a)).
 * Pure but for the setting and the users it reads.
 */
function incidentVeils({ speaker = null, whisper = [] } = {}) {
    try {
        if (!getSetting(SETTINGS.murderState)?.active) return false;
    } catch {
        return false;
    }
    if (speaker?.actor || speaker?.token) return true;
    return (whisper ?? []).some(id => !game.users?.get(id)?.isGM);
}

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
 *                                     be a secret - an incident's. While an
 *                                     incident runs it is decided here as well
 *                                     (`incidentVeils`).
 * @param {object}   [data.summary]    The card's facts, for the day summary: kept
 *                                     with the words, never on the document.
 * @param {object}   [data.flags]      Split (`splitFlags`): the document keeps its
 *                                     own, the rest go with the words as `meta`.
 * @returns {Promise<ChatMessage|null>}
 */
export async function postSecret(data = {}) {
    const { veiled: asked = false, summary: rawSummary = null, ...rest } = data ?? {};
    const veiled = Boolean(asked) || incidentVeils(rest);
    const summary = plainSummary(rawSummary);
    const { flags, meta } = splitFlags(rest.flags, veiled);
    const recipients = [...new Set((rest.whisper ?? []).filter(Boolean))];
    if (!recipients.length) {
        error("Refused to post a private card with nobody to read it.");
        return null;
    }

    const html = rest.content ?? "";

    /* TOO LONG IS SAID HERE, TO THE WRITER (E02 review). The receiving side
       refuses a player's card past `MAX_PLAYER_BYTES`, and it used to be the
       only side that knew: the card was posted, the GM saw a dash, and the
       player was told nothing. A player's own browser checks first now and
       posts nothing. */
    if (!game.user.isGM && packetBytes(html, meta) > MAX_PLAYER_BYTES) {
        ui.notifications?.warn(game.i18n.format("DRPG.Secret.tooLong", { kb: MAX_PLAYER_BYTES / 1024 }));
        return null;
    }
    const message = await ChatMessage.create({
        ...rest,
        ...(veiled ? { speaker: { alias: game.i18n.localize("DRPG.Secret.speaker") } } : {}),
        content: STUB,
        whisper: veiled ? everyone() : recipients,
        flags
    });
    if (!message) return null;

    const at = message.timestamp ?? Date.now();
    const pin = pinned(rest.flags);

    // Ourselves first and without the socket: a GM posting a card they are a
    // recipient of should never be waiting on their own network round trip to
    // read what they just wrote.
    if (recipients.includes(game.user.id)) {
        await remember(message.id, game.user.isGM ? html : playerWords(html), at, pin, game.user.isGM, summary, meta);
        refresh(message);
    }

    const others = recipients.filter(id => id !== game.user.id);
    if (others.length) {
        try {
            sendWords(others,
                { action: ACTION_SECRET, id: message.id, html, at, pin, ...(summary ? { summary } : {}), ...(meta ? { meta } : {}) });
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
 * @param {string[]} [recipients]  Who holds the words. Defaults to `readersOf`.
 * @param {object} [meta]  Flags of the card's own to add to the meta its readers keep
 *   (`settleCall`'s `settled`) - never to the document, for the reason `postSecret` splits.
 */
export async function updateSecret(message, html, recipients = null, meta = undefined) {
    const more = plainMeta(meta) ?? undefined;
    if (!message?.id) return null;
    const readers = [...new Set((recipients ?? readersOf(message)).filter(Boolean))];
    const at = read()[message.id]?.at ?? message.timestamp ?? Date.now();
    // A veiled thread card's thread is in its meta, not its document (E06 C8): still pinned.
    const pin = Boolean(cardFlag(message, "thread"));
    if (readers.includes(game.user.id) || !readers.length) {
        await remember(message.id, game.user.isGM ? html : playerWords(html), at, pin, game.user.isGM, undefined, more);
        refresh(message);
    }
    const others = readers.filter(id => id !== game.user.id);
    if (others.length) {
        try {
            sendWords(others, { action: ACTION_SECRET, id: message.id, html, at, pin, ...(more ? { meta: more } : {}) });
        } catch (err) {
            error("Could not deliver a private card's new words", err);
        }
    }
    return message;
}

/*
 * WHO HOLDS A CARD'S WORDS WHEN THE CALLER DOES NOT SAY (E06 C8, 28.09.2026; audit L18,
 * S05-15). The whisper list, for every card that is not veiled. A veiled card's whisper
 * list is the whole table - that is what veiling is - so `settleCall`'s receipt on a
 * veiled thread card (the trap's receipt, Stage 6's reshape card) would go to every
 * browser: its readers are its thread's player and the GMs, read off the meta this
 * browser holds. A veiled card that is no thread's names nobody here, and its new
 * words stay on this browser.
 */
function readersOf(message) {
    if (!isVeiled(message)) return message.whisper ?? [];
    const thread = cardFlag(message, "thread");
    if (thread) return [thread, ...gmIds()];
    warn(`The new words of veiled card ${message.id} stay on this browser: nothing here says who else reads it.`);
    return [];
}

/** The document a socket packet named, once Foundry delivers it - or null after a while. Also `guardRollAuthor`'s wait (E06). */
export function messageArrives(id, ms = 4000) {
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
                /* A PLAYER'S WORDS: bounded, cleaned, and pinned only if the card
                   really is a thread's - read off the document, not the packet
                   (S11-28). `remember` cleans them, because `trusted` is false. */
                if (packetBytes(payload.html, payload.meta) > MAX_PLAYER_BYTES) {
                    // A warning, not a debug line (E02 review): the sender's own
                    // browser refuses this before posting (`postSecret`), so a
                    // packet this size came from somewhere else.
                    warn(`Refused private words for ${payload.id} from ${sender?.name ?? senderId}: over ${MAX_PLAYER_BYTES} bytes.`);
                    return;
                }
                // A player's facts about somebody else's character are not theirs to give.
                // A packet with none (`updateSecret`'s) keeps what the card already has.
                const facts = plainSummary(payload.summary);
                const given = payload.summary === undefined ? undefined
                    : (facts && (!facts.actorId || ownsActor(sender, facts.actorId)) ? facts : null);
                /* A player's meta without what only the module may ask of the GMs (E06 C7a),
                   and a pin only for the sender's own thread - the one a player writes in. */
                const meta = plainMeta(Object.fromEntries(Object.entries(plainMeta(payload.meta) ?? {})
                    .filter(([key]) => !GM_META.includes(key))));
                const pin = pinned(message.flags) || meta?.thread === senderId;
                await remember(payload.id, payload.html, payload.at, pin, false, given, meta ?? undefined);
                refresh(game.messages.get(payload.id));
                return;
            }
            await remember(payload.id, payload.html, payload.at, Boolean(payload.pin), true,
                payload.summary === undefined ? undefined : plainSummary(payload.summary), payload.meta);
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
            const body = element.querySelector(".message-content") ?? element;
            /* THE BELT (E06 C7b): a player's words arrive without the GMs' prose and the
               ruling's buttons (`playerWords`), but words kept from before 1.2.65, and a
               card whose document still carries them, would draw both in the Chat tab -
               so a player's client takes them off whatever it draws, as the messenger's
               bubbles do. Whether v14's log draws anything around them is LIVE-E06-08. */
            const trim = () => {
                if (!game.user.isGM) body.querySelectorAll(GM_PROSE).forEach(el => el.remove());
            };
            if (!html) {
                // A veiled card this client was not sent the words of is not
                // this client's card: hidden, not blanked, so the log shows
                // neither a dash nor a gap where somebody else's secret sits.
                if (isVeiled(message)) {
                    element.classList.add("drpg-veiled");
                    element.style.display = "none";
                }
                trim();
                return;
            }
            element.classList.remove("drpg-veiled");
            element.style.display = "";
            body.innerHTML = html;
            trim();
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

    quietVeiledPip();

    pruneOrphans().catch(err => debug("Could not tidy the private-card store", err));
}

/*
 * THE CHAT TAB'S PIP (E06 C6, 27.09.2026; audit S11-30, not seen at a table). A veiled
 * card is addressed to everybody, so the chat log is told of it on every client, and
 * a client that holds no words for it lit its Chat pip at the very moment something
 * secret happened - on every bystander's screen. The notifier of the chat log's class
 * is wrapped: a veiled card this client holds no words for notifies once its words
 * arrive (`wordsOf`, as sfx.mjs waits for them to play its sound) and never when none
 * come. Everything else reaches Foundry's notifier as it came.
 *
 * WHICH METHOD, NEITHER READ NOR SEEN. The chat log's `notify(message, ...)` is the
 * method the E06 plan names; no Foundry source is on the machine this was written on,
 * so which method lights the pip in v14, and whether a sound plays with it, is
 * LIVE-E06-04.
 * The class is `CONFIG.ui.chat` (the one `ui.chat` is made from, a system's subclass
 * included), else core's `ChatLog`. When it has no `notify`, nothing is installed and
 * `diagnosePatches` (patches.mjs) says so.
 *
 * A ROLL THE MODULE THREW, WHERE IT CANNOT BE READ (E06 fix r1-G2, 28.09.2026; review m2).
 * A whispered roll is visible to every client (Foundry's rule as the harness's shim reads
 * it), so the chat log is told of it everywhere - and on a bystander the notifier lit the
 * pip and played the roll's sound, Daggerheart's dice (dhRoll.mjs:150, 2.6.5), which Dice
 * So Nice takes over only where it animates the roll (main.js:573-576, 6.3.1). In a fight
 * the roll lands a moment before its veiled card, so the moment still showed. Measured in
 * 13 with the harness's chat log calling the notifier as a message is created: the
 * bystander's pip and sound, with and without Dice So Nice. Such a roll never notifies: its
 * card is the module's own, which notifies where it is read.
 */
const VEILED_NOTIFY = Symbol.for("drpgVeiledNotify");

/** The class the chat log is made from, or null. Read by `diagnosePatches` as well. */
export function chatLogClass() {
    return CONFIG.ui?.chat ?? foundry.applications?.sidebar?.tabs?.ChatLog ?? null;
}

/**
 * Does the chat log tell this client of this card now? Not while it is a veiled card this
 * client holds no words for, nor ever for a roll the module threw that this client cannot
 * read - the flag private-rolls.mjs's `isClaimedRoll` reads, read here because that file
 * imports this one.
 */
export function lightsChatPip(message) {
    if (message?.getFlag?.(MODULE_ID, "supersededRoll") && !message.isContentVisible) return false;
    return !isVeiled(message) || Boolean(secretHtml(message));
}

/** Wrap the chat log's notifier once; say so and install nothing where it is missing. */
function quietVeiledPip() {
    const proto = chatLogClass()?.prototype;
    const notify = proto?.notify;
    if (typeof notify !== "function") {
        warn("The chat log has no notify method here, so a veiled card may still light the Chat tab on every screen - see diagnosePatches().");
        return false;
    }
    if (notify[VEILED_NOTIFY]) return true;
    // Foundry's notifier is called through `wrapped`, which the suite swaps for a recorder.
    const drpgVeiledNotify = function (message, ...rest) {
        if (lightsChatPip(message)) return drpgVeiledNotify.wrapped.call(this, message, ...rest);
        if (!isVeiled(message)) return undefined;
        void wordsOf(message).then(html => {
            if (!isStub(html)) drpgVeiledNotify.wrapped.call(this, message, ...rest);
        }).catch(err => debug("Could not notify of a veiled card", err));
        return undefined;
    };
    drpgVeiledNotify.wrapped = notify;
    drpgVeiledNotify[VEILED_NOTIFY] = true;
    proto.notify = drpgVeiledNotify;
    return true;
}

/**
 * Words whose card is gone, taken out at load (S11-28).
 *
 * `forget` runs on `deleteChatMessage`, which reaches only the clients that are
 * connected when the log is cleared - a player who was offline kept every word
 * of a deleted session for good. At `ready` every message of the world is in
 * `game.messages`, so an id that is not there is a card that no longer exists.
 *
 * THIS WORLD'S CARDS ONLY (E02 review, 24.09.2026). The store is a client
 * setting, and a client setting is one entry in the browser's storage for every
 * world that browser opens. The first version of this took out everything not
 * in THIS world's chat log - so a GM who opened a test world lost every private
 * card of the campaign, messenger threads included, and those words exist
 * nowhere else. Each card now records its world. A card from before that has no
 * record: when it is in this world's log it is claimed for this world, and
 * otherwise it is left alone, because it may be another world's.
 *
 * Exported for the security scenario, which plants one of each and runs it.
 */
export async function pruneOrphans() {
    if (!game.messages) return;
    const here = game.world?.id ?? null;
    if (!here) return;
    const store = read();
    const gone = [];
    const claimed = [];
    for (const [id, entry] of Object.entries(store)) {
        if (entry?.world === here) {
            if (!game.messages.has(id)) gone.push(id);
        } else if (!entry?.world && game.messages.has(id)) {
            claimed.push(id);
        }
    }
    if (claimed.length) {
        const next = { ...read() };
        for (const id of claimed) next[id] = { ...next[id], world: here };
        await write(next);
    }
    if (gone.length) await forget(gone);
}

/**
 * The facts of this world's cards this browser holds for this user, posted at or
 * after `since` (ms), oldest first - what the time of day's summary reads
 * (day-summary.mjs). A card deleted takes its facts with it, as it takes its words.
 */
export function secretSummaries(since = 0) {
    const here = game.world?.id ?? null;
    const me = game.user?.id ?? null;
    const out = [];
    for (const entry of Object.values(read())) {
        if (!entry?.summary || entry.world !== here) continue;
        if (entry.user && entry.user !== me) continue;
        const at = entry.summary.at ?? entry.at ?? 0;
        if (since && at < since) continue;
        out.push({ ...entry.summary, at });
    }
    return out.sort((a, b) => a.at - b.at);
}

/**
 * THE OLD FACTS OUT OF WORLD DATA (E05 C7; audit S10-05, S02-11) - the
 * `dropCardSummaries` clause. Once, on the primary. Nothing is lifted: the facts
 * belong in the recipients' stores, which a GM's browser cannot fill for them, so a
 * time of day that spans the update loses its earlier lines from the summary. Every
 * message's `summary` flag is deleted (`forcedDeletion()`, `unsetFlag` in a Foundry
 * without it), twenty-five writes at a time, and read back; one still there throws,
 * so the world is not stamped and the next load tries again.
 *
 * @returns {Promise<null|{dropped: number}>}
 */
export async function dropCardSummaries() {
    if (!isPrimaryGm() || !game.messages) return null;
    const holding = () => game.messages.filter(m => Object.hasOwn(m.flags?.[MODULE_ID] ?? {}, "summary"));
    const found = holding();
    if (!found.length) return null;
    const deletion = forcedDeletion();
    for (let i = 0; i < found.length; i += 25) {
        await Promise.all(found.slice(i, i + 25).map(m => deletion
            ? m.update({ [`flags.${MODULE_ID}.summary`]: deletion })
            : m.unsetFlag(MODULE_ID, "summary")));
    }
    const left = holding().length;
    if (left) throw new Error(`${left} card(s) kept their facts in world data; the next load tries again`);
    log(`Took the facts off ${found.length} card(s) in world data.`);
    return { dropped: found.length };
}

/** For the diagnostics window, and for the suite. */
export function diagnoseSecrets() {
    const store = read();
    const ids = Object.keys(store);
    return {
        held: ids.length,
        cap: KEEP,
        pinnedCap: KEEP_PINNED,
        // What the store costs this browser's storage, the thing that runs out (S11-28).
        bytes: new Blob([JSON.stringify(store)]).size,
        oldest: ids.length ? new Date(Math.min(...ids.map(id => store[id].at ?? 0))).toISOString() : null,
        // The question this file exists to answer, asked of the live world.
        leaking: game.messages.filter(m =>
            m.flags?.[MODULE_ID]?.[SECRET_FLAG] && !isStub(m.content)).map(m => m.id)
    };
}
