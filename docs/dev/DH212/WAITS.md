# DH212 part 2: every wait between a roll click and the dice, on both roads

Read on 12.11.2026. Road (a) is origin/main = 4dfac3a9 (1.2.108, the checkout). Road (b) is the PR branch fervent-sagan-gme4vt = b30f9444 (1.2.109). Daggerheart sources read: 2.12.8 (also 2.10.11 and 2.6.5 for comparison). Dice So Nice's source is not on this machine: what it does is taken from the module's own notes (6.2.9 / 6.3.1 readings), not re-read.

## 0. Does 1.2.108 stand the draw down on 2.12.8? Yes - but not because of the build's shape

The decision is `seamFor` (scripts/roll-draw.mjs:134-139 on main), called once at `setup` by `registerRollDraw` (:176-190). It runs two checks, and both must pass for the build to be wrapped:

```js
// roll-draw.mjs:104-122 (main) - reviewBuild(cls)
const build = cls.build?.[SEAM] ? ... : (sourcesOf(cls, "build")[0] ?? "");
const at = ["buildConfigure", "buildEvaluate", "buildPost"].map(step => build.indexOf(`.${step}(`));
if (at.some(i => i < 0) || !(at[0] < at[1] && at[1] < at[2])) return { ok: false, ... };
if (!sourcesOf(cls, "buildConfigure").some(text => /\.post\$\{[^}]*\}RollConfiguration\x60/.test(text))) return { ok: false, ... };
const hooks = cls.getHooks(); if (!hooks.includes("Duality")) return { ok: false, ... };
const missing = ["fromData", "toMessage", "buildEvaluate", "dualityUpdate"].filter(name => typeof cls[name] !== "function");

// roll-draw.mjs:154-160 (main) - reviewTraitRoad(rollTrait), E76 C3
if (/\{\s*\[native code\]\s*\}/.test(text)) return { ok: false, why: "the actor's rollTrait cannot be read" };
if (/\bMoveContext\b/.test(text)) return { ok: false, why: "the actor's rollTrait builds a MoveContext, which keeps none of the module's roll marks" };
```

2.12.8 against each, measured by running the same index/regex checks over the 2.12.8 source text (a script in the scratch folder, not in the repo):

| Check | 2.12.8 source | Result |
| --- | --- | --- |
| build calls the three steps in order | dhRoll.mjs:47-57 `static async build(config = {}, message = {}) { const roll = await this.buildConfigure(config, message); if (!roll) return; ... await this.buildEvaluate(roll, config, message); } await this.buildPost(roll, config, message); return config; }` | pass (offsets 79 < 273 < 340) |
| configuration hook by the template | dhRoll.mjs:84-89 `` Hooks.call(`${CONFIG.DH.id}.post${hook.capitalize()}RollConfiguration`, roll, config, message) === false `` | pass |
| Duality hooks | dualityRoll.mjs:117-119 `return [...(hooks ?? []), 'Duality'];` | pass |
| fromData, toMessage, buildEvaluate, dualityUpdate | dualityRoll.mjs:122 `static fromData`, dhRoll.mjs:164 `static async toMessage`, dualityRoll.mjs:198 `buildEvaluate`, :262 `static async dualityUpdate` | pass |
| rollTrait names no MoveContext | actor.mjs:727-743 `async rollTrait(trait, options = {}) { ... const config = await MoveContext.build({ ..., ...options, actor: this }); return await this.diceRoll(config); }` | **fail** |

2.10.11 and 2.6.5 pass all five. So `reviewBuild` alone would have wrapped 2.12.8's build; what stands the draw down is the trait-road check E76 C3 added, and `rollDrawRow` (patches.mjs:1278-1286, probe at :326) then reports the row `failed` with "rolls are not drawn by the GM: the actor's rollTrait builds a MoveContext ...". R3602 (scripts/tests-tier1.mjs:9513) says the same and that it was not run on 2.12.8.

1.2.109 narrows that check (roll-draw.mjs:158-166 on the branch): a rollTrait that names a MoveContext passes when `game.system.api.data.actions.MoveContext`'s source matches `/this\.event\s*(?:\?\?=|=)\s*data\.event\b/`. 2.12.8 has it (move-context.mjs:39 `this.event ??= data.event;`) and exposes it (daggerheart.mjs:137-145 `game.system.api = { ..., data, ... }`, data/_module.mjs:11 `export * as actions`). So on 2.12.8, 1.2.109 wraps the build and draws on the GM again, with the marks carried on the event (roll-marks.mjs `carryMarks`, `adoptMarks`).

**Side finding on road (a), read in code, not run.** On 1.2.108 with 2.12.8 a module action roll is thrown locally, and then `throwDice` drops it: `rollTrait` returns the MoveContext (dhRoll.mjs:57 `return config;`), and 2.12.8's `buildEvaluate` (dhRoll.mjs:98-107) writes no `total` into `config.roll` (2.10.11's did: `config.roll = { ...roll.options.roll, total: roll.total, ... }`). So action-pipeline.mjs:266-268 `const total = roll?.total ?? result?.total; if (typeof total !== "number") return null;` returns null and the action is aborted (e.g. action-search.mjs:794 `if (!roll) return abort(actor, paid);`) after the dice and Daggerheart's own card have shown. 1.2.109's `fillRollFacts` (roll-marks.mjs, called at action-pipeline.mjs:271 on the branch) is the fix for exactly that. The module's nonce is also lost on this road, so the roll's claim never matches and Daggerheart's card is not superseded.

