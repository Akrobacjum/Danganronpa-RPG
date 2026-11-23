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
 *   - WHO SEES NONE. A token this browser does not draw: Foundry's `hidden` (but for a GM), and every rule of
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

import { HOVER_NAME } from "./config.mjs";
import { nameAsSeen, isMaskedToken } from "./mask-gm.mjs";
import { isCorpseToken } from "./movement.mjs";
import { projectIdOf } from "./projects-map.mjs";
import { shownName } from "./projects-secrecy.mjs";
import { isTraceToken, keyOf as remnantKeyOf, traceLabel, ledgerLabel } from "./remnants.mjs";
import { myBulletForRemnant } from "./visibility.mjs";

/** The label's class: the stylesheets dress it by this, and `dropHoverName` finds none other. */
export const HOVER_NAME_CLASS = "drpg-hover-name";

/**
 * The name a hover shows on this browser, or null for none. `drawn` is whether this browser draws the token at all
 * (`drawnHere`); `user` is this browser's own (nothing here answers for another user: a player's browser holds only its
 * own knowledge).
 */
export function hoverName(tokenDoc, { user = game.user, drawn = true } = {}) {
    if (!tokenDoc || !drawn) return null;
    const gm = user?.isGM === true;
    if (tokenDoc.hidden && !gm) return null;
    if (isCorpseToken(tokenDoc)) return null;
    if (isTraceToken(tokenDoc)) {
        if (gm) return ledgerLabel(tokenDoc);
        return traceLabel(myBulletForRemnant(remnantKeyOf(tokenDoc)));
    }
    const projectId = projectIdOf(tokenDoc);
    if (projectId) return shownName(projectId) || null;
    // Any actor through the mask's reader: "?" only for a masked token, which only a character's is; any other its name.
    const actor = tokenDoc.actor ?? null;
    if (actor) return nameAsSeen(actor, { user, masked: isMaskedToken(tokenDoc) }) || null;
    return tokenDoc.name || null;
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

/** Foundry's `hoverToken`: a hover starts the wait, its end takes everything down. */
export function onHoverToken(token, hovered, { delayMs = HOVER_NAME.delayMs } = {}) {
    dropHoverName();
    if (!hovered || !token?.document) return;
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

export function registerHoverName() {
    Hooks.on("hoverToken", (token, hovered) => onHoverToken(token, hovered));
    Hooks.on("canvasPan", () => dropHoverName());
    Hooks.on("canvasTearDown", () => dropHoverName());
    Hooks.on("updateToken", doc => onTokenChanged(doc));
    Hooks.on("deleteToken", doc => onTokenChanged(doc));
    // A press anywhere: a click on the token, the start of its drag, a press on a window above it.
    globalThis.document?.addEventListener("pointerdown", () => { if (state.timer !== null || state.el) dropHoverName(); }, { capture: true, passive: true });
}
