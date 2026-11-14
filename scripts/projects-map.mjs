/**
 * Danganronpa RPG - a project's place on the map.
 * ---------------------------------------------------------------------------
 * A project used to be a bar on a tray and a room name in its metadata. The
 * barricade being built in the Library existed nowhere the table could point
 * at, which for a game argued in rooms is the wrong half of the object to have
 * ("projekty jako większe tokeny na mapie", Dawid, 16.09).
 *
 * So a project with a room gets a token: two squares, scenery-coloured, under
 * the cast and over the traces. One a GM can drag, because the centre of a
 * region is where a project goes when nobody has said otherwise, not where it
 * belongs - a barricade belongs in the doorway.
 *
 * WHAT THE DOCUMENT IS ALLOWED TO CARRY, and this is the whole security of the
 * feature. A Token document reaches EVERY browser on the scene, whatever its
 * ownership - Foundry uses ownership for control, not for sight, and the
 * `hidden` flag says "GM only", which cannot express "these three players". So
 * the token carries a neutral name, one countdown id and, since 13.11.2026, the
 * picture of the project's chosen glyph (`projectTokenIcon`, below: the owner's
 * choice, accepted as a trade-off - the glyph a world setting already gives every
 * browser), and that picture's path again in a second flag, `projectIconWritten`
 * (`PROJECT_ICON_FLAG`, below: the picture the module last wrote, so the sync can
 * tell its own picture from a GM's), and nothing else. That flag holds no secret: its
 * value is the token's own `texture.src`, which every browser on the scene already
 * reads off the texture. The id adds nothing a console does not already hold: the
 * Countdowns setting it points into - the name, the progress and the ownership
 * map - is a world setting every browser holds, so a secret project is hidden
 * from the interface, not from the console (audit S09-05; the killer and the
 * trap's condition are the GMs' since E05, the name moves in E43). The same
 * contract Remnants have run on since the crime-scene names were taken off the
 * map.
 *
 * WHO SEES IT is `knowsProject` in projects.mjs, applied per client by
 * visibility.mjs - one predicate, no state of its own. A secret project's
 * token is hidden from everyone not in on it; a public one is hidden until you
 * have stood in its room, and stays visible afterwards, because knowledge does.
 */

import { MODULE_ID, PROJECT_TOKEN, isProjectGlyph } from "./config.mjs";
import { roomOf, setProjectMeta, tokenRefOf, allProjects, isComplete, knowsProject, isSecret, applyProjectChange }
    from "./projects.mjs";
import { metaFor, rawCountdown, COUNTDOWNS_KEY } from "./projects-secrecy.mjs";
import { boundsOf, roomAt } from "./movement.mjs";
import { sceneOfRoom, isMoveChange, roomRegions } from "./rooms.mjs";
import { log, error, whisperToGms, esc, plural, isPrimaryGm, serialWrite } from "./utils.mjs";
// The card a project token opens stays true while it is open (E44 C9). live.mjs imports config.mjs and utils.mjs alone (R161).
import { keepLive } from "./live.mjs";
// What a player saw last (PV): the card's bar as its reader last saw it. It does not import this file.
import { asSeen } from "./projects-seen.mjs";
import { discoveryStore, fogCopy, projectSecretStore } from "./gm-stores.mjs";

/** The actor every project token is an unlinked copy of. */
const PROJECT_ACTOR = "DRPG Project";

/*
 * A TOKEN'S RECORD IN THE PROJECTS' QUEUE (E36 fix e1-G5, 25.10.2026; findings F2, audit S17-18). A project's
 * `tokenId`, `tokenScene` and `mapHidden` live in projectMeta, which projects-secrecy.mjs `setProjectMeta` reads
 * and writes back whole - as every step of projects.mjs `applyProjectChange` does for its own rows. Since E36 C4
 * every change ends with a token sync outside the queue, while the next step is already under way, so either
 * write could put back the other's copy: a shown project kept off the map again and its reference lost, or a
 * finished repair's row brought back (E36-T10 at daf5600c: "Show on the map" written while a step held
 * projectMeta, its mark and reference gone once the step wrote). Each is a step of `COUNTDOWNS_KEY` of its own
 * now, reading projectMeta where it writes it. Never called from inside a step (it would wait behind itself):
 * this file's writers run after one, from the sync and the hooks.
 */
function writeTokenRecord(countdownId, patch) {
    return serialWrite(COUNTDOWNS_KEY, () => setProjectMeta(countdownId, patch));
}

/* Isometric Perspective's scope and the flag it sizes a token's picture by. Written only
   while that module is on: its flags are its own, and a scope that is not active is not
   one to write into. */
const ISO_MODULE = "isometric-perspective";
const isoOn = () => Boolean(game.modules?.get(ISO_MODULE)?.active);

/** The flag that ties a project token to its countdown. Everything else is looked up. */
export const PROJECT_TOKEN_FLAG = "projectId";

/* The picture the module last wrote on the token (REVIEW-111 1, 13.11.2026): the sync moves the token's picture only
   while it is this one, the hammer or the hazard sign, so a GM's own picture stays even when it is one of the module's
   glyph files. The value is the token's own `texture.src` as the module wrote it - no more than the texture already
   tells every browser on the scene. */
const PROJECT_ICON_FLAG = "projectIconWritten";

/* The option every deletion of a project token by the module passes (E11 C8), so the
   `deleteToken` hook below tells them from a GM's own Delete: a project the module took
   off the map is not a project a GM wants kept off it. That the option is what keeps them
   apart is not measured: with it dropped from `removeProjectToken` the suite's "deleted by
   hand" test still passed (10.10.2026), because the hook's mark was then overwritten by
   `removeProjectToken`'s own `setProjectMeta`, read before the mark landed - a lost update
   that hid the harm, not a guarantee. */
const MODULE_REMOVAL = "drpgProjectRemoval";

/* The option the module's own move of a project token passes (E36 C4), as `MODULE_REMOVAL` is
   its deletion's: `syncProjectToken` taking a token to its project's room is no GM's drag, and
   `onProjectTokenMoved` reading it as one would move the project to wherever the token was read
   to land - a room read wrong (S09-12, until E15 part 1 C1) would then carry the project off. */
const MODULE_MOVE = "drpgProjectMove";

/** Is this token document one of ours, and which project is it? */
export function projectIdOf(tokenDoc) {
    try {
        return tokenDoc?.getFlag?.(MODULE_ID, PROJECT_TOKEN_FLAG) ?? null;
    } catch {
        return null;
    }
}

/* ---- the shared actor ------------------------------------------------------
   One npc, every project token an unlinked copy of it, exactly as Remnants do.
   OBSERVER by default so a player's client can render the token at all; what
   they are allowed to SEE is decided per client, not by this level. */
