/**
 * Danganronpa RPG - messenger windows and launcher.
 * ---------------------------------------------------------------------------
 * Two pieces of UI:
 *
 *   DrpgMessengerApp   One conversation window per player. A player only
 *                      ever opens their own; a GM can have several open at
 *                      once, one per player, each remembering where it was
 *                      left on screen.
 *
 *   the launcher       A small persistent button, bottom-right. A player
 *                      clicks it to open their own thread. A GM clicks it to
 *                      open the GM's messenger window (messenger-gm.mjs, since
 *                      1.2.124): the Timeline and every player's conversation
 *                      in one window. The roster it opened until then is gone.
 *
 * No Handlebars template: the rest of this module builds DOM by hand, so
 * ApplicationV2 is used here without the Handlebars mixin, for the same
 * reason - one way of building markup, not two.
 */

import { MODULE_ID, PRICE_CHAINS, PROJECT_SCALE } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { gmIds, ownerOf, whisperToGms, error, debug, warn, wholeNumber, localeFormat, markLanguage } from "./utils.mjs";
import { DrpgApp, drpgWindow, kitTabBar, wireKitTabs, stepper, stepperId, tipText, setTip, tipAttr } from "./ui-kit.mjs";
import { showPopup } from "./popup.mjs";
import {
    MESSENGER_FLAGS, THREAD_KIND,
    isThreadUser, threadMessages,
    totalUnread, markThreadRead, sendMessage
} from "./messenger.mjs";
import { noteFor, noteStatus, noteTemplate, saveNote, whenNotesHeld } from "./pre-session-note.mjs";
// The chat log's own roll-card painter, shared rather than reimplemented.
import { markOutcome, rollOutcomeOf } from "./private-rolls.mjs";
import { playSfx } from "./sfx.mjs";

import { contentOf, shownWordsOf, wordsOf, cardFlag, cardWriter, readersLines, dropOldGmLines } from "./secret.mjs";
import { gmMessengerClass, MESSENGER_WINDOW_SIZES, messengerSize } from "./messenger-gm.mjs";


const LAUNCHER_ID = "drpg-messenger-launcher";

export function registerMessengerUi() {
    Hooks.once("ready", renderLauncher);
    Hooks.on("canvasReady", () => renderLauncher());
    Hooks.on("drpgMessengerMessage", () => renderLauncher());
    Hooks.on("drpgMessengerRead", () => renderLauncher());
    /* A card that changed: a settled ask no longer counts for the GM that posted it (messenger.mjs `threadStatsOf`, E50
       C2), and a settle reaches a browser as this hook alone - new words through `updateSecret` (secret.mjs `remember`),
       or a document's update - so the badge is drawn again here (E50 fix FG2; the end review's F2, 87 B1). Since 1.2.122
       the GM's window's list follows too, as it does for a message or a read (`refreshNav`; the roster's rows did until
       1.2.124, the audit's REFR-15). */
    Hooks.on("drpgMessengerEdited", () => renderLauncher());
    Hooks.on("drpgMessengerDeleted", onMessengerDeleted);
    /* The page shown again (another tab, a minimised browser): the frontmost messenger window reads what came while it
       was hidden (E50 C1, E50-01). What v14 does with `ui.activeWindow` meanwhile is LIVE-E50-02. */
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState !== "visible") return;
        const front = ui.activeWindow;
        if (front instanceof DrpgMessengerApp) front.markIfSeen();
    });
    // A note changed on this browser (settings.mjs, the note store's and copy's `onChange`).
    Hooks.on("drpgNotesChanged", () => {
        for (const app of DrpgMessengerApp.instances.values()) app.refreshNote();
        gmMessengerWindow()?.refreshNote();
    });
    /* A user created, renamed or given another role (1.2.122, the audit's REFR-53): the open windows' title and
       participants line read the users at their render alone. Followed in place, never redrawn under the typing. */
    for (const hook of ["createUser", "updateUser", "deleteUser"]) {
        Hooks.on(hook, () => {
            for (const app of DrpgMessengerApp.instances.values()) app.refreshHead();
            const gm = gmMessengerWindow();
            if (gm?.view !== "console") gm?.refreshHead();
            gm?.refreshNav();
        });
    }

    // A quick way in from the Players sidebar, mirroring how avclient-livekit
    // adds its own breakout-room entries to the same context menu.
    Hooks.on("getUserContextOptions", (playersApp, contextOptions) => {
        contextOptions.push({
            name: game.i18n.localize("DRPG.Messenger.openChat"),
            icon: '<i class="fa-solid fa-comments"></i>',
            condition: li => {
                if (!game.user.isGM) return false;
                const userId = li?.dataset?.userId ?? "";
                return isThreadUser(userId);
            },
            callback: li => {
                const userId = li?.dataset?.userId ?? "";
                if (userId) openMessenger(userId);
            }
        });
    });
}

/* ==========================================================================
 * OPENING A THREAD
 * ========================================================================== */

/**
 * Open (or focus) a player's thread window.
 * @param {string} [playerUserId]  Defaults to the caller's own thread.
 */
export function openMessenger(playerUserId = game.user.id) {
    if (!game.user.isGM && playerUserId !== game.user.id) {
        ui.notifications.warn(game.i18n.localize("DRPG.Messenger.onlyOwnThread"));
        return null;
    }

    /*
     * A GM'S EVERY CONVERSATION IS ONE WINDOW (1.2.124, the owner's request OWNER-124-CONSOLE: "Okno gma niech otwiera
     * zupelnie nowe okno. Niech znajduje sie tam konsola, a takze mozliwosc przelaczenia sie na czat z dowolnym
     * graczem"). A GM naming a player gets that player's view of the GM's window; a GM naming nobody, or a GM, the
     * Timeline. Every road that opened a GM's thread comes here: the launcher, a card's click, the notice history's Open
     * conversation, the Players sidebar's entry, `game.drpg.openMessenger`. A GM's `openMessenger()` with no argument
     * named the GM's own id, which no thread has, and opened the roster until 1.2.124 (D-F4); now the Timeline.
     */
    if (game.user.isGM) return openGmMessenger(isThreadUser(playerUserId) ? playerUserId : "console");

    if (!isThreadUser(playerUserId)) {
        ui.notifications.warn(game.i18n.localize("DRPG.Messenger.notAPlayer"));
        return null;
    }

    const existing = DrpgMessengerApp.instances.get(playerUserId);
    if (existing) {
        /* A conversation folded to its title bar is unfolded before it is raised (E44 fix FG2; the end review's C-m1):
           the launcher, the roster and a notice's Open conversation raised the bar alone, and the thread stayed unread
           until the reader found it. It is read once it is seen (`seesThread`): `maximize` marks it when the fold has
           gone, `bringToFront` before that marks nothing. */
        if (existing.minimized) Promise.resolve(existing.maximize()).catch(err => debug("Could not unfold the conversation", err));
        existing.bringToFront();
        return existing;
    }

    const app = new DrpgMessengerApp(playerUserId);
    DrpgMessengerApp.instances.set(playerUserId, app);
    app.render({ force: true });
    return app;
}

/* ==========================================================================
 * THE CONVERSATION WINDOW
 * ========================================================================== */

/*
 * ON THE KIT'S FRAME (E21 C6a, 07.11.2026). A `DrpgApp` (ui-kit.mjs): `drpg-ui` and `drpg-panel` on the root, the window
 * held to the screen less 8 px a side, and the tab's own part the region that scrolls - the log on Chat, the note on
 * Note (`scrollRegion`, one of the two is drawn); the participants line, the tab bar and the send form keep their
 * height. The window has no footer: the send form is its content. With `drpg-panel` the module's panel rules reach it
 * too (under Stained Glass the height follows the content, to the screen); not seen at a table.
 */
export class DrpgMessengerApp extends DrpgApp() {
    /** One instance per player thread, so opening twice just refocuses it. */
    static instances = new Map();

    /** Which of messenger-gm.mjs MESSENGER_WINDOW_SIZES this window asks for; the GM's window says "gm". */
    static MESSENGER_KIND = "player";

    static DEFAULT_OPTIONS = {
        classes: ["drpg-messenger"],
        window: {
            icon: "fa-solid fa-comments",
            resizable: true,
            minimizable: true
        },
        scrollRegion: ".drpg-messenger-log, .drpg-messenger-note",
        // A player's messenger size since E129 (messenger-gm.mjs MESSENGER_WINDOW_SIZES, the owner's S0-MSGSIZE of
        // 23.11.2026: 760 x 730, about 40% over the 544 x 520 it had). Until then it was the module's standard popup
        // width, `--drpg-popup` in danganronpa.css (544 px; 360 before that); the messenger no longer keeps in step
        // with it. The constructor cuts it to the screen (`messengerSize`).
        position: { ...MESSENGER_WINDOW_SIZES.player }
    };

    /**
     * Which half of the window is showing: the conversation, or the player's
     * pre-session note. Per instance, so a GM with four players open can be
     * reading one person's note and another's chat at the same time.
     */
    tab = "chat";

    /**
     * What the last Save of the note came to, said once, by the redraw it asks for
     * (E05): since then a player's note goes to the GMs through the primary, and is
     * either with them or kept in this browser until a GM connects.
     */
    noteSaid = null;

    /**
     * The note the Note tab was drawn from, or last followed (`refreshNote`): the textarea
     * holds it until somebody types, and a GM's Save is judged against it (E05 fix r1-G4;
     * review M5 - a GM's tab drawn with another GM's older words wrote them back whole).
     */
    noteShown = null;

    /**
     * What stood typed in the two boxes when the window was last drawn over (1.2.122, the audit's CTRL-13 and CTRL-24):
     * a tab press renders the window whole, and the box of the tab it leaves is not drawn at all, so its words are kept
     * here and given back when that tab is drawn again (`_replaceHTML`). `note` is null while the note box holds the
     * note it was drawn with; `noteBase` is the note the typing started from, still the base a Save is judged against.
     */
    drafts = { chat: "", note: null, noteBase: null };

    constructor(playerUserId) {
        const options = { id: `drpg-messenger-${playerUserId}` };
        // The position is always handed in whole - size and place - rather than left to ApplicationV2's option merge,
        // which is not guaranteed to fall back to DEFAULT_OPTIONS.position in this direction.
        //
        // The size is the window's own kind (`new.target.MESSENGER_KIND`): until 1.2.125 this class's 544 x 520 was
        // spread under a saved place whatever class was built, so the GM's window opened at the player window's size
        // from its second opening on (the audit's r124-C-1; R8656, red at 206148b7). Since E129 it is asked for at every
        // opening and cut to the screen (messenger-gm.mjs `messengerSize`: never past 90% of its width and height; R8831).
        // The saved place, when there is one, stands over it. Only the place is kept (`savePosition` writes left and
        // top), never a size a user dragged.
        const saved = readSavedPosition(playerUserId);
        options.position = { ...messengerSize(new.target.MESSENGER_KIND ?? "player"), ...(saved ?? {}) };
        super(options);
        this.playerUserId = playerUserId;
    }

    get title() {
        if (!game.user.isGM) return game.i18n.localize("DRPG.Messenger.playerWindowTitle");
        const player = game.users.get(this.playerUserId);
        return game.i18n.format("DRPG.Messenger.gmWindowTitle", { player: player?.name ?? "?" });
    }

    async _prepareContext(_options) {
        // A GM's Note tab is drawn once the store holds the other GMs' notes (E05 fix r1-G4; review M1).
        if (this.tab === "note") await whenNotesHeld();
        const player = game.users.get(this.playerUserId);
        const gms = gmIds().map(id => game.users.get(id)).filter(Boolean);
        return {
            player, gms,
            messages: threadMessages(this.playerUserId),
            note: noteFor(this.playerUserId),
            noteStatus: noteStatus(this.playerUserId)
        };
    }

