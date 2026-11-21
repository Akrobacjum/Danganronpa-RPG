# L1-HANDOFF: what the audit of 1.2.118 hands to the real-table line L1

Written by the repeated audit (claude/audit-119, 20.11.2026) for line L1 (the owner's real-Foundry line, claude/e58-local, paused until after the audit), as the coordinator asked on 20.11.2026 ~19:40Z (DECISIONS.md D-A2). One row per check that needs a real table. Ordered by priority: the item's severity after the adversarial check (blocker, major, minor), then the checks that cap a stage's grade at 9 (method 11.4, rule 1), then nit and unrated. The rows point back at the audit: `Audit ref` names the reader file, the 9.2 number or LIVE id, and the finding's ID in the report (section 13 for the 9.2 items, 15-17 for the findings); the report's 9.2 table names the row `L1-nnn` back.

**Version:** measure on the newest release at the time of the run (1.2.118 when this was written; 1.2.119 if it has shipped, and then say for each row whether 1.2.119 changed its subject - `audit/findings-1.2.118/lines-119.json`). Write each reading with its date, the Foundry and Daggerheart versions and the module commit, as LOCAL-REPORT.md does.

**Not covered by a row of its own:** the 9.2 items 15-292 were settled by readers that wrote no recipe block (`live-items-01..06`, `first-session/live-items-07..09`); each still open there keeps its recipe in the 9.2 item text itself, and section 13's table marks it `L1: as 9.2`.

Rows: 523. By priority: blocker 11, major 86, minor 246, grade cap 9 75, nit 105.


## Priority: blocker

### L1-001 - a masked killer's name in a Call's confirmation and on a Despair Call's public card
- Audit ref: `domain-comm-b-calls.json` - not_established
- Clients: 1 GM, 3 players · Theme: both · Priority: blocker
- Recipe:
  1. One GM, three players: killer, victim, bystander in one room.
  2. A direct murder whose opening succeeds on Hope, so the killer's token reads '?'.
  3. On the victim's browser: Support, pick '?', read 'Aimed at', Cancel.
  4. On the GM: a Despair Call (Obstacle) on the killer; read the public card on the bystander's browser.
- Settles it: '?' in both places (fixed) / the killer's name in either (the finding stands)

### L1-002 - the GM stores, rings and clocks on an uptime-clock server after the fix
- Audit ref: `live-items-327.json` - 9.2 item 348, LIVE-E90-01
- Clients: the primary GM and one player on another machine · Theme: default · Priority: blocker (rows lost on every restart broke the stores before the fix)
- Recipe:
  1. On the owner's Forge table, as primary GM: record game.time.serverTime, Date.now(), game.drpg.gmStoreStatus().perStore
  2. Place a trace (Search or New trace); check its row, double-click opens the Remnant card, the ring shows
  3. Restart the world on The Forge, reload, place another trace; the first row still there
  4. Read the HUD's minutes line; start a debate before an update and check its time after
  5. With a player whose machine clock is a minute off, compare the debate's time on both
  6. Run game.drpg.gmStoreHealth() and gmStoreReclaim('remnants'); record the rows recovered and any trace without a row
- Settles it: agrees if rows survive the restart and no clock shows a huge number; defect if a row is lost after a restart

### L1-003 - Whether a player's browser holds a body tile of a death the GMs keep, before and after its discovery after Move the Body.
- Audit ref: `live-items-463.json` - 9.2 item 464, LIVE-E63-02
- Clients: GM and three players · Theme: default · Priority: blocker
- Recipe:
  1. As the GM open an incident with PlayerThree's character as killer and PlayerOne's as victim; let the opening kill (the death kept).
  2. On PlayerTwo and PlayerOne run `game.scenes.contents.flatMap(s => s.tiles.contents).filter(t => t.flags?.['danganronpa-rpg']?.bodyOf).length` - expect 0.
  3. As the killer press Move the Body in Stage 6 into another room; run the line again on both players - expect 0.
  4. Discover the body (announce); on every client read the line and the tile's x, y against the corpse token's.
- Settles it: Agrees if every player reads 0 until the discovery and then 1 at the moved token's corner on every client; a defect if any player's browser holds a tile (or its actorId) before the death is the table's.

### L1-004 - Whether a trace's author reaches a player's browser anywhere.
- Audit ref: `live-items-463.json` - 9.2 item 486, LIVE-E97-05
- Clients: GM and one player · Theme: default · Priority: blocker
- Recipe:
  1. As the GM set an author on a trace in Dorm A; let PlayerOne find it and get a Truth Bullet from it.
  2. On PlayerOne run a scan: `JSON.stringify([canvas.scene.tokens.contents, game.items.contents, game.actors.contents.flatMap(a => a.items.contents), game.messages.contents].map(c => c.map(d => d.toObject()))).match(/leftBy\|sourceName\|sourceActor/g)`.
  3. Read the trace card's text on PlayerOne.
- Settles it: Agrees if the scan finds nothing and the card names no author; a defect (it gives the answer away) on any hit.

### L1-005 - The mask on four screens after a Hope opening: the token's look, the names the GM and Spectator see, the whisper and Event card, the silent voice room, the closed sheet, Stay hidden / Reveal yourself 
- Audit ref: `live-items-527.json` - 9.2 item 527, LIVE-E69-05
- Clients: primary GM and four players (one a Spectator), LiveKit server · Theme: one theme (either); both languages for the texts · Priority: blocker
- Recipe:
  1. Seat a primary GM, PlayerOne (victim B), PlayerTwo (witness C) in the same room, PlayerThree (killer A) and a fourth player as a Spectator; LiveKit on.
  2. GM opens a direct murder by A on B; A's opening succeeds on Hope.
  3. On B and C read A's token: `canvas.tokens.placeables.filter(t => t.document.actorId === A).map(t => [t.document.name, t.document.texture.src, t.document.ring.enabled, t.nameplate?.visible, t.bars?.visible])`; screenshot; on the GM and the Spectator screenshot the name over the "?".
  4. On B read the latest whisper and the Event card's text for A's name.
  5. Voice: on A read the microphone tile's state and tooltip, whether A hears B; on B and C the Who you hear list; on the GM A's channel.
  6. B double-clicks the "?" token: record whether a sheet opens and stays.
  7. A presses Stay hidden, then Reveal yourself on the voice tile: read the token's look against the one before the incident, the microphone, B's Event card.
  8. Repeat to the end by a new time of day instead of a reveal.
  9. On B run `game.actors.get(canvas.tokens.placeables.find(t => t.document.name === "?").document.actorId).name` and record it.
- Settles it: Agrees if B and C never see A's name or face, the GM and the Spectator do, the voice room and give-back are as written and only the console line names A; a defect if any screen but the GM's, the Spectator's and A's shows A's name or face, or A can hear or be heard while masked.

### L1-006 - Every surface that could name the masked killer on the victim's and a bystander's screens.
- Audit ref: `live-items-527.json` - 9.2 item 547, LIVE-OWN115-01
- Clients: GM and three players · Theme: either · Priority: blocker
- Recipe:
  1. GM and three players (killer, victim, bystander in the room); Dice So Nice on; the killer's token with the dynamic ring enabled.
  2. Direct murder, opening on Hope. On victim and bystander screenshot the token at once (first frames) and read its document name and texture.
  3. Read the combat cards' text and the event panel for the killer's name.
  4. The killer rolls a trait from the sheet: read the chat card's header portrait src and name on the victim; read the Dice So Nice colours (`game.dice3d` appearance in the roll packet) against the killer's player's.
  5. The victim uses Listen through a door at the killer: read the text.
  6. The killer reveals: the victim reads the name again.
- Settles it: Agrees if no surface on the victim's or bystander's screen shows the killer's name, face or player colours while masked; a defect for any one that does.

### L1-007 - Who can fetch the case copy and whether its folder lists.
- Audit ref: `live-items-527.json` - 9.2 item 550, LIVE-E111-02
- Clients: GM, one player, one logged-out browser · Theme: n/a · Priority: blocker
- Recipe:
  1. As GM read the copy's name: `(await FilePicker.browse('data', 'worlds/' + game.world.id + '/drpg-case')).files`.
  2. In a private window with no login, fetch https://<server>/worlds/<id>/drpg-case/<name>: record the status code.
  3. Fetch https://<server>/worlds/<id>/drpg-case/ and /worlds/<id>/drpg-case: record status and body.
  4. As a Player without FILES_BROWSE: `await FilePicker.browse('data', 'worlds/<id>/drpg-case').catch(e => e.message)`.
- Settles it: Agrees if the folder does not list and the player is refused; a defect (the copy to be withdrawn, by the item's own rule) if the folder lists or the player's browse returns the file names.

### L1-008 - The opening's veil on 1.2.118 on four screens, both opening roads, with voice.
- Audit ref: `live-items-527.json` - 9.2 item 553, LIVE-E112-01
- Clients: primary GM, second GM, three players, a Spectator; LiveKit · Theme: either · Priority: blocker
- Recipe:
  1. GM, second GM, three players (A, B, C in one room), a Spectator page; LiveKit server; scene token vision on with sight on A's and B's tokens for the run (put back after).
  2. Case 1: open a direct murder from the GM's tile mid-time-of-day. On B and C record frames (requestAnimationFrame log of A's `token.visible`, nameplate, bars, border) from the opening on; on A read `token.document.hidden` (false), `token.visible` (true), `token._isVisionSource()` (true) and screenshot A's map.
  3. On A read the microphone tile's reason and whether A hears B; count the veil's whisper lines.
  4. Throw the opening on Hope: on B log the token's texture per frame for the first second.
  5. Case 2: declare in an Eclipse; at the lights log A's visibility on B per frame.
  6. Fail an opening: A's look against before; a token the GM hid before stays `hidden`.
  7. Reload the primary GM mid-opening; a GM closes the incident; on return read A's token and BROADCAST_AUDIO.
  8. On the Spectator read A's `token.visible`.
- Settles it: Agrees if B, C and the Spectator never draw A, A keeps their own vision and hears the room, and every road gives the token and microphone back; a defect for any frame of A on B or C, A seeing from B's eyes, or a token or microphone left changed.

### L1-009 - Item 553 on The Forge with the owner's voice server, and the veil's latency.
- Audit ref: `live-items-527.json` - 9.2 item 554, LIVE-E112-02
- Clients: GM and three players on The Forge · Theme: either · Priority: blocker
- Recipe:
  1. On the owner's Forge world (a copy), with the table's voice server, seat the cast of item 553.
  2. Run item 553's steps for case 1 and case 2.
  3. On B log performance.now() at the GM's opening (a socket mark from the GM) and at A's `token.visible` going false; repeat five times.
- Settles it: Agrees as item 553, with the delay under about a second; a defect for any frame of A on B or C, or a delay that lets A be seen.

### L1-010 - The "?" on map and portrait on every surface, its give-back, on v14 and The Forge.
- Audit ref: `live-items-527.json` - 9.2 item 556, LIVE-E112-04
- Clients: GM and three players · Theme: either · Priority: blocker
- Recipe:
  1. Killer A, victim B, witness C in one room; Hope opening.
  2. On B and C screenshot A's token on a light map and a dark map, ring on and off.
  3. Read A's portrait on the sheet, the actors list, a roll card's header and the voice tile on B, C and A.
  4. Before the murder record A's `img`, `prototypeToken.texture.src` and each token's texture; after a reveal (and in a second run after a new time of day) compare exactly.
  5. With Isometric Perspective 14.0.6, Token Silhouette on and an occluding tile flagged in Isometric's tile settings over A: record frames of the silhouette after the mask.
  6. Repeat steps 2-4 on The Forge.
- Settles it: Agrees if every surface wears the "?" on B and C and everything comes back byte for byte; a defect for any surface showing A's face, or a picture not given back.

### L1-011 - a direct murder's opening seen on the victim's page, ten times, each with its dice recorded
- Audit ref: `stages-03.json` - not_established
- Clients: GM and three players · Theme: default · Priority: blocker if it repeats; E06's cap 9 otherwise
- Recipe:
  1. GM and three players; Eclipse; player A declares a direct murder on player B.
  2. The GM draws A's opening; record the dice (Hope/Fear, critical) from the GM's card.
  3. On B's page, read every chat card and the Event panel for A's name.
  4. Repeat ten times across Hope, Fear and critical outcomes.
- Settles it: A's name only after a successful Fear opening - as the rule says, no finding; A's name after a failed or Hope/critical opening - a blocker (the answer given away)


## Priority: major

### L1-012 - Whether the victim's and a bystander's voice tile count the veiled killer and whether 'Who you hear' names them, during the opening's veil, for a murder opened mid-day and one declared in an Eclipse.
- Audit ref: `domain-comm-c-voice.json` - not_established
- Clients: primary GM and three players (A, B, C) · Theme: both · Priority: major
- Recipe:
  1. Regional voice on, voice tile on, avclient-livekit connected; killer A, victim B and bystander C in one room, each in their own browser.
  2. GM opens a direct murder A -> B from the GM's tile (no opening thrown yet).
  3. On B and C: read the number on the voice tile's speaker button, open 'Who you hear' and note every row's name and portrait.
  4. Repeat with the murder declared in an Eclipse, read at the lights before A throws the opening.
  5. Then let A's opening succeed with Hope and read B's list again.
- Settles it: Defect if B's or C's list names A, or the count includes A, while A's token is hidden on that browser; no defect if neither does.

### L1-013 - A kept death's sound reaches only its hearers
- Audit ref: `domain-comm-d-audio.json` - not_established
- Clients: 1 GM, 3 players · Theme: default · Priority: major
- Recipe:
  1. GM, three players; run an incident to a death kept secret
  2. Watch each player's console for the module socket packet (game.socket.on log)
- Settles it: only the incident's players receive the packet: holds; a bystander receives it: a leak of the death's timing

### L1-014 - Whether a card posted under a mask is served unmasked after the mask ends
- Audit ref: `domain-core-b-secret.json` - CORE-20 (domain-core-b-secret-1)
- Clients: GM, killer's player, one bystander (3) · Theme: default · Priority: major
- Recipe:
  1. GM opens a direct murder whose opening succeeds with Hope, so the killer is masked.
  2. PlayerTwo (a bystander in the room) closes the tab.
  3. The killer Steals from PlayerTwo's character; the GM reads the card's words on the GM's chat log.
  4. The GM moves the time of day on, ending the mask without a reveal.
  5. PlayerTwo reopens the game and opens the card in the chat log and the messenger.
- Settles it: settled as a defect if PlayerTwo's card names the killer; settled as no defect if it reads '?'

### L1-015 - A card posted under a mask, served after its end
- Audit ref: `domain-core-b-secret.json` - not_established
- Clients: GM and two players (3) · Theme: default · Priority: major
- Recipe:
  1. As finding 1's recipe.
- Settles it: as finding 1

### L1-016 - A Spectator's crossing on the primary: whether it is recorded and whether a watch names it.
- Audit ref: `domain-map-b-movement.json` - not_established
- Clients: GM and two players · Theme: default · Priority: major
- Recipe:
  1. Before a Night Eclipse, student A sets Keep Watch in the Library.
  2. Make student B's player a Spectator (or kill B with the death kept, so a kept death's Spectator is made).
  3. Start the Eclipse; B's player drags the Spectator token into the Library.
  4. Read A's chat for 'comes into Library', and on the primary GM the crossing store row for the Spectator.
- Settles it: settled as fixed if no card reaches A and no crossing row exists for the Spectator; settled as the defect if A's card names it

### L1-017 - The names the hand-over window lists while the opening veils the killer.
- Audit ref: `domain-map-c-rooms.json` - not_established
- Clients: 1 GM, 2 players · Theme: default · Priority: major
- Recipe:
  1. Start a world with a GM, the killer's player and the victim's player, room visibility on.
  2. Put the killer and the victim in one room in Daily Life and open a direct murder; do not throw the opening roll.
  3. On the victim's browser open the victim's sheet and press Give on any item.
  4. Read the names in the 'Who' list.
  5. Repeat with Share on a Truth Bullet and with 'Show the passage' if the victim knows one.
- Settles it: The list names the killer: finding 1 holds. The list names nobody or '?': it does not.

### L1-018 - A trial ended from Season setup's Edit campaign, on every client.
- Audit ref: `live-items-18.json` - 9.3 9.3-18
- Clients: GM and one player · Theme: default · Priority: major
- Recipe:
  1. Start a Class Trial with a debate floor open.
  2. As the GM open Season setup, change the time of day out of the trial in Edit campaign, Save.
  3. On the GM and a player: record the floor's console state (game.drpg trial floor read-out), the HUD and any open vote.
- Settles it: Agrees if the floor is closed and no vote stays open on any client; a defect otherwise.

### L1-019 - Give back and Hold them again against Foundry's own settings windows, and the world after the module is off.
- Audit ref: `live-items-18.json` - B-E20 B-E20-6, LIVE-E20-06
- Clients: GM, Assistant GM, one player · Theme: default · Priority: major
- Recipe:
  1. Before enabling the module on a fresh world, dump game.settings.storage for world and client scopes (and Daggerheart's automation settings) to a file.
  2. Enable the module; as the GM open the GM panel's Settings tile (Between sessions), its Foundry section; shoot the Give back row; on an Assistant GM page shoot the same window and check a player has no such window.
  3. Press Give them back; dump the settings again; reload; dump again.
  4. Press Hold them again; dump. Then Give them back, switch off 'Rooms decide what players can see', disable the module, reload, dump.
  5. Diff each dump with the first; enable the module again and shoot the GM's question and the checklist's row.
- Settles it: Agrees if the last dump matches the first except where the window said a setting stays, and the gates hold for the Assistant and the player; a defect for any other difference.

### L1-020 - The contract's rows on a real v14 with Daggerheart 2.12.9, before and after first use.
- Audit ref: `live-items-18.json` - B-E52 B-E52-1, LIVE-E52-01
- Clients: GM · Theme: default · Priority: major
- Recipe:
  1. Fresh load as the primary GM; run `copy(game.drpg.diagnosePatches())` or game.drpg.diagnose() and save the contract part.
  2. Open a character sheet, throw a roll with Dice So Nice, open the countdowns; save the contract part again.
  3. List the rows still unknown with their notes; split those carrying a table check (B-E52-2/-3) from the rest.
  4. Run game.drpg.migrate() and game.drpg.migrate1_2_0(); record both answers and the console line; diff the world's settings and flags before and after.
- Settles it: Agrees if no row fails, the five trust rows are ok, and both migrate calls answer the same with nothing written; a defect for a failed row or a write.

### L1-021 - Fuel a Monocub under the Despair darkening.
- Audit ref: `live-items-18.json` - s7 S7-10
- Clients: GM and one player · Theme: default · Priority: major
- Recipe:
  1. As the GM tick only Despair in the overflow hat and fire it.
  2. As the Monokuma's GM press Fuel a Monocub on a Monocub; record the Despair pool, the cub's Hope and the message before and after.
- Settles it: Agrees if the Call is refused with a reason and neither the pool nor Hope moves; a defect for a paid Call with no Hope.

### L1-022 - Two GMs writing Despair at once: the bar against the sum.
- Audit ref: `live-items-18.json` - s7 S7-11
- Clients: two GMs · Theme: default · Priority: major
- Recipe:
  1. Two GM pages (full Gamemaster each).
  2. GM A rolls students with Despair results 20 times; GM B pays Despair Calls 10 times in the same minute.
  3. Sum the +1s and the prices from the chat; compare with the bar and game.drpg.diagnoseDespair().
- Settles it: Agrees if the bar equals the sum; a defect for any lost write.

### L1-023 - A fired trap's alert on the GM: popup, sound, live buttons in the log.
- Audit ref: `live-items-18.json` - s7 S7-6
- Clients: GM and one player · Theme: default · Priority: major
- Recipe:
  1. Arm an indirect murder's trap in a room; spy `foundry.audio.AudioHelper.play` on the GM page.
  2. Walk a student into the room as a player.
  3. On the GM page: shoot the popup, record the spy's calls, press Fire the trap / Re-arm in the chat log copy and record what changes.
- Settles it: Agrees if a popup appears, one gmAsk sound plays, and the log's buttons act; a defect for any missing.

### L1-024 - Call, dynamic action and project cards with one GM and two players, their clocks and their refusals with no GM, and the co-owner's read of a private answer
- Audit ref: `live-items-293.json` - 9.2 item 293, LIVE-E18-01
- Clients: one GM, three players (A, B, an observer) · Theme: default · Priority: major
- Recipe:
  1. GM, A and B logged in; A's page opened with a time zone 3 hours off the GM's (a Playwright timezoneId or the OS clock)
  2. A buys Call Experience with a sentence; read the card's 'Open until' time on A and on the GM; GM presses Approve; read A's Hope before and after and whether the Call waits for A's next roll
  3. A asks again; nobody answers for 5 min; read the card's end text on A and on the GM; then press Approve; read A's Hope
  4. A describes a dynamic action; GM sets difficulty and statistic; read A's roll window; repeat with a refusal; read what was spent
  5. A proposes a project; read A's and B's threads; GM rules once
  6. GM leaves; A tries a Call, a dynamic action and a project; read each refusal and what was spent
  7. Make B a co-owner of A's character and a third player an observer; A's character does Listen; read who holds the answer
- Settles it: agrees: every card and refusal as the item says, Hope down once, nothing sent with no GM, the observer holds nothing; defect: a second card, Hope spent twice or on a late yes, a time shown in the wrong zone, or the observer reading the answer

### L1-025 - A primary GM's F5 and departure during an open ask, with an Assistant GM taking over, and two GMs pressing one card
- Audit ref: `live-items-293.json` - 9.2 item 294, LIVE-E18-02
- Clients: a Gamemaster, an Assistant GM, one player · Theme: default · Priority: major
- Recipe:
  1. Log in Gamemaster G1, Assistant GM G2 and player A
  2. A buys Call Experience; G1 presses F5 before answering; after G1 is back count the cards in A's thread and press Approve on the one card; read whether the Call is armed
  3. A asks again; G1 closes the world; read on G2 that it is primary with no reload; count A's resends (game.drpg debug log) and the cards; G2 approves; read the Call
  4. Repeat step 3 with a dynamic action
  5. A proposes a project; G1 and G2 press the same card within 100 ms; read the decision count, A's lines and the other GM's notice
  6. On A's page log userConnected and bridge.gmReady with timestamps while G1 reloads; note whether G1's expired cards end at its ready
- Settles it: agrees: one card throughout, one ruling, the yes kept across the handover, the second GM told who ruled; defect: two cards, a lost yes, a double ruling, or an expired card left open after G1's ready

### L1-026 - The Daily Life item refusals, the stashed key, a stash rifled twice, Palm's reply time and a dead student's sheet
- Audit ref: `live-items-293.json` - 9.2 item 297, LIVE-E14-02
- Clients: one GM, three players · Theme: default · Priority: major
- Recipe:
  1. GM and players A, B in Daily Life, in different rooms
  2. A gives B an item; read the refusal; start a Class Trial and an Eclipse and repeat
  3. A stashes the only key to C's bedroom and walks to that door; read the refusal; take the key in hand and walk again
  4. A rifles B's stash twice in one time of day; read the second answer; advance the time of day and rifle again
  5. Time A's Palm (Steal and Plant) from the click to the card (performance.now on A's page)
  6. Kill a student (and a Monocub) known to A; open its sheet on A; read for Use, Discard and the stash button; try to loot its body as a player who does not know the death
- Settles it: agrees: each refusal in today's words, the stashed key opens nothing, the second rifle refused, the dead sheet without those buttons; defect: a give that goes through, a stashed key that opens, a second rifle granted or a body looted by one who does not know; the Palm time is a number to record

### L1-027 - Two GMs changing one project at once, a player's Work after, the primary's F5 mid-change, and the change's round trip
- Audit ref: `live-items-293.json` - 9.2 item 299, LIVE-E36-01
- Clients: two Gamemasters, one player · Theme: default · Priority: major
- Recipe:
  1. Two Gamemaster accounts (G1 primary, G2) and one player; a project with a goal
  2. G2 edits the name in the Project Manager and saves while G1 presses + on the same row in the Countdowns tray
  3. The player does Work on Project; read the bar, the name and the completion cards
  4. G2 starts another change; G1 presses F5 at once; read on G2 when 'no answer' arrives and any later line that it landed
  5. Time five of G2's changes from Save to the change seen on G1
- Settles it: agrees: the bar ends at the sum, G2's name, one completion card, G2 told at once on F5; defect: a change lost or doubled, two completion cards, or G2 waiting the whole 30 s; the round trip is a number to set beside 30 s

### L1-028 - An indirect murder end to end with a real token drag as its trigger
- Audit ref: `live-items-293.json` - 9.2 item 301, LIVE-E15-01
- Clients: one GM, two players · Theme: default · Priority: major
- Recipe:
  1. GM, players A and B; A's character in a room
  2. A proposes a project from the Projects tile with Indirect murder ticked; GM Approves and saves the trigger 'Somebody enters the room'
  3. With B in the room, A does Work: read the concealment roll, the work roll, the bar and the trace
  4. Buy a Contribution for A from A's sheet; read the concealment roll and that the trap arms with one GM confirmation
  5. B drags their token into the room with the mouse (Playwright mouse.down/move/up on the canvas)
  6. On the GM read the trap card, press Spring the trap, and read that the murder window opens as indirect; log every card with its recipients
- Settles it: agrees: one trap card on the GM after a real drag and an indirect murder window; defect: no card on a drag, a card to a player, two confirmations, or a direct murder window

### L1-029 - Breach the Wall, public and secret, with its cards, sounds, the moves through and beside the hole, and Close the breach
- Audit ref: `live-items-293.json` - 9.2 item 302, LIVE-E15-02
- Clients: two GMs, three players · Theme: default · Priority: major
- Recipe:
  1. Draw a wall between two rooms (the seed has none); GM, A (builder), B behind the wall, C next door
  2. A completes a public breach; read B's, C's, the bedroom owner's and the GMs' cards, and AudioHelper.play on each page
  3. Move B through the hole, then through the wall beside it; read the GM audit's send-back
  4. Repeat with a secret breach, A in another room
  5. Breach into a GM-locked and a sealed room; move through; move a chained student
  6. Close the breach on the Tajne przejścia tab, then from a second GM; dump the WallDocument (_stats and defaults) before and after
  7. Open Propose a project as a player in both languages; open the GM's approval window for each of the three kinds
- Settles it: agrees: names only where the item says, the hole passes and the wall sends back, the wall given back equal; defect: A's name to C or in a secret breach, a pass through the solid wall, or a wall that comes back different

### L1-030 - Secret Passage from proposal through a canvas pick, completion, and a real Reroll taking it back
- Audit ref: `live-items-293.json` - 9.2 item 303, LIVE-E15-03
- Clients: one GM, three players · Theme: default · Priority: major
- Recipe:
  1. Draw a shared wall between A's room and another; GM, A, B, a third player C
  2. A opens Propose a project, kind Secret Passage; read the 'Przez ścianę do' list
  3. On the GM's approval press 'Wskaż odcinek na ścianie' and click twice on the board; also click another wall, and press Create before picking
  4. Share with B; A's Work completes it; read the outline gap and the passage on A, B and C
  5. The GM Rerolls the completing roll; read the passage on A and B; A rolls again; read whether the kept project is gone
- Settles it: agrees: the pick only on the shared wall, the passage for A and B only, gone after the Reroll; defect: a pick on any wall, C seeing it, or a passage left after the Reroll

### L1-031 - Leaving an incident, a directory drop into a closed room, a bystander's reload mid-incident, and Eclipse during a fight
- Audit ref: `live-items-293.json` - 9.2 item 310, LIVE-E17-04
- Clients: one GM, three players · Theme: default · Priority: major
- Recipe:
  1. GM and three players; open an incident with A and B; C outside
  2. A drags out of the room before the crisis action; read the token and the message; after each crisis action try again
  3. A player with the actors directory drops their own character's token into another's bedroom and behind a locked door; read the scene and the GM's whispers
  4. C presses F5 mid-incident after the GM moved the hour; read C's HUD time of day
  5. During the fight the GM hovers and presses the Eclipse chevron; read its state and tooltip
- Settles it: agrees: each move refused or allowed as the item says, the dropped token removed with a whisper, C's HUD on the opening's hour, the chevron greyed; defect: a side leaving early, a dropped token kept, C's HUD on the new hour, or an Eclipse starting

### L1-032 - Concurrent Despair, overflow and Eclipse moves from five accounts, their latency and their sums
- Audit ref: `live-items-293.json` - 9.2 item 311, LIVE-E17-05
- Clients: a Gamemaster, an Assistant GM, three players · Theme: default · Priority: major
- Recipe:
  1. Gamemaster, Assistant GM, three players; start an Eclipse
  2. Players move tokens through two rooms (waypointed moves) while the GM clicks 10 Despair pips, the Assistant changes the bar 5 times and a player buys Feed the Overflow twice
  3. Time each click to its answer on its own page
  4. Read the final Despair pool, overflow and each student's Eclipse crossings against the click log
- Settles it: agrees: every click answered at once and every sum exact; defect: a click waiting on another's write, a lost or doubled pip, or a crossing miscounted

### L1-033 - A bystander's clock and Motive card through an incident with two clock moves and a reload, and the Motive due and closing cards
- Audit ref: `live-items-293.json` - 9.2 item 312, LIVE-E17-07
- Clients: one GM, three players · Theme: default · Priority: major
- Recipe:
  1. Set a Motive of one time of day; open a direct murder A-B; C outside
  2. The GM advances the time of day twice; after each read C's HUD line and the Event panel's Motive card
  3. C presses F5; read both again
  4. Count the covered Motive due cards on A, B and the GM
  5. Close the incident; read the public card and its sound on every page, and C's clock and Motive card
- Settles it: agrees: C frozen on the opening's hour and countdown also after F5, one Motive due each to A, B and the GM, one public card at the close; defect: C showing the new hour or Due mid-incident, or more than one Motive due card

### L1-034 - One bedroom key per student through raced grants, a rename, a theft and old duplicates, with one and two Gamemasters
- Audit ref: `live-items-293.json` - 9.2 item 317, LIVE-H84-01
- Clients: two Gamemasters, three players · Theme: default · Priority: major
- Recipe:
  1. GM and three players, each with an assigned bedroom
  2. The primary presses F5 and, within 1 s of ready, presses Apply in Room Setup (and in another run Give a room key); count each student's Room Keys
  3. With two Gamemasters, the second presses Apply during the primary's sweep; count
  4. With the primary offline, a second GM renames a bedroom; the primary loads; count the owner's keys and their names
  5. A thief with their own key stashed steals and loots a second key to that room; read the sentence and the inventory
  6. Seed a student with two keys to their own bedroom; load the primary; count and read the GM's notice and others' copies
- Settles it: agrees: one key each in every case, the rename carried, the thief told, the duplicate taken; defect: two keys for a student (record whether only with two Gamemasters, the road H84 leaves open), or a copy becoming the owner's

### L1-035 - One Truth Bullet per character and trace across raced Observes, a re-declared Observe, Focus your gaze and a second player
- Audit ref: `live-items-293.json` - 9.2 item 318, LIVE-H84-02
- Clients: one GM, two players · Theme: default · Priority: major
- Recipe:
  1. Investigation; GM and two players in one room with several traces
  2. Player 1 Observes a nameless trace; while the GM's describe window is open, the same character Observes again; read the second target; close the window; count copies
  3. Declare a general Observe, close the roll window, declare again; read whether the trace is offered
  4. Focus your gaze while the first waits on the pick card; read the result and the refusal if it hits the same trace
  5. Player 2 observes the same trace; count each character's copies
  6. Hand over one trace's bullet twice at once to the same receiver, and grant one from the GM window; count
- Settles it: agrees: one copy per character per trace and the refusal said; defect: two identical bullets on one character (record the road)

### L1-036 - A public project known on its proposer's own browser and hidden from another player, and an old approval told
- Audit ref: `live-items-293.json` - 9.2 item 321, LIVE-H84-05
- Clients: one GM, two players · Theme: default · Priority: major
- Recipe:
  1. GM, A and B; A proposes a public project in a room A's character never entered; the GM approves it in another room
  2. On A read the tray row, the map token and the private card; on B read the tray, the map and game.settings.get('danganronpa-rpg', 'projectMeta')[id].sealedViewers
  3. A reloads, then logs in from a second browser; read again
  4. On a copy of the owner's world of 27.10 with a project approved before 1.2.88, load the primary on 1.2.118; read the proposer's card and view
- Settles it: agrees: A sees all three at once and after reload, B nothing and no id of A's; the old proposer told; defect: A blind to their own project, or A's id in B's sealedViewers

### L1-037 - fps() before and after the E88 train on the table's own machines
- Audit ref: `live-items-327.json` - 9.2 item 327, LIVE-E88-04
- Clients: a GM and at least two players; the GM's machine and the weakest player's measured · Theme: both · Priority: major (E88's doneWhen; Q4 waits on it)
- Recipe:
  1. Install a 1.2.85-1.2.88 build on a copy of the table's world
  2. On the GM's machine and on the weakest player's, in Stained Glass, run GM handbook 20.6 steps 1-5; record step 1's notes and await game.drpg.fps({ toChat: false }) at rest (a player alone in a room under fog), while another player walks through three rooms, and on the GM's screen with the most Remnants
  3. Record the frame count at each Look switch of step 3
  4. Repeat in Monokuma Legacy
  5. Install 1.2.118 (or later) and repeat 2-4
  6. Put the two sets side by side, line by line ('Each held alone')
- Settles it: agrees if the post-E88 build's median and p95 are lower or equal at each moment on both machines and no 'held alone' line costs more than before; defect if any moment is slower after E88. Either way Q4 is answered from the blur line on the weakest machine.

### L1-038 - a dead player's microphone stops at the trial's entry and comes back after it, with no reload
- Audit ref: `live-items-327.json` - 9.2 item 332, LIVE-E70-04
- Clients: a GM and at least four players, real microphones · Theme: default · Priority: major
- Recipe:
  1. A table with avclient-livekit 0.6.8 and a LiveKit server; three players, one whose student is dead (one run with a published death, one with an undiscovered body), one Monocub
  2. Before the trial a GM blocks a fourth player
  3. GM enters the Class Trial; the dead player speaks - others record whether they hear them
  4. End the trial; the dead player speaks again with no F5
  5. Record whether the blocked player is still blocked after the trial
  6. In the dead player's console, log Hooks.on('updateUser') and whether the local stream's audio track is enabled after each change
- Settles it: agrees if the dead player falls silent and returns without reload and the pre-trial block holds; defect if a reload is needed or the block is lost

### L1-039 - Foundry's server refuses a player's write of their own permissions
- Audit ref: `live-items-327.json` - 9.2 item 333, LIVE-E70-05
- Clients: a GM and one player · Theme: default · Priority: major
- Recipe:
  1. A player whose BROADCAST_AUDIO the trial has set false
  2. In that player's console: await game.user.update({ 'permissions.BROADCAST_AUDIO': true }).catch(e => e.message)
  3. Record the answer and game.user.permissions afterwards, and the GM's copy of that user
  4. With LiveKit on, record whether the player can be heard
- Settles it: agrees if the server refuses and both copies keep false; defect if the write lands

### L1-040 - End the trial in a linked hall: the execution before the table leaves
- Audit ref: `live-items-327.json` - 9.2 item 336, LIVE-E70-06
- Clients: a GM and three players · Theme: default · Priority: major
- Recipe:
  1. Link a courtroom scene; run a Class Trial to a guilty verdict on a living student
  2. Press End the trial and pick a school room
  3. Watch the hall: the convicted token's dead overlay, then the module's tokens removed
  4. On every page read the 'THE EXECUTION' card; on the convicted's owner read the private note
  5. On the room's scene list the tokens moved: only the living
- Settles it: agrees if the death shows in the hall before the move and the convicted is not moved; defect on any other order or a moved convict

### L1-041 - Closing Argument with real people: the volunteer window, the draw, the GM's decision, Objection and Pass
- Audit ref: `live-items-327.json` - 9.2 item 339, LIVE-E70-09
- Clients: a GM and at least three players · Theme: default · Priority: major (a card that shows the draw would tell the table the GM's change)
- Recipe:
  1. GM opens Closing Argument; each player records the window's title, body, buttons and which is the default; one presses Enter
  2. Two players volunteer; after 30 s (or Skip) the GM reads the drawn line, confirms; in a second run picks someone else
  3. On every page read the chat card: does it name the draw or the change
  4. A player raises an Objection at the third second; run the exchange; GM takes each decision once; once Overrule
  5. The speaker passes within 30 s, then after
  6. Open the vote during a Closing
  7. Ask the players what they thought they were waiting for
- Settles it: agrees if Enter volunteers nobody, the chat never shows the draw, and the HUD lines match the state; defect if the card shows the draw or a decision lands wrong

### L1-042 - Enter in the Reveal confirmation does nothing; the button reveals once
- Audit ref: `live-items-327.json` - 9.2 item 340, LIVE-E70-10
- Clients: a GM and at least two players · Theme: both · Priority: major
- Recipe:
  1. In a Class Trial, GM presses Ujawnij on a missing Key Remnant
  2. Press Enter at once; on every page count Key copies (none) and read 'Do ujawnienia'
  3. Press Ujawnij again and click Reveal; count copies per participant (one), note the sound on each page, read the counter (one less)
  4. Repeat in the other theme and language
- Settles it: agrees if Enter reveals nothing and the button gives one copy each; defect if Enter reveals

### L1-043 - Present's copies, the greyed Present that follows the turn, Share during a trial
- Audit ref: `live-items-327.json` - 9.2 item 341, LIVE-E70-11
- Clients: a GM and at least three players · Theme: both · Priority: major (a copy that shows the hidden Analyze reading)
- Recipe:
  1. A player presents an analysed bullet without the Analyze box; every other page counts copies and reads the card
  2. Again with the box ticked
  3. In Testimony a non-speaker hovers Present; the turn passes; without reloading the sheet the button changes
  4. Read the bullet's row for Share during and after the trial
  5. Disconnect the GMs and press Present; read the refusal
  6. Ask the players what the whisper told them
- Settles it: agrees if each copy shows only what was chosen, one per participant, and the button follows the turn; defect if a copy shows the unchosen Analyze result or the button needs a reload

### L1-044 - who creates the second character token at the investigation's start
- Audit ref: `live-items-327.json` - 9.2 item 358, LIVE-E51-04
- Clients: the owner's usual table · Theme: default · Priority: major
- Recipe:
  1. On the owner's world before starting the Investigation, run the item's console line and save the list
  2. Start the Investigation (GM panel's Start the Investigation, or the clock)
  3. Run the line again at once and after 30 s
  4. If a token doubled: note its _stats.createdBy, the user's name, and whether anyone was dragging an actor or switching scene
- Settles it: defect of the module if createdBy names the primary GM's user and nobody dragged; outside the module if it names a player's or a GM's manual drag; no doubling in several starts leaves it open

### L1-045 - a project's step beside Daggerheart's own countdown writes
- Audit ref: `live-items-361.json` - 9.2 item 366, LIVE-E37-03
- Clients: one GM (two browsers of the same GM help with timing) · Theme: default · Priority: major (a project's progress lost silently)
- Recipe:
  1. Daggerheart 2.12.9, countdownAutomation on; one project and one countdown of another type.
  2. Press + on the project at the same moment as a GM roll that moves countdowns; read both progresses.
  3. Repeat with Reveal, Hide and Delete on the other row (note whether Delete asks first), then with -/+ on it.
  4. Run `game.drpg.diagnosePatches()` and read the countdown-update row.
- Settles it: settled yes when the project keeps every +1 and countdown-update reads ok; settled no when the project loses a step in any of the three, or the row is not ok

### L1-046 - the order of the Eclipse packet and the clock setting on a player's browser
- Audit ref: `live-items-361.json` - 9.2 item 367, LIVE-E37-05
- Clients: GM and one player (two players better) · Theme: default · Priority: major (a token left as the dark showed it)
- Recipe:
  1. On a player's page: `game.drpg.counters({ reset: true })` and the module's Debug setting on.
  2. GM starts and ends an Eclipse that moves the time of day.
  3. On the player's page read `game.drpg.counters()` (visibility.applyAll) and the debug lines: which came first, the packet or the setting, and how many passes ran.
- Settles it: settled yes when visibility.applyAll is 1 whichever came first; settled no when it is 0 or 2, or the packet ran the Eclipse row on the old flag

### L1-047 - a bystander's round window and summary while an incident hides the clock
- Audit ref: `live-items-361.json` - 9.2 item 368, LIVE-E37-06
- Clients: GM and three players · Theme: default · Priority: major (the bystander learns an incident began)
- Recipe:
  1. GM, killer, victim and a bystander, each with a card this time of day; both languages.
  2. GM presses Next time of day; while windows are open the killer's action opens an incident; note the time.
  3. On the bystander's page read whether the window changed; then GM presses Move the clock and Go on; note the close time, any message, the clock and the GM's line.
  4. GM presses Next time of day again; read whether the summary shows on each page and the bystander's HUD time.
- Settles it: settled yes when the bystander's window stays, then closes with no word, the clock stays, only the GM sees the barred line, and no summary reaches the bystander; settled no when the bystander sees 'GM jeszcze chwilę poczeka', any message, a moved HUD, or the summary

### L1-048 - a verdict and a chapter end cut by the GM's tab closing
- Audit ref: `live-items-361.json` - 9.2 item 371, LIVE-E42-02
- Clients: GM and three players · Theme: default · Priority: major (a campaign's advancement or calendar wrong)
- Recipe:
  1. GM and three players whose students survived the trial.
  2. Give an ordinary verdict; when the class's Level Up window opens, close the GM's tab and reopen the world.
  3. Read the trial console's line and press Finish the verdict; count Level Up offers per player and each sheet's advancement count before and after. Repeat once for a Final verdict.
  4. End the chapter with every box ticked; close the tab after the clock moved, before the morning card; reopen.
  5. Read the options offered, press Finish the chapter's end, write the clock (chapter, session, day, time) before, after the close and after, and the chat cards.
- Settles it: settled yes when each survivor gets exactly one Level Up, the waiting Blackened one, and the chapter, session and day move once with one morning card; settled no when a Level Up is doubled or missing, or the clock moves twice or not at all

### L1-049 - a project's description, end to end at a table
- Audit ref: `live-items-361.json` - 9.2 item 384, LIVE-E44-20
- Clients: GM and two players · Theme: both · Priority: major (a secret project's text reaching a player not in on it)
- Recipe:
  1. GM, players A and B; each theme once.
  2. A proposes a project in a room: submit empty, then with over 1000 characters (press the button and Enter in the name field), then a two-line text.
  3. GM approves, edits the text, creates it; A double-clicks the token and reads the card; with the card open the GM edits the description in Projects.
  4. GM makes a secret project with a description, shared with A only; on A and B run `game.settings.get("danganronpa-rpg", "projectMeta")` and read the project's fields; read B's card and chat.
  5. Edit a project made before 1.2.99.
- Settles it: settled yes when each refusal stands at the field with the window open, the card follows the edit, B sees nothing and no description is in projectMeta; settled no when a refusal comes only as a toast after closing, the card lags, or B or projectMeta holds the secret description

### L1-050 - Enter in every irreversible window on v14
- Audit ref: `live-items-361.json` - 9.2 item 390, LIVE-E22-01
- Clients: GM and one player · Theme: both · Priority: major (a death, a chapter end or a reset by one key)
- Recipe:
  1. As the GM, each theme: open each window the item lists; press Enter in its text field if it has one, then with focus on the window.
  2. Note what happened and whether anything changed; look whether the irreversible button has a focus ring on open and a hatched background.
  3. In Share press Enter: it should share; Revoke access not default.
  4. As a player, the notice history's Clear.
- Settles it: settled yes when Enter presses Cancel everywhere but Share, and nothing changes; settled no when Enter carries out an irreversible answer anywhere

### L1-051 - What v14 answers for a kit window's footer button whose action is "close".
- Audit ref: `live-items-395.json` - 9.2 item 398, LIVE-E21-06
- Clients: GM · Theme: either · Priority: major
- Recipe:
  1. As GM, run the item's console line (ui-kit.mjs `drpgWindow` with `footer: { primary: { action: 'ok', label: 'OK' }, close: 'close' }`) and press the footer's Close; log the awaited value.
  2. Or run `game.drpg.runTests({ only: ['R4673'] })` if the runner takes a filter at the table, and read its line.
- Settles it: Agrees if the value is null (R4673 green); a defect in the module's premise if it is "close" (then the five windows the survey lists read a Close as an answer).

### L1-052 - Foundry's toast list on 1.2.118: its parent, its position, and the tile's look under Stained Glass.
- Audit ref: `live-items-395.json` - 9.2 item 409, LIVE-E23-08
- Clients: GM and one player · Theme: Stained Glass (the default for the console line too) · Priority: major
- Recipe:
  1. Under Stained Glass at 1366x768 and 1920x1080, run `ui.notifications.warn('test')` and `ui.notifications.error('test')`.
  2. Run the item's console line `(n=>[n.parentElement.id,getComputedStyle(n.parentElement).display,getComputedStyle(n.parentElement).flexDirection,getComputedStyle(n).position])(document.getElementById('notifications'))` and log the ancestor chain's ids.
  3. Screenshot the toast; read its font-family and font-size, and its rect against the Despair pools, the Projects tray and the voice tile.
- Settles it: Agrees if the last field is core's position (not static), the right column and the voice tile are in place and the tile reads as specified; a defect if the list is moved again or the tile overlaps the pools.

### L1-053 - Typing in Backstory through a GM's Hope write, and when the field saves.
- Audit ref: `live-items-395.json` - 9.2 item 418, LIVE-E24-05
- Clients: GM and one player · Theme: either · Priority: major
- Recipe:
  1. PlayerOne types in Backstory, a selection in the text; the GM changes that student's Hope.
  2. Read the field's value, selectionStart/End and document.activeElement on PlayerOne.
  3. Count the actor's updates (a hook counter) for: close by X after typing, tab switch after typing, open and close untouched.
- Settles it: Agrees if text, selection and focus survive and the counts are 1, 1, 0; a defect otherwise.

### L1-054 - The reserve each seat reads after an incident opens.
- Audit ref: `live-items-395.json` - 9.2 item 421, LIVE-E24-08
- Clients: GM and three players · Theme: either · Priority: major
- Recipe:
  1. Open an incident (seeded murder); on the victim's, the killer's, a bystander's and the GM's pages read the event panel's reserve lines, the sheet's rows and the token's bars.
- Settles it: Agrees if the victim's three places agree, the killer sees Health only, the GM both and the bystander none; a defect otherwise.

### L1-055 - Whether Daggerheart 2.12.9's combat tracker shows a Breakdown to another player.
- Audit ref: `live-items-395.json` - 9.2 item 422, LIVE-E24-09
- Clients: GM and two players · Theme: either · Priority: major
- Recipe:
  1. Put B in Breakdown; start a combat with B as a combatant.
  2. On A's page read B's tracker row's DOM for an img, a title or the text 'Breakdown'; screenshot.
- Settles it: Agrees if A's row shows no icon, tooltip or word Breakdown; a defect if it does (the state would be read by another player).

### L1-056 - A Breakdown roll's card as other seats read it.
- Audit ref: `live-items-395.json` - 9.2 item 423, LIVE-E24-10
- Clients: GM and three players (one an Observer) · Theme: either · Priority: major
- Recipe:
  1. Put PlayerOne's student in Breakdown; PlayerOne makes a public roll.
  2. On PlayerTwo's page and an Observer's, search the card's whole outerHTML for 'Breakdown' (case-insensitive) and read the dice; on the GM's and PlayerOne's read the same.
  3. Note the message's whisper list and rollMode.
- Settles it: Agrees if the word is absent for the others and the Disadvantage die present; a defect if any attribute or text names it.

### L1-057 - v14's render options after a write, and the sheet repainting in place.
- Audit ref: `live-items-395.json` - 9.2 item 424, LIVE-E45-01
- Clients: GM and two players · Theme: either · Priority: major
- Recipe:
  1. On three pages wrap the open sheet's `render` to log its options and count calls.
  2. With the lock off, the owner types Health three times fast, then the GM twice; read the logs and each page's reserve row.
  3. Write the same Health again (no change) and read whether render was called.
- Settles it: Agrees if every call is render(false, {renderContext: 'updateActor', renderData}) and no sheet re-renders for a resource write; a defect in the harness model (and a blink) otherwise.

### L1-058 - Scenario 71's parts A, B, F, H and I on three real pages.
- Audit ref: `live-items-395.json` - 9.2 item 426, LIVE-E45-03
- Clients: GM and two players · Theme: either · Priority: major
- Recipe:
  1. Run each part's steps as the scenario's header lists them (71-sheet.mjs:22-40), on the GM's, the owner's and the second player's pages.
  2. For each step log the sheets' render calls, the reserve rows, the item rows, the Level Up button's state, the actor's updates and the notices.
- Settles it: Agrees if each part reads as the scenario's checks state; a defect per part that does not.

### L1-059 - Back up, a second GM's edit, then Restore from a file with its preview, on two GMs.
- Audit ref: `live-items-429.json` - 9.2 item 441, LIVE-E47-04
- Clients: two GMs · Theme: default · Priority: major
- Recipe:
  1. Log in two GMs on a real server; on GM 1 open GM panel > Diagnostics > Case; read the age; press Back up the case and keep the file.
  2. On GM 2 change one note and one Key Remnants plan row.
  3. On GM 1 press Restore from a file, pick the file; screenshot the preview; press Cancel and read both GMs' stores (`game.drpg.gmStoreStatus()`).
  4. Restore again and confirm; read the notice's numbers; time until GM 2's stores read the backup's values.
- Settles it: Agrees if the preview names what returns, Cancel writes nothing and both GMs hold the backup's values after confirming; a defect if a store does not return or GM 2 keeps the edit.

### L1-060 - The body tiles through End the trial pressed on the primary GM and on a second GM, on a real server.
- Audit ref: `live-items-463.json` - 9.2 item 465, LIVE-E63-03
- Clients: primary GM, second GM, two players · Theme: default · Priority: major
- Recipe:
  1. Make a second Gamemaster account (not the primary); seat two players.
  2. Lay two body tiles (two public deaths), run a Class Trial to a sentence on a third student.
  3. On every client hook `createTile` and `deleteTile` and log `[Date.now(), t.id, t.flags?.['danganronpa-rpg']?.bodyOf?.actorId]`.
  4. Press End the trial on the primary; after it read every scene's flagged tiles on every client (expect none) and the count of unflagged tiles (unchanged).
  5. Repeat with End the trial pressed on the second GM; compare the sentenced student's create and delete times on every client.
- Settles it: Agrees if after each press no client holds a flagged tile and the sentenced student's tile is created then deleted (or never created) on every client; a defect if any flagged tile is left, an ordinary tile goes, or the second GM's press leaves the sentenced student's tile.

### L1-061 - Both settings windows on 14.370, by role: who opens which, what sections, the reload ask and Cancel.
- Audit ref: `live-items-463.json` - 9.2 item 469, LIVE-E49-02
- Clients: GM, Assistant GM, one player · Theme: both · Priority: major
- Recipe:
  1. As a player: Configure Settings, read the module's rows (one button), press DRPG Settings; read the section list (expect look, effects, sound, tech) and the window's rect per section at 1366x768.
  2. As the GM: the same; then open the GM panel's Settings tile (Between sessions) and read the five sections; find Give back Foundry's settings in 'foundry'.
  3. As an Assistant GM: the same two doors; note whether the Settings tile opens.
  4. Change the language and Save: count Foundry's reload windows (expect one); toggle a `requiresReload` world setting (the dice look) in the game window, Save, answer Yes, read whether every client reloads; change a field and Cancel, read the setting back.
- Settles it: Agrees if each role sees the window and sections today's code draws, one reload ask, every client reloading on Yes and Cancel writing nothing; a defect if the menu button does nothing, a player sees a world row, or Cancel writes.

### L1-062 - The room action's closing on every browser after one use, and two payers at once.
- Audit ref: `live-items-463.json` - 9.2 item 475 (first: LIVE-E93-01, AUDIT line 1437), LIVE-E93-01
- Clients: GM and three players · Theme: default · Priority: major
- Recipe:
  1. As the GM add a GM room action to Dorm A (Room Setup > Facilities > Edit actions) with a roll; seat three players' characters in Dorm A.
  2. On PlayerTwo and PlayerThree observe the Facilities window's row (a MutationObserver on its disabled state with `performance.now()`).
  3. PlayerOne uses it; the GM draws; at the same second PlayerTwo presses it too.
  4. Read the delay on each browser, PlayerTwo's notice and action count before and after, and the trace in Dorm A (its visibility).
- Settles it: Agrees if every other browser greys the row within the GM's write plus a socket's delay, the second payer is refused with the action back, and one Subtle trace lies in the room; a defect if a row stays open, a second use goes through, or the action is lost.

### L1-063 - A clean load, the relay guard and a whole tier 2 on 14.370 with today's build.
- Audit ref: `live-items-463.json` - 9.2 item 475 (second: LIVE-E76-01, AUDIT line 1442), LIVE-E76-01
- Clients: GM and three players · Theme: both · Priority: major
- Recipe:
  1. Clear the world (no incident cast in the GM stores, the paper's finding at LOCAL-REPORT.md:252 on the branch) and load 1.2.118 (or 1.2.119) on the GM and three players.
  2. Read each console for errors through `ready`; run `game.drpg.relayGuard()` on the GM.
  3. Run `game.drpg.runTests({ tier: 2, confirmed: game.world.id })` once per theme, the GM's page reloaded after the theme; keep the failed names.
  4. Record the Daggerheart version the run had (2.12.9 today).
- Settles it: Agrees if the load has no error, the guard reads 'ok' and tier 2 has 0 failed in both themes; a defect for each failed test that is the module's.

### L1-064 - A player's save from an action card on 2.12.9: the card's mark, by whom, and the guard's log.
- Audit ref: `live-items-463.json` - 9.2 item 476 (second: LIVE-E76-02, AUDIT line 1444), LIVE-E76-02
- Clients: GM and one player · Theme: default · Priority: major
- Recipe:
  1. As the GM post an action with a save against PlayerOne's token.
  2. As PlayerOne roll the save from the card.
  3. On the GM read the message's `system.targetSaves` (value, isCritical) and who wrote it (`updateChatMessage` hook's userId on each client), and the console for 'Refused a Daggerheart'.
  4. Repeat with a critical save.
- Settles it: Agrees if the card is marked once by the primary GM with the roll's total and critical and no refusal is logged; a defect if unmarked, marked twice or refused.

### L1-065 - A player's action roll drawn by the GM on today's Daggerheart, against a GM's own, and its Reroll.
- Audit ref: `live-items-463.json` - 9.2 item 478 (second: LIVE-E76-04, AUDIT line 1448), LIVE-E76-04
- Clients: GM and one player · Theme: default · Priority: major
- Recipe:
  1. On the GM watch the console for 'Rolls are not drawn by the GM on this Daggerheart'.
  2. As PlayerOne roll an Analyze; on the GM press Roll in the open window; read the card's dice, total, Hope and the Calls lit.
  3. As the GM roll the same action for an NPC and compare the card's parts.
  4. As PlayerOne press Reroll on the card; read the new card and the pool.
- Settles it: Agrees if there is no warning, the card matches a GM's in its parts and the Reroll draws on the GM; a defect if the warning shows or a part is missing.

### L1-066 - A drag through a known secret passage, and a drag cancelled by releasing control.
- Audit ref: `live-items-463.json` - 9.2 item 480, LIVE-E76-06
- Clients: GM and one player · Theme: default · Priority: major
- Recipe:
  1. Give PlayerOne's character a finished Secret Passage between Dorm A and the Gym.
  2. As PlayerOne drag the token through it by mouse; read its place and the movement audit's last row.
  3. Start a drag across a wall, then release control (`canvas.tokens.releaseAll()` or Escape) mid-drag; read the token's x, y (expect the start) and the audit (no new row).
- Settles it: Agrees if the passage drag lands and the released drag leaves the token at its start with no audit row; a defect if the token passes the wall or a row is written.

### L1-067 - A realization run and undone on a real scene with rooms.
- Audit ref: `live-items-463.json` - 9.2 item 483, LIVE-E97-02
- Clients: GM and one player · Theme: default · Priority: major
- Recipe:
  1. As the GM plan two Key Remnant slots; open Preview realization; pick a room for each; Run realization.
  2. Read each placed token's centre against its room's region (`region.testPoint`) and the plan's `tokenId` per slot.
  3. As PlayerOne find one of them; as the GM press Undo realization; read which tokens remain and the slots' state.
- Settles it: Agrees if each Key Remnant stands in its room, the slots point at them, and Undo removes only the unfound one and frees its slot; a defect otherwise.

### L1-068 - Zone counting against v14's region with a hole and a second level.
- Audit ref: `live-items-463.json` - 9.2 item 491, LIVE-E73-01
- Clients: GM and one player · Theme: default · Priority: major
- Recipe:
  1. In the hall scene draw Zone A as a region with a hole and Zone B over two levels; link them in Room Setup's Scenes tab.
  2. Place a token in the hole, one on the second level in Zone B, one plain in each zone.
  3. Read `region.testPoint({ x, y, elevation })` per token, the module's side count (trial-zones.mjs `sidesNow`) and each region's `tokens`.
  4. Move a token across and read again.
- Settles it: Agrees if the hole counts on neither side, the second-level token follows `testPoint` and the lists match after the move; a defect otherwise.

### L1-069 - A late move between zones at a Straw Poll's end, on every screen.
- Audit ref: `live-items-463.json` - 9.2 item 492, LIVE-E73-02
- Clients: GM and three players · Theme: default · Priority: major
- Recipe:
  1. Start a Straw Poll with three players in the hall.
  2. One second before the end PlayerOne drags their token from Zone A to Zone B.
  3. Screenshot the counters on every page at the end and read the GM's final count and the record.
- Settles it: Agrees if every page's last counters equal the GM's final count with the moved token in Zone B; a defect if any page or the final count disagree.

### L1-070 - A Logic Dive question across the primary GM's reload: the clock and the truth.
- Audit ref: `live-items-493.json` - 9.2 item 494, LIVE-E73-04
- Clients: GM and two players · Theme: default · Priority: major
- Recipe:
  1. As GM, put a two-question Logic Dive set in the case with a canary word in its conclusion; start the mode.
  2. Mid-question, read the floor's clock on a player (`game.drpg` floor state or the bar's seconds) and press F5 on the GM's page.
  3. After the GM is back, read the same clock on the player and on the GM; let the question count.
  4. On a player's console scan `game.settings.storage.get('world')`, every actor/journal/chat flag for the canary or a `truth` field.
- Settles it: Agrees if the question resumes with its clock unchanged (within a second) and no player-readable data holds the canary or a truth; a defect if the question restarts, stalls or the truth is in world data.

### L1-071 - A Spectator's own drag across a wall and a closed door on v14.
- Audit ref: `live-items-493.json` - 9.2 item 497, LIVE-E92-02
- Clients: GM and one player · Theme: default · Priority: major
- Recipe:
  1. Make a scene with two rooms split by a wall and a closed door; make PlayerOne's character a Spectator in the Students window.
  2. As PlayerOne, drag the token across the wall into the next room; record the final x, y (`token.document.x/y`) on the player and the GM.
  3. Drag it across the closed door the same way; record again.
  4. Read the character's actions before and after and the discovered rooms (`game.drpg` fog ledger for the user).
- Settles it: Agrees if the token ends in the next room with no action spent and no room discovered; if Foundry stops it at the wall or door, the Spectator has no road through walls - a defect of the design for the owner to decide.

### L1-072 - A Spectator's microphone as LiveKit carries it, and its return with the student role.
- Audit ref: `live-items-493.json` - 9.2 item 498, LIVE-E92-03
- Clients: GM and two players · Theme: default · Priority: major
- Recipe:
  1. Real LiveKit, voice by rooms; make PlayerOne's character a Spectator.
  2. In the Spectators' room (default) PlayerOne talks: record who hears.
  3. PlayerOne presses 'Listen in your room'; PlayerOne talks in Daily Life, in an Eclipse and in a Class Trial: record who hears and `game.user.can('BROADCAST_AUDIO')`.
  4. The GM gives the student role back; without a reload record the permission and whether PlayerOne is heard.
- Settles it: Agrees if PlayerOne is unheard exactly while listening in its room and heard again after the role returns, with the permission back as before; a defect if LiveKit keeps sending after the block or the microphone does not come back without a reload.

### L1-073 - Whether a bystander's curtain turns or day board plays when the GM moves the clock during an incident.
- Audit ref: `live-items-493.json` - 9.2 item 506, LIVE-E94-03
- Clients: GM and three players · Theme: Stained Glass · Priority: major
- Recipe:
  1. Open an incident with PlayerOne the killer and PlayerTwo the victim; PlayerThree is a bystander.
  2. As GM advance the time of day (and once, if the rules allow, past Night into a new day).
  3. On PlayerThree's page record `game.drpg.counters()['transition.heard']`, whether #drpg-sequence appears, and whether the glass turns (recording); read the HUD's time.
  4. Compare with PlayerOne's page.
- Settles it: Agrees if the bystander sees no turn and no board until the incident ends; a defect if the curtain turns or a board plays on the bystander while its HUD stays frozen.

### L1-074 - Who hears whom while the Scrum Debate's camps confer.
- Audit ref: `live-items-493.json` - 9.2 item 514, LIVE-E73-06
- Clients: GM and three players · Theme: default · Priority: major
- Recipe:
  1. Real LiveKit, voice by rooms; GM, P1 and P2 in Zone A, P3 in Zone B; start a Scrum Debate and press Sides set.
  2. Each player speaks in turn; each records whom they hear.
  3. Read each tile's participant count.
- Settles it: Agrees if each camp hears only itself and the GM, the dead and Spectators hear no camp; a defect if any voice crosses camps.

### L1-075 - The return from the camps' rooms, and a reload mid-confer.
- Audit ref: `live-items-493.json` - 9.2 item 515, LIVE-E73-07
- Clients: GM and three players · Theme: default · Priority: major
- Recipe:
  1. As in 514, during the confer press End the confer: every tile shows everyone again.
  2. Repeat with the clock running out, with End this mode, and with End the trial.
  3. During a confer reload P1: time how long P1 sits in the trial room before its camp room (tile count).
- Settles it: Agrees if every road returns everyone to the trial room and the reloaded player is back in its camp within a few seconds; a defect if anyone is left in a camp room.

### L1-076 - The erased trace's ghost on its finder's map.
- Audit ref: `live-items-493.json` - 9.2 item 516, LIVE-PV-01
- Clients: GM and two players · Theme: both · Priority: major
- Recipe:
  1. PlayerOne's character Observes a trace in the Laboratory, then walks out.
  2. PlayerTwo's character Tampers: Erase a Trace on it.
  3. On PlayerOne's page screenshot the Laboratory; read the ghost sprite's alpha and bounds against the token's old ones; click it.
  4. Reload PlayerOne; screenshot. Walk PlayerOne into the Laboratory; screenshot.
  5. Repeat with PlayerOne standing in the Laboratory during the erase. Screenshot the GM's and PlayerTwo's maps.
- Settles it: Agrees if the ghost behaves as listed and is on no other map; a defect if it is missing, clickable, misplaced, survives entry, or shows elsewhere.

### L1-077 - A player's Projects tray as last seen.
- Audit ref: `live-items-493.json` - 9.2 item 517, LIVE-PV-02
- Clients: GM and two players · Theme: default · Priority: major
- Recipe:
  1. PlayerOne's character in the project's room, then out; PlayerTwo works on the project.
  2. On PlayerOne's page read the tray row's counter, `.progress-tag` presence and the bar's width, and the tooltip.
  3. PlayerTwo sabotages; PlayerOne's tray: no repair row. PlayerOne walks back: counter, bar and repair row current.
  4. In a fresh browser profile for PlayerOne, a known project never seen: '? / N', empty bar.
- Settles it: Agrees if every row reads as last seen until entry; a defect if the live count or the repair row leaks, or `.progress-tag` is gone from the template.

### L1-078 - A finished project's token tint on a player who did not see it finish.
- Audit ref: `live-items-493.json` - 9.2 item 518, LIVE-PV-03
- Clients: GM and two players · Theme: default · Priority: major
- Recipe:
  1. PlayerOne's character leaves the project's room; PlayerTwo finishes the project.
  2. Read the project token's `mesh.tint` on the GM, PlayerTwo and PlayerOne; reload PlayerOne and read again; move PlayerOne's token elsewhere and read.
  3. Walk PlayerOne into the room and out; read.
- Settles it: Agrees if PlayerOne keeps the in-progress tint until entry and the finished one after; a defect if it changes early.

### L1-079 - A drawn roll across the primary GM's F5.
- Audit ref: `live-items-493.json` - 9.2 item 519, LIVE-E38-01
- Clients: two GMs and one player · Theme: default · Priority: major
- Recipe:
  1. Accounts: GM, second GM, player (add a second GM user to the sandbox).
  2. The player starts an action roll; on the primary GM's page press F5 as the draw request arrives (wrap the bridge's roll ask to delay it, or time it).
  3. Read `game.drpg.rollFlags()` on the GM who is primary afterwards and on the first GM after it returns; read the player's chat and notifications.
- Settles it: Agrees if exactly one rolls entry with one rollId exists or the player is told the roll failed; a defect for two entries or a roll that vanishes silently.

### L1-080 - Room Setup saved by a second GM while the primary moves a student and the scene.
- Audit ref: `live-items-493.json` - 9.2 item 520, LIVE-E38-02
- Clients: two GMs · Theme: default · Priority: major
- Recipe:
  1. Second GM opens Room Setup and edits a description, a table and a stash, unsaved.
  2. The primary moves a student's token to another room and activates another scene.
  3. The second GM presses Apply; read the room's region flags and stash flags, and the student's token position.
- Settles it: Agrees if all three edits are stored and the token stands where the primary put it; a defect if any edit or the move is lost.

### L1-081 - The E04 and E12 migrations on real old worlds.
- Audit ref: `live-items-493.json` - 9.2 item 521, LIVE-E38-03
- Clients: GM · Theme: default · Priority: major
- Recipe:
  1. Set DRPG_FIXTURES to copies of v1.1.0, 1.2.13 and 1.2.56 worlds.
  2. Before launch record counts: discovered-rooms rows, room regions, flags.
  3. Launch each with 1.2.118 as GM; record the store's rows, the world's after, and the whispered report.
  4. Compare: every marked room, every skipped region and its reason (ids and numbers only).
- Settles it: Agrees if every row reaches the store before anything is removed and the report matches the world; a defect for a lost row or a report that differs.

### L1-082 - The trial's modes across a primary GM's reload and a change of primary.
- Audit ref: `live-items-493.json` - 9.2 item 522, LIVE-E38-04
- Clients: two GMs and two players · Theme: default · Priority: major
- Recipe:
  1. Accounts: GM, second GM, two players.
  2. In a Class Trial run Testimony; reload the primary mid-way; record each browser's console state and the record (`trialProgress`).
  3. Repeat for the Closing with an Objection, a Logic Dive question and a death that writes mutedDead.
  4. Then take the primary off the table so the second GM becomes primary, and repeat once.
- Settles it: Agrees if every state after the return equals the state before on every browser; a defect for a lost turn, a doubled Objection or a mutedDead lost.

### L1-083 - Listen's eavesdrop as LiveKit carries it.
- Audit ref: `live-items-493.json` - 9.2 item 525, LIVE-E69-03
- Clients: GM and three players · Theme: default · Priority: major
- Recipe:
  1. Real LiveKit, voice by rooms; A in X, B and C in Y talking.
  2. A Listens on Y with a good roll; record (1)-(4) on each browser, the GM's list text and tile counts.
  3. A presses Stop listening; time A's reconnect to X against the mic block's lift (B and C listen for A's first words).
  4. Repeat the end by walking out of X, a new time of day, an Eclipse and an incident's start; then a repeat Listen in the same time of day.
- Settles it: Agrees if A hears Y, Y never hears A until the block lifts after A is back in X, and the GM's line is shown; a defect for any word of A heard in Y or a GM control that could block A.

### L1-084 - Echoes' room across stairs and a tunnel, with nearer decoys.
- Audit ref: `live-items-493.json` - 9.2 item 526, LIVE-E69-06
- Clients: GM and two players · Theme: default · Priority: major
- Recipe:
  1. Build the scene: two Levels joined by a Change Level region, a known tunnel; place A, B, a Monokuma, a hidden token and a GM-held body as listed.
  2. As A open Infiltrate > Echoes: record the action cost, that no roll window opens, and the card's room.
  3. Move B beyond the tunnel; repeat.
  4. Start an Eclipse; screenshot the struck row and its reason.
- Settles it: Agrees if the card names B's room both times and never a decoy's; a defect if the body's, Monokuma's or the hidden token's room is named.

### L1-085 - The discovery sound on the walker's browser alone, the primary GM's prompt and its Not yet / Announce, on a real server.
- Audit ref: `live-items-527.json` - 9.2 item 528, LIVE-E113-01
- Clients: primary GM, second full GM, an Assistant GM, three players · Theme: one theme (either); both languages · Priority: major
- Recipe:
  1. Map a file to 'A body is found'; every page's Sound slider above zero; on each page wrap `foundry.audio.AudioHelper.play` to log (src, performance.now()).
  2. A body the GMs hold in a room; walk PlayerOne's student in alone; read the log on all pages and PlayerOne's notice; walk out and back.
  3. Walk PlayerTwo's student in: read PlayerTwo's log and notice, whether anyone is summoned, the window on the primary GM and none on the second GM; press Enter.
  4. Reload the primary GM: the window returns; open Investigation > Body found.
  5. Press Announce: summons, card and sound on every page, no second entry sound for the walkers.
  6. With only an Assistant GM connected repeat the second walk-in; then log a full GM in.
  7. Time the entry sound against the token's `updateToken` on the walker; on a fresh page with no click, read whether the sound played (autoplay).
  8. Repeat the texts in Polish.
- Settles it: Agrees if only the walker hears the entry sound, once, the primary full GM alone is asked and Not yet survives a reload; a defect if another player hears it, the table is summoned before the GM's word, or the prompt reaches the wrong GM or none.

### L1-086 - Whether a BROADCAST_AUDIO write silences a LiveKit participant without a reload, and how fast.
- Audit ref: `live-items-527.json` - 9.2 item 542, LIVE-E110-01
- Clients: GM and three players with audio · Theme: either · Priority: major
- Recipe:
  1. Real LiveKit server; GM and three players with microphones, each speaking a steady tone or counting.
  2. Player 1 raises Objection; on the GM note the time of the users' update (`updateUser` hook) and on each player when the others' audio stops (the AV tile's level, or by ear).
  3. Rebuttal: the target is heard again; end the mode: all heard.
  4. Record the seconds from write to silence for each.
- Settles it: Agrees if the two fall silent within a few seconds and come back at the Rebuttal and the end, no reload; a defect if a player stays heard (or stays muted) until F5.

### L1-087 - The server copy's file, its first-write error, overwrite, times, survival across a restart, and other hosts.
- Audit ref: `live-items-527.json` - 9.2 item 549, LIVE-E111-01
- Clients: GM · Theme: either · Priority: major
- Recipe:
  1. As GM: The case > Write the copy now; in Setup > Files (or the server's disk) find worlds/<id>/drpg-case/case-<32 hex>.json.
  2. In a fresh world before any write: `await FilePicker.browse('data', 'worlds/' + game.world.id + '/drpg-case').catch(e => e.message)` - record the message.
  3. Write again: the same file name, a newer mtime; time `writeServerCopy` and `readServerCopies` with a planner of several chapters.
  4. Restart the server; load as GM; read the copy back.
  5. On The Forge: repeat steps 1-3, and with a failure read the case window's and the health check's text.
- Settles it: Agrees if one file is written and overwritten, survives a restart, and a host that refuses is reported as it answered; a defect if a second file appears per write, the copy is lost on restart, or a refusal is silent.

### L1-088 - The case on a second computer, both ways, and the notice with the file switch off.
- Audit ref: `live-items-527.json` - 9.2 item 551, LIVE-E111-03
- Clients: GM on two computers · Theme: either · Priority: major
- Recipe:
  1. On computer 1 as GM: add a Key Remnant to the plan and a link in the diagram; wait 20 s; close the browser.
  2. On computer 2 (its own browser profile) as GM alone: open Investigation; compare the plan and diagram; make a change; wait 20 s; close.
  3. Back on computer 1: the change is there with no click.
  4. Turn 'No file browser for players' off; make a change; read the GM's notice and the copy's row of `game.drpg.gmStoreHealth()`.
  5. Repeat step 1 closing after 5 s, to record what the 15-s window loses.
- Settles it: Agrees if each computer shows the other's change without a click and the switch-off is told; a defect if a change older than the debounce is lost or the refusal is silent.

### L1-089 - Isometric Perspective's silhouette of a token the module hides, on a scene where Isometric builds silhouettes.
- Audit ref: `live-items-527.json` - 9.2 item 557, LIVE-E112-05
- Clients: GM and two players · Theme: either · Priority: major
- Recipe:
  1. An isometric scene (Isometric's scene flag on); an occluding tile flagged in Isometric's tile settings; Token Silhouette on in the client settings; confirm a visible token behind the tile has a sprite in the `OcclusionTokens` layer.
  2. Put A behind the tile in another room than B; on B log each frame whether a sprite for A exists and is visible.
  3. Start an Eclipse; repeat. Open a murder with B as victim; repeat under the veil.
  4. Move A behind the tile; log frames for a flash.
  5. Control: a visible token's silhouette stays on B.
- Settles it: Agrees if B never has a visible sprite for A while the module hides A and the control's stays; a defect for any frame with A's silhouette on B.

### L1-090 - A hidden token's ruler and planned movement on a player's browser.
- Audit ref: `live-items-527.json` - 9.2 item 559, LIVE-E116-02
- Clients: GM and one player · Theme: either · Priority: major
- Recipe:
  1. GM hides a token (right-click, Toggle Visibility) and drags it with two waypoints; on the player log `canvas.tokens.get(id)?.ruler?.visible` and screenshot during and after.
  2. On the player, listen: `Hooks.on('moveToken', (d, m) => console.log(d.id, d.hidden, m))` and the socket for planned movement; record what arrives for the hidden token.
  3. GM plans a visible token's move and hides it mid-way: the player's ruler vanishes at once; unhide: back at the next refresh.
  4. Compare with the module's ruler predicate disabled (`setRulerShown(null)` from fog-doorways.mjs) to see what Foundry alone draws.
- Settles it: Agrees if the player never sees the hidden token's path, waypoints or label; a defect for any of them drawn, or for planned movement drawn for a hidden token.

### L1-091 - The season reset on a copy of a world played through a chapter: its record, checkState() and the whole-world diff.
- Audit ref: `live-items-561.json` - 9.2 item 562, LIVE-E40-02
- Clients: GM alone (a player page open to read that nothing of the old season reaches it) · Theme: default · Priority: major
- Recipe:
  1. On the setup screen, Duplicate World of a world played through a chapter; launch the copy.
  2. As GM take the local gate's world dump (audit/live, the gate's world diff) before.
  3. Open the season reset and tick every group; run it; copy the result's `cleared`, `failed`, `notRun`.
  4. Run `game.drpg.checkState()`; check each warning against the world data.
  5. Take the world dump after and diff; note every path the reset left that its groups name.
- Settles it: Agrees if `failed` and `notRun` are empty, checkState() reports nothing the world does not hold, and the diff leaves no state of a ticked group; a defect otherwise.

### L1-092 - The veiled killer's own sight and the veil's drawing on the other players' canvases, on 1.2.118.
- Audit ref: `live-items-561.json` - 9.2 item 600, LIVE-E112V-01
- Clients: GM, three players, one Spectator · Theme: default · Priority: major
- Recipe:
  1. On 1.2.118 (not 1.2.116), give A's and B's tokens sight and switch the scene's token vision on (put back after); turn the room fog off for part (d).
  2. Open a direct murder A on B in one room with C present; leave the opening waiting.
  3. On A's page read `canvas.tokens.get(A).document.hidden` and `canvas.tokens.get(A)._isVisionSource()`; screenshot A's view.
  4. On B's and C's pages sample every animation frame `canvas.tokens.get(A)?.visible`, its nameplate, bars, border, ruler and turn marker from before the opening to after it; same on a Spectator's page.
  5. On B and C with no token selected screenshot the map around A and around a character in another room and one in their room; run `game.drpg.diagnosePatches()` and read the `token-sight` row.
  6. Roll the opening; read A's token on B and C (with '?' on Hope) and A's `hidden` against its value before the murder.
- Settles it: Agrees if (a)-(e) hold on every frame sampled; a defect if A is drawn for one frame on B or C, if A has no sight of its own, or if B or C see the map through A's token.

### L1-093 - The mover's request in preUpdateToken.
- Audit ref: `live-items-561.json` - 9.2 item 648, LIVE-E39-10
- Clients: GM and one player · Theme: default · Priority: major
- Recipe:
  1. On PlayerOne's page `Hooks.on('preUpdateToken', (d, c, o) => console.log(JSON.stringify(o.movement?.[d.id])))`.
  2. PlayerOne moves Aiko by `move([{x: 1500, y: 400}, {x: 2300, y: 500}])` across three rooms.
  3. Copy the logged object.
- Settles it: Agrees if it holds `waypoints` in route order with x, y (and level); a defect if the list is missing or holds other points, since the module's leg judgement then judges end to end.

### L1-094 - A mouse drag through four rooms in an Eclipse.
- Audit ref: `live-items-561.json` - 9.2 item 649, LIVE-E39-11
- Clients: GM and one player · Theme: default · Priority: major
- Recipe:
  1. Start an Eclipse at Noon with 2 crossings each.
  2. On the GM log each updateToken's `o._movement[id]` (passed, pending, state) for Aiko; note the Eclipse counter before.
  3. PlayerOne drags Aiko with the real mouse from Dorm A through the Cafeteria and the Hall into the Storage without releasing.
  4. Read the GM's count, Aiko's final room and the cards PlayerOne got.
- Settles it: Agrees if the token stops at its last allowed crossing and two are counted; a defect if it ends in a room past the allowance.

### L1-095 - The chat-log copy of a thread's ruling card, ruled and refused, on 1.2.118.
- Audit ref: `live-items-561.json` - 9.2 item 660, LIVE-F118-01
- Clients: GM and one player · Theme: both · Priority: major
- Recipe:
  1. On 1.2.118, PlayerOne asks for a Hand ruling on an action whose card goes to the messenger thread.
  2. On the GM's page click 'Approve: Hand (+1)' on the chat log's copy with the real mouse; time to the ruling line; read the player's Daggerheart window and the messenger card's buttons.
  3. Second card: answer in the messenger; then click the log copy's button; read the refusal card and the buttons' `disabled`.
  4. Repeat for 'Change to: ...' and 'Refuse'; repeat under the other theme.
- Settles it: Agrees if each first click rules within seconds and each second click is refused with the buttons disabled; a defect otherwise.

### L1-096 - A tunnel on one floor and stairs between two v14 Levels gone through and back, from a GM's and a player's browser
- Audit ref: `stages-08.json` - not_established
- Clients: one GM, one player · Theme: default · Priority: major (the stage's grade cap)
- Recipe:
  1. On a scene with two Levels (Ground 0-10, Upper 10-20) draw a room on each floor and a tunnel on Ground, both secret; give both to a student
  2. Turn on Verbose console logging for the GM and the player
  3. The player presses Go through at the Ground tunnel and back; read each refusal's words and both consoles
  4. The player goes up the stairs by Go through and back down; then the GM does the same on the student's token
  5. Move the token upstairs with Foundry's own level control (no tunnel), then press Go through at the upper end; read the refusal and the token's elevation and level
  6. Write down the scene, the regions' levels and elevations
- Settles it: agrees: every crossing goes both ways on both floors; defect: a refusal on the way back, with the console line naming the end's room

### L1-097 - the DRPG Settings windows on v14 for a GM, an Assistant GM and a player; the GM panel's tiles one height; Season setup's Reset the season pressed
- Audit ref: `stages-17.json` - E49
- Clients: GM, Assistant GM, one player · Theme: both · Priority: major (E49-1)
- Recipe:
  1. Foundry 14.370, a GM, an Assistant GM and a player, each in a browser, 1366x768.
  2. Each opens Configure Settings: note the module's one row and what DRPG Settings opens; change a client setting with requiresReload and Save.
  3. The GM opens the GM panel's Settings tile; note who else can open it (the Assistant GM by Foundry's SETTINGS_MODIFY).
  4. The GM opens Season setup on a test world and presses Reset the season in its warning frame: note whether the reset's own window opens.
  5. Read the GM panel's tiles in a row in both themes and languages for one height and a visible icon in every state.
- Settles it: settled yes when each seat sees the same browser window, the game's window opens for a user Foundry lets modify settings alone, and Reset the season opens the reset's window; settled no when the press only closes Season setup (E49-1, read in source)


## Priority: minor

### L1-098 - Whether the discovery sound plays after the Class Trial's end for an executed student's token left on the school map
- Audit ref: `domain-case-g-death-chapter.json` - not_established
- Clients: 1 GM, 2 players · Theme: default · Priority: minor
- Recipe:
  1. Run a chapter to a verdict that executes a student whose token stands in a school room.
  2. End the trial (the tiles go).
  3. As a player who did not stand in that room at the trial, walk a token into it.
  4. Listen for the discovery sound on that player's browser and read bodyHeardStore on the primary GM.
- Settles it: Sound and a new bodyHeardStore row: the walk-in sound plays for an execution's corpse (a finding unless the owner says decision B covers it). No sound: not a defect.

### L1-099 - ChatMessage.timestamp against the creating browser's clock on Foundry 14.370
- Audit ref: `domain-comm-a-messenger.json` - not_established
- Clients: 1 GM, 1 player · Theme: default · Priority: minor
- Recipe:
  1. On a player's machine set the system clock 3 minutes behind (or run the browser under a fake clock).
  2. As that player send a message in the GM Chat.
  3. On the GM: game.messages.contents.at(-1).timestamp - Date.now() in the console.
  4. Close and reopen the player's thread on the GM and note where the bubble stands.
- Settles it: About 0 ms: the server stamps it, COMM-15's half is gone. About -180000 ms: the client stamps it, COMM-15 stands (the message counts read on a GM who read the thread in the last 3 minutes, and sorts above newer bubbles).

### L1-100 - the storage key of messengerLastRead on Foundry 14
- Audit ref: `domain-comm-a-messenger.json` - not_established
- Clients: 1 GM and 1 player on one browser, a second GM machine · Theme: default · Priority: minor
- Recipe:
  1. Log in as a GM, open and read a player's thread.
  2. In the console: Object.keys(localStorage).filter(k => k.includes('messengerLastRead')) and print the value.
  3. Log out, log in as that player on the same browser, read localStorage again and look at the launcher's badge after the GM posts one more reply from another machine and the player has not opened the thread.
- Settles it: One key without world or user and the same object on both logins: finding 3 stands. A key per world or per user: it falls.

### L1-101 - a player's made-up ruling button drawn live on a GM
- Audit ref: `domain-comm-a-messenger.json` - not_established
- Clients: 1 GM, 1 player · Theme: default · Priority: minor
- Recipe:
  1. As a player in the console: ChatMessage.create({ content: '<p>test</p><div class="drpg-call-actions"><button type="button" data-drpg-call="searchMiss" data-by="<own actor id>">Nothing was there</button></div>', whisper: game.users.filter(u => u.isGM).map(u => u.id) }).
  2. On the GM, look at the card in the chat log: is the button there and enabled?
  3. Press it and read the player's thread.
- Settles it: The button is drawn and pressing it posts '<GM> rules: Nothing was there.' to the player's thread: the chat-log half stands. The button is stripped: only the thread half (private cards) stands.

### L1-102 - the document of an arrival notice told in an Eclipse
- Audit ref: `domain-comm-a-messenger.json` - not_established
- Clients: 1 GM, 2 players · Theme: default · Priority: minor
- Recipe:
  1. Set up a stash for Aiko and have another student go through it while Aiko is elsewhere (or force her bedroom door).
  2. Start an Eclipse; on a second player's browser run Hooks.on('createChatMessage', m => console.log(m.speaker, m.whisper, m.flags))
  3. Move Aiko into that room in the Eclipse and wait 3 s.
- Settles it: The second player's console prints Aiko's actor as speaker and her player in the whisper list: the leak stands. A neutral speaker and every user as the list (a veiled card): it falls.

### L1-103 - an ask card left open across a primary GM's reload ends at its time
- Audit ref: `domain-comm-b-calls.json` - not_established
- Clients: 1 GM, 1 player · Theme: default · Priority: minor
- Recipe:
  1. One GM, one player.
  2. The player asks a Dynamic action; the card goes up with 'Open until'.
  3. The GM reloads before answering and does not touch the card.
  4. Wait past the card's time plus a few seconds.
  5. Read the card on both browsers.
- Settles it: the card reads 'Nobody answered in time' (holds) / it still reads 'Awaiting a ruling' with its buttons (the sweep skipped it)

### L1-104 - two GMs silencing two students at once keep both silences
- Audit ref: `domain-comm-b-calls.json` - not_established
- Clients: 2 GMs, 2 players · Theme: default · Priority: minor
- Recipe:
  1. Two GMs, each with a Monokuma pool, two students.
  2. Both GMs open Silence's confirmation on different students.
  3. Press Spend on both within a second.
  4. Read game.settings.get('danganronpa-rpg', 'restrictions') on a player's browser.
- Settles it: both actor ids are silenced (holds) / one is missing (finding 6 stands)

### L1-105 - The tile's microphone tooltip and note, and the notice on a click, for a player the floor leaves out.
- Audit ref: `domain-comm-c-voice.json` - not_established
- Clients: GM and three players · Theme: default · Priority: minor
- Recipe:
  1. Class Trial entered by its road, regional voice on, tile on.
  2. GM opens an Objection for O against B.
  3. On a third player X's browser hover the struck microphone and press it.
  4. Read the tooltip, the note and the notice.
- Settles it: Defect if the text lacks O's name; no defect if it names O.

### L1-106 - Whether the body's silence and a cue survive a second GM's Stop the track and a primary hand-over
- Audit ref: `domain-comm-d-audio.json` - not_established
- Clients: 2 GMs, 1 player · Theme: default · Priority: minor
- Recipe:
  1. Two GMs (A primary, B assistant) and one player; Music follows on; map Afternoon and Evening; nothing mapped to the body
  2. Announce a body: confirm silence on the player
  3. B opens the Sound window and presses Stop the track; listen on the player 30 s
  4. Unannounce by advancing; A plays a cue from the Sound window; A closes the tab
  5. B advances the hour; listen on the player: one track or two
- Settles it: Silence holds after B's press and only the Evening plays after the hand-over: findings 1 and 2 fall; the afternoon returns, or the cue plays with Evening: they stand

### L1-107 - Whether the primary answers Echoes for a character with 0 actions left, asked from that player's console
- Audit ref: `domain-core-a-bridge.json` - CORE-21 (domain-core-a-bridge-1)
- Clients: GM 1, player 1 · Theme: default · Priority: minor
- Recipe:
  1. One GM, one player whose student stands in a room with neighbours. 2. Spend the student's actions to 0. 3. On the player's console: `const m = await import('/modules/danganronpa-rpg/scripts/bridge-asks.mjs'); for (let i = 0; i < 5; i++) console.log(await m.requestEchoes({ actorId: '<id>' }));`. 4. Read the answers and the student's actions.
- Settles it: five answers with a room and actions still 0: the finding stands; a refusal (notPaid or similar): it falls

### L1-108 - Whether a second GM's Stop listening and Shut the Door, pressed for a student on that GM's browser, end in the same state as on the primary
- Audit ref: `domain-core-a-bridge.json` - CORE-22 (domain-core-a-bridge-2)
- Clients: GM 2, player 1 · Theme: default · Priority: minor
- Recipe:
  1. Two GMs (primary A, second B), one player. 2. On B, open the student's sheet, start an eavesdrop (Listen, a good roll), then press Stop listening on B. 3. Read on A `game.drpg` eavesdrop rows and the player's microphone block. 4. On B, Shut the Door for the same student; read A's barricade store and the room's flag.
- Settles it: the microphone stays blocked or A's records differ from B's: the finding stands; the same state on A as a press on A would leave: it falls to a nit about the missing onPrimary

### L1-109 - A Support's arm whose primary closes its browser between the Hope write and the arm
- Audit ref: `domain-core-a-bridge.json` - not_established
- Clients: GM 2, player 2 · Theme: default · Priority: minor
- Recipe:
  1. Two GMs, one player with 3 Hope. 2. Pause the primary's browser in DevTools on appendArmedCall during a Support. 3. Close the primary's tab. 4. Read the buyer's Hope and the beneficiary's armed list on the second GM after the resend.
- Settles it: Hope down by twice the cost with one Call armed: a new finding; down by one cost: nothing to report

### L1-110 - The freed victim's close line after a return
- Audit ref: `domain-core-b-secret.json` - CORE-23 (domain-core-b-secret-2)
- Clients: GM, killer's player, victim's player (3) · Theme: default · Priority: minor
- Recipe:
  1. GM opens a direct murder; it is closed before the victim's death (the victim lives).
  2. Before the close, the victim's player closes the tab.
  3. GM closes the incident.
  4. The victim's player reopens the game and reads the close card.
- Settles it: settled as a defect if the card reads DRPG.Secret.wordsElsewhere; settled as no defect if it reads DRPG.Murder.closedVictimYou

### L1-111 - How many players' cameras follow their token after a reset to bedrooms
- Audit ref: `domain-core-b-secret.json` - CORE-24 (domain-core-b-secret-3)
- Clients: GM and four players (5) · Theme: default · Priority: minor
- Recipe:
  1. World with at least four students, each with a bedroom on one scene, all four players on that scene.
  2. GM resets the season choosing 'each to their own bedroom'.
  3. On each player's page, read whether the view moved to their token.
- Settles it: settled as a defect if any player's view stays where it was; settled as no defect if every view pans

### L1-112 - Whether a player's console reads a hidden stash's room and owner
- Audit ref: `domain-core-b-secret.json` - CORE-25 (domain-core-b-secret-4)
- Clients: GM and one player (2) · Theme: default · Priority: minor
- Recipe:
  1. GM marks a stash hidden in Room setup's Stashes tab.
  2. On a player's page that is not the owner's, read game.scenes.contents.flatMap(s => s.regions.contents).map(r => [r.name, r.flags['danganronpa-rpg']?.drpgStashes]).
- Settles it: settled as a defect if the list names the hidden stash and its owner; settled as no defect if it does not

### L1-113 - The gap between placeCast's gather packets
- Audit ref: `domain-core-b-secret.json` - not_established
- Clients: GM and four players (5) · Theme: default · Priority: minor
- Recipe:
  1. On the GM's page, before a season reset to bedrooms, wrap game.socket.emit to log Date.now() for each packet with action 'sync' and kind 'gather'.
  2. Reset the season with 'each to their own bedroom' for at least four students.
  3. Read the gaps between the logged packets.
- Settles it: finding 3 holds at that table if any gap is under 120 ms; it is latent there if every gap is over 360 ms

### L1-114 - A key's stored description against the grant's text
- Audit ref: `domain-core-b-secret.json` - not_established
- Clients: GM (1) · Theme: default · Priority: minor
- Recipe:
  1. GM gives a bedroom named Kaede's Room to a student whose name has no apostrophe (the grant makes a key).
  2. On the GM's console: compare the key's system.description with `<p>${game.i18n.format('DRPG.Vault.keyDescription', { room: foundry.utils.escapeHTML("Kaede's Room"), owner: foundry.utils.escapeHTML(actor.name) })}</p>`.
- Settles it: the comparisons hold if the two strings are equal; if not, a rename the carry missed makes a second key and a room given away leaves the new owner's key text unrewritten

### L1-115 - Private cards in the chat log right after a load
- Audit ref: `domain-core-b-secret.json` - not_established
- Clients: GM and one player (2) · Theme: default · Priority: minor
- Recipe:
  1. As a player who holds the words of several private cards and of none of an incident's veiled cards to others, reload the page.
  2. Before scrolling or anything else redraws, read the chat log's cards.
- Settles it: settled as no defect if every held card shows its words and no veiled card of others is drawn; a defect if dashes or stubs show

### L1-116 - The sender of a Hope roll's relay packet
- Audit ref: `domain-core-b-secret.json` - not_established
- Clients: GM and one player (2) · Theme: default · Priority: minor
- Recipe:
  1. A player rolls with a Hope spend through Daggerheart's own roll window.
  2. On the GM's console read game.drpg.relayGuard().refused and the character's Hope.
- Settles it: settled if Hope fell and refused has no unknownSender; a defect if unknownSender counts the roll

### L1-117 - Daggerheart's character settings window as the module dresses it, on the verified Daggerheart
- Audit ref: `domain-core-c-boot-settings.json` - not_established
- Clients: one GM · Theme: both · Priority: minor
- Recipe:
  1. As GM, open a student's sheet and press the wrench in its header.
  2. On Details: check that Scars, Proficiency and Max Evasion Increase are not shown, that the two group headings and Max Health / Max Sanity read the module's words, and that each statistic has its glyph.
  3. On Experiences: check the New button's words and each bin's tooltip.
  4. Switch the module's language to Polish, reload, repeat 2-3.
  5. Change Max Health by one and back: the hidden fields' values must not change (read the actor's system.scars, proficiency, evasion before and after in the console).
- Settles it: All words, hidden fields and glyphs as described: holds on 2.12.9. Any shown hidden field or English word: a selector moved.

### L1-118 - Configure Settings' DRPG button and the reload question of a world setting with requiresReload
- Audit ref: `domain-core-c-boot-settings.json` - not_established
- Clients: one GM, one player · Theme: default · Priority: minor
- Recipe:
  1. As GM, Configure Settings > Danganronpa RPG: press the module's one button; the DRPG Settings window must open.
  2. GM panel > Between sessions > Settings > Privacy: change Dice look for the table, Save.
  3. Read the question shown: Foundry's reload confirmation for every client (world), and whether a connected player's page reloads after Yes.
- Settles it: The window opens and Foundry's world reload question appears and reloads the player: holds. A plain reload of the GM's page only: the fallback ran and the player keeps the old look until they reload.

### L1-119 - Whether an Assistant GM can write core.permissions on Foundry 14.370, and what the hold does when an Assistant GM is the primary
- Audit ref: `domain-core-d-api-diag.json` - not_established
- Clients: 1 Assistant GM, 1 player, no full Gamemaster · Theme: default · Priority: minor
- Recipe:
  1. Log in as an Assistant GM alone (no full Gamemaster connected) on a world with the file-permission switch on
  2. Before that, as the full Gamemaster, give FILES_BROWSE back to the Player role in Foundry's permission window, then log out
  3. As the Assistant GM, reload and read the console and game.drpg Debug log for 'Could not hold the file permissions'
  4. As a player, try to open a file browser (a journal image)
- Settles it: A refused write and a working file browser for the player confirm finding 4; a written value and a closed browser refute it

### L1-120 - What a player's browser holds of another user's whispered roll that the module did not throw
- Audit ref: `domain-core-d-api-diag.json` - not_established
- Clients: 1 GM, 2 players · Theme: default · Priority: minor
- Recipe:
  1. With rolls forced private, have player A roll a Daggerheart item roll from the sheet
  2. On player B's browser run game.drpg.diagnoseDespair()
  3. Read the card's 'Most recent roll message' line and the console's 'last roll read as' line
- Settles it: A's character named on B's card confirms finding 2 at a table; '(nobody this browser can tell)' and no duality refutes it for that roll kind

### L1-121 - The time and transfer of game.drpg.fileSizes() on the owner's hosted world
- Audit ref: `domain-core-d-api-diag.json` - not_established
- Clients: 1 GM · Theme: default · Priority: minor
- Recipe:
  1. Open DevTools' Network tab with the cache enabled
  2. Run await game.drpg.fileSizes()
  3. Read the transferred total, the time, and the rows marked DID NOT ARRIVE
- Settles it: Five DID NOT ARRIVE rows (x, y, b, lazy, missing) and the tests-*.mjs files listed confirm finding 1

### L1-122 - Whether an open explainer shows a stale count after a change
- Audit ref: `domain-core-d-api-diag.json` - not_established
- Clients: 1 GM, 1 player · Theme: both · Priority: minor
- Recipe:
  1. As a player, click the action strip to open 'Actions, Move, and Hope'
  2. Leave it open and take a Search
  3. Compare the window's 'You have N of M actions left' with the strip
- Settles it: A mismatch until the window is reopened confirms the stale window; an updated line refutes it

### L1-123 - Whether a bystander's own screen changes when the GM moves the hour inside an incident before Stage 6
- Audit ref: `domain-core-e-utils-clock.json` - CORE-32 (domain-core-e-utils-clock-1)
- Clients: GM + 3 players · Theme: default · Priority: minor
- Recipe:
  1. GM and three players; P3's character spends both actions in Daily Life.
  2. Open a direct murder between P1's and P2's characters and let the opening succeed (stage incident).
  3. GM: panel, Next time of day.
  4. On P3's page read the sheet's action row, the HUD's time of day and the room tile's search pips before and after.
- Settles it: P3's actions go back to 2 / 2 or the pips refill while the HUD keeps the old hour: the finding stands. Nothing on P3's page changes until the incident ends: refuted.

### L1-124 - Keyboard focus on a folded Event card across a HUD render
- Audit ref: `domain-core-e-utils-clock.json` - not_established
- Clients: 2 GMs + 2 players · Theme: both · Priority: minor
- Recipe:
  1. A GM in an incident with five or more cards so some fold (1280x720).
  2. Tab onto a folded card.
  3. From another GM, change any module setting that renders the HUD (e.g. move a token in the incident).
  4. Read document.activeElement on the first GM's page.
- Settles it: activeElement is still the card: no issue. It is body: a finding (minor, ux).

### L1-125 - A bystander's music and fog at a private hour move
- Audit ref: `domain-core-e-utils-clock.json` - not_established
- Clients: GM + 3 players · Theme: both · Priority: minor
- Recipe:
  1. As in finding 1's recipe, with a time-of-day music map set for afternoon and evening.
  2. GM presses Next time of day inside the incident.
  3. On the bystander's page read game.drpg.nowPlayingHere() and the body's data-drpg-time before and after.
- Settles it: Either changes: finding 1 widens. Neither: finding 1 stands as written.

### L1-126 - A lapsed Bounty's Despair when the clock is moved by a GM that is not the primary.
- Audit ref: `domain-desp-a.json` - not_established
- Clients: 2 GMs, 1 player · Theme: default · Priority: minor
- Recipe:
  1. Two GMs, both with pools; note pool P of the primary GM.
  2. As the primary, post a Bounty (Despair Call) on a living student; the GM bar shows 1 owed.
  3. As the second GM, advance the time of day.
  4. Read P on both bars and the GMs' card about the lapse.
- Settles it: P back where it was and the card says cancelled or given back: no defect; P one lower with a 'cancelled' card: finding 2 stands.

### L1-127 - Whether a Call bought on a second GM ever pays less than its price or none.
- Audit ref: `domain-desp-a.json` - not_established
- Clients: 2 GMs (one Assistant with a granted pool), 1 player · Theme: default · Priority: minor
- Recipe:
  1. Two GMs; grant the Assistant GM a pool and set it to 3.
  2. As the primary, lower that pool by 1 by hand (pip) and, within a second, as the Assistant buy a 3-Despair Call.
  3. Repeat with the primary's browser reloading while the Assistant buys.
  4. Read the pool and whether the Call was applied.
- Settles it: Every applied Call took its full price: refuted; a Call applied with the pool at 0 after holding 2, or applied with the pool unchanged: stands.

### L1-128 - A Monocub's console-raised Hope spent by a move in the same tick.
- Audit ref: `domain-desp-a.json` - not_established
- Clients: 1 GM, 2 players (Monocub and target) · Theme: default · Priority: minor
- Recipe:
  1. A Monocub with 0 Hope; on its player's console write system.resources.hope.value = 6 and in the same tick call game.drpg for a Confusion (or press it).
  2. Read the Monocub's Hope after the primary's audit, and game.drpg.sheetWrites().
- Settles it: Hope back to 0 and the move refused or flagged: refuted; Hope 5 standing: stands.

### L1-129 - Whether a Keep Watch start card names a dead student's watcher or a Spectator standing in the post
- Audit ref: `domain-item-b-gm-panel.json` - not_established
- Clients: 1 GM, 2 players · Theme: default · Priority: minor
- Recipe:
  1. Kill player A's student in an incident and keep the death (no discovery).
  2. Walk A's watcher token into room R.
  3. Player B declares Keep Watch standing in R and passes.
  4. Start the Eclipse.
  5. Read B's whispered card.
- Settles it: The card lists the dead student's name: finding 1 stands. It lists nobody: it falls.

### L1-130 - Whether a GM reload before an Eclipse drops declared watches
- Audit ref: `domain-item-b-gm-panel.json` - not_established
- Clients: 1 GM, 1 player · Theme: default · Priority: minor
- Recipe:
  1. Player declares Keep Watch (kept).
  2. The primary GM reloads.
  3. GM reads, in the console, the GM store watches (gm-stores.mjs watchStore) row of that character.
- Settles it: The row stands after the reload: no question; gone: a new finding (major for Keep Watch).

### L1-131 - who a proposal's approval records as its builder when the card names another student
- Audit ref: `domain-item-c-projects.json` - not_established
- Clients: GM and two players · Theme: default · Priority: minor
- Recipe:
  1. As player A, run startProject's card post from the console with data.by set to player B's actor id
  2. As GM, press Approve and Create
  3. Read game.drpg project secrets: by, killerId, and who got the 'you proposed' card
- Settles it: by is A's actor or the approval refuses: no defect; by is B's actor: a defect for the comm lane

### L1-132 - whether a second GM's Show on the map loses another project's projectMeta change or makes a second token
- Audit ref: `domain-item-c-projects.json` - not_established
- Clients: two GMs · Theme: default · Priority: minor
- Recipe:
  1. Two GM clients, the second not the primary; a project with mapHidden true and another with a room
  2. On the primary change the other project's room in the manager and Save while, at once, the second GM presses Show on the map
  3. Read projectMeta for both projects and count the first project's tokens
- Settles it: both changes stand and one token: the overlap did not happen this time (repeat); a change lost or two tokens: finding 5 measured

### L1-133 - a proposer's public project after the chat log is cleared
- Audit ref: `domain-item-c-projects.json` - not_established
- Clients: GM and one player · Theme: both · Priority: minor
- Recipe:
  1. Player proposes a public project; GM approves it for a room the player's character has never entered
  2. Read the player's tray: the row is there
  3. GM clears the chat log; player reloads
  4. Read the player's tray and map
- Settles it: row still there: the finding falls; row gone: finding 3 measured

### L1-134 - The type of scene.fog.mode and the members of CONST.FOG_MODES on Foundry 14.370.
- Audit ref: `domain-map-a-fog.json` - not_established
- Clients: one GM · Theme: either · Priority: minor
- Recipe:
  1. As GM, open the console on a scene with rooms.
  2. Run CONST.FOG_MODES and typeof canvas.scene.fog.mode.
  3. Run canvas.scene.getFlag('danganronpa-rpg', 'visionBefore').
- Settles it: numbers: the restore works as written; strings: MAP-LC4 is a defect (fog mode never restored).

### L1-135 - Whether a body moved by Stage 6 is written into the discovery ledger.
- Audit ref: `domain-map-a-fog.json` - not_established
- Clients: one GM, the killer's player, one Spectator or Monocub · Theme: either · Priority: minor
- Recipe:
  1. Run an incident to a death; keep the body undiscovered.
  2. As the killer, in Stage 6, Move the body into a room no student has entered.
  3. On the GM: game.drpg's fog discoveredFor(sceneId, victimId), or Room Setup's Fog tab for the victim.
  4. On a connected Spectator's or Monocub's browser: is that room veiled?
- Settles it: room present: finding 1 measured; absent: the teleport takes another road and finding 1 falls to the GM-drag case only.

### L1-136 - A held Secret Passage 'finished' card delivered on entry.
- Audit ref: `domain-map-a-fog.json` - not_established
- Clients: one GM, one player · Theme: either · Priority: minor
- Recipe:
  1. Finish a Secret Passage while its finder stands elsewhere (the card is held).
  2. Walk the finder's token into the passage's room in one drop.
  3. Count the 'finished' cards in the player's and the GMs' chat.
- Settles it: one card: no double at that latency; two: finding 12 measured.

### L1-137 - Whether stairLinks names both rooms of a Change Level region on a two-floor v14 scene, and whether a player's climb by those stairs is let through.
- Audit ref: `domain-map-b-movement.json` - not_established
- Clients: GM and one player · Theme: default · Priority: minor
- Recipe:
  1. On a v14 scene with two floors, draw a Change Level region over the Lab (ground) and the Attic (upper), and a room on each floor under it.
  2. In the GM console: (await import('/modules/danganronpa-rpg/scripts/movement.mjs')).stairLinks(canvas.scene).
  3. As a player with crossing rooms costing a Move, walk a student up the stairs and read the warning, if any.
- Settles it: settled as fine if step 2 lists ['Attic', 'Lab'] and the climb is charged one crossing; settled as a defect if step 2 omits the Attic or the climb is refused 'No stairs lead...'

### L1-138 - The gap from a refused step to its put-back on a co-owner's browser, and from a crossing to its settled event, on a real server.
- Audit ref: `domain-map-b-movement.json` - not_established
- Clients: GM and two players · Theme: default · Priority: minor
- Recipe:
  1. Two players co-own one student; one walks it into a room it cannot pay for.
  2. With Debug on, read on the other player's browser the time from the step to the put-back.
  3. On the primary, read the log line 'A crossing settled' against the move's time.
- Settles it: settled if the put-back lands under 1500 ms and the settle follows within about 2 s; a defect if the co-owner's tile draws the refused room first

### L1-139 - Whether a Call a player's roll window applied is named in the drawn packet.
- Audit ref: `domain-roll-a-draw.json` - not_established
- Clients: GM and one player · Theme: default · Priority: minor
- Recipe:
  1. As a player, buy a Support on your own character (or have one armed by another player).
  2. Click a statistic on the sheet; the window opens with the advantage chip held.
  3. Roll.
  4. As the GM, run game.drpg.rollFlags() and read the roll's record (game.drpg debug or rollStore) for `used.calls`.
- Settles it: the record names the Support's nonce and no `advantage` flag: the close hook ran first; no nonce and a flag: the build went on first.

### L1-140 - A drawn roll's and an unwitnessed roll's message carry their nonce on 2.12.
- Audit ref: `domain-roll-a-draw.json` - not_established
- Clients: GM and one player · Theme: default · Priority: minor
- Recipe:
  1. On Daggerheart 2.12.x, as a player, roll a Search (drawn) and read game.messages.contents.at(-1).rolls[0].options.drpgRollNonce on the GM.
  2. Log every GM out; as the player click a statistic; read the new message's flags.<module>.unwitnessed.
- Settles it: both present: the claim road holds on 2.12; either missing: claims and stamps do not match there.

### L1-141 - Concurrent draws on one primary with a Loaded Die armed.
- Audit ref: `domain-roll-a-draw.json` - not_established
- Clients: GM and two players · Theme: default · Priority: minor
- Recipe:
  1. Two players; one with a Loaded Die armed.
  2. Both press an action roll in the same second.
  3. Read both records' faces on the GM (rollFlags / rollStore).
- Settles it: only the Loaded Die's roll shows a 12 on its named die: the swap is held to its instance; the other roll shows a 12 on its first die: it leaked.

### L1-142 - Grant all on a roll thrown with no GM.
- Audit ref: `domain-roll-a-draw.json` - not_established
- Clients: GM and one player · Theme: default · Priority: minor
- Recipe:
  1. With no GM connected, as a player click a statistic.
  2. Log a GM in; press Grant all on the card.
  3. Read the roll message's author and flags.<module>.unwitnessed.granted.
- Settles it: author the GM and granted true: the road holds; an error in the GM's console: refused.

### L1-143 - the time between a player's console write of system.resources.actions.value and the primary's put-back landing
- Audit ref: `domain-roll-b-actions.json` - not_established
- Clients: 1 GM, 1 player · Theme: default · Priority: minor
- Recipe:
  1. One GM (primary) and one player P with a student at 2 actions, lockPlayerResources on (the default).
  2. On P's console: game.actors.get(<id>).update({'system.resources.actions.value': 5}).
  3. On the GM's console, poll the document every 10 ms and note when it reads 2 again; read game.drpg.sheetWrites() for the row.
  4. Repeat five times.
- Settles it: the put-back lands in tens of ms each time: finding 5 needs the Reroll inside that window and stays minor; it fails or takes seconds: finding 5 is an ordinary road

### L1-144 - whether any ordinary player action on a Daggerheart roll card updates the message's rolls
- Audit ref: `domain-roll-b-actions.json` - not_established
- Clients: 1 GM, 1 player · Theme: default · Priority: minor
- Recipe:
  1. A player rolls an action through the module.
  2. The player uses every control Daggerheart draws on that chat card (damage, apply, any die click).
  3. On the primary GM read the chat for 'rewritePutBack' / 'rewriteNotPutBack' warnings and game.drpg.sheetWrites().
- Settles it: no warning: the keeper sees only rewrites; a warning: an honest control is reported as a rewrite

### L1-145 - the order of roll.bookmark's run and the progress packet's run on the primary for a player's Work
- Audit ref: `domain-roll-b-actions.json` - not_established
- Clients: 1 GM, 1 player · Theme: default · Priority: minor
- Recipe:
  1. A player Works on a project (not indirect murder) and lands a hit.
  2. On the primary, read rerollBookmarkStore.get(<actorId>).facts.progress right after the card.
  3. Repeat ten times on the table's server.
- Settles it: facts.progress is always set: no double progress; once missing: a Reroll of that Work doubles the project's progress

### L1-146 - the improvised weapon's name and description in a world whose document language differs from the primary GM's page
- Audit ref: `domain-text-a-config.json` - not_established
- Clients: 1 GM (Polish page), 2 players (English pages) · Theme: default · Priority: minor
- Recipe:
  1. Set the world's document language to English; run the primary GM's Foundry in Polish.
  2. Open a direct murder whose killer carries no Murder Weapon.
  3. Have the killer take the weapon blow from the crisis menu and land it.
  4. Open the killer's inventory on an English player's browser and read the new item's name and description.
- Settles it: English name and description: the finding falls; 'Improwizowana bron' with the Polish note: it stands

### L1-147 - Read the assembly's card and the map with a body kept by the GMs.
- Audit ref: `domain-text-b-lang.json` - not_established
- Clients: GM and 3 players · Theme: default · Priority: minor
- Recipe:
  1. One GM, three players; run a direct murder to a death and close the incident without a discovery.
  2. The GM buys Public Announcement for a room; advance to the next time of day.
  3. Read the public card's count and the tokens in the room on a player's screen.
- Settles it: The card says one character fewer than the class and the body's token stands alone: as read here; any other count: this reading is wrong.

### L1-148 - A tab bar the one-line fit widened: does the window keep its width after a tab press, and do the labels stay whole?
- Audit ref: `domain-ui-b-kit-hud.json` - not_established
- Clients: GM x1 · Theme: both · Priority: minor
- Recipe:
  1. Set the browser to 1024x768.
  2. Open a kit window with tabs whose root carries data-drpg-tab-w0 after opening (Room setup or Item tables at a narrow width).
  3. Read app.element.getBoundingClientRect().width and nav.drpg-tabs dataset.drpgTabFit.
  4. Press another tab; read the width again and look at every tab label.
- Settles it: Settled as a defect if the width falls back and a label is cut; settled as no defect if the width holds after the press.

### L1-149 - The four headless-shaped findings at a table: a held select, a stale rules form, a stale strip, a bystander's stopwatch through a pause.
- Audit ref: `domain-ui-b-kit-hud.json` - not_established
- Clients: GM x2, players x2 (one owning a Monocub, one outside the incident) · Theme: default · Priority: minor
- Recipe:
  1. Two GMs: Sound window Music tab on both; GM A picks a playlist and leaves focus; GM B maps another row; read A's rows.
  2. Two GMs: Despair Flow on GM A open; GM B unticks Earthquake and saves; GM A renames a pool and saves; read overflowRules and the chat.
  3. A Monocub's player watching the strip; the GM tops up the purse; read the strip's Hope.
  4. A bystander player; the GM opens an incident, pauses two minutes, unpauses, closes it; read the bystander's minutes line at each step.
- Settles it: Each settles as a defect if the screen shows what the finding says, and as no defect if the window, strip or line follows at once.

### L1-150 - What happens to an Ultimate half typed when the sheet renders under the typist
- Audit ref: `domain-ui-c-sheet.json` - not_established
- Clients: GM and one player · Theme: default · Priority: minor
- Recipe:
  1. Open a student's sheet on the player's browser and click the Ultimate line
  2. Type 'Brilliant ch' and leave the caret in the field
  3. On the GM's browser change that student's actions (a pip on the header) or give an item, so the sheet renders (not a Hope write, which repaints)
  4. On the player's browser read the Ultimate line and whether it still has focus, then read actor.getFlag('danganronpa-rpg','ultimate') in the console
- Settles it: the typed text and the focus are still there -> no finding; the text is gone, or the flag holds 'Brilliant ch' and the focus is lost -> a minor ux finding (the backstory's hold applied to the Ultimate)

### L1-151 - Whether a resource write repaints or renders
- Audit ref: `domain-ui-c-sheet.json` - not_established
- Clients: GM and one player · Theme: default · Priority: minor
- Recipe:
  1. Open a student's sheet on the owner's and the GM's browsers
  2. From the GM's console write one Hope on that student
  3. Read game.drpg.counters() for a sheet render on both browsers, or watch the Inventory tab's scroll stay put
- Settles it: no render on either -> the repaint holds; a render -> the repaint is not reached on v14

### L1-152 - The event panel's incident card through the opening roll.
- Audit ref: `live-items-18.json` - 9.3 9.3-19
- Clients: GM and two players · Theme: default · Priority: minor
- Recipe:
  1. Open an incident with a drawn opening.
  2. Shoot the event panel on the victim's and the killer's pages before and after the opening roll.
- Settles it: Agrees if the card stands on the right pages after the roll; a defect if it vanishes.

### L1-153 - Whether v14's ApplicationV2 clamps a window's left/top to the viewport.
- Audit ref: `live-items-18.json` - 9.3 9.3-21
- Clients: GM · Theme: default · Priority: minor
- Recipe:
  1. At 1280x720, open a module window and call `app.setPosition({ left: 2000, top: 1500 })`; read `app.position` and the element's rect.
  2. Resize the browser from 1920 to 1280 with a window near the right edge; read its rect.
- Settles it: Settles the assumption either way: record whether Foundry clamps; if not, a window can be lost off screen on a narrow desk.

### L1-154 - The owner's ruling on whether an Observe may find an indirect murder's rig, after one played situation.
- Audit ref: `live-items-18.json` - 9.3 9.3-23
- Clients: GM and two players (the owner judging) · Theme: default · Priority: minor
- Recipe:
  1. Set up an indirect murder's rig as a secret project in a room.
  2. Have another student Observe non-obviously there with a roll over 18.
  3. Play on: let the finder work on or sabotage the rig; ask the owner whether the chapter still works.
- Settles it: Settled by the owner's answer: 'yes' keeps the rule; 'no' asks for the exception in secretsUnknownIn.

### L1-155 - Season setup's opening, a row's Open in front of the checklist, and the cast part of the checklist's further checks.
- Audit ref: `live-items-18.json` - B-E20 B-E20-1, LIVE-E20-01
- Clients: GM · Theme: both · Priority: minor
- Recipe:
  1. As the GM at 1366x768, default theme, English: open Season setup from the GM panel; shoot it; note the focused field and the scroll position.
  2. Open the Season checklist from its tile; press Open on 'Everybody has an Ultimate' and on 'At least one Monokuma'; record which window is on top after the checklist comes back.
  3. With a student short of starting resources, scroll the checklist to its further checks; shoot the cast part and the 'How to fix' line.
  4. Repeat at 1920x1080, in Stained Glass, and in Polish.
- Settles it: Agrees if Season setup opens at its top with the caret in the campaign name, every opened window stands over the checklist, and the cast part has no frame of its own; a defect for any window under the list, a scrolled opening or a cut cast part.

### L1-156 - The module's start on a world with Dice So Nice off.
- Audit ref: `live-items-18.json` - B-E20 B-E20-2, LIVE-E20-02
- Clients: GM and one player · Theme: default · Priority: minor
- Recipe:
  1. On a copy of the sandbox world, turn Dice So Nice off in Manage Modules; reload as the GM.
  2. Shoot the requirements window; copy the console's lines from danganronpa-rpg.
  3. Run `[...document.styleSheets].filter(s => s.href?.includes('modules/danganronpa-rpg/')).length` and record it.
  4. Log in a player page; repeat; switch the module language to Polish and repeat.
  5. Turn Dice So Nice on, reload, record that game.drpg exists.
- Settles it: Agrees if the window names Dice So Nice once in the table's language, the console holds no module error and the count is 0, and the module starts after; a defect otherwise.

### L1-157 - A first run by a person new to the module, by the windows and the handbook alone.
- Audit ref: `live-items-18.json` - B-E20 B-E20-3, LIVE-E20-03
- Clients: GM (a new person) · Theme: default · Priority: minor
- Recipe:
  1. Give a person who has not used the module a fresh world and the GM handbook section 1.1.
  2. Start a timer; let them follow Where to start and the GM panel's Next line to the first Eclipse.
  3. Write down every stop: where, what they expected, what the screen said.
  4. Repeat in Polish with another person or another day.
- Settles it: Agrees if they reach the first Eclipse with no step the windows do not name; each stop is a finding of its own.

### L1-158 - The room-picture probe against a real Foundry server: HEAD length, decode, a slow line.
- Audit ref: `live-items-18.json` - B-E20 B-E20-4, LIVE-E20-04
- Clients: GM · Theme: default · Priority: minor
- Recipe:
  1. Upload three pictures to the world's data: one over 8 MB, one small; point a third room at a path that does not exist.
  2. As the GM open the Season checklist; time until its further checks draw; shoot the pictures' lines.
  3. Compare each size written with the file's size on disk.
  4. Throttle the page's network (Playwright CDP, Slow 3G); open the checklist again; record which lines the good pictures land in.
  5. Repeat on The Forge if the table plays there.
- Settles it: Agrees if the large picture is named with its true size, the missing one as not loading, and a throttled good picture as not checked in time; a defect for a size not given when the server sends one, or a slow picture called missing.

### L1-159 - Show on map on a real canvas, its floor switch, and that a player sees nothing of it.
- Audit ref: `live-items-18.json` - B-E20 B-E20-5, LIVE-E20-05
- Clients: GM and one player · Theme: both · Priority: minor
- Recipe:
  1. Build a scene with a room set off its wall, two overlapping rooms, and a second Level holding a room.
  2. As the GM open the Season checklist and press Check the rooms on this scene.
  3. Press Show on map on each row (and once with Shift held); shoot the canvas after 0.5 s and 5 s.
  4. On a player's page logged in meanwhile, record the canvas position and any ping drawn.
  5. Repeat in Stained Glass.
- Settles it: Agrees if each row pans and marks on the GM alone, the mark fades, and a second-floor row switches floors first; a defect for a mark or pan on the player, or a mark on the wrong floor.

### L1-160 - The uncovered share on the owner's real maps, finished and with one room missing.
- Audit ref: `live-items-18.json` - B-E20 B-E20-7, LIVE-E20-07
- Clients: GM · Theme: default · Priority: minor
- Recipe:
  1. On a copy of the owner's world, open the Season checklist and Check the rooms on each scene with rooms; write each scene's 'outside rooms' percent and its worst floor.
  2. Delete one room's region on the school map (on the copy); read the share again.
  3. Compare both numbers with 10.
- Settles it: Agrees if every finished map reads at most 10 and the map with a room missing reads over 10; otherwise the owner picks a new number.

### L1-161 - The four unknown call rows of the notice history, read at a table.
- Audit ref: `live-items-18.json` - B-E52 B-E52-2, LIVE-E52-02
- Clients: GM and one player · Theme: default · Priority: minor
- Recipe:
  1. As a player, raise a module notice; time it on screen; open the Notice history and compare.
  2. As the GM, delete a card for everyone and press Clear chat; on the player's page check whether the history keeps the card.
  3. Hover a control with a tooltip whose text holds markup; compare the history's words with the tooltip's.
  4. Raise three notices and reload at once; count them in the history.
  5. Read each row's DRPG.Contract.instead in English and Polish against what happened.
- Settles it: Agrees if each sentence describes what was seen; a defect for a sentence that says otherwise.

### L1-162 - The voice calls the register cannot read, with LiveKit live; and three names on v14.
- Audit ref: `live-items-18.json` - B-E52 B-E52-3, LIVE-E52-03
- Clients: GM and two players · Theme: default · Priority: minor
- Recipe:
  1. On the sandbox console (no voice needed): read `CONST.USER_PERMISSIONS.BROADCAST_AUDIO`, `game.settings.settings.has('core.rtcClientSettings')`, `game.settings.settings.has('core.pushToTalk')`; record.
  2. At a table with a LiveKit server, GM and two players: mute a speaker on one client, detach and reattach their track; record whether they are heard and at what volume.
  3. Cycle every voice mode Foundry offers; shoot the voice tile in each.
  4. Press Escape with a module window and a Foundry window open; record which closes first; press the chat key with the chat hidden.
  5. Pop out a camera; read the camera-popout row in game.drpg.diagnose().
- Settles it: Agrees if each call behaves as its row's sentence says and the three names exist; a defect for a missing name or a behaviour the sentence does not describe.

### L1-163 - The diagnose window and Copy report in a real browser, and the player's report.
- Audit ref: `live-items-18.json` - B-E52 B-E52-4, LIVE-E52-04
- Clients: GM and one player · Theme: both · Priority: minor
- Recipe:
  1. As the GM at 1366x768 run game.drpg.diagnose(); shoot the window; open the folded line.
  2. Press Copy report; paste into a text file; compare its length with the report's; note any permission prompt; repeat over http if the table is served so.
  3. As a player do the same; check that the GM-only parts are named only and that the Fog part names no room the player has not found.
  4. Silence the newer-Daggerheart warning; reopen the report; press Show again; reload; record the warning.
  5. Read localStorage keys starting with danganronpa-rpg.; record whether recommendsSilenced is there.
- Settles it: Agrees if the report reads, copies whole, the player's holds no GM data and the stale key is gone; a defect otherwise.

### L1-164 - Door marks under the room fog, where v14 defines DoorControl#isVisible, and whether includedInLevel throws.
- Audit ref: `live-items-18.json` - B-E52 B-E52-5, LIVE-E52-05
- Clients: GM and one player · Theme: default · Priority: minor
- Recipe:
  1. On the sandbox console: find v14's DoorControl class and read whether 'isVisible' is an own property of its prototype; record the chain up to where it is.
  2. Read the door-controls row in game.drpg.diagnosePatches() (state and ours).
  3. On a scene with a secret door and a room the player has not found: shoot the player's canvas door icons.
  4. Move a token between two Levels; record any console line from includedInLevel and the region-included-in-level row.
- Settles it: Agrees if the getter is found, the row is ok with ours true, the player sees only their rooms' doors and no secret door, and includedInLevel never throws; a defect otherwise.

### L1-165 - The sheet anchors on Daggerheart 2.12.9's real sheet, and sheet.mjs with one anchor gone.
- Audit ref: `live-items-18.json` - B-E52 B-E52-7, LIVE-E52-07
- Clients: GM and one player · Theme: default · Priority: minor
- Recipe:
  1. As the GM and as a player open a student's sheet; read the sheet-anchors row's note in game.drpg.diagnosePatches().
  2. Record each place named missing and whether it is one of the optional ones.
  3. On a world copy, patch one required selector to a non-existent one (a script that edits the module's import in the page is enough), reopen the sheet, copy the console.
- Settles it: Agrees if only optional places of the other layout are missing and the patched sheet draws with only the module's addition gone; a defect for a required place missing or a throw.

### L1-166 - Whether a player's relayed write is lost while the primary GM reloads.
- Audit ref: `live-items-18.json` - gap gap-5
- Clients: two GMs and one player · Theme: default · Priority: minor
- Recipe:
  1. Two GM pages and one player page; note which GM is primary (game.drpg.isPrimaryGm or the GM list order).
  2. Have the player spend Hope on a roll (a relayed write) every second for 20 s while the primary reloads once.
  3. Count the player's Hope changes against the presses; read game.drpg.relayGuard() on both GMs.
- Settles it: Agrees with the gap if some presses land nowhere during the reload; if none is lost, the gap is narrower than written.

### L1-167 - Search, a trace and a trap for a character with tokens on two scenes with rooms.
- Audit ref: `live-items-18.json` - gap gap-6
- Clients: GM and one player · Theme: default · Priority: minor
- Recipe:
  1. Give Aiko a token on the school scene and one on a second scene with rooms; hide neither.
  2. With the player viewing the second scene, Search in the school's room; record the room and scene the GM's card names.
  3. Arm a trap in a room of the school; walk the school token across it while the player views the second scene; record whether it fires.
  4. Hide one token as GM and repeat.
- Settles it: Agrees if every reader picks the scene locateActor's rules name; a defect for a card or a trap on the other scene.

### L1-168 - E20's and E52's tier-2 tests by name on the sandbox.
- Audit ref: `live-items-18.json` - not_established
- Clients: GM and three players · Theme: both · Priority: minor
- Recipe:
  1. On the sandbox GM page: `game.drpg.runTests({ tier: 2, only: ['E52-T1', 'E52-T2', 'E20-T2', 'E20-T4', 'E20-T6'] })` (or the runner's --only).
  2. Record each result and the contract's counts printed.
- Settles it: Each pass reads the item's headless half on v14; a failure is a finding.

### L1-169 - v14's own handling of a missing required module.
- Audit ref: `live-items-18.json` - not_established
- Clients: GM · Theme: default · Priority: minor
- Recipe:
  1. Disable Dice So Nice; reload as the GM; record Foundry's own dialogs and whether danganronpa-rpg is active (game.modules.get('danganronpa-rpg').active).
- Settles it: Records which of Foundry's and the module's windows the GM sees.

### L1-170 - Stained Glass on the Actors pop-out, an NPC sheet and Daggerheart's character settings; a trial's sticky cards with a refusal.
- Audit ref: `live-items-18.json` - s7 S7-12
- Clients: GM and one player · Theme: Stained Glass · Priority: minor
- Recipe:
  1. In Stained Glass at 1920x1080 pop out the Actors tab; open an NPC sheet; open a student's character settings (the wrench) and Configure Ownership; shoot each with its size.
  2. Run a trial; give a player two sticky cards and then a refusal; shoot the player's notice stack.
- Settles it: Agrees if the pop-out and NPC sheet keep their own size, the wrench window is not sheet-sized, and the refusal pushes out the oldest sticky; a defect otherwise.

### L1-171 - Polish text fit on the module's surfaces and the extended-range fonts' load.
- Audit ref: `live-items-18.json` - s7 S7-13
- Clients: GM and one player · Theme: both · Priority: minor
- Recipe:
  1. Module language Polish, 1920x1080 then 1600x900, default theme: shoot the sheet's tiles, the HUD, the status strip, the GM panel and the gear's settings window.
  2. Record the Network panel's font requests (filter woff2).
  3. Repeat in Stained Glass.
- Settles it: Agrees if no Polish label is cut and the extended faces load (VT323-LatinExt, SpecialElite-LatinExt under glass; pixel-ext under Legacy); each cut label is a text finding.

### L1-172 - A stack handed over piece by piece between two players in one room
- Audit ref: `live-items-293.json` - 9.2 item 295, LIVE-E35-01
- Clients: one GM, two players · Theme: default · Priority: minor
- Recipe:
  1. A holds 3 Candy (one item, system.quantity 3); A and B in the same room
  2. On the GM: const before = game.drpg.sheetWrites().length
  3. A gives one Candy to B; read both inventories and count each sheet's renders (Hooks.on('renderCharacterSheet'))
  4. A gives a second; read B's item count and quantity
  5. On the GM: game.drpg.sheetWrites().length - before
- Settles it: agrees: A 2 then 1, B one entry of 1 then 2, one render each, no new sheetWrites row; defect: two entries on B, a row in sheetWrites, or a count that does not add up

### L1-173 - A Plant into full pockets, unseen and seen, and a Gear planted beside a stowed one
- Audit ref: `live-items-293.json` - 9.2 item 296, LIVE-E35-02
- Clients: one GM, three players · Theme: default · Priority: minor
- Recipe:
  1. B's hands full; A and B in one room (a third player C there for the seen run)
  2. A does Plant on B unseen; read A's message and B's whispers, notifications, AudioHelper.play calls and sheet renders
  3. Repeat seen (C in the room)
  4. B holds one stowed weapon; A plants a Gear; read B's stowed list
- Settles it: agrees: the item stays with A, A reads the refusal, B receives nothing either way, two stowed after the Gear; defect: any whisper, sound or redraw on B, or the item lost

### L1-174 - Search on a room's own table across languages, the planted item sent back, and four windows' layout
- Audit ref: `live-items-293.json` - 9.2 item 298, LIVE-E14-01
- Clients: one GM, one player · Theme: both · Priority: minor
- Recipe:
  1. GM's Foundry in English, a player's in Polish; make 'Library - Tier 1' with known entries; the player's character in the Library at Tier 1
  2. The player Searches; read the card and the item (from the Library table, tier 1 at most)
  3. The GM switches Foundry to Polish and back; the player Searches again
  4. Fill the player's hands; plant an item for Search; Search; read where it goes and the GMs' line
  5. Screenshot the item tables window, Create an item and the Give windows in both themes at 1366x768, and the Room tables tab in Stained Glass; type a refused name and shoot the line under the field
- Settles it: agrees: the room's table answers, never above the tier, names kept across the switch, the planted item back with a line, nothing past 768 px; defect: a world-pool item, a higher tier, a lost table after the switch, or a window cut off

### L1-175 - The project row of Daggerheart's Countdowns tray on the Daggerheart build in use (2.12.9), its buttons and its menu
- Audit ref: `live-items-293.json` - 9.2 item 300, LIVE-E36-02
- Clients: one GM, one player · Theme: both · Priority: minor
- Recipe:
  1. A world on Daggerheart 2.12.9 with one project and one plain countdown; GM page
  2. Press - and + on the project row; read the bar, its token and colour
  3. Right-click the project row; list the entries; Delete it; read that the project and token are gone
  4. Right-click the plain countdown; list the entries
  5. A player with the tray open presses + on a project row; read the bar
  6. Open the tray before the world finishes loading and again after F5; read the menu and the patch probe for countdown-row-menu
- Settles it: agrees: one step per click, Delete only on the project row and it takes the token, a player changes nothing, the module's menu both times; defect: two steps, Reveal or Hide on a project row, an orphan token, or Daggerheart's menu after a load

### L1-176 - A Loaded Die under a non-default dice method on Daggerheart 2.12.9, and an old Observe card's GM sentence on a player
- Audit ref: `live-items-293.json` - 9.2 item 305, LIVE-E16-06
- Clients: one GM, one player · Theme: default · Priority: minor
- Recipe:
  1. Configure Dice: set d12 to manual entry (or another non-default method)
  2. A player buys a Loaded Die and takes an action the GM does not draw; enter a d12 face other than 12
  3. Read the card for the freeCritUsed line, the outcome's Free Critical mark, and the owner's whisper and the Call's state after (loadedDieBack, armed again)
  4. On a copy of a world with an Observe card from before 1.2.50, open the player's GM Chat thread and the chat tab; read whether the 'Total N. Score it ...' sentence shows on the player and on the GM; repeat with a card written in the other language
- Settles it: agrees: no Free Critical without a 12 and the Call armed again; the old sentence hidden from the player and shown to the GM; defect: a Free Critical on a non-12, the Call lost, or the sentence on the player

### L1-177 - Fog dissolves under a fast run of crossings and across a scene switch, frame by frame
- Audit ref: `live-items-293.json` - 9.2 item 306, LIVE-E17-06
- Clients: one GM, one player · Theme: both · Priority: minor
- Recipe:
  1. A player, animations on, reduced motion off, both themes
  2. Record the screen (or a screenshot per animation frame) while the player crosses four doors in under 2 s
  3. Start a crossing and have the GM switch to the trial scene mid-dissolve; screenshot the new scene
  4. Run game.drpg.whyBlack() on the player after each; read dissolveGeneration and the layer's sprites
- Settles it: agrees: no frame shows an unvisited room, nothing of the fog on the new scene, the generation grew and no destroyed texture held; defect: a frame with an unvisited room, or a raster left on the trial scene

### L1-178 - The HUD's minutes across a pause, a reload, a session break and a new browser, and the Eclipse take-back window
- Audit ref: `live-items-293.json` - 9.2 item 307, LIVE-E17-01
- Clients: one GM, two players · Theme: default · Priority: minor
- Recipe:
  1. GM and two players, mid time of day; note the HUD minutes on all three
  2. Pause 10 min; reload the primary during it; unpause; read the minutes on all three
  3. End the session without advancing; close the world for 60 min; reopen; read the minutes
  4. Start an Eclipse from the chevron; within 5 min choose End without advancing; read actions, Free Moves, seals and the message; repeat after 6 min
  5. Pause a few minutes, unpause, reload within a minute; read the minutes
  6. End with the game running; open the next session in a fresh browser profile with no other GM; read how many minutes are lost against the last clock write
- Settles it: agrees: minutes continue from the shown number, the break adds nothing, take-back within 5 min only; defect: minutes jump or grow over a break, or a take-back after 5 min; the owner's word on whether 5 min fits

### L1-179 - Refund the last crossing at a real table, across a time-of-day change and on a slow link
- Audit ref: `live-items-293.json` - 9.2 item 308, LIVE-E17-02
- Clients: one GM, one player · Theme: default · Priority: minor
- Recipe:
  1. GM and a player; the player takes a Free Move, then nudges the token a few pixels over a room boundary
  2. Read the player's actions; the GM presses Refund the last crossing for that student in the Students window; read the token's position, the action, the player's message; press again
  3. Pay a crossing with an action; advance the time of day; refund; read actions against the budget's maximum, Sprint and the free Move
  4. Throttle the player's link (CDP Network.emulateNetworkConditions, 500 ms latency); cross and refund within 5 s; read what was given back
- Settles it: agrees: the token back where it stood, the cost back once and capped, the second click nothing; defect: the token not moved back (the put-back race read by L1), a double refund, or a refund above the maximum

### L1-180 - A console move into a locked room on another floor and the primary's send-back with level and elevation
- Audit ref: `live-items-293.json` - 9.2 item 309, LIVE-E17-03
- Clients: one GM, one player · Theme: default · Priority: minor
- Recipe:
  1. A scratch scene with two Levels (Ground 0-10, Upper 10-20), a locked room region on Upper, the player's token on Ground
  2. From the player's console: token.document.move({ x, y, level: '<Upper id>' }) into the locked room
  3. On the GM log preUpdateToken and updateToken for the token; read the final x, y, elevation and level on the server and on the player
  4. Read the player's notice
  5. Repeat with the GM's copy out of step (updateSource) to see the put-back race
- Settles it: agrees: one write back to the old x, y, elevation and level and the rule told; defect: the token left upstairs, a level kept with old x/y, two writes, or nothing written

### L1-181 - What the Mastermind's player sees of a public project and passages, and the GM's 'Knows it is there' list
- Audit ref: `live-items-293.json` - 9.2 item 313, LIVE-E17-08
- Clients: one GM, two players · Theme: default · Priority: minor
- Recipe:
  1. Choose and apply a Mastermind; make a public project in a room the Mastermind's character never entered
  2. On the Mastermind's player read the map token and the Projects tray row
  3. On the GM open the project card; read the Knows it is there list
  4. Build a Secret Passage and a breach next to a room the Mastermind has not visited; read the card's room names on the Mastermind's player
- Settles it: agrees: token and row shown, not listed until recorded, rooms named; defect: the project hidden from the Mastermind, the player listed early, or 'Unexplored room' on a Mastermind's card

### L1-182 - A rest across a chapter's end, and a rest stamped before the update
- Audit ref: `live-items-293.json` - 9.2 item 315, LIVE-E17-10
- Clients: one GM, one player · Theme: default · Priority: minor
- Recipe:
  1. A student takes a Short Rest in the time of day the chapter ends
  2. End the chapter (day back to 1, same time of day); take the Short Rest again; read whether it is offered
  3. The same with a Long Rest in an unchanged session
  4. On a copy of a world with a rest taken before 1.2.87, at the same time of day after the update, open Rest; read whether it counts as taken
- Settles it: agrees: a new chapter offers the rest again, the old stamp still counts; defect: the rest refused in the new chapter, or a second rest allowed on an old world

### L1-183 - The spread between the clock setting's change and the GM's broadcast, and within a burst of writes
- Audit ref: `live-items-293.json` - 9.2 item 316, LIVE-E17-11
- Clients: one GM, one player · Theme: default · Priority: minor
- Recipe:
  1. GM and a player on a hosted server (not localhost) if one exists, else the sandbox, noting which
  2. On the player: Hooks.on('updateSetting', ...) and a listener on the module socket for SYNC.clock, each stamping performance.now()
  3. The GM advances the time of day; then clicks 10 Despair pips quickly
  4. Record the gap per event and between successive writes
- Settles it: agrees: the spread and the burst stay under 360 ms; defect: a broadcast later than 360 ms after its setting, so the coalescer runs twice; the number goes beside COALESCE_MAX_WAIT_MS

### L1-184 - Voice drops and the voice room per crossing on a real LiveKit, with the primary's counters
- Audit ref: `live-items-293.json` - 9.2 item 326, LIVE-E88-03
- Clients: the owner as GM, one player (more for drops) · Theme: default · Priority: minor
- Recipe:
  1. A table with avclient-livekit, voice per room, proximity-voice-chat off; the owner and one player with verbose console logs and the module's detailed logs on
  2. Play normally; after each audio drop copy every 'Voice:' line with its time and note what was happening (doors, corridor, Eclipse, a second window)
  3. The player crosses through a door square into the next room; count 'Voice: the connect for' lines; read voice.gap and voice.gap.kept on the primary
  4. Step into the doorway and back; count connects
  5. Stand in the doorway; the primary reloads; press Fix voice; read the player's room, then walk in
  6. Run an Eclipse and a Class Trial with a token in a doorway
- Settles it: agrees: one connect per crossing, none for the step and back, the counters equal, main room then back in (3); defect: two connects per crossing, a connect for the step and back, or drops that line up with crossings

### L1-185 - the fog held as a picture: look, drift steps, reduced motion, cost, scene change
- Audit ref: `live-items-327.json` - 9.2 item 328, LIVE-E88-06
- Clients: a GM and one player (the player's browser measured) · Theme: both · Priority: minor
- Recipe:
  1. As a player in a room under fog, take shots of one frame on 1.2.88 and on 1.2.118: at rest, after a pan, after a window resize, and in isometric view if the table uses it
  2. Watch the drift for 30 s on 1.2.118; the owner says whether it reads as jerky
  3. Turn reduced animations on: the fog must stand; read game.drpg.counters() twice 5 s apart - fog.held.raster must not grow
  4. Run await game.drpg.fps({ toChat: false }) on both builds and record 'the fog raster and the backdrop' and the fog.* counters
  5. Change the scene while a room's fog is dissolving and look for a leftover image
- Settles it: agrees if the shots match, the drift is judged smooth enough, the fog stands under reduced motion and no old image stays; defect on any visible difference, a stuck image or a redraw under reduced motion

### L1-186 - a Despair write renders no student's sheet on a player; a minimised sheet restores current
- Audit ref: `live-items-327.json` - 9.2 item 329, LIVE-E88-07
- Clients: a GM and two players · Theme: both · Priority: minor
- Recipe:
  1. GM and two players open their students' sheets; one player minimises theirs; the GM opens a Monokuma sheet
  2. On each browser: game.drpg.counters({ reset: true })
  3. GM clicks a Despair pip, then a Reroll
  4. On each player: game.drpg.counters() - read clock.refreshSheets.rendered; on the GM read the Monokuma sheet's value
  5. GM advances the time of day; the player restores the minimised sheet and compares its values with the world
  6. During an Eclipse and during an incident, watch the player's status strip on a clock move and on a Despair write
- Settles it: agrees if rendered is 0 on players, the Monokuma value updates, the restored sheet is current and the strip moves only on the clock; defect otherwise

### L1-187 - the glass pulse looks as before E88 C5, and what it costs
- Audit ref: `live-items-327.json` - 9.2 item 330, LIVE-E88-08
- Clients: a GM (and a player for the Objection) · Theme: stained glass · Priority: minor
- Recipe:
  1. Under Stained Glass at 1920x1080, record 20 s of the curtain on 1.2.88 and on 1.2.118, or take shots at the same pulse phase
  2. Repeat during an Objection and with a pending Call
  3. Repeat at 1366x768
  4. On both builds run await game.drpg.fps({ toChat: false }); record 'the pulse (drpg-no-pulse)' and glass.pulseFrame, glass.pulseFrame.kept
- Settles it: agrees if the recordings match in phase and colour and the pulse line costs no more after; defect on a visible difference (a pane that stops, a seam that does not glow)

### L1-188 - the GM's bar on the trial console: one row, greyed reasons, one press per click
- Audit ref: `live-items-327.json` - 9.2 item 331, LIVE-E70-01
- Clients: three GMs and at least two players · Theme: both · Priority: minor
- Recipe:
  1. Three GM accounts and players, 1366x768, Stained Glass, English
  2. Open a Class Trial and the console; switch through debate, Objection, rebuttal, Testimony, Panic, Closing and one zone mode; shoot the bar each time
  3. Hover and click each greyed button; record the tooltip and the message
  4. Hold a click for a second on Skip while the console redraws; count the effects
  5. Raise an Objection as a player; watch that the GM's console stays open through the rebuttal's end
  6. Press +30 s; on a player time how long 'GM: +30 s' stands on the Event card
  7. Repeat in Monokuma Legacy and in Polish
- Settles it: agrees if the buttons never shift, every greyed one says why, a held click runs once and the console stays open; defect on any shift, silent refusal or double run

### L1-189 - Overrule by the primary and by the second GM, with real windows open
- Audit ref: `live-items-327.json` - 9.2 item 334, LIVE-E70-02
- Clients: two GMs and three players · Theme: default · Priority: minor
- Recipe:
  1. Two GMs, three players, a Nonstop Debate running
  2. Player A raises an Objection; Player B opens the evidence picker
  3. The primary GM presses Overrule within the minute; record the debate's time before and after, the price kept, the chat log card and the notice history entry, and whether the OBJECTION! window closed on every page
  4. Repeat with the second GM pressing Overrule
  5. Repeat after the rebuttal has ended: nothing on the floor moves; read the console's offer
  6. Repeat in Polish
- Settles it: agrees if each point holds on every page; defect if the stamp is missing in the chat log, a window stays open or the time is wrong

### L1-190 - the trial's steps while the primary GM's tab is in the background
- Audit ref: `live-items-327.json` - 9.2 item 335, LIVE-E70-03
- Clients: two GMs and two players · Theme: default · Priority: minor
- Recipe:
  1. Two GMs and two players; an Objection raised
  2. The primary GM switches to another tab for 2 minutes
  3. On each player page note the wall-clock time the Objection turns into the rebuttal and the rebuttal ends, against the floor's own deadline
  4. The second GM presses Skip once during that time; count the steps taken
  5. The primary returns; read the floor's record
- Settles it: agrees if each step happens on every page within the browser's throttle (record the seconds) and Skip runs once; defect if a step never happens until the primary returns or Skip runs twice

### L1-191 - Testimony at 14-15 people: real round length and behaviour
- Audit ref: `live-items-327.json` - 9.2 item 337, LIVE-E70-07
- Clients: a GM and 13-14 players · Theme: default · Priority: minor
- Recipe:
  1. A session with 14-15 participants
  2. GM opens Testimony from the console at 60 s, draws the order, moves one speaker up, starts
  3. Record the shown round length, the real time to the end, how many pressed Done early and how many passed
  4. Note any interruption
- Settles it: agrees if the shown length is 60 s times the speakers and the round runs through; a defect only if the window or the turn order fails; the rest is a reading for the owner

### L1-192 - Panic Round turn changes with the primary GM in the background
- Audit ref: `live-items-327.json` - 9.2 item 338, LIVE-E70-08
- Clients: a GM and at least three players (12 participants for the second run) · Theme: default · Priority: minor
- Recipe:
  1. A Panic Round at 15 s with the primary GM's tab hidden throughout
  2. On two player pages record, for each turn, the seconds between the speaker's zero and the change of speaker
  3. Note any turn that ended before zero on any page
  4. Repeat at 12 participants (10 s)
- Settles it: agrees if every change comes within about graceSeconds plus throttle and none before zero; defect if a turn ends early or waits for the primary's return

### L1-193 - OBJECTION! on the voice tile: grey outside a trial, live in one, layout at small sizes
- Audit ref: `live-items-327.json` - 9.2 item 342, LIVE-E70-12
- Clients: a GM and at least two players with LiveKit · Theme: both · Priority: minor
- Recipe:
  1. With LiveKit, at 1366x768 in Stained Glass, outside a trial: hover and click the tile's third button; record the text
  2. In a trial: hover (the preview), click once; count Objections; look for a second OBJECTION! on the HUD bar
  3. Turn voiceTile off; the HUD's OBJECTION! returns
  4. Shoot the tile on the wall panel, in the compact form and in the narrow row; check the name is not covered
  5. While the floor holder speaks, look for 'ma głos' under the name
  6. Repeat in Monokuma Legacy and in Polish
- Settles it: agrees if every state shows as written and nothing is covered; defect on a covered name, a live button outside a trial or two Objections from one click

### L1-194 - what a drag's preview and slide fire on v14, per browser
- Audit ref: `live-items-327.json` - 9.2 item 343, LIVE-E89-02
- Clients: a GM and two players · Theme: both · Priority: minor
- Recipe:
  1. A scene with tokenVision false (the rooms' fog)
  2. On the dragger, another player and the GM: game.drpg.counters({ reset: true })
  3. The player drags their own token across a room for about 5 s and drops it
  4. On each: game.drpg.counters(); record the six counters
  5. Repeat in the other theme
- Settles it: agrees with the harness if the preview's refreshToken counts per frame and sightRefresh falls per slide frame as scenario 86 models; a difference is a model to fix (not a module defect unless the counts show work per frame on watchers)

### L1-195 - how many updateToken one dragged path with two waypoints delivers on v14
- Audit ref: `live-items-327.json` - 9.2 item 344, LIVE-E89-03
- Clients: a GM and two players · Theme: default · Priority: minor
- Recipe:
  1. In the dragger's and a watcher's console: Hooks.on('updateToken', d => console.log(d.movement?.pending?.waypoints?.length, d.x, d.y))
  2. The player drags their token with two waypoints (Foundry's waypoint key) and drops
  3. Count the log lines and record the numbers on both pages
- Settles it: agrees with the model if 3 updates arrive with 2, 1, 0 pending on both; a different count is a harness model to correct

### L1-196 - frame time during a drag, before and after E89
- Audit ref: `live-items-327.json` - 9.2 item 346, LIVE-E89-01
- Clients: a GM and two players, the weakest machine among them · Theme: both · Priority: minor
- Recipe:
  1. On 1.2.90: the dragger and a watching player each start await game.drpg.fps({ seconds: 5, toChat: false })
  2. At once the player drags their token through a room into the next
  3. Record median, p95, frames over 33 and 50 ms, the blur line, and the four counters
  4. Repeat on 1.2.118
  5. Repeat in the other theme
- Settles it: agrees if 1.2.118's median and p95 are no worse and the counters lower on the watcher; defect if the drag is slower after

### L1-197 - a Bedroom's stash made the ordinary way, and the one-off report
- Audit ref: `live-items-327.json` - 9.2 item 347, LIVE-E89-05
- Clients: a GM and two players · Theme: default · Priority: minor
- Recipe:
  1. On a scratch world: mark a room as a Bedroom and give it to a student; in the other order on a second room
  2. Press Apply on the Stash tab without touching a cell
  3. As each owner open the stash
  4. Give one bedroom to someone else; the former owner still has their stash
  5. Delete a stash on purpose, reload as the primary GM: it does not return and no report appears
- Settles it: agrees if every bedroom has its owner's stash and a deleted one stays gone; defect otherwise. The first-1.2.91-load report can only be read on a world copy kept from before 1.2.91

### L1-198 - whether v14 sets ui.activeWindow when a module window opens
- Audit ref: `live-items-327.json` - 9.2 item 349, LIVE-E50-01
- Clients: a GM and one player · Theme: default · Priority: minor
- Recipe:
  1. As GM: const id = <a player's user id>; game.drpg.openMessenger(id)
  2. Read ui.activeWindow === foundry.applications.instances.get(`drpg-messenger-${id}`)
  3. Click in the window; read again
  4. Click in another window; read again
  5. Click on the canvas; read again
- Settles it: agrees with the model if true after open and after the click in it, false after the others; if false right after open, a thread is read only after a click - record it as a model to change and check the unread badge

### L1-199 - a hidden page and a GM's message: card, counter, read on return
- Audit ref: `live-items-327.json` - 9.2 item 350, LIVE-E50-02
- Clients: a GM and one player · Theme: default · Priority: minor
- Recipe:
  1. A player opens the messenger on Chat, then switches to another tab
  2. GM sends a message in that thread
  3. Player returns: record the card, the counter, and whether the thread reads as read once the window is in front
- Settles it: agrees if the card pops, the counter reads 1 and the thread is read after return; defect if the message is marked read while hidden

### L1-200 - a second GM's music mapping reaches everyone through the primary
- Audit ref: `live-items-327.json` - 9.2 item 353, LIVE-E50-04
- Clients: two GMs and one player · Theme: default · Priority: minor
- Recipe:
  1. Two GMs and a player; music follows the game state
  2. The second GM changes the current state's playlist; time the change on each page
  3. Both GMs change different rows at the same moment; reload both and read the rows
  4. The second GM changes a row and the primary closes its browser within 2 s; record whether the music changes when the time passes
- Settles it: agrees if music changes in about 2 s, both rows are kept and the new primary applies the change; defect if a row is lost or the change never applies

### L1-201 - the murder track is one track on the killer's, victim's and GMs' browsers
- Audit ref: `live-items-327.json` - 9.2 item 354, LIVE-E50-05
- Clients: two GMs and three players, with sound · Theme: default · Priority: minor
- Recipe:
  1. Map a murder playlist of several tracks
  2. Open an incident between two players; on each page (killer, victim, both GMs, a bystander) read game.drpg.nowPlayingHere() or listen
  3. The victim moves the Music slider during the incident
  4. After the incident, the victim reads the slider and listens for the room's music
- Settles it: agrees if one track plays on the four and none on the bystander, and the victim's volume and room music come back; defect otherwise

### L1-202 - the roll windows and cards say the threshold the action uses
- Audit ref: `live-items-327.json` - 9.2 item 355, LIVE-E51-01
- Clients: a GM and two players · Theme: default · Priority: minor
- Recipe:
  1. A player makes a General Observe in an empty room; the GM reads the card in the player's thread
  2. A player Palms another; read both Daggerheart roll window titles and the result card
  3. Open an incident; the victim loses Health; the killer opens a Finishing Blow; read the window's threshold and the GM's tracker
  4. Repeat in the other language
- Settles it: agrees if Daggerheart's v14 window shows the module's title and the numbers match the moment; defect if the title is dropped or the number is stale

### L1-203 - the doorway light after FG3 on the owner's map with a diagonal border
- Audit ref: `live-items-327.json` - 9.2 item 357, LIVE-E51-03
- Clients: a GM and one player · Theme: both · Priority: minor
- Recipe:
  1. On the owner's world (the map of the 31.10 shot), at two times of day, Stained Glass
  2. A player's character enters the outer room; shoot the border and the next rooms
  3. Repeat with the doors open and closed, at a straight and at a stepped stretch
  4. Repeat in Monokuma Legacy
  5. Compare with the 31.10 shot
- Settles it: agrees if no light shows beyond the first wall or past the far room's walls and a real doorway still glows softly; defect if patches remain or the glow is cut as a hard strip

### L1-204 - the region's caption passes on v14 in Chromium and Firefox, and only over a shown token
- Audit ref: `live-items-327.json` - 9.2 item 359, LIVE-E51-05
- Clients: a GM and two players, one on Firefox · Theme: default · Priority: minor (a caption over a hidden token would place it)
- Recipe:
  1. Make a region with Display Scrolling Text, visibility Anyone
  2. A token enters: record the caption in Chromium and in Firefox
  3. Wound the token and spend Hope: no Daggerheart caption
  4. If the region's caption is missing, wrap canvas.interface.createScrollingText to log new Error().stack and paste it
  5. A token hidden from player A by the room fog enters the region: A sees no caption, player B who sees the token does; repeat in an Eclipse
- Settles it: agrees if the region caption shows where the token shows and nowhere else; defect if it never shows (the stack then names v14's caller) or shows over a hidden token

### L1-205 - action names inside their tiles and buttons, 12 sets
- Audit ref: `live-items-361.json` - 9.2 item 362, LIVE-E66-01
- Clients: one player (and the GM to open the incident) · Theme: both · Priority: minor
- Recipe:
  1. Set the browser to 1366x768, then 1024x768, then 820x1180.
  2. In each size, under Stained Glass and Monokuma Legacy, with the module Language English and then Polski (reload each time): open a student's sheet, the incident's Crisis Actions, Tamper, the clean-up window, the indirect murder window and the rest window.
  3. Screenshot each and mark any name that leaves its tile or button, is cut, or breaks inside a word.
- Settles it: settled yes when all 12 sets show every name inside its place; settled no when any name leaves its place, is cut or breaks inside a word (name, size, theme, language)

### L1-206 - the readiness round with three real players
- Audit ref: `live-items-361.json` - 9.2 item 364, LIVE-E37-02
- Clients: GM and three players · Theme: both · Priority: minor
- Recipe:
  1. A GM and three players, both languages over two evenings; Stained Glass one evening, Monokuma Legacy the other.
  2. GM presses the HUD's Eclipse arrow, then its end button, then GM panel > Next time of day.
  3. During one round a player reloads the page; another player is disconnected.
  4. Note the round's length, who pressed One moment, whether the GM's window goes on by itself after the last Done, and whether the GM's Not now closes every player's window.
- Settles it: settled yes when each press gives each cast player one window, the reloaded player's window returns with its answer, the disconnected one reads 'counts as Done', and Not now closes every player window; settled no when a player gets two windows or none, the reloaded answer is lost, or a window stays after Not now

### L1-207 - scenario 81 against real Daggerheart sheets on v14
- Audit ref: `live-items-361.json` - 9.2 item 365, LIVE-E37-01
- Clients: GM and three players (the gate's pages) · Theme: both · Priority: minor
- Recipe:
  1. On the sandbox, `npm run gate:local` (audit/gate/README.md), or scenario 81 alone against it, once per theme.
  2. Check the results' note A reads `real`.
  3. Read the sheet render counts for a time move, a Despair write and a trial turn, and visibility.applyAll per browser for a time change, a pause, an Eclipse start and end; screenshot the victim's, killer's and a bystander's tokens after each event.
- Settles it: settled yes when note A is `real`, the counts match the harness's budget and every token looks as after a full pass; settled no when a count exceeds the budget, note A says `stand-in`, or a token differs from a full pass

### L1-208 - module load time and fetch cost on v14
- Audit ref: `live-items-361.json` - 9.2 item 369, LIVE-E41-01
- Clients: GM and one player · Theme: both · Priority: minor
- Recipe:
  1. Clear the browser cache; open the network panel.
  2. Open the world as the GM, then as a player, once per theme.
  3. Note the time to the module's ready and to the HUD's first draw, `game.drpg.perf()`, and the number, total size and last finish time of files under modules/danganronpa-rpg.
- Settles it: settled yes when the times and counts are written down beside the release read; settled no when the module is not ready or the HUD does not draw within the time a table accepts (the owner's call)

### L1-209 - the windows E41 moved, and both verdicts, at a table
- Audit ref: `live-items-361.json` - 9.2 item 370, LIVE-E41-02
- Clients: GM and one player · Theme: both · Priority: minor
- Recipe:
  1. As the GM, in English and in Polish: open Room setup (Secret passages tab), Look into the stashes, Item tables (Install / reinstall), Students, Edit campaign, Sound (Music, Effects); as a player the sound sliders; look at the HUD's stopwatch.
  2. Run an ordinary verdict with a known living Blackened and one dead student; read the list.
  3. Run a Final Trial verdict; read its first option and the selection.
  4. Ask for a second verdict from the trial console and from the Mastermind window; note the refusal's words.
- Settles it: settled yes when each window opens and works, the dead student is marked and not choosable in the ordinary list, the Final list starts with 'nobody named' and selects the first accused, and the second verdict is refused with today's words; settled no when a window fails to open or work, a list is wrong, or a second verdict goes through

### L1-210 - each browser's own reading of the dice look
- Audit ref: `live-items-361.json` - 9.2 item 372, LIVE-E60-05
- Clients: GM and two players · Theme: default · Priority: minor
- Recipe:
  1. GM and two players on their own machines.
  2. Each runs `game.drpg.diagnoseDiceLook({ test: true })`; the GM also presses Open dice look in Pre-season checks.
  3. Each compares the versions, display and preset rows with their own Dice So Nice and Daggerheart settings windows, and the test throw with its row; the GM compares each player's row with what the player reports.
- Settles it: settled yes when every row matches its person's settings and screen; settled no when any row differs from what that person's settings or screen show

### L1-211 - a player's roll window whole, and its Reaction chip
- Audit ref: `live-items-361.json` - 9.2 item 374, LIVE-E60-08
- Clients: GM and one player · Theme: both · Priority: minor
- Recipe:
  1. 1366x768, roll lock on, the module's Debug setting on, both themes.
  2. As a player click Observe on the sheet; screenshot the window; read the mode select's tooltip and the console line 'A roll window opened'.
  3. Click a statistic on the sheet; the same.
  4. Screenshot the same two windows on the GM.
- Settles it: settled yes when both windows show every section, locked and greyed, the action's chip is empty with actionRoll true and the statistic's held with held 'reaction'; settled no when a section is missing, a control is live, or the chip is held on an action

### L1-212 - one Hope/Despair look for the table
- Audit ref: `live-items-361.json` - 9.2 item 375, LIVE-E60-06
- Clients: GM and two players · Theme: default · Priority: minor
- Recipe:
  1. Daggerheart as installed (note its version), the table dice look switch on; the GM sets a Hope/Despair preset; the GM's Monokuma in a player's room.
  2. The player clicks an action, then a statistic; the GM rerolls, then rolls himself; screenshot every screen that shows each roll and run `game.messages.contents.at(-1).rolls[0].dice[0].options` after each.
  3. The GM changes the preset; the player rolls again.
  4. Switch the setting off; roll once each.
- Settles it: settled yes when every screen shows the GM's preset (the new one after the change) and, off, each person's own; settled no when any screen shows a player's own preset with the switch on, or the old preset after the change

### L1-213 - a player's dice on a GM's screen by that GM's Monokuma
- Audit ref: `live-items-361.json` - 9.2 item 376, LIVE-E60-09
- Clients: two GMs and one player · Theme: default · Priority: minor
- Recipe:
  1. Every GM and player has 'Show only mine' off in Dice So Nice.
  2. The GM's Monokuma token in the player's character's room: the player clicks an action, then a statistic; note where dice fall.
  3. Move the token to another room; repeat; the GM reads the card.
  4. A second full GM with a pool set and a Monokuma in the room: repeat; then with no pool set and two full GMs; run `game.drpg.diagnoseDice()` on a GM at the roll.
- Settles it: settled yes when dice fall on a GM only with that GM's Monokuma in the room, and with no pool and two GMs on none, diagnoseDice naming the Monokuma whose GM cannot be told; settled no when dice fall on a GM without their Monokuma there, or never fall with it

### L1-214 - styleSnapshot at a v14 table against the baseline
- Audit ref: `live-items-361.json` - 9.2 item 377, LIVE-E44-01
- Clients: GM and one player · Theme: both · Priority: minor
- Recipe:
  1. Under each theme, on the GM and on a player: `copy(JSON.stringify(game.drpg.styleSnapshot()))`.
  2. Save each output with the screen size; hand them over for the diff against audit/style-baseline.json.
- Settles it: settled yes when the diff is written down surface by surface (no difference, or each named); settled no when the snapshot cannot be taken, or a difference changes what a surface shows

### L1-215 - a panel tile pressed while a setting is written
- Audit ref: `live-items-361.json` - 9.2 item 378, LIVE-E44-02
- Clients: GM and one player · Theme: default · Priority: minor
- Recipe:
  1. Hold the mouse down on a GM panel tile.
  2. While held, a player's action writes Despair or the clock (or a second GM page writes it).
  3. Release; count the windows that open and note whether the panel redrew under the press.
- Settles it: settled yes when one window opens and the panel redraws only after the release; settled no when no window or two open, or the panel redraws under the press

### L1-216 - the full notice history window on v14
- Audit ref: `live-items-361.json` - 9.2 item 379, LIVE-E44-03
- Clients: one player (and GM once) · Theme: both · Priority: minor
- Recipe:
  1. Fill the history past 150 entries (the console or a play session).
  2. At 1366x768 and 1920x1080, each theme, open it: read the window's height against the screen, which element scrolls, whether the footer stays in view, and document.activeElement.
  3. Press Close.
- Settles it: settled yes when the window fits, only the list scrolls, the footer stays, focus is on Close and Close closes; settled no when the window passes the screen, the footer scrolls away, or Close does nothing

### L1-217 - the A8 tiles and launchers with a live LiveKit
- Audit ref: `live-items-361.json` - 9.2 item 380, LIVE-E44-04
- Clients: GM and one player · Theme: both · Priority: minor
- Recipe:
  1. A table with LiveKit on, GM and player, each theme.
  2. Look at the room tile, voice tile, launchers (greyed, GM lock, no connection), Who you hear with sliders, the GM's hexagon, Foundry tools and Map tools windows, the narrow description window; use each once.
- Settles it: settled yes when the owner finds each as it should look and work; settled no when any of them looks or works wrong (named, with a screenshot)

### L1-218 - steppers and tab bars under Monokuma Legacy
- Audit ref: `live-items-361.json` - 9.2 item 381, LIVE-E44-05
- Clients: one GM · Theme: Monokuma Legacy · Priority: minor
- Recipe:
  1. Theme Monokuma Legacy.
  2. In Edit campaign, Despair Flow (Overflow) and Season setup press - at the minimum and + at the maximum of a field; type a value out of range.
  3. Read whether each tab bar's tabs are of one width on one line, or in rows, and whether the window widened.
- Settles it: settled yes when the bounds hold, the message shows, tabs are equal on one line or in rows; settled no when a value passes a bound, no message, or tabs overflow their bar

### L1-219 - folding windows on v14, after the sheet's fix
- Audit ref: `live-items-361.json` - 9.2 item 385, LIVE-E44-08
- Clients: GM and one player · Theme: both · Priority: minor
- Recipe:
  1. As GM and as player, each theme: double-click the title bar of Despair Flow, Item tables, the narrow room description window, a character sheet and another module's window; then again to unfold.
  2. Fold a window, close it from its bar; watch for a flash of its content.
  3. Fold the messenger, have someone write, unfold it; read the unread mark before and after.
  4. With Despair Flow folded press its panel tile; with the messenger folded press its launcher.
  5. Try to fold a short confirmation window.
- Settles it: settled yes when each window folds to its bar and back, nothing flashes, the message is read only after unfolding, and the tile and launcher unfold and raise; settled no when the sheet or another window stays a strip, content flashes, a folded messenger marks read, or a press leaves it folded

### L1-220 - Escape and Enter in a tabbed window and a question on v14
- Audit ref: `live-items-361.json` - 9.2 item 386, LIVE-E44-09
- Clients: one GM · Theme: both · Priority: minor
- Recipe:
  1. Open Room setup, switch to a second tab, type in a text field and press Enter; note which button acted.
  2. Reopen and press Escape; note whether anything was saved.
  3. In Investigation start deleting a Remnant and press Escape at the question.
- Settles it: settled yes when Escape closes with no answer and Enter presses the shown primary button; settled no when Escape answers, or Enter presses another tab's button

### L1-221 - every window's footer on screen at four sizes
- Audit ref: `live-items-361.json` - 9.2 item 387, LIVE-E21-01
- Clients: GM and one player · Theme: both · Priority: minor
- Recipe:
  1. At each of the four sizes and each theme, open every GM window on each tab and every player action window.
  2. Read whether the footer and its buttons are on screen and which element scrolls; open Observe and pick each row.
  3. On a real character sheet read whether Stop is on screen.
  4. Press a tab that makes a window grow down; note whether Foundry moves it up and the footer's distance to the bottom edge.
- Settles it: settled yes when every footer is on screen, only content scrolls, Observe does not scroll from 1366x768 up, Stop is visible; settled no when a footer or button is off screen (window, tab, size, theme)

### L1-222 - an on-screen keyboard and the layout
- Audit ref: `live-items-361.json` - 9.2 item 388, LIVE-E21-02
- Clients: one player on a tablet and a phone · Theme: both · Priority: minor
- Recipe:
  1. On a tablet and a phone, each theme, as a player: open the notice history and tap its search; then an action window's request field.
  2. Read `document.body.className` before and after the keyboard shows; watch the curtain and the field.
  3. Hide the keyboard and rotate the device.
- Settles it: settled yes when the classes do not change with the keyboard, the field stays, and rotation re-lays the page; settled no when the layout switches on the keyboard or the field jumps away

### L1-223 - the messenger and the handbooks under Stained Glass
- Audit ref: `live-items-361.json` - 9.2 item 392, LIVE-E21-04
- Clients: GM and one player · Theme: stained glass · Priority: minor
- Recipe:
  1. Stained Glass, 1366x768 then 1920x1080, as a player and as the GM.
  2. Open a conversation with a long history; screenshot; scroll; read whether the input stays.
  3. Open the player's handbook at a long chapter; screenshot; scroll the contents and the text.
- Settles it: settled yes when the messenger fits and scrolls only its log with bubbles whole, and the handbook is screen-high less 16 px with two scrolls; settled no when the messenger passes the screen, hides its input, cuts bubbles, or the handbook scrolls as one

### L1-224 - the Level Up pick window on the kit
- Audit ref: `live-items-361.json` - 9.2 item 393, LIVE-E21-05
- Clients: GM and one player · Theme: both · Priority: minor
- Recipe:
  1. Each theme, in Polish: open a standard and a Reinforced Level Up pick as a player and as the GM for a student.
  2. Screenshot at 1366x768; read the footer's order and default, the scroll, the labels.
- Settles it: settled yes when Cancel left, Apply right as default, rows scroll above the footer, no label cut, it fits; settled no when the footer is wrong, a label is cut, or the window passes the screen

### L1-225 - The Safeword window's footer as drawn and pressed, on a player's and a GM's screen.
- Audit ref: `live-items-395.json` - 9.2 item 395, LIVE-E22-04
- Clients: GM and one player · Theme: both · Priority: minor
- Recipe:
  1. As PlayerOne, open the window from the sheet's Safeword button, then from the keybinding (bind one in Controls), then with `game.drpg.safeword()`.
  2. Each time read the footer: `[...document.querySelectorAll('.drpg-safeword-dialog footer button')].map(b => [b.textContent.trim(), b.className, b.getBoundingClientRect().left])` and screenshot it.
  3. Press Enter in one window and read whether the scene stopped (a public card) - then resume.
  4. Time from keydown to the window's first frame (performance.now() in a keydown listener and a MutationObserver on body).
  5. As the GM, open it from the keybinding and read the Stop button's class and computed background.
  6. Repeat under the other theme and with the Polish language.
- Settles it: Agrees if Stop is right of Cancel, carries the default, Enter stops the scene, the red text passes the module's contrast floor and the GM's Stop has no `drpg-gm-route`; a defect if Enter cancels, the order is swapped or the GM's button is red.

### L1-226 - Whether a project with an empty description or no statistic can be deleted from its edit window on v14.
- Audit ref: `live-items-395.json` - 9.2 item 399, LIVE-E21-07
- Clients: GM · Theme: either · Priority: minor
- Recipe:
  1. As GM, open Projects, the pencil on a project; clear its description; press Delete; answer the question with Delete.
  2. Read whether the project is gone (`game.drpg` project list or the tray) or a browser validation bubble appeared.
  3. Repeat with a project whose statistic is empty (set it so with a write from the console first).
- Settles it: Agrees if both deletes go through; a defect if v14's form validation stops Delete on either field.

### L1-227 - Footer and label fit of the windows probe 08 does not capture, at 1366x768 and 390x844.
- Audit ref: `live-items-395.json` - 9.2 item 401, LIVE-E21-09
- Clients: GM and one player (Palm) · Theme: both · Priority: minor
- Recipe:
  1. For each window of the item's list, open it from its real door during a seeded chapter.
  2. Read: every footer button's rect inside the viewport; elements with overflow auto/scroll other than the kit body; labels with scrollWidth > clientWidth.
  3. Screenshot each window that fails one of the three.
- Settles it: Agrees if no window fails; a defect per window that does.

### L1-228 - The curtain's turn cost and look at a real table with a GPU.
- Audit ref: `live-items-395.json` - 9.2 item 402, LIVE-E23-01
- Clients: GM and one player, each on a real machine · Theme: both · Priority: minor
- Recipe:
  1. On the owner's own browser with a GPU, both themes, at 1366x768 then 1920x1080: run `await game.drpg.fps({ toChat: false })` at rest.
  2. Run it again and, within its five seconds, change the phase (Daily Life -> Investigation) and the time of day.
  3. Note frame rate, middle frame, frames over 50 ms of both; watch the turn (panes with the texture, colour from the centre in about 1.2 s).
  4. Run `game.drpg.perf()`, do ten turns, run it again; compare GPU memory.
- Settles it: Agrees if the moving middle frame is within 2 ms of the resting one and memory does not grow; a defect otherwise.

### L1-229 - The clock's height and the curtain's cut through music starting, changing and stopping.
- Audit ref: `live-items-395.json` - 9.2 item 403, LIVE-E23-02
- Clients: GM and one player · Theme: both · Priority: minor
- Recipe:
  1. On the GM's and PlayerOne's pages add `document.addEventListener('drpgGlassCut', () => n++)`.
  2. Read `document.getElementById('drpg-hud').offsetHeight` at silence, after a playlist starts, after the next track, after stop.
  3. Change the time of day with music playing; read both again.
- Settles it: Agrees if every height is equal and the counter stays 0; a defect if the height changes or a cut fires.

### L1-230 - The board and the stack in the narrow layout at real sizes, and Foundry's columns after a layout switch.
- Audit ref: `live-items-395.json` - 9.2 item 404, LIVE-E23-03
- Clients: GM and one player · Theme: both · Priority: minor
- Recipe:
  1. At 1024x768 and 820x1180, both roles and themes: drag a token, click a door; screenshot.
  2. As a player read the order of the status bar, Projects and the Despair pools in the stack.
  3. Resize to desk and back; read the parent of #ui-left, #ui-right, the Despair bar and the event card before and after.
  4. As GM with Foundry's window switch off, screenshot the scene bar; force `ui.sidebar.render(true)` in the narrow layout and read where it lands.
- Settles it: Agrees if the board is playable and every element returns to its parent; a defect for each that does not.

### L1-231 - v14's window raise for a sheet against the module's prompts.
- Audit ref: `live-items-395.json` - 9.2 item 405, LIVE-E23-04
- Clients: GM and one player · Theme: either · Priority: minor
- Recipe:
  1. As PlayerOne, open the sheet, then a roll and Observe overlapping it; log each `.application`'s style.zIndex.
  2. Click the sheet's body; log again. Call `sheet.render(true)`; log again.
  3. As GM with the GM panel and Token Config open, change PlayerOne's Hope; log both z-indexes.
  4. Repeat with a Frisk's 'Turn out your pockets?' and a request to the GM.
- Settles it: Agrees if every `drpg-prompt` window stays above the sheet and the panel does not rise over Token Config; a defect if one is buried.

### L1-232 - The clock's pause line on every client, a late joiner and the narrow layout.
- Audit ref: `live-items-395.json` - 9.2 item 410, LIVE-E23-09
- Clients: GM and two players · Theme: both · Priority: minor
- Recipe:
  1. Add a `drpgGlassCut` counter on each page; as GM pause the game.
  2. On each page read the clock's text and `#drpg-hud` offsetHeight; resume and read again.
  3. Reload PlayerTwo while paused; read its clock. Repeat at 1024x768.
- Settles it: Agrees if every clock shows the word, the height and the cut count are unchanged and the late joiner sees it too; a defect otherwise.

### L1-233 - The module's animations under the system's reduced motion.
- Audit ref: `live-items-395.json` - 9.2 item 412, LIVE-E23-11
- Clients: GM and one player · Theme: both · Priority: minor
- Recipe:
  1. Emulate `prefers-reduced-motion: reduce` (Playwright emulateMedia) without touching the module's Appearance window.
  2. Under each theme list `document.getAnimations()` with their targets at rest, during a track title, an event and a phase change; pause the game and list again.
- Settles it: Agrees if no running animation targets a module element and the phase change ends at once; a defect for each module animation that runs.

### L1-234 - A student's token bars and HUD fields on v14, per viewer.
- Audit ref: `live-items-395.json` - 9.2 item 414, LIVE-E24-01
- Clients: GM and two players · Theme: both · Priority: minor
- Recipe:
  1. As GM hit a student; on the owner's, another player's and the GM's pages read `token.document.getBarAttribute('bar1'/'bar2')` and screenshot the token.
  2. Open the token HUD on the owner's and the GM's pages; read the two inputs' disabled property.
  3. Read the same for Monokuma's, an NPC's and a non-student actor's token.
- Settles it: Agrees if the bars equal the sheet's reserve, the other player has no Sanity bar, the inputs are disabled and others draw as Foundry; a defect otherwise.

### L1-235 - The reserve read the same with Daggerheart's pips on and off.
- Audit ref: `live-items-395.json` - 9.2 item 415, LIVE-E24-02
- Clients: GM and two clients · Theme: either · Priority: minor
- Recipe:
  1. Open one student's sheet on two pages, Daggerheart's pips on in one and off in the other.
  2. As GM hit the student; on both read the count of filled module pips and the row text; read whether the system's controls are in the DOM and hidden.
- Settles it: Agrees if both pages read the same count and row and the system controls exist hidden; a defect otherwise.

### L1-236 - The Party sheet's reserve rows per viewer on Daggerheart 2.12.9.
- Audit ref: `live-items-395.json` - 9.2 item 416, LIVE-E24-03
- Clients: GM and two players · Theme: either · Priority: minor
- Recipe:
  1. Open the Party sheet on the GM's, the owner's and another player's pages after a hit.
  2. Read each member row's text, whether pip toggles exist for a player, and whether Sanity shows for the non-owner.
  3. Check the patch's record (`game.drpg` patch report, or a console log in the hook) that `hook-party-sheet-render` fired.
- Settles it: Agrees if the rows read the reserve, no toggles for players, Sanity hidden from the non-owner and the hook fired; a defect otherwise.

### L1-237 - The module's surfaces on a client with Foundry's light theme.
- Audit ref: `live-items-395.json` - 9.2 item 419, LIVE-E24-06
- Clients: one player and the GM · Theme: both · Priority: minor
- Recipe:
  1. Set Foundry's application theme to light on PlayerOne.
  2. Under each module theme open each surface the item lists; screenshot; read the computed color and background of their text.
  3. Read core's `--color-text-primary` (or the light theme's text variables) on body.
- Settles it: Agrees if every listed surface reads dark as on a dark client; a defect per surface that turns light or unreadable.

### L1-238 - A throwing sheet step on a real Daggerheart sheet.
- Audit ref: `live-items-395.json` - 9.2 item 420, LIVE-E24-07
- Clients: GM and one player · Theme: either · Priority: minor
- Recipe:
  1. As GM, from the console replace one entry's function in sheet.mjs `SHEET_STEPS` with one that throws.
  2. Render a student's sheet on the GM's and the owner's pages twice.
  3. Read the inventory groups, the Rules tab and the '+' on both; count the GM's notices and the player's; read the consoles.
- Settles it: Agrees if the other parts draw, the GM has one notice with the step's name and the player none; a defect otherwise.

### L1-239 - The render wrapper's way out for an unknown signature, on v14.
- Audit ref: `live-items-395.json` - 9.2 item 425, LIVE-E45-02
- Clients: GM and one player · Theme: either · Priority: minor
- Recipe:
  1. As GM, `actor.update({ 'system.resources.hitPoints.value': n }, { render: false })`, then `actor.sheet.render(false, { renderContext: 'updateActor' })`.
  2. On the owner's page read the bar, pips and row against `actor.system.resources.hitPoints.value`.
  3. Log every render's options for ten ordinary writes and list any key `renderPlan` does not know.
- Settles it: Agrees if the sheet renders once and shows the actor's value, and ordinary writes carry only known options; a defect otherwise.

### L1-240 - A Monocub's Confusion tile following Hope without a render.
- Audit ref: `live-items-395.json` - 9.2 item 427, LIVE-E45-04
- Clients: GM and one player · Theme: either · Priority: minor
- Recipe:
  1. Make a student a Monocub with 0 Hope; open its sheet on the owner's page; wrap render to count calls.
  2. As GM give 1 Hope; read the Confusion tile's disabled state and the render count; set Hope to 0; read again.
- Settles it: Agrees if the tile turns available then unavailable with 0 renders; a defect if it does not change or the sheet re-renders.

### L1-241 - The project description's width with Foundry's stylesheet.
- Audit ref: `live-items-395.json` - 9.2 item 428, LIVE-E24-11
- Clients: GM and one player · Theme: both · Priority: minor
- Recipe:
  1. Under each theme, as GM open Edit project and New project; as a player Propose a project.
  2. Read the textarea's and its formGrid cell's widths and the window's; screenshot each.
- Settles it: Agrees if the textarea fills its field cell (within a few px) with the note under it; a defect if it is again a fraction of the cell.

### L1-242 - Whether `updateSetting` fires on every browser with `setting.key === "daggerheart.Automation"`, and the dead marker's image after a mid-session change.
- Audit ref: `live-items-429.json` - 9.2 item 430, LIVE-E24-13
- Clients: GM and one player · Theme: default · Priority: minor
- Recipe:
  1. On the GM's and PlayerOne's page: `Hooks.on('updateSetting', s => console.log('E24', s.key))`.
  2. As GM, change Daggerheart's Automation death icon to a custom image; note each page's log line.
  3. Kill a student; on both pages read the dead effect's `img` and the token's overlay.
  4. Set the icon back to the default and kill a second student; read again; read that the first marker kept its image.
- Settles it: Agrees if both pages log `daggerheart.Automation` and the markers follow the setting with no reload; a defect if the hook carries another key or does not fire on the player's page.

### L1-243 - Room setup's footer on every tab, one + click, the refill, and Apply bound to its own scene.
- Audit ref: `live-items-429.json` - 9.2 item 431, LIVE-E46-01
- Clients: GM and one player · Theme: both · Priority: minor
- Recipe:
  1. As GM at 1366x768 and 1920x1080, open Room setup on the school scene; visit each tab and screenshot the footer.
  2. On Searching, press + once by a room's Search Tokens; on PlayerOne read `game.drpg.tokensLeft(room)` before and after.
  3. Press the refill; read the value.
  4. Switch the canvas to another scene with the window open, change one field, Apply; read the notice's count and the scenes' room flags.
  5. Apply again with no change; read that no update was written (a `Hooks.on('updateScene')` counter).
- Settles it: Agrees if the footer is on screen on every tab, + adds 1, the refill sets the maximum and Apply writes only that field on the opened scene; a defect otherwise.

### L1-244 - The picture cell's warnings and the HEAD answers on a real server and on The Forge.
- Audit ref: `live-items-429.json` - 9.2 item 432, LIVE-E46-02
- Clients: GM · Theme: default · Priority: minor
- Recipe:
  1. As GM, set three room pictures: one large (over 8 MB or 4096 px), one small, one missing path.
  2. Open Room setup > Description with the network tab open; count HEAD requests and read each answer's Content-Length.
  3. Time from opening to the last warning; screenshot the warnings.
  4. Press Apply; read the three rooms' picture flags.
  5. Repeat on The Forge with an Assets Library picture.
- Settles it: Agrees if the large one warns with its size, the missing one says it does not load, the small one says nothing, Apply saves all three and HEAD gives a length; a defect if a warning is missing or the server gives no length and the cell says nothing.

### L1-245 - Effects' Choose, Test and Clear, the icon tooltips, and Music's save state.
- Audit ref: `live-items-429.json` - 9.2 item 433, LIVE-E46-03
- Clients: GM and one player · Theme: both · Priority: minor
- Recipe:
  1. As GM open Sound > Effects; press Choose on a row, pick a file; read the row's path field.
  2. Press Test on it (spy `foundry.audio.AudioHelper.play`), then on a row with no file; read the notice in English and Polish.
  3. Press Clear; fire that event (a scripted trigger) and read on PlayerOne that nothing plays.
  4. Hover each icon button; screenshot the tooltip.
  5. On Music change a row; screenshot 'Saving...' and 'Saved'.
- Settles it: Agrees if each button does what it says and the reason and tooltips are whole; a defect if Choose writes nowhere, Test is silent or a tooltip is missing.

### L1-246 - Season setup's row marks and the pre-season picture checks on a prepared world.
- Audit ref: `live-items-429.json` - 9.2 item 435, LIVE-E46-05
- Clients: GM · Theme: both · Priority: minor
- Recipe:
  1. On a copy world, take one student's starting resources away, split the pools unevenly, set one room picture to a broken file.
  2. As GM open Season setup; screenshot the rows; read each `li` class and text.
  3. Open Pre-season checks; read the picture row and the size row against the network tab's answer.
- Settles it: Agrees if the marks are on the rows the item names and the broken picture is listed after decoding; a defect if an optional row shows a cross or the picture passes.

### L1-247 - The Overflow tab's layout and a second GM's Clear overflow.
- Audit ref: `live-items-429.json` - 9.2 item 436, LIVE-E46-06
- Clients: two GMs · Theme: both · Priority: minor
- Recipe:
  1. Log in two Gamemaster accounts; on each open Despair Flow > Overflow at 1366x768 in both themes; screenshot.
  2. On the non-primary GM press Clear overflow; read the dialog's default button; press Yes.
  3. Time from Yes to the count reading 0 on the second GM (`performance.now()` and a MutationObserver), and read the primary's count.
- Settles it: Agrees if the question shows on the second GM with Cancel the default and both counts reach 0; a defect if nothing clears or the count differs.

### L1-248 - The console footer's height, order and Enter through a trial.
- Audit ref: `live-items-429.json` - 9.2 item 438, LIVE-E47-01
- Clients: GM and one player · Theme: both · Priority: minor
- Recipe:
  1. As GM at 1366x768, open the Class Trial console and run debate, an Objection with its Rebuttal, the vote and the verdict.
  2. In each state read `document.querySelector('.drpg-window-console footer').getBoundingClientRect().height` and the buttons' order and `autofocus`/default; screenshot.
  3. Press Enter in each state; record what ran.
  4. With no Mastermind set, hover Start the Final Trial; screenshot which tooltip shows.
  5. Repeat under Monokuma Legacy and record whether the left group wraps.
- Settles it: Agrees if the height is constant, Enter presses the right-hand next step and nothing during an Objection; a defect if Enter ever presses a left button.

### L1-249 - The tracker's width and rows through an incident, and its empty state.
- Audit ref: `live-items-429.json` - 9.2 item 439, LIVE-E47-02
- Clients: GM and two players · Theme: both · Priority: minor
- Recipe:
  1. As GM at 1366x768, open the tracker with no murder; screenshot; press 'Open a murder...' and read which window opens.
  2. Open an incident; read the tracker's width at the opening, mid-turn and in Stage 6; screenshot each.
  3. Read the Remaining fact against the victim's sheet's Health and Sanity.
  4. In Polish under Legacy, screenshot the footer.
- Settles it: Agrees if the width is constant and the rows are as the item says; a defect if the width changes, Remaining differs from the sheet or the footer is cut.

### L1-250 - The roll status lines and the Grant all / Grant none card.
- Audit ref: `live-items-429.json` - 9.2 item 442, LIVE-E47-05
- Clients: GM and one player · Theme: both · Priority: minor
- Recipe:
  1. With no GM logged in, PlayerOne rolls an action; screenshot the card.
  2. Log the GM in; screenshot the card of unwitnessed rolls; press Grant all on one and Grant none on another; read each roll's record.
  3. Make a roll that waits for the GM's ruling; screenshot its status line; repeat in Polish.
- Settles it: Agrees if each line shows in a kit box and each button does what it says; a defect if Grant all grants nothing or a line is missing.

### L1-251 - The Students window's Role, Level Up and Items with a connected player, and a console write of the role flag.
- Audit ref: `live-items-429.json` - 9.2 item 445, LIVE-E47-08
- Clients: GM and one player · Theme: both · Priority: minor
- Recipe:
  1. As GM open Students; change p1's Role to Monokuma; read the dialog's default; press Cancel; read p1's actor flags.
  2. On p1's page write the role flag from the console (`actor.setFlag('danganronpa-rpg', <role flag>, ...)`); read on both pages a few seconds later.
  3. Press Level Up on p1's row; read which menu opens and p1's sheet button.
  4. Give and take an item from the row; read the table.
- Settles it: Agrees if Cancel writes nothing, the console write is put back, Level Up lights p1's button and the table redraws; a defect if p1's own write stands.

### L1-252 - A v14 Tile's size units and floor field, and the body's room on a two-floor scene.
- Audit ref: `live-items-429.json` - 9.2 item 453, LIVE-E95-02
- Clients: GM and one player · Theme: default · Priority: minor
- Recipe:
  1. On a copy world, make a scene with two Levels and rooms on each; place a tile on one grid square by hand.
  2. Run `canvas.scene.tiles.contents.map(t => [t.x, t.y, t.width, t.height, t.elevation, t.level, t.levels])` and `Object.keys(canvas.scene.tiles.contents[0].toObject())`.
  3. Kill a student whose token stands on the upper floor; read the body tile's flag `bodyOf.level` and position.
  4. From a student in the upper room and one in the room below, open the body's loot; read Take's state and the press's answer.
- Settles it: Agrees if width and height are pixels and the upper-floor body refuses the room below; a defect if width is in squares (the room then read wrong) or the floor rule lets the lower room loot.

### L1-253 - Whether v14 sends a hidden tile to a player's browser, and what Take shows and says.
- Audit ref: `live-items-429.json` - 9.2 item 454, LIVE-E95-04
- Clients: GM and one player · Theme: default · Priority: minor
- Recipe:
  1. Kill a student (an open death); as GM hide the body tile (Tiles layer).
  2. On PlayerOne: `canvas.scene.tiles.contents.filter(t => t.flags?.['danganronpa-rpg']?.bodyOf).map(t => [t.id, t.hidden])`.
  3. Move PlayerOne's student beside the corpse; open the body's loot; read Take's `disabled` and tooltip; press it; read the notice.
  4. With the window open, as GM show, move and delete the tile in turn; read Take on PlayerOne each time.
- Settles it: Agrees if the player holds the hidden tile and Take greys as the gate refuses; if the tile is absent, the greying reads the token's room - a defect of the greying (Take looks open, the press refuses).

### L1-254 - After 1.2.113: the body tile unseen by everyone, the caption on the corpse's token, both themes and languages.
- Audit ref: `live-items-429.json` - 9.2 item 455, LIVE-E95-01
- Clients: GM and one player · Theme: both · Priority: minor
- Recipe:
  1. As GM (English) and PlayerOne (Polish), kill a student in a room both see.
  2. Screenshot the map on both; read `canvas.tiles.placeables.filter(t => t.document.flags?.['danganronpa-rpg']?.bodyOf).map(t => [t.alpha, t.visible, t.mesh?.alpha])`.
  3. Read the corpse token's children named as the caption, its text and position; screenshot with the tokens layer active.
  4. Hide the token: GM sees the caption at half alpha, PlayerOne none; move it and hover: one caption.
  5. Put the corpse in a room PlayerOne has not seen; screenshot the fog.
- Settles it: Agrees if nobody sees the tile, the caption reads over the token once, hidden and fogged as the item says; a defect if the tile still shows to a GM or the caption stacks or sits off the token.

### L1-255 - The `drpgBodyAnnounced` calls on every browser and the 1500 ms cap, with the GM's Announce in between.
- Audit ref: `live-items-429.json` - 9.2 item 456, LIVE-E95-03
- Clients: two GMs and two players · Theme: default · Priority: minor
- Recipe:
  1. On a real server log in the primary GM, a second GM and two players; on each page `Hooks.on('drpgBodyAnnounced', p => console.log('E95', performance.now(), p.writer, typeof p.waitUntil, JSON.stringify(p.victimIds)))`; on the primary also log `createChatMessage`.
  2. Walk two students into the body's room; on the primary press Announce in the window that asks.
  3. Read each page's entries; reload a player's page and rename the body's room as GM; read again.
  4. Before a second discovery, on the primary add a listener calling `p.waitUntil(new Promise(r => setTimeout(r, 5000)))`; time from Announce to the gather card.
- Settles it: Agrees if the primary logs one writer entry, every other page exactly one non-writer entry, none after the reload or rename, and the card comes after about 1.5 s; a defect if a page logs none (the setting's hook not as modelled) or two.

### L1-256 - No Breakdown or Wounded icon on any token, and the sheet's badges, for four kinds of reader.
- Audit ref: `live-items-429.json` - 9.2 item 457, LIVE-E95-05
- Clients: GM and three players (one Observer-only) · Theme: both · Priority: minor
- Recipe:
  1. Put a student in Breakdown and Wounded.
  2. On the GM, the owner, another player and an Observer-only player read `canvas.tokens.get(id).effects.children.length` and screenshot the token; reload and move it; read again.
  3. Open the sheet on each; screenshot the badges and the Sanity field.
  4. End one state; read that its badge leaves with no reopening; open the token HUD's status palette and the combat tracker; screenshot.
- Settles it: Agrees if no token shows either icon to anyone, the death overlay shows to all and the badges read as the item says; a defect if an icon shows on a token or Sanity shows to a non-owner.

### L1-257 - The murder declaration's statistic proposal through the GM's card and the opening.
- Audit ref: `live-items-429.json` - 9.2 item 458, LIVE-E68-01
- Clients: GM and two players · Theme: default · Priority: minor
- Recipe:
  1. In an Eclipse, as the killer's player declare a Direct Murder; pick Hand and write a line; screenshot the GMs' card.
  2. Press Allow; end the Eclipse with killer and victim alone; read the opening roll's statistic and count windows on the GM.
  3. Repeat with Change to: Body, then with no answer (read the window at the light and its default).
  4. Declare a betrayal from Stage 6's tile and in an Eclipse; screenshot the GM's opening window and the player's notice; run a trap and read the victim's window.
- Settles it: Agrees if each road opens on the statistic the GM's answer gives with no second window; a defect if a second window opens or the proposal is lost.

### L1-258 - Resolve's Hope and the statistic left to the player; Stage 6's Shadow rolls with no card.
- Audit ref: `live-items-429.json` - 9.2 item 459, LIVE-E68-02
- Clients: GM and one player · Theme: default · Priority: minor
- Recipe:
  1. As a player arm Resolve; read Hope before and after and the GM's chat for a card.
  2. Make a Strike (several statistics); read the roll window's statistic field and the thread.
  3. In Stage 6 as the cleaner, tamper a trace and lay a false lead; read each roll's statistic, the thread and the GM's windows; read the roll record's flags on the GM.
  4. Work a project saved with no statistic twice; read the card and the stored answer.
- Settles it: Agrees if Hope drops 2, no card is asked for Resolve or Stage 6 and both clean-up rolls are Shadow; a defect if a card appears or a roll goes on another statistic.

### L1-259 - Take from the Body's rolls, the Remnant's visibility, and the witness cards.
- Audit ref: `live-items-429.json` - 9.2 item 460, LIVE-E68-03
- Clients: GM and two players · Theme: default · Priority: minor
- Recipe:
  1. Alone beside the corpse, Take two items; read the rolls, the Remnant's place (against the tile's x, y) and visibility, and the GM's note.
  2. With a second student present, force a Hope miss and a Despair miss on the Shadow 16 (Dice So Nice or the GM's dice); read the witness's chat each time; then a hit.
  3. Take again in the same time of day with a lower and a higher roll; read the Remnant's visibility.
  4. Put the killer's accomplice in the room; record whether a cover roll is asked and whether the accomplice gets the card.
- Settles it: Agrees if one Hand roll takes all, the Remnant follows the bands and only rises, and cards follow Hope/Despair as written; a defect if Shadow is asked with no witness or a card leaks the items on a Hope miss.

### L1-260 - The corpse's caption and the unseen body tile after a public death, on a GM's and a Polish player's screen.
- Audit ref: `live-items-463.json` - 9.2 item 463, LIVE-E63-01
- Clients: GM and one player (Polish) · Theme: both · Priority: minor
- Recipe:
  1. As the GM, kill a student with a token on the scene through the Students window (dead).
  2. On the GM and on PlayerOne (module language Polish) screenshot the token; read `canvas.tiles.placeables.filter(t => t.document.flags?.['danganronpa-rpg']?.bodyOf).map(t => [t.document.alpha, t.visible, t.mesh?.worldAlpha])`.
  3. Read the caption: `canvas.tokens.get(<tokenId>).children.find(c => c.name === 'drpg-body-mark')?.children[0]?.text` and its bounds against the token's and the dead overlay's.
  4. Repeat under the other theme.
- Settles it: Agrees if no tile picture is drawn on either screen, the caption reads "{name}'s body" on the GM and "Ciało: {name}" on the player above the token without covering the overlay or the nameplate; a defect if a tile picture shows (a GM included), the caption is missing, in the wrong language or overlaps.

### L1-261 - One tile update per corpse move, by a GM's drag and by Move the Body, and the tile left behind by a Monocub.
- Audit ref: `live-items-463.json` - 9.2 item 466, LIVE-E63-04
- Clients: GM and one player (the killer) · Theme: default · Priority: minor
- Recipe:
  1. On the GM hook `updateTile` and count calls per tile id; hook `updateToken` and log the options.
  2. Drag a corpse token into another room by mouse; read the count (expect 1) and the tile's x, y against the token's.
  3. Select three corpses and drag them together; expect one update per tile.
  4. In an incident, press Move the Body as the killer; read the count and the place.
  5. Tick the student as a Monocub in the Students window; read that the token went and the tile stayed.
- Settles it: Agrees if each move gives one update per tile, at the token's corner, with no further update; a defect on a second update, a loop, a tile left behind on a move, or a tile gone with the Monocub.

### L1-262 - The open case's bodies on a 1.2.104 world updated to today's build.
- Audit ref: `live-items-463.json` - 9.2 item 467, LIVE-E63-05
- Clients: primary GM · Theme: default · Priority: minor
- Recipe:
  1. Install 1.2.104 into a scratch world; kill a non-Monocub student publicly before their trial; make another dead student a Monocub (a 1.2.104 tile).
  2. Install today's build; log in as the primary GM; read the console's migration report for `openCaseBodies` (`laid` holds the first student's name) and `bodyTilesUnseen`.
  3. Read each flagged tile: `[t.flags['danganronpa-rpg'].bodyOf.actorId, t.x, t.y, t.alpha]`.
  4. Run `await game.drpg.migrate1_2_0({ force: true })` and read the count of flagged tiles again.
- Settles it: Agrees if the first student gets one tile at their token, the Monocub's keeps its place and flag (alpha 0), and the forced run lays none; a defect on a second tile, a missing one, or a moved Monocub tile.

### L1-263 - The GM panel's tile heights per row and each icon's paint in five states, on Foundry's own stylesheet.
- Audit ref: `live-items-463.json` - 9.2 item 468, LIVE-E49-01
- Clients: GM · Theme: both · Priority: minor
- Recipe:
  1. As the GM under each theme run `game.drpg.runTests({ tier: 2, only: ["the panel's tiles in a row are one height"] })` and keep its lines.
  2. At 1366x768 and 1920x1080 open the GM panel in Daily Life, in an Eclipse with an incident and without; open every section.
  3. Per grid row read the max minus min of `getBoundingClientRect().height` of `.drpg-gm-panel button` tiles.
  4. On the Murder tile read the icon's computed `color`/`background-color` and the tile's ground at rest, :hover, :focus-visible, current and disabled; screenshot each.
- Settles it: Agrees if every row differs by 1 px or less and every icon reads 3:1 on its ground in every state (the test green); a defect otherwise, with the row and state.

### L1-264 - The room outline's glow colour after an hour change and its on-screen width at three zooms, with and without the glass blur.
- Audit ref: `live-items-463.json` - 9.2 item 470, LIVE-E49-04
- Clients: GM and one player · Theme: Stained Glass · Priority: minor
- Recipe:
  1. Under Stained Glass, as PlayerOne standing in Dorm A, set `canvas.animatePan({ scale: 0.3 })`, then 1, then 3; screenshot the outline each time.
  2. At each zoom, as the GM advance the hour; screenshot again on the player without moving.
  3. Measure the glow's width in screen pixels on each shot.
  4. Turn Glass blurs the map off in this browser's settings and shoot once more.
- Settles it: Agrees if the glow matches the line's new colour after each hour change and its width on screen is the same at all three zooms, and nothing is blurred with the setting off; a defect if the glow keeps the old colour or scales with the zoom.

### L1-265 - The same four windows at a real browser zoom against 84-viewports' emulation.
- Audit ref: `live-items-463.json` - 9.2 item 471, LIVE-E49-05
- Clients: GM and one player · Theme: default · Priority: minor
- Recipe:
  1. Run `node cluster.mjs scenarios/84-viewports.mjs` against the sandbox once and keep its results.
  2. In a headed Chromium at 1366x768 and 1280x720 press Ctrl - and Ctrl + to 80 and 120 %; as PlayerOne open the sheet (Stop button, each tab's footer) and Level Up; as the GM open Set the season up.
  3. On each read `getBoundingClientRect()` of the elements the scenario reads, against `innerWidth`/`innerHeight`.
- Settles it: Agrees if every rectangle is inside the viewport at each real zoom, as the scenario's emulation says; a defect if a real zoom puts one outside that the emulation kept inside.

### L1-266 - The Remnants' icons and names after a scene round trip.
- Audit ref: `live-items-463.json` - 9.2 item 472, LIVE-E49-07
- Clients: GM and one player · Theme: both · Priority: minor
- Recipe:
  1. As PlayerOne find a trace in Dorm A; screenshot it with its icon.
  2. As the GM activate the trial hall's scene, then the school's again.
  3. On both clients screenshot the trace and read `canvas.tokens.placeables.filter(t => t.document.flags?.['danganronpa-rpg']?.remnant).map(t => [t.name, t.children.some(c => c.name?.includes('icon') && !c.destroyed)])`.
- Settles it: Agrees if every icon and name is back after the return with no reload; a defect if an icon is missing or blank until a reload or a token moves.

### L1-267 - What NVDA and VoiceOver say for the Event panel's start, change and end, and the keyboard road through the four panels.
- Audit ref: `live-items-463.json` - 9.2 item 473, LIVE-E48-06
- Clients: GM and one player (with a screen reader) · Theme: both · Priority: minor
- Recipe:
  1. As PlayerOne with NVDA (Firefox), start a Class Trial from the GM; note what is spoken.
  2. Let the clock run 30 s and change a card from the GM; note whether each second is spoken and whether the change is.
  3. Tab through the clock, Despair, the player's bar and Projects; press Enter and Space on each; count the windows open.
  4. Repeat with VoiceOver in Safari, the other theme and Polish.
- Settles it: Agrees if the card is spoken on appearance and on change, the clock's seconds are not, and each panel takes focus and opens one explanation; a defect otherwise.

### L1-268 - The critical's notice entrance, its sound and who gets it.
- Audit ref: `live-items-463.json` - 9.2 item 474, LIVE-E48-02
- Clients: GM and two players · Theme: both · Priority: minor
- Recipe:
  1. Map a short file to the Critical slot in PlayerOne's Sound window.
  2. As PlayerOne roll a Search with a forced critical; record the notice's frames (a screen recording) and `document.querySelector('.drpg-popup[data-drpg-cut]')?.dataset.drpgCut`; spy `foundry.audio.AudioHelper.play` and count calls.
  3. Roll again with a Hope result; then turn Reduced motion on and roll a critical.
  4. On PlayerTwo and the GM read whether a notice appeared; look at the chat cards' entrance.
- Settles it: Agrees if only a critical cuts in (about 700 ms), Reduced motion gives 'still', the sound plays once on the roller alone and no one else gets the notice; a defect otherwise.

### L1-269 - A completed project's action through the clock: one time of day, and For good.
- Audit ref: `live-items-463.json` - 9.2 item 476 (first: LIVE-E93-02, AUDIT line 1438), LIVE-E93-02
- Clients: GM and one player · Theme: default · Priority: minor
- Recipe:
  1. As the GM make a public project in Dorm A with an action 'Times of day: 1'; complete it in the morning with PlayerOne's character in Dorm A.
  2. On PlayerOne read the Facilities window's rows and the Projects window's line.
  3. Advance the clock to noon; read both again and the GM's why-line.
  4. Make a second project 'For good'; complete it; run the clock to the chapter's end and past it; read each time.
  5. Set the clock back before a completion and complete one; read that the action stands now.
- Settles it: Agrees if the action stands in the morning with '1 time of day left', is gone at noon, 'For good' stays to the chapter's end and goes after, and a clock set back gives a standing action; a defect otherwise.

### L1-270 - The Facilities window and the two editors at 1366x768 and at 1280x720 (the narrowest supported).
- Audit ref: `live-items-463.json` - 9.2 item 477 (first: LIVE-E93-03, AUDIT line 1439), LIVE-E93-03
- Clients: GM and one player · Theme: both · Priority: minor
- Recipe:
  1. As the GM give Dorm A two rests, two GM actions (one with four effects) and a completed project's action.
  2. As PlayerOne open the Facilities tile's window at 1366x768 and 1280x720, both themes, both languages; read `el.scrollWidth > el.clientWidth` for the window body and each row, and screenshot.
  3. As the GM open the room action's editor and the project action's editor at the same sizes and read the same.
- Settles it: Agrees if no row is cut and nothing scrolls sideways at either size; a defect with the element and size otherwise.

### L1-271 - The operators one level down: a field inside a module flag's object.
- Audit ref: `live-items-463.json` - 9.2 item 477 (second: LIVE-E76-03, AUDIT line 1446), LIVE-E76-03
- Clients: GM · Theme: default · Priority: minor
- Recipe:
  1. On a scratch actor set `flags.danganronpa-rpg.calib = { a: 1, b: 2 }`.
  2. Run `actor.update({ 'flags.danganronpa-rpg.calib.-=a': null })`; read `actor.flags['danganronpa-rpg'].calib` and `actor._source.flags`.
  3. Run `actor.update({ 'flags.danganronpa-rpg.calib.==b': { z: 9 } })`; read it again; delete the actor.
- Settles it: Agrees if `a` is gone and `b` became `{ z: 9 }`, as the scope-level reading; a defect for the harness's model if either is kept.

### L1-272 - The settled-crossing hook on the primary for a stay, a put-back and a two-room drag.
- Audit ref: `live-items-463.json` - 9.2 item 478 (first: LIVE-E69-04, AUDIT line 1440), LIVE-E69-04
- Clients: primary GM and one player · Theme: default · Priority: minor
- Recipe:
  1. On the primary GM run `Hooks.on('drpgCrossingSettled', e => console.log(performance.now(), JSON.stringify(e)))`.
  2. PlayerOne moves Aiko from Dorm A into the Hall and stands: read one event about 2 s later.
  3. PlayerOne moves again; the GM drags the token back after about 1 s; read no event; log the updateToken times on both pages for the server's delay.
  4. PlayerOne drags through two rooms in one move: read one event, first room to last.
- Settles it: Agrees if a stay gives one event, a put-back under 2 s none, and a two-room drag one event first to last; a defect otherwise.

### L1-273 - The dice a forced player with no saved look throws, against the GM's.
- Audit ref: `live-items-463.json` - 9.2 item 479, LIVE-E76-05
- Clients: GM and one player · Theme: both · Priority: minor
- Recipe:
  1. Turn the dice look switch on; give the GM a distinctive look.
  2. As a player who never saved a look roll an action; screenshot the dice; read `game.dice3d.constructor.ALL_CUSTOMIZATION?.length` and the user's flags.
  3. Repeat under the other theme.
- Settles it: Agrees if the dice wear the GM's look (and its role looks); a defect if they wear Dice So Nice's default or a mix.

### L1-274 - Dice So Nice's saved marker and the effects on two forced players.
- Audit ref: `live-items-463.json` - 9.2 item 481, LIVE-E76-07
- Clients: GM and two players · Theme: both · Priority: minor
- Recipe:
  1. Turn the dice look switch on; PlayerOne never saved a look, PlayerTwo saved one.
  2. After both log in read `game.users.getName('PlayerOne').getFlag('dice-so-nice', 'saved')` and PlayerTwo's.
  3. Enable a module that calls `game.dice3d.addSFXDefaults` (or call it in the console); each player rolls; record whether any effect plays and the dice's look.
  4. Repeat under the other theme.
- Settles it: Agrees if both read `{ appearance: true, sfx: true }` and both roll the GM's look with no effect; a defect otherwise.

### L1-275 - The Investigation panel's frame and the Map's labels on Foundry's own CSS.
- Audit ref: `live-items-463.json` - 9.2 item 482, LIVE-E97-01
- Clients: GM · Theme: both · Priority: minor
- Recipe:
  1. As the GM open the Investigation panel at 1366x768 and 1920x1080 under each theme and language.
  2. Switch Map and Table and every tab; read the window's, header's and footer's rects each time, and the footer's row count.
  3. On the Map read each `.drpg-case-node` label's `scrollHeight` against two lines; screenshot the edges.
  4. Under Monokuma Legacy read each Table header's line breaks and the Remnants' table's `scrollWidth` against its box.
- Settles it: Agrees if the frame never moves, the footer has two rows, no label passes two lines and the table scrolls in its own box; a defect with the view and size otherwise.

### L1-276 - The realization question at a body, by road and by GM.
- Audit ref: `live-items-463.json` - 9.2 item 484, LIVE-E97-03
- Clients: primary GM, second GM, two players · Theme: default · Priority: minor
- Recipe:
  1. Seat a second Gamemaster; plan a Key slot this chapter.
  2. Discover a body from the GM's window; on both GMs log windows opening (`renderApplicationV2` with `drpg-window-case-ask`) and the muster card's time.
  3. In a new chapter let two witnesses see a body; the primary presses Announce; log the same.
  4. Find a second body; expect no question.
- Settles it: Agrees if the question opens once a chapter, on the primary alone, after the muster card on both roads; a defect otherwise.

### L1-277 - Two GMs' Run realization in the same second.
- Audit ref: `live-items-463.json` - 9.2 item 485, LIVE-E97-04
- Clients: GM and Assistant GM · Theme: default · Priority: minor
- Recipe:
  1. Seat the GM and an Assistant GM; plan two slots.
  2. On both pages press Run realization within 100 ms of each other (or call case-realize.mjs `runRealization` from each console at an agreed `Date.now()`).
  3. Count the Key Remnant tokens made; read the case meta's `run` on both.
- Settles it: Agrees if one set of Key Remnants is made; a defect if two are.

### L1-278 - The case map with a screen reader, and the redraw's cost at 60 Remnants.
- Audit ref: `live-items-463.json` - 9.2 item 487, LIVE-E97-06
- Clients: GM (screen reader) and one player · Theme: default · Priority: minor
- Recipe:
  1. With NVDA, Tab into the Map and walk it with the arrows; write down what is spoken per node.
  2. In a world with about 60 Remnants open the panel and run `await game.drpg.fps({ toChat: false })` while a player finds a Remnant.
- Settles it: Agrees if each node is spoken with kind, name, state and 'x of y' and the fps report shows no long frame at the find; a defect otherwise.

### L1-279 - The trial console's schema on Foundry's CSS: the 11 px floor, the footer, the camera and the ticks across two GMs.
- Audit ref: `live-items-463.json` - 9.2 item 488, LIVE-E99-01
- Clients: primary GM and a second GM · Theme: both · Priority: minor
- Recipe:
  1. At 1366x768 under Stained Glass open the trial console before a trial; press Fit to view; read the smallest computed font-size inside the schema and the footer's rect against the window.
  2. Start a Nonstop Debate; tick a tile on the GM; read it on a second GM.
  3. Press a mode's start on a tile; read it starts and the others grey.
  4. Drag, wheel, - + and Fit to view; read that every node's rect stays inside the schema's box; read Foundry's window header height.
- Settles it: Agrees if the smallest text is 11 px or more, the footer fits with every button, the tick shows on the second GM and the camera hides no node; a defect otherwise.

### L1-280 - Show summary and Send to everyone pressed by an Assistant GM.
- Audit ref: `live-items-463.json` - 9.2 item 489, LIVE-E99-04
- Clients: primary GM, Assistant GM, one player · Theme: default · Priority: minor
- Recipe:
  1. Run a trial to its verdict; as the Assistant GM open the console and press Show summary, then Send to everyone.
  2. Read the chat card (flag `caseSummary`) and `game.settings.get('danganronpa-rpg', 'trialProgress').summaryShown` on both GMs.
  3. Press Show summary again on the primary; expect 'already sent'.
- Settles it: Agrees if one card is made and the record's `summaryShown` is set on both GMs; a defect if the Assistant is refused, two cards go out or the mark is missing.

### L1-281 - Two GMs' ticks on different nodes in the same second.
- Audit ref: `live-items-463.json` - 9.2 item 490, LIVE-E99-05
- Clients: primary GM and a second GM · Theme: default · Priority: minor
- Recipe:
  1. Seat the primary and a second GM in a Class Trial; agree a `Date.now()` target.
  2. Each calls the tick on a different node at that time (or presses the tile's tick).
  3. After 5 s read `caseTicks(chapter)` on both.
- Settles it: Agrees if both ticks stand on both GMs; a defect if one is lost.

### L1-282 - The zones as drawn on the hall and the entry's outline and sound.
- Audit ref: `live-items-493.json` - 9.2 item 493, LIVE-E73-03
- Clients: GM and one player · Theme: both · Priority: minor
- Recipe:
  1. Link a trial hall with two zone regions; start a Straw Poll from the trial console.
  2. Screenshot the hall on the GM and on a player: each zone drawn as a discovered room's outline, labelled with the mode's answers.
  3. As the player, drag the hall token into Zone A; record the outline animation and whether `zoneEntered` (or `roomEntered`) plays (spy foundry.audio.AudioHelper.play).
  4. Count `canvas.tokens.placeables.filter(t => t.visible).length` before and after the mode starts on each page.
  5. Repeat under the other theme.
- Settles it: Agrees if both zones are drawn and named, the entry plays the outline and a sound, and the visible token count does not drop; a defect if a zone is not drawn, the outline does not play or a hall token disappears.

### L1-283 - The trial console's two layouts inside a real Foundry window.
- Audit ref: `live-items-493.json` - 9.2 item 495, LIVE-E73-05
- Clients: GM · Theme: both · Priority: minor
- Recipe:
  1. As GM at 1366x768, Stained Glass, English: open the GM panel > Case > Class Trial; read the window's getBoundingClientRect() (width 1280, top 8, bottom <= innerHeight) and whether the three footer buttons are in view.
  2. Start a Class Trial and a debate, an Objection and a Straw Poll; for each, read whether the status, the GM bar, the footer and the schema's box are inside the window with the window's own scrollTop 0.
  3. Scroll the read-out, wait three seconds of console refresh and read its scrollTop again.
  4. Repeat at 1920x1080, under Monokuma Legacy and in Polish.
- Settles it: Agrees if every part is in the window without scrolling it and the read-out's scroll survives the refresh; a defect if the footer or the bar falls off screen or the scroll resets.

### L1-284 - Whether one avclient-livekit connection can hear one room and talk in another.
- Audit ref: `live-items-493.json` - 9.2 item 496, LIVE-E92-01
- Clients: GM and two players · Theme: default · Priority: minor
- Recipe:
  1. Real LiveKit server, voice by rooms on; GM and two Spectator accounts in separate browsers, both with the listen flag off (Spectators' room).
  2. Spectator A presses 'Listen in your room'; record what A hears and whether Spectator B still hears A.
  3. Record `game.webrtc.client` room name and connection state on A before and after (a reconnect shows as a disconnect/connect pair).
- Settles it: If A hears its token's room and B still hears A, one connection holds two rooms and the switch could keep A in both; if A drops out of the Spectators' room on the switch, the current one-room design is what the client allows.

### L1-285 - The trial entry's motion, cost and still frame at a real table.
- Audit ref: `live-items-493.json` - 9.2 item 500, LIVE-E61-01
- Clients: GM and one player · Theme: both · Priority: minor
- Recipe:
  1. As GM at 1366x768 in Stained Glass, run `await game.drpg.fps({ toChat: false })` in one tab and start the Class Trial; record the frame median and p95.
  2. Read `game.drpg.counters()` and the time `entryPieces` took (performance marks around the closing, or `perf()`).
  3. Record the screen (or shoot frames) and check panes never overlap and grow.
  4. Turn on reduced motion and start again: the still closed curtain with the title for 1.5 s.
  5. Repeat at 1920x1080, as a player, and under Monokuma Legacy.
- Settles it: Agrees if frames hold near 60 fps, no pane overlaps or grows, the still frame holds 1.5 s and the panes look the same share at both sizes; a defect for a dropped frame run, an overlap or a visibly smaller pane.

### L1-286 - The microphone's key under a sequence.
- Audit ref: `live-items-493.json` - 9.2 item 501, LIVE-E61-08
- Clients: GM and one player · Theme: default · Priority: minor
- Recipe:
  1. A/V on; as a player start watching the Class Trial entry.
  2. Mid-sequence press the push-to-talk or mute key; record `game.webrtc.settings` / the tile's mic state and whether others hear.
  3. After the sequence compare the tile's buttons with before; repeat during the verdict's cut-in.
- Settles it: Agrees if the key works under the sequence and the tile returns in the same state; a defect if the key is swallowed or the tile comes back changed.

### L1-287 - What a first-floor player sees of the second floor under Isometric Perspective on v14.
- Audit ref: `live-items-493.json` - 9.2 item 502, LIVE-E61-06
- Clients: GM and one player · Theme: default · Priority: minor
- Recipe:
  1. Build a scene with two v14 Levels joined by a Change Level region, a token and a wall on each.
  2. As a player on the lower Level, screenshot with Isometric on; then use the module's floor switcher and screenshot again.
  3. Record `canvas.tokens.placeables.map(t => [t.name, t.visible, t.document.level])`.
- Settles it: If the upper floor's tokens and walls are hidden or ghosted by v14 and Isometric and the switcher suffices, C7 is not needed; if they draw over the lower floor, C7 is.

### L1-288 - The day's boards at the day's turn, their length and cost, and the card in the history.
- Audit ref: `live-items-493.json` - 9.2 item 504, LIVE-E94-01
- Clients: GM and one player · Theme: both · Priority: minor
- Recipe:
  1. As GM with Dice So Nice on, end the Night Eclipse; on a player's page time the end board and the start board (MutationObserver on #drpg-sequence) while `fps({ toChat: false })` runs.
  2. Read the mood line's text on both boards.
  3. Open the player's notice history: the end-of-day card is there.
  4. Repeat under the other theme.
- Settles it: Agrees if the boards last about 6 s and 5 s with steady frames, the mood is a word and the card is in the history; a defect otherwise.

### L1-289 - The late start-of-day board across real reloads.
- Audit ref: `live-items-493.json` - 9.2 item 505, LIVE-E94-02
- Clients: GM and one player · Theme: both · Priority: minor
- Recipe:
  1. As GM turn night into morning; at +2-3 min reload PlayerOne: record whether the start board plays (`game.drpg.counters()['sequence.late']`).
  2. Reload PlayerOne again: nothing plays.
  3. At the next new day wait 11 minutes, reload: nothing plays.
  4. Check localStorage 'drpg-sequences-played'; repeat under the other theme.
- Settles it: Agrees if the board plays exactly once inside 10 minutes and never after, and no end board plays late; a defect otherwise.

### L1-290 - Move the Body two rooms on a real school map.
- Audit ref: `live-items-493.json` - 9.2 item 507, LIVE-E64-01
- Clients: GM and one player · Theme: default · Priority: minor
- Recipe:
  1. On the academy scene with fog, run an incident to Stage 6 with PlayerOne the killer.
  2. Open Move the Body: screenshot the list, near and far headings.
  3. Pick a far room; force a critical (or roll until one): read the body tile's room.
  4. Repeat with a plain success: the body lands in the room between.
  5. From a room whose only exit is a bedroom: the far list holds nothing beyond it.
- Settles it: Agrees if the headings, landings and the bedroom rule are as listed; a defect otherwise.

### L1-291 - Which object a GM's double-click hits where a Monocub stands on its body tile.
- Audit ref: `live-items-493.json` - 9.2 item 509, LIVE-E106-01
- Clients: GM · Theme: default · Priority: minor
- Recipe:
  1. Kill a student whose token has texture.scaleX 1.2 or a ring; make it a Monocub in the Students window.
  2. Run the item's console line on the GM; hover the spot and read `[canvas.tokens.hover?.id, canvas.tiles.hover?.id]`.
  3. Double-click the token's centre, the tile's free part and the death mark: record which opens a sheet.
- Settles it: Agrees if the hover is the token and the double-click on the shared square opens the Monocub's sheet; a defect if the tile takes the hover or the click.

### L1-292 - The Monocub's token: its sheet on double-click and its look against the body token.
- Audit ref: `live-items-493.json` - 9.2 item 510, LIVE-E106-02
- Clients: GM and one player · Theme: default · Priority: minor
- Recipe:
  1. Kill a student with a dead Spectator; publish the death; make it a Monocub.
  2. As GM double-click the Monocub's token: record whether `.drpg-monocub-panel` is in the open sheet.
  3. As the owner do the same.
  4. Read width, height, texture.scaleX/fit, ring.enabled on the Monocub token and the body token; screenshot both.
  5. Run the tier-2 'E62 C3b the Monocub's token' alone three times and record each verdict.
- Settles it: Agrees if both double-clicks open the Monocub panel and the looks match; a defect otherwise; the tier-2 verdicts say whether its flakiness is the test's or the module's.

### L1-293 - The curtain's and the title's layers against real Foundry windows.
- Audit ref: `live-items-493.json` - 9.2 item 511, LIVE-E105-01
- Clients: GM and one player · Theme: both · Priority: minor
- Recipe:
  1. Open a character sheet and the GM panel; start the Class Trial.
  2. Mid-sequence read `getComputedStyle(document.documentElement).getPropertyValue('--z-index-window')` and `[...foundry.applications.instances.values()].map(a => a.element?.style.zIndex)`; `document.elementFromPoint` over a window and over the band.
  3. Open Safeword mid-sequence: is it `:modal`?
  4. Click a window's button under the sequence; end the trial and repeat; repeat at the narrow width and the other theme.
  5. Run `game.drpg.runTests()` and record R5380's line.
- Settles it: Agrees if windows stay over the curtain and clickable and the band is over them, with R5380 green; a defect if the curtain covers a window or the band is under one.

### L1-294 - The same records for a mouse drag and a stair up a Change Level region.
- Audit ref: `live-items-493.json` - 9.2 item 512, LIVE-E39-01
- Clients: GM and one player · Theme: default · Priority: minor
- Recipe:
  1. Scene with two adjacent rooms and a Change Level region to a second Level.
  2. Wrap preUpdateToken and updateToken on the player and the GM, logging changes, options._movement, tokenDoc.movement, level, region levels and userId.
  3. As the player drag the token with two waypoints by mouse; then onto the stairs.
  4. Compare the log with the shim's model (lib/shim.mjs).
- Settles it: Agrees if the drag records match the API move's shape and the stair writes `level` as the shim does; any difference is a shim fix (D7 or new).

### L1-295 - The dice look on every screen for each of the three choices.
- Audit ref: `live-items-493.json` - 9.2 item 513, LIVE-E108-01
- Clients: GM and two players · Theme: both · Priority: minor
- Recipe:
  1. In Configure Settings > Rolls and privacy, screenshot 'Dice look for the table' (three choices) on a world from before 1.2.112 with the old switch on.
  2. Pick 'Everyone: Daggerheart'; PlayerOne (with its own Hope look) rolls an action; screenshot the dice on all three screens; the GM rolls too.
  3. Pick 'Everyone: Dice So Nice'; repeat.
  4. Pick 'Each player their own'; read the users' flags before and after: nothing written.
- Settles it: Agrees if each screen shows the chosen look for every roller; a defect if a player's own look shows through a table choice.

### L1-296 - The closed curtain's wait for each browser's own scene.
- Audit ref: `live-items-493.json` - 9.2 item 523, LIVE-113R-01
- Clients: GM and two players · Theme: Stained Glass · Priority: minor
- Recipe:
  1. Link a large trial hall and the school; throttle PlayerTwo's tab to Slow 3G.
  2. On every page: `Hooks.once('canvasReady', () => console.log('ready', performance.now()))` and a MutationObserver logging #drpg-sequence's removal.
  3. Start the trial; record each page's two times; end it and record again; read `game.drpg.counters()['sequence.sceneTimeout']` and the console for the warning.
  4. Edge cases: an exit with no school and no return scene (expect 15 s and the warning); `core.noCanvas` on one page; Escape while waiting.
- Settles it: Agrees if each curtain opens just after its own canvasReady, no browser shows the scene switch and the edge cases behave as listed; a defect if a curtain opens before its scene or the owner finds the 15 s wait unacceptable.

### L1-297 - Each GM window's "?": present, its section, the scroll offset, no drag or fold; the handbook's section links.
- Audit ref: `live-items-527.json` - 9.2 item 529, LIVE-E57-01
- Clients: GM · Theme: both · Priority: minor
- Recipe:
  1. As GM at 1366x768, open each of the seven windows (Investigation on each tab).
  2. Read `document.querySelector('.application.drpg-ui .drpg-help-button')` and its tooltip; note the window's getBoundingClientRect.
  3. Click it: read the handbook's open section and the section heading's offset from the text's top; the window's rect again (unchanged, not minimized).
  4. Close the handbook and open the corner's book: it opens where the corner last stood, not the "?"'s section.
  5. In the handbook, click and press Enter on a 'section N' link; count `window.open` calls (wrap it) - none.
  6. Repeat at 820x1180, in Polish and under the other theme.
- Settles it: Agrees if all seven "?" open the named section with the heading in view and the window does not move; a defect if one is missing, opens another section, folds or drags the window, or a link opens a tab.

### L1-298 - The language of a granted item's description and of the tier-3 rewrite, against a GM page in the other language.
- Audit ref: `live-items-527.json` - 9.2 item 530, LIVE-E57-02
- Clients: GM and one player · Theme: either · Priority: minor
- Recipe:
  1. Set the world's document language to Polish (module settings) and the GM's client language to English.
  2. Grant a usable item with no description to a student (the GM's grant road); read `item.system.description`.
  3. Rule a tier-3 rewrite of a usable; read the description again.
  4. Read the grant's whisper card and the sheet on the GM (English) and on a Polish player (Polish).
  5. Swap: world English, GM Polish; repeat.
- Settles it: Agrees if both descriptions are in the world's language and every window and card in the page's; a defect if a description follows the GM's page.

### L1-299 - The D27 scoring of the v14 shots and one pass over every window of the inventory.
- Audit ref: `live-items-527.json` - 9.2 item 532, LIVE-E59-01
- Clients: GM and one player; the auditor and the owner to score · Theme: both · Priority: minor
- Recipe:
  1. After a local gate on 1.2.118, run the shot batches V01-V15 and the new surfaces on v14 at the three sizes, both themes and languages, GM and player.
  2. Score them by D27; compare styleSnapshot with audit/style-baseline.json; publish the private review page.
  3. Open each window of docs/dev/e59/WINDOWS.md once: read clipping, footer wrap, Enter's target, the smallest computed font-size at slider 80 % under Legacy, red and gold rules.
  4. Open a room picture (room tile) and read that it is Foundry's ImagePopout; read a Key Remnant ring's colour on the map.
- Settles it: Agrees if the means are 7.6 or more, no batch under 7.2 and every window passes the rules; a defect for each window that clips, wraps, defaults to a red button or breaks the 11 px, red or gold rules.

### L1-300 - checkState's warnings on a world played through a chapter.
- Audit ref: `live-items-527.json` - 9.2 item 537, LIVE-E40-01
- Clients: primary GM and one player · Theme: either · Priority: minor
- Recipe:
  1. Duplicate a world the table has played through at least one chapter (Setup > Duplicate World).
  2. Launch it; log in as the primary GM with the console open; note performance.now() at `ready` and at each warning.
  3. Check every warning against the world's data (the named actor, flag or store).
  4. Run `game.drpg.checkState()` on a player's browser: expect null and no write (watch the update hooks).
- Settles it: Agrees if every warning is English and true, and the player's call returns null; a defect for a false warning, a missed one the data shows, or a write from the player.

### L1-301 - Four surfaces on v14 against the pre-E55 shots, and the sound launcher's gear.
- Audit ref: `live-items-527.json` - 9.2 item 538, LIVE-E55-01
- Clients: GM and one player · Theme: both · Priority: minor
- Recipe:
  1. On v14 with Daggerheart 2.12.9 (the verified version), at 1366x768 and 1920x1080, each theme:
  2. Screenshot a student's sheet, the GM panel, the trial HUD (a trial running) and the corner's launchers.
  3. Compare with audit/style-freeze/ shots of the same surface; list each difference.
  4. Read the sound launcher's glyph: `getComputedStyle(document.querySelector('#drpg-sound-launcher i'), '::before').content`.
- Settles it: Agrees if the surfaces match the freeze shots and the launcher wears the gear in both themes; a defect for each difference that E55 did not mean.

### L1-302 - The three config windows' class names on v14 and the 88vh ceiling.
- Audit ref: `live-items-527.json` - 9.2 item 539, LIVE-E55-02
- Clients: GM · Theme: either · Priority: minor
- Recipe:
  1. As GM open a token's, the scene's and a tile's config.
  2. For each: `document.querySelector('.application.token-config')` (and scene-config, tile-config); read `getComputedStyle(win.querySelector('.window-content')).maxHeight` and whether it scrolls at 1366x768.
  3. Open a journal entry and an item sheet of another module (or Daggerheart's): read their content's max-height (none) and overflow.
- Settles it: Agrees if the three classes exist and the ceiling applies only to them; a defect if a class name differs on v14 (the rule then applies to nothing) or a journal is cut.

### L1-303 - The Font Awesome face v14 resolves under the module's pixel font.
- Audit ref: `live-items-527.json` - 9.2 item 540, LIVE-E55-03
- Clients: GM and one player · Theme: both · Priority: minor
- Recipe:
  1. Turn the pixel font on; reload.
  2. On a rail icon: `getComputedStyle(document.querySelector('#ui-left i.fa-solid')).fontFamily` and `::before` content.
  3. `document.fonts.check('900 16px "Font Awesome 7 Pro"')` and the same for the family read.
  4. Screenshot the rails and a window header in each theme.
- Settles it: Agrees if the family is Font Awesome's and the icons draw; a defect if any rail or header icon draws as a letter.

### L1-304 - The Panic Round's per-turn muting with real voices.
- Audit ref: `live-items-527.json` - 9.2 item 543, LIVE-E110-02
- Clients: GM and six or more players with audio · Theme: either · Priority: minor
- Recipe:
  1. Six or more players with microphones, a LiveKit server; start a Panic Round with 15 s turns.
  2. Each speaker starts talking the moment their turn shows; record the audio and compare the first word's time with the turn's start.
  3. After the round, read every user's BROADCAST_AUDIO and whether each is heard.
  4. Ask the table how it felt.
- Settles it: Agrees if first words are heard and nobody is muted after; a defect if words are cut or someone stays muted.

### L1-305 - A GM's redirect of a running Objection as a player's browser draws it.
- Audit ref: `live-items-527.json` - 9.2 item 544, LIVE-E110-03
- Clients: GM and one player · Theme: either · Priority: minor
- Recipe:
  1. Start a Class Trial; a player raises Objection at a target.
  2. GM redirects it to another target (the trial console's redirect); on the player read the new public card, the Objection card's row, the HUD's target and the event panel's line.
  3. Log the trial clock's remaining seconds each 250 ms across the redirect.
  4. Repeat in the Rebuttal.
- Settles it: Agrees if every surface names the new target and the clock does not jump; a defect for a surface left on the old target or a jump.

### L1-306 - Each trial mode's own playlist, really played, on a primary and a second GM.
- Audit ref: `live-items-527.json` - 9.2 item 545, LIVE-E110-04
- Clients: two GMs and one player · Theme: either · Priority: minor
- Recipe:
  1. Map three playlists to Testimony, Rebuttal and the Scrum phases; leave another mode unmapped.
  2. Start each mode and change Scrum's phases; on both GMs log `game.playlists.playing.map(p => [p.name, p.sounds.filter(s => s.playing).map(s => s.name)])` every 500 ms.
  3. Listen for a crossfade and for a double start.
  4. End the mode: the Discussion's playlist returns. Run the unmapped mode.
- Settles it: Agrees if one start per change, crossfaded, on the primary only, and Discussion after; a defect for a double start, the second GM starting it, or silence after the end.

### L1-307 - A character drawn above a Remnant and a project token under Isometric Perspective, and whether the layer holds.
- Audit ref: `live-items-527.json` - 9.2 item 548, LIVE-OWN115-02
- Clients: GM and one player · Theme: both · Priority: minor
- Recipe:
  1. Isometric Perspective on; an isometric scene and a plain one; a Remnant and a project token placed.
  2. Move a student, Monokuma and a Monocub onto each from the four directions; screenshot each stop.
  3. Reload, select and deselect, pan the camera; screenshot again.
  4. Place a trace in front of an Isometric wall tile; screenshot.
  5. Read `game.drpg.counters()['remnantRing.layer']` before and after 30 s of panning.
- Settles it: Agrees if the character is above in every shot and the counter does not climb with refreshes; a defect if a trace draws over a character or vanishes under a tile.

### L1-308 - The event panel in a crowded murder on v14, and a window over it.
- Audit ref: `live-items-527.json` - 9.2 item 552, LIVE-OWN115-03
- Clients: GM and one player · Theme: both · Priority: minor
- Recipe:
  1. At the owner's screen size, a murder with a fight, a body, an Overflow, a motive and a Monocub card at once.
  2. Read `getComputedStyle(document.querySelector('#drpg-events')).overflowY` and scrollHeight against clientHeight; screenshot.
  3. Read each folded card's title and press Enter on one; read '+N' against the titles out of view.
  4. Open a Foundry window (a journal) and a module window over the panel: screenshot which is on top.
- Settles it: Agrees if nothing scrolls, nothing in the list is covered and a window opened over the panel is on top and readable; a defect for a scrollbar, a covered launcher or the panel over a window.

### L1-309 - The opening's roll window, dice and spending with a Loaded Die and a Support armed, under today's rule.
- Audit ref: `live-items-527.json` - 9.2 item 555, LIVE-E112-03
- Clients: GM and the killer's player · Theme: either · Priority: minor
- Recipe:
  1. A player-killer arms a Loaded Die and a Support; the GM opens a direct murder.
  2. Screenshot Daggerheart's roll window on the killer: which Calls it lists.
  3. Roll: read the dice faces in the chat card (one 12 expected) and the Support's effect.
  4. Read the killer's sheet: both Calls spent (today's rule).
  5. Set Configure Dice to a mode that skips the draw; repeat; read whether the Loaded Die returns with a whisper.
  6. Repeat on The Forge.
- Settles it: Agrees if the window lists the armed Calls, one die is 12, both are spent, and a skipped draw gives the Loaded Die back with a whisper; a defect if a Call is shown and not applied, applied and not spent, or lost on a skipped draw.

### L1-310 - The shape of v14's token ruler's `visible` and its parts.
- Audit ref: `live-items-527.json` - 9.2 item 558, LIVE-E116-01
- Clients: GM · Theme: either · Priority: minor
- Recipe:
  1. As GM in the console: `let p = Object.getPrototypeOf(CONFIG.Token.rulerClass).prototype; const out = []; while (p && p !== Object.prototype) { out.push([p.constructor.name, Object.getOwnPropertyDescriptor(p, 'visible')]); p = Object.getPrototypeOf(p); } out`.
  2. Drag a token with waypoints; read `token.ruler` own keys and its children (path, waypoints, label objects).
  3. Set `token.ruler.visible = false` mid-drag; screenshot: path, waypoints and label gone.
- Settles it: Settled either way by the shape read; a defect if a part (the label, the waypoints) stays drawn with `visible = false`.

### L1-311 - The owner's view of their hidden token's ruler, and another player's view of neither.
- Audit ref: `live-items-527.json` - 9.2 item 560, LIVE-E116-03
- Clients: GM and two players · Theme: either · Priority: minor
- Recipe:
  1. GM hides PlayerOne's token; PlayerOne drags it with a waypoint: on PlayerOne screenshot the token and its path, waypoints and label.
  2. GM moves the same token: PlayerOne sees the ruler.
  3. On PlayerTwo log `canvas.tokens.get(id)?.visible` and `?.ruler?.visible` and screenshot during both moves.
- Settles it: Agrees if the owner sees token and ruler and the other player neither; a defect if the other player sees either, or the owner loses the ruler.

### L1-312 - perf() and fps() on the budget's machine and map, with the work the recipe names done first, and the run appended to audit/perf-baseline.json.
- Audit ref: `live-items-561.json` - 9.2 item 561, LIVE-E53-01
- Clients: GM and one player (the weakest machine) · Theme: both · Priority: minor
- Recipe:
  1. Set DRPG_FIXTURES to a copy of a played world with the largest isometric scene; run `node audit/live/perf-baseline.mjs --probe --stage E53` and read that it no longer refuses.
  2. On a 1366x768 laptop drawing on its GPU (read `chrome://gpu` renderer string, not the label), log in as GM; on the weakest player's machine log in as a player.
  3. Switch the scene to the trial hall and back; as GM open the case dashboard ('The case') and leave it open; the player takes an action that writes the sheet; let several module cards reach the chat.
  4. On both browsers run `game.drpg.perf()` and `await game.drpg.fps({ toChat: false })`; copy every line of 'What the table's own work cost on this browser' and 'Rolls the GM drew' with count, p50, p95.
  5. Repeat in the other theme; run `node audit/live/perf-baseline.mjs --run` to append the run.
- Settles it: Read when every cost line has a count above zero and audit/perf-baseline.json `runs` holds the run; agrees if no line breaks a budget the owner sets, a defect if one does. A line still reading 'none since this browser loaded' means the work was not done, not zero.

### L1-313 - The two-accused verdict window's layout and gating, the execution of the ticked student alone, and DialogV2's answer for a null callback.
- Audit ref: `live-items-561.json` - 9.2 item 563, LIVE-E40-03
- Clients: GM and two players · Theme: both · Priority: minor
- Recipe:
  1. Stage a trial whose count accuses two living students (both themes, both languages, 1366x768).
  2. Open the verdict window; screenshot the fieldset and the footer.
  3. Untick both: read the 'They got it wrong' button's `disabled`; tick one: read it again.
  4. Press 'They got it wrong' with one ticked; end the trial; read the card, the Students window, Despair and the Blackened's Reinforced Level Up.
  5. In the console, open a DialogV2 whose button callback returns null and log what `DialogV2.wait` answers.
- Settles it: Agrees if the boxes fit, the button follows the ticks and only the ticked student is lost; a defect otherwise. The DialogV2 answer is recorded either way (the module relies on neither).

### L1-314 - Isometric's silhouettes of the veiled killer behind an occluding tile.
- Audit ref: `live-items-561.json` - 9.2 item 601, LIVE-E112V-02
- Clients: GM and three players · Theme: default · Priority: minor
- Recipe:
  1. On an isometric scene with Isometric Perspective 14.0.6, mark a tile occluding; switch the client setting 'Token Silhouette' on for A, B and C.
  2. Stand A behind the tile; open a direct murder A on B; leave the opening waiting.
  3. On B's and C's pages screenshot behind the tile and sample each frame whether a silhouette sprite for A is drawn; on A's page the same.
  4. Move A behind the tile once while veiled; sample again.
- Settles it: Agrees if B and C never draw A's silhouette and A does; a defect if a silhouette shows for a frame.

### L1-315 - The coordinates of every grid step of a diagonal route.
- Audit ref: `live-items-561.json` - 9.2 item 642, LIVE-E39-04
- Clients: GM and two players · Theme: default · Priority: minor
- Recipe:
  1. On the GM's page `Hooks.on('updateToken', (d, c, o) => console.log(JSON.stringify(o._movement?.[d.id]?.passed?.waypoints?.map(w => [w.x, w.y]))))`.
  2. PlayerOne moves Aiko from (300,300) by `move([{x: 1500, y: 400}, {x: 2300, y: 500}])`.
  3. Copy the 20 pairs; put Aiko back.
- Settles it: Agrees if the pairs equal the shim's straight-line cut; a defect in the harness's model otherwise, and then each wall-audit scenario's route is read again.

### L1-316 - The movement record of a plain update.
- Audit ref: `live-items-561.json` - 9.2 item 644, LIVE-E39-06
- Clients: GM and two players · Theme: default · Priority: minor
- Recipe:
  1. On the mover's page log `o.movement` in preUpdateToken; on the GM log `o._movement[id]` (method, passed.waypoints.length) and `o.teleport` in updateToken.
  2. PlayerOne writes `token.update({x: 500, y: 300})` on Aiko two rooms away.
  3. Put her back.
- Settles it: Agrees if it is a route of one waypoint, method 'api', with grid steps; a defect in the harness's model otherwise.

### L1-317 - A mouse drag's updates and movement record.
- Audit ref: `live-items-561.json` - 9.2 item 647, LIVE-E39-09
- Clients: GM and one player · Theme: default · Priority: minor
- Recipe:
  1. On the GM and the mover log every updateToken's `o._movement[id]` (method, state, passed and pending lengths) and `t.movement` on each animation frame.
  2. Drag Aiko with the real mouse (Playwright `page.mouse` down, move in steps, pause 1 s, move on, up) across three squares and a stop.
- Settles it: Read when the counts, method and pending are recorded; the harness's model is then built from them (D4's open half).

### L1-318 - Part 3, and the cause of parts 1-2.
- Audit ref: `live-items-561.json` - 9.2 item 650, LIVE-E39-12
- Clients: GM and two players · Theme: default · Priority: minor
- Recipe:
  1. Draw one wall on the Academy (as CALIBRATION.md:199-201 did) and delete it after.
  2. PlayerOne moves Aiko through the wall and at once back; the primary GM's audit sends her back; read where she stands on the server (a fresh page) and on each page.
  3. For the cause: repeat r5 with a server-side read (a fresh GM page's `t._source`) and `game.socket` traffic on PlayerOne, to say whether the server received and refused the write.
- Settles it: Agrees if she ends where the put-back names in every run; a defect if she ends elsewhere. Parts 1-2 stay a defect against movement.mjs:3482-3491 until a stale-copy put-back lands.

### L1-319 - A token's floor when created with no level on a two-floor scene, and the default level's base.
- Audit ref: `live-items-561.json` - 9.2 item 651, LIVE-E39-13
- Clients: GM alone · Theme: default · Priority: minor
- Recipe:
  1. On a scratch scene with Levels Ground (0-10) and Upper (10-20), create a token with no `level`; read `t.level` and which level the canvas draws it in.
  2. On a scene with no levels drawn read `scene.levels.get('defaultLevel0000')` name and elevation.
  3. Delete the scratch scene.
- Settles it: Agrees if the token is on the lowest floor and base equals bottom; the name is already read as 'Level', against the harness's ''.

### L1-320 - The console's passage with no floor named on a single-floor scene, crossed by a player.
- Audit ref: `live-items-561.json` - 9.2 item 652, LIVE-E39-14
- Clients: GM and two players · Theme: default · Priority: minor
- Recipe:
  1. As GM on the Academy, `await game.drpg.passages.create({ sceneId, wallId, seg })` with no level on a wall between two rooms; read the answer and the passage's `level`.
  2. Grant it to Aiko; PlayerOne walks her through; read refusals on PlayerOne and the GM's audit.
  3. On a scratch two-floor scene, the same call with no level: read the refusal; delete the scratch scene.
- Settles it: Agrees if made with `defaultLevel0000`, crossed without a refusal or a send-back, and refused on two floors; a defect otherwise.

### L1-321 - A role change's log-out in the cases not read.
- Audit ref: `live-items-561.json` - 9.2 item 653, LIVE-E39-15
- Clients: GM and two players · Theme: default · Priority: minor
- Recipe:
  1. Make a scratch Assistant (role 3); on the GM log `userConnected` with a timestamp and `updateUser` with a timestamp.
  2. From the Assistant's console `game.user.update({role: 2})`; note whether its page goes to /join and when.
  3. As GM set PlayerOne's role 2 to 2, then a player of role 1 to 3; note each page and the two hooks' order.
  4. Delete the scratch user.
- Settles it: Agrees if only an actual change by another user logs out; a defect in the harness's model otherwise.

### L1-322 - A GM's write equal to a player's pending write, under real network delay.
- Audit ref: `live-items-561.json` - 9.2 item 654, LIVE-E39-16
- Clients: GM and one player · Theme: default · Priority: minor
- Recipe:
  1. On PlayerOne's console write `actor.setFlag('danganronpa-rpg', 'notInClass', true)` on Aiko; within the same second, as GM, set the same through the Students window's switch.
  2. Read the GM's `update()` answer, `game.drpg.sheetWrites()`, the GMs' mark from the GM console and the flag on a fresh page after 10 s.
  3. Repeat 10 times with the GM's write at different delays.
- Settles it: Agrees if the flag ends at the GM's value and the mark moved in every run; a defect if the put-back writes the old value over it.

### L1-323 - A removal of a key that is not there.
- Audit ref: `live-items-561.json` - 9.2 item 655, LIVE-E39-17
- Clients: GM and two players · Theme: default · Priority: minor
- Recipe:
  1. On a scratch actor with `preUpdateActor` and `updateActor` loggers on the GM and PlayerOne:
  2. `await a.unsetFlag('danganronpa-rpg', 'nosuchkey')`; log the answer and the hooks.
  3. `await a.update({'flags.danganronpa-rpg.nosuchkey': foundry.data.operators.ForcedDeletion.create()})`; log the same; delete the actor.
- Settles it: Agrees with the harness if the write is sent and updateActor fires; if it is not sent, the GMs' mark gap the item names is real and noteOwnDropped needs the case.

### L1-324 - When a GM hears a player's and an Assistant's page connect.
- Audit ref: `live-items-561.json` - 9.2 item 656, LIVE-E39-18
- Clients: GM, one player, a scratch Assistant · Theme: default · Priority: minor
- Recipe:
  1. On the GM's page log `userConnected` and every module socket packet with `performance.now()`.
  2. Open PlayerOne's page; note its `ready` time from its own console (`Hooks.once('ready', () => console.log(performance.timeOrigin + performance.now()))`) and its first packet.
  3. Make a scratch Assistant; open its page; the same; delete the user.
- Settles it: Agrees with the harness if a player is heard after its ready and an Assistant before; a defect in the model otherwise.

### L1-325 - Frames of GM-owned characters with two GMs, Monokuma, and the redraws on assignment, role change and account changes, on 1.2.118.
- Audit ref: `live-items-561.json` - 9.2 item 661, LIVE-F118-02
- Clients: two GMs and one player · Theme: both · Priority: minor
- Recipe:
  1. Make a second GM account (role 4); assign each GM a character owned by GMs only.
  2. Screenshot each GM's and the player's view of both tokens, both themes; run `game.drpg.diagnoseOwnRings()` on each.
  3. One GM assigns Monokuma; screenshot the other GM's and the player's views.
  4. Change an assigned character mid-session without moving any token; screenshot all three.
  5. Turn a player with no assigned character into a Gamemaster and back; then add and remove an account; screenshot after each without moving tokens.
- Settles it: Agrees if every frame matches the rule on every screen after each change without a token move; a defect otherwise (the role-change redraw first).

### L1-326 - The day's board at both ends of the day, its mood, the Evening card, the Spectator's and a late joiner's view.
- Audit ref: `live-items-561.json` - 9.2 item 663, LIVE-F118-04
- Clients: GM, one player, one Spectator · Theme: both · Priority: minor
- Recipe:
  1. With the table's sequences on, from Evening press 'Skip Eclipse'; screenshot the 'End of day N' board on GM, player and Spectator.
  2. From Night press 'Skip Eclipse'; screenshot the 'Day N' board on the same three; compare the parts under the title.
  3. Read the Evening's summary card at Night's start and the notice history's end-of-day entry.
  4. Within 10 minutes of the day's start, open a player's page fresh; screenshot.
  5. End a chapter and play to the next morning; compare the mood with the previous Night's.
  6. On a world with no mood on the clock, repeat one board; both themes and languages, 1366x768 and narrow.
- Settles it: Agrees if both boards match under the title and each case shows what the item says; a defect otherwise.

### L1-327 - The fog and the Remnant rings on the table's largest isometric map: look at several zoom levels, cost, and PIXI objects released on a scene change
- Audit ref: `old-1.2.13-B-livefindings.json` - OA-1
- Clients: GM and 1 player (the weakest machine at the table) · Theme: both · Priority: minor
- Recipe:
  1. Open the table's largest isometric scene with rooms, five or more Remnants placed, as GM and one player.
  2. On the player: `await game.drpg.fps({ toChat: false })` at rest, note the fog lines of the report.
  3. Zoom from the closest to the farthest level and back; record any strobe, shimmer or seam in the fog and the rings.
  4. Note `canvas.stage.children.length` and `PIXI.utils.TextureCache` key count, switch to another scene and back five times, read both again.
  5. Repeat the zoom check under Stained Glass and Monokuma Legacy.
- Settles it: Settled fixed if the fog and rings draw without artefacts at every zoom and the two counts return to their first values; open if a count grows with each switch or an artefact shows.

### L1-328 - Voice follows rooms (LiveKit breakout), the trial mutes who may not speak, and music follows the phase
- Audit ref: `old-1.2.13-B-livefindings.json` - OA-3
- Clients: GM and 3 players · Theme: default · Priority: minor
- Recipe:
  1. With A/V on (LiveKit, regional voice on) and the GM and three players connected, put two students in room A and one in room B.
  2. Each player says a word; record who hears whom.
  3. Move one student from A to B; record who hears whom within five seconds, and any LiveKit toast shown.
  4. Open a Class Trial and an Objection; record which microphones are blocked during the objection and the rebuttal and when they come back.
  5. Move the clock from Daily Life to an Investigation to a Class Trial; record the track each client plays.
- Settles it: Settled fixed if hearing matches the rooms after each move, the microphones match the floor, and each phase plays its track on every client; open for each step that does not.

### L1-329 - Whether another player's screen draws the dragged token's ruler (path and distance) during an Eclipse on Foundry 14.370
- Audit ref: `old-1.2.13-B-livefindings.json` - Q9
- Clients: GM and 2 players · Theme: default · Priority: minor
- Recipe:
  1. Start an Eclipse with the GM and two players connected, room visibility on.
  2. Player A drags their student's token across two rooms, holding the drag for a few seconds.
  3. Player B, watching the same scene, records whether any line, waypoint or distance label is drawn for A's token, and whether A's token itself is drawn.
  4. On A's console: `canvas.tokens.controlled[0].ruler?.visible` during the drag; on B's console the same for A's token object.
- Settles it: Settled fixed if B sees no ruler and no token for the whole drag; open (minor) if B sees the path or distance.

### L1-330 - game.drpg.perf() and game.drpg.fps() on a table machine
- Audit ref: `old-1.2.42-tasks.json` - not_established
- Clients: a GM and the slowest player machine · Theme: stained glass · Priority: minor
- Recipe:
  1. Load a scene with the cast on it under Stained Glass
  2. Run `game.drpg.perf()` then `await game.drpg.fps({ toChat: false })` on the GM and on the slowest player machine
  3. Record the frame rate, the slowest twentieth and the pulse's share into audit/perf-baseline.json runs
- Settles it: measured when a run is recorded; the grade row S0-G6 stays provisional until then

### L1-331 - E09-1's precondition and its effect
- Audit ref: `stages-05.json` - not_established
- Clients: one GM · Theme: default · Priority: minor
- Recipe:
  1. World A (1.2.118) with one trace marked Not tied on the dashboard; Back up the case.
  2. Export A's scene to an adventure or compendium and import it into a fresh world B keeping ids.
  3. Open B as the primary GM once; restore A's case file ticking 'Restore it here anyway'; the dashboard shows the trace Not tied.
  4. Reload B: read the trace's tie on the dashboard (Not tied or '-').
- Settles it: '-' after the reload confirms E09-1 (minor); 'Not tied' refutes it

### L1-332 - A token taken upstairs by a tunnel and one taken up by Foundry's level control, side by side
- Audit ref: `stages-08.json` - not_established
- Clients: one GM, one player · Theme: both · Priority: minor
- Recipe:
  1. Scene with Levels Ground 0-10 and Upper 10-20 and a room on each
  2. Take token A up by Go through, token B up by Foundry's level control
  3. Read both tokens' elevation and level; read game.drpg.whatIsHere at each
  4. Give the Upper room a region elevation band 10-20 and read both tokens' rooms again
  5. Look at both tokens' vision and the fog on the player's screen
- Settles it: agrees: both read the Upper room and see alike; defect: one of them reads no room or sees differently

### L1-333 - The Item tables window, Create an item and the Give windows at 1366x768 in both themes, with a refused tier table name
- Audit ref: `stages-09.json` - not_established
- Clients: one GM · Theme: both · Priority: minor (E14's grade cap)
- Recipe:
  1. Set the browser window to 1366x768 at Foundry's own root size
  2. As GM open the Item tables window, then each of its tabs (Tier tables, Room tables)
  3. Type a name that is not a tier table on the Tier tables tab and press Enter; screenshot the refusal under the field
  4. Open Create an item and Give / take items on a student
  5. Switch to Stained Glass and repeat
  6. Measure the Room tables tab's height against the viewport and the smallest font size in each window (DevTools computed style)
- Settles it: {'agrees': 'every window inside 768 px, no text under 11 px, the refusal under its field with the name kept', 'defect': 'a tab or window past 768 px or text under 11 px in either theme'}

### L1-334 - The Countdowns tray's controls on a project row on Daggerheart 2.12.9
- Audit ref: `stages-09.json` - not_established
- Clients: one GM, one player · Theme: both · Priority: minor (E36's grade cap)
- Recipe:
  1. On the GM, in the console: game.drpg.patches?.() or read the patch row 'countdown-row-menu' probe (patches.mjs:592-595): present and ours both true
  2. Make a project; open the Countdowns tray
  3. Press + then - on the project's row once each: the bar moves by one each time and the token keeps its colour
  4. Open the row's menu: Delete present, Reveal and Hide absent; on a countdown that is no project all three present
  5. Delete the project from the menu: the project and its token are gone
  6. As a player with the tray open press + on the project: nothing changes
  7. Reload the GM with the tray open and repeat the menu check
- Settles it: {'agrees': 'each step as written', 'defect': 'a project row showing Reveal or Hide, a + that moves the bar twice or not at all, or a Delete that leaves the project'}

### L1-335 - The nine live items of the four stages
- Audit ref: `stages-09.json` - not_established
- Clients: GM, a second GM for 299, two or three players · Theme: both · Priority: minor (each stage's grade is provisional on these)
- Recipe:
  1. Run items 295-303 of AUDIT 9.2 by the recipes in live-items-293.json rows 295-303, with today's labels (live-items-293's stale_detail for each)
- Settles it: {'agrees': "each item's reading as its text asks", 'defect': 'any card, refusal, redraw or canvas reading that differs'}

### L1-336 - Whether a proposer keeps their public project after the chat is cleared
- Audit ref: `stages-10.json` - STG-11 (E87-1)
- Clients: one GM, one player · Theme: default · Priority: minor
- Recipe:
  1. One GM, one player; the player's character stands in Dorm A and has never stood in the Library
  2. The player proposes a public project; the GM approves it with room Library
  3. Read the player's Projects tray and the map: the project shows
  4. The GM presses Foundry's Clear Chat Log
  5. The player reloads; read the tray and the map again
- Settles it: agrees with this finding: the project is gone from the player's tray and map after step 5; refutes it: it still shows

### L1-337 - A region with Display Scrolling Text over a shown token, a hidden one, and a damage caption
- Audit ref: `stages-12.json` - not_established
- Clients: one GM, two players · Theme: default · Priority: minor
- Recipe:
  1. Make a region with Display Scrolling Text on token enter, text 'TEST'
  2. As a player in Chromium, walk your token into it: the caption shows
  3. Have another player's token, hidden from you by the room fog, enter it: no caption on your screen
  4. Apply damage to your token: no Daggerheart caption floats
  5. Repeat steps 2-4 in Firefox
- Settles it: agrees: shown over a shown token in both browsers, held otherwise; defect: no region caption at all (the stack test fails) or one over a hidden token

### L1-338 - Whether a Background held unsaved after a conflict survives a close
- Audit ref: `stages-15.json` - not_established
- Clients: one GM, one player · Theme: default · Priority: minor (E24-1)
- Recipe:
  1. A GM and a player who owns a student, the student's sheet open on both.
  2. The player types a sentence into Background and does not leave the field.
  3. The GM changes one word of the same Background and leaves the field (saved).
  4. The player closes the sheet with its X: note the notice's words.
  5. The player opens the sheet again: note whether the typed sentence is in the field; then leave the field and read the stored Background.
  6. Repeat 1-4, then reload the player's page before reopening: note what the field holds.
- Settles it: agrees: the text comes back on a reopen and is saved on the next leave, and the notice says the text is kept; defect: the text is gone on a reopen, or after a reload, with no word

### L1-339 - Whether a Take's Shadow roll is asked with no witness on the taker's screen
- Audit ref: `stages-16.json` - not_established
- Clients: GM and two players · Theme: default · Priority: minor
- Recipe:
  1. Lay a body tile in a room.
  2. Put a second student in the room whose token the taker's player cannot see (a veiled killer during an opening, or a sneaking student if the table has the road).
  3. As the taker's player, Take one item; note whether a Shadow window opens.
  4. Repeat with a Monocub in the room and with nobody.
- Settles it: No Shadow window with nobody visible: no signal; a Shadow window with nobody visible: the gap stands as a leak of presence (minor).

### L1-340 - The stands given back after a zone mode
- Audit ref: `stages-18.json` - not_established
- Clients: GM, a second GM, three players · Theme: default · Priority: minor
- Recipe:
  1. Start a Straw Poll; players move their tokens.
  2. End it by End this mode; note every token's place.
  3. Repeat, ending by opening the vote, and once with the primary GM leaving mid-mode.
- Settles it: Every token on its stand after each road: holds; a token left in a zone is a defect against E73.

### L1-341 - Whether a put-back from a copy out of step lands on 14.370
- Audit ref: `stages-26.json` - STG-32 (E39-1)
- Clients: 2 GMs, 1 player · Theme: default · Priority: minor
- Recipe:
  1. Two GM pages and one player on the sandbox; the player drags their token into a room the movement rules refuse while the primary's copy still holds the previous move.
  2. Read the token's x and y on the server (another GM's page) and on the player's page 2 s after the put-back.
- Settles it: lands: the finding falls to the staged case; stays past the veto: the finding is confirmed in play

### L1-342 - The put-back from a copy out of step, in play
- Audit ref: `stages-26.json` - not_established
- Clients: 2 GMs, 1 player · Theme: default · Priority: minor
- Recipe:
  1. Two GM pages and one player; the player crosses into a refused room twice in quick succession so the second move is on its way when the first is put back.
  2. Read the token on the server and the player's page.
- Settles it: the token at the put-back's spot: race does not bite in play; past the veto: E39-1 confirmed in play

### L1-343 - The shim's assumed details of a v14 move and the put-back from a copy out of step
- Audit ref: `stages-26.json` - stage E39
- Clients: a GM and one player (a bystander page for the hooks) · Theme: default · Priority: minor (E39-1); stage cap 9
- Recipe:
  1. On the 30099 sandbox with a GM and one player, drag a student's token by mouse across two rooms with a waypoint (method dragging) and read options._movement, _priorRegions and the hook order on the mover, the primary GM and a bystander (LIVE-E39-02 to -09, -11).
  2. With a GM's copy of the token one step behind (a move still on its way), have the module send the token back (a vetoed crossing) and read the token's spot on every page and on the server (LIVE-E39-12).
  3. Write a guarded flag a player's pending write already left and read the GMs' mark (LIVE-E39-16, -17).
- Settles it: the shim's model holds if every field matches lib/shim.mjs; the put-back promise holds if the token lands at the put-back's spot on every page, and fails if it stays where the move left it


## Priority: grade cap 9

### L1-344 - The readings E88 and the perf-open line name
- Audit ref: `domain-core-d-api-diag.json` - not_established
- Clients: GM and players · Theme: both · Priority: not graded
- Recipe:
  1. As the owner's table already plans in LIVE-E33-05 and LIVE-E88-01
- Settles it: As those items say

### L1-345 - LIVE-E06-03 (Dice So Nice on every account), LIVE-E06-07 (the old chat log rewritten on a copy of a played world), LIVE-E06-08 (a ruling card on a player's Chat tab), and the halves of LIVE-E06-01/-02
- Audit ref: `stages-03.json` - stage E06
- Clients: GM and three players · Theme: default (one pass in stained glass for step 4) · Priority: grade cap 9 (rule 1); E06 graded 8
- Recipe:
  1. On a copy of the owner's played world from before 1.2.65 (or a world saved on 1.2.64), load 1.2.118 as the primary GM and read the count neutraliseOldCards reports (migrate.mjs:872); open one old module roll's document in a player's console: speaker alias Monokuma, no actor, empty system.title, rolls without data/effects/experiences.
  2. Three players plus the GM, Dice So Nice on, 'Hide 3D dice on secret rolls' off then on: a player's Search; a direct murder's opening; a trap's opening - watch each screen for dice.
  3. Same table: a Reroll of that Search - the 3D dice on the roller's screen only; a bystander's console reads the rewritten message naming nobody.
  4. A ruling card (a Search proposed on Hand) on the player's Chat tab: no GM-only line, no GM button.
  5. A safeword press while the only GM presses F5: one card on every screen after 3 s, the caller's card saying their browser posted it.
  6. A direct murder with a murder playlist mapped: the victim hears nothing while the killer rolls the opening.
- Settles it: each step as written - E06's chat and dice promises hold at a table and the grade loses 'provisional'; a die, a name or a GM-only line on a screen that should not have it is a finding against E06 (major at least where it names a killer or a role)

### L1-346 - LIVE-E07-01 to -12: the fight from an Eclipse to Stage 6 on three accounts, the betrayal, the Tier 1 knife on a Despair hit, the damage lines, the crisis menu and the GM's pick with Daggerheart's roll
- Audit ref: `stages-03.json` - stage E07
- Clients: two GMs and three players · Theme: both · Priority: not graded; the incident's rules are major-class
- Recipe:
  1. Eclipse, a direct murder by player A on player B at Night: A's opening window shows the advantage chip locked; the opening's statistic is the GM's pick in the murder window.
  2. In the fight: the tile reads 'Crisis actions' / 'Fight back', dimmed off-turn with its line; a crisis action listing several statistics waits for the GM's card in the player's thread; the roll window's Statistic select is locked to the pick.
  3. A Despair hit with a Tier 1 knife: the damage lands, then the knife breaks; the victim reads 'You lose 2 Health.' and the others the victim's name.
  4. A Finishing blow that kills: the Reroll is refused before Hope is paid.
  5. Stage 6 clean-up with gloves, put away; the discovery breaks them.
  6. A second GM presses Pass while the primary resolves an action; then the primary reloads mid-fight.
  7. The murder window on a Polish client, opened from a trap's card.
- Settles it: each as the 1.2.66 notes say - E07 is read at a table; any step otherwise is a finding against the incident (major where it breaks a rule of the fight)

### L1-347 - LIVE-E08-01 (a player's Reroll of a real Daggerheart roll at a table), -02 (a GM reload at each journal phase), -03's unread half (a Reroll as the primary changes), -04 (an erase rerolled keeps its to
- Audit ref: `stages-03.json` - stage E08
- Clients: two GMs and three players · Theme: default · Priority: grade cap 9 (rule 1); E08 graded 7
- Recipe:
  1. GM and three players, Dice So Nice on: a player's Search with Hope 3; press Reroll: Hope 3 -> 0 paid on the GM, the card struck with the old and new totals, the new dice on the roller's screen only.
  2. Repeat, with the GM pressing F5 at each phase (game.drpg cut points: before replay, during replay, during payment): read the card each phase leaves and the character's Hope.
  3. Right-click the player's own roll card: no Reroll entry (Daggerheart 2.12.9). In the player's console rewrite the message's rolls: the primary GM puts them back and whispers the GMs.
  4. Two GMs: the primary leaves during a Reroll; the second GM's journal pass recovers the row.
  5. A Stage 6 erase rerolled: the trace comes back under its old token id.
  6. Tier 2's five Reroll tests (35, 40-43 on the sandbox) once the tests' stand-in roll writes terms (LOCAL-REPORT.md on claude/e58-local :328-343).
- Settles it: each as the 1.2.67 notes say - the Reroll is measured on a real Daggerheart roll for the first time and E08 may rise to 8-9; Hope paid twice, a card not struck, dice on every screen or a recovery that gives back Hope never paid is a major finding

### L1-348 - LIVE-E32-01 (which grid cases stand down on the QA world and the grid's time) and LIVE-E32-02 (a running incident carried across the 1.2.65 -> 1.2.66 update)
- Audit ref: `stages-03.json` - stage E32
- Clients: GM and three players (1); GM and two players (2) · Theme: default · Priority: grade cap 9 (rule 1); E32 graded 8
- Recipe:
  1. On the QA world, run game.drpg.runTests({ tier: 2, only: 'grid ' }) as GM with three players connected; write down each grid case's pass/fail/skip and the total time.
  2. On a world left on 1.2.65 with a direct murder in its fight (round 2, one hindrance set), install 1.2.118, reload as the primary GM: the fight's round, side and hindrance are in the GMs' store; a player's console reads game.settings.get('danganronpa-rpg','murderState') with only active and stage.
- Settles it: 58 grid cases green or each skip a fixture the world lacks - the grid promise measured on a table; a red case is a finding against E32/E07; any fight field left in world data after the update is a major finding

### L1-349 - the drawn roll at a table: the roller's dice in their own colours, the header naming the roller's character, the round trip from Roll to dice, and rollFlags() over a chapter
- Audit ref: `stages-04.json` - E28
- Clients: GM, assistant GM (for step 4), two players · Theme: both · Priority: grade cap 9 (E28's main promise)
- Recipe:
  1. Foundry 14.370, Daggerheart current, Dice So Nice on; a GM and two players, each in their own browser.
  2. Each player rolls an action (a Search) and a statistic from the sheet, then Shift-clicks one.
  3. On each screen read: who the dice fall for and in which colours, the card's header, the whisper line; time Roll to dice on the roller.
  4. Disconnect the GM, roll an action and a statistic as a player; reconnect, read the away card, press Grant all once from an assistant GM.
  5. At the end of the evening run game.drpg.rollFlags() on the primary GM and save the output.
- Settles it: settled yes when no GM is ever shown as the roller, the dice are the roller's colours, the action is refused with no GM and Grant all moves Hope once, and rollFlags() holds no flag of an honest roll; settled no on any false flag or a GM shown as the roller

### L1-350 - an ordinary chapter with no false put-back, no false card and no false 'not counted' line, and sheetWrites() and rollFlags() read at its end
- Audit ref: `stages-04.json` - E29
- Clients: GM, two players · Theme: default · Priority: grade cap 9 (E29's main promise, LIVE-E29-03)
- Recipe:
  1. Foundry 14.370, Daggerheart current, lockPlayerResources on (default); a GM and two players.
  2. Play one Daily Life day and one investigation: rests, an item used, a Level Up, a Call bought on the GM, a Reroll, a refund.
  3. As a player, try the Party sheet's pips and the token HUD's bars (they should not take input).
  4. As a player, delete a module item on Daggerheart's own sheet; read the GM's card and press Undo.
  5. At the end run game.drpg.sheetWrites() and game.drpg.rollFlags() on the primary GM and save both.
- Settles it: settled yes when every row of sheetWrites() is one a person made by hand and no ordinary play left a put-back, a card or a 'not counted' line; settled no on any row or line ordinary play caused

### L1-351 - scenario 83's legal roads and a player's console changes on a real Foundry, through the local gate
- Audit ref: `stages-04.json` - E33
- Clients: GM, three players (the gate's pages), or a GM and two players at a table · Theme: both · Priority: grade cap 9 (E33's main promise, LIVE-E33-01)
- Recipe:
  1. On the sandbox at :30099 with Daggerheart 2.6.5, then the current 2.12.x, run npm run gate:local in audit/harness so the part sandbox-83-roll-integrity runs.
  2. Read audit/gate/local-gate.json: the part's status and its evidence.
  3. At a table, as a player, press Daggerheart's 'Reroll action roll' and the die button on a drawn card and on an own roll; read sheetWrites() on the primary GM.
  4. With forcePrivateRolls on, roll as a Monocub with another student in its room, and as a GM from a student's sheet; read each message's whisper list on a player's console.
- Settles it: settled yes when the gate part is 'passed' with 0 flags and 0 rows on the legal roads and every console change traced to its sender; settled no on a flag of a legal road or an untraced change

### L1-352 - the fog and the Murder window on the split files at a table
- Audit ref: `stages-04.json` - E34
- Clients: GM, one player · Theme: both · Priority: grade cap 9 (LIVE-E34-01, -02)
- Recipe:
  1. Foundry 14.370 on the current release; a GM and one player on a scene with rooms and fog.
  2. Walk the player into a new room; watch the reveal, the door glow and the room's outline land, fade and recolour at a change of the hour; zoom in and out.
  3. On the GM run game.drpg.diagnoseFog(), whyBlack(), whatIsHere(), checkRegions() and fogPeek(); compare with a 1.2.69 reading if one exists (none in the repository).
  4. Open the Murder window and the tracker, press 'Ask for the opening roll again', play a crisis action, Stage 6 and a betrayal offer.
  5. Time the world's load (F5 to the canvas ready) on the GM.
- Settles it: settled yes when each step draws and answers with no console error; settled no on an error naming one of the eleven files or a missing name

### L1-353 - the author and timestamp Foundry stamps on a message a player's browser creates
- Audit ref: `stages-04.json` - not_established
- Clients: GM, one player · Theme: default · Priority: grade cap 9 (E33)
- Recipe:
  1. Foundry 14.370; a GM and one player.
  2. On the player's console: await ChatMessage.create({ content: 'x', author: game.users.find(u => u.isGM).id }) and note whether it is refused or stored.
  3. On the GM's console read the new message's author.id and _stats.createdTime / timestamp.
  4. Repeat with a timestamp two days back in the create data.
- Settles it: settled yes when the stored author is the player (or the create is refused) and the timestamp is the server's; settled no when a player can store a GM as author

### L1-354 - a module option key on a player's own actor and item writes, as the primary GM's hooks receive it
- Audit ref: `stages-04.json` - not_established
- Clients: GM, one player · Theme: default · Priority: grade cap 9 (E29)
- Recipe:
  1. Foundry 14.370; a GM and one player.
  2. On the GM's console: Hooks.on('updateActor', (d, c, o, u) => console.log('drpg', o.drpgWrite, u)); the same for updateItem and deleteItem.
  3. As the player, spend an action and use an item on the own student (module roads that name a reason).
  4. Read the GM's console lines.
- Settles it: settled yes when each hook logs the reason the module named and the player's id; settled no when the option arrives undefined

### L1-355 - LIVE-E09-01 (the investigation end to end with two GMs, the fee once on the primary), -02 (the dashboard open on both GMs, savedOver), -03 (the Observe card on a second GM with the primary's window hi
- Audit ref: `stages-05.json` - stage E09
- Clients: two GMs and two players · Theme: both (step 6), default for the rest · Priority: grade cap 9 (rule 1); E09 graded 8
- Recipe:
  1. Two full GMs (one the primary) and two players on 1.2.118. A player Observes in a room with two traces and asks for a focused gaze: the card shows on both GMs; the second GM picks a trace; the player is told; a second pick from the primary is refused and told.
  2. A player Analyzes a Key copy; a player Tampers a trace with a reshape; the primary approves; the second GM tries to rule the same card and is told who ruled.
  3. Both GMs open the Investigation dashboard; the second GM changes a trace's Player description and saves; the primary, without reopening, changes a different field and the same one, and saves: the shared field is marked and named in the savedOver warning, the other saved.
  4. With two Key Remnants found of a case of three, the second GM opens the Class Trial: the Despair whisper appears once, on the primary's charge (3 per Monokuma pool), and pressing Start again charges nothing.
  5. Open End of chapter: the sweep count equals what the sweep removes; after it, a Faint copy is still unread and analysable next chapter.
  6. Screenshot the dashboard at 1400 px and below the narrow threshold in both themes.
- Settles it: each step as written - the main promise holds at a table and the grade loses 'provisional'; a second Despair charge, a charge on the non-primary, or a lost field without a savedOver line is a finding against E09 (major)

### L1-356 - LIVE-E10-01 (a whole Class Trial on three accounts: late player, F5 in the vote, verdict, one card each, the Level Up window), -02 and -06 (Enter in the real verdict and Level Up DialogV2), -03 (layou
- Audit ref: `stages-05.json` - stage E10
- Clients: two GMs (step 6) and two players · Theme: both for steps 3-5, default for the rest · Priority: grade cap 9 (rule 1); E10 graded 8
- Recipe:
  1. A GM and two players; the second player stays disconnected. Start the Class Trial, open the debate, Send the ballots. Connect the second player: note the seconds until their ballot window opens.
  2. Both vote; the GM presses F5 during the vote: the console shows the same count of ballots returned on reload.
  3. Close and count: the verdict window opens on the accused; focus the select, press Enter: nobody dies; focus the window, press Enter: nobody dies.
  4. Deliver a correct verdict: each player sees one THE VERDICT card; the class Level Up window shows a row per student; set one row to 'I pick', press Enter: each row gets what it says.
  5. A player opens their Level Up from the sheet and clicks the sheet: the window stays above it.
  6. With two full GMs, the primary closes its browser during the vote; a ballot sent meanwhile is recorded when the second becomes primary.
  7. Set one player's system clock a minute off: the debate's seconds differ by at most one from the GM's; the primary's tab in the background during an Objection moves it on once on return; the execution sound plays on every client.
- Settles it: each step as written - E10's promises hold at a table and the grade loses 'provisional'; an execution on Enter, a lost ballot after F5 or a second verdict card is a finding against E10 (major at least)

### L1-357 - LIVE-E11-01 (a reset with four project tokens, a player's canvas), -02 (a player dropping a project actor), -03 (two players walking onto a body: one card, each camera to its token), -04 (the dimmed E
- Audit ref: `stages-05.json` - stage E11
- Clients: two GMs and two players; the owner's world for step 8 · Theme: both for step 4, default for the rest · Priority: grade cap 9 (rule 1); E11 graded 8
- Recipe:
  1. Two full GMs and two players. On the non-primary GM press End the chapter and Body discovered: neither opens a window; each names the primary.
  2. Kill a student in a room (kept death); both players walk their tokens into it at once: one card, one bodiesFound entry (`game.settings.get('danganronpa-rpg','bodiesFound')`), each player's camera pans to their own token; the Eclipse chevron on the HUD is dimmed with its reason; action tiles stay open.
  3. Give the verdict and end the trial: no second body card.
  4. Open End of chapter with no bullet to reveal: the reveal box is unticked and greyed in both themes; the warning names the holders of typeless bullets.
  5. Call an assembly; in Edit campaign move the hour back: nobody is called and the table sees the calling-off card; move into the Class Trial from the window: it asks.
  6. Place four project tokens (two live, a duplicate, an orphan) on two scenes; a player on the scene cannot see the orphan; run the reset with 'each to their own bedroom' where bedrooms span two scenes: no project token remains anywhere, each student stands in their bedroom; no console error on the player.
  7. A player with TOKEN_CREATE drags a project actor onto the map: the primary's next sync removes or reports it.
  8. On a copy of the owner's world from before 1.2.73: first load as primary reports the swept orphans' count; delete a live project's token by hand and reload the scene: it stays gone.
- Settles it: each step as written - E11's promises hold at a table and the grade loses 'provisional'; a second body card, a window on the non-primary, a project token left after the reset or a student not moved is a finding against E11 (major)

### L1-358 - LIVE-E75-01 (a player's countdown from an action refused at a table, the words on both sides, the bucket count), -02 (a second player's console), -03's missing half (the fingerprint's default entry an
- Audit ref: `stages-05.json` - stage E75
- Clients: GM and two players · Theme: default · Priority: grade cap 9 (rule 1); E75 graded 8
- Recipe:
  1. On the sandbox (14.370, Daggerheart 2.12.9), a GM and two players. In the GM's console: `game.drpg.relayGuard()` - record state, fingerprint (expect the eight cases and 'default:EVENT_HANDLERS[data.action]?.(data.data);') and unreviewed (expect []).
  2. Give player one an item or ability whose action starts a countdown; use it. On the GM: the toast 'Refused a Daggerheart change from <player>: new countdowns (<name>). Nothing was changed.'; no new countdown in Daggerheart's list; `game.drpg.relayGuard().refused.countdownsFromAction` grew by 1. On player one: 'This game leaves that change to the GM.'
  3. On player two's console: no Daggerheart error and no new countdown.
  4. The GM uses the same action: the countdown is created.
  5. If the owner wants Daggerheart below 2.10.10 kept allowed: repeat 1 and a Hope roll on that version (state 'ok' with no default entry).
- Settles it: each step as written - E75's promises hold at a table; a countdown created by a player, a missing toast or a non-empty unreviewed list is a finding against E75 (major for a created countdown)

### L1-359 - rooms and floors on a real canvas: a room read on its floor, a floor change charged and refused as a step, the fog of one floor, the Floors buttons, the door controls with token vision off, and a play
- Audit ref: `stages-06.json` - E12
- Clients: GM and two players · Theme: both · Priority: grade cap 9 (E12's floor promise)
- Recipe:
  1. Foundry 14.370, the module at 1.2.118; a scene with two Levels, a room on each, stairs (a level-change region) between them, a room of two pieces on the ground floor.
  2. As GM, mark the rooms in Room Setup's Rooms tab and set token vision off on the scene.
  3. As a player, walk a token up the stairs into the upper room in Daily Life; read the move card's price and the Floors buttons.
  4. Try to change floor into a room the stairs do not link; read the refusal and where the token lands.
  5. Read on the player's screen which door controls are drawn, and whether the two-piece room is outlined whole.
  6. From the player's console try region.setFlag('drpg', 'room', false) on a marked room; read the GM's whisper and the flag after.
- Settles it: settled yes when the stairs cost one crossing, the refused change puts the token back on its floor, the fog and buttons follow the floor, only clear or veiled rooms show door controls and a player's mark write is put back or refused; settled no on any room read on another floor or a door control of a dark room

### L1-360 - the hall on a real table: every browser following the hall in and out, a late browser, the one voice room, a player's hidden write on a hall token, End the trial's carry across scenes
- Audit ref: `stages-06.json` - E13
- Clients: GM and three players · Theme: both · Priority: grade cap 9 (E13's hall promise)
- Recipe:
  1. Foundry 14.370 with LiveKit on a real server; link a school and a hall in Season setup's Scenes part; one student's token on a second scene with rooms.
  2. As GM, Start the Class Trial; read on each player's browser that the hall is shown and the ticked cast stands; reload one player during the activation.
  3. Read who hears whom in the trial (the living, a dead student, the GM).
  4. From a player's console set hidden on a hall cast token; read the put-back and the GMs' whisper.
  5. End the trial, choose a room on the school; read where every living student lands and that the student from the second scene now has a token in the room and none left behind.
  6. Disable Isometric Perspective and reload; read the GM's window and a player's notice.
- Settles it: settled yes when every browser follows both moves, the trial is one room in LiveKit, a player's hidden write is put back, the carry leaves one token per student, and a missing requirement stops the module with the window; settled no on a browser left behind, a split voice room or a student on two scenes unnamed

### L1-361 - the room tile and a GM's Foundry windows on a real v14 table
- Audit ref: `stages-06.json` - E77
- Clients: GM and two players · Theme: both · Priority: grade cap 9 (E77's tile and windows)
- Recipe:
  1. Foundry 14.370, the module at 1.2.118, Stained Glass; a GM and two players; one room with a picture and words in Room Setup's Description tab.
  2. A player walks into the room; read the tile (own room only, picture, words, the chevron); another player's tile stays on their own room.
  3. As GM press the Foundry tools button; read that both windows hold Foundry's sidebar and controls, drag one, reload, read its place.
  4. With a token selected and a context menu open press Escape; read that Foundry's closes first and the windows close only after.
  5. As a player press T, R, F and ping; read the active layer after each.
  6. Turn the world switch off, reload; read Foundry's own sidebar and controls back, no Foundry tools button. Repeat 2-4 under Monokuma Legacy.
- Settles it: settled yes when each tile shows its viewer's room alone, the windows hold Foundry's real nodes and keep their places, Escape is Foundry's first, a player stays on Tokens and the switch restores Foundry's layout; settled no on another's room shown, a lost node, Escape closing the windows over Foundry's own, or a player stuck on another layer

### L1-362 - the notice history and the trial's temporary tokens on a real table
- Audit ref: `stages-06.json` - E81
- Clients: GM and two players · Theme: both · Priority: grade cap 9 (E81's history and DZ6 promises)
- Recipe:
  1. Foundry 14.370, two players and a GM; show a private card, a public card and a messenger preview to a player; press F5 within a second of the last card.
  2. Open the history (the corner button and game.drpg.openNotices()); read the entries, the unread banner and that nothing plays or is sent.
  3. Delete one of the module's cards from the chat log as GM; read the player's entry marked deleted.
  4. Log a second account into the same browser; read that each sees its own section.
  5. Link a hall with no tokens, tick two students and Monokuma, Start the Class Trial; read the made tokens, the whisper naming Monokuma, the hall's trialSeats flag.
  6. End the trial; read that only the made tokens are deleted and their places kept on the flag.
- Settles it: settled yes when the kept entries survive F5, the window draws nothing again, a deletion marks the entry, two accounts keep two sections, the made tokens are created and deleted and the record merges; settled no on a lost entry, a card replayed, a GM token deleted or a record overwritten

### L1-363 - the cause of the open-Frisk tier-2 failures on 14.370
- Audit ref: `stages-07.json` - not_established
- Clients: the sandbox's GM page and three player pages · Theme: both · Priority: E80's grade (7, cap 9)
- Recipe:
  1. On the sandbox, clear the GM stores' incident cast (the paper's round 0 step).
  2. Run tier 2 with --only 'an open Frisk' from the GM's console in each theme.
  3. For each failure record the assertion and the ask row's state (asking, asked) on the primary.
- Settles it: green after the cast is cleared - the tests' world, no finding; red with the ask never reaching its target on v14 - a finding against E80's open Frisk (major)

### L1-364 - the hidden dock's sound and display on v14
- Audit ref: `stages-07.json` - not_established
- Clients: one GM and two players · Theme: both · Priority: E78's grade cap 9
- Recipe:
  1. Voice tile on, a LiveKit room with two players.
  2. One player presses F5; the other speaks.
  3. Inspect #camera-views: computed display none, the audio elements present, the speech heard.
- Settles it: heard and hidden - E78 holds; silence or a visible dock - a finding against E78 (major)

### L1-365 - LIVE-E78-10 (T1) with -01 and -02: who the tile shows speaking, the hidden dock's sound after F5, the microphone's states and a GM's block, on a real LiveKit server
- Audit ref: `stages-07.json` - stage E78
- Clients: one GM and two players, separate browsers · Theme: both · Priority: grade cap 9 (rule 1); E78 graded 8
- Recipe:
  1. A world with avclient-livekit and a LiveKit server, A/V mode audio only, the voice tile on; a GM and two players in separate browser profiles.
  2. Put the two players in two rooms with voice: each speaks; each tile shows only the speaker of its own room, after the first word with no wait, and the speaker's number counts the room's participants.
  3. Press F5 on one player's browser: the camera dock is not seen, and the other people in its room are still heard.
  4. On the player's tile: mute, unmute, push to talk with a bound key; the others hear exactly that. In an Eclipse the button is grey with its reason.
  5. The GM opens 'Who you hear' and blocks a player's microphone: the lock shows on that player's tile and nobody hears them; for a death the GMs keep, the block is disabled with its reason.
  6. Turn the voice tile off in the module's settings: the dock comes back on every screen with no reload.
- Settles it: each step as written - the main promise holds at a table and the grade loses 'provisional'; a speaker from another room on the tile, silence after F5 or a block that does not silence is a finding against E78 (major)

### L1-366 - LIVE-E79-01 (a known passage in a real drag, ruler, keyboard and a move from code; a stranger stopped), -02 (the audit in 'log' with a GM on another scene and floors: no row for a lawful move), -08 (a
- Audit ref: `stages-07.json` - stage E79
- Clients: one GM and two players; step 5 with voice on a LiveKit server · Theme: default · Priority: grade cap 9 (rule 1); E79 graded 8
- Recipe:
  1. Foundry v14 sandbox (never the table's port); a scene with two rooms and a passage given to Aiko; moveAudit on 'log'.
  2. Aiko's player drags through the gap, then uses the ruler and the keyboard, then a console token.update across it: each passes and is charged once; a second player whose student does not know it is stopped at the wall by each road.
  3. With the GM on another scene and a two-floor scene in the world, make ten lawful moves: game.drpg.passages.audit() holds no row and dropped is 0.
  4. The GM drags Monokuma through the gap and beside it: through the gap it passes, beside it it stops (or note that v14 does not stop a GM at all).
  5. In a Class Trial on a real LiveKit room, one player speaks, another presses OBJECTION!: note the milliseconds until the button names the speaker and that the primary GM aims it there; a cough under a second names nobody.
- Settles it: each step as written - the main promise holds at a table and the grade loses 'provisional'; a stranger through the wall, an audit row for a lawful move, or an Objection at someone else than the speaker is a finding against E79 (major)

### L1-367 - LIVE-E80-05 (an open Frisk between two players' browsers: allow, refuse, silence, a force at the last second, a GM who drops and returns) and LIVE-E80-01 (Go through and stairs on a real canvas with a
- Audit ref: `stages-07.json` - stage E80
- Clients: one GM and two players · Theme: both for step 2's windows, default for the rest · Priority: grade cap 9 (rule 1); E80 graded 7
- Recipe:
  1. Foundry v14 (The Forge if possible): one GM and two players in separate browsers; Aiko and Botan in one room.
  2. Aiko's player Frisks Botan openly: Botan's player allows once (Aiko sees the list as at the ask), refuses once (Aiko is asked 'Make them?' and forces within 30 s at Body 12; the room reads it), and does not answer for a minute once.
  3. Press 'Make them' in the last second of the 30; then repeat with the GM's browser dropped and back without a reload during the ask: note the card each side reads and whether the action is spent or handed back.
  4. Run the tier-2 tests 'an open Frisk's ask is judged on the primary GM ...', 'an open Frisk's action comes back only where its card says so ...' and 'an open Frisk's ask keeps its clocks ...' from the GM's console on the sandbox and record each failing assertion's text.
  5. Give Aiko a tunnel to a room upstairs; she presses Go through: her token lands on the far end on the other floor at a door's price, Botan in either room sees her leave and arrive.
- Settles it: each step as written and the three tests green, or failing on a stand-in the harness has and v14 lacks - the Frisk's main promise holds; an ask that never reaches the target, a force refused in its window, or an action spent and not handed back where the card says it is, is a finding against E80 (major)

### L1-368 - LIVE-E84-01 (a player's action and statistic reach the GM, in Firefox and Chromium) and LIVE-E78-14 (the first mouse drag into a new room counts)
- Audit ref: `stages-07.json` - stage E84
- Clients: one GM and two players (Firefox and Chromium) · Theme: default · Priority: grade cap 9 (rule 1); E84 graded 8
- Recipe:
  1. Foundry v14 with a GM connected and one player in Firefox, one in Chromium (on The Forge if the table runs there).
  2. Each player runs Search from the action grid and clicks a statistic on the sheet: the action goes through, the GM's browser draws the roll, the card is in the chat, and the player's console has no 'Could not send ... to the GM'.
  3. The GM, with the module's debug on, drags Monokuma by mouse from one room into another in one move: the room tile names the new room, the fog shows its arrival, and no second drag is needed.
  4. A player drags their character into a new room with an action to pay: the tile names it, one action is charged once; note whether the GM's console says 'read again at rest'.
- Settles it: each step as written - both fixes hold at a table; a refused request, a second drag needed or a double charge is a finding against E84 (major)

### L1-369 - The dice's start on a player's and the GM's screen, and voice after a move
- Audit ref: `stages-08.json` - not_established
- Clients: one GM, one player · Theme: default · Priority: the grade cap 9
- Recipe:
  1. At The Forge, GM and one player, Dice So Nice on, One dice look for the table on
  2. The player makes 10 action rolls and 10 statistics from the sheet; read game.drpg.perf()'s asked-to-dice-started and asked-to-dice-shown medians on the player's page
  3. On the GM's screen note whether each roll is thrown once and when
  4. Verbose logging on; the player moves into another room 10 times; read the Debug line's connect ms and time letting go to Connecting
- Settles it: agrees: dice start before the answer, once a roll, voice joins within the connect's time; defect: two throws, a start after the answer, or a wait over 1.5 s

### L1-370 - A dropped connection, a death, and an Eclipse on avclient-livekit
- Audit ref: `stages-08.json` - not_established
- Clients: one GM, two players · Theme: default · Priority: the grade cap 9
- Recipe:
  1. Two players and a GM in regional voice
  2. Cut player A's network for 10 s; read the cards, the rejoin times and whether LiveKit's toast shows
  3. Kill A's character in secret in an incident; close the incident; read who hears A and where A's tile says A is
  4. Start an Eclipse; read every player's voice state and the GMs' room; end it and read everybody's room without a reload
- Settles it: agrees: one card and rejoin at about 1, 5 and 15 s; the dead heard by nobody living; no player in voice in the Eclipse; defect: any living player hears the dead, a player stays connected in the Eclipse, or no rejoin

### L1-371 - A player's move into a locked room put back by the primary GM, on 14.370, and the GM copy's position at the moment of the write
- Audit ref: `stages-10.json` - not_established
- Clients: one GM, one player, a second player watching · Theme: default · Priority: E17's grade cap (major if it does not land)
- Recipe:
  1. One GM (primary), one player; a scene with two rooms joined by a door, the second locked (the player holds no key)
  2. The player drags their token through the door into the locked room
  3. Read on the player's and the GM's browser where the token stands 1 s and 5 s after; read the GMs' whisper
  4. Repeat by the console: canvas.tokens.controlled[0].document.update({x, y}) into the locked room
  5. With Verbose console logging on, record the put-back's log line and the token's x, y on the server (a third browser's copy)
- Settles it: agrees: the token stands back on every browser within a second, the player told the rule; defect: it stays in the locked room on any browser, or only the GM's copy moves

### L1-372 - The table's dice look on 1.2.118 across several players
- Audit ref: `stages-10.json` - not_established
- Clients: one GM, two players · Theme: both · Priority: E16's grade cap
- Recipe:
  1. One GM (full Gamemaster) and two players with Dice So Nice; 'One dice look for the table' on
  2. Each player runs game.drpg.diagnoseDiceLook() and sends the text
  3. Each player throws an action roll and a statistic from the sheet; the GM throws one
  4. Screenshot the dice on each screen in the same throw
  5. A player changes their own look in Dice So Nice's window; throw again
- Settles it: agrees: every screen draws the GM's look and the change goes back, with the once-a-session line; defect: any screen differs

### L1-373 - fps() before and after the E88 train, and the refreshes one step costs another browser on v14
- Audit ref: `stages-10.json` - not_established
- Clients: one GM, at least two players · Theme: both · Priority: E88's grade cap
- Recipe:
  1. On the GM's machine and the weakest player's, both themes, everyone standing, one player alone in a fogged room
  2. Run await game.drpg.fps({ toChat: false }) on 1.2.88 (before) and on 1.2.118 (after); keep both outputs
  3. Run game.drpg.counters({ reset: true }), have another player take one step, then game.drpg.counters(): read the refresh counts
  4. Repeat with a drag across three squares
- Settles it: agrees: frames faster or equal after, one refresh per step on the other browsers; defect: slower, or many refreshes per step

### L1-374 - The trial's microphone block and its give-back on a real server: a dead player's microphone stops without a reload, and after the trial the player's own permissions read as before (no BROADCAST_AUDIO 
- Audit ref: `stages-11.json` - not_established
- Clients: one GM, three players · Theme: default · Priority: the stage's grade cap (9), major if the give-back leaves the key
- Recipe:
  1. On the sandbox with LiveKit 0.6.8, a GM and three players, a player with no BROADCAST_AUDIO of their own (read game.users.getName(p).toObject().permissions)
  2. Kill that player's student with nobody told, enter a Class Trial through the module's road
  3. Read the player's permissions on the GM and the player's page: BROADCAST_AUDIO false; on the player's page try game.user.update({ 'permissions.BROADCAST_AUDIO': true }) (LIVE-E70-05)
  4. End the trial by End the trial, then read the player's toObject().permissions again on both pages
  5. Run tier 2 E70-T8 by name on the sandbox (run-tests --only "the dead are muted for the trial")
- Settles it: {'agrees': "the block reads false in the trial, the player's own write is refused, and after the exit the permissions object has no BROADCAST_AUDIO key; E70-T8 passes", 'defect': "after the exit BROADCAST_AUDIO is still false (the ForcedDeletion did not remove it) - the player stays unable to speak until a GM lifts it by hand; or the player's own write lands"}

### L1-375 - A dragged token's cost on the mover's and a watcher's browser, and the GM Panel's tile edges under Stained Glass on a real graphics card
- Audit ref: `stages-11.json` - not_established
- Clients: one GM, two players · Theme: both · Priority: the stage's grade cap (9); the edges minor
- Recipe:
  1. On the sandbox (default theme, then Stained Glass), a player drags their own token through a room and into the next for 5 s
  2. During the drag run await game.drpg.fps({ seconds: 5, toChat: false }) on the mover's page, a watcher's page and the GM's
  3. Record visibility.applyAll.tokens, visibility.applyRooms.tokens, visibility.sightPass and refreshToken counts from game.drpg.counters() before and after
  4. Hooks.on('updateToken') counter on the mover's page across one drag with two waypoints (LIVE-E89-03)
  5. Open the GM Panel under Stained Glass on a headed browser with a GPU while a token moves; screenshot the tile and Close button edges at 100% and 125% zoom (LIVE-E89-04)
- Settles it: {'agrees': "an own move inside a room counts one token's refresh on the mover; the frame rate within the table's other readings; no edge vanishes", 'defect': 'a whole pass on every frame of a drag, or edges still cut on the Projects tile or Close button'}

### L1-376 - The contract's rows and the report on Foundry 14.370 with the Daggerheart in use
- Audit ref: `stages-11.json` - not_established
- Clients: one GM, one player · Theme: both · Priority: the stage's grade cap (9)
- Recipe:
  1. On the sandbox, fresh load, as the primary GM: note any contract notice; run game.drpg.diagnosePatches() and record each row's state
  2. Open the first character sheet, then a scene with floors; record any later notice
  3. Run game.drpg.diagnose() as GM and as a player; press Copy report and paste into a text field; read that the player's report names the eight GM-only parts and holds none of their data
  4. Open the Debug log's Foundry and modules window in English and Polish, both themes
- Settles it: {'agrees': "no failed row, the unknown rows only those the register says a table reads, a notice only for a failed row, the player's report with no GM data", 'defect': "a row failed on 14.370 or the Daggerheart in use, a notice for an unknown row, or GM data in the player's report"}

### L1-377 - Season setup, the further checks and Check rooms on a real screen and server, and Give back Foundry's settings in the real settings window
- Audit ref: `stages-11.json` - stage E20
- Clients: one GM, one player · Theme: both · Priority: the stage's grade cap (9)
- Recipe:
  1. On the sandbox at 1366x768 and 1920x1080, both themes, English then Polish, open Set the season up on a fresh world: focus on the campaign name, a row's Open in front, a round trip back where it was (B-E20-1)
  2. Add three room pictures (one over 8 MiB, one missing) and read the further checks' picture lines with timings (B-E20-4)
  3. On a scene with a room off its wall and two overlapping rooms on two floors press Show on map for each finding (B-E20-5)
  4. As GM and as a player open Configure Settings: the Give back button for the GM only; Give them back, then read the two Daggerheart automations and the file permissions (B-E20-6)
  5. Disable Dice So Nice, reload as GM and player: the requirements window's words, no module stylesheet in document.styleSheets (B-E20-2)
- Settles it: {'agrees': "every window inside the viewport, Show on map pans to the finding's floor, the picture lines match the files, Give back restores what was kept", 'defect': 'a window past the viewport, a wrong floor, a picture called missing that loads, or a setting not given back'}

### L1-378 - The contract's rows and the report on Foundry 14.370 with the Daggerheart in use
- Audit ref: `stages-11.json` - stage E52
- Clients: one GM, one player · Theme: both · Priority: the stage's grade cap (9)
- Recipe:
  1. On the sandbox, fresh load, as the primary GM: note any contract notice; run game.drpg.diagnosePatches() and record each row's state
  2. Open the first character sheet, then a scene with floors; record any later notice
  3. Run game.drpg.diagnose() as GM and as a player; press Copy report and paste into a text field; read that the player's report names the eight GM-only parts and holds none of their data
  4. Open the Debug log's Foundry and modules window in English and Polish, both themes
- Settles it: {'agrees': "no failed row, the unknown rows only those the register says a table reads, a notice only for a failed row, the player's report with no GM data", 'defect': "a row failed on 14.370 or the Daggerheart in use, a notice for an unknown row, or GM data in the player's report"}

### L1-379 - The trial's microphone block and its give-back on a real server: a dead player's microphone stops without a reload, and after the trial the player's own permissions read as before (no BROADCAST_AUDIO 
- Audit ref: `stages-11.json` - stage E70
- Clients: one GM, three players · Theme: default · Priority: the stage's grade cap (9), major if the give-back leaves the key
- Recipe:
  1. On the sandbox with LiveKit 0.6.8, a GM and three players, a player with no BROADCAST_AUDIO of their own (read game.users.getName(p).toObject().permissions)
  2. Kill that player's student with nobody told, enter a Class Trial through the module's road
  3. Read the player's permissions on the GM and the player's page: BROADCAST_AUDIO false; on the player's page try game.user.update({ 'permissions.BROADCAST_AUDIO': true }) (LIVE-E70-05)
  4. End the trial by End the trial, then read the player's toObject().permissions again on both pages
  5. Run tier 2 E70-T8 by name on the sandbox (run-tests --only "the dead are muted for the trial")
- Settles it: {'agrees': "the block reads false in the trial, the player's own write is refused, and after the exit the permissions object has no BROADCAST_AUDIO key; E70-T8 passes", 'defect': "after the exit BROADCAST_AUDIO is still false (the ForcedDeletion did not remove it) - the player stays unable to speak until a GM lifts it by hand; or the player's own write lands"}

### L1-380 - A dragged token's cost on the mover's and a watcher's browser, and the GM Panel's tile edges under Stained Glass on a real graphics card
- Audit ref: `stages-11.json` - stage E89
- Clients: one GM, two players · Theme: both · Priority: the stage's grade cap (9); the edges minor
- Recipe:
  1. On the sandbox (default theme, then Stained Glass), a player drags their own token through a room and into the next for 5 s
  2. During the drag run await game.drpg.fps({ seconds: 5, toChat: false }) on the mover's page, a watcher's page and the GM's
  3. Record visibility.applyAll.tokens, visibility.applyRooms.tokens, visibility.sightPass and refreshToken counts from game.drpg.counters() before and after
  4. Hooks.on('updateToken') counter on the mover's page across one drag with two waypoints (LIVE-E89-03)
  5. Open the GM Panel under Stained Glass on a headed browser with a GPU while a token moves; screenshot the tile and Close button edges at 100% and 125% zoom (LIVE-E89-04)
- Settles it: {'agrees': "an own move inside a room counts one token's refresh on the mover; the frame rate within the table's other readings; no edge vanishes", 'defect': 'a whole pass on every frame of a drag, or edges still cut on the Projects tile or Close button'}

### L1-381 - The records, the rings and the clocks on The Forge after a real server restart, on 1.2.118
- Audit ref: `stages-12.json` - not_established
- Clients: the primary GM and one player · Theme: default · Priority: E90's grade cap (major if a row is dropped)
- Recipe:
  1. On the owner's Forge world, as the primary GM, read in the console game.time.serverTime, Date.now() and game.drpg.gmStoreStatus().perStore; write the three down
  2. Place a new trace (Search or New trace): remnants live grows by one, a double click opens the Remnant card, the token wears its type's ring without the map being moved
  3. Stop the world on The Forge and start it again; reload; read the three values again and place one more trace: its row stays and its ring shows
  4. Read the HUD's minutes line (no millions of minutes) and open a debate on the trial floor: its whole time runs
  5. With a player connected, read Date.now() on both machines and note the difference
- Settles it: agrees: serverTime reads as an uptime under 1e12 and every new row stands after the restart, rings drawn, HUD and floor sane; defect: a row dropped after the restart, a trace opening Daggerheart's sheet, or a minutes line in the millions

### L1-382 - Whether v14 sets ui.activeWindow to the messenger window on open and on a click in it, clears it for another window or the canvas, and whether a hidden tab's message is read on return
- Audit ref: `stages-12.json` - not_established
- Clients: one GM, one player · Theme: both · Priority: E50's grade cap
- Recipe:
  1. A GM and one player; the GM opens the player's thread (messenger window)
  2. In the console: ui.activeWindow === Object.values(foundry.applications.instances).find(a => a.id?.startsWith('drpg-messenger')) after open, after a click inside it, after a click on the canvas, after a click on another window
  3. With the GM's window behind another window, the player sends a message: the GM's card shows and the badge stays unread until the window is clicked
  4. The GM switches to another browser tab; the player sends; the GM comes back with the window in front: the message reads as read
- Settles it: agrees: ui.activeWindow follows the clicks as the harness models it and the read marks follow; defect: the thread is marked read while covered, or never marked read while in front

### L1-383 - The doorway light after E51's fix, the Projects window's one select and the Call windows' colours drawn, and the doubled character token's origin
- Audit ref: `stages-12.json` - not_established
- Clients: one GM, two players · Theme: both · Priority: E51's grade cap (minor each)
- Recipe:
  1. On a scene with a straight and a staircase room border, open and closed doors, both themes, two times of day: walk a character to a doorway and screenshot the light; it stops at the first wall and does not show through the next room's walls
  2. Open the Projects window as a player, pick Work then Sabotage: one select shows for the picked row, in both themes; screenshot
  3. Open a Hope Call and a Despair Call window: gold and blood-red headers; screenshot
  4. On the owner's world start an investigation and, if a character's token doubles, read both tokens' _stats.createdBy and the order of createToken hooks in the console
- Settles it: agrees: each drawn as the cascade says and the light stops at walls; defect: light through a wall, both selects drawn, or a header in the wrong colour; for the token, the createdBy names the code road that made the second

### L1-384 - Whether every renamed action, option and Call name fits its tile or button, not cut and not broken mid-word (LIVE-E66-01)
- Audit ref: `stages-13.json` - not_established
- Clients: one player (and the GM to open an incident for the Crisis Actions) · Theme: both · Priority: E66's grade cap (nit-to-minor if a name breaks)
- Recipe:
  1. On a v14 world with the module on 1.2.118, open a student's character sheet as its player, Actions tab
  2. At browser window sizes 1366x768, 1024x768 and 820x1180, in Stained Glass and in Monokuma Legacy, with the module's Language on English and then on Polski (reload after each change)
  3. At each of the 12 sets read the action grid, Crisis Actions, the Tamper, clean-up, Indirect Murder and Rest windows: every name inside its tile or button, whole
  4. Note any name cut, overflowing or broken inside a word, with the size, theme and language
- Settles it: agrees: every name whole in all 12 sets; defect: any name cut or broken mid-word in any set

### L1-385 - The character sheet's root carries lang="pl" on a Polish page over an English Foundry, and which words stay English (LIVE-E66-02)
- Audit ref: `stages-13.json` - not_established
- Clients: one GM or one player · Theme: default · Priority: E66's grade cap
- Recipe:
  1. Foundry's language English; the module's Language setting Polski; reload the page
  2. Open a student's character sheet; in the browser's tools read the sheet root's lang attribute
  3. List the words on the sheet that stay in English and, for each, whether it stands in a block the module draws
- Settles it: agrees: the root reads lang="pl" and every English word is Daggerheart's own; defect: no lang or lang="en" on the root, or an English word in a block the module draws

### L1-386 - The readiness round at a real table: one window per player of the cast, the GM's list, a reload mid-round, an away player (LIVE-E37-02, with LIVE-E37-06's bystander)
- Audit ref: `stages-13.json` - not_established
- Clients: one GM, three players (one away, one reloading, one a bystander for the incident step) · Theme: both · Priority: E37's grade cap (major if the clock moves twice or a player is never asked)
- Recipe:
  1. A GM and three players, each owning a living student; one of them closes their tab before the round
  2. In Daily Life the GM presses Next time of day on the GM panel: each connected player gets one window with Done and One moment, the GM's window lists all three, the away one as Not connected - counts as Done
  3. One player answers One moment, then reloads the page mid-round: after the reload the window comes back with Done alone
  4. All connected players press Done: the GM's window goes on by itself, the clock moves once, every player sees one summary card of the time of day that ended
  5. Repeat with the HUD's chevron to start an Eclipse (E17's question first, Not yet the default) and with its end
  6. With an incident open (before Stage 6), a bystander's player reads no readiness window and no summary when the GM moves the clock
  7. Time each round from the press to the clock's move
- Settles it: agrees: one window per asked player, the GM's list as described, the reload asked again, the clock moved once, no summary on the bystander; defect: a second window, a missed player, a clock moved twice or not at all, or a summary on the bystander

### L1-387 - Scenario 81-render-budget on a real v14 with the module's real character sheets (LIVE-E37-01)
- Audit ref: `stages-13.json` - not_established
- Clients: the sandbox's GM and three players (the scenario's own) · Theme: both · Priority: E37's grade cap
- Recipe:
  1. On the local gate's v14 sandbox at :30099, run npm run gate:local (audit/gate/README.md), which runs the scenarios whose layers include local-gate, 81 among them
  2. Read 81's results file: the visibility passes, sheets drawn and tokens shown after each event, in both themes; note A must name real sheets, not stand-ins
- Settles it: agrees: 81 green with real sheets in both themes; defect: a red check, or a Despair write that draws a student's sheet

### L1-388 - Daggerheart's own countdown writes inside the projects' queue, and the tray's Reveal, Hide, Delete and -/+ on a non-project row (LIVE-E37-03)
- Audit ref: `stages-13.json` - not_established
- Clients: one GM · Theme: default · Priority: E37's grade cap (minor if the +1 is lost)
- Recipe:
  1. v14 with Daggerheart 2.12.9 (module.json's verified), countdownAutomation on, one project and one countdown that is not a project
  2. As GM, start a project's +1 and while it is in flight make a GM roll that moves the countdowns (DhCountdowns.updateCountdowns)
  3. Read the project's progress after both: the +1 stands
  4. On the non-project row press Reveal, Hide and Delete, and -/+ during a project's change; read diagnosePatches() for the row countdown-update
- Settles it: agrees: the project's +1 stands after the system's write, countdown-update reads ok; defect: the +1 lost, or the tray's Delete holds every project's change

### L1-389 - An Eclipse packet that reaches a player before its clock setting runs nothing, and one visibility pass runs once the setting lands (LIVE-E37-05)
- Audit ref: `stages-13.json` - not_established
- Clients: one GM, one player · Theme: default · Priority: E37's grade cap
- Recipe:
  1. A GM and a player on a real server (the sandbox is localhost; a remote host is better)
  2. On the player's console: let n = 0; Hooks.on('drpgEclipse', () => n++) and read game.drpg.counters() before
  3. The GM ends an Eclipse that moves the time of day
  4. On the player read game.drpg.counters() again: visibility passes up by one for the move, the Eclipse's hook once
- Settles it: agrees: one pass and one hook on the player whatever the order; defect: none (tokens stale until the next move) or two

### L1-390 - The windows E41 moved, each opened once at a table, both verdict windows as C10b drew them, and the load time with today's 258 module files (LIVE-E41-02, LIVE-E41-01)
- Audit ref: `stages-13.json` - not_established
- Clients: one GM, one player · Theme: both · Priority: E41's grade cap
- Recipe:
  1. Clear the browser cache; open the world as GM and time from the open to the module's ready and to the HUD's first draw; read game.drpg.perf() and the network panel's count of module files
  2. Do the same as a player
  3. As GM, in both languages, open once: Room Setup (with Tajne przejścia / Passages), the stash inspector, Item Tables (with Install), the Students window, Edit campaign, the Sound window (Music, Play, Effects tabs)
  4. In a Class Trial with s2 accused, s3 a known Blackened and s4 dead: the ordinary verdict's select lists s3 choosable and s4 marked and disabled, and opens on s2
  5. In a Final Trial over the same count: Nobody named first, every student choosable, opening on s2
- Settles it: agrees: every window opens and works as on 1.2.96, both lists as described, a load time written down; defect: a window that throws or draws empty, or a list that leaves a student out

### L1-391 - A verdict's Level Up window and an End of chapter with the GM's tab closed mid-procedure and reopened: the stopped line, Finish, each Level Up and clock move once (LIVE-E42-02)
- Audit ref: `stages-13.json` - not_established
- Clients: one GM, three players · Theme: default · Priority: E42's grade cap (major if a Level Up or a chapter move doubles)
- Recipe:
  1. A GM and three players whose students survived a Class Trial
  2. The GM gives an ordinary verdict; when the class's Level Up window opens, close the GM's tab and reopen the world
  3. Read the trial console's 'The verdict stopped at' line; press Finish the verdict; read each survivor's Level Ups (one each) and a waited Reinforced once
  4. Press End the chapter, Do it; close the GM's tab during the steps; reopen
  5. Read the GM panel's Next line and press End the chapter: Finish the chapter's end, Drop the rest, Cancel (the default); press Finish
  6. Read the clock: one chapter, one session and one morning on, once
- Settles it: agrees: each stop named, Finish gives each Level Up and each clock move exactly once; defect: a Level Up given twice or lost, a clock moved twice, or no Finish offered

### L1-392 - The dice promises of E60 on a real table: a player's 3D dice on a GM's screen only with that GM's Monokuma in the roller's room, the roll window whole, and the dice look check run on each browser
- Audit ref: `stages-14.json` - not_established
- Clients: two GMs and two players · Theme: both · Priority: E60's grade cap (9); LIVE-E60-05, -08, -09 (items 372, 374, 376); the per-item recipes are in live-items-361.json
- Recipe:
  1. Every GM and player switches Dice So Nice's 'Show only mine' off (the 1.2.98 notes, Before installing 2).
  2. With Force private player rolls on, put the GM's Monokuma token in the player's character's room; the player clicks an action (Observe) and then a statistic on the sheet: note whether the dice fall on the GM's screen and whether the GM reads the card.
  3. Move the Monokuma to another room and repeat: the dice must not fall on the GM's screen, the card is still read, headed with the roller.
  4. On the player's screen, in both themes at 1366x768, the roll window opens whole (dice, experiences, modifiers, formula, mode select) and the mode select's tooltip says who sees the roll.
  5. Each person runs game.drpg.diagnoseDiceLook({ test: true }) on their own browser; the GM also opens Season setup, Pre-season checks, Dice look, and presses Open the dice look.
  6. With a second full Gamemaster connected, repeat 2 with that GM's Monokuma and with no pool set (no GM sees the dice).
- Settles it: agrees: the dice fall on a GM's screen exactly while that GM's Monokuma stands in the room, the window is whole and the diagnostic names each browser's own settings; defect: dice on a GM's screen with the Monokuma out of the room or none in it, a collapsed window, or a diagnostic that reads another browser

### L1-393 - The kit's windows on v14: folding, Escape and Enter, the notice history at the screen's height, the stepper and tabs under Monokuma Legacy, and why a GM's project tokens draw white
- Audit ref: `stages-14.json` - not_established
- Clients: one GM and one player · Theme: both · Priority: E44's grade cap (9); LIVE-E44-03, -05, -07, -08, -09 (items 379, 381, 383, 385, 386); recipes in live-items-361.json
- Recipe:
  1. As GM and as player, each theme: double-click the title bar of Despair Flow, Item tables, the character sheet and another module's window; each folds and unfolds; a short question window does not fold.
  2. Fold the messenger with an unread message; it is not marked read until unfolded; press its launcher: it unfolds and comes to the front.
  3. Open the notice history with more than 150 entries at 1366x768 and 1920x1080: only the list scrolls, Clear left, Close right, the foot in view.
  4. Under Monokuma Legacy open Edit campaign and Despair Flow's Overflow: the stepper's - and + step inside the range; the tabs stand on one line.
  5. In Room setup and in the Remnant delete question press Escape (closes, nothing written) and Enter (the default only).
  6. On the GM with a project in a room, run the console line of LIVE-E44-07 (Isometric's occlusion setting, the AlwaysVisibleContainer clone count, each project token's tint and alpha) and hide AlwaysVisibleContainer.
- Settles it: agrees: every window folds and unfolds as listed, Escape and Enter do what the harness models, the history fits, and the white tokens are traced to a clone outside the module; defect: a window that does not fold, a folded window a tile leaves folded, a history taller than the screen, or white project tokens drawn by a module road

### L1-394 - Every module window on the kit's frame fitting a real v14 screen, and the on-screen keyboard on a real tablet and phone
- Audit ref: `stages-14.json` - not_established
- Clients: one GM and one player, plus a tablet and a phone · Theme: both · Priority: E21's grade cap (9); LIVE-E21-01 to -09 (items 387-389, 392, 393, 398-401); recipes in live-items-361.json and live-items-395.json
- Recipe:
  1. At 1366x768, 1280x800, 1024x768 and 1920x1080, each theme, as GM: open each GM window and press each of its tabs; the footer and its buttons stay in view and the window's top stays on the screen after a tab press.
  2. As player: open each action window (Observe, Search, Analyze, Tamper, Rest, Projects, Palm); Observe does not scroll at 1366x768 and up; the briefing shows the picked row's thresholds.
  3. On the character sheet the safeword's Stop stays in view at the bottom-left; the sheet folds on a double-click of its bar.
  4. In the console as GM run the LIVE-E21-06 line (a drpgWindow with a footer button whose action is close) and note what it answers.
  5. On a real tablet and a phone, focus a text field (the notice history's search, a request field): the layout does not switch to the short layout and the curtain is not cut again; read navigator.virtualKeyboard.overlaysContent.
  6. During a real chapter, open the windows the fit sweep cannot reach (the case's, the trial's, Palm, the incident tracker) at 1366x768 and 390x844.
- Settles it: agrees: every footer in view at each size, Observe still, the Stop visible, the keyboard switching nothing; defect: a footer off the screen, a window whose top leaves the screen after a tab press, or a layout that re-cuts under a keyboard

### L1-395 - The buttons' language at a v14 table: Enter in each irreversible GM window presses Cancel, red stands only on the GM's road and on destructive answers, and the safeword's Stop it is the default
- Audit ref: `stages-14.json` - not_established
- Clients: one GM and one player · Theme: both · Priority: E22's grade cap (9); LIVE-E22-01 to -06 (items 390, 391, 394-397); recipes in live-items-361.json and live-items-395.json
- Recipe:
  1. As GM, each theme: open Who died?, the body's announcement, the chapter's end, End the trial, Delete a project, Reset the season (type RESET), the vote's Close and count; press Enter in each: nothing irreversible happens.
  2. In Share, Enter shares; Revoke access is not the default.
  3. As player below 1224 px: open the Tamper menu (Reshape a Trace), Direct Murder's declaration and Analyze; the red rows and buttons are the ones that go to the GM and their sentence says so.
  4. Hover Cancel, the default, a red row and a plain row in Analyze and Tamper under each theme; note the hover face and the focus ring.
  5. Open Safeword from the sheet, the keybinding and game.drpg.safeword() as player and by the keybinding as GM: Stop it is red, the default and first; Enter presses it; the GMs' card names the player's room.
- Settles it: agrees: no Enter commits an irreversible answer, red marks only the GM's road and destructive answers, Stop it is the default on every road; defect: an Enter that kills, announces, ends or deletes, or a red button that does not go to the GM

### L1-396 - E23's curtain and HUD at a real table
- Audit ref: `stages-15.json` - not_established
- Clients: one GM and two players · Theme: both · Priority: E23's grade cap (9); AUDIT items 402-413
- Recipe:
  1. Under Stained Glass at 1366x768 and 1920x1080, as GM and as a player: await game.drpg.fps({ toChat: false }) at rest, then again while changing the phase (Daily Life -> Investigation) and the time of day; write the frame count, the middle frame and the frames over 50 ms of both.
  2. Watch the turn: panes moving with their texture, colour from the centre in about 1.2 s, the seam flash, no board showing through; game.drpg.perf() before and after ten turns.
  3. With music following the game: document.getElementById('drpg-hud').offsetHeight at silence, after a playlist starts, a track change and a stop, on the GM's and a player's own browser.
  4. Pause the game: every client's clock reads On hold / Wstrzymano, the height unchanged; a player loads the world paused.
  5. ui.notifications.warn('test') and .error('test'): run the console line of AUDIT item 409 and write its four fields; the right column and the voice tile where they belong.
  6. At 1024x768: the board visible and playable under the stack; the GM's #players one line at the foot, a player's none.
  7. Turn on the operating system's reduced motion: nothing of the module moves in a loop, a phase change ends at once.
- Settles it: agrees: the turn's middle frame at most 2 ms over rest, nothing seen jumping, the height constant, the toasts on their plate under the Despair pools with core's position, the board playable; defect: any of those not so, with a screenshot

### L1-397 - E24's reserve, Sanity's privacy and the roll card on v14
- Audit ref: `stages-15.json` - not_established
- Clients: one GM and two players (one with Observer only on the other's student) · Theme: both · Priority: E24's grade cap (9); AUDIT items 414-423, 428-430
- Recipe:
  1. Two players A and B, each owning one student, and a GM; open B's student's sheet and token on A's page.
  2. The GM hits B's student: on B's sheet the bar shortens and reads 3 / 4; B's token bars say the same; A reads Health and a ? for Sanity on the sheet and no Sanity bar on the token; the token HUD's two inputs are off for A, B and the GM.
  3. Open Daggerheart's Party sheet on A, B and the GM: the rows are the reserve, Sanity only for its owner and the GM.
  4. Open a direct murder of A's student on B's: the victim reads both reserves on the card and the Event panel, the killer Health alone, a bystander nothing.
  5. Put B's student in Breakdown and have B make a public roll: on A's and an Observer's page the card shows Disadvantage and nowhere the word Breakdown (text, tooltip, class).
  6. GM: change Daggerheart's Automation death icon, kill a student: the new marker wears the GM's icon on both pages without a reload.
- Settles it: agrees: every reader as listed; defect: a Sanity number or bar on A's page, a bar that disagrees with the sheet, an editable HUD input, the word Breakdown on another's card

### L1-398 - E45's render plan on v14
- Audit ref: `stages-15.json` - not_established
- Clients: two GMs and two players · Theme: default · Priority: E45's grade cap (9); AUDIT items 424-427; E45-1 minor
- Recipe:
  1. A GM and two players, the same student's sheet open on all three; Lock player resources off.
  2. In each page's console wrap that sheet's render to log its arguments (const s = game.actors.getName('<name>').sheet; const r = s.render; s.render = function (...a) { console.log(JSON.stringify(a)); return r.apply(this, a); }).
  3. The owner types Health three times fast in the reserve's field, then the GM twice: write each logged argument list and whether the window flickered.
  4. The GM gives the student an item: write the arguments; the sheet must draw again.
  5. From the GM's console: actor.update({ 'system.resources.hitPoints.value': n }, { render: false }), then actor.sheet.render(false, { renderContext: 'updateActor' }): the sheet draws whole with the stored number.
  6. A player takes a Level Up the GM offered: the button goes on the owner's and the GM's sheet; with a second GM connected, note that GM's button.
- Settles it: agrees: a resource write logs render(false, { renderContext: 'updateActor', renderData: { system.resources... } }) and no flicker; defect: another shape on every write (every write flickers) or a number that differs between pages

### L1-399 - E96's eight items at a real table on v14
- Audit ref: `stages-15.json` - not_established
- Clients: one GM, one player · Theme: both · Priority: E96's grade cap (9)
- Recipe:
  1. Under Stained Glass at 2000x1072 (the owner's size), 1920x1080 and 1366x768, GM and player: run AUDIT item 409's console line; the last field must not be static; the right column and the voice tile stand where they did before 1.2.100, the tile at the middle of the right side with its buttons on its pane and glass to the wall.
  2. Open Search, Observe and the Look window: no orange ring in a checked radio or checkbox, every box 22 px; read getComputedStyle(input, '::after').content and '::before'.
  3. Change the phase and the hour: the first frame of the recolour is the screen at rest, in Chromium and in Firefox.
  4. Open Give / take items and the GM panel: no horizontal scrollbar; write the GM panel window's width.
  5. Read a sheet's reserve row (3 / 4) and the two bars' colours in both themes.
- Settles it: agrees: each as written; new live check otherwise, with the item's number and a screenshot

### L1-400 - E46's windows under Foundry v14's own frame and stylesheet (LIVE-E46-01, -07 first; then -02..-06)
- Audit ref: `stages-16.json` - E46
- Clients: GM and one player, two browsers · Theme: both · Priority: grade cap 9
- Recipe:
  1. Open Room setup on the school scene and step through every tab at 1366x768 and 1920x1080; screenshot the footer on each tab.
  2. On Searching press + once and read the room's token count on a player's page (it rises by 1).
  3. Change one field, switch scene without closing, press Apply; note the 'changed rooms' count; press Apply with nothing changed and confirm no region update.
  4. Repeat in Polish and under the other theme; note every cut label with no tooltip.
  5. On Description set three pictures (one over 8 MB or 4096 px, one small, one missing) and record the warnings, the HEAD requests in the network tab and the seconds to the last warning.
- Settles it: Footer on screen on every tab, one write per click, Apply with nothing changed writes nothing and no label cut without its tooltip: the stage holds at a table; any cut label or double write is a defect against E46.

### L1-401 - The Class Trial console's footer on v14's DialogV2 and the case window's Restore with two GMs (LIVE-E47-01, -04; then -02, -03, -05..-11)
- Audit ref: `stages-16.json` - E47
- Clients: two GMs (one primary), one player · Theme: both · Priority: grade cap 9
- Recipe:
  1. GM runs a Class Trial with the console open through a debate, an Objection with its Rebuttal, the vote and the verdict; screenshot the footer in each state and note its height in px.
  2. Press Enter in each state; note which button it presses (none during the Objection).
  3. Without a Mastermind, hover Start the Final Trial; note which tooltip shows.
  4. With two GM accounts: Back up the case, the second GM changes a note and a Key planner row, then Restore from file: preview first, Cancel changes nothing, Confirm restores on both; note the seconds to the second GM's state.
- Settles it: Footer redrawn in place at one height, Enter only on the right group, Restore previewed and applied on both GMs: E47 holds at a table; a jumping or closing footer, or a second GM left on the old stores, is a defect.

### L1-402 - The statistic proposal and Take from the Body at a table (LIVE-E68-01, -03 first; then -02, -04, -05)
- Audit ref: `stages-16.json` - E68
- Clients: GM and two players in separate browsers · Theme: both · Priority: grade cap 9 (provisional 7)
- Recipe:
  1. As the killer's player in an Eclipse, declare a Direct Murder, pick Hand and write how; read the GMs' card (Allow: Hand, Change to: Body, Refuse, 'Proposed: Hand'); Allow; end the Eclipse with killer and victim alone; confirm the opening rolls Hand with no second window on the GM.
  2. Repeat with Change to: Body, and with the card left unanswered until the lights.
  3. With a body tile in a room: a student alone Takes two items (one Hand roll, no Shadow, no cards); then with a second student in the room (Hand, then Shadow against 16); force a miss with Hope and with Despair and read both cards in the witness's chat.
  4. With the killer's accomplice in the room, record whether the Shadow is asked and who gets the miss card.
  5. With a token the player's screen does not show in the room (if the table has one: a sneaking student, a veiled killer), Take and note whether a Shadow roll is asked.
- Settles it: Cards and buttons as listed, one roll window per road, the cover asked only with a visible witness: the stage holds; a second window, a cover asked with nobody visible, or a card in the wrong chat is a defect.

### L1-403 - A death's map and sheet at a table on today's code: one corpse token with its caption, no visible tile, the hook on every browser, no state icon on a token (LIVE-E95-01 fixed state, -03, -04, -05)
- Audit ref: `stages-16.json` - E95
- Clients: two GMs (one primary), two players, one of them Polish · Theme: both · Priority: grade cap 9 (provisional 7)
- Recipe:
  1. Before the death, in each browser's console: Hooks.on('drpgBodyAnnounced', p => console.log('E95', performance.now(), p.writer, typeof p.waitUntil)).
  2. Make a student's death known (Students window or a murder's close); screenshot the map on the GM and on a Polish player: count the tokens/tiles drawn at the place.
  3. In the player's console list tiles with flags['danganronpa-rpg'].bodyOf and their hidden; hide the tile on the GM and list again.
  4. Two students walk in; the primary GM presses Announce; read one 'writer true' line on the primary and one 'writer false' on every other browser.
  5. Give a student Breakdown and Wounded; confirm no icon on the token for GM, owner, another player and an Observer, and the two badges on the sheet for all four.
- Settles it: One corpse token captioned, nothing else drawn, one hook line per browser, no state icon on any token and both badges on the sheet: E95's lasting part holds at a table; a second drawn object, a missing or doubled hook line, or an icon on a token is a defect.

### L1-404 - the Event panel as a live region in a screen reader, and a critical's cut with the Critical sound slot at a table, both themes
- Audit ref: `stages-17.json` - E48
- Clients: GM, one player (two browsers) · Theme: both · Priority: grade cap 9 (E48's look and accessibility promises)
- Recipe:
  1. Foundry 14.370, Daggerheart current, one GM and one player; the player with NVDA in Firefox (and, if at hand, VoiceOver in Safari).
  2. Start a Class Trial so the Event panel is drawn; let two cards change; note what the reader says and whether it says the whole panel again.
  3. Assign a file to the Critical sound slot; the player rolls actions until one is critical (or the GM forces one); note the notice's wipe, its first line (glyph, 'Critical success', the roller's name) on the roller's and the GM's screen, and who hears the slot.
  4. Repeat 2-3 under Stained Glass and Monokuma Legacy, English and Polish; then turn reduced motion on and roll a critical again.
- Settles it: settled yes when the reader announces only the changed card, the critical's notice cuts in with its line for its owner and the GM and none for another player, the slot plays for the roller alone and reduced motion stills the cut; settled no on any of those failing

### L1-405 - a body at every death, a kept death laying none until known, the Class Trial's end taking every body with two GMs, the body following its corpse at a drag and at Move the body, a 1.2.104 world's open 
- Audit ref: `stages-17.json` - E63
- Clients: primary GM, second GM, two players · Theme: both · Priority: grade cap 9 (E63's whole promise; LIVE-E63-01..05)
- Recipe:
  1. Foundry 14.370, the primary GM, a second GM and two players; a scene with rooms; both themes, one player in Polish.
  2. Kill a student in public: the GM checks in the Tiles layer that one body tile (alpha 0) lies at the token and the caption is on the corpse's token; the players see two things (corpse and Spectator), no third.
  3. Run an incident whose death the GMs keep: confirm no tile until the discovery publishes it, then one.
  4. Drag a corpse's token into another room (GM) and run Stage 6's Move the body: the tile moves with it; the Monocub's walking token leaves it.
  5. Run a Class Trial with a sentence; the second GM presses End the trial: every body tile goes, the executed's too; repeat with the primary's browser slowed or reloading.
  6. On a copy of a 1.2.104 world with a dead public non-Monocub before its trial, update and read the migration notice and `laid` in the primary's console.
- Settles it: settled yes when each road lays or removes exactly the tiles the rules name and no player sees a third token; settled no on a stray tile, a tile left after the trial or a tile that stays behind its corpse

### L1-406 - a player's save on Daggerheart 2.12.x marked once; a drawn action roll on 2.12.x with its card, Hope, Calls and Reroll; the table's dice look and DSN 6.4.5's saved marker
- Audit ref: `stages-17.json` - E76
- Clients: GM, two players · Theme: both · Priority: grade cap 9 (LIVE-E76-02, -04, -05, -07)
- Recipe:
  1. Foundry 14.370, Daggerheart 2.12.9 (the verified build), Dice So Nice 6.4.5, a GM and two players.
  2. A player rolls a save from a chat card with a save: the card is marked once, by the primary GM, with the total and the critical.
  3. A player rolls an action: the GM throws the dice, the module's window, claim, Loaded Die, Calls and card read as on 2.10; the GM rerolls it once.
  4. With One dice look for the table on: a player who never saved a look and one who did each roll; read each one's dice look and effects and their flag dice-so-nice.saved; add a module that registers default effects and roll again.
- Settles it: settled yes when the save is marked once, the roll is drawn by the GM with every module mark, and both players throw the table's look with no package effects; settled no on any of these

### L1-407 - a player's save on Daggerheart 2.12.x marked once; a drawn action roll on 2.12.x with its card, Hope, Calls and Reroll; the table's dice look and DSN 6.4.5's saved marker
- Audit ref: `stages-17.json` - not_established
- Clients: GM, two players · Theme: both · Priority: grade cap 9 (LIVE-E76-02, -04, -05, -07)
- Recipe:
  1. Foundry 14.370, Daggerheart 2.12.9 (the verified build), Dice So Nice 6.4.5, a GM and two players.
  2. A player rolls a save from a chat card with a save: the card is marked once, by the primary GM, with the total and the critical.
  3. A player rolls an action: the GM throws the dice, the module's window, claim, Loaded Die, Calls and card read as on 2.10; the GM rerolls it once.
  4. With One dice look for the table on: a player who never saved a look and one who did each roll; read each one's dice look and effects and their flag dice-so-nice.saved; add a module that registers default effects and roll again.
- Settles it: settled yes when the save is marked once, the roll is drawn by the GM with every module mark, and both players throw the table's look with no package effects; settled no on any of these

### L1-408 - a body at every death, a kept death laying none until known, the Class Trial's end taking every body with two GMs, the body following its corpse at a drag and at Move the body, a 1.2.104 world's open 
- Audit ref: `stages-17.json` - not_established
- Clients: primary GM, second GM, two players · Theme: both · Priority: grade cap 9 (E63's whole promise; LIVE-E63-01..05)
- Recipe:
  1. Foundry 14.370, the primary GM, a second GM and two players; a scene with rooms; both themes, one player in Polish.
  2. Kill a student in public: the GM checks in the Tiles layer that one body tile (alpha 0) lies at the token and the caption is on the corpse's token; the players see two things (corpse and Spectator), no third.
  3. Run an incident whose death the GMs keep: confirm no tile until the discovery publishes it, then one.
  4. Drag a corpse's token into another room (GM) and run Stage 6's Move the body: the tile moves with it; the Monocub's walking token leaves it.
  5. Run a Class Trial with a sentence; the second GM presses End the trial: every body tile goes, the executed's too; repeat with the primary's browser slowed or reloading.
  6. On a copy of a 1.2.104 world with a dead public non-Monocub before its trial, update and read the migration notice and `laid` in the primary's console.
- Settles it: settled yes when each road lays or removes exactly the tiles the rules name and no player sees a third token; settled no on a stray tile, a tile left after the trial or a tile that stays behind its corpse

### L1-409 - The zone modes on a real v14 hall (LIVE-E73-01, -02, -05 first; then -03, -04, -06, -07)
- Audit ref: `stages-18.json` - E73
- Clients: GM, a second GM for the reload, three players · Theme: both · Priority: grade cap 9
- Recipe:
  1. In the sandbox, link a trial hall with two zone regions, one with a hole and one on a second Level; pick them in Room Setup > Scenes.
  2. Start a Straw Poll from the console's mode picker; a player drags a token from Zone A to Zone B in the last two seconds; compare every client's count with the GM's.
  3. Put a token in the hole and one on the second Level; note which side each counts on.
  4. Run a Logic Dive; the primary GM reloads mid-question; note the clock after the reload and search game.settings for the set's truth on a player.
  5. Screenshot the console at 1366x768 with no trial and in a Straw Poll, both themes: footer and bar in view with Foundry's header.
- Settles it: Counts agree on every client, the hole on neither side, the Level per testPoint, the question surviving the reload with no truth on a player and the console whole on screen: E73 holds at a table; any count that differs or a truth on a player is a defect against E73.

### L1-410 - The case map in Foundry's own frame and the realization on a real scene (LIVE-E97-01, -02 first; then -04, -05, -03, -06)
- Audit ref: `stages-18.json` - E97
- Clients: GM, a second GM for LIVE-E97-04, one player · Theme: both · Priority: grade cap 9
- Recipe:
  1. As GM at 1366x768 and 1920x1080, open The case > Investigation: the Map, then the Table and each tab; screenshot each and note the window's width and whether the footer moves.
  2. On the Map with All open off, click a node, press Escape: note whether the node closes and the window stays open.
  3. Drag empty space, wheel over the graph, press -, + and Fit to view: note that zoom stops at 25% and 200%.
  4. Realization preview: pick a room for two slots, Run; as a player find one; Undo: note what was removed and what stayed.
  5. In a second browser as a player, with an author set by the GM on a trace, run in the console: game.actors.contents.flatMap(a => a.items.contents).map(i => i.flags) and look for leftBy, sourceName or sourceActor.
- Settles it: Frame fixed, nodes whole, Escape closing the node only, Undo removing only the unfound and no author on the player's side: the stage holds at a table; Escape closing the window or an author on the player's side is a defect against E97.

### L1-411 - The Investigation panel on a world of about 60 Remnants, and Legacy's Table heads in Foundry (LIVE-E97-06 second half, LIVE-E97-01's Legacy part)
- Audit ref: `stages-18.json` - E98
- Clients: GM and one player · Theme: both · Priority: grade cap 9
- Recipe:
  1. Under Monokuma Legacy, at 1366x768, open the Table's Remnants tab: screenshot the heads; note any head broken inside a word.
  2. Seed or place about 60 Remnants in one chapter; open the panel on the Map and on Who has what.
  3. Run await game.drpg.fps({ toChat: false }) with the panel open; as a player find one Remnant during the run; note the frame figures.
- Settles it: No broken head and no felt redraw (fps report within the table's baseline): E98's open questions close; a broken head or a long frame on the redraw is a defect against E98.

### L1-412 - The schema in the trial console under Foundry's header, and the summary with two GMs (LIVE-E99-01 first; then -04, -05)
- Audit ref: `stages-18.json` - E99
- Clients: two GMs (one Assistant), one player · Theme: both · Priority: grade cap 9
- Recipe:
  1. At 1366x768 under Stained Glass, run a Nonstop Debate; in the console's schema press Fit to view; screenshot and measure the smallest node text (devtools, computed font-size times the zoom).
  2. Check the footer: every button in view with Foundry's own header.
  3. With two GMs (one an Assistant): both tick different deductions in the same second; reload both and read the ticks.
  4. After the verdict both GMs open Show summary and press Send together; count the case summary cards in a player's chat.
- Settles it: Text at 11 px or more, footer whole, both ticks kept and one card: E99 holds; under 11 px, a lost tick or two cards is a defect against E99 (two cards confirms E99-1).

### L1-413 - Two GMs' Run realization at once (LIVE-E97-04)
- Audit ref: `stages-18.json` - not_established
- Clients: two GMs (one Assistant) · Theme: default · Priority: grade cap 9
- Recipe:
  1. Build a case with two Key slots and rooms.
  2. Both GMs open Realization preview and pick rooms.
  3. Press Run on both within a second.
  4. Count the Key Remnant tokens made and the plan's slots.
- Settles it: Two tokens, two slots filled: holds; four tokens or a slot pointing at a deleted token: a defect against E97.

### L1-414 - The 1.3.0 package at a table
- Audit ref: `stages-26.json` - stage E26
- Clients: a GM · Theme: Monokuma Legacy · Priority: not graded for the release part
- Recipe:
  1. Install the release's manifest URL on a clean Foundry v14 with Daggerheart at its verified version.
  2. Open a Monokuma Legacy page with a Polish campaign name and read that the HUD and tabs draw 'DRPG Pixel' from pixel.woff2?v=4 and pixel-ext.woff2?v=5.
- Settles it: installs and draws the face: read; an install error or a fallback face: defect

### L1-415 - checkState on a played world, season-wipe on a world copy, the two-accused window
- Audit ref: `stages-26.json` - stage E40
- Clients: a GM and three players · Theme: both · Priority: stage cap 9
- Recipe:
  1. Copy a v14 world played through at least one chapter; start it as the primary GM and read the console for state-check warnings (LIVE-E40-01).
  2. On that copy run resetSeason with every group ticked, then game.drpg.checkState() and the local gate's whole-world diff (LIVE-E40-02).
  3. In a Class Trial with two accused alive, open the verdict window: two ticks, Wrong held with none ticked, a wrong verdict executing exactly the ticked (LIVE-E40-03).
- Settles it: checkState says nothing false and the reset leaves no secret behind: read; a warning that is wrong or a leftover: defect

### L1-416 - The hostile-client matrix on v14 and the Mask's two cards at a table
- Audit ref: `stages-26.json` - stage E43
- Clients: a GM and three players · Theme: default · Priority: stage cap 9
- Recipe:
  1. Run scenario 33's part H against the 30099 sandbox with a GM and three players.
  2. Open a Mask with no incident running and end it; read every player's chat log for the killer's name (LIVE-E69-05).
- Settles it: every request refused as headless and no name in a bystander's log: read; otherwise defect

### L1-417 - The performance baseline and the budget's first run
- Audit ref: `stages-26.json` - stage E53
- Clients: a GM and one player · Theme: both · Priority: stage cap 9
- Recipe:
  1. Record a perfFunction revision for the served version (finding E53-1).
  2. On a 1366x768 laptop drawing on a GPU, with the world copy (DRPG_FIXTURES) and the largest isometric map, run node audit/live/perf-baseline.mjs --run in both themes.
  3. Give the owner the readings for the null thresholds.
- Settles it: a run appended to runs and check budget holding it: measured; a refusal: not run, with its reason

### L1-418 - The rest of AUDIT 9.2 and the local gate
- Audit ref: `stages-26.json` - stage E58
- Clients: a GM and three players (gm2 for the scenarios that need it) · Theme: both · Priority: not graded
- Recipe:
  1. Resume line L1 from 7875554f after the audit; take TRIAGE-9.2.md's K and S rows not yet driven.
  2. Run npm run gate:local on the release commit with the sandbox up.
- Settles it: each item read or carried as not checked with its reason; local-gate.json with every part run or not run with its real error


## Priority: nit

### L1-419 - How long the GM panel's Next line takes on a real world with several scenes and rooms, and how often it is computed during Daily Life
- Audit ref: `domain-case-g-death-chapter.json` - not_established
- Clients: 1 GM, 3 players · Theme: both · Priority: nit
- Recipe:
  1. Open the GM panel on a world with 3+ scenes and 20+ rooms, in Daily Life.
  2. Run await game.drpg.fps({ toChat: false }) while players move tokens and spend actions.
  3. Read game.drpg.counters() for the panel's renders, and time one call of firstOutstandingStep() in the console with performance.now().
- Settles it: Under a few ms a call and no panel render per token move: no defect. Tens of ms per render, or a render per move: a perf finding.

### L1-420 - Whether spectatorViewer and paintSpectatorUi show in the frame and work counters on a player's browser
- Audit ref: `domain-case-g-death-chapter.json` - not_established
- Clients: 1 GM, 2 players · Theme: both · Priority: nit
- Recipe:
  1. On a player's browser with 30 actors in the world, run await game.drpg.fps({ toChat: false }) while another player drags a token.
  2. Read game.drpg.counters() for visibility and fog repaints during the drag.
- Settles it: No measurable share of the frame: no defect. A visible share on a player's browser: a perf finding for the lane.

### L1-421 - Whether a bystander's game.actors and canvas tokens hold a kept death's watcher while nobody has found the body
- Audit ref: `domain-case-g-death-chapter.json` - not_established
- Clients: 1 GM, 2 players · Theme: default · Priority: nit
- Recipe:
  1. As GM, kill the running incident's victim with the box ticked (kept).
  2. On a bystander's browser run game.actors.filter(a => a.getFlag('danganronpa-rpg','spectator')).map(a => a.name) and canvas.tokens.placeables.filter(t => t.document.actor?.getFlag('danganronpa-rpg','spectator')).length.
- Settles it: Present: a console reads the death (as Q-C3b-1 accepted). Absent: Foundry does not send it.

### L1-422 - the frame cost of a GM's return with many thread cards
- Audit ref: `domain-comm-a-messenger.json` - not_established
- Clients: 1 GM returning, any players · Theme: both · Priority: nit
- Recipe:
  1. On a world with a season of chat (several thousand messages, a few hundred thread cards), reload a GM's page.
  2. Run await game.drpg.fps({ toChat: false }) during the first 20 s after ready and read game.drpg.counters() for messenger.threadStats.
- Settles it: messenger.threadStats in the hundreds and slow frames over the words' arrival: worth the change; a handful and no slow frames: a nit only.

### L1-423 - two threads marked read at once on a GM
- Audit ref: `domain-comm-a-messenger.json` - not_established
- Clients: 1 GM, 2 players · Theme: default · Priority: nit
- Recipe:
  1. On a GM with two players' windows open, run in the console: const M = await import('/modules/danganronpa-rpg/scripts/messenger.mjs'); await Promise.all([M.markThreadRead('<player A id>'), M.markThreadRead('<player B id>')]) after a new message in each thread.
  2. Read game.settings.get('danganronpa-rpg', 'messengerLastRead').
- Settles it: Both stamps present: no loss. One missing: a race worth a finding.

### L1-424 - Whether a speaker-heavy scene costs frames on a player's browser through the tile's paint.
- Audit ref: `domain-comm-c-voice.json` - not_established
- Clients: GM and four players · Theme: both · Priority: nit
- Recipe:
  1. A world with 20 or more scenes holding tokens; four players talking in one room.
  2. On one player: await game.drpg.fps({ toChat: false }) with the voice tile on.
  3. Switch the tile off (the GM's voiceTile setting) and run it again.
  4. Compare the slowest twentieth and frames over 33 ms.
- Settles it: A difference above noise in the slow frames says the paint costs frames; none says it does not.

### L1-425 - How long a settle takes and how often it runs while students act in Daily Life with a Spectator in the world.
- Audit ref: `domain-comm-c-voice.json` - not_established
- Clients: primary GM and three players, one of them a Spectator · Theme: default · Priority: nit
- Recipe:
  1. A world with one E92 Spectator; the primary GM with the module's Debug logs on.
  2. Three students take an action each within ten seconds.
  3. Time the settles with a performance mark around settleTrialVoices from the console (or count them by a temporary hook).
  4. In a Class Trial, open a mode and read whether the floor's block lands later than without the actions.
- Settles it: Settles of more than a few ms each, or a block landing late, confirm the cost; a sub-millisecond settle and no delay make it a nit with no effect.

### L1-426 - The stored voice mode on a fresh profile and what the panel shows for it.
- Audit ref: `domain-comm-c-voice.json` - not_established
- Clients: GM and two players · Theme: default · Priority: nit
- Recipe:
  1. A fresh browser profile joins as a player.
  2. In the console read game.webrtc.settings.client.voice.mode.
  3. Open the gear's Voice section and read which radio is checked.
  4. Speak without a key and ask another player whether they hear you.
- Settles it: If the stored mode is 'activity' and the player is heard without a key, the panel's 'Always on' is true to the effect; if not heard, it is a wrong label.

### L1-427 - The button sound's delay as heard
- Audit ref: `domain-comm-d-audio.json` - not_established
- Clients: 1 GM or player · Theme: both · Priority: nit
- Recipe:
  1. Map a short click to Button in a window and Button on a character sheet
  2. Press ten sheet pips and ten window buttons
  3. Note whether the click is heard with the press or after it
- Settles it: heard with the press: the finding is withdrawn; heard after: it stands

### L1-428 - The iso shield on the table's isometric version
- Audit ref: `domain-core-b-secret.json` - not_established
- Clients: GM (1) · Theme: both · Priority: nit
- Recipe:
  1. With isometric-perspective active and the shield's setting on, reload as GM.
  2. Read the console line 'Iso shield up: N handler(s), M config tab(s) and the currentRegion write loop parked' or the warning that nothing was found.
  3. Open a token's configuration and switch tabs five times.
- Settles it: settled if the line names at least one handler and the loop, and the tabs answer; a defect if the warning appears or the window flickers

### L1-429 - The requirements window's language when the module stops
- Audit ref: `domain-core-c-boot-settings.json` - not_established
- Clients: one GM · Theme: default · Priority: nit
- Recipe:
  1. Set the module's language to Polish on a GM's browser and reload.
  2. Disable Dice So Nice and reload.
  3. Read the window that says the module did not start: Polish or English?
  4. In the console: localStorage.getItem('danganronpa-rpg.language').
- Settles it: Polish window and a JSON string '"pl"': holds. English window or null: v14 keeps client settings elsewhere and the stopped module falls back to Foundry's language.

### L1-430 - Whether checkState flags a clock field the defaults fill
- Audit ref: `domain-core-d-api-diag.json` - not_established
- Clients: 1 GM · Theme: default · Priority: nit
- Recipe:
  1. On an old world, read game.settings.get('danganronpa-rpg','clock') at the console
  2. Run game.drpg.checkState()
- Settles it: A 'clock's day is undefined' problem with getClock().day === 1 confirms a false warning; no problem refutes it

### L1-431 - Whether game.drpg.a11y() lists the room tile's fold on a stacked screen
- Audit ref: `domain-core-d-api-diag.json` - not_established
- Clients: 1 player · Theme: both · Priority: nit
- Recipe:
  1. Open the world at a phone-sized window so the stack is drawn
  2. Open the room tile's description
  3. Run game.drpg.a11y()
- Settles it: A disclosure line for the room tile on the stack and none on a desk confirms finding 6 for the desk only

### L1-432 - Not a table check: a harness probe that draws a roll with advantage and a Call's d4 with the balance log on and reads the row.
- Audit ref: `domain-desp-a.json` - not_established
- Clients: harness, 1 GM 1 player · Theme: n/a · Priority: nit
- Recipe:
  1. Harness: balanceLog on; arm a Call with a bonus die and advantage on a student; draw an action roll; read balanceLogStore's row.
- Settles it: adv.faces matches the advantage die and the Call's die is in flat or listed: no defect; otherwise a nit in the report's numbers.

### L1-433 - Two priced actions in one breath on one player's browser.
- Audit ref: `domain-desp-a.json` - not_established
- Clients: 1 GM, 1 player · Theme: default · Priority: nit
- Recipe:
  1. In a Class Trial, a student with 1 Hope and no actions; open Analyze and an Objection window together and confirm both within a second.
  2. Read the Hope and Sanity after.
- Settles it: One paid with Hope and the other with Sanity (or refused): the comment holds; both paid with the one Hope: the comment is wrong at a table.

### L1-434 - A safeword press with a primary GM slow to answer.
- Audit ref: `domain-desp-a.json` - not_established
- Clients: 1 GM, 2 players · Theme: default · Priority: nit
- Recipe:
  1. A player presses the safeword while the primary GM's browser is reloading (connected, module not yet listening).
  2. Count the safeword cards in chat on every client and whether the game pauses.
- Settles it: One card and one pause: no defect; two cards: a nit to record.

### L1-435 - Whether a second delete() of an already deleted embedded Item throws on Foundry 14.370
- Audit ref: `domain-item-a.json` - not_established
- Clients: one GM · Theme: default · Priority: nit
- Recipe:
  1. As GM, open the console on any world with a character holding a module item
  2. const i = game.actors.getName('<name>').items.contents[0]; await i.delete();
  3. await i.delete().then(() => 'resolved', e => 'threw: ' + e.message)
- Settles it: 'threw' - finding 7 ends in an error line and no card; 'resolved' - the card and the trace stand for an item that was not there

### L1-436 - The GM panel's rebuild count and time in a Daily Life
- Audit ref: `domain-item-b-gm-panel.json` - not_established
- Clients: 1 GM, 4 players · Theme: both · Priority: nit
- Recipe:
  1. GM opens the GM panel in Daily Life with the season set up.
  2. Four players walk their tokens for one minute.
  3. GM runs game.drpg.perf() and reads the live..drpg-gmp-standing line.
- Settles it: A middle time under a few ms and a count near the number of settled steps: nit stands or falls to none; tens of ms: perf minor.

### L1-437 - Two GMs and the room fog switched off and on quickly.
- Audit ref: `domain-map-a-fog.json` - not_established
- Clients: two GMs · Theme: either · Priority: nit
- Recipe:
  1. Two GMs connected, a world of several scenes with rooms.
  2. GM A switches Room fog off, then on within a second.
  3. On each scene read tokenVision and the visionBefore flag.
- Settles it: every scene with rooms has tokenVision false: no race at that size; any scene with Foundry's vision back: the race is real.

### L1-438 - The room-entered sound on a floor switch.
- Audit ref: `domain-map-a-fog.json` - not_established
- Clients: one GM, one player · Theme: either · Priority: nit
- Recipe:
  1. A scene of two floors; a player's token stands in a room on floor 1.
  2. Press the floor switcher's floor 2 button, then floor 1.
  3. Listen for the room-entered sound and watch for the outline's hop on floor 1.
- Settles it: no sound: no replay; a sound at each press: finding 13 measured.

### L1-439 - The width of the seams' light at three zooms.
- Audit ref: `domain-map-a-fog.json` - not_established
- Clients: one GM · Theme: stained glass · Priority: nit
- Recipe:
  1. Stained Glass on; stand in a room with Remnants nearby.
  2. Zoom to about 0.3, 1 and 3; screenshot each.
  3. Walk into a new room at zoom 0.3 and screenshot the reveal's lines.
- Settles it: ring light about as wide as the border's at every zoom: no defect seen; wider when zoomed out: finding 11 measured.

### L1-440 - How long one player move costs the primary GM on a busy map.
- Audit ref: `domain-map-b-movement.json` - not_established
- Clients: GM and one player · Theme: both · Priority: nit
- Recipe:
  1. On a scene with 300+ walls and 10+ secret passages, the primary GM runs await game.drpg.fps({ toChat: false }) while a player walks a token across several rooms.
  2. Read game.drpg.counters() for movement.auditMove before and after.
- Settles it: settled as fine if the slowest twentieth of frames on the primary does not change while moves land; a defect if moves show as frames over 50 ms

### L1-441 - The greyed Apply's tooltip when the clashing student's name holds markup.
- Audit ref: `domain-map-c-rooms.json` - not_established
- Clients: 1 GM, 1 player · Theme: both · Priority: nit
- Recipe:
  1. As a player, rename an owned student to a name with simple markup, e.g. a bold tag around it.
  2. As GM open Room Setup, Rooms tab, and give that student two bedrooms.
  3. Hover the greyed Apply.
  4. Read whether the name shows as text or as formatting.
- Settles it: Formatting shows: finding 7 holds. The tags show as text: it does not.

### L1-442 - Frame time during a token's drag on a scene of many rooms, with the module's counters.
- Audit ref: `domain-map-c-rooms.json` - not_established
- Clients: 1 GM, 1 player · Theme: both · Priority: nit
- Recipe:
  1. Open a scene with 20 or more room regions.
  2. As a player, drag your token across three rooms while `await game.drpg.fps({ toChat: false })` runs.
  3. Read the frame rate and visibility.sliding in the report.
- Settles it: Frames over 33 ms grow with the region count: worth a finding. Flat: nothing to say.

### L1-443 - A student with an effect lowering roll bonuses, and one with an effect setting guaranteedCritical false.
- Audit ref: `domain-roll-a-draw.json` - not_established
- Clients: GM and one player · Theme: default · Priority: nit
- Recipe:
  1. Give a student an active effect with a negative roll bonus by Daggerheart's own effect editor.
  2. Roll an action as the player; read the record's `legal.effects` on the GM.
- Settles it: the range's low end is the effect's value: read right; 0 with a flag: the type name differs.

### L1-444 - how often the action grid's GM-stripe predicates run during a busy time of day
- Audit ref: `domain-text-a-config.json` - not_established
- Clients: 1 GM, 1 player · Theme: default · Priority: nit
- Recipe:
  1. Open a student's sheet with 3 Truth Bullets and a project in the room.
  2. Run game.drpg.counters() before and after a minute of Hope and Sanity changes from another player.
  3. Compare the sheet's repaint count with the predicate calls if a counter names them.
- Settles it: no counter rises with the predicates, or they run once per repaint and the repaint count is small; a finding if they run per tile per write

### L1-445 - the --drpg-tile-text scale on the Actions tab and the Calls tab, a student's and a Monokuma's sheet, in English and in Polish
- Audit ref: `domain-text-c-terms.json` - not_established
- Clients: one GM (a sheet of each kind) · Theme: both · Priority: nit
- Recipe:
  1. Open a student's sheet at its default width, Actions tab, in English; in the console read getComputedStyle(document.querySelector('.drpg-action-grid') ?? document.body).getPropertyValue('--drpg-tile-text')
  2. Same on the Calls tab (Contribution) and on a Monokuma's sheet (Public Announcement)
  3. Switch the module language to Polish and repeat
  4. Note the value and whether it is the 0.68 floor
- Settles it: the variable is unset or 1 on both tabs: no tile word shrinks the grid; a value under 1, or 0.68, names the word that does it (rename or soft-wrap it)

### L1-446 - the lair line's width with the Polish Lock button
- Audit ref: `domain-text-c-terms.json` - not_established
- Clients: one GM and one player (the Mastermind's) · Theme: both · Priority: nit
- Recipe:
  1. Make a student the Mastermind with a lair room set
  2. Open their sheet as the Mastermind's player with the module in Polish
  3. Narrow the sheet to its minimum width
  4. See whether 'Zamknij na klucz' stays on the line, wraps to a line of its own or runs past the edge
- Settles it: the button stays on the room's line at minimum width: finding 5 is the ratio alone; it wraps to a line of its own: a cosmetic cost of one line (nit); it runs past the edge: a minor layout defect

### L1-447 - Whether an open module window's title band takes the Class Trial's colour when the trial begins.
- Audit ref: `domain-ui-a-glass.json` - not_established
- Clients: one GM, one player · Theme: stained glass · Priority: nit
- Recipe:
  1. Under Stained Glass, as GM and as a player, open a module window that does not redraw on the clock (the messenger, a Projects window).
  2. Start the Class Trial from the console with the sequences on.
  3. After the entry ends, compare the window's title band seams with the curtain's: both should be the trial's colour.
  4. Repeat for End the trial.
- Settles it: the band is the trial's colour within a second: not a fault; it keeps Daily Life's colour until the window is redrawn: a stale-colour finding (nit).

### L1-448 - Whether #pause stays in the DOM after an unpause on v14, and whether glass.mjs's windows list keeps its job.
- Audit ref: `domain-ui-a-glass.json` - not_established
- Clients: one GM · Theme: stained glass · Priority: nit
- Recipe:
  1. Under Stained Glass as GM, pause and unpause the game.
  2. In the console: document.getElementById('pause')?.isConnected.
  3. Then (await import('/modules/danganronpa-rpg/scripts/glass.mjs')).glassLifecycle().windows.filter(w => !w.app).
- Settles it: #pause gone or the list empty: nothing to fix; #pause connected and a job with no app listed: a per-frame waste (nit).

### L1-449 - The time from ready to document.fonts.ready on a player's first load of the world under Stained Glass.
- Audit ref: `domain-ui-a-glass.json` - not_established
- Clients: one player on the slowest connection at the table · Theme: stained glass · Priority: nit
- Recipe:
  1. Clear the browser cache of a player's machine.
  2. Load the world under Stained Glass with the console open.
  3. Read performance.now() at the 'ready' log and after await document.fonts.ready; check that glassLifecycle().observers is not 0 once the curtain stands.
- Settles it: fonts in under 4 s and observers > 0: the finding is theoretical at this table; observers 0: it occurs.

### L1-450 - Is a kit DialogV2 dressed twice on its first render?
- Audit ref: `domain-ui-b-kit-hud.json` - not_established
- Clients: GM x1 · Theme: default · Priority: nit
- Recipe:
  1. Open any kit window (the GM panel's Despair Flow).
  2. In the console, count listeners on .drpg-kit-body with getEventListeners($0) in Chromium devtools (scroll).
- Settles it: Two scroll listeners on a fresh window settle it as a double wiring; one settles it as once.

### L1-451 - A region's scrolling text on v14, over a shown and a hidden token.
- Audit ref: `domain-ui-b-kit-hud.json` - not_established
- Clients: GM x1, player x1 · Theme: default · Priority: nit
- Recipe:
  1. Give a region the Display Scrolling Text behaviour, visible to Anyone.
  2. Move a player's own token through it; read the player's screen.
  3. Move a token the player's screen keeps dark through it; read the player's screen.
- Settles it: Shown for the own token and not for the dark one settles it; no caption for either settles the stack test as failing on v14.

### L1-452 - The HUD's redraw cost per world setting write.
- Audit ref: `domain-ui-b-kit-hud.json` - not_established
- Clients: GM x1, players x4 · Theme: both · Priority: nit
- Recipe:
  1. At the table run await game.drpg.fps({ toChat: false }) at rest.
  2. Run it again while a GM writes a module world setting the sync bus does not name, a few times.
- Settles it: A frame time that moves with the writes names the HUD; none settles it as harmless.

### L1-453 - Frame time and work of a sheet render
- Audit ref: `domain-ui-c-sheet.json` - not_established
- Clients: GM and one player · Theme: both · Priority: nit
- Recipe:
  1. Open three student sheets on the GM's browser
  2. Run await game.drpg.fps({ toChat: false }) while another browser moves the clock one time of day
  3. Read the frames over 33 ms and the clock.refreshSheets.rendered counter in the report
- Settles it: no frame over 50 ms on the clock change -> no finding; frames over 50 ms attributed to the sheet pass -> a perf finding

### L1-454 - The curtain after a tab switch.
- Audit ref: `live-items-18.json` - 9.3 9.3-20
- Clients: GM · Theme: Stained Glass · Priority: nit
- Recipe:
  1. Stained Glass, 1920x1080; open a panel that changes the layout.
  2. Switch to another tab, close the panel from the console of a second window if needed, switch back.
  3. Shoot at once and after 1 s; run the curtain's self-check (drpgGlassCheck).
- Settles it: Agrees if no blurred pane stands over an empty spot; a defect otherwise.

### L1-455 - The Despair rail and the status strip between 1224 and 1248 px, at scale 1.0 and 1.4.
- Audit ref: `live-items-18.json` - 9.3 9.3-24
- Clients: GM and one player · Theme: Stained Glass · Priority: nit
- Recipe:
  1. Stained Glass, a world with many Despair rows; set the browser to 1232x800 and 1240x800.
  2. Shoot the top bar; run the curtain's self-check; record blockFails.
  3. Raise the scale slider to 1.4 and step the width up by 16 px until the self-check is clean; record that width.
- Settles it: Agrees with the item's worry if the rail and strip touch on a desk layout; settled 'not visible' if the owner sees nothing wrong at those widths.

### L1-456 - The two macro warnings at a table, and a loop of them.
- Audit ref: `live-items-18.json` - B-E52 B-E52-10, LIVE-E52-10
- Clients: GM and one player · Theme: default · Priority: nit
- Recipe:
  1. As the GM run game.drpg.killCharacter('nobody-such'); shoot the notice and time it; check a player's page for it.
  2. Make two scratch actors with one name; call it with that name; record the warning and which actor was marked; revive and delete them.
  3. Run a macro calling the typo every 3 s for 60 s; shoot the notices.
  4. Run `const { traitValue } = game.drpg; traitValue(game.actors.getName('Aiko Hoshino'), 'eye')`.
- Settles it: Agrees if only the caller is warned, the loop's notices stay readable, and traitValue answers; a defect for a silent call, a notice on the player, or a pile that covers the screen.

### L1-457 - A failed contract row's notice and its Diagnostics lines in both languages; the 69 Polish sentences read by a native speaker.
- Audit ref: `live-items-18.json` - B-E52 B-E52-11, LIVE-E52-11
- Clients: GM · Theme: both · Priority: nit
- Recipe:
  1. As the GM in English: `const m = await import('/modules/danganronpa-rpg/scripts/patches.mjs'); m.announceContract({ rows: [{ ...m.PATCHES.find(r => r.id === 'door-controls'), probe: () => ({ present: false, ours: null }) }], told: new Set() })`; shoot the notice; check it stays.
  2. Open the GM panel's Diagnostics, Debug log, Foundry and modules, with that row failing (the same probe swapped in the register for the session); shoot the cross and the folded line in both themes.
  3. Switch the module language to Polish; repeat both.
  4. Give a native Polish speaker the 69 DRPG.Contract.instead sentences; record each one they find unfriendly or unclear.
- Settles it: Agrees if the notice stays, each language holds alone apart from the target and file:function, and the speaker finds each sentence clear; each unclear sentence is a text finding.

### L1-458 - The selection colours on a real canvas, per placeable.
- Audit ref: `live-items-18.json` - B-E52 B-E52-6, LIVE-E52-06
- Clients: GM · Theme: both · Priority: nit
- Recipe:
  1. On a scene with a door, a light and a sound, as the GM, default theme: select each placeable kind in turn; shoot each.
  2. Drag a selection rectangle; shoot it.
  3. Read the two selection rows in game.drpg.diagnosePatches().
  4. Repeat in Stained Glass.
- Settles it: Agrees if every border and the rectangle take the interface colour, the door, light and sound icons keep Foundry's, and both rows are ok; a defect for any other colour.

### L1-459 - The style and window diagnoses against the fonts loaded, the click trace's three cases, and the warm-up's real length.
- Audit ref: `live-items-18.json` - B-E52 B-E52-8, LIVE-E52-08
- Clients: GM and the weakest player's machine · Theme: both · Priority: nit
- Recipe:
  1. In each theme run game.drpg.diagnoseStyles() and diagnoseWindows(); compare their font lines with `[...document.fonts].filter(f => f.status === 'loaded').map(f => f.family)`.
  2. Run game.drpg.traceClicks(); click a module button, an inert label, and an element whose parent stops propagation; copy the trace.
  3. Run game.drpg.perf() five times with warmup 0, 5 and 20 (frameBeat's option) on the GM's machine and on the weakest player's; record the beats.
- Settles it: Agrees if the font lines match the loaded faces, the trace names each click truly, and warm-up 5 reads within noise of 20; otherwise the number changes.

### L1-460 - The page-tint notice against real extensions.
- Audit ref: `live-items-18.json` - B-E52 B-E52-9, LIVE-E52-09
- Clients: one player · Theme: default · Priority: nit
- Recipe:
  1. In Chrome with Dark Reader on, load the world as a player; record the notice and diagnoseStyles' line.
  2. Turn Dark Reader off; turn on Stylus with a whole-page dark style, then Night Eye; record each.
  3. Repeat in Firefox.
  4. With none on, open a Daggerheart sheet; record that no notice appears.
- Settles it: Agrees if only named Dark Reader raises the notice and system or module sheets are skipped; a defect for a notice on an unnamed sheet or none for Dark Reader.

### L1-461 - The statistic caption and field width in an action window, and the greyed Rest tile and window
- Audit ref: `live-items-293.json` - 9.2 item 304, LIVE-E16-05
- Clients: one player · Theme: both · Priority: nit
- Recipe:
  1. A player at 1366x768, Stained Glass then Monokuma Legacy, English then Polish
  2. Open Tamper and a general action with two statistics; screenshot the caption, the field and the note
  3. Spend both rests' conditions; hover the Rest tile; screenshot the tooltip; open the Rest window and screenshot
- Settles it: agrees: caption above, field the row's width with 'Hand (+1)' whole, note under; both rest rows greyed with reasons and one Close; defect: a cut option, the caption beside the field, or a rest row offered

### L1-462 - The player's status bar in the Eclipse states and after death, at 1366x768
- Audit ref: `live-items-293.json` - 9.2 item 314, LIVE-E17-09
- Clients: one GM, one player · Theme: both · Priority: nit
- Recipe:
  1. A player at 1366x768, each theme and language
  2. Night Eclipse: screenshot the bar and its Move tooltip
  3. Eclipse with a crossing limit: screenshot
  4. As a Monocub: screenshot and tooltip
  5. As a dead student (not a Monocub): screenshot
- Settles it: agrees: the rows as today's code draws them and nothing outside the column; defect: a row cut off or a wrong state row

### L1-463 - The voice tile's state word against the buttons, with a real LiveKit panel
- Audit ref: `live-items-293.json` - 9.2 item 319, LIVE-H84-03
- Clients: one GM, one player · Theme: both · Priority: nit
- Recipe:
  1. A table with avclient-livekit connected
  2. Screenshot the voice tile at 1920x1080 and 1366x768 in both themes while connecting and connected
  3. Lift the tile (open what sets --drpg-voice-lift) and shoot again
  4. Measure the word's baseline against the buttons' centre in each shot
- Settles it: agrees: the word on the buttons' line (0 px) in every shot; defect: an offset like the 46-47 px read before H84

### L1-464 - The Projects tray row's icons under both themes
- Audit ref: `live-items-293.json` - 9.2 item 320, LIVE-H84-04
- Clients: one GM · Theme: both · Priority: nit
- Recipe:
  1. GM at 1920x1080 with a hidden project and a looping one in the Countdowns tray
  2. Screenshot the tray in Stained Glass and Monokuma Legacy
  3. Zoom on -1, +1, the crossed eye, the loop arrows and the fold button
- Settles it: agrees: every icon a Font Awesome glyph; defect: an empty box or a VT323 letter in either theme

### L1-465 - The Clear the Overflow button's look, and a non-primary GM's clear
- Audit ref: `live-items-293.json` - 9.2 item 322, LIVE-H84-06
- Clients: two GMs, one player · Theme: both · Priority: nit
- Recipe:
  1. Two GMs; overflow above zero
  2. Open Despair Flow, Overflow tab at 1366x768 and 1920x1080 in both themes; screenshot
  3. The non-primary GM presses the button; read the question; confirm
  4. Read the overflow and the pool caption on every page
- Settles it: agrees: the button whole inside the window, a question first, zero everywhere; defect: a cut button, no question, or a page still showing the old count

### L1-466 - fps() on the table's real machines in the item's setting, the look after it, and a second call refused
- Audit ref: `live-items-293.json` - 9.2 item 323, LIVE-E88-01
- Clients: one GM, the weakest player, others standing · Theme: both · Priority: nit
- Recipe:
  1. The GM's own computer and the weakest player's, each in both themes; everyone standing; one player alone in a fogged room
  2. await game.drpg.fps({ toChat: false }) on each; save the output
  3. Screenshot map, rings, fog, glass, pulse and ticker before and right after
  4. Call game.drpg.fps() a second time while the first runs; read the answer
- Settles it: agrees: output recorded, the screen the same after, the second call refused; defect: an effect left held after the run, or two runs at once

### L1-467 - How many refreshToken.* a real v14 runs for another player's step, a two-square drag, and a hide/unhide
- Audit ref: `live-items-293.json` - 9.2 item 324, LIVE-E88-05
- Clients: one GM, two players · Theme: default · Priority: nit
- Recipe:
  1. GM and two players on one scene with many tokens
  2. game.drpg.counters({ reset: true }) on the GM and on a player
  3. The other player steps one square inside their room; read game.drpg.counters() on both
  4. Reset; the other player drags two squares; read
  5. Reset; the GM hides and unhides a token in a player's room; read the counters and whether it is on that player's screen
- Settles it: agrees: one refresh of the moved token per listener (as 86 C2 models), the slide's count recorded, the token back after unhide; defect: a whole pass for another's step, or the token missing after unhide

### L1-468 - The glow of rings and room outlines before and after E88 C1, and the counters on a GM screen with many Remnants
- Audit ref: `live-items-293.json` - 9.2 item 325, LIVE-E88-02
- Clients: one GM, one player · Theme: both · Priority: nit
- Recipe:
  1. Two installs or a checkout at 1.2.88 and at 1.2.118 on one world; same scene, same camera
  2. Screenshot the own ring, a student's, a Remnant's, a project's and the room outline at game zoom and one step closer, both themes
  3. Toggle 'Glass blurs the map' off and shoot again
  4. On a GM screen with 20 or more Remnants: await game.drpg.counters(); read live.byName and halos.textures; fps() before and after
  5. Repeat the shots in the isometric view if the table uses it
- Settles it: agrees: the glow looks the same and scales with the map, no live ring blur, one texture per frame shape; defect: a thinner, dimmer or harder glow, or a live blur listed

### L1-469 - the GM Panel's tile edges under Stained Glass on a real GPU
- Audit ref: `live-items-327.json` - 9.2 item 345, LIVE-E89-04
- Clients: a GM and one player · Theme: stained glass · Priority: nit
- Recipe:
  1. Under Stained Glass, at the table's own window size, a player drags a token while the GM opens the GM Panel
  2. Record or shoot the right edge of Students and Murder, the bottom edge of the season reset tile, Close and the title bar
  3. Open a messenger window and shoot the send button's top edge
  4. Repeat with a still scene and after moving the panel a few pixels
  5. If a 1.2.90 install is at hand, repeat there
- Settles it: agrees if no edge vanishes or flickers on 1.2.118 in either state; defect if any does (name edge, tile, size)

### L1-470 - the GM's roster and an unplaced thread window beside the voice tile
- Audit ref: `live-items-327.json` - 9.2 item 351, LIVE-E50-06
- Clients: a GM and one player, LiveKit on · Theme: both · Priority: nit
- Recipe:
  1. At the table's own size, with the voice tile showing, as GM press the messenger button; shoot the roster against the tile
  2. Clear messengerWindowPositions for one player (or use a new player); open that thread as GM and as the player; record where it opens
  3. Repeat in the other theme
- Settles it: agrees if the roster lies on top and readable and the window does not hide the tile; a defect if the tile covers the roster or the window opens over the tile

### L1-471 - the module's Music slider and Foundry's playlist slider show one number
- Audit ref: `live-items-327.json` - 9.2 item 352, LIVE-E50-03
- Clients: a GM and one player · Theme: default · Priority: nit
- Recipe:
  1. Set the module's Music slider to 50
  2. Read game.settings.get('core', 'globalPlaylistVolume') and Foundry's playlist slider position
  3. Read typeof foundry.audio.AudioHelper.volumeToInput
  4. Move Foundry's slider to another value; reopen the Sound window; compare
- Settles it: agrees if the setting reads 0.3536 and both sliders show the same position both ways; defect on a mismatch

### L1-472 - the ruler's colour changes by itself at the hour's turn, and still reaches the line on 1.2.118
- Audit ref: `live-items-327.json` - 9.2 item 356, LIVE-E51-02
- Clients: a GM and one player · Theme: both · Priority: nit
- Recipe:
  1. As a player, drag the token with a planned path held; shoot the line
  2. The GM advances the time of day; without moving, shoot the line again
  3. Console: CONFIG.Token.rulerClass.name and its prototype chain; game.drpg.diagnosePatches() row token-ruler
  4. Repeat in Monokuma Legacy (bone)
- Settles it: agrees if the second shot has the new hour's colour without a move and the row reads ok; defect if the line keeps the old colour until the next move

### L1-473 - clicks and windows of the main flows at a table with Dice So Nice
- Audit ref: `live-items-327.json` - 9.2 item 360, LIVE-E51-06
- Clients: a GM and one player · Theme: default · Priority: nit
- Recipe:
  1. With Dice So Nice on, run a Search, a Hope Call, a Refund, one trial mode from the bar and a verdict with a Level Up, each from the file's 'from' state
  2. Count clicks and windows for the GM and the player
  3. Compare with audit/harness/flow-length.json and note each difference and its cause
- Settles it: agrees if each count equals the row or differs only by a Dice So Nice wait; a larger difference is a finding for the flow

### L1-474 - R1060 and R972 on a GM whose module Language is Polski
- Audit ref: `live-items-361.json` - 9.2 item 361, LIVE-E65-01
- Clients: one GM · Theme: default (the theme does not bear on it) · Priority: nit (a test's reading; no player-facing behaviour rests on it)
- Recipe:
  1. Foundry 14.370, the module at 1.2.118 or later; as the GM set Configure Settings > Danganronpa RPG > Language to Polski and reload.
  2. In the console run `await game.drpg.runTests()` (tiers 0-1, read-only).
  3. Copy the R1060 and R972 log lines and, if either is red, its whole error text.
- Settles it: settled yes when both are green and R1060 reads '0 found' and '0 config field(s) set and put back'; settled no when either is red, or R1060 had to set a config field on a client already in Polish

### L1-475 - the sheet root's lang and the English words left on a Polish client
- Audit ref: `live-items-361.json` - 9.2 item 363, LIVE-E66-02
- Clients: one player · Theme: default · Priority: nit
- Recipe:
  1. Foundry in English; the module Language set to Polski; reload.
  2. Open a student's character sheet; in the devtools read the `lang` of the sheet's root element.
  3. List every English word on the sheet and, for each, whether its element is inside a block the module adds or in Daggerheart's markup.
- Settles it: settled yes when the root reads `pl` and the list is written with its count; settled no when the root reads another language, or a module block shows English

### L1-476 - runtime colorsets and textures in the dice look's report
- Audit ref: `live-items-361.json` - 9.2 item 373, LIVE-E60-07
- Clients: GM and one player · Theme: default · Priority: nit
- Recipe:
  1. On the GM's page register a colorset and a texture at runtime (a small module or a console call to Dice So Nice's API) and use them in the GM's look.
  2. Run `game.drpg.diagnoseDiceLook()` on the GM and on a player page without them.
- Settles it: settled yes when the GM's report names neither as missing and the other page names both; settled no when the GM's report names them missing, or the other page does not

### L1-477 - the owner's verdict on the notice history's text sizes
- Audit ref: `live-items-361.json` - 9.2 item 382, LIVE-E44-06
- Clients: the owner (any seat) · Theme: stained glass · Priority: nit
- Recipe:
  1. Under Stained Glass at 100 % zoom open the notice history with entries, the search used and a card opened.
  2. The owner says whether the search, banner, footer and card text read well or need a change.
- Settles it: settled yes when the owner says no change is needed; settled no when the owner names a size to change

### L1-478 - why project tokens are white on the GM
- Audit ref: `live-items-361.json` - 9.2 item 383, LIVE-E44-07
- Clients: GM and one player · Theme: default · Priority: nit (the GM's screen alone; the document holds the right colour)
- Recipe:
  1. On the GM, a scene with a project token in a room; select any token.
  2. Run the item's console line and save the output (dyn, clones, each project's tint and alpha).
  3. Run `canvas.stage.children.find(c => c.name === "AlwaysVisibleContainer").visible = false` and look at the hammer.
  4. Run the same line on a player for comparison; also read `canvas.tokens.placeables.filter(t => t.document.getFlag("danganronpa-rpg", "projectId")).map(t => t.mesh.tint)` on both.
- Settles it: settled yes when the hammer takes its colour once the container is hidden (Isometric's clone is the cause); settled no when it stays white with dyn false (another cause; the two outputs go to diagnosis)

### L1-479 - the VirtualKeyboard API in the table's mobile browsers
- Audit ref: `live-items-361.json` - 9.2 item 389, LIVE-E21-03
- Clients: one player, several devices · Theme: default · Priority: nit
- Recipe:
  1. On each browser (Chrome or Edge, Safari, Firefox) on a tablet and a phone, open the world.
  2. Run `({ api: Boolean(navigator.virtualKeyboard), overlays: navigator.virtualKeyboard?.overlaysContent ?? null, h: innerHeight })` before and with the keyboard shown.
- Settles it: settled yes when each browser's row is written down (api, overlays, the heights); settled no when a browser with the API still loses page height with the keyboard up

### L1-480 - where red is drawn, at rest
- Audit ref: `live-items-361.json` - 9.2 item 391, LIVE-E22-02
- Clients: GM and one player · Theme: both · Priority: nit
- Recipe:
  1. Browser under 1224 px wide; each theme.
  2. As a player open Tamper (Reshape a Trace), the Direct Murder declaration and the critic after a reshape; screenshot.
  3. As the GM open GM Team (Despair Flow), Sound > Effects and Music, Doors, Fog with an uncovered map, the Mastermind window; screenshot.
- Settles it: settled yes when red stands only on the GM's road and on warnings, and the listed notes are neutral; settled no when red on a plain row, a header or a note, or a warning not red

### L1-481 - hover and focus colours on buttons
- Audit ref: `live-items-361.json` - 9.2 item 394, LIVE-E22-03
- Clients: one player · Theme: both · Priority: nit
- Recipe:
  1. Each theme, as a player, open Analyze and Tamper.
  2. Hover Cancel, the default button, a red row and a plain row; screenshot each.
  3. Tab across the footer; screenshot each focus.
  4. Under Stained Glass hover Delete, Revoke access, Clear the history and Safeword's Stop the scene.
- Settles it: settled yes when red appears only on the GM's road and irreversible answers, every hovered text reads, and Legacy's default ring is dice-coloured; settled no when red on a plain control, an unreadable hovered text, or a red focus ring

### L1-482 - Under Monokuma Legacy, the picked GM-road row in Analyze and the active kit tab.
- Audit ref: `live-items-395.json` - 9.2 item 396, LIVE-E22-05
- Clients: GM and one player · Theme: Monokuma Legacy · Priority: nit
- Recipe:
  1. Switch the theme to Monokuma Legacy on PlayerOne.
  2. Open Analyze, pick 'Ask for a hint'; screenshot the row and read its computed border-left-color and outline.
  3. As GM, open Room setup and Despair Flow; screenshot the tab bar and read the active tab's computed colour.
- Settles it: Agrees if the picked row shows both the red left edge and the gold frame and the active tab's red is the approved eye red, distinct from the GM-road red; a defect if the frame hides the edge.

### L1-483 - The Despair Flow window's frame, field edges and steppers under Stained Glass.
- Audit ref: `live-items-395.json` - 9.2 item 397, LIVE-E22-06
- Clients: GM · Theme: Stained Glass · Priority: nit
- Recipe:
  1. As GM under Stained Glass at 1366x768, open the GM panel's Despair Flow.
  2. Screenshot the window; read the computed box-shadow of the frame and border-color of an input and a stepper.
- Settles it: Agrees if the glow and edges are the hour's gold and the fields readable; a defect if they are the GM's red or a field's text fails contrast.

### L1-484 - A sized kit window's width over its first frames at slider 120 % and 80 %, and the room window's final width.
- Audit ref: `live-items-395.json` - 9.2 item 400, LIVE-E21-08
- Clients: GM (Observe also as a player) · Theme: Monokuma Legacy · Priority: nit
- Recipe:
  1. Set the Legacy theme and the window-scale slider to 120 %.
  2. Install a requestAnimationFrame logger of `getBoundingClientRect().width` on the next `.application.drpg-ui` added to body.
  3. Open Item tables, Observe and (at 390x844) the room description window; keep five frames each.
  4. Repeat at 80 %.
- Settles it: Agrees if each window's width is the same from the first logged frame; a defect if it changes after frame 1 (a visible jump).

### L1-485 - The corner's tilt over a session, and the owner's word on the 14.10 white strip.
- Audit ref: `live-items-395.json` - 9.2 item 406, LIVE-E23-05
- Clients: GM and one player; the owner · Theme: Stained Glass · Priority: nit
- Recipe:
  1. Under Stained Glass, read the three launchers' computed transform after each of: a messenger message, a scene change, a theme switch there and back, a window resize.
  2. Show the owner the GM's hexagon and ask whether the strip of 14.10 is gone.
- Settles it: Agrees if every transform keeps its rotation and the owner says the strip is gone; a defect if one straightens.

### L1-486 - The GM's expanded chat over the corner buttons, and its collapse.
- Audit ref: `live-items-395.json` - 9.2 item 407, LIVE-E23-06
- Clients: GM · Theme: both · Priority: nit
- Recipe:
  1. As GM with Foundry's window switch off, at both sizes, expand the chat; screenshot the corner.
  2. Read the launchers' rects before and after; read `document.getAnimations()` during a collapse, with and without reduced motion.
- Settles it: Agrees if the buttons stay put under the chat, nothing shows through and the collapse lasts about 0.18 s (none under reduced motion); a defect otherwise.

### L1-487 - Foundry's `#players` in the narrow layout on a GM's and a player's screen.
- Audit ref: `live-items-395.json` - 9.2 item 408, LIVE-E23-07
- Clients: GM and one player · Theme: both · Priority: nit
- Recipe:
  1. At 1200x800 and 1024x768, both themes: read `#players`'s computed display, position and its rect; screenshot the bottom-left.
  2. Read whether core's stylesheet sets display or position on it (the winning rule in DevTools).
- Settles it: Agrees if the GM sees one line on screen with content or nothing drawn at all, and the player none; a defect for an empty frame or core's rule winning.

### L1-488 - The event panel's size and scrolling with each card and two at once.
- Audit ref: `live-items-395.json` - 9.2 item 411, LIVE-E23-10
- Clients: GM and one player · Theme: both · Priority: nit
- Recipe:
  1. For each of the safeword card, an incident, a Class Trial and two together: read the panel's rect and its scroller's scrollHeight/clientHeight; screenshot.
  2. With Polish on, read the incident's two meta lines under Monokuma Legacy.
- Settles it: Agrees if the rect is the same for all and the lines read whole; a defect otherwise.

### L1-489 - The Projects tray's rows with real icons.
- Audit ref: `live-items-395.json` - 9.2 item 413, LIVE-E23-12
- Clients: GM and one player · Theme: both · Priority: nit
- Recipe:
  1. Seed six or more projects; under each theme, as GM and as a player, screenshot the tray.
  2. For each row compare the name's and counter's rect tops; hover '-' and '+' and read the tooltip; read the list's mask at the foot.
- Settles it: Agrees if every row is one line, both icons draw and the fade shows past five rows; a defect otherwise.

### L1-490 - The Backstory field's type and the inventory headings' face on a real sheet.
- Audit ref: `live-items-395.json` - 9.2 item 417, LIVE-E24-04
- Clients: one player · Theme: both · Priority: nit
- Recipe:
  1. For each theme, pixel font on/off, slider 80/100/140 %: read the Backstory textarea's computed font-family, font-size and line-height; Tab into it and screenshot the focus frame.
  2. Read `.dh-style h4`'s computed font-family in the inventory tab.
- Settles it: Agrees if the values follow the item's figures; a defect if the system's layer wins over the module's prose face.

### L1-491 - The lower-left corner (`#players`) under both themes after E23 fix L.
- Audit ref: `live-items-429.json` - 9.2 item 429, LIVE-E24-12
- Clients: GM and one player · Theme: both · Priority: nit
- Recipe:
  1. On the GM's and PlayerOne's page under Monokuma Legacy at 1541x1020, screenshot the lower-left corner.
  2. Read `getComputedStyle(document.querySelector('#players'))` for background, border, box-shadow, padding and `getBoundingClientRect()`.
  3. Repeat at 1366x768 and under Stained Glass.
  4. With the module disabled for one load, read the same properties to see what core's own sheet draws.
- Settles it: Agrees if no ground, edge or shadow shows in either theme and the box is the transparent padding the harness measured (about 22x28); a defect if a strip shows.

### L1-492 - Item tables' two tables at 1366x768 and the Keep mine answer.
- Audit ref: `live-items-429.json` - 9.2 item 434, LIVE-E46-04
- Clients: GM · Theme: both · Priority: nit
- Recipe:
  1. As GM at 1366x768, open Item tables; screenshot the pool list and a pool's entries in both themes.
  2. Delete the last table of the list; screenshot what the window shows.
  3. Press Install / reinstall on a world that holds every table and answer Keep mine; read the notice's class and `ui.sidebar.activeTab`.
- Settles it: Agrees if no column overlaps or leaves the window, the next table or the empty state shows, the notice is info and the sidebar stays on chat; a defect otherwise.

### L1-493 - Polish labels cut without a tooltip in the E46 windows.
- Audit ref: `live-items-429.json` - 9.2 item 437, LIVE-E46-07
- Clients: GM · Theme: both · Priority: nit
- Recipe:
  1. Set the GM's language to Polish; at 1366x768 and 1920x1080 in both themes open each window the item lists.
  2. Run on each: `[...document.querySelectorAll('.application.drpg-ui *')].filter(e => e.scrollWidth > e.clientWidth + 1 && !e.title && !e.dataset.tooltip).map(e => e.textContent.trim())`.
  3. Screenshot the chapter-end and season-reset warnings.
- Settles it: Agrees if the list is empty and the warnings sit in the kit's warning box; a defect for each cut label.

### L1-494 - The GM panel's tiles' looks in an Eclipse with an incident.
- Audit ref: `live-items-429.json` - 9.2 item 440, LIVE-E47-03
- Clients: GM and two players · Theme: both · Priority: nit
- Recipe:
  1. Start an Eclipse and open an incident; as GM open the GM panel at 1366x768 and 1920x1080.
  2. Press the Murder tile; read which window opens.
  3. Hover a disabled tile; screenshot its edge and tooltip; screenshot the current phase's tile and the Diagnostics section in both themes.
- Settles it: Agrees if Murder opens the tracker, a disabled tile is dashed with its reason and the current tile's icon reads; a defect otherwise.

### L1-495 - The module's section in Foundry's settings window and the Give back window on v14's sheet.
- Audit ref: `live-items-429.json` - 9.2 item 443, LIVE-E47-06
- Clients: GM · Theme: both · Priority: nit
- Recipe:
  1. As GM at 1366x768, open Configure Settings > Danganronpa RPG in both themes and languages; screenshot.
  2. Read `getComputedStyle` of a checked checkbox and a focused button, and list the custom properties core's sheet sets on them (`[...document.styleSheets]` rules naming checkbox or focus).
  3. Read the section's element and class names.
  4. Open Give back Foundry settings; screenshot.
- Settles it: Agrees if labels sit on one line in one column, no amber shows and v14's variables are the two the module sets; a defect if v14 uses other names (the module's colour then missing).

### L1-496 - The theme classes v14 puts on the interface and the two Foundry windows' frames, and their ink.
- Audit ref: `live-items-429.json` - 9.2 item 444, LIVE-E47-07
- Clients: GM · Theme: both · Priority: nit
- Recipe:
  1. As GM, set Foundry's interface to dark and applications to light; open Foundry tools and Map tools.
  2. Read `document.body.className`, `#interface` classes and each frame's `className`; read `getComputedStyle(frame).color` and background.
  3. Screenshot both; swap the two Foundry settings and repeat; repeat under the other module theme.
- Settles it: Agrees if the frames carry the module's ground and ink in every combination; a defect if light text on a light ground (or dark on dark) shows.

### L1-497 - The case panel's Table tabs under Legacy: the view's sideways scroll and the heads' breaks.
- Audit ref: `live-items-429.json` - 9.2 item 446, LIVE-E47-09
- Clients: GM · Theme: Monokuma Legacy · Priority: nit
- Recipe:
  1. As GM under Monokuma Legacy at 1366x768 and 1920x1080, open Investigation and switch to the Table; visit Remnants, Key Remnants and Who has what.
  2. Read the window's and each table's `getBoundingClientRect().width` and `.drpg-case-view` `scrollWidth`/`clientWidth`; screenshot.
  3. For each `thead th` compare the widest word's width with the cell (a Range over each word) to find a mid-word break; repeat in Polish and without the pixel font.
- Settles it: Agrees if the window never scrolls sideways, the view does, and no head breaks inside a word; a defect if the window grows or a head breaks mid-word.

### L1-498 - Polish labels cut without a tooltip in the E47 windows.
- Audit ref: `live-items-429.json` - 9.2 item 447, LIVE-E47-10
- Clients: GM · Theme: both · Priority: nit
- Recipe:
  1. As GM in Polish at 1366x768 and 1920x1080, both themes, open each window the item lists.
  2. Run the overflow filter of item 437's recipe in each; screenshot.
- Settles it: Agrees if no label is cut without a tooltip; a defect for each one.

### L1-499 - The grey disabled role buttons under the glass, Room setup's Searching table at 1024x768, and Analyze's field edge at 1366x768.
- Audit ref: `live-items-429.json` - 9.2 item 452, LIVE-E47-11
- Clients: GM and one player · Theme: both · Priority: nit
- Recipe:
  1. Under Stained Glass at 1366x768, open The vote before sending ballots and the console with no Mastermind; screenshot the footers; repeat under Legacy.
  2. Set the browser window to 1024x768; open Room setup > Searching in both themes and languages; read the window body's and the table's `getBoundingClientRect().width` and the place column's width; screenshot.
  3. As PlayerOne open Analyze with the request field empty at 1366x768; screenshot its right edge.
- Settles it: Agrees if the disabled buttons are grey and faded under the glass only, the table is no wider than the body and the field's edge shows; a defect if the table overflows (the 9rem floor) or a switch leaves its column.

### L1-500 - The action windows' layout and selected row at 1366x768 with Foundry's sheet.
- Audit ref: `live-items-429.json` - 9.2 item 461, LIVE-E68-04
- Clients: one player · Theme: both · Priority: nit
- Recipe:
  1. As PlayerOne at 1366x768, open Observe, Search and the crisis menu in both themes and languages; screenshot each.
  2. Read each window body's `scrollHeight` against `clientHeight`.
  3. Hover, focus and select rows; screenshot; under Legacy read whether an `input[type=radio]` is painted (`getComputedStyle(input).appearance`, its box).
- Settles it: Agrees if Observe and the crisis menu do not scroll and the selected row reads apart from the others; a defect if a field is shifted or the body scrolls.

### L1-501 - Clicks and milliseconds from the tile to the roll for Search on Eye, Search on Head and Dynamic, on today's version.
- Audit ref: `live-items-429.json` - 9.2 item 462, LIVE-E68-05
- Clients: GM and one player · Theme: default · Priority: nit
- Recipe:
  1. As PlayerOne run `game.drpg.traceClicks()`.
  2. Search on Eye; record the clicks and ms to the roll.
  3. Search on Head; the GM answers the card; record clicks and ms (and the GM's ms to answer).
  4. A Dynamic action; record the same; read traceClicks' report.
- Settles it: Agrees if Search on Eye rolls with no card and within about 500 ms of the last click; a defect if Eye waits on a card.

### L1-502 - How a Spectator's token reads on a GM's map.
- Audit ref: `live-items-493.json` - 9.2 item 499, LIVE-E92-04
- Clients: GM and two players · Theme: both · Priority: nit
- Recipe:
  1. As GM on a scene with a light and a dark floor, place a Spectator's token beside a student's on each.
  2. Screenshot at the default zoom in Stained Glass and in Monokuma Legacy; read `token.mesh.alpha`.
  3. On another player's page read `token.visible`; on the owner's page screenshot it.
- Settles it: Agrees if the owner judges it findable and not a student, alpha reads 0.3 x the document's, other players do not see it; a defect if it vanishes on one floor or reads as a student.

### L1-503 - The clock's turns as drawn, Escape, and their frame cost.
- Audit ref: `live-items-493.json` - 9.2 item 503, LIVE-E62-01
- Clients: GM and one player · Theme: both · Priority: nit
- Recipe:
  1. As GM run `await game.drpg.fps({ toChat: false })` and advance the hour; then a new day, a rewind, an Eclipse in and out, the Investigation, a body announced, the trial's end.
  2. Note each turn's direction by eye or recording; count the Investigation's flashes per second.
  3. Press Escape mid-turn: the curtain at its end state at once.
  4. Advance twice within one second: the curtain ends on the second state.
  5. Repeat as a player and under the other theme.
- Settles it: Agrees if every direction is as listed, flashes stay at or under three a second, Escape and the double change behave and frames hold; a defect otherwise.

### L1-504 - Foundry's tooltip on module controls, and on a disabled button.
- Audit ref: `live-items-493.json` - 9.2 item 508, LIVE-E102-01
- Clients: GM and one player · Theme: both · Priority: nit
- Recipe:
  1. Open Dynamic Action and hover Difficulty; open Sound and hover Play and Reset music; open the table editor and hover Delete table: screenshot each tooltip.
  2. With no track chosen, hover the disabled Play: record whether #tooltip shows and what the button's title shows.
  3. Repeat in Polish and under the other theme, as GM and as a player.
- Settles it: Agrees if each tooltip appears placed clear of its field and a disabled button shows only the browser's title; if Foundry's tooltip does show on a disabled button, the kit's assumption is wrong (a nit).

### L1-505 - The held curtain against the opening's first frame, at a table.
- Audit ref: `live-items-493.json` - 9.2 item 524, LIVE-113R-02
- Clients: GM and one player · Theme: Stained Glass · Priority: nit
- Recipe:
  1. Stained Glass, 1366x768; record the screen (or shoot every 50 ms) while entering the trial with a slow scene as in 523.
  2. Compare the frame at about 900 ms with the first opening frame: pane positions and pixels.
  3. Watch the 400 ms cross-fade at the end with the HUD's trial row changing under it; owner judges.
  4. Repeat at 1920x1080, as a player, and for the exit.
- Settles it: Agrees if no pane moves between hold and opening and the owner accepts the cross-fade; a defect for a jump, or a cross-fade the owner rejects.

### L1-506 - The handbooks window on a real tablet.
- Audit ref: `live-items-527.json` - 9.2 item 531, LIVE-E57-03
- Clients: GM on a tablet · Theme: either · Priority: nit
- Recipe:
  1. On a tablet (iPad or Android, 820x1180 portrait), log in as GM.
  2. Open the handbooks from the corner; scroll the contents and the text.
  3. Open the GM panel's "?"; then follow a 'section N' link; screenshot each landing.
  4. Open the on-screen keyboard (the handbook's search, if any) and repeat one jump.
- Settles it: Agrees if the window fits and every jump leaves the heading visible under the top; a defect if a part is off-screen or a heading lands under the bar or keyboard.

### L1-507 - The trial curtain's hand-back on a stalling main thread.
- Audit ref: `live-items-527.json` - 9.2 item 533, LIVE-R4420-01
- Clients: GM and one throttled player · Theme: Stained Glass · Priority: nit
- Recipe:
  1. Stained Glass; one player's browser with devtools Performance > CPU 6x slowdown.
  2. GM starts a Class Trial; record the player's screen at 60 fps (screen capture) through the entry's last second.
  3. GM ends the trial; record the exit the same way.
  4. Step through the last 500 ms frame by frame: any frame darker than both neighbours, or the glass's position jumping.
- Settles it: Agrees if no frame in either hand-back darkens or jumps; a defect if one does.

### L1-508 - Which of twelve Foundry ids v14 draws.
- Audit ref: `live-items-527.json` - 9.2 item 541, LIVE-E55-04
- Clients: GM and one player · Theme: either · Priority: nit
- Recipe:
  1. As GM: pop the chat out, turn performance stats on, open a context menu and a combat popout if available.
  2. Run `['#chat-log','#context-menu','#performance-stats','#players-active','#players-inactive','#resource-fear','#combat-popout','#effects-display','#effects-panel','#scene-navigation','#chat-popout','#loading-bar'].map(s => [s, !!document.querySelector(s)])`.
  3. Repeat as a player; also during a scene load for #loading-bar.
- Settles it: Settled either way by the list: an id absent on both is a rule that can go; nothing here is a defect.

### L1-509 - Whether the Eclipse's sounds and the day boards' chimes sound together.
- Audit ref: `live-items-527.json` - 9.2 item 546, LIVE-E110-05
- Clients: GM and one player · Theme: either · Priority: nit
- Recipe:
  1. Map four distinct files to eclipseStart, eclipseEnd, dayStart and dayEnd.
  2. On a player wrap `foundry.audio.AudioHelper.play` to log (src, performance.now()).
  3. GM starts an Eclipse; then ends it with a time-of-day change that raises the day boards.
  4. Read the log: two plays within about 300 ms of each other.
- Settles it: Agrees if no two of the four play together; a defect (to be fixed by `yieldsTo` on the Eclipse keys) if they do.

### L1-510 - `options._priorRegions` on a real move.
- Audit ref: `live-items-561.json` - 9.2 item 640, LIVE-E39-02
- Clients: GM and two players · Theme: default · Priority: nit
- Recipe:
  1. On the GM's and PlayerTwo's page: `Hooks.on('updateToken', (d, c, o) => console.log(JSON.stringify(o._priorRegions)))`.
  2. PlayerOne moves Aiko by `move([...])` from Dorm A to the Cafeteria.
  3. Copy the logged value on both pages.
- Settles it: Agrees if it is `{ [tokenId]: [ids before] }`; a defect in the harness's model otherwise (no module code is touched).

### L1-511 - The order and arguments of the movement hooks, and a refused preMoveToken.
- Audit ref: `live-items-561.json` - 9.2 item 641, LIVE-E39-03
- Clients: GM and two players · Theme: default · Priority: nit
- Recipe:
  1. On the mover's page wrap `Hooks.on` for preMoveToken and preUpdateToken with a counter that logs order and `arguments.length` and argument types; on the GM and a bystander the same for moveToken and updateToken.
  2. PlayerOne moves Aiko by `move([...])`.
  3. Then `Hooks.once('preMoveToken', () => false)` and move again; read whether updateToken fires anywhere and where the token stands.
- Settles it: Agrees if the order is the shim's and false cancels; a defect in the harness's model otherwise.

### L1-512 - The waypoints of a displacement.
- Audit ref: `live-items-561.json` - 9.2 item 643, LIVE-E39-05
- Clients: GM and two players · Theme: default · Priority: nit
- Recipe:
  1. On the GM's page log `o._movement[id].passed.waypoints` in updateToken.
  2. As GM `t.move({x, y, action: 'displace'})` across two rooms; then the module's own `t.update(to, {teleport: true, movementAction: 'displace', animate: false})`.
  3. Copy each list's length and each point's action, intermediate and checkpoint.
- Settles it: Agrees if each is one point; a defect in the harness's model if grid steps come.

### L1-513 - `TokenDocument#movement` after an update that moves nothing.
- Audit ref: `live-items-561.json` - 9.2 item 645, LIVE-E39-07
- Clients: GM and two players · Theme: default · Priority: nit
- Recipe:
  1. Move Aiko by `move([...])`; read `JSON.stringify(t.movement?.passed?.waypoints?.length)` on the GM.
  2. Write `t.update({name: t.name + ' '})` (then back); read `t.movement` again on the GM and a player.
- Settles it: Agrees if null or empty after; a defect in the harness's model if the last move stays.

### L1-514 - The values of the movement record's other keys.
- Audit ref: `live-items-561.json` - 9.2 item 646, LIVE-E39-08
- Clients: GM and one player · Theme: default · Priority: nit
- Recipe:
  1. After a `move([...])` of Aiko, on the GM: `JSON.stringify(Object.fromEntries(['subpathId','chain','history','split','constrained','recorded','constrainOptions','terrainOptions','measureOptions','autoRotate','showRuler','updateOptions','finished','animation'].map(k => [k, t.movement?.[k]])))`.
- Settles it: Read when the values are recorded; nothing in the module rests on them.

### L1-515 - `move()` and the caller's options object.
- Audit ref: `live-items-561.json` - 9.2 item 657, LIVE-E39-19
- Clients: GM alone · Theme: default · Priority: nit
- Recipe:
  1. As GM on a scratch token: `const o = {}; await t.move([{x: 400, y: 300}], o); console.log(JSON.stringify(Object.keys(o._movement ?? {})));`
  2. `await t.move([{x: 500, y: 300}], o)`; note a throw and the answer of each call.
  3. Delete the token.
- Settles it: Agrees with the shim if the second move() does not throw and `o` stays empty; if it throws, the shim's move() must define the record on the caller's object as update() does.

### L1-516 - The Facilities window's rest rows, refusal, free line, description and grey print at a table, and the owner's impression.
- Audit ref: `live-items-561.json` - 9.2 item 662, LIVE-F118-03
- Clients: GM and one player · Theme: both · Priority: nit
- Recipe:
  1. As GM mark for rest PlayerOne's bedroom, an ownerless room and two other bedrooms; give PlayerOne the key of one.
  2. Stand Aiko in a room with no rest; open Facilities in English and Polish, both themes, 1366x768 and narrow; screenshot each.
  3. Choose a rest anyway; read the refusal's room list.
  4. Take a rest where allowed, open Facilities again; read the line. Open a completed project's free action; read 'Free.'.
  5. Show the owner the shots and the window; record his word.
- Settles it: Agrees if every row reads as the item says and the owner finds the grey print readable; a defect otherwise.

### L1-517 - Text cut or overflowing in the module's windows at narrow widths, and the module's themes over Foundry 14's light interface theme
- Audit ref: `old-1.2.13-B-livefindings.json` - OA-2
- Clients: GM and 1 player · Theme: both · Priority: nit
- Recipe:
  1. Set Foundry's interface theme to light (Configure Settings > Core).
  2. At a 1366x768 window, open the GM panel, the Investigation Dashboard, the trial console, a character sheet and the messenger, under Stained Glass, then Monokuma Legacy.
  3. Screenshot each; note any text cut, any control off its window, and any light-theme colour showing through.
  4. Repeat on a player's seat for the sheet and the messenger.
- Settles it: Settled fixed if nothing is cut and no Foundry light colour shows through; open (nit or minor by the window) for each window that shows it.

### L1-518 - frame cost of the dashboard's rebuild during play
- Audit ref: `old-1.2.13-C-H.json` - not_established
- Clients: GM plus two players · Theme: both · Priority: nit
- Recipe:
  1. Open the Investigation Dashboard on the GM with a chapter of 30+ Remnants and 10+ Truth Bullets.
  2. Run `await game.drpg.fps({ toChat: false })` while a player moves a token and another uses an item.
  3. Repeat with the dashboard closed; compare the slowest twentieth and the module's counters.
- Settles it: no difference over the frame budget: D1 closed; a drop with the dashboard open: D1 open as minor

### L1-519 - perceived lag of a button sound with yieldsTo
- Audit ref: `old-1.2.13-C-H.json` - not_established
- Clients: one player · Theme: default · Priority: nit
- Recipe:
  1. On a player, press a sheet tile that opens a window, ten times.
  2. Note whether the click sound comes with the window or after it; repeat on a slow machine.
- Settles it: the sound lands with the window: no lag, D5 closed; a felt gap: D5 open as nit

### L1-520 - surfaces per event for a player
- Audit ref: `old-1.2.13-C-H.json` - not_established
- Clients: GM plus one player · Theme: both · Priority: nit
- Recipe:
  1. As a player, take a Search, an Observe and a Rest.
  2. For each, list what appeared: chat card, popup, toast, sound.
  3. As the GM, list what reached the GM for each.
- Settles it: one popup and one chat record per event and no done-toast: E1 holds; a toast beside a card: E1 open as nit

### L1-521 - Whether Polish text fits its places in both themes
- Audit ref: `old-1.2.42-tasks.json` - not_established
- Clients: a GM and one player · Theme: both · Priority: nit
- Recipe:
  1. Set the module language to Polski in the DRPG Settings window on one player and the GM, reload
  2. At 1920x1080 and 1366x768, open a student sheet, the HUD, the status strip and the GM panel under Stained Glass, then Monokuma Legacy
  3. Note every label cut, wrapped past its box or shrunk by fitTileText below the readable floor
- Settles it: fixed if nothing is cut or unreadable at both sizes in both themes; open with each place that is

### L1-522 - Two reaches of one stash at the same moment
- Audit ref: `stages-09.json` - not_established
- Clients: one or two GMs, two players · Theme: default · Priority: nit
- Recipe:
  1. Two students A and B of two players stand in a room where C's stash is open to both
  2. Both players open the rifle window and press Take within the same second
  3. Read both players' cards and C's stash; repeat with a second GM connected
- Settles it: {'agrees': 'each thief takes one thing once this time of day, the second reach of the same thief refused', 'defect': 'one thief takes twice in one time of day, or a reach that moved nothing is still counted'}

### L1-523 - Escape on an open case-map node with All open off
- Audit ref: `stages-18.json` - not_established
- Clients: GM · Theme: default · Priority: nit
- Recipe:
  1. Open the Investigation panel on the Map; switch All open off.
  2. Click a node to open it; press Escape.
  3. Note whether the node closes and whether the window stays open.
- Settles it: Node closed, window open: E97's promise holds; window closed: Foundry hears Escape first.

