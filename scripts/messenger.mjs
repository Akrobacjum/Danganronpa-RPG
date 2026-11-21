/**
 * Danganronpa RPG - the messenger.
 * ---------------------------------------------------------------------------
 * One shared conversation per player: the player and every current GM read
 * and write into the same thread. There is no per-(player, GM) copy - a GM
 * opening "chat with Alice" sees exactly what every other GM sees, because it
 * is the same conversation, not their own private copy of it. There is no
 * player-to-player channel; in-room talk is voice, not text - that lives in
 * its own subsystem, not here.
 *
 * A thread is not a document of its own - it is every ChatMessage whispered
 * to `[playerUserId, ...gmIds()]` and flagged with which player it belongs
 * to. Since COMM-03 each of those is a PRIVATE card (secret.mjs): the document
 * in the world carries a stub, and the words travel over the addressed socket
 * to the thread's readers alone. This file gives the thread persistence (read
 * with `threadMessages` instead of scrolling past it) and a window instead of
 * the sidebar.
 *
 * `callGm()` in call-gm.mjs posts into these same threads - an action that
 * needs a human ruling (Observe, Analyze, Think…) shows up right next to the
 * player's own typed messages, in the same conversation.
 *
 * WHAT A THREAD CARD STILL SAYS (E05, 26.09.2026; audit S11-02). The words are
 * private; the document is not. Every browser holds it, and an ordinary thread
 * card names the thread's player (`thread`, and its whisper list), its kind,
 * whether it asks the GM (`gmAsk`) and when. A card whose mere existence in one
 * player's thread is the secret is not put there that way. The Direct Murder
 * declared in the dark goes to the GMs in their own log (`callGm` with
 * `gmOnly`), and a refusal reaches the killer veiled (eclipse.mjs; an allowance is
 * told only at the lights, E08+E28 C19b). The trap's
 * receipt belongs in the killer's thread and a reshape card (Stage 6's, a
 * Tamper's) in its player's, and since E06 C8 (28.09.2026; audit L18, S05-15)
 * they are VEILED thread cards (`callGm` with `veiled`): the document is
 * addressed to the whole table and says nothing of whose thread it is, and the
 * three placement flags travel with the words
 * (secret.mjs `splitFlags`). What that costs: a veiled thread card is placed
 * only by a browser that holds its words - a GM who was not connected when it
 * was posted does not see it in the thread at all, where an ordinary card shows
 * them a stub (see WHAT A LATER GM CANNOT SEE, below). 72's trap phase is where
 * E06 C1 measured the receipt (p1's and p2's browsers held it with Chie's player
 * as its thread); that known leak is gone from known-leaks.json, so a receipt
 * that names her thread again fails the run.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { gmIds, error, warn } from "./utils.mjs";
import { playSfx } from "./sfx.mjs";
import { postSecret, cardFlag, cardWriter, isVeiled, secretHtml, wordsOf } from "./secret.mjs";
import { count } from "./perf-counters.mjs";

/**
 * Whether this browser hears the messenger at all.
 *
 * A per-client mute for the three messenger sounds and nothing else: the world's
 * mapping and everyone else's ears are untouched, which is the whole point - one
 * player at a shared table wanting quiet is not a decision about the sound design.
 */
function messengerSoundOn() {
    try { return game.settings.get(MODULE_ID, SETTINGS.messengerSound) !== false; } catch { return true; }
}

/** Flag keys, all stored under `flags["danganronpa-rpg"]` on a ChatMessage. */
export const MESSENGER_FLAGS = {
    /** Which player's thread this message belongs to - a User id. */
    thread: "thread",
    /** "dm" (typed in the messenger window) | "action" (a callGm() ruling card). */
    kind: "kind",
    /** This card ASKS the GM for something and waits on the answer.
     *  Carried as its own flag rather than derived from the author, because
     *  several asks are posted BY a GM client on a player's behalf - the
     *  bridge writes a parked murder's card from the GM's own session - and
     *  an author check reads those as the GM talking to themselves. */
    gmAsk: "gmAsk",
    /** This card HAS been answered - see `settleCall` in call-gm.mjs. The
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
    Hooks.on("deleteChatMessage", onDeleteChatMessage);
    Hooks.on("drpgMessengerRead", dropThreadStats);
}

/* ==========================================================================
 * WHO HAS A THREAD
 * ========================================================================== */

/** Every user a thread can exist for - one per non-GM user. */
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
        // A veiled thread card keeps its thread in the meta its words brought (E06 C7a).
        .filter(m => cardFlag(m, MESSENGER_FLAGS.thread) === playerUserId)
        .sort((a, b) => a.timestamp - b.timestamp);
}

