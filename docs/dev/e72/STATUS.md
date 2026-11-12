# E72 - STATUS (work line claude/e72)

Base: f22a7e8 (claude/fervent-sagan-gme4vt, 1.2.105 in progress). Plan: `origin/claude/plan-130:docs/dev/plans/E72.md`.
R range reserved for this line: R3800-R3849. Updated 12.11.2026.

## Done

| Commit | What | Tests (red at base -> green) |
| --- | --- | --- |
| C1 | A Monocub's ability is paid on the GM after its conditions (S18-50, DC13): `performCubAbility` pays nothing, `cubAbilityRefusalOnGm` asks the row, the locks, the price and the target, `cubAbilityOnGm` takes the action and the Hope only then, one Monocub at a time (`serialWrite`); `meddleRefused` EN/PL now says what the reader keeps | R3800 (new), R301 (changed on purpose), tier 2 "a Monocub's Confusion is paid on the GM after its conditions ..." (new), "in an Eclipse the picker is shut and the GM refuses Confusion with nothing paid" (changed on purpose from "... lands on the GM while the picker is shut") |
| C2 | The crime witness's mark leaves the actor (S18-51, S18-57, DB7): GM store `cubStore` + owner copy `cubCopy` (monocub.mjs `cubRowOf`, socket `monocub.cubs`/`monocub.cubsAsk`), migrate.mjs clause `liftCubWitness` (weak, fill-only, unset only once stored), world-secrets.mjs holds `silencedChapter` out of actor flags; a Monocub in the incident's room is marked at the opening (`markWitnessesAt`) and when it walks in (`cubSawIncident`, asked before `maybeThirdParty`'s indirect and dead returns, so a trap too), the card veiled; DB7's labels EN/PL | R3801 (new), R190 (two fixtures added), R178 (the lift listed), R66/R67 and R1xxx season test changed on purpose to read the store; tier 2 "the crime witness's mark is the GMs' row ..." and "a Monocub in a murder's room is marked a crime witness ..." (new; at base the walking Monocub took the third's seat) |
| C3 | No dead student finds a body (DC7): `witnessesOf` drops the Monocub exception (kept as `monocubs: true` for frisk.mjs's room witnesses, A11-12, which is no discovery); `checkBodyFound` finds the body where `bodyPlaceOf` says it lies (Q-E72-3, default taken); both handbooks EN/PL | R348 (changed on purpose: ["living","forged"]), R3802 (new, source read only); the loot fixture `withBodyTile` stamps its body found, since the tile's room now counts |

| C4 | A student takes one Monocub move per time of day and two per game day (S18-59, DC32 = 2), counted per target over every Monocub, a failed move counted (`cubTargetStore`, `cubCapRefusal`, `noteCubMove`); refused on the GM before the price, told `capReached` / `capDay` (new codes, EN/PL) | tier 2 "a student takes one Monocub move per time of day and two per game day ..." (new; red at base) |

| C5 | Redeem (+1 Hope, one action, once a game day, shut at full Hope and in the darkening) and Ask for Hope (free; the GMs' card in the Monocub's thread, Give 1 / Give 2 / Not now, ruled once through `claimCard` and paid from the clicking GM's Despair by `convertDespairToHope`) as rows of the Monocub's table, with `CUB_BLOCKS` asked on the picker and on the GM before the price; the owner's copy carries `redeemDay` and `askOpen`; `cubStore.log` keeps the last 50 moves for the GMs; their approved glyphs (inventory rows 70, 71) worn under Stained Glass | tier 2 "Redeem gives a Monocub +1 Hope once a game day ..." and "Ask for Hope posts one card in the Monocub's thread ..." (new; red at base); R301, R3333-R3349 green; E15-T6 test drops its target's count per run (C4 changed it on purpose); R472 gains the second notice road |

| C6 | The invitation (S18-61, DC17, DC18): the Students window's Invite button and its State list both send one (`offerMonocub`, the GMs' row `invite`); the owner's copy (`invited`) opens the player's window with the Monocub Rule and its three steps; the answer is a new bridge action `monocub.answer` (knownSender, owns; the run asks the GMs' row, so an answer to no invitation makes nobody a Monocub); accepted, the row keeps `acceptedRule`; declined, the GMs are told; a GM can withdraw it; `whoIsAliveNote` EN/PL | tier 2 "a Monocub is made by its player's acceptance of the Monocub Rule ..." (new; red at base: made at once); E51-T21 and R301 changed on purpose; flow `monocub-invite` (partial: no scenario drives the window yet) |

| C7 | The wrong verdict's card (S18-58, DC16): a step "remind" of the wrong verdict (`remindOnWrongVerdict`, after the card) sends each Monocub of this case's death and each of this chapter's crime witnesses one veiled card ("don't use your moves for or against that person, their projects, Bribes or Ghost Bets"), naming nobody; the GMs' summary lists who was told | tier 2 "a wrong verdict tells the case's dead and the chapter's crime witnesses ..." (new; red at base); R1252 changed on purpose |

| C9 (part) | The Monocub's tiles say why they are shut (S18-62, DC22): `cubBlockSaid` (the row's blocks from the owner's copy) dims a tile and says its sentence; a row with no Hope says its price in the grid's own words (`DRPG.Action.costActions`, `costFree`); `onlyTwoActions` names the three moves | R3803 (new), tier 2 "the Monocub's tiles say why they are shut ..." (new); both red at base |

| C6 (rest) | The old Monocubs window retired (`openMonocubDialog` gone; `game.drpg.monocubDialog` opens the Students window), so the player's acceptance is the one road that makes a Monocub; GM handbooks EN/PL name the invitation and the Crime witness column; 33-bridge-paths A20 (p2's yes from the Rule's window, kept with p2's id) and 30-security's two forgeries (p1 for p2's Botan: ownership; p2 with none open: `refused`) | R3804 (new; red at base: three roads); 33 74/74, 30 275/276 (the expected red is the known Foundry door limit); flow `monocub-invite` names 30 and 33 |

| C9 (rest) | Events' "Redeem is waiting" / "Redeem czeka" (default, owner may revise): events.mjs `redeemCard(user)` for the Monocubs the player owns whose Redeem no block shuts; redrawn on `drpgCubsChanged` and the own student's Hope or Monocub flag (hud.mjs); the Redeem glyph and Hope's gold (kind `redeemHope`, so the CSS meaning check reads it as Hope's); the glyph put on :root with a legacy row `same: glass:redeem` after the first shot showed a gold square under Legacy | R3805 (new; red at f837c2f), tier 2 "the Event panel says Redeem is waiting to a Monocub's own player alone ..." (new; red at f837c2f) |

| C8 | The ordinary dead's voice (S18-53; the coordinator's decision of 12.11: the mic block stays in the trial, the ordinary dead outside it get their own voice channel, no write to the user record): a silenced death outside the trial, public or secret, goes to its account's own room (voice-client.mjs `deadRoomFor`, `drpg-dead-<userId>`), which nobody else is sent - not the main room (public, until now: the living heard it) and not one shared dead channel (`DEAD_ROOM`, gone: a victim heard a second death nobody had found). No document written; the trial unchanged (E70's block). "deadAlone" read off the account's own room. Default, owner may revise: per account (the plan's A9) rather than one room for the dead. Not done of the plan's C8, by the decision: `mutePolicy`, `deadMuteStore`, the BROADCAST_AUDIO block outside the trial; also not done: "Silence now" in the Students row and the tracker (deathVoiceGone already reads `silencedDead`; nothing writes it yet) | R3806 (new; red at 377a476); R815, R816, R832, R835, R117 changed on purpose (a public death: "main" -> its own dead room), R831 reads the own room; 75-voice-tile E reads `drpg-dead-<p2>`; handbooks GM 557, player 754, EN/PL |

