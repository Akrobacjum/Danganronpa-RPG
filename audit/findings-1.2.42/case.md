# CASE (murder, investigation, class trial) - findings

## Files read (with line counts)

Domain, read end to end:

| file | lines |
|---|---|
| scripts/murder.mjs | 4008 |
| scripts/cleanup.mjs | 2068 |
| scripts/remnants.mjs | 1839 |
| scripts/investigation.mjs | 1425 |
| scripts/truth-bullets.mjs | 947 |
| scripts/vote.mjs | 878 |
| scripts/trial-floor-ui.mjs | 686 |
| scripts/remnant-ring.mjs | 549 |
| scripts/anonymity.mjs | 523 |
| scripts/trial-floor.mjs | 503 |
| scripts/trial.mjs | 494 |
| scripts/secret.mjs | 338 |
| scripts/remnant-icons.mjs | 164 |
| scripts/config.mjs | 54-210 (FLAGS), 680-1027 (REMNANT_TYPES, TRUTH_BULLET_TYPES, OBSERVE/ANALYZE DC, KEY_REMNANTS), 2499-3470 (MURDER_OPENING, INCIDENT, CRISIS_ACTIONS, TRIAL, CLEANUP) |

Neighbours followed for the call graph: utils.mjs (100-380: gmIds, isPrimaryGm, ownerOf, announce, whisper*, privately, plural), gm-bridge.mjs (60-480, 620-960, 1280-1650), chapter.mjs (40-262, 400-625, 680-1075), settings.mjs (250-360, 1175-1290, scope table), live.mjs (all), observe.mjs (all), analyze.mjs (all), visibility.mjs (225-300), mastermind.mjs (583-670), gm-panel.mjs (900-1000 nextStep), reroll.mjs (826-870), tests.mjs (grep for LIVE-001/leak tests), lang/en.json (every `DRPG.*` key used by the 13 domain files was checked by script: **0 missing keys, 0 missing plural pairs**), .github/release-notes/v1.2.42.md.

## Strengths

- The two answer-key ledgers (`remnantSecrets`, `truthBulletSecrets`) are a genuinely sound design: client-scoped on GM browsers, tombstoned merges, cached reads, and every player-facing view (`remnantPublic`, `truthBulletData`, `cleanableTracesForPlayer`, `playerRemnantCard`) is built from a separate `public` record. `remnantData()` answering `null` for a non-GM is the right primitive and it is used consistently.
- Authority discipline over the socket is mostly excellent: gm-bridge.mjs, vote.mjs, truth-bullets.mjs and the incident cast sync all decide from Foundry's `senderId`, narrow packet fields on arrival (`choice`, `free`, `transform`, `viaAction`, `usedItemId`), and re-derive who is who from GM-side state. The vote's ballot Map keyed by sender is exactly right.
- Reroll receipts (`openReceipt`/`undoLastCrisis`, `lastAttempt`/`undoLastCleanup`, observe `pending`) are careful about clamped resource values and refuse to replay when the receipt is missing, saying so to the GMs.
- The 1.2.42 fixes are real: "Close and count" is `action: "tally"`, the chapter end closes the trial and opens the next morning, ballots are per person and exclude the dead, the tally counts out of ballots issued, re-sending confirms, and the incident tracker / evidence log / dashboard are on `keepLive` with sensible watch lists.
- Text is in good shape: every i18n key resolves, plural pairs exist, the GM-facing sentences (`DRPG.Floor.gate*`, `DRPG.Vote.*`, `DRPG.Cleanup.blocked.*`) are short and say what the control does.
- `chargeForUnfoundKeys` guards against double-charging and against charging a plan from another chapter; `resetTrialProgress` deliberately keeps `keysCharged`.

## Findings

