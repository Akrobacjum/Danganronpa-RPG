# E101 line: a read of the e93 line's S17-31 and census commits

The coordinator's task of 13.11.2026: once the r112 merge of 1.2.109 was done, a read-only adversarial review of
the 1.2.110 notes and diff, or, if the 1.2.110 line (fervent-sagan-gme4vt) had not moved past 421f2395, of
e93 at 1f5f4ecb against 4eef965a (S17-31 and the E92 census commits). Focus: correctness, D2, and
tests that measure nothing.

**What was read.** fervent-sagan-gme4vt was still at 9c088110 when this was written, so the read is e93's own commits
over 4eef965a, leaving out the 1.2.109 merge (a1479e95) itself:

| Commit | What it does |
| --- | --- |
| 0fbe2440 | the train's eight bridge rows take E92's `notSpectator` guard; R3865 |
| 522cd601 | S17-31: a secret project's name and who is in on it leave Daggerheart's Countdowns; R4620, S17-31-T1, T2, scenario 72 |
| e15b6013 | E92's census counts `tailTargets` and `targetsOf`; the tier-2 test "E92+E93"; R3858 |
| dc601a79 | STATUS: the Polish "Facilities" tab name kept (glossary D33a) |
| 1f5f4ecb | scenarios 30 and 93 read the new map (every player at OBSERVER) and p1's `canSee` false |

