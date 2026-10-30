# E52 - The contract with Foundry and Daggerheart, a stable macro API and one diagnostics report (line B; train: line A's next after READY)

Base: bc158f09 on claude/fervent-sagan-gme4vt-b (= main 12ff1b62, release 1.2.90, plus B-C0 and E20, READY, not merged
yet). Files and symbols, never line numbers (hints read on 30.10 at origin/main 12ff1b62 and bc158f09; they may move).
Tier-0/1 tests take R1537 and up (line B's range; the highest R1500+ in the tier files at Base is R1536, E20's; line A's
branch e9e41f58 is at R1050); tier-2 tests are E52-T1.. . The issues' full text: lines-board `issues.json` (exported
29.10). No row a player's browser sends is added or changed: no write-roads table, no security lens (METHOD-A-lite 5);
C2 is MARKED all the same, because its rows judge the relay guard and the roll draw (see Rules). `tools/stages.json`
E52: planned "1.2.121" (line A sets the version at the train), touches `[]`.

## Goal
Every reach into Foundry's, Daggerheart's or another module's code is a row of one register, probed at start with a
named fallback; the diagnostics are one report a GM copies with one click; the macro API's surface is a file a test
holds the code to. (plan.json E52 "goal"; "doneWhen": every reach into foreign code is checked at start with a named
fallback, diagnostics are one report, the macro API has a surface guarded by a test.)

## The owner's words and binding decisions
- plan "goal" (the rows it names are E52-02..13): patches.mjs the contract register, a kind and a probe per row;
  `runContract()` at ready on the primary GM, a failed probe: the fallback by D24, a permanent GM notice naming the
  function, a Pre-season row; a tier-0 test of prototype assignments and hooks against the register; one
  `game.drpg.diagnose()` with "Copy report"; Dark Reader only when named; silences as ids with "Show again"; the API by
  D25 (`wrap()` warns, `traitValue` destructured, `migrate()` with `migrate1_2_0`, `tools/api-surface.json`).
- plan "risk": a probe checks presence, not behaviour; "nie wiem" is a warning, never green. The rolls' fallback must
  keep D2 (D24). Removing an API key needs an alias for at least one release (D25). D24's and D25's own text is not in
  plan.json or issues.json; this spec reads them from the plan's words and the code's uses of D25 (api.mjs "The older
  names stay (D25)"; tests.mjs "READING BY DEFAULT ... D25") - Q-6.
- plan "verify": a class stand-in without the method gives a named warning, the fallback, a map without a black screen
  and doors that open; a new prototype assignment outside the register fails; `runContract()` without failures on
  2.10.5; `diagnose()` copied with one click; a macro with a missing actor gets a warning naming the function; a key
  removed without an alias fails the surface test.
- Amend 05.10 A (S18-90): the `DRPG` aggregate's `ECLIPSE_FREE_PLACEMENT` is to be a frozen `[]` from E37; E52 removes
  it with a release note or describes it as withdrawn, and `eclipseMovesLeft` as always a number. Q-5.
- Amend 05.10 C: two rows from E67 - the user permission entry `BROADCAST_AUDIO` (setting-entry) and avclient-livekit
  `canUserBroadcastAudio` (override); the fallback: nobody blocked, a GM notice, a Pre-season row. Q-4.
- Amend 11.10 A7: `game.drpg.openNotices()` in the stable API; rows: `deleteChatMessage` without `deleteAll`, own
  delete options reaching other clients' hook (E81's withdraw), `Notifications.LIFETIME_MS`, TooltipManager's
  `data-tooltip-html`/`aria-label` through `cleanHTML`, the synchronous client-setting write.
