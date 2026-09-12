# CORE (campaign flow) - findings

## Files read (with line counts)

Domain, end to end: clock.mjs 407 · chapter.mjs 1042 · season-setup.mjs 917 · gm-panel.mjs 1200 · hud.mjs 1577 · player-status.mjs 497 · day-summary.mjs 120 · sync.mjs 376 · api.mjs 1365 · module.mjs 432 · requirements.mjs 122 · migrate.mjs 659 · pre-session-note.mjs 108 · live.mjs 576 · rest.mjs 337 · assignments.mjs 164 · character.mjs 211 · level-up.mjs 363 (10 473 lines).

Followed into neighbours where a flow crossed: settings.mjs (SETTINGS registry, DEFAULT_CLOCK, getClock/incomingTimeOfDay/bodyDiscovery*, onWorldChange), utils.mjs (gmIds/isPrimaryGm/primaryGmId/plural/announce/whisperToGms), eclipse.mjs (startEclipse/endEclipse/clearParkedMurders/registerEclipse), actions.mjs (resetAllActions/resetActionsFor), search-tokens.mjs (max/left/sealed/reset), call-effects.mjs (clearSeals/pendingGather/cancelGather/runPendingGather), rules.mjs (motive/tickMotive/untickMotive/rules), vote.mjs (trialProgress/trialProgressChapter/setTrialProgress), trial-floor-ui.mjs (closeTrial, manageClassTrial buttons), murder.mjs (registerMurder hooks, sweepBetrayalWindows), remnants.mjs (flushTraceDigest hooks), investigation.mjs (keyRemnantPlan usage), monocub.mjs (setMonocub), music.mjs (hook wiring), sfx.mjs (flag shape), config.mjs (TIMES_OF_DAY, PHASES, CHAPTERS_PER_SEASON, ECLIPSE_FREE_PLACEMENT), tests.mjs (chapter-end and season-reset tests), lang/en.json (every literal `DRPG.*` key in the 18 files was checked by script - all present, the 21 "missing" hits were `.one/.other` pairs consumed through `plural()`; every dynamic prefix - Season.step/hint, Panel.section/state, Floor.mode, Hud.trial, Murder.stage/side, Requirements.state, Advance.reason/kind, Note.q1-7 - has the full set of leaves).

## Strengths

