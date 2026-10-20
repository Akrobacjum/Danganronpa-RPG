/**
 * The suite's shards, held together (INFRA I2, 18.10.2026).
 * ---------------------------------------------------------------------------
 *     node suite-merge.mjs <dir>
 *
 * Reads every 01-runtests.json under <dir>, at any depth - CI's verdict job
 * downloads each shard's results folder as `shards/results-suite-<i>/`, and a
 * folder holding one unsharded run is a set of one shard, 1/1 - and holds the set
 * to being the whole suite, run once:
 *
 *   - every file is a sharded run's: `evidence.shard` (01-runtests writes it from
 *     DRPG_SUITE_SHARD; an unsharded run writes 1/1) and `evidence.suite.results`;
 *   - the shards agree on their count, on the length of the whole tier-2 list and
 *     on its hash, and their indices are 1..count, each exactly once;
 *   - every shard's copy of the list hashes to the hash it wrote; the names the
 *     shards ran are that list, each name once and in the shard its position gives
 *     it (position k is shard 2 + k % (count - 1)'s, shard 1 runs none of tier 2;
 *     a set of one is 1/1 and runs them all - tests.mjs `shardOfPosition`), none missing and none from outside
 *     it, each named; and each name a shard says it ran is a tier-2 test in its
 *     results, and no other is;
 *   - tiers 0 and 1 are in shard 1 and in no other;
 *   - the skips together are skip-baseline.json's, exactly, by probe and name,
 *     none twice (each shard's own check only asks that its skips are listed);
 *   - nothing failed: the suite's results and each shard's own checks.
 *
 * Exit 0 when every one holds; 1 with each that does not, by name (a shard, a test,
 * a skip missing or doubled); 2 when there is nothing to read. Node built-ins only:
 * the verdict job runs it with no `npm ci`.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const FILE = "01-runtests.json";

/** The hash 01-runtests writes of the whole tier-2 list: sha256 of its names, one a line, in order. */
export function listHash(names) {
    return crypto.createHash("sha256").update(names.join("\n")).digest("hex");
}

function filesUnder(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const at = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...filesUnder(at));
        else if (entry.name === FILE) out.push(at);
    }
    return out.sort();
}

const skipKey = r => `${r.probe} | ${r.test ?? r.name}`;
const more = (list, n = 12) => list.slice(0, n).join("; ") + (list.length > n ? `; and ${list.length - n} more` : "");

