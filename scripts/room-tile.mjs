/**
 * Danganronpa RPG - the room tile's facts: whose room, and what is true of it (E77 C2, 13.10.2026; the A8
 * design's steps 1-3 and 5, the E77 plan's C2).
 * ---------------------------------------------------------------------------
 * The tile E77 C3 draws shows every player, and a GM with a Monokuma, the room their own character stands in:
 * its name, the GM's description and the GM's picture. Two of those are words and a URL another user wrote,
 * held as region flags every browser has (`VAULT_FLAGS.description`, `VAULT_FLAGS.image`), so what this file
 * answers is the whole of which of them reach a screen:
 *
 *   - WHOSE ROOM is `viewerActor()`'s (hud.mjs) and nobody else's: the account's assigned character, else its
 *     one owned student, else the GM's own Monokuma - the rule the clock has always used. Never a selected or
 *     a clicked token, never the room on the camera's scene, never a room the character has found or one beside
 *     it (R509 reads that this file takes an actor from nowhere else).
 *   - WHERE is the token `locateActor` chooses, on its own scene and floor, read at the spot the route last
 *     settled on (`settledPosition`): a crossing this browser is still judging, or one refused and not yet put
 *     back, is not the character's room yet (movement.mjs `settledSpot`, `drpgRouteSettled`); nor, on a browser
 *     that owns the token, is one another browser settles until it is announced there (E77 fix r1-G2).
 *   - WHAT is `roomDescription` and `roomImage` on that scene: the first piece of the room that carries a value
 *     (rooms.mjs `roomFlag`), the picture through `safeRoomImage` on every read (vault.mjs, E77 C1), so a value
 *     a console wrote is no picture. Both stay the GM's raw words here; the tile sets them as text.
 *
 * THE TILE (E77 C3, 13.10.2026; the A8 design's step 4, the E77 plan's C3). `#drpg-room-tile` stands under the
 * clock and draws those facts, which until C3 were three rows inside the clock (hud.mjs `buildRoom`, gone): the
 * name, the room's search tokens and 'Available project' when it has one, the picture behind them, and the
 * description behind a toggle. What reaches it, and how:
 *
 *   - The GM's words only as `textContent`, and every tooltip through `dataset.tooltipText`. This file has no
 *     `innerHTML`, no `insertAdjacentHTML`, no `enrichHTML` and no data-tooltip in any literal - Foundry's
 *     tooltip takes an empty one's `aria-label` through the client's `cleanHTML`, the E02-D01 hole (R509).
 *   - The picture only as a path `safeRoomImage` accepts, checked again where it is painted, inside a CSS
 *     string in the art layer's `background-image`. A picture that does not load paints nothing there, which
 *     leaves the tile's own dark glass under the name; the GM's picture is opened large only after a probe
 *     decodes it, in Foundry's ImagePopout on this browser alone, with no share control (`openRoomImage`).
 *   - A repaint when the viewer's own route settles (`drpgRouteSettled`, movement.mjs - never the raw
 *     `updateToken`, which reaches a browser before a refusal and its put-back, the design's CB-8), on a new
 *     canvas, on a region's change, and after every clock render (`drpgHudRendered`, which is what kept the old
 *     rows fresh: sync.mjs redraws the clock on the search tokens' and the projects' writes, read 13.10.2026).
 *     Each paint compares a key
 *     and writes nothing when it is unchanged. The tile never calls `renderHud` or the curtain, and sends no
 *     socket and no packet.
 *
 * THE NARROW ROW (E77 C8, 13.10.2026; the E77 plan's C8). On a stacked screen the tile is a row of the stack,
 * 44 px high, in narrow.mjs's `#drpg-tile-row`: the picture as a 78x44 thumbnail, the name, the tokens and
 * 'Available project', and a button that opens the description in a window of its own. Every paint draws
 * both forms and the stylesheets show the one the screen has, because a change of layout changes no view and
 * so paints nothing. The thumbnail is an `<img>` whose `src` is the path `safeRoomImage` gave the art layer
 * (`paintTileRow`), and pressing it opens the same ImagePopout; the window (`openRoomWindow`) is built from
 * the view with `textContent` alone, under a title of the module's, not the room's name.
 *
 * The suite reaches this file through R504's and R505's imports (which is also how R503's census reads its
 * roads); module.mjs builds the tile at `ready` (`ensureRoomTile`, `registerRoomTile`).
 */

