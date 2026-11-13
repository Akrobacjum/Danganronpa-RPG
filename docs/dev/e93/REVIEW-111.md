# REVIEW-111 - a read of the branches going into 1.2.111, from lines this line did not write

The coordinator's task of 13.11.2026: read adversarially the diffs that go into 1.2.111 and that `claude/e93` did not
write, for correctness bugs, D2 holes, Polish/English parity, texts against docs/text-style.md and tests that could
pass by measuring nothing. Read only: nothing was pushed to their branches and none of their code was fixed here.

| Branch | Tip | Base | Diff |
| --- | --- | --- | --- |
| `origin/claude/float-text` | 8091c5b5 | 421f2395 | 3 commits, 8 files, +816 -5 |
| `origin/claude/gaps-radio` | 06d7b5b1 | 421f2395 | 2 commits, 11 files, +656 -13 |
| `origin/claude/e59-c5a` | c1f9fbbf | 421f2395 | 3 commits, 4 files, +139 -76 |
| `origin/claude/e59-c5b` | 5c4336a7 | 421f2395 | 9 commits, 12 files, +689 -52 |

## How it was read

Three readers, one per branch (the two E59 branches together), each with the repository's own rules (CLAUDE.md, the
path rules, the test author contract, docs/text-style.md) and no harness run: the headless harness stays under this
line's three-user limit. They read the code and ran only `node --check`, `node tools/check.mjs <part>` and `git`
in detached worktrees, since removed. Each finding below was then re-read here against the branch's code; the
**Verified here** column says how far.

- **read** - the failing path was traced in the branch's code here, and it holds as written;
- **reader's** - the reader's finding, not re-traced here (low findings, mostly), left as their claim.

Nothing below was run at a table or in a browser. A finding about what Chromium draws or how Foundry dispatches a key
is read from the code and the listeners' order, not measured.

## The findings, most severe first

