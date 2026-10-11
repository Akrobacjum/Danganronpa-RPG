/**
 * Danganronpa RPG - setting a season up, and taking one down.
 * ---------------------------------------------------------------------------
 * The pre-season checks answer "what is missing". This answers "fix it", and it
 * is the same list read from the other end: every row here is a row there, in
 * the same order, using the same words. Two views, one truth - a check that
 * turns green is a row here that has nothing left to do.
 *
 * NOT A STEP-BY-STEP WIZARD. A next/back flow has one property this must not
 * have: a step you have passed is off screen, and a step skipped is invisible.
 * The complaint that produced this stage was three things missing from a world
 * somebody was already playing in - the failure mode is not "the GM could not
 * find the button", it is "nobody was ever told the button mattered". So every
 * row stays on screen with its state showing, and an outstanding one is
 * outstanding in front of you until it is done.
 *
 * Nothing here does anything the GM could not do by hand. What it does is say
 * what there is to do, in the order a season is actually built.
 */

// `ROOMS_PER_PLAYER` is not read here any more: the ratio and its rounding
// live in `roomsWantedFor`, so both screens that print it agree by
// construction (audit A21).
import {
    MODULE_ID, FLAGS, STARTING, ITEM_CATEGORIES, CHAPTERS_PER_SEASON, TIMING
} from "./config.mjs";
import { SETTINGS, DEFAULT_SAFEWORD, setSetting, isDeceased, isDeadForGm } from "./settings.mjs";
// What a reset is allowed to keep (R-1). Static and by a literal path, so the
// suite's own source sweep can follow it.
import {
    RESET_GROUPS, RESET_SECTIONS, groupLabel, sectionLabel,
    rememberedExceptions, rememberExceptions, planFrom, resetCutPatch
} from "./season-exceptions.mjs";
// The reset's cut is a GM store stamp, taken once this browser has the other GMs' copies.
import { gmStoreStamp, whenGmStoresHydrated } from "./gm-store.mjs";
import { safeword } from "./safeword.mjs";
import { getClock, setClock } from "./clock.mjs";
import { studentActors, isMonokuma } from "./monokuma.mjs";
import { monokumaFor, feedsNobody } from "./assignments.mjs";
import { listExperiences, initCharacter, needsStartingResources } from "./character.mjs";
import { carriableCategories } from "./inventory.mjs";
// Static, and safe to be: vault.mjs never reaches back here, and `steps()` is
// synchronous - a `done` that had to await could not answer at all.
import { sharedRooms, roomsWantedFor, forgetAllStashesFound, reconcileBedroomKeys, unconcealStashes, allBedroomsAnywhere } from "./vault.mjs";
import { monokumas } from "./despair.mjs";
import { mastermindActor, mastermindUnpooled } from "./mastermind.mjs";
import { liveKitSecretWarning, liveKitConnectionSettings } from "./voice.mjs";
import { dialogContent, log, error, plural, workingScene, MESSAGE_FLAG, esc, isPrimaryGm, primaryGmId, replaceFlag, serverNow, whisperToGms } from "./utils.mjs";
import { MESSENGER_FLAGS } from "./messenger.mjs";
import { cardFlag } from "./secret.mjs";
import { NOTE_FLAG, hasNote } from "./pre-session-note.mjs";
import { alreadyOpen, handOff } from "./live.mjs";
import { projectTokensOn } from "./projects-map.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/**
 * The two roles that run the game. Read from the constants rather than written
 * as 3 and 4, because the numbers are Foundry's to change and the names are not.
 */
const GM_ROLES = [CONST.USER_ROLES.ASSISTANT, CONST.USER_ROLES.GAMEMASTER];

/** Which GM roles currently broadcast their pointer. See the `cursor` step. */
function gmRolesSharingCursor() {
    try {
        const allowed = game.settings.get("core", "permissions")?.SHOW_CURSOR ?? [];
        return GM_ROLES.filter(r => allowed.includes(r));
    } catch {
        // Unreadable permissions are not a finding - say nothing rather than
        // put a repair button under a question this cannot answer.
        return [];
    }
}

/** A role number as the word core prints for it. */
function roleName(role) {
    const key = Object.entries(CONST.USER_ROLES).find(([, v]) => v === role)?.[0] ?? String(role);
    const label = `USER.Role${key.charAt(0)}${key.slice(1).toLowerCase()}`;
    const localized = game.i18n.localize(label);
    return localized === label ? key : localized;
}

/* ==========================================================================
 * WHAT THE SEASON STILL NEEDS
 * ========================================================================== */

/**
 * One row per thing a season needs, each able to say whether it is done.
 *
 * `missing` returns the names it is waiting on, so a row can say "3: Aoi, Leon,
 * Sakura" rather than "not ready" - the GM's next action is on that list, and a
 * count with no names is a second lookup.
 */

/** Is this student carrying anything that counts as their opening item? */
function hasOpeningItem(actor) {
    const carriable = carriableCategories();
    return actor.items.some(i => carriable.includes(i.getFlag(MODULE_ID, "category")));
}

/**
 * Give the starting resources to every student whose Health or Sanity maximum is
 * BELOW the starting values. Answers how many were set up.
 *
 * Below, not different (SEASON-01): a Level Up raises the maximum, and a sheet above
 * the start is an advanced student, not one waiting to be set up. See
 * `needsStartingResources` for what the old equality test used to wipe.
 */
async function fixResources() {
    let n = 0;
    for (const actor of studentActors()) {
        if (!needsStartingResources(actor)) continue;
        await initCharacter(actor);
        n++;
    }
    return n;
}

/** Take the GM roles off Foundry's SHOW_CURSOR permission. Answers how many came off. */
async function fixCursorPermission() {
    const perms = foundry.utils.deepClone(
        game.settings.get("core", "permissions") ?? {});
    const before = perms.SHOW_CURSOR ?? [];
    const after = before.filter(r => !GM_ROLES.includes(r));
    if (after.length === before.length) return 0;
    perms.SHOW_CURSOR = after;
    await game.settings.set("core", "permissions", perms);
    return before.length - after.length;
}

/** The shared-rooms-per-player line under the room count step. */
function roomCountLine(roster) {
    return `<div class="notes">${foundry.utils.escapeHTML(
        game.i18n.format("DRPG.Season.roomCountLine", {
            rooms: sharedRooms().length,
            players: roster.length,
            want: roomsWantedFor(roster.length)
        }))}</div>`;
}

/** The room guide and the Check rooms button under the rooms step. */
function roomGuideHtml() {
    return `<div class="drpg-room-guide">
        <p>${foundry.utils.escapeHTML(game.i18n.localize("DRPG.Season.roomGuide"))}</p>
        <p><button type="button" data-drpg-check>${
            foundry.utils.escapeHTML(game.i18n.localize("DRPG.Season.checkRooms"))}</button></p>
        <div data-drpg-check-out class="drpg-room-check"></div>
    </div>`;
}

