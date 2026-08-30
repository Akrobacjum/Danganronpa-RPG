# What the 1.2.0 prereleases carried

Between **v1.1.0** (27.08) and **v1.2.0** (30.08) the module shipped as a
ladder of 88 prereleases, one per fix, so that a change could be measured at
the table the moment it was written. Those tags and their release notes were
deleted once 1.2.0 was out - they were scaffolding, and leaving them up means
somebody eventually installs one.

Deleting the tags is tidying. Deleting the record of which version carried
which change is not, so it is written down here. **The reasoning itself was
never on GitHub**: every fix has its own commit message, and those are in this
repository permanently. `git show <sha>` is the long version of any line below.

117 commits, 74 of them tagged.

One stretch is missing on purpose. **v1.1.26 to v1.1.40 all point at the same
commit** - a README edit made through the web interface - because that part of
the ladder was published from uploaded builds before `main` was brought onto
the source line. The tags are real, the versions shipped, but the tag says
nothing about what was in them, so listing them here would only be confident
and wrong. For that window the stage plan is the record: E9 ran to v1.1.27,
E10 to v1.1.28, E11 to v1.1.29, E12 to v1.1.31, E13 to v1.1.32, E14 to
v1.1.37, E16 to v1.1.38, E15 to v1.1.39.