- The clock is written in ONE place (`setClock`) and every reader goes through `getClock()` from the leaf module; the time-of-day stamp, the phase-change side effect and the Eclipse flag ride the same write, so the "old label flashes between Eclipse and next hour" class of bug is structurally closed (clock.mjs:183-199).
- Refresh is belt-and-braces: every world setting's `onChange` routes to `sync.applyFor`, the socket carries the fast path, and `apply()` coalesces the pair with newest-data-wins (sync.mjs:180-205). A player with a dropped socket still redraws.
- Two-GM discipline is real: `runPendingGather`, `settleElapsedPause`, `maybeBodyFound` (via murder.mjs's `updateToken`), the four load-time repair passes and the migration are all gated on `isPrimaryGm()`, and the gate is inside the closure for `sealProjects` so a later-joining GM still listens (module.mjs:376-384).
- `applyChapterEnd` is a pure function of the world with the dialog split off, and it is exercised by a real test that drives a trial open and shut (tests.mjs:3704-3745). Order of operations (reveal -> sweep -> remnants -> archive plan -> clear blackened -> move clock -> close trial -> next morning -> clear body) is right and each step says why.
- `wipeSeason` is a list of independently guarded steps, refills the budget AFTER restoring the sheet, and clears both halves of the overflow through the one definition of empty; a typed confirmation with live counts in front of it.
- `keepLive` is a well-designed primitive: never redraws under the cursor, carries scroll/fold/dirty-field/tab state, and stops itself on close. The GM panel, Who-is-alive and the trial console all use it instead of hand-rolled refreshes.
- Migration: every clause is idempotent (checked one by one), removals are read back, a failed clause withholds the stamp, and `since` prevents re-seeding after a GM has deliberately removed something.

## Findings

### CORE-01 [severity: major] [category: gm-ease] [CONFIRMED]
**Where:** gm-panel.mjs:992, gm-panel.mjs:1193-1199, clock.mjs:154-176 (`advanceTimeOfDay` has no UI caller except `endEclipse`)
**What happens:** The most repeated GM gesture - "everyone has acted, move the clock" - is answered by the panel's Next line with `action: "jump"`, i.e. the full campaign editor. From the launcher that is: GM button (1) -> "Do it" (2) -> open the time-of-day select (3) -> pick the next hour (4) -> tick "Also refill" (5) -> Apply (6), and the GM must know that Night rolls into a new day/session and bump those two fields by hand, because `openClockDialog` writes exactly what the form says. With the refill box left off (the hint tells them to leave it off), `applyTimeOfDayChange` never runs: no `checkOverflow`, no search-token restock, no `clearSeals`, no `tickMotive`, no `SYNC.clock` broadcast (the setting's `onChange` covers the HUD, nothing covers the rest). The suggestion also contradicts the rules the module implements: the boundary between two times of day IS the Eclipse (`startEclipse` refills, `endEclipse` advances), and the HUD chevron already does that in two clicks - but the panel sends the GM to the bookkeeping tool instead. The release notes list this as known; the argument for fixing it now is that the pointer is not merely slow, it points at the one route that skips the boundary work.
**Evidence:**
```js
// gm-panel.mjs:990-992
return stillActing.length
    ? { text: plural("DRPG.Panel.nextStillActing", { n: stillActing.length }), action: null }
    : { text: game.i18n.localize("DRPG.Panel.nextAllDone"), action: "jump" };
// gm-panel.mjs:1193 - the only path that runs applyTimeOfDayChange from the editor
if (result.reset) { await setTimeOfDay(result.timeOfDay, { resetActions: true, ... }); }
```
**Fix:** (a) Point the Daily-Life suggestion at the Eclipse: `action: "eclipse"` already exists in `EXTRA_ACTIONS` and `toggleEclipse()` starts one when none is running - a one-word change makes "Do it" the rule-correct one click. (b) Add an `advance` entry to `EXTRA_ACTIONS` (`run: () => advanceTimeOfDay({ resetActions: true })`) and a "Next time of day" button in the standing block beside the clock line for tables that skip the Eclipse; text: "Start the {next} Eclipse" / "Next time of day". (c) Keep "Edit campaign" for corrections only and say so in `DRPG.Panel.nextAllDone`.
**Pitfalls:** `advanceTimeOfDay({ resetActions: true })` hands out a second budget if an Eclipse already refilled this hour - only offer the direct advance when `!isEclipse()`, and note in the tooltip that it refills. The HUD's own tooltip for the chevron already explains Night -> new session; reuse those strings.

### CORE-02 [severity: major] [category: bug] [CONFIRMED]
**Where:** season-setup.mjs:887-897 (the settings loop) vs call-effects.mjs:568-573, 684-700
**What happens:** A called assembly (`SETTINGS.pendingGather`) survives the season reset. The order is stamped with the time of day and session it was called in; the reset sets the clock to morning/session 1, so on the first advance of the new season `runPendingGather` sees `clock.timeOfDay !== order.timeOfDay` (or a different session), clears the order and teleports the whole new cast into last season's room with the Public Announcement banner and sound. Until then the HUD carries an "Assembly - <room>" row (hud.mjs `buildAssembly`) from the moment the reset finishes.
**Evidence:**
```js
// season-setup.mjs:887-896 - what is cleared
["the trial floor", SETTINGS.trialQueue, {}], ["search tokens", SETTINGS.searchTokens, {}],
["Eclipse placements", SETTINGS.eclipseMoves, {}], ["the Key Remnant plan", SETTINGS.keyRemnantPlan, {}],
["discovered rooms", SETTINGS.discoveredRooms, {}], ["the motive", SETTINGS.motive, {}],
["the trial's progress", SETTINGS.trialProgress, {}], ["the body waiting to be answered", SETTINGS.bodyFound, {}]
// call-effects.mjs:695
if (clock.timeOfDay === order.timeOfDay && clock.session === order.session) return null;
```
**Fix:** Add `["a called assembly", SETTINGS.pendingGather, {}]` to that loop (a direct write, like the motive, so nothing is announced into a chat that is being deleted).
**Pitfalls:** `cancelGather()` posts a card and plays a sound - do not use it here.

