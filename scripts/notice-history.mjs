/**
 * Danganronpa RPG - the notice history: what this browser showed this user, kept within its budgets to the season's reset.
 * ---------------------------------------------------------------------------
 * WHY (E81, A7; audit S16-08). A card closed was a card gone: a player who clicked a
 * whisper away, or reloaded, could not read again what the module had told them. The
 * owner's answers (07.10 and 11.10.2026): the GM has the same history (Q0), it lasts to
 * the season's reset (Q1), and on a browser several accounts share every account's
 * history stays in the one value until that reset (Q9, "Bierzemy alternatywę"). What bounds
 * that keeping - the budgets, a withdraw, the give-way, a login kept in memory beside a value
 * this world's other accounts fill, a reset that clears none of `EPOCH_GROUPS` - is below, and
 * the window and the GM's handbook (sections 16, 18 and 19) say it (E81 fix r2-H4, 13.10.2026).
 *
 * WHAT IT IS. One client setting, `SETTINGS.noticeHistory`, whose value is
 *
 *     { v: 1, sections: { "<world id>.<user id>": Section } }
 *
 * keyed by world and user as `readableKey` keys the readable rolls (private-rolls.mjs),
 * and a section is `{ epoch, touched, clearedAt, gone: { id: at }, entries: [] }`. It is
 * written only by this client, from what this client drew: no packet, no socket, no
 * document. A registered setting rather than a raw localStorage key, so the suite's world
 * dump reads it (R159); the runner holds it for the length of tier 2 (R473).
 *
 * THE STORE (E81 C1), THE CLEANING (C2) AND THE RECORDER (C3). Every card `showPopup` draws
 * is recorded here as it is drawn (popup.mjs, `record` and its siblings), its snapshot kept
 * up while the card is on screen and its state moved when it is closed (`updateNotice`); the
 * direct calls and `sayNotDone` are C4, giving way to the other stores C6. The window that
 * reads it back is notice-history-app.mjs (C7), opened by the keybinding registered here and
 * by `game.drpg.openNotices()`.
 * What is here:
 * - the entry's shape and its budgets (a JSON length, never a byte count: the engine
 *   cannot read what a browser's quota counts);
 * - the epoch: a section written before the season's last reset is cleared when it is
 *   next read, every account's section of this world alike (Q9: the one road by which an
 *   absent account's history goes);
 * - the merge with another tab's write, with tombstones and an upsert by message and
 *   source, and the debounced write that flushes at once when the page hides;
 * - the suite's hold, under which nothing reaches the setting (`holdNoticeHistory`), and an
 *   entry recorded with `persist: "session"`, which this page keeps and never writes;
 * - the cleaning: what a card showed is kept as `inertCopy(cleanCardHtml(html))`, and drawn
 *   again only through `noticeSnapshot`, which cleans the stored string a second time;
 * - what happens to a card after it was shown (E81 C5): a card the module takes back is gone from
 *   the history as from the screen, any other deletion leaves the entry marked `deleted`, and a
 *   Reroll or a GM's ruling marks it `rerolled` or `settled` - a mark, never a new snapshot;
 * - giving way (E81 C6): when another of the module's stores finds this browser's storage full
 *   (`keepRoom`), the history gives its room back before that store tries again.
 *
 * WHAT ANOTHER LOGIN CAN READ. Every account's section is in one value of this browser's
 * storage, so anybody at this browser's console reads every section in it, a GM's and a
 * killer's included. The owner accepted that on 11.10.2026 (Q9); the GM's handbook says so
 * in its section 19 (E81 C15; R478 fails when it stops). The window (E81 C7) draws only
 * this login's section: `noticeEntries` is the engine's `mine`, and nothing here hands out
 * another key's entries.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS, getClock, moduleLanguage } from "./settings.mjs";
import { debug, warn, error, forgeAsset } from "./utils.mjs";
import { cleanCardHtml, cardMeta } from "./secret.mjs";
import { MESSENGER_FLAGS } from "./messenger.mjs";

const FORMAT = 1;

/** A document id as Foundry makes them (`randomID()`): the shape an entry's `id`, `messageId` and `author` must have. */
const ID = /^[A-Za-z0-9]{16}$/;
/*
 * A card's kind and tone: popup.mjs's `KINDS` and `TONES`, the closed lists a card is drawn with, and an entry
 * read back with anything else is refused (E81 C2; a value a console wrote raw is a source like any other). Written
 * twice rather than imported, because popup.mjs is to import this file for its recorder (E81 C3) and an import
 * cycle is what R161 fails; R294 holds the two copies equal.
 */
export const NOTICE_KINDS = Object.freeze(["info", "error", "evidence", "objection"]);
export const NOTICE_TONES = Object.freeze(["hope", "fear", "critical"]);

/**
 * Where an entry came from (the A7 design, P1-1). `author` is the other user an entry came from, on any source
 * since E81 fix r1-G1: what the per-author bound counts (`trimSection`).
 */
export const NOTICE_SOURCES = Object.freeze(["mine", "public", "player", "messenger", "evidence", "summary", "safeword", "notDone"]);
const STATES = ["open", "read", "unread"];
const MARKS = [null, "rerolled", "settled", "deleted"];
/* How far a notice has come: two tabs' copies of one entry, or of one card, keep the further (E81 fix r1-G5). */
const RANK = Object.freeze({ open: 0, unread: 1, read: 2 });

/**
 * The reset groups whose cut moves the epoch (the A7 design, 1c): a reset that clears the clock, the
 * incident, the cards or the rest of the chat log ends what the history is a history of; one that clears
 * only, say, the remnants does not. R297 holds each to a key of `RESET_GROUPS` (season-exceptions.mjs).
 */
export const EPOCH_GROUPS = Object.freeze(["clock", "incident", "cards", "chatRest"]);

/**
 * The texts an entry or the store's state carries; the window (E81 C7) draws them. `source` names where an entry
 * came from, for the three sources whose entry says it nowhere else (E81 C4; the A7 design's P12-3): a request
 * not carried out (its entry's title too, `sayNotDone`), a day summary and a player's card. A safeword entry
 * says it in its title (`DRPG.Safeword.banner`). `mark` names what became of an entry's chat card after it was
 * shown (E81 C5): deleted, rerolled or settled.
 */
export const NOTICE_TEXTS = Object.freeze({
    notSaved: "DRPG.Notices.notSaved", clipped: "DRPG.Notices.clipped",
    mark: Object.freeze({ deleted: "DRPG.Notices.mark.deleted", rerolled: "DRPG.Notices.mark.rerolled", settled: "DRPG.Notices.mark.settled" }),
    source: Object.freeze({ notDone: "DRPG.Notices.source.notDone", summary: "DRPG.Notices.source.summary", player: "DRPG.Notices.source.player" })
});

/*
 * THE BUDGETS (the A7 design, 1a), in characters of JSON. An entry is at most 10 000 with
 * at most 8 000 of html, a day summary 26 000 with 24 000 (a GM's summary table reaches
 * 26 000 characters, the design's reading); an entry over its limit keeps its title and
 * text and drops the html (`clipped`). A player's section keeps 250 entries and 200 000
 * characters, a GM's 150 and 100 000; the whole value 500 000. A section holds at most 4
 * full day summaries (E37 gives one at every boundary of a time of day), and at most 40
 * entries and a quarter of the section's characters from each other user (`authorShare`, E81
 * fix r1-G1). None of these is a measurement of a browser's quota:
 * localStorage is shared with the private cards and the GM stores, and the history gives way
 * to them when it runs out (`keepRoom`, below): from then on, for the rest of the session, the
 * section's entries and characters (and so each other user's quarter of them), each other user's
 * 40 entries and the whole value's 500 000 are halved; an entry's own limits and the 4 full day
 * summaries are not (E81 fix r1-G2; this comment had said every budget but the entry's own, review
 * round 1's O15). The whole value's budget cuts other worlds' sections and this login's own
 * entries, never another account's section of this world (`trimValue`, Q9).
 */
const BUDGET = Object.freeze({
    title: 200, text: 600,
    entry: 10000, entryHtml: 8000, summary: 26000, summaryHtml: 24000,
    player: Object.freeze({ entries: 250, chars: 200000 }),
    gm: Object.freeze({ entries: 150, chars: 100000 }),
    total: 500000, perAuthor: 40, authorShare: 0.25, fullSummaries: 4
});
/* A tombstone outlives any tab's unsaved copy of what it buried: the write is debounced 400 ms and
   flushed when a page hides, so ten minutes is the design's margin, not a measured one. */
