# STATUS-GAPS-111 - 1.2.105's Known gaps that need no owner decision (claude/gaps-111)

Base: origin/claude/fit-110 57064fba, with origin/claude/gaps-radio merged in (346798b7). Written 13.11.2026. The
coordinator's list of that day, (a) to (g), from `.github/release-notes/v1.2.105.md` "Known gaps". R4930-R4933 are
used, Since 1.2.111; R4934-R4959 are left. Each line below is the Known-gaps line as 1.2.105 wrote it, struck when it
is closed, with the commit and what was measured.

## The Known-gaps lines

| # | 1.2.105's line | State | Commit |
| --- | --- | --- | --- |
| a | ~~Season's end: End of chapter's warning (`DRPG.Chapter.lastChapter`) still says "... Reset the season from Between sessions ..."~~ | closed on gaps-radio (R4653), merged here | 94dfb531 |
| b | ~~Action windows: `game.drpg.a11y()` does not list Details yet~~ | closed, red first (R4930) | c21305cb |
| c | The Event panel, empty, is still removed rather than kept as a steady empty region (E48 K4: not done) | **not done, by the owner's decision** (13.11.2026: "To akurat bym nie zmienial, niech event wyskakuje gdy jest event i chowa sie, gdy eventu nie ma"): built (efbe35a3), then reverted (7695476c); the panel keeps hiding while empty | 7695476c |
| d | ~~E48 batch 5's markers on the sheet: under Stained Glass the sheet's Hope and Action marks are still drawn by stained-glass.css's own stars and squares~~ | closed, red first (R4932); screenshots | 1b1daa92 |
| e | ~~A focused panel has no focus ring of the module's own~~ | closed, red first (R4933); contrast and screenshots | db87f058 |
| f | ~~the handbook lines "Colours" and "Hours" are not written~~ | closed: both GM handbooks, EN and PL | 1140e1fc |
| g | ~~Tables and the map: Legacy's Polish "Pochodzenie" head is cut in Passages' Origin column~~ | closed on gaps-radio ("Źródło"), measured again here | 7ed09b68 |
| - | ~~a theme switch draws the room outline as an arrival~~ (the same "Tables and the map" line) | closed on gaps-radio (R4655), merged here | f0666a1b |
| h | ~~a client that loads after the event plays nothing (Q-E61-1, Q-E94-4; notes v1.2.109, "Defaults taken")~~ | closed, the owner's "Przez 10 minut" (13.11.2026): red first (R4934, scenario 96) | bd6453dd |

(h) was first left for the owner; the owner answered it on 13.11.2026 and it was built here. The rest of the "Colours" line ("If the owner sees Hope on a GM's strip at a real table, that is still open") is a
table's, and stays open.

## What each measured

- **(a)** The warning names Season setup, EN and PL (R4653, gaps-radio).
- **(b)** `a11yReport` ends with one line per disclosure on the module's surfaces - its name, open or shut, and its
  region on the page, named, out of reach while shut - Details among them. R4930 red at 346798b7 (no line), green.
- **(c), reverted.** The owner asked for no change (above); efbe35a3 is reverted by 7695476c, and R4931 keeps its registry row
  marked removed. What efbe35a3 had measured, for the record: `renderEvents` kept the panel standing with no card: the same element, `role="status"`, its name
  `DRPG.Events.regionName` (EN "Event panel", PL "Panel Event"), marked `data-drpg-empty`. The next card is written
  into it. R4931 red at c21305cb, green; R3462 and the tier-2 tests on the panel green (21 by name). In Chromium on
  the glass harness, both themes, at 1366x768 and 390x844, GM and player (8 cases):
  - the empty panel is 0x0 and changes 0 pixels against the page without it;
  - its neighbours' rectangles and the curtain's blocks are unchanged;
  - the control, a panel with one card, changes 21422-106287 pixels.
  - Not measured: forced colours, whose `!important` border gives the empty panel a 2 px box, clipped.
