/**
 * Danganronpa RPG - the GM's messenger window: the Timeline and every player's conversation in one window.
 * The view the owner first called a console is named the Timeline since their rename of 22.11.2026 ('Przemianujmy
 * nazwe "console" na "timeline"'): what a GM reads says Timeline (Oś czasu); the keys and the code keep `console`.
 * ---------------------------------------------------------------------------
 * WHY (1.2.124, the owner's request OWNER-124-CONSOLE, approved 22.11.2026): "Aktualnie gm musi specjalnie szukac
 * czatu z graczem by cos zatwierdzic. [...] jednego wspolnego czatu, ktory sluzy tylko do wciskania przyciskow na
 * wiadomosciach wysylanych przez akcje. [...] Ta "konsola" musialaby wyswietlac tez ogolnie wszystkie istotne
 * wydarzenia i akcje na biezaco, a takze wiadomosci wszystkich graczy. Musialaby sie tez odswiezac na biezaco (bez
 * otwierania i zamykania okna)", and the change: "Okno gma niech otwiera zupelnie nowe okno. Niech znajduje sie tam
 * konsola, a takze mozliwosc przelaczenia sie na czat z dowolnym graczem. Koniec listy rozwijanej - nowe okno."
 *
 * WHAT IT IS. One window per GM's browser (`current`), opened by the GM's launcher and by every road that opened a GM's
 * thread before (messenger-app.mjs `openMessenger`): a list on the left - Timeline, then every player with the unread
 * badge and the one-line preview the roster showed - and the view chosen on the right.
 *   - A player's view is that player's conversation as the thread window draws it (DrpgMessengerApp, whose class this
 *     extends): the log with live buttons, the send form, the Note tab. What was typed in one player's view is kept for
 *     that player when the GM looks at another (`viewDrafts`).
 *   - The Timeline is two parts: "Waiting for a decision", every card of every player's thread with live ruling
 *     buttons (a card not settled whose words hold a `data-drpg-call` button), and below it one stream in time order of
 *     every player's thread messages and the module's notices this browser was shown (the notice history's entries,
 *     those of a thread's card left out: the card is in the stream already). A filter shows all of it, the actions only
 *     (the thread's action cards and the notices), or one player's.
 *
 * LIVE, ONE NODE AT A TIME. messenger-app.mjs routes each thread event here (`threadMessage`, `threadEdited`,
 * `removeEverywhere`, `refreshNav`), and the notice history's change listener hands new entries; each adds, replaces or
 * removes the one card it is about, and the filter hides nodes rather than drawing them again. The window is rendered
 * whole only when the GM switches the view (and so the send form of the view left is not on screen to keep). A ruling
 * made anywhere - here, in a card, by another GM - reaches every GM as the card's edit, and its settled words leave
 * "Waiting" in every GM's window.
 *
 * NOT IMPORTED BY NAME, HANDED THE BASE (`gmMessengerClass`): messenger-app.mjs imports this file to build the window,
 * so this file importing messenger-app.mjs back would close a static cycle (R161).
 */

import { MESSENGER_FLAGS, THREAD_KIND, threadUsers, isThreadUser, threadStats, threadCardAllowed } from "./messenger.mjs";
import { cardFlag } from "./secret.mjs";
import { noticeEntries, noticeTime, onNoticeHistoryChange } from "./notice-history.mjs";
import { esc, markLanguage } from "./utils.mjs";
import { count } from "./perf-counters.mjs";
import { setTip } from "./ui-kit.mjs";

/** The most items the stream draws when the window opens: the newest, so an evening's chat does not draw at once. */
export const CONSOLE_STREAM_LIMIT = 300;

/**
 * The messenger windows' sizes (E129, the owner's S0-MSGSIZE of 23.11.2026: "powiekszmy cale okno messenger znacznie"):
 * about 40% larger than 1.2.124's 980 x 680 (the GM's) and 544 x 520 (a player's), and never past `viewport` of the
 * screen's width and height. The coordinator's default, pending the owner's word: one constant. Here and not in
 * messenger-app.mjs, which imports this file (R161), so both windows read it. A size dragged by hand is not kept (R8656).
 */
