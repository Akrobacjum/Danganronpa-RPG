/**
 * Danganronpa RPG - the notice history window: every card this browser showed this login, to read again.
 * ---------------------------------------------------------------------------
 * WHY (E81 C7, A7; audit S16-08). notice-history.mjs keeps what was shown (C1-C6); this is
 * where it is read. Opened by the keybinding `noticeHistory` (no default key, as the
 * safeword's) and `game.drpg.openNotices()`; the corner button on the notices tile is E81 C8.
 *
 * WHAT IT DOES NOT DO. It never shows a card again: no `showPopup`, no sound, no chat
 * message - an entry is a `<details class="drpg-notice-entry">`, never a `.drpg-popup`, which
 * is the class the scenarios count cards by. R296 holds this to opening the window and
 * expanding every entry, and reads this file for the calls.
 *
 * HOW A KEPT CARD IS DRAWN. Only through `noticeSnapshot` (notice-history.mjs), lazily when an
 * entry is opened, remembered by id: the stored string goes into a template, through both
 * cleaning steps again, and in by `importNode`. The title, the text, the author, the time and
 * the search's highlight are text nodes, so nothing a stored value says is parsed here as
 * markup (R294's window half; the census rows `WINDOW notice-history-app.mjs#window#*`).
 * "Open conversation" hands `openMessenger` the entry's `link.messenger`, which the store's read
 * has already held to an existing user, and nothing else.
 *
 * THE LOOK is the module's windows of today and small on purpose: E44's window kit takes the
 * chips, the empty state and the scroll signal over, and with them this file's CSS block
 * (danganronpa.css, stained-glass.css and narrow.css, each marked for E44).
 */

import { plural } from "./utils.mjs";
import { alreadyOpen, keepLive } from "./live.mjs";
import { clockSummary } from "./clock.mjs";
import { openMessenger } from "./messenger-app.mjs";
import {
    NOTICE_TEXTS, noticeEntries, noticeSnapshot, noticeTime, noticeHistoryStatus, onNoticeHistoryChange,
    markNoticesRead, clearNoticeHistory, noticeSessionOnly
} from "./notice-history.mjs";

const WINDOW_CLASS = "drpg-window-notices";
/* The design's figure (P10-1) for the wait between a keystroke and the search; not a measurement. */
const SEARCH_MS = 150;

/** The chips, single choice: which sources each one shows (`null`: every one). Keys spelled out, so R1 reads them. */
const FILTERS = Object.freeze([
    { id: "all", label: "DRPG.Notices.filter.all", sources: null },
    { id: "forYou", label: "DRPG.Notices.filter.forYou", sources: ["mine"] },
    { id: "announcements", label: "DRPG.Notices.filter.announcements", sources: ["public", "summary", "safeword"] },
    { id: "players", label: "DRPG.Notices.filter.players", sources: ["player"] },
    { id: "notDone", label: "DRPG.Notices.filter.notDone", sources: ["notDone"] },
    { id: "evidence", label: "DRPG.Notices.filter.evidence", sources: ["evidence"] },
    { id: "messenger", label: "DRPG.Notices.filter.messenger", sources: ["messenger"] }
]);

/** What an entry's glyph says it came from (its hint), and the tag the sources that say it nowhere else carry. */
const SOURCE_LABELS = Object.freeze({
    mine: "DRPG.Notices.filter.forYou", public: "DRPG.Notices.filter.announcements", player: NOTICE_TEXTS.source.player,
    messenger: "DRPG.Notices.filter.messenger", evidence: "DRPG.Notices.filter.evidence", summary: NOTICE_TEXTS.source.summary,
    safeword: "DRPG.Safeword.banner", notDone: NOTICE_TEXTS.source.notDone
});
const TAGGED = new Set(["player", "messenger", "evidence", "summary", "notDone"]);
const STATE_LABELS = Object.freeze({ open: "DRPG.Notices.state.shown", unread: "DRPG.Notices.state.unread" });

