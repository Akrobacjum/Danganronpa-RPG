# E111 for 1.2.115 - the case's encrypted copy in the world: status

Line: `claude/e111-115`, from the 1.2.115 assembly `claude/fervent-sagan-gme4vt` at 21973f06. Kept as the work goes, so
a restart loses nothing. Every number says where and how it was measured; what was not measured says so.

## What was built

| Item of the brief | State | Where | Answered by |
| --- | --- | --- | --- |
| 1. What: every store with `backup: true`, the backup's file | done | gm-stores.mjs `caseFileNow` (the one builder; `backupCase` saves it, the copy seals it) | R7343 |
| 2. Where: one world setting, config: false | done | settings.mjs `caseSealed` (world, table lifetime), `caseSealKey` (client) | R7344 |
| 3. Crypto: WebCrypto, PBKDF2-SHA-256, 16-byte salt, AES-GCM 256, fresh 12-byte IV | done | case-seal.mjs `deriveSealKey`, `sealCase`, `openSealed` | R7340, R7341 |
| 4. The passphrase: set once, typed once per browser, kept, forgotten, wrong says so, change re-encrypts, a player never | done | case-seal.mjs `setCasePassphrase`, `unlockCaseCopy`, `forgetCasePassphrase`; the case window (gm-stores.mjs `openCaseWindow`, `caseSealAct`) | 34 A1, A4, B2, B3, D2 |
| 5. Write: debounced, the primary, only with the key, never unhydrated, never before reading the copy | done | case-seal.mjs `scheduleSeal`, `sealCaseNow`, `sealRefusal` | R7342; 34 A5, C1-C3 |
| 6. Read: at load and on change, `restoreCase`'s merge; an empty browser without the key is told | done | case-seal.mjs `readSealedCopy`, `sealAtLoad`; gm-stores.mjs `restoreCase` `quiet` | R7343; 34 B1, B3, C1, D1 |
| 7. Health check names the copy | done | gm-stores.mjs `gmStoreHealth` row `sealed` | 34 D3 |
| 8. Texts EN/PL, handbooks 14.8 and 22.14, trust draft | done | lang/*.json `DRPG.Case.row.sealed*`, `DRPG.Case.seal.*`, `DRPG.Tips.Gm.caseSeal*`; GM handbook EN/PL 14.8, 22.14; docs/dev/e111/TRUST-DRAFT.md | `check parity`, `check text`, `check prose` green |
| 9. Tests, red first | done | R7340-R7344 (tier 1), R190's new fixture, scenario 34-case-seal (16 checks) | see "Red first" |

## Decisions taken on a default (deviations from the brief, with the reason)

- **The browser keeps the derived key, not the passphrase.** The brief says "kept in that browser (a client setting)".
  The client setting `caseSealKey` holds the AES key's raw bytes (base64) and the salt it was made with. It opens the
  copy exactly as the passphrase would, so nothing is lost; the words the GM typed, which a person may use elsewhere,
  are kept nowhere. A changed passphrase (a new salt) leaves the old key unmatched, and the browser says so
  ("otherPassphrase").
- **No compression, and padding to 4 KiB.** A player can write text into the case (a pre-session note) and read the
  copy's length after the next write: compressed, the length would say whether their text matched something in it.
  Padded to multiples of SEAL_PAD (4096), a single row's change does not move the length.
- **Additional data.** The format, version, world id and salt are the AES-GCM additional data, so a copy moved to
  another world or with its salt edited does not open ("wrong"), rather than opening as this world's.
- **The read is quiet.** `restoreCase(file, { quiet: true, recheck: false })`: the same merge, no toast, no health check
  of its own, and the stores are not marked restored (their hydration stays the exchange's to say).
- **A copy of another world is not overwritten unasked** (`sealRefusal` "otherWorld"); "Replace the copy" (destructive,
  with a question) is the GM's way out, as for a copy this browser cannot read.
- **New scenario number 34**, not a phase of 61: the 6x decade (GM stores) is full, 60-69 all taken (audit/harness/README.md
  table read 14.11.2026); 3x is security, and most of what 34 asks is what a player can and cannot do.

## Numbers, and how each was measured

- PBKDF2-HMAC-SHA-256, 600 000 rounds, one derivation: 106, 108 and 109 ms, three runs of Node 22.23.4's WebCrypto on
  this machine (4-core Intel Xeon 2.1 GHz), 14.11.2026. A GM machine's browser: not measured (LIVE-E111-02).
- 600 000 is OWASP's password storage guidance's figure for PBKDF2-HMAC-SHA256 (read 14.11.2026).
- Scenario 34: 17/17 checks (D4, the changed passphrase, added after a bug found in review: `sealRefusal` refused a
  GM's own new passphrase as "otherPassphrase", its salt no longer the copy's; the `explicit` case of R7342 holds it).
- Sizes, measured: the seed world's case in scenario 34 is recorded in its results file's notes (`gm: the seed world's
  case ...`, JSON bytes, gzip bytes, the sealed value's bytes). A synthetic planner (scratch script, Node 22, JSON and
  gzip measured; the ciphertext's size computed from SEAL_PAD and base64, not sealed): 1 chapter x 10 slots and nodes
  4474 B JSON, 643 B gzip, 10944 B ciphertext in base64; 6 x 30: 78873 B, 3101 B, 109248 B; 6 x 100: 263673 B, 9892 B,
  355008 B. The synthetic rows repeat the same words, so their gzip ratio (about 27 to 1) says nothing of a real case's.
- A world setting's size limit on a real v14 server: not measured; the harness has no server limit (LIVE-E111-01).

## Red first

- R7340-R7344 and R190, run on the base 21973f06 with this line's tests-tier1.mjs alone (a scratch worktree,
  `DRPG_REPO=<worktree> node run-tests.mjs --tier 1 --only ...`): 6 FAIL (R7340-R7342: case-seal.mjs not found; R7343:
  no `readSealedCopy`; R7344: `{"key":null,"lifetime":null,"only":null,"sealed":null}`; R190: the caseSealed fixture
  found nothing). On this line: 7 passed.
- Scenario 34 C1 (the empty browser), mutant M1 on a scratch copy: `sealRefusal`'s "unread" line dropped and
  `sealAtLoad` writing before it reads - C1 and C3 FAIL ("back":{"plan":{},"schema":{}}: the empty browser replaced
  the copy). M1b, the early write alone with the guard kept: 16/16 (the guard holds). M2, `sealRefusal`'s
  "notHydrated" line dropped: the scenario stays 16/16, because `sealCaseNow` asks the hydration again just before it
  writes (a second guard); R7342 kills M2.

## Gate runs (this machine, 4 cores, 14.11.2026; on the tree committed as this line's first commit)

- `npm run quick` in audit/harness: lint 0 problems, check 24 parts all green (after `node tools/registry.mjs --write`),
  gate self-test 37/37; `node tools/config-prose.mjs --check lang/pl.json`: missing 0, extra 0.
- `node run-tests.mjs --tier 1`: 1707 tests ran, 1692 passed, 0 failed, 16 skipped, 0 red, 550.9 s wall. An earlier
  run on this line (before the last fixes) was 1689/3/16/0: R1256 (the table settings' count, 39 -> 40 with
  `caseSealed`: the test's count moved, with its comment), R4753 (DRPG.Tips.Gm counted exactly: the six new tooltips
  moved to their own family, DRPG.Tips.CaseSeal) and R2063 (a lang text said "restore the case", the old tile's name:
  reworded to "use Restore from a file there") - three intended changes, each answered.
- Tier 2 with `--only`, the 13 tests that name `backupCase`, `restoreCase`, `openCaseWindow` or `gmStoreHealth`: 17
  passed (the 13 and the runner's four), 0 failed.
- Scenarios: 34-case-seal 17/17 (28.1 s); 61-gmstore-case 114/114 (361.8 s); 00-boot 35/35; 72-canary 162/165, the
  3 expected red its known leaks name (foundry-hidden-tokens, foundry-actor-items, S17-64), 0 failed.
- The seed world's case in scenario 34 (its NOTE): 3172 B of JSON, 896 B gzipped, 5732 B the sealed value's JSON.

## Needs a local Foundry

- LIVE-E111-01: the size of a world setting a real v14 server takes and sends, and one write's time from `setSetting`
  to a player's `updateSetting`; the copy after a server restart.
- LIVE-E111-02: PBKDF2's time in the slowest GM's real browser (a console recipe is in the AUDIT row).
- LIVE-E111-03: the owner's second computer: set the passphrase on one, open the world alone on the other.
  All three are rows 547-549 of audit/AUDIT-1.2.42.md 9.2.

## Questions for the owner, each with the default taken

- Q-E111-1: the shortest passphrase. Default: 12 characters (`SEAL_MIN_LENGTH`), and the handbook asks for four or more
  unrelated words.
- Q-E111-2: the copy's write follows a change of the case by 15-60 s, and every browser sees the write: a player learns
  that a GM store changed, though not what. Writing on a fixed beat instead (every few minutes, changed or not) would
  hide that and cost a world write each beat. Default: write on change, debounced.
- Q-E111-3: no compression (for the length reason above), so a large case costs its size plus a third in every write
  sent to every browser (6 chapters x 100 synthetic rows: about 355 KB). Default: uncompressed.
- Q-E111-4: the R numbers R7340-R7344 are stamped E56 in docs/dev/R-REGISTRY.md (registry.mjs stamps the first stage
  that has not shipped, since tools/stages.json has no E111 and this line may not write it). Default: the coordinator
  re-runs `node tools/registry.mjs --write --stage E111` once E111 is registered.
