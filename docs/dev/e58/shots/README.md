# Shots for the auditor (E58 L1)

Taken on the owner's sandbox (Foundry 14.370, Daggerheart 2.12.9, the module at 1.2.116 with this line's working
tree), 16.11.2026, by Playwright's headless Chromium 141 at 1366x768 - software rendering, so the canvas's look is
the CPU's, not a GPU's. Every page also shows Foundry's red notice that Chromium 141 is older than the 146 it wants
(the runner's browser, not the module). The auditor judges each against the line beside it; neither this line nor
the owner does.

| File | What it should show |
| --- | --- |
| e30-10-tier2-dialog.png | the window `game.drpg.runTests({ tier: 2 })` opens: its title names the world ("Tier 2 writes to DRPG QA Gate"), its text the world's title and id, Cancel first and focused, "Run tier 2 on DRPG QA Gate" second |
| e43-02-countdowns-member.png | Daggerheart's Countdowns window on the browser of a player in on a secret project: the project's real name ("Poisoned Punch L1 probe"), its progress unknown ("? / 4") |
| e43-02-countdowns-bystander.png | the same window on a player not in on it: "No projects yet." - no name, no "???" row |
| e43-03-card-before-entry-<theme>-<language>.png | a project token's card opened by PlayerOne while the project's room (the Gym) is undiscovered: "A project / You do not know what this is." (Polish: "Projekt / Nie wiesz, czym to jest."), nothing named - in Stained Glass and Monokuma Legacy, English and Polish |
| e43-03-card-after-entry-<theme>-<language>.png | the same card, never closed, after Aiko walked into the Gym: the project's name, description, Progress 0 / 4, Room Gym (Polish: Postęp, Pokój) |
| e112-01-victim-before-opening.png | the victim's (PlayerOne's) map while the killer's opening waits: Dorm A with Aiko alone - no token of Chie's - and no incident look (no curtain, no event panel) |
| e112-01-killer-before-opening.png | the killer's (PlayerThree's) map at the same moment: Chie's own token drawn |
| e112-04-victim-after-hope-opening.png | the victim's map after the killer's opening on Hope: in Dorm A, beside Aiko, the killer's token drawn as the module's "?" disc (icons/mask-unknown.svg), no face; the incident's card "Face to face / Aiko Hoshino" and the notice "Someone is moving on you ..." naming nobody |
| e112-04-bystander-after-hope-opening.png | a bystander in another room: no token of the killer's drawn (another room), no name anywhere |
| e112-04-killer-after-hope-opening.png | the killer's own map: their token as the same "?" disc (the mask's look reaches the killer's own browser too, as E112 item 2 says of the sheet) |
| e112-explore-p3-opening.png, e112-explore-p3-opening-unpaused.png, e112-control-p3.png | working shots of the killer's screen while the opening waited (the world "On hold" in the first: Foundry starts a world paused); kept as the record of the first runs, nothing to judge |
| e112-05-player-silhouettes-gpu.png, e112-05-control-visible-token.png | PlayerOne's map with Isometric Perspective's "Token Silhouette" on (GPU mode) and a scratch occluding tile: no silhouette sprite was built at all, for the hidden token or the visible one - so these show no silhouette and settle nothing (LOCAL-REPORT step 7) |
| e06-01-victim-after-failed-opening.png | the victim's screen after a failed opening: no incident look, no event panel; its chat holds three veiled cards and Foundry's "GM privately rolled some dice" stub |
| e06-01-victim-after-hope-success.png | the victim's screen after a successful opening on Hope: the incident look and its card, no name of the killer |