| C11 | The trial carry-ins (Q-E72-7: the audit's one line each is all there is). D102: a Final Trial's execution posts the execution card, as an ordinary trial's (trial-progress.mjs `postExecutionCard`; until now only the sound). D114: in the Closing's exchange (an Objection at the Closing's speaker, its Rebuttal) only its two present evidence; a third is refused, "Only {a} and {b} can present right now." / "Teraz dowody mogą przedstawiać tylko {a} i {b}." (`modeAllows`, `presentRefusal`; player handbook EN/PL). D101: not built - see "For the coordinator" | tier 2 "an execution in the Final Trial posts the execution card ..." (new; red at 7ab4cc6: no card); R1045 changed on purpose (the exchange's matrix; red at 7ab4cc6: C presented) |

| C12 | Part A's texts (S18-63): the player handbook's "Playing a Monocub" (the invitation and the Rule, four tiles, free movement, every room the class found, the price after the GM's checks, the caps, Redeem, Ask for Hope, the dimmed tiles, the wrong verdict's card, the crime witness), the brochure's Death line (the own voice room, the invitation), the GM handbook's Monocub paragraphs; EN and PL | R3807 (new; red at 97d09e1: all six texts); R1041 changed on purpose (the Final's sound is the card's since C11) |

| C10 | A Monocub sees every room the class found (gm-stores.mjs `fogSectionFor`, `cubFogSection`): its owner is sent, under the Monocub's own row, the rooms every student found, the Mastermind's row out, the rows joined so nobody's finds are named; tier 2 "a Monocub's owner is sent every room the class found ..." (new; red at base). And a Monocub's crossing (28.10, 04.11, 06.11): no Move, no action and no Eclipse count, the Eclipse too (`crossingVerdict`, `chargeRoute`), the connected rooms still holding it; the room of a running incident refused to it on a GM judging a player's step with the Seal's code and words (`roomSealed`, `DRPG.Calls.sealedBlocked`), a GM's own move and a Monocub already inside not refused | tier 2 "a Monocub crosses to a connected room with no Move and no action, and the room of a running murder refuses it ..." (new; red at base: noBudget, the murder room let through); R558 changed on purpose |

## In progress

- Part A done but C8's "Silence now" and D101 (see below). Next: part B (C13-C21), then E91.

## Next, in order

1. C8's "Silence now" (a GM's button writing `silencedDead`), if time allows after part B.
3. Part B: C13-C21 (Tinker, the purse, Bribe, Bounty, a move to order, Ghost Bet, the panel, texts, end review).
4. E91.

