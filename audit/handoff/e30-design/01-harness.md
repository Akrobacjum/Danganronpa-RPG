E30 / AREA: A FAITHFUL HARNESS (S14-28, S14-23, S14-30, S17-01). Design written against e03v at 411d4da. The repo copy was not edited. Every measurement below was made on scratch copies or with pure-code node runs, and none of them started the harness. Each claim is tagged: [measured] = run here; [source] = read in the code at the cited lines; [recalled] = my memory of Foundry, which cannot be checked here and is routed to a live check LIVE-E30-nn (section 9).

0. GROUND TRUTH
- Baseline before any change comes from the E03 validation run on 411d4da (scratchpad val-e03f; I did not re-run it). Suite 292/0/16 headless, 179.6 s. Scenarios: 10 19/19; 11 5/6 (known leak S04-02 -> E06); 12 10/10; 13 20/20; 14 7/7; 15 9/9; 20 3/3; 30 66/66; 40 37/38 (known leak S02-11/S10-05 -> E05); 50 43/43; 60 14/14. 00-boot was not in that run. Its committed result is red (LIVEKITAVCLIENT keys).
- The S14 line numbers have drifted. Mapping to 411d4da:
  - client-entry.mjs:62 -> 116 (the cssVars list) and 144 (the three link tags).
  - :287-289 -> 366-368 (DSN 5.1.1, iso 1.9.4, livekit 0.6.1).
  - :333-344 -> 400-424 (DualityRollMock).
  - :633-654 -> 727-775 (the foundry namespace; `data` is at 772 and has no operators).
  - shim.mjs:512 -> 619 (isGM >= 4).
  - cluster.mjs:98 -> 110 (server isGM >= 4).
  - futil.mjs:103-104 -> 131-135 (`-=` deletes).
  - utils.mjs:465-471 -> 483-492 (replaceFlag).
  - The '-=' write in migrateRemnants is remnants.mjs:1881, not ~1795. The drop loop is 1879-1882, the write 1883-1887, and the function 1839-1899. The brief's "points at remnants.mjs:1795" verify item means this line.

1. DEVIATIONS AND FIXES

1.1 ROLES. v14 [recalled, standard since v10]: User#isGM is hasRole("ASSISTANT"), so role >= 3.
- The module already assumes this [source]: utils.mjs:123-131 and :150-157 (full GMs preferred, assistants as fallback), despair.mjs:103-154, anonymity.mjs:462-487, diagnostics.mjs:160, season-setup.mjs:56.
- The harness has two role-4 sites [source]: shim.mjs:619 and cluster.mjs:110. The seed GM is role 4 (cluster.mjs:66), the players role 1.
- shim.mjs:617-630, UserImpl:
  - `get isGM() { return this.hasRole("ASSISTANT"); }`
  - `hasRole(role, { exact = false } = {})`: a name resolves through CONST.USER_ROLES. An unknown name returns false. Today an unknown name falls to 4.
  - `can()` stays `isGM`. The permission matrix is not modelled (listed in the cannot-do list).
- cluster.mjs:
  - `roleOf(userId)`; `isGM = roleOf >= 3`.
  - World-setting writes (315) are allowed from role 3. This assumes SETTINGS_MODIFY defaults to ASSISTANT [recalled, LIVE-E30-04].
  - canWrite (117-149) gets a first clause for coll "User", placed BEFORE the GM shortcut:
    - role 4: anything;
    - below 4: create/delete refused (not modelled further);
    - below 4: an update is refused when `role` is in the expanded changes and exceeds the writer's own role (BaseUser#canUpdate "role changes may not escalate") [recalled, LIVE-E30-04];
    - players keep "own user only".

1.2 OPERATORS AND LEGACY KEYS.
- Evidence [source]:
  - The module's own measured notes say `-=key` removes nothing in this Foundry: actions.mjs:350-353, music.mjs:785-788, fog.mjs:542-544, migrate.mjs:35-38 and :127-129, tests.mjs:8436-8438 and :9158-9160. AUDIT-1.2.13 C1 lists "`-=key` nic nie robi" among the Foundry traps.
  - Daggerheart 2.6.5 and 2.10.5 (both minimum 14.364) delete with `_del` (about 30 sites, e.g. countdownEdit.mjs:255) and replace with `_replace(...)` (e.g. tagTeamDialog.mjs:351). Neither contains a single `-=` key. Their eslint.config.mjs:73-74 declares `_del` and `_replace` as Foundry globals.
  - replaceFlag already looks for foundry.data.operators.ForcedReplacement, calling `.create(v)` or `new`.
