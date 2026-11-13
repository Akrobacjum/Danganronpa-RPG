# A project's token wears its chosen glyph - STATUS

Work line project-token-icon, from origin/main 421f2395 (1.2.109), 13.11.2026. Target 1.2.111.

## The ask

The owner's choice B of 13.11.2026 (about 01:55 CET, through the coordinator): a project's token on the map wears the
project's chosen glyph - the PROJECT_GLYPHS glyph a GM picks, the one the tray paints - for every project, public and
secret, in place of the neutral hammer (`PROJECT_TOKEN.icon`, icons/remnant-project.svg) every token wore since
22.09. A project with no glyph keeps the hammer. The tint, the done tint, the full opacity and the isometric scale stay
as they were.

## The trade-off, accepted on 13.11.2026

A token document reaches every browser on its scene, whatever its ownership or the module's visibility rules. With
this change its texture says which glyph the project carries, so a console reads the kind of project that stands in a
room - a secret one's included, and a public one a player has not discovered yet. Who SEES the token on the canvas is
unchanged (`knowsProject`, visibility.mjs).

What it adds, measured by reading the code (not at a table): no fact a console did not already hold. The glyph is
stored in projectMeta (projects-secrecy.mjs `metaFor`, its open half), a world setting every browser holds; it is not
one of `PROJECT_SECRET_FIELDS`. The token is a second, easier place to read it. The owner accepted this as a choice;
the GM handbook says so in "What every browser holds anyway" (English and Polish).

## What changed

| Where | What |
| --- | --- |
| tools/token-icons.mjs | also writes icons/project-<key>.svg for every key of config.mjs PROJECT_GLYPHS, from the sprite the tray paints (`--drpg-pix-<key>`, the first match in styles/pixel-icons.css: the :root drawing, Monokuma Legacy's, as the Remnants' token pictures). White, tinted by the document. |
| icons/project-*.svg | 21 files, written by that tool. Its run also rewrote the nine icons/remnant-*.svg in its own path spelling; those were put back (not this line's change; the same pixels per the tool's header, not measured here). |
| scripts/projects-map.mjs | `projectTokenIcon(countdownId)`: the glyph's file, or the hammer for none. `placeProjectToken` places the token with it. `refreshProjectToken` moves a token wearing the picture the module last wrote on it (its flag `projectIconWritten`, set at placement and at each move), the hammer or the pre-1.2.53 hazard sign to its project's on the next sync - so also when a GM changes the glyph, whose change ends in the sync; a picture a GM put on the token stays, one of the glyph files among them (the review's fix, below). The file's header no longer says the token carries a neutral image. |
| scripts/config.mjs | `PROJECT_TOKEN.icon`'s note: the picture of a project with no glyph. |
| docs/handbooks/gm-handbook.en.md, .pl.md | section 11's token line, and the trade-off in "What every browser holds anyway". |

## Proof

- Tier 2, "a project's token wears the glyph its GM chose, follows a new one, and keeps the hammer with none or a GM's
  own picture": red on 421f2395's projects-map.mjs (placed and changed read the hammer), green after.
- Tier 2, "a project token placed before glyphs, wearing the hammer or the hazard sign, takes its project's glyph at
  the next sync": red on the old projects-map.mjs (the hammer stayed; the hazard sign became the hammer), green after.
- Tier 1, R4700: every glyph has its file, holding the tray's sprite path; a project with no glyph wears the hammer.
  Red with the files moved away (21 of 21 "no picture"), green with them. A planted wrong path reads as stale.
- A stand-in sheet (the screenshots sent to the coordinator; not in the repository): every picture tinted working
  and done as Foundry multiplies the white file, beside the tray's drawing under each theme.

## What is not measured, and one difference

- Not drawn on a real Foundry canvas: the harness has no canvas. The pictures are the same white-file shape as the
  hammer and the Remnants' pictures, which a table has shown; a live look at a project token is still worth one glance.
- Under Stained Glass the tray draws 11 of the 21 glyphs with the glass's own drawing (pixel-icons.css holds each
  twice); the token wears the :root drawing in both themes, as the Remnant tokens do, since a texture is one file
  for every browser. On the stand-in sheet the two differ visibly for checklist, gear, box, scales, broom, wand,
  lock, envelope, chain, brain and gift.

## The review's three minors (REVIEW-111 section 1, 13.11.2026)

- **A GM's own picture that is a glyph file was taken back.** The sync read any `icons/project-<glyph>.svg` as the
  module's; it now moves only the picture the module wrote (the token's flag `projectIconWritten`), the hammer or the
  hazard sign. The tier-2 test above gained the step: the lock put on by hand, the glyph changed to the box, the lock
  stays. Red before the fix (the token read the box), green after.
- **The tier-2 test put a picture that does not exist on a token.** It is `icons/svg/mystery-man.svg` now, a picture
  Foundry ships, so the local gate's tier 2 asks the server for no missing file. No glyph or hazard rule matches it.
- **The `icons` check had no control for an empty set.** `iconProblems` says "no token picture to compare" when the
  generator read no source, and the check part hands it an empty set each run and is red unless it says so. Red with
  the control and without the fix ("the empty set NOT reported"), green with both.

