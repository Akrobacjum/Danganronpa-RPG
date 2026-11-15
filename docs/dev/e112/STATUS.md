# E112: the opening's veil, the mask's question mark, the Loaded Die on the opening

Line: `claude/e112-veil`, based on `main` at e9f4a791 (v1.2.115). Planned for 1.2.116 (`tools/stages.json`, with E83).
The owner's three requests of 15.11.2026, through the coordinator. R numbers R7405-R7406.

## Item 3 - a Loaded Die on the murder's opening

The owner: "loaded die nie zuzywa sie na otwarcie morderstwa (dziala, ale hope call nie jest wydany)".

**Measured before the fix** (tier 2 "E112 - an armed Loaded Die loads the murder's opening ...", on the base tree through
`DRPG_REPO`): a Loaded Die armed on a killer with a player, the opening thrown as `throwOpeningRoll` throws it, through the
roll window's glue, its packet judged as the player's. The packet named no Call and no Loaded Die mark; the GM's draw came
out 3 and 5, `used.loaded` false; the die stayed armed. Thrown on the GM's own browser (a killer whose player is away): no
Free Critical, the die still armed. So the die neither loaded nor was spent on either road. The owner's "it works" was not
reproduced; that the critical they saw was the dice's own is a guess, not a reading.

**Also measured on the base tree**: the GM's draw applied any armed Call a packet named, whatever the action
(roll-draw.mjs `appliedCalls`), so an opening's packet naming an armed Support got its die and spent it
(tier 2 "E112 - the GM's draw of an opening applies its Loaded Die alone ...": `[[support],1,false]`).

**The fix** (commit 8282b192), the owner's default through the coordinator: the opening is the murder's own roll, so an
armed Loaded Die applies to it and is spent once, given back where it did not hold; no other Call reaches it.
call-effects.mjs `SHIELD_PASSES`; action-pipeline.mjs `rollTrait`; roll-draw.mjs `appliedCalls`. Mutants 5/5 killed.

## Item 1 - the opening's veil

The owner: "gdy morderca rzuca, dopoki nie rzuci otwarcia, jego token powinien byc niewidzialny dla ofiary, a sam morderca
wyciszony. Dopiero po rzucie odslaniamy token". The owner's five answers are in mask-gm.mjs's header to the veil.

