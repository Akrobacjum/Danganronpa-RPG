---
paths:
  - ".github/**/*"
  - "audit/gate/**/*"
  - "audit/live/**/*"
  - "module.json"
  - "docs/handbooks/*.md"
  - "README.md"
  - "styles/danganronpa.css"
  - "tools/stages.mjs"
  - "tools/stages.json"
---

# The gate and releasing (moved from CLAUDE.md)

## The gate, both layers (continued)

The two layers are in CLAUDE.md; when the gate is required and what passes it:

The gate is required for 1.3.0, for a stage that declares sockets, rolls or
scenes, and when a runtime script that reads one of them changed since the
previous tag. When a required part did not run, the repository variable
`DRPG_LOCAL_GATE` decides:

- **record** (unset; chosen on 24.09.2026, while no v14 sandbox exists): a part
  not run for a waivable reason - no server, no world, the wrong Foundry, no
  fixtures - passes when the notes' "## Checked" section has a line starting
  "- Not checked in a real Foundry". The job summary carries it, and every
  release since the last complete gate, as debt.
- **enforce**: the owner's waiver file `audit/gate/waivers/vX.Y.Z.md`, the tag
  typed again as the dispatch's `local_gate_waiver` input, the notes line, and
  an approval in the protected environment `local-gate-waiver`.

In both, a failed or errored part, a reason that is the gate's own fault, a
missing, stale, edited or (with `DRPG_GATE_KEY` set) unsigned file, and 1.3.0
without a passed gate are refused. So are a part whose status is none of passed,
failed, error and not-run, a passed suite run that passed no test, and a passed
world diff that dumped no path. As of 24.09.2026 nothing in `audit/live` has
run against a real Foundry (its README says so first).

## Releasing

1. Bump the version in `module.json`, the `--drpg-css-version` stamp in
   `styles/danganronpa.css`, the third line of the six handbooks in
   `docs/handbooks/` and the README's "They describe version X."
   `node tools/check.mjs stamps --release vX.Y.Z` checks all eight stamps
   against `module.json` and the tag, R125 checks the handbooks and the README
   in the suite, and the workflow refuses to build when one lags.
2. Write `.github/release-notes/vX.Y.Z.md` (`node tools/check.mjs notes`). Its
   "## Checked" section says what was measured and, on a line starting
   "- Not checked in a real Foundry", what was not.
3. In the same commit, `node tools/stages.mjs ship EXX [EYY ...]` marks every
   stage of the train shipped, as one version on one date. It refuses while a
   marker in the suite still names one of them, and from then on every red
   still promised for them fails, on purpose.
4. Run the local gate on that commit (`npm run gate:local`) and commit
   `audit/gate/local-gate.json` and `audit/gate/evidence/` on top of it, in a
   commit of their own - not amended in: the file names the commit it ran on.
5. In CLAUDE.md ("Releasing, step 5"): an agent never writes a waiver file and never fills the
   waiver input.
6. Before a release, look up the current Daggerheart version. `verified` in
   `module.json` names only a version the suite has passed on at a real table;
   the manifest states no `maximum` (decision D1), so a newer Daggerheart loads
   and the module warns the GM once per version.
7. `main` is the release branch: merge on green CI only. The tag is created
   there, and the workflow refuses a dispatch from anywhere else.
8. Actions ▸ Release, dispatched on `main` with the tag (and a title for the
   last one) and `prerelease` ticked: a train is published as a prerelease,
   and `releases/latest` stays the previous release (the run warns when it does
   not). After the owner's smoke at a table, dispatch it again with the tag and
   `promote` ticked: no build, the release edited to latest, and the run warns
   when `releases/latest` is not the tag. The two inputs together are refused.
9. Numbering: decision D20 (one stage, one `1.2.X`) was retired by O1 on
   15.10.2026. Each train of the 1.3.0 plan ships as the next `1.2.X`; the last
   ships as `1.3.0` "Stained Update". After it, `1.3.X` is balance and fixes. The 1.3.0 notes say what of the text rework the
   `1.2.43`-`1.2.47` notes promised with it went in, and what did not.

