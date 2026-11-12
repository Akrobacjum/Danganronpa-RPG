# E56 - Hygiene: the plan

Preparation only (the prep-54 work line, 12.11.2026). Read at `origin/main` =
`4dfac3a93ef22144db14121d1fbbde82e4ef0988` (1.2.108). E56 is planned as 1.2.120, after E54 (the file split)
and E55 (CSS), so every site below moves before this stage starts: E54 alone moves about 9000 lines of
sheet.mjs, glass.mjs, chapter.mjs, cleanup.mjs, investigation.mjs, settings.mjs and utils.mjs into new
files. The inventory (`INVENTORY.md`, beside this file) names each site by file and function or name, with
4dfac3a9's line as a help only; `finders/` holds the scripts that found them, to be run again at the base.

## 1. The owner's words (translated)

"Comments that contradict code, orphaned/overlapping JSDoc, names of functions that no longer exist,
numbers and line numbers in comments; dead exports and constants (consumeCall, readiedItem,
vaultRoomOwnedBy, MAX_EXTRA_ROLES, openMonocubDialog and others), duplicate helpers (glassOn, cssColour and
colourOf, double imports) merged, dead i18n keys and dead LIMIT_GROUPS hints, LONGEST_TILE_WORD lazy, lint
without warnings. Done when no comment contradicts code, no dead exports or i18n keys, lint clean."

## 2. What the inventory measured (summary; the evidence is in INVENTORY.md)

