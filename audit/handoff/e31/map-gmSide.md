# E31 map: the GM side of the bridge at 6ea3bba (1.2.60)

**How I got this.** I read every handler, guard and resolver the bridge reaches, and every `game.socket.on` file. Three read-only scratch tools are in `<scratch>/e31-design/`:
- `map-bridge.mjs` is a static map of GM_HANDLERS, their refusals and their guards.
- `fnscan.mjs` finds early returns and writes in the resolvers.
- `probe-onsocket.mjs` runs the real `onSocket` text from gm-bridge.mjs in node `vm`, with stubs for `game` and `isPrimaryGm`.

What was **measured**:
- The static counts.
- The onSocket probe.
- en/pl key coverage, checked with node over the lang files.
- The greps for the "GM online" copies and for who imports what.

Everything else is **read from source**. I did not run the harness.

Line numbers are for 6ea3bba. E30's gm-bridge change (e30wt) edits one comment line in place at 1982, so the numbers below still hold after E30.

---

## 1. GM_HANDLERS (gm-bridge.mjs:1989-2023): 33 actions, 32 handler functions

**Legend**
- **U** = `refuse(action, "unknown sender")` when `senderOf(senderId)` is null.
- **OWN(x)** = "sender does not own x".
- **\*** = the guard spends a Reroll receipt. It is always the last guard asked.
- **[GM skip]** = the guard returns null for a GM sender (`sender.isGM`, which includes an Assistant GM).
- **Ack**: `onSocket` sends `bridge.ack` for every packet that has a `requestId` (2075-2079). The player-side clock is one of:
  - **E**: `expectAck` 8 s toast `DRPG.Bridge.noAnswer` (328-338).
  - **R**: `awaitRuling` only (155-158). The ack arrives and `onAck` drops it (357-358), so only the long clock applies.
  - **R+A**: awaitRuling plus an ack timer that gives up at 8 s.
- **Reason families** are expanded in section 2.