const PROJECT_OWNERSHIP = CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;

/**
 * THE SHARED ACTOR, FOUND BY ITS FLAG (E05 C14, 27.09.2026; audit S05-41), as the
 * Remnants' is (remnants.mjs `findRemnantActor`): it was looked up by its name, and a
 * GM's own actor called "DRPG Project" was raised to OBSERVER for every player at the
 * next scene draw. `PROJECT_TOKEN_FLAG` decides - the base actor carries it as `true`,
 * the tokens as their countdown's id - and the name is asked only when no actor carries
 * it, and only of one that holds nothing (no item, no effect). Pure over what it is
 * handed, so the suite drives it with fakes.
 */
export function findProjectActor(actors = game.actors) {
    const all = [...(actors ?? [])];
    const count = c => c?.size ?? c?.length ?? 0;
    return all.find(actor => actor?.getFlag?.(MODULE_ID, PROJECT_TOKEN_FLAG))
        ?? all.find(actor => actor?.name === PROJECT_ACTOR && !count(actor.items) && !count(actor.effects)) ?? null;
}

async function ensureProjectActor() {
    let actor = findProjectActor();
    if (actor) {
        /* The base actor moves off the hazard sign with its tokens - only from the exact
           old default, since an image a GM chose on purpose is a choice (the Remnants'
           `adoptQuestionMark` rule). */
        if (game.user.isGM && actor.img === PROJECT_TOKEN.oldIcon) {
            try {
                await actor.update({ img: PROJECT_TOKEN.icon });
            } catch (err) {
                error("Could not move the Project actor onto the hammer", err);
            }
        }
        if (game.user.isGM && (actor.ownership?.default ?? 0) < PROJECT_OWNERSHIP) {
            try {
                await actor.update({ "ownership.default": PROJECT_OWNERSHIP });
            } catch (err) {
                error("Could not raise the Project actor's ownership", err);
            }
        }
        return actor;
    }
    if (!game.user.isGM) return null;

    try {
        actor = await Actor.create({
            name: PROJECT_ACTOR,
            type: "npc",
            img: PROJECT_TOKEN.icon,
            ownership: { default: PROJECT_OWNERSHIP },
            flags: { [MODULE_ID]: { [PROJECT_TOKEN_FLAG]: true } }
        });
        log("Created the Project actor.");
        return actor;
    } catch (err) {
        error("Could not create the Project actor", err);
        return null;
    }
}

/* ---- where a project stands ------------------------------------------------ */

/**
 * The middle of a room, in scene pixels, or null when the room cannot be found.
 *
 * `boundsOf` (movement.mjs) already knows the three places region geometry can
 * live depending on whether the scene is rendered - reusing it is what keeps
 * this file from being a fourth opinion about where a room is.
 *
 * The token is placed so its CENTRE is the room's centre: a two-square token
 * anchored by its top-left corner would sit a square down and right of where a
 * GM expects, which on a small room is the difference between in it and out.
 */
function centreOfRoom(scene, room) {
    if (!scene || !room) return null;
    /* THE ROOM'S LARGEST PIECE (E12 fix r1-G5, 11.10.2026; review goal-r1 N1). This took the first
       region of the name, a Teleport's or a player's as readily as the room's, and of a room in
       pieces the first drawn, however small. The pieces are the room's (rooms.mjs), and the
       largest box is the one a two-square token most likely fits. */
    const boxes = roomRegions(scene, room).map(boundsOf).filter(Boolean);
    const box = boxes.reduce((best, b) => (!best || b.w * b.h > best.w * best.h ? b : best), null);
    if (!box) return null;
    const grid = scene.grid?.size ?? canvas?.grid?.size ?? 100;
    const half = (PROJECT_TOKEN.size * grid) / 2;
    return { x: Math.round(box.x + box.w / 2 - half), y: Math.round(box.y + box.h / 2 - half) };
}

/**
 * THE ROOM A PROJECT TOKEN STANDS IN, read one way for the drag and the sync (E36 C4). `at` is
 * where its top-left corner is, the token's own place unless a move names another.
 *
 * ONE CENTRING (E15 part 1 C1, 25.10.2026; audit S09-12). `roomAt` takes a token's corner and
 * tests its centre itself (movement.mjs `regionsAt`, with the token's own scene's grid). This
 * added half the token first, so the point tested was the token's lower right corner: a
 * two-square token dropped with its centre inside a room's east or south wall read the room
 * beyond, or no room, and its project was moved there or left where it was. Tier 2 E15-T1 at
 * d90687dc: a token dropped with its centre a quarter square inside the east wall of Dorm A
 * left its project in the Cafeteria it came from; the room every other rule reads for the token
 * (`roomOfToken`, the same `roomAt` from the corner) was Dorm A. The drag and the sync ask this
 * one reader, so the two still agree.
 */
function roomUnder(tokenDoc, at = tokenDoc) {
    return roomAt(at.x ?? tokenDoc.x, at.y ?? tokenDoc.y, tokenDoc);
}

/**
 * Nudged, so two projects in one room do not stack exactly.
 *
 * Deliberately small and deliberately not a layout: a spiral that guaranteed
 * no overlap would be a packing algorithm nobody asked for, and a GM who cares
 * where a project stands can drag it. This only makes "there are two of them"
 * visible at a glance.
 */
function offsetFor(scene, room, countdownId) {
    const grid = scene.grid?.size ?? canvas?.grid?.size ?? 100;
    const others = (allProjects() ?? [])
        .filter(p => p.id !== countdownId && roomOf(p.id) === room && tokenRefOf(p.id))
        .length;
    const step = Math.round(grid * 0.75);
    return { dx: (others % 3) * step, dy: Math.floor(others / 3) * step };
}

/* ---- placing, moving, removing --------------------------------------------- */

/* A finished project is still a thing standing in a room - the barricade got
   built - so its token stays and changes colour rather than going.
   `isComplete` takes a ROW from `allProjects()` rather than an id, on purpose
   (see its own note), so the row is looked up here and every caller of this
   keeps passing an id. */
function tintFor(countdownId) {
    const row = (allProjects() ?? []).find(p => p.id === countdownId);
    return isComplete(row) ? PROJECT_TOKEN.doneTint : PROJECT_TOKEN.workingTint;
}

