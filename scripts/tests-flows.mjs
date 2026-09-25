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
 * Read by R160 (tier 0, through the kit), which holds it to GM_HANDLERS and the
 * socket listeners in the source, and by `node tools/check.mjs registry`, which
 * holds its scenarios and stages to audit/harness/README.md and tools/stages.json.
 * It imports nothing, so Node can read it as it is.
 *
 *   entry.bridge   the bridge's table actions (BRIDGE_ACTIONS, TRAP_ACTIONS), by their wire name
 *   entry.sockets  the files that listen on the module's socket for it
 *   entry.api      the game.drpg calls that start it (R160 asks that they exist)
 *   entry.calls    "file.mjs#function" for a start that is not on game.drpg
 *   status         covered (a scenario drives it end to end), partial, planned
 *   stage          covered: the release it arrived in; otherwise the stage that completes it
 *
 * The first list (E30, 24.09.2026) was checked against the source and the
 * scenarios' traffic that day: 33 actions and 16 listener files, gm-bridge.mjs and
 * sync.mjs exempt. Two scenario claims of the plan's list did not hold and are not
 * made: 12-social rolls with rollTrait, not performAction, so it is not an
 * action-roll scenario; 13-murder-signals checks the murder music (music.mjs, world
 * state), and no sfx.mjs packet crosses in it, so "sound" is planned. 10-murder
 * places a trace but makes no Truth Bullet, so truth-bullets names 30-security only.
 * And 11-killer-secrecy drives the discovery and checks nothing while it does (its
 * first tagged run: 0 body-discovery checks), so body-discovery names 10-murder.
 * A scenario is named here when its run shows checks under the flow.
 *
 * E31 (25.09.2026) adds 33-bridge-paths to the nine flows its checks are tagged
 * with. eclipse-route-veto goes from planned to partial with it: 33 drives
 * `eclipse.move` only as far as a GM who is connected and does not answer (its
 * check B6), not a move allowed or refused, so the flow stays E39's to complete.
 */

