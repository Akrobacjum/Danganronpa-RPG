/**
 * Danganronpa RPG - an action window's rows hold their place (E49 A8.4, 11.11.2026); so do Item tables' groups (A4).
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

/*
 * ITEM TABLES' GROUPS (E49 A4, 11.11.2026; the owner's [14] (2) and [16] 3, and the rule of 10.11 above). A room pool's
 * category picker (tables-editor.mjs `tableItemsHtml`) shows one group of its entries, or every group ("all"); the
 * groups' box keeps the floor of its height with every group shown, so a pick of a short group leaves the window the
 * size it was (style-sweep `--tables`: one size at every pick, and a change read with the floor taken off). The height is
 * read with every group drawn, then the others hidden; with no layout (the headless harness) no floor is set. Answers the
 * floor in px, or null. Pure DOM, as `holdRowLines`: the sweep runs this very function in Chromium on probe 08's capture.
 */
export function showRoomGroup(box, kind = "all") {
    if (!box?.querySelectorAll) return null;
    const groups = [...box.querySelectorAll(":scope > .drpg-room-group")];
    for (const group of groups) group.hidden = false;
    box.style.minHeight = "";
    const full = Math.ceil(box.getBoundingClientRect().height);
    for (const group of groups) group.hidden = kind !== "all" && group.dataset.kind !== kind;
    if (!full) return null;
    box.style.minHeight = `${full}px`;
    return full;
}