/*
 * THE PICTURE IS THE PROJECT'S GLYPH (the owner's choice B, 13.11.2026). Every project token wore the neutral hammer
 * from 22.09 (PROJECT_TOKEN.icon), so the map said "a project" and never which; the owner chose the glyph a GM picks
 * for the project (config.mjs PROJECT_GLYPHS, the drawing the tray paints for its row) for every project, public and
 * secret, and accepted what that costs: a token document reaches every browser on its scene, so its texture tells
 * any console the project's kind, secret ones included - the glyph that projectMeta, a world setting every browser
 * holds, already gave it (docs/dev/project-token-icon/STATUS.md, the GM handbook's note on what lives only in the
 * GMs' browsers). Who SEES the token is still `knowsProject` through visibility.mjs. The file is the glyph's, one per
 * key, written by tools/token-icons.mjs from the same sprite the tray paints (icons/project-<key>.svg, white, tinted by
 * the document as the hammer was). A project with no glyph - one made before glyphs, or in Daggerheart's own window -
 * keeps the hammer.
 */
/** The picture a project's token wears: its glyph's file, or the hammer for a project with none. The path is one
 *  template, so tools/check.mjs's `package` part reads it as the reader of icons/project-*.svg (a prefix kept in a
 *  constant read as no path, and the 21 files as shipped with no reader; 13.11.2026, after the e59-c5a merge). */
export function projectTokenIcon(countdownId) {
    const glyph = metaFor(countdownId).glyph;
    return isProjectGlyph(glyph) ? `modules/${MODULE_ID}/icons/project-${glyph}.svg` : PROJECT_TOKEN.icon;
}

/**
 * Is the token's picture the module's to move: the one it last wrote there (`PROJECT_ICON_FLAG`), or the hammer or the
 * hazard sign a token placed before glyphs wears? A glyph's file the module did not write - a GM's own choice of the
 * lock for a project whose glyph is the key - is the GM's, and stays.
 */
function wearsModuleIcon(token) {
    // A token placed by 1de23ada or 5f074c16 (never released) wears a glyph's file with no flag, and is read as the GM's.
    const path = String(token?.texture?.src ?? "");
    return path === PROJECT_TOKEN.icon || path === PROJECT_TOKEN.oldIcon
        || (path.length > 0 && path === token?.getFlag?.(MODULE_ID, PROJECT_ICON_FLAG));
}

/** The live token document for a project, if its scene still has one. */
export function projectTokenOf(countdownId) {
    const ref = tokenRefOf(countdownId);
    if (!ref) return null;
    return game.scenes?.get(ref.sceneId)?.tokens?.get(ref.tokenId) ?? null;
}

/**
 * Put a project on the map. GM only, idempotent, and quiet about failure.
 *
 * Returns null rather than throwing for every ordinary reason a project has no
 * token: no room ("abstract work anywhere"), no scene, or a scene whose regions
 * do not include the room the project names. None of those is a fault - they
 * are projects that simply do not have a place, and the tray is still their
 * home.
 */
export async function placeProjectToken(countdownId, { scene = null } = {}) {
    if (!game.user.isGM || !countdownId) return null;
    if (projectTokenOf(countdownId)) return projectTokenOf(countdownId);

    const room = roomOf(countdownId);
    if (!room) return null;

    /* ON THE ROOM'S SCENE (E12 C5, 1.2.74; plan-E12 C5). This placed the token on the scene the GM's
       camera showed, else the one the GM's own client had drawn, so a project whose room is on another
       scene had no token until the primary GM looked there (read in the code; no reading of a table).
       The room's scene is the school's when it has the room, else the first place scene that does
       (rooms.mjs `sceneOfRoom`). */
    const target = scene ?? sceneOfRoom(room);
    if (!target) return null;

    const spot = centreOfRoom(target, room);
    if (!spot) return null;
    const nudge = offsetFor(target, room, countdownId);

    const actor = await ensureProjectActor();
    if (!actor) return null;

    try {
        const [created] = await target.createEmbeddedDocuments("Token", [{
            /* NEUTRAL, because this reaches every browser. The project's real
               name is in the countdown, hidden from the interface and not from
               the console (S09-05); anybody allowed to know reads it from there
               (`remnant-ring.mjs` does the same for traces). */
            name: game.i18n.localize("DRPG.Project.tokenName"),
            actorId: actor.id,
            actorLink: false,
            x: spot.x + nudge.dx,
            y: spot.y + nudge.dy,
            width: PROJECT_TOKEN.size,
            height: PROJECT_TOKEN.size,
            texture: {
                src: projectTokenIcon(countdownId),
                tint: tintFor(countdownId)
            },
            alpha: PROJECT_TOKEN.alpha,
            sort: PROJECT_TOKEN.sort,
            /* NOT hidden. Foundry's own flag means "GM only", and what this
               needs is "the people who know" - which only a client can decide.
               Same arrangement, and same reason, as an incident's own traces. */
            hidden: false,
            flags: {
                [MODULE_ID]: { [PROJECT_TOKEN_FLAG]: countdownId, [PROJECT_ICON_FLAG]: projectTokenIcon(countdownId) },
                ...(isoOn() ? { [ISO_MODULE]: { scale: PROJECT_TOKEN.isoScale } } : {})
            }
        }]);
        if (!created) return null;
        await writeTokenRecord(countdownId, { tokenId: created.id, tokenScene: target.id });
        return created;
    } catch (err) {
        error(`Could not put the project ${countdownId} on the map`, err);
        return null;
    }
}

/** Take a project off the map, and forget where it was. GM only. */
export async function removeProjectToken(countdownId) {
    if (!game.user.isGM || !countdownId) return false;
    const ref = tokenRefOf(countdownId);
    if (!ref) return false;

    try {
        const scene = game.scenes?.get(ref.sceneId);
        if (scene?.tokens?.get(ref.tokenId)) {
            await scene.deleteEmbeddedDocuments("Token", [ref.tokenId], { [MODULE_REMOVAL]: true });
        }
    } catch (err) {
        error(`Could not take the project ${countdownId} off the map`, err);
    }
    /* The reference is cleared whether or not the delete worked: a token that
       is already gone and a token that refused to go both leave this project
       without one, and a stale id would stop it ever being placed again. */
    await writeTokenRecord(countdownId, { tokenId: null, tokenScene: null });
    return true;
}

/* ---- tokens no project owns ----------------------------------------------------
   E11 C7, 1.2.73; audit S06-23, S07-27, S09-21; the ask A2. The season reset cleared the
   countdowns and the metadata and removed no token: measured in scenario 65 at 4aad1fd
   (10.10.2026), the four project tokens of a played season - two projects, a duplicate and
   an orphan - all stood on their scenes after the reset, and p1 read the orphan's id as a
   project it knew (`knowsProject`, now false for an id with no countdown). A token is found by
   what it is, not by what the metadata says of it: the metadata is exactly what a reset, a
   deletion or Daggerheart's own countdown window leaves behind, so the tokens' own flag is
   the only record that is still there afterwards. */

