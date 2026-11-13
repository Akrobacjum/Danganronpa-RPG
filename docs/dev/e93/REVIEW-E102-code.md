# REVIEW-E102-code: a code read of origin/claude/e102 at 7f42e72b

Read on 13.11.2026 by the E93 line, against the merge base with main, 421f2395 (1.2.110). This is the code read the
coordinator asked for: the tooltip wiring, the census and its baseline, and R4750-R4763. The texts were read at
c5cf2aff (REVIEW-102.md) and are not read again here. Line numbers are 7f42e72b's.

How it was read:
- the diff of 65 files;
- `tools/tooltip-census.mjs` run in a worktree at 7f42e72b (577 sites, 277 needing help, baseline 277, self-check 26/26);
- each `tipAttr` / `tipText` call listed with its English words (142 uses);
- two mutants run, one on R4751 and one on the gate (C1).

## Findings, most severe first

| # | Severity | Where | What |
| --- | --- | --- | --- |
| C1 | medium | tools/tooltip-census.mjs:135-139, :276; scripts/tests-tier1.mjs:25099-25331, 25359 | A control can lose its tooltip while both the census and the family tests stay green (measured) |
| C2 | medium | tools/tooltip-census.mjs:363-368, :394; .github/workflows/ci.yml:108, 141, 165, 198 | The "no more rows than main's copy" guard never runs in CI |
| C3 | low-medium | tools/tooltip-census.json, 24 rows | "none needed" also covers help the census cannot see, so losing that help stays green |
| C4 | low | tools/tooltip-census.mjs:375-377; tools/stages.json:101 | The 60 "E102 C6" rows turn red at E102's release unless C6 lands first |
| C5 | low | scripts/room-tile.mjs:334, voice-tile.mjs:1356, voice-panel.mjs:144, popup.mjs:931 | `dataset.tooltip = tipText(...)` writes an empty `data-tooltip` when the words are missing |
| C6 | low | scripts/room-tile.mjs:28 and :334; voice-tile.mjs:1356 | Inconsistent with the tile files' `data-tooltip-text` rule, and room-tile's header no longer matches its code |
| C7 | low | scripts/tests-tier1.mjs:25332 (R4760) | Says four disabled controls carry a `title`; measures three regexes, one of which passes on either of two sites |
| C8 | low | scripts/tests-tier1.mjs:25401 (R4763) | Draws only the `record: false` card; the `record: true` half is a source regex |
| C9 | low | tools/tooltip-census.mjs:64, :204 | A builder that ignores a `tooltip:` / `title:` option is still credited with one (none today) |
| C10 | note | tools/check.mjs:212 | Says 25 planted sites; the self-check plants and reads 26 |

### C1 - a tooltip can be lost with every check green (measured)

**The mutant.** At action-dynamic.mjs:336 (`askDynamicDifficulty`), the difficulty `<select>` was changed:

- from `<select name="tier"${tipAttr("DRPG.Tips.Actions.difficultyTooltip")}>`
- to `<select name="tier"${tipAttr("DRPG.Tips.Actions.difficultyTooltip") ? "" : ""}>`

**What it does.** The key is still read, but the select draws no tooltip.

**What stayed green:**
- `run-tests.mjs --tier 1 --only R4751`: 2 passed, 0 failed.
- `node tools/check.mjs tooltips`: all green, 277 needing help, as before. The census read the site as `select conditional needs=false`.

**Why the census misses it.** `tipOf` (census :135-139) calls a site "conditional" when its only tip is inside `${... ? ... : ""}`. Line :276 then counts "conditional" as help, as it does "always". A tooltip that shows only under a condition is correct in places, for example trial-floor-ui.mjs:926 and trial-scene.mjs:1446, the only two conditional sites today. But nothing checks that the condition can ever hold.

**Why the family tests miss it.** R4751-R4754 and R4761 test only that the function's source names the key: `(?:tip(?:Attr|Text)|plural)\("<key>"` inside `fnSource(file, unit)`. That is weaker than their titles ("the function that draws its control writes it"):
- the key can be named in that function and land on another control, or on none;
- `plural(` also counts, though a `plural()` text can be a label as easily as a tooltip.