### CASE-01 [severity: blocker] [category: leak] [CONFIRMED]
**Where:** scripts/remnants.mjs:1157-1175 (`registerRemnantLedger` socket handler)
**What happens:** The Remnant ledger - the whole answer key: every trace's real type, visibility, `tiedToCrime`, `pointsAt`, `sourceName` (who left it, i.e. the killer on every incident trace), the GM's `note` and `label` - is handed to whoever asks for it. The handler checks that *this* client is a GM, but never that the *sender* is one, and it addresses the full-ledger reply to `payload.from`, a field the sender writes. A player runs `game.socket.emit("module.danganronpa-rpg", {action:"rm.ledgerRequest", from: game.user.id})` from the console, registers a listener for `rm.ledgerFull`, and every connected GM sends them the complete ledger. The same handler also accepts `rm.secret` / `rm.full` from any sender, so a player can overwrite entries on every GM's ledger (mark a trace deleted, retype their own incident trace as Faint so the sweep clears it). truth-bullets.mjs:889-912 closed this exact hole for its ledger and its comment describes the attack verbatim; remnants.mjs never received the same fix.
**Evidence:**
```js
game.socket.on(SOCKET_EVENT, async payload => {
    if (!game.user?.isGM || !payload) return;
    ...
    } else if (payload.action === RM.request && payload.from !== game.user.id) {
        game.socket.emit(SOCKET_EVENT,
            { action: RM.full, from: game.user.id, ledger: readRemnantLedger() },
            { recipients: [payload.from] });
```
**Fix:** Take `senderId` as the second argument, refuse when `!game.users.get(senderId)?.isGM`, ignore `senderId === game.user.id`, and address the reply to `senderId` - a copy of the block in truth-bullets.mjs:906-935. Add a suite case mirroring the Truth Bullet one.
**Pitfalls:** None functional - GMs are the only legitimate senders today. Keep `from` only as the self-echo guard.

### CASE-02 [severity: blocker] [category: leak] [CONFIRMED]
**Where:** scripts/murder.mjs:1608-1612 (`snapshotState`), 1620-1647 (`openReceipt`), 1649-1656 (`closeReceipt`), 194-206 (`writeState` split)
**What happens:** LIVE-001 moved `killerId`/`victimId`/`thirdId` out of the world setting into the client-scoped cast. Every crisis action then writes a Reroll receipt into the *world* half: `closeReceipt` calls `writeState({ lastCrisis: receipt })`, `lastCrisis` is not in `CAST_FIELDS`, and the receipt contains `state: snapshotState()` - a deep clone of the **merged** `murderState()` (names included) - plus `actorId` and `victimId` at top level. From the first crisis action onwards any player can read `game.settings.get("danganronpa-rpg","murderState").lastCrisis.state.killerId`. `migrateIncidentSecrets` (2564) only lifts the five top-level fields, so it never scrubs this either. The receipt outlives the fight: it stays in world data through Stage 6 until `endMurder` wipes the state.
**Evidence:**
```js
function snapshotState() {
    const { lastCrisis, ...rest } = murderState() ?? {};   // merged: cast included
    return foundry.utils.deepClone(rest);
}
...
return { actorId, key, state: snapshotState(), ... victimId: state.victimId ?? null, ... };
...
await writeState({ lastCrisis: receipt });               // -> publicPatch -> world setting
```
**Fix:** Either strip `CAST_FIELDS` (and `actorId`/`victimId`) out of the receipt before writing and re-attach them from `readCast()` on undo (the cast is still on every GM at undo time), or store the receipt in the client-scoped cast entry (it is synced GM-to-GM already). Add a suite assertion that the public `murderState` setting, serialised, contains none of the participant ids after a crisis action.
**Pitfalls:** `restoreState(receipt.state)` relies on the merged shape; if the cast is stripped from the receipt, rebuild it from `readCast()` before calling `restoreState`. A receipt written by an older version still sits in world data on a mid-chapter upgrade - scrub it in `migrateIncidentSecrets`.

