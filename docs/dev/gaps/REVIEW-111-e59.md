# Review for 1.2.111: the release tooling of E59 C5a and C5b

Read and run, 13.11.2026; neither line changed. C5a at 68bc5f3e (module.zip without macros/ and icons/pixel-sprite.svg,
the `package` part of tools/check.mjs, port-glass.py removed), C5b at c066123e (CHANGELOG.md and tools/changelog.mjs,
audit/gate/ci-record.mjs, the issue and PR templates, the `stamps` part's version rows). Both on 421f2395, origin/main
today. Every reading below was run in a separate checkout of each line in this container; each plant was put back and
`git status` read clean after it. Severity: **blocking** (a package that does not load, a secret asked for), **minor** (a
check narrower than what it is relied on for), **note** (worth knowing, no change asked).

## Merge

`git merge-tree --write-tree` of C5a with C5b, and of each with origin/main: no conflict (all three on base 421f2395).
On the two merged (a scratch commit, not pushed): `node tools/check.mjs package stamps notes` all green, and
`git archive --format=zip HEAD` gives 276 files, none of them CHANGELOG.md, macros/ or icons/pixel-sprite.svg.

## 1. The zip release.yml builds

Built with release.yml's own step (.github/workflows/release.yml:205, `git archive --format=zip -o module.zip HEAD`) on
each line: C5a 276 entries, about 8460 KB; C5b 283 entries, about 8496 KB; the two merged 276.

**Checked, nothing found.**

- Every path the shipped files name is in the merged zip: module.json's esmodules, styles and languages; every
  `import`/`import()` of `./x.mjs` in a non-test script; every `modules/<id>/...` asset written out in a script; every
  `url(...)` in styles/*.css. 234 paths, none missing (the two fonts named with `?v=2`, `?v=3` are there without the
  query).
- What C5a and C5b leave out (macros/, 5 files; icons/pixel-sprite.svg; CHANGELOG.md) has no reader at a table: only
  comments and tests name them, and the tests that read the sprite ask `needs(env.tools())` first (R3333,
  scripts/tests-tier0.mjs:707-717).
- release.yml and audit/gate/verify-gate.mjs read the checkout, not the zip (release.yml:157 verify-gate, :197
  `check.mjs stamps notes --release`, :212-218 the module.json rewrite), so nothing they read can be lost to an
  export rule.
- Limit of this reading: a path built from a variable alone is not seen by it. scripts/diagnostics.mjs:1165
  (`fetch(\`modules/${MODULE_ID}/${file}\`)`) fetches the files `loadedFiles()` lists: the scripts crawled from
  module.mjs's imports, and module.json's styles and languages (diagnostics.mjs:1095-1125), all of them in the list
  above.

## 2. `package` does not go red when a needed file is excluded

**minor.** tools/check.mjs:708 `packageProblems` (C5a) holds the archive to two rules, both about what ships: the top
level is PACKAGE_TOP's (:663), and every shipped file has a reader. Nothing holds the other direction - a file a reader
names that the archive left out. Planted, each alone, in the working tree's .gitattributes (the part reads it with
`--worktree-attributes`, :742), then put back:

| Planted | `node tools/check.mjs package` |
| --- | --- |
| nothing | 269 file(s), 0 problem(s), self-check 4/4 |
| `lang/pl.json export-ignore` | 0 problem(s), all green |
| `scripts/ui-kit.mjs export-ignore` | 0 problem(s), all green |
| `fonts/ export-ignore` | 0 problem(s), all green |

Each of those is a zip that does not load or draws without its fonts, so the coordinator's expectation that the part
"goes red when a needed file is excluded" does not hold today. The header (:648-662) does not claim it either: it says
"the package ships what a table reads" and then lists only the two rules above. Patch: a third rule in
`packageProblems`, given the tracked files beside the archive's -
- every path module.json names (esmodules, styles, languages' `path`) is in the archive;
- every `import`/`import()` of `./x.mjs` in a shipped non-test script names a shipped script;
- every literal pattern a reader names that matches a tracked file matches a shipped one (a reader naming a file the
  tree has and the zip lacks).
And three more planted faults for the self-check (an excluded language file, script and font folder), so it reads 7/7.

**note.** The part reads the working tree's .gitattributes (`--worktree-attributes`, :742); release.yml:205 reads the
committed one. On a clean checkout, as in CI and release, they are the same file; locally, an uncommitted export rule
is judged before it is committed, as the header says. Worth knowing when a local green is read as the zip's.

## 3. CHANGELOG.md and tools/changelog.mjs (C5b)

**Checked, nothing found.**

- Idempotent: `node tools/changelog.mjs --write` twice on c066123e; the committed file, the first write and the second
  are byte for byte the same (`cmp`), and `git status` clean; 94 releases each time.
- Matches the notes: for each of the 94 `.github/release-notes/v*.md`, CHANGELOG.md has its line, and for every file
  opening with a `# ` heading the line holds that heading less its `<version> - ` (0 differ). The older notes that open
  with a sentence take that sentence (tools/changelog.mjs:26-35), as its header says.
- The check holds it: `node tools/check.mjs notes` green on the line; red ("CHANGELOG.md is not what
  tools/changelog.mjs writes ... run `--write`") with v1.2.109.md's first heading changed by one word, and again with a
  95th notes file added; both put back.
- CHANGELOG.md is export-ignored (C5b .gitattributes:10), and the zip has no CHANGELOG.md.

## 4. The templates (C5b)

None asks for a secret, a password, a licence key or a host name: .github/ISSUE_TEMPLATE/bug-report.md,
table-report.md and .github/pull_request_template.md read whole. The PR template asks for runs and ids only.

**minor - what the pasted report carries is not said.** Both issue templates ask for the text of `game.drpg.diagnose()`
pasted into a public issue (bug-report.md:27, table-report.md:31). Read from the code, that text holds the Foundry user
name and the time (scripts/diagnostics.mjs:2150, `reportHeader`), the world's id (:1289, in the GM stores part, GM's
report only), and, in "Failures since this page loaded", each failure's whole stack (:2096). A stack line names the
script's full URL with the page's origin: measured in this container's Chromium, an `Error().stack` thrown from a module
script reads `at f (http://localhost:8771/modules/danganronpa-rpg/scripts/a.mjs:1:29)`. So a hosted world's address
reaches the issue whenever anything has failed. No secret (the LiveKit part prints only a warning key,
diagnostics.mjs:1364-1365), but a host name the template does not mention. Patch, one sentence under each "Paste it
here": "The report names your Foundry user, your world and, in its failures, your server's address: change them to
something else before you paste if you would rather not show them." `fileSizes()`, which prints `Host:` outright
(diagnostics.mjs:1159), is not a part of the report (REPORT_SECTIONS, :2115), so it does not add to this.

## 5. The version rows in `stamps` (C5b, d0b1ecf4)

**minor, a question for the owner - the check makes README.md change outside its version line.** tools/check.mjs:300
`COMPAT_FILES` puts README.md beside the two GM handbooks, and `compatibilityProblems` (:302) holds README's "Foundry VTT"
and "Daggerheart" rows (README.md:228-229) to module.json's `compatibility.minimum` and `.verified` and to the
Daggerheart relationship's. Planted: module.json's Foundry verified 14.365 -> 14.366 and Daggerheart's 2.6.5 -> 2.12.9,
then put back. `node tools/check.mjs stamps` went red with 6 problems, two of them README.md:228 and README.md:229. So
any release that measures a new Foundry or Daggerheart build, and writes it in module.json, cannot pass `stamps` (run by
release.yml:197) without editing those two README rows. With the owner's rule that the root README changes only in its
version line (README.md:208, "They describe version 1.2.109."), that is a second line the check forces. Two ways out,
the owner's to pick:
- take README.md out of `COMPAT_FILES` (keep the two handbooks, which the rule does not cover), and say beside it why;
- or the owner widens the rule to "the version line and the needs table's two version rows".

**note.** module.json says Daggerheart verified 2.6.5 (and so do the six rows), while the table runs 2.12.8 and 1.2.109's
notes title says "on Daggerheart 2.12 the GM draws the players' rolls again". Not this line's to change; worth one look
before 1.2.111's module.json is written, since with this check the README follows whatever is set there.

**Checked, nothing found**: the version line itself is held as before (`README.md "describe version X."`, 8/8 places
agree); the planted table's self-check sees its 3 faults; a markdown link in a row (`[Daggerheart (Foundryborne)](...)`)
is stripped before the numbers are read, so the link's URL gives none.

## Not done here

- No `npm test`, no CI run of either line; the parts named above and release.yml's archive step only.
- audit/gate/ci-record.mjs read for what it reads and writes, not run (it spawns the whole of run-all.mjs).
- port-glass.py's removal: `git grep port-glass` on C5a finds only the 1.2.15 release notes (line 26, history) and
  docs/design/glass-recipe.js:3, whose new header says the tool is gone; no code reads it. Not run.
