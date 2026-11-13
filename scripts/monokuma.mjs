/**
 * Danganronpa RPG - telling Monokumas apart from students.
 * ---------------------------------------------------------------------------
 * The guide has the GMs walking the map as two Monokumas: "in their free time
 * they move around the map as two distinguishable, equivalent Monokuma. In this
 * form they interact with players, spend Despair to hinder their actions, or
 * help if they want to."
 *
 * A Monokuma is a `character` actor carrying a flag, not a new actor type.
 * They still want a portrait, a name and the occasional trait roll, and a
 * bespoke type would mean reimplementing the sheet and losing everything
 * Daggerheart keys off `type === "character"`.
 *
 * What the flag changes:
 *   · no action economy - the pips and free Move are greyed out
 *   · no Hope - they spend Despair instead
 *   · the action grid is replaced by Despair Calls
 *   · movement is unrestricted: no room costs, no walls, no Eclipse limit
 *   · room visibility never hides them from themselves
 */

import { MODULE_ID, FLAGS } from "./config.mjs";
import { SETTINGS, isDeadForGm } from "./settings.mjs";
// Statically imported: `poolUserFor` is synchronous and read at render time by
// the sheet and by the voice reconciler. despair.mjs does not reach back into
// this file, so there is no cycle.
import { monokumas as poolHolders } from "./despair.mjs";
import { log } from "./utils.mjs";

/** Is this actor a Monokuma rather than a student? */
export function isMonokuma(actor) {
    return Boolean(actor?.getFlag?.(MODULE_ID, FLAGS.monokuma));
}

/** Every Monokuma actor in the world. */
export function monokumaActors() {
    return game.actors.filter(a => a.type === "character" && isMonokuma(a));
}

/**
 * Not in the class (E24 C3a; config.mjs `FLAGS.notInClass`): an NPC the GMs play, which no ballot, Level Up or
 * incident's cast takes as a student.
 */
export function isNotInClass(actor) {
    return Boolean(actor?.getFlag?.(MODULE_ID, FLAGS.notInClass));
}

/**
 * A Spectator (E92 C1; config.mjs `FLAGS.spectator`): a player who watches, no student. Read as `isNotInClass` is - on
 * the actor handed, which a GM's road hands as the GMs hold it (`studentActors`'s `held`).
 */
export function isSpectator(actor) {
    return Boolean(actor?.getFlag?.(MODULE_ID, FLAGS.spectator));
}

/**
 * Every student - a character that is neither a Monokuma nor marked not in the class.
 *
 * THE NPC LEAVES WITH THE MONOKUMA (E24 C3a, 08.11.2026; audit S03-36, E24-19). Every `character` was a student, so an
 * NPC the GMs keep on a sheet - a teacher, a shopkeeper - was handed a ballot, named on the verdict's list, offered a
 * Level Up after a right verdict and put in the murder window as its default victim. The one roster is read by 71
 * calls in 19 files (`studentCensus`, `actingStudents`, the vote's candidates, its size and `trialParticipants`, the
 * verdict's survivors, the murder window's cast through chapter.mjs `livingStudentsForGm`, assignments.mjs, the GM
 * panel), so the flag is read here once and every one of them leaves the NPC out (R1453).
 *
 * AS THE GMS HOLD THE TWO FLAGS, ON THE GMS' ROADS (E24 fix G1, 09.11.2026; the end review's S-1). Both flags are a GM's
 * (sheet-audit.mjs `GM_FLAGS`), and the document is what the student's owner can write: a console that set
 * `notInClass` (or `monokuma`) on its own student took it off the list the primary built in the window before the
 * audit's put-back landed - off the vote's judged ids, so the step did not wait for that student's write, then off
 * every ballot it sent, and off the trial's muted dead. `held` is the reader a GM's road hands in (sheet-audit.mjs
 * `flagsHeldNow`, after `judgedFor` of every character, `characterIds`): each character is asked through it, and
 * the mark's flags answer where the primary holds one. Without it the document answers, as every display reads it.
 * The roads: vote.mjs `studentsJudged`, `candidatesFor`, `trialParticipants`, voice.mjs `deadForTrial` and its
 * settle, and bridge-guards.mjs `guardArmOtherCharacter` for a Call (R1494).
 */
export function studentActors({ held = null } = {}) {
    return game.actors.filter(a => {
        if (a.type !== "character") return false;
        const flags = held ? held(a) : a;
        // A Spectator leaves with the NPC (E92 C1): no student, so every reader of the one roster leaves it out.
        return !isMonokuma(flags) && !isNotInClass(flags) && !isSpectator(flags);
    });
}

