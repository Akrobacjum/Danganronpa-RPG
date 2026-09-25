# audit/gate - the release gate's second layer

A release passes two layers (decision D47, E30):

1. **ci** - `npm test` in `audit/harness`: lint, `tools/check.mjs`, this
   folder's verifier self-test, the suite and every scenario whose layers
   include `ci`, headless. `.github/workflows/ci.yml` runs it on every push and
   pull request to `main`, and `release.yml` calls it before it builds.
2. **local-gate** - what the headless harness cannot do: the suite's tier 2 in
   both themes on a real Foundry v14, the whole-world diff around it, the
   scenarios whose layers include `local-gate`, and the drills a stage names in
   `tools/stages.json`. It runs on a machine with a v14 sandbox, writes
   `local-gate.json`, and `release.yml` checks that file with `verify-gate.mjs`.

| File | Written by | What it is |
| --- | --- | --- |
| `gate-lib.mjs` | a person | what the writer and the verifier share: the schema, the digest, the bound paths, the reasons a part may not have run, when the gate is required |
| `local-gate.mjs` | a person | the writer: `npm run gate:local` from `audit/harness` |
| `verify-gate.mjs` | a person | the verifier: `--tag vX.Y.Z` in `release.yml`, `--self-test` in `npm test` |
| `local-gate.json` | **the writer only** | the last run, bound to its commit; an edited file fails its digest |
| `evidence/` | **the writer only** | the current version's evidence; git keeps the history |
| `waivers/` | **the owner only** | `vX.Y.Z.md`, in enforce mode; an agent never writes one |
| `.work/` | the live runner | world dumps, gitignored |

## Running it

```
cd audit/harness && npm ci
DRPG_SANDBOX_WORLD=drpg-qa-gate npm run gate:local
```

Run it on the release commit - the one that bumps the version - and commit
what it wrote in a commit of its own on top. Not an amend: the file names the
commit it ran on, and the verifier wants that commit to be an ancestor of the
one being released, with every bound path unchanged since (the module's
scripts, styles, lang, fonts, icons, module.json, this writer, gate-lib,
audit/live, the harness seed and the local-gate scenarios; release notes and
docs are not bound).

Settings: `DRPG_SANDBOX_URL` (default `http://localhost:30099`, loopback
only), `DRPG_SANDBOX_WORLD` (the only world it may write to; must match
`/(gate|copy|qa)/i`), `DRPG_SANDBOX_USERS` (JSON; default GM, PlayerOne,
PlayerTwo, PlayerThree, none with a password), `DRPG_FIXTURES` (the private
world copies for drills), `DRPG_GATE_KEY` (signs the file). Options:
`--parts live,sandbox,drills`, `--merge` (replace only the parts run now),
`--dry-run`.

It refuses to write outside a git checkout, with uncommitted changes in a bound
path, or without a readable module.json. Otherwise it always writes, whatever
the verdict: `passed` when every part passed, `failed` when one failed or
errored, `incomplete` otherwise. A part is `passed`, `failed`, `error` (the
runner broke, not the module) or `not-run` with a reason:

| Reason | Waivable | Means |
| --- | --- | --- |
| no-server | yes | nothing answered at the sandbox URL |
| no-world | yes | the server is at setup; the runner never logs into setup |
| wrong-foundry | yes | the server is not 14.x |
| no-fixtures | yes | `DRPG_FIXTURES` is unset or lacks the fixture |
| not-a-copy | no | the world is not an allowed copy |
| password-required | no | an account needs a password; the runner never types one |
| stale-module | no | the served files differ from this commit |
| no-playwright, no-browser | no | the runner's own dependencies are missing |
| adapter-missing | no | the scenario needs something the sandbox adapter lacks |

## What the verifier lets through

The rules are listed at the top of `verify-gate.mjs`. A release is **required**
to pass the local gate when it is 1.3.0, when its stage declares in
`tools/stages.json` that it touches sockets, rolls or scenes, or when a runtime
script that reads one of those changed since the previous tag. When a required
part did not run, the repository variable `DRPG_LOCAL_GATE` decides:

- **record** (unset means this; the owner's decision of 24.09.2026, while no v14
  sandbox exists): a part not run for a waivable reason passes when the release
  notes' `## Checked` section has a line starting `- Not checked in a real
  Foundry`. The job summary lists the parts and every release since the last
  complete gate - the debt.
- **enforce**: a waiver file `waivers/vX.Y.Z.md` written by the owner, whose
  `Parts not run:` line names exactly those parts (added by an author in
  `DRPG_WAIVER_AUTHORS` when that is set); the tag typed again as the release's
  `local_gate_waiver` input; the notes line; and an approval in the protected
  environment `local-gate-waiver`.

In both modes a failed or errored part, a reason that is the gate's own fault,
a missing, stale, edited or (with `DRPG_GATE_KEY` set) unsigned file, and
**1.3.0** are refused. 1.3.0 ships only on verdict `passed`. So is a part whose
status is none of `passed`, `failed`, `error` and `not-run`, a passed suite run
that passed no test, and a passed world diff that dumped no path.

Waiver file (enforce mode; the owner writes it, never an agent):

```
# Local gate waiver - v1.2.61
Decided by: <name>, <date>
Parts not run: live-stained-glass, live-monokuma-legacy, live-world-diff, sandbox-14-quiet, sandbox-60-ledger, drill-migrate-remnants-old-world
Why: no Foundry v14 sandbox or licence where the gate ran (audit/gate/local-gate.json)
Owed by: the first release after a sandbox exists, and before 1.3.0 in any case
```

## What is proved here, and what is not

`node verify-gate.mjs --self-test` builds throwaway repositories, runs the real
writer in them and checks that the verifier refuses every missing, stale,
edited, unsigned or wrongly waived file in both modes. On a machine with no
sandbox the writer records every part as `not-run` with the real connection
error. Nothing else is proved: the live runner in `audit/live` has never run
against a real Foundry (its README).