function steps() {
    const roster = studentActors();
    const clock = getClock();

    return [
        {
            key: "name",
            done: Boolean(clock.campaignName?.trim()),
            missing: () => [],
            /** Fixed inside this window; see the form below. */
            inline: true
        },
        {
            key: "cast",
            done: roster.length > 0,
            missing: () => []
        },
        {
            key: "monokumas",
            /* A POOL AND SOMEBODY TO SPEND IT (22.09). This ticked as soon as a pool-holding GM
               account existed, which is every full Gamemaster - so it was green in a world with
               no Monokuma character at all, and the Despair Calls live on that character's
               sheet. The handbook said the row checks for a character marked as Monokuma; now
               it checks both, and says which is missing. */
            done: monokumas().length > 0 && game.actors.some(a => isMonokuma(a)),
            missing: () => [
                ...(monokumas().length ? [] : [game.i18n.localize("DRPG.Season.missingPool")]),
                ...(game.actors.some(a => isMonokuma(a)) ? [] : [game.i18n.localize("DRPG.Season.missingMonokumaActor")])
            ],
            // The window the two Despair rows further down already open: opting
            // somebody in is what it is for, and a row that says "at least one
            // Monokuma" with no way to make one reports rather than helps (SEASON-02).
            open: async () => (await import("./gm-team-dialog.mjs")).openGmTeamDialog()
        },
        {
            key: "resources",
            // Below the starting numbers, not different from them - a Level Up raises
            // the maximum, and that is not a sheet waiting to be set up (SEASON-01).
            done: roster.every(a => !needsStartingResources(a)),
            missing: () => roster.filter(needsStartingResources).map(a => a.name),
            // The one row that can finish itself: the guide's numbers are the
            // guide's numbers, and there is nothing to decide.
            fix: fixResources
        },
        {
            key: "ultimate",
            done: roster.every(a => a.getFlag(MODULE_ID, "ultimate")),
            missing: () => roster.filter(a => !a.getFlag(MODULE_ID, "ultimate")).map(a => a.name),
            // An Ultimate is a sentence somebody writes, so this opens the sheet
            // rather than inventing one.
            open: names => openFirstSheet(names)
        },
        {
            key: "experiences",
            done: roster.every(a => listExperiences(a).length >= STARTING.experiences),
            missing: () => roster.filter(a => listExperiences(a).length < STARTING.experiences)
                .map(a => `${a.name} (${listExperiences(a).length}/${STARTING.experiences})`),
            open: names => openFirstSheet(names)
        },
        {
            key: "items",
            /*
             * A KEY IS NOT AN OPENING ITEM (audit A25). This counted every
             * category, and assigning somebody a bedroom hands them a key - so
             * every student with a room passed this row carrying nothing else.
             * `carriableCategories` is the list without keys and bullets.
             */
            done: roster.every(hasOpeningItem),
            missing: () => roster.filter(a => !hasOpeningItem(a)).map(a => a.name),
            open: async () => (await import("./gm-items.mjs")).openItemManager()
        },
        {
            key: "assignments",
            /* NOBODY, ON PURPOSE, IS AN ANSWER (22.09). A student deliberately set to feed no
               pool - an NPC-run character, a template - is watched as intended, and this row
               showed them as a red cross forever. Despair Flow no longer names the Mastermind
               as one (E05 C15, 27.09.2026; audit S03-03, S10-12): the division is a world
               setting every player's browser reads, so the one student left out stands out.
               The row below says so when it has been done anyway. */
            done: roster.every(a => feedsNobody(a) || monokumaFor(a)),
            missing: () => roster.filter(a => !feedsNobody(a) && !monokumaFor(a)).map(a => a.name),
            open: async () => (await import("./gm-team-dialog.mjs")).openGmTeamDialog()
        },
        /* THE MASTERMIND OUT OF EVERY POOL (S03-03, S10-12). Only while it is true, and a
           cross, not a dash: it is the module's old advice followed, and every console can
           read it. No name under it - the window may be open while a screen is shared, and
           the Mastermind window is the one place that names them. */
        ...(mastermindUnpooled() ? [{
            key: "nobodyPublic",
            done: false,
            missing: () => [],
            open: async () => (await import("./gm-team-dialog.mjs")).openGmTeamDialog()
        }] : []),
        {
            /*
             * EVENLY, AND THAT IS ALL IT SAYS (S-4, Dawid 17.09).
             *
             * The review asked for a rule about how many students one Despair pool
             * may watch; his answer was that the number of Monokumas is the table's
             * business - one, two or four - and what matters is that the living cast
             * is split evenly between whatever pools exist. Evenly here means the
             * fullest and the emptiest pool differ by at most one living student.
             *
             * Advisory, never a cross: a season with four students and three
             * Monokumas cannot be even, and a table that wants one Monokuma watching
             * the dangerous half is allowed to want that. It reports, and its button
             * opens the screen where it is changed.
             */
            key: "despairSplit",
            optional: true,
            done: despairSplitEven(),
            missing: () => despairSplitCounts().map(p => `${p.name}: ${p.n}`),
            open: async () => (await import("./gm-team-dialog.mjs")).openGmTeamDialog()
        },
        {
            /*
             * THE MODULE SHIPS NO AUDIO AND ASSIGNS NONE (Dawid, 28.08).
             *
             * Which makes this row necessary rather than decorative: without it
             * the only way to find out that the game can make sounds at all is
             * to open a panel nobody has told you about. Optional, and it means
             * it - a table that wants to play silent has decided something,
             * not forgotten it, so this gets the dash rather than the cross.
             */
            key: "sound",
            optional: true,
            done: Object.keys(game.settings.get(MODULE_ID, SETTINGS.sfxMap) ?? {}).length > 0,
            missing: () => [],
            open: async () => (await import("./music.mjs")).openSoundDialog()
        },
        {
            /*
             * G-36: HOW MANY ROOMS, AS ADVICE.
             *
             * Guide: about one and a half rooms per player, corridors and
             * dormitories aside. It is the difference between a map where two
             * people can be alone at the same time and one where every private
             * conversation is a queue - and it is the cheapest thing in this
             * whole checklist to get right, because it costs nothing before the
             * scene is drawn and cannot be fixed cheaply afterwards.
             *
             * `optional: true`, which is trap 118 and the reason this row reads
             * "–" rather than "✗" when it is not met: a map smaller than the
             * guide's ratio is cramped, not broken, and a checklist that shouts
             * about a working scene is a checklist a GM stops reading. It has
             * no `open` and no `fix` for the same reason - there is no button
             * that can draw six more rooms.
             */
            key: "roomCount",
            optional: true,
            inline: true,
            /*
             * SHARED ROOMS, NOT EVERY REGION (audit A21). This counted
             * `regions.size` - bedrooms, corridors and any unnamed shape
             * somebody drew - so a map could pass the row on regions that
             * cannot host a private conversation, which is the only thing the
             * ratio is about. `sharedRooms` and `roomsWantedFor` are the same
             * two answers Room Setup's own line prints, so the two screens can
             * no longer disagree about one map.
             */
            done: sharedRooms().length >= roomsWantedFor(roster.length),
            missing: () => [],
            extra: () => roomCountLine(roster)
        },
        {
            key: "rooms",
            done: (workingScene()?.regions?.size ?? 0) > 0,
            missing: () => [],
            open: async () => (await import("./vault.mjs")).openRoomSetupDialog(),
            /*
             * THE GUIDE AND THE CHECK BELONG HERE, NOT IN ROOM SETUP.
             *
             * Room setup is opened between sessions to say who has a bedroom and
             * who has seen which room. Drawing the regions themselves is a job
             * done once, when a scene is built - which is this window, next to
             * the row that says whether the scene has any rooms at all.
             *
             * The check goes with the instructions for the same reason: reading
             * how it should be done and asking whether it was done are one
             * errand, and splitting them across two windows is how the second
             * half stops happening.
             */
            extra: () => roomGuideHtml()
        },
        {
            /*
             * THE GM'S CURSOR HAS A NAME ON IT.
             *
             * Foundry broadcasts every user's pointer to everyone who can see
             * the scene, labelled. In an ordinary game that is a feature - it is
             * how a GM points at the door they mean. In a killing game it is a
             * live feed of what the GM is looking at: the room where the body
             * is, the token they are about to move, the region they are checking
             * before anybody has walked into it. The module already hides the
             * player roster for a smaller version of the same leak (a second GM
             * account logging in is a spoiler), and it hides the clock from
             * outsiders during an incident. The pointer is the loudest of the
             * three and the only one Foundry owns.
             *
             * OFFERED, NOT IMPOSED, and the same shape as the Mastermind row
             * below: a dash rather than a cross, because a table that wants to
             * point at things has decided something rather than forgotten it.
             * The button is here because the repair is one line and lives four
             * screens away in core's own permission matrix.
             *
             * Players keep theirs. `SHOW_CURSOR` is a per-role list and only the
             * two GM roles come off it - a player pointing at the map is the
             * table talking, which is the thing this is protecting.
             */
            key: "cursor",
            optional: true,
            done: !gmRolesSharingCursor().length,
            missing: () => gmRolesSharingCursor().map(roleName),
            fix: fixCursorPermission,
            // ITS OWN SENTENCE (SEASON-02). `DRPG.Season.fixed` counts characters
            // given their starting resources, which is the other `fix` row; this one
            // counts GM roles that have stopped broadcasting their pointer.
            fixedKey: "DRPG.Season.fixedCursor"
        },
        /* A SELF-HOSTED VOICE SERVER'S SECRET IN THE WORLD (S11-59; voice.mjs
           `liveKitSecretWarning`). Only while it is true; a cross with nothing to open,
           because the setting is avclient-livekit's and the repair is choosing a server
           that keeps its secret to itself. The sentence is the voice diagnosis's. */
        ...(liveKitSecretWarning(liveKitConnectionSettings()) ? [{
            key: "liveKitSecret",
            hintKey: "DRPG.Voice.liveKitSecret",
            done: false,
            missing: () => []
        }] : []),
        {
            key: "mastermind",
            // The one row that is allowed to stay unticked for ever.
            //
            // A season without a Mastermind is a legal season - the guide's
            // endgame is one way to end a killing game, not the only one - so
            // this reports its state without the red cross that means "you have
            // forgotten something". Everything else on this list is a promise
            // the module has made to a rule; this is an offer.
            optional: true,
            done: Boolean(mastermindActor()),
            missing: () => [],
            open: async () => (await import("./mastermind.mjs")).openMastermindDialog()
        }
    ];
}

/**
 * Living students per Despair pool, biggest first - the numbers the split row
 * reports. A student deliberately watched by nobody (`NO_MONOKUMA`) is nobody's
 * weight and is left out.
 */
function despairSplitCounts() {
    const counts = new Map();
    for (const user of monokumas()) counts.set(user.id, { name: user.name, n: 0 });
    for (const actor of studentActors()) {
        if (isDeadForGm(actor)) continue;          // the dead do not roll, so they are no weight on a pool
        const pool = monokumaFor(actor);
        if (!pool) continue;
        const row = counts.get(pool.id);
        if (row) row.n += 1;
    }
    return [...counts.values()].sort((a, b) => b.n - a.n);
}

/** Is the living cast split evenly between the pools that exist? */
function despairSplitEven() {
    const counts = despairSplitCounts();
    if (counts.length < 2) return true;
    return counts[0].n - counts[counts.length - 1].n <= 1;
}

/** Open the sheet of the first character a row is waiting on. */
function openFirstSheet(names) {
    const first = studentActors().find(a => names.some(n => n.startsWith(a.name)));
    first?.sheet?.render(true);
}

/* ==========================================================================
 * THE WINDOW
 * ========================================================================== */

/**
 * The three fields this window collects, as they stand on screen (SEASON-02, 20.09).
 *
 * A checklist row that acts closes this window and opens it again so the marks are
 * current, and the copy that comes back is built from the WORLD - so anything typed
 * and not yet applied was thrown away by the act of fixing the row above it. Read
 * before the close, painted back after the reopen.
 *
 * Only these three, by name: everything else in the window is a read-out, and the
 * reset panel is its own window with its own confirmation.
 */
function readDraft(root) {
    if (!root) return null;
    const value = name => root.querySelector(`[name="${name}"]`)?.value ?? null;
    return { campaignName: value("campaignName"), chapter: value("chapter"), safeword: value("safeword") };
}

/** Put a carried draft back on the fields, once the new copy has rendered. */
function paintDraft(root, draft) {
    if (!root || !draft) return;
    for (const [name, value] of Object.entries(draft)) {
        if (value === null) continue;
        const field = root.querySelector(`[name="${name}"]`);
        // The value the GM typed, including a deliberately emptied field - which is
        // why this writes whatever came back rather than only non-empty strings.
        if (field) field.value = value;
    }
}

