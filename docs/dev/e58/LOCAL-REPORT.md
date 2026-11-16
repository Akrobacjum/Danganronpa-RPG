# E58 local line (L1) - reports to the coordinator

The sandbox line on the owner's PC (WSL2 Ubuntu), branch `claude/e58-local`, made from origin/main at ff3e12e5
(1.2.116, "Merge 1.2.116 (#66)"). Newest report on top. Nothing here is a release step.

The owner, 16.11.2026, while step 1 ran: "nie czekaj na mnie albo na moje odpowiedzi. zrealizuj cale polecenie na
domyslnych ... pracuj do samego konca". From here every question takes its default, written beside it, and the line
goes on; what only the owner can give (a password, eyes on a screen) is written as not run with its reason.

## Step 5 - E53's measurements (16.11.2026)

| What | Ran | Reading |
| --- | --- | --- |
| The probe | `node audit/live/perf-baseline.mjs --probe --stage E53` | attempt 3 appended to audit/perf-baseline.json, status stays not-measured: `perfReport`'s body is the one recorded for E53 at 1.2.116, the server serves 1.2.116; could not run - "the world copy: DRPG_FIXTURES is not set" and "a browser drawing on a GPU at 1366x768: ... SwiftShader" (its own headless Chromium). So `--run` stays refused, rightly: no fixture world, and the probe's browser draws in software |
| Is there a GPU browser here | `chrome://gpu` and the WebGL renderer in a page, headless and headed | headless: `chrome://gpu` hung (no reading). Headed on WSLg with flags: `chrome://gpu` reads "WebGL: Hardware accelerated*" while the page's renderer is "ANGLE (Mesa, llvmpipe ...)" - **software**; the label the prompt names is not enough here, the renderer string is the check. With Mesa's d3d12 driver (`GALLIUM_DRIVER=d3d12`): "D3D12 (AMD Radeon(TM) Graphics)", the CPU's integrated GPU; with `MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA`: "D3D12 (NVIDIA GeForce RTX 4080 SUPER)" - the GPU, through WSLg's D3D12 translation |
| perf() and fps(), run 1 | the four accounts in four headed windows; `perf()` then `fps({ toChat: false })` on the GM and on PlayerOne, Stained Glass then Monokuma Legacy (each a fresh load, the theme in the page's storage) | Stained Glass: about 43 ms a frame (23 fps) on both, fps()'s median 50 ms, p95 50.1 ms, every frame over 33 ms; Legacy about 34 ms (29 fps), median 33.4 ms - frame times on multiples of 16.7 ms, and with the canvas's ticker stopped still 30 ms. Each effect held alone moved the frame by -2.2 to +3.4 ms, either way. These are the browser's: four windows, one in front |
| fps(), run 2 | the GM alone in one focused window, both themes | 300 frames in 5 s, 60 fps, median 16.7 ms, p95 16.8 ms, none over 33 ms, in both themes; the blur, the pulse and the canvas each held changed the frame by at most 0.15 ms |
| The rest of perf() | run 1 | a window reaches the screen in 86.7 ms (Stained Glass) and 69.9 ms (Legacy), median of six; one recut of the glass 6.1-7.2 ms; `roomOfActor` 0.1 ms, `othersInRoom` 0.13-0.19 ms; the fog repainted p95 33-51 ms (2-3 repaints); a chat card painted p95 0.1-0.4 ms; a student's ring p95 0.1-1.9 ms; no roll drawn and no canvas drawn since load in that window, so those lines read "none" |

Machine, date, commit: AMD Ryzen 9 9900X, 31.6 GB RAM in WSL2, NVIDIA GeForce RTX 4080 SUPER through WSLg's D3D12,
Playwright 1.56.1's Chromium 141.0.7390.37 headed, 16.11.2026, 80dfaf06. The full output: docs/dev/e58/PERF-READINGS.md.

What this is not: D27 (b)'s budget is a 1366x768 laptop with the largest isometric map; this is a high-end desktop
through WSLg on the seed's small flat scene, so none of it becomes a budget (the prompt's rule: numbers to the
coordinator for C2, nothing fixed by guess). The owner's own Chrome on Windows, the largest isometric map and the
weakest player's machine (LIVE-E53-01, LIVE-E33-05, LIVE-E88-01) are still not measured.

## Step 7 - E112 at the table (16.11.2026; in progress)