| | Version | Date | Change |
|---|---|---|---|
| `8b524ff` |  | 27.08 | Update README.md |
| `d6cfb92` |  | 27.08 | The rules file carries this update's own wording, and stops denying the safeword |
| `8e881c6` |  | 27.08 | Four settings the rest of 1.2.0 needs, registered before their first reader |
| `d69ad7b` |  | 27.08 | One migration for 1.2.0, keyed to the version rather than to a boolean |
| `6665d01` | `v1.1.1` | 27.08 | Start the 1.1.N test ladder - E0 closed |
| `4a0ae15` |  | 27.08 | Room geometry: what counts as a doorway, how the border is drawn, and a validator |
| `0f61877` |  | 27.08 | The room check is a button in Room setup, not a console incantation |
| `a02ce20` | `v1.1.2` | 27.08 | E1 closed - and the stylesheet catches up with the manifest it advertises |
| `77c590c` |  | 27.08 | A doorway has no upper size, and the check has a margin in both directions |
| `52eec60` |  | 27.08 | The room check reports inside its own box, and the panel explains how to draw rooms |
| `b536a01` | `v1.1.3` | 27.08 | v1.1.3 - E1 revised: no doorway cap, a tolerant validator, a panel that teaches |
| `963927a` |  | 27.08 | The report wraps, and Room setup's prose takes the width of its window |
| `dc82e66` | `v1.1.4` | 27.08 | v1.1.4 - Room setup reads properly |
| `9d654b1` |  | 27.08 | The fog matrix turns: rooms down the side, people across the top |
| `bd762ba` | `v1.1.5` | 27.08 | v1.1.5 - the fog matrix reads the right way round |
| `690425c` |  | 27.08 | Drawing rooms is a season-setup job, so the guide and the check move there |
| `a5b0ce5` | `v1.1.6` | 27.08 | v1.1.6 - the room guide lives in Season setup |
| `8369b37` |  | 27.08 | Three things the acceptance walk found that reading the code did not |
| `5f30891` | `v1.1.7` | 27.08 | v1.1.7 - E1 closed |
| `453d0e0` |  | 27.08 | Two sliders instead of six, and a catalogue of thirty-five events |
| `e7ac17f` |  | 27.08 | The sound engine |
| `a929236` |  | 27.08 | The messenger's chime becomes a mapped event, and `since` starts gating |
| `6c9a1b2` | `v1.1.8` | 27.08 | v1.1.8 - E2, the sound engine |
| `87775f3` |  | 27.08 | The tab bar takes responsibility for the footer |
| `5a0d3ef` |  | 27.08 | The Sound panel, and a second circle for the player |
| `847d29e` |  | 27.08 | Item Tables: every tab keeps its own button |
| `20e6393` | `v1.1.9` | 27.08 | v1.1.9 - E3, the Sound panel and per-tab footers |
| `9fc26f7` |  | 27.08 | Five interface sounds, and one delegated listener |
| `969d6f5` |  | 27.08 | No default sounds, and a Season setup row that says so |
| `6075b75` |  | 27.08 | Seven things on screen that were saying the wrong thing |
| `d362785` |  | 27.08 | The flicker, found by measuring instead of by reading |
| `54e13db` | `v1.1.10` | 27.08 | v1.1.10 - E4, interface sounds and the flicker |
| `9bfc743` |  | 27.08 | The item card loses two buttons, keeps its colour, and the roll window backs out |
| `509c9b2` | `v1.1.11` | 27.08 | v1.1.11 - E4 corrections |
| `5b085de` |  | 27.08 | The item name lights up after you leave, which is a transition with a gap to cross |
| `0deaa17` | `v1.1.12` | 27.08 | v1.1.12 - the item name stops reacting to the pointer |
| `a1e84de` |  | 27.08 | The Despair Pools heading wears Despair's colour |
| `abf8826` | `v1.1.13` | 27.08 | v1.1.13 - E4 closed |
| `df3cdf8` |  | 27.08 | E5, first wave: the call sites that needed no decision |
| `fd676a0` |  | 27.08 | E5, second wave: the two decisions, and eleven more events |
| `6b19deb` |  | 27.08 | E5, third wave: the events nobody's client performed |
| `907a6ea` |  | 27.08 | E5 finished: a Search that found nothing, and the only reward in the game |
| `3e6ad0c` | `v1.1.14` | 27.08 | v1.1.14 - E5, event sounds |
| `04bbf40` | `v1.1.15` | 27.08 | E6: the Class Trial gets three playlists instead of one |
| `f13d1b1` | `v1.1.16` | 27.08 | E7: advantage stacks instead of flattening to one die |
| `2ba1e32` | `v1.1.17` | 27.08 | E8: tools, roles, and three slots shared between everything you hold |
| `16fc79e` | `v1.1.18` | 27.08 | E9a: one inventory row, one hand, tags that look like evidence |
| `3289071` | `v1.1.19` | 27.08 | Tier is what a thing can do: every tier 2+ gear entry does two jobs |
| `379a899` | `v1.1.20` | 27.08 | E9b: somebody else's sheet is redacted, not closed |
| `c63e0c9` | `v1.1.21` | 27.08 | E9: the sheet keeps its shape and is censored in place |
| `13c254b` | `v1.1.22` | 27.08 | E9: nothing on somebody else's sheet does anything |
| `d23da01` | `v1.1.23` | 27.08 | E9: the dead keep their things, and taking one is evidence |
| `fbc9f1e` | `v1.1.24` | 27.08 | E9: using an item mid-murder costs a turn, a roll and a threshold (G-21) |
| `e9dd675` | `v1.1.25` | 27.08 | Fix the Hope flare, which E4's flicker fix had silently taken away |
| `6c47fe2` |  | 28.08 | E14: the motive costs nine and counts down, the summons stops teleporting |
| `fd9bbb1` |  | 28.08 | E16: the nine guide differences the module was on the wrong side of |
| `02e7d42` |  | 28.08 | E15: the safeword belongs to the table, and a caret stops promising a list |
| `60a7149` |  | 28.08 | Two sound bugs found at the table: a dead branch, and a refusal to overlap |
| `cc4912f` | `v1.1.41` | 28.08 | E22: windows that stay true while they are open |
| `a9f18f9` | `v1.1.42` | 28.08 | Five stacked question marks, and a sheet that keeps its old size |
| `5c91637` | `v1.1.43` | 28.08 | A Monokuma stops uncovering the building, and every tile agrees on one size |
| `294a09b` | `v1.1.44` | 28.08 | E21: the module watches, the GM fires |
| `3d2857a` | `v1.1.45` | 28.08 | E17 tier 0: the module reads its own source, and finds six things |
| `256bb5e` |  | 28.08 | E17 live rounds: an Eclipse the clock can walk away from, and R3 reading half |
| `e706484` | `v1.1.46` | 28.08 | v1.1.46: the E17 live rounds, measured on two accounts |
| `d054fdc` |  | 28.08 | A whisper is a courtesy, not a secret |
| `43921f1` | `v1.1.47` | 28.08 | v1.1.47: R16 closes the private channel, and the stash invariant stops lying |
| `fd9bb62` | `v1.1.48` | 28.08 | Eight of E21's nine triggers never fired in play |
| `229fffe` | `v1.1.49` | 28.08 | E17: advantage, tools, the item mid-incident, and a stash that lost its contents |
| `254dd36` | `v1.1.50` | 28.08 | E22 finished: the four windows a GM works from all stay true now |
| `1f54074` | `v1.1.51` | 28.08 | Sound variation: wider, and with the dead centre taken out of it |
| `3d3b256` | `v1.1.52` | 28.08 | A sound in the panel that nothing ever played |
| `50ab5e7` | `v1.1.53` | 28.08 | The repaint that drew the number and not what the number decides |
| `31b44a1` | `v1.1.54` | 28.08 | A call to a function that does not exist, and a builder that kept its locals |
| `775229f` | `v1.1.55` | 28.08 | The trace and its bullets are one record, edited from either end |
| `afafed5` | `v1.1.56` | 28.08 | The final sweep of E17: three defects the source could be asked about |
| `ab2398e` |  | 28.08 | R21 asked one question per name and walked the file to answer each one |
| `86246b7` | `v1.1.57` | 28.08 | Four Despair Calls get the names Dawid calls them by |
| `b8ddf20` | `v1.1.58` | 28.08 | A diagonal wall could never close the staircase drawn along it |
| `3b276c7` | `v1.1.59` | 28.08 | A wall too short to draw as a line was drawn as a blob |
| `df687f8` | `v1.1.60` | 28.08 | Six item icons of our own, and a way to stop guessing at the white strip |
| `cd3d097` | `v1.1.61` | 28.08 | The icons can be pinned to a world that already exists, and whatIsHere says it out loud |
| `d8ba5d9` | `v1.1.62` | 28.08 | A doorway's glow is never deeper than the doorway is wide |
| `f164a33` | `v1.1.63` | 28.08 | Every objection takes a different track, and diagnoseFog says which opening is which |
| `46819e4` | `v1.1.64` | 28.08 | A private card's notice was drawing the placeholder |
| `ad6b408` | `v1.1.65` | 28.08 | The case dashboard reads its traces three ways, and a cue does not wait |
| `aee2af6` | `v1.1.66` | 28.08 | Durability, and two rulings about the floor |
| `9a33309` | `v1.1.67` | 28.08 | A trace is tied to the murder by what happened, not by what it is |
| `1fb7062` | `v1.1.68` | 28.08 | The corner buttons rise over the camera dock, and the handbook loses its edit button |
| `b83fd5f` | `v1.1.69` | 28.08 | Keys wear our own icon, and the footprint stops floating |
| `6930bfd` | `v1.1.70` | 29.08 | A dock on the left is not standing under the buttons, and the strip stops dragging the column |
| `a63ef12` |  | 29.08 | The finder hears the bullet, and the action that swings a weapon knows which one |
| `012b432` | `v1.1.71` | 29.08 | The clock takes the corner, both rails wear red, and a player's screen loses the sidebar |
| `b3565ff` | `v1.1.72` | 29.08 | A spent point of durability leaves its socket behind |
| `d71b96e` | `v1.1.73` | 29.08 | E18b wave one: five numbers the season run argued with |
| `c7c88e9` | `v1.1.74` | 29.08 | E18b wave two: a way out that can be bought with blood, and a case that keeps its size |
| `903efcb` | `v1.1.75` | 29.08 | E18b wave three: nothing is deleted because a chapter ended |
| `b6111a9` | `v1.1.76` | 29.08 | E18b wave four: Stage 6 becomes worth attempting, and Tamper starts paying |
| `e33db7e` | `v1.1.77` | 29.08 | Z14: Game Integrity takes the name, the project wipe is deleted |
| `592ebca` | `v1.1.78` | 29.08 | Z2: the action budget comes back when the Eclipse opens |
| `2d9bb53` | `v1.1.79` | 29.08 | Z10: the Despair Overflow, and the Call that feeds it |
| `d4219c8` | `v1.1.80` | 29.08 | The overflow caption, finished to the brief - and one layout write too many |
| `220fe15` | `v1.1.81` | 29.08 | Despair Overflow 2.0: eight debuffs, one drawn - and Despair Flow |
| `8931cf0` | `v1.1.82` | 29.08 | E18d: the eleven decisions from E18c, and Dawid's twelfth |
| `64ee7d8` | `v1.1.83` | 29.08 | Experience and Ultimate wait for the GM; Search picks its statistic at the roll |
| `5e76b35` | `v1.1.84` | 29.08 | E23, first round: two defects only a live incident could show |
| `61ef820` | `v1.1.85` | 29.08 | D11's client half never ran: the token carries no type |
| `98115aa` | `v1.1.86` | 29.08 | The Search picker spoke the wrong language, and expired too early |
| `264fdbc` |  | 29.08 | Turning on your partner moves inside Direct Murder |
| `444d856` | `v1.1.87` | 29.08 | An accomplice is not a witness, and a reshape is a rename |
| `7a6f205` | `v1.1.88` | 29.08 | The betrayal lasts the day, and nobody walks out of an incident |
| `df8cc9b` |  | 30.08 | Audit WIP: mock-Foundry harness scaffolding + partial agent findings |
| `f66d31a` |  | 30.08 | Audit v1.1.88: live 3-client harness, findings, and report for 1.2.0 |
| `62ee93c` |  | 30.08 | 1.2.0: a critical pays two Hope again, and the copy gets an edit |
| `ab88d9e` |  | 30.08 | Keep the audit out of the package, and record what came of it |
| `b270cfe` |  | 30.08 | Bring main onto the release line |
| `3c51cac` | `v1.2.0` | 30.08 | A release is one button |