### CORE-03 [severity: major] [category: bug] [CONFIRMED]
**Where:** season-setup.mjs:887-897; rules.mjs:36-43; lang/en.json:2704 (`resetState`) and `resetKeeps`
**What happens:** `SETTINGS.killingGameRules` is not touched by the reset and `rules()` returns every stored rule regardless of chapter, so every character sheet in the new season opens with last season's Monokuma rules in the Effects slot (they sync through `SYNC.rules`). Neither the "This goes" list nor the "This stays" sentence mentions the rules, so the GM is not told either way.
**Evidence:**
```js
// rules.mjs:36-40
export function rules() { const stored = game.settings.get(MODULE_ID, SETTINGS.killingGameRules); return Array.isArray(stored) ? stored : []; }
```
**Fix:** Either clear the rules in the reset (`["the killing game rules", SETTINGS.killingGameRules, []]`) and add "the killing game rules" to `DRPG.Season.resetState`, or - if a table keeps standing rules between seasons - add them to `resetKeeps`. Clearing is the consistent choice: the New Rule Despair Call writes here, and the reset already zeroes what was paid for it.
**Pitfalls:** The rules setting is an Array; `game.settings.set` with `[]` is fine, `{}` is not.

### CORE-04 [severity: minor] [category: bug] [CONFIRMED]
**Where:** rest.mjs:79-81, 91-98; season-setup.mjs:816-828 ("advancement" / "the action budget" steps); murder.mjs:293-305
**What happens:** `FLAGS.restsTaken` is per-actor and stamped `s<session>` (long) / `d<day>:<timeOfDay>` (short). The reset puts the clock back to session 1, day 1, morning without clearing the flag, so any student who took a Long Rest in session 1 of the old season is told "You have already taken a Long Rest this session" for the whole first session of the new one; same for a Short Rest taken on day 1 morning. `FLAGS.betrayalWindow` (`{chapter, day}`) has the same shape of hole: a window opened on chapter 1 day 1 last season reads as open on chapter 1 day 1 of the next until the clock moves past it.
**Evidence:**
```js
// rest.mjs:80
return kind === "long" ? `s${clock.session}` : `d${clock.day ?? 1}:${clock.timeOfDay}`;
```
**Fix:** In `wipeSeason`'s "the action budget" step, `await actor.unsetFlag(MODULE_ID, FLAGS.restsTaken)` and `unsetFlag(MODULE_ID, FLAGS.betrayalWindow)` for every student.
**Pitfalls:** `unsetFlag` on an absent flag is a no-op in Foundry; no guard needed.

### CORE-05 [severity: major] [category: flow] [CONFIRMED]
**Where:** trial-floor-ui.mjs:475-476; grep: `openChapterEndDialog` is called from nowhere else in the interface
**What happens:** The End of chapter screen has exactly one door on screen, the trial console's "End of chapter / new session" button, and it is `disabled: !progress.verdictApplied`. A chapter that ends without a verdict has no interface route at all: the guide's own "stretch the chapter when no murder happened" (clock.mjs header), a chapter closed by a confession or a GM ruling, a modular one-chapter season, or a GM who ended the trial with "End the trial" before applying the verdict (the trial console's `end` button is always available; `verdictApplied` then stays false for good). The console fallback `game.drpg.chapterEndDialog()` exists but the release notes' own standard is "nothing called from the console".
**Evidence:**
```js
// trial-floor-ui.mjs:475-476
{ action: "chapterEnd", label: game.i18n.localize("DRPG.Chapter.endTitle"),
  disabled: !progress.verdictApplied, default: isDefault("chapterEnd") }
```
**Fix:** Add an "End of chapter" tile to the panel's `between` section (it is a between-sessions act by the file's own definition), and in the console keep the button enabled but not default until the verdict is applied. `openChapterEndDialog` already counts and disables what does not apply, so it is safe to reach early.
**Pitfalls:** A GM who reaches it mid-trial gets the "Close the trial" box pre-ticked; that is correct and already tested.

