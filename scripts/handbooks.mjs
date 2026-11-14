/**
 * Danganronpa RPG - the handbooks, one click from the corner.
 * ---------------------------------------------------------------------------
 * The third button in the bottom-right corner (Dawid, 22.09). Until E81 C12 it
 * was the smallest of the three, level with the seam between the chat circle
 * and the settings one; on the corner's grid it is 44 px like the settings
 * button, at the wall on the bottom line beside it, under the chat's right half
 * (`--drpg-launcher-book` and `--drpg-launch-b-bottom`, danganronpa.css; E81
 * fix r2-H4 restated this from them). It opens the Student Brochure and the Player Handbook for
 * everybody, and the GM Handbook for a GM, in the language this page was built in
 * (`pageLanguage`, settings.mjs's since E66 C1 and re-exported by i18n.mjs): the module's language as this browser had it at its
 * last load.
 *
 * The text is the Markdown in docs/handbooks, the same files the repository
 * shows, so there is one copy to keep up to date rather than two. They ship in
 * module.zip for this (see .gitattributes) and are rendered by the showdown
 * converter Foundry already loads for its own journal pages.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS, getSetting, setSetting } from "./settings.mjs";
import { pageLanguage } from "./i18n.mjs";
import { alreadyOpen } from "./live.mjs";
import { error, markLanguage } from "./utils.mjs";
import { DrpgApp, kitTabBar, wireKitTabs } from "./ui-kit.mjs";

const LAUNCHER_ID = "drpg-book-launcher";
const WINDOW_CLASS = "drpg-handbook";

/** In the order a new player should read them. `gm` marks the one a player is not shown. */
const BOOKS = [
    { id: "player-brochure", label: "DRPG.Handbooks.brochure" },
    { id: "player-handbook", label: "DRPG.Handbooks.player" },
    { id: "gm-handbook", label: "DRPG.Handbooks.gm", gm: true }
];

/*
 * THE BOOK LAST READ, KEPT FOR THE BROWSER (E51 C8, 31.10.2026; E51-46; Q6's default). It was a variable of the page,
 * so an F5 opened the Student Brochure again whatever was being read. A client setting now (`handbookBook`, not in the
 * settings window), written when a tab is pressed or a caller names a book, never by a window that only opened: a book
 * no longer there, or the GM's on a player's browser, opens the first.
 */
function storedBook() {
    try {
        return getSetting(SETTINGS.handbookBook) || null;
    } catch {
        return null;
    }
}

function rememberBook(id) {
    if (!id || storedBook() === id) return;
    try {
        setSetting(SETTINGS.handbookBook, id)?.catch?.(err => error("Could not remember the handbook", err));
    } catch (err) {
        error("Could not remember the handbook", err);
    }
}

/** The book a window opens on: `wanted` if this user may open it, else the first. */
export function openingBook(wanted = storedBook(), user = game.user) {
    return booksFor(user).some(book => book.id === wanted) ? wanted : BOOKS[0].id;
}

export function registerHandbooks() {
    // Mounted like the two launchers beside it: at `ready`, and again on
    // every canvas draw, because Foundry rebuilds the body's furniture.
    Hooks.once("ready", renderBookLauncher);
    Hooks.on("canvasReady", () => renderBookLauncher());
}

/** The books this user may open. */
export function booksFor(user = game.user) {
    return BOOKS.filter(book => !book.gm || user?.isGM);
}

/* The page's language, not the setting's (E51-45): after a declined reload the window's tabs are in the page's, and
   so is every book it loads. A language with no file is not one `pageLanguage` answers (en or pl). */
export function handbookPath(id, lang = pageLanguage()) {
    return `modules/${MODULE_ID}/docs/handbooks/${id}.${lang}.md`;
}

/* ==========================================================================
 *  The text
 * ========================================================================== */

const rendered = new Map();

/** The converter on its own, for the suite: Markdown in, the viewer's HTML out. */
export function markdownToHtml(markdown) {
    return toHtml(markdown);
}

