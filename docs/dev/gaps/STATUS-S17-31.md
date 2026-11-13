# STATUS - known leak S17-31 (a secret project's name and who is in on it)

The coordinator's task of 12.11.2026: close known leak S17-31, severity high, class killer-identity. It had no stage (it
was E43's, which is out of the plan). Built on `claude/e93` (this session pushes there alone), its commits labelled
"S17-31". Target release 1.2.112.

## The leak, as measured

Daggerheart's world setting `Countdowns` reaches every browser. A secret project's countdown carried its **name** and an
**ownership map with each player's own level**: OBSERVER for the players in on it, NONE for the rest
(projects-secrecy.mjs `ownershipMap`). So any console read the plan's name and, for an indirect murder, which player
built it - the killer's player. The known-leaks row named the name only; the map was the wider half.

Red first, both at 4eef965 (the tree before the fix):
- scenario 72-canary, new check "p1 and p2: Daggerheart's Countdowns holds the secret project's row with neither its name
  nor an ownership map that tells one player apart": FAIL - `{"p1":{"row":true,"named":true,"owners":["USERP30000000000"]},
  "p2":{...same}}` (p3 is the killer's player);
- tier 2 "S17-31-T1": a secret project shared with one player held its name and that player's OBSERVER entry in the
  setting.

## The design, and why

**Picked: the secret project stays in `Countdowns`, its countdown carries no name and tells no player apart.** The
countdown's name is `HIDDEN_NAME` ("???"); its map gives every player one level, OBSERVER, `default` NONE. Daggerheart
reads each player's own entry and not `default` (the module's own note, F4), so it draws the row for every player; the
module's tray already takes out a row its reader may not know (projects-tray.mjs `hideUndiscovered`, matched by the row's
`data-countdown` id) and now writes the real name back on the row for a GM or a player in on it (`nameSecretRows`). The
real name and the list of players in on it are the GMs' store's (`projectSecrets`: `secretName`, `viewers`). A player in
on it learns both by the road the description already takes: a veiled private card to them alone (projects.mjs
`tellSight`, read on their browser by projects-secrecy.mjs `toldSight`), sent after every change of the project; one let
out is sent `in: false`.

Fewer moving parts than the two alternatives:
- GM-only ownership (`default` NONE, no entries): Daggerheart would draw no row for the players in on it, and the module
  would have to build tray rows itself (markup, progress, controls).
- Secret projects out of `Countdowns` entirely: every project road (progress, sabotage, repairs, the one change queue,
  Daggerheart's automation) would need a second path.

The change is concentrated in the one change step (projects.mjs `changeStep`): a project that is secret once a change is
made is written with `HIDDEN_NAME` and the one-level map, its name routed to the store; a reveal takes the name back. The
readers go through `canSee`, `viewersOf`, `insidersOf` and `allProjects` (`shownName`), which read the store on a GM and
the card on a player's browser.

## What each reader sees, before and after

| Who | Before | After |
| --- | --- | --- |
| A player not in on a secret project | no row in the tray (ownership NONE); its name and the insider readable in the console | no row in the tray (the module takes it out); the console reads "???" and a map that names nobody |
| A player in on it | the row with its name (ownership) | the row with its name (written back from their card) |
| A GM | the name in the tray and every window | the same in the module's tray and windows; **Daggerheart's own countdown window shows "???"** |
| Anyone | that a countdown exists and its progress numbers | unchanged (projectMeta already marks it secret) |

For a GM: renaming a secret project in Daggerheart's own countdown window would write its name back into the setting.
The GM handbook says so (section 14's "What lives only in GM browsers", EN and PL): rename it in the project manager.

## With E92's Spectator (main 1.2.109, merged first)

E92 (the owner's DRPG-D1 of 12.11.2026, "Widzi wszystkie projekty w tym prywatne") gave a Spectator's account OBSERVER on
every secret countdown and let it through `canSee`. Merged with S17-31 as the coordinator decided (13.11.2026, option a):
`canSee` keeps E92's Spectator check first; `ownershipMap` has no Spectator list of its own any more (every player,
Spectators among them, is at OBSERVER); `viewersOf` and `sharedIds` read the GMs' store, which never lists a Spectator
(the old map's read leaves them out too); and `tellSight` sends a Spectator the name alone, `{ in: false, name }` - it
sees every project without being in on any - while the description and room-action cards stay withheld from it, as E92
has them. `seeAsSpectators` asks `tellSight` of every secret project after a role change, since a lifted project reseals
to nothing. Owner question, default taken by the coordinator: a Spectator's browser may hold a secret project's name, by
card (before S17-31 it did, through Countdowns). R3867 (E92's) now expects every player at OBSERVER in the map.

Order on `claude/e93`: the merge of main 1.2.109 (a1479e95), the train's eight bridge rows taking E92's Spectator guard
(0fbe2440, R3865), then S17-31 in its own commit.

## Migration

`migrate.mjs` clause `hideSecretProjects`, since 1.2.112, on the primary: every secret project is resealed through the
change entry (`resealSecretProjects`), whose step lifts an older seal - the name into `secretName`, the players its old
map let in into `viewers`, the countdown left with `HIDDEN_NAME` and one level - and `tellSight` then tells each player in
on it. Idempotent: a lifted project reseals to nothing. The boot's secrecy pass does the same at every load; the clause
reports the count once.

## Tests, red and green

| Test | Red | Green |
| --- | --- | --- |
| scenario 72, the Countdowns check above | 4eef965: name and p3's entry on p1 and p2 | 133/136, its 3 other expected reds (Foundry limits), 0 failed - with the known-leaks row S17-31 **removed** |
| tier 2 "S17-31-T1" (name, map, the GMs' reading, a reveal) | 4eef965 | green |
| tier 2 "S17-31-T2" (the clause lifts an old seal once; a second run changes nothing; the insider told) | the clause renamed away: nothing lifted | green |
| tier 1 R4620 (`ownershipMap` gives every player one level, names no GM; `HIDDEN_NAME` names nothing) | the old body of `ownershipMap` put back on the fixed tree: levels [OBSERVER, NONE] (4eef965's whole file does not load with the fix's importers) | green |

Changed on purpose by the fix, each with its reason in the test: E36-T4 (a share and a revoke write no countdown), E36-T11
(the window's Save of a secret project writes no countdown), R3510 (two more lines from `tellSight`), R9 and R190 (the
world-secrets list and its fixtures name `secretName` and `viewers`). Two scenario checks read p1's NONE in a secret
countdown's map and now read that the map tells p1 apart from nobody, and that p1's `canSee` is false: 30-security's
"a secret project's repair reaches p1 under no name of the project" and 93-spectator's "the Spectator knows every
project in a room nobody found" (E92's, `own.p1` 0 -> 2).

Found by the suite and fixed in the same work:
- a secret repair's end card named its target by the countdown's raw name ("???" after the fix): it reads the GMs' name
  (`shownName`) - the test "a secret project's repair keeps the secret";
- a share or a revoke no longer runs the token visibility pass (it relied on the countdown's change): the arrival of a
  sight card runs it, as a found project's card does - E36-T6.

## Open, with a default taken

- **The neutral name "???"**: no letters, the same in both languages. Owner may prefer a word (it would then be one
  language in the world setting).
- **Daggerheart's own countdown window** shows "???" to a GM; renaming there writes the name back. Handbook warns; not
  guarded in code (the window is Daggerheart's).
- **A player who joins the world after a project was sealed** has no entry in its map until the next reseal (the boot's
  secrecy pass runs at load and on `createUser`), so Daggerheart draws them no row meanwhile - the same as before the fix.
- Read in code, not run at a table: Daggerheart drawing the row for an OBSERVER entry (the module's F4 note); the card
  reaching an insider who is offline (it waits in the chat log, as the description's card does).

## Notes for the release (to be placed by the coordinator)

- **A secret project's name and who is in on it are no longer in Daggerheart's Countdowns** (known leak S17-31,
  killer-identity, high). Its countdown carries "???" and the same access for every player; the GMs keep the name and
  the list, and a player in on it learns the name on a private card, so the tray looks as before. Daggerheart's own
  countdown window shows "???" for a secret project: rename it in the project manager. A migration lifts every secret
  project of an existing world once (`hideSecretProjects`).