export const MESSENGER_WINDOW_SIZES = Object.freeze({
    gm: Object.freeze({ width: 1370, height: 950 }),
    player: Object.freeze({ width: 760, height: 730 }),
    viewport: 0.9
});

/**
 * The size a messenger window asks for: `kind`'s ("gm" or "player"), each side cut to `viewport` of `screen`'s (this
 * page's by default), in whole pixels. Pure but for the default screen.
 */
export function messengerSize(kind, screen = { width: globalThis.innerWidth, height: globalThis.innerHeight }) {
    const want = MESSENGER_WINDOW_SIZES[kind] ?? MESSENGER_WINDOW_SIZES.player;
    const cap = (side, room) => (Number.isFinite(room) && room > 0 ? Math.min(side, Math.floor(room * MESSENGER_WINDOW_SIZES.viewport)) : side);
    return { width: cap(want.width, screen?.width), height: cap(want.height, screen?.height) };
}

/**
 * The order of the players in the window's list (E129, the owner's S0-MSGSORT of 23.11.2026: "niech osoby od ktorych mamy
 * wiadomosc wyswietlaja sie najwyzej (sortowanie po czasie)"): "recent" - the players with a message first, the newest
 * last message first, then those with none in name order - or "name", the order before E129. The coordinator's default,
 * pending the owner's word: one constant.
 */
export const MESSENGER_LIST_ORDER = "recent";

/**
 * `users` in the list's order, by `stats` (messenger.mjs `threadStats`: a row per thread with its `last` message). Pure.
 * Two last messages at one stamp, and the players with none, stand in name order.
 */
export function navOrder(users, stats, order = MESSENGER_LIST_ORDER) {
    const byName = (a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""));
    if (order !== "recent") return [...users].sort(byName);
    const at = user => {
        const stamp = stats?.get?.(user.id)?.last?.timestamp;
        return Number.isFinite(stamp) ? stamp : null;
    };
    return [...users].sort((a, b) => {
        const ta = at(a), tb = at(b);
        if (ta !== null && tb !== null && ta !== tb) return tb - ta;
        if ((ta === null) !== (tb === null)) return ta === null ? 1 : -1;
        return byName(a, b);
    });
}

/** The filter's values: everything, the actions only, or one player's (`player:<id>`). */
const FILTER_ALL = "all", FILTER_ACTIONS = "actions";

/**
 * The GM's window class, built on the thread window's (`Base`, messenger-app.mjs `DrpgMessengerApp`) with the helpers
 * that draw a card (`buildBubble`) and a one-line preview (`previewOf`), and the position kept (`savePosition`, under the
 * key "gm"; the base's constructor reads it back under the same key).
 */
