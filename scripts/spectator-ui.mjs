/**
 * Danganronpa RPG - what a Spectator's own screen draws (E92 C5, 12.11.2026).
 * ---------------------------------------------------------------------------
 * The owner's E92 goal (5) and the 04.11 amend: "sheet and HUD in a spectator mode", and "the Spectator does NOT read
 * the chat". Two things, on the Spectator's browser alone (scripts/spectator.mjs `spectatorViewer`):
 *
 *   - THE WATCHING LINE under the clock: the room its token stands in, and a room picker - every room the class has
 *     found on the scene drawn (fog.mjs `myDiscoveredRooms`, the Spectator's copy, E92 C4) - which moves its token to
 *     the room's middle through any wall (bridge-asks.mjs `requestSpectatorMove`, the primary's `spectator.move`,
 *     E92 C3). Foundry stops a player's own drag at a wall; whether v14 lets a Spectator's drag through is LIVE-E92-02.
 *     Drawn after every render of the clock (`drpgHudRendered`), which rebuilds the clock's parts and keeps nothing of
 *     ours.
 *   - THE CHAT, HIDDEN: the body class `drpg-spectator` (components.css hides the chat log, its notifications and the
 *     box a message is typed in). A display only: every message Foundry sends still reaches the browser, and a console
 *     reads it (the plan's Q-E92-4, default taken; the GM handbook says so).
 *
 * The sheet's mode is sheet.mjs `sheetMode`'s ("spectator"): no action grid, no Calls, no row buttons, no Level Up.
 */

import { spectatorViewer, watcherOf } from "./spectator.mjs";
import { esc, error } from "./utils.mjs";

export const SPECTATOR_LINE_ID = "drpg-spectator-line";
export const SPECTATOR_BODY_CLASS = "drpg-spectator";

/**
 * The watching line's markup: `room` the room the token stands in (null outside every room), `rooms` the rooms the
 * picker offers, in their order. Pure, for the suite (R3859).
 */
export function spectatorLineHtml({ room = null, rooms = [] } = {}) {
    const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
    const where = room ? L("DRPG.Spectator.watching", { room }) : L("DRPG.Spectator.watchingOutside");
    const options = [`<option value="">${esc(L("DRPG.Spectator.watchRoom"))}</option>`,
        ...rooms.map(name => `<option value="${esc(name)}"${name === room ? " disabled" : ""}>${esc(name)}</option>`)].join("");
    return `<div id="${SPECTATOR_LINE_ID}" class="drpg-spectator-line" data-drpg-spectator-line>
        <span class="drpg-spectator-where">${esc(where)}</span>
        <select class="drpg-spectator-rooms" aria-label="${esc(L("DRPG.Spectator.watchLabel"))}"${rooms.length ? "" : " disabled"}>${options}</select>
    </div>`;
}

/** The Spectator's token on the scene drawn, or null. */
function ownToken(watcher, scene = canvas?.scene) {
    return [...(scene?.tokens ?? [])].find(t => t.actorId === watcher?.id) ?? null;
}

/** The spot a token of `tokenDoc`'s size stands on with its centre at the middle of `room`'s largest piece, or null. */
async function middleOf(scene, room, tokenDoc) {
    const [{ roomRegions }, { boundsOf }] = await Promise.all([import("./rooms.mjs"), import("./movement.mjs")]);
    const box = roomRegions(scene, room).map(boundsOf).filter(Boolean)
        .reduce((best, b) => (!best || b.w * b.h > best.w * best.h ? b : best), null);
    if (!box) return null;
    const grid = scene.grid?.size ?? 100;
    return { x: Math.round(box.x + box.w / 2 - ((tokenDoc.width ?? 1) * grid) / 2), y: Math.round(box.y + box.h / 2 - ((tokenDoc.height ?? 1) * grid) / 2) };
}

/** Draw, redraw or take off the watching line and the body class, as this browser now is. */
export async function paintSpectatorLine() {
    try {
        const watching = spectatorViewer();
        document.body?.classList?.toggle(SPECTATOR_BODY_CLASS, watching);
        const old = document.getElementById(SPECTATOR_LINE_ID);
        if (!watching) {
            old?.remove();
            return null;
        }
        const hud = document.getElementById("drpg-hud");
        const scene = canvas?.scene ?? null;
        const watcher = watcherOf();
        const token = ownToken(watcher, scene);
        if (!hud || !scene || !token) {
            old?.remove();
            return null;
        }
        const [{ roomOfToken }, { myDiscoveredRooms }] = await Promise.all([import("./movement.mjs"), import("./fog.mjs")]);
        const holder = document.createElement("div");
        holder.innerHTML = spectatorLineHtml({ room: roomOfToken(token), rooms: [...myDiscoveredRooms(scene)].sort((a, b) => a.localeCompare(b)) });
        const line = holder.firstElementChild;
        line.querySelector("select")?.addEventListener("change", async event => {
            const room = event.target.value;
            event.target.value = "";
            if (!room) return;
            const spot = await middleOf(scene, room, token);
            if (!spot) return;
            const { requestSpectatorMove } = await import("./bridge-asks.mjs");
            // A refusal is said by the bridge itself; a move done redraws the line from the token's own update too.
            const res = await requestSpectatorMove(scene.id, token.id, spot.x, spot.y);
            if (res.ok) void paintSpectatorLine();
        });
        const current = document.getElementById(SPECTATOR_LINE_ID);
        if (current) current.replaceWith(line);
        else {
            const band = hud.querySelector(":scope > .drpg-hud-track");
            if (band) band.before(line);
            else hud.append(line);
        }
        return line;
    } catch (err) {
        error("Could not draw the Spectator's line", err);
        return null;
    }
}

/** The hooks that redraw the line: the clock's render, the Spectator's own token moving, a role changed. */
export function registerSpectatorUi() {
    Hooks.on("drpgHudRendered", () => void paintSpectatorLine());
    Hooks.on("updateToken", (tokenDoc, changes) => {
        if (("x" in (changes ?? {}) || "y" in (changes ?? {})) && tokenDoc?.actorId === watcherOf()?.id) void paintSpectatorLine();
    });
    Hooks.on("updateActor", (actor, changes) => { if (changes?.flags) void paintSpectatorLine(); });
    Hooks.on("canvasReady", () => void paintSpectatorLine());
    void paintSpectatorLine();
}
