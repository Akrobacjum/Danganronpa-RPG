# OWNER-128-SECOND-GM: what a second full GM can do

The owner at the table, 22.11.2026 ~21:15Z: "Drugi GM nie moze akceptowac akcji i generalnie ma ograniczone dzialanie -
powinien byc na rowni z pierwszym gmem." Two users of role 4 (Gamemaster), both online; the primary is the one
`primaryGmId` sorts first (utils.mjs:486: the smallest id of the connected full GMs).

Read on 9eb89710 (2e28785a + line CORE's 1.2.127 commits), 22.11.2026, by line CORE. How each row was settled:
**read** - the handler followed to its writes, file:line below; **verified** - re-read by line CORE after the first
reading; **driven** - pressed on `gm2` in a harness run (a scratch probe built on scenario 97-two-gms, not committed).
Only two rows are driven so far. Nothing here is measured on a real v14 table.

## How a GM's press reaches the primary

- A request a GM asks with `ask(..., { onPrimary: true, local })` runs on the primary only: on any other GM it is sent
  there (bridge-guards.mjs:1962, `if (self.isGM && typeof local === "function" && (!onPrimary || self.isPrimary))`), and
  only the primary's `onSocket` judges it (bridge-table.mjs:1694). Without `onPrimary`, `local` runs on whichever GM asked.
- A chat card's buttons (`data-drpg-call`) are wired on every GM (messenger-app.mjs:842 `wireCallActions`, `isGM` only),
  in the log and in the messenger's Timeline alike. A press claims the card on the primary first (bridge-asks.mjs:1407
  `claimCard`, call-gm.mjs:1089 `claimOnPrimary`), so two GMs never rule one card twice, and is then ruled by the rule of
  `CARD_ACTIONS` (messenger-app.mjs:1514) on the GM who pressed.
- GM stores (gm-store.mjs) are written by any GM and merged per field; world settings and documents by any GM.

## Counts

