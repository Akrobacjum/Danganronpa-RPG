# E31 input: the player side of the bridge (e30base, 1.2.60, commit 6ea3bba)

**What I measured and what I read.** I did not run the harness, a browser or Foundry. The measured parts are node scans of the source, all in `scratchpad/e31-design/`:
- which request functions use `expectAck`, `awaitRuling`, `hasGm` and timers
- the `DRPG.Bridge.what` key sets in en and pl
- the stylesheet scan for a border on `.window-content`
- which `TIMING` keys are read

Everything about runtime behaviour is inferred from reading the code, and each claim cites file:line in this checkout.

## 1. Wait patterns: 4 inside the gm-bridge request* family, 7 across the module

| Pat | Mechanism | Clocks | Player-side result | Members |
|---|---|---|---|---|
| P1 | Fire and forget, with an ack. `expectAck` (gm-bridge.mjs:328-338) arms an 8 s timer that `onAck` clears (354-362). The GM sends the ack **before** it runs the handler (2075-2079), and the dispatch has no try/catch (2092-2095). | `TIMING.ackMs` 8000 (config.mjs:308) | `{pending:true}`, or `null` plus a `noGm` toast | 26 (2 of them are GM-only callers) |
| P2 | `awaitRuling` (155-158) with two clocks: the ack (8 s) and the result (180 s) | ackMs + `rulingMs` 180000 (config.mjs:310) | The GM's value, or `null` | requestSabotage, requestArmCall |
| P3 | `awaitRuling` with one clock. The ack is sent but nobody listens for it (onAck returns at 357-358). | 180000, or 300000 for Hope Calls (config.mjs:312) | The GM's value, or `null` / `[]` | requestHopeCallApproval, requestDynamicDifficulty, requestObserveTarget, requestCleanableTraces |
| P4 | No requestId and no ack | none | `{pending:true}` or `null` | requestTieTrace |
| P5 | A card in the player's thread (callGm / promptAndCallGm). No promise waits on the GM: the answer is a GM button pressed later. | none | `true`/`false`, or text/`null` | 2 |
| P6 | search-tokens has its own pending map and reply packet (`askGm`, search-tokens.mjs:554-575). No ack. | 5000 (`TIMING.searchTokenAckMs`, and a literal 5000) | `{ok,left,plant,reason}` | requestSpend, requestPlant (search-tokens) |
| P7 | Side channels that never reply | none | nothing | trap relay, ballot, fog.shared, catch-up requests at `ready` |

- **The brief says "three patterns in ~28 places".** The measured count is 33 request/send functions in gm-bridge.mjs in four patterns (26 P1, 2 P2, 4 P3, 1 P4), plus 2 in search-tokens.
- **Every one except `sendDespairToPrimary` checks for a GM first.** 32 `if (!hasGm())` guards toast `DRPG.Bridge.noGm` (2356-2360).
- **P1 requests are never re-sent after a GM reconnects.** `resendPendingRulings` (109-116, run by `onGmReady` 119-130) only re-sends P2/P3.

Abbreviations used in the table:
- **noGm**: toast `DRPG.Bridge.noGm`.
- **noAnswer(X)**: the 8 s ack timeout toast.
- **refused(X)**: `refuse()` -> `tellRefused` -> `onRefused` toast (469-510). The reason exists only as English text in the GM's console (473); the packet carries `{action,userId,requestId,what}` and nothing else (487-489).
- **silent-after-ack**: a throw in the handler reaches nobody, because the ack already cleared the 8 s timer.

## 2. Request table

Unless marked otherwise, functions are in gm-bridge.mjs.