    async _renderHTML(context, _options) {
        const root = document.createElement("div");
        root.className = "drpg-messenger-body drpg-kit-content";

        const participants = document.createElement("div");
        participants.className = "drpg-messenger-participants";
        participants.textContent = participantsLine(context.player, context.gms);
        root.append(participants);

        root.append(this._buildTabs(context));

        if (this.tab === "note") {
            root.append(this._buildNote(context));
            return root;
        }

        const log = document.createElement("div");
        log.className = "drpg-messenger-log";
        if (!context.messages.length) {
            log.append(emptyNotice());
        } else {
            for (const message of context.messages) log.append(buildBubble(message));
        }
        root.append(log);

        const form = document.createElement("form");
        form.className = "drpg-messenger-input";
        form.innerHTML = `
            <textarea name="text" rows="1"${tipAttr("DRPG.Tips.Sweep.More.messageBoxTooltip")}
                placeholder="${foundry.utils.escapeHTML(game.i18n.localize("DRPG.Messenger.placeholder"))}"></textarea>
            <button type="submit"${tipAttr("DRPG.Tips.Sweep.More.sendMessageTooltip")} aria-label="${foundry.utils.escapeHTML(game.i18n.localize("DRPG.Messenger.send"))}">
                <i class="fa-solid fa-paper-plane"></i>
            </button>`;
        root.append(form);

        return root;
    }

    /** Chat | Note, on the kit's bar (E44 C4a). The note carries a dot when there is something written. */
    _buildTabs(context) {
        const made = document.createElement("template");
        made.innerHTML = kitTabBar([
            { key: "chat", label: game.i18n.localize("DRPG.Messenger.tabChat"), tooltip: tipText("DRPG.Tips.Sweep.More.chatTabTooltip") },
            { key: "note", label: game.i18n.localize("DRPG.Note.tab"), tooltip: tipText("DRPG.Tips.Setup.chatNoteTabsTooltip") }
        ], { active: this.tab });
        const bar = made.content.firstElementChild;
        if (context.note.trim()) {
            const dot = document.createElement("span");
            dot.className = "drpg-messenger-tab-dot";
            bar.dataset.hasNote = "true";
            bar.querySelector('[data-drpg-tab-key="note"]')?.append(dot);
        }
        return bar;
    }

    /**
     * The note itself: one textarea, and nothing between the player and it.
     *
     * Not a form of seven separate fields. The handbook's own answer format is
     * free text - "If nothing has changed, just write 'No changes' - and that
     * counts as done" - and seven required inputs would quietly turn a checklist
     * you can answer in four words into a chore.
     */
    _buildNote(context) {
        const wrap = document.createElement("div");
        wrap.className = "drpg-messenger-note";

        const intro = document.createElement("p");
        intro.className = "drpg-messenger-note-intro";
        intro.textContent = game.i18n.localize(
            game.user.isGM && game.user.id !== this.playerUserId
                ? "DRPG.Note.gmIntro" : "DRPG.Note.intro");
        wrap.append(intro);

        const area = document.createElement("textarea");
        area.className = "drpg-messenger-note-text";
        area.value = context.note;
        this.noteShown = context.note;
        area.drpgShown = context.note;
        area.placeholder = game.i18n.localize("DRPG.Note.placeholder");
        setTip(area, game.user.isGM && game.user.id !== this.playerUserId
            ? "DRPG.Tips.Sweep.More.noteReadersGmTooltip" : "DRPG.Tips.Sweep.More.noteReadersTooltip");
        wrap.append(area);

        const row = document.createElement("div");
        row.className = "drpg-messenger-note-actions";

        const status = document.createElement("span");
        status.className = "drpg-messenger-note-status";
        status.textContent = this.noteSaid ?? context.noteStatus;
        this.noteSaid = null;
        row.append(status);

        if (!context.note.trim()) {
            const fill = document.createElement("button");
            fill.type = "button";
            fill.className = "drpg-messenger-note-template";
            setTip(fill, "DRPG.Tips.Setup.useTheTemplateTooltip");
            fill.textContent = game.i18n.localize("DRPG.Note.useTemplate");
            fill.addEventListener("click", () => { area.value = noteTemplate(); area.focus(); });
            row.append(fill);
        }

        const save = document.createElement("button");
        save.type = "button";
        save.className = "drpg-messenger-note-save";
        setTip(save, game.user.isGM && game.user.id !== this.playerUserId
            ? "DRPG.Tips.Sweep.More.saveNoteGmTooltip" : "DRPG.Tips.Sweep.More.saveNoteTooltip");
        save.textContent = game.i18n.localize("DRPG.Note.save");
        save.addEventListener("click", async () => {
            save.disabled = true;
            try {
                const outcome = await saveNote(this.playerUserId, area.value, { base: this.noteShown });
                if (outcome === "changed") {
                    // Kept in the box, not drawn over: the next Save puts it in place of the newer note, knowingly.
                    status.textContent = game.i18n.localize("DRPG.Note.changedElsewhere");
                    this.noteShown = noteFor(this.playerUserId);
                } else if (outcome) {
                    this.noteSaid = game.i18n.localize(outcome === "sent" ? "DRPG.Note.sentToGms"
                        : outcome === "kept" ? "DRPG.Note.keptUntilGm" : "DRPG.Note.saved");
                    status.textContent = this.noteSaid;
                    // Saved: what the box holds is the note now, no draft to keep over the redraw.
                    area.drpgShown = area.value;
                    this.drafts.note = null;
                    this.render();
                }
            } finally {
                save.disabled = false;
            }
        });
        row.append(save);

        wrap.append(row);
        return wrap;
    }

    /**
     * The note changed on this browser (E05 fix r1-G4; review M5): the status line says so
     * at once, and the textarea takes the new words only while it still holds the ones it
     * was drawn with - never over what is being typed. No redraw.
     */
    refreshNote() {
        if (this.rendered) this.refreshHead();
        if (!this.rendered || this.tab !== "note") return;
        const area = this.element?.querySelector(".drpg-messenger-note-text");
        const status = this.element?.querySelector(".drpg-messenger-note-status");
        if (!area || !status) return;
        const text = noteFor(this.playerUserId);
        if (area.value === this.noteShown) {
            area.value = text;
            this.noteShown = text;
        }
        status.textContent = noteStatus(this.playerUserId);
    }

    /**
     * The window's head followed in place (1.2.122, the audit's REFR-53): the Note tab's dot from the note as it stands,
     * the participants line and the title from the users. Drawn once at the render until then, so a note written while
     * the window stood on Chat drew no dot, and a GM renamed or added kept the old line.
     */
    refreshHead() {
        if (!this.rendered || !this.element) return;
        const player = game.users.get(this.playerUserId);
        const gms = gmIds().map(id => game.users.get(id)).filter(Boolean);
        const line = this.element.querySelector(".drpg-messenger-participants");
        const words = participantsLine(player, gms);
        if (line && line.textContent !== words) line.textContent = words;
        if (this.window?.title?.nodeType === 1 && this.window.title.textContent !== this.title) this.window.title.textContent = this.title;
        const tab = this.element.querySelector('nav.drpg-tabs [data-drpg-tab-key="note"]');
        if (!tab) return;
        const bar = tab.closest("nav.drpg-tabs");
        const has = Boolean(noteFor(this.playerUserId).trim());
        const dot = tab.querySelector(".drpg-messenger-tab-dot");
        if (has && !dot) {
            const made = document.createElement("span");
            made.className = "drpg-messenger-tab-dot";
            tab.append(made);
        } else if (!has && dot) dot.remove();
        if (has) bar.dataset.hasNote = "true";
        else delete bar.dataset.hasNote;
    }

    async _replaceHTML(result, content, _options) {
        // What was typed and not sent or saved survives the redraw (CTRL-13, CTRL-24): read off the boxes drawn over...
        const chatWas = content.querySelector(".drpg-messenger-input textarea");
        if (chatWas) this.drafts.chat = chatWas.value;
        const noteWas = content.querySelector(".drpg-messenger-note-text");
        if (noteWas) {
            const typed = noteWas.value !== (noteWas.drpgShown ?? noteWas.value);
            this.drafts.note = typed ? noteWas.value : null;
            this.drafts.noteBase = typed ? noteWas.drpgShown : null;
        }
        content.replaceChildren(result);
        // ...and given back to the box of the tab drawn now. A note's draft keeps its base: a Save still asks whether
        // the note changed under it (`saveNote`'s `base`).
        const chatNow = content.querySelector(".drpg-messenger-input textarea");
        if (chatNow && this.drafts.chat) chatNow.value = this.drafts.chat;
        const noteNow = content.querySelector(".drpg-messenger-note-text");
        if (noteNow && this.drafts.note !== null) {
            noteNow.value = this.drafts.note;
            noteNow.drpgShown = this.drafts.noteBase;
            this.noteShown = this.drafts.noteBase;
        }
    }

    _onRender(context, options) {
        super._onRender(context, options);
        wireKitTabs(this.element, {
            onSwitch: key => {
                this.tab = key;
                this.render();
            }
        });

        const form = this.element.querySelector(".drpg-messenger-input");
        const textarea = form?.querySelector("textarea");

        /*
         * A FAILED SEND KEEPS WHAT WAS TYPED (E50 C1; audit S11-38, E50-03). The field was emptied before the send,
         * and `createThreadMessage` logs a failure and answers null - so a message that never left was gone from the
         * screen as well, and nothing said so. The field is held while the send runs and emptied only once the
         * message is there; on null or a throw the words stay, the field comes back, and the writer is told once.
         *
         * TOLD WHAT IS KNOWN, AND ONCE (E50 fix FG2; the end review's F4, S2, G6). "Not sent" was said of every null,
         * after a refusal that had said why (too long, no GM) and where the primary may have posted it during an
         * incident (secret.mjs `askGm`: no answer in time, or an id and no card in time), so Send again posted it
         * twice. The send fills `outcome` (`postSecret`'s): may have been posted - say so, and to look at the thread
         * first; said already - nothing more; neither - not sent. A throw is not sent.
         */
        form?.addEventListener("submit", async event => {
            event.preventDefault();
            const text = textarea.value;
            if (!text.trim() || textarea.disabled) return;
            textarea.disabled = true;
            let sent = null;
            const outcome = {};
            try {
                sent = await this.send(text, outcome);
            } catch (err) {
                error("Messenger: could not send.", err);
                sent = null;
            } finally {
                textarea.disabled = false;
            }
            if (sent) {
                textarea.value = "";
                this.drafts.chat = "";
            }
            else if (outcome.maybePosted) ui.notifications.warn(game.i18n.localize("DRPG.Messenger.sendUnsure"));
            else if (!outcome.told) ui.notifications.error(game.i18n.localize("DRPG.Messenger.sendFailed"));
            textarea.focus();
        });

        textarea?.addEventListener("keydown", event => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                form.requestSubmit();
            }
        });

        this._scrollToBottom();
        this.markIfSeen();
        textarea?.focus();
    }

    /** The send behind the Send button: the thread's own message, answered, or null when it did not go (`outcome` says what is known). */
    async send(text, outcome = null) {
        return sendMessage(this.playerUserId, text, { outcome });
    }

    /*
     * READ ONLY WHAT IS IN FRONT OF THE READER (E50 C1; audit S11-37, E50-01; Q-E50-2's default). Every render
     * marked the thread read, the Note tab's too, and every message that came while the window was open, whatever
     * covered it or however long the browser's tab had been hidden: a GM's badge went out on a request nobody saw.
     * Seen now means the window drawn, on its Chat tab, the frontmost window (`ui.activeWindow`) and the page
     * visible; a message that comes otherwise raises its card (the hook below) and is read when the window is
     * brought forward, switched to Chat or shown again. A window folded to its title bar is not seen either (E44
     * C4b, 04.11.2026: no-collapse.mjs blocked the title bar's double-click until then, the owner's Q-E44-1 lifted the
     * block), and reads what came when it is opened again (`maximize`, below). What sets `ui.activeWindow` on v14 is
     * LIVE-E50-01: the harness sets it on a first render and on `bringToFront`, and clears it on close.
     */
    seesThread() {
        return Boolean(this.rendered) && !this.minimized && this.tab === "chat" && ui.activeWindow === this
            && document.visibilityState === "visible";
    }

    markIfSeen() {
        if (this.seesThread()) markThreadRead(this.playerUserId);
    }

    bringToFront() {
        const out = super.bringToFront();
        this.markIfSeen();
        return out;
    }

    /** Opened again from its title bar: what came while it was folded is in front of the reader now (`seesThread`). */
    async maximize() {
        const out = await super.maximize();
        this.markIfSeen();
        return out;
    }

    /**
     * A message deleted from the chat log leaves this window (E50 C1; audit S11-35, E50-04): its bubble goes, its
     * buttons with it, and an emptied log says so again.
     */
    removeMessage(messageId) {
        const log = this.element?.querySelector(".drpg-messenger-log");
        if (!log || !messageId) return false;
        const bubbles = [...log.querySelectorAll(".drpg-messenger-bubble")].filter(b => b.dataset.messageId === messageId);
        for (const bubble of bubbles) bubble.remove();
        if (bubbles.length && !log.querySelector(".drpg-messenger-bubble")) log.replaceChildren(emptyNotice());
        return bubbles.length > 0;
    }

    /**
     * One bubble said something different - redraw that bubble and nothing
     * else. A full `render()` would work and would also wipe the half-written
     * message in the box below it.
     */
    replaceMessage(message) {
        const old = this.element?.querySelector(
            `.drpg-messenger-bubble[data-message-id="${message.id}"]`);
        if (!old) return;
        old.replaceWith(buildBubble(message));
    }

    /** Called by the module-level createChatMessage hook - no re-render. */
    appendMessage(message) {
        const log = this.element?.querySelector(".drpg-messenger-log");
        if (!log) return;
        log.querySelector(".drpg-messenger-empty")?.remove();
        log.append(buildBubble(message));
        this._scrollToBottom();
        // Read at once only when it is in front of the reader (`seesThread`); otherwise its card is raised.
        this.markIfSeen();
    }

    _scrollToBottom() {
        const log = this.element?.querySelector(".drpg-messenger-log");
        if (log) log.scrollTop = log.scrollHeight;
    }

    async close(options) {
        savePosition(this.playerUserId, this.position);
        DrpgMessengerApp.instances.delete(this.playerUserId);
        return super.close(options);
    }
}

