/**
 * Danganronpa RPG - Daggerheart's character settings window, trimmed and on the kit (E49, 1.2.105).
 * ---------------------------------------------------------------------------
 * THE WINDOW. The wrench in a character sheet's header (Daggerheart 2.6.5 templates/sheets/actors/character/
 * header.hbs:137, `data-action="openSettings"`) renders the sheet's `settingSheet`: DHCharacterSettings
 * (module/applications/sheets-configs/character-settings.mjs), an ActorSheetV2 drawn as a dialog - root classes
 * `daggerheart dh-style dialog character-settings`, `sheet` filtered out (sheets/api/actor-setting.mjs) - with two
 * tabs: Details (templates/sheets-settings/character-settings/details.hbs: the six traits, Max Hit Points, Max
 * Stress, Scars, Proficiency, Max Evasion Increase) and Experiences (experiences.hbs: each one's name, value and
 * description, New and the bin). It submits on every change (`form.submitOnChange`). The owner, 11.11.2026: "sa tam
 * statystyki nieuzywane przez modul i ogolnie sa nieruszane w obu motywach" - statistics the module does not use, and
 * neither theme touched it. Read at the tag 2.6.5 (module.json's verified version until 1.2.111), S/stages/E49/dh-src.
 *
 * WHAT THE MODULE USES OF IT (read in scripts/ on 11.11.2026 at 54493dbf, `grep` for each path; the tests' copy is
 * `SETTINGS_FIELDS` below, R3550):
 *   system.traits.<six>.value       used - config.mjs TRAITS (each of the six is a statistic: Eye instinct, Head
 *                                   knowledge, Body strength, Leg agility, Hand finesse, Shadow presence), read by
 *                                   action-menus.mjs `traitFieldHtml`, api.mjs, character.mjs (the creation spread)
 *   system.resources.hitPoints.max  used - Health: character.mjs `initCharacter` writes STARTING.hp, `resourceMax`
 *   system.resources.stress.max     used - Sanity: character.mjs `initCharacter` writes STARTING.stress, `reserveOf`
 *   system.experiences.*            used - character.mjs (the creation check, two at +2), level-up.mjs (a Level Up
 *                                   adds one), bridge-guards.mjs and config.mjs's legal roll parts
 *   system.scars                    unused as a rule - no file reads it for the game; sheet-audit.mjs holds it
 *                                   (HELD_PATH, MARK_ROOTS) only because Daggerheart lowers Hope's maximum by it
 *   system.proficiency              unused - sheet.mjs's header: the sheet's proficiency is hidden (danganronpa.css)
 *   system.evasion                  unused - no file of scripts/ names it
 * So Scars, Proficiency and Max Evasion Increase are hidden here; nothing else is.
 *
 * HIDDEN, NEVER DELETED. A hidden field stays in the form with the value Daggerheart drew (`document._source`), so a
 * submit - every change here submits the whole form - writes the value it already has back (R3552); its wrapper is
 * `hidden` and wears UNUSED_CLASS, which components.css takes out of the layout whatever display Daggerheart gives a
 * form group. Daggerheart's tooltip on Max Hit Points ("Your max HP base is set on your class...") speaks of a class
 * this game has not got: the attribute is taken off the drawn element, nothing stored.
 *
 * ON THE KIT. The root takes KIT_CLASSES (`drpg-ui`, `drpg-panel`), WINDOW_CLASS and the kit's WIDTH_CLASS, so both themes' panel rules, the
 * glass's band on its header (glass.mjs `dressWindow`) and the kit's frame reach it, and components.css's block for
 * WINDOW_CLASS states the rest - each of its rules Daggerheart's own selector with the window's class added, so it
 * wins by one class and needs no `!important` (R3553). THE WIDTH: a `.drpg-panel` dialog is held to the module's popup
 * width by `!important` rules, and under the glass that width is `fit-content`: on the stand-in in Chromium at 1366x768
 * (S/stages/E49/dh-shots, 11.11.2026) the Details tab opened 1174 px wide under the glass - six statistic fields at their
 * default 20 characters of VT323 - and 544 under Legacy. WIDTH_CLASS takes it out of those rules, as a kit window that
 * states its width, and its first render sets the width the module's prose windows open at (`--drpg-popup`, 34rem
 * times `--drpg-legacy-scale`; kitWidth caps it at the screen less 8 px a side) in place of Daggerheart's 455. Daggerheart's window is not opened by the module and is not
 * rebuilt: its parts, its listeners and its form stay as the system drew them.
 *
 * FOUND BY ITS CLASSES, as roll-dialog.mjs finds the roll window (`roll-selection`): a renamed class would not quietly
 * switch this off, and the hook is Foundry's `renderApplicationV2`, which needs no row in patches.mjs. Registered in
 * module.mjs's init before the theme's own controls (`registerChrome`), so every later listener of the same hook -
 * chrome.mjs, glass.mjs `dressWindow`, a11y.mjs, motion.mjs - sees a `.drpg-panel` on the window's first render.
 */