/**
 * One handbook as HTML: fetched and converted once per session and language.
 */
export function handbookHtml(id, lang = pageLanguage()) {
    const key = `${id}.${lang}`;
    if (!rendered.has(key)) {
        const path = handbookPath(id, lang);
        const pending = fetch(path)
            .then(response => {
                if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
                return response.text();
            })
            .then(toHtml);
        // A failure is not kept: the next click asks again.
        pending.catch(() => rendered.delete(key));
        rendered.set(key, pending);
    }
    return rendered.get(key);
}

/*
 * THE BOXES ARE GITHUB'S ALERTS (Dawid, 22.09: "boxy na informacje").
 * `> [!TIP]` on a line of its own opens one, on GitHub and here alike, so the
 * files need no second syntax for the game. The keyword stays English in both
 * languages - GitHub knows only these five - and the title the reader sees is
 * the module's own, in the module's language.
 */
const CALLOUTS = {
    NOTE: "fa-circle-info",
    TIP: "fa-lightbulb",
    IMPORTANT: "fa-circle-exclamation",
    WARNING: "fa-triangle-exclamation",
    CAUTION: "fa-hand"
};
const CALLOUT_MARK = /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i;

/** A blockquote that opens with `[!KIND]` becomes a titled box; any other stays a quote. */
function calloutsIn(root) {
    for (const quote of root.querySelectorAll("blockquote")) {
        const first = quote.querySelector(":scope > p");
        const lead = first?.firstChild;
        if (lead?.nodeType !== Node.TEXT_NODE) continue;
        const match = lead.textContent.match(CALLOUT_MARK);
        if (!match) continue;
        const kind = match[1].toUpperCase();
        lead.textContent = lead.textContent.slice(match[0].length);
        // showdown keeps the marker's line break as a `<br>` when the box goes on
        // in the same paragraph; the title already stands on its own line.
        if (!lead.textContent && first.firstChild === lead) lead.remove();
        if (first.firstChild?.nodeName === "BR") first.firstChild.remove();
        if (!first.textContent.trim() && !first.children.length) first.remove();

        const box = document.createElement("aside");
        box.className = `drpg-callout drpg-callout-${kind.toLowerCase()}`;
        const title = document.createElement("p");
        title.className = "drpg-callout-title";
        const icon = document.createElement("i");
        icon.className = `fa-solid ${CALLOUTS[kind]}`;
        icon.setAttribute("inert", "");
        title.append(icon, game.i18n.localize(`DRPG.Handbooks.callout.${kind.toLowerCase()}`));
        box.append(title, ...quote.childNodes);
        quote.replaceWith(box);
    }
}

/*
 * TWO QUOTES, NOT ONE. GitHub ends a quote at a blank line; showdown carries on into
 * the next quote after it, so two boxes one under the other came out as one box with
 * both texts in it (R111 caught it, 22.09). A comment on the blank line ends the quote
 * for showdown too, and renders as nothing.
 */
function endQuotes(markdown) {
    const lines = markdown.split(/\r?\n/);
    const out = [];
    for (let i = 0; i < lines.length; i++) {
        out.push(lines[i]);
        if (!/^\s*>/.test(lines[i])) continue;
        let j = i + 1;
        while (j < lines.length && !lines[j].trim()) j++;
        if (j > i + 1 && j < lines.length && /^\s*>/.test(lines[j])) out.push("", "<!-- -->");
    }
    return out.join("\n");
}

/*
 * THE SECTIONS' ANCHORS (E57 C4a, 13.11.2026; D35: a "?" opens the handbook on its section, by a section number
 * shared by EN and PL). Not ids - the headings take none, for the reason under NO IDS AT ALL below - but an attribute
 * Foundry looks nothing up by, `data-drpg-section`, by tools/handbook-facts.mjs's rule for a section, so an anchor and
 * a facts file's `s<section>` name the same place: a "## " heading's leading number ("## 9. Rooms" is "9"), or that
 * heading's place among the "## " headings where it has none (the brochure's seven are "1" to "7"); a "### " heading
 * only when it is numbered ("### 9.1 Rooms and Room Setup" is "9.1"), the player handbook's unnumbered ones none. A
 * number met again keeps its first heading. The Polish books are written line for line beside the English ones, so
 * the two give one list (R4720 reads the six files).
 */