| Item | Measured at 4dfac3a9 | Section |
| --- | --- | --- |
| The five named | `consumeCall` and `MAX_EXTRA_ROLES` dead (MAX_EXTRA_ROLES only re-exported by tables.mjs); `readiedItem` and `vaultRoomOwnedBy` read only by tier-2 tests; `openMonocubDialog` is **not dead**: it is `game.drpg.monocubDialog` (api.mjs, tools/api-surface.json), though no button opens it | 1.1 |
| Dead code | 9 names: the two above, `CASE_PROBLEMS`, `unrecordMove`, `gmStoreLegacyChanged`, `confirmLanguageReload`, `noteUpdatedAt`, `zoneLog`, `atOwnVault` | 1.3 |
| Only a test or scenario calls it | 6: `requestTrialKeyword` (has a bridge row, no window asks it: read E73's intent first), `setDiscovery`, `bulletsWithoutAnswer`, `lastMessage`, `unreadCount`, `fillObjection` | 1.3 |
| `export` with no reader outside its file | 201 (+18 behind a facade) | 1.4, 1.5 |
| Read only by tests, not used in its own file | 78, mostly deliberate seams; about 10 look like leftovers (a judgement) | 1.6 |
| Console API only | 63 names: out of scope without the owner | 1.7 |
| `glassOn` | own-ring.mjs has a private copy identical to motion.mjs's; glass.mjs `themeOn` and look.mjs `isStainedGlass` read the setting only, on purpose in places | 2.1 |
| Colour readers | seven helpers; fog-doorways `colourOf` and gm-overlay `overlayColour` call `Color.from` with no NaN check (harmless while the tokens are hex) | 2.2 |
| Imports | 6 files import one module in two statements; 25 imports never read; 129 file/module pairs both static and `import()` | 2.3 |
| Other identical helpers | `esc` x9 local copies, `L = key => game.i18n.localize(key)` x33, `isPlain` x4, and more | 2.4 |
| Dead i18n keys | 27 proven (20 read by nothing, 1 by a test only, 5 `DRPG.Murder.*` already listed dead at 1.2.42, ...); 781 prefix-built keys unproven either way | 3 |
| LIMIT_GROUPS hints | already gone; tier-1 R975 holds that they stay gone. Nothing to do unless the owner means something else | 3.4 |
| `LONGEST_TILE_WORD` | computed at sheet.mjs's import, before `localizeConfig`, so always the English word; no visible effect today ("Contribution" is the longest in both languages) | 4 |
| Comments naming what does not exist | 175 citations of 142 names; 22 sites contradict the code (a renamed or removed function named in the present, or a dead wrapper named as the live road); about 10 need a reading; the rest are Foundry/Daggerheart/browser names or history | 5.1 |
| Line numbers | none of the module's own lines cited in scripts/ comments; **78 in tier-0's census reason strings**, 9 sampled, all 9 now wrong | 5.2 |
| Doubled JSDoc | 63 candidates (two blocks over one declaration, the first left behind by a move) | 5.3 |
| Counts | 16 of 31 counts in code.md's file table are stale | 5.4 |
| Lint | not run (no `audit/harness/node_modules` in this checkout); every configured rule is at error level, so "no warnings" is already true by construction; "no unused names" would need a new `no-unused-vars` rule | 6 |

Spot-checked by hand after the inventory (12.11.2026): `consumeCall`, `MAX_EXTRA_ROLES`, `CASE_PROBLEMS`,
`zoneLog`, `unrecordMove` (grep -rlw over scripts, tools, audit/harness, module.json); `fillObjection` has no
call outside its own JSDoc and a tier-0 string; despair.mjs's comment names `renderOverflowCaption` where
the function is `buildOverflowCaption`; eslint.config.mjs's rules are all "error". The rest is the
inventory's reading.

## 3. The commits

Order: the gates first (so the stage cannot end on a count nobody holds), then the safe text, then code
removals one kind at a time, then the decisions that need the owner. "QUICK" is METHOD.md section 3.

| Id | What | Kind | Proof |
| --- | --- | --- | --- |
| C0 | Re-run `finders/` at the base and refresh INVENTORY.md's lists (E54 and E55 moved the sites). | measurement | The finders' counts in the message; any site that moved is re-pointed by name |
| C1 | A gate for the done line "no comment contradicts code": a `tools/check.mjs` part (`comments`) that runs the citation reading of `finders/comments.mjs` (backticked names in comments of scripts/ that no code, key or stylesheet holds) and the doubled-JSDoc reading, each against a budget file that only falls (as `tools/css-budget.json` does), with planted faults first. An allowlist row for each external name (Foundry, Daggerheart, LiveKit...) with its reason. | gate | Red first on a planted comment naming a gone function; the budget written from the base's count |
| C2 | The 22 contradicting comments (INVENTORY 5.1 A): each rewritten to name what the code does now (`buildOverflowCaption`, `liftIncidentSecrets`, `suiteRolling`, `fillObjectionInStep`, `uncountCrossingInStep`, settings-window.mjs `askReload`, ...). | text | C1's budget lowered; tiers 0-1 (some comments sit in functions a test cuts) |
| C3 | The ~10 probable stale names (5.1 B): read each; rewrite or keep with a reason in C1's allowlist. | text | as C2 |
| C4 | Doubled JSDoc (5.3): each of the 63 read; the left-behind block deleted or moved to the function it documents (settings.mjs `sheetBox`'s block is one: E54's plan R7). | text | C1's JSDoc budget lowered; `node tools/moved-only.mjs`'s jsdoc part is not run (no move) |
| C5 | The 78 line numbers in tier-0's census reason strings: `file.mjs:N` becomes `file.mjs` `functionName`. | test text | Tier 0 green with the same counts; a grep that no census string holds `\.mjs:\d+` (added to the census test itself, so it stays) |
| C6 | Dead code (1.3, 7 names not behind a facade): `consumeCall`, `CASE_PROBLEMS`, `unrecordMove`, `gmStoreLegacyChanged`, `confirmLanguageReload`, `noteUpdatedAt`, `zoneLog`; and the comments that name them (C2 has rewritten those). | removal | Red-first does not apply (nothing behaves differently): the commit quotes the grep that shows no reader; tiers 0-1; `node tools/check.mjs names` |
| C7 | The facade-held dead names (`atOwnVault`, `MAX_EXTRA_ROLES`) and the test-only `readiedItem`, `vaultRoomOwnedBy`: only with the owner's word (Q-E56-1), with the tier-2 assertions rewritten to read what the code uses. | removal | tier-2 `--only` the two tests; tiers 0-1 |
| C8 | The `export` keyword dropped from the 201 names no other file reads (1.5), a file family at a time. | demotion | tiers 0-1; `node tools/check.mjs names`; R290's crawls read functions, not exports (inventory 1.5) |
| C9 | Duplicate helpers, the safe ones: own-ring.mjs imports motion.mjs `glassOn` (R161 first: no cycle); the 6 double imports joined; the 25 unread imports removed; fog-doorways `colourOf` and gm-overlay `overlayColour` get the NaN check `accentColour` already has (or one of them reads the other). | merge | tiers 0-1; R161; scenario 86 once (the counters it holds must not move: no `cssColour` call is added) |
| C10 | Duplicate helpers that change behaviour: routing the fog's colours through utils `cssColour` (body first, counted), glass.mjs `themeOn` into `glassOn`, the 33 local `L` and 9 local `esc`: only with Q-E56-2's answer. | behaviour | per item; scenario 86 for the colour route; glass-sweep for `themeOn` |
| C11 | The 27 dead i18n keys out of en.json and pl.json together (with their `.few`/`.many`), and tier-0's wording row for `DRPG.Floor.startTestimony`. | removal | `node tools/check.mjs parity` and `prose`; tiers 0-1 |
| C12 | `LONGEST_TILE_WORD` lazy: computed on the first `fitTileText` after the language is applied, dropped when a language file is applied later on the same page (scenario 50 does that). R1162's cut anchors move with it. | behaviour | Red first: a planted Polish label longer than its English one, measured by the tile probe - the eager word is the English one. Scenario 50 once |
| C13 | Lint: if Q-E56-3 says "no unused names", add `no-unused-vars` (imports and module-scope names) at error level and clear what it finds beyond C9's 25. | gate | `npm run lint` in audit/harness, its count in the message |
| C14 | code.md's 16 stale counts: dated, or dropped (Q-E56-4: the agent rules directory is closed to work lines). | text | - |

About 15 commits. LIMIT_GROUPS hints: none (R975); the stage's end says so.

## 4. Risks

| Id | Risk | What holds it |
| --- | --- | --- |
| R1 | Tests read many of these names by string: `openMonocubDialog` x3, `LONGEST_TILE_WORD` (R1162), `fillObjection` and `bulletsWithoutAnswer` in census rows, `requestTrialKeyword`, `"if (glassOn())"` (R95), `"themeOn()"` (tier 1 near chrome.mjs). A census row naming a gone function keeps passing while saying something false. | Each removal greps scripts/tests*.mjs for the name in the same commit; C5's census grep. |
| R2 | A facade's re-export removed breaks code.md's "keeps every name it exported". | C7 only with the owner's word. |
| R3 | `game.drpg` names (63, `openMonocubDialog` among them) are the console API; tools/api-surface.json is checked. | Out of scope without the owner. |
| R4 | `requestTrialKeyword` has a bridge row (R1b, R162-R166, scenario 33 read it). Deleting the ask leaves the row; deleting the row is a trust-model change. | Not removed in E56 unless the owner rules (Q-E56-5). |
| R5 | Colour routing changes the element read first (`documentElement` -> `body`: the default -> the phase colour) and the counts scenario 86 holds. | C9 does not route; C10 only with an answer. |
| R6 | Converting a static-plus-`import()` pair can change load order (code.md records a boot failure from a static cycle, E41 C9b). | Not in E56's commits; listed for reading only. |
| R7 | A rewritten comment can be one a check reads (`stamps`, `notes`, `dashes`) or a test cuts. | QUICK on every text commit. |
| R8 | E54 and E55 move most sites first; a list read at 4dfac3a9 is stale at the base. | C0. |
| R9 | 781 prefix-built keys: grep cannot prove them dead. | Not touched; a family is only cleaned when its builder's value set is read by hand (as R164 does for `Bridge.why.*`). |

## 5. Open lines touching the same files (12.11.2026)

E56 touches comments across most of scripts/, so nearly every open line overlaps it; all of them ship
before E56 in tools/stages.json's order. The ones that change a site in the inventory: e72 (gm-stores.mjs,
bridge-asks.mjs, bridge-table.mjs, migrate.mjs, events.mjs, trial-floor-ui.mjs and others: the census rows
and `requestTrialKeyword`'s neighbourhood), e93 (bridge files, movement-adjacent `action-*` files), e92
(fog.mjs, glass.mjs, movement.mjs), e64 (cleanup.mjs, chapter.mjs, investigation.mjs, remnants.mjs,
migrate.mjs), e61-62 (glass.mjs, chapter.mjs, hud.mjs), e97-98 (trial-floor.mjs, case-schema.mjs:
`CASE_PROBLEMS` lives there), e100 and e101 (lang/en.json and pl.json: the dead keys' neighbours),
texts-e71 (lang files). C0 re-reads all of it at the base.

## 6. Effort

About 15 commits. The text commits (C2-C5) are reading work: 22 + 10 + 63 + 78 sites, each read in place.
C1 is the one new tool part (a few hundred lines with its planted faults, after `css-lint.mjs`'s shape).
Removals and merges are small. Each commit runs QUICK (tiers 0-1: 200-244 s). My estimate, not a
measurement: two working sessions, plus a third if Q-E56-2 asks for the behaviour merges.

## 7. Open questions for the owner (each with the default the stage runs on)

| Id | Question | Default |
| --- | --- | --- |
| Q-E56-1 | May a dead name leave a facade (`atOwnVault`, `MAX_EXTRA_ROLES`), and may test-only helpers (`readiedItem`, `vaultRoomOwnedBy`) go with their tier-2 assertions rewritten? | Yes for both, with a line in code.md that a dead name may leave a facade. |
| Q-E56-2 | Merge the helpers that change behaviour (the fog's colours through `cssColour`; glass.mjs `themeOn` into `glassOn`; the local `L`/`esc` copies)? | No: C9's safe merges only, the rest listed as accepted duplicates with their reason. |
| Q-E56-3 | "Lint without warnings": every rule is already an error. Add `no-unused-vars`? | Yes, imports and module-scope names, at error. |
| Q-E56-4 | code.md's 16 stale counts: date them, drop them, or have a check part compute them? | Drop the counts that a check does not hold. Written by whoever may edit the agent rules directory. |
| Q-E56-5 | `requestTrialKeyword` (an ask with a bridge row and no window that calls it) and `openMonocubDialog` (console only): keep? | Keep both; record why. |
| Q-E56-6 | The 78 test-only names (1.6): which are leftovers? | Only the ten named in 1.6 are read; the seams stay. |

### The owner's answers

The owner accepted every default of the table above (through the coordinator, 12.11.2026; the review page of the same day):

- Q-E56-1: owner: default, 12.11.2026
- Q-E56-2: owner: default, 12.11.2026
- Q-E56-3: owner: default, 12.11.2026
- Q-E56-4: owner: default, 12.11.2026
- Q-E56-5: owner: default, 12.11.2026
- Q-E56-6: owner: default, 12.11.2026

## 8. Foundations built on 12.11.2026 (tools/ only, on the prep-54 line)

| Item | State | Commit |
| --- | --- | --- |
| C1 | **Built:** `tools/comments-lint.mjs`, `tools/comment-budget.json` and the part `node tools/check.mjs comments` (needs espree, as `names`, `moves` and `text` do). Counts per module file of scripts/: backticked names in comments that no code, language key or stylesheet holds (175 at 4dfac3a9), and doubled JSDoc blocks (63); a `known` list for names read and kept with their reason. The ratchet is css-lint's: red above a row and red below it until `--write` lowers it. Red first on a copy: a planted comment and a planted pair each read as their file's count above its budget; two broken readers turned the self-check red. About 3 s. | 0271bfb2 (header wording in 0a5922ab) |

**What it does to the open lines (measured 12.11.2026).** Each line's tree merged with this branch
(`git merge-tree`, no conflict in any of the twelve refs asked) and the lint run on the merged tree: 6 lines read 0
problems (e101, e97-98, gaps-108, texts-e71, dh-212, perf-open) and 5 would turn the part red once both are on
main:

| Line | What it adds (file: name or block) |
| --- | --- |
| fervent-sagan-gme4vt | roll-draw.mjs: `applyBaseBonus` cited twice; sheet-audit.mjs falls from 13 to 11 (below its row: red until lowered) |
| e72 | call-pickers.mjs `callChoice`; voice-client.mjs `DEAD_ROOM`; a doubled JSDoc in monocub.mjs, murder-rules.mjs and verdict.mjs |
| e93 | config.mjs `TIMED_UNTIL`; crossing-settle.mjs `crossingSettled`; facilities.mjs `projectAction`; a doubled JSDoc in bridge-asks.mjs |
| e64 | a doubled JSDoc in config.mjs |
| e100 | action-rolls.mjs `NEEDS_OWN_BRIEFING` (a comment naming what that line removed) |

Some of these are the defects the gate exists for (a comment naming a constant its own line removed); some may be
names read and kept. The landing order is the coordinator's. `--write` never raises a row (a file new to the
budget gets one at its count), so a line that ADDS a finding cannot clear it with `--write`: it rewrites the comment
or names the name in `known` with the reason. Either the part lands after those lines, with its budget written
once at that base (the rows emptied and `--write` run: a reading of the base, read before it is committed), or each
of the five lines does one of those in its own merge; fervent-sagan's sheet-audit.mjs, which falls below its row,
is cleared by `--write`.

