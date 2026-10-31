---
paths:
  - "scripts/**/*.mjs"
  - "audit/harness/scenarios/30-security.mjs"
  - "audit/harness/scenarios/33-bridge-paths.mjs"
  - "audit/harness/scenarios/83-roll-integrity.mjs"
  - "audit/harness/lib/dh-relay.mjs"
  - "audit/harness/lib/dh-dice/**/*"
---

# The trust model (moved from CLAUDE.md)

## The trust model (D2)

A player's browser is trusted with nothing that belongs to somebody else.
Protection comes in two layers, and every change should know which one it
touches.

**Layer one (E03, 1.2.60).** Every request that reaches a GM's client is judged
there: the bridge's three tables (gm-bridge.mjs, traps.mjs, search-tokens.mjs),
the fog socket, and Daggerheart's own GM relay (`relay-guard.mjs`). The
judgement uses who Foundry says sent it (`senderOf(senderId)`), what that user
owns (`ownsActor`, `canSee`, `testUserPermission`), and what the world says now:
the room the character stands in, the incident's stage and turn, the pair a
sabotage wrote, the account an Observe key was minted for, and, since E28
(1.2.67), the GMs' record of the roll a packet names (`rolled`, the store
`rolls`). Nothing is taken back on a player's word: a player's packet that
carries an undo is refused (`guardUndoIsTheGms`, E08), because the Reroll is
made on the GM. Packet fields are claims. A refusal changes nothing and is
logged on the GM. Since E31 (1.2.62) every refusal of a table action is also
told to the asker, with a reason code from a closed list (`REASONS`,
`bridge-guards.mjs`) that the player's client says in the player's own language;
four are not shown to the player, because nobody is waiting on them: a trap
report, the Level Up catch-up, a Search's look for a planted item and a plant
handed back. Daggerheart's relay keeps its own table and log line, and tells the
player with the code `relay`. Since E33 (1.2.69) the primary GM also keeps a row
naming the user Foundry named as the sender or the author (sheet-audit.mjs
`recordTrace`, listed by `game.drpg.sheetWrites()`) for a relay request about a
student it refused (`refused`), a player's message carrying a flag only a GM's
client writes, which no browser reads as drawn (`forged`), and a roll's dice a
player rewrote that it put back, once per message and player, as the GMs are
told (`rewrite`). The user such a row names is Foundry's stamp on the message,
assumed for a player's create and not yet read at a table (LIVE-E33-10).