import { KIT_CLASSES, WIDTH_CLASS, kitWidth } from "./ui-kit.mjs";
import { error } from "./utils.mjs";
import { markStatName, statOfTrait } from "./stat-glyphs.mjs";

/** The window's own class beside KIT_CLASSES: what components.css's block names it by. */
export const WINDOW_CLASS = "drpg-window-dh-settings";

/** The class on a hidden field's wrapper (with `hidden`). */
const UNUSED_CLASS = "drpg-dh-unused";

/** Every field the Details and Experiences tabs draw (Daggerheart 2.6.5), with where the module reads it or "unused". */
export const SETTINGS_FIELDS = Object.freeze([
    ...["instinct", "knowledge", "strength", "agility", "finesse", "presence"].map(key => Object.freeze({
        name: `system.traits.${key}.value`, used: "config.mjs TRAITS; action-menus.mjs traitFieldHtml; character.mjs" })),
    Object.freeze({ name: "system.resources.hitPoints.max", used: "character.mjs initCharacter, resourceMax (Health)" }),
    Object.freeze({ name: "system.resources.stress.max", used: "character.mjs initCharacter, reserveOf (Sanity)" }),
    Object.freeze({ name: "system.scars", used: null }),
    Object.freeze({ name: "system.proficiency", used: null }),
    Object.freeze({ name: "system.evasion", used: null }),
    Object.freeze({ name: "system.experiences", used: "character.mjs; level-up.mjs; bridge-guards.mjs; config.mjs" })
]);

/** The names of the fields hidden here: SETTINGS_FIELDS's unused ones. */
export const UNUSED_FIELDS = Object.freeze(SETTINGS_FIELDS.filter(field => !field.used).map(field => field.name));

/** The window's width: `--drpg-popup`'s 34rem, read as WINDOW_WIDTHS's rows are (ui-kit.mjs `kitWidth`). */
const WINDOW_REM = 34;

export function settingsWidth() {
    const root = typeof getComputedStyle === "function" && globalThis.document?.documentElement ? getComputedStyle(document.documentElement) : null;
    const rem = parseFloat(root?.fontSize) || 16;
    const legacy = parseFloat(root?.getPropertyValue("--drpg-legacy-scale")) || 1;
    return kitWidth(Math.round(WINDOW_REM * rem * legacy));
}

/** Daggerheart's character settings window: its classes and an actor of type character behind it. */
export function isCharacterSettings(app, element) {
    const el = element instanceof HTMLElement ? element : app?.element;
    if (!el?.classList?.contains("character-settings") || !el.classList.contains("daggerheart")) return false;
    const actor = app?.document ?? app?.actor;
    return actor?.documentName === "Actor" && actor.type === "character";
}

