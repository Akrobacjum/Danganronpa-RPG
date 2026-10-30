/**
 * Danganronpa RPG - the modules this one asks for.
 * ---------------------------------------------------------------------------
 * THREE ARE NOT OPTIONAL (amendment d, the owner's answer of 09.10.2026; E13
 * C10). The dice everyone watches are the module's own idea of a roll, the
 * academy maps are drawn isometric, and the rooms are voice rooms, so a world
 * without Dice So Nice, Isometric Perspective or LiveKit stops, and says which.
 * From 17.09 (M-1) through 1.2.73 the last two were only recommended, with a
 * window the GM could silence; the owner made them required, as Dice So Nice
 * is, and that window, its setting and its texts went with it. Required means
 * installed and switched on, nothing more: no LiveKit server is asked whether
 * it answers and nothing checks that voice is on (the owner's d2).
 *
 * For what is required the layer refuses to start, and says which ones and
 * what to do about it.
 * It does NOT install anything, and deliberately: what is installed on a server
 * is the person's decision, and a module that reaches for the internet on
 * someone's behalf is a different kind of thing from a module that says what it
 * needs (Dawid, 26.08).
 *
 * THE LIST LIVES IN THE MANIFEST, not here. `relationships.requires` in
 * module.json is where Foundry itself reads it - it is what makes the module
 * browser offer to install them and what the Forge shows beside the entry - so
 * a second copy in this file would be a second thing to keep in step, and the
 * one people edit would be the wrong one. This reads the manifest back.
 * The WORDS the window says about each one are the language files' since E20 C5
 * (`DRPG.Requirements.reason.<id>`; S01-45): the manifest's English `reason` is
 * Foundry's to show in its module browser, and here only the fallback for a
 * module the files do not name.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { LANGUAGES } from "./i18n.mjs";
import { error, esc} from "./utils.mjs";

/** Every module the manifest marks as required, whatever their state. */
function required() {
    const rel = game.modules.get(MODULE_ID)?.relationships?.requires;
    if (!rel) return [];
    // A Set in current Foundry, an array in older ones. Both spread.
    return [...rel].filter(entry => (entry?.type ?? "module") === "module" && entry?.id);
}

/**
 * The ones that are not there, or are there and switched off.
 *
 * The two are told apart because the fix is different - one is a download and
 * one is a checkbox - and a message that says "missing" about a module sitting
 * disabled in the list sends the reader looking in the wrong place.
 *
 * The module map is an argument so R442 can ask about a world this one is not -
 * a companion switched off, one never installed - without touching the map
 * every other part of the module reads. The list of what is required still
 * comes from this world's own manifest.
 *
 * @returns {Array<{id: string, title: string, state: "absent"|"disabled", reason: string}>}
 */
export function missingRequirements(modules = game.modules) {
    return required().reduce((out, entry) => {
        const installed = modules.get(entry.id);
        if (installed?.active) return out;
        out.push({
            id: entry.id,
            title: installed?.title ?? entry.id,
            state: installed ? "disabled" : "absent",
            reason: entry.reason ?? ""
        });
        return out;
    }, []);
}

export function requirementsMet(modules = game.modules) {
    try {
        return missingRequirements(modules).length === 0;
    } catch (err) {
        // A check that cannot run must not be the thing that stops the module:
        // that would turn a bad read of the manifest into a dead world.
        error("Could not check the required modules; carrying on without the check.", err);
        return true;
    }
}

/**
 * Say what is missing, once the interface exists to say it in.
 *
 * The GM gets a window, because the GM is the only person who can fix it and a
 * notification is dismissible by accident. Everyone else gets a notification
 * that does not time out - they cannot act on it, but a player whose sheet has
 * no actions on it is owed the reason.
 */
export async function announceMissingRequirements() {
    const missing = missingRequirements();
    if (!missing.length) return;

    const names = missing.map(m => m.title).join(", ");
    error(`Not starting: required modules unavailable - ${
        missing.map(m => `${m.id} (${m.state})`).join(", ")}.`);

    const lang = requirementsLanguage();
    const text = requirementsContent(missing, await requirementsWords(lang), lang);

    if (!game.user.isGM) {
        ui.notifications.error(text.notice(names), { permanent: true });
        return;
    }

    const rows = text.rows.map(m => `
        <li>
            <strong>${esc(m.title)}</strong>
            <span class="notes">${esc(m.state)}</span>
            ${m.reason ? `<div class="notes">${esc(m.reason)}</div>` : ""}
        </li>`).join("");

    try {
        const DialogV2 = foundry.applications.api.DialogV2;
        await DialogV2.wait({
            window: { title: text.title },
            classes: ["drpg-panel"],
            content: `<div class="drpg-requirements">
                <p>${esc(text.intro)}</p>
                <ul>${rows}</ul>
                <p class="notes">${esc(text.how)}</p>
            </div>`,
            buttons: [{
                action: "ok",
                label: text.understood,
                default: true
            }],
            rejectClose: false
        });
    } catch (err) {
        // Whatever happens to the window, the GM still gets told.
        error("Could not show the missing-requirements window", err);
        ui.notifications.error(text.notice(names), { permanent: true });
    }
}