import { viewerActor, trialSlot } from "./hud.mjs";
import { locateActor, settledSpot, roomAt } from "./movement.mjs";
import { roomDescription, roomImage, safeRoomImage } from "./vault.mjs";
// Both were hud.mjs's for the clock's room rows and moved with them (E77 C3); neither reaches this file back.
import { projectsAvailableIn } from "./projects.mjs";
import { SearchTokens } from "./search-tokens.mjs";
import { seatRoomArt } from "./glass.mjs";
import { tileRow } from "./narrow.mjs";
import { alreadyOpen } from "./live.mjs";
import { error } from "./utils.mjs";

const TILE_ID = "drpg-room-tile";
const PROSE_ID = "drpg-room-tile-prose";
/** The class the tile's ImagePopout carries, so the header-controls hook strips that window's and no other's. */
const POPOUT_CLASS = "drpg-room-image";
/** The description's window on a stacked screen (E77 C8), by the class `alreadyOpen` finds it by. */
const WINDOW_CLASS = "drpg-window-room";

/**
 * Where a token stands for the tile: the spot its last settled route left it on (movement.mjs `settledSpot`).
 * While this browser judges a route of it, the spot before the route; otherwise the token's own.
 *
 * @param {TokenDocument} tokenDoc
 * @returns {{x: number, y: number, level?: *}|null}
 */
export function settledPosition(tokenDoc) {
    return settledSpot(tokenDoc);
}

/**
 * The room this screen shows, and why there is none when there is none. Pure: reads, writes nothing.
 *
 * The gates, in order: a Class Trial (`trialSlot`) shows no room - everybody is in the courtroom, as the
 * clock's room block always said; no viewer is `noActor` for a player and `none` for a GM without a Monokuma
 * (the tile is an empty pane for them, as the clock had no room block); no token on a place scene, or a token
 * outside every room at its settled spot, is `nowhere`; anything else is `room`. An Eclipse is no gate (the
 * character still stands where they stand), nor is death (a body lies in its room) nor a Monocub (it walks
 * with its token).
 *
 * @returns {{state: "trial"|"noActor"|"none"|"nowhere"|"room", room: string|null, scene: Scene|null,
 *   tokenDoc: TokenDocument|null}}
 */
export function viewerRoom() {
    const empty = state => ({ state, room: null, scene: null, tokenDoc: null });
    if (trialSlot()) return empty("trial");
    const actor = viewerActor();
    if (!actor) return empty(game.user.isGM ? "none" : "noActor");
    const place = locateActor(actor);
    if (!place) return empty("nowhere");
    const spot = settledPosition(place.tokenDoc);
    const room = spot ? roomAt(spot.x, spot.y, place.tokenDoc, spot.level) : null;
    return { state: room ? "room" : "nowhere", room, scene: place.scene, tokenDoc: place.tokenDoc };
}

/**
 * What the GM wrote about `room` on `scene`: the description ("" when none) and the picture (a path
 * `safeRoomImage` accepts, else null). The scene is the caller's - `viewerRoom`'s, the token's own - and
 * never the camera's (E12's rule for every room reader).
 *
 * @param {string} room
 * @param {Scene} scene
 * @returns {{room: string, description: string, image: string|null}}
 */
export function roomFacts(room, scene) {
    return { room, description: roomDescription(room, scene), image: roomImage(room, scene) };
}

/**
 * Everything one paint draws, gathered in one read: the state, and for a room its name, the GM's words and
 * picture, the search tokens and whether a project is available there. Pure.
 *
 * The four room states say what the GM gave the room: `room` (a picture and words), `roomPicture`,
 * `roomText` and `roomBare` (neither). The project is asked as the clock's room row asked it, of the
 * viewer's settled room and scene (projects.mjs `projectsAvailableIn`; a GM sees the secret ones, and the
 * project's name is never drawn - the row is on screen while people share one).
 *
 * @returns {{state: string, room: string|null, sceneId?: string|null, description?: string,
 *   image?: string|null, tokens?: {max: number, left: number, sealed: boolean}, project?: boolean}}
 */
