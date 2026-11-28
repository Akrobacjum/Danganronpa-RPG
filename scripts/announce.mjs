/**
 * Danganronpa RPG - Monokuma's announcements (2.0 line T4, EXP-GM-08, 27.11.2026; docs/dev/v2/LINE-T4.md).
 * ---------------------------------------------------------------------------
 * WHY. Monokuma had no "announce": to the school there was Foundry's chat, to one student the messenger's thread, to a
 * room only a voice reached by walking a token in. The GM panel's tile Announcement (gm-panel.mjs `PANEL_SECTIONS.now`)
 * opens a window of the kit with the words and where they go, and `game.drpg.announce({ to, room, userId, text })` is
 * the same for a macro. Three addressees:
 *
 * - THE SCHOOL: one public card spoken by Monokuma (`DRPG.Announce.speaker`), raised on every screen - a public card is
 *   an announcement to every browser already (popup.mjs `onCreateChatMessage`), and `popupForce` raises it on the GMs'
 *   too. The Spectators read it as everyone does.
 * - A ROOM of the school's scene: a card in the thread of each player whose student stands in that room, as the GMs'
 *   documents place it (movement.mjs `locateActor`: the character's token, read off the documents, the same on every
 *   GM's browser; `roomOfActor` is its room), living, no Spectator and no GM. Each card is whispered to its player and
 *   the GMs alone (messenger.mjs `postToThread`, a private card: its words go by the addressed socket), so a recipient
 *   sees their own card and nobody learns who else stood there. The window says before it sends how many will get it,
 *   in a GM's window alone; the GMs' Timeline draws each card as it draws every thread card, with no kind of its own.
 *   During an Eclipse the tokens stand where the documents hold them too: a student in the room is a student whose token
 *   is there, which the GMs' map shows, whatever the Eclipse hides from the players.
 * - A STUDENT: a card in that player's thread.
 *
 * The words are the GM's, escaped everywhere they are drawn (`esc`), trimmed as the messenger trims a message. Nothing
 * here is a rule of the game: it posts, and the posts are the chat's and the messenger's.
 */

import { MODULE_ID } from "./config.mjs";
import { esc, error } from "./utils.mjs";
import { drpgWindow, tipText } from "./ui-kit.mjs";
import { chatCard } from "./chat-card.mjs";

/** The three addressees, in the window's order. */
export const ANNOUNCE_TO = Object.freeze(["school", "room", "student"]);

/** The words as a card's body: trimmed, escaped, a line break kept (messenger.mjs `sendMessage`'s shape). */
export function announcementBody(text) {
    const body = String(text ?? "").trim();
    return body ? `<p>${esc(body).replace(/\n/g, "<br>")}</p>` : "";
}

/**
 * The player accounts a room's announcement goes to (R9254): each non-GM account whose character is a student standing
 * in `room` of `scene` by `place(actor)` (`{ scene, room }`), alive (`dead`) and no Spectator (`spectator`). One account
 * once; an account with no character, none. `users`, `place`, `dead` and `spectator` are the suite's; the defaults are
 * the world's, read on this GM's browser.
 */
export async function roomRecipients(room, { scene = null, users = game.users?.contents ?? [], place = null, dead = null, spectator = null } = {}) {
    if (!room) return [];
    const where = place ?? (await import("./movement.mjs")).locateActor;
    const isDead = dead ?? (await import("./settings.mjs")).isDeadForGm;
    const isSpectator = spectator ?? (await import("./monokuma.mjs")).isSpectator;
    const sceneId = scene?.id ?? scene ?? null;
    const out = [];
    for (const user of users) {
        const actor = user?.character;
        if (!user || user.isGM || !actor || out.includes(user.id)) continue;
        if (isDead(actor) || isSpectator(actor)) continue;
        const at = where(actor);
        if (at?.room !== room || (sceneId && (at.scene?.id ?? at.scene) !== sceneId)) continue;
        out.push(user.id);
    }
    return out;
}

/**
 * Announce (EXP-GM-08): `to` "school", "room" (with `room`, a room of the school's scene) or "student" (with `userId`, a
 * player's account), `text` the GM's words. Answers `{ sent }` - how many cards went: 1 for the school, one per
 * recipient for a room - or `{ refused }`: "notGm", "empty", "noRoom", "noStudent", "failed". `post`, `create`,
 * `recipients` and `scene` are the suite's (R9255).
 */