const TOMBSTONE_MS = 10 * 60 * 1000;
const DEBOUNCE_MS = 400;

const isPlain = v => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const num = v => (Number.isFinite(v) ? v : 0);
const str = v => (typeof v === "string" ? v : "");
const clip = (text, max) => (text.length > max ? text.slice(0, max) : text);
const worldOfKey = key => key.slice(0, key.lastIndexOf("."));

/**
 * The epoch: which season's reset a section was written after, as a JSON fingerprint of the clock's
 * `seasonStartedAt` and the cuts of `EPOCH_GROUPS` (`resetCutPatch`, season-exceptions.mjs, moves
 * `seasonStartedAt` with the clock group only). An entry's `at` is never compared with a cut: a cut is a
 * GM's stamp, `at` this browser's clock.
 */
export function noticeEpoch(clock) {
    const cuts = isPlain(clock?.resetCuts) ? clock.resetCuts : {};
    return JSON.stringify([num(clock?.seasonStartedAt), ...EPOCH_GROUPS.map(group => num(cuts[group]))]);
}

/* ------------------------------------------------------------------------ *
 * The cleaning (E81 C2; the A7 design's step 2).
 * ------------------------------------------------------------------------ */

/*
 * WHY TWO STEPS. A snapshot is what a card's body showed, and a body holds what
 * another user wrote: a plain card's `message.content`, which the popup draws as it
 * came, a private card's words (a GM's `trusted` ones uncleaned, secret.mjs), the
 * messenger's preview, a trial's evidence, a day summary's names. `cleanCardHtml`
 * is the cleaning a private card's words get today, Foundry's `cleanHTML`; what
 * that lets through is not what a list of past cards should draw - an iframe's
 * `srcdoc` and a `data-tooltip-html` were the A7 design's two readings of it
 * (CB-27), and E83's fixes of it (E02-D01, D13) are not in this build. So the
 * history adds its own allowlist, `inertCopy`, which owes nothing to that
 * cleaner's thoroughness, and runs both at the write and again at every draw, so
 * a value written raw into the setting (another tab, a console) is drawn through
 * the same two steps as one this engine wrote.
 *
 * WHAT IS KEPT (the design's P2-2 to P2-5): the tags below and nothing else - any
 * other element goes with everything in it, a custom element, an `<svg>`, a form
 * control or an `<audio>` alike; `href` only http(s), opened apart from the game
 * (`rel` and `target` set here); an image's `src` only from this origin or a png,
 * webp or jpeg `data:` address, else the image goes; `alt`, a table cell's spans,
 * `class` only from `NOTICE_CLASSES`, and `title`, which is also where a
 * `data-tooltip`'s words go, as text. Every other attribute goes - `data-*`,
 * `aria-*`, `style`, `srcset`, `on*`, `id`, `name`, `for`, ... A roll's or a
 * document's link (`a.inline-roll`, `a.content-link`) becomes its words, and the
 * GMs' half of a card (`.drpg-gm-only`) is kept for a GM only.
 *
 * PARSED WHERE NOTHING RUNS. The string is read by a `DOMParser` into a document
 * with no browsing context and its body moved into a `<template>`'s content, a
 * document of the same kind: there an `<img onerror>` neither loads nor fires, as
 * it does in a detached `<div>` (`cardPreview` in messenger-app.mjs) - the HTML
 * standard's reading, which the A7 design (P2-1) took; not measured here, since
 * the harness's jsdom loads no image either way. Not a `template.innerHTML` write,
 * so that neither file of the history writes a stored value through innerHTML (the
 * design's P2-7: a grep for it is E02's criterion); the one `innerHTML` here reads
 * the cleaned tree out. What R294 measures, in the harness's jsdom, is what the
 * allowlist keeps; a browser's own parser, and Foundry's real `cleanHTML` before
 * it, are LIVE-E81-01.
 */
const SNAPSHOT_TAGS = new Set(["p", "br", "hr", "span", "div", "strong", "b", "em", "i", "u", "s", "small", "sub", "sup",
    "blockquote", "ul", "ol", "li", "dl", "dt", "dd", "table", "thead", "tbody", "tr", "th", "td",
    "h1", "h2", "h3", "h4", "h5", "h6", "img", "a"]);
const HTML_NS = "http://www.w3.org/1999/xhtml";
const GM_ONLY = "drpg-gm-only";
const IMAGE_DATA = /^data:image\/(?:png|webp|jpeg)[;,]/i;
const CELL_SPAN = /^[1-9]\d{0,2}$/;

/**
 * The classes a snapshot keeps: every class a `class="..."` of the files that build card bodies
 * writes - day-summary.mjs, popup.mjs, secret.mjs, messenger-app.mjs, trial.mjs, safeword.mjs and
 * action-rolls.mjs, the words inside a `${...}` of the attribute included - but the module's own
 * frames and Foundry's (`drpg-popup*`, `drpg-notices-*`, `drpg-corner-tail*`, `application`,
 * `window-*`, `inline-roll`, `content-link`, `fa-*`), which would dress a snapshot as a live card
 * or a window. 62 at E81 C2 (12.10.2026), 61 at E79 C16 (the Present dialog lost its Objection fieldset);
 * R294 runs the same grep and fails on a difference, so a class a card body gains is either added here or
 * drawn bare in the window.
 */
export const NOTICE_CLASSES = Object.freeze([
    "chapter", "drpg-briefing-block", "drpg-briefing-facts", "drpg-briefing-instruction", "drpg-checkbox",
    "drpg-choice", "drpg-choice-details", "drpg-choice-list", "drpg-choice-text", "drpg-day-summary",
    "drpg-duality", "drpg-duality-badge", "drpg-duality-die", "drpg-duality-formula", "drpg-duality-mod",
    "drpg-duality-op", "drpg-duality-result", "drpg-duality-stat", "drpg-duality-total",
    "drpg-evidence-card", "drpg-evidence-comment", "drpg-evidence-hint", "drpg-evidence-name",
    "drpg-evidence-text", "drpg-evidence-who", "drpg-gm-reference", "drpg-gm-route", "drpg-item-effect",
    "drpg-objection-banner", "drpg-objection-live", "drpg-objection-log",
    "drpg-safeword-heading", "drpg-specific-note",
    "drpg-sum-action", "drpg-sum-crit", "drpg-sum-found", "drpg-sum-head", "drpg-sum-lede", "drpg-sum-left",
    "drpg-sum-list", "drpg-sum-room", "drpg-sum-row", "drpg-sum-sep", "drpg-sum-tail", "drpg-sum-total",
    "drpg-sum-totals", "drpg-sum-who", "drpg-tb-badge", "drpg-tb-badges", "drpg-trait-field", "drpg-warning",
    "faint", "is-complete", "is-despair", "is-hope", "notes", "objection", "room", "type", "unavailable",
    "visibility"
]);
const KEEP_CLASS = new Set(NOTICE_CLASSES);

/** An address as the page would resolve it, or null. */
function addressOf(value) {
    try {
        return new URL(String(value ?? "").trim(), document.baseURI);
    } catch {
        return null;
    }
}

function imageAllowed(src) {
    const text = String(src ?? "").trim();
    if (!text) return false;
    if (IMAGE_DATA.test(text)) return true;
    const url = addressOf(text);
    // This page's files, or on The Forge its Assets Library's (E78 fix h76-HF1, 14.10.2026; read in the code: an
    // `<img>` of that host, where The Forge keeps a game's pictures, was dropped from the history). The one rule
    // `safeRoomImage` reads, `forgeAsset`; R546 reads both.
    return Boolean(url) && /^https?:$/.test(url.protocol) && (url.origin === addressOf("")?.origin || forgeAsset(url));
}

function linkAllowed(a) {
    if (!a.hasAttribute("href") || a.classList.contains("inline-roll") || a.classList.contains("content-link")) return false;
    return /^https?:$/.test(addressOf(a.getAttribute("href"))?.protocol ?? "");
}

/** A `data-tooltip` as the words Foundry's tooltip would show: a translation key translated, markup read as text. */
function tooltipWords(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    if (game.i18n?.has?.(raw)) return game.i18n.localize(raw);
    return new window.DOMParser().parseFromString(raw, "text/html").body.textContent.trim();
}