/* ==========================================================================
 * A MODULE THAT DID NOT START (E20 C5, 29.10.2026; S01-41, S01-45, S13-43; D19)
 * ========================================================================== */

/** Where Foundry serves this module's files from; a lookalike id with a suffix does not match. */
const OUR_FILES = `modules/${MODULE_ID}/`;

/**
 * Take this module's stylesheets off the page: a sheet whose own address is the module's (a
 * `<link>`) loses its element, and an `@import` of the module's inside another sheet (Foundry's
 * inline sheet of module imports, as the harness attaches them: lib/css.mjs) is deleted from it.
 * Another module's imports and a sheet that refuses its rules (another origin) stay.
 *
 * Called by `init` where the module stops (module.mjs): until then its six sheets hid the hotbar,
 * the scene navigation and the players list and restyled Foundry's windows for a module that was
 * not running (S01-41; 00-boot read 6 imports left and the hotbar hidden). Answers how many it took
 * off; never throws - a stop that cannot tidy up still stops. How Foundry v14 attaches module CSS
 * at a table is not measured here.
 */
export function removeModuleStyles(doc = globalThis.document) {
    let removed = 0;
    try {
        for (const sheet of [...(doc?.styleSheets ?? [])]) {
            if (String(sheet?.href ?? "").includes(OUR_FILES)) {
                sheet.ownerNode?.remove?.();
                removed++;
                continue;
            }
            let rules = null;
            try {
                rules = sheet?.cssRules ?? null;
            } catch {
                continue;   // another origin's sheet keeps its rules to itself, and none of them is ours
            }
            for (let i = (rules?.length ?? 0) - 1; i >= 0; i--) {
                if (!String(rules[i]?.href ?? "").includes(OUR_FILES)) continue;
                try {
                    sheet.deleteRule(i);
                    removed++;
                } catch (err) {
                    error("Could not take a stylesheet of the module off the page", err);
                }
            }
        }
    } catch (err) {
        error("Could not read the page's stylesheets", err);
    }
    return removed;
}

/**
 * The language the requirements window speaks: this browser's own choice of the module's language
 * where one is stored (the client setting, read raw - it is not registered when the module stops),
 * else Foundry's own language where the module ships it, else English. The module's setting cannot
 * be changed while the module is stopped, so Foundry's language is the one a table can pick then.
 */
export function requirementsLanguage({ stored = storedLanguage(), core = game.i18n?.lang } = {}) {
    if (Object.hasOwn(LANGUAGES, stored ?? "")) return stored;
    return Object.hasOwn(LANGUAGES, core ?? "") ? core : "en";
}

function storedLanguage() {
    try {
        return JSON.parse(globalThis.localStorage?.getItem(`${MODULE_ID}.${SETTINGS.language}`) ?? "null");
    } catch {
        return null;
    }
}

/**
 * The window's words in one language, `DRPG.Requirements` of the module's own file, fetched: the
 * module's language is merged by `registerLanguage`, which a stopped module never runs. Null when
 * the file does not load; the window then says Foundry's English.
 */
export async function requirementsWords(lang = requirementsLanguage()) {
    const path = `modules/${MODULE_ID}/lang/${lang}.json`;
    try {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
        const words = foundry.utils.expandObject(await response.json())?.DRPG?.Requirements;
        return words && typeof words === "object" ? words : null;
    } catch (err) {
        error(`Could not load the ${lang} words of the requirements window`, err);
        return null;
    }
}

/**
 * What the window and the players' notice say about `missing` (rows of `missingRequirements`),
 * from `words` (`requirementsWords`) and, for a key they lack, Foundry's own translations. Each
 * module's reason is `reason.<id>`, the manifest's only where neither holds one; the intro is
 * counted by the language's plural rule, so one module is never "one of them" or "two".
 */
export function requirementsContent(missing, words = null, lang = "en") {
    const own = key => {
        const value = foundry.utils.getProperty(words ?? {}, key);
        return typeof value === "string" ? value : null;
    };
    const fill = (text, data) => Object.entries(data).reduce((out, [k, v]) => out.replaceAll(`{${k}}`, String(v)), text);
    const say = (key, data = {}) => {
        const value = own(key);
        return value !== null ? fill(value, data) : game.i18n.format(`DRPG.Requirements.${key}`, data);
    };
    const has = key => own(key) !== null || game.i18n.has(`DRPG.Requirements.${key}`);
    const n = missing.length;
    let form = n === 1 ? "one" : "other";
    try {
        form = new Intl.PluralRules(lang).select(n);
    } catch {
        // an unknown tag: English's one/other above
    }
    return {
        title: say("title"),
        intro: say(`intro.${has(`intro.${form}`) ? form : "other"}`, { n }),
        rows: missing.map(m => ({
            id: m.id,
            title: m.title,
            state: say(`state.${m.state}`),
            reason: has(`reason.${m.id}`) ? say(`reason.${m.id}`) : (m.reason ?? "")
        })),
        how: say("how"),
        understood: say("understood"),
        notice: modules => say("playerNotice", { modules })
    };
}


