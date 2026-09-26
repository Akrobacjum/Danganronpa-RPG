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
 */

import { MODULE_ID, PROJECT_SCALE, isProjectGlyph } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { announce, log, warn, error, whisperToOwner, gmIds, esc, ownerIdsOf, isPrimaryGm } from "./utils.mjs";
// Statically: gm-stores.mjs reaches this file only by dynamic import, so the edge closes no cycle (R161).
import { projectSecretStore } from "./gm-stores.mjs";

/* `discoveredFor` is the per-character record of which rooms somebody has
   actually stood in - the public half of `knowsProject` below. Imported at the
   top and not dynamically: the import graph was checked in both directions
   (16.09) and fog.mjs does not reach this file, so there is no cycle to dodge. */
import { discoveredFor } from "./fog.mjs";

const DH = "daggerheart";
const COUNTDOWNS = "Countdowns";

/** Raw per-project metadata: { [countdownId]: { room, indirectMurder, scale, glyph } }. */
export function projectMeta() {
    return game.settings.get(MODULE_ID, SETTINGS.projectMeta) ?? {};
}

/** Metadata for one project. */
export function metaFor(countdownId) {
    return projectMeta()[countdownId] ?? {};
}

/**
 * THE FOUR FIELDS THAT NAME A MURDER'S KILLER, ON THE GMS' SIDE (E05 C1, 26.09.2026; audit S09-05, D3).
 * `killerId`, `by`, `condition` and `trigger` were projectMeta's until 1.2.64, and projectMeta is a world
 * setting every browser holds: any console read an indirect murder's killer, its builder and its
 * condition before the crime (72-canary measured the killer's actor id at `projectMeta.<id>.killerId` on
 * both bystanders' browsers). They are the GM store `projectSecrets` now (gm-stores.mjs); projectMeta
 * keeps the room, the two flags, the trait, the glyph, the token and the sabotage pair.
 */
export const PROJECT_SECRET_FIELDS = Object.freeze(["killerId", "by", "condition", "trigger"]);

/**
 * The four fields of one project: the store's row on a GM, `{}` on anybody else. A player's browser
 * holds no GM store, and nothing that runs there needs the four: the tray, the pickers and the token
 * read projectMeta and the countdown, and every reader of the four runs on a GM (the trap's arming
 * and its alert, the finished project's card, the manager and the murder window).
 */
export function secretsOf(countdownId) {
    if (!game.user?.isGM) return {};
    return projectSecretStore.get(countdownId) ?? {};
}

/**
 * Patch parts of a trap's trigger on the GMs' side, and nothing else of it: `armed`, `firedAt`,
 * `condition`, each stamped on its own (the store splits `trigger`), so the primary stamping a trap
 * fired and another GM re-arming it both keep theirs. traps.mjs's three writers come here; a GM
 * setting the whole trigger goes through `setProjectMeta`. GM only; answers the trigger now held.
 */
export async function patchTrigger(countdownId, parts) {
    if (!game.user?.isGM) return null;
    await projectSecretStore.patch(countdownId, { trigger: parts });
    return secretsOf(countdownId).trigger ?? null;
}

/** Which room a project belongs to, if any. */
export function roomOf(countdownId) {
    return metaFor(countdownId).room ?? null;
}

/** Is this project an indirect murder? */
export function isIndirectMurder(countdownId) {
    return Boolean(metaFor(countdownId).indirectMurder);
}

/** Where this project's token stands, if it has one: `{ sceneId, tokenId }`. */
export function tokenRefOf(countdownId) {
    const meta = metaFor(countdownId);
    return meta.tokenId && meta.tokenScene
        ? { sceneId: meta.tokenScene, tokenId: meta.tokenId }
        : null;
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
    if (!canSee(countdownId, user)) return false;
    // In on a secret one: you are one of the people who made it.
    if (isSecret(countdownId)) return true;

    const room = roomOf(countdownId);
    if (!room) return true;

    /* Any character this person holds having been there is enough. A player
       running two students knows what either of them has seen - the same rule
       `incidentWitness` uses for the incident's seats. */
    const sceneId = canvas?.scene?.id ?? null;
    if (!sceneId) return false;
    try {
        for (const actor of game.actors ?? []) {
            if (actor.type !== "character") continue;
            if (!actor.testUserPermission(user, "OWNER")) continue;
            if (discoveredFor(sceneId, actor.id).includes(room)) return true;
        }
    } catch {
        // A world mid-migration, or a scene with no discovery recorded yet.
        // Answering "no" hides the token, which is the safe direction to fail.
    }
    return false;
}

