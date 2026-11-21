/**
 * Whether a release may reuse a green CI run of the same tree (INFRA, 1.2.120).
 * ---------------------------------------------------------------------------
 *     node audit/gate/reuse-ci.mjs --commit <sha>     release.yml's reuse-ci job; GITHUB_TOKEN and GITHUB_REPOSITORY
 *                                                     from the job's env, read only (actions: read)
 *
 * WHY. release.yml called ci.yml on the release commit - the merge of the release PR - although CI had already run
 * green on the PR's head, whose tree is byte for byte the same (for 1.2.119: `git diff 7a1f8740 e515907d` empty;
 * run 44845513063 on the head took 00:41:41-01:21:45Z, 40 minutes). Decision D47 (E30) stays: the released commit
 * must have met CI, and the same tree hash is the same files, ci.yml and everything it reads included.
 *
 * WHAT IS REUSED. A run of .github/workflows/ci.yml in this repository, completed with conclusion success, whose
 * head commit's tree is the release commit's tree, and whose jobs (the latest attempt's) are exactly the parts ci.yml
 * has: REQUIRED below, each success, and nothing but MAY_SKIP besides. The newest such run wins. Anything else - no
 * run, a red, cancelled or running one, a run of another tree or another repository, a job missing, skipped or
 * unknown, an API that did not answer - is "not reused", and release.yml runs ci.yml as before. This file never fails
 * a release: the worst it can do is make one wait for CI.
 *
 * WHICH SKIPPED JOBS ARE NORMAL (read off ci.yml at e515907d, and off run 44845513063's 21 jobs, 21.11.2026):
 *   - "crlf lint, check, gate" (crlf-quick) and crlf-suite run only on a dispatch with crlf = true (their `if:`), so a
 *     push run and a plain dispatch skip both. A skipped matrix job is listed once under its unexpanded name,
 *     "crlf suite ${{ matrix.shard }}/${{ strategy.job-total }}" (run 44845513063); when it runs, once per shard,
 *     "crlf suite i/N". Each is success or skipped: verdict already fails a run where one ran red.
 *   - Nothing else is ever skipped on a run that went to its end: plan, quick, the buckets and the shards have no
 *     `if:`, and verdict has `if: always()`. A skipped one of them means a part did not run, and refuses.
 * The counts are this checkout's: SHARDS and BUCKETS from ci.yml's env, the buckets capped by the number of ci
 * scenarios as plan deals them (`expectedParts`). The tree is the run's, so ci.yml is the one that run read.
 *
 * NOT MEASURED when this landed: the release run itself (the first is 1.2.120's) - that `head_commit.tree_id` is in
 * the runs list's answer (GitHub's documented schema has it; the session's API tool strips it, so a run without it
 * falls back to `git rev-parse <head_sha>^{tree}` in the checkout, which fetch-depth 0 makes possible for a PR head
 * merged into main), and what `filter=latest` lists after a "re-run failed jobs" (the case is read as it comes: a job
 * not success refuses).
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { execFileSync } from "node:child_process";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
export const WORKFLOW = ".github/workflows/ci.yml";
/** Jobs that are skipped on a run that went to its end, and pass as skipped or success. */
export const MAY_SKIP = Object.freeze([/^crlf lint, check, gate$/, /^crlf suite \$\{\{ matrix\.shard \}\}\/\$\{\{ strategy\.job-total \}\}$/, /^crlf suite \d+\/\d+$/]);
/** The job names a whole run has, each success. */
export function required({ shards, buckets }) {
    return ["plan", "lint, check, gate", "verdict",
        ...Array.from({ length: shards }, (_, i) => `suite ${i + 1}/${shards}`),
        ...Array.from({ length: buckets }, (_, i) => `scenarios b${i + 1}`)];
}

/** What is wrong with one run's jobs, as sentences; [] when every part ran green. */
export function jobProblems(jobs, expected) {
    if (!Array.isArray(jobs)) return ["its jobs were not read"];
    const problems = [], need = required(expected), seen = new Map();
    for (const j of jobs) seen.set(j.name, (seen.get(j.name) ?? 0) + 1);
    for (const [name, n] of seen) if (n > 1) problems.push(`${name} is listed ${n} times`);
    for (const name of need) {
        const j = jobs.find(x => x.name === name);
        if (!j) problems.push(`${name} is not in the run`);
        else if (j.status !== "completed" || j.conclusion !== "success") problems.push(`${name} is ${j.conclusion ?? j.status}`);
    }
    for (const j of jobs) {
        if (need.includes(j.name)) continue;
        if (!MAY_SKIP.some(re => re.test(j.name))) problems.push(`${j.name} is not a job this script knows in ci.yml`);
        else if (j.status !== "completed" || !["success", "skipped"].includes(j.conclusion)) problems.push(`${j.name} is ${j.conclusion ?? j.status}`);
    }
    return problems;
}

/**
 * The decision, pure over the API's answers.
 * @param {{tree: string, repo: string, expected: {shards: number, buckets: number}, runs: object[], jobsByRun: Record<string, object[]>}} a
 *   runs newest first, as the API lists them; jobsByRun maps a run's id to its latest attempt's jobs
 * @returns {{reuse: boolean, run: object|null, reasons: string[]}}
 */
