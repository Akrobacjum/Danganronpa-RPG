# Survey: windows whose closing word has the action "close"

Read only, 13.11.2026, on origin/main 421f2395 (1.2.109); nothing in scripts/ changed. The harness change of section 4
was applied on a scratch checkout of 421f2395 in this container, measured there and thrown away; it is not pushed.

## 1. What a table does, and what the harness does

- **The table.** ApplicationV2 dispatches `[data-action]` clicks itself, and `close` is its own action: it closes the
  window before DialogV2 sees the press, so `DialogV2.wait` answers null, as for the header's X or Escape
  (trial-floor-ui.mjs:1832-1856, measured 11.09 on the vote window; ui-kit.mjs:113-119). **On v14 this is assumed, not
  measured**: LIVE-E21-06 (audit/AUDIT-1.2.42.md, item 398) is the open check, and the 11.09 reading does not say
  which Foundry it was taken on. So "at a v14 table such a button never reaches DialogV2" is the module's premise
  rather than a reading; every conclusion below holds only as far as that premise does.
- **The harness.** audit/harness/lib/shim.mjs's DialogV2 has no such dispatch. A drawn window's footer click goes to
  `_onSubmit` (:1605), which answers the button's action, so a press on Close answers `"close"`. A window that is not
  drawn is auto-answered with its default button (:1644-1667), and a closing word with no primary in the footer is the
  default (ui-kit.mjs:138, `named = footer.default ?? (right[0] ?? closing[0])?.action`), so it answers `"close"` too.
- **What already guards this.** `footerButtons` throws when a closing word with the action "close" carries a
  callback (ui-kit.mjs:126), so no window can do work in a callback the table never runs. What it cannot catch is a
  caller that reads the answer `"close"` differently from null - the class surveyed here.

## 2. The census

Every `close:` of a footer, `close: "close"`, `{ role: "close", action: "close" }`, `{ role: "cancel", action:
"close" }`, and every `action: "close"` in a button list, in scripts/ less the tests: 37 hits, read whole with the
caller of each window. `drpgConfirm` with `no: "close"` has no caller (only its comment, ui-kit.mjs:1407).

The 37 hits are 5 windows that compare the answer with "close", 16 that read only a positive answer, 8 that do not
read it, 3 that are not of this class, and 5 comments (trial-floor-ui.mjs:1832 and :1847, ui-kit.mjs:39, :114 and
:1407). Each window is named below by its footer's line and, where they differ, the line that reads the answer.

### 2a. The answer compared with "close", and null taken the same road (5)

| Window, read at | Code | Table (null) | Harness ("close") | Lost or kept |
| --- | --- | --- | --- | --- |
| action-menus.mjs:250, :268 | `if (!picked \|\| picked === "cancel" \|\| picked === "close") return null;` | returns null | returns null | nothing |
| investigation.mjs:3051, :3130 | `if (!action \|\| action === "close") return null;` | returns null | returns null | nothing |
| season-setup.mjs:1178, :1203 | `if (!result \|\| result === "close") return null;` | returns null | returns null | nothing |
| tables-editor.mjs:1680, :1732 | `if (!action \|\| action === "close") return null;` | returns null | returns null | nothing |
| trial-floor-ui.mjs:1466, :1781 | `if (!action \|\| action === "close") return null;` (the trial console) | returns null | returns null | nothing |

The `=== "close"` half of each is dead at a table, and harmless there, because null takes the same branch.

### 2b. Only a positive answer read (16)

The caller acts on a named answer and does nothing for any other, so null and "close" end the same way.