export async function announce({ to = "school", room = null, userId = null, text = "" } = {}, {
    post = null, create = null, recipients = roomRecipients, scene = null } = {}) {
    if (!game.user?.isGM) return { refused: "notGm" };
    const make = create ?? (data => ChatMessage.create(data));
    const body = announcementBody(text);
    if (!body) return { refused: "empty" };
    const L = key => game.i18n.localize(key);
    try {
        if (to === "school") {
            const card = await make({
                content: chatCard({ glyph: "circle-info", title: L("DRPG.Announce.schoolTitle"), body }),
                speaker: { alias: L("DRPG.Announce.speaker") },
                flags: { [MODULE_ID]: { popupForce: true, popupTitle: L("DRPG.Announce.schoolTitle") } }
            });
            return card ? { sent: 1 } : { refused: "failed" };
        }
        const send = post ?? (await import("./messenger.mjs")).postToThread;
        const { THREAD_KIND } = await import("./messenger.mjs");
        if (to === "room") {
            if (!room) return { refused: "noRoom" };
            const where = scene ?? (await import("./rooms.mjs")).homeScene();
            const ids = await recipients(room, { scene: where });
            const content = chatCard({ glyph: "circle-info", title: game.i18n.format("DRPG.Announce.roomTitle", { room }), body });
            let sent = 0;
            for (const id of ids) if (await send(id, content, { kind: THREAD_KIND.dm })) sent++;
            return { sent };
        }
        if (to === "student") {
            const user = game.users?.get(userId ?? "");
            if (!user || user.isGM) return { refused: "noStudent" };
            const posted = await send(user.id, chatCard({ glyph: "circle-info", title: L("DRPG.Announce.studentTitle"), body }), { kind: THREAD_KIND.dm });
            return posted ? { sent: 1 } : { refused: "failed" };
        }
        return { refused: "noRoom" };
    } catch (err) {
        error("Monokuma's announcement could not be sent", err);
        return { refused: "failed" };
    }
}

/**
 * The window (EXP-GM-08): the words, the addressee, the room of the school's scene or the player, and before a room's
 * send the number of players it will reach - a count, in this GM's window alone. Sends through `announce` and says
 * what went. GM only.
 */
export async function openAnnounce() {
    if (!game.user?.isGM) return null;
    const { homeScene } = await import("./rooms.mjs");
    const { allRooms } = await import("./movement.mjs");
    const scene = homeScene();
    const rooms = scene ? [...allRooms(scene)].sort((a, b) => a.localeCompare(b)) : [];
    const players = (game.users?.contents ?? []).filter(u => !u.isGM);
    const L = key => game.i18n.localize(key);
    const option = (value, label) => `<option value="${esc(value)}">${esc(label)}</option>`;
    const body = `<form class="drpg-announce">
        <label>${esc(L("DRPG.Announce.textLabel"))}<textarea name="text" rows="4" data-tooltip="${esc(L("DRPG.Announce.textTip"))}"></textarea></label>
        <label>${esc(L("DRPG.Announce.toLabel"))}<select name="to" data-tooltip="${esc(L("DRPG.Announce.toTip"))}">${
            ANNOUNCE_TO.map(to => option(to, L(`DRPG.Announce.to.${to}`))).join("")}</select></label>
        <label data-drpg-announce-for="room" hidden>${esc(L("DRPG.Announce.roomLabel"))}<select name="room" data-tooltip="${esc(L("DRPG.Announce.roomTip"))}">${
            rooms.map(r => option(r, r)).join("")}</select></label>
        <label data-drpg-announce-for="student" hidden>${esc(L("DRPG.Announce.studentLabel"))}<select name="userId" data-tooltip="${esc(L("DRPG.Announce.studentTip"))}">${
            players.map(u => option(u.id, u.character ? `${u.character.name} (${u.name})` : u.name)).join("")}</select></label>
        <p class="drpg-help" data-drpg-announce-reach></p>
    </form>`;
    const read = root => {
        const form = root.querySelector("form.drpg-announce");
        return { to: form?.elements?.to?.value ?? "school", room: form?.elements?.room?.value || null,
            userId: form?.elements?.userId?.value || null, text: form?.elements?.text?.value ?? "" };
    };
    const choice = await drpgWindow({
        classes: ["drpg-panel", "drpg-window-announce"],
        title: L("DRPG.Announce.title"),
        body,
        render: (event, dialog) => {
            const root = dialog.element;
            const paint = async () => {
                const { to, room } = read(root);
                for (const el of root.querySelectorAll("[data-drpg-announce-for]")) el.hidden = el.dataset.drpgAnnounceFor !== to;
                const line = root.querySelector("[data-drpg-announce-reach]");
                if (!line) return;
                if (to === "room") {
                    const n = room ? (await roomRecipients(room, { scene })).length : 0;
                    const { plural } = await import("./utils.mjs");
                    line.textContent = plural("DRPG.Announce.reach", { n });
                } else line.textContent = L(`DRPG.Announce.reachOf.${to}`);
            };
            root.querySelector("form.drpg-announce")?.addEventListener("change", () => { void paint(); });
            void paint();
        },
        footer: {
            primary: { action: "send", label: L("DRPG.Announce.send"), tooltip: tipText("DRPG.Announce.sendTip"),
                callback: (event, button, dialog) => read(dialog.element) },
            close: { role: "cancel", action: "cancel" }
        },
        rejectClose: false
    });
    if (!choice || typeof choice !== "object") return null;
    const result = await announce(choice, { scene });
    if (result.refused) ui.notifications.warn(L(`DRPG.Announce.refused.${result.refused}`));
    else {
        const { plural } = await import("./utils.mjs");
        ui.notifications.info(plural("DRPG.Announce.sent", { n: result.sent }));
    }
    return result;
}
