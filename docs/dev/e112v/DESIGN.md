# E112v - the opening's veil without Foundry's `hidden` (road (b))

Line claude/e112v-118, from the 1.2.117 integration tree (a1d294ef). The defect: LIVE-E112-01, read by the owner's local
run L1 on Foundry 14.370, 16.11.2026 (claude/e58-local, docs/dev/e58/LOCAL-REPORT.md, step 7): the veil set Foundry's
`hidden` on the killer's tokens; on v14 a hidden token is drawn for its owner but is not its owner's vision source
(`_isVisionSource()` false), and every player observes every character (the module's ownership default 2), so Foundry
gave the killer's browser the sight of an observed token - the victim's. The owner's decision (16.11.2026): road (b),
veil without `hidden`, by the module's own per-browser hiding, as the rooms hide a token.

Written before any code changed; the survey reads the tree at a1d294ef.

## 1. What the veil writes today, and what reads it

| Where | What it does with the veil today (a1d294ef) | On road (b) |
| --- | --- | --- |
| mask-gm.mjs `veilPatch` | `{ hidden: true, flags.danganronpa-rpg.veiled: true }` on every token of the killer (and a third on the killers' side) on every scene | `{ flags.danganronpa-rpg.veiled: true }` alone |
| mask-gm.mjs `unveilPatch(hidden, gone)` | writes the token's own `hidden` back and removes the flag | removes the flag alone; `hidden` is not the veil's to write |
| mask-gm.mjs `veilActor` | keeps each token's own `hidden` on the GMs' row (`veilStore`, `tokens[].hidden`) | the row lists the tokens without `hidden`, and says it hides by the module (`hides: "module"`) |
| mask-gm.mjs `liftVeil` | writes each row token's kept `hidden` back | a row of road (b): the flag removed, nothing else; a row written by 1.2.116-1.2.117 (no `hides`): its kept `hidden` written back, as before |
| mask-gm.mjs `settleVeilsNow` | lifts rows no opening wants, veils the wanted | also converts a kept row of 1.2.116-1.2.117 at the primary's first settle (its kept `hidden` written back, the flag kept, `hides: "module"` on the row), so a world updated mid-opening loses the veil's `hidden` at once |
| mask-gm.mjs `adoptToken` | a token made behind a veil joins the row with a `hidden` kept, and takes `veilPatch` | joins the row, takes the flag; its own `hidden` is left as made |
| visibility.mjs `tokenShownTo`, the veil branch | owner "show", the killers' side by the room rule, everyone else "hide" - below the Spectator's line, so a Spectator's browser left the token to Foundry, whose `hidden` hid it | the same verdicts, and a Spectator's browser "hide" (LIVE-E112-01 (g): a Spectator does not see the killer during the veil, the default the owner may change). The branch moves above the Spectator's line, below the Spectator's own token and the GM |
| visibility.mjs `show()` | forces a token shown unless `document.hidden`, except a veiled one (the veil's `hidden` overruled for the owner and the killers' side) | the exception goes: a veiled token carries no `hidden` of the veil's, so a `hidden` on it is a GM's, and a GM's hide is respected as on any token |
| visibility.mjs `movePass` / `passForTokenUpdate` | a `hidden` change asks a whole pass and the ruler again (owner-116) | the veil's write is a flag change alone, which asked nothing: a change of `flags.danganronpa-rpg.veiled` (set or removed) asks a whole pass and the token's ruler again, as `hidden` does - "all", not "one", because a third on the killers' side reads the cast as well as the token |
| visibility.mjs `rulerShownTo` (O116, R7523) | GM always; owner always; anyone else: not for a hidden token, else as `tokenShownTo` | unchanged code; a veiled token is no longer hidden, so the ruler follows `tokenShownTo` exactly: the killer and GMs see it, the killers' side where the room rule shows the token (today never: `hidden` refused it), every other browser not |
| visibility.mjs `hide()` | the token, its mesh, nameplate, bars, tooltip, effects, border, the ruler | the same parts, now the only thing that hides a veiled token on a victim's or bystander's browser |
| visibility.mjs `hideSilhouettes` (Isometric, R7407) | matches a silhouette to a token whose `visible` is false | unchanged: the module's `hide()` writes `visible = false` as Foundry's `hidden` did; a real canvas is LIVE-E112-05 and LIVE-E112V-02 |
| utils.mjs `hiddenByGm` | `hidden && !veiled` - the veil's `hidden` is not a GM's | `hidden` alone: the veil writes none, so a `hidden` on a veiled token is a GM's. Its readers (body.mjs, echoes-gm.mjs, fog.mjs, frisk.mjs, gm-panel.mjs, movement.mjs, murder-rules.mjs `maybeThirdParty`, tail-gm.mjs) keep their meaning; a killer the GM hid by hand before the murder is now out of the room as any GM-hidden token (until now the flag let them back in) |
| voice.mjs `ownVeiled`, `veilMutedIds`, `settleTrialVoices` | the killer's microphone off off the flag and the GMs' row | unchanged: neither reads `hidden` |
| fog.mjs (the killer clears their own fog, 4190) | skips `hiddenByGm` tokens | unchanged |
| Raw `token.hidden` reads of character tokens (body.mjs 790/979/1087, body-tile.mjs, monocub.mjs 609, murder-rules.mjs 3265, trial-scene.mjs) | the victim's body, a Monocub, the trial hall's cast | none of them reads the killer during an opening; unchanged. trial-scene.mjs reads the hall, and the veil ends before the trial (E112 item 6) |
| Combat and turn markers | the veil never wrote a combatant; a turn marker is drawn on the token | unchanged on the documents; drawn or not with the token (`visible`) - a real canvas, LIVE-E112V-02 |
| The token HUD | a player opens it on a token they own | unchanged: the killer's own; nobody else owns it |
| Nameplates | Foundry draws none for a hidden token; the module's mask draws "?" (`drawMaskName`) | hidden with the token by `hide()` on every browser that hides it |
| Sounds | no sound is drawn from a token; the cards the veil posts are veiled | unchanged |
| Voice (LiveKit) | the killer's microphone held (`micHold` reason "veiled") | unchanged: who hears the killer is the microphone, not the token |
| The Calls on the opening (`TAKES_CALLS`) | no reading of `hidden` | unchanged |
| world-secrets.mjs | no rule names `hidden`; the flag `veiled` on a token is no secret rule's | unchanged |
| The console scans | scenario 21 lists flagged and hidden character tokens and resolves them by actorId (known leak `foundry-veiled-token-actor`) | the hidden list is empty; the flagged list still names the killer - section 3 |
| Tests that assert the veil's `hidden` | R7405 (tier 1: the patch), tier 2 "E112 - the opening veils ..." (veiled = hidden and flagged; the failure road gives back the GM's hidden; the lights write `hidden` once), scenario 21 'road' (hidden and veiled on every browser) | rewritten to the new patch, with new R7700-R7709 tests red first (section 4) |

## 2. The rule kept

During the veil a browser draws the killer's token only where it did before: the killer's own browser, the killers'
side's (a third on the killers' side, by the room rule where the room rule is on), and the GMs'. Every other browser - the
victim's, a bystander's, a Spectator's - draws nothing of it: not the token, its nameplate, its bars, its border, its
ruler, Isometric's silhouette. Foundry's own rules for the killer's token stay as they are: it carries no `hidden` of the
veil's, so on the killer's browser it is a vision source as any owned token with sight (Foundry's predicate reads
`hidden`; L1 read it false while veiled, true before).

