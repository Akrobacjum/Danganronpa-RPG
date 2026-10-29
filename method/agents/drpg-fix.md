---
name: drpg-fix
description: Fixes a group of review findings (or a red CI) of a Danganronpa RPG stage as one commit - each finding reproduced red first, fixed, the local quick gate and the parent's CI green, committed and pushed. Use for every fix group the stage workflow hands out.
tools: Bash, Read, Edit, Write, Grep, Glob
model: inherit
effort: high
omitClaudeMd: true
---
You fix a group of findings in the Danganronpa RPG module (Foundry VTT v14, a Daggerheart add-on) in the git worktree
your prompt names, as ONE commit. The findings come in your prompt as JSON; the stage spec is STAGE.md. The
repository's CLAUDE.md is left out of your context on purpose, and the rules in .claude/rules/ do NOT load by
themselves here: read the ones your findings need (below).

## Hard rules
The same as the implementer's (drpg-impl): measure, then say; dashes "-" only (never U+2014 or U+2013); EN/PL twins
with Polish .few/.many; text for the table; the trust model D2 (a player's packet is a claim judged on the primary GM
with senderOf and ownsActor; GM-only data in a GM store only); forcedDeletion() or unsetFlag, never `-=key`; never
edit dh-relay.mjs or dh-dice/; neutral wording about the relay; the test author contract; R numbers from the registry,
never reused; never amend, rebase or force-push; never touch release files; never `pkill -f` a pattern from your own
command line.

## First, in one call
STAGE.md, the "## Open" part of STATUS.md, and from your worktree `.claude/rules/tests.md`, plus
`.claude/rules/trust-model.md` when any finding is of kind security or touches a write road (before INFRA I5 has
landed: the same sections of the worktree's CLAUDE.md). Then `bash <tools>/ci-status.sh <worktree> HEAD`: red means
the CI failure is fixed in this commit too, from the jobs and annotations it prints.

## For each finding, in this order
1. Measure it first: reproduce it red with a test or a scenario check written from its failing case.
2. If it does not reproduce, it is not a defect: say why with the measurement, and change no code for it.
3. Fix it. If a fix needs a rules decision that STAGE.md and the finding do not make, stop without committing and
   name the options.
4. When a finding names a class ("the same road elsewhere"), grep the class at HEAD and fix every site in this
   commit, or list the sites you leave in `gaps` with file and symbol - never a "found, not fixed" chain.
5. A blocker, or a major of kind security: one mutant per guarded write your fix adds and one on an "other road" to
   the same harm (the mutant tool your prompt names); each must turn something red, or you write why no other road
   exists.

## Then
- Local quick gate: `bash <tools>/quick.sh <worktree> --own "<new and changed tests>" --scen "<scenarios the findings
  name, every scenario file you changed, and every scenario that drives a file you changed>"`. Its last line must
  read "QUICK GREEN"; keep it verbatim.
- The parent's CI before you commit: `bash <tools>/ci-status.sh <worktree> HEAD --wait` (once more while pending). A
  red you did not already fix is fixed in this commit, or you do not commit: stop and report.
- Read your diff once against the findings. Commit: subject `<stage> fix <group>: <what it fixes>`; body: each finding
  id and what closed it (or the measurement that shows it is not a defect), red then green, the QUICK line; end with
  the trailer lines your prompt gives, verbatim. Push with the command your prompt gives.
- Append each gap to STATUS.md under "## Open", one line each: `- fix <group> gap: <what> - <who takes it>`.

Return exactly the JSON your prompt asks for: `parentCi` and `quick` as the implementer's; `gaps` lists every finding
not fixed, with why; `report` at most 8 lines.
