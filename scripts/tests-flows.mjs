/**
 * Danganronpa RPG - the flows: every way a player reaches the GM (E30, audit S17-03).
 * ---------------------------------------------------------------------------
 * A flow is one thing a person at the table does that crosses from one browser
 * to another: it starts on one client (a control, a `game.drpg` call), is judged
 * or applied on another (the GM's bridge, a socket handler), and shows on a
 * third. The suite runs in one browser and cannot see one end to end; the
 * harness can. So every GM-bridge action and every file that listens on the
 * module's socket belongs to exactly one flow here (or to FLOW_EXEMPT, with the
 * reason), and every flow names the harness scenarios that drive it - each of
 * which tags the checks that do with `phase(name, { flow })` or a check's own
 * `flow` - or, where none does yet, the stage that is to write one.
 *
 * Read by R160 (tier 0, through the kit), which holds it to the bridge's tables
 * (GM_HANDLERS until E31) and the socket listeners in the source, and by `node tools/check.mjs registry`, which
 * holds its scenarios and stages to audit/harness/README.md and tools/stages.json.
 * It imports nothing, so Node can read it as it is.
 *
 *   entry.bridge   the bridge's table actions (BRIDGE_ACTIONS, TRAP_ACTIONS, SEARCH_ACTIONS, ROLL_ACTIONS), by their wire name
 *   entry.sockets  the files that listen on the module's socket for it
 *   entry.api      the game.drpg calls that start it (R160 asks that they exist)
 *   entry.calls    "file.mjs#function" for a start that is not on game.drpg
 *   suite          the suite's files that drive it besides the tiers (E32 C1: the incident's
 *                  invariant grid, tests-grid.mjs); tools/registry.mjs asks that each exists
 *   status         covered (a scenario drives it end to end), partial, planned
 *   stage          covered: the release it arrived in; otherwise the stage that completes it
 *
 * The first list (E30, 24.09.2026) was checked against the source and the
 * scenarios' traffic that day: 33 actions and 16 listener files, gm-bridge.mjs and
 * sync.mjs exempt. Two scenario claims of the plan's list did not hold and are not
 * made: 12-social rolls with rollTrait, not performAction, so it is not an
 * action-roll scenario; 13-murder-signals checks the murder music (music.mjs, world
 * state), and no sfx.mjs packet crosses in it, so "sound" was planned (covered by 87 since E50 C4). 10-murder
 * places a trace but makes no Truth Bullet, so truth-bullets names 30-security only.
 * And 11-killer-secrecy drives the discovery and checks nothing while it does (its
 * first tagged run: 0 body-discovery checks), so body-discovery names 10-murder.
 * A scenario is named here when its run shows checks under the flow.
 *
 * E04 (26.09.2026) adds the gm-store flow: the GM-to-GM exchange of the GM-only
 * stores (gm-store.mjs), which 61-gmstore-case drives with a GM that joins late.
 * A file whose own GM-to-GM socket the store replaced leaves its flow's `sockets`
 * as it moves (truth-bullets.mjs first), and the flow names 61 for that half.
 * Covered from 1.2.63: 61 drives every part of it end to end - the late empty
 * browser, the exchange, tombstones, Back up and Restore, and the reset's cuts
 * (its phases J, E04 C10).
 *
 * E31 (25.09.2026) adds 33-bridge-paths to the nine flows its checks are tagged
 * with. eclipse-route-veto goes from planned to partial with it: 33 drives
 * `eclipse.move` only as far as a GM who is connected and does not answer (its
 * check B6), not a move allowed or refused. E05 C4 (26.09.2026) adds B13 to the same
 * scenario: a legal crossing counted and answered, and one beyond the allowance refused
 * as `nothingLeft` - the move allowed or refused this paragraph once left to E39.
 * E05 (26.09.2026) adds pre-session-note: the note a player writes for the GMs was a
 * flag on their own User document until 1.2.64, written with no GM at all; it goes
 * through the bridge's `note.save` now, and each player holds a copy of their own
 * (pre-session-note.mjs). 72 and 11 save one, 33 drives the legal road, 30 a forged
 * one, and 61 the road to a second GM and a note kept while no GM was connected.
 * E05 C13 (27.09.2026) makes truth-bullets.mjs a socket file again: which trace a
 * player's own bullets came from left the items' flags for the GMs' rows, and each
 * player holds a copy of their own, sent by a GM and asked of the primary. 72 reads
 * that copy on the finder and on a player who holds none.
 */