- Amend 11.10 A9 and A8: rows for the LiveKit room's events and `getParticipantFVTTUser`, the microphone audio anchor,
  `attachAudioTrack`, the popout id, the `core.webrtc` menu, `VOICE_MODES`, the client keys (`users.<id>.*`, `muteAll`,
  `hideDock`, `permissions.BROADCAST_AUDIO`), `core.pushToTalk`, `getConnectedUsers`; `ui.controls.activate`,
  `#scene-controls`, `#sidebar`, `#chat-notifications`, the adopted nodes, `ui.sidebar.toggleExpanded`/`changeTab`,
  `_shouldShowNotifications`/`_toggleNotifications`, the theme classes, `icons/fvtt.png`, `core.dismiss`'s order,
  `core.focusChat`, ImagePopout's options (plan.json's amendment holds the full list and Foundry's lines).
- Amend 11.10 and 27.10 (variant B): `tools/api-surface.json` is born with E70's functions and the aliases
  `advanceFloorNow`, `extendFloor`, `endFloor`; E73 adds its own names later.

## The 10 issues, each to its rows (issues.json; the "fix" there is the reviewer's proposal, the rows below bind)
| issue | sev | in short | rows | commit |
| --- | --- | --- | --- | --- |
| S17-50 | high | no register of the reaches into Foundry, Daggerheart and modules; a system update silently stops a layer | E52-01, E52-03..12 | C1-C3 |
| S01-50 | low | PATCHES has no `drawSelect` row; "Eight places"; selection.mjs's dead fallback and header | E52-02, E52-03 | C1 |
| S17-51 | low | no single diagnostics report; no API surface test | E52-14, E52-15, E52-21 | C4, C6 |
| S01-62 | info | a silenced recommendation cannot be undone from the UI | E52-16 | C4 |
| S01-39 | low | any big inline sheet of another module raises a permanent "an extension is repainting" warning | E52-17 | C5 |
| S01-51 | low | diagnostics behind the code: Stained Glass fonts, VT323, `woff2?v=2`, `fontSize`, `masked`, `traceClicks`, `perfReport` | E52-18 | C5 |
| S01-42 | low | a typo in an actor id is a silent null; `traitValue` throws destructured | E52-19 | C6 |
| S01-52 | low | api.mjs comments that disagree with the code, `gatherEveryone`, `atOwnVault`, duplicate imports | E52-20 | C6 |
| S01-56 | low | migration names tied to "1.2.0" on the public surface | E52-20 | C6 |
| S18-90 | med | (amend 05.10 A only: the aggregate's key and `eclipseMovesLeft`'s description; the rule is E37's) | E52-22 | C6 or after E37 (Q-5) |

## What HEAD already does (at bc158f09, read by symbol)
- patches.mjs `PATCHES`: 13 rows `{ target, owner, file, why, when, probe }` ("Thirteen places"), read by
  `diagnosePatches`, requirements.mjs `newerSystemFindings`, R130, R217, the tier-1 passages tests, two tier-2 tests
  (a drawn statistic readable; a veiled card and the Chat tab), scenario 76 B. No kind, no fallback, no run at ready.
- Overrides not in `PATCHES` (git grep of assignments in scripts/*.mjs): selection.mjs `patchDragRectangle`
  (`ControlsLayer.prototype.drawSelect`, mark `drpgPatched`), projects-ui.mjs `wrapCountdownMenu`
  (`DhCountdowns.prototype._getCountdownContextOptions`, mark `MENU_DONE`), fog.mjs `registerDoorControls`
  (`CONFIG.Canvas.doorControlClass` subclassed), selection.mjs `applySelectionColour`
  (`CONFIG.Canvas.dispositionColors.CONTROLLED` written). `SHEET_ANCHORS` does not exist: sheet.mjs reads about 25
  Daggerheart selectors as literals (".character-sidebar-sheet ...", ".tab-navigation", "section.tab", ...).
- Fallbacks that exist, each in its own file: roll-draw.mjs `reviewBuild`/`seamFor`/`rollDrawState` (a build not the
  reviewed one is left alone, rolls thrown as in 1.2.66, GMs told once per version: D1, owner's Q2 (a) 03.10);
  relay-guard.mjs `fingerprintOf`/`relayGuardStatus` (unreviewed shapes refused, a backstop, "NOT guarded" told on every
  load); roll-dialog.mjs (`_prepareContext` of another shape: never, said once); private-rolls.mjs and secret.mjs warn
  "see diagnosePatches()"; passages.mjs (a GM told at every load); fog.mjs `registerDoorControls` warns when
  `doorControlClass` is not a function, but subclasses any function, `isVisible` read through `super` unchecked;
  rooms.mjs `onLevel` falls back to `region.levels.has` when `includedInLevel` is absent, not when it throws.
- Setting entries: enforced.mjs `ENFORCED` (`isoWelcome` = isometric-perspective `showWelcome`, `liveKitInFoundry` =
  `useExternalAV`, `rtcDock` = `core.rtcClientSettings`, `hideDock`) and, since E20 C6, `FOUNDRY_WRITES` with
  `giveBackFoundry`; voice-client.mjs reads `game.settings.settings.has("avclient-livekit.useExternalAV")`;
  dice-sync.mjs reads and writes `flags.dice-so-nice.appearance`; voice-tile.mjs `toggleBlock` writes
  `permissions.BROADCAST_AUDIO`. `canUserBroadcastAudio`: 0 hits (E67 builds the dead's microphone block).
- Hooks of other packages: forced-roll.mjs `daggerheart.postDualityRollConfiguration`; murder-rules.mjs
  `renderD20RollDialog`; private-rolls.mjs `diceSoNiceMessagePreProcess`; `diceSoNiceReady`, `renderDhCountdowns`,
  `renderCharacterSheet`, `liveKitClientInitialized`, `getHeaderControlsImagePopout` (room-tile.mjs). roll-draw.mjs
  `reviewBuild` already checks the template `post${...}RollConfiguration` in `buildConfigure`'s source. No "fired" mark.
- A7/A8/A9 names at Base: present - `activeSpeakersChanged`, `getParticipantFVTTUser`, `camera-view-`,
  `user-microphone-audio`, `muteAll`, `liveKitRoom` (voice-tile.mjs, trial-speakers.mjs, voice*.mjs);
  `controls.activate(`, `toggleExpanded`, `changeTab`, `dismiss`, the theme classes (foundry-windows.mjs
  `adoptFoundryNodes`); `deleteAll`, `data-tooltip-html`, `cleanHTML` (notice-history.mjs); `openNotices` on
  `game.drpg`. Not named anywhere (0 hits): `LIFETIME_MS`, `_shouldShowNotifications`, `_toggleNotifications`,
  `attachAudioTrack`, `VOICE_MODES`, `getConnectedUsers`, `focusChat`, `icons/fvtt.png`, `#chat-notifications`.
- Diagnostics: 18 `diagnose*` in 10 files (diagnostics.mjs Dice, Despair, Styles, Windows, TruthBullets, GmStores,
  Voice, Characters; fog.mjs Scenes, Fog; live, music, own-ring, patches, secret, sfx, traps, visibility), plus
  `traceClicks`, `perfReport`, migrate.mjs `migrationStatus`, utils.mjs `sessionFailures` (copied by gm-panel.mjs
  `openFailureLog` through `game.clipboard.copyPlainText`). No `diagnose()`.
- diagnostics.mjs `detectPageTinting`: any inline sheet of 200+ rules is "an extension"; `warnAboutPageTinting` posts a
  permanent notice on it. S01-51 at Base: `diagnoseTruthBullets` reads `remnantStore` first (part fixed);
  `/\.woff2$/`, `ui.fontSize`, the `masked` branch, no VT323 or Stained Glass font check remain.
- No recommended-modules window since E13 C10 (`recommendsSilenced` "a value no code reads any more", settings.mjs);
  the one silence left is `systemWarningSilenced` (per Daggerheart version, client).
- api.mjs: header "Treat this as the stable surface"; `normalise`/`wrap`/`asActor` (unknown string -> null, silent;
  `getName` takes the first of two); `traitValue` reads `this.traitKey`; `migrate1_2_0` ("1.2.0 data migration");
  imports from diagnostics, projects, remnants twice each; `advanceTimeOfDay` "Refills nothing by default", "Full
  Gamemasters only", "bedroom only" still there; call-effects.mjs `gatherEveryone` is a local import, not `game.drpg`; vault.mjs `atOwnVault` "Compatibility" but not on `game.drpg`. E70's names and the three
  aliases are on `game.drpg`; `trialVoice` (trial-floor.mjs) is not. `config: DRPG` carries `ECLIPSE_FREE_PLACEMENT =
  ["night"]`, live (E37 not done); `eclipseMovesLeft` may answer null at night. No `tools/api-surface.json`.

## Acceptance
| id | promise | how it is checked | commit |
| --- | --- | --- | --- |
| E52-01 | one register: each row `{ id, kind, target, owner, file, why, when, probe, fallback }`, kinds override, hook, setting-entry, flag, socket, anchor, call (Q-3); the 13 rows kept; the header names no fixed count; `diagnosePatches()` stays, reading the register (S17-50) | R-next t1 (every row whole; kinds from the list) | C1 |
| E52-02 | rows for `drawSelect`, `_getCountdownContextOptions`, `dispositionColors.CONTROLLED`, `doorControlClass`; selection.mjs's fallback comment and header true (door, light and sound icons keep Foundry's colour) (S01-50) | R-next t1 (each probe ours on the suite's world) | C1 |
| E52-03 | tier 0: every assignment to another package's prototype, class, static or `CONFIG` class in scripts/*.mjs (and `Object.defineProperty` on one) has a row naming its file; every `Hooks.on` name is a row or on the test's list of Foundry's public hooks (Q-3) | R-next t0 (red first: `drawSelect`, `_getCountdownContextOptions`) | C1 |
| E52-04 | `runContract()` at ready on the primary GM, after `requirementsMet`, once per load; each row ok / failed / unknown; a probe that throws is failed with its message; unknown is a warning, never green (risk) | R-next t1; E52-T1 (t2: the suite's world, no failed row) | C2 |
| E52-05 | a failed row: its fallback in effect, one permanent GM notice per load listing each target with file:symbol and the fallback; a Pre-season checks line (`preSessionReport`) with the same rows | R-next t1 (a stand-in row failing: the notice, the report line) | C2 |
| E52-06 | the trust rows read their own state: the relay guard row `relayGuardStatus` and the guard first among the channel's listeners; the roll draw row `rollDrawState` ("changed" = failed, D1's fallback named); `_prepareContext`, `isContentVisible`, the chat log's notify; `runContract` changes none of their fallbacks (Q-6) | R-next t1 (stand-ins: guard second, build changed); mutants m1-m3 | C2 |
| E52-07 | `doorControlClass`: a Foundry class whose prototype chain has no `isVisible` getter is left as Foundry's (doors open), the row failed and named (plan "verify") | R-next t1 (red first: a stand-in Base without `isVisible` - today `super.isVisible` is undefined and players' doors hide); m4 | C2 |
| E52-08 | Levels: an `includedInLevel` that throws is read as "on every floor" (`onLevel`), said once, the row failed; no black screen (plan "verify") | R-next t1 (red first if today's `onLevel` throws on it - the implementer measures and says) | C2 |
| E52-09 | hook rows with "fired": the hooks of other packages above mark their first call per load; never fired = unknown, with the road that would fire it | R-next t1 (a hook called: ok; none: unknown) | C3 |
| E52-10 | setting-entry and flag rows read from enforced.mjs `ENFORCED`/`FOUNDRY_WRITES` (no second list), plus `dice-so-nice.appearance`, `permissions.BROADCAST_AUDIO`, the A9 client keys, `core.pushToTalk`, the `core.webrtc` menu; a missing entry: the module does not write it, said | R-next t1 (each present in the harness; one removed: failed, not written) | C3 |
| E52-11 | call rows of A7, A8, A9: a presence probe where Foundry exposes the name; where it does not (the 0-hit list above), unknown with its LIVE row | R-next t1; LIVE-E52-01..03 | C3 |
| E52-12 | anchor rows: the ~25 sheet selectors as `SHEET_ANCHORS` in patches.mjs, probed at the first character sheet render; A8/A9's DOM anchors; a tier-0 reader holds each selector to its literal in its file (Q-7); a missing one named | R-next t0 (each selector found in its file); R-next t1 (a sheet stand-in without one: named) | C3 |
| E52-13 | (amend 05.10 C) `permissions.BROADCAST_AUDIO` as setting-entry now; `canUserBroadcastAudio` with E67 (Q-4) | R-next t1 (the entry's row) | C3 |
| E52-14 | `game.drpg.diagnose()`: every diagnose* this client may run, `migrationStatus`, the contract, `sessionFailures`, one text; a window with "Copy report" (`game.clipboard.copyPlainText`); returns the text (S17-51) | R-next t1 (each section present; the copy called once); E52-T2 (t2: on the suite's world, no section throws) | C4 |
| E52-15 | on a player, nothing of the GMs': no `diagnoseGmStores`, no ledger or `remnantStore` reads, no other player's data | R-next t1 (a player stand-in: a seeded GM-only string absent; the GM-only sections listed as "GM only") | C4 |
| E52-16 | the silences the module keeps listed by id with "Show again" (`systemWarningSilenced`; the stale `recommendsSilenced` named and cleared) (S01-62, Q-8) | R-next t1 | C4 |
| E52-17 | page tint: a notice only for a named Dark Reader; an unnamed inline sheet is a log line and a `diagnoseStyles` line; sheets whose owner node is a module's or the system's skipped (S01-39) | R-next t1 (red first: a 250-rule inline sheet without `--darkreader-` gives no notice) | C5 |
| E52-18 | diagnostics follow the code: fonts by theme (`glassOn()`: VT323, Special Elite and 2-3 Stained Glass tokens), VT323 in `diagnoseWindows`, `/\.(css|woff2)(\?|$)/`, `fontScale`, the `masked` branch gone, `traceClicks` with a bubble listener, `perfReport` with a warm-up, JSDoc over its functions (S01-51) | R-next t1 (red first: `pixel.woff2?v=2` read as missing) | C5 |
| E52-19 | `wrap`: a non-empty string that finds no actor warns with the function and the value; a name two actors share warns and acts as today (`getName`'s first) (Q-7); `traitValue` works destructured (S01-42) | R-next t1 (red first: the silent null, the TypeError) | C6 |
| E52-20 | `game.drpg.migrate()`, `migrate1_2_0` its alias (deprecated, kept at least one release); migrate.mjs header describes the mechanism, the log says "the data migration"; api.mjs's eight comments re-read, the wrong ones rewritten; one import per module; the `gatherEveryone` and `atOwnVault` comments true (S01-52, S01-56) | R-next t1; R-next t0 (no module imported twice in api.mjs); tier-0's `migrate1_2_0` reader still green | C6 |
| E52-21 | `tools/api-surface.json`: every `game.drpg` key with its kind, aliases with their target and release; `openNotices`, E70's names, `advanceFloorNow`, `extendFloor`, `endFloor`; `trialVoice` exposed (Q-7); a test: the live surface equals the file, a key gone without an alias entry fails, an alias to nothing fails (D25) | R-next t0 (red first: a planted removal) | C6 |
| E52-22 | `ECLIPSE_FREE_PLACEMENT` and `eclipseMovesLeft` described as the code is when E52 closes (Q-5) | R-next t1 (the surface file's note matches config.mjs) | C6 |
| E52-23 | the books EN/PL: GM handbook - the contract, each fallback in words, `diagnose()` and "Copy report"; the macro API page from `tools/api-surface.json`; `stages.json` touches; LIVE rows as B-E52-n | parity, prose, 50, `check live` | C7 |

## Rules of this stage
- No row a player's browser sends is added; `runContract` writes nothing to the world (a client's memory and the GM's
  notice). A probe is read-only and wrapped (`try`), and costs nothing per frame: at ready and at a first render only.
- The trust rows (relay guard, roll draw, `isContentVisible`, `_prepareContext`, the chat log's notify) keep their own
  fallbacks and words; the register reads them and never turns a failed state into a looser one. C2 is MARKED for that.
- One list per fact: setting-entry rows read `ENFORCED`/`FOUNDRY_WRITES`; anchor rows are the selectors the code uses,
  held by a tier-0 text reader; no second copy of either.
- New text EN and PL in pairs; `parity` and `prose` green; no long dash. Console lines stay English.
- No new file in scripts/ (patches.mjs, diagnostics.mjs and api.mjs hold it); `tools/api-surface.json` is new.
- README.md: only its version line (line B). sheet.mjs is E66's, E51's and E37's: E52 edits it only where a red test
  proves an injection throws on a missing anchor (a guard line), said in STATUS.

## Commits
### C1 - one register, held to the code (S17-50 part, S01-50)
- Files: patches.mjs (`PATCHES` -> the register's shape, `diagnosePatches`), selection.mjs (comment, header),
  requirements.mjs (`newerSystemFindings` reads the system's rows by `owner` as today), lang.
- Tests: R-next t1 E52-01, E52-02; R-next t0 E52-03. --own: R130, R217, the tier-1 passages tests reading `PATCHES`.
  --scen: 76 (B reads the passages row).

### C2 - runContract, the fallbacks, the notice and the Pre-season line (S17-50) [MARKED: rows that judge the relay guard and the roll draw]
- Files: patches.mjs (`runContract`, `contractState`), module.mjs (ready, primary GM, after `requirementsMet`),
  fog.mjs (`registerDoorControls`), rooms.mjs (`onLevel`), season-setup.mjs (`preSessionReport`'s contract line),
  relay-guard.mjs and roll-draw.mjs (read only: `relayGuardStatus`, `rollDrawState`), lang.
- Tests: R-next t1 E52-04..08; E52-T1. --own: R217, R130, the two tier-2 tests above. --scen: 30 83 (cap 2).

### C3 - the rows the plan and the amendments name (S17-50 rest; amend 05.10 C, 11.10 A7, A8, A9)
- Files: patches.mjs (hook, setting-entry, flag, call and anchor rows; `SHEET_ANCHORS`; the "fired" mark), the hooks'
  files (forced-roll.mjs, murder-rules.mjs, private-rolls.mjs, projects-ui.mjs, room-tile.mjs, voice-client.mjs: one
  mark per listener), enforced.mjs (export read), lang.
- Tests: R-next t1 E52-09..13; R-next t0 (anchors). --own: tier-2 tests naming `ENFORCED` or `giveBackFoundry` (E20-T4).
  --scen: 75 (voice tile anchors).

### C4 - one report: diagnose() and "Copy report"; the silences (S17-51 part, S01-62)
- Files: diagnostics.mjs (`diagnose`, the window), api.mjs (`diagnose`), settings.mjs (`recommendsSilenced` cleared),
  requirements.mjs (`systemWarningSilenced` Show again), styles (both themes, the report's block), lang.
- Tests: R-next t1 E52-14..16; E52-T2.

### C5 - the diagnostics tell the truth (S01-39, S01-51)
- Files: diagnostics.mjs (`detectPageTinting`, `warnAboutPageTinting`, `diagnoseStyles`, `diagnoseWindows`,
  `traceClicks`, `perfReport`), lang.
- Tests: R-next t1 E52-17, E52-18; --own the tier-1 test reading `detectPageTinting`.

### C6 - the macro API by D25 and its surface (S01-42, S01-52, S01-56, S17-51 part; amend 05.10 A, 11.10, 27.10)
- Files: api.mjs (`asActor`, `wrap`, `traitValue`, `migrate`, `trialVoice`, comments, imports), migrate.mjs (header,
  log), call-effects.mjs and vault.mjs (comments), tools/api-surface.json (new), lang.
- Tests: R-next t1 E52-19, E52-20, E52-22; R-next t0 E52-20, E52-21. --own: the tier-0 `migrate1_2_0` reader.

### C7 - books, stages.json, LIVE rows
- docs/handbooks (GM EN/PL), `tools/stages.json` (E52 touches `[]`), audit 9.2 rows B-E52-n, R-REGISTRY.

### Mutants (C2 only; mut.sh, each old text once at the commit, grep -c -F)
m1 the relay guard row ok when the guard is second; m2 a roll draw "changed" read ok; m3 a probe that throws counted
present; m4 `registerDoorControls` subclasses a Base without `isVisible`. Each turns its R-next t1 red.

## What only a table can show
- LIVE-E52-01 (B-E52-1): `runContract()` on Foundry 14 with Daggerheart 2.10.5 (plan "verify"): no failed row.
- LIVE-E52-02 (B-E52-2): the A7 rows a probe cannot read (`LIFETIME_MS`, the delete options on other clients,
  `cleanHTML` of the tooltip, the synchronous client write) checked at a table.
- LIVE-E52-03 (B-E52-3): the A8/A9 rows (`attachAudioTrack` volume and muted, `VOICE_MODES`, `getConnectedUsers`,
  `_shouldShowNotifications`, `core.dismiss`'s order, `core.focusChat`) with LiveKit live.
- LIVE-E52-04 (B-E52-4): "Copy report" pastes whole in a browser (clipboard permission), GM and player.

## Out of scope
- `canUserBroadcastAudio` and the dead's microphone block -> E67. The `ECLIPSE_FREE_PLACEMENT` rule -> E37 (line A).
- E73's API names -> E73. A behaviour probe per Daggerheart release -> E01's. A player's failed rows to the GM -> no (Q-2).

## Owner questions (each with a default; the stage runs on the default)
- Q-1 Base: E52 builds on bc158f09 (E20, not yet in main), since it edits diagnostics.mjs, requirements.mjs,
  season-setup.mjs, enforced.mjs after E20. Default: yes; `git merge origin/main` when E20 ships.
- Q-2 Where `runContract` runs: the primary GM at ready (the plan); any client through `diagnose()`; a player's failed
  rows stay on that client. Default: yes, no new socket row.
- Q-3 Kinds: the plan's five plus "anchor" (a DOM selector) and "call" (a method or constant the code calls or relies
  on); every amendment item gets a row, unknown where no probe can read it. Hooks: rows for other packages' hooks;
  Foundry's public hooks are a list in the tier-0 test. Default: yes.
- Q-4 `canUserBroadcastAudio` (amend 05.10 C): 0 hits at Base. Default: E52 adds the `BROADCAST_AUDIO` entry row now;
  the override row and its fallback come with E67.
- Q-5 `ECLIPSE_FREE_PLACEMENT`: live at Base (E37 not done). Default: E52 lists it as it is; if E37 ships first, C6
  marks it withdrawn and `eclipseMovesLeft` "always a number"; else E37 does, and the surface test holds it.
- Q-6 D24 read as: a failed probe gives the fallback each file already has, the GMs told; on the rolls, D1's fallback
  (rolls thrown in the player's browser as in 1.2.66, owner's Q2 (a) of 03.10) stays and nothing new loosens. Default:
  yes - please confirm D24's and D25's text.
- Q-7 API: an ambiguous name warns and acts as today (no macro breaks); `migrate1_2_0` kept until at least 1.3.1;
  `trialVoice` added (your 11.10 list); `SHEET_ANCHORS` in patches.mjs with a text reader, sheet.mjs untouched (E66).
  Default: yes to all four.
- Q-8 "Show again": the only silence at Base is the newer-Daggerheart warning (per version); the recommended-modules
  window is gone since E13 C10. Default: the report lists it with "Show again" and S01-62 closes on that.
