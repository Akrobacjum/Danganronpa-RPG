# REVIEW-112 - a read of the 1.2.112 candidate, `origin/claude/r112`

The coordinator's task of 13.11.2026: read adversarially the 1.2.112 candidate (E101 + E101b + E100), with the merge
resolutions, Season setup taking the Scenes part, Room setup's tabs, E100's player screen, D2, Polish/English and
tests that measure nothing in focus. Read only: nothing was pushed to that branch and none of its code was fixed here.

**What was read.** `origin/claude/r112` at d2aa9940. Main 1.2.109 had not landed in it when this was read (its base with
main is 4dfac3a9, 1.2.108), so the diff read is `git diff 4eef965a d2aa9940`: 4eef965a is this line's tip r112 already
holds (eb9431dc merged it), so the diff is exactly what E100, E101 and E101b add - 47 files, +2839 -902, 35 commits -
and none of this line's lines. Once r112 merges 1.2.109 the read wants doing again on the new merge's resolutions.

**How.** Three readers, one per area (Season and Room setup with the item windows; E100's player screen, settings,
sound and notices; the merge resolutions, lang files and registry), each with the repository's rules and no harness
run. They ran `node --check`, `node tools/check.mjs <part>` and `git` in detached worktrees, since removed: parity,
prose 527/527, contract, registry, dashes, css, names, text and tree were green there. Each finding was then re-read
here: **read** - the failing path traced in the branch's code here and it holds as written; **reader's** - the reader's
claim, not re-traced. Nothing was run in a browser or at a table.

## The findings, most severe first

| # | Sev. | Where (d2aa9940) | What | Verified here |
| --- | --- | --- | --- | --- |
| S1 | high | scripts/season-setup.mjs:1208-1234, trial-scene.mjs:1574 | One Save that sets the phase to Class Trial and changes the hall: the hall lock is read against the phase before the Save (`hallLockReason(read, phase = getClock().phase)`), `applyCampaignForm` then enters the trial in the hall still linked (`enterTrialScene(hall = trialScene())`), and only then does `applyScenesTab` link the new one. The table stands in H1, the link names H2, and the trial's end works on H2 - the state E13 fix r1-F2 was written against | read (the order; both defaults); the `setClock` -> `followPhase` -> `enterTrialScene` chain is the reader's |
| S2 | medium | season-setup.mjs:1208-1216 | A clash or a hall lock returns null before anything is written: the campaign's name, chapter, day, session, time of day, refill and safeword typed in the same Save are dropped, the window already closed, a toast alone | read |
| P1 | medium | scripts/explain.mjs:139 | The Wounded sentence takes the wound off twice: `actionsOf` reads `actions.max`, which `resetActionsFor` already writes as the wounded budget, and `hurt` subtracts the wound again - "0 actions instead of 1" for a student with 1 instead of 2 | read |
| G1 | medium | scripts/action-listen.mjs:87-89 | E100 item 6 (one word per kind of button) met E69's Infiltrate window in the merge: its rows carry no `confirm`, so its button is `chooseVariant`'s fallback "Do it" (action-menus.mjs:209); d2aa9940 fixed Tail alone. R4105 cannot see a fallback. Or the owner keeps it, as Facilities keeps E93's word: either way a decision | read |
| P2 | medium | player-status.mjs:512, sheet.mjs:5746, 4773-4777 | Move's new words: "drag your token" in a Class Trial, where the drag is refused; the Monocub panel's "Free" stays when its Free Move is spent | reader's |
| S3 | medium | lang en 1280, 1560, 2766, 2775, 5419 and the PL twins | Five texts still send the GM to "Room Setup's Scenes tab" and its Apply, which no longer exist; one is drawn inside Season setup's own scenes part | reader's |
| S4 | low | lang `DRPG.Season.roomsVision` (en 5385, pl 5961) | says "or global light is still on" where `sceneVisionReady` fails with it off | reader's |
| S5 | low | season-setup.mjs:555, 780 | the checklist's Scenes row, with Season setup open, brings the checklist back over it (`windowsOpenedSince` leaves out Season setup by a class the checklist does not carry) | reader's |
| S6 | low | gm-team-dialog.mjs:208-217, 708-713 | Despair Flow's Save drops the pool of a Monokuma made while it was open | reader's |
| S7, P4 | low | room-setup.mjs:474; sheet.mjs:5737-5749 | the neighbours' rules only in a tooltip on a `<p>`; the Move tile, now a `div`, takes no focus - keyboard and screen reader users lose its lock reason | reader's |
| P3 | low | tests-tier1.mjs:49198 (R4110), 49220 (R4112), 49170 (R4109) | each passes when the style lookup finds no rule (`C.winner` null read as a pass); R4110 under the glass never compares the chosen tab with another | reader's |
| G2, G3 | low | tests-tier1.mjs:49293, 49308-49313; docs/dev/e100/STATUS.md:61 | R4105's title and E100's STATUS still describe two Level Up menus with Next (the merge made one window with Grant, on purpose); R4105 names none of e93's openers (Tail, Force, Pick) | reader's |
| G4 | low | docs/text-style.md:714-737 | E100's block says its buttons follow O11 ("a verb with its object") while its own table drops the objects and adds "Next" | reader's |
| P5, P6 | low | action-briefing.mjs:56-57; action-tail.mjs:59 | a stale comment on `briefing()`; Tail says Roll though a player's press always waits on a GM first (by item 6's own table, "Send to the GM") - unsure, the owner's | reader's |
| S8 | low | lang `DRPG.Season.step.hallTokens`, `hint.hallTokens`; api.mjs:806; R3580's name | read by no code; a stale comment; a title that promises the opposite of its body | reader's |

