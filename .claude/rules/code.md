---
paths:
  - "scripts/**/*.mjs"
  - "styles/**/*.css"
  - "lang/*.json"
  - "tools/moved-only.mjs"
  - "audit/glass-harness.html"
  - "audit/glass-sweep.mjs"
---

# Code: where it lives and what bites (moved from CLAUDE.md)

## Where the code lives

From 1.2.70 the largest files are split by pure moves (D23 option 1: E34, then E41 and
E54), and each old file stays as a **facade**: it keeps its name and every name it
exported, through `export { ... } from "./new.mjs"`, and exports nothing new.

- Importers outside a family keep importing the facade.
- A new file never imports its facade; a name one new file needs from another is
  exported there and imported directly.
- The facade keeps only the code no new file calls.
- New code goes into the family file of its role, never into a facade that holds none.

A move commit runs `node tools/moved-only.mjs HEAD~1`, green on every part (what each
checks is in its header; a shrunk cut is listed only where SHRINK_LISTED names its file,
its function and both lengths, as read by hand - C7a's retireOpeningNotices, 279 -> 252 -
and red otherwise), and adds its new files' rows here. Tier 0's read of every function of
character.mjs is a cut route the tool does not count: a wave that moves one counts it first.

| File | What lives there | Its facade |
| --- | --- | --- |
| `scripts/murder.mjs` | no code: three `export { ... } from` lines, the 67 names it exported at 1.2.69 (33 from the store, 31 from the rules, 3 from the window). New incident code goes into the file of its role below, never here | itself (the family's top) |
| `scripts/incident-store.mjs` | the incident's record: the world half and the cast, each participant's stamped copy and the socket that keeps it in step, the queue and the one write of both halves, who is in it, the betrayal window that write arms, the opening's notices, the deaths a player may know and their socket, the Blackened register, and the cast put back by hand or lifted out of world data | `murder.mjs` |
| `scripts/murder-rules.mjs` | the rules of a murder: the crisis table and the turn, the opening rolls and their invitation, a crisis action judged, resolved and undone, the weapon it swings, running out, a third party, the close and the betrayal | `murder.mjs` |
| `scripts/murder-ui.mjs` | the murder window a GM opens an incident from, and the GM's tracker: its body, its footer and the rate-limited "ask again" for the opening roll | `murder.mjs` |
| `scripts/fog.mjs` | what reads the layer's state: registration and Foundry's vision standing down, the discovery ledger and its socket, the layer, the dissolve, the raster and its drift, the animation switch (`fogAnimations`) and every reader of it, the moment of discovery, and the reports on the live layer (`diagnoseFog`, `whyBlack`, `fogPeek`, `doorwayReport`); 53 names of its own, 5 re-exported | itself (the family's top) |
| `scripts/fog-geometry.mjs` | the fog's pure shape math: a region's shape in the layer's space, polylines, distances, inside-polygon tests, areas; no imports, no state | `fog.mjs` |
| `scripts/fog-doorways.mjs` | the doorways: the wall test, the openings, the glow and its falloff, the outline with its gaps, the seam colour and `MAX_FOG_TEXTURE` | `fog.mjs` |
| `scripts/fog-reveal.mjs` | the reveal's timing and drawing, and the room's outline and name: drawn, faded, held at one weight through a zoom, recoloured with the hour; `clearTransient` with the layer's finder | `fog.mjs` |
| `scripts/fog-diagnostics.mjs` | the map's checks (`checkRegions`), `whatIsHere` with its probes, and how much of a scene belongs to no room (`sceneUncoveredPercent`); no state | `fog.mjs` |
| `scripts/projects.mjs` | the project actions: the queries over `allProjects`, progress, creation, sabotage and its undo, the announcements, editing, `sealOldRepairs`, and `resealSecretProjects` and `knowsProject` (they read `allProjects` and `roomOf`); 49 names of its own, 16 re-exported | itself (the family's top) |
| `scripts/projects-secrecy.mjs` | a project's secret fields, who may see it and its ownership map, and the reads and writes of the project meta and the countdowns | `projects.mjs` |
| `scripts/projects-ui.mjs` | the countdown tray's render hook (`onRenderCountdowns`, which opens the manager), the project manager, the project dialog and sharing; 8 names of its own, 2 re-exported | itself (the family's top) |
| `scripts/projects-tray.mjs` | what the countdown tray draws on every render (Icon Only left, raw keys, undiscovered rows, a player's tray shown before the first project, progress, the fold) and its redraw | `projects-ui.mjs` |
| `scripts/call-effects.mjs` | the Calls' core: the shield and the situational dice, the armed Calls, the Confusions' store, copy and socket, the effects and `applyCall`; 33 names of its own, 12 re-exported | itself (the family's top) |
| `scripts/call-pickers.mjs` | the windows a Call opens to ask what it is pointed at (`pickTarget` and its pickers) | `call-effects.mjs` |
| `scripts/call-world.mjs` | sealed rooms, the silence and the chain, and the called assembly: their readers and writers | `call-effects.mjs` |
| `scripts/action-rolls.mjs` | the action family's facade (E41 C3, C4): `performAction` and its dispatch (`THROWS_NO_DICE`, `NEEDS_OWN_BRIEFING`) and `currentRoom` (movement.mjs `roomOfActor` under that name); 2 names of its own, 62 re-exported (24 from action-pipeline.mjs, 13 from action-search.mjs, 9 from action-project.mjs, 4 from action-dynamic.mjs, 3 from palm.mjs, 2 each from action-report.mjs, action-briefing.mjs and action-analyze.mjs, 1 each from action-menus.mjs, action-observe.mjs and action-listen.mjs). New action code goes into the file of its role below, never here | itself (the family's top) |
| `scripts/action-pipeline.mjs` | an action's roll and what is kept of it (E41 C3): `rollTrait`, `throwDice` and the marks on its config, `toolRelief`, `neededNote`, the roll this browser holds and tells the GMs of (its bookmarks, claims and facts), the GMs' Reroll bookmark, `dualityOf`, `commitResources`, an action's price and its refund (`canAfford`, `abort`, `spentAfterRoll`), and the buttons of a card a GM rules on (`roomAudience`, `declineAction`, `ruledMissAction`, `missAction`, `gmRulingActions`); 31 names exported, 24 of them re-exported | `action-rolls.mjs` |
| `scripts/action-report.mjs` | the card an action's roll ends on (E41 C3): `report`, `rollHead`, `rollCardFlags`, `rollTone`, the duality bar, the dice's settle and the card named on the GMs' bookmark (`nameReportCard`) | `action-rolls.mjs` |
| `scripts/action-briefing.mjs` | the briefing an action opens with (E41 C3): `briefingBlock`, `briefingFacts` with the Move's line (`moveLine`), the ladders and thresholds, Move's own briefing window (`briefing`) and Tamper's erase ladder (`tamperThresholdFacts`) | `action-rolls.mjs` |
| `scripts/action-menus.mjs` | the windows an action asks its question in (E41 C3): `chooseVariant` and its confirm label, the statistic picker, the request box (`requestFieldHtml`, `readRequestField`) and a parked declaration's sentence (`promptForNote`) | `action-rolls.mjs` |
| `scripts/action-search.mjs` | the Search (E41 C4): its window (`chooseSearchCategory`) and `performSearch`, the stash it rifles first and the stash's die (`stashToSearch`, `stashStep` ...), its odds and tier (`searchOdds`, `searchTier`), its four ends (`searchNothing`, `searchStash`, `searchSpecific`, `searchUnclaimed`) and the tell a trap hears (`searchTold`), the draw and the item granted (`searchDraw`, `findOf`, `grantDrawn`) and its trace (`traceTheFind`, `leaveSearchTrace`); 14 names exported, 13 of them re-exported | `action-rolls.mjs` |
| `scripts/action-project.mjs` | Work on Project and Sabotage, in one file because `performProject` calls `performSabotage`, which calls the project picker (E41 C4): `performProject`, `startProject` with `GM_ROUTE_CLASS`, `workOnProject`, the progress and the extras it is held to, an indirect murder's concealment and traces (`hideProjectTraces`), the picker (`chooseProject`); `performSabotage`, its targets, concealment, bar, hit, repair (`sabotageRepairScale`), trace and sound; 11 names exported, 9 of them re-exported | `action-rolls.mjs` |
| `scripts/action-tamper.mjs` | Tamper (E41 C4): its menu (`chooseTamper`), the choice carried out by cleanup.mjs (`runTamperChoice`) and `performTamper` | `action-rolls.mjs` |
| `scripts/palm.mjs` | Palm, the player's half (E41 C4): the parts its windows are named by (`PALM_PARTS`, `palmTitle`), its window with the Frisk's modes (`choosePalm`), `performPalm` - a forced Frisk is frisk.mjs's `performFrisk`, reached by `import()`; frisk.mjs stays a file of its own (A11, R1230) - a plant resolved, and what can be taken or slipped and its picker; and the GM's half, out of vault.mjs (E41 C6): the pockets as the GMs hold them (`pocketsAsHeld`, `pocketsFrom`), what a victim is told (`tellPalmVictim`), and `stealFromPerson` and `plantOnPerson`, the GM's side of a steal and a plant; 8 names exported, 3 re-exported by action-rolls.mjs and 4 by vault.mjs | `action-rolls.mjs`, `vault.mjs` |
| `scripts/action-observe.mjs` | Observe (E41 C4): `performObserve`, the declaration (`askDeclaration`, `observeModeLine`), its readings and the card a GM rules on (`ruleObserve`) | `action-rolls.mjs` |
| `scripts/action-analyze.mjs` | Analyze (E41 C4): its one Class Trial filter (`ANALYZE_TRIAL_FILTER`, `analyzeRowShut`), each row's request (`ANALYZE_ROW_REQUEST`, the `passage` row among them), `performAnalyze` and its picker, a Truth Bullet, a hint, a stash (`locateStash`) and a passage (`locatePassage`, A10) | `action-rolls.mjs` |
| `scripts/action-listen.mjs` | Listen (E41 C4): `performListen` and the names it gives the rooms next door (`listenLabels`) | `action-rolls.mjs` |
| `scripts/action-rest.mjs` | Rest's window (E41 C4): `performRest`; the rest itself is rest.mjs's | `action-rolls.mjs` |
| `scripts/action-murder.mjs` | Direct Murder (E41 C4): the fight's menu (`openCrisisMenu`, `crisisDetails`), the betrayal (`performBetrayal`) and the declaration in an Eclipse (`performDirectMurder`) | `action-rolls.mjs` |
| `scripts/action-dynamic.mjs` | the Dynamic action (E41 C4): `dynamicDef`, `performDynamic`, the GM's window and its number (`askDynamicDifficulty`, `dynamicBar`), and the GMs' card a success offers and a Reroll ends (`offerDynamicFind`, `withdrawDynamicFind`) | `action-rolls.mjs` |
| `scripts/gm-bridge.mjs` | the bridge's facade (E41 C5, C5a, C5b): the GM -> player wire and the registration - `registerGmBridge` with its five `game.socket.on` (`onSocket` among them; R1b pins them), the opening roll asked and withdrawn (`askOpeningRoll`, `cancelOpeningRoll`) with their listeners, the Level Up offers' and a GM's ready listener; 3 names of its own, 86 re-exported (72 from bridge-asks.mjs, 10 from call-gm.mjs, 1 each from bridge-guards.mjs, bridge-runs-acts.mjs, bridge-runs-records.mjs and bridge-table.mjs). New bridge code goes into the file of its role below, never here | itself (the family's top) |
| `scripts/call-gm.mjs` | the GM's cards (E41 C5): `callGm` with its card (`callCardHtml`, `expiresHtml`, `CALL_GM_WHAT`) and its thread, the claims on a card (`claimOnPrimary`) and its settle (`settleCall`), the request window (`askForRequest`, `promptForRequest`, `promptAndCallGm`), and the ask-by-card machinery that asks nothing of the bridge's table: the asks the primary holds and their cards, a card ended at its time (`sweepAskCards`), the cards of a Call, a Dynamic action, a trait ruling and an Observe (`askObserveByCard` ...), a ruling kept, received or expired on the primary, and the ask cards' four primary-side senders (C5a: `observePickOnPrimary`, `yesOnPrimary`, `dynamicOnPrimary`, `sendOnFromPrimary`); 28 names exported, 10 of them re-exported | `gm-bridge.mjs` |
| `scripts/bridge-wire.mjs` | the bridge's wire names (E41 C5a): the module's socket name (`SOCKET_EVENT`) and every `ACTION_` constant with its comment, each exported; a leaf importing config.mjs's `MODULE_ID` alone - beside the table they would make table -> run -> table a cycle | `gm-bridge.mjs` |
| `scripts/bridge-runs-acts.mjs` | the runs of BRIDGE_ACTIONS that carry out what a student does (E41 C5a), with their derives: Observe, Analyze, the cleanable traces, the Level Up and its offers (`sendOffersTo`), a handover, the passages, the stashes, Plant, Steal, Frisk and Palm with their rolls (`friskRolls`, `palmRolls` ...), the opening result, the crisis, the park, the betrayal, the clean-up, a Monocub's ability, the rulings asked by card; `sendOffersTo` re-exported | `gm-bridge.mjs` |
| `scripts/bridge-runs-records.mjs` | the runs of BRIDGE_ACTIONS that write a record the GMs keep (E41 C5a), with their derives: a project's progress, share, sabotage, change, undo and send-back, the Remnants (`traceBandOf`, `dynamicRulingOf`), the loot, the Calls armed (`armPaidByPlayer` with its jobs' callees), the Overflow, Despair, an Eclipse move, notes, bookmarks, the Reroll, the audit's decision, the Keys' fee, the trial's record, floor, vote, Objection, turn, claim and Present, the readiness round, the reshape ruling, the observe pick, a card's claim and post; `dynamicRulingOf` re-exported | `gm-bridge.mjs` |
| `scripts/bridge-table.mjs` | the bridge's table (E41 C5b): BRIDGE_ACTIONS with the two helpers its declarations call (`handover`, `hardestRepair`), the primary's listener `onSocket` (`judge(BRIDGE_ACTIONS, payload, senderId)`; the one bridge file that imports `judge`, R1b) and `ask`, the one road every request takes; BRIDGE_ACTIONS re-exported | `gm-bridge.mjs` |
| `scripts/bridge-asks.mjs` | asking the GM (E41 C5b): every `requestX`, in gm-bridge.mjs's order, and the asks a card or a GM's window makes through `ask` (`sendDespairToPrimary`, `askObservePick`, `answerTraitRuling`, `answerHopeCall`, `askReshapeRuling`, `answerDynamic`, `askCardClaim`, `claimCard`); every name it exported re-exported | `gm-bridge.mjs` |
| `scripts/vault.mjs` | no code: four `export { ... } from` lines, the 73 names it exported at E41's base (51 from the store, 13 from the reach, 5 from Room Setup, 4 from palm.mjs). New stash or room code goes into the file of its role below, never here | itself (the family's top) |
| `scripts/vault-store.mjs` | the stash's record and the rooms' flags (E41 C6): `VAULT_FLAGS` and the bedroom keys (`KEY_FLAG`, `keysHeldBy`, `mayEnterBedroom`, `grantBedroomKey`, `reconcileBedroomKeys` ...), a room's table, description, picture and favours (`safeRoomImage`, `roomImage` ...), `regionsByName` and the one write of a room's region flags (`updateRoom`), whose bedroom and which stashes a room holds, their gaps, concealment and lock (`vaultOwnerOf`, `stashesIn`, `setStash`, `ensureBedroomStash`, `bedroomStashGaps`, `startLocked` ...), the bedrooms and the room census (`roomCensusOf`, `roomRatioLine`, `roomsWantedFor`), `setVaultRoom`, a room's pieces and a rename's split (`registerRoomPieces`, `clearSplitPiece`), the marks of a stash found (`foundKey`, `hasFoundStash`); 53 names exported, 51 of them re-exported. fog.mjs and fog-diagnostics.mjs import it directly, not vault.mjs: the facade's re-export of palm.mjs reaches fog.mjs (palm.mjs -> action-briefing.mjs -> projects.mjs -> fog.mjs), so through it they close a static import cycle (R161 red at E41 C6) - the one exception to the facade rule's importers, below | `vault.mjs` |
| `scripts/stash-reach.mjs` | what a character does at a stash and a GM judges of it (E41 C6): `myStashHere`, `atOwnVault`, `stow`, `retrieve` and their refusals (`tellNotHere`, `refuseTheDead`), the stashes open here (`openStashesHere`, `openStashHere`), the rifle (`rifleStashDialog`, `rifleKey`, `rifleMark`) and the GM's side of a theft from a stash (`stealFromVault`), a Find Stash scored on a GM (`resolveStashSearch`), the GMs' inspector (`openVaultInspector`); every name it exports re-exported | `vault.mjs` |
| `scripts/room-setup.mjs` | Room Setup (E41 C6): `openRoomSetupDialog`, its tabs (`ROOM_SETUP_TABS`, `roomSetupTab`: the Passages tab's row among them, drawn by passages-tab.mjs, reached by `import()` - a file of its own, A10), its columns, cells and stash matrix, the form read back and wired (`readRoomSetupForm`, `wireRoomRatio` ...), what Apply refuses on (`setApplyBlock`, `bedroomClaimedTwice` ...) and Apply's writes (`applyRoomRows`, `applyStashMatrix`, `seedOwnerStashes`) through vault-store.mjs; every name it exports re-exported | `vault.mjs` |
| `scripts/gm-panel.mjs` | the GM panel (E41 C7a's facade): its registration and chrome (`registerGmPanel`, `registerGmChrome`), the launcher (`injectLauncher`), `openGmPanel` and its sections, the next step (`nextStep`, `nextLineHtml`), `seasonUnderway` and the public roll's window (`openPublicRollDialog`); 8 names of its own, 4 re-exported (2 from gm-students.mjs, 2 from gm-campaign.mjs) | itself (the family's top) |
| `scripts/gm-students.mjs` | the Students window (E41 C7a): the table rebuilt in place while the window stands open (`aliveTableHtml`) with a row's Refund last crossing (`refundButton`), the row buttons that close the window, run a procedure and bring it back as one promise (`wireAliveRow`), the donation's wiring (`wireAliveTable`), `openWhoIsAliveDialog` and what its Apply writes (`applyAliveStates`, last, so a cut of it runs to the file's end: R66, R67); every name it exports re-exported | `gm-panel.mjs` |
| `scripts/gm-campaign.mjs` | Edit campaign (E41 C7a): `openClockDialog`, the question it asks before a field that does more than correct (`confirmCorrection`) and whether a change of the time of day or the session is a correction rather than the hour passing (`correctsTheHour`); every name it exports re-exported | `gm-panel.mjs` |
| `scripts/hud.mjs` | the clock's widget (E41 C7b's facade): `registerHud`, `renderHud`, its rows and controls (`trialSlot`, `objectionOnHud`, `objectionControl`, `matchStripToDespair`, `stillTokenBars`), `viewerActor` and `HUD_ID`; 9 names of its own, 9 re-exported from hud-elapsed.mjs; 1560 lines, read as about 1500 (wave 2's paragraph, below) | itself (the family's top) |
| `scripts/hud-elapsed.mjs` | the HUD's stopwatch and the clock it shows (E41 C7b): a pause and the primary's ready settled (`settleElapsedPause`, `unpausePatch`, `readyPatch`, `settleClockAtReady`, `restartedAt`), the primary's beat (`beatClock`, `CLOCK_BEAT_MS`), the clock a bystander's HUD shows while an incident hides it (`shownClock`, `lastPublicClock`, `clockForDisplay`: `paintElapsed` reads it, so it came with the stopwatch), the line's marks, timer, build, stop, reading and paint (`buildElapsed`, `stopElapsed`, `setText`, `elapsedOf`, `showsStopwatch`, `paintElapsed`); 12 names exported, 9 of them re-exported | `hud.mjs` |
| `scripts/tables.mjs` | no code: two `export { ... } from` lines, the 32 names it exported once E41 C1c had added `DRAW_STEPS` to the base's 31 (28 from the pools, 4 from the editor). New item-table code goes into the file of its role below, never here | itself (the family's top) |
| `scripts/tables-pools.mjs` | the item tables' names and pools (E41 C8): a table's name and every name it has carried (`tableName`, `LEGACY_PLURALS`, `LOCALIZED_PLURALS`, `LEGACY_GOAL_LABELS`, `tableNameCandidates`, `classifyTableName`, `refreshTableCopy`; tools/check.mjs part `text` reads T14's two legacy lists here), the tier pools and a room's tables (`isTierPool`, `tierPoolOf`, `poolShapeOf`, `poolNameRefusal`, `roomStockTables` ...), the built-in pools and what a usable mends (`ITEM_POOLS`, `USABLE_GOALS`, `usableKindFor`), an item's roles (`POOL_ROLES`, `rolesForPoolItem`, `rolesOfResult`), the draw (`DRAW_STEPS`, `resultFrom`, `drawItem`, `tableForRoom`), the tables the editor lists (`moduleTables`) and the index of every entry's name (`tableIndex`, `classifyEntryName`); 36 names exported, 28 of them re-exported | `tables.mjs` |
| `scripts/tables-editor.mjs` | Install and the item tables window (E41 C8), one file because they call each other - Install ends on the sidebar's tables tab (`openTablesTab`), the window's Install button runs `installTables`: `installTables` with `tableJobs`, `openItemTables`, a table's rows and a result added, edited, dropped or placed (`tableRowHtml`, `addResult`, `editResult`, `dropResult`, `placeResultDialog`), a pool's pane and its heading (`poolPaneHtml`, `wirePaneHeading`, `wirePaneRows`), a table named or created (`promptForTableName`, `createPoolFrom`) and the new item's form with its picture (`newItemPaneHtml`, `wireItemPicture`, `addItemFrom`); about 1670 lines, over the stage's 1500 (the owner's Q-E41-1); every name it exports re-exported | `tables.mjs` |
| `scripts/music.mjs` | the music's facade (E41 C9a): `nowPlayingHere` and `diagnoseMusic`; 2 names of its own, 24 re-exported (8 from music-states.mjs, 7 from music-play.mjs, 7 from murder-music.mjs, 2 from sound-panel.mjs) | itself (the family's top) |
| `scripts/music-states.mjs` | the music's states and the map a GM fills in (E41 C9a): the floor's modes and their music (`TRIAL_MODE_MUSIC`, `trialMusicState`), the states in the order they win (`MUSIC_STATES`, `stateDef`) and the one that applies (`currentState`), the world's map and its reads (`musicMap`, `playlistFor`, `isCuePlaylist`), its writes saved as a GM changes them (D45: `saveMusicKey`, `writeMusicKeys`, the echo's `recheckMusicKeys`) and a mapping onto the cue playlist dropped at ready (`dropCueMappings`, last, so its cut is the function alone: SHRINK_LISTED); a leaf of the family; 11 names exported, 8 of them re-exported | `music.mjs` |
| `scripts/music-play.mjs` | the music's engine (E41 C9a): the marker of the module's own playback (`asOurs`), the settle window and the map's refresh, `registerMusic`, the chain that applies a state (`schedule`, `apply`, `crossfade`), a track drawn, a playlist paused, held, let go, rewound or stopped, the cue playlist and a GM's own track (`situationalPlaylist`, `watchManualPlayback`, `cueGivesWay`, `stopInterruption`), `playTrack`, `resetMusic`, `refreshMusic` and `musicStatus`; 9 names exported, 7 of them re-exported | `music.mjs` |
| `scripts/murder-music.mjs` | the murder music, one browser at a time (E41 C9a): the incident's track (`murderTrackFor`, `murderPlayData`), the room's music held here (`createRoomHold`), the overlay (`createMurderOverlay`, `murderOverlay`, `murderMusicHere`, `applyMurderMusic`) and a parked Music volume put back (`restoreDuckedMusic`); 11 names exported, 7 of them re-exported | `music.mjs` |
| `scripts/sound-panel.mjs` | the Sound window's music side (E41 C9a): the player's sliders-only window (`openPlayerSoundDialog`), the Music tab's rows saved as they change (`musicMapRows`, `showSaveState`, `wireMusicMap`), the Play tab built on every redraw (`soundPlayPane`, `wireSoundPlay`), `wireSoundDialog` and `openSoundDialog`, which takes the sliders, the Effects tab and its rows (E70's among them) from sfx.mjs by `import("./sfx.mjs")`. That sfx side stays in sfx.mjs with the launcher by the chat (`#drpg-sound-launcher`, read by a11y.mjs and glass.mjs `LAUNCHERS`): moved here (E41 C9b, built on a scratch copy and not committed) it made sfx.mjs import this file, which reaches sfx.mjs through music-states.mjs, clock.mjs and actions.mjs - a static cycle in which the module did not boot. E41-16 is carried to E73, which writes its sfx rows here; both names it exports re-exported by music.mjs | `music.mjs` |
| `scripts/sfx.mjs` | the sound effects' facade (E41 C9a): `registerSfx` and its listeners (`onSfxSocket` ...), the unlock, `diagnoseSfx`, the launcher by the chat (`renderSoundLauncher`, `refreshSoundLauncher`) and the Sound window's sfx side (`soundSlidersHtml`, `soundEffectsHtml`, `wireSoundPanel`; sound-panel.mjs's row, E41-16 carried to E73); 7 names of its own, 14 re-exported from sfx-play.mjs | itself (the family's top) |
| `scripts/sfx-play.mjs` | a sound picked, set and played (E41 C9a): the card's flag (`SFX_FLAG`), the cooldown and the hold, the file an event plays and the pick (`soundFor`, `soundsFor`, `pickSound`), a varied rate and gain, the decoded files (`playOwned`), `setSoundFor`, the volumes and their sliders (`sfxVolume`, `setSfxVolume`, `volumeToSlider` ...), `playSfx` and its two socket senders (`playSfxFor`, `playSfxForUsers`: the engine's two `game.socket.emit`; the listener stays in sfx.mjs), `fire`, `soundFromMessage` and `testSfx`; 22 names exported, 14 of them re-exported | `sfx.mjs` |
| `scripts/vote.mjs` | the vote's facade (E41 C10a): the ballots, the rounds, the count and `trialParticipants` (`VOTE_OPS`, `registerVote`, `openVote`, `closeVote`, `runVoteOp`, `countBallots` ...); 20 names of its own, 20 re-exported (14 from trial-progress.mjs, 6 from verdict.mjs) | itself (the family's top) |
| `scripts/trial-progress.mjs` | the trial's record and the sentence (E41 C10a), one file because the primary's run of another GM's write (`recordOnPrimary`) carries the sentence out and takes it back: how far the trial has got (`trialProgress`, `trialProgressChapter`) and its one write, a step of `TRIAL_PROGRESS_KEY` (`setTrialProgress`, `writeTrialProgressInStep`), another GM's writes asked of the primary and held to the record's own fields (`askRecord`, `recordOnPrimary`, `RECORD_FIELDS`, `recordPatchOf`), the blank at a trial's entry (`resetTrialProgress`, `resetInStep`) with the trial's size (`trialSizeNow`, last, so its cut is the function alone: R1192), and the sentence carried out once at the trial's end (`executeAtExit`, `carryOutSentence`, `postExecutionCard`), asked again (`retrySentence`), named on End the trial's question (`pendingSentence`) and taken back (`clearSentence`) - first in the file, so no function's cut runs on into its `let executing`; 15 names exported, 14 of them re-exported | `vote.mjs` |
| `scripts/verdict.mjs` | the ordinary verdict as E70 left it (E41 C10a): its window (`openVerdictDialog`, `read`, `askBlackenedRule`), its lock on this browser (`verdictRunning`), `applyVerdict` with `keepVerdictBlackened`, its steps (`VERDICT_STEPS` without "executions", `VERDICT_NEEDS.card` "sentence", `VERDICT_STEP`) and their runner `runVerdict` with its readings (`verdictReading`, `verdictHeld`, `readSentence`), its public card (`postVerdictCard`, `verdictCard`, `verdictCardPosted`), the Level Ups, offers, Despair, rule and Overflow it hands out (`verdictLevelUps` ... `verdictOverflow`, `promptAdvancements`), and a verdict stopped half way and finished (`verdictStopped`, `verdictRunner`, `finishVerdict`); it reads the trial's record in trial-progress.mjs; since E41 C10b it holds the Final Trial's verdict too (`openFinalVerdictDialog`, `applyFinalVerdict` with `giveFinalVerdict`), both verdicts on one refusal (`verdictRefusal`), one list (`verdictCandidates`, `candidateOptions`) and one card and one GM summary builder (`verdictCardContent`, `verdictSummaryContent`); the Final Trial's two verdict names are re-exported by mastermind.mjs, which verdict.mjs reads by `import()` - the Mastermind's pick is not split; R161 holds no static cycle; E42 builds its step runner on `runVerdict`; 12 names exported, 6 re-exported by vote.mjs and 2 by mastermind.mjs | `vote.mjs`, `mastermind.mjs` |

