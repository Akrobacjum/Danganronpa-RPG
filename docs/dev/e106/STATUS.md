# E106 - the Monocub's token: smaller, and no sheet on double-click (bug)

The owner's report, 13.11.2026, on 1.2.110 at the table: "Token monocuba jest mniejszy niz oryginalny token oraz nie
pozwala odpalic karty postaci (przynajmniej z poziomu GMa). Poprawmy to." - (1) the Monocub's token is smaller than the
student's own token; (2) double-clicking it does not open the character sheet, at least for the GM.

Built on the e72 line after merging origin/main (v1.2.110, 44f9d690). R5400-R5402.

## What was measured, and where

### On 1.2.110 (origin/main), headless, a probe not committed

A tier-2 probe on a worktree of origin/main: Aiko killed in public (chapter.mjs `killCharacter`), then made a Monocub
(monocub.mjs `setMonocub`), her token and her body tile read at each step.

| Read | Before the death | Dead | A Monocub |
| --- | --- | --- | --- |
| token id | TOKAIKO000000000 | same | same |
| actorId, actorLink | ACTORAIKO0000000, true | same | same |
| width, height (squares) | 1, 1 | 1, 1 | 1, 1 |
| texture.src | mystery-man.svg | same | same |
| ring | none | none | none |
| statuses | none | dead | dead |
| tokens of the student | 1 | 1 | 1 |

The body tile (body-tile.mjs `leaveBody`, from chapter.mjs `markDeceased`, chapter.mjs:185): 100 x 100 px, at x 300,
y 300 - the token's own corner - same picture, not hidden. The module's sheet hook (`renderCharacterSheet`) drew the
Monocub's panel (`drpg-monocub-panel`) on Aiko's sheet, no error.

So on 1.2.110 the module does not change the Monocub's token's size, picture, link or actor, and does not swap it
(git grep: no token create, delete or texture/size write in monocub.mjs, chapter.mjs, states.mjs, body-tile.mjs,
cleanup.mjs; no module patch of a token's click or double-click). `setMonocub` (monocub.mjs:138) writes the flag
(monocub.mjs:167), clears Hope and the tracks, and lays nothing.

### What the module does lay at that spot (read off the code)

- **The body tile** (body-tile.mjs:73 `bodyTileSpec`): the token's corner, its squares in pixels and **the picture's
  file alone** (body-tile.mjs:81 `texture: { src }`) - not the token's texture scale, fit, anchor or Foundry's ring. A
  tile stretches its picture over its whole rectangle; a token draws it at its texture scale, fitted (`contain` by
  default), and inside the ring when the ring is on. So wherever the student's token had a scale over 1, the ring, or a
  picture that is not square, the tile shows **the same picture at another size** than the token beside it.
- **The death sign and caption** over the tile (body-tile.mjs `drawBodyMark`), a child of the Tile placeable, at 0.6
  of the side, 0.85 alpha. Every other drawing the module lays on the map takes no pointer (`eventMode = "none"`:
  gm-overlay.mjs, own-ring.mjs, remnant-ring.mjs); the mark was the one that did not set it.
- **Foundry's `dead` overlay** stays on the Monocub's token (chapter.mjs:174; states.mjs: a Monocub is dead by
  definition). Not new in E106.

### On the e72 line (E62 C3b, going into 1.2.112), headless, scenario 94

From E62 C3b the Monocub walks a different token: the Spectator's, re-linked to the student (spectator-dead.mjs:251
`watcherBecomesMonocub`, the update at :258). Until E106 that token was made (`ensureDeadSpectator`) with the body's
token's squares and **the picture's file alone**, on its token and its prototype. Measured in scenario 94 with Chie's
token at texture scale 1.4, fit `cover`, ring on (subject scale 1.1), the fix taken out:

    the Monocub's token  [1, 1, null, null, null, null, null]      (width, height, scaleX, scaleY, fit, ring, subject scale)
    the body's token     [1, 1, 1.4, 1.4, "cover", true, 1.1]

That is the owner's symptom (1), measured: on 1.2.112 as built before E106, a Monocub whose student was drawn at a scale
over 1, or in the ring, comes back **smaller**. With the fix both read `[1, 1, 1.4, 1.4, "cover", true, 1.1]`.