### CORE-06 [severity: minor] [category: leak] [CONFIRMED]
**Where:** hud.mjs:1480-1516 (`paintElapsed`), hud.mjs:186-211 (`clockForDisplay`), hud.mjs:1436-1440
**What happens:** During an incident an outsider's HUD is meant to freeze on the last public clock so that the GM moving the hour does not tell the room something is happening. The time-of-day label does freeze, but `paintElapsed` reads `getClock()` directly, and `timeOfDayStartedAt` is restamped on every hour change - so the frozen "Night" label sits over a minutes counter that snaps from "27 min in" to "0 min in" the instant the GM advances. That is the tell the freeze exists to hide. A player who reloads mid-incident also gets the true clock (`lastPublicClock` is `null` until a public render), which the design note half-admits.
**Evidence:**
```js
// hud.mjs:1500 - inside paintElapsed, not the display clock
const clock = getClock();
const startedAt = clock.timeOfDayStartedAt;
```
**Fix:** Pass the display clock into `buildElapsed(clock)`/`paintElapsed(el, clock)` from `renderHud` (it already has `clock = clockForDisplay(getClock())`), and have the interval closure capture it. For the reload case seed `lastPublicClock` from the incident's own stamp: `murderState()` carries the hour it began in; if not, store `clockAtStart` in the murder state when it opens.
**Pitfalls:** The trial branch (`paintFloorClock`) must keep reading the real floor; only the minutes branch changes.

### CORE-07 [severity: minor] [category: text] [CONFIRMED]
**Where:** lang/en.json:1473 (`DRPG.Chapter.endNote`), rendered at chapter.mjs:830
**What happens:** The End of chapter screen now carries three deleting checkboxes (sweep Truth Bullets, clear Faint Remnants, take Key Remnants off the map - 1.2.42), and directly under them prints "Nothing else here deletes anything: clearing Faint Remnants and sweeping Truth Bullets are the GM's own tools, in the Investigation Dashboard." The sentence is false on the screen it is printed on and contradicts `tidyNote` two lines above it.
**Evidence:**
```json
"endNote": "Revealing the types is permanent. Nothing else here deletes anything: clearing Faint Remnants and sweeping Truth Bullets are the GM's own tools, in the Investigation Dashboard."
```
**Fix:** "Revealing the types is permanent, and so are the three clean-ups above; nothing else here deletes anything." Drop `tidyNote` or fold it into this.
**Pitfalls:** None.

### CORE-08 [severity: minor] [category: text] [CONFIRMED]
**Where:** day-summary.mjs:103-104; lang/en.json:2604
**What happens:** The summary popup's first line is formatted with the raw clock key: "What you did during night." (lower-case internal key, not the label). `timeOfDayLabel` is one import away.
**Evidence:**
```js
phase: esc(clock?.timeOfDay ?? ""), n: mine.length
```
**Fix:** `phase: esc(timeOfDayLabel(clock?.timeOfDay))` (import from clock.mjs, already imported for `getClock`). The placeholder is also misnamed - it is the time of day, not the phase.
**Pitfalls:** None.

### CORE-09 [severity: minor] [category: text] [CONFIRMED]
**Where:** lang/en.json:445 (`Hud.bodyFoundTooltip`), :2235 (`Panel.nextBodyFound`), `Chapter.bodyNote`; clock.mjs:107-121; hud.mjs `buildBody` reads `bodyDiscovery()`
**What happens:** Three strings promise that "moving the time of day on" resolves a found body. `setClock` deliberately clears the discovery only on a PHASE change (the comment at clock.mjs:107-117 explains why); the hour only ends the silence (`bodyDiscoveryFresh`). So after the GM moves the clock the "Body found" HUD row stays, and the panel's Next line keeps saying "A body has been found. Start the Investigation, or move the clock on." with a Do-it that starts the Investigation - the second option in the sentence does nothing the sentence claims.
**Evidence:**
```js
// clock.mjs:119-121
if (patch.phase !== undefined && patch.phase !== before.phase) { await clearBodyDiscovery(); }
```
**Fix:** Reword all three to "until the GM starts the Investigation" (and, for the tooltip, "the music resumes when the hour turns"). If the intent really is that the hour can dismiss it, the `buildBody` row should read `bodyDiscoveryFresh()` instead and the Next line should skip the branch once the stamp is stale.
**Pitfalls:** Do not clear the record on the hour - `maybeBodyFound` and `freshSceneBonus` depend on it, as the clock.mjs note says.

