/**
 * Danganronpa RPG - a token's name, shown when the pointer rests on it.
 * ---------------------------------------------------------------------------
 * S0-HOVERNAME (1.2.129 line MAP, stage E129; released in 1.2.128; the owner after session 0, 23.11.2026: "Najechanie
 * na token myszka przez chwile dluzej niech pokazuje nazwe (imie postaci, "?" Mordercy, nazwe projektu, nazwe
 * remnanta)"). The coordinator's defaults of that day, put to the owner:
 *
 *   - WHEN. Foundry's `hoverToken` starts one timer; after config.mjs `HOVER_NAME.delayMs` the name is put up over the
 *     token's top edge. It is taken down on the hover's end, a press anywhere on the page (a click, a drag's start),
 *     `canvasPan` (a pan or a zoom: the label does not follow), an update or deletion of that token, and the canvas
 *     torn down. Nothing runs at rest: no ticker, no frame, no PIXI - one listener per event above.
 *   - WHAT. `hoverName`, the one rule, from what this browser already holds; a hover asks nobody anything.
 *       * a character: mask-gm.mjs `nameAsSeen` - "?" for a masked token to everyone but its owners and the GMs;
 *       * a Remnant: on a player's browser the name of their OWN Truth Bullet for it (visibility.mjs
 *         `myBulletForRemnant`, what the trace's card titles itself), else the neutral word the token itself carries
 *         (remnants.mjs `traceLabel(null)`); on a GM's, the ledger's (`ledgerLabel`);
 *       * a project: projects-secrecy.mjs `shownName` - a secret project's name only to a browser that sees it, the
 *         neutral "???" to any other (the tray's and the token card's reader);
 *       * a body (a corpse, a Monocub's corpse): nothing - the body tile already draws "{name}'s body" over it;
 *       * anything else (a Monocub, Monokuma, a Spectator's token to its owner): its actor's name, as its cards name
 *         it, or with no actor the token's own name - both held by every browser already.
 *   - NO DOUBLE NAME. No label where Foundry's own nameplate already shows the name to this viewer on a hover or always
 *     (`nameplateShows`: the token's `displayName`, which the world's default token setting gives a character, a trace and
 *     a project alike).
 *   - WHO SEES NONE. A token this browser does not draw: Foundry's `hidden` (but for a GM, and for a trace a GM hid that
 *     this player holds a bullet of, S0-BULLETSEES's `remnantShownHere`), and every rule of
 *     visibility.mjs - the rooms, the Eclipse, the opening's veil, Hide, a Spectator's token, an unfound trace - which
 *     all end in the placeable's `visible` false (`drawnHere`). The label never names what the map does not show.
 *   - HOW. One DOM element, `.drpg-hover-name`, its words by `textContent`, `aria-hidden` (the map is not read to a
 *     screen reader either), placed at the token's top centre in the page's coordinates; both themes dress it
 *     (danganronpa.css, stained-glass.css). Not Foundry's nameplate (`displayName`), which reads the token's own name to
 *     everyone and is left as the world sets it; the module sets it only on a masked token (mask-gm.mjs `maskPatch`).
 *
 * No canvas in the harness: the rule and the element are tier 1's (R8871, R8872) on stand-in tokens; where the label
 * lands on v14's board is LIVE-129-MAP-04.
 */

import { MODULE_ID, HOVER_NAME } from "./config.mjs";
import { nameAsSeen, isMaskedToken } from "./mask-gm.mjs";
import { isCorpseToken } from "./movement.mjs";
import { projectIdOf } from "./projects-map.mjs";
import { shownName, COUNTDOWNS_KEY } from "./projects-secrecy.mjs";
import { isTraceToken, keyOf as remnantKeyOf, traceLabel, ledgerLabel } from "./remnants.mjs";
import { myBulletForRemnant, remnantShownHere } from "./visibility.mjs";
import { getSetting, SETTINGS } from "./settings.mjs";
import { count } from "./perf-counters.mjs";
import { projectSecretStore } from "./gm-stores.mjs";

/** The label's class: the stylesheets dress it by this, and `dropHoverName` finds none other. */
export const HOVER_NAME_CLASS = "drpg-hover-name";

/**
 * The name a hover shows on this browser, or null for none. `drawn` is whether this browser draws the token at all
 * (`drawnHere`); `user` is this browser's own (nothing here answers for another user: a player's browser holds only its
 * own knowledge).
 */