e93 has moved since, to bfed7ead (9f052871 moves S17-31 into 1.2.111; 393da19a and bfed7ead are review files;
81e19f0d fixes two of e93's texts). Those four were not read here, except that 9f052871 changes only the
clause's version and the notes (`git diff 1f5f4ecb bfed7ead -- scripts`: migrate.mjs `since`, one projects.mjs line).

**How.** Read in git (`git show`, the files at 1f5f4ecb), each path traced through the code it calls. Nothing was
run: no harness, no browser, no table. Each finding says how far it was traced.

## Findings, most severe first

| # | Sev. | Where (1f5f4ecb) | What | How far checked |
| --- | --- | --- | --- | --- |
| R1 | medium | module.mjs `sealProjects` (591-621), projects.mjs `resealSecretProjects` (2443), projects-secrecy.mjs `sightChange` reseal (423-432), `sharedIds` (349-358), projects.mjs `changeStep` (1301, 1391-1395) | The boot reseal runs before the GM store is hydrated and can overwrite a secret project's name and insiders with newer stamps | traced in code, not run |
| R2 | medium | projects-secrecy.mjs `toldSight` (145-160), projects.mjs `tellSight` (273-300) | A player's sight of a secret project now lives only in a chat card: clearing the chat log takes the project out of every insider's tray, and nothing tells them again | traced in code, not run |
| R3 | low-medium | projects-secrecy.mjs `sharedIds` (356) | An old seal that let every player in (all at OBSERVER) reads as "nobody", so the migration drops every insider | traced in code |
| R4 | low | world data, `ownershipMap` | Every player is now OBSERVER on a secret countdown; only the module's tray pass hides it | read; not a regression |
| R5 | low | bridge-table.mjs (0fbe2440, and E92's rows) | `notSpectator` is asked before `owns`, so a refusal can say "that character is a Spectator" about a character the sender does not own | read; E92's existing order |
| R6 | low | S17-31-T2 | The migration test plants only the two-level old map, not R3's case | read |

### R1 - the boot reseal can write "???" and an empty list over the GMs' real ones

`sealProjects` (module.mjs) calls `resealSecretProjects()` on the primary GM at load, and again on every
`createUser`. It does not wait for `projectSecretStore.whenHydrated()`. The module's other load passes that read this
store do wait: `tellProposers` (projects.mjs 369) and `sealOldRepairs` (2385). The migration clause
`hideSecretProjects` is safe, because the migration waits for the stores (module.mjs's comment at 385-390).

Before S17-31 this did not matter for the reseal: the name and the map were in the world setting, which every
browser holds at load. Now both are in the GM store (`secretName`, `viewers`).

The store's local half is this browser's client storage, read synchronously (gm-store.mjs 1648-1650), so a GM who
already holds the row is fine. The case that goes wrong is a primary GM whose browser does not hold the row yet:

1. GM2 makes a secret project while GM1 is away. GM2's browser holds `secretName` and `viewers`.
2. GM1 loads and is the primary (its id sorts first). GM2 is online, and the store's hello has not been answered yet.
3. `sealProjects` -> `resealSecretProjects`. `isSecret` reads the world's public half, so the project counts as
   secret. `sightChange(id, { reseal: true })`: `secretsOf(id).viewers` is undefined, so `lifted` is false and a
   change is returned, with `viewers: sharedIds(id)`.
4. `sharedIds`: no list held, so it reads the countdown's map. Since S17-31 that map gives every player OBSERVER, so
   the "every player at one level" rule answers `[]`.
5. `changeStep`: `named = secretsOf(id).secretName ?? project.name` = `"???"` (the countdown's `HIDDEN_NAME`).
   `sealedAfter` is true, and `secretsOf(id).secretName` (undefined) differs from `"???"`, so the change writes
   `secretName: "???"` and `viewers: []`.
6. GM1's writes carry newer stamps than GM2's. When the exchange arrives, the store keeps the newer stamp per field,
   so the real name and the insiders are lost on both GMs. The insiders' tray keeps the old card's name until
   `tellSight` runs again; it then has nobody to tell and tells the old insiders "gone".

Step 6's merge rule is read from the repository's own description of the store ("a stamp per field"), not traced
through gm-store.mjs's merge.

Suggested fix: make `resealSecretProjects` wait the way `sealOldRepairs` does
(`if (await projectSecretStore.whenHydrated() === "timedOut") return 0;`), or at least skip any project whose row
holds no `viewers` array while the store is not hydrated. A tier-2 or scenario 61 case (two GMs, the primary
without the row, reseal before the exchange) would be red today.

Related, same root: `changeStep` reads `secretName` with no hydration check for every change, so any change the
primary makes to such a project before hydration writes `"???"` the same way (step 5).

### R2 - clearing the chat takes secret projects out of the insiders' trays

On a player's browser, `canSee`, `shownName` and the tray's `nameSecretRows` read `toldSight`, which scans
`game.messages` for the newest GM-written `PROJECT_SIGHT` card. `tellSight` sends a card only to players the GMs'
`sightTold` record does not already list with that name.

So, when a GM uses Foundry's "Clear Chat Log" (or deletes the card):

- every insider's `toldSight` answers null, the project reads as not theirs, and the tray hides it;
- `sightTold` still lists them as told, so the next `tellSight` sends nothing;
- the row stays hidden until something changes the name or the list.

Before S17-31 the insiders' sight was in the countdown's map, which no chat action touches. The description and the
room action already depended on cards in the same way (`tellDescription`, `tellFacility`, `projectsToldHere`), but
those lose detail. This one loses the project itself. STATUS-S17-31's open list names the offline insider, but not
a cleared chat.

`grep sightTold` over scripts/ (outside the tests) finds only `tellSight`. Nothing resets it when messages are deleted.

Suggested fix: on `deleteChatMessage`, when the primary GM sees a `PROJECT_SIGHT` card go, drop the `sightTold`
entries it served and run `tellSight`. Or have the primary re-tell when a player's ready asks for it, as other
stores' copies are resent.

### R3 - an old seal shared with every player reads as shared with nobody

`sharedIds`, with no list held: `if (new Set(players.map(([, level]) => level)).size <= 1 && players.length > 1) return [];`.
The rule is there to read the new map (every player at OBSERVER) and the F4 leak shape as "no list". It also
catches a pre-S17-31 seal whose map really let every player in. That map was possible: `shareChange` added any
player, one at a time.

On such a project the migration (`hideSecretProjects` -> `resealSecretProjects` -> reseal) writes `viewers: []`. Every
insider loses the project, and nothing tells the GMs.

The two cases cannot be told apart from the map alone. One option: in the migration, check whether the countdown
still holds its real name (`name !== HIDDEN_NAME`). If it does, the map was written before S17-31, so read it as
written, all-OBSERVER included. Only a map that is already `HIDDEN_NAME`'s means "no list".

### R4 - every player is OBSERVER on a secret countdown

`ownershipMap` now gives every player OBSERVER, so Daggerheart's own countdown UI has a row for every player, named
"???", with its progress. Only the module's tray pass (`hideUndiscovered`) takes it out.

A console, or a moment before the tray pass runs, shows that a secret project exists and how far along it is. That
was already readable in the world setting before S17-31, so this is not a regression. It is still something the
module only hides in the UI and does not protect, and STATUS-S17-31's "Read in code, not run at a table" covers part
of it (whether Daggerheart draws the row).

### R5 - the Spectator guard runs before the ownership guard

0fbe2440 adds `notSpectator(field)` before `owns(field)` on the train's eight rows, as E92 did on its own rows (52 in
the table). A player who sends a packet naming another player's character gets back the code `spectator` when that
character is a Spectator, and the ownership refusal otherwise. So the refusal tells them whether a character they
do not own is a Spectator.

This matters only if a Spectator's role is not public. E92 shows a Spectator's token faint to the GM only, which
suggests the role is not meant to be shown. This is the owner's call. If it should stay private, put `owns` first in
every row. That changes E92's rows too, so it belongs to E92, not to this train.

### R6 - S17-31-T2 does not cover R3's case

T2 plants an old map with the insider at OBSERVER and the rest at NONE (two levels), and the migration lifts it
correctly. Nothing plants the all-OBSERVER old map of R3, so the suite cannot see R3. One more fixture row in T2
(all players at OBSERVER, the countdown still named) would be red today.

## Tests that measure nothing: read and found sound

- **R4620** calls `ownershipMap` with one viewer and holds the players' levels to `[OBSERVER]`, no GM in the map,
  `default` NONE, and the neutral name without letters. It measures the map. It does not measure who sees the row,
  which belongs to `canSee` and the tray.
- **S17-31-T1** reads the setting as any browser holds it and the GMs' readers, with `must()` on the project and its
  countdown. It reads `canSee` on the GM, for the insider and the outsider. A player's own reading (the card) is
  scenario 72's, which reads p1 and p2.
- **S17-31-T2**: see R6. Its `must()` makes sure the old shape was really planted before the clause runs.
- **Scenario 72's new check** requires the row to be present (`c.row`), so an absent row cannot pass it.
- **Scenarios 30 and 93 (1f5f4ecb)**: the old `p1 === 0` became `p1 === p2` (30) and `p1 === 2` (93), and 30 adds
  `canSee` false on p1. In 93 the p1 side holds only the map's level. Whether p1 is kept out is the check above it
  (`sight.p1.sec === false`, `seeSec === false`), so both are still measured.
- **e15b6013's "E92+E93"** is green with and without a Spectator check in the lists, as its commit says, so it holds
  what `occupantsOf` already does, not new code. That is stated in the commit, not hidden.

## Not read

- The 1.2.110 notes and diff: fervent-sagan-gme4vt has not moved past 421f2395.
- e93's commits after 1f5f4ecb (393da19a, 81e19f0d, bfed7ead), except the scripts diff of 9f052871.
- Daggerheart's countdown UI, and how it draws an OBSERVER row: not available here.

---

# 1.2.110: a read of the release (421f2395..12a7e309)

The coordinator's task of 13.11.2026, second half: once the 1.2.110 line (fervent-sagan-gme4vt) moved past 421f2395,
a read-only adversarial review of its notes and diff. It moved to 12a7e309 (d872ca7c: 1.2.110 ships E64, E72 and E91;
12a7e309 the local gate's record). 179 commits, 140 files, +12581 -1723.

**How.** Three readers, one per area: E72 (the Monocub, the dead's voice, the Call windows); E64 (the rules, Level
Up and its migration, E64-inv); E91 with E99 round 7, gaps-61, gaps-108, the owner's fixes on the line, and the notes'
countable claims. Each read the repository's rules first and ran only git, grep, sed and python counts: no harness, no
browser, no table. Their full texts are in this session's scratchpad (rev110-e72.md, rev110-e64.md, rev110-e91.md),
not in the repository. **Verified here** means the failing path was traced again in the code at 12a7e309 by this line,
not only by the reader. **Reader's** means it was not.

## Findings, most severe first

| # | Sev. | Where (12a7e309) | What | Verified |
| --- | --- | --- | --- | --- |
| V1 | medium | movement.mjs `restrictedFrom` (~1957-1962); call-world.mjs `isSealed` (61) | A Monocub refused a running murder's room is told `roomSealed`, "so it reads as a Seal". But Seals are the world setting `sealedRooms` (scope world, every browser holds it). A `roomSealed` refusal for a room that setting does not list tells the Monocub's player that a murder is running there. | verified here: the code and the setting's scope |
| V2 | medium | level-up.mjs `offersFor` (296), `receiveOffers` (329), the picker (599) | The DA39 migration's offer is statistics-only (`only: "trait"`) in the GMs' store, but the copy sent to the owner keeps only `{ id, kind, extra }`, so the player's picker draws every option. An experience pick is refused on the GM ("that offer is for statistics only", told as `badRequest`) and the same window comes back. The tier-2 "E64 DA39 migration" test reads the GMs' store, not the player's copy. | verified here: both copies drop `only` |
| V3 | medium | cleanup.mjs `freshSceneBonus` (405-439), `unfoundBodyIn` (446) | The fresh-scene -3 now depends on GM-only facts: a body of this chapter in the GMs' `deathStore` (a player reads only their own copy). A player who does not know of that body sees the higher number in the Tamper window, while the GM scores the lower one, so a roll between the two comes back a hit and tells them a body lies unfound this chapter. At 1.2.109 the discount read only public facts. R3950 passes its arguments explicitly, so the default reading on a player is not measured. | verified here: the reads; the inference is reasoned, not run |
| V4 | medium-low | verdict.mjs `remindOnWrongVerdict` (906-909) | "The case's dead" are any Monocub with `death.chapter === clock.chapter`, with no season or `sinceVerdict` check. With two murders in a chapter, the first case's Monocub gets the second case's card; after a reset that keeps Monocubs, last season's same-chapter dead do too. The card names nobody, so the harm is a Monocub told to hold back for a case it does not know. | verified here |
| R1 | low-medium | monocub.mjs (1455, 774) | `askOpen` is cleared only by a GM answering the card: a deleted card or a flushed chat leaves Ask for Hope blocked for that Monocub, with no road back. | reader's |
| R2 | low | roll-draw.mjs (964-969); cleanup.mjs (3041-3066) | Tamper refused for lack of an action holds only on the player's browser: `paysFor("cleanup")` still takes Sanity, so a Sanity mark earns a roll ticket, and on the GM `chargeUnclaimed` finds no action and scores it - a Tamper for 1 Sanity. Whether the sheet audit accepts that write is suspected. | reader's |
| R3 | low | monocub.mjs `refundCubHopeNow` (730-733) | Tinker's purse refund is not capped at the maximum: a Bribe accepted between the spend and the refund can leave the sheet over its maximum. | reader's (a race) |
| R4 | low | monocub.mjs `settleBets` (1793-1815), revive (119-190), `answerHopeAsk` (1465) | A revived student keeps `bet`, `order`, `askOpen` and the purse; `settleBets` pays every row with a bet; `answerHopeAsk` checks neither `isMonocub` nor `askOpen`. | reader's |
| R5 | low | monocub.mjs `postBounty` (1712-1733) | No lock between the check, `oweDespair` and the write: two posts on one student owe twice and keep one Bounty. | reader's (needs two at once) |
| R6 | low | monocub.mjs readers `cubRowOf`, `cubCapRefusal`, `orderOpen`, `workersNow`; gm-stores.mjs `cubFogSection` | They read the new stores without waiting for hydration (`patchCubRow` and the roll guard do wait), so with two GMs just after a reload a once-a-day rule or a cap could pass twice. The same shape as this file's R1 on S17-31. | reader's, suspected |
| R7 | low | murder-rules.mjs `crisisDefense` (259) | The defender's statistic is read off the document, not as the GMs hold it: a console raise not yet put back counts (at most +1). | reader's |
| R8 | low | level-up.mjs (1398-1413); character.mjs (205), season-wipe.mjs (472-475) | The migration writes the sheet before it records the offer, so a throw between them loses the points; a reset does not clear `da39Rises`; every Head, Body or Leg point above the stamp is read as owing a rise (a GM's hand edit too; the GM's tick limits it). | reader's |
| R9 | low | movement.mjs (1348) | D059: crossing rows written before 1.2.110 carry no `mark`, so a free Move taken just before the update is not refunded. | reader's |
| R10 | low | mastermind.mjs (298), passages-gm.mjs (1078); sheet.mjs (155) | The lair's lock and seal check neither the phase nor whether the Mastermind is dead; their buttons show on every sheet the Mastermind's player owns (refused on the others, no leak). | reader's |
| R11 | low | trial-floor.mjs (187), trial-floor-ui.mjs (1452), gm-panel.mjs (296-300, 876) | In an ordinary trial End the chapter is offered only after the case summary card is sent; a GM who skips it ends the chapter only from Edit campaign (pinned by R3918; the notes call it an unconfirmed default). A comment still says "as before". | reader's |
| R12 | low | day-summary.mjs (131) | A Morning Eclipse opened at Night hides the Night's summary; ended with "End without advancing" and moved on by hand, no board plays it. | reader's |
| T1 | low (test) | R3984 (tests-tier1.mjs ~40900); R3801; R3804 (tests-tier0.mjs 8066) | R3984 passes if the cascade reads no rule (as this line's P3 on R4109-R4112); nothing runs `liftCubWitness`, and R3801's regex misses string-key writes; R3804's regex misses a first argument with parentheses. | reader's |
| N1 | low (notes) | notes line 71; lines 5-16, 247-249; comments in config.mjs 3339, monocub.mjs 852, 1425 | The five new stores are called "world settings", but settings.mjs registers them `scope: "client"` (the GM store's own storage); the range is counted to a290cc9b, not the release's tip; the gate sentence names 1.2.109's record where the tree holds 1.2.110's; Redeem is "one action" in two comments (free since cca805ca). | reader's (measured) |

**No D2 hole was found in the new bridge rows.** monocub.answer, bribe.offer, bribe.answer, mastermind.lairLock and
passage.lairSeal each ask knownSender, notSpectator and an ownership guard. Their runs judge the GMs' record: the
invitation open, the payer living and owned, the offer read from the record, the lair from the Mastermind store. D078's
co-owners widen no guard (`ownsActor` already took any owner). D053's refund comes only on a refusal, and every
refusal comes before a write. V1 and V3 are what a player can read from a refusal or a result, not a missing guard.

**The notes' counts hold** (the E91 reader, measured): 177 commits and 16 merges to a290cc9b, 167 to 8fc3e798, the
per-branch counts; lang 5289 English and 6322 Polish keys (5141 at 1.2.109), no English key without a Polish twin; the
five new bridge actions; the known leaks 9 -> 10; module.json the version alone; the gate's "47 scripts; sockets 15,
rolls 6, scenes 39" reproduced. Not checked: the quoted run counts and timings, and the red-first claims, which only a
run can confirm.

**Not read in depth:** E64's D008 and D003, the E64-inv screen-fit readings, the chi-square figures (not recomputed:
nothing was run).