const SECTION_ATTR = "data-drpg-section";

/** Anchor the sections of a rendered book (or any root holding its headings); answers how many it anchored. */
export function markSections(root) {
    const seen = new Set();
    let place = 0;
    for (const heading of root.querySelectorAll("h2, h3")) {
        const title = heading.textContent.trim();
        let section = null;
        if (heading.tagName === "H2") {
            place += 1;
            section = /^(\d+)\./.exec(title)?.[1] ?? String(place);
        } else {
            section = /^(\d+\.\d+)(?!\d)/.exec(title)?.[1] ?? null;
        }
        if (!section || seen.has(section)) continue;
        seen.add(section);
        heading.setAttribute(SECTION_ATTR, section);
    }
    return seen.size;
}

/** The heading of `section` in a book's text, or null. */
export function sectionHeading(text, section) {
    if (section === null || section === undefined || section === "") return null;
    const wanted = String(section);
    return [...(text?.querySelectorAll?.(`[${SECTION_ATTR}]`) ?? [])].find(h => h.getAttribute(SECTION_ATTR) === wanted) ?? null;
}

/* One reckoning for the contents list and a section asked by name: the heading 8 px under the text's top, from the
   two boxes (fillContents' comment says why not `scrollIntoView`). */
function scrollToHeading(text, heading) {
    const top = text.scrollTop + heading.getBoundingClientRect().top - text.getBoundingClientRect().top;
    text.scrollTop = top - 8;
}

/** Scroll a book's text to `section`; answers its heading, or null (and the text not moved) where it has none. */
export function goToSection(text, section) {
    const heading = sectionHeading(text, section);
    if (heading) scrollToHeading(text, heading);
    return heading;
}

/*
 * "SECTION N" REFERENCES ARE JUMPS (E57 C4; the owner's 26.09 note to D35: they become clickable "by the same mechanism"
 * as the "?"). A reference is "section", "sections" or a form of the Polish "sekcja" before a section number, in the
 * text a reader reads - not in code, a heading, a link or the contents list. It becomes an entry with no href, for
 * fillContents' reason (Foundry opens any a[href] in a new tab), that goes to the section with goToSection. Only the
 * number right after the word is a jump ("sections 6 and 7" makes 6 one); a number the book has no section for stays
 * text and is listed (`unknown`). Measured 14.11.2026: every reference of the six books names a section of its own book
 * (R6602), so a jump never needs another book.
 */
const SECTION_REFERENCE = /\b(sections?|sekcj(?:a|i|ę|ą|e|ach|ami|om))(\s+)(\d+(?:\.\d+)?)(?![\d.]*\d)/giu;