/** Every problem of the set under `dir`, and the numbers it read. Exported for a test that plants a set. */
export function mergeShards(dir, baseline) {
    const problems = [];
    const files = filesUnder(dir);
    const shards = [];
    for (const file of files) {
        const at = path.relative(dir, file);
        let doc;
        try { doc = JSON.parse(fs.readFileSync(file, "utf8")); } catch (err) { problems.push(`${at}: ${err.message}`); continue; }
        const shard = doc?.evidence?.shard, suite = doc?.evidence?.suite;
        if (!shard || !Number.isInteger(shard.index) || !Number.isInteger(shard.count) || !Array.isArray(shard.names)) {
            problems.push(`${at}: no evidence.shard - a results file written before 01-runtests kept its shard`);
            continue;
        }
        if (!Array.isArray(suite?.results)) { problems.push(`${at}: no evidence.suite.results`); continue; }
        shards.push({ at, doc, shard, suite });
    }
    const totals = { files: files.length, shards: shards.length, tier2: 0, passed: 0, failed: 0, skipped: 0, red: 0 };
    if (!shards.length) return { problems: problems.length ? problems : ["no shard to read"], totals, empty: true };

    // One count, one list.
    const agree = field => new Set(shards.map(s => JSON.stringify(s.shard[field])));
    for (const field of ["count", "total", "hash"]) {
        if (agree(field).size > 1) problems.push(`the shards disagree on ${field}: ${shards.map(s => `${s.at} ${JSON.stringify(s.shard[field])}`).join(", ")}`);
    }
    const count = shards[0].shard.count, total = shards[0].shard.total, hash = shards[0].shard.hash;
    totals.tier2 = total;
    const byIndex = new Map();
    for (const s of shards) {
        if (!(s.shard.index >= 1 && s.shard.index <= count)) problems.push(`${s.at}: shard ${s.shard.index}/${s.shard.count} is not one of 1..${count}`);
        else if (byIndex.has(s.shard.index)) problems.push(`shard ${s.shard.index}/${count} is doubled: ${byIndex.get(s.shard.index).at} and ${s.at}`);
        else byIndex.set(s.shard.index, s);
    }
    const missingShards = Array.from({ length: count }, (_, i) => i + 1).filter(i => !byIndex.has(i));
    if (missingShards.length) problems.push(`shard${missingShards.length === 1 ? "" : "s"} ${missingShards.map(i => `${i}/${count}`).join(", ")} missing`);

    // The names: each of the list once, in the shard its position gives it, and nothing else.
    const list = shards[0].shard.list ?? [];
    for (const s of shards) {
        const own = s.shard.list ?? [];
        if (own.length !== s.shard.total || listHash(own) !== s.shard.hash) {
            problems.push(`${s.at}: its list of ${own.length} names does not hash to the hash it wrote (for ${s.shard.total} names)`);
        }
    }
    const ranBy = new Map();
    for (const s of shards) for (const name of s.shard.names) ranBy.set(name, [...(ranBy.get(name) ?? []), s.shard.index]);
    const missing = [], doubled = [], misplaced = [];
    list.forEach((name, k) => {
        const at = ranBy.get(name) ?? [], home = count > 1 ? 2 + (k % (count - 1)) : 1;
        if (!at.length) { if (byIndex.has(home)) missing.push(`${name} (shard ${home})`); }
        else if (at.length > 1) doubled.push(`${name} (shards ${at.join(", ")})`);
        else if (at[0] !== home) misplaced.push(`${name} (shard ${at[0]}, its place is shard ${home})`);
    });
    const inList = new Set(list);
    const stray = [...ranBy.keys()].filter(name => !inList.has(name));
    if (missing.length) problems.push(`tier-2 test${missing.length === 1 ? "" : "s"} run by no shard: ${more(missing)}`);
    if (doubled.length) problems.push(`tier-2 test${doubled.length === 1 ? "" : "s"} run twice: ${more(doubled)}`);
    if (misplaced.length) problems.push(`tier-2 test${misplaced.length === 1 ? "" : "s"} run out of the cut's place: ${more(misplaced)}`);
    if (stray.length) problems.push(`tier-2 test${stray.length === 1 ? "" : "s"} run and not in the list: ${more(stray)}`);
    for (const s of shards) {
        const tier2 = s.suite.results.filter(r => r.tier === 2 && r.assertions !== null).map(r => r.name);
        const listed = new Set(s.shard.names), ran = new Set(tier2);
        const notRun = s.shard.names.filter(n => !ran.has(n)), unlisted = tier2.filter(n => !listed.has(n));
        if (notRun.length) problems.push(`${s.at}: shard ${s.shard.index} names tier-2 tests its results do not hold: ${more(notRun)}`);
        if (unlisted.length) problems.push(`${s.at}: shard ${s.shard.index} holds tier-2 results it does not name: ${more(unlisted)}`);
    }

    // Tiers 0 and 1, in shard 1 alone.
    const low = shards.map(s => ({ s, n: s.suite.results.filter(r => r.tier <= 1).length }));
    const lowIn = low.filter(x => x.n > 0);
    const one = byIndex.get(1);
    if (one && !low.find(x => x.s === one).n) problems.push("tiers 0 and 1 are not in shard 1");
    for (const x of lowIn) if (x.s.shard.index !== 1) problems.push(`tiers 0 and 1 are in shard ${x.s.shard.index} as well (${x.n} results)`);

    // The skips, exactly the baseline's, together.
    const skips = shards.flatMap(s => s.suite.results.filter(r => r.outcome === "skip").map(r => ({ key: skipKey(r), index: s.shard.index })));
    const skipCount = new Map();
    for (const k of skips) skipCount.set(k.key, [...(skipCount.get(k.key) ?? []), k.index]);
    const listedSkips = new Set((baseline?.skips ?? []).map(skipKey));
    const skipTwice = [...skipCount].filter(([, at]) => at.length > 1).map(([k, at]) => `${k} (shards ${at.join(", ")})`);
    const unlistedSkips = [...skipCount.keys()].filter(k => !listedSkips.has(k));
    const answering = [...listedSkips].filter(k => !skipCount.has(k));
    if (skipTwice.length) problems.push(`skipped twice: ${more(skipTwice)}`);
    if (unlistedSkips.length) problems.push(`skipped and not in skip-baseline.json: ${more(unlistedSkips)}`);
    if (answering.length) problems.push(`in skip-baseline.json and skipped by no shard: ${more(answering)}`);

    // Nothing failed.
    for (const s of shards) {
        for (const r of s.suite.results.filter(x => x.outcome === "fail")) problems.push(`shard ${s.shard.index}: FAIL ${r.name}${r.message ? ` - ${String(r.message).split("\n")[0].slice(0, 200)}` : ""}`);
        for (const r of (s.doc.results ?? []).filter(x => x.status === "fail")) problems.push(`shard ${s.shard.index}: its check failed: ${r.name}`);
        // Counted off the lists, which 01-runtests holds to its summary ("every result the summary counts is in the list").
        for (const [k, outcome] of [["passed", "pass"], ["failed", "fail"], ["skipped", "skip"], ["red", "red"]]) {
            totals[k] += s.suite.results.filter(r => r.outcome === outcome).length;
        }
    }
    return { problems, totals, empty: false };
}

if (process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url)) {
    const dir = process.argv[2];
    if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
        console.log("usage: node suite-merge.mjs <dir> - a folder holding each shard's 01-runtests.json, at any depth");
        process.exit(2);
    }
    const baseline = JSON.parse(fs.readFileSync(path.join(HERE, "skip-baseline.json"), "utf8"));
    const { problems, totals, empty } = mergeShards(dir, baseline);
    for (const p of problems) console.log(`suite-merge: ${p}`);
    const t = totals;
    console.log(`suite-merge: ${t.shards} shard(s) of ${t.files} file(s), ${t.tier2} tier-2 tests in the list; `
        + `${t.passed} passed, ${t.failed} failed, ${t.skipped} skipped, ${t.red} red: ${problems.length ? "RED" : "green"}`);
    process.exit(empty ? 2 : problems.length ? 1 : 0);
}
