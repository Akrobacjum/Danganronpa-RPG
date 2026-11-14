# fix-113q: Take from the Body on the action window (A113-C5-7)

13.11.2026, on main ceb9e9c8 (1.2.112), for 1.2.113.

## What changed

- Take from the Body opens an action window on the module's one layout (action-menus.mjs `actionWindow`, E68 C12):
  the briefing on the left (what the Take rolls, that it costs no action, the room, the cover's Shadow at 16), and on
  the right the body's things as ticked rows (ui-columns.mjs `choiceRowHtml`, checkboxes, the first open row ticked)
  and **Take** (anonymity.mjs `openBodyLoot`).
- A row the one gate refuses (inventory.mjs `transferRefusal`, mode "loot") is greyed with the gate's sentence, and so
  is the Take. A row is also greyed on its own when the taker's hands hold the most of its kind and they have no stash
  (inventory.mjs `canCarry`; the GM's `transferItem` overflows into a stash and refuses only without one). With a stash
  the row is open and says the thing goes there. A piece that would join a stack the taker holds is left open: the GM
  judges it again.
- The open window reads the gate again on the hooks the sheet's list used (`regreyOpenLoot`: the taker's and the body's
  token, the clock, a body's announcement, the body's tile created, updated or deleted).
- The Take is the old road: the ticked items go to `takeFromBody` (one Hand roll, a Shadow with a witness, no action,
  gm-bridge.mjs `requestBodyLoot`, handover.mjs `lootBody`). The window closes when Take is pressed, as every action
  window does; opened again it reads the gate afresh.
- The body's sheet: the Inventory pane still lists what the body carries (picture and name), with no Take, no tick and
  no Take the ticked on it, and one button under the list, **Take from the Body**, which opens the window. The taker is
  read when the button is pressed, as the row's Take read it.
- Keys: `DRPG.Loot.takePicked` and `takePickedTooltip` removed (nothing draws them); `takeTooltip` reworded for the
  window's Take; new `windowTitle`, `open`, `openTooltip`, `prompt`, `brief`, `noAction`, `coverFact`, `toStash`,
  `rowHandsFull`, each in English and Polish.

## Measured

Chromium (`node audit/style-sweep.mjs --fit --only action-loot --only action-loot--long`), on probe 08's captures of
the window as p1 opens it on a body beside them, with 3 things (`action-loot`) and with 18 (`action-loot--long`):
20 readings of 2 pages (1920x1080, 1366x768, 1280x800, 1024x768, 390x844; both themes), 20 fit, 0 failed.

At 1366x768, read in the same pages:

| Page | Theme | Window (left, top, right, bottom) | Body width (scroll / client) | Body height (scroll / client) | Rows past the window's sides |
| --- | --- | --- | --- | --- | --- |
| action-loot | glass | 246, 0, 1366, 435 | 1086 / 1086 | 251 / 251 | 0 |
| action-loot | legacy | 246, 0, 1366, 356 | 1086 / 1086 | 221 / 221 | 0 |
| action-loot--long | glass | 246, 0, 1366, 752 | 1086 / 1086 | 1201 / 567 (scrolls down) | 0 |
| action-loot--long | legacy | 246, 0, 1366, 752 | 1086 / 1086 | 1009 / 616 (scrolls down) | 0 |

The page's own width is 1366 of 1366 in all four: no sideways scroll. Under the glass the frame's
`section.window-content` holds 1090 px in 1086 with `overflow-x: hidden` (no scroll bar); Observe and Tamper's windows
read the same 1090 / 1086, so it is the glass frame's, not this window's. The long list scrolls down inside the body;
the Take stays in the footer (glass 700-735, legacy 703-735).

The shots in `shots/` are the fit pass's own, at 1366x768. Under Legacy the rows' hand icon is not drawn: the capture
page has no Font Awesome (Foundry's stylesheet is absent there, probe 08's header), which Legacy's icons use. Not
measured: the window on a real Foundry v14 (its header, fonts and Font Awesome).