/** Every project token on these scenes: one carrying a project's id, or a copy of the shared actor carrying none. */
export function projectTokensOn(scenes = game.scenes) {
    const base = findProjectActor()?.id ?? null;
    const found = [];
    for (const scene of scenes ?? []) {
        for (const token of scene?.tokens ?? []) {
            const id = projectIdOf(token);
            const projectId = typeof id === "string" && id ? id : null;
            if (!projectId && !(base && token.actorId === base)) continue;
            found.push({ sceneId: scene.id, tokenId: token.id, projectId });
        }
    }
    return found;
}

/**
 * WHICH OF THESE TOKENS GO, AND WHICH ARE A LIVE PROJECT'S SPARE (E11 C7; the plan's 3.2).
 * Pure over what it is handed: `tokens` as `projectTokensOn` lists them, `liveIds` the
 * projects that exist, `refOf(id)` the `{ sceneId, tokenId }` a project's metadata names.
 * A token whose id is not live, or that carries none, is an orphan - nobody's project, so
 * nobody's to see (D12: always removed). More than one token for one live project are
 * duplicates: the one its metadata names is kept (the first found when it names none of
 * them), and the others are listed and never removed - a GM may have placed one by hand
 * on purpose, and which of two copies is the mistake is not this function's to guess.
 * @returns {{ orphans: object[], duplicates: object[] }} duplicates: the spare tokens alone
 */
export function projectTokenPlan(tokens, liveIds, refOf = () => null) {
    const live = new Set(liveIds ?? []);
    const orphans = [], byProject = new Map();
    for (const token of tokens ?? []) {
        if (!token?.projectId || !live.has(token.projectId)) { orphans.push(token); continue; }
        if (!byProject.has(token.projectId)) byProject.set(token.projectId, []);
        byProject.get(token.projectId).push(token);
    }
    const duplicates = [];
    for (const [projectId, own] of byProject) {
        if (own.length < 2) continue;
        const ref = refOf(projectId);
        const kept = own.find(t => ref && t.sceneId === ref.sceneId && t.tokenId === ref.tokenId) ?? own[0];
        duplicates.push(...own.filter(t => t !== kept));
    }
    return { orphans, duplicates };
}

/**
 * Remove the orphans among the project tokens on `scenes`, scene by scene. GM only. `live`
 * is the projects that exist (every countdown, unless the caller knows better - the reset
 * passes none, a deletion passes none for its own id); `only`, when given, limits the
 * sweep to the tokens of those ids, so deleting one project touches nothing of another.
 * A live project's duplicates are told to the GM and kept (`warnProjectDuplicates`).
 * @returns {Promise<{ removed: number, duplicates: object[] }>}
 */
export function sweepProjectTokens(options = {}) {
    /* ONE SWEEP AT A TIME (E11 C8). From 1.2.73 the primary sweeps at every scene draw and
       once more in the migration, and at the first ready after the upgrade both start
       together (`runMigrationOnLoad` and the sync deferred to `ready`): two sweeps that list
       the same orphan before either has deleted it ask Foundry twice to delete one token.
       Queued, the second lists what the first left. Read, not measured at a table. Since E11 fix
       r2-H5 the sync waits for the load's pass (`syncProjectTokens`), so those two no longer
       meet at that ready; the queue still orders a pass begun by hand beside a scene draw. */
    const run = sweepQueue.then(() => sweepOnce(options));
    sweepQueue = run.catch(() => null);
    return run;
}
let sweepQueue = Promise.resolve();

async function sweepOnce({ live = allProjects().map(p => p.id), scenes = game.scenes, only = null } = {}) {
    if (!game.user.isGM) return { removed: 0, duplicates: [] };
    const limit = only ? new Set(only) : null;
    const tokens = projectTokensOn(scenes).filter(t => !limit || limit.has(t.projectId));
    const { orphans, duplicates } = projectTokenPlan(tokens, live, tokenRefOf);
    let removed = 0;
    for (const scene of scenes ?? []) {
        const ids = orphans.filter(t => t.sceneId === scene.id && scene.tokens?.get(t.tokenId)).map(t => t.tokenId);
        if (!ids.length) continue;
        // Counted by what is gone afterwards, not by what the call returns: the harness's shim returns
        // an empty list from every deletion, and the first run counted 0 for an orphan it had removed.
        try {
            await scene.deleteEmbeddedDocuments("Token", ids, { [MODULE_REMOVAL]: true });
        } catch (err) {
            error(`Could not take ${ids.length} project token(s) without a project off ${scene.name}`, err);
        }
        removed += ids.filter(id => !scene.tokens?.get(id)).length;
    }
    if (removed) log(`Project tokens: ${removed} without a project removed.`);
    if (duplicates.length) warnProjectDuplicates(duplicates);
    return { removed, duplicates };
}

/**
 * Tell the GM which live projects stand on the map more than once, and where: one
 * notification for the lot, naming each project and the scenes its spare tokens are on.
 * Removes nothing (D12). The GM's alone - a project's name is the countdown's, which a
 * player may not be in on.
 * @returns {string|null} what was told
 */
function warnProjectDuplicates(duplicates) {
    if (!game.user.isGM || !duplicates?.length) return null;
    const names = new Map(allProjects().map(p => [p.id, p.name]));
    const where = new Map();
    for (const { projectId, sceneId } of duplicates) {
        if (!where.has(projectId)) where.set(projectId, new Set());
        where.get(projectId).add(game.scenes?.get(sceneId)?.name ?? sceneId);
    }
    const list = [...where].map(([id, scenes]) => `${names.get(id) ?? id} (${[...scenes].join(", ")})`).join("; ");
    const told = plural("DRPG.Project.duplicates", { n: duplicates.length, list });
    ui.notifications?.warn(told);
    return told;
}

/**
 * The tint follows the bar, and the picture the glyph. Cheap enough to call on every project change, and
 * it writes only when the colour or the picture would actually differ. Answers whether it wrote.
 * The opacity follows `PROJECT_TOKEN.alpha` the same way (E44 C8b).
 */
