/**
 * Danganronpa RPG - the six statistics' glyphs (E49, 1.2.105; the owner, 11.11.2026 night: "decided, in this release").
 * ---------------------------------------------------------------------------
 * Each statistic (config.mjs TRAITS: Eye, Head, Body, Leg, Hand, Shadow) wears a glyph wherever the six are listed by
 * name: in the wrench's window before its name (dh-settings.mjs, the Details tab's six fields), and on the character
 * sheet's header inside Daggerheart's mark at the left of its name (sheet-header.mjs `markTraitGlyphs`, the owner's answer of
 * 12.11.2026). The glyph does not replace the name; it is decorative (`aria-hidden`, `inert`: the name beside it is what
 * a screen reader reads); nothing stored, no field name and no value changes.
 *
 * ONE ELEMENT, BOTH THEMES. The glyph is an `<i>` with STAT_GLYPH_CLASS, the statistic's key as `data-drpg-stat` and
 * the Font Awesome class STAT_ICONS gives it. Monokuma Legacy draws that Font Awesome icon (the owner's rule: Legacy keeps
 * Font Awesome); Stained Glass masks the same element with its pixel drawing, `--drpg-pix-stat-<key>`, keyed on
 * `data-drpg-stat` by the generated glass section of styles/pixel-icons.css (tools/glyphs.json's six `stat-*` rows,
 * tests-glyphs.mjs STAT_GLYPHS). So a theme switched with the window open needs no redraw.
 *
 * THE FONT AWESOME ICONS (Foundry v14 ships Font Awesome 7 Pro - danganronpa.css's font stack; each name below is in
 * Font Awesome 6 Free as well, read in S/stages/E46/compare/fa 6.7.2, so it is in the Pro set v14 serves): eye the eye;
 * head a brain (the knowledge the statistic stands for, and FA has no head in profile in the free set); body a standing
 * person; leg shoe prints (the step, speed); hand an open hand; shadow the hidden figure in a hat and glasses. Three of
 * them are also worn by an action of the same statistic's kind under Legacy (Observe's eye, Analyze's brain, Move's shoe
 * prints): Legacy's icons are not held to the drawing rounds' one-function-one-glyph rule (option A), and Stained Glass
 * draws each statistic its own.
 */

import { TRAITS, TRAIT_BY_DH } from "./config.mjs";

/** The class every statistic's glyph wears, beside its Font Awesome class. */
export const STAT_GLYPH_CLASS = "drpg-stat-glyph";

/** Each statistic's Font Awesome class: what Monokuma Legacy draws (Stained Glass masks it with `stat-<key>`). */
export const STAT_ICONS = Object.freeze({
    eye: "fa-eye", head: "fa-brain", body: "fa-person", leg: "fa-shoe-prints", hand: "fa-hand", shadow: "fa-user-secret"
});

/** The statistic's key (config.mjs TRAITS) from Daggerheart's trait key, or null. */
export function statOfTrait(dhKey) {
    return Object.hasOwn(TRAIT_BY_DH, dhKey ?? "") ? TRAIT_BY_DH[dhKey] : null;
}

/** A new glyph element for the statistic `key`, in `doc`. */
export function statGlyph(key, doc = document) {
    const i = doc.createElement("i");
    i.className = `fa-solid ${STAT_ICONS[key]} ${STAT_GLYPH_CLASS}`;
    i.dataset.drpgStat = key;
    i.setAttribute("aria-hidden", "true");
    i.setAttribute("inert", "");
    return i;
}

/**
 * Put the statistic's glyph first in `nameEl` (the element that holds its name, or the sheet's mark that holds the glyph),
 * once: a glyph already there for this statistic is kept, one for another is replaced. Any text is left as it is. Answers
 * the glyph, or null.
 */
export function markStatName(nameEl, key) {
    if (!nameEl || !Object.hasOwn(TRAITS, key ?? "") || !STAT_ICONS[key]) return null;
    const had = [...nameEl.children].filter(el => el.classList.contains(STAT_GLYPH_CLASS));
    const kept = had.find(el => el.dataset.drpgStat === key && el === nameEl.firstElementChild && el === nameEl.firstChild);
    for (const el of had) if (el !== kept) el.remove();
    if (kept) return kept;
    const glyph = statGlyph(key, nameEl.ownerDocument ?? document);
    nameEl.prepend(glyph);
    return glyph;
}