/**
 * Write metadata for a project. GM only.
 *
 * TWO HALVES SINCE E05 (C1; audit S09-05). The four fields of `PROJECT_SECRET_FIELDS` that `data`
 * names go to the GM store, stamped as a GM's decision - `trigger` whole, because a caller here
 * states all of it (a trap's own three parts are `patchTrigger`'s); everything else is merged into
 * projectMeta, as before. Answers the project's row, both halves.
 */
export async function setProjectMeta(countdownId, data) {
    if (!game.user.isGM) return null;
    const secret = {}, open = {};
    for (const [field, value] of Object.entries(data ?? {})) (PROJECT_SECRET_FIELDS.includes(field) ? secret : open)[field] = value;
    if (Object.keys(secret).length) await projectSecretStore.patch(countdownId, secret, { whole: true });
    if (Object.keys(open).length) {
        const all = { ...projectMeta(), [countdownId]: { ...metaFor(countdownId), ...open } };
        await game.settings.set(MODULE_ID, SETTINGS.projectMeta, all);
    }
    return { ...metaFor(countdownId), ...secretsOf(countdownId) };
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

/**
 * May this user know that this project exists at all?
 *
 * GMs see everything. A project that is not secret is public. A secret one is
 * visible only to the people it was shared with - the killer, and whoever they
 * brought in.
 *
 * Every list a player is ever shown has to go through this. `allProjects()`
 * reads the raw world setting and knows nothing about secrecy, so any picker
 * built straight on it was handing the table a list of everyone's plans,
 * indirect murders included.
 */
export function canSee(countdownId, user = game.user) {
    if (user?.isGM) return true;
    if (!isSecret(countdownId)) return true;
    return viewersOf(countdownId).some(u => u.id === user?.id);
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
 */
export function secretsUnknownIn(room, user) {
    if (!room || !user || user.isGM) return [];
    return allProjects()
        .filter(p => p.room === room)
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
 * ones included.
 *
 * The picker's list, and the reason it is not `projectsAvailableIn`: a finished
 * project has to be visible and struck through rather than quietly absent.
 * Absent, it looks like the project was cleared away, and the obvious next move
 * is to ask a GM what happened to it.
 */
export function projectsListedIn(room, user = game.user) {
    return visibleProjects(user)
        .filter(p => !p.room || (room && p.room === room))
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
export function projectsAvailableIn(room, user = game.user) {
    return projectsListedIn(room, user).filter(p => !isComplete(p));
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
export function sabotageTargetsIn(room, { anyRoom = false, user = game.user } = {}) {
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
        .filter(p => anyRoom || (room && p.room === room))
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
export async function addProgress(countdownId, amount, { by = null, actorId = null } = {}) {
    if (!amount) return null;

    if (!game.user.isGM) {
        // The character whose action this is travels with it: progress taken
        // BACK is a Reroll's undo, and the GM pays for that from the receipt
        // for this character (reroll-receipts.mjs), not on the packet's word.
        const { requestProjectProgress } = await import("./gm-bridge.mjs");
        const res = await requestProjectProgress(countdownId, amount, actorId);
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

    const data = game.settings.get(DH, COUNTDOWNS);
    const countdowns = foundry.utils.duplicate(data?.countdowns ?? {});
    const project = countdowns[countdownId];
    if (!project) return null;

    const start = project.progress?.start ?? 0;
    const raw = project.progress?.current ?? 0;
    const up = countsUp(countdownId);

    /*
     * A SABOTAGED PROJECT DOES NOT MOVE FORWARD (E03, 24.09.2026; audit S09-02).
     * "Frozen - its progress is preserved but cannot be advanced" was the rule
     * at the top of the sabotage section below, and the only thing enforcing it
     * was the pickers on a player's screen: this function took any amount for
     * any project, so a Call aimed from an old dialog, a Reroll that landed after
     * the freeze, or a console, all advanced it. Every caller comes through here,
     * the GM's own included, so it is enforced here. Taking progress away still
     * works - an undo or an Earthquake is not advancing it.
     */
    if (amount > 0 && isFrozen(countdownId)) {
        const current = up ? raw : Math.max(0, start - raw);
        log(`Project "${project.name}" did not move: it is frozen by sabotage.`);
        ui.notifications.warn(game.i18n.format("DRPG.Project.frozenNoProgress", { name: project.name }));
        return {
            id: countdownId, name: project.name,
            from: current, to: current, target: start, changed: false, reason: "DRPG.Project.frozenNoProgress"
        };
    }

    // Translate "advance the project" into whichever direction this countdown
    // stores, then clamp inside the bar rather than outside the intent.
    const delta = up ? amount : -amount;
    const ceiling = start > 0 ? start : Infinity;
    const nextRaw = Math.max(0, Math.min(ceiling, raw + delta));

    const before = up ? raw : Math.max(0, start - raw);
    const after = up ? nextRaw : Math.max(0, start - nextRaw);

    if (nextRaw === raw) {
        // Nothing moved. Saying so is the whole point: a silent no-op here is
        // indistinguishable from a broken socket, and was misread as one.
        const why = amount > 0 ? "DRPG.Project.alreadyFull" : "DRPG.Project.alreadyEmpty";
        log(`Project "${project.name}" did not move: already ${before}/${start}.`);
        ui.notifications.warn(game.i18n.format(why, { name: project.name, current: before, target: start }));
        return {
            id: countdownId, name: project.name,
            from: before, to: after, target: start, changed: false, reason: why
        };
    }

    countdowns[countdownId] = {
        ...project,
        progress: { ...project.progress, current: nextRaw }
    };

    await game.settings.set(DH, COUNTDOWNS, { ...data, countdowns });
    log(`Project "${project.name}": ${before} -> ${after} of ${start}`);

    /*
     * CROSSED, IN THIS CALL. `before < start && after >= start` is not a
     * roundabout way of writing `after >= start`, and must not be simplified
     * into one: a Reroll takes progress back and puts it on again, and a bar
     * that was already full would otherwise announce itself a second time.
     */
    const finished = before < start && after >= start;

    /*
     * READ THE METADATA BEFORE ANYTHING CAN DELETE IT.
     *
     * `checkRepairCompletion` does not merely thaw the project it was repairing
     * - it DELETES the repair countdown, and `deleteProject` takes the metadata
     * with it. So a guard that asks "was this a repair?" after that call is
     * asking about a record that no longer exists, and every repair answers
     * "no". Measured: the exclusion did nothing until this line moved up.
     *
     * Snapshotted rather than re-read for the same reason `announceProjectDone`
     * is handed the object: `meta.by` would vanish on exactly the same call.
     * Both halves: `by` is the GMs' store's since E05, and this runs on a GM.
     */
    const metaBefore = { ...metaFor(countdownId), ...secretsOf(countdownId) };

    // Finishing a repair thaws whatever it was repairing.
    await checkRepairCompletion(countdownId);
    // Finishing a trap arms it, and somebody has to be told.
    if (finished) await announceTrapReady(countdownId, project.name);
    if (finished) await announceProjectDone(project.name, start, mover, metaBefore);

    return { id: countdownId, name: project.name, from: before, to: after, target: start, changed: true };
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

    const data = game.settings.get(DH, COUNTDOWNS);
    const countdowns = foundry.utils.duplicate(data?.countdowns ?? {});
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
    const hidden = secret || indirectMurder;

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

    countdowns[id] = {
        type: "narrative",
        name,
        img: img || "icons/magic/time/hourglass-yellow-green.webp",
        ownership: hidden ? ownershipMap(audience) : { default: OBSERVER },
        progress: {
            current: 0,
            start: target,
            looping: "noLooping",
            // Only advanced by the Work on Project action.
            type: "custom"
        }
    };

    await game.settings.set(DH, COUNTDOWNS, { ...data, countdowns });
    // `trait` is set by the GM at creation - the guide lets a project demand a
    // specific kind of work, so the player does not get to pick the easy stat.
    // `countsUp` is stamped rather than left to the default so the direction
    // stays explicit in the data, not just in this file's assumptions.
    await setProjectMeta(id, {
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
        trigger: indirectMurder && trigger?.kind ? { ...trigger, armed: false, firedAt: null } : null
    });

    log(`Created project "${name}" (${target} progress)${room ? ` in ${room}` : ""}${trait ? `, ${trait}` : ""}.`);

    /* AND ONTO THE MAP, if it has a room to stand in. Dynamic, because
       projects-map.mjs reads this file - this cycle is real, unlike the fog one
       at the top. Failure here is not failure of the project: a project with no
       token is a project the tray still runs perfectly well. */
    try {
        const { placeProjectToken } = await import("./projects-map.mjs");
        await placeProjectToken(id);
    } catch (err) {
        error(`Could not put the new project "${name}" on the map`, err);
    }

    return { id, name, target, trait };
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
export async function sabotageProject(targetId, difficulty = 3, { saboteur = null } = {}) {
    if (!game.user.isGM) {
        const { requestSabotage } = await import("./gm-bridge.mjs");
        const res = await requestSabotage(targetId, difficulty);
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
    const repair = await createProject({
        name: game.i18n.format("DRPG.Project.repairName", { name: target.name }),
        target: difficulty,
        room: roomOf(targetId),
        trait: metaFor(targetId).trait ?? null,
        indirectMurder: false,
        secret: false,
        // A repair is not the thing it repairs, and the tray is where a player
        // has to see that at a glance.
        glyph: "tamper"
    });
    if (!repair) return null;

    // Who asked, when it was a player (the bridge passes Foundry's sender): a
    // Reroll may take back its own sabotage and nobody else's.
    await setProjectMeta(repair.id, { repairs: targetId, ...(saboteur ? { saboteur } : {}) });
    await setProjectMeta(targetId, { frozenBy: repair.id });

    log(`Project "${target.name}" frozen; repair "${repair.name}" created (${difficulty} progress).`);
    return { repair, target: target.name };
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
 * Pure (the metadata is passed in) so the suite can hold it to that.
 *
 * @param {object} options
 * @param {string|null} options.targetId
 * @param {string|null} options.repairId
 * @param {string|null} [options.senderId]  A player's user id; null for a GM.
 * @param {(id: string) => object} [options.meta]
 * @returns {string|null}
 */
export function unsabotageRefusal({ targetId, repairId, senderId = null, meta = metaFor } = {}) {
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
 * what the new dice are worth. Both writes are world settings, so a player's
 * request goes through the GM exactly as the sabotage itself did. Only the
 * pair the sabotage wrote is taken back - see `unsabotageRefusal`.
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

    // Thaw first: if the delete below fails the worst case is a stray repair bar,
    // not a project left permanently unworkable.
    await setProjectMeta(targetId, { frozenBy: null });
    await deleteProject(repairId);

    log(`Sabotage undone: "${targetId}" thawed, repair "${repairId}" removed.`);
    return true;
}

/**
 * Called whenever progress lands. A finished repair unfreezes the project it was
 * repairing, and then removes itself.
 *
 * The repair is a means, not a goal: once the thing it was fixing works again
 * there is nothing left to work on, and leaving a completed 6/6 bar sitting in
 * the tray beside the project it unblocked reads as an open job. It also kept
 * the tray growing by one row per sabotage for the rest of the season.
 */
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
 */
/**
 * An ordinary project filled its bar, and until E10 that happened in silence.
 *
 * WHAT THIS IS NOT, and both exclusions are the point rather than laziness:
 *
 *   a repair    `checkRepairCompletion` already announces it publicly and then
 *               DELETES the countdown. A second card about a project that no
 *               longer exists is noise, and it would arrive after the thing it
 *               names is gone.
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
    // `meta` is the snapshot taken before `checkRepairCompletion` - see the
    // note at the call site. Reading it fresh here would answer about a repair
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

async function announceTrapReady(countdownId, name) {
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
    if (def?.watch) {
        const { armTrap } = await import("./traps.mjs");
        const armedOk = await armTrap(countdownId, { condition: meta.condition ?? "" });
        if (armedOk) {
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
                }] : []
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
        }]
    });

    log(`Trap "${name}" is ready (${killer.name}).`);
    return true;
}

async function checkRepairCompletion(countdownId) {
    const targetId = repairs(countdownId);
    if (!targetId) return null;

    const repair = allProjects().find(p => p.id === countdownId);
    if (!repair || repair.current < repair.start) return null;

    // Unfreeze first. If the delete below were to fail, the worst outcome is a
    // stray finished bar - not a project left permanently unworkable.
    await setProjectMeta(targetId, { frozenBy: null });

    const target = allProjects().find(p => p.id === targetId);
    const repairName = repair.name;

    await announce({
        content: `<p><strong>${foundry.utils.escapeHTML(repairName)}</strong> - ${
            game.i18n.format("DRPG.Project.repaired", { name: foundry.utils.escapeHTML(target?.name ?? "?") })
        }</p>`
    });

    // Read the name and announce before deleting: `deleteProject` takes the
    // countdown and its metadata with it, so nothing can be looked up afterwards.
    await deleteProject(countdownId);

    log(`Repair "${repairName}" complete and removed; "${target?.name}" is workable again.`);
    return targetId;
}

/** Change a project's portrait/icon. GM only. */
export async function setProjectImage(countdownId, img) {
    if (!game.user.isGM || !img) return null;
    return writeCountdown(countdownId, { img });
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

    const raw = rawCountdown(countdownId);
    if (!raw) return null;

    const countdownPatch = {};
    if (patch.name !== undefined && patch.name !== null) countdownPatch.name = String(patch.name);
    if (patch.img) countdownPatch.img = patch.img;

    if (patch.target !== undefined && patch.target !== null) {
        const target = Math.max(1, Math.trunc(Number(patch.target) || 1));
        const current = raw.progress?.current ?? 0;
        countdownPatch.progress = {
            ...raw.progress,
            start: target,
            /*
             * ONE CLAMP FOR BOTH DIRECTIONS, AND THAT IS THE POINT (A15).
             *
             * This used to be a ternary on `countsUp` whose two branches were
             * character-for-character identical - which reads as a bug and is
             * not one. Ours count UP, so `current` is progress earned and is
             * clamped to the new ceiling. Daggerheart's count DOWN, where
             * `current` is what is LEFT, and that cannot exceed the start
             * either. Two different reasons, the same arithmetic; writing the
             * branch out only hid that they agree, and called `countsUp` for
             * an answer nothing then used.
             */
            current: Math.min(current, target)
        };
    }

    if (Object.keys(countdownPatch).length) {
        await writeCountdown(countdownId, countdownPatch,
            { replace: countdownPatch.progress ? ["progress"] : [] });
    }

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
    if (Object.keys(meta).length) await setProjectMeta(countdownId, meta);

    log(`Project ${countdownId} updated: ${Object.keys({ ...countdownPatch, ...meta }).join(", ")}`);
    return allProjects().find(p => p.id === countdownId) ?? null;
}

/** Delete a project and its metadata. GM only. */
export async function deleteProject(countdownId) {
    if (!game.user.isGM) return null;

    const data = game.settings.get(DH, COUNTDOWNS);
    const countdowns = foundry.utils.duplicate(data?.countdowns ?? {});
    if (!countdowns[countdownId]) return null;

    /* THE TOKEN GOES FIRST, while the metadata still says where it is. Deleting
       the project's row and then looking for its token would leave a two-square
       marker standing in a room for a project that no longer exists, and
       nothing left pointing at it to clean it up. */
    try {
        const { removeProjectToken } = await import("./projects-map.mjs");
        await removeProjectToken(countdownId);
    } catch (err) {
        error("Could not take the deleted project off the map", err);
    }

    delete countdowns[countdownId];
    await game.settings.set(DH, COUNTDOWNS, { ...data, countdowns });

    /*
     * A SABOTAGE PAIR GOES WITH EITHER HALF (F5, 17.09).
     *
     * The Project Manager lists "Repair: X" like any other bar, and deleting it
     * left X frozen by a project that no longer existed: gone from every
     * player's Work on Project list, out of reach of another sabotage, skipped by
     * the trap watcher, and nothing on any GM screen could thaw it. Deleting a
     * repair thaws what it was repairing; deleting the broken project takes its
     * repair with it, because nobody should spend an action mending nothing.
     */
    const own = metaFor(countdownId);
    const meta = { ...projectMeta() };
    delete meta[countdownId];
    const target = own.repairs ?? null;
    if (target && countdowns[target] && meta[target]?.frozenBy === countdownId) {
        meta[target] = { ...meta[target], frozenBy: null };
    }
    await game.settings.set(MODULE_ID, SETTINGS.projectMeta, meta);
    // And its killer, builder, condition and trigger, on every GM (E05): a stamped drop, which a GM
    // who was away takes at its next exchange.
    await projectSecretStore.drop(countdownId);

    // Its plant and its ledger row go with it (ITEM-08).
    try {
        const { pruneTrapsFor } = await import("./traps.mjs");
        await pruneTrapsFor(new Set(Object.keys(meta)));
    } catch (err) {
        error("Could not prune the deleted project's trap", err);
    }

    // And its repair, if it was broken (F5, above). Last, so the recursion finds
    // this project already gone and the pair's metadata already written.
    const repair = own.frozenBy ?? null;
    if (repair && countdowns[repair] && metaFor(repair).repairs === countdownId) {
        await deleteProject(repair);
    }
    return true;
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

    const data = game.settings.get(DH, COUNTDOWNS);
    const gone = Object.keys(data?.countdowns ?? {}).length;

    // Spread the rest of Daggerheart's own setting back, exactly as
    // `deleteProject` does - `countdowns` is one key inside it, not all of it.
    await game.settings.set(DH, COUNTDOWNS, { ...data, countdowns: {} });
    await game.settings.set(MODULE_ID, SETTINGS.projectMeta, {});
    /* Every project's secrets with them (E05): the primary's clear is a cut every GM takes, as the
       traps' two stores below; another GM's reset (a console - the window is the primary's) drops
       the rows it holds. */
    if (isPrimaryGm()) await projectSecretStore.clear();
    else await projectSecretStore.dropMany(Object.keys(projectSecretStore.entries()));

    // Nothing planted for a project that no longer exists (ITEM-08).
    try {
        const { pruneTrapsFor } = await import("./traps.mjs");
        await pruneTrapsFor(null);
    } catch (err) {
        error("Could not prune the season's traps", err);
    }

    log(`Season reset: cleared ${gone} project(s).`);
    return gone;
}

/**
 * A world from before 1.2.64 holds the four fields in projectMeta, which every browser reads (audit
 * S09-05). The clause `liftProjectSecrets` (migrate.mjs, since 1.2.64) runs this once, on the primary,
 * after the store holds the other GMs' copies (E05 C1).
 *
 * NOTHING LEAVES WORLD DATA BEFORE THE STORE HOLDS IT. The fields go in weak and fill-only - whatever a
 * GM wrote to the store since the update wins, a trigger part by part - and a field is taken out of
 * projectMeta only once the store reads it back from storage; the setting is replaced whole, so every
 * other field of every row is written back as it was, and then it is read back too. Idempotent: a world
 * already through this has none of the four.
 *
 * @returns {Promise<null|{lifted: number, kept: number, emptied: boolean}>}  Fields moved, fields left
 *   in the world because the store did not read them back, and whether projectMeta now holds none.
 */
export async function liftProjectSecrets() {
    if (!isPrimaryGm()) return null;
    if (await projectSecretStore.whenHydrated() === "timedOut") {
        throw new Error("the other GMs' copies of the project secrets did not arrive; the next load tries again");
    }
    const meta = projectMeta();
    const rows = {};
    for (const [id, entry] of Object.entries(meta)) {
        if (!entry || typeof entry !== "object") continue;
        const fields = Object.fromEntries(PROJECT_SECRET_FIELDS.filter(f => Object.hasOwn(entry, f)).map(f => [f, entry[f]]));
        if (Object.keys(fields).length) rows[id] = fields;
    }
    if (!Object.keys(rows).length) return null;
    await projectSecretStore.patchMany(rows, { weak: true, fillOnly: true });
    await projectSecretStore.idle();
    const next = foundry.utils.deepClone(meta);
    let lifted = 0, kept = 0;
    for (const [id, fields] of Object.entries(rows)) {
        const held = projectSecretStore.persisted(id) ?? {};
        for (const field of Object.keys(fields)) {
            if (Object.hasOwn(held, field)) {
                delete next[id][field];
                lifted++;
            } else kept++;
        }
    }
    if (kept) warn(`Project secrets: ${kept} field(s) stayed in projectMeta, because the GM store did not read them back.`);
    if (lifted) await game.settings.set(MODULE_ID, SETTINGS.projectMeta, next);
    const left = Object.values(projectMeta())
        .reduce((n, row) => n + PROJECT_SECRET_FIELDS.filter(f => row && typeof row === "object" && Object.hasOwn(row, f)).length, 0);
    if (lifted) log(`Lifted ${lifted} project secret field(s) out of world data (D3); ${left} left.`);
    // The armed map was built from the world's copy; the next event rebuilds it from the store.
    (await import("./traps.mjs")).forgetArmedTraps();
    return { lifted, kept, emptied: left === 0 };
}

/** Human-readable scale label for a progress target. */
export function scaleFor(target) {
    const entry = Object.values(PROJECT_SCALE).find(s => s.progress === target);
    return entry?.label ?? null;
}

/* ==========================================================================
 * SECRECY
 * --------------------------------------------------------------------------
 * An indirect murder project is secret by default and stays that way: a
 * progress bar named "Prepare the poison" sitting in everyone's sidebar would
 * give the whole plot away before it started.
 *
 * Secrecy is enforced through the countdown's own `ownership` map - default
 * NONE, with explicit access for the killer and anyone they (or the GM) later
 * choose to let in. GMs always see everything regardless.
 * ========================================================================== */

const NONE = 0;        // CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE
const OBSERVER = 2;    // CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER

/**
 * Build a countdown ownership map that Daggerheart will actually honour.
 *
 * A `default: 0` entry does nothing. Daggerheart's `DhCountdown#getUserLevel`
 * looks up `ownership[user.id]`, and when that is missing it falls back to the
 * Countdowns setting's world-level `defaultOwnership` - which ships as OBSERVER.
 * The per-countdown `default` key is never consulted at all.
 *
 * So every "secret" project was visible to the whole table, indirect murders
 * included. Secrecy has to be spelled out per user: an explicit NONE for every
 * player who is not a viewer.
 */
/** The non-GM users who own this actor - whose eyes "the killer" means. */
const ownerIdsOfId = actorId => ownerIdsOf(game.actors.get(actorId ?? ""));

function ownershipMap(viewerIds = []) {
    const viewers = new Set(viewerIds.filter(Boolean));
    const map = { default: NONE };          // kept for our own isSecret() read
    for (const user of game.users) {
        if (user.isGM) continue;            // GMs are owners unconditionally
        map[user.id] = viewers.has(user.id) ? OBSERVER : NONE;
    }
    return map;
}

/** Users who can currently see a secret project (excluding GMs). */
export function viewersOf(countdownId) {
    const ownership = rawCountdown(countdownId)?.ownership ?? {};
    return Object.entries(ownership)
        .filter(([key, level]) => key !== "default" && level >= OBSERVER)
        .map(([userId]) => game.users.get(userId))
        .filter(u => u && !u.isGM);
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

        const current = rawCountdown(project.id)?.ownership ?? {};
        const viewers = Object.entries(current)
            .filter(([key, level]) => key !== "default" && level >= OBSERVER)
            .map(([userId]) => userId);

        const wanted = ownershipMap(viewers);
        /*
         * `equals`, not `objectsEqual` - the second is deprecated in 14 and goes
         * in 16, and it warned on every pass of this loop because this function
         * runs on load and on every `createUser`. Optional call on both names so
         * a Foundry that has one and not the other still gets an answer, and a
         * Foundry with neither falls through to writing the ownership it already
         * has: a redundant write, never a missed re-seal. That direction is the
         * whole point of this function - a secret project visible to a player is
         * the failure it exists to prevent.
         */
        const same = foundry.utils.equals?.(current, wanted)
            ?? foundry.utils.objectsEqual?.(current, wanted)
            ?? false;
        if (same) continue;

        await writeCountdown(project.id, { ownership: wanted }, { replace: ["ownership"] });
        fixed += 1;
    }

    if (fixed) log(`Re-sealed ${fixed} secret project(s) that were visible to players.`);
    return fixed;
}

/**
 * Make a project secret, visible only to the given users.
 *
 * @param {string} countdownId
 * @param {string[]} viewerIds  Users allowed to see it - normally just the killer.
 */
export async function makeSecret(countdownId, viewerIds = []) {
    if (!game.user.isGM) return null;

    const ownership = ownershipMap(viewerIds);

    await writeCountdown(countdownId, { ownership }, { replace: ["ownership"] });
    await setProjectMeta(countdownId, { secret: true });
    log(`Project ${countdownId} is now secret; ${viewerIds.length} viewer(s).`);
    return ownership;
}

/** Let one more player in on a secret project. */
export async function shareWith(countdownId, userId) {
    if (!game.user.isGM) {
        const { requestProjectShare } = await import("./gm-bridge.mjs");
        const res = await requestProjectShare(countdownId, userId);
        return res.ok ? { pending: true } : null;
    }

    // Only a SECRET project has a guest list (E03; audit S09-02). Sharing a
    // public one wrote an ownership map that hid it from everybody but the one
    // player, while its metadata still called it public - so the tray and the
    // pickers disagreed about who could see it, and nothing ever resealed it.
    if (!isSecret(countdownId)) return null;

    const current = rawCountdown(countdownId)?.ownership ?? {};
    const viewers = Object.entries(current)
        .filter(([key, level]) => key !== "default" && level >= OBSERVER)
        .map(([id]) => id);
    await writeCountdown(countdownId, { ownership: ownershipMap([...viewers, userId]) }, { replace: ["ownership"] });

    const user = game.users.get(userId);
    log(`Project ${countdownId} shared with ${user?.name ?? userId}.`);
    return true;
}

/** Take a player back off a secret project. */
export async function unshareWith(countdownId, userId) {
    if (!game.user.isGM) return null;
    // The same map, written the same way, for the same reason as `shareWith`.
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

    const current = rawCountdown(countdownId)?.ownership ?? {};
    const viewers = Object.entries(current)
        .filter(([key, level]) => key !== "default" && level >= OBSERVER && key !== userId)
        .map(([id]) => id);
    await writeCountdown(countdownId, { ownership: ownershipMap(viewers) }, { replace: ["ownership"] });
    return true;
}

/**
 * Drop secrecy entirely - the plan is out.
 *
 * The ownership map is *replaced*, not merged. `writeCountdown` uses
 * `mergeObject`, so writing `{ default: OBSERVER }` left every explicit
 * `{ playerId: NONE }` from `ownershipMap` exactly where it was - and since
 * Daggerheart reads `ownership[user.id]` and ignores `default`, revealing a
 * project changed nothing for the players it had been hidden from.
 */
export async function revealProject(countdownId) {
    if (!game.user.isGM) return null;

    // Who was in on it, kept for the day it is sealed again - see `sealAudience`.
    // Read before the write below makes the answer "everybody".
    const insiders = isSecret(countdownId)
        ? withoutLeak(countdownId, viewersOf(countdownId).map(u => u.id))
        : (metaFor(countdownId).sealedViewers ?? []);

    const cleared = { default: OBSERVER };
    for (const user of game.users) {
        if (user.isGM) continue;
        cleared[user.id] = OBSERVER;
    }

    await writeCountdown(countdownId, { ownership: cleared }, { replace: ["ownership"] });
    await setProjectMeta(countdownId, { secret: false, sealedViewers: insiders });
    log(`Project ${countdownId} revealed to everyone.`);
    return true;
}

/**
 * The owners of whoever is building this project - the people a seal may never
 * shut out (F3). Exported for the pickers that set the viewer list by hand
 * (P-1): the GM ticks who else knows, and this is added whatever they tick.
 */
export function builderIds(countdownId) {
    const meta = secretsOf(countdownId);
    return ownerIdsOfId(meta.killerId ?? meta.by ?? null);
}

/**
 * Who should see a project if it is sealed now: its viewers, and the student
 * whose project it is.
 *
 * NOT `viewersOf` ON A PUBLIC PROJECT (F4, 17.09). A revealed project names
 * every player as a viewer - Daggerheart reads `ownership[user.id]` and ignores
 * `default`, so it has to - and re-sealing it with that list kept the whole
 * table in while the Secret box and our own flag said sealed. A public project
 * answers with the viewers it had before it was revealed, and never with
 * everyone. The builder is added either way (F3): `killerId` on a trap, the
 * proposer on anything else.
 *
 * @param {string} countdownId
 * @returns {string[]}  User ids, GMs excluded.
 */
export function sealAudience(countdownId) {
    const meta = metaFor(countdownId);
    const ids = new Set(isSecret(countdownId)
        ? withoutLeak(countdownId, viewersOf(countdownId).map(u => u.id))
        : withoutLeak(countdownId, meta.sealedViewers ?? []));
    for (const id of builderIds(countdownId)) ids.add(id);
    return Array.from(ids);
}

/**
 * A viewer list that is every player at once, on a table of two or more, is the
 * F4 leak and not a choice anybody made: a project sealed before the fix kept the
 * whole table in, and revealing and re-sealing it copied that list forward
 * (review of F4, 17.09). Such a list is replaced by the builder's owners. A
 * project somebody really did share with every player loses that share - the
 * safe way to be wrong about a murder plan.
 */
export function withoutLeak(countdownId, ids) {
    const players = game.users.filter(u => !u.isGM).map(u => u.id);
    const everyone = players.length >= 2 && players.every(id => ids.includes(id));
    if (!everyone) return ids;
    return builderIds(countdownId);
}

/** Is this project hidden from the table at large? */
export function isSecret(countdownId) {
    const meta = metaFor(countdownId);
    if (meta.secret !== undefined) return Boolean(meta.secret);
    return (rawCountdown(countdownId)?.ownership?.default ?? OBSERVER) < OBSERVER;
}

/* ---- low-level countdown access ---------------------------------------- */

function rawCountdown(countdownId) {
    try {
        return game.settings.get(DH, COUNTDOWNS)?.countdowns?.[countdownId] ?? null;
    } catch {
        return null;
    }
}

/**
 * Merge fields into one countdown. GM only.
 *
 * `replace` names top-level keys that must be overwritten wholesale rather than
 * merged. An ownership map is the obvious case: merging can only ever *add*
 * entries, so a stale `{ playerId: NONE }` survives every attempt to grant
 * access and the write silently does the opposite of what it says.
 */
async function writeCountdown(countdownId, patch, { replace = [] } = {}) {
    const data = game.settings.get(DH, COUNTDOWNS);
    const countdowns = foundry.utils.duplicate(data?.countdowns ?? {});
    if (!countdowns[countdownId]) return null;

    const merged = foundry.utils.mergeObject(countdowns[countdownId], patch, { inplace: false });
    for (const key of replace) {
        if (key in patch) merged[key] = patch[key];
    }

    countdowns[countdownId] = merged;
    await game.settings.set(DH, COUNTDOWNS, { ...data, countdowns });
    return merged;
}
