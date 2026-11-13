/**
 * A text field that floats while it is edited (float-text line, 13.11.2026; the owner, 13.11 about 01:55: "okno na tekst
 * po otworzeniu dopasowywalo sie do zawartosci i floatowalo, tzn by bylo wierzchnia warstwa ktorej rozmiar jest
 * niezalezny od reszty okna i rozmiar nie wplywa na reszte okna. Po zakonczeniu edycji okno zmniejsza sie spowrotem do
 * domyslnego rozmiaru ... dla kazdego pola tekstowego w module").
 * ---------------------------------------------------------------------------
 * Every `<textarea>` in one of the module's windows (`.drpg-ui`, `.drpg-panel`, `.drpg-messenger`) or on an actor's sheet,
 * once it has the focus, grows down to fit what it holds and stands over the window; when it loses the focus, or Escape
 * is pressed in it, it goes back to its own size in its own place. Nothing else in the window moves, the window keeps its
 * size and no scroll bar appears on it: audit/float-sweep.mjs measures exactly that in Chromium, field by field.
 *
 * HOW. The field is put in the browser's top layer (the Popover API, `popover="manual"` and `showPopover()`), which no
 * window's `overflow` clips and no window's `backdrop-filter` or `transform` holds - under Stained Glass a window's
 * `.window-content` carries a backdrop filter, and a `position: fixed` field inside it would be placed and clipped by
 * it (read 13.11.2026 on the style harness: the same field fixed was cut at the window's edge). The field stays where it
 * is in the page, so every event it sends still bubbles through its window and form, the window's own listeners and
 * the `form.elements` a submit reads still find it, and every stylesheet rule written for it still matches. Its place
 * in the layout is held by a placeholder of its own box (`HOLD_CLASS`, hidden), so its neighbours stand where they
 * stood. The top layer stands over everything on the page, Foundry's notifications too, for as long as the field is
 * edited: that is the owner's "wierzchnia warstwa".
 *
 * THE FIELD'S OWN LOOK. A popover takes the browser's own face (a border, a padding, Canvas and CanvasText) where no rule
 * states another, so the field's computed face - its font, colours, border, padding, radius and shadow - is written on
 * it inline, each declaration `important` (the module's sheets state some of a field's face with `!important`), before
 * it is lifted, and taken off after, its own `style` attribute put back as it was. A field drawn
 * through (the glass's fields are 55 % ink) would show the window's text through it once it stands over other
 * things: its own colour is laid over an opaque ground, the theme's ink under light text and its bone under dark.
 *
 * SIZE. The width stays the field's own; the height is what its text needs (its `scrollHeight` with the border), never
 * less than its own height, at most `CAP_SHARE` of the screen's height, and the field scrolls inside past that. It
 * stands with its top on its own top, moved up only as far as the screen's bottom edge needs. Every frame while it is
 * edited it is placed again over its placeholder, so a window dragged or scrolled under it carries it along, and when
 * the field leaves the page (its window closed or drawn again) it is let go. It grows as text is typed and shrinks as
 * it is deleted. A 120 ms height transition, none under reduced motion (the Look window's switch, the body's
 * `drpg-reduced-motion`, or the system's).
 *
 * NOT FLOATED: a field `readonly` or `disabled`, one marked `data-drpg-float="off"`, a single-line input, a rich text
 * editor (ProseMirror is not a textarea), and every textarea outside the module's windows and the actor sheet -
 * Foundry's own windows, the chat box and the journal are left as Foundry draws them.
 *
 * A leaf: no import, so audit/float-sweep.mjs loads it on a page with no Foundry.
 */

/** The windows whose textareas float: the module's (the kit's frame, the panels, the messenger) and an actor's sheet. */
export const FLOAT_SCOPE = ".application.drpg-ui, .application.drpg-panel, .application.drpg-messenger, .application.sheet.actor";
/** The class on a floating field and on the placeholder that holds its place. */
export const FLOAT_CLASS = "drpg-float-text";
export const HOLD_CLASS = "drpg-float-text-hold";
/** The tallest a floating field grows, as a share of the screen's height; past it, it scrolls inside. */
export const CAP_SHARE = 0.6;
/** The gap kept between a floating field and the screen's edges, in px. */
export const EDGE_PX = 8;
const GROW_MS = 120;

/* The face a field is drawn with, copied onto it while it floats: longhands only, since a shorthand's computed value can
   read empty where its sides differ. */
