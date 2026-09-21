# ROLLS (actions and dice) - findings

Static read of every file in the domain, end to end, following each flow into gm-bridge.mjs,
call-effects.mjs, utils.mjs, observe.mjs, analyze.mjs, vault.mjs, cleanup.mjs, remnants.mjs,
messenger-app.mjs (`runCallAction`), traps.mjs (hook relays) and movement.mjs (`countsAsPresent`).
Every `DRPG.*` key used in the fifteen files was cross-checked against lang/en.json: no missing
keys; the four dynamic prefixes (`Action.placeholder.*`, `Action.duality.*`, `RollDialog.source.*`,
`Look.*`) all resolve.

## Files read (with line counts)

| file | lines |
| --- | --- |
| scripts/action-rolls.mjs | 4402 |
| scripts/actions.mjs | 331 |
| scripts/roll-dialog.mjs | 827 |
| scripts/private-rolls.mjs | 649 |
| scripts/forced-roll.mjs | 120 |
| scripts/reroll.mjs | 892 |
| scripts/critical.mjs | 122 |
| scripts/observe.mjs | 557 |
| scripts/analyze.mjs | 208 |
| scripts/search-tokens.mjs | 413 |
| scripts/despair-award.mjs | 252 |
| scripts/resources.mjs | 61 |
| scripts/resource-guard.mjs | 163 |
| scripts/look.mjs | 130 |
| scripts/patches.mjs | 166 |
| scripts/config.mjs (ACTIONS 1027-1398, OBSERVE_DC 811-863, CRITICAL 883-886, ANALYZE_DC 928-950, DYNAMIC_THRESHOLDS 1509-1514, ACTIONS_RESOURCE 206) | ~600 |
| neighbours (partial): gm-bridge.mjs, call-effects.mjs, utils.mjs, messenger-app.mjs, vault.mjs, cleanup.mjs, remnants.mjs, movement.mjs, traps.mjs, eclipse.mjs, sync.mjs, settings.mjs | - |

## Strengths

- Privacy is enforced at the last possible moment and keyed on the SUBJECT of the roll, not the
  author (private-rolls.mjs:399-462 + `enforceContentVisibility` 358-395). A GM rolling for a
  student still produces a whisper to the GMs and that student only; Daggerheart's template
  bypass of `isContentVisible` is closed at render time with class + inline style. No player
  client ever sees another student's dice in the log.
- Scoring for Observe, Analyze, Steal/Plant and Locate-a-stash is done on the GM's client
  against the config tables (`observe.mjs:296`, `analyze.mjs:79`, `vault.mjs:1189-1191,
  1379-1381, 1518`); the player's client sends only the total. Every socket handler checks
  `senderOf`/`ownsActor` on Foundry's own `senderId` (gm-bridge.mjs:359-374).
- Thresholds are read from config in the action paths: `resolveThreshold(roll.total,
  def.thresholds)` everywhere in action-rolls.mjs; Listen's "named" tier is derived
  (`namedFrom = Math.max(...def.thresholds...)`, 3820); `easedBy()` derives tool relief instead of
  copying numbers. The one hand-written `18` (2413) is commented as such.
- The Free Critical is honest dice: the loaded randomiser lives on that one Roll instance's
  `evaluate` and is lifted in a `finally` (forced-roll.mjs:77-120); a cancelled dialog disarms it
  (action-rolls.mjs:507-512) without consuming the Call (consume happens only after a result,
  541-545).
