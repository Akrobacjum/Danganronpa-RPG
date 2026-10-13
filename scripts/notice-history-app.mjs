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
import { clockSummary, clockAfter } from "./clock.mjs";
import { openMessenger } from "./messenger-app.mjs";
import {
    NOTICE_TEXTS, noticeEntries, noticeSnapshot, noticeWords, noticeTime, noticeHistoryStatus, onNoticeHistoryChange,
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

/**
 * Search folding: decomposed, the marks dropped, lower case, and "ł" made "l". "Gęślą" folds to "gesla"; "ł" has no
 * decomposition (node, 12.10.2026), so until E81 fix r2-H1 (review P3) it stayed "ł" and "kolo" missed "koło". The
 * replace is one character for one, after lower case has made "Ł" "ł", so `highlighted`'s offsets hold.
 */
const fold = text => String(text ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/ł/g, "l");

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

/**
 * A GROUP OF THE ECLIPSE IS NAMED FOR THE TIME OF DAY IT OPENS INTO (E77 fix r2-H7, 13.10.2026; the owner, shown
 * "Noon Eclipse" under "Chapter 1 · Day 1 · Session 1 · Morning · ECLIPSE" in H4's shots, chose this over leaving it).
 * An Eclipse runs before the time of day it is named for and the clock moves only when it ends (eclipse.mjs "WHICH
 * ECLIPSE IS THIS ONE"), so the clock a notice came under during one still reads the time of day just finished. Its
 * group names the clock the Eclipse opens into (`clockAfter`: the Eclipse's own word for the time of day, and after
 * Night the next day and session) with the Eclipse's mark. Derived here from the stamp's `timeOfDay` and `eclipse`, which
 * every entry has kept since E81, so a history kept before this commit reads the same way. The group itself is still
 * `clockKey` of the stamp: every entry of one Eclipse in one group, and the time of day after it a group of its own.
 * The clock pane is not this: it keeps `clockSummary` of the clock as it stands.
 */
const groupHeading = clock => clockSummary(clock.eclipse ? { ...clock, ...clockAfter(clock) } : clock);

/** A snapshot's leading heading - its first node with words, when that is an `h1`-`h6` - or null. */
function leadingHeading(snapshot) {
    for (const node of snapshot.childNodes) {
        if (!String(node.textContent ?? "").trim()) continue;
        return /^h[1-6]$/.test(node.localName ?? "") ? node : null;
    }
    return null;
}

const squash = text => String(text ?? "").replace(/\s+/g, "");

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
        this.rows = new Map();
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

        /* THE FOOT HOLDS CLEAR, AND A LINE ONLY WHEN SAVING STOPPED (E77 fix r2-H4, 13.10.2026; the owner's screenshot
           of 1.2.75's window). E81 put a paragraph beside Clear on how long the history keeps a notice and who else
           on the computer can read it - eighteen lines down the GM's window in that screenshot, how the module works
           rather than what happened. The owner had it taken out (the shared computer is a risk he accepted in E81's
           Q9, and the handbooks keep the limits); the line that saving stopped stays, as a state, drawn only when
           `noticeHistoryStatus` says so (`syncChrome`). Scenario 73's phase H reads the foot on a GM and a player. */
        const foot = element("footer", "drpg-notices-foot");
        const clear = element("button", "", localize("DRPG.Notices.clear"));
        clear.type = "button";
        clear.dataset.drpgDo = "clear";
        foot.append(element("p", "drpg-notices-unsaved"), clear);

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
        /* The box as it is when the wait ends, not as it was at the keystroke: Esc empties it inside the wait, and a
           search handed the old value then filtered under an empty box (E81 fix r2-H1, review P1). */
        const searched = foundry.utils.debounce(box => {
            this.query = fold(box.value.trim());
            this.redraw();
        }, SEARCH_MS);
        root.addEventListener("click", event => this.onClick(event));
        root.addEventListener("input", event => {
            if (event.target?.matches?.(".drpg-notices-search input")) searched(event.target);
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
            if (!event.target?.matches?.("details.drpg-notice-entry")) return;
            if (event.target.open) this.expand(event.target);
            this.sayOnce(event.target);
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

    /**
     * The list and the chrome around it, drawn again now: the reader asked (a chip, the search) or nothing is in the way.
     * The chrome first: it moves a filter whose chip fell to 0 back to "all", and a list drawn before that stood under a
     * filter no chip showed pressed (E81 fix r2-H1, review P2).
     */
    redraw() {
        this.stale = false;
        if (this.element) this.syncChrome(this.element);
        this.live?.refresh?.();
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
        /* A filter the chrome moved is the one thing that does not wait for the reader: the list under it is drawn
           again at once, or it would go on listing what a chip no longer pressed chose (E81 fix r2-H1, review P2). */
        if (fresh && list && (focused || list.scrollTop > 0)) {
            root.querySelector(".drpg-notices-new").hidden = false;
            if (this.syncChrome(root)) this.redraw();
        } else if (focused) {
            this.stale = true;
            if (this.syncChrome(root)) this.redraw();
        } else this.redraw();
    }

    /** The chips' counts, the unread banner and the foot, from the history as it is now. Answers whether it moved the filter. */
    syncChrome(root) {
        const was = this.filter;
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
        return this.filter !== was;
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
        // The words the rows show are the words searched: an untitled card's "Notice" is no longer on its row (`rowWords`).
        const shown = all.filter(entry => {
            if (sources && !sources.includes(entry.source)) return false;
            if (!this.query) return true;
            const row = this.rowWords(entry);
            return fold(`${row.title}\n${row.text}`).includes(this.query);
        }).reverse();
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
                into.append(element("h3", "drpg-notices-group", groupHeading(entry.clock)));
            }
            into.append(this.entryElement(entry, this.rowWords(entry)));
        }
        return list;
    }

    /** What a rebuilt list needs that markup cannot carry: the entries `keepLive` opened again get their snapshot back. */
    dressList(list) {
        for (const details of list.querySelectorAll("details.drpg-notice-entry[open]")) {
            this.expand(details);
            this.sayOnce(details);
        }
    }

    /**
     * THE ROW SAYS WHAT THE CARD SAYS, AS THE CARD SAYS IT (E77 fix r2-H4, 13.10.2026; the owner's screenshot of 1.2.75's
     * window, GM view). A card posted without a title of its own - every announcement, the time of day's and an
     * Eclipse's among them - is kept under its kind's word, and its words were read off the card in one run: that row
     * read "Notice" over "Noon Chapter 1 · Day 1 · Session 1 · Noon Every room restocked with search tokens", the title
     * glued to the body and the time of day said twice under a group heading that says it a third time. Such a row takes
     * the card's own heading for its title and leaves it out of its text, and leaves out a block whose words are the
     * clock line the time of day's card prints (`clockSummary` of the clock the notice came under: the group's heading
     * outside an Eclipse, `groupHeading`). Read off
     * the kept html through the history's one road (`noticeSnapshot`) as words only, once per entry and html. An entry
     * with a title of its own, without html (clipped, a request not carried out) or whose card does not open on a
     * heading reads as it was kept: the kept title and text are this browser's record, and nothing here rewrites them.
     */
    rowWords(entry) {
        const kept = { title: entry.title, text: entry.text };
        if (!entry.html || entry.title !== localize(`DRPG.Popup.kind.${entry.kind}`)) return kept;
        const group = clockSummary(entry.clock);
        const seen = this.rows.get(entry.id);
        if (seen?.html === entry.html && seen.group === group) return seen.words;
        const snapshot = noticeSnapshot(entry.html);
        const head = leadingHeading(snapshot);
        let words = kept;
        if (head) {
            const title = noticeWords(head);
            head.remove();
            const blocks = [...snapshot.childNodes].map(node => noticeWords(node)).filter(text => text && text !== group);
            words = { title, text: blocks.join(" ") };
        }
        this.rows.set(entry.id, { html: entry.html, group, words });
        return words;
    }

    /**
     * AN OPEN ENTRY SAYS ITS WORDS ONCE (E77 fix r2-H4; the owner's screenshot: "Noon Eclipse Lights out. Place your
     * token..." on the row and the same words again in the card under it). While the card is open under its row, the
     * row's text gives way when the card holds every word of it; closed, the row shows it again. The card's own leading
     * heading gives way when it is the row's title (`expand`).
     */
    sayOnce(details) {
        const text = details.querySelector(":scope > summary > .drpg-notice-text");
        const copy = details.querySelector(":scope > .drpg-notice-more > .drpg-notice-snapshot");
        if (!text) return;
        text.hidden = Boolean(details.open && copy && squash(text.textContent) && squash(copy.textContent).includes(squash(text.textContent)));
    }

    entryElement(entry, row) {
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
        title.append(highlighted(row.title, this.query));
        summary.append(glyph, title);
        // No time on a safeword's entry: when somebody stopped the scene is not the table's to read (P4-0).
        if (entry.source !== "safeword") summary.append(element("span", "drpg-notice-time", noticeTime(entry.at)));
        if (row.text) {
            const text = element("span", "drpg-notice-text");
            text.append(highlighted(row.text, this.query));
            summary.append(text);
        }

        const tags = [];
        if (STATE_LABELS[entry.state]) tags.push(localize(STATE_LABELS[entry.state]));
        if (entry.mark) tags.push(localize(NOTICE_TEXTS.mark[entry.mark]));
        if (noticeSessionOnly(entry.id)) tags.push(localize("DRPG.Notices.sessionOnly"));
        if (TAGGED.has(entry.source)) tags.push(localize(SOURCE_LABELS[entry.source]));
        /* No name on a safeword's entry either: its card names nobody, and the caller's card with no GM connected
           carries the caller as its author (E81 fix r2-H1, review round 2's C2-1: another player's window drew it).
           The stored author stays - the per-author bound counts it. */
        const author = entry.author && entry.source !== "safeword" ? game.users?.get(entry.author)?.name : null;
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
                const head = leadingHeading(kept.node), title = details.querySelector(":scope > summary > .drpg-notice-title");
                if (head && title && squash(head.textContent) === squash(title.textContent)) head.hidden = true;
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
