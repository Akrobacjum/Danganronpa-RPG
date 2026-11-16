# AUDIT 9.2 triaged for this sandbox (E58 L1, step 4's worklist)

16.11.2026. Four read-only readers each read a quarter of audit/AUDIT-1.2.42.md section 9.2 (items 15-561) and section
7 (S7-, lines 449-482) in full and put every item in one class, for this sandbox as it is: Foundry 14.370 on localhost,
the harness's seeded world, Daggerheart 2.12.9, Playwright's headless Chromium (software rendering), no microphone or
camera, no LiveKit server, no second machine, no real people, no The Forge, no fixtures.

- K: checkable by script on this sandbox, no eyes needed (the probe in a line)
- S: needs eyes; a headless screenshot can show it (what it must show)
- T: needs what the sandbox lacks (which)
- F: needs a fixture world copy
- C: closed or obsolete by its own text (the words that say so)
- M: measured in step 3

This is a worklist, not a result: a class says how an item can be settled here, not that it was. Each item's result is
written in LOCAL-REPORT.md's step 4 groups as measured, not checkable (with why) or a defect. Counts by the readers:
S7 and 15-150 K=111 S=9 T=15 F=5 C=3 M=7; 151-290 K=73 S=29 T=33 F=3 C=1 M=1; 291-430 K=80 S=28 T=26 F=6 C=0 M=0;
431-561 K=67 S=36 T=24 F=2 C=4 M=2. Items 475-478 carry two rows each in the last reader's list (two items share each
number in AUDIT 9.2: E93-01/E76-01, E93-02/E76-02, E93-03/E76-03, E69-04/E76-04), and item 22 is the same move as
LIVE-E39-01 (M) though its reader marked it K.