### CASE-03 [severity: major] [category: leak] [CONFIRMED (by the module's own E17 measurement; re-verify live on v14)]
**Where:** scripts/utils.mjs:299-310 (`whisperToOwner` sets `speaker: ChatMessage.getSpeaker({actor})`), scripts/secret.mjs:33-42 (header: "a non-recipient can still see THAT a private card exists, from which speaker, and who it was addressed to"); call sites murder.mjs:3566 (Stage 4 invitation), 677 (victim told the incident began), 2693 (third party), 764 (self-inflicted), 3378 (`announceCrisis` whisper list = owners of killer+victim+third); cleanup.mjs:777, 796, 824, 832, 1192, 1448, 1771, 2062 (every Stage 6 card, speaker = the killer's actor); chapter.mjs:161-186 (death card whispered to participants' owners).
**What happens:** secret.mjs moves the *words* off the document, but the document itself still travels to every client with `speaker.actor`/`speaker.alias` and the `whisper` recipient list. The moment a direct murder opens, `rollOpening` posts a card whose speaker is the killer's actor and whose recipients are the GMs plus the killer's user. Every crisis card is addressed to exactly the two/three users in the incident. Every Stage 6 card (`report`, `concealFromWitnesses`, `resolveStageSix`, `destroyTools`) carries the killer's name as `speaker.alias`. A bystander needs one console line - `game.messages.contents.filter(m=>m.flags["danganronpa-rpg"]?.secret).map(m=>[m.speaker.alias, m.whisper])` - and the anonymity LIVE-001 and CASE-02 protect is gone. This is a bigger surface than either ledger: it needs no forged packet, only reading.
**Evidence:**
```js
export async function whisperToOwner(actor, content, extra = {}) {
    ...
    return privately(stamped({
        content,
        speaker: actor ? ChatMessage.getSpeaker({ actor }) : undefined,
        whisper: Array.from(new Set(ids)),
```
**Fix:** For the incident/Stage 6/opening cards: (1) do not set an actor speaker - add a `whisperToOwner(actor, content, { anonymous: true })` or a sibling helper that leaves `speaker` as the posting user; (2) make the recipient list uninformative by posting the stub to *every* user (`whisper: game.users.map(u=>u.id)`) and sending the words only to the real recipients over the existing secret socket - then have secret.mjs's `renderChatMessageHTML` hook hide (not blank) a stub card whose words this client never received, so non-recipients see nothing in the log. The `deathAudience` card in `killCharacter` should get the same treatment.
**Pitfalls:** Popups: popup.mjs raises module cards by flag; a card every client receives must not raise a popup on non-holders (gate on `secretHtml(message)`). Chat scrollback for a GM who was offline is already lost by design. Foundry's `ChatMessage#visible` will show the card to everyone in the whisper list, which is why the hide-on-render step is required, not optional.

### CASE-04 [severity: major] [category: leak] [CONFIRMED]
**Where:** scripts/murder.mjs:275-279 (`armBetrayalWindow`), 1135 (`takeCrisisAction`), config.mjs:82-105 (FLAGS.betrayalWindow comment)
**What happens:** Two actor flags name incident participants, and actor flags are world data every client receives. `betrayalWindow` is `{ killerId, chapter, day }` written on the accomplice's actor the moment the incident reaches Stage 6 and kept until the day ends - so for the rest of the day `game.actors.contents.map(a=>a.flags["danganronpa-rpg"]?.betrayalWindow)` names the killer and the accomplice. `swungWeapon` is written by the player's own client on whoever swings anything (killer, and a victim who fights back) and cleared only at `endMurder` - i.e. it names both participants for the whole of Stage 6. The config comment justifies the flag with "it has to be readable on that player's own client", which is true of a flag and also true of everyone else's.
**Evidence:**
```js
await third.setFlag(MODULE_ID, FLAGS.betrayalWindow, { killerId: killer.id, chapter: ..., day: ... });
...
await actor.setFlag(MODULE_ID, FLAGS.swungWeapon, swung.id);
```
**Fix:** `betrayalWindow`: keep the offer GM-side (in the cast entry or the Blackened ledger) and push a boolean "you may betray" to the accomplice's client over the recipient-addressed socket, the same road `CAST_MINE` uses; the sheet tile then reads a client-scoped setting. `swungWeapon`: it is only read GM-side (`rememberedTool` in cleanup.mjs); carry it in the crisis packet (`requestCrisisResult({... swungId})`) and store it in the GM-side cast/receipt instead of on the actor.
**Pitfalls:** `betrayalTarget` is read on the player's client by the sheet; the client-scoped replacement must survive a reload (ask the GMs on `ready`, as `CAST_MINE_REQUEST` does). `sweepBetrayalWindows` and the D18 suite tests (tests.mjs:2542-2590 grep for `FLAGS.betrayalWindow`) will need rewriting.