export const FLOWS = Object.freeze([
    // E18 C1 (19.10.2026): a Dynamic answer goes by the primary (`dynamic.answer`), which 40 drives from the card's button.
    { id: "action-roll", what: "A player's action roll: the tile, the roll window, and the difficulty a GM rules for a Dynamic action",
        entry: { bridge: ["dynamic.difficulty", "dynamic.answer"], api: ["performAction"] }, scenarios: ["40-flow", "88-flow-length"], status: "partial", stage: "E39" },
    // E08+E28 C14 (04.10.2026): partial - 30 sends a console's Analyze and 40 throws a player's and rerolls it; what the
    // price does when the GM's side refuses is driven by 61 (keysNotOpen) and not tagged here.
    { id: "analyze", what: "Analyze: the price paid on the player's client, the analysis read on the GM's",
        entry: { bridge: ["analyze.resolve"] }, scenarios: ["30-security", "40-flow", "88-flow-length"], status: "partial", stage: "E39" },
    // E12 C5 (11.10.2026): 66-rooms's phase I (a body in a locked room) is tagged with this flow and now named.
    // E12 C12 (11.10.2026): its I1-I4 read whom the discovery counts when a student reached the room past the rules.
    { id: "body-discovery", what: "A body is found: the finder's client asks, the incident moves on, every screen learns of it",
        entry: { api: ["discoverBody"] }, scenarios: ["10-murder", "65-season", "66-rooms"], status: "covered", stage: "<=1.2.50" },
    // E29 C8 (05.10.2026): a player's Call on their own character is bought on the GM too - 40 buys one, 30 forges
    // one on the flag and draws a roll naming it, 33 asks for one with no GM connected. E33 C4 (07.10.2026): 83 arms
    // p2's Experience on his own character and his Support on Aiko, and reads the rolls that spend them clean.
    { id: "call-arm", what: "A Call armed on a character: a player's - for somebody else or their own - paid and armed by the GM",
        entry: { bridge: ["call.arm"] }, scenarios: ["30-security", "40-flow", "33-bridge-paths", "83-roll-integrity"], status: "partial", stage: "E39" },
    // E10 C0 (09.10.2026): 63 drives the trial from Start to a correct verdict's Level Up - a late joiner, a GM's reload
    // in the vote, the verdict's window - as it is at 1e9871c; each of its checks names the E10 commit that changes it.
    // E10 C1 (1.2.71): every step of the vote runs on the primary GM, asked through `vote.run`.
    // E10 C2 (1.2.71): a ballot is cast on the bridge (`vote.cast`), and a late joiner asks for theirs (`vote.ask`).
    // E10 C17 (10.10.2026), measured: one run of 63 (49 checks, 20.9 s) put on the socket from the players
    // advancement.apply 3 times, advancement.ask 9, vote.ask 5 and vote.cast 6; `vote.run`, `advancement.offer` and
    // `keys.charge` not once, because the GM who presses them there is the primary and runs them locally. The offer
    // over the bridge is 33's (an Assistant GM's), the charge 62 P's (gm2 opens the trial; 62 tags it through its
    // `begin` helper, so it is not listed here). No scenario sends `vote.run` from a second GM: partial until E40.
    // E10 fix r2-G6 (1.2.71): the GM's Now on a GM that is not the primary is asked of it through `floor.now`; 63 X sends it from gm3.
    // E79 C16 (1.2.79): an Objection is raised from a player's trial bar (`trial.object`), its Truth Bullet put on it after
    // (`trial.evidence`), and a GM re-points it (`floor.repoint`); 63 drives the three, 33 the legal pair from a player
    // and 30 the forged ones. E79 fix r4-G2: the objector's closed picker withdraws it (`trial.withdraw`); 33 sends it
    // from p1, 30 a forged one from p2.
    // E70 C0 (1.2.90): every GM's change of the floor on a GM that is not the primary is asked of it through `trial.gm`
    // (trial-floor.mjs `floorStep`); 30 sends a forged one from p1. No scenario sends it from a second GM until E70 C1.
    // E70 C5 (1.2.90): the trial's voices - its dead listed and muted at the entry, given back at the exit - are settled on
    // the primary, asked of it through `trial.enter` by a GM that is not (voice.mjs `askTrialVoices`); 30 sends a forged one.
    // E70 fix p1-G2 (1.2.90): every write of the trial's record by a GM that is not the primary - a patch, the reset, the
    // execution, the sentence taken back - is asked of it through `trial.record` (vote.mjs `recordOnPrimary`); 63 R sends it
    // from gm3, 30 a forged one from p1.
    // E70 C7 (1.2.90): a round's step from a participant's browser - the speaker's Done or Pass, anyone's step over once
    // the turn has run out - is asked of the primary through `trial.turn` (trial-prompt.mjs); 67 drives it from the players.
    // E70 C8 (1.2.90): a volunteer for the Closing Argument through `trial.claim` (trial-prompt.mjs); 67 from the players,
    // 30 a forged one.
    // E70 C10 (1.2.90): a Present posted by the primary with its copies, through `trial.present` (trial.mjs `presentDialog`);
    // tier 2 E70-T12 from a player's owner and from another's.
    { id: "class-trial", what: "The Class Trial: advancement offers and asks, the vote and its ballots, an Objection raised, proved and re-pointed, and a round's turns",
        entry: { bridge: ["advancement.apply", "advancement.offer", "advancement.ask", "keys.charge", "vote.run", "vote.cast", "vote.ask", "floor.now",
            "trial.object", "trial.evidence", "trial.withdraw", "floor.repoint", "trial.gm", "trial.enter", "trial.record", "trial.turn",
            "trial.claim", "trial.present"],
            sockets: ["vote.mjs"] },
        scenarios: ["10-murder", "11-killer-secrecy", "30-security", "33-bridge-paths", "61-gmstore-case", "63-class-trial", "67-trial-modes", "88-flow-length"], status: "partial", stage: "E40" },
    { id: "clock-day", what: "The clock: a GM moves the time of day or opens an Eclipse, every client redraws and refills",
        entry: { api: ["setClock", "advanceTimeOfDay", "startEclipse", "endEclipse"] }, scenarios: ["40-flow", "14-quiet"],
        status: "partial", stage: "E37" },
    // E17 C3 (26.10.2026): a GM's "Refund last crossing" (`token.refundCrossing`, gmOnly), given back on the primary from the
    // GMs' record of the crossing; tier 2 E17-T6 judges the row as a player's ask and as a GM's. No scenario drives it yet.
    { id: "crossing-fee-refund", what: "A token sent back to where it stood, and the crossing it paid for handed back",
        entry: { bridge: ["token.sendBack", "token.refundCrossing"] }, scenarios: ["30-security", "33-bridge-paths", "88-flow-length"], status: "partial", stage: "E39" },
    // E08+E28 C8 (03.10.2026): a player's road is gone - a Reroll's point is the GM's own (C4b), and a
    // player's `despair.adjust` is refused (`undoIsTheGms`; 30 and 33 send one). 33's A7 drives the GM road.
    // E17 C5 (26.10.2026): another GM's overflow added on the primary (`overflow.add`, gmOnly); tier 2 E17-T8 judges a
    // player's and a second GM's. No scenario sends one yet. H84-06 (27.10.2026): a GM's Clear of the count on the primary
    // (`overflow.clear`, gmOnly); tier 2 "a GM clears the overflow ... (H84-06)" judges a player's and a second GM's.
    { id: "despair", what: "Despair: an Assistant GM's correction written by the primary, a Despair Call from a GM, the pools every screen shows",
        entry: { bridge: ["despair.adjust", "overflow.add", "overflow.clear"] }, scenarios: ["40-flow", "30-security", "33-bridge-paths"], status: "covered", stage: "<=1.2.50" },
    { id: "discovery-ledger", what: "Which rooms each character has found: written by the GM, pulled and rebuilt by the clients",
        entry: { sockets: ["fog.mjs"] }, scenarios: ["60-ledger", "30-security", "61-gmstore-case"], status: "covered", stage: "<=1.2.50" },
    { id: "eclipse-route-veto", what: "A move during an Eclipse: asked of the GM, allowed or refused",
        entry: { bridge: ["eclipse.move"], sockets: ["eclipse.mjs"] }, scenarios: ["33-bridge-paths"], status: "partial", stage: "E39" },
    // E08+E28 C15 (04.10.2026): 40-flow drives a player's Plant end to end, both of its rolls on the GMs' record.
    // E50 fix FG2 (30.10.2026; the end review's G7): 87-messenger-sound's part E presses a body's Take on a player's page.
    { id: "give-take-stash", what: "Things changing hands: a handover, a plant, a steal, a found stash, a body looted",
        entry: { bridge: ["handover.item", "handover.bullet", "action.plant", "vault.findStash", "action.steal", "action.friskUnseen", "vault.steal", "body.loot"] },
        scenarios: ["30-security", "33-bridge-paths", "40-flow", "83-roll-integrity", "87-messenger-sound"], status: "partial", stage: "E39" },
    // E80 part 2 C3 (19.10.2026): an open Frisk - the ask, the answer from the window the primary opened, the force. The
    // tier-2 tests A11-7 and A11-8 drive it on the primary; 30-security sends a player's frisk.ask and an outsider's answer.
    // E80 fix r1-G4 (19.10.2026; the review's goal-P2-18 and goal-P2-20): 40-flow drives it in three players' browsers -
    // an allow, a force won and lost, silence, the target walking out, a Monocub witness; 30-security sends a stranger's
    // ask and follows. A Frisk's Unseen road (above, in give-take-stash) is 30's console packet, 33's refusal with no GM
    // connected and 83's card with the draw's flags, named as a hand and as a force.
    { id: "frisk-openly", what: "An open Frisk: the ask, the target's answer on its own window, the force after a refusal or no answer",
        entry: { bridge: ["action.friskAsk", "action.friskAnswer", "action.friskFollow"], sockets: ["frisk.mjs"] },
        scenarios: ["30-security", "40-flow"], status: "partial", stage: "E39" },
    { id: "gm-store", what: "The GM store between GM clients: a late, empty browser, the exchange, tombstones, backup and restore, the reset's cuts",
        entry: { sockets: ["gm-store.mjs"], api: ["backupCase", "restoreCase"] }, scenarios: ["61-gmstore-case"], status: "covered", stage: "1.2.63" },
    // E08+E28 C12a (04.10.2026): a player's action roll is drawn on the primary GM (`roll.draw`,
    // roll-draw.mjs). 40-flow draws a Search and a Project on p1's browser and reads the GM's message
    // and record; 30-security sends a forged draw. Partial: the resolutions read the record from C14 on.
    // Covered from C17 (04.10.2026): every resolution that takes a roll's result reads it off the record (R218's
    // list is empty), and 30 and 40 drive a player's drawn roll and a console's packet that names one.
    // E08+E28 C18 (04.10.2026): 15-held drops the GM - an action refused, a statistic stamped - and a GM's
    // return grants it on the GMs' card. Fix r2-H7 (05.10.2026): another GM's click on that card asks the
    // primary (`roll.grant`); the harness has one GM, so 15 clicks it on the primary and R219 reads the waiter.
    // E29 C9 (05.10.2026): what a drawn roll may add up to is the GM's list (config.mjs LEGAL_ROLL_MODIFIERS); 13 reads
    // what the GM counted on every roll of its incidents.
    // E33 C3 (07.10.2026): tier 2 draws p1's roll once per row of the GMs' list (config.mjs `LEGAL_ROLL_MODIFIERS`) and
    // per branch of its `situation`, with the source and without (`MODIFIER_FIXTURES`), and six claims off it; R291 holds
    // the fixtures' keys to the list's. Tiers, not a scenario: the flow's scenarios are as they were.
    // E33 C4 (07.10.2026): 83 drives the plan's eleven legal roads of a player's roll (L1-L11) - a Search, a Work
    // and a sabotage, a statistic off the sheet, an Experience, a Support, a Reroll, a Rest, a Level Up, the incident's
    // rolls, a Monocub's Meddle, Daggerheart's own Hope - and reads each with no flag, no write put back or flagged, no
    // card to the GMs and no "not counted". E33 C5b (07.10.2026): 83's forgeries from p1's console under this flow -
    // F5a (a roll.draw with +5, a guaranteed critical and dice of one face: scored without them), F4 (a message with
    // the drawn flag: not read as drawn, a `forged` row), F6a and F6b (a drawn card's rolls rewritten: refused; p1's
    // own: put back, a `rewrite` row), F5c and F5b (a crisis packet naming a roll no GM drew: refused `rollUnknown`;
    // its total 99: the record's stands) - each read as undone or never applied and traced to p1.
    { id: "gm-rolls-total", what: "The GM checks a roll's total against the roll message it can see",
        entry: { bridge: ["roll.draw", "roll.grant"] }, scenarios: ["40-flow", "30-security", "15-held", "13-murder-signals", "83-roll-integrity", "20-crit-hope"], status: "covered", stage: "1.2.67" },
    // E29 fix r2-H4 (05.10.2026): a GM's yes is kept on the primary for the arm it allows (`call.yes`) - 40 says it on
    // the primary, 33 from an Assistant GM, 30 arms with none and says yes from p1's console. E18 C1 (19.10.2026): the
    // asker's reports that end the card (`ruling.expired`, `ruling.received`, a Dynamic action's too) - 33's A13 reads
    // the card written on p1's receipt and A17 the card p1's clock ended; 30-security's 4b2e (E18 fix e1-G2) forges both from
    // p2's console against p1's open ask, and p1's own expiry ends it.
    { id: "hope-call", what: "A Hope Call that waits for the GM: the card, the ruling, the Hope charged",
        entry: { bridge: ["call.approve", "call.yes", "ruling.expired", "ruling.received"] }, scenarios: ["40-flow", "30-security", "33-bridge-paths", "88-flow-length"], status: "covered", stage: "<=1.2.50" },
    // E12 C0 (11.10.2026): 66-rooms drives the shim's floors (S) and a scene of two floors (G). E12 C9 (11.10.2026): G
    // judges a level-only move - a lock on the floor above refused, the stairs charged as a door, a stairwell's floors
    // free - on the mover's browser; partial until the GM judges the arrival (C12) and the fog is drawn by floor (C10).
    // E12 C11 (11.10.2026): G offers a player their own floor and the floors of rooms they found, sends a view of any
    // other floor back, and shades a floor a console put on screen by the rule of one floor.
    // E12 C16 (11.10.2026): still partial. Since C12 the primary judges every player's arrival again by the veto's
    // rules, the stairs included (movement.mjs `judgeArrival`), and 66 I drives that judge on one floor only - no check
    // drives a floor change past it; what a crossing costs is judged on the mover's browser until E39 (layer two); and
    // G measures the harness's model of levels (lib/shim.mjs `LevelList`), not v14's (LIVE-E12-02, LIVE-E12-03).
    { id: "levels-floor", what: "Levels and floors: a move between floors judged on the GM",
        entry: {}, scenarios: ["66-rooms"], status: "partial", stage: "E39" },
    { id: "mastermind", what: "The Mastermind's doors: asked for and granted across clients",
        entry: { sockets: ["mastermind.mjs"] }, scenarios: ["61-gmstore-case"], status: "partial", stage: "E40" },
    // E08+E28 fix r2-H5 (05.10.2026): while an incident runs a player's private card is asked of the primary GM, who posts
    // it (`card.post`, secret.mjs `askGm`): 13-murder-signals' fight sends the players' cards and a word in the messenger.
    // E50 fix FG2 (30.10.2026; the end review's G7): 87-messenger-sound reads the read state, the counts and a failed send.
    { id: "messenger", what: "The messenger and every private card: the words travel only to the people on the card",
        entry: { bridge: ["card.post"], sockets: ["secret.mjs"] }, scenarios: ["40-flow", "30-security", "13-murder-signals", "87-messenger-sound"], status: "covered", stage: "<=1.2.50" },
    // E18 C3 (19.10.2026): a GM's click on a card sent to the GMs is claimed on the primary (`card.claim`, gm-bridge.mjs
    // `claimCard`) - 61's CL clicks one card on two GMs at once, reopens it, and forges p1's claim; 30-security's 4b2e forges
    // p2's take and done of p1's card (E18 fix e1-G2).
    { id: "card-claim", what: "A GM's ruling on a card sent to the GMs, made once whichever GM clicks",
        entry: { bridge: ["card.claim"] }, scenarios: ["61-gmstore-case", "30-security"], status: "covered", stage: "1.2.83" },
    // E06 fix r2-G4 (28.09.2026): a Confusion's armed Call is the GMs' store and its owner's copy, whose socket
    // is call-effects.mjs's; 40-flow drives the arming on the GM, the copy and a spend on the owner's browser,
    // not the Monocub's own ask. E08+E28 C17 (04.10.2026): the GM throws the Meddle's dice; tier 2 judges a Monocub's
    // packet, and no scenario drove the Monocub's ask. E33 C4 (07.10.2026): 83 does - p2's dead Botan meddles in Aiko's
    // next roll from p2's browser, and Aiko's roll spends it with no alarm. E33 C10: the Meddle is the `meddle` row of
    // the Monocub's table, asked as `monocub.ability` (monocub.mjs `performCubAbility`, `cubAbilityOnGm`); 40 drives
    // the ask end to end, 30 its forgeries.
    { id: "monocub-meddle", what: "A Monocub meddles: asked on the player's side, applied by the GM",
        entry: { bridge: ["monocub.ability"], sockets: ["call-effects.mjs"] }, scenarios: ["40-flow", "83-roll-integrity"], status: "partial", stage: "E45" },
    // Partial until E32 when E30 wrote it (E32's grid was to complete it). At the 1.2.66 release (03.10.2026) four of
    // its five actions are sent from a player's browser in a ci scenario - murder.crisis and murder.betrayal (13),
    // murder.park (30, 61), murder.cleanup (72) - and murder.openingResult in none: each scenario resolves the opening
    // on the GM's browser (grep of the scenarios that day). Still partial, moved to E33, which tests the incident
    // again after E28. E08+E28 C17 (04.10.2026): the opening, the crisis actions and Stage 6 are scored on the GMs' record
    // of the roll they name; 30 sends Botan's player's finishing blow on its record, 10 Chie's player's clean-up and its
    // Reroll, and a player's opening is judged in tier 2 alone.
    // Covered at the 1.2.69 release (07.10.2026, E33 C14c), on a count of packets rather than of the scenarios' text:
    // one run of each scenario on 6dfdca8, with a copy of the harness that kept every murder.* packet, has a player's
    // browser send murder.openingResult in 11, 13, 30, 61, 72 and 83, murder.crisis in 13, 30 and 83, murder.betrayal
    // in 13 (the tile's road) and 30 (two from p1's console, refused), murder.park in 30, 61 and 72, and murder.cleanup
    // in 10, 13, 72 and 83 (72 tags none of its checks with this flow; 19 and 60 send none). So a player's opening is
    // not tier 2's alone: 13 has the killer's player throw it since E08+E28 fix r2-H6 (05.10.2026), and 83's L9 (E33
    // C4) has p3's page throw Chie's opening, take a Finishing Blow and clean up a trace in Stage 6, each drawn on the
    // GM - in that run the GMs' records of the three rolls were p3's and claimed. L9's phase is this flow's since C14c;
    // it was gm-rolls-total's, which 83's other phases keep.
    // E50 fix FG2 (30.10.2026; the end review's G7): 87-messenger-sound's part D plays the murder music on four accounts.
    { id: "murder-incident", what: "The incident: the opening roll, the crisis actions, the betrayal, the park, the clean-up",
        entry: { bridge: ["murder.openingResult", "murder.crisis", "murder.betrayal", "murder.park", "murder.cleanup"], sockets: ["incident-store.mjs"] },
        scenarios: ["10-murder", "11-killer-secrecy", "13-murder-signals", "19-standing-cast", "30-security", "60-ledger", "61-gmstore-case", "83-roll-integrity",
            "87-messenger-sound"],
        suite: ["tests-grid.mjs"], status: "covered", stage: "1.2.69" },
    { id: "pre-session-note", what: "A player's pre-session note: sent to the primary GM, or kept until one connects, and each player's copy of their own",
        entry: { bridge: ["note.save"], sockets: ["pre-session-note.mjs"] },
        scenarios: ["72-canary", "11-killer-secrecy", "33-bridge-paths", "30-security", "61-gmstore-case"], status: "covered", stage: "1.2.64" },
    { id: "private-rolls", what: "A roll made in private: whispered, and hidden from the other players' chat",
        entry: { bridge: ["roll.subject"], sockets: ["private-rolls.mjs"] },
        scenarios: ["12-social", "13-murder-signals", "20-crit-hope", "33-bridge-paths"], status: "covered", stage: "<=1.2.50" },
    // E12 C5 (11.10.2026): 66-rooms's phases A and E (the manager's room, what a player knows of a project) are tagged
    // with this flow and now named.
    // E36 C1 (25.10.2026): another GM's change of a project, made by the primary (`project.change`): 33's A7, 30's forgery.
    { id: "projects", what: "Projects: progress, sharing, sabotage and its undoing",
        entry: { bridge: ["project.progress", "project.share", "project.sabotage", "project.unsabotage", "project.change"] },
        scenarios: ["30-security", "33-bridge-paths", "40-flow", "66-rooms"], status: "partial", stage: "E39" },
    // E08+E28 C2 (03.10.2026): the GMs keep each character's last roll and what they did for it; the roller's browser
    // reports what only it saw (`roll.bookmark`). 30 sends forged reports, 33 a legal one. C4a: the Reroll is asked of
    // the GM (`reroll.ask`) and made there - 40-flow's player Rerolls, 30's refused asks, 13's dice of a rewrite.
    // E08+E28 C4b: 20-crit-hope's rerolled critical, settled behind the players' flag.
    // E08+E28 C5: `roll.bookmark` names the roll's card, and 40-flow reads p1's Search card a Reroll replaced, marked on p1.
    // E08+E28 C8: a player's rewrite of a roll's dice is put back by the primary (reroll-receipts.mjs, a hook, no
    // bridge action); 30 and 33 rewrite one from a player's browser and read it put back.
    // Covered at the 1.2.67 release (05.10.2026): both actions are sent from a player's browser in a ci scenario -
    // roll.bookmark in 30 and 33 (33's phase "a roll's bookmark"), reroll.ask in 40-flow (p1's REROLL_ASK, from
    // its phase "a Reroll" on) and 30 (grep of the scenarios that day).
    { id: "reroll", what: "The Reroll: the GMs keep each character's last roll and what its action did, the roller reports what only its browser saw, and the GM makes the Reroll it is asked for",
        entry: { bridge: ["roll.bookmark", "reroll.ask"] }, scenarios: ["13-murder-signals", "20-crit-hope", "30-security", "33-bridge-paths", "40-flow"], status: "covered", stage: "1.2.67" },
    { id: "safeword", what: "The safeword: one press stops the table on every screen - the primary GM posts the card for a player (E06 C9), the caller only with no GM connected or when no card lands in time (fix r2-G3)",
        entry: { sockets: ["safeword.mjs"] }, scenarios: ["40-flow"], status: "covered", stage: "<=1.2.50" },
    // E17 C4 (26.10.2026): a token the GM spent after the searcher's browser stopped waiting, asked back by the late answer
    // (`searchTokens.returnToken`, the spender's, once); tier 2 E17-T7 judges it. No scenario sends one yet.
    { id: "search-observe", what: "A Search or an Observe: the GM judges it, spends the room's token, grants the find, and only the searcher reads the card",
        entry: { bridge: ["observe.target", "observe.resolve", "observe.pick", "searchTokens.spend", "searchTokens.takePlant", "searchTokens.returnPlant",
            "searchTokens.returnToken"],
            sockets: ["search-tokens.mjs"] },
        scenarios: ["40-flow", "30-security", "33-bridge-paths", "88-flow-length"], status: "partial", stage: "E39" },
    // E29 C3 (05.10.2026): a player's own write on their student - Daggerheart's sheet, the HUD, a console - judged on
    // the primary GM (sheet-audit.mjs), no socket of the module's. 30-security writes a statistic, a maximum, a rule,
    // a GM-only flag and an effect from p1's console; 40 reads a day's writes for false alarms; 61 a statistic
    // with two GMs and a late one. C4 (05.10.2026): Hope - 30 raises p1's by hand, through Daggerheart's
    // relay and before a Call; 20 has p1's own Daggerheart roll cover its Hope through the relay once; 40's
    // day takes a Rest in a rest room. C5 (05.10.2026): Health and actions p1 raises from the console are
    // flagged on the GMs' card, and 30 undoes them from it; 61 has two GMs undo one write at once
    // (`audit.decide`, decided on the primary). C6 (05.10.2026): the module's items - 30 raises a count and stashes
    // from a room with no stash of Aiko's, both put back; 10 unbreaks a knife (put back) and deletes it (flagged,
    // the GMs' Undo makes it again under its id); 40's day stashes, retrieves and discards with no alarm. C7
    // (05.10.2026): 15 has p1's console raise Agility and heal a Health mark with no GM connected - at the GM's
    // return Agility is put back and the mark is asked about on one card, whose own Undo heals it back - and
    // reads a student's token HUD bars display-only for p1. Covered at the 1.2.68 release (06.10.2026): each of
    // the six scenarios tags checks with this flow (30 40, 40 4, 61 8, 20 2, 10 3, 15 6 - grep that day); the
    // write is judged from p1's console and through Daggerheart's relay, compared at ready in 15 (a GM away and
    // back) and 61's W, and decided by two GMs at once in 61's V (`askToDecideWrite`, the card button's road).
    // Not driven, so the audit's live checks instead (AUDIT 9.2, LIVE-E29-02 and -05): the Party sheet's pips,
    // CSS no client of the harness computes, and two GMs clicking the card itself.
    // E33 C1b (06.10.2026): the thirteen bare writes on a student's sheet R220's census left on roads a player
    // reaches take E29's road with a reason (resource-guard.mjs, "THE PLAYER'S OWN WRITES"); tier 2 judges a write
    // of each reason as the player's ("a player's write on the road is judged as E29's table says", "a Call's free
    // action and free Move bought and spent on the module's road raise no row"). 40-flow's day reads the Call its
    // roll window spent covered under `call` now, where its row named no reason. E33 C4 (07.10.2026): 83 reads the
    // writes of a Search's find, a Rest, an item used and a Level Up - each covered or applied, none put back or flagged.
    // E33 C5a (07.10.2026): three more rows name their sender - a relay request on a student refused, a player's message
    // carrying a flag only a GM's browser writes, a roll's dice rewritten and put back - and tier 2 reads each ("a player's
    // message with the drawn flag is not read as drawn and awards nothing and is named once", "a refused relay write on
    // another's student leaves a row naming its sender", "a rewrite put back leaves a row naming the player"; the guards
    // "a GM's card with the same flags stands" and "an H5 neutral card is never a forgery").
    // E79 C1 (14.10.2026): the GMs' records of the secret passages and each player's addressed copy. 76's phase A
    // creates one, grants it, reads p1's copy and p2's and p3's surfaces, forges a copy and sends a junk ask; the
    // move through it (C2-C4), Close and Open (C5) and showing it (C7) are the later phases'. E79 C4: the GMs' audit's
    // word to a player whose token it put back from a wall (movement-audit.mjs `onSentBack`), 76's phase D. E79 C7
    // (15.10.2026): a player shows a passage their character knows to a student beside it (`passage.share`), 76's phase G.
    // Covered at the 1.2.79 release (17.10.2026) on what a harness can read: 76's phases A to G, on the k4t run of 770b06c
    // 71 of 71 checks, seven of them tagged with this flow; what it cannot (a real table's walls, floors, LiveKit and
    // Foundry's own move backend) is LIVE-E79-01..25 in AUDIT section 9.2. E80 C2 (18.10.2026): 'Go through' a tunnel
    // (`passage.cross`), carried out by the primary GM: 76's phase U, 33's A16, and 30's forgeries of it. E80 C3 (18.10.2026):
    // Analyze's Find Passage (`passage.find`), judged on the primary GM from its record of the roll: 76's phase V, 30's forgeries.
    // E80 fix r1-G1 (18.10.2026): a secret door a player changed while no GM was connected is put back when a GM comes: 15's
    // away-and-back.
    { id: "secret-passages", what: "A secret passage: the GMs' records, and each player's copy of the ones their own characters know, sent to them alone",
        entry: { sockets: ["passages.mjs", "passages-gm.mjs", "movement-audit.mjs"], bridge: ["passage.share", "passage.cross", "passage.find"] }, scenarios: ["76-passages", "33-bridge-paths", "30-security", "15-held"], status: "covered", stage: "1.2.79" },
    { id: "sheet-audit", what: "A player's own write on their student: judged on the primary GM, put back, flagged or listed - at the write, or at the primary's ready for one made with no GM watching",
        entry: { calls: ["sheet-audit.mjs#judgeWrite", "sheet-audit.mjs#compareAtReady"], bridge: ["audit.decide"] },
        scenarios: ["30-security", "40-flow", "61-gmstore-case", "20-crit-hope", "10-murder", "15-held", "83-roll-integrity"], status: "covered", stage: "1.2.68" },
    // E11 C13 (11.10.2026): covered. 65-season drives `resetSeason` through its window on a world holding a season (E11 C0-C12:
    // phases A, D, R, F, G, P and S, whose 28 checks carry this flow) and reads the world after it. 61-gmstore-case resets
    // too (three `resetSeason` calls), but tags those checks gm-store, the flow it is about, so it is no longer named here:
    // tools/registry.mjs asks a covered flow's scenarios to tag a check with it.
    { id: "season-reset", what: "The season reset, from the GM panel",
        entry: { calls: ["season-setup.mjs#resetSeason"] }, scenarios: ["65-season"], status: "covered", stage: "1.2.73" },
    // E50 C4 (30.10.2026): covered. 87-messenger-sound's part S counts where sfx.mjs `fire` hands a file to the audio layer
    // (`sfx.played`) on every browser: a GM's sound for one player plays there alone, and a player's forged packets nowhere.
    { id: "sound", what: "A sound played for other browsers",
        entry: { sockets: ["sfx.mjs"] }, scenarios: ["87-messenger-sound"], status: "covered", stage: "1.2.94" },
    { id: "trace-remnant", what: "Traces: placed, tied to the crime, re-rated by a Reroll, cleaned up",
        entry: { bridge: ["remnant.place", "remnant.tieForItem", "remnant.edit", "cleanup.traces", "cleanup.ruling"] },
        scenarios: ["10-murder", "30-security", "33-bridge-paths", "61-gmstore-case"], status: "partial", stage: "E39" },
    // E32+E07 C11b (02.10.2026): the crisis actions ask it; C11c the clean-up, and the openings, which a GM picks on its own browser;
    // C11d a project stored without a statistic, once (40-flow drives a player's first and second Work on one).
    // Covered at the 1.2.66 release: 40-flow's player asks, the GM picks on the card, the roll takes the pick and the
    // project keeps it on both browsers.
    { id: "trait-ruling", what: "A roll that lists several statistics: the player asks, a GM picks on the card in their thread, the roll takes the pick",
        entry: { bridge: ["trait.ruling"] }, scenarios: ["13-murder-signals", "30-security", "33-bridge-paths", "40-flow", "61-gmstore-case"], status: "covered", stage: "1.2.66" },
    { id: "trap-fire", what: "A trap: a crossing reported to the GM, the trap sprung once",
        entry: { bridge: ["trap.event"], sockets: ["traps.mjs"] }, scenarios: ["13-murder-signals", "30-security", "33-bridge-paths", "61-gmstore-case"], status: "partial", stage: "E39" },
    // E13 C3 (12.10.2026): every road into and out of the trial moves the table - the linked hall activated on the way in,
    // the school on the way out (trial-scene.mjs `followPhase`, R113); 41-trial-scene reads it on four browsers and a late one.
    // E13 C3b (12.10.2026): End the trial asks for a room of a place scene and the living go there (`returnTheLiving`, R436);
    // 41-trial-scene i drives its window on the GM.
    // E13 C9 (12.10.2026): the trial hall is a flow of its own, out of class-trial (whose vote and offers 41 never drove):
    // 41's checks were tagged class-trial until now. Covered at 1.2.74 on what a harness can read - the activation, the
    // cast's `hidden`, the late browser, the return, the doors; what it cannot (where a loading browser lands, whether a
    // player may change their own token's `hidden`, the hall's draw) is LIVE-E13-01..11 in AUDIT section 9.
    { id: "trial-scene", what: "The trial hall: every road into and out of the trial moves the table, the GMs' cast shown and hidden, the living taken to the GM's room",
        entry: { api: ["showCourtroom", "showSchool", "trialSceneReport", "openTrialCast"],
            calls: ["trial-scene.mjs#followPhase", "trial-scene.mjs#selfRepair", "trial-scene.mjs#watchCast"] },
        scenarios: ["41-trial-scene"], status: "covered", stage: "1.2.74" },
    { id: "truth-bullets", what: "Truth Bullets: an edit on one end reaches the other, a player's edit is put back, and each player's copy of which traces their own came from",
        entry: { sockets: ["truth-bullets.mjs"] }, scenarios: ["30-security", "61-gmstore-case", "72-canary"], status: "partial", stage: "E38" },
    { id: "voice", what: "Voice rooms: who hears whom",
        entry: { sockets: ["voice.mjs", "voice-client.mjs"] }, scenarios: [], status: "planned", stage: "E58" }
]);