export async function refreshProjectToken(countdownId) {
    if (!game.user.isGM) return false;
    const token = projectTokenOf(countdownId);
    if (!token) return false;
    const want = tintFor(countdownId);
    const changes = {};
    /* THE TINT IS A Color ON THE DOCUMENT, and a Color is never `===` a string: this
       compared an object with "#d8c98a" and wrote the tint of every project token on
       every scene draw, for as long as it has existed (found 22.09). The Color prints
       as its hex, which is what `want` is. */
    if (String(token.texture?.tint ?? "") !== want) changes["texture.tint"] = want;
    /* THE PICTURE FOLLOWS THE GLYPH (13.11.2026): a token wearing the picture the module last wrote on it, the hammer,
       or the hazard sign a token placed before 1.2.53 still wears, is moved to its project's (`projectTokenIcon`) on
       the next sync, and so when a GM changes the glyph, whose change ends in this sync; the flag records what it wrote.
       A picture a GM put on the token is the GM's, and stays, a glyph's own file among them (REVIEW-111 1). */
    const icon = projectTokenIcon(countdownId);
    if (token.texture?.src !== icon && wearsModuleIcon(token)) {
        changes["texture.src"] = icon;
        changes[`flags.${MODULE_ID}.${PROJECT_ICON_FLAG}`] = icon;
    }
    /* A token placed before 1.2.99 stands at 0.7, which the owner turned to full opacity (E44 C8b, 04.11.2026;
       config.mjs PROJECT_TOKEN.alpha); the sync brings it up as it brings the tint - a GM's own alpha on it as well. */
    if (token.alpha !== PROJECT_TOKEN.alpha) changes.alpha = PROJECT_TOKEN.alpha;
    /* A token placed before 1.2.51 has the picture at full size; the sync that runs on
       every scene draw brings it down to the one that fits its frame. */
    if (isoOn() && token.getFlag?.(ISO_MODULE, "scale") !== PROJECT_TOKEN.isoScale) {
        changes[`flags.${ISO_MODULE}.scale`] = PROJECT_TOKEN.isoScale;
    }
    if (!Object.keys(changes).length) return false;
    try {
        await token.update(changes);
        return true;
    } catch (err) {
        error(`Could not refresh the project token for ${countdownId}`, err);
        return false;
    }
}

/**
 * A project token standing in another room than its project's goes to its project's room (E36 C4;
 * audit S09-19). Within its scene when that scene holds the room - to the room's centre, nudged as a
 * new token is, and only when it stands in another ROOM: a token a GM put in a doorway or a corridor
 * stands in no room, and stays where it was put, as the drag leaves it. Onto the room's scene when its
 * own holds no piece of the room (taken off and placed again: a token does not change scenes). A room no
 * scene holds leaves the token where it is, there being nowhere to take it. Answers whether it moved.
 */
async function moveProjectToken(countdownId, token, room) {
    if (!game.user.isGM) return false;
    const scene = token.parent ?? null;
    if (!scene) return false;
    if (!centreOfRoom(scene, room)) {
        if (!sceneOfRoom(room)) return false;
        await removeProjectToken(countdownId);
        return Boolean(await placeProjectToken(countdownId));
    }
    const stands = roomUnder(token);
    if (!stands || stands === room) return false;
    const spot = centreOfRoom(scene, room);
    const nudge = offsetFor(scene, room, countdownId);
    const to = { x: spot.x + nudge.dx, y: spot.y + nudge.dy };
    if (token.x === to.x && token.y === to.y) return false;
    try {
        await token.update(to, { [MODULE_MOVE]: true, teleport: true, movementAction: "displace", animate: false });
        return true;
    } catch (err) {
        error(`Could not take the project ${countdownId}'s token to ${room}`, err);
        return false;
    }
}

/**
 * ONE PROJECT'S TOKEN, PUT RIGHT (E36 C4, 25.10.2026; the stage's E36-14, audit S09-19). Its presence:
 * a project with a room has one (placed when missing, unless a GM took it off the map by hand -
 * `mapHidden`), one with no room has none, and the tokens of a project that no longer exists go,
 * every copy, found by their own flag (`sweepProjectTokens`). Its place: moved into its project's room
 * when it stands in another (`moveProjectToken`). Its colour: the bar's (`refreshProjectToken`).
 * `applyProjectChange` (projects.mjs) calls this once after each change of a project, on the primary
 * GM's browser where the change ran, and the scene draw's `syncProjectTokens` calls it for each
 * project: until E36 a token was put right only at a scene draw, so a room changed in the manager left
 * it in the old room, a finished project kept its working colour and createProject placed it on the
 * browser of whichever GM made it. Every other road to a project's token is this one or the sweep (the
 * census, R977). GM only; before the game is ready nothing is written (the scene draw's sync waits for
 * ready and runs this then). Answers how many things it put right, as `syncProjectTokens` counts them.
 */
export async function syncProjectToken(countdownId) {
    if (!game.user.isGM || !countdownId || !game.ready) return 0;
    /* ONE SYNC OF A PROJECT AT A TIME (E36 fix e1-G5, 25.10.2026; finding F3). A token is found through the
       project's record alone (`projectTokenOf`), so a scene draw's sync and a change's sync of one project, both
       reading "no token" before either had placed one, placed two (E36-T10 at daf5600c, two syncs at once). Queued
       per project: the second reads what the first put right. Another project's sync does not wait. */
    return serialWrite(`projectToken/${countdownId}`, () => syncOneProjectToken(countdownId));
}

/** `syncProjectToken`'s work, one project, in its own queue. */
async function syncOneProjectToken(countdownId) {
    if (!rawCountdown(countdownId)) {
        const { removed } = await sweepProjectTokens({ live: [], only: [countdownId] });
        return removed;
    }
    if (metaFor(countdownId).mapHidden) return 0;
    let touched = 0;
    const ref = tokenRefOf(countdownId);
    let live = projectTokenOf(countdownId);
    // A reference pointing at a token that went without a `deleteToken` the primary heard
    // (a scene deleted, if Foundry fires none for its tokens - not measured): forgotten,
    // and placed again below.
    if (ref && !live) {
        await writeTokenRecord(countdownId, { tokenId: null, tokenScene: null });
        touched++;
    }
    const room = roomOf(countdownId);
    if (!room) {
        /* A secret project's room is the GMs' row's since leak-pm (14.11.2026: projects.mjs `roomOf`): before the other
           GMs' copies are here a row this browser lacks reads no room, which is not a project that lost one. */
        if (live && isSecret(countdownId) && !projectSecretStore.isHydrated()) return touched;
        // It lost its room: it has no place, so it has no token.
        if (live) { await removeProjectToken(countdownId); touched++; }
        return touched;
    }
    if (!live) return touched + (await placeProjectToken(countdownId) ? 1 : 0);
    if (await moveProjectToken(countdownId, live, room)) touched++;
    live = projectTokenOf(countdownId);
    if (live) await refreshProjectToken(countdownId);
    return touched;
}

