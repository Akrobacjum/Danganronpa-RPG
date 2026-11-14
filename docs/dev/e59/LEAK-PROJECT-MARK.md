# A secret project's indirect-murder mark in world data (E59, the coordinator's task of 14.11.2026)

GAPS.md's E43 row said "a secret project's image and its `indirectMurder` flag stay on world data (projects.mjs:1567)".
The coordinator asked which it is: one of the ten Foundry-limit known leaks, or not - and if not, the red test, and
the fix if small. Measured on 14.11.2026 at a8976975 (claude/e59-113), headless, 72-canary with the two checks below.

## The trace

`node cluster.mjs scenarios/72-canary.mjs` with the checks below: 135/140 passed, 3 expected red (the three Foundry
limits it always shows), 2 failed:

    ! FAIL  p1 and p2: projectMeta's row of the secret project holds no indirectMurder mark
            {"p1":{"row":true,"murder":true},"p2":{"row":true,"murder":true}}
    ! FAIL  p1 and p2: projectMeta's row of the secret project does not name the room its trap watches
            {"p1":{"row":true,"room":"Storage","token":{"hidden":false,"x":2400,"y":1400}},
             "p2":{"row":true,"room":"Storage","token":{"hidden":false,"x":2400,"y":1400}}}

p1 and p2 are the two players whose students are not the killer's (Chie, p3's). The project is the scenario's secret
indirect murder (`createProject({ indirectMurder: true, secret: true, ... })`); its room is set to Storage when its
trap is armed.

## Which it is

