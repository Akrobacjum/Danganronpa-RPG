/**
 * Danganronpa RPG - an action window's rows hold their place (E49 A8.4, 11.11.2026).
 * ---------------------------------------------------------------------------
 * THE RULE OF 10.11 (the owner: "no state may add, remove or shift a control; states change look, never layout").
 * An action window shows a row's second line on the picked row alone (E68 C12, danganronpa.css `.drpg-variant-columns
 * .drpg-choice ... small { display: none }`), so each pick moved the window by the difference of two lines: Observe
 * 591.7-616.9 px under the glass at 1366x768, Search 702.4-727.5, Analyze 447-459.8 under Legacy (style-sweep
 * `--details --every-pick`, A8.3's tree). Two ways were measured at A8.4:
 *   - every row's line kept in its place, unlit (`visibility`): the window one size, but every line's height added -
 *     Observe 752 px and its body scrolling 16 px under the glass at 1366x768, Search 102 px: the fit rule broken;
 *   - this: the list given a floor (`min-height`) of its height with the tallest row's line shown in place of the
 *     picked one's - the window as tall at every pick as at today's tallest, and the line still under its own row.
 * The heights are read in the window as drawn, with every line drawn for a moment (`MEASURING`, the stylesheet's A8
 * block: drawn but not seen), then the class taken off; with no layout (the headless harness) nothing is set. Pure
 * DOM, no imports, so style-sweep `--details` runs this very function in Chromium on the captured windows.
 */

export const MEASURING = "drpg-lines-measured";

/** The list's floor in px for `root` (a drawn action window), set on the list; null where nothing could be read. */
export function holdRowLines(root) {
    const list = root?.querySelector?.(".drpg-variant-ask .drpg-choice-list");
    if (!list) return null;
    list.style.minHeight = "";
    const base = list.getBoundingClientRect().height;
    if (!base) return null;
    const lines = [...list.querySelectorAll(".drpg-choice:not(.unavailable) .drpg-choice-text small")];
    const shownNow = lines.filter(line => line.getBoundingClientRect().height > 0);
    const now = Math.max(0, ...shownNow.map(line => line.getBoundingClientRect().height));
    list.classList.add(MEASURING);
    const tallest = Math.max(0, ...lines.map(line => line.getBoundingClientRect().height));
    list.classList.remove(MEASURING);
    const floor = Math.ceil(base - now + tallest);
    list.style.minHeight = `${floor}px`;
    return floor;
}