/* ==========================================================================
 * THE SYSTEM, NEWER THAN ANYBODY MEASURED (E01, 24.09.2026; audit S01-09, D1)
 * ========================================================================== */

/**
 * The Daggerheart versions the manifest states: `{ minimum, verified }`.
 *
 * Read back from `relationships.systems` for the same reason the required
 * modules are: that is where Foundry reads it, so it is the copy people keep up
 * to date. `module.mjs` used to hold its own "2.6.0", which nobody had measured.
 */
export function systemCompatibility() {
    const systems = game.modules.get(MODULE_ID)?.relationships?.systems;
    const entry = [...(systems ?? [])].find(s => s?.id === game.system?.id);
    return {
        minimum: entry?.compatibility?.minimum ?? null,
        verified: entry?.compatibility?.verified ?? null
    };
}

/**
 * What the newer-system warning would say, or null when the system is not newer
 * than the one verified. The versions can be handed in, which is how R130 asks
 * about a Daggerheart this world is not running.
 *
 * @returns {Promise<{found: string, verified: string, missing: string[]}|null>}
 */
export async function newerSystemFindings({
    found = game.system?.version, verified = systemCompatibility().verified
} = {}) {
    if (!verified || !found || !foundry.utils.isNewerVersion(found, verified)) return null;
    let missing = [];
    try {
        const { diagnosePatches } = await import("./patches.mjs");
        missing = diagnosePatches()
            // `present: null` is a probe that cannot tell (a hook's class not registered yet): not named as missing.
            .filter(row => row.owner === game.system?.id && row.present === false)
            .map(row => row.target);
    } catch (err) {
        error("Could not probe the patches against this Daggerheart", err);
    }
    return { found, verified, missing };
}

/**
 * Tell the GM, once per Daggerheart version, that the system is newer than the
 * one this module was measured on.
 *
 * WHY THIS AND NOT A BLOCK (decision D1). The manifest states no maximum, so a
 * newer Daggerheart loads - which is what a table that updates its system wants,
 * and what makes this warning the only thing standing between a stranger's GM
 * and a roll window that stopped working without a word. Foundry's own notice
 * says "unverified" and nothing about what. This says what the module leans on,
 * and runs the patch probe (`diagnosePatches`) so a wrapper that no longer finds
 * its target is named here rather than discovered mid-trial.
 *
 * Silenced per version (`systemWarningSilenced`), per browser, by the checkbox
 * in its own window.
 */
export async function announceNewerSystem() {
    if (!game.user.isGM) return;
    // Silenced first, so a table that said "not again" is not probed on every load.
    let silenced = "";
    try {
        silenced = String(game.settings.get(MODULE_ID, SETTINGS.systemWarningSilenced) ?? "");
    } catch {
        silenced = "";
    }
    if (silenced && silenced === game.system?.version) return;

    const findings = await newerSystemFindings();
    if (!findings) return;
    const { found, verified, missing } = findings;

    const system = game.system?.title ?? game.system?.id;
    const probe = missing.length
        ? `<p>${game.i18n.localize("DRPG.Requirements.newerSystemPatches")}</p>
           <ul>${missing.map(target => `<li><code>${esc(target)}</code></li>`).join("")}</ul>`
        : `<p class="notes">${game.i18n.localize("DRPG.Requirements.newerSystemAllPatches")}</p>`;

    try {
        const DialogV2 = foundry.applications.api.DialogV2;
        const answer = await DialogV2.wait({
            window: { title: game.i18n.format("DRPG.Requirements.newerSystemTitle", { system }) },
            classes: ["drpg-panel"],
            content: `<form class="drpg-requirements">
                <p>${game.i18n.format("DRPG.Requirements.newerSystemIntro",
                    { system: esc(system), found: esc(found), verified: esc(verified) })}</p>
                ${probe}
                <label class="drpg-inline-check"><input type="checkbox" name="silence" />
                    ${game.i18n.format("DRPG.Requirements.newerSystemSilence", { found: esc(found) })}</label>
            </form>`,
            buttons: [{
                action: "ok",
                label: game.i18n.localize("DRPG.Requirements.understood"),
                default: true,
                callback: (event, button, dialog) => ({
                    silence: Boolean(dialog.element.querySelector("[name=silence]")?.checked)
                })
            }],
            rejectClose: false
        });
        if (answer?.silence) await game.settings.set(MODULE_ID, SETTINGS.systemWarningSilenced, found);
    } catch (err) {
        error("Could not show the newer-system window", err);
        ui.notifications.warn(game.i18n.format("DRPG.Requirements.newerSystemNotice",
            { system, found, verified }));
    }
}