export function tileView() {
    const where = viewerRoom();
    if (where.state !== "room") return { state: where.state, room: null };
    const { description, image } = roomFacts(where.room, where.scene);
    const sealed = SearchTokens.sealed(where.room, where.scene);
    const place = { room: where.room, scene: where.scene, tokenDoc: where.tokenDoc };
    return {
        state: image ? (description ? "room" : "roomPicture") : (description ? "roomText" : "roomBare"),
        room: where.room,
        sceneId: where.scene?.id ?? null,
        description,
        image,
        tokens: { max: SearchTokens.max, left: sealed ? 0 : SearchTokens.left(where.room, where.scene), sealed },
        project: projectsAvailableIn(place, game.user).length > 0
    };
}

/**
 * The tile's element, made once and kept under the clock: right after `#drpg-hud`, or after the floor
 * switcher when that follows the clock (fog.mjs puts `#drpg-floors` straight after `#drpg-hud`, so the two
 * never trade places). Before the clock exists (module.mjs builds the tile at `ready`, before the clock's
 * own first render) it waits at the end of the left column; the clock's render moves it.
 *
 * @returns {HTMLElement}
 */
export function ensureRoomTile() {
    let tile = document.getElementById(TILE_ID);
    if (!tile) {
        tile = document.createElement("section");
        tile.id = TILE_ID;
        tile.className = "drpg-room-tile";
        tile.setAttribute("role", "region");
        tile.setAttribute("aria-label", game.i18n.localize("DRPG.Room.tileLabel"));
    }
    /* A row of the stack on a stacked screen (E77 C8, narrow.mjs), and left there: under the clock in
       the stack it would stand at its desk height in a column with no room for it. */
    const row = tileRow();
    if (row) {
        if (tile.parentElement !== row) row.append(tile);
        return tile;
    }
    /* Beside the notice tile glass.mjs has moved it to the body (E77 C4, `placeRoomTile`), and it
       stays there until the next pass of the curtain puts it back under the clock. */
    if (tile.dataset.place === "notes" && tile.parentElement === document.body) return tile;
    const hud = document.getElementById("drpg-hud");
    if (hud?.parentElement) {
        const floors = hud.nextElementSibling?.id === "drpg-floors" ? hud.nextElementSibling : null;
        const after = floors ?? hud;
        if (after.nextElementSibling !== tile) after.after(tile);
    } else if (!tile.isConnected) {
        (document.getElementById("ui-left-column-1") ?? document.body).append(tile);
    }
    return tile;
}

/** What each tile was last painted with: the view's key and its room. Kept here, so no GM text is an attribute. */
const painted = new WeakMap();

/**
 * Draw `view` into `tile`, and nothing when it is what the tile already shows. Returns whether it wrote.
 *
 * Built with `createElement` and `textContent` alone. A change of room (or of its scene) closes the
 * description; a repaint of the same room keeps it as the viewer left it. `trial` and `none` are an empty
 * pane hidden from a screen reader; `nowhere` and `noActor` one line.
 *
 * @param {HTMLElement} tile
 * @param {ReturnType<typeof tileView>} [view]
 * @returns {boolean}
 */
export function paintRoomTile(tile, view = tileView()) {
    if (!tile) return false;
    const key = JSON.stringify(view);
    const last = painted.get(tile);
    if (last?.key === key) return false;
    const open = Boolean(view.description) && last?.room === view.room && last?.sceneId === view.sceneId
        && tile.classList.contains("is-open");
    painted.set(tile, { key, room: view.room, sceneId: view.sceneId });
    /* The last paint's picture, if the curtain had laid it on the tile's pane (E77 C4, glass.mjs
       `seatRoomArt`) - only for the tile on the screen: R504 paints loose tiles of its own. */
    const live = tile.id === TILE_ID;
    if (live) document.getElementById("drpg-room-art")?.remove();

    tile.dataset.state = view.state;
    tile.classList.toggle("is-open", open);
    if (!view.room) {
        const words = { nowhere: "DRPG.Hud.roomNowhere", noActor: "DRPG.Explain.room.noActor" }[view.state];
        if (words) tile.removeAttribute("aria-hidden");
        else tile.setAttribute("aria-hidden", "true");
        tile.replaceChildren(...(words ? [textNode("h3", "drpg-room-tile-name", game.i18n.localize(words))] : []));
        return true;
    }
    tile.removeAttribute("aria-hidden");

    const parts = [];
    const art = document.createElement("div");
    art.className = "drpg-room-tile-art";
    const image = view.image ? safeRoomImage(view.image) : null;
    if (image) art.style.setProperty("background-image", `url("${cssString(image)}")`);
    parts.push(art);

    if (image) {
        const show = document.createElement("button");
        show.type = "button";
        show.className = "drpg-room-tile-open";
        show.setAttribute("aria-label", game.i18n.format("DRPG.Room.imageOpen", { room: view.room }));
        show.addEventListener("click", () => openRoomImage(image, view.room));
        parts.push(show);
    }

    parts.push(textNode("h3", "drpg-room-tile-name", view.room));
    parts.push(buildSearchPips(view.tokens));
    if (view.project) parts.push(textNode("div", "drpg-hud-room-project", game.i18n.localize("DRPG.Hud.roomProject")));

    if (view.description) {
        const more = document.createElement("button");
        more.type = "button";
        more.className = "drpg-room-tile-more";
        more.setAttribute("aria-controls", PROSE_ID);
        const chevron = document.createElement("i");
        chevron.className = "fa-solid fa-chevron-down";
        chevron.setAttribute("aria-hidden", "true");
        more.append(chevron);
        more.addEventListener("click", () => openProse(tile, !tile.classList.contains("is-open")));

        const prose = textNode("p", "drpg-room-tile-prose", view.description);
        prose.id = PROSE_ID;
        prose.tabIndex = 0;
        parts.push(more, prose);
    }
    parts.push(...paintTileRow(view, image));

    tile.replaceChildren(...parts);
    openProse(tile, open);
    if (live) seatRoomArt();
    return true;
}