/*
 * ONE COUNT OF EVERY THREAD (E50 C2, 30.10.2026; audit S11-45, S11-57, E50-10 to E50-12).
 *
 * The badge summed `unreadCount` over the thread users, and each was a `threadMessages` walk of every message with a
 * sort and a read of the read map; each roster row added `lastMessage` and `unreadCount`, two walks more. R1065
 * counted a GM's launcher and a roster of 11 threads at C2's parent: 33 walks of `game.messages` and 22 reads of the
 * read map, on every message that arrived. `threadStatsOf` is the one pass, and pure: it reads the messages it is
 * handed and the three things it is told, nothing of `game` but what `cardFlag` and `cardWriter` read off a card.
 *
 * WHAT COUNTS AS UNREAD. A message after the thread's read stamp that somebody else wrote - as before - or, on a GM,
 * one of the GM's own cards that asks a GM (`gmAsk`) and is not settled. `callGm` posts its asks from the primary GM's
 * own session when the bridge runs it there (a parked murder, a trap, an ask held for a player), so the one browser
 * that has to answer such a card had it read the moment it was posted (S11-45). Settled, it asks nobody, and a
 * receipt (`gmAsk` false) never did. A player's own ask is the player's and does not count for them.
 */
/*
 * TWO CLOCKS IN ONE THREAD (1.2.122, the rest of the audit's COMM-15). A message's `timestamp` is its writer's, as far
 * as the module has read (whether v14 stamps it on the server is COMM-LC7, not read), and the read stamp is the newest
 * message's own. So a message from a sender whose clock runs behind that newest one's writer was stamped under the read
 * stamp and arrived read. The stamp now also keeps the ids it read within `READ_SKEW_MS` under itself (`readEntryOf`):
 * a message under the stamp but inside that window that it did not read counts as unread. A skew wider than the window
 * still arrives read; ten minutes is a bound chosen, not a skew measured at a table. A stamp written before 1.2.122 is a
 * number and reads as it did.
 */
export const READ_SKEW_MS = 10 * 60 * 1000;

const stampAt = entry => (typeof entry === "number" ? entry : Number(entry?.at) || 0);

function unreadUnder(message, at, entry) {
    const stamp = stampAt(entry);
    if (at > stamp) return true;
    const ids = Array.isArray(entry?.ids) ? entry.ids : null;
    return Boolean(ids) && at > stamp - READ_SKEW_MS && !ids.includes(message.id);
}

/**
 * The read stamp for one thread over `messages`: `{ at, ids }`, `at` the newest message's own stamp and `ids` the
 * messages within `READ_SKEW_MS` under it; null when `previous` already holds all of that (nothing to mark).
 */
export function readEntryOf(messages, thread, previous = null) {
    const mine = [...(messages ?? [])].filter(m => cardFlag(m, MESSENGER_FLAGS.thread) === thread);
    const at = mine.reduce((max, m) => Math.max(max, m.timestamp ?? 0), 0);
    const ids = mine.filter(m => (m.timestamp ?? 0) > at - READ_SKEW_MS).map(m => m.id);
    const was = stampAt(previous);
    const known = Array.isArray(previous?.ids) ? previous.ids : [];
    if (was >= at && (was > at || ids.every(id => known.includes(id)))) return null;
    return { at, ids };
}

export function threadStatsOf(messages, { me = null, readMap = {}, isGM = false } = {}) {
    const stats = new Map();
    for (const message of messages ?? []) {
        // A veiled thread card keeps its thread in the meta its words brought (E06 C7a), which `cardFlag` reads.
        const thread = cardFlag(message, MESSENGER_FLAGS.thread);
        if (!thread) continue;
        let row = stats.get(thread);
        if (!row) stats.set(thread, row = { count: 0, unread: 0, last: null });
        row.count++;
        const at = message.timestamp ?? 0;
        // The newest; of two at one stamp the later in the collection, as the stable sort `threadMessages` makes has it.
        if (!row.last || at >= (row.last.timestamp ?? 0)) row.last = message;
        if (!unreadUnder(message, at, readMap?.[thread])) continue;
        const own = cardWriter(message)?.id === me;
        if (!own || (isGM && cardFlag(message, MESSENGER_FLAGS.gmAsk) && !cardFlag(message, MESSENGER_FLAGS.settled))) row.unread++;
    }
    return stats;
}

