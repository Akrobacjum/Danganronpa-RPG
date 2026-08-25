/**
 * Danganronpa RPG — diagnostics.
 * ---------------------------------------------------------------------------
 * Answers "why isn't this working" without guesswork. Run from the console:
 *
 *     game.drpg.diagnoseDice()        dice skins
 *     game.drpg.diagnoseDespair()     Despair from rolls
 *     game.drpg.diagnoseCharacters()  who has not been set up yet
 */

import { MODULE_ID, BUILD, STARTING, ITEM_CATEGORIES } from "./config.mjs";
import { SETTINGS, getSetting } from "./settings.mjs";
import { monokumas, getDespair, despairMax } from "./despair.mjs";
import { monokumaFor, students, unassigned } from "./assignments.mjs";
import { studentActors } from "./monokuma.mjs";
import { listExperiences } from "./character.mjs";
import { competingModuleWarnings } from "./voice.mjs";
import { isPrimaryGm, log } from "./utils.mjs";

/**
 * Why Dice So Nice might be rolling unskinned dice.
 *
 * Daggerheart assigns skins with
 *   `rollResult.dice[0].options = await getDiceSoNicePreset(...)`
 * and that helper looks the chosen skin up with
 *   `game.dice3d.DiceFactory.systems.get(type.system)`.
 * If the configured dice system is not installed, the lookup fails and the
 * dice fall back to plain defaults — exactly the "dice appear, skin doesn't"
 * symptom. This reports whether that is what is happening.
 */
export function diagnoseDice() {
    const lines = [];
    const dsn = game.modules.get("dice-so-nice");

    lines.push(`Dice So Nice installed: ${dsn ? "yes" : "no"}${dsn ? `, active: ${dsn.active}` : ""}`);
    if (!dsn?.active) {
        lines.push("→ Nothing else matters until Dice So Nice is enabled.");
        return report("Dice diagnostics", lines);
    }

    const factory = game.dice3d?.DiceFactory;
    if (!factory) {
        lines.push("game.dice3d.DiceFactory is unavailable — Dice So Nice has not finished loading.");
        return report("Dice diagnostics", lines);
    }

    const installed = Array.from(factory.systems?.keys?.() ?? []);
    lines.push(`Dice systems available (${installed.length}): ${installed.join(", ") || "none"}`);

    let appearance;
    try {
        appearance = game.settings.get("daggerheart", "Appearance");
    } catch {
        appearance = null;
    }

    const dsnConfig = appearance?.diceSoNiceData ?? appearance?.diceSoNice;
    if (!dsnConfig) {
        lines.push("Could not read Daggerheart's Appearance settings.");
        return report("Dice diagnostics", lines);
    }

    for (const key of ["hope", "fear"]) {
        const chosen = dsnConfig[key]?.system;
        const exists = chosen ? factory.systems?.has?.(chosen) : false;
        lines.push(
            `${key === "fear" ? "despair" : key} skin: "${chosen ?? "(unset)"}" — ` +
            (exists ? "installed ✓" : "NOT INSTALLED ✗  ← this is why the skin does not apply")
        );
    }

    lines.push("");
    lines.push("Fix: Configure Settings → Daggerheart → Appearance → Dice So Nice, and pick a dice system that is in the list above.");

    return report("Dice diagnostics", lines);
}

/** Why a roll with Despair might not be feeding a pool. */
export function diagnoseDespair() {
    const lines = [];

    const enabled = game.settings.get(MODULE_ID, SETTINGS.despairFromRolls);
    lines.push(`"Rolls grant Despair" setting: ${enabled ? "on" : "OFF ← nothing will be awarded"}`);

    const gms = monokumas();
    lines.push(`Monokumas (full Gamemasters): ${gms.length ? gms.map(u => `${u.name} [${getDespair(u.id)}/${despairMax()}]`).join(", ") : "NONE ← no pools exist"}`);

    const assistants = game.users.filter(u => u.role === CONST.USER_ROLES.ASSISTANT);
    if (assistants.length) {
        lines.push(`Assistant GMs (no pool by design): ${assistants.map(u => u.name).join(", ")}`);
    }

    lines.push(`This client is the primary GM (the one that applies awards): ${isPrimaryGm() ? "yes" : "no"}`);
    if (!isPrimaryGm() && game.user.isGM) {
        lines.push("→ Another GM client is handling awards. That is normal with two GMs connected.");
    }
    if (!game.user.isGM) {
        lines.push("→ You are not a GM, so this client never applies awards. Check from a GM client.");
    }

    const roster = students();
    const loose = unassigned();
    lines.push(`Students: ${roster.length}, never explicitly assigned: ${loose.length}${loose.length ? ` (${loose.map(a => a.name).join(", ")})` : ""}`);

    for (const actor of roster.slice(0, 12)) {
        lines.push(`   ${actor.name} → ${monokumaFor(actor)?.name ?? "nobody"}`);
    }

    const last = [...game.messages].reverse().find(m => (m.rolls?.length ?? 0) > 0);
    if (last) {
        lines.push("");
        lines.push(`Most recent roll message: type "${last.type}", speaker actor "${last.speaker?.actor ?? "(none)"}"`);
        import("./despair-award.mjs").then(m => {
            const outcome = m.readDuality(last);
            console.log(`${MODULE_ID} | last roll read as:`, outcome ?? "not a duality roll");
        });
        lines.push("→ How that roll was read has been logged to the console.");
    }

    return report("Despair diagnostics", lines);
}

/* The tokens the rest of the stylesheet is built out of. If the `:root` block
   is on the page at all, every one of these resolves; if the file was truncated,
   replaced or never attached, they come back empty together. Colours and one
   sprite, because a sprite is a `url()` and fails differently from a hex. */
const LOAD_BEARING_TOKENS = [
    "--drpg-ink", "--drpg-bone", "--drpg-line",
    "--drpg-eye", "--drpg-blood", "--drpg-gold", "--drpg-evidence",
    "--drpg-pix-skull", "--drpg-pix-query", "--drpg-g-move"
];