**No D2 hole was found.** Move's window held no guard: the refusals before the dispatch stand and the crossing is
judged in movement.mjs (`trialLocked`, `lockedInIncident`). Verbose logging is a client setting with `config: false`,
on no socket, bridge or api entry, and the window draws its row for a GM alone. The Give in Give / take items runs the
three windows' own bodies behind `openItemManager`'s GM check, with no new write road.

**The merges dropped and doubled nothing**: eb9431dc is a clean automatic merge (`--remerge-diff` empty); 9a310c5b
differs from git's own merge in five files (level-up.mjs, tests-tier1.mjs R4105, gm-handbook EN and PL section 18,
R-REGISTRY.md), every hunk read, each keeping both sides; the lang files three-way at every key; section 18 the same
in EN and PL, sections 1-21 in both; Tail's code e93's byte for byte but its label. **Room setup's Apply writes the same
fields as before** (`readRoomSetupForm` unchanged; columns moved panes, every pane in the one form).

## This line's own, found on the way, fixed on `claude/e93`

Two came from e93's own lines, not r112's, and are fixed here in their own commit (81e19f0d), not in r112:
- the player handbook (EN, PL) still listed Infiltrate's rows as "Listen first, then Tail Someone and Dash (more come
  later)": it names the seven now;
- `DRPG.Facility.editor.trait` stood twice in one object of en.json and pl.json, the same value: once now.

Left as found, not this line's: `DRPG.Chapter.bodyTitle` twice in en.json and pl.json on main, with two English values
("A body is discovered", "Body found") - JSON keeps the second. And from E101's side: the GM handbook's lines 46, 140
and 1343 (PL 140) still name Pre-season checks a button at the checklist's foot.

Below, each reader's full text, with its failing paths and patches. The table's ids map onto theirs: S1-S7 are the first
reader's F1-F7 (S8 its "smaller leftovers" under F3), P1-P6 the second's 1-6 in the order 1, 2, 3, 4, 5, 6 -> P1, P2, P3,
P4, P5, P6, and G1-G4 the third's 1-4.


---

## Season setup, Room setup, GM items

Reviewed: `git diff 4eef965a d2aa9940` for scripts/season-setup.mjs, room-setup.mjs, gm-items.mjs, gm-team-dialog.mjs, gm-panel.mjs (the tiles and the students line), trial-scene.mjs (the 11 lines the scenes part needed), the tests R4051-R4060, R4470, R4471, R3580, R3581, E101-T4/T5/T6/T9, and lang. Checks run on a detached worktree at d2aa9940 (removed afterwards): `node --check` on the seven files, clean; `check.mjs parity`, `prose` and `dashes`, all green; `check.mjs text` not run to the end, because it needs espree (`npm ci` skipped). Nothing in the repository was edited.

### F1 - high - one Save can relink or unlink the trial hall while entering the Class Trial

season-setup.mjs:1208-1234 (and trial-scene.mjs:1485-1497 for the hold).

E101 item 5 put the scenes part and Edit campaign's phase select in one form with one Save. The hall-lock backstop (`hallLockReason`, E13 fix r1-F2) still reads the phase as the clock has it before the Save. It runs first. Then `applyCampaignForm` writes the phase, and only after that does `applyScenesTab` write the roles. Room setup's Apply could never move the phase, so this combination was not possible before E101.

Failing path:
1. Daily Life, hall H1 linked. A GM opens Season setup.
2. In the scenes part they pick H2 (or "no scene") as the trial hall, and in Edit campaign they set Phase to Class Trial. Save stays on: `wireScenesTab`'s redraw reads `getClock().phase`, it listens only to the scene selects, and the phase is not "classTrial" yet.
3. They press Save. `hallLockReason(result.scenes)` returns null, because the phase is still Daily Life. `applyCampaignForm` asks its two questions and the GM says yes. `setClock` then runs `reconcilePhase` and `followPhase`, and `enterTrialScene()` stages and activates **H1**, the hall still linked. The trial question's own sentence (`phaseSwitchesScene`) also named H1.
4. `applyScenesTab` writes `sceneRoles.trial = H2` (or null). The phase is now classTrial and H2 is not active, so nothing is staged.
5. The result is the exact state r1-F2 was written to prevent. The table is in H1 with H1's cast shown, and the link names H2. At End the trial, `leaveTrialScene(trialScene())` works on H2: H2 has no `trialReturnTo`, H1's module tokens are never cleared, and with no school linked the table stays in H1. If the hall was unlinked, End the trial has no hall to leave.

Patch: write the scenes first, so the trial the phase select opens reads the hall the GM has just linked. Room setup's Apply wrote them at the clock's phase in the same way.
```diff
-    await applyCampaignForm(result);
+    // The scenes before the clock (r112 review F1): a phase moved into the trial by this Save enters the hall it links.
+    if (result.scenes) await scenesTab.applyScenesTab(result.scenes);
+    await applyCampaignForm(result);
 ...
-    // The scenes, as Room setup's Apply wrote them (trial-scene.mjs `applyScenesTab`: it writes only what changed).
-    if (result.scenes) await scenesTab.applyScenesTab(result.scenes);
```
If the owner would rather refuse the combination, use the alternative: check the lock against the phase the form asks for, `scenesTab.hallLockReason(result.scenes, result.phase === "classTrial" ? "classTrial" : getClock().phase)`, and in `wireScenesTab` also listen for `change` on `[name="phase"]` so that Save is held with the reason. The suite misses this today because R4471 only greps for the presence of `scenesClash(`, `hallLockReason(` and `applyScenesTab(` in `openSeasonSetup`, not their order. A tier-2 case "Season setup's Save that enters the trial and relinks the hall" would be red at d2aa9940.