/* THE GM'S WINDOW (1.2.124; messenger-gm.mjs): the thread window's class, with the Timeline and the list of players.
   Exported for the suite alone (R1339 stands a folded window in as `current`). */
export const DrpgGmMessengerApp = gmMessengerClass(DrpgMessengerApp, {
    buildBubble: message => buildBubble(message),
    previewOf: message => stripHtml(contentOf(message)),
    savePosition: (key, position) => savePosition(key, position)
});

/** The GM's messenger window opened, or raised and turned to `view` ("console" or a player's id). */
export function openGmMessenger(view = "console") {
    const existing = DrpgGmMessengerApp.current;
    if (existing) {
        if (existing.view !== view) existing.setView(view);
        if (existing.minimized) Promise.resolve(existing.maximize()).catch(err => debug("Could not unfold the messenger", err));
        existing.bringToFront();
        return existing;
    }
    const app = new DrpgGmMessengerApp(view);
    DrpgGmMessengerApp.current = app;
    app.render({ force: true });
    return app;
}

/** This browser's GM messenger window, or null (the suite's, and the routing below). */
export function gmMessengerWindow() {
    return DrpgGmMessengerApp.current ?? null;
}

/**
 * The window that shows a player's conversation here, or null: on a GM the GM's window while it shows that player's
 * view (1.2.124), on a player their own thread window. The scenarios read a thread's window through it.
 */
export function threadWindow(playerUserId) {
    if (!game.user?.isGM) return DrpgMessengerApp.instances.get(playerUserId) ?? null;
    const gm = gmMessengerWindow();
    return gm?.view === playerUserId ? gm : null;
}

// The module-level hook lives here, not per instance: one listener regardless
// of how many windows are open, and nothing to leak when one closes.
Hooks.on("drpgMessengerMessage", async (playerUserId, message) => {
    /* The GM's window shows it where it is shown - the player's view, or the Timeline - and a GM looking at it there
       is shown no card for it (1.2.124). */
    const gm = gmMessengerWindow();
    if (gm) {
        gm.threadMessage(playerUserId, message);
        if (gm.showsThread(playerUserId)) return;
    }
    const instance = DrpgMessengerApp.instances.get(playerUserId);
    if (instance) {
        instance.appendMessage(message);
        /* An open window that does not show it (on Note, covered by another window, the page hidden) raises the same
           card a closed one would (E50 C1, E50-02). A stand-in without `seesThread` counts as seeing (R297). */
        if (instance.seesThread?.() ?? true) return;
    }

    /* A GM used to keep only the roster badge for this - a passive dot in the
     * corner - which was the right volume for a player's "hey" and the wrong
     * one for everything that WAITS on the GM: a parked murder's approve card,
     * a project proposal, an Analyze critical. An ask that nobody is told
     * about is an ask that hangs (Dawid, 26.08). The `gmAsk` flag is stamped
     * where the card is made, and deliberately not derived from the author -
     * the bridge posts several of these FROM the GM's own session on a
     * player's behalf, so even a self-authored card can be news to the GM
     * sitting at that screen. Ordinary chatter keeps the badge. */
    if (game.user.isGM) {
        // From the words' meta on a veiled card (E06 C8): `messenger.mjs` raised this once they landed.
        if (!cardFlag(message, MESSENGER_FLAGS.gmAsk)) return;
        // The words, not the stub: a thread card is a private card now and
        // its text lands a moment after the document does.
        const writer = cardWriter(message);
        showPopup(cardPreview(await wordsOf(message)), {
            title: game.i18n.localize("DRPG.Messenger.gmActionTitle"),
            onClick: () => openMessenger(playerUserId),
            ...keptAsMessenger(message, playerUserId),
            /* Kept under the thread's player only when a GM's session wrote the card - the bridge posts some of
               these for a player (E81 fix r1-G1) - and under its writer otherwise, as `noticeSource` (popup.mjs)
               reads a card's writer: the `thread` flag is the writer's to set, so taken as the author it let one
               player's cards fill another's share of this GM's history and carry that player's name (E81 fix
               r2-H1, review round 2's S1). The writer is handed on, not looked up again by the message's id. */
            author: writer?.isGM ? (isThreadUser(playerUserId) ? playerUserId : null) : writer?.id ?? null
        });
        return;
    }

    // The player's own window is not open - surface the reply the same way
    // every other message on their screen appears, with a click that jumps
    // straight to the conversation.
    if (game.user.id !== playerUserId) return;
    // Its writer: in an incident a GM posts a player's message for them (secret.mjs `cardWriter`, E08+E28 fix r2-H5).
    if (cardWriter(message)?.id === game.user.id) return;

    showPopup(cardPreview(await wordsOf(message)), {
        title: game.i18n.localize("DRPG.Messenger.playerWindowTitle"),
        onClick: () => openMessenger(playerUserId),
        ...keptAsMessenger(message, playerUserId)
    });
});

/*
 * THE CARD IS KEPT, THE BUBBLE IS NOT (E81 C4; the A7 design's P4-0). Both cards above are kept in
 * this browser's notice history as the thread's - the message they came from, and the conversation
 * the history's entry opens (`link`). A message appended to a window that is open is no card and is
 * not kept: the window is the conversation, and the thread holds it (R297). Its message also makes a deletion in
 * the chat log take the card off every screen it is on (popup.mjs `onDeleteChatMessage`, E81 C5), and a plain
 * deletion leaves the kept entry unread and marked deleted (R297, E81 fix r1-G1; the review's O11).
 */
function keptAsMessenger(message, playerUserId) {
    return { source: "messenger", messageId: message?.id ?? null, link: { messenger: playerUserId } };
}

/*
 * A deleted message leaves every open window that shows it (E50 C1; audit S11-35, E50-04). Every window, not only its
 * thread's: a veiled card names its thread only in the words it brought, so its window is found by its bubble. The
 * launcher is drawn again, as the count may drop. The card copy on the screen is popup.mjs's (`onDeleteChatMessage`).
 */
function onMessengerDeleted(message) {
    for (const app of DrpgMessengerApp.instances.values()) app.removeMessage?.(message?.id ?? null);
    gmMessengerWindow()?.removeEverywhere(message?.id ?? null);
    renderLauncher();
}

// A card that changed while a window is open redraws in place. A card that
// changed while it is closed needs nothing: the window builds from the
// messages when it opens, and they are already the new ones.
Hooks.on("drpgMessengerEdited", (playerUserId, message) => {
    DrpgMessengerApp.instances.get(playerUserId)?.replaceMessage(message);
    gmMessengerWindow()?.threadEdited(playerUserId, message);
});

/**
 * The card as a notification: the same words, minus the buttons.
 *
 * A popup is a COPY of the message, and nothing wires a copy - so every button
 * on one looked live and did nothing at all. The real ones are one click away:
 * a popup raised from a thread opens that thread.
 */
function cardPreview(html) {
    const wrap = document.createElement("div");
    wrap.innerHTML = html ?? "";
    wrap.querySelectorAll(".drpg-call-actions").forEach(el => el.remove());
    if (!game.user.isGM) wrap.querySelectorAll(".drpg-gm-only").forEach(el => el.remove());
    // A card older than the wrapper above carries the GMs' line bare (E16 part 2 C5; audit S02-28).
    dropOldGmLines(wrap);
    return readersLines(wrap);
}

function participantsLine(player, gms) {
    const names = [player?.name, ...gms.map(g => g.name)].filter(Boolean);
    return names.join(" · ");
}

function emptyNotice() {
    const p = document.createElement("p");
    p.className = "drpg-messenger-empty";
    p.textContent = game.i18n.localize("DRPG.Messenger.noMessagesYet");
    return p;
}

/**
 * A bubble's time in the table's language (E18 C6; audit S11-61). It was `toLocaleTimeString([], ...)`, the
 * browser's locale: a Polish table on an English system read "02:15 PM" in a Polish window (R850). E18 gave it
 * Foundry's language; since E66 C1 it is the module's, as the page was built in it (utils.mjs `localeFormat`), which
 * is the language of the words around it.
 */
export function bubbleTime(at) {
    return localeFormat("time", at, { hour: "2-digit", minute: "2-digit" });
}

