# DESPAIR - findings

Domain: Despair economy, Hope/Despair Calls, overflow, Eclipse, Motive/New Rule, Monocub, Mastermind, Breakdown/Wounded.

## Files read (with line counts)

Domain files, read end to end:

| File | Lines |
|---|---|
| scripts/despair.mjs | 684 |
| scripts/overflow.mjs | 738 |
| scripts/calls.mjs | 459 |
| scripts/call-effects.mjs | 1078 |
| scripts/eclipse.mjs | 754 |
| scripts/monokuma.mjs | 191 |
| scripts/monocub.mjs | 513 |
| scripts/mastermind.mjs | 785 |
| scripts/gm-team-dialog.mjs | 439 |
| scripts/states.mjs | 261 |
| scripts/rules.mjs | 382 |
| scripts/config.mjs (STARTING/TIME/ECLIPSE 237-340, REST 1530-1540, HOPE_CALLS 1556-1770, OVERFLOW 1772-1875, DESPAIR_CALLS 1876-2092, MOTIVE 2093-2113, callEffect 2115-2141, STATES 2365-2385, MONOCUB 2426-2470) | 4025 total |

Neighbours followed for the call graph (relevant sections only): gm-bridge.mjs (socket guard 370-400, ARM 1045-1083, DESPAIR 1085-1105, hope-call approval 804-812 and 1327-1347, meddle 786-800, 1646-1660), sync.mjs 200-376, clock.mjs 190-330, actions.mjs 1-60 and 220-240, movement.mjs 340-385, projects.mjs 156-204, utils.mjs (announce/privately/whisper*/isPrimaryGm), settings.mjs (registrations 804-1140, onWorldChange 1170), sheet.mjs 3180-3410, vote.mjs 800-850, season-setup.mjs 770-905, despair-award.mjs 1-140, investigation.mjs 240-255, chapter.mjs 125-145, reroll.mjs 62-150, roll-dialog.mjs 525-560, character.mjs 175-195, states-related SFX_EVENTS in config 3855-3866, tests.mjs 598-625, styles/danganronpa.css 5520-5548 and 11795-11845, lang/en.json sections Despair, Overflow, Calls, Motive, Eclipse, Monocub, Mastermind, States, Rules, Monokuma.

## Strengths

- The Mastermind really never touches world data: identity and lair live in a client-scoped setting on GM browsers, GM-to-GM sync and the single player "door flag" are addressed by Foundry `recipients`, and both socket listeners validate `senderId` rather than the payload (mastermind.mjs 200-300). `mastermindActor()`/`isMastermind()` return null/false off a GM client. I found no path that puts the name on a player client.
- Hope Calls that need a ruling (Experience, Ultimate) are charged only after the yes, the note is mandatory, silence is a refusal, and the price is re-checked after the wait (calls.mjs 128-158). The GM-side dialog is addressed to the primary GM only, so two GMs never race on one ruling (gm-bridge.mjs 386, 804-812).
- Every Despair Call restriction is enforced, not just recorded: Chained and Sealed are read by `restrictedFrom` in movement.mjs 368-373, Silence by `spendHopeCall` and the sheet, and all three are cleared on advance, on rewind and on the season reset (clock.mjs 239, 296; season-setup.mjs 782).
- The overflow stamp design ("armed for a time of day, active while the clock or a running Eclipse matches it") is sound; the boundary is checked twice and pays once, the re-entrancy guard around `armAhead` is real, and rewind un-darkens for free.
- The player's Despair rail is masked consistently at the widget level: pips carry no `filled` class, the count reads `?/12`, the overflow caption reads `?/20`, and the steppers are ghosted with no handler (despair.mjs 553-666, css 5526-5545).
- Refunds exist on every Call path that can fail after payment, and the pool refund goes through `adjustDespair` rather than a remembered number (calls.mjs 165-180, 253-261).

## Findings

### DESP-01 [severity: major] [category: bug] [CONFIRMED]
**Where:** scripts/calls.mjs:152-161, 191
**What happens:** For a Hope Call that waits for the GM (Experience, Ultimate), the code re-reads the player's Hope after the ruling into `now` but then writes the STALE `held` minus the cost. If the player spent Hope on another Call while waiting (held 5, now 3, cost 1 -> writes 4: they gain a point and the Call is free) or a roll granted Hope (held 5, now 6 -> writes 4: charged 2). The receipt whisper also prints `held - call.cost`.
**Evidence:**
```js
const now = hopeHeld(actor);
if (now < call.cost) { ... return null; }
}
await automatedUpdate(actor, { "system.resources.hope.value": held - call.cost });
...
cost: call.cost, left: held - call.cost
```
**Fix:** Re-assign `held = now` inside the `needsGm` branch (or declare `let held` and update it), so both the write and the receipt use the post-ruling value.
**Pitfalls:** `held` is `const`; change the declaration. Keep the pre-ask check so a player who cannot afford it is not put through a five-minute wait.