/**
 * Every character's id (E24 fix G1): the ids a GM's road waits on (sheet-audit.mjs `judgedFor`) before it reads the
 * students as held - every character, not `studentActors()`'s, which a forged flag on the document still shortens.
 */
export function characterIds() {
    return game.actors.filter(a => a.type === "character").map(a => a.id);
}

/**
 * THE ONE COUNT OF STUDENTS (E20 C1, S07-38; the owner's Q-3, 29.10.2026: students = the living).
 * The Doors tab counted the living (`isDeceased`), the season checklist every student, dead
 * included, so one world read "3 living students" in one window and "Players: 4" in the other.
 * `all` is every student; `living` those not dead as the GMs know it (`isDeadForGm`: a death the
 * GMs keep counts, since only a GM's window asks); `count` is how many are living, the number every
 * rooms-per-student line divides by. `actors` is the suite's to hand (R1500); otherwise the world's.
 */
export function studentCensus(actors = studentActors()) {
    const all = [...actors].filter(a => !isMonokuma(a) && !isNotInClass(a) && !isSpectator(a));
    const living = all.filter(a => !isDeadForGm(a));
    return { all, living, count: living.length };
}

/**
 * The students who still spend a budget: the living, and the dead back as a Monocub. A Monokuma is never one
 * (`studentActors`). The one roster the panel's "Next" line, its table and the status strip used to spell five ways
 * (audit, hygiene), and, since E37 C2 (S10-45, E37-08; tier 0 R1192, tier 1 R1193), the one the GM's strip, the
 * Eclipse's placement and its whispers (eclipse.mjs) and the trial's ballots and size (vote.mjs) read too, where four
 * definitions stood: player-status.mjs `trackedStudents` (the living without the Monocubs), eclipse.mjs `placingActors`
 * and the trial's two walks of `studentActors()`.
 *
 * `dead` is the death the caller asks, the GMs' by default (`isDeadForGm`: the flag, or a death this browser holds); a
 * card sent to each owner is a document and asks the table's fact (`isDeceased`, rule A), and the trial hands its own
 * rule, which it filters again with the Monocub flag as the GMs hold it. `held` is `studentActors`'s (E24 fix G1).
 */
export function actingStudents({ dead = isDeadForGm, held = null } = {}) {
    return studentActors({ held }).filter(a =>
        !dead(a) || a.getFlag(MODULE_ID, FLAGS.monocub));
}

/**
 * The one student this account plays, or null: the assigned character when
 * it is a student, nothing when the assigned character is a Monokuma (a
 * Monokuma account has no student view), else the single owned student.
 * Written twice before (hud.mjs and player-status.mjs), identically.
 */
export function ownStudent() {
    const assigned = game.user.character;
    // A Spectator's account has no student view either (E92 C1): its own view is a watcher's (`ownSpectator`).
    if (assigned && !isMonokuma(assigned) && !isSpectator(assigned)) return assigned;
    if (assigned) return null;
    const owned = game.actors.filter(a => a.type === "character" && a.isOwner && !isMonokuma(a) && !isSpectator(a));
    return owned.length === 1 ? owned[0] : null;
}

/** The students this account owns: characters, no Monokuma and no Spectator (a GM owns every one of them). */
export function ownedStudents() {
    return game.actors.filter(a => a.type === "character" && a.isOwner && !isMonokuma(a) && !isSpectator(a));
}

/**
 * The Spectator this account plays, or null (E92 C1): its assigned character when that is one, else the one Spectator
 * it owns while it owns no student. A GM, who owns every actor, plays none.
 */
export function ownSpectator(user = game.user, actors = game.actors) {
    if (!user || user.isGM) return null;
    const assigned = user.character ?? null;
    if (assigned) return isSpectator(assigned) ? assigned : null;
    const mine = [...(actors ?? [])].filter(a => a?.type === "character" && a.testUserPermission?.(user, "OWNER"));
    const watching = mine.filter(isSpectator);
    return watching.length === 1 && watching.length === mine.filter(a => !isMonokuma(a)).length ? watching[0] : null;
}

/**
 * THE ONE VIEWER OF SEVERAL (E51 C4, 31.10.2026; E51-25, audit S10-49, the A8 design; the owner's Q2 on its default).
 * `ownStudent` answers nobody for a player with two characters and none assigned, so the clock's room, the room tile
 * and the 'Where are we' window had no character for them. This chooses one, and the same one each time it is asked
 * the same thing: the assigned character (nobody for an assigned Monokuma, as `ownStudent`), else the only owned
 * student, else of several the first `controlled` token's actor that is one of them - a token of somebody else's
 * character is not this viewer's - else the first by name. Pure: `list` is the account's actors (only its students
 * count), `controlled` the actors of the tokens it controls; hud.mjs `viewerActor` hands it the account's. Exported
 * for the suite (R1117).
 *
 * @param {Actor[]} list  the actors this account owns
 * @param {{ assigned?: Actor|null, controlled?: Actor[] }} [options]
 * @returns {Actor|null}
 */
