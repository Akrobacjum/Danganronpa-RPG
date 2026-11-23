# S0-REFUND: what gives back Hope or an action on a roll (E129, line DESP)

The owner's note from session 0 (23.11.2026): "niektore akcje zwracaja hope i akcje przy rzucie mimo ze nie powinny".
The owner did not say which. This is the inventory the coordinator asked for before anything is built: every road
that gives back Hope or an action around a roll, the code's line, the rule it follows, and whether it gives back more
than the rules text says. Lines are on origin/main 2e28785a (1.2.126). Read off the source on 23.11.2026; nothing
below was driven at a table. Where a row says "driven", a headless test drives it.

The rules text quoted: the player handbook (docs/handbooks/player-handbook.en.md), the brochure
(docs/handbooks/player-brochure.en.md), config.mjs, and the owner's earlier answers the code cites.

## The rule, as the handbook states it

- "A roll **with Hope** earns you 1 Hope." "A **critical** earns 2 Hope and nothing else" (player handbook 84, 86;
  brochure 14). "It comes back when rolls go your way (+1 with Hope, +2 on a critical)" (handbook 517).
- A statistic clicked on the sheet is a reaction roll: "it earns no Hope and feeds no Despair" (handbook 94).
- An action's price comes back on a critical only where its text says so: Work on Project ("a critical +2 and your
  action back", brochure 39; config.mjs `ACTIONS.project.critical.refundAction`), a Misleading Trail ("a critical also
  gives back what the attempt cost", handbook 500), a Monocub's critical Help (the target's action, monocub.mjs
  `scoreMeddle`).
- A Palm "refused before its dice are read (the target walked out, a Class Trial began) gives you its action back"
  (handbook 464). This is the owner's E14 part 1 Q3 (18.10.2026), "a refusal before the rolls are read refunds", which
  the code cites at action-analyze.mjs:342-344 and elsewhere.
- ROLL-05 (action-pipeline.mjs:978-990): a window closed after one of the action's rolls landed keeps the action spent,
  because "the first roll paid out its Hope ... refunding here made a free generator".

## The table

"Gives back" is what comes back. "When" is against the dice: before any roll, after a roll landed (its Hope and
Despair already paid), or after the GM read it. "Verdict": **ok** where the code matches the rule; **MORE** where it
gives back more than the rules text says; **UNCLEAR** where the rules text does not decide it - a question for the
owner.