- Measured on the harness's own futil (pure node) [measured]:
  - `{"flags.d.-=gone": null}` deletes;
  - expandObject turns an operator instance into a plain object;
  - the JSON round trip that shim `sanitize()` and Node IPC both do turns ForcedReplacement into `{replacement:{..}}` and ForcedDeletion into `{}`;
  - applying those today yields `gone: {}` and `{a:0,b:2,replacement:{a:1}}`.
  - So adding foundry.data.operators WITHOUT futil support would make replaceFlag corrupt the lastAction bookmark.
- NEW audit/harness/lib/operators.mjs (prototyped in scratchpad/e30-design/proto; it passed six cases):
  - `export const WIRE = "__harnessOperator";`
  - `export class DataFieldOperator {}`
  - `class ForcedDeletion extends DataFieldOperator`: `static create()` returns a singleton; `toJSON() -> {[WIRE]:"ForcedDeletion"}`.
  - `class ForcedReplacement`: `constructor(replacement)`; `static create(r)`; `toJSON() -> {[WIRE]:"ForcedReplacement", replacement}`.
  - Helpers: isWire(v), isOperator(v), kindOf(v), replacementOf(v), revive(v) (wire -> instances, recursive), `LEGACY = /^(?:-=|==)/`.
  - Header comment: the evidence above, and that v14's operators.mjs was NOT read (LIVE-E30-02). The wire form is the harness's own and the module never sees it.
- futil.mjs:
  - deepClone (53-60), expandObject (98-108) and flattenObject (110-118) treat operators (instance or wire) as leaves.
  - Optional: expandObject sets keys in order like Foundry's setProperty. Measured deviation: `{"a.y":2, a:{x:1}}` gives `{a:{y:2,x:1}}` here where Foundry would give `{a:{x:1}}`.
  - NEW `applyUpdate(target, changes, { onLegacyKey })`:
    - a LEGACY key -> onLegacyKey(path) and skip (no delete, no literal key);
    - ForcedDeletion -> `delete target[k]`;
    - ForcedReplacement -> `target[k] = deepClone(replacement)`;
    - plain object over plain object -> recurse;
    - otherwise assign a clone.
  - applyDocChanges (222-239) is built on applyUpdate, both for embedded-array patches (233) and for the rest (238).
  - mergeObject/_mergeKey (120-149) is left for module callers (`foundry.utils.mergeObject`: 5 uses in scripts/, none with `-=` or performDeletions), but a `-=` it deletes is reported the same way.
- Switch EVERY harness deletion site [source, complete grep]:
  - cluster.mjs:183 and :210;
  - client-entry.mjs:851, :885, :886;
  - shim.mjs:258 (updateSource) and :265 (clone);
  - shim.mjs:251-255: unsetFlag becomes `this.update({[`flags.${scope}.${key}`]: ForcedDeletion.create()})`. fog.mjs:542-545 relies on unsetFlag working on v14.
- shim update() (312-332): the preUpdate hook gets `revive(expandObject(deepClone(sanitized)))`. client-entry applyRemote (839-898) passes revive(...) to update and embedded-update hooks. So a post-hook sees the operator instance at the key, and `key in flags` readers see deletions (truth-bullets.mjs:1184-1187, voice.mjs:103-106, remnant-ring.mjs:112). The v14 shape of `changes` is unknown (LIVE-E30-03).
- client-entry.mjs:772:
  - `data: { fields, validators, operators: { DataFieldOperator, ForcedDeletion, ForcedReplacement } }`
  - `globalThis._del = ForcedDeletion.create()`
  - `globalThis._replace = v => ForcedReplacement.create(v)`
- Report of legacy keys: cluster applyOp passes `onLegacyKey` -> `legacyKeys.push({who, coll, docId, path})` and prints `[harness] v14 ignores '-=': <who> <coll> <docId> <path>`. The result JSON gets `legacyKeysIgnored`; the scenario api gets `legacyKeys`. This warning is the harness's own; whether v14 warns is unknown.

1.3 THE SIX STYLESHEETS. module.json styles: motion, danganronpa, stained-glass, pixel-icons, messenger, narrow.
- Today [measured]: the flat last-wins map (client-entry.mjs:115-141) already answers 18 of 250 custom properties with a non-base value:
  - `--drpg-window-max` 1700px, from `@media (min-aspect-ratio: 2/1)` at danganronpa.css:15840-15844, instead of 1400px (:367), and 1800px only inside the Projects window (:3890-3892);
  - `--drpg-t-eclipse` 0ms and `--drpg-scale-in` 1, from `@media (prefers-reduced-motion: reduce)` at motion.css:113-125, instead of 1400ms and 0.96.