## Road (a) - 1.2.108 on Daggerheart 2.12.8: thrown in the player's browser

Order: click -> module's pre-roll checks -> Daggerheart's local build -> message -> Dice So Nice. No request to the GM sits before the dice on this road.

| # | wait | file:line | bound / typical time | can stall? | what the player sees |
| --- | --- | --- | --- | --- | --- |
| a1 | no-GM refusal (synchronous) | action-rolls.mjs:129-132 | 0 ms; refused at once when no GM is connected | no | warning "waits for a GM", nothing rolled |
| a2 | the briefing window (Move's and the action's) | action-rolls.mjs:314 `await briefing(...)` | a person | human | the briefing window |
| a3 | the action's own picker (Search's category etc.) | action-search.mjs:730 `await chooseSearchCategory` | a person | human | the picker window |
| a4 | trait ruling - a statistic other than the action's default waits for a GM's pick | action-search.mjs:741 -> :966 `traitFor` -> bridge row `trait.ruling` (bridge-table.mjs:518 `answer: "reply", patient: true, resend: true, timeoutMs: TIMING.rulingMs`) | up to TIMING.rulingMs = 180000 ms (config.mjs:347); no ack clock (`patient`); resent up to 3 times on a GM's ready (bridge-guards.mjs RESENDS = 3) | yes - a GM who does not answer holds it 3 min | the GM's card is pending; the player waits with no dice; "no answer" at 180 s |
| a5 | dynamic imports before the roll (call-effects, forced-roll) | action-pipeline.mjs:149, :182, :191 | module cache after the first call; first roll after a load fetches them | no | nothing |
| a6 | the action is paid (one actor update, a server round trip) | action-search.mjs:764 -> actions.mjs:200 `trustedWrite` -> resource-guard.mjs:321-322 `doc.update` | one round trip to the Foundry server; no module bound | only if the server never answers (no module bound) | nothing, the window has not opened yet |
| a7 | Daggerheart builds the MoveContext | 2.12.8 actor.mjs:729 `await MoveContext.build(...)`, move-context.mjs:215-235 (`await config.initialize()`) | local, ms; `fromUuid` only when `data.source` is set | no | nothing |
| a8 | the roll window | dhRoll.mjs:76-80 `await DialogClass.configure(...)` (on 2.12.8 the module's `dialog.configure` is lost: move-context.mjs:88 `this.dialog = {}`, then :173 `configure ??= !event || !(shift/alt/ctrl)` - the module's event has none pressed, so it still opens) | a person | human | the roll window |
| a9 | evaluate on this browser | dhRoll.mjs:54 -> :98-99 `await roll.evaluate()` | local randomiser, sub-ms | no | nothing |
| a10 | postRollDuality hooks, then `toMessage`: a second MoveContext.build and, for an action with chatDisplay, `enrichHTML`; a reload step for an item that reloads | dhRoll.mjs:147-157, :164-187 | local, ms | no | nothing |
| a11 | **ChatMessage.create** - the server's round trip; Dice So Nice starts its throw from the message (its pre-process hook, private-rolls.mjs:1473 `keepDiceToReaders`, decides only who sees it) | dhRoll.mjs:201 `await cls.create(msgData, ...)` | 2 one-way hops (client -> server -> client) plus the server's write; no module bound | only if the server never answers | **the dice start here** (and the card waits for them) |
| a12 | Daggerheart waits for the animation | dhRoll.mjs:203-205 `await game.dice3d.waitFor3DAnimationByMessageID(message.id)` | Dice So Nice's throw, typically 1-3 s; no bound in Daggerheart | after the dice, not before | the dice falling |
| a13 | dualityUpdate (countdowns), triggers | dualityRoll.mjs:205-210, :262-280 | local + any writes | after the dice | - |
| a14 | the module's card waits for the dice to settle | action-report.mjs:149-158 `diceSettled`, `Promise.race([waitFor3DAnimationByMessageID, setTimeout(DICE_SETTLE_MS)])` | bounded by DICE_SETTLE_MS (action-report.mjs) | after the dice; on 2.12.8 not reached for an action (the side finding above: `throwDice` returns null first) | - |

