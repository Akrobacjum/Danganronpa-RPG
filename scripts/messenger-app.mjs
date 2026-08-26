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
import { gmIds, ownerOf, whisperToGms, error } from "./utils.mjs";
import { showPopup } from "./popup.mjs";
import {
    MESSENGER_FLAGS, THREAD_KIND,
    threadUsers, isThreadUser, threadMessages, lastMessage,
    unreadCount, totalUnread, markThreadRead, sendMessage
} from "./messenger.mjs";
import { noteFor, noteStatus, noteTemplate, saveNote } from "./pre-session-note.mjs";
// The chat log's own roll-card painter, shared rather than reimplemented.
import { markOutcome, rollOutcomeOf } from "./private-rolls.mjs";

const LAUNCHER_ID = "drpg-messenger-launcher";

export function registerMessengerUi() {
    Hooks.once("ready", renderLauncher);
    Hooks.on("canvasReady", () => renderLauncher());
    Hooks.on("drpgMessengerMessage", () => renderLauncher());
    Hooks.on("drpgMessengerRead", () => renderLauncher());

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

    /* A GM used to keep only the roster badge for this — a passive dot in the
     * corner — which was the right volume for a player's "hey" and the wrong
     * one for everything that WAITS on the GM: a parked murder's approve card,
     * a project proposal, an Analyze critical. An ask that nobody is told
     * about is an ask that hangs (Dawid, 26.08). The `gmAsk` flag is stamped
     * where the card is made, and deliberately not derived from the author —
     * the bridge posts several of these FROM the GM's own session on a
     * player's behalf, so even a self-authored card can be news to the GM
     * sitting at that screen. Ordinary chatter keeps the badge. */
    if (game.user.isGM) {
        if (!message.getFlag(MODULE_ID, MESSENGER_FLAGS.gmAsk)) return;
        showPopup(message.content, {
            title: game.i18n.localize("DRPG.Messenger.gmActionTitle"),
            onClick: () => openMessenger(playerUserId)
        });
        return;
    }

    // The player's own window is not open — surface the reply the same way
    // every other message on their screen appears, with a click that jumps
    // straight to the conversation.
    if (game.user.id !== playerUserId) return;
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

    // A ROLL IN A THREAD LOOKS LIKE A ROLL.
    //
    // The chat log has dressed duality rolls since the private-roll work —
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

    // The two halves of the direct-murder gate. The declaration is already
    // parked and the action already spent; what these decide is whether it is
    // allowed to become an incident when the lights come up.
    if (action === "approveMurder" || action === "refuseMurder") {
        const { ruleOnParkedMurder } = await import("./eclipse.mjs");
        return ruleOnParkedMurder(data.killer, action === "approveMurder");
    }

    if (action === "fireTrap") {
        // The trap names a condition, not a victim — so this opens the murder
        // screen with the killer already filled in and "indirect" already
        // ticked, and asks the one thing the condition cannot answer: who
        // walked into it.
        const { openMurderDialog } = await import("./murder.mjs");
        return openMurderDialog({ killerId: data.killer, indirect: true });
    }

    if (action === "approveProject") {
        // Prefilled, not applied. The GM asked for a proposal so they could
        // change it — approving straight into existence would be the old
        // behaviour with an extra click in front of it.
        const { openProjectDialog } = await import("./projects-ui.mjs");
        return openProjectDialog({
            preset: {
                name: data.pname ?? "",
                target: Number(data.target) || 4,
                room: data.room || null,
                trait: data.trait || null,
                indirectMurder: Boolean(data.murder),
                condition: data.condition ?? ""
            }
        });
    }

    if (action === "declineProject") {
        // No action to refund: starting a project is a declaration, and the
        // cost is paid by working on it afterwards.
        const actor = game.actors.get(data.by);
        if (!actor) return null;
        const { postToThread } = await import("./messenger.mjs");
        const owner = ownerOf(actor);
        const note = `<p><em>${game.i18n.localize("DRPG.Project.declinedPlayer")}</em></p>`;
        if (owner) await postToThread(owner.id, note);
        ui.notifications.info(game.i18n.format("DRPG.Project.declinedGm", { name: actor.name }));
        return true;
    }

    // ---------------------------------------------------------------- generic
    //
    // Every action that calls the GM now carries at least one of these two.
    // The mechanism was already here and only Direct Murder and Propose a
    // Project used it, so a Search for something specific, an Observe at a
    // point of interest, a Listen, an Analyze hint and a Dynamic action all
    // arrived as a card with a roll on it and nothing to press — the GM read
    // the number and then went looking for the window that answers it.

    if (action === "reply") {
        // A ruling in words. Most of these branches have no mechanical answer
        // at all — "what do you overhear", "what does that door tell you" — and
        // the module's own answer to that has always been the thread the card
        // is already sitting in.
        const actor = game.actors.get(data.by);
        if (!actor) return null;

        const DialogV2 = foundry.applications.api.DialogV2;
        const text = await DialogV2.wait({
            classes: ["drpg-panel"],
            window: { title: game.i18n.format("DRPG.Bridge.replyTitle",
                { name: actor.name }) },
            content: `<form><p>${game.i18n.localize("DRPG.Bridge.replyPrompt")}</p>
                <textarea name="reply" rows="4"></textarea></form>`,
            buttons: [
                {
                    action: "send", label: game.i18n.localize("DRPG.Bridge.send"), default: true,
                    callback: (e, b, d) => d.element.querySelector("[name=reply]").value.trim()
                },
                { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
            ],
            rejectClose: false
        });

        if (!text || text === "cancel") return null;

        const { postToThread } = await import("./messenger.mjs");
        const owner = ownerOf(actor);
        const body = `<p><strong>${game.i18n.localize("DRPG.Bridge.rulingLabel")}</strong> ${
            foundry.utils.escapeHTML(text)}</p>`;
        if (owner) await postToThread(owner.id, body);
        else await whisperToGms(body);
        return true;
    }

    if (action === "decline") {
        // The action comes BACK. Same reasoning as `declineMurder`: a refusal
        // here is the GM overruling the declaration rather than the rules
        // resolving it, and a player who spent an action on a question that was
        // never answered has spent nothing.
        const actor = game.actors.get(data.by);
        if (!actor) return null;

        const cost = Number(data.cost) || 0;
        if (cost > 0) {
            const { refundAction } = await import("./actions.mjs");
            await refundAction(actor, cost);
        }

        const { postToThread } = await import("./messenger.mjs");
        const owner = ownerOf(actor);
        const note = `<p><em>${game.i18n.localize("DRPG.Bridge.declined")}</em></p>`;
        if (owner) await postToThread(owner.id, note);
        ui.notifications.info(game.i18n.format("DRPG.Bridge.declinedGm", { name: actor.name }));
        return true;
    }

    if (action === "createItem") {
        // Prefilled, never applied — same rule as `approveProject`. The roll
        // already decided the tier and the player already named the category
        // and the room, so the form opens with all three answered and the GM
        // writes the one thing only they know: what was actually there.
        const { openItemTables } = await import("./tables.mjs");
        return openItemTables({
            preset: {
                category: data.category || null,
                tier: Number(data.tier) || 0,
                room: data.room || null,
                name: data.want || ""
            }
        });
    }

    if (action === "giveItem") {
        // The other half of the same ruling: the thing they were looking for
        // exists already, so it goes straight onto the sheet rather than into a
        // table first.
        const actor = game.actors.get(data.by);
        if (!actor) return null;
        const { giveItemDialog } = await import("./gm-items.mjs");
        return giveItemDialog(actor);
    }

    if (action === "keyRemnantHere") {
        const { openKeyRemnantHere } = await import("./investigation.mjs");
        return openKeyRemnantHere({ room: data.room || null, note: data.want || "" });
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

export function renderLauncher() {
    try {
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
        closeRoster(existing);
        return;
    }
    buildRoster(anchor);
}

/**
 * Take the roster off screen the way the popups leave — a beat out, then gone.
 *
 * The class drives the transition (see the stylesheet); the timeout is the
 * guarantee, because a `transitionend` that never fires — reduced motion, a
 * backgrounded tab — must not leave a dead roster blocking the next open.
 */
function closeRoster(panel) {
    if (panel.classList.contains("leaving")) return;
    panel.classList.remove("visible");
    panel.classList.add("leaving");
    const drop = () => panel.remove();
    panel.addEventListener("transitionend", drop, { once: true });
    setTimeout(drop, 400);
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

    // Two frames, not one: the element has to be laid out in its resting
    // (hidden) state before the class flips, or the browser coalesces both
    // states into a single style and nothing animates. Same dance as the
    // popups.
    requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add("visible")));

    // Close on an outside click, but not on the click that just opened it.
    setTimeout(() => document.addEventListener("click", onOutsideClick, { once: true }), 0);
    function onOutsideClick(event) {
        if (panel.contains(event.target) || event.target === anchor) return;
        closeRoster(panel);
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
