# Stage plans - index

Written 12.11.2026 by the planning line, from the owner's audit ("DRPG Audyt 1.3.0 Stained Update", its stage entries
and dated amendments) and the code at commit f22a7e8 (1.2.105 in progress). Documents only. Each plan carries its own
measurements (file:line, commands) and its open questions with proposed defaults.

## Order

The owner's order (coordinator's brief, 12.11.2026): 1.2.106 = E76, 1.2.107 = E97 + E98, then the unshipped rows of
tools/stages.json in their order. tools/stages.json does not show the reorder yet (it is registered at the next release),
so the version in each plan's title is the one its writer took: some follow the reorder, some still follow stages.json.
**The order below is the one to follow; the version numbers are the owner's to assign.**

Sizes are the plan writers' estimates in agent-hours, not measurements. "Detail" is full (near stages) or light.

| # | Stage | Plan | One line | Detail | Estimate (agent-hours) |
| --- | --- | --- | --- | --- | --- |
| 1 | E76 | [E76.md](E76.md) | Newer Foundry (14.370) and Daggerheart (2.12.8): relay and dice copies from the new tag, the save packet's new shape (measured break), old keys `-=`/`==` in both readings, geometry contract, dice look on DSN 6.4 | full | 6-10 (12-16 if the 2.12 dice need draw fixes) |
| 2 | E97 | [E97.md](E97.md) | Case builder: the case schema, its realization, and the question at the body's discovery | full | 19-21 (its share of the joint E97+E98 work) |
| 3 | E98 | [E98.md](E98.md) | Case map in the Investigation panel, map by default, the table one switch away; same write road as the table | full | 13-17 |
| 4 | E61 | [E61.md](E61.md) | Entering the Class Trial and the verdict's cut-in; the shared sequence engine (Esc, still version, table switch); the floor cross-section carried from E12 | full | 24-32 |
| 5 | E62 | [E62.md](E62.md) | Animated phase transitions: every other phase and hour change, death fade, body-discovery flicker, the interface following a recut curtain | full | about 32 (with the end review) |
| 6 | E99 | [E99.md](E99.md) | Case schema at the trial (GM ticks, hints) and a summary for the players after the verdict, allowlisted for secrecy | full | 11-14 |
| 7 | E92 | [E92.md](E92.md) | Spectator, a new kind of player: roster flag, muted microphone, a map copy without the Mastermind's row | light | 30-38 |
| 8 | E94 | [E94.md](E94.md) | Start-of-day and end-of-day boards, built on E61's sequence engine | light | 18-24 |
| 9 | E64 | [E64.md](E64.md) | Balance and rules before 1.3.0 (several inputs, such as E53's balance log, come later in the order) | light | 30-40 |
| 10 | E93 | [E93.md](E93.md) | Facilities (formerly Rest): GM and project room actions on a new bridge road, project lifetime, five new Overflow effects | light | 40-50 |
| 11 | E69 | [E69.md](E69.md) | Infiltrate tile: Listen, Tail Someone and Dash; the `crossingSettled` event E74 needs | light | 22-30 (+8 with murder privacy) |
| 12 | E74 | [E74.md](E74.md) | Doors and Keep Watch in the Infiltrate tile (depends on E69) | light | 24-30 |
| 13 | E73 | [E73.md](E73.md) | Trial hall zones: picking zones, Straw Poll, Logic Dive, Scrum Debate; the Class Trial console rebuild | light | 38-48 (30-36 without the console) |
| 14 | E72 | [E72.md](E72.md) | Monocub (E67 and E72 merged): knowledge states, Hope, the invitation; the voice of the ordinary dead; Tinker, Bribe, Bounty, Ghost Bet. Parts A and B, a split proposed as a fallback | light, long | 55-70 |
| 15 | E54 | [E54.md](E54.md) | File split, wave 3: the sheet (5878 lines), window geometry, investigation, clean-up, the curtain | light | 30-38 |
| 16 | E55 | [E55.md](E55.md) | CSS consolidation with the snapshot gate, and the stylesheet split | light | 25-32 |
| 17 | E56 | [E56.md](E56.md) | Module hygiene: comments, dead code, dead keys, lint with no warnings | light | 28-36 |
| 18 | E25 | [E25.md](E25.md) | Texts, Polish and the handbooks: content and correctness (boundary with E71 and E57 tabled there) | light | 16-22 |
| 19 | E71 | [E71.md](E71.md) | UI copy-edit, EN and PL, in batches; no handbook edits | light | 45-60 |
| 20 | E91 | [E91.md](E91.md) | Leftovers from stage notes: small code fixes with no other home | light | 14-20 |
| 21 | E57 | [E57.md](E57.md) | Texts and handbooks after all stages: text guards, number consistency, contextual help, the last pass | light | 50-65 |
| 22 | E59 | [E59.md](E59.md) | Final consistency review, repository order and the 1.3.0 release gates | light | 18-24 |
| - | E83 | not written | The review of all stages: skipped, the auditor session's job (STATUS.md) | - | - |
| 23 | E38 | [E38.md](E38.md) | Multi-client harness (moved out of the plan on 25.10: the verification chat's material) | light | 25-35 |
| 24 | E39 | [E39.md](E39.md) | Behaviour tests: movement, items, actions, projects (moved out) | light | 30-40 |
| 25 | E40 | [E40.md](E40.md) | Behaviour tests: trial, reset, state invariants (moved out) | light | 35-45 |
| 26 | E43 | [E43.md](E43.md) | Second security round (moved out; but S17-31 must close before 1.3.0, see its Q-E43-2) | light | 40-50 |
| 27 | E53 | [E53.md](E53.md) | Measurements before session 0: performance budget, balance log (moved out) | light | 25-35 |
| 28 | E58 | [E58.md](E58.md) | Final verification in a sandbox, no table (moved out) | light | 25-35 |
| 29 | E26 | [E26.md](E26.md) | Release 1.3.0 Stained Update (needs a passed local gate; no waiver for 1.3.0) | light | 5-8 |

## Things the plans found that cross stages

- **E76:** Daggerheart 2.12.5 changed the save packet (`saveTotal`, `isCritical` in place of `result`); `relay-guard.mjs`
  `judgeSave` would drop a player's save, and the relay fingerprint does not see the change.
- **Order against dependencies:** E92 builds on E72's dead states but ships before it; E64 needs E53's balance log, which
  comes after it; E69 assumed E39/E40 cover its rows, but they come later and are moved out.
- **E97/E98/E99:** the joint design file the audit cites (its C0-C13 and Q-A..Q-E answers) is not in this checkout; the
  three plans infer the split from the audit's amendments. Check against that file before C0.
- **E43 and E26:** S17-31 (the killer's identity, high) is listed as closed by E43, and the canary refuses an entry
  closed by E26; with E43 moved out, its S17-31 fix has to come back to the release line before 1.3.0.
- **E26:** 1.3.0 needs a passed local gate with no waiver (gate-lib.mjs:19-20); today's gate file is incomplete.
- **Stage ids:** E99 proposes widening stage ids to three digits so the next new stage can be E100.
