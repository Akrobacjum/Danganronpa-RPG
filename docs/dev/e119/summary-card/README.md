# The time-of-day summary card, as shots (1.2.119, 20.11.2026)

The owner asked to see the summary card (scripts/day-summary.mjs `showDaySummary`, title `DRPG.Summary.title`,
"Podsumowanie pory dnia"). No shot of it existed. These are read-only shots of main b5a29e73; nothing under scripts/
or styles/ changed.

## The files

1366x768, deviceScaleFactor 1, Chromium. Each pair is the whole screen (where the card stands) and the card alone (`-card`).

| File | Language | Theme | Who |
| --- | --- | --- | --- |
| `summary-pl-glass-player.png`, `-card.png` | Polish | Stained Glass | a player (Aiko's own rows) |
| `summary-pl-glass-gm.png`, `-card.png` | Polish | Stained Glass | a GM (every student's rows, with names) |
| `summary-pl-legacy-player.png`, `-card.png` | Polish | Monokuma Legacy | a player |
| `summary-pl-legacy-gm.png`, `-card.png` | Polish | Monokuma Legacy | a GM |
| `summary-en-glass-gm.png`, `-card.png` | English | Stained Glass | a GM, for comparison |
| `summary-en-glass-player.png`, `-card.png` | English | Stained Glass | a player, for comparison |

The rows: Search in Kuchnia, 14, with a find ("znaleziono „Nóż kuchenny” (Tier 2)"); Observe in Biblioteka, 17; Analyze in
Biblioteka, 21, critical; Work on Project in Warsztat, 12, a Remnant left; Listen in Korytarz, 11. The GM's card has six
rows over three students (Aiko, Botan, Chie), with a Sabotage in Stołówka, 9, a Remnant left. The room names are the
GM's own words, so they stay Polish in the English shots.

## How they were made

1. **The card's words and markup, real.** In the headless harness (audit/harness, jsdom), on the GM and on p1, the
   module's language set (`language` setting, i18n.mjs `applyModuleLanguage`). Each client's own store of card facts
   (the client setting `secretCards`) was planted with the rows above. Then the module's own `showDaySummary` drew the
   card, and `#drpg-evidence` (the centred stage a `centre: true` popup goes to, popup.mjs `evidenceStage`) was kept
   as HTML. The store and the language were put back. English was taken first: a page set to Polish keeps its Polish
   strings until it reloads.
2. **The drawing.** audit/glass-harness.html in Chromium (`?role=player` for a player, `?theme=legacy` for Legacy), served
   from the repository's root. The harness's stand-in dialog was hidden, the captured `#drpg-evidence` put into the page,
   the curtain refreshed, and the shot taken 3.5 s later, after the rows' entrance.

The two scripts were kept outside the repository; this branch carries the shots only.

## What was read on the shots

- Every row whole: no row's content wider than the row, and the card's body does not scroll (6 shots).
- Every row opaque at the shot: the entrance is over.
- No page error.
- The Polish counts read right: "6 akcji · 1 znalezisko · 2 pozostawione Remnanty" (GM) and "5 akcji · 1 znalezisko · 1
  pozostawiony Remnant" (player).

## What may look wrong (listed, not fixed)

1. **Small type in the rows, Stained Glass.** At 1366x768 the room, the total and the lede are set small: about 9-10 px
   by eye on the shot. Legacy's are larger.
2. **The card covers the HUD, Monokuma Legacy.** The centred card stands over the Projects tray's second row ("…ison
   the tea") and the room tile's right edge ("You can work a projec…"). It is raised over the windows on purpose (popup.mjs
   `is-raised`) and is closed by its own button, but the overlap is visible.
3. **No close button in Legacy's title bar.** The X is a Font Awesome glyph (`fa-xmark`), and the glass harness loads
   no Font Awesome; the Stained Glass shots show one. Most likely the page, not the module. Not checked at a table.
4. **"Krytyk"** alone for a critical in Polish (`DRPG.Action.critical`), where the English reads "Critical". Read, not
   judged.

## What these shots are not

- Not Foundry. The glass harness stubs Foundry, and its own HUD, trays and tiles are in English (its i18n is a stub);
  only the card is the module's words.
- No map, and not the table's fonts if they differ from the page's.
- Not a real time of day's end: the rows were planted, not played.