function keepAttributes(el, tag, gm) {
    const kept = [];
    if (tag === "a") kept.push(["href", el.getAttribute("href")], ["rel", "noopener noreferrer"], ["target", "_blank"]);
    if (tag === "img") {
        kept.push(["src", el.getAttribute("src")]);
        if (el.hasAttribute("alt")) kept.push(["alt", el.getAttribute("alt")]);
    }
    if (tag === "td" || tag === "th") {
        for (const name of ["colspan", "rowspan"]) if (CELL_SPAN.test(el.getAttribute(name) ?? "")) kept.push([name, el.getAttribute(name)]);
    }
    const hint = el.getAttribute("title") || tooltipWords(el.getAttribute("data-tooltip"));
    if (hint) kept.push(["title", hint]);
    const classes = [...el.classList].filter(name => KEEP_CLASS.has(name) || (gm && name === GM_ONLY));
    if (classes.length) kept.push(["class", classes.join(" ")]);
    for (const attr of [...el.attributes]) el.removeAttribute(attr.name);
    for (const [name, value] of kept) el.setAttribute(name, value);
}

function cleanChildren(parent, gm) {
    for (const node of [...parent.childNodes]) {
        if (node.nodeType === Node.TEXT_NODE) continue;
        if (node.nodeType !== Node.ELEMENT_NODE) {
            node.remove();
            continue;
        }
        const tag = node.namespaceURI === HTML_NS ? node.localName : null;
        if (!SNAPSHOT_TAGS.has(tag) || (!gm && node.classList.contains(GM_ONLY)) || (tag === "img" && !imageAllowed(node.getAttribute("src")))) {
            node.remove();
            continue;
        }
        /* A refused link is kept as its words - the words of what is left of it once its own children are
           cleaned (E81 fix r1-G4; review round 1's O5). Taken before they were, a GM-only span, an svg's text or
           a style's rules inside the link came through as text for a player (R294's refused links, 12.10.2026). */
        if (tag === "a" && !linkAllowed(node)) {
            cleanChildren(node, gm);
            node.replaceWith(node.ownerDocument.createTextNode(node.textContent));
            continue;
        }
        let el = node;
        /* An element parsed with `is` keeps it past `removeAttribute`: the serializer writes the element's own
           "is value" back out, and R294's first run (12.10.2026, the harness's jsdom) read `is="r294-div"` in a
           stored snapshot. The HTML standard's serializer says the same of a browser; not measured in one. A
           fresh element of the tag has no is value. The parser takes attribute names `setAttribute` refuses:
           `<p is="x" "foo"=1>` gives an attribute `"foo"`, and copying it threw InvalidCharacterError ("did not
           match the Name production", the harness's jsdom, 12.10.2026), which kept the card with an empty body
           (review round 1's O4). Such an attribute is left behind; `keepAttributes` would drop it anyway. */
        if (el.hasAttribute("is")) {
            el = node.ownerDocument.createElement(tag);
            for (const attr of node.attributes) {
                if (attr.name === "is") continue;
                try {
                    el.setAttribute(attr.name, attr.value);
                } catch {
                    // a name the parser accepts and the DOM does not
                }
            }
            el.append(...node.childNodes);
            node.replaceWith(el);
        }
        keepAttributes(el, tag, gm);
        cleanChildren(el, gm);
    }
}

/** The allowlist's tree of `html`, in a `<template>` (see "PARSED WHERE NOTHING RUNS" above). */
function inertTree(html, gm) {
    const parsed = new window.DOMParser().parseFromString(String(html ?? ""), "text/html");
    const template = document.createElement("template");
    template.content.append(...parsed.body.childNodes);
    cleanChildren(template.content, gm);
    return template;
}

/** The allowlist alone: `html` as a snapshot may hold it, for a GM or not (this user, by default). */
export function inertCopy(html, { gm = Boolean(game.user?.isGM) } = {}) {
    return inertTree(html, gm).innerHTML;
}

/*
 * A kept snapshot's words, for the entry's `text` (E81 C3): read off the cleaned html, not off the card, so a
 * player's text never holds a GM's half the cleaning took out; a space after each block, or two paragraphs
 * run into one word (a template's textContent of `<p>kept words</p><p>R293 styled</p>` read "kept wordsR293
 * styled" in the harness's jsdom on 12.10.2026; the DOM standard's textContent joins text nodes as they are).
 */