function buildBubble(message) {
    const authorId = cardWriter(message)?.id;
    const author = game.users.get(authorId);
    const mine = authorId === game.user.id;
    const kind = cardFlag(message, MESSENGER_FLAGS.kind);
    const isAction = kind === THREAD_KIND.action;

    const bubble = document.createElement("div");
    bubble.className = `drpg-messenger-bubble ${isAction ? "action" : mine ? "mine" : (author?.isGM ? "gm" : "player")}`;
    bubble.dataset.messageId = message.id;

    if (!isAction) {
        const name = document.createElement("div");
        name.className = "drpg-messenger-author";
        name.textContent = author?.name ?? "?";
        bubble.append(name);
    }

    const body = document.createElement("div");
    body.className = "drpg-messenger-text";
    // Both callers of createThreadMessage() hand over safe HTML - sendMessage()
    // escapes free text before this ever runs, postToThread() is fed the
    // GM-bridge's own escaped ruling cards - and that was the whole defence until
    // the audit sent the words by hand from a console (S11-01). `contentOf` now
    // reads them through secret.mjs, which cleans anything a GM did not write.
    // A card whose words never came here says so rather than '-' (E18 C4, `shownWordsOf`).
    body.innerHTML = shownWordsOf(message);
    // The ask's time and end in this reader's clock and language (secret.mjs `readersLines`, E18 fix e1-G3).
    readersLines(body);
    // The GM's half of a ruling card - the reference table, the "score it
    // against" line - is not the player's to read (COMM-06). Removed, like
    // the buttons, rather than hidden. Since E06 C7b a player's words arrive
    // without it (secret.mjs `playerWords`); this takes it off older ones.
    if (!game.user.isGM) body.querySelectorAll(".drpg-gm-only").forEach(el => el.remove());
    dropOldGmLines(body);
    wireCallActions(body, message);
    bubble.append(body);

    // A ROLL IN A THREAD LOOKS LIKE A ROLL.
    //
    // The chat log has dressed duality rolls since the private-roll work -
    // gold for Hope, blood for Fear, crimson for a critical, on the card's own
    // border. A roll that arrived in a messenger thread instead got none of
    // that: the same numbers, in the same table, inside a plain grey bubble,
    // because this function renders `message.content` and stops. Two places
    // showing one thing in two visual languages is exactly the seam this stage
    // is closing, so the bubble borrows the card's own painter.
    if (message.rolls?.length) {
        bubble.classList.add("roll");
        const outcome = rollOutcomeOf(message);
        if (outcome) {
            bubble.classList.add(outcome);
            markOutcome(bubble, outcome);
        }
    }

    const time = document.createElement("div");
    time.className = "drpg-messenger-time";
    time.textContent = bubbleTime(message.timestamp);
    bubble.append(time);

    return bubble;
}

/**
 * Make the buttons on a ruling card work.
 *
 * A declaration card used to be a wall of text with "Awaiting a ruling" at the
 * bottom and nothing to press. Acting on it meant the GM panel, "Open a murder",
 * and picking the killer and the victim off two lists - retyping, by hand, the
 * two names printed in the paragraph above the button that was not there.
 *
 * Removed for a player rather than hidden by CSS: a button that is not in the
 * DOM cannot be clicked by anybody reading their own thread.
 */
export function wireCallActions(body, message = null) {
    const buttons = body.querySelectorAll("[data-drpg-call]");
    if (!buttons.length) return;

    // Already answered. The card's own text says so - see `settleCall` - and a
    // card from before that existed still gets its buttons taken off here.
    if (message && cardFlag(message, MESSENGER_FLAGS.settled)) {
        for (const button of buttons) button.closest(".drpg-call-actions")?.remove();
        return;
    }

    if (!game.user.isGM) {
        for (const button of buttons) button.closest(".drpg-call-actions")?.remove();
        return;
    }

    // Who is ruling on the card, on every GM's copy (2.0 line T2, EXP-GM-05; `signClaim`, below).
    signClaim(body, message);

    /*
     * EVERY BUTTON OF THE CARD IS HELD WHILE ONE CLICK RUNS (E09 C10, 08.10.2026). Only
     * the button pressed used to be, so Approve and then Decline on one card, pressed
     * before the first had answered, were both asked. The rulings themselves refuse a
     * second one now (cleanup-reshape.mjs `claimRuling`); this keeps the second click from
     * being asked at all.
     */
    let busy = false;
    const hold = held => { for (const each of buttons) each.disabled = held; };
    for (const button of buttons) {
        button.addEventListener("click", async event => {
            event.preventDefault();
            event.stopPropagation();
            if (busy) return;

            // Disabled for the duration of the click and NOT one moment longer.
            // It used to be disabled on the way in and re-enabled only in the
            // catch, so a GM who opened the reply box and closed it again was
            // left looking at a greyed-out button on an unanswered card, with
            // no way back except closing the whole window and opening it again
            // (Dawid, 26.08). Backing out of a ruling is not an error and must
            // not be punished like one.
            busy = true;
            hold(true);
            try {
                // Claimed on the primary GM first (E18 C3, bridge-asks.mjs `claimCard`): a card another GM has, or
                // ruled, is not ruled again here, and this GM is told who has it. No card, no claim and no ruling.
                const { claimCard, settleCall } = await import("./gm-bridge.mjs");
                const outcome = await claimCard(message, () => runCallAction(button.dataset.drpgCall, { ...button.dataset }, message));
                // Sent on by the primary, which writes the card's line once the player has it (E18 C1): held till it redraws.
                if (outcome?.held) return;
                if (outcome?.settled) {
                    await settleCall(message, outcome.settled, outcome.ruling ?? null, outcome.gmNote ?? null);
                    return; // The card redraws itself; these buttons are gone.
                }
                // Answered already, on the other copy of this card (F118: a GM's log and messenger both wire a thread's
                // card) or by another GM: the claim was refused and said why, and these buttons stay held.
                if (message && cardFlag(message, MESSENGER_FLAGS.settled)) return;
            } catch (err) {
                error("Could not act on the ruling card", err);
            } finally {
                busy = false;
            }
            hold(false);
        });
    }
}

/*
 * WHO IS RULING ON A CARD, ON THE CARD (2.0 line T2, EXP-GM-05, 27.11.2026; F1-blind-gm EXP-GM-05, E-GM-15). A second
 * GM learnt that another GM was ruling on a card only by pressing it and being refused (`DRPG.Bridge.claimBusy`). Every
 * GM's copy of a card - the chat log's and the messenger's, both drawn through `wireCallActions` - now carries, while
 * another GM's claim holds it (a pending row of a GM who is here in the GMs' `ruledCardStore`, not run out:
 * call-gm.mjs `claimRanOut`), a line "{gm} has been ruling on this card since {time}." and Take over, in the card's
 * answers' block, which a player's copy never has (it is removed above) - so nothing of it is drawn for a player. Its
 * own GM's claim draws nothing. Drawn again when the store changes here (`clientSettingChanged` on its key: a write of
 * this primary's, or another GM's row merged in) and once the claim's hold has run out; it goes with the block when the
 * card is ruled. Take over takes the claim over and lets it go at once (card-takeover.mjs `takeOverFromCard`): the other
 * GM's window closes, and this GM presses an answer as usual.
 */
const CLAIM_SIGN_CLASS = "drpg-call-claim";
let claimSignsWatched = false;

/** Draw the card's claim sign in its answers' block and keep it drawn (EXP-GM-05). */
function signClaim(body, message) {
    const actions = body.querySelector(".drpg-call-actions");
    if (!actions || !message?.id) return;
    actions.dataset.drpgClaimOf = message.id;
    watchClaimSigns();
    void paintClaimSign(actions).catch(err => debug("Could not draw who is ruling on a card", err));
}

/** Every drawn card's sign, drawn again when the GMs' `ruledCardStore` changes on this browser; once per browser. */
function watchClaimSigns() {
    if (claimSignsWatched) return;
    claimSignsWatched = true;
    Hooks.on("clientSettingChanged", key => {
        if (key !== `${MODULE_ID}.${SETTINGS.gmRuledCards}`) return;
        for (const actions of document.querySelectorAll(".drpg-call-actions[data-drpg-claim-of]")) {
            void paintClaimSign(actions).catch(err => debug("Could not draw who is ruling on a card", err));
        }
    });
}

/**
 * The claim sign of one card's answers' block (EXP-GM-05), drawn from the card's row in the GMs' `ruledCardStore` (or
 * `row`, a test's: R9023): the line and Take over when another GM who is here holds a claim that has not run out,
 * nothing otherwise, and nothing on a player's browser. Answers the GM it names, or null.
 */
export async function paintClaimSign(actions, { row = undefined } = {}) {
    const id = actions?.dataset?.drpgClaimOf;
    if (!id) return null;
    const read = row !== undefined ? row : (await import("./gm-stores.mjs")).ruledCardStore.get(id);
    const { claimRanOut } = await import("./call-gm.mjs");
    const by = game.user?.isGM && read?.pending && read.by && read.by !== game.user.id && !claimRanOut(read)
        && game.users.get(read.by)?.active ? read.by : null;
    actions.querySelector(`.${CLAIM_SIGN_CLASS}`)?.remove();
    if (!by) return null;
    const sign = document.createElement("div");
    sign.className = `${CLAIM_SIGN_CLASS} drpg-gm-only`;
    sign.dataset.drpgClaimBy = by;
    const line = document.createElement("p");
    line.textContent = game.i18n.format("DRPG.Bridge.claimedBy", { gm: game.users.get(by)?.name ?? "?", time: bubbleTime(read.at) });
    const take = document.createElement("button");
    take.type = "button";
    take.dataset.drpgClaimTake = id;
    take.textContent = game.i18n.localize("DRPG.Bridge.takeOver");
    setTip(take, "DRPG.Bridge.takeOverTooltip");
    take.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        take.disabled = true;
        try {
            const { takeOverFromCard } = await import("./card-takeover.mjs");
            await takeOverFromCard(id);
        } catch (err) {
            error("Could not take the card over", err);
        } finally {
            take.disabled = false;
        }
    });
    sign.append(line, take);
    actions.prepend(sign);
    // Drawn again once the claim's hold has run out, when no store change says so.
    const { TIMING } = await import("./config.mjs");
    const { serverNow } = await import("./utils.mjs");
    const left = typeof read.at === "number" ? read.at + TIMING.claimHoldMs - serverNow() : null;
    if (left !== null) setTimeout(() => { if (actions.isConnected) void paintClaimSign(actions).catch(() => {}); }, Math.max(0, left) + 1000);
    return by;
}

/**
 * One of a card's actions run on this GM's browser by the road a press takes (E68 C2): claimed on the primary,
 * ruled, and the card settled with the ruling's line - what `wireCallActions` does for a click, with no button.
 * The valve's (call-gm.mjs `askTraitByCard`). Answers what the ruling answered, or null when it was not this GM's.
 */
export async function pressCard(message, action, data = {}) {
    if (!message?.id || !game.user?.isGM) return null;
    const { claimCard, settleCall } = await import("./gm-bridge.mjs");
    const outcome = await claimCard(message, () => runCallAction(action, { ...data }, message));
    if (outcome?.settled && !outcome.held) await settleCall(message, outcome.settled, outcome.ruling ?? null, outcome.gmNote ?? null);
    return outcome;
}

/**
 * A ruling that is now made, and the line the card should carry instead of
 * "Awaiting a ruling."
 *
 * Returned only by the branches that actually END the question. Opening the
 * item tables is not one of them: that window is an editor a GM can close
 * without writing anything, and a card that closed itself on the strength of a
 * window being opened would be lying in the other direction.
 */
function settled(key) {
    return { settled: game.i18n.format(key, { name: game.user.name }) };
}

