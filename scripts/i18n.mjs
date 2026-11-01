/**
 * Danganronpa RPG - the module's own language.
 * ---------------------------------------------------------------------------
 * A "Language" setting of this module's own, per browser, English by default,
 * separate from Foundry's core language: a Polish table plays on an English
 * Foundry as often as not, and the one thing they want in Polish is this
 * layer - the sheet, the panel, the cards - not the whole of Foundry.
 *
 * HOW IT LOADS. Foundry loads a module's language files by the CORE language
 * (module.json `languages`), so a file listed there would follow Foundry's
 * setting and not ours. Instead the file is fetched by this module at `init`
 * and merged over `game.i18n.translations` at `i18nInit`, the hook Foundry
 * fires the moment its own translations are in place. The fetch is started at
 * `init` so that it is normally finished by then; if it is not, the merge
 * happens when it lands, which is still long before anything of ours renders.
 * The one thing that can be missed by a late merge is a label the SYSTEM
 * builds from our DAGGERHEART overrides during its own `i18nInit` - so the
 * fetch goes first, before any other init work.
 *
 * WHAT IS TRANSLATED. Everything in lang/en.json, and the sentences config.mjs
 * carries inline (`label`, `hint`, `effect`...): those are swapped in place at
 * load through `localizeConfig`, so every reader of `ACTIONS.search.label`
 * sees the translation without knowing one exists. See i18n-config.mjs for
 * exactly which fields, and tools/config-prose.mjs for the key list.
 *
 * WHAT IS NOT. The glossary: Truth Bullet, Remnant, Blackened, Class Trial,
 * Daily Life, Despair, Hope, Sanity, Health, Monokuma, Monocub, Mastermind,
 * Eclipse, Motive, the Calls, the actions, the statistics. They are the game's
 * proper names in every language and the language files keep them in English.
 *
 * PLURALS. `plural()` in utils.mjs picks a form with `Intl.PluralRules` for
 * THIS language, so a Polish file carries `one` / `few` / `many` / `other`
 * where the English one carries `one` / `other`.
 *
 * ONE ROAD (E66 C1, 01.11.2026). The languages, the setting's reader and the
 * language the page was built in live in settings.mjs (`LANGUAGES`,
 * `moduleLanguage`, `pageLanguage`), which this file re-exports and nothing
 * more; utils.mjs's `plural`, `listOf`, `localeFormat` and `worldLocalize` read
 * the page's, never the live setting. The world's language for documents
 * (`documentLanguage`, D196) is written here, once.
 */

import { MODULE_ID } from "./config.mjs";
import * as CONFIG_TABLES_SOURCE from "./config.mjs";
import { walkConfigProse } from "./i18n-config.mjs";
import { LANGUAGES, SETTINGS, moduleLanguage, pageLanguage, setPageLanguage, documentLanguage, setSetting } from "./settings.mjs";
import { log, error, isPrimaryGm } from "./utils.mjs";

/* The leaf's own objects, re-exported (E66 C1; E66-02): the Look window, the requirements window, the diagnostics and
   the handbooks import them from here as before. Why the page's language is kept apart from the setting is written
   beside `pageLanguage` in settings.mjs. */
export { LANGUAGES, moduleLanguage, pageLanguage };

let pending = null;
let applied = false;

/** Start fetching the file. Called first thing at `init`; harmless to call twice. */
export function prefetchLanguage() {
    const lang = moduleLanguage();
    setPageLanguage(lang);
    if (lang === "en" || pending) return pending;
    pending = fetchLanguageFile(lang);
    return pending;
}

/**
 * The language file's fetch: its parsed JSON, or null with the page back in English (E66 fix r2, 01.11.2026; review
 * correctness m3). `prefetchLanguage` sets the page's language before the fetch; when the file did not load, the
 * module said "the module stays in English" and `pageLanguage()` stayed "pl", so `listOf`, `localeFormat` and
 * `markLanguage` wrote Polish lists, dates and `lang` into English text. `fetchFile` and `report` are handed in by
 * R1166.
 */
export function fetchLanguageFile(lang, { fetchFile = path => fetch(path), report = error } = {}) {
    const path = `modules/${MODULE_ID}/lang/${lang}.json`;
    return fetchFile(path)
        .then(response => {
            if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
            return response.json();
        })
        .catch(err => {
            setPageLanguage("en");
            report(`Could not load the ${lang} language file; the module stays in English`, err);
            return null;
        });
}

/**
 * Merge the file over Foundry's translations and localize config.mjs.
 *
 * Idempotent: the merge writes the same values twice and `localizeConfig`
 * reads the English it already replaced as the same key.
 */
export async function applyModuleLanguage() {
    if (moduleLanguage() === "en") return false;
    const json = await (pending ?? prefetchLanguage());
    if (!json) return false;
    try {
        foundry.utils.mergeObject(game.i18n.translations, foundry.utils.expandObject(json),
            { inplace: true, insertKeys: true, insertValues: true, overwrite: true, recursive: true });
        localizeConfig();
        if (!applied) log(`Language: ${moduleLanguage()}.`);
        applied = true;
        return true;
    } catch (err) {
        error("Could not apply the language file", err);
        return false;
    }
}

/**
 * Swap config.mjs's inline sentences for the language file's, in place.
 *
 * Only where the file carries the key: an untranslated field keeps its
 * English, which is the right fallback for a half-finished file.
 */
export function localizeConfig() {
    let swapped = 0;
    walkConfigProse(CONFIG_TABLES_SOURCE, (key, value, set) => {
        if (!game.i18n.has(key)) return;
        const next = game.i18n.localize(key);
        if (next && next !== value && next !== key) { set(next); swapped += 1; }
    });
    return swapped;
}

/**
 * Called from `init`, in this order: the fetch first, the merge as soon as
 * Foundry's own translations exist. `Hooks.once("i18nInit")` is registered
 * from `init`, which is early enough - `i18nInit` fires after every `init`.
 */
export function registerLanguage() {
    prefetchLanguage();
    Hooks.once("i18nInit", () => { applyModuleLanguage().catch(err => error("Language", err)); });
    Hooks.once("ready", () => { seedDocumentLanguage().catch(err => error("Could not record the documents' language", err)); });
}

/**
 * THE DOCUMENTS' LANGUAGE AT THE FIRST START (D196, decision 38 = D34 option 1: "domyślnie język primary GM-a przy
 * pierwszym starcie"; E66 C1, E66-09). On the primary GM's browser, at ready, while the world setting is empty: that
 * page's language, written once. A weak write - only into an empty setting and only by the primary - so a second GM
 * who joins in another language does not make theirs the world's, and a GM who changes it later keeps the change.
 * Answers whether it wrote.
 */
export async function seedDocumentLanguage() {
    if (!game.user?.isGM || !isPrimaryGm() || documentLanguage()) return false;
    await setSetting(SETTINGS.documentLanguage, pageLanguage());
    return true;
}

/**
 * Reload after the setting changes. Everything on screen was built with the
 * previous language, and a live re-render of forty windows is a worse
 * experience than one reload - which is also what Foundry does for its own.
 */
export async function confirmLanguageReload() {
    try {
        const SettingsConfig = foundry.applications?.settings?.SettingsConfig ?? globalThis.SettingsConfig;
        if (SettingsConfig?.reloadConfirm) return SettingsConfig.reloadConfirm({ world: false });
    } catch { /* fall through */ }
    return foundry.utils.debouncedReload?.();
}
