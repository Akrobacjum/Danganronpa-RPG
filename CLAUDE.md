# Working in this repository

This file is for whoever is next in here, human or otherwise. It is not a tour
of the code - the code explains itself at length, and that is deliberate. It is
the short list of things that are easy to get wrong here and expensive to get
wrong twice.

## The one rule the rest follow from

**Measure, then say.** Nearly every long comment in this module ends in a
number, a date and often somebody's name, because nearly every one of them
replaced a plausible guess that turned out to be wrong. A claim in a commit
message, a code comment or a report is a claim somebody will rely on a year
later without re-checking it.

Two ways this has actually failed, both recently, both worth not repeating:

- A test can pass by measuring nothing. `stackShapes` was written, the
  self-check reported zero failures, and the reason was that the block list it
  checked was empty - a property was read under the wrong name. The screenshot
  found it; the numbers said everything was fine.
- A reason written on a bucket of known failures is not the same as a reason
  that was checked. Twelve tests failed on every headless run under the label
  "these need a real canvas". Four of them did not need one, and one of those
  had been telling the truth about a real geometry question for a year.

If a claim cannot be measured, say that instead of rounding it up.

## Running things

| What | How |
| --- | --- |
| The suite, in Foundry | `game.drpg.runTests()` in the console, as GM: tiers 0-1, read-only; `runTests({ tier: 2 })` also writes, and asks first in a window |
| The harness, first time | `cd audit/harness && npm ci` - installs jsdom; boots the checkout it sits in, or `DRPG_REPO` |
| The suite, headless | `cd audit/harness && node cluster.mjs scenarios/01-runtests.mjs` |
| One scenario | `node cluster.mjs scenarios/40-flow.mjs` (add `--verbose` for per-test lines) |
| Every scenario | the eleven numbered ones: 10, 11, 12, 13, 14, 15, 20, 30, 40, 50, 60 |
| The Polish file | `node tools/config-prose.mjs --check lang/pl.json` - must read 497/497 |
| The curtain, without Foundry | `python3 -m http.server 8765` then `/audit/glass-harness.html` |
| The evidence pack, without Foundry | the same server, then `/audit/pack-harness.html` |
| What the theme costs | `game.drpg.perf()` at the table - the only place that number is real |
| What a screen reader cannot read | `game.drpg.a11y()` |

The headless harness (`audit/harness`) runs four jsdom clients - one GM and
three players - against a shim of Foundry. It is good enough to drive the rules,
the sockets and the DOM, and it is **not** a browser: no layout, no canvas
width, no fonts, no audio. A test that needs one of those says so with
`needs(condition, why)` and is counted as skipped, not failed.

## What the suite's three numbers mean

`292 passed, 0 failed, 16 skipped` (headless, 1.2.60)

- **failed** must be zero. It was not zero for a year, and a thirteenth failure
  arrived unnoticed because twelve was a number people had learnt. It was not
  zero again by 1.2.56 (eleven headless failures, all of them windows the
  harness could not draw), which is why the harness's DialogV2 now draws real
  windows on the GM (`__dialogWindows`).
- **skipped** may only be a fact about the environment that the test checked
  itself. Never a result that came out wrong. The harness asserts this number
  does not grow: something that used to be answerable and stopped being so is a
  regression wearing the one colour nobody looks at.

## Things that will bite

**Every English key needs a Polish twin.** `lang/en.json` and `lang/pl.json` are
checked against each other by the suite (R1) and the prose in `config.mjs` by
`tools/config-prose.mjs`. A key used with `plural()` needs `.one`/`.other` and,
in Polish, `.few`/`.many`.

**The breakpoints live in `settings.mjs` and nowhere else.** `BREAKPOINTS` is
read by the stylesheet (through two body classes stamped in `applyTheme`), by
the curtain, and by the glass harness. A media query with 1224 in it would be a
fourth copy of the number and the curtain could not read it.

**`styles/narrow.css` loads last on purpose.** Both themes state widths for the
module's blocks as specifically as anything that could be written against them,
so the narrow layout wins its ties by being later rather than by an arms race in
selectors.