const FACE = Object.freeze([
    "font-family", "font-size", "font-weight", "font-style", "font-variant", "line-height", "letter-spacing", "word-spacing",
    "text-transform", "text-align", "text-indent", "white-space", "tab-size", "color", "caret-color",
    "padding-top", "padding-right", "padding-bottom", "padding-left",
    "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
    "border-top-style", "border-right-style", "border-bottom-style", "border-left-style",
    "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
    "border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius",
    "box-shadow", "outline-style", "outline-width", "outline-color", "outline-offset"
]);
/* What the placeholder copies to take the field's place in any layout: block, inline, flex or grid. */
const PLACE = Object.freeze([
    "margin-top", "margin-right", "margin-bottom", "margin-left", "vertical-align",
    "grid-column-start", "grid-column-end", "grid-row-start", "grid-row-end", "flex-grow", "flex-shrink", "flex-basis",
    "align-self", "justify-self", "order", "float", "clear"
]);

/** Whether `el` is a field that floats: a textarea, editable, not opted out, in one of the module's windows. */
export function floats(el) {
    if (!el || el.tagName !== "TEXTAREA") return false;
    if (el.readOnly || el.disabled || el.dataset?.drpgFloat === "off") return false;
    return Boolean(el.closest?.(FLOAT_SCOPE));
}

/** The height a floating field takes, in px, from its own height, the height its text needs and the screen's. */
export function floatHeight({ own, needed, screen }) {
    const cap = Math.max(own, Math.floor(screen * CAP_SHARE));
    return Math.round(Math.min(Math.max(own, needed), cap));
}

/** The top a floating field stands at: its own, moved up only as far as the screen's bottom edge needs. */
export function floatTop({ top, height, screen }) {
    return Math.round(Math.max(EDGE_PX, Math.min(top, screen - EDGE_PX - height)));
}