A sheet trait click on road (a): Daggerheart's own `rollTrait` (a7-a13), with the module's sheet and window hooks, which are synchronous (roll-dialog.mjs:36-40). Nothing of the module's waits before the dice.

Road (a) total before the dice, leaving the people aside: one actor update (a6, actions only) and one ChatMessage.create (a11), both plain Foundry round trips. Nothing on this road can stall for a GM except the trait ruling (a4).

## Road (b) - 1.2.109 on Daggerheart 2.12.8: drawn by the primary GM (E76b)

Line numbers are the branch's (b30f9444). Steps b1-b6 are the same as a1-a6 (same files, the branch's action-pipeline.mjs roll is at :210 with `carryMarks`).

| # | wait | file:line | bound / typical time | can stall? | what the player sees |
| --- | --- | --- | --- | --- | --- |
| b1-b6 | as a1-a6: no-GM refusal, briefing, picker, **trait ruling (up to 180000 ms)**, imports, the payment's update | as above | as above | a4's | as above |
| b7 | MoveContext.build, then the build's wrapper; marks put back on the config by the `daggerheart.preRollDuality` hook and in the wrapper | actor.mjs:729; roll-draw.mjs:192, :200-203 `adoptMarks(config)`; :322-333 `drawOrThrow` | local, ms | no | nothing |
| b8 | the roll window, configured but not evaluated | roll-draw.mjs:342 `await cls.buildConfigure(config, message)` | a person | human | the roll window |
| b9 | **`roll.draw` asked of the primary GM** | roll-draw.mjs:355 `bridgeRequest("roll.draw", ..., { settle: "reply", timeoutMs: DRAW_ANSWER_MS })` | hop 1-2 (player -> server -> GM). Clocks from the send: the "got it" `TIMING.ackMs` = 8000 ms (config.mjs:355; set at bridge-guards.mjs:1953 because the row is not `patient`), the answer `DRAW_ANSWER_MS` = 30000 ms (roll-draw.mjs:81; bridge-guards.mjs:1960). No `resend` on this request | **yes**: a GM tab that does not run the listener -> "noAnswer" at 8 s; a lost answer after the ack -> "noAnswer" at 30 s; the roll is not made either way | **nothing** while it waits - the window has closed and no pending sign is shown; a warning at 8 s or 30 s |
| b10 | the GM judges the packet: guards (two dynamic imports in `guardDrawnRoll`), then the ack | bridge-guards.mjs:1764, :1797-1801 (ack sent after the guards, before the run); private-rolls.mjs:1136-1141 row | ms | no | - |
| b11 | the one-at-a-time lock per character and action | roll-draw.mjs:1193 | 0 ms; a second click while a draw of the same action is in flight is refused at once | no (refusal) | "refused" |
| b12 | **the GMs' marks open** (`marksOpen` -> gm-stores.mjs:1680 `answerKeysOpen`) | roll-draw.mjs:1179, :1196 | 0 ms once hydrated. After a GM load: up to `TIMING.gmStoreOpenMs` = 16000 ms (config.mjs:447); with a second GM the hydration itself ends at `TIMING.gmStoreSyncMs` = 8000 ms (config.mjs:436) at the latest | yes, but bounded: up to 16 s in the first seconds after the primary GM loads, then a refusal | nothing (the ack has come, so no 8 s warning); refused at 16 s |
| b13 | the roll record's hydration | roll-draw.mjs:1028 `await rollStore.whenHydrated()` | no bound of its own (gm-store.mjs:1102-1104 waits for a real hydration only); in practice settled because b12 passed on the same engine | only in a state b12 already refuses | - |
| b14 | **the payment's ticket** (an action's roll waits until this GM has heard the player's payment update, polled every 100 ms) | roll-draw.mjs:1060-1062, `PAY_WAIT_MS` = 1500 (:858) | 0 ms when the payment's update reached the GM first (the usual case: it was sent before the window opened); up to 1500 ms (+ one poll) otherwise; a sheet roll names no action and skips it (:1027 `if (!key) return null;`) | bounded 1.5 s, then refused "not paid" | nothing |
| b15 | the sheet audit's queue for this character (every write of the student judged first) | roll-draw.mjs:1563 `armedCallsHeld` and :2165 `judgedFor` -> sheet-audit.mjs:710-715 | 0 ms when the queue is empty; else as long as the queued judgements, each of which may include a GM write and `GRANT_WAIT_MS` = 2000 ms (roll-draw.mjs:2520, :728) when its update is not heard back; no overall bound | bounded per item, unbounded in sum; in practice a burst of writes just before the roll (the payment, a Call) | nothing |
| b16 | **the statistic a GM picked** (a pick card's meta polled every 100 ms) | roll-draw.mjs:1981-1983 (a Search claimed on a statistic other than Eye) and :1997-1999 (any roll whose action lists two or more statistics and no earlier source decides), `PICK_WAIT_MS` = 2000 (:1709) | 0 ms when the card is already here; **up to 2000 ms** when it is not, then the lowest listed statistic is thrown | bounded 2 s - but it is paid in full every time no pick card exists for such a roll | nothing |
| b17 | the GM's evaluation; its own screen throws the dice now (not awaited) | roll-draw.mjs:1586 `buildEvaluate`, :1589 `throwOnThisScreen` | ms | no | - |
| b18 | **the GM writes the message** (2.12.8: `toMessage` builds a MoveContext again, then ChatMessage.create) - the wait returns at the message's own createChatMessage, not at the end of `toMessage` | roll-draw.mjs:1593 -> :2355-2364 `Promise.race([created, writing])`; dhRoll.mjs:164-201 | hops 3-4 (GM -> server -> every client) plus the server's write | only if the server never answers (no module bound) | **the dice start here on the player's screen**: `startOnMessage` (roll-draw.mjs:211, :438-446) plays the message's rolls as the message arrives |
| b19 | after the message, before the answer: Hope/Fear and countdowns, the resource write and its echo (`GRANT_WAIT_MS` 2000), the Calls, the record, the reports | roll-draw.mjs:1597-1639 | ms to 2 s | after the dice | dice falling |
| b20 | the answer (hops 5-6), then `playBack`: the roller's copy re-evaluated on the GM's faces, the message fetched if missing | roll-draw.mjs:364, :537-562; secret.mjs:1296 `messageArrives(id, ms = 4000)` | ms; `messageArrives` bounded 4000 ms | after the dice | - |
| b21 | the dice of b18 waited for (only if the message never came first: then they start here, at the answer) | roll-draw.mjs:556-562; :650-660 `playDice`, `Promise.race([showForRoll..., setTimeout(TIMING.diceSettleMs)])` | `TIMING.diceSettleMs` = 6000 ms (config.mjs:375) | the dice start late (at hop 6) only when the message did not reach this browser before the answer | dice |

A sheet trait click on road (b): b7-b10, b12-b13, b15, b17-b21 (no payment, no pick: `drawRefusal` returns at :1027 and a roll that names no action lists no statistic), through `supersedingRoll` with `keepCard: true` (roll-draw.mjs:329-332).

Road (b) before the dice, leaving people and the first-load window aside: 4 one-way hops (two Foundry round trips: the socket request, and the GM's ChatMessage.create broadcast) plus the GM's work. That is twice road (a)'s floor. The GM's work is milliseconds unless b14, b15 or b16 waits.

### The ones that can stall, in one list

| wait | bound | player sees |
| --- | --- | --- |
| a4/b4 trait ruling | 180000 ms (`TIMING.rulingMs`), resent up to 3 times | the ruling pending; no dice |
| b9 a silent GM tab | 8000 ms (`TIMING.ackMs`) | nothing, then "the GM's client did not answer in time"; roll not made |
| b9 an answer lost after the ack | 30000 ms (`DRAW_ANSWER_MS`) | dice usually already shown (they start at the message, b18); the roll is not made and a warning comes at 30 s. If the message was lost too: nothing for 30 s |
| b12 the GMs' marks after a GM load | 16000 ms (`TIMING.gmStoreOpenMs`) | nothing, then a refusal |
| b16 the GM pick's wait | 2000 ms (`PICK_WAIT_MS`), every time the card is not there | nothing |
| b15 the sheet audit's queue | no overall bound; 2000 ms (`GRANT_WAIT_MS`) per unheard GM write in it | nothing |
| b14 the payment ticket | 1500 ms (`PAY_WAIT_MS`) | nothing, then "not paid" |
| b13 rollStore.whenHydrated | none of its own (covered by b12 in practice) | - |
| a6/a11/b18 Foundry server round trips | none in the module | nothing |

Not measured, but worth naming: all of b14-b16 poll with chained `setTimeout(100)`. A GM whose Foundry tab is hidden is subject to the browser's background timer throttling (Chromium aligns hidden-tab timers to 1 s, and after 5 minutes hidden can throttle chained timers further). The loops end on `Date.now()`, so each still ends, but a 100 ms step can become a 1 s step. Taken from the browser's documented behaviour, not from a run here.

## Measured

Machine: 4 cores, Node 22.23.4. Both checkouts' harnesses used the same `package-lock.json` (byte-identical; the branch's run reused main's `node_modules` by a symlink in a scratch clone, nothing committed or changed in the repo; `git status` of the repo stays clean - results go to the git-ignored `audit/harness/results/`).

| Run | Commit | Harness dice | Result | Wall |
| --- | --- | --- | --- | --- |
| `node cluster.mjs scenarios/83-roll-integrity.mjs` | 4dfac3a9 (main, 1.2.108) | Daggerheart 2.10.5 copies (dh-relay 2.10.11) | 110/110 passed, 0 failed, "in 191291ms" | 196.1 s |
| `node cluster.mjs scenarios/33-bridge-paths.mjs` | 4dfac3a9 | 2.10.5 | 74/74 passed, "in 133951ms" | 140.1 s |
| `node cluster.mjs scenarios/33-bridge-paths.mjs` | b30f9444 (branch, 1.2.109) | 2.12.8 copies (commit 0674ac33; dh-relay 2.12.8, ec6b04c3) | 74/74 passed, "in 133644ms" | 139.6 s |
| `node cluster.mjs scenarios/83-roll-integrity.mjs` | b30f9444 | 2.12.8 | 110/110 passed, "in 189617ms" | 194.3 s |

**Scenario 83 records no per-roll times.** Its results carry phase names without durations; the only `ms` fields are each client's stylesheet load. Its 110 checks say every legal road is clean and every console write leaves its one trace, on both dice copies; they say nothing about delay.

**Scenario 33, part A17** ("a drawn roll's dice, with the network's time") is the timing measurement: 80 ms added to every message each client sends and receives, p1 throws Aiko's statistic from the sheet (`sheet`) and her Eye through the module (`action`, no action key, so no payment wait), one of each to warm up, then two of each; times in ms from p1's `roll.draw` leaving.

| commit / dice | roll | GM's message in on p1 | p1's dice start | GM's answer in on p1 | GM's own screen throws (from the request's arrival) | GM sees its message's echo |
| --- | --- | --- | --- | --- | --- | --- |
| 4dfac3a9 / 2.10.5 | sheet | 324.0 | 324.0 | 488.9 | 1.3 | 163.9 |
| | action | 325.1 | 325.0 | 492.2 | 1.6 | 164.8 |
| | sheet | 325.3 | 325.2 | 492.1 | 1.5 | 164.8 |
| | action | 327.7 | 327.7 | 495.2 | 1.3 | 165.0 |
| | medians | 325.3 | 325.2 | 492.2 | 1.5 | 164.8 |
| b30f9444 / 2.12.8 | sheet | 323.9 | 323.8 | 488.6 | 1.3 | 164.6 |
| | action | 325.0 | 324.9 | 490.1 | 1.1 | 164.2 |
| | sheet | 329.7 | 329.6 | 494.9 | 1.3 | 164.4 |
| | action | 323.6 | 323.6 | 489.1 | 1.3 | 164.3 |
| | medians | 325.0 | 324.9 | 490.1 | - | - |

p1's kept trips (`drawTimings().drawn`, `started` / `answered` / `shown`): main 324.1/489.3/490.6, 325.1/492.6/493.3, 325.4/492.6/493.4, 327.8/495.5/496.1; branch 324.1/489.1/490.1, 325.0/490.4/491.2, 329.8/495.4/495.9, 323.8/489.4/489.8.

What these numbers say: 4 hops of 80 ms is 320 ms, so the GM's work between the request and its message took about 4-10 ms headless, on both dice copies; the dice start at the message (within 0.1 ms of it), and the answer comes about 165 ms (2 hops) later. On 2.12.8 the drawn road (b) costs the same as the 2.10.5 drawn road. A refused draw (an Observe nobody paid for, through the 1.5 s `PAY_WAIT_MS`) threw nothing and was told once (`roll.draw:notPaid`) on both; its time is not in the results.

Two other clocks 33 reads, same on both commits: B6, a connected GM whose client says nothing: an Eclipse move settled "noAnswer" at 8000 ms (main) and 8001 ms (branch) - `TIMING.ackMs`, the same clock b9 runs on. B5a, a handler that throws on the GM: refused "failed" in 8 ms (main) and 7 ms (branch).

What the harness cannot say:
- Main's harness has 2.10.5 dice, on which 1.2.108 draws on the GM (its `rollTrait` names no MoveContext). So road (a) as shipped - 1.2.108 on 2.12.8, thrown locally - is **not** what main's run measured; main's A17 numbers are the drawn road on 2.10.x. Road (a)'s own cost was not timed here. The module's notes (roll-draw.mjs, H82 C5) give a probe of 23.10.2026 on the same harness and the same 80 ms: 162-166 ms from Roll to dice for 1.2.50-1.2.66, the local road, which is the two hops of a11. That is quoted, not re-run.
- The branch's harness has 2.12.8 dice, so its A17 is road (b) on 2.12.8. The harness's Dice So Nice is a stand-in: the real throw's start (its first-throw asset loading, a 3D canvas on a slow machine) is not measured; nor is a real server's write time, a real network, nor a hidden GM tab. LIVE-H82-05 and LIVE-E33-05 are the table checks for that; `game.drpg.perf()` reads the last fifty drawn trips at a table.
- The waits b12-b16 are not exercised by A17 (one GM hydrated, no payment, no pick), so their bounds above are from the code, not from a run.

## Proposed fixes, by expected gain

Proposals only. Files marked (roll) are roll files: roll-draw.mjs, forced-roll.mjs, roll-marks.mjs, action-pipeline.mjs, dice-*.mjs, private-rolls.mjs, critical.mjs.

1. **Show the wait.** On road (b) the player sees nothing between closing the roll window and the dice (b9-b18), and nothing for 8 s or 30 s when the GM's tab is silent. A "the GM is throwing your dice" sign after about 300 ms, cleared at `startOnMessage` or at the answer, turns the worst case from "the roll vanished" into a visible wait. roll-draw.mjs `drawAndPlay` (roll). Gain: every long case, without changing a bound.
2. **Ask the pick once, not by polling for 2 s.** b16 pays the full `PICK_WAIT_MS` (2000 ms) every time a roll that lists two or more statistics has no pick card here (a crisis or clean-up step, a Search claimed off Eye before the card synced). Have the roller send the pick card's id as a claim the GM looks up, and skip the wait when the action asks no pick; or wait on the card's creation hook with the same bound instead of 100 ms polls. roll-draw.mjs `TRAIT_SOURCES` (roll). Gain: up to 2 s on those rolls.
3. **Wait for the payment by its update, not by polling.** b14: replace the 100 ms loop with a hook on the payment's `updateActor` (bound kept at 1500 ms), or send the payment's own stamp on the draw so the GM can see it is still in flight. roll-draw.mjs `drawRefusal`, `claimTicket`, `takeCallPayment` (roll). Gain: up to 100 ms per poll, and up to about 1 s per step on a hidden GM tab.
4. **Shorten and retry the lost answer.** b9: since the dice start at the message, the 30 s answer clock only governs what follows. Mark `roll.draw` `resend: true` with an `again` that answers from the record by nonce (the record is keyed and kept, roll-draw.mjs `keepRecord`), so a GM reload or a dropped packet is asked again instead of waiting 30 s; and consider an answer clock near the 8 s ack clock. roll-draw.mjs `drawAndPlay` (roll), private-rolls.mjs `ROLL_ACTIONS` row (roll). Gain: 30 s -> seconds on a lost answer.
5. **Release 1.2.109's road for 2.12.** On 1.2.108 with 2.12.8 a module action's roll shows its dice and then is dropped (`throwDice` finds no `total`, action-pipeline.mjs:266-268). That reads at the table as a roll that "did nothing", which may be part of the report. `fillRollFacts` on the branch is the fix. roll-marks.mjs, action-pipeline.mjs (roll). Gain: correctness, not delay.
6. **Warm the imports at ready.** a5/b5 and the GM's `readyFor` (roll-draw.mjs:2147-2150) load modules by `import()` on the first roll after a load; importing them at `ready` moves that cost off the first click. action-pipeline.mjs, roll-draw.mjs (roll). Gain: the first roll only, size not measured.
7. **Bound the audit queue's share of a draw.** b15 has no overall bound; a `Promise.race` against a few seconds in `armedCallsHeld`'s use by the draw (falling back to the document, as for an unmarked character) would cap it. sheet-audit.mjs (not a roll file) and roll-draw.mjs (roll). Gain: rare, but it is the one unbounded sum before the dice.
8. **Measure at a table before tuning further.** `game.drpg.perf()` on the player's browser reads the last fifty drawn trips (`answered`, `started`, `shown`); a slow one with `started` near `answered` means the message did not come first (b21), one with a large `started` means GM-side work (b12-b16), one with a normal `started` and a late visible throw means Dice So Nice itself. No file changes.
