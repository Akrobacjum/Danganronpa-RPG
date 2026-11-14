# Audit 113 - the other instances of the six classes (1.2.112, 13.11.2026)

Read at main ceb9e9c8 (1.2.112). No code changed. Daggerheart's source read at tag 2.12.8
(github.com/Foundryborne/daggerheart, cloned for this audit). The six classes are the coordinator's brief; the
instances the fix lines already hold (fix-113e..l, hot-112) are not re-reported.

Confidence words: **confirmed** - the decisive line was read in both places (a template and the module, or the code and
the stage's own record, or a script over the lang files); **read** - the whole road was traced in the source, not run;
**suspected** - a part of the road, a timing or an intent was not established. Nothing in this file was run at a
table, and no harness test was run for it: every finding is a reading. `node tools/check.mjs parity` was run (green:
en/pl parity holds, so every C3 finding is a reader that lacks a member, not a key missing in one language).

## Summary

| Class | Findings | confirmed | read | suspected | Notes |
| --- | --- | --- | --- | --- | --- |
| C1 measured on a stand-in | 3 | 2 | 0 | 1 | |
| C2 two stages, one moment | 7 | 0 | 4 | 3 | |
| C3 a set grew, a reader not told | 4 | 2 | 2 | 0 | +2 notes (N1: the known Hud.trial keys' other readers) |
| C4 a fix applied to one instance | 5 | 3 | 1 | 1 | |
| C5 built differs from the decision | 8 | 2 | 3 | 3 | +1 informational |
| C6 a rule the GM cannot see | 5 | 0 | 4 | 1 | |
| **Total** | **32** | 9 | 14 | 9 | |

Six of the 32 are questions for the owner rather than defects until answered: C2-3, C2-6, C5-3, C5-5, C5-8, C6-3.

### The ten I would fix first

Ordered by what a table loses, then by how sure the reading is.

| # | Id | One line | Conf. | Severity |
| --- | --- | --- | --- | --- |
| 1 | A113-C3-2 | A non-primary GM's Skip in Straw Poll / Logic Dive / Scrum is refused as "moved on": `floor.now`'s sanitizer lists five modes, not the zone modes `advanceFloorNow` now sends (bridge-table.mjs:1223). Check fix-113l does not already touch it | read | wrong for GM |
| 2 | A113-C4-3 | 1.2.112's "somebody has been in your stash" fires only from `drpgRoomCrossed`, i.e. a paid crossing: never with crossing fees off, slips past an Eclipse, never on a GM's placement (movement.mjs:2741-2775, :3321) | read | wrong for players |
| 3 | A113-C5-1 | DA30: a picked bedroom lock should warn the owner at their next entry; it warns at once, wherever they are (doors-gm.mjs:209), recorded only as a gap in E74's STATUS | confirmed | wrong for players |
| 4 | A113-C6-1 | A room action's Despair shield stops a roll's point with only a console line: the GM sees "with Despair" and a pool that did not move (timed-effects.mjs:111-120) | read | wrong for GM |
| 5 | A113-C6-2 | A Bounty's Despair goes into the same owed store as the Hope gift by another road (`oweDespair`); fix-113i covers it only if the fix is in the bar, not the gift's card | read | wrong for GM |
| 6 | A113-C3-4 | Door and room-action traces name `action: "infiltrate"` / `"facility"`, which have no `DRPG.Remnant.action.*` key: the raw word shows on the GM's card and is stored into the ledger label (remnants.mjs:458) | confirmed | wrong data (GM) |
| 7 | A113-C4-1, C4-2 | 73b6c5ba said "a free crossing" in Move's briefing; the card after it still says "Paid by a Sprint" and the sheet "crossings bought with Hope" after a Dash or a room action | confirmed | wrong for players |
| 8 | A113-C1-1 | 2.12.8 draws `.countdowns-container` only when some countdown is visible, so a player's "No projects yet." line is never drawn in the very case it was made for; scenario 74 U1 is green on a stand-in that always draws the container | confirmed | wrong for players |
| 9 | A113-C2-1 | One execution plays three or four sounds (death or deathFade + execution + trialClose), and the two execution roads (alive vs kept death) draw and sound differently | read | players and GM |
| 10 | A113-C5-6 | LIVE-E94-02 still expects no start-of-day board for a late joiner; the owner decided "Przez 10 minut" and that is built - a tester following the row records the rule as a failure | confirmed | wrong for GM (gate) |

Just below the ten: A113-C1-3 (a false sheet-contract notice whenever Daggerheart's pips layout is on) and A113-C2-6
(two meanings of "until this time of day ends" around an Eclipse - the owner's question).

### What could not be checked

- Foundry v14's own markup and render order: its source is not here (C1).
- Daggerheart 2.6.5 / 2.10.5 templates, so whether C1-1's `{{#if}}` is new in 2.12.8 is unknown.
- The fix lines' branches (fix-113e..l, hot-112) are not in this checkout: where a finding may overlap one, it says so.
- Timings (C2-2, C2-5, C2-6) were read, not measured; nothing was run at a table or in the harness for this audit.
- The planner branch (plan-130) is not here, so an owner's word recorded only there may answer a C5 item.
- C3: sheet tabs and a few dozen single-site prefixes were not swept; `switch`-read sets were sampled.

---

## C1 - measured on a stand-in, not the real DOM

| Id | File:line | What differs | Conf. | Severity | Holds headless? |
| --- | --- | --- | --- | --- | --- |
| A113-C1-1 | scripts/projects-tray.mjs:214-226 | `showTrayToPlayer` needs `.countdowns-container`; 2.12.8 draws it only `{{#if countdownTypesWithVisibleEntries.length}}` (templates/ui/countdowns/countdowns-view.hbs:24-28); the stand-in in 74-room-tile.mjs:1079-1104 always draws it | confirmed | wrong for players | yes; LIVE-A113-C1-1 drafted |
| A113-C1-2 | scripts/projects-ui.mjs:87 | the type toggles are removed for everyone, and the per-user flag `daggerheart.countdown-type-modes` that hides the `narrative` category is never reset, so a user with that flag set sees no project rows and has no control to bring them back | suspected | players / GM, only where set | partly; LIVE-A113-C1-2 drafted |
| A113-C1-3 | scripts/patches.mjs:248-250 | three required sheet anchors (`.status-bar`, `input.bar-input`, `progress.progress-bar`) do not exist when Daggerheart's client option `useResourcePips` is on (resource-bar.hbs:1-17); the contract warns and notifies the primary GM although `paintReserves` handles pips | confirmed | wrong for GM | yes; LIVE-A113-C1-3 drafted |

## C2 - two stages act on the same moment without knowing of each other

| Id | File:line | What collides | Conf. | Severity | Holds headless? |
| --- | --- | --- | --- | --- | --- |
| A113-C2-1 | trial-progress.mjs:171-174; chapter.mjs:330; trial-floor-ui.mjs:694-697 | an execution: `killCharacter` (death card sfx `death`, a non-silent fade `deathFade`) + execution card `execution` + close card `trialClose`; E70 C4 says the execution's sound replaces the death's. A kept death goes through `publishDeath`: no card, no fade | read | players and GM | yes |
| A113-C2-2 | death-fade.mjs:214-284; sequence.mjs:513-531 | the executed player's fade and the trial exit sequence run on one curtain; neither checks the other | suspected | players | table; LIVE-A113-C2-2 drafted |
| A113-C2-3 | chapter.mjs:2396-2434; sequence.mjs:376-380 | chapter end with "end the trial" moves the clock to N+1 first, so the exit reads "Chapter N+1 · Back to school" for chapter N's trial | read | cosmetic; owner's question | yes |
| A113-C2-4 | gm-students.mjs:643-646 | Students window, Monocub -> alive: `setMonocub(false)` makes a Spectator, `reviveCharacter` deletes it in the same Apply (a token flashes, two toasts, the curtain bare then lit) | read | cosmetic | yes |
| A113-C2-5 | chapter.mjs:241-251, :297-334 | at a kill in an incident the victim's owner hears `death` and `deathFade` (by default the same file). May sit inside fix-113h | suspected | players | yes |
| A113-C2-6 | eclipse.mjs:291-323; doors-gm.mjs:367-371; timed-effects.mjs:322-330; lockpick-gm.mjs:175-177 | "until this time of day ends": grants, seals, barricades end at the Eclipse's start; timed effects and lock passes at its end, racing `judgePendingMurders` | suspected | wrong data; owner's question | yes |
| A113-C2-7 | hud.mjs:1267-1275 vs eclipse.mjs:135-178 | the HUD chevron's dim is a hand copy of `startRefusal`; agrees today, drift risk of the fix-113f kind | read | none today | yes |

## C3 - a closed set grew and a reader was not told

| Id | File:line | Set / member | Conf. | Severity | Holds headless? |
| --- | --- | --- | --- | --- | --- |
| A113-C3-1 | case-map.mjs:77 | `nodeState()` answers `sent` since 6964661f; `STATE_KEYS` has no `sent`, so `DRPG.CaseMap.state.sent` (added in both files) is never read and the State row is blank | confirmed | cosmetic, GM | yes |
| A113-C3-2 | bridge-table.mjs:1223 | floor `MODES` + straw/dive/scrum: `floor.now`'s `as.oneOf` lists five modes; a zone mode becomes null and is refused `movedOn` | read | wrong for GM | yes (tier 1 census; 61/62/63 with gm2) |
| A113-C3-3 | calls.mjs:591; reroll.mjs:936 | Reroll bookmark keys dash, tail, shut, force, pick, keepWatch, facility (and older steal, rummage, frisk) are not `ACTIONS` keys: printed raw in the GM's lines. trait-ruling.mjs fixed it for `tail` alone | read | cosmetic, GM | yes |
| A113-C3-4 | doors-gm.mjs:321-322; facilities-gm.mjs:184 | Remnant `action` gained `infiltrate`, `facility`; no `DRPG.Remnant.action.*` key, no `ACTIONS` key; raw word on the card and stored in the ledger label | confirmed | wrong data, GM | yes |

## C4 - a fix applied to one instance, not all

| Id | Fix | Sibling missed | Conf. | Severity | Holds headless? |
| --- | --- | --- | --- | --- | --- |
| A113-C4-1 | 73b6c5ba "a free crossing" in Move's texts | movement.mjs:3285-3287 + `DRPG.Move.wasSprint` (en:3984, pl:4295): "Paid by a Sprint" for any banked crossing (Dash, Facilities, Infiltrate too) | confirmed | wrong for players | yes |
| A113-C4-2 | 73b6c5ba | sheet.mjs:5009-5010 + `DRPG.Actions.sprintBanked` (en:554, pl:575): "crossings bought with Hope" after a Dash | confirmed | wrong for players | yes |
| A113-C4-3 | feba55c3 the owner told on walking in | traps.mjs:946-950 is reached only by `drpgRoomCrossed`, fired once at movement.mjs:3321; the Eclipse (:2741) and fees-off (:2772) returns, and placements, never fire it | read | wrong for players | yes |
| A113-C4-4 | 1b1daa92 gaps-111 (d) Hope is the diamond under the glass | stained-glass.css:3876-3894 still masks Daggerheart's `fa-diamond` with the star under "HOPE IS A STAR"; reach not measured | suspected | cosmetic | table or glass harness; LIVE-A113-C4-4 drafted |
| A113-C4-5 | 4ef5cceb Relief refuses Breath | config.mjs:2489-2491 effect text silent on Breath; comments config.mjs:2481 and call-effects.mjs:1186-1187 say 5 Hope where `cost: 4` | confirmed | cosmetic | text lint |

## C5 - the built thing differs from the owner's decision

| Id | Decision | Code | Conf. | Severity | Holds headless? |
| --- | --- | --- | --- | --- | --- |
| A113-C5-1 | DA30: owner warned at the next entry (docs/dev/e74/STATUS.md:42) | doors-gm.mjs:209 whispers at once; Force the Door likewise | confirmed | wrong for players | yes |
| A113-C5-2 | E69 C6 eavesdrop, C7 Echoes (glyph approved 11.11), C8 murder privacy | absent; STATUS says "not in this round", no owner agreement recorded | read | wrong for players | the absence, yes |
| A113-C5-3 | Q-E92-6 "Widzi wszystkie projekty w tym prywatne" | projects.mjs:252 withholds a secret project's words from a Spectator on a coordinator note written before the owner's answer arrived | read (intent suspected) | players | yes |
| A113-C5-4 | owner 12.11: mood counts the Monocubs' Hope | sequence.mjs:754-758 reads the sheet only; E72's purse (`cubHopeTotal`) left out | read | players, small | yes |
| A113-C5-5 | DRPG-D1 choice (b): revert E91 | E91 restored on a coordinator's later message, shipped 1.2.110; no owner word on the reversal found | suspected | none at a table; a question | no |
| A113-C5-6 | Q-E94-4 "Przez 10 minut" | AUDIT-1.2.42.md:1351 LIVE-E94-02 still expects the old rule | confirmed | wrong for GM (gate) | n/a; LIVE row rewritten |
| A113-C5-7 | E68 Q4 every action on the two-column layout, "Nie przenos nic na kolejne wydanie" | Take from the Body stays a sheet list (anonymity.mjs:299-389) | suspected | cosmetic / players | partly |
| A113-C5-8 | E62 C6, E99's animated board left to E61 | neither built, no owner agreement found here | suspected | players | no; a question |

## C6 - a rule works as designed but the GM cannot see it

| Id | Created / lands | What the GM misses | Conf. | Severity | Holds headless? |
| --- | --- | --- | --- | --- | --- |
| A113-C6-1 | facilities-gm.mjs:172-173 / timed-effects.mjs:111-120 | a Despair shield stops a point: card says "with Despair", pool unmoved, only a console log | read | wrong for GM | yes (extend E93-T8); LIVE-A113-C6-01 drafted |
| A113-C6-2 | monocub.mjs:1806 -> despair.mjs:628 | a Bounty's owed Despair: the GM's card names only the reward, the bar does not move | read (overlap suspected) | wrong for GM | yes |
| A113-C6-3 | monocub.mjs:1828-1837 | an unclaimed Bounty lapses with no card while its Despair is still taken; the claim and a Bribe's lapse both whisper | read | wrong for GM; owner's call | yes |
| A113-C6-4 | stash-reach.mjs:584 / :599-626 | a pending stash notice has no GM marker; the theft card reads the same watched or not; the landing does not say which reach | read | cosmetic to wrong for GM | yes |
| A113-C6-5 | timed-effects.mjs:16 | the comment says a GM may end a timed effect by hand; no UI or API calls `endTimedEffect`; a double take after a hand edit is suspected | read / suspected | wrong for GM | yes |

---

# Evidence, class by class

The sections below are the full readings each table row rests on: the quotes, the roads traced, the LIVE rows drafted,
and the instances swept and found consistent.


## C1 evidence

Read-only pass, 13.11.2026. Module at  (working tree as found). Daggerheart source:
daggerheart-2.12.8 (system.json 2.12.8). Nothing in the repo was changed, nothing was run.
Not re-reported (known, being fixed elsewhere): `.window-title` gone from the countdowns header, sheet sideways
scroll, Facilities tile vs window, open tab not marked on the sheet, tray title.

Path shorthand: DH = daggerheart-2.12.8; M = .

### Findings

#### A113-C1-1 - a player's "No projects yet." line is never drawn when no countdown reaches them

| field | value |
| --- | --- |
| module | M/scripts/projects-tray.mjs:214-226 `showTrayToPlayer` (called from projects-ui.mjs:96) |
| expects | `.countdowns-container` is always in the tray, so with no row it appends `p.drpg-projects-empty` there (`if (!rows) return null;` otherwise) |
| 2.12.8 has | DH/templates/ui/countdowns/countdowns-view.hbs:24-28 - the container is drawn only `{{#if countdownTypesWithVisibleEntries.length}}`; that list is built from `#getCountdowns()` filtered by `visible` (DH/module/applications/ui/countdowns.mjs:139-147, 204-208). With no countdown visible to the player there is no container at all |
| effect | the case E79 C12 / U1 was written for ("before the first project") is exactly the one where the line cannot appear: the tray is un-hidden (`root.hidden = false` still runs, so the title shows), but the empty-state line is missing. It does appear in the other case (countdowns exist but `hideUndiscovered` removed every row), because there DH drew the container |
| stand-in | M/audit/harness/scenarios/74-room-tile.mjs:1079-1104 (phase U, checks U1/U2) builds the tray with `<div class="countdowns-container">` always present, also for 0 rows, and says it copies 2.6.5's countdowns-view.hbs. So U1 is green on markup 2.12.8 never draws. (The same stand-in also carries the `.window-title` already being fixed.) Whether 2.6.5 had the `#if` was not checked: its source is not here |
| confidence | confirmed (template read; module code read). Not run |
| severity | wrong for players (a missing explanatory line; no data affected) |
| holdable headless | yes: draw the stand-in as countdowns-view.hbs:24-28 does (no container when the player sees no countdown) and U1 goes red until `showTrayToPlayer` has a fallback place (e.g. after `.countdowns-header`) |

LIVE draft (LIVE-A113-C1-1): world with no countdowns at all (or only ones the player cannot see); a player client,
Stained Glass and Legacy. Reload as the player. Expect: the Projects tray shown with its title and the line
"No projects yet." (pl: the DRPG.Project.trayEmpty text). Record: whether the line is there; the result of
`!!document.querySelector('#countdowns .countdowns-container')` and
`!!document.querySelector('#countdowns .drpg-projects-empty')` in the player's console; a screenshot.

#### A113-C1-2 (suspected) - projects can be filtered out by a per-user type flag nobody can reset any more

| field | value |
| --- | --- |
| module | M/scripts/projects-ui.mjs:87 removes `.header-type-toggles` for everyone; projects are created as type `narrative` (M/scripts/projects.mjs:1683); `leaveIconOnly` (M/scripts/projects-tray.mjs:85-96) resets only `countdownMode`, never `countdownTypeModes` |
| 2.12.8 has | the user flag `daggerheart.countdown-type-modes` (DH/module/config/flagsConfig.mjs:26) decides which types are shown: `visibleCountdownTypes` (countdowns.mjs:62-66), category `{{#unless (includes ...)}}hidden{{/unless}}` (DH/templates/ui/countdowns/parts/countdowns.hbs:2) with `.hidden { display: none }` (DH/styles/less/ui/countdown/countdown.less:111-113), and the container itself only when some visible type has entries (countdowns-view.hbs:24). The only way to change the flag is the toggles the module removes (`#onToggleCountdownTypes`, countdowns.mjs:242-250) |
| effect | a user (GM or player) whose flag excludes `narrative` - set before the module was enabled, or through the toggles on a build that still showed them - sees no project rows, permanently, with no control to bring them back; the module's own passes (`hideUndiscovered`, `paintProgress`, `nameSecretRows`) still run on rows that are in the DOM but inside a `display: none` category |
| stand-in | no harness stand-in draws `.countdown-category-container.hidden` or reads the flag (scenario 74's rows have the category container without the class) |
| confidence | suspected - the mechanism is read in 2.12.8; whether any table has such a flag set is not known |
| severity | wrong for players / wrong for GM (projects invisible to that user), only where the flag was set |
| holdable headless | partly: a stand-in category with `hidden` shows the rows are not seen; whether a real user carries the flag needs the table |

LIVE draft (LIVE-A113-C1-2): at a table with one project, as a player run
`game.user.getFlag("daggerheart","countdown-type-modes")` and record the value. If it lacks "narrative": record whether
the project's row is visible in the tray. Repeat for the GM. Record the value and visibility per user.

#### A113-C1-3 - the sheet contract reports three missing anchors whenever Daggerheart's pips layout is on

| field | value |
| --- | --- |
| module | M/scripts/patches.mjs:248-250 - `.character-sidebar-sheet .resources-section .status-bar`, `input.bar-input`, `progress.progress-bar` are required anchors (no `optional`); `noteSheetRender` (patches.mjs:1522-1528) warns and, on the primary GM, `watchSheetRenders` runs `announceContract` (patches.mjs:1545) |
| 2.12.8 has | with `useResourcePips` on, DH/templates/sheets/global/partials/resource-bar.hbs:1-17 draws `.slot-value > .slot-bar > .slot` and no `.status-bar`, `input.bar-input` or `progress`; the armor block in DH/templates/sheets/actors/character/sidebar.hbs:22-42 is the same (`slot-value`, no bar input or progress). Those three classes occur nowhere else in the character sheet's templates. `useResourcePips` is part of the `appearance` setting, scope `client` (DH/module/systemRegistration/settings.mjs:114-121; DH/module/data/settings/Appearance.mjs:10) |
| effect | a GM who turns pips on in their own client gets "The contract: the character sheet has no ..." in the console and a contract notice that says what the module puts there "is not drawn", while sheet.mjs `paintReserves`/`reserveBlock` (sheet.mjs:2329-2360) handles the pips layout correctly. A false alarm, not a broken sheet. The two pip anchors at :251-252 are already `optional` the other way round; the bar anchors have no matching `optional` |
| stand-in | R1548 (tests-tier1.mjs:34928) and R1549 (tests-tier0.mjs:17971) check the reading logic and that each selector is a literal of sheet.mjs, not which layout a sheet draws; the style harness's `?sheet=parts&pips` (audit/style-harness.html:342-367, copied from 2.10.5) models the pips layout but is not fed to `readSheetAnchors` |
| confidence | confirmed in the templates; the notice path read, not run |
| severity | wrong for GM (a false contract notice; no player-visible effect) |
| holdable headless | yes: `readSheetAnchors` on the pips-layout markup (the style harness's or a copy of resource-bar.hbs's first branch) must leave `missing` empty |

LIVE draft (LIVE-A113-C1-3): as the primary GM, Daggerheart's Appearance settings, turn on resource pips, reload,
open any student's sheet. Expect: no "The contract: the character sheet has no ..." warning and no contract notice.
Record: the console warning text if any, whether a notice/whisper appeared, and `game.drpg.diagnosePatches()`'s
sheet row.

### Hooks and selectors checked that match 2.12.8 (one line each)

- Render hook names fire for every class in the chain: `renderCharacterSheet` (CharacterSheet, character-sheet.mjs:18), `renderPartySheet` (PartySheet), `renderDhCountdowns` (DhCountdowns, countdowns.mjs:12), `renderD20RollDialog` (D20RollDialog), `renderItemSheetV2`, `renderActorSheetV2`, `renderTokenHUD` (DHTokenHUD extends TokenHUD), `closeCharacterSheet`; `game.system.api.applications.dialogs.d20RollDialog` exported (dialogs/_module.mjs:4).
- Countdowns: `#countdowns` id, classes `daggerheart dh-style countdowns`, `frame: false`; `.countdowns-header`, `.header-type-toggles`, `[data-action=toggleViewMode|editCountdowns|increaseCountdown|decreaseCountdown]`, `.countdown-container[data-countdown]`, `.countdown-content > header`, `.progress-tag`, `.countdown-tool-controls a`, the row context menu target and `_getCountdownContextOptions` (countdowns.mjs:83, 366); `element.hidden` set in `_onRender` before the hook (countdowns.mjs:93); appended to `#ui-right-column-1`.
- Character header: `.character-header-sheet`, `.name-row`, `.character-row > .resource-section > .hope-section .hope-value`, `.character-details`, `.character-traits .trait[data-attribute] > .trait-name > .tier-mark`, `.trait-value`, `.downtime-section [data-action=useDowntime]`, `[data-action=toggleResourceManagement]`.
- Tab bar: tab-navigation.hbs `section.tab-navigation .navigation-container nav.sheet-tabs.tabs a[data-tab] > span`, the `openSettings` button inside `.navigation-container` (module CSS covers both `> button` forms); tabs `features|loadout|inventory|biography|effects` as `section.tab.<id>[data-tab]`, parts ids the same (character-sheet.mjs:114-161).
- Sidebar: `.character-sidebar-sheet .portrait`, `a.death-roll-btn`, `.resources-section`, bar layout `.status-bar .status-value progress.progress-bar input.bar-input[name=system.resources.X.value] .bar-label`, pips `.slot-value .slot[data-action=toggleX] .slot-label .value`, `.equipment-section h3`, `.loadout-section h3`, `.items-sidebar-list`, `.shortcut-items-section`, `.experience-section .experience-list .experience-row .experience-value/.experience-name/.controls`. (2.12.8 adds `.empty-slot` spans in `.slot-bar`, which the module hides whole.)
- Biography: `section[data-application-part=biography]`, `fieldset.glassy.biography-section > legend`, the field `name="system.biography.background"` (character-sheet.mjs:388); characteristics and connections by `[name*=...]`.
- Inventory: `.search-section`, `.search-bar`, `input[type=search]`, `a.filter-button` all hidden by module CSS (danganronpa.css:2320-2329, 4618-4630, 17269); module groups prepended to the part.
- Features: `fieldset > legend > a[data-action=addNewItem]` hidden (danganronpa.css:2251).
- Item sheets: `.tab-navigation a[data-tab]`, `section.tab.settings|actions|effects` (loot/consumable PARTS and base-item TABS), `.item-sheet-header .item-info`, `.item-description > h3` (categoryLabel), `input[name=name]`, `prose-mirror[name=system.description]`, `[data-action=editGMNote]` (added in DH `_onRender` before the hook, base-item.mjs:408-430).
- Character settings window: classes `daggerheart dh-style dialog character-settings` (`sheet` removed, actor-setting.mjs:35), `.tab.details .traits-inner-container`, `.two-columns`, `.trait-container > span`, `[name=system.resources.hitPoints.max]` in a `span > .form-group`, `.tab.experiences .experience-item a[data-action=removeExperience].disabled`, `.add-experience-btn > span`.
- Party sheet: `.actor-resources`, `a[data-action=openDocument][data-uuid]`, `.slot-section .slot-label[data-tooltip="DAGGERHEART.GENERAL.HitPoints.plural"|"DAGGERHEART.GENERAL.stress"] .value .current/.max`, `.slot`.
- Roll window: classes include `roll-selection`; `.roll-dialog-container`, `[data-action=toggleReaction] i`, `.advantage-chip`, `.disadvantage-chip`, `select[name^="roll.dice."]`, `select[name=trait]`, `[data-action=selectExperience]`, `input[name=extraFormula]`, `select[name=selectedMessageMode]`, `button.submit-btn i.fa-dice`, `input[name^="costs."]` in `li` in `fieldset > ul`.
- Chat header: `.message-header .portrait img`, `.message-header-main > h4`, `.subtitle .name` (ui/chat/chat-message.hbs:3-37).
- Token HUD: `input[name=bar1]`, `input[name=bar2]` (DH/templates/hud/tokenHUD.hbs:46,52).
- Fear and effects: `#resources`, `#resource-fear`, `#effects-display` (fearTracker.mjs:28, effectsDisplay.mjs:22).
- Module CSS class sweep: every non-`drpg` class in styles/*.css was looked up in DH templates/module/styles and in scripts/; the ones found in neither are Font Awesome, Foundry core or other modules, or defensive extras in hide-lists (`.inventory-section`, `.item-filters`, `.tab-title`, `.features-header`, `.dh-effects-display`), each beside a selector that does match 2.12.8.

### Stand-ins noted (no mismatch found beyond the above)

- audit/harness/lib/dh-dice/applications/dialogs/d20RollDialog.mjs: written from 2.10.5. 2.12.8's rollSelection.hbs adds a `hasRoll` branch (a Continue button, no dice selects), an `isLite` branch and effect chips (`.experience-chip[data-action=toggleSelectedEffect]` in a second `.experience-container`); the module's readers select by `data-action`/`name`, so none of these changes what they find. The stand-in's buttons carry `type="button"`, the template's do not (the stand-in says so itself).
- audit/style-harness.html `?sheet=parts`: sidebar copied from 2.10.5 with `equipment-section`/`loadout-section` as `div`; 2.12.8 has `section`. No module selector or `closest()` depends on the tag.

### Could not check

- Foundry v14's own markup and ApplicationV2 behaviour (render order of `_onRender` vs the render hook, `root: true` part replacement, prose-mirror's toggle button and `readonly`): no Foundry source here.
- 2.6.5 / 2.10.5 templates: not here, so whether C1-1's `#if` is new in 2.12.8 or was always there is unknown.
- Layout and cascade of the 31k lines of module CSS against DH's LESS: only class existence and the structural (`>`) selectors were checked.
- audit/windows captures: listed, none of them is a Daggerheart window (they are the module's own), so none was compared.
- Level Up, character creation, downtime and death-move windows: the module hooks none of them by markup (grep), not opened further.

## C2 evidence

Scope: main ceb9e9c8. Nothing was run; every finding is a reading of the source. Not re-reported:
"three things after a death" (fix-113h), Facilities tile vs window (fix-113f), the day boards' timing (fix-113j),
Scrum Debate phases (fix-113l). Where a finding may touch fix-113h it says so.

### Findings

#### A113-C2-1 - An execution is heard three or four times, and differently on its two roads
- Files: scripts/trial-progress.mjs:171-174 (the kill), :193 and :228-235 (`postExecutionCard`, sfx `execution`);
  scripts/chapter.mjs:146 (`markDeceased`, `silent = true` by default), :318-331 (`killCharacter`'s GM card, sfx
  `death`, `gm: true`); scripts/spectator-dead.mjs:350-356 (`playMoment`, sfx `deathFade`, which
  config.mjs:5288-5293 falls back to `death`'s file); scripts/trial-floor-ui.mjs:694-697 (`closeTrial`'s card, sfx
  `trialClose`).
- What the code does: End the trial runs `executeAtExit` and then its own card. A student executed alive goes through
  `killCharacter(actor, { secret: false, phase: "classTrial", cause: "executed", chapter })` - `silent` is not passed,
  so it is false: the GMs' death card carries `sfx: { key: "death", gm: true }`, and `markDeceased(..., { silent })`
  makes the Spectator with a fade that is not silent, so the executed player's browser plays `deathFade` (the death's
  file by default). Then the execution card plays `execution` to the table, then the trial's close card `trialClose`.
  Within about a second: GMs hear death + execution + trialClose; the executed player deathFade + execution +
  trialClose. A student whose death the GMs kept is executed through `publishDeath`, which calls `markDeceased`
  with its default `silent: true` and posts no GM death card: no `death`, no fade, no `deathFade`.
- What it should do: trial-progress.mjs:211-214 (E70 C4, "amend 0's sound rule"): "The verdict's card said who was
  executed, with the death's sound ... both come here, to the moment it happens, with the execution's own sound
  (`SFX_EVENTS.execution`)" - one sound for the execution, the death's sound moved here, not added. And the two
  roads to one execution should draw and sound the same. Whether the executed player gets the fade at all at the
  trial's exit is the owner's (E62 C3 SB-C3 #17 says only "a death in play fades").
- Evidence: `: await killCharacter(actor, { secret: false, phase: "classTrial", cause: "executed", chapter });`;
  `...(secretly ? {} : { flags: { [MODULE_ID]: { sfx: { key: "death", gm: true } } } })`;
  `flags: { [MODULE_ID]: { executionCard: true, sfx: { key: "execution", gm: true } } }`;
  `flags: { [MODULE_ID]: { sfx: { key: "trialClose", gm: true } } }`. sfx-play.mjs:52 cools a key down for 80 ms
  only, per key, so different keys never merge.
- Confidence: read. Severity: wrong for players and GM (sound pile-up; the two roads disagree).
- Headless: yes - count `playSfx` keys per browser across `closeTrial()` with one sentenced student alive and one
  with a kept death (both roads); expect one execution sound per browser and the same set on both roads.
- May touch fix-113h if that fix changes `killCharacter`'s card or the fade's `silent`; the execution road is not
  named in fix-113h's title.

#### A113-C2-2 - The executed player's death fade and the trial's exit sequence run on one curtain at once
- Files: scripts/death-fade.mjs:214-264 (`playCurtain`, batch layers clipped to `glassModule.LAST.panes`, 3.6 s),
  :278-284 (`onDeadMoment`); scripts/sequence.mjs:513-531 (`playTrialExit`, `exitPieces`, 3.4 s), :925 (the
  sequence engine cuts only sequences); scripts/clock.mjs:890-927 (`reconcilePhase`: the sentence before the hall's
  move and `removeBodyTiles(null)`).
- What the code does: End the trial kills the sentenced student before its phase write (trial-floor-ui.mjs:668), so on
  the executed player's browser the Spectator's token hook starts the fade (`playCurtain("fade")`, layers cut from
  the curtain's panes as they stand - the trial hall's cut) and a few hundred ms later the clock's move out of the
  trial starts `playTrialExit`, which takes copies of the curtain, closes, shows TRIAL ADJOURNED and opens onto the
  hour's cut. Neither file reads the other: death-fade.mjs has no check for a running sequence and sequence.mjs none
  for `running` in death-fade.mjs. The fade's batch layers were clipped to the old cut, and the rest state
  (`drpg-bare-glass`) lands at 3.6 s on the new one.
- What it should do: one picture at a time on that browser - e.g. the fade waits for `whenTrialExitEnds()` (as the
  day boards do since 12.11.2026, transitions.mjs:146) or the exit is cut short; the owner's call. SB-C3
  (docs/dev/e62/STATUS.md) and the exit decision of 12.11.2026 do not mention each other.
- Confidence: suspected (timing read, not measured). Severity: wrong for players (the executed player, cosmetic at worst
  to a garbled curtain at worst).
- Needs the table. Draft LIVE row: "LIVE-A113-C2-2 - an execution at End the trial, Stained Glass, 1366x768, sequences
  on: the executed player's screen. Click End the trial with one sentenced living student. Expect: one picture at a time
  (exit then fade, or the reverse), the glass bare at the end on the school's cut, no grey patch where the hall's panes
  stood. Record: a screen recording of the executed player's browser and `game.drpg.counters()` before and after
  (`deathFade.drawn`, `sequence.started`, `sequence.cut`)."

#### A113-C2-3 - Chapter end over a trial: the exit's title names the next chapter
- Files: scripts/chapter.mjs:2396-2410 (step `clock` moves chapter/session first), :2427-2434 (step `trial` then runs
  `closeTrial`); scripts/sequence.mjs:376-380 (`drawTrialEntry` reads `clock.chapter` of the clock after the move),
  :248-254 (`titleBand`); lang/en.json `DRPG.Sequence.exitSubtitle` = "Chapter {chapter} · Back to school".
- What the code does: End of chapter with "end the trial" ticked moves the clock to chapter N+1 while the phase is still
  classTrial, then closes the trial; the exit is drawn from the clock after both writes, so it reads "TRIAL ADJOURNED /
  Chapter N+1 · Back to school". End the trial alone reads "Chapter N". The chapter-end comment at :2411-2419 keeps
  that order on purpose (the elapsed clock), and nothing told the E61 exit about it.
- What it should do: unclear - the owner's decision of 12.11.2026 ("the chapter's line when the clock has a chapter")
  does not say which chapter. Ask the owner; the record of the trial (`trialProgressChapter`) holds N.
- Confidence: read. Severity: cosmetic.
- Headless: yes - run the chapter end with `endTrial` from a trial in chapter 1 and read the exit band's text.

#### A113-C2-4 - Students window, Monocub to alive: the Spectator is made and taken away in one Apply
- Files: scripts/gm-students.mjs:643-646; scripts/monocub.mjs:197-212 (`setMonocub(false)`: `monocubBecomesWatcher`,
  toast `DRPG.Monocub.unopted`); scripts/spectator-dead.mjs:279-300; scripts/chapter.mjs:653-703 (`reviveCharacter`:
  `removeDeadSpectator`, toast `DRPG.Chapter.revived`).
- What the code does: `await setMonocub(actor, false); await reviveCharacter(actor, { silent: true });`. The first
  re-links the Monocub's tokens to a fresh Spectator actor (or places one at the body), with the curtain moment
  "spectator" (bare at once on the player's screen) and a toast; the second deletes those tokens and the actor
  (moment "return", silent) and toasts again. Every browser sees a Spectator token come and go; the GM reads two
  toasts for one change; the player's curtain goes bare and lit in a row.
- What it should do: a revive straight from Monocub (what `reviveCharacter` already handles: spectator-dead.mjs:189,
  "goes with the revive as the Spectator's would") - E72's `setMonocub` and E62 C3b's revive each do the whole move.
- Confidence: read. Severity: cosmetic (GM and the player's curtain); one extra actor and token write.
- Headless: yes - `applyAliveStates({ [id]: { state: "alive" } })` on a Monocub: count createActor/createToken and
  toasts; expect no Spectator created.

#### A113-C2-5 - The victim's player hears the death twice at a kill in an incident
- Files: scripts/chapter.mjs:241-251 (kept death: `ensureDeadSpectator(actor, { silent, kept: true })`, `silent`
  false from `killCharacter`'s default), :297-334 (`playSfxForUsers(deathAudience, "death")`);
  scripts/settings.mjs:3488 (the victim is a seat from stage `incident`); scripts/incident-store.mjs:399-411.
- What the code does: the victim's owner is in `incidentAudienceIds`, so receives `death`; the Spectator's fade plays
  `deathFade` on the same browser - by default the same file (config.mjs:5292 `fallsBackTo: "death"`), two keys, so the
  80 ms cooldown does not merge them.
- What it should do: config.mjs:5290 says the fade's sound is "Heard by the dead student's player alone, as their
  screen fades out" - the one sound for that player; `death`'s audience is "everyone whose character was part of the
  incident". One of the two should leave the victim's owner out.
- Confidence: suspected (order of the two awaits read, not timed). Severity: wrong for players (a doubled sound).
- Headless: yes - kill the incident's victim, count `playSfx` on the victim's owner. Possibly inside fix-113h's
  "three things after a death"; check before fixing twice.

#### A113-C2-6 - "Until this time of day ends" ends at two different boundaries
- Files: scripts/eclipse.mjs:291-323 (grants and seals end at the Eclipse's start, CALL-09); scripts/doors-gm.mjs:367-371
  (barricades end at the Eclipse's start and at the time of day's change); scripts/timed-effects.mjs:322-330
  (`until: "timeOfDay"` rows end only at `drpgTimeOfDayChanged`); scripts/lockpick-gm.mjs:175-177 (passes likewise);
  scripts/eclipse.mjs:436-439 and :466 (`endEclipse`: the advance, then `judgePendingMurders`).
- What the code does: E93's timed effects and passes end when the Eclipse ENDS (the advance fires the hook); E17/CALL-09
  rules (grants, seals) and the barricades (doors-gm.mjs:17) end when it STARTS ("the Eclipse is the boundary, not a part of the day it follows",
  eclipse.mjs:281). At the Eclipse's end, `endTimedEffects` starts on the primary from the hook while
  `endEclipse` goes on to judge the direct murders declared in the dark - whether a trait bonus from a room action
  is still on the sheet when that fight's rolls start is a race between two stages.
- What it should do: one boundary for "this time of day" (eclipse.mjs's reasoning says the start); E93's STATUS
  ("when the time of day it was given in ends") does not say which. Ask the owner.
- Confidence: suspected. Severity: wrong data (a bonus or a pass held one placement window longer than a seal).
- Headless: yes - give a timed trait bonus, start an Eclipse, read the row; then end it with a parked direct murder and
  read the trait as the murder opens.

#### A113-C2-7 - The HUD chevron's dim is a second copy of `startRefusal`
- Files: scripts/hud.mjs:1267-1275 vs scripts/eclipse.mjs:135-178.
- What the code does: the HUD recomputes the body hold and the incident check by hand; `startRefusal` is the gate the
  press reaches (boundary.mjs:100). Identical today (both: body record and phase not investigation; incident stage not
  resolution); the trial check is absent from the HUD only because no chevron is drawn in a trial.
- What it should do: read the same function (it is async; a sync twin would do). Not a disagreement now; a drift risk
  of the Facilities kind (fix-113f).
- Confidence: read. Severity: none today. Headless: yes - a pairwise test over the states.

### Events swept and found consistent (one line each)
- Body announced (`drpgBodyAnnounced`): transitions flicker cuts pending flashes (R4652); tails, Autopsy, case ask each
  primary-only, rehearsal ignored; anonymity regrey local only - no duplicate card or sound.
- Time of day changed: Despair settlement, betrayal sweep, barricades, passes, timed effects, tails each primary-only and
  serialised; trace digest once; day summary and transitions share `seen` and skip repeats.
- Eclipse start: one card with `eclipseStart`, whispers per student, watches started on the primary; curtain turn has
  no flashes or sound; the summary waits for the turn (`summaryDelay`).
- Eclipse end with advance: one packet (E37 C2), `eclipseEnd` rides the advance's card; watches' summary and the
  Eclipse's extra crossings end on the primary only.
- `drpgDeathsChanged`: voice reconcile (GM) and trial voices (primary) are separate debounced writers on different
  state; murder-rules `killerFell` primary-only and idempotent; death-fade waits 1.5 s for a moment.
- Trial entry: one sequence with `trialStart`; budget, record reset, mute and Key charge in `reconcilePhase` in order.
- Trial exit body tiles: the executed's tile laid and removed in one click by design (E63 Q2).
- Revive (plain): Spectator removed first, flag, status, body tile, toast - one road; Monocub's bet/order cleared.
- Season reset deaths group: Spectators, revives, store clear, then every body tile - ordered in one `everyPart`.
- Chapter end: steps run in order on the primary with a phase hold; the boards after the exit are fix-113j's.

## C3 evidence

Read-only. Tools run: `node tools/check.mjs parity` (green: en 5735, pl 6790, missing 0, 254 plural families, 0 forms
missing) and the auditor's own throwaway scripts (not committed) (`keys.mjs` flattens both lang files and lists a prefix's children;
`wrappers.mjs` follows local `t(key)`-style wrappers to their literal callers; `tables.mjs` lists every
`{ member: "DRPG.x" }` lookup table and its readers; `stores.mjs` holds `DRPG.Case.store.*` to every `defineGmStore`;
`reasons.mjs` holds `REASONS` to `DRPG.Bridge.why.*`). 205 template-literal i18n sites over ~150 prefixes were listed;
the sets named in the brief and every set grown in the last 60 commits (base 0f3c3224) were followed to their readers.
The known instance (MODES vs `DRPG.Hud.trial.*`, fix-113k) is not re-reported; see note N1 for its other readers.

Since en/pl parity is green, every finding below is "member missing from the reader", not "key missing in one language".

---

### A113-C3-1 - Case Map: a sent Autopsy / given Truth Bullet has no state word

- **Where:** scripts/case-map.mjs:77 (`STATE_KEYS`), read at :106 (node label) and :233 (side panel's State row).
- **Set:** `nodeState()` answers (case-map.mjs:35-41): `schema`, `planned`, `held`, `onMap`, and since 6964661f
  (13.11.2026, "A planned Autopsy, sent at the body's discovery") also **`sent`** (`node.kind === "autopsy" ||
  "bullet"` with `node.sent`; a bullet's `sent` is `node.given !== null`, case-schema.mjs:310).
- **Missing member:** `STATE_KEYS = { held, onMap, planned }` - no `sent`. The commit added
  `DRPG.CaseMap.state.sent` to both files (en "Sent", pl "Wysłany", confirmed by `keys.mjs DRPG.CaseMap.state` ->
  `sent held onMap planned`), but no reader can reach it.
- **Shown instead:** nothing - `STATE_KEYS[state] ? L(...) : ""`, so the node's spoken/tooltip text (`said`, :110)
  drops the state and the side panel omits its "State" row. The class `is-sent` is still put on the node.
- **Confidence:** confirmed (key present and unused; table read; `nodeState` read).
- **Severity:** cosmetic, GM only (the Case Map is a GM window). The GM loses the one word that says the Autopsy
  went out at the discovery - which is what that commit was about.
- **Headless:** yes. Tier 1: for each value `nodeState` can answer except `schema`, `STATE_KEYS` has a row (export the
  table or render `caseMapHtml` with a sent autopsy node and assert the panel holds `DRPG.CaseMap.state.sent`'s text).

### A113-C3-2 - a second GM's Skip in Straw Poll / Logic Dive / Scrum Debate is refused as "moved on"

- **Where:** scripts/bridge-table.mjs:1223, `[ACTION_FLOOR_NOW].sanitize: pick({ mode: as.oneOf("objection",
  "rebuttal", "testimony", "panic", "closing"), startedAt })`.
- **Set:** floor-machine.mjs `MODES` gained `straw`, `dive`, `scrum` (E73, 5101742c, 12.11.2026). The same commit
  taught the sender: trial-floor.mjs:1527-1528 `advanceFloorNow` now also sends for `isZoneMode(floor?.mode)`
  ("a Straw Poll or a Logic Dive question counted, a Scrum turn passed") as `seen = { mode: floor.mode, startedAt }`.
- **Missing member:** the sanitizer's list was not told. `as.oneOf` answers `null` for a value not listed
  (bridge-guards.mjs:1514), so the primary runs `handleFloorNow` (bridge-runs-records.mjs:774) with `mode: null`;
  `floorAsSeen` (trial-floor.mjs:1544) compares `floor.mode === null`, false, and the run refuses
  "the trial's floor has moved on since that Now was pressed" -> code `movedOn`.
- **Shown instead:** on the GM who pressed (any GM that is not the primary: an Assistant or a second Gamemaster),
  the bar's Skip in a zone mode (trial-floor.mjs:1383 `skipStep` -> `advanceFloorNow`) moves nothing and toasts
  `DRPG.Floor.nowMovedOn`. On the primary it runs locally (`local:`), so a one-GM table never sees it. The bar's
  Count and Skip question go through `trial.gm`, whose list does include the zone ops (bridge-table.mjs:1314-1316).
- **Confidence:** read (the whole road traced; not run).
- **Severity:** wrong for the GM (a non-primary GM's control does nothing, with a misleading reason). Players unaffected.
- **Headless:** yes. Tier 1 census: for every `MODES` member `advanceFloorNow` sends for (all but `debate`),
  `BRIDGE_ACTIONS["floor.now"].sanitize({ mode, startedAt: 1 }).mode === mode`. End to end: a scenario with a second
  GM (61/62 have `gm2`; 63 X drove gm3's Now) opens a Straw Poll on the primary and presses Skip on gm2.

### A113-C3-3 - action keys that are not tiles printed raw in the Reroll's GM lines

- **Where:** scripts/calls.mjs:591 (`rollAfterReload`, the GM's branch: `DRPG.Reroll.lastRollGmRow`'s `{action}` =
  `ACTIONS[row.actionKey]?.label ?? row.actionKey`) and scripts/reroll.mjs:936 (an interrupted Reroll's whisper to
  the GMs, `DRPG.Reroll.interruptedGm`, `ACTIONS[row.action]?.label ?? row.action`).
- **Set:** the action keys the GMs' Reroll bookmark keeps (action-pipeline.mjs:667 `keepGmBookmark`, any
  `/^[a-zA-Z]{1,32}$/` key). Since E74/E93 (1.2.111) the Reroll replays `INFILTRATE_REROLLS = ["dash", "tail", "shut",
  "force", "pick", "keepWatch", "facility"]` (infiltrate-reroll.mjs:23), so those keys now reach the bookmark; older
  ones (`steal`, `rummage`, `frisk`, action-pipeline.mjs:680-686) were never `ACTIONS` keys either.
- **Missing members:** `ACTIONS` (config.mjs:1509) holds search, observe, analyze, project, dynamic, rest, listen,
  palm, tamper, directMurder, move, sabotage - none of the seven above. Their words exist elsewhere:
  `DRPG.Infiltrate.row.<key>.label` (dash, tail, shut, force, pick, keepWatch) and the room action's own `offer.label`.
- **Shown instead:** the raw identifier, e.g. "dash" / "keepWatch" / "facility", in English at a Polish table.
  trait-ruling.mjs:358 shows the pattern was met once and fixed for `tail` alone (`rulingLabel`); these two readers
  were not. The player's branch (calls.mjs:560-563) falls back to a sentence without the action, which is fine.
- **Confidence:** read (bookmark key traced from action-listen.mjs:226 `actionKey: "dash"` and the replay switch).
- **Severity:** cosmetic, GM only. reroll.mjs:936 is a rare path (a Reroll cut mid-replay).
- **Headless:** yes. Tier 1: give the bookmark store a row `{ actionKey: "dash", messageId }` with a duality roll and
  assert `rollAfterReload(actor, { gm: true })` does not contain the bare key; or one shared `actionWord(key)` held by
  a census over `INFILTRATE_REROLLS` plus `ACTIONS`.

### A113-C3-4 - two new trace sources have no action word; the raw key is baked into the ledger

- **Where:** scripts/doors-gm.mjs:321-322 (`action: "infiltrate"`, Shut/Force/Pick's trace) and
  scripts/facilities-gm.mjs:184 (`action: "facility"`, a room action's trace), both of E93/E74 (1.2.111; blame
  boundary 4b4dd98d / e15b6013 in this shallow clone).
- **Set:** the `action` a Remnant names. Its readers: remnants.mjs:688 `actionLabelOf` = `ACTIONS[action]?.label ??
  actionLabel(action)`, and :664 `actionLabel` = `DRPG.Remnant.action.<action>`, else the bare key.
- **Missing members:** `DRPG.Remnant.action.*` = search sabotage project dynamic incident resolution discard manual
  loot (script output) - no `infiltrate`, no `facility`; neither is an `ACTIONS` key (config.mjs:1509-1900 read).
  (`DRPG.Reroll.infiltrate.facility` exists; it is a different family.)
- **Shown instead:** "infiltrate" / "facility" as the trace's action on the GM's trace card (remnant-ring.mjs:358,
  "Action" row), on the dashboard's context line (remnants.mjs:2035) and the ledger table (remnants.mjs:2085). And
  remnants.mjs:458 writes `" · infiltrate"` into the ledger row's `label` when the trace is placed, so the raw word is
  stored and a later lang fix does not reach traces already placed.
- **Confidence:** confirmed (keys missing by script; both `dropRemnant` calls read).
- **Severity:** wrong data (the stored label) and wrong for the GM (cards, dashboard). Players do not see Remnants.
- **Headless:** yes. Tier 1 census: every literal `action:` handed to `dropRemnant`/`placeRemnant` in scripts/ is an
  `ACTIONS` key or has `DRPG.Remnant.action.<key>` (the same read-the-source shape as R220); or place a door trace in
  the harness and assert the ledger label has no lower-case bare key.

---

### Notes (not new findings)

- **N1 (the known instance's other readers).** `DRPG.Hud.trial.<mode>` is also read at events.mjs:523 (the event
  card's title), voice.mjs:1371 (a Monocub's `cubListen` line `{mode}`: in a zone mode the sentence carries the raw
  key `DRPG.Hud.trial.straw`, and the HUD row at hud.mjs:1193 shows it to that player) and hud.mjs:868 (the width
  probe measures only discussion/debate/objection/rebuttal, so testimony, panic, closing and the zone modes can widen
  the slot - cosmetic). All three are covered if fix-113k adds the keys; not if it maps modes inside hud.mjs only.
- **N2 (suspected, decision not recorded).** sequence.mjs:941 `lateSequence` catches up trialEntry, dayStart and
  verdictCut; `trialExit` (new 12.11.2026) is not caught up and the header (sequence.mjs:12-20) records why dayEnd is
  left out but says nothing of trialExit. Possibly deliberate; worth one line in the header either way.

### Sets checked and clean

- floor `MODES` incl. closing/straw/dive/scrum: `DRPG.Floor.mode.*` (all 9), `MODE_RULES`, `MODE_STARTS`,
  `TRIAL_MODE_MUSIC`, `trial.gm` op list, `Zones.<mode>.opened`, `Zones.picker.hint.*`, `Zones.panel.<mode>.<phase>`
  against the phases zone-machine.mjs writes (straw vote; dive vote, pause; scrum setup, speak); `TRIAL_NEXT_STEPS` vs
  `DRPG.Floor.next.*` and `TRIAL_LEADS`; `BAR_LABELS`.
- `REASONS` (77) vs `DRPG.Bridge.why.*`; `RULE_CODES` (incl. barricaded, onWatch); `DRPG.Passage.why` (table + R983).
- Calls: `grants` values vs `Calls.grants/grantsGen/grantsNom` (the one `grants: "step"` is a threshold, not a Call).
- Overflow effects (13) vs `Overflow.name/what`; Price `pay` (action/hope/stress) vs `Price.label/paid`.
- Murder stage/side/band, `Cleanup.blocked`, `Cleanup.band`, `Action.duality`, `Roll.opening`, `thresholdDefended`.
- Phases vs `Explain.phase`; TIMES_OF_DAY via config prose; `STATES` ids; `LEVEL_UP` kinds vs `Advance.kind/reason`.
- Facilities (E93): `FACILITIES.effects` (17) vs `Facility.effect`, `timedUntil` vs `Facility.until`, scopes,
  `Facility.applied.*` for every `t(...)` literal, `Facility.state`, `Facility.shut`; `INFILTRATE_REROLLS` vs
  `Reroll.infiltrate.*`; `Infiltrate.row/trace/force/pick/watch/tail.end` (tail ends: day, lost, dash, body).
- Notices: `NOTICE_KINDS`/popup `KINDS` vs `Popup.kind`; `NOTICE_SOURCES` vs `SOURCE_LABELS`; `Events.ticker`
  (guarded: no ticker for a kind without a word, by design).
- Voice: `micHold` reasons vs `Voice.held.*` (`secretDead` goes only to `heldLine`, voice-tile.mjs:1298, which maps it).
- GM panel: `PANEL_SECTIONS`, `ROLES`/`ROLE_WORDS` (student, monokuma, spectator, npc), `Panel.group` (spectators
  included), `Panel.state`; settings window sections; `RESET_GROUPS` vs `Season.group`; setup steps vs
  `Season.step/hint` (liveKitSecret carries its own `hintKey`).
- Case: 58 `defineGmStore` names vs `Case.store.*`; `CASE_PROBLEMS`, `needs` fields (room, name, recipient),
  `SUMMARY_ROLES`, `CaseMap.plan/sort/newLabel`, `CaseRealize.action` (placed, overLimit, create).
- Projects: owned presets vs `Project.preset.*` and `<preset>Summary`; `TRAP_TRIGGERS` vs `Trap.trigger`
  (`Trap.why.${kind}` is reached only for `watch: "action"` triggers); the trap relay's `kind` list (passage and item
  are never relayed, by its comment).
- Dice look: `DICE_LOOK_CHOICES` vs `DICE_LOOK_WORDS`; `FINDING_KEYS`/`LOOK_CODES` (closed by R1294). Whether every
  reader of `forceDiceLook` should now also read `diceLookKind` (dice-look.mjs:340 reads the Boolean alone) was not
  judged here.
- Others clean: `Anonymity.<kind>.<level>`, `Items.restore`, `Unit`, `Kit.check` (throws on an unknown state),
  `RollDialog.source`, `Monocub.flag`, `Observe` (guarded by `OBSERVE_MODES`), Passage tab cells, frisk outcome tables
  (guarded), `BREATH_REFUSED`, `TRACE_WORDS`, sequence `TITLE_KEYS` (falls back to the entry's).

Not covered: sheet tabs and a few dozen single-site prefixes (Diagnostics, Fog.check, DhSettings, Contract, Config),
which are checked by their own suite rows or are console text; sets read through `switch` without a template were
sampled, not swept.

## C4 evidence

Read-only audit of ceb9e9c8 and the ~60 commits before it, plus v1.2.104-v1.2.112 notes. Nothing run (no harness, no
npm). Every finding below is from reading source; "confirmed" means the code path was traced end to end in source.
Excluded as already in hand: E100's open-tab mark, sheet sideways scroll, Facilities tile vs window, three things after
a death, owed Despair, day boards' timing, HUD mode keys, Scrum phases, tray title, Hope, GM panel.

### Findings

#### A113-C4-1 - "Paid by a Sprint" on a crossing paid by a Dash or a Facilities crossing

- Fix: 73b6c5ba "'a free crossing' in Move's texts" (1.2.112). It renamed the Move hint/description (config.mjs
  1889-1893, lang pl `Actions.move.hint/description`) and `DRPG.Move.nextSprint` to "a free crossing", because a Dash
  and a Facilities room action bank into the same counter as a Sprint (its own comment: "actions.mjs `grantFreeMoves`,
  and a crossing takes whichever is there (`takeMove`)").
- Missed sibling: the card after the crossing itself. scripts/movement.mjs:3285-3287
  `: cost === "sprint" ? plural("DRPG.Move.wasSprint", { n: freeMovesLeft(actor) })`, and lang/en.json:3984-3986
  `"wasSprint": { "one": "Paid by a Sprint. {n} left." ...}`, lang/pl.json:4295-4299 `"Opłacone przez Sprint. Zostało {n}."`.
- Why it is the same case: actions.mjs:351-353 and :370 answer `"sprint"` for any banked free crossing
  (`freeMovesLeft(actor) > 0`), and the counter is filled by Sprint (call-effects.mjs:1165), Dash
  (bridge-runs-acts.mjs:173, infiltrate-reroll.mjs:50) and Facilities (facilities-gm.mjs:139). So a student who Dashed
  and then crosses is told "Paid by a Sprint", having bought no Sprint. The briefing before the crossing now says "a free
  crossing"; the card after it still says Sprint.
- Confidence: confirmed (source). Severity: wrong for players (text). Headless: yes - tier 1/2: grant via
  `handleDash` (or `grantFreeMoves(..., {reason:"facility"})`), cross, read the owner's card for the Sprint word, EN and PL.

#### A113-C4-2 - the sheet's budget line says a Dash's crossings were "bought with Hope"

- Same fix 73b6c5ba, same counter.
- Missed sibling: scripts/sheet.mjs:5009-5010
  `const sprint = freeMovesLeft(actor); if (sprint) parts.push(plural("DRPG.Actions.sprintBanked", { n: sprint }));`
  with lang/en.json:554-556 `"sprintBanked": { "one": "{n} crossing bought with Hope", ... }` and lang/pl.json:575-579
  `"{n} przejście kupione za Hope"`. The comment above it reads "What Hope has already bought".
- After a Dash (a roll paid with an action, no Hope) or a Facilities room action, the sheet reads "2 crossings bought
  with Hope". The fix made Move's words name the three sources; this line still names one.
- Confidence: confirmed (source). Severity: wrong for players (text). Headless: yes - R-test: Dash grant, then the
  budget line's text in EN and PL has no "Hope"/"za Hope".

#### A113-C4-3 - the stash owner's notice is wired to the paid crossing only

- Fix: feba55c3 "the owner hears of a rifle on walking in" (1.2.112). `tellStashDisturbed` is called from traps.mjs
  `onCrossed` (traps.mjs:947-950), which is reached only by the `drpgRoomCrossed` hook (traps.mjs:806-808, :874).
- That hook is fired in one place, movement.mjs:3321, at the end of `chargeForCrossing`. `chargeRoute` returns before it
  on three roads by which an owner still walks into a room:
  - crossing fees off: movement.mjs:2772-2775 `if (!game.settings.get(MODULE_ID, SETTINGS.chargeMovement)) { ...; return true; }`
  - any Eclipse crossing: movement.mjs:2737-2759 (`if (isEclipse()) { ... return true; }`, judged by eclipse.mjs, no hook)
  - a GM's or the system's placement (trial exit, season reset `placeCast`, a GM drag) - no crossing is charged at all.
- What the fix made the first instance do: notes v1.2.112 "you are told 'somebody has been in your stash' the next time
  you enter that room - once". With "Crossing rooms costs a Move" off, the owner is never told (the mark waits in the
  GMs' rifle store indefinitely); in an Eclipse, the notice slips to the next paid crossing into that room, which may be
  days later. The traps' "enters" trigger shares the same hook and the same gap, but that predates 1.2.112; the new
  notice copied the narrower road.
- Not deliberate as far as read: the onCrossed comment says "This is where a player's crossing reaches the primary
  GM", naming no exclusion for fees-off or Eclipse.
- Confidence: read (each early return seen; not run). Severity: wrong for players (a notice the rule promises never
  arrives). Headless: yes - scenario 40/70 style: set `chargeMovement` false, rifle while the owner is away, owner
  crosses into the room, expect one notice; same inside an Eclipse.

#### A113-C4-4 - (suspected) the generic Daggerheart Hope glyph is still the star under the glass

- Fix: 1b1daa92 gaps-111 (d) "under the glass the sheet's and the strip's Hope and Action marks are batch 5's diamond
  and dot (R4932)": every `--drpg-pix-star` / `-star-outline` for Hope in stained-glass.css's sheet and strip rules
  became `--drpg-pix-diamond` / `-diamond-empty`.
- Sibling left: styles/stained-glass.css:3876-3894, the catch-all `body.drpg-theme-stained-glass [class*="drpg-"] i.fa-diamond,
  ... .fa-diamond:is(i, span) { ... mask: var(--drpg-pix-star) ... }` under the header "HOPE IS A STAR, NOT A DIAMOND,
  AND NOT A DOT". It masks Daggerheart's own Hope `fa-diamond` wherever it is shown inside a module container. The
  module's scripts write no `fa-diamond` (grep: none), so the reach is Daggerheart-rendered Hope inside a drpg- class
  host other than the sheet's pip (which hides its `<i>`). Which windows that is was not measured.
- At minimum the header comment now contradicts the owner's batch-5 decision the fix applied; at most a second Hope
  glyph (star) stands beside the sheet's diamond somewhere.
- Confidence: suspected. Severity: cosmetic. Needs the table or the glass harness. LIVE draft:
  "LIVE-A113-C4-4: Stained Glass, any window or HUD a module draws that shows Daggerheart's own Hope pips (Party sheet,
  token HUD, a chat card); expect batch 5's diamond, as on the sheet; record the window and the glyph seen."

#### A113-C4-5 - (low) Relief's in-game description does not say Breath is refused

- Fix: 4ef5cceb "Relief's rest refuses Breath": picker greys it (rest.mjs `BREATH_REFUSED`), `applyRest` refuses it,
  the GMs' audit allows 0 Hope (sheet-audit.mjs:1806), and the player handbook row was rewritten
  (player-handbook.en.md:452 "Breath is greyed in it: it would give back less Hope than Relief costs").
- Sibling not touched: the Call's own text players read in the Hope Calls panel, scripts/config.mjs:2489-2491
  `effect: "Take a Short Rest right now, in any room, without spending an action. ..."` - silent on Breath; and the
  comment above it (config.mjs:2481 "a Call for five Hope") and call-effects.mjs:1186-1187 ("the five Hope come back")
  name a price of 5 where `cost: 4` (config.mjs:2474). The config comment's "the benefits themselves are `applyRest`'s,
  unchanged" is no longer true either.
- Confidence: confirmed (source). Severity: cosmetic (the picker tells the reason at the moment it matters; the
  comments mislead the next reader). Headless: the `prose`/text lint could hold the effect line if the owner wants it.

### Fixes checked whose siblings were covered

- 325b5500 death fade `setRest` removes only present classes: the other body-class writes in death-fade.mjs are
  `classList.toggle(x, force)` (no write when already in state) or run only during a played fade; transitions.mjs
  166/186 and glass.mjs:3569 run on an escape, a body announcement or teardown, not on a settle every page hears.
- 77d05edd `watchesForTheDead` by ownership: every voice.mjs reader (869, 1291-1292, 1388, 1574) goes through the one
  function; user-match.mjs and gm-students.mjs read `isDeadWatcher` (flag or GM row), not a connection.
- 6079d181 / b67ceef7 `trialCut: true` on the tests' edge clocks: every tier-1 call of `playTrialEntry` /
  `playTrialExit` now carries it or builds its clock with a helper that does (53653-53761, 53988-54006); R4934's
  `lateSequence` reads only the key. Production roads that play (clock.mjs:79 setPhase, trial-floor-ui.mjs:195, :673
  closeTrial, chapter end through closeTrial) all pass `trialCut: true`; season-wipe's crossing is a reset and plays
  nothing by design. Note only: `lateSequence` picks a trial entry whatever its mark and `catchUpSequences` counts
  `sequence.late` before `playTrialEntry` declines it - a counter, not a finding.
- cb78cfd7 sequences' played record put back: tier 2 calls no sequence player directly (0 matches).
- cff8fd1b R3465/R4100/R4106 follow the phase: `moveDragSaid` is asked by both drag-word sites (player-status.mjs:529,
  sheet.mjs `stillMoveTile` via `locked`); ACTIONS.move.instruction is read only by the briefing, which Move no longer opens.
- feba55c3 Search reaches no stash: no remaining caller of a stash draw from Search; `searchStashStands` is Find
  Stash's Reroll (reroll.mjs:1781); en/pl texts and the handbooks' Search rows say "from the room alone".
- 4ef5cceb Secure a Trace `alwaysReinforced`: one reader (murder-rules.mjs `applyRemnant`); EN and PL hint/short both
  rewritten. Relief: `freeRest` is set on Relief alone, `takeRest(..., {free:true})` has one caller.
- 8834a9b9 Dash bands 2/3/4: both computations (bridge-runs-acts.mjs `handleDash`, infiltrate-reroll.mjs) read
  `INFILTRATE.dash`; no text in lang or the handbooks still states 1/2/3.
- 5b1dd075 notSpectator on the eight new rows: R3865 holds all four tables.
- a0611351 drawn Loaded Die fills faces first: `loadedDieHeld` has two callers, both now after `fillRollFacts`; the
  drawn record reads the evaluated roll's getters.
- 28036bb7 Monocub's murder-room refusal in neutral words: the only `sealedBlocked` use left is a real Seal
  (movement.mjs:2039).
- 8a6d9bd8 fresh-scene bonus by the roller's knowledge: both callers (cleanup.mjs `cleanupDc`, action-briefing.mjs:340)
  pass `actor`.
- 18ee339 (1.2.111) a room action's whole price under Toll: Toll raises room actions only (overflow.mjs
  `facilityTollFor`).

## C5 evidence

Read-only audit at ceb9e9c8, 13.11.2026. Nothing run: no harness, npm or browser. Every line below is **read** in the
files named (file:line at ceb9e9c8) unless marked otherwise. Excluded as already being fixed: Scrum Debate's
conferring rooms, sheet sideways scroll, Facilities tile vs window, open tab on sheet only, three things after a
death, owed Despair, day boards' timing, HUD mode keys, tray title, Hope, GM panel.

Stages in range (tools/stages.json:67-87): E95, E68 (1.2.104); E48, E49, E63 (1.2.105); E76 (1.2.106); E97, E98
(1.2.107); E73, E99 (1.2.108); E61, E62, E92, E94 (1.2.109); E64, E72, E91 (1.2.110); E93, E69, E74 (1.2.111); E108
(1.2.112), with the 1.2.112 merges of E100, E101b, E102-E107, E39, E40, E43, DH212b, gaps-111 and the owner's 13.11 rule
fixes (8834a9b9, 4ef5cceb, 73b6c5ba, feba55c3).

### Findings

#### A113-C5-1 - a picked bedroom lock warns its owner at once, not at their next entry (DA30)

- Decision: the owner's audit entry DA30, as E74 records it - "The owner's warning at the next entry, from
  `crossingSettled` (DA30)" (docs/dev/e74/STATUS.md:42). The plan's DA rows are the owner's (scripts/config.mjs:2170).
- Code: scripts/doors-gm.mjs:32-33 "The owner of a bedroom is warned on an open below `clean` (18) and on a miss with
  Despair (DA30)"; :209 `whisperToOwnerOnly(game.actors.get(owner), ... "DRPG.Infiltrate.pick.warned" ...)` inside
  the pick's run, wherever the owner stands. Force the Door likewise (:24-27, "wherever they are").
- Differs: the warning's timing. Recorded only as a gap (docs/dev/e74/STATUS.md:42; .github/release-notes/v1.2.111.md:592
  "sent at once, wherever the owner is, not at their next entry"); no owner agreement to the change is written anywhere
  read. The road the decision needs exists since 1.2.112: stash-reach.mjs `tellStashDisturbed`, called from traps.mjs
  :945-949 on the owner's crossing, does exactly this for a rifled stash.
- Confidence: confirmed (code and the stage's own STATUS agree). Severity: wrong for players - the owner learns of the
  pick the moment it happens and from any room, so the warning also times the intruder.
- Headless: yes - a tier-2 test can pick a lock while the owner stands elsewhere and assert no whisper until the owner's
  settled crossing into the room (the shape of feba55c3's stash-notice test).

#### A113-C5-2 - E69 shipped without the eavesdrop on LiveKit, Echoes and the murder's privacy

- Decision: E69 is the owner's audit entry E69 (scripts/config.mjs:2170 "the owner's audit entry E69, DA8, ..."); its
  plan's C6 (eavesdrop on LiveKit) and C7 (Echoes) had their glyphs drawn and approved by the owner: tools/glyphs.json:11127
  `echoes` "approved by the owner 11.11.2026" ("Echoes: najbliższy pokój z żywym uczniem"); scripts/tests-glyphs.mjs:496,
  :498 (rows "Echoes", "Eavesdropper marker in GM voice panel", stage E69).
- Code: no reader of `echoes`, `listening` or any eavesdrop road in scripts/, styles/ or lang/ (grep: only
  tests-glyphs.mjs). docs/dev/e69/STATUS.md:18 "Not in this round of E69: C6 ..., C7 (Echoes), C8 (murder privacy ...)";
  .github/release-notes/v1.2.111.md:583 "Not in this release (E69's own list)".
- Differs: decided features absent at the stage's release. Unlike the Final-Trial and floor deferrals, no owner word
  agreeing to leave them out is recorded (STATUS: "the coordinator's next word"; C8 alone cites a default, Q-E69-4).
- Confidence: read (absence by grep; the owner's agreement looked for and not found, which does not prove there was none).
  Severity: wrong for players (two Infiltrate abilities missing). Headless: the absence, yes (a census that every E69
  glyph row has a reader once its stage ships); whether the owner agreed is a question, not a test.

#### A113-C5-3 - a Spectator does not get a secret project's words; the owner said it sees every project, secret ones too

- Decision: Q-E92-6 on DRPG-D1, 12.11.2026: "Widzi wszystkie projekty w tym prywatne" (docs/dev/e92/STATUS.md:152),
  first built with the words (16ab04b, `tellDescription` to Spectators), and still summarised as "changed by the owner
  (DRPG-D1): ... every project, secret ones included, in every room" (:231).
- Code: scripts/projects.mjs:252 "Not to a Spectator (E92, the coordinator's 12.11: 'secret projects stay secret (GMs'
  half untouched)'): it sees the name and progress." The source is "The coordinator's follow-up (12.11, written before
  the DRPG-D1 report reached it)" (docs/dev/e92/STATUS.md:176, :181-183).
- Differs: a later instruction written without the owner's answer in hand narrowed the owner's answer; no owner word on
  the narrowing is recorded. Name and progress are shown (projects-secrecy.mjs:251-252), the description is not.
- Confidence: read; the owner's "wszystkie projekty" may or may not have meant the words - suspected as to intent,
  confirmed as to the order of the two decisions. Severity: wrong for players (Spectators). Headless: yes (scenario 93
  "projects" already reads p3's words; it now asserts none).

#### A113-C5-4 - the school's mood counts a Monocub's sheet Hope only, not its purse

- Decision: the owner, 12.11.2026 (docs/dev/e94/STATUS.md:43-45): the mood from "cale hope uczniow vs hope monocubow +
  despair monokumow + despair overflow". E72 (the same train's next release, 1.2.110) made a Monocub's Hope its sheet's
  plus its purse: scripts/monocub.mjs:759-761 `cubHopeTotal = resourceValue(actor, "hope") + purseOf(actor)`.
- Code: scripts/sequence.mjs:754 `hopeOf = a => ... a?.system?.resources?.hope?.value`, :758 `monocubHope += hopeOf(a)`.
  docs/dev/e94/STATUS.md:59 "Monocubs: the sheet's Hope; E72's purse is not on this branch" - not revisited after
  E72's merge.
- Differs: Hope a Monocub holds in its purse (Bribes, DC37) is left out of the dark side, so the word reads calmer than
  the owner's formula.
- Confidence: read (both functions read; the purse holds Hope off the sheet: E72 a32bf95, known leak foundry-cub-purse).
  Severity: wrong for players (the mood word), small. Headless: yes - a tier-2 test with a purse of N and sheet 0 should
  move `moodBand` as the same N on the sheet does.

#### A113-C5-5 - E91 shipped although the owner's DRPG-D1 choice was to revert it (suspected)

- Decision: docs/dev/e72/STATUS.md:62-66, under "The owner's decisions of 12.11 (DRPG-D1, relayed by the coordinator),
  built": "b1a7b40 | E91 reverted (choice (b))".
- Code/ledger: docs/dev/e72/STATUS.md:131-133 "RESTORED: E91 rides with E72 (the coordinator's call, 12.11 ...) The
  coordinator's later message (12.11, 12:49 ...) replaced the revert"; tools/stages.json:83 E91 shipped 1.2.110;
  .github/release-notes/v1.2.110.md:145-146 "restored (9b88ddf4) when the coordinator put it with E72".
- Differs: the record names an owner choice and then a coordinator's reversal of it, with no owner word on the reversal.
  It may be that the 12:49 message carried the owner's later word; the files do not say so.
- Confidence: suspected. Severity: none at a table by itself (E91's own items - D038's lair lock and seal, co-owners,
  D068's stamp migration - are what ships); a governance question for the owner. Headless: no; a question.

#### A113-C5-6 - LIVE-E94-02 still expects the rule the owner overturned

- Decision: Q-E94-4 answered by the owner 13.11.2026, "Przez 10 minut" (docs/dev/e94/STATUS.md:95-97): within 10
  minutes a late browser plays the start-of-day board once. Built: scripts/sequence.mjs:88 `LATE_PLAY_MS = 10 * 60 *
  1000`, `catchUpSequences` (R4934, scenario 96).
- Record: audit/AUDIT-1.2.42.md:1351 LIVE-E94-02 "gracz, który wczyta się po początku dnia, nie dostaje planszy początku
  dnia".
- Differs: the table check's expectation is the old default; a tester following it records the owner's rule as a failure.
- Confidence: confirmed. Severity: wrong for GM (the gate's live list). Headless: n/a. LIVE row, rewritten:
  - click: as a player, reload 2-3 min after the Night-to-Morning advance; then again 11 min after a second advance;
  - expect: the start-of-day board plays once at the first reload and not at a second reload; nothing past 10 min; the
    end-of-day board never late;
  - record: the two reload times, board yes/no each time, both themes.

#### A113-C5-7 - Take from the Body keeps the sheet list; the owner asked every action on the two-column layout, nothing moved on

- Decision: E68, 10.11.2026: "Q4 ... zastosowac to do wszystkich akcji" and "Nie przenos nic na kolejne wydanie"
  (.github/release-notes/v1.2.104.md:231-232, :244); round M "the two-column layout for every action window".
- Code: anonymity.mjs:299-389 `takeFromBody` from the sheet's Inventory pane; .github/release-notes/v1.2.104.md:256
  "Take from the Body is still the body's list ... not a window on the new layout". No later release note retires it
  (grep of v1.2.105-112).
- Differs: one decided surface left as before, recorded only as a gap.
- Confidence: suspected - Take costs no action (E68 C10), so whether the owner's "akcje" covers it is a reading.
  Severity: cosmetic / wrong for players (the loot flow looks unlike every other). Headless: the window's existence yes;
  its look needs shots.

#### A113-C5-8 - plan parts left out without a recorded owner agreement (suspected, low)

- E62 C6 "the interface following a recut per frame ... not started (below, 1.2.109)" (docs/dev/e62/STATUS.md:87); the
  owner's 1.2.103 report ("textures and effects still change while the curtain animates") is not reproduced and stays
  LIVE-E62-01's (:80-82). C7 is explicitly waiting on the owner and is not counted here.
- E99 Q-E99-6/-7/-9: the case summary's animated board was left to E61 ("the animated board is E61's", docs/dev/e99/
  STATUS.md:352, :355 "there is no board to replay (E61)"); E61 (1.2.109) built no such board (no board in
  scripts/case-summary.mjs or sequence.mjs read; docs/dev/e61/STATUS.md names none). The Sound slot "Case summary" plays
  with the chat card instead (R3916).
- Confidence: suspected (the plans are on the planner branch plan-130, not in this checkout; an owner word may exist there).
  Severity: wrong for players (missing presentation). Headless: no; a question for the owner.

#### Informational (no table effect)

- E39 and E40: "the owner moved E39 out of the plan on 25.10" and "As with E39, the owner moved E40 out of the plan"
  (docs/dev/e39/STATUS.md:8-11, docs/dev/e40/STATUS.md:10-11); the 1.2.112 tree merged both (f26044e8: scenarios 70 and
  99, tier-2 tests, no file under scripts/ but tests-*.mjs). Tests only, so no wrong behaviour; it adds CI time against
  a standing owner word. Default "owner to confirm" (Q-E39-1, Q-E40-1).

### Decisions checked and matching (read in the code)

- Dash 2/3/4 free crossings, a miss 0 (8834a9b9): config.mjs:2189-2191.
- Secure a Trace Reinforced on every hit (4ef5cceb): config.mjs:3891 `alwaysReinforced`, murder-rules.mjs:2457.
- Relief's rest refuses Breath; Relief 4 Hope: rest.mjs:390, :467, :506; config.mjs:2474.
- Stashes: no Search reach, Find Stash 16+ then the free rifle, owner told on walking in (feba55c3):
  action-search.mjs:54-60, :577; stash-reach.mjs:599, :700; traps.mjs:945-949.
- Tamper 1 action, no Sanity, no cap (Q-E64-3, -12): config text fixed in 73b6c5ba; cleanup.mjs:2012 `tamperPriceSkip`.
- E64 numbers: sabotage repair 2 (config.mjs:1926), no Night disadvantage on the trap (:3727), Palm Hand 12 (:1803),
  DA39 Level Up options and trait raises (:3396-3419), Monocub first tier 11 (:3514).
- E72: Redeem free (config.mjs:3537-3549), Confusion caps 1 per time of day / 2 per day (DC32 = 2), a move to order 1
  action no Hope; Talent as one tile; the Final Trial settles bets.
- E74: barricade rules, Keep Watch Body 12 and hindrance at 18 or a critical (config.mjs:2204, watch-gm.mjs:46), Pick
  15/18/16, Force 18, the pick's pass (DA9, "Wole zgodnie z planem").
- E69: tail begun outside an Eclipse, cards through every Eclipse ("Tak"); tail Shadow 15 (DA21), no daily limit (DA26).
- E93: GM action closed for all after any use incl. a failure, project action once per person, both leave a trace
  (Q-E93-6 changed by the owner), costsAction default yes, Toll +1, five Overflow states on by default (config.mjs:2657).
- E94: no Hope or Despair on the end board; mood bars 0.6/0.4 (config.mjs:2122); Spectator gets the end board's day and
  mood only (sequence.mjs:774-780).
- E61/E94 late play "Przez 10 minut": sequence.mjs:88.
- E62 C3b defaults ("wszystko sie zgadza"); voice of the silenced dead to the Spectators' room (Q-C3b-5) supersedes
  E72 C8's own room - the later owner word, not a finding.
- E92: chat blocked for a Spectator (Q-E92-4); token alpha 0.3 (visibility.mjs:713, in the owner's 25-30 %).
- E95: no Inventory tab on a Monokuma's sheet (sheet.mjs:155, :240).
- E73 console layout (mockup B; schema with no ticks before a trial), zone timings 45/60/5 s, two-thirds rule, Scrum
  turns clamp(300/turns, 20, 40) (zone-machine.mjs:68, :95, :152).
- E99: OBJECTION and Rebuttal off the node's modes (case-schema.mjs:119), colGap 80 (case-view.mjs:37), planned
  Remnant types (case-schema.mjs:95).
- E100: the reverts of items 2 and 5 at the owner's word; E103: the student's grid order and no Monocub Move tile
  (config.mjs:1940); E107: GM tiles not red, the chip ("Super zmiany akceptuje"); E108: the three-way dice look built
  as the owner asked; gaps-111 (c): the Event panel change reverted at the owner's word.

## C6 evidence

Method: read the source and the handbook only. Nothing was run (no harness, no npm, no browser). Every
finding below is "read" or "suspected" from code. Out of scope, as asked: the Hope gift's owed Despair
and the Despair bar (fix-113i), Hope, the GM panel, and the day boards' timing.

Where to look: settings.mjs SETTINGS keys and gm-stores.mjs rows that hold a future effect (gmDespairOwed,
gmDeferredOffers, gmRifles, gmBounties, gmConfusions, gmTimedEffects, gmTraceDigest, pendingGather,
pendingMurders, the betrayal in the cast), plus grep for owed/pending/queued/deferred/parked/armed/veiled/
"next time of day"/"on walking in" across scripts/ (tests excluded).

---------------------------------------------------------------------------------------------------------

### A113-C6-1 - A room action's "Despair shield" takes a roll's point silently: the GM sees a roll "with Despair", no Despair lands, and nothing says why

- Created: facilities-gm.mjs:172-173 (`giveTimed`), timed-effects.mjs:76-82 (kind `despairShield`, "Nothing
  is written when it is given"). The GM IS told at the moment it is given: the facility card is
  `whisperToOwner` (GMs included) with the line `DRPG.Facility.applied.timed`, and the GM sees the badge
  "Despair shield" on the student's sheet (sheet.mjs:1794, timed-effects.mjs `effectBadges`, GM reads the store).
- Lands: despair-award.mjs:104 -> :124-128 -> timed-effects.mjs:111-120 (`takeDespairShield`).
  ```
  if (await takeDespairShield(actor, message)) return { shielded: true };   // despair-award.mjs:127
  ...
  await writeList(actor.id, ...filter(r => r.id !== row.id));                // the row goes
  if (message?.setFlag) await message.setFlag(MODULE_ID, "despairShielded", true)
  log(`${actor.name}'s protection from Despair stopped a roll's point.`);     // console only
  ```
  The caller ignores the answer (`if (outcome.withFear) await awardRollDespair(actor, 1, { message });`,
  despair-award.mjs:104). `despairShielded` is read only by reroll.mjs:679; no card renderer, whisper or
  notice reads it (grep across scripts/: no other reader).
- What the GM sees now: the roll card says "with Despair" (action-report.mjs:68 tone `despair`), the
  Monokuma's pool does not move, the sheet badge quietly disappears (only if the sheet is open), and the
  only trace is a console log line. A GM who has forgotten the room action from an earlier time of day
  reads a Despair roll that paid nothing - the shape that invites a hand correction of the pool (wrong data
  by the GM's own hand).
- What the GM should see: a GM-only line where the point would have landed - e.g. a whisper to the GMs
  "Despair shield: {name}'s roll with Despair gave no Despair" or a mark on the roll card's GM view. The
  owner's design (docs/dev/e93/STATUS.md row "Timed effects 4") says what the shield does and that the
  roll is marked; it says nothing about the GM being told at landing - this is a gap, not a contradiction.
- Deliberate secrecy? No: the shield was given on a card the GMs read; nothing about it is secret from the GM.
- Confidence: read. Severity: wrong for GM (risk of wrong data if the GM "fixes" the pool).
- Headless: yes. Extend E93-T8 (tier 2, which already throws a Fear roll with the shield): after the roll,
  assert a GM-visible record names the shield (a whisper to the GMs, or a flag the card renders on a GM).
  Today it would be red.

### A113-C6-2 - A Bounty's Despair is owed with no mark anywhere in the GM's Despair view; the GM's own card names only the reward

- Created: monocub.mjs:1806 `D.oweDespair(userId, cost)` -> despair.mjs:628-632 -> `recordOwed` (a row of
  `despairOwedStore`, the same buffer as the Hope gift). Called from calls.mjs:460-461 (the Fuel a Monocub
  tile's "Bounty" choice).
- The GM's view at the moment of the act: the whisper `DRPG.Monocub.bountyPosted` (monocub.mjs:1810,
  `tellBounty` -> `whisperToGms`): "A Bounty: {reward} Hope to the first Monocub whose Confusion hinders
  {name}." - no word of the Despair owed. The pool bar does not move. The Monokuma sheet's Call tiles do
  read `spendableDespair` (sheet.mjs:5203), so a tile may grey out with no visible reason.
- Lands: despair.mjs `settleOwed` (:725 on) at the next time of day - the same unattributed drop as the
  Hope gift.
- Why it is a separate item: fix-113i is described as "Despair for a Hope gift". The Bounty reaches the
  same store through `oweDespair`, not through `convertDespairToHope`/`creditHopeFromDespair`. If the fix
  is made in the bar/settlement (reading `owedOf`), the Bounty is covered; if it is made in the gift's card
  or its road, the Bounty is not. Owner's text: DESPAIR_CALLS.bounty.effect (config.mjs ~2911) and the GM
  handbook's Calls table (gm-handbook.en.md:372) both say "the Despair is owed from now and taken at the
  next time of day" - so the debt is the design; only its invisibility is the finding.
- Confidence: read (for the card and the bar); suspected (overlap with fix-113i - not read, it is not in
  the tree). Severity: wrong for GM.
- Headless: yes. A tier-2 test: post a Bounty, then read what a GM's view of the pool holds (whatever
  fix-113i adds for the gift) - it should count the Bounty's 1 as well.

### A113-C6-3 - A Bounty that lapses unclaimed is told to nobody, while its Despair is still taken

- Lands: clock.mjs:712-713 -> monocub.mjs:1828-1837 (`lapseBounties`):
  ```
  await bountyStore.dropMany(ids);
  tellEveryCub();                                  // the cubs' copies change, no card
  log(`${ids.length} Bounty(-ies) lapsed unclaimed at the turn of the time of day.`);
  ```
  Compare its two siblings: a claim whispers GMs and cubs (`tellBounty("bountyClaimed")`, :1822), and a
  Bribe's lapse whispers its payer, GMs included (`settleBribes`, :1744). The owed row is not dropped at
  the lapse, so the pool still pays at the same turn.
- What the GM sees now: the Bounty line vanishes from the Monocub's sheet panel (sheet.mjs:4843-4850) if
  open; the pool drops by the Bounty's cost at the same turn (A113-C6-2); no card says the Bounty bought
  nothing. Handbook line 372 says "an unclaimed Bounty lapses then", so the rule is known - not the event.
- Should: one GM whisper at the lapse naming the student(s), like the claim's (the Monocubs' copy may
  stay silent if the owner wants; that is a design call for the owner, not this audit).
- Confidence: read. Severity: wrong for GM (cosmetic if the owner prefers the silence; ask).
- Headless: yes (tier 2: post a Bounty, turn the time of day, count GM whispers).

### A113-C6-4 - A stash notice "pending for the owner" has no GM-side marker, and lands with no attribution

- Created: stash-reach.mjs:584 `rifleStore.patch(reach, { unseen: true })` (1.2.112, the owner's decision
  of 13.11.2026). At that moment the GM sees the thief's whisper `DRPG.Vault.stole` ("You take {item} out
  of {who}'s stash.", GMs included through `whisperToOwner`), which does not say the owner will be told
  later, or that the owner watched it (`watched`, :582-583: the same card in both cases).
- Lands: traps.mjs:946-950 -> stash-reach.mjs:599-626 (`tellStashDisturbed`): the GMs get the owner's
  whisper `DRPG.Vault.noticed` ("Something has been moved in your stash ... no idea whose hands ... or
  when"), spoken by the owner, with no word for the GM of which reach(es) it settles.
- What the GM cannot see in between: which stashes hold a pending notice. `game.drpg.inspectVaults()` /
  `openVaultInspector` show contents; nothing reads `rifleStore`'s `unseen` but the two functions above
  (grep). The notice is dropped unsaid when the stash is gone or the owner dead (:617) - also unseen by GM.
- Deliberate secrecy: from the players, yes (handbook gm-handbook.en.md:650 says "never who or when"). From
  the GM, no document asks for it.
- Should (suggestion, owner's call): the GM-only half of the theft card says "{owner} will notice on
  returning" vs "{owner} saw it", and the landing whisper carries a GM-only line naming the reaches.
- Confidence: read. Severity: cosmetic-to-wrong for GM (the GM can reconstruct it from the theft card).
- Headless: yes for the cards (tier 2 already has "a stash gone through while its owner was away is told").

### A113-C6-5 (suspected, adjacent) - "A GM may end one by hand" - no GM control ends a timed effect

- timed-effects.mjs:16 says "A GM may end one by hand (`endTimedEffect`)". `endTimedEffect` is called only
  by `endTimedEffects`/`endEclipseEffects` and by tests (tests-tier2.mjs:94101 etc., scenario
  33-bridge-paths.mjs:1870). It is not in api.mjs and the sheet badge (sheet.mjs:1794) has no action.
  So a GM who gave a +2 Body or a Despair shield by mistake sees it and cannot take it back short of the
  clock's turn (or a hand edit of the statistic, which the store then "takes back" again at the end:
  `KINDS.traitBonus.take` subtracts n from whatever the sheet holds - suspected double take, not run).
- Not strictly C6 (the GM sees it); recorded because the comment claims a GM path the code lacks
  (the repository's working notes: a comment that stops matching the code). Confidence: read (no caller); suspected (the double
  take). Severity: wrong for GM. Headless: yes.

---------------------------------------------------------------------------------------------------------

### A LIVE row, for the one finding a table would show best

LIVE-A113-C6-01 - a Despair shield at a real table (A113-C6-1). Click: as GM, give a student a room
action's "Despair shield" (Room Setup > Facilities, effect "Protection from Despair", until the time of day
ends); have the player throw an action roll until one comes "with Despair". Expect (after a fix): the GM's
chat or notice says the shield stopped the point; the Monokuma's pool unchanged; the badge gone. Record:
what the GM's screen showed at that roll, with and without the student's sheet open, and whether the GM
could tell from the screen alone why no Despair landed. Who: the owner.

---------------------------------------------------------------------------------------------------------

### Deferred or hidden effects checked that the GM does see

- Reinforced Level Up waiting for the class (verdict.mjs:833-848, level-up.mjs:1107-1118): the verdict's
  GM summary carries `DRPG.Vote.blackenedRewarded` ("... waits for the class's next Level Up"); the class's
  batch window says which row carries it (level-up.mjs:1125-1131). No persistent marker between the two
  (Students window does not list it) - noted, not reported: seen at creation and at landing.
- Confusions armed (call-effects.mjs:613-619): on the target's sheet badge stack on a GM (`armedCallsShown`
  reads `confusionStore` there, sheet.mjs:1770). Obstacle/Approval: public Despair Call card + sheet badge.
- A hostile Call armed under a minute before a roll waits for the next roll (roll-draw.mjs:1803-1861): the
  owner's Q3 (a); stays on the sheet badge; documented for GMs (gm-handbook.en.md:374).
- Public Announcement (deferred assembly): world setting `pendingGather`, on the HUD for everyone.
- Sealed rooms, Chained, Silence: world settings, public, end at the turn (call-world.mjs).
- Motive: "Killing game rules" in the GM panel shows time left (gm-handbook.en.md:374).
- Betrayal window (incident-store.mjs:848-893): the GM's after-incident screen carries the button
  (gm-handbook.en.md:855, 859).
- Direct Murder declared in an Eclipse (parked): a card asks the GM to allow it (gm-handbook.en.md:764).
- Deaths nobody has found: Students window state "unfound" (gm-students.mjs:510, 621); the Next line.
- Traces held for the digest (remnants.mjs:695-770): deliberate batching to the GMs; the trace token is on
  the GM's map at once, and a copy as a Truth Bullet is lifted out and whispered at once.
- Room actions' timed effects other than the shield: given on a GM-visible card, shown as sheet badges on a
  GM; their end at the turn is the rule written on the badge ("until the time of day ends"). The
  `ultimateBoost` lands as an armed Call the sheet shows.
- Bribes: offer, accept and lapse all whisper the GMs (monocub.mjs:1703-1708, 1744).
- Observe declarations waiting for the roll: on the primary, with the GM's card (`askObserveByCard`).

Not checked deeply (time): sabotage on a secret project and its sealed repair (projects-secrecy.mjs), the
Monocub's order slot (E72 C17, a player's road), the trial queue, Eclipse crossings from Dash.
