/**
 * Every sentence config.mjs owns, as i18n keys.
 * ---------------------------------------------------------------------------
 * config.mjs is the rulebook and its `label`, `hint`, `effect`, `failure` (and
 * so on) fields are finished English copy read straight into the interface.
 * A translation cannot edit that file, so at `i18nInit` the module walks the
 * same tables this tool walks and swaps each sentence for
 * `DRPG.Config.<TABLE>.<path>` when the language file carries it - see
 * scripts/i18n.mjs, which shares `PROSE_KEYS` and `CONFIG_TABLES` with this.
 *
 * Run it to see what a language file has to cover:
 *
 *     node tools/config-prose.mjs            # the English tree, as JSON
 *     node tools/config-prose.mjs --check lang/pl.json
 *                                            # what that file is missing / has extra
 *
 * Node only; nothing here runs inside Foundry.
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const REPO = path.join(HERE, "..");

const config = await import(url.pathToFileURL(path.join(REPO, "scripts/config.mjs")).href);
const { CONFIG_TABLES, PROSE_KEYS, isProse, walkConfigProse } = await import(
    url.pathToFileURL(path.join(REPO, "scripts/i18n-config.mjs")).href);

const tree = {};
walkConfigProse(config, (key, value) => {
    const parts = key.split(".");
    let node = tree;
    for (const part of parts.slice(0, -1)) node = node[part] ??= {};
    node[parts.at(-1)] = value;
});

const args = process.argv.slice(2);
if (args[0] === "--check") {
    const file = JSON.parse(fs.readFileSync(path.resolve(args[1]), "utf8"));
    const flat = (o, p = "") => Object.entries(o ?? {}).flatMap(([k, v]) =>
        typeof v === "object" && v !== null ? flat(v, p ? `${p}.${k}` : k) : [[p ? `${p}.${k}` : k, v]]);
    const wanted = new Map(flat(tree?.DRPG?.Config ?? {}));
    const have = new Map(flat(file?.DRPG?.Config ?? {}));
    const missing = [...wanted.keys()].filter(k => !have.has(k));
    const extra = [...have.keys()].filter(k => !wanted.has(k));
    console.log(`config prose: ${wanted.size} strings; ${args[1]} covers ${wanted.size - missing.length}, missing ${missing.length}, extra ${extra.length}`);
    for (const k of missing.slice(0, 40)) console.log("  missing", k);
    for (const k of extra.slice(0, 40)) console.log("  extra  ", k);
    process.exit(missing.length || extra.length ? 1 : 0);
}

console.log(JSON.stringify(tree, null, 2));
void CONFIG_TABLES; void PROSE_KEYS; void isProse;