- 12.11.2026, second push: 094f735 (C10's movement half, the Back up fixture). Tiers 0-1 at 094f735 1162 passed, 0 failed,
  16 skipped, 1 red; tier 2 named Monocub, "a Monocub crosses", "Back up the case" 75 passed; scenarios at 3aa2ed3:
  66-rooms 76/76, 14-quiet 7/7, 74-room-tile 44/44 green, 76-passages 117/118 (U, a tunnel crossing seen - the same at
  f22a7e8 here, and green in CI at c595854).

## Decisions received (the coordinator, 12.11.2026, for the owner's free hand until Fri 13.11 18:00)

- C8: the default. The microphone permission is blocked in the trial only; the ordinary dead outside the trial get a
  voice channel of their own, with no write to the user record.
- The TR30 README paragraph: README left alone; the proposed text stays below under "For the coordinator".
- `liftCubWitness`'s `since`: 1.2.117 kept (stages.json plans E72 there); the coordinator re-checks at merge.
- Defaults, each "default, owner may revise": the Polish refusal wording (Q-E72-8), the per-target caps (C4), Redeem's
  and Ask for Hope's prices (C5), the Monocub Rule's wording (C6), Q-E72-3 (C3), Q-E72-5 (C10).

## For the coordinator

- known-leaks.json TR30, `closes: "E72"` to `foundryLimit`, with a root README paragraph marked `<!-- leak:TR30 -->`:
  "In a Class Trial every ordinary dead student's microphone is off, a death nobody has found among them, and the
  trial's list of them is world data every browser holds while the trial runs (the owner's TR30 = 2). <!-- leak:TR30 -->"
  and the row's field: "Foundry v14 keeps a user's permissions, BROADCAST_AUDIO among them, in the user document every
  connected client holds; the owner chose that the trial mutes every ordinary dead student, a death nobody has found
  among them (TR30 = 2)." Until then the row's check fails once E72 is registered as shipped.

## CI

- Run 43178407244 at 377a476: see the newest line of "Pushed" for its result.
- Run 43157335032 at daedc00: green (every job).

- Run 43151316668 at c595854: every job green but "suite 7/8": the tier-2 test "Back up the case, then Restore, brings
  every store back" had no fixture for the two new stores (cubs, cubTargets). Fixed in a4cd1ed (green alone).

## Pushed

- 12.11.2026: c595854 (C1-C7, C9) to claude/e72. Before it: tiers 0-1 at cf4b885 (C9 head but its last wording fix)
  1162 passed, 0 failed, 16 skipped, 1 red; the commit's own tests at c595854 7 passed. Scenarios, each from a worktree
  of the named commit: 40-flow (0819ec1) 88/88, 83-roll-integrity (d005dc4) 110/110, 33-bridge-paths (0819ec1) 73/73,
  87-messenger-sound (d005dc4) 35/35, 61-gmstore-case (d005dc4) 113/113, 10-murder (d005dc4) 38/38, 63-class-trial
  (0819ec1) 71/71, 71-sheet (cf4b885) 41/41, 11-killer-secrecy and 66-rooms and 41-trial-scene (82f26c1) green;
  30-security 273/274, 65-season 57/59, 72-canary 124/128 and 67-trial-modes 45/46 fail the same checks at f22a7e8 in
  this container (measured: the door, X2/X2b, three known leaks and the unfound trace, D2 - each a known leak or a
  check this line does not touch).

