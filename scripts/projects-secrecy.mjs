/**
 * Danganronpa RPG - who may know a project, and the reads and writes behind it.
 * ---------------------------------------------------------------------------
 * A project's secret fields (`PROJECT_SECRET_FIELDS`) - kept in the GMs' store,
 * read through `secretsOf`, written through `patchTrigger` and `setProjectMeta`,
 * and lifted out of world data once by `liftProjectSecrets`; who may see a
 * project (`canSee`, `viewersOf`, `insidersOf`, `builderIds`, `sealAudience`,
 * `withoutLeak`, `isSecret`) and the countdown's ownership map that enforces it,
 * as the change that makes it (`secretChange`, `shareChange`, `unshareChange`,
 * `revealChange`: projects.mjs's `makeSecret`, `shareWith`, `unshareWith` and
 * `revealProject` hand them to its one entry since E36 C2); and the accessors -
 * `projectMeta`, `metaFor` and `setProjectMeta` for the module's own row,
 * `rawCountdown` for Daggerheart's countdown and `writeAllCountdowns`, the one
 * whole write of it, from a step. What it does not hold: making, progressing, sabotaging, announcing,
 * editing or deleting a project, and resealing the secret ones after a load
 * (projects.mjs: `resealSecretProjects` and `knowsProject` read `allProjects`
 * and `roomOf`), nor any window or the tray (projects-ui.mjs, projects-tray.mjs).
 *
 * WHERE IT SITS. Moved out of projects.mjs by E34 (1.2.70), a pure move that
 * `node tools/moved-only.mjs` proves line by line. The file above it is
 * projects.mjs, which re-exports the seventeen names of this file it exported
 * before, so importers keep importing projects.mjs, and nothing here imports it
 * back: R161 counts an `export ... from` as an edge, and the import would close a
 * cycle. Below it are config.mjs, settings.mjs, utils.mjs and gm-stores.mjs,
 * statically (gm-stores.mjs reaches this family only by `import()`), and
 * traps.mjs by `import()` (gm-bridge.mjs too until E36 C2). The accessors came
 * down with the secrecy because the secrecy writes through them: left above, they
 * would have made this file import its facade. Eight names are exported that were
 * not (`DH`, `COUNTDOWNS`, `OBSERVER`, `ownerIdsOfId`, `ownershipMap`,
 * `insidersOf`, `rawCountdown`, `writeCountdown`), because projects.mjs reads
 * them; it does not re-export them, so the module's API is the one it was. E36 C1
 * added two more for it, `COUNTDOWNS_KEY` and `writeAllCountdowns`; E36 C2 took
 * `writeCountdown` out and the four ownership writers up into projects.mjs, which
 * re-exports them no longer. Since E36 C3 (fix e1-G1) no whole write of Countdowns
 * is left outside a step of `COUNTDOWNS_KEY`: this file's `writeAllCountdowns`, from
 * a step, and relay-guard.mjs `applyOps`' own write, in one (tests-tier0.mjs R977);
 * E36 fix e1-G2 added `sightChange` and `SIGHT_KEYS`, the step's arithmetic of who
 * sees a project.
 * WHAT ELSE IS IN THE KEY, AND WHAT IS NOT (E37 C6, 01.11.2026; E37-29, the deferred D100). Daggerheart's own whole
 * writes on a GM's browser that the module can reach run as steps of `COUNTDOWNS_KEY` since E37 C6: the automation's
 * static `DhCountdowns.updateCountdowns` (a GM's roll, a combat turn, reroll.mjs `settleDualityReroll`), wrapped once
 * by projects-ui.mjs `wrapCountdownUpdate` (patches.mjs's row "countdown-update"), and the tray menu's Reveal, Hide
 * and Delete on a row that is no project (projects-ui.mjs `projectRowMenu`). Outside it still: the tray's -/+ on a row
 * that is no project, the system's private handler (`editCountdown`), which the module does not wrap - a whole write
 * that can land between a project's step's read and its write (LIVE-E37-03, audit/AUDIT-1.2.42.md 9.2); a player's
 * clicks go to the GM's relay, whose write is in a step (relay-guard.mjs `applyOps`). Nothing calls `updateCountdowns`
 * inside a step of the key: it would wait on itself (tests-tier0.mjs R1201).
 * `liftProjectSecrets` stands last on purpose: R172 reads it by name, a
 * function's cut (`fnSource`) runs on to the next function, and last keeps the
 * cut the text it was before the move. No module state.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { log, ownerIdsOf, isPrimaryGm, serialWrite } from "./utils.mjs";
import { projectSecretStore, projectSightCopy } from "./gm-stores.mjs";
import { registerSecretFields } from "./gm-store.mjs";
import { spectatorUserIds } from "./spectator.mjs";

export const DH = "daggerheart";
export const COUNTDOWNS = "Countdowns";
/**
 * THE QUEUE OF EVERY PROJECT CHANGE (E36 C1, 25.10.2026; audit S17-18). The setting's full key, and the key
 * of the one queue (utils.mjs `serialWrite`) that projects.mjs `applyProjectChange` runs every change of a
 * project in, on the primary GM: a step there reads the Countdowns setting, changes it and writes it whole
 * (`writeAllCountdowns`), and the next step reads what it wrote. A writer of Countdowns outside a step queues
 * on it too (tests-tier0.mjs R977 reads both). The key is a string the queue knows nothing about: E80 C0
 * built `serialWrite` to know nothing of projects, and the owner kept it so (11.10).
 */
