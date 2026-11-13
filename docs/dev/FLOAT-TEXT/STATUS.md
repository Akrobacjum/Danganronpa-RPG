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

(readings below)

## What is open

- The actor sheet is not in the sweep: the style harness's sheet is the module's parts on a model of Daggerheart's, and
  the harness's sheet a stand-in. The biography and the Remnant card are read at a table.
- A real click, a window dragged while a field floats, and Foundry's own Escape handling with a field floating: at a
  table.
- Whether notifications must stay above a floating field (the owner's call, above).