/**
 * A GM dragged a project's token into a different room, so the project moved.
 *
 * THE PROJECT FOLLOWS THE TOKEN, and the alternative was worse in both
 * directions. Snapping the token back makes the map lie about where a GM just
 * put something; letting the two diverge gives one object two places, which is
 * the exact failure this module keeps finding and fixing. Moving the project is
 * the only one of the three that leaves a single answer - and it is announced,
 * so it is an affordance rather than a trap, and it is undone by dragging back.
 *
 * Only the room changes. Who may work on it, whether it is secret and who can
 * see it are untouched: this is a fact about where, not about whom.
 *
 * ON THE PRIMARY, AND ONLY FOR THE PROJECT'S OWN TOKEN (E11 C8, 1.2.73; the plan's 3.2).
 * `updateToken` fires on every GM's browser and every GM ran this; the primary alone now
 * does, as it alone keeps the map (`syncProjectTokens`). That a second GM's run did harm is
 * not measured: scenario 65 G3 at 80ba2a5 (10.10.2026), a second GM dragging, counted one
 * write of the metadata and one whisper on the primary either way. What was measured: any
 * token carrying a project's id moved its project - at 80ba2a5 a spare copy's drag moved the
 * project to the Cafeteria and an orphan's drag wrote a metadata row for a countdown that
 * does not exist (the suite's "dragging a project's spare copy" test). `projectOwning` answers both.
 */
async function onProjectTokenMoved(tokenDoc, changes, options = {}) {
    if (!isPrimaryGm() || options?.[MODULE_MOVE]) return;
    // A change of floor is a move (rooms.mjs `isMoveChange`, E12 C9): x and y alone missed a climb.
    if (!isMoveChange(changes)) return;
    const id = projectOwning(tokenDoc);
    if (!id) return;

    const landedIn = roomUnder(tokenDoc, changes);
    const was = roomOf(id);
    if (!landedIn || landedIn === was) return;

    // One change of the entry (E36 C2; audit S17-18): a GM's edit or a room's rename queued meanwhile is not lost to it.
    await applyProjectChange(id, { meta: { room: landedIn } }, { by: { kind: "gm" } });
    const name = allProjects().find(p => p.id === id)?.name ?? id;
    await whisperToGms(`<p>${game.i18n.format("DRPG.Project.tokenMoved", {
        project: esc(name), from: esc(was ?? "-"), to: esc(landedIn)
    })}</p>`);
    log(`Project ${id} moved from ${was ?? "nowhere"} to ${landedIn} by its token.`);
}

/**
 * THE LIVE PROJECT WHOSE OWN TOKEN THIS IS, or null (E11 C8). A token of no project, of a
 * project whose countdown is gone (an orphan), or a copy other than the one the project's
 * metadata names (a spare) is nobody's map token: its move moves nothing and its deletion
 * hides nothing. Pure over the two readers it is handed, so the suite drives it with fakes.
 */
export function projectOwning(tokenDoc, { isLive = id => Boolean(rawCountdown(id)), refOf = tokenRefOf } = {}) {
    const id = projectIdOf(tokenDoc);
    if (typeof id !== "string" || !id || !isLive(id)) return null;
    const ref = refOf(id);
    return ref && ref.tokenId === tokenDoc.id && ref.sceneId === tokenDoc.parent?.id ? id : null;
}

/* Hand deletions still being written down, by project: the sync waits for them (as the
   Remnants' tombstones are held until written, remnants.mjs `tombstoning`). */
const hiding = new Map();

/**
 * A GM DELETED A PROJECT'S TOKEN, SO THE PROJECT STAYS OFF THE MAP (E11 C8, 1.2.73; audit
 * S09-47). The sync put every project with a room back on the map at the next scene draw,
 * so a token a GM deleted came back (scenario 65 G1 at 80ba2a5, 10.10.2026: the Annex's
 * project's token, deleted by hand, stood on the Annex again after one `canvasReady`). The primary marks the
 * project `mapHidden` and forgets the token; the sync skips a hidden project, and the
 * manager's "Show on the map" clears the mark. The module's own deletions pass
 * `MODULE_REMOVAL` (and the reset's `drpgReset`) and are not a GM's choice. Deleting one of
 * two copies of a project hides nothing: the other becomes the project's token - the
 * duplicates' warning tells the GM to delete the spare by hand, and which copy goes is theirs.
 */
function onProjectTokenDeleted(tokenDoc, options) {
    if (options?.[MODULE_REMOVAL] || options?.drpgReset || !isPrimaryGm()) return;
    const id = projectOwning(tokenDoc);
    if (!id) return;
    const other = projectTokensOn(game.scenes).find(t => t.projectId === id && t.tokenId !== tokenDoc.id);
    const patch = other
        ? { tokenId: other.tokenId, tokenScene: other.sceneId }
        : { mapHidden: true, tokenId: null, tokenScene: null };
    const done = writeTokenRecord(id, patch)
        .then(() => log(other ? `Project ${id}: its other token stands for it now.` : `Project ${id} kept off the map: its token was deleted by hand.`))
        .catch(err => error(`Could not keep the project ${id} off the map`, err))
        .finally(() => { if (hiding.get(id) === done) hiding.delete(id); });
    hiding.set(id, done);
}

/** The manager's "Show on the map": a project a GM deleted from the map goes back on it. GM only. */
export async function showProjectOnMap(countdownId) {
    if (!game.user.isGM || !rawCountdown(countdownId)) return null;
    await writeTokenRecord(countdownId, { mapHidden: false });
    /* On the scene that holds its room, whatever this GM is looking at (E12 C5): the one road to a token (E36 C4). */
    await syncProjectToken(countdownId);
    return projectTokenOf(countdownId);
}

let syncWaitingForReady = false;

/**
 * Bring the map into line with the projects. The primary GM's.
 *
 * Called on `canvasReady` rather than only at creation, because a project can
 * gain a room long after it was made, a scene can be swapped, and a token can
 * go missing - and in all three the tray and the map would otherwise disagree
 * until somebody reloaded. A token a GM deleted by hand is not missing: its
 * project is kept off the map (`onProjectTokenDeleted`, E11 C8).
 */
