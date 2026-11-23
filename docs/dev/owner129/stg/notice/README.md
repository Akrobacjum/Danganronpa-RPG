# The end-of-hide notice in the corner (S0-HIDE, 1.2.128, 23.11.2026)

The notice a hide's end shows its player, on the tile every other notice of the module stands on. The owner's rule,
given through the coordinator: "notice o ujawnieniu niech bedzie w lewym dolnym rogu jak reszta powiadomien". Until this
round the end was a whisper card in the chat, raised in the corner by popup.mjs `onCreateChatMessage`; it is no longer a
chat message at all (hide.mjs `endHide`, `tellHideEnd`).

`notice-<en|pl>-<glass|legacy>-<w>x<h>.png` covers both languages, both themes and two sizes (1920x1080 and 1366x768),
at a device scale factor of 2, as a player's screen. Eight files.

## How they are made

`shoot.mjs` (from the repository's root; Playwright from `audit/harness`):

1. It opens `audit/glass-harness.html?role=player` (`&theme=legacy` for Monokuma Legacy) - the page whose
   `drpgNoticeCheck` glass-sweep.mjs uses to draw and measure the module's corner cards.
2. With no card up it runs `drpgNoticeCheck` itself: green in all eight.
3. It sets the page's `game.i18n` to `lang/<en|pl>.json` and takes the words from hide.mjs `hideEndNotice`, as the hider's
   browser reads them (the token's owner, not a GM; the time of day noon).
4. It posts them with popup.mjs `showPopup` as `tellHideEnd` does (`<p>words</p>`, kind "info"), with `record: false` so
   the page's notice history is not written, and takes the shot.

It prints one line a shot: the check, the card's title, the tile it stands on and its box.

## What they show, and what they do not

- **Stained Glass:** the card stands in the curtain's bottom-left pane, with the history button in its corner (card box
  19,731-371,1005 at 1920x1080; 19,407-352,698 at 1366x768, in CSS px).
- **Monokuma Legacy:** the card stands under the clock, top centre, not bottom-left. That is where this theme puts every
  notice on a desk: the whole tile `#drpg-popups` stands under the clock (danganronpa.css, E81 C10, the owner's Q6 of
  07.10.2026). So under Legacy "like the rest of the notices" holds, and "bottom-left" does not. Moving the tile under
  Legacy would move every notice; this line did not do that.
- **The "Advance the clock" window** and the rest of the screen are the glass harness's static markup, not a live table.
- **The language:** the notice is now written on the hider's own browser, so a Polish player reads Polish whatever the
  GM's language (before, the whisper card was written in the GM's).
- **Not drawn here:** the notice at a real table on v14, and its row in the Notice history window. The history row is
  written by `showPopup`'s `recordNotice`, the road scenario 73 reads for the module's other notices; no test reads it
  for this one. At a table it is LIVE-129-STG-09 (proposed).