/** The "section N" references of a book's Markdown, in order, with the book's own sections as `sections` (a Set). */
export function sectionReferences(markdown) {
    const sections = new Set();
    const refs = [];
    let place = 0, fence = false;
    for (const line of String(markdown).split(/\r?\n/)) {
        if (/^\s*(```|~~~)/.test(line)) { fence = !fence; continue; }
        if (fence) continue;
        const h2 = /^## (.+)$/.exec(line), h3 = /^### (\d+\.\d+)(?!\d)/.exec(line);
        if (h2) { place += 1; sections.add(/^(\d+)\./.exec(h2[1])?.[1] ?? String(place)); continue; }
        if (h3) { sections.add(h3[1]); continue; }
        if (/^#{1,6} /.test(line)) continue;
        for (const m of line.replace(/`[^`]*`/g, "").matchAll(SECTION_REFERENCE)) refs.push(m[3]);
    }
    return Object.assign(refs, { sections });
}

/** Make a rendered book's references jumps; answers how many it made and the numbers it found no section for. */
export function linkSections(text) {
    const out = { linked: 0, unknown: [] };
    if (!text) return out;
    /* SHOW_TEXT is 4 (DOM Level 2); the harness's page has no NodeFilter global, a browser has. */
    const walker = document.createTreeWalker(text, globalThis.NodeFilter?.SHOW_TEXT ?? 4);
    const nodes = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.parentElement?.closest("code, pre, a, h1, h2, h3, h4, .drpg-handbook-toc")) nodes.push(node);
    }
    for (const node of nodes) {
        const value = node.nodeValue;
        const matches = [...value.matchAll(SECTION_REFERENCE)];
        if (!matches.length) continue;
        const parts = document.createDocumentFragment();
        let at = 0;
        for (const m of matches) {
            const section = m[3];
            if (!sectionHeading(text, section)) { out.unknown.push(section); continue; }
            parts.append(value.slice(at, m.index));
            const link = document.createElement("a");
            link.setAttribute("role", "link");
            link.tabIndex = 0;
            link.className = "drpg-section-link";
            link.dataset.drpgGoto = section;
            link.textContent = m[0];
            const go = event => {
                event.preventDefault();
                event.stopPropagation();
                goToSection(text, section);
            };
            link.addEventListener("click", go);
            link.addEventListener("keydown", event => { if (event.key === "Enter") go(event); });
            parts.append(link);
            at = m.index + m[0].length;
            out.linked += 1;
        }
        if (!at) continue;
        parts.append(value.slice(at));
        node.replaceWith(parts);
    }
    return out;
}

function toHtml(markdown) {
    const Converter = globalThis.showdown?.Converter;
    if (!Converter) return `<pre>${foundry.utils.escapeHTML(markdown)}</pre>`;
    markdown = endQuotes(markdown);
    const html = new Converter({
        tables: true,
        strikethrough: true,
        literalMidWordUnderscores: true,
        openLinksInNewWindow: true,
        noHeaderId: true
    }).makeHtml(markdown);
    /*
     * NO IDS AT ALL. showdown names things after their text, and a section or
     * a column called "Chat" or "Players" would hand the page a second `#chat`
     * or `#players`, which Foundry looks its own up by. `noHeaderId` covers the
     * headings and not the tables: the Player Handbook still came out with 72
     * `th` ids (22.09). The contents list holds the headings themselves, so
     * nothing here needs one.
     */
    const template = document.createElement("template");
    template.innerHTML = html;
    for (const element of template.content.querySelectorAll("[id]")) element.removeAttribute("id");
    markSections(template.content);
    calloutsIn(template.content);
    // Wide tables scroll inside their own box rather than widening the text.
    for (const table of template.content.querySelectorAll("table")) {
        const wrap = document.createElement("div");
        wrap.className = "drpg-handbook-table";
        table.replaceWith(wrap);
        wrap.append(table);
    }
    return template.innerHTML;
}

/* ==========================================================================
 *  The window
 * ========================================================================== */

/*
 * ON THE KIT'S FRAME (E21 C6a, 07.11.2026). A `DrpgApp` (ui-kit.mjs): `drpg-ui` on the root, the window held to the screen
 * less 8 px a side, and the book's two columns (`.drpg-handbook-main`) the kit's region - the contents list and the text
 * scroll inside it, each on its own, as before. Until C6a Stained Glass held the window to the height it was opened or
 * resized to through `--drpg-window-h`, which `_onPosition` mirrored (22.09: the 70 KB book came out 1038 px tall with its
 * foot off the screen); the frame's `max-height` does that now in both themes, and the two rules went with the mirror.
 * Under Stained Glass the window is as tall as the screen less 16 px once a book is in it (the glass's `height: auto`),
 * not the 760 px it was asked for: not seen at a table.
 */