export async function syncProjectTokens() {
    /* `canvasReady` OUTRUNS `ready` AT BOOT (22.09), and a world setting may not be written
       before the game is ready: on Forge, with a project whose token had been deleted by
       hand, the very first sync threw "You may not set a World-level Setting before the Game
       is ready" and the reference stayed stale until the next scene change. Deferred rather
       than dropped, and once however many scene draws pile up before ready - the fog's seed
       learned the same thing (`seedDiscovery`). */
    if (!game.ready) {
        if (!syncWaitingForReady) {
            syncWaitingForReady = true;
            Hooks.once("ready", () => {
                syncWaitingForReady = false;
                syncProjectTokens().catch(err => error("Could not sync the project tokens", err));
            });
        }
        return 0;
    }
    /* ON THE PRIMARY ALONE (E11 C8, 1.2.73; audit S09-47). Every GM's scene draw ran this,
       so a GM other than the primary placed the tokens of projects the map was missing
       (scenario 65 G3 at 80ba2a5, 10.10.2026: the second GM's draw placed one), and two
       GMs drawing at once could each place one - a duplicate the map then keeps. That race
       is read, not measured. Whether a scene is drawn on the primary no longer matters (E12 C5):
       each project is placed on its room's scene, not on the drawn one (read in the code). */
    if (!isPrimaryGm()) return 0;
    /* AFTER THE LOAD'S MIGRATION (E11 fix r2-H5, 1.2.73; the round-2 review's COR2-5). At the
       first ready after the upgrade the migration's clause `sweepOldProjectTokens` is the sweep
       that tells the GM how many tokens of gone projects it removed; this sync, deferred from the
       boot's scene draw to the same ready, swept them first and said so to the console alone.
       Measured on the harness with Foundry's boot order replayed on the primary (the scene drawn
       before ready, then the module's ready, then the deferred sync; scenario 65 V2, 11.10.2026):
       one orphan, removed by the sync, the clause's report null and no toast - from a world
       stamped 1.2.66 (that one clause pending) and from one stamped 1.2.60 (24 pending) alike.
       The sync now waits for the pass this load started; with none running it waits for nothing. */
    await (await import("./migrate.mjs")).migrationOnLoad();
    // The base actor's own housekeeping (ownership, the hammer), when there is one to keep.
    if (findProjectActor()) await ensureProjectActor();
    await Promise.allSettled([...hiding.values()]);

    /* EVERY SCENE, NOT THE ONE DRAWN (E11 C8; the plan's 3.2 said "for that scene"). A spare
       is a second token of one project, and the two may stand on different scenes (65 G1's
       duplicate stands on the Annex, its project's token in the Academy): a sweep of the
       drawn scene alone sees one token of that project and nothing to warn of.
       Listing the tokens of every scene is a walk over documents the browser already holds. */
    const { removed } = await sweepProjectTokens();
    let touched = removed;
    // Each project as a change of it leaves it (E36 C4): one function, so the draw and a change cannot disagree.
    for (const project of allProjects() ?? []) touched += await syncProjectToken(project.id);
    if (touched) log(`Project tokens: ${touched} put right.`);
    return touched;
}

/* ---- what a project token opens ---------------------------------------------- */

/**
 * A project token's card, in place of Daggerheart's adversary sheet (Dawid, 21.09).
 *
 * The token is an unlinked copy of one shared `npc` actor, so a double-click opened
 * that actor's sheet: a stat block, two tabs, and the project's name squeezed into
 * a column one letter wide. Nothing on it was about a project. Dawid chose the
 * trace's answer - the window becomes a card - and this wears the trace card's frame
 * (`.drpg-remnant-card`, its header, its fact list) so the two read as one family.
 *
 * WHO SEES WHAT. A player gets what the tray already shows them: the name, the
 * progress and the room. The GM gets the rest - who may see it, who by now knows it
 * exists, the trigger if it is somebody's murder - and a door to the manager.
 *
 * ONLY FROM A TOKEN, AND ONLY IF YOU KNOW IT. The shared actor is OBSERVER for
 * every player, so it can be opened from the Actors directory with no token behind
 * it; taking "the first project token on the scene" for that sheet, as a trace's
 * card does, would hand a player a project they have never heard of. So the project
 * is read off the token the sheet belongs to and nothing else, and then asked of
 * `knowsProject` - the one predicate that also decides whether the token is drawn
 * for this client at all. Anything else gets a card that names no project.
 *
 * IN STEP WITH THE PROJECT WHILE IT IS OPEN (E44 C9, 04.11.2026; the owner: the description "zsynchronizowany z tym, co
 * napisano w ekranie tworzenia projektu oraz z edycja w zakladce projects"). The card is a live region (live.mjs
 * `keepLive`): a change of the project's row (projectMeta - the description, the room, the secrecy) or of the
 * Countdowns (the name, the bar, who may see it) draws it again on every browser that holds it open, each from what it
 * holds (a secret project's description, since E44 fix FG6, from the private card that told it: the region hears a card's
 * words stored as well), and `draw` asks `knowsProject` again each time - a player taken off a secret project sees the card that names
 * nothing. A discovery is heard since E43 (13.11.2026; E44's Open 96, R5204): the discovery record - the GMs' store, a
 * player's copy of it, each a client setting live.mjs hears by its handle - and a move settled on this browser
 * (movement.mjs `drpgRouteSettled`), so a card opened while this browser did not know its project turns into the
 * project's when its character walks in; until E43 only a second opening did. projectMeta and the Countdowns are world settings, so `updateSetting` reaches every browser with no socket of the module's (sync.mjs's
 * `SYNC.projects` redraws the tray, the sheets, the HUD and the visibility, never this sheet). One region an open card:
 * a render of the same sheet stops the region the last render started.
 */
function showProjectCard(app, element) {
    const actor = app?.document;
    if (!actor?.getFlag?.(MODULE_ID, PROJECT_TOKEN_FLAG)) return;

    const token = actor.isToken ? actor.token : null;
    const id = token ? projectIdOf(token) : null;
    const draw = () => {
        // As this reader last saw it (PV, 13.11.2026; the owner's rule #2): projects-seen.mjs `asSeen` asks `knowsProject`.
        const project = typeof id === "string" && knowsProject(id) ? asSeen(allProjects().find(p => p.id === id) ?? null) : null;
        return project ? projectCard(project) : unknownProjectCard(Boolean(token));
    };

    const body = element.querySelector(".window-content") ?? element;
    body.innerHTML = draw();
    wireProjectCard(body);
    liveCards.get(app)?.();
    liveCards.set(app, keepLive(app, {
        region: ".drpg-project-card",
        build: draw,
        // ... and a card's words stored (secret.mjs `drpgSecretStored`): a secret project's description reaches its players on one (E44 fix FG6).
        // ... and the discovery record and a move settled here, so a card opened while its project was unknown turns into it (E43; Open 96).
        watch: { settings: ["projectMeta"], settingKeys: [COUNTDOWNS_KEY], hooks: ["drpgSecretStored", "drpgRouteSettled", "drpgSeenChanged"], stores: [discoveryStore, fogCopy] },
        after: wireProjectCard
    }));
    // Sized for a stat block; this is a card, exactly as the trace's is - and a frame
    // later for the same reason: set inside the render hook, the application's own
    // first-render positioning overwrote it (see showRemnantCard).
    requestAnimationFrame(() => app.setPosition?.({ height: "auto", width: 480 }));
}

/** The live region each open card holds (`showProjectCard`), by its sheet: a later render stops the one before. */
const liveCards = new WeakMap();

