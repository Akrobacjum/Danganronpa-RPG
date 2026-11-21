/**
 * Danganronpa RPG - Foundry's token HUD, trimmed to what this game uses and dressed as the module.
 * ---------------------------------------------------------------------------
 * THE OWNER'S ASK (21.11.2026, 1.2.120 line H, with a shot of the HUD on a token in the dark theme): "Niepotrzebne jest:
 * combat, target, movement action, assign status, liczby na gorze i na dole i elevation. Na dodatek sa tam dalej
 * oryginalne ikony foundry i ogolnie nie pasuje to do reszty modulu."
 *
 * WHAT THE HUD IS ON THE TABLE. Daggerheart's `DHTokenHUD` (module/applications/hud/tokenHUD.mjs) extends v14's
 * `foundry.applications.hud.TokenHUD` and replaces its one part with templates/hud/tokenHUD.hbs: read at git tag 2.12.8
 * on 21.11.2026. Three columns: left - elevation (an input), the floor's palette (`canChangeLevel`, v14 Levels), bring to
 * front or back, a companion's button (`hasCompanion`), lock (`isGM`), the token's settings (`canConfigure`); middle - the
 * two bar inputs; right - visibility (`isGM`), the status palette, a party's button (a party actor), the movement
 * palette, target, combat (`canToggleCombat`).
 *
 * WHAT GOES, FOR EVERYBODY (`REMOVED`), and why the module needs none of it from the HUD:
 *   - elevation: a GM sets a token's height in its settings, which stay; the module reads `elevation` (a passage in a
 *     wall, movement.mjs `ownElevation`) and judges a player's change of it as any move. A player typing a height here
 *     was a move by number, not a road the rules know.
 *   - the two bar inputs: a student's Health and Sanity were off for everybody since E24 C1b (states.mjs `reserveBar`,
 *     `editable: false`) and any other bar off for a player since E29 C7; the bars still draw on the token. The
 *     resources are typed on the sheet.
 *   - the status palette: the module puts Breakdown, Wounded and the dead status on itself (states.mjs `syncStates`,
 *     death.mjs). What it costs a GM - Daggerheart's own conditions by hand from the HUD - was asked of the coordinator
 *     with this default (21.11.2026). The sheet is no road to them: its Effects tab is the module's Rules tab on every
 *     character sheet (sheet-actions.mjs `replaceEffectsTab`), and Daggerheart's effects display is hidden (the audit
 *     of 1.2.120, H-2). The road left is the console, `actor.toggleStatusEffect(id)` (Foundry's), which the GM
 *     handbook's section on the HUD names. A GM-only road on the sheet was proposed (1.2.122 line UI) and the owner
 *     declined it, 21.11.2026 ("Nie").
 *   - the movement palette: v14's movement actions (walk, fly, ...); the module's moves are judged by rooms, never by it.
 *   - target: Daggerheart's rolls against a target read the user's targets, which the canvas still sets with the T key
 *     over a token; the module's own rolls read none (private-rolls.mjs clears a roll's `system.targets`). Not a double
 *     right-click: as Foundry's Token#_onClickRight2 is remembered (v11-v13; no v14 source here), an owner with the
 *     TOKEN_CONFIGURE permission - every GM, and a Trusted player by Foundry's default - gets the token's settings from
 *     it, and only others target (the audit of 1.2.120, H-3).
 *   - combat: no rule of the module runs on Foundry's combat; the trial and the Eclipse are its own.
 *
 * A PLAYER HAS NO TOKEN HUD (the owner, 21.11.2026, on this line's first answer, which kept a player bring to front and
 * the token's settings: "gracz niech nie widzi ustawien tokena wcale", then "Chodzi o cale menu. Niech gracz nie ma menu
 * tokena."). On a browser whose user is not a GM (an Assistant GM is one) the HUD is emptied and marked
 * `drpg-token-hud-none`, which the stylesheet does not draw, so a right-click on a token opens nothing. Nothing a player
 * did there is a road the module needs: a floor is changed by the stairs (a region's `changeLevel`, rooms.mjs), and
 * movement.mjs sends back an unlawful floor change however it was written. The HUD is emptied after Foundry drew it, not
 * kept from opening: v14's road to it (the token's right-click) is not read here (no v14 source), LIVE-H120-01.
 *
 * NOR ITS SETTINGS, BY ANY ROAD (H-3; the owner's "gracz niech nie widzi ustawien tokena wcale"). A Trusted player's
 * double right-click on their own token, and a sheet's prototype-token control where a player is offered one, open
 * Foundry's token settings past the HUD; on a browser whose user is not a GM such a window is hidden as it is drawn and
 * closed (`refuseTokenConfig`, at the render hooks of v14's TokenApplication and its two kinds), and the player told
 * once a minute that a token's settings are the GM's. The owner, 21.11.2026: "Gm ustawia - graczom zabieramy". Whether
 * v14 still opens it on those roads is not read: LIVE.
 *
 * WHAT STAYS, FOR A GM: bring to front, the floor's palette, lock, the token's settings and visibility, and Daggerheart's
 * companion or party button where Daggerheart draws one, with Daggerheart's picture and words.
 *
 * HOW. At `renderTokenHUD` (hud.mjs `registerHud`), which ApplicationV2 calls after `_onRender`, so Foundry's and
 * Daggerheart's controls are bound before anything is taken out: the controls are removed from the HUD's element, not
 * hidden, so neither a keyboard nor a screen reader reaches them, and the root is marked `drpg-token-hud`, the one hook
 * danganronpa.css and stained-glass.css dress it by (every rule under `#token-hud.drpg-token-hud`, R8053). The icons stay
 * Foundry's `<i>` elements, masked to the module's glyphs by their Font Awesome class, so an icon Foundry turns (an eye
 * to a slashed eye) turns its glyph with it.
 */

