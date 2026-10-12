/**
 * Danganronpa RPG - the notice history: what this browser showed this user, kept to the season's reset.
 * ---------------------------------------------------------------------------
 * WHY (E81, A7; audit S16-08). A card closed was a card gone: a player who clicked a
 * whisper away, or reloaded, could not read again what the module had told them. The
 * owner's answers (07.10 and 11.10.2026): the GM has the same history (Q0), it lasts to
 * the season's reset (Q1), and on a browser several accounts share every account's
 * history stays in the one value until that reset (Q9, "Bierzemy alternatywę").
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
 * direct calls and `sayNotDone` are C4, the marks C5, giving way to the other stores C6 and
 * the window C7. What is here:
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
 *   again only through `noticeSnapshot`, which cleans the stored string a second time.
 *
 * WHAT ANOTHER LOGIN CAN READ. Every account's section is in one value of this browser's
 * storage, so anybody at this browser's console reads every section in it, a GM's and a
 * killer's included. The owner accepted that on 11.10.2026 (Q9); the GM's handbook is to
 * say so (E81 C15), and the window (E81 C7) is to draw only this login's section.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS, getClock, moduleLanguage } from "./settings.mjs";
import { debug, warn } from "./utils.mjs";
import { cleanCardHtml } from "./secret.mjs";

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

/** Where an entry came from (the A7 design, P1-1). `author` is kept only for "player". */
export const NOTICE_SOURCES = Object.freeze(["mine", "public", "player", "messenger", "evidence", "summary", "safeword", "notDone"]);
const STATES = ["open", "read", "unread"];
const MARKS = [null, "rerolled", "settled", "deleted"];

/**
 * The reset groups whose cut moves the epoch (the A7 design, 1c): a reset that clears the clock, the
 * incident, the cards or the rest of the chat log ends what the history is a history of; one that clears
 * only, say, the remnants does not. R297 holds each to a key of `RESET_GROUPS` (season-exceptions.mjs).
 */
export const EPOCH_GROUPS = Object.freeze(["clock", "incident", "cards", "chatRest"]);

/** The texts an entry or the store's state carries; the window (E81 C7) draws them. */
export const NOTICE_TEXTS = Object.freeze({ notSaved: "DRPG.Notices.notSaved", clipped: "DRPG.Notices.clipped" });

/*
 * THE BUDGETS (the A7 design, 1a), in characters of JSON. An entry is at most 10 000 with
 * at most 8 000 of html, a day summary 26 000 with 24 000 (a GM's summary table reaches
 * 26 000 characters, the design's reading); an entry over its limit keeps its title and
 * text and drops the html (`clipped`). A player's section keeps 250 entries and 200 000
 * characters, a GM's 150 and 100 000; the whole value 500 000. A section holds at most 4
 * full day summaries (E37 gives one at every boundary of a time of day), and at most 40
 * cards from each player author. None of these is a measurement of a browser's quota:
 * localStorage is shared with the private cards and the GM stores, and C6 is to make the
 * history give way to them when it runs out.
 */