| # | Function | Pat | Returns (player / GM client) | Callers and what they do with the result | GM offline | GM refuses | Handler throws |
|---|---|---|---|---|---|---|---|
| 1 | requestOpeningResult 282-296 | P1 | `{pending}`/null ; resolveOpening promise | murder.mjs:3985-3992 returns it to gm-bridge.mjs:241, which awaits and drops it | noGm. The roll is lost and Stage 4 waits for the GM to invite again. | refused(Opening roll). resolveOpening's own no (murder.mjs:4005-4012) is silent. | silent-after-ack |
| 2 | requestOfferRecord 790-799 (non-primary GM only) | P1 | `{pending}`/null | level-up.mjs:186-187 (from 559, dropped). level-up.mjs:222-223 does not await, then whispers and toasts "offer sent" regardless (236-243). | n/a | refused(advancement.offer), shown as the raw id | silent-after-ack |
| 3 | requestBodyLoot 2125-2136 | P1 | **`true`**/null ; lootBody | anonymity.mjs:261-263 always toasts `DRPG.Loot.took` afterwards. The button stays disabled (236). | noGm plus "You take X" | "You take X", then refused. lootBody's own no (handover.mjs:358-377, 393) is silent. | silent-after-ack, and the player was told it was taken |
| 4 | requestArmCall 2145-2186 | P2 | GM's `{ok:true,left}` (1809-1814)/null ; true | call-effects.mjs:186-189 (`!sent` -> null) -> grantEffect throws (393-399) -> applyCall failed (726-735) -> calls.mjs:249-256 toast `notArmedNotCharged` | noGm plus notArmedNotCharged | refused, settled null at once (505-509), plus notArmedNotCharged | No indicator for up to 180 s (2179-2184), then noAnswer plus notArmedNotCharged |
| 5 | requestDespairAdjust 2195-2208 | P1 | `{pending}`/null ; adjustDespair | reroll.mjs:351-358 pushes "Despair gained/returned" (356) regardless | noGm, and the card still says the point moved | refused(Despair), arriving after the card | silent-after-ack |
| 6 | sendDespairToPrimary 2224-2230 (assistant GM) | P1, no hasGm | `{pending}` | despair.mjs:258-263 (the caller checks the primary is active and returns a prediction) | n/a | refused, shown to the assistant | silent-after-ack |
| 7 | requestSabotage 2246-2280 | P2 | GM's `{repair,target}` or null ; no GM branch (projects.mjs:629-631 routes the GM) | action-rolls.mjs:2592-2615: `applied=Boolean(repair?.repair)` (2598) -> card `sabotageNotApplied`. reroll.mjs:643-649 pushes "breaks again" (647) regardless. | The action is already paid (2533) and rolled. noGm, a **second** noGm from the trace (dropSabotageTrace -> requestRemnant), and the card "no GM confirmed the damage in time". | refused plus the same card. A GM-side "already frozen" is a toast on the **GM's** screen (projects.mjs:637-640) and the player gets the same misleading card. | Report, trace and Reroll bookmark block for up to 180 s (2273-2278), then noAnswer plus the card |
| 8 | requestUndoSabotage 2288-2292 | P1 | `{pending}`/null | projects.mjs:727-729, called from reroll.mjs:628, which pushes "unfrozen" (629) regardless | noGm plus the line | refused(Repair). undoSabotage's own no (projects.mjs:733-736) is silent. | silent-after-ack |
| 9 | requestSendBack 2295-2299 | P1 | `{pending}`/null | movement.mjs:1071-1072 does not await and drops it | noGm, and the token stays where it should not be | refused(Send back) | silent-after-ack |
| 10 | requestEclipseMove 2302-2306 | P1 | `{pending}`/null | eclipse.mjs:726-730 returns before+1 regardless -> 691 -> card "N left" (700-709) | noGm. The crossing is allowed and not counted. | refused, arriving after the card | silent-after-ack |
| 11 | requestTieTrace 2316-2325 | P4 | `{pending}`/null ; tieTraceForItem promise | murder.mjs:1316-1323, a fire-and-forget chain ending in `.catch(debug)` | noGm mid-swing, then another noGm from requestCrisisResult | refused(Tie a trace...) still toasts, because tellRefused works without a requestId (484-499) | Silent. Also silent when the GM leaves between the check and the emit. |
| 12 | requestRemnant 2328-2332 | P1 | `{pending}`/null | remnants.mjs:254-257 <- dropRemnant (233), from player callers action-rolls.mjs:1445->1477, 2314->2334, 2753->2608, 4617->4630 and reroll.mjs:1016-1018 (`traceFeedback` counts `{pending}` as placed), and use-items.mjs:771->796 (`!placed`, so the item is deleted at 805 on `{pending}`) | noGm. No trace is claimed and the item is kept. | refused, after "you left a trace" was already said and discardBroken already deleted the item. A failure inside placeRemnant (remnants.mjs:461-464) is silent. | silent-after-ack |
| 13 | requestRemnantEdit 2339-2343 | P1 | `{pending}`/null | remnants.mjs:1700-1702 <- reroll.mjs:1025-1026 ("removed" regardless) and 1037-1038 (traceFeedback) | noGm plus the line | refused(Edit a trace). retuneRemnant's own no (remnants.mjs:1707, 1713, 1718) is silent. | silent-after-ack |
| 14 | requestHopeCallApproval 2467-2487 | P3 300 s | true/false/null | calls.mjs:201-214 shows a waiting card; null -> `Calls.noAnswer`, false -> `Calls.refused` | **Two toasts**: noGm plus "no answer from the GM" | A guard refusal gives refused(**call.approve**, the raw id) **plus** "no answer from the GM". The GM's Refuse button gives Calls.refused. | Waiting card for up to 300 s (2480-2485), then noAnswer. The same happens if the card could not be posted (callGm false, 3085-3100). |
| 15 | requestDynamicDifficulty 2489-2508 | P3 180 s | `{tier,trait}`/false/null | action-rolls.mjs:4570-4590 shows a waiting card; false -> whisper; null -> return | The description card was already posted by promptAndCallGm (4541), then noGm | refused(**dynamic.difficulty**, raw id) and nothing else | Waiting card for up to 180 s, then dynamicNoRuling |
| 16 | requestObserveTarget 2525-2548 | P3 180 s | `{ok,key?,reason?}` (observe.mjs:146-268)/null | action-rolls.mjs:3614-3630 (null -> return; !ok -> ruleObserve) and 3669-3680 (null -> abort and refund) | noGm, nothing spent | refused(**observe.target**, raw id) | No indicator for up to 180 s, then Observe.noRuling |
| 17 | requestCleanableTraces 2561-2587 | P3 180 s | array: `[]` offline or on timeout, but **`null` on refusal** (508) | action-rolls.mjs:3030-3040 (`mine.filter`); sheet.mjs:4015-4050 asks in the background whenever the tile is drawn (actionButton 4091 -> roomBlockFor 3867 -> tamperBlock 3981); cleanup.mjs:2470-2472 (API only, api.mjs:820) | noGm, **including an unprompted toast when the sheet renders** | refused(**cleanup.traces**, raw id), then a TypeError at 3040 -> "That action could not be completed" (306-309). The sheet swallows it (4046-4050); cleanup.mjs:2472 leaves it unhandled. | Tamper blocks with no indicator for up to 180 s, then Cleanup.noRuling |
| 18 | requestObserveResolve 2596-2610 | P1 | `{pending}`/null ; resolveObserve | action-rolls.mjs:3687-3716 drops it and whispers "The GM is judging"; reroll.mjs:733-742 adds its line regardless | noGm plus the card | refused(Observe) | silent-after-ack |
| 19 | requestAnalyzeResolve 2618-2632 | P1 | `{pending}`/null | action-rolls.mjs:3950-3986 checks for a GM first and refunds (3959-3963), then drops the result; reroll.mjs:892-901 | Caller shows needGm and refunds | refused(Analyze) after the price was paid, with no refund | silent-after-ack |
| 20 | requestAdvancement 2641-2657 | P1 | `{pending}`/null | level-up.mjs:342-343 <- sheet.mjs:1538, dropped | noGm, offer kept | refused(Level Up), offer kept | silent-after-ack |
| 21 | requestShareBullet 2665-2678 | P1 | `{pending}`/null | handover.mjs:95-97 returns true regardless (sheet.mjs:3141) | noGm | refused. The resolver whispers some declines (handover.mjs:171-198, 246-252) and is silent on others (162-165, 232). | silent-after-ack |
| 22 | requestGiveItem 2681-2694 | P1 | `{pending}`/null | handover.mjs:114-116 returns true regardless (sheet.mjs:3142) | noGm | refused. giveItem whispers some declines (528-532, 549-556) and only logs others (545-546). | silent-after-ack |
| 23 | requestCrisisResult 2697-2729 | P1 | `{pending}`/null | murder.mjs:1208-1217 and 1224-1227 return it through openCrisisMenu (action-rolls.mjs:3133) and performAction to the sheet, where it is dropped; murder.mjs:1374-1387 drops it; reroll.mjs:772-782 adds its line regardless | noGm, after an item may already have been used (murder.mjs:1362-1370) | refused(Incident). An undo that finds no record whispers the GMs only (murder.mjs:1590-1594). | silent-after-ack |
| 24 | requestCleanup 2732-2778 | P1 | `{pending}`/null | cleanup.mjs:539-554 and 1896-1908 check for a GM first (435-441, 1821-1825) and drop the result; reroll.mjs:829-850 | Caller shows needGm | refused, after the price chain was paid on the client (551). resolveCleanup's own no (cleanup.mjs:1406-1416) is silent. | silent-after-ack |
| 25 | requestParkMurder 2787-2800 | P1 | `{pending}`/null | eclipse.mjs:344-347 <- action-rolls.mjs:4451-4462: `!parked` -> abort; otherwise "Declared" whisper and toast | Caller check (4436-4440) | refused, arriving **after "Declared"** | silent-after-ack. The action is spent and the player believes the murder is parked. |
| 26 | requestBetrayal 2802-2815 | P1 | `{pending}`/null | action-rolls.mjs:4379-4380, dropped by the sheet | noGm | refused. betrayAsPlayer's own no (murder.mjs:3349-3352) is silent. | silent-after-ack |
| 27 | requestMeddleResolve 2818-2832 | P1 | `{pending}`/null | monocub.mjs:274-275, after the action and Hope are paid (268-269), dropped | Caller check (244-249) | refused, and the price is not returned. resolveMeddle whispers its own no (382-385). | silent-after-ack, price lost |
| 28 | requestVaultSteal 2840-2854 | P1 | `{pending}`/null | action-rolls.mjs:1313-1335 (`got.pending` -> "settles in a moment"); vault.mjs:1013-1015 returns true regardless | noGm (rifle) | refused. stealFromVault's own declines (vault.mjs:1043-1066) are silent except full hands (1142-1146). | silent-after-ack |
| 29 | requestSteal 2863-2881 | P1 | `{pending}`/null | action-rolls.mjs:3345-3354 drops it; card "settles in a moment" (3383) | **No check before paying**: the action is paid (3307), both rolls are thrown, then noGm plus a card whose promise never settles | refused. stealFromPerson's refuse() only logs (vault.mjs:1235-1238). | silent-after-ack |
| 30 | requestPlant 2892-2910 (Palm) | P1 | `{pending}`/null | action-rolls.mjs:3215-3240 drops it; card plantSent (3234) | As Steal | refused. plantOnPerson's refuse() only logs (vault.mjs:1418-1421). | silent-after-ack |
| 31 | requestStashSearch 2920-2933 | P1 | `{pending}`/null | action-rolls.mjs:4073-4101 checks for a GM first and refunds, then drops the result | Caller shows needGm | refused, after the price. resolveStashSearch's own no (vault.mjs:1590) is silent. | silent-after-ack |
| 32 | requestProjectProgress 2936-2945 | P1 | `{pending, changed:null}`/null | projects.mjs:359-368 <- action-rolls.mjs:2218 (card "+N progress"; report shows nothing for `changed:null`, 4824-4832), call-effects.mjs:510-527 (truthy -> "sent to GM"), reroll.mjs:486-489 (line regardless). On success the GM whispers the real result (1265-1283). | Work on Project: paid (2161), rolled, then noGm **plus** "+N progress" | refused, after the card | silent-after-ack, and no whisper ever comes |
| 33 | requestProjectShare 2952-2956 | P1 | `{pending}`/null | projects.mjs:1250-1253 <- projects-ui.mjs:1123-1126 ("Project shared." regardless). A player reaches it only through api.mjs:464. | noGm plus "shared" | "shared", then refused | silent-after-ack |
| 34 | callGm 2976-3101 | P5 | true/false (false only when posting fails) | Player-side: action-rolls.mjs:1215, 3763 (dropped), 4003-4022 (`!sent` -> refund), reroll.mjs:948-972 (dropped), api.mjs:467 | **No check at all.** The words go only to connected recipients (messenger.mjs:189-219, secret.mjs:43-47, 397-406). A GM who connects later sees the stub "-" (secret.mjs:92) with no buttons, and the player's card says "Awaiting a ruling." forever. | A throwing GM button handler is logged (messenger-app.mjs:563-565) and the card stays open | n/a |
| 35 | promptAndCallGm 3162-3211 | P5 | text/null | action-rolls.mjs:2067-2104, 4541; use-items.mjs:488-507 (whispers "sent" and returns `{pending:true}`) | As callGm. The comment at 3197-3207 says callGm answers false with no GM connected; the code does not do that. | - | - |
| 36 | search-tokens requestSpend 532-539 (via SearchTokens.spend 187-203) | P6 5 s | `{ok,left,plant,reason}` | action-rolls.mjs:1564-1576 -> searchUnclaimed 1174-1207 (refund; card pickedClean or timeout); api.mjs:1146 | SearchTokens.noGm plus the card "No GM answered" | Reason notHere: toast "not in that room" (193) **plus** the card "No GM answered" (1204) | 5 s, then the timeout toast and the card |
| 37 | search-tokens requestPlant 546-552 (via takePlant 108-122) | P6 5 s (a literal) | `{ok,left,plant}` | action-rolls.mjs:1373 | Silent, by design (541-545) | Silent (453-456) | Silent; a late plant goes back to the room (516-519) |

