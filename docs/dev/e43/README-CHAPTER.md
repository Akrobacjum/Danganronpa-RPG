# Draft: the README chapter "What a player with a console always sees"

E43's plan (item 4) puts this chapter in the root README.md. This line may not edit that file (the coordinator's
rules), so the text is here, ready to be placed after the **Privacy.** paragraph, as its own `###` heading or a bold
lead like the paragraphs around it. Every sentence names its source in the table under it; nothing here is new
behaviour. Dashes are `-`. The chapter's words were not run through the text lint (`node tools/check.mjs text`
reads the files the module serves, not this draft).

---

**What a player with a console always sees.** A player who opens their browser's console can read everything Foundry
sent that browser, whatever the screen draws. For a GM who has not met this module before, that is:

- every token on every scene, hidden or not, with its name and position, and every move it makes - so where the
  traces lie, and a token that crosses a secret passage's wall or goes through a tunnel, are seen; each trace's note
  and what it really is are not;
- every scene's regions, walls and their flags - so a room whose only way in is a secret passage, and Foundry's own
  secret doors, are seen; the module's passages, and who knows them, are not;
- every character's items, with their names, whoever carries them;
- every chat message, whispers included - which is why the module's private cards hold a stub, and their words reach
  only their readers;
- during a Class Trial, the trial's list of the dead (the silenced microphones tell the table the same).

What stays on the GMs' browsers and is sent only to whom it concerns: who is in a running murder, who the Mastermind
is, what an ordinary trace really is, how people voted, a secret project's builder, condition and plan, and the GMs'
own notes. A player's console that sends the GM's browser a request the module did not offer it - another player's
character, a GM's own action, or a packet of junk - is refused there, told why, and changes nothing; the module's own
test harness sends every request it knows that way, and checks it. It is still a curtain and not a wall: a player who
goes looking behind it finds what the list above says.

---

## Sources

| Sentence | Source |
| --- | --- |
| tokens, hidden or not, positions and moves; traces' notes not | audit/harness/known-leaks.json `foundry-hidden-tokens`, `S17-64`, `foundry-passage-crossing`, `foundry-passage-tunnel` |
| regions, walls, flags; passage-only room; secret doors | known-leaks `foundry-passage-only-room`, `foundry-secret-door-type`; README.md's Privacy paragraph |
| items | known-leaks `foundry-actor-items` |
| chat messages and private cards | README.md's Privacy paragraph ("private messages reach only their readers"); scripts/secret.mjs (a private card's document holds a stub) |
| the trial's list of the dead | known-leaks `TR30` (closes E72; while open, this line stays) |
| what stays with the GMs | README.md's Privacy paragraph; scripts/world-secrets.mjs `WORLD_SECRET_RULES` and gm-store.mjs `SECRET_FIELDS` (E43 C3); scenario 72's canary |
| a request not offered is refused and told | E43's fuzz (scenario 30) and matrix (scenario 33 H) - docs/dev/e43/FINDINGS.md E43-F5, E43-F6 |

Two lines depend on stages not on this branch: a secret project's name and who is in on it leave Daggerheart's
Countdowns only with S17-31 (the E93 branch, 1.2.111) - until then the list above must add "a secret project's name and
its ownership map"; and TR30's line goes when E72 closes it.