/* Foundry does not give module CSS its own `<link>`. It writes one inline sheet
   containing `@import url(...) layer(modules)` per package, so our file is a
   nested stylesheet — invisible to a scan of `document.styleSheets` hrefs, which
   is what the previous version of this function did. It reported "the module CSS
   is not attached to this page at all" on a perfectly healthy client. */
function findOurSheets(sheet, depth, found) {
    if (depth > 5) return found;
    let rules;
    try {
        rules = sheet.cssRules;
    } catch {
        // Cross-origin sheets refuse `cssRules`. On a CDN host that is normal
        // and not itself a fault — record it rather than treating it as one.
        if ((sheet.href ?? "").includes(MODULE_ID)) {
            found.push({ href: sheet.href, rules: null, layer: null, opaque: true });
        }
        return found;
    }
    if (!rules) return found;

    for (const rule of rules) {
        const imported = rule.styleSheet;
        if (imported) {
            if ((rule.href ?? "").includes(MODULE_ID) || (imported.href ?? "").includes(MODULE_ID)) {
                let count = null;
                try {
                    count = imported.cssRules.length;
                } catch {
                    count = null;
                }
                found.push({ href: imported.href ?? rule.href, rules: count, layer: rule.layerName ?? null });
            }
            findOurSheets(imported, depth + 1, found);
        } else if (rule.cssRules) {
            findOurSheets(rule, depth + 1, found);   // @layer / @media / @supports block
        }
    }
    return found;
}

/**
 * Is a browser extension repainting the page?
 *
 * Found the hard way. Every colour in the interface was wrong on one machine and
 * right on every other, the stylesheet was byte-identical, every token resolved,
 * and the rule that should have won was present and correct. The winner turned
 * out to be Dark Reader: an extension writes its rules into an INLINE stylesheet
 * with no cascade layer, and unlayered normal declarations beat layered ones no
 * matter how specific the layered one is. Our whole stylesheet lives in
 * `layer modules`, so an extension beats all of it with a plain class selector.
 *
 * Worse, it works from its own cached reading of the file: the values it was
 * substituting came from `--drpg-purple`, a token this module stopped having
 * when the palette moved to Monokuma. When that variable does not resolve, its
 * fallback paints — which is why Despair skulls came out bone-white and the Call
 * icons lavender, two colours that appear nowhere in this project.
 *
 * Foundry already ships a dark theme and this module is drawn for it, so an
 * extension darkening it a second time can only make it wrong.
 *
 * @returns {{name: string, evidence: string}|null}
 */
export function detectPageTinting() {
    const root = document.documentElement;

    if (root.dataset.darkreaderMode || root.dataset.darkreaderScheme) {
        return { name: "Dark Reader", evidence: `<html data-darkreader-mode="${root.dataset.darkreaderMode ?? "?"}">` };
    }
    const styled = document.querySelector("style.darkreader, style[id^='dark-reader']");
    if (styled) {
        return { name: "Dark Reader", evidence: `<style class="${styled.className || styled.id}">` };
    }

    // Nothing named, so look for the shape of the problem instead: a stylesheet
    // with no href, no cascade layer, and enough rules to be a whole-page
    // repaint rather than a widget's few lines.
    for (const sheet of Array.from(document.styleSheets ?? [])) {
        if (sheet.href) continue;
        let rules;
        try {
            rules = sheet.cssRules;
        } catch {
            continue;
        }
        if (!rules || rules.length < 200) continue;
        for (const rule of rules) {
            if (rule.cssText?.includes("--darkreader-")) {
                return { name: "Dark Reader", evidence: `an inline stylesheet of ${rules.length} rules` };
            }
        }
        return { name: "an extension", evidence: `an unlayered inline stylesheet of ${rules.length} rules` };
    }
    return null;
}

/**
 * Say so, once, on the client it is happening to.
 *
 * A warning rather than a fix. The page could tell Dark Reader to leave it alone
 * with a `<meta name="darkreader-lock">`, but silently switching off somebody's
 * extension is not this module's call to make — plenty of people run it for
 * reasons that have nothing to do with taste.
 */
export function warnAboutPageTinting() {
    try {
        const tint = detectPageTinting();
        if (!tint) return;
        log(`${tint.name} is repainting this page — ${tint.evidence}`);
        ui.notifications.warn(
            game.i18n.format("DRPG.Diagnostics.pageTinted", { name: tint.name }),
            { permanent: true }
        );
    } catch {
        // A warning that throws is worse than no warning.
    }
}

/**
 * Every rule on the page that paints this element, in cascade order.
 *
 * For the case where a colour is plainly wrong and the token behind it is plainly
 * right: the declaration exists, resolves, and still loses. Only another rule can
 * do that, and the browser will not tell you which — `getMatchedCSSRules` was
 * removed years ago. So walk every stylesheet, test every selector against the
 * element, and report the ones that declare the property, with the file and the
 * cascade layer they came from. The last one that applies is the winner.
 *
 * Pseudo-element rules are matched on their host: `mask` and `background-color`
 * for these icons live on `::before`, and `matches()` cannot be given a pseudo.
 */
function whoPaints(element, property, pseudo = "") {
    const hits = [];
    const suffix = pseudo ? new RegExp(`::?${pseudo}\\s*$`) : null;

    const collect = (rule, layer, href) => {
        const value = rule.style.getPropertyValue(property);
        if (!value) return;

        for (const one of rule.selectorText.split(",")) {
            let selector = one.trim();
            if (pseudo) {
                if (!suffix.test(selector)) continue;
                selector = selector.replace(suffix, "").trim();
            } else if (/::/.test(selector)) {
                continue;
            }
            try {
                if (!element.matches(selector)) continue;
            } catch {
                continue;                            // a selector we cannot test
            }
            hits.push({
                selector: one.trim(),
                value: value.trim(),
                important: rule.style.getPropertyPriority(property) === "important",
                layer: layer ?? "(none)",
                from: (href ?? "").split("/").slice(-2).join("/") || "(inline)"
            });
            return;                                  // one hit per rule
        }
    };

    const walk = (node, depth, layer, href) => {
        if (depth > 6) return;
        let rules;
        try {
            rules = node.cssRules;
        } catch {
            return;                                  // cross-origin, unreadable
        }
        if (!rules) return;

        for (const rule of rules) {
            if (rule.styleSheet) {                    // @import
                walk(rule.styleSheet, depth + 1, rule.layerName ?? layer, rule.styleSheet.href ?? href);
                continue;
            }

            // Order matters. Under nested CSS every CSSStyleRule carries a
            // `cssRules` list of its own — usually empty — so testing for that
            // first treats every ordinary rule as a group and skips it. That is
            // exactly what the first version of this did: it reported zero rules
            // painting an element that four rules were painting.
            if (rule.selectorText && rule.style) collect(rule, layer, href);
            if (rule.cssRules?.length) walk(rule, depth + 1, rule.name || layer, href);
        }
    };

    for (const sheet of Array.from(document.styleSheets ?? [])) {
        walk(sheet, 0, null, sheet.href);
    }
    return hits;
}