export function hoverName(tokenDoc, { user = game.user, drawn = true, bulletOf = myBulletForRemnant } = {}) {
    if (!tokenDoc || !drawn) return null;
    const gm = user?.isGM === true;
    if (nameplateShows(tokenDoc, user)) return null;
    if (isTraceToken(tokenDoc)) {
        if (gm) return ledgerLabel(tokenDoc);
        /* A trace a GM hid by hand is drawn for a holder of its bullet (S0-BULLETSEES, visibility.mjs
           `remnantShownHere`, config.mjs `HOLDER_SEES_HIDDEN`) and named to them as their bullet names it; to anyone else
           nothing. `bulletOf` is the suite's to hand. */
        const bullet = bulletOf(remnantKeyOf(tokenDoc));
        if (tokenDoc.hidden && !remnantShownHere({ hidden: true, knows: Boolean(bullet) })) return null;
        return traceLabel(bullet);
    }
    if (tokenDoc.hidden && !gm) return null;
    if (isCorpseToken(tokenDoc)) return null;
    const projectId = projectIdOf(tokenDoc);
    if (projectId) return shownName(projectId) || null;
    // Any actor through the mask's reader: "?" only for a masked token, which only a character's is; any other its name.
    const actor = tokenDoc.actor ?? null;
    if (actor) return nameAsSeen(actor, { user, masked: isMaskedToken(tokenDoc) }) || null;
    return tokenDoc.name || null;
}

/* Foundry's `CONST.TOKEN_DISPLAY_MODES`, the four that draw the nameplate on a hover or always (v14's own numbers where
   CONST is absent, as in Node). */
const DISPLAY = () => globalThis.CONST?.TOKEN_DISPLAY_MODES ?? { OWNER_HOVER: 20, HOVER: 30, OWNER: 40, ALWAYS: 50 };

/**
 * NO DOUBLE NAME (the coordinator's addition, 23.11.2026): whether Foundry's own nameplate already shows this token's name to
 * `user` on a hover or always - HOVER and ALWAYS to anyone, OWNER_HOVER and OWNER to its owners (a GM owns every token).
 * Then the module draws nothing: two names, or a real name beside a "?", would read wrong. A masked token's mode is NONE
 * (mask-gm.mjs `maskPatch`), so its "?" is the module's. CONTROL (a controlled token's) is not counted: a hover draws none.
 */
export function nameplateShows(tokenDoc, user = game.user) {
    const mode = tokenDoc?.displayName;
    const M = DISPLAY();
    if (mode === M.HOVER || mode === M.ALWAYS) return true;
    if (mode !== M.OWNER_HOVER && mode !== M.OWNER) return false;
    return Boolean(user?.isGM || tokenDoc.testUserPermission?.(user, "OWNER") || tokenDoc.actor?.testUserPermission?.(user, "OWNER"));
}

/** Whether this browser draws the token: what visibility.mjs and Foundry leave of it on this canvas. */
export function drawnHere(token) {
    return Boolean(token && !token.destroyed && token.visible);
}

/** Where the label stands: the token's top centre in the page's pixels, or null where the canvas cannot say. */
function screenTopOf(token) {
    const at = token?.center;
    const toClient = globalThis.canvas?.clientCoordinatesFromCanvas;
    if (!at || typeof toClient !== "function") return null;
    try {
        return toClient.call(globalThis.canvas, { x: at.x, y: token.y ?? token.document?.y ?? at.y });
    } catch {
        return null;
    }
}

const state = { timer: null, token: null, el: null };

/** The label shown now, or null; and whether a hover's wait is running (the suite's, R8872). */
export function hoverNameShown() {
    return state.el;
}
export function hoverNameWaiting() {
    return state.timer !== null;
}

/** Put the label up over `token` now, if this browser may name it. Returns the element, or null. */
export function showHoverName(token, { user = game.user, at = null, root = globalThis.document?.body } = {}) {
    dropHoverName();
    const text = hoverName(token?.document, { user, drawn: drawnHere(token) });
    const spot = at ?? screenTopOf(token);
    if (!text || !spot || !root) return null;
    const el = root.ownerDocument.createElement("div");
    el.className = HOVER_NAME_CLASS;
    el.setAttribute("aria-hidden", "true");
    el.textContent = text;
    el.style.left = `${Math.round(spot.x)}px`;
    el.style.top = `${Math.round(spot.y)}px`;
    root.append(el);
    state.token = token;
    state.el = el;
    return el;
}

/** Take the label down and stop a timer still waiting. */
export function dropHoverName() {
    if (state.timer !== null) clearTimeout(state.timer);
    state.timer = null;
    state.token = null;
    state.el?.remove();
    state.el = null;
}

/** Foundry's `hoverToken`: a hover starts the wait, its end takes everything down. No label while captions are on. */
export function onHoverToken(token, hovered, { delayMs = HOVER_NAME.delayMs, captions = captionsOn() } = {}) {
    dropHoverName();
    if (!hovered || !token?.document || captions) return;
    state.token = token;
    state.timer = setTimeout(() => {
        state.timer = null;
        if (state.token === token) showHoverName(token);
    }, delayMs);
}

