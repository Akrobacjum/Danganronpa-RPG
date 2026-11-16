# E58 local line (L1) - reports to the coordinator

The sandbox line on the owner's PC (WSL2 Ubuntu), branch `claude/e58-local`, made from origin/main at ff3e12e5
(1.2.116, "Merge 1.2.116 (#66)"). Newest report on top. Nothing here is a release step.

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