### CORE-10 [severity: minor] [category: bug] [CONFIRMED]
**Where:** gm-panel.mjs:1102-1116; chapter.mjs:966; season-setup.mjs (chapter input `max="${CHAPTERS_PER_SEASON}"`)
**What happens:** End of chapter offers "Move to chapter 7 (from 6)" with no hint that the season is over, and the editor's chapter `<select>` lists only 1..6. Once the clock reads 7 no option matches, the browser selects the first (1), and a GM who opens Edit campaign to fix anything else - the day, the time - presses Apply and silently writes `chapter: 1`, which also makes every trial record and motive read as "another chapter".
**Evidence:**
```js
const chapters = Array.from({ length: CHAPTERS_PER_SEASON }, (_, i) => i + 1)
    .map(n => `<option value="${n}"${n === clock.chapter ? " selected" : ""}>${n}</option>`)
```
**Fix:** Build the option list as `Math.max(CHAPTERS_PER_SEASON, clock.chapter)`; on the End of chapter screen, when `chapter >= CHAPTERS_PER_SEASON` untick `nextChapter` by default and print "Chapter 6 is the last of a season - reset the season from Between sessions rather than moving to 7."
**Pitfalls:** The season-setup number input already accepts 7 (no clamp on read), so only the select is wrong.

### CORE-11 [severity: minor] [category: text] [CONFIRMED]
**Where:** lang/en.json:1490-1492
**What happens:** `doneSweep`/`doneFaint`/`doneKeys` print "Collected {n} Truth Bullet(s)." while every neighbouring count in the same card (`doneReveal`, `bodyDone`, `bulletsGone`) uses the `.one/.other` pairs through `plural()` - the exact "(s)" the utils note says was removed from 38 strings.
**Evidence:** `"doneSweep": "Collected {n} Truth Bullet(s)."`
**Fix:** Make the three pairs and call `plural(...)` in `applyChapterEnd` (chapter.mjs:951-961).
**Pitfalls:** None.

### CORE-12 [severity: minor] [category: perf] [CONFIRMED]
**Where:** sync.mjs:255-259, 274-289; hud.mjs:107-110; player-status.mjs:58-60; chapter.mjs:966-1027; eclipse.mjs:743-750
**What happens:** One clock write redraws the HUD four times on the writing client and three on every other: `SYNC.clock` runs `hud` (renderHud), `sheets` (`refreshSheets` -> renderHud again) and `eclipse` (`refreshEclipse` -> renderHud a third time, plus `visibility.applyAll` which the next line runs a second time); hud.mjs's own `updateSetting` hook adds one more, and `player-status` re-renders on the same hook. `SYNC.eclipse` is the same shape (three renderHud, two applyAll). `applyChapterEnd` writes the clock four times in a row (move, `closeTrial`, day, morning), so a chapter end is ~14 HUD rebuilds, four sheet re-renders for every open sheet, and four attempts at the turn-over animation. Cosmetically the slide resumes correctly (hud.mjs `slide`), so this is cost, not a visible bug.
**Evidence:**
```js
run("hud", () => import("./hud.mjs").then(m => m.renderHud()));
run("sheets", () => import("./clock.mjs").then(m => m.refreshSheets()));   // also renderHud()
run("eclipse", () => import("./eclipse.mjs").then(m => m.refreshEclipse())); // also renderHud() + applyAll()
```
**Fix:** Let `refreshSheets` render sheets only (rename to say so) and keep one `hud` run per kind; give `setTimeOfDay` an `also` bag like `advanceTimeOfDay` so the chapter end writes `{ day, timeOfDay }` once. Drop hud.mjs's blanket `updateSetting` hook in favour of the sync bus, or narrow it to keys that are not in `SETTING_KINDS`.
**Pitfalls:** `SYNC.searchTokens` and `SYNC.projects` rely on `refreshSheets` reaching the HUD (room pips, project row) - keep an explicit `hud` run there when the HUD render leaves `refreshSheets`.

