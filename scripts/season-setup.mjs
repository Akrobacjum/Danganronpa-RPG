/**
 * Danganronpa RPG - setting a season up.
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
 *
 * TAKING ONE DOWN LIVES IN season-wipe.mjs (E42 C5, 1.2.97): the reset's window
 * (`resetSeason`), its steps in their order (`RESET_STEPS`, `wipeSeason`), each
 * student's part (`wipeStudent`), where the cast goes (`placeCast`), its record
 * (`seasonResetRecord`, `unfinishedGroups`) and the registry entries of the
 * groups this reset owns itself, moved by a pure move that
 * `node tools/moved-only.mjs` proves line by line. This file keeps the wizard
 * and its checks and re-exports the nine names it exported from there, so
 * every importer still imports this file; season-wipe.mjs imports nothing of
 * it (the facade rule, .claude/rules/code.md).
 */

// `ROOMS_PER_PLAYER` is not read here any more: the ratio and its rounding
// live in `roomsWantedFor`, so both screens that print it agree by
// construction (audit A21).
import {
    MODULE_ID, STARTING, UNCOVERED_LIMIT_PCT, ROOM_IMAGE_LIMITS
} from "./config.mjs";
import { SETTINGS, DEFAULT_SAFEWORD, setSetting, isDeadForGm } from "./settings.mjs";
import { safeword } from "./safeword.mjs";
import { getClock } from "./clock.mjs";
import { studentActors, isMonokuma, studentCensus, classCandidates } from "./monokuma.mjs";
import { monokumaFor, feedsNobody, explicitPool, assignments } from "./assignments.mjs";
import { listExperiences, initCharacter, needsStartingResources } from "./character.mjs";
import { carriableCategories } from "./inventory.mjs";
// Static, and safe to be: vault.mjs never reaches back here, and `steps()` is
// synchronous - a `done` that had to await could not answer at all.
import { roomCensus, roomRatioLine, roomsWantedFor } from "./vault.mjs";
import { monokumas } from "./despair.mjs";
import { overflowThreshold, overflowSuggestion, overflowSuggestionLine } from "./overflow.mjs";
// A leaf: which named regions no GM has decided yet (E12 C1).
import { unmarkedRegions, sceneHoldsRooms, isPlaceScene, homeScene, schoolScene, trialScene,
    namedRegions } from "./rooms.mjs";
// How much of a map is in no room, on its worst floor (E20 C1; fix round C-4), and what of Check rooms the rooms row
// waits on (fix round G-1): fog-diagnostics.mjs never reaches back here.
import { sceneUncoveredShare, roomCheckProblems } from "./fog-diagnostics.mjs";
import { mastermindActor, mastermindUnpooled } from "./mastermind.mjs";
import { liveKitSecretWarning, liveKitConnectionSettings } from "./voice.mjs";
import { foundryGivenBack, openGiveBackFoundry } from "./enforced.mjs";
// The hall's report, the one the Scenes tab prints (E51 C8, the First session screen): trial-scene.mjs never reaches back here.
import { scenesReportOf } from "./trial-scene.mjs";
import { log, error, plural, workingScene, esc, localeFormat, listOf } from "./utils.mjs";
import { stepperId, drpgWindow, checkList, formGrid } from "./ui-kit.mjs";
// Edit campaign's fields, reader, writes and End the chapter part (E49 A1e): gm-campaign.mjs never reaches back here.
import { campaignRows, readClockForm, applyCampaignForm, endChapterPart, endTheChapter } from "./gm-campaign.mjs";
import { alreadyOpen, handOff, RAISED } from "./live.mjs";
// Foundry's secret doors and the players' rulers (E80 C5): the doors as the map holds them, their
// conversion, and the permissions in force where `core.permissions` names none.
import { secretDoorsOn } from "./passages.mjs";
import { convertSecretDoors } from "./passages-gm.mjs";
import { permissionsInForce } from "./enforced.mjs";
export { resetTallies, resetGoesHtml, resetSeason, RESET_STEPS, RESET_CHOICES, wipeStudent, placeCast, seasonResetRecord, unfinishedGroups } from "./season-wipe.mjs";


/**
 * The two roles that run the game. Read from the constants rather than written
 * as 3 and 4, because the numbers are Foundry's to change and the names are not.
 */
const GM_ROLES = [CONST.USER_ROLES.ASSISTANT, CONST.USER_ROLES.GAMEMASTER];

/**
 * Which GM roles currently broadcast their pointer. See the `cursor` step. The roles in force
 * (E20 C1, S06-28), as the `rulers` row reads them: this read the stored `SHOW_CURSOR ?? []`, so a
 * world that never stored the permission - Foundry's default, every role's pointer shown - read
 * as private and the row ticked.
 */
function gmRolesSharingCursor() {
    try {
        const allowed = cursorRoles(game.settings.get("core", "permissions") ?? {}, permissionsInForce());
        return GM_ROLES.filter(r => allowed.includes(r));
    } catch {
        // Unreadable permissions are not a finding - say nothing rather than
        // put a repair button under a question this cannot answer.
        return [];
    }
}

/* The two player roles whose movement ruler the `rulers` step hides and shows. */
const PLAYER_ROLES = [CONST.USER_ROLES.PLAYER, CONST.USER_ROLES.TRUSTED];

/**
 * The roles that hold Foundry's SHOW_RULER, sorted: as `core.permissions` (`stored`) names them, else
 * as the permissions in force do (enforced.mjs `permissionsInForce`), else every role from Player up -
 * the default this module assumes for v14, not read in v14's source (LIVE-E80-02).
 */
export function rulerRoles(stored, inForce) {
    return permissionRoles("SHOW_RULER", stored, inForce);
}

/** The roles that hold Foundry's SHOW_CURSOR, read as `rulerRoles` reads SHOW_RULER (E20 C1). Exported for R1501. */
export function cursorRoles(stored, inForce) {
    return permissionRoles("SHOW_CURSOR", stored, inForce);
}

/** One permission's roles, sorted: as `stored` names them, else as `inForce` does, else every role from Player up. */
function permissionRoles(name, stored, inForce) {
    const list = Array.isArray(stored?.[name]) ? stored[name]
        : Array.isArray(inForce?.[name]) ? inForce[name]
            : Object.values(CONST.USER_ROLES).filter(role => role >= CONST.USER_ROLES.PLAYER);
    return [...new Set(list.map(Number))].sort((a, b) => a - b);
}

/**
 * Hide (`show` false) or Show the movement ruler of the Player and Trusted Player roles (E80 C5, S18,
 * P1-19): a player's ruler, which the whole table sees while a token is dragged, draws a route through
 * a passage too. Only SHOW_RULER's two player roles change; every other permission and role of
 * `core.permissions` is written back as it was read. Answers how many of the two roles changed, and
 * writes nothing when none did. `settings` and `inForce` are the suite's to hand (R601).
 */
export async function setPlayerRulers(show, { settings = game.settings, inForce = permissionsInForce() } = {}) {
    const perms = foundry.utils.deepClone(settings.get("core", "permissions") ?? {});
    const before = rulerRoles(perms, inForce);
    const after = show ? [...new Set([...before, ...PLAYER_ROLES])].sort((a, b) => a - b) : before.filter(role => !PLAYER_ROLES.includes(role));
    const changed = PLAYER_ROLES.filter(role => before.includes(role) !== after.includes(role)).length;
    if (!changed) return 0;
    perms.SHOW_RULER = after;
    await settings.set("core", "permissions", perms);
    return changed;
}

/** The player roles that hold the movement ruler now; none when the permissions cannot be read, as `gmRolesSharingCursor`. */
function playerRolesWithRuler() {
    try {
        const roles = rulerRoles(game.settings.get("core", "permissions") ?? {}, permissionsInForce());
        return PLAYER_ROLES.filter(role => roles.includes(role));
    } catch {
        return [];
    }
}

/** Each scene with a Foundry secret door, `{ scene, n }`: what the `secretDoors` step names. */
function scenesWithSecretDoors() {
    return Array.from(game.scenes ?? []).map(scene => ({ scene, n: secretDoorsOn(scene).length })).filter(({ n }) => n > 0);
}

/** The `secretDoors` step's Convert: every scene's secret doors (passages-gm.mjs `convertSecretDoors`). Answers how many. */
async function convertDoorsStep() {
    const out = await convertSecretDoors();
    if (out?.plain?.length) ui.notifications.warn(plural("DRPG.Season.secretDoorsPlain", { n: out.plain.length }));
    return out?.converted ?? 0;
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
        // Quiet (E51 C6; audit S06-46): the row reports the count once ("DRPG.Season.fixed"), not a warning per sheet.
        await initCharacter(actor, { quiet: true });
        n++;
    }
    return n;
}

/** Take the GM roles off Foundry's SHOW_CURSOR permission. Answers how many came off. */
async function fixCursorPermission() {
    const perms = foundry.utils.deepClone(
        game.settings.get("core", "permissions") ?? {});
    // The roles in force (E20 C1): with nothing stored, the stored `?? []` took nothing off.
    const before = cursorRoles(perms, permissionsInForce());
    const after = before.filter(r => !GM_ROLES.includes(r));
    if (after.length === before.length) return 0;
    perms.SHOW_CURSOR = after;
    await game.settings.set("core", "permissions", perms);
    return before.length - after.length;
}

/** The rooms-per-student line under the room count step: the Doors tab's own sentence (vault-store.mjs `roomRatioLine`, E20 C1). */
function roomCountLine(census, living) {
    return `<div class="notes">${foundry.utils.escapeHTML(roomRatioLine(census, living))}</div>`;
}