| Item | Id | Class | Note |
| --- | --- | --- | --- |
| S7-1 | - | K | Player Searches, GM page stays silent 3 min; read game.drpg.tokensLeft(room) and the player's remaining actions |
| S7-2 | ROLL-06 | K | In D20RollDialog switch Eye to Hand; read the card header, the stat chip and the used-stat field on the rollTrait result |
| S7-3 | ROLL-14 | K | Player sets the Self Roll chat mode and forces a Despair result; compare the Monokuma pool before and after |
| S7-4 | CASE-03 | K | During an incident, run the quoted secret-message filter in the player's console; list alias and whisper |
| S7-5 | COMM-03 | K | Run the quoted thread filter in the player's console; expect no content from other users' threads |
| S7-6 | COMM-02 | K | Fire an E21 trap; on the GM page read popup DOM, spy AudioHelper.play, check log buttons |
| S7-7 | MAP-02 | K | Observer page samples token.visible and position each frame while another token enters the room |
| S7-8 | CORE-13 | K | Fresh English world; safeword twice from the sheet; read the chat text after "already had a safeword" |
| S7-9 | CORE-06 | K | As a bystander in the incident, read the HUD minute counter DOM after the GM moves the hour |
| S7-10 | DESP-04 | K | Tick only Despair in the overflow hat, fire, Fuel a Monocub; read Hope and the pool |
| S7-11 | DESP-12 | K | Two GM accounts: one rolls students (+1), the other pays Calls; compare the bar value with the sum |
| S7-12 | UI-09/10 | S | Actors popout and NPC sheet styled under Stained Glass; sticky trial cards (K+S) |
| S7-13 | - | S | Polish text fits tiles/HUD/status/panel/Look at 1080p and 900p, both themes (LatinExt woff2 load is K) |
| S7-14 | - | C | "To nie błąd, ale warto wiedzieć" |
| 15 | MAP-02 | K | Observer samples the canvas token's visibility and position per frame; token must appear only at the room border |
| 16 | UI-10 | K | Trial with two sticky cards plus a refusal under Stained Glass; count sticky cards and check the oldest is gone |
| 17 | COMM-11 | K | game.keybindings.set for the safeword action, dispatch keydown with no sheet open, read the chat card |
| 18 | - | K | Player rolls spending Hope; on the GM read the Hope drop and check relayGuard().refused has no unknownSender |
| 19 | - | K | Read typeof game.socket.listeners/off/on/prependAny and game.drpg.relayGuard().state on the GM |
| 20 | - | K | Two GM accounts; register both Hooks.once probes, use Configure Ownership, read ownership.default |
| 21 | - | C | "Nieaktualne od 1.2.67" |
| 22 | - | K | Move a token with waypoints across rooms; log the preUpdateToken/updateToken change sequence and the level field |
| 23 | - | K | ui.notifications.info("<b>x</b>"); inspect the toast's innerHTML for an element or escaped text |
| 24 | - | S | Player sheet under drpg-resources-locked, with the setting on and off |
| 25 | LIVE-E30-01 | M | already measured |
| 26 | LIVE-E30-02 | M | already measured |
| 27 | LIVE-E30-03 | M | already measured |
| 28 | LIVE-E30-07 | F | old pre-ledger world copy (DRPG_FIXTURES) |
| 29 | LIVE-E30-04 | M | already measured |
| 30 | LIVE-E30-05 | M | already measured |
| 31 | LIVE-E30-06 | K | Create an Assistant GM account; run scenario 17-assistant sections B and C; read Hope changes on the GM |
| 32 | LIVE-E30-08 | T | needs the table's Data folder (owner's install) |
| 33 | LIVE-E30-09 | M | already measured |
| 34 | LIVE-E30-10 | M | already measured |
| 35 | LIVE-E31-01 | K | Run a GM-side Reroll for each listed action; scan the GM console and the player notifications for refusals |
| 36 | LIVE-E31-02 | T | real-server network latency (Forge); localhost timing is K |
| 37 | LIVE-E31-03 | K | Player requests sabotage, close the GM page; count timeout notices, reopen the GM page, check one retry with the same id |
| 38 | LIVE-E31-04 | K | Inject 5 s and 10+ s delays on the plant reply via a socket wrapper; check the item returns late |
| 39 | LIVE-E31-05 | K | Enable reduced motion; time the window's re-render after handOff in gm-panel and season-setup |
| 40 | LIVE-E31-06 | K | Player client in Polish, GM in English; trigger a refusal; read the player toast and the GM log line |
| 41 | LIVE-E04-01 | C | "Odpowiedziane 31.10.2026 przy stole właściciela" |
| 42 | LIVE-E04-02 | T | Forge/LAN with two GMs and real campaign data |
| 43 | LIVE-E04-03 | T | the table world's browser localStorage (owner's table) |
| 44 | LIVE-E04-04 | K | context.setOffline(true/false) on the GM page; watch socket connect, the exchange restarting, writes from the gap |
| 45 | LIVE-E04-05 | T | Firefox and the Foundry desktop app (Chromium part is K) |
| 46 | LIVE-E04-06 | F | owner's world copy with a saved browser store |
| 47 | LIVE-E04-07 | K | Second world on the server: reset the test world, read the campaign store; Duplicate World, compare world.id |
| 48 | LIVE-E04-08 | K | Open a murder, GM logs in from a fresh browser context; read the health warning, Restore, finish the incident |
| 49 | LIVE-E04-09 | K | Reset from Assistant and second-GM accounts; read the refusal text naming the primary, then the later trim |
| 50 | LIVE-E04-10 | F | world upgraded from v1.1.0 |
| 51 | LIVE-E04-11 | K | Two pages in one browser context on one world; write traces in both, count the saved rows |
| 52 | LIVE-E04-12 | K | Player page logs the order of userConnected(true) and the bridge onGmReady packet while the GM loads |
| 53 | LIVE-E05-01 | K | Run worldScan in the witness player's console through the whole chapter; check the victim's deceased flag |
| 54 | LIVE-E05-02 | F | owner's world copy for the 1.2.64 migration clauses |
| 55 | LIVE-E05-03 | S | Dead marker appears on the body only at reveal, on the lone finder's canvas (K+S) |
| 56 | LIVE-E05-04 | T | real LiveKit server and voice |
| 57 | LIVE-E05-05 | K | On each page read the trail token's nameplate.text and mesh texture src (finder, GM, others) |
| 58 | LIVE-E05-06 | T | card timing at a real networked table (log routing is K) |
| 59 | LIVE-E05-07 | K | Hope swap, advance the time of day; read the pool on every page's HUD and the debt on the GM panel |
| 60 | LIVE-E05-08 | T | Level Up sound on the owner's machine (windows and cards are K) |
| 61 | LIVE-E05-09 | K | replaceFlag on a user, forcedDeletion() on chat message flags; read _source back |
| 62 | LIVE-E05-10 | K | Save a note with all GMs logged out, log a GM in, check the note arrives |
| 63 | LIVE-E05-11 | K | Read the avclient-livekit serverType setting choices; set it to Tavern, check no secret warning appears |
| 64 | LIVE-E05-12 | K | Write lastAction to an unlinked token's delta, run dropRollBookmarks; read the token _source and the world stamp |
| 65 | LIVE-E05-13 | K | In Eclipse drag a token across two rooms in one move; count the updateToken calls and read roomsVisited |
| 66 | LIVE-E05-14 | K | Taker's page: after the death reveal read the loot token's nameplate and texture after drpgBulletRefsChanged |
| 67 | LIVE-E06-01 | K | Three pages: on the victim's page check the curtain DOM, an audio spy and event cards on the opening roll |
| 68 | LIVE-E06-02 | K | Dump a module roll message's JSON in the bystander console (2.12.9 only; 2.6.5 needs another install) |
| 69 | LIVE-E06-03 | K | Hook diceSoNiceRollStart on every page with each setting combination; compare who animates which roll |
| 70 | LIVE-E06-04 | K | On the bystander page read the chat tab's notification class and spy the sound when a veiled card arrives |
| 71 | LIVE-E06-05 | K | Read the safeword card's header DOM; F5 the GM mid-press, time the fallback card on every page |
| 72 | LIVE-E06-06 | K | Check the trap receipt and the rework card exist only in the killer-GM thread; click Plant, read the result |
| 73 | LIVE-E06-07 | F | owner's world copy with old cards |
| 74 | LIVE-E06-08 | K | On the player's page check the verdict card for GM-only lines or buttons rendered visible |
| 75 | LIVE-E32-01 | K | Run tier 2 on the sandbox; list the skipped grid cases and their time (the owner's table timing may differ) |
| 76 | LIVE-E32-02 | K | Install 1.2.65, start an incident, update to 1.2.66, reload; read the fight and the player's murderState keys |
| 77 | LIVE-E07-01 | K | Three pages: read the tile label/cost/colour, aria-disabled and tooltip text, and the D20RollDialog title |
| 78 | LIVE-E07-02 | K | Two Blackened, Self-defence: read the tile state at Class Trial, the offer, Eclipse betrayal timing |
| 79 | LIVE-E07-03 | K | Despair with a Tier 1 knife; read the damage, the knife's broken state after the hit, durability after Reroll |
| 80 | LIVE-E07-04 | K | Read the damage line text in the victim's chat and popup and the killer's and GM's chat |
| 81 | LIVE-E07-05 | K | Read the crisis row facts, "Roll it", the verdict card thread, the locked Statistic select (2.12.9 only) |
| 82 | LIVE-E07-06 | K | Trap incident: script the victim's turns with drain 2; check it proceeds without Pass |
| 83 | LIVE-E07-07 | K | Clean up with gloves, discover the body; read the gloves' state; close without Stage 6, read the items |
| 84 | LIVE-E07-08 | S | Polish murder window's two-column grid renders correctly, also when opened from the trap card |
| 85 | LIVE-E07-09 | K | Read the GM tracker DOM: opening line, last three turns, warning; second GM names the roller |
| 86 | LIVE-E07-10 | K | Two GM pages: Pass/Close on the second GM; repeat the request; reload the primary mid-fight; read the replies |
| 87 | LIVE-E07-11 | T | real GM and players to judge the fight's pacing |
| 88 | LIVE-E07-12 | K | At night open the opening roll dialog; read the chip states and texts for the killer and the trap victim |
| 89 | LIVE-E08-01 | K | Player Reroll: read Hope, rewritten dice, DSN hook appearance, struck card DOM, update options on other clients |
| 90 | LIVE-E08-02 | K | Reload the GM page at each rerollJournal stage (break on the stage); read Hope, cards, messages |
| 91 | LIVE-E08-03 | K | Two GM pages: log the order of userConnected and active; Reroll during the primary handover |
| 92 | LIVE-E08-04 | K | Reroll an erasure; compare the restored trail token's id with the original |
| 93 | LIVE-E08-05 | K | Read the context menu entries on the player's own roll; rewrite the dice; check rollBookmarks is gone |
| 94 | LIVE-E28-01 | K | Hook diceSoNiceRollStart per page; compare the user/appearance and who animates (roller, GMs, participant, bystander) |
| 95 | LIVE-E28-02 | K | DSN disabled: spy the sound, read the card and message header DOM on the roller, GM and bystander pages |
| 96 | LIVE-E28-03 | T | Roll-to-dice timing needs a real GPU/the owner's table (rollFlags is K) |
| 97 | LIVE-E28-04 | K | Read reviewBuild's fingerprint match; patch the build, check the fallback notice appears once (2.12.9 only) |
| 98 | LIVE-E28-05 | K | With no GM logged in: action refused before cost, reaction roll marker; GM returns, Grant all |
| 99 | LIVE-E28-06 | K | Two GM pages: check the primary answers the draw; switch the primary mid-draw, read the resolution |
| 100 | LIVE-E28-07 | T | real desktop background-tab timer throttling |
| 101 | LIVE-E28-08 | K | Player transfers an item to the party; read the GM refusal, the unchanged data, one GM notice per session |
| 102 | LIVE-E28-09 | K | Player roll drawn by the GM; count countdown ticks and item trigger runs |
| 103 | LIVE-E28-10 | K | Meddle: read the card's dice and sum in the room; a refused Meddle posts no card, the player gets a notice |
| 104 | LIVE-E28-11 | K | Two GM pages click Grant all simultaneously and Reroll simultaneously; read Hope/Despair paid once |
| 105 | LIVE-E28-12 | K | Advantage roll: read the formula/dice, Reroll dice, Blaze of Glory crit, Shift-click reaction, countdown tick |
| 106 | LIVE-E28-13 | K | Player pays Hope for a project action and a Call; read the progress count; spend Hope elsewhere |
| 107 | LIVE-E28-14 | K | GM-drawn sheet stat roll: read the card header speaker on the roller, GM and bystander pages |
| 108 | LIVE-E28-15 | K | Use an item in a fight: read the message author on the bystander page, the player's chat/thread, no-GM notice |
| 109 | LIVE-E28-16 | K | Close the primary GM page mid-roll; count the resolutions arriving at the new primary |
| 110 | LIVE-E29-01 | K | Log options.drpgWrite in the primary GM's updateActor/updateItem/deleteItem hooks (v14 only; v13 not tested) |
| 111 | LIVE-E29-02 | K | As a player check the party card dots and HUD bars are readonly; force a write, time how long it shows before the revert |
| 112 | LIVE-E29-03 | T | a long real evening session (listed rows); the chapter run is K |
| 113 | LIVE-E29-04 | K | Player deletes/creates a module item via the DH sheet; check a GM card with Undo |
| 114 | LIVE-E29-05 | K | Two GM pages click Undo on one card at once; count the writes |
| 115 | LIVE-E29-06 | K | Sheet changes with no GM online; GM returns (also from a fresh context); read the card and the reverts |
| 116 | LIVE-E29-07 | K | Sheet stat roll with an uncounted modifier; read the DH card lines and the private card text |
| 117 | LIVE-E29-08 | K | Read the fromData shape, relay credit, rebuilt Reroll (2.12.9 only; 2.6.5 needs another install) |
| 118 | LIVE-E29-09 | K | Compare the DSN hook's advantage dice on the roller's page with the GM card's advantage dice |
| 119 | LIVE-E29-10 | K | Read the drawn roll card's result, formula and sum; a chat-triggered reaction has no success line |
| 120 | LIVE-E29-11 | K | Crisis/erasure/false-lead choice card: read the held roll's key and variant from the card flags |
| 121 | LIVE-E29-12 | K | Assistant clicks yes, check the Call arms; primary leaves, card arms nothing; wait past 60 s |
| 122 | LIVE-E29-13 | T | real network latency for the 2 s card window (part a is K) |
| 123 | LIVE-E29-14 | K | Log the hooks fired for parent-embedded effect/item updates and operator instances; read audit rows and reverts |
| 124 | LIVE-E29-15 | K | Player Search, primary GM spends the token; read tokenSpentAt and the kept find; switch the primary mid-way |
| 125 | LIVE-E33-01 | K | Run scenario 83 through the local gate with the real roll dialog; read the flags/rows (2.12.9 only) |
| 126 | LIVE-E33-02 | K | As a player use Reroll action roll and the dice button on drawn and own rolls; read the console write and rewrite row |
| 127 | LIVE-E33-03 | K | Enable forcePrivateRolls; read the whisper lists for each listed roll, deprecation logs, applyMode({}, "gm") |
| 128 | LIVE-E33-04 | K | Run game.drpg.publicRoll from a macro with a student token selected; read the speaker on player pages and DSN |
| 129 | LIVE-E33-05 | T | perf() at the owner's table with their world copy |
| 130 | LIVE-E33-06 | K | Confusion: tile, target dialog, room dice, veiled cards, a refusal; read the DOM and the Monocub notice |
| 131 | LIVE-E33-07 | K | While a Search is drawn, close/reload the primary GM; watch the player for 30 s; read the action and cost back |
| 132 | LIVE-E33-08 | K | Reroll crisis and crit Strikes from the GM record; read cards, versions, roller's DSN dice |
| 133 | LIVE-E33-09 | K | Open the real roll dialog with Confusion; read the bonus field, the sent +1, callBonus, render count, Roll submit |
| 134 | LIVE-E33-10 | K | Player-created message: read author, the client timestamp kept, _stats.createdTime (v14 only) |
| 135 | LIVE-E34-01 | S | Fog reveal animation, door glow, room outline recolour/zoom refresh, raster drift (diagnostics/load time K) |
| 136 | LIVE-E34-02 | S | Murder window, tracker, crisis action, Stage 6, betrayal offer rendered correctly |
| 137 | LIVE-E09-01 | K | Two players and two GMs: script Observe/Analyze/Tamper/chapter end; check the Key Remnants fee is charged once |
| 138 | LIVE-E09-02 | K | Investigation desk open on both GMs; both save in one sync; read the field marks and savedOver |
| 139 | LIVE-E09-03 | K | Hide the primary GM page (CDP visibility); on the second GM read the choice card popup and spy the sound |
| 140 | LIVE-E09-04 | S | Desk at 1400px and narrow width; trail line colour readable, both themes |
| 141 | LIVE-E09-05 | K | Chapter end: read the window's numbers, Faint/Final analysable next chapter, time waiting for judgedFor |
| 142 | LIVE-E10-01 | K | Three pages run the full trial, late joiner, page.reload of GM mid-vote; read the counters and the card delay |
| 143 | LIVE-E10-02 | K | Playwright presses Enter in the verdict DialogV2, focus on the list then on the window; check nobody dies |
| 144 | LIVE-E10-03 | S | Objection card above windows; verdict/Level Up/trial console at 1920x1080 and narrow |
| 145 | LIVE-E10-04 | K | Two GM pages: second console refreshes; close the primary mid-vote; send a card; press verdict on the non-primary |
| 146 | LIVE-E10-05 | T | another machine's skewed system clock and a real background tab |
| 147 | LIVE-E10-06 | K | Press Enter in the class Level Up DialogV2 with rows on "I choose"; read what each row grants |
| 148 | LIVE-E10-07 | K | Open Level Up from the sheet, click the sheet; elementFromPoint/z-index shows the Level Up window is still on top |
| 149 | LIVE-E75-01 | K | Player starts a countdown; read the GM toast, the refused countdownsFromAction bucket, the player notice (2.12.9, not 2.10.11) |
| 150 | LIVE-E75-02 | K | Second player's console during the same action: no DH error, no new countdown in settings |
| 151 | LIVE-E75-03 | K | game.drpg.relayGuard(): read state, fingerprint default-branch entry, unreviewed. Item is for DH 2.10.11; sandbox has 2.12.9 |
| 152 | LIVE-E75-04 | T | owner's table DH version, only if older than 2.10.10 |
| 153 | LIVE-E75-05 | K | load module, runTests({tier:2}) 0 failed, repeat E30-01/E05-09. Item is for 14.369+DH 2.10.11; sandbox is 14.370/2.12.9 |
| 154 | LIVE-E11-01 | K | make 4 project tokens (2 live, duplicate, orphan), reset; read player canvas.tokens visibility, project tokens gone, console errors |
| 155 | LIVE-E11-02 | K | give player TOKEN_CREATE, player drops project actor; read whether created, then primary GM sync deletes or flags it |
| 156 | LIVE-E11-03 | K | two players enter body room; read each canvas pan target, count body cards after verdict/trial end |
| 157 | LIVE-E11-04 | S | Eclipse arrow dimmed with reason; waiting text beside undimmed action tiles |
| 158 | LIVE-E11-05 | K | convene assembly, Edit campaign rewinds time; read no summons, cancel card visible, Class Trial entry prompts |
| 159 | LIVE-E11-06 | F | owner's world reset before 1.2.73 (orphans) |
| 160 | LIVE-E11-07 | K | bedrooms on academy+annex; reset with both cast options; read each token's scene/region |
| 161 | LIVE-E11-08 | S | End-of-chapter window: disabled fields dimmed, untyped-bullet warning readable, both themes |
| 162 | LIVE-E11-09 | K | second GM account page: End chapter/Body found notices, one body card, late-approved window does nothing (K+T for real network/humans) |
| 163 | LIVE-E12-01 | K | GM views annex during Eclipse; read murders resolved, assembly scene, Room Setup Apply writes to the scene it opened on |
| 164 | LIVE-E12-02 | S | Floors buttons both themes/narrow; other-floor room veiled (rest K on a scripted two-level scene) |
| 165 | LIVE-E12-03 | K | read new region levels, dropped token level, MOVEMENT_FIELDS, polygonTree.testPoint, updateRegion on scene.update |
| 166 | LIVE-E12-04 | K | player tries region create/rename; read refusal, author, _stats.lastModifiedBy |
| 167 | LIVE-E12-05 | K | token vision off: per page read canvas door controls visible/class; check doorControlClass in v14 |
| 168 | LIVE-E12-06 | S | Room Setup: fixed columns, one-line counter, switches, legend, desktop and narrow |
| 169 | LIVE-E12-07 | K | Playwright drag a token through two doors; log updateToken series and judgeArrival verdict |
| 170 | LIVE-E12-08 | F | owner's world copy for migration whisper |
| 171 | LIVE-E12-09 | K | make two-piece room: read player outline geometry, Neighbours movement/Listen both ways, corner-touch not neighbours |
| 172 | LIVE-E13-01 | S | three pages in trial hall under isometric, chosen tokens revealed (needs a hall scene) |
| 173 | LIVE-E13-02 | K | reload player during hall activation; read landing scene, view() warning, selfRepair move |
| 174 | LIVE-E13-03 | S | DSN dice visible on every page's screenshot during a hall roll |
| 175 | LIVE-E13-04 | S | dead student's linked token shows dead overlay in hall |
| 176 | LIVE-E13-05 | T | real LiveKit server (one trial room) |
| 177 | LIVE-E13-06 | K | delete cast token from hall, open trial; read token recreated, GM whisper lists only notPlaced/Monokuma |
| 178 | LIVE-E13-07 | K | scripted full trial start->vote->verdict->end; read everyone back in school in chosen room, no fixes |
| 179 | LIVE-E13-08 | K | player toggles own token hidden via HUD/console; read server result and castPutBack revert |
| 180 | LIVE-E13-09 | K | computed display of Scene card (GM/players), #scene-navigation, #hotbar in both themes |
| 181 | LIVE-E13-10 | K | End trial with isometric: read positions in room/grid, teleportTokens cross-scene id, copy delta/flags, carriedFrom reload |
| 182 | LIVE-E13-11 | K | disable avclient-livekit, then remove isometric; read stop notices, stylesheet links, hidden nav/hotbar, dependency prompt |
| 183 | LIVE-E81-01 | K | run R294 vectors through real cleanHTML/NOTICE_CLASSES; read stored entry and window for executable remnants |
| 184 | LIVE-E81-02 | S | corner buttons, notice tile states, history window across sizes/themes/languages (LiveKit dock part may be T) |
| 185 | LIVE-E81-03 | K | post card, reload player at once; read both cards in history with unread banner, absent for others |
| 186 | LIVE-E81-04 | S | Legacy history button under clock/window, above card; moves on live theme switch |
| 187 | LIVE-E81-05 | S | narrow layout: no history button, roster above stack, drpg-short stack beside buttons |
| 188 | LIVE-E81-06 | K | two accounts in one browser context: read history sections, reset clearing rules, quota-full footer |
| 189 | LIVE-E81-07 | K | Playwright hasTouch tap history button; window opens, card stays; hit rect >=44px (real touch device not covered) |
| 190 | LIVE-E81-08 | T | NVDA screen reader |
| 191 | LIVE-E81-09 | K | two tabs same account; Clear in one, read the other's storage/history stays cleared |
| 192 | LIVE-E81-10 | K | run scenario 30 execution/replay probes in a live page; count executions and replays |
| 193 | LIVE-E81-11 | K | R295 live: retract removes entry, other deletes mark deleted; read deleteAll in delete hook options |
| 194 | LIVE-E81-12 | S | button accent changes smoothly across day phases, no curtain recut (silence is K via play hooks) |
| 195 | LIVE-E81-13 | S | on Foundry: three corner buttons fully inside launch pane with real tab rail |
| 196 | LIVE-E81-14 | K | await actor.getTokenDocument(); read toObject ring/size/vision; keepId create on unviewed scene |
| 197 | LIVE-E81-15 | K | non-owner player setFlag trialSeats/trialReturnTo on hall scene; read server refusal |
| 198 | LIVE-E81-16 | K | setFlag partial trialSeats object; read merged vs replaced record |
| 199 | LIVE-E81-17 | K | after trial deletes made token, open DH sheet and old chat card buttons; read errors |
| 200 | LIVE-E81-18 | K | perf() around ~8 token create/delete; record player canvas draw order vs activate (sandbox numbers only) |
| 201 | LIVE-E81-19 | F | world from 1.2.74 with per-token cast rows |
| 202 | LIVE-E81-20 | K | untick living student, End trial; read token stays put, whisper omits them |
| 203 | LIVE-E81-21 | T | Firefox/Safari browsers absent (Chromium only) |
| 204 | LIVE-E81-22 | K | player deletes own message; read permission, deleteChatMessage userId on each page, history entry marked deleted |
| 205 | LIVE-E77-01 | S | P11 matrix: room tile under clock/by notices, photo edge, long description, narrow thumbnail |
| 206 | LIVE-E77-02 | S | Regions palette, sidebar, popout, context menu fully visible; reopened after 1920->1366 |
| 207 | LIVE-E77-03 | K | Playwright network log: room image fetched only from this server; try redirecting path |
| 208 | LIVE-E77-04 | K | click tile photo; read ImagePopout DOM: no share/show controls, header text equals raw room name |
| 209 | LIVE-E77-05 | K | type in chat with Foundry Tools open, setViewportSize; read activeElement and input value |
| 210 | LIVE-E77-06 | K | Tools closed, post message; read Foundry chat notification DOM appears for GM |
| 211 | LIVE-E77-07 | K | in Investigation/Evening read computed colours vs --drpg-glass-accent on listed elements |
| 212 | LIVE-E77-08 | T | owner's judgement of screenshots (AM-1) |
| 213 | LIVE-E77-09 | C | "nie ma już czego sprawdzać" |
| 214 | LIVE-E77-10 | K | press Escape/Shift+C via Playwright; read windows, focus, other listeners; check canvas.currentMouseManager exists |
| 215 | LIVE-E77-11 | K | player page: press T, R, F, ping, drag token; read layer active after new canvas |
| 216 | LIVE-E77-12 | K | save window positions at 1920x1080, reopen at 1366x768; read rects on screen, clear of corner; restore |
| 217 | LIVE-E77-13 | T | real phone hardware (Legacy panel placement is K via rects) |
| 218 | LIVE-E77-14 | S | room art above board, under dragged Foundry windows/popout and notices; Legacy order |
| 219 | LIVE-E77-15 | K | two co-owner pages, move through door; time tile switch ~1.5 s, rejected room never shown |
| 220 | LIVE-E77-16 | K | player places template from DH card; read layer stays Templates/Notes, preview kept |
| 221 | LIVE-E77-17 | S | toggle off: Foundry sidebar/controls in default place, curtain cut around them (growth K) |
| 222 | LIVE-E77-18 | S | Legacy pixel font in sidebar, FA icons intact, room tile 16px from right column |
| 223 | LIVE-E78-01 | S | E78 room/voice tiles placement, tilt, dock hidden across P11 sizes/themes |
| 224 | LIVE-E78-02 | T | real LiveKit and microphone |
| 225 | LIVE-E78-03 | T | real LiveKit audio (block stops transmission) |
| 226 | LIVE-E78-04 | T | real audio devices |
| 227 | LIVE-E78-05 | T | real phone touch hardware |
| 228 | LIVE-E78-06 | T | real LiveKit audio to test block (K+T: server refusal and secret are K) |
| 229 | LIVE-E78-07 | T | real LiveKit server drop/reconnect |
| 230 | LIVE-E78-08 | T | proximity-voice-chat plus real LiveKit audio |
| 231 | LIVE-E78-09 | K | set useExternalAV true; read mic button dot/label and dock state (AV may need a server) |
| 232 | LIVE-E78-10 | T | The Forge, two real browsers, real audio |
| 233 | LIVE-E78-11 | T | The Forge Assets Library |
| 234 | LIVE-E78-12 | K | sample rects/getAnimations of rotated blocks over 5 s idle at 1920x1080 and 1366x768 |
| 235 | LIVE-E78-13 | T | The Forge corner check (local anvil face is S) |
| 236 | LIVE-E78-14 | K | Playwright mouse-drag GM/player into new room; read tile, fog, single passage charge, "read again at rest" |
| 237 | LIVE-E84-01 | T | The Forge and Firefox (local Chromium part is K) |
| 238 | LIVE-E79-01 | K | cross secret passage by drag, ruler, keyboard, code update; read who stops at the wall |
| 239 | LIVE-E79-02 | K | moveAudit log; scripted lawful moves; read passages.audit() rows, dropped 0, waypoints, ignoreWalls, sentBack |
| 240 | LIVE-E79-03 | S | isometric view: passage gap in outline sits at passage; floor-limited opening |
| 241 | LIVE-E79-04 | K | two players same room; first reveals passage; second crosses, history card both, GM whisper |
| 242 | LIVE-E79-05 | T | owner's acceptance of mockup D31 (shots S, level canvasReady K) |
| 243 | LIVE-E79-06 | K | Playwright clicks: New passage, two wall clicks, give student, Esc; read stored passage |
| 244 | LIVE-E79-07 | K | sendBack mode: player console move through unknown wall; read put-back, message, audit row, second GM |
| 245 | LIVE-E79-08 | K | GM drags Monokuma and unknowing student through open passage; read where each stops |
| 246 | LIVE-E79-09 | K | new player with toggle on: read journal not opened, no welcome flag on server user (DH 2.12.9) |
| 247 | LIVE-E79-10 | K | player without character logs in; read auto UserConfig closed, click-opened stays; userActivation |
| 248 | LIVE-E79-11 | K | toggle on: read FILES_BROWSE/UPLOAD roles, portrait click, GM re-tick revert plus whisper |
| 249 | LIVE-E79-12 | K | create accounts named like students; read character/ownership, GM card, cleared stays empty |
| 250 | LIVE-E79-13 | K | three student cases, open trial; read made tokens' texture/size/rotation/alpha/lockRotation, move rotates? |
| 251 | LIVE-E79-14 | S | room tile shows hall name/photo/description; no CLASS TRIAL text behind debate clock |
| 252 | LIVE-E79-15 | K | click sidebar collapse in Foundry Tools; read window width, sidebar node names, after reload |
| 253 | LIVE-E79-16 | K | player tray DOM: empty-line text, appears/disappears with project create/delete (DH 2.12.9 not 2.6.5) |
| 254 | LIVE-E79-17 | S | Stained Glass roll card: Hope die gold, Fear pink, legible digits, crit |
| 255 | LIVE-E79-18 | S | notice card fills tilted pane to wall/bottom; no LATENCY/FPS readout |
| 256 | LIVE-E79-19 | K | Playwright drags; timestamp drop->tile/fog via MutationObserver on player, co-owner, GM pages |
| 257 | LIVE-E79-20 | T | real LiveKit server and speaking person |
| 258 | LIVE-E79-21 | T | real LiveKit room and speaker; screen reader |
| 259 | LIVE-E79-22 | T | real LiveKit speakers |
| 260 | LIVE-E79-23 | S | OBJECTION! hand icon both themes; Foundry tooltip on hover/Tab (rest K) |
| 261 | LIVE-E79-24 | K | Playwright long drag; count updateToken writes and intervals; read send-back spot, audit rows |
| 262 | LIVE-E79-25 | K | leave-room pickup passage: co-owner drags to unaffordable room and stairs; read passage kept/removed |
| 263 | LIVE-E80-01 | K | Go through tunnel then stairs; read landing cell/room/level, cost, second player's tile/fog, refusal no move |
| 264 | LIVE-E80-02 | K | Hide ruler; player drags; read ruler drawn on other pages; SHOW_RULER default roles |
| 265 | LIVE-E80-03 | K | player toggles secret door ds; read server acceptance, primary revert, audit/sendBack |
| 266 | LIVE-E80-04 | S | Passages tab: columns after Rooms, no horizontal scroll, no clipped cells, PL/EN |
| 267 | LIVE-E16-01 | K | 0-Hope player clicks experience in roll window; read Roll disabled; Call case cost 0 (needs DH 2.10.5/2.6.5; sandbox 2.12.9) |
| 268 | LIVE-E16-02 | S | roll window at 1366x768: mode select, title bar, horizontal title, Reaction chip, under curtain |
| 269 | LIVE-E16-04 | K | player DSN submit, read revert/notice; assistant flag write; noHook hooks; Setting _stats.lastModifiedBy |
| 270 | LIVE-E16-03 | S | player's DSN dice drawn in GM's colours/material/SFX (flags K) |
| 271 | LIVE-E80-05 | T | The Forge latency, second machine clock, real responders |
| 272 | LIVE-H81-01 | T | owner's report of where one-way failed (steps 1-2 K) |
| 273 | LIVE-H81-02 | K | open sheet; getBoundingClientRect left of sidebar, equipped, experience, passage rows |
| 274 | LIVE-H81-03 | M | measured |
| 275 | LIVE-H82-01 | T | owner's DSN SFX setup, table latency (flags K) |
| 276 | LIVE-H82-02 | T | real LiveKit server connect times |
| 277 | LIVE-H82-03 | S | GM overlay tunnel labels, one-way arrowhead, both themes, zoom 0.4-1 |
| 278 | LIVE-H82-04 | S | GM room outline gap at passage, dimmed redraw, matches player's gap |
| 279 | LIVE-H82-05 | T | The Forge latency, owner's perception (b-f K/S) |
| 280 | LIVE-H82-06 | T | The Forge latency, owner's judgement |
| 281 | LIVE-E19-06 | K | set useExternalAV true, read reverts false; no Join window; A/V Config fields disabled (actual connect T) |
| 282 | LIVE-E19-07 | T | real LiveKit audio (others heard); settings part K |
| 283 | LIVE-E19-01 | T | real LiveKit server restart/network drop |
| 284 | LIVE-E19-02 | K | Music 0.6, room music, incident, reload; read volume, murder track after click, restore; musicDuckedFrom |
| 285 | LIVE-E19-03 | K | incident: read murder sound channel/volume, room pause/0, 404 path return/throw, F5 before click |
| 286 | LIVE-E19-04 | T | real LiveKit audio |
| 287 | LIVE-E19-05 | T | real LiveKit audio, three players |
| 288 | LIVE-E19-08 | T | real LiveKit server |
| 289 | LIVE-E19-09 | T | Proximity Voice Chat plus real audio |
| 290 | LIVE-E19-10 | S | corner/notice tile above camera dock edge; dock hidden, lift 0 when on (dock may need LiveKit) |
| 291 | LIVE-E18-04 | K | Seed long chat; ui.chat.updateMessage(contents[0]); read #chat-log li order/duplicates; fresh player page with private cards; GM delete within 4s |
| 292 | LIVE-E18-03 | S | K+S: elementFromPoint/heights measurable; shot of card bar VT323 title, both themes, 1366x768/393x852 |
| 293 | LIVE-E18-01 | K | GM+2 players pages (one timezoneId shifted): Call/dynamic/project cards, 5-min expiry text, Hope count, GM-absent refusal, co-owner/observer reads |
| 294 | LIVE-E18-02 | K | Gamemaster+Assistant GM accounts; reload G1 mid-ask, close G1; count cards, rulings; log userConnected vs bridge.gmReady order |
| 295 | LIVE-E35-01 | K | Give 1 of 3 Candy A->B twice; read both inventories, sheet render count, game.drpg.sheetWrites() unchanged |
| 296 | LIVE-E35-02 | K | Plant into full pockets noticed/unnoticed; read A message, B whispers/notifications/sound hooks/renders; Gear plant count |
| 297 | LIVE-E14-02 | K | Give across rooms, Trial/Eclipse refusals, stashed key at door, stash search twice, Palm click-to-card ms, dead sheet buttons |
| 298 | LIVE-E14-01 | S | K+S: Search/table names scriptable; shots of item-table, Create item, Give, Room pools within 768px |
| 299 | LIVE-E36-01 | K | Two GM pages: concurrent Project Manager save and tray +, then Work; read final bar/name, completion cards; F5 primary timing |
| 300 | LIVE-E36-02 | K | Countdowns tray -/+ on project row, context menu items, player click, menu after reload; on DH 2.12.9 not 2.10.5 |
| 301 | LIVE-E15-01 | K | Propose indirect murder, approve trigger, Work/Contribution rolls, real Playwright mouse drag of B's token; log cards per user |
| 302 | LIVE-E15-02 | K | GM+3 players: public/secret breach cards and play-sound hooks, wall passage/audit bounce, close breach _stats, proposal dialogs both languages |
| 303 | LIVE-E15-03 | K | Propose Secret Passage, GM picks wall segment by canvas mouse clicks, Work completes, Reroll undo; read passages per player |
| 304 | LIVE-E16-05 | S | "Which statistic?" label above full-width select showing "Hand (+1)"; greyed Rest tile/dialog, both themes |
| 305 | LIVE-E16-06 | F | Loaded Die/dice-method part K (DH 2.12.9); needs pre-1.2.50 Observe card world |
| 306 | LIVE-E17-06 | S | K+S: whyBlack() K; frame screenshots during fog dissolve and mid-transition scene switch show no leak |
| 307 | LIVE-E17-01 | T | K+T: pause/reload/hour gap scriptable; table judges whether 5-min take-back fits |
| 308 | LIVE-E17-02 | K | Cross boundary by pixels, GM Refund last crossing twice, across time advance; CDP-throttled player link; read action budget/token position |
| 309 | LIVE-E17-03 | K | Build two-level v14 scene; player console moves token to locked upper-floor room; read bounce x/y/elevation/level in one update |
| 310 | LIVE-E17-04 | K | Incident participant drags out, directory drop into closed room, bystander reload HUD clock, Eclipse during combat; read bounces/messages |
| 311 | LIVE-E17-05 | K | GM+Assistant GM+3 players concurrent Despair pips, bar, Feed the Overflow, token moves in Eclipse; compare final pools to click sums |
| 312 | LIVE-E17-07 | K | Open A-B murder, advance clock twice, reload bystander C; read C HUD/Motive card, Motive due card counts, closing card |
| 313 | LIVE-E17-08 | K | Apply Mastermind, public project in unvisited room; read Mastermind player's map token, tray row, GM Known by, passage card names |
| 314 | LIVE-E17-09 | S | Player status bar rows in Night Eclipse/Eclipse/Monocub/dead inside column, both themes/languages, 1366x768 |
| 315 | LIVE-E17-10 | F | Chapter-end rest part K; needs world with rest taken pre-update |
| 316 | LIVE-E17-11 | K | Player console timestamps updateSetting vs SYNC.clock receipt during time advance and Despair pip series; localhost latency only |
| 317 | LIVE-H84-01 | K | GM reload then immediate Apply/give key; two GMs during sweep; rename bedroom; thief; seeded double keys; count Room Keys |
| 318 | LIVE-H84-02 | K | Observe twice while GM describe dialog open, re-declare Observe, Focus gaze, second player; count Truth Bullets per character |
| 319 | LIVE-H84-03 | T | Needs LiveKit server for connected voice tile state |
| 320 | LIVE-H84-04 | S | Project tray row -/+, hidden-eye, loop arrows show Font Awesome glyphs, both themes, 1920x1080 |
| 321 | LIVE-H84-05 | F | Proposer visibility part K; needs owner's world project approved pre-1.2.88 |
| 322 | LIVE-H84-06 | S | Clear overflow button visible inside Despair Flow window, both themes, 1366x768/1920x1080 |
| 323 | LIVE-E88-01 | T | K+T: restore/refusal scriptable; real GPU frame rates on table machines |
| 324 | LIVE-E88-05 | K | counters reset; other player steps, drags two squares, GM hide/unhide; read refreshToken.* on GM and player pages |
| 325 | LIVE-E88-02 | S | K+S: counters K; same-frame ring/room-outline glow shots on 1.2.88 vs current, blur on/off |
| 326 | LIVE-E88-03 | T | Needs real LiveKit server and audio drops |
| 327 | LIVE-E88-04 | T | Real GPU frame counts on GM/weakest player machines |
| 328 | LIVE-E88-06 | T | S+T: owner judges whether stepped fog drift looks jerky |
| 329 | LIVE-E88-07 | K | counters reset; GM Despair pip/Reroll; read clock.refreshSheets.rendered on player, Monokuma sheet value, minimized sheet restore |
| 330 | LIVE-E88-08 | S | Same-phase glass pulse shots before/after E88 C5, incl. Objection and pending Call seams |
| 331 | LIVE-E70-01 | T | K+S+T: layout/held click scriptable; table judges readability of unstyled console lines |
| 332 | LIVE-E70-04 | T | Needs real LiveKit, microphone broadcasting |
| 333 | LIVE-E70-05 | K | Player console game.user.update({"permissions.BROADCAST_AUDIO":true}); read server rejection message and user permissions |
| 334 | LIVE-E70-02 | K | 2 GMs+3 players: Objection then Overrule (primary/second); read debate time, cost, chat stamp, OBJECTION window closed on all pages |
| 335 | LIVE-E70-03 | T | Real background-tab timer throttling of primary GM browser |
| 336 | LIVE-E70-06 | K | Create/link courtroom scene; guilty verdict, End the trial to room; read death overlay order, EXECUTION card, private note, tokens moved |
| 337 | LIVE-E70-07 | T | 14-15 real people's Testimony round timing |
| 338 | LIVE-E70-08 | T | Real background-tab throttling across Panic Round turns |
| 339 | LIVE-E70-09 | T | K+T: flow scriptable; real players' understanding of HUD |
| 340 | LIVE-E70-10 | K | Reveal Key Remnant, press real Enter (Cancel default), then button; count copies per participant, sound hook, pending counter |
| 341 | LIVE-E70-11 | T | K+T: copies/Present scriptable; players' understanding of copy whisper |
| 342 | LIVE-E70-12 | T | Needs LiveKit server and speaking audio ("ma głos") |
| 343 | LIVE-E89-02 | K | Playwright 5s drag on tokenVision:false scene; counters reset/read on dragger, other player, GM: refreshToken.visibility, sightRefresh etc |
| 344 | LIVE-E89-03 | K | Hook updateToken logging movement.pending.waypoints.length; drag path with two waypoints; read on dragger and watchers |
| 345 | LIVE-E89-04 | T | Real GPU rendering of Stained Glass tile edges |
| 346 | LIVE-E89-01 | T | Real GPU frame times during drag, 1.2.90 vs 1.2.91 |
| 347 | LIVE-E89-05 | F | Bedroom stash path K; needs owner's world first 1.2.91 load |
| 348 | LIVE-E90-01 | T | The Forge server restart, owner's world data, two machines' clocks |
| 349 | LIVE-E50-01 | K | openMessenger(id); compare ui.activeWindow to instance after open, click window, other window, canvas |
| 350 | LIVE-E50-02 | K | Player opens second tab/bringToFront to hide page; GM writes; read visibilityState, unread counter, read state after return |
| 351 | LIVE-E50-06 | K | Rects of GM roster list vs voice tile/portrait, z-index; open unpositioned thread window, read position (if tile renders sans LiveKit) |
| 352 | LIVE-E50-03 | K | Set module Music 50; read core globalPlaylistVolume and Foundry slider; move Foundry slider, reopen Sound window, compare |
| 353 | LIVE-E50-04 | K | Second GM changes state playlist; time playing-sound change on all pages; concurrent row edits; close primary within 2s |
| 354 | LIVE-E50-05 | K | Multi-track murder playlist; read playing sound per page (killer, victim, GMs, bystander); victim slider, volume/room music after |
| 355 | LIVE-E51-01 | K | Observe in empty room, Palm, Finishing blow; read DH roll dialog titles and card text, both languages |
| 356 | LIVE-E51-02 | S | Planned-path ruler colour shots before/after GM advances time of day |
| 357 | LIVE-E51-03 | F | Needs owner's map with diagonal room boundaries |
| 358 | LIVE-E51-04 | F | Needs owner's world where token doubling occurred |
| 359 | LIVE-E51-05 | K | Region Display Scrolling Text; wrap createScrollingText, log calls/stack for region vs damage, hidden token; Firefox needs Playwright Firefox |
| 360 | LIVE-E51-06 | K | Drive each flow-length.json flow with DSN; count clicks and rendered windows via hooks; compare to file rows |
| 361 | LIVE-E65-01 | K | Set module Language Polish, reload GM; game.drpg.runTests(); read R1060 and R972 log lines |
| 362 | LIVE-E66-01 | S | 12 sets: action names inside tiles/buttons, unbroken, both themes/languages/3 sizes |
| 363 | LIVE-E66-02 | K | Module language Polish, Foundry English; read sheet root lang, list remaining English text nodes and their container |
| 364 | LIVE-E37-02 | T | K+T: round mechanics scriptable; real players' duration/"Jeszcze chwila" use |
| 365 | LIVE-E37-01 | K | Run scenario 81-render-budget against sandbox with real sheets; read render counts, visibility.applyAll, token states |
| 366 | LIVE-E37-03 | K | countdownAutomation on; concurrent DH updateCountdowns/Reveal/Hide/Delete/-+ with project +; read progress; diagnosePatches (DH 2.12.9) |
| 367 | LIVE-E37-05 | K | End Eclipse advancing time; on player read counters visibility.applyAll and debug order of SYNC.eclipse vs clock setting |
| 368 | LIVE-E37-06 | K | Ready round, killer opens incident; read bystander window/messages, GM barred line, clock; second advance, day summary per player |
| 369 | LIVE-E41-01 | K | Fresh context, Resource Timing: module file count/size/last load, ready and HUD times, game.drpg.perf(); localhost not owner's network |
| 370 | LIVE-E41-02 | S | K+S: verdict lists K; moved windows look like 1.2.96 (side-by-side shots) |
| 371 | LIVE-E42-02 | K | Close GM page at Level Up/chapter end, reopen; read resume UI, Level Up offers, advancement counts, clock, chat cards |
| 372 | LIVE-E60-05 | T | Owner's table players' own Dice So Nice settings and screens |
| 373 | LIVE-E60-07 | K | Register custom DSN colorset/texture on GM page only; diagnoseDiceLook() on GM vs other page; read missing list |
| 374 | LIVE-E60-08 | S | Player and GM roll windows complete, locked greyed controls, Reaction chip states |
| 375 | LIVE-E60-06 | T | Owner's table on Daggerheart 2.9.x (hope() race) |
| 376 | LIVE-E60-09 | K | DSN show-all; move GM Monokuma token in/out of player room; hook diceSoNiceRollStart per page; two GMs; diagnoseDice() |
| 377 | LIVE-E44-01 | K | copy(JSON.stringify(game.drpg.styleSnapshot())) on GM/player both themes; diff against audit/style-baseline.json |
| 378 | LIVE-E44-02 | K | Playwright mouse down on GM panel tile, trigger world-setting write, mouse up; count tile windows, panel rebuilds |
| 379 | LIVE-E44-03 | K | Fill 150+ history entries; read window/footer rects vs viewport, scroll element, activeElement on open, Close closes |
| 380 | LIVE-E44-04 | T | LiveKit server; owner's visual comparison with 1.2.98 |
| 381 | LIVE-E44-05 | K | Under Legacy click stepper -/+ at bounds, read values/messages; tab rects equal width, same row, wrap |
| 382 | LIVE-E44-06 | T | Owner's judgement whether history text needs change |
| 383 | LIVE-E44-07 | K | Run given AlwaysVisibleContainer probe on GM with selected token; hide container; read clone/project tints |
| 384 | LIVE-E44-20 | K | Propose with description, empty/1000+ blocked, approve/edit, double-click project token, secret project projectMeta/chat per player |
| 385 | LIVE-E44-08 | S | K+S: minimized windows collapse to title bar; no content flash on close |
| 386 | LIVE-E44-09 | K | Press Escape in Room setup and Remnant delete confirm; Enter in text field; read dialog results |
| 387 | LIVE-E21-01 | K | At 4 viewports open each window/tab; footer rects within viewport, scroll container; record setPosition shift after tab click |
| 388 | LIVE-E21-02 | T | Real tablet/phone on-screen keyboard |
| 389 | LIVE-E21-03 | T | Real tablet/phone browsers (Chrome, Safari, Firefox) |
| 390 | LIVE-E22-01 | K | Each irreversible dialog: press Enter in field/window, read result; default button, focus ring, background computed style |
| 391 | LIVE-E22-02 | S | Red only on GM-path rows/irreversible; neutral notes; red warnings, both themes <1224px |
| 392 | LIVE-E21-04 | S | Messenger height follows content, only log scrolls, bubbles unclipped; manual scroll panes |
| 393 | LIVE-E21-05 | S | Level Up pick: Cancel left, Apply right, list scrolls, Polish labels uncut, fits 1366x768 |
| 394 | LIVE-E22-03 | S | Hover/Tab-focus colours on Cancel, default, red/plain rows, both themes |
| 395 | LIVE-E22-04 | S | K+S: Safeword buttons order/Enter K; red button text readable, GM-screen colour |
| 396 | LIVE-E22-05 | S | Legacy selected red row keeps red left edge beside gold frame; active tab colour |
| 397 | LIVE-E22-06 | S | GM Team frame glow/fields/steppers in hour gold, not GM red, 1366x768 |
| 398 | LIVE-E21-06 | K | Run given drpgWindow snippet in GM console, click footer Close, read returned value |
| 399 | LIVE-E21-07 | K | Clear description or pick trait-less project, press Delete, confirm; read whether deleted or form blocked |
| 400 | LIVE-E21-08 | K | rAF-log kit window widths over first frames at scale 120/80%, phone viewport; final room-description width |
| 401 | LIVE-E21-09 | K | Open each listed window at 1366x768/390x844; check footer rects in viewport, extra scrollers, label scrollWidth>clientWidth |
| 402 | LIVE-E23-01 | T | Real GPU frame times, devicePixelRatio, GPU memory |
| 403 | LIVE-E23-02 | K | Read #drpg-hud offsetHeight at silence/start/track change/stop, drpgGlassCut listener, time change; on GM and player |
| 404 | LIVE-E23-03 | S | K+S: board playable under stack, bottom fade, bars/columns placed, 1024x768/820x1180 |
| 405 | LIVE-E23-04 | K | Open sheet, roll/Observe overlapping; click sheet, sheet.render(true); compare z-index; Token Config vs panel; log bring-to-front |
| 406 | LIVE-E23-05 | T | K+T: tilt transform readable; owner confirms 14.10 white bar gone |
| 407 | LIVE-E23-06 | S | GM chat panel above corner buttons, no cut/see-through; collapse animation |
| 408 | LIVE-E23-07 | S | GM #players single line bottom-left: content or empty frame, narrow sizes |
| 409 | LIVE-E23-08 | K | ui.notifications.warn/error; run given parent/position line, ancestor chain, rects vs Projects tray and voice tile |
| 410 | LIVE-E23-09 | K | GM pauses; read clock text, HUD height, drpgGlassCut on all pages; player loads paused world; narrow layout |
| 411 | LIVE-E23-10 | S | K+S: panel size constant; short card and Polish incident meta read well |
| 412 | LIVE-E23-11 | K | emulateMedia reducedMotion reduce; document.getAnimations() under both themes; phase change end state; pause text animation |
| 413 | LIVE-E23-12 | S | Six+ project rows one line, GM -/+ icons and tooltips, bottom fade |
| 414 | LIVE-E24-01 | K | Read token bars vs sheet after hit, Sanity bar visibility per player, HUD inputs disabled, getBarAttribute editable |
| 415 | LIVE-E24-02 | K | Two pages same student, DH dots on/off; after hit compare filled dots, "Zostało" row, system controls hidden |
| 416 | LIVE-E24-03 | K | Party sheet rows per viewer: remaining values, no dot toggles, Sanity visibility; check hook-party-sheet-render fired |
| 417 | LIVE-E24-04 | K | Computed font-family/size/line-height of Przeszłość and .dh-style h4 at slider 80/100/140, both themes, 1080p/1440p |
| 418 | LIVE-E24-05 | K | Player types in Przeszłość, GM changes Hope; read value/selection/focus; close/tab switch writes; open/close writes nothing |
| 419 | LIVE-E24-06 | S | Light Foundry theme client: listed module surfaces render dark, both themes |
| 420 | LIVE-E24-07 | K | Monkeypatch one sheet step to throw; render sheet; read other injections, GM notification count, console error, player nothing |
| 421 | LIVE-E24-08 | K | Open incident; read Health/Sanity on victim sheet/event panel/token, killer panel, GM, bystander |
| 422 | LIVE-E24-09 | K | Icon part superseded by E95-05; combat tracker row B for player A: icon/name Breakdown? (DH 2.12.9) |
| 423 | LIVE-E24-10 | K | Breakdown student public roll; read chat card DOM per viewer for Disadvantage and absence of "Breakdown"; trace whisper cause |
| 424 | LIVE-E45-01 | K | Wrap sheet render to log options.renderContext/renderData; rapid Health writes by owner/GM on 3 pages; no-op write |
| 425 | LIVE-E45-02 | K | GM update with render:false, then sheet.render(false,{renderContext:"updateActor"}); read bar/dots/row; log unknown render options |
| 426 | LIVE-E45-03 | K | Scenario 71 parts A,B,F,H,I on 3 real pages; read renders, values, writes, Level Up button, notifications |
| 427 | LIVE-E45-04 | K | GM gives Monocub 1 Hope then 0; read Confusion tile enabled state, sheet renders, refreshMonocubTiles target exists |
| 428 | LIVE-E24-11 | K | Open Edit/New/Propose project; read description field vs form width px, label above, note below |
| 429 | LIVE-E24-12 | S | Bottom-left #players corner: any visible bar/background, Legacy and Stained Glass |
| 430 | LIVE-E24-13 | K | Hook updateSetting; change DH Automation death icon, kill student, read marker img per page; restore default, kill second |
| 431 | LIVE-E46-01 | S | K+S: + click raises counter by 1, Apply limited to its scene by script; shot: footer on screen on every tab, both themes, 1366/1920 |
| 432 | LIVE-E46-02 | T | K+T: HEAD/warnings locally; The Forge Assets Library part |
| 433 | LIVE-E46-03 | K | Sound>Effects: Choose writes path, Test calls play or gives reason, Clear empties row; read tooltip, Saving/Saved DOM |
| 434 | LIVE-E46-04 | S | K+S: delete-last and Keep-mine info/sidebar by script; shot: table columns fit 1366x768 |
| 435 | LIVE-E46-05 | K | Seed missing resources, uneven pools, broken image; read Season setup row marks, pre-season decode/size lines |
| 436 | LIVE-E46-06 | S | K+S: second GM clears overflow, timing by script; shot: Overflow tables, nothing cut at 1366 |
| 437 | LIVE-E46-07 | S | Polish E46 windows at 1366/1920: no label cut without tooltip |
| 438 | LIVE-E47-01 | S | K+S: Enter/footer height by script; shot: footer per state, tooltip kind, Legacy wrap |
| 439 | LIVE-E47-02 | S | K+S: width/turn rows by script; shot: tracker footer, PL Legacy label wrap |
| 440 | LIVE-E47-03 | S | GM panel tiles in Eclipse: dashed disabled, current mark, centring, SG icon |
| 441 | LIVE-E47-04 | K | Two GM pages: Back up, second GM edits, Restore preview/Cancel/confirm; read counts, stores, seconds to sync |
| 442 | LIVE-E47-05 | S | K+S: no-GM roll, Grant all/none by script; shot: card lines, PL button wrap |
| 443 | LIVE-E47-06 | S | K+S: CSS vars via getComputedStyle; shot: settings labels one line, no Foundry amber |
| 444 | LIVE-E47-07 | S | K+S: frame theme classes by script; shot: tools frames readable, dark/light UI |
| 445 | LIVE-E47-08 | K | GM+p1: role change confirm/Cancel, p1 console flag write reverts, Level Up opens menu, give/take item |
| 446 | LIVE-E47-09 | S | Investigation Legacy tables fit window, no side scroll, header wraps, 1366/1920 |
| 447 | LIVE-E47-10 | S | Polish E47 windows at 1366/1920: no label cut without tooltip |
| 448 | - | C | "Właściciel przyjął całe porównanie 3" |
| 449 | - | C | "Przeniesione do E98" |
| 450 | - | C | "właściciel zatwierdził nowe teksty" |
| 451 | - | C | "Decyzja: mapa sprawy" |
| 452 | LIVE-E47-11 | S | K+S: px widths at 1024 by script; shot: grey disabled buttons, Analyze edge, 390x844 fieldset |
| 453 | LIVE-E95-02 | K | Two-Levels scene: log tile width/height/level fields; Monocub on upper floor, search body from each floor |
| 454 | LIVE-E95-04 | K | Player console: hidden body tile present? Read Take disabled reason, click result, live regrey on tile hide/move |
| 455 | LIVE-E95-01 | S | Body tile image, death mark, EN/PL caption, layers, hidden, fog, single caption |
| 456 | LIVE-E95-03 | K | Hook drpgBodyAnnounced on 2 GMs+2 players; enter room; log writer/waitUntil, reload case, 5 s waitUntil |
| 457 | LIVE-E95-05 | K | Breakdown+Wounded: inspect token effect sprites for 4 roles; read sheet badges, "?" Sanity, HUD/tracker |
| 458 | LIVE-E68-01 | K | Drive Direct Murder proposal, betrayal, trap; read GM card buttons, opening stat, no second window |
| 459 | LIVE-E68-02 | K | Arm Resolve: Hope drops 2, no card; Stage 6 clean-up rolls Shadow, no card/window, no stat flag |
| 460 | LIVE-E68-03 | K | Take from body alone/with witness, forced Hope/Despair misses; read rolls, cards, Remnant visibility; accomplice |
| 461 | LIVE-E68-04 | S | Action windows at 1366, both themes/langs: fit, selected row, Legacy radio |
| 462 | LIVE-E68-05 | K | Install 1.2.103 and 1.2.104; traceClicks scripted Search Eye/Head/Dynamic; read click count, ms to roll |
| 463 | LIVE-E63-01 | S | Body tile under dead token: draw order, caption readable beside death overlay |
| 464 | LIVE-E63-02 | K | Held death, Move the body; player console count bodyOf tiles before discovery (0), after at new spot |
| 465 | LIVE-E63-03 | K | 2 GMs+2 players, trial verdict, End trial from each GM; log tile create/delete, no body tiles left |
| 466 | LIVE-E63-04 | K | Drag corpse token and Stage 6 teleport; count updateTile per move, multiple corpses, Monocub leaves tile |
| 467 | LIVE-E63-05 | K | Seed world on 1.2.104 install, upgrade; read openCaseBodies report, tile, rerun migrate1_2_0 force |
| 468 | LIVE-E49-01 | K | GM panel each phase: tile heights per row, icon color/background at rest/hover/focus/current/disabled |
| 469 | LIVE-E49-02 | K | GM/assistant/player: DRPG Settings button, section lists, reload confirm, requiresReload reloads, Cancel, window rect per section |
| 470 | LIVE-E49-04 | S | Room outline glow colour after hour change, blur width at zoom 0.3/1/3 |
| 471 | LIVE-E49-05 | T | real browser Ctrl+/- zoom in headed Chromium |
| 472 | LIVE-E49-07 | S | Remnant action icons and names visible after scene round-trip, no reload |
| 473 | LIVE-E48-06 | T | real screen readers NVDA/VoiceOver |
| 474 | LIVE-E48-02 | S | K+S: who gets popup, sound once by script; frames: crit cut-in vs normal, reduced motion |
| 475 | LIVE-E93-01 | K | GM + 3 players, room action used; time until row greyed, simultaneous payer refused+refund, Subtle trace |
| 476 | LIVE-E93-02 | K | Project action "1 time of day": read Facilities and Projects line morning, after clock advance, permanent until chapter end |
| 477 | LIVE-E93-03 | S | Facilities window and editors at 1366 and 390px: nothing cut, no side scroll |
| 478 | LIVE-E69-04 | K | Hook drpgCrossingSettled on GM; player crosses room, GM reverts token under 2 s, two-room drag; count events |
| 475 | LIVE-E76-01 | K | Module loads, no console errors; relayGuard().state, runTests tier 2 failed=0 (sandbox DH 2.12.9, not 2.12.8) |
| 476 | LIVE-E76-02 | K | Player rolls save from action card; read card marked once by primary GM, targetSaves, no "Refused" log |
| 477 | LIVE-E76-03 | M | measured |
| 478 | LIVE-E76-04 | K | Player action roll drawn by GM: read seam state, no "not drawn" warning, card, Hope/Calls, Reroll |
| 479 | LIVE-E76-05 | S | Player without saved look: DSN dice show GM's table look, both themes |
| 480 | LIVE-E76-06 | K | Secret passage move; release control mid-drag; read token position not beyond wall, no movement-audit entry |
| 481 | LIVE-E76-07 | K | forceDiceLook on; read both players' dice-so-nice saved flag, roll appearance/no SFX via DSN hook |
| 482 | LIVE-E97-01 | S | Investigation Map/Table each tab: frame stable, two-row footer, labels, edges, Legacy headers |
| 483 | LIVE-E97-02 | K | Realization preview, room pick, Run, player finds one, Undo; read Key Remnant regions, plan, deletions |
| 484 | LIVE-E97-03 | K | Two GMs, both discovery roads; log realization prompt only primary, after muster card, once per chapter |
| 485 | LIVE-E97-04 | K | Two GM pages click Run same second; count Key Remnants created (localhost latency only) |
| 486 | LIVE-E97-05 | K | GM sets trace author; player console scan tokens/items/messages for leftBy/sourceName/sourceActor, card DOM |
| 487 | LIVE-E97-06 | T | screen reader; 60-Remnant redraw feel needs real GPU |
| 488 | LIVE-E99-01 | S | Trial console case schema 1366/1920: camera, min 11px text, footer fits, header |
| 489 | LIVE-E99-04 | K | Assistant GM account: Show summary, Send to all; read card created, "sent" mark in GM store |
| 490 | LIVE-E99-05 | K | Two GM pages mark different findings same second; read both marks on both |
| 491 | LIVE-E73-01 | K | Zone regions with hole and Levels; place tokens; read zone counts, region tokens after moves |
| 492 | LIVE-E73-02 | K | Straw Poll: drag token A to B just before timer; compare live counters each page with GM final count |
| 493 | LIVE-E73-03 | S | Zones drawn like rooms, named; entry outline animation; no token vanishes |
| 494 | LIVE-E73-04 | K | Reload primary GM mid Logic Dive question; read timer continuity, truth absent from world data |
| 495 | LIVE-E73-05 | S | Class Trial console layout B, both states: everything in window, no window scroll |
| 496 | LIVE-E92-01 | T | real LiveKit server, audio in several browsers |
| 497 | LIVE-E92-02 | K | Spectator page drags token through wall/closed door; read final position, actions, room discovery |
| 498 | LIVE-E92-03 | T | real LiveKit server, hearing muted spectator |
| 499 | LIVE-E92-04 | S | Spectator token at 0.3 alpha on light/dark floors, findable, not confusable |
| 500 | LIVE-E61-01 | T | S+T: entry geometry by shot; smoothness needs real GPU |
| 501 | LIVE-E61-08 | T | real voice chat, microphone hotkey |
| 502 | LIVE-E61-06 | S | Isometric two-floor scene: second-floor tokens/walls drawn while player on first |
| 503 | LIVE-E62-01 | T | K/S directions, Esc by script; frame time needs GPU |
| 504 | LIVE-E94-01 | T | K: board durations, mood word, history; frame time needs GPU |
| 505 | LIVE-E94-02 | K | Player reload 2-3 min after morning, again, and 11 min after; record whether day board plays |
| 506 | LIVE-E94-03 | K | Murder with hidden clock; check boards shown only where clock visible, no clock leak to bystanders |
| 507 | LIVE-E64-01 | K | Build Levels/fog route; Move the Body two rooms crit/success, via dormitory; read list headers, landing room |
| 508 | LIVE-E102-01 | S | K+S: disabled-button tooltip presence by script; shot: Foundry tooltip placement, not covering field |
| 509 | LIVE-E106-01 | K | Run given console snippet; hover ids under cursor; Playwright dblclick token/tile/centre, record sheet opening |
| 510 | LIVE-E106-02 | K | Dblclick Monocub token GM/owner; read drpg-monocub-panel, token size/scale/fit/ring vs body token; take shot |
| 511 | LIVE-E105-01 | K | During trial sequence read --z-index-window, window zIndex, elementFromPoint over windows/banner; runTests R5380 |
| 512 | LIVE-E39-01 | M | measured |
| 513 | LIVE-E108-01 | S | K+S: settings choices, roll copy by script; shot: DSN dice colours each screen |
| 514 | LIVE-E73-06 | T | real LiveKit server, who hears whom |
| 515 | LIVE-E73-07 | T | real LiveKit server, room return |
| 516 | LIVE-PV-01 | S | Erased trace ghost faded in place on A's map, after reload; gone on entry |
| 517 | LIVE-PV-02 | K | A leaves project room, B works/sabotages; read A's tray counter, bar, tooltip, ".progress-tag" in DH template |
| 518 | LIVE-PV-03 | K | A leaves, B completes; read project token tint on A, GM, B pages, after reload/move/entry |
| 519 | LIVE-E38-01 | K | Player rolls, primary GM page reloads before return; read rollFlags for one rollId or player message |
| 520 | LIVE-E38-02 | K | Second GM edits Room Setup while primary moves student, changes scene; save; read description, stores, token |
| 521 | LIVE-E38-03 | F | v1.1.0, 1.2.13 and owner's 1.2.56 world copies |
| 522 | LIVE-E38-04 | K | GM+2 players: Testimony, Closing+Objection, Logic Dive, mutedDead with primary GM reload/switch; compare states |
| 523 | LIVE-113R-01 | K | CDP Slow 3G on one player; time canvasReady vs #drpg-sequence removal, sceneTimeout counter, edge cases |
| 524 | LIVE-113R-02 | S | Frame capture hold-to-open: no tile moves; "looks natural" is owner's call |
| 525 | LIVE-E69-03 | T | real LiveKit server, hearing Listen eavesdrop |
| 526 | LIVE-E69-06 | K | Build stairs+tunnel scene; A uses Echoes; read action cost, no roll, card room name, Eclipse strike reason |
| 527 | LIVE-E69-05 | T | K for "?" token/sheet; LiveKit silent channel part needs server |
| 528 | LIVE-E113-01 | K | Hook AudioHelper.play per page; walk students into body room; read sounds, prompts, Not yet/reload, autoplay flag |
| 529 | LIVE-E57-01 | K | Click "?" in each GM window at 1366/820x1180; read handbook section, header offset 8px, window rect unchanged |
| 530 | LIVE-E57-02 | K | Set documentLanguage unlike GM client (E54 shipped); grant item, level-3 text; read description language vs UI |
| 531 | LIVE-E57-03 | T | real tablet browser, on-screen keyboard and toolbar |
| 532 | LIVE-E59-01 | T | auditor/owner D27 screenshot scoring and review |
| 533 | LIVE-R4420-01 | S | CPU throttled 6x; frames of last 500 ms: no dark or jumping frame |
| 534 | LIVE-E43-01 | K | GM+3 players; replay scenario 30 fuzz from player console; read refusal codes, exceptions, prototype keys, writes |
| 535 | LIVE-E43-02 | K | Secret project; bystander reads Countdowns setting, DH Countdowns window/tooltips for name; member sees real name |
| 536 | LIVE-E43-03 | K | Player opens project token card in unknown room, walks in; check card DOM rerenders to project card |
| 537 | LIVE-E40-01 | F | world actually played through a chapter |
| 538 | LIVE-E55-01 | S | Sheet, GM panel, trial HUD, launcher corner match pre-E55 freeze; gear icon |
| 539 | LIVE-E55-02 | K | Open token/scene/tile config; querySelector classes, computed max-height 88vh, scroll; journal/foreign item sheet heights |
| 540 | LIVE-E55-03 | K | Pixel font on; getComputedStyle(i.fa-solid).fontFamily, document.fonts.check for Font Awesome |
| 541 | LIVE-E55-04 | K | GM and player: querySelector each of 12 ids with chat popout and perf stats on |
| 542 | LIVE-E110-01 | T | real LiveKit server, hearing muted players |
| 543 | LIVE-E110-02 | T | 6+ real players with voice, table's judgement |
| 544 | LIVE-E110-03 | K | GM redirects running Objection/Rebuttal; player page reads table card, changed row, HUD target, timer continuity |
| 545 | LIVE-E110-04 | K | Two GMs, playlists per mode/phase; read playing playlists/sounds, single start, handover to Discussion |
| 546 | LIVE-E110-05 | K | Assign four SFX; Eclipse start/end with hour change; log AudioHelper.play timestamps on player |
| 547 | LIVE-OWN115-01 | K | Hope opening murder; victim/bystander read token name/img/ring, combat cards, DSN colours, DH header, Listen "?" |
| 548 | LIVE-OWN115-02 | S | Isometric scene: character drawn above Remnant/project token from every approach |
| 549 | LIVE-E111-01 | T | K+T: local file/browse by script; The Forge/S3 host part |
| 550 | LIVE-E111-02 | K | Logged-out context fetches backup URL; player FilePicker.browse refusal; fetch folder URL for listing |
| 551 | LIVE-E111-03 | K | Two separate browser contexts as two computers; plan on one, open other; read planner, notice, health row |
| 552 | LIVE-OWN115-03 | S | Events panel during murder: no scrollbar, collapsed cards, nothing covered |
| 553 | LIVE-E112-01 | T | K/S for veil token; mic/hearing needs real LiveKit server |
| 554 | LIVE-E112-02 | T | The Forge with owner's voice server |
| 555 | LIVE-E112-03 | T | K on v14; The Forge part |
| 556 | LIVE-E112-04 | T | K/S on v14; The Forge part |
| 557 | LIVE-E112-05 | S | Token Silhouette on: no hidden-token silhouette frame behind occluding tile |
| 558 | LIVE-E116-01 | K | GM console: getOwnPropertyDescriptor "visible" up CONFIG.Token.rulerClass prototypes; children hidden at ruler.visible=false |
| 559 | LIVE-E116-02 | K | GM hides and drags token with waypoints; player page reads ruler visibility, planned-movement messages received |
| 560 | LIVE-E116-03 | K | Owner player of hidden token: read token visible, ruler path/waypoints/label; other player sees neither |
| 561 | LIVE-E53-01 | T | real GPU laptop, weakest player's browser |