const rgbaOf = value => {
    const m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/.exec(String(value ?? ""));
    if (!m) return null;
    const a = m[4] === undefined ? 1 : (m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
    return { r: +m[1], g: +m[2], b: +m[3], a };
};

/** The opaque ground a see-through field is laid on: the theme's ink under light text, its bone under dark. */
export function groundFor(textColor, { ink = "#1d1a21", bone = "#e4ded8" } = {}) {
    const c = rgbaOf(textColor);
    const light = c ? (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255 > 0.5 : true;
    return light ? ink : bone;
}

/* An inline declaration marked important (above). */
const put = (el, prop, value) => el.style.setProperty(prop, String(value), "important");
const got = (el, prop) => el.style.getPropertyValue(prop);

const reduced = () => {
    try {
        return document.body.classList.contains("drpg-reduced-motion") || Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
    } catch { return false; }
};

let current = null;

function lift(el) {
    if (current?.el === el) return;
    if (current) drop();
    if (typeof el.showPopover !== "function") return;
    const box = el.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const cs = getComputedStyle(el);
    const own = { style: el.getAttribute("style"), popover: el.getAttribute("popover"), scrollTop: el.scrollTop };
    // the placeholder: the field's box, in the field's place
    const hold = document.createElement("div");
    hold.className = HOLD_CLASS;
    hold.setAttribute("aria-hidden", "true");
    const display = cs.display === "inline" || cs.display === "inline-block" ? "inline-block" : (cs.display === "none" ? "block" : cs.display);
    hold.style.cssText = `display:${display};box-sizing:border-box;width:${box.width}px;height:${box.height}px;visibility:hidden;pointer-events:none;`
        + PLACE.map(k => `${k}:${cs.getPropertyValue(k)}`).join(";");
    el.before(hold);
    // the face, then the place: written inline while it floats, the field's own style attribute kept to put back
    const root = getComputedStyle(document.body);
    const bg = rgbaOf(cs.backgroundColor);
    const ground = groundFor(cs.color, { ink: root.getPropertyValue("--drpg-ink").trim() || undefined, bone: root.getPropertyValue("--drpg-bone").trim() || undefined });
    const background = bg && bg.a >= 1 ? `background:${cs.backgroundColor}`
        : `background-color:${ground};background-image:linear-gradient(${cs.backgroundColor}, ${cs.backgroundColor})${cs.backgroundImage && cs.backgroundImage !== "none" ? `, ${cs.backgroundImage}` : ""}`;
    /* Each written `important`: the module's sheets state a field's face with `!important` in places (Legacy's textarea
       ground, read 13.11.2026 on Room setup's description: its inline ground lost to it and the rows behind showed
       through), and an inline declaration marked important is the one thing that wins over a sheet's. */
    // read before the first write: a computed style is live, and the ground written below would read back as the field's
    const face = FACE.map(k => [k, cs.getPropertyValue(k)]);
    const fieldColor = cs.backgroundColor, fieldImage = cs.backgroundImage;
    for (const [k, v] of face) put(el, k, v);
    if (bg && bg.a >= 1) put(el, "background", fieldColor);
    else {
        put(el, "background-color", ground);
        put(el, "background-image", `linear-gradient(${fieldColor}, ${fieldColor})${fieldImage && fieldImage !== "none" ? `, ${fieldImage}` : ""}`);
    }
    const place = { position: "fixed", inset: "auto", margin: "0", "box-sizing": "border-box", overflow: "auto", resize: "none", "max-width": "none",
        "max-height": "none", "min-height": "0", "min-width": "0", left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` };
    for (const [k, v] of Object.entries(place)) put(el, k, v);
    el.classList.add(FLOAT_CLASS);
    el.setAttribute("popover", "manual");
    try { el.showPopover(); } catch { el.removeAttribute("popover"); }
    el.scrollTop = own.scrollTop;
    current = { el, hold, own, ownHeight: box.height, frame: 0 };
    fit();
    if (!reduced()) put(el, "transition", `height ${GROW_MS}ms cubic-bezier(0.16, 0.84, 0.28, 1), top ${GROW_MS}ms cubic-bezier(0.16, 0.84, 0.28, 1)`);
    follow();
}

/** The height and place of the floating field from its text and its placeholder (on lift, on input, each frame). */
function fit() {
    const c = current;
    if (!c) return;
    const { el, hold } = c;
    const box = hold.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const borders = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    // the text's height is read at the field's own height, so a field that held more and now holds less shrinks
    const shown = got(el, "height");
    const transition = got(el, "transition");
    put(el, "transition", "none");
    put(el, "height", `${c.ownHeight}px`);
    const needed = el.scrollHeight + borders;
    const height = floatHeight({ own: c.ownHeight, needed, screen: innerHeight });
    put(el, "height", shown);
    void el.offsetHeight;
    if (transition) put(el, "transition", transition); else el.style.removeProperty("transition");
    put(el, "height", `${height}px`);
    put(el, "left", `${box.left}px`);
    put(el, "width", `${box.width}px`);
    put(el, "top", `${floatTop({ top: box.top, height, screen: innerHeight })}px`);
}

function follow() {
    const c = current;
    if (!c) return;
    c.frame = requestAnimationFrame(() => {
        if (current !== c) return;
        if (!c.el.isConnected || !c.hold.isConnected) { drop(); return; }
        const box = c.hold.getBoundingClientRect();
        if (Math.round(box.left) !== Math.round(parseFloat(got(c.el, "left"))) || Math.round(box.width) !== Math.round(parseFloat(got(c.el, "width")))
            || Math.abs(box.top - (c.lastTop ?? box.top)) >= 1) fit();
        c.lastTop = box.top;
        follow();
    });
}

/** Put the floating field back in its place at its own size; nothing when none floats. */
export function drop() {
    const c = current;
    if (!c) return false;
    current = null;
    globalThis.cancelAnimationFrame?.(c.frame);
    const { el, hold, own } = c;
    const scrollTop = el.scrollTop;
    try { if (el.matches?.(":popover-open")) el.hidePopover(); } catch { /* already out of the top layer */ }
    if (own.popover === null) el.removeAttribute("popover"); else el.setAttribute("popover", own.popover);
    if (own.style === null) el.removeAttribute("style"); else el.setAttribute("style", own.style);
    el.classList.remove(FLOAT_CLASS);
    hold.remove();
    el.scrollTop = scrollTop;
    return true;
}

/** The field floating now, or null (for the tests). */
export function floatingNow() {
    return current?.el ?? null;
}

function onFocusIn(event) {
    const el = event.target;
    if (floats(el)) lift(el);
}

function onFocusOut(event) {
    if (current && event.target === current.el) drop();
}

function onInput(event) {
    if (current && event.target === current.el) fit();
}

/* Escape in a floating field ends the editing here: the field goes back and loses the focus, and the key goes no
   further, so the window it stands in is not closed by the same press; the next Escape is Foundry's again. Registered
   in the capture phase on `window` before foundry-windows.mjs's and sequence.mjs's listeners (module.mjs's order). */
function onKeyDown(event) {
    if (event.key !== "Escape" || !current || event.target !== current.el) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const el = current.el;
    drop();
    el.blur();
}

let registered = false;
/** Once, at init: every editable textarea of the module's windows floats while it has the focus. */
export function registerFloatText() {
    if (registered) return false;
    registered = true;
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", onFocusOut, true);
    document.addEventListener("input", onInput, true);
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return true;
}
