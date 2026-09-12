# COMMS - findings

Domain: the module -> GM -> player -> module information flow (bridge, messenger, popups, safeword, voice, music, SFX, dice sync, camera dock).

## Files read (with line counts)

| file | lines | read |
|---|---|---|
| scripts/gm-bridge.mjs | 1996 | full |
| scripts/messenger.mjs | 256 | full |
| scripts/messenger-app.mjs | 996 | full |
| scripts/popup.mjs | 371 | full |
| scripts/events.mjs | 373 | full |
| scripts/explain.mjs | 378 | full |
| scripts/safeword.mjs | 201 | full |
| scripts/voice.mjs | 1295 | full |
| scripts/voice-client.mjs | 436 | full |
| scripts/music.mjs | 1561 | full |
| scripts/sfx.mjs | 1316 | full |
| scripts/dice-sync.mjs | 112 | full |
| scripts/camera-view.mjs | 222 | full |
| scripts/utils.mjs | 1119 | full (notification / whisper helpers are lines 100-350) |
| scripts/secret.mjs | 338 | full (the whisper path every helper ends in) |
| cross-domain, followed for the flow only: calls.mjs 95-175, 383-404; action-rolls.mjs 1080-1100, 1836-1850, 3126-3140, 3284-3300, 3375-3390, 3563-3578, 4070-4100, 4161-4193, buildGmBody; observe.mjs 81-156; traps.mjs 225-300; eclipse.mjs 355-400; projects.mjs 660-720; murder.mjs 3550-3580; analyze.mjs 180-200; use-items.mjs 476-492; reroll.mjs 778-795; settings.mjs 596-675; module.mjs 85-260; sheet.mjs 1868-1890; tests.mjs 2675-2700; lang/en.json (every key met, all present) |

## Strengths

- The request/ack/re-send design in gm-bridge.mjs is genuinely robust for the promise-based rulings: request ids, `bridge.gmReady` instead of `userConnected` (measured, lines 126-133), one re-send per request, replies verified against Foundry's `senderId` (`replyForMe`, line 287), payload never mutated between listeners (documented trap, lines 403-411).
- Every GM-side handler re-derives authority from `senderId` and `ownsActor`, narrows numeric ranges (`ACTION_PROGRESS`, `ACTION_SABOTAGE`, `ACTION_DESPAIR`) and whitelists enum fields (`ACTION_REMNANT_EDIT`, `ACTION_CRISIS.choice`). The dead `project.create` door was removed with a note (lines 1113-1124).
- Messenger threads are a single shared conversation per player, ruling cards land in the same thread, and answered cards are rewritten on the document (`settleCall`) so every GM sees the receipt, not only the one who clicked.
- Popup diet for GMs (popup.mjs 297-343) and the sound-audience rule (sfx.mjs 640-660) are consistent with each other: whispers are records, public announcements and messenger asks interrupt.
- Safeword: one press, no reason field, public card says "somebody", the caller's name goes over an addressed socket only, primary GM pauses (safeword.mjs). The volume-ignoring sound and the duplicate-`flags` bug are both documented and fixed.
- Voice: decision and apply are split, the client pulls its room on `ready`/A-V-up, confirmations gate `settled`, retries + heartbeat + self-check cover lost packets; Eclipse isolates every player into a private channel (voice.mjs 495-520).
- Music never uses a socket (playlists are world documents), and `asOurs` / `HELD_FLAG` make hand-played cues survive a reload.

## Bridge request inventory

`R` = waits for a ruling (promise, re-sent on GM ready). `F` = fire-and-forget with an 8 s ack. `-` = no ack at all.

