# The headless harness

`cluster.mjs` plays the Foundry server - the world store, the permission gate
and the socket relay - and forks one jsdom client per user (`client-entry.mjs`):
a GM and three players, `gm`, `p1`, `p2` and `p3`. Each client boots this
checkout's module against a shim of Foundry v14 (`lib/shim.mjs`), and a scenario
drives all of them. It is good enough for the rules, the sockets and the DOM. It
is not a browser and it is not v14: what it cannot do is listed below, and each
item that models v14 without having been checked against it names a live check
in `audit/AUDIT-1.2.42.md` section 9.2.

## Running

`npm ci` once in this folder (it installs jsdom), then
`node cluster.mjs scenarios/NN-name.mjs [--verbose]`. `DRPG_REPO` points it at
another checkout; by default it boots the one it sits in. Each run writes
`results/<scenario>.json`, which git does not track. Exit code: 0 when every
check passed, 1 when one failed, 2 when nothing ran, 3 when the cluster itself
failed.

## Layers

Every file declares `export const layers = [...]`, written out as a JSON array
so a runner can read it without importing the file: `"ci"` (this harness),
`"local-gate"` (a real Foundry, run by audit/live), both, or `["probe"]` alone
for the tools in `probes/` (see `probes/README.md`). `cluster.mjs` fails a file
that declares none.

## What the harness cannot do

- **No layout, canvas renderer, fonts, audio or Web Animations.** jsdom lays
  nothing out. A suite test that needs one of these asks the environment first
  and is counted as skipped (`needs`, `scripts/tests-kit.mjs`).
- **CSS.** Three of the module's six stylesheets are linked, and
  `getPropertyValue("--x")` answers from a flat map of their custom properties,
  the last declaration winning; everything else is jsdom's own answer.
- **The permission gate** (`canWrite` in `cluster.mjs`) models ownership and
  little else: a user of role 4 writes anything; a player creates chat messages
  and changes or deletes its own, updates its own User, updates an actor it owns
  and creates, changes or deletes that actor's items and effects, and moves the
  tokens of such actors; everything else is refused. World settings are written
  from role 4 only.
- **A `preUpdate` listener is handed a copy of the changes**, so what it
  removes from them is written anyway. Measured 24.09.2026: resource-guard.mjs
  emptied a player's Stress edit and warned them, and the GM's copy of that
  Stress still went from 0 to 5. The module's guards assume the opposite.
- **Operators** (E30). A key spelled `-=key` or `==key` changes nothing and is
  reported: on the log, as `legacyKeys` in the scenario api and as
  `legacyKeysIgnored` in the results file. `ForcedDeletion`, `ForcedReplacement`,
  `_del` and `_replace` delete and replace. All of it is modelled from the
  module's own measured notes and from Daggerheart's use of them, not from v14's
  source, and the wire form they travel in is the harness's own
  (`lib/operators.mjs`). Not confirmed on v14: LIVE-E30-01 (what `-=` does),
  LIVE-E30-02 (the operator API), LIVE-E30-03 (what a hook's `changes` holds).
- **Users.** Every seeded user is connected for the whole run: nobody logs in
  or out, and a role changes only by a write.
- **Daggerheart.** Its GM relay is 2.10.5's own code (`lib/dh-relay.mjs`). The
  roll is a mock (`rollTrait` in `client-entry.mjs`) that gives a Hope result
  one Hope and a critical one Hope and one Stress cleared, writes straight to
  the actor instead of through the relay, and produces no Fear. There are no Daggerheart
  sheets, roll dialogs, countdown windows or triggers.
- **Every chat message reaches every client**, whispers included, as on v14;
  the shim's `ChatMessage#visible` decides what shows. A socket packet reaches
  only its `recipients` when it names them.
- **Client settings** live in each client process's memory, for one run.
- **Languages.** The harness loads this module's `lang/en.json` and no other
  package's language file, so another module's keys stay unresolved.
- **Dialogs** are answered from a queue, or drawn as real windows on the GM
  when a scenario asks (`__dialogWindows`).
- **Versions** of Foundry, Daggerheart and the three companion modules are
  written into `client-entry.mjs`.
- **No client ever reloads.**
