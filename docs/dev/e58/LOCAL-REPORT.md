# E58 local line (L1) - reports to the coordinator

The sandbox line on the owner's PC (WSL2 Ubuntu), branch `claude/e58-local`, made from origin/main at ff3e12e5
(1.2.116, "Merge 1.2.116 (#66)"). Newest report on top. Nothing here is a release step.

## Step 1 - seed: stopped, the world is not empty (16.11.2026)

The owner launched `drpg-qa-gate` (16.11.2026). What ran and what it read:

| What | Ran | Reading |
| --- | --- | --- |
| The server | `curl -s /api/status` | `{"active":true,"version":"14.370","world":"drpg-qa-gate","system":"daggerheart","systemVersion":"2.12.9","users":0,"uptime":34442}`. Daggerheart is **2.12.9**, not the 2.12.8 the prompt names. The runner's UNMEASURED guess at the field names (`active`, `version`, `world`, foundry.mjs `serverReason`) holds |
| The seeder, first run | `DRPG_SANDBOX_WORLD=drpg-qa-gate node audit/live/seed-world.mjs` | `error`, the runner's: `page.selectOption: Timeout 30000ms exceeded ... waiting for locator('select[name="userid"]')` (foundry.mjs `login`) |
| What /join is on v14 | a read-only Playwright page dumping the forms' fields; nothing typed or pressed | two forms. `form#join-game-form`: `select[name="userId"]` (id `join-username`; options "" and "GM"), `input[type=password][name="password"]`, `button[name="join"]` "Join Game Session". `form#join-game-setup`: a hidden `action`, `input[name="adminPassword"]`, "Return to Setup" |
| The fix | foundry.mjs `login`: `form#join-game-form select[name="userId"]` and `form#join-game-form button[name="join"]`, the reading written in its header instead of "UNMEASURED: the join form's selectors on v14" | `node tools/check.mjs gatecode live dashes` 0 problems; eslint clean. No harness test drives `login` (it needs a real server), so the first run below is its test: it logged in |
| The seeder, second run | the same command | `seed-world: refused - the world is not empty: 3 Folder, 1 Scene, 5 ChatMessage, 17 Setting`, exit 2. Nothing written |
| What the world holds | a read-only page as GM listing each document and its `_stats.createdTime` | every one written on 15.11.2026 between 20:42:42 and 20:43:33 UTC, at the world's creation and its first GM login: 3 Compendium folders (Daggerheart's "Character Options", "Daggerheart SRD", "Items"); Foundry's new-world scene "Foundry Virtual Tabletop" (`NUEDEFAULTSCENE0`, active, no tokens; flags of isometric-perspective and danganronpa-rpg); 5 messages - Foundry's "Getting Started" and "Inviting Your Players", Dice So Nice's first-use card, and two of this module's, each whispered to the GM (`drpgMessage`, `secret`, 39 characters); 17 world settings (core: time, permissions, moduleConfiguration, compendiumConfiguration, nue.shownTips; daggerheart: Automation, LastMigrationVersion; dice-so-nice: formatVersion, rolesMigrated; isometric-perspective: depthSortActiveFlag; danganronpa-rpg: caseMark, levelUpsMigrated, diceLookSource, diceLookWorld, migratedVersion "1.2.116", foundryBefore, documentLanguage) |

What it means: on v14 a world is never empty by the time a GM can log in to it. Foundry writes its tour, Daggerheart
its folders and every module its first-run settings at the first ready, so seed-world.mjs's rule ("refuses a world that
holds anything but its GM") refuses every fresh v14 world. That is the runner's guess, not the owner's data; still, the
rule is a guard on the owner's worlds, so this line does not loosen it or clear the world without the owner's word.

Correction to step 0: `node tools/check.mjs live` counts **537 items in AUDIT 9.2** (1007 citations in 452 files). My
grep's 551 numbered lines ran past 9.2's end; 537 is the number the steps below count against.

Left: step 1 (waits for question 3), steps 2-8.

Questions:

3. How should the seed get an empty enough world? **Default proposed: (a)**.
   (a) seed-world.mjs counts as empty a world whose only documents are what a fresh v14 world writes at its first
   login, each recognised narrowly: Folders of type Compendium; the scene `NUEDEFAULTSCENE0` with no tokens; chat
   messages flagged `core` (the tour) or this module's GM-only `drpgMessage`, or Dice So Nice's first-use card; and
   any world setting (settings are not documents a table makes). Anything else still refuses. A tier 0 test holds the
   rule on fixtures (red first: the 15.11 world refused today). The academy scene the seed makes is then activated and
   the tour's scene left as it is.
   (b) The owner deletes the tour's scene, the 3 folders and the 5 messages by hand, then this line seeds. The 17
   settings would still refuse, so (b) also needs (a)'s setting rule.
   (c) Something else the owner names.

## Step 0 - preflight (16.11.2026)

| What | Ran | Reading |
| --- | --- | --- |
| The branch | `git fetch origin`; no `claude/e58-local` on origin, so `git switch -c claude/e58-local origin/main`, then `--unset-upstream` (it tracked main) | at ff3e12e5; module.json 1.2.116 |
| The tree | `git status --short` | tracked tree clean; one untracked entry, `Danganronpa-RPG`, a symlink at the root pointing at the checkout itself (made 15.11 21:39, a minute after the sandbox's module link). Left as it is (question 1) |
| Node | `node -v` | v24.22.3 |
| The harness | `cd audit/harness && npm ci` | installed (npm audit lists advisories in dev dependencies; not touched) |
| The quick gate | `npm run quick` | green: lint 414 files 0 problems (15.9 s), check 25 parts all green (54 s), gate self-test 37/37 (2.3 s); 72.6 s wall. CLAUDE.md says 9-13 s "here": on this machine it is about six times that, nearly all of it `check` |
| The sandbox | `curl -sI http://localhost:30099` | `HTTP/1.1 302 Found`, `Location: /setup`: the server answers and no world is launched |
| The environment | `source ~/drpg/qa-env.sh`, then each name tested for being set | set: DRPG_SANDBOX_URL, DRPG_SANDBOX_WORLD. Unset: DRPG_GATE_KEY (the owner's choice), DRPG_API_KEY, DRPG_FIXTURES (on purpose), DRPG_REPO, PLAYWRIGHT_BROWSERS_PATH |
| The pre-push hook | `ls .git/hooks`, `git config core.hooksPath` | none installed in this checkout (only the samples); nothing to get round, and nothing guarding the push but the rules |
| The sandbox's modules | `ls ~/foundry/qa-data/Data/modules` | avclient-livekit, dice-so-nice, isometric-perspective, and danganronpa-rpg as a symlink to this checkout |

Read before step 1: CLAUDE.md, docs/dev/METHOD.md, audit/gate/README.md, audit/live/README.md, audit/harness/README.md
("What the harness cannot do"), audit/AUDIT-1.2.42.md 9.2 (its head; 551 numbered items, 556 distinct LIVE ids from
line 699 on, counted by grep), the plans E39, E40, E43, E53, E58 on origin/claude/plan-130, docs/dev/e39, e40, e43 and
e112 STATUS.md, tools/stages.json's rows (E39, E40, E43, E53, E58 all planned 1.2.117, version null; E112 shipped
1.2.116 on 16.11.2026, touches sockets, rolls, scenes).

Left: steps 1-8.

Questions (each with the default this line runs on):

1. The self-pointing symlink `~/drpg/Danganronpa-RPG/Danganronpa-RPG` is untracked and makes `git status` not empty.
   Default: left alone; the owner removes it if it was a slip (`rm ~/drpg/Danganronpa-RPG/Danganronpa-RPG` removes the
   link only, not the checkout). Lint and the 25 checks did not follow it.
2. The sandbox is at `/setup`. Step 1 (seed) and step 2 (dry run) need the world `drpg-qa-gate` launched; this line
   never logs into setup. Default: the owner launches the world, then this line seeds it.