| action | kind | how the GM sees it | no GM online | GM ignores it | timeout / retry | answer to player | player "waiting" state |
|---|---|---|---|---|---|---|---|
| `call.approve` (Hope Call Experience/Ultimate) | R | DialogV2 on the primary GM only (calls.mjs 383) - no card, no popup, no sound | toast `Bridge.noGm`, null | 5 min then null | re-sent once on gmReady | socket verdict -> toast | none (calls.mjs 120-141) |
| `dynamic.difficulty` | R | DialogV2 on the primary GM only (action-rolls.mjs 4161) | toast, null | 3 min then null | re-sent once | socket ruling | transient info toast `Action.dynamicWaiting` |
| `observe.target` | R | none for general/followTraces (auto-picked GM-side); DialogV2 picker for "specific" (observe.mjs 110) | toast, null | 3 min then null | re-sent once | socket result, then whisper after `observe.resolve` | none |
| `cleanup.traces` | R | none (computed) | `[]` | 3 min then `[]` | re-sent once | socket list | none |
| `project.sabotage` | R | none (computed) | toast, null | **8 s** then null (see COMM-17) | re-sent once | socket result | none |
| `project.progress` | F | none | toast | - | ack only | GM whispers `Project.now`/`alreadyFull`/`gone` (gm-bridge 828-869) | none |
| `project.share`, `remnant.place`, `remnant.edit`, `project.unsabotage`, `token.sendBack`, `eclipse.move`, `call.arm`, `despair.adjust`, `body.loot`, `handover.bullet`, `handover.item`, `vault.steal`, `action.steal`, `vault.findStash`, `action.plant`, `murder.crisis`, `murder.openingResult`, `murder.cleanup`, `murder.betrayal`, `murder.park`, `monocub.meddle`, `observe.resolve`, `analyze.resolve` | F | none as such; the result card the handler posts (whisperToOwner etc.) | toast | n/a (automatic) | ack only; `refuse()` is silent to the player (COMM-18) | result whispers from the handler | ack toast on failure only |
| `remnant.tieForItem` | - | none | silent null | n/a | none | none (by design, 1249-1256) | none |
| `murder.openingAsk` / `openingCancel` | GM -> player, addressed | n/a | falls back to GM throwing (murder.mjs 3558-3572) | n/a | none | `murder.openingResult` back | whisper `Murder.openingYours` |
| `callGm()` cards (Think, Listen, Search-specific, Observe POI, Analyze crit, project proposal, direct murder, reroll, creative item use, trap armed/ready) | thread card | messenger thread + popup `Messenger.gmActionTitle` (if window closed) + `gmAsk` sound (secondary GMs only, COMM-08) | card is still posted; read later | card stays "Awaiting a ruling." | none | GM button -> `settleCall` + `postToThread` reply; player popup if window closed | "Awaiting a ruling." on the card |
| `callGm({gmOnly})` / no owner | whisperToGms | **chat sidebar only** (COMM-02) | - | forever | none | none | n/a |

## Findings

### COMM-01 [severity: major] [category: leak] [CONFIRMED]
**Where:** scripts/gm-bridge.mjs:116, 101, 1150, 1166, 1183, 1230, 1237, 1244, 1262, 1270, 1281, 1463-1782 (every `request*` emit)
**What happens:** Every player -> GM request is emitted with no `recipients`, so Foundry relays it to every connected client. Non-GM clients drop it at `onSocket` (line 384 `if (!isPrimaryGm()) return;`), but the packet is already on every player's socket: `game.socket.on("module.danganronpa-rpg", console.log)` on any player's browser prints, in clear, who parked a direct murder and in which room with their note (`murder.park`), who is stealing from / planting on whom and which item (`action.steal`, `action.plant`, `vault.steal`), which project is being sabotaged, every crisis action and its total, the Hope-Call note, the Dynamic description, the Observe request. The module already states the rule for the safeword (safeword.mjs:117-121: "A recipient-addressed socket is the one channel that genuinely only reaches the people named on it") and applies it to every reply (`{ recipients: [asker] }`) - but not to the questions.
**Evidence:**
```js
function awaitRuling(requestId, resolve, payload) {
    pendingRulings.set(requestId, { resolve, payload, resent: false });
    game.socket.emit(SOCKET_EVENT, payload);                       // line 116
...
    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_PARK_MURDER, userId: game.user.id,
        requestId: expectAck("Direct murder"), killerId, room, note   // line 1621-1625
    });
```
**Fix:** one helper `emitToGms(payload)` = `game.socket.emit(SOCKET_EVENT, payload, { recipients: activeGmIds() })`, used by `awaitRuling`, `resendPendingRulings` and every `request*`; `hasGm()` already guarantees the list is non-empty.
**Pitfalls:** `recipients` must not be empty (Foundry treats `[]` as broadcast in some versions - keep the `hasGm()` guard first). `bridge.gmReady` (line 137) may stay broadcast; it carries nothing. tests.mjs:717 notes a GM's own emit is not echoed back - unchanged.

