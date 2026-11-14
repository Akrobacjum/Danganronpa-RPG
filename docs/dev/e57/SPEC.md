# E57 - the tools line: spec and inventory (C0)

Written 14.11.2026 on `claude/e57-tools`, at its first commit `30053fec`: `claude/e57-prep` (C4a, `d246b80d`) with the
1.2.113 assembly (`claude/fervent-sagan-gme4vt`, `1463f22b`) merged in. module.json 1.2.112. This file is the tools
line's half of E57's C0 - what the tools need (C1, C2, C3, C4, C5, C12); the facts inventory and the handbooks' rewrite
(C6-C11) are the handbooks line's (`claude/handbooks-113`). The plan is `docs/dev/plans/E57.md` on `claude/plan-130`;
`PLAN.md` here lays its commits out and is not repeated. Every count below was taken on this tree on 14.11.2026, by the
command beside it.

## 1. What changed since the prep line measured (PLAN.md F1-F11, at 421f2395)

| Item | At 421f2395 (12.11) | Here (14.11) | How read |
| --- | --- | --- | --- |
| F2: the trap card's "four to six actions" | in gm-handbook.en.md:686 and .pl.md:686 | gone: gm-handbook.en.md:698 says "four to five actions", as `indirectCostText` composes (4 to 5) | `grep -n "four to" docs/handbooks/*.md` |
| F3: the brochure's trap roll "Eye vs 20" | player-brochure.en.md:69 | "Eye or Head vs 20" | the same grep |
| Handbook lines (EN = PL in each pair) | GM 1385, player 882, brochure 78 | GM 1411, player 950, brochure 78 | `wc -l` |
| Handbook words, EN / PL | - | GM 67 816 / 59 018, player 22 845 / 19 819, brochure 1606 / 1480 | `wc -w` |
| "## " sections | 21 / 16 / 7 | 21 / 16 / 7 | `grep -c '^## '` |
| Units (handbook-facts.mjs `split`) | - | GM 785 (414 paragraphs, 344 rows, 27 notes, 22 sections), player 462 (256, 185, 21, 17), brochure 40 (17, 20, 3, 8); the Polish ids, kinds and lines as the English in all three | `node tools/check.mjs text` |
| "section N" references | GM EN 124, PL 117 | GM EN 136 ("section N"), PL 122 ("sekcj* N") | `grep -ohE` |
| Language keys | - | en.json 5794, pl.json 6855 (the 1061 more are config.mjs's prose, 547 strings with their Polish plural forms) | `flatLang`, `walkConfigProse` |
| `tools/stale-pl.mjs`, `lang/pl.reviewed.json`, rules-parity | not built (E25 C1 was to build stale-pl as a report; E25 has not shipped) | built here, C1 and C2 | - |

So F2 and the brochure's half of F3 are fixed on the base (the texts line's early pass); rules-parity (C2) holds the
first and `opening.victim` the second.

## 2. What waits for E54

E54 splits eight files: scripts/chapter.mjs, cleanup.mjs, glass.mjs, investigation.mjs, remnants.mjs, sheet.mjs,
utils.mjs, settings.mjs. Until it lands this line edits none of them. What that holds back:

| Commit | The part in an E54 file | Why it cannot go round it |
| --- | --- | --- |
| C3 (D34), whole | settings.mjs registers `documentLanguage` (`config: false`, the empty choice "-") and reads it (`documentLanguage()`); utils.mjs holds `worldLocalize` | the setting's visibility is its registration; and `worldLocalize` formats a `DRPG.Config.*` key in the page's language whatever the setting holds, because lang/en.json has no config prose (text-style.md 13, "What E66 handed to E57") - a Polish page writing an English world's document needs config.mjs's own English, read in utils.mjs. Calling the helper from the sites before that would write nothing different |
| C4 (D35), the Investigation dashboard and its tabs | investigation.mjs `openInvestigationDashboard` (its title `DRPG.Investigation.dashboardTitle`, three tabs) | the window and its tabs are drawn there |

The six other windows of the "?" are outside the eight (section 4).

## 3. The S02-74 sites (C3)

Config prose written into a world document - read by everyone at the table, written in the language of whichever
client made it:

| Site | What it writes | Into |
| --- | --- | --- |
| inventory.mjs `grantItem` (`fallbackDescription`) | "Tier N. " and the tier sentence (`USABLE_KIND_EFFECTS` / `TIER_EFFECTS`, config prose localized in the page's language at load) | a new item's `system.description`; the "Tier N." is an English literal, so a Polish world's items read "Tier 2. Przywraca ..." |
| inventory.mjs (the tier-3 rewrite, `OLD_TIER_THREE`) | "Tier 3. " and the kind's tier-3 sentence | an existing usable's `system.description`, by a GM's ruling |

Not a site: gm-items.mjs `tellGiven` whispers a card to the owner, and a card stays in each browser's language
(utils.mjs `worldLocalize`'s header: "The interface windows, cards and the sheet stay in each browser's own
language"). C3 changes both sites to `worldLocalize` and moves the "Tier N." literal into a key of DRPG.Help's sibling
namespace for D34 (section 6), after E54.

## 4. The seven GM windows and the dashboard tabs (C4, Q-E57-2's default)

| Window | Its title key | Where it is drawn | E54 file |
| --- | --- | --- | --- |
| The GM panel | `DRPG.Panel.title` | gm-panel.mjs `openGmPanel` | no |
| Season setup | `DRPG.Season.title` | season-setup.mjs `openSeasonSetup` | no |
| Room setup | `DRPG.Vault.manageTitleOn` | room-setup.mjs `openRoomSetupDialog` | no |
| The case | `DRPG.Case.tile` | gm-stores.mjs (the case window) | no |
| Investigation, with its three tabs | `DRPG.Investigation.dashboardTitle` | investigation.mjs `openInvestigationDashboard` | **yes** |
| The Class Trial console | (the console's own header) | trial-floor-ui.mjs `manageClassTrial` | no |
| Edit campaign | `DRPG.Panel.jump` | gm-campaign.mjs `openClockDialog` (its own window; since E49 A1e also a block of Season setup) | no |

Each "?" opens a handbook on a section id shared by EN and PL - C4a's anchor (`data-drpg-section`, the "## N." number
or "N.M"; handbooks.mjs `markSections`, R4720-R4722). The section each window opens on is read off the GM handbook's
headings when the "?" is built, and R111's extension holds every one to a section the handbook has.

## 5. rules-parity's readers (C2)

What the tool reads (tools/rules-parity.mjs, its header), against the plan's list:

| The plan's list | Read by | Rules |
| --- | --- | --- |
| Call costs (Hope and Despair) | generated from `HOPE_CALLS`, `DESPAIR_CALLS`: each Call's label in a table row's first cell, its cost the next (Talent's Experience and Ultimate are priced by Talent's row) | 10 Hope and 15 Despair Calls, each held on every row of the three books that names it |
| CRISIS_ACTIONS | generated: each action with a threshold, by its label in a row, the next cell's last number; and the brochure's sentence | 11, and the brochure's one |
| Rest | the brochure's row and the GM handbook's sentence | 2 |
| Palm and Frisk (A11) | the brochure's row, the GM handbook's row with the Frisk's 60 s | 2 |
| Search's tiers, the starting resources | the brochure | 2 |
| The opening (topic C), the indirect murder | the killer's 8, the victim's 20, Conceal Your Intent's 16, the trap's 7-10 budget | 4 |
| The Overflow | the threshold 20, its range 6-60 | 1 |
| The trial's timings (topic D) | Open Debate 180 / 30, Testimony 60 (30-120), the rounds' sentence with Panic 15, 10 from 12, 10-15 | 3 |
| Key Remnants | a trap's full 5 | 1 |
| A number composed by code (F2) | murder-ui.mjs `indirectCostText`, called behind a stand-in of Foundry: "4 to 5" against "four to five actions" | 1 |

53 rules on this tree (16 anchors, 1 composed, 36 generated from the tables), 17 sentences and 80 rows read; they
hold 95 config values (55 in the anchors, 4 composed, 36 in the rows), a value held in two books counted in each. Not read yet, from the plan's list: Tamper's ladders and the
thresholds shown since E51, Monocub's numbers, A10's passages, the Logic Dive and Scrum timings - each a rule to add
when the handbooks line's rewrite settles the sentences (an anchor written today on a sentence that line rewrites
would only be written again). MEASURE-numbers.md counted about 307 distinct rule numbers by hand; the 95
values here are counted another way (with repeats, by rule), so no share of the 307 is claimed. The gap is named
here, not closed.

## 6. New keys

Under `DRPG.Help.*` only (the coordinator's rule: the four text lines rewrite every other namespace): the "?"
button's label and tooltip (C4), the mixed-language scenario's checks need none, and C3's texts (the setting's empty
choice named, the "Tier N." literal) when E54 lands.

## 7. Questions with defaults (this line's)

| # | Question | Default taken |
| --- | --- | --- |
| Q-E57-13 | The first lang/pl.reviewed.json: stamp every Polish key as it stands, or start empty? | Every key stamped, each marked `:b` ("the baseline, not a read"): the gate then catches an English moved from here on, and `--sheet` still lists every key nobody has read. C12's read replaces the marks. Empty would make T9 green over every key and guard nothing |
| Q-E57-14 | A key whose English and Polish both moved since its stamp: red? | No - `rewritten`, listed by `--sheet` for a read. Red would turn the gate red on every merge of the four text lines, which rewrite both languages by namespace; T9's red is the one case that is surely wrong, the English moved alone |
| Q-E57-15 | rules-parity and a rule number written in words ("four to five actions") | Accepted and counted (3 today), not red: digits for rule numbers is T7's, whose FAIL for the handbooks comes with their rewrite (C12 turns it, with the text lints) |