## 3. What a console still reads - the known leak does not close

The coordinator's brief expects `foundry-veiled-token-actor` to close because a console no longer finds exactly one hidden
character. The hidden half closes. The flag half does not: every browser that hides the killer's token has to know which
token to hide, and whatever it acts on a console reads. Today's flag is world data on the token (every browser holds it);
the alternatives move it, they do not remove it:

- the flag stays on the token (this line's default): a console lists the one token carrying `flags.danganronpa-rpg.veiled`
  and resolves its actorId to the killer, as today, without the hidden flip beside it;
- the tokens to hide sent in each hiding player's own cast copy (incident-store.mjs `castCopyFor`): the victim's and the
  bystanders' copies would then name the killer's tokens, against the rule that a victim's or bystander's copy holds no
  killer while the opening waits (scenarios 11, 21, 72 read that), and a console reads its own copy;
- a socket packet to each hiding browser: the same, read off the packet.

So the leak narrows (no `hidden` flip; the console still finds the flag) and stays a known leak. Default: keep the flag;
rewrite the leak's row (known-leaks.json `what`, `foundryLimit`, `measuredAt`) and scenario 21's check to the flag alone;
propose the README sentence to the coordinator (this line does not edit README.md). Asked of the coordinator as Q1.

## 4. Red first

| Id | Test | Red on a1d294ef because |
| --- | --- | --- |
| R7700 | tier 1: `veilPatch()` writes the flag alone; `unveilPatch()` removes it alone; a 1.2.116 row's lift writes its kept `hidden` | the patch carries `hidden: true` |
| R7701 | tier 1: a veiled token after the patch, read by v14's vision-source rule as L1 measured it (a stand-in: a non-GM's token with sight is no source when `hidden`), is a source for its owner | the patch sets `hidden` |
| R7702 | tier 1: `tokenShownTo` of a veiled token: owner show, stranger hide, killers' side show, GM null, Eclipse owner-only, a Spectator viewer hide | a Spectator viewer reads null (left to Foundry's `hidden`) |
| R7703 | tier 1: `rulerShownTo` of a veiled token (after the patch): owner, GM, the killers' side in the room true; the victim, a bystander, a Spectator false | the killers' side reads false (`hidden`) |
| R7704 | tier 1: `movePass` asks a whole pass for a change of the veil's flag, set and removed | it answers null |
| R7705 | tier 1: `hiddenByGm` of a veiled token the GM hid is true, of a veiled token not hidden false | it answers false for both |
| tier 2 | "E112 - the opening veils ..." rewritten: the tokens keep their own `hidden` through the veil and the GM's hidden token stays hidden throughout; the lights write no `hidden` | read `hidden: true` while veiled |
| tier 2 | "E112v - a veil written by 1.2.116 is converted at the settle": a row without `hides`, its tokens hidden and flagged, settled by the primary: the kept `hidden` written back, the flag kept, then lifted to the flag alone | `settleVeils` keeps such a row as it is |
| scenario 21 | 'road': on every browser the tokens are flagged and not hidden; drawn (`visible`) on the killer's browser alone of the three players; the ruler shown on the killer's alone; the console check reads the flag alone | hidden on every browser |