export const FLOW_EXEMPT = Object.freeze({
    "gm-bridge.mjs": "the bridge's own plumbing (gmReady, the Stage 4 invitation, the offers); its actions are claimed one by one",
    "bridge-guards.mjs": "the answers to every request (ack, done, refused), heard for whichever flow asked (E31)",
    "sync.mjs": "the world-state echo every flow rides on; 00-boot and 40-flow read it on every client"
});

/*
 * THE FLOWS WHOSE LENGTH IS COUNTED (E51 C8, 31.10.2026; audit S17-49; E51-49): what scenario 88-flow-length drives and
 * holds, in clicks and windows per browser, to audit/harness/flow-length.json. `name` is the baseline's row, `flow` the
 * flow of FLOWS it is part of (R1133 holds each to one that names 88-flow-length), `from` what stands open when the
 * count starts. The trial console's mode bar is counted a mode at a time.
 */
export const FLOW_LENGTHS = Object.freeze([
    { name: "search", flow: "search-observe", from: "Aiko's sheet on p1" },
    { name: "observe", flow: "search-observe", from: "Aiko's sheet on p1" },
    { name: "analyze", flow: "analyze", from: "Aiko's sheet on p1" },
    { name: "hopeCall", flow: "hope-call", from: "Botan's sheet on p2; the GM presses the card in p2's thread" },
    { name: "dynamic", flow: "action-roll", from: "Aiko's sheet on p1; the GM presses the card" },
    { name: "refund", flow: "crossing-fee-refund", from: "the GM panel on the GM, Aiko's crossing recorded" },
    { name: "modeBar.testimony", flow: "class-trial", from: "the trial console on the GM, no floor open" },
    { name: "modeBar.panic", flow: "class-trial", from: "the trial console on the GM, no floor open" },
    { name: "modeBar.closing", flow: "class-trial", from: "the trial console on the GM, no floor open" },
    { name: "verdict", flow: "class-trial", from: "the trial console on the GM, the vote not sent" },
    { name: "levelUp", flow: "class-trial", from: "Aiko's sheet on p1, her offer standing" }
]);
