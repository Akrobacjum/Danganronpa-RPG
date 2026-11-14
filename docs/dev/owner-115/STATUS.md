# owner-115: bugs the owner reports from a real table while 1.2.115 is assembled

Line: `claude/owner-115`, based on the 1.2.115 assembly `claude/fervent-sagan-gme4vt` at e0ee06ef. R block R7400-R7429 (none
used yet: item 1's test is a scenario, which is named, not numbered).

## Item 1 - a masked killer's token icon reaches the victim

The owner, 14.11.2026, at a real table on 1.2.114: "Morderstwo bezposrednie przy rzucie na tajna tozsamosc - ikona tokenu
mordercy u ofiary powinna byc zamieniona na "?". Aktualnie tak nie jest co zdradza tosamosc mordercy."

**The roll in the code.** There is no roll named "secret identity". The owner's roll is the killer's opening roll of a
direct murder (murder-rules.mjs `resolveKillerOpening`, :666): succeeding on Hope or a critical opens the mask
(mask-gm.mjs `opensMask`; `maskKiller`, :147, E69 C8), which is what puts the killer behind a "?". An opening that
succeeds on Despair (Fear) opens no mask, by the owner's rule of 10.11 (c).

### What the victim's browser held while the mask stood (measured, scenario 21 at e0ee06ef, before the fix)

Chie (p3) kills Aiko (p1), the opening on Hope, Chie's portrait and token given pictures of their own. Read on p1 after a
fight of four turns (Aiko, Chie's Strike from p3's tile, Aiko, Chie's Finishing Blow ruled a miss):

| # | Surface | Where it was written | What p1 held | Fixed |
| --- | --- | --- | --- | --- |
| 1 | the crisis card's heading, its words (`secret.card`), the drawn message, the notice's title and the notice history | murder-rules.mjs `announceCrisis` (:4245, heading :4286) | "Strike - Chie Mori" | yes: `maskedName` (:4306) |
| 2 | a loss's line on the same card | murder-rules.mjs `landedNote` (:2585) | "Chie Mori loses 1 Sanity." | yes: `maskedName` |
| 3 | the drawn roll's `dice.show` packet | private-rolls.mjs `relayDrawnDice` (:1771) | `by: <p3's user id>` | yes: `maskSplit` (:1800) |
| 4 | Dice So Nice's throw of the killer's dice | private-rolls.mjs `showRelayedDice` (:1910), from `by` | played as p3's user (p3's own dice colours) | yes: played as the message's author, a GM |
| 5 | a statistic's `dice.show { subject }`, which heads Daggerheart's card with the character's portrait and name | private-rolls.mjs `relayDrawnDice`, `signAsRoller` (:1640) | not reached in the run (the fight throws actions, not statistics); same road as 3 | yes: no `subject` to a non-insider, by `maskSplit` |
| 6 | a Reroll's `dice.show { by, rewrite }` | private-rolls.mjs `relayRerolledDice` (:1854) | not reached in the run; same road as 3 | yes: `maskSplit` |

### The widening: every non-insider, not only the victim (the coordinator, 14.11.2026, the owner's words)

"Apropo znaku zapytania z perspektywy ofiary - to samo powinno byc przy osobach trzecich." Measured on p2 (Botan) while
the mask stood, in scenario 21:

| Where the bystander stands | What was read | Before | Fixed |
| --- | --- | --- | --- |
| far away (the Cafeteria) | the whole scan above | clean | - |
| next door: Listen's names for Dorm A, where Chie stands | action-listen.mjs `performListen` (:207 the critical's sweep, :216 the named tier), and its Reroll on the GM, reroll.mjs `listenLines` | "Aiko Hoshino, Chie Mori" | yes: `listenName` (action-listen.mjs:111), "?" for a masked character, read off the tokens the listener's browser holds |
| in the room: walked in, seated as the third | the cards (1, 2 above reach the third as well), the scan, and the third's own crisis menu | the cards named Chie, as for the victim | yes, by 1 and 2; the menu was clean (the third's cast copy holds no killer) |

Read in the code and left as it is, by the rule's source:

- **Spectators** keep what E92 gives them: mask-gm.mjs `drawMaskName` (:268) draws the character's own name over the "?" for
  a GM and a Spectator, by the coordinator's default of E69 C8 ("a Spectator sees through it, as it sees secret projects").
  A Spectator is in no incident's audience (`incidentAudienceIds`), so it is sent none of the fight's cards.
- **The trial's cast lists** name every living student, so they say nothing of who the killer is.
- **The body's discovery** names the victim and the finders (body.mjs `announceBody`), not the killer.
- **The voice next door** (eavesdrop): the masked killer is in a silent room of their own (voice.mjs `maskedRow`).
- **Observe and Analyze of the scene** read the traces, whose subject is the GMs' (world-secrets.mjs; 72-canary's
  `remnant.subject`), not a player's.

Not covered, and outside the fight (a question below): the module's social actions name their actors by name on their cards
and to onlookers - Frisk, Steal, Palm, Search's planted item (frisk.mjs:318 `tellOnlookers`, and the like). A masked killer
who frisks somebody while the mask stands (until the next time of day) is named to that player and the onlookers.

Read and found clean while masked (so no change): the chat documents' speaker, author, flags, content, system and rolls (every
incident card is veiled); the Event card; the cast copy (`killerId` null, incident-store.mjs `castCopyFor`, :586); the
victim's first whisper (`tellVictimTheIncidentBegan`, :642, "someone"); Chie's token on p1's and p2's map ("?", Foundry's
mystery man, the `masked` flag: mask-gm.mjs `maskPatch`, :66); the bystander's browser, all of it. Read in the code and not
leaking: the voice tile's portrait (camera-view.mjs `nameFor`, :243, the speaker's own actor only; the killer sits in a silent
room, voice.mjs `maskedRow`, :1149); the sheet (anonymity.mjs `maskedSheetClosed`, :161). The opening's own card
(`announceOpening`, :4326) goes to the GMs and the killers alone (D6), and now goes through `maskedName` as well.

Not covered, and by design, Foundry's limit (mask-gm.mjs's header): the token document keeps its `actorId`, and every browser
holds every actor, so a console still reaches the name.

### The fix

- mask-gm.mjs `maskInsiders(actorId, killers)` (:129): on a GM, null when no mask stands, else who sees through it - every GM
  and every player who owns the killer or an accomplice (the same rule the cast's copies keep).
- murder-rules.mjs `maskedName(actor, state)`: the name to the insiders and "?" (`MASK_NAME`, the mask's own glyph) to every
  other reader, through secret.mjs `youOrThem`, so each reader's browser is sent only its own line (`wordsFor`). Used by the
  crisis card's heading, the loss line and the opening card's heading. No mask: the escaped name, as before.
- private-rolls.mjs `maskSplit(message, recipients)`: a drawn roll's and a Reroll's `dice.show` goes to the insiders as before,
  and to the others with no `by` and no `subject`.
- action-listen.mjs `listenName(other)`: "?" for a masked character in Listen's lines, its Reroll's (reroll.mjs) the same.

### Numbers

| Run | Result |
| --- | --- |
| scenario 21, base e0ee06ef + the scenario alone (red first) | 7/9, the two checks of the victim's read red: words, drawn messages, notices, history named Chie; `dice.show` and Dice So Nice carried p3's id |
| scenario 21, with the fix | 9/9 |
| scenario 21 widened (next door, in the room), without the Listen change | 11/12: Listen named "Aiko Hoshino", "Chie Mori" |
| scenario 21 widened, with every change | 12/12 |
| `npm run quick` | green: lint 406 files 0 problems, check 24 parts, gate 37/37 |
| tier 1, at c1bae24f | 1687 passed, 0 failed, 16 skipped, 0 red |
| scenarios at c1bae24f | 21: 12/12; 13: 87/87; 33: 89/90, 0 failed, 1 expected red (foundry-cub-purse, a Foundry limit); 83: 111/111 |
| tier 2 `--only`, at c1bae24f | 17 passed, 0 failed: the incident's cards, a trap's last card, the third who leaves, the drawn dice and their audience, the drawn statistic read and headed, a Reroll's dice, E60-T16, E60-T21, E69-T7, E43-T1, a dice look put back |

### Needs a local Foundry

- **The map token at the opening.** The mask rewrites the killer's tokens on the GM (`maskPatch`: name "?", texture
  `icons/svg/mystery-man.svg`, ring off, name and bars hidden), and headless every browser's token document reads that
  (scenario 21). Whether a v14 canvas draws the "?" picture on the victim's screen at once is not measurable here (no
  canvas). Needs: Foundry v14 with Daggerheart, a GM and two players, a direct murder whose opening succeeds on Hope, read on
  the victim's screen. If it still shows the killer, the next question is the token ring's subject texture, which
  `maskPatch` does not touch: a token with the dynamic ring on might draw `ring.subject.texture`, not `texture.src`.
- **Daggerheart's own chat header.** The harness draws Daggerheart 2.10.5's header from a reading, not the real
  template (client-entry.mjs `renderHTML`). Needs: the same table, the killer throwing a statistic from the sheet during the
  fight, and the victim's chat log read: the card's portrait should be the mystery man and the name empty.
- **Dice So Nice.** That the killer's dice fall in the GM's colours on the victim's screen, not the killer's player's.

### Questions, with the default taken

- Q-OWN115-1. A masked killer's dice now fall in a GM's appearance on the victim's screen. The owner's note of 27.09
  ("nobody is shown 'the GM rolled'") pulls the other way; a player's own dice colours name them. **Default: the GM's
  appearance while the mask stands.**
- Q-OWN115-3. A masked killer's social actions outside the fight (Frisk, Steal, Palm) still name them on their cards and to
  onlookers until the mask ends. **Default: out of item 1, which is the incident; a separate item if the owner wants the
  mask over them too.**
- Q-OWN115-2. The opening on Fear (Despair band) succeeds and opens no mask (the owner's 10.11 (c)). If the owner's roll at
  the table was one of those, the icon showing is the rule, not a bug. **Default: the rule stands; no change.**

## Item 2 - a character's token always drawn over a Remnant

The owner, 14.11.2026, at a real table on 1.2.114: "Gdy token postaci jest w tym samym miejscu co remnant, postac zawsze
niech bedzie na wierzchu."

### What decides the order, and why a Remnant could end on top

| Source | What it says | Read where |
| --- | --- | --- |
| Foundry v14 | the primary group orders what it draws by elevation, then `sortLayer`, then `sort`, then `zIndex`; the layers are SCENE 0, TILES 500, DRAWINGS 600, TOKENS 700, WEATHER 1000 | fvtt-types 14.370.0-beta.20261107215328 (npm `fvtt-types`): `primary/primary-canvas-object.d.mts`:26-52, `groups/primary.d.mts`:256-263. These are types, not v14's source, which is not on this machine |
| The module | a Remnant is created with `sort: -10` (remnants.mjs:507) and a project token with `sort: -5` (config.mjs:3111 `PROJECT_TOKEN.sort`), meant as "below characters" | this repository |
| Isometric Perspective 14.0.6 (the release zip of 14.11.2026; the harness pins 14.0.2, not read) | installs a token mixin at `init` on every scene (main.js:336-340), whose `applyRenderFlags` runs `applyDepthSort` on every token's render flags; that writes every TOKENS-layer mesh's `sort`, and the token document's `sort` on that browser, to its rank by depth on the screen (autosorting.js:74-81), ties broken by document id (`sortByDepth`, :263-270) | the zip, read only, not run |

So the module's `sort` was overwritten on every browser, and a Remnant on a character's spot fell above or below it by
their ids. Not read: Foundry's own Token class (whether it sets the mesh's `sortLayer` once or on every refresh), and
Daggerheart's token class.

### The fix

remnant-ring.mjs `keepUnderCharacters` (with `traceLayer`), called from the `refreshToken` paint that already tells a
Remnant or a project token from the rest: the trace's mesh goes to sort layer TOKENS - 1 (699). That is under every
character, Monokuma and Monocub at its elevation, whatever their sorts, and still above tiles (500) and drawings (600).
Isometric Perspective depth-sorts only the TOKENS layer, so the traces leave its pass. Elevation is not touched (the
rooms are read off it). The primary group is asked to sort again only when the layer moved (counter
`remnantRing.layer`).

### Numbers

| Run | Result |
| --- | --- |
| R7400 (tier 1) before the change | FAIL: remnant-ring.mjs had no `keepUnderCharacters` |
| R7400 after | ok |
| quick at 7e5cb85e | RED, check part comments: two names of Isometric Perspective's code in backticks, which no code here holds; written plainly since, then green |
| tier 1 at 7e5cb85e | 1688 passed, 0 failed, 16 skipped, 0 red |
| scenario 86 at 7e5cb85e | 105/105; `remnantRing.layer` counted in none of its events (30 Remnants refreshed), so the layer is not set again on a refresh |
| a probe scenario, not kept (placeRemnant on the scene, then another player's step) | the Remnant's mesh on sort layer 699 on the GM's browser and p1's; `remnantRing.layer` 1 on each, still 1 after the step. Characters have no mesh in the harness, so the order against them is the table's (LIVE-OWN115-02) |

### Needs a local Foundry

LIVE-OWN115-02 (audit/AUDIT-1.2.42.md 9.2, row 548): on v14 with Isometric Perspective, on an isometric scene and a flat
one, both themes, a character on the exact spot of a Remnant and of a project token is drawn over them from every
direction of approach, after a reload, after selecting and deselecting, and after panning. Also:
- a trace in front of a wall tile that Isometric Perspective sorts should not vanish under it;
- `remnantRing.layer` should not count on every refresh. If it does, Foundry puts the layer back each refresh, and the
  re-sort is paid every time.

### Questions, with the default taken

- Q-OWN115-4. With the traces on their own layer, Isometric Perspective no longer sorts them against the tiles it sorts
  (those it lifts to the TOKENS layer). A floor trace in front of such a wall tile is drawn under it. **Default: accepted;
  a trace lies on the floor, and the owner's rule is about characters. LIVE-OWN115-02 looks at it.**
