# The module as one chain - the map and its breaks (E59, the 1.2.115 line)

Read on 14.11.2026 at main 9e7e3d78 (1.2.114) by five reading agents, one per group of mechanics, read-only (no
harness, no edit); each break below that this line fixed or asked about was then read again by hand at both ends.
The owner's definition (14.11.2026): code, handbooks and texts agree; the code agrees with itself; the behaviour agrees
(the sounds, and how the mechanics and features mesh) - one chain of mechanical links.

HOW TO READ IT. Part 1 is the map: one row per mechanic - where it starts, what it writes, who else reads that, what
the table sees and hears, where the handbooks and the lang keys describe it. Part 2 is the sound table. Part 3 is the
breaks, each with its evidence (file:line at 9e7e3d78 unless a commit is named), its kind (behaviour, sound, text,
doc) and its state: **fixed** (the commit and the test), **question** (the owner's, with the default this line took),
**listed** (real, not in proportion here: for E83 or a fix window), or **theirs** (another line's item). "Unverified"
means the reader could not settle it by reading.

Paths: `scripts/` for code, `GM` = docs/handbooks/gm-handbook.en.md, `PH` = player-handbook.en.md, `PB` =
player-brochure.en.md (each with its .pl.md twin at the same line).

## 1. The map

### Time, Hope and Despair

| Mechanic | Starts | Writes | Read by | The table sees / hears | Docs, keys |
| --- | --- | --- | --- | --- | --- |
| Hope Calls | player's sheet tile, calls.mjs `spendHopeCall`:152 (`hopeCallRefusal`:99); Reroll `askReroll`:372; Bribe monocub.mjs `offerBribe`:1562; roll Calls armed on the primary | Hope (`trustedWrite` "call"); armed-Call flags (call-effects.mjs); `bountyStore`, `cubStore.bribes` | roll-draw.mjs; sheet-audit.mjs; Overflow "despair" cancels Hope gains (overflow.mjs:1318) | owner's card, cue `hopeCall` (calls.mjs:338); Bribe: veiled cards, no cue (B-H4) | GM 6.1:454; PH 5:513; PB:45; `DRPG.Calls.*`; config `HOPE_CALLS` |
| Despair Calls | GM on a Monokuma's sheet, calls.mjs `spendDespairCallFor`:389 (shut in an Eclipse and a trial), despair.mjs `spendDespairCall`:902, `applyCall` | `despairPools`, `sealedRooms`, `restrictions`, `motive`, `killingGameRules`, `pendingGather`; stores `despairOwed`, `bounties`; Health, Sanity | the clock's boundary clears seals, ticks the motive, lapses Bribes and Bounties (clock.mjs:803-821); `settleOwed` | public card, cue `despairCall` (yields to `newRule`, `motive`, `publicAnnouncement`); Bounty: Monocubs and GMs, no cue | GM 6.2:482, 7:554; PH 6:545; `DRPG.Despair.*`, `DRPG.Motive.*`, `DRPG.Rules.*` |
| Overflow | a full pool spills (despair.mjs `spillFrom`:673), Feed the Overflow, overflow.mjs `addOverflow`:348; `checkOverflow`:748 at the Eclipse and every time of day | store `overflow.count`; setting `overflow.active` | budgets, Search Tokens, the Eclipse allowance, Free Move, Hope Calls, facilities, rests (overflow.mjs:1010-1097); the verdict empties it; the mood band | public card, cue `despairOverflow` (overflow.mjs:985) | GM 7; PH:570; `DRPG.Overflow.*` |
| The clock | GM: clock.mjs `advanceTimeOfDay`:344, `setTimeOfDay`:754, `rewindTimeOfDay`:675, Edit campaign, `setPhase`:67 | setting `clock`; store `takeBack` | Overflow, Search Tokens, seals, Bribes, Bounties, motive, owed Despair, every HUD and sheet (`SYNC.clock`), the music | time-of-day card, public or veiled to the GMs and the incident's audience (clock.mjs:850-920); silent by design; board cues `dayStart`, `dayEnd` | GM 4:286; PH 2:106; PB:16; `DRPG.Clock.*`, `DRPG.Hud.*` |
| The Eclipse | GM through the readiness round: eclipse.mjs `startEclipse`:238, `endEclipse`:395; refused over a body, an incident before Stage 6, a trial (`startRefusalOf`:147) | clock `eclipse`, `refilledFor`; stores `eclipseMoves`, `pendingMurders`; the refill | movement, voice, fog, music, watch, timed effects, lock picks, the day's summary | start: public card, cue `eclipseStart`, a whisper to each owner; end: the time-of-day card with `eclipseEnd`; music `eclipse` | GM 12:1061; PH:122; `DRPG.Eclipse.*`, `DRPG.Ready.*` |
| Level Up | verdict.mjs `verdictLevelUps`:778 -> level-up.mjs `runAdvancementBatch`:1163; sheet grant; `deferAdvancement` (Reinforced) | traits, maxima, experiences ("levelUp"); flag `advances`; stores `offers` (+ `mineOffers`), `deferredOffers`, `verdictStore.giving` | the reset's advancement group; a death drops a deferred offer | offer whispered; on apply a veiled card and cue `levelUp` to the owner (level-up.mjs:1015-1042) | GM:1504, 22.15; PH:913; `DRPG.Advance.*` |
| End of chapter | primary GM, chapter.mjs `openChapterEndDialog`:380 -> `applyChapterEnd`:826 over `CHAPTER_END_STEPS`:648 | `chapterEnd`; the clock (chapter, session, phase, morning with the refill, the boards); Truth Bullets, Remnants, the Key plan, `bodyFound` | the morning's `applyTimeOfDayChange` | the GMs' report; the morning's card; both boards with their cues; no cue of its own | GM 16.1:1619; `DRPG.Chapter.*` |
| Season reset | primary GM, season-wipe.mjs `resetSeason`:204 -> `wipeSeason`:763 over `RESET_STEPS`:404 (30 groups and the cast's place) | every registered setting and every GM store through its `resetGroup`; `seasonReset`; the clock (season + 1) | everything | the report card, no cue; the chat deleted | GM 16.2:1642; `DRPG.Season.group.*` |

### Rooms, Search, Remnants, projects

| Mechanic | Starts | Writes | Read by | The table sees / hears | Docs, keys |
| --- | --- | --- | --- | --- | --- |
| Move | a drag; movement.mjs `onPreUpdateToken`:1545, `settleRoute`:2720 | the Free Move, free crossings, Burst or an action; `drpgRouteSettled`, `CROSSING_SETTLED`; the discovery ledger | traps (`enters`, `alone`), barricades, lock-pick passes, the room tile, the project card | a move card; a refusal sends the token back with cue `refused` (movement.mjs:3437) | PH 3:153; GM 9.3:774, 9.4:797; `DRPG.Move.*`, `DRPG.Movement.*` |
| Dash | action-listen.mjs `performDash`:303 -> bridge-runs-acts.mjs `handleDash`:163 | free crossings (12+: 2, 18+: 3, crit: 4); a tail shaken | Move | a roll card, no cue | PH:442; `DRPG.Infiltrate.row.dash` |
| Shut the Door | action-doors.mjs `performShut`:25 -> doors-gm.mjs `shutDoor`:102 | `barricadeStore` + the region flag `drpgBarricaded`; a neutral Faint Remnant | movement `barricadedFrom`:2102; Force; the reset clears both copies (actions.mjs:497) | whispers `shut.seenBy`, `shut.knock`; no cue | PH:424; GM:376, :729; `DRPG.Infiltrate.shut.*` |
| Force the Door | `performForce`:48 -> `forceDoor`:154 | the barricade ended, the lock broken, a seal lifted; a Remnant; `bedroomNoteStore` | Repair the Lock; `isLocked`; the owner told on entry | whispers `force.banging`, `forcedBy`; the owner hears `bedroomEntered` | PH:428; GM:377 |
| Pick the Lock | `performPick`:104 -> `pickLock`:199 | `lockpickStore` + the copy `lockpickCopy`; a Remnant; a bedroom note | movement (the pass), ended at the time of day and the Eclipse | whispers; the owner hears `bedroomEntered` | PH:432; GM:378 |
| Search | action-search.mjs `performSearch`:462 | `searchTokens` (claim); an item granted; a Prep Remnant | traps `search`; the room tile and HUD (`SYNC.searchTokens`); Room Setup | the report card; a miss plays `searchNothing`; a success plays nothing (a critical `critical`) | PH:241, :264; GM:355; PB:34; `DRPG.SearchTokens.*` |
| Observe | action-observe.mjs `performObserve`:51 -> observe.mjs `resolveObserve`:694 | a Truth Bullet; the Remnant's public text; a secret project found | Analyze, the ring and icons, Tamper | `truthBullet` (truth-bullets.mjs:787), `observeFail`, `projectFound` | PH:292; GM 14.6:1355; `DRPG.Observe.*` |
| Analyze | action-analyze.mjs `performAnalyze`:74 -> analyze.mjs `resolveAnalyze`:55; Find Stash, Find Passage | bullet flags `shownType`, `analyzed`; a stash found; a passage known | the Remnant card and icons; the trial's Present | `analyzeHit`/`analyzeMiss`; `stashFound`/`searchNothing`; `passageFound`/`searchNothing`; a hint: none | PH:308; GM 14.7:1380 |
| Remnants, Key Remnants | remnants.mjs `dropRemnant`:214; key-remnants.mjs `openKeyRemnantHere`:1080 | `remnantStore`, `remnantSecrets`; token flags | the ring (remnant-ring.mjs:150); diagnostics; Tamper | the Remnant card (remnant-ring.mjs `showRemnantCard`:191) | PH:642; GM 14.1:1269, 14.4:1326 |
| Projects, Countdowns | action-project.mjs `performProject`:62, `performSabotage`:975; GM projects.mjs `applyProjectChange`:1420 | `daggerheart.Countdowns`; `projectMeta`; `projectSecretStore`; the player's `projectSightCopy`; `seenProjects` | the tray, the project card, the room tile, the sheets, traps | `projectDone`; `sabotageFailed`/`sabotageSeen`; Work: no cue | PH:319, :695; GM 11.1:958, 11.4:1018 |

### The murder, the body, the Investigation

| Mechanic | Starts | Writes | Read by | The table sees / hears | Docs, keys |
| --- | --- | --- | --- | --- | --- |
| The murder (Stages 4-5) | action-murder.mjs `performDirectMurder`:303, `performBetrayal`:239; the GM's window or a trap's Spring -> murder-rules.mjs `openMurder`:440; the opening `rollOpening`:4364; the fight `takeCrisisAction`:1031; a third `thirdPartyEnters`:3306 | `murderState` + the cast (incident-store.mjs); `keyRemnants`, `thirdId`; Remnants; Health, Sanity; the betrayal offer | the clean-up, the body's discovery (`involved`, `inThatDeath`), `caseKeyCount`, `freshSceneBonus`, the murder music | the opening card to the GM and the roller's side; crisis cards to the participants; the murder music per browser; `yourTurn`; `death` / `deathFade` | GM 11.4:1018, 13.1-13.2:1119; PH 9-10:695; `DRPG.Murder.*` |
| The clean-up (Stage 6) | murder-rules.mjs `beginResolution`:2910; cleanup.mjs `attemptCleanup`:560 / `resolveCleanup`:1083, Reshape, `attemptStageSix`:1606 / `resolveStageSix`:1722; Tamper; `endResolution`:2821 -> `endMurder`:3376 | Remnant tokens and the ledger; `usedTools`; Sanity; at the close the Blackened register, `recordCaseKeys`, broken weapons | the Investigation and the Map; the discovery (`destroyCleaningTools`); the trial's Blackened; the Key fee | whispered result cards; `cleanupFailed` on an erase or reshape miss | GM 13.3:1194; PH 10; `DRPG.Cleanup.*` |
| The body and its discovery | death.mjs `killCharacter`:158, `incidentVictimDied`:321; the walk-in body.mjs `maybeBodyFound`:728; the GM `openBodyDiscoveryDialog`:1090 -> `discoverBody`:159 -> `runDiscovery`:209 (`publishDeath`, `announceBody`, the tools broken, the gather, the card) | `deaths` (kept), the `deceased` flag at publication, the body tile, the dead Spectator; `pendingBodies`, `bodiesHeard`, `bodiesFound`, `bodyFound` (the hold) | the music (`bodyFound`), the Eclipse lock, the warm scene, the planned Autopsy, the trial | the popup and `bodyFound` to everyone; the gather; the walk-in `bodyFound` to the walker | GM 13.4:1238; PH:837; `DRPG.Chapter.body*` |
| The Investigation | clock.mjs `setPhase("investigation")`:67; the dashboard investigation.mjs:2116; the Key plan, the Map, the planned Autopsy | the Key plan and its `case` row; the case schema; Remnants; Truth Bullets | the trial (the fee, the unfound Keys, the evidence log) | the curtain's flash `paneFlash`; music `search`; `truthBullet` | GM 14:1267; PH 11:849; `DRPG.Investigation.*` |

### The Class Trial

| Mechanic | Starts | Writes | Read by | The table sees / hears | Docs, keys |
| --- | --- | --- | --- | --- | --- |
| Entry | Start the Class Trial -> clock.mjs `reconcilePhase`; trial-progress.mjs `resetInStep`; voice.mjs `settleTrialVoices` | phase; `trialProgress` (blank, keys charged kept, `mutedDead`); `trialMuteStore`; the hall's tokens | vote.mjs `trialParticipants`, trial.mjs, hud `objectionControl`, movement, voice | the entry sequence, `trialStart`; the hall; the microphones held | GM 15:1410, 15.1:1562, 15.3:1603 |
| Debate, Objection, Rebuttal | the debate opened; hud.mjs `objectionControl` -> trial.mjs `raiseObjection` -> `objectOnPrimary`:1071 | `trialQueue` (the floor), the card's flags, the price's receipt | sfx `floorSounds`, the voice settle, `trialMusicState` | `debateOpen`, `objection`, `rebuttal`, `overrule`; music `trial.debate` / `.objection` / `.rebuttal` | GM:1453 |
| Testimony, Panic, Closing | trial-modes.mjs `startTestimony`:124, `startPanicRound`:129, `startClosing`:281 | `floor.round`, `floor.closing` | the settle, sfx | Panic `panicStart`, Closing `closingStart`, `yourTurn` per speaker; the ends silent | GM:1531-1546 |
| Straw Poll, Logic Dive, Scrum | trial-zones; zone-machine.mjs | `floor.zone`, the zone's record | the console, the vote's card, `conferCamps` | `strawPollResult`, `answerRight`/`answerWrong`, `yourTurn`; music per mode (E110) | GM 15.2:1579 |
| The vote | vote.mjs `runVoteOp` "open":359 -> `endFloorForVote`:464 | `trialProgress.vote`; ballots in `ballotStore` | the verdict, `cubVoice`, `voteMusicPlays` | `voteOpen`, the count's `verdict`; music `trial.vote` | GM:1475 |
| The verdict | verdict.mjs `openVerdictDialog`:68 -> `applyVerdict`:404 -> steps:479; Final: `openFinalVerdictDialog`, `applyFinalVerdict` | `trialProgress.verdict`, `sentenced`; `verdictStore`; rules; pools | trial-progress.mjs `executeAtExit`; sequence `verdictBoard` | THE VERDICT and the cut-in `verdictCut`; a wrong verdict's `newRule`; THE EXECUTION and `execution` at the end; the Final: no sound (B-T7) | GM:1483, 15.3:1610 |
| Who may speak | voice.mjs `settleTrialVoices`: `mutedDead` and the floor's hold through `trialVoiceActorOf`:1578 | `BROADCAST_AUDIO`, `trialMuteStore` | the voice tile, the HUD | "The floor is name's" | GM:1441, :1471; PH:872 |
| Exit | `reconcilePhase` out of the trial (clock.mjs:987): `endFloor`, `askTrialVoices`, `executeAtExit`, `removeBodyTiles` | the floor cleared, `mutedDead` gone, the executions | - | the exit sequence, `execution` | GM 15, 15.3 |

### Voice, Spectator, Monocub, messenger

| Mechanic | Starts | Writes | Read by | The table sees / hears | Docs, keys |
| --- | --- | --- | --- | --- | --- |
| Voice rooms | voice.mjs `registerVoice`:238; the primary's `voiceTargets`:894, `placeVoices`:988, `voiceClaim`:1850 | LiveKit rooms; `trialMuteStore`; `BROADCAST_AUDIO`; `mutedDead` | the HUD, the voice tile, the vote's size, Listen, the mask | the token's room; the Eclipse silent; the trial's main room; the dead in the Spectators' room | GM 9.5:806; PH 3:206; `DRPG.Voice.*` |
| Spectator | monokuma.mjs `setSpectator`:242; the dead watcher spectator-dead.mjs `ensureDeadSpectator`:160; the user flag `spectatorTalk` | the actor flag, the user flag, the watcher | voice, spectator-ui (the chat), projects, fog, the boards, `senderNotSpectator` | the microphone held; hears its token's room; the talk switch; no chat log | GM 8; PH 1:96; `DRPG.Spectator.*` |
| Monocub, Monokuma | monocub.mjs `setMonocub`:139; `FLAGS.monokuma`, `poolUserFor` | flags, `cubStore`, `cubTargetStore`, `bountyStore` | voice, `deadForTrial`, the vote, sfx `monocub` | the trial's "speak / listen" lines; Monokuma speaks as its GM | GM 8:613, 9.5 |
| Messenger | messenger.mjs `createThreadMessage`:276 | a private ChatMessage to the player and every GM; `messengerLastRead` | the app's badge and roster, sfx, the popup | one thread per player, Spectators included | GM 6.3:513; PH 14; PB:69; `DRPG.Messenger.*` |

## 2. The sound table

`SFX_EVENTS` (config.mjs:5094-5489) holds 73 keys. Every key has at least one site that plays it, and every key a site
names is in the table. The roads: local `playSfx`, a card's flag (sfx.mjs:118-144), an addressed socket
(sfx-play.mjs `playSfxFor`, `playSfxForUsers`). The music's states are music-states.mjs `MUSIC_STATES`, applied on the
primary GM alone, the first that applies wins.

Moments of one kind, read side by side:

| Kind | Success | Failure |
| --- | --- | --- |
| Search | none | `searchNothing` |
| Observe | `truthBullet` | `observeFail` |
| Analyze: identify / stash / passage / hint | `analyzeHit` / `stashFound` / `passageFound` / none | `analyzeMiss` / `searchNothing` / `searchNothing` / none |
| Work / Sabotage | none (`projectDone` at the full bar) / none | none / `sabotageFailed`, `sabotageSeen` |
| Erase, Reshape / Misleading Trail, Move the Body | none | `cleanupFailed` / none before this line (B-M5) |
| Shut, Force, Pick, Dash | none (the bedroom's owner hears `bedroomEntered`) | none |
| Panic, Closing / Testimony, the zone modes | `panicStart`, `closingStart` / none | - |

A failure that sounds and a success that does not is the module's pattern (most rows); the rows that break it are
B-M5 (fixed, 4a5865ed) and the questions of B-R8.

## 3. The breaks

### Time, Hope and Despair (B-H)

| Id | Break | Evidence | Kind | State |
| --- | --- | --- | --- | --- |
| B-H1 | Emptying the pools drops the Bounties' owed rows, and a Bounty's lapse then pays its cost back into the emptied pool | despair.mjs `clearOwed`:696, `returnOwed`:651; monocub.mjs `lapseBounties`:1853 | behaviour | listed: `returnOwed`'s header says so on purpose ("after a zero, `n` comes back", the owner's default of 13.11, A113-C6-3); the reset road (despair ticked, actions not) is Q-115-2 |
| B-H2 | The Overflow's card at a boundary is public while an incident runs; the time of day's card and the due motive at the same boundary are veiled to the incident's audience | overflow.mjs `announceOverflow`:975 ("public by design"); clock.mjs:907; rules.mjs:195 | behaviour | question Q-115-1 |
| B-H3 | An Eclipse started at Stage 6 opens on a public card and sound, and its end rides the time of day's card, veiled while the incident stands | eclipse.mjs:180, :360, :410; clock.mjs:907 | behaviour, sound | question Q-115-1 |
| B-H4 | Bribe is the one Hope Call with no `hopeCall`, Bounty the one Despair Call with no `despairCall`; GM 17 lists both kinds without exception | calls.mjs:161, :465; GM:1712 | sound, doc | question Q-115-3 |
| B-H5 | GM 16.2's clock row says the reset refills everyone's actions; the clock group writes the clock only, the refill is the cast's action group | GM:1652; season-wipe.mjs `clearSeasonClock`:660; actions.mjs:491 | doc | fixed 3f3a9eb7 |
| B-H6 | The reset's "actions" group clears Bounties, Confusions, room-action effects, lock picks, eavesdrops, masks, tails, watches, crossings and the rolls' records, its label names the budget, the rests and the barricades | gm-stores.mjs:999-1524; en.json `DRPG.Season.group.actions` | text | listed (a label and GM 16.2's row; a fix window, with E109's H20 `Season.resetKeeps` beside it) |
| B-H7 | The Despair widget has three names: "Despair Pools" (its title), "the Despair bar", "the Despair rail"; no glossary entry | en.json `DRPG.Despair.widgetTitle`; GM:558, :337, :123; PH:547 | text | question Q-115-4 |
| B-H8 | PH 2 says every time of day refills the actions; the code and GM 4 refill at the Eclipse (or Skip the Eclipse) | PH:110; GM:308; clock.mjs:345 | doc | fixed 3f3a9eb7 |

### Rooms, Search, Remnants, projects (B-R)

| Id | Break | Evidence | Kind | State |
| --- | --- | --- | --- | --- |
| B-R1 | A player's copy of the GMs' sight of secret projects changes and only the tray and the tokens redraw; the room tile's "a project here" and the sheet's Projects tile read the same copy through `canSee` | projects.mjs:1823; projects-secrecy.mjs:275; room-tile.mjs:168, :753 | behaviour (the 14.11 kind) | fixed 9bd4f615, R7162 |
| B-R2 | An open Remnant card is a snapshot; the project card is live | remnant-ring.mjs `showRemnantCard`:191; projects-map.mjs:832 | behaviour | listed |
| B-R3 | Traces of the door actions and the facilities (`action: "infiltrate"`, `"facility"`) have no icon, even analyzed; PH says an analyzed Remnant wears its maker's icon | doors-gm.mjs:453; facilities-gm.mjs:192; remnant-icons.mjs:51; PH:646 | behaviour, doc | listed (needs two icons: the glyph set's owner) |
| B-R4 | The GM's diagnostics call every neutral Remnant a mistake; doors, facilities and handovers leave neutral ones on purpose | diagnostics.mjs:1242; doors-gm.mjs:453; handover.mjs:773 | text | listed |
| B-R5 | Shut the Door pays and rolls, then can be refused with nothing given back (an Eclipse, three open doors, a bedroom, a body, another's barricade); Search refuses before paying | action-doors.mjs:25-46; doors-gm.mjs:82-99; PH:243, :424 | behaviour | listed (a refund road through the bridge: not one line) |
| B-R6 | The banging of a forced door names the room by its real name to a listener who never found it; a breach's crash names it as Listen does | doors-gm.mjs:183; passages-gm.mjs:838 | behaviour (privacy) | fixed b6a2be34, R7164; PH 4's quote 3f3a9eb7 |
| B-R7 | "Who is in the room" three ways: movement.mjs `countsAsPresent` (no Monokuma, Spectator, dead, hidden), the door cards (Spectators in), the breach's cards (the dead and Spectators in) | movement.mjs:3679; doors-gm.mjs:131; passages-gm.mjs:828 | behaviour | fixed 9edb4f66, R7163 |
| B-R8 | Neighbouring sounds: a forced door's banging is a silent whisper beside a breach's `wallBreached`; Search's success silent beside Observe's; Force, Pick, Shut and Dash silent | as the sound table | sound | question Q-115-3 |
| B-R9 | The handbooks' "turned back by" lists leave out the barricade | movement.mjs:2102; PH:168-178; GM 9.3:778 | doc | fixed 3f3a9eb7 |
| B-R10 | The cue "Your bedroom was entered" also plays when its lock is repaired | doors-gm.mjs:285, :56 | text | listed |

### The murder, the body, the Investigation (B-M)

| Id | Break | Evidence | Kind | State |
| --- | --- | --- | --- | --- |
| B-M1 | Once a body is announced, no later body is found by walking in, and no lone finder is told, until Daily Life; the walker still hears `bodyFound` (the sound runs before the gate); the betrayal stays open through the Investigation | body.mjs:731, :753, :812; GM:1236, :1242; PH:830 | behaviour | question Q-115-5 |
| B-M2 | A discovery waiting for the GM keeps the room it was written with; Move the Body does not touch the row, so the card and the gather name the old room | body.mjs:858, :922; cleanup.mjs `applyMoveBody`:1922 | behaviour | listed |
| B-M3 | No warm scene's -3 for a second incident while the first body's hold stands: `freshSceneBonus` answers 0 on the hold before it asks for an incident | cleanup.mjs:413; settings.mjs:3958; GM:1205 | behaviour | question Q-115-5 (the hold's zero is written on purpose: "the corridor is full of people the moment the body is found"; R3950 holds the readings) |
| B-M4 | The walk-in sound and the discovery disagree about the third party after the close | body.mjs:978, :798; incident-store.mjs:1026 | behaviour | listed (the witness rule needs design) |
| B-M5 | A missed Misleading Trail or Move the Body plays no `cleanupFailed`; a missed Erase or Reshape does; the cue's hint names a Tamper roll | cleanup.mjs:1844, :2589; config.mjs:5312 | sound | fixed 4a5865ed, R7165 (the hint names all five rolls) |
| B-M6 | "-3 on every DC" and "a Cleaning Tool takes its tier off the DC" read as every clean-up roll; the trail takes neither | cleanup.mjs:1791; config.mjs:4726; GM:1196, :1205 | doc | listed (E109's H11 is Move the Body's floor, beside it) |
| B-M7 | The Remnants tab's rule line says a Key Remnant narrows to "at most half the cast"; config and the handbooks say the Keys together narrow to 2-4 | en.json `DRPG.Investigation.neverOnePerson`; config.mjs:1387; GM:1328 | text | fixed 9f649b06, R7171 |
| B-M8 | The trap victim's failure text speaks of a walk-in, and nobody walks in on a trap | config.mjs:3737; murder-rules.mjs:3255; PH:747 | text | fixed 227b1b86 |
| B-M9 | A second incident in the chapter overwrites the case's Key Remnant count | murder-rules.mjs:3506; key-remnants.mjs:367; GM:1330 | doc, design | question Q-115-6 |

### The Class Trial (B-T)

| Id | Break | Evidence | Kind | State |
| --- | --- | --- | --- | --- |
| B-T1 | The floor's mute and the floor's seat pick a player's student by different rules (the lowest id; the first in `game.actors`; the assigned character; `viewerActor`), so a player with two students can be held on their own turn | voice.mjs:1587; vote.mjs:573; camera-view.mjs:229; hud.mjs:1511 | behaviour | listed (unverified at a table; one seating helper is a design change across four files) |
| B-T2 | "Who takes part in this trial" ticks place the hall's tokens alone; the vote, the rounds, the Reveal and the zones read `trialParticipants`, which ignores them | trial-scene.mjs (`trialCastStore`); vote.mjs `trialParticipants`; en.json:3188; GM:1439, :1554 | text, design | question Q-115-7 |
| B-T3 | The Final Trial's Level Ups read the GMs' list of the living; the ordinary verdict reads the table's | verdict.mjs:647, :1361 | behaviour | fixed 10d07d9b, R7160 |
| B-T4 | GM 13.4 says a kept death's player is sent a ballot; the vote skips `mutedDead` | GM:1255; vote.mjs:583 | doc | fixed 3f3a9eb7 |
| B-T5 | PH 12 says the module silences only the dead; since 1.2.114 the floor holds who has not got it | PH:872; voice.mjs `floorHeld` | doc | fixed cd81893a, R7170 |
| B-T6 | The vote can outlive the trial: the exit closes no open vote, and a ballot is taken with no phase check | clock.mjs:987; vote.mjs:186, :219, :241, :932 | behaviour | listed (unverified whether End the trial refuses an open vote) |
| B-T7 | The Final Trial's verdict plays no sound and no cut-in | verdict.mjs:1309; sequence.mjs:788 | sound | question Q-115-3 |
| B-T8 | A Panic Round's first speaker hears `panicStart` and `yourTurn` in one pass; a Scrum Debate's Finding and end are silent beside a Straw Poll's | sfx.mjs:291, :298; zone-machine.mjs:236, :251 | sound | the double fixed 83fde695, R7166; the Scrum's silent ends question Q-115-3 |
| B-T9 | GM 15.2 says the zone modes play the debate's music; since 1.2.114 each has its own state when mapped | GM:1585; music-states.mjs:63 | doc | fixed 3f3a9eb7 |

### Voice, Spectator, sounds (B-S)

| Id | Break | Evidence | Kind | State |
| --- | --- | --- | --- | --- |
| B-S1 | The vote's music is not followed: the watch does not name `trialProgress` | music-play.mjs:240; music-states.mjs:197 | behaviour, sound | fixed 73a28152, R7161 |
| B-S2 | The handbooks say the module never holds a Monocub's or a living player's microphone in the trial; since E110 the floor does | GM:812, :834; PH:872, :1172, :229 | doc | fixed cd81893a, R7170 |
| B-S3 | A Spectator has no chat but keeps the messenger: hears `chatReceive`, every send refused | messenger.mjs:96; spectator-ui.mjs:69; PH:98 | behaviour, doc | question Q-115-8 |
| B-S4 | A Truth Bullet's and a Level Up's sound go to the first owner only; `yourTurn` and `monocub` to every owner | sfx-play.mjs:515; utils.mjs:608; sfx.mjs:318 | sound | fixed e8d8df60, R7167 |
| B-S5 | A Spectator with the talk switch on is in voice during an Eclipse; GM 9.5 says no player is | voice.mjs:1061; GM:810 | behaviour, doc | question Q-115-8 |
| B-S6 | The talk switch survives a Spectator unmarked; marked again, the microphone opens without a press | monokuma.mjs:242; voice.mjs:1453 | behaviour | fixed 697abbd5, R7168 |
| B-S7 | GM 9.5 calls a Spectator "an account with no character"; since E92 it is a flagged character, placed by its token | GM:810; voice.mjs:912, :1037 | doc | fixed cd81893a |
| B-S8 | The Spectators' room is still "the dead channel" in the voice plan's row and in the handbooks | voice.mjs:2226, :2511; en.json `DRPG.Voice.plan.deadChannel`; GM:814; PH:234 | text | fixed cd81893a, R7170 |
| B-S9 | GM 9.5 quotes the Monocub tile's line in the Polish shape | GM:812; en.json `DRPG.Voice.held.cubListen` | doc | fixed cd81893a, R7170 |
| B-S10 | `yourTurn`'s hint omits the Scrum turn (both languages); PL `debateOpen` hint still names a Closing that opens it | config.mjs `SFX_EVENTS`; pl.json | text | fixed 9f649b06 |
| B-S11 | GM 17 lists Confusion twice for one cue and says the sequences are five rows; the case summary is a sixth | GM 17; sequence.mjs:883 | doc | the double Confusion fixed 3f3a9eb7; "five rows" left: whether the case summary is one of section 15.3's sequences is unverified |
| B-S12 | Test on an empty Death fade says there is no file; the live fade plays the death's file (`fallsBackTo`) | sfx-play.mjs:760, :127 | behaviour | fixed a3b69001, R7169 |
| B-S13 | GM 17 says players set their volumes in the Sound window; their launcher opens the settings window | GM 17; sfx.mjs:503; PH:1071 | doc | fixed 3f3a9eb7 |

## 4. The owner's questions (each with the default this line took)

| Id | Question | Default taken |
| --- | --- | --- |
| Q-115-1 | B-H2, B-H3: while an incident runs, the clock's card and a due motive are veiled to the incident's audience, but the Overflow's card at the same boundary is public ("weather, not a secret"), and an Eclipse opened at Stage 6 starts on a public card and sound and ends on a veiled one. Veil both like the clock's card, post them at the close, or keep them public? | Keep as is (the Overflow's state is a world setting every browser reads anyway); listed for a fix window |
| Q-115-2 | B-H1, B-H6: the reset's "actions" group also takes the Bounties, Confusions, room-action effects, lock picks, eavesdrops, masks, tails, watches, crossings and the rolls' records; unticked with "despair" ticked, a Bounty of last season lapses into the new one and pays its cost back. Move `bounties` to "seals" (Despair Calls in force) and say the rest in the label? | No change here; the label and GM 16.2's row in a fix window, beside E109's H20 (`Season.resetKeeps`) |
| Q-115-3 | B-H4, B-R8, B-T7, B-T8: moments whose neighbours have a sound and they none - Bribe (Hope Call), Bounty (Despair Call), Search's success, Force, Pick, Shut and Dash, a forced door's banging beside a breach's crash, the Final Trial's verdict (no cut-in, no sound), a Scrum Debate's Finding and end. Add a cue to each, reuse a neighbour's, or name them silent in GM 17? | Silent as now (E110's default for new stings was "no"); GM 17 to name them in a fix window |
| Q-115-4 | B-H7: the Despair widget is "Despair Pools" in its title, "the Despair bar" and "the Despair rail" in the handbooks. Which name, and a glossary row? | "the Despair Pools" (the widget's own title); not changed here |
| Q-115-5 | B-M1, B-M3: once a body is announced, a later body is found by the GM's button alone until Daily Life (the walker hears the discovery sound and is told nothing), and the warm scene's -3 is off for a second incident while the first body's hold stands. Is the hold meant to cover a betrayal's or a second incident's body? | Yes, as written (the hold's comment says why); the sound before the gate is listed |
| Q-115-6 | B-M9: a second incident in a chapter writes its opening's Key Remnant count over the first's (the case's row). First, last, or the lower? | Last, as now; GM 14.4 to say so in a fix window |
| Q-115-7 | B-T2: "Who takes part in this trial" places the hall's tokens alone; the vote, the rounds, the Reveal and the zones read every living student. Rename the tick ("In the hall") or seat the trial by it? | Rename in a fix window; the seating unchanged |
| Q-115-8 | B-S3, B-S5: a Spectator has no chat but keeps the messenger (it hears a GM's message, its replies are refused); a Spectator with the talk switch on is in voice during an Eclipse, where GM 9.5 says no player is. | Keep the messenger (a GM may still reach a watcher); the Eclipse: the switch yields to the Eclipse - a fix window, as it is a voice change needing a LiveKit check |

## 5. Not read here

- E109's items (Q-A1 `Overflow.hopeBlocked`, Q-A11 `TraitRuling.propose`, Q-A6 the stage named Tamper, H13
  `INDIRECT_MURDER.subProjects`, H20 `Season.resetKeeps`, Q-NC-10 the critical's hint line, Q-NC-7 Analyze's card
  order, H11 Move the Body's DC floor) and the tooltip sweep: not reported here; where a break stands beside one, the
  row says so.
- The secret project's indirect-murder mark: LEAK-PROJECT-MARK.md (the 1.2.113 part).
- What a table alone settles: the Overflow card's privacy at a real table, a Spectator in LiveKit during an Eclipse,
  the vote's music crossing on a real playlist - STATUS-115.md, "Needs a local Foundry".