| Field | Where a bystander's browser reads it | Verdict |
| --- | --- | --- |
| `projectMeta.<id>.indirectMurder` (true) | the module's world setting `projectMeta` (projects-secrecy.mjs `projectMeta`, written by `setProjectMeta`: the flag is not one of `PROJECT_SECRET_FIELDS` nor `PROJECT_SECRET_WHILE_SECRET`) | **not a Foundry limit, and in none of the ten known-leaks entries.** An indirect murder is always secret (projects.mjs `createProject`: `hidden = secret \|\| indirectMurder`), so the mark says that a murder plan exists and which countdown it is. The killer is not named (`killerId` is the GMs' since E05). Not in the GM handbook's "What every browser holds anyway" (gm-handbook.en.md:88), so not an accepted trade-off. D27's "plans" class: it blocks a release unless the owner rules otherwise |
| `projectMeta.<id>.room` ("Storage") | the same setting | the same fact the project's token tells: its Token document stands at (2400, 1400) on p1 and p2, and a token's position reaches every browser - known leak `foundry-hidden-tokens` ("Every Token document, hidden or not, reaches every browser with its name and position"). Read as covered by that row while the project has a token; a secret project with a room and no token yet tells its room through the meta alone (not measured: the scenario's project has a token) |
| the countdown's `img` | Daggerheart's Countdowns | the caller's picture, or the default hourglass (projects.mjs:1914); the GM picks it in the project window (projects-ui.mjs:913). The token's picture, the glyph (a `murder` "Blade" among them, config.mjs PROJECT_GLYPHS), is the owner's accepted trade-off of 13.11.2026 (docs/dev/project-token-icon/STATUS.md; gm-handbook.en.md:88). The countdown's `img` is not named there |

## Why the fix is not small

The mark has readers on the GMs' and on the insiders' browsers, and one reader that depends on it being world data:

- projects.mjs `isIndirectMurder` (metaFor), and through it action-project.mjs:510, :698, :1257, action-briefing.mjs:304,
  call-effects.mjs:1151, projects-ui.mjs:346, :585, :599 and `allProjects()`'s `indirectMurder` (projects.mjs:646), read
  by facilities.mjs:285, projects-map.mjs:892, murder-ui.mjs:154 - several on the killer's own browser, which holds no
  GM store;
- projects.mjs:990 (`has: meta => Boolean(meta.indirectMurder)`, the trap's row in the change steps) and :2212, traps.mjs:202
  (`entry?.indirectMurder`), reading the meta row directly;
- gm-stores.mjs:2550, the health check that counts "a murder whose killer this browser lacks": it finds the murders by
  the world mark precisely because the GMs' store may be lost. Moving the mark takes that reading with it.

A world made before the fix holds the mark, so it needs a lift in migrate.mjs that reads back before it removes (R178).

## Proposed patch (not built)

1. projects-secrecy.mjs: `PROJECT_SECRET_WHILE_SECRET = ["description", "facility", "indirectMurder"]`; `setProjectMeta`
   then writes the mark to the GMs' half for every secret project, as it does the description.
2. projects.mjs `isIndirectMurder(id)`: the meta's mark (a public project), else the GMs' row (`secretsOf(id)`), else
   the insider's copy (`toldSight(id)?.murder`); the three direct readers above read it through `isIndirectMurder`.
3. projects.mjs `sightFor`: an insider's row carries `murder: true` for an indirect murder (the killer and whoever they
   let in); a Spectator's row too or not - the owner's (DRPG-D1 gives a Spectator every secret project).
4. world-secrets.mjs: `projectMeta.whileSecret.fields` gains `indirectMurder` (tier 0's equality with
   PROJECT_SECRET_WHILE_SECRET, tests-tier0.mjs:1436, follows).
5. migrate.mjs: a lift of the mark of every secret project into `projectSecretStore`, read back, then taken off
   projectMeta (R178's form; tier 2 runs it with the store's save swallowed and the world data stays).
6. gm-stores.mjs:2550: count the murders the GMs' store does not hold by the countdowns marked secret with no store row,
   or keep a count-only mark - the owner's choice of what the health check may still read.
7. 72-canary: the first check below goes green; the second is restated as "the meta names no room the token does not
   already tell", or moved under `foundry-hidden-tokens`.

Files: projects-secrecy.mjs, projects.mjs, world-secrets.mjs, migrate.mjs, gm-stores.mjs, 72-canary.mjs, a tier 0 or 1
test for the lift. Trust model: layer one's secrecy (`.claude/rules/trust-model.md`); the end review's security lens.

## The red checks (72-canary; not committed - no red may stand without a marker)

```diff
diff --git a/audit/harness/scenarios/72-canary.mjs b/audit/harness/scenarios/72-canary.mjs
index 12aca4ce..1042a0c2 100644
--- a/audit/harness/scenarios/72-canary.mjs
+++ b/audit/harness/scenarios/72-canary.mjs
@@ -255,6 +255,17 @@ export async function run({ gm, p1, p2, p3, check, phase, settle, canary, dump,
     check("p1 and p2: projectMeta holds no killerId, by, condition, trigger or description of the secret project, and no character id of the killer",
         Boolean(made) && [metaP1, metaP2].every(m => m.row && !m.fields.length && !m.killer), JSON.stringify({ p1: metaP1, p2: metaP2 }));
 
+    /* THAT A SECRET PROJECT IS AN INDIRECT MURDER IS NOT IN WORLD DATA (E59, the coordinator's task of 14.11.2026, on
+       GAPS.md's E43 row; the E43 plan's item 1, D37, E05 Q4: a secret project's name, image and both flags). An indirect
+       murder is always secret (projects.mjs `createProject`: `hidden = secret || indirectMurder`), so its `indirectMurder`
+       mark in projectMeta, a world setting every browser holds, tells any console that a murder plan exists, and which
+       countdown it is. Read on the two browsers that are not the killer's player's; the row has to be there. */
+    const markHolds = p => p.eval(`const row = (game.settings.get("${MOD}", "projectMeta") ?? {})["${made ?? "none"}"] ?? null;
+        return { row: Boolean(row), murder: row && typeof row === "object" && Object.hasOwn(row, "indirectMurder") ? row.indirectMurder : "absent" };`);
+    const markP1 = await markHolds(p1), markP2 = await markHolds(p2);
+    check("p1 and p2: projectMeta's row of the secret project holds no indirectMurder mark",
+        Boolean(made) && [markP1, markP2].every(m => m.row && m.murder === "absent"), JSON.stringify({ p1: markP1, p2: markP2 }));
+
     /* A SECRET PROJECT'S NAME AND WHO IS IN ON IT ARE NOT IN DAGGERHEART'S COUNTDOWNS (known leak S17-31; the coordinator's
        task of 12.11.2026, stricter than the marker scan). Daggerheart's world setting Countdowns reaches every browser: on
        the two that are not the killer's player's, the secret project's countdown holds neither its name (the marker) nor an
@@ -379,6 +390,15 @@ export async function run({ gm, p1, p2, p3, check, phase, settle, canary, dump,
         await new Promise(r => setTimeout(r, 300));
         return { armed: T.diagnoseTraps().armed, complete: P.isComplete(P.allProjects().find(p => p.id === "${made ?? "none"}")) };`, { timeout: 60000 });
     check("gm: the indirect murder's bar is filled and its trap armed", armedTrap.complete === true && armedTrap.armed >= 1, JSON.stringify(armedTrap));
+    /* AND ITS ROOM (the same task): the trap watches Storage. Read on p1 and p2 off projectMeta, and beside it whether
+       the project's token stands on the scene - a token's position every browser holds (Foundry's limit, as S17-64's), so
+       where it stands the room is told by the map whatever the meta says. */
+    const roomHolds = p => p.eval(`const row = (game.settings.get("${MOD}", "projectMeta") ?? {})["${made ?? "none"}"] ?? null;
+        const token = canvas.scene?.tokens?.find(t => t.getFlag("${MOD}", "projectId") === "${made ?? "none"}") ?? null;
+        return { row: Boolean(row), room: row?.room ?? null, token: token ? { hidden: token.hidden, x: token.x, y: token.y } : null };`);
+    const roomP1 = await roomHolds(p1), roomP2 = await roomHolds(p2);
+    check("p1 and p2: projectMeta's row of the secret project does not name the room its trap watches",
+        Boolean(made) && [roomP1, roomP2].every(m => m.row && m.room !== "Storage"), JSON.stringify({ p1: roomP1, p2: roomP2 }));
     await scanned("trap", KILLER_CHAT);
     /* The trap's receipt (E06 C8): a veiled thread card. Found on the GM in Chie's player's
        thread by its title, then read by id on p3 - listed in her own thread from the meta its
```