export function chooseOwnStudent(list = [], { assigned = null, controlled = [] } = {}) {
    if (assigned) return isMonokuma(assigned) || isSpectator(assigned) ? null : assigned;
    const owned = [...list].filter(a => a?.type === "character" && !isMonokuma(a) && !isSpectator(a));
    if (owned.length <= 1) return owned[0] ?? null;
    const held = [...controlled].find(a => a && owned.some(o => o.id === a.id));
    if (held) return owned.find(o => o.id === held.id);
    return [...owned].sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")) || String(a.id).localeCompare(String(b.id)))[0];
}

/**
 * Whether the clock's explain window should say to assign a character (E51 C4; `DRPG.Hud.assignHint`): several owned
 * students and none assigned, so which one the screens are about is `chooseOwnStudent`'s guess. A GM is never asked.
 * Pure when both are handed (R1117).
 */
export function viewerNeedsAssigning(list = ownedStudents(), assigned = game.user?.character ?? null) {
    if (assigned) return false;
    return [...list].filter(a => a?.type === "character" && !isMonokuma(a) && !isSpectator(a)).length > 1;
}

/**
 * Mark or unmark an actor as a Monokuma. GM only.
 *
 * Marking one also clears their action budget and Hope: those are student
 * resources, and leaving stale values on the sheet invites someone to spend
 * them.
 */
export async function setMonokuma(actor, value = true) {
    if (!game.user.isGM || !actor) return null;

    await actor.setFlag(MODULE_ID, FLAGS.monokuma, Boolean(value));

    if (value) {
        const { trustedWrite } = await import("./resource-guard.mjs");
        const { ACTIONS_RESOURCE } = await import("./config.mjs");
        await trustedWrite(actor, {
            [`system.resources.${ACTIONS_RESOURCE}.value`]: 0,
            "system.resources.hope.value": 0
        }, { reason: "setup" }).catch(() => {});
    }

    log(`${actor.name} is ${value ? "now" : "no longer"} a Monokuma.`);
    ui.notifications.info(game.i18n.format(
        value ? "DRPG.Monokuma.marked" : "DRPG.Monokuma.unmarked",
        { name: actor.name }
    ));

    actor.sheet?.render(false);
    return actor;
}

/**
 * Mark or unmark an actor as not in the class (E24 C3a; `FLAGS.notInClass`). GM only: the GM's own write, as
 * `setMonokuma`'s flag is - the flag holds no resource, so no reason of resource-guard.mjs's list names it, and a
 * player's write of it is put back by the GMs' audit. Nothing is cleared or given back: an NPC keeps its sheet as it
 * stands, and unmarked it is a student again with what it holds.
 */
export async function setNotInClass(actor, value = true) {
    if (!game.user.isGM || !actor) return null;
    if (value) await actor.setFlag(MODULE_ID, FLAGS.notInClass, true);
    else await actor.unsetFlag(MODULE_ID, FLAGS.notInClass);
    log(`${actor.name} is ${value ? "now" : "no longer"} not in the class.`);
    ui.notifications.info(game.i18n.format(value ? "DRPG.Class.markedOut" : "DRPG.Class.markedIn", { name: actor.name }));
    actor.sheet?.render(false);
    return actor;
}

/**
 * Mark or unmark an actor as a Spectator (E92 C1; `FLAGS.spectator`). GM only, as `setNotInClass`: the flag holds no
 * resource, and a player's write of it is put back by the GMs' audit. Nothing on the sheet is cleared: a Spectator made
 * a student again has what it held. The primary GM holds its account's microphone from the flag (voice.mjs, E92 C2).
 */
