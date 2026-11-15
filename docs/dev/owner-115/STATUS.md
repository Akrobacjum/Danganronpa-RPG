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

## Item 3 - the Event panel never scrolls

The owner, 14.11.2026, at a real table on 1.2.114: "Na karcie eventu pojawil sie scroll w trakcie morderstwa. Na karcie
eventu nigdy nie powinno byc scrolla."

### What scrolled, and where

The panel had one cap a theme and scrolled past it by design: `--drpg-events-h` as a `max-height`, with `overflow-y:
auto` (styles/danganronpa.css `#drpg-events`, 192 px under Monokuma Legacy; styles/stained-glass.css, 316 px x the
glass's scale; styles/narrow.css, 272 px stacked; E23 C3b, E49 A6). The panel took the wheel only while it scrolled
(`data-drpg-scrolls`, events.mjs `markEventsScrolls`, R1430).

audit/events-murder-fit.mjs (new) draws the panels a murder puts up, built from the language files with long sample names:
- victim: the fight, the Overflow, a motive
- killer: the fight, the Overflow, a motive, a Monocub's card
- gm: the fight, a body, the Overflow, an assembly, a motive
- opening: the opening's card, the Overflow, a motive
- safeword: a safeword, the fight, the Overflow, a motive

Each is drawn in both themes, English and Polish, at 1280x720, 1366x768 and 1920x1080: 60 panels in all. At e0ee06ef,
**60 of 60 scrolled**: 454-803 px of cards in Legacy's 192, and 627-1086 in the glass's 269.

### The fix (the coordinator's default, in its order)

1. A card shows its whole text: no card scrolls or is cut.
2. The panel has no cap and nothing in it scrolls. It is as tall as its cards up to the room under it (events.mjs
   `eventsRoom`): to the screen's bottom, or to the top of another block below it, 8 px clear. The blocks counted are
   those the curtain lays out (`EVENTS_BELOW`: the HUD, the tiles' row, the three, the tray, the notices, the room tile,
   the voice tile, the corner launchers) and Foundry's hotbar.
   - A block that only brushes the panel's edge by 24 px or less is beside it, not under it. Under Legacy at 1280x720 the
     left column overlaps the panel by 12 px, and did so at the old cap too.
   - The room tile's picture is not counted: the curtain stretches it into whatever space the panel leaves.
3. Past that room, cards fold to their title, from the last up (`fitEvents`; the panel's order is its priority, safeword
   first). The first card, or the one the reader opened, always stays open. Titles that still do not fit are left out
   from the last up, and counted under the panel as "+N". A folded card is a button: a click, Enter or Space opens it,
   and the others fold as the room needs (`wireEventsPanel`).
4. The panel is fitted on every render and by its ResizeObserver (R1430's two roads).

The glass harness's `drpgEventCheck` now holds this rule: no cap, nothing styled to scroll, nothing over its box. Its
"fixed" control is held at 600 px, since the cap token is gone.

### Numbers

| Run | Result |
| --- | --- |
| events-murder-fit at e0ee06ef (before) | 60/60 FAIL: every panel scrolled |
| events-murder-fit, the first fit | 60/60 ok, but the screenshot showed the panel over the room tile: the obstacle list held only the launchers and the HUD |
| events-murder-fit with every block counted | 50/60: Legacy at 1280x720 read room 49 px (the 12 px strip of the left column counted as under the panel) |
| events-murder-fit with strips of 24 px or less as beside | 60/60, but under glass at 1366x768 the GM's panel folded every card, the first too: the room tile's picture was counted, and stretched to 175 px under the unfitted panel |
| without the picture; the first card always open, titles left out as "+N" | 58/60: the "+N" line, set after the loop, added 24 px past the room (1280x720 glass, the GM's) |
| the count set as each title goes | **60/60** |
| R7401 (new) | FAIL before (no cap rule held, no `fitEvents`), ok after |
| R1394, R1430 | changed on purpose: they held the cap and the scroll marker (R1430 now reads the fit, with a stand-in second card, since the first card never folds) |
| quick at fb6f664b | RED, check part registry: R7401 reworded after its row was written; written again at 779026ce, green |
| tier 1 at fb6f664b | 1689 passed, 0 failed, 16 skipped, 0 red |
| `glass-sweep.mjs --events` at fb6f664b | EVENTS GREEN: 2 themes, 2 roles, 5 sizes, 2 controls |
| `glass-sweep.mjs` whole at 779026ce | SWEEP GREEN: 2 themes x 2 roles x 25 sizes, 46 with glass, 0 failing; 2929 s (a first run at fb6f664b was cut by my own 2400 s timeout, no size failed before it) |

The pictures for the owner are in docs/dev/owner-115/shots/: `before-` and `after-event-panel-{gm,victim}-{glass,legacy}-1366x768.png`, at deviceScaleFactor 2.

### Needs a local Foundry

At a real table, both themes, at the owner's screen size, during a murder with several cards up:
- no scrollbar anywhere on the panel;
- a folded card opens on a click and on Enter;
- the panel does not cover Foundry's own hotbar or players list, nor the module's room tile, notices or voice tile.

The harness has no Foundry layout. Its hotbar is in the list but not in the glass harness, and Foundry's players list is
not counted.

### A window over the lengthened panel (the coordinator's note of 15.11 on the "after" pictures)

In the first "after" pictures the panel's lower part lay over the glass harness's own sample window, "Danganronpa - Advance
the clock" (audit/glass-harness.html:169, a fixed `.application` with no z-index of its own, :101). That window's text
showed through the glass panel's folded titles; under Legacy the panel covered it. At the old cap the panel ended above it.

What decides which is on top, as far as it can be read here:

| What | Where it stands | Read from |
| --- | --- | --- |
| `#drpg-events` | in `#ui-top`, inside Foundry's interface columns (`#interface` / `#ui-middle`), at `--z-index-app`, 30; the panel sets no z-index of its own | the module's sheets (danganronpa.css: "the interface's columns at `--z-index-app` (30)", about :17979; narrow.css :400-405) |
| Under Stained Glass, the glass drawn behind it | the curtain's layer, `--z-index-window` - 2 = 98 | danganronpa.css about :17975-17995 |
| A Foundry window, the module's own among them (the kit's DialogV2 and ApplicationV2, ui-kit.mjs) | raised from `--z-index-window`, 100: the first to 101 | the same note in danganronpa.css: "Foundry's window layer (`--z-index-window`, 100: the windows are raised from it, the first to 101)" |

So at a table an open window, the module's own included, should stand over the panel and take its own clicks. The
harness's sample window stood under the panel only because it has no z-index at all.

Not measured: the values 30 and 100 are the module's notes and the glass harness's reading of v14, not v14's source, which
is not on this machine. No window was opened over a lengthened panel in a real Foundry. LIVE-OWN115-03 (AUDIT 9.2, row
549) asks for it: "an open window over the lengthened panel: which is on top, and is the text readable".

The module's own windows sitting under the panel: not found in the sheets. No rule gives a module window a z-index under
the window layer, and none gives the panel or `#ui-top` one over it. **No change proposed until the table says
otherwise.**

The "after" pictures are taken again with the harness's sample windows hidden for the shot, a shot setting
(audit/events-murder-fit.mjs `--shots`): `after-...-clean.png` beside the first ones, which are kept.

### Questions, with the default taken

- Q-OWN115-5. A folded card is a button, the panel's one control. That goes against the rule of 10.11 ("the panel holds
  no control"). **Default: kept. Without it a folded card could not be read.**
- Q-OWN115-6. Where even the first card and the folded titles do not fit, the last titles are left out and counted as
  "+N" under the panel. There is no way to reach them until there is room. **Default: accepted. They are the
  lowest-priority cards; another choice would be a smaller font for the titles.**

## Item 1b - a masked killer is "?" to everyone not in on it, outside the fight too; and the ring

The coordinator's answer to Q-OWN115-3 (14.11.2026): "while the mask stands, the killer's identity is secret from everyone
not in on it ... Frisk, Steal, Palm, and any other card or onlooker line that names an actor"; and road (a): the dynamic
ring's subject texture.

### What leaked (measured, scenario 21's new phase "outside the fight")

The GM ends the incident and puts the mask back up (the mask outlives the incident). Botan then stands in Dorm A with
Chie and Aiko. p2 opens Palm; Chie steals from Botan (seen), then asks to frisk him.

- Palm's window on p2 listed "Chie Mori" among the people in the room. Six player-side pickers draw names this way:
  palm.mjs `choosePalm`, action-tail.mjs, action-tamper.mjs's frame, handover.mjs, call-pickers.mjs's room picker, and
  monocub.mjs's target rows.
- The Frisk's ask sent to the target's player named the searcher (frisk.mjs, `who: searcher.name`).
- Outside an incident, a card is not veiled: a Steal's and a Frisk's chat documents carried Chie's actor id and "Chie
  Mori" as their speaker on every browser.
- One of those cards was posted from p3's own browser, so its document named p3 as author on every browser, veiled or
  not.
- Any card's words naming the killer outside the fight (a Steal seen, onlooker lines) had no cut for the mask.
- The token's dynamic ring subject (`ring.subject.texture`, in v14's TokenDocument schema per fvtt-types 14.370
  client/documents/token.d.mts RingSubjectSchema) was not part of `maskPatch`.

### The fix

- mask-gm.mjs `maskPatch`, `lookOf` and `restorePatch` mask and restore `ring.subject.texture` (R7402; R6028 updated on
  purpose).
- mask-gm.mjs `namesHiddenFrom(userId)`: the masked tokens' characters that user does not own (none for a GM). It reads
  the token flag, so a player's browser that posts a card knows it too.
- secret.mjs `wordsFor` writes "?" for those names, in text and attributes, for that reader. It is the one cut every
  private card's words pass for each reader. A longer name that only starts the same is left alone. The masks hand it in
  at ready (`setNameMask`). secret.mjs cannot import mask-gm.mjs: gm-stores reaches secret through notice-history (R161).
  R7403.
- secret.mjs veils every card, and routes a player's card through the GM, while any mask stands (`standingMask`), as it
  already did while an incident runs.
- mask-gm.mjs `nameAsSeen` names a masked character "?" in the six pickers. The option's value is still the actor id,
  which is Foundry's limit, as with the token's `actorId`. R7404.
- frisk.mjs: the ask's `who` is "?" for a recipient outside the mask.
- Accomplices outside the fight read "?" too (`namesHiddenFrom` does not know them). Inside the fight's cards they read
  the name (`maskedName`).

### Numbers

| Run | Result |
| --- | --- |
| R7402, R7403 (tier 1) before | FAIL (no subject in the patch; no setNameMask) |
| R7402, R7403, R7404 after | ok; R6028 ok with its new field; R161 ok (no static cycle) |
| scenario 21 with the pickers, the ask and the cut, before the veil and the routing | 13/14: p1 and p2 held a Steal's and a Frisk's documents with Chie's actor id and name as speaker, and one authored by p3 |
| scenario 21, the veil added | 13/14: a veiled card authored by p3 left |
| scenario 21, the routing added | **14/14** |
| R7404 | written with the change: its red is the pickers' `a.name`, which it reads as gone, not measured on a tree without it |
| quick, tier 1, scenarios 13, 30, 40, 72, 83, tier 2 by name | in the item's report |

### Needs a local Foundry

LIVE-OWN115-01 covers it: at a table, with the mask standing after the fight, a Steal, a Frisk and the pickers on
another player's screen, and a token with the dynamic ring on.

### Questions, with the default taken

- Q-OWN115-7. An accomplice reads "?" for their partner on cards outside the fight. **Default: accepted. Only the
  killer's own players see through `namesHiddenFrom`.**
- Q-OWN115-8. While a mask stands, every player's private card is posted through the GM, as it is during an incident.
  A card waits for a GM to be connected. **Default: accepted. It is the incident's rule, kept for as long as a mask
  stands.**
