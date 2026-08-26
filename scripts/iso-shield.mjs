/**
 * Danganronpa RPG — guarding token editing from Isometric Perspective.
 * ---------------------------------------------------------------------------
 * Dawid runs `isometric-perspective` (arlosmolten) on The Forge, and with it
 * active, editing tokens glitches to the point of being unusable. Reproduced
 * far enough to name the failure class: the module reaches into every token
 * configuration window three ways —
 *
 *   1. `renderTokenConfig` → `initTokenForm`, which reads its own tab's
 *      inputs with NO null guards (`inputIsoAnchorX.value = …` throws the
 *      moment the query misses, and its reset-button listener the same). A
 *      window variant whose markup differs — another UI module, a sheet the
 *      part failed to render into — turns every token config render into an
 *      exception inside the render hook.
 *   2. `renderTokenConfig` → `addPrecisionTokenArtListener`, more of the
 *      same window surgery.
 *   3. A class-level patch: `TABS.sheet.tabs` gains an "isometric" entry,
 *      `PARTS.isometric` gains a template, and `_preparePartContext` is
 *      wrapped on the prototype.
 *
 * The shield retires (1) and (2) by unhooking the handlers — matched by
 * FUNCTION NAME, which the module ships unminified, so a renamed future
 * version degrades this to a safe no-op — and takes the tab out of (3) by
 * removing the TABS entry and the PARTS template, both saved and restorable.
 * The `_preparePartContext` wrapper itself stays: with the part gone its
 * isometric branch is never asked for, and every other part is delegated to
 * the saved default, so it is inert. Nothing in the other module's files is
 * touched, and switching the setting off puts every piece back live, no
 * reload needed.
 *
 * Scene configuration is deliberately left alone (Dawid, 26.08: option A,
 * tokens only), and so is everything the module does to the canvas — the
 * projection is its job; the token WINDOWS are ours to keep working.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { log, warn, debug } from "./utils.mjs";

const ISO_ID = "isometric-perspective";

/** The handlers to park, by the hook they sit on and the names they ship under. */
const HOOK_NAMES = {
    renderTokenConfig: ["initTokenForm", "addPrecisionTokenArtListener"],
    renderPrototypeTokenConfig: ["initTokenForm"]
};

/** What has been taken down, so the setting can put it back. */
let parkedHooks = [];   // [{ hook, fn }]
let parkedParts = [];   // [{ cls, part, tabEntry }]

function shieldWanted() {
    try {
        return game.settings.get(MODULE_ID, SETTINGS.isoTokenShield) === true;
    } catch {
        return false;
    }
}

function isoActive() {
    return game.modules.get(ISO_ID)?.active === true;
}

/**
 * Every token-config class the isometric module patches: the world's default
 * token sheet (the system's own subclass when there is one) and the prototype
 * token config — the same discovery walk its `patchConfig` callers make, so
 * the shield unpicks exactly what was picked.
 */
function configClasses() {
    const classes = new Set();
    try {
        const base = foundry.applications.sheets.TokenConfig;
        const def = Object.values(CONFIG.Token?.sheetClasses?.base ?? {})
            .find(d => d.default)?.cls;
        classes.add(def?.prototype instanceof base ? def : base);
        const proto = foundry.applications.sheets.PrototypeTokenConfig;
        if (proto) classes.add(proto);
    } catch (err) {
        warn("Iso shield: could not enumerate token config classes.", err);
    }
    return Array.from(classes).filter(Boolean);
}

function park() {
    if (parkedHooks.length || parkedParts.length) return;

    for (const [hook, names] of Object.entries(HOOK_NAMES)) {
        for (const entry of Array.from(Hooks.events[hook] ?? [])) {
            const fn = entry.fn ?? entry;
            if (!names.includes(fn?.name)) continue;
            Hooks.off(hook, fn);
            parkedHooks.push({ hook, fn });
        }
    }

    for (const cls of configClasses()) {
        const tabs = cls.TABS?.sheet?.tabs;
        const at = tabs?.findIndex(t => t?.id === "isometric") ?? -1;
        const tabEntry = at >= 0 ? tabs.splice(at, 1)[0] : null;
        const part = cls.PARTS?.isometric ?? null;
        if (part) delete cls.PARTS.isometric;
        if (part || tabEntry) parkedParts.push({ cls, part, tabEntry });
    }

    if (parkedHooks.length || parkedParts.length) {
        log(`Iso shield up: ${parkedHooks.length} handler(s) and `
            + `${parkedParts.length} config tab(s) parked while token editing is guarded.`);
    } else {
        // The module is active but nothing matched — a future version has
        // renamed things. Said out loud rather than silently guarding nothing.
        warn("Iso shield: isometric-perspective is active but nothing recognisable "
            + "was found to park. The shield is a no-op on this version.");
    }
}

function unpark() {
    for (const { hook, fn } of parkedHooks.splice(0)) Hooks.on(hook, fn);

    for (const { cls, part, tabEntry } of parkedParts.splice(0)) {
        if (tabEntry && cls.TABS?.sheet?.tabs
            && !cls.TABS.sheet.tabs.some(t => t?.id === "isometric")) {
            cls.TABS.sheet.tabs.push(tabEntry);
        }
        if (part && cls.PARTS && !cls.PARTS.isometric) {
            cls.PARTS.isometric = part;
            // The same footer dance the module's own patch does: the footer
            // renders last or the Save button ends up mid-window.
            if (cls.PARTS.footer) {
                const footer = cls.PARTS.footer;
                delete cls.PARTS.footer;
                cls.PARTS.footer = footer;
            }
        }
    }
    log("Iso shield down: the isometric module's token-config pieces are back.");
}

/** Apply the setting's current answer. Ready-time, and the setting's onChange. */
export function applyIsoShield() {
    if (!isoActive()) return;
    if (shieldWanted()) park();
    else if (parkedHooks.length || parkedParts.length) unpark();
}

export function registerIsoShield() {
    // At ready, AFTER the isometric module's own ready hooks have patched the
    // classes — parking earlier would find nothing and then be patched over.
    // `once` + a timeout of 0 keeps it behind every same-tick ready handler
    // regardless of module registration order.
    Hooks.once("ready", () => setTimeout(() => {
        try {
            applyIsoShield();
        } catch (err) {
            warn("Iso shield: could not apply.", err);
        }
    }, 0));
    debug("Iso shield registered.");
}
