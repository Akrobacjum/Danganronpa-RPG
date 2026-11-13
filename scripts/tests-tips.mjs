/**
 * Where a tooltip key lands in a function's source (E102; REVIEW-E102-code C1, claude/e93 de7aff40). Read by the
 * family tests R4751-R4754 and R4761 and by its own planted pairs (`tipPlacementSelfCheck`).
 * ---------------------------------------------------------------------------
 * The family tests used to ask only that the function which draws a control NAMES the key (`tipAttr("<key>"` anywhere in
 * it). The review planted `${tipAttr("<key>") ? "" : ""}` at action-dynamic.mjs:336: the key was named, the select drew
 * nothing, and the test stayed green. `tipPlacement(body, key)` answers where the key would be drawn, or null:
 *   - "tag": `tipAttr("<key>"` inside the opening tag of a button, select, input, textarea, summary or `<a>` (read from
 *     its `<` to the call, `${...}` skipped, arrows aside), and not used as a condition (`tipAttr(...) ?`);
 *   - "object": `tipText("<key>"` / `plural("<key>"` as the `tooltip:` of an object that has a `label:` - a footer
 *     button, a DialogV2 button, a tab's section - which the kit draws as the button's title or the tab's data-tooltip;
 *   - "attrs": `"data-tooltip": ... tipText("<key>"` in a builder's attrs (a ternary that yields null allowed: the
 *     builder then leaves the attribute out);
 *   - "dataset": `setTip(<element>, "<key>"` (ui-kit.mjs `setTip`);
 *   - "helper": `tipText("<key>"` handed to one of HELPERS, a local function named here with the attribute it writes
 *     from that argument, each read in its own file by `helperWrites`.
 * WHAT IT IS NOT: a drawn window. It reads source; scenario 95-tooltips-drawn draws the windows the harness can open and
 * reads each control's tooltip there.
 */

/** Local functions that take a tooltip's words as an argument, with what they write from it: [file, function, argument]. */
export const HELPERS = [
    ["despair.mjs", "stepper", "tip"],
    ["passages-tab.mjs", "chip", "tip"]
];

const CONTROL = /^<(button|select|input|textarea|summary|a)\b/;
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** From `${` at i, the index after its `}` (nested braces and strings counted roughly). */
function skipInterp(s, i) {
    let depth = 0;
    for (let j = i + 1; j < s.length; j++) {
        const ch = s[j];
        if (ch === '"' || ch === "'") { const q = ch; j++; while (j < s.length && s[j] !== q) { if (s[j] === "\\") j++; j++; } continue; }
        if (ch === "{") depth++;
        else if (ch === "}") { depth--; if (!depth) return j + 1; }
    }
    return s.length;
}

/** The object literal around position i: [start, end], or null. */
function enclosingObject(s, i) {
    let depth = 0, a = -1;
    for (let j = i; j >= 0; j--) {
        if (s[j] === "}") depth++;
        else if (s[j] === "{") { if (!depth) { a = j; break; } depth--; }
    }
    if (a < 0) return null;
    let d = 0;
    for (let j = a; j < s.length; j++) {
        if (s[j] === "{") d++;
        else if (s[j] === "}") { d--; if (!d) return [a, j + 1]; }
    }
    return null;
}

function inTag(body, at) {
    // is the call used as a condition? `tipAttr("k") ?` or `tipAttr("k", null, { title: true }) ?`
    const close = body.indexOf(")", body.indexOf("(", at));
    const after = body.slice(close + 1).match(/^\s*\)?\s*(\?|&&|\|\|)/);
    if (after) return false;
    const lt = body.lastIndexOf("<", at);
    if (lt < 0 || !CONTROL.test(body.slice(lt, lt + 12))) return false;
    // from the `<` to the call, no `>` outside `${...}` (an arrow's `=>` is not one)
    let j = lt;
    while (j < at) {
        if (body[j] === "$" && body[j + 1] === "{") {
            const end = skipInterp(body, j + 1);
            if (end > at) return true;   // the call sits inside this interpolation of the tag
            j = end;
            continue;
        }
        if (body[j] === ">" && body[j - 1] !== "=") return false;
        j++;
    }
    return true;
}