/** A GM's door to the manager, on the card as drawn and on every redraw of it. */
function wireProjectCard(root) {
    if (!game.user.isGM) return;
    root?.querySelector?.("[data-drpg-project-manager]")?.addEventListener("click", async event => {
        event.preventDefault();
        const { openProjectManager } = await import("./projects-ui.mjs");
        await openProjectManager();
    });
}

/**
 * The card itself. Pure: everything it prints is handed to it or asked of game state. Exported for the suite (R1350).
 *
 * THE DESCRIPTION (E44 C9; Q-C9-1: everyone who knows the project, as its name): under the bar and before the facts, as
 * the trace card sets its words apart (`drpg-remnant-text` in a box), escaped and its line breaks kept; a project with
 * none - one made before 1.2.99, a repair - draws nothing there.
 */
export function projectCard(project) {
    const t = key => game.i18n.localize(key);
    const target = Number(project.start) || 0;
    const current = Math.max(0, Math.min(target || Infinity, Number(project.current) || 0));
    // A project this browser has never seen in its room (PV: projects-seen.mjs `asSeen`, `seen: "unknown"`): "?" and an empty bar.
    const unknown = project.seen === "unknown";
    const share = target > 0 && !unknown ? Math.round((current / target) * 100) : 0;
    const description = typeof project.description === "string" ? project.description.trim() : "";
    const seenNote = unknown ? "DRPG.Project.seenUnknown" : project.seen === "last" ? "DRPG.Project.seenAsLast" : null;

    const rows = [
        [t("DRPG.Project.cardProgress"), `${unknown ? "?" : current} / ${target}`
            + (seenNote ? ` <span class="notes">${esc(t(seenNote))}</span>` : "")],
        [t("DRPG.Project.room"), esc(project.room ?? t("DRPG.Project.anyRoom"))]
    ];
    let actions = "";
    if (game.user.isGM) {
        const status = project.complete ? "cardDone" : (project.frozen ? "cardFrozen" : "cardUnderway");
        rows.push([t("DRPG.Project.cardStatus"), esc(t(`DRPG.Project.${status}`))]);
        rows.push([t("DRPG.Project.cardSecrecy"),
            esc(t(isSecret(project.id) ? "DRPG.Project.cardSecret" : "DRPG.Project.cardPublic"))]);
        // The same predicate that draws the token for each of them - so this list and
        // what each player's map shows cannot disagree, but for the Mastermind's player, whose own
        // map knows every room and whom this lists by the record alone, so that a GM's shared
        // screen does not name them (projects.mjs `playsTheMastermind`, E17 fix p2-G3).
        const knownBy = game.users.filter(u => !u.isGM && knowsProject(project.id, u))
            .map(u => esc(u.name));
        rows.push([t("DRPG.Project.cardKnownBy"),
            knownBy.length ? knownBy.join(", ") : esc(t("DRPG.Project.cardKnownByNobody"))]);
        if (project.indirectMurder) {
            rows.push([t("DRPG.Project.indirect"),
                esc(project.condition || t("DRPG.Project.cardNoCondition"))]);
        }
        actions = `<footer class="drpg-project-card-actions">
            <button type="button" data-drpg-project-manager>${esc(t("DRPG.Project.cardOpenManager"))}</button>
        </footer>`;
    }

    return `<div class="drpg-panel drpg-remnant-card drpg-project-card">
        <header class="drpg-remnant-head">
            <span class="drpg-remnant-glyph" data-drpg-act="project" aria-hidden="true"></span>
            <div class="drpg-remnant-title"><h3>${esc(project.name ?? "")}</h3></div>
        </header>
        <div class="drpg-project-card-bar" role="progressbar" aria-label="${esc(t("DRPG.Project.cardProgress"))}"
             aria-valuemin="0" aria-valuemax="${target}"${unknown ? "" : ` aria-valuenow="${current}"`}><span style="width: ${share}%"></span></div>
        ${description ? `<section class="drpg-remnant-box drpg-project-card-description">
            <p class="drpg-remnant-text">${esc(description).replace(/\n/g, "<br>")}</p>
        </section>` : ""}
        <section class="drpg-remnant-box">
            <dl class="drpg-remnant-facts">
                ${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}
            </dl>
        </section>
        ${actions}
    </div>`;
}

/** Opened with no project this client may read: say so, and name nothing. */
function unknownProjectCard(fromToken) {
    const t = key => game.i18n.localize(key);
    const note = game.user.isGM && !fromToken ? "DRPG.Project.cardShared" : "DRPG.Project.cardUnknown";
    return `<div class="drpg-panel drpg-remnant-card drpg-project-card">
        <header class="drpg-remnant-head">
            <span class="drpg-remnant-glyph" data-drpg-act="project" aria-hidden="true"></span>
            <div class="drpg-remnant-title"><h3>${esc(t("DRPG.Project.cardTitle"))}</h3></div>
        </header>
        <p class="notes">${esc(t(note))}</p>
    </div>`;
}

/** Called once at ready. */
export function registerProjectsMap() {
    Hooks.on("canvasReady", () => {
        syncProjectTokens().catch(err => error("Could not sync the project tokens", err));
    });
    Hooks.on("updateToken", (tokenDoc, changes, options) => {
        onProjectTokenMoved(tokenDoc, changes, options)
            .catch(err => error("Could not move a project with its token", err));
    });
    /* WHO SEES A PROJECT'S TOKEN, ASKED AGAIN WHEN THE COUNTDOWNS CHANGE (E36 C4; audit S09-19). A share,
       a revoke, a seal and a reveal change the countdown's ownership, which `knowsProject` reads, and write
       Daggerheart's setting alone: no token moved and no module setting changed, so no browser ran its
       visibility pass, and a player let in on a secret project saw its token only at their next move. Every
       browser hears its own copy of the setting change; the pass is each browser's (visibility.mjs). */
    Hooks.on("updateSetting", setting => {
        if (setting?.key !== COUNTDOWNS_KEY) return;
        import("./visibility.mjs").then(m => m.applyAll?.())
            .catch(err => error("Could not ask again who sees the project tokens", err));
    });
    Hooks.on("deleteToken", (tokenDoc, options) => onProjectTokenDeleted(tokenDoc, options));
    // One hook, as the trace's card has it: ApplicationV2 fires a render hook for
    // every class in the chain, and the concrete sheet as well would run this twice.
    Hooks.on("renderActorSheetV2", (app, element) => {
        try {
            showProjectCard(app, element);
        } catch (err) {
            // An adversary sheet is ugly, not broken. Never throw into another render.
            error("Could not draw the project card", err);
        }
    });
    log(`${MODULE_ID}: projects stand on the map.`);
}