**Side channels outside gm-bridge (P7):**
- **Trap relay** (traps.mjs:648-677; handler 683-722): sent with **no recipients** (651), so every connected client receives who crossed where and which action hit. Refusals are only warnings on the GM (696-708).
- **Ballot** (vote.mjs:486-500): the player gets "Your vote is in." (496) as soon as it is sent. Refusals only warn on the GM (211-213). With no GM connected the ballot is lost.
- **fog.shared** (fog.mjs:813-829): only a debug line when outside the 10 s window.
- **Catch-up requests at `ready`**, none of which wait: advancement.ask (gm-bridge.mjs:811-814), incident cast (murder.mjs:2735), mastermind door (mastermind.mjs:324), dice (dice-sync.mjs:51), fog (fog.mjs:857), voice (voice-client.mjs:183-189).
- **Daggerheart's relay refusal** (relay-guard.mjs:832): `tellRefused` with no requestId.

## 3. Where a promise can hang (a GM connected who does not answer)

These waits happen when a GM is connected. With no GM connected, every one of them resolves at once through `hasGm`.

1. **requestSabotage**, up to 180 s after the ack (2273-2278). It blocks performSabotage (action-rolls.mjs:2592) and settleSabotage (reroll.mjs:643). Cause: a throw in handleSabotage after the ack.
2. **requestArmCall**, up to 180 s (2179-2184), with no indicator (calls.mjs:249). Cause: a throw at gm-bridge.mjs:1770 or 1877.
3. **requestHopeCallApproval**, up to 300 s (2480-2485). Causes: no ack clock; a card that could not be posted; nobody presses a button. A waiting card is shown.
4. **requestDynamicDifficulty**, up to 180 s (2501-2506), with a waiting card.
5. **requestObserveTarget**, up to 180 s (2541-2546), with no indicator.
6. **requestCleanableTraces**, up to 180 s (2580-2585), with no indicator. It also runs as a background request that holds `tamperAsking` (sheet.mjs:4016).
7. **callGm / promptAndCallGm cards** have no timeout at all, and a card posted while no GM was connected can never be answered.