export const COUNTDOWNS_KEY = `${DH}.${COUNTDOWNS}`;

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
 *
 * AND WHO SABOTAGED A PROJECT (E05 fix r1-G1, 27.09.2026; the security review's S1-m1). A player's
 * sabotage recorded their user id on the repair's row, `saboteur`, so that only their own Reroll
 * takes it back - in projectMeta, where any console read which player had sabotaged which project
 * until the repair was finished (the review's scratch scenario, 26.09: p1 read p2's user id there).
 * The secrecy is what a saboteur buys with their Shadow roll. Its one reader, `unsabotageRefusal`,
 * runs on a GM, so it is the fifth field here, and `liftProjectSecrets` takes it out of an older world.
 *
 * Three more since E15 part 2 C2 (25.10.2026; the stage's E15-43): a Secret Passage's `target`, `{ preset, room }`, the
 * preset (passages-gm.mjs `PASSAGE_PRESETS`) and the neighbour the proposal named, and its `passage`, the stretch the
 * approval picked (`{ sceneId, level, wallId, seg, rooms }`) - where a secret passage will be is what the project
 * keeps secret -, and `foundBy`, `{ userId: at }`, the players who found the secret project by Observe (observe.mjs),
 * whom its completion tells it is finished and gives nothing of what it made.
 *
 * And `sabotageAsk` since E18 C7 (26.10.2026; audit S10-43 part 2): the request id a player's Sabotage came under, on its
 * repair's row beside `saboteur`, so the same player's resend of it is answered the first result (projects.mjs
 * `sabotageOfRequest`). Which request froze a project is the saboteur's secret as much as their user id.
 *
 * And `proposerTold` since H84 fix G3 (27.10.2026; the end review's H84-SEC-02, H84R-5): whether the proposer of a public
 * project was sent the private card that tells their own browser they know it (projects.mjs `tellProposer`). It is a
 * fact about `by`, so it is the GMs' as `by` is: a public mark of it would say which projects a player proposed.
 */
export const PROJECT_SECRET_FIELDS = Object.freeze(["killerId", "by", "condition", "trigger", "saboteur", "sabotageAsk", "passage", "target", "foundBy",
    "proposerTold", "secretName", "viewers"]);
registerSecretFields("projectMeta", PROJECT_SECRET_FIELDS);

/*
 * A SECRET PROJECT'S NAME AND WHO IS IN ON IT ARE THE GMS' (known leak S17-31; the coordinator's task of 12.11.2026).
 * Daggerheart's world setting Countdowns reaches every browser, and a secret project's countdown carried its name and an
 * ownership map with each player's own level - OBSERVER for those in on it, NONE for the rest: any console read the plan's
 * name and, for an indirect murder, the killer's player (72-canary, red at 4eef965 on both bystanders). Since S17-31 the
 * countdown carries `HIDDEN_NAME` and a map that gives every player one level (`ownershipMap`): Daggerheart reads each
 * player's own entry and not `default`, so it draws the row for every player, and the module's tray takes it out for
 * whoever is not in on it (projects-tray.mjs `hideUndiscovered`) and writes the name back for whoever is
 * (`nameSecretRows`). The name is the GMs' store's (`secretName`), and so is the list of players in on it (`viewers`);
 * a player in on it holds both from a GM's private card to them alone (projects.mjs `tellSight`, `toldSight` below).
 * Both fields go through `setProjectMeta` with the other secret ones; the change entry moves the name between the
 * countdown and the store as a project is sealed or revealed (projects.mjs `applyProjectChange`).
 */
export const HIDDEN_NAME = "???";

/**
 * Whether this browser's player is in on a secret project, and its name, as the GMs sent it (gm-stores.mjs
 * `projectSightCopy`, sent by projects.mjs `sendSightTo`): `{ in, name }`, or null when this user's copy does not name
 * the project. Until E101's review of S17-31 (R2, 13.11.2026) it read the newest of the GMs' private cards to this
 * player, so a cleared chat log took the project out of the tray; the copy is the player's own client setting, which
 * no chat action touches, and is asked again at every load.
 */
export function toldSight(countdownId) {
    const held = projectSightCopy.read()?.[countdownId];
    if (!held || typeof held !== "object") return null;
    return { in: held.in === true, name: typeof held.name === "string" ? held.name : null };
}

/**
 * A project's name as this browser may hold it (S17-31): the countdown's for a public project; for a secret one the GMs'
 * store on a GM, this player's copy of the GMs' sight on a player's (`toldSight`), and `HIDDEN_NAME` failing those.
 */
export function shownName(countdownId, countdown = rawCountdown(countdownId)) {
    const name = countdown?.name ?? "";
    if (!isSecret(countdownId)) return name;
    if (game.user?.isGM) return secretsOf(countdownId).secretName ?? name;
    return toldSight(countdownId)?.name ?? name;
}

/**
 * A SECRET PROJECT'S DESCRIPTION IS THE GMS' (E44 fix FG6, 05.11.2026; the end review's S-M1, the owner's option (a), the
 * default while he has not answered). C9 kept every description in projectMeta beside the room, under its name's
 * secrecy: hidden from the interface of a browser that did not know the project, read by any console all the same
 * (C9's Open 91) - an indirect murder's plan in its builder's words, the kind of text `condition` was taken out of
 * projectMeta for (E05 C1). A secret project's description is the GMs' store's now, and a public project's stays in
 * projectMeta, where every browser that may come to know a public project already reads it. `setProjectMeta` puts each in
 * its half and moves it when a change of the project's secrecy (a reveal, a reseal) comes with or without it; the
 * players in on a secret one read it on a private card made for them (projects.mjs `tellDescription`). A list of its
 * own beside PROJECT_SECRET_FIELDS: world-secrets.mjs holds those out of every projectMeta row (tier 0 holds the two
 * lists equal), and this one out of a secret project's row alone (its rule's `whileSecret`, R190).
 *
 * AND ITS ROOM ACTION (E93 C1, 12.11.2026): `facility`, what its completion gives in its room (facilities.mjs
 * `cleanFacility`) - a GM's words of what the project makes, as much the project's secret as its description. Read on a
 * GM through `secretsOf`; a player in on a secret project holds it from a GM's private card to its insiders alone
 * (projects.mjs `tellFacility`, facilities.mjs `toldFacility`; the owner's DRPG-D1 answer, 12.11.2026: "Dostaja").
 */
export const PROJECT_SECRET_WHILE_SECRET = Object.freeze(["description", "facility"]);

/**
 * The secret fields of one project: the store's row on a GM, `{}` on anybody else. A player's browser
 * holds no GM store, and nothing that runs there needs them: the tray, the pickers and the token
 * read projectMeta and the countdown, and every reader of them runs on a GM (the trap's arming
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

/**
 * Write metadata for a project. GM only.
 *
 * TWO HALVES SINCE E05 (C1; audit S09-05). The fields of `PROJECT_SECRET_FIELDS` that `data`
 * names go to the GM store, stamped as a GM's decision - `trigger` whole, because a caller here
 * states all of it (a trap's own three parts are `patchTrigger`'s); everything else is merged into
 * projectMeta, as before. Answers the project's row, both halves.
 */
export async function setProjectMeta(countdownId, data) {
    if (!game.user.isGM) return null;
    const given = data ?? {}, secret = {}, open = {}, taken = [];
    for (const [field, value] of Object.entries(given)) (PROJECT_SECRET_FIELDS.includes(field) ? secret : open)[field] = value;
    /* PROJECT_SECRET_WHILE_SECRET (E44 fix FG6): to the GMs' half while the project is secret - as this write says it
       (`secret`), else as it stands - and to projectMeta while it is public; a write that changes the secrecy takes the
       one held across, and the half it leaves loses it (projectMeta's key gone, the GMs' row's set to null). */
    const hidden = Object.hasOwn(given, "secret") ? Boolean(given.secret) : isSecret(countdownId);
    for (const field of PROJECT_SECRET_WHILE_SECRET) {
        if (!Object.hasOwn(given, field) && !Object.hasOwn(given, "secret")) continue;
        const held = secretsOf(countdownId)[field];
        const value = Object.hasOwn(given, field) ? given[field] : (held ?? metaFor(countdownId)[field]);
        if (value === undefined || value === null) continue;
        if (hidden) {
            delete open[field];
            secret[field] = value;
            taken.push(field);
        } else {
            open[field] = value;
            if (held !== undefined && held !== null) secret[field] = null;
        }
    }
    if (Object.keys(secret).length) await projectSecretStore.patch(countdownId, secret, { whole: true });
    const row = metaFor(countdownId);
    if (Object.keys(open).length || taken.some(field => Object.hasOwn(row, field))) {
        const next = { ...row, ...open };
        for (const field of taken) delete next[field];
        await game.settings.set(MODULE_ID, SETTINGS.projectMeta, { ...projectMeta(), [countdownId]: next });
    }
    return { ...metaFor(countdownId), ...secretsOf(countdownId) };
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
    // A Spectator sees every project, the secret ones too (E92, the owner's DRPG-D1 of 12.11.2026; `ownershipMap`).
    if (user && spectatorUserIds().has(user.id)) return true;
    // A player's browser knows its own player's place alone, from the GMs' card (S17-31); a GM reads the store.
    if (!game.user?.isGM) return user?.id === game.user?.id && toldSight(countdownId)?.in === true;
    return viewersOf(countdownId).some(u => u.id === user?.id);
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
export const OBSERVER = 2;    // CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER

/** The non-GM users who own this actor - whose eyes "the killer" means. */
export const ownerIdsOfId = actorId => ownerIdsOf(game.actors.get(actorId ?? ""));

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
export function ownershipMap() {
    /* ONE LEVEL FOR EVERY PLAYER (S17-31): who is in on a secret project is the GMs' store's (`viewers`), not this map's,
       which every browser holds. Each player at OBSERVER, as Daggerheart reads each player's own entry and not `default`:
       it draws the row for every player and the module's tray takes it out for those not in on it. `default` stays NONE,
       kept for our own `isSecret` read of a countdown with no meta. A Spectator, a player, is at OBSERVER with the rest:
       E92's "sees every project, private ones too" (`canSee` lets it in; its name comes on a card, projects.mjs `tellSight`). */
    const map = { default: NONE };
    for (const user of game.users) {
        if (user.isGM) continue;            // GMs are owners unconditionally
        map[user.id] = OBSERVER;
    }
    return map;
}

/** The players a secret project is known to: its viewers and its builder's owners (F3). */
export function insidersOf(countdownId) {
    return Array.from(new Set([...viewersOf(countdownId).map(u => u.id), ...builderIds(countdownId)]));
}

/** Users who can currently see a secret project (excluding GMs): the GMs' list on a GM (S17-31), this player on theirs when a card says so. */
export function viewersOf(countdownId) {
    const ids = game.user?.isGM ? (sharedIds(countdownId) ?? []) : (toldSight(countdownId)?.in ? [game.user.id] : []);
    return ids.map(userId => game.users.get(userId)).filter(u => u && !u.isGM);
}

/*
 * WHO SEES A PROJECT, AS CHANGES (E36 C2, 25.10.2026; audit S17-18). `makeSecret`, `shareWith`, `unshareWith` and
 * `revealProject` wrote the countdown's ownership here, each read and written whole outside any queue. They are
 * projects.mjs functions now, over its one entry (`applyProjectChange`); what stays here is the arithmetic: each
 * of these answers the change the entry makes (`{ ownership, meta }`), or null when there is none to make, and
 * writes nothing. The ownership map is a whole map in the change, and the entry replaces the countdown's with it.
 */

/** Sealed to these users alone - normally just the killer. */
export function secretChange(countdownId, viewerIds = []) {
    return { ownership: ownershipMap(), meta: { secret: true, viewers: [...new Set(viewerIds.filter(Boolean))] } };
}

/**
 * The users who see a secret project now: the GMs' list (`viewers`, S17-31); for a project sealed before it, the
 * countdown's old per-player map, read until a reseal lifts it into the list (`sightChange`'s `reseal`); null when
 * neither is here - a countdown S17-31 already lifted ("???", one level for everyone) whose row this browser has not
 * been sent yet.
 *
 * WHICH OF THE TWO A COUNTDOWN IS, BY ITS NAME (E101's review of S17-31, R1 and R3, 13.11.2026). Until this fix a map
 * with every player at one level read as "nobody", for S17-31's own map. It caught two more: an older seal a GM had
 * shared with every player, a share at a time (the migration then lifted it into an empty list, every insider out -
 * S17-31-T2's second project); and a lifted project on a primary GM that loaded before another GM's row reached it
 * (the reseal and every change step wrote "???" and an empty list with fresh stamps, which won the exchange -
 * S17-31-T3). The countdown's name tells them apart: only a lift writes `HIDDEN_NAME` there, so a countdown still
 * named holds an older seal's map, read as written; one named `HIDDEN_NAME` holds no list at all, and without the
 * GMs' row nothing about who sees it is known here. A Spectator observes every secret project and is no viewer (E92).
 */
function sharedIds(countdownId) {
    const held = secretsOf(countdownId).viewers;
    if (Array.isArray(held)) return held.filter(id => typeof id === "string");
    const countdown = rawCountdown(countdownId);
    if (countdown?.name === HIDDEN_NAME) return null;
    const watching = spectatorUserIds();
    return Object.entries(countdown?.ownership ?? {})
        .filter(([key, level]) => key !== "default" && level >= OBSERVER && game.users.get(key) && !game.users.get(key).isGM && !watching.has(key))
        .map(([id]) => id);
}

/** Said when a share or a revoke would be worked out on a list this browser does not hold (`sharedIds` null). */
const LIST_NOT_HERE = "the GMs' list of who sees it has not reached this browser yet";

/**
 * One more player in on a secret project. Only a SECRET project has a guest list (E03; audit S09-02): sharing a
 * public one wrote an ownership map that hid it from everybody but the one player, while its metadata still
 * called it public - so the tray and the pickers disagreed about who could see it, and nothing ever resealed it.
 */
export function shareChange(countdownId, userId) {
    if (!isSecret(countdownId)) return null;
    const ids = sharedIds(countdownId);
    if (!ids) return { refused: LIST_NOT_HERE };
    return { ownership: ownershipMap(), meta: { viewers: [...new Set([...ids, userId])] } };
}

/** A player taken back off a secret project: the GMs' list without them (S17-31), the map the same for everyone. */
export function unshareChange(countdownId, userId) {
    if (!isSecret(countdownId)) return null;
    const ids = sharedIds(countdownId);
    if (!ids) return { refused: LIST_NOT_HERE };
    return { ownership: ownershipMap(), meta: { viewers: ids.filter(id => id !== userId) } };
}

/*
 * WHO SEES A PROJECT, WORKED OUT IN THE STEP (E36 fix e1-G2, 25.10.2026; findings E36-END-S2, E36-R2, F4). The
 * changes above were worked out on the caller, before the change joined the queue, and the step replaced the
 * countdown's map with the one they made: a share worked out while a revoke waited in the queue put the revoked
 * player back, and of two shares queued together the second wrote over the first (E36-T7 at 8443d03f: "ABC"
 * where "BC" was asked, "AC" where "ABC" was). A change names the operation now - `share`, `unshare`, `seal`,
 * `reveal`, `reseal` - and projects.mjs's step hands it here, with the countdown it read in the step to read:
 * the same arithmetic, on held state. `makeSecret` alone keeps a whole map, `secretChange` of its own viewers,
 * which reads nothing of the countdown.
 */

/** The keys of a change that name who sees a project, as operations `sightChange` works out (projects.mjs's step). */
export const SIGHT_KEYS = Object.freeze(["share", "unshare", "seal", "reveal", "reseal"]);

/**
 * The change one of `SIGHT_KEYS` makes now: `{ ownership, meta }`, null when there is none to make, or
 * `{ refused }` when it cannot be made (a share or a revoke of a project that is no longer secret).
 *   `share: userId`, `unshare: userId`  `shareChange`, `unshareChange`;
 *   `seal: { viewers, was }`            a window's ticks (P-1: a ticked list is an answer): `viewers` the boxes
 *                                       ticked, `was` those the window drew ticked. With both, what the GM changed
 *                                       is applied to who sees it now, so a player shared since the window drew
 *                                       stays in; with `viewers` alone that list is the answer; with neither,
 *                                       `sealAudience`. The builder is added and the F4 list replaced either way
 *                                       (`withoutLeak`), and a seal that changes nobody is none;
 *   `reveal: true`                      `revealChange`;
 *   `reseal: true`                      a secret project's map written again from its own viewers (projects.mjs
 *                                       `resealSecretProjects`), none when it is the map already.
 */
export function sightChange(countdownId, op = {}) {
    if (op.share) return isSecret(countdownId) ? shareChange(countdownId, op.share) : { refused: "it is not secret" };
    if (op.unshare) return isSecret(countdownId) ? unshareChange(countdownId, op.unshare) : { refused: "it is not secret" };
    if (op.seal) {
        const viewers = Array.isArray(op.seal.viewers) ? op.seal.viewers : null;
        const was = Array.isArray(op.seal.was) ? op.seal.was : null;
        let list = viewers;
        if (viewers && was) {
            const known = isSecret(countdownId) ? viewersOf(countdownId).map(u => u.id) : (metaFor(countdownId).sealedViewers ?? []);
            const dropped = was.filter(id => !viewers.includes(id));
            list = [...new Set([...known.filter(id => !dropped.includes(id)), ...viewers.filter(id => !was.includes(id))])];
        }
        const audience = list ? [...new Set([...withoutLeak(countdownId, list), ...builderIds(countdownId)])] : sealAudience(countdownId);
        const now = new Set(viewersOf(countdownId).map(u => u.id));
        const same = isSecret(countdownId) && now.size === audience.length && audience.every(id => now.has(id));
        return same ? null : secretChange(countdownId, audience);
    }
    if (op.reveal) return revealChange(countdownId);
    if (op.reseal) {
        if (!isSecret(countdownId)) return null;
        const current = rawCountdown(countdownId)?.ownership ?? {};
        const wanted = ownershipMap();
        // `equals`, not the deprecated `objectsEqual`, and neither: a redundant write, never a missed reseal.
        const same = foundry.utils.equals?.(current, wanted) ?? foundry.utils.objectsEqual?.(current, wanted) ?? false;
        // S17-31: sealed only once the list is the GMs' and the countdown carries no name; a project sealed before it lifts both.
        const lifted = Array.isArray(secretsOf(countdownId).viewers) && rawCountdown(countdownId)?.name === HIDDEN_NAME;
        if (same && lifted) return null;
        // A lifted countdown whose row is not here (E101 R1): its map only, if it needs one - no list is known to write.
        const ids = sharedIds(countdownId);
        if (!ids) return same ? null : { ownership: wanted };
        return { ownership: wanted, meta: { viewers: ids } };
    }
    return null;
}

/**
 * Secrecy dropped entirely - the plan is out.
 *
 * The ownership map is *replaced*, not merged: writing `{ default: OBSERVER }` over a merge left every explicit
 * `{ playerId: NONE }` from `ownershipMap` exactly where it was - and since Daggerheart reads `ownership[user.id]`
 * and ignores `default`, revealing a project changed nothing for the players it had been hidden from.
 */
export function revealChange(countdownId) {
    // Who was in on it, kept for the day it is sealed again - see `sealAudience`.
    // Read before the change makes the answer "everybody".
    const insiders = isSecret(countdownId)
        ? withoutLeak(countdownId, viewersOf(countdownId).map(u => u.id))
        : (metaFor(countdownId).sealedViewers ?? []);
    const cleared = { default: OBSERVER };
    for (const user of game.users) {
        if (user.isGM) continue;
        cleared[user.id] = OBSERVER;
    }
    return { ownership: cleared, meta: { secret: false, sealedViewers: insiders, viewers: null } };
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

export function rawCountdown(countdownId) {
    try {
        return game.settings.get(DH, COUNTDOWNS)?.countdowns?.[countdownId] ?? null;
    } catch {
        return null;
    }
}

/**
 * Write the Countdowns setting whole, as a step of `COUNTDOWNS_KEY` built it (E36 C1): `data` is the setting
 * read in that step with its changes. Called from a step alone (projects.mjs `applyProjectChange`'s); a step
 * that read the setting again to merge one countdown would read it a second time, and R977 counts the writers by name.
 */
export async function writeAllCountdowns(data) {
    await game.settings.set(DH, COUNTDOWNS, data);
    return data;
}

/**
 * A world from before 1.2.64 holds the secret fields in projectMeta, which every browser reads (audit
 * S09-05). The clause `liftProjectSecrets` (migrate.mjs, since 1.2.64) runs this once, on the primary,
 * after the store holds the other GMs' copies (E05 C1).
 *
 * NOTHING LEAVES WORLD DATA BEFORE THE STORE HOLDS IT. The fields go in weak and fill-only - whatever a
 * GM wrote to the store since the update wins, a trigger part by part - and a field is taken out of
 * projectMeta only once the store reads it back from storage; the setting is replaced whole, so every
 * other field of every row is written back as it is NOW - read again after the store's save, which is
 * an await another GM's write can land in (a room, a freeze; the correctness review's M9: the copy read
 * before it put that write back) - and then it is read back too. A field still in projectMeta after
 * that throws, with the count, so the world is not stamped and the next load tries again (E05 fix
 * r1-G1; migrate.mjs, above the lifts). Idempotent: a world already through this has none of them.
 *
 * @returns {Promise<null|{notPrimary: true}|{lifted: number, kept: number, emptied: boolean}>}  Fields moved, fields left
 *   in the world (0 - more throws), and whether projectMeta now holds none (true).
 */
export async function liftProjectSecrets() {
    if (!isPrimaryGm()) return { notPrimary: true };
    if (await projectSecretStore.whenHydrated() === "timedOut") {
        throw new Error("the other GMs' copies of the project secrets did not arrive; the next load tries again");
    }
    const rows = {};
    for (const [id, entry] of Object.entries(projectMeta())) {
        if (!entry || typeof entry !== "object") continue;
        const fields = Object.fromEntries(PROJECT_SECRET_FIELDS.filter(f => Object.hasOwn(entry, f)).map(f => [f, entry[f]]));
        if (Object.keys(fields).length) rows[id] = fields;
    }
    if (!Object.keys(rows).length) return null;
    await projectSecretStore.patchMany(rows, { weak: true, fillOnly: true });
    await projectSecretStore.idle();
    /* IN THE PROJECTS' QUEUE (E36 fix e1-G5, 25.10.2026; finding F2): read and written whole in one step of
       `COUNTDOWNS_KEY`, as every step of projects.mjs `applyProjectChange` writes projectMeta, so a change landing
       during the load's lift is neither written over nor writes over it. */
    const { lifted, kept } = await serialWrite(COUNTDOWNS_KEY, async () => {
        const next = foundry.utils.deepClone(projectMeta());
        let moved = 0, left = 0;
        for (const [id, fields] of Object.entries(rows)) {
            const held = projectSecretStore.persisted(id) ?? {};
            for (const field of Object.keys(fields)) {
                if (Object.hasOwn(held, field)) {
                    if (next[id] && typeof next[id] === "object") delete next[id][field];
                    moved++;
                } else left++;
            }
        }
        if (moved) await game.settings.set(MODULE_ID, SETTINGS.projectMeta, next);
        return { lifted: moved, kept: left };
    });
    const left = Object.values(projectMeta())
        .reduce((n, row) => n + PROJECT_SECRET_FIELDS.filter(f => row && typeof row === "object" && Object.hasOwn(row, f)).length, 0);
    if (lifted) log(`Lifted ${lifted} project secret field(s) out of world data (D3); ${left} left.`);
    // The armed map was built from the world's copy; the next event rebuilds it from the store.
    (await import("./traps.mjs")).forgetArmedTraps();
    if (left) throw new Error(`${left} project secret field(s) are still in projectMeta (${kept} the GM store did not read back); the next load tries again`);
    return { lifted, kept, emptied: true };
}
