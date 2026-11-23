# S0-HIDE screenshots (line STG, 1.2.128, 23.11.2026)

The coordinator asked for three pictures, each in both themes, at 1920x1080 and 1366x768, at a device scale factor of 2.
One of the three could be made here; two could not.

## Made: the voice tile with Reveal yourself

`voice-tile-ujawnij-<theme>-<size>.png` is the tile alone, and `...-page.png` is the whole page around it. There are
eight files: `stained-glass` and `legacy`, each at `1920x1080` and `1366x768`.

- The page is `audit/glass-harness.html`, served from the repository and opened in the pre-installed Chromium through
  Playwright from `audit/harness`. The script is `shots.mjs` beside this file (`python3 -m http.server 8765` at the repository root first).
- The harness draws the voice tile as static markup. The script adds two things before each shot:
  - the Reveal yourself button, as `voice-tile.mjs` `paintUnhide` builds it: a mini launcher with the `averted-eyes`
    glyph, after the speaker button, named "Ujawnij się";
  - `is-held` on the microphone, the state `micHold` "hiding" draws.
- This is not the module drawing a live tile. In the headless cluster no voice tile stands without the LiveKit shim
  (scenario 22's note). The live button is read by R8905. A tile at a table is LIVE-129-STG-03.
- The tile's words are the harness's own, in English ("Speaking", "Aiko Hoshino"). The button's name shows only as a
  tooltip at a table.

**What the first round found.** The first shots used the `unseen` glyph. Under Monokuma Legacy it drew a blank white
square: `unseen` is declared for Stained Glass only, and `pixel-icons.css` says an undeclared mask draws a solid square.
`averted-eyes` is declared on `:root` for both themes, so both buttons now use it. Under Stained Glass that means
Legacy's drawing. A Stained Glass drawing for it would be the glyph map's work (tools/glyphs.json, generated), not this
line's.

## Not made: the map, from the hider's screen and from another player's

The pictures asked for are the hider's own view (their token at 0.4 with its frame) and another player's view of the
same room (no token, no frame).

- Neither can be made headless. The harness has no canvas, and `audit/glass-harness.html` draws no map.
- What is measured instead:
  - R8901: the verdicts ("show" for the owner, "hide" for every other player, null for a GM);
  - R8902: the alpha on a stand-in mesh (0.4 for the owner, 0.5 for a GM);
  - scenario 22-hide: both verdicts on the real browsers p1 and p2.
- The pictures are LIVE-129-STG-01 (proposed to the coordinator for AUDIT 9.2), for a v14 table in both themes.
