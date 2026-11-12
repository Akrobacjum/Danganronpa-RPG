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

## In progress

- Push of C1-C7 and C9 after tiers 0-1 and the scenarios at the head.

## C8 - built, measured, reverted (12.11.2026)

d098aa7 kept the ordinary dead the table knows muted outside the trial, on the trial's store and its rules, triggered by
the primary's debounced settle (`trialVoicesPending` extended to any death the table knows). It was reverted (cf4b885)
before any push: tier 2's E63 test "the Class Trial's end takes every body off the map ..." failed its restore with
"restore left: client:...gmTrialMute...USERP30000000000 (none) -> #..." - the block is written 250 ms after a test makes
a death public and taken off 250 ms after its revive, after the suite has compared the world. Next attempt: block and
release on the death's own roads, awaited (the publication, the revive, the Monocub), not on the debounced hook; then
R537 and R1192 change on purpose again (both measured with d098aa7: a dead student on the sheet held as "deadKnown",
two new walkers of the cast to list).

## Next

C2-C12 (part A), then C13-C21 (part B), then E91.

## Deviations from the plan, and defaults taken (owner to confirm)

- C1: the plan's "config rows gain phases, blocks, caps, visibility, executionCost (a slot, no logic)" is not done as
  empty slots: each field is added in the commit that gives it logic, so no row carries a field nothing reads.
- Q-E72-8 (`meddleRefused` wording): EN takes the audit's sentence "Confusion doesn't reach them. You keep your action
  and Hope."; PL takes text-style O8's shape "Nie tracisz akcji ani Hope." instead of the plan's "akcja i Hope wróciły"
  (nothing was taken, so nothing comes back; R1143 also refuses a Polish refusal that promises a return). Default
  taken, owner to confirm.

- C2: `liftCubWitness`'s `since` is "1.2.117" (the plan's reading of the release order). It must be the version E72
  ships in, or a world that wrote the flag in between skips the lift: coordinator to set at release.
- C2: the mark is read as a per-chapter fact on the GMs' row (as the flag was); the "manual switch" of the plan is the
  Students window's existing Crime witness box.
- C3: Q-E72-3 default taken (read `bodyPlaceOf`); measured off the source (R3802) and through the loot tests, not by a
  tier-2 walk onto a tile whose token has left. Owner to confirm.
- C3: DC7 is applied to the body's discovery only; who sees what one student does to another (frisk.mjs, A11-12)
  still counts a Monocub (`monocubs: true`). Owner to confirm.

- C4: "one attempt per student" read as per target student, over every Monocub (the store is named `cubTargetStore` in
  the plan). A row of another time of day or day counts nothing, so nothing clears it at the clock's turn: the same
  behaviour as clearing, with no write. Owner to confirm the reading.

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

## Test results

- Scenarios run from a worktree of the commit (DRPG_REPO): at 1d41165 (C1) 40-flow green, 83-roll-integrity green,
  30-security 273/274 (FAIL "a Foundry secret door is seen and opened from a player's console" - not a Monocub road;
  base comparison pending). At 82f26c1 (C2+C3) 10-murder 38/38, 11-killer-secrecy 14/14, 66-rooms 76/76 green;
  65-season 57/59 (X2, X2b) and 72-canary 124/128 (three known leaks and "an unfound trace's token reaches no
  player's browser") - the same checks fail at f22a7e8 in this container (run 12.11), so not from this line.

- C1: red at base (worktree of f22a7e8 with the new test files): 4 failed of the 4 named, each for its stated reason.