### CASE-05 [severity: major] [category: bug] [CONFIRMED]
**Where:** scripts/investigation.mjs:1210-1250 (Save callback), 1388-1420 (`applyDashboardSave`), 815-840 (`readAs` filter), 878-905 (rows built from `shown`)
**What happens:** The Traces table only renders the rows the filter shows (default on first open: the current chapter), but Save walks `allTraces()` and reads every row's fields with `q(...)?.value ?? ""` / `?.checked ?? false`. For every trace **not on screen** that yields `name: ""`, `faint: false`, `tiedToCrime: false`, `reinforced: false`; `applyDashboardSave` then compares those against the ledger and writes the differences. Pressing Save with the chapter filter on (the default) un-reinforces and un-ties every earlier chapter's Key/Final Remnants, clears Faint on hidden rows, blanks their public names, marks them `gmEdited`, and propagates the untied verdict onto every copied Truth Bullet. The "leftover Key Remnants" warning on the Key tab makes this the common case in chapter 2+.
**Evidence:**
```js
traces: traces.map(({ token, scene }) => {           // allTraces(), not `shown`
    const key = rowKey(scene.id, token.id);
    return { key, ..., name: q(`name.${key}`)?.value.trim() ?? "",
             faint: q(`faint.${key}`)?.checked ?? false,
             tiedToCrime: q(`crime.${key}`)?.checked ?? false,
             reinforced: q(`reinf.${key}`)?.checked ?? false };
...
if (row.faint !== data.faint || row.tiedToCrime !== data.tiedToCrime || row.reinforced !== data.reinforced) {
    await setRemnantFlags(token, { faint: row.faint, tiedToCrime: row.tiedToCrime, reinforced: row.reinforced });
```
**Fix:** Skip a row whose fields are absent from the form (`if (!q(\`name.${key}\`)) continue;` in the callback, or return `null` and filter), so only rendered rows are compared. Same guard for `img`.
**Pitfalls:** `keepLive` may have rebuilt the region between open and Save, so "rendered" must be judged at Save time against the DOM, which the fix above does.

### CASE-06 [severity: major] [category: bug] [CONFIRMED]
**Where:** scripts/cleanup.mjs:1607-1629 (`recreationDataFor`), 999, 1669
**What happens:** A Reroll of an erased trace re-creates it from `recreationDataFor(token)`, which reads `type`, `visibility`, `faint`, `reinforced`, `tiedToCrime`, `note`, `sourceActor`, `room`, chapter stamp... off the **token flags**. Since the ledger migration a token carries only `isRemnant` (and `fromIncident`), so every field is `undefined`. `placeRemnant` then defaults: the trace comes back as an Evident Prep Remnant with no source, no room, no stamp, explicit `tiedToCrime: false` (so the incident auto-tie is skipped), no `itemIdentity`, no `label` and a fresh default `public`. The comment on the function still says "`placeRemnant` takes exactly this shape, so recreating is handing the flags back".
**Evidence:**
```js
function recreationDataFor(token) {
    const f = key => token.getFlag(MODULE_ID, REMNANT_FLAGS[key]);
    return { x: token.x, y: token.y, sceneId: ..., type: f("type"), visibility: f("visibility"), ...
```
**Fix:** Build it from `remnantData(token)` (and `remnantPublic`) captured *before* `removeRemnant` runs: `{ x, y, sceneId, type: d.type, visibility: d.visibility, ..., itemIdentity: d.itemIdentity }`, and re-apply `public` via `setRemnantPublic` after re-placing. Note `removeRemnant` tombstones the ledger row, so the capture must happen first (it already does at line 999).
**Pitfalls:** The re-created token gets a new id; bullets copied from the old one keep the old `remnantId`/`remnantRef` - already documented as accepted.

