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
 *     with this default (21.11.2026); an effect can still be added on the sheet.
 *   - the movement palette: v14's movement actions (walk, fly, ...); the module's moves are judged by rooms, never by it.
 *   - target: Daggerheart's attacks read the user's targets, which the canvas still sets (T, or a double right-click);
 *     the module's own rolls read none (private-rolls.mjs clears a roll's `system.targets`).
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
        if (!user?.isGM) {
            root.replaceChildren();
            root.classList.add(NO_HUD_CLASS);
            root.setAttribute("aria-hidden", "true");
            return;
        }
        for (const node of root.querySelectorAll(REMOVED.join(", "))) node.remove();
        for (const button of root.querySelectorAll("button.control-icon")) {
            labelControl(button);
            followState(button);
        }
    } catch (err) {
        error("Could not trim the token HUD", err);
    }
}