/** Whether the call at i is an argument of a call of `fn`: named (`<arg>: tipText(`) inside its object, or positional. */
function helperArg(text, i, fn, arg) {
    const open = text.lastIndexOf(`${fn}(`, i);
    if (open < 0 || /[;]/.test(text.slice(open, i))) return false;
    let depth = 0;
    for (let j = open + fn.length; j < i; j++) { if (text[j] === "(") depth++; else if (text[j] === ")") depth--; if (depth <= 0 && j > open + fn.length) return false; }
    return new RegExp(`\\b${arg}\\s*:\\s*$|,\\s*$`).test(text.slice(Math.max(0, i - 40), i));
}

/** Where `key` lands in `body`, or null (see the header). */
export function tipPlacement(body, key, file = null) {
    const k = esc(key);
    const text = String(body ?? "");
    for (const m of text.matchAll(new RegExp(`\\btipAttr\\(\\s*"${k}"`, "g"))) if (inTag(text, m.index)) return "tag";
    for (const m of text.matchAll(new RegExp(`\\b(?:tipText|plural)\\(\\s*"${k}"`, "g"))) {
        const obj = enclosingObject(text, m.index);
        const own = obj ? text.slice(obj[0], m.index) : "";
        if (obj && /\blabel\s*:/.test(text.slice(obj[0], obj[1])) && /\btooltip\s*:[^,{}]*$/.test(own.replace(/\([^()]*\)/g, ""))) return "object";
        if (/"data-tooltip"\s*:[^,{}]*$/.test(text.slice(Math.max(0, m.index - 160), m.index))) return "attrs";
        if (file && HELPERS.some(([f, fn, arg]) => f === file && helperArg(text, m.index, fn, arg))) return "helper";
    }
    if (new RegExp(`\\bsetTip\\(\\s*\\w+\\s*,\\s*"${k}"`).test(text)) return "dataset";
    return null;
}

/** Whether a HELPERS function writes a tooltip attribute from its argument, in that file's source. */
export function helperWrites(src, fn, arg) {
    const at = String(src ?? "").search(new RegExp(`^(?:export )?(?:async )?function ${esc(fn)}\\(`, "m"));
    if (at < 0) return false;
    const body = src.slice(at, at + 1500);
    return new RegExp(`(?:dataset\\.tooltip(?:Text)?\\s*=[^;\\n]*\\b${arg}\\b|"data-tooltip"\\s*:\\s*${arg}\\b|\\{\\s*"data-tooltip"\\s*:\\s*${arg}\\s*\\})`).test(body);
}

/** The planted pairs: [source, key, the placement it must read]. */
export const TIP_PLANTS = [
    ['`<select name="tier"${tipAttr("K.a")}>`', "K.a", "tag"],
    ['`<select name="tier"${tipAttr("K.a") ? "" : ""}>`', "K.a", null],
    ['`<p>${tipAttr("K.a")}</p><button>`', "K.a", null],
    ['`<input type="checkbox"${on ? " checked" : ""}${act === "grant" ? tipAttr("K.a") : tipAttr("K.b")} />`', "K.b", "tag"],
    ['footer: { primary: { action: "ok", label: L("x"), tooltip: tipText("K.a") } }', "K.a", "object"],
    ['footer: { primary: { tooltip: cost > 0 ? plural("K.c", { n: cost }) : tipText("K.a"), action: "ok", label: L("x") } }', "K.c", "object"],
    ['const x = { note: tipText("K.a") };', "K.a", null],
    ['toggle({ name: "t", label: "T", attrs: { "data-tooltip": tipText("K.a") } })', "K.a", "attrs"],
    ['setTip(close, "K.a");', "K.a", "dataset"],
    ['const words = tipText("K.a");', "K.a", null],
    ['stepper("minus", go, off, false, L("x"), tipText("K.a"))', "K.a", "helper"],
    ['other(a, tipText("K.a"))', "K.a", null]
];

export function tipPlacementSelfCheck() {
    return TIP_PLANTS.map(([src, key, want]) => [src, tipPlacement(src, key, "despair.mjs"), want]).filter(([, got, want]) => got !== want)
        .map(([src, got, want]) => `tipPlacement read ${got} where ${want} was planted: ${src}`);
}
