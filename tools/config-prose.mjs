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
 * `proseCoverage(file)` is the same count as a value, for tools/check.mjs.
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

const flat = (o, p = "") => Object.entries(o ?? {}).flatMap(([k, v]) =>
    typeof v === "object" && v !== null ? flat(v, p ? `${p}.${k}` : k) : [[p ? `${p}.${k}` : k, v]]);

/**
 * What a language file covers of config.mjs's prose - the numbers `--check`
 * prints, for `node tools/check.mjs prose` (E30), which needs them as values
 * rather than as a line to parse.
 * @param {string} file  a language file, relative to the working directory or absolute
 * @returns {{wanted: number, covered: number, missing: string[], extra: string[]}}
 */
export function proseCoverage(file) {
    const lang = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
    const wanted = new Map(flat(tree?.DRPG?.Config ?? {}));
    const have = new Map(flat(lang?.DRPG?.Config ?? {}));
    const missing = [...wanted.keys()].filter(k => !have.has(k));
    const extra = [...have.keys()].filter(k => !wanted.has(k));
    return { wanted: wanted.size, covered: wanted.size - missing.length, missing, extra };
}

/* Real paths, as in tools/stages.mjs: through a symlink the plain comparison never held (25.09.2026). */
const runAsCommand = () => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(url.fileURLToPath(import.meta.url)); } catch { return false; } };
if (process.argv[1] && runAsCommand()) {
    const args = process.argv.slice(2);
    if (args[0] === "--check") {
        const { wanted, covered, missing, extra } = proseCoverage(args[1]);
        console.log(`config prose: ${wanted} strings; ${args[1]} covers ${covered}, missing ${missing.length}, extra ${extra.length}`);
        for (const k of missing.slice(0, 40)) console.log("  missing", k);
        for (const k of extra.slice(0, 40)) console.log("  extra  ", k);
        process.exit(missing.length || extra.length ? 1 : 0);
    }
    console.log(JSON.stringify(tree, null, 2));
}
void CONFIG_TABLES; void PROSE_KEYS; void isProse;
