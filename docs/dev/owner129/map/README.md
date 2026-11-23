# Line MAP's screenshots for 1.2.128 (stage E129)

Each set is rendered in Chromium by Playwright at device scale factor 2, from the HTML file beside it, served from the
repository root (`python3 -m http.server`). None of them is Foundry's own canvas: the harness draws no board, and no
v14 table was at hand. What a real table shows is the LIVE-129-MAP items in the line's reports.

## S0-REMALPHA - a Remnant's alpha

`remalpha-{legacy,stained}-{1920x1080,1366x768}.png`, from `remalpha-sheet.html`.

- Every icon is the module's own SVG, tinted as Foundry tints it (a white icon multiplied by the tint, drawn here as a
  CSS mask filled with the tint), at the alpha its column names, on three stand-in floors (dark, mid, light).
- The blue frame marks what 1.2.128 draws. Columns marked "(x)" multiply alphas: estimates, not readings of v14.
- The themes change the module's interface, not the canvas, so the icons are the same in both; only the page differs.

## S0-HOVERNAME - a token's name on a hover

`hovername-{legacy,stained}-{en,pl}-{1920x1080,1366x768}.png`, from `hovername-sheet.html`.

- The map behind the labels is a stand-in: a floor, a grid and four tokens drawn with the module's icons.
- The labels are the module's own element, built as `scripts/hover-name.mjs` `showHoverName` builds it (the class
  `drpg-hover-name`, `aria-hidden`, the words by `textContent`, placed at the token's top centre), with the module's
  stylesheets in the order `module.json` loads them.
- A player's view: a character, a masked killer ("?"), a Remnant whose Truth Bullet the player holds, a project the
  player sees. In play one label shows at a time; the sheet shows all four at once.
- The page sets the body as settings.mjs `applyTheme` does by default: the theme's class and, under Monokuma Legacy, the
  pixel face's (`drpg-pixel-font`, its setting on by default). Until 23.11.2026 the sheet left that class out, and
  Legacy's label came out in Bahnschrift, not its own face; the files were not swapped. Legacy's face is DRPG Pixel,
  Stained Glass's is VT323 (`--drpg-font-chrome`), as its tooltip's.

## S0-HOVERNAME B - token names as captions

`caption-{legacy,stained}-{en,pl}-{1920x1080,1366x768}.png`, from `caption-sheet.html`, the same stand-in board.

- Each caption is drawn as `scripts/hover-name.mjs` `drawCaption` draws it with PIXI.Text, here on a 2D canvas as PIXI
  does: the face, colour and ground read off a probe `.drpg-hover-name` (`captionStyle`), the face loaded first, the
  keyline stroked then the words filled, `max(14, grid * 0.2)` px over a keyline of `max(3, grid * 0.05)`, its top
  centre `grid * 0.04` under the token. Not PIXI itself: no Foundry here.
- The caption is a child of the token, not of its picture, so a Remnant's 0.5 on a player's screen does not fade it.
- Since the owner's word of 23.11.2026 ("powiekszmy lekko napisy. Niech skaluja sie tez z interface scaling"): the
  caption is `max(18, grid * 0.25)` px over `max(4, grid * 0.0625)` (a quarter over the first draw), times the
  interface scale as each theme's type rides it (`captionScale`: Legacy `--drpg-legacy-scale`, Stained Glass
  `--drpg-type-scale`); the page sets both as `applyTheme` does, from `?ui=` (the slider) and the window's size.
  `caption-legacy-pl-1366x768-ui125.png` is the slider at 125%. Only the three caption files named below were redrawn
  at the new size: `caption-{stained,legacy}-pl-1920x1080.png` and that one; the other caption shots show the first
  size.
- The theme's own size (config.mjs `CAPTION_FACE`, the coordinator's default of 23.11.2026: under the glass the caption
  reads at least as large as Legacy's): Legacy 1, the glass 2.2. Measured on "Aoi Kirigaya" at 1920x1080 and 100%:
  Legacy's DRPG Pixel at 25 px, 300 px wide, x-height 19; the glass's VT323 at 47 px, 226 px wide, x-height 19 (21 px,
  101 wide and an x-height of 9 before). `caption-stained-pl-1920x1080.png` redrawn with it and
  `caption-stained-pl-1366x768-ui125.png` added (42 px there: grid 72, the glass's factor 1.06 at 125%).