/**
 * The tile's narrow form (E77 C8): the thumbnail, when there is a picture, and the button for the
 * description, when there are words. Hidden on a desk (danganronpa.css) and shown in the row (narrow.css).
 *
 * The thumbnail's `src` is `image`, which `paintRoomTile` has from `safeRoomImage` and from nowhere else:
 * the census's one road into an element's `src` in this file (R503, "SRC room-tile.mjs#paintTileRow#src").
 * Lazy, so a desk that never shows it need not ask for it (a lazy image under `display: none` waits to be
 * laid out - the browsers' rule, not measured here; the desk's art layer asks for the same path anyway). Its
 * alt is empty and the button carries the words, so a screen reader hears the room, not the file's name.
 *
 * @param {ReturnType<typeof tileView>} view
 * @param {string|null} image  the checked path, or null
 * @returns {HTMLElement[]}
 */
function paintTileRow(view, image) {
    const parts = [];
    if (image) {
        const thumb = document.createElement("button");
        thumb.type = "button";
        thumb.className = "drpg-room-tile-thumb";
        thumb.setAttribute("aria-label", game.i18n.format("DRPG.Room.imageOpen", { room: view.room }));
        const img = document.createElement("img");
        img.alt = "";
        img.loading = "lazy";
        img.decoding = "async";
        img.src = image;
        thumb.append(img);
        thumb.addEventListener("click", () => openRoomImage(image, view.room));
        parts.push(thumb);
    }
    if (view.description) {
        const label = game.i18n.localize("DRPG.Room.describe");
        const describe = document.createElement("button");
        describe.type = "button";
        describe.className = "drpg-room-tile-describe";
        describe.setAttribute("aria-label", label);
        describe.dataset.tooltipText = label;
        const icon = document.createElement("i");
        icon.className = "fa-solid fa-align-left";
        icon.setAttribute("aria-hidden", "true");
        describe.append(icon);
        describe.addEventListener("click", () => openRoomWindow());
        parts.push(describe);
    }
    return parts;
}

/**
 * The description window's content for `view`: the room's name and its words, as text. Pure - builds a
 * box in no document and reads nothing else - so R505 reads it with a view of its own.
 *
 * @param {ReturnType<typeof tileView>} view
 * @returns {HTMLElement}
 */
export function roomWindowBody(view) {
    const root = document.createElement("div");
    root.className = "drpg-room-window-body";
    root.append(textNode("h3", "drpg-room-window-name", view?.room ?? ""));
    root.append(textNode("p", "drpg-room-window-prose", view?.description ?? ""));
    return root;
}

let RoomWindow = null;

/**
 * The window class, made on first use: `foundry.applications.api` is not there when this file is
 * imported by the suite's tier 0, and a class that extends it at the top would throw on import.
 * It reads `tileView()` on every render, so it always shows this browser's viewer's room now.
 */