import { error } from "./utils.mjs";

/** The root's class, the stylesheets' one hook. */
export const TOKEN_HUD_CLASS = "drpg-token-hud";

/** Removed for everybody: the selectors of tokenHUD.hbs (2.12.8) - a control and, for a palette, the palette it opens. */
export const REMOVED = Object.freeze([
    ".attribute.elevation",
    ".attribute.bar1",
    ".attribute.bar2",
    '[data-action="togglePalette"][data-palette="effects"]',
    '.palette[data-palette="effects"]',
    '[data-action="togglePalette"][data-palette="movementActions"]',
    '.palette[data-palette="movementActions"]',
    '[data-action="target"]',
    '[data-action="combat"]'
]);

/** A kept control whose focus ring the HUD's rules draw (under the glass, inside its hexagon), which high contrast's
 *  page-wide ring passes by (the audit of 1.2.120, H-7). */
export const RING_INSIDE_CLASS = "drpg-ring-inside";

/** A player's HUD: emptied and marked with this class, which the stylesheet does not draw. */
export const NO_HUD_CLASS = "drpg-token-hud-none";

/** The words of each control the module labels: a `DRPG.TokenHud` key, or [key when `on`, key when not] with `on` the
 *  state Foundry shows on the button (visibility: hidden, drawn as fa-eye-slash; lock: locked, drawn as fa-lock), so the
 *  words name what a click does. */
const LABELS = Object.freeze({
    visibility: { on: i => i?.classList.contains("fa-eye-slash"), keys: ["show", "hide"] },
    locked: { on: i => i?.classList.contains("fa-lock"), keys: ["unlock", "lock"] },
    sort: { keys: ["sort"] },
    config: { keys: ["config"] },
    togglePalette: { keys: ["level"] }
});

/** Put a kept control's words on it, as its aria-label and its tooltip (Foundry's TooltipManager reads `data-tooltip`). */
function labelControl(button) {
    const row = LABELS[button?.dataset?.action];
    if (!row) return;
    const icon = button.querySelector("i");
    const key = row.on ? row.keys[row.on(icon) ? 0 : 1] : row.keys[0];
    const text = game.i18n.localize(`DRPG.TokenHud.${key}`);
    if (button.getAttribute("aria-label") !== text) button.setAttribute("aria-label", text);
    if (button.dataset.tooltip !== text) button.dataset.tooltip = text;
}