### DESP-02 [severity: major] [category: bug] [CONFIRMED]
**Where:** scripts/states.mjs:211, 230
**What happens:** The Breakdown/Wounded sounds never play. `SFX_FOR_STATE` is keyed `breakdown`/`wounded` but is looked up with `state.id`, which is `drpgBreakdown`/`drpgWounded` (config.mjs 2367, 2377). The lookup is always `undefined`. The sound-coverage self-test (tests.mjs 598-625) passes because it only checks the string literals appear somewhere. Separately, even once fixed, `playSfx` runs on the primary GM's client (the only client that runs `syncOnce`), while the catalogue hint promises "Heard by that student's player and by the GMs" (config.mjs 3857-3866).
**Evidence:**
```js
const SFX_FOR_STATE = { breakdown: "breakdown", wounded: "wounded" };
...
if (wanted && SFX_FOR_STATE[state.id]) playSfx(SFX_FOR_STATE[state.id]);
```
**Fix:** Iterate `Object.entries(STATES)` and key the map by the entry key, or key `SFX_FOR_STATE` by `drpgBreakdown`/`drpgWounded`. To reach the player, post the state change as a whisper to the owner carrying `flags.[MODULE_ID].sfx` (the pattern resolveMeddle uses) instead of a local `playSfx`.
**Pitfalls:** A whisper per state flip adds a chat card; keep it to "arriving only" as the code already does.