**The curtain has two partitions.** `curtainShapes` for a desk, `stackShapes`
for a stacked screen. The desk one assembles panes and checks afterwards that
they tile the screen; the stacked one starts from the screen and cuts it, so it
holds together by construction. Neither is a small change: run
`audit/glass-harness.html` at several sizes and compare the self-check
(`overlaps`, `blockFails`, `edgeGaps`) before and after, and look at a
screenshot, because the numbers can be clean and the picture wrong.

**The glass harness does not recut for Foundry's own rails.** `liveSignature` reads
`BLOCKS`, and the two rails are deliberately not blocks - so adding sidebar tabs from
`page.evaluate` and calling `refreshGlass()` republishes the partition cut for the tabs
that were there at load. A fifteen-tab rail has to be in the HTML before the page loads
(rewrite the response with `page.route`). Measured against the stale cut on 16.09, the
numbers came out plausible and wrong.

**A socket handler that touches an actor must check who sent the message.** R1b
in the suite reads the source for it. `senderOf(senderId)` and
`ownsActor(sender, actor)`, both, every time - and the rest of what that means
is the trust model, below.

**Two functions are deliberately long.** `registerSettings` (a flat registration
table) and `steps()` (a data table). Everything else the audit measured over 300
lines has been split. Splitting either of those two would produce a dozen
functions that are each one line of data.

## The trust model (D2)

A player's browser is trusted with nothing that belongs to somebody else.
Protection comes in two layers, and every change should know which one it
touches.

**Layer one (E03, 1.2.60).** Every request that reaches a GM's client is judged
there: the bridge in `gm-bridge.mjs`, the search-token, trap and fog sockets, and
Daggerheart's own GM relay (`relay-guard.mjs`). The judgement uses who Foundry
says sent it (`senderOf(senderId)`), what that user owns (`ownsActor`, `canSee`,
`testUserPermission`), and what the world says now: the room the character
stands in, the incident's stage and turn, the pair a sabotage wrote, the account
an Observe key was minted for, and a Reroll receipt (`reroll-receipts.mjs`) for
anything taken back. Packet fields are claims. A refusal changes nothing and is
logged on the GM; most are also told to the asker (`bridge.refused`), which E31
makes every one of them.

**Layer two (E28, E29).** The numbers - totals, dice, Hope paid - are checked
against the roll message the GM can see. Until then a player with a console can
still lie about their own roll, and move - within each resource's bounds - their
own character's Hope, Stress and Health, the resources of any actor that is not
a student (companions included), Fear one step at a time, and the countdowns the
rules tick or the GM gave them; `relay-guard.mjs` lists the rest. A Reroll
receipt proves only that the player rewrote the rolls of their
own character's chat card a few minutes ago - which a Reroll does, and so does
Daggerheart's own dice reroll, and so can a console. Not that a Reroll was paid
for, nor that one happened.