const WORD_BREAKS = new Set(["p", "br", "hr", "div", "li", "dt", "dd", "tr", "td", "th", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6"]);

function keptWords(html, { gm = Boolean(game.user?.isGM) } = {}) {
    return noticeWords(inertTree(html, gm).content);
}

/**
 * The words of a node of a kept snapshot, read as `keptWords` reads a whole one: a space after each block, the
 * whitespace run together. It writes those spaces into the node, so it is handed a snapshot drawn to be read,
 * never one on screen. The window reads each block of a card apart with it (E77 fix r2-H4).
 */
export function noticeWords(node) {
    if (node?.nodeType === 1 || node?.nodeType === 11) {
        for (const el of node.querySelectorAll("*")) if (WORD_BREAKS.has(el.localName)) el.after(" ");
    }
    return String(node?.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Both steps: what the history keeps of a card's body (the module's engine cleans every `record` with it). */
export function cleanNoticeHtml(html, options = {}) {
    return inertCopy(cleanCardHtml(html), options);
}

/**
 * A kept snapshot drawn: the stored string through both steps again, whoever wrote it, and into a
 * `div.drpg-notice-snapshot` by `importNode` - never by innerHTML or `setHTMLUnsafe`. The one road
 * from the setting to the screen: the window (E81 C7) draws every snapshot with it. A snapshot that
 * cannot be cleaned is drawn empty.
 */
export function noticeSnapshot(html, { gm = Boolean(game.user?.isGM) } = {}) {
    const wrap = document.createElement("div");
    wrap.className = "drpg-notice-snapshot";
    try {
        wrap.append(document.importNode(inertTree(cleanCardHtml(html), gm).content, true));
    } catch (err) {
        debug("A kept notice could not be cleaned; it is drawn empty", err);
    }
    return wrap;
}

/**
 * One engine over one environment, as `createGmStoreEngine` is (gm-store.mjs), so R292 runs it on a
 * value in memory.
 *
 * env: worldId(), userId(), isGM(), now(), randomId(), clock() -> the campaign clock,
 * userExists(id), messageExists(id) -> whether the chat card is still in the log (optional: without it nothing is
 * marked deleted at `open`), clean(html) -> the html as it may be kept (the module's engine: `cleanNoticeHtml`),
 * text(html) -> the words of html `clean` gave back (optional: without it an entry keeps the text its caller gave),
 * storage { read() -> the stored value as JSON text or null, write(value) -> Promise, writeNow(value) -> written
 * before it returns, or throws (giving way, E81 C6) },
 * timers { set(fn, ms), clear(handle) }, log { warn, debug }.
 */
export function createNoticeEngine(env) {
    let opened = false;
    let ownKey = null;
    let mine = null;               // this login's section, as this client holds it
    const pending = [];            // recorded before `ready`, when the clock (and so the epoch) is not read yet
    const sessionOnly = new Set(); // ids recorded with `persist: "session"`: in this page's memory, never written
    let held = 0;                  // the suite's hold, nested
    let saving = true;             // false: the value is kept in memory only (a write failed twice, or a newer format)
    let timer = null;
    let flushing = null, again = false;
    let room = 1;                  // the share of the section's and the value's budgets this session keeps: 1/2 once it gave way
    let edits = 0, written = 0;    // the changes this client made to its section, and how many of them a write has held (E81 fix r1-G5)
    let heldFrom = null;           // this login's section as the suite's hold found it, given back at the release
    const aliases = new Map();     // an id this page recorded -> its card (`pairOf`), for a copy another tab's merge kept instead
    const listeners = new Set();

    const epochNow = () => noticeEpoch(env.clock());
    const emptySection = () => ({ epoch: epochNow(), touched: 0, clearedAt: 0, gone: {}, entries: [] });
    const changed = () => { for (const fn of listeners) { try { fn(); } catch (err) { env.log.debug("A notice history listener threw", err); } } };

    /* ------------------------------ reading ------------------------------ */

    function normalizeEntry(raw) {
        if (!isPlain(raw) || !ID.test(raw.id) || !(Number.isFinite(raw.at) && raw.at > 0)) return null;
        const mark = raw.mark ?? null, messageId = raw.messageId ?? null, tone = raw.tone ?? null;
        if (!NOTICE_SOURCES.includes(raw.source) || !STATES.includes(raw.state) || !MARKS.includes(mark)) return null;
        if (messageId !== null && !ID.test(messageId)) return null;
        if (!NOTICE_KINDS.includes(raw.kind) || (tone !== null && !NOTICE_TONES.includes(tone))) return null;
        const clock = isPlain(raw.clock) ? raw.clock : {};
        const entry = {
            id: raw.id, at: raw.at, messageId, kind: raw.kind, tone, source: raw.source, state: raw.state, mark,
            title: clip(str(raw.title), BUDGET.title), text: clip(str(raw.text), BUDGET.text), html: str(raw.html),
            clipped: raw.clipped === true,
            clock: {
                chapter: num(clock.chapter), day: num(clock.day), session: num(clock.session),
                timeOfDay: clip(str(clock.timeOfDay), 32), eclipse: clock.eclipse === true
            }
        };
        if (ID.test(raw.author)) entry.author = raw.author;
        if (isPlain(raw.link) && ID.test(raw.link.messenger) && env.userExists(raw.link.messenger)) entry.link = { messenger: raw.link.messenger };
        return fit(entry);
    }

    /** An entry over its budget keeps its title and text and loses its html (`clipped`). */
    function fit(entry) {
        const summary = entry.source === "summary";
        if (entry.html.length > (summary ? BUDGET.summaryHtml : BUDGET.entryHtml)
            || JSON.stringify(entry).length > (summary ? BUDGET.summary : BUDGET.entry)) return { ...entry, html: "", clipped: true };
        return entry;
    }

    function normalizeSection(raw) {
        if (!isPlain(raw)) return null;
        const gone = {};
        if (isPlain(raw.gone)) for (const [id, at] of Object.entries(raw.gone)) if (ID.test(id) && Number.isFinite(at) && at > 0) gone[id] = at;
        const seen = new Set(), entries = [];
        for (const entry of (Array.isArray(raw.entries) ? raw.entries : []).map(normalizeEntry)) {
            if (!entry || seen.has(entry.id)) continue;
            seen.add(entry.id);
            entries.push(entry);
        }
        return { epoch: str(raw.epoch), touched: num(raw.touched), clearedAt: num(raw.clearedAt), gone, entries: entries.sort((a, b) => a.at - b.at) };
    }

    /**
     * The stored value, every section of another world or another account as it was written - never
     * read into this login's history, only weighed for the budget and epoch-checked in this world. A value
     * in another format: one a newer build wrote is left alone (this client keeps its own in memory), any
     * other is read as empty and replaced at the next write.
     */
    function readValue() {
        let raw = null;
        try {
            raw = env.storage.read();
        } catch (err) {
            env.log.debug("Could not read the notice history", err);
        }
        let value = raw;
        if (typeof raw === "string") {
            try { value = JSON.parse(raw); } catch { value = null; }
        }
        if (!isPlain(value)) return { sections: {} };
        if (Number.isInteger(value.v) && value.v > FORMAT) return { sections: {}, newer: true };
        if (value.v !== FORMAT || !isPlain(value.sections)) return { sections: {} };
        return { sections: { ...value.sections } };
    }

    /**
     * Clears what the season's reset ended: every section of this world whose epoch is not the clock's,
     * this login's included (the owner's Q9: the reset is the one road by which an absent account's
     * history goes). Answers whether anything was taken.
     */
    function applyEpoch(value) {
        const world = env.worldId(), epoch = epochNow();
        let taken = false;
        for (const [key, section] of Object.entries(value.sections)) {
            if (worldOfKey(key) !== world || (isPlain(section) && section.epoch === epoch)) continue;
            delete value.sections[key];
            taken = true;
        }
        return taken;
    }

    /* ------------------------------- merging ------------------------------ */

    /**
     * Which card an entry keeps, for "one entry per card": its chat card and source; a day summary, which has
     * no chat card, by its words - the same summary drawn in two tabs of one login is one card (E81 fix r1-G5;
     * review round 1's N3: it was kept twice). Null for an entry that is only itself.
     */
    function pairOf(entry) {
        if (entry.messageId !== null) return `${entry.messageId}|${entry.source}`;
        return entry.source === "summary" ? `summary|${entry.title}|${entry.text}|${entry.html}` : null;
    }

    /** The entry with its state moved on to `state` when that is further (`RANK`), never back. */
    const atLeast = (entry, state) => (RANK[state] > RANK[entry.state] ? { ...entry, state } : entry);

    /**
     * Another tab's copy of this login's section into this one: the union by id (this tab's copy of an
     * entry both hold wins, its state the further of the two), one entry per card (`pairOf`: the newest,
     * with the furthest state of the copies it stands for - E81 fix r1-G5, N3: a card closed in the
     * older of two tabs was left `open` in the newer one's copy), nothing at or before the last Clear and
     * nothing buried; tombstones older than ten minutes let go.
     */
    function mergeInto(into, theirs) {
        if (theirs) {
            into.clearedAt = Math.max(into.clearedAt, theirs.clearedAt);
            for (const [id, at] of Object.entries(theirs.gone)) into.gone[id] = Math.max(into.gone[id] ?? 0, at);
            const ids = new Map(into.entries.map((entry, i) => [entry.id, i]));
            for (const entry of theirs.entries) {
                const i = ids.get(entry.id);
                if (i === undefined) into.entries.push(entry);
                else into.entries[i] = atLeast(into.entries[i], entry.state);
            }
        }
        const now = env.now();
        for (const [id, at] of Object.entries(into.gone)) if (now - at > TOMBSTONE_MS) delete into.gone[id];
        const newest = new Map(), furthest = new Map();
        for (const entry of into.entries) {
            const pair = pairOf(entry);
            if (pair === null) continue;
            if (!newest.has(pair) || newest.get(pair).at <= entry.at) newest.set(pair, entry);
            if (!furthest.has(pair) || RANK[entry.state] > RANK[furthest.get(pair)]) furthest.set(pair, entry.state);
        }
        into.entries = into.entries
            .filter(entry => entry.at > into.clearedAt && !Object.hasOwn(into.gone, entry.id)
                && (pairOf(entry) === null || newest.get(pairOf(entry)) === entry))
            .map(entry => (pairOf(entry) === null ? entry : atLeast(entry, furthest.get(pairOf(entry)))))
            .sort((a, b) => a.at - b.at);
    }

    /**
     * Whether this page holds something of this login's history that `theirs` (the stored copy, or null) does
     * not: an entry, a further state, a tombstone, a later Clear. Read after a merge, so what another tab
     * changed is already in; what is left is what a write of an older copy lost (E81 fix r1-G5). Entries this
     * page keeps for itself (`persist: "session"`) are never written, and so never missing.
     */
    function lacks(theirs) {
        const kept = mine.entries.filter(entry => !sessionOnly.has(entry.id));
        if (!theirs) return kept.length > 0 || mine.clearedAt > 0 || Object.keys(mine.gone).length > 0;
        const stored = new Map(theirs.entries.map(entry => [entry.id, entry.state]));
        return mine.clearedAt > theirs.clearedAt
            || Object.keys(mine.gone).some(id => !Object.hasOwn(theirs.gone, id))
            || kept.some(entry => !stored.has(entry.id) || RANK[entry.state] > RANK[stored.get(entry.id)]);
    }

    /* ------------------------------- budgets ------------------------------ */

    const sizeOf = value => JSON.stringify(value).length;

    function trimSection(section) {
        let full = 0;
        for (let i = section.entries.length - 1; i >= 0; i--) {
            const entry = section.entries[i];
            if (entry.source !== "summary" || entry.clipped) continue;
            if (++full > BUDGET.fullSummaries) section.entries[i] = { ...entry, html: "", clipped: true };
        }
        /*
         * NOBODY'S CARDS PUSH ANOTHER ACCOUNT'S ENTRIES OUT (E81 fix r1-G1, 12.10.2026; review round 1's F1, N1
         * and GV1). The bound counted a "player" card's author alone, and its entries alone, and the section was
         * then cut oldest first whoever had filled it: on a GM, 12 public cards of 7 800 characters from one player
         * took all 5 of the GM's own entries (the security review's run 98-sec-r1), and a whisper with `gmPopup`,
         * an evidence card, a `gmAsk` card or a safeword card took them uncounted (the correctness review's bench:
         * 0 of 30 kept on every road). Now every entry from another user carries that user, whatever its source
         * (popup.mjs `noticeSource`), and each keeps at most 40 entries and a quarter of the section's characters,
         * its own oldest going first, newest counted first. A section still over its budget then loses the oldest
         * entry of whichever holds the most of it - an author, or this login's own entries and the module's (no
         * author) taken as one - so the cut falls on whoever filled it. The quarter is the reviewers' figure, not a
         * measurement: four senders at their bound fill a section, and a fifth cuts the heaviest of them first.
         */
        const cap = env.isGM() ? BUDGET.gm : BUDGET.player;
        const most = Math.floor(cap.entries * room), chars = cap.chars * room;
        const weight = new Map(section.entries.map(entry => [entry, sizeOf(entry) + 1]));
        const seen = new Map(), drop = new Set();
        for (let i = section.entries.length - 1; i >= 0; i--) {
            const entry = section.entries[i];
            if (!entry.author) continue;
            const had = seen.get(entry.author) ?? { n: 0, size: 0 };
            const now = { n: had.n + 1, size: had.size + weight.get(entry) };
            seen.set(entry.author, now);
            if (now.n > Math.floor(BUDGET.perAuthor * room) || now.size > cap.chars * BUDGET.authorShare * room) drop.add(entry);
        }
        if (drop.size) section.entries = section.entries.filter(entry => !drop.has(entry));
        const groups = new Map();
        for (const entry of section.entries) {
            const group = groups.get(entry.author ?? "") ?? { n: 0, size: 0 };
            group.n++;
            group.size += weight.get(entry);
            groups.set(entry.author ?? "", group);
        }
        let size = sizeOf(section);
        while (section.entries.length && (section.entries.length > most || size > chars)) {
            const by = section.entries.length > most ? "n" : "size";
            const [key, group] = [...groups].reduce((a, b) => (b[1][by] > a[1][by] ? b : a));
            const [gone] = section.entries.splice(section.entries.findIndex(entry => (entry.author ?? "") === key), 1);
            size -= weight.get(gone);
            group.n--;
            group.size -= weight.get(gone);
            if (!group.n) groups.delete(key);
        }
    }

    /**
     * The whole value over 500 000 (250 000 once the history gave way): other worlds' sections go
     * first, the least recently written first (the A7 design, 1b); then this login's oldest entries, its
     * newest always kept. Answers false, and cuts nothing of this login's, when this world's other
     * accounts' sections leave no room beside them for even that newest one: the caller then keeps this
     * login's history in memory only, where cutting it to nothing would have emptied it there too.
     *
     * NEVER ANOTHER ACCOUNT'S SECTION OF THIS WORLD (E81 fix r1-G2, 12.10.2026; review round 1's F3 and N2).
     * The design's 1b let this world's other accounts' sections go next, the least recently written first,
     * against Q9 ("every account's history stays in the one value to the season's reset") - and once the
     * history had given way the halved total reached them on a browser three accounts of one world had used:
     * the correctness review's bench at 0697d0f, a GM's give-way beside a player's section of 199 622
     * characters and another's of 60 808, deleted the first whole. Measured again on 12.10 over the engine,
     * sections of 23, 7 and 10 entries of about 8 000 characters: the same give-way at 27e4b34 deleted the
     * 185 884-character section of 23 entries; now both stay byte for byte, and the GM's newer 5 entries,
     * written as they are, stay in its memory with the history no longer saving. A shared browser whose other
     * accounts fill the value costs this login its saving, never them their history.
     */
    function trimValue(value) {
        const total = BUDGET.total * room;
        let size = sizeOf(value);
        if (size <= total) return true;
        const world = env.worldId();
        const byTouched = (a, b) => num(a[1]?.touched) - num(b[1]?.touched);
        for (const [key] of Object.entries(value.sections).filter(([key]) => key !== ownKey && worldOfKey(key) !== world).sort(byTouched)) {
            if (size <= total) return true;
            delete value.sections[key];
            size = sizeOf(value);
        }
        if (size - sizeOf(mine.entries) + sizeOf(mine.entries.slice(-1)) > total) return false;
        while (size > total && mine.entries.length > 1) {
            size -= sizeOf(mine.entries.shift()) + 1;
            value.sections[ownKey] = mine;
        }
        return true;
    }

    /* ------------------------------- writing ------------------------------ */

    /** The value as it is written: this login's section without what this page keeps for itself (`persist: "session"`). */
    function forStorage(sections) {
        const own = sections[ownKey];
        if (!sessionOnly.size || !own) return sections;
        return { ...sections, [ownKey]: { ...own, entries: own.entries.filter(entry => !sessionOnly.has(entry.id)) } };
    }

    /*
     * A WRITE ONLY WHEN SOMETHING CHANGED (E81 fix r1-G5, 12.10.2026; review round 1's O2). `flush` wrote on every
     * call, and the page calls it on every `pagehide` and every hidden `visibilitychange`: both reviewers measured
     * it at 0697d0f - a login that had recorded nothing found its empty section written at the first hide, and
     * rewritten at the next (`touched` moved), so a GM who switched tabs during a tier 0/1 run turned "tier 0/1
     * changed nothing in the world" red (worldDump reads every client setting of the module), every sibling tab
     * took a `storage` event, and `touched` meant "last hidden". Every change to this login's section passes
     * here and counts one; a write counts as done only once it succeeded, and `flush` returns at once when
     * nothing is left to write. A change under the suite's hold does not count: the release forgets it.
     */
    function schedule() {
        if (held) return;
        edits++;
        arm();
    }

    function arm() {
        if (held || !saving || timer !== null) return;
        timer = env.timers.set(() => { timer = null; void flush(); }, DEBOUNCE_MS);
    }

    /**
     * The value as this client is to write it: what the epoch ended cleared, another tab's copy of this
     * login's section merged in, and the budgets kept - after the older half of the section is let go,
     * when `halve` (giving way). False when the value cannot keep the whole value's budget (`trimValue`).
     */
    function gather(value, { halve = false } = {}) {
        applyEpoch(value);
        if (mine.epoch !== epochNow()) mine = emptySection();
        const theirs = normalizeSection(value.sections[ownKey]);
        mergeInto(mine, theirs?.epoch === mine.epoch ? theirs : null);
        if (halve) mine.entries.splice(0, Math.ceil(mine.entries.length / 2));
        trimSection(mine);
        mine.touched = env.now();
        /* A login with nothing to keep has no section (E81 fix r1-G5): the reset's clean-up of other sections
           writes, and wrote an empty one for this login with it. */
        if (mine.entries.length || mine.clearedAt || Object.keys(mine.gone).length) value.sections[ownKey] = mine;
        else delete value.sections[ownKey];
        return trimValue(value);
    }

    /** This world's other accounts hold the whole value's budget (`trimValue`): this login's history stays in memory for the session. */
    function crowdedOut() {
        saving = false;
        env.log.warn("This world's other accounts' notice histories fill this browser's share; this one is kept in memory until this page closes.");
    }

    /**
     * Read the stored value afresh, clear what the epoch ended, merge this login's section in, keep the
     * budgets and write - when this login's section changed since the last write (`schedule`). This login's
     * section missing from the value (another account's write, or a console) is written again from memory at
     * that write, or at once when another tab's write is what took it (`external`). A write that throws drops the oldest quarter and tries once
     * more; a second failure keeps the history in memory for the rest of the session (`status`), with no
     * notification: the window's footer says it (E81 C7). So does a value this world's other accounts fill
     * (`trimValue`, E81 fix r1-G2), before anything is written.
     */
    async function flush() {
        if (timer !== null) { env.timers.clear(timer); timer = null; }
        if (!opened || held || !saving || edits === written) return;
        if (flushing) { again = true; return flushing; }
        flushing = (async () => {
            const upTo = edits;
            const value = readValue();
            if (value.newer) {
                saving = false;
                env.log.warn("The notice history is stored in a newer format by another build; this one keeps it in memory only.");
                changed();
                return;
            }
            if (!gather(value)) {
                crowdedOut();
                changed();
                return;
            }
            for (let attempt = 0; ; attempt++) {
                try {
                    await env.storage.write({ v: FORMAT, sections: forStorage(value.sections) });
                    written = Math.max(written, upTo);
                    return;
                } catch (err) {
                    if (attempt) {
                        saving = false;
                        env.log.warn("The notice history could not be saved in this browser; it is kept in memory until this page closes.", err);
                        changed();
                        return;
                    }
                    mine.entries.splice(0, Math.ceil(mine.entries.length / 4));
                    value.sections[ownKey] = mine;
                }
            }
        })();
        try {
            await flushing;
        } finally {
            flushing = null;
        }
        if (again) {
            again = false;
            await flush();
        }
    }

    /**
     * GIVING WAY (E81 C6; the A7 design's 1e). Another of the module's stores found this browser's storage
     * full (`keepRoom`, on `drpgStorageFull`) and is about to try once more: the history gives its room back
     * first, and synchronously, because that second try follows this call without waiting for anything.
     * Every other world's section goes, then the older half of this login's section, and the budgets are
     * halved for the rest of the session, so the next write does not take the room back. Another account's
     * section of this world stays (Q9): when those sections leave no room in the halved whole value for
     * this login's newest entry, what is left is written and this login's history is kept in memory from
     * then on (E81 fix r1-G2, `trimValue`). The smaller value is written through `storage.writeNow` - also when
     * the history had stopped saving after its own writes failed, since its old value still holds the room -
     * but not under the suite's hold, nor over a value a newer build wrote. Answers how many characters of
     * JSON the stored value lost; what that frees in a browser's own count is not measured here.
     */
    function giveWay() {
        if (held) return 0;
        room = 0.5;
        if (!opened) return 0;
        const value = readValue();
        if (value.newer) return 0;
        const before = sizeOf({ v: FORMAT, sections: value.sections });
        const upTo = edits;
        const world = env.worldId();
        for (const key of Object.keys(value.sections)) if (worldOfKey(key) !== world) delete value.sections[key];
        const crowded = !gather(value, { halve: true });
        if (crowded) crowdedOut();
        const next = { v: FORMAT, sections: forStorage(value.sections) };
        try {
            env.storage.writeNow(next);
        } catch (err) {
            env.log.warn("The notice history could not give its room back in this browser's storage.", err);
            if (crowded) changed();
            return 0;
        }
        written = Math.max(written, upTo);
        changed();
        return Math.max(0, before - sizeOf(next));
    }

    /* ------------------------------- the API ------------------------------ */

    /**
     * At `ready`, when the clock is read: this login's section from the value, cleared if the season was
     * reset since; what was open when the page went is unread now (it was on screen, and is not); every
     * section of this world the reset ended is taken out at the next write. Nothing of another account's
     * section is touched otherwise (Q9).
     */
    function open({ atReady = true } = {}) {
        opened = true;
        ownKey = `${env.worldId()}.${env.userId()}`;
        const value = readValue();
        if (value.newer) saving = false;
        let dirty = applyEpoch(value);
        const stored = normalizeSection(value.sections[ownKey]);
        mine = stored ?? emptySection();
        /* A card deleted while this page was closed (E81 C5): no hook told this browser, so the log does - an
           entry whose chat card is gone from it is marked as the deletion would have marked it. Withdrawn or not
           cannot be told any more; the entry stays, as the rule keeps every deletion but the module's own. */
        for (const entry of atReady ? mine.entries : []) {
            if (entry.state === "open") {
                entry.state = "unread";
                dirty = true;
            }
            if (entry.messageId !== null && entry.mark !== "deleted" && env.messageExists?.(entry.messageId) === false) {
                entry.mark = "deleted";
                dirty = true;
            }
        }
        for (const entry of pending.splice(0)) add(entry);
        if (dirty) schedule();
        changed();
    }

    function add(entry) {
        if (mine.epoch !== epochNow()) mine = emptySection();
        /* `at <= clearedAt` is what a merge refuses, so nothing recorded after a Clear may share its millisecond. */
        entry.at = Math.max(entry.at, mine.clearedAt + 1);
        const pair = pairOf(entry);
        if (pair !== null) mine.entries = mine.entries.filter(e => pairOf(e) !== pair);
        mine.entries.push(entry);
        trimSection(mine);
        schedule();
    }

    /**
     * Keep one notice (E81 C3 and C4 call it; the entry's shape is the A7 design's P1-1). `id`, `at` and
     * `clock` are this client's: `at` is `Date.now()` here whatever the caller passes, never a packet's
     * (the lesson of E02-D08). The html is kept as `env.clean` hands it back (E81 C2), and a cleaner that
     * throws keeps the notice without it: a history error never stops a card. An `author` that is no user of
     * this world is dropped here (E81 fix r2-H1, review round 2's S1): each author is a holder of its own in
     * `trimSection`, so a made-up id per card made one-entry holders that outlasted this login's own entries
     * (the review's 150 cards, each naming a made-up thread, left a GM 0 of its 5). Answers the entry's id, or
     * null for an entry the shape refuses.
     */
    function record(input = {}) {
        const clock = env.clock() ?? {};
        const { html, text } = keep(input.html, input.text) ?? { html: "", text: input.text };
        const entry = normalizeEntry({
            id: env.randomId(), at: env.now(), messageId: input.messageId ?? null, kind: input.kind ?? "info", tone: input.tone ?? null,
            source: input.source, state: input.state ?? "open", mark: null, title: input.title, text, html,
            clipped: false, author: env.userExists(input.author) ? input.author : undefined, link: input.link,
            clock: { chapter: clock.chapter, day: clock.day, session: clock.session, timeOfDay: clock.timeOfDay, eclipse: clock.eclipse }
        });
        if (!entry) {
            env.log.debug("A notice the history's shape refuses was not kept", input);
            return null;
        }
        if (input.persist === "session") sessionOnly.add(entry.id);
        if (pairOf(entry) !== null) aliases.set(entry.id, pairOf(entry));
        if (!opened) pending.push(entry);
        else add(entry);
        changed();
        return entry.id;
    }

    /**
     * What may be kept of a card's html, and its words: `env.clean`'s answer, and the text read off that answer
     * rather than off the card - a player's card that hides a GM's half by a class still holds its words, and
     * the cleaning is what takes them out (E81 C3). Null when the cleaner throws: the caller keeps what it had.
     */
    function keep(raw, text) {
        let html;
        try {
            html = env.clean(str(raw));
        } catch (err) {
            env.log.debug("A notice's html could not be cleaned; it is kept without it", err);
            return null;
        }
        if (text !== undefined || typeof env.text !== "function") return { html, text };
        try {
            return { html, text: env.text(html) };
        } catch (err) {
            env.log.debug("A notice's words could not be read", err);
            return { html, text: "" };
        }
    }

    /**
     * Move one kept notice while its card is on screen and as it closes (E81 C3, popup.mjs): `state` from the close's
     * reason, `html` the body as it is drawn now (its words read again with it). Through the same cleaning and the
     * same budget as `record`; an entry Clear, a merge or the epoch took is not brought back. Answers whether the
     * entry moved.
     */
    function update(id, patch = {}) {
        const list = mine?.entries ?? pending;
        /* An entry a merge dropped for another tab's copy of the same card is moved through that copy (E81 fix
           r1-G5, N3: the older tab's X reached nothing, and the card stayed "open" in the history). */
        let at = list.findIndex(entry => entry.id === id);
        if (at < 0 && aliases.has(id)) at = list.findIndex(entry => pairOf(entry) === aliases.get(id));
        if (at < 0) return false;
        let next = { ...list[at] };
        if (STATES.includes(patch.state)) next.state = patch.state;
        if (patch.html !== undefined) {
            const kept = keep(patch.html);
            if (kept) next = fit({ ...next, html: kept.html, text: clip(str(kept.text), BUDGET.text), clipped: false });
        }
        if (JSON.stringify(next) === JSON.stringify(list[at])) return false;
        list[at] = next;
        /* A card's words can land after it is drawn (a private card's, a messenger's): the stub was what the
           per-author bound weighed at `record`, so the grown entry is weighed again here (E81 fix r1-G1). */
        if (mine && patch.html !== undefined) trimSection(mine);
        if (mine) schedule();
        changed();
        return true;
    }

    /**
     * Every entry of one chat card through `change` (E81 C5): its answer is the entry as it is to be, or null to
     * take it out with a tombstone, so another tab's copy does not bring it back. Answers whether any moved.
     */
    function byMessage(messageId, change) {
        if (!ID.test(str(messageId))) return false;
        const list = mine?.entries ?? pending;
        let moved = false;
        for (let i = list.length - 1; i >= 0; i--) {
            if (list[i].messageId !== messageId) continue;
            const next = change({ ...list[i] });
            if (next === null) {
                if (mine) mine.gone[list[i].id] = env.now();
                list.splice(i, 1);
                moved = true;
            } else if (JSON.stringify(next) !== JSON.stringify(list[i])) {
                list[i] = next;
                moved = true;
            }
        }
        if (!moved) return false;
        if (mine) schedule();
        changed();
        return true;
    }

    /**
     * A chat card deleted (E81 C5): withdrawn by the module, its entries go; deleted any other way they stay,
     * marked `deleted`, and one still open is unread - it was on screen and is not.
     */
    function deleted(messageId, { withdraw = false } = {}) {
        return byMessage(messageId, entry => (withdraw ? null : { ...entry, state: entry.state === "open" ? "unread" : entry.state, mark: "deleted" }));
    }

    /**
     * A chat card changed after it was shown (E81 C5): `rerolled` or `settled`, and nothing else - the snapshot is
     * what the card showed, and stays it. A deleted card's mark is not taken back by a late update.
     */
    function mark(messageId, value) {
        if (value !== "rerolled" && value !== "settled") return false;
        return byMessage(messageId, entry => (entry.mark === "deleted" ? entry : { ...entry, mark: value }));
    }

    return {
        open,
        record,
        update,
        deleted,
        mark,
        flush,
        giveWay,
        /** This login's entries, oldest first, as copies. */
        entries: () => structuredClone(mine?.entries ?? pending),
        /** Clear: nothing kept so far comes back from another tab (`clearedAt` and a tombstone each). */
        clear() {
            if (!mine) return;
            const now = env.now();
            for (const entry of mine.entries) mine.gone[entry.id] = now;
            mine.clearedAt = Math.max(now, mine.clearedAt);
            mine.entries = [];
            schedule();
            changed();
        },
        /** Take one entry out by its id: a tombstone, so another tab's copy does not bring it back (R292). */
        remove(id) {
            if (!mine || !mine.entries.some(entry => entry.id === id)) return false;
            mine.gone[id] = env.now();
            mine.entries = mine.entries.filter(entry => entry.id !== id);
            schedule();
            changed();
            return true;
        },
        /**
         * Another tab wrote the value (the `storage` event): its copy of this login's section merged in. Written
         * back only when that write lost something this page holds (`lacks`): a tab writing from a copy older
         * than this one's, or an account's write without this login's section (E81 fix r1-G5). Before the
         * clean-write rule every flush rewrote it anyway; since, nothing else would.
         */
        external() {
            if (!opened) return;
            const value = readValue();
            const theirs = normalizeSection(value.sections[ownKey]);
            if (mine.epoch !== epochNow()) mine = emptySection();
            const same = theirs?.epoch === mine.epoch ? theirs : null;
            mergeInto(mine, same);
            if (lacks(same)) schedule();
            changed();
        },
        /** The clock changed: a reset since this section was written clears it now, and the others at the write. */
        checkEpoch() {
            if (!opened || mine.epoch === epochNow()) return false;
            mine = emptySection();
            schedule();
            changed();
            return true;
        },
        /**
         * The suite's hold (tests.mjs, beside `gmStoreHold`): what was waiting is written first (the
         * promise answered settles when it is, so the runner reads the setting after it), then nothing is
         * until the hold is let go. Let go, this login's history is what it was when the hold was taken -
         * whatever a test recorded meanwhile is forgotten, and so is a real notice that arrived while it was
         * held, which the engine cannot tell from a test's (a tier-1 test holds for under a second; tier 2
         * is not run during play).
         * THE RELEASE GIVES BACK WHAT IT HELD (E81 fix r1-G5, 12.10.2026; review round 1's N4 and O3). It
         * read the setting again (`open`), so a history kept in memory only - its writes had failed, or a
         * newer build owned the value - lost the whole session at a tier-1 run, and anything not yet written
         * went with it. It gives back its own copy now, and writes later only what the setting lacks.
         */
        hold(on) {
            if (on) {
                const waiting = !held && (timer !== null || flushing) ? flush() : null;
                if (!held && mine) heldFrom = structuredClone(mine);
                held++;
                return waiting ?? Promise.resolve();
            }
            if (!held || --held) return Promise.resolve();
            if (opened && heldFrom) {
                mine = heldFrom;
                const stored = normalizeSection(readValue().sections[ownKey]);
                if (lacks(stored?.epoch === mine.epoch ? stored : null)) schedule();
                else if (edits !== written) arm();
            } else if (opened) {
                open({ atReady: false });
            }
            heldFrom = null;
            return Promise.resolve();
        },
        status: () => ({ saving, note: saving ? null : NOTICE_TEXTS.notSaved }),
        /** How many of this login's notices are unread - the number the tile's button shows (E81 C8), and nothing of any entry. */
        unread: () => (mine?.entries ?? pending).filter(entry => entry.state === "unread").length,
        /**
         * Every unread entry read (E81 C7: the window's "Mark as read", and the window closing): an entry still on
         * screen stays `open`, a read one stays read. Answers how many moved; none is no write.
         */
        markRead() {
            const list = mine?.entries ?? pending;
            let moved = 0;
            for (let i = 0; i < list.length; i++) {
                if (list[i].state !== "unread") continue;
                list[i] = { ...list[i], state: "read" };
                moved++;
            }
            if (!moved) return 0;
            if (mine) schedule();
            changed();
            return moved;
        },
        /** Whether an entry was recorded with `persist: "session"`: kept in this page's memory and never written (the window's tag, E81 C7). */
        sessionOnly: id => sessionOnly.has(id),
        onChange(fn) {
            listeners.add(fn);
            return () => listeners.delete(fn);
        }
    };
}

/* ------------------------------------------------------------------------ *
 * The module's engine, over the real Foundry.
 * ------------------------------------------------------------------------ */

const engine = createNoticeEngine({
    worldId: () => String(game.world?.id ?? ""),
    userId: () => String(game.user?.id ?? ""),
    isGM: () => Boolean(game.user?.isGM),
    now: () => Date.now(),
    randomId: () => foundry.utils.randomID(16),
    clock: () => getClock(),
    userExists: id => Boolean(game.users?.get(id)),
    // No log to read is no answer: nothing is marked deleted then.
    messageExists: id => (game.messages ? game.messages.has(id) : true),
    clean: html => cleanNoticeHtml(html),
    text: html => keptWords(html),
    storage: {
        read: () => game.settings?.storage?.get?.("client")?.getItem?.(`${MODULE_ID}.${SETTINGS.noticeHistory}`) ?? null,
        write: value => game.settings.set(MODULE_ID, SETTINGS.noticeHistory, value),
        /* Straight into the client storage, under the key and in the JSON `read` takes back: `game.settings.set` is
           async, and whether Foundry 14's writes the item before its first await is not read here. */
        writeNow: value => game.settings.storage.get("client").setItem(`${MODULE_ID}.${SETTINGS.noticeHistory}`, JSON.stringify(value))
    },
    timers: { set: (fn, ms) => setTimeout(fn, ms), clear: handle => clearTimeout(handle) },
    log: { warn: (...a) => warn(...a), debug: (...a) => debug(...a) }
});

/**
 * Keep one notice in this browser's history: the one road into it for E81's recorder (C3) and direct
 * calls (C4), and for E18, E50, E62 and E70 after it, which take this interface as it is.
 */
export const recordNotice = entry => engine.record(entry);
/** Move a kept notice: its state as its card closes, its snapshot while the card is on screen (popup.mjs, E81 C3). */
export const updateNotice = (id, patch) => engine.update(id, patch);
/** This login's notices, oldest first (the window, E81 C7). */
export const noticeEntries = () => engine.entries();
/** Whether the history is saved, or kept in memory only, and the text that says so. */
export const noticeHistoryStatus = () => engine.status();
/** Run `fn` whenever this login's history changes here or in another tab (the window and the badge, E81 C7 and C8). */
export const onNoticeHistoryChange = fn => engine.onChange(fn);
/** How many notices are unread: a count, the one thing of the history the tile's button carries (E81 C8, popup.mjs `ensureNoticeTile`). */
export const noticeUnread = () => engine.unread();
/** Read every unread notice (the window, E81 C7); answers how many moved. */
export const markNoticesRead = () => engine.markRead();
/** Clear this login's history (the window's Clear, after its question, E81 C7). */
export const clearNoticeHistory = () => engine.clear();
/** Whether a notice is kept for this page only, never written (the window's tag, E81 C7). */
export const noticeSessionOnly = id => engine.sessionOnly(id);
/** Suite only (tests.mjs, beside `gmStoreHold`): while held the history is kept in memory and the setting is not written; awaited, the hold has written what was waiting. */
export const holdNoticeHistory = on => engine.hold(on);

/**
 * A browser's "this origin's storage is full": `QuotaExceededError`, by its name or by its legacy code 22, and
 * Firefox's older `NS_ERROR_DOM_QUOTA_REACHED`, code 1014 (E81 fix r1-G2, review round 1's O17). Which of them a
 * current Firefox throws is not measured here (LIVE).
 */
const storageFull = err => err?.name === "QuotaExceededError" || err?.name === "NS_ERROR_DOM_QUOTA_REACHED"
    || err?.code === 22 || err?.code === 1014;

/**
 * GIVING WAY (E81 C6). A store of the module whose write `err` stopped calls this before it gives up: on a
 * full storage the history gives its room back (`drpgStorageFull`, answered by the engine's `giveWay`
 * before this returns) and the answer is true - the caller then writes once more, and only once; on any
 * other error nothing happens and the answer is false. The callers are the private cards (secret.mjs
 * `write`), every GM store (gm-store.mjs's flush, the Remnant and Truth Bullet ledgers among them, through
 * the engine's `keepRoom`) and the drawn rolls kept readable (private-rolls.mjs `keepReadable`). How a
 * real Foundry 14 hands a full storage back from `game.settings.set` is not measured here: the harness's
 * jsdom throws the DOMException this reads.
 */
export function keepRoom(err) {
    if (!storageFull(err)) return false;
    Hooks.callAll("drpgStorageFull");
    return true;
}

/*
 * THE WITHDRAW OPTION (E81 C5; the A7 design's P5-0). The module's own option on a chat deletion
 * that takes a card back: `message.delete({ [MODULE_ID]: { withdraw: true } })`, at the two places
 * that do (murder-rules.mjs `undoLastCrisis`, a rerolled action's old outcome; incident-store.mjs
 * `retireOpeningNotices`, the opening's request cards). The rule is the other way round from the
 * obvious one - remove on a deletion, keep on Clear chat - because Foundry 14.365 takes `deleteAll`
 * out of the options before the hook (client-backend.mjs:439, :466; the design's reading of Foundry's
 * file, not this repository's, and on a real 14.x LIVE-E81-11), so a cleared log and the reset's
 * batches (season-setup.mjs `deleteMessages`) reach the hook as single deletions do. Only the option
 * removes an entry; every other deletion leaves it, marked `deleted`. Registered by
 * `registerNoticeHistory` on `deleteChatMessage`, after the popups' own hook has taken the card off
 * the screen (popup.mjs `onDeleteChatMessage`).
 * ONLY A GM'S (E81 fix r1-G3, 12.10.2026; review round 1's O13): the option was honoured from any
 * deletion, and the security review measured in the harness that a player deleting their own public card
 * with it took the entry out of the GM's and another player's history. The option counts now only when
 * the deleter Foundry names to the hook is a GM - the two places above run on a GM's client; a player's
 * deletion with it is any other deletion. Whether Foundry 14 lets a player delete a message they wrote
 * is not measured here (the harness lets them; not tried at a table): this holds either way.
 */
export function noticeCardDeleted(message, options, userId) {
    return engine.deleted(message?.id, { withdraw: options?.[MODULE_ID]?.withdraw === true && fromGm(userId) });
}

/* Whether a change to a card came from a GM: `userId` is the hook's own, which Foundry supplies with the
   deletion or the update - never a field of the document or of the options. */
function fromGm(userId) {
    return Boolean(game.users?.get(userId ?? "")?.isGM);
}

/**
 * A chat card changed after it was shown (E81 C5; the A7 design's P5-1): a Reroll's mark on the card it
 * replaced (`rerolled`, reroll.mjs `markReplacedCard`) or a GM's ruling on a call (`settled`, gm-bridge.mjs
 * `settleCall`). A mark is one of a closed list; what the card showed is not drawn again from it.
 * Two roads, one handler each. A card that is not private carries its mark on its document, written by a
 * GM's update: `noticeCardChanged`, on `updateChatMessage`. A private card's mark travels in the meta that
 * comes with its words: `noticeSecretStored`, on `drpgSecretStored`.
 * ONLY A GM'S (E81 fix r1-G3, 12.10.2026; review round 1's O14, F2 and GV2): at C5 one handler read both
 * roads through `cardFlag`, which answers with the document's flag first, so a player's update of their own
 * card - measured by the security review in the harness - marked the entry settled or rerolled in the GM's
 * history and another player's, and so did any later update of a card a player had created with the flag.
 * An update marks now only when the user Foundry names to the hook is a GM and the update's own changes
 * set the flag; the private road reads the meta alone, which a player's packet cannot fill with either
 * mark on another browser (secret.mjs `GM_META`). A player's own write still changes their card; it marks
 * nobody's history.
 */
export function noticeCardChanged(message, changes, options, userId) {
    if (!fromGm(userId)) return false;
    const set = key => Boolean(foundry.utils.getProperty(changes ?? {}, `flags.${MODULE_ID}.${key}`));
    const value = set("rerolled") ? "rerolled" : set(MESSENGER_FLAGS.settled) ? "settled" : null;
    return value ? engine.mark(message?.id, value) : false;
}

/** A private card's words and meta stored on this browser (secret.mjs `remember`): its mark, from the meta alone. */
export function noticeSecretStored(message) {
    const value = cardMeta(message, "rerolled") ? "rerolled" : cardMeta(message, MESSENGER_FLAGS.settled) ? "settled" : null;
    return value ? engine.mark(message?.id, value) : false;
}

/**
 * A notice's time of day as the module's language writes it. The interface E66 takes over: its date
 * helper replaces this body, and every caller keeps the call.
 */
export function noticeTime(at) {
    return new Intl.DateTimeFormat(moduleLanguage(), { hour: "2-digit", minute: "2-digit" }).format(new Date(at));
}

/**
 * Called from `init`, after the popups: the history opens at `ready` (the clock, and so the epoch, is
 * read then), follows another tab's writes, the clock's resets and what becomes of a chat card after it
 * was shown (E81 C5), gives way to the module's other stores (E81 C6), and writes what waits at once when the page hides - a reload right after a card
 * would otherwise lose it to the debounce. Whether Foundry 14's client setting reaches localStorage
 * before `pagehide` returns is the design's reading of Foundry's client-settings.mjs, not measured
 * here (LIVE-E81-03). The window's keybinding (E81 C7) has no default key, as the safeword's has none
 * (safeword.mjs): a key the module chose would be one a table already uses for something else. The
 * window is imported when the key is pressed, so this file imports nothing that draws.
 */
export function registerNoticeHistory() {
    try {
        game.keybindings.register(MODULE_ID, "noticeHistory", {
            name: "DRPG.Notices.title", hint: "DRPG.Notices.keybindingHint", editable: [],
            onDown: () => { void import("./notice-history-app.mjs").then(m => m.openNotices()); return true; },
            restricted: false, precedence: CONST.KEYBINDING_PRECEDENCE?.NORMAL ?? 1
        });
    } catch (err) { error("Could not register the notice history's keybinding", err); }
    Hooks.once("ready", () => engine.open());
    Hooks.on("updateSetting", setting => {
        if (setting?.key === `${MODULE_ID}.${SETTINGS.clock}`) engine.checkEpoch();
    });
    Hooks.on("deleteChatMessage", noticeCardDeleted);
    Hooks.on("updateChatMessage", noticeCardChanged);
    Hooks.on("drpgSecretStored", noticeSecretStored);
    Hooks.on("drpgStorageFull", () => { engine.giveWay(); });
    window.addEventListener("storage", event => {
        if (event.key === `${MODULE_ID}.${SETTINGS.noticeHistory}`) engine.external();
    });
    window.addEventListener("pagehide", () => { void engine.flush(); });
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") void engine.flush();
    });
}
