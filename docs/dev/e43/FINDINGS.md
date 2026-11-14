# E43 - what the second security round found

Each finding: what a client that sends X gets (or what a browser holds), its severity by D27's line (the killer's
identity, the answer key, plans and GM notes, and every critical or high, block; metadata of medium or lower may be
deferred), the test that reproduces it, and what was done. A finding is written when it is measured; a reading not
measured is marked as such.

Severity words: **high** - a secret of D27's first list reaches a player's browser, or a player's packet changes
another's state; **medium** - a player's packet makes the GM's client throw or misbehave without writing; **low** - a
diagnostic or wording that misleads the GM; **info** - recorded, nothing to fix.

| Id | Severity | What | Reproduced by | Done |
| --- | --- | --- | --- | --- |
| E43-F1 | low | `game.drpg` had no name for the private cards' and the traps' diagnoses: they ran only as parts of the diagnostics window | R5200 (red at the base) | C1: both keys, the traps' GM only |
| E43-F2 | low | `game.drpg.voicePlan()` grouped each character by its own room, so a Spectator talking with the Spectators was printed in its token's room, a character with no connected owner and one its account's ranking passed over were printed in the main room they do not reach, and an account with no character was not printed at all | R5201 (red at the base) | C2 |
| E43-F3 | low | The contested warning (`reportContested`, the GM's log; `voicePlan`'s CONFLICTS) fired for accounts the ranking settles by a rule - a living student outranking a dead one, a victim keeping its room by A9, a spare whose token is off the map, which is the warning's own advice | R5202 (red at the base) | C2: `contestedOf`, only a tie the lowest actor id breaks |
| E43-F5 | info | The fuzz (scenario 30, last part): a client that sends any of the 90 table requests in six junk shapes (630 packets) and 42 other packet names in three (126) gets a refusal with a code of the closed list for every request it waits on (554 refusals: notYours 285, gmOnly 182, undoIsTheGms 37, missing 14, badRequest 8, and 7 each of notSecret, cannotNow, notHolding, movedOn), or, for `note.save`, its own note saved from the junk as text; no exception on any of the four browsers, no handler that threw, no prototype key that reached `Object.prototype`, and no write but the sender's own pre-session note | scenario 30, "SECURITY (fuzz)" x4; four mutants killed (below) | nothing to fix |
| E43-F6 | info | The hostile-client matrix (scenario 33, part H): a client that sends any of the 73 requests whose guards hold a character to its owner (44) or the road to a GM (29), naming another player's student, is refused by that very guard on the GM, told so with its code (3 quiet ones tell nobody), and nothing is written; each packet was first seen to arrive on the GM | scenario 33 H1, H2 | nothing to fix |
| E43-F7 | low | The GM's session log (utils.mjs `SESSION_LOG_CAP`, 60 rows) drops every new row once full, so a burst of refusals - here, the matrix's first run read 17 of its 73 refusals as unlogged - leaves the GM's diagnostics without the newest ones; the warn line still reaches the browser's console | measured in the matrix's first run (13.11); not a test | proposal in STATUS (a ring that keeps the newest), not changed: every fix moves what `diagnose()` lists, so it is a question for the owner with the default "unchanged" (STATUS, Q-E43-6) |
| E43-F8 | low | Open 96 (E44's, carried here): a project's card a player opened while the project was unknown to their browser stays the card that names nothing when they walk into its room, until it is opened again: its live region heard projectMeta, the Countdowns and a private card's words, not the discovery record or a move | R5204 reads the wiring (red at the base); what the player's window draws on a walk-in is not measured headless (the harness's player opens no sheet window) | C7: the region hears the discovery store, the player's copy of it and a settled move |
| E43-F9 | low | Open 103 (E44's, carried here): a player whose private card with a secret project's description was deleted from the chat reads no description until the words change, since the GMs record who was told which words and send only on a change | scenario 72's "p3: ... still reads its description after the GM clears the chat log", red at 1463f22b (described before the clear, not after) | 59d1c3c1 (14.11.2026, line claude/e39-43-113): the description rides the insider's sight copy (projects.mjs `sightFor`, `receiveSight`), `tellDescription` sends each reader their sight again, a player's `descriptionOf` reads the copy first, the card after |
| E43-F10 | high (D27: the killer's identity) | E69 C8's Mask: its end card (mask-gm.mjs `endMask`, a new time of day) was a plain whisper spoken by the killer and addressed to the killer's player. A new time of day usually comes after the incident has closed, when secret.mjs no longer veils a card by itself (`incidentVeils`), and every browser holds every chat document, so each player's browser read the killer's actor id, name and player in it. Its opening card (`maskKiller`) was veiled only because an incident runs at an opening | scenario 72's season walk, "chat [chapter end]": on p1 and p2 ACTORCHIE0000000 at speaker.actor, "Chie Mori" at speaker.alias and USERP30000000000 in the whisper list (14.11.2026, before the fix) | ad22a09f: both cards posted veiled; 72 green after. Held on its own since by tier 2 **E43-T1** (the coordinator's ask): with no incident open, `maskKiller`'s and `endMask`'s cards each veiled, neither spoken by the killer nor whispered to the killer's player alone - red with 1463f22b's mask-gm.mjs (both `{veiled: false, speaksKiller: true, killersOnly: true}`), green after |
| E43-F4 | info | The fields only the GMs hold were three lists in three files; no name of them is a world setting key, a FLAGS name or a literal flag today (read on 421f2395) | R5203 | C3: one registry, the check kept |

## Read, not reproduced here

- **S17-31** (high, D27): a secret project's name and ownership map in Daggerheart's Countdowns. Fixed on the E93 branch
  (522cd601, its review commits a6203bdc, 3c2217ff, 47169d1b), shipping in 1.2.111; this line read the fix's commit
  message, its scenario 72 check (the name and every player's level on p1 and p2, with the row's presence as its
  control) and the known-leaks row's removal. Not run on this branch: the fix is not on it.

## The fuzz's mutants (13.11.2026, on a worktree of 092c18e1, the fuzz run alone by a probe scenario)

| Mutant | Break | Check that failed |
| --- | --- | --- |
| M1 | `handleNoteSave` writes the note of another player than the sender | no write but the sender's own note (6 writes on p2's User) |
| M2 | vote.mjs's listener reads `payload.round.key` of a `vote.open` | no exception on any browser (the GM's socket handler threw) |
| M3 | the whitelist's `as.text` calls `.trim()` on what it is handed | every request answered, none a handler that threw (`note.save types`) |
| M4 | `refuse` tells nobody | every request answered (the frisk answers acknowledged, never answered) |

All four killed. Not run as a mutant: a prototype key reaching `Object.prototype`, so that check has not been seen to
fail; what it reads (`({}).polluted`, `Object.prototype.isGM` on each browser) is all it measures.

## Not covered by this round

- A request naming a project the sender may not see (`canSeeProject`) and a Spectator's guards are not cells of the
  matrix; scenario 30's forged requests and scenario 93 read them.
- A real server's own socket rules (the shim's are modelled): LIVE-E43-01, the fuzz on a v14 sandbox.
