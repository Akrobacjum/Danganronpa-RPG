# float-text: a text field that floats while it is edited

The line's notes (13.11.2026), not release notes. This line's branch, from `origin/main` at 1.2.109 (421f2395); target
1.2.111.

## The ask

The owner, 13.11 about 01:55: "okno na tekst po otworzeniu dopasowywalo sie do zawartosci i floatowalo, tzn by bylo
wierzchnia warstwa ktorej rozmiar jest niezalezny od reszty okna i rozmiar nie wplywa na reszte okna. Po zakonczeniu
edycji okno zmniejsza sie spowrotem do domyslnego rozmiaru ... dla kazdego pola tekstowego w module".

## What was built

`scripts/float-text.mjs` (new, a leaf with no import), registered in module.mjs's init hook:

- **Which fields**: every editable `<textarea>` in one of the module's windows (`.drpg-ui`, `.drpg-panel`,
  `.drpg-messenger`) or on an actor's sheet (`FLOAT_SCOPE`). Not a read-only or disabled one, not one marked
  `data-drpg-float="off"` (none is), not a single-line input, not a rich text editor, not Foundry's own windows, the chat
  box, the journal or an item sheet.
- **When**: from `focusin` to `focusout`, or Escape in the field (which also takes the focus away and goes no further, so
  the window is not closed by the same press; the next Escape is Foundry's).
- **How**: the field goes into the browser's top layer (Popover API, `popover="manual"`), so no window's `overflow`,
  `transform` or `backdrop-filter` clips or holds it, and it stays in its place in the page: its events still bubble
  through its window and form, a submit still reads it, every stylesheet rule written for it still matches. A hidden
  placeholder of its box (`.drpg-float-text-hold`, its margins and grid or flex place copied) holds its place. Its face
  is copied onto it inline while it floats (the top layer would otherwise give it the browser's own); a see-through
  field (the glass's fields are 55 % ink) is laid on an opaque ground, the theme's ink under light text and its bone
  under dark, so the window's text does not show through it.
- **Size**: its own width; the height its text needs, never below its own, at most 60 % of the screen, scrolling inside
  past that; its top on its own top, moved up only as far as the screen's bottom edge needs. It grows and shrinks as
  text is typed and deleted, follows its placeholder every frame (a window dragged or scrolled under it), and is let go
  when its window closes or redraws. 120 ms on the height, none under reduced motion.
- **Stacking**: the top layer stands over everything on the page, Foundry's notifications and the module's notice tile
  included, for as long as the field is edited. The coordinator's default was "above the window, below dialogs and
  notifications"; the top layer is the one place a window's glass cannot clip it (a `position: fixed` field inside a
  glass window's `.window-content` is placed and clipped by its backdrop filter), and it is the owner's "wierzchnia
  warstwa". A decision for the owner if notifications must stay above it.
- **One rule taken out**: `components.css`, the Key Remnants tab's `textarea:focus { min-height: 5.5rem }`. It grew the
  field in place on focus and pushed its row down: under Legacy the sweep read 31-99 elements of the window moved. The
  Remnants table's own fields (`min-height: 5.5rem`, not on focus) are unchanged.

## The survey

Every textarea the module draws, 37 in 21 files (R4672 holds this list to the source, comments stripped):

| File | Fields | Window |
| --- | --- | --- |
| action-menus.mjs | 2 | an action's request field (`requestFieldHtml`), a parked declaration's note (`promptForNote`) |
| action-search.mjs | 1 | Search's request (`chooseSearchCategory`) |
| call-gm.mjs | 1 | the request to the GM (`askForRequest`) |
| call-pickers.mjs | 3 | a Call's text (`pickText`), motive and consequence (`pickMotive`) |
| calls.mjs | 1 | a Call's note (`confirmCall`) |
| cleanup.mjs | 1 | a reshaped trace's text (`reshapeFields`) |
| gm-campaign.mjs | 1 | Edit campaign's morning line |
| gm-items.mjs | 4 | Give's description, a Truth Bullet's two texts, the autopsy's player text and GM note |
| investigation.mjs | 5 | the Remnants table's text and analysis, the Key tab's text and analysis, the case map's node text |
| messenger-app.mjs | 3 | the messenger's input and note, a GM's ruling reply |
| observe.mjs | 2 | a find's description and analysed text |
| projects-ui.mjs | 1 | a project's description |
| remnant-ring.mjs | 2 | the GM's Remnant card, drawn in the trace's actor sheet |
| room-setup.mjs | 1 | Room setup's description column |
| rules.mjs | 2 | the rules manager's rule and new rule |
| sheet.mjs | 1 | the character sheet's biography |
| tables-editor.mjs | 1 | Item tables' new item text |
| trial-floor-ui.mjs | 1 | the Reveal's text |
| trial-scene.mjs | 1 | the hall's words, Room setup's Scenes tab |
| trial.mjs | 2 | a Present's and an Objection's comment |
| verdict.mjs | 1 | the Blackened's rule |

All 37 are in a window the helper floats. The case planner's description fields (E97-98's) are on its branch, not on
main; they are in a module window and float once merged, with no change here.

## Measured

`node audit/float-sweep.mjs` (new; Chromium, the style harness's captured windows under the module's seven sheets,
1366x768, both themes, each field filled with a 1200-character Polish text, focused, read after the growth, blurred):

| Run | Windows | Field readings | Failing | What failed |
| --- | --- | --- | --- | --- |
| `--without` (no helper), English | 27 | 56 | 56 | every one `grows` alone (red) |
| with the helper, English | 27 | 56 | 0 | - |
| with the helper, Polish (probe 08 `DRPG_CAPTURE_LANG=pl` into the scratchpad, served at :8766 with `--windows --base`) | 33 | 66 | 0 | - |

Fields not shown as captured (in another tab, read in that tab's own capture, or `visibility: hidden` until a choice, as
an action's request field) are counted apart: 192 English, 330 Polish. Both controls read before each run: a 12 px block
at the top of the window's content, 122-123 elements moved; the placeholder collapsed, 123.

Found by the sweep on the way, and fixed:
- the Key tab's `textarea:focus { min-height: 5.5rem }` (above): 31-99 elements moved under Legacy;
- Legacy states a field's ground with `!important`, so the opaque ground written inline lost to it and the rows behind
  showed through the floating field (seen on a screenshot of Room setup's description, not by the numbers): every
  declaration the helper writes is now `important`, and the sweep checks the ground (`opaque`), red on the version
  before (Room setup's description, Legacy, every field);
- the sweep's own first reading took the window's boxes before `focus()` had scrolled it; it scrolls the field into view
  first now and focuses with `preventScroll`.

Shots (Polish, 1366x768, both themes, four windows before and after): a private page of the owner's account, linked in
the line's report to the coordinator, not here.

## The interactions (13.11.2026, the coordinator's second ask)

`node audit/float-sweep.mjs --interactions` (and after the fields in a whole run): on the project manager's description,
both themes, the window stood where Foundry stands one (`position: fixed` at its box). I1 a real click
(`page.mouse.click`), I2 the window dragged 80 px right and 50 down by its header while the field floats, I3 Escape in
the floating field with a listener on `window` (bubbling) that closes the window on Escape.

| Run | I1 click | I2 drag | I3 Escape |
| --- | --- | --- | --- |
| with the helper | ok both themes (63 -> 343 px glass, 58 -> 460 legacy, 0 moved) | ok both (window 80,50; 0 elements against it; the field on its placeholder; focused) | ok both (window open, field let go, own height) |
| `--without` | red: nothing floats | red | red: the window closed |
| `--disable follow` | ok | red: the field left 80,50 behind its place | ok |
| `--disable escape` | ok | ok | red: the window closed by the same press |

`registerFloatText({ follow, escape })` are the sweep's switches for those red runs; module.mjs passes neither (R4671
reads the call bare). Two models in it, each a check at a table: the drag is the page's own, a header pointer down with
its default prevented, so the field keeps the focus (whether Foundry's own drag keeps it is not known here: if it does
not, the field lets go at the drag's start, which is also no fault); and Foundry's Escape is modelled on `window` in the
bubbling phase, after the helper's capture listener (its phase on v14 is not read here). The whole run after these:
6 interactions and 56 field readings, 0 failing.

## What is open

- The actor sheet is not in the sweep: the style harness's sheet is the module's parts on a model of Daggerheart's, and
  the harness's sheet a stand-in. The biography and the Remnant card are read at a table.
- At a table: whether Foundry's own window drag keeps the field's focus, and the phase of Foundry's own Escape listener
  (the sweep models both, above).
- Whether notifications must stay above a floating field (the owner's call, above).

## Runs before the push (13.11.2026, this container)

- `npm run quick`: green.
- Tiers 0-1 in full: 1323 tests, 1308 passed, 0 failed, 16 skipped, 0 red, 422.5 s. A first full run had R309 red: it
  held the Key tab's `:focus` growth this line takes out; its reading now holds that no rule grows a Key box in place.
- 00-boot: 33/33.
- R4670-R4672 (tier 0) pass; R4671 and R4672 cannot run on main (no float-text.mjs), and the helper's behaviour is red
  first in Chromium (`--without`, 56 of 56), not in the suite: jsdom has no top layer and lays nothing out.