The world launches paused (Foundry's own start); each run here lifted the pause and put it back. On the drawn road with
real dice: the GM opened a murder (Chie, PlayerThree's, on Aiko, PlayerOne's, in Dorm A; Chie's Body raised to 10 for
the run, as scenario 21 does, and put back), PlayerThree's browser got Daggerheart's roll window "Opening the murder ·
beat 8: Chie Mori", the probe pressed Roll, the GM drew it: first try Hope 8 / Fear 5, total 23, `incident`, the mask
standing.

| Row | Result | Reading |
| --- | --- | --- |
| LIVE-E112-01 (553), the veil | **a defect found; open** | while the opening waited: on the victim's browser Chie's token `hidden` and `veiled`, not drawn on its canvas; the killer's own browser draws it; PlayerThree's `BROADCAST_AUDIO` false (the microphone blocked). **The killer's vision**, read with the academy's token vision switched on and sight on Chie's and Aiko's tokens for the run (put back after): before the opening Chie's token is PlayerThree's one vision source (`_isVisionSource()` true, vision active); while veiled it is drawn but **no vision source** (`_isVisionSource()` false, vision inactive), and PlayerThree's canvas sees from **Aiko's** token instead - every player observes every character (the module's ownership default 2), and Foundry takes an observed token's sight when the player's own gives none. So the owner's "the killer still sees their own token and has its vision" holds for the token, not the vision: on v14 the veiled killer sees from the victim's eyes. Not fixed here - design-level (proposal below). Shot e112-01-killer-vision-while-veiled.png (the roll window over the map). Hearing (LiveKit): not checkable here |
| LIVE-E112-04 (556), the "?" | measured on v14 | after the Hope opening, on the victim's browser Chie's token reads name `?`, `texture.src` and `ring.subject.texture` `modules/danganronpa-rpg/icons/mask-unknown.svg`, the drawn mesh's texture that file, its nameplate `?`, drawn; the portrait the same file. The bystander's browser holds the same (not drawn: another room); the killer's too. Shots: e112-01-victim-before-opening.png ("the victim's map: no Chie in Dorm A"), e112-01-killer-before-opening.png ("the killer's own map: Chie drawn"), e112-04-victim-after-hope-opening.png ("Chie's token in Dorm A drawn as the module's ? disc"), e112-04-bystander-after-hope-opening.png, e112-04-killer-after-hope-opening.png. The Forge half: not checkable here |
| LIVE-E112-05 (557), Isometric's silhouettes | left, not settled | client setting `enableOcclusionTokenSilhouette` "gpu", a scratch tile flagged `OccludingTile` over the Gym (Daichi, hidden from PlayerOne): the silhouette layer (`OcclusionTokens`) existed and held no sprite; the control - the tile over Aiko, whom PlayerOne sees - held none either. So on this sandbox (Isometric 14.0.6, the academy not flagged isometric) nothing was built for the module to hide, and its hiding was not exercised. Next: an isometric scene, the tile flagged through Isometric's own tile settings |
| After each run | put back | the incident closed, the mask ended, Chie where she stood with her own picture and Body, the run's cards deleted, the pause restored |

**Proposal (E112-01's vision; not built).** Foundry 14.370 drops a hidden token as its owner's vision source, and the veil
is Foundry's `hidden`. Two roads: (a) keep `hidden` and make a token the module veils a vision source for its owner and
the killers' side (a wrapper on the Token class's vision-source test, beside visibility.mjs `show()`); (b) veil without
`hidden` - visibility.mjs's own per-browser hiding, as rooms already do - which keeps Foundry's vision rules and also
takes away the console's one-hidden-character reading (known leak `foundry-veiled-token-actor`), but changes what a
player's console reads of the token. And either way, the fallback onto an observed token: with every player an
observer of every character, a player whose own token gives no sight sees from someone else's. Red first: a tier 2
or scenario check that reads `_isVisionSource()` on the killer's browser while veiled needs a canvas (LIVE); headless,
the predicate can be held on the token documents. For the coordinator and the owner.

Withdrawn on the way: a first reading that the module's "Daggerheart is newer than the verified version" window, left
open on the GM's browser, kept the opening's invitation from the killer. A control with the window left open and longer
waits brought the roll window: the first runs ended the murder 4 s after opening it, before the invitation arrived.
How long the invitation takes after a GM's login is not measured.

**What the runs here left in the world, and what was put back** (a sweep against audit/harness/lib/seed.mjs, 16.11.2026
evening): the GM's Despair pool `{GM: 3}` and Daggerheart's `ResourcesFear` 3 (the openings' rolls; the probes' clean-ups
had not covered them) - both put back to empty; Aiko's Stress 6 (the incidents' turns) - 0; the shared "DRPG Project"
actor the module makes at a first project - deleted (it makes it again on need); 19 cards the probes left - deleted
(kept: Foundry's tour, Dice So Nice's first-use cards, the module's first-login notes); every token where the seed puts it,
every actor's resources and traits the seed's. Not put back: PlayerOne's `preSessionNote` flag (`{written: true}`, from
step 6's fuzz) - a GM's ForcedDeletion of it applied (both hooks, the GM's copy `{}`), and a fresh GM's load read it back
about 22 s later with a newer `modifiedTime`, the same value: something writes it again at a GM's load; where the module
keeps that note was not found. A question below.

## Step 6 - E43 and E40 at the table (16.11.2026; in progress)

| Row | Result | Reading |
| --- | --- | --- |
| LIVE-E43-01 (534), the fuzz on v14 | measured | audit/harness/lib/fuzz.mjs `fuzz`, unchanged, driven against the sandbox by a runner outside the repository (~/drpg/l1-probes/fuzz-sandbox.mjs: four seeded pages, the cluster's write logs stood in for by the GM page's create/update/delete and setting hooks, polled every 200 ms; the pause lifted for the run): scenario 30's four checks, all pass, 59 s. 108 table actions in their shapes (756 packets), 54 other packet names in three (162); 673 refused, each code of the closed list (notYours 397, gmOnly 189, undoIsTheGms 37, missing 14, badRequest 8, notSecret, cannotNow, notHolding, movedOn 7 each), 737 lines in the GM's log; every request awaiting an answer answered - so v14's server dropped none before the GM's module; no exception on any of the four browsers; nothing polluted; the only writes the GM's six of PlayerOne's own note, put back. Limit: the write log is the GM page's hooks, not the server's |
| LIVE-E43-02 (535), Countdowns | measured | a secret project (PlayerOne in on it, PlayerTwo not): Daggerheart's world setting `Countdowns` names it `???` on every browser, the GM's too; no world setting holds the name or the description; the bystander's Countdowns window reads "No projects yet." and its DOM holds neither; the member's names it, progress "? / 4" (not in its room). Seen: Daggerheart's tooltip on the GM's and the member's window, "This countdown is hidden to players except PlayerOne, PlayerThree, PlayerTwo" - every player, from the module's one-level map; names no secret, but tells the member the bystanders are in. Shots: e43-02-countdowns-member.png, e43-02-countdowns-bystander.png |
| LIVE-E43-03 (536), the open card | measured | a public project in the Gym, which Aiko had not found; PlayerOne opens its token's card ("A project / You do not know what this is.") and walks Aiko in with it open: the card redraws as the project's (its name, description, Progress 0 / 4, Room Gym) without reopening - in all four of Stained Glass and Monokuma Legacy, English and Polish ("Nie wiesz, czym to jest." before, "Postęp", "Pokój" after). Shots: e43-03-card-before-entry-*.png and e43-03-card-after-entry-*.png, one pair each |
| LIVE-E40-01 (537), checkState | measured on this world; the item open | the primary GM's start: nothing on the console; `game.drpg.checkState()` `{ ok: true, problems: [] }` on a world that had seen several murders opened and ended and projects made and removed, but no chapter played; `null` on a player's browser. The item asks for a world played through a chapter: not this one |
| E40's season wipe on a copy world | not run | the sandbox holds one world, `drpg-qa-gate`. A copy is made with Foundry's Duplicate World on the setup screen, which this line does not open, and running it means the owner's server launching it. The owner's step (question below) |

## Step 4 - AUDIT 9.2, in groups (16.11.2026; in progress)

The worklist is docs/dev/e58/TRIAGE-9.2.md: four readers put each of section 7's 14 items and 9.2's 551 numbered items
(565 rows; 537 LIVE ids, `check live`'s count) in a class for this sandbox - K 331 (a script can settle it here), S 102
(a shot can show it), T 98 (needs what the sandbox lacks), F 16 (needs a fixture world), C 8 (closed by its own text),
M 10 (step 3). A class is how an item can be settled here, not a result; each result below.

### Group 1: section 7 (S7-1..14) and items 15-24

| Item | Result | Reading |
| --- | --- | --- |
| S7-4 (CASE-03) | measured | v14 delivers every message to every browser: PlayerOne's console held all 13 the GM held, GM-only whispers among them. Of the module's secret cards a player reads the alias (null) and the whisper list; the content is the placeholder `-`, the words stay on the GM's browser (a card made by hand with plain words would be read: the module never makes one) |
| S7-5 (COMM-03) | measured | a real thread message (messenger.mjs `sendMessage`) to PlayerTwo: its document holds `<p class="notes" data-drpg-secret>-</p>`; the words reached PlayerTwo alone, by `secret.card` (PlayerOne's socket heard nothing), drawn in its chat and messenger window and kept in its `secretCards` store; PlayerOne holds them nowhere (document, drawn card, socket) |
| 15, S7-7 (MAP-02) | measured | PlayerTwo's canvas sampled each frame while Aiko walked from Dorm A into the Cafeteria: hidden in the corridor (last hidden at x 588), first drawn at x 1155 where her right half crosses the Cafeteria's edge (1200), never drawn further left. Limit: headless drew 33 frames in 9 s, so a flash shorter than about 0.27 s between samples is not excluded |
| 17 (COMM-11) | measured | the action is registered ("Safeword: stop the scene"), no default key; bound to F9 and pressed with no sheet open on PlayerOne's page, it opened the Safeword window (Stop the scene, the default, then Cancel); Cancel posted nothing. Seen on the way: the probe sent the key twice and two windows opened - a fast double press opens two |
| 18 | measured | a `system.daggerheart` listener on the GM got PlayerOne's packet with the sender's id as its second argument (`USERP10000000000`); `relayGuard().refused` stayed empty (no `unknownSender`), state `ok`. The packet was an action Daggerheart's switch ignores; a Hope roll's own packet not read |
| 19 | measured | `game.socket.listeners`, `off`, `on`, `prependAny`: functions; `relayGuard().state` `ok` |
| 20 | measured | with two GMs, the non-primary one saving Configure Ownership on Aiko ("All Players: Owner"): `updateActor` reached the primary with `options.noHook === true`; `closeDocumentOwnershipConfig` fired on the window's GM; `ownership.default` back to 2. The harness's reading of `noHook` differs (CALIBRATION.md, D9) |
| 22 | measured (M) | LIVE-E39-01's move (CALIBRATION.md section 3) |
| 23 | measured | v14's toasts are not escaped but sanitised: `<b>`, `<img>`, `<a>` kept as elements; `onerror`, `javascript:` and `<script>` removed (a failing image's handler did not run). A name PlayerOne gave its own character with markup in it was stored as typed and drawn as markup in a GM toast (`DRPG.Anonymity.blocked`), its handler stripped. Not a defect by this reading; an `<img>` in a name makes a GM's browser fetch its address - a question for the coordinator |
| S7-14, 21 | closed by their own text | "To nie błąd, ale warto wiedzieć"; "Nieaktualne od 1.2.67" |
| S7-1, S7-2, S7-3, S7-6, S7-8, S7-9, S7-10, S7-11, 16 | left | flows not yet driven (a Search the GM leaves, the roll window's statistic, Self Roll and Despair, a trap, the safeword's second press - whose 1.2.43 text has changed since -, the HUD's minute counter, the overflow hat, two GMs' Despair, sticky trial cards) |
| S7-12, S7-13, 24 | left | shots not yet taken |

Group 1: 9 measured, 0 not checkable, 2 closed, 0 defects, 12 left.

### Group 2: items 25-50

| Item | Result | Reading |
| --- | --- | --- |
| 25-27, 29, 30, 33, 34 | measured (M) | step 3 (CALIBRATION.md section 1) |
| 28 (LIVE-E30-07), 46 (E04-06), 50 (E04-10) | not checkable here | each needs a fixture world (an old world copy, a saved browser store, a v1.1.0 world); DRPG_FIXTURES unset on purpose |
| 32 (LIVE-E30-08) | not checkable here | the table's own Data folder (The Forge); the sandbox's versions are in CALIBRATION.md |
| 36 (E31-02), 42 (E04-02), 43 (E04-03), 45 (E04-05) | not checkable here | a real server's network latency (The Forge); two GMs with campaign data on The Forge or a LAN; the table's own browser store; Firefox and Foundry's desktop app |
| 41 (E04-01) | closed by its own text | "Odpowiedziane 31.10.2026 przy stole właściciela" |
| 44 (LIVE-E04-04) | measured, one road | Playwright's offline mode did not close the GM page's WebSocket (connected throughout; nothing measured); `game.socket.disconnect()` then `connect()` from the GM's console did: `disconnect` ("io client disconnect"), `connect` again 10 s later, no reload - and the write PlayerOne made meanwhile (a user flag, on the server) never reached the GM's copy (null 12 s after the reconnect). So v14 sends no missed documents on a reconnect: a GM back that way holds stale data until a reload. A real network loss (not a client-side close) and the GM stores' exchange (two GMs) not read. A question for the coordinator, not a module defect |
| 47 (E04-07) | not checkable here | a second world and Setup > Duplicate World: the setup screen, which this line does not open |
| 49 (E04-09) | left | the reset's refusal on an Assistant and a second Gamemaster: a refused reset is safe, an accepted one wipes the sandbox's only world; left for a copy world |
| 51 (E04-11) | see group 3 | |
| 31 (E30-06), 35, 37-40 (E31-01, -03..-06), 48 (E04-08) | left | flows not yet driven (17-assistant's B and C on real pages; a GM-side Reroll per action; a GM leaving mid-request; a late planted item; reduced motion; a Polish player's refusal; a GM changing browsers mid-murder). Seen on the way for 48: a fresh GM browser without the seed's storage opened "The case on this browser" ("1 Remnant on the map (of 1) has no answer key on this browser") - the health check's warning, not yet its Restore |

Group 2 (26 items): 7 measured (M) + 1 measured, 9 not checkable, 1 closed, 0 defects, 8 left.

### Group 3: items 51-75 (in progress)

| Item | Result | Reading |
| --- | --- | --- |
| 51 (LIVE-E04-11) | measured | two tabs of one browser as the GM (v14 disables a connected user in /join's list, in that browser and any other; a second tab with the session opens /game and is ready): a trace placed from each - both rows in the shared store (`gmRemnants`, `gmTraceDigest`) on both tabs, both tokens on the map; nothing lost |
| 52 (LIVE-E04-12) | measured | on PlayerOne's page as the GM's page loaded: `userConnected(GM, true)` (active already) at +4.8 s, `bridge.gmReady` at +10.5 s - the hook comes about 5.7 s before the GM's module is ready - then the answers to the player's asks (fog rows, passages, offers, the mastermind door, the cast, notes, cubs); `primaryGmId` the GM. The harness calls the hook once the client is ready (CALIBRATION.md, D10) |
| 61 (LIVE-E05-09) | measured | utils.mjs `replaceFlag` on PlayerTwo: `{keep, gone, nested}` replaced whole by `{only: 3}`, the same on a player's browser; `forcedDeletion()` on a message's module flags removed one key and kept the other. Put back |
| 62 (LIVE-E05-10) | measured | with no GM online PlayerOne's `saveNote` answered "kept"; a GM logged in from a fresh browser held the note (`gmNotes`, `noteFor`) within 15 s and the user's flag was written. Found on the way: the fuzz of step 6 had left PlayerOne's note flag behind - one of its six `note.save` writes landed after lib/fuzz.mjs's put-back had read the flag clear (a race the harness's model does not show); this line took the flag off (the seed has none) |
| 63 (LIVE-E05-11) | measured | avclient-livekit 0.6.8 registers `liveKitConnectionSettings` at world scope (a player's browser reads it), `config: false`, default `{}`; its server types `custom` and `tavern`; voice.mjs `liveKitSecretWarning` warns for custom with a secret and not for Tavern with one. The module's note that the first GM to connect gives the world `serverType: "custom"` was not seen: the value stays `{}` here after several GM logins (A/V off in this world). Nothing written |
| 64 (LIVE-E05-12) | measured | a scratch unlinked token of Aiko on the Annex: `lastAction` written through its synthetic actor landed in the token's delta, the base actor untouched; `dropRollBookmarks()` `{ dropped: 1 }`, the delta's module flags `{}` after, the synthetic actor without it. A deletion on the delta's path works on 14.370 |
| 68 (LIVE-E06-02) | measured, in part | the GM's drawn roll of the killer's opening (a Hope opening, Daggerheart 2.12.9) as PlayerTwo's (a bystander's) console holds it: no id, name or uuid of the killer's actor anywhere in its JSON; speaker `{ actor: null, alias: "Monokuma" }`; title "Duality Roll"; no `trait` in the roll's options, no effects, bonus effects or experiences, no modifier labels. Not read: the Reroll half (Hope and Sanity settled again, the same trait and experiences), whether `options.data` is empty, Daggerheart 2.6.5 |
| 67 (LIVE-E06-01) | measured, with a question | the victim's browser (PlayerOne) through the opening: while the killer throws, no `drpg-incident-here`, no event panel, no sound; after a failed opening (Chie's Body -20), the same - but its chat shows three veiled cards placed for everybody ("To: GM, PlayerOne, PlayerThree, PlayerTwo", the placeholder `-`, no words reached it) and Foundry's stub of the GM's draw of the opening, "Duality Roll · GM privately rolled some dice", at that moment (private-rolls.mjs writes `blind: false`). After a Hope opening: `drpg-incident-here`, one event card "Face to face / Aiko Hoshino / your turn", the words "Someone is moving on you ..."; no "Chie" anywhere on the page or in its store. One earlier run's card read "Face to face Chie Mori against ..." on the victim: events.mjs names the pair only when that browser's cast holds the killer, which a success with Fear leaves (the mask opens on Hope or a critical); that run's dice were not recorded, and two runs since did not repeat it. Sounds: none captured - the seed has no murder playlist. Shots e06-01-victim-after-*.png |


## Step 3 - the harness against v14 (16.11.2026)

**The PC switched off during this step** (the owner, 16.11.2026; up again 14:40). Read after the restart, before going
on: the tree held every edit of the step, each file parsing (`node --check`) and each change found by its own marker,
the record and the shot whole; but the whole tree had been staged by something other than this line, the self-pointing
`Danganronpa-RPG` symlink and `audit/harness/harness.lock` (flock's file, untracked) among it - those two unstaged
again, the rest left staged, nothing committed. Lost with /tmp: the probe scripts (rebuilt under ~/drpg/l1-probes,
outside the repository) and the first validation run, which had not finished (run again, below). The sandbox: the
owner had started it and launched `drpg-qa-gate` before this line looked (uptime 232 s at 14:44); this line's own
start with `--world` failed on Foundry's data lock and left nothing running. The world: the seed as left - four users
at their roles, six actors (Aiko 3 actions, no flags), every token where the seed puts it, the seed's
`daggerheart.Automation`, no incident, no scratch actor, user or scene - and two Dice So Nice first-use cards whose
author (the scratch Assistant, deleted) no longer exists, which this line deleted (9 messages left, none authorless).
The four readers' triage of AUDIT 9.2 had reached this line before the shutdown and is kept in
docs/dev/e58/TRIAGE-9.2.md.

The readings, item by item, are docs/dev/e39/CALIBRATION.md (for C1, through the coordinator). In short:

| Id | v14 14.370 against the shim | Done here |
| --- | --- | --- |
| LIVE-E30-01, LIVE-E76-03 | `-=` deletes and `==` replaces (actor and token flags), with v14's deprecation warning; the shim's default ignored them | default reading "honoured" (lib/operators.mjs); 00-boot's check rewritten red first |
| LIVE-E30-02 | `ForcedDeletion.create()` a new instance each call (shim: one shared); `_del` an instance, `_replace` a function (same); a ForcedReplacement keeps its value under `OPERATOR_VALUE` with its keys copied onto it, no `.replacement` | both fixed, red first (00-boot); the replacement's one reader in tier 2 then red headless as on v14, fixed, green |
| LIVE-E30-03 | order, instances, emptied and refused updates as the shim; but v14 diffs an update on the client (hooks get the changed keys, a no-op is not sent), the shim does not | proposed (D3), not built |
| LIVE-E30-04 | an Assistant cannot raise itself (refused, error toast), writes a world setting, changes another user's role up to 3: as the shim. The writer's own copy of another User lagged behind its resolved update (3 times) | the lag proposed as a question (D8) |
| LIVE-E30-05 | `userConnected(user, false)` with `active` already false: as the shim. A role change logs the user out (page to /join): the shim logs nobody out | proposed (D6) |
| LIVE-E30-06, -07 | not checkable here: the adapter's four accounts and page hooks (06), no fixtures (07) | - |
| LIVE-E30-08 | the sandbox: DH 2.12.9, DSN 6.4.5, Isometric 14.0.6, LiveKit 0.6.8; versions.json is the table's (6.2.9, 14.0.2, 0.6.8) | not changed (a question) |
| LIVE-E30-09 | the seven sheets, module.json's order, each `@import` in layer `modules`; `--drpg-window-max` 1400px: as the shim | - |
| LIVE-E30-10 | the drawn window: world named, Cancel first and focused, Enter cancels, the world unchanged (shot e30-10-tier2-dialog.png): as the shim's configuration check | - |
| LIVE-E39-01 | one update per route with every grid step in `options._movement[id].passed.waypoints` (shim: `options.movement`), `_regions` in the changes, `preMoveToken`/`moveToken`; Levels an embedded `Level` collection with `{bottom, top, base}`; `Region.levels`, `includedInLevel`: as the shim; a level change leaves elevation; Regions have `ownership` (shim: none) | proposed (D4, D5, D7) |
| LIVE-H81-03 | the module's own placing options reach every client's hooks; v14's own displacement carries `teleport: true` in `updateToken` only, `movementAction` never | read; the module's guard holds where it runs |

**Defects found by the readings** (each red first, then fixed):

1. `game.drpg.runTests({ tier: 2 })` would have errored on v14 before its first test: scripts/tests-kit.mjs `worldDump`
   destructured `game.collections` as `[name, collection]` pairs ("collection is not iterable" read on 14.370), and
   tests-tier2.mjs's restore snapshot did the same. The shim's `game.collections` was a plain Map, so headless never saw
   it. 00-boot's new check red on the Map (`values: false`), the shim's a Collection, the same TypeError then headless,
   both readers on `entries()`, green (tier 2 "E39-T1" ran).
2. The live runner's guesses: the join form (step 1), the seeder's empty world (step 1), and two more found here - the
   seeder wrote the seed's documents but not its world settings (`daggerheart.Automation`; now written and read back,
   `--settings-only` for a world seeded already), and the parts' browsers lacked the storage the harness's browsers hold
   (`storage.gm`, the trace's answer key), so every GM login opened "The case on this browser". foundry.mjs
   `seededLogin` gives each account its role's storage before the module loads.

3. **A player's browser asked for nothing at its start, on every real v14** (found while driving a Search, AUDIT 9.2
   S7-2): `sessionFailures()` on a fresh GM and a fresh player held, every load, "Could not register the pick's passes",
   "... the room actions' uses", "... the eavesdrops", "... the timed effects" - "Cannot read properties of null
   (reading 'isGM')" at lockpick-gm.mjs:216, facility-uses.mjs:122, eavesdrop-gm.mjs:326, timed-effects.mjs:405. The four
   register at `init` (module.mjs), and on 14.370 `game.user` is null at `init` and `i18nInit` (read hook by hook: null,
   then the User from `setup`; `game.userId` set throughout; `game.users` empty at the first two). Each function's hooks
   and socket listener stood; its last line, a player's first ask (`askForPasses`, `askForUses`, `askForRows`,
   `askForTimedEffects`), threw, so after any load a player's browser held no copy of its lock-pick passes, used room
   actions, eavesdrops or timed effects until the next change sent one. The shim held the User from the start. Red:
   the shim's `game.user` null through `init` and `i18nInit` (client-entry.mjs), then 00-boot's new check "startup: no
   registration of the module failed ..." red with exactly those four (36/37). Fix: each ask at `ready` (the comment over
   `registerFacilityUses` already said "At ready"). Green: 00-boot 37/37; mutants 4/4 killed (each file's ask put back
   at init on a copy, 00-boot red). On the sandbox after the fix: no registration failure on the GM or a player, and the
   GM hears the player's `lockpick.passesAsk`, `facility.usesAsk`, `eavesdrop.rowsAsk`, `timed.effectsAsk` at its start.
4. **Scenario 83's L9 raced the turn** (found by the validation run): with the shim's world collections as v14 keeps
   them, L9 failed 109/111 on every run (5 of 5) and passed on the base tree (2 of 2) and on the base with the new
   operators file alone (1 of 1); the collections change alone on the base failed it (2 of 2). Read inside (a page
   variable, not the console, which changed the timing and let it pass): PlayerThree's own copy of the murder state still
   read the victim's turn when it pressed Finishing Blow - refused as `DRPG.Murder.notYourTurn` - while the GM's read the
   killer's. The scenario pressed at once after the GM passed the turn. Fixed in the scenario: p3 waits for its copy to
   read the killer's turn (at most 10 s), as a player sees it before pressing. 83: 111/111. Why the collections change
   moved the timing: not explained.

Also read: Playwright 1.56.1's Chromium 141 draws Foundry's error notification "unsupported on Chromium version less
than 146" on every page (in `__notifications` as an error); Daggerheart 2.12.9 still calls `_del()`, which throws on
v14 (the system's line 9154), and its `DhpChatMessage.renderHTML` throws on a message whose author was deleted
(build line 42439: `author.avatar` of null).

**The validation run** (one harness at a time, flock; ~/drpg/l1-probes/val3.log, the first run lost with the
shutdown): quick - lint red with 2 problems, mine (`localStorage` not defined in foundry.mjs's init script, which runs in
the page; written `globalThis.localStorage`), check 25/25, gate 37/37; tiers 0-1 1759 ran, 1744 passed, 0 failed, 16
skipped, 0 red (300 s); 00-boot 36/36; 91-old-keys-ignored 10/10; 92-old-keys-honoured 10/10; 30-security 302/304, the
2 expected red (Foundry limits); 83-roll-integrity 109/111 (L9, item 4 above); tiers 0-2 whole 3324 ran, 3301 passed, 0
failed, 27 skipped, 0 red (4592 s). After items 3 and 4: 83 111/111, 00-boot 37/37, and a second run (~/drpg/l1-probes/val4.log): quick green (lint 0
problems, check 25/25, gate 37/37); tiers 0-1 1759 ran, 1744 passed, 0 failed, 16 skipped, 0 red (296 s); tier 2 by the
four features' names (Pick the Lock, lockpick, pass, Facilit, room action, eavesdrop, timed effect) 209 ran, 213 passed,
0 failed; 33-bridge-paths 89/90 (1 expected red, a Foundry limit); 99-actions 14/14; 30-security 302/304 (2 expected
red); 40-flow 89/89. Not run locally: the other ci scenarios (CI runs them on a push without [skip ci]; this line
pushes with it, so they wait for the coordinator's run).

## Step 2 - dry run: every part dry-run (16.11.2026)

| What | Ran | Reading |
| --- | --- | --- |
| The dry run | `DRPG_SANDBOX_WORLD=drpg-qa-gate npm run gate:local -- --dry-run` in audit/harness, at 1c76e88f | 0.27 s. `live-stained-glass`, `live-monokuma-legacy`, `live-world-diff`, `sandbox-14-quiet`, `sandbox-60-ledger`, `sandbox-81-render-budget`, `sandbox-83-roll-integrity`, `sandbox-84-viewports`: each `not-run`, reason `dry-run` ("http://localhost:30099 answered (HTTP 200); no part was run"). No drill listed (every stage row's `drills` is empty). Verdict incomplete, unsigned (DRPG_GATE_KEY not set, as the owner chose); nothing written |
| What the dry run does not read | the runner's own first checks, run by hand from a scratch script (foundry.mjs `serverReason`'s rule, `servedDiff`'s loop copied, `login` for each account) | `/api/status` active, 14.370, world `drpg-qa-gate`: none of no-world, wrong-foundry, not-a-copy. 281 module files served (module.json, scripts, styles, lang), 0 differ from the checkout: not stale-module. GM, PlayerOne, PlayerTwo, PlayerThree each logged in on /join without a password (roles 4, 1, 1, 1; module 1.2.116, Daggerheart 2.12.9): not password-required |

Nothing for the owner to change. Left: steps 3-8.

## Step 1 - seed: done (16.11.2026)

The owner answered question 3 with the default (a), and questions 1 and 2 with theirs.

| What | Ran | Reading |
| --- | --- | --- |
| Red first | `node tools/check.mjs gatecode` with its new part (the seeder's self-check) and no rule yet | red: "audit/live/world-empty.mjs is missing - the seeder has no rule for a fresh v14 world" |
| The rule | audit/live/world-empty.mjs: `readInventory` (run in the page), `leftovers` (judged in node), `FIRST_LOGIN_14_370` (the inventory read on 16.11), `selfCheck`; seed-world.mjs reads the inventory before it writes and refuses on any leftover | accepted, each recognised by what was read: Folders of type Compendium; the scene `NUEDEFAULTSCENE0` on a `nue/` background with no tokens, notes, walls, regions, drawings, sounds or templates; a message by a GM, whispered to GMs only, spoken by no actor, with flags of `core` and the module alone, that is the tour's (`core.nue`, "Foundry Virtual Tabletop", an `<h3 class="nue">` head), Dice So Nice's (its alias, a `div.dice-so-nice` head) or the module's first note (`drpgMessage` and `secret` only, content exactly `<p class="notes" data-drpg-secret>-</p>`); any setting. Anything else, and any other collection not empty, refuses |
| Green | the same | `seeder 22/22 planted world(s) refused, the 14.370 world accepted; 0 problem(s)`. Each planted world must be refused with its own line (a player added as a user does not count as the message rule held) |
| Mutants | 7, each on an rsync copy of the tree, `check gatecode` there | 7 KILLED: Folder type ignored; whisper readers not read; the tour scene's tokens not read; unknown collections accepted (3 cases); the module note's content not read; extra flag scopes accepted; the author not read |
| The seed | `DRPG_SANDBOX_WORLD=drpg-qa-gate node audit/live/seed-world.mjs` | `seed-world: created 3 User, 6 Actor, 2 Scene in drpg-qa-gate`, exit 0 |
| Read back | a read-only page as GM against audit/harness/lib/seed.mjs | users PlayerOne, PlayerTwo, PlayerThree (role 1) with the seed's ids; the 6 actors (Aiko, Botan, Chie, Daichi, Monokuma, Remnant) with theirs; "Academy - Floor 1" active, 5 tokens, 6 regions; "Academy - Annex" 1 token. The tour's scene was made inactive by v14 itself when the active academy was created. The world's GM (`NlTKlEFf2ZXi2dtz`) stands in for the seed's `USERGM0000000000`, which the seed names only on its own User document. `__errors` on the GM's page: none |

A deviation from question 3's wording: the rule is held by `check gatecode`'s self-check (as audit/gate/ci-record.mjs's
is), not a tier 0 test - tier 0 runs in Foundry's page, and the seeder runs in node.

Left: steps 2-8.

## Step 1 - seed: stopped, the world is not empty (16.11.2026)

The owner launched `drpg-qa-gate` (16.11.2026). What ran and what it read:

| What | Ran | Reading |
| --- | --- | --- |
| The server | `curl -s /api/status` | `{"active":true,"version":"14.370","world":"drpg-qa-gate","system":"daggerheart","systemVersion":"2.12.9","users":0,"uptime":34442}`. Daggerheart is **2.12.9**, not the 2.12.8 the prompt names. The runner's UNMEASURED guess at the field names (`active`, `version`, `world`, foundry.mjs `serverReason`) holds |
| The seeder, first run | `DRPG_SANDBOX_WORLD=drpg-qa-gate node audit/live/seed-world.mjs` | `error`, the runner's: `page.selectOption: Timeout 30000ms exceeded ... waiting for locator('select[name="userid"]')` (foundry.mjs `login`) |
| What /join is on v14 | a read-only Playwright page dumping the forms' fields; nothing typed or pressed | two forms. `form#join-game-form`: `select[name="userId"]` (id `join-username`; options "" and "GM"), `input[type=password][name="password"]`, `button[name="join"]` "Join Game Session". `form#join-game-setup`: a hidden `action`, `input[name="adminPassword"]`, "Return to Setup" |
| The fix | foundry.mjs `login`: `form#join-game-form select[name="userId"]` and `form#join-game-form button[name="join"]`, the reading written in its header instead of "UNMEASURED: the join form's selectors on v14" | `node tools/check.mjs gatecode live dashes` 0 problems; eslint clean. No harness test drives `login` (it needs a real server), so the first run below is its test: it logged in |
| The seeder, second run | the same command | `seed-world: refused - the world is not empty: 3 Folder, 1 Scene, 5 ChatMessage, 17 Setting`, exit 2. Nothing written |
| What the world holds | a read-only page as GM listing each document and its `_stats.createdTime` | every one written on 15.11.2026 between 20:42:42 and 20:43:33 UTC, at the world's creation and its first GM login: 3 Compendium folders (Daggerheart's "Character Options", "Daggerheart SRD", "Items"); Foundry's new-world scene "Foundry Virtual Tabletop" (`NUEDEFAULTSCENE0`, active, no tokens; flags of isometric-perspective and danganronpa-rpg); 5 messages - Foundry's "Getting Started" and "Inviting Your Players", Dice So Nice's first-use card, and two of this module's, each whispered to the GM (`drpgMessage`, `secret`, 39 characters); 17 world settings (core: time, permissions, moduleConfiguration, compendiumConfiguration, nue.shownTips; daggerheart: Automation, LastMigrationVersion; dice-so-nice: formatVersion, rolesMigrated; isometric-perspective: depthSortActiveFlag; danganronpa-rpg: caseMark, levelUpsMigrated, diceLookSource, diceLookWorld, migratedVersion "1.2.116", foundryBefore, documentLanguage) |

What it means: on v14 a world is never empty by the time a GM can log in to it. Foundry writes its tour, Daggerheart
its folders and every module its first-run settings at the first ready, so seed-world.mjs's rule ("refuses a world that
holds anything but its GM") refuses every fresh v14 world. That is the runner's guess, not the owner's data; still, the
rule is a guard on the owner's worlds, so this line does not loosen it or clear the world without the owner's word.

Correction to step 0: `node tools/check.mjs live` counts **537 items in AUDIT 9.2** (1007 citations in 452 files). My
grep's 551 numbered lines ran past 9.2's end; 537 is the number the steps below count against.

Left: step 1 (waits for question 3), steps 2-8.

Questions:

3. How should the seed get an empty enough world? **Default proposed: (a)**.
   (a) seed-world.mjs counts as empty a world whose only documents are what a fresh v14 world writes at its first
   login, each recognised narrowly: Folders of type Compendium; the scene `NUEDEFAULTSCENE0` with no tokens; chat
   messages flagged `core` (the tour) or this module's GM-only `drpgMessage`, or Dice So Nice's first-use card; and
   any world setting (settings are not documents a table makes). Anything else still refuses. A tier 0 test holds the
   rule on fixtures (red first: the 15.11 world refused today). The academy scene the seed makes is then activated and
   the tour's scene left as it is.
   (b) The owner deletes the tour's scene, the 3 folders and the 5 messages by hand, then this line seeds. The 17
   settings would still refuse, so (b) also needs (a)'s setting rule.
   (c) Something else the owner names.

## Step 0 - preflight (16.11.2026)

| What | Ran | Reading |
| --- | --- | --- |
| The branch | `git fetch origin`; no `claude/e58-local` on origin, so `git switch -c claude/e58-local origin/main`, then `--unset-upstream` (it tracked main) | at ff3e12e5; module.json 1.2.116 |
| The tree | `git status --short` | tracked tree clean; one untracked entry, `Danganronpa-RPG`, a symlink at the root pointing at the checkout itself (made 15.11 21:39, a minute after the sandbox's module link). Left as it is (question 1) |
| Node | `node -v` | v24.22.3 |
| The harness | `cd audit/harness && npm ci` | installed (npm audit lists advisories in dev dependencies; not touched) |
| The quick gate | `npm run quick` | green: lint 414 files 0 problems (15.9 s), check 25 parts all green (54 s), gate self-test 37/37 (2.3 s); 72.6 s wall. CLAUDE.md says 9-13 s "here": on this machine it is about six times that, nearly all of it `check` |
| The sandbox | `curl -sI http://localhost:30099` | `HTTP/1.1 302 Found`, `Location: /setup`: the server answers and no world is launched |
| The environment | `source ~/drpg/qa-env.sh`, then each name tested for being set | set: DRPG_SANDBOX_URL, DRPG_SANDBOX_WORLD. Unset: DRPG_GATE_KEY (the owner's choice), DRPG_API_KEY, DRPG_FIXTURES (on purpose), DRPG_REPO, PLAYWRIGHT_BROWSERS_PATH |
| The pre-push hook | `ls .git/hooks`, `git config core.hooksPath` | none installed in this checkout (only the samples); nothing to get round, and nothing guarding the push but the rules |
| The sandbox's modules | `ls ~/foundry/qa-data/Data/modules` | avclient-livekit, dice-so-nice, isometric-perspective, and danganronpa-rpg as a symlink to this checkout |

Read before step 1: CLAUDE.md, docs/dev/METHOD.md, audit/gate/README.md, audit/live/README.md, audit/harness/README.md
("What the harness cannot do"), audit/AUDIT-1.2.42.md 9.2 (its head; 551 numbered items, 556 distinct LIVE ids from
line 699 on, counted by grep), the plans E39, E40, E43, E53, E58 on origin/claude/plan-130, docs/dev/e39, e40, e43 and
e112 STATUS.md, tools/stages.json's rows (E39, E40, E43, E53, E58 all planned 1.2.117, version null; E112 shipped
1.2.116 on 16.11.2026, touches sockets, rolls, scenes).

Left: steps 1-8.

Questions (each with the default this line runs on):

1. The self-pointing symlink `~/drpg/Danganronpa-RPG/Danganronpa-RPG` is untracked and makes `git status` not empty.
   Default: left alone; the owner removes it if it was a slip (`rm ~/drpg/Danganronpa-RPG/Danganronpa-RPG` removes the
   link only, not the checkout). Lint and the 25 checks did not follow it.
2. The sandbox is at `/setup`. Step 1 (seed) and step 2 (dry run) need the world `drpg-qa-gate` launched; this line
   never logs into setup. Default: the owner launches the world, then this line seeds it.
