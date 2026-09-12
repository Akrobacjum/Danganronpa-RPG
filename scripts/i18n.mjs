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
 */

import { MODULE_ID } from "./config.mjs";
import * as CONFIG_TABLES_SOURCE from "./config.mjs";
import { walkConfigProse } from "./i18n-config.mjs";
import { moduleLanguage } from "./settings.mjs";
import { log, error } from "./utils.mjs";

/** The languages the module ships. The setting's own choices live in settings.mjs. */
export const LANGUAGES = { en: "English", pl: "Polski" };

export { moduleLanguage };

let pending = null;
let applied = false;

/** Start fetching the file. Called first thing at `init`; harmless to call twice. */
export function prefetchLanguage() {
    const lang = moduleLanguage();
    if (lang === "en" || pending) return pending;
    const path = `modules/${MODULE_ID}/lang/${lang}.json`;
    pending = fetch(path)
        .then(response => {
            if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
            return response.json();
        })
        .catch(err => {
            error(`Could not load the ${lang} language file; the module stays in English`, err);
            return null;
        });
    return pending;
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