### F2 - medium - the scenes backstop throws away the whole Save, Edit campaign and the safeword with it

season-setup.mjs:1208-1216.

On a scenes clash or a hall lock, `openSeasonSetup` returns null before `applyCampaignForm`. In Room setup that dropped only Room setup's own fields. Now it also drops the campaign name, chapter, day, session, time of day, the refill tick and the safeword. The window has already closed, and the GM sees only a toast about the hall.

The path is live because Save is held only from `wireScenesTab`'s redraw, which runs on the scene selects' `change` events:
1. A GM opens Season setup, changes the trial hall select, and types a new campaign name and safeword.
2. Another GM (or this one, from the panel) presses Start the Class Trial. Save is not held, because nothing redraws.
3. Save. `hallLockReason` returns its key, `openSeasonSetup` returns null, and the name and the safeword are lost.

Since E101 F4 Season setup stays open while its tiles' windows come and go, so it now stays open longer than before.

Patch: drop only the scenes part and write the rest.
```diff
-    if (result.scenes && scenesTab.scenesClash(result.scenes)) {
-        ui.notifications.warn(game.i18n.localize("DRPG.TrialScene.sameScene"));
-        return null;
-    }
-    const hallLock = result.scenes ? scenesTab.hallLockReason(result.scenes) : null;
-    if (hallLock) {
-        ui.notifications.warn(game.i18n.localize(hallLock));
-        return null;
-    }
+    // A scenes part that cannot be written is not written; the rest of the window is (r112 review F2).
+    const sceneBlock = !result.scenes ? null : scenesTab.scenesClash(result.scenes) ? "DRPG.TrialScene.sameScene"
+        : scenesTab.hallLockReason(result.scenes);
+    if (sceneBlock) {
+        ui.notifications.warn(game.i18n.localize(sceneBlock));
+        result.scenes = null;
+    }
```
This needs a matching change to the comment ("a Save that arrives anyway writes nothing") and to R4471's wording.

### F3 - medium - user-facing texts still send the GM to "Room Setup's Scenes tab", which no longer exists

lang/en.json at d2aa9940: `DRPG.Zones.noZones` (1280), `DRPG.Floor.startTrialNoHall` (1560), `DRPG.TrialScene.hallDark` (2766), `DRPG.TrialScene.noWayBack` (2775), `DRPG.Season.hint.scenes` (5419). Their Polish twins say the same: pl.json 1324, 1618, 2996, 3005, 5853.

Failing paths:
- The Season checklist's Scenes row says "Room Setup's Scenes tab links the scene...", and its Open now opens Season setup (season-setup.mjs:555).
- `hallDark` is drawn inside Season setup's own scenes part (trial-scene.mjs:1223, `reportHtml`) and is whispered at trial entry (trial-scene.mjs:705). It says: tick "Prepare the hall" in Room Setup's Scenes tab "and press Apply". The tick is now labelled "Prepare the hall on Save", and the button is Save.
- `noZones` is a refusal the trial gives (trial-zones.mjs:202, zone-machine.mjs:143). `startTrialNoHall` and `noWayBack` are said at the start and the end of a trial. Each one points at a tab that does not exist.

Patch: say "Season setup" and "Save" in all five, in both languages, through docs/text-style.md and the glossary, for example `hint.scenes`: "Season setup links the scene the season is played on and the scene the Class Trial is held in. ..." and `hallDark`: "... tick \"Prepare the hall on Save\" in Season setup and press Save."

Related, lower priority:
- `DRPG.Season.step.hallTokens` and `hint.hallTokens` (en 5430-5431) are now read by no code (grep over scripts/ outside the tests: nothing). Delete them or mark them.
- api.mjs:806's comment still says `openTrialCast()` "opens Room Setup on its Scenes tab".
- R3580's name (tests-tier1) still promises "the footer is Save (primary), Reset the season (destructive) and Cancel", while its body expects Reset out of the footer. The name and its registry row should follow the body.

### F4 - low - `DRPG.Season.roomsVision` gets the global light backwards

lang/en.json:5385 and pl.json:5961. The text reads: "{scene}: Foundry's own vision, fog or global light is still on there, so players may see black." `sceneVisionReady` (fog.mjs) fails when `environment.globalLight.enabled !== true`, so the fault is that the global light is **off**. A GM who reads "global light is still on" will switch it off and make the scene darker. The Polish twin has the same mistake ("działa tam jeszcze ... globalne światło").

Patch, EN: "{scene}: Foundry's token vision or its fog is still on there, or its global light off, so players may see black." The PL text should change the same way.

### F5 - low - the checklist's Scenes row, pressed while Season setup is open, brings the checklist back on top

season-setup.mjs:555 and 780.

Since E101 item 5, the Scenes row opens `openSeasonSetup()`. The checklist is usually opened from Season setup's own tile, which now leaves Season setup standing. In that case `alreadyOpen` raises Season setup and returns RAISED at once, and `wireSetupSteps`' `handOff` closes the checklist and opens a new one. That new checklist's `raiseOpened(before)` should bring Season setup in front, but `windowsOpenedSince` excludes every window whose classes include `"drpg-window-season"`. That is Season setup's own class, not the checklist's (`drpg-window-season-checklist`, an exact `Array.includes` miss).

