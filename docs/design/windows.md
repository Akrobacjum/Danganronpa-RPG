# The windows the owner approved (E44, D31)

D31 = 1: a window's new layout is built only from a mockup the owner approved before the code, its content and its
order unchanged. E44's mockup round showed every window that had none, each as it is today beside the proposal, in both
themes (Stained Glass and Monokuma Legacy), at 1920x1080 and 1366x768, and at 390x844 for a window a player opens. This
file is the record of what the owner answered, card by card; E46, E47 and E21 build a window from its row here, and R1334
(tier 0) holds the file to the review page's cards, the pictures to `audit/design/` and the window names to the glossary.

How the cards were made, in short: "today" is the module's real window, opened on the headless harness with the module's
code and lang files and captured as markup; "proposed" is the same capture on the kit's markup and stylesheet; both were
drawn in Chromium inside the style harness. So a card is not Foundry's frame, has no Foundry core stylesheet and shows the
harness's seeded world - each card said so. A check compared each proposed page with its capture: the label keys and the
order of fields, rows, columns and buttons, 1:1 on all 163 pages. The labels came from `lang/en.json` and `lang/pl.json`
by key, never typed.

Where the owner answered:

- **In chat, 04.11.2026**, on the two pilot cards (M1's Bedrooms tab and the kit sheet M15): "Super zmiana ux, pasuje"
  (the footer: the closing word on the left, the primary on the right), "Równe, ale zmniejszyłbym na makietach font, by
  zmieściły się w 1 linii" (equal tabs, on one line - shown again on the page), "Tak, improved jest fajne" (the improved
  fine print I1, below).
- **On the review page DR-E44-M1** (a private page; read back on 04.11.2026, "done" pressed at 07:12:10 UTC): 19 asks,
  numbered #1-#19 - M1's and M15's tabs (#1, #2), M2-M14 (#3-#15), the two questions (#16, #17), i1 and i2 (#18, #19).
  Every one Approve, with no note and no general comment. In chat after it: "Artefakt przejrzany, zatwierdzam wszystko.
  Co do despair pools - moze skrocmy nazwy zakladek po prostu? Np. Pools zamiast Monokumas and despair pools." (M3's note.)

The screenshots are the page's own pictures, byte for byte: each is one state, today on the left and proposed on the
right, at 1366x768 (a 2744 px wide JPEG, drawn at a device scale of 2). The rest of the round - every state, 1920x1080,
390x844 and Polish - was rendered beside them and is not kept in the repository (966 pictures, 1.3 GB).

