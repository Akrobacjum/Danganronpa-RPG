/**
 * Danganronpa RPG - which sentences of config.mjs a language file may replace.
 * ---------------------------------------------------------------------------
 * A leaf shared by the runtime (i18n.mjs) and by tools/config-prose.mjs, so
 * the walk that extracts the English and the walk that installs a translation
 * cannot disagree about what counts as prose.
 *
 * Only the fields named in `PROSE_KEYS` are considered, and only when their
 * value reads as a sentence or a name rather than an identifier - `hope` is a
 * sentence in CRISIS_ACTIONS and a bare key in OVERFLOW, `critical` is prose
 * in one table and an object in another. Identifiers (`dcTable: "OBSERVE_DC"`,
 * `reader: "SearchTokens.max"`, the playlist name) never match, because they
 * are read back by code and a translated identifier is a broken lookup.
 */

/** Exports of config.mjs whose prose the language file may carry. `DRPG` (the aggregate) is skipped. */
export const CONFIG_TABLES = [
    "TRAITS", "TIME_OF_DAY_LABELS", "PHASES", "ITEM_CATEGORIES", "TIER_EFFECTS", "USABLE_KINDS",
    "USABLE_KIND_EFFECTS", "USABLE_EFFECTS", "REMNANT_VISIBILITY_LABELS", "REMNANT_TYPES",
    "TRUTH_BULLET_TYPES", "KEY_REMNANTS", "ACTIONS", "INDIRECT_MURDER", "BROKEN_ITEMS",
    "SABOTAGE_CONCEAL", "DYNAMIC_THRESHOLDS", "REST", "HOPE_CALLS", "OVERFLOW", "DESPAIR_CALLS",
    "MOTIVE", "PROJECT_SCALE", "PROJECT_GLYPHS", "TRAP_TRIGGERS", "TRAP_MODIFIERS", "STATES",
    "LEVEL_UP_OPTIONS", "LEVEL_UP", "MONOCUB", "MURDER_OPENING", "INCIDENT", "CRISIS_ACTIONS",
    "TRIAL", "CLEANUP", "SFX_CATEGORIES", "SFX_SLIDERS", "SFX_EVENTS"
];

/** Field names whose string values are copy, not identifiers. Numeric keys cover TIER_EFFECTS. */
export const PROSE_KEYS = new Set([
    "label", "short", "hint", "description", "effect", "failure", "result", "plural",
    "hope", "despair", "critical", "success", "successWithDespair", "long", "help", "hinder",
    "aloneNote", "chip", "note", "when", "hintFailure", "instruction", "name", "difficulty",
    "morning", "noon", "afternoon", "evening", "night",
    "obvious", "evident", "subtle", "hidden", "trivial", "standard", "complex", "desperate",
    "0", "1", "2", "3"
]);

/** A sentence or a name: has a space, or is not the shape of an identifier. */
export function isProse(value) {
    if (typeof value !== "string" || !value) return false;
    if (/\s/.test(value)) return true;
    return !/^[a-z][A-Za-z0-9_.-]*$/.test(value) && !/^[A-Z][A-Z0-9_]*$/.test(value);
}

/**
 * Visit every prose string in the tables, as `(key, value, set)`: `key` is the
 * i18n key (`DRPG.Config.ACTIONS.search.label`), `set(next)` writes a
 * replacement into the table in place. Arrays use their index as a segment.
 */
export function walkConfigProse(config, visit) {
    const walk = (node, keyPath) => {
        if (Array.isArray(node)) {
            node.forEach((v, i) => walk(v, `${keyPath}.${i}`));
            return;
        }
        if (!node || typeof node !== "object") return;
        for (const [field, value] of Object.entries(node)) {
            const here = `${keyPath}.${field}`;
            if (typeof value === "string") {
                if (PROSE_KEYS.has(field) && isProse(value)) visit(here, value, next => { node[field] = next; });
            } else if (value && typeof value === "object") {
                walk(value, here);
            }
        }
    };
    for (const table of CONFIG_TABLES) {
        if (config[table] && typeof config[table] === "object") walk(config[table], `DRPG.Config.${table}`);
    }
}