Result: the GM presses Open on the Scenes row, the checklist redraws on top, and the Season setup it named stays behind it.

Patch (line 780): `!app.options?.classes?.includes("drpg-window-season-checklist")`. That is the window the comment "never the checklist itself" means since E49 A1e. A simpler alternative: let the Scenes row's `open` only raise Season setup when it is already open.

I have not seen this on a drawn window. It is read from the code, not measured.

### F6 - low - Despair Flow's Save drops the stored pool of a Monokuma made while the window was open

gm-team-dialog.mjs:208-217 (saveGmTeam) and 708-713 (readMonokumaForm).

`setPools` replaces the whole map (monokuma.mjs). Since E101 item 6 the Monokumas tab draws a pool select only for the actors that were Monokumas at render. Every other actor reads `pool: null`, and saveGmTeam keeps a pool only where `isMonokuma(actor) && row.pool`.

Failing path:
1. A GM has Despair Flow open (from Season setup's tile, which no longer closes Season setup).
2. From the checklist's Monokuma row they make a character a Monokuma in the Students window. That character may already have a pool in `monokumaPools`, from an earlier term as a Monokuma or written by `setMonokuma`.
3. They Save Despair Flow. That pool entry is removed.

This is less harmful than before E101, when the stale tick unmarked the Monokuma.

Patch:
```diff
-        pool: root.querySelector(`[name="pool.${CSS.escape(actor.id)}"]`)?.value || null
+        // undefined where no select was drawn: the stored pool stands (r112 review F6)
+        pool: (sel => (sel ? sel.value || null : undefined))(root.querySelector(`[name="pool.${CSS.escape(actor.id)}"]`))
```
and in saveGmTeam: `const pool = row.pool === undefined ? poolFor(actor) : row.pool; if (actor && isMonokuma(actor) && pool) pools[row.id] = pool;`. `poolFor` would need importing.

### F7 - low - the neighbours' rules now live only in a tooltip on a paragraph

room-setup.mjs:474. `DRPG.Vault.neighboursNote` was a visible note. It is now a `data-tooltip` on a `<p class="notes">`. A paragraph is not focusable, so a keyboard or screen-reader user cannot reach the rules, which say what an empty cell means and that a link works both ways. Patch: keep the short line, and put the full note in a `<details>` under it or in an `aria-describedby` target, instead of only the tooltip.

### Checked and clean

- **Room setup's Apply writes the same fields as before.** `readRoomSetupForm` is unchanged. The columns only moved: `isroom` and `notshared` went from Doors to Rooms. `kitTabs` draws every pane in the one form, so a hidden tab's inputs are still read. The only fields that left are the `scenes:*` part, with its two backstops and `applyScenesTab`, and they moved to Season setup whole. `roomSetupTab` still falls back to `bedrooms` (Rooms). No code opener asks for `tab: "scenes"`. The ratio box and the two-bedrooms box moved with their panes, and their wiring (`wireRoomRatio`, `wireTwoRoomsCheck`) looks them up across the whole root.
- **Season setup's scenes part.** It reads under the right names (`readScenesTab(d.element)`, all `scenes:*` plus `cast:*`). None of them collides with Edit campaign's fields (`readClockForm` reads `campaignName`, `chapter`, `day`, `phase`, `session`, `timeOfDay`, `reset`). `applyScenesTab` writes only what differs from what was drawn, merged into the stored roles, so a second GM's change to another role is not overwritten. End the chapter and Reset the season close unsaved, as designed. `draft` and `paintDraft` are now dead code (no caller passes a draft), which is harmless.
- **Give in the hub (2e10420d) and the trust model.** `openItemManager` refuses a non-GM before it draws anything (gm-items.mjs:335). The give is carried out by the same bodies the three windows ran (`giveItemNow`, `giveBulletNow` with `bulletTraces`' writers, `giveKeyNow` through `grantBedroomKey`), now extracted, not exported, and called only after that GM check. The diff adds no new write road and no socket or bridge entry. The five panes share no field name or id: the bullet's name is `bulletName`, the recipient is the hub's `who` throughout (`scope.recipient`), and `tell` appears once. Give is held per pane, and the Take tab's buttons are untouched.
- **Tests.** R4060, R4471, R4055, R4051, R3581 and E101-T9 each `must` on what they read before asserting. None uses `ok(true)` or cuts source without the kit. E101-T9 restores `sceneRoles` and deletes its scene. R4471 is weak on order (see F1), and R4055's `/action:\s*"reset"/` is a negative check on an `fnSource` cut that its `must` does not guard. The other assertions in the same `equal` would go wrong first if that cut were empty, so I do not count it as a failure.
- **Parity.** Green, 0 missing and 0 stray. The new keys (`applyLine`, `tabRooms`, `roomsIntro`, `doorsLine`, `neighboursLine`, `notSharedLine`, `scenesLine`, `resetNote`, `prepareOnSave`, `giveButton`, `giveWhat`, `giveFrom`, `whatItem`, `whatBullet`, `whatKey`, `fromTables`, `unfold`, `unfoldNote`, `Monokuma.noneYet`) are present in both languages.
- **Not reviewed** (outside this scope, since Season setup does not call into them): level-up.mjs and tables-editor.mjs.

---

## E100's player screen, settings, sound, notices

Reviewed: `git diff 4eef965a d2aa9940`, the E100 commits (0dead12b, a5dc2ba7, 693a1020, fa450138, d168919c, a006deb4, bf0ce376, fb04ba2a, 69520df9, d1451f72, 81685ca2, the reverts 818c760e and 7f7e4209), d2aa9940 (Tail's word), and E101's settings-window / sound-panel / sfx / ui-kit stepper parts. Checks run in a detached worktree at d2aa9940: `parity`, `prose` (527/527), `contract`, `registry`, `dashes` green. `text` and `names` are red only because espree is not installed there ("run `npm ci` in audit/harness first"), so I have no reading from them. I ran no harness.

### What holds (checked, nothing to report)

- **Trust model (D2).** Removing Move's window takes away no guard. The old `briefing()` only drew a window, and on "Got it" `performAction` still returned null (`case "move": return null`). The refusals before the dispatch (incident, Eclipse, trial, unknown key) are still in place. The crossing itself is still judged in movement.mjs (`trialLocked` at movement.mjs:1699, `lockedInIncident` at 1675).
  - Nothing reads `skipBriefing` and nothing imports `briefing`.
  - The Move tile is a `div` with no `data-drpg-action`, so the delegate presses nothing.
  - None of these commits adds a player write, a socket row or a bridge row.
- **Verbose logging (a5dc2ba7).**
  - `debug` is `scope: "client"` and `config: false` (settings.mjs:1665-1672), so it does not show in Foundry's Configure Settings.
  - Its only reader is utils.mjs `debug` (console output on that browser alone). No socket or bridge row and no api.mjs entry names it.
  - `saveSettings` walks only the fields that were drawn, so a player's Save cannot reset a value set from the console.
  - A player can still set it with `game.settings.set` in their own console. That is intended (it is the handbook's recipe) and only affects that player's own browser.
- **Notice filters (693a1020).** A chip press resets the menu, a menu pick presses no chip, and a filter that falls to 0 is disabled and goes back to All. `this.filter` is changed before `syncChrome` answers `this.filter !== was`. No issues found.
- **Reverts 818c760e and 7f7e4209.** I compared each revert line by line with the inverse of its commit. The only differences are later renumbering (R3918-R3922 to R4101/R4104), registry rows and handbook lines that later commits changed. No key, class or test is left behind: `otherTrait`, `drpg-trait-other` and `fold` in action-menus are all gone. The R4101 and R4104 rows are kept and marked, as the rule asks.
- **Lang keys.** All 83 `DRPG.*` keys the diff adds to non-test scripts are present in both en.json and pl.json. `DRPG.Action.gotIt` is gone from both files and from all code.
- **"No fold" CSS (fb04ba2a).** The override sets only `display`, so `holdRowLines`' measuring rule (`visibility: hidden`) still applies while it measures. With every line shown, the floor it computes equals the list's own height, so there is no harm.
- **"Rolls" line skipped when the description names the statistic.** I ran it against every action in both languages: it is skipped only for Search ("Roll Eye"), Listen, Palm and Tamper, whose descriptions do name the roll's statistic. Search's choice of statistic is drawn open again after the revert, so nothing is hidden.

### Findings

#### 1. medium - Wounded's sentence subtracts the wound twice for a wounded character

explain.mjs:139 (d168919c):

```js
const whole = actionsOf(actor), hurt = Math.max(0, whole - (baseActions() - baseActions({ wounded: true })));
```

`actionsOf` reads `system.resources.actions.max`. `resetActionsFor` writes that field with `actionBudget(...).total` (actions.mjs:438), which already takes the wound and the Overflow's darkness off.

Failing path:
1. A student is at 0 Health when the time of day starts, so the max is written as 1 (2 - 1).
2. The player opens the strip's explainer.
3. It says "1 action each time of day ... With no Health left you get 0 actions instead of 1".
4. Both numbers in the Wounded sentence are wrong: a wounded student gets 1 action, not 0, and the full budget is 2, not 1.

The same happens in a darkened hour: the Overflow's penalty is in `whole`, and the wound is taken off again on top of it.

R4106 only checks an unwounded stand-in (`max: base + 1`), so it pins this behaviour without exercising the case.

Patch (explain.mjs; import `actionBudget` from actions.mjs):

```js
const whole = actionsOf(actor);
// the same test actionsOf makes: a character with its own maximum, not a Monokuma
const own = Boolean(actor) && Number.isFinite(Number(actor?.system?.resources?.actions?.max))
    && !(typeof actor.getFlag === "function" && isMonokuma(actor));
// A GM's change to the maximum, kept on both sides; the wound and the darkness are actionBudget's.
const extra = own ? whole - actionBudget(actor).total : 0;
const fit = own ? actionBudget(actor, { wounded: false }).total + extra : baseActions();
const hurt = Math.max(0, own ? actionBudget(actor, { wounded: true }).total + extra : baseActions({ wounded: true }));
// actionsWounded: { wounded: unit("actionAcc", hurt), actions: unit("actionGen", fit) }
```

`actionBudget` also gives a Monocub no wound loss (actions.mjs:49), which today's sentence also gets wrong. For the test, add an R4106 case with a stand-in at 0 Health and `max: base - 1` whose Wounded sentence must read `base - 1` against `base`.

#### 2. medium - Move's new words say "drag" and "Free" where a drag is refused or not free

- player-status.mjs:512 - the HUD's Move row tooltip now opens with `DRPG.Move.drag` ("To move to another room, drag your token there.") outside an Eclipse, whatever the phase.
- sheet.mjs:5746 - the Monocub's still Move tile has "Drag your token" on its face.
- sheet.mjs:4773-4777 - `monocubMoveNote` always reads `DRPG.Move.free` ("Free" / "Za darmo").

Failing paths:
- **(a) Class Trial.** STATUS item 10 measured that a player's strip keeps its Move row there. The player hovers it and reads "drag your token there". The drag is refused (movement.mjs:1699, `DRPG.Trial.moveLocked`). The Monocub's tile is locked in a trial too (sheet.mjs `locked`, `inTrial && key !== "analyze"`), yet its face still says "Drag your token".
- **(b) Free Move already spent.** A Monocub pays its crossings like a student (actions.mjs `takeMove`: free, then Sprint, then an action). Once the Free Move is spent, the next crossing costs an action, but the panel still says "Free" under the tiles. `refreshMonocubTiles` redraws only the grid, so the line never changes. This adds a second always-"Free" line beside the tile's `costFree`, which ACTIONS.move's `cost: 0` produces (that part predates this work).

Patch:

```js
// player-status.mjs (re-import getClock, which d1451f72 dropped)
const lead = getClock().phase === "classTrial" || game.settings.get(MODULE_ID, SETTINGS.murderState)?.active === true
    ? "" : `${game.i18n.localize("DRPG.Move.drag")} `;
row.dataset.tooltip = `${lead}${row.dataset.tooltip} ${moveLegend()}`;

// sheet.mjs stillMoveTile(button, locked): skip the dragShort line when the tile is locked (pass `locked` from actionButton)

// sheet.mjs monocubMoveNote(actor): the owner's word while it is true, the next crossing's price otherwise
note.textContent = nextCrossingPrice(actor) === "free" ? game.i18n.localize("DRPG.Move.free") : moveLine(actor);
// and redraw it in refreshMonocubTiles beside the grid
```

The owner asked for "za darmo" only. Whether the line should change once the Free Move is spent is the owner's decision. As written, though, it is false once that move is spent.

#### 3. low - Tests that pass when the cascade reads nothing (rule 1 / rule 3 spirit)

`C.winner` answers null when no rule matches (tests-kit.mjs:950). Three new tests turn a null into a pass:

- **tests-tier1.mjs:49198 (R4110).** Glass `ground: !/bone/.test(String(w(chosen, "--brush")))`: a null reads "null" and passes. It also never compares the chosen tab with an unchosen one under the glass. The new rule (`nav.sheet-tabs a { --brush: ink }`) gives every tab the Ink brush, so "the chosen tab stands apart" is not measured there.
- **tests-tier1.mjs:49220 (R4112).** `sides` answers false for a missing `inset` (`?.value ?? ""`). For the `button` half, the only rule it reads is the one this commit added. If that rule's selector drifts, both halves stay green.
- **tests-tier1.mjs:49170 (R4109).** `shown = v => v !== "none"` takes null as shown. If the fixture's markup stops matching both rules, it passes.

The commits report each of these red before their fix, so they measured something on the day. After a selector change they would read nothing and still pass.

Patch: hold each reading non-null first, for example:

```js
must(read.glass && Object.values(read).every(r => r[0] !== null && r[1] !== null), `the cascade read nothing: ${stableJson(read)}`);
```

In R4110 (glass), also compare `w(chosen, "background")` (or `--brush` drawn) with the unchosen tab's. In R4112, require `C.winner(li, "inset", "::before")` to be non-null.

#### 4. low - The Move tile is no longer focusable, so its tooltip (the lock reason) is mouse-only

sheet.mjs:5737-5749. `stillMoveTile` turns the button into a `div` with no `tabindex`. The tooltip still carries the hint and, in a trial or an incident, the reason the tile is locked. A keyboard or screen-reader user can no longer reach either: the button used to take focus and Foundry shows `data-tooltip` on focus.

Patch: `tile.tabIndex = 0; tile.setAttribute("role", "note"); tile.setAttribute("aria-label", <name + cost + dragShort>)`. Or keep it a `<button>` with `aria-disabled="true"` and no `data-drpg-action`. The file already does this for an off-turn tile (sheet.mjs, "`aria-disabled` and not `disabled`, because a disabled button takes no pointer, so its tooltip never shows").

#### 5. low - Stale comment: `briefing()` "still exists for Move"

action-briefing.mjs:56-57 still says "`briefing()` below still exists for Move, which asks nothing...". 0dead12b deleted it and rewrote the file's header, but missed this block above `briefingBlock`.

Patch: replace the two lines with "Move has no window since E100 item 1: its sentence is on the Monocub's tile and the HUD's Move row."

#### 6. low, unsure - Tail's button says Roll, but its press always waits on a GM first

action-tail.mjs:59 (d2aa9940). Tail has more than one statistic, so a player's press always goes to `askGms` (trait-ruling.mjs:219-220) before anything is paid or rolled. Under item 6's own table, a press where "the GM decides" says "Send to the GM". Search's Roll is different: on Eye it asks nobody.

The commit says the word is a default taken while the owner is away. R4105 does not pin Tail's opener: it only catches `DRPG.Action.proceed`.

Proposal: keep Roll until the owner answers, but log it as an open question in E100's STATUS. Either way, add `tail: keysIn("action-tail.mjs", "performTail")` to R4105's openers.

### Not findings, for the record

- **d1451f72** puts "Still to act" back in a Class Trial on the GM's strip. The count's fall at an execution, which was Q-E23-3's reason for removing it, comes back with it. That was the owner's decision, and STATUS Open 4 already says the reading of "actions/move/hope" as the GM's strip is unconfirmed.
- **E101's `scaleNow`** (settings-window.mjs) reads the theme in force, not the one picked in the window before Save, so the line is stale until Save if the theme field changes. Cosmetic, so I am not proposing a patch.
- **I found no English literal** added to a UI-rendering file in the scoped files. The new English strings are console `error(...)` lines (allowed).

---

## The merge resolutions

Read-only review of `origin/claude/r112` at d2aa9940. I made no edits in the repo. The checks ran in a detached worktree, which I have removed.

### What was checked, and how

- **M1, eb9431dc** (E101 at 338d20d0 + e93 at 4eef965a, base 4dfac3a9). Nine files changed on both sides. `git show --remerge-diff` is empty, so this was a clean auto-merge with no hand resolution.
- **M2, 9a310c5b** (243cb4d7 + e100 at 81685ca2, same base). Fifteen files changed on both sides. Only five differ from git's own merge, and I read every hunk of those five:
  - `level-up.mjs`
  - `tests-tier1.mjs` (R4105)
  - `gm-handbook.en.md` and `gm-handbook.pl.md`, section 18
  - `R-REGISTRY.md`
- **Per-file line counts.** For every file, the lines one side added and removed since the base match what the merge adds and removes over the other parent. Only the five resolved files differ, by the amounts their resolutions explain. Nothing was dropped or doubled outside them.
- **Lang files, three-way.** I flattened `en.json` and `pl.json` at the base, both parents and the merge, for each merge. Every key holds the value a three-way merge expects: no key lost, none reverted, no conflict taken from the wrong side.
- **Removed keys.** The only key removed in the whole range is `DRPG.Action.gotIt` (E100). Nothing reads it, in scripts or in the harness.
- **Missing keys.** Every `DRPG.*` literal in non-test scripts resolves in `en.json`. The six that do not are all inside comments.
- **Duplicate keys in the raw files.** There are two, and neither comes from the merges:
  - `DRPG.Chapter.bodyTitle` (en.json:2625/2639, pl.json:2826/2840) is already on origin/main. In EN the two values differ ("A body is discovered" / "Body found"), and JSON.parse keeps the second.
  - `DRPG.Facility.editor.trait` (en.json:3248/3261, pl.json:3512/3525) comes from e93. Both copies are the same value, so it is harmless.
- **`node tools/check.mjs` in the worktree** (after `npm ci` in audit/harness): all 17 parts are green. That includes parity (en 5372, pl 6399, missing 0), registry (1232 numbered, no R number used twice, next free R4472), names (0 unresolved), contract, css (0 duplicate rules, 0 dead classes), text, prose 527/527, dashes, moves and tree.
- **`node --check`** passes on every file in `scripts/*.mjs` and `tools/*.mjs`.
- **Tier files:** no test name appears twice in tier 0, 1 or 2.
- **Level Up** (level-up.mjs:77-113): the resolution is right.
  - E101's one window is kept: `whoRows`, the `who` read off the form, and the confirm `DRPG.Advance.grant` (Grant / Przyznaj).
  - E100's two `Action.next` confirms went with the second menu, and no `confirm:` is left twice.
  - The take-back rows keep their own per-row confirm.
  - R4056 still matches: one `chooseVariant`, the `who` rows, Grant as the confirm.
  - R4105's `levelUp: ["Advance.grant"]` matches the code.
  - e93 never touched level-up.mjs.
- **gm-handbook section 18**, EN and PL: the merged sentence keeps both sides.
  - E100: Verbose console logging is in a GM's window alone.
  - E101: the music switch and Vary the sounds are in the Sound window.
  - E100 item 2 was reverted, so the two volumes and Messenger sounds staying in the gear's window is correct.
  - EN and PL say the same thing, and the paragraphs of section 18 match one for one.
  - Section numbering is 1-21 in both files.
  - E100's other handbook edits auto-merged and match in both languages: the voice recipe in section 6, and Roll / Rzuć on the crisis tile.
- **Tail** (action-tail.mjs, d2aa9940): only the label changed, from `DRPG.Action.proceed` to `DRPG.Action.roll`. Everything else is e93's code byte for byte: the gmOnline guard, canAfford, `tailTargets` (Monokumas and Monocubs left out), the GM's pick through `traitFor` before anything is paid, the two rolls, `requestTailStart`, and the whisper. `DRPG.Action.roll` is "Roll" / "Rzuć" in both lang files.
- **Cross-side tests, reasoned from code:**
  - **R4105** recomputed by hand on d2aa9940: every opener's keys match its expectation, and the only file that names `DRPG.Action.proceed` is `action-menus.mjs`.
  - **R4102:** the only files that name `SETTINGS.debug` are settings.mjs and utils.mjs. Neither e93 nor E101 added a reader.
  - **R3530, R3420, R3531, R4059, R4064:** E100's GM-only `debug` row and E101's sections and `SOUND_WINDOW_SETTINGS` agree.
  - **R4108:** e93 added no `ACTIONS` key; Tail, Force and Pick pass their own defs, which have no `traits`.
  - **R3756:** E100 did not touch `infiltrateRows`.
  - E100's removed `briefing` export is imported by nothing.

### Findings

**1. Medium - the Infiltrate menu still says "Do it": E100 item 6 met e93's E69 menu in the merge, and d2aa9940 fixed only Tail.**
- **Where:** `scripts/action-listen.mjs:87-89` (`performListen`). Since E69 C1 the first window is a `chooseVariant` over `infiltrateRows(actor)`, with no `confirm` at the top or on any row. Its button is therefore `chooseVariant`'s fallback, `DRPG.Action.proceed` ("Do it" / "Zrób to"), at `scripts/action-menus.mjs:209`.
- **Why it is wrong:** E100's rule says a button that rolls says Roll and one that leads to the next window says Next.
  - Dash, Shut the Door and Keep Watch roll straight from this press. They open no window of their own: action-listen.mjs:208, action-doors.mjs:25, action-watch.mjs:25.
  - Listen, Tail, Force and Pick open their own window, and each of those already says Roll.
- **What happens:** a player who opens Infiltrate presses "Do it" on every row, the same gap d2aa9940 closed one window further on for Tail.
- **Why no test sees it:** R4105's `proceed` scan matches only the literal `"DRPG.Action.proceed"` in source. The fallback lives in action-menus.mjs, which is the one file it allows. Its title exempts only Rest's first window (Facilities, E93's word), not Infiltrate.
- **Patch** (I have not run it):
  ```js
  const variant = options.variant ?? (await chooseVariant({
      actor, title: def.label, intro: briefingBlock(actor, "listen", def), showShut: true,
      // E100 item 6's one word per kind (R4105): a row that rolls from this press says Roll, one that opens its own window Next.
      options: infiltrateRows(actor).map(r => ({ ...r, confirm: game.i18n.localize(
          ["dash", "shut", "keepWatch"].includes(r.value) ? "DRPG.Action.roll" : "DRPG.Action.next") }))
  }))?.value ?? null;
  ```
  - R3756 still holds: `infiltrateRows(actor)` still comes before `neighbouringRooms(scene, here)` in the source, and the rows themselves are unchanged.
  - R4105's `listen: ["Action.roll"]` becomes `["Action.next", "Action.roll"]`. That change is on purpose and should say so in the test.
- **Unsure:** the owner may want Infiltrate treated like Facilities, with E93's word kept. If so, the fix is one line in R4105's title naming Infiltrate beside Rest. Either way it should be a decision, not a fallback nobody chose.

**2. Low - R4105's title and two docs still describe two Level Up menus with Next.**
- **Where:**
  - `scripts/tests-tier1.mjs:49293` and its row in `docs/dev/R-REGISTRY.md` still say "one that only leads to the next window says Next / Dalej (Propose a project, both Level Up menus)".
  - `docs/dev/e100/STATUS.md:61` still says "Level Up: which kind; who picks ... Dalej / Next".
- **Why it matters:** the merge changed the expectation to `Advance.grant` on purpose, with a comment saying so. A reader of the registry or STATUS a year from now is told the opposite of what the test holds.
- **Patch:**
  - Title: "... says Next / Dalej (Propose a project); Level Up's one window says Grant / Przyznaj (E101, the r112 merge) ...". Then run `node tools/registry.mjs --write`.
  - STATUS.md row 61: "Level Up (one window since E101) | Grant / Przyznaj | `DRPG.Advance.grant`".

**3. Low - R4105 names none of the windows e93 brought, so the next drift will go unseen again.**
- **Where:** `scripts/tests-tier1.mjs:49308-49313` (`openers`).
- **What happens:** Tail (`performTail`), Force the Door and Pick the Lock (`performForce`, `performPick` in action-doors.mjs) say Roll today. Only the `proceed` scan guards them, and that scan cannot see a fallback (finding 1) or a wrong key that is not `proceed`.
- **Patch:** add the three openers to `openers`, each expected `["Action.roll"]`. Add `infiltrate: keysIn("action-listen.mjs", "performListen")` too, once finding 1 is settled.

**4. Low - E100's text-style block claims rule O11 for buttons that break it.**
- **Where:** `docs/text-style.md:714-737`, against O11 at line 117 ("A button is a verb with its object", e.g. "Create project").
- **The contradiction:** the block says "Przyciski według O11" ("buttons per O11"), but its own table removes the objects ("Roll it" becomes "Roll", "Send it to the GM" becomes "Send to the GM") and adds "Next" / "Dalej", which is not a verb with an object.
- **Glossary:** no conflict. glossary.json has no entry for these words, and the range adds only `facilities`.
- **Patch:** replace "według O11 i jednej reguły punktu 6" ("per O11 and one rule of item 6") with a stated exception, e.g. "według reguły punktu 6, która dla przycisków okien akcji zastępuje O11 (słowo na rodzaj przycisku, bez dopełnienia)" ("per item 6's rule, which replaces O11 for action-window buttons: one word per kind of button, no object"). Or add the exception under O11 itself and point to E100.

### Outside the merges (seen on the way, not caused by them)

- origin/main is at 1.2.109 (421f2395: E61, E62, E92, E94, E76b), and the merge base of this candidate is 1.2.108 (4dfac3a9). `node tools/check.mjs stamps` reads module.json as 1.2.108. Before 1.2.112, the candidate still needs to merge with 1.2.109. For example, the 1.2.109 glossary entries `spectator`, `setting-sequences` and the E94 boards are not in this tree.
- `docs/handbooks/gm-handbook.en.md:46, 140, 1343` and PL `:140` still describe **Pre-season checks** as a button at the foot of the Season checklist. Line 105 says that since E101 the checklist holds what Pre-season checks held. These lines are already stale on E101's own side (338d20d0, 243cb4d7); the merge did not cause them.
- `docs/handbooks/player-handbook.en.md:328` lists Infiltrate's rows as "Listen first, then Tail Someone and Dash (more come later)". e93 has seven rows (Shut, Force, Pick, Keep Watch as well). This comes from e93's side.