/*
 * THE LAST CHECK ROOMS, PER SCENE (E20 C1, S06-28). "The map has rooms" ticked, and Pre-season said
 * "ok", after the Check rooms button had found three border errors on the same map. The button
 * records how many errors it found on the scene it checked, in this browser until a reload; the
 * rooms row and Pre-season's scene line read it. A scene never checked has no errors on record.
 */
const lastRoomChecks = new Map();

/** The room guide and the Check rooms button under the rooms step. */
function roomGuideHtml() {
    return `<div class="drpg-room-guide">
        <p>${foundry.utils.escapeHTML(game.i18n.localize("DRPG.Season.roomGuide"))}</p>
        <p><button type="button" data-drpg-check>${
            foundry.utils.escapeHTML(game.i18n.localize("DRPG.Season.checkRooms"))}</button></p>
        <div data-drpg-check-out class="drpg-room-check"></div>
    </div>`;
}

/**
 * Every named region of every scene nobody has decided, once per name, as the Pre-season row
 * names them: "Scene: Region" when they lie on more than one scene (E12 fix r1-G2, 11.10.2026;
 * review round 1 CR1-4). The row read the scene on screen, so a GM viewing another floor saw it
 * done while regions drawn on the school since the migration were nobody's rooms. Every scene
 * rather than every place scene: a place scene is one that holds a room (rooms.mjs
 * `isPlaceScene`), and a floor drawn since the migration with nothing marked holds none, so it
 * would be the one left out.
 */
function undecidedRegionNames(scenes = Array.from(game.scenes ?? [])) {
    const found = scenes.flatMap(scene => unmarkedRegions(scene).map(region => ({ scene, region })));
    const several = new Set(found.map(({ scene }) => scene)).size > 1;
    return [...new Set(found.map(({ scene, region }) => several ? `${scene.name}: ${region.name}` : region.name))];
}

/**
 * The checklist's rows. Every argument is the world's unless handed in (E20 C1: R1501, R1503 and
 * R1505 hand an empty cast, scenes of plain objects, an assignment map and a record of room checks):
 * `roster` the students, `scenes` the scenes the room rows count, `roomScene` the scene they judge,
 * `assigned` Despair Flow's map, `lastChecks` the room checks by scene id (how many problems each found,
 * `roomCheckProblems`), `liveKit` avclient-livekit's connection setting (R1523 hands one), `givenBack` whether
 * Foundry's settings are given back (enforced.mjs `foundryGivenBack`; R1532 hands it), `hallScene` the trial hall
 * and `dsn` whether Dice So Nice is on (R1132 hands both; null reads the module list).
 */