function roomWindowClass() {
    RoomWindow ??= class extends foundry.applications.api.ApplicationV2 {
        static DEFAULT_OPTIONS = {
            id: "drpg-room-window",
            classes: ["drpg-panel", WINDOW_CLASS],
            window: { icon: "fa-solid fa-align-left", resizable: false, minimizable: false }
        };

        constructor(options = {}) {
            const width = Math.min(480, window.innerWidth - 16);
            super(foundry.utils.mergeObject({ position: { width } }, options));
        }

        /* The module's word, never the room's name: the name is somebody else's text, and a window
           title is not this file's to draw. */
        get title() {
            return game.i18n.localize("DRPG.Room.describe");
        }

        async _renderHTML() {
            return roomWindowBody(tileView());
        }

        _replaceHTML(result, content) {
            content.replaceChildren(result);
        }
    };
    return RoomWindow;
}

/**
 * The description of the viewer's room, in a window: the narrow row's button (E77 C8). One at a time -
 * a second press raises the one already open (once it has rendered: `alreadyOpen` counts rendered windows,
 * as for every window of the module's, and scenario 74 G read a second open asked mid-render make a second).
 *
 * @returns {Promise<object>} the window, the one already open or a new one
 */
export async function openRoomWindow() {
    const open = alreadyOpen(WINDOW_CLASS);
    if (open) return open;
    const app = new (roomWindowClass())();
    await app.render({ force: true });
    return app;
}

/** The toggle's three facts and the description's visibility, without a repaint. */
function openProse(tile, open) {
    tile.classList.toggle("is-open", open);
    // the picture's darker gradient, where the curtain has moved the picture onto the pane (E77 C4)
    if (tile.id === TILE_ID) document.getElementById("drpg-room-art")?.classList.toggle("is-open", open);
    const more = tile.querySelector(".drpg-room-tile-more");
    const prose = tile.querySelector(".drpg-room-tile-prose");
    if (more) {
        const label = game.i18n.localize(open ? "DRPG.Room.readLess" : "DRPG.Room.readMore");
        more.setAttribute("aria-expanded", String(open));
        more.setAttribute("aria-label", label);
        more.dataset.tooltipText = label;
    }
    if (prose) prose.hidden = !open;
}

function textNode(tag, className, text) {
    const el = document.createElement(tag);
    el.className = className;
    el.textContent = text;
    return el;
}

/**
 * A path as the body of a double-quoted CSS string: a quote, a backslash or a line break is written as its
 * hex escape, so a path cannot end the string or the `url()`. `safeRoomImage` already refuses anything but a
 * picture on this server; this is the second lock, on the one sink that is a string of CSS.
 */
