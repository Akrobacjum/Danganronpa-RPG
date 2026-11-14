# README draft for E26 (1.3.0), for the owner to approve

Written 14.11.2026 on claude/e26-prep against the README at 1463f22b. The root README is the owner's, so nothing here
is in it yet: each block below says where it would go, what it replaces, and what in the code it was read from. The
English follows docs/text-style.md (result first, the reader addressed, one name per mechanic, the settings by the
names the settings window shows). Nothing below was checked at a table; where a sentence rests on another module's
behaviour that this repository does not hold, the source line says so.

## 1. Installation: why the three modules are required

**Where:** README.md, "## Installation", directly under the module table (after the "| [LiveKit AVClient] ..." row and
before "The module is developed and played on The Forge."). **Replaces:** nothing. The table's "What it is for" column
stays as it is.

> **Why they are required.** Every roll in this game is thrown as Dice So Nice's 3D dice and shown only to the people
> allowed to see it: a player's roll to that player and the GMs. The module does not show a roll any other way, so
> without Dice So Nice nobody sees the dice. The school's maps are drawn for Isometric Perspective and look wrong on a
> flat grid. Voice follows the rooms through LiveKit: you hear the people in your character's room, and a move to
> another room changes who hears you. That needs a LiveKit server, set up in LiveKit AVClient's own settings; the
> module does not check that the server answers.

Read from: module.json `relationships.requires[].reason` and lang/en.json `DRPG.Requirements.reason.*` (the three
reasons); scripts/requirements.mjs header (required means installed and switched on; no server is asked);
scripts/settings.mjs `forcePrivateRolls` and its hint (player rolls whispered to the player and the GMs). "The module
does not show a roll any other way" is the requirements header's "The dice everyone watches are the module's own idea
of a roll"; it was not measured with Dice So Nice switched off, because the module does not start then. "Set up in
LiveKit AVClient's own settings" is how that module is configured, not read in this repository (its source is not
here).

## 2. Technical notes: what the GM sets for everyone

**Where:** README.md, "## Technical notes", a new paragraph after "**House rules.**" and before "**Privacy.**".
**Replaces:** nothing.

> **What the GM sets for everyone.** Some settings belong to every browser, and the module holds them for the whole
> table, so players do not have to set them. They are in the module's settings window (the gear in the corner),
> under Game settings, and each is on by default:
>
> - **Dice look for the table** (Rolls and privacy): every player and Assistant GM throws in one full Gamemaster's Dice
>   So Nice look, so a roll looks the same on every screen. Each player's own look is not kept; "Each player's own"
>   turns it off.
> - **Voice inside the Foundry window for everyone** (Foundry and the system): voice runs in the Foundry window, never
>   in LiveKit's separate tab. A change takes a reload.
> - **Voice tile instead of the camera dock** (Voice): Foundry's camera dock is hidden for everyone and no camera pops
>   out. A tile shows the face and name of whoever you hear speaking. Off, everyone gets the dock back as it was.
> - **Keep Isometric Perspective's welcome window closed for everyone** and **Keep Daggerheart's welcome window closed
>   for everyone** (Foundry and the system): neither welcome opens, for players or GMs.
> - **Keep players out of the file browser** (Foundry and the system): players cannot browse or upload files.
>
> Where one of these is another module's setting, it disappears from each player's own Configure Settings, and a
> change made anyway is put back. **Give back Foundry's settings** in the same window returns what the module changed in Foundry, except the
> dice: nobody's earlier dice look comes back.

Read from: scripts/enforced.mjs `ENFORCED` (isoWelcome, dhWelcome, playerFiles, liveKitInFoundry, rtcDock) and its
header (held at `setup` on every client, the box hidden by `config: false`, a change put back by
`clientSettingChanged`); `FOUNDRY_WRITES` and lang/en.json `DRPG.GiveBack.what.*` (what Give back returns, and that it
does not return the dice look); scripts/dice-sync.mjs header (players, trusted players and Assistant GMs hold one full
Gamemaster's look; a full Gamemaster's own look is never written); scripts/settings.mjs registrations (`forceDiceLook`
default true with `diceLookKind` "dsn", `liveKitInFoundry` true and `requiresReload`, `voiceTile` true,
`enforceIsoWelcome`, `enforceDhWelcome` and `enforcePlayerFiles` true); scripts/settings-window.mjs `GAME_SECTIONS`
and lang/en.json `DRPG.SettingsWindow.sections` (which section holds each); scripts/voice-tile.mjs header (the tile
shows whoever this player hears speaking; off gives the dock back). The welcomes' and the dock's behaviour at a real
table are LIVE-E79-09, LIVE-E19-06 and the voice tile's live checks (audit/AUDIT-1.2.42.md 9.2), not measured here.

## 3. Technical notes: voice

**Where:** README.md, "## Technical notes", after the new paragraph of section 2. **Replaces:** the words "Off by
default: regional voice and music that follows the game." in "**House rules.**" stay; this adds how voice is set up.

> **Voice.** Voice needs LiveKit AVClient with a LiveKit server, and the GM turns on **Separate voice in each room**
> (Voice) to split it by room; it is off by default. With it on, you hear only the people in your character's room.
> The voice settings of your own microphone and speakers are Foundry's, under Foundry's Audio/Video configuration.

Read from: scripts/settings.mjs `voiceEnabled` (world, default false) and lang/en.json
`DRPG.Settings.voiceEnabled` ("Separate voice in each room", "You hear only the people in your room. Needs LiveKit
AVClient."). "The voice settings of your own microphone and speakers are Foundry's" rests on enforced.mjs's `rtcDock`
note (Foundry's `core.rtcClientSettings` holds a player's devices, volumes and push-to-talk); where Foundry v14 shows
them was not read here. The plan (A8, A9 of 11.10) also asks for "voice settings under the gear": the gear holds the
two Voice switches above, and a player's devices are Foundry's, so the draft says that rather than the plan's words.

## 4. Credits: the fonts' licences

**Where:** README.md, "## Credits", the sentence at README.md:323-325. **Replaces:** "The three fonts it ships,
Press Start 2P, VT323 and Special Elite, keep their own SIL Open Font License 1.1 (see fonts/README.md)."

> The three fonts it ships keep their own licences: VT323 the SIL Open Font License 1.1, Special Elite the Apache
> License 2.0, and the pixel face, a modified Press Start 2P named DRPG Pixel, the SIL Open Font License 1.1. Each
> licence's text is in [fonts/](fonts/README.md).

Read from: the woff2 files' own name tables and fonts/README.md's licence table (E26 prep C1, C2; R6300 and
`node tools/check.mjs fonts`). Not in the plan's list, but the current sentence is wrong about Special Elite.

## Not in this draft

- The plan's A8 sentences (one on the room tile; one on players having no Foundry scene buttons while the GM has them
  behind Foundry tools) and S12-75's install wording: the install wording is already right at 1463f22b ("not
  installed, or installed but switched off", README.md:221-223). The A8 sentences were not part of this line's brief;
  the default is to leave them for the release's README pass.
- The compatibility row: README.md:229 already says Daggerheart 2.6.5 or newer, verified on 2.12.8, as module.json
  does (R6301 holds module.json; README's rows are not held by `check stamps`, the owner's rule).

## Questions for the owner

| Id | Question | Default taken |
| --- | --- | --- |
| Q-E26P-1 | Put sections 1-4 into README.md as written? | Not done: the README is yours; the coordinator or the release pastes them on your yes |
| Q-E26P-2 | The list in section 2 names the settings window's section of each switch. Keep the section names, or only the switches? | Keep them: a GM looking for one finds it by the section |