/**
 * The wrapper a field stands in: Foundry's `formGroup` draws `div.form-group > .form-fields > input`, and Max Evasion
 * Increase stands in a `span` of its own (the tooltip's) inside the grid, which is the grid's cell and so the one hidden.
 */
function wrapperOf(input) {
    const group = input.closest(".form-group") ?? input;
    const parent = group.parentElement;
    return parent?.localName === "span" && parent.children.length === 1 ? parent : group;
}

/**
 * Dress a drawn window: the kit's classes on the root, the unused fields' wrappers hidden, Health's class tooltip off,
 * the words the module's (`wordCharacterSettings`), each statistic's glyph before its name (`markStatistics`).
 * Idempotent - Daggerheart draws the window again after every submit. Answers the names it hid.
 */
export function dressCharacterSettings(element) {
    if (!element?.classList) return [];
    element.classList.add(...KIT_CLASSES, WINDOW_CLASS, WIDTH_CLASS);
    const hidden = [];
    for (const name of UNUSED_FIELDS) {
        const input = element.querySelector(`[name="${name}"]`);
        if (!input) continue;
        const wrapper = wrapperOf(input);
        wrapper.hidden = true;
        wrapper.classList.add(UNUSED_CLASS);
        hidden.push(name);
    }
    const health = element.querySelector('[name="system.resources.hitPoints.max"]');
    const cell = health ? wrapperOf(health) : null;
    cell?.removeAttribute("data-tooltip-text");
    wordCharacterSettings(element);
    nameFormGroups(element);
    markStatistics(element);
    return hidden;
}

/*
 * THE WINDOW'S WORDS ARE THE MODULE'S (E49, the owner's "Tak" of 11.11.2026 to the comparison: Polish labels for this
 * window alone). Daggerheart has no Polish file, so a Polish client read Settings, Details, Basics, Max Health and New
 * Experience in English; its keys (`DAGGERHEART.GENERAL.Tabs.details`, `.basics`, `.maxWithThing` ...) are shared with
 * its other windows, so they are not overridden in lang/*.json - the drawn text here is replaced from the module's own
 * `DRPG.DhSettings.*`, in English and Polish, after every render (Foundry writes the title again on each). The Polish
 * terms are the module's: Health and Sanity stay English with "(maks.)" as `DRPG.Players.stressMax` has it,
 * "Doświadczenia" as the player handbook's table, "Nowe doświadczenie" as the Level Up's. The groups' second heading
 * says what is left in it: Basics held five fields, it holds Health and Sanity. The statistics' own names are the
 * module's already (lang's `DAGGERHEART.CONFIG.Traits`). Nothing stored changes.
 */
/** Each worded part, by a selector inside the window or by the field whose form group's label it is, and its key under
 * DRPG.DhSettings. */
export const WINDOW_WORDS = Object.freeze([
    Object.freeze({ selector: ":scope > .window-header .window-title", key: "title" }),
    Object.freeze({ selector: '.tab-navigation [data-tab="details"] > span', key: "details" }),
    Object.freeze({ selector: '.tab-navigation [data-tab="experiences"] > span', key: "experiences" }),
    Object.freeze({ selector: ".tab.details fieldset.drpg-dh-statistics > legend", key: "statistics" }),
    Object.freeze({ selector: ".tab.details fieldset.drpg-dh-reserves > legend", key: "reserves" }),
    Object.freeze({ field: "system.resources.hitPoints.max", key: "maxHealth" }),
    Object.freeze({ field: "system.resources.stress.max", key: "maxSanity" }),
    Object.freeze({ selector: ".tab.experiences .add-experience-btn > span", key: "newExperience" }),
    Object.freeze({ selector: ".tab.experiences fieldset > legend", key: "experiences" })
]);