## C8 - built, measured, reverted (12.11.2026)

d098aa7 kept the ordinary dead the table knows muted outside the trial, on the trial's store and its rules, triggered by
the primary's debounced settle (`trialVoicesPending` extended to any death the table knows). It was reverted (cf4b885)
before any push: tier 2's E63 test "the Class Trial's end takes every body off the map ..." failed its restore with
"restore left: client:...gmTrialMute...USERP30000000000 (none) -> #..." - the block is written 250 ms after a test makes
a death public and taken off 250 ms after its revive, after the suite has compared the world. Next attempt: block and
release on the death's own roads, awaited (the publication, the revive, the Monocub), not on the debounced hook; then
R537 and R1192 change on purpose again (both measured with d098aa7: a dead student on the sheet held as "deadKnown",
two new walkers of the cast to list).

Superseded by the coordinator's decision of 12.11 (the block stays in the trial): C8 built as the account's own dead room
in 7ab4cc6, no block outside the trial, nothing written on the user.

## Deviations from the plan, and defaults taken (default, owner may revise)

- C1: the plan's "config rows gain phases, blocks, caps, visibility, executionCost (a slot, no logic)" is not done as
  empty slots: each field is added in the commit that gives it logic, so no row carries a field nothing reads.
- Q-E72-8 (`meddleRefused` wording): EN takes the audit's sentence "Confusion doesn't reach them. You keep your action
  and Hope."; PL takes text-style O8's shape "Nie tracisz akcji ani Hope." instead of the plan's "akcja i Hope wróciły"
  (nothing was taken, so nothing comes back; R1143 also refuses a Polish refusal that promises a return). Default, owner may revise.

- C2: `liftCubWitness`'s `since` is "1.2.117" (the plan's reading of the release order). It must be the version E72
  ships in, or a world that wrote the flag in between skips the lift: coordinator to set at release.
- C2: the mark is read as a per-chapter fact on the GMs' row (as the flag was); the "manual switch" of the plan is the
  Students window's existing Crime witness box.
- C3: Q-E72-3 default taken (read `bodyPlaceOf`); measured off the source (R3802) and through the loot tests, not by a
  tier-2 walk onto a tile whose token has left. default, owner may revise.
- C3: DC7 is applied to the body's discovery only; who sees what one student does to another (frisk.mjs, A11-12)
  still counts a Monocub (`monocubs: true`). default, owner may revise.

- C4: "one attempt per student" read as per target student, over every Monocub (the store is named `cubTargetStore` in
  the plan). A row of another time of day or day counts nothing, so nothing clears it at the clock's turn: the same
  behaviour as clearing, with no write. Default, owner may revise.

- C5: Redeem's price (one action, no Hope) and Ask for Hope's (free, one open at a time) are defaults; the plan names
  neither. The Students window's Monocub columns for them (the plan's C5) are left to C9/C19 with the panel. Owner to
  confirm the prices.
- C5: Monokuma Legacy shows Font Awesome's ticket and praying hands for the two tiles (LEGACY_ICONS "fa:"), as a
  crisis row does: Legacy has no drawing of its own for them.

