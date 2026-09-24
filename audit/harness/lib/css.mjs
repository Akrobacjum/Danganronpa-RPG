/**
 * The module's stylesheets on the page, attached the way v14 attaches module CSS
 * (E30, 24.09.2026; the E30 design's option B).
 *
 * Foundry gives module CSS no `<link>` of its own: it writes one inline sheet of
 * `@import url(...) layer(modules)` per stylesheet, and diagnostics.mjs reads
 * the module's sheets that way (`findOurSheets`). The harness linked three of
 * the six files and answered `getPropertyValue("--x")` from a flat map of their
 * custom properties, the last declaration in any of them winning - so a value
 * from inside an `@media` block, or from under the glass theme's class, answered
 * for every element on every page. Now all six are imported in module.json's
 * order through jsdom's resource loader (client-entry.mjs serves the checkout),
 * and jsdom's own cascade answers: selectors, specificity, inheritance and
 * `@media` against the window. How v14 attaches them is LIVE-E30-09.
 *
 * What jsdom does not do is substitute `var()`: a custom property that is built
 * from another comes back as its source text, and a standard property that uses
 * one comes back as "var(--x)". So the wrapped `getPropertyValue` substitutes
 * for custom properties, and standard properties are jsdom's answer as it is.
 */

/** The inline sheet v14 would write for these stylesheets. */
export function moduleStyleImports(styles, moduleId = "danganronpa-rpg") {
    return styles.map(file => `@import url("modules/${moduleId}/${file}") layer(modules);`).join("\n");
}

/**
 * Attach the stylesheets and wait until every import has its rules.
 *
 * Polled, not awaited on the style's load event: that fires before the imports
 * are parsed (the design measured it at 38 ms, with only the first import
 * populated). An attach that has not completed by `timeoutMs` comes back with
 * `complete: false`, and the client treats that as a failed boot.
 */
export async function attachModuleStyles(document, styles, { timeoutMs = 15000, moduleId = "danganronpa-rpg" } = {}) {
    const started = performance.now();
    const style = document.createElement("style");
    style.textContent = moduleStyleImports(styles, moduleId);
    document.head.append(style);
    const imports = () => [...(style.sheet?.cssRules ?? [])].filter(rule => "styleSheet" in rule);
    const loaded = () => imports().filter(rule => (rule.styleSheet?.cssRules?.length ?? 0) > 0);
    while (loaded().length < styles.length && performance.now() - started < timeoutMs) {
        await new Promise(resolve => setTimeout(resolve, 25));
    }
    const done = loaded();
    return {
        files: done.length,
        of: styles.length,
        hrefs: imports().map(rule => rule.href),
        layers: imports().map(rule => rule.layerName ?? null),
        rules: done.reduce((sum, rule) => sum + rule.styleSheet.cssRules.length, 0),
        ms: Math.round(performance.now() - started),
        complete: done.length === styles.length
    };
}

/** Where a `var()` argument splits into the name and the fallback: its first comma outside brackets. */
function topLevelComma(text) {
    let depth = 0;
    for (let i = 0; i < text.length; i++) {
        if (text[i] === "(") depth++;
        else if (text[i] === ")") depth--;
        else if (text[i] === "," && depth === 0) return i;
    }
    return -1;
}

/**
 * `value` with every `var(--x, fallback)` replaced by what `lookup("--x")`
 * holds, itself substituted, eight levels deep at most. A property that
 * leads back to itself, or that holds nothing, gives its fallback, or nothing.
 */
export function substituteVars(value, lookup, depth = 0, seen = new Set()) {
    const text = String(value ?? "");
    if (!text.includes("var(")) return text;
    if (depth > 8) return "";
    let out = "";
    let i = 0;
    while (i < text.length) {
        const at = text.indexOf("var(", i);
        if (at < 0) { out += text.slice(i); break; }
        out += text.slice(i, at);
        let j = at + 4, level = 1;
        while (j < text.length && level) {
            if (text[j] === "(") level++;
            else if (text[j] === ")") level--;
            j++;
        }
        const inner = text.slice(at + 4, level ? j : j - 1);
        const comma = topLevelComma(inner);
        const name = (comma < 0 ? inner : inner.slice(0, comma)).trim();
        const fallback = comma < 0 ? null : inner.slice(comma + 1).trim();
        let resolved = "";
        if (!seen.has(name)) {
            const own = String(lookup(name) ?? "").trim();
            if (own) resolved = substituteVars(own, lookup, depth + 1, new Set([...seen, name])).trim();
        }
        if (!resolved && fallback !== null) resolved = substituteVars(fallback, lookup, depth + 1, seen).trim();
        out += resolved;
        i = j;
    }
    return out;
}

/**
 * `window.getComputedStyle`, with `getPropertyValue("--x")` substituted
 * (`substituteVars`, looked up on the same element). Every other read is
 * jsdom's own. Returns the wrapped function, also set on `window`.
 */
export function wrapGetComputedStyle(window) {
    const real = window.getComputedStyle.bind(window);
    const wrapped = (element, pseudo) => {
        const style = real(element, pseudo);
        return new Proxy(style, {
            get(target, prop) {
                if (prop === "getPropertyValue") {
                    return name => {
                        const value = target.getPropertyValue(name);
                        return String(name).startsWith("--") ? substituteVars(value, other => target.getPropertyValue(other)).trim() : value;
                    };
                }
                const own = target[prop];
                return typeof own === "function" ? own.bind(target) : own;
            }
        });
    };
    window.getComputedStyle = wrapped;
    return wrapped;
}