class HandbookApp extends DrpgApp() {
    static DEFAULT_OPTIONS = {
        id: "drpg-handbooks",
        classes: ["drpg-panel", WINDOW_CLASS],
        window: {
            icon: "fa-solid fa-book-open",
            resizable: true,
            minimizable: true
        },
        position: { width: 900, height: 760 },
        scrollRegion: ".drpg-handbook-main"
    };

    constructor(options = {}) {
        const { section = null, ...rest } = options;
        // Never taller or wider than the screen it opens on.
        super(foundry.utils.mergeObject({
            position: {
                width: Math.min(900, window.innerWidth - 40),
                height: Math.min(760, window.innerHeight - 60)
            }
        }, rest));
        this.book = openingBook(rest.book ?? storedBook());
        this.ticket = 0;
        /* The section the window was last asked for, where it landed (null: nowhere, the text at its top), the book
           whose text stands in it, and the promise of the last `show` (E57 C4a; R4722 reads all four). */
        this.sectionAsked = section;
        this.landed = null;
        this.loaded = null;
        this.shown = null;
    }

    get title() {
        return game.i18n.localize("DRPG.Handbooks.title");
    }

    async _renderHTML(_context, _options) {
        const root = document.createElement("div");
        root.className = "drpg-handbook-body drpg-kit-content";

        // The kit's bar (E44 C4a): one tab a book, no pane of its own - `show` fills the one text below.
        const bar = document.createElement("template");
        bar.innerHTML = kitTabBar(booksFor().map(book => ({ key: book.id, label: game.i18n.localize(book.label) })),
            { active: this.book });
        const tabs = bar.content.firstElementChild;

        const main = document.createElement("div");
        main.className = "drpg-handbook-main";
        const toc = document.createElement("nav");
        toc.className = "drpg-handbook-toc";
        toc.setAttribute("aria-label", game.i18n.localize("DRPG.Handbooks.contents"));
        const text = document.createElement("article");
        text.className = "drpg-handbook-text";
        main.append(toc, text);

        root.append(tabs, main);
        return root;
    }

    async _replaceHTML(result, content, _options) {
        content.replaceChildren(result);
    }

    _onRender(context, options) {
        super._onRender(context, options);
        wireKitTabs(this.element, { onSwitch: id => { this.shown = this.show(id, { remember: true }); } });
        this.shown = this.show(this.book, { section: this.sectionAsked });
    }

    /**
     * Put one book in the window, at `section` when one is asked (E57 C4a). A click on another tab mid-fetch wins; a
     * press is remembered (`remember`). A section asked of the book already in the window moves its text and fetches
     * nothing. Answers the heading it landed on, or null.
     */
    async show(id, { remember = false, section = null } = {}) {
        if (section !== null) this.sectionAsked = String(section);
        if (id === this.book && id === this.loaded && section !== null) {
            const text = this.element.querySelector(".drpg-handbook-text");
            const heading = goToSection(text, section);
            this.landed = heading ? String(section) : null;
            return heading;
        }
        this.book = id;
        this.loaded = null;
        this.landed = null;
        if (remember) rememberBook(id);
        for (const button of this.element.querySelectorAll('nav.drpg-tabs > button[role="tab"][data-drpg-tab-key]')) {
            button.setAttribute("aria-selected", String(button.dataset.drpgTabKey === id));
        }
        const text = this.element.querySelector(".drpg-handbook-text");
        const toc = this.element.querySelector(".drpg-handbook-toc");
        const ticket = ++this.ticket;
        text.textContent = game.i18n.localize("DRPG.Handbooks.loading");
        toc.replaceChildren();

        let html;
        try {
            html = await handbookHtml(id);
        } catch (err) {
            error("Could not load a handbook", err);
            if (ticket === this.ticket) text.textContent = game.i18n.localize("DRPG.Handbooks.failed");
            return null;
        }
        if (ticket !== this.ticket || !text.isConnected) return null;
        text.innerHTML = html;
        text.scrollTop = 0;
        fillContents(toc, text);
        linkSections(text);
        this.loaded = id;
        if (section === null) return null;
        const heading = goToSection(text, section);
        this.landed = heading ? String(section) : null;
        return heading;
    }
}