export const FLOWS = Object.freeze([
    { id: "action-roll", what: "A player's action roll: the tile, the roll window, and the difficulty a GM rules for a Dynamic action",
        entry: { bridge: ["dynamic.difficulty"], api: ["performAction"] }, scenarios: ["40-flow"], status: "partial", stage: "E39" },
    { id: "analyze", what: "Analyze: the price paid on the player's client, the analysis read on the GM's",
        entry: { bridge: ["analyze.resolve"] }, scenarios: [], status: "planned", stage: "E39" },
    { id: "body-discovery", what: "A body is found: the finder's client asks, the incident moves on, every screen learns of it",
        entry: { api: ["discoverBody"] }, scenarios: ["10-murder"], status: "covered", stage: "<=1.2.50" },
    { id: "call-arm", what: "A Call armed on a character: paid on the caller's side, armed by the GM",
        entry: { bridge: ["call.arm"] }, scenarios: ["30-security"], status: "partial", stage: "E39" },
    { id: "class-trial", what: "The Class Trial: advancement offers and asks, the vote and its ballots",
        entry: { bridge: ["advancement.apply", "advancement.offer", "advancement.ask"], sockets: ["vote.mjs"] },
        scenarios: ["10-murder", "11-killer-secrecy", "33-bridge-paths"], status: "partial", stage: "E40" },
    { id: "clock-day", what: "The clock: a GM moves the time of day or opens an Eclipse, every client redraws and refills",
        entry: { api: ["setClock", "advanceTimeOfDay", "startEclipse", "endEclipse"] }, scenarios: ["40-flow", "14-quiet"],
        status: "partial", stage: "E37" },
    { id: "crossing-fee-refund", what: "A token sent back to where it stood, and the crossing it paid for handed back",
        entry: { bridge: ["token.sendBack"] }, scenarios: ["30-security", "33-bridge-paths"], status: "partial", stage: "E39" },
    { id: "despair", what: "Despair: a correction from a player's Reroll, a Despair Call from a GM, the pools every screen shows",
        entry: { bridge: ["despair.adjust"] }, scenarios: ["40-flow", "30-security", "33-bridge-paths"], status: "covered", stage: "<=1.2.50" },
    { id: "discovery-ledger", what: "Which rooms each character has found: written by the GM, pulled and rebuilt by the clients",
        entry: { sockets: ["fog.mjs"] }, scenarios: ["60-ledger", "30-security"], status: "covered", stage: "<=1.2.50" },
    { id: "eclipse-route-veto", what: "A move during an Eclipse: asked of the GM, allowed or refused",
        entry: { bridge: ["eclipse.move"] }, scenarios: ["33-bridge-paths"], status: "partial", stage: "E39" },
    { id: "give-take-stash", what: "Things changing hands: a handover, a plant, a steal, a found stash, a body looted",
        entry: { bridge: ["handover.item", "handover.bullet", "action.plant", "vault.findStash", "action.steal", "vault.steal", "body.loot"] },
        scenarios: ["30-security", "33-bridge-paths"], status: "partial", stage: "E39" },
    { id: "gm-rolls-total", what: "The GM checks a roll's total against the roll message it can see",
        entry: {}, scenarios: [], status: "planned", stage: "E33" },
    { id: "hope-call", what: "A Hope Call that waits for the GM: the card, the ruling, the Hope charged",
        entry: { bridge: ["call.approve"] }, scenarios: ["40-flow", "30-security"], status: "covered", stage: "<=1.2.50" },
    { id: "levels-floor", what: "Levels and floors: a move between floors judged on the GM",
        entry: {}, scenarios: [], status: "planned", stage: "E39" },
    { id: "mastermind", what: "The Mastermind's doors: asked for and granted across clients",
        entry: { sockets: ["mastermind.mjs"] }, scenarios: [], status: "planned", stage: "E40" },
    { id: "messenger", what: "The messenger and every private card: the words travel only to the people on the card",
        entry: { sockets: ["secret.mjs"] }, scenarios: ["40-flow", "30-security"], status: "covered", stage: "<=1.2.50" },
    { id: "monocub-meddle", what: "A Monocub meddles: asked on the player's side, applied by the GM",
        entry: { bridge: ["monocub.meddle"] }, scenarios: [], status: "planned", stage: "E45" },
    { id: "murder-incident", what: "The incident: the opening roll, the crisis actions, the betrayal, the park, the clean-up",
        entry: { bridge: ["murder.openingResult", "murder.crisis", "murder.betrayal", "murder.park", "murder.cleanup"], sockets: ["murder.mjs"] },
        scenarios: ["10-murder", "11-killer-secrecy", "13-murder-signals", "30-security"], status: "partial", stage: "E32" },
    { id: "private-rolls", what: "A roll made in private: whispered, and hidden from the other players' chat",
        entry: { sockets: ["dice-sync.mjs"] }, scenarios: ["12-social", "20-crit-hope"], status: "covered", stage: "<=1.2.50" },
    { id: "projects", what: "Projects: progress, sharing, sabotage and its undoing",
        entry: { bridge: ["project.progress", "project.share", "project.sabotage", "project.unsabotage"] },
        scenarios: ["30-security", "33-bridge-paths"], status: "partial", stage: "E39" },
    { id: "safeword", what: "The safeword: one press stops the table on every screen",
        entry: { sockets: ["safeword.mjs"] }, scenarios: ["40-flow"], status: "covered", stage: "<=1.2.50" },
    { id: "search-observe", what: "A Search or an Observe: the GM judges it, spends the room's token, grants the find, and only the searcher reads the card",
        entry: { bridge: ["observe.target", "observe.resolve"], sockets: ["search-tokens.mjs"] },
        scenarios: ["40-flow", "30-security", "33-bridge-paths"], status: "partial", stage: "E39" },
    { id: "season-reset", what: "The season reset, from the GM panel",
        entry: { calls: ["season-setup.mjs#resetSeason"] }, scenarios: [], status: "planned", stage: "E40" },
    { id: "sound", what: "A sound played for other browsers",
        entry: { sockets: ["sfx.mjs"] }, scenarios: [], status: "planned", stage: "E50" },
    { id: "trace-remnant", what: "Traces: placed, tied to the crime, re-rated by a Reroll, cleaned up",
        entry: { bridge: ["remnant.place", "remnant.tieForItem", "remnant.edit", "cleanup.traces"], sockets: ["remnants.mjs"] },
        scenarios: ["10-murder", "30-security", "33-bridge-paths"], status: "partial", stage: "E39" },
    { id: "trap-fire", what: "A trap: a crossing reported to the GM, the trap sprung once",
        entry: { bridge: ["trap.event"], sockets: ["traps.mjs"] }, scenarios: ["13-murder-signals", "30-security", "33-bridge-paths"], status: "partial", stage: "E39" },
    { id: "truth-bullets", what: "Truth Bullets: an edit on one end reaches the other, and a player's edit is put back",
        entry: { sockets: ["truth-bullets.mjs"] }, scenarios: ["30-security"], status: "partial", stage: "E38" },
    { id: "voice", what: "Voice rooms: who hears whom",
        entry: { sockets: ["voice.mjs", "voice-client.mjs"] }, scenarios: [], status: "planned", stage: "E58" }
]);

export const FLOW_EXEMPT = Object.freeze({
    "gm-bridge.mjs": "the bridge's own plumbing (ack, refused, gmReady); its actions are claimed one by one",
    "sync.mjs": "the world-state echo every flow rides on; 00-boot and 40-flow read it on every client"
});