**What renders the DOM.** Only R4750 (the kit's helpers) and R4763 (one popup) look at rendered DOM.

**Suggestion:**
- Give each family one drawn check per window, drawing it and reading `[data-tooltip]` / `[title]` on the named control, as R4763 does for the popup.
- Or narrow the regexes to the tag the key belongs to.
- And count "conditional" as help only in a short listed set of sites.

### C2 - the main-copy guard is off in CI

`mainBaseline` (census :363-368) reads `git show origin/main:tools/tooltip-census.json`. On failure, `check` (:394) holds the rows alone and logs "main's copy not read".

ci.yml's jobs check out with `actions/checkout@v4` and no `fetch-depth` or fetch of main (:108, 141, 165, 198). So `origin/main` is not there in CI, and the guard the header describes at :47-50 ("a row added by hand is red there") never runs in CI.

**Today.** The file is not on main yet, so the guard is off everywhere. After the merge it would hold only on machines that have fetched main.

**What a hand-added row does now.** It is red only on such a machine, not in CI.

**Suggestion:**
- Make the CI job that runs `check` fetch main (`fetch-depth: 0`, or `git fetch origin main --depth=1`).
- Or have the part fail rather than pass in CI (`CI=true`) when main's copy cannot be read.
- Note: changing `.github/` is the owner's call.

### C3 - "none needed" also covers help the census cannot see

24 of the 217 "none needed" rows give as their reason that the control already has help the census misses. Examples:
- hud.mjs `objectionControl`, popup.mjs `cornerButton`, projects-tray.mjs `addCollapseControl`, room-tile.mjs `paintRoomTile`: "already carries a ... tooltip";
- sheet.mjs `addPresentButton`, `callButton`, `actionButton`: "Already has a tooltip built in code";
- voice-tile.mjs `rowButton` / `listRow` / `buildVoiceList`, passages-tab.mjs `chip`: "the helper writes ... which the census cannot follow";
- case-map.mjs `cameraHtml`, tables-editor.mjs `itemPictureGrid`.

These rows are census blind spots, not controls that need no help. If one of those tooltips were removed, the row would still pass, and the gate could not tell.

The rest of the "none needed" reasons read as real judgements (label, placeholder or intro say it). I did not check each against its window.

Two identity facts:
- 68 rows have no key, so their identity is file, unit and kind alone. A unit that is a whole class or a big function makes a wide bucket.
- Only one row has a count above 1.

**Suggestion:** mark these 24 rows "help in code: <where>" and hold each with a small drawn check, or widen the reader. Do not keep them as "none needed".

### C4 - the 60 C6 rows and the release

`shippedRows` (census :375-377) turns a row red once its stage has shipped. E102 is planned for 1.2.133 (stages.json:101).

The 60 rows whose `why` starts "E102 C6:" (STATUS: C6, the Investigation family, R4755) are still in the baseline. So E102 cannot be released until C6 lands, or until those rows are re-reasoned. That is the intended behaviour; I'm recording it so the release does not meet it unexpectedly.

### C5 - an empty `data-tooltip` if the words are missing

`tipAttr` omits the attribute when the words are empty, but the code-made sites write `el.dataset.tooltip = tipText(...)` unconditionally:
- room-tile.mjs:334 (the thumbnail);
- voice-tile.mjs:1356 (the volume slider);
- voice-panel.mjs:144;
- popup.mjs:931;
- anonymity.mjs and messenger-app.mjs (the `pick` and `fill` buttons).

`tipText` returns `""` for a key with no words, which leaves `data-tooltip=""`.

room-tile.mjs:29-30 records that Foundry's tooltip then reads the element's `aria-label` through `cleanHTML` (the E02-D01 hole, R509). The thumbnail's `aria-label` carries the GM's room name (`DRPG.Room.imageOpen`, `{ room }`).

**Is it reachable?** Not today: the gate requires words in en and pl, and Foundry falls back to English. So this is a defensive point, not a live bug.

**Suggestion:** write the tooltip only when `tipText` returns words, as `tipAttr` does, for example with a kit helper `setTip(el, key)`.

### C6 - data-tooltip against the tiles' data-tooltip-text

room-tile.mjs:28 says every tooltip in the file goes through `dataset.tooltipText`. hud.mjs:1488-1491 says the voice tile's Foundry tooltip is `data-tooltip-text`, as its other buttons set it (voice-tile.mjs:1003, 1033, 1129, 1458, 1478).

E102 writes `dataset.tooltip` at room-tile.mjs:334 and voice-tile.mjs:1356. Effects:
- the room-tile header now says something the code does not do;
- the tile files mix the two forms.

I did not try whether the two forms render differently on v14; LIVE-E102-01 is the table check. Either switch these two sites to `tooltipText` or change the header.

### C7 - R4760's "four disabled controls"

The title ends: "the four tipped controls drawn disabled at times carry a `title`". The check, `titled`, reads three sources:
- `projects-ui.mjs` for secretAProjectS;
- `trial-scene.mjs` for zoneAZoneB;
- `trial-zones-ui.mjs` for monokumaConfirms.

The projects regex is one `.test()` over the whole file, but that key has two disabled-at-times sites (:335 and :1007). Either alone passes. Today both carry `{ title: true }`; the test would not see one of them lose it.

sound-panel.mjs:177 (playTooltip, disabled when not playable, `title: true`) is a fifth such site and is not in the list.

### C8 - R4763 draws half its claim

R4763 draws a `record: false` card and checks its close has no `data-tooltip`. The other half, that a recorded card's close does carry it, is a source regex (`guarded`), not a drawn card.

**Suggestion:** draw a second card with `record: true` and read the tooltip's words.

### C9 - options a builder ignores

`TIP` (:64) credits any `tooltip:` or `title:` inside a kit call's text. But `toggle`, `chip`, `stepper`, `roleButton` and `modeBar`'s items take a tooltip only through `attrs` (ui-kit.mjs:883, 900, 802, 90, 985): `modeBar` draws `m.label` and nothing else, and `chips` passes each item to `chip`.

So `modeBar([{ key, label, tooltip }])` or `toggle({ ..., title })` would be credited and draw nothing. I listed every kit site credited with a tip: the one hit, sheet-audit.mjs:2806, keeps it in `attrs` over several lines. So nothing depends on this today.

**Suggestion:** credit a builder only through `attrs` (or `tooltip:` for kitTabs, whose `tabNav` draws it), or plant one such site in the self-check.

### C10 - the count in check.mjs

check.mjs:212 says "its self-check of 25 planted sites". The tool prints `self-check 26/26`. PLANTS (census :325-344) wants 26: d5 is the one added after the text was written.

## What was looked for and not found

- **A tooltip on a player's screen naming a GM-only fact.** I read the 142 uses with their English words and looked hardest at the files a player reaches:
  - action-*, rest, use-items, frisk, call-pickers, sheet;
  - projects-ui, trial, trial-floor-ui, voice-*, room-tile, popup.

  None names a GM-only fact. The trap and secret-project tooltips (projects-ui.mjs:333-335, 972-1007) are in the builder's own window and say what that window already shows.

  Method limit: I judged by the words and the window, not by drawing each window as a player.
- **The census passing by reading nothing.** Not possible as built:
  - the self-check plants every kind it claims and is red on a miss;
  - a file read as nothing leaves its baseline rows with no site, which is red ("a row no site needs any more");
  - a file espree cannot parse loses its unit names, so its sites match no row, which is red.

  The one hole is C2, which is about growth, not about reading.
- **Data a user typed in, in an HTML tooltip.** The one formatted `tipText` with data, diagnostics.mjs:2218 (`{warning}`), goes into a footer `tooltip:`, which the kit writes as a plain `title` (ui-kit.mjs:180, 289).
- **Controls the census does not count.** There is no `data-action` on a non-`<a>` tag. One `role="switch"` and one `role="link"` appear, both in comments. The 9 `tabindex="0"` / `contenteditable` hits are selectors, comments and one `<a role="button">`, which the census reads. It does not count focus or roles set in code (`setAttribute("tabindex", ...)`, as in explain.mjs's pips); I did not count those.

## What this read did not do

- I ran no tier 2 and no scenario on e102.
- I did not open any window at a real table.
- C1's mutant was run once, on one site.