function wordCharacterSettings(element) {
    const word = key => game.i18n.localize(`DRPG.DhSettings.${key}`);
    // Each group named by what it holds, so a selector finds it without `:has`.
    element.querySelector(".tab.details .traits-inner-container")?.closest("fieldset")?.classList.add("drpg-dh-statistics");
    element.querySelector(".tab.details .two-columns")?.closest("fieldset")?.classList.add("drpg-dh-reserves");
    for (const { selector, field, key } of WINDOW_WORDS) {
        const el = field ? element.querySelector(`[name="${field}"]`)?.closest(".form-group")?.querySelector(":scope > label") : element.querySelector(selector);
        if (el) el.textContent = word(key);
    }
    for (const item of element.querySelectorAll(".tab.experiences .experience-item")) {
        const bin = item.querySelector('a[data-action="removeExperience"]');
        const label = word(bin?.classList.contains("disabled") ? "coreExperience" : "delete");
        bin?.parentElement?.setAttribute("data-tooltip", label);
        bin?.setAttribute("aria-label", label);
        for (const [cls, key] of [["input.name", "name"], ["input.modifier", "value"], ["textarea", "description"]]) item.querySelector(cls)?.setAttribute("aria-label", word(key));
    }
}

/*
 * EACH FIELD NAMED BY ITS LABEL'S WORDS (13.11.2026, R3920). Foundry's `formGroup` draws `label + .form-fields > input`
 * and ties the two by `for` only where the field has an id; Daggerheart's template gives it none, so a screen reader read
 * Max Health, Max Sanity and the three hidden fields with no name - and once the window wears `drpg-panel`, a11y.mjs's
 * sweep reported each (tier 2's "every control in the module's own chrome has a name", whenever R3551 drew the window
 * first). The hidden three are named too: the sweep reads every field in the window, shown or not. After the wording, so
 * the name is the module's word where WINDOW_WORDS has one. A field with a name of its own keeps it.
 */
function nameFormGroups(element) {
    for (const group of element.querySelectorAll(".form-group")) {
        const words = group.querySelector(":scope > label")?.textContent?.replace(/\s+/g, " ").trim();
        if (!words) continue;
        for (const input of group.querySelectorAll("input, select, textarea")) {
            if (!input.labels?.length && !input.getAttribute("aria-label")?.trim()) input.setAttribute("aria-label", words);
        }
    }
}

/*
 * EACH STATISTIC'S GLYPH BEFORE ITS NAME (E49, the owner's ask of 11.11.2026 night; stat-glyphs.mjs). Details draws a
 * `.trait-container` per trait - its name in a span, its field after - and the glyph goes first in that span, so it stands
 * on the name's line and the name's text is left as Daggerheart drew it. The statistic is read off the field's name
 * (`system.traits.<Daggerheart's key>.value`), not off the label, which is a translation.
 */
function markStatistics(element) {
    for (const input of element.querySelectorAll('.tab.details .trait-container input[name^="system.traits."]')) {
        const key = statOfTrait(/^system\.traits\.([a-z]+)\.value$/.exec(input.name)?.[1]);
        const nameEl = input.closest(".trait-container")?.querySelector(":scope > span");
        markStatName(nameEl, key);
        /* NAMED BY ITS NAME (13.11.2026, R3920). The span stands beside the field, not as its label, so the field had no
           name a screen reader reads - a11y.mjs's sweep reported `system.traits.instinct.value` once the window is dressed
           as the module's. The name's words as drawn (the glyph is aria-hidden and has none). */
        const words = nameEl?.textContent?.replace(/\s+/g, " ").trim();
        if (words) input.setAttribute("aria-label", words);
    }
}

export function registerDhSettings() {
    Hooks.on("renderApplicationV2", (app, element, _context, options) => {
        try {
            if (!isCharacterSettings(app, element)) return;
            dressCharacterSettings(element instanceof HTMLElement ? element : app.element);
            if (options?.isFirstRender) app.setPosition?.({ width: settingsWidth() });
        } catch (err) {
            error("Could not dress Daggerheart's character settings window", err);
        }
    });
}