| # | Wire (const line) | Handler (lines) | Guards asked, in order | Payload fields read and how they are sanitised | Reasons into `refuse()` | Ack, player clock, reply | Writes | Unguarded or inconsistent |
|---|---|---|---|---|---|---|---|---|
| 1 | `observe.target` (:43) | handleObserveTarget 515-539 | senderOf, then ownsActor(actorId) | `actorId`. `declaration` raw, compared to DECLARATIONS (observe.mjs:145-208). `request` raw and unbounded, escaped where the GM sees it (observe.mjs:442). The `userId` in the key comes from the sender, not the packet (529) | U; OWN(that character) | Ack; R (rulingMs 180 s, toast DRPG.Observe.noRuling, 2525-2548). Reply `observe.targetResult` {ok,key} or {ok:false, reason: notGm, noActor, noRoom, none or refused} (532-537; observe.mjs:146-208) | GM client store `observePending` (observe.mjs:104-106; client scope settings.mjs:965-970) | No `DRPG.Bridge.what` key. A "specific" declaration waits for a GM dialog inside the handler (observe.mjs:206-208). The reply already carries its own reason codes |
| 2 | `cleanup.traces` (:46) | handleCleanupTraces 546-566 | senderOf, ownsActor(actorId) | `actorId`; `mine` becomes Boolean | U; OWN | Ack; R (toast DRPG.Cleanup.noRuling, resolves []) (2561-2587). Reply `cleanup.tracesResult` (559-564) | Nothing; the list is read-only (cleanup.mjs:196+) | No what key |
| 3 | `observe.resolve` (:45) | handleObserveResolve 613-644 | senderOf, ownsActor(actorId), firstRefusal(guardObserveReceipt\* [GM skip, undo only] 607-611). After that, the resolver's `result.refused` (642) | `key` raw, used as a map key; `total` Number()\|\|0; `isCritical` and `undo` Boolean; senderId and senderIsGm come from Foundry | U; OWN; RCPT(observe); OBSERVE (4 reachable) | Ack; E (2596-2610) | Bullet or Sanity on the observer, observePending, whispers (observe.mjs:513+) | The receipt is spent before the key is judged (documented at 586-592). A missing record gets whispers and returns null, with no refusal (observe.mjs:520-553) |
| 4 | `analyze.resolve` (:48) | handleAnalyzeResolve 655-677 | senderOf, ownsActor, guardAnalyzeReceipt\* 647-651, then `.refused` (675) | `itemId` is looked up on that actor only (analyze.mjs:46-51); `total`; `isCritical`, `undo` | U; OWN; RCPT(analyze); ANALYZE(2) | Ack; E (2618-2632) | Bullet flags, description, secret ledger, whispers | A missing bullet only logs a GM warn (analyze.mjs:47-50) |
| 5 | `advancement.apply` (:50) | handleAdvancement 693-740 | senderOf, ownsActor(actorId). Then inline: actor exists (701), offer exists (704-705), pick count (707-712), options (713-715), new-experience name (720-722), per-actor `advancing` latch (730-738) | `picks` must be an Array of length `LEVEL_UP[offer.kind].picks` with each `option` in LEVEL_UP_OPTIONS. `kind` comes from the stored offer; `payload.kind` is never read | U; OWN; "no such character" (only reachable for a GM sender); "no Level Up is on offer for that character"; "that offer buys N pick(s), the packet carried M"; "a pick names something that is not an option"; "a new experience has no name"; "a Level Up for that character is already being written" | Ack; E (2641-2657) | Actor through `automatedUpdate`, advances flag, offer withdrawn (level-up.mjs:552-556) | `pick.trait` and `pick.experience` become update-path segments with no whitelist, and `pick.name` has no length bound (level-up.mjs:488-539). applyAdvancement's own refusals are toasts on the GM (level-up.mjs:462, 510, 543, 566) |
| 6 | `advancement.offer` (:54) | handleAdvancementOffer 746-766 | `!sender?.isGM` (gmOnly), ownsActor (redundant for a GM, kept for R1b, 749-751), actor is a character, kind is valid | `actorId`; `kind` is null or a LEVEL_UP key that has picks | "only a GM hands out a Level Up"; OWN; "no such character"; "no such Level Up: \<kind\>" | Ack; E (requestOfferRecord 790-799) | GM client store `advanceOffers` (level-up.mjs:136-146; client scope settings.mjs:972-977) | No what key |
| 7 | `advancement.ask` (:55) | handleAdvancementAsk 769-774 | senderOf; `!sender \|\| sender.isGM` returns silently | Nothing | None (it never refuses) | No requestId (askForOffers 811-814, no hasGm), so no ack. Reply `advancement.offers` via sendOffersTo (780-787) | Nothing | No what key |
| 8 | `handover.bullet` (:57) | handleShareBulletOrGiveItem 819-830 | senderOf, ownsActor(fromId) | `fromId`. `toId` and `itemId` raw, then handover `verify` checks (handover.mjs:159-213): both actors exist and differ, the item is the giver's, not an Eclipse, same room, both alive | U; OWN(the character giving it away) | Ack; E (2665-2678) | Truth Bullet copy and secret on the recipient, whispers (handover.mjs:225-312) | The resolver refuses by whisper, in the GM's language (Eclipse, tooFar, recipientDead, alreadyHasIt, failed), by warn only, or silently; never by `bridge.refused`. `refuse()` names `payload.action` (821) |
| 9 | `handover.item` (:58) | same function | same | same | same | Ack; E (2681-2694) | grantItem to the recipient, item deleted from the giver (handover.mjs:516-603) | As row 8, plus stashed and theirHandsFull whispers and an untracked-item warn (handover.mjs:529-556) |
| 10 | `action.plant` (:62) | handlePlant 834-852 | senderOf, ownsActor(plannerId) | `victimId` raw. `itemId ?? null`, must be the planter's (vault.mjs:1415-1416). `total`, `unseenTotal` Number()\|\|0; `isCritical`, `unseenCritical` Boolean | U; OWN(the character planting) | Ack; E (2892-2910) | Item to the victim, deleted from the planter, whispers | plantOnPerson's own refusals are error logs only (vault.mjs:1418-1448: dead, victim dead, not in a room, victim elsewhere, not carrying). The player is told nothing |
| 11 | `vault.findStash` (:61) | handleFindStash 858-872 | senderOf, ownsActor | `total`, `isCritical` | U; OWN | Ack; E (2920-2933) | Actor flag VAULT_FLAGS.found (vault.mjs:1622), whispers | None found |
| 12 | `action.steal` (:60) | handleSteal 877-895 | senderOf, ownsActor(thiefId) | `victimId`, `itemId` raw; totals and booleans as in row 10 | U; OWN(the character stealing) | Ack; E (2863-2881) | Item moves from victim to thief, whispers | Local refusals are error logs only (vault.mjs:1235-1259) |
| 13 | `vault.steal` (:59) | handleVaultSteal 899-922 | senderOf, ownsActor(thiefId) | `ownerId`, `itemId` raw; the item must be stashed (vault.mjs:1036-1038). `viaSearch` and `clumsy` Boolean; `clumsy` is trusted on purpose (912-919) | U; OWN(the character searching) | Ack; E (2840-2854) | Item moves from stash to thief, whispers | Local refusals are error logs only (vault.mjs:1065-1124) |
| 14 | `murder.openingResult` (:68) | handleOpeningResult 927-943 | senderOf, ownsActor(actorId) | `side` raw; resolveOpening compares it to the state (murder.mjs:4007-4012). `total`; `isCritical`, `withHope` | U; OWN | Ack; E (282-296) | Incident state | Wrong stage: silent null. Wrong side: GM warn only (murder.mjs:4005-4012) |
| 15 | `murder.crisis` (:63) | handleCrisis 981-1033 | senderOf, ownsActor(actorId), then firstRefusal(guardCrisisAction [skipped for a GM and for an undo] 958-963, guardCrisisUndo [GM skip, undo only] 966-970, guardCrisisReceipt\* [GM skip, undo only] 973-977) | `key` raw. `total`; `isCritical`, `withHope`, `undo` Boolean. `choice` narrowed to stress, hp or null. `usedItemId` and `swungId` kept only if the actor holds them. `free` counts only if `freeResolutionFor(sideOf(actor))` agrees | U; OWN; CRISIS(7); CRISIS_UNDO (2, plus CRISIS's two keyless strings); RCPT(crisis) | Ack; E (2697-2729) | Incident state, both sheets, the map | crisisRefusal also returns an i18n key (for example DRPG.Murder.notYourTurn), and the guard drops it (962). A rewind that fails whispers to the GMs and is not refused (murder.mjs:1590-1594) |
| 16 | `murder.park` (:71) | handleParkMurder 1042-1055 | senderOf, ownsActor(killerId) | `room ?? null` and `note ?? ""`, with no type or length bound | U; OWN | Ack; E (2787-2800) | World setting `pendingMurders` (eclipse.mjs:351-359; world scope settings.mjs:1086-1091) and a GM card, escaped by callGm (eclipse.mjs:379-405) | No Eclipse or eligibility check when it is written; it is judged when the lights come up (eclipse.mjs:477+). The world-scope exposure is an audit finding already planned for another stage |
| 17 | `murder.betrayal` (:70) | handleBetrayal 1061-1070 | senderOf, ownsActor(actorId) | Nothing else | U; OWN | Ack; E (2802-2815) | Offer cleared, incident opened (murder.mjs:3345-3372) | "Not in position" is a GM warn only (3349-3351) |
| 18 | `murder.cleanup` (:69) | handleCleanup 1083-1143 | senderOf, ownsActor(actorId), firstRefusal(guardCleanupReceipt\* [GM skip, undo only] 1073-1077). On the Stage 6 branch, `.refused` (1114) | `key` picks the branch (1098). `targetId ?? null`; `tokenId` raw. `total`; `isCritical`, `withHope`, `viaAction`, `undo`, `grant` Boolean. `price`, `transform`, `change` are passed as `?? null` and bounded inside the resolvers. `mode` comes from `key` | U; OWN; RCPT(cleanup); STAGESIX(2) | Ack; E (2732-2778) | Remnant tokens and ledger, Sanity, whispers (cleanup.mjs:1387+, 1913+) | resolveCleanup refuses by whisper (not found, reinforced, vanished: cleanup.mjs:1074-1123, 1418-1436), and the handler never reads its result (1118-1142). resolveStageSix returns null silently for an unknown key or a non-cleaner (cleanup.mjs:1921-1936). An `undo` on a Stage 6 key spends a receipt that resolveStageSix never reads; the honest client never sends one (reroll.mjs:824-827) |
| 19 | `monocub.meddle` (:72) | handleMeddle 1148-1164 | senderOf, ownsActor(actorId) | `targetId` raw; `help`, `isCritical` Boolean; `total` | U; OWN(that Monocub) | Ack; E (2818-2832) | The target's sheet (an armed Call or a lost action), whispers | resolveMeddle's 7 refusals are a warn plus the whisper DRPG.Monocub.meddleRefused (monocub.mjs:371-405) |
| 20 | `call.approve` (:41) | handleHopeCall 1177-1186 | senderOf, ownsActor(actorId) | `requestId` is deduped in `askedByCard` (2401-2405). `key` looks up the label and cost in HOPE_CALLS; the packet's cost is ignored (2408-2421). `note`, `effect`, `callLabel` raw but escaped | U; OWN | Ack is sent; R (hopeCallRulingMs 300 s, no toast, 2467-2487). The answer comes later through answerHopeCall (2450-2456) | callGm card in the owner's thread, or a GM whisper (2976-3101) | No what key. callGm returning false is not turned into a refusal (2417). `askedByCard` is never pruned |
| 21 | `dynamic.difficulty` (:38) | handleDifficulty 1188-1197 | senderOf, ownsActor(actorId) | `requestId` deduped; `description`, `room`, `actorName` raw but escaped (2430-2447) | U; OWN | Ack is sent; R (rulingMs, toast DRPG.Action.dynamicNoRuling, 2489-2508). Answer through answerDynamic (2459-2465) | Card | Same as row 20 |
| 22 | `project.progress` (:23) | handleProgress 1222-1285 | senderOf, canSee(countdownId, sender) (1238-1241), inline amount check (1245-1248), firstRefusal(guardProgressOwner [skipped for a GM or amount ≥ 0] 1208-1212, guardProgressReceipt\* [same skip] 1215-1220). Queued (PROJECT_ORDERED) | `countdownId`. `amount` is truncated and must be finite, non-zero and at most 12 in absolute value (STARTING.despairMax, config.mjs:251). `actorId` is read only when amount < 0 | U; "sender may not see that project"; "amount X is out of range"; "progress taken back without the sender's own character"; RCPT(progress) | Ack; E (2936-2945). The reply is a whispered ChatMessage with the result line (1265-1283) | Daggerheart countdowns world setting (projects.mjs:431) and its repair, trap and done follow-ups | Frozen, full and empty also toast on the GM's screen (projects.mjs:398, 419). The result line is written in the GM's language. The cap borrows a Despair constant |
| 23 | `project.share` (:24) | handleShare 1302-1329 | senderOf, canSee, firstRefusal(guardShareSecret 1292-1295, guardShareGuest 1297-1300), both asked of a GM too, then canSee again (1322-1324) | `countdownId`. `targetUserId` must be a known non-GM user; whether they are connected is not checked | U; "sender cannot see that project"; "that project is not secret"; "the project can only be shared with a player" | Ack; E (2952-2956) | Countdown ownership (projects.mjs:1250-1266) | One guard, two wordings: "may not see" (progress) and "cannot see" (share, sabotage, unsabotage) |
| 24 | `remnant.place` (:25) | handleRemnant 1331-1361 | senderOf, ownsActor(data.sourceActor). For a player, narrowPlayerRemnant is guard and sanitiser in one, built from one `locateActor` reading (1352-1356) | Player: the data is rebuilt from a whitelist (remnants.mjs:616-647): type, visibility, faint and action checked; note ≤400 and subject ≤80 characters; itemIdentity only if held; place, scene and clock come from the GM. GM sender: `payload.data` is taken whole (1347, 1358) | U; OWN(the character leaving it); NARROW(3) | Ack; E (2328-2332) | Token on the scene and a ledger row (remnants.mjs:254-465) | The GM road is unfiltered, and that includes an Assistant GM |
| 25 | `remnant.tieForItem` (:28) | handleTieTrace 1391-1401 | senderOf, firstRefusal(guardTieTraceHolder 1379-1389, asked of a GM too) | `identity` | U; "no participant of the running incident the sender plays holds that object" | No requestId (requestTieTrace 2316-2325), so no ack. A refusal still shows a toast but settles nothing | Ledger `tiedToCrime` (remnants.mjs:1517-1536) | The only bridge request that sends no requestId. Its caller uses an optional call (murder.mjs:1321) |
| 26 | `remnant.edit` (:29) | handleRemnantEdit 1439-1490 | senderOf, ownsActor(the token's ledger `sourceActor`) (1446-1455), firstRefusal(guardRemnantEditReceipt\* [GM skip] 1420-1437; its receipt check is `removalRefusal`) | `sceneId` falls back to `canvas.scene`; `tokenId`. `patch` becomes { remove: Boolean; visibility only if in REMNANT_VISIBILITY_LABELS; type only for a GM and only from CLEANUP.transform.types } (1476-1484) | U; "sender did not leave that Remnant"; RCPT(remnant); REMOVAL(5) | Ack; E (2339-2343) | Token deleted, or ledger and public data retuned (remnants.mjs:1696-1768) | The scene falls back to the scene the GM is viewing (1422, 1446). Removing a reinforced trace returns null silently (remnants.mjs:1713) |
| 27 | `project.sabotage` (:30) | handleSabotage 1515-1561 | senderOf, canSee(targetId), inline difficulty check (1536-1540). Queued | `difficulty` truncated, 1 to 8 (the largest PROJECT_SCALE progress). The saboteur is recorded as the sender's id for a player (1543-1544) | U; "sender cannot see that project"; "difficulty X is out of range (1-8)" (the source has U+2013 at 1539) | Ack; R+A (8 s ack, 180 s answer, 2246-2280). Reply `project.sabotageResult` {result} when there is a requestId (1554-1559) | A repair project and two meta writes (projects.mjs:628-677) | sabotageProject refuses in three other ways: a toast on the GM (already frozen, projects.mjs:638), a log line (target is a repair, 646), or null (missing). In all three the player gets `result: null` with no reason |
| 28 | `project.unsabotage` (:32) | handleUnsabotage 1594-1611 | senderOf, canSee(targetId), firstRefusal(guardUnsabotagePair 1574-1580, guardUnsabotageOwner 1582-1585, guardUnsabotageReceipt\* 1588-1592), all [GM skip]. Queued | `targetId`, `repairId`, `actorId` | U; "sender cannot see that project"; UNSAB(5); "sender does not own that character"; RCPT(sabotage) | Ack; E (2288-2292) | Thaw and delete the repair (projects.mjs:724-746) | undoSabotage checks the pair again, but only logs (projects.mjs:732-736) |
| 29 | `token.sendBack` (:33) | handleSendback 1640-1662 | senderOf with **no null check**, ownsActor(token.actorId), firstRefusal(guardSendbackPlace 1623-1638: asked of a GM too, one 300 ms retry) | `sceneId` and `tokenId` find the token. `position` is read field by field: x and y as Number, elevation as Number if present, level as sent if present (1655-1659) | "sender does not own that token" (also given for an unknown sender or a missing token); SENDBACK(4) | Ack; E (2295-2299) | `token.update(to, {animate:false, [REVERT]:true})` (1660) | No "unknown sender" line |
| 30 | `body.loot` (:78) | handleLoot 1664-1682 | senderOf, ownsActor(takerId) | `bodyId`, `itemId` raw | U; OWN(the character doing the taking) | Ack; E (2125-2136). Returns `true`, not `{pending}` | Item moves from body to taker (handover.mjs:352-411) | lootBody refuses by warn only (handover.mjs:358-378). The GM does not check where the taker stands, whether they are alive, or the Eclipse (compare `verify`, handover.mjs:169-205). The caller shows "took" whatever happened (anonymity.mjs:261-263) |
| 31 | `call.arm` (:35) | handleArm 1736-1775 plus armPaidByPlayer 1851-1890 | 1. firstRefusal(guardArmCharacter 1690-1692), asked **before** the sender check.<br>2. senderOf, then U.<br>3. ownsActor(buyer = `call.from ?? actorId`, 1685-1687).<br>4. Beneficiary read once (1756).<br>5. firstRefusal(guardArmPlayerCall [GM skip] 1708-1712, guardArmCallGrants 1720-1726).<br>Player road: firstRefusal(guardArmBuyer 1817-1820, guardArmOtherCharacter 1823-1828); a replayed nonce is answered ok (1862-1867); firstRefusal(guardArmHopeCallAllowed 1831-1836, guardArmNotHeld 1729-1734, guardArmBuyerHope 1839-1845); charge; append.<br>GM road: firstRefusal(guardArmNotHeld); append | `actorId`. `call.key` and `call.grants` are checked against HOPE_CALLS or DESPAIR_CALLS. `armedEntry` rebuilds the entry (1778-1784): grants from the table, amount null, nonce cut to 32 characters, `from` as sent | "no such character"; U; "sender does not own the character paying for it"; PLAYERARM(3); `"k" does not grant "g"`; "the paying character does not exist" (unreachable, because ownership fails first); "a Call for somebody else, aimed at the buyer"; "the buyer may not spend a Hope Call now (\<HOPEBAR\>)"; "\<name\> already holds that Call"; "the buyer holds N Hope, the Call costs M"; "the Call could not be armed" (after a refund, 1880-1885) | Ack; R+A (2145-2186). Reply `call.armResult` {ok, left} (replyArmed 1809-1814) | Beneficiary flag `pendingCall` (call-effects.mjs:235-238). On the player road, the buyer's Hope through automatedUpdate, refunded if arming fails (1876-1884). A whisper to the beneficiary (1795-1807) | Two roads in one handler. The HOPEBAR strings are localized on the GM (calls.mjs:92-114) and end up inside an English log line |
| 32 | `despair.adjust` (:37) | handleDespair 1947-1964 | senderOf, firstRefusal(guardDespairOwner [GM skip] 1904-1908, guardDespairMonokuma [GM skip] 1910-1915, guardDespairDelta 1921-1926, guardDespairPool 1929-1933, guardDespairReceipt\* [GM skip] 1936-1945) | `delta` truncated, non-zero, at most 1 for a player and 12 for a GM. `targetUserId` must hold a pool. `actorId` (player only) | U; "sender does not own the rerolling character"; "that pool is not the rerolling character's Monokuma"; "delta X is out of range"; "target holds no Despair pool"; RCPT(despair); "the Reroll moved Despair by N, not X" | Ack; E (2195-2208; for an Assistant GM, 2224-2230) | World setting `despairPools`, and the overflow when it spills (despair.mjs:245-288) | None found |
| 33 | `eclipse.move` (:34) | handleEclipseMove 1966-1974 | senderOf with **no null check**, ownsActor(actorId) | `actorId` | "sender does not own that character" (also given for an unknown sender) | Ack; E (2302-2306) | World setting `eclipseMoves` (eclipse.mjs:740-746) | The GM does not check that an Eclipse is running. No "unknown sender" line |

**Counts (measured with map-bridge.mjs)**
- 28 of the 32 functions open with the U line.
- The four that don't: handleAdvancementOffer (`!sender?.isGM`), handleAdvancementAsk (silent), handleSendback and handleEclipseMove (a null sender fails `ownsActor`).
- handleArm is one of the 28, but it asks guardArmCharacter before its U line.

## 2. Reason strings that reach `refuse()`

By my count there are **80 distinct English templates**. Two of them are unreachable. There are also **4 localized strings**, which appear inside the Hope Call reason.

**Literals in gm-bridge.mjs**
- 25 in handlers: the table rows above.
- 15 in guards: 1211, 1294, 1299, 1388, 1723, 1733, 1907, 1914, 1925, 1932, 1943, 1819, 1827, 1835, 1844.
- REMOVAL, `removalRefusal` (1498-1513):
  - "a GM has written on that trace"
  - "a Reroll put that trace back"
  - "somebody has already found that trace"
  - "there is no record of when that trace was left"
  - "that trace is older than a Reroll can reach"

**Delegated families (other files)**
- **RCPT(kind)**: `rerollReceiptRefusal`, reroll-receipts.mjs:124-126, reached through `spendRerollReceipt` (167-180; retry 400 ms, window 5 min, config.mjs:327-331).
  - "no Reroll of that character by the sender"
  - "the sender's last Reroll of that character is too old"
  - `that Reroll has already undone one "<kind>"`
  - After these, the guard's own check runs: REMOVAL for a trace, or the Despair-delta check.
  - Kinds: observe, analyze, crisis, cleanup, progress, remnant, sabotage, despair.
- **CRISIS** (murder.mjs:1098-1128): each `.why` below comes with an i18n `key`.
  - "no incident is at its incident stage for that character" (no key)
  - "not an action for that side" (no key)
  - "not their turn" (DRPG.Murder.notYourTurn)
  - "that action is locked" (actionLocked)
  - "that action is spent" (actionSpent)
  - "that action is blocked" (actionBlocked)
  - "nothing left to spend on a resolution" (nothingLeftToSpend)
- **CRISIS_UNDO** (murder.mjs:1153-1157):
  - "the last crisis action is not that character's"
  - "the incident has moved on since that action"
  - It also returns the two keyless CRISIS strings.
- **UNSAB** (projects.mjs:700-708):
  - "there is no repair to take back"
  - "no frozen project was named"
  - "that repair is not what froze the project"
  - "that repair does not repair the project"
  - "the sender did not ask for that sabotage"
- **SENDBACK** (movement.mjs:173-191):
  - "the position is not a place on the map"
  - "the position is off the scene"
  - "the elevation is not a number"
  - "the token did not stand there a moment ago"
- **PLAYERARM** (call-effects.mjs:149-155):
  - `"k" is not a Hope Call a player can buy for somebody else`
  - `"k" is not aimed at another player`
  - `"k" does not grant "g"` (the same template as guardArmCallGrants)
- **HOPEBAR** (calls.mjs:92-114): localized on the GM.
  - DRPG.Eclipse.actionsLocked
  - DRPG.Overflow.silenced
  - DRPG.Chapter.deadCannotAct
  - DRPG.Calls.silencedNotice
- **OBSERVE** (observe.mjs:490-497):
  - "no such Observe" (unreachable: resolveObserve returns earlier, 519-553)
  - "that Observe belongs to another character"
  - "that Observe was declared by somebody else"
  - "that Observe has already been resolved"
  - "that Observe has no result to take back"
- **ANALYZE** (analyze.mjs:66-67):
  - "that bullet cannot be analysed now"
  - "no Analyze of that bullet this chapter to take back"
- **STAGESIX** (cleanup.mjs:1949, 1951):
  - "that student cannot be framed"
  - "the body is not in the killer's room"
- **NARROW** (remnants.mjs:617-619):
  - "no character left it"
  - "the character has no token on a scene"
  - `"<visibility>" is not a visibility`

**Reasons that put packet or world text into the message**
- From the packet:
  - amount (1247)
  - difficulty (1539)
  - delta (1925, 1943)
  - call key and grants (1723; call-effects.mjs:151-153)
  - kind (761)
  - pick count (711)
  - visibility (remnants.mjs:619)
- From the world: actor names (1733, HOPEBAR's deadCannotAct).
- If E31 sends a reason code plus data to the player, that data needs escaping or a whitelist.

## 3. Refusals that never reach `refuse()` (the player gets no `bridge.refused`)

- **Only an error or warn on the GM:**
  - vault's three local `refuse` lambdas (vault.mjs:1065, 1235, 1418; reasons at 1070-1124, 1244-1259, 1424-1448)
  - resolveOpening (murder.mjs:4010)
  - betrayAsPlayer (3350)
  - lootBody (handover.mjs:362, 367, 376)
  - resolveAnalyze with a missing bullet (analyze.mjs:48)
  - undoSabotage (projects.mjs:734)
  - resolveStageSix moveBody by action (cleanup.mjs:1934)
- **Silent null:**
  - resolveStageSix: unknown key or not a cleaner (cleanup.mjs:1923-1924)
  - retuneRemnant on a reinforced trace (remnants.mjs:1713)
  - placeRemnant with no target or actor (332, 335)
  - handover verify: missing actors or item
- **A whisper to the owner, written in the GM's language:**
  - handover (verify 172, 178, 196; 248, 293, 529, 551, 572)
  - resolveMeddle (monocub.mjs:383)
  - resolveCleanup (Tamper.notFound, Cleanup.reinforced, vanished)
  - stealFromVault handsFull (vault.mjs:1145)
  - resolveObserve with no record (observe.mjs:548-551)
- **A toast on the GM's screen for the player's request:**
  - addProgress (projects.mjs:398, 419)
  - sabotageProject (638)
  - applyAdvancement (level-up.mjs:462, 510, 543, 566)
- **A callGm that failed:** askHopeCallByCard and askDynamicByCard ignore a false result (2417, 2438). The player waits out 180 to 300 s.
- **A thrown handler.** Measured with probe-onsocket.mjs:
  - The ack is sent, `onSocket`'s promise rejects, and no `bridge.refused` goes out, because there is no try/catch around `handler(...)` (2094-2095).
  - Read from source: an awaited request (sabotage, arm) then waits for rulingMs = 180000 (config.mjs:310). A fire-and-forget request shows nothing.

## 4. Dispatcher, `refuse()` and the refusal packet

**What `onSocket` (2025-2096) does, in order**
1. Returns if there is no `payload.action` (2029) or no `game.user` (2032).
2. Returns for the 11 reply actions (2037-2050): ack, the difficulty, hopeCall, sabotage, arm, observeTarget and cleanupTraces results, openingAsk, openingCancel, refused, advancement.offers.
3. Returns unless `isPrimaryGm()` (2051). An Assistant GM is the primary when no full GM is connected (utils.mjs:150-158).
4. Builds `ctx = { asker: senderId, requestId }` (2068-2070). No guard reads `ctx`; I checked all guards in gm-bridge, traps, search-tokens and fog.
5. **Sends the ack before looking up a handler** (2075-2079 comes before 2092-2093).
6. An unknown action returns silently. That has to stay: 15 other files listen on the same `module.danganronpa-rpg` channel.
7. `project.progress`, `project.sabotage` and `project.unsabotage` are chained in arrival order (PROJECT_ORDERED 2107-2114).

**Probe results (measured).** Run on the extracted onSocket text:

| Packet | What onSocket did |
|---|---|
| `searchTokens.spend` | Sent `bridge.ack` to the player |
| `searchTokens.takePlant` | Sent `bridge.ack` to the player |
| `voice.applied` (has a requestId) | Sent `bridge.ack` to the player |
| `voice.whoAmI` | Nothing sent |
| `remnant.tieForItem` | Nothing sent |
| `advancement.ask` | Nothing sent |
| A throwing handler | Ack sent, then the promise rejected |

The first three are stray acks. The player's `onAck` drops them (357-358).

**`refuse(action, why, ctx)` (469-476)**
- Writes `warn('Refused a "<action>" request over the socket from <name>: <why>.')`. The name comes from `ctx.asker`.
- Calls `tellRefused(ctx.asker, action, ctx.requestId)` and returns null.
- `warn` also goes into `sessionFailures()` (utils.mjs:89-104), which is where 30-security reads it.

**`tellRefused(userId, what, requestId)` (484-493)**
- Exported. relay-guard imports it (relay-guard.mjs:59).
- Sends nothing if `userId` is missing or is this user.
- Otherwise sends `{ action: "bridge.refused", userId, requestId, what }` to `[userId]`. **The packet carries no reason.** A failed emit is swallowed.

**`onRefused` on the player (496-510)**
- `replyForMe` checks that the userId is mine and the sender is any GM (349-352).
- Shows the toast `DRPG.Bridge.refused` with `requestLabel(what)`.
- If there is a requestId: clears the ack timer and settles the ruling with `null`.
- `requestLabel` (323-326) falls back to the raw wire name when `DRPG.Bridge.what.<action>` is missing.

**Missing what keys (measured, en and pl).** Six actions have no key in either file:
- observe.target
- cleanup.traces
- advancement.offer
- advancement.ask
- call.approve
- dynamic.difficulty

Also:
- `what.daggerheart` exists and is used by relay refusals.
- `DRPG.Bridge.why` does not exist.
- There are three different player messages today: `noGm` (2358), `noAnswer` (333, 2170, 2182, 2264, 2276) and `refused` (499). Separately there are `DRPG.Observe.noRuling`, `DRPG.Cleanup.noRuling`, `DRPG.Action.dynamicNoRuling`, and in search-tokens `SearchTokens.noGm` and `timeout`.

**Other refusal vocabularies already in the module**
- search-tokens result `reason: "notHere"`, used for every spend refusal (search-tokens.mjs:423).
- The Observe target reply's reason codes (observe.mjs:146-208).
- CRISIS i18n keys (murder.mjs:1101-1128).
- addProgress `reason: "DRPG.Project.*"` (projects.mjs:399-421).
- HOPEBAR localized text.
- relay-guard verdict kinds `forged`, `refused` and `shape` (relay-guard.mjs:320-347).
- vote's `refuseBallot` (vote.mjs:211-213).

## 5. Other files that receive a player's request on the GM

| File:lines | Wire | Who handles it | Sender check and guards, in order | Fields and sanitising | Refusal | Ack or reply | Writes | Notes |
|---|---|---|---|---|---|---|---|---|
| traps.mjs:683-722 | `trap.event` (600), kinds crossing, action, rest, stash | Primary GM | `senderOf` (imported late, 690-691); guardRelayOwner (729-732, "not their character"); `if (!actor) return` silently (702); guardRelayRoom (750-759, `<actor> is not in "<room>"`, via standsIn 774-790: the scene the sender is viewing, one 300 ms retry) | actorId; `to` and `room` checked against where the character stands; `actionKey`, `hit`, `projectId` taken as sent; `hit` is not Boolean()-ed (714) | warn only (697, 706). "A relay is answered to nobody" | The relay sends no requestId (651), so no ack | alert: stampFired to projectMeta (316-331), then a GM-only callGm card (249+) | The `action` kind is not tied to a room (RELAYED_ROOM 726) and nothing checks canSee(projectId). The switch has no default (710-718). The item trigger is a createChatMessage hook with `usedItemRefusal` (798-806, 4 reasons, warn only, 936-966) |
| search-tokens.mjs:415-445 | `searchTokens.spend` | Primary GM | senderOf; guardSearchRoom (385-394): "unknown sender"; GM passes; `searchSpendRefusal` (373-377): "sender does not own that character" or "the character is not in that room" | roomName must equal the located room for a player; the scene comes from `judgedPlace` (396-411); a GM's sceneId is taken as asked | warn plus a result packet `{ok:false, left:null, reason:"notHere"}` | Reply `searchTokens.result` {ok,left}. Also a stray `bridge.ack` (measured) | World setting `searchTokens` (search-tokens.mjs:226-275; world scope settings.mjs:1385) and the `searchedBy` map | The GM check is written inline twice on the player side (533, 547) |
| search-tokens.mjs:447-482 | `searchTokens.takePlant` | Primary GM | Same guard | Same | A result `{ok:false, plant:null, left:null}` with no warn and no reason | Result, plus a stray ack | Client store `trapPlants` via traps.takePlant (traps.mjs:450-465), and `handedOut` | Inconsistent with spend: no log line, no reason |
| search-tokens.mjs:484-500 | `searchTokens.returnPlant` | Primary GM | Checks `entry.userId === senderId`; senderOf is not used | requestId | Silent | Stray ack | `trapPlants` via restorePlant (traps.mjs:399-408) | None |
| fog.mjs:790-835 | `fog.request` | Primary GM | `game.users.get(senderId)` (793), with no connected check | None | None | Reply with the sender's own rows, or the whole union for a GM (sendStoreTo) | Nothing | None |
| fog.mjs:817-829 | `fog.shared` | Primary GM | guardFogShare (777-779) → fogShareRefusal (764-770): "unknown sender" is unreachable; "nobody asked"; "already answered" | A player's `store` is filtered to actors they own (rowsFor, OWNER); a GM's is taken whole | debug only (821) | None | Client store `discoveryLedger` (settings.mjs:1219-1221), shared to every client | None |
| murder.mjs:2630-2672 | `incident.myCastRequest` | Every GM | Any non-GM; checks `castOwners(cast).has(senderId)` | None | None (answers `{}`) | Reply `incident.myCast` | Nothing | The GM-to-GM actions are dropped silently for a non-GM |
| mastermind.mjs:219-266 | `mastermind.doorRequest` | Every GM | Checks `ownerOf(actor)?.id === senderId` (227-231) | None | None | Reply `mastermind.door` {value, room} | Nothing | `ownerOf` finds one owner only (utils.mjs:241-244) |
| vote.mjs:142-209 | `vote.ballot` | The GM that holds `ballots` | Sender is not a GM ("not a player"); `voterActorFor` ("has no living student to vote with"); choice is on the candidate list ("nothing on ... is on their ballot") | `choice` filtered to candidatesFor | warn only, through refuseBallot (211-213) | None. The player already saw "castConfirmed" (vote.mjs:496) | The GM's in-memory `ballots`, and Hooks.callAll | None |
| safeword.mjs:193-199 | `safewordDetail` | Every GM | None. The name comes from Foundry's sender id | `room`, escaped (60-69) | None | None | Popup only | None |
| secret.mjs:480-520 | `secret.card` | Any recipient, GMs included | A non-GM must be the message's author (493-500) | Size ≤ MAX_PLAYER_BYTES (32 KB, 131); a player's HTML is cleaned (`trusted=false`) | debug or warn | None | Client store `secretCards` | Not GM-to-GM, despite what R1b's exemption says |
| voice.mjs:313-386, 388-397 | `voice.applied`, `voice.whoAmI` | Primary GM | Keyed by senderId | room, state | None | whoAmI gets a `voice.assign` reply. `applied` gets a stray ack when it carries a requestId (measured) | GM memory maps | None |
| dice-sync.mjs:114-118 | `diceAppearance.request` | Primary GM | Non-GM sender | None | None | Replies with pushTo | Nothing | None |
| relay-guard.mjs:289-306 | `system.daggerheart` DhGMUpdate and DhGMCreate | Primary GM | senderOf (295). **At 6ea3bba, any `sender.isGM` is forwarded unjudged** (250, 297); E30 C7 narrows this to role GAMEMASTER. Then judgeRelay, with verdicts forward, own, refuse, drop (329-347) | Narrowed per sub-action | reportRefusal (810-833): warn, a GM toast, a whisper to the GMs if forged, and `tellRefused(sender.id, "daggerheart")` with no requestId | None | Daggerheart's own writes | Outside GM_HANDLERS, but it imports `senderOf` and `tellRefused` |

**Checked and not player requests:**
- truth-bullets.mjs:1381-1417 and remnants.mjs:1292-1316 are GM-to-GM; a non-GM sender is refused with a warn.
- sfx, sync, voice-client, and the receiving side of `vote.open`, `mastermind.door`, `incident.myCast`, `fog.rows`/`ledger`/`shareAsk` all check that the sender is a GM or the primary.

## 6. Guards for a 1:1 lift

- **33 `guard*` functions:** 29 in gm-bridge, 2 in traps, 1 in search-tokens, 1 in fog.
- **Eight spend a receipt:** Observe, Analyze, Crisis, Cleanup, Progress, RemnantEdit, Unsabotage, Despair. Each is asked last.
- **Synchronous:** ProgressOwner, ShareGuest, UnsabotageOwner, ArmCharacter, ArmCallGrants, ArmBuyer, ArmOtherCharacter, DespairOwner, DespairDelta, and fog's guardFogShare. All others are async.
- **Asked of a GM sender as well:** ShareSecret, ShareGuest, TieTraceHolder, SendbackPlace, ArmCharacter, ArmCallGrants, ArmNotHeld, DespairDelta (the cap differs), DespairPool, RelayRoom, and SearchRoom's "unknown sender".
- **Everything else skips a GM.** So do `ownsActor` (456) and `canSee` (projects.mjs:211).
- **Checks still written in the handler:**
  - the sender, ownership and sight
  - the amount (1245-1248) and difficulty (1536-1540) ranges
  - handleAdvancement's six checks (701-733)
  - handleAdvancementOffer's (748-762)
  - narrowPlayerRemnant (1354-1356)
- **Refusals after the run** (resolver `.refused`): 642, 675, 1114, and "the Call could not be armed" (1884).

**Brief's guard names mapped to today's code**

| Brief name | Today's code |
|---|---|
| senderOf | 449-452 |
| ownsActor | 454-458 |
| **ownsActorAt** | **Does not exist** (0 hits in e30base and e30wt). The nearest shapes: token → actorId (1642-1644), token → ledger source (1446-1453), and search-tokens' locate-and-compare (385-394) |
| gmOnly | 748 |
| canSeeProject | `canSee`, projects.mjs:210-214 |
| onIncidentTurn | guardCrisisAction → crisisRefusal; guardTieTraceHolder's incident check (1381-1387) |
| sameScene | handover verify `sameRoom` (handover.mjs:176-182), resolveMeddle (monocub.mjs:404-405), the vault room checks, guardRelayRoom, guardSearchRoom. Missing for body.loot |
| isGmOnline | section 8 |

`canSee`, `crisisRefusal` and `sameRoom` live in heavy modules (projects, murder, movement), which gm-bridge imports late. A "leaf" bridge-guards.mjs would have to keep those imports late too.

## 7. Order and atomicity contracts a generic `{guards, sanitize, run}` runner must keep

1. **The order of guards is part of the rule** (586-592). Receipt guards come last. In despair.adjust, delta and pool are asked before the receipt (1952-1955).
2. **Nothing may be awaited between the last check and the write:**
   - project.share asks `canSee` again right before `shareWith` (1320-1324).
   - token.sendBack imports REVERT before the guard (1648-1650).
   - call.arm imports `appendArmedCall` before guardArmNotHeld (1761-1765).
   - armPaidByPlayer imports `hopeHeld` before its guards (1869-1874).
   - advancement.apply takes its latch synchronously (724-738).
3. **One reading shared between guard and write:**
   - The call.arm beneficiary is read once (1753-1756).
   - remnant.place refuses and rebuilds from one `locateActor` (1352-1356).
   - search-tokens' `judgedPlace` WeakMap passes the judged place from the guard to the run (396-411).
4. **Non-refusal early exits:**
   - call.arm answers a replayed nonce with ok (1862-1867).
   - call.approve and dynamic.difficulty dedupe on `askedByCard` (2404, 2431).
5. **call.arm has two roads**, with different guards and different payment.
6. **Replies differ by action:**
   - Result packets: observe.target, cleanup.traces, project.sabotage, call.arm.
   - A whisper: project.progress.
   - A separate packet: advancement.ask.
   - No reply: the rest.

## 8. Where the helpers live, and who imports them

| Helper | Defined | Imported by |
|---|---|---|
| `senderOf` | gm-bridge.mjs:449-452 (active user from Foundry's senderId) | relay-guard.mjs:59 (static), search-tokens.mjs:16 (static), traps.mjs:690 (late) |
| `ownsActor` | gm-bridge.mjs:454-458 | reroll-receipts.mjs:38 (static), search-tokens.mjs:16 (static), traps.mjs:730 and 950 (late) |
| `canSee` | projects.mjs:210-214 | gm-bridge (late) at 1238, 1314, 1526, 1600; projects.mjs 77, 218, 267; public API `game.drpg` (api.mjs:91, 428) |
| `tellRefused` | gm-bridge.mjs:484-493 | relay-guard.mjs:59 |
| `removalRefusal` | gm-bridge.mjs:1498-1513 | tests.mjs:8244 (R148) |

- Other socket files find the sender with `game.users.get(senderId)`, which does not check that the user is connected. They are: fog 793, truth-bullets 1385, remnants 1296, murder 2633, mastermind 238, secret 500, safeword 197, sfx 544, sync 132, vote 171, voice 329, dice-sync 116.
- `ownerOf` (utils.mjs:241-244) also has three inline copies: movement.mjs:735, voice.mjs:799, vote.mjs:349.

**"Is a GM online": four places (measured by grep)**

| Where | Expression | Used by |
|---|---|---|
| utils.mjs:113-115 `activeGmIds()` | `filter(u => u.isGM && u.active).map(id)` | Recipients: emitToGms 148-152, search-tokens 518 and 566, voice-client 170. Public API (api.mjs:237, 1156). primaryGmId's fallback (utils.mjs:156) |
| gm-bridge.mjs:2346-2348 `gmOnline()` | `some(u => u.isGM && u.active)` | hasGm 2356-2360 (toast `DRPG.Bridge.noGm`). action-rolls.mjs 3913, 3950, 4073, 4436 (late); cleanup.mjs 435, 1821 (late); monocub.mjs 245 (late); trial.mjs:57 (static import of the whole of gm-bridge) |
| search-tokens.mjs:533, 547 | The same expression, inline | requestSpend (toast `SearchTokens.noGm`), requestPlant (silent) |
| diagnostics.mjs:1151 | `find(u => u.isGM && u.active)` | The voice diagnostics line |

Related helpers:
- `gmIds()` (utils.mjs:108-110): every GM, connected or not, used for the GM-to-GM syncs, safeword and vote.
- `primaryGmId()` (150-158) and `isPrimaryGm()` (133-137).

## 9. What E31 must keep for the E03 refusal tests to pass unchanged

**30-security** (audit/harness/scenarios/30-security.mjs):
- Reads `sessionFailures()` and filters it by the prefix `Refused a "<action>"` (95, 140, 173, 377-378).
- Reads the `bridge.refused` packet's `what` and `requestId` (69, 111, 131, 186).
- Matches these phrases in the log text:
  - `sender does not own` (100)
  - `not a Hope Call` (142)
  - `not their turn` (175)
  - `not what froze|does not repair` (405)
  - `no Reroll` (412, 468)
  - `not secret` (435)
  - `another character` (449)
  - `already been resolved` (462)
  - `already undone` (482)
  - `did not stand there` (490)
  - `not a visibility` (519)
  - `GM has written` (557)
  - `older than a Reroll` (567)
  - `running incident` (599)
  - `Refused a Daggerheart` (784)

So the English log wording and `what` must stay. A reason code can be **added** to the packet, but must not replace them. If the log line goes through `game.i18n`, the GM's language would change the matched text.

**Suite tests that read gm-bridge.mjs by function name** (tests.mjs lines at 1.2.60; E30 moves them into the tier files):

| Test | Line | What it reads |
|---|---|---|
| R1b | 644-854 | Cuts the table at `const GM_HANDLERS = {` with `\n};` (672-675); handler bodies; guards through `withGuards`; the second half's EXEMPT list |
| R6 | 1034 | Every `export function request*` must contain `hasGm(` |
| R11 | 1270 | Every Promise request needs a `setTimeout` that resolves |
| R47 | 2733 | `handleCleanup` to `handleMeddle` |
| R79 | 4102 | handleAdvancement's regexes, including `[ACTION_ADVANCEMENT]: handleAdvancement,` |
| R89 | 4505 | The text `actorId: payload.actorId` |
| R97 | 4974 | sendDespairToPrimary |
| R98 | 4997 | level-up only |
| R134 | 5173 | The `PAYS` list of handler names, `spendRerollReceipt(` through the guards |
| R138 | 5217 | Order of `handleCrisis` and `crisisRefusal(actor, payload.key)` |
| R41 | 6918 | `appendArmedCall(`, and no `setFlag(...pendingCall` in the bridge |
| R148 | 8244 | Imports `removalRefusal` |
| Unnamed tier-1 test | 8887 | Imports gm-bridge |

R160 (E30) cuts the table the same way R1b does.

## 10. Stale text found on the way

- **gm-bridge.mjs:443-448** says traps.mjs runs "the one socket handler outside this file that acts on a named character". search-tokens.mjs (16, 373-394) and relay-guard.mjs (59, 244, 295) now use the same helpers.
- **traps.mjs:643-644** says "all thirty of its own handlers". There are 33 actions and 32 functions, and 4 functions don't give the unknown-sender refusal.
- **gm-bridge.mjs:143-146** says `hasGm()` runs before every request. askForOffers (811-814) doesn't, and neither does sendDespairToPrimary (2224-2230, which is documented).
- **R1b's EXEMPT list** (tests.mjs:783-799):
  - `call-effects.mjs` (798) has no `game.socket.on`. There are 16 socket files.
  - `secret.mjs`, "GM-to-GM sync" (790), and `fog.mjs`, "every branch checks sender.isGM" (791), are both inaccurate. See section 5.
- **gm-bridge.mjs:1539** has a U+2013 en dash inside a reason string.
- **search-tokens.mjs:546** has a local `requestPlant` with the same name as gm-bridge's `requestPlant` (2892), which is a different action.
- **search-tokens.mjs:442** awaits a synchronous function.

## 11. Player side, briefly: 32 exported `request*` functions (measured count)

**Three waiting patterns**
- **Fire and forget with `expectAck`:** returns `{pending:true}`. `requestProjectProgress` returns `{pending:true, changed:null}`; `requestBodyLoot` returns `true`.
- **`awaitRuling` with one clock:** HopeCallApproval (300 s, no toast), DynamicDifficulty, ObserveTarget, CleanableTraces (180 s each, three different toasts; the last resolves `[]`).
- **Two clocks:** Sabotage and ArmCall.

**No requestId:** requestTieTrace, askForOffers.

**No GM connected:** `hasGm()` returns null, `Promise.resolve(null)` or `Promise.resolve([])` with the toast `noGm`.

The GM branch runs locally in each request and returns whatever the resolver returns. Those are the shapes a single `bridgeRequest` would replace.