**Late answers are dropped.** After the player's timeout, `settleRuling` finds nothing (161-167), yet the GM's card still reads "Approved/Answered by X" (messenger-app.mjs:624-640).

## 4. Silent refusals and failures

- **Throws after the ack are silent.** This applies to every P1 request: 26 functions, 24 of them reachable by players (2075-2079, 2092-2095).
- **requestTieTrace fails silently** when the GM leaves or the handler throws.
- **Handlers throw away the resolver's return value**, so resolver-level declines never become `refuse()`:
  - vault.mjs:1233-1238, 1416-1421, 1038-1066, 1590
  - handover.mjs:162-165, 232, 358-393, 545-546
  - murder.mjs:3349-3352, 4005-4012, 1599
  - cleanup.mjs:1406-1416, 1923-1924, 1934-1937
  - remnants.mjs:332, 335, 461-464, 1707, 1713, 1718
  - projects.mjs:733-736
  - monocub.mjs:356
- **Silent by design:** the plant check (search-tokens), the trap relay, and fog.shared.
- **Silent loss:** the ballot, callGm with no GM connected, and late ruling answers.
- **No refusal says why.** The reason is only English text in the GM's console (473).

## 5. Contradictory messages

1. Body loot: "You take X" alongside noGm or a later refusal (anonymity.mjs:263).
2. Palm: noGm plus "settles in a moment" (action-rolls.mjs:3234, 3383).
3. Work on Project with no GM: noGm plus "+N progress".
4. Sabotage with no GM: two noGm toasts plus "no GM confirmed the damage".
5. Hope Call: "refused" plus "no answer from the GM" (calls.mjs:211-214), or noGm plus "no answer".
6. Search refused as notHere: "not in that room" plus "No GM answered".
7. Reroll lines claim replays regardless of the answer (reroll.mjs:356, 487, 629, 647, 742, 782, 850, 901, 972, 1026). The Reroll never checks for a GM, and the Hope stays spent.
8. Direct Murder: "Declared", then refused.
9. Project share: "Project shared." (projects-ui.mjs:1126) regardless.
10. Level Up offer from a non-primary GM: "offer sent" (level-up.mjs:236-243) regardless.
11. `traceFeedback` treats `{pending}` as placed (action-rolls.mjs:1477, 2334, 2608, 4630; reroll.mjs:1018, 1038; use-items.mjs:813).
12. discardBroken deletes the item on `{pending}` (use-items.mjs:796-805), against its own comment.
13. Eclipse card "N left" regardless (eclipse.mjs:691-709).
14. Ballot: "Your vote is in." before any GM has it.