| # | Sev. | Branch | Where | What | Verified here |
| --- | --- | --- | --- | --- | --- |
| H1 | high | e59-c5b | audit/gate/ci-record.mjs:129 | run-all is spawned with the caller's environment, so `DRPG_REPO` boots another checkout or `DRPG_SUITE_SHARD` runs one shard, and the row is still written with this HEAD and `suite: passed` | read |
| F1 | medium-high | float-text | scripts/float-text.mjs:244-251 | Escape in a floating field stops in the capture phase on `window`, so the case map's own Escape (case-map.mjs:437) never shuts the open node; the next Escape closes the investigation window | read (the listeners' order); not run |
| T1 | medium | float-text | audit/float-sweep.mjs:171, 284 | with no captured project manager `interactions()` returns `[string]`; the caller destructures `[name, pass, line]` from a string, `pass` is `"n"`, truthy: an `ok` for nothing | read |
| M2r | medium | gaps-radio | audit/radio-sweep.mjs:22-25, styles/danganronpa.css:5223 | the committed captures hold no zone picker, Logic Dive editor or voice settings, so the default sweep never reads the window the owner reported; the CSS comment's "52 of them in the captured windows" does not match the committed set | read (the three rows absent; the comment's 52); the reader's 92/5 count not recounted |
| M1r | medium | gaps-radio | styles/stained-glass.css:4168-4179 | under Stained Glass the mark leaves the flow for checkboxes as well, the `inline-grid` control loses its baseline item and probably sits 3.5-6 px higher in a plain label; the season reset's baseline row moves under Legacy too | reader's (from the CSS; one screenshot per commit settles it) |
| M1c | medium | e59-c5a | tools/check.mjs:718, 747-752 | `package`'s self-check plants no asset read only by a `scripts/tests*.mjs` file or a stylesheet comment - the sprite's two readers; with tests counted as readers again the part stayed green, 2/2 plants | reader's (measured by the reader) |
| T2 | medium | float-text | audit/float-sweep.mjs:248-294 | no floor on what was read: a missing control, 0 fields, or an `--only` naming nothing ends "0 failing", exit 0 | reader's |
| F2 | medium | float-text | float-text.mjs:249-250 | `el.blur()` leaves the focus on `body`: a keyboard or screen reader user lands outside the window | reader's |
| F3 | medium | float-text | float-text.mjs:12-20, 159-160 | the top layer stands over the sequence curtain and the popups; a player typing when a sequence starts keeps their field over it, and their first Escape goes to the field | reader's |
| L1c | low | e59-c5b | ci-record.mjs:151, 156 | a corrupt ci-record.json is taken for a first record and the next write drops every other commit's rows; the write is not atomic | read |
| L2c | low | e59-c5b | ci-record.mjs:63, gatecode plants | a row's commit is held to 40 hex only; two refusals could be switched off with 8/8 plants still seen | reader's |
| L3c | low | e59-c5a | check.mjs:730 | the files that name others are read from the working tree, the list from HEAD: an uncommitted delete ends check.mjs in ENOENT (CI's clean checkout is not touched) | reader's |
| L4c | low | e59-c5a | .gitattributes:46 | macros/ leaves module.zip while gm-panel.mjs:102, danganronpa.css:7982 and the 1.2.75 notes still send GMs to them: 1.2.111's notes need the line | reader's |
| F4, T3, T4, C1-C3 | low | float-text | see below | a face copied after the placeholder; R4672's title; R4670-R4672 stamped "Since E64"; three comments | reader's |
| L1r-L5r | low | gaps-radio | see below | a window with every radio unread passes; Legacy's square checkbox not measured; R4650 does not read the dot's transforms; one stale test comment; probe 08's ballot wait | reader's |
| L5c | low | e59-c5b | templates, READMEs | "press Copy" (the button reads "Copy report"); "60 pages" (59 and a manifest); "E83 reads it" (E83 not shipped); BRANCHES.md "3 ahead" (9) | reader's |

No D2 hole was found in any of the four: none adds a socket, a bridge row, a write to the world or a reader of another
player's data. No Polish/English parity problem: none adds a user-facing string. No U+2013/U+2014 dash in the added
files.

The two E59 branches merge with each other cleanly (`git merge-tree`, tree a1248b28), and on a scratch merge `package`,
`stamps`, `notes`, `gatecode` and `tree` are green (the reader's run).

Below, each reader's full text, with its failing paths and patches.


---

## Review: origin/claude/float-text (base 421f2395)

Read-only. Read with `git show` / `git diff`. No harness run. `node --check` passes on float-text.mjs and float-sweep.mjs. Line numbers are the branch's.

### 1. Correctness

### F1 - medium-high - scripts/float-text.mjs:244-251 vs scripts/case-map.mjs:437-445: Escape in the case map's node text no longer shuts the node, and the second Escape closes the dashboard
- The case map's node fields, including `<textarea name="case:<ch>:<node>:text">` (investigation.mjs:2454), are drawn inside `.drpg-case-graph` (case-map.mjs:284, 238). The graph has a bubbling `keydown` listener: Escape shuts the open node's fields and stops propagation, so "the window's own Escape" does not close the window (its own comment, case-map.mjs:441).
- `onKeyDown` runs in the capture phase on `window` and calls `stopImmediatePropagation()`. The event never reaches the target, so it never reaches the graph.
- How it fails: a GM opens a node on the Map and types in its Note. They press Escape. The float drops and the field blurs, but the node stays open (before this branch, the node shut). They press Escape again. Focus is now on `body`, so the graph's listener does not fire. Foundry's Escape closes the investigation window, and any unsaved dashboard edits go with it (the Map's fields are saved by the dashboard's Save).
- The same holds for any textarea listener a window puts on Escape. The case map is the only one in scripts/ today (I grepped `"Escape"`: sheet.mjs's ultimate is contenteditable, notice-history's is an input).
- Patch: drop the float in capture, let the event go on to the target, and stop it only at `document` in the bubble phase. That listener runs before Foundry's `window` listener, and only if nothing below it stopped the event:
```js
function onKeyDown(event) {
    if (!parts.escape || event.key !== "Escape" || !current || event.target !== current.el) return;
    const el = current.el;
    drop();
    const stop = e => { if (e !== event) return; e.preventDefault(); e.stopImmediatePropagation(); el.blur(); };
    document.addEventListener("keydown", stop);
    setTimeout(() => document.removeEventListener("keydown", stop), 0);
}
```
- Caution: with this patch the capture listeners of foundry-windows.mjs:383 and sequence.mjs:735 see the event before `preventDefault()`. To keep them out, call `event.preventDefault()` in capture as now (both return on `defaultPrevented`) and leave only the stop and the blur to the bubble step. I have not run this. I3 of the sweep plus a case-map case should prove it.

### F2 - medium - scripts/float-text.mjs:249-250: Escape drops the keyboard user's focus to `body`
- `el.blur()` leaves `document.activeElement === body`. A keyboard or screen-reader user who presses Escape to leave the field is put back at the top of the page's tab order, outside the window they were working in. Before this branch, Escape in a module textarea went to the window (or the case map) and focus stayed in place.
- Patch: keep the focus on the field and only stop it floating until it next loses the focus:
```js
let dismissed = null;
// onKeyDown: replace `el.blur()` with `dismissed = el;`
function onFocusIn(e) { const el = e.target; if (el !== dismissed && floats(el)) lift(el); }
function onFocusOut(e) { if (e.target === dismissed) dismissed = null; if (current && e.target === current.el) drop(); }
```
- Unsure: whether Foundry's own Escape then closes the window on the next press while focus is still in a text field. Its keyboard manager's handling of a focused input on v14 is not read here.

### F3 - medium - scripts/float-text.mjs:12-20, 159-160: a floating field stands over the module's sequence curtain and popups, and takes the Escape that skips them
- The top layer is above every z-index. `#drpg-sequence` and `#drpg-popups` are ordinary elements (danganronpa.css:18137; sequence.mjs:141-151 appends a plain div and sets `body[data-drpg-sequence]`). No module code uses the top layer (I grepped `showPopover|popover=`: only float-text.mjs).
- How it fails: a player is typing in the messenger. The GM starts a sequence (the trial's entry, a body found), which plays on every browser. The player's field stays drawn over the curtain for the whole sequence. Their first Escape is taken by the float (it is registered first on purpose, R4671), so the sequence's skip (sequence.mjs:735) needs a second press.
- STATUS.md "Stacking" names only notifications and the notice tile.
- Patch: let a sequence end the float. In sequence.mjs, where `document.body.setAttribute(SEQUENCE_ATTR, kind)` is called (line 151), call `drop()` from float-text.mjs, which is a leaf with no imports, so no cycle. Or let float-text watch the body:
```js
new MutationObserver(() => { if (document.body.hasAttribute("data-drpg-sequence")) drop(); })
    .observe(document.body, { attributes: true, attributeFilter: ["data-drpg-sequence"] });
```
- Also list the curtain in STATUS's "Stacking" as an owner's decision, beside the notifications.

### F4 - low - scripts/float-text.mjs:136 then 147: the face is read after the placeholder is inserted
- `cs` is live. `el.before(hold)` (136) runs before `FACE.map(...)` (147). Any rule that styles the field through its siblings (`label + textarea`, `:first-child`, `:nth-child`, `:has(+ textarea)`) has already stopped matching when the face is copied, so the floating field takes the wrong face.
- I found no such selector on a textarea in styles/*.css, so this is latent. The PLACE read (134-135) is correctly taken before the insertion.
- Patch: move lines 147-148 (`const face = ...; const fieldColor = ..., fieldImage = ...;`) above `el.before(hold)`. Line 140's `ground` and line 139's `bg` already read before the writes. Move them up with it, so all reads come before the DOM change.

### 2. Trust model (D2)
No findings. The branch adds no socket, no document write and no flag read. The field stays in its form, so what a submit sends is unchanged.

### 3. EN/PL parity
No findings. The branch adds no user-facing string. The only text is code comments and STATUS.md.

### 4. Texts against docs/text-style.md
No findings (no user-facing text).

### 5. Tests and sweeps that could measure nothing

### T1 - medium - audit/float-sweep.mjs:171 with 284: a missing project manager reads as two passing interactions
- When no captured `projects` row exists, `interactions()` returns `["interactions: no captured project manager ..."]`, an array of one string. The caller destructures each item as `[name, pass, line]`. On a string that gives `"i"`, `"n"`, `"t"` (checked with node). `pass` is the truthy `"n"`, so the run prints `ok   i: t`, counts it as read and adds nothing to `fails`. That is the stackShapes failure exactly: green on an empty list.
- Patch:
```js
if (!row) return [[`interactions ${theme}`, false, `no captured project manager in ${WINDOWS_DIR}`]];
```

### T2 - medium - audit/float-sweep.mjs:248-257, 258-282, 293-294: no floor on what was read; the control can be skipped silently
- If `controlRow` is missing, the control is skipped with no message and no failure (249).
- If `withFields` is empty (a wrong `--windows` dir, a manifest change, `--only` naming nothing) or every field reads `hidden` or `missing`, the sweep prints `0 field reading(s) ... 0 failing` and exits 0.
- Patch:
```js
if (!WITHOUT && !ONLY_INTERACTIONS && !controlRow) fails.push("control: no captured project manager - the sweep cannot show it sees a fault");
...
if (!ONLY_INTERACTIONS && fields === 0) fails.push(`no field read (${withFields.length} window(s), ${hidden} hidden) - the sweep measured nothing`);
if (ONLY.length) for (const id of ONLY) if (!withFields.some(r => r.id === id)) fails.push(`--only ${id}: no captured window of that id with a textarea`);
```

### T3 - low - scripts/tests-tier0.mjs (R4672): the title promises more than the test measures
- "every textarea the module draws is in the float survey, in a window the helper floats". The count per file is measured, with a `> 10` floor (good). The window is only the survey's free-text second column, and nothing checks it against `FLOAT_SCOPE`.
- A new textarea in a Foundry-classed window gets listed with any description and passes.
- Patch: drop "in a window the helper floats" from the title and the registry row (for example "every textarea the module draws is in the float survey, counted per file"), or say in the comment that the window is read by hand when a row is added.
- Also, the census counts only `<textarea` literals and `createElement("textarea")`. That covers the two `createElement` sites (messenger-app.mjs:302, sheet.mjs:3175), and I found no other road (no `.hbs` templates in the tree).

### T4 - low - docs/dev/R-REGISTRY.md: R4670-R4672 stamped "Since E64"
- The registry's `--write` stamps a new row with the first stage in tools/stages.json that has not shipped. That is E64 (stages.json: E64, E93, E69, E74 open), but this work is the float-text line, not E64, which has its own branch (origin/claude/e64).
- Numbers: R4670-R4672 are used nowhere else. I checked R-REGISTRY.md on all 50 remote branches: no collision. The jump from main's R3917 matches the per-branch bands the other branches use.
- Patch: write the rows with `node tools/registry.mjs --write --stage <the stage this line ships in>` once it has one, or put the target release in Since by hand (STATUS says 1.2.111).

### Checked and clean
- R4670: fixtures on detached nodes, every assertion compares an explicit expected array, and nothing is true by construction.
- R4671: cuts with the kit's `bodyOf` (until `Hooks.once("setup"`). It has a `must` on the cut's length and a positive check in ready, so the negative `!/registerFoundryWindows|registerSequences/` cannot pass after a rename alone.
- R309's changed reading (tests-tier0.mjs, the `!bodies(...textarea:focus$)` clause): this negative would pass on a rename. It is anchored by the positive `textarea$ { min-height: 0 }` clause beside it on the same selector, so a renamed pane fails the positive first. Acceptable.

### 6. Comments and STATUS against the code

### C1 - low - audit/float-sweep.mjs:51-52 contradicts lines 38 and 209
- The header's "WHAT IT IS NOT" still lists "a real click (`focus()`)". I1 does a real `page.mouse.click` (38, 209). Only the field readings use `focus()`.
- Patch: "a real click for the field readings (they use `focus()`; I1 alone clicks)".

### C2 - low - scripts/float-text.mjs:241-243 and module.mjs:187-188: the ordering comment misses part of the reason
- The comment says the listener must stand before foundry-windows.mjs's and sequence.mjs's. Both of those return on `event.defaultPrevented` (foundry-windows.mjs:383, sequence.mjs:735). So the order matters only because each of them calls `stopImmediatePropagation()` when it takes the key.
- That is true, and R4671 holds it. Worth one clause, so nobody "simplifies" by dropping the `preventDefault`.
- With F1's patch the order still matters, for the same reason.

### C3 - low - docs/dev/FLOAT-TEXT/STATUS.md "What was built", **When**: "the next Escape is Foundry's"
- That is true only where nothing between the field and `window` handles Escape. On the case map, the next Escape closes the dashboard instead of shutting the node (F1).
- Fix it with F1, or name the exception.

No other mismatch found. The CAP_SHARE, EDGE_PX and 120 ms in the header match the code, and so do the reduced-motion sources (`drpg-reduced-motion` and the media query) and the leaf's no-import claim.

---

## Review: origin/claude/gaps-radio against 421f2395

I read the branch in a detached worktree. Checks run there: `node --check` on both new scripts, and `node tools/check.mjs` registry, contract, dashes, css, contrast, stamps, notes and tree, all green. Nothing headless was run, so no claim below comes from a render. Where a finding rests on how CSS lays a box out rather than on code I read, I say so.

### 1. Correctness

### M1 (medium, layout reasoning, not measured): the glass's checkboxes and radios in a plain label probably sit higher than before
`styles/stained-glass.css:4168-4179`. This takes the `::before` mark out of the flow (`position: absolute`) for checkboxes as well as radios, on every module surface. The box rule at `stained-glass.css:4101` makes the control `display: inline-grid` and sets no `vertical-align`.

- Before this branch, the mark was the grid's only in-flow item, so the control's baseline was the mark's bottom edge: 16 px down a 22 px radio, 18.5 px down a checkbox.
- With the mark out of the flow the grid has no items, so its baseline is made from the box's bottom edge (22 px).

Failing path: under Stained Glass, open the zone picker (`<label><input type="radio" name="mode"> Straw Poll</label>`, trial-zones-ui.mjs:237), the Logic Dive editor's truth (trial-zones-ui.mjs:153), Level Up's who (level-up.mjs:1208), or any checkbox in a plain label. The control's bottom now sits on the text baseline, so the box stands about 6 px (radio) or 3.5 px (checkbox) higher than the words. The same holds in a flex row aligned by baseline: `.drpg-reset-section .drpg-inline-check { align-items: baseline }` (danganronpa.css:3955), the season reset's cast.

The Legacy rule added `vertical-align: middle` (danganronpa.css:5239), which covers inline labels there but not the baseline-aligned flex row. The glass got no equivalent. radio-sweep only checks the dot against the box, never the box against its label, so it cannot see this.

Patch:
```css
/* stained-glass.css, the rule at 4168 */
body.drpg-theme-stained-glass :is(.drpg-panel, .drpg-popup, .drpg-messenger, .application.sheet.actor) input:is([type="checkbox"], [type="radio"]) {
    position: relative;
    vertical-align: middle;
}
/* danganronpa.css, after .drpg-reset-section .drpg-inline-check: the control is centred, not baseline-aligned */
.drpg-reset-section .drpg-inline-check > input:is([type="checkbox"], [type="radio"]) { align-self: center; }
```
Then add a radio-sweep check that compares the box's vertical centre with its label's text line, for example a Range over the label's text node, within about 2 px.

I am not certain how far Chromium shifts the box here, because I did not render it. A shot of the zone picker at 421f2395 next to one at 06d7b5b1 settles it.

No other correctness bug found in the changed selectors. Things I checked that came back clean:
- **Selector reach.** `body:not(.drpg-theme-stained-glass)` is Legacy only, since settings.mjs:4108-4109 always stamps one of the two theme classes. The `:is(...)` list matches the glass's own surfaces, so no core or other-module window is newly reached. Every `type="radio"` in scripts/ sits in a `.drpg-panel` window or a `.drpg-choice` row. The voice panel is in the Look window, which is `.drpg-panel .drpg-projects`.
- **Hidden radios.** No module rule hides a radio, and none positions an input absolutely, so the new `position: relative` overrides nothing.
- **Weight.** The new weight (0,5,2) only beats rules that were meant to lose: the field rule that R4651 fixes and `.drpg-form-grid`'s `min-width`.
- **Forced colours.** The `!important` block at danganronpa.css:17664 still wins, and the radio's `clip-path: none` is an improvement there.
- **States.** Focus outline is kept in both themes, and disabled (dashed) and checked are stated in both.

### 2. EN/PL parity and texts
No user-facing text, `lang/*.json` or `config.mjs` prose changed. Nothing to report.

### 3. Tests that could measure nothing

### M2 (medium): radio-sweep's default capture set lacks the windows the change is about, and its header says otherwise
`audit/radio-sweep.mjs:22-25` says: "Every radio of scripts/ is in a captured window since gaps-radio's second commit". `danganronpa.css:5223` cites "52 of them in the captured windows (audit/radio-sweep.mjs)".

The committed `audit/windows/manifest.json` has no row for `zone-picker`, `dive-editor` or `drpg-settings-player-voice`, although probe 08's `WINDOWS` lists them (I diffed WINDOWS' ids against the manifest). No WINDOWS row draws Level Up's queue (`who-*`), the rest picker's single `pick` radio or the voice panel's `voice:mode`.

The committed captures hold 92 radios: `variant` 28, `newImgChoice` 32, `glyph` 21, `choice0` 4, `castTo` 3, `friskMode` 2, `what` 2. Only `castTo` and `friskMode` sit outside a choice row, so only those 5 were Foundry's under Legacy before this branch, not 52.

Failing path: `node audit/radio-sweep.mjs` with no `--windows` never reads the owner's window (the zone picker's Mode), the dive editor's truth or Level Up's who, and reports green. If those windows broke again, the default run would not notice. The 52 can only have come from a fresh capture directory that is not committed, so it cannot be checked again from the repository.

Patch, one of:
- Run probe 08 with `DRPG_CAPTURE_ONLY=zone-picker,dive-editor,drpg-settings-player-voice`, add a Level Up queue row to `WINDOWS`, and commit the captures.
- Or correct the claim:
```diff
- * ... Every
- * radio of scripts/ is in a captured window since gaps-radio's second commit: probe 08 gained ...
+ * ... The committed captures (audit/windows/) do not yet hold the zone picker, the Logic Dive editor, Level Up's
+ * queue or the voice panel: run probe 08 for them and pass `--windows <dir>`. Probe 08 gained ...
```
In either case, write the directory and commit the 52 was read from into the danganronpa.css comment.

### L1 (low): radio-sweep stays green when a whole window's radios go unread
`audit/radio-sweep.mjs:96-97, 115, 159`. A radio with no client rects is skipped without being listed. A covered or clipped radio is only printed as "not read". The exit code fails only when the whole run reads zero radios (`!radios`).

Failing path: a CSS regression hides or covers every radio of one window, say the ballot's rows under an overlay. The sweep prints a "not read" line and exits 0.

Patch: fail on any window outside an explicit allow-list (the item tables' other tabs):
```js
const PANE_NOT_SHOWN = new Set(["item-tables--rooms", "item-tables--editRooms", "item-tables"]); // as measured
if (r.unseen && !PANE_NOT_SHOWN.has(w.id)) problems.push(`${lang} ${w.id} ${theme} dsf${dsf}: ${r.unseen}`);
```

### L2 (low): "a checkbox stays square under both themes" is not measured under Legacy
- `audit/radio-sweep.mjs:120` checks a checkbox only when `appearance === "none"`. Under Legacy the module does not draw checkboxes (they stay `auto`), so the Legacy half of the header's promise (line 21) reads nothing.
- R4650 (`scripts/tests-tier1.mjs:41265`, its name ends "a checkbox stays square") expects Legacy's checkbox `border-radius` to be `null`, meaning no module rule states one. That is consistent, but it is not "square".

Patch: reword both to "under the glass a checkbox stays square; under Legacy it is Foundry's (no module rule states its corner)". Or, in the sweep, count and print the checkboxes it skipped.

### L3 (low): R4650 does not hold everything its comment promises
`scripts/tests-tier1.mjs:41265-41297`. The CSS comments promise that no `translate`, `rotate` or `scale` from another rule moves the dot, and that the dot is round. The test reads neither `translate`, `rotate` nor `scale`, nor that `::before`'s width equals its height. A later rule could plant `::before { translate: 2px 2px }` or a 6x4 dot and R4650 would stay green.

Patch: add to `radio(el)`:
```js
v(el, "translate", "::before"), v(el, "width", "::before") === v(el, "height", "::before")
```
Then extend `round` with `"none", true`.

### L4 (low): a comment in an existing test is now false for the radio
`scripts/tests-tier1.mjs:40712-40713` says: "not `border-radius`: the theme's sweep of square corners ... wins it on every surface, with the same 0 the definition states". Since this branch the sweep skips radios (`:not([type="radio"])`, stained-glass.css:4010) and the radio's corner is 50%.

Patch: "... wins it for the checkbox; the radio's 50% is R4650's".

### R numbers
R4650 and R4651 are unique. `check registry` is green and `--next` reads R4652.

The branch took a block (R4650) rather than R3917, the next free number. Other open branches do the same (e100 R4100+, e101b up to R4471), so I read this as the parallel-branch convention and not a fault.

One low point: the "Since" cell for both rows says `1.2.111`, set by hand. `registry.mjs` would stamp the working stage (E64). Per stages.json's comment, 1.2.111 is a version no stage plans. Set it to the stage that will ship it, or to `gaps-radio` as the owner prefers. It is information only.

### 4. Comments and claims against the code

- **M2** above: the "every radio is captured" and "52" claims.
- **L4** above: the old test's "wins it on every surface".
- **L5 (low): wrong probe opener and an unwrapped GM step.**
  - The manifest row `ballot` records `"opener": "vote.mjs new Promise(r => setTimeout(() => r(null), 2500))"` (audit/windows/manifest.json, the ballot row; probe 08 line 325). That names the wait, not what opens the window, which is the GM's `vote.open` packet (`gmDuring`). Patch: `call` stays as it is, and the row gets `opener: "vote.mjs onBallotOpened (the GM's vote.open to p1)"`, or a `w.opener` override in `run`.
  - In probe 08's `run`, `if (w.gmSeed) await onGm(w.gmSeed);` is not wrapped in try. A seed that throws ends the whole capture run, where every other step is written down with `note()`. Patch: `try { await onGm(w.gmSeed); } catch (err) { note(`${w.id} gmSeed`, ...); continue; }`.

The fixtures are captured output, not hand-written. I compared them with their sources and they match: ballot (vote.mjs:796), palm-frisk (palm.mjs:169-174), season-reset (season-wipe.mjs:180) and use-item-pick (use-items.mjs:626). The ballot packet does not write to the world: a dismissed ballot only warns (vote.mjs `castBallot`). The harness honours `recipients` (cluster.mjs:548), so only p1 draws it.

---

## E59 C5a / C5b review (read-only, 13.11.2026)

Base `421f2395`. Branches `origin/claude/e59-c5a` (c1f9fbbf) and `origin/claude/e59-c5b` (5c4336a7). Everything below was
read or run in detached worktrees in the scratchpad. All of them are removed now, and nothing in the repository changed.

### What was run

- `node tools/check.mjs package` on c5a: green. It reads 269 files, and the top level is LICENSE README.md docs/ fonts/
  icons/ lang/ module.json scripts/ styles/. The same part on 421f2395, with c5a's check.mjs copied in, is red with the
  6 problems the header names: 5 macros/ files and icons/pixel-sprite.svg. The "Red on 421f2395" claim holds.
- The tar parser against the zip release.yml builds: `git archive --format=zip HEAD` of the merge lists the same 269
  files, and `git archive --format=tar | tar t` also gives 269. The parser agrees with the real zip.
- `python3 tools/port-glass.py` on 421f2395 gives `229 insertions(+), 1530 deletions(-)` on scripts/glass.mjs. That
  matches the claim in glass-recipe.js, and nothing else in the tree names port-glass.
- c5b: `stamps`, `notes` and `gatecode` are green. stamps finds 6 rows in 3 files and sees 3/3 planted faults. CHANGELOG
  is current against 94 notes files, with 94 rows and no version dropped or doubled. gatecode sees 8/8 planted rows refused.
- Full `node tools/check.mjs` on c5a, on c5b's merge and on 421f2395: red on `names, moves, text` in all three. That comes
  from the environment: espree is not installed, so `npm ci` was not run, and the text part's T1-T3/T14 "found 0" comes
  from the same cause. The branches add no new red.

### Merge of the two branches

`git merge-tree --write-tree origin/claude/e59-c5a origin/claude/e59-c5b` is clean (tree a1248b28, exit 0).

On a scratch merge commit of that tree:
- `package stamps notes gatecode tree` are all green.
- `package` is still 269 files, because c5b's `CHANGELOG.md export-ignore` keeps the new top-level file out of PACKAGE_TOP's way.
- Registration works: PARTS' literal line is c5b's (unchanged), and `PARTS.package = pkg` comes after it, so the no-argument
  run lists 18 parts with `package` last.
- Neither branch's .gitattributes change breaks the other's assumptions. c5b's new files are all under export-ignored
  paths (.github/, docs/dev/, audit/) or are CHANGELOG.md, which c5b ignores itself.

---

### Findings

### H1 - ci-record.mjs passes the caller's DRPG_REPO and DRPG_SUITE_SHARD to run-all, so a row can bind to the wrong commit or record a shard as the whole suite

**Where:** c5b, `audit/gate/ci-record.mjs:129` (and 141-147).

```js
const run = spawnSync(process.execPath, ["run-all.mjs", ...parts], { cwd: path.join(REPO, "audit", "harness"), stdio: "inherit" });
```

- No `env` is passed, so the child inherits all of `process.env`.
- `run-all.mjs:52` boots `process.env.DRPG_REPO || <its own checkout>`, and cluster.mjs:391 passes the variable on to every client.
- `scenarios/01-runtests.mjs:29` runs only shard i/n when `DRPG_SUITE_SHARD` is set.

**Failing path 1 (wrong commit):**
1. With `DRPG_REPO=/some/other/checkout` exported in the shell, someone runs `node audit/gate/ci-record.mjs suite` in a
   clean checkout at commit X.
2. run-all tests the other tree, and the result is green.
3. ci-record writes `{gate: "suite", commit: X, result: "passed"}`. recordProblems accepts it, and so does gatecode.

run-all.json even carries `repo: REPO` (run-all.mjs:335), but ci-record never reads it.

**Failing path 2 (part of the suite recorded as all of it):**
1. With `DRPG_SUITE_SHARD=2/8` set, which is how CI's shards run, ci-record runs.
2. Only 136 of tier 2's tests run, and the part is green.
3. ci-record records "suite passed" with GATE_FILES' full suite file list.

This is exactly "a record claims a part ran that did not". The header's promise that "the row's commit is the code that
ran" fails here.

**Patch:**
```diff
-    const run = spawnSync(process.execPath, ["run-all.mjs", ...parts], { cwd: path.join(REPO, "audit", "harness"), stdio: "inherit" });
+    const env = { ...process.env };
+    for (const k of ["DRPG_REPO", "DRPG_SUITE_SHARD"]) if (k in env) { console.log(`ci-record: ${k} is set; a row records this checkout's whole run - unset it`); process.exit(2); }
+    const run = spawnSync(process.execPath, ["run-all.mjs", ...parts], { cwd: path.join(REPO, "audit", "harness"), stdio: "inherit", env });
@@
     if (!report || Date.parse(report.startedAt) < spawnedAt.getTime() - 1000) {
...
+    if (path.resolve(report.repo ?? "") !== REPO) { console.log(`ci-record: run-all.json ran ${report.repo}, not ${REPO}; nothing recorded`); process.exit(1); }
```

If refusing is too strict, deleting the two keys from `env` also works. Either way, the repo check is cheap and closes the
same hole for a concurrent run-all from another checkout that overwrites results/run-all.json. I could not run the writer:
it spawns the harness, which this review was not allowed to run. The path is read from the code of all three files.

### M1 - `package`'s self-check does not plant the rule that caught the sprite, and a mutant that removes the rule stays green

**Where:** c5a, `tools/check.mjs:718` (the test-reader exclusion), 729-732 (CSS comment blanking), 747-752 (the plant).

**What the plant covers:**
- It plants a folder outside PACKAGE_TOP and an icon named only in a script comment.
- It does not plant an asset named only by a `scripts/tests*.mjs` file (R3333's case, the pixel sprite), or one named only in a
  stylesheet comment. The second is the sprite's other "reader": the comments in pixel-icons.css and stained-glass.css.

**Measured:**
1. In a c5a worktree I changed line 718 to `if (!/^NEVER$/.test(file)) assetNames.push(...)`, so tests count as asset readers.
2. I commented out `icons/pixel-sprite.svg export-ignore`.
3. The result was `package: ... 270 file(s) ... self-check 2/2 planted fault(s) seen ... 0 problem(s)`, all green, with the
   sprite back in the zip.

Renaming the tests (for example to `scripts/suite-*.mjs`) would cause the same thing with no mutant. The CSS comment branch
is not planted either.

**Patch (the plant):**
```diff
-        ["macros/x.js", "icons/item-tool.svg", "icons/unread.svg", "icons/state-dead.svg", "scripts/tests-only.mjs"],
+        ["macros/x.js", "icons/item-tool.svg", "icons/unread.svg", "icons/state-dead.svg", "scripts/tests-only.mjs", "icons/test-only.svg", "icons/css-comment.svg"],
         [{ file: "scripts/config.mjs", code: ... },
-            { file: "scripts/tests.mjs", code: lint.blankComments("await import(\"./tests-only.mjs\");") }]);
-    const planted = ["macros/x.js ships", "icons/unread.svg ships"];
+            { file: "scripts/tests.mjs", code: lint.blankComments("await import(\"./tests-only.mjs\"); fetch(\"icons/test-only.svg\");") },
+            ...packageReadersOf([{ file: "styles/x.css", text: "/* icons/css-comment.svg */ a{}" }])]);
+    const planted = ["macros/x.js ships", "icons/unread.svg ships", "icons/test-only.svg ships", "icons/css-comment.svg ships"];
```

`packageReadersOf` stands for the comment-blanking half of `packageReaders`, split out so the plant goes through the same
code. Also hold the test-file pattern to something: `must` at least one reader match `/^scripts\/tests[\w-]*\.mjs$/`, or the
exclusion reads nothing.

### L1 - ci-record.mjs silently drops an unreadable record, and writes it in place

**Where:** c5b, `audit/gate/ci-record.mjs:151` and `:156`.

`try { record = JSON.parse(...) } catch { /* a first record */ }` treats a truncated or hand-broken file the same way as a
missing one.

**Failing path:**
1. A crash or Ctrl-C during the `writeFileSync` at line 156 leaves half a file.
2. `gatecode` goes red with "not JSON", which is good.
3. The next writer run replaces the file with only its own rows, and every other commit's rows are lost with no message.

**Patch:**
```diff
-    try { record = JSON.parse(fs.readFileSync(file, "utf8")); } catch { /* a first record */ }
+    if (fs.existsSync(file)) {
+        try { record = JSON.parse(fs.readFileSync(file, "utf8")); }
+        catch (err) { console.log(`ci-record: ${RECORD_FILE} is not JSON (${err.message}); fix or remove it - nothing recorded`); process.exit(1); }
+    }
@@
-    fs.writeFileSync(file, JSON.stringify(record, null, 2) + "\n");
+    fs.writeFileSync(`${file}.tmp`, JSON.stringify(record, null, 2) + "\n");
+    fs.renameSync(`${file}.tmp`, file);
```

### L2 - gatecode accepts a row whose commit is not in the repository, and some refusals have no plant

**Where:** c5b, `audit/gate/ci-record.mjs:63` (commit format only), 60-81 (rules), 99-108 (plants).

**The commit check:**
- recordProblems checks only that the commit is 40 hex digits.
- The digest is an unkeyed SHA-256 of the fields. The header says so honestly ("nothing here signs").
- So a row that is made up, with its digest recomputed, passes gatecode with `commit: "f".repeat(40)`.
- A cheap step up is `git cat-file -e <commit>^{commit}` plus `git merge-base --is-ancestor <commit> HEAD` in gatecode,
  not in `recordProblems`, so the function stays pure. That refuses a commit that does not exist, or one from another branch.

**The plants (measured):**
1. In a c5b worktree I disabled two refusals: "a run with a failed row exited 0" (line 80) and "its command did not run
   <gate>" (line 62).
2. gatecode still printed `8/8 planted row(s) refused, the control accepted; 0 problem(s)`.

So the plants miss those two branches, and also "two exit codes in one run" (line 78).

**Patch:** add these to `plants`:
```js
"failed over exit 0": { schema: SCHEMA, rows: [makeRow({ ...base, result: "failed", status: "red", exitCode: 0 })] },
"command without its gate": { schema: SCHEMA, rows: [makeRow({ ...base, command: "node audit/harness/run-all.mjs check" })] },
"two exit codes": { schema: SCHEMA, rows: [makeRow(base), makeRow({ ...base, gate: "check", files: [...GATE_FILES.check], command: "node audit/harness/run-all.mjs", exitCode: 1, result: "failed", status: "red" })] }
```

For the third, use one command for both rows so they share a run key.

Not a bug, but worth one line in the header: committing ci-record.json changes `audit/gate/**` and `**`. So under its own
GATE_FILES, every recorded `check` and `gate` row looks touched by the very commit that records it. E83's reader has to leave
the record file out of the diff.

### L3 - `package` reads readers from the working tree but files from HEAD

**Where:** c5a, `tools/check.mjs:730` (`read(file)`) against 739-741 (`git archive ... HEAD`).

**Failing paths:**
- A tracked script deleted but not committed: `node tools/check.mjs` dies with `ENOENT ... at packageReaders
  (check.mjs:730)` (measured, with scripts/a11y.mjs moved away). No part after it runs, and there is no summary line.
- An uncommitted edit that names a file: an asset nothing reads in HEAD counts as read locally.

CI's checkout is clean, so the gate itself is not affected.

**Patch:** read the blob the archive holds.
```diff
-        const text = read(file);
+        const text = lint.lf(execFileSync("git", ["-C", REPO, "show", `HEAD:${file}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
```

Or take the text from the tar buffer `tarNames` already walks.

### L4 - macros/ leaves the install, while the module still points GMs to "the five macros the repository carries"

**Where:** c5a, `.gitattributes:46`.

- The rule is right by the part's definition, since no code reads macros/.
- But `scripts/gm-panel.mjs:102`, `styles/danganronpa.css:7982` and `.github/release-notes/v1.2.75.md:9` tell a GM the five
  macros "run from the Macro Directory".
- Until now a GM could copy them from `Data/modules/danganronpa-rpg/macros/` of an install. From the next zip on, they are
  only on GitHub.

This is not a check bug. It is a user-visible change that needs a line in the next release's notes, which c5a does not add.
The two comments still read true ("the repository carries").

### L5 - Texts and stale claims (c5b unless marked)

- `.github/ISSUE_TEMPLATE/bug-report.md:27`, `table-report.md:31`: "press Copy". The button is "Copy report"
  (`lang/en.json` key `...copy` = "Copy report", diagnostics.mjs:10, gm-handbook section on `diagnose()`). docs/text-style.md
  names controls by the words they show. The handbook also says a player can run `diagnose()` and get a player's report.
  "As a GM" turns away a player filing a table report. Proposed: "Type `game.drpg.diagnose()` in the browser console (F12)
  and press **Copy report** in the window it opens".
- `audit/README.md:36`: "`windows/` ... (60 pages)". The folder holds 59 `.html` pages and `manifest.json`.
- `audit/gate/README.md:73`: "E83 reads it to repeat only the gates a fix touched". E83 is planned 1.2.132, not shipped
  (`tools/stages.json`). Nothing but gatecode reads the file today (`git grep -l ci-record`). Say "E83 is to read it".
- `docs/dev/README.md:5` says "a line that adds a folder adds its row when it merges". The same branch adds `docs/dev/e59/`
  (31c99720, after the README's 24aee44f), and there is no row for it.
- `docs/dev/e59/BRANCHES.md:45`: `e59-c5b` "3 ahead". The branch is 9 ahead now. It is a dated snapshot, which the file
  says, but its own row was already stale when the branch shipped. Drop the e59 rows, or mark them "this line".
- c5a: CLAUDE.md's "One check" row lists the parts without `package` (nor `glyphs`). A new part should be in that list.
  CLAUDE.md is the owner's and is not edited by an agent unasked, so this is flagged, not patched.
- No U+2014 or U+2013 in any added file of either branch (grep). `dashes` is green on the merge.

### Checked and found sound (no finding)

- **The tar reader:** ustar prefix, pax `path=` and global `g` headers. It agrees with the zip release.yml builds.
- **`--worktree-attributes` against release.yml's plain `git archive HEAD`:** identical on CI's clean checkout.
- **The export-ignore patterns:** `macros/` and `icons/pixel-sprite.svg` match exactly those 6 files. Every remaining shipped
  file has a reader. lang/pl.json comes in through diagnostics.mjs's `lang/${...}.json`, the handbooks through handbooks.mjs's
  template, and the fonts through the stylesheets. No `url()` outside a comment names the sprite. The tests that read it
  (tier 0 R3333 and the one at :805) are behind `needs(env.tools())`.
- **changelog.mjs:** numeric version sort (1.2.10 before 1.2.9, planted), only `vX.Y.Z.md`. Both title forms come out right
  on all 94 notes, the 1.2.0 and 1.2.15-27 sentence form included. No BOM or CRLF trouble (CRLF is normalised).
- **The `stamps` rows:** the regexes find all 6 rows, the linked `[Daggerheart (Foundryborne)](...)` row included. The
  version regex takes the first two numbers after the name cell. The 3-fault plant is seen.
- **ci-record's writer otherwise:** a clean-tree check before the run, a HEAD-moved check after, and the stale run-all.json
  guard (a NaN `startedAt` slips past line 134 but is refused by "no run time" at 155). The result is read from run-all's own
  status, never from argv. No waiver file is read or written by either branch.