### CORE-13 [severity: minor] [category: bug] [SUSPECTED]
**Where:** migrate.mjs:375-430 (`keepOldSafeword`), 575-583 (the `since` gate), lang/en.json:2564
**What happens:** An unstamped world runs every clause ("which is also exactly what a brand-new world needs"). `keepOldSafeword` then reads `DRPG.Safeword.word` - still "MISIUBOMBO" in en.json - and, because the fresh world's setting equals `DEFAULT_SAFEWORD`, writes that word as the new world's safeword and whispers "This world already had a safeword, so it has been kept". Every world created on 1.2.x with the English file gets a Polish in-joke as its safety word, with a card saying the module found it there. Suspected only because I cannot confirm from static reading that `migratedVersion` is truly empty on a fresh world in this Foundry (it is registered with a `""`-ish default by the `|| ""` read).
**Evidence:**
```js
if (current && current !== DEFAULT_SAFEWORD) return null;
const legacy = String(game.i18n.localize("DRPG.Safeword.word") ?? "").trim();
if (!legacy || legacy === DEFAULT_SAFEWORD) return null;
await setSetting(SETTINGS.safeword, legacy);
```
**Fix:** Run this clause only when the world shows signs of having been played before E15 - e.g. `from` non-empty and older than 1.1.39, or the clock setting differing from `DEFAULT_CLOCK` - and otherwise skip. Longer term, move the legacy word out of the shipped language file into the clause as a constant so a fresh install cannot read it.
**Pitfalls:** Worlds from before the stamp existed are also unstamped; the clock heuristic keeps them covered.

### CORE-14 [severity: nit] [category: ux] [CONFIRMED]
**Where:** gm-panel.mjs:1187-1189; lang/en.json `DRPG.Clock.eclipseStillOn`
**What happens:** `result.timeOfDay !== undefined` is always true (it is a select), so the "The clock moved, but the Eclipse is still running" warning fires on every Apply during an Eclipse, including a campaign-name edit. The text then says "End it from the GM panel" - the panel has no Eclipse tile any more (removed per the PANEL_SECTIONS note); it is the HUD chevron or the Next line's Do-it.
**Fix:** Compare against the clock read before the write (`result.timeOfDay !== clock.timeOfDay`), and say "End it from the clock's chevron or the Next line."
**Pitfalls:** None.

### CORE-15 [severity: nit] [category: hygiene] [CONFIRMED]
**Where:** api.mjs:320, 327, 330; hud.mjs:14
**What happens:** Stale comments on the public surface: `advanceTimeOfDay` "refills actions, free Moves, search tokens" (it refills nothing by default since Z2); `gmPanel` "also on the token toolbar as a clock icon" (it is the red launcher); `editClock` "also the gear on the HUD" and the HUD header's `⚙` (there is no gear; `openClockDialog` says it is deliberately not on the HUD).
**Fix:** Update the four lines.
**Pitfalls:** None.

### CORE-16 [severity: nit] [category: hygiene] [CONFIRMED]
**Where:** migrate.mjs:308, 377, 435, 490
**What happens:** The header says "Keep the entries in the order the stages run: a later clause is allowed to assume the earlier ones have been through", but the list runs 1.1.10, 1.1.15, 1.1.19, 1.1.20, 1.1.43, 1.1.39, 1.1.37, 1.1.21. Nothing depends on it today; the rule is stated and broken.
**Fix:** Reorder, or drop the sentence.
**Pitfalls:** None.

### CORE-17 [severity: nit] [category: bug] [SUSPECTED]
**Where:** chapter.mjs:938-966 (`applyChapterEnd`), season-setup.mjs `resetSeason`; murder.mjs:293-305
**What happens:** Two-GM races the primary-GM gate does not cover: `applyChapterEnd` reads the chapter when it runs, so two GMs who both have the trial console open (the reopen-after-action model makes that the normal state) and both press End of chapter inside a few seconds move the clock to chapter N+2 and reveal/sweep twice (the second pass finds nothing, but the whisper says so twice). `sweepBetrayalWindows` runs on every GM client on the clock hook - harmless (a second `unsetFlag` is a no-op) but inconsistent with the other clock-hook writers, which gate.
**Fix:** Have the dialog carry `endingChapter` into `applyChapterEnd` and refuse when `getClock().chapter !== endingChapter` ("Chapter {n} was already ended by another GM"); gate the betrayal sweep on `isPrimaryGm()` like `maybeThirdParty` two lines below it.
**Pitfalls:** The test at tests.mjs:3716 calls `applyChapterEnd({ endTrial: true })` without a chapter - keep the check optional when the key is absent.