/* Print `whoPaints` output as report lines, newest-wins last. */
function paintLines(label, element, property, pseudo = "") {
    const lines = [];
    if (!element) return lines;
    const hits = whoPaints(element, property, pseudo);
    lines.push(`   ${label} — rules declaring ${property}${pseudo ? ` on ::${pseudo}` : ""}: ${hits.length}`);
    if (!hits.length) {
        lines.push("      none. The colour is inherited from an ancestor, not declared here.");
    }
    for (const hit of hits) {
        lines.push(`      ${hit.value}${hit.important ? " !important" : ""}   ${hit.selector}`);
        lines.push(`         layer ${hit.layer} · ${hit.from}`);
    }
    if (hits.length > 1) lines.push("      ← the LAST one that applies is what you see.");
    return lines;
}

/* Does the loaded face actually carry this character, or is the browser quietly
   substituting? Rasterise it twice — once through the pixel stack, once through
   a plain fallback — and compare the ink. Identical means we are looking at the
   fallback, and a character present in neither is the empty box on screen. */
function rastersDiffer(char, family) {
    try {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 64;
        const ctx = canvas.getContext("2d");
        const ink = stack => {
            ctx.clearRect(0, 0, 64, 64);
            ctx.font = `40px ${stack}`;
            ctx.textBaseline = "top";
            ctx.fillText(char, 2, 2);
            const data = ctx.getImageData(0, 0, 64, 64).data;
            let count = 0, signature = 0;
            for (let i = 3; i < data.length; i += 4) {
                if (data[i] > 10) { count++; signature = (signature * 31 + i) >>> 0; }
            }
            return `${count}:${signature}`;
        };
        return ink(`"${family}", monospace`) !== ink("monospace");
    } catch {
        return null;
    }
}

/**
 * Why the interface might not look the way it does on another install.
 *
 * Written for exactly one situation, and it is the situation we are in: the same
 * module version renders correctly on a local server and wrongly on a hosted one
 * (colours falling back to white, glyphs coming out as empty boxes). Nobody can
 * read the hosted client's DevTools from here, so the module has to report on
 * itself from the machine where it is going wrong.
 *
 * Four things can produce that, and this separates them:
 *   - the stylesheet never arrived, or arrived empty
 *   - it arrived but the `:root` tokens do not resolve, so every `var()` colour
 *     falls back to inherited text colour, which is white on this theme
 *   - the pixel font never arrived, so characters drawn in it are substituted
 *     or come out as boxes
 *   - everything arrived and something else is overriding it
 *
 *     game.drpg.diagnoseStyles()
 *
 * Paste the whole output. Every line is a measurement, not a guess.
 */