/**
 * The contents list: one entry per section and subsection.
 *
 * It scrolls the text itself rather than calling `scrollIntoView`, which
 * scrolls every ancestor that can scroll - and Foundry's `overflow: hidden`
 * body and interface are among them. By the two boxes rather than by
 * `offsetTop`, which is only relative to the text while nothing between them
 * is positioned.
 *
 * NO `href` (E27, 24.09.2026; audit S12-01, Dawid's "switching opens a new
 * tab"). An entry used to be `<a href="#">` whose handler called only
 * `preventDefault()`. Foundry listens for clicks on the whole document
 * (`Game#_onClickHyperlink`), takes any `a[href]` it finds and opens it with
 * `window.open(href, "_blank")` without asking whether the default was
 * prevented - so every entry opened a second full Foundry client in a new tab,
 * reproduced in the sandbox on 23.09. An entry is not navigation, so it has no
 * address to follow; without one it is no longer a link the browser will focus
 * or activate, so it says what it is (`role="link"`), takes the focus
 * (`tabindex`) and answers Enter itself. The propagation stops too, so no other
 * document-wide listener takes the click for something it is not.
 */
export function fillContents(toc, text) {
    for (const heading of text.querySelectorAll("h2, h3")) {
        const link = document.createElement("a");
        link.setAttribute("role", "link");
        link.tabIndex = 0;
        link.className = `drpg-handbook-toc-${heading.tagName.toLowerCase()}`;
        link.textContent = heading.textContent;
        const go = event => {
            event.preventDefault();
            event.stopPropagation();
            scrollToHeading(text, heading);
        };
        link.addEventListener("click", go);
        link.addEventListener("keydown", event => {
            if (event.key === "Enter") go(event);
        });
        toc.append(link);
    }
    toc.hidden = !toc.childElementCount;
}

/**
 * Open the handbooks, on `book` (remembered, as a tab's press is) and at `section` (E57 C4a: a section id as
 * `markSections` gives it, "9" or "9.1", the same in both languages). An open window is handed both; its `shown` is
 * the promise of where it lands. A section the book lacks leaves the text at its top. `remember: false` (E57 C4) opens
 * the book without making it the one the corner's book opens next: a window's "?" (ui-kit.mjs `dressHelp`) shows the
 * GM handbook for that window, which is no choice of a book.
 */
export async function openHandbooks(book = null, { section = null, remember = true } = {}) {
    const open = alreadyOpen(WINDOW_CLASS);
    if (open) {
        if (book || section !== null) open.shown = open.show(book ?? open.book, { remember: Boolean(book) && remember, section });
        return open;
    }
    if (book && remember) rememberBook(book);
    return new HandbookApp({ ...(book ? { book } : {}), ...(section !== null ? { section: String(section) } : {}) }).render({ force: true });
}

/* ==========================================================================
 *  The launcher
 * ========================================================================== */

export function renderBookLauncher() {
    try {
        document.getElementById(LAUNCHER_ID)?.remove();
        if (!game.user) return;

        const button = document.createElement("button");
        button.type = "button";
        button.id = LAUNCHER_ID;
        // Its language, the page's (E66 fix r1 F1; C1's `lang` on the module's containers, STATUS Open 3 and 19).
        markLanguage(button);
        const tip = game.i18n.localize("DRPG.Handbooks.launcherTooltip");
        button.dataset.tooltip = tip;
        button.setAttribute("aria-label", tip);
        // `inert`, like the glyphs of the two buttons beside it: the mask
        // element must never be what the press lands on.
        button.innerHTML = `<i inert></i>`;

        button.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            openHandbooks().catch(err => error("Could not open the handbooks", err));
        });

        document.body.append(button);
    } catch (err) {
        error("Could not render the handbook launcher", err);
    }
}