const localize = key => game.i18n.localize(key);

/** Search folding: decomposed, the marks dropped, lower case. "Gęślą" folds to "gesla"; "ł" has no decomposition and stays "ł" (node, 12.10.2026). */
const fold = text => String(text ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * `text` with every match of the folded `query` wrapped in `<mark>`, built from text nodes only: the
 * folded string is matched, and each folded character remembers the stretch of the original it came from.
 */
function highlighted(text, query) {
    const out = document.createDocumentFragment();
    const source = String(text ?? "");
    if (!query) {
        out.append(source);
        return out;
    }
    let folded = "", offset = 0;
    const starts = [], ends = [];
    for (const char of source) {
        const piece = fold(char);
        for (let i = 0; i < piece.length; i++) {
            starts.push(offset);
            ends.push(offset + char.length);
        }
        folded += piece;
        offset += char.length;
    }
    let last = 0;
    for (let at = folded.indexOf(query); at >= 0; at = folded.indexOf(query, at + query.length)) {
        const from = starts[at], to = ends[at + query.length - 1];
        if (from > last) out.append(source.slice(last, from));
        const mark = document.createElement("mark");
        mark.textContent = source.slice(from, to);
        out.append(mark);
        last = to;
    }
    if (last < source.length) out.append(source.slice(last));
    return out;
}

const clockKey = clock => JSON.stringify([clock.chapter, clock.day, clock.session, clock.timeOfDay, clock.eclipse]);

function element(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
}

class NoticeHistoryApp extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS = {
        id: "drpg-notices",
        classes: ["drpg-panel", WINDOW_CLASS],
        window: {
            icon: "fa-solid fa-clock-rotate-left",
            resizable: false,
            minimizable: true
        },
        position: { width: 420 }
    };

    /*
     * WHERE IT OPENS. 420 px wide, never wider than the screen less 8 px a side, at the top and
     * centred. The design asks that it start clear of the notices tile (bottom left), the Legacy
     * stack under the clock and the three corner buttons; whether this start is clear of each is
     * a question of a laid-out screen, not answered here (R299 skips headless) - a table's.
     */
    constructor(options = {}) {
        const width = Math.min(420, window.innerWidth - 16);
        super(foundry.utils.mergeObject({
            position: { width, top: 8, left: Math.max(8, Math.round((window.innerWidth - width) / 2)) }
        }, options));
        this.filter = "all";
        this.query = "";
        this.byId = new Map();
        this.drawn = new Set();
        this.snapshots = new Map();
        this.live = null;
        this.unlisten = null;
        this.stale = false;
        this.wired = false;
    }

    get title() {
        return localize("DRPG.Notices.title");
    }

    async _renderHTML(_context, _options) {
        const root = element("div", "drpg-notices-body");

        const chips = element("div", "drpg-notices-chips");
        chips.setAttribute("role", "toolbar");
        chips.setAttribute("aria-label", localize("DRPG.Notices.title"));
        for (const filter of FILTERS) {
            const chip = element("button", "", localize(filter.label));
            chip.type = "button";
            chip.dataset.drpgFilter = filter.id;
            chip.setAttribute("aria-pressed", String(filter.id === this.filter));
            chip.append(element("b"));
            chips.append(chip);
        }

        const search = element("div", "drpg-notices-search");
        const input = element("input");
        input.type = "search";
        input.placeholder = localize("DRPG.Notices.search");
        input.setAttribute("aria-label", localize("DRPG.Notices.searchLabel"));
        search.append(input);

        const banner = element("div", "drpg-notices-banner");
        banner.append(element("span"));
        const read = element("button", "", localize("DRPG.Notices.markRead"));
        read.type = "button";
        read.dataset.drpgDo = "markRead";
        banner.append(read);

        const pill = element("button", "drpg-notices-new", localize("DRPG.Notices.newPill"));
        pill.type = "button";
        pill.dataset.drpgDo = "showNew";
        pill.hidden = true;

        const foot = element("footer", "drpg-notices-foot");
        const clear = element("button", "", localize("DRPG.Notices.clear"));
        clear.type = "button";
        clear.dataset.drpgDo = "clear";
        const notes = element("div", "drpg-notices-notes");
        notes.append(element("p", "", localize(game.user?.isGM ? "DRPG.Notices.gmNote" : "DRPG.Notices.kept")));
        notes.append(element("p", "drpg-notices-unsaved"));
        foot.append(clear, notes);

        root.append(chips, search, banner, pill, this.buildList(), foot);
        this.syncChrome(root);
        return root;
    }

    _replaceHTML(result, content, _options) {
        content.replaceChildren(result);
    }

    _onRender(_context, _options) {
        this.live?.();
        this.live = keepLive(this, { region: ".drpg-notices-list", build: () => this.buildList(), after: list => this.dressList(list) });
        this.unlisten ??= onNoticeHistoryChange(() => this.changed());
        if (this.wired) return;
        this.wired = true;
        const root = this.element;
        const searched = foundry.utils.debounce(value => {
            this.query = fold(value.trim());
            this.redraw();
        }, SEARCH_MS);
        root.addEventListener("click", event => this.onClick(event));
        root.addEventListener("input", event => {
            if (event.target?.matches?.(".drpg-notices-search input")) searched(event.target.value);
        });
        root.addEventListener("keydown", event => {
            if (event.key !== "Escape" || !event.target?.matches?.(".drpg-notices-search input") || !event.target.value) return;
            // Esc empties the search before it closes the window: the first press is the reader's "never mind".
            event.preventDefault();
            event.stopPropagation();
            event.target.value = "";
            this.query = "";
            this.redraw();
        });
        // `toggle` does not bubble; caught on the way down, for every entry the list will ever hold.
        root.addEventListener("toggle", event => {
            if (event.target?.matches?.("details.drpg-notice-entry") && event.target.open) this.expand(event.target);
        }, true);
        root.addEventListener("focusout", event => {
            const list = root.querySelector(".drpg-notices-list");
            if (this.stale && !(event.relatedTarget && list?.contains(event.relatedTarget))) this.redraw();
        });
    }

    async _onClose(options) {
        this.live?.();
        this.live = null;
        this.unlisten?.();
        this.unlisten = null;
        // Closing the window reads what it listed (P10-3): the badge (E81 C8) counts what nobody has looked at yet.
        markNoticesRead();
        return super._onClose?.(options);
    }

    onClick(event) {
        const chip = event.target.closest?.("[data-drpg-filter]");
        if (chip && !chip.disabled) {
            this.filter = chip.dataset.drpgFilter;
            this.redraw();
            return;
        }
        const what = event.target.closest?.("[data-drpg-do]")?.dataset.drpgDo;
        if (what === "markRead") markNoticesRead();
        else if (what === "showNew") {
            this.redraw();
            const list = this.element?.querySelector(".drpg-notices-list");
            if (list) list.scrollTop = 0;
        } else if (what === "clear") void this.askClear();
        else if (what === "conversation") {
            const id = event.target.closest("details.drpg-notice-entry")?.dataset.drpgKey;
            const userId = this.byId.get(id)?.link?.messenger;
            if (userId) openMessenger(userId);
        }
    }

    /** The list and the chrome around it, drawn again now: the reader asked (a chip, the search) or nothing is in the way. */
    redraw() {
        this.stale = false;
        this.live?.refresh?.();
        if (this.element) this.syncChrome(this.element);
    }

    /*
     * THE HISTORY MOVED (this tab or another). The counts follow at once; the list is drawn again
     * unless the reader is in it: scrolled down or with focus inside, a list that jumped would take
     * their place away, so new entries wait behind the pill and a change to the drawn ones waits
     * until focus leaves the list.
     */
    changed() {
        const root = this.element;
        if (!root?.isConnected) return;
        const list = root.querySelector(".drpg-notices-list");
        const focused = Boolean(list?.contains(document.activeElement));
        const fresh = noticeEntries().some(entry => !this.drawn.has(entry.id));
        if (fresh && list && (focused || list.scrollTop > 0)) {
            root.querySelector(".drpg-notices-new").hidden = false;
            this.syncChrome(root);
        } else if (focused) {
            this.stale = true;
            this.syncChrome(root);
        } else this.redraw();
    }

    /** The chips' counts, the unread banner and the foot, from the history as it is now. */
    syncChrome(root) {
        const all = noticeEntries();
        const empty = all.length === 0;
        for (const chip of root.querySelectorAll("[data-drpg-filter]")) {
            const filter = FILTERS.find(f => f.id === chip.dataset.drpgFilter);
            const count = filter.sources ? all.filter(entry => filter.sources.includes(entry.source)).length : all.length;
            chip.querySelector("b").textContent = String(count);
            chip.disabled = filter.id !== "all" && count === 0;
            if (chip.disabled && this.filter === filter.id) this.filter = "all";
        }
        for (const chip of root.querySelectorAll("[data-drpg-filter]")) chip.setAttribute("aria-pressed", String(chip.dataset.drpgFilter === this.filter));
        root.querySelector(".drpg-notices-search input").disabled = empty;
        const unread = all.filter(entry => entry.state === "unread").length;
        const banner = root.querySelector(".drpg-notices-banner");
        banner.hidden = unread === 0;
        banner.querySelector("span").textContent = unread ? plural("DRPG.Notices.unreadBanner", { n: unread }) : "";
        root.querySelector('[data-drpg-do="clear"]').disabled = empty;
        const note = noticeHistoryStatus().note;
        const unsaved = root.querySelector(".drpg-notices-unsaved");
        unsaved.textContent = note ? localize(note) : "";
        unsaved.hidden = !note;
    }

    /** The list region (`keepLive` swaps it): newest first, in groups by the time of day, older chapters folded. */
    buildList() {
        const all = noticeEntries();
        this.byId = new Map(all.map(entry => [entry.id, entry]));
        this.drawn = new Set(this.byId.keys());
        const pill = this.element?.querySelector(".drpg-notices-new");
        if (pill) pill.hidden = true;
        const list = element("div", "drpg-notices-list");
        if (!all.length) {
            list.append(element("p", "drpg-notices-empty", localize("DRPG.Notices.empty")));
            return list;
        }
        const sources = FILTERS.find(f => f.id === this.filter)?.sources ?? null;
        const shown = all.filter(entry => (!sources || sources.includes(entry.source))
            && (!this.query || fold(`${entry.title}\n${entry.text}`).includes(this.query))).reverse();
        if (!shown.length) {
            list.append(element("p", "drpg-notices-empty", localize("DRPG.Notices.noMatch")));
            return list;
        }
        const latest = Math.max(...all.map(entry => entry.clock.chapter));
        let into = list, chapter = null, group = null;
        for (const entry of shown) {
            if (entry.clock.chapter < latest && entry.clock.chapter !== chapter) {
                chapter = entry.clock.chapter;
                const count = shown.filter(other => other.clock.chapter === chapter).length;
                into = element("details", "drpg-notices-fold");
                into.dataset.drpgKey = `chapter-${chapter}`;
                into.append(element("summary", "", game.i18n.format("DRPG.Notices.chapterFold", { chapter, n: count })));
                list.append(into);
                group = null;
            }
            const key = clockKey(entry.clock);
            if (key !== group) {
                group = key;
                into.append(element("h3", "drpg-notices-group", clockSummary(entry.clock)));
            }
            into.append(this.entryElement(entry));
        }
        return list;
    }

    /** What a rebuilt list needs that markup cannot carry: the entries `keepLive` opened again get their snapshot back. */
    dressList(list) {
        for (const details of list.querySelectorAll("details.drpg-notice-entry[open]")) this.expand(details);
    }

    entryElement(entry) {
        const details = element("details", `drpg-notice-entry drpg-src-${entry.source}`);
        if (entry.tone) details.classList.add(`drpg-tone-${entry.tone}`);
        if (entry.state === "unread") details.classList.add("is-unread");
        if (entry.mark === "deleted") details.classList.add("is-deleted");
        details.dataset.drpgKey = entry.id;

        const summary = element("summary");
        const glyph = element("span", "drpg-notice-glyph");
        glyph.setAttribute("role", "img");
        glyph.setAttribute("aria-label", localize(SOURCE_LABELS[entry.source]));
        glyph.dataset.tooltip = localize(SOURCE_LABELS[entry.source]);
        const title = element("span", "drpg-notice-title");
        title.append(highlighted(entry.title, this.query));
        summary.append(glyph, title);
        // No time on a safeword's entry: when somebody stopped the scene is not the table's to read (P4-0).
        if (entry.source !== "safeword") summary.append(element("span", "drpg-notice-time", noticeTime(entry.at)));
        const text = element("span", "drpg-notice-text");
        text.append(highlighted(entry.text, this.query));
        summary.append(text);

        const tags = [];
        if (STATE_LABELS[entry.state]) tags.push(localize(STATE_LABELS[entry.state]));
        if (entry.mark) tags.push(localize(NOTICE_TEXTS.mark[entry.mark]));
        if (noticeSessionOnly(entry.id)) tags.push(localize("DRPG.Notices.sessionOnly"));
        if (TAGGED.has(entry.source)) tags.push(localize(SOURCE_LABELS[entry.source]));
        const author = entry.author ? game.users?.get(entry.author)?.name : null;
        if (author) tags.push(author);
        if (tags.length) {
            const line = element("span", "drpg-notice-tags");
            for (const tag of tags) line.append(element("span", "", tag));
            summary.append(line);
        }
        details.append(summary);
        return details;
    }

    /** An entry opened: what its card showed, drawn by the history's one road and remembered by id, and the way to its thread. */
    expand(details) {
        if (details.querySelector(".drpg-notice-more")) return;
        const entry = this.byId.get(details.dataset.drpgKey);
        if (!entry) return;
        const more = element("div", "drpg-notice-more");
        if (entry.html) {
            let kept = this.snapshots.get(entry.id);
            if (kept?.html !== entry.html) {
                kept = { html: entry.html, node: noticeSnapshot(entry.html) };
                this.snapshots.set(entry.id, kept);
            }
            more.append(kept.node);
        }
        if (entry.clipped) more.append(element("p", "drpg-notice-clipped", localize(NOTICE_TEXTS.clipped)));
        if (entry.link?.messenger) {
            const open = element("button", "drpg-notice-conversation", localize("DRPG.Notices.openConversation"));
            open.type = "button";
            open.dataset.drpgDo = "conversation";
            more.append(open);
        }
        details.append(more);
    }

    /** Clear, asked first, with Cancel the default: a cleared history does not come back, and it holds the murder's cards too. */
    async askClear() {
        const answer = await foundry.applications.api.DialogV2.wait({
            window: { title: localize("DRPG.Notices.clearTitle") },
            classes: ["drpg-panel", "drpg-narrow"],
            content: `<p>${foundry.utils.escapeHTML(localize("DRPG.Notices.clearBody"))}</p>`,
            buttons: [
                { action: "cancel", label: localize("DRPG.Advance.cancel"), default: true },
                { action: "clear", label: localize("DRPG.Notices.clearYes") }
            ],
            rejectClose: false
        });
        if (answer === "clear") clearNoticeHistory();
    }
}

/** Open the notice history, or raise it if it is open: the keybinding, `game.drpg.openNotices()` and (E81 C8) the tile's button. */
export async function openNotices() {
    const open = alreadyOpen(WINDOW_CLASS);
    if (open) return open;
    return new NoticeHistoryApp().render({ force: true });
}