/** One line per step: the mark, the name and hint, what is missing, its extra, and a button when it can act. */
function setupRows(list) {
    return list.map(step => {
        const names = step.done ? [] : step.missing();
        const detail = names.length
            ? `<div class="drpg-setup-missing">${esc(names.join(", "))}</div>`
            : "";
        // A ROW THAT OPENS NOTHING OFFERS NOTHING (SEASON-02, 20.09). "The cast
        // exists" carried an "Open" button and no `open`, so pressing it threw inside
        // the handler, was logged, and closed and reopened the window for nothing -
        // and brought the GM panel with it. Its hint already says what to do, and
        // creating characters is Foundry's own sidebar rather than a window of ours.
        const button = step.done || step.inline || !(step.fix || step.open)
            ? ""
            : `<button type="button" class="drpg-setup-do" data-step="${step.key}">${
                esc(game.i18n.localize(step.fix ? "DRPG.Season.doIt" : "DRPG.Season.openIt"))}</button>`;

        // An optional row that is not done is not a failure, so it gets neither
        // the cross nor the "outstanding" styling - a dash and its own note.
        const mark = step.done ? "✓" : step.optional ? "–" : "✗";

        return `<li class="drpg-setup-step${step.done ? " done" : ""}${
            step.optional && !step.done ? " optional" : ""}">
            <span class="drpg-setup-mark">${mark}</span>
            <div class="drpg-setup-body">
                <strong>${esc(game.i18n.localize(`DRPG.Season.step.${step.key}`))}</strong>
                <div class="notes">${esc(game.i18n.localize(step.hintKey ?? `DRPG.Season.hint.${step.key}`))}</div>
                ${detail}
                ${step.extra ? step.extra() : ""}
            </div>
            ${button}
        </li>`;
    }).join("");
}

/** What Save hands back: the campaign name, the chapter and the safeword. */
function readSeasonForm(d) {
    const f = d.element.querySelector("form");
    return {
        campaignName: f.campaignName.value.trim(),
        chapter: Number(f.chapter.value) || 1,
        // Blank means "put the default back", which is what
        // `safeword()` reads an empty setting as. Written blank
        // rather than filled in here so the two agree.
        safeword: f.safeword.value.trim()
    };
}

/** The Check rooms button under the rooms step: run the region check and print its findings in place. */
function wireRoomCheck(dialog) {
    const checkButton = dialog.element.querySelector("[data-drpg-check]");
    const checkOut = dialog.element.querySelector("[data-drpg-check-out]");
    checkButton?.addEventListener("click", async ev => {
        ev.preventDefault();
        const { checkRegions } = await import("./fog.mjs");
        const findings = checkRegions();
        if (!findings.length) {
            checkOut.innerHTML = `<p class="notes">${
                esc(game.i18n.localize("DRPG.Season.checkClean"))}</p>`;
            return;
        }
        const marks = { error: "\u2715", warning: "!", info: "\u00b7" };
        checkOut.innerHTML = `<table class="drpg-vault-table drpg-room-check-table"><tbody>${
            findings.map(f => `<tr>
                <td>${marks[f.level] ?? "\u00b7"}</td>
                <td>${esc(f.room)}</td>
                <td><strong>${esc(f.problem)}</strong><br>
                    <small>${esc(f.detail)}${f.at ? ` (${f.at.x}, ${f.at.y})` : ""}</small></td>
            </tr>`).join("")
        }</tbody></table>`;
    });
}

/**
 * Each step's Do it / Open it button: fix or open, then come back to a fresh window.
 *
 * `onHandOff` is how the round trip reaches `openSeasonSetup`, which returns it in
 * place of its own answer - see the note inside.
 */
function wireSetupSteps(dialog, onHandOff) {
    for (const button of dialog.element.querySelectorAll(".drpg-setup-do")) {
        button.addEventListener("click", async ev => {
            ev.preventDefault();
            const step = steps().find(s => s.key === button.dataset.step);
            if (!step) return;
            try {
                if (step.fix) {
                    const n = await step.fix();
                    ui.notifications.info(plural(step.fixedKey ?? "DRPG.Season.fixed", { n }));
                } else {
                    await step.open(step.missing());
                }
            } catch (err) {
                error(`Could not act on the "${step.key}" setup step`, err);
            }

            /*
             * THE REOPEN IS PART OF THE SAME ERRAND (SEASON-02, 20.09).
             *
             * The window still closes and comes back, because every one of these
             * rows can change what ANOTHER row reports and the checklist is built
             * from the world. What changed is the two things that made one press
             * look like two:
             *
             * `await dialog.close(); openSeasonSetup();` resolved the
             * `DialogV2.wait` this window is sitting in - so `openSeasonSetup`
             * returned, and the GM panel tile awaiting it opened the PANEL over
             * the window as it came back. `handOff` keeps the whole round trip in
             * one promise, handed to `onHandOff` in the same turn as the close and
             * returned by `openSeasonSetup`, so the tile waits for the real end of
             * it. See the note on `handOff` in live.mjs for why it cannot be
             * written with an `await` in front of it.
             *
             * And the new copy is built from the world, so the campaign name, the
             * chapter and the safeword the GM had typed but not applied went with
             * the reopen. They are read here, BEFORE the close, and painted back.
             */
            const draft = readDraft(dialog.element);
            onHandOff(handOff(dialog, () => openSeasonSetup({ draft })));
        });
    }
}