### CASE-07 [severity: major] [category: ux] [CONFIRMED]
**Where:** scripts/vote.mjs:168-192 (`onBallotCast`), scripts/trial-floor-ui.mjs:327-340 (`read()` → `pendingVoters()`), 448-470 (`keepLive` with no ballot hook), 560-660 (`openVoteDialog`, static)
**What happens:** Ballots arrive on a socket and land in a plain Map; `onBallotCast` fires no hook and writes no setting, and `keepLive` only listens to document/setting hooks. So the trial console's "N still to vote: A, B" line, and the vote window's own list, never update as ballots come in - the GM has to close and reopen to learn whether everyone has voted, which is the one thing they open the window to find out during a vote. (`grep Hooks.call scripts/vote.mjs` is empty.) The release notes list the trial console among the windows made live; this line is the exception.
**Fix:** `Hooks.callAll("drpgBallotsChanged")` in `onBallotCast`, `openVote`, `remindVoters` and `closeVote`, and add `watch: { hooks: ["drpgBallotsChanged"] }` to the console's `keepLive`. Give `openVoteDialog` a `keepLive` region for the status line (its button set changes with `running`, so reopen on that signature, as the console does).
**Pitfalls:** Only the collecting GM holds the Map; a second GM's console will still read "not running" - say so in the line rather than showing a stale count.

### CASE-08 [severity: minor] [category: bug] [CONFIRMED]
**Where:** scripts/vote.mjs:135-138, 148, 169; scripts/gm-bridge.mjs:107-111 (`onGmReady`), 173-176 (`onOpeningAsk`), 376-395 (`onSocket` → `isPrimaryGm()`), utils.mjs:127-129
**What happens:** The 1.2.42 notes say the intermittent `Cannot read properties of null (reading 'isGM')` was fixed and "all five socket handlers are guarded". The five named ones are; vote.mjs's handler reads `game.user.isGM` bare in both branches, and every gm-bridge listener reaches `game.user.id` through `isPrimaryGm()` / `payload.userId !== game.user.id` with no `?.`. A ballot, an ack or a bridge request in flight while a client is starting or closing throws the same TypeError.
**Evidence:**
```js
function onBallotOpened(payload, senderId) {
    if (game.user.isGM) return;
...
export function isPrimaryGm() {
    return primaryGmId() === game.user.id && game.user.isGM;
```
**Fix:** `if (!game.user) return;` at the top of the vote handler and of `onSocket`/`onGmReady`/`onOpeningAsk`/`onOpeningCancel`/`replyForMe`; or make `isPrimaryGm()` return false when `game.user` is null.
**Pitfalls:** None.

### CASE-09 [severity: minor] [category: hygiene] [CONFIRMED]
**Where:** scripts/gm-bridge.mjs:911-925 (`ACTION_REMNANT_EDIT`)
**What happens:** The ownership guard reads `token.getFlag(MODULE_ID, REMNANT_FLAGS.sourceActor)`, a flag that no longer exists on tokens since the ledger migration, so `source` is always `undefined` and `ownsActor(sender, undefined)` is always false: every player-originated `requestRemnantEdit` is refused with "sender did not leave that Remnant". It is currently unreachable from the interface only because a player's reroll bookmark never learns a remnant id (`placeRemnant` returns `{pending:true}` over the bridge; reroll.mjs:838-846 prints `DRPG.Reroll.remnantManual` instead). Two dead ends that happen to agree; the first one that stops being dead (e.g. the bridge echoing the placed id back) turns into a refusal of every legitimate reroll.
**Fix:** Read `remnantData(token)?.sourceActor` (this handler runs on the primary GM, which holds the ledger).
**Pitfalls:** None.