/** What a Tier 0 item turned out to do: up to three numbers and a tick. */
async function askItemEffect(item) {
    const field = (name, key) => { const id = stepperId(); return `<label for="${id}">${game.i18n.localize(key)}
        ${stepper({ name, value: 0, min: 0, max: 12, step: 1, id, attrs: { "data-tooltip": tipText("DRPG.Tips.Sweep.More.itemGivesBackTooltip") } })}</label>`; };
    // On the kit (E21 C6a): Works on the right, the default; Cancel on the left. DialogV2 answers a button's callback or,
    // when that is null, its action, so Cancel answers "cancel" (callback null) and a closed window null: the `.then`
    // below reads both as no effect (E21 fix G2; the end review's correctness m3: this said Cancel answered null).
    return drpgWindow({
        classes: ["drpg-panel"],
        title: game.i18n.format("DRPG.Items.effectTitle", { item: item.name }),
        body: `<form class="drpg-item-effect">
            ${field("hitPoints", "DRPG.Items.effectHealth")}
            ${field("stress", "DRPG.Items.effectSanity")}
            ${field("hope", "DRPG.Items.effectHope")}
            <label><input type="checkbox" name="consume" checked${tipAttr("DRPG.Tips.Sweep.More.useItemUpTooltip")}> ${
                game.i18n.localize("DRPG.Items.effectConsume")}</label>
        </form>`,
        footer: {
            primary: {
                action: "ok", label: game.i18n.localize("DRPG.Items.itemWorks"),
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    const amounts = {};
                    for (const key of ["hitPoints", "stress", "hope"]) {
                        const n = wholeNumber(f.elements[key]?.value, { min: 0, max: 12, fallback: 0 });
                        if (n) amounts[key] = n;
                    }
                    return { amounts, consume: Boolean(f.elements.consume?.checked) };
                }
            },
            close: { role: "cancel", action: "cancel", callback: () => null }
        },
        rejectClose: false
    }).then(r => (r && r !== "cancel" ? r : null));
}

// A Hope Call that needed the GM's say-so (COMM-04). The verdict goes back
// to the asking client over the packet the old dialog used; the player's
// own `spendHopeCall` asks the GM to arm it on a yes, and the GM charges the
// Hope then. A yes goes by the primary, which keeps it for that arm (E29 fix
// r2-H4): one it could not keep closes the card as an ask that ran out, "The player was no longer waiting." the GMs'
// own line under it (`askNotHeld`, 1.2.122; 2.0 line T2, CALLS-14),
// or leaves it open where the bridge said why. The primary writes
// "Approved" on the card once the player's browser has the yes (E18 C1). The
// card pressed goes with it: the primary keeps a yes only for the ask held on
// that card (call-gm.mjs `yesOnPrimary`, fix early-C2-G2).
async function ruleApproveCallOrRefuseCall(action, data, message = null) {
    const { answerHopeCall } = await import("./gm-bridge.mjs");
    const yes = action === "approveCall";
    const out = {};
    if (!(await answerHopeCall(data.rid, data.asker, yes, message?.id ?? null, out))) return askNotHeld(out);
    return yes ? { held: true } : settled("DRPG.Bridge.settledDeclined");
}

// A Dynamic action: the difficulty editor is the old dialog, opened from
// the card by whichever GM picks it up; "Refuse" tells the player so. The
// difficulty is kept in the card's meta, where the GM who places the action's
// trace reads its band (bridge-runs-records.mjs `dynamicRulingOf`, E08+E28 C15). The
// ruling goes by the primary, which keeps it in the meta and takes the card's
// buttons off as it sends it on, and writes the card's line once the player's
// browser has it (E18 C1; call-gm.mjs `keepRuling`, fix early-C1-G1) - for
// the ask held on the card pressed alone (`dynamicOnPrimary`, fix early-C2-G2).
async function ruleSetDifficulty(action, data, message = null) {
    const { askDynamicDifficulty } = await import("./action-rolls.mjs");
    // The card's time, which the window counts down to (2.0 line T2, CALLS-03, 28.11.2026).
    const { askCardExpiry } = await import("./call-gm.mjs");
    const ruling = await askDynamicDifficulty({
        description: data.desc ?? "", actorName: data.name ?? "?", actorId: data.by || null, room: data.room || null, proposed: data.proposed || null,
        expires: message ? askCardExpiry(message) : null
    });
    // Taken over by another GM while the window stood open: nothing from it is ruled (2.0 line T2, CALLS-01).
    if (await takenOverMeanwhile(message)) return null;
    // The window's Refuse is the card's Refuse (1.2.122, CTRL-27); closed with no answer, the card stays open.
    if (ruling === false) return ruleRefuseDynamic(action, data, message);
    if (!ruling) return null;
    const { answerDynamic } = await import("./gm-bridge.mjs");
    const out = {};
    return (await answerDynamic(data.rid, data.asker, ruling, message?.id ?? null, out)) ? { held: true } : askNotHeld(out);
}

/*
 * A RULING'S WINDOW ANOTHER GM TOOK OVER RULES NOTHING (2.0 line T2, CALLS-01, 27.11.2026). When another GM takes over a
 * card whose window is open here, the primary says so and the claim's windows are closed (bridge-asks.mjs
 * `cardTakenOverHere`): a kit window closed answers null, so the ruling returns nothing. Of the two ways the spec of the
 * line gives a ruling that acts with no primary - ask the primary with a step of the claim, or read a mark this browser
 * keeps - this reads the mark (`claimLostHere`), in every ruling of `CARD_ACTIONS` whose effect follows its window here:
 * the difficulty (whose answer goes by the primary, which refuses a GM it no longer holds the card for, call-gm.mjs
 * `claimedByAnother`), Reply and an item's effect. The rulings whose window carries out its own effect - a project's,
 * a trap's plant and target, an item given, a Key Remnant placed, the item tables - are held by the window's close alone;
 * an Observe's pick goes by the primary. The rulings with no window act at the press. A take-over the primary's packet
 * did not bring here is caught by the primary alone, and on the rulings that go by it.
 */
async function takenOverMeanwhile(message) {
    if (!message?.id) return false;
    const { claimLostHere } = await import("./card-takeover.mjs");
    return claimLostHere(message.id);
}

/**
 * A ruling on an ask the primary no longer holds (1.2.122, the audit's CTRL-23): the player reloaded and asked again
 * elsewhere, or its time ran out. The buttons came back with a line in the console alone, so the GM pressed again; the
 * card says so now and settles. Where the bridge said why (no primary to ask, no answer: `out.told`), the buttons come
 * back and nothing more is said.
 *
 * THE GMS' LINE IS THE GMS' (2.0 line T2, CALLS-14, 27.11.2026; F1-calls CALLS-14). It settled with "The player was no
 * longer waiting." as the card's own line, so the player read about themselves in the third person in their own thread,
 * where the GM handbook (6.3) says the card ends "Nobody answered in time. You can ask again." for everyone and that line
 * for the GMs. It ends now as the primary's own end of such a card writes it (call-gm.mjs `endExpired`): the line for
 * everyone and the GMs' note, both by key, so each reader writes them in its own language (secret.mjs `readersLines`),
 * and the note in the card's `.drpg-gm-only`, which a player's copy of the words never holds. `wireCallActions` and
 * `pressCard` hand the note to `settleCall`. R9036, tier 2's "E132 CALLS-14".
 */
function askNotHeld(out) {
    if (out?.told) return null;
    ui.notifications.warn(game.i18n.localize("DRPG.Bridge.askNotHeld"));
    return { settled: { key: "DRPG.Bridge.settledExpired" }, gmNote: { key: "DRPG.Bridge.settledGone" } };
}

async function ruleRefuseDynamic(action, data, message = null) {
    const { answerDynamic } = await import("./gm-bridge.mjs");
    const out = {};
    return (await answerDynamic(data.rid, data.asker, false, message?.id ?? null, out)) ? { held: true } : askNotHeld(out);
}

/**
 * The player whose thread a ruling goes to (E91 C6; the owner's deferred item D078): the one whose thread its card is in
 * (`MESSENGER_FLAGS.thread`), when they own the character - a co-owner's question is asked in the co-owner's thread
 * (call-gm.mjs `threadOf`, E18 fix e1-G7) and was answered in the first owner's - else the first owner (`ownerOf`).
 */
function rulingThread(actor, message) {
    const id = message ? cardFlag(message, MESSENGER_FLAGS.thread) : null;
    const user = id ? game.users.get(id) : null;
    if (user && !user.isGM && actor?.testUserPermission?.(user, "OWNER")) return user;
    return ownerOf(actor);
}

// The statistic of a roll that lists several (E32+E07 C11b; trait-ruling.mjs). The
// list is read again from this GM's config for the definition the card names, and a
// trait not on it is refused here: the button's data is the card's, and the card is
// a document. The pick goes to the asker alone and is kept in the card's meta. A project
// stored without a statistic is given this one before the answer leaves (C11d), so the
// roll it is for is the last that asks. Since E68 C1 (DA18) the card may answer a proposal:
// "Approve" and each "Change to" are this one action, and the list's guard holds both - a
// "Change to" off the list is refused here as any pick is. The ruling keeps the proposal and
// `how` ("approved", "changed", or "picked" with none), read as the button's data says it.
// The card's line says the pick is not confirmed (`DRPG.Bridge.settledUnconfirmed`, by key, each reader's language):
// it goes from this browser to the asker and nothing here knows it arrived; the primary writes it "Answered by" on
// the asker's receipt (2.0 line T2, CALLS-05, 28.11.2026; pick-receipt.mjs `pickReceived`). The valve's own press keeps its
// "Approved automatically.", made by the primary as the card goes up.
async function rulePickTrait(action, data) {
    // The valve's press (E68 C2; call-gm.mjs `askTraitByCard`): no card's button carries `auto`, only the primary's own call.
    const auto = data.auto === "1";
    const { listedTraits, keepProjectPick } = await import("./trait-ruling.mjs");
    const spec = { kind: data.kind ?? "", key: data.key ?? "", variant: data.variant || null };
    if (!game.actors.get(data.by ?? "") || !listedTraits(spec).includes(data.trait)) {
        warn(`A statistic card offered "${data.trait}", which ${spec.kind} "${spec.key}" does not list; nothing was answered.`);
        return null;
    }
    await keepProjectPick(spec, data.trait);
    const { answerTraitRuling } = await import("./gm-bridge.mjs");
    if (!answerTraitRuling(data.rid, data.asker, data.trait)) return null;
    const proposed = listedTraits(spec).includes(data.proposed) ? data.proposed : null;
    const how = !proposed ? "picked" : proposed === data.trait ? "approved" : "changed";
    return { settled: auto ? game.i18n.localize("DRPG.TraitRuling.autoApproved") : { key: "DRPG.Bridge.settledUnconfirmed", name: game.user.name },
        ruling: { type: "trait", actorId: data.by, ...spec, trait: data.trait, ...(proposed ? { proposed } : {}), how, ...(auto ? { auto: true } : {}) } };
}

// Refuse: the action is not taken, and nothing was spent for it.
async function ruleRefuseTrait(action, data) {
    const { answerTraitRuling } = await import("./gm-bridge.mjs");
    if (!answerTraitRuling(data.rid, data.asker, false)) return null;
    return settled("DRPG.Bridge.settledDeclined");
}

// A Tier 0 item used creatively (ITEM-07). The ruling used to be a console
// call - `game.drpg.grantItemEffect(...)` - and so was never made: the
// "seemingly useless item" stayed in the bag holding a usable slot.
async function ruleItemWorksOrItemNoEffectOrItemRefuse(action, data, message = null) {
    const actor = game.actors.get(data.by);
    const item = actor?.items?.get(data.item);
    // Gone before the press (1.2.122, the audit's CTRL-23): the card settles with its line, where a null gave the
    // buttons back and said nothing - an item handed over left a card no button could close, Refuse included.
    if (!actor) return settled("DRPG.Bridge.settledNoCharacter");
    if (!item) return settled("DRPG.Items.rulingGone");
    const { grantItemEffect, ruleCreativeUse } = await import("./use-items.mjs");
    if (action === "itemRefuse") {
        const { postToThread } = await import("./messenger.mjs");
        const owner = rulingThread(actor, message);
        const note = `<p><em>${foundry.utils.escapeHTML(
            game.i18n.format("DRPG.Items.creativeRefused", { item: item.name }))}</em></p>`;
        if (owner) await postToThread(owner.id, note);
        return settled("DRPG.Bridge.settledDeclined");
    }
    // One ruling at a time on an item, and none on one gone or used up meanwhile (E14 part 1 C5; audit S08-35):
    // held on this GM by `ruleCreativeUse`, which reads the item before the window and again after it.
    // Taken over by another GM while the effect's window stood open: no effect (2.0 line T2, CALLS-01; `takenOverMeanwhile`).
    const ask = action === "itemNoEffect" ? async () => ({ amounts: {}, consume: true })
        : () => askItemEffect(item).then(async r => ((await takenOverMeanwhile(message)) ? null : r));
    const done = await ruleCreativeUse(actor, item.id, ask,
        ruling => grantItemEffect(actor, actor.items.get(item.id) ?? item, ruling.amounts, { consumeItem: ruling.consume }));
    if (done?.busy) {
        ui.notifications.warn(game.i18n.format("DRPG.Items.rulingOpen", { item: item.name }));
        return null;
    }
    if (done?.gone) return settled("DRPG.Items.rulingGone");
    return done ? settled("DRPG.Bridge.settledHandled") : null;
}

