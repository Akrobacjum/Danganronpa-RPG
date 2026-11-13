# REVIEW-102 - a read of E102's tooltips, `origin/claude/e102`

The coordinator's task of 13.11.2026: read adversarially E102 (the tooltips) - every tooltip text against
docs/text-style.md and the owner's rule (a player reads what their action does, a GM reads what matters; short,
natural), Polish/English meaning and not only keys, tooltips that claim a rule the code does not follow, tooltips
that put a GM's fact on a player's screen (D2), and the census and gate (tools/tooltip-census.mjs) passing by measuring
nothing. Read only: nothing pushed to that branch, none of its code changed.

**What was read.** `origin/claude/e102` at c5cf2aff, on main 421f2395 (1.2.109): `git diff 421f2395 c5cf2aff`, 7
commits (prep, C0-C3 and a follow-up, STATUS), 37 files - 74 new keys in each lang file (`DRPG.Tips.Actions.*` 31,
`DRPG.Tips.Trial.*` 43), the census and its part, the kit's `tipAttr`/`tipText`, R4750-R4752, and the tooltips placed
in 24 scripts. The generated JSON (TOOLTIPS.json, KEYS.json, tooltip-census.json) was read only to look keys up and
to test the baseline.

**How.** Two readers - the texts; the census, gate and tests - with the repository's rules and no harness run. The
gate's reader measured in a detached worktree with `npm ci`: `node tools/check.mjs tooltips` as committed is green
("549 control site(s) in 79 file(s), 317 with no tooltip and no hint; baseline 317 ...; self-check 6/6"), and each of
its plants and mutations below was put back after. Each finding was then re-read here: **read** - traced in the
branch's code here and it holds as written; **measured** - the reader ran it in the worktree; **reader's** - not
re-traced. The texts' reader could not run `check.mjs text` (no espree there): the style findings are by reading.

## The findings, most severe first

| # | Sev. | Where (c5cf2aff) | What | Verified here |
| --- | --- | --- | --- | --- |
| C1 | high | tools/tooltip-census.mjs:128, 148 | Controls drawn through a helper are never counted: a local wrapper around `createElement(tag)` (notice-history-app.mjs `element()`, voice-panel.mjs `node()`, voice-tile.mjs and room-tile.mjs `textNode()`), a kit builder under an alias (`slider as kitSlider`), builders not on the list (`chips`, `modeBar`, `slider`), and `<summary>`, `<a data-action>`, `role="button"`. notice-history-app.mjs reads 0 sites; a planted wrapper button, `<a data-action>`, `<summary>` and `role="button"` together stay green, 0 problems. STATUS's "every site E102 fills" and check.mjs's "every control a module script draws" are wider than what it reads | read (the two matchers: a literal `document.createElement("tag")`, the kit names by name alone); the plants measured |
| C2 | medium | tooltip-census.mjs:160-179 | The baseline can grow: `compare` matches today's sites against whatever rows the file holds, and nothing compares the file with main's or asks a row for its `why`. A new bare button plus a hand-added row with no reason: green. One identity is a count per file, function, kind and key, so one site given a tooltip and a new bare one in the same function net to zero. The header's, check.mjs's and PLAN's "only shrinks" holds for stale rows only | read (`compare`); measured |
| C3 | medium | tooltip-census.mjs:42, 101, 128-132, 149 | Help is credited from text around a site, not its own attributes: `title\s*=` with no boundary takes `data-drpg-title=` (and `subtitle=`); a `dom:*` site takes any tooltip in its next 14 lines; a hint is any line 3 above to 2 below; `tooltip: ""` counts; `tipAttr("<a key in no lang file>")` counts (it draws `""`); one `tooltip:` in a `kitTabs([...])` covers every tab | read (the `TIP` regex); the rest measured |
| T1 | medium | lang `DRPG.Tips.Actions.difficultyTooltip`; action-dynamic.mjs:130 | "The number the student's roll has to beat" / „musi przebić" - the roll passes at the number (`roll.total >= dynamicBar(band)`): a GM reads it one off | read |
| T2 | medium | lang `DRPG.Tips.Trial.openTheRemnantTableTooltip`; murder-rules.mjs:4063, 4093 | "Opens the Investigation window with the Remnants this fight left" - both handlers call `openInvestigationDashboard()` with no argument: the whole window | read |
| T3 | medium | lang `DRPG.Tips.Actions.room2Tooltip`; projects-ui.mjs:993, 300; projects.mjs:110, 605 | "Only students standing in this room..." is wrong for "- any room -": then they work anywhere and nobody can sabotage it | reader's |
| T4 | medium | pl `DRPG.Tips.Actions.letThemLookTooltip` (pl 1823) | „Zobaczą wszystko, co miałeś przy sobie" - one asker made plural (X13), and the reader addressed in the masculine (the only „miałeś" in pl.json; N54 took „zapłaciłeś" out for the same reason). Proposed: „Ta osoba zobaczy wszystko, co było przy tobie w chwili prośby" | read (the text) |
| C4 | low | tooltip-census.mjs:182-198 | the self-check plants 3 of 8 kinds; the `tab` branch reads 0 sites in the module; "6/6" counts misses | reader's |
| C5 | low | docs/dev/R-REGISTRY.md; tools/stages.json | R4750-R4752 stamped "Since E64"; E102 is not in stages.json, so its 135 "E102 C4..C6" baseline rows are held to nothing, and the range R4750-R4799 STATUS reserves is not reserved (`--next` prints R4753, which STATUS gives C4) | reader's |
| T5-T16 | low | see the texts' reader below | a killer box both ticks and unticks; "secret by default" where the project window always seals; two tooltips say what is lost, not kept; Rest's Do it leaves out the price; Use takes one of a stack; Tamper's list is the Remnants the character knows; Leave it tells the witnesses too; the zone answer is a majority; four Polish wordings; four tooltips that repeat their label; `data-tooltip` on controls drawn disabled (Foundry's tooltip over a disabled control not tried on v14 - a LIVE item, or `{ title: true }`); Grant all in the posting GM's language | reader's |