- Supporting rolls (conceal intent, hide traces, Palm's Shadow roll) are shielded from an armed
  Call and from situational advantage (`shieldCalls` / `situationalAdvantage`,
  call-effects.mjs:53-105), and the Reroll bookmark is written fresh with `replaceFlag`
  (action-rolls.mjs:596-612) so stale `gmRuled`/`itemId` cannot leak between actions.
- Search's token is only claimed once the dice are on the table (1023-1027) and the
  "no GM answered" case is told apart from "picked clean" and refunded (1039-1072).

## Findings

### ROLL-01 [severity: major] [category: bug] [CONFIRMED]
**Where:** scripts/action-rolls.mjs:2903, 2946, 3002; scripts/reroll.mjs:295-315
**What happens:** Palm rolls its Hand roll with `actionKey: "steal"` but both `noteRollContext`
calls overwrite the bookmark with `actionKey: "palm"`. `replayAction` has `case "steal"` and no
`case "palm"`, so a Reroll after a Palm falls to `default` and prints
`DRPG.Reroll.noReplay` ("Nothing but the dice to take back: this roll left no lasting effect") -
the exact sentence `settleSteal` (reroll.mjs:659-681, "trap 94") exists to prevent. The
`settleSteal` branch is unreachable.
**Evidence:**
```js
// action-rolls.mjs:2902-2905
const hand = await rollTrait(actor, def.traits[0], { actionKey: "steal", ... });
// action-rolls.mjs:3001-3004
await noteRollContext(actor, { actionKey: "palm", room, victimId: victim.id, seen, success, itemId: chosenId });
// reroll.mjs:306
case "steal": return await settleSteal(actor, bookmark, after, done);
```
**Fix:** Use one key. Either `noteRollContext(actor, { actionKey: "steal", ... })` in both Palm
branches, or add `case "palm":` next to `case "steal":` in `replayAction`. The
`drpgActionResolved` hook can keep emitting `"palm"` (traps key on it).
**Pitfalls:** traps.mjs matches `actionKey` from the hook, not from the bookmark - do not
rename the hook payload.

### ROLL-02 [severity: major] [category: bug] [CONFIRMED]
**Where:** scripts/reroll.mjs:366-445 (`settleSearch`); scripts/action-rolls.mjs:1039-1072
**What happens:** A Search whose token was refused (room picked clean, or GM did not answer)
bookmarks `{actionKey:"search", room, category, goal, tier:null}` and stops. `settleSearch`
never checks that a token was actually claimed: it scores the new dice, calls `drawItem` and
`grantItem`, and drops a Remnant. Three Hope therefore turns a refused search into a granted
item - from a room with zero tokens, and (in the "unanswered" branch) after the action was
refunded, i.e. for no action at all.
**Evidence:**
```js
// action-rolls.mjs:1066
await noteRollContext(actor, { actionKey: "search", room, category, goal: goalKey, tier: null });
// reroll.mjs:398-411
if (found && bookmark.category) {
    const drawn = await drawItem(bookmark.category, tier, { goal: bookmark.goal ?? null });
    ...
    const granted = await grantItem(actor, { ... });
```
**Fix:** Record `claimed: false` (or `exhausted`/`unanswered`) on the bookmark in the refused
branch and have `settleSearch` push `DRPG.Reroll.noReplay`-style text ("the room was never
searched") and return `{}` when it is set. The same guard should cover `fromVault: true` (1177):
a stash find has no `itemId` on the bookmark and a reroll would draw a second item from the
room table on top of the stash loot.
**Pitfalls:** `tier: null` is also written on an ordinary miss (1143) - key the guard on a
dedicated field, not on `tier === null`.

### ROLL-03 [severity: major] [category: bug] [CONFIRMED]
**Where:** scripts/reroll.mjs:421-445 vs scripts/action-rolls.mjs:1281-1338
**What happens:** The Search replay uses the OLD trace rule the live action explicitly
retired. `performSearch` leaves a Remnant only when the roles of what was FOUND include
`crimeTool`/`cleaningTool` (1307) and ties it with `tiedToCrime: null` (1327, "NOT TIED BY
CATEGORY ANY MORE, Dawid 28.08"). `settleSearch` leaves one for every category except
`usable` - so a rerolled hunt for a `tool` (screwdriver) drops a trace the first roll never
would - and stamps `tiedToCrime: true`, putting it at the top of the dashboard's murder-first
sort. The replay also omits `room` from `drawItem` (403; live path passes `{ goal, room }` at
1197) so room tables are bypassed, and omits `itemIdentity`, so `tieTraceForItem` can never
find the trace later.
**Evidence:**
```js
// reroll.mjs:421,430
const leaves = Boolean(bookmark.category) && bookmark.category !== "usable";
...  tiedToCrime: true,
// action-rolls.mjs:1306-1307
const roles = new Set([category, ...(drawn?.roles ?? [])]);
const leaves = roles.has("crimeTool") || roles.has("cleaningTool");
```
**Fix:** Move the "what was found decides the trace" rule into one exported helper used by both
(`leavesTraceFor(category, drawn.roles)`), pass `room: bookmark.room` and the granted item's
identity, and use `tiedToCrime: null`.
**Pitfalls:** `drawItem`'s `roles` on a reroll are needed for the rule - keep the `drawn` object.

### ROLL-04 [severity: major] [category: bug] [CONFIRMED]
**Where:** scripts/reroll.mjs:339, 459-477 vs scripts/action-rolls.mjs:1998, 2389, 2413
**What happens:** Work on Project and Sabotage lower their bands by the readied Tool's tier
(`easedBy(def.thresholds, relief)`; `score >= 18 - relief`). The bookmark does not carry
`relief`, and the two replays score against the raw bands and a bare `18`. A player with a
Tier 2 tool who rolled 16 (a hit at the eased 16) and rerolls into 17 is told the project
"no longer" progresses / the sabotage "now fails" - a strictly worse rule than the one they
paid three Hope to re-run under.
**Evidence:**
```js
// action-rolls.mjs:1996-1998
const hit = roll.isCritical ? def.critical : resolveThreshold(roll.total, easedBy(def.thresholds, relief));
// reroll.mjs:339
const hit = after.isCritical ? def.critical : resolveThreshold(after.total, def.thresholds);
// reroll.mjs:477
: score >= 18 ? PROJECT_SCALE.complex.progress : PROJECT_SCALE.trivial.progress;
```
**Fix:** Put `relief` in the `context` of both `rollTrait` calls (1981, 2372) and apply
`easedBy(def.thresholds, bookmark.relief ?? 0)` / `18 - relief` in `settleProgress` and
`settleSabotage`. Better: derive the "complex" repair from the band object (add
`repair: PROJECT_SCALE.complex.progress` to the 18 band in config) so the `18` is not written
in two files.
**Pitfalls:** `breakOnDespair` may already have destroyed the tool by reroll time; read the
relief from the bookmark, never from the inventory.

### ROLL-05 [severity: major] [category: bug] [CONFIRMED]
**Where:** scripts/action-rolls.mjs:905-908, 1941, 2314, 2900-2906
**What happens:** The comment on `abort()` says paying first and refunding on cancel closes
the "collect a supporting roll's Hope, then cancel" generator. It does not: Palm throws the
Shadow roll (Hope/Despair committed by `commitResources`, 541), and if the player then closes
the Hand roll's dialog `abort` hands the action back. Same for a watched Sabotage (conceal
roll, then cancel) and a watched indirect-murder project. Each cycle costs nothing and pays
+1 Hope on a Hope result (or +1 Despair to the Monokuma on a Despair result); the player can
repeat it until a Hope result lands. The action-first ordering only helps when the FIRST roll
is cancelled.
**Evidence:**
```js
// action-rolls.mjs:2898-2906
const shadow = await rollTrait(actor, unseen.trait, { remember: false, ... });
if (!shadow) return abort(actor, cost);
const hand = await rollTrait(actor, def.traits[0], { actionKey: "steal", ... });
if (!hand) return abort(actor, cost);
```
**Fix:** Once any roll of the action has landed, a cancel of a later roll must not refund:
return `null` without `abort` (and say so in the card: "the action is spent - your hand was
already in"), or reverse the supporting roll's resource updates. The dialog's own Cancel is the
one place a player can still back out for free, and that is the first dialog.
**Pitfalls:** `takeCrisisAction` in murder.mjs uses `rollTrait` too - check it does not rely on
`abort` after a landed roll.

### ROLL-06 [severity: major] [category: bug] [CONFIRMED]
**Where:** scripts/action-rolls.mjs:1009, 568-572, 738-742, 4261; scripts/roll-dialog.mjs:303-334
**What happens:** Search unlocks the trait select so the player may switch Eye -> Hand in the
roll window ("pick your approach"), but `throwDice` records `trait: drpgTrait` - the argument
(`eye`), never what the dialog actually rolled. Every consumer then mislabels the roll: the
card header (`cardHead` trait, 4261/4308), the duality bar's statistic chip reads
`rollData.traits[eye].value` and pushes the difference into the "Advantage, disadvantage and
experience" chip (738-750), the popup, the day summary, and the Reroll bookmark's `trait`
(which `settleGmRuling` sends to the GM). A Hand search shows "Eye +1" with a phantom bonus.
**Evidence:**
```js
// action-rolls.mjs:566-572
const outcome = { total, ...dualityOf(roll), trait: drpgTrait, freeCritical: free, raw: result };
```
**Fix:** After the roll, read the trait the system actually used
(`result.roll?.options?.roll?.trait` / `result.data?.roll?.trait` - confirm the field on a live
result) and map it back through `TRAIT_BY_DH`; fall back to `drpgTrait`.
**Pitfalls:** Determination (`grants: "trait"`) opens the same select for every action, so this
mislabel already happens for any Call-bought trait change, not only Search.

### ROLL-07 [severity: major] [category: flow] [CONFIRMED]
**Where:** scripts/action-rolls.mjs:3956-3979; scripts/gm-bridge.mjs:1615-1628
**What happens:** Direct Murder spends the action (3956), asks for the note, then
`parkDirectMurder` -> `requestParkMurder`. With no GM connected `hasGm()` toasts "No GM is
connected" and returns `null` - nothing is parked - but the code carries on: the player is
whispered "Your move is made. The GM has to allow it..." and toasted "Declared." The action is
gone and no declaration exists anywhere. The eclipse is exactly the moment a GM tab may be
reloading.
**Evidence:**
```js
// action-rolls.mjs:3970-3976
await parkDirectMurder({ killerId: actor.id, room, note });
await whisperToOwner(actor, `...DRPG.Action.murderParked...`);
ui.notifications.info(game.i18n.localize("DRPG.Action.murderParkedToast"));
```
**Fix:** Check `gmOnline()` before `spendAction`, and test the return of `parkDirectMurder`:
on `null`, refund and whisper that nothing was declared. `requestParkMurder` is fire-and-forget
(`expectAck`), so the "GM connected but did not answer" case still needs the ack timeout's
warning to say the declaration may be lost.
**Pitfalls:** `promptForNote` deliberately cannot cancel; keep that, but the refund must come
BEFORE the note dialog is skipped, or the dialog itself becomes the refund trigger.

### ROLL-08 [severity: minor] [category: flow] [CONFIRMED]
**Where:** scripts/action-rolls.mjs:4080-4090; scripts/gm-bridge.mjs:816-826
**What happens:** When the GM presses "Refuse" on the Dynamic difficulty dialog, `ruling: null`
comes back and `performDynamic` returns silently (`if (!picked) return null;`). The player
already received "Waiting on the GM..." and then sees nothing - no card, no toast - and cannot
tell a refusal from a hung socket until the 180 s timeout text ("No GM answered") would have
appeared, which it does not. The GM-side card posted a second earlier by `promptAndCallGm`
still reads "Awaiting a ruling." forever.
**Evidence:**
```js
// action-rolls.mjs:4088
if (!picked) return null;
```
**Fix:** Distinguish `null` (unanswered, already toasted) from `false`/`{refused:true}`; whisper
`DRPG.Action.dynamicRefused` ("The GM turned it down. Nothing was spent.") and settle the card
(`settleCall`) from the GM side on refusal.
**Pitfalls:** The socket handler for `ACTION_DIFFICULTY` (816) has no `ownsActor` check - it
only opens a dialog, but a forged payload can spam the GM with modals; add the same
`senderOf` guard as its neighbours while touching it.

### ROLL-09 [severity: minor] [category: flow] [CONFIRMED]
**Where:** scripts/action-rolls.mjs:3573-3576, 3482
**What happens:** `askForHint` builds its "There is nothing" button with
`gmRulingActions(actor, def.cost ?? 1)` instead of the `cost` computed in `performAnalyze`
(`options.free ? 0 : def.cost`). A free Analyze (API/`free: true`) that the GM declines refunds
one action that was never charged. Every other ruling card passes the real `cost`.
**Evidence:**
```js
// action-rolls.mjs:3575
actions: gmRulingActions(actor, def.cost ?? 1)
```
**Fix:** Thread `cost` into `askForHint(actor, def, roll, request, cost)`.
**Pitfalls:** none.

### ROLL-10 [severity: minor] [category: flow] [CONFIRMED]
**Where:** scripts/action-rolls.mjs:1177-1210; scripts/vault.mjs:1057-1074
**What happens:** A successful Search that lands on a stash tells the player on its own card
"You find {item} in the stash" (`DRPG.Vault.foundInStash`) BEFORE the GM side rules. `stealFromVault`
can still return `null` without a word - `grantItem` refusing for carry limits (`if (!copy)
return null;` 1074) or a refusal - and the thief then holds a card naming an item they never
received. Palm (3009-3027) deliberately avoids this ("this card says the question went out;
the verdict comes from the other side"); Search does not.
**Fix:** Use the same wording pattern as Palm on the Search card ("You find somebody's hiding
place - what comes out settles in a moment"), and have `stealFromVault` whisper a
`DRPG.Vault.handsFull`-style line when `grantItem` refuses.
**Pitfalls:** The stash owner's `noticed` whisper (clumsy) should still only fire when the
transfer happened.

### ROLL-11 [severity: minor] [category: ux] [CONFIRMED]
**Where:** scripts/action-rolls.mjs:3242-3249, 3111-3120
**What happens:** For General / Non-obvious / Follow-my-traces, if the GM side reports nothing
to find (`!target.ok`), the fallback is `performGmAction`, which opens `askTraitAndRequest` -
a SECOND window asking "Observe - what are you trying to do?" right after the declaration
window that already carried the request box. The request typed in the first window is
discarded. `observeSpecific` (3272-3298) handles the same case with no extra window.
**Fix:** Pass `request` through and go straight to the roll + `ruleObserve`, as
`observeSpecific` does; `performGmAction` then has no caller and can go (see hygiene).
**Pitfalls:** Keep the "the player is not told the room is empty" property - the fallback must
look identical to a normal ruling.

### ROLL-12 [severity: minor] [category: ux] [CONFIRMED]
**Where:** scripts/action-rolls.mjs:1710-1790, 2237-2300 (`performProject` -> `performSabotage` -> `chooseProjectAndTrait`)
**What happens:** Choosing "Sabotage" in the Projects window opens `chooseProjectAndTrait`,
which prints the Sabotage briefing block and asks for project + trait again - the Projects
window already showed a briefing, a project select and a trait select, all of which are
ignored for this branch. Two windows for one choice, the pattern the file's own comments call
"the friction this whole pattern removes". The `chooseProjectAndTrait` comment ("Sabotage's own
path opens this dialog first") predates E12.
**Fix:** In `performProject`, populate a `<select name="sabotage">` in `extra` (with
`data-drpg-when="sabotage"`) from `breakable`, read it and call a `performSabotage(actor, def,
options, { project, trait })` variant that skips its own picker, like `workOnProject` does.
**Pitfalls:** `performSabotage` is also the target of `ACTIONS.sabotage` via API; keep the
picker for the no-preselection call.

### ROLL-13 [severity: minor] [category: bug] [SUSPECTED]
**Where:** scripts/actions.mjs:122-201; scripts/messenger-app.mjs:decline branch (`refundAction(actor, cost)`)
**What happens:** `refundAction` reads the client-local `lastSpend` map to decide whether to
return a pip or a Burst grant. The GM's "Nothing was there" refund runs on the GM client,
where the map holds whatever the GM last spent FOR that actor - a Burst-paid spend made while
driving the student's sheet is never cleared (entries are only deleted by a refund). The
refund then re-grants a Burst instead of the pip that was charged on the player's client; the
Burst survives until the next reset the same way. Needs a live run to see whether GMs ever
spend on a student's behalf in practice.
**Fix:** Have the ruling card carry `paid: "grant"|"action"` (from the player's own
`lastSpend`) and pass it to `refundAction` explicitly; clear `lastSpend` on every successful
action end, not only on refund.
**Pitfalls:** `settleActionRefund` in reroll.mjs relies on the map too.

### ROLL-14 [severity: minor] [category: leak] [SUSPECTED]
**Where:** scripts/roll-dialog.mjs:465-467; scripts/private-rolls.mjs:433; scripts/despair-award.mjs:23-29
**What happens:** The roll-mode select is disabled ("privacy is enforced by the module") but
its VALUE is whatever Daggerheart pre-filled - normally the client's own core roll mode, which
every player can set from the chat sidebar. If a player sets "Self Roll", the system creates
the message with `whisper: [self]`; `onPreCreateChatMessage` then returns early ("Already a
whisper - respect whatever aimed it there"), the primary GM never receives the message, and
`onChatMessage` in despair-award.mjs never fires: that player's Despair results stop feeding
their Monokuma, silently, for as long as the mode is set. The module's own report card still
reaches the GM, so the leak is of Despair income, not of dice. Needs a live check of what the
system puts in `selectedMessageMode` when the dialog opens from `actor.rollTrait`.
**Fix:** In `onPreCreateChatMessage`, when the subject is a student and the existing whisper
list does not contain every GM, rewrite it anyway (add GMs + owner); or force
`config.selectedMessageMode = "publicroll"` in `throwDice`'s config so the module's rule is
the only rule.
**Pitfalls:** Blind rolls a GM makes on purpose must keep working - key the rewrite on the
subject being a student and the list lacking a GM.

### ROLL-15 [severity: minor] [category: text] [CONFIRMED]
**Where:** lang/en.json `DRPG.Observe.general`, `DRPG.Analyze.askHint`; scripts/config.mjs:1103, 1113-1118
**What happens:** Two menu rows are named differently from everything that describes them.
`Observe.general` is "Glance for a bullet" - the thing found is a Remnant/Truth Bullet, but
the row's own hint says "Take whatever is easiest to spot in this room" and the config
description says "look for evidence"; "glance for a bullet" reads as jargon. `Analyze.askHint`
is "Fixate on a specific matter" while its hint, the tile hint ("ask the GM for a hint"), the
GM card title and `askHintHint` ("ask the GM to point you somewhere") all call it asking for a
hint.
**Fix:** "Sweep the room" / "Ask for a hint" (or keep the guide's Polish names in a tooltip).
**Pitfalls:** `DRPG.Analyze.askHint` is also the GM card title (3562) - rename both uses.

### ROLL-16 [severity: nit] [category: hygiene] [CONFIRMED]
**Where:** scripts/action-rolls.mjs:1-14, 866-872, 3111, 4014-4040, 875-902, 3175-3196; lang/en.json `Action.placeholder.think/listen`
**What happens:** Dead code and stale prose. `performGeneric` (4014) is unreachable: every key
in `ACTIONS` has its own `case` and `performAction` refuses unknown keys, so `chooseTrait`
(875) and `buildGmBody`'s `thresholds`/`analyze` branches (3177-3192) are dead too;
`performGmAction` (3111) is reachable only from the Observe fallback but its doc still says
"Think, Listen, Analyze, Observe". The file header (lines 7-10) lists Listen and "starting a
project" as GM-ruled actions and Think as an action; `chooseTrait`'s comment references a
`FOLDS_BRIEFING_IN` constant that was replaced by `NEEDS_OWN_BRIEFING`. `performSearch` 943
`if (!trait) return null;` cannot fire (`chooseSearchCategory` always returns a trait).
`Action.placeholder.think` and `.listen` are no longer read. observe.mjs:345 and 362 still say
"costs 2 Sanity" (constant is 1). look.mjs:130 `void MODULE_ID;` silences an unused import.
**Fix:** Delete `performGeneric`/`chooseTrait`, trim `buildGmBody` to the observe line, fix the
three comments and the two keys.
**Pitfalls:** tests.mjs may call `performGeneric` indirectly through `performAction` with a
custom key - grep before deleting.

### ROLL-17 [severity: nit] [category: perf] [CONFIRMED]
**Where:** scripts/private-rolls.mjs:229-283, 296-311, 330-345
**What happens:** `paintChatCard` runs for every card on every render of the log (including
the full history at load) and calls `getComputedStyle(document.documentElement)` per outcome
card plus `getSetting(SETTINGS.theme)` per plain card. Cheap individually, but it is the
hottest render hook in the module and the two values never change during a render pass.
**Fix:** Resolve the three tokens and the theme once per pass (memoise on `Hooks.on("ready")`
and on the theme setting's `onChange`).
**Pitfalls:** The light/dark `light-dark()` note at 224-228 explains why `markFrame` uses
`var()`; keep that for the frame, memoise only the outcome colours.

## Live checks recommended (things statics cannot settle)

1. ROLL-06: open a Search, switch the trait to Hand in the roll window, and read the card
   header/statistic chip; confirm which field on the returned config carries the trait used.
2. ROLL-14: set the sidebar roll mode to "Self Roll" as a player, roll an action with a Despair
   result, and check whether the Monokuma's pool moved.
3. ROLL-05: as a player, Palm somebody, complete the Shadow roll, close the Hand roll's window;
   confirm the action pip returns and Hope from the first roll stays.
4. `onCloseApplication` + `throwDice` both call `consumeCall`; confirm the Call flag is not
   unset twice with an intermediate re-render of the sheet (idempotent by code, but the
   `unsetFlag` on an already-empty flag may log a v14 warning).
5. Observe "specific" with the GM refusing the picker: confirm `ruleObserve`'s card reaches the
   GM with the `keyRemnantHere` button and that the action is charged exactly once (3287).
6. Two GMs connected: confirm only the primary opens the Dynamic-difficulty and Observe
   pickers (gated by `isPrimaryGm` in `onSocket`), and that a GM who is NOT primary but owns
   the character (`requestObserveTarget` local branch, gm-bridge.mjs:1385-1388) does not create
   a `pending` entry on a client that `resolveObserve` will later run on a different GM.

## Hygiene metrics (largest functions, duplicated helpers, dead exports you found)

- Largest functions (action-rolls.mjs unless noted; body lines, comments included):
  `performSearch` ~480 (909-1390), `performSabotage` ~300 (2237-2536), `workOnProject` ~240,
  `performPalm` ~235, `lockControls` (roll-dialog.mjs) ~205, `performTamper` ~190,
  `performAction` ~160, `report` ~150. Eight functions over the ~150-line mark, all in
  action-rolls.mjs (4402 lines - the largest file in the module).
- Duplicated logic: the Search trace rule (ROLL-03), the Project/Sabotage scoring with tool
  relief (ROLL-04), and Listen's outcome ladder (action-rolls.mjs:3822-3858 vs
  reroll.mjs:740-775) each exist twice with no shared helper; the Sabotage repair difficulty
  `18` is hand-written in both files. `stealablePool` / `palmablePool` (3040-3061) are one
  function with two names (documented as deliberate).
- Dead code: `performGeneric`, `chooseTrait`, two branches of `buildGmBody`, `settleSteal`
  (unreachable via ROLL-01), en.json `Action.placeholder.think|listen`.
- Magic numbers outside config: `DICE_SETTLE_MS = 6000` (action-rolls.mjs:800),
  `REROLL_WINDOW_MINUTES = 30` (reroll.mjs), `PENDING_TTL_MS` 1 h (observe.mjs:53),
  `#FRESH_MS = 10000` and the 5 s spend timeout (search-tokens.mjs:118, 389), 180 s / 300 s
  ruling timeouts (gm-bridge.mjs) - all sensible, all uncollected.
- patches.mjs is complete: a grep for `.prototype.X =` / `defineProperty(...prototype` in
  scripts/ finds only the seven overrides the table lists.