| Area | Controls inventoried | Work (local) | Relayed to the primary | Refused for the second GM | Silent or partial |
| --- | --- | --- | --- | --- | --- |
| Chat cards: the 29 `CARD_ACTIONS` and 3 other card buttons | 32 | 21 | 11 | 1 (stale ask, below) | 1 (Observe's pick) |
| GM panel, Students, Edit campaign, Despair, Projects, Murder window and tracker, Investigation, Room Setup, Season, Sound | 58 | 38 | 14 | 5 | 1 (the opening roll) |
| Class Trial, incident, Eclipse, rulings a player waits on, the messenger's Timeline | 39 | 14 | 19 | 3 | 3 |

About, not exact: a row that works locally and then relays a part (a project's Approve, a statistic's pick) is counted
as relayed, and End the chapter and Announce the body, reached from several windows, are counted once per window.

## The roads a second GM cannot take, worst first

| # | Road | What happens on the second GM | Evidence | Kind |
| --- | --- | --- | --- | --- |
| 1 | **Observe's "say what it is"**: a player's find waits for a GM to name it | The naming window opens on the primary alone; the other GMs are whispered `DRPG.Observe.describeWaiting` and have no control. Nobody at the primary: the find goes out under its prefilled name after `TIMING.rulingMs`. The player waits on one GM's screen. | observe.mjs:1149 (`describeFind` inside `resolveObserve`, run on the primary), :1318-1330 | silent for the second GM (verified) |
| 2 | **The opening roll resolved on the second GM** (it opened the murder, or pressed Ask again, with the roller's player away) | The roll is thrown and resolved on the second GM's browser (`requestOpeningResult` has `local` and no `onPrimary`). There `maskKiller` and `markWitnessesAt` return at once: an opening on Hope or a critical puts up no "?" mask for the killer, the victim's copy of the cast names the killer, and no Monocub in the room is marked a witness. Nobody is told. | bridge-asks.mjs:46-50; mask-gm.mjs:230 `if (!game.user?.isGM \|\| !isPrimaryGm()) return false`; monocub.mjs:646 | silent, and a privacy leak at the table (verified) |
| 3 | **Announce the body** (the murder's end checklist, the dashboard's Body found, the panel's Next) | Refused: `DRPG.Chapter.bodyPrimaryOnly`. The checklist hides its button with that note, the panel disables it, the dashboard's button stays lit and is refused after the window closes. | body.mjs:177-181; murder-rules.mjs:3875-3925; investigation.mjs:2290, :2677-2687 | refused (read) |
| 4 | **End the chapter** (the panel, Edit campaign, the trial console) | Refused: `DRPG.Chapter.endPrimaryOnly`. The trial console's button stays live and refuses with a toast. | chapter.mjs:435, :921-925; gm-panel.mjs:1116-1120; trial-floor-ui.mjs:1500, :1864 | refused (read) |
| 5 | **A Call's yes, a Dynamic action's difficulty or refusal, when the player no longer waits** | The primary answers "nothing was carried out", which reaches the second GM as a bridge refusal (`DRPG.Bridge.notDone`); the card stays open with live buttons, and a press repeats the refusal. On the primary the same case settles the card "The player was no longer waiting." | bridge-runs-acts.mjs:1116-1127; bridge-asks.mjs:785, :826; messenger-app.mjs `askNotHeld` | refused differently (verified) |
| 6 | **Finish the verdict** | Refused unless this GM gave the verdict while connected: `DRPG.Vote.finishOtherGm`. | verdict.mjs:1088, :1108-1111 | refused (read) |
| 7 | **Reset the season** | Refused: `DRPG.GmStore.resetPrimaryOnly`; Season setup closes first, unsaved, so typed edits are lost. | season-wipe.mjs:223-227, :350-354; season-setup.mjs:1348-1351, :1367 | refused (read) |
| 8 | **Re-send the voice rooms** (GM panel tile) | Drawn disabled: `DRPG.Voice.resetRefused.primary`. | gm-panel.mjs:338-349 | refused (read) |
| 9 | **Pass the turn** in the crisis | Refused only while this GM's copy of the cast has not arrived: `DRPG.Murder.castNotArrived` / `castMissingHere`. | murder-rules.mjs:3172-3176; incident-store.mjs:1074-1081 | refused, transient (read) |

Smaller differences, which block nothing:

- Observe's pick from a card: the second GM's picker lists its own rows' candidates; the primary may answer "not there"
  (`DRPG.Observe.pickNotThere`) and the card stays open (observe.mjs:446-459; call-gm.mjs:466-468).
- A refund or a Sanity charge ruled on the second GM reads the sheet's own values, not the GMs' marks the primary holds
  (sheet-audit.mjs:931 `heldMark ... isPrimaryGm()`): a console-raised maximum not yet put back can lift it there.
- A Monocub's Ask for Hope spends the pressing GM's own Despair pool; a GM with none is refused `DRPG.Despair.poolEmpty`.
- The messenger's Timeline stream holds the notices this browser was shown; the ones raised on the primary alone are not
  in the second GM's stream (messenger-gm.mjs:319-321). Its Waiting list is every GM's, with live buttons.
- The vote's status line reads "no ballots" on a GM that is not the primary (vote.mjs:734); Close and count works.

Found after the inventory, while the fixes were driven (22.11.2026):

- **Finish on the trial console**, row 6's button: drawn greyed on every GM but the verdict's runner, so the relay
  `finishRoute` gives a second full GM could not be pressed (trial-floor-ui.mjs, fixed in 1c546cae). R8732 reads the
  route alone; scenario 97 U presses the console's Finish on gm2.
- **The opening's request card to its player**: posted on whichever GM asked, after a read of the GMs' memo of the cards
  that the post did not hold, so a second GM's re-ask, or two asks on one browser, posted a card each. Scenario 61 F9b
  read three cards where one was due, once in 3 runs at 5ea9323b; no run since reproduced it, and the cause is a reading
  of the code, not a trace. The card is the primary's to post now (murder-rules.mjs `postOpeningCard`,
  `murder.openingCard`), held in flight from the memo's read to its write; scenario 97 T drives the race.

## What works (read, not each driven)

Every chat card's ruling (Approve or Refuse a Call, a statistic, a Dynamic action, a project, a reshape, a declared
murder; the trap's three; item effects; Create or Give an item; Nothing was there; Decline; Reply; a Key Remnant here; a
Monocub's Ask), the held Key fee, Grant all / none of rolls thrown with no GM, Keep / put back a flagged sheet write;
the Students window, Edit campaign's Apply, the Despair pips and pools, every project control, the Murder window and the
tracker but the body, the Investigation dashboard's Save and editors, Room Setup, the Sound window's Play and Stop
(scenario 97 M), every trial floor control, votes, Monokuma's Reveal, the Findings, the verdict itself, End the trial,
Start and End the lights. **Driven on gm2:** Decline and Nothing was there on a player's card, pressed in gm2's Timeline,
settle the card on both GMs and the player ("Answered by Second GM.").

## Not covered yet

The item hub (gm-items.mjs `openItemManager`), the Tables editor, the Mastermind and Rules windows, every cell of the
Passages tab, the far callees of `rollOpening`. And one assumption not read on v14: `primaryGmId` sorts the full GMs'
ids by code unit (`.sort()`), and Foundry's own active GM may sort them otherwise (ids differing in a letter's case);
for the owner's two ids (`9KWZ...`, `atHQ...`) both orders agree.