### CASE-10 [severity: minor] [category: flow] [CONFIRMED]
**Where:** scripts/murder.mjs:649-652 (stale comment), 3640-3700 (`throwOpeningRoll` re-offer cap), 3800-3850 (tracker buttons for `openingRoll`), 838-860 (`resolveVictimOpening` success)
**What happens:** Three loose ends around Stage 4. (a) The comment in `openMurder` says "The tracker keeps its button. This is the first invitation, not the only one"; the tracker's own comment says "There is no 'roll the opening' button, and there must not be one". The code is the second. (b) After the three re-offers the GM is whispered `openingDeclined` ("end this incident, or open it again from the panel") - the only route is End + reopen, which re-sends the invitation and repeats the three-strike loop; there is no single "ask again". (c) A trap the victim *notices* (`resolveVictimOpening` success) leaves the incident `active` at stage `openingRoll` with no prompt: the tracker offers only End/Close, `openMurder` refuses any other murder ("one at a time"), `nextStep` keeps saying "incident", and every trace anyone leaves anywhere is auto-tied (CASE-11) until the GM notices and closes it.
**Fix:** Delete the stale sentence; add a tracker button "Ask for the opening roll again" that is only offered after `openingDeclined` was posted (stamp `openingDeclinedAt` in state) so the duplicate-invitation problem cannot recur; on the victim's success, whisper the GMs a line that ends with the tracker's End button being the next step, or offer a confirm to close it there.
**Pitfalls:** The re-ask must go through `rollOpening` so an offline owner still gets the GM-side throw.