/** Turn visibility's and lock's words when Foundry turns their icon or state in place, should it do so without drawing
 *  the HUD again ("Zawsze odswiezamy okna od razu przy zmianie"). The observer dies with the button. */
function followState(button) {
    if (!LABELS[button.dataset.action]?.on || typeof MutationObserver !== "function") return;
    const watch = new MutationObserver(() => labelControl(button));
    watch.observe(button, { attributes: true, attributeFilter: ["class"], subtree: true });
}

/** The `renderTokenHUD` listener: Foundry calls it with (app, element, context, options), so the user is this browser's. */
export function trimTokenHud(app, element) {
    trimHudFor(element, game.user);
}

/**
 * Trim a drawn token HUD to the controls kept for `user` and label them, or, for a user who is not a GM, empty it. `element` is the HUD's root (ApplicationV2's
 * `app.element`, `#token-hud`); a jQuery-shaped one is unwrapped. Exported for R8050 and R8051.
 */
export function trimHudFor(element, user) {
    try {
        const root = element?.querySelectorAll ? element : element?.[0];
        if (!root?.querySelectorAll) return;
        root.classList.add(TOKEN_HUD_CLASS);
        // A GM's HUD is drawn, whatever the root held before (H-8): ApplicationV2 keeps the root between renders, and
        // one marked for a player before a live promotion to a GM's role stayed undrawn until a reload.
        if (user?.isGM) {
            root.classList.remove(NO_HUD_CLASS);
            root.removeAttribute("aria-hidden");
        }
        if (!user?.isGM) {
            root.replaceChildren();
            root.classList.add(NO_HUD_CLASS);
            root.setAttribute("aria-hidden", "true");
            return;
        }
        for (const node of root.querySelectorAll(REMOVED.join(", "))) node.remove();
        for (const button of root.querySelectorAll("button.control-icon")) {
            // Its focus ring is the HUD's own (danganronpa.css, stained-glass.css), not high contrast's page-wide one (H-7).
            button.classList.add(RING_INSIDE_CLASS);
            labelControl(button);
            followState(button);
        }
    } catch (err) {
        error("Could not trim the token HUD", err);
    }
}

/* The token settings windows being closed on this browser now, and when the player was last told (`refuseTokenConfig`).
   A window leaves the set when its close settles: Foundry keeps one sheet object per token document (TokenDocument#sheet,
   as remembered for v13; v14 not read), so the same window drawn again by a second double right-click is refused again.
   The set held every window ever refused until the auditor's check of 1.2.122 (r122-E-1), and a reopened one stood. */
const refusedConfigs = new WeakSet();
let configToldAt = -Infinity;

/**
 * A token's settings window, drawn on a browser whose user is not a GM: hidden at once and closed (H-3). Hooked at
 * `renderTokenApplication`, `renderTokenConfig` and `renderPrototypeTokenConfig` (hud.mjs `registerHud`); a window
 * reached by two of them in one render is closed once, and drawn again later it is closed again. Answers whether it
 * closed one (R8421 reads it).
 */
export function refuseTokenConfig(app, element, user = game.user) {
    try {
        if (user?.isGM || !app || refusedConfigs.has(app)) return false;
        refusedConfigs.add(app);
        const root = element?.style ? element : element?.[0] ?? app.element;
        if (root?.style) root.style.display = "none";
        Promise.resolve(app.close?.()).catch(err => error("Could not close a token's settings", err))
            .finally(() => refusedConfigs.delete(app));
        const now = Date.now();
        if (now - configToldAt > 60_000) {
            configToldAt = now;
            ui.notifications?.info?.(game.i18n.localize("DRPG.TokenHud.configGm"));
        }
        return true;
    } catch (err) {
        error("Could not close a token's settings", err);
        return false;
    }
}
