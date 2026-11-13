# Review for 1.2.111: the r3551 line and the project-token-icon line

Read only, 13.11.2026; neither line changed. Each read against its merge base with origin/main (421f2395, the same for
both). Each finding traced from a caller or an input to what goes wrong, with a proposed patch. Severity: **blocking**
(a wrong result, a player shown what is not theirs, a parity break), **minor** (a test or check narrower than what it
guards, a comment that no longer matches), **note** (worth knowing, no change asked).

## 1. The r3551 line (1a59c409: "The wrench window's fields carry their names (R3920)")

What it does: in Daggerheart's character settings window (the wrench), which R3551 dresses as the module's own
(`drpg-panel`), each `.form-group`'s field with no name of its own takes its label's words (`nameFormGroups`,
dh-settings.mjs:182), and each statistic's field takes the words of the statistic's name (`markStatistics`,
dh-settings.mjs:207). R3920 (tier 1) holds that on the suite's stand-in.

### The tier-2 failure: fixed, measured

`node run-tests.mjs --tier 2 --only R3551 --only "every control in the module's own chrome"` in audit/harness, on a
checkout of each (13.11.2026, this container):

| Checkout | R3551 | every control in the module's own chrome has a name to be read out | totals |
| --- | --- | --- | --- |
| main, 421f2395 | ok | **FAIL**: "1 control kinds carry no name a screen reader can read: input in r3551-character-..., `<input type="text" data-dtype="Number" name="system.traits.instinct.value" value="1">`" | 5 passed, 1 failed |
| r3551, 1a59c409 | ok | ok | 6 passed, 0 failed |

The path on main: R3551 draws the wrench window over a character and leaves it dressed as `drpg-panel`; the chrome test's
sweep (a11y.mjs `nameControls`, over every `.drpg-panel`) reaches the statistic's field, whose name stands in a span
beside it and not in a label, and reports it. The branch names it. R3920's red is real too: run on main's
dh-settings.mjs (the branch's test, the file swapped for the run and put back), it read both statistics' fields unnamed
(`traits: [["system.traits.instinct.value", false], ["system.traits.knowledge.value", false]]`).

### Findings

**minor - R3920 reads fewer fields than the check it stands for.** scripts/tests-tier1.mjs:51024
`controls = [...content.querySelectorAll(A.CONTROLS)].filter(el => !el.closest("[hidden]"))`. The tier-2 test it was
written for reads every control of a `.drpg-panel`, hidden or not: a11y.mjs `nameControls` has no visibility filter
(it walks `host.querySelectorAll(CONTROLS)`), and the branch's own comment says so (dh-settings.mjs:179, "the sweep
reads every field in the window, shown or not"). Path: a later change to `nameFormGroups` that names only the fields it
can see, or a Daggerheart that moves the three hidden fields (scars, proficiency, evasion) out of `.form-group`, leaves
them unnamed; R3920 stays green, and the tier-2 chrome test goes red again whenever R3551 runs before it (the local gate
only: CI deals tier 2 into other shards, which is why this was found late). Patch: drop the filter, or keep it and add
the hidden cells' fields as a second reading - `unnamedHidden: [...content.querySelectorAll(A.CONTROLS)].filter(el =>
el.closest("[hidden]") && !named(el))`, expected `[]`.

**note - "Since E64".** docs/dev/R-REGISTRY.md:1270, R3920 stamped `E64` by `--write` (the first stage not shipped); the
line is not E64's. Set it by hand to the release that carries it (1.2.111), as the float-text line did for R4670-R4672.
R3920 is used on no other branch (all remotes' R-REGISTRY.md read).

**Checked, nothing found**: `nameFormGroups` keeps a field's own name (an `aria-label` or a `<label for>`); it runs after
`wordCharacterSettings`, so a name is the module's word where WINDOW_WORDS has one, in the page's language, and needs no
new key (no lang file changed); `markStatistics` names from the span's text, which holds no glyph text (the glyph is a
masked, `aria-hidden` element); the a11y sweep marks a control it has named (`data-drpg-named`), and the dress runs on
the window's render before the sweep (dh-settings.mjs registers at init, a11y.mjs at ready).

## 2. The project-token-icon line (fa9afa49 on 1de23ada, 5f074c16)

What fa9afa49 adds over what docs/dev/PERF-OPEN/REVIEW-111.md section 1 read: the three minors of that review answered -
a flag on the token, `projectIconWritten`, records the picture the module last wrote, and the sync moves only that
picture, the hammer or the hazard sign (`wearsModuleIcon`, projects-map.mjs:259-266), so a GM's own glyph file stays;
the tier-2 test puts `icons/svg/mystery-man.svg` (Foundry's own) instead of a path no server has; `iconProblems` reports
an empty set (tools/token-icons.mjs:131) and the `icons` check part holds that with a control.

### Measured

- In audit/harness on a checkout of the branch: `node run-tests.mjs --tier 2 --only "project's token" --only "project
  token" --only "project's spare copy" --only "orphan is no player's project" --only R4700`: 18 tests ran, 22 passed,
  0 failed - every project-token test of tiers 0-2 by those names, the two of this line among them, so the second flag on
  the token breaks none of them.
- `node tools/check.mjs icons`: "31 file(s) the token-icons tool owns; 0 problem(s); the empty set reported". With the
  empty-set line planted away (tools/token-icons.mjs:131 made `false &&`, put back after): "red: icons", "the check answers
  no problem for an empty set of pictures". The control sees its fault.

### Findings

**minor - the header's account of what the token carries is out of date.** scripts/projects-map.mjs:18-21: "the token
carries a neutral name, one countdown id and, since 13.11.2026, the picture of the project's chosen glyph ... and nothing
else". Since fa9afa49 it carries a second flag, `projectIconWritten` (projects-map.mjs:76, written at :331 and :508).
The header is "the whole security of the feature" by its own words, so it is the line a later reader trusts first.
Patch: "...the picture of the project's chosen glyph, and the path of that picture again in a flag of its own
(`PROJECT_ICON_FLAG`, the picture the module last wrote, so the sync knows a GM's own from its own), and nothing else".

**note - D2: no new road.** The flag's value is the token's own `texture.src` as the module wrote it, which every
browser on the scene already reads off the texture; the glyph behind it is `projectMeta.<id>.glyph`, a world setting
(section 1 of the PERF-OPEN review). world-secrets.mjs `WORLD_SECRET_RULES` is a list of what may not stand in world
data, so a flag that holds nothing secret needs no rule (R9 and 72-canary read against the list).

**note - a token placed by 1de23ada or 5f074c16 and not yet synced.** Such a token wears a glyph's file with no flag, so
`wearsModuleIcon` reads it as a GM's own and a later glyph change leaves it. Both commits are on this line only (no
release carries them), so only a world played on the branch between them has one; no change asked, worth a line in
the line's STATUS if a tester's world did.

**Checked, nothing found**: the flag is written with the picture in the one update (`changes` at :506-508) and at the
token's creation (:331), so the two cannot disagree after a write of the module's; a project with no glyph wears the
hammer, which `wearsModuleIcon` always counts as the module's, so a glyph set later reaches it; `box` and `lock`, the
glyphs the tier-2 test uses, are keys of PROJECT_GLYPHS (config.mjs:2875).