Mutants after the code (each on a copy): the patch writing `hidden` again; the Spectator line back above the veil;
`movePass` not asking for the flag; `show()` overruling a GM's `hidden` on a veiled token; `hiddenByGm` keeping the flag's
exception; `settleVeilsNow` not converting a 1.2.116 row; `liftVeil` writing `hidden` on a road (b) row.

## 5. Open question for the owner (read, not fixed): the fallback onto an observed token

Foundry's vision-source rule for a player (v13's `Token#_isVisionSource` as recalled from its source - not read on this line, no
Foundry source is in the checkout; v14's measured by L1 only for the hidden case and the observed fallback): a token with sight, on a scene with token vision, is a source on a non-GM's browser when it is
controlled, or - when that player controls no token with sight - for every token the player can observe. Every player
observes every character here (the module's ownership default 2). So:

- a player whose own token gives no sight (a dead student's, a token with sight off, no token on the scene, a Spectator)
  sees from every other character's token - L1's "PlayerThree's canvas sees from Aiko's token";
- on road (b) the killer's token is no longer hidden, so on the victim's and the bystanders' browsers it is one of those
  observed sources while they control no token with sight - its sight lights and explores the map around where the killer
  stands, though the module hides the token itself. Until now `hidden` kept it out of that fallback.

Not reached on most tables: with the room fog on, every scene with rooms has token vision off (fog.mjs
`applySceneVisionMode`), and with token vision off nobody's token is a source. It bites a table with the room fog off and
token vision on, as L1 ran. Two roads, for the owner: leave it (Foundry's rules as they are, the owner's road (b)); or
lower the default ownership of characters below Observer, or wrap the predicate so a token this browser hides gives it no
sight - road (a)'s wrapper in a smaller form. Not built here; sent to the coordinator as Q2.

## 6. What only a table settles

LIVE-E112V-01 (AUDIT 9.2 item 600): the killer's vision while veiled on a real v14 canvas, with token vision on: their
own token a vision source, nothing seen from the victim's eyes; the victim's and a bystander's canvases drawing no token,
nameplate, ruler or turn marker of the killer's, and whether the killer's sight lights their map (section 5).
LIVE-E112V-02 (item 601): Isometric's silhouettes of the veiled token on a victim's browser, now that the module hides it
(LIVE-E112-05's scene, with the veil).