### DESP-03 [severity: major] [category: leak] [CONFIRMED]
**Where:** scripts/despair.mjs:383-389 with lang/en.json:417; scripts/call-effects.mjs:225-230 with en.json:1829; scripts/overflow.mjs:480-484 with en.json:1869
**What happens:** The player rail hides every Despair reading behind "?", but three public chat cards print the numbers: every Despair Call posts "{name} spent {cost} Despair · {left} left" (exact pool remaining, and the GM's ACCOUNT name rather than the pool label), Feed the Overflow posts "now {count}/{max}" (the counter the caption masks), and the overflow card prints "{n} left in the overflow". A player who reads chat knows the pool and the counter to the point.
**Evidence:**
```js
await announce({ content: `...${game.i18n.format("DRPG.Despair.spent", {
    name: foundry.utils.escapeHTML(user?.name ?? "?"), cost: call.cost, left: getDespair(userId) })}...` });
```
```json
"overflowFed": "{n} Despair poured into the overflow - now {count}/{max}.",
"cardLeft": "{n} left in the overflow."
```
**Fix:** Drop `left` from the public card (or move the "left" line to a GM whisper), use `poolLabel(user)`, and word `overflowFed`/`cardLeft` without the count for the public card (the GM already has the caption tooltip and the Despair Flow tab).
**Pitfalls:** The despair.mjs header says "Pools are public. When Monokuma spends Despair the table is meant to see it" - that predates the masked rail (Player Handbook p. 12 quoted in `buildRow`). Decide which rule wins and make both the rail and the cards follow it.

### DESP-04 [severity: major] [category: bug] [CONFIRMED]
**Where:** scripts/overflow.mjs:714-733 vs scripts/call-effects.mjs:215-231 and scripts/despair.mjs:326-345
**What happens:** While the "Despair" darkening runs, `onPreUpdateActor` silently deletes every Hope increase on any character actor - including the Hope a Monokuma just BOUGHT. Fuel a Monocub charges 1 Despair, the hook removes the +1 Hope, and the receipt still says "{name} gains 1 Hope" plus a whisper "you gain 1 Hope". `convertDespairToHope` (Monocub/Mastermind top-up) takes the Despair the same way and reports a grant that did not land. Relief's "Breath" option would be trimmed the same way with no line saying so.
**Evidence:**
```js
if (!overflowBlocksHope()) return true;
if (actor?.type !== "character") return true;
...
delete changes.system.resources.hope.value;
```
```js
await automatedUpdate(choice.target, { "system.resources.hope.value": next });
done.push(game.i18n.format("DRPG.Calls.hopeGranted", { name: choice.target.name, n: next - held }));
```
**Fix:** Either exempt GM-sourced conversions (pass an option through `automatedUpdate`, e.g. `{ drpgDespairConverted: true }`, and let the hook skip when `options` carries it - `preUpdateActor` receives `options`), or make `applyCall`/`convertDespairToHope` check `overflowBlocksHope()` first and refuse with a clear message before the Despair leaves the pool.
**Pitfalls:** The hook deletes the key rather than cancelling the update, so the Call cannot detect the loss afterwards by return value; check before paying.

### DESP-05 [severity: major] [category: flow] [CONFIRMED]
**Where:** scripts/monocub.mjs:222-231, 300-314; scripts/gm-bridge.mjs:786-800
**What happens:** `performMeddle` spends the Monocub's action and Hope on the player's client, throws the dice, and hands the result to the GM. `resolveMeddle` may then refuse (target dead, not same room on the GM's canvas, silenced, not a Monocub...) with nothing but a console `warn` - no whisper, no refund. From the player's side the action and Hope are gone and nothing happened. The same is true when no GM is online: `requestMeddleResolve` returns null after the costs are paid.
**Evidence:**
```js
if (!await spendAction(actor, def.cost)) return null;
await automatedUpdate(actor, { "system.resources.hope.value": hope - def.hopeCost });
...
await requestMeddleResolve({ actorId: actor.id, targetId, help, total, isCritical });
```
```js
const refuse = why => { warn(`Refused a Meddle by ${actor.name}: ${why}.`); return null; };
```
**Fix:** In `resolveMeddle`, on refusal whisper the Monocub (`DRPG.Monocub.meddleFailed` style line naming the reason) and refund the action and Hope (`refundAction`, `automatedUpdate(hope+1)`); in `performMeddle`, check `hasGm()` before spending.
**Pitfalls:** The refund runs on the GM client against the Monocub's actor; use `automatedUpdate` so resource-guard does not flag it.

### DESP-06 [severity: major] [category: text] [CONFIRMED]
**Where:** scripts/monocub.mjs:323, 356-363; config.mjs MONOCUB thresholds 2449-2456
**What happens:** The target of a Meddle is whispered the Monocub-perspective sentence: "You inflict −1 on the player's next roll." / "You grant the player +1..." / "The player wastes the action." The victim reads a sentence addressed to the person who did it to them.
**Evidence:**
```js
const text = help ? hit.help : hit.hinder;
...
await whisperToOwner(actor, `...${escapeHTML(text)}</p>`, meddleSfx);
await whisperToOwner(target, `<p>${foundry.utils.escapeHTML(text)}</p>`, meddleSfx);
```
**Fix:** Add a target-facing pair to each threshold (e.g. `helpTarget: "Something steadies your hand: +1 on your next roll."`) or use the existing `DRPG.Calls.armedForYou` shape for the target (see DESP-07 for its own wording problem).
**Pitfalls:** The target must not learn WHO (design note at monocub.mjs 360-362); keep the target text anonymous.

### DESP-07 [severity: minor] [category: text] [CONFIRMED]
**Where:** scripts/call-effects.mjs:137-147; scripts/gm-bridge.mjs:1075-1080; lang/en.json:1820
**What happens:** `armCall` whispers `DRPG.Calls.armedForYou` = "Another student spent Hope on you: your next roll has {what}" whenever `from !== actor.id`. That fires for Monokuma's Obstacle/Approval (a GM spending Despair, not a student spending Hope) and for a Monocub's Meddle (a dead classmate, and the design says they must not be identified as such). A player hit by Obstacle is told a fellow student paid Hope to hinder them.
**Evidence:**
```js
if (from && from !== actor.id) {
    await whisperToOwner(actor, `...${game.i18n.format("DRPG.Calls.armedForYou", { what: ... })}`);
}
```
**Fix:** Pass `kind` into the whisper choice: Hope -> "Another student spent Hope on you", Despair -> "Monokuma has {what} armed on your next roll", Meddle -> a neutral "Your next roll carries {what}".
**Pitfalls:** The socket path (gm-bridge.mjs 1075) duplicates the whisper; change both, or move the whisper into one helper.

### DESP-08 [severity: minor] [category: text] [CONFIRMED]
**Where:** lang/en.json:1814 (`DRPG.Calls.grants.critical`), used by call-effects.mjs:206, gm-bridge.mjs:1078, sheet.mjs:1298-1302
**What happens:** The 6-Hope Call was redesigned as "Loaded Die" (config.mjs 1739-1745: one die set to 12, critical only on a natural double). Its grant label still says "an automatic critical", so the receipt reads "{name} may now use an automatic critical on their next roll" and the pending tooltip promises a crit that the dice may not deliver.
**Evidence:**
```json
"critical": "an automatic critical",
```
**Fix:** "a loaded die (one die set to 12)".
**Pitfalls:** None; the key `critical` is stored data and must stay.

### DESP-09 [severity: minor] [category: text] [CONFIRMED]
**Where:** lang/en.json:1824; scripts/rules.mjs:5, 92, 239
**What happens:** New Rule costs 9 (config.mjs 2079-2089) and Motive costs 6, but the picker note still says "Twelve Despair buys a permanent change to the game", and rules.mjs comments say "12-Despair", "twelve Despair" and "the nine-Despair Call" for Motive.
**Evidence:**
```json
"newRuleNote": "Twelve Despair buys a permanent change to the game. Make it count."
```
**Fix:** Format the note from `DESPAIR_CALLS.newRule.cost` (`{cost}`), and update the three comments.
**Pitfalls:** None.

### DESP-10 [severity: minor] [category: text] [CONFIRMED]
**Where:** lang/en.json:1905 and config.mjs:1854-1855 vs scripts/overflow.mjs:440-455
**What happens:** Rot's card and editor row say "{n} durability off every item that has any, ruining whatever was on its last point", and the config comment says it goes through `wearItem` "so breaking on the last point behaves exactly as it does everywhere else". The implementation (D1, overflow.mjs 411-431) deliberately NEVER takes the last point - it skips anything with one point left. The table is told things broke that the code protects.
**Evidence:**
```js
const spare = durabilityLeft(item) - 1;
if (spare <= 0) { if (durabilityLeft(item) > 0) spared++; continue; }
```
**Fix:** Reword `what.rot` ("...off every item with more than one point; nothing breaks") and the config comment.
**Pitfalls:** None.

### DESP-11 [severity: minor] [category: flow] [CONFIRMED]
**Where:** scripts/despair.mjs:370-395 and scripts/calls.mjs:265-282; refund at calls.mjs:253-261
**What happens:** Every Despair Call from the sheet produces TWO public cards: `spendDespairCall` posts "Despair Call / Label - effect / X spent N · M left", then `spendDespairCallFor` posts a second `<h3>Label</h3>` card with the receipt lines and the sound. When the effect fails and the pool is refunded, the first card has already told the table the Call was spent; the refund is a GM-only notification, so the table sees a Call that never happened.
**Evidence:**
```js
const ok = await spendDespairCall(user.id, key);   // announces publicly
...
await announce({ content: `<h3>${esc(call.label)}</h3>${body}`, flags: {...sfx: "despairCall"} });
```
**Fix:** Let `spendDespairCall` only charge (keep its announcement for the bare API path behind an option, e.g. `{ announce: false }` from `spendDespairCallFor`), and post one card after the effect lands; on refund post a short public "called off" line.
**Pitfalls:** `game.drpg.spendDespairCall` macros rely on the standalone card; keep it as the default there.

### DESP-12 [severity: minor] [category: bug] [SUSPECTED]
**Where:** scripts/despair.mjs:226-229 (`setDespair`), scripts/overflow.mjs:151-154 (`addOverflow`)
**What happens:** Both stores are written as whole objects computed from the local settings cache. Two GM clients writing at once (primary GM awarding +1 from a roll while the other GM pays a Call from their own pool; or a spill and a Feed the Overflow within the same round trip) lose one write: the later `{ ...pools(), [key]: next }` carries the other pool's pre-update value. The pool race only needs two Monokumas and a busy roll log; it cannot be proven without a live server.
**Evidence:**
```js
const store = { ...pools(), [key]: next };
await game.settings.set(MODULE_ID, SETTINGS.despairPools, store);
```
**Fix:** Route all pool and overflow writes through the primary GM (the bridge already has `ACTION_DESPAIR`; relax its `Math.abs(delta) !== 1` and GAMEMASTER-role guard for GM senders), or store one setting per pool so the whole-map overwrite cannot happen.
**Pitfalls:** A GM's own click on their pips would then wait a socket round trip; the widget re-renders on `SYNC.despair` anyway.

### DESP-13 [severity: minor] [category: bug] [CONFIRMED]
**Where:** scripts/gm-bridge.mjs:1094-1097
**What happens:** A player's Reroll giving a point of Despair back is refused when the pool belongs to an Assistant GM granted a pool via `addPool` (despair.mjs 131-142): the bridge insists on `role === GAMEMASTER`, while `poolUserFor`/`monokumaFor` accept opted-in assistants. The reroll's Despair correction is silently dropped for that table layout.
**Evidence:**
```js
const target = game.users.get(payload.targetUserId ?? "");
if (target?.role !== CONST.USER_ROLES.GAMEMASTER) {
    return refuse(ACTION_DESPAIR, "target is not a Gamemaster");
}
```
**Fix:** Test `monokumas().some(u => u.id === target.id)` from despair.mjs instead of the role.
**Pitfalls:** None.

### DESP-14 [severity: minor] [category: bug] [CONFIRMED]
**Where:** scripts/call-effects.mjs:1004-1014 (`pickProject`)
**What happens:** Contribution's effect text is "a project being worked on in the room you are in", and the picker is shared with Patronage. When the player's room has no project the picker falls back to `visibleProjects()` - every project they can see anywhere - so a player standing in an empty room can Contribute to a project across the map. The comment says the fallback is for Monokuma, but `kind` is never passed in.
**Evidence:**
```js
const here = projectsAvailableIn(room);
const pool = here.length ? here : visibleProjects();
```
**Fix:** Pass `kind` to `pickProject`; for `kind === "hope"` use `here` only and warn `DRPG.Project.none` when empty.
**Pitfalls:** Roomless projects ("abstract work you can do anywhere") are excluded by `projectsListedIn`? Check that helper before tightening, so a legitimately roomless project stays reachable.

### DESP-15 [severity: minor] [category: bug] [CONFIRMED]
**Where:** scripts/call-effects.mjs:737-741 (`gatherEveryone`)
**What happens:** Public Announcement teleports every non-Monokuma character token, including dead students - killed characters keep their token on the map with Foundry's `dead` status (chapter.mjs 132-136). Bodies are moved into the assembly hall. `placingActors` in eclipse.mjs 542-550 excludes the dead for the same reason and this filter does not.
**Evidence:**
```js
const tokens = canvas.tokens.placeables
    .filter(t => t.actor?.type === "character" && !isMonokuma(t.actor))
```
**Fix:** Also skip `isDeceased(actor) && !isMonocub(actor)` (a Monocub is dead and does walk).
**Pitfalls:** Body tokens are evidence: moving one also moves the crime scene.

### DESP-16 [severity: minor] [category: flow] [CONFIRMED]
**Where:** scripts/season-setup.mjs:887-899 (reset table)
**What happens:** The season reset clears the motive, pools, overflow, seals and Eclipse placements but leaves `killingGameRules` (every New Rule bought last season, stamped "Introduced in chapter N" against a clock that is about to read chapter 1 again) and `pendingGather` (a standing assembly that will fire on the new season's first boundary).
**Evidence:** the table lists `trialQueue, searchTokens, eclipseMoves, keyRemnantPlan, discoveredRooms, motive, trialProgress, bodyFound` - no `killingGameRules`, no `pendingGather`.
**Fix:** Add both to the table (rules via a `[]` write, or keep them behind a checkbox if some tables carry "house rules" across seasons - the rules manager already lets a GM add rules by hand, which is the argument for clearing).
**Pitfalls:** If rules are meant to persist, at least re-stamp `chapter` or hide "Introduced in chapter N" after a reset.

### DESP-17 [severity: minor] [category: ux] [CONFIRMED]
**Where:** scripts/despair.mjs:519-532; lang/en.json:1874
**What happens:** While a darkening runs, neither the caption ("Darkened · this time of day") nor the GM tooltip ("This time of day is darkened. {count} of {max}...") says WHICH of the eight was drawn. The only places that name it are the chat card at the moment of firing and the Overflow tab of Despair Flow. A GM asked "what is the penalty right now" has to scroll chat.
**Evidence:**
```js
line.title = isGM ? game.i18n.format(active ? "DRPG.Overflow.gmHintActive" : "DRPG.Overflow.gmHint", { count, max: threshold }) : ...
```
**Fix:** `overflowStatus()` already returns `effectName`; put it in the badge for everyone (the card was public) and in `gmHintActive`.
**Pitfalls:** Badge width; the widget is `max-content` and drives the status strip height.

### DESP-18 [severity: minor] [category: text] [CONFIRMED]
**Where:** lang/en.json:1927; scripts/eclipse.mjs:42-44, 625
**What happens:** Under the Darkness effect an Eclipse hands out one crossing (overflow.mjs 545-548), but the refusal still says "Both Eclipse crossings are used". Comments in eclipse.mjs still say "Two of the five let you start anywhere" and "A Morning or Night Eclipse is pick any room", while `ECLIPSE_FREE_PLACEMENT` is `["night"]` only (config.mjs 336, "Corrected on the author's ruling").
**Evidence:**
```json
"noMovesLeft": "Both Eclipse crossings are used. Your token has been put back."
```
**Fix:** "Your Eclipse crossings are used up." and fix the two comments.
**Pitfalls:** None.

### DESP-19 [severity: nit] [category: text] [CONFIRMED]
**Where:** scripts/calls.mjs:137-140 with gm-bridge.mjs:1343-1346 (en.json 1770-1771); call-effects.mjs:455-456 with calls.mjs:176-178 (en.json 1798-1799)
**What happens:** Two doubled notifications. A Hope Call that times out shows "Nobody answered. Nothing was spent - ask again when a GM is free." and then "{call}: no answer from the GM. Nothing was spent." A failed Call shows "{call} was paid for, but its effect could not be applied. Tell the GM." immediately followed by "{call} did nothing, so the {cost} it cost has been returned." - the first sentence is contradicted by the second, and "Tell the GM" is also shown to the GM for Despair Calls.
**Fix:** Drop the bridge-side `noRuling` toast (the caller already reports), and make `applyCall` not toast at all - let the caller's refund line be the one message.
**Pitfalls:** `applyCall` is also reached via `game.drpg`; keep the log line.

### DESP-20 [severity: nit] [category: text] [CONFIRMED]
**Where:** scripts/despair.mjs:600 and 387
**What happens:** The pool row is labelled with `poolLabel(user)` (custom name), but the pip tooltip says "Set {user.name}'s Despair..." and the public spend card prints `user.name`. The naming layer added so account names stay out of game UI is bypassed in two places.
**Fix:** Use `poolLabel(user)` in both.

## Live checks recommended (things statics cannot settle)

1. DESP-12: two GMs online, one rolling students constantly (primary awards +1), the other paying Calls; compare the bar with the sum of awards and spends over a session.
2. DESP-04: tick only "Despair" in the overflow hat, fire it, then Fuel a Monocub and use the Monocub Hope top-up; confirm the Hope stays unchanged while the pool drops.
3. DESP-02 after the fix: confirm the player hears the state sound (the whisper-with-sfx route) rather than only the GM.
4. `preUpdateActor` shape: confirm `changes.system.resources.hope.value` is an expanded object on Foundry v14 for a Daggerheart roll's own Hope grant (the "Despair" darkening relies on it).
5. Public Announcement with a body on the map (DESP-15) and an assembly still pending across a season reset (DESP-16).
6. Overflow arming during an Eclipse: fill the counter while a Night Eclipse is running and confirm the darkness applies to that Eclipse's placement and to the night that follows, and that the caption badge shows on player clients.

## Hygiene metrics (largest functions, duplicated helpers, dead exports you found)

- Largest functions (approx. lines): `applyCall` 295 (call-effects.mjs), `openMastermindDialog` 196, `spendHopeCall` 171, `openGmTeamDialog` 165, `registerMastermind` 148, `openMonocubDialog` 132, `buildContent` 113 (gm-team-dialog), `buildRow` 112 and `renderDespairBar` 105 (despair.mjs), `startEclipse` 102.
- Duplicated "give Despair as Hope" widget: the donor `<select>` + amount + Give button and its `wireGive` re-wiring exist three times - monocub.mjs 415-490, mastermind.mjs 414-512, gm-panel.mjs 756-775. `openMonocubDialog` itself is reachable only through `game.drpg.monocubDialog`; the GM panel has its own copy of the same table.
- `overflowSection` (overflow.mjs 628-631) recomputes the "Right now" line inline instead of calling the `overflowNowLine()` defined 40 lines above for exactly that purpose.
- `armCall`'s beneficiary whisper is duplicated in gm-bridge.mjs 1073-1080.
- `DRPG.Calls.grants.reroll` is unused (no `grants: "reroll"` exists; Reroll is `reroll: true`).
- Stale comments: rules.mjs 5/92/239 (prices), eclipse.mjs 42-44/625 (free-placement Eclipses), config.mjs 1854 (Rot breaks items), despair.mjs 12 ("Pools are public") vs the masked rail note in `buildRow`.
- `confirmCall` in calls.mjs carries two consecutive JSDoc blocks (290-302), the first describing a free-text box the dialog no longer has.