// The two halves of the direct-murder gate. The declaration is already
// parked and the action already spent; what these decide is whether it is
// allowed to become an incident when the lights come up - and, since E68 C9, on which
// statistic its opening rolls: each Allow and Change to names one (`data.trait`), which
// `ruleOnParkedMurder` reads against the killer's list.
async function ruleApproveMurderOrRefuseMurder(action, data) {
    const { ruleOnParkedMurder } = await import("./eclipse.mjs");
    const ruled = await ruleOnParkedMurder(data.killer, action === "approveMurder", action === "approveMurder" ? data.trait ?? null : null);
    // `false` is a refusal that went through; `null` is nothing happening
    // at all, and only that leaves the card open.
    if (ruled === null || ruled === undefined) return null;
    return settled(ruled ? "DRPG.Bridge.settledApproved" : "DRPG.Bridge.settledDeclined");
}

async function rulePlantTrapItem(action, data) {
    const { openPlantDialog } = await import("./traps.mjs");
    const planted = await openPlantDialog(data.project);
    return planted ? settled("DRPG.Trap.plantSettled") : null;
}

async function ruleRearmTrap(action, data) {
    /*
     * "NOT THIS ONE." The other half of trap 153.
     *
     * A trap disarms itself the moment it speaks, so a Main Hall watching
     * for "somebody enters" cannot fire twenty cards a session. That is
     * right, and it leaves the GM needing a way to say the reading was
     * wrong and the trap should keep watching - which must not be a console
     * call, because the GM is mid-scene when they need it.
     */
    // A project gone since the alert (1.2.122, the audit's CTRL-64): nothing to rearm, said so, and no store row
    // written for an id no countdown carries - the card read "The trap is watching again." over a deleted project.
    const { rawCountdown } = await import("./projects-secrecy.mjs");
    if (!rawCountdown(data.project ?? "")) return settled("DRPG.Trap.rearmGone");
    const { rearmTrap } = await import("./traps.mjs");
    const ok = await rearmTrap(data.project);
    return ok ? settled("DRPG.Trap.rearmed") : null;
}

async function ruleFireTrap(action, data) {
    // The murder screen with the builder as the killer, "indirect" ticked and
    // the student the trap read as the victim (E32+E07 C14, 03.10.2026; audit
    // S11-20): the card has carried them since it was built, and this passed
    // the builder alone, so the window proposed the first living student
    // instead. Proposed, not applied - the GM confirms who walked into it.
    const { openMurderDialog } = await import("./murder.mjs");
    const opened = await openMurderDialog({ killerId: data.killer, victimId: data.victim || null, indirect: true });
    return opened ? settled("DRPG.Bridge.settledHandled") : null;
}

async function ruleRepickProjectTarget(action, data) {
    // A Secret Passage's or a breach's completion refused (E68 C11; D023, projects.mjs `offerRepick`): the approval's pick
    // again, and the completion made on the primary with the new target. Closed with nothing chosen, the card stays open.
    const { openTargetRepick } = await import("./projects-ui.mjs");
    const done = await openTargetRepick(data.project);
    return done ? settled("DRPG.Passage.card.repickDone") : null;
}

async function ruleApproveProject(action, data) {
    // Prefilled, not applied. The GM asked for a proposal so they could
    // change it - approving straight into existence would be the old
    // behaviour with an extra click in front of it.
    const { openProjectDialog } = await import("./projects-ui.mjs");
    const made = await openProjectDialog({
        preset: {
            name: data.pname ?? "",
            // A card that names no target is Standard, read off the scale (audit S09-13).
            target: Number(data.target) || PROJECT_SCALE.everyday.progress,
            room: data.room || null,
            trait: data.trait || null,
            indirectMurder: Boolean(data.murder),
            condition: data.condition ?? "",
            // What the player wrote (E44 C9): the window opens on it, the GM may change it, and the project keeps what
            // the GM approved.
            description: data.description ?? "",
            // A Secret Passage's preset and the neighbour's index (E15 part 2 C2), read again in the GM's window.
            preset: data.preset || null,
            to: data.to ?? null,
            // The proposer, carried since the card was built and dropped
            // here until E10 - which is why no project has ever known whose
            // idea it was. `declineProject` below has always read the same
            // field, so the card was never the missing half.
            by: data.by ?? null
        }
    });
    return made ? settled("DRPG.Bridge.settledApproved") : null;
}

async function ruleDeclineProject(action, data, message = null) {
    // No action to refund: starting a project is a declaration, and the
    // cost is paid by working on it afterwards.
    const actor = game.actors.get(data.by);
    if (!actor) return settled("DRPG.Bridge.settledNoCharacter");   // Deleted meanwhile (CTRL-23): said, not silent.
    const { postToThread } = await import("./messenger.mjs");
    const owner = rulingThread(actor, message);
    const note = `<p><em>${foundry.utils.escapeHTML(
        game.i18n.format("DRPG.Project.declinedPlayer", { name: game.user.name }))}</em></p>`;
    if (owner) await postToThread(owner.id, note);
    ui.notifications.info(game.i18n.format("DRPG.Project.declinedGm", { name: actor.name }));
    return settled("DRPG.Bridge.settledDeclined");
}

/*
 * N-3, 21.09: a reshaped trace is a proposal, like a project.
 *
 * The card carries which attempt it was raised for; the words are on that
 * attempt's row in the GMs' store, which survives a reload (E09 C10), and the
 * trace is read fresh inside `applyReshapeRuling`, because the thing being
 * ruled on is the trace as it stands now, not as it stood when the dice landed.
 * Ruled on the primary GM, whichever GM pressed (`askReshapeRuling`).
 */
async function ruleApproveReshape(action, data) {
    const { askReshapeRuling } = await import("./gm-bridge.mjs");
    const applied = await askReshapeRuling("approve", { by: data.by, trace: data.trace, attempt: data.attempt ?? "" });
    /* `false` is a ruling that went through - a Reroll had taken the attempt back,
       and the card says so - where `null` leaves the card open to be answered. The
       same split `ruleApproveMurderOrRefuseMurder` draws. */
    if (applied === false) return settled("DRPG.Cleanup.reshapeVoided");
    // The Remnant gone: settled, said so (cleanup-reshape.mjs `applyReshapeRuling`, the audit's CTRL-55, 1.2.122).
    if (applied === "gone") return settled("DRPG.Cleanup.reshapeSettledGone");
    return applied ? settled("DRPG.Bridge.settledApproved") : null;
}

async function ruleDeclineReshape(action, data) {
    // No refund, and the comment on `proposeReshape` says why: the Sanity
    // and the turn bought the attempt, and the attempt happened.
    const { askReshapeRuling } = await import("./gm-bridge.mjs");
    const told = await askReshapeRuling("decline", { by: data.by, trace: data.trace, attempt: data.attempt ?? "" });
    if (told === false) return settled("DRPG.Cleanup.reshapeVoided");
    return told ? settled("DRPG.Bridge.settledDeclined") : null;
}

/*
 * AN OBSERVE'S FOCUSED GAZE (E09 C12; audit S05-27). "Pick a trace" opens the picker on this
 * GM's browser and sends the pick to the primary GM, which checks it against the traces the
 * character could be shown now and answers the player (observe.mjs `pickFromCard`, bridge-asks.mjs
 * `askObservePick`). A pick the primary did not take leaves the card open, unless nobody is
 * waiting on it any more - then the card says so. The card carries the ask's request id, the
 * character and the player's own words, and no trace.
 */
async function rulePickObserveTrace(action, data) {
    const { pickFromCard } = await import("./observe.mjs");
    const picked = await pickFromCard({ rid: data.rid, by: data.by, request: data.desc ?? "" });
    if (picked === "gone") return settled("DRPG.Observe.pickGone");
    return picked === "picked" ? settled("DRPG.Bridge.settledAnswered") : null;
}

async function ruleRefuseObserveTrace(action, data) {
    const { askObservePick } = await import("./gm-bridge.mjs");
    const refused = await askObservePick({ rid: data.rid, actorId: data.by, refuse: true });
    if (refused === "gone") return settled("DRPG.Observe.pickGone");
    return refused === "refused" ? settled("DRPG.Bridge.settledDeclined") : null;
}

// ---------------------------------------------------------------- generic
//
// Every ruling card carries at least one of these two, or one of the
// named actions above (a Hope Call, a Dynamic threshold, an item's effect).
// The mechanism was already here and only Direct Murder and Propose a
// Project used it, so a Search for something specific, an Observe at a
// point of interest, a Listen, an Analyze hint and a Dynamic action all
// arrived as a card with a roll on it and nothing to press - the GM read
// the number and then went looking for the window that answers it.
async function ruleReply(action, data, message = null) {
    // A ruling in words. Most of these branches have no mechanical answer
    // at all - "what do you overhear", "what does that door tell you" - and
    // the module's own answer to that has always been the thread the card
    // is already sitting in.
    const actor = game.actors.get(data.by);
    if (!actor) return settled("DRPG.Bridge.settledNoCharacter");   // Deleted meanwhile (CTRL-23): said, not silent.

    // On the kit (E21 C6a): Send on the right, the default; Cancel on the left. DialogV2 answers a button's callback or,
    // when that is null, its action, so Cancel answers "cancel" and a closed window null; neither is a `{ text }`, which
    // is all the reading below takes (E21 fix G2; the end review's correctness m3: this said Cancel answered null).
    const answer = await drpgWindow({
        classes: ["drpg-panel"],
        title: game.i18n.format("DRPG.Bridge.replyTitle",
            { name: actor.name }),
        body: `<form><p>${game.i18n.localize("DRPG.Bridge.replyPrompt")}</p>
            <textarea name="reply" rows="4"></textarea></form>`,
        footer: {
            primary: {
                // Not `DRPG.Bridge.send` - that key reads "Send to GM",
                // which is the right label on the PLAYER's window and the
                // wrong one here, where the GM is answering the player.
                action: "send", label: game.i18n.localize("DRPG.Bridge.sendRuling"),
                callback: (e, b, d) => ({ text: d.element.querySelector("[name=reply]").value.trim() })
            },
            close: { role: "cancel", action: "cancel", callback: () => null }
        },
        rejectClose: false
    });

    // `{ text }`, so a ruling reading "cancel" is a ruling (E18 C0, S11-60): Cancel answers its action's name,
    // "cancel" (its callback's null falls back to the action in DialogV2), and the words bare could not be told from it.
    const text = typeof answer?.text === "string" ? answer.text : "";
    if (!text || (await takenOverMeanwhile(message))) return null;   // Taken over meanwhile (2.0 line T2, CALLS-01).

    const { postToThread } = await import("./messenger.mjs");
    const owner = rulingThread(actor, message);
    // Named, not "The GM": rulings land as `action`-kind bubbles, which
    // carry no author line - with two Gamemasters at the table the player
    // had no way to tell whose ruling this was (Dawid, 26.08). `game.user`
    // is the GM who clicked, by construction.
    const body = `<p><strong>${foundry.utils.escapeHTML(
        game.i18n.format("DRPG.Bridge.rulingBy", { name: game.user.name }))}</strong> ${
        foundry.utils.escapeHTML(text)}</p>`;
    if (owner) await postToThread(owner.id, body);
    else await whisperToGms(body);
    return settled("DRPG.Bridge.settledAnswered");
}