export async function setSpectator(actor, value = true) {
    if (!game.user.isGM || !actor) return null;
    // A dead student's Spectator stays one (E62 C3b fix): read late, spectator-dead.mjs reaches gm-stores.mjs.
    if (!value && (await import("./spectator-dead.mjs")).isDeadWatcher(actor)) return null;
    // The class's map leaves a Spectator made a student again (E92 C4): its own rows stay, the fold's are unticked first.
    if (!value && isSpectator(actor)) await (await import("./fog.mjs")).forgetSpectatorMap(actor);
    const { spectatorUserIds } = await import("./spectator.mjs");
    const before = spectatorUserIds();
    if (value) await actor.setFlag(MODULE_ID, FLAGS.spectator, true);
    else await actor.unsetFlag(MODULE_ID, FLAGS.spectator);
    log(`${actor.name} is ${value ? "now" : "no longer"} a Spectator.`);
    // Every project in a Spectator's sight, and out of it again (E92 DRPG-D1; projects.mjs `seeAsSpectators`).
    const now = spectatorUserIds();
    await (await import("./projects.mjs")).seeAsSpectators([...before].filter(id => !now.has(id)));
    ui.notifications.info(game.i18n.format(value ? "DRPG.Spectator.marked" : "DRPG.Spectator.unmarked", { name: actor.name }));
    actor.sheet?.render(false);
    return actor;
}

/**
 * The characters Pre-season's checks name as NPCs to mark (E24 C3a; the owner's Q-E24-5: "the characters no player
 * owns as candidates"): students - not a Monokuma, not already out of the class - that no user who is no GM owns.
 * Nothing is marked by itself; the GM decides on each sheet. `actors` and `users` are the suite's to hand (R1453).
 */
export function classCandidates({ actors = game.actors, users = game.users } = {}) {
    return [...actors].filter(a => a?.type === "character" && !isMonokuma(a) && !isNotInClass(a) && !isSpectator(a)
        && ![...users].some(u => !u.isGM && a.testUserPermission?.(u, "OWNER")));
}

/* ==========================================================================
 * WHOSE POOL
 * --------------------------------------------------------------------------
 * Stated, not guessed. The map is world state - `{ [actorId]: userId }` - so
 * every client agrees on which Monokuma spends whose Despair, and the Despair
 * Calls panel on each sheet shows that Monokuma's pool rather than the pool of
 * whoever happens to be looking at it.
 *
 * Guessing was the bug: the old version derived the link from ownership, and
 * `testUserPermission(gm, "OWNER")` is true for every GM on every actor. With
 * two Gamemasters the answer collapsed to "the viewer", so Monokuma and Monomi
 * shared one pool and a change to the other GM's Despair appeared nowhere.
 * ========================================================================== */

/** Raw map: { [actorId]: gmUserId }. */
export function pools() {
    try {
        return game.settings.get(MODULE_ID, SETTINGS.monokumaPools) ?? {};
    } catch {
        return {};
    }
}

/** The user id configured for this Monokuma actor, or null. */
export function poolFor(actor) {
    return pools()[actor?.id] ?? null;
}

/** Write the whole map at once - used by the Monokuma panel. GM only. */
export async function setPools(map) {
    if (!game.user.isGM) return null;
    await game.settings.set(MODULE_ID, SETTINGS.monokumaPools, { ...map });
    log(`Monokuma pools set for ${Object.keys(map).length} actor(s).`);
    return map;
}

/** Point one Monokuma at one Gamemaster's pool. GM only. */
export async function setPoolFor(actor, userId) {
    if (!game.user.isGM || !actor) return null;
    const map = { ...pools() };
    if (userId) map[actor.id] = userId;
    else delete map[actor.id];
    return setPools(map);
}

/**
 * Which Despair pool this Monokuma actor draws on.
 *
 * The configured answer wins. Everything below it is a fallback for a world
 * that has not opened the Monokuma panel yet, and none of it is trusted once
 * an answer exists.
 */
export function poolUserFor(actor, world = {}) {
    if (!actor) return null;
    const owner = poolOwnerOf(actor, world);
    if (owner) return owner;

    const { holders, gamemasters, me } = poolWorld(world || {});
    const gms = holders.length ? holders : gamemasters;
    if (!gms.length) return me?.isGM ? me : null;

    // Genuinely ambiguous. The acting GM spends their own, and the panel exists
    // to stop the table ever being in this state.
    const OWNER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
    const ownership = actor.ownership ?? {};
    const declared = gms.filter(u => ownership[u.id] === OWNER);
    return declared.find(u => u.id === me?.id)
        ?? gms.find(u => u.id === me?.id)
        ?? gms[0];
}

/**
 * What `poolOwnerOf` and `poolUserFor` read of the world, each stood in where `world` names it (E60 fix FG4: R1302's
 * fixtures; the end review's C-m6): the pool holders (despair.mjs `poolHolders`), the full Gamemasters, the user asking
 * and the configured pool's user id of an actor.
 */
function poolWorld({ holders = poolHolders(), gamemasters = game.users.filter(u => u.role === CONST.USER_ROLES.GAMEMASTER),
    me = game.user, configured = actor => poolFor(actor), user = id => game.users.get(id ?? "") } = {}) {
    return { holders, gamemasters, me, configured, user };
}

/**
 * The Gamemaster whose Monokuma this is, where it can be told whoever asks (E60 C5e): `poolUserFor`'s configured pool,
 * the one pool holder (or the one full Gamemaster), or the one with an explicit OWNER entry on the actor - and null
 * where `poolUserFor` falls back to the acting GM (several, nothing configured, no owner named) or there is no GM at
 * all. The Monokuma whose GM cannot be told admits no GM to a player's dice (Q-C5-4's default; private-rolls.mjs
 * `gmsInRoomOf`).
 */
export function poolOwnerOf(actor, world = {}) {
    if (!actor) return null;

    // "Has a pool" is despair.mjs's question, not a role test. An Assistant GM
    // explicitly granted one (`addPool`) is offered as a pool in the GM team
    // panel and counted by `monokumasWithoutPool`, so refusing them here meant
    // a Monokuma pointed at that pool silently spent somebody else's Despair.
    const { holders, gamemasters, configured: poolOf, user } = poolWorld(world || {});
    const configured = user(poolOf(actor) ?? "");
    if (configured && holders.some(u => u.id === configured.id)) return configured;

    const gms = holders.length ? holders : gamemasters;
    if (!gms.length) return null;

    // One Gamemaster, one pool - nothing to disambiguate.
    if (gms.length === 1) return gms[0];

    // More than one and nothing configured: an explicit OWNER entry on the actor
    // is the only remaining signal that means anything, since GMs bypass the
    // ownership test itself.
    const OWNER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
    const ownership = actor.ownership ?? {};
    const declared = gms.filter(u => ownership[u.id] === OWNER);
    if (declared.length === 1) return declared[0];
    return null;
}

/**
 * Every Monokuma actor that has no pool configured. For the GM's attention.
 *
 * Measured against the same roster `poolUserFor` accepts - "is a GM" was a
 * looser test than the one that actually decides whose Despair is spent, so an
 * actor could read as configured here and still be ignored there.
 */
export function monokumasWithoutPool() {
    const map = pools();
    const holders = new Set(poolHolders().map(u => u.id));
    return monokumaActors().filter(a => !holders.has(map[a.id] ?? ""));
}

/*
 * MARK AND UNMARK, BY STATE, AND ASKED FOR A PLAYER'S CHARACTER (E22 C3b, 06.11.2026; audit S03-34). One entry, "Mark as
 * Monokuma", marked and unmarked alike, with no question: a mis-click on a player's character set their Hope and actions
 * to 0, and unmarking gives nothing back. Two entries now, each shown in the state it changes, and marking a character a
 * player owns asks first, the yes destructive with Cancel the default (E22 rule 4). Unmarking still gives back nothing
 * (a rules change, not E22's) and is not asked.
 *
 * ON THE SHEET, NOT IN THE ACTORS DIRECTORY (E24 C3a, 08.11.2026; the owner's answer to Q-E24-5, STAGE.md "Amend 08.11"
 * A2: "warto mark as monokuma tez przeniesc"). The two entries sat on the directory's right-click menu
 * (`getActorContextOptions`, registered by `registerMonokuma`, which is gone with them); they are the sheet header's GM
 * controls now, beside "Not in the class" (sheet.mjs `injectClassControls`), each drawn in the state it changes, for a
 * `character` and a GM only. The ask moved with them unchanged, under the name of the place it is asked from.
 */

/** Whether a user who is no GM owns `actor`: a player's character, whose Hope and actions a mark would take. */
function playedByAPlayer(actor) {
    return game.users.some(u => !u.isGM && actor?.testUserPermission?.(u, "OWNER"));
}

/** Mark `actor` as a Monokuma from its sheet: asked first when a player owns it. */
export async function markFromSheet(actor) {
    if (playedByAPlayer(actor)) {
        const { drpgConfirm } = await import("./ui-kit.mjs");
        const name = foundry.utils.escapeHTML(actor.name);
        const sure = await drpgConfirm({
            classes: ["drpg-panel"],
            title: game.i18n.localize("DRPG.Monokuma.toggle"),
            body: `<p>${game.i18n.format("DRPG.Monokuma.markAsk", { name })}</p>`,
            yes: { role: "destructive", label: game.i18n.localize("DRPG.Monokuma.toggle") },
            no: "cancel",
            rejectClose: false
        });
        if (!sure) return null;
    }
    return setMonokuma(actor, true);
}
