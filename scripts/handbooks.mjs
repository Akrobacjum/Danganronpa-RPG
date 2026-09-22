/**
 * Danganronpa RPG - the handbooks, one click from the corner.
 * ---------------------------------------------------------------------------
 * The third button in the bottom-right corner (Dawid, 22.09): the smallest of
 * the three, at the wall, level with the seam between the chat circle and the
 * settings one. It opens the Student Brochure and the Player Handbook for
 * everybody, and the GM Handbook for a GM, in the language this browser chose
 * for the module.
 *
 * The text is the Markdown in docs/handbooks, the same files the repository
 * shows, so there is one copy to keep up to date rather than two. They ship in
 * module.zip for this (see .gitattributes) and are rendered by the showdown
 * converter Foundry already loads for its own journal pages.
 */

import { MODULE_ID } from "./config.mjs";
import { moduleLanguage } from "./settings.mjs";
import { alreadyOpen } from "./live.mjs";
import { error } from "./utils.mjs";

const LAUNCHER_ID = "drpg-book-launcher";
const WINDOW_CLASS = "drpg-handbook";

/** In the order a new player should read them. `gm` marks the one a player is not shown. */
const BOOKS = [
    { id: "player-brochure", label: "DRPG.Handbooks.brochure" },
    { id: "player-handbook", label: "DRPG.Handbooks.player" },
    { id: "gm-handbook", label: "DRPG.Handbooks.gm", gm: true }
];

/** The book this browser last had open, so the button goes back to it. */
let lastBook = BOOKS[0].id;

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

export function handbookPath(id, lang = moduleLanguage()) {
    return `modules/${MODULE_ID}/docs/handbooks/${id}.${lang}.md`;
}

/* ==========================================================================
 *  The text
 * ========================================================================== */

const rendered = new Map();

/** One handbook as HTML: fetched and converted once per session and language. */
export function handbookHtml(id, lang = moduleLanguage()) {
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

function toHtml(markdown) {
    const Converter = globalThis.showdown?.Converter;
    if (!Converter) return `<pre>${foundry.utils.escapeHTML(markdown)}</pre>`;
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
    return template.innerHTML;
}

/* ==========================================================================
 *  The window
 * ========================================================================== */

class HandbookApp extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS = {
        id: "drpg-handbooks",
        classes: ["drpg-panel", WINDOW_CLASS],
        window: {
            icon: "fa-solid fa-book-open",
            resizable: true,
            minimizable: true
        },
        position: { width: 900, height: 760 }
    };

    constructor(options = {}) {
        // Never taller or wider than the screen it opens on.
        super(foundry.utils.mergeObject({
            position: {
                width: Math.min(900, window.innerWidth - 40),
                height: Math.min(760, window.innerHeight - 60)
            }
        }, options));
        this.book = booksFor().some(book => book.id === lastBook) ? lastBook : BOOKS[0].id;
        this.ticket = 0;
    }

    get title() {
        return game.i18n.localize("DRPG.Handbooks.title");
    }

    /*
     * THE HEIGHT, MIRRORED WHERE STAINED GLASS CAN READ IT. That theme sizes
     * every module window to its content (`height: auto !important`), which
     * for a 70 KB handbook is the whole screen and past it: measured 22.09, a
     * window asked for 760 px came out 1038 px tall with its foot off the
     * bottom. stained-glass.css gives this window this variable instead, so it
     * keeps the height it was opened or resized to and the text scrolls.
     */
    _onPosition(position) {
        super._onPosition(position);
        if (Number.isFinite(position?.height)) {
            this.element?.style.setProperty("--drpg-window-h", `${position.height}px`);
        }
    }

    async _renderHTML(_context, _options) {
        const root = document.createElement("div");
        root.className = "drpg-handbook-body";

        const tabs = document.createElement("nav");
        tabs.className = "drpg-gmt-tabs drpg-handbook-tabs";
        for (const book of booksFor()) {
            const button = document.createElement("button");
            button.type = "button";
            button.dataset.drpgBook = book.id;
            button.textContent = game.i18n.localize(book.label);
            tabs.append(button);
        }

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

    _onRender(_context, _options) {
        for (const button of this.element.querySelectorAll("[data-drpg-book]")) {
            button.addEventListener("click", () => this.show(button.dataset.drpgBook));
        }
        this.show(this.book);
    }

    /** Put one book in the window. A click on another tab mid-fetch wins. */
    async show(id) {
        this.book = lastBook = id;
        for (const button of this.element.querySelectorAll("[data-drpg-book]")) {
            const on = button.dataset.drpgBook === id;
            button.classList.toggle("active", on);
            button.setAttribute("aria-pressed", String(on));
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
            return;
        }
        if (ticket !== this.ticket || !text.isConnected) return;
        text.innerHTML = html;
        text.scrollTop = 0;
        fillContents(toc, text);
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
 */
function fillContents(toc, text) {
    for (const heading of text.querySelectorAll("h2, h3")) {
        const link = document.createElement("a");
        link.href = "#";
        link.className = `drpg-handbook-toc-${heading.tagName.toLowerCase()}`;
        link.textContent = heading.textContent;
        link.addEventListener("click", event => {
            event.preventDefault();
            const top = text.scrollTop + heading.getBoundingClientRect().top - text.getBoundingClientRect().top;
            text.scrollTop = top - 8;
        });
        toc.append(link);
    }
    toc.hidden = !toc.childElementCount;
}

export async function openHandbooks(book = null) {
    const open = alreadyOpen(WINDOW_CLASS);
    if (open) {
        if (book) open.show(book);
        return open;
    }
    if (book) lastBook = book;
    return new HandbookApp().render({ force: true });
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
