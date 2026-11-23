# The end-of-hide notice (S0-HIDE, 1.2.128, 23.11.2026)

The card a hide's end at the time of day sends its player. The owner's rule, given through the coordinator: "ukryj sie ma
dzialac do konca pory dnia".

`notice-<en|pl>-<glass|legacy>-<w>x<h>.png` covers both languages, both themes and two sizes (1920x1080 and 1366x768),
at a device scale factor of 2. Eight files.

## How they are made

1. `audit/harness/probes/129-hide-notice.mjs`, run with `node cluster.mjs probes/129-hide-notice.mjs` in `audit/harness`.
   - The primary hides p1's Aiko through the bridge's own run (`handleHideStart`).
   - Her row is given the mark of this day's noon.
   - The primary's settle ends the hide, and the module whispers p1 the card.
   - p1's drawn card (`ChatMessage#renderHTML` on p1's page, the secret words in) is kept in `capture/`.
   - It does this once with the GM's and p1's pages in English and once in Polish. The probe sets the time of day's
     names from the same language file, because config.mjs puts them in the page's language once, at load.
2. `shoot.mjs` (from the repository's root) draws each capture on `notice-shots.html` in Chromium, under the module's
   stylesheets, in a chat column on the right.

## What they are not

- **The column** is this page's, not Foundry's chat sidebar, whose own stylesheet is not here.
- **The broken portrait** beside "GM" is Foundry's `icons/svg/mystery-man.svg`, which this page does not serve.
- **The glyph:** under Stained Glass the card's header wears the Infiltrate tile's glyph. Under Monokuma Legacy no glyph
  shows. Whether that is Legacy's card look or a missing drawing is not settled here: no Legacy card from another line
  was put beside it.
- **The language:** the card is written in the GM's language, as every card a GM's browser writes. A Polish player with
  an English GM reads "Noon".
