# E71 line C: status

Line C of E71 (with E25's content part) on `claude/e71-c`, from `claude/fervent-sagan-gme4vt` at 1463f22b (14.11.2026).
Batches: B10a Vote/Trial/Floor, B10b Chapter/Monocub/Advance/MONOCUB, B11 Project/Trap, B12
Reroll/Bridge/Relay/Secret/Guard/Errors, B13 Safeword .. DAGGERHEART (+ Notices, Popup). R numbers: R6500-R6549.

## C0: census (re-measured on 1463f22b)

Read with `node tools/text-map.mjs` (237 scripts, 159 screens, 62 by SCREENS; keys 6855: 6448 assigned, 407
unassigned) and `git blame` of `lang/en.json` on the unshallowed history, the texts-e71 early pass commits ignored
(33 commits, "E71 early pass", "E71/E25 early pass", "E25 early pass"), so a key's origin is the stage that wrote it,
not the sweep that last touched it. Per key: `docs/dev/e71/census-C.json`.

**Which namespaces are line C's.** The coordinator's binding map of 14.11.2026 (it replaces B13's range "Safeword ..
DAGGERHEART", which is not a run of en.json's order, and a map this line first built from the screen map's majority):
the batches' own lists, and Monokuma, Spectator, Class, Redacted, Enforced, Users, Messenger, Note, Rules, Legacy,
Dialog, Handbooks, Audit, TrialScene and GAME. Placed in batches by their screens: Monokuma in B10b; Audit, Class,
Redacted, Enforced, Users, Messenger, Note in B12; Spectator, Rules, Legacy, Dialog, Handbooks, GAME in B13.

| Batch | Namespaces | Key families | full | check | frozen |
| --- | --- | --- | --- | --- | --- |
| B10a | Vote, Trial, Floor, TrialScene | 457 | 394 | 62 | 1 |
| B10b | Chapter, Monocub, Advance, Monokuma (and the 18 keys of MONOCUB's config prose, full) | 326 | 183 | 139 | 4 |
| B11 | Project, Trap | 250 | 223 | 27 | 0 |
| B12 | Reroll, Bridge, Relay, Secret, Guard, Errors, Audit, Class, Messenger, Note, Redacted, Enforced, Users | 435 | 354 | 81 | 0 |
| B13 | Safeword, Notices, Popup, Legacy, Spectator, Rules, Dialog, Handbooks, GAME, DAGGERHEART | 194 | 179 | 15 | 0 |
| all | | 1662 | 1333 | 324 | 5 |

A family is a key or a plural family (`.one`/`.other`, and in Polish `.few`/`.many`). `full`: written before E65
shipped (01.11.2026) or by E70 (the plan: E70's texts edited in full), edited in full (DX1 = 2). `check`: written by a
stage after E65 (E72, E73, E93, E99 and others), linted only (O12). `frozen`: a key `docs/dev/e71/FROZEN.md` freezes
for gaps-a; the coordinator released every other freeze on 14.11.2026 (its branches are in the base or will not merge),
so those keys are full or check by their origin.

**The lint on line C's keys before** (`node tools/check.mjs text --all` on 1463f22b, findings whose key is in the
namespaces above): T4 65, T5 333 (X4 264, X11 27, X3 22, X12 12, X13 3, X1 2, X10 2, X14 1; en 143, pl 190), T8 1,
T11 2, T17 11, T18 5, T19 5, T23 2, T27 1. T13 (literals, by file) on the files of these screens: monocub.mjs 44,
relay-guard.mjs 42, bridge-guards.mjs 18, trial-progress.mjs 13, projects.mjs 7, trial-floor.mjs 3, vote.mjs 2,
projects-ui.mjs 2, action-project.mjs 2, projects-map.mjs 1, chapter.mjs 1 (an E54 file: waits).

**Tooling.** The batch schema's Appendix C exclusions (BATCH_OUT) refuse every B10a key, and `BATCH_FILES` lists
B01a alone; line B owns that change (the coordinator, 14.11.2026). Until it lands, this line holds its batch files to
`batchSchema` from a scratch script.

## Batches

| Batch | State | Commit |
| --- | --- | --- |
| B10a | not started | |
| B10b | not started | |
| B11 | not started | |
| B12 | not started | |
| B13 | rewritten, reviewed (EN, cold EN, PL), folded, landed: 35 texts, 144 families kept (docs/dev/e71/kept-C.json) | this commit |

## Questions, with the default taken

| Id | Question | Default |
| --- | --- | --- |
| Q-C-2 | A batch's texts without the owner's verdict: land in lang/ now, or wait for the owner? | Land them (as texts-e71 did); `owner` stays null, the batch file is the owner's page |

## Needs a local Foundry

- Screenshots of each window batch (EN and PL, both themes, three sizes): the harness draws no layout; not taken here.