Daggerheart's relay writes on the GM's client, so every hook there sees the GM
as the author. That is why `relay-guard.mjs` passes only the shapes Daggerheart
itself sends for players, and why a test like "was this edit made by a GM"
(`truth-bullets.mjs`) is only as good as that guard. When a new Daggerheart
changes the relay, the guard refuses on the GM's client what it does not
recognise and tells the GM (on a player's client it forwards everything,
because Daggerheart's GM handlers do nothing there). Read its table before a
Daggerheart upgrade, and see AUDIT §9 for what it assumes about Foundry and has
not measured at a table.
The headless harness runs Daggerheart's real relay, copied verbatim into
`audit/harness/lib/dh-relay.mjs` - re-copy it from the new tag, never edit it.

## The house style

Comments here are long, and they are long in one particular way: they say what
was tried, what it measured, and why the code is the shape it is. A comment that
restates the line under it is noise; a comment that records the reading that
chose a number is the only place that reading exists. When a comment stops
matching the code, it is worse than nothing - the two comment sweeps in the
audit found several of those and they had each survived a release.

Dashes are `-`, not `—`, throughout, including in prose files.

## Releasing

1. `module.json` version and the `--drpg-css-version` stamp in
   `styles/danganronpa.css` must agree, and the workflow checks that they do.
2. The same version is stamped on the third line of the six handbooks in
   `docs/handbooks/` and in the README's "They describe version X." The workflow
   and R125 both fail when one of the seven lags.
3. Write `.github/release-notes/vX.Y.Z.md`. The workflow refuses to run without
   it.
4. Before a release, look up the current Daggerheart version. `verified` in
   `module.json` names only a version the suite has passed on at a real table;
   the manifest states no `maximum` (decision D1), so a newer Daggerheart loads
   and the module warns the GM once per version.
5. `main` is the release branch; the tag is created there, and the workflow
   refuses a dispatch from anywhere else.
6. Actions ▸ Release, dispatched on `main` with the tag (and a title for the
   last one). Afterwards check that `releases/latest` is the new version: a
   prerelease can move it.
7. Numbering (decision D20): each stage of the 1.3.0 plan ships as the next
   `1.2.X`; the last stage ships as `1.3.0` "Stained Update". After it, `1.3.X`
   is balance and fixes. The 1.3.0 notes say what of the text rework the
   `1.2.43`-`1.2.47` notes promised with it went in, and what did not.

## Numbering new tests

Every tier-0 test carries an R number, and so does every tier-1 test written
since 1.2.61: `R<n> - <what it promises>`. The number is how a comment, a commit
and an audit find the same test a year later, so it is never reused - a deleted
test keeps its row, marked with the stage that removed it. Tier-2 scenarios are
named, not numbered.

- `R113`-`R124` are reserved by number: `R113`-`R117` and `R120` for A5 (E13),
  `R118` and `R119` for A5 but written in E12, `R121` for A4 (E22), `R122` for A1
  (E23), `R123` and `R124` for A6 (E24). A design document that calls its first
  test "R113" means its row here. `R160` is the FLOWS test.
- `R21` was two tests until 1.2.61; the second, "the chapter ends by closing the
  trial", is `R151`.
- 70 tier-1 invariants older than 1.2.61 have no number and keep their names;
  the registry at the end of this file lists them. A tier-0 or tier-1 test with
  no number that is not on that list fails `node tools/check.mjs registry`, and
  so does a number used twice.
- Take the next free number (the registry's first line) in the commit that adds
  the test; `node tools/registry.mjs --write` adds its row.

## What is not done

`audit/AUDIT-1.2.42.md` section 9 carries the live checks - the things no
harness can settle and that have to be tried at a real table. That list is the
honest statement of what this module has not yet proved about itself.

## Registry: R numbers

Generated by `node tools/registry.mjs --write` from the tier files; see "Numbering new tests".

<!-- r-registry:start -->
Next free: R161. Reserved and unused: R113-R117, R120 for A5 (E13); R118-R119 for A5, written in E12; R121 for A4 (E22); R122 for A1 (E23); R123-R124 for A6 (E24).

| R | Tier | Since | Test |
| --- | --- | --- | --- |
| R1 | 0 | <=1.2.50 | every translation key the module names out loud resolves |
| R1b | 0 | <=1.2.50 | no socket handler takes a character on somebody's word |
| R2 | 0 | <=1.2.50 | no styling rule in the sheet has lost its emitter |
| R3 | 0 | <=1.2.50 | every sound a card asks for is a sound that exists |
| R4 | 0 | <=1.2.50 | every setting the module reaches for is a setting it registered |
| R5 | 0 | <=1.2.50 | no sound is played inside a function only the GM runs |
| R6 | 0 | <=1.2.50 | no bridge request can be made by the one person it is addressed to |
| R7 | 0 | <=1.2.50 | Reroll reads no field of the bookmark that nothing ever writes |
| R8 | 0 | <=1.2.50 | every action on the sheet has a branch, and every branch has a briefing |
| R9 | 0 | <=1.2.50 | nothing the investigation depends on is in a world setting |
| R10 | 0 | <=1.2.50 | the hot lookups stay under their ceiling |
| R11 | 0 | <=1.2.50 | no bridge request can wait forever |
| R12 | 0 | <=1.2.50 | every standing window fits the screen Foundry calls a minimum |
| R13 | 0 | <=1.2.50 | every trigger a trap can name has something listening for it |
| R14 | 0 | <=1.2.50 | every setting listener waits on the hook its setting actually fires |
| R15 | 0 | <=1.2.50 | nothing reads a card's words off the document |
| R16 | 0 | <=1.2.50 | no private card is posted around the private channel |
| R17 | 0 | <=1.2.50 | a trap can be sprung by somebody who is not the GM |
| R18 | 0 | <=1.2.50 | using an item mid-incident costs a turn like everything else |
| R19 | 0 | <=1.2.50 | the windows a GM works from stay true while they are open |
| R20 | 0 | <=1.2.50 | every sound in the catalogue is a sound something plays |
| R21 | 0 | <=1.2.50 | no control is decided by a function nobody called |
| R22 | 0 | E30 | every name this module calls is a name it has |
| R23 | 0 | E30 | a document hook that checks for a GM checks for THE GM |
| R24 | 0 | E30 | an action that swings a weapon knows which weapon it swung |
| R25 | 0 | <=1.2.50 | the action budget comes back when the Eclipse opens, and only there |
| R26 | 0 | <=1.2.50 | a critical's Hope is paid once, by one payer |
| R27 | 0 | <=1.2.50 | the state colour's sweep has no specificity to win with |
| R28 | 0 | <=1.2.50 | "Move the clock on" runs the Eclipse |
| R29 | 0 | <=1.2.50 | a body is this chapter's dead, discovered once, and never gathered |
| R30 | 0 | <=1.2.50 | a verdict is locked before it does anything |
| R31 | 0 | <=1.2.50 | Room Setup's Apply writes only what the GM changed, and refuses before writing |
| R32 | 0 | <=1.2.50 | the case dashboard saves the rows on screen, and a plan row only when it was edited |
| R33 | 0 | <=1.2.50 | no action pays for its roll after the dice |
| R34 | 0 | <=1.2.50 | a planted item is taken only by a Search that found something |
| R35 | 0 | <=1.2.50 | the Eclipse ends what was bought for the time of day, and the refill box only refills |
| R36 | 0 | <=1.2.50 | the GM side judges a plant and a Tamper by the rules the player's menu used |
| R37 | 0 | <=1.2.50 | a closed Tamper window after a landed concealment roll refunds nothing |
| R38 | 0 | <=1.2.50 | the Loaded Die rides the roll it was bought for |
| R39 | 0 | <=1.2.50 | the unfound-Key charge counts every Key Remnant that was found |
| R40 | 0 | <=1.2.50 | no action can be withdrawn from after the roll for who can see you |
| R41 | 1 | <=1.2.50 | armed Calls stack, and the same one twice is refused |
| R42 | 0 | <=1.2.50 | the trial gate sits below the guards that outrank it |
| R43 | 0 | <=1.2.50 | the trial's budget follows the phase, not the window |
| R44 | 0 | <=1.2.50 | one admission rule, two questions, and every reader asks it |
| R45 | 0 | <=1.2.50 | the floor is seized once, paid for, and never by a card with nothing behind it |
| R46 | 0 | <=1.2.50 | Analyze pays the chain before the dice, and every road gives it back |
| R47 | 0 | <=1.2.50 | Tamper pays one price, on the client, after the concealment |
| R48 | 0 | <=1.2.50 | a tile shows the price it is about to charge |
| R49 | 0 | <=1.2.50 | a bullet whose badge says Neutral is not treated as identified |
| R50 | 0 | <=1.2.50 | every step of the season reset is a group a GM can except |
| R51 | 0 | <=1.2.50 | no vw ceiling stands without an absolute cap |
| R52 | 0 | <=1.2.50 | the high-contrast switch states no type size |
| R53 | 0 | <=1.2.50 | the Tamper tile's late answer does not eat the reason it is locked |
| R54 | 0 | <=1.2.50 | the clock's chevrons hold one press at a time, and report a failure |
| R55 | 0 | <=1.2.50 | a rewind is refused before it cancels anything |
| R56 | 0 | <=1.2.50 | the body discovery refuses the dark before it asks anything, and the button says so |
| R57 | 0 | <=1.2.50 | the case dashboard keeps what the GM did to it across a redraw |
| R58 | 0 | <=1.2.50 | the trial console counts the seconds, a ballot is an event, and +30 s means thirty |
| R59 | 0 | <=1.2.50 | the murder window asks the Eclipse before it asks the GM anything |
| R60 | 0 | <=1.2.50 | every size this module states follows the Interface scale |
| R61 | 0 | <=1.2.50 | Monokuma Legacy states the whole ladder, and no rung is floored above its own size |
| R62 | 0 | <=1.2.50 | the scale factor is published once, on both roots, and the glass is pinned at 1 |
| R63 | 0 | <=1.2.50 | the window box follows the slider, and the sheet's stated size is still the glass's |
| R64 | 0 | <=1.2.50 | every stylesheet's comments are closed, and its braces balance |
| R65 | 0 | <=1.2.50 | a window that closes to come back does not answer its opener first |
| R66 | 0 | <=1.2.50 | the Players window writes what it was told, and offers the Despair that is left |
| R67 | 0 | <=1.2.50 | a repair moves the flags and says nothing |
| R68 | 0 | <=1.2.50 | Edit campaign offers the chapter the clock is actually on |
| R69 | 0 | <=1.2.50 | the Eclipse warning fires on a clock that moved |
| R70 | 0 | <=1.2.50 | Enter in a field that names a button presses that button |
| R71 | 0 | <=1.2.50 | the cue pane is built on every redraw, not baked when the window opened |
| R72 | 0 | <=1.2.50 | a tier pool a GM makes is filed like the installer's own |
| R73 | 0 | <=1.2.50 | a window reopened from its own answer closes the old copy first |
| R74 | 0 | <=1.2.50 | a Season setup row hands over instead of answering |
| R75 | 0 | <=1.2.50 | revoking a Despair pool is asked first, and the form survives it |
| R76 | 0 | <=1.2.50 | an incident whose cast is gone says so |
| R77 | 0 | <=1.2.50 | every student stands on a frame, and yours is bone |
| R78 | 0 | <=1.2.50 | the clock names what THIS client is hearing |
| R79 | 0 | <=1.2.50 | a Level Up may be handed over, and the writing stays the GM's |
| R80 | 0 | <=1.2.50 | an empty request is refused before the window starts closing |
| R81 | 0 | <=1.2.50 | one purchase posts one card, after the effect |
| R82 | 0 | <=1.2.50 | what shuts the whole Calls menu is asked at the door |
| R83 | 0 | <=1.2.50 | a deferred assembly remembers its scene, and is not cleared until it can be held |
| R84 | 0 | <=1.2.50 | a request that never went is not reported as sent, and a tile states the rule |
| R85 | 0 | <=1.2.50 | a Call still applies when the roll window is unlocked |
| R86 | 0 | <=1.2.50 | a Monocub may cross a room, and that is the list |
| R87 | 0 | <=1.2.50 | a trace of unstated origin is not a free Analyze |
| R88 | 0 | <=1.2.50 | a refusal hands back what was paid, and an Observe miss is not a refusal |
| R89 | 0 | <=1.2.50 | an Observe declaration outlives the browser that made it |
| R90 | 0 | <=1.2.50 | a region that redraws itself comes back dressed |
| R91 | 0 | <=1.2.50 | the GM can state that a trace exists |
| R92 | 0 | <=1.2.50 | a reshaped trace waits for a ruling |
| R93 | 0 | <=1.2.50 | the Event panel sits under Despair in both themes, and an NPC sheet keeps its rows |
| R94 | 0 | <=1.2.50 | the GM's trace card declares what it reads |
| R95 | 0 | <=1.2.50 | a window under glass arrives frosted, not sharp and then frosted |
| R96 | 0 | <=1.2.50 | a project token opens a card that names only what its reader knows |
| R97 | 0 | <=1.2.50 | an assistant GM's Despair goes to the primary, and cannot loop |
| R98 | 0 | <=1.2.50 | a Level Up offer lives where no player can write it or read somebody else's |
| R99 | 0 | <=1.2.50 | an assembly's fallback writes to the assembly's scene |
| R100 | 0 | <=1.2.50 | the overflow's Silence shuts Hope Calls and leaves a Monokuma's open |
| R101 | 0 | <=1.2.50 | the Despair Flow window comes back after a refusal, with its pools |
| R102 | 0 | <=1.2.50 | the sheet's handle follows the theme, and the track band fits its clock |
| R103 | 0 | <=1.2.50 | an analysed neutral bullet says there is nothing more in it |
| R104 | 0 | <=1.2.50 | a Key and a Final are written with their reading, like any trace |
| R105 | 0 | <=1.2.50 | a proposed murder is the proposer's, whoever else is ticked |
| R106 | 1 | <=1.2.50 | every bullet Analyze can reach is rolled for |
| R107 | 1 | <=1.2.50 | the visual round of 22.09 stays put |
| R108 | 1 | 1.2.51 | what the table saw on 1.2.50 stays fixed |
| R109 | 1 | 1.2.54 | a notice stays until it is closed, the newest on top |
| R110 | 1 | 1.2.55 | the gaps the README survey found stay closed |
| R111 | 1 | 1.2.55 | the book in the corner opens the handbooks |
| R112 | 1 | 1.2.56 | the curtain holds on a narrow desk, and the right column is wider |
| R113 | - | - | reserved: A5 (E13) |
| R114 | - | - | reserved: A5 (E13) |
| R115 | - | - | reserved: A5 (E13) |
| R116 | - | - | reserved: A5 (E13) |
| R117 | - | - | reserved: A5 (E13) |
| R118 | - | - | reserved: A5, written in E12 |
| R119 | - | - | reserved: A5, written in E12 |
| R120 | - | - | reserved: A5 (E13) |
| R121 | - | - | reserved: A4 (E22) |
| R122 | - | - | reserved: A1 (E23) |
| R123 | - | - | reserved: A6 (E24) |
| R124 | - | - | reserved: A6 (E24) |
| R125 | 0 | 1.2.57 | the README and the six handbooks name the version they ship with |
| R126 | 0 | 1.2.57 | fileSizes reads every stylesheet and language the module loads |
| R127 | 1 | 1.2.58 | a handbook contents entry answers its click and is not a link anything can follow |
| R128 | 0 | 1.2.59 | text a player writes cannot become markup on another screen |
| R129 | 0 | 1.2.59 | no item or actor field is printed into markup unescaped |
| R130 | 1 | 1.2.57 | a newer Daggerheart is named, with only Daggerheart's own missing places |
| R131 | 1 | 1.2.58 | a held setting of a module that is not here writes nothing |
| R132 | 1 | 1.2.60 | Daggerheart's GM relay has the guard in front of it |
| R133 | 1 | 1.2.60 | the relay passes what Daggerheart sends for a player, and nothing else |
| R134 | 0 | 1.2.60 | an undo from a player is paid for by a Reroll |
| R135 | 1 | 1.2.60 | a Reroll receipt pays for one undo of each kind, for a few minutes |
| R136 | 1 | 1.2.60 | a sabotage is taken back only as the pair it wrote |
| R137 | 1 | 1.2.60 | an Observe key is one character's, one account's, once |
| R138 | 0 | 1.2.60 | the GM judges a crisis action again before it lands |
| R139 | 1 | 1.2.60 | a player arms only a Support on somebody else |
| R140 | 1 | 1.2.60 | a player's trace is written from what the GM knows |
| R141 | 1 | 1.2.60 | a token is sent back only to where it stood a moment ago |
| R142 | 1 | 1.2.60 | a search, a used item and a fog reply are judged on the GM |
| R143 | 0 | 1.2.60 | ownership raised past the window's back, and a bullet a player edits, are put back |
| R144 | 0 | 1.2.60 | five doors a console used, each shut on the side that writes |
| R145 | 0 | 1.2.60 | Analyze, Stage 6 and a clean-up's undo, judged by the rules on the GM |
| R146 | 0 | 1.2.60 | the stylesheet's resource lock follows the setting |
| R147 | 0 | 1.2.60 | the relay guard stands before anything can stop the module starting |
| R148 | 1 | 1.2.60 | a Reroll lifts only a fresh trace nobody has found, and Tamper lists only what you know |
| R149 | 1 | 1.2.60 | every Despair pool is shown under its own name, a lone one included |
| R150 | 1 | 1.2.60 | a crisis action is taken back as it was taken, not as it left things |
| R151 | 0 | E30 | the chapter ends by closing the trial, and the panel can say so (R21 until 1.2.61) |
| R152 | 0 | E30 | no update deletes or replaces a key with the old '-=' / '==' spelling, which v14 ignores |
| R153 | 1 | E30 | an Assistant's relay packet is judged like a player's |
| R154 | 0 | E30 | the runner keeps the test author contract |
| R155 | 0 | E30 | every expectedRed names a stage that has not shipped |
| R156 | 0 | E30 | no test cuts the source it reads with a bare indexOf |
| R157 | 0 | E30 | no assertion is true by construction |
| R158 | 0 | E30 | needs() is asked only of a probe |
| R159 | 0 | E30 | worldDump reads every kind of write the module makes |
| R160 | 0 | E30 | every way a player reaches the GM belongs to a flow |

Tier-1 tests older than 1.2.61 with no number (70, names kept):

- every action definition has a label and a cost
- the three prices are one table
- the action grid is two rows of five, and nothing fell off it
- Palm cannot reach the two things it must not
- every sound names a category and a real key to yield to
- no stashed thing points at a stash that is not there
- every stash belongs to somebody who exists
- every crisis action names a side the engine knows
- every Call has a price and something to do for it
- the project Calls bend a project and no longer end one
- the overflow is examined when it fills, and cleared when the season is
- a table row keeps every edit, and an emptied description stays empty
- a tool in hand lowers the bar as well as adding a die
- the overflow caption is redrawn by every road that can end a darkening
- the overflow fires once per boundary and never below its floors
- a deferred Call is one the sheet can cancel
- every Call tile has a drawn glyph
- Analyze has its own numbers, and they are the guide's
- a critical pays the guide's price, and something is enforcing it
- the three criticals that buy another act say so, and can be spent
- a critical clean-up cannot rewrite the case out from under the GM
- a reshaped trace always admits it was handled
- a body cannot be dragged across the building, or into a bedroom
- the betrayal outlives the incident it came out of
- nobody walks out of an incident they are standing in
- an accomplice is not a witness to the crime they committed
- an investigation nobody finished has a price
- a trap alert is never addressed to a player
- no localise-or-fallback that can never reach its fallback
- advantage never adds up to more than three dice
- every stash a character owns agrees with the room it is in
- no two rooms on the scene stand on the same floor
- no module rule decides whether a sheet tab is shown
- every standing window is single-instance or says why not
- the live-refresh helper carries what a rebuild would throw away
- a live region refuses to redraw under the cursor
- a portrait chosen in a live window survives the window redrawing itself
- the Key Remnant limit's override still means yes after a redraw
- every setting that promises a redraw gets one
- the safeword is the table's, and never blank
- the three time Calls stay out of the armed-Call list
- every trait a definition names actually exists
- the crisis briefing can be built for every action
- a critical Strike knows how much it takes
- every table name the installer builds is one classifyTableName can read back
- Analyze prices a neutral trace like the evidence it stands in for
- every string the code asks for exists in the language file
- the Polish file covers every English key
- the curtain cuts a clean partition
- no chrome label is cut off
- nothing in the chrome is set under the floor
- the theme speaks two faces
- the notice tile is always cut
- the theme tokens resolve
- nothing is repainting the page
- no Remnant token carries the answer key
- a Remnant token's name gives nothing away
- one account is only ever sent to one voice room
- two rooms never share one voice channel
- the clock has one definition of its defaults
- every carry limit resolves to something
- everything that can be held ready is a real category
- no item claims a role that does not exist
- Daggerheart still supports more than one advantage die
- every music state has a label somebody can read
- the trial's three music states are ordered so each one can win
- nothing is mapped to a music state that no longer exists
- the stylesheet ships with the version it says it does
- a window closes without waiting for a transition that never started
- a Level Up is not a sheet waiting to be set up
<!-- r-registry:end -->