/** A change to the token the label is for (its update or deletion) takes the label down. */
function onTokenChanged(tokenDoc) {
    if (state.token && state.token.document === tokenDoc) dropHoverName();
}

/* ============================ the captions ============================================================================
 * S0-HOVERNAME B (the owner, 23.11.2026: "Dodajmy ustawienie, domyslnie wlaczone, ktore zostawia tooltipy tokenow jako
 * podpis tokenu przesuwajacy sie razem z tokenem"; the coordinator's defaults of that day). While this browser's setting
 * `tokenCaptions` is on (its default), each token wears its name by the hover's rule (`hoverName`) as a caption under it:
 * one PIXI text, a child of the token placeable, so it moves with the token - a drag and a slide included - with no work
 * of the module's per frame, and it is not drawn while its token is not (a child of a hidden display object). Built at
 * Foundry's `drawToken`, and again only when what it reads may have changed: the token's name, flags, nameplate mode,
 * size or `hidden` (`updateToken`), its actor's name or flags (`updateActor`), a Truth Bullet of this player's made,
 * renamed or gone (`createItem`, `updateItem`, `deleteItem`, a player's browser), the GMs' ledger, a project's meta, the
 * countdowns, the GMs' store of secret project names, a project's sight, and the setting itself. Each rebuild is keyed
 * by its inputs: the same words, size and face keep the text standing (`caption.kept`); only a change draws a new one
 * (`caption.drawn`). A move changes none of them. While captions are on the hover draws no label, and where Foundry's own nameplate already shows for this viewer
 * no caption is drawn (`nameplateShows`, through `hoverName`).
 * THE FACE: the hover label's own, read off the stylesheet once per theme - a probe `.drpg-hover-name` on the page, its
 * computed font, colour and background (`captionStyle`, kept until the body's classes change) - the words in the label's
 * colour over a keyline of its ground, as the body's caption is drawn (body-tile.mjs). No canvas in the harness: the
 * caption's rule and its keeping are tier 1's (R8873) on stand-ins; how it sits under a real token is LIVE-129-MAP-06.
 */

/** The caption's display object name: a rebuild finds its own by it, and touches nothing else. */
export const CAPTION_NAME = "drpg-token-caption";

/** Whether this browser draws captions (its setting, on by default; off where settings cannot be read). */
export function captionsOn() {
    try {
        return getSetting(SETTINGS.tokenCaptions) !== false;
    } catch {
        return false;
    }
}

/** "rgb(r, g, b)" or "rgba(r, g, b, a)" as PIXI's number, or null. */
function rgbNumber(css) {
    const m = /rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(String(css ?? ""));
    return m ? (Number(m[1]) << 16) + (Number(m[2]) << 8) + Number(m[3]) : null;
}

let styleMemo = { key: null, style: null };

/** The caption's face, read off the hover label's computed style under this page's theme; kept until the body changes. */
export function captionStyle({ doc = globalThis.document } = {}) {
    const body = doc?.body;
    const key = body?.className ?? "";
    if (styleMemo.style && styleMemo.key === key) return styleMemo.style;
    const style = { family: "sans-serif", fill: 0xeeeeee, stroke: 0x07070a };
    try {
        const probe = doc.createElement("div");
        probe.className = HOVER_NAME_CLASS;
        probe.style.visibility = "hidden";
        body.append(probe);
        const cs = globalThis.getComputedStyle(probe);
        style.family = cs.fontFamily || style.family;
        style.fill = rgbNumber(cs.color) ?? style.fill;
        style.stroke = rgbNumber(cs.backgroundColor) ?? style.stroke;
        probe.remove();
    } catch {
        // A page that cannot be read keeps the plain face.
    }
    /* A FACE NOT LOADED YET IS NOT DRAWN (read in Chromium, 23.11.2026, the caption sheet in docs/dev/owner129/map/): a
       canvas - and PIXI.Text draws on one - uses a webfont only once the page has loaded it, and a face nothing on the
       page has used yet (Legacy's pixel face, before the HUD draws) came out in the fallback. So the face is asked for, and
       once it arrives the memo is dropped and every caption drawn again: `ready` is in the caption's key, so they redraw. */
    const fonts = doc?.fonts;
    const probeFont = `16px ${style.family}`;
    try {
        style.ready = typeof fonts?.check === "function" ? fonts.check(probeFont) : true;
        if (!style.ready && typeof fonts?.load === "function") {
            fonts.load(probeFont).then(() => { styleMemo = { key: null, style: null }; recaptionAll(); }).catch(() => {});
        }
    } catch {
        style.ready = true;
    }
    styleMemo = { key, style };
    return style;
}

function gridOf(doc) {
    return Number(doc?.parent?.grid?.size) || Number(globalThis.canvas?.grid?.size) || 100;
}

/**
 * Draw, keep or take off `token`'s caption on this browser; answers the caption, or null where none stands. `on`, `user`
 * and `style` are the suite's to hand.
 */