### COMM-02 [severity: major] [category: bug] [CONFIRMED]
**Where:** scripts/gm-bridge.mjs:1866-1874 (whisperToGms fallback), scripts/traps.mjs:262-284, scripts/popup.mjs:340-343, scripts/messenger-app.mjs:519 (only wiring of `[data-drpg-call]`)
**What happens:** A trap alert (`gmOnly: true`) and any `callGm` for an actor with no player owner (a Monokuma, an NPC) go through `whisperToGms`. That card (1) raises no popup - popup.mjs skips every whisper for a GM unless `gmPopup`/`popupForce` is set, and nothing outside tests.mjs sets either flag (grep); (2) plays no sound - no `sfx` flag; (3) has buttons "Fire the trap" / "Re-arm" that nothing wires: `wireCallActions` runs only inside a messenger bubble, and no `renderChatMessageHTML` hook handles `data-drpg-call` in the chat log. The E21 trap system's alert therefore lands as a silent sidebar line with dead buttons and stays "Awaiting a ruling." forever; tests.mjs:2683-2686 only asserts that `gmOnly` is passed. The comment at gm-bridge.mjs:1802-1804 ("Safe to render for everybody. The handler is GM-gated on the clicking client") describes a handler that does not exist for the chat log.
**Evidence:**
```js
const owner = gmOnly ? null : ownerOf(actor);
if (!owner) {
    try { await whisperToGms(content); return true; } ...     // gm-bridge.mjs 1866-1869
```
```js
const forGm = message.getFlag(MODULE_ID, "gmPopup") || message.getFlag(MODULE_ID, "popupForce");
if (game.user.isGM && whisper.length && !forGm) return;      // popup.mjs 340-343
```
**Fix:** (a) in the fallback pass `{ flags: { [MODULE_ID]: { gmPopup: true, popupTitle: ..., sfx: { key: "gmAsk", gm: true } } } }` to `whisperToGms`; (b) add a GM-only `renderChatMessageHTML` hook that calls the same `wireCallActions(body, message)` on `.message-content` for messages carrying `.drpg-call-action`. Export `wireCallActions` from messenger-app.mjs.
**Pitfalls:** `settleCall` (gm-bridge.mjs:1904-1927) rewrites `message.content` from `contentOf(message)` - on a secret card that would write the private HTML into the document in clear. For the fallback path settle by re-posting through `postSecret` (or by updating each GM's client store over the secret socket) rather than `message.update({content})`.

### COMM-03 [severity: major] [category: leak] [CONFIRMED]
**Where:** scripts/messenger.mjs:173-198 (`createThreadMessage`), scripts/gm-bridge.mjs:1919-1922 (`settleCall`)
**What happens:** Every other private message in the module goes through `utils.privately()` -> `secret.postSecret()` because "Foundry delivers every chat message to every connected client and hides the ones you are not addressed on" (utils.mjs:325-331, measured in secret.mjs:7-16). The messenger is the one poster that does not: `ChatMessage.create({ content, whisper: [player, ...gms] })` puts the full text in the document. So on any player's client `game.messages.filter(m => m.getFlag("danganronpa-rpg","thread"))` returns every other player's thread: the direct-murder declaration card (eclipse.mjs:366 - title, room, the killer's note), "Search for something specific" requests, project proposals including the `indirectMine` warning, the GM's typed rulings, and all DMs. `settleCall` writes the settled text the same way. The messenger's own header claims the opposite ("There is no player-to-player channel").
**Evidence:**
```js
async function createThreadMessage(playerUserId, content, kind, gmAsk = false) {
    const whisper = Array.from(new Set([playerUserId, ...gmIds()]));
    ...
        return await ChatMessage.create({ content, whisper, flags: {...} });   // messenger.mjs 183
```
**Fix:** `createThreadMessage` -> `postSecret({ content, whisper, flags })` (it already merges `flags` and returns the message; `contentOf`/`wordsOf` are already what the window and the roster read). `settleCall` -> keep the document as stub and re-deliver the settled HTML through the secret socket to the recipients (add a small `updateSecret(message, html)` in secret.mjs: `remember` locally + emit `secret.card` with the same id), then `message.update({ flags: {settled: true} })` so `drpgMessengerEdited` still fires.
**Pitfalls:** secret.mjs `KEEP = 500` (line 81) - threads are the longest-lived cards in the world and would age out of a player's store, turning old bubbles into "-"; exempt thread messages from the cap or raise it for them. A GM joining later cannot read a thread's history (documented trade in secret.mjs:39-43) - the roster preview (`rosterRow`) must tolerate stubs. `unreadCount` and ordering are flag/timestamp-based and unaffected.

### COMM-04 [severity: major] [category: flow] [CONFIRMED]
**Where:** scripts/gm-bridge.mjs:804-825, 1327-1363; scripts/calls.mjs:120-147, 383-404; scripts/action-rolls.mjs:4079-4088, 4161-4193
**What happens:** Two rulings use a different channel from every other ruling. A Hope Call that `needsGm` and a Dynamic action open a `DialogV2` on the **primary GM's** client and nowhere else: no thread card, no popup, no `gmAsk` sound, and a second GM never learns the question exists. If the primary GM's browser has that dialog behind a sheet (or they are the assistant that happens to sort first), the player waits the full 5 min / 3 min with nothing on screen. Player-side waiting state is inconsistent: Dynamic shows a transient info toast (`Action.dynamicWaiting`), a Hope Call shows nothing at all, Observe shows nothing (3290). On timeout a Hope Call produces two toasts for one event: `Calls.noRuling` from the bridge (line 1339) and then `Calls.noAnswer` from calls.mjs:145. Every other ruling ("Think", "Listen", "Search specific", "Direct murder"...) is a thread card with buttons and a receipt.
**Evidence:**
```js
if (payload?.action === ACTION_HOPE_CALL) {
    const { askHopeCallApproval } = await import("./calls.mjs");
    const verdict = await askHopeCallApproval(payload);            // DialogV2.wait, primary only
```
```js
} else {
    const { requestHopeCallApproval } = await import("./gm-bridge.mjs");
    approved = await requestHopeCallApproval(ask);                 // calls.mjs 140-141, no notice
}
if (!approved) { ui.notifications.warn(... approved === null ? "DRPG.Calls.noAnswer" ...
```
**Fix:** Post both asks as `callGm` cards with two buttons (`approveCall`/`refuseCall`, `setDifficulty`/`refuseDynamic`) whose `runCallAction` branch emits the existing `call.approveResult` / `dynamic.difficultyResult` to the asker and settles the card; keep the DialogV2 as the "set difficulty" editor opened by the button. Give the player one sticky popup "Waiting on the GM" (`showPopup(..., {sticky:true})`) that the resolving code dismisses. Drop the toast in the bridge timeout and keep the caller's one.
**Pitfalls:** the ruling must still resolve the promise on the asking client, so the card button has to know the `requestId` and asker id (`data-*` on the button, as `approveMurder` carries `killer`). `resendPendingRulings` would post a second card on GM reload - dedupe by `requestId` flag on the card.

### COMM-05 [severity: minor] [category: flow] [SUSPECTED]
**Where:** scripts/gm-bridge.mjs:97-112
**What happens:** `resendPendingRulings` fires on `bridge.gmReady` from **any** GM, not only the primary. A second GM joining while the primary still has the ruling dialog open makes the asking client re-emit the same request; the primary receives it a second time and `askDynamicDifficulty` / `askHopeCallApproval` open a second dialog for the same question (no per-request dedupe in `onSocket`). The second answer hits `settleRuling` -> `false` (harmless), but the GM can answer the stale dialog first and then be asked again by the "live" one.
**Evidence:**
```js
function onGmReady(payload, senderId) {
    if (payload?.action !== ACTION_GM_READY) return;
    if (!game.users.get(senderId)?.isGM) return;
    resendPendingRulings();
```
**Fix:** on the GM side keep a `Set` of requestIds currently being answered and ignore a repeat; or only re-send when `senderId === primaryGmId()`.
**Pitfalls:** the re-send exists precisely for the case where the primary role moved to the newcomer - keep that path.

### COMM-06 [severity: minor] [category: text / leak] [CONFIRMED]
**Where:** scripts/gm-bridge.mjs:1826-1830, 1845-1850; scripts/action-rolls.mjs:3175-3192 `buildGmBody` (threshold reference list), 1093-1096; lang/en.json `Bridge.criticalHint`, `Action.observeGm`, `Action.specificFound`, `Action.specificNothing`, `Bridge.createItemStays`, `Analyze.critPrompt`
**What happens:** A `callGm` card is posted into the **player's own** thread, and everything in `body` is written for the GM: "Critical - this player is owed a substantial hint.", "Total 14. Score it against the Observe table for whatever they are looking at. A failure costs them 1 Sanity.", "The roll reached Tier 2. Decide what was there.", "Say so, or offer something lesser.", "Create an item leaves this card open, so the other answers stay available.", "{actor} identified {name} as a {type} on a critical - they have earned a substantial hint on top of it.", and for Think/Listen the whole `<ul class="drpg-gm-reference">` of `min+ - result` thresholds ("the GM's reference table", comment at 1835-1841). The buttons are stripped for the player (`wireCallActions`), the prose is not. The player reads the DC table and third-person notes about themselves in a window titled "GM Chat".
**Evidence:**
```js
if (roll.isCritical) {
    parts.push(`<p class="drpg-warning"><strong>${game.i18n.localize("DRPG.Bridge.criticalHint")}</strong></p>`);
}
...
if (body) parts.push(`<p>${body}</p>`);
```
**Fix:** wrap GM-only fragments in `<div class="drpg-gm-only">` inside `callGm` (`gmBody` option, plus the critical hint) and have `buildBubble`/`cardPreview` remove `.drpg-gm-only` for non-GM clients, the same way they remove `.drpg-call-actions`. With COMM-03 fixed the GM-only half can additionally be delivered only to GM recipients.
**Pitfalls:** the popup path (`cardPreview`) must strip it too; `settleCall` must keep it.

### COMM-07 [severity: minor] [category: ux] [CONFIRMED]
**Where:** scripts/analyze.mjs:183-192; scripts/use-items.mjs:479-486 (via `promptAndCallGm`, `actions = []` default at gm-bridge.mjs:1943); scripts/messenger-app.mjs:521-525
**What happens:** Two `callGm` cards carry no buttons: the critical-Analyze hint request and "use an item creatively". They print "Awaiting a ruling." with nothing to press, so the GM has to type into the thread by hand and the card is never settled (`settleCall` only runs from a button). The comment in messenger-app.mjs ("Every action that calls the GM now carries at least one of these two") is false for these two.
**Evidence:**
```js
await callGm(actor, {
    title: game.i18n.localize("DRPG.Analyze.critTitle"),
    body: game.i18n.format("DRPG.Analyze.critPrompt", {...})       // no actions
});
```
**Fix:** pass `actions: gmRulingActions(actor, 0)` (reply / decline-without-refund) to both; for the creative use, `decline` should also be the "item stays" answer.
**Pitfalls:** `decline` refunds `data.cost` - pass 0 for these.

### COMM-08 [severity: minor] [category: bug] [CONFIRMED]
**Where:** scripts/messenger.mjs:222-237
**What happens:** The `gmAsk` sound (config.mjs:3728 "Heard by the GMs") never plays on the primary GM for the cards the bridge posts from that GM's own session - the parked direct murder (eclipse.mjs:366, run inside `onSocket` on the primary), the trap-armed / trap-ready receipts (projects.mjs:670, 708) - because the self-author early return precedes the `gmAsk` branch. The popup path (messenger-app.mjs:357-367) explicitly handles that case; the sound path contradicts it. A second GM hears it, the one running the table does not.
**Evidence:**
```js
const authorId = message.author?.id ?? message.user?.id;
if (authorId === game.user.id) return; // do not ping yourself
...
if (game.user.isGM && message.getFlag(MODULE_ID, MESSENGER_FLAGS.gmAsk)) { playSfx("gmAsk"); return; }
```
**Fix:** test the `gmAsk` flag before the self-author check (a GM who typed a DM is still not pinged, because typed DMs are `kind: "dm"` without `gmAsk`).
**Pitfalls:** none; `chatSend` is still played once by the sender in `createThreadMessage`.

### COMM-09 [severity: minor] [category: flow] [SUSPECTED]
**Where:** scripts/dice-sync.mjs:42-45, 36
**What happens:** The catch-up push for a joining player is sent on `userConnected`, which fires on the GM when the player's socket connects - before the player's world has loaded and before `registerDiceSync` (module ready) installed `onSocket`. The module has measured this exact gap twice and fixed it with a pull elsewhere (gm-bridge.mjs:126-133 `bridge.gmReady`; voice-client.mjs:13-18 `whoAmI`). Here there is no pull, so a player joining mid-session keeps their own dice skin until the GM edits their DSN settings or reloads.
**Evidence:**
```js
Hooks.on("userConnected", (user, connected) => {
    if (!connected || user.isGM || !isPrimaryGm()) return;
    pushTo(user.id);
});
```
**Fix:** in `registerDiceSync`, a non-GM emits `{ action: "diceAppearance.request" }` to `[primaryGmId()]`; the primary answers with `pushTo(senderId)`. Keep the `userConnected` push as the backstop.
**Pitfalls:** `game.settings.set` on the DSN client setting triggers `clientSettingChanged` on the player too - `onSocket` already ignores non-primary senders, so no loop.

### COMM-10 [severity: minor] [category: bug (two-GM race)] [SUSPECTED]
**Where:** scripts/music.mjs:1057, 1138 (`game.user.isGM`), 378 (`enabled()` primary-only), 809-829, 1171-1176
**What happens:** "Play a track" and "Reset" are allowed to any GM, but the state machine, `watchManualPlayback` and `resumeAmbient` run only on the primary. An assistant GM pressing Play pauses every playlist with `HELD_FLAG` on their client and records `interrupted` there; the primary's hook sees the cue start with `ourDoing()` false and builds its own `interrupted` with `held: []` (nothing is still playing to hold). When the cue ends, the primary resumes nothing, `HELD_FLAG` stays on the paused playlists, and the next `resetMusic` on either client resumes stale ones ("two pieces of music where there had been one" - the case the code guards against at 1171).
**Evidence:**
```js
export async function playTrack(track, soundId) {
    if (!game.user.isGM) { ... }                    // any GM
...
function enabled() { if (!isPrimaryGm()) return false; ...
```
**Fix:** either gate Play/Reset on `isPrimaryGm()` with a toast naming the GM whose client drives the music, or forward the press to the primary over the socket (like `VOICE.manual`).
**Pitfalls:** the eavesdrop dialog already uses the "forward to primary" pattern (`setManual`); reuse it.

### COMM-11 [severity: minor] [category: ux] [CONFIRMED]
**Where:** scripts/safeword.mjs:72-76 vs scripts/sheet.mjs:1875-1883 (only caller of `safewordDialog`, grep)
**What happens:** The safeword promises "Anyone may: player, GM, dead, Monocub, spectator... Deliberately not gated on having a character", but the only button is on the character sheet. A spectator, a player between characters, or anyone whose sheet is closed under three windows has no door; there is no HUD / launcher / API entry (`grep safeword api.mjs gm-panel.mjs hud.mjs` -> nothing).
**Fix:** a second door that exists for every user: an entry in the messenger launcher/roster, or a `game.drpg.safeword()` API plus a macro-able keybinding. The dialog already needs no actor (`safewordDialog(actor = null)`).
**Pitfalls:** none; `callSafeword` already tolerates `room = null`.

### COMM-12 [severity: nit] [category: leak] [CONFIRMED]
**Where:** scripts/safeword.mjs:175-179
**What happens:** The GM detail card prints `payload.who` and `payload.room` from whoever sent the packet; `senderId` is ignored. Any player can put another player's name on the GMs' screens ("X used it, in Y") without a public card ever appearing. Low impact, one-line fix, and every other socket handler in the module reads `senderId`.
**Fix:** `showGmDetail(game.users.get(senderId)?.name ?? "?", payload.room)`.

### COMM-13 [severity: minor] [category: ux] [SUSPECTED]
**Where:** scripts/voice.mjs:1115-1163 (`eavesdropRoom`), scripts/camera-view.mjs:144-147, 166-178
**What happens:** "Listening at the door" joins the room's LiveKit channel as a normal participant, and the camera dock then shows the GM's tile - relabelled with their Monokuma's name - to everyone in that room. Players learn they are being listened to the moment it starts. LiveKit has no hidden-participant mode from the client, so this is a limitation to state in the dialog (`Voice.eavesdropPrompt`) rather than a bug; today the dialog says nothing about it.
**Fix:** add a line to the eavesdrop dialog ("they will see your tile"), and/or skip `relabel` for a GM in manual mode so at least the Monokuma name is not advertised.

### COMM-14 [severity: minor] [category: text] [CONFIRMED]
**Where:** scripts/gm-bridge.mjs:1150, 1166, 1183, 1230, 1237, 1244, 1270, 1281, 1463-1782 (`expectAck("...")` labels)
**What happens:** The `{what}` slot of `Bridge.noAnswer` ("No GM answered the "{what}" request...") is filled with untranslated English literals ("Move", "Eclipse", "Stash", "Clean-up", "Incident"...), and for `call.arm` with the raw Call key (`call?.key` -> "freeCrit", "support"). Same channel, different naming from the action labels the player just clicked.
**Fix:** pass the action's `label` from config (or an i18n key) - `expectAck(ACTIONS[key].label)` / `HOPE_CALLS[key].label`.

### COMM-15 [severity: minor] [category: bug] [SUSPECTED]
**Where:** scripts/messenger.mjs:117-135
**What happens:** Unread is `message.timestamp > lastRead` where `lastRead = Date.now()` on the reader and `timestamp` is stamped by the sender's browser. With the sender's clock ahead of the reader's by more than the read-to-arrive gap, a bubble the GM is looking at keeps its badge until the next message; with it behind, a bubble can arrive "already read". Needs a live check with two skewed clocks.
**Fix:** record the newest seen `message.timestamp` (or id) instead of `Date.now()`: `map[playerUserId] = newest`.

### COMM-16 [severity: minor] [category: flow] [CONFIRMED]
**Where:** scripts/gm-bridge.mjs:371-374 (`refuse`), 418-421 (ack before guards)
**What happens:** The ack leaves before any guard runs, so a request the GM side then refuses - a Remnant edit whose token the sender did not leave, a sabotage on a project `canSee` rejects, a progress amount out of range, a `call.arm` whose `grants` does not match - is acknowledged to the player and then silently dropped; `refuse()` only writes to the GM's console/session log. The player sees a roll that reported success and a world that did not change, which is the exact symptom the ack system was added to remove.
**Fix:** `refuse(action, why, asker)` additionally emits `{ action: "bridge.refused", requestId, userId: asker, reason }` to `[asker]`, and a player-side listener toasts `Bridge.refused` ("The GM's client refused the "{what}" request: {reason}").
**Pitfalls:** reasons must be i18n keys, not the console prose; a forged refusal is harmless (it only shows a toast) but still check `replyForMe`.

### COMM-17 [severity: minor] [category: flow] [SUSPECTED]
**Where:** scripts/gm-bridge.mjs:1204-1220 (`requestSabotage`)
**What happens:** Sabotage waits for the *result* with the 8 s ack window. `sabotageProject` writes two world settings and creates a repair project; on a slow GM client the result arrives after 8 s, the player has already been told `Bridge.noAnswer` "Nothing was applied", the roll reports no freeze - and the freeze then lands anyway. No other promise request uses the ack window for a result.
**Fix:** start the result timer from the ack (`onAck` for a pending ruling extends its deadline to the 3-min ruling timeout), or use the 180 s timeout with an "acknowledged, applying..." toast.

### COMM-18 [severity: nit] [category: hygiene] [CONFIRMED]
**Where:** scripts/voice.mjs:842-855, 917-947, 966-1000; scripts/music.mjs:1478-1561
**What happens:** GM-facing diagnostics (`reportContested`, `sceneRoomWarnings`, `competingModuleWarnings`, `voicePlan`, `diagnoseMusic`) are inline English, while every other GM notice goes through lang/en.json. Console-only today, but `reportContested` reaches the GM panel failure log via `warn()`.
**Fix:** leave the console dumps; move the `warn()` sentence to a key.

## Live checks recommended (things statics cannot settle)

1. COMM-01: on a player client run `game.socket.on("module.danganronpa-rpg", p => console.log(p))`, then have another player park a direct murder / steal / sabotage - confirm the payload prints.
2. COMM-03: on a player client `game.messages.filter(m => m.getFlag("danganronpa-rpg","thread") && m.getFlag("danganronpa-rpg","thread") !== game.user.id).map(m => m.content)`.
3. COMM-02: fire a trap (E21) and check the GM's screen: no popup, no sound, buttons inert in the chat log.
4. COMM-04: open a Hope Call "Experience" from a player while the primary GM has a sheet open over the dialog; time how long before anyone notices.
5. COMM-05/09/10/15/17 as described (second GM joining mid-ruling; player joining mid-session with DSN; assistant GM pressing Play; two browsers with skewed clocks; a GM client under load during sabotage).
6. Messenger DM to a GM whose window is closed: verify the only signal is the launcher badge (messenger-app.mjs:347-356 says this is deliberate; check the badge is not hidden behind the camera dock - camera-view.mjs lifts the button only when the dock is under it).
7. Whether `ChatMessage.timestamp` is stamped client-side on Foundry 14 (decides COMM-15).

## Hygiene metrics

- Largest functions: `onSocket` gm-bridge.mjs:376-1140 (~770 lines, 24 action branches each repeating `senderOf` / `ownsActor` / `refuse` - a dispatch table `{ action: { owns: p => p.actorId, run } }` would cut it to a third and make the ack-before-guard order (COMM-16) one line); `openSoundDialog` music.mjs:1191-1454 (~265); `runCallAction` messenger-app.mjs:577-813 (~240); `voiceTargets` voice.mjs:473-604 (~130); `showPopup` popup.mjs:150-254 (~125).
- Duplicated helpers: `avclientActive()` in voice.mjs:186 and voice-client.mjs:243; `usingLiveKit`/`clientReady` only in voice-client (fine). `escapeHTML` aliasing is documented as deliberate (utils.mjs:16-19). `stripHtml` (messenger-app.mjs:994) duplicates what `cardPreview` + `textContent` already does.
- Registration-order comments contradict each other on `game.socket` availability: voice-client.mjs:122-123 says it "does not exist yet" at init, while `registerSfx` (init) and `registerSafeword` (init) call `game.socket.on` directly and work. One of the two comments is stale.
- Dead/odd exports: `gmOnline()` is exported (gm-bridge.mjs:1286) and used only internally by `hasGm` and (per comment) tiles; `MESSENGER_FLAGS.kind` is written but only `action` vs not is ever read. `THREAD_KIND.dm` is never checked.
- Comments that no longer match code: gm-bridge.mjs:1802-1804 (buttons "GM-gated on the clicking client" - no chat-log handler, COMM-02); messenger-app.mjs:521-525 ("every action that calls the GM now carries at least one of these two", COMM-07); messenger.mjs:7-9 ("There is no player-to-player channel", COMM-03).