- C6: the Rule's words and its three steps are this line's reading of DC17/DC18 ("talk, role removed, removed from the
  game"): "You never tell the living what only the dead know: who killed you, how, or what you see from now on." /
  "Nigdy nie mówisz żywym tego, co wiedzą tylko zmarli: kto cię zabił, jak, ani co widzisz od teraz." - owner to
  confirm the wording.
- C6 not yet done: `openMonocubDialog` removed and `game.drpg.monocubDialog` pointed at the Students window; the
  revoke function that also hands back a bet, asks, the purse and the mute (those parts come with C8, C14, C18);
  33-bridge-paths' legal control and 30-security's forgery of `monocub.answer`.

- C8 (decided 12.11 by the coordinator: the own room, built in 7ab4cc6; kept for the record). Second attempt (12.11.2026, not committed; its diff kept outside the repo):
  the block outside the trial asked, awaited, by the death's own roads (chapter.mjs `markDeceased`, `reviveCharacter`,
  monocub.mjs `setMonocub`). Its own tests and the E63 test that raced were green (130 passed, 2 skipped), but the
  tier-2 tests that kill or revive (353 run) gave 3 failures: two tests that put a death back without
  `reviveCharacter` left `permissions.BROADCAST_AUDIO` false on a user ("restore left: User ... permissions.BROADCAST_AUDIO
  (none) -> false"), and "a death made public while its student's queue is busy ..." measured the mark no longer
  lagging, because the settle waits for every student's queue (`judgedFor`) inside the publication. Measured: writing
  the Foundry permission at every public death is a user-document write on the death's road, which tier 2's fixtures
  do not put back and which slows the discovery. Proposed default: keep BROADCAST_AUDIO for the trial (E70) and the
  sentenced, and hold the ordinary dead outside the trial by the per-account channel the plan's A9 names
  (`dead-{userId}`, a voice room nobody living is in), which writes no document; the permission outside the trial
  only if the owner wants it at the cost above.

- C10: the murder room's refusal is judged where the incident's room is known: on a GM's browser judging a player's
  step. The Monocub's own browser does not know where a murder runs, so its veto lets the step through and the GM's
  judge sends it back - the refusal it is told is the Seal's either way. Q-E72-5 default (no action, no crossing limit,
  Eclipse too) taken; the connected rooms' rule kept (the amendments name the budget, not the walls) - default, owner may revise.

- C11, D101 ("the discovery stamp at an execution, E70-16's wording") is not built: E70-16 calls the death record's phase
  the "discovery stamp", and an execution already writes phase "classTrial" and cause "executed", so no walk finds the
  body (tier 2 "a sentence that could not be carried out ..." and "a body the verdict executed is not found again" hold
  it). Writing a real discovery stamp (`bodiesFound`) at the execution would raise "A body is discovered" for the
  executed and give the next Investigation its body (`bodyFoundSinceTrial`), which no reading of D101 asks for. A
  reading that names the code to change is needed; default: no change.
- C11, D102: the execution card names the executed, and in a Final Trial that is the Mastermind; the defeat's banner
  names nobody ("THE MASTERMIND IS DEFEATED"). Default: the name, as an ordinary trial's card - owner may want it
  without the name.

## Blockers

None.

## Shots

- Round 1 (12.11.2026): https://claude.ai/artifact/BZqYRZA6foPGz62DRg85vD - C6's invitation window (player) and the
  Students window's rows with an open invitation (GM), Stained Glass and Monokuma Legacy, EN and PL, 1366x768 at
  deviceScaleFactor 2, drawn by audit/style-harness.html's kit mode (no Foundry CSS). Looked at: the Withdraw button
  was cut off at "Withdraw the invitation", shortened to "Withdraw" / "Wycofaj". Not shot: C5's Ask for Hope card in
  the messenger (the harness's kit mode cannot draw the messenger).
- Round 2 (12.11.2026): https://claude.ai/artifact/QVjnHYbQa3wUu4zEHUW63n - C9's Monocub panel (Move, Confusion,
  Redeem shut, Ask for Hope free), both themes, EN and PL; the tiles written by the shot's script on sheet.mjs's
  markup, not by the module's code; Legacy shows no Font Awesome glyph in the harness. Looked at: Redeem read
  "0 Hope, 1 action" - now the grid's own "1 action", and "free" for Ask for Hope.

- Round 3 (12.11.2026): https://claude.ai/artifact/7spCCPaAcrGFvebcb5L5T2 - C9's "Redeem is waiting" card in the Event
  panel, both themes, EN and PL, drawn by audit/glass-harness.html with events.mjs `cardElement` (the fields written
  by the shot's script from lang, not by `redeemCard`). Looked at: under Legacy the glyph was a gold square (the
  drawing was Stained Glass's alone) - fixed in bbbcb73, the published shots are after the fix.

## Test results

- Tokens so far: not measured by this line (no counter is available to it here).

- Scenarios run from a worktree of the commit (DRPG_REPO): at 1d41165 (C1) 40-flow green, 83-roll-integrity green,
  30-security 273/274 (FAIL "a Foundry secret door is seen and opened from a player's console" - not a Monocub road;
  base comparison pending). At 82f26c1 (C2+C3) 10-murder 38/38, 11-killer-secrecy 14/14, 66-rooms 76/76 green;
  65-season 57/59 (X2, X2b) and 72-canary 124/128 (three known leaks and "an unfound trace's token reaches no
  player's browser") - the same checks fail at f22a7e8 in this container (run 12.11), so not from this line.

- C1: red at base (worktree of f22a7e8 with the new test files): 4 failed of the 4 named, each for its stated reason.