- Simply listing six files in that map [measured] would be 21 of 379 wrong, plus 129 new properties with unresolved var(). `--acc` would become the glass GM accent everywhere, `--drpg-bone` the glass bone under the Hope theme. REJECTED.
- DO (option B): attach the sheets the way v14 attaches module CSS. diagnostics.mjs:205-209: one inline sheet of `@import url(...) layer(modules)`.
  - client-entry.mjs:25-29: `new JSDOM(html, { url, pretendToBeVisual: true, resources: { interceptors: [requestInterceptor(serveCheckout)] } })`. serveCheckout serves `/modules/danganronpa-rpg/<path>` from REPO and returns 404 for everything else, so there is no network. requestInterceptor is jsdom 30's API; ResourceLoader no longer exists [measured].
  - NEW lib/css.mjs:
    - `moduleStyleImports(styles)`
    - `attachModuleStyles(document, styles, {timeoutMs: 15000}) -> {files, rules, ms, complete}`. It appends one <style> of `@import url("modules/danganronpa-rpg/<f>") layer(modules);` in manifest order, then POLLS until every CSSImportRule.styleSheet.cssRules.length > 0. The style's load event fires before the imports are parsed [measured: 38 ms, only the first import populated].
    - `substituteVars(value, lookup)`: var(--x, fallback), recursive, depth 8, cycle -> fallback or "".
    - `wrapGetComputedStyle(window)`: a Proxy whose getPropertyValue("--x") returns substituteVars(jsdom's answer); every other read goes straight to jsdom.
  - Delete client-entry.mjs:115-150. Boot (1001) awaits attachModuleStyles before importing module.mjs. The ready message carries `{stylesheets: n/6, rules, ms}`. An incomplete attach is a boot failure, not a silent pass.
  - What this gives [measured, jsdom 30.0.1]:
    - layerName "modules"; nested rules 3/1553/617/90/33/23;
    - a real cascade for custom properties: specificity, inheritance, @media through the window (body 1400px, Projects window 1800px, 1400ms, 0.96, `--drpg-bone` #f2eee6 under the glass class and #e4ded8 without);
    - findOurSheets works headless for the first time;
    - cascadeAvailable() stays false: jsdom returns "var(--p)" for fontSize (tests.mjs:130-136), so its 3 skips stay skips.
  - Cost [measured]: about 1 s CSS parse per client, about 1.0 ms per getComputedStyle call (2305 rules).
- Side effect: standard properties now come from the sheets with var() unresolved [measured: `color: var(--drpg-bone)`, `fontFamily: var(--drpg-font-chrome)`, where today they are UA defaults]. That touches 71 getComputedStyle sites: 49 module, 22 in tests.mjs. Direct standard reads: zIndex 5, fontSize 4, color 4, width 3, pointerEvents 3, fontFamily 3, others 1-2.
- FALLBACK C, used if B's before/after cannot be explained difference by difference: keep standard properties as today and resolve only `--x`, with a resolver over jsdom's CSSOM parsed in a detached document.
  - 650 custom-property declarations in 238 rules; all 445 selectors evaluate under Element.matches [measured].
  - Only 4 @media conditions wrap custom properties: reduced-motion, color-scheme light, 2:1 aspect, contrast more. Evaluate them with window.matchMedia.
  - Walk el and its ancestors (inheritance); inline style first; last matching declaration by (specificity, order); substitute var().

1.4 VERSIONS. Today all hard-coded [source]: game.version, release and data.version 14.365 (461-462, 510); Daggerheart 2.6.5 (445); DSN 5.1.1, iso 1.9.4, livekit 0.6.1 (366-368). S14-28 read the installed ones as 6.2.9, 14.0.2, 0.6.8.
- NEW lib/versions.mjs, `readVersions(repo, env)`:
  - Foundry: module.json compatibility.verified ("14.365" -> generation 14, build 365).
  - Daggerheart: module.json relationships.systems[daggerheart].compatibility.verified (2.6.5).
  - The companion IDS come from module.json relationships.requires/recommends. They are exactly the three stubbed.
  - Their VERSIONS come from `$DRPG_FOUNDRY_DATA/Data/modules/<id>/module.json` when set, else from the pin.
  - With DRPG_FOUNDRY_DATA set, Daggerheart may also come from Data/systems/daggerheart/system.json. A version above 2.6.5 then opens requirements.mjs's newer-system dialog on the GM at boot, which is faithful and recorded.
  - Every value carries `from`. Optionally merge a companion's lang/en.json from DRPG_FOUNDRY_DATA.
- NEW audit/harness/versions.json:
  - `{ "note": "companion versions when DRPG_FOUNDRY_DATA is not set; re-read from an installed Data folder to update", "readFrom": "installed Data folder, as read by audit S14-28", "modules": { "dice-so-nice": "6.2.9", "isometric-perspective": "14.0.2", "avclient-livekit": "0.6.8" } }`
  - Daggerheart's relay code stays 2.10.5 (lib/dh-relay.mjs). Record it as `system.relayCode`.
- client-entry.mjs:359-368 and 444-462 read from readVersions. Every result JSON gets `environment: { foundry, system, modules[{id,version,from}], stylesheets, unconfirmed: [LIVE ids] }`.
- Predicted: no check changes. No test or scenario hard-codes these numbers [measured, grep]; they reach only diagnostics lines.

1.5 DAGGERHEART SURFACE: DualityRollMock and friends. Real code: 2.6.5 dice/dualityRoll.mjs:309-343 (2.10.5 :278-312), baseAction.mjs:490-529, actor.mjs:560-566 and 1013-1085, socket.mjs emitAsGM (2.6.5 :135-142, 2.10.5 :143-150).
- G1: no `config.source?.actor` gate. Real code returns early without it. Fix: the rollTrait mock (519-577) sets `source: {...(config.source??{}), actor: this.uuid}` and `data: getRollData()` like diceRoll.
- G2: the hopeFear automation gate is not read. `shouldUseHopeFearAutomation({gmAsPlayer:true})` returns hopeFear.players.
  - The harness default `"daggerheart.Automation": {hope:true}` (client-entry.mjs:254) has the wrong shape. The real one is `{hopeFear:{gm,players}, countdownAutomation, ...}`, and BOTH hopeFear flags default to false (Automation.mjs:9-19, same in 2.10.5) [source].
  - The wrong shape makes reroll.mjs:127-129 throw "Cannot read properties of undefined (reading 'players')" on every headless Reroll, caught at :145. This was seen in an E03 review run's log, scratchpad mine-probe.log:219.
  - Fix: the faithful default shape. game.system.settings.automation (458) is the SAME object, because 2.10.5 and relay-guard.mjs:644 read it there. The cluster seed STATES `hopeFear: {players:true, gm:true}` (a table using Hope automation) with a comment giving Daggerheart's default.
- G3: `actionType === "reaction"` is ignored. Fix: honour it. The rollTrait default is "action", overridable because rollTrait spreads options last.
- G4: `skips.resources` is ignored. Fix: honour it.
- G5: a dead/defeated/unconscious actor still pays. Fix: an actor.statuses gate.
- G6: the `config.rerolledRoll` delta branch is missing. Fix: copy it.
- G7: Fear is never produced. Fix: fear +1 on duality -1.
- G8: the ResourceUpdateMap mock (376-398) differs. Fix: a batch with a keyless entry is dropped; `clear` semantics; accumulate onto an existing entry; NOT cleared after updateResources.
- G9: resource writes skip the relay. Daggerheart routes a PLAYER's writes through the GM relay (emitGMUpdate -> emitAsGM). The mock writes directly, so headless player rolls never met the relay guard.
  - Fix: a modelled modifyResource. Resources are clamped to 0..max. For a non-GM, emit on `system.daggerheart` `{action:"DhGMUpdate", data:{action:"DhGMUpdateDocument", uuid, data}}`, and for Fear `{action:"DhGMUpdateFear", data:value, uuid:null, refresh:null}` (the shapes 30-security:792-801 uses). For a GM or Assistant, write locally.
- G10 (found while reading): CONFIG.DH.RESOURCE (678) is `{character:{custom:{}}}`, so every client warns "resource tables are not built yet; the Actions resource was not registered" (resources.mjs:39-51; 8 lines in val-e03f 10-murder). Fix: the real `{character|adversary|companion: {base, custom:{}, all:{...base}}}` from 2.6.5 resourceConfig.mjs:62-76.
- G11 (optional): foundry.canvas.groups.InterfaceCanvasGroup.prototype.createScrollingText is missing, so no-scrolling-text.mjs:45 logs on every boot.
- Not modelled, and to be listed: dualityUpdate's countdown ticks, triggers and domain cards, damage and armor, game.users.activeGM.

1.6 CLUSTER PLUMBING (cluster.mjs).
- The scenario module is imported BEFORE spawnClient (today at 399).
- Optional scenario export `accounts: [{who, id, name, role, character, color}]` adds seeded users and a client each.
  - IDS.ag = "USERAG0000000000".
  - api gets a handle per account (api.ag).
- New api fields:
  - `opLog`: pushed in the "op" case after apply, as {who, action, coll, docId, embeddedName, at};
  - `settingLog`;
  - `legacyKeys`;
  - `disconnect(who)`: SIGTERM, await exit, set the world User active=false, then broadcast `{t:"userActivity", userId, active:false}`. client-entry's new case sets `user._source.active` and calls `Hooks.callAll("userConnected", user, active)` [recalled v14 flow, LIVE-E30-05].
- `entry.gone` is skipped by broadcast (272-277) and the socket relay (332-336); a gone handle's eval rejects at once.
- socketTraffic (326) records `action` (args[0].action) and `to` (recipients, or "all").
- GM_ONLY_COLLS is removed (section 8).
- Orphan hygiene. The plan notes record orphaned client-entry processes after runs, and the fatal path (432) exits without "shutdown":
  - client-entry adds `process.on("disconnect", () => process.exit(0))`;
  - cluster adds `process.on("exit", () => kill every live child)`.
  - Measure with `pgrep -f client-entry.mjs` after a forced fatal: expect 0.
- Result JSON adds `kind` ("scenario" or "probe"), `layer`, `environment`, `legacyKeysIgnored`, and the opLog truncated to 500.

2. LANDING ORDER. Each item is one commit. Run 01-runtests plus the 13 scenarios before and after each one, and put the numbers in the message. Every difference is explained in the commit or reverted.
- (1) S14-23 + S14-30. Expected: 10-60 and 01 identical; 00-boot turns green.
- (2) Operators + legacy no-op + unsetFlag + futil + globals, as ONE commit. Expected: identical.
- (3) migrateRemnants fix + R151-R153. Before the fix, record R151 red at remnants.mjs:1881 and R152 red on the tree from (2).
- (4) Roles + server gate + accounts/opLog/disconnect + 17-assistant. Existing results identical; 17 is new.
- (5) Versions. Identical.
- (6) Daggerheart surface. See 3.
- (7) Stylesheets B. The biggest diff, with the C fallback.

3. PREDICTED RESULT CHANGES (by reading; not run)
- Roles: no existing scenario or suite test in the default world. Roles in the seed are 4 and 1. The only role writes are 30-security.mjs:765 and :768 (a forged role 4, refused) and :834 (reset to 1). All new behaviour is in 17-assistant.
- '-=': the harness uses it at futil.mjs:131 and shim.mjs:254 only. scripts/ builds it in exactly one place, remnants.mjs:1881 [measured by the R151 prototype over all 108 files; the crawl reaches all 108]. migrateRemnants is not exercised by any scenario or suite test, so existing results stay the same. That holds ONLY if unsetFlag moves to ForcedDeletion in the same commit. Otherwise these silently stop removing:
  - 10 module sites: call-effects.mjs:251 and :271; chapter.mjs:296 (the revive that restore() uses on every tier-2 murder); fog.mjs:545; monocub.mjs:83 and :123; murder.mjs:2782; season-setup.mjs:1117; vault.mjs:539; utils.mjs:490.
  - tests.mjs:12760 and :12775.
- replaceFlag: it takes the one-write ForcedReplacement branch from (2) on. Sites: action-rolls.mjs:794 and :832, reroll.mjs:258 (the lastAction bookmark). Results stay identical with futil support; updateActor then fires once instead of twice.
- Hook readers now see deletions: voice.mjs:103-106 (revive triggers scheduleReconcile), truth-bullets.mjs:1184-1187, remnant-ring.mjs:112.
- Versions: none.
- Daggerheart surface:
  - 20-crit-hope stays +2 and +1 only with G1 and the stated automation;
  - player rolls (12-social p1, 40-flow p1 Search, 10/13 opening rolls) now send relay traffic;
  - Fear from player rolls feeds relay-guard's busy-Fear note (FEAR_STEPS_NOTED 4 within 10 s), so notification and whisper counts in 13 and 40 may move;
  - re-run 30-security (D22 second pass);
  - G10 registers the Actions resource headless for the first time.
- Stylesheets:
  - custom-property answers change: `--drpg-window-max` 1700 -> 1400 (utils.mjs:941, tests.mjs:13819); `--drpg-scale-in` 1 -> 0.96 (motion.mjs:344); glass tokens resolve (glass.mjs:112, :554, :963, :2603, fog.mjs:1766, tests.mjs:7118, :7453);
  - standard properties change as in 1.3;
  - the 16 skips should hold, because cascadeAvailable and layoutAvailable stay false; verify;
  - 01 wall time will grow; measure it.

4. S17-01, migrateRemnants, and the tests
- utils.mjs, next to replaceFlag: NEW `export function forcedDeletion()`.
  - Operator = foundry.data?.operators?.ForcedDeletion. If present: Operator.create?.() ?? new Operator(); else globalThis._del ?? null.
  - Header: `-=` removes nothing here (the measured notes); R151 enforces it.
- remnants.mjs:1839-1899. Split into exported `migrateRemnantToken(token)` plus the loop. R152 must never migrate a real table's traces.
  - (a) Read the old flags as today (1859-1871) into fromToken.
  - (b) S05-43: if this browser's ledger already holds a live entry for keyOf(token), patch only the fields it lacks. Never put the neutral token name back over `label`. Count `moved` (new entry) and `filled` (backfilled) separately.
  - (c) keys = REMNANT_FLAGS values except isRemnant that are present on the token.
  - (d) One write: drop = each `flags.${MODULE_ID}.<key>` -> forcedDeletion(), plus the name and texture.tint as today. If forcedDeletion() is null, fall back to unsetFlag per key.
  - (e) READ BACK, per migrate.mjs's rule: keys still present go to `failed` as "scene/token: keys"; otherwise `stripped++`.
  - (f) The summary line and return value add `filled` and `failed`. Nothing in scripts/ reads the return value; only api.mjs:648 exposes it.
- R151, tier 0 (REGRESSIONS; tests-tier0.mjs after the split): "no update deletes or replaces a key with the old '-=' / '==' spelling, which v14 ignores".
  - Kit helper `stringLiterals(code)` returns string and template literals (template holes kept as "${}"), with start and end positions; regex literals are skipped.
  - For every file of moduleSources() (all tests* files included), after stripComments, flag a literal whose text matches `(?:^|\.)(?:-=|==)(?=[A-Za-z0-9_$]|\$\{)`. The exception is a literal followed by `\s*\]?\s*in\b` (a membership read, as truth-bullets.mjs:1186).
  - Build the needle at run time so R151's own source holds no match. Self-check a run-time-assembled positive sample, so an empty scan cannot pass.
  - Prototype over the 108 files [measured]: violations = remnants.mjs:1881 `flags.${}.-=${}` only; reads skipped = truth-bullets.mjs:1186.
- R152, tier 2 (SCENARIOS): "a legacy trace loses its answer key when migrated, and a second run keeps the GM's corrections".
  - Fixture: placeRemnant, then token.update(flags: remnantType/visibility/note/sourceName...), then dropRemnantSecret, which simulates a pre-ledger trace.
  - migrateRemnantToken: `_source.flags[MODULE_ID]` holds only isRemnant, and remnantData(token).note equals the old note.
  - setRemnantSecret({note: "SUITE GM correction"}), migrate again: the note is kept, moved 0.
  - finally: drop the entry and delete the token.
  - Red on the faithful harness before the fix, green after. On the old harness it would pass, because `-=` deleted.
- R153, tier 2: "a replaced flag keeps nothing of the old value, and an unset flag is gone". On cast()[0]: setFlag {a:1, stale:true}; replaceFlag {a:2} gives exactly {a:2}; unsetFlag leaves no key in _source. At Dawid's table this measures v14's operators through the module's own helper.
- Numbers R151-R153 are the next free after R150 at 411d4da. The E30 integration allocates the final numbers.

5. NEW audit/harness/scenarios/17-assistant.mjs
- Exports: `export const layer = "ci"`; `export const accounts = [{ who: "ag", id: "USERAG0000000000", name: "Assistant", role: 3, character: null, color: "#aa66ff" }]`; `run({gm, ag, p1, p2, check, settle, opLog, socketTraffic, disconnect, IDS, repoUrl})`. Imports utils, secret, fog and gm-bridge through `${repoUrl}/scripts/...`.
- The accounts/disconnect mechanism is what E38's 82-two-gms reuses for gm2. It is not a second harness.
- A, who is a GM:
  - A1: ag has {role 3, isGM true}.
  - A2: gm, p1 and p2 see game.users.get(ag).isGM.
  - A3: primaryGmId() === IDS.gm on gm, ag, p1 and p2, and isPrimaryGm() only on gm.
  - A4: game.drpg.relayGuard().state === "ok" on ag.
  - A5: a card sent through game.drpg.whisperToGms: ag reads its words (secret.mjs contentOf); p1 holds the message but not the words.
  - A6: after fog.setDiscovery on gm, ag's discoveryLedger holds the union (FOG_LEDGER, fog.mjs:794-799) and p2 holds none of it.
- B, one writer with two GM clients (mark opLog and socketTraffic before each step):
  - B1: p1's own-Hope relay packet (the 30-security:800 shape) gives exactly 1 Actor update, by "gm", and the right value on gm and ag.
  - B2: p1's forged Botan-Hope packet: 0 writes to Botan; exactly one "Refused a Daggerheart" line on gm (sessionFailures) and none on ag.
  - B3: p2's fog.request to activeGmIds gives exactly one `fog.rows` packet, from gm (fog.mjs:800-803).
  - B4: requestGiveItem from Botan's owner (the 30-security:112-117 control) moves exactly one item, with one embedded create and one delete, by gm.
- C, what an Assistant may do (in this order):
  - C4: poolCandidates() includes ag and monokumas() excludes it; after game.drpg.addPool(ag), monokumas() on gm and p1 include ag; then removePool(ag).
  - C1 (harness model; LIVE-E30-04): ag's own `user.update({role:4})` is refused by the server, and the role stays 3.
  - C2: ag emits DhGMUpdate/DhGMUpdateDocument {role:4} for its own User uuid; the world User ag stays role 3.
  - C3: ag emits DhGMCreate of a User with role 4; the user count is unchanged.
  - A finally block has gm restore ag to role 3 and delete any created user. Otherwise ag's id would sort ahead and become primary.
  - PREDICTED RED ON 411d4da: C2 and C3. relay-guard.mjs:297 (onRelay) and :250 (neutralise) wave through any `sender.isGM`, and the primary full GM then performs the write.
  - Daggerheart never relays for a GM-flagged client. emitAsGM runs locally when isGM (2.6.5 socket.mjs:135-142, 2.10.5 :143-150). Its direct GMUpdate emits (companion-settings.mjs:74, base-actor.mjs:388 and :396) fire only for a non-owner, and a GM owns everything. So any such packet from an Assistant is not Daggerheart's.
  - Smallest fix, which belongs to the E03 area and fits D22's second pass: forward unjudged only when sender.role === CONST.USER_ROLES.GAMEMASTER; an Assistant goes through judgeRelay like a player (levelOf :656 still gives it OWNER).
  - Otherwise C2 and C3 carry expectedRed(stage, why). Never a weakened check.
- D, the full GM leaves:
  - disconnect("gm").
  - D1: primaryGmId() === ag on ag, p1 and p2.
  - D2: as B1, written once by "ag".
  - D3: as B2, refused on ag.
  - D4: as B3, answered by ag (emitToGms goes to activeGmIds = [ag]).
- E: __errors empty on every live client (gm checked before D).
- Predicted: A, B, C1, C4 and D green by reading: relay-guard :291, gm-bridge :1820, fog :801, utils :150-157, despair :110-154. D depends on the userActivity model.
- Registry row: 17-assistant | ci | E30 | an Assistant GM is a GM; one writer; handover.

6. 00-boot.mjs
- `export const layer = "ci"`.
- 29-30: the check covers only keys starting "DRPG.". Foreign keys (voice.mjs:174-178 localizes LiveKit's own keys) go into details as evidence.
- 23-26: the constant `check(true)` becomes a real one: no error-level notification during boot.
- 19-20: assert the shape of getClock() (an object with phase), not "not null".
- New "the host is the Foundry it says it is" block (probe flag on Daichi, restored):
  - isGM for roles 1-4 is [false, false, true, true], using `new CONFIG.User.documentClass({role})`;
  - a `-=` write removes nothing and appears in legacyKeys;
  - ForcedReplacement and `_del` work on gm AND p1;
  - unsetFlag removes;
  - stylesheets 6/6 with layerName "modules" in manifest order;
  - body `--drpg-window-max` === "1400px";
  - every environment version has `from`.

7. S14-23
- audit/harness/.gitignore gets `results/`. `git rm -r --cached audit/harness/results` removes 19 tracked files: 00, 01, 02-07, 10-14, 20, 30, 40, 50, 60, 90-a11ycost.
  - All were committed at 9808697 (1.2.50) and are older than every scenario they describe. 01 says 141/0/9. 06 is PASS with "102 passed, 9 failed". 03 is 0/2. 90-a11ycost has no scenario in the repo.
  - The files also hold the four em dashes AUDIT-1.2.13:747 left there on purpose.
  - No committed reference run: CI artifacts replace it.
- Move 02-07 with git mv to audit/harness/probes/ (numbers retired, not reused). Each exports `probe(api)` returning evidence and never calls check.
  - cluster.mjs accepts `probe`: kind "probe", results/probes/<name>.json, exit 0 unless it threw. Probes are not in any layer, so run-all skips probes/.
  - 07-apimap returns the sorted keys instead of writing /tmp/drpg-api-keys.json; it is superseded by tools/api-surface.json (D25).
- NEW probes/README.md: "Tools, not tests"; how to run (`node cluster.mjs probes/<x>.mjs`); one line each:
  - 02 rooms/grantItem/music/secret context;
  - 03 equipment loop + objection music, duplicates of suite tests;
  - 04 objection music state;
  - 05 Playlist.playSound on the shim;
  - 06 tier 2 with music on, prints FAIL lines;
  - 07 the game.drpg key list;
  - "a probe cannot pass or fail; delete it when what it probes is gone".
- audit/README.md:20 ("results/ - zapisane wyniki") becomes: written per run, ignored by git.

8. S14-30 (both verified)
- tools/pixel-icons.py:105: delete. [measured] The generator was run on two scratch copies, with and without the line: pixel-sprite.svg, pixel-icons.css and identity-audit-v13.html are byte-identical, and equal to the committed files.
- cluster.mjs:106-107 (GM_ONLY_COLLS) and :147: delete. :148 `return false` stays, with one line: "everything not allowed above is refused; per-permission creation (TRUSTED journals, player macros) is not modelled".

9. DOCS AND LIVE CHECKS
- NEW section in audit/harness/README.md, "What the harness cannot do", with a 6-line summary in CLAUDE.md next to "it is not a browser":
  - no layout, canvas, fonts, audio or WAAPI;
  - CSS: real sheets and a real custom-property cascade; standard properties keep var() unresolved; calc()/color-mix() are not evaluated; cascade layers are unverified;
  - the server gate models ownership, world settings from role 3 and the role-escalation rule, and nothing else of the permission matrix;
  - operators as modelled, legacy keys ignored and reported, the wire form is the harness's own;
  - users: activity only through disconnect, no logout on a role change, no activeGM;
  - Daggerheart: 2.10.5 relay code, the roll pipeline modelled (G1-G11), no sheets, dialog, countdown UI or triggers;
  - every message reaches every client;
  - client settings live per process;
  - i18n en.json only (plus companions with DRPG_FOUNDRY_DATA);
  - dialogs from a queue or as real windows;
  - versions with `from`;
  - no reload (E38).
- Each modelled-but-unconfirmed item names a live check. The result JSON lists the ones not yet run as environment.unconfirmed.
- CLAUDE.md edits:
  - Running table: thirteen scenarios, 00 10 11 12 13 14 15 17 20 30 40 50 60; plus a probes row.
  - "four jsdom clients (five in 17-assistant)".
  - Things that will bite: "delete a key with forcedDeletion() or unsetFlag; '-=' removes nothing (R151)".
  - The R numbers.
- CONTRIBUTING.md:53: likewise.
- Append to AUDIT-1.2.42.md §9.2, run later by audit/live:
  - LIVE-E30-01: an update with a `-=` key on v14. Is the key kept, is a literal key stored, is a warning logged?
  - LIVE-E30-02: the API: ForcedDeletion/ForcedReplacement.create vs new; `_del` a value or callable (Daggerheart calls `_del()` once, action-base-config.mjs:590).
  - LIVE-E30-03: the shape of `changes` in preUpdate/update hooks for unsetFlag, `_del` and `_replace`.
  - LIVE-E30-04: an Assistant's direct role 4 refused; an Assistant writing a world setting allowed.
  - LIVE-E30-05: the client flow for another user disconnecting (userConnected, active); logout on one's own role change.
  - LIVE-E30-06: 17-assistant C2/C3 on the sandbox with an Assistant account.
  - LIVE-E30-07: migrateRemnants twice on a DRPG_FIXTURES copy of a pre-ledger world (the brief's "on an old world first"): counts, `_source.flags` before and after, the ledger diff.
  - LIVE-E30-08: the installed DSN, iso, livekit and Daggerheart versions, which refresh versions.json.
  - LIVE-E30-09: module CSS attached as @import layer(modules) on v14.

10. VERIFY MAPPING (brief)
- "Rola 3 jest GM-em": 17-assistant A1-A3 and 00-boot roles.
- "'-=' nic nie usuwa": 00-boot legacy check and R152 red before the fix.
- "Test '-=' wskazuje remnants.mjs:1795 przed poprawką i jest zielony po niej": R151's failure names remnants.mjs:1881 on the tree before (3), and it is green after.
- "harness czyta sześć arkuszy i wersje z module.json": 00-boot stylesheet and version checks, plus result.environment.