/*
 * THE COUNT, ONCE A RENDER. `threadStats()` is `threadStatsOf` over `game.messages` with this browser's read map,
 * kept until the task that asked for it ends (a microtask drops it) and dropped at once on a message created, changed
 * or deleted and on `drpgMessengerRead` (a read stamp written on this browser: `markThreadRead` is its one caller). A
 * launcher drawn and a roster built in one go share one pass; anything later counts again, so a card whose words (and
 * with them a veiled card's thread or its `settled`) land after its document is read as it stands then, without a hook
 * of its own. Counted: `messenger.threadStats` a pass, `messenger.readMap` a read of the map (perf-counters.mjs).
 */
let statsMemo = null;
function dropThreadStats() {
    statsMemo = null;
}
export function threadStats() {
    if (statsMemo) return statsMemo;
    count("messenger.threadStats");
    const made = threadStatsOf(game.messages ?? [], { me: game.user?.id ?? null, readMap: readMap(), isGM: Boolean(game.user?.isGM) });
    statsMemo = made;
    queueMicrotask(() => { if (statsMemo === made) statsMemo = null; });
    return made;
}

/* ---- read state, per client ------------------------------------------------
 * The player and each individual GM has their own idea of what they have
 * read. A world-scoped setting would make one GM's read state clear
 * everyone else's badge, so this is deliberately client-scoped.
 * -------------------------------------------------------------------------- */

/*
 * ONE SECTION PER WORLD AND LOGIN (1.2.122; the audit of 1.2.118, COMM-23). A client setting is one item for the whole
 * browser, every world and every login on it (notice-history.mjs keys its own value by world and user for that reason),
 * and the read map was `{ <thread's player id>: stamp }` with no reader in it: a GM who read Aiko's thread on a browser
 * marked it read for Aiko's own login there, and back. It is `{ "<world>.<user>": { <thread>: stamp } }` now
 * (`readSection`); a map from before 1.2.122 - its values plain numbers - is read as this login's until it writes its
 * own section, so nothing read turns unread at the update. That a client setting is one item per browser on v14 is the
 * notice history's reading too, not read at a table here.
 */
const readSection = () => `${game.world?.id ?? "world"}.${game.user?.id ?? "user"}`;

function allReadMaps() {
    try {
        const all = game.settings.get(MODULE_ID, SETTINGS.messengerLastRead);
        return all && typeof all === "object" && !Array.isArray(all) ? all : {};
    } catch {
        // Not registered yet (settings run before this does, but stay quiet
        // rather than throwing if module load order ever changes).
        return {};
    }
}

/**
 * This world's and this login's read map, `{ <thread's player id>: entry }`, an entry `{ at, ids }` (`readEntryOf`) or,
 * written before 1.2.122, a stamp. Exported for R8112.
 */
export function readMap(all = allReadMaps(), section = readSection()) {
    count("messenger.readMap");
    const mine = all[section];
    if (mine && typeof mine === "object" && !Array.isArray(mine)) return mine;
    return Object.fromEntries(Object.entries(all).filter(([, at]) => typeof at === "number"));
}

export async function markThreadRead(playerUserId) {
    // Only when there is something to mark (audit D6). The window calls this
    // on every render and every new bubble; a thread already read up to its
    // newest message has nothing to record, and the write plus the hook it
    // fires repainted the launcher for nothing each time.
    // The newest message's own stamp, not this browser's clock (COMM-15): a
    // sender whose clock runs ahead would otherwise leave a bubble unread
    // while it is on screen; and the ids read under it, for one running
    // behind (`readEntryOf`, 1.2.122). Written in this world's and this
    // login's section (`readSection`, COMM-23).
    const all = allReadMaps(), section = readSection();
    const mine = readMap(all, section);
    const entry = readEntryOf(game.messages ?? [], playerUserId, mine[playerUserId]);
    if (!entry) return;
    const map = { ...all, [section]: { ...mine, [playerUserId]: entry } };
    await game.settings.set(MODULE_ID, SETTINGS.messengerLastRead, map);
    Hooks.callAll("drpgMessengerRead", playerUserId);
}

/**
 * Unread messages in one thread, for the CURRENT client: never your own, but a GM's own ask that is not settled
 * (`threadStatsOf`).
 */
export function unreadCount(playerUserId) {
    return threadStats().get(playerUserId)?.unread ?? 0;
}

/** Total unread across every thread this client can see: a GM's every player's, a player's own. */
export function totalUnread() {
    const stats = threadStats();
    const mine = game.user.isGM ? threadUsers().map(u => u.id) : [game.user.id];
    return mine.reduce((sum, id) => sum + (stats.get(id)?.unread ?? 0), 0);
}

/* ==========================================================================
 * SENDING
 * ========================================================================== */

/**
 * Send free text into a player's thread. Called from the messenger window -
 * either the player themself, or any GM, may call this. The whisper target
 * is always the full roster, so there is only ever one copy of the message.
 * `outcome`: filled on the way to a null, as `postSecret` fills it (secret.mjs;
 * E50 fix FG2), for the window to say what is known of a send that failed.
 * `traitPass`: the definition a player's pass after a GM's "Change to" is for
 * (trait-ruling.mjs `rollChanged`; E68 review R3), carried in the line's meta,
 * where roll-draw.mjs `gmPickOf` reads it.
 */
export async function sendMessage(playerUserId, text, { kind = THREAD_KIND.dm, outcome = null, traitPass = null } = {}) {
    const body = String(text ?? "").trim();
    if (!body) return null;
    if (!isThreadUser(playerUserId)) {
        warn(`Messenger: ${playerUserId} is not a player - refusing to send.`);
        return null;
    }

    const esc = foundry.utils.escapeHTML(body).replace(/\n/g, "<br>");
    return createThreadMessage(playerUserId, `<p>${esc}</p>`, kind, false, false, null, outcome, traitPass);
}

/*
 * WHAT A LATER GM CANNOT SEE. A private card's words are held by the browsers
 * that were connected when it was posted, so a GM who joins tomorrow reads a
 * thread of stubs. That is the trade secret.mjs makes for every private card
 * and it is the right one here too: a second GM re-reading last week's
 * conversation is a convenience; a player reading it is the game. The roster
 * preview tolerates a stub, and the thread's newest cards are the ones that
 * matter.
 */

/**
 * Post pre-built HTML - the callGm() ruling cards - into a player's thread.
 * The caller is responsible for escaping anything it interpolated. `veiled`: a
 * card whose place in this thread is itself the secret (see the header). `rid`:
 * the mark of the ask the card was posted for - its id and asker, its kind and
 * what it was asked for (call-gm.mjs `callGm`, E18 C2; `askMark`, fix
 * early-C2-G2) - in the meta its words travel with, never on the document.
 */
export async function postToThread(playerUserId, html, { kind = THREAD_KIND.action, gmAsk = false, veiled = false, rid = null } = {}) {
    if (!isThreadUser(playerUserId)) return null;
    return createThreadMessage(playerUserId, html, kind, gmAsk, veiled, rid);
}

async function createThreadMessage(playerUserId, content, kind, gmAsk = false, veiled = false, rid = null, outcome = null, traitPass = null) {
    const whisper = Array.from(new Set([playerUserId, ...gmIds()]));

    // The SENDER's sound, and it is deliberately not carried on the message:
    // the message already plays `chatReceive` for everyone it reaches, and the
    // sender is one of those people. Played here instead, on the one client
    // that is doing the sending.
    if (messengerSoundOn()) playSfx("chatSend");

    /*
     * A PRIVATE CARD, LIKE EVERY OTHER PRIVATE CARD (COMM-03).
     *
     * This was the one poster in the module that wrote its words into the
     * document: `ChatMessage.create` with a whisper list, which Foundry
     * delivers to every connected client and merely hides. So every player
     * could read every other player's thread from the console - the parked
     * murder's note, the project proposals, the GM's typed rulings, the DMs.
     * The words go over the addressed socket now and live in the readers'
     * own browsers; the document keeps the thread flag, the kind and the
     * timestamp, which is all the roster and the badge ever read - or, veiled
     * (E06 C8), the timestamp alone, and the words carry the rest.
     */
    try {
        return await postSecret({
            content,
            whisper,
            veiled,
            flags: {
                [MODULE_ID]: {
                    [MESSENGER_FLAGS.thread]: playerUserId,
                    [MESSENGER_FLAGS.kind]: kind,
                    ...(gmAsk ? { [MESSENGER_FLAGS.gmAsk]: true } : {}),
                    ...(rid ? { rid } : {}),
                    ...(traitPass ? { traitPass } : {})
                }
            }
        }, { outcome });
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
 * `drpgMessengerRead` lets this browser's launcher badge and an open roster
 * refresh the moment a window here reads its thread (`Hooks.callAll` is this
 * browser's alone, and the read map a client setting, so no other client hears
 * it; the roster follows it since 1.2.122, messenger-app.mjs `refreshRoster`).
 * `drpgMessengerEdited` carries a message that CHANGED - a ruling card being
 * closed out, today - so an open window can redraw that one bubble instead of
 * re-rendering itself and throwing away whatever is half-typed in the box.
 * ========================================================================== */

async function onCreateChatMessage(message) {
    dropThreadStats();
    let thread = cardFlag(message, MESSENGER_FLAGS.thread);
    /* A veiled thread card's placement arrives with its words (E06 C8), which may
       land after the document - on its poster's browser too, whose own copy
       `postSecret` keeps only once `ChatMessage.create` has answered. A browser the
       words never reach gives up at `wordsOf`'s ceiling and places nothing. */
    if (!thread && isVeiled(message) && !secretHtml(message)) {
        await wordsOf(message);
        dropThreadStats();
        thread = cardFlag(message, MESSENGER_FLAGS.thread);
    }
    if (!thread) return;

    // Relevant to this client only if it is their own thread, or they are a
    // GM - every GM sees every thread.
    if (!game.user.isGM && game.user.id !== thread) return;

    Hooks.callAll("drpgMessengerMessage", thread, message);

    /*
     * A REQUEST FOR A GM GETS ITS OWN SOUND, AND ONLY ONE.
     *
     * Every GM sees every thread, so without this a ruling request and a
     * player's chatter arrive identically - and the request is the one that is
     * waiting on somebody. The more specific sound REPLACES the general one
     * rather than joining it: two sounds for one message is how a table learns
     * to stop hearing either.
     *
     * BEFORE the self-author check: the bridge posts its cards from the primary
     * GM's own session (a parked murder, a trap that has armed), so that GM was
     * the author of the one card they most needed to hear. A typed DM carries
     * no `gmAsk` flag and still does not ping its own writer.
     */
    if (game.user.isGM && cardFlag(message, MESSENGER_FLAGS.gmAsk)) {
        if (messengerSoundOn()) playSfx("gmAsk");
        return;
    }

    // Its writer: in an incident a GM posts a player's message for them (secret.mjs `cardWriter`, E08+E28 fix r2-H5).
    const authorId = cardWriter(message)?.id;
    if (authorId === game.user.id) return; // do not ping yourself

    // Was a hard-coded chime. It is a mapped event now, and NOT a mapped event
    // by default: this module ships no audio and assigns none, so a world that
    // has not been through the Sound panel hears nothing here. That is the
    // bargain the playlists already make. (Season setup's row that said so was
    // taken out on purpose, season-setup.mjs; the Sound window's Effects tab and
    // the handbooks say it now.) `playSfx` swallows its own failures.
    if (messengerSoundOn()) playSfx("chatReceive");
}

/**
 * A message in a thread changed. No sound and no badge: nothing new arrived,
 * something already read said something different.
 */
function onUpdateChatMessage(message) {
    dropThreadStats();
    const thread = cardFlag(message, MESSENGER_FLAGS.thread);
    if (!thread) return;
    if (!game.user.isGM && game.user.id !== thread) return;
    Hooks.callAll("drpgMessengerEdited", thread, message);
}

/**
 * A message of a thread was deleted (E50 C1; audit S11-35, E50-04): `drpgMessengerDeleted` takes it out of the open
 * windows. A veiled card whose words never reached this browser names no thread here and was never placed in one; it
 * is raised with a null thread, and the windows look for it by its id.
 */
function onDeleteChatMessage(message) {
    dropThreadStats();
    const thread = cardFlag(message, MESSENGER_FLAGS.thread) ?? null;
    if (!thread && !isVeiled(message)) return;
    if (thread && !game.user.isGM && game.user.id !== thread) return;
    Hooks.callAll("drpgMessengerDeleted", message, thread);
}