**Layer two (E28, 1.2.67; E29, 1.2.68).** The numbers - totals, dice, Hope paid,
what a sheet holds - are checked against what the GMs hold. Since E28 a player's action roll and a
statistic clicked on the sheet, thrown while a GM is connected, are drawn on the
primary GM's browser (`roll-draw.mjs`): the dice are the GM's, the resolutions
the GM runs read their result off the GMs' record of the roll (the store
`rolls`), and only the GM's own Reroll takes a result back. So a player can no
longer lie about the dice of those rolls: the GM throws the Hope and Fear dice
and the advantage die at the faces the character's rules give, a critical only
as the dice or the character's own effects make one, the roll's kind (an
action's roll an action, a student's statistic from the sheet a reaction) and
every one of Daggerheart's steps, and refuses a roll built of anything but dice,
numbers and + or -. A roll is drawn for an action its
character is taking - one whose payment the GM saw the player make, the crisis
turn, the opening - and once; a resolution takes only the newest roll of its
action, and a roll's window costs nothing but its experiences' Hope. Since E29
what a drawn roll adds to its dice is the GM's as well: the primary GM throws the
roll its own list makes (`LEGAL_ROLL_MODIFIERS` in config.mjs, each part read in
roll-draw.mjs from what the GMs hold - the statistic by the action's rule or a GM's
pick, an experience only with an Experience Call the GMs hold armed, the Calls'
bonus and dice, each action's situation, Breakdown, a hindering Call armed long
enough before the roll), and what the roller's window configured is a claim: a
difference is recorded on the roll (`game.drpg.rollFlags()`), whispered to the GMs
and named on a card to the roller, and never counted. The claim's dice are read in
every way a term can differ - a Hope or Fear die at other faces, in another number
or with a modifier of its own, the advantage die at faces not the list's (E33 fix
r1-G2) - and named `dice`: a trace, not an award, since the GM throws its own
terms. The Calls that change a roll
are bought on the primary GM (`call.arm`, which takes the Hope there - an Experience
or an Ultimate only with the yes a GM gave on its card, which the primary keeps), so
a drawn roll applies only the Calls the GMs hold armed, and a Reroll throws again
from what the GM counted (the record's `scored`), never from a claim.

The sheet is the other half of layer two (E29). A player's writes on a student
they own - its resources, statistics, maxima, rules and bonuses, the module's
flags, its module items and the effects on either - are judged on the primary GM,
one after another per student, against what the GMs hold (`sheet-audit.mjs`, the
store `sheetMarks`). Every module write goes through one road that names its
reason from a closed list (`trustedWrite`, `trustedCreate`, `trustedDelete`,
`WRITE_REASONS` in resource-guard.mjs); a reason is a claim, like a packet field,
and the GM checks the evidence it names - a payment it saw, a Rest's stamp, room
and picks, an item used and spent, a Call's price, a Search's record. A
`discard` is the case where the stamp alone once stood: since E51's fix round
(31.10.2026) its evidence is a one-use ticket the primary GM writes only after
it placed the discard's trace (`noteDiscardTrace` / `takeDiscardTrace`), and a
discard-stamped delete without one is flagged like a bare delete. What
nothing covers is put back at once and the writer told (Hope as a delta,
statistics, maxima, rules, bonuses, the GM-only flags, an armed Call added -
or, where it hinders or a GM armed it, taken off with no roll of the player's
behind it - a module item's protected flags, an effect that counts), or flagged
to the GMs on a card
with Undo and Keep (Health, Sanity, actions, the free grants, a module item
deleted or created); the rest is listed (`game.drpg.sheetWrites()`). What changed
while no GM was connected is compared at the primary GM's ready and goes the same
way, the rest on one card. With `lockPlayerResources` off the fields its text
names are only listed; items and effects are judged either way. The relay's own
requests for a student are held to the same rule (`relay-guard.mjs`). The guard on
the writer's own browser - resource-guard.mjs's hooks, and the display-only pips
on the sheet, the Party sheet and the token HUD - is a courtesy: it keeps an honest
sheet honest and tells the player early, a console steps past it, and the
protection is the primary GM's.

Since E33 (1.2.69) both halves are measured as an opponent would. R220 is the
census: every document write in `scripts/` is read off the source and held to one
of three - E29's road with a reason of the closed list, a GM's own, or not a
student's - so a road a player's browser could take without a reason fails the
suite before it ships (C1a, C1b). Scenario 83 (`83-roll-integrity`, in `npm test`
and the local gate) drives every legal road of a player's roll and sheet from that
player's own page, as a console would call the module, and reads the GMs' records
before and after: a legal road must raise nothing - no flag, no row, no whisper, no
refusal - and each forgery from a console must leave exactly its one trace naming
its sender (`rollFlags()`; the `sheetWrites()` rows `refused`, `forged` and
`rewrite`), undone or never applied. A burst of one sender's refused requests or
forged messages about one student inside half a minute is one row, which counts
them (`times`) and keeps every path they named. The harness throws Daggerheart's own roll
classes and runs a glue of its roll window for it (`audit/harness/README.md`,
"Daggerheart's dice"); LIVE-E33-01 is the same scenario on a real Foundry.

What stays open: a roll not drawn - one thrown with no GM connected (an action
waits; any other roll is stamped and moves nothing until a GM grants it, on the
dice the player's browser reports, and the GMs' card shows what it claimed beside
what the list would give), every roll on a Daggerheart build the draw was not
written for (thrown in the player's browser, the GM told once per version), and
Daggerheart's own item rolls, its damage rolls and the rest of its rolls; the
Hope such a roll earns, which the GM credits against that player's roll message
of the last minute, whose dice are that browser's (a `covered` row names the
message, fix r1-G1); the Calls such a roll's
window spends there, where one that hinders or that a GM armed stands taken off
only behind that player's roll message about the character, which a console can
write first; the resources of any actor
that is not a student (companions included), Fear one step at a time, and the
countdowns the rules tick or the GM gave them - all through the relay;
`relay-guard.mjs` lists the rest. A Hope Call that changes no roll is paid on the
roller's browser - a fall, which always stands - and what it grants is judged
against that payment. A trace an action
leaves is placed at the roller's browser's request: the GM holds a Search's,
Sabotage's or Dynamic action's to the band its drawn roll reaches, but a console
that asks for none leaves no trace at all, and a Work's trace on an indirect
murder takes the band its request names. And three readings still made on the roller's browser: which
item a Search draws (granted on the roller's own sheet; the GM holds its tier to
what the Search's record earns); a concealment roll's reading; and Listen's lines,
since every browser holds the tokens. Of 83's forgeries two are watched, not
caught (F4b, F6a); the scenario's comments say what each measures.

The Reroll is the GM's own transaction (E08): asked of the primary GM, paid,
thrown, taken back and replayed there, its steps written in the GMs' journal
(`rerollJournal`) as it goes, so that a reload half way is undone or, past the
point where it can be, handed to the GMs to settle. A player's own rewrite of a
roll's dice - Daggerheart's own rerolls (their chat-menu entries are taken off a
player's menu) or a console - is put back by the primary GM, which keeps each
roll's first dice (`reroll-receipts.mjs`, which wrote the receipts this
paragraph described until E08 and keeps only the dice now); a roll thrown before
that GM loaded is only told.

Daggerheart's relay writes on the GM's client, so every hook there sees the GM
as the author. That is why `relay-guard.mjs` passes only the shapes Daggerheart
itself sends for players, and why a test like "was this edit made by a GM"
(`truth-bullets.mjs`) is only as good as that guard. When a new Daggerheart
changes the relay, the guard refuses on the GM's client what it does not
recognise and tells the GM (on a player's client it passes on only the eight
packet names it has reviewed, because from 2.10.10 Daggerheart runs a name it
has no case for there too; its backstop, which stands in when the listener
cannot be wrapped, cannot hold back a payload that is not an object, which goes
on to Daggerheart's listener - 2.10.11's fails on one before it writes,
measured on the copy in scenario 30 part 8). Read its table before a
Daggerheart upgrade, and see AUDIT §9 for what it assumes about Foundry and has
not measured at a table.
The headless harness runs Daggerheart's real relay, copied verbatim into
`audit/harness/lib/dh-relay.mjs`, and since E33 its dice classes into
`audit/harness/lib/dh-dice/dice/` - re-copy both from the new tag, never edit them.

## How to add a bridge action

A request from a player's client to the primary GM, since E31 (1.2.62). Five
steps; R1b, R162-R166 and the lint rule are there to catch a skipped one.

1. **Name it and say it.** A wire name `domain.verb` as an `ACTION_` constant
   beside its table (gm-bridge.mjs for the bridge; traps.mjs and
   search-tokens.mjs keep their own), and `DRPG.Bridge.what.<action>` in
   lang/en.json and lang/pl.json.
2. **Declare it.** One row `{ label, guards, sanitize, run, answer }` in the
   table. Guards come from `scripts/bridge-guards.mjs`, in the order they are
   asked: `knownSender` (or `gmOnly`) first; for every id the run receives
   (sanitized `as.id`, as a field named `...Id` must be), a guard that names
   it (`owns`, `ownsActorAt`, `canSeeProject`, `gmOnly`) or a `claims` line
   saying who judges it. A run that scores a roll names it in `rolled`
   (`{ field, actor, kind }`): the runner hands it the result off the GMs'
   record of that roll, not the packet's (`rollRefusal`, E28).
   `sanitize: pick({...})` lists exactly what the run reads (R163). A
   check that must not wait between itself and the write goes in `prepare`
   (imports) or in the run. `answer` is `"reply"` when the asker says or
   counts anything on it that claims the action was done, and for every
   queued declaration (a queue acknowledges each request as it arrives; R1b);
   `"ack"` when the asker says only that the GM's client has it, or nothing,
   and when the run can wait on a person, as Observe's can; `"none"` for a
   report nobody waits on (and then `quiet`). `patient`, `resend` and
   `timeoutMs` say how the asker waits. `tell` names one code of `REASONS`
   that every refusal is told with, the guards' and the run's; the GM's log
   keeps each one's own reason.
3. **Write the run** `(payload, sender, ctx, prepared)`. It reads only the
   whitelisted payload, refuses by returning `{ refused: "<English reason>" }` -
   the text must map to exactly one code of `REASONS` (R164), and a new code
   needs `DRPG.Bridge.why.<code>` in both files - answers with `{ reply }` when
   `answer` is `"reply"`, and never emits a packet or calls `refuse()`: the
   runner acknowledges, answers, and turns a throw into `failed`. A resolver
   that answers null for work it did not do is a refusal as well,
   `"nothing was carried out: ..."`, told as `refused`: a run never answers a
   done for nothing, and says nothing of which silent reason it was.
4. **Ask it.** `export function requestX(...) { return ask(ACTION_X, {...}, { local }); }`,
   with `local` when a GM runs it on their own client. It answers the bridge's
   result, `{ ok, pending?, value?, refused?, reason? }`, which is truthy
   whatever it says: the caller reads `.ok`, `.value`, `.refused`, `.reason` or
   `.pending` where it asks and never hands the result on (`drpg/bridge-result`,
   eslint.config.mjs), and never shows its own "no GM" or "refused" message -
   `bridgeRequest` has already said what and why, in the player's language.
   `requestCleanableTraces` and `requestObserveTarget` answer their value
   instead, for the callers 30-security reads; the rule names them.
5. **Prove it.** Put the action in a flow (`scripts/tests-flows.mjs`), then run
   the suite (R1b, R162-R166), `npm run lint`, 33-bridge-paths with a legal
   control for the action and 30-security with a forged one; run
   `node tools/registry.mjs --write` when a test was added.

`onIncidentTurn` and `sameScene`, named in E31's brief, are not written: no
request asks either check today (`guardCrisisAction` asks the incident's, as
`guardCrisisUndo` did until E08+E28 C8). When a stage needs one, it goes in `bridge-guards.mjs` beside
the other factories, and nowhere else.