That is wave 1 (E34, 1.2.70) whole: five families, eleven new files, 133 module
files in `scripts/` where 1.2.69 had 122. A stage that changes the incident, the
fog, a project or a Call finds the file of its role in this table, not by the
facade's name. Two things sit where a pure move had to leave them (plan E34 4.3):
`applyCrisisAction` in murder-rules.mjs still patches the cast's `swung` in the
store, and the betrayal window lives in incident-store.mjs because `writeState`
arms it.

Wave 2 (E41, 1.2.97) is the rows from `scripts/action-rolls.mjs` down: nine
families, 35 new files, 191 module files in `scripts/` where E41's base had 156.
Each facade keeps what no new file calls: action-rolls.mjs `performAction` and
its dispatch; gm-bridge.mjs the GM -> player wire and the registration;
gm-panel.mjs the panel, its sections and its other windows; hud.mjs the clock's
widget, its rows and its controls; music.mjs `nowPlayingHere` and
`diagnoseMusic`; sfx.mjs `registerSfx`, its listeners, the unlock, `diagnoseSfx`
and the Sound window's sfx side; vote.mjs the ballots, the rounds, the count and
`trialParticipants`; vault.mjs and tables.mjs no code. Three things sit where
the facade rule left them, each measured: fog.mjs and fog-diagnostics.mjs import
vault-store.mjs past its facade, the one pair of importers outside a family that
does (through vault.mjs they close a static cycle, R161; vault-store.mjs's row);
verdict.mjs reads mastermind.mjs by `import()` and mastermind.mjs re-exports its
two Final Trial names (C10b; verdict.mjs's row); and the Sound window's sfx side
stays in sfx.mjs, where in sound-panel.mjs it would close a static cycle
(sound-panel.mjs's row; E41-16, carried to E73). Three files stand over the
stage's 1500 lines: tables-editor.mjs (1668), accepted by the owner (Q-E41-1),
and vault-store.mjs (1552) and hud.mjs (1560), read as about 1500 (E41's end
review; the owner told).

## Things that will bite

Two of this section's rules hold in every file and stand in CLAUDE.md: every English key needs a
Polish twin, and a key is deleted with `forcedDeletion()` or `unsetFlag`.

**The breakpoints live in `settings.mjs` and nowhere else.** `BREAKPOINTS` is
read by the stylesheet (through two body classes stamped in `applyTheme`), by
the curtain, and by the glass harness. A media query with 1224 in it would be a
fourth copy of the number and the curtain could not read it.

**`styles/narrow.css` loads last on purpose.** Both themes state widths for the
module's blocks as specifically as anything that could be written against them,
so the narrow layout wins its ties by being later rather than by an arms race in
selectors.

**The curtain has two partitions.** `curtainShapes` for a desk, `stackShapes`
for a stacked screen. The desk one assembles panes and checks afterwards that
they tile the screen; the stacked one starts from the screen and cuts it, so it
holds together by construction. Neither is a small change: run
`audit/glass-harness.html` at several sizes and compare the self-check
(`overlaps`, `blockFails`, `edgeGaps`) before and after, and look at a
screenshot, because the numbers can be clean and the picture wrong.

**The glass harness does not recut for Foundry's own rails.** `liveSignature` reads
`BLOCKS`, and the two rails are deliberately not blocks - so adding sidebar tabs from
`page.evaluate` and calling `refreshGlass()` republishes the partition cut for the tabs
that were there at load. A fifteen-tab rail has to be in the HTML before the page loads
(rewrite the response with `page.route`). Measured against the stale cut on 16.09, the
numbers came out plausible and wrong.

**A request that reaches the GM is a declaration, judged by one runner.** Every
action a player's client asks of the primary GM is a row in one of three tables,
`BRIDGE_ACTIONS` (bridge-table.mjs), `TRAP_ACTIONS` (traps.mjs) and
`SEARCH_ACTIONS` (search-tokens.mjs), and `judge` in `bridge-guards.mjs` carries
each out: who sent it, its guards in order, then its run with a whitelisted copy
of the packet. R1b reads the tables and holds every id a run receives to a guard
that names it or to a claim written beside it; "How to add a bridge action",
below, is the recipe. `senderOf`, `ownsActor` and `gmOnline` live in
`bridge-guards.mjs` and nowhere else (R161). A socket handler outside the tables
that touches an actor checks `senderOf(senderId)` and
`ownsActor(sender, actor)`, both, every time (R1b's second half) - and the rest
of what that means is the trust model, below.

**What only the GMs may know lives in the GM store, and nowhere else** (E04,
1.2.63). `gm-store.mjs` is the one engine - a section per world in each GM's
browser, a stamp per field, tombstones and a reset's watermark, the GM-to-GM
exchange, and a player's copy stamped part by part - and `gm-stores.mjs` is its
table, one `defineGmStore` row per store. Nothing outside the engine reads or
writes a store's key, a copy's, or a key from before 1.2.63 (R171 reads the source
for their names): the old keys are frozen, read by the engine's claim and never
written. A store a later stage adds is a row in the table, a registration in
`settings.mjs` and, when it lifts world data, a clause in `migrate.mjs` (R178 holds
that each lift is one, and that nothing else calls it) that reads back before it
removes anything (tier 2 runs the lifts that remove world data with their store's
save swallowed, and the world data stays); the claim, the reset's cuts, the exchange,
Back up and Restore follow from the row, and so do the health check's rows about a
claim; a store a player holds a copy of is named by the copy (`from`) and sends the
copies again after a restore (`afterRestore`, R182). A write whose value is derived -
a migration's default, an amendment - says so, `weak`, `fillOnly` or `ifLive` (R172),
or a second GM joining makes it the truth. Tier 2 holds the stores' sending while it
runs (`gmStoreHold`: its restore writes each key back on this client only) and stands
in a world the stores have never opened (`withGmStoreWorld`) for fixtures no other GM
may be sent. While either is on, no player is sent anything from a store - the door,
the cast, the fog, the offers (`gmStoresQuiet`) - a player's request for one waits
until it ends (`whenGmStoresAudible`) and is answered from the world this browser
opened, and the watches that tell the players a merged change keep what they were
last told until it ends and then hold the record against it: the primary tells what
another GM changed meanwhile (61 E6, F5), and what tier 2 put back raw compares equal
(R184; 61 J1b; 01 counts the packets tier 2 sends a player: none). `whenHydrated`
settles only on a real hydration - never on an open that threw - so a player's request
that waits on the stores waits through `answerKeysOpen`, bounded by
`TIMING.gmStoreOpenMs`, and is refused past it (R189, 61 M).

**A new world setting or flag is checked by `scripts/world-secrets.mjs`** (E05,
1.2.64). Foundry sends every world setting and every actor's, user's, token's, item's
and chat message's flags to every browser, and `WORLD_SECRET_RULES` is the one
statement of what they may never hold. R9 (tier 0) reads the suite's world against
it, R190 (tier 1) fails a rule with no fixture, and 72-canary scans a player's
browser with it after every phase of a chapter. A secret moved out of world data
comes with its rule in the same commit, and a field it lets one setting keep
(`except`) comes with the reason beside it.

**Death is two predicates** (E05 C9, C10). `isDeceased` is the table's fact - the
flag, written at the publication - and `isDeadForGm` is what this browser may know:
the flag, or a death the GMs keep (the `deaths` store on a GM, the `mineDeaths` copy
on a player who knows of it). World-visible bookkeeping and anything posted per
student asks the first; the GMs' judgement, and a player's own sheet and moves, the
second. Both live in `settings.mjs`; R192 fails any other read of the flag, and R193
holds that a death is the table's only once it is published (`publishDeath`, run
by the discovery and the Students window, nothing else).

**Two functions are deliberately long.** `registerSettings` (a flat registration
table) and `steps()` (a data table). Everything else the audit measured over 300
lines has been split. Splitting either of those two would produce a dozen
functions that are each one line of data.