export function decide({ tree, repo, expected, runs, jobsByRun }) {
    const reasons = [];
    const candidates = (runs ?? []).filter(r => r && r.status === "completed" && r.conclusion === "success" && r.path === WORKFLOW
        && r.head_repository?.full_name === repo && typeof tree === "string" && /^[0-9a-f]{40}$/.test(tree) && r.head_commit?.tree_id === tree);
    if (!candidates.length) return { reuse: false, run: null, reasons: [`no completed green ci.yml run of tree ${tree} among the ${(runs ?? []).length} read`] };
    for (const r of candidates) {
        const problems = jobProblems(jobsByRun?.[r.id], expected);
        if (!problems.length) return { reuse: true, run: r, reasons };
        reasons.push(`run ${r.id} (${r.head_sha}): ${problems.join("; ")}`);
    }
    return { reuse: false, run: null, reasons };
}

/** SHARDS and BUCKETS off ci.yml, the buckets capped by the ci scenarios exactly as ci.yml's plan job counts them. */
export function expectedParts(repo) {
    const yml = fs.readFileSync(path.join(repo, WORKFLOW), "utf8");
    const env = name => { const m = yml.match(new RegExp(`^  ${name}: (\\d+)$`, "m")); if (!m) throw new Error(`ci.yml has no env ${name}`); return Number(m[1]); };
    const dir = path.join(repo, "audit/harness/scenarios"), RE = /export const layers = (\[[^\]]*\])/;
    const names = fs.readdirSync(dir).filter(f => /^\d{2}-.+\.mjs$/.test(f)).filter(f => {
        const m = fs.readFileSync(path.join(dir, f), "utf8").match(RE);
        try { return !!m && JSON.parse(m[1]).includes("ci"); } catch { return false; }
    }).map(f => f.replace(/\.mjs$/, "")).filter(n => n !== "01-runtests");
    return { shards: env("SHARDS"), buckets: Math.max(1, Math.min(env("BUCKETS"), names.length)) };
}

/* ---------------------------------- CLI ------------------------------------ */

const git = (repo, args) => execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

async function api(base, token, rel) {
    const res = await fetch(`${base}${rel}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" } });
    if (!res.ok) throw new Error(`GET ${rel} answered HTTP ${res.status}`);
    return res.json();
}

async function main(argv) {
    const at = argv.indexOf("--commit"), commit = at >= 0 ? argv[at + 1] : "";
    const repoDir = path.resolve(HERE, "../..");
    const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo, GITHUB_API_URL: base = "https://api.github.com" } = process.env;
    const out = (reuse, run, lines) => {
        for (const l of lines) console.log(`reuse-ci: ${l}`);
        if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `reused=${reuse}\nrun_id=${run?.id ?? ""}\nrun_url=${run?.html_url ?? ""}\n`);
        if (process.env.GITHUB_STEP_SUMMARY) {
            const head = reuse ? `### CI: reused run [${run.id}](${run.html_url})\n\nCommit ${run.head_sha} (${run.event}), tree ${lines.tree}: the same files as this release's commit, every part green. ci.yml was not run again.\n`
                : "### CI: not reused - ci.yml runs on this commit\n";
            fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, head + lines.map(l => `\n- ${l}`).join("") + "\n");
        }
        return 0;
    };
    const lines = [];
    try {
        if (!/^[0-9a-f]{40}$/.test(commit ?? "")) throw new Error("usage: node audit/gate/reuse-ci.mjs --commit <full sha>");
        if (!token || !repo) throw new Error("GITHUB_TOKEN and GITHUB_REPOSITORY are not both set");
        const tree = git(repoDir, ["rev-parse", `${commit}^{tree}`]);
        lines.tree = tree;
        const expected = expectedParts(repoDir);
        lines.push(`release commit ${commit}, tree ${tree}; a whole run has ${required(expected).length} jobs green (${expected.shards} shards, ${expected.buckets} buckets)`);
        const runs = [];
        for (let page = 1; page <= 3; page++) {
            const got = await api(base, token, `/repos/${repo}/actions/workflows/ci.yml/runs?status=success&per_page=100&page=${page}`);
            runs.push(...(got.workflow_runs ?? []));
            if ((got.workflow_runs ?? []).length < 100) break;
        }
        /* A run whose answer lacks the tree: its commit's tree from the checkout, when the commit is in it. */
        for (const r of runs) {
            if (r.head_commit?.tree_id || !/^[0-9a-f]{40}$/.test(r.head_sha ?? "")) continue;
            try { r.head_commit = { ...(r.head_commit ?? {}), tree_id: git(repoDir, ["rev-parse", "--verify", "-q", `${r.head_sha}^{tree}`]) }; } catch { /* not in the checkout */ }
        }
        const jobsByRun = {};
        for (const r of runs.filter(x => x.head_commit?.tree_id === tree).slice(0, 5)) {
            const got = await api(base, token, `/repos/${repo}/actions/runs/${r.id}/jobs?filter=latest&per_page=100`);
            if ((got.jobs ?? []).length === got.total_count) jobsByRun[r.id] = got.jobs;
            else lines.push(`run ${r.id}: ${got.total_count} jobs, ${(got.jobs ?? []).length} read - not judged`);
        }
        const d = decide({ tree, repo, expected, runs, jobsByRun });
        lines.push(...d.reasons);
        lines.push(d.reuse ? `reused: run ${d.run.id} on ${d.run.head_sha} (${d.run.event}), ${d.run.html_url}` : "not reused: ci.yml runs on this commit");
        return out(d.reuse, d.run, lines);
    } catch (err) {
        lines.push(`could not decide (${err.message}): ci.yml runs on this commit`);
        return out(false, null, lines);
    }
}

const runAsCommand = () => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(url.fileURLToPath(import.meta.url)); } catch { return false; } };
if (process.argv[1] && runAsCommand()) process.exitCode = await main(process.argv.slice(2));
