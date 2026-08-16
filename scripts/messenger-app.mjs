/**
 * Danganronpa RPG — messenger windows and launcher.
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
 *                      open a roster — every player, an unread badge, a
 *                      one-line preview — and picks who to open.
 *
 * No Handlebars template: the rest of this module builds DOM by hand, so
 * ApplicationV2 is used here without the Handlebars mixin, for the same
 * reason — one way of building markup, not two.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { gmIds, ownerOf, error } from "./utils.mjs";
import { showPopup } from "./popup.mjs";
import {
    MESSENGER_FLAGS, THREAD_KIND,
    threadUsers, isThreadUser, threadMessages, lastMessage,
    unreadCount, totalUnread, markThreadRead, sendMessage
} from "./messenger.mjs";
import { noteFor, noteStatus, noteTemplate, saveNote } from "./pre-session-note.mjs";

const LAUNCHER_ID = "drpg-messenger-launcher";
const CASEBOOK_LAUNCHER_ID = "drpg-casebook-launcher";

export function registerMessengerUi() {
    Hooks.once("ready", renderLauncher);
    Hooks.on("canvasReady", () => renderLauncher());
    Hooks.on("drpgMessengerMessage", () => renderLauncher());
    Hooks.on("drpgMessengerRead", () => renderLauncher());
    // The Casebook launcher appears and disappears with the phase, so it has to
    // follow the clock as well as the messenger's own events.
    Hooks.on("drpgTimeOfDayChanged", () => renderLauncher());

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
    if (!isThreadUser(playerUserId)) {
        ui.notifications.warn(game.i18n.localize("DRPG.Messenger.notAPlayer"));
        return null;
    }

    const existing = DrpgMessengerApp.instances.get(playerUserId);
    if (existing) {
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

export class DrpgMessengerApp extends foundry.applications.api.ApplicationV2 {
    /** One instance per player thread, so opening twice just refocuses it. */
    static instances = new Map();

    static DEFAULT_OPTIONS = {
        classes: ["drpg-messenger"],
        window: {
            icon: "fa-solid fa-comments",
            resizable: true,
            minimizable: true
        },
        // The module's standard popup width, in pixels because DEFAULT_OPTIONS
        // cannot read a CSS custom property. Keep in step with `--drpg-popup`
        // in danganronpa.css; it was 360, the narrowest of seven different
        // window widths the module used to open.
        position: {
            width: 544,
            height: 520
        }
    };

    /**
     * Which half of the window is showing: the conversation, or the player's
     * pre-session note. Per instance, so a GM with four players open can be
     * reading one person's note and another's chat at the same time.
     */
    tab = "chat";

    constructor(playerUserId) {
        const options = { id: `drpg-messenger-${playerUserId}` };
        // Only set `position` when there is a saved one — passing `undefined`
        // through to ApplicationV2's option merge is not guaranteed to fall
        // back to DEFAULT_OPTIONS.position the way omitting the key does.
        //
        // The size comes from DEFAULT_OPTIONS every time and is spread in here
        // explicitly rather than left to ApplicationV2's option merge, which the
        // comment above already records as not reliable in this direction.
        const saved = readSavedPosition(playerUserId);
        if (saved) {
            options.position = { ...DrpgMessengerApp.DEFAULT_OPTIONS.position, ...saved };
        }
        super(options);
        this.playerUserId = playerUserId;
    }

    get title() {
        if (!game.user.isGM) return game.i18n.localize("DRPG.Messenger.playerWindowTitle");
        const player = game.users.get(this.playerUserId);
        return game.i18n.format("DRPG.Messenger.gmWindowTitle", { player: player?.name ?? "?" });
    }

    async _prepareContext(_options) {
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
        root.className = "drpg-messenger-body";

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
            <textarea name="text" rows="1"
                placeholder="${foundry.utils.escapeHTML(game.i18n.localize("DRPG.Messenger.placeholder"))}"></textarea>
            <button type="submit" aria-label="${foundry.utils.escapeHTML(game.i18n.localize("DRPG.Messenger.send"))}">
                <i class="fa-solid fa-paper-plane"></i>
            </button>`;
        root.append(form);

        return root;
    }

    /** Chat | Note. The note carries a dot when there is something written. */
    _buildTabs(context) {
        const bar = document.createElement("nav");
        bar.className = "drpg-messenger-tabs";

        for (const [key, labelKey] of [["chat", "DRPG.Messenger.tabChat"], ["note", "DRPG.Note.tab"]]) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `drpg-messenger-tab${this.tab === key ? " active" : ""}`;
            button.dataset.drpgTab = key;
            button.textContent = game.i18n.localize(labelKey);
            if (key === "note" && context.note.trim()) {
                const dot = document.createElement("span");
                dot.className = "drpg-messenger-tab-dot";
                bar.dataset.hasNote = "true";
                button.append(dot);
            }
            bar.append(button);
        }
        return bar;
    }

    /**
     * The note itself: one textarea, and nothing between the player and it.
     *
     * Not a form of seven separate fields. The handbook's own answer format is
     * free text — "If nothing has changed, just write 'No changes' - and that
     * counts as done" — and seven required inputs would quietly turn a checklist
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
        area.placeholder = game.i18n.localize("DRPG.Note.placeholder");
        wrap.append(area);

        const row = document.createElement("div");
        row.className = "drpg-messenger-note-actions";

        const status = document.createElement("span");
        status.className = "drpg-messenger-note-status";
        status.textContent = context.noteStatus;
        row.append(status);

        if (!context.note.trim()) {
            const fill = document.createElement("button");
            fill.type = "button";
            fill.className = "drpg-messenger-note-template";
            fill.textContent = game.i18n.localize("DRPG.Note.useTemplate");
            fill.addEventListener("click", () => { area.value = noteTemplate(); area.focus(); });
            row.append(fill);
        }

        const save = document.createElement("button");
        save.type = "button";
        save.className = "drpg-messenger-note-save";
        save.textContent = game.i18n.localize("DRPG.Note.save");
        save.addEventListener("click", async () => {
            save.disabled = true;
            try {
                const ok = await saveNote(this.playerUserId, area.value);
                if (ok) {
                    status.textContent = game.i18n.localize("DRPG.Note.saved");
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

    async _replaceHTML(result, content, _options) {
        content.replaceChildren(result);
    }

    _onRender(_context, _options) {
        for (const button of this.element.querySelectorAll("[data-drpg-tab]")) {
            button.addEventListener("click", () => {
                this.tab = button.dataset.drpgTab;
                this.render();
            });
        }

        const form = this.element.querySelector(".drpg-messenger-input");
        const textarea = form?.querySelector("textarea");

        form?.addEventListener("submit", async event => {
            event.preventDefault();
            const text = textarea.value;
            if (!text.trim()) return;
            textarea.value = "";
            textarea.disabled = true;
            try {
                await sendMessage(this.playerUserId, text);
            } finally {
                textarea.disabled = false;
                textarea.focus();
            }
        });

        textarea?.addEventListener("keydown", event => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                form.requestSubmit();
            }
        });

        this._scrollToBottom();
        markThreadRead(this.playerUserId);
        textarea?.focus();
    }

    /** Called by the module-level createChatMessage hook — no re-render. */
    appendMessage(message) {
        const log = this.element?.querySelector(".drpg-messenger-log");
        if (!log) return;
        log.querySelector(".drpg-messenger-empty")?.remove();
        log.append(buildBubble(message));
        this._scrollToBottom();
        // The window is on screen — count it as read immediately rather than
        // leaving a badge for a conversation the user is looking straight at.
        markThreadRead(this.playerUserId);
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

// The module-level hook lives here, not per instance: one listener regardless
// of how many windows are open, and nothing to leak when one closes.
Hooks.on("drpgMessengerMessage", (playerUserId, message) => {
    const instance = DrpgMessengerApp.instances.get(playerUserId);
    if (instance) {
        instance.appendMessage(message);
        return;
    }

    // The player's own window is not open — surface the reply the same way
    // every other message on their screen appears, with a click that jumps
    // straight to the conversation. GMs keep the roster badge for this; it
    // already tells them who wrote.
    if (game.user.isGM || game.user.id !== playerUserId) return;
    const authorId = message.author?.id ?? message.user?.id;
    if (authorId === game.user.id) return;

    showPopup(message.content, {
        title: game.i18n.localize("DRPG.Messenger.playerWindowTitle"),
        onClick: () => openMessenger(playerUserId)
    });
});

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

function buildBubble(message) {
    const authorId = message.author?.id ?? message.user?.id;
    const author = game.users.get(authorId);
    const mine = authorId === game.user.id;
    const kind = message.getFlag(MODULE_ID, MESSENGER_FLAGS.kind);
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
    // Both callers of createThreadMessage() already hand over safe HTML —
    // sendMessage() escapes free text before this ever runs, postToThread()
    // is fed the GM-bridge's own escaped ruling cards.
    body.innerHTML = message.content;
    wireCallActions(body);
    bubble.append(body);

    const time = document.createElement("div");
    time.className = "drpg-messenger-time";
    time.textContent = new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    bubble.append(time);

    return bubble;
}

/**
 * Make the buttons on a ruling card work.
 *
 * A declaration card used to be a wall of text with "Awaiting a ruling" at the
 * bottom and nothing to press. Acting on it meant the GM panel, "Open a murder",
 * and picking the killer and the victim off two lists — retyping, by hand, the
 * two names printed in the paragraph above the button that was not there.
 *
 * Removed for a player rather than hidden by CSS: a button that is not in the
 * DOM cannot be clicked by anybody reading their own thread.
 */
function wireCallActions(body) {
    const buttons = body.querySelectorAll("[data-drpg-call]");
    if (!buttons.length) return;

    if (!game.user.isGM) {
        for (const button of buttons) button.closest(".drpg-call-actions")?.remove();
        return;
    }

    for (const button of buttons) {
        button.addEventListener("click", async event => {
            event.preventDefault();
            event.stopPropagation();
            button.disabled = true;
            try {
                await runCallAction(button.dataset.drpgCall, { ...button.dataset });
            } catch (err) {
                button.disabled = false;
                error("Could not act on the ruling card", err);
            }
        });
    }
}

/** What each button on a ruling card does. GM side, by construction. */
async function runCallAction(action, data) {
    if (action === "openMurder") {
        const { openMurder } = await import("./murder.mjs");
        return openMurder({ killerId: data.killer, victimId: data.victim });
    }

    if (action === "fireTrap") {
        // The trap names a condition, not a victim — so this opens the murder
        // screen with the killer already filled in and "indirect" already
        // ticked, and asks the one thing the condition cannot answer: who
        // walked into it.
        const { openMurderDialog } = await import("./murder.mjs");
        return openMurderDialog({ killerId: data.killer, indirect: true });
    }

    if (action === "declineMurder") {
        // The refusal is the GM overruling the declaration, not the rules
        // resolving it — so the action comes back. A witness in the room is the
        // other thing, and that one keeps the attempt spent (see
        // `performDirectMurder`).
        const actor = game.actors.get(data.killer);
        if (!actor) return null;
        const { refundAction } = await import("./actions.mjs");
        await refundAction(actor, 1);
        const { postToThread } = await import("./messenger.mjs");
        const owner = ownerOf(actor);
        const note = `<p><em>${game.i18n.localize("DRPG.Bridge.declined")}</em></p>`;
        if (owner) await postToThread(owner.id, note);
        ui.notifications.info(game.i18n.format("DRPG.Bridge.declinedGm", { name: actor.name }));
        return true;
    }

    return null;
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
 * out of their own settings. Measured — a fresh account opened at 544, an old
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
 * Players sidebar or the campaign HUD — both are foreign or shared territory
 * whose structure this module does not own. A self-built button in a fixed
 * corner cannot be broken by either one changing shape.
 * ========================================================================== */

/**
 * The Casebook, beside the Messenger, for the length of a Class Trial.
 *
 * A trial is four hours of one activity: reading your own Truth Bullets and
 * putting them in front of the table. The way in was a small icon on the
 * character sheet, so the sheet had to be open and on the right tab — during the
 * one stretch of the game where the sheet is otherwise not needed at all.
 *
 * Only during a Class Trial, and only for somebody with a character. Outside a
 * trial the Casebook is a reference you consult occasionally, and a permanent
 * second launcher would be clutter for a button nobody is reaching for.
 */
function renderCasebookLauncher() {
    document.getElementById(CASEBOOK_LAUNCHER_ID)?.remove();

    if (game.user.isGM) return;
    const actor = game.user.character;
    if (!actor) return;

    let inTrial = false;
    try {
        inTrial = game.settings.get(MODULE_ID, SETTINGS.clock)?.phase === "classTrial";
    } catch {
        return;
    }
    if (!inTrial) return;

    const button = document.createElement("button");
    button.type = "button";
    button.id = CASEBOOK_LAUNCHER_ID;
    const tip = game.i18n.localize("DRPG.Casebook.launcherTooltip");
    button.dataset.tooltip = tip;
    button.setAttribute("aria-label", tip);
    button.innerHTML = `<i class="fa-solid fa-book-open" inert></i>`;

    button.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        const { openCasebook } = await import("./casebook.mjs");
        await openCasebook(actor);
    });

    document.body.append(button);
}

export function renderLauncher() {
    try {
        renderCasebookLauncher();
        document.getElementById(LAUNCHER_ID)?.remove();

        const button = document.createElement("button");
        button.type = "button";
        button.id = LAUNCHER_ID;
        button.dataset.tooltip = launcherTooltip();
        button.setAttribute("aria-label", launcherTooltip());
        button.innerHTML = `<i class="fa-solid fa-comments" inert></i>`;

        const unread = game.user.isGM
            ? threadUsers().reduce((sum, u) => sum + unreadCount(u.id), 0)
            : totalUnread();
        if (unread > 0) {
            const badge = document.createElement("span");
            badge.className = "drpg-messenger-badge";
            badge.textContent = unread > 99 ? "99+" : String(unread);
            button.append(badge);
        }

        button.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            if (game.user.isGM) toggleRoster(button);
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

function toggleRoster(anchor) {
    const existing = document.getElementById("drpg-messenger-roster");
    if (existing) {
        existing.remove();
        return;
    }
    buildRoster(anchor);
}

function buildRoster(anchor) {
    const panel = document.createElement("div");
    panel.id = "drpg-messenger-roster";

    const title = document.createElement("h4");
    title.textContent = game.i18n.localize("DRPG.Messenger.rosterTitle");
    panel.append(title);

    const players = threadUsers();
    if (!players.length) {
        const empty = document.createElement("p");
        empty.className = "drpg-messenger-empty";
        empty.textContent = game.i18n.localize("DRPG.Messenger.rosterEmpty");
        panel.append(empty);
    } else {
        const list = document.createElement("ul");
        for (const user of players.sort((a, b) => a.name.localeCompare(b.name))) {
            list.append(rosterRow(user));
        }
        panel.append(list);
    }

    document.body.append(panel);

    // Close on an outside click, but not on the click that just opened it.
    setTimeout(() => document.addEventListener("click", onOutsideClick, { once: true }), 0);
    function onOutsideClick(event) {
        if (panel.contains(event.target) || event.target === anchor) return;
        panel.remove();
    }
}

function rosterRow(user) {
    const li = document.createElement("li");
    li.className = "drpg-messenger-roster-row";

    const last = lastMessage(user.id);
    const preview = last ? stripHtml(last.content) : game.i18n.localize("DRPG.Messenger.rosterNoMessages");
    const unread = unreadCount(user.id);

    const name = document.createElement("div");
    name.className = "drpg-messenger-roster-name";
    name.textContent = user.name;

    const snippet = document.createElement("div");
    snippet.className = "drpg-messenger-roster-preview";
    snippet.textContent = preview;

    const text = document.createElement("div");
    text.className = "drpg-messenger-roster-text";
    text.append(name, snippet);
    li.append(text);

    if (unread > 0) {
        const badge = document.createElement("span");
        badge.className = "drpg-messenger-badge";
        badge.textContent = unread > 99 ? "99+" : String(unread);
        li.append(badge);
    }

    li.addEventListener("click", () => {
        document.getElementById("drpg-messenger-roster")?.remove();
        openMessenger(user.id);
    });

    return li;
}

function stripHtml(html) {
    return String(html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