export function diagnoseStyles() {
    const lines = [];

    // ---- 1. The page itself -------------------------------------------------
    // First, because it makes every measurement below suspect. An extension
    // repainting the page wins the cascade over everything in a layer, and this
    // module's entire stylesheet is in one.
    const tint = detectPageTinting();
    if (tint) {
        lines.push(`!! ${tint.name.toUpperCase()} IS REPAINTING THIS PAGE — ${tint.evidence}`);
        lines.push("   Its rules sit in no cascade layer, and unlayered rules beat layered ones");
        lines.push("   whatever their specificity. Every colour below may be its choice, not ours.");
        lines.push("   Turn it off for this site before trusting anything else in this report.");
        lines.push("");
    }

    lines.push(`Page: ${location.origin} (${location.protocol})`);
    lines.push(`Module version Foundry loaded: ${game.modules.get(MODULE_ID)?.version ?? "?"}`);
    lines.push(`Foundry ${game.version}, system ${game.system.id} ${game.system.version}`);
    lines.push(`Other active modules: ${game.modules.filter(m => m.active && m.id !== MODULE_ID).map(m => m.id).join(", ") || "none"}`);
    lines.push("");

    // ---- 2. Did the stylesheet arrive, and did it parse? --------------------
    const found = [];
    for (const sheet of Array.from(document.styleSheets ?? [])) findOurSheets(sheet, 0, found);

    lines.push(`Stylesheets from this module: ${found.length} (expected 2)`);
    for (const sheet of found) {
        lines.push(`   ${sheet.href}`);
        lines.push(`      layer: ${sheet.layer ?? "(none)"}, rules parsed: ${
            sheet.opaque ? "unreadable — served cross-origin, which is normal on a CDN"
            : sheet.rules === 0 ? "0  ← ARRIVED BUT EMPTY"
            : sheet.rules}`);
    }
    if (!found.length) {
        lines.push("   ← nothing from this module is attached to the page. Check that the module is enabled,");
        lines.push("     then look for danganronpa.css in the resource list below.");
    }

    // ---- 3. Do the tokens resolve? -----------------------------------------
    const root = getComputedStyle(document.documentElement);
    const missing = [];
    lines.push("");
    lines.push("Theme tokens:");
    for (const token of LOAD_BEARING_TOKENS) {
        const value = root.getPropertyValue(token).trim();
        if (!value) missing.push(token);
        lines.push(`   ${token.padEnd(20)} ${value ? value.slice(0, 52) : "(EMPTY)  ← unresolved"}`);
    }
    if (missing.length === LOAD_BEARING_TOKENS.length) {
        lines.push("   ← ALL of them are empty. The :root block is not on this page, so every var() colour");
        lines.push("     in the module falls back to inherited text colour — that is the white-icon symptom.");
    } else if (missing.length) {
        lines.push(`   ← ${missing.length} unresolved: ${missing.join(", ")}`);
    }

    // ---- 4. Did the pixel font arrive, and does it carry its characters? ----
    lines.push("");
    const pixelOn = document.body.classList.contains("drpg-pixel-font");
    lines.push(`Pixel font setting: ${pixelOn ? "on" : "off (body.drpg-pixel-font absent)"}`);
    const faces = Array.from(document.fonts ?? []).filter(f => f.family.includes("DRPG"));
    lines.push(`@font-face entries for "DRPG Pixel": ${faces.length} (expected 2 — latin and latin-ext)`);
    for (const face of faces) {
        lines.push(`   status: ${face.status}${face.status === "error" ? "  ← THE FILE FAILED TO LOAD" : ""}, range: ${face.unicodeRange.slice(0, 34)}`);
    }
    if (pixelOn) {
        for (const char of ["?", "A", "1"]) {
            const differs = rastersDiffer(char, "DRPG Pixel");
            lines.push(`   "${char}" drawn in DRPG Pixel: ${
                differs === null ? "could not measure"
                : differs ? "the real glyph"
                : "IDENTICAL TO THE FALLBACK  ← substituted, the font is not being used here"}`);
        }
    }

    // ---- 5. The two things that were reported wrong ------------------------
    lines.push("");
    const pip = document.querySelector("#drpg-despair .drpg-despair-pip");
    if (!pip) {
        lines.push("Despair bar: not on screen, so nothing to measure there.");
    } else {
        const bar = document.querySelector("#drpg-despair");
        const before = getComputedStyle(pip, "::before");
        const masked = bar.classList.contains("masked");
        // Both states are masks — a skull for the GM, a question mark for a
        // player — so the useful question is which one landed, and whether it
        // landed at all. No mask plus a background is a solid square on screen.
        const mask = before.maskImage || before.webkitMaskImage || "none";
        const wanted = root.getPropertyValue(masked ? "--drpg-pix-query" : "--drpg-pix-skull").trim();
        lines.push(`Despair bar: ${bar.classList.length ? bar.className : "(no classes)"}${masked ? "  — this client sees question marks" : "  — this client sees skulls"}`);
        lines.push(`   pip colour: ${getComputedStyle(pip).color}`);
        lines.push(`   ::before content: ${before.content}, background: ${before.backgroundColor}`);
        lines.push(`   ::before mask: ${mask.slice(0, 46)}`);
        if (mask === "none") {
            lines.push("   ← NO MASK. With a background colour set, that draws a filled square, not a glyph.");
        } else if (wanted && mask.replace(/\s+/g, "") !== wanted.replace(/\s+/g, "")) {
            lines.push(`   ← the wrong mask for this state — expected the ${masked ? "question mark" : "skull"}.`);
        }
        lines.push(...paintLines("pip", pip, "color"));
    }

    const callIcon = document.querySelector(".drpg-despair-panel .drpg-call-button .drpg-action-icon");
    if (!callIcon) {
        lines.push("Despair Calls: no Monokuma sheet open, so the call icons were not measured.");
    } else {
        const style = getComputedStyle(callIcon);
        const blood = root.getPropertyValue("--drpg-blood").trim();
        lines.push(`Despair Call icon colour: ${style.color} (background-color: ${style.backgroundColor})`);
        lines.push(`   should be --drpg-blood = ${blood || "(EMPTY)"}`);
        lines.push(`   mask: ${(style.maskImage || style.webkitMaskImage || "none").slice(0, 46)}`);
        lines.push(`   inline style on the element: ${callIcon.getAttribute("style") || "(none)"}`);
        lines.push(`   parent colour: ${getComputedStyle(callIcon.parentElement).color}`);
        lines.push(...paintLines("call icon", callIcon, "color"));
    }

    // The theme the client is actually in. Foundry paints its own chrome from
    // this, and a module that forces client settings can move it out from under
    // a player without anyone choosing it.
    lines.push("");
    let scheme = "(unreadable)";
    try {
        scheme = JSON.stringify(game.settings.get("core", "uiConfig")?.colorScheme ?? "(unset)");
    } catch { /* older core, or the setting is gone */ }
    lines.push(`Colour scheme: ${scheme}`);
    lines.push(`<html> classes: ${document.documentElement.className || "(none)"}`);
    lines.push(`<body> classes: ${document.body.className || "(none)"}`);

    // ---- 6. What actually came over the wire -------------------------------
    lines.push("");
    const resources = (performance.getEntriesByType?.("resource") ?? [])
        .filter(r => r.name.includes(MODULE_ID));
    const origins = [...new Set(resources.map(r => { try { return new URL(r.name).origin; } catch { return "?"; } }))];
    lines.push(`Module files fetched: ${resources.length}, served from: ${origins.join(", ") || "(none)"}`);
    for (const r of resources.filter(r => /\.css$|\.woff2$/.test(r.name))) {
        // A 304 revalidation reports decoded 0 bytes and is perfectly healthy —
        // the body came from cache. Only the status code separates that from a
        // 404, so prefer it and stay quiet when the browser does not expose it.
        const status = r.responseStatus;
        const verdict =
            status >= 400 ? `  ← HTTP ${status}, THIS FILE DID NOT ARRIVE`
            : status ? `  (HTTP ${status})`
            : r.decodedBodySize === 0 && r.transferSize === 0 ? "  ← nothing transferred and nothing decoded"
            : "";
        lines.push(`   ${r.name.split("/").slice(-2).join("/")} — transferred ${r.transferSize}B, decoded ${r.decodedBodySize}B${verdict}`);
    }
    if (!resources.some(r => /\.woff2$/.test(r.name))) {
        lines.push("   no .woff2 was requested at all — either the font setting is off, or no text on screen");
        lines.push("   is using the pixel face yet. Open the Despair bar or a character sheet and run this again.");
    }

    return report("Style diagnostics", lines);
}