function cssString(path) {
    return String(path).replace(/["\\\n\r\f]/g, c => `\\${c.charCodeAt(0).toString(16)} `);
}

/**
 * The room's search tokens, as pips (moved from hud.mjs `buildSearchPips` with the clock's room rows, E77 C3;
 * the class names kept, so both themes' pip rules carry over).
 *
 * Drawn as spans with a border-radius rather than as ● and ○, because the two
 * Unicode circles have different advance widths in the pixel font and a row
 * that mixes them staggers. A screen reader gets the number instead: three
 * dots are not a readout.
 *
 * @param {{max: number, left: number, sealed: boolean}} tokens
 */
function buildSearchPips({ max, left, sealed }) {
    // A sealed room has its three tokens sitting untouched in the store and
    // none of them can be spent, so drawing them would be the widget promising
    // something the sheet then refuses. Shown empty and struck through instead.
    const row = document.createElement("div");
    row.className = `drpg-hud-room-tokens${sealed ? " is-sealed" : ""}`;
    row.setAttribute("role", "img");
    row.setAttribute("aria-label", sealed
        ? game.i18n.localize("DRPG.SearchTokens.sealed")
        : game.i18n.format("DRPG.Hud.roomTokens", { left, max }));
    row.dataset.tooltipText = sealed
        ? game.i18n.localize("DRPG.SearchTokens.sealed")
        : game.i18n.format("DRPG.Hud.roomTokensTooltip", { left, max });

    for (let i = 0; i < max; i++) {
        const pip = document.createElement("span");
        pip.className = i < left ? "drpg-hud-pip full" : "drpg-hud-pip";
        row.append(pip);
    }
    return row;
}

/**
 * The GM's picture, large, on this browser alone (the A8 design's step 8b).
 *
 * The path is judged again here, then decoded by a probe first: Foundry's ImagePopout opens an empty
 * window on a picture that fails (the design's reading of image-popout.mjs, not measured here), so a
 * picture that does not decode is a warning (`DRPG.Room.imageMissing`) and no window. A probe without
 * `decode` (jsdom has none) is not waited on. The window has no `uuid` and no share control, for a GM too:
 * 'Show to players' would send one room's picture to players standing in others. `stripImageControls`
 * empties the controls another module adds to it.
 *
 * THE ROOM'S NAME IS THE TITLE, AS TEXT (E77 fix r1-G1, round 1's sec F4). The name is the GM's words, and
 * how Foundry draws an option's `window.title` into its frame is in Foundry's code, which is not in this
 * repository and was not read; the headless harness has no ImagePopout at all (its `foundry.applications.apps`
 * holds a FilePicker alone, client-entry.mjs, read 13.10.2026), so nothing here measures it. The window is
 * therefore asked for under the tile's own label, and once it is drawn the name is written as `textContent`
 * of the heading kept as `window.title` (`HTMLHeadingElement | undefined` in fvtt-types 14.366.0-beta, the
 * community's type definitions, not Foundry's code; the harness's own ApplicationV2 answers a string there,
 * hence the element test). R505 reads it against a
 * stand-in; what a real Foundry v14 shows there is LIVE-E77-04.
 *
 * @param {string} path
 * @param {string} room
 * @returns {Promise<object|null>} the window, or null when nothing opened
 */
export async function openRoomImage(path, room) {
    const src = safeRoomImage(path);
    if (!src) return null;
    try {
        // globalThis.Image, not a bare Image: the lint config declares no browser Image (13.10.2026, no-undef),
        // and a test's stand-in goes on the same object.
        const probe = new globalThis.Image();
        probe.src = src;
        if (typeof probe.decode === "function") await probe.decode();
    } catch {
        ui.notifications?.warn(game.i18n.localize("DRPG.Room.imageMissing"));
        return null;
    }
    const popout = new foundry.applications.apps.ImagePopout({
        src, classes: [POPOUT_CLASS], window: { title: game.i18n.localize("DRPG.Room.tileLabel"), controls: [] }, showTitle: true
    });
    await popout.render({ force: true });
    if (popout.window?.title?.nodeType === 1) popout.window.title.textContent = room;
    return popout;
}

/**
 * `getHeaderControlsImagePopout`: the tile's window keeps no header control - not Foundry's share, not one
 * another module adds. Every other ImagePopout is left as it is.
 */
export function stripImageControls(app, controls) {
    if (!app?.options?.classes?.includes?.(POPOUT_CLASS) || !Array.isArray(controls)) return;
    controls.splice(0, controls.length);
}

/** Paint the tile for this browser's viewer now; an error is logged and leaves the clock alone. */
export function refreshRoomTile() {
    try {
        const view = tileView();
        if (paintRoomTile(ensureRoomTile(), view)) refreshRoomWindow(view);
    } catch (err) {
        error("Could not paint the room tile", err);
    }
}

/**
 * The description's window follows the tile: drawn again when the tile was, and closed when the room
 * it would show has no words, or there is no room.
 */
function refreshRoomWindow(view) {
    const app = RoomWindow && [...foundry.applications.instances.values()].find(a => a instanceof RoomWindow && a.rendered);
    if (!app) return;
    if (view.description) app.render();
    else app.close();
}

/**
 * A region made, changed or removed: a room's words, picture or shape may have changed, or the room the
 * viewer stands in. The paint's key decides whether anything is written.
 */
function onRegionChanged() {
    refreshRoomTile();
}

/**
 * The tile's triggers (module.mjs `ready`). A settled route repaints only for the viewer's own token: another
 * token's settle changes nothing here. `controlToken` is no trigger, though the plan named it for a GM:
 * `viewerActor` is the GM's own Monokuma whatever is selected, so a selection cannot change the tile.
 */
export function registerRoomTile() {
    Hooks.on("drpgRouteSettled", ({ tokenDoc } = {}) => {
        if (!tokenDoc || tokenDoc.actorId !== viewerActor()?.id) return;
        refreshRoomTile();
    });
    Hooks.on("canvasReady", () => refreshRoomTile());
    Hooks.on("createRegion", onRegionChanged);
    Hooks.on("updateRegion", onRegionChanged);
    Hooks.on("deleteRegion", onRegionChanged);
    Hooks.on("drpgHudRendered", () => refreshRoomTile());
    Hooks.on("getHeaderControlsImagePopout", stripImageControls);
    refreshRoomTile();
}