export function drawCaption(token, { on = captionsOn(), user = game.user, style = null } = {}) {
    if (!token || token.destroyed || typeof token.addChild !== "function" || !globalThis.PIXI) return null;
    const doc = token.document ?? null;
    const text = on && doc ? hoverName(doc, { user, drawn: true }) : null;
    const grid = gridOf(doc);
    const w = Number(token.w) || (Number(doc?.width) || 1) * grid;
    const h = Number(token.h) || (Number(doc?.height) || 1) * grid;
    const face = text ? (style ?? captionStyle()) : null;
    const key = text ? JSON.stringify([text, w, h, grid, face.family, face.fill, face.stroke, face.ready !== false]) : null;
    const old = (token.children ?? []).filter(c => c?.name === CAPTION_NAME && !c.destroyed);
    const kept = key ? (old.find(c => c.drpgKey === key) ?? null) : null;
    for (const c of old) {
        if (c === kept) continue;
        token.removeChild(c);
        c.destroy?.();
    }
    if (!key) return null;
    if (kept) {
        count("caption.kept");
        return kept;
    }
    count("caption.drawn");
    const label = new PIXI.Text(text, {
        fontFamily: face.family,
        fontSize: Math.max(14, Math.round(grid * 0.2)),
        fill: face.fill,
        stroke: face.stroke,
        strokeThickness: Math.max(3, Math.round(grid * 0.05)),
        align: "center"
    });
    label.name = CAPTION_NAME;
    label.drpgKey = key;
    label.eventMode = "none";
    label.resolution = 2;
    label.anchor?.set?.(0.5, 0);
    label.position?.set?.(w / 2, h + Math.round(grid * 0.04));
    token.addChild(label);
    return label;
}

/** Every token drawn on this canvas, or those `which` keeps, captioned again. */
export function recaptionAll(which = null) {
    for (const token of globalThis.canvas?.tokens?.placeables ?? []) {
        if (!which || which(token.document)) drawCaption(token);
    }
}

/* The fields of a token that its caption reads: a move (x, y, elevation, rotation) changes none of them. */
const TOKEN_FIELDS = ["name", "displayName", "hidden", "flags", "width", "height", "actorId"];

export function registerHoverName() {
    Hooks.on("hoverToken", (token, hovered) => onHoverToken(token, hovered));
    Hooks.on("canvasPan", () => dropHoverName());
    Hooks.on("canvasTearDown", () => dropHoverName());
    Hooks.on("updateToken", doc => onTokenChanged(doc));
    Hooks.on("deleteToken", doc => onTokenChanged(doc));
    // The captions.
    Hooks.on("drawToken", token => drawCaption(token));
    Hooks.on("updateToken", (doc, changes) => {
        if (doc?.object && TOKEN_FIELDS.some(f => f in (changes ?? {}))) drawCaption(doc.object);
    });
    Hooks.on("updateActor", (actor, changes) => {
        if (!("name" in (changes ?? {})) && !("flags" in (changes ?? {}))) return;
        /* A project's and a trace's name never come from their actor (every project token shares one, remnants.mjs's
           traces one): a write on it leaves them as they are. Read in 30-security on 51fd90d3: recaptioning them there read
           the countdowns seven times (`shownName`) inside a window the scenario holds to no reads. */
        recaptionAll(doc => doc?.actorId === actor?.id && !projectIdOf(doc) && !isTraceToken(doc));
    });
    const bulletChanged = item => { if (!game.user?.isGM && item?.parent?.isOwner) recaptionAll(isTraceToken); };
    Hooks.on("createItem", bulletChanged);
    Hooks.on("updateItem", bulletChanged);
    Hooks.on("deleteItem", bulletChanged);
    Hooks.on("clientSettingChanged", key => {
        if (key === `${MODULE_ID}.${SETTINGS.remnantSecrets}`) recaptionAll(isTraceToken);
        /* A project's name: the countdowns, its meta, the GMs' store of secret names (`projectSecretStore`, a GM's), and a
           player's sight of it (`drpgProjectSightChanged`). Not secret.mjs's `drpgSecretStored`, a private card's words:
           read in 30-security on 51fd90d3, it recaptioned every project token, each reading the countdowns, on every
           private card stored. */
        else if (key === `${MODULE_ID}.projectMeta` || key === COUNTDOWNS_KEY || key === `${MODULE_ID}.${projectSecretStore.spec.key}`) {
            recaptionAll(projectIdOf);
        }
    });
    Hooks.on("drpgProjectSightChanged", () => recaptionAll(projectIdOf));
    // A press anywhere: a click on the token, the start of its drag, a press on a window above it.
    globalThis.document?.addEventListener("pointerdown", () => { if (state.timer !== null || state.el) dropHoverName(); }, { capture: true, passive: true });
}
