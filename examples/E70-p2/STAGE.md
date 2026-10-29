# E70 part 2 - Class Trial per the guide: Testimony, Panic Round, the Closing Argument, Monokuma's Reveal, Present per mode, OBJECTION! on the voice tile, Tamper's bullet (train: 1.2.90)

Base: part 1 merged (p1/STAGE.md, C0-C6) on 1a1bf1ff, line A; every anchor found again by its symbol. Same conventions
as part 1 (files and symbols, t2 tests E70-Tn, R-next). Part 1 holds the stages.json row, the keys, the state's
lifetimes and the write roads of its own commits; this file adds the rows of its commits. Every write here is an event
of part 1's `nextFloor` written in part 1's queue (`SEIZE_KEY`, `TRIAL_PROGRESS_KEY`) on the primary; part 2 adds no
writer of the floor or the record. Its scenario is 67-trial-modes (new; amend (m) said 66, which is 66-rooms since E12;
64 is planned for E38).

## Goal
The guide's trial tools on part 1's engine: Testimony and Panic Round, whose steps a participant's browser ends; one
Closing Argument per trial, from volunteers, a draw and the GM's confirmation, with an Objection exchange after which
the GM decides who continues; Monokuma's Reveal of the Key Remnants nobody found; Present by the mode's table, with the
choice to show the analysis or not, handing everybody a copy as shown; OBJECTION! on the voice tile; and a successful
Tamper that hands its author the bullet of the trace it left (the owner's four session requests of 27.10).

## The owner's words and binding decisions
- TR6 "Zeznanie - maks 2 minuty na osobę. Nie 3."; TR14 = 3: the GM types the turn at every start, 120 s offered, 30-120 s,
  the round's length shown live; the GM handbook's table (to 8: 120 s, 9-10: 90, 11-12: 75, from 13: 60). Panic Round
  "10-15 sekund maks", 15 s, 10 s offered from 12 participants, no Objection. TR26 = 1: a start limit guards the start
  window and the API only. TR8, TR10, TR19 = 2: no Consent, no Last defence, no Give the floor, no question from the
  floor. Pass is always legal - C7
- TR7: "proponuję 5 minut", one Closing per trial; TR23 = 1: 30 s of volunteering, names and the draw in a GM store, the
  players see a count, the GM confirms or picks anyone; DA18: "Wszędzie gracz ma proponować, a DM zatwierdzać lub
  zmieniać". TR24: "Mówca ma rebuttal, w oparciu o który gm decyduje, kto kontynuuje closing argument"; TR34 = 1: the
  speaker returns with the time left at the Objection, the objector gets a new 300 s, an Objection again is allowed;
  TR29 = 4: "Brak ochrony, chroni tylko GM" (no protected minute, no last call). Amend 7 (14.10): "Chcialbym usunac
  nagrode +3 hope za ostatni glos" - no reward, no `lastSpeakerHope`, no `closing.rewarded`, no card, and the volunteer
  window loses "Whoever holds the floor when it ends gets 3 Hope."; the speakers' record stays - C8
- TR5 = 1: "trafia do każdego uczestnika jak znaleziony, ze znanym typem i tekstem dla gracza, a odczyt dalej przez
  Analyze"; TR28 = 1: a Reveal past the paid count after a confirmation; amend 4 (h): `missingKeys()` from `keyPlanStore`
  and the hidden traces, the first find through `markKeyFound(slot, { source: "reveal" })` on `revealRemnantToFinder`'s
  road, `keysPaid` beside `keysCharged`; amend 4 (f): Reveal is not the default and not first in the DOM, Cancel is;
  amend 5 (c): the revealed copy's read joins E16's one Analyze filter, tested in the trial-modes scenario - C9
- TR2 = 1: in Straw Poll and Logic Dive (E73) everybody presents free; in a mode with a turn only the speaker; the others
  in Testimony and the Closing have an Objection at the speaker, in Panic Round nothing - C10
- Amend 9 (27.10, "uwagi z sesji"), each begins with a red test: "(1) Tamper: autor dostaje Truth Bullet własnego śladu
  przy udanym Tamper, a nie przy porażce z Despair. (2) Present: gracz wybiera, czy pokazuje bullet z wynikiem Analyze,
  czy bez; 'bez' ukrywa też zidentyfikowany typ. (3) OBJECTION!: przycisk na kaflu głosu (E78), wyszarzony poza rozprawą
  (w Daily Life i w śledztwie), a sterowanie w HUD-zie zostaje jako zapas. (4) Present udostępnia kopie tak, jak zostały
  pokazane, bez dodatkowego kosztu, a Share znika z wiersza rozprawy." The owner's triage answers (S/STATE.md, 27.10):
  B1 "Tamper success -> author's bullet; not on Despair failure", B2 "without hides the type", B3 "greyed outside trial;
  HUD fallback", B6 "copies as shown, no extra cost; Share gone in trial" - C10, C11, C12
- Amend 3: the tile may mark "has the floor" when the speaker it shows is `trialQueue.holderId`; a Monocub's "You
  listen" sits on the plate beside the ordinary microphone, never grey - C11. Amend 0: sounds for Panic Round's start,
  the Closing's start and the Reveal - C7, C8, C9. Music: Testimony, Panic and the Closing play `trial.discussion`, the
  Closing's Objection and Rebuttal the Objection's (risk) - C13

## What HEAD already does (at 1a1bf1ff, read)
- No round, no Closing, no Reveal: the fee is charged and stamped `keysCharged: true` with no count
  (investigation.mjs `chargeForUnfoundKeys`); `yourTurn` exists in `SFX_EVENTS`; `ANALYZE_TRIAL_FILTER` leaves E70 its
  row; handover.mjs `shareBullet` mints a copy through `createTruthBullet` with the analysis when the giver had it and
  never their failed attempt; sheet.mjs `buildBulletRow` draws Share in every phase and Present only in a trial; the
  Present card is posted by the presenter's browser, with the analysis always; OBJECTION! exists on the HUD's trial row
  only (hud.mjs `objectionControl`, already drawn held with a reason); no Tamper road mints a bullet (B.md B1).

## Acceptance (continues part 1 at E70-40)
| id | promise | how it is checked | commit |
| --- | --- | --- | --- |
| E70-40 | (S18-72) the round mode with presets testimony and panic in `MODE_RULES`; the order drawn at random, the GM may change it before the start; the list frozen at the start from `trialParticipants` (the undiscovered dead get no turn) | R-next t1 `nextFloor` rows | C7 |
| E70-41 | Testimony's turn typed at each start, 120 offered, 30-120, "A turn cannot be set longer than {max} s.", the round's length live in m:ss; the same guard on the API and a console's packet; +30 s during a turn passes it (TR26) | R-next t1; k4 | C7 |
| E70-42 | an Objection in Testimony only at the speaker, an exchange (60 + 120 s, cut-ins), then the queue goes on through `resume` on both roads that end a Rebuttal (the due tick and Skip) | E70-T9; k6 | C7 |
| E70-43 | Panic Round: 15 s, 10 s offered from 12, 10-15, no Objection, -5 s/+5 s | R-next t1; k5 | C7 |
| E70-44 | a step ends from a participant's browser by "trial.turn" (Done, Pass, step over); the primary writes the first that matches the mode and `step`; seven step-overs move once; the GM's clock is the backstop (S06-38) | E70-T9 (red first: the step stood with the GM's tab in the background); k1-k3 | C7 |
| E70-45 | the speaker's window "Your turn - {seconds} s" with Done and Pass, `yourTurn` for the speaker alone; "{name} passes."; a disconnected speaker passes at once; HUD "{name} speaks" / "Mówi {name}", Events "Next: {name}"; Panic's start sound | E70-T9; 75 | C7 |
| E70-46 | `startTestimony({ seconds, order })`, `startPanicRound(...)`; Skip skips a speaker; Overrule in a Testimony exchange gives the speaker the turn's rest and the queue its `resume` | R-next t1; E70-T9 | C7 |
| E70-50 | (S18-73) one Closing per trial, greyed after it ("This trial has already had its Closing Argument."); a second trial (D17) and the Final Trial have their own | R-next t1; c4 | C8 |
| E70-51 | the volunteer window (30 s) without the Hope sentence; "trial.claim"; names and the draw in `closingClaimStore`, trialQueue only "Volunteers: {n}" | E70-T10; c1 | C8 |
| E70-52 | a draw after 30 s or Skip; the GM sees "Drawn: {name}. Volunteers: {names}." and Confirm or Pick someone else (volunteers, the rest, "Already spoke in the Closing Argument"); players "The GM is confirming the speaker."; none: "Nobody volunteered. The GM picks a speaker or goes to the vote."; the card never tells a change | R-next t1 | C8 |
| E70-53 | (S18-74) 300 s; an Objection at the speaker at any second (TR29), by anyone but the speaker; the target fixed ("In the Closing Argument, an Objection can only be aimed at whoever is speaking."); its window names the decision to come; the price only when it takes the floor | R-next t1; c5 | C8 |
| E70-54 | the exchange 60 + 120 s with cut-ins; the speaker's clock stands (`leftAtObjection`); then "Who continues the Closing Argument?": the speaker with that time or the objector (or another of the chain) with a new 300 s; players "The GM decides who continues..."; "{name} continues the Closing Argument ({time})." | E70-T10; c2, c3 | C8 |
| E70-55 | Pass in a drawn or picked speaker's first 30 s resigns (back to the choice), later it is Done; Done and time end the Closing ("The Closing Argument is over.", the vote is the next step); End this mode in an exchange ends with no decision | R-next t1 | C8 |
| E70-56 | `trialProgress.closing { done, speakers: [{ actorId, via, messageId, leftAtEnd }] }` until the vote opens; `resumeClosing` gives the last speaker the rest; Overrule in its exchange gives the speaker the time at the Objection; no Hope paid (amend 7) | R-next t1; E70-T10 | C8 |
| E70-57 | `startClosing`, `confirmClosingSpeaker`, `pickClosingSpeaker`, `continueClosing`, `resumeClosing`, the same on gm2; the Closing's start sound | E70-T10 | C8 |
| E70-60 | (S18-71) "Missing Key Remnants" in the console from `missingKeys()`, a Reveal per row, the GM's text for a slot with no trace | E70-T11 | C9 |
| E70-61 | the confirmation: Reveal `drpg-destructive`, not default, not first; Cancel the default with autofocus; Enter reveals nothing | R-next t1 (red first) | C9 |
| E70-62 | "Left to reveal: {n}" = `keysPaid` (written with the fee, never recounted) less `revealedKeys`; past it after "No Despair was charged for this Key Remnant. Reveal it anyway?" | R-next t1 (a critical opening with 3 Keys); r1 | C9 |
| E70-63 | as a found Key: "Monokuma reveals a Key Remnant you never found." and a copy to each participant, the type and the player's text known, Analyze reading on (Q-p2-2); no fee; the first find with source "reveal", found once, the dashboard, rings, reset and fee reading it | E70-T11; r3, r4 | C9 |
| E70-64 | the revealed copy's row in `ANALYZE_TRIAL_FILTER` (amend 5 (c)); `revealMissingKey(slot, { text, beyondPaid })` on gm2 by the bridge; the Reveal's sound | E70-T11 | C9 |
| E70-65 | the player handbook no longer promises "what you fail to find, you will not have" (§2's table, §11; the PL brochure); the GM's §15 procedure | prose, 50 | C9 |
| E70-70 | (S18-79; TR2) Present by `modeAllows` on the sheet's row and in the window, its label and greyed reason from the row ("Only {name} can present right now.", "No Objections during {mode}."); the dead refused by the row | R-next t1 matrix (modes x roles) | C10 |
| E70-71 | (B2) the Present window offers with or without the Analyze result; without, the card shows the bullet as unanalysed (no analysis, no identified type, no Faint) | E70-T12 (red first: the card printed the analysis); p3 | C10 |
| E70-72 | (B6) Present hands every participant but the presenter a copy as shown, no cost, none twice, none without an answer key (told); the card posted by the primary through "trial.present" | E70-T12 (red first: no copy); p1, p2 | C10 |
| E70-73 | (B6) Share leaves the Truth Bullet's row in classTrial, stays outside it; the key's row unchanged | R-next t1; p4 | C10 |
| E70-75 | (B3) OBJECTION! on the voice tile's controls, held with its reason in Daily Life and the Investigation, live in a trial (`objectionButtonState`); the HUD's kept (Q-p2-4) | E70-T13; 75; b1 | C11 |
| E70-76 | (amend 3) the tile's plate says "has the floor" when its speaker is the holder; the Monocub's line beside a normal microphone | 75 | C11 |
| E70-78 | (B1) a successful Tamper that leaves the author's trace (a frame, a body moved) gives the author that trace's Truth Bullet at once, as a find; no bullet on a Despair failure (D8), nor on a failure at all (Q-p2-1) | E70-T14 (red first); e1 | C12 |
| E70-79 | the Tamper's Reroll takes the bullet back; a cover's success leaves no trace and no bullet | E70-T14; e2 | C12 |
| E70-82 | `TRIAL.modes` (round, closing, gm, budget) whole; music; the books EN, PL (§12's table of modes, §15: when to use them, Testimony's table, the Closing's exchange and decision, Resume, "listeners have the Objection and vote soon", the budget's estimate and skip order, never the Reveal, the Closing or the vote) | parity, prose, 50 | C13 |
| E70-83 | a turn's change is one console region and one HUD refresh per client, no sheet rendered beyond the Present button (81's case until E37, on E88's counters) | 67 | C13 |
| E70-84 | 67-trial-modes (ci): Testimony with an Objection and the queue back, a Closing with its exchange and both decisions, Overrule in both, the Reveal, Present's copies, playerLeakScan after every step; LIVE-E70-07..12 in audit 9.2 | 67; review | C7-C13 |

## Rules of this part
- D2 as part 1. New rows a player's browser sends: "trial.turn", "trial.claim", "trial.present"; each guard below.
  The volunteers and the draw never reach world data (`closingClaimStore`, R9 rule, 72-canary seeded).
- Present's copies are minted on the primary from the bullet as the GMs hold it (`bulletAsHeld`, `secretOf`), through
  `shareBullet`'s core with the room gate skipped (everyone is in the hall), not through `transferRefusal`'s "give".
- Without a GM connected Present is refused with the bridge's words (Q-p2-5); the API's `presentBullet` on a GM stays.
- Players' windows (Your turn, I'll sum up, the Closing's Objection, the Reveal's confirmation) are DialogV2 with
  `alreadyOpen`, one CSS block in both themes (amend 4 (f)).
- MARKED: C7, C8, C9, C10, C12. Not marked: C11 (the existing "trial.object" row), C13.

## Write roads (rows of this part; part 1's table holds the rest)
| field | road (file, symbol) | class | who | verdict | red-first test |
| --- | --- | --- | --- | --- | --- |
| floor | gm-bridge.mjs "trial.turn" (new): `knownSender`, `owns("actorId")`, `pick({ actorId: as.id, kind: as.oneOf("done", "pass", "over"), step: as.num })` | 6 | a participant's owner | done and pass: the speaker's owner; over: any participant, due on the primary's clock (1 s grace); mode and `step` equal; one per sender per step; the first wins | E70-T9 |
| floor, store | "trial.claim" (new): `knownSender`, `owns("actorId")` | 6 | owner | the volunteer window open; a participant; once | E70-T10 |
| `closingClaimStore` | gm-stores.mjs (new, resetGroup "trial") | 7 | primary | never world data | 72 |
| `closing` | trial-modes.mjs on the primary | 7 | primary | from the floor's steps | E70-T10 |
| card, copies | "trial.present" (new): `knownSender`, `owns("actorId")`, `pick({ actorId, itemId: as.id, comment: as.text, analysis: as.bool })` | 6 | owner | a trial; `modeAllows(present)`; alive and the bullet as held; the copy as shown; none twice | E70-T12 |
| copies, first find | trial-modes.mjs `revealMissingKey` by "trial.gm" op "reveal" | 6, 7 | GM | participants; once per trace | E70-T11 |
| `keysPaid`, `revealedKeys` | investigation.mjs `chargeForUnfoundKeys`; `revealMissingKey` | 7 | primary | the fee's own count; never recomputed | E70-T11 |
| the author's bullet | cleanup.mjs `applyMisleadingTrail`, `applyMoveBody` on the GM; the Tamper's undo | 7 | GM | success only; a receipt field for the Reroll | E70-T14 |
| OBJECTION! on the tile | voice-tile.mjs -> trial.mjs `raiseObjection` -> "trial.object" | 6 | owner | as at Base (part 1's floor) | 30 |

## Commits

### C7 - Testimony and Panic Round (S18-72; TR6, TR14, TR26)  [MARKED: "trial.turn", a row a player's browser sends that moves the floor]
- Files: trial-modes.mjs (new: the presets, `testimonyRefusal`, `panicSuggest`, the order's draw), trial-floor.mjs
  (`MODE_RULES` rows round.testimony and round.panic; `startTestimony`, `startPanicRound`; the step counter; `resume` on
  the stack), floor-machine.mjs (`done`, `pass`, `speakerGone`, the exchange in a round), trial-prompt.mjs (new: "Your
  turn" with Done and Pass), gm-bridge.mjs ("trial.turn", `requestTurn`), trial.mjs (`objectOnPrimary`: in a round the
  target is the speaker, in Panic no Objection), hud.mjs (`trialSlot`: the mode, the speaker, the clock), events.mjs
  ("Next: {name}"), sfx.mjs (`yourTurn` for the speaker alone), config.mjs (`TRIAL.modes.round`, `SFX_EVENTS.panicStart`),
  trial-floor-ui.mjs (the start window with the live length), api.mjs, lang EN/PL, scenarios/67-trial-modes.mjs (new)
  and README's row.
- Tests: R-next t1 (`nextFloor`'s round rows, the start guards, seven step-overs move once); E70-T9 (t2, 67: Testimony
  with an Objection and the queue back, Panic after 15 s with the GM's heartbeat held, the undiscovered dead without a
  turn). Closes E70-40 to E70-46. Scenarios: 67 63.
- Edge cases: the speaker's owner reloads (a pass when gone); a speaker who is the GM's spare (no owner connected: a pass);
  the GM reorders mid-round (refused: before the start only); a cut-in chain in Testimony; the Rebuttal ended by Skip.

### C8 - the Closing Argument (S18-73, S18-74 without the reward; TR7, TR23, TR24, TR29, TR34, DA18; amend 7)  [MARKED: "trial.claim"; the volunteers in a GM store]
- Files: trial-modes.mjs (`startClosing`, the draw, `closingRefusal`, `confirmClosingSpeaker`, `pickClosingSpeaker`,
  `continueClosing`, `resumeClosing`), floor-machine.mjs (`closing.*`: volunteer, confirm, speak, exchange, decide),
  gm-stores.mjs (`closingClaimStore` `{ volunteers, drawn }`), world-secrets.mjs (its rule), gm-bridge.mjs ("trial.claim"),
  trial-prompt.mjs ("I'll sum up"; the Closing's Objection window), trial.mjs (`objectOnPrimary`: the speaker as the
  target; the window's line), trial-floor-ui.mjs (Confirm, Pick someone else, the decision row, Resume, greyed after),
  vote.mjs (`closing` per trial; the vote's opening ends it), music.mjs (`refreshMusic`: the exchange plays Objection),
  utils.mjs (`listOf` new, minimal, E66's signature on `Intl.ListFormat`), config.mjs (`TRIAL.modes.closing`: volunteerSeconds
  30, seconds 300, perTrial 1, objection "exchange", gmDecides true, passWindowSeconds 30; `SFX_EVENTS.closingStart`),
  72-canary (seed), api.mjs, lang EN/PL.
- Tests: R-next t1 (draw, Confirm, a pick outside the volunteers and of one who spoke, none, an Objection at second 5,
  another target refused, the clock standing, both decisions, a chain, Pass in both windows, Skip, Resume, a second
  Closing refused, a second trial's allowed); E70-T10 (t2, 67: both decisions, Overrule in the exchange, no volunteers or
  draw in world data). Closes E70-50 to E70-57. Scenarios: 67 72.
- Edge cases: a volunteer who dies or turns Monocub in the window (dropped); the drawn person disconnects (back to the
  choice); End this mode during the decision; the vote opened by another GM mid-Closing (it ends).

### C9 - Monokuma's Reveal (S18-71; TR5, TR28; amends 4 (f), (h), 5 (c))  [MARKED: copies minted on the primary; a GM-only op]
- Files: trial-modes.mjs (`missingKeys()`, `revealMissingKey(slot, { text, beyondPaid })`), remnants.mjs (`markKeyFound`
  new on `revealRemnantToFinder`'s road, source "reveal"), investigation.mjs (`chargeForUnfoundKeys` writes `keysPaid`),
  vote.mjs (`revealedKeys` per chapter), action-rolls.mjs (`ANALYZE_TRIAL_FILTER`'s row), trial-floor-ui.mjs (the section
  and the counter; the confirmation), gm-bridge.mjs ("trial.gm" op "reveal"), config.mjs (`SFX_EVENTS.keyReveal`),
  docs/handbooks (player §2, §11, the PL brochure; GM §15), api.mjs, lang EN/PL.
- Tests: R-next t1 (the counter; Enter in the confirmation reveals nothing, red first); E70-T11 (t2, 67: N copies, the
  counter, the entry found, no text at a player before the Reveal, the Analyze row). Closes E70-60 to E70-65.
  Scenarios: 67 62.
- Edge cases: a Key placed after the fee (beyond paid); a slot whose trace was wiped; a participant who already holds a
  copy (none twice); a reset of the season after a Reveal; a GM store not hydrated (refused, said).

### C10 - Present per mode; Present shares as shown; Share leaves the trial's row (S18-79; TR2; B2, B6)  [MARKED: "trial.present" mints copies on the primary]
- Files: trial.mjs (`presentDialog`: `modeAllows`, the "with the Analyze result" choice; `presentOnPrimary` new: the card
  from `holderView` less `analyzedText`, `identified`, `faint` and with the unanalysed type when hidden, then the copies),
  handover.mjs (`shareBullet`'s core as `mintCopy(from, to, item, { analysis })`, the room gate left to Share),
  gm-bridge.mjs ("trial.present", `requestPresent`), sheet.mjs (`addPresentButton` from `modeAllows`; `buildBulletRow`
  without Share in classTrial), lang EN/PL.
- Tests: R-next t1 (`modeAllows` x modes x roles: discussion, debate, objection, rebuttal everybody; Testimony, the
  Closing, Panic the speaker; the dead and the undiscovered); E70-T12 (t2, 67: with and without the analysis, the card's
  words at p2 and p3, the copies, none twice, the Share button gone in the trial and back after). Closes E70-70 to E70-73.
  Scenarios: 67 33.
- Edge cases: a bullet never analysed (the choice not offered); a copy whose answer key is missing; a Monocub holding a
  copy already; Present in the Closing's exchange (the objector is not the speaker: refused by the row).

### C11 - OBJECTION! on the voice tile (B3; amend 3)
- Files: voice-tile.mjs (`buildVoiceTile`: a third mini button in `.drpg-voice-tile-controls`, the HUD's `control` rule,
  held with "Objection only in a Class Trial." outside one; the plate's "has the floor"), hud.mjs (`objectionControl`
  takes a host; kept on the trial row per Q-p2-4), styles (both themes, the narrow stack), lang EN/PL.
- Tests: E70-T13 (t2, 75: held in Daily Life and the Investigation, a press says why; live in a trial, one press raises
  one Objection; no tile: the HUD's alone). Closes E70-75, E70-76. Scenarios: 75 63.
- Edge cases: Monokuma Legacy; `voiceTile` off; avclient's own window ("external"); a Monocub or a dead viewer (none).

### C12 - a successful Tamper gives its author the trace's bullet (B1)  [MARKED: a bullet minted on the GM; the Reroll takes it back]
- Files: cleanup.mjs (`applyMisleadingTrail` on success, `applyMoveBody` after its trace: the copy minted as Observe's
  find mints it (observe.mjs `createFind`'s road) to the author, its id on the attempt's receipt (`RECEIPT_FIELDS`);
  the undo deletes it), lang EN/PL ("You know this trace: it is on your sheet.").
- Tests: E70-T14 (t2, 62's world: frame success, body moved, a frame's Faint failure and a Despair failure, a cover's
  success, each Reroll). Closes E70-78, E70-79. Scenarios: 62 83.
- Edge cases: the innocent's frame (no tie to the crime, E09 C4); the author already holding a copy; a trace placed
  in another scene than the author's sheet sees.

### C13 - the books, the music and the measures of part 2
- docs/handbooks (EN, PL: player §12's table of modes, GM §15), music.mjs, config.mjs (`TRIAL.modes` whole),
  67's render counts, audit 9.2 (LIVE-E70-07..12), audit/harness/README.md, docs/dev/R-REGISTRY.md. Closes E70-82 to
  E70-84. Scenarios: 50 67.

### Mutants (mut.sh; each old text once at Base, grep -c -F)
```python
s = "scripts/"
M = {
 "p1": (s+"handover.mjs", 'if (copiedRemnants(to).has(secret.remnantId)) {', 'if (false) {'),
 "r1": (s+"investigation.mjs", 'if (trialProgress().keysCharged) return null;', 'if (false) return null;'),
 "s1": (s+"sheet.mjs", 'if (!inClassTrial() || isDeceased(app.document)) return;', 'if (!inClassTrial()) return;'),
 "a1": (s+"trial.mjs", 'if (!objectionOpen()) return { refused: "the trial\'s floor is not open to an objection now" };', 'if (false) return { refused: "" };'),
}
# at the commit: k1 seven step-overs move twice; k2 Done from a non-speaker; k3 a step over before it is due; k4 a 121 s
# turn at the start; k5 an Objection in Panic Round; k6 the resume lost after a Rebuttal; c1 the volunteers in trialQueue;
# c2 the objector picked with the speaker's rest; c3 the speaker's clock running in the exchange; c4 a second Closing;
# c5 a target other than the speaker; r2 Enter reveals; r3 a copy to a Monocub; r4 a revealed Key found again;
# p2 a copy carrying an analysis the presenter hid; p3 the type shown when hidden; p4 Share in a trial; b1 the tile's
# OBJECTION! live outside a trial; e1 a bullet on a Despair failure; e2 the Reroll leaves the bullet
```
Symbol and harm: p1 `mintCopy` (`shareBullet`'s check) a second copy of one trace; r1 `chargeForUnfoundKeys` the fee and
`keysPaid` twice; s1 `addPresentButton` Present for the dead; a1 `objectOnPrimary` an Objection in Panic Round.

## What only a table can show
- LIVE-E70-07: Testimony at a table of 14-15 (the round's length, the table's patience).
- LIVE-E70-08: Panic Round's 15 s with real latency: does a step-over land within the second's grace.
- LIVE-E70-09: the Closing's draw, confirmation and decision with real people (DA18, TR23).
- LIVE-E70-10: Enter in the Reveal's confirmation in Foundry's own DialogV2 on v14.
- LIVE-E70-11: Present's copies and the absent Share at a table, both themes.
- LIVE-E70-12: OBJECTION! on the tile at 1366x768, in the narrow stack and with Legacy (the HUD's fallback).

## Out of scope
- Straw Poll, Logic Dive, Scrum Debate, the zones, Findings and its "Monokuma confirms" (TR28 a, b) -> E73.
- The Hope reward (amend 7, removed); Consent, Last defence, the floor's question (TR8, TR10, TR19).
- B4, B5 -> E51; A4, A5 -> E49; the Tamper rules beside B1 (S02-58) -> E64; unfound traces in the GM store -> E60.

## Open owner questions (each with a default; the stage runs on the default)
- Q-p2-1 Which Tamper roads give the author the bullet? Default: the successes that leave the author's trace (a frame,
  a body moved), none on a failure - also not the Faint trail a non-Despair frame failure plants, nor the trace a Hope
  failure is told of - because the words were "przy udanym Tamper".
- Q-p2-2 The revealed Key's copy: TR5 = 1 gives it "ze znanym typem i tekstem" and "odczyt dalej przez Analyze", while
  amend 5 (c) speaks of a "bezpłatny odczyt". Default: the copy is born with the Key type and the player's text, not
  analysed, and its Analyze in the trial costs what Analyze costs (TR5's reason: an unfound Key must not end better than
  a found one); the "free read" is the Reveal itself, and E16's filter row keeps that Analyze open, tested.
- Q-p2-3 The Objection's Truth Bullet picker: the same with-or-without choice as Present? Default: yes, same rule
  (without hides the type), no copies - one card builder, and a player who may hide their analysis on Present would
  otherwise be made to show it to object.
- Q-p2-4 OBJECTION! on both the tile and the HUD during a trial? Default: the HUD's stays as today ("zostaje jako
  zapas"), the tile adds its own; with no tile drawn the HUD's is the only one.
- Q-p2-5 Present with no GM connected: refused (default: the copies are minted on the primary, and a trial runs from a
  GM's console) or today's card with no copies?

## Owner answers of 27.10.2026 (binding; they win over anything above)
The owner answered all seven on 27.10 ~21:3xZ: (p1 Q1) ONE release - parts 1 and 2 ship together as 1.2.90 (part 1 is not released
alone; its stages.json row stays planned 1.2.90); (p1 Q2) yes - the Final Trial's sentence lives in the GMs' verdictStore, not in
the world record; (Q-p2-1) yes - a Tamper bullet only for the successes that leave the author's trace, none on any failure; (Q-p2-2)
yes - the revealed Key's copy arrives typed Key with the player's text, not analysed, Analyze at its usual cost; (Q-p2-3) yes - the
Objection's bullet picker gets the same with-or-without-analysis choice, makes no copies; (Q-p2-4) yes, as the orchestrator put it to
the owner: OBJECTION! MOVES to the voice tile (the owner's "przenieśmy"), and the HUD keeps it only where no tile is drawn (no
LiveKit, the voiceTile setting off, the narrow layout); (Q-p2-5) yes - Present with no GM connected is refused.
- 27.10 ~22:0xZ (the owner): "Skróćmy proponowane testimony do 1 minuty." Testimony's offered turn is 60 s (not 120); the range
  stays 30-120 s, so a GM may still type up to 120; the handbook's per-size table goes (its sizes all suggested 60-120, now the
  offer is 60 for every size); E70-41 reads "60 offered". Panic Round unchanged (15 s, 10 s from 12 participants).
