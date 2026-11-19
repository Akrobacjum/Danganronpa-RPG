# The README chapter "What a player with a console always sees"

E43's plan (item 4) puts this chapter in the root README.md. Drafted on 13.11.2026 (C6, 736e55eb) while this line could
not edit that file; placed on 16.11.2026 by the line claude/e43-117, on the owner's consent of that day (the chapter
alone, after the **Privacy.** paragraph, as a bold lead like the paragraphs around it), after every sentence was read
again against the code and audit/harness/known-leaks.json on ff3e12e5 (1.2.116). What changed from the draft, and why, is
in [STATUS.md](STATUS.md), "The line claude/e43-117". The text below is the README's, word for word; the README is the
one to edit, and this copy follows it.

---

**What a player with a console always sees.** A player who opens their browser's
console can read everything Foundry sent that browser, whatever the screen
draws. For a GM who has not met this module before, that is:

- every token on every scene, hidden or not, with its name, position and flags,
  and every move it makes. So where the Remnants lie, and a token that crosses a
  secret passage's wall or goes through a tunnel, are seen; each Remnant's note
  and what it really is are not. A killer behind a "?" wears the module's "?"
  picture, but their token still points to their character, and while a direct
  murder's opening waits the killer's tokens are hidden and carry the veil's
  mark, so a console can tell whose they are;
- every scene's regions, walls and their flags. So a room whose only way in is a
  secret passage is seen, and so are Foundry's own secret doors, which a console
  can also open (the GM's browser shuts them again); the module's secret
  passages, and who knows them, are not;
- every character's sheet: its traits, Hope and other resources, and its items
  with their names, whoever carries them. So a Monocub's move paid from its
  purse is seen as actions spent and no Hope; who paid, and what the purse
  holds, are not;
- every chat message, rolls and whispers included, which is why the module's
  private cards hold a stub and their words reach only their readers;
- during a Class Trial, the trial's list of the dead, a death nobody has found
  yet among them (the silenced microphones tell the table the same).

What stays on the GMs' browsers and is sent only to the people it concerns: who
the Mastermind is, who is in a running murder beyond what the killer's tokens
above say, what an ordinary Remnant really is, how people voted, the GMs' own
notes, and of a secret project its name, who proposed it, who is in on it, its
condition, its description and its room action. A request from a player's
console that the module did not offer that player - one naming another
player's character, a GM's own action, or a packet of junk - changes nothing
on the GM's browser that is not the sender's own. It is refused there, and the
player is told why wherever their browser waits for an answer; a junk note of
their own is saved as their note, in plain text. The module's own test
harness sends every request the GM's browser judges that way from a player's
browser, and checks each. A player who goes looking behind the curtain finds
what the list above says.

---

## Sources (read on ff3e12e5, 16.11.2026)

| Sentence | Source |
| --- | --- |
| every token, hidden or not, its name, position and flags, its moves; the Remnants' places seen, a Remnant's note and subject not | known-leaks `foundry-hidden-tokens`, `S17-64`, `foundry-passage-crossing`, `foundry-passage-tunnel`; `foundry-veiled-token-actor` for the flags |
| a killer behind a "?": the module's "?" picture, the token still the killer's character | known-leaks `foundry-masked-token-actor`; E112 (1.2.116): mask-gm.mjs `MASK_IMG`, icons/mask-unknown.svg, on the token, its ring and the portrait (the 1.2.116 notes, "The mask's own "?"") |
| the veiled opening: the killer's tokens flagged (hidden as well until E112v), resolved by a console | known-leaks `foundry-veiled-token-actor` (E112, 1.2.116; scenario 21; E112v: no `hidden`, the flag alone) |
| regions, walls, flags; a room only a passage reaches; Foundry's secret doors seen and opened, shut again by the GM's browser; the module's passages and their knowers not | known-leaks `foundry-passage-only-room`, `foundry-secret-door-type`; README.md's Privacy paragraph |
| every character's sheet: traits, Hope, resources, items with their names | known-leaks `foundry-actor-items`; `foundry-cub-purse`'s foundryLimit ("every Actor document, its resources among them") |
| a Monocub's purse: the move seen, the payer and the purse not | known-leaks `foundry-cub-purse` (scenario 33 A21b) |
| every chat message, rolls and whispers included; private cards hold a stub | README.md's Privacy paragraph ("like every chat message they reach every browser", "private messages reach only their readers"); scripts/secret.mjs (a private card's document holds a stub) |
| the trial's list of the dead, an unfound death among them | known-leaks `TR30`: a foundryLimit since the owner's TR30 = 2, so the line stays |
| who the Mastermind is, who is in a running murder, what an ordinary Remnant is, the votes, the GMs' notes | README.md's Privacy paragraph; gm-stores.mjs `ballotStore`, the stores `notes` and `note`; world-secrets.mjs `WORLD_SECRET_RULES`, gm-store.mjs `SECRET_FIELDS` (E43 C3); scenario 72's canary |
| "beyond what the killer's tokens above say" | the two token leaks above: who is in a running murder is the GMs', except the killer's token as a console reads it |
| a secret project's name, proposer, insiders, condition, description and room action | projects-secrecy.mjs `PROJECT_SECRET_FIELDS` (`secretName`, `by`, `viewers`, `condition`; S17-31, E93, 1.2.111), its description and `facility` kept in the GMs' store while secret; the room action to insiders on the sight copy (P1, 2832f8e4); a sealed repair's end card names the target to each reader as they may read it (E43-F11, 8f1178bd) |
| a request not offered is refused, told where waited on, and changes nothing not the sender's own; a junk note saved as text | E43's fuzz (scenario 30; audit/harness/lib/fuzz.mjs reads the four tables off the GM's module) and matrix (scenario 33 H) - FINDINGS.md E43-F5 (`note.save`: the sender's own note saved from the junk as text), E43-F6; the quiet refusals that tell nobody, a declaration marked `quiet` (bridge-guards.mjs `refuse`, which tells the asker only when the declaration is not quiet) |