**As built** (mask-gm.mjs, the veil's section): the coordinator's design, with these readings of the code:

- *Where it begins.* A direct murder declared in an Eclipse opens at its lights (eclipse.mjs `judgePendingMurders`),
  after the Eclipse's flag has gone and every token is drawn again; and the lights may wait on a GM's window
  (`askAtTheLights`). So the veil goes up in `endEclipse` before the flag goes, for every killer the lights will judge
  (a row of `why: "lights"`), and is taken over by the opening or lifted when the lights have judged. A murder opened
  mid time of day (the GM's tile, a betrayal outside an Eclipse) is veiled from its open. The declaration in the dark
  needs nothing: an Eclipse hides every player's token from every other already.
- *Only on the primary.* The lights' veil is put up by the primary GM; when another GM ends the Eclipse, the killer is
  veiled at the open instead, a moment later (read off the code, not driven).
- *The accomplice.* "Seated with the killer at the opening" is read as the cast's third on the killers' side
  (`thirdSide: "killer"`, incident-store.mjs `killerIds`). At a fresh open no third sits there, so in practice the veil
  hides the killer alone; a third who takes the killers' side while the opening still waits is veiled from then.
- *A closed roll window is no road out.* The opening is not optional (`throwOpeningRoll` offers it again, the tracker asks
  again), so the veil stands until the roll is thrown or the incident closes. The coordinator's brief listed it as a road
  out; the code says otherwise, and the default taken is to keep the veil (a question below).
- *The microphone.* The trial's block with one more reason (`veilMutedIds`), outside the Class Trial, as the mask's; no
  silent room, so the killer still hears the room. The killer's own tile says why (`DRPG.Voice.held.veiled`).
- *The Spectators* do not see a veiled token (Foundry's `hidden`; the module shows it only to the owner and the killers'
  side). A default; the mask lets a Spectator see the name.

**What it cannot hide**: a token's `hidden` reaches every browser (known leak `foundry-hidden-tokens`); and a hidden token is
drawn on its owner's browser by this module, not by Foundry, so whether the killer keeps their own vision is LIVE-E112-01.

**Measured**: R7405 (pure rules, the voice and visibility readings, the order mask -> stage -> veil, the sweeps); tier 2
"E112 - the opening veils ..." (roads A-F). Mutants: 11 run, 10 killed; "show refuses a hidden veiled token" survives -
the harness has no canvas (LIVE-E112-01).

## Item 2 - the mask's "?" on the map

The owner: "Morderca tez nie ma zastapionej ikony tokenu znakiem zapytania gdy jest ukryty - to dalej nie dziala. Nie chodzi
tylko o portret w karcie postaci - chodzi tez o ikone tokenu na mapie".

**Read before changing anything**: `maskPatch` set `texture.src` and `ring.subject.texture` to Foundry's mystery man
(a grey silhouette, no question mark) and left `actor.img`. The map's root cause waits on the owner's answers (the version,
whether the opening was on Hope or a critical - the mask opens only then - and what the map showed).

**Done meanwhile**:

- (a) icons/mask-unknown.svg, a "?" in the module's pixel manner (a light glyph and ring with a dark outline on a dark
  disc), the mask's token and ring picture (`MASK_IMG`). Read at 120 and 48 px on a light, a green, a dark and a black
  ground in Chromium (mask-unknown-grounds.png here), not on a map.
- (b) the portrait: `actor.img` wears the same picture while the mask stands, after the tokens; the actor's own picture
  and its prototype token's are kept on the mask's row and written back exactly (`portraitOf`, `portraitBack`). The
  killer's own sheet shows the "?" too while it stands.

**(c) Where a player sees the masked character's portrait or token art**:

| Surface | What it reads | Covered |
| --- | --- | --- |
| the token on the map | `texture.src` | yes, `maskPatch` |
| a v14 dynamic ring | `ring.subject.texture` | yes, `maskPatch` (owner-115 1b) |
| the nameplate and bars | `displayName`, `displayBars` | yes, never shown |
| the character sheet (Daggerheart) | `actor.img` | yes, (b); another player's open sheet closes (anonymity.mjs) |
| the Actors directory | `actor.img` | yes, (b), for players who can see the actor at all |
| the voice tile's face | camera-view.mjs `voiceIdentity`: `actor.img`, else the account's avatar | yes, (b); the masked killer is alone in a silent room, so no tile lists them |
| a drawn roll's card header | private-rolls.mjs `signAsRoller`: the subject's `img` | yes, (b) |
| the sequence boards | sequence.mjs `portraitOf`: `actor.img` | yes, (b) |
| Daggerheart's own chat cards | the actor's picture as Daggerheart writes it into the message | a card written while the mask stands reads (b); one written before keeps the face - not read in Daggerheart's source here |
| Foundry's combat tracker | the combatant's token or actor picture | yes, both masked, if a GM uses it (the module does not) |
| Isometric Perspective's occlusion silhouette | `token.mesh.texture` (occlusion.js `createOcclusionSprite`, v14.0.6) | partly: see below |
| a token's HUD, its drag preview | the token | the owner and GMs only |

**Isometric Perspective 14.0.6** (cloned from github.com/arlosmolten/isometric-perspective at 7122b36, read, not run): it sets
no token texture. Its occlusion layer (`enableOcclusionTokenSilhouette`, a client setting, "off" by default) empties
itself and builds a sprite from each token's `token.mesh.texture` on every `updateToken` and `refreshToken`, for every token
that intersects an occluding tile - with no test of the token's visibility, and drawn at 30% brightness, not hidden. So:
after the mask's texture write, the next refresh rebuilds it from the new texture (a frame of the old one between the
`updateToken` hook and Foundry's redraw is possible and not measured); and with the setting on, a token this module hides
(another room, an Eclipse, the veil) still shows its silhouette behind an occluding tile. That is the module's limit with
that setting on, not fixed here: LIVE-E112-04.