| Window | The answers it acts on |
| --- | --- |
| case-realize.mjs:80 | `Array.isArray(picks)` |
| case-summary.mjs:89 | `"send"` (`answer !== "send"` returns null) |
| diagnostics.mjs:2215 | `"copy"`; returns `action ?? null` to a caller that does not read it |
| enforced.mjs:960 | `"give"`, `"hold"` |
| enforced.mjs:1002 | `"hold"` (`offerHoldAgain`, :986) |
| gm-panel.mjs:759 | `"copy"` |
| gm-stores.mjs:2463 | `"backup"`, `"restore"` |
| murder-rules.mjs:3672 | `"betrayal"`, `"investigation"`, `"body"`, `"autopsy"` |
| murder-rules.mjs:4056, :4087 | `"remnants"` |
| murder-ui.mjs:645, :654 (the tracker, read at :769-779) | `"open"`, `"pass"`, `"reask"`, `"end"` |
| season-setup.mjs:1270 | `result?.checks` |
| season-setup.mjs:1332 | `"open"` |
| trial-zones-ui.mjs:346 | `"new"` (`.then(out => out === "new" ? ... : null)`) |
| trial-zones-ui.mjs:403 | `"add"` |

### 2c. The answer not read (8)

dice-look.mjs:512; explain.mjs:55 (the four explainers, :223-377, hand the promise to callers that do not read it);
gm-panel.mjs:574; season-setup.mjs:1355; sound-panel.mjs:67 and :378; stash-reach.mjs:811; trial.mjs:1670
(`openObjectionLog`: investigation.mjs:2880 awaits it and reads nothing).

### 2d. Not this class (3, and 3 that only look like it)

- case-realize.mjs:195 - the closing word's action is "later", which reaches DialogV2.
- gm-items.mjs:184 - the closing word's action is "cancel", the same.
- notice-history-app.mjs:225 - a DrpgApp (ApplicationV2), not a DialogV2; its Close is Foundry's own action and the
  window reads only "clear" (:296). See section 3.
- Outside the 37: murder-ui.mjs:318 (`close: "cancel"`, read `!result || result === "cancel"` at :323), the vote
  window (trial-floor-ui.mjs:1832, `close: "cancel"` since 11.09, the documented case), and the op "close" of
  passages-tab and vote.mjs (an operation's name, not a button's action).

### 2e. The one that diverged

On main: **none**. The only site found where "close" and null go different ways is the planner line's Cancel, not on
main: investigation.mjs on the e97-98 line, `close: { role: "cancel", action: "close" }`, whose autosave ran on
`!action` - so at a table Cancel saved the open node, while the harness's "close" discarded it (the GM kept an edit
they had cancelled). It is REVIEW-111-planner.md's medium, and it is fixed on the e97-98 fix line (da352a81: the action
"discard", and the tier-2 test presses Cancel as v14 would).