/**
 * Is the stylesheet on this page the one that shipped with this module?
 *
 * Runs at load and says nothing when the answer is yes, which is almost
 * always. The two answers worth hearing:
 *
 *   the token is EMPTY      the stylesheet is not on this page at all — it did
 *                           not arrive, or it arrived and failed to parse
 *   the token DISAGREES     the page has an older copy of the file. A browser
 *                           or a CDN is holding it; the module cannot fix that
 *                           from inside the page, and a hard reload can
 *
 * Deliberately NOT self-healing. Re-attaching the file with a cache-busting
 * query would put the new copy OUTSIDE `layer(modules)` — Foundry imports
 * module CSS into that layer, and unlayered rules beat layered ones whatever
 * their specificity. The fix would land the whole stylesheet in a different
 * part of the cascade than it was written for, which is a worse bug than the
 * one it set out to solve, and a harder one to see.
 */
export function stylesheetVersion() {
    return getComputedStyle(document.documentElement)
        .getPropertyValue("--drpg-css-version").trim().replace(/^["']|["']$/g, "");
}

export function verifyStylesheet() {
    const css = stylesheetVersion();
    if (css === BUILD) return true;

    if (!css) {
        console.warn(`${MODULE_ID} | The module stylesheet is not on this page. `
            + "Run game.drpg.diagnoseStyles() for where it went.");
        ui.notifications.warn(game.i18n.localize("DRPG.Diagnostics.cssMissing"), { permanent: true });
        return false;
    }

    // Which of the two is behind matters, because the fix is different. An old
    // stylesheet is a browser cache and a hard reload clears it. Old scripts
    // with a new stylesheet is the other way round — the files were replaced
    // and this tab still has the previous ones, which a reload also fixes, but
    // if it survives a reload the host is serving them.
    console.warn(`${MODULE_ID} | Stylesheet v${css}, scripts v${BUILD}. `
        + "The two halves of this module are from different builds. Reload; if that does not "
        + "change it, the host is still serving one of them.");
    ui.notifications.warn(game.i18n.format("DRPG.Diagnostics.buildMismatch",
        { css, scripts: BUILD }), { permanent: true });
    return false;
}

/**
 * Why is a Foundry config window cut off at the right edge?
 *
 * Open the window that is wrong — Token Config, Scene Config — and then:
 *
 *     game.drpg.diagnoseWindows()
 *
 * Every line is a measurement of THAT window. The one that matters most is
 * `scrollWidth vs clientWidth`: that is the definition of "cut off", and it
 * separates a window whose contents overflow from a window that is simply
 * narrow. The rest names the four things that can push a form past its own
 * frame — a fixed-width face on labels laid out in pixels, a UI scale, a
 * `.form-group` that cannot wrap, and a `.window-content` that cannot scroll.
 */
export function diagnoseWindows() {
    const lines = [];

    const css = stylesheetVersion();
    const manifest = game.modules.get(MODULE_ID)?.version ?? "?";
    lines.push(`Foundry ${game.version}, ${game.system.id} ${game.system.version}`);
    lines.push(`Host: ${location.origin}`);
    lines.push(`Running: scripts v${BUILD}, stylesheet v${css || "(NOT ON THIS PAGE)"}`
        + (css && css !== BUILD ? "   ← THE TWO HALVES ARE FROM DIFFERENT BUILDS" : ""));
    lines.push(`Manifest says: v${manifest}${manifest !== BUILD
        ? "   (the host's record of what it installed — lagging behind the files is normal "
          + "on a hosted world and harmless)" : ""}`);

    // The two settings that change how wide text is drawn, either of which can
    // differ between a local world and a hosted one without anybody meaning it.
    let fontSize = "(unreadable)";
    let scale = "(unreadable)";
    try {
        const ui = game.settings.get("core", "uiConfig") ?? {};
        fontSize = String(ui.fontSize ?? "(unset)");
        scale = String(ui.uiScale ?? "(unset)");
    } catch { /* older core */ }
    lines.push(`Core UI: fontSize ${fontSize}, uiScale ${scale}`);
    lines.push(`Pixel font setting: ${
        getSetting(SETTINGS.pixelFont) ? "ON" : "off"}, body.drpg-pixel-font: ${
        document.body.classList.contains("drpg-pixel-font") ? "present" : "absent"}`);
    lines.push("");

    // ---- the windows themselves --------------------------------------------
    const windows = Array.from(document.querySelectorAll(".application"))
        .filter(el => /config|sheet/i.test(el.className) && el.offsetParent !== null
            && !el.classList.contains("drpg-panel"));

    if (!windows.length) {
        lines.push("No config window is open. Open Token Config or Scene Config and run this again.");
        return report("Window diagnostics", lines);
    }

    for (const win of windows) {
        const content = win.querySelector(".window-content") ?? win;
        const winRect = win.getBoundingClientRect();
        const style = getComputedStyle(win);
        const contentStyle = getComputedStyle(content);
        const overflows = content.scrollWidth - content.clientWidth;

        lines.push(`${win.id || "(no id)"}  [${win.className}]`);
        lines.push(`   window: ${Math.round(winRect.width)}x${Math.round(winRect.height)}px, `
            + `inline width: ${win.style.width || "(none)"}, max-width: ${style.maxWidth}`);
        lines.push(`   content: scrollWidth ${content.scrollWidth} vs clientWidth ${content.clientWidth}`
            + (overflows > 1 ? `   ← ${overflows}px OF THIS WINDOW IS UNREACHABLE` : "   (nothing is cut off)"));
        lines.push(`   overflow: ${contentStyle.overflowX} / ${contentStyle.overflowY}`);

        const group = win.querySelector(".form-group");
        if (group) {
            const gs = getComputedStyle(group);
            lines.push(`   .form-group: flex-wrap ${gs.flexWrap}, gap ${gs.gap}`);
        }

        // What face the labels are actually drawn in. A fixed-width pixel face
        // on a label column sized for a proportional one is the whole of the
        // original bug, and it is invisible in a screenshot to anyone who does
        // not already suspect it.
        const label = win.querySelector("label, .form-group > label, legend");
        if (label) {
            const ls = getComputedStyle(label);
            const pixel = /pixel|press start/i.test(ls.fontFamily);
            lines.push(`   label font: ${ls.fontFamily.slice(0, 60)}${
                pixel ? "   ← THE PIXEL FACE IS BEING APPLIED INSIDE A CORE WINDOW" : ""}`);
            lines.push(`   label width: ${Math.round(label.getBoundingClientRect().width)}px, `
                + `white-space: ${ls.whiteSpace}`);
        }
        lines.push("");
    }

    return report("Window diagnostics", lines);
}

/**
 * WHY DID THAT CLICK NOT DO ANYTHING?
 *
 * Reported from the hosted world: controls in Token Config need several
 * clicks before one takes. That has three possible shapes and they are told
 * apart by measurement, not by looking:
 *
 *   something is ON TOP     the press lands on a different element than the
 *                           one under the cursor looks like
 *   it is REPLACED          the element is torn out of the page between press
 *                           and release, so the browser has nothing to fire a
 *                           click on — a re-render mid-gesture
 *   it is CANCELLED         the click happens and something calls
 *                           preventDefault or stops it propagating
 *
 * Run it, then click the control that misbehaves several times:
 *
 *     game.drpg.traceClicks()
 *
 * It watches for twenty seconds and then posts what it saw. Nothing is
 * intercepted — every listener is passive and in the capture phase, so this
 * cannot itself be the reason a click goes missing.
 */
export function traceClicks({ seconds = 20 } = {}) {
    const lines = [];
    const t0 = performance.now();
    const at = () => `${String(Math.round(performance.now() - t0)).padStart(5)}ms`;

    const name = el => {
        if (!el) return "(nothing)";
        const id = el.id ? `#${el.id}` : "";
        const cls = typeof el.className === "string" && el.className
            ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}` : "";
        return `${el.tagName.toLowerCase()}${id}${cls}`;
    };

    // A control that fires the same event twelve times a second will fill any
    // report before the thing being investigated has happened. Consecutive
    // identical lines collapse into one with a count, which turns a flood from
    // something that hides the answer into the answer.
    const push = line => {
        const last = lines[lines.length - 1];
        if (last && last.text === line) {
            last.n += 1;
            return;
        }
        lines.push({ text: line, n: 1 });
    };

    let pressed = null;
    const handlers = {
        pointerdown(event) {
            pressed = event.target;
            const covering = document.elementFromPoint(event.clientX, event.clientY);
            push(`DOWN   on ${name(event.target)}`);
            if (covering && covering !== event.target && !event.target.contains(covering)) {
                push(`       ← the point actually belongs to ${name(covering)} `
                    + `(z-index ${getComputedStyle(covering).zIndex}) — SOMETHING IS ON TOP`);
            }
            const target = event.target;
            requestAnimationFrame(() => {
                if (!target.isConnected) {
                    push(`       ← ${name(target)} LEFT THE PAGE one frame after the press. `
                        + "Something re-rendered this window mid-click.");
                }
            });
        },
        pointerup(event) {
            const gone = pressed && !pressed.isConnected;
            push(`UP     on ${name(event.target)}${
                gone ? "   ← the element pressed no longer exists, so no click can fire" : ""}`);
        },
        click(event) {
            push(`CLICK  on ${name(event.target)}${
                event.defaultPrevented ? "   ← already defaultPrevented before it got here" : ""}`);
        },
        change(event) {
            push(`CHANGE on ${name(event.target)} → ${
                String(event.target?.value ?? "").slice(0, 30)}`);
        }
    };

    for (const [type, fn] of Object.entries(handlers)) {
        document.addEventListener(type, fn, { capture: true, passive: true });
    }

    ui.notifications.info(game.i18n.format("DRPG.Diagnostics.tracing", { seconds }));

    setTimeout(() => {
        for (const [type, fn] of Object.entries(handlers)) {
            document.removeEventListener(type, fn, { capture: true });
        }

        const out = lines.map(l => l.n > 1 ? `${l.text}   × ${l.n}` : l.text);

        // A control repeating itself hundreds of times in twenty seconds is
        // not the user pressing anything. Every event it fires on a form that
        // submits on change costs a re-render, and a window that re-renders
        // under the pointer cannot be clicked reliably — so this line is
        // usually the whole answer.
        const storm = lines
            .filter(l => l.n >= 20 && l.text.startsWith("CHANGE"))
            .sort((a, b) => b.n - a.n)[0];
        if (storm) {
            out.unshift("", `!! ${storm.text.split(" → ")[0]} fired ${storm.n} times without being `
                + "touched. Whatever owns that control is re-rendering this window continuously, "
                + "and a window that re-renders under the pointer eats clicks. Disable the module "
                + "that field belongs to and try again.", "");
        }

        if (!out.length) out.push("Nothing happened while this was watching.");
        out.unshift(`Foundry ${game.version}, ${game.system.id} ${game.system.version}, `
            + `scripts v${BUILD}, stylesheet v${stylesheetVersion() || "(none)"}`, "");
        report("Click trace", out);
    }, seconds * 1000);

    return `Watching clicks for ${seconds} seconds.`;
}

/**
 * WHICH OF THIS MODULE'S FILES DID THE SERVER ACTUALLY UPDATE?
 *
 *     await game.drpg.fileSizes()
 *
 * Fetches each script and stylesheet straight from the host, bypassing the
 * browser cache, and reports the size of what came back. Sizes are not a
 * checksum and are not meant to be: paste the list, and the same list taken
 * from the working copy answers "is this file the one I edited" in one glance.
 *
 * It exists because the ordinary answers do not work on a hosted world. The
 * manifest version is the host's record of an install, not a description of
 * the files; `BUILD` and the stylesheet stamp cover two files out of seventy;
 * and a deployment that replaced some files and not others looks exactly like
 * a deployment that worked.
 */
export async function fileSizes() {
    const lines = [];
    const files = [
        "module.json",
        "styles/motion.css",
        "styles/danganronpa.css",
        "scripts/motion.mjs",
        "scripts/config.mjs",
        "scripts/action-rolls.mjs",
        "scripts/sheet.mjs",
        "scripts/gm-panel.mjs",
        "scripts/diagnostics.mjs",
        "scripts/stacking.mjs",
        "scripts/hud.mjs",
        "lang/en.json"
    ];

    lines.push(`scripts v${BUILD}, stylesheet v${stylesheetVersion() || "(none)"}, `
        + `manifest v${game.modules.get(MODULE_ID)?.version ?? "?"}`);
    lines.push(`Host: ${location.origin}`);
    lines.push("");

    for (const file of files) {
        try {
            const res = await fetch(`modules/${MODULE_ID}/${file}`, { cache: "reload" });
            if (!res.ok) {
                lines.push(`${file.padEnd(30)} HTTP ${res.status}  ← DID NOT ARRIVE`);
                continue;
            }
            const text = await res.text();
            lines.push(`${file.padEnd(30)} ${String(text.length).padStart(7)} chars`);
        } catch (err) {
            lines.push(`${file.padEnd(30)} could not be fetched: ${err.message}`);
        }
    }

    return report("File sizes", lines);
}

/**
 * Are the Truth Bullets whole?
 *
 * Two things can go quietly wrong. The rows are injected into Daggerheart's own
 * inventory DOM, so a system update that renames the inventory section leaves
 * the badges rendering nowhere — visible here as bullets that exist but have no
 * rows on an open sheet. And because the answer key lives in a GM-side ledger
 * keyed by item uuid, the two halves can drift: a bullet with no entry, or an
 * entry whose bullet is gone.
 *
 *     game.drpg.diagnoseTruthBullets()
 */
export function diagnoseTruthBullets() {
    const lines = [];

    if (!game.user.isGM) {
        lines.push("Not a GM — the answer key is not on this client, so only the visible half can be checked.");
    }

    const bullets = [];
    for (const actor of game.actors) {
        if (actor.type !== "character") continue;
        for (const item of actor.items) {
            if (item.getFlag(MODULE_ID, "category") !== "truthBullet") continue;
            bullets.push({ actor, item });
        }
    }
    lines.push(`Truth Bullets in the world: ${bullets.length}`);

    const unmigrated = bullets.filter(b => !b.item.getFlag(MODULE_ID, "shownType"));
    lines.push(`   without a shown type (never migrated): ${unmigrated.length}${
        unmigrated.length ? "  ← run game.drpg.migrateTruthBullets()" : ""
    }`);

    if (game.user.isGM) {
        const ledger = game.settings.get(MODULE_ID, SETTINGS.truthBulletSecrets) ?? {};
        const live = new Set(bullets.map(b => b.item.uuid));
        const known = Object.entries(ledger).filter(([, e]) => e && !e.deleted).map(([uuid]) => uuid);

        const missing = bullets.filter(b => !known.includes(b.item.uuid));
        const orphans = known.filter(uuid => !live.has(uuid));

        lines.push(`Ledger entries on this browser: ${known.length}`);
        lines.push(`   bullets with no entry: ${missing.length}${
            missing.length ? "  ← they will read as Neutral to every GM" : ""
        }`);
        for (const m of missing.slice(0, 10)) lines.push(`      ${m.actor.name} — ${m.item.name}`);
        lines.push(`   entries whose bullet is gone: ${orphans.length}${
            orphans.length ? "  ← harmless, but dropSecret() was missed somewhere" : ""
        }`);
        lines.push("Back the ledger up with game.drpg.exportLedger() — it lives in browser storage, not the world.");
    }

    // "Neutral" describes a BULLET the player has not identified yet, not a kind
    // of trace anyone leaves. A Neutral Remnant on the map is almost always a GM
    // who meant to pick a real category — Observe prices it as Prep so it still
    // works, but the GM should know it is guessing on their behalf.
    const neutral = [];
    for (const scene of game.scenes) {
        for (const token of scene.tokens) {
            if (!token.getFlag(MODULE_ID, "isRemnant")) continue;
            if (token.getFlag(MODULE_ID, "remnantType") !== "neutral") continue;
            neutral.push(scene.name);
        }
    }
    if (neutral.length) {
        lines.push(`Neutral Remnants on the map: ${neutral.length}  ← give each a real category`);
        lines.push(`   scenes: ${Array.from(new Set(neutral)).join(", ")}`);
    }

    // The DOM half: only meaningful with a sheet open, so say so rather than
    // report a zero that means "nothing is open".
    const rows = document.querySelectorAll(".drpg-truth-bullet");
    const groups = document.querySelectorAll('.drpg-inventory-group[data-category="truthBullet"]');
    lines.push(`Bullet rows rendered right now: ${rows.length} (in ${groups.length} inventory group(s))`);
    if (!groups.length) {
        lines.push("   ← open a character sheet on the Inventory tab and run this again;");
        lines.push("      still zero with a sheet open means the injection point moved.");
    }

    return report("Truth Bullet diagnostics", lines);
}

/**
 * Why per-region voice is not moving anybody.
 *
 * Every failure this subsystem can have is silent by design — an assignment
 * nobody can apply settles quietly, a client that is not using LiveKit reports
 * "unavailable", a world with A/V off never reaches the server. That is right
 * for the log and useless for a GM staring at a table that is all in one room.
 * This is the one place that says which of the five links is broken.
 *
 * Run it on the client that is complaining, not only on the GM's.
 */
export function diagnoseVoice() {
    const lines = [];
    const av = game.modules.get("avclient-livekit");

    lines.push(`Regional voice setting: ${game.settings.get(MODULE_ID, SETTINGS.voiceEnabled) ? "on" : "OFF"}`);
    lines.push(`avclient-livekit installed: ${av ? "yes" : "no"}${av ? `, active: ${av.active}` : ""}`);
    if (!av?.active) {
        lines.push("→ Nothing else matters until LiveKit AVClient is enabled.");
        return report("Voice diagnostics", lines);
    }

    const modes = foundry.av.AVSettings.AV_MODES;
    const mode = game.webrtc?.mode;
    const modeName = Object.entries(modes).find(([, v]) => v === mode)?.[0] ?? String(mode);
    lines.push(`World A/V mode: ${modeName}${mode === modes.DISABLED ? "  ← nothing can connect" : ""}`);

    const client = game.webrtc?.client;
    const liveKit = client?._liveKitClient;
    lines.push(`A/V client class: ${client?.constructor?.name ?? "none"}`);
    if (!liveKit) {
        lines.push("→ This world is not using the LiveKit client, so no room switching is possible.");
        return report("Voice diagnostics", lines);
    }

    lines.push(`LiveKit init state: ${liveKit.initState}`);
    lines.push(`LiveKit connection: ${liveKit.connectionState}`);
    lines.push(`Room this client is in: ${client.room ?? "(none)"}`);
    lines.push(`Breakout this client was told: ${liveKit.breakoutRoom ?? "(main room)"}`);

    // Region names are what room assignments are built from — a scene with none
    // is a scene where everybody shares the main room, and that looks identical
    // to the subsystem being broken.
    const regions = Array.from(canvas?.scene?.regions ?? []).map(r => r.name).filter(Boolean);
    lines.push(`Named regions on the current scene: ${regions.length}${
        regions.length ? ` (${regions.join(", ")})` : "  ← nothing to assign anyone to"}`);

    lines.push(`This client runs the assignment loop: ${isPrimaryGm() ? "yes" : "no"}`);
    if (!isPrimaryGm() && !game.users.find(u => u.isGM && u.active)) {
        lines.push("   ← and no GM is connected, so nobody is running it at all.");
    }

    // Everything above answers "am I in the right room". None of it answers "can
    // I hear anyone", and the commonest reason for the second to be no while the
    // first is yes is another module turning the volume down. See
    // `competingModuleWarnings` in voice.mjs.
    for (const line of competingModuleWarnings()) lines.push(line);

    return report("Voice diagnostics", lines);
}

/**
 * Which characters have never been given the guide's starting resources.
 *
 * The one check worth running before a session zero. Daggerheart derives max HP
 * and Stress from a class; this game has none, so `initCharacter` is the only
 * thing that ever writes them — and a character it has not touched reads
 * `max: 0` on both tracks, which is indistinguishable from a character who has
 * been beaten unconscious. The sheet grows a button while that is true (see
 * `injectInitButton` in sheet.mjs); this answers the same question for the
 * whole roster at once.
 */
export function diagnoseCharacters({ toChat = true } = {}) {
    const lines = [];
    const roster = studentActors();

    lines.push(`Students (Monokumas excluded): ${roster.length}`);
    lines.push(`Starting resources: ${STARTING.hp} HP, ${STARTING.stress} Stress, ${STARTING.hope} Hope`);
    lines.push("");

    const pending = [];
    for (const actor of roster) {
        const hp = actor.system?.resources?.hitPoints?.max ?? 0;
        const stress = actor.system?.resources?.stress?.max ?? 0;
        const ok = hp === STARTING.hp && stress === STARTING.stress;
        if (!ok) pending.push(actor);
        lines.push(`   ${ok ? "✓" : "✗"} ${actor.name} — HP max ${hp}, Stress max ${stress}${
            ok ? "" : "  ← not set up"}`);
    }

    lines.push("");
    if (pending.length) {
        lines.push(`${pending.length} character(s) still need their starting resources.`);
        lines.push("Each of them counts as Wounded AND Broken Down right now: one action");
        lines.push("instead of two, and disadvantage forced onto every roll.");
        lines.push("");
        lines.push("Fix: open the sheet and press the wand button next to the name,");
        lines.push("or run  game.drpg.initCharacter(actor)  for each.");
    } else if (roster.length) {
        lines.push("Every character has the starting resources.");
    }

    /*
     * The four things that are agreed before a season and then never thought
     * about again — which is exactly why they are worth a list.
     *
     * Resources are only half of "is this character ready". A student with the
     * right HP and Stress can still be sitting there with no Ultimate, no
     * experiences, no opening item and no Monokuma watching them, and every one
     * of those is invisible until the moment it matters: the first roll that
     * wants an experience, the first Despair award with nowhere to go.
     */
    const missingUltimate = [];
    const missingExperiences = [];
    const missingItem = [];
    const unwatched = [];

    for (const actor of roster) {
        if (!actor.getFlag(MODULE_ID, "ultimate")) missingUltimate.push(actor.name);

        const experiences = listExperiences(actor);
        if (experiences.length < STARTING.experiences) {
            missingExperiences.push(`${actor.name} (${experiences.length}/${STARTING.experiences})`);
        }

        const carried = actor.items.filter(i =>
            Object.keys(ITEM_CATEGORIES).includes(i.getFlag(MODULE_ID, "category")));
        if (!carried.length) missingItem.push(actor.name);

        if (!monokumaFor(actor)) unwatched.push(actor.name);
    }

    const roll = (label, names, fix) => {
        lines.push("");
        if (!names.length) {
            lines.push(`✓ ${label}`);
            return;
        }
        lines.push(`✗ ${label} — ${names.length}: ${names.join(", ")}`);
        if (fix) lines.push(`   ${fix}`);
    };

    roll("Everybody has an Ultimate", missingUltimate,
        "Set it on the sheet, under the name.");
    roll(`Everybody has ${STARTING.experiences} experiences`, missingExperiences,
        "Two at +2 each, agreed at character creation.");
    roll("Everybody carries their opening item", missingItem,
        `One Tier ${STARTING.startingItemTier} item tied to their Ultimate — hand it out from Give / take items.`);
    roll("Everybody is assigned to a Despair pool", unwatched,
        "Without one, Despair from their rolls has nowhere to go. Fix it in GM Team.");

    return report("Season setup", lines, { toChat });
}

/**
 * @param {object} [options]
 * @param {boolean} [options.toChat] Whisper it as well as returning it.
 *   `false` is for callers that put the result on screen themselves — the
 *   Pre-session checks tile shows both reports in one window, and a whispered
 *   copy of each underneath it is the same answer twice.
 */
function report(title, lines, { toChat = true } = {}) {
    const text = lines.join("\n");
    console.log(`${MODULE_ID} | ${title}\n${text}`);

    if (toChat) {
        ChatMessage.create({
            content: `<h3>${title}</h3><pre style="white-space:pre-wrap;font-size:0.85em">${foundry.utils.escapeHTML(text)}</pre>`,
            whisper: [game.user.id]
        });
    }

    return text;
}