## 6. Notes for bridgeRequest

- **The result shape depends on who calls.**
  - On a player: 25 functions return `{pending:true}`, requestProjectProgress returns `{pending,changed:null}`, requestBodyLoot returns `true`.
  - On a GM client, 21 functions return the resolver's own value (object, null, number or undefined).
  - requestCleanableTraces gives `[]` or `null` depending on the path.
- **`ok` and `reason` are already taken.** bridgeRequest's `{ ok, refused?, reason? }` would collide with:
  - chooseObserveTarget's `{ok:false, reason:"refused"}`, which means the GM closed the picker (observe.mjs:146-268; read at action-rolls.mjs:3630, 3680);
  - requestSpend's `{ok, reason:"notHere"}` (search-tokens.mjs:423, 523);
  - replyArmed's `{ok:true,left}` (1772, 1865, 1887).
  The handler's value needs its own field.
- **Callers that test for truthiness** (the brief's "a missed caller treats an object as success"):
  - call-effects.mjs:188, 511
  - action-rolls.mjs:4453, 1330, 2598, 3619, 3630, 3675, 3680, 4585-4589
  - use-items.mjs:796
  - reroll.mjs:643
  - calls.mjs:211-213
  - the `traceFeedback` sites
  - the array readers: action-rolls.mjs:3040, sheet.mjs:4031, cleanup.mjs:2472
- **Callers that must not block:**
  - murder.mjs:1317-1323 (mid-swing, "must not stop a murder", gm-bridge.mjs:2308-2315)
  - movement.mjs:1071-1072
  - level-up.mjs:222-223
  - despair.mjs:262
  - sheet.mjs:4015
  These need a promise that can be ignored without an unhandled rejection.
- **"An exception in run becomes a refusal with reason 'failed'" needs a reply after the handler finishes.** Today the ack goes out first and there is no catch. Settling the promise on that reply turns 24 player call chains from "return on send" into a full round trip. The alternative is to resolve on the ack and deliver "failed" as a toast only.
- **Missing `what` labels in both en and pl:** observe.target, cleanup.traces, call.approve and dynamic.difficulty (all shown to players), and advancement.offer (GM only). `requestLabel` then prints the raw id (323-326). advancement.apply only looks missing in pl: pl nests it (pl.json:2463), which Foundry resolves to the same key. There is no `DRPG.Bridge.why` yet.
- **There are 14 different strings for "no GM / no answer / refused":** `Bridge.noGm`, `noAnswer`, `refused`; `Analyze.needGm`; `Cleanup.needGm`, `Cleanup.noRuling`; `SearchTokens.noGm`, `timeout`; `Action.dynamicNoRuling`; `Observe.noRuling`; `Calls.noAnswer`, `notArmedNotCharged`; `Project.sabotageNotApplied`; `Trial.objectionNoGm`. Some paths refund the price and some do not, so a single message still needs to say which.
- **"requestPlant" is ambiguous in the brief's verify line.** There are two: gm-bridge.mjs:2892 (Palm) and search-tokens.mjs:546 (the private plant check).
- **The verify item "GM offline -> no hanging promise" already holds** for requestSabotage, requestTieTrace and requestPlant (2247, 2321, 2901; search-tokens.mjs:547-549). The hangs in section 3 need a GM who is connected but silent; that is the case to test.
- **Two timing constants are unused.** `TIMING.plantRequestMs` and `plantWindowMs` (config.mjs:316, 319) are read by nothing; search-tokens.mjs:343 and 546 carry the literal values.
- **The trap relay needs recipients.** When it moves into the table, it should be addressed to the GMs.
- **`emitToGms` falls back to a broadcast** when no GM is listed (148-152).
- **A dropped field:** murder.mjs:1216 and 1226 send `itemId`, which requestCrisisResult never reads (it reads `usedItemId`, 2706).

## 7. S01-64

- **The brief's line numbers have moved:**

  | Brief | Now |
  |---|---|
  | utils.mjs:884-897 (windowWidthFor) | 902-944 |
  | gm-bridge.mjs:438-447 (senderOf/ownsActor) | 449-458 |
  | gm-bridge.mjs:1653-1655 (gmOnline) | 2346-2348 |
  | search-tokens.mjs:461, 475 | 533, 547 |
  | live.mjs:494-543 | reopen 501-511, handOff 540-547 |

- **"Is a GM online" is computed in five places:** utils.mjs:113-115 (`activeGmIds`, used by emitToGms), gm-bridge.mjs:2347, search-tokens.mjs:533 and 547, and diagnostics.mjs:1151 (a readout).
  - diagnostics has no copy of senderOf/ownsActor.
  - They are imported by relay-guard.mjs:59, reroll-receipts.mjs:38 and search-tokens.mjs:16, and loaded dynamically at traps.mjs:690, 730 and 950.
- **handOff (live.mjs:540-547) calls `close()` with no options.** Its callers are gm-panel.mjs:742 and season-setup.mjs:560.
  - motion.mjs:421-446 wraps `ApplicationV2.prototype.close` and forces `animate:false` under reduced motion (441-443, RM-CLOSE-1000, 17.09; its comment records 1274-1298 ms against 140-151 ms). It is installed on every load by module.mjs:211.
  - motion.mjs:474-492 also skips the wait when no transition is running.
  - So in this checkout, handOff should not wait about a second under reduced motion unless that patch failed to install; the patch warns if it cannot (415-418). I inferred this from the source and did not measure it.
  - Adding `{animate:false}` to handOff makes it independent of the patch, but it also drops the close animation for everyone on those two paths. reopen already closes that way for everyone (505).
- **windowWidthFor counts the content border twice.** `padding` adds the border (utils.mjs:906-907), and `frame` = root width minus `content.clientWidth` (913), which already includes that border because clientWidth excludes it. Its callers are utils.mjs:814 and 1018.
  - A scan of styles/*.css found 0 rules that end at `.window-content` and declare a border. The one near-match, stained-glass.css:1411, styles inputs inside it.
  - Foundry's own CSS is not in the repo and I did not check it.
  - So the visible error is 0 px with this module's own stylesheets (inferred). The fix is to drop lines 906-907.

My scan scripts are in `<scratch>/e31-design/`: `callers.txt` and `resolvers.cjs`. The other files there were written by someone else.