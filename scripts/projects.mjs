/**
 * Danganronpa RPG - projects.
 * ---------------------------------------------------------------------------
 * Projects are Daggerheart Countdowns: a name, a progress bar and a target.
 * What the system does not model is the guide's requirement that a project
 * belongs to a room - "Projects may require specific rooms depending on their
 * kind, intent and required tools" - so that link is kept here, keyed by
 * countdown id.
 *
 * A project can also be flagged as an indirect murder, which changes what
 * rolling on it costs the killer (see INDIRECT_MURDER in config.mjs).
 *
 * THE FACADE (E34, 1.2.70). The secrecy - the secret fields, who sees a project,
 * the ownership map, and the accessors of the module's row and of Daggerheart's
 * countdown that it writes through - moved to projects-secrecy.mjs by a pure
 * move that `node tools/moved-only.mjs` proves. This file keeps its name and
 * every name it exported - seventeen of projects-secrecy.mjs's are re-exported
 * under the imports - so every importer still imports projects.mjs, and the new
 * file does not import it. What stays is where a project stands and who has
 * found it, the queries, progress, making a project, sabotage and repair, the
 * announcements, editing and deleting, and the reseal after a load; new code of
 * those goes here, and a secret field, a viewer or a read or write of the
 * countdowns or the meta into projects-secrecy.mjs.
 */

import { MODULE_ID, PROJECT_SCALE, TRAP_TRIGGERS, isProjectGlyph } from "./config.mjs";
import { SETTINGS, iAmTheMastermind } from "./settings.mjs";
import { announce, log, error, whisperToOwner, whisperToGms, gmIds, esc, isPrimaryGm, primaryGmId, serialWrite } from "./utils.mjs";
// Statically: gm-stores.mjs reaches this file only by dynamic import, so the edge closes no cycle (R161).
import { projectSecretStore, rerollBookmarkStore } from "./gm-stores.mjs";
/* `discoveredFor` is the per-character record of which rooms somebody has
   actually stood in - the public half of `knowsProject` below. Imported at the
   top and not dynamically: the import graph was checked in both directions
   (16.09) and fog.mjs does not reach this file, so there is no cycle to dodge. */
import { discoveredFor, myDiscoveredRooms, roomsStoodInNow } from "./fog.mjs";
// What a private card's meta says on this browser (H84 fix G3, `proposedBy`). secret.mjs reaches nothing that imports
// this file (read 27.10.2026: its imports are bridge-guards, utils, rooms, config, settings and gm-store), so no cycle (R161).
import { cardMeta } from "./secret.mjs";
// Already reached through fog.mjs, which imports it: the edge adds no cycle (R161).
// A leaf (it imports config.mjs alone): the scenes a project's room is on, for `knowsProject` (E12 C5),
// and the one it stands on, for `projectScene` (E12 fix r1-G3).
import { placeScenes, roomRegions, sceneOfRoom } from "./rooms.mjs";
import {
    DH, COUNTDOWNS, COUNTDOWNS_KEY, projectMeta, metaFor, secretsOf, setProjectMeta, canSee, OBSERVER, ownerIdsOfId, ownershipMap,
    insidersOf, viewersOf, isSecret, rawCountdown, writeAllCountdowns, builderIds,
    secretChange, sightChange, SIGHT_KEYS
} from "./projects-secrecy.mjs";
export {
    projectMeta, metaFor, PROJECT_SECRET_FIELDS, secretsOf, patchTrigger, setProjectMeta, canSee,
    liftProjectSecrets, viewersOf, builderIds, sealAudience, withoutLeak, isSecret, secretChange, revealChange, sightChange
} from "./projects-secrecy.mjs";

/** Which room a project belongs to, if any. */
export function roomOf(countdownId) {
    return metaFor(countdownId).room ?? null;
}

/** Is this project an indirect murder? */
export function isIndirectMurder(countdownId) {
    return Boolean(metaFor(countdownId).indirectMurder);
}

/**
 * Is this project an indirect murder that this character is building - its killer or the one who
 * proposed it? The question a Work's or a Sabotage's trace is tied to the crime by (E32+E07 fix
 * r2-G3, E09 C5): asked by the bridge of a player's trace (gm-bridge.mjs `worksOwnMurder`) and,
 * since E09 fix r1-G4 (08.10.2026; the round-1 goal check's G2b), by the drop itself on a GM's own
 * client (action-rolls.mjs `hideProjectTraces`, `dropSabotageTrace`), which tied a bystander's
 * trace of anybody's trap. False on a player's browser, which holds no secrets (`secretsOf`): its
 * packet's tie is never read (gm-bridge.mjs `handleRemnant`).
 */
export function buildsOwnMurder(countdownId, actorId) {
    if (!actorId || !isIndirectMurder(countdownId)) return false;
    const { killerId, by } = secretsOf(countdownId);
    return killerId === actorId || by === actorId;
}

/** Where this project's token stands, if it has one: `{ sceneId, tokenId }`. */
export function tokenRefOf(countdownId) {
    const meta = metaFor(countdownId);
    return meta.tokenId && meta.tokenScene
        ? { sceneId: meta.tokenScene, tokenId: meta.tokenId }
        : null;
}

/*
 * THE SCENE A PROJECT STANDS ON (E12 fix r1-G3, 11.10.2026; review round 1 SEC-1). Its token's
 * scene, else the scene `placeProjectToken` would put it on - the first place scene holding a room
 * of its name (rooms.mjs `sceneOfRoom`); null for a project with no room, or a room no place scene
 * has. Until this fix the lists a character builds where they stand and the GM's guards of a Work
 * and a Sabotage compared the room's NAME only, so a character in the Annex's "Kitchen" was offered
 * the project standing in Floor 1's, and its progress and sabotage passed (the tier-2 test "a
 * project is reached only on its own scene and not through a room of its name on another").
 */
export function projectScene(countdownId) {
    const ref = tokenRefOf(countdownId);
    return (ref ? game.scenes?.get(ref.sceneId) : null) ?? sceneOfRoom(roomOf(countdownId));
}

/**
 * Whether a character standing at `place` (movement.mjs `locateActor`'s `{ room, scene }`) stands
 * at this project: in its room, on its scene. False for a project with no room - there is nothing
 * to stand at - and for nobody located.
 */
export function standsAtProject(place, countdownId) {
    const room = roomOf(countdownId);
    return Boolean(room && place?.room === room && place.scene?.id && place.scene.id === projectScene(countdownId)?.id);
}

/**
 * DOES THIS PERSON KNOW THIS PROJECT IS THERE?
 *
 * One predicate, two roads in, and NO new state - which is the whole reason it
 * is worth writing down. Everything it needs was already being tracked:
 *
 *   · `canSee` is the ownership gate. A secret project is hidden from the
 *     interface of a client that is not in on it - not from its console:
 *     Daggerheart's Countdowns, with the name, the progress and the ownership
 *     map, is a world setting every browser holds (audit S09-05). Somebody who
 *     IS in on it knows about it by definition - they proposed it, or it is
 *     their own murder.
 *   · `discoveredFor` (fog.mjs) is the per-character record of which rooms
 *     somebody has actually stood in. A public project is known once you have
 *     been in its room, and it stays known afterwards, because knowledge does.
 *
 * So a token on the map answers to this and nothing else, and so does the row
 * in the Projects tray. The alternative was a `discoveredBy` list per project,
 * a third place for "who knows what" to go stale in.
 *
 * A project with no room ("abstract work anywhere") has nowhere to walk into,
 * so there is nothing to discover: it is known as soon as it is visible.
 */
export function knowsProject(countdownId, user = game.user) {
    if (user?.isGM) return true;
    /* AN ID WITH NO COUNTDOWN IS NOBODY'S PROJECT (E11 C7, 1.2.73; audit S09-21; the ask A2). Asked
       before the ownership: `isSecret` reads a missing countdown as public and `roomOf` a missing
       row as no room, so the token a reset or a deletion left behind was "known" to every player -
       scenario 65 read it true on p1 at 4aad1fd (10.10.2026). A GM's answer is the line above. */
    if (!rawCountdown(countdownId)) return false;
    if (!canSee(countdownId, user)) return false;
    // In on a secret one: you are one of the people who made it.
    if (isSecret(countdownId)) return true;

    const room = roomOf(countdownId);
    if (!room) return true;

    /* WHO MADE IT KNOWS IT (H84-04, 27.10.2026; the owner's live session on 1.2.85, triage C4). A public project knew its
       proposer no better than anybody else: the record alone was asked, and a proposer whose character the GM had
       placed in the room, or moved, or whose room the approval changed, did not see their own project on the tray or
       the map. Answered from what each browser may hold (`proposedBy`): a GM's from the GMs' `by`, the proposer's own
       from the private card the GM sent them. De0626e1 wrote the proposer's owners into the public meta's
       `sealedViewers` instead, which put who proposed a public project - a GM-only field until then - in every
       player's console (the end review's H84-SEC-02, H84R-5; fixed in H84 fix G3). */
    if (proposedBy(countdownId, user)) return true;
    /* Who knew it while it was sealed, when it was revealed (`revealChange` keeps them in `sealedViewers`, public since
       E05, the exposure S09-05 accepts): they still know it. */
    if ((metaFor(countdownId).sealedViewers ?? []).includes(user?.id)) return true;

    /* Any character this person holds having been there is enough. A player
       running two students knows what either of them has seen - the same rule
       `incidentWitness` uses for the incident's seats. */
    /* ON THE PROJECT'S SCENE, NOT THE ONE ON SCREEN (E12 C5, 1.2.74; audit S16-06; R118). This
       asked the discovery record of the scene this client's camera showed, so one player knew a
       project while looking at Floor 1 and forgot it on the Annex or with no scene drawn (scenario
       66 E1 read [true, false, false] at 180df61, 11.10.2026), and the tray and the map token, which
       ask this, followed the view (read in the code). The project's scene is its token's; one with
       no token yet is in the room of its name on every place scene that has one (the record is per
       scene, and a room's name is the project's only place until the primary puts it on the map). */
    const ref = tokenRefOf(countdownId);
    const sceneIds = ref ? [ref.sceneId] : placeScenes().filter(s => roomRegions(s, room).length).map(s => s.id);
    if (!sceneIds.length) return false;
    return hasStoodIn(user, room, sceneIds);
}

/**
 * WHETHER `user` PROPOSED THIS PUBLIC PROJECT, AS THIS BROWSER MAY KNOW IT (H84 fix G3, 27.10.2026; the end review's
 * H84-SEC-02, H84R-5). Who proposed a project is the GMs' (`by`, projects-secrecy.mjs `PROJECT_SECRET_FIELDS`), so it is
 * read where it is held: on a GM's browser from `by` (an owner of the proposing character); on the proposer's own
 * browser from the private card the GMs sent them (`tellProposer`), whose meta names the project (`PROJECT_KNOWN`) and
 * travels with its words to its readers alone (secret.mjs); a card a GM did not write counts for nothing. Nobody else's
 * browser holds either. A card's words reach a browser that was away when a GM gives them again (secret.mjs
 * `askForWords`); until then the room rule below answers.
 */
function proposedBy(countdownId, user) {
    if (!user) return false;
    if (game.user?.isGM) return ownerIdsOfId(secretsOf(countdownId).by).includes(user.id);
    return user === game.user && projectsToldHere().has(countdownId);
}

/** The meta key of the proposer's card that names the project (`tellProposer`, `proposedBy`). */
export const PROJECT_KNOWN = "projectKnown";

/* The projects the GMs' cards on this browser name (`projectsToldHere`); emptied when a card or its words arrive or go. */
let toldHere = null;

/** The ids of the projects this browser's private cards from a GM name as its user's own (`PROJECT_KNOWN`). */
function projectsToldHere() {
    if (toldHere) return toldHere;
    const told = new Set();
    for (const message of game.messages ?? []) {
        if (!message?.flags?.[MODULE_ID]?.secret || !message.author?.isGM) continue;
        const id = cardMeta(message, PROJECT_KNOWN);
        if (typeof id === "string" && id) told.add(id);
    }
    toldHere = told;
    return told;
}

/**
 * Send the proposer of a public project the private card that tells their browser they know it (H84 fix G3): to the
 * owners of the proposing character and the GMs, veiled (the document names no reader and no speaker, so who proposed
 * it is not read off the card either), its meta naming the project (`PROJECT_KNOWN`). A GM's; `by`, `name` and `room`
 * as the caller holds them (a GM that is not the primary may not hold the new project's GM row yet). Answers whether a
 * card was posted: none for a secret project, one with no room (known to everybody who sees it), or a character no
 * player owns.
 */
export async function tellProposer(countdownId, { by = secretsOf(countdownId).by, name = rawCountdown(countdownId)?.name, room = roomOf(countdownId) } = {}) {
    if (!game.user?.isGM || !countdownId || !room || isSecret(countdownId)) return false;
    const actor = game.actors.get(by ?? "");
    if (!actor || !ownerIdsOfId(actor.id).some(id => !game.users.get(id)?.isGM)) return false;
    const posted = await whisperToOwner(actor, `<p>${game.i18n.format("DRPG.Project.proposerKnows",
        { name: foundry.utils.escapeHTML(name ?? "?"), room: foundry.utils.escapeHTML(room) })}</p>`,
    { veiled: true, flags: { [MODULE_ID]: { [PROJECT_KNOWN]: countdownId } } });
    return Boolean(posted);
}

/**
 * THE PROPOSERS OF PROJECTS MADE BEFORE 1.2.88 ARE TOLD ONCE (H84 fix G3, 27.10.2026; the end review's H84-SEC-03,
 * H84R-07, H84R-4: the owner's own reported project was made on 1.2.85, and its proposer still did not see it). On the
 * primary GM, at its load: every public project with a room, a proposer (`by`) and no `proposerTold` in the GMs' row,
 * not finished, is told (`tellProposer`) and marked, so the next load posts nothing. Answers how many were told.
 */
export async function tellProposers() {
    if (!isPrimaryGm()) return 0;
    if (await projectSecretStore.whenHydrated?.() === "timedOut") return 0;
    let told = 0;
    for (const project of allProjects()) {
        const row = secretsOf(project.id);
        if (!row?.by || row.proposerTold || isComplete(project) || isSecret(project.id) || !roomOf(project.id)) continue;
        if (await tellProposer(project.id, { by: row.by, name: project.name, room: roomOf(project.id) })) told++;
        await applyProjectChange(project.id, { meta: { proposerTold: true } }, { by: { kind: "system" } });
    }
    if (told) log(`Told ${told} proposer(s) of a public project made before 1.2.88 that they know it.`);
    return told;
}

/**
 * Whether `user` knows `room` on one of `sceneIds`: one of their characters stood in it, as the discovery record
 * keeps it - or they play the Mastermind.
 *
 * THE MASTERMIND KNOWS THE BUILDING (E17 C8, 26.10.2026; audit S07-10). fog.mjs `recordDiscovery` leaves no track of
 * the Mastermind's walks in the record, so that the GM's veil (the union of the rows) does not narrate the season's
 * secret moving around the school, and says they lose nothing by it, because their own fog counts every room as
 * known (`myDiscoveredRooms`). That was true of the fog alone: this asked the record, so the Mastermind's player
 * never saw the token or the tray's row of a public project in a room they had stood in, which every other student
 * who stood there sees. They are answered here as their fog answers them, every room of the scene: on their own
 * browser by `iAmTheMastermind` (the door's copy only they hold); a GM's browser answers the record for them, as for
 * anybody (`playsTheMastermind`, E17 fix p2-G3). A public project's countdown is held by every browser
 * already (`canSee`), so nobody learns a project's existence from this they could not read before; it is about
 * whether the map and the tray show it.
 *
 * @param {User} user
 * @param {string} room
 * @param {string[]} sceneIds
 * @param {{mastermind?: boolean}} [options]  the suite's (R999); read off this browser otherwise
 */
export function hasStoodIn(user, room, sceneIds, { mastermind = playsTheMastermind(user) } = {}) {
    if (mastermind) {
        return sceneIds.some(sceneId => myDiscoveredRooms(game.scenes?.get(sceneId), { mastermind: true }).has(room));
    }
    try {
        /* THE ROOM A CHARACTER STANDS IN IS KNOWN, AS THE FOG KNOWS IT (H84-04, 27.10.2026; triage C4). The fog clears
           the rooms a player's tokens stand in now and the ones this browser saw them reach before the record caught up
           (fog.mjs `myCurrentRooms`, `mirroredFor`); this asked the record alone, so a character the GM placed in a
           room (seeded fill-only, so an unticked cell stays unticked) or whose row had not reached this browser stood in
           a room the fog drew clear and did not see the public project in it. Both are read here: the scene's tokens
           for anybody, the fog's own union on this player's own browser. */
        for (const sceneId of sceneIds) {
            const scene = game.scenes?.get(sceneId);
            if (roomsStoodInNow(scene, user).has(room)) return true;
            if (user === game.user && !user.isGM && myDiscoveredRooms(scene, { mastermind: false, gm: false }).has(room)) return true;
        }
        for (const actor of game.actors ?? []) {
            if (actor.type !== "character") continue;
            if (!actor.testUserPermission(user, "OWNER")) continue;
            if (sceneIds.some(sceneId => discoveredFor(sceneId, actor.id).includes(room))) return true;
        }
    } catch {
        // A world mid-migration, or a scene with no discovery recorded yet.
        // Answering "no" hides the token, which is the safe direction to fail.
    }
    return false;
}

/**
 * Does `user` play the Mastermind, as this browser answers for `knowsProject`: its own copy (`iAmTheMastermind`) for
 * itself, and no for anybody else.
 * NOT ON A GM'S SCREEN FOR ANOTHER USER (E17 fix p2-G3, 26.10.2026; the end review's E17p2-R9, goal). This asked the
 * GMs' store on a GM, so the project card's "Known by" (projects-map.mjs) named the Mastermind's player on every public
 * project of the scene, rooms their character never entered among them, while every other player was listed for the
 * rooms they stood in: a GM's shared or streamed screen picked out the Mastermind. The GM's card reads the record
 * for everybody now, so it lists the Mastermind's player only where the record has them; their own map and tray keep
 * the exception, answered on their own browser.
 */
function playsTheMastermind(user) {
    if (!user || user.isGM) return false;
    return user === game.user && iAmTheMastermind();
}

/* ==========================================================================
 * COUNTDOWNS
 * ========================================================================== */

/**
 * Which way "progress" moves a countdown's bar.
 *
 * Daggerheart countdowns count *down*: they are created full and tick towards
 * zero. The guide's projects fill *up* - "add 1 progress" - so the ones this
 * module creates are stored the other way round and marked as such.
 *
 * This mattered more than it looks. Adding progress to a countdown that was
 * already sitting at its start value clamped to no change at all, so a project
 * the GM had made in Daggerheart's own Countdowns window silently swallowed
 * every +1 while still accepting every -2. That is exactly the shape of the
 * Contribution bug: positive Calls did nothing, negative Calls worked.
 *
 * Anything without our marker is treated as Daggerheart's own and counted down.
 */
export function countsUp(countdownId) {
    const meta = metaFor(countdownId);

    // An explicit answer always wins. `createProject` stamps `countsUp: true`,
    // so every project this module has ever made is covered by this line and
    // nothing about existing bars changes.
    if (meta.countsUp !== undefined) return Boolean(meta.countsUp);

    // No metadata at all means this countdown is not ours - the GM built it in
    // Daggerheart's own Countdowns window. Treating those as filling upwards was
    // a guess about somebody else's document, and it inverted their bar: a
    // countdown created full and ticking towards zero was reported as 0/8 and
    // silently swallowed every +1 the module tried to add.
    if (!Object.keys(meta).length) return false;

    // Ours, from before `countsUp` was stamped. Those did fill upwards.
    return true;
}

/**
 * A project in the module's own terms: `current` is progress *achieved*, always
 * rising towards `target`, whichever way the underlying countdown is stored.
 */
export function allProjects() {
    try {
        const data = game.settings.get(DH, COUNTDOWNS);
        const countdowns = data?.countdowns ?? {};
        return Object.entries(countdowns).map(([id, c]) => {
            const start = c.progress?.start ?? 0;
            const raw = c.progress?.current ?? 0;
            const up = countsUp(id);
            // Named rather than written twice: `complete` below is the same
            // arithmetic compared against the target, and two copies of it is
            // two places for the direction to be got wrong.
            const current = up ? raw : Math.max(0, start - raw);
            return {
                id,
                name: c.name,
                img: c.img,
                current,
                start,
                raw,
                countsUp: up,
                room: roomOf(id),
                indirectMurder: isIndirectMurder(id),
                // The GMs' store on a GM, nothing on a player's browser (`secretsOf`).
                condition: secretsOf(id).condition ?? "",
                killerId: secretsOf(id).killerId ?? null,
                trait: metaFor(id).trait ?? null,
                // WHICH PIXEL GLYPH THE TRAY DRAWS FOR THIS ROW.
                //
                // `null` for every project made before this existed, and for
                // every countdown built in Daggerheart's own window - both of
                // which the tray's own rule then draws as the hourglass they
                // have always been. Nothing here invents a default: naming it
                // twice is how the picker and the tray drift apart.
                glyph: metaFor(id).glyph ?? null,
                frozen: Boolean(metaFor(id).frozenBy),
                repairs: metaFor(id).repairs ?? null,
                // Full. Not the same as gone: a finished project sits on the
                // board until a GM clears it, and everything that reads this
                // list has to be able to tell the two apart. See `isComplete`.
                complete: start > 0 && current >= start
            };
        });
    } catch {
        return [];
    }
}

/** Every project this user is allowed to know about. */
export function visibleProjects(user = game.user) {
    return allProjects().filter(p => canSee(p.id, user));
}

/**
 * Every project this user KNOWS is there - `visibleProjects` narrowed by
 * discovery. See `knowsProject` above for the two roads in.
 *
 * The difference between the two lists is the whole of stage 2, so it is worth
 * saying which question each one answers:
 *
 *   · `visibleProjects` is "may this client be told about it at all". It is the
 *     secrecy gate, and it is what a socket handler has to check, because a
 *     player who is not in on a secret project must not be able to touch it
 *     however they learnt the id.
 *   · `knownProjects` is "is it on this person's map yet". A public project in
 *     a room nobody has walked into is perfectly legal to know about and simply
 *     has not been found, so it is absent from the tray and its token is not
 *     drawn - not greyed, not a neutral marker, absent.
 *
 * The lists a character builds FROM WHERE THEY ARE STANDING - `projectsListedIn`
 * and everything downstream of it - deliberately stay on `visibleProjects`.
 * Standing in the room IS the discovery, so the only case the two lists could
 * disagree on is the gap between a token arriving in a region and the primary
 * GM's ledger write coming back round the socket. Gating there would buy
 * nothing (you cannot get the list without being in the room anyway) and would
 * cost a player a turn's work every time that round trip was slow.
 */
export function knownProjects(user = game.user) {
    return allProjects().filter(p => knowsProject(p.id, user));
}

/**
 * Secret projects standing in this room that this person is NOT in on.
 *
 * The candidate list for a non-obvious Observe (observe.mjs), and the reason it
 * takes a USER rather than reading `game.user`: it is asked on the GM's client,
 * about somebody else's character. Reading the ambient user there would answer
 * "the GM is in on all of them" and the list would always be empty - which is
 * the shape of bug that looks like a rule quietly not existing.
 *
 * `canSee`, not `knowsProject`: this is the ownership question. Discovery is
 * about walking into a room, and the observer is standing in it - asking whether
 * they have found the room would be asking a question whose answer is yes.
 *
 * IN ITS ROOM ON ITS OWN SCENE (E12 fix r2-S1, 11.10.2026; review round 2 SEC2-3). This took a
 * room's name and matched it on every scene, so a non-obvious Observe in the Annex's "Kitchen"
 * was let in on a secret project standing in the school's - round 1 closed that road for a Work
 * and a Sabotage and left this one. It takes the observer's place now (movement.mjs
 * `locateActor`'s `{ room, scene }`) and asks `standsAtProject`, as the lists below do; a bare
 * name finds nothing.
 */
export function secretsUnknownIn(place, user) {
    if (!place?.room || !user || user.isGM) return [];
    return allProjects()
        .filter(p => standsAtProject(place, p.id))
        .filter(p => isSecret(p.id))
        .filter(p => !canSee(p.id, user));
}

/**
 * Is this project already full?
 *
 * A project at its target is DONE. Nothing else in the game can be advanced past
 * its own ceiling, and `addProgress` has refused to move one for some time - but
 * it refused at the end, after the player had spent an action, chosen a
 * statistic and thrown dice for progress that could not land anywhere. The
 * picker knows the answer before any of that happens.
 *
 * Takes an entry from `allProjects()` rather than an id, because every caller
 * already has one and re-reading the countdown to answer a question the row in
 * front of you can answer is how two readers drift apart.
 */
export function isComplete(project) {
    return Boolean(project?.complete);
}

/**
 * Every project this character can SEE from where they are standing - finished
 * ones included. `place` is where they stand, `locateActor`'s `{ room, scene }`:
 * a project in a room is listed on its own scene only (`standsAtProject`; E12 fix
 * r1-G3 - a room's name alone matched a room of that name on any scene).
 *
 * The picker's list, and the reason it is not `projectsAvailableIn`: a finished
 * project has to be visible and struck through rather than quietly absent.
 * Absent, it looks like the project was cleared away, and the obvious next move
 * is to ask a GM what happened to it.
 */
export function projectsListedIn(place, user = game.user) {
    return visibleProjects(user)
        .filter(p => !p.room || standsAtProject(place, p.id))
        .filter(p => !isFrozen(p.id));
}

/**
 * Projects a character can actually work on right now: those tied to the room
 * they are standing in, plus any project with no room set. Frozen projects are
 * excluded - they need their repair finishing first, and finished ones because
 * there is nothing left to add.
 *
 * This is the "is there anything to do here" question, and three screens ask it:
 * the HUD's room block, the Work on Project tile's own dimming, and the guard
 * inside the action. All three were counting a finished project as work.
 */
export function projectsAvailableIn(place, user = game.user) {
    return projectsListedIn(place, user).filter(p => !isComplete(p));
}

/**
 * Projects in this room that can be sabotaged.
 *
 * A Monokuma is not standing in the players' geography - they walk the map
 * freely and interfere wherever they like - so for a GM the room filter is
 * dropped entirely. It was silently hiding most of the board: a Monokuma whose
 * token happened to be outside every region could only ever see projects with
 * no room set, which is why some projects could be sabotaged and others could
 * not, with no explanation for the difference.
 */
export function sabotageTargetsIn(place, { anyRoom = false, user = game.user } = {}) {
    return visibleProjects(user)
        // YOU HAVE TO BE STANDING AT THE THING TO BREAK IT.
        //
        // This used to read `anyRoom || !p.room || (room && p.room === room)`,
        // and the middle clause is the one that was wrong. It is right for Work
        // on Project - a project with no room set is abstract work you can do
        // anywhere - but sabotage is not abstract. It is prying at a lock,
        // pulling wires out, putting sugar in a tank: a physical act on a
        // physical object, in a room. With the clause in, every roomless project
        // on the board was reachable from anywhere on the map, so a player could
        // break something on the other side of the school without leaving their
        // chair.
        //
        // A Monokuma still reaches everywhere (`anyRoom`) - they are not
        // standing in the players' geography at all.
        //
        // In the project's room ON ITS SCENE (E12 fix r1-G3): a room of the same
        // name on another map is another room (`standsAtProject`).
        .filter(p => anyRoom || standsAtProject(place, p.id))
        .filter(p => !isFrozen(p.id))
        .filter(p => !repairs(p.id));   // repairing a repair makes no sense
}

/**
 * Add progress to a project. Countdowns live in a world setting, so only a GM
 * can write - a player's progress is applied through the GM bridge.
 *
 * `amount` is always in the guide's terms: positive advances the project. How
 * that lands in the stored countdown depends on which way it counts - see
 * `countsUp`.
 *
 * @returns {Promise<object|null>} `{ name, from, to, target, changed }`, or null
 *   when the project does not exist. `changed: false` means the write was a
 *   no-op - the caller must not report success.
 */
export async function addProgress(countdownId, amount, { by = null, actorId = null, rollId = null, relief = 0, bonus = 0, call = null, kind = null } = {}) {
    if (!amount) return null;

    if (!game.user.isGM) {
        // Progress taken BACK is a Reroll's undo, which the GM's own Reroll makes
        // on its own client: a player's is refused (`undoIsTheGms`, E08+E28 C8).
        // The character whose action this is still travels with it. A Work on a Project names its roll as well (E08+E28 C2), so the GMs'
        // bookmark of that roll keeps what it added (gm-bridge.mjs `noteProgressFact`), and since C16 the GM adds what that roll
        // earned on its record, with the tool's `relief` and the concealment's `bonus` held to the rules (`progressOf`).
        // A Hope Call's names its `call`, whose price the GM saw paid (fix r2-H2: bridge-guards.mjs `guardCallProgress`).
        const { requestProjectProgress } = await import("./gm-bridge.mjs");
        const res = await requestProjectProgress(countdownId, amount, { actorId, rollId, relief, bonus, call });
        // Carried out when ok (the request answers once it is, E31 review), but
        // `changed` is unknown from here - the GM whispers back what actually
        // happened. Claiming a change would be a guess.
        return res.ok ? { pending: true, changed: null } : null;
    }

    // Whose hands moved the bar, as a USER id - the fallback audience when a
    // project has no recorded founder. Defaults to this client because every
    // other caller of this function is already the GM doing it directly; the
    // socket handler passes the asker's id instead.
    const mover = by ?? game.user.id;

    /*
     * THROUGH THE ONE ENTRY (E36 C1, 25.10.2026; audit S17-18). The read, the clamp, the frozen
     * project's refusal, the write and what a crossing does were written out here, outside any
     * queue: ten +1 landing together read the same bar and wrote it ten times over (E36-T2 counted
     * the end of ten concurrent calls at 7d123c97). They are `applyProjectChange`'s step now, on the
     * primary GM, one after another; another GM's progress goes there by `project.change`. What
     * stays here is what this caller is told: the warning when nothing moved.
     */
    const result = await applyProjectChange(countdownId, { delta: amount },
        { by: { kind: kind ?? (mover === game.user.id ? "gm" : "player"), userId: mover, actorId } });
    if (!result) return null;
    if (result.reason) ui.notifications.warn(game.i18n.format(result.reason, { name: result.name, current: result.from, target: result.target }));
    const { id, name, from, to, target, changed, reason } = result;
    return reason ? { id, name, from, to, target, changed, reason } : { id, name, from, to, target, changed };
}

/* ==========================================================================
 * ONE ENTRY, ONE QUEUE, ONE TABLE OF WHAT A COMPLETION DOES (E36 C1)
 * --------------------------------------------------------------------------
 * 25.10.2026; audit S17-18, S09-14, S09-15; D40; the owner's amends of 11.10. A project was
 * changed by a dozen roads that each read the Countdowns setting, changed it and wrote it whole,
 * and each announced, armed and thawed in its own way. `applyProjectChange` is the one road: it
 * runs on the primary GM, in E80's queue (utils.mjs `serialWrite`, unchanged) under
 * projects-secrecy.mjs `COUNTDOWNS_KEY`, reads the project before and after the change inside
 * the step, and asks the rows of `COMPLETION_EFFECTS` once when the bar crosses its target or
 * falls back under it. The roads move onto it commit by commit (E36 C2, C3); tests-tier0.mjs
 * R977 counts the ones still outside.
 * ========================================================================== */

/** Who a change is by: `kind` one of these (E72 adds "monocub"), the user, the character. */
const CHANGE_KINDS = Object.freeze(["gm", "player", "call", "reroll", "system"]);

/**
 * WHAT A COMPLETION DOES, A ROW PER META KEY (the owner, 11.10: "`onCrossed`/`onUncrossed` w
 * `applyProjectChange` czytają małą tabelę skutków ukończenia (wiersz na klucz meta; dzisiejsza
 * naprawa sabotażu to pierwszy wiersz)"). A row is `{ key, has?, onCrossed?(ctx), onUncrossed?(ctx) }`,
 * read in its order when the project's meta (both halves, before the change) has `key` (`has`
 * says it otherwise). `ctx` is `{ id, name, before, after, target, meta, by, countdowns }`, the
 * last the step's copy of the setting, to read. A row answers what the step does for it, and does
 * nothing itself:
 *   `meta`    `{ [projectId]: patch }`, written in the step (`setProjectMeta`);
 *   `apply`   a write of the row's own writer, run in the step after the setting's write - it never
 *             calls this entry or another writer queued on the key, which would wait behind itself;
 *   `after`   run once the step has ended, outside the queue: an announcement, a receipt;
 *   `remove`  the project goes in the step; with `keep` it stays until the Reroll's bookmark of
 *             the character whose change completed it (gm-stores.mjs `rerollBookmarkStore`) names
 *             another roll or is gone, so a Reroll can still take the completion back (A10).
 * Every row answers before anything is written, so a row whose answer throws fails its caller's
 * change alone, with nothing of it written, and the queue goes on (E36-04). An `apply` runs after the
 * write: one that throws leaves the change written, is logged and told to the GMs, and the rest of the
 * step and its `after` list still run (E36 fix e1-G4; E36-T9). E15 part 2 adds rows here
 * (opensPassage, breachesWall, ...), E74 repairsLock; none adds code to the entry.
 */
export const COMPLETION_EFFECTS = [
    {
        /*
         * A FINISHED REPAIR THAWS WHAT IT REPAIRED, AND GOES (was `checkRepairCompletion`, called on
         * every landing). The repair is a means, not a goal: once the thing it was fixing works again
         * there is nothing left to work on, and a completed 6/6 bar left in the tray beside the project
         * it unblocked reads as an open job. The thaw and the removal are in the same step, so no
         * moment holds a thawed project and its finished repair, or a repair gone and its project
         * frozen. A repair whose project is gone is removed all the same.
         */
        key: "repairs",
        onCrossed: ({ id, name, meta, countdowns }) => {
            const targetId = meta.repairs;
            const target = countdowns[targetId] ?? null;
            const content = `<p><strong>${foundry.utils.escapeHTML(name)}</strong> - ${
                game.i18n.format("DRPG.Project.repaired", { name: foundry.utils.escapeHTML(target?.name ?? "?") })
            }</p>`;
            // A secret project's end goes to whoever can see it, veiled (E06 C10; audit S09-01): announced,
            // it told the table the name of a project the table may not know is there. Either half sealed
            // is enough: a repair made before 1.2.65 is public while its target may be secret, and a target
            // revealed after its sabotage leaves its repair sealed - whoever that repair was sealed to is
            // told as well. Read in the step, while both rows are there to read.
            const repairSealed = isSecret(id);
            const whisper = isSecret(targetId) || repairSealed
                ? Array.from(new Set([...gmIds(), ...insidersOf(targetId), ...(repairSealed ? viewersOf(id).map(u => u.id) : [])]))
                : null;
            return {
                meta: target ? { [targetId]: { frozenBy: null } } : {},
                remove: true,
                after: async () => {
                    await announce(whisper ? { content, veiled: true, whisper } : { content });
                    log(`Repair "${name}" complete and removed; "${target?.name}" is workable again.`);
                }
            };
        }
    },
    {
        /*
         * A FINISHED TRAP ARMS, AND SOMEBODY IS TOLD; ONE TAKEN BACK DISARMS (D40). Read for every
         * indirect murder, whose trigger may be null (made before E21, or watched by hand), so `has`
         * reads the flag. Crossed: a trap that has fired (`firedAt`) is not armed again and tells
         * nobody - "a ponowne dopełnienie uzbraja znowu, chyba że pułapka już raz zadziałała"; a
         * watched one is armed in the step and its receipt goes after it; a manual one is the card
         * with Fire, after. Uncrossed: an armed trap is disarmed, `firedAt` kept, so one receipt per
         * arming. A killer nobody can identify arms nothing, as before (`announceTrapReady` says so).
         */
        key: "trigger",
        has: meta => Boolean(meta.indirectMurder),
        onCrossed: ({ id, name, meta }) => {
            if (meta.trigger?.firedAt) return {};
            const killer = game.actors.get(meta.killerId ?? "") ?? game.actors.get(meta.by ?? "");
            const watched = Boolean(killer && meta.trigger?.kind && TRAP_TRIGGERS[meta.trigger.kind]?.watch);
            let armed = false;
            return {
                apply: watched ? async () => {
                    const { armTrap } = await import("./traps.mjs");
                    armed = Boolean(await armTrap(id, { condition: meta.condition ?? "" }));
                } : null,
                after: () => announceTrapReady(id, name, { watched, armed })
            };
        },
        onUncrossed: ({ id, meta }) => (meta.trigger?.armed
            ? { apply: async () => (await import("./traps.mjs")).disarmTrap(id) }
            : {})
    },
    {
        /*
         * A FINISHED SECRET PASSAGE OPENS ITS PASSAGE; ONE TAKEN BACK CLOSES IT (E15 part 2 C2, 25.10.2026; A10's
         * S16-16, step 14; D40). Read for a project whose secret half names the preset and the stretch the approval
         * picked. Crossed: the passage is made on the primary in the step (passages-gm.mjs `opensPassageDone`, which
         * judges the stretch again: the wall still shared, on no other passage) - known to its builder and to the
         * students of the players the secret project was shared with before now, not to those who found it by
         * Observe (`foundBy`), who are told it is finished and nothing more (`DRPG.Observe.projectFoundDone`). The
         * project then goes, but is kept until the completing character's Reroll bookmark names another roll
         * (`keep`), so a Reroll can take the passage back. Uncrossed: the passage and who knew it go
         * (`undoOpensPassage`). A stretch refused at the completion makes nothing, and the GMs are told why.
         */
        key: "opensPassage",
        has: meta => meta.target?.preset === "secretPassage" && Boolean(meta.passage),
        onCrossed: ({ id, name, meta }) => {
            const finders = new Set(Object.keys(meta.foundBy ?? {}));
            const builders = new Set(ownerIdsOfId(meta.by));
            // Only while it is secret (fix e1-G1, SEC-2): a project made public some other way has every player a viewer.
            const users = isSecret(id) ? viewersOf(id).filter(u => !finders.has(u.id) && !builders.has(u.id)) : [];
            const sharedIds = (game.actors?.contents ?? [...(game.actors ?? [])])
                .filter(a => a?.type === "character" && users.some(u => a.testUserPermission?.(u, "OWNER"))).map(a => a.id);
            let made = null;
            return {
                apply: async () => {
                    made = await (await import("./passages-gm.mjs")).opensPassageDone(id, { passage: meta.passage, builderId: meta.by ?? null, sharedIds });
                },
                remove: true,
                keep: true,
                after: async () => {
                    if (made?.refused) {
                        await whisperToGms(`<p>${esc(game.i18n.format("DRPG.Passage.card.notBuilt", { name, why: await whyOf(made.refused) }))}</p>`);
                        return;
                    }
                    await (await import("./passages-gm.mjs")).tellPassageBuilt(made);
                    const told = [...finders].filter(userId => game.users.get(userId) && !game.users.get(userId).isGM);
                    if (told.length) {
                        await announce({ content: `<p>${game.i18n.format("DRPG.Observe.projectFoundDone", { name: esc(name) })}</p>`,
                            whisper: Array.from(new Set([...gmIds(), ...told])) });
                    }
                }
            };
        },
        onUncrossed: ({ id }) => ({ apply: async () => (await import("./passages-gm.mjs")).undoOpensPassage(id) })
    },
    {
        /*
         * A FINISHED BREACH CUTS ITS WALL; ONE TAKEN BACK GIVES THE WALL BACK (E15 part 2 C3, 25.10.2026; A10's S16-17,
         * step 15; D40). Read for a project whose secret half names the preset and the stretch the approval picked.
         * Crossed: the wall is cut on the primary in the step (passages-gm.mjs `cutBreach`, which judges the stretch
         * again: the wall still between the two rooms, no door, not breached already), and the project goes, kept until
         * the completing character's Reroll bookmark names another roll (`keep`), as a Secret Passage's. Uncrossed: the
         * wall is given back (`undoBreachesOf`). A stretch refused at the completion cuts nothing, and the GMs are told
         * why. Since C4 the cut forces the room beyond - the target the approval named -: broken, its seal lifted
         * (`cutBreach`'s note), and the table is told after the step (`tellBreach`), the builder named only to those who
         * see the builder at the hole; the undo gives the room back with the wall.
         */
        key: "breachesWall",
        has: meta => meta.target?.preset === "breach" && Boolean(meta.passage),
        onCrossed: ({ id, name, meta }) => {
            let made = null;
            return {
                apply: async () => {
                    made = await (await import("./passages-gm.mjs")).cutBreach(id, { passage: meta.passage, builderId: meta.by ?? null,
                        beyond: meta.target?.room ?? null });
                },
                remove: true,
                keep: true,
                after: async () => {
                    if (made?.refused) await whisperToGms(`<p>${esc(game.i18n.format("DRPG.Passage.card.notBreached", { name, why: await whyOf(made.refused) }))}</p>`);
                    else await (await import("./passages-gm.mjs")).tellBreach(made);
                }
            };
        },
        onUncrossed: ({ id }) => ({ apply: async () => (await import("./passages-gm.mjs")).undoBreachesOf(id) })
    },
    {
        /*
         * A FINISHED SEAL THE PASSAGE CLOSES ITS PASSAGE; ONE TAKEN BACK OPENS IT (E15 part 2 C5, 25.10.2026; the owner's
         * (1) of 15.10). Read for a project whose secret half names the preset and the passage. Crossed: closed on the
         * primary in the step (passages-gm.mjs `sealPassageDone`, which judges again that the builder still knows it and
         * it is open), as the tab's Close closes one - who knew it still knows it, a GM may open it again -, and the
         * project kept for the Reroll as a Secret Passage's (`keep`). Uncrossed: open again, unless a GM opened or closed
         * it since (`unsealPassagesOf`). A refusal closes nothing, and the GMs are told why.
         */
        key: "sealsPassage",
        has: meta => meta.target?.preset === "sealPassage" && typeof meta.target.passageId === "string",
        onCrossed: ({ id, name, meta }) => {
            let made = null;
            return {
                apply: async () => {
                    made = await (await import("./passages-gm.mjs")).sealPassageDone(id, { passageId: meta.target.passageId, builderId: meta.by ?? null,
                        room: meta.target.room ?? null });
                },
                remove: true,
                keep: true,
                after: async () => {
                    if (made?.refused) await whisperToGms(`<p>${esc(game.i18n.format("DRPG.Passage.card.notSealed", { name, why: await whyOf(made.refused) }))}</p>`);
                }
            };
        },
        onUncrossed: ({ id }) => ({ apply: async () => (await import("./passages-gm.mjs")).unsealPassagesOf(id) })
    },
    {
        /*
         * A FINISHED CLOSE THE BREACH GIVES THE WALL BACK (E15 part 2 C5; the owner's (2) of 15.10: "cofnięcie wyłomu jako
         * projekt gracza; przycisk GM-a zostaje"). Read for a project whose secret half names the preset and the breach.
         * Crossed: restored on the primary in the step (passages-gm.mjs `closeBreachDone`: the breach judged again as
         * standing and with a side in the project's room, then `restoreBreach`, as the GMs' Close the breach), and the
         * project kept for the Reroll as a seal's (`keep`; fix e1-G3, findings BEH-1, E15p2-END-05: one Reroll took back a
         * seal and left a close). Uncrossed: the breach cut again as its row held it (`reopenBreach`, from what the
         * completion kept in the GMs' half, `target.reopen`), the GMs told when the wall no longer allows it. A breach gone
         * before the completion restores nothing, and the GMs are told why.
         */
        key: "closesBreach",
        has: meta => meta.target?.preset === "closeBreach" && typeof meta.target.breachId === "string",
        onCrossed: ({ id, name, meta }) => {
            let made = null;
            return {
                apply: async () => {
                    made = await (await import("./passages-gm.mjs")).closeBreachDone(id, { sceneId: meta.target.sceneId ?? null, breachId: meta.target.breachId,
                        room: meta.target.room ?? null });
                    if (made?.reopen) await setProjectMeta(id, { target: { ...meta.target, reopen: made.reopen } });
                },
                remove: true,
                keep: true,
                after: async () => {
                    if (made?.refused) await whisperToGms(`<p>${esc(game.i18n.format("DRPG.Passage.card.notClosed", { name, why: await whyOf(made.refused) }))}</p>`);
                }
            };
        },
        onUncrossed: ({ id, name, meta }) => {
            if (!meta.target?.reopen) return {};
            let made = null;
            return {
                apply: async () => {
                    made = await (await import("./passages-gm.mjs")).reopenBreach(meta.target.reopen);
                    await setProjectMeta(id, { target: { ...meta.target, reopen: null } });
                },
                after: async () => {
                    if (made?.refused) await whisperToGms(`<p>${esc(game.i18n.format("DRPG.Passage.card.notReopened", { name, why: await whyOf(made.refused) }))}</p>`);
                }
            };
        }
    },
    {
        /*
         * A FINISHED REPAIR AN ITEM MENDS ITS ITEM (E15 part 2 C5; the owner's (3) of 15.10, Q1 of 19.10). Read for a
         * project whose secret half names the preset and the item. Crossed: mended on the primary in the step
         * (inventory.mjs `repairItem`, which judges again that the item is still on the builder's own sheet, a usable or
         * a tool, and broken or worn as the GMs hold it), and the project kept for the Reroll as a seal's (`keep`; fix
         * e1-G3, findings BEH-1, E15p2-END-05), what it mended kept in the GMs' half (`target.was`); the builder is told
         * the item is whole. Uncrossed: the item as it was (`unrepairItem`), unless broken or worn again since. A refusal
         * mends nothing, and the GMs are told why.
         */
        key: "repairsItem",
        has: meta => meta.target?.preset === "repairItem" && typeof meta.target.itemId === "string",
        onCrossed: ({ id, name, meta }) => {
            let made = null;
            const builder = game.actors.get(meta.by ?? "") ?? null;
            return {
                apply: async () => {
                    made = await (await import("./inventory.mjs")).repairItem(builder, meta.target.itemId, { ref: id });
                    if (made?.was) await setProjectMeta(id, { target: { ...meta.target, was: made.was } });
                },
                remove: true,
                keep: true,
                after: async () => {
                    if (made?.refused) await whisperToGms(`<p>${esc(game.i18n.format("DRPG.Project.notRepaired", { name, why: await whyOf(made.refused) }))}</p>`);
                    else if (made?.id && builder) await whisperToOwner(builder, `<p>${game.i18n.format("DRPG.Project.itemRepaired", { item: esc(made.name) })}</p>`);
                }
            };
        },
        onUncrossed: ({ id, meta }) => {
            if (!meta.target?.was) return {};
            const builder = game.actors.get(meta.by ?? "") ?? null;
            return {
                apply: async () => {
                    await (await import("./inventory.mjs")).unrepairItem(builder, meta.target.itemId, meta.target.was, { ref: id });
                    await setProjectMeta(id, { target: { ...meta.target, was: null } });
                }
            };
        }
    }
];

/** A completion's refusal in the table's language (passages-gm.mjs `whyText`, E15 part 2 fix e1-G4): the English stays in the log. */
async function whyOf(reason) {
    return (await import("./passages-gm.mjs")).whyText(reason);
}

/** A change, whatever asked for it, cut to the keys the step knows (and a packet's to the same): null when none is left. */
export function cleanProjectChange(change) {
    if (!change || typeof change !== "object" || Array.isArray(change)) return null;
    const plain = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);
    const out = {};
    const delta = Math.trunc(Number(change.delta));
    if (Number.isFinite(delta) && delta) out.delta = delta;
    const target = Number(change.target);
    if (change.target !== undefined && change.target !== null && Number.isFinite(target)) out.target = Math.max(1, Math.trunc(target));
    if (change.name !== undefined && change.name !== null && String(change.name)) out.name = String(change.name);
    if (typeof change.img === "string" && change.img) out.img = change.img;
    if (plain(change.meta)) out.meta = JSON.parse(JSON.stringify(change.meta));
    if (plain(change.ownership)) {
        out.ownership = Object.fromEntries(Object.entries(change.ownership)
            .filter(([key, level]) => key && Number.isInteger(level) && level >= 0 && level <= 3));
    }
    if (change.remove === true) out.remove = true;
    if (change.create === true) out.create = true;
    // Who sees it, as operations the step works out on what it reads (E36 fix e1-G2; projects-secrecy.mjs `sightChange`).
    const user = value => typeof value === "string" && Boolean(game.users.get(value));
    const ids = value => (Array.isArray(value) ? value.filter(id => typeof id === "string" && id) : null);
    if (user(change.share)) out.share = change.share;
    if (user(change.unshare)) out.unshare = change.unshare;
    if (plain(change.seal)) out.seal = { viewers: ids(change.seal.viewers), was: ids(change.seal.was) };
    if (change.reveal === true) out.reveal = true;
    if (change.reseal === true) out.reseal = true;
    return Object.keys(out).length ? out : null;
}

/**
 * Two or more changes of one project as one (E36 C2): a window's row that edits, re-images and seals is one
 * change of the entry, not three. Later parts win a key; `meta` is merged. Null when none is left.
 */
export function combineChanges(...parts) {
    const out = {};
    for (const part of parts) {
        if (!part) continue;
        const { meta, ...rest } = part;
        Object.assign(out, rest);
        if (meta && Object.keys(meta).length) out.meta = { ...out.meta, ...meta };
    }
    return Object.keys(out).length ? out : null;
}

/** `by`, cut the same way: a kind of `CHANGE_KINDS` ("gm" otherwise), a user of this world (this one otherwise), a character or none. */
function cleanBy(by) {
    const kind = CHANGE_KINDS.includes(by?.kind) ? by.kind : "gm";
    const userId = typeof by?.userId === "string" && game.users.get(by.userId) ? by.userId : game.user.id;
    const actorId = typeof by?.actorId === "string" && by.actorId ? by.actorId : null;
    return { kind, userId, actorId };
}

/**
 * Change a project, the one way (E36 C1): `change` is `{ delta }`, `{ target, name, img }`, `{ meta }`,
 * `{ ownership }` or `{ remove: true }`, combined as a caller combines them, or `{ create: true }` with the
 * new project's name, target, img, ownership and meta under the id its caller drew (createProject, E36 C2);
 * `by` is `{ kind, userId, actorId }`. On the primary GM the change is a step of
 * `serialWrite(COUNTDOWNS_KEY, ...)`; another GM's goes there by `project.change` (gm-bridge.mjs
 * `requestProjectChange`), and a player's browser never runs it: off a GM this answers null and logs.
 * Answers `{ id, name, from, to, target, changed, reason?, crossed, uncrossed, removed }` once the step
 * and what follows it have run, or null for no such project; a step that throws rejects this caller's
 * promise alone. The queue is joined before anything here awaits, so changes queue in call order.
 */
export async function applyProjectChange(countdownId, change, { by = null } = {}) {
    if (!game.user?.isGM) {
        log(`A project change was asked of a browser that is no GM's (${countdownId}); nothing was changed.`);
        return null;
    }
    const clean = cleanProjectChange(change);
    if (!countdownId || !clean) return null;
    const who = cleanBy(by);
    if (!isPrimaryGm()) {
        const { requestProjectChange } = await import("./gm-bridge.mjs");
        const res = await requestProjectChange(countdownId, clean, who);
        return res.ok ? (res.value ?? null) : null;
    }
    const step = await serialWrite(COUNTDOWNS_KEY, () => changeStep(countdownId, clean, who));
    /* NO LONGER THE PRIMARY WHEN ITS STEP CAME (E36 fix e1-G4, 25.10.2026; finding E36-R4). The question above is
       asked as the change joins the queue; a GM whose user id sorts first connecting while it waited made another
       browser the primary, and the steps queued here ran on, beside that browser's queue. The step asks again
       (`changeStep`) and writes nothing then: the change is asked of the primary as another GM's is, outside this
       queue (a step never awaits a reply). E36-T9. */
    if (step.forward) {
        log(`This browser is no longer the primary GM's; the change of ${countdownId} is asked of the primary.`);
        const { requestProjectChange } = await import("./gm-bridge.mjs");
        const res = await requestProjectChange(countdownId, clean, who);
        return res.ok ? (res.value ?? null) : null;
    }
    const { result, after } = step;
    // Outside the queue: the next change is under way while these post (no step awaits a window or a reply).
    for (const run of after) {
        try {
            await run();
        } catch (err) {
            error(`What follows a change of the project ${countdownId} failed`, err);
        }
    }
    /* ITS TOKEN, ONCE, LAST (E36 C4; audit S09-19): its room, its colour, whether it stands at all, and a
       removed project's tokens taken off every scene (projects-map.mjs `syncProjectToken`). A change that
       changed nothing (a frozen bar's +1, a full bar's) moves no token. Dynamic, as projects-map.mjs reads
       this file. A token that cannot be put right is not a change that failed: the tray still has it. */
    if (result?.changed) {
        try {
            await (await import("./projects-map.mjs")).syncProjectToken(countdownId);
        } catch (err) {
            error(`Could not put the project ${countdownId}'s token right`, err);
        }
    }
    return result;
}

/**
 * The step: read, change, clamp, ask the rows, write, in that order, inside the queue. Answers
 * `{ result, after }`, `after` the list `applyProjectChange` runs once the step has ended.
 *
 * CROSSING. Crossed when the bar was under its target and is at it now, uncrossed the other way, the
 * target read after the change: `before < start <= after` for a change of progress, as addProgress
 * held it, and a target lowered under the progress crosses (S09-15). A target of 0 is never reached.
 * A +1 on a full bar cannot move it and is answered above (alreadyFull) with no crossing. THE RISK IS A BAR
 * TAKEN BACK AND FILLED AGAIN (audit S09-14; E15 part 1 C1 rewrote this, which read a Reroll's
 * undo as the reason and the risk as handled): a GM's -1, a Reroll's undo or (until E15 part 1 C1)
 * an Earthquake takes a finished bar under its target, and filling it again crosses a second time,
 * so its completion rows run twice - a trap armed again after it had fired, a second receipt. The
 * rows answer it (D40): an uncrossing disarms a trap, a crossing does not arm one that has fired
 * (`firedAt`); tier 2 E36-T3 and E15-T1 count one receipt per arming.
 */
async function changeStep(countdownId, change, by) {
    // Asked again here, where the step reads (E36 fix e1-G4): off the primary now, `applyProjectChange` asks the primary.
    if (!isPrimaryGm()) return { result: null, after: [], forward: true };
    const data = game.settings.get(DH, COUNTDOWNS);
    const countdowns = foundry.utils.duplicate(data?.countdowns ?? {});
    const project = countdowns[countdownId];
    if (change.create) return createInStep(countdownId, change, project, data, countdowns);
    if (!project) return { result: null, after: [] };
    const after = [];
    // Both halves, before anything below can delete them: a repair's row goes with it in this step.
    const meta = { ...metaFor(countdownId), ...secretsOf(countdownId) };
    const up = countsUp(countdownId);
    const oldStart = project.progress?.start ?? 0;
    const raw = project.progress?.current ?? 0;
    const before = up ? raw : Math.max(0, oldStart - raw);

    if (change.remove) {
        const result = { id: countdownId, name: project.name, from: before, to: before, target: oldStart, changed: true,
            crossed: false, uncrossed: false, removed: true };
        await removeInStep(countdownId, data, countdowns, after);
        return { result, after };
    }

    /*
     * A SABOTAGED PROJECT DOES NOT MOVE FORWARD (E03, 24.09.2026; audit S09-02). "Frozen - its
     * progress is preserved but cannot be advanced" was the rule, and the only thing enforcing it
     * was the pickers on a player's screen: a Call aimed from an old dialog, a Reroll that landed
     * after the freeze, or a console, all advanced it. Every change comes through here, the GM's
     * own included, so it is enforced here, read in the step. Taking progress away still works -
     * an undo or an Earthquake is not advancing it.
     */
    if (change.delta > 0 && isFrozen(countdownId)) {
        log(`Project "${project.name}" did not move: it is frozen by sabotage.`);
        return { result: { id: countdownId, name: project.name, from: before, to: before, target: oldStart, changed: false,
            reason: "DRPG.Project.frozenNoProgress", crossed: false, uncrossed: false, removed: false }, after };
    }

    /*
     * WHO SEES IT, FROM WHAT THE STEP READ (E36 fix e1-G2; findings E36-END-S2, E36-R2, F4). A share, a revoke,
     * a seal, a reveal or a reseal is worked out here, from the countdown read in this step, into the ownership
     * map and the meta the rest of the step writes: worked out by its caller, it was a map of the moment before
     * the queue, and a change queued between put back what it had taken away. A share or a revoke of a project
     * that is no longer secret makes nothing and says so (`refused`); one that changes nobody makes nothing.
     */
    if (SIGHT_KEYS.some(key => change[key] !== undefined)) {
        /* A PRESET THAT IS ALWAYS SECRET IS NEVER REVEALED (E15 part 2 fix e1-G1, 25.10.2026; findings SEC-2, END-04,
           R2). A Secret Passage is sealed at its create whatever the form says (`createProject`), and the edit window,
           the manager's row or a console's `revealProject` then made it public: every player was a viewer
           (`revealChange`), its name and room in every tray, and its completion gave every player's students the
           passage. Refused here, in the step, whichever road asked. */
        const always = change.reveal && meta.target?.preset
            ? (await import("./passages-gm.mjs")).PASSAGE_PRESETS[meta.target.preset]?.secret === "always" : false;
        const sight = always ? { refused: "it is always secret" } : sightChange(countdownId, change);
        const unchanged = { id: countdownId, name: project.name, from: before, to: before, target: oldStart, changed: false,
            crossed: false, uncrossed: false, removed: false };
        if (sight?.refused) {
            log(`Who sees "${project.name}" was not changed: ${sight.refused}.`);
            return { result: { ...unchanged, refused: sight.refused }, after };
        }
        const rest = Object.keys(change).filter(key => !SIGHT_KEYS.includes(key));
        if (!sight && !rest.length) return { result: unchanged, after };
        if (sight?.ownership) change = { ...change, ownership: sight.ownership };
        if (sight?.meta) change = { ...change, meta: { ...change.meta, ...sight.meta } };
        /* WHOEVER A FINDER LETS IN IS A FINDER TOO (E15 part 2 fix e1-G1; finding SEC-1). A player who found a secret
           project by Observe (`foundBy`) is told it is finished and given nothing of what it made; a share that player
           asked (`project.share`, the sender as `by.userId`) let another player in as a plain viewer, whose students the
           completion then gave the passage - and who could show it to the finder. The one let in is written beside the
           finder, in the same step as the share. */
        if (sight && change.share && meta.foundBy?.[by.userId] && !meta.foundBy[change.share]) {
            change = { ...change, meta: { ...change.meta, foundBy: { ...meta.foundBy, ...change.meta?.foundBy, [change.share]: Date.now() } } };
        }
    }

    const next = foundry.utils.duplicate(project);
    if (change.name !== undefined) next.name = change.name;
    if (change.img !== undefined) next.img = change.img;
    if (change.ownership !== undefined) next.ownership = change.ownership;
    // One clamp for both directions (updateProject's A15): `current` is progress earned or what is left, and neither exceeds the start.
    if (change.target !== undefined) next.progress = { ...next.progress, start: change.target, current: Math.min(raw, change.target) };
    const start = next.progress?.start ?? 0;
    const was = next.progress?.current ?? 0;
    if (change.delta) {
        // "Advance the project" in whichever direction this countdown stores, clamped inside the bar.
        const ceiling = start > 0 ? start : Infinity;
        next.progress = { ...next.progress, current: Math.max(0, Math.min(ceiling, was + (up ? change.delta : -change.delta))) };
    }
    const nextRaw = next.progress?.current ?? 0;
    const afterProgress = up ? nextRaw : Math.max(0, start - nextRaw);
    const moved = JSON.stringify(next) !== JSON.stringify(project);

    if (change.delta && !moved && !change.meta) {
        // Nothing moved. Saying so is the whole point: a silent no-op is indistinguishable from a broken socket.
        const why = change.delta > 0 ? "DRPG.Project.alreadyFull" : "DRPG.Project.alreadyEmpty";
        log(`Project "${project.name}" did not move: already ${before}/${start}.`);
        return { result: { id: countdownId, name: project.name, from: before, to: afterProgress, target: start, changed: false,
            reason: why, crossed: false, uncrossed: false, removed: false }, after };
    }

    const wasDone = oldStart > 0 && before >= oldStart;
    const isDone = start > 0 && afterProgress >= start;
    const crossed = !wasDone && isDone, uncrossed = wasDone && !isDone;

    // Every row answers before anything is written: a row whose answer throws leaves the project as it was.
    const ctx = { id: countdownId, name: next.name, before, after: afterProgress, target: start, meta, by, countdowns };
    const answers = [];
    if (crossed || uncrossed) {
        for (const row of COMPLETION_EFFECTS) {
            const has = typeof row.has === "function" ? row.has(meta) : Boolean(meta[row.key]);
            const hook = crossed ? row.onCrossed : row.onUncrossed;
            if (has && typeof hook === "function") answers.push(await hook(ctx) ?? {});
        }
    }

    if (moved) {
        countdowns[countdownId] = next;
        await writeAllCountdowns({ ...data, countdowns });
        log(`Project "${next.name}": ${before} -> ${afterProgress} of ${start}`);
    }
    if (change.meta) await setProjectMeta(countdownId, change.meta);
    for (const answer of answers) {
        for (const [id, patch] of Object.entries(answer.meta ?? {})) await setProjectMeta(id, patch);
    }
    /* A ROW'S OWN WRITE THAT THROWS (E36 fix e1-G4, 25.10.2026; findings E36-R6, F6). An `apply` runs after the
       setting's write - the trap row's armTrap needs the bar full - so its throw rejected a change already written:
       the bar read full, no receipt, no done card, no token sync, and a retry answered alreadyFull, so nothing ever
       ran it again (E36-T9 at 4082fa98). Caught now, each on its own: logged, told to the GMs after the step, and the
       rest of the step and what follows it run (the trap row's receipt falls back to the card with Fire when it
       could not arm). */
    for (const answer of answers) {
        if (typeof answer.apply !== "function") continue;
        try {
            await answer.apply();
        } catch (err) {
            error(`What the completion of the project "${next.name}" does could not all be done`, err);
            const why = String(err?.message ?? err);
            after.push(() => whisperToGms(`<p>${esc(game.i18n.format("DRPG.Project.effectFailed", { name: next.name, error: why }))}</p>`));
        }
    }
    // A completion kept for a Reroll is let go when the bar is taken back under its target.
    if (uncrossed && secretsOf(countdownId).keptFor) await projectSecretStore.patch(countdownId, { keptFor: null });

    let removed = false;
    if (answers.some(answer => answer.remove)) {
        const kept = answers.some(answer => answer.keep) && by.actorId
            ? rerollBookmarkStore.get(by.actorId)?.messageId ?? null : null;
        if (kept) {
            await projectSecretStore.patch(countdownId, { keptFor: { actorId: by.actorId, messageId: kept } });
        } else {
            await removeInStep(countdownId, game.settings.get(DH, COUNTDOWNS), foundry.utils.duplicate(game.settings.get(DH, COUNTDOWNS)?.countdowns ?? {}), after);
            removed = true;
        }
    }
    for (const answer of answers) if (typeof answer.after === "function") after.push(answer.after);
    // Every crossing's own word: the builder, or whoever filled it (none for a repair or a trap, `announceProjectDone`).
    if (crossed) after.push(() => announceProjectDone(next.name, start, by.userId, meta));

    return { result: { id: countdownId, name: next.name, from: before, to: afterProgress, target: start, changed: true,
        crossed, uncrossed, removed }, after };
}

/**
 * Make a project, inside a step (E36 C2): the countdown under the id createProject drew, then its meta, both
 * halves (`setProjectMeta` splits the GMs' fields off). An id already taken makes nothing: the id is drawn at
 * random, so a second create of it is a packet sent twice, not a second project. A new bar is empty, so nothing
 * crosses. Its token is placed after the step, as every change's is (`applyProjectChange`, E36 C4).
 */
async function createInStep(countdownId, change, existing, data, countdowns) {
    if (existing) {
        log(`A project ${countdownId} already exists; nothing was made.`);
        return { result: null, after: [] };
    }
    /*
     * A REPAIR FREEZES WHAT IT REPAIRS, IN THE SAME STEP (E36 C3, 25.10.2026; audit S17-18, S09-02). `sabotageProject`
     * asked "is it frozen, is it a repair" on its own, then made the repair, then wrote the pair - three moments a
     * second Sabotage of the same project passed the same question in: two at once made two repairs, and the
     * second's `frozenBy` left the first a repair of nothing (E36-T5 counted two at 042f3482). Read here, in the
     * step, nothing lands between the question and the freeze: a project gone, already frozen or itself a repair
     * makes no repair at all.
     */
    const repaired = change.meta?.repairs ?? null;
    if (repaired) {
        const why = !countdowns[repaired] ? "it is gone" : metaFor(repaired).frozenBy ? "it is frozen already"
            : metaFor(repaired).repairs ? "it is a repair" : null;
        if (why) {
            log(`No repair of ${repaired} was made: ${why}.`);
            return { result: null, after: [] };
        }
    }
    const target = change.target ?? PROJECT_SCALE.everyday.progress;
    countdowns[countdownId] = {
        type: "narrative",
        name: change.name ?? "?",
        img: change.img || "icons/magic/time/hourglass-yellow-green.webp",
        ownership: change.ownership ?? { default: OBSERVER },
        progress: {
            current: 0,
            start: target,
            looping: "noLooping",
            // Only advanced by the Work on Project action.
            type: "custom"
        }
    };
    await writeAllCountdowns({ ...data, countdowns });
    if (change.meta) await setProjectMeta(countdownId, change.meta);
    if (repaired) await setProjectMeta(repaired, { frozenBy: countdownId });
    return { result: { id: countdownId, name: countdowns[countdownId].name, from: 0, to: 0, target, changed: true,
        crossed: false, uncrossed: false, removed: false, created: true }, after: [] };
}

/**
 * Take a project out, inside a step: its countdown, its row in projectMeta (and the thaw of what it
 * repaired), its secrets. What is not the setting's goes in `after`: its trap's ledger, and its own repair,
 * a change of its own; its tokens, found by their own flags, go with every change's token sync once the
 * step has ended (projects-map.mjs `syncProjectToken` of a project gone, E36 C4). deleteProject comes here
 * since E36 C2.
 */
async function removeInStep(countdownId, data, countdowns, after) {
    const own = metaFor(countdownId);
    delete countdowns[countdownId];
    await writeAllCountdowns({ ...data, countdowns });
    const rows = { ...projectMeta() };
    delete rows[countdownId];
    const target = own.repairs ?? null;
    if (target && countdowns[target] && rows[target]?.frozenBy === countdownId) rows[target] = { ...rows[target], frozenBy: null };
    await game.settings.set(MODULE_ID, SETTINGS.projectMeta, rows);
    await projectSecretStore.drop(countdownId);
    log(`Project ${countdownId} removed.`);
    after.push(async () => (await import("./traps.mjs")).pruneTrapsFor(new Set(Object.keys(rows))));
    const repair = own.frozenBy ?? null;
    if (repair && countdowns[repair] && metaFor(repair).repairs === countdownId) {
        after.push(() => applyProjectChange(repair, { remove: true }, { by: { kind: "system" } }));
    }
}

/**
 * A completion kept for a Reroll is let go (the `keep` of a row, above): on the primary, each project
 * kept for a character whose bookmark now names another roll, or none, is removed, through the entry.
 * Run whenever the GMs' bookmarks change (`registerProjectChanges`); answers how many went.
 */
export async function releaseKeptProjects() {
    if (!isPrimaryGm()) return 0;
    let released = 0;
    for (const [id, row] of Object.entries(projectSecretStore.entries() ?? {})) {
        const kept = row?.keptFor;
        if (!kept?.actorId) continue;
        if ((rerollBookmarkStore.get(kept.actorId)?.messageId ?? null) === kept.messageId) continue;
        if ((await applyProjectChange(id, { remove: true }, { by: { kind: "system" } }))?.removed) released++;
    }
    return released;
}

/** The listener behind `releaseKeptProjects`: the GMs' store of bookmarks is a client setting on each GM's browser. */
export function registerProjectChanges() {
    Hooks.on("clientSettingChanged", key => {
        if (key !== `${MODULE_ID}.${SETTINGS.gmRerollBookmarks}` || !isPrimaryGm()) return;
        releaseKeptProjects().catch(err => error("Could not let a kept project go", err));
    });
    /* A proposer's card, or its words, came or went (H84 fix G3): `projectsToldHere` reads again, and the tray and the
       project tokens ask again whom they show when the words name a project. */
    const forget = () => { toldHere = null; };
    Hooks.on("createChatMessage", forget);
    Hooks.on("deleteChatMessage", forget);
    Hooks.on("drpgSecretStored", message => {
        forget();
        if (!cardMeta(message, PROJECT_KNOWN)) return;
        import("./projects-tray.mjs").then(m => m.refreshProjects?.()).catch(err => error("Could not redraw the Projects tray", err));
        import("./visibility.mjs").then(m => m.applyAll?.()).catch(err => error("Could not ask again who sees the project tokens", err));
    });
}

/**
 * Create a project. GM only.
 *
 * Progression type is set to `custom` on purpose: that is the mode where a
 * countdown only advances when something explicitly advances it, which is what
 * the Work on Project action does. Any other mode would also tick on attacks
 * or rests and quietly desynchronise from the guide's progress rules.
 *
 * @param {object} data
 * @param {string} data.name
 * @param {number} data.target        Progress needed - 3/4/6/8 per the scale.
 * @param {string} [data.room]        Room the project belongs to.
 * @param {boolean} [data.indirectMurder]
 * @param {boolean} [data.secret]
 * @param {string[]} [data.viewers]   Users who may see it when secret.
 * @param {string} [data.img]         Portrait/icon. Defaults to the hourglass.
 * @param {string} [data.glyph]       Tray glyph, a PROJECT_GLYPHS key. The
 *   Stained Glass tray draws this instead of `img`; null means the hourglass.
 */
export async function createProject({
    name, target = PROJECT_SCALE.everyday.progress, room = null, indirectMurder = false, secret = false,
    viewers = [], trait = null, img = "icons/magic/time/hourglass-yellow-green.webp",
    glyph = null,
    // Whose trap this is, and what sets it off. Both only mean anything on an
    // indirect murder, and both are what the guide asks for in place of a named
    // victim: "you do not name the victim - you name a condition".
    killerId = null, condition = "",
    /*
     * WHAT THE MODULE WILL WATCH FOR, in the `{ kind, targetId, afterDark,
     * notBuilder }` shape traps.mjs reads. Only meaningful on an indirect
     * murder, like `killerId` and `condition` beside it - and like them, it is
     * stored rather than inferred so that a trap with no trigger is a trap the
     * GM chose to watch themselves rather than one the module forgot about.
     */
    trigger = null,
    /*
     * A REPAIR, AND WHAT IT REPAIRS (E36 C3): `sabotageProject`'s. With `repairFor` the new project is the repair
     * of that project (its meta's `repairs`), which the step freezes in the same step it makes the repair, after
     * reading there that it is still a project, not frozen and no repair itself; `saboteur` is the player who
     * asked, the GMs'. Not named `repairs`: that is this file's function (R21 reads a shadowed name as a value).
     */
    repairFor = null, saboteur = null,
    // The request a player's Sabotage came under (E18 C7): its resend is answered this repair (`sabotageOfRequest`).
    sabotageAsk = null,
    /*
     * A PROJECT THAT MAKES A PASSAGE (E15 part 2 C2): `presetTarget` is `{ preset, room }` - a key of passages-gm.mjs
     * `PASSAGE_PRESETS` and the neighbour the proposal named - and `passage` the stretch the approval picked. Both are
     * the GMs' (projects-secrecy.mjs `PROJECT_SECRET_FIELDS`); a preset that is always secret seals the project
     * whatever `secret` says. Not named `target`: that is the bar's.
     */
    presetTarget = null, passage = null,
    // WHO PROPOSED IT, as an actor id.
    //
    // The proposal card has carried this since the bridge was written - the
    // "Approve" button's `data.by` - and the approval screen threw it away, so
    // no project has ever known whose idea it was. That is the gap E10 exists
    // to close: without it, a finished project can only be reported to whoever
    // happened to add the last point, which is often not the person who has
    // been pushing it for two days.
    by = null
} = {}) {
    if (!game.user.isGM) return null;
    if (!name) return null;

    const id = foundry.utils.randomID();

    // ONE answer to "is this hidden", used for the ownership map AND for the
    // metadata flag.
    //
    // They used to be worked out separately: the ownership from `secret` alone,
    // the flag from `secret || indirectMurder`. So an indirect murder created
    // without an explicit `secret: true` came out marked secret in our data and
    // left at `default: OBSERVER` in Foundry's - the module hid it from every
    // list it draws, and Daggerheart's own Projects tray showed it to the whole
    // table. Measured: a murder project sitting in a player's tray while its
    // own owner could not see it anywhere.
    const always = presetTarget?.preset
        ? (await import("./passages-gm.mjs")).PASSAGE_PRESETS[presetTarget.preset]?.secret === "always" : false;
    const hidden = secret || indirectMurder || always;

    // The killer sees their own trap without anybody remembering to share it.
    //
    // Creating a project and giving somebody sight of it were two independent
    // steps, and skipping the second produced a project the killer could not
    // work on: `projectsAvailableIn` filters on `canSee`, so their own murder
    // was missing from their own Work on Project list.
    //
    // AND THE BUILDER IS ALWAYS IN, WHOEVER ELSE IS (F3, 17.09; ITEM-03). Every
    // player's project reaches this through the approval window, which named the
    // killer only when the GM picked somebody under "Also visible to" - left at
    // "-", an indirect murder was sealed with no viewers at all, and the player
    // who built it could not see it or work on it. The builder - the named
    // killer, failing that the proposer - is added to the viewers, not replaced
    // by them. Which of the two is named when the GM ticks somebody on a
    // player's proposal is the caller's answer (`killerIdFor`, projects-ui.mjs).
    const audience = hidden
        ? Array.from(new Set([...viewers, ...ownerIdsOfId(killerId ?? by)]))
        : [];

    /* ONE CHANGE OF THE ENTRY (E36 C2, 25.10.2026; audit S17-18): the countdown and its meta are written in one
       step of `applyProjectChange`, on the primary, so no other change lands between them; another GM's
       creation goes there by `project.change`. The countdown is the step's (`createInStep`). */
    const made = await applyProjectChange(id, {
        create: true, name, target, img: img || "icons/magic/time/hourglass-yellow-green.webp",
        ownership: hidden ? ownershipMap(audience) : { default: OBSERVER },
        // `trait` is set by the GM at creation - the guide lets a project demand a
        // specific kind of work, so the player does not get to pick the easy stat.
        // `countsUp` is stamped rather than left to the default so the direction
        // stays explicit in the data, not just in this file's assumptions.
        meta: {
            room, indirectMurder, secret: hidden, trait, countsUp: true,
            // Gated on the way IN, not on the way out: a name the sprite set does
            // not have would reach the tray as `var(--drpg-px-nonsense)`, which is
            // an invalid mask and therefore NO glyph at all - not the hourglass.
            glyph: isProjectGlyph(glyph) ? glyph : null,
            by: by ?? null,
            // The builder is the killer unless somebody said otherwise (F3).
            killerId: indirectMurder ? (killerId ?? by ?? null) : null,
            condition: indirectMurder ? condition : "",
            // Not armed here - armed when the bar fills. A trap that watched from
            // the moment it was proposed would be a trap you can set off while its
            // owner is still building it.
            trigger: indirectMurder && trigger?.kind ? { ...trigger, armed: false, firedAt: null } : null,
            ...(repairFor ? { repairs: repairFor } : {}),
            ...(saboteur ? { saboteur } : {}),
            ...(saboteur && sabotageAsk ? { sabotageAsk } : {}),
            ...(presetTarget?.preset ? { target: presetTargetOf(presetTarget) } : {}),
            ...(passage ? { passage } : {}),
            /* A PUBLIC PROJECT IS KNOWN TO WHOEVER PROPOSED IT (H84-04; H84 fix G3): the GMs' mark that its proposer is
               told below, by a private card (`tellProposer`) - never their user ids in the public meta. */
            ...(!hidden && by && room ? { proposerTold: true } : {})
        }
    }, { by: { kind: "gm" } });
    if (!made?.created) return null;
    if (!hidden && by && room) {
        try {
            await tellProposer(id, { by, name, room });
        } catch (err) {
            error(`Could not tell the proposer of "${name}" that they know it`, err);
        }
    }

    /* ONTO THE MAP, if it has a room to stand in: by the change itself (`applyProjectChange` ends with the
       token's sync, E36 C4), on the primary GM's browser where the change ran. Until E36 this placed the
       token here, on the browser of whichever GM made the project. */
    log(`Created project "${name}" (${target} progress)${room ? ` in ${room}` : ""}${trait ? `, ${trait}` : ""}.`);
    return { id, name, target, trait };
}

/**
 * A preset's target as the GMs keep it (E15 part 2 C2, C5): `{ preset, room }`, and for the owner's three of 15.10 what
 * the approval named - a passage (`passageId`), a breach (`sceneId`, `breachId`), an item of the builder's (`itemId`) -,
 * strings alone.
 */
function presetTargetOf(presetTarget) {
    const ids = Object.fromEntries(["passageId", "sceneId", "breachId", "itemId"]
        .filter(key => typeof presetTarget[key] === "string" && presetTarget[key]).map(key => [key, presetTarget[key]]));
    return { preset: String(presetTarget.preset), room: presetTarget.room ?? null, ...ids };
}

/**
 * Who found a secret project by Observe (E15 part 2 C2): the players of `userIds` added to its `foundBy`, through the
 * entry, so a Secret Passage's completion tells them it is finished and gives them nothing of what it made (its row in
 * `COMPLETION_EFFECTS`). observe.mjs `shareFoundProject` calls it after its share. GM only; answers the entry's result.
 */
export async function noteProjectFound(countdownId, userIds = []) {
    if (!game.user?.isGM) return null;
    const at = Date.now();
    const found = { ...(secretsOf(countdownId).foundBy ?? {}) };
    for (const userId of userIds ?? []) if (typeof userId === "string" && game.users.get(userId)) found[userId] = found[userId] ?? at;
    return applyProjectChange(countdownId, { meta: { foundBy: found } }, { by: { kind: "gm" } });
}

/* ==========================================================================
 * SABOTAGE AND REPAIR
 * --------------------------------------------------------------------------
 * Guide: sabotage "creates damage requiring a repair project". So a sabotaged
 * project freezes - its progress is preserved but cannot be advanced - and a
 * Repair project appears alongside it. Finishing the repair thaws the original.
 *
 * A frozen project cannot be sabotaged again: there is nothing left to break
 * until it works, and stacking repairs would make one action permanently
 * disable a project.
 * ========================================================================== */

/** Is this project frozen by sabotage? */
export function isFrozen(countdownId) {
    return Boolean(metaFor(countdownId).frozenBy);
}

/** The project this repair will unfreeze, if any. */
export function repairs(countdownId) {
    return metaFor(countdownId).repairs ?? null;
}

/**
 * Freeze a project and create its repair.
 *
 * @param {string} targetId   The sabotaged project.
 * @param {number} difficulty Progress the repair needs - harder sabotage, harder fix.
 * @returns {Promise<{repair: object, target: string}|null>}
 */
export async function sabotageProject(targetId, difficulty = 3, { saboteur = null, requestId = null, rollId = null, actorId = null, penalty = 0, relief = 0 } = {}) {
    if (!game.user.isGM) {
        const { requestSabotage } = await import("./gm-bridge.mjs");
        // `rollId`: the Sabotage roll's message, whose row on the GMs takes the freeze (gm-bridge.mjs `handleSabotage`),
        // and since E08+E28 C16 whose record the GM reads the repair off (`repairOf`). A difficulty of 0 is a miss:
        // it freezes nothing, and says nothing to the player if it cannot be sent (`quiet`).
        const res = await requestSabotage(targetId, difficulty, { rollId, actorId, penalty, relief, quiet: !difficulty });
        // What the GM wrote, `{ repair, target }`, or null: the contract every caller reads.
        return res.ok ? res.value : null;
    }

    const target = allProjects().find(p => p.id === targetId);
    if (!target) return null;

    if (isFrozen(targetId)) {
        ui.notifications.warn(game.i18n.format("DRPG.Project.alreadyFrozen", { name: target.name }));
        return null;
    }

    // A repair is not a project anybody is building, it is the cost of a
    // sabotage (E03; audit S09-02). Sabotaging it froze the repair, and the
    // frozen original could then only be thawed by repairing the repair.
    if (repairs(targetId)) {
        log(`Refused to sabotage "${target.name}": it is a repair.`);
        return null;
    }

    // Repairing something takes the same kind of work as building it, so the
    // repair inherits the original's required trait. Without this the repair had
    // no trait of its own and Work on Project fell through to asking the player
    // to pick one - letting them choose an easier stat than the people whose
    // project they are fixing had to use.
    //
    // A SECRET PROJECT'S REPAIR IS SECRET, AND NAMES NOTHING (E06 C10, 28.09.2026; audit S09-01).
    // The repair was public and called "Repair: <the target's name>", so sabotaging a secret
    // project put its name on every player's Projects tray. It is sealed now to whoever
    // can see what it repairs - the target's viewers and its builder's owners, the GMs seeing
    // everything - and named "Repair" alone: the countdowns setting that holds its name is read
    // by every browser (known leak S17-31), so a name its viewers alone may know is not written
    // there. A public project's repair is as it was.
    const secret = isSecret(targetId);
    const repair = await createProject({
        name: secret
            ? game.i18n.localize("DRPG.Project.repairNameSecret")
            : game.i18n.format("DRPG.Project.repairName", { name: target.name }),
        target: difficulty,
        room: roomOf(targetId),
        trait: metaFor(targetId).trait ?? null,
        indirectMurder: false,
        secret,
        viewers: secret ? insidersOf(targetId) : [],
        // A repair is not the thing it repairs, and the tray is where a player
        // has to see that at a glance.
        glyph: "tamper",
        // The pair, written by the step that makes the repair (`createInStep`), and who asked, when it was a
        // player (the bridge passes Foundry's sender): a Reroll may take back its own sabotage and nobody else's.
        repairFor: targetId,
        saboteur,
        sabotageAsk: saboteur && typeof requestId === "string" && requestId ? requestId : null
    });
    if (!repair) {
        // Frozen by another Sabotage that reached the step first (E36 C3): told as the check above tells it.
        if (isFrozen(targetId)) ui.notifications.warn(game.i18n.format("DRPG.Project.alreadyFrozen", { name: target.name }));
        return null;
    }

    log(`Project "${target.name}" frozen; repair "${repair.name}" created (${difficulty} progress).`);
    return { repair, target: target.name };
}

/**
 * What a player's Sabotage under `requestId` answered (E18 C7, 26.10.2026; audit S10-43 part 2): `{ repair, target }`, as
 * `sabotageProject` answered it, for the repair whose GMs' row names that saboteur and that request, while it still
 * repairs its target; null otherwise. GM only (`secretsOf`): gm-bridge.mjs `sabotageAgain` reads it on the primary.
 */
export function sabotageOfRequest(saboteur, requestId) {
    if (!game.user?.isGM || typeof saboteur !== "string" || !saboteur || typeof requestId !== "string" || !requestId) return null;
    const projects = allProjects();
    const repair = projects.find(p => secretsOf(p.id).saboteur === saboteur && secretsOf(p.id).sabotageAsk === requestId) ?? null;
    const target = repair ? projects.find(p => p.id === repairs(repair.id)) ?? null : null;
    if (!repair || !target) return null;
    return { repair: { id: repair.id, name: repair.name, target: repair.start, trait: repair.trait ?? null }, target: target.name };
}

/**
 * Why a sabotage cannot be taken back as asked, or null when it can.
 *
 * THE PAIR THE SABOTAGE WROTE, AND NOTHING ELSE (E03, 24.09.2026; audit S10-03,
 * S09-02). `undoSabotage` used to thaw whatever it was given and delete whatever
 * repair it was given, with nothing tying the two together. A player's packet
 * naming any visible project and ANY project id as its "repair" deleted that
 * project - a secret murder plan included, token and trap and all, with no
 * trace of who asked. And a Reroll of a sabotage that had FAILED (no repair)
 * thawed the target, whoever had frozen it. Now the two have to be the pair
 * `sabotageProject` wrote - the target frozen by that repair, the repair
 * repairing that target - and, when the sabotage recorded who asked for it,
 * the asker has to be them.
 *
 * Pure (the metadata is passed in) so the suite can hold it to that. The default reads both halves
 * of a row: who asked is the GMs' store's since E05's fix round (`saboteur`, S1-m1), and every caller
 * runs on a GM - the bridge's guard and `undoSabotage` there.
 *
 * @param {object} options
 * @param {string|null} options.targetId
 * @param {string|null} options.repairId
 * @param {string|null} [options.senderId]  A player's user id; null for a GM.
 * @param {(id: string) => object} [options.meta]
 * @returns {string|null}
 */
export function unsabotageRefusal({ targetId, repairId, senderId = null, meta = id => ({ ...metaFor(id), ...secretsOf(id) }) } = {}) {
    if (!repairId) return "there is no repair to take back";
    if (!targetId) return "no frozen project was named";
    if (meta(targetId)?.frozenBy !== repairId) return "that repair is not what froze the project";
    if (meta(repairId)?.repairs !== targetId) return "that repair does not repair the project";
    const saboteur = meta(repairId)?.saboteur ?? null;
    if (senderId && saboteur && saboteur !== senderId) return "the sender did not ask for that sabotage";
    return null;
}

/**
 * Take a sabotage back: thaw the target and delete the repair it spawned.
 *
 * Used by the Reroll Hope Call, which has to undo the action before applying
 * what the new dice are worth. Both writes are world settings, and the Reroll
 * is made on the GM (E08+E28 C4a); a player's request is refused since C8
 * (`undoIsTheGms`). Only the pair the sabotage wrote is taken back - see
 * `unsabotageRefusal`.
 *
 * @param {string|null} targetId  The project that was frozen.
 * @param {string|null} repairId  The repair project that was created.
 * @param {object} [options]
 * @param {string|null} [options.actorId]  The character whose Reroll this is.
 * @param {string|null} [options.senderId] Set by the bridge for a player.
 */
export async function undoSabotage(targetId = null, repairId = null, { actorId = null, senderId = null } = {}) {
    if (!targetId && !repairId) return null;

    if (!game.user.isGM) {
        const { requestUndoSabotage } = await import("./gm-bridge.mjs");
        const res = await requestUndoSabotage(targetId, repairId, actorId);
        return res.ok ? { pending: true } : null;
    }

    const why = unsabotageRefusal({ targetId, repairId, senderId });
    if (why) {
        log(`Sabotage not undone ("${targetId}", repair "${repairId}"): ${why}.`);
        return null;
    }

    /* ONE CHANGE (E36 C3, 25.10.2026; audit S17-18): the repair's removal thaws what it froze in the same step
       (`removeInStep`), so no moment holds a thawed project beside its repair, or a repair gone and its project
       frozen. The thaw was written first and outside the queue: it landed while a change of the project waited
       there (E36-T5 at 042f3482). A Reroll's undo is by "reroll", a GM's by "gm". */
    const undone = await applyProjectChange(repairId, { remove: true },
        { by: { kind: actorId ? "reroll" : "gm", userId: senderId ?? game.user.id, actorId } });
    if (!undone?.removed) return null;

    log(`Sabotage undone: "${targetId}" thawed, repair "${repairId}" removed.`);
    return true;
}

/**
 * An ordinary project filled its bar, and until E10 that happened in silence.
 *
 * WHAT THIS IS NOT, and both exclusions are the point rather than laziness:
 *
 *   a repair    its completion row ("repairs", `COMPLETION_EFFECTS`) tells it - veiled, to whoever
 *               can see it, when it is secret - and then DELETES the countdown.
 *               A second card about a project that no longer exists is noise,
 *               and it would arrive after the thing it names is gone.
 *   a trap      `announceTrapReady` runs on the same crossing and is strictly
 *               better - it carries the button that fires the thing. Two cards
 *               for one moment, one of which is worse, is not a notification.
 *
 * WHISPERED, NEVER ANNOUNCED. A project can be secret - that is most of what
 * projects are for in this game - and `announce` would tell the table that
 * somebody just finished building something. The audience is the person whose
 * idea it was, plus the GMs, and `whisperToOwner` is exactly that pair.
 *
 * WHO GETS IT, in order: the actor who proposed it, else whoever pushed it over
 * the line. The founder comes first deliberately - a project is usually worked
 * on by several people, and "your idea is finished" belongs to the person who
 * has been carrying it, not to whoever happened to spend the last action.
 */
async function announceProjectDone(name, target, moverUserId, meta) {
    // `meta` is the snapshot the step took before anything in it could delete
    // the row (`changeStep`). Reading it fresh here would answer about a repair
    // that has already been deleted.
    if (meta.repairs) return null;
    if (meta.indirectMurder) return null;

    const founder = game.actors.get(meta.by ?? "");
    const body = `<h3>${game.i18n.localize("DRPG.Project.doneTitle")}</h3>
        <p>${game.i18n.format("DRPG.Project.doneBody", {
            name: foundry.utils.escapeHTML(name), target
        })}</p>`;
    const flags = { [MODULE_ID]: { sfx: "projectDone" } };

    if (founder) {
        await whisperToOwner(founder, body, { flags });
        log(`Project "${name}" is finished; told ${founder.name} and the GMs.`);
        return { told: founder.id };
    }

    /*
     * No founder recorded - an older project, or one the GM invented outright.
     * The person who filled the bar is the next best answer, and they are a
     * USER here rather than an actor, so the whisper is addressed by hand.
     *
     * A GM who finished it themselves would be told twice by a naive list, and
     * `postToThread` refuses a GM outright (trap 73) - so the GM ids and the
     * mover are merged through a Set and the messenger is not involved at all.
     */
    const ids = Array.from(new Set([...gmIds(), moverUserId].filter(Boolean)));
    await announce({ content: body, whisper: ids, flags });
    log(`Project "${name}" is finished; no founder recorded, told whoever filled it.`);
    return { told: moverUserId };
}

/**
 * A trap has finished building. Say so, and offer to fire it.
 *
 * A repair that completes thaws what it was repairing; a MURDER project that
 * completed did nothing at all - the bar filled, the trap was armed, and the
 * only thing that changed was a number on a widget somebody might be looking
 * at. The GM had to notice.
 *
 * Posted into the killer's own thread rather than whispered to the GMs alone,
 * because that is where the rest of this player's murder already lives and
 * because "your trap is ready" is news they are entitled to. The buttons on it
 * are GM-only and are stripped from a player's copy - see `wireCallActions`.
 *
 * The condition travels with it. The guide's whole definition of an indirect
 * murder is "you do not name the victim, you name a condition", and it is the
 * one thing the GM has to have in front of them when they decide the trap has
 * gone off.
 *
 * WHAT FOLLOWS THE STEP, NOT THE STEP (E36 C1). The arming is the completion row
 * "trigger"'s, in the step of `applyProjectChange` (`COMPLETION_EFFECTS`); this is
 * what is said after it, outside the queue: `watched` when the row armed a watched
 * trap, `armed` whether that arming held.
 */
async function announceTrapReady(countdownId, name, { watched = false, armed = false } = {}) {
    if (!isIndirectMurder(countdownId)) return null;

    // The room from projectMeta, the killer, the trigger and the condition from the GMs' store (E05).
    const meta = { ...metaFor(countdownId), ...secretsOf(countdownId) };
    /*
     * `meta.by` IS AN ACTOR ID, and this line used to compare it to a NAME -
     * `a.name === meta.by` - against a field that nothing in the module ever
     * wrote. So the fallback could not match even in principle: a trap whose
     * `killerId` was missing armed itself, logged a line, and told nobody.
     * E10 is what began writing `by`, which is what makes this reachable.
     */
    const killer = game.actors.get(meta.killerId ?? "")
        ?? game.actors.get(meta.by ?? "");
    if (!killer) {
        log(`Trap "${name}" is ready, but its owner could not be identified.`);
        return null;
    }

    const { callGm } = await import("./gm-bridge.mjs");
    const { TRAP_TRIGGERS } = await import("./config.mjs");
    const kind = meta.trigger?.kind ?? "manual";
    const def = TRAP_TRIGGERS[kind];

    /*
     * A WATCHED TRAP GOES QUIET INSTEAD OF ASKING (E21).
     *
     * This used to be the whole mechanism: the bar fills, the GM gets a card
     * with the killer's typed condition and a Fire button, and from then on it
     * is their memory against two sessions of play. Dawid, 28.08: a GM cannot
     * monitor one room across two sessions, nor what the players say and do in
     * it.
     *
     * So a trap that named something the module can watch for is ARMED here and
     * says nothing else until it sees it - see traps.mjs. The card that arrives
     * now is a receipt, not a question: it has no Fire button, because there is
     * nothing yet to fire at.
     *
     * `manual` keeps the old card exactly, and that is the point of it being on
     * the list: "I will watch this myself" is a choice a GM can now see they
     * made, rather than the only thing the module could do.
     */
    if (watched && def?.watch) {
        if (armed) {
            await callGm(killer, {
                title: game.i18n.localize("DRPG.Trap.armedTitle"),
                body: `<p>${game.i18n.format("DRPG.Trap.armedBody", {
                    // NOT `localize(...) || def.label`. `localize` returns the
                    // KEY on a miss, which is truthy, so the fallback is
                    // unreachable and a missing string prints as
                    // "DRPG.Trap.trigger.alone" on the GM's card.
                    trigger: esc((() => {
                        const hit = game.i18n.localize(`DRPG.Trap.trigger.${kind}`);
                        return hit && hit !== `DRPG.Trap.trigger.${kind}` ? hit : def.label;
                    })()),
                    room: esc(meta.room ?? "-")
                })}</p>${meta.condition
                    ? `<p><strong>${game.i18n.localize("DRPG.Project.trapCondition")}</strong> ${
                        esc(meta.condition)}</p>`
                    : ""}`,
                request: name,
                /*
                 * THE ONE TRIGGER THAT NEEDS SOMETHING TO EXIST FIRST. Seven of
                 * the eight watch a place; this one watches an OBJECT, and
                 * until the GM says what the object is and which room it is
                 * lying in there is nothing to watch. So the receipt carries
                 * the button rather than a sentence asking them to remember.
                 */
                actions: def.needs === "plant" ? [{
                    action: "plantTrapItem",
                    label: game.i18n.localize("DRPG.Trap.plantAction"),
                    data: { project: countdownId }
                }] : [],
                // The killer's receipt, and the killer's thread nobody else may see it in (E06 C8).
                veiled: true,
                // Nothing to rule on, so nothing awaited and no question rung (audit S09-34): the
                // plant trigger's card keeps both, since the GM has a Plant to do.
                receipt: def.needs !== "plant"
            });
            log(`Trap "${name}" is watching for "${kind}" (${killer.name}).`);
            return { armed: kind };
        }
        // Arming failed - fall through to the old card rather than leaving a
        // finished murder project that told nobody anything.
        error(`Could not arm trap "${name}"; falling back to the manual card`);
    }

    await callGm(killer, {
        title: game.i18n.localize("DRPG.Project.trapReadyTitle"),
        body: meta.condition
            ? `<strong>${game.i18n.localize("DRPG.Project.trapCondition")}</strong> ${esc(meta.condition)}`
            : `<em>${game.i18n.localize("DRPG.Project.trapNoCondition")}</em>`,
        request: name,
        actions: [{
            action: "fireTrap",
            label: game.i18n.localize("DRPG.Project.trapFire"),
            data: { killer: killer.id }
        }],
        veiled: true
    });

    log(`Trap "${name}" is ready (${killer.name}).`);
    return true;
}

/** Change a project's portrait/icon. GM only; one change of the entry (E36 C2). */
export async function setProjectImage(countdownId, img) {
    if (!game.user.isGM || !img) return null;
    return applyProjectChange(countdownId, { img }, { by: { kind: "gm" } });
}

/**
 * Edit a project in place: name, target, portrait, room, trait, murder flag.
 *
 * The manager could only ever change the three things it had columns for, so
 * a typo in a name or a scale picked wrong meant deleting the project and
 * rebuilding it - which throws the progress away with it. This keeps the
 * countdown and its id, so everything pointing at it (a repair, a Key Remnant
 * plan, a Reroll bookmark) still points at it afterwards.
 *
 * `target` is the countdown's `progress.start`. Raising it is safe; lowering it
 * below what has already been earned would leave the bar past its own end, so
 * current progress is clamped down with it.
 *
 * @param {string} countdownId
 * @param {object} patch  Any of { name, target, img, glyph, room, trait, indirectMurder }
 */
export async function updateProject(countdownId, patch = {}) {
    if (!game.user.isGM) return null;
    if (!rawCountdown(countdownId)) return null;
    const change = projectEditChange(patch);
    // One change of the entry (E36 C2): the countdown and the meta in one step, on the primary.
    if (change) await applyProjectChange(countdownId, change, { by: { kind: "gm" } });
    log(`Project ${countdownId} updated: ${Object.keys({ ...change, ...change?.meta }).filter(key => key !== "meta").join(", ")}`);
    return allProjects().find(p => p.id === countdownId) ?? null;
}

/**
 * What `updateProject` changes, as a change of the entry, writing nothing (E36 C2): the project window's Save
 * combines it with the secrecy (`combineChanges`), so an edit is one change. Null when the patch names nothing.
 *
 * `target` is the countdown's `progress.start`; the step clamps `current` with it (`changeStep`), for both
 * directions: ours count UP, so `current` is progress earned and cannot pass the new ceiling, and Daggerheart's
 * count DOWN, where `current` is what is LEFT, which cannot exceed the start either (A15).
 */