const BUDGET = Object.freeze({
    title: 200, text: 600,
    entry: 10000, entryHtml: 8000, summary: 26000, summaryHtml: 24000,
    player: Object.freeze({ entries: 250, chars: 200000 }),
    gm: Object.freeze({ entries: 150, chars: 100000 }),
    total: 500000, perAuthor: 40, fullSummaries: 4
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
 * or a window. 62 at E81 C2 (12.10.2026); R294 runs the same grep and fails on a difference, so a
 * class a card body gains is either added here or drawn bare in the window.
 */
export const NOTICE_CLASSES = Object.freeze([
    "chapter", "drpg-briefing-block", "drpg-briefing-facts", "drpg-briefing-instruction", "drpg-checkbox",
    "drpg-choice", "drpg-choice-details", "drpg-choice-list", "drpg-choice-text", "drpg-day-summary",
    "drpg-duality", "drpg-duality-badge", "drpg-duality-die", "drpg-duality-formula", "drpg-duality-mod",
    "drpg-duality-op", "drpg-duality-result", "drpg-duality-stat", "drpg-duality-total",
    "drpg-evidence-card", "drpg-evidence-comment", "drpg-evidence-hint", "drpg-evidence-name",
    "drpg-evidence-text", "drpg-evidence-who", "drpg-gm-reference", "drpg-gm-route", "drpg-item-effect",
    "drpg-objection-banner", "drpg-objection-block", "drpg-objection-live", "drpg-objection-log",
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
    return Boolean(url) && /^https?:$/.test(url.protocol) && url.origin === addressOf("")?.origin;
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
        if (tag === "a" && !linkAllowed(node)) {
            node.replaceWith(node.ownerDocument.createTextNode(node.textContent));
            continue;
        }
        let el = node;
        /* An element parsed with `is` keeps it past `removeAttribute`: the serializer writes the element's own
           "is value" back out, and R294's first run (12.10.2026, the harness's jsdom) read `is="r294-div"` in a
           stored snapshot. The HTML standard's serializer says the same of a browser; not measured in one. A
           fresh element of the tag has no is value. */
        if (el.hasAttribute("is")) {
            el = node.ownerDocument.createElement(tag);
            for (const attr of node.attributes) if (attr.name !== "is") el.setAttribute(attr.name, attr.value);
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
    const content = inertTree(html, gm).content;
    for (const el of content.querySelectorAll("*")) if (WORD_BREAKS.has(el.localName)) el.after(" ");
    return content.textContent.replace(/\s+/g, " ").trim();
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
 * userExists(id), clean(html) -> the html as it may be kept (the module's engine: `cleanNoticeHtml`),
 * text(html) -> the words of html `clean` gave back (optional: without it an entry keeps the text its caller gave),
 * storage { read() -> the stored value as JSON text or null, write(value) -> Promise },
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
        if (raw.source === "player" && ID.test(raw.author)) entry.author = raw.author;
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
     * Another tab's copy of this login's section into this one: the union by id (this tab's copy of an
     * entry both hold wins), one entry per message and source (the newest), nothing at or before the
     * last Clear and nothing buried; tombstones older than ten minutes let go.
     */
    function mergeInto(into, theirs) {
        if (theirs) {
            into.clearedAt = Math.max(into.clearedAt, theirs.clearedAt);
            for (const [id, at] of Object.entries(theirs.gone)) into.gone[id] = Math.max(into.gone[id] ?? 0, at);
            const ids = new Set(into.entries.map(entry => entry.id));
            for (const entry of theirs.entries) if (!ids.has(entry.id)) into.entries.push(entry);
        }
        const now = env.now();
        for (const [id, at] of Object.entries(into.gone)) if (now - at > TOMBSTONE_MS) delete into.gone[id];
        const newest = new Map();
        for (const entry of into.entries) {
            if (entry.messageId === null) continue;
            const pair = `${entry.messageId}|${entry.source}`;
            if (!newest.has(pair) || newest.get(pair).at <= entry.at) newest.set(pair, entry);
        }
        into.entries = into.entries
            .filter(entry => entry.at > into.clearedAt && !Object.hasOwn(into.gone, entry.id)
                && (entry.messageId === null || newest.get(`${entry.messageId}|${entry.source}`) === entry))
            .sort((a, b) => a.at - b.at);
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
        /* Newest first, so the oldest of an author over 40 go. */
        const kept = new Map(), drop = new Set();
        for (let i = section.entries.length - 1; i >= 0; i--) {
            const entry = section.entries[i];
            if (entry.source !== "player" || !entry.author) continue;
            const n = (kept.get(entry.author) ?? 0) + 1;
            kept.set(entry.author, n);
            if (n > BUDGET.perAuthor) drop.add(entry);
        }
        if (drop.size) section.entries = section.entries.filter(entry => !drop.has(entry));
        const cap = env.isGM() ? BUDGET.gm : BUDGET.player;
        if (section.entries.length > cap.entries) section.entries.splice(0, section.entries.length - cap.entries);
        let size = sizeOf(section);
        while (size > cap.chars && section.entries.length) size -= sizeOf(section.entries.shift()) + 1;
    }

    /**
     * The whole value over 500 000: other worlds' sections go first, the least recently written first;
     * then this world's other accounts' sections, the same way (the A7 design, 1b); then this login's
     * oldest entries.
     */
    function trimValue(value) {
        let size = sizeOf(value);
        if (size <= BUDGET.total) return;
        const world = env.worldId();
        const byTouched = (a, b) => num(a[1]?.touched) - num(b[1]?.touched);
        const others = Object.entries(value.sections).filter(([key]) => key !== ownKey);
        for (const [key] of [...others.filter(([key]) => worldOfKey(key) !== world).sort(byTouched),
            ...others.filter(([key]) => worldOfKey(key) === world).sort(byTouched)]) {
            if (size <= BUDGET.total) return;
            delete value.sections[key];
            size = sizeOf(value);
        }
        while (size > BUDGET.total && mine.entries.length) {
            size -= sizeOf(mine.entries.shift()) + 1;
            value.sections[ownKey] = mine;
        }
    }

    /* ------------------------------- writing ------------------------------ */

    /** The value as it is written: this login's section without what this page keeps for itself (`persist: "session"`). */
    function forStorage(sections) {
        const own = sections[ownKey];
        if (!sessionOnly.size || !own) return sections;
        return { ...sections, [ownKey]: { ...own, entries: own.entries.filter(entry => !sessionOnly.has(entry.id)) } };
    }

    function schedule() {
        if (held || !saving || timer !== null) return;
        timer = env.timers.set(() => { timer = null; void flush(); }, DEBOUNCE_MS);
    }

    /**
     * Read the stored value afresh, clear what the epoch ended, merge this login's section in, keep the
     * budgets and write. This login's section missing from the value (another account's write, or a
     * console) is written again from memory. A write that throws drops the oldest quarter and tries once
     * more; a second failure keeps the history in memory for the rest of the session (`status`), with no
     * notification: the window's footer says it (E81 C7).
     */
    async function flush() {
        if (timer !== null) { env.timers.clear(timer); timer = null; }
        if (!opened || held || !saving) return;
        if (flushing) { again = true; return flushing; }
        flushing = (async () => {
            const value = readValue();
            if (value.newer) {
                saving = false;
                env.log.warn("The notice history is stored in a newer format by another build; this one keeps it in memory only.");
                changed();
                return;
            }
            applyEpoch(value);
            if (mine.epoch !== epochNow()) mine = emptySection();
            const theirs = normalizeSection(value.sections[ownKey]);
            mergeInto(mine, theirs?.epoch === mine.epoch ? theirs : null);
            trimSection(mine);
            mine.touched = env.now();
            value.sections[ownKey] = mine;
            trimValue(value);
            for (let attempt = 0; ; attempt++) {
                try {
                    await env.storage.write({ v: FORMAT, sections: forStorage(value.sections) });
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
        for (const entry of atReady ? mine.entries : []) {
            if (entry.state !== "open") continue;
            entry.state = "unread";
            dirty = true;
        }
        for (const entry of pending.splice(0)) add(entry);
        if (dirty) schedule();
        changed();
    }

    function add(entry) {
        if (mine.epoch !== epochNow()) mine = emptySection();
        /* `at <= clearedAt` is what a merge refuses, so nothing recorded after a Clear may share its millisecond. */
        entry.at = Math.max(entry.at, mine.clearedAt + 1);
        if (entry.messageId !== null) mine.entries = mine.entries.filter(e => e.messageId !== entry.messageId || e.source !== entry.source);
        mine.entries.push(entry);
        trimSection(mine);
        schedule();
    }

    /**
     * Keep one notice (E81 C3 and C4 call it; the entry's shape is the A7 design's P1-1). `id`, `at` and
     * `clock` are this client's: `at` is `Date.now()` here whatever the caller passes, never a packet's
     * (the lesson of E02-D08). The html is kept as `env.clean` hands it back (E81 C2), and a cleaner that
     * throws keeps the notice without it: a history error never stops a card. Answers the entry's id, or
     * null for an entry the shape refuses.
     */
    function record(input = {}) {
        const clock = env.clock() ?? {};
        const { html, text } = keep(input.html, input.text) ?? { html: "", text: input.text };
        const entry = normalizeEntry({
            id: env.randomId(), at: env.now(), messageId: input.messageId ?? null, kind: input.kind ?? "info", tone: input.tone ?? null,
            source: input.source, state: input.state ?? "open", mark: null, title: input.title, text, html,
            clipped: false, author: input.author, link: input.link,
            clock: { chapter: clock.chapter, day: clock.day, session: clock.session, timeOfDay: clock.timeOfDay, eclipse: clock.eclipse }
        });
        if (!entry) {
            env.log.debug("A notice the history's shape refuses was not kept", input);
            return null;
        }
        if (input.persist === "session") sessionOnly.add(entry.id);
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
        const at = list.findIndex(entry => entry.id === id);
        if (at < 0) return false;
        let next = { ...list[at] };
        if (STATES.includes(patch.state)) next.state = patch.state;
        if (patch.html !== undefined) {
            const kept = keep(patch.html);
            if (kept) next = fit({ ...next, html: kept.html, text: clip(str(kept.text), BUDGET.text), clipped: false });
        }
        if (JSON.stringify(next) === JSON.stringify(list[at])) return false;
        list[at] = next;
        if (mine) schedule();
        changed();
        return true;
    }

    return {
        open,
        record,
        update,
        flush,
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
        /** Take one entry out (E81 C5's withdraw): a tombstone, so another tab's copy does not bring it back. */
        remove(id) {
            if (!mine || !mine.entries.some(entry => entry.id === id)) return false;
            mine.gone[id] = env.now();
            mine.entries = mine.entries.filter(entry => entry.id !== id);
            schedule();
            changed();
            return true;
        },
        /** Another tab wrote the value (the `storage` event): its copy of this login's section merged in, nothing written. */
        external() {
            if (!opened) return;
            const value = readValue();
            const theirs = normalizeSection(value.sections[ownKey]);
            if (mine.epoch !== epochNow()) mine = emptySection();
            mergeInto(mine, theirs?.epoch === mine.epoch ? theirs : null);
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
         * until the hold is let go; let go, the memory is what the setting holds, and whatever a test
         * recorded meanwhile is forgotten.
         */
        hold(on) {
            if (on) {
                const waiting = !held && (timer !== null || flushing) ? flush() : null;
                held++;
                return waiting ?? Promise.resolve();
            }
            if (held && !--held && opened) open({ atReady: false });
            return Promise.resolve();
        },
        status: () => ({ saving, note: saving ? null : NOTICE_TEXTS.notSaved }),
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
    clean: html => cleanNoticeHtml(html),
    text: html => keptWords(html),
    storage: {
        read: () => game.settings?.storage?.get?.("client")?.getItem?.(`${MODULE_ID}.${SETTINGS.noticeHistory}`) ?? null,
        write: value => game.settings.set(MODULE_ID, SETTINGS.noticeHistory, value)
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
/** Suite only (tests.mjs, beside `gmStoreHold`): while held the history is kept in memory and the setting is not written; awaited, the hold has written what was waiting. */
export const holdNoticeHistory = on => engine.hold(on);

/**
 * A notice's time of day as the module's language writes it. The interface E66 takes over: its date
 * helper replaces this body, and every caller keeps the call.
 */
export function noticeTime(at) {
    return new Intl.DateTimeFormat(moduleLanguage(), { hour: "2-digit", minute: "2-digit" }).format(new Date(at));
}

/**
 * Called from `init`, after the popups: the history opens at `ready` (the clock, and so the epoch, is
 * read then), follows another tab's writes and the clock's resets, and writes what waits at once when
 * the page hides - a reload right after a card would otherwise lose it to the debounce. Whether Foundry
 * 14's client setting reaches localStorage before `pagehide` returns is the design's reading of
 * Foundry's client-settings.mjs, not measured here (LIVE-E81-03).
 */
export function registerNoticeHistory() {
    Hooks.once("ready", () => engine.open());
    Hooks.on("updateSetting", setting => {
        if (setting?.key === `${MODULE_ID}.${SETTINGS.clock}`) engine.checkEpoch();
    });
    window.addEventListener("storage", event => {
        if (event.key === `${MODULE_ID}.${SETTINGS.noticeHistory}`) engine.external();
    });
    window.addEventListener("pagehide", () => { void engine.flush(); });
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") void engine.flush();
    });
}