| # | Road | Code | Gives back | When | Rule followed | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | A roll with Hope | Daggerheart's own, on a drawn action roll | +1 Hope | the roll | handbook 84 | ok |
| 2 | A critical | critical.mjs:96-104 (`CRITICAL.hope`, config.mjs:1278) | +2 Hope | the roll | handbook 86 | ok |
| 3 | A reaction (a statistic from the sheet) | despair-award.mjs:52 | nothing | the roll | handbook 94 | ok |
| 4 | **A supporting roll of a two-roll action** | action-pipeline.mjs:249 (`DRPG_ACTION_ROLL` on every `rollTrait`, `remember: false` too): Palm's and a Frisk's cover (palm.mjs:360, frisk.mjs:398), Tail's staying unseen (action-tail.mjs:136), Pick the Lock's cover (action-doors.mjs:162), an indirect murder's and a Sabotage's concealment (action-project.mjs:837, :885, :1320), a Take's cover (anonymity.mjs:573, :588) | +1 Hope (+2 on a critical) **for each roll**: one action can pay Hope twice | each roll | handbook 82-86 speak of "a roll"; nothing says whether an action of two rolls earns twice | **UNCLEAR** |
| 5 | Work on Project's critical | action-project.mjs:725 | the action (a Burst as a Burst) | after the roll | brochure 39; config.mjs:1686 | ok |
| 6 | A Reroll that keeps or loses Work's critical | reroll.mjs:2157-2190 (`settleActionRefund`; since 1.2.122 it reads what paid off the GMs' record) | the action, or takes it back | the Reroll | as row 5 | ok |
| 7 | A Reroll that fails before its dice | reroll.mjs:802-815 (`giveBack`) | the Reroll's 3 Hope | before the new dice | the Reroll's own price | ok |
| 8 | Misleading Trail's critical | cleanup.mjs (`paidBack`, the critical's give-back) | the attempt's price | after the roll | handbook 500 | ok |
| 9 | A Monocub's critical Help | monocub.mjs:1472, :2102-2106 | the target's action | after the roll | the Meddle row's critical (D21) | ok |
| 10 | A window closed before the action's first roll | action-pipeline.mjs:975-978 (`abort`) and its ~30 callers (`if (!roll) return abort(...)`) | the action, a Burst as a Burst | before any roll | nothing was thrown | ok |
| 11 | A later roll's window closed after the first landed | action-pipeline.mjs:987 (`spentAfterRoll`): Palm, Tail, Pick, Frisk, a concealed Work or Sabotage, a Tamper | nothing | after a roll | ROLL-05 | ok |
| 12 | **The GM presses "Refuse the attempt"** on a ruling card (an Observe with nothing to rank, a described Search, an Analyze hint, an Analyze critical's card) | messenger-app.mjs:1465 (`refundPrice`), action-pipeline.mjs `declineAction` | the action (or the chain's step: Hope or a Sanity mark in a Class Trial) | **after the roll landed** - the card is posted after the dice | action-pipeline.mjs `gmRulingActions`: "a question that is never answered has not been paid for" | **MORE**: the price comes back and the roll's Hope stays |
| 13 | **A refusal after the dice, before they are read** | action-analyze.mjs:195 (no GM), :241 (no answer key), :283 (card not sent), :338 and :347 (stash: no GM, a Class Trial), :371 (stash refused), :405 and :428 (passage: no GM, refused); action-observe.mjs:134 (no target answered), :273 (card not sent); action-search.mjs:131 (token unanswered or sealed), :208 (card not sent), :559 (GM left during the roll); action-facilities.mjs:192 (`alreadyDone`, `actionBlocked`, `notThere`); palm.mjs:263-268 (`handBackIfRefusedBeforeRolls`); cleanup.mjs:2438-2442 (`refundRefused`, a clean-up the GM refused) | the action or the chain's step (Hope or a Sanity mark in a trial) | **after the roll landed**: its Hope and Despair are paid | the owner's E14 Q3 (18.10): "a refusal before the rolls are read refunds"; T-1: "a road with nobody on it hands the price back"; handbook 464 for Palm | **MORE** against ROLL-05: the price comes back and the roll's Hope stays. The rule the code follows is the owner's own (E14 Q3), so this is a question first |
| 14 | Tail's target gone after its rolls | action-tail.mjs:153-165 | the action, **only when neither roll brought Hope** (1.2.123, r122-F-2) | after the rolls | E14 Q3 with ROLL-05 | ok (the shape the other row-13 roads could take) |
| 15 | A Frisk asked again, or handed back | frisk.mjs:461-470, :1262 | the action | before any roll | handbook 468, 472 | ok |
| 16 | A Hope Call that did not land | calls.mjs:313-325; bridge-runs-records.mjs:604-607 | the Call's Hope | no roll | the Call's price | ok |
| 17 | An Objection refused or not posted | trial.mjs:896-900, :1142-1160 | the Objection's price | no roll | its price | ok |
| 18 | Grant all (rolls thrown with no GM) | roll-draw.mjs:2940-2975 | what the dice moved, Hope and Despair | the GM's grant | "a grant moves what the dice moved" | ok |
| 19 | Echoes, a Betrayal or a Direct Murder not carried out | action-listen.mjs:352; action-murder.mjs:329, :425 | the action | no roll | nothing was thrown | ok |

## What the owner's note most likely names

"zwracaja hope i akcje przy rzucie" - Hope and the action back at the roll - fits rows 12 and 13: the roll has landed
and paid its Hope (+1, or +2 on a critical), and then the action (or, in a Class Trial, the chain's Hope step) comes
back too. A player keeps both. Row 4 fits too if "zwracaja hope" means "pay Hope": a Palm, Tail, Pick or concealment
action can earn Hope twice.

## Questions for the owner (before building)

1. Rows 12 and 13: when a roll has landed and the action is then refused or not carried out, should the action come
   back (a) never, as ROLL-05; (b) only when no roll of it brought Hope or a critical, as Tail since 1.2.123; or
   (c) always, as now (E14 Q3)? My proposed default, for the coordinator and the owner to confirm: **(b)**, one constant.
2. Row 12, the GM's "Refuse the attempt": the same question, or does a GM's refusal always give the price back?
3. Row 4: does an action of two rolls earn Hope from each roll, or from its main roll only?

The build waits for these answers. Each answer is one constant; nothing is built yet.