export function projectEditChange(patch = {}) {
    const change = {};
    if (patch.name !== undefined && patch.name !== null) change.name = String(patch.name);
    if (patch.img) change.img = patch.img;
    if (patch.target !== undefined && patch.target !== null) change.target = Math.max(1, Math.trunc(Number(patch.target) || 1));

    const meta = {};
    if (patch.room !== undefined) meta.room = patch.room || null;
    if (patch.trait !== undefined) meta.trait = patch.trait || null;
    // Same gate as `createProject`, and for the same reason. An explicit null
    // is a GM clearing the choice, which is the hourglass again.
    if (patch.glyph !== undefined) meta.glyph = isProjectGlyph(patch.glyph) ? patch.glyph : null;
    if (patch.indirectMurder !== undefined) meta.indirectMurder = Boolean(patch.indirectMurder);
    // The whole trigger travels as one object - see traps.mjs. Written through
    // `updateProject` as well as `setProjectMeta` so the manager window can
    // change what a trap watches for without going round the back.
    if (patch.trigger !== undefined) meta.trigger = patch.trigger;
    if (patch.condition !== undefined) meta.condition = String(patch.condition ?? "");
    if (patch.killerId !== undefined) meta.killerId = patch.killerId || null;
    if (Object.keys(meta).length) change.meta = meta;
    return Object.keys(change).length ? change : null;
}

/**
 * A GM's patch of a project's row from the console or a macro (`game.drpg.setProjectMeta`): one change of the
 * entry, `{ meta }`, made on the primary in the one queue as every other road of a project's row since E36 (E17
 * C9, 26.10.2026; audit S09-31). The API handed out projects-secrecy.mjs `setProjectMeta` itself, which writes
 * projectMeta whole, outside the queue, on whichever GM's browser runs it - two GMs' macros, or a macro and the
 * primary's step, landing together lost one. Tier 0's census of the one queue (R991, its project row) does not see
 * this road: api.mjs takes the name through projects.mjs's re-export, which the census does not follow; it was
 * found reading the API while the row was added. The secret fields still go to the GMs' store, as `changeStep`
 * hands `meta` to `setProjectMeta`. GM only; answers the project's row, both halves, as this browser
 * reads it once the change has run (another GM's copy of the setting may arrive a moment after the reply).
 */
export async function patchProjectMeta(countdownId, data) {
    if (!game.user?.isGM) return null;
    await applyProjectChange(countdownId, { meta: data ?? {} }, { by: { kind: "gm" } });
    return { ...metaFor(countdownId), ...secretsOf(countdownId) };
}

/**
 * Delete a project and its metadata. GM only; one change of the entry, `{ remove: true }` (E36 C2): the step
 * (`removeInStep`) takes the countdown, its row and its secrets, and thaws what it repaired, in one step on
 * the primary; after it, outside the queue, its tokens (found by their own flags, every copy - E11 C7's orphan
 * test), its trap's ledger (ITEM-08) and its own repair, if it was broken.
 *
 * A SABOTAGE PAIR GOES WITH EITHER HALF (F5, 17.09). The Project Manager lists "Repair: X" like any other bar,
 * and deleting it left X frozen by a project that no longer existed: gone from every player's Work on Project
 * list, out of reach of another sabotage, skipped by the trap watcher, and nothing on any GM screen could thaw
 * it. Deleting a repair thaws what it was repairing; deleting the broken project takes its repair with it,
 * because nobody should spend an action mending nothing.
 */
export async function deleteProject(countdownId) {
    if (!game.user.isGM || !countdownId) return null;
    const result = await applyProjectChange(countdownId, { remove: true }, { by: { kind: "gm" } });
    return result?.removed ? true : null;
}

/**
 * Every project at once, for the season reset.
 *
 * Not `deleteProject` in a loop: that is two settings writes per project, and
 * a season's worth of them is a visible stall on the GM's client for a result
 * that two writes give exactly.
 *
 * Everything in the countdowns setting goes, not only the ids this module has
 * metadata for. That is not overreach -- `allProjects()` reads every countdown
 * as a project and the reset dialog counts them the same way, so a countdown
 * the module has never written to is still a project as far as this game is
 * concerned. Anything else would leave the GM a bar the module refuses to
 * explain.
 */
export async function clearAllProjects() {
    if (!game.user.isGM) return null;
    /* THE PRIMARY'S ALONE (E36 fix e1-G3, 25.10.2026; findings E36-R3, F5). Another GM's reset (a console: the
       reset window asks for the primary before it writes, season-setup.mjs) queued its step on its own browser,
       which orders nothing the primary's queue does, and dropped only the secrets that browser held. Refused here
       with the window's own words, nothing cleared (E36-T8). */
    if (!isPrimaryGm()) {
        const name = game.users.get(primaryGmId())?.name ?? "?";
        ui.notifications?.warn(game.i18n.format("DRPG.GmStore.resetPrimaryOnly", { name }));
        log("The projects were not cleared: the season reset is the primary GM's.");
        return null;
    }

    /* ONE STEP OF THE QUEUE (E36 C2; E36 fix e1-G3, 25.10.2026; findings E36-END-S4, E36-R3, F5). The countdowns,
       projectMeta, every project's secrets (E05) and the traps' two stores (ITEM-08) go in one step of
       `COUNTDOWNS_KEY`, joined before anything here awaits: a change queued before the reset lands before it, one
       queued after it lands after it, whole. The secrets and the traps were cleared after the step, outside the
       queue, so a trap made by a change queued behind the reset lost its killer and its trigger to the clear that
       followed (E36-T8 at cc6a57dd). Not through `applyProjectChange` one project at a time, for the reason above;
       the setting is read in the step, so a change that landed before it is cleared with the rest. Daggerheart's
       own setting is spread back - `countdowns` is one key inside it, not all of it. */
    const gone = await serialWrite(COUNTDOWNS_KEY, async () => {
        const data = game.settings.get(DH, COUNTDOWNS);
        const count = Object.keys(data?.countdowns ?? {}).length;
        await writeAllCountdowns({ ...data, countdowns: {} });
        await game.settings.set(MODULE_ID, SETTINGS.projectMeta, {});
        await projectSecretStore.clear();
        try {
            const { pruneTrapsFor } = await import("./traps.mjs");
            await pruneTrapsFor(null);
        } catch (err) {
            error("Could not prune the season's traps", err);
        }
        return count;
    });

    /* THE TOKENS AFTER IT (E11 C7, 1.2.73; audit S06-23, S07-27; the ask A2; after the step since E36 fix e1-G3).
       This cleared the countdowns and the metadata and left every project token standing: scenario 65 counted the
       four of a played season - two projects, a duplicate, an orphan - still on their scenes after the reset at
       4aad1fd (10.10.2026). Swept before the step, a project made behind the reset kept a token the sweep never
       saw, and one made before it was cleared beside the token its change had placed (E36-T8). After the step,
       every project token whose project is not standing now goes - the base actor's copies without an id
       included - and a project made since keeps its own. */
    try {
        const { sweepProjectTokens } = await import("./projects-map.mjs");
        await sweepProjectTokens();
    } catch (err) {
        error("Could not take the season's project tokens off the maps", err);
    }

    log(`Season reset: cleared ${gone} project(s).`);
    return gone;
}

/**
 * A SECRET PROJECT'S REPAIR AS 1.2.65 MAKES IT (E06 fix r2-G1, 28.09.2026; review round 2's
 * mn5 = m4) - the `sealOldRepairs` clause. Since E06 C10 `sabotageProject` seals a secret
 * project's repair to its insiders and names it "Repair" alone; a repair 1.2.64 made of one
 * is public, named "Repair: <the secret project>" in the countdowns every browser holds and
 * on every player's tray. Once, on the primary, after the project secrets' store has the
 * other GMs' copies - the builder, an insider, is read there (`builderIds`): each repair of
 * a project secret now that is public or named otherwise is sealed to its target's insiders
 * and renamed, as `sabotageProject` makes one; a repair of a project revealed since is left,
 * as it would be made today. Read back; one still public or named throws with the count, so
 * the world is not stamped and the next load tries again. What a browser drew or kept of the
 * old name before the rewrite is not reachable from here.
 *
 * @returns {Promise<null|{notPrimary: true}|{sealed: number}>}
 */
export async function sealOldRepairs() {
    if (!isPrimaryGm()) return { notPrimary: true };
    if (await projectSecretStore.whenHydrated() === "timedOut") {
        throw new Error("the other GMs' copies of the project secrets did not arrive; the next load tries again");
    }
    const name = game.i18n.localize("DRPG.Project.repairNameSecret");
    const open = () => allProjects().filter(project => {
        const targetId = repairs(project.id);
        return Boolean(targetId) && isSecret(targetId) && (!isSecret(project.id) || project.name !== name);
    });
    const found = open();
    if (!found.length) return null;
    for (const repair of found) {
        try {
            if (!isSecret(repair.id)) await makeSecret(repair.id, insidersOf(repairs(repair.id)));
            if (repair.name !== name) await updateProject(repair.id, { name });
        } catch (err) {
            error(`Could not seal the repair "${repair.name}"`, err);
        }
    }
    const left = open().length;
    if (left) throw new Error(`${left} of ${found.length} repair(s) of a secret project are still public or named; the next load tries again`);
    log(`Sealed ${found.length} repair(s) of a secret project made before 1.2.65.`);
    return { sealed: found.length };
}

/** Human-readable scale label for a progress target. */
export function scaleFor(target) {
    const entry = Object.values(PROJECT_SCALE).find(s => s.progress === target);
    return entry?.label ?? null;
}

/**
 * Re-apply secrecy to every project that claims to be secret.
 *
 * Runs once per session on the GM client. Projects created before the ownership
 * bug was understood carry a `default: 0` that Daggerheart ignores, so they are
 * still on show; this rewrites them properly. It only ever removes access, so
 * running it repeatedly is harmless.
 */
export async function resealSecretProjects() {
    if (!game.user.isGM) return 0;

    let fixed = 0;
    for (const project of allProjects()) {
        if (!isSecret(project.id)) continue;

        /*
         * The map its own viewers make, compared with the one it has (projects-secrecy.mjs `sightChange`, `reseal`):
         * `equals`, not `objectsEqual` - the second is deprecated in 14 and goes in 16, and it warned on every pass
         * of this loop because this function runs on load and on every `createUser`. Optional call on both names so
         * a Foundry that has one and not the other still gets an answer, and a Foundry with neither falls through to
         * writing the ownership it already has: a redundant write, never a missed re-seal. That direction is the
         * whole point of this function - a secret project visible to a player is the failure it exists to prevent.
         * Read here only to leave a sealed project unqueued; the step works it out again on what it reads (E36 fix
         * e1-G2: a share landing between the two is kept, not written over).
         */
        if (!sightChange(project.id, { reseal: true })) continue;
        if ((await applyProjectChange(project.id, { reseal: true }, { by: { kind: "system" } }))?.changed) fixed += 1;
    }

    if (fixed) log(`Re-sealed ${fixed} secret project(s) that were visible to players.`);
    return fixed;
}

/* ==========================================================================
 * WHO SEES A PROJECT, THROUGH THE ENTRY (E36 C2)
 * --------------------------------------------------------------------------
 * 25.10.2026; audit S17-18. These four wrote the countdown's ownership in
 * projects-secrecy.mjs, read and written whole outside any queue. They are a
 * change of `applyProjectChange` each now, on the primary; the arithmetic is
 * still projects-secrecy.mjs's (`secretChange`, `shareChange`, `unshareChange`,
 * `revealChange`), worked out in the step since E36 fix e1-G2 from the
 * operation the change names (`share`, `unshare`, `reveal`; `sightChange`), so
 * two shares, or a share and a revoke, asked at once both land as asked
 * (E36-T7). `makeSecret`'s map is of its own viewers and reads nothing.
 * ========================================================================== */

/**
 * Make a project secret, visible only to the given users.
 *
 * @param {string} countdownId
 * @param {string[]} viewerIds  Users allowed to see it - normally just the killer.
 */
export async function makeSecret(countdownId, viewerIds = []) {
    if (!game.user.isGM) return null;
    // A whole map, of the viewers named here alone: nothing of the countdown is read for it, so none is stale.
    const change = secretChange(countdownId, viewerIds);
    if (!await applyProjectChange(countdownId, change, { by: { kind: "gm" } })) return null;
    log(`Project ${countdownId} is now secret; ${viewerIds.length} viewer(s).`);
    return change.ownership;
}

/**
 * Let one more player in on a secret project. A player's ask goes to a GM (`project.share`), which names its sender as
 * `senderId`: a share a finder asked makes a finder (the step's note, E15 part 2 fix e1-G1).
 */
export async function shareWith(countdownId, userId, { senderId = null } = {}) {
    if (!game.user.isGM) {
        const { requestProjectShare } = await import("./gm-bridge.mjs");
        const res = await requestProjectShare(countdownId, userId);
        return res.ok ? { pending: true } : null;
    }
    const done = await applyProjectChange(countdownId, { share: userId },
        { by: senderId ? { kind: "player", userId: senderId } : { kind: "gm" } });
    if (!done || done.refused) return null;
    log(`Project ${countdownId} shared with ${game.users.get(userId)?.name ?? userId}.`);
    return true;
}

/** Take a player back off a secret project. */
export async function unshareWith(countdownId, userId) {
    if (!game.user.isGM) return null;
    if (!isSecret(countdownId)) return null;
    /* NEVER THE BUILDER (E05 C1; audit S09-09). The manager and the project window add the builder
       whatever is ticked (F3), and Revoke in the Share window took them off their own trap: the
       student who built it could no longer see it or work on it. Refused, and the GM told why. */
    if (builderIds(countdownId).includes(userId)) {
        ui.notifications?.warn(game.i18n.format("DRPG.Project.builderStays", {
            name: game.users.get(userId)?.name ?? userId, project: rawCountdown(countdownId)?.name ?? countdownId
        }));
        return null;
    }
    const done = await applyProjectChange(countdownId, { unshare: userId }, { by: { kind: "gm" } });
    return done && !done.refused ? true : null;
}

/** Drop secrecy entirely - the plan is out (`revealChange` says why the map is replaced whole; worked out in the step). */
export async function revealProject(countdownId) {
    if (!game.user.isGM) return null;
    // A refusal is no reveal (fix e1-G1: a preset that is always secret is refused in the step).
    const done = await applyProjectChange(countdownId, { reveal: true }, { by: { kind: "gm" } });
    if (!done || done.refused) return null;
    log(`Project ${countdownId} revealed to everyone.`);
    return true;
}