/*
 * "NOTHING WAS THERE" IS A SEARCH'S RESULT, AND "NO HELP" A HINT'S (E16 part 2 C1, 26.10.2026;
 * audit S02-16). The "something specific" Search's card and the hint's said there was nothing
 * only through the refusal (`ruleDecline`), which gave the price back. This answer keeps it - the
 * character looked, or asked - and says the GM's ruling in the button's words, as
 * `ruleObserveMiss` does: the card settles as answered. Nothing is charged here: the price was
 * paid before the card was posted. `words` is the card's (the player's to rewrite), and picks
 * between two sentences only.
 */
async function ruleSearchMiss(action, data, message = null) {
    const actor = game.actors.get(data.by);
    if (!actor) return settled("DRPG.Bridge.settledNoCharacter");   // Deleted meanwhile (CTRL-23): said, not silent.
    const { postToThread } = await import("./messenger.mjs");
    const owner = rulingThread(actor, message);
    if (owner) {
        await postToThread(owner.id, `<p><strong>${foundry.utils.escapeHTML(
            game.i18n.format("DRPG.Bridge.rulingBy", { name: game.user.name }))}</strong> ${
            foundry.utils.escapeHTML(game.i18n.localize(data.words === "help" ? "DRPG.Bridge.noHelp" : "DRPG.Bridge.nothingThere"))}</p>`);
    }
    return settled("DRPG.Bridge.settledAnswered");
}

/*
 * "NOTHING WAS THERE" IS AN OBSERVE'S RESULT, NOT A REFUSAL (ACT-17, 20.09).
 *
 * The scored road charges `OBSERVE_FAIL_STRESS` for this outcome and the tile's
 * briefing prints the figure before the roll; the GM-ruled road sent the generic
 * refusal, which refunded the action and charged nothing. So asking a human
 * rather than rolling against a table made looking free - and the one branch
 * where a person decides there is nothing to find was the branch with no price
 * on it.
 *
 * The action is NOT refunded here, for the same reason it is not refunded on the
 * scored road: the character looked.
 */
async function ruleObserveMiss(action, data, message = null) {
    const actor = game.actors.get(data.by);
    if (!actor) return settled("DRPG.Bridge.settledNoCharacter");   // Deleted meanwhile (CTRL-23): said, not silent.

    const { chargeObserveMiss } = await import("./observe.mjs");
    await chargeObserveMiss(actor);

    /* A RESULT, AND SAID AS ONE (review of stage D). This posted the refusal's
       sentence - "{name} turned the attempt down. Your action is back." - and the GM
       a toast that the action was back, while nothing gave it back and
       `chargeObserveMiss` had just whispered "You take 1 Sanity". A table that
       believed the thread handed the action back by hand and undid ACT-17's price.
       It speaks the way `ruleReply` speaks now: the GM's ruling, in the ruling's
       words, and the card settles as answered, not declined. */
    const { postToThread } = await import("./messenger.mjs");
    const owner = rulingThread(actor, message);
    if (owner) {
        await postToThread(owner.id, `<p><strong>${foundry.utils.escapeHTML(
            game.i18n.format("DRPG.Bridge.rulingBy", { name: game.user.name }))}</strong> ${
            foundry.utils.escapeHTML(game.i18n.localize("DRPG.Bridge.nothingThere"))}</p>`);
    }
    return settled("DRPG.Bridge.settledAnswered");
}

/**
 * What a refused ruling hands back, read off the card - which is believed about
 * WHAT was paid and never about HOW MUCH.
 *
 * WHAT CAME BACK IS WHAT THE TABLE SAYS, NOT WHAT THE CARD CLAIMS (T-1). This
 * card is authored on the player's own client, so `data` is theirs to rewrite.
 * It used to carry an amount, read back with `Number(data.cost)` and handed to
 * `refundAction` - so a card edited to say 5 would have bought five actions from
 * any GM pressing the button. Every amount below comes from `PRICE_CHAINS`, and
 * a name the table does not know buys nothing at all.
 *
 * WHAT COMES BACK IS WHAT THE CARD SAYS WAS PAID (ACT-14, 20.09). A chain step
 * comes back as that step, a Burst as a Burst, and a free action as nothing:
 * `"none"` is what a free action writes, because an empty string was
 * indistinguishable from an absent attribute.
 *
 * THREE SHAPES ARE ALREADY IN CHAT LOGS, and a card posted weeks ago is still a
 * card a GM can press:
 *
 *   `{ paid: step, amount, grant }`   this release (`declineAction` in
 *                                     action-rolls.mjs); `amount` is ignored.
 *   `{ cost, paid: "grant" | "action" | "" }`
 *                                     1.2.43 to 1.2.47 (ROLL-13). "action" is
 *                                     also the chain's first step, so only
 *                                     "grant" needs a line of its own.
 *   `{ cost }`                        before either. `cost` is read for WHETHER
 *                                     anything was paid, never for how much:
 *                                     "0" is a free action, and the hint card
 *                                     that answers an Analyze which has already
 *                                     resolved (COMM-07, analyze.mjs) wrote
 *                                     exactly that until E09 C14, which gave it
 *                                     `paid: "none"`. A forged "0" only costs the
 *                                     person who forged it.
 *
 * Returns the receipt `refundPrice` takes, or null for nothing to give back.
 */
function refundOnCard(data) {
    if (data.paid === "none") return null;
    const steps = PRICE_CHAINS.analyze?.steps ?? [];
    const step = steps.find(s => s.pay === data.paid);
    if (step) {
        return { key: "analyze", pay: step.pay, amount: step.amount, grant: data.grant === "true" };
    }
    const action = steps.find(s => s.pay === "action") ?? { pay: "action", amount: 1 };
    if (data.paid === "grant") return { key: "analyze", pay: "action", amount: action.amount, grant: true };
    if (data.paid) return null;
    if (data.cost !== undefined && !(Number(data.cost) > 0)) return null;
    return { key: "analyze", pay: "action", amount: action.amount, grant: false };
}

async function ruleDecline(action, data, message = null) {
    // What was paid comes BACK: a refusal
    // here is the GM overruling the declaration rather than the rules
    // resolving it, and a player who spent an action on a question that was
    // never answered has spent nothing.
    const actor = game.actors.get(data.by);
    if (!actor) return settled("DRPG.Bridge.settledNoCharacter");   // Deleted meanwhile (CTRL-23): said, not silent.

    const receipt = refundOnCard(data);
    const { postToThread } = await import("./messenger.mjs");
    const owner = rulingThread(actor, message);
    if (!receipt) {
        // Said out loud because the silence used to be a refund.
        debug("A refused ruling had nothing to refund: the card says nothing was paid.");
        /* NOTHING CAME BACK, SO NOTHING IS SAID TO HAVE (E09 C14, 08.10.2026; audit S05-35). A
           card with nothing paid - a free Search's question, a free hint, and the Analyze
           critical's hint card (analyze.mjs) - told the player the GM "turned the attempt down"
           and that their action was back, while nothing was given back; on the critical it read
           as a refused hint the critical had earned. It is the GM's ruling and is said as one,
           the way `ruleObserveMiss` says its own, and the card settles as answered.
           IN THE PRESSED BUTTON'S WORDS (E09 fix r2-G7, 09.10.2026; review round 2's open item 9).
           C14 answered every such card "Nothing more to add.", and a free Search's "something
           specific" card and a hint asked of the GM (`declineAction`) carry the button "Nothing
           was there": the GM pressed one sentence and the thread read another. Measured with
           tier 2's "a free card's Nothing was there and a critical's Nothing more to add each
           answer in their own words" on the code before this: the Search's line read "Nothing
           more to add.". The card names its button's sentence in `words` ("there" or "more");
           a card that names none was posted before 1.2.71, when both cards' button read "Nothing
           was there" (read in the code at 1.2.70). The card is the player's (see `declineAction`), so `words` picks between
           these two sentences and nothing else. */
        /* "refused" since E16 part 2 C1: the refusal's button reads "Refuse the attempt" there, and
           "Nothing was there" is its own answer (`ruleSearchMiss`). */
        const words = data.words === "more" ? "DRPG.Bridge.nothingMore"
            : data.words === "refused" ? "DRPG.Bridge.attemptRefused" : "DRPG.Bridge.nothingThere";
        if (owner) {
            await postToThread(owner.id, `<p><strong>${foundry.utils.escapeHTML(
                game.i18n.format("DRPG.Bridge.rulingBy", { name: game.user.name }))}</strong> ${
                foundry.utils.escapeHTML(game.i18n.localize(words))}</p>`);
        }
        return settled("DRPG.Bridge.settledAnswered");
    }
    /* THE ROLL THE CARD RULES ON, AND WHAT IT BROUGHT (E129, 1.2.128; config.mjs `ROLL_REFUNDS.gmRefuse`, which asks
       `afterRoll` while it is null; REFUNDS.md row 12). A ruling card is posted after its dice, which had paid out their
       Hope, and "Refuse the attempt" gave the price back as well. The card holds no link to its roll (`declineAction`'s
       data), so the roll is the GMs' newest record of this character's Observe, Search or Analyze thrown before the card
       (`rulingRollOf`), and price.mjs `mayRefundAfterRoll` rules on it: under "noHope" the price comes back only where it
       brought neither Hope nor a critical, under the owner's "always" (config.mjs, 23.11.2026) whatever it brought, so
       the lookup changes nothing at the table until the key changes. No record found - a card from before the GMs kept
       them - gives it back as before. */
    const { refundPrice, mayRefundAfterRoll } = await import("./price.mjs");
    const rolled = await rulingRollOf(actor, message);
    const back = !rolled || mayRefundAfterRoll([rolled], { gmRefuse: true });
    if (back) await refundPrice(actor, receipt);

    const note = `<p><em>${foundry.utils.escapeHTML(
        game.i18n.format("DRPG.Bridge.declined", { name: game.user.name }))}</em></p>${back ? ""
        : `<p>${foundry.utils.escapeHTML(game.i18n.localize("DRPG.Action.keptAfterRoll"))}</p>`}`;
    if (owner) await postToThread(owner.id, note);
    ui.notifications.info(game.i18n.format("DRPG.Bridge.declinedGm", { name: actor.name }));
    return settled("DRPG.Bridge.settledDeclined");
}

/** The kinds of roll a ruling card with "Refuse the attempt" is posted for (action-pipeline.mjs `declineAction`'s callers). */
const RULED_ROLLS = Object.freeze(["observe", "search", "analyze"]);

/** The GMs' newest record of `actor`'s ruled roll thrown before `message` (the card), `{ isCritical, withHope }`, or null. */
async function rulingRollOf(actor, message) {
    const { rollStore } = await import("./gm-stores.mjs");
    await rollStore.whenHydrated();
    const before = Number(message?.timestamp) || Date.now();
    const row = Object.values(rollStore.entries() ?? {})
        .filter(r => r?.actorId === actor.id && RULED_ROLLS.includes(r.actionKey) && Number(r.at) <= before)
        .sort((a, b) => Number(b.at) - Number(a.at))[0];
    return row ? { isCritical: Boolean(row.isCritical), withHope: Boolean(row.withHope) } : null;
}