The columns: **Tile label** is the key of the label on the tile, button or launcher that opens the window, whose words
are the window's name (the plan's amend of 05.10: the names in the words of their tile labels); **Glossary** the entry of
`docs/glossary.json` that holds that name. A card with neither opens no window of its own name: chat cards, a row of
another window, the trial's own prompts or a Call's buttons, whose names the glossary already holds as mechanics. **Built
by** is the stage whose layout work starts from the row (E46 and E47 the big GM windows by the plan; E21 a window moved
onto the kit's frame with no layout stage of its own; E44 what this stage already built).

## The cards

| Card | Window | Opened by | States shown | Answer | Date | Note | Screenshots | Tile label | Glossary | Built by |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M1 | Room setup | room-setup.mjs `openRoomSetupDialog` | the nine tabs (Bedrooms, Doors, Passages empty and with two passages, Searching, Rest, Stashes, Description with its Picture column, Fog, Scenes); a long room list at 1366x768; Apply refused | Approve | 04.11.2026 | the footer and the layout in chat on the pilot; the tabs on one line on DR-E44-M1 #1, no note | `audit/design/M1-tab-bedrooms-glass.jpg`, `audit/design/M1-tab-bedrooms-legacy.jpg`, `audit/design/M1-apply-refused-glass.jpg`, `audit/design/M1-apply-refused-legacy.jpg` | `DRPG.Vault.manageTitle` | `window-room-setup` | E46 |
| M2 | Sound | sound-panel.mjs `openSoundDialog`, `openPlayerSoundDialog` | Play with no cue playlist, made and empty, with tracks; Music with a row saving and saved, and one that failed; Effects; a player's sliders | Approve | 04.11.2026 | no note (DR-E44-M1 #3) | `audit/design/M2-play-cue-tracks-glass.jpg`, `audit/design/M2-play-cue-tracks-legacy.jpg`, `audit/design/M2-effects-glass.jpg`, `audit/design/M2-effects-legacy.jpg` | `DRPG.Sound.title` | `window-sound` | E46 |
| M3 | Despair Flow | gm-team-dialog.mjs `openGmTeamDialog` | Pools; Monokumas; Students; Overflow with its Threshold, out of range and with Clear asked | Approve | 04.11.2026 | no note on the page (DR-E44-M1 #4); in chat: shorter tab names - built in E44 C4a as Pools, Monokumas, Students, Overflow and Pule, Monokumy, Uczniowie, Overflow | `audit/design/M3-tab-students-glass.jpg`, `audit/design/M3-tab-students-legacy.jpg`, `audit/design/M3-tab-overflow-glass.jpg`, `audit/design/M3-tab-overflow-legacy.jpg` | `DRPG.Panel.despairFlow` | `window-despair-flow` | E46 |
| M4 | Pre-season checks | season-setup.mjs `runPreSessionChecks`, from Season setup | the seeded world as it reads; A/V off with no voice tile; a blocking row (red only for a blocking row); no all-clear state, which the seeded world never reads | Approve | 04.11.2026 | no note (DR-E44-M1 #5) | `audit/design/M4-blocking-glass.jpg`, `audit/design/M4-blocking-legacy.jpg` | `DRPG.Panel.seasonChecks` | `window-pre-season-checks` | E46 |
| M5 | Investigation | investigation.mjs `openInvestigationDashboard` | Traces with no incident and with a murder open; Key Remnants (the plan); Final; a field moved under | Approve | 04.11.2026 | no note (DR-E44-M1 #6) | `audit/design/M5-traces-empty-glass.jpg`, `audit/design/M5-traces-empty-legacy.jpg`, `audit/design/M5-key-plan-glass.jpg`, `audit/design/M5-key-plan-legacy.jpg` | `DRPG.Investigation.dashboardTitle` | `window-investigation` | E47 |
| M6 | Class Trial | trial-floor-ui.mjs `manageClassTrial`, and the vote window | no trial; the trial with nothing on the floor (the mode bar); a debate; an Objection; the vote; the Closing Argument with two volunteers | Approve | 04.11.2026 | no note (DR-E44-M1 #7); the footer at 400 px as drawn, the console thought over in E46 or E47 (#17) | `audit/design/M6-debate-glass.jpg`, `audit/design/M6-debate-legacy.jpg`, `audit/design/M6-vote-glass.jpg`, `audit/design/M6-vote-legacy.jpg` | `DRPG.Floor.manageTrial` | `class-trial` | E47 |
| M7 | Edit campaign | gm-campaign.mjs `openClockDialog` | at rest (the Chapter a select); the correction question; the Chapter as a stepper not drawn (Q-E44-3: it stays a select until E47) | Approve | 04.11.2026 | no note (DR-E44-M1 #8) | `audit/design/M7-at-rest-glass.jpg`, `audit/design/M7-at-rest-legacy.jpg` | `DRPG.Panel.jump` | `window-edit-campaign` | E47 |
| M8 | Murder | murder-ui.mjs `openMurderDialog` | at rest; a trap ticked; a builder who died; no window in an Eclipse (a notification) | Approve | 04.11.2026 | no note (DR-E44-M1 #9) | `audit/design/M8-at-rest-glass.jpg`, `audit/design/M8-at-rest-legacy.jpg`, `audit/design/M8-builder-died-glass.jpg`, `audit/design/M8-builder-died-legacy.jpg` | `DRPG.Murder.openTitle` | `window-murder` | E47 |
| M9 | Level Up | level-up.mjs `openAdvancementFor` | the GM's choice of a Level Up; the choices; an offer standing; the player's choices (also at 390x844); an offer spent not drawn (a notification and a redrawn sheet) | Approve | 04.11.2026 | no note (DR-E44-M1 #10) | `audit/design/M9-gm-picks-glass.jpg`, `audit/design/M9-gm-picks-legacy.jpg`, `audit/design/M9-player-picks-glass.jpg`, `audit/design/M9-player-picks-legacy.jpg` | `DRPG.Advance.buttonTooltip` | `level-up` | E21 |
| M10 | The states of E28 and E29 | roll-draw.mjs's card of rolls made with no GM, sheet-audit.mjs's card of sheet changes made with no GM watching | the sheet changes' card (Undo all, Accept all) and a flagged change's card; the rolls' card and the two console lists not drawn (no stamped roll in the harness; the lists are console tables) | Approve | 04.11.2026 | no note (DR-E44-M1 #11) | `audit/design/M10-sheet-no-gm-glass.jpg`, `audit/design/M10-sheet-no-gm-legacy.jpg` | - | - | E47 |
| M11 | Settings (the gear) | look.mjs `openLookDialog` | the GM's and a player's gear with the Voice fieldset (also at 390x844) | Approve | 04.11.2026 | no note (DR-E44-M1 #12) | `audit/design/M11-gm-glass.jpg`, `audit/design/M11-gm-legacy.jpg` | `DRPG.Look.launcherTooltip` | `window-settings` | E21 |
| M12 | Palm's Frisk row, the target's window, Make them? | palm.mjs `choosePalm`; frisk.mjs `openAskWindow`, `askToForce` | Palm with its Frisk row (Openly, Unseen); the target's window with its counter; Make them? (also at 390x844) | Approve | 04.11.2026 | no note (DR-E44-M1 #13) | `audit/design/M12-palm-openly-glass.jpg`, `audit/design/M12-palm-openly-legacy.jpg`, `audit/design/M12-target-window-glass.jpg`, `audit/design/M12-target-window-legacy.jpg` | - | - | E21 |
| M13 | Your turn, I volunteer, the Objection in the Closing Argument, the Reveal confirmation | trial-prompt.mjs `promptTurn`, `promptClaim`; trial.mjs `pickObjectionEvidence`; trial-floor-ui.mjs `confirmReveal` | Your turn; I volunteer; the Reveal confirmation (the GM's); the Objection in the Closing Argument not drawn (it needs the bridge) | Approve | 04.11.2026 | no note (DR-E44-M1 #14) | `audit/design/M13-your-turn-glass.jpg`, `audit/design/M13-your-turn-legacy.jpg`, `audit/design/M13-reveal-glass.jpg`, `audit/design/M13-reveal-legacy.jpg` | - | - | E21 |
| M14 | A Call's window (Hope gold, Despair blood) | call-pickers.mjs `callWindow` (`pickTarget`, `confirmCall`); calls.mjs `askHopeCallApproval` | a Hope Call's picker and confirmation; a Despair Call's picker and confirmation; the GM's own approval | Approve | 04.11.2026 | no note (DR-E44-M1 #15) | `audit/design/M14-hope-picker-glass.jpg`, `audit/design/M14-hope-picker-legacy.jpg`, `audit/design/M14-gm-approval-glass.jpg`, `audit/design/M14-gm-approval-legacy.jpg` | - | - | E21 |
| M15 | The kit sheet | audit/style-harness.html's kit gallery | every component in every state | Approve | 04.11.2026 | the footer and the improved fine print I1 in chat on the pilot; the tabs on one line on DR-E44-M1 #2, no note | `audit/design/M15-sheet-glass.jpg`, `audit/design/M15-sheet-legacy.jpg` | - | - | E44 (C3a) |
| i1 | Notice history (for information, no D31 round) | notice-history-app.mjs `openNotices` | empty; full; searched; an entry open | Approve | 04.11.2026 | no note (DR-E44-M1 #18) | `audit/design/i1-full-glass.jpg`, `audit/design/i1-full-legacy.jpg` | `DRPG.Notices.title` | `notice-history` | E44 (C5) |
| i2 | The tiles and launchers of E77 and E78 (for information, no D31 round) | room-tile.mjs, voice-tile.mjs, gm-panel.mjs `injectLauncher`, foundry-windows.mjs | the GM's screen and a player's, on audit/glass-harness.html; today and proposed identical (Legacy and 390x844 pixel for pixel, Stained Glass within 0.08 % of the pixels, as much as two shots of today's animated page differ) | Approve | 04.11.2026 | no note (DR-E44-M1 #19) | `audit/design/i2-gm-glass.jpg`, `audit/design/i2-gm-legacy.jpg` | - | - | E44 (C6) |

## The questions on the page

| Ask | Question | Answer | Date | What it settles |
| --- | --- | --- | --- | --- |
| q-grow | A tab strip that does not fit one line even at 11 px: may the window grow by at most 25 % before the tabs take two rows? (DR-E44-M1 #16) | Approve | 04.11.2026 | ui-kit.mjs `fitKitTabs` grows a window by at most a quarter of its width, never past the screen less 16 px, and only then gives the strip rows (built in E44 C3a) |
| q-console | The trial console (M6): ten footer buttons at 400 px take about six rows. Approve keeps it so in E44 and leaves the console to E46 or E47 (DR-E44-M1 #17) | Approve | 04.11.2026 | E44 draws the console's footer as on the card; its layout is E47's (the console's footer slots, `liveFooter`) |

## The kit card (M15) and what it changed

Q-E44-2 (the owner, 04.11.2026): the kit has today's look in both themes, and a real improvement is shown on a card as an
optional variant, built only if chosen. One was shown and chosen:

- **I1, the fine print** (`helpText`, a table's empty row): the bone at 62 % in both themes (`--drpg-kit-help-ink`:
  `rgba(var(--drpg-bone-rgb), 0.62)` under Monokuma Legacy, `--drpg-sg-bone-dim` under Stained Glass), where it was
  danganronpa.css's `--drpg-dim`. Measured on the card under Legacy: 4.68:1 on the window's ground and 4.32:1 on a warning's
  (13 px, under AA's 4.5) before, 5.7:1 after. Under the glass the window's ground is not opaque, so the card did not
  measure it there.
- **The tabs on one line** (#1, #2, q-grow): equal widths; then the size down by 0.5 px to the floor (11 px under Legacy,
  `--drpg-sg-floor` under the glass), the letter-spacing to 0, the padding to 4 px, the window up to 25 % wider, and only
  then rows.
- **The footer** (chat, on the pilot): the closing word and the secondary and destructive buttons on the left, the primary
  on the right and first in the tree, so Enter presses it.

All three were in the kit when E44 C3a built it (`styles/components.css`, `scripts/ui-kit.mjs`), compared by eye with the
approved M15 card in both themes at 1366x768 (E44 STATUS, C3); E44 C7a, which writes this record, found nothing of the
card still to apply and changed no stylesheet.