**No D2 leak.** No new key has a placeholder, so no name, room, difficulty or secret travels in one. The Trial family's
windows are a GM's (murder-ui.mjs:53, trial.mjs:1499, trial-floor-ui.mjs:391, trial-zones-ui.mjs:179, the
investigation, chapter and Mastermind windows) but four, drawn on the acting player's own screen with nothing hidden
in them: the Objection comment, the Reshape fields, Stage 6's clean-up, Move the body. The kit escapes every tooltip
(`esc`, R4750 round-trips `"<5>`), and no call passes user text today.

**The texts in numbers.** Parity green (0 missing, 0 placeholders dropped), dashes green, the longest tooltip 16
words (the guide's limit 23), no Polish value equal to its English. KEYS.json: Actions 31 and Trial 37 in both lang
files with the same words; Case, Gm and Setup (C4-C6) not built yet, in neither lang file nor any script - as STATUS
says. The CLAUDE.md line matches check.mjs's `PARTS`.

**The tests** (R4750-R4752) keep the contract: kit cuts, `must` before measuring, no negative assertion after a cut, no
`ok(true)`; what R4751/R4752 measure is that each key is named in its function - not which control carries it (STATUS
says so).

Below, each reader's full text, with its plants, failing paths and proposed texts in both languages. The table's ids
map onto theirs: C1-C5 are the gate reader's H1, M1, M2, L1, L2; T1-T4 the texts reader's 1-4, T5-T16 its 5-16.


---

## The census, the gate and the tests

Read at c5cf2aff (`git diff 421f2395 c5cf2aff`). Measured in a detached worktree at c5cf2aff with `npm ci` in audit/harness; each plant or mutation was put back afterwards and the worktree was removed. As committed: `node tools/check.mjs tooltips` printed `549 control site(s) in 79 file(s), 317 with no tooltip and no hint; baseline 317 (182 with a reason, 135 still to give one); self-check 6/6; 0 problem(s)`, green. `registry` was green, next free R4753.

The short answer: the baseline is a snapshot that works as one. Any site the census *sees* that changes state turns the gate red, and if a whole kind goes blind, its rows go stale and that is red too (measured below). The gaps are elsewhere: controls the census never sees, help detectors that give a site credit for its neighbour's help, and a baseline that takes new rows with no question asked.

### H1 - controls built through a helper or an aliased kit import are never counted (high)

`tools/tooltip-census.mjs:148` matches only `document.createElement("<literal tag>")`. `:128` matches kit builders by their own names, and only when no `.` or word character comes before them. The census has no other way to find a control drawn in JS. So it never sees:

- a local wrapper around `createElement(tag)`: `element()` in notice-history-app.mjs:143, `node()` in voice-panel.mjs:69, `textNode()` in voice-tile.mjs:416 and room-tile.mjs:456. Their call sites are not counted: notice-history-app.mjs:198 (search input), :206 (`markRead`), :211 (`showNew` pill), :538 (`openConversation`); voice-panel.mjs:140 (`pttChange`); voice-tile.mjs:1339 (`rowButton`, a glyph-only button), :1373 (`unhide`), :1496 (`muteAll`).
- `createElement(cond ? "button" : "span")` (popup.mjs:490). This one has its tooltip, but it is not counted.
- a kit builder imported under another name: `slider as kitSlider` (voice-tile.mjs:134, used at :1353). Builders missing from the list: `chips(` (notice-history-app.mjs:194) and `modeBar`/`slider`/`frame` (ui-kit.mjs:984, 1137, 1151; the census marks these as needing help inside the kit, but it never counts their callers).
- `<summary>` toggles (6, for example case-map.mjs:267 and projects-ui.mjs:698), `<a data-action>`, and `role="button"` spans. The census has no kind for any of them.

Measured: `census()` reads **0 sites** in notice-history-app.mjs, 2 in voice-panel.mjs and 1 in voice-tile.mjs, and none at the lines above. A planted `export function plantA() { const b = textNode("button", "drpg-plant", "Go"); b.type = "button"; return b; }`, together with a planted `<a data-action><i class="fas fa-trash"></i></a><summary>Go</summary><span role="button">`, in voice-tile.mjs: **green, 0 problems.** STATUS.md says "the per-family tests and the census together hold every site E102 fills", and the check.mjs header says "every control a module script draws". Both claims are wider than what the census reads.

Patch: count a call whose first argument is a literal `"button"|"input"|"select"|"textarea"` for any function whose body does `createElement(<its first parameter>)`. That takes two passes over the AST: collect the wrappers, then their calls. Resolve kit imports through their `import { x as y }` specifiers rather than by name, and add `chips`, `modeBar` and `slider` to the builder list. Add `<summary` and `role="button"` as kinds. Plant a wrapper call, an aliased builder and a `<summary>` in `selfCheck`.

### M1 - the baseline can grow silently, and its rows need no reason (medium)

`compare` (`:168-179`) only matches today's sites against whatever rows the file holds. Nothing compares the file with main's copy, and nothing requires `why`. Measured: a new `<button type="button" data-drpg-plant="row">Go</button>` in voice-tile.mjs is red (1 problem). After appending `{file, unit: "plantRow", kind: "button", key: null, count: 1}` to tools/tooltip-census.json, with no `why`, it is **green, 0 problems** (the summary only moved to "136 still to give one"). No tool writes the file, so nothing makes it "only shrink" except review. The header (`:29`), check.mjs (`tooltips` doc) and PLAN.md:112 all say it only shrinks. That holds for stale rows, not for added ones.

The identity is also a count per `file|unit|kind|key` (`:165`, 75 rows have `key: null`). So in one commit, giving one site a tooltip and adding a bare control of the same kind and key in the same function nets to zero: green.

Patch: in `check()`, read the baseline at the merge base (`git show origin/main:tools/tooltip-census.json`, or a `--base` the CI job passes) and report every identity whose count grew. Reject a row whose `why` does not match `/^(none needed: .{20,}|E\d+ C\d+: .+)$/`.

### M2 - help is credited to a site from its neighbour, an empty string or a key with no words (medium)

What gives a site its help is a regex over text around it, not over the control's own attributes. Each of the following was planted and read as helped (`needs=false`):

- `TIP` (`:42`) is `title\s*=` with no `\b`: `<button type="button" data-drpg-title="k">Go</button>` reads as tipped (also `subtitle=`).
- a `dom:*` site's help is anything in its next 14 lines (`:149`). A `document.createElement("button")` followed by `head.title = "heading"` on a different element reads as tipped.
- a hint is any line from 3 above to 2 below (`:101`), whichever control it belongs to. `<p class="drpg-help">x</p>` above an unrelated `<button>` reads as hinted. `Hint["'\`]` also matches any key ending in Hint, such as a placeholder's key.
- `tooltip: ""` in a footer object reads as tipped (`\btooltip\s*:`).
- `tipAttr("DRPG.Tips.Nope.goTooltip")`, a key that is in neither lang file, reads as tipped. At the table `tipAttr` draws `""` for it (ui-kit.mjs:757-760), so the control has no tooltip. Planted in voice-tile.mjs: `tooltips`, `parity`, `names` and `text` were all green. A `"data-tooltip": tipText(<missing>)` in a builder's `attrs` behaves the same way (it writes `data-tooltip=""`). R4751/R4752 cover only the 68 keys they list.
- one `tooltip:` anywhere in a `kitTabs([...])` call credits the whole call (`:128-132`, one site per call). `kitTabs([{a, tooltip: "x"}, {b}, {c}])` is helped while tabs b and c have none.

Patch: anchor `TIP` on attribute boundaries (`(?:^|[\s"'{,])title\s*=`). Bound a `dom:*` site to statements naming its own variable (`const <v> = document.createElement(...)`, then `<v>.title|<v>.dataset.tooltip|<v>.setAttribute("title"`). Treat `tooltip:\s*(""|''|null|undefined)` as none. In `check()`, collect every `tip(Attr|Text)\(\s*"(DRPG\.[^"]+)"` and require the key in lang/en.json and lang/pl.json. Count `kitTabs`/`kitTabBar` per section object. Tie a hint to the same label or row element when that can be read, and otherwise say in the header that hint credit is by proximity.

### L1 - the self-check plants 3 of 8 kinds, and the `tab` branch reads nothing (low)

`selfCheck` (`:182-198`) plants `<button>`, a footer object, `<input>` and a hidden input. It plants no `select`/`textarea`, no `buttons: [...]`, no kit call, no `createElement` and no `role="tab"`. The baseline covers most of that gap. Measured: with the `createElement` regex made to match nothing, the gate went red with 19 stale `dom:*` rows. The guard only holds for kinds that have rows, though. `tab` has no row and reads **0 sites** in the whole module (the only `role="tab"` markup is ui-kit's own `<button>`, which is skipped), and `kit:iconButton`/`kit:launcher` are forced to `tip: "always"`. If those branches broke, nothing would notice. The count printed as `self-check ${6 - misses.length}/6` counts misses, not passes. Patch: plant one of each kind with an expected `needs`, and print `passed/planted`.

### L2 - the stage's rows are not held to the stage, and the registry says E64 (low)

- 135 baseline rows have `why: "E102 C4..C6: ..."`, which reads as "given its tooltip by that commit". Nothing fails if E102 ships with them still in place. E102 is not in tools/stages.json (measured), so no stage check can see it. Patch: add E102 to stages.json, and in `check()` fail any `E102 C\d` row once `stagesLib.isShipped(E102)`.
- docs/dev/R-REGISTRY.md rows R4750-R4752 say `Since E64`. `registry.mjs --write` without `--stage` takes the first unshipped stage (registry.mjs:155-166), and E102 cannot be named because it is not in stages.json. STATUS.md says R4750-R4799 are E102's, but the registry says `Reserved and unused: none` and `--next` prints R4753, which STATUS.md assigns to C4. A parallel line that takes `--next` collides. Patch: add the range to `RESERVED` in tools/registry.mjs, and add E102 to stages.json and rerun with `--stage E102`.

### The kit's tooltip (ui-kit.mjs:305-312, 744-760)

- Escaping: `tipAttr` escapes with `esc`, and so does `tabNav`'s `data-tooltip`. R4750 round-trips `"<5>` through `innerHTML` and `dataset.tooltip` and would go red on an unescaped quote. Every one of the 68 `tipAttr`/`tipText` call sites passes a literal key and no `data`, so no name, room or user text reaches a tooltip today. `tipText` into `attrs` goes through `attrsMarkup`/`attr`, which escape. No finding. Not measured: whether v14's TooltipManager reads plain `data-tooltip` as HTML. If a later caller formats user text into one, `data-tooltip-text` would be the safer attribute.
- Disabled controls: `tipAttr` defaults to `data-tooltip`, and the kit's own comment (:748) says "Foundry's tooltip over one was not tried on v14". Four tipped controls are drawn disabled in some states: projects-ui.mjs:332 and :1004 (always-secret), trial-scene.mjs:1422 (no hall), trial-zones-ui.mjs:365 (already confirmed). Whether the tooltip shows over them depends on whether the browser sends pointer events to a disabled form control. I could not measure that headless. It belongs as a LIVE item, or these four should take `{ title: true }`.

### The tier tests

- **R4750** (tests-tier1.mjs, first new entry) imports the kit and asserts with `must` that the key has words with `{n}` before it measures. It then compares one `stableJson`: `tipText`'s words, `""` for a missing key from both functions, `data-tooltip` and not `title` by default, `title` with `{title: true}`, and a tab bar with and without a section `tooltip`. It measures what it names. It does not cover `tipText`'s `words !== key` branch with `data` on a missing key (Foundry's `format` returns the key, so that should hold).
- **R4751 / R4752** list 31 and 37 `[key, file, function]` rows. They read each file through `fetch` + `stripComments` and assert with `must` that each is over 500 characters and that the family has exactly 31 or 37 keys in en.json. They cut each function with `fnSource` (a `null` cut tests as `"null"` and fails, so the cut cannot pass by reading nothing), require `tipAttr("<key>"` or `tipText("<key>"` inside it, and require en and pl words of 1-23 words (the guide's maximum, text-style.md:192). These follow the contract (kit cuts, no negative assertion after a cut, non-empty checks first, no `ok(true)`). What they measure is that the key is named in that function. They do not check which control it lands on, or that a second control in the same function carries one. Low, and STATUS.md says as much.
- The edits to old tests widen two regexes with an optional `data-tooltip` (`?:`), drop `DRPG.Tips.` keys from tier-0's label sequence and drop `tooltip` from a dataset comparison. Each widens a match without removing what it held.
- `node tools/check.mjs registry`: green, numbers unique.

### Keys by family (docs/dev/e102/KEYS.json against lang and scripts)

KEYS.json holds 181 keys in 5 families. Actions (31) and Trial (37) are all in en.json and pl.json, with the same words as KEYS.json and each named in scripts. Case (41), Gm (44) and Setup (28) are in neither lang file nor any script, which matches C4-C6 not being built. No lang key under `DRPG.Tips` is missing from KEYS.json. No script names a `DRPG.Tips` key that lang lacks. No pl value equals its en value. No finding.

### CLAUDE.md

The changed line lists `glyphs, tooltips` after `contrast`. That matches `PARTS` in tools/check.mjs:1232 exactly, so it is accurate.

---

## The tooltip texts

Read on `c5cf2aff` (branch `claude/e102`) against `421f2395`. All 74 keys are new (`DRPG.Tips.Actions.*`, 31 keys, lang/en.json:1726-1758 and lang/pl.json:1811-1843; `DRPG.Tips.Trial.*`, 43 keys, en 1759-1799, pl 1844-1884). No existing value was changed. For each key I found where it is drawn and read the code behind it.

**Checked and clean.**
- **D2:** no key has a placeholder. Every Trial-family window except four is behind a `game.user.isGM` guard (murder-ui.mjs:53, trial.mjs:1499, trial-floor-ui.mjs:391, trial-zones-ui.mjs:179, investigation/chapter/Mastermind windows). The four exceptions are the Objection comment, the Reshape fields, the Stage 6 clean-up and Move the body. Those are on the acting player's own screen and carry no hidden fact. I found no leak.
- **Mechanical checks:** parity is green (0 missing, 0 placeholders dropped) and dashes are green.
- **Not run:** `node tools/check.mjs text` is red in the worktree only because espree is not installed ("run `npm ci` in audit/harness first"). So T5's shape detectors were not run over the new keys, and the style findings below are by reading only.
- **Budget:** the longest tooltip is 16 words, so every key is under the 23-word limit.

### Findings

**1. medium - `DRPG.Tips.Actions.difficultyTooltip` says "beat", but the code passes at the number itself**
- Drawn at action-dynamic.mjs:334 (the GM's Dynamic Action window).
- The roll passes at the band's lower number: action-dynamic.mjs:130 `const success = roll.isCritical || roll.total >= dynamicBar(band);`, and bridge-runs-records.mjs:245 also uses `>= ruled.range[0]`.
- "The number the student's roll has to beat" / „musi przebić" both mean "exceed", so a GM reading it is off by one. This is the one control whose tooltip exists to say what its number means (text-style section 3). The option label `DRPG.Action.beat` ("beat {n}") has the same wording, but that label is E71's.
- Proposed: EN "The total the student's roll needs: this number or more" / PL „Wynik, który rzut ucznia musi osiągnąć: ta liczba lub więcej".

**2. medium - `DRPG.Tips.Trial.openTheRemnantTableTooltip` promises a filtered list the code does not open**
- Drawn at murder-rules.mjs:4056 (`afterEscape`) and :4087 (`afterNoBody`).
- Both handlers call `openInvestigationDashboard()` with no arguments (murder-rules.mjs:4063, :4093). That opens the whole Investigation window, not one "with the Remnants this fight left".
- Proposed: EN "Opens the Investigation window, where you place the Remnants this fight left" / PL „Otwiera okno Investigation, w którym rozmieszczasz Remnanty po tej walce".

**3. medium - `DRPG.Tips.Actions.room2Tooltip` is wrong when "any room" is picked**
- Drawn at projects-ui.mjs:993, on the GM's project window.
- The select offers "- any room -" (`roomSelectOptions`, projects-ui.mjs:300). With that option:
  - Work happens anywhere.
  - Sabotage happens nowhere for a student: `standsAtProject` needs a room (projects.mjs:110), and `sabotageTargetsIn` reaches everywhere only for a Monokuma (projects.mjs:605).
- "Only students standing in this room can work on it or sabotage it" is therefore true only for a named room. The player's twin, `roomTooltip`, does say "Any room means anywhere".
- Proposed: EN "Where students work on it and can sabotage it. With any room, they work anywhere and cannot sabotage it" (19 words) / PL „Gdzie uczniowie nad nim pracują i mogą go sabotować. Przy dowolnym pokoju pracują wszędzie, a sabotować go nie mogą".

**4. medium (PL) - `DRPG.Tips.Actions.letThemLookTooltip`: a singular "they" as a Polish plural, and a gendered past**
- lang/pl.json, drawn at frisk.mjs:1086 on the asked player's screen.
- „Zobaczą wszystko, co miałeś przy sobie":
  - „Zobaczą" turns the one asker into several people. That is X13, confirmed in the pilot.
  - „miałeś" speaks to the reader in the masculine. The approved pair N54 removed „zapłaciłeś" for this reason, and this is the only „miałeś" in pl.json.
- The meaning matches the code: the searcher's card carries the snapshot taken at the ask (frisk.mjs:553, `DRPG.Frisk.asAsked`).
- Proposed: PL „Ta osoba zobaczy wszystko, co było przy tobie w chwili prośby" (matches `leaveItTooltip`'s „ta osoba"). EN unchanged.
- Sureness: high on X13, high on the gender pattern.

**5. low - `DRPG.Tips.Trial.killerTooltip` reads as if the killer ticks the box, and leaves out the untick**
- Drawn at murder-ui.mjs:220.
- What the code does: at murder-ui.mjs:295-297 a change of killer sets `form.indirect.checked = armed.has(form.killer.value)`. So it ticks the box and also unticks it.
- What the text says:
  - EN "A killer with a finished trap ticks the trap box by itself": the grammatical subject is the killer.
  - PL „Zabójca z gotową pułapką sam zaznacza pole pułapki" says outright that the killer ticks it.
  - There is no box called "the trap box". Its label is "Indirect murder (a trap) - ...".
- Proposed: EN "Picking a killer ticks Indirect murder when they have a finished trap, and unticks it when not" / PL „Wybór zabójcy zaznacza Morderstwo pośrednie, gdy ma gotową pułapkę, a gdy nie ma - odznacza". If the dash is unwanted: „..., a w przeciwnym razie je odznacza".

**6. low - `DRPG.Tips.Actions.indirectMurderAProjectTooltip`: "secret by default" is not true in the project window**
- Drawn at projects-ui.mjs:330 (the manager) and :997 (the project window).
- In the window every save seals an indirect murder: `secrecyChange(project.id, result.secret || result.murder || alwaysSecret, ...)` at :1147 when editing, and `secret: result.secret || result.murder` at :1206 when creating.
- Only the manager seals it once and then follows the Secret box (`newlyMurder`, :577).
- Proposed: separate words for the window: EN "Makes the project a murder by trap; saved here, it is always secret" / PL „Robi z projektu morderstwo przez pułapkę; zapisany tutaj, zawsze jest tajny". Keep the current key for the manager.

**7. low - `DRPG.Tips.Actions.refuseTooltip` and `nextTooltip` deny a loss (X1, O8)**
- refuseTooltip: action-dynamic.mjs:347 "The student loses nothing." / „Uczeń nic nie traci." The approved pair N28 for this very refusal says what the student keeps („Nie tracisz akcji"). The Dynamic Action costs 1 action (action-dynamic.mjs:24) and a refusal spends nothing (:314).
- nextTooltip: call-pickers.mjs:256 and :491 "Nothing is spent until you confirm in the next window." The fact itself is right (sheet.mjs:5201-5205 pays after `confirmCall`).
- Proposed:
  - refuse: EN "Turns the action down. The student keeps their action." / PL „Odrzuca akcję. Uczeń zachowuje akcję." (as `nothingMatchesRefuseTooltip` already words it).
  - next: EN "You pay only when you confirm in the next window." / PL „Płacisz dopiero po potwierdzeniu w następnym oknie."

**8. low - `DRPG.Tips.Actions.doItTooltip` leaves out the price the button pays (M3)**
- Drawn at rest.mjs:370.
- After this window `takeRest` spends `rules.actionCost` (rest.mjs:273; 1 for Short, 2 for Long, config.mjs:2092-2093) and uses up the rest for the time of day or session (:282). The window body says only "Choose {n}."
- Relief rests are free (`free`), so one fixed text cannot carry the cost.
- Proposed patch: pass `cost` to `choosePicks`. With `cost > 0`, draw a new plural key `DRPG.Tips.Actions.doItCostTooltip` ({n}):
  - EN one "Spends {n} action and gives you the rest benefits you ticked", other "Spends {n} actions and ..."
  - PL one „Wydaje {n} akcję i daje ci zaznaczone korzyści odpoczynku", few „... {n} akcje ...", many/other „... {n} akcji ..."
  - Otherwise keep the current key.

**9. low - `DRPG.Tips.Actions.useItTooltip`: a stack loses one item, not the item**
- Drawn at use-items.mjs:649.
- `consume` (use-items.mjs:782-789) lowers `system.quantity` by one when it is above 1, and otherwise breaks the item ("An opened kit is an empty box. It is still in the bag", :488).
- Proposed: EN "Restores what you picked and uses up one of this item, with no way back" / PL „Przywraca to, co wybrano, i zużywa jedną sztukę przedmiotu, bez możliwości cofnięcia".

**10. low - `DRPG.Tips.Actions.whichRemnantEraseATooltip` leaves out whose Remnants are listed**
- Drawn at action-tamper.mjs:127 and :132.
- The list is `requestCleanableTraces(actor.id, { mine: !stageSix })` filtered to not Reinforced (action-tamper.mjs:236, :245): outside Stage 6, the Remnants this character has found. "Only the Remnants here that are not Reinforced" sounds like every Remnant in the room.
- Proposed: EN "The Remnants here you know of, except Reinforced ones" / PL „Znane ci Remnanty z tego pokoju, oprócz Reinforced".
- This partly repeats `DRPG.Tamper.coverHint` on the row (O3); the alternative is no tooltip here.

**11. low - `DRPG.Tips.Actions.leaveItTooltip`: the room is told too**
- Drawn at frisk.mjs:1122.
- A let-go is told to the target (`DRPG.Frisk.letGo`) and also to the room's witnesses (`DRPG.Frisk.wLetGo`, frisk.mjs:551, :561).
- Proposed: EN "You let it go; they and anyone watching are told" / PL „Odpuszczasz; dowiaduje się o tym ta osoba i każdy, kto patrzy".

**12. low - `DRPG.Tips.Trial.rightAnswerZoneATooltip`: it is a majority, and anything else ends the set**
- Drawn at trial-zones-ui.mjs:153.
- `diveVerdict` (zone-machine.mjs:76-80): "right" when the larger side is the truth. A tie or the wrong side ends the set and shows no truth (zone-machine.mjs:201-204).
- Proposed: EN "The side most of the class must stand on for the next question; anything else ends the set" (17 words) / PL „Strona, po której musi stanąć większość klasy, by przejść dalej; inaczej zestaw się kończy".

**13. low (PL naturalness) - four Polish wordings to smooth**

| Key | Now | Proposed | Sureness |
| --- | --- | --- | --- |
| `schoolTrialHallTooltip` (trial-scene.mjs:1444) | „po końcu Class Trial" | „Scena, na którą stół wraca po zakończeniu Class Trial" | fairly sure |
| `clearTheOverflowTooltip` (overflow.mjs:1185) | „Zeruje rozlany Despair, po pytaniu" | „Najpierw pyta, potem zeruje rozlany Despair" (as `deleteTooltip` builds it) | fairly sure. EN "after asking" is fine; EN "back to 0" writes a digit into prose (M5), though the module's own `Overflow.clearAsk` does too |
| `zoneAZoneBTooltip` (trial-scene.mjs:1422) | „w którym stoi token, by wybrać tę stronę" reads as if the token stands there in order to choose (the EN shares the shape) | EN "The hall region: a token standing in it takes this side in the zone modes" / PL „Region sali: token, który w nim stoi, wybiera tę stronę w trybach stref" | medium |
| `rePointTooltip` (trial.mjs:1523) | „w wybranego ucznia" drops the EN's "instead" | „Kieruje trwające Objection na wybranego ucznia zamiast obecnego" | medium |

**14. low - tooltips that restate their label or their window (X19, O2, O3)**
- `endAndMoveTheTooltip` / `endWithoutAdvancingTooltip` (boundary.mjs:218-219) say the labels "End and move the clock" / "End without advancing" again. They add only "time of day". Keep them, or drop them as "no tooltip needed".
- `dropTheRestTooltip`: its second sentence ("None of them runs later." / „Żaden z nich nie zostanie wykonany później.") repeats "for good" (O2). Proposed: EN "Gives up the unfinished steps for good" / PL „Porzuca na dobre niedokończone kroki".
- `endTheMurderTooltip` (trial-floor-ui.mjs:272) repeats the window's own sentence, `DRPG.Floor.incidentOpen` ("Its Blackened go on the register only when it is closed"). O3 points to no tooltip here.

**15. low (code, not words) - Foundry's tooltip on controls that can be disabled**
- PLAN section 4 and Q-E102-2's default: "title on a footer button and wherever the control can be disabled". Three sites write `data-tooltip` on a control that can be `disabled`:
  - the Secret box, projects-ui.mjs:332 and :1004 (`always.has` / `alwaysSecret`);
  - the Finding's Monokuma confirms, trial-zones-ui.mjs:365 (`f.confirmed`);
  - the zone selects, trial-scene.mjs:1422 (`hall ? "" : " disabled"`).
- A disabled form control may not fire the pointer events Foundry's tooltip listens for. I have not measured this; ui-kit.mjs's own comment says it was not tried on v14.
- Patch: `tipAttr(key, null, { title: true })` at those sites. Separately, `viewerTicks` (projects-ui.mjs:1553) already leaves the tooltip off a locked tick.

**16. low (code) - the Grant all tooltip is fixed in the posting GM's language**
- `cardButton` (roll-draw.mjs:252) writes `tipText(...)` into a whispered chat card's HTML when the primary posts it.
- A second GM with another language reads the primary's words. The card is GMs-only, so nothing leaks. Shown as it stands, or set at render (`onRenderUnwitnessed` already reads these buttons).

### Dropped after checking
These read right against the code:
- the Hope Call approval, Frisk's snapshot, Make the attempt (closing still makes it: action-menus.mjs:497-501);
- Finish / Drop, Body found, Move to Investigation, Autopsy (living students ticked: gm-items.mjs:1349);
- the Mastermind Give and Amount (the Hope now, the pool owes until the next time of day: despair.mjs:784-793);
- Overrule (the price stays: trial-floor.mjs:1379-1390), Findings edit/delete/confirm/save (each a public card: trial-zones.mjs:351-385);
- Scrub / Carry (both roll: cleanup.mjs:2270);
- the trap modifiers (traps.mjs:241-255), Grant all, Up, the Closing Argument buttons, share / revoke (the builder is kept: projects-ui.mjs:1625).