export function gmMessengerClass(Base, { buildBubble, previewOf, savePosition }) {
    const baseClose = Object.getPrototypeOf(Base.prototype).close;

    return class DrpgGmMessengerApp extends Base {
        /** This browser's one GM window, or null. */
        static current = null;

        static MESSENGER_KIND = "gm";

        static DEFAULT_OPTIONS = {
            classes: ["drpg-messenger", "drpg-messenger-gm"],
            window: { icon: "fa-solid fa-comments", resizable: true, minimizable: true },
            scrollRegion: ".drpg-messenger-log, .drpg-messenger-note, .drpg-console-stream",
            position: { ...MESSENGER_WINDOW_SIZES.gm }
        };

        /** "console", or the player whose conversation is shown. */
        view = "console";

        /** The Timeline's filter (`FILTER_ALL`, `FILTER_ACTIONS`, or "player:<id>"). */
        filter = FILTER_ALL;

        /** What was typed in each player's view, kept while another is shown. */
        viewDrafts = new Map();

        /** The notices the stream holds, by id, so the history's change listener adds only the new. */
        noticesShown = new Set();

        unlistenNotices = null;

        /** The view the window's body was last drawn for (`_replaceHTML`). */
        drawnView = null;

        constructor(view = "console") {
            super("gm");
            this.playerUserId = null;
            this.view = "console";
            this.setView(view, { render: false });
        }

        get title() {
            return game.i18n.localize("DRPG.Messenger.gm.windowTitle");
        }

        /** Show `view` ("console" or a player's id): what the view left held typed is kept for it. */
        setView(view, { render = true } = {}) {
            const next = view === "console" || !isThreadUser(view) ? "console" : view;
            if (this.rendered && this.view !== "console") {
                const chat = this.element?.querySelector(".drpg-messenger-input textarea");
                if (chat) this.drafts.chat = chat.value;
                const note = this.element?.querySelector(".drpg-messenger-note-text");
                if (note) {
                    const typed = note.value !== (note.drpgShown ?? note.value);
                    this.drafts.note = typed ? note.value : null;
                    this.drafts.noteBase = typed ? note.drpgShown : null;
                }
            }
            if (this.view !== "console") this.viewDrafts.set(this.view, this.drafts);
            this.view = next;
            this.playerUserId = next === "console" ? null : next;
            this.drafts = this.viewDrafts.get(next) ?? { chat: "", note: null, noteBase: null };
            if (next !== "console") this.tab = this.viewTabs?.get(next) ?? "chat";
            if (render && this.rendered) this.render();
        }

        async _prepareContext(options) {
            if (this.view === "console") return { console: true };
            return super._prepareContext(options);
        }

        async _renderHTML(context, options) {
            const root = document.createElement("div");
            root.className = "drpg-messenger-gm-body";
            root.append(this.buildNav());
            const main = document.createElement("div");
            main.className = "drpg-messenger-gm-main";
            if (this.view === "console") main.append(this.buildConsole());
            else main.append(await super._renderHTML(context, options));
            root.append(main);
            return root;
        }

        /* The thread window's redraw reads what was typed off the boxes it draws over (messenger-app.mjs `_replaceHTML`,
           CTRL-13). After a change of view those boxes are the last view's, and their words would land in the drafts of
           the view drawn now - a player's draft came back empty from another player's box (R8651, red before this). So a
           redraw for another view clears the old boxes first: `setView` has already kept their words for their own view. */
        async _replaceHTML(result, content, options) {
            if (this.drawnView !== this.view) content.replaceChildren();
            this.drawnView = this.view;
            return super._replaceHTML(result, content, options);
        }

        _onRender(context, options) {
            super._onRender(context, options);
            markLanguage(this.element);
            this.wireNav();
            if (this.view === "console") {
                this.wireConsole();
                this.listenToNotices();
            }
            // The thread window's tab press remembers its tab per player here (Chat or Note).
            if (this.view !== "console") (this.viewTabs ??= new Map()).set(this.view, this.tab);
        }

        /* ------------------------------ the list ------------------------------ */

        buildNav() {
            const nav = document.createElement("nav");
            nav.className = "drpg-messenger-gm-nav";
            nav.setAttribute("aria-label", game.i18n.localize("DRPG.Messenger.gm.navLabel"));
            nav.append(...this.navRows());
            return nav;
        }

        navRows() {
            const stats = threadStats();
            const rows = [];
            const consoleRow = this.navRow("console", game.i18n.localize("DRPG.Messenger.gm.console"),
                game.i18n.localize("DRPG.Messenger.gm.consoleHint"), this.waitingCount());
            consoleRow.classList.add("drpg-messenger-gm-console-row");
            rows.push(consoleRow);
            const players = navOrder(threadUsers(), stats);
            if (!players.length) {
                const none = document.createElement("p");
                none.className = "drpg-messenger-empty";
                none.textContent = game.i18n.localize("DRPG.Messenger.rosterEmpty");
                rows.push(none);
            }
            for (const user of players) {
                const row = stats.get(user.id);
                const preview = row?.last ? previewOf(row.last) : game.i18n.localize("DRPG.Messenger.rosterNoMessages");
                rows.push(this.navRow(user.id, user.name, preview, row?.unread ?? 0));
            }
            return rows;
        }

        navRow(view, name, preview, badge) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "drpg-messenger-gm-nav-row";
            button.dataset.drpgView = view;
            button.setAttribute("aria-pressed", String(this.view === view));
            if (view === "console") setTip(button, "DRPG.Messenger.gm.consoleTip");
            else setTip(button, "DRPG.Messenger.gm.playerTip");
            const text = document.createElement("span");
            text.className = "drpg-messenger-roster-text";
            const who = document.createElement("span");
            who.className = "drpg-messenger-roster-name";
            who.textContent = name;
            const line = document.createElement("span");
            line.className = "drpg-messenger-roster-preview";
            line.textContent = preview;
            text.append(who, line);
            button.append(text);
            /* THE WHOLE PREVIEW IN THE ROW'S TOOLTIP (2.0 line T4, FORGE-07, 27.11.2026). At The Forge (Foundry 14.370; S7,
               docs/dev/v2/F3-forge-PC-2.md) the Timeline row's preview ran 308 px of text in a 179 px box at 1920x1080 (363 at
               2560x1440), in both browsers, cut by an ellipsis S7 counts as an overflow. The preview now takes two lines
               (danganronpa.css, the T4 block), and what is still cut is read in the row's one tooltip, its second line - not
               a second tooltip on the line (`title` beside Foundry's would be two at once). Escaped: Foundry draws a
               `data-tooltip` as markup, and a player's message is a player's words. */
            if (preview && button.dataset.tooltip) button.dataset.tooltip = `${button.dataset.tooltip}<br>${esc(preview)}`;
            if (badge > 0) {
                const mark = document.createElement("span");
                mark.className = "drpg-messenger-badge";
                mark.textContent = badge > 99 ? "99+" : String(badge);
                button.append(mark);
            }
            return button;
        }

        wireNav() {
            this.element?.querySelector(".drpg-messenger-gm-nav")?.addEventListener("click", event => {
                const row = event.target.closest?.("[data-drpg-view]");
                if (!row) return;
                if (row.dataset.drpgView === this.view) return;
                this.setView(row.dataset.drpgView);
            });
        }

        /** The list drawn again from the threads as they stand: a message, a read, a settled ask. The focus kept. */
        refreshNav() {
            const nav = this.element?.querySelector(".drpg-messenger-gm-nav");
            if (!nav) return;
            count("messenger.gmNav");
            const focused = document.activeElement?.closest?.(".drpg-messenger-gm-nav-row")?.dataset.drpgView ?? null;
            const rows = this.navRows();
            nav.replaceChildren(...rows);
            if (focused) rows.find(row => row.dataset?.drpgView === focused)?.focus();
        }

        /* ------------------------------ the console ------------------------------ */

        buildConsole() {
            const wrap = document.createElement("div");
            wrap.className = "drpg-console";

            const bar = document.createElement("div");
            bar.className = "drpg-console-bar";
            const label = document.createElement("label");
            label.className = "drpg-console-filter";
            const words = document.createElement("span");
            words.textContent = game.i18n.localize("DRPG.Messenger.gm.filter");
            const select = document.createElement("select");
            select.name = "drpg-console-filter";
            setTip(select, "DRPG.Messenger.gm.filterTip");
            const options = [[FILTER_ALL, game.i18n.localize("DRPG.Messenger.gm.filterAll")],
                [FILTER_ACTIONS, game.i18n.localize("DRPG.Messenger.gm.filterActions")],
                ...threadUsers().sort((a, b) => a.name.localeCompare(b.name)).map(u => [`player:${u.id}`, u.name])];
            for (const [value, text] of options) {
                const option = document.createElement("option");
                option.value = value;
                option.textContent = text;
                option.selected = option.defaultSelected = value === this.filter;
                select.append(option);
            }
            label.append(words, select);
            bar.append(label);
            wrap.append(bar);

            const scroll = document.createElement("div");
            scroll.className = "drpg-console-scroll";

            const waiting = document.createElement("section");
            waiting.className = "drpg-console-waiting";
            const waitingHead = document.createElement("h3");
            waitingHead.textContent = game.i18n.localize("DRPG.Messenger.gm.waiting");
            const waitingList = document.createElement("div");
            waitingList.className = "drpg-console-waiting-list";
            waiting.append(waitingHead, waitingList);

            const stream = document.createElement("section");
            stream.className = "drpg-console-stream";
            const streamHead = document.createElement("h3");
            streamHead.textContent = game.i18n.localize("DRPG.Messenger.gm.stream");
            const streamList = document.createElement("ol");
            streamList.className = "drpg-console-stream-list";
            stream.append(streamHead, streamList);

            const items = [];
            for (const message of game.messages ?? []) {
                const player = cardFlag(message, MESSENGER_FLAGS.thread);
                // A card another player wrote into this thread is no card of it (messenger.mjs `threadCardAllowed`,
                // line CORE's guard of 1.2.124): not in Waiting, not in the stream.
                if (!player || !isThreadUser(player) || !threadCardAllowed(message)) continue;
                items.push({ at: message.timestamp ?? 0, node: () => this.streamMessage(message, player) });
                const live = this.waitingCard(message, player);
                if (live) waitingList.append(live);
            }
            this.noticesShown = new Set();
            for (const entry of this.consoleNotices()) {
                this.noticesShown.add(entry.id);
                items.push({ at: entry.at, node: () => this.streamNotice(entry) });
            }
            items.sort((a, b) => a.at - b.at);
            for (const item of items.slice(-CONSOLE_STREAM_LIMIT)) streamList.append(item.node());
            count("messenger.consoleBuild");

            scroll.append(waiting, stream);
            wrap.append(scroll);
            this.applyFilterTo(wrap);
            this.showEmpties(wrap);
            return wrap;
        }

        wireConsole() {
            const select = this.element?.querySelector('select[name="drpg-console-filter"]');
            select?.addEventListener("change", () => {
                this.filter = select.value;
                this.applyFilterTo(this.element);
                this.showEmpties(this.element);
            });
            this.scrollConsoleDown();
        }

        /** The notices of this login the stream shows: every one but a thread card's, which the stream holds already. */
        consoleNotices() {
            return noticeEntries().filter(entry => entry.source !== "messenger");
        }

        /** A thread card with live ruling buttons, drawn for "Waiting", or null when it asks nobody now. */
        waitingCard(message, player) {
            if (cardFlag(message, MESSENGER_FLAGS.settled)) return null;
            const bubble = buildBubble(message);
            if (!bubble.querySelector("[data-drpg-call]")) return null;
            // The buttons stand under the card's words, outside them, and the words scroll under a cap
            // (base.css `.drpg-console-card`): a Search's card ran 290-455 px with its buttons last, under the fold
            // of "Waiting" at 1366 x 768 (the owner's shots, 22.11.2026). Moved, not rebuilt: each button keeps the
            // listener wireCallActions gave it. "Awaiting a ruling." goes - the section's own heading says it.
            const text = bubble.querySelector(".drpg-messenger-text");
            if (text) {
                for (const line of text.querySelectorAll(".drpg-call-awaiting")) line.remove();
                for (const actions of text.querySelectorAll(".drpg-call-actions")) text.after(actions);
            }
            const item = document.createElement("div");
            item.className = "drpg-console-card";
            item.dataset.messageId = message.id;
            item.dataset.player = player;
            item.dataset.action = "true";
            item.append(this.itemHead(player, message.timestamp), bubble);
            return item;
        }

        /** A thread message in the stream: its card, its buttons left to "Waiting". */
        streamMessage(message, player) {
            const item = document.createElement("li");
            item.className = "drpg-console-item";
            item.dataset.messageId = message.id;
            item.dataset.player = player;
            item.dataset.at = String(message.timestamp ?? 0);
            item.dataset.action = String(cardFlag(message, MESSENGER_FLAGS.kind) === THREAD_KIND.action);
            const bubble = buildBubble(message);
            for (const actions of bubble.querySelectorAll(".drpg-call-actions")) actions.remove();
            item.append(this.itemHead(player, null), bubble);
            return item;
        }

        /** A notice in the stream: its time, its title and its words. */
        streamNotice(entry) {
            const item = document.createElement("li");
            item.className = "drpg-console-item drpg-console-notice";
            item.dataset.noticeId = entry.id;
            item.dataset.at = String(entry.at);
            item.dataset.action = "true";
            if (entry.author) item.dataset.player = entry.author;
            const head = document.createElement("div");
            head.className = "drpg-console-item-head";
            head.innerHTML = `<span class="drpg-console-kind">${esc(game.i18n.localize("DRPG.Messenger.gm.event"))}</span>`
                + `<span class="drpg-console-time">${esc(noticeTime(entry.at))}</span>`;
            const body = document.createElement("div");
            body.className = "drpg-console-notice-body";
            const title = document.createElement("strong");
            title.textContent = entry.title ?? "";
            const text = document.createElement("span");
            text.textContent = entry.text ?? "";
            body.append(title, text);
            item.append(head, body);
            return item;
        }

        /** Whose thread a card is in, and for "Waiting" when it came. */
        itemHead(player, at) {
            const head = document.createElement("div");
            head.className = "drpg-console-item-head";
            const name = game.users.get(player)?.name ?? "?";
            head.innerHTML = `<span class="drpg-console-thread">${esc(game.i18n.format("DRPG.Messenger.gm.inThread", { player: name }))}</span>`
                + (at ? `<span class="drpg-console-time">${esc(noticeTime(at))}</span>` : "");
            return head;
        }

        /** Hide what the filter leaves out; nothing is drawn again. */
        applyFilterTo(root) {
            const filter = this.filter;
            const player = filter.startsWith("player:") ? filter.slice(7) : null;
            for (const node of root?.querySelectorAll?.(".drpg-console-item, .drpg-console-card") ?? []) {
                const keep = filter === FILTER_ALL ? true
                    : filter === FILTER_ACTIONS ? node.dataset.action === "true"
                    : node.dataset.player === player;
                node.hidden = !keep;
            }
        }

        /** "Nothing waits" and "Nothing yet" where a part shows nothing under the filter. */
        showEmpties(root) {
            for (const [list, key] of [[".drpg-console-waiting-list", "DRPG.Messenger.gm.nothingWaiting"],
                [".drpg-console-stream-list", "DRPG.Messenger.gm.nothingYet"]]) {
                const holder = root?.querySelector?.(list);
                if (!holder) continue;
                const shown = [...holder.children].some(child => !child.hidden && !child.classList.contains("drpg-console-empty"));
                let empty = holder.querySelector(".drpg-console-empty");
                if (!shown && !empty) {
                    empty = document.createElement(holder.tagName === "OL" ? "li" : "p");
                    empty.className = "drpg-console-empty drpg-messenger-empty";
                    empty.textContent = game.i18n.localize(key);
                    holder.append(empty);
                } else if (shown && empty) empty.remove();
            }
        }

        waitingCount() {
            if (this.view === "console" && this.element) return this.element.querySelectorAll(".drpg-console-waiting-list .drpg-console-card").length;
            let n = 0;
            for (const message of game.messages ?? []) {
                const player = cardFlag(message, MESSENGER_FLAGS.thread);
                if (!player || !isThreadUser(player) || !threadCardAllowed(message) || cardFlag(message, MESSENGER_FLAGS.settled)) continue;
                if (cardFlag(message, MESSENGER_FLAGS.gmAsk)) n++;
            }
            return n;
        }

        /* ------------------------------ live ------------------------------ */

        /** A thread's new message: appended where it is shown, the list's badge and preview followed. */
        threadMessage(player, message) {
            if (!this.rendered) return;
            if (this.view === player) this.appendMessage(message);
            else if (this.view === "console") this.consoleAdd(message, player);
            this.refreshNav();
        }

        consoleAdd(message, player) {
            const list = this.element?.querySelector(".drpg-console-stream-list");
            if (!list || !isThreadUser(player)) return;
            count("messenger.consoleAdd");
            if (list.querySelector(`[data-message-id="${message.id}"]`)) return this.threadEdited(player, message);
            this.insertByTime(list, this.streamMessage(message, player));
            const live = this.waitingCard(message, player);
            if (live) this.element.querySelector(".drpg-console-waiting-list")?.append(live);
            this.settleConsole();
        }

        /** A card that changed: drawn again where it stands, and out of "Waiting" once it asks nobody. */
        threadEdited(player, message) {
            if (!this.rendered) return;
            if (this.view === player) this.replaceMessage(message);
            else if (this.view === "console") {
                const old = this.element?.querySelector(`.drpg-console-stream-list [data-message-id="${message.id}"]`);
                if (old) old.replaceWith(this.streamMessage(message, player));
                const waitingList = this.element?.querySelector(".drpg-console-waiting-list");
                const was = waitingList?.querySelector(`[data-message-id="${message.id}"]`);
                const live = this.waitingCard(message, player);
                if (was && live) was.replaceWith(live);
                else if (was) was.remove();
                else if (live) waitingList?.append(live);
                this.settleConsole();
            }
            this.refreshNav();
        }

        /** A message deleted: off the view it is in, whichever. */
        removeEverywhere(messageId) {
            if (!this.rendered || !messageId) return;
            if (this.view === "console") {
                for (const node of this.element?.querySelectorAll(`.drpg-console [data-message-id="${messageId}"]`) ?? []) node.remove();
                this.settleConsole();
            } else this.removeMessage(messageId);
            this.refreshNav();
        }

        /** A new notice of this login: into the stream in its time. */
        listenToNotices() {
            if (this.unlistenNotices) return;
            this.unlistenNotices = onNoticeHistoryChange(() => {
                if (!this.rendered || this.view !== "console") return;
                const list = this.element?.querySelector(".drpg-console-stream-list");
                if (!list) return;
                for (const entry of this.consoleNotices()) {
                    if (this.noticesShown.has(entry.id)) continue;
                    this.noticesShown.add(entry.id);
                    this.insertByTime(list, this.streamNotice(entry));
                }
                this.settleConsole();
            });
        }

        insertByTime(list, node) {
            const at = Number(node.dataset.at) || 0;
            const pinned = this.nearBottom();
            let after = null;
            for (let child = list.lastElementChild; child; child = child.previousElementSibling) {
                if (child.classList.contains("drpg-console-empty")) continue;
                if ((Number(child.dataset.at) || 0) <= at) { after = child; break; }
            }
            if (after) after.after(node);
            else if (list.firstElementChild && !list.firstElementChild.classList.contains("drpg-console-empty")) list.prepend(node);
            else list.append(node);
            if (pinned) this.scrollConsoleDown();
        }

        /** The filter and the empty lines after a change, and the Timeline's count in the list. */
        settleConsole() {
            this.applyFilterTo(this.element);
            this.showEmpties(this.element);
        }

        nearBottom() {
            const scroll = this.element?.querySelector(".drpg-console-stream");
            return !scroll || scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 48;
        }

        scrollConsoleDown() {
            const scroll = this.element?.querySelector(".drpg-console-stream");
            if (scroll) scroll.scrollTop = scroll.scrollHeight;
        }

        /** Whether the GM is looking at what `player`'s new message would show: their conversation, or the Timeline. */
        showsThread(player) {
            if (!this.rendered || this.minimized || ui.activeWindow !== this || document.visibilityState !== "visible") return false;
            return this.view === "console" || (this.view === player && this.tab === "chat");
        }

        seesThread() {
            return this.view !== "console" && super.seesThread();
        }

        async close(options) {
            this.unlistenNotices?.();
            this.unlistenNotices = null;
            savePosition("gm", this.position);
            if (DrpgGmMessengerApp.current === this) DrpgGmMessengerApp.current = null;
            return baseClose.call(this, options);
        }
    };
}