export async function openSeasonSetup({ draft = null } = {}) {
    // ONE OF THESE, NOT FOUR - see `alreadyOpen` in live.mjs. Two copies of a
    // window each read the world when they opened and neither knows about the
    // other, so the older one goes on looking authoritative while showing
    // something that stopped being true. Raised rather than refused: pressing
    // twice usually means the window is behind something.
    if (alreadyOpen("drpg-window-season")) return null;

    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const clock = getClock();
    const list = steps();

    const rows = setupRows(list);

    const outstanding = list.filter(s => !s.done && !s.optional).length;

    // A row button's round trip, if one is running: this window did not answer, it
    // handed over (SEASON-02). Set by `wireSetupSteps` through the callback the
    // render below gives it, and read after the wait.
    let roundTrip = null;

    const result = await DialogV2.wait({
        classes: ["drpg-panel", "drpg-wide", "drpg-window-season"],
        window: { title: game.i18n.localize("DRPG.Season.title") },
        content: dialogContent(`<form>
            <p>${esc(game.i18n.format(outstanding
                ? "DRPG.Season.introOutstanding"
                : "DRPG.Season.introReady", { n: outstanding }))}</p>

            <label>${esc(game.i18n.localize("DRPG.Season.campaignName"))}
                <input type="text" name="campaignName"
                       value="${esc(clock.campaignName ?? "")}"
                       placeholder="${esc(game.i18n.localize("DRPG.Season.campaignPlaceholder"))}" /></label>
            <label>${esc(game.i18n.localize("DRPG.Season.chapter"))}
                <input type="number" name="chapter" min="1" max="${Math.max(CHAPTERS_PER_SEASON, Number(clock.chapter) || 1)}"
                       value="${Number(clock.chapter) || 1}" /></label>

            <!--
              E15: the safeword, next to the campaign's name and not buried in a
              settings menu. It is a decision a table makes once, at the same
              moment it decides what the campaign is called - and a safety tool
              filed under configuration is a safety tool nobody has read.
            -->
            <label>${esc(game.i18n.localize("DRPG.Season.safeword"))}
                <input type="text" name="safeword"
                       value="${esc(safeword())}"
                       placeholder="${esc(DEFAULT_SAFEWORD)}" /></label>
            <p class="notes">${esc(game.i18n.localize("DRPG.Season.safewordNote"))}</p>

            <ul class="drpg-setup-list">${rows}</ul>
            <p class="notes">${esc(game.i18n.localize("DRPG.Season.note"))}</p>
        </form>`),
        buttons: [
            {
                action: "save", label: game.i18n.localize("DRPG.Assign.save"), default: true,
                callback: (e, b, d) => readSeasonForm(d)
            },
            // The other end of this same list. "What is missing" and "fix it"
            // are one errand, and the checks used to be a GM-panel tile of
            // their own next to this one - one door fewer, same two answers.
            // The checks are a read-out, so the fields come back with the window:
            // read here, while the form is still on screen. A bare action would
            // answer the string "checks", which carries no fields at all.
            {
                action: "checks", label: game.i18n.localize("DRPG.Panel.seasonChecks"),
                callback: (e, b, d) => ({ checks: true, draft: readDraft(d.element) })
            },
            { action: "close", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        // Wire the per-row buttons against the mounted DOM - a listener attached
        // to the detached content element never reaches the page. Same reason
        // projects-ui.mjs wires its portrait pickers from `render`.
        render: (event, dialog) => {
            // A draft carried over from the copy that closed to fix a row (SEASON-02).
            paintDraft(dialog.element, draft);
            /*
             * The room check reports INTO THE WINDOW, not only to the console.
             * The person who has to act on "this room overlaps that one" is a GM
             * in the region editor, and telling them to open devtools is telling
             * them not to bother. The console copy stays: it carries the
             * coordinates in a form that can be pasted.
             */
            wireRoomCheck(dialog);
            wireSetupSteps(dialog, trip => { roundTrip = trip; });
        },
        rejectClose: false
    });

    if (roundTrip) return roundTrip;
    if (!result || result === "close") return null;

    if (result.checks) {
        await runPreSessionChecks();
        return openSeasonSetup({ draft: result.draft });
    }

    await setClock({ campaignName: result.campaignName, chapter: result.chapter });

    // Only when it moved. Every write to this setting redraws every open sheet
    // (see its `onChange`), and pressing Save on this window is something a GM
    // does repeatedly while working through the checklist.
    if (result.safeword !== safeword()) {
        await setSetting(SETTINGS.safeword, result.safeword);
        log(`Safeword set to "${safeword()}".`);
    }

    log(`Season setup saved: "${result.campaignName}", chapter ${result.chapter}.`);
    return result;
}

/**
 * Both pre-session checks, answered in one window.
 *
 * "Is everybody set up" and "can anybody read a sheet they should not" are one
 * question asked at one moment - before a session - so they are one tile and
 * now one answer. Neither report goes to chat from here: they are handed back
 * as text and put on screen, because a question asked with a button should be
 * answered where the button was.
 */
async function runPreSessionChecks() {
    const [{ diagnoseCharacters }, { auditAnonymity }, { diagnoseScenes }] = await Promise.all([
        import("./diagnostics.mjs"), import("./anonymity.mjs"), import("./fog.mjs")
    ]);

    const setup = diagnoseCharacters({ toChat: false });
    const anon = await auditAnonymity({ toChat: false });
    // A scene that has rooms but still uses Foundry's own vision renders as a
    // black screen for players on v14 and says nothing about why, so it belongs
    // on the list of things checked before anybody sits down.
    const scenes = diagnoseScenes();

    await DialogV2.wait({
        classes: ["drpg-panel", "drpg-wide"],
        window: { title: game.i18n.localize("DRPG.Panel.seasonChecks") },
        content: dialogContent(`<div>
            <h3>${game.i18n.localize("DRPG.Panel.checksSetup")}</h3>
            <pre class="drpg-check-report">${foundry.utils.escapeHTML(setup)}</pre>
            <h3>${game.i18n.localize("DRPG.Fog.checksScenes")}</h3>
            <pre class="drpg-check-report">${foundry.utils.escapeHTML(scenes)}</pre>
            <h3>${game.i18n.localize("DRPG.Anonymity.audit.title")}</h3>
            ${anon.body ?? ""}
        </div>`),
        buttons: [{ action: "close", label: game.i18n.localize("DRPG.Panel.close"), default: true }],
        rejectClose: false
    });
}

/* ==========================================================================
 * TAKING A SEASON DOWN
 * --------------------------------------------------------------------------
 * Without this the only way to start again is a new world, which throws away
 * the cast, the map and the room setup along with the season - an hour of work
 * to undo a chapter.
 *
 * The line it draws is between the CAST and the CHAPTER. Actors, scenes, room
 * regions and who watches whom are the table's; the clock, the projects, the
 * traces, the evidence, the deaths and every trace of an incident belong to the
 * season that just ended. That split is why this is safe to offer at all - the
 * expensive half is never touched.
 * ========================================================================== */

/**
 * Items a season put in somebody's hands, wherever they ended up.
 *
 * Truth Bullets are excluded on purpose: they are one of these categories, and
 * they have their own step that drops the answer key behind each one before
 * deleting it. Counting them here would say the same thing twice, and clearing
 * them here would skip that step.
 */
function seasonItems(actor) {
    const categories = Object.keys(ITEM_CATEGORIES).filter(c => c !== "truthBullet");
    return actor.items.filter(i => categories.includes(i.getFlag(MODULE_ID, "category")));
}

/** Chat this module wrote, and the messenger threads underneath it. */
function moduleMessages() {
    return game.messages.filter(m =>
        m.getFlag(MODULE_ID, MESSAGE_FLAG) || cardFlag(m, MESSENGER_FLAGS.thread));
}

/**
 * The free-text note on a character sheet, wherever this system keeps it.
 *
 * NOT the biography. Pronouns, age, faith and connections are who somebody is -
 * the same side of the line as the name, the portrait and the Ultimate, all of
 * which this reset leaves alone. A note is what got written down during the
 * season that just ended.
 *
 * Both paths are probed because the field has moved between Daggerheart
 * versions, and a path that is not there simply is not written.
 */
const NOTE_PATHS = ["system.notes", "system.biography.notes"];

function writtenNotes(actor) {
    const found = {};
    for (const path of NOTE_PATHS) {
        const current = foundry.utils.getProperty(actor, path);
        if (typeof current === "string" && current.trim()) found[path] = "";
    }
    return found;
}

/** What a reset would destroy, counted now rather than described in general. */
function resetTally() {
    const remnants = game.scenes.reduce((n, scene) =>
        n + scene.tokens.filter(t => t.getFlag(MODULE_ID, "isRemnant")).length, 0);
    // What the projects step takes off the maps since E11 C7: every project token, the orphans included.
    const projectTokens = projectTokensOn(game.scenes).length;

    const bullets = game.actors.reduce((n, a) =>
        n + a.items.filter(i => i.getFlag(MODULE_ID, "isTruthBullet")).length, 0);

    const dead = studentActors().filter(isDeadForGm).length;

    let projects = 0;
    try {
        projects = (game.settings.get("daggerheart", "Countdowns")?.countdowns
            ?? game.settings.get(MODULE_ID, SETTINGS.projectMeta) ?? {});
        projects = Object.keys(projects).length;
    } catch {
        projects = 0;
    }

    const students = studentActors();
    const items = students.reduce((n, a) => n + seasonItems(a).length, 0);
    const advances = students.reduce((n, a) =>
        n + Number(a.getFlag(MODULE_ID, FLAGS.advances) ?? 0), 0);
    // Two groups, two counts (E11 C9): until then one number added the GMs' notes to the
    // cast's, under a line that went whichever box was ticked.
    const preNotes = game.users.filter(u => hasNote(u.id)).length;
    const sheetNotes = students.filter(a => Object.keys(writtenNotes(a)).length).length;

    const cards = moduleMessages().length;
    const chat = game.messages.size;

    let despair = 0;
    try {
        despair = Object.values(game.settings.get(MODULE_ID, SETTINGS.despairPools) ?? {})
            .filter(v => Number(v) > 0).length;
    } catch {
        despair = 0;
    }

    return { projects, projectTokens, remnants, bullets, dead, items, advances, preNotes, sheetNotes, cards, chat, despair };
}

/** The counts `resetTally` has for a group, as the lines under its row. */
const GOES_DETAIL = {
    projects: tally => [
        plural("DRPG.Season.resetProjects", { n: tally.projects }),
        plural("DRPG.Season.resetProjectTokens", { n: tally.projectTokens })
    ],
    remnants: tally => [plural("DRPG.Season.resetRemnants", { n: tally.remnants })],
    bullets: tally => [plural("DRPG.Season.resetBullets", { n: tally.bullets })],
    deaths: tally => [plural("DRPG.Season.resetDead", { n: tally.dead })],
    items: tally => [plural("DRPG.Season.resetItems", { n: tally.items })],
    advancement: tally => [plural("DRPG.Season.resetAdvances", { n: tally.advances })],
    preNotes: tally => [plural("DRPG.Season.resetPreNotes", { n: tally.preNotes })],
    sheetNotes: tally => [plural("DRPG.Season.resetSheetNotes", { n: tally.sheetNotes })],
    cards: tally => [plural("DRPG.Season.resetCards", { n: tally.cards })],
    despair: tally => [game.i18n.format("DRPG.Season.resetPools", { n: tally.despair, hope: STARTING.hope })]
};

/**
 * THE "THIS GOES" LIST, FROM THE TICKS (E11 C9; audit S06-49, the plan's 3.3).
 *
 * The list above the ticks was written by hand: twelve lines that went whatever was
 * ticked, one of them ("the incident, the Mastermind, the trial queue, ...") six things
 * at once, and twelve of the twenty-nine groups on no line (counted off 4fcc2b4's list,
 * 10.10.2026). Now one row per group in
 * `RESET_GROUPS`, its label the tick's label and its counts `resetTally`'s; a group
 * the plan keeps is struck through and `aria-disabled`, so a screen reader is told what
 * the line through it says. `resetSeason` draws it again whenever a box changes.
 * Pure over its two arguments, which is what tier 1's R353 reads.
 */
export function resetGoesHtml(plan, tally = {}) {
    const rows = RESET_GROUPS.map(({ key }) => {
        const goes = plan?.groups?.has(key) ?? false;
        const counts = GOES_DETAIL[key]?.(tally) ?? [];
        const text = `${esc(groupLabel(key))}${counts.length
            ? ` <span class="notes">(${counts.map(esc).join("; ")})</span>` : ""}`;
        return goes
            ? `<li data-group="${key}">${text}</li>`
            : `<li data-group="${key}" aria-disabled="true"><s>${text}</s></li>`;
    });
    return `<ul class="drpg-reset-goes">${rows.join("")}</ul>`;
}

/**
 * The ticks, read by name off the table rather than by walking the form: a box the
 * window failed to render must not read as an exception nobody chose.
 */
function tickedIn(root) {
    return RESET_GROUPS
        .filter(group => root?.querySelector(`[name="wipe.${group.key}"]`)?.checked)
        .map(group => group.key);
}

/**
 * WHERE THE CAST'S TOKENS GO, AS THE WINDOW ASKS IT (E11 C10b, 1.2.73; the owner's Q2 of
 * 09.10.2026: "do wyboru przez gma"). (a) they stay, the default every time the window opens;
 * (b) each student to their own bedroom; (c) everyone to one room the GM picks here. The room is
 * this reset's and is stored nowhere: a world setting would be one more thing a reset keeps.
 */
const CAST_TO = Object.freeze(["stay", "bedroom", "point"]);

/** Every named room on every map, by scene and region id - the GM's camera is no part of the answer (ITEM-16). */
function castPoints() {
    return game.scenes.contents.flatMap(scene => [...(scene.regions ?? [])]
        .filter(region => region.name?.trim())
        .map(region => ({ value: `${scene.id}.${region.id}`, label: `${scene.name}: ${region.name}` })));
}

/** The window's answer to "where the cast goes", bounded: anything else is (a). */
function castChoiceIn(root) {
    const to = root?.querySelector('[name="castTo"]:checked')?.value;
    if (to !== "point") return { to: CAST_TO.includes(to) ? to : "stay" };
    const [scene, region] = String(root?.querySelector('[name="castPoint"]')?.value ?? "").split(".");
    return { to, scene: scene || null, region: region || null };
}

function castFieldset() {
    const points = castPoints();
    const choice = (value, key, { disabled = false, after = "" } = {}) => `<label class="drpg-inline-check">
        <input type="radio" name="castTo" value="${value}"${value === "stay" ? " checked" : ""}${disabled ? " disabled" : ""} />
        ${esc(game.i18n.localize(key))}${after}</label>`;
    const options = points.length
        ? points.map(point => `<option value="${esc(point.value)}">${esc(point.label)}</option>`).join("")
        : `<option value="">${esc(game.i18n.localize("DRPG.Season.resetCastNoRooms"))}</option>`;
    return `<fieldset class="drpg-reset-section drpg-reset-cast">
        <legend>${esc(game.i18n.localize("DRPG.Season.resetCastTitle"))}</legend>
        <p class="notes">${esc(game.i18n.localize("DRPG.Season.resetCastNote"))}</p>
        ${choice("stay", "DRPG.Season.resetCastStay")}
        ${choice("bedroom", "DRPG.Season.resetCastBedroom")}
        ${choice("point", "DRPG.Season.resetCastPoint", { disabled: !points.length,
            after: ` <select name="castPoint"${points.length ? "" : " disabled"}>${options}</select>` })}
    </fieldset>`;
}

/**
 * Wipe the season, keep the cast.
 *
 * Typed confirmation, not a clicked one. Every other destructive control in this
 * module asks with a Yes button, and that is right for deleting one project or
 * one Remnant. This deletes a chapter's worth of everything at once and cannot
 * be undone by any route the module offers, so it asks for the word - the point
 * of typing is the half-second it buys to read the list above it.
 */
export async function resetSeason() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    /*
     * THE RESET IS THE PRIMARY GM'S (E04 C10; audit S06-20, D12). What it wipes lives
     * in every GM's browser now (the GM stores), and it reaches them through one cut in
     * the clock and the stores' clears, which are the primary's alone (the handle's
     * `clear`): one browser decides, the one that already answers for the table. On
     * 1.2.62 an assistant's reset cleared its own browser and left last season's trap
     * plants on the primary's, which hands a Search its find. Another GM is told whose
     * the reset is. And the window waits for this browser to have the other GMs' copies
     * before it opens, so the cut's stamp is taken over every row they hold (the
     * design's row 12).
     */
    if (!isPrimaryGm()) {
        const name = game.users.get(primaryGmId())?.name ?? "?";
        ui.notifications.warn(game.i18n.format("DRPG.GmStore.resetPrimaryOnly", { name }));
        return null;
    }

    if (alreadyOpen("drpg-window-season-reset")) return null;
    await whenGmStoresHydrated();
    if (alreadyOpen("drpg-window-season-reset")) return null;

    const tally = resetTally();
    const word = game.i18n.localize("DRPG.Season.resetWord");
    const remembered = rememberedExceptions();

    /*
     * ONE WINDOW, NEVER TWO (R-1). A chain of dialogs would pay the awaited-close
     * stall twice and would throw away whatever was ticked but not applied - and
     * the ticks ARE the decision here, not a detail of it.
     */
    const rows = RESET_SECTIONS.map(section => {
        const inSection = RESET_GROUPS.filter(group => group.section === section);
        if (!inSection.length) return "";
        return `<fieldset class="drpg-reset-section">
            <legend>${esc(sectionLabel(section))}</legend>
            ${inSection.map(group => `<label class="drpg-inline-check">
                <input type="checkbox" name="wipe.${group.key}"
                    ${remembered.keys.has(group.key) ? "" : "checked"} />
                ${esc(groupLabel(group.key))}</label>`).join("")}
        </fieldset>`;
    }).join("");

    // A GM whose browser is closed keeps its copy of the case until it next opens this
    // world, and is cut then (the clock carries the cut): said, so nobody reads a GM
    // who was away still holding last season as a reset that failed.
    const offline = game.users.filter(user => user.isGM && !user.active).map(user => user.name);
    const offlineLine = offline.length
        ? `<p class="notes">${esc(plural("DRPG.GmStore.resetOfflineGms", { n: offline.length, names: offline.join(", ") }))}</p>`
        : "";

    const memoryLine = remembered.keys.size
        ? `<p class="notes">${esc(plural("DRPG.Season.resetRemembered",
            { n: remembered.keys.size }))}${remembered.dropped
                ? ` ${esc(plural("DRPG.Season.resetForgotten", { n: remembered.dropped }))}` : ""}</p>`
        : "";

    const typed = await DialogV2.wait({
        classes: ["drpg-panel", "drpg-window-season-reset"],
        window: { title: game.i18n.localize("DRPG.Season.resetTitle") },
        content: dialogContent(`<form>
            <p class="drpg-warning">${esc(game.i18n.localize("DRPG.Season.resetWarning"))}</p>
            ${offlineLine}
            <p><strong>${esc(game.i18n.localize("DRPG.Season.resetGoes"))}</strong></p>
            <div class="drpg-reset-goes-list">${resetGoesHtml(
                planFrom(RESET_GROUPS.map(group => group.key).filter(key => !remembered.keys.has(key))), tally)}</div>
            <p><strong>${esc(game.i18n.localize("DRPG.Season.resetKeeps"))}</strong></p>

            <!-- R-1. Every step of the wipe, ticked. An unticked box is an
                 exception: that group is left exactly as it is, and the choice is
                 remembered for the next reset. The line under the list says what
                 was remembered, because a GM must never have to work out why a
                 box is already clear. -->
            <p><strong>${esc(game.i18n.localize("DRPG.Season.resetGroupsTitle"))}</strong></p>
            <p class="notes">${esc(game.i18n.localize("DRPG.Season.resetGroupsNote"))}</p>
            ${memoryLine}
            <div class="drpg-reset-groups">${rows}</div>
            ${castFieldset()}

            <label>${esc(game.i18n.format("DRPG.Season.resetType", { word }))}
                <input type="text" name="confirm" autocomplete="off" autofocus /></label>
        </form>`),
        // The list above the ticks follows them: a box unticked strikes its row out.
        render: (event, dialog) => {
            const root = dialog.element;
            root?.querySelector(".drpg-reset-groups")?.addEventListener("change", () => {
                const list = root.querySelector(".drpg-reset-goes-list");
                if (list) list.innerHTML = resetGoesHtml(planFrom(tickedIn(root)), tally);
            });
        },
        buttons: [
            {
                action: "reset", label: game.i18n.localize("DRPG.Season.resetButton"),
                class: "drpg-gm-route drpg-destructive",
                callback: (e, b, d) => ({
                    word: d.element.querySelector("[name=confirm]").value.trim(),
                    ticked: tickedIn(d.element),
                    cast: castChoiceIn(d.element)
                })
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel"), default: true }
        ],
        rejectClose: false
    });

    if (!typed || typed === "cancel" || !typed.word) return null;
    if (typed.word.toLowerCase() !== word.toLowerCase()) {
        ui.notifications.warn(game.i18n.format("DRPG.Season.resetMistyped", { word }));
        return null;
    }

    // Where the cast goes rides on the plan: a choice, not a tick, so `planFrom` (the ticks') does not read it.
    const plan = { ...planFrom(typed.ticked), cast: typed.cast ?? { to: "stay" } };
    if (!plan.groups.size) {
        // Nothing ticked is not a reset, and it is worth saying so rather than
        // running a wipe that does nothing and reporting success.
        ui.notifications.warn(game.i18n.localize("DRPG.Season.resetNothing"));
        return null;
    }

    // Remembered BEFORE the wipe: everything stored is what the wipe is about to
    // leave alone, so nothing it does can lose the decision.
    await rememberExceptions(plan.keep);

    return wipeSeason(plan);
}

/**
 * Delete chat in batches.
 *
 * A season's worth of messages deleted one document at a time is one socket
 * round trip each, and a few thousand of those locks the GM's client for long
 * enough to look like a crash. Five hundred at a time is well inside what a
 * single update can carry and short enough that nothing times out.
 */
async function deleteMessages(ids) {
    for (let i = 0; i < ids.length; i += TIMING.chatDeleteBatch) {
        await ChatMessage.deleteDocuments(ids.slice(i, i + TIMING.chatDeleteBatch));
    }
    return ids.length;
}

/**
 * THE RESET'S ORDER, AS ONE LIST (E11 C9, 10.10.2026; audit S06-15, the plan's 3.1 and
 * p10change). `wipeSeason` runs the ticked groups in this order, once each, after its cut;
 * `RESET_GROUPS` (season-exceptions.mjs) is the window's order, by section, and R50 holds the
 * two to the same keys.
 *
 * The incident first: a reset abandons the running incident before anything it could write
 * about is wiped, so whatever a kept group still holds afterwards was not written by the reset.
 * Until C9 it ran fourth, after the traces, the Truth Bullets and the deaths. Then the cast's
 * armed Despair Calls, the board, the deaths, the case and the cast's sheets; the chat last but
 * the clock, so a card an earlier step posted goes with it; and the clock last of all, so
 * nothing armed fires on a clock still reading the old season.
 *
 * One step is not a group (E11 C10b): `placeCast`, where the cast's tokens go, after the cast's
 * groups - so the deaths the reset clears are cleared before it asks who is dead - and before the
 * chat. It is asked for by the window's choice rather than a tick (`RESET_CHOICES`): "stay" runs
 * nothing and is no exception, so the window has no box for it and nothing remembers it.
 */
export const RESET_STEPS = Object.freeze([
    "incident", "seals", "projects", "mastermind", "deaths",
    "remnants", "bullets", "trialFloor", "trialProgress", "bodyFound", "discovered", "searchTokens",
    "keyPlan", "eclipseMoves", "motive", "rules", "assembly",
    "items", "advancement", "actions", "despair", "overflow", "doors", "stashesFound",
    "placeCast",
    "preNotes", "sheetNotes", "cards", "chatRest",
    "clock"
]);

/** The steps of `RESET_STEPS` the window's choices ask for, not its ticks (E11 C10b). R50 holds the rest to the groups. */
export const RESET_CHOICES = Object.freeze(["placeCast"]);

/**
 * THE CAST'S GROUPS, ONE STUDENT AT A TIME (E11 C10, 10.10.2026; audit S06-21, S06-41, S08-32;
 * D12 option 1). What a cast group takes off one student, under the group's key: the reset's runs
 * below call it for every student, and tier 2's "each cast group of the reset takes what its label
 * says off one student and nothing else" calls it for one actor of its own - a reset of a real
 * world is not the suite's to run, and the cut `wipeSeason` writes first is the whole world's.
 *
 * Until C10 three of the window's promises were kept by another tick, or by none. Health, Sanity
 * and Hope came back only with `advancement` (`initCharacter`'s values), so a table that kept the
 * advances kept last season's wounds and Hope under a `despair` row that said "every Hope back to
 * the start" (S06-21). A Call armed for the next roll outlived `seals` and fell on the new season's
 * first roll, and the bedroom keys went with `items` and came back only at the next load
 * (S06-41). A stash's hiding place outlived the reset that took everything around it (S08-32).
 * Each value is the reset's constant, written with no read: it supersedes whatever a put-back
 * still owes (the plan's 1b.2). The Reroll's last roll is the GMs' store `rerollBookmarks`, cut by
 * `actions` since E08+E28 C2 (gm-stores.mjs); the actor flag `lastAction` the plan names here is
 * 1.2.63's, taken off every actor by a migration (action-rolls.mjs `dropRollBookmarks`), so
 * nothing here writes it.
 *
 * `left`, when given, collects what the `advancement` part could not tell apart (E11 C11): a
 * student's experiences a Level Up may have added before 1.2.73 wrote them down, kept on the
 * sheet, as `{ name, experiences }` - the reset's report names them (the owner's Q1 (a)).
 *
 * @returns {Promise<boolean>} false when it is not a GM's browser, not a character or no cast group.
 */
export async function wipeStudent(actor, key, { left = null } = {}) {
    if (!game.user.isGM || actor?.type !== "character") return false;
    const { trustedWrite } = await import("./resource-guard.mjs");
    const parts = {
        // An armed Call is the board's, as a seal is (D12): unset before the clock step, so
        // nothing armed is spent on a roll of the new season.
        seals: async () => {
            if (actor.getFlag(MODULE_ID, FLAGS.pendingCall) !== undefined) await actor.unsetFlag(MODULE_ID, FLAGS.pendingCall);
        },
        deaths: async () => {
            const { reviveCharacter } = await import("./chapter.mjs");
            const { setMonocub } = await import("./monocub.mjs");
            if (actor.getFlag(MODULE_ID, "monocub")) await setMonocub(actor, false);
            if (isDeceased(actor)) await reviveCharacter(actor, { quiet: true });
            // Everybody comes back whole, the living too: `reverse` resources, 0 is unharmed.
            await trustedWrite(actor, { "system.resources.hitPoints.value": 0, "system.resources.stress.value": 0 },
                { reason: "setup" });
        },
        items: async () => {
            const ids = seasonItems(actor).map(i => i.id);
            if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
            // The bedroom keys went with the rest; each owner gets theirs back at once (D12).
            await reconcileBedroomKeys({ silent: true, owners: [actor.id] });
        },
        // Restore first, THEN re-initialise: `initCharacter` stamps the starting sheet as it
        // goes, and stamping before the restore would record the advanced spread as the one to
        // come back to. The maxima only: the values are `deaths`' and `despair`'s since C10.
        // A Level Up's experiences go in the restore since E11 C11 (character.mjs `seasonExperiences`).
        advancement: async () => {
            const { restoreStartingSheet } = await import("./character.mjs");
            const restored = await restoreStartingSheet(actor);
            if (restored?.left?.length && Array.isArray(left)) left.push({ name: actor.name, experiences: restored.left });
            await initCharacter(actor, { resetValues: false, quiet: true });
        },
        // Two stamps keyed to a clock that is about to read session 1, day 1 again: "rested
        // this session" and "may betray this day". Left standing they refused the first Long
        // Rest of the new season.
        actions: async () => {
            for (const flag of [FLAGS.restsTaken, FLAGS.betrayalWindow]) {
                if (actor.getFlag(MODULE_ID, flag) !== undefined) await actor.unsetFlag(MODULE_ID, flag);
            }
        },
        despair: async () => {
            await trustedWrite(actor, { "system.resources.hope.value": STARTING.hope }, { reason: "setup" });
        },
        // "I have found X's hiding place" was written on the finder and cleared by nothing;
        // next season the same character opened the same drawer for free. And the hiding
        // places themselves.
        stashesFound: async () => {
            await forgetAllStashesFound([actor]);
            await unconcealStashes(actor.id);
        }
    };
    if (!parts[key]) return false;
    await parts[key]();
    return true;
}

/**
 * THE CAST WHERE THE GM CHOSE (E11 C10b, 1.2.73; the owner's Q2 of 09.10.2026, and of 10.10.2026
 * for a token on another map). `choice.to`: "stay" moves nothing; "bedroom" moves each student's
 * token into the room Room Setup gave them (the region flag `VAULT_FLAGS.owner`, read through
 * `allBedroomsAnywhere` - every scene, never the one on this GM's screen: ITEM-16); "point" moves
 * every student's token into the room `choice.scene`/`choice.region` names. Only on the map the room
 * is drawn on: Foundry moves no token between scenes, so a student whose token is on another map,
 * who has no token there or no bedroom, stays where they are and is answered in `stayed`, which the
 * reset's report names. A cross-scene move is E13's to measure (C3b), and a later commit's to reuse.
 *
 * A body stays where it fell and is not named: the gather's rule (call-world.mjs `gatherEveryone`,
 * DESP-15), read here off the primary's mark (`flagsHeldNow`) in the one synchronous pass that
 * decides every move before the first is made (H3). With `deaths` ticked the reset has revived
 * everybody by now; a death is still standing here only when that box was unticked.
 * A bedroom whose name another map's room already has is not found: `allBedroomsAnywhere` keeps the
 * first scene's (read in the code); that student stays and is named.
 *
 * The moves are the gather's (`teleportInto`), made by a GM, which movement.mjs does not bill.
 * Called by the reset's step on the primary GM, and by tier 2's "the cast goes where the GM chose"
 * with three students of its own.
 *
 * @returns {Promise<{moved: string[], stayed: string[]}|null>} the actor ids; null on any browser
 *   but the primary GM's, which moves nothing.
 */
export async function placeCast(choice, actors = studentActors()) {
    if (!isPrimaryGm()) return null;
    const placed = { moved: [], stayed: [] };
    const to = CAST_TO.includes(choice?.to) ? choice.to : "stay";
    if (to === "stay") return placed;
    const { flagsHeldNow } = await import("./sheet-audit.mjs");
    const { isMonocub } = await import("./monocub.mjs");
    const { teleportInto } = await import("./call-world.mjs");

    const bedrooms = to === "bedroom" ? allBedroomsAnywhere() : [];
    const pointScene = to === "point" ? game.scenes.get(choice.scene) : null;
    const pointRegion = [...(pointScene?.regions ?? [])].find(region => region.id === choice.region);
    const point = pointRegion ? { scene: pointScene, region: pointRegion } : null;
    const tokensOf = (actor, scene) => [...(scene?.tokens ?? [])].filter(token => token.actorId === actor.id);
    const batches = new Map();
    for (const actor of actors) {
        const held = flagsHeldNow(actor);
        if (isDeadForGm(held) && !isMonocub(held)) continue;
        let target = point;
        if (to === "bedroom") {
            const mine = bedrooms.filter(entry => entry.owner?.id === actor.id);
            const bedroom = mine.find(entry => tokensOf(actor, entry.scene).length) ?? mine[0];
            const region = bedroom ? [...(bedroom.scene?.regions ?? [])].find(r => r.name === bedroom.room) : null;
            target = region ? { scene: bedroom.scene, region } : null;
        }
        const tokens = target ? tokensOf(actor, target.scene) : [];
        if (!tokens.length) {
            placed.stayed.push(actor.id);
            continue;
        }
        const key = `${target.scene.id}.${target.region.id}`;
        if (!batches.has(key)) batches.set(key, { ...target, tokens: [] });
        batches.get(key).tokens.push(...tokens);
        placed.moved.push(actor.id);
    }
    for (const { scene, region, tokens } of batches.values()) await teleportInto(scene, region, tokens);
    return placed;
}

/**
 * The wipe itself.
 *
 * Each step is guarded on its own. A world where one of these settings was never
 * registered - an older save, a module half-installed - must still get the rest
 * of the reset rather than stopping at the first throw and leaving the season
 * half-cleared, which is a worse state than either end.
 */
async function wipeSeason(plan) {
    const done = [];
    const kept = [];
    const failed = [];
    // The students `placeCast` could not move (E11 C10b): the report names them.
    const stayed = [];
    // The experiences `advancement` kept because nothing told a Level Up's from the GM's (E11 C11): named likewise.
    const left = [];

    /*
     * THE CUT FIRST, AND OUTSIDE EVERY STEP (E04 C10; the design's 2.10, D12 option 1).
     * One clock patch: every wiped group cut at one stamp. The steps below delete what
     * the world holds and clear this browser's stores, whose watermark reaches a GM
     * when the two exchange copies; the cut reaches every client when the clock does
     * (gm-store.mjs `applyCuts`), each player's copies with it, and a GM's browser that
     * is closed now when it next opens this world - alone, too, with nobody to hand it
     * the clears. Written before the steps, so one that fails leaves the cut standing;
     * and when it cannot be written nothing is wiped, or a GM who was away would open
     * the world alone holding last season, and act on it.
     */
    try {
        await setClock(resetCutPatch(plan, getClock(), gmStoreStamp()));
    } catch (err) {
        error("Season reset: could not write the reset's cut on the clock, so nothing was cleared", err);
        ui.notifications.error(game.i18n.format("DRPG.GmStore.resetCutFailed", { error: String(err?.message ?? err) }));
        return null;
    }

    // A cast group's part on each student's sheet (`wipeStudent`, E11 C10).
    const everyStudent = async key => {
        for (const actor of studentActors()) await wipeStudent(actor, key, { left });
    };
    // World settings that hold nothing but this season's bookkeeping, written whole.
    const emptied = (key, value) => () => game.settings.set(MODULE_ID, key, value);
    // A group stored in several places: each part is tried, so one that throws (a setting an
    // older world never registered) does not keep the others, and the group fails if any did.
    // Until C9 each part was a step of its own; this keeps what that bought.
    const each = (...parts) => async () => {
        let failure = null;
        for (const part of parts) {
            try {
                await part();
            } catch (err) {
                failure ??= err;
            }
        }
        if (failure) throw failure;
    };

    /*
     * ONE RUN PER GROUP, IN `RESET_STEPS`' ORDER (E11 C9). A group stored in more than one
     * place - the incident, the bodies found, the discovered rooms - is cleared in all of
     * them by its one run; until C9 those were several steps under one key, spread through
     * the wipe.
     */
    const runs = {
        incident: each(async () => {
            const { endMurder, clearBlackened, clearBetrayalOffer } = await import("./murder.mjs");
            const { clearParkedMurders } = await import("./eclipse.mjs");
            /* ABANDONED, NOT CONCLUDED (E11 C9; audit S06-15). `conclude: false` skips what a
               close says about the crime (murder-rules.mjs `closeIncident`): a self-inflicted
               victim at Stage 6 is not killed into the new season, and no register row, broken
               tool, case keys, ties or card come of an incident nobody finished. */
            await endMurder({ reason: "seasonReset", followUp: false, conclude: false });
            await clearBlackened();
            // The betrayal outlives the incident by design (D18); not the season.
            await clearBetrayalOffer();
            // A murder declared in the dark and never judged is an incident that
            // has not happened yet. The declarations are a GM store of this group
            // since E05 (`pendingMurderStore`): the cut written above takes them on
            // every GM, one away now included, and this drops what this browser
            // holds. Each is named for its Eclipse, so no later lights would judge
            // it - they drop it - but a reset is where it is gone for good.
            await clearParkedMurders();
        }, async () => {
            /*
             * AN INCIDENT LEFT RUNNING OUTLIVED THE SEASON IT BELONGED TO.
             *
             * A season wiped mid-incident kept `active: true` pointing at a killer and a
             * victim who may not exist any more: `openMurder` refused every new murder
             * ("one at a time"), the GM panel's next step read "incident", and every trace
             * anybody left anywhere was tied to a crime from last season. `endMurder` above
             * wipes the record when it closes one; this is for a record no close took - one
             * another GM's write left in its place - written whole, as the motive and the
             * assembly are.
             *
             * The cast is not here since E04 (1.2.63): it is a GM store, and the close above
             * clears it through the store - `endMurder` stamps its fields null,
             * `clearBetrayalOffer` the offer - where a raw write of this GM's copy would have
             * come back from any other GM's at the next exchange. A participant's copy is
             * told by the same stamps.
             */
            await game.settings.set(MODULE_ID, SETTINGS.murderState, {});
        }),

        seals: async () => {
            const { clearSeals } = await import("./call-effects.mjs");
            await clearSeals();
            await everyStudent("seals");
        },

        projects: async () => {
            const { clearAllProjects } = await import("./projects.mjs");
            await clearAllProjects();
        },

        mastermind: async () => {
            const { clearMastermind } = await import("./mastermind.mjs");
            await clearMastermind();
        },

        deaths: async () => {
            await everyStudent("deaths");
            /* The deaths nobody found (E05 C10): the group's cut, written above, takes the GMs'
               rows on every GM and every player's copy; this drops what this browser holds. */
            const { deathStore } = await import("./gm-stores.mjs");
            if (isPrimaryGm()) await deathStore.clear();
            else await deathStore.dropMany(Object.keys(deathStore.entries()));
        },

        remnants: async () => {
            for (const scene of game.scenes) {
                const ids = scene.tokens.filter(t => t.getFlag(MODULE_ID, "isRemnant")).map(t => t.id);
                // `drpgReset`: the tombstone a deleted trace's row gets (remnants.mjs,
                // CASE-12) is not written for each of these - the cut above and the
                // clear below take every row at once. Nothing passed the option until
                // E04 C10 (the review's C-m5): every trace was tombstoned one by one,
                // and the clear ran only when a live row was left for it to see.
                if (ids.length) await scene.deleteEmbeddedDocuments("Token", ids, { drpgReset: true });
            }
            // The tokens are the half everyone can see. The register of what each
            // one really was is the half that matters, and it does not go with them:
            // these were deleted with `drpgReset`, so their rows are left to the cut
            // and to this clear.
            const { clearRemnantLedger } = await import("./remnants.mjs");
            await clearRemnantLedger();
        },

        bullets: async () => {
            const { dropSecret } = await import("./truth-bullets.mjs");
            for (const actor of game.actors) {
                const bullets = actor.items.filter(i => i.getFlag(MODULE_ID, "isTruthBullet"));
                for (const bullet of bullets) await dropSecret(bullet.uuid);
                if (bullets.length) {
                    await actor.deleteEmbeddedDocuments("Item", bullets.map(b => b.id));
                }
            }
        },

        trialFloor: emptied(SETTINGS.trialQueue, {}),
        trialProgress: emptied(SETTINGS.trialProgress, {}),
        // And the season's stamps of the bodies found (E11 C1), under the same tick: both say
        // what this season found, and its chapter 1 is not the next season's.
        bodyFound: each(emptied(SETTINGS.bodyFound, {}), emptied(SETTINGS.bodiesFound, {})),
        // The fog ledger is a GM store since E04 (D2 took it off the world); the
        // world row only clears what a world the lift has not reached may still
        // carry. Both are the `discovered` group - the same fact, stored in two
        // places - and the store's players are sent the cleared rows here.
        discovered: each(
            emptied(SETTINGS.discoveredRooms, {}),
            () => import("./fog.mjs").then(m => m.resetLedger())
        ),
        searchTokens: emptied(SETTINGS.searchTokens, {}),
        // The Key Remnant plan is a GM store since E05 (a row per chapter and slot): the cut
        // written first takes every chapter's rows on every GM, one away now included, and
        // this clears what this browser holds. Kept, it is trimmed (`keeping` below).
        keyPlan: () => import("./investigation.mjs").then(m => m.clearKeyPlan()),
        // The Eclipse's crossings are a GM store since E05: the cut written first takes them
        // on every GM and every owner's copy, and this clears what this browser holds. Each
        // is named for its Eclipse, so none would count in the new season.
        eclipseMoves: () => import("./eclipse.mjs").then(m => m.clearEclipseMoves()),
        // Written directly rather than through `setMotive("")`, which announces
        // the withdrawal in chat. Nobody needs to be told a motive is over
        // during a reset that is also clearing the chat it would be posted in.
        motive: emptied(SETTINGS.motive, {}),
        /*
         * MONOKUMA'S STANDING RULES GO WITH THE SEASON (R-1, Dawid 18.09:
         * "Domyslnie znikac").
         *
         * They used to survive it, which is the one thing in this list a table
         * would notice by accident: a new cast walking into a killing game already
         * governed by rules written for people who are dead - rules bought with
         * the Despair this reset zeroes. Ticked by default like every other group,
         * and a GM who wants to carry them over unticks the box. An empty ARRAY,
         * because that is the setting's type.
         */
        rules: emptied(SETTINGS.killingGameRules, []),
        // A standing assembly is stamped with the time of day and session it
        // was called in; the new season's first advance would otherwise find
        // the stamp stale and teleport the whole new cast into last season's
        // room. Written directly - `cancelGather` posts a card and a sound
        // into a chat that is being deleted.
        assembly: emptied(SETTINGS.pendingGather, {}),

        items: () => everyStudent("items"),

        // The most irreversible thing here, and the reason the dialog names the
        // number of advances before the word is typed. The Level Ups on offer go
        // with it (E04, the owner's Q4), and not in this step: the cut written above
        // withdraws them from every GM's store and every owner's copy - a GM or an
        // owner away now included - and an owner's sheet is drawn again when its
        // copy is cut (gm-stores.mjs `offerCopy`).
        advancement: () => everyStudent("advancement"),

        /* THE ACTION BUDGET, REFILLED - AFTER the sheet is back.
           -----------------------------------------------------------------------
           A character who had spent their actions started the new season on 0 / 2
           at Chapter 1 · Day 1 · Morning, because the reset moves the clock by
           writing it rather than by advancing it, and the refill rides on the
           advance. Reported as B-F6-1, from a full reset on a cold copy.

           The same writer the "refill actions" checkbox in Edit campaign uses, so
           there is one definition of what a full budget is. It runs after the
           advancement step above on purpose: `resetActionsFor` sizes the budget
           from the character's own state, and that state is only correct once the
           starting sheet has been restored. Search tokens need no step of their
           own beyond the `searchTokens` row: an empty store reads as a full room. */
        actions: async () => {
            const { resetAllActions } = await import("./actions.mjs");
            await resetAllActions();
            await everyStudent("actions");
        },

        despair: async () => {
            const { zeroAllDespair } = await import("./despair.mjs");
            await zeroAllDespair();
            await everyStudent("despair");
        },

        /* THE SPILL GOES WITH THE POOLS IT SPILLED OUT OF (Dawid, 30.08).
           -----------------------------------------------------------------------
           The reset emptied every Despair pool and left the overflow counter
           standing, so a new season opened carrying the last one's pressure - and
           carrying its armed stamp too, which is worse: a darkening dated to a time
           of day the new clock will reach again. Reported from a real reset.

           Through `resetOverflow` rather than a settings write, for the same reason
           the pools go through `zeroAllDespair`: one definition of empty, and it
           already clears both halves of the record. */
        overflow: async () => {
            const { resetOverflow } = await import("./overflow.mjs");
            await resetOverflow({ reason: "the season reset" });
        },

        doors: async () => {
            const { ROOM_FLAGS } = await import("./movement.mjs");
            const { startLocked } = await import("./vault.mjs");
            for (const scene of game.scenes) {
                // A room is a region with a name; the rest are shapes somebody drew.
                for (const region of Array.from(scene.regions ?? []).filter(r => r.name)) {
                    const shouldBe = startLocked(region);
                    if (Boolean(region.getFlag(MODULE_ID, ROOM_FLAGS.locked)) !== shouldBe) {
                        await region.setFlag(MODULE_ID, ROOM_FLAGS.locked, shouldBe);
                    }
                }
            }
        },

        stashesFound: () => everyStudent("stashesFound"),

        // TWO KINDS OF NOTE, TWO GROUPS (R-1). A GM keeping their own pre-session
        // notes is not the same decision as keeping what the cast wrote on their
        // sheets, and one tick for both would have forced them together.
        // The notes are a GM store since E05: the cut written first takes them on every
        // GM and every player's copy. What is left is the flag that tells the roster a
        // note is written - replaced whole, so an older world's text still in one goes too.
        preNotes: async () => {
            for (const user of game.users) {
                const flag = user.getFlag(MODULE_ID, NOTE_FLAG);
                if (flag && typeof flag === "object" && (flag.written || Object.hasOwn(flag, "text"))) {
                    await replaceFlag(user, NOTE_FLAG, { written: false });
                }
            }
        },

        sheetNotes: async () => {
            for (const actor of studentActors()) {
                const cleared = writtenNotes(actor);
                if (Object.keys(cleared).length) await actor.update(cleared);
            }
        },

        cards: async () => {
            await deleteMessages(moduleMessages().map(m => m.id));
        },

        // Separate group, and separate from the one above it: if the module's own cards
        // fail to clear, the rest of the log should still go when it was asked for, and
        // the other way round. It is the one line of this reset that reaches outside
        // the module, which is why it has always been asked for on its own - and since
        // R-1 it is asked for as a group like every other.
        chatRest: async () => {
            await deleteMessages(game.messages.map(m => m.id));
        },

        /*
         * A PATCH, NOT A NEW CLOCK (E10 C10, 1.2.71; audit S06-16, D12 option 1). The season counter
         * went nowhere - a patch that does not name `season` keeps 1 for ever - and the Final Trial's
         * flag rode into the next season's first trial ("This trial is the Final Trial."). Both are named
         * now. The audit's fix built the step from `{ ...DEFAULT_CLOCK, campaignName, ... }`: that would
         * have put DEFAULT_CLOCK's `seasonStartedAt: null` and empty `resetCuts` over what the cut above
         * wrote a moment before (season-exceptions.mjs `resetCutPatch`) - the cuts every store and the
         * fog's ledger are read under (settings.mjs reads `resetCuts.discovered`) - and a fresh
         * `Date.now()` is not the cut's stamp, the season's epoch (`seasonEpoch`) the Blackened register,
         * the stores' compaction and an Eclipse's name read. So `setClock` merges as before, and both
         * stay the cut's (tier 2, "a reset counts the season and keeps the fog epoch"). The clock is
         * kept out of the settings written whole, campaign name kept, because the name belongs to the table.
         */
        placeCast: async () => {
            stayed.push(...((await placeCast(plan.cast))?.stayed ?? []));
        },

        clock: async () => {
            const clock = getClock();
            await setClock({
                chapter: 1, day: 1, session: 1, timeOfDay: "morning",
                phase: "dailyLife", eclipse: false, pausedAt: null,
                timeOfDayStartedAt: serverNow(),
                // Kept: the season is new, the campaign is not.
                campaignName: clock.campaignName,
                season: (clock.season ?? 1) + 1,
                finalTrial: false
            });
        }
    };

    /*
     * KEPT IS NOT WHOLE (E05 fix r1-G5, M3). Ticked, the Key Remnant plan is cleared as any
     * other group. Unticked, every chapter's rows would ride into the new season - which is
     * not what 1.2.63's single stored plan ever did: it held one chapter's plan and showed
     * it again only once the clock reached that number, so a season that never revisited it
     * never had it "planned". Read before the "clock" step sends the chapter back to 1,
     * because after that every chapter is "other than the clock's".
     */
    const keeping = {
        keyPlan: async () => {
            const keptChapter = getClock().chapter;
            try {
                const dropped = await import("./investigation.mjs").then(m => m.keepOnlyKeyPlanChapter(keptChapter));
                if (dropped) log(`Season reset: the Key Remnant plan is kept for chapter ${keptChapter} only (${dropped} other row(s) dropped).`);
            } catch (err) {
                error(`Season reset: could not trim the kept Key Remnant plan to chapter ${keptChapter}`, err);
            }
        }
    };

    /*
     * EVERY STEP IS GATED BY ITS OWN GROUP (R-1, Dawid 18.09).
     *
     * A group the GM unticked is an exception: this returns before the work, and
     * the log says what was kept as well as what went - because "cleared: nine
     * things" with no mention of the seven that stayed is the half of the sentence
     * that gets misread later. R50 holds `RESET_STEPS`, `RESET_GROUPS` and the runs
     * above to the same keys: a run nobody listed would never be asked for, and a tick
     * with no run would silently not apply.
     *
     * A STEP THAT FAILS IS TOLD (E11 C9; audit S06-49, the plan's 3.4). Until then its
     * error went to the console alone and the GM read "The season has been reset"; at
     * 4fcc2b4 scenario 65 F measured a reset whose chat could not be deleted reporting
     * success. The rest still runs, and the cut stays written: a group already cut
     * reads empty, so running the reset again with only the failed groups ticked is safe.
     */
    const step = async key => {
        // A choice's step (E11 C10b) is asked for by its choice; left at "stay" it runs nothing and keeps nothing.
        if (RESET_CHOICES.includes(key)) {
            if ((plan.cast?.to ?? "stay") === "stay") return;
        } else if (!plan.groups.has(key)) {
            kept.push(key);
            await keeping[key]?.();
            return;
        }
        try {
            if (typeof runs[key] !== "function") throw new Error(`no run clears the group "${key}"`);
            await runs[key]();
            done.push(key);
        } catch (err) {
            error(`Season reset: could not clear ${key}`, err);
            failed.push(key);
        }
    };
    for (const key of RESET_STEPS) await step(key);

    log(`Season reset. Cleared: ${done.join(", ") || "nothing"}.${
        kept.length ? ` Kept: ${kept.join(", ")}.` : ""}${failed.length ? ` Failed: ${failed.join(", ")}.` : ""}`);
    const label = key => RESET_CHOICES.includes(key) ? game.i18n.localize("DRPG.Season.resetCastTitle") : groupLabel(key);
    const names = keys => keys.map(label).join("; ");
    // Who stayed where they were, by name (E11 C10b): on the card and in a warning of its own.
    const stayedLine = stayed.length ? game.i18n.format("DRPG.Season.reportCard.stayed",
        { names: stayed.map(id => game.actors.get(id)?.name ?? id).join(", ") }) : "";
    if (failed.length) {
        ui.notifications.error(game.i18n.format("DRPG.Season.failed", { groups: names(failed) }));
    } else {
        ui.notifications.info(kept.length
            ? plural("DRPG.Season.resetDoneKept", { n: kept.length })
            : game.i18n.localize("DRPG.Season.resetDone"));
    }
    if (stayedLine) ui.notifications.warn(stayedLine);
    /* The experiences left in place (E11 C11; the owner's Q1 (a), the plan's 3.4): a starting sheet stamped before
       1.2.73 with no experience in it cannot tell a Level Up's from the GM's, so they stay and the GMs read whose and
       which on the card - on the card only: they are a question for the GM's next look at the sheets, not news. */
    const leftLine = left.length ? game.i18n.format("DRPG.Season.reportCard.experiences",
        { list: left.map(entry => `${entry.name}: ${entry.experiences.join(", ")}`).join("; ") }) : "";
    if (leftLine) log(`Season reset: ${leftLine}`);
    if (failed.length || stayedLine || leftLine) {
        try {
            const line = (key, keys) => keys.length
                ? `<p>${esc(game.i18n.format(`DRPG.Season.reportCard.${key}`, { groups: names(keys) }))}</p>` : "";
            // The card says the reset did not finish only when it did not; one that finished and left
            // somebody standing has a title of its own, and one that left experiences on a sheet another.
            const title = failed.length ? "DRPG.Season.reportCard.title"
                : leftLine ? "DRPG.Season.reportCard.titleLeft" : "DRPG.Season.reportCard.titleCast";
            await whisperToGms(`<h3>${esc(game.i18n.localize(title))}</h3>
                ${failed.length ? `${line("failed", failed)}${line("done", done)}${line("kept", kept)}` : ""}${
                stayedLine ? `<p>${esc(stayedLine)}</p>` : ""}${leftLine ? `<p>${esc(leftLine)}</p>` : ""}`);
        } catch (err) {
            error("Season reset: could not post its report", err);
        }
    }
    return { cleared: done, kept, failed, stayed, left };
}