**note - a stale comment.** enforced.mjs:995: "Not now ... the answer still "close"". At a table the answer is null
(section 1); `offerHoldAgain` reads only "hold", so nothing changes. One word in the comment: "the answer null at a
table (Foundry's own close), "close" headless".

## 3. A gap beside it: a DrpgApp's Close is never pressed headless

The shim's ApplicationV2 does not dispatch `[data-action]` either, so a DrpgApp footer's Close (the notice history,
notice-history-app.mjs:225) does nothing when clicked headless. Scenario 73 reads that button (its role, word and
side, 73-notice-history.mjs:495) and never clicks it. Nothing found lost by it; a test that clicked it and waited for
the window to go would hang rather than pass. Not measured further.

## 4. The smallest harness change, and what it turns red

### (a) A footer press on "close" closes the window

```js
async _onSubmit(target, event) {
    // v14's ApplicationV2 takes [data-action="close"] as its own close, before DialogV2 (trial-floor-ui.mjs:1832; LIVE-E21-06)
    if (target?.dataset?.action === "close") return this.close();
    ...
```

Two lines in audit/harness/lib/shim.mjs `_onSubmit` (:1605). The close fires the window's "close" listener, and
`_openWindow` (:1615-1626) answers null, as at a table. Enter on a drawn window takes the same road (the form's
`submit` listener hands `event.submitter` to `_onSubmit`).

Measured on the scratch checkout, with a line that wrote each press to a file:

| Run | Result | Same as without |
| --- | --- | --- |
| `node run-tests.mjs --tier 2` (tiers 0-2, whole) | 2650 passed, 1 failed, 27 skipped, 0 red; 72 min 28 s | yes: the one failure is "every control in the module's own chrome has a name to be read out", the r3551 failure, the same message on 421f2395 without the change (REVIEW-111-r3551-icon.md section 1); 27 skips, `skip-baseline.json`'s 27 |
| the 38 scenarios of `run-all.mjs scenarios` (84 left out, as always here), each by `cluster.mjs` | 38 exit 0, 0 failed; the expected reds those on main carry (30: 1, 65: 2, 67: 1, 72: 4, 76: 1) | yes |
| presses that reached the new line in the scenarios (the run of (b) below, (a) applied and each press recorded; 87 also in the first) | 41-trial-scene 1 and 67-trial-modes 1 (the trial console, read at trial-floor-ui.mjs:1781), 87-messenger-sound 5 (the Sound window) | |
| presses, suite: the five tests that click a "close" footer (R2028, R3133, E50-T1, E44-T2, E46-T3, found by grep), run by name | 6 (Sound 5, Dźwięk 1), 10 passed, 0 failed | |

**It turns 0 tests and 0 scenarios red.** That is what section 2 predicts, and it is not a run that measured nothing:
the line was reached 13 times, and every press it changed went to a caller that reads "close" as it reads null. The whole
tier-2 run was made before the record was added, so its own count is not known; the five tests above are the ones a
grep of scripts/tests*.mjs finds clicking `footer.form-footer button[data-action="close"]`.

### (b) The auto-answer of a default closing word

A window that is not drawn is answered with its default button; a footer with no primary makes its closing word the
default (section 1), so headless it answers `"close"`, where Enter at a table presses that button and - on the same
premise - Foundry closes the window, null. Two more lines, in `DialogV2.wait` after `if (!def) return null;` (:1646):

```js
// a default closing word of action "close" is Foundry's close at a table: the auto-answer is a dismissal
if (def.action === "close") return null;
```

That Enter's implicit submission reaches ApplicationV2's action dispatch as a click is reasoned, not read in v14's source;
it belongs with LIVE-E21-06.

Measured with (a) and (b) both applied, each auto-answer it changed recorded:

| Run | Result | Reached |
| --- | --- | --- |
| the 38 scenarios, each by `cluster.mjs` | 38 exit 0, 0 failed, the same expected reds | 10-murder 1 and 13-murder-signals 1 (the Incident tracker, murder-ui.mjs:645, read at :769-779), 50-lang 1 (the GM panel in Polish, gm-panel.mjs:574, not read) |
| `node run-tests.mjs --tier 1` | 1320 tests ran, 1305 passed, 0 failed, 16 skipped, 0 red; 458 s | (b) 0 times; (a) 3 times, the Sound window |

Not run with (b): tier 2 of the suite. run-tests.mjs:75-76 has the GM draw every window (`__dialogWindows`) and the
players sit still (`__dialogAuto = false`) for the whole run, so no window of tier 2 takes the auto-answer path (b)
changes; the tiers 0-1 row above measures that reading: (b) was reached 0 times there.

**(b) also turns 0 red.** Both changes together are four lines in shim.mjs, and with the census they say the same
thing: on main today, no test or scenario depends on the harness answering "close".

### What they would buy

Neither finds anything on main. What they change is the next site: a caller that writes `if (action === "close")`
with work the null road does not do, or `if (!action) save()` as the planner line did, is green headless today on a
road a table never takes; with (a) and (b) the harness takes the table's road, and a test of that window goes red.
Cost: four lines in shim.mjs and no test changed. The planner's tier-2 autosave test presses Cancel as v14 would by
hand (da352a81, `win.app.close()` for a "close" action); with (a) it could click the button instead.

## 5. What this does not settle

- LIVE-E21-06 is still open: everything above rests on v14 closing on `data-action="close"` before DialogV2.
- With (a) and (b), a Close headless answers what it answers at a table only where a test presses it in a drawn
  window or lets the default answer; a test that queues an answer (`__dialogAnswers`) still gets what it queues. Of
  the 164 uses of `__dialogAnswers` in scripts/tests*.mjs and the scenarios, none queues "close" as a value, a
  function's return or an array's member (grep, 13.11.2026; tests-grid.mjs's `["close"]` steps are the murder's own
  close, not an answer).
- The DrpgApp gap of section 3 is left as it is.