### CORE-18 [severity: nit] [category: ux] [CONFIRMED]
**Where:** season-setup.mjs:751-758; chapter.mjs:285-297 (`reviveCharacter` -> `ui.notifications.info`)
**What happens:** The reset's "deaths and Monocubs" step calls `reviveCharacter` per dead student, each of which posts "X is no longer marked dead. The Truth Bullets that died with them do not come back." - one toast per corpse in the middle of a reset that also deletes every bullet anyway.
**Fix:** Give `reviveCharacter` a `{ quiet }` option (the same shape `initCharacter` already has) and pass it from the reset.
**Pitfalls:** None.

### CORE-19 [severity: nit] [category: flow] [CONFIRMED]
**Where:** gm-panel.mjs:983-985
**What happens:** In the Investigation phase the Next line says "Investigation. Check what has been found and what is still out there." for the whole phase; it never moves on to "Start the Class Trial", which is the one step that ends the phase (trial console -> Start). A GM who has finished the dashboard is left with a line that no longer describes the next thing.
**Fix:** When `keyPlanStatus()` reports every planned Key found (or after N times of day in the phase), suggest `{ text: "...start the trial", action: "trial" }`.
**Pitfalls:** `keyPlanStatus` reads the answer key; fine on a GM client, which is the only place the panel opens.

## Live checks recommended (things statics cannot settle)

1. CORE-13: create a fresh world on 1.2.42 with the English language file, open a character sheet, read the safeword; check chat for the "already had a safeword" whisper.
2. CORE-06: as a player outside an incident, watch the HUD's minutes line while the GM advances the hour mid-incident.
3. CORE-02/03/04: run a season reset with a called assembly pending, two killing-game rules in force and a student who took a Long Rest in session 1; then advance once and try the Long Rest.
4. CORE-01 click count: from a Daily-Life table with everyone spent, count presses from the GM button to "Noon" showing on a player's HUD with actions refilled, via the Next line versus via the HUD chevron.
5. CORE-12: DevTools performance trace over one End of chapter with three sheets open - count `renderHud` calls and sheet renders.
6. Two GMs both with the trial console open pressing End of chapter within two seconds (CORE-17).

## Hygiene metrics (largest functions, duplicated helpers, dead exports you found)

- Largest functions: `openWhoIsAliveDialog` gm-panel.mjs ~300 lines (three windows merged, wiring inside); `steps()` season-setup.mjs ~230 (mostly comments); `wipeSeason` ~200; `renderHud` ~200; `openChapterEndDialog` ~120 + `applyChapterEnd` ~130; `openClockDialog` ~120; `nextStep` ~80; `killCharacter` ~130; `slideTimeOfDay` ~90.
- Duplicated "who is a student" filters: gm-panel.mjs `nextStep`/`buildPanelContent` (two inline filters on `FLAGS.monokuma`/`deceased`/`monocub`), player-status.mjs `trackedStudents`, chapter.mjs `livingStudents`, assignments.mjs `students`, monokuma.mjs `studentActors` - five spellings of one roster, differing on whether Monocubs count.
- Duplicated "which character is mine": hud.mjs `hudActor` and player-status.mjs `ownCharacter` are the same resolution written twice (player half identical).
- `refreshSheets` (clock.mjs:398) renders the HUD as a side effect and is invoked by nine `SYNC` cases - the name hides the cost (CORE-12).
- `sweepBetrayalWindows`, `flushTraceDigest` and the music/voice schedulers all hang on `drpgTimeOfDayChanged`; only some gate on the primary GM (CORE-17).
- Dead/legacy: `SETTINGS.blackened` (documented as read-once legacy), `DRPG.Safeword.word` kept only for a migration clause (CORE-13), `api.mjs` `returnToDiscussion` alias, hud.mjs re-exporting `MODULE_ID`.
- Magic numbers outside config: hud.mjs `MARK_FIRST_ACTION`/`MARK_SECOND_ACTION` (15/30 min - the handbook's numbers), `COALESCE_MS = 120` in sync.mjs and `delay = 120` in live.mjs (two copies of one constant), `deleteMessages` batch of 500.
- Comments contradicting code: api.mjs:320/327/330, hud.mjs:14, migrate.mjs header order rule, `DRPG.Chapter.endNote`.