async function ruleCreateItem(action, data) {
    // Prefilled, never applied - same rule as `approveProject`. The roll
    // already decided the tier and the player already named the category
    // and the room, so the form opens with all three answered and the GM
    // writes the one thing only they know: what was actually there.
    const { openItemTables } = await import("./tables.mjs");
    /* The item tables already open take the card's preset, opened again on it, unless something is typed in their Add
       an item; then they stay as they are and the GM is told (tables-editor.mjs `openItemTables`; 1.2.122, CTRL-25). */
    return openItemTables({
        preset: {
            category: data.category || null,
            tier: Number(data.tier) || 0,
            room: data.room || null,
            name: data.want || ""
        }
    });
}

async function ruleGiveItem(action, data) {
    // The other half of the same ruling: the thing they were looking for
    // exists already, so it goes straight onto the sheet rather than into a
    // table first.
    const actor = game.actors.get(data.by);
    if (!actor) return settled("DRPG.Bridge.settledNoCharacter");   // Deleted meanwhile (CTRL-23): said, not silent.
    const { gmGiveItemDialog } = await import("./gm-items.mjs");
    const given = await gmGiveItemDialog(actor);
    return given ? settled("DRPG.Bridge.settledHandled") : null;
}

async function ruleKeyRemnantHere(action, data) {
    const { openKeyRemnantHere } = await import("./investigation.mjs");
    // `data.scene` is the scene the PLAYER was standing on, carried since
    // audit A6 - this GM is very often looking at a different one.
    const placed = await openKeyRemnantHere({
        room: data.room || null, note: data.want || "", sceneId: data.scene || null
    });
    return placed ? settled("DRPG.Bridge.settledHandled") : null;
}

/** What each button on a ruling card does, by its action. GM side, by construction. */
const CARD_ACTIONS = {
    approveCall: ruleApproveCallOrRefuseCall,
    refuseCall: ruleApproveCallOrRefuseCall,
    setDifficulty: ruleSetDifficulty,
    refuseDynamic: ruleRefuseDynamic,
    pickTrait: rulePickTrait,
    refuseTrait: ruleRefuseTrait,
    itemWorks: ruleItemWorksOrItemNoEffectOrItemRefuse,
    itemNoEffect: ruleItemWorksOrItemNoEffectOrItemRefuse,
    itemRefuse: ruleItemWorksOrItemNoEffectOrItemRefuse,
    approveMurder: ruleApproveMurderOrRefuseMurder,
    refuseMurder: ruleApproveMurderOrRefuseMurder,
    plantTrapItem: rulePlantTrapItem,
    rearmTrap: ruleRearmTrap,
    fireTrap: ruleFireTrap,
    approveProject: ruleApproveProject,
    repickProjectTarget: ruleRepickProjectTarget,
    declineProject: ruleDeclineProject,
    approveReshape: ruleApproveReshape,
    declineReshape: ruleDeclineReshape,
    pickObserveTrace: rulePickObserveTrace,
    refuseObserveTrace: ruleRefuseObserveTrace,
    reply: ruleReply,
    observeMiss: ruleObserveMiss,
    searchMiss: ruleSearchMiss,
    decline: ruleDecline,
    createItem: ruleCreateItem,
    giveItem: ruleGiveItem,
    keyRemnantHere: ruleKeyRemnantHere,
    // E72 C5: a Monocub's Ask for Hope, answered once by whichever GM clicks (monocub.mjs `answerHopeAsk`).
    cubGiveHope: ruleCubHope,
    cubNotNow: ruleCubHope
};

/** Give 1, Give 2 or Not now on a Monocub's Ask for Hope (E72 C5): the GM's own Despair, or none. */
async function ruleCubHope(action, data) {
    const actor = game.actors.get(data.actor);
    if (!actor) return settled("DRPG.Bridge.settledNoCharacter");   // Deleted meanwhile (CTRL-23): said, not silent.
    const { answerHopeAsk } = await import("./monocub.mjs");
    const words = await answerHopeAsk(actor, action === "cubGiveHope" ? Number(data.n) || 0 : 0);
    return words ? { settled: words } : null;
}

/** The rule of the button pressed, handed the card it is on (`message`, fix early-C2-G2), or null for none. */
export async function runCallAction(action, data, message = null) {
    const rule = CARD_ACTIONS[action];
    if (!rule) return null;
    if (message && actsOnCardCharacter(action) && !writerOwns(message, data?.[CARD_CHARACTER_FIELD[action] ?? "by"])) {
        ui.notifications.warn(game.i18n.localize("DRPG.Bridge.notTheirCharacter"));
        return settled("DRPG.Bridge.settledNotTheirs");
    }
    return rule(action, data, message);
}

/*
 * A RULING ACTS ONLY ON A CHARACTER THE CARD'S WRITER OWNS (1.2.122, the audit's COMM-21). These rulings act on the
 * card's own `data.by` - charge it Sanity (Nothing was there), use up its item, refund it, give it an item, answer in its
 * owner's thread - and the card is written on the roller's browser, so its data is that player's to rewrite: a card a
 * console posted naming a classmate made a GM's press charge the classmate. The asks the primary holds (a Call, a Dynamic
 * action, a statistic, an Observe's pick) go by their `rid` and are not in this list. A card a GM wrote is the GM's.
 */
const CARD_CHARACTER_RULINGS = Object.freeze(new Set(["itemWorks", "itemNoEffect", "itemRefuse", "declineProject", "reply",
    "searchMiss", "observeMiss", "decline", "giveItem"]));

/*
 * AND THE TWO THAT NAME THEIR CHARACTER ANOTHER WAY (1.2.123, the audit's r122-G-3, the rest of COMM-21). Give and Not now
 * on a Monocub's Ask for Hope read `data.actor`, not `data.by`, and were in no list: a card a player's console posted
 * naming a friend's Monocub turned a GM's press into the GM's Despair as that Monocub's Hope. The module's own Ask card is
 * a GM's (monocub.mjs `postHopeAsk` runs on a GM), so it passes `writerOwns` as before.
 */
const CARD_CHARACTER_FIELD = Object.freeze({ cubGiveHope: "actor", cubNotNow: "actor" });

function actsOnCardCharacter(action) {
    return CARD_CHARACTER_RULINGS.has(action) || Object.hasOwn(CARD_CHARACTER_FIELD, action);
}

/** Whether the card's writer may name `actorId`: a GM's card, or a player's about a character that player owns. */
function writerOwns(message, actorId) {
    const writer = cardWriter(message);
    if (!writer || writer.isGM) return true;
    const actor = game.actors.get(actorId ?? "");
    // No such character: the ruling's own line says so (`settledNoCharacter`, CTRL-23).
    if (!actor) return true;
    return actor.testUserPermission?.(writer, "OWNER") === true;
}

/* ==========================================================================
 * POSITION MEMORY
 * ========================================================================== */

/**
 * Where this window was, and NOT how big it was.
 *
 * The remembered geometry used to carry the size too, and that quietly cancelled
 * the popup normalisation for everybody who had ever opened this window before
 * it: the default went 360 → 544, and every returning GM kept getting 360 back
 * out of their own settings. Measured - a fresh account opened at 544, an old
 * one at 360, with nothing in the code to explain the difference.
 *
 * Stored sizes are dropped on read rather than deleted from the setting, so a
 * world that has them loses nothing except their effect, and nobody has to run
 * a migration to get the width the module says it uses.
 */
function readSavedPosition(playerUserId) {
    try {
        const all = game.settings.get(MODULE_ID, SETTINGS.messengerWindowPositions) ?? {};
        const saved = all[playerUserId];
        if (!saved) return null;
        const { left, top } = saved;
        return (left === undefined && top === undefined) ? null : { left, top };
    } catch {
        return null;
    }
}

function savePosition(playerUserId, position) {
    try {
        const all = game.settings.get(MODULE_ID, SETTINGS.messengerWindowPositions) ?? {};
        // Position only. A window somebody dragged should reopen where they
        // left it; a window somebody resized should still obey the module's
        // one popup width, because that width is a decision about the whole
        // interface rather than about this window.
        const { left, top } = position ?? {};
        game.settings.set(MODULE_ID, SETTINGS.messengerWindowPositions, {
            ...all,
            [playerUserId]: { left, top }
        });
    } catch (err) {
        error("Messenger: could not save window position.", err);
    }
}

/* ==========================================================================
 * THE LAUNCHER
 * --------------------------------------------------------------------------
 * Deliberately its own floating element rather than DOM injected into the
 * Players sidebar or the campaign HUD - both are foreign or shared territory
 * whose structure this module does not own. A self-built button in a fixed
 * corner cannot be broken by either one changing shape.
 * ========================================================================== */

/*
 * ONE BUTTON, REDRAWN IN PLACE (1.2.122, the audit's COMM-34). Every thread event - a message, a read, an edited card,
 * a deletion, each card's words landing after a return - took the launcher off the page and built a new one, so a
 * keyboard user's focus on it went back to the page and a hover tooltip went with the node. It is made once now, and
 * a later call writes only its tooltip, its name and its badge, each when it changed; the GM's window's list follows
 * the same call (messenger-gm.mjs `refreshNav`; the roster's rows until 1.2.124, REFR-15). The count is still one
 * `threadStats` pass a call (messenger.mjs).
 */
export function renderLauncher() {
    try {
        let button = document.getElementById(LAUNCHER_ID);
        const made = !button;
        if (made) {
            button = document.createElement("button");
            button.type = "button";
            button.id = LAUNCHER_ID;
            button.innerHTML = `<i class="fa-solid fa-comments" inert></i>`;
        }
        // Its language, the page's (E66 fix r1 F1; C1's `lang` on the module's containers, STATUS Open 3 and 19).
        markLanguage(button);
        const tip = launcherTooltip();
        if (button.dataset.tooltip !== tip) button.dataset.tooltip = tip;
        if (button.getAttribute("aria-label") !== tip) button.setAttribute("aria-label", tip);

        // One count of every thread (messenger.mjs `threadStats`, E50 C2): a GM's every player's, a player's own.
        const unread = totalUnread();
        let badge = button.querySelector(".drpg-messenger-badge");
        if (unread > 0) {
            if (!badge) {
                badge = document.createElement("span");
                badge.className = "drpg-messenger-badge";
                button.append(badge);
            }
            const count = unread > 99 ? "99+" : String(unread);
            if (badge.textContent !== count) badge.textContent = count;
        } else badge?.remove();

        // The GM's window's list follows the same call as the badge (1.2.124: a message, a read, an edited card).
        gmMessengerWindow()?.refreshNav();
        if (!made) return;

        button.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            // Its own key rather than the generic button one: this circle is
            // not inside any window, so the delegated listener in sfx.mjs
            // never sees it - and the chat opening is a moment of its own.
            playSfx("chatOpen");
            if (game.user.isGM) openGmMessenger("console");
            else openMessenger(game.user.id);
        });

        document.body.append(button);
    } catch (err) {
        error("Could not render the messenger launcher", err);
    }
}

function launcherTooltip() {
    return game.i18n.localize("DRPG.Messenger.launcherTooltip");
}

export function stripHtml(html) {
    // The same trimming the thread itself does: no ruling buttons, no GM-only
    // prose for a player, and the browser's own text extraction - with the card's
    // blocks kept apart: `textContent` ran a card's title into its first line
    // ("SearchBotan Kage", the GM's list on the owner's shots of 22.11.2026), so a
    // title is followed by " - " and every other block by a space.
    const wrap = cardPreview(html);
    for (const block of wrap.querySelectorAll("h1, h2, h3, h4, h5, h6")) block.append(" - ");
    for (const block of wrap.querySelectorAll("p, div, li, blockquote, br")) block.after(" ");
    return wrap.textContent.replace(/\s+/g, " ").replace(/\s+-\s*$/, "").trim();
}