export function steps({ roster = studentActors(), scenes = Array.from(game.scenes ?? []), roomScene: judged,
    assigned = assignments(), lastChecks = lastRoomChecks, liveKit = liveKitConnectionSettings(), givenBack = foundryGivenBack(),
    hallScene = trialScene(), dsn = null } = {}) {
    const clock = getClock();
    /* THE ROOM ROWS READ A PLACE (E13 C5, 12.10.2026; the orchestrator's re-anchor decision 6 of
       11.10, rule A). They read the scene on the GM's screen, and a GM viewing the trial hall -
       where every GM is taken for the trial since E13 C3, and which holds no room since C1 - was
       told the season had no rooms. On a scene that is no place they read the school (`homeScene`). */
    const viewed = judged === undefined ? workingScene() : null;
    const roomScene = judged !== undefined ? judged : isPlaceScene(viewed) ? viewed : homeScene();
    /* WAITING FOR THE CAST (E20 C1, S06-28). On an empty world every row over the students ticked:
       `.every` on an empty list is true, so "Starting Health" and "Everybody has an Ultimate" read done
       while only "The cast exists" was red. Those rows wait now - not done, no cross, no button - and
       say so (`setupRows`). */
    const waiting = roster.length === 0;
    const census = roomCensus(roomScene);
    const living = studentCensus(roster).count;
    // The rooms row's facts (E20 C1, S06-28, S07-33): every scene with rooms counted, the judged one named.
    const withRooms = scenes.filter(sceneHoldsRooms);
    // The worst floor's share, and that floor's name on a scene of several (E20 fix round, C-4).
    const share = roomScene ? sceneUncoveredShare(roomScene) : { pct: 0, floor: null };
    const uncovered = share.pct;
    const checkErrors = roomScene ? (Number(lastChecks.get(roomScene.id)) || 0) : 0;
    const anyNamed = scenes.some(scene => namedRegions(scene).length > 0);
    const nobody = a => feedsNobody(a, assigned);
    const byHand = a => explicitPool(a, assigned);
    // The First session screen's facts (E51 C8): the hall's report, Dice So Nice's state, and Foundry's module list.
    const hall = hallReady(hallScene);
    const diceSoNice = dsn ?? Boolean(game.modules?.get?.("dice-so-nice")?.active);
    const modulesWindow = foundry.applications?.sidebar?.apps?.ModuleManagement ?? null;

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
            waiting,
            done: !waiting && roster.every(a => !needsStartingResources(a)),
            missing: () => roster.filter(needsStartingResources).map(a => a.name),
            // The one row that can finish itself: the guide's numbers are the
            // guide's numbers, and there is nothing to decide.
            fix: fixResources,
            // Its own verb (E22 C2b, O11): the row's button said "Do it".
            doKey: "DRPG.Season.resourcesButton"
        },
        {
            key: "ultimate",
            waiting,
            done: !waiting && roster.every(a => a.getFlag(MODULE_ID, "ultimate")),
            missing: () => roster.filter(a => !a.getFlag(MODULE_ID, "ultimate")).map(a => a.name),
            // An Ultimate is a sentence somebody writes, so this opens the sheet
            // rather than inventing one. By id (E51 C6): the names are for the eye.
            open: () => openFirstSheet(roster.filter(a => !a.getFlag(MODULE_ID, "ultimate")).map(a => a.id))
        },
        {
            key: "experiences",
            waiting,
            done: !waiting && roster.every(a => listExperiences(a).length >= STARTING.experiences),
            missing: () => roster.filter(a => listExperiences(a).length < STARTING.experiences)
                .map(a => `${a.name} (${listExperiences(a).length}/${STARTING.experiences})`),
            open: () => openFirstSheet(roster.filter(a => listExperiences(a).length < STARTING.experiences).map(a => a.id))
        },
        {
            key: "items",
            /*
             * A KEY IS NOT AN OPENING ITEM (audit A25). This counted every
             * category, and assigning somebody a bedroom hands them a key - so
             * every student with a room passed this row carrying nothing else.
             * `carriableCategories` is the list without keys and bullets.
             */
            waiting,
            done: !waiting && roster.every(hasOpeningItem),
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
               The row below says so when it has been done anyway.
               ASSIGNED BY HAND (E20 C1, S06-28). `monokumaFor` falls back to the first pool, so this
               ticked for every student the moment one pool existed; it asks the assignment itself
               (`explicitPool`), as Pre-season checks do, and names the pool a student falls back to. */
            waiting,
            done: !waiting && roster.every(a => nobody(a) || byHand(a)),
            missing: () => roster.filter(a => !nobody(a) && !byHand(a)).map(a => {
                const fallback = monokumaFor(a);
                return fallback ? game.i18n.format("DRPG.Season.fallsBackTo", { name: a.name, pool: fallback.name }) : a.name;
            }),
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
            // Uneven is said (E46-C5b, S13-36 (2)): a warning with its counts, not an optional row's quiet mark.
            warnKey: "DRPG.Season.splitUneven",
            waiting,
            done: !waiting && despairSplitEven(),
            missing: () => despairSplitCounts().map(p => `${p.name}: ${p.n}`),
            open: async () => (await import("./gm-team-dialog.mjs")).openGmTeamDialog()
        },
        {
            /* THE OVERFLOW THRESHOLD FOR THIS CAST (E20 C6, S02-59, D21). The default is tuned for sixteen players;
               this row works the module's formula out for the living cast and the pools, and is advisory: done when
               the threshold is the suggestion, a dash otherwise, since the GM decides. Waits with no cast. A cast with
               no living student has no suggestion (E20 fix round, C-8 = G-10): the row read "Suggested for 0 students
               and 1 pool: null"; it is not done, and its line says a suggestion comes with living students
               (`overflowSuggestionLine`). */
            key: "overflow",
            optional: true,
            waiting,
            done: !waiting && living > 0 && overflowThreshold() === overflowSuggestion(living),
            missing: () => [game.i18n.format("DRPG.Season.overflowNow", {
                line: overflowSuggestionLine(living, monokumas().length), n: overflowThreshold() })],
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
             * `optional: true`, which is trap 118 and the reason this row is
             * advisory rather than blocking when it is not met: a map smaller than the
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
            /* ONE CENSUS (E20 C1, S07-38; Q-3): `roomCensus` against the living, the count the Doors
               tab and Pre-season checks print; with no room it is not done, whatever the cast. */
            waiting,
            done: !waiting && census.count > 0 && census.count >= roomsWantedFor(living),
            missing: () => [],
            extra: () => roomCountLine(census, living)
        },
        {
            key: "rooms",
            /* A ROOM, NOT A REGION (E12 fix r1-G5, 11.10.2026; review goal-r1 N1). This was done
               on `regions.size`, so a scene holding only a Teleport, or a player's region, passed
               it; it asks rooms.mjs now, the question the row's words ask.
               CHECKED, NOT ONLY PRESENT (E20 C1, S06-28, S07-33): done when a scene holds rooms and the
               scene it judges has at most `UNCOVERED_LIMIT_PCT` in no room and no error from its last
               Check rooms; the line under it names that scene and counts every scene with rooms. */
            done: withRooms.length > 0 && sceneHoldsRooms(roomScene) && uncovered <= UNCOVERED_LIMIT_PCT && !checkErrors,
            missing: () => [
                ...(roomScene && uncovered > UNCOVERED_LIMIT_PCT
                    ? [game.i18n.format("DRPG.Season.roomsUncovered", { pct: uncovered, scene: share.floor
                        ? game.i18n.format("DRPG.Fog.sceneFloor", { scene: roomScene.name, floor: share.floor }) : roomScene.name })] : []),
                ...(checkErrors ? [plural("DRPG.Season.roomsCheckErrors", { n: checkErrors, scene: roomScene.name })] : [])
            ],
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
            extra: () => `${withRooms.length ? `<div class="notes">${esc(plural("DRPG.Season.roomsJudged",
                { n: withRooms.length, scene: roomScene?.name ?? "" }))}</div>` : ""}${roomGuideHtml()}`
        },
        {
            /*
             * EVERY NAMED REGION DECIDED (E12 C1, 11.10.2026; rooms.mjs). From 1.2.74 a region is
             * a room only when a GM marked it; the migration marked what a world had once
             * (`markRooms`), so a region drawn since is nobody's decision until a GM makes it.
             * This row names them; the button opens Room Setup on the tab with the column.
             */
            key: "roomsMarked",
            // With no named region there is nothing decided (E20 C1, S06-28): not done, and it says so.
            done: anyNamed && undecidedRegionNames(scenes).length === 0,
            missing: () => anyNamed ? undecidedRegionNames(scenes) : [game.i18n.localize("DRPG.Season.noNamedRegions")],
            open: async () => (await import("./vault.mjs")).openRoomSetupDialog({ tab: "doors" })
        },
        {
            /*
             * THE HALL AND ITS TOKENS (E51 C8, 31.10.2026; audit S17-49; E51-48), the First session screen's first row:
             * a trial hall linked, and nothing the Scenes tab warns of in it - a student with no token the module can
             * make, a second token, an unlinked one, a room region, a dark hall (trial-scene.mjs `sceneReport`). Optional,
             * as the Scenes row under it: a table may hold its trial on the school's map. Open is that tab.
             */
            key: "hallTokens",
            group: FIRST_SESSION,
            optional: true,
            done: hall.done,
            missing: () => hall.missing,
            open: async () => (await import("./vault.mjs")).openRoomSetupDialog({ tab: "scenes" })
        },
        {
            /*
             * THE SCHOOL AND THE TRIAL HALL LINKED (E13 C5; plan-E13 C5, D7). With both linked
             * every road into the Class Trial takes the table to the hall and back (trial-scene.mjs
             * `followPhase`); with neither the trial opens wherever the table is, as before 1.2.74.
             * `optional: true` for that reason - a table that holds its trial on the school's map
             * has decided something. The button opens Room Setup on the Scenes tab.
             */
            key: "scenes",
            group: FIRST_SESSION,
            optional: true,
            done: Boolean(schoolScene() && trialScene()),
            missing: () => [],
            open: async () => (await import("./vault.mjs")).openRoomSetupDialog({ tab: "scenes" })
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
            doKey: "DRPG.Season.cursorButton",
            // ITS OWN SENTENCE (SEASON-02). `DRPG.Season.fixed` counts characters
            // given their starting resources, which is the other `fix` row; this one
            // counts GM roles that have stopped broadcasting their pointer.
            fixedKey: "DRPG.Season.fixedCursor"
        },
        /* FOUNDRY'S SECRET DOORS (E80 C5, S16, P1-17). Every player's browser holds a secret door as
           world data, and Foundry lets a player open it; the module's own road is a passage. Offered,
           the same shape as the cursor row: Convert makes each an ordinary wall, and a passage nobody
           knows where it stands between two rooms (passages-gm.mjs `convertSecretDoors`). Read on every
           scene of the world, as the map check reads the one on screen. */
        {
            key: "secretDoors",
            optional: true,
            done: !scenesWithSecretDoors().length,
            missing: () => scenesWithSecretDoors().map(({ scene, n }) => `${scene.name} (${n})`),
            fix: convertDoorsStep,
            doKey: "DRPG.Season.convertDoors",
            fixedKey: "DRPG.Season.fixedSecretDoors"
        },
        /* THE PLAYERS' RULERS (E80 C5, S18, P1-19). A player's ruler is drawn for the whole table while a
           token is dragged, a route through a passage with it. A table that likes the ruler keeps it, so the
           row is optional, and Show stands beside it once it is hidden (`undo`). */
        {
            key: "rulers",
            optional: true,
            done: !playerRolesWithRuler().length,
            missing: () => playerRolesWithRuler().map(roleName),
            fix: () => setPlayerRulers(false),
            doKey: "DRPG.Season.hideRulers",
            fixedKey: "DRPG.Season.fixedRulers",
            undo: () => setPlayerRulers(true),
            undoKey: "DRPG.Season.showRulers",
            undoneKey: "DRPG.Season.undoneRulers"
        },
        /* THE MODULE HOLDS NOTHING (E20 fix round, the goal review's G-2). After Give back Foundry's settings the module
           writes none of them until a GM holds them again - also after it was switched off and on, which is when a GM
           forgets. Optional: a table may want Daggerheart's automations; Open is the Give back window, Hold them again. */
        {
            key: "foundryHeld",
            // The First session screen's ENFORCED row (E51 C8): what enforced.mjs holds of Foundry's settings.
            group: FIRST_SESSION,
            optional: true,
            done: !givenBack,
            missing: () => [],
            open: () => openGiveBackFoundry()
        },
        /* DICE SO NICE (E51 C8, 31.10.2026; audit S17-49; E51-48). The module draws every player's throw on the GM
           (roll-draw.mjs) and keeps each player's dice look (dice-sync.mjs) for it; a table without it rolls, and sees
           no dice. Optional. Open is Foundry's module list, where it is switched on - offered only where this Foundry
           has the window under the name v13 gives it (`foundry.applications.sidebar.apps.ModuleManagement`, from
           memory, not read on v14); the row says its state either way. */
        {
            key: "diceSoNice",
            group: FIRST_SESSION,
            optional: true,
            done: diceSoNice,
            missing: () => [],
            ...(modulesWindow ? { open: () => new modulesWindow().render({ force: true }) } : {})
        },
        /* A SELF-HOSTED VOICE SERVER'S SECRET IN THE WORLD (S11-59; voice.mjs
           `liveKitSecretWarning`). Only while it is true; a cross with nothing to open,
           because the setting is avclient-livekit's and the repair is choosing a server
           that keeps its secret to itself. The sentence is the voice diagnosis's.
           A ROW THE MODULE CANNOT FINISH (E20 fix round, the correctness review's C-1): `external`, so the GM panel's
           Next line (`firstOutstandingStep`) does not wait on it - with a self-hosted LiveKit it never offered the
           Eclipse. The row is still drawn, crossed. */
        ...(liveKitSecretWarning(liveKit) ? [{
            key: "liveKitSecret",
            hintKey: "DRPG.Voice.liveKitSecret",
            external: true,
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

/* THE FIRST SESSION SCREEN (E51 C8, 31.10.2026; audit S17-49; E51-48). What a GM new to the module sets once before
   the first session, beyond the season's own rows - the hall and its tokens, the Scenes, what the module holds of
   Foundry (ENFORCED) and Dice So Nice - in several windows, which nothing gathered: rows of the checklist marked with
   this group, drawn under their own heading (`firstSessionHtml`), each with its state and Open as any row. */
export const FIRST_SESSION = "firstSession";

/** The hall's row: done when a hall is linked and its report is empty; the report's lines, as text, otherwise. */
function hallReady(hall) {
    if (!hall) return { done: false, missing: [game.i18n.localize("DRPG.Season.noHall")] };
    let rows = [];
    try { rows = scenesReportOf(schoolScene(), hall); } catch (err) { error("Could not read the trial hall's report", err); }
    // The report's lines are markup (names escaped for the Scenes tab); the row escapes what it is handed.
    const text = html => { const box = document.createElement("template"); box.innerHTML = html; return box.content.textContent; };
    return { done: rows.length === 0, missing: rows.map(row => text(row.text)) };
}

/** The First session screen: its heading, its note and its rows, drawn as the checklist's. Exported for R1132. */
export function firstSessionHtml(list) {
    const rows = list.filter(step => step.group === FIRST_SESSION);
    if (!rows.length) return "";
    return `<section class="drpg-setup-first" data-drpg-group="${FIRST_SESSION}">
            <h3>${esc(game.i18n.localize("DRPG.Season.firstSession"))}</h3>
            <p class="notes">${esc(game.i18n.localize("DRPG.Season.firstSessionNote"))}</p>
            ${setupRows(rows, { label: game.i18n.localize("DRPG.Season.firstSession") })}
        </section>`;
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

/**
 * THE FIRST STEP (E20 C4, S10-57; Q-8): the first row a season still needs - neither optional nor done - or null
 * once every required row holds. The GM panel's Next line names it until then (gm-panel.mjs `nextStep`), so a world
 * with no cast is sent here and not to the Eclipse.
 * E20 fix round: a row the module cannot finish (`external`, C-1: a self-hosted LiveKit's secret) is not waited on;
 * and the rooms are judged on the school (`homeScene`, C-7), not on the scene this GM happens to view - a side map
 * of two rooms told the Next line the season was not set up.
 */
export function firstOutstandingStep(list = steps({ roomScene: homeScene() })) {
    return list.find(step => !step.done && !step.optional && !step.external) ?? null;
}

/**
 * Open the sheet of the first character a row is waiting on.
 * Awaited since E20 C4 (S06-30): the checklist comes back once this resolves and raises what opened in the meantime
 * (`raiseOpened`), so the sheet has to be on the page by then, not still rendering.
 */
/* BY ID, NOT BY A NAME'S START (E51 C6, 31.10.2026; audit S06-46; E51-38). It took the first student whose name the
   row's line began with, so with Ann before Anna in the roster, Anna's row ("Anna (1/3)") opened Ann's sheet. The row
   hands over the ids of the students it waits on, in its roster's order. */
async function openFirstSheet(ids) {
    const first = (ids ?? []).map(id => game.actors.get(id)).find(Boolean) ?? null;
    await first?.sheet?.render({ force: true });
}

/* ==========================================================================
 * WHAT A ROW'S OPEN OPENED (E20 C4, S06-30)
 * --------------------------------------------------------------------------
 * A row's Open closes the checklist, opens its window and brings the checklist back, built fresh. A window that does
 * not hold the errand until it closes - a character's sheet, or a window already open that `alreadyOpen` only raises -
 * was left under the checklist that came back over it, and the Open looked like it did nothing. The windows the
 * errand opened or raised are read against the stack taken before it, and raised again over the new checklist.
 * Foundry's windows only (ApplicationV2); whether `position.zIndex` moves as read here is not measured on a real
 * Foundry (the harness's windows carry none).
 * ========================================================================== */

const zOf = app => Number(app?.position?.zIndex) || 0;
const standing = app => Boolean(app?.rendered && app.element?.isConnected);

/** Every window on the page, by id, with how high it stands - taken before a row acts. */
export function windowStack(apps = foundry.applications.instances.values()) {
    const stack = new Map();
    for (const app of apps) if (standing(app)) stack.set(app.id, zOf(app));
    return stack;
}

/** The windows opened since `before`, or raised above where they stood then; never the checklist itself. */
export function windowsOpenedSince(before, apps = foundry.applications.instances.values()) {
    return [...apps].filter(app => standing(app) && !app.options?.classes?.includes("drpg-window-season")
        && (!before.has(app.id) || zOf(app) > before.get(app.id)));
}

/** Bring those windows in front of the checklist that came back; answers them. */
export function raiseOpened(before, apps = foundry.applications.instances.values()) {
    const opened = windowsOpenedSince(before, apps);
    for (const app of opened) {
        try { app.bringToFront?.(); } catch (err) { error("Could not bring a window in front of Set the season up", err); }
    }
    return opened;
}

/**
 * EDIT CAMPAIGN AT THE TOP (E49 A1e, 11.11.2026; the owner: "Season setup becomes the one place for setting up the
 * season", Edit campaign's content the first thing seen, and the fields this window had of its own - the name, the
 * chapter and the safeword, two of them Edit campaign's too - each once). One block, `fieldset.drpg-setup-campaign`
 * (E20 C4, S06-30: Save writes it, and a GM who presses Save has it in sight): Edit campaign's rows as that window draws
 * them (gm-campaign.mjs `campaignRows`) - the name, the chapter, the phase, the day, the session, the time of day, the
 * refill box - with the safeword after the six, then End the chapter apart at its foot (`endChapterPart`), as at the foot
 * of Edit campaign. The name field carries `autofocus`, so the window's own focusing lands on it rather than on the
 * footer's Save (S01-19). Read back by `readSeasonForm`, written by `applyCampaignForm`, as Edit campaign's Apply writes.
 */
export function campaignFieldsHtml(clock, word) {
    const L = key => game.i18n.localize(key);
    const wordId = stepperId();
    /*
      E15: the safeword, next to the campaign's name and not buried in a settings menu. It is a decision a table makes
      once, at the same moment it decides what the campaign is called - and a safety tool filed under configuration is
      a safety tool nobody has read.
    */
    const safewordRows = [
        { label: L("DRPG.Season.safeword"), id: wordId,
          field: `<input type="text" name="safeword" id="${wordId}" value="${esc(word ?? "")}" placeholder="${esc(DEFAULT_SAFEWORD)}" />` },
        { full: `<p class="notes">${esc(L("DRPG.Season.safewordNote"))}</p>` }
    ];
    return `<fieldset class="drpg-setup-campaign">
            <legend>${esc(L("DRPG.Panel.jump"))}</legend>
            ${formGrid(campaignRows(clock ?? {}, { extra: safewordRows, autofocus: true }))}
            ${endChapterPart()}
        </fieldset>`;
}

/**
 * THE WINDOWS A SEASON IS SET UP IN, A ROW OF THE GM PANEL'S TILES UNDER EDIT CAMPAIGN (E49 A1e; the owner, 11.11.2026:
 * Despair Flow, The Mastermind, Killing game rules below it, their tiles out of the GM panel's Between sessions; 12.11.2026:
 * the row "the same shape as the GM panel's tiles", with their glyphs, "always at the bottom of Season setup, always
 * visible", and the checklist that was this window's lower half a window of its own, opened from the row). The tiles are
 * gm-panel.mjs `SEASON_TILES`, drawn by its `tileHtml` - `button.drpg-gmp-button[data-drpg-run]`, an icon and a label -
 * inside `.drpg-gm-panel .drpg-gmp-grid`, so the panel's look and glyphs (keyed on `data-drpg-run`) reach them in both
 * themes. Drawn in `drpgWindow`'s `pinned`, under the body that scrolls and above the footer. `tiles` is handed in
 * (season-setup.mjs cannot import gm-panel.mjs, which imports it); a group named for a reader. Exported for R3580.
 */
export function seasonTilesHtml(tiles, tileHtml) {
    const label = esc(game.i18n.localize("DRPG.Season.windows"));
    return `<div class="drpg-gm-panel drpg-season-tiles"><div class="drpg-gmp-grid" role="group" aria-label="${label}">${
        tiles.map(tile => tileHtml(tile)).join("")}</div></div>`;
}

/**
 * THE WINDOW OPENS AT ITS TOP (E20 C4, S01-19). Save is the default button, and DialogV2 marks the default with
 * `autofocus`; with the footer pinned across the scroll (utils.mjs `pinFooterAcrossScroll`, retired by E21 C2a), focusing
 * it is the likely reason the window opened scrolled to the bottom (the audit's reading; not measured on a real Foundry
 * here). Save stays the default for Enter; only its autofocus goes, the campaign name takes the focus without
 * scrolling, and the content is put back at its top. Answers the element it focused. The content that scrolls is the
 * kit's body since E21 C2b (`.drpg-kit-body`; `.window-content` before, still read where there is no kit body).
 *
 * AND COMES BACK WHERE IT WAS (E20 fix round, the correctness review's C-2; S06-30 again). This ran on every render,
 * so after a row's Do it or Open, or Pre-season checks, the window came back at its top with the caret in Campaign
 * name and the row just acted on below the fold. `place` is what the copy that closed carried (`readDraft`): its
 * scroll and the row it acted on (`step`) or the footer button pressed (`action`). With a place the scroll is put
 * back and that row's button, or that footer button, takes the focus without scrolling (a row done since has no
 * button left: nothing is focused then, and the scroll still holds); only a fresh open goes to the top.
 */
export function seasonOpening(root, place = null) {
    if (!root) return null;
    for (const button of root.querySelectorAll("footer [autofocus]")) button.removeAttribute("autofocus");
    const content = scroller(root);
    const focus = el => { try { el?.focus({ preventScroll: true }); } catch { /* a control that cannot take the focus */ } };
    if (place) {
        const row = place.step ? root.querySelector(`li.drpg-check-row[data-drpg-key="${CSS.escape(String(place.step))}"]`) : null;
        // A footer button, or one of the tiles pinned under Edit campaign (E49 A1e).
        const action = place.action ? CSS.escape(String(place.action)) : null;
        const target = action ? root.querySelector(`footer [data-action="${action}"], .drpg-season-tiles button[data-drpg-run="${action}"]`)
            : row?.querySelector(":scope > button[data-drpg-action]") ?? null;
        focus(target);
        if (content) content.scrollTop = Number(place.scrollTop) || 0;
        return target ?? null;
    }
    const first = root.querySelector('.drpg-setup-campaign input[name="campaignName"]');
    focus(first);
    if (content) content.scrollTop = 0;
    return first ?? null;
}

/** The box of the window that scrolls: the kit's body (E21 C2b), or `.window-content` where there is none. */
const scroller = root => root?.querySelector?.(".drpg-kit-body") ?? root?.querySelector?.(".window-content") ?? null;

/* ==========================================================================
 * THE WINDOW
 * ========================================================================== */

/**
 * The fields this window collects, as they stand on screen (SEASON-02, 20.09): since E49 A1e Edit campaign's six, its
 * refill box and the safeword.
 *
 * A checklist row that acts closes this window and opens it again so the marks are
 * current, and the copy that comes back is built from the WORLD - so anything typed
 * and not yet applied was thrown away by the act of fixing the row above it. Read
 * before the close, painted back after the reopen.
 *
 * Only these, by name: everything else in the window is a read-out, and the
 * reset panel is its own window with its own confirmation.
 *
 * And where the GM was (E20 fix round, C-2): `place`, the content's scroll and the row acted on (`step`) or the
 * footer button or window button pressed (`action`), which `seasonOpening` puts back on the copy that comes back.
 * Exported for R1524. The refill box carries its tick (`reset`, true or false; null where there is no box).
 */
export function readDraft(root, { step = null, action = null } = {}) {
    if (!root) return null;
    const value = name => root.querySelector(`[name="${name}"]`)?.value ?? null;
    const box = root.querySelector('input[type="checkbox"][name="reset"]');
    const scrollTop = Number(scroller(root)?.scrollTop) || 0;
    return { campaignName: value("campaignName"), chapter: value("chapter"), phase: value("phase"), day: value("day"),
        session: value("session"), timeOfDay: value("timeOfDay"), safeword: value("safeword"), reset: box ? box.checked : null,
        place: { scrollTop, step, action } };
}

/** Put a carried draft back on the fields, once the new copy has rendered. */
function paintDraft(root, draft) {
    if (!root || !draft) return;
    for (const [name, value] of Object.entries(draft)) {
        if (value === null || name === "place") continue;
        const field = root.querySelector(`[name="${name}"]`);
        // The value the GM typed, including a deliberately emptied field - which is
        // why this writes whatever came back rather than only non-empty strings. The refill box its tick (E49 A1e).
        if (field?.type === "checkbox") field.checked = Boolean(value);
        else if (field) field.value = value;
    }
}

/**
 * The steps as one list of the kit's checks (E46-C5b, 09.11.2026; card M4, S13-36): ui-kit.mjs `checkList`, a row a step,
 * `li.drpg-check-row[data-drpg-key]` - done `done`; one that waits for the cast `waiting` (no mark, no button: E20 C1,
 * S06-28); a step with a `warnKey` not done `warning`, its line in that key's words (the uneven Despair split: "Uneven:
 * {counts}."); an optional one `advisory`; any other `blocking`, the only red - so the hint that the Mastermind's row
 * "never turns red" holds. The detail: the hint, what it waits on (`.drpg-setup-missing`), its `extra`. Exported for R1501.
 */
export function setupRows(list, { label = null } = {}) {
    return checkList(list.map(step => {
        const waits = Boolean(step.waiting) && !step.done;
        const state = step.done ? "done" : waits ? "waiting" : step.warnKey ? "warning" : step.optional ? "advisory" : "blocking";
        const names = step.done ? [] : waits ? [game.i18n.localize("DRPG.Season.waitingForCast")] : step.missing();
        const said = state === "warning" ? game.i18n.format(step.warnKey, { counts: listOf(names) }) : names.join(", ");
        // Blocks, not spans: under the glass a panel's `span` is pinned to the chrome floor (stained-glass.css), and the
        // hint is running text at the base size (E20 C4, S01-21; R1515).
        const detail = `<div class="drpg-setup-hint">${esc(game.i18n.localize(step.hintKey ?? `DRPG.Season.hint.${step.key}`))}</div>${
            names.length ? `<div class="drpg-setup-missing">${esc(said)}</div>` : ""}${step.extra ? step.extra() : ""}`;
        // A ROW THAT OPENS NOTHING OFFERS NOTHING (SEASON-02, 20.09). "The cast
        // exists" carried an "Open" button and no `open`, so pressing it threw inside
        // the handler, was logged, and closed and reopened the window for nothing -
        // and brought the GM panel with it. Its hint already says what to do, and
        // creating characters is Foundry's own sidebar rather than a window of ours.
        // A row with an `undo` (E80 C5, the rulers) offers it once it is done, its own word on it.
        const action = step.done
            ? (step.undo ? { action: "undo", label: game.i18n.localize(step.undoKey) } : null)
            : waits || step.inline || !(step.fix || step.open)
                ? null
                : { action: "do", label: game.i18n.localize(step.doKey ?? "DRPG.Season.openIt") };
        // Its key on the row (E20 fix round): Check rooms draws the rooms row again in place (`repaintStep`), and a round
        // trip finds the row it acted on (`seasonOpening`).
        return { key: step.key, state, title: game.i18n.localize(`DRPG.Season.step.${step.key}`), detail, action };
    }), { label });
}

/**
 * What Save hands back: Edit campaign's reading of its fields (gm-campaign.mjs `readClockForm`: the name trimmed, the
 * chapter, day and session whole numbers from 1, the chapter no higher than its field's `max`, the phase, the time of
 * day and the refill box) and the safeword. Exported for R1125.
 *
 * THE CHAPTER HELD TO THE SEASON (E51 C6, 31.10.2026; audit S06-46; E51-38): a whole number from 1 to the field's own
 * `max` (the season's chapters, or the clock's chapter past them), where "-2" and "2.5" were written as they came - read
 * since E49 A1e by Edit campaign's reader, which held it the same way (R2058).
 */
export function readSeasonForm(d) {
    const f = d.element.querySelector("form");
    return {
        ...readClockForm(d),
        // Blank means "put the default back", which is what
        // `safeword()` reads an empty setting as. Written blank
        // rather than filled in here so the two agree.
        safeword: f.safeword.value.trim()
    };
}

/**
 * One row of the checklist drawn again in place (E20 fix round, the goal review's G-1): its mark, its state, the line
 * of what it waits on and its button, from `setupRows`, while the rest of the row - the room guide, Check rooms and
 * its findings - stays as it is. The list's one listener (`wireSetupSteps`) runs the buttons, so a button the redraw
 * brings works. Exported for R1526.
 */
export function repaintStep(li, step) {
    if (!li || !step) return;
    const box = document.createElement("template");
    box.innerHTML = setupRows([step]);
    const fresh = box.content.querySelector("li.drpg-check-row");
    if (!fresh) return;
    li.dataset.drpgState = fresh.dataset.drpgState;
    const mark = li.querySelector(":scope > .drpg-check-mark");
    const nextMark = fresh.querySelector(":scope > .drpg-check-mark");
    if (mark && nextMark) mark.replaceWith(nextMark);
    const detail = li.querySelector(":scope > .drpg-check-text > .drpg-check-detail");
    const missing = detail?.querySelector(":scope > .drpg-setup-missing") ?? null;
    const nextMissing = fresh.querySelector(":scope > .drpg-check-text > .drpg-check-detail > .drpg-setup-missing");
    if (missing && nextMissing) missing.replaceWith(nextMissing);
    else if (missing) missing.remove();
    else if (nextMissing) detail?.querySelector(":scope > .drpg-setup-hint")?.after(nextMissing);
    const button = li.querySelector(":scope > button[data-drpg-action]");
    const nextButton = fresh.querySelector(":scope > button[data-drpg-action]");
    if (button && nextButton) button.replaceWith(nextButton);
    else if (button) button.remove();
    else if (nextButton) li.append(nextButton);
}

/** The Check rooms button under the rooms step: run the region check and print its findings in place. */
function wireRoomCheck(dialog) {
    const checkButton = dialog.element.querySelector("[data-drpg-check]");
    const checkOut = dialog.element.querySelector("[data-drpg-check-out]");
    checkButton?.addEventListener("click", async ev => {
        ev.preventDefault();
        const [{ checkRegions }, { roomCheckHtml }] = await Promise.all([import("./fog.mjs"), import("./fog-diagnostics.mjs")]);
        const findings = checkRegions();
        /* What the rooms row and Pre-season's scene line read (`lastRoomChecks`, E20 C1): the problems - the errors and the
           warnings that break the fog (`roomCheckProblems`, E20 fix round G-1), where the errors alone were kept; and the
           rooms row drawn again with them, where it kept the mark the window opened with. */
        if (canvas?.scene?.id) lastRoomChecks.set(canvas.scene.id, roomCheckProblems(findings));
        repaintStep(dialog.element.querySelector('li.drpg-check-row[data-drpg-key="rooms"]'), steps().find(s => s.key === "rooms"));
        if (!findings.length) {
            checkOut.innerHTML = `<p class="notes">${
                esc(game.i18n.localize("DRPG.Season.checkClean"))}</p>`;
            return;
        }
        // Each explanation once, above the list, and a Show on map per row in place of raw coordinates (E20 C2, S07-14).
        checkOut.innerHTML = roomCheckHtml(findings, canvas?.scene?.id ?? null);
    });
    if (checkOut) import("./fog-diagnostics.mjs").then(({ wireShowOnMap }) => wireShowOnMap(checkOut))
        .catch(err => error("Could not wire Show on map", err));
}

/**
 * Each step's Do it / Open it button: fix or open, then come back to a fresh window.
 *
 * `onHandOff` is how the round trip reaches the window's opener, which returns it in
 * place of its own answer - see the note inside. `reopen` draws the window again with the draft (the Season checklist's
 * since E49 A1e, where the rows went).
 */
function wireSetupSteps(dialog, onHandOff, reopen) {
    /* One listener on the list, not one per button (E20 fix round, G-1): Check rooms draws the rooms row again in place
       (`repaintStep`), and a button the redraw brings was wired by nobody. */
    // Each list: the checklist's and the First session screen's (E51 C8).
    // The kit's checklists (E46-C5b): the row's button is `data-drpg-action` "do" or "undo", its step the row's key.
    for (const list of dialog.element.querySelectorAll("ul.drpg-checklist")) list.addEventListener("click", async ev => {
        const button = ev.target?.closest?.("li.drpg-check-row > button[data-drpg-action]");
        if (!button || !list.contains(button)) return;
        ev.preventDefault();
        const key = button.closest("li.drpg-check-row")?.dataset.drpgKey;
        const step = steps().find(s => s.key === key);
        if (!step) return;
        // The windows on the page before the row acts, so the checklist that comes back can raise what it opened (S06-30).
        const before = windowStack();
        try {
            if (button.dataset.drpgAction === "undo" && step.undo) {
                const n = await step.undo();
                ui.notifications.info(plural(step.undoneKey, { n }));
            } else if (step.fix) {
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
         * `await dialog.close(); openSeasonSetup();` (the checklist's window since E49 A1e) resolved the
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
        // And the row acted on, with the scroll, so the copy that comes back opens there (C-2).
        const draft = readDraft(dialog.element, { step: step.key });
        onHandOff(handOff(dialog, () => reopen({ draft, opened: before })));
    });
}

/**
 * The tiles pinned under Edit campaign (`SEASON_TILES`, E49 A1e): a press opens its window as a row's Open does - in
 * front of this one, which stays until that window answers, then closes and comes back built from the world (what the
 * window changed may change a row: Despair Flow the pools' rows, The Mastermind its own) with the fields as typed and the
 * focus on the button pressed (`readDraft`'s `action`), and what was opened raised in front of it (S06-30). The same
 * `handOff` as a row's (SEASON-02): the tile that opened this window waits for the real end of the round trip.
 */
function wireSeasonTiles(dialog, tiles, onHandOff) {
    const row = dialog.element.querySelector(".drpg-season-tiles");
    row?.addEventListener("click", async ev => {
        const button = ev.target?.closest?.("button[data-drpg-run]");
        const entry = tiles.find(t => t.key === button?.dataset.drpgRun);
        if (!entry || !row.contains(button) || button.disabled) return;
        ev.preventDefault();
        const before = windowStack();
        try {
            await entry.run();
        } catch (err) {
            error(`Could not open "${entry.key}" from Season setup`, err);
        }
        const draft = readDraft(dialog.element, { action: entry.key });
        onHandOff(handOff(dialog, () => openSeasonSetup({ draft, opened: before })));
    });
}

export async function openSeasonSetup({ draft = null, opened = null } = {}) {
    // ONE OF THESE, NOT FOUR - see `alreadyOpen` in live.mjs. Two copies of a
    // window each read the world when they opened and neither knows about the
    // other, so the older one goes on looking authoritative while showing
    // something that stopped being true. Raised rather than refused: pressing
    // twice usually means the window is behind something.
    if (alreadyOpen("drpg-window-season")) return RAISED;

    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const clock = getClock();
    // The panel's tiles, by `import()`: gm-panel.mjs imports this file (E49 A1e).
    const { SEASON_TILES, tileHtml } = await import("./gm-panel.mjs");

    // A tile's round trip, if one is running: this window did not answer, it
    // handed over (SEASON-02). Set by `wireSeasonTiles` (a row's Open's, `wireSetupSteps`, until E49 A1e, when the
    // rows went to the Season checklist) through the callback the render below gives it, and read after the wait.
    let roundTrip = null;
    // End the chapter, pressed at the foot of Edit campaign's block: this window closes unsaved, as Edit campaign does.
    let endAsked = false;

    const result = await drpgWindow({
        classes: ["drpg-panel", "drpg-window-season"],
        /* THE TABLES' WIDTH, 58rem (E49 A1d, the owner's approval of 11.11.2026: the footer in one row and the window on
           the screen at 1366x768). With Reset the season the footer holds four buttons; at "wide" (44rem, 704 px) they
           wrapped to two rows in both themes and both languages (Chromium on probe 08's capture, the style harness:
           Cancel 136, Pre-season checks 201-307, Reset the season 171-227, Save 136 px, Polish under Legacy 780 px in
           all), the window 36 px taller. R3533. KEPT WITH EDIT CAMPAIGN AT ITS TOP (E49 A1e): the footer three buttons since
           Pre-season checks left it, and the four tiles pinned above the footer one row at this width; the width is the
           one the owner approved. */
        width: "tables",
        title: game.i18n.localize("DRPG.Season.title"),
        /* EDIT CAMPAIGN, THEN THE ROW OF TILES PINNED ABOVE THE FOOTER (E49 A1e; the owner, 11.11.2026: Edit campaign "the
           first thing seen", the buttons below it; 12.11.2026: the row "always at the bottom, always visible", only Edit
           campaign scrolling when the window is short, and the checklist a window of its own, `openSeasonChecklist`). */
        body: `<form>
            ${campaignFieldsHtml(clock, safeword())}
        </form>`,
        pinned: seasonTilesHtml(SEASON_TILES, tileHtml),
        /* THE FOOTER BY ROLE (E21 C2b): Save the primary; Cancel, since Save is still to answer (E21 rule 3), its answer
           "close" as before. PRE-SEASON CHECKS LEFT IT IN E49 A1e: a button of the row under Edit campaign on 11.11.2026,
           the Season checklist's own button since 12.11.2026 (the owner), the same window by the same call.
           RESET THE SEASON, DESTRUCTIVE, ON THE LEFT (E49 A1d, 11.11.2026; the owner: "Chcialbym wrzucic season reset w set the season up, a calosc przemianowac na
           "season setup". W wolne miejsce wejda nowe ustawienia gma jako "Settings""): the GM panel's tile of its own
           until then. The press answers "reset" and nothing of the form is written; the window closes and the reset
           runs as the tile ran it, season-wipe.mjs `resetSeason` with its own window and every question it asks
           (nothing about what a reset does changed). Never the default: a destructive role cannot be (BUTTON_ROLES). */
        footer: {
            primary: {
                action: "save", label: game.i18n.localize("DRPG.Assign.save"),
                callback: (e, b, d) => readSeasonForm(d)
            },
            destructive: [{ action: "reset", label: game.i18n.localize("DRPG.Season.resetTitle") }],
            close: { role: "cancel", action: "close" }
        },
        // Wire the buttons against the mounted DOM - a listener attached
        // to the detached content element never reaches the page. Same reason
        // projects-ui.mjs wires its portrait pickers from `render`.
        render: (event, dialog) => {
            // A draft carried over from the copy that closed for a tile's window (SEASON-02).
            paintDraft(dialog.element, draft);
            wireSeasonTiles(dialog, SEASON_TILES, trip => { roundTrip = trip; });
            // End the chapter (Edit campaign's part): the window closes without its Save, then the question.
            dialog.element.querySelector("[data-drpg-end-chapter]")?.addEventListener("click", ev => {
                ev.preventDefault();
                endAsked = true;
                dialog.close();
            });
            // At its top, on its first field (S01-19), or where the copy that closed was (C-2); then what a tile
            // opened, in front of it (S06-30).
            seasonOpening(dialog.element, draft?.place ?? null);
            if (opened) raiseOpened(opened);
        },
        rejectClose: false
    });

    if (endAsked) return endTheChapter(() => import("./chapter.mjs").then(m => m.openChapterEndDialog()));
    if (roundTrip) return roundTrip;
    if (!result || result === "close") return null;
    if (result === "reset") return (await import("./season-wipe.mjs")).resetSeason();

    /* EDIT CAMPAIGN'S APPLY, AS IT IS (E49 A1e; the owner: "keep its data writes exactly as they are"): gm-campaign.mjs
       `applyCampaignForm`, the function Edit campaign's Apply runs - its questions (a chapter moved, the trial entered),
       the assembly called off for a corrected hour, `setClock`, the Eclipse's warning when the clock moved, the refill
       only when ticked. Until E49 A1e this window wrote the name and the chapter itself with `setClock`, asking nothing,
       and warned of an Eclipse when the chapter moved (E51 C6); the warning is Edit campaign's now, said once. */
    await applyCampaignForm(result);

    // Only when it moved. Every write to this setting redraws every open sheet
    // (see its `onChange`), and pressing Save on this window is something a GM
    // does repeatedly.
    if (result.safeword !== safeword()) {
        await setSetting(SETTINGS.safeword, result.safeword);
        log(`Safeword set to "${safeword()}".`);
    }

    log(`Season setup saved: "${result.campaignName}", chapter ${result.chapter}.`);
    return result;
}

/**
 * THE SEASON CHECKLIST (E49 A1e, 12.11.2026; the owner: Season setup's lower half - "N still to do", its rows with their
 * Open buttons, the First session rows - "moves OUT of Season setup into a NEW window opened by its own button in the
 * row", and Pre-season checks with it, as a button there). The window Season setup's rows were until then, as they were:
 * the intro, the rows (`setupRows`), the First session rows (`firstSessionHtml`), the note; a row's Do it or Open a round
 * trip that brings this window back (`wireSetupSteps`), Check rooms in place (`wireRoomCheck`). Pre-season checks its
 * secondary button, as it was Season setup's until E49 A1e: the window closes with where it was, the checks' window
 * answers, and this one comes back there. Close, a read-out's (E21 C2b): nothing here is a form. Opened by Season setup's
 * tile (gm-panel.mjs `SEASON_TILES`) and the Next line's Go (`EXTRA_ACTIONS.seasonChecklist`).
 */
export async function openSeasonChecklist({ draft = null, opened = null } = {}) {
    if (alreadyOpen("drpg-window-season-checklist")) return RAISED;
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const list = steps();
    // The First session screen's rows under their own heading, the rest as they were (E51 C8).
    const rows = setupRows(list.filter(step => step.group !== FIRST_SESSION), { label: game.i18n.localize("DRPG.Season.checklistTitle") });
    const outstanding = list.filter(s => !s.done && !s.optional).length;
    // A row button's round trip, if one is running (SEASON-02), as in Season setup until E49 A1e.
    let roundTrip = null;

    const result = await drpgWindow({
        classes: ["drpg-panel", "drpg-window-season-checklist"],
        // Season setup's width, which the rows had there (E49 A1d).
        width: "tables",
        title: game.i18n.localize("DRPG.Season.checklistTitle"),
        body: `<p>${esc(game.i18n.format(outstanding
                ? "DRPG.Season.introOutstanding"
                : "DRPG.Season.introReady", { n: outstanding }))}</p>

            ${rows}
            ${firstSessionHtml(list)}
            <p class="notes">${esc(game.i18n.localize("DRPG.Season.note"))}</p>`,
        footer: {
            secondary: [
            // "What is missing" and "fix it" are one errand (the checks were a GM-panel tile beside Set the season up
            // once). The place is read here, while the window is on screen: a bare action would answer the string
            // "checks", which carries nothing.
            {
                action: "checks", label: game.i18n.localize("DRPG.Panel.seasonChecks"),
                callback: (e, b, d) => ({ checks: true, draft: readDraft(d.element, { action: "checks" }) })
            }],
            close: { role: "close", action: "close" }
        },
        render: (event, dialog) => {
            /*
             * The room check reports INTO THE WINDOW, not only to the console.
             * The person who has to act on "this room overlaps that one" is a GM
             * in the region editor, and telling them to open devtools is telling
             * them not to bother. The console copy stays: it carries the
             * coordinates in a form that can be pasted.
             */
            wireRoomCheck(dialog);
            wireSetupSteps(dialog, trip => { roundTrip = trip; }, openSeasonChecklist);
            // At its top, or where the copy that closed was (C-2); then what a row's Open opened, in front of it (S06-30).
            seasonOpening(dialog.element, draft?.place ?? null);
            if (opened) raiseOpened(opened);
        },
        rejectClose: false
    });

    if (roundTrip) return roundTrip;
    if (result?.checks) {
        await runPreSessionChecks();
        return openSeasonChecklist({ draft: result.draft });
    }
    return null;
}

/* ==========================================================================
 * START HERE (E20 C4, S01-61)
 * --------------------------------------------------------------------------
 * A GM who turns the module on sees a new look and a GM button, and nothing says that a season is built in Set the
 * season up. On a world with no campaign name and no student, a GM is told so once, with a button that opens it.
 * Once per browser (a client setting, `startHereShown`), marked when shown: a GM who closes it has read it.
 * ========================================================================== */

/** Whether "Start here" is due: a GM, no campaign name, no student, not told on this browser before. */
export function startHereDue({ isGM, campaignName, students, shown }) {
    return Boolean(isGM) && !String(campaignName ?? "").trim() && Number(students) === 0 && !shown;
}

/**
 * At `ready`: tell a GM where to start when `startHereDue` says so. Answers whether it was told. Every input can be
 * handed in (R1513 hands a settings stand-in and an `ask` that counts); the window itself is `askStartHere`.
 */
export async function offerStartHere({ user = game.user, clock = getClock(), roster = studentActors(), settings = game.settings,
    ask = askStartHere } = {}) {
    let shown = false;
    try { shown = Boolean(settings.get(MODULE_ID, SETTINGS.startHereShown)); } catch { shown = false; }
    if (!startHereDue({ isGM: user?.isGM, campaignName: clock?.campaignName, students: roster?.length ?? 0, shown })) return false;
    try { await settings.set(MODULE_ID, SETTINGS.startHereShown, true); } catch (err) { error("Could not note that Start here was shown", err); }
    // Not awaited: a window the GM reads while the rest of `ready` goes on.
    try { Promise.resolve(ask()).catch(err => error("Could not say where to start", err)); } catch (err) { error("Could not say where to start", err); }
    return true;
}

/** The notice: where to start, a button to Set the season up, and Close. */
async function askStartHere() {
    // A notice with its one road (E21 C2b): Set the season up the primary, Close.
    const answer = await drpgWindow({
        classes: ["drpg-panel", "drpg-window-start-here"],
        title: game.i18n.localize("DRPG.Season.startHereTitle"),
        body: `<p>${esc(game.i18n.localize("DRPG.Season.startHereText"))}</p>`,
        footer: { primary: { action: "open", label: game.i18n.localize("DRPG.Season.title") }, close: { role: "close", action: "close" } },
        rejectClose: false
    });
    if (answer === "open") await openSeasonSetup();
}

/**
 * Both pre-session checks, answered in one window.
 *
 * "Is everybody set up" and "can anybody read a sheet they should not" are one
 * question asked at one moment - before a session - so they are one tile and
 * now one answer. Neither report goes to chat from here: they are handed back
 * as text and put on screen, because a question asked with a button should be
 * answered where the button was. Exported for E46-T4, which reads the window it draws.
 */
export async function runPreSessionChecks() {
    const [body, { wireAnonymityFix }] = await Promise.all([preSessionReport(), import("./anonymity.mjs")]);
    // A read-out: Close (E21 C2b).
    await drpgWindow({
        classes: ["drpg-panel", "drpg-window-preseason"],
        width: "wide",
        title: game.i18n.localize("DRPG.Panel.seasonChecks"),
        body,
        footer: { close: { role: "close", action: "close" } },
        render: (event, dialog) => {
            // Set them to Observer (E20 C2, S11-19): the audit's own fix, drawn again in place.
            wireAnonymityFix(dialog.element.querySelector("[data-drpg-anon]"));
            // The dice look's whole window (E60 C5b2): this browser's read, with no test throw.
            dialog.element.querySelector("[data-drpg-dice-look]")?.addEventListener("click", ev => {
                ev.preventDefault();
                import("./dice-look.mjs").then(m => m.diagnoseDiceLook({ test: false })).catch(err => error("Could not open the dice look", err));
            });
        },
        rejectClose: false
    });
}

/**
 * The Pre-season checks window's body (E20 C3, from `runPreSessionChecks`, so the suite reads it without a window):
 * the cast, the scenes, the voice rows, the room pictures and the anonymity audit. `av` hands the A/V facts in
 * (`{ mode, on, available }`, R1510), `scenes` the scenes whose room pictures are checked and `head` their HEAD
 * request (R1510, R1511, E20-T2), `contract` a run of the contract (patches.mjs `runContract`; R1541), `diceLook` the
 * dice look's findings (dice-look.mjs `lookFindings`; R1300); each is the world's unless handed.
 *
 * @param {object} [options]
 * @returns {Promise<string>} HTML
 */
export async function preSessionReport({ av = {}, scenes = game.scenes, head, probeMs, givenBack = foundryGivenBack(), contract = null,
    diceLook } = {}) {
    const [{ diagnoseCharacters }, { auditAnonymity }, { diagnoseScenes }, { videoUnwatched, avOffForTile, videoWithoutAudio },
        { checkRoomImages }, { runContract }] = await Promise.all([
        import("./diagnostics.mjs"), import("./anonymity.mjs"), import("./fog.mjs"), import("./voice-tile.mjs"), import("./room-tile.mjs"),
        import("./patches.mjs")
    ]);
    const esc = text => foundry.utils.escapeHTML(String(text ?? ""));

    const setup = diagnoseCharacters({ toChat: false });
    const anon = await auditAnonymity({ toChat: false });
    // A scene that has rooms but still uses Foundry's own vision renders as a
    // black screen for players on v14 and says nothing about why, so it belongs
    // on the list of things checked before anybody sits down.
    const sceneLines = diagnoseScenes({ lastChecks: lastRoomChecks });
    // E78 C5 (the owner's Q11, the A9 design's `avVideo`): a world in audio-and-video mode sends every camera while
    // the voice tile stands in for the dock, which shows none of them. E20 C3 (amend 11.10): the two worlds where the
    // tile the GM switched on cannot stand - A/V off, and video alone. A row only when one is so; each a warning (the
    // GM decides: the tile, or Foundry's A/V), keyed by its sentence's key.
    const voice = [avOffForTile(av) && "checksAvOff", videoWithoutAudio(av) && "checksAvVideoOnly", videoUnwatched(av) && "checksAvVideo"].filter(Boolean);
    const video = voice.length ? checkPart("voice", game.i18n.localize("DRPG.Voice.panel.legend"),
        checkList(voice.map(key => ({ key, state: "warning", title: game.i18n.localize(`DRPG.Panel.${key}`) })),
            { label: game.i18n.localize("DRPG.Voice.panel.legend") })) : "";
    const pictures = roomImagesSection(await checkRoomImages({ scenes, ...(head ? { head } : {}), ...(probeMs ? { probeMs } : {}) }), esc,
        probeMs ?? ROOM_IMAGE_LIMITS.probeMs);
    // The module holds nothing while Foundry's settings are given back (E20 fix round, G-2): said first, it explains the rest.
    const held = givenBack ? checkPart("givenBack", null, checkList([{ key: "givenBack", state: "warning",
        title: game.i18n.localize("DRPG.GiveBack.preSeason") }])) : "";
    // The contract (E52 C2, E52-05): run now, the rows the load's notice names, so the report says what holds today.
    const reaches = contractSection(contract ?? runContract(), esc);
    const dice = diceLookSection(diceLook === undefined ? await diceLookFindingsHere() : diceLook, esc);
    // The characters no player owns, named as NPCs to mark (E24 C3a; the owner's Q-E24-5): a row only when there is one,
    // advisory, and nothing marked by itself - the GM decides on each sheet ("Not in the class").
    const unowned = classCandidates();
    const npcs = unowned.length ? checkList([{ key: "classCandidates", state: "advisory", title: game.i18n.format("DRPG.Class.candidates",
        { names: listOf(unowned.map(actor => actor.name)) }) }]) : "";
    const castHead = game.i18n.localize("DRPG.Panel.checksSetup"), scenesHead = game.i18n.localize("DRPG.Fog.checksScenes");

    /* ONE CHECKLIST A PART (E46-C5b, 09.11.2026; card M4: "red only for a blocking row"). The cast and the scenes come as
       marked text (diagnostics.mjs `diagnoseCharacters`, fog.mjs `diagnoseScenes`, read on c1046f5e: a line "✓ " or
       "✗ ", a fix line indented under a cross, the header lines unmarked) and are read into rows here (`markedChecks`);
       a cross there is blocking - a student not set up, a scene the players see black. The contract, the dice look, the
       room pictures and the voice are built here from data. The anonymity audit stays the audit's own markup with its
       marks (`checkMarks`, R1530): anonymity.mjs `wireAnonymityFix` draws it again in place after "Set them to Observer". */
    return `<div>
            ${held}
            ${checkPart("cast", castHead, markedChecks(setup, { label: castHead }) + npcs)}
            ${checkPart("scenes", scenesHead, markedChecks(sceneLines, { label: scenesHead }))}
            ${pictures}
            ${video}
            ${reaches}
            ${dice}
            ${checkPart("anonymity", game.i18n.localize("DRPG.Anonymity.audit.title"), `<div data-drpg-anon>${checkMarks(anon.body ?? "")}</div>`)}
        </div>`;
}

/** One part of Pre-season's report: its heading (none for a part that explains the rest) and its body (E46-C5b). */
function checkPart(part, heading, body) {
    return `<section class="drpg-check-part" data-drpg-check-part="${part}">${
        heading ? `<h3>${foundry.utils.escapeHTML(heading)}</h3>` : ""}${body}</section>`;
}

/**
 * A report of marked text as the kit's checks (E46-C5b): a line marked "✓ " a `done` row, "✗ " a `crossed` row
 * (blocking unless handed otherwise), an unmarked line under a row (indented: a fix, a reason) that row's detail, and an
 * unmarked line elsewhere (the report's header, "no scene has rooms") fine print where it stands. Every line kept, in
 * its order (D31). Exported for R2033.
 */
export function markedChecks(text, { crossed = "blocking", label = null } = {}) {
    const out = [];
    let rows = [];
    const flush = () => { if (rows.length) out.push(checkList(rows.map(row => ({ ...row,
        detail: row.lines.map(line => `<span class="drpg-check-line">${esc(line)}</span>`).join("") })), { label })); rows = []; };
    for (const raw of String(text ?? "").split("\n")) {
        const line = raw.trim();
        if (!line) continue;
        const mark = /^([✓✗])\s+(.*)$/u.exec(line);
        if (mark) rows.push({ state: mark[1] === "✓" ? "done" : crossed, title: mark[2], lines: [] });
        else if (rows.length && /^\s/.test(raw)) rows.at(-1).lines.push(line);
        else { flush(); out.push(`<p class="drpg-help">${esc(line)}</p>`); }
    }
    flush();
    return out.join("");
}

/*
 * THE DICE LOOK, BEFORE THE SESSION (E60 C5b2, 03.11.2026; the owner on C5b's GM-panel tile: "ten kafelek raczej
 * powinien byc w season setup jak juz"). What this GM's browser raises of dice-look.mjs `lookFindings` - every user's
 * forced look, fuse, overlays and display as this browser holds them, and this browser's own versions, preset and
 * registry - one cross a finding, a check when none. The line that another person's browser is not read here is left
 * out: a GM's run says it of every other user, every time, and the part's note says it once. Nothing is asked of
 * another browser (C5b is light). Its button opens the whole window, `diagnoseDiceLook({ test: false })`.
 */
async function diceLookFindingsHere() {
    try {
        const { lookView, lookFindings } = await import("./dice-look.mjs");
        return lookFindings(await lookView({ gm: true })).filter(finding => finding.code !== "otherBrowser");
    } catch (err) {
        error("Could not read the dice look for Pre-season's checks", err);
        return null;
    }
}

/** Pre-season's Dice look part: its note, a line a finding (none read: no line), and the button for the whole window. */
function diceLookSection(findings, esc) {
    // A finding is a warning (E46-C5b): the table plays with it, and the GM decides; none, a check.
    const rows = !Array.isArray(findings) ? []
        : findings.length ? findings.map(finding => ({ key: finding.code ?? null, state: "warning", title: finding.words }))
            : [{ key: "nothingFound", state: "done", title: game.i18n.localize("DRPG.DiceLook.diag.nothingFound") }];
    const title = game.i18n.localize("DRPG.DiceLook.diag.title");
    return checkPart("dice", title, `<p class="drpg-help">${esc(game.i18n.localize("DRPG.DiceLook.diag.introGm"))}</p>
            ${rows.length ? checkList(rows, { label: title }) : ""}
            <p><button type="button" data-drpg-dice-look>${esc(game.i18n.localize("DRPG.DiceLook.diag.open"))}</button></p>`);
}

/**
 * Pre-season's lines of the contract (E52 C2, E52-05): each failed row with a cross, its target, file:symbol and what
 * the table gets instead - the rows the primary GM's notice names; the rows nobody could read on one line, never
 * green; a check only when every row holds.
 *
 * @param {{rows: object[], failed: object[], unknown: object[]}} contract  patches.mjs `runContract`
 * @param {function(*): string} esc
 * @returns {string} HTML
 */
function contractSection(contract, esc) {
    const failed = contract?.failed ?? [], unknown = contract?.unknown ?? [];
    // A failed row a warning (E46-C5b): the table gets what it names instead, and the load's notice said so.
    const rows = failed.map(r => ({ key: r.id ?? null, state: "warning", title: `${r.target} (${r.where}): ${r.instead ?? r.fallback}` }));
    if (!rows.length && !unknown.length) rows.push({ key: "allOk", state: "done", title: plural("DRPG.Contract.checksAllOk", { n: contract?.rows?.length ?? 0 }) });
    // The unread rows as one counted line, their list folded under it (E52 C4, C3's gap): about two dozen on
    // every world (table-only checks, hooks not seen firing yet) drowned the failed rows above. Never a check.
    const fold = unknown.length
        ? `<details class="drpg-check-unknown"><summary>${esc(plural("DRPG.Contract.checksUnknown", { n: unknown.length }))}</summary>${
            unknown.map(r => `<div>${esc(`${r.target} (${r.where}): ${r.note}`)}</div>`).join("")}</details>`
        : "";
    const title = game.i18n.localize("DRPG.Contract.checksTitle");
    return checkPart("contract", title, `${rows.length ? checkList(rows, { label: title }) : ""}${fold}`);
}

/**
 * THE REPORT'S MARKS IN THEIR STATE'S COLOUR (E20 fix round, the goal review's G-8; E20-07's "reads green"). Every check
 * and cross of Pre-season's report was the text's own colour in both themes, so a line that passed read as one that
 * did not. Each ✓ and ✗ in the text of `html` (escaped markup; attributes are not touched, the marks are found in its
 * text nodes) is wrapped in a span the stylesheets colour - the evidence colour of each theme for a check, the alarm
 * for a cross (R1530). Exported for R1530.
 */
export function checkMarks(html) {
    const box = document.createElement("template");
    box.innerHTML = String(html ?? "");
    const texts = [];
    const walk = node => {
        for (const child of node.childNodes) {
            if (child.nodeType === 3) { if (/[✓✗]/.test(child.nodeValue)) texts.push(child); } else walk(child);
        }
    };
    walk(box.content);
    for (const node of texts) {
        const parts = node.nodeValue.split(/([✓✗])/);
        node.replaceWith(...parts.filter(Boolean).map(part => {
            if (part !== "✓" && part !== "✗") return document.createTextNode(part);
            const mark = document.createElement("span");
            mark.className = part === "✓" ? "drpg-check-ok" : "drpg-check-bad";
            mark.textContent = part;
            return mark;
        }));
    }
    return box.innerHTML;
}

/**
 * Pre-season's room pictures (E20 C3; amend 11.10's decode row, E77 D5's size warning): those that do not load,
 * those over `ROOM_IMAGE_LIMITS` with the size that is over, and those whose size the server did not give - one
 * line each kind, nothing when no picture needs a word.
 *
 * E20 fix round (the correctness review's C-3): a picture whose decode did not end in time while the server has it is
 * no longer "does not load" - it is a line of its own, "not checked in time".
 *
 * @param {{missing: object[], large: object[], unknownSize: object[], late: object[]}} found  room-tile.mjs `checkRoomImages`
 * @param {function(*): string} esc
 * @param {number} probeMs  how long a decode was given
 * @returns {string} HTML
 */
function roomImagesSection(found, esc, probeMs = ROOM_IMAGE_LIMITS.probeMs) {
    const where = entry => entry.rooms.map(r => game.i18n.format("DRPG.Panel.checksImagesWhere", r)).join(", ");
    const listOf = list => list.map(where).join("; ");
    // The page's language (utils.mjs `localeFormat`, E66 C1), where it was Foundry's.
    const mb = bytes => localeFormat("number", bytes / (1024 * 1024), { maximumFractionDigits: 1 });
    const sized = entry => game.i18n.format("DRPG.Panel.checksImagesSized", { rooms: where(entry), size: [
        entry.pixels && game.i18n.format("DRPG.Panel.checksImagesPixels", { width: entry.width, height: entry.height }),
        entry.heavy && game.i18n.format("DRPG.Panel.checksImagesBytes", { mb: mb(entry.bytes) })].filter(Boolean).join(", ") });
    // A picture that does not load is blocking (the room tile shows nothing); one too large, one of no known size and
    // one not checked in time are warnings (E46-C5b).
    const rows = [
        found.missing.length && { key: "missing", state: "blocking", title: game.i18n.format("DRPG.Panel.checksImagesMissing", { rooms: listOf(found.missing) }) },
        found.large.length && { key: "large", state: "warning", title: game.i18n.format("DRPG.Panel.checksImagesLarge", { side: ROOM_IMAGE_LIMITS.side,
            mb: mb(ROOM_IMAGE_LIMITS.bytes), rooms: found.large.map(sized).join("; ") }) },
        found.unknownSize.length && { key: "unknownSize", state: "warning", title: game.i18n.format("DRPG.Panel.checksImagesUnknown", { rooms: listOf(found.unknownSize) }) },
        found.late?.length && { key: "late", state: "warning", title: plural("DRPG.Panel.checksImagesLate", { s: probeMs / 1000, rooms: listOf(found.late) }, "s") }
    ].filter(Boolean);
    const title = game.i18n.localize("DRPG.Panel.checksImages");
    return rows.length ? checkPart("pictures", title, checkList(rows, { label: title })) : "";
}