### CASE-11 [severity: minor] [category: bug] [SUSPECTED - design argument]
**Where:** scripts/remnants.mjs:296-303 (`placeRemnant` auto-tie), config.mjs:3115-3140 (D3: Stage 6 is "the killer's own night")
**What happens:** While `murderState()` is truthy - which includes the whole of Stage 6, and after CASE-10(c) an incident nobody closed - every trace placed by anyone anywhere in the building is stamped `tiedToCrime: true`. The check reads neither the room nor the participants. Tied traces survive the Faint sweep and are sorted first by `rankForObserve` ("show the murder first"), so an innocent's Search on the other side of the map during the killer's clean-up hours becomes crime evidence the GM must untick by hand on the dashboard. The comment argues "a trace left by anything at all during an incident is caught", which is right for the room it is happening in and not for the corridor two floors up.
**Fix:** Tie automatically only when `state.stage === "incident"` **and** the source actor is a participant or standing in the victim's room, or the trace type is `incident`/`resolution`; leave the rest to `tieChapterTraces` at the victim's death (which already ties the chapter's traces on that beat).
**Pitfalls:** `dropRemnant` from a player travels over the bridge with `tiedToCrime: null`; the decision still has to be GM-side. Check the suite's D-series expectations on incident tying before changing the default.

### CASE-12 [severity: minor] [category: hygiene] [CONFIRMED]
**Where:** scripts/remnants.mjs:1540 (`retuneRemnant` remove), 1833 (`clearFaintRemnants`); scripts/murder.mjs:1680 (`undoLastCrisis`); scripts/cleanup.mjs:1660 (`undoLastCleanup`)
**What happens:** Four token deletions bypass `dropRemnantSecret`, so the ledger keeps a live row for a token that no longer exists. `removeRemnant` and `clearChapterKeyRemnants` do tombstone, and `removeRemnant`'s comment says why ("the ledger grows for the life of the world"). E17 measured 685 entries / 174 KB and a per-read parse cost; the sweep is the largest single producer.
**Fix:** One GM-side `Hooks.on("deleteToken", doc => { if (isRemnant(doc)) dropRemnantSecret(doc) })` on the primary GM, and drop the four call-site special cases.
**Pitfalls:** `undoLastCleanup` re-places an erased trace under a new id, so the tombstone for the old id is correct; nothing reads it back.

### CASE-13 [severity: minor] [category: leak] [CONFIRMED]
**Where:** scripts/secret.mjs:288-297; scripts/gm-bridge.mjs:893-902 (`ACTION_REMNANT`)
**What happens:** (a) `secret.card` is accepted from any sender: a player can emit `{action:"secret.card", id:<any message id>, html:"..."}` addressed to another player and that client stores and renders the forged words for a real GM card - spoofed private narration ("the GM ruled ..."). (b) `remnant.place` only checks the sender owns `data.sourceActor`; every other field is taken as sent, so a player can plant a `type:"key"`, `reinforced:true`, `tiedToCrime:true` trace from the console, which the planner then counts and the sweep never removes.
**Fix:** (a) accept the words only when `game.users.get(senderId)?.isGM` or `senderId === message.author?.id`. (b) narrow `type` to what a player action can legitimately leave (never `key`/`final`/`autopsy`), force `reinforced: false` unless the sender is a GM.
**Pitfalls:** (a) `postSecret` from a player (`presentBullet` uses `announce` without whisper, so today only GMs post secrets; the author check covers a future player-posted whisper).

### CASE-14 [severity: minor] [category: flow] [CONFIRMED]
**Where:** scripts/vote.mjs:266-279 (`eligibleVoters` requires `u.active`), 320-328 (`pendingVoters`), 445-452 (`issued = returned + silent`), 340-380 (`castBallot` dialog)
**What happens:** A player who drops after ballots go out is no longer `active`, so at close they are neither returned nor pending: the room was told "4 ballots are out" and the card says "3 of 3" with the majority computed over 3. A player who reconnects appears as pending and Remind reaches them - good - but Remind to a player whose ballot window is still open stacks a second window, and casting from either counts (the second silently replaces). No ballot is lost, so this is bookkeeping, not a wrong verdict.
**Fix:** Freeze the issued list in `openVote` (`issuedTo = new Set(voters.map(v=>v.user.id))`), report `silent` against it, and have `castBallot` close an already-open ballot before opening the new one (track the dialog instance).
**Pitfalls:** A frozen list must still admit a player who joined mid-vote via Remind; union the two.

### CASE-15 [severity: nit] [category: ux] [CONFIRMED]
**Where:** scripts/cleanup.mjs:400-414 (`attemptCleanup`), 1270-1290 (`attemptStageSix`)
**What happens:** On the Tamper road (`viaAction`) the action is spent (`spendResolutionAction`) before the concealment roll and before the main roll; closing either roll dialog returns null with the action already gone and nothing done. For the Stage 6 killer this costs nothing (they are exempt), so it only bites the innocent tamperer.
**Fix:** Spend after the rolls resolve, or refund on a null roll.

## 1.2.42 release-note check

| claim | status |
|---|---|
| "Close and count" reaches its handler (`action: "tally"`) | complete - trial-floor-ui.mjs:645 |
| End of chapter closes the trial and opens the following morning with refilled actions | complete - chapter.mjs:1016-1035 (`closeTrial` then `setTimeOfDay("morning", {resetActions:true,...})`) |
| Ballots per person, dead excluded, "N of N" out of ballots issued | complete - vote.mjs:266-279, 445-452; see CASE-14 for the disconnect edge |
| Re-send confirms; default follows state | complete - trial-floor-ui.mjs:640-690 |
| Incident tracker live | complete - murder.mjs:3830-3900; the Stage 6 table redraws on token/actor changes but not on a ledger-only retune (client setting fires no `updateSetting`) - cosmetic |
| Trial evidence log live | complete - trial.mjs:470-490 (chat hooks) |
| Planned Key / Final Remnant carry name + player text; Final tab says who copied it | complete - investigation.mjs:353-380, 1090-1110; mastermind.mjs:607-650 |
| Key Remnant shortfall sentence | complete - `DRPG.Investigation.unfoundKeys.*` |
| "All five socket handlers are guarded" against null `game.user` | incomplete - vote.mjs and every gm-bridge listener are not (CASE-08) |
| Trial console live | the floor/progress half is; the ballot count is not (CASE-07) |

## Live checks recommended (things statics cannot settle)

1. On Foundry v14, confirm from a player's console that `game.messages` holds whispered module cards with `speaker.alias` and `whisper` populated (secret.mjs says E17 measured this; CASE-03 depends on it still holding).
2. Player client ordering: `CAST_MINE` (cast) is emitted before `murder.openingAsk`; if the ask ever lands first, `openingStillWanted` reads no `killerId`, the loop breaks and the invitation dies silently with no GM whisper (murder.mjs:3673-3690).
3. Two GMs: primary changes mid-incident (lowest-id full GM reconnects). `lastAttempt` (cleanup rerolls) and observe `pending` are per-browser and lost; check the "reroll lost" whispers actually reach the new primary.
4. Primary GM disconnected mid-objection: no client advances the floor (`advanceIfDue` is primary-only); confirm the HUD overruns gracefully and the mode advances on reconnect.
5. `moveBody` teleports the victim's token → `updateToken` → `maybeBodyFound` on the body's own move; a destination room with two innocents fires the discovery immediately. Decide whether that is intended.
6. `openIncidentTracker` reopen loop on stage change (`after` → close → reopen) with two GMs each holding a tracker.

## Hygiene metrics

Largest functions (approx. lines): `openInvestigationDashboard` (investigation.mjs 760-1385, ~625 - the `buildCase` closure alone is ~330); `resolveCleanup` (cleanup.mjs 730-1060, ~330); `takeCrisisAction` (murder.mjs 940-1190, ~250); `manageClassTrial` (trial-floor-ui.mjs 300-560, ~260); `openIncidentTracker` (murder.mjs 3730-3925, ~195); `placeRemnant` (remnants.mjs 250-450, ~200); `resolveCrisisAction` (murder.mjs 1400-1575, ~175); `openMurderDialog` (murder.mjs 3385-3530, ~145).

Duplicated helpers: `spendStress`/`restoreStress` exist in both murder.mjs (2270-2300) and cleanup.mjs (1700-1730) with slightly different clamping; `tokenById` (remnants.mjs) vs `findRemnantToken` (cleanup.mjs, scans every scene by id alone); `findersByRemnant` vs `findersByAnyRemnant` (investigation.mjs, one filter apart); three copies of "who is in the incident" - `participantIds` (murder), `incidentParticipant` (cleanup), `myIncidentTrace` (visibility), `incidentParticipants` (settings) - with two different answers about a walked-in third party; `killCharacter` builds its own audience list rather than calling `announceCrisis`'s.

Comments that no longer match code: murder.mjs:649 ("The tracker keeps its button"); cleanup.mjs:1596-1606 (`recreationDataFor` "handing the flags back"); config.mjs:88-97 (`betrayalWindow` "readable on that player's own client" - it is readable on every client); the gm-bridge `ACTION_REMNANT_EDIT` comment describes a check that can no longer pass.

Dead or near-dead: `CLEANUP.transform.types` is read only by the bridge's narrowing (the player menu it bounded is gone); `reportRemnants` has no UI caller (grep: api only); `OLD_ICON`/`adoptQuestionMark` and `migrateRemnants` are one-shot migrations still running every load; `SETTINGS.blackened` kept only for `migrateIncidentSecrets`.

Magic numbers not in config: `MAX_ATTEMPTS = 3` (opening re-offers), `ACK_TIMEOUT_MS = 8000`, ruling timeouts `180000`/`300000` (gm-bridge), `KEEP = 500` (secret cards), `PENDING_TTL_MS` (observe) - all defensible as local constants but scattered across five files.
