# leak-pm: a secret project's murder mark and room leave world data (1.2.113)

The line's status file (14.11.2026). Branch `claude/leak-pm-113` from `claude/fervent-sagan-gme4vt` at 123f8242.
The finding is E59's (`docs/dev/e59/LEAK-PROJECT-MARK.md` on `claude/e59-113`, tip 0ba8eaf1); every number below was
measured on this branch, headless, on 4 cores, unless it says otherwise.

## What a player's browser read, and reads now

| Field | Before (123f8242) | Now |
| --- | --- | --- |
| `projectMeta.<id>.indirectMurder` of a secret murder | on every browser: `{"row":true,"murder":true}` on p1 and p2 (72-canary) | the GMs' row (`projectSecrets`); the players in on it and the Spectators get `murder` on their sight copy (`projectSight`); p1 and p2 read `"absent"` |
| `projectMeta.<id>.room` of a secret project with no token | on every browser: `"room":"Storage","token":null` on p1 and p2 (72-canary, a secret project whose token the GM deleted, `mapHidden`) - the case E59 did not measure | the GMs' row; insiders and Spectators get `room` on their sight copy; p1 and p2 read `null` |
| `projectMeta.<id>.room` of a secret project with a token | the room, and the token at (2400, 1400), not hidden | the meta names no room; the token's position still tells it (known leak `foundry-hidden-tokens`, a Foundry limit) |

## The items of the brief

| # | Item | State | Where it is answered |
| --- | --- | --- | --- |
| 1 | 72-canary checks red first, then green | done | a63c6984: the mark check and the no-token room check `expectedRed` (E54), red measured (136 passed, 5 expected red, 0 failed of 141); the room check restated as "the meta names no room the project's token does not already tell", green at 123f8242 too (the token tells it). df3d602a: both markers off, both green |
| 1b | the case "a secret project with a room and no token" | done, and it was a leak | measured red at a63c6984 (above); fixed the same way: `room` is the GMs' while secret |
| 2a | `indirectMurder` (and `room`) in `PROJECT_SECRET_WHILE_SECRET`, world-secrets' `whileSecret`, tier 0's equality | done | projects-secrecy.mjs, world-secrets.mjs; tier 0's equality test reads both lists and passes; R190's clean fixture no longer holds the two fields on a secret row, and plants each |
| 2b | `isIndirectMurder` reads the meta, else `secretsOf`, else the sight; `sightFor` gives `murder: true`; every direct reader through it | done | projects.mjs `isIndirectMurder`, `roomOf`, `sightExtras`, `sightFor`, `tellSight` (a change of the mark or the room is told again), `receiveSight`; the trap's completion row (`has: (meta, id) => ... isIndirectMurder(id)`), `announceProjectDone` (its `meta` is both halves, the step's snapshot, so it reads the mark as before), traps.mjs `trapProjects` (the mark and the trap's room through projects.mjs) and the plant window; fog.mjs's room rename |
| 2c | the killer's browser reads as before | done, measured for the two readers every killer-side reader goes through | 72-canary "p3 (the killer's player) reads its plan as an indirect murder in Storage, off its sight; p1 reads neither": p3 `{"murder":true,"room":"Storage","row":[true,"Storage"]}` here and at 123f8242 (the current harness against the base, `DRPG_REPO`); p1 `[false,null]` here, `[true,"Storage"]` at 123f8242. The readers on a player's browser and what they read: action-project.mjs `performProject` (`isIndirectMurder`: the concealment), `projectExtrasHeld` (`isIndirectMurder`), `sabotageWatchedLine` (`isSecret` first, so unchanged), call-effects.mjs's Hope Call traces (`isIndirectMurder`), facilities.mjs `projectActionsWith` (`allProjects().indirectMurder`), action-briefing.mjs (see "Found, not changed"), the lists built on `allProjects()` and `roomOf` (`projectsListedIn`, `standsAtProject`). projects-ui.mjs, projects-map.mjs's card branch, murder-ui.mjs and traps.mjs run on a GM, which reads the GMs' row |
| 2d | migrate.mjs: the lift, read back before it removes, tier 2 with the save swallowed | done | clause `liftSecretProjectMarks` since 1.2.113 (R178's list), projects-secrecy.mjs `liftSecretProjectMarks`, then `retellSights`; tier 2 `leak-pm-T1` (moves, reads back, keeps a public project's, second run null) and `leak-pm-T2` (the save swallowed: projectMeta as it was, throws "2 field(s) ... (2 ..."); both red on 123f8242's code ("P.liftSecretProjectMarks is not a function"; "the swallowed save left no row in memory either") |
| 3 | the health check counts the secret countdowns with no store row | done | gm-stores.mjs `gmStoreHealth`: the ids of projectMeta and the Countdowns that `isSecret` holds, those with no row; `DRPG.Case.row.projectSecrets` rewritten in both languages; the tier 2 test "the case health check names a secret project and a note this browser does not hold ..." plants `{ secret: true }` rows; red on 123f8242's code (counted 0 of 0), green here |
| - | the token sync on a GM whose rows have not arrived | added | projects-map.mjs `syncOneProjectToken`: a secret project's token is not taken off the map for "no room" while `projectSecretStore.isHydrated()` is false - before the GMs' copies are here, the room reads null |
| - | GM handbook, "What every browser holds anyway" | added, both languages | one item: where a secret project's token stands tells its room, but since 1.2.113 not the room of one with no token, nor whether it is an indirect murder |

## Tests

See "Final numbers" at the end of this file.

## Security lens: every road a player's console reads the mark or the room through

Read on this diff and the code it touches; the measured ones say so.