## The root cause

**Measured (e72 line):** spectator-dead.mjs `ensureDeadSpectator` built the Spectator's token - from E62 C3b the
Monocub's - from the picture's file alone, so it lost the student's texture scale, fit and ring. Fixed (below).

**Not measured (1.2.110, the build the owner played):** the Monocub keeps the student's own token, unchanged, so the
module cannot have made *that token* smaller. What the GM sees at the spot is two things with the student's picture:
the token, and the body tile laid at the token's corner, the picture stretched over the whole square (no scale, no fit,
no ring), with a death sign at 0.6 of its side. Hypothesis (a) is the most likely reading of both symptoms: the GM
compares the token with the tile (the tile's picture, stretched, reads larger) and double-clicks the tile, or a spot
where the tile's mark is the top object, and a Tile opens no character sheet. That depends on how Foundry v14 orders a
Tile placeable's children against a token and routes a double-click on the tokens layer, which was not read (no v14
source here, no canvas headless): LIVE-E95-01 items (2) and (3), and the new LIVE-E106-01 (AUDIT 9.2 item 508), which
carries a console line that settles it in a minute at the table.

Hypotheses ruled out headless on 1.2.110: (b) the module does not change the token's width, height, texture or ring,
does not swap it and does not break its link. (c) the module's overlays take no pointer, except the body mark (fixed,
R5402) and `markLocalDeath` (incident-store.mjs, a player's browser only, a sprite at 0.8 for a death this player knows
and the table does not - not the GM's case). Not measurable headless: Daggerheart's own sheet opening on v14 (the
harness's sheet is a stand-in that fires no render hook).

## What E106 changes

1. **The Spectator's (and so the Monocub's) token wears the body's token's look** - spectator-dead.mjs `tokenLookOf`
   (:94): the whole texture, the squares, rotation, alpha, ring and rotation lock, as a copy; `ensureDeadSpectator`
   spreads it on the watcher's prototype (:147) and on its token (:159), the picture as before. The trial hall copies
   the same fields (trial-scene.mjs:508 `HALL_TOKEN_LOOK`). Tier 1 R5400 (the look), R5401 (the source of
   `ensureDeadSpectator`); scenario 94's new check "look: ..." (red with the fix taken out, above).
2. **The body tile's mark takes no click** - body-tile.mjs:396, `eventMode = "none"`, no interactive child, as every
   other drawing the module lays on the map. Tier 1 R5402. Whatever v14 does with a tile's children, the sign over a
   Monocub standing on its own body no longer stands between the GM's double-click and the token.

Not changed: the body tile's picture, size or behaviour. The coordinator's brief: a tile that confuses is said and
proposed, not changed silently.

## Proposal (default, the owner to confirm): make the body and the Monocub tell apart

**P1 (default).** The body tile shows the student's picture **in grey** (the tile's `texture.tint` a mid grey, or a
grayscale filter on the tile's mesh), the death sign and caption as now; the Monocub's token keeps the student's colour.
The two pictures then never read as one student twice.

**P2 (with P1 or alone).** The tile is drawn with the token's own look (`tokenLookOf`'s texture scale, fit and anchor)
so that, where the body lies, it is the size the student's token was - the "smaller" reading goes away whichever of the
two the GM compares.

**P3 (optional).** A double-click on a body tile, on a GM's browser and its owner's, opens the dead student's sheet,
as the token did. Changes the tile's click on v14 (`Tile#_onClickLeft2`, not read): only with the owner's yes and a live
check.

**Q-E106-1 for the owner:** P1 alone, P1 + P2, or none of them; P3 yes or no.

## Numbers

- Tier 1 R5400, R5401, R5402: red before the fix (no `tokenLookOf`; the prototype and the token without the look;
  the mark's `eventMode` "auto"), green after; R3144 still green.
- Scenario 94: 17/17 (16 before E106 and the new look check); with spectator-dead.mjs as before E106, 16/17 - the look
  check red, as measured above.
- Tiers 0-1 whole, the quick gate: in the commit message.