- **(d)** Under the glass, Hope held/spent is `--drpg-pix-diamond`/`-diamond-empty`, and an action held/free is
  `--drpg-pix-dot`/`-dot-empty`, on the sheet and on the status strip. The strip wears the sheet's marks by its own
  rule (07.09; the owner's 11.09). R4932 red at efbe35a3 (stars, no mask on the pips), green; R1392 reads the strip's
  diamonds now. Legacy is unchanged (the computed masks read the same).
  - Screenshots (dsf 2, both themes, 1366x768 and 390x844): `docs/dev/gaps/shots-111/{before,after}-{sheet,strip}-{glass,legacy}-<size>.png`.
- **(e)** The four focusable panels (explain.mjs PANELS) wear the controls' ring: 2px solid Bone, 2px out.
  R4933 red at 1b1daa92 (none of 8), green.
  - Contrast of the ring's pixels against the same pixels unfocused, as the faintest tenth / the median:

    | Ring | Faintest tenth | Median |
    | --- | --- | --- |
    | before: Chromium's `auto` 1px | 1.14-1.54 | 3.13-12.33 |
    | after, Legacy | 6.33-11.49 | 8.67-11.78 |
    | after, glass | 1.93-9.55 | 6.23-13.01 |

  - The glass's faint tenth is the tilted panels' anti-aliased edge and the pane's own lit seam the ring crosses.
  - Screenshots: `docs/dev/gaps/shots-111/ring/{before,after}-{glass,legacy}-gm-<panel>.png`.
- **(f)** Two paragraphs in each GM handbook after "The glass and the windows". **Hours**: the hour's colour per time of
  day, a phase in its place, an incident's witnesses, and Legacy (no hour; the clock wears the phase; the map's lines
  Bone). **Colours**: gold is Hope; focus and selection are Bone; where the hour is decoration and where it never is.
  Read off tests-css.mjs HOUR_KEPT, R3412, stained-glass.css's accent rules, settings.mjs `incidentWitness` and
  fog-doorways.mjs `outlineColour`.
- **(g)** `style-sweep --tables` with Polish captures of Passages (probe 08, `DRPG_CAPTURE_LANG=pl`): 0 heads cut at
  1280x720, 1366x768 and 1920x1080, both themes. The pass's 6 problems were the item tables, not in that capture
  folder.

- **(h)** sequence.mjs `lateSequence` (pure) picks the newest event under 10 minutes old (`LATE_PLAY_MS`) that this
  browser would have seen live and has not played:
  - the trial's entry: the clock in a Class Trial, at `timeOfDayStartedAt`;
  - a GM's verdict card this user can see: `verdictAt`, at the message's time;
  - the start-of-day board: a day the real roll-over stamped (`dayBoard`), at `dayStartedAt`.

  `catchUpSequences` plays it once at ready by the live road. Once per event per browser: this browser's localStorage
  (`drpg-sequences-played`, kept 10 minutes); nothing goes to the world. Not played late: the end-of-day board (its rows
  need the ended day's start, which the new clock does not hold) and E62's transitions.
  - R4934: red at 7695476c (no `lateSequence`), green on 12 cases (9 and 11 minutes per event, the newest, played
    already, hidden, a player's card, a correction, a writer's skew).
  - Scenario 96 (new, ci): red with 7695476c's sequence.mjs (fresh: `{started:false, late:0, record:0}`, 6/7), green
    7/7 in 29 s.
  - Handbooks: the GM's (EN, PL) and the player's (EN, PL). The Q-E61-1 and Q-E94-4 records in docs/dev/e61 and e94 are
    struck, with the owner's answer.

## Gates

- **Quick gate** at bd6453dd: green (lint, check 17/17, gate self-test 37/37).
- **Tiers 0-1** at bd6453dd: 1379 passed, 0 failed, 16 skipped, 0 red (1394 tests, 418 s; R4931 out, R4934 in).
- **Tier 2 by name:** the body card's two tests, every test named "Event panel", and "every control in the module's own
  chrome has a name": 25 passed, 0 failed.
- **Scenarios that read files gaps-111 changes**, at 1ebd590c:

  | Scenario | Result |
  | --- | --- |
  | 14-quiet | 7/7 |
  | 40-flow | 88/88 |
  | 62-investigation | 51/51 |
  | 63-class-trial | 79/79 (C2 now expects the late entry once: the owner's answer) |
  | 66-rooms | 76/76 |
  | 75-voice-tile | 41/41 |
  | 76-passages | 117/118, 1 expected red (a Foundry limit, as before) |
  | 86-frame-work | 104/104 |
  | 87-messenger-sound | 35/35 |
  | 93-spectator | 17/17 |
  | 96-late-sequence | 7/7 |

- **Glass sweep** (`node audit/glass-sweep.mjs`, no `--accents`) at 1ebd590c: green, 2 themes x 2 roles x 25 sizes, 46
  with glass, 0 failing; its controls read their planted faults.