| Road | Before | After |
| --- | --- | --- |
| the world setting `projectMeta` | the mark of every secret murder; the room of every secret project (measured, 72-canary) | neither, for a project made or changed on 1.2.113 (measured), and for an older world once the clause has run on the primary (tier 2 `leak-pm-T1`); until the primary GM loads 1.2.113 an older world's rows still hold both |
| `allProjects()` on a bystander's browser (it reads every countdown, secret or not) | `indirectMurder: true`, `room` | `false`, `null` (measured on p1) |
| the sight copy (`projectSight`, a client setting of the user it is sent to) | the name and `in` | plus `murder` and `room`; sent by the primary to the players in on the project and the Spectators alone (`sightFor` filters by `insidersOf` and `spectatorUserIds`), addressed (`recipients: [userId]`), and taken only from a GM, addressed to this user (`onSightSocket`) - a console can ask for its own sight, never another's |
| the GMs' store (`projectSecrets`) | the GMs' | the GMs': a GM's browser only, the exchange between GMs |
| the project's token | its position and its picture (the glyph, the owner's accepted trade-off of 13.11.2026) | unchanged: the position tells the room (`foundry-hidden-tokens`); a GM who picks a murder-looking glyph tells the kind by the picture, as before |
| Daggerheart's Countdowns | that a secret project exists ("???"), its progress, its default picture | unchanged; nothing of the mark or the room is there (the countdown's `img` is the caller's or the hourglass) |
| a sabotage watched, a Work's lines, the trap's receipt | the sabotage line names no secret project (`isSecret` first); the receipt is a veiled card to the killer's player | unchanged |
| what is not measured | | a secret murder's shape - its target size, its trait - may differ from other secret projects' and so hint at one; not read here. The players' copies written before 1.2.113 hold no `murder` or `room` until the primary GM sends them again (the clause's `retellSights`, or any change of the project) |

Verdict: no road found by which a player's console reads the mark, or the room of a secret project with no token,
after this diff, but the two in the last row.

## Found, not changed

- action-briefing.mjs:304 calls `isIndirectMurder(p)` with a project row, not an id, so it reads `projectMeta()[row]` and
  is always false: Move's briefing never shows `DRPG.Action.dcIndirect`. Before this line and after it the same
  (`isIndirectMurder` reads the meta by the row as a key, then `isSecret(row)`, false). Not changed here: it changes what
  the killer's browser shows, which the brief asked to keep. A one-word fix (`p.id`) for whoever owns the briefing.
- The GM handbook's item on Daggerheart's Countdowns still says they carry a secret project's name and who may see it,
  and that "this version does not move them"; S17-31 (1.2.111) moved both. Not this line's text to change.

## Questions for the owner (each with the default this line took)

- **Q-PM-1** - Does a Spectator's sight row carry `murder` and `room`? Default: yes, as DRPG-D1 gives a Spectator every
  secret project (the coordinator's default, 14.11.2026). Not measured in a scenario: 72-canary has no Spectator.
- **Q-PM-2** - The health check's row: the secret projects with no store row (the default), or a count-only mark of the
  murders kept in world data? Default: the secret projects; it no longer says how many of them are murders.
- **Q-PM-3** - A secret project's room is the GMs' now too, which E59 did not propose (it measured only the token case).
  Default: yes, because the no-token case was measured red. If the owner would rather keep the room public, the
  no-token case is a known leak to register.

## Needs a local Foundry

- LIVE: the clause `liftSecretProjectMarks` on a real v14 world from before 1.2.113 with a secret murder: the primary
  loads, the clause runs, a player's console reads `game.settings.get("danganronpa-rpg", "projectMeta")` and finds no
  `indirectMurder` and no `room` on the secret rows, and the killer's player still sees the trap's row in its room in
  the tray. Needs a v14 sandbox, a GM and two players.
- LIVE: a fresh GM browser as the primary (no local store) loading a world with a secret project on the map: the token
  stays (the hydration guard), and is not removed and placed again. Needs a v14 server and two GM accounts.

## Notes sentence for 1.2.113 (draft)

Until 1.2.113 any player's browser held, in the module's world data, which secret project is an indirect murder, and
the room of a secret project whose token is not on the map; both are now kept by the GMs and sent only to the players
in on the project and to Spectators. (Where a project's token stands still shows its room to every browser.)

## Final numbers (14.11.2026, headless, 4 cores; code as at 0baa48b1 - the commit after it changes this file alone)

| Run | Result |
| --- | --- |
| tiers 0-1, `node run-tests.mjs --tier 1` | 1595 passed, 1 failed, 16 skipped, 0 red; 1611 tests, 531 s. The failure is R2001 (stale "row 1.2.N" quotes), the base's known red |
| tier 2, `--only "leak-pm-T" --only "the case health check names" --only "S17-31-T" --only "project secrets' lift" --only "R1351"` | 13 passed, 0 failed, 0 skipped, 0 red (9 tests) |
| 72-canary | 139 passed, 3 expected red (foundry-hidden-tokens, foundry-actor-items, S17-64: Foundry limits), 0 failed of 142 |
| 30-security | 301 passed, 2 expected red, 0 failed of 303 |
| 61-gmstore-case | 113 passed, 0 expected red, 1 failed of 114: Z2, whose check looks for "2 traces on the map" where `DRPG.Case.row.traces` says "2 Remnants on the map". The same at 123f8242, measured (the harness against the base, `DRPG_REPO`: 113/114, Z2 failed); not this line's text and not changed here |
| 62-investigation | 52 passed, 0 failed of 52 |
| 13-murder-signals, 33-bridge-paths, 40-flow, 95-tooltips-drawn (the scenarios that create an indirect murder) | 87/87; 88 passed, 1 expected red of 89; 89/89; 4/4 |
| `npm run quick` | green: lint 0 problems, check 21 parts green, gate 37/37 |
