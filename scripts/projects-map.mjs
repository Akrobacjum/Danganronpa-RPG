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
 * the token carries a neutral name, a neutral image and one countdown id, and
 * nothing else. The id adds nothing a console does not already hold: the
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

import { MODULE_ID, PROJECT_TOKEN } from "./config.mjs";
import { roomOf, setProjectMeta, tokenRefOf, allProjects, isComplete, knowsProject, isSecret }
    from "./projects.mjs";
import { boundsOf } from "./movement.mjs";
import { log, error, whisperToGms, esc } from "./utils.mjs";

/** The actor every project token is an unlinked copy of. */
const PROJECT_ACTOR = "DRPG Project";

/* Isometric Perspective's scope and the flag it sizes a token's picture by. Written only
   while that module is on: its flags are its own, and a scope that is not active is not
   one to write into. */
const ISO_MODULE = "isometric-perspective";
const isoOn = () => Boolean(game.modules?.get(ISO_MODULE)?.active);

/** The one flag a project token carries. Everything else is looked up. */
export const PROJECT_TOKEN_FLAG = "projectId";

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

async function ensureProjectActor() {
    let actor = game.actors.getName(PROJECT_ACTOR);
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
    for (const region of scene.regions ?? []) {
        if (region.name !== room) continue;
        const box = boundsOf(region);
        if (!box) return null;
        const grid = scene.grid?.size ?? canvas?.grid?.size ?? 100;
        const half = (PROJECT_TOKEN.size * grid) / 2;
        return { x: Math.round(box.x + box.w / 2 - half), y: Math.round(box.y + box.h / 2 - half) };
    }
    return null;
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

    const target = scene ?? canvas?.scene ?? game.scenes?.current ?? null;
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
                src: PROJECT_TOKEN.icon,
                tint: tintFor(countdownId)
            },
            alpha: PROJECT_TOKEN.alpha,
            sort: PROJECT_TOKEN.sort,
            /* NOT hidden. Foundry's own flag means "GM only", and what this
               needs is "the people who know" - which only a client can decide.
               Same arrangement, and same reason, as an incident's own traces. */
            hidden: false,
            flags: {
                [MODULE_ID]: { [PROJECT_TOKEN_FLAG]: countdownId },
                ...(isoOn() ? { [ISO_MODULE]: { scale: PROJECT_TOKEN.isoScale } } : {})
            }
        }]);
        if (!created) return null;
        await setProjectMeta(countdownId, { tokenId: created.id, tokenScene: target.id });
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
            await scene.deleteEmbeddedDocuments("Token", [ref.tokenId]);
        }
    } catch (err) {
        error(`Could not take the project ${countdownId} off the map`, err);
    }
    /* The reference is cleared whether or not the delete worked: a token that
       is already gone and a token that refused to go both leave this project
       without one, and a stale id would stop it ever being placed again. */
    await setProjectMeta(countdownId, { tokenId: null, tokenScene: null });
    return true;
}

/**
 * The tint follows the bar. Cheap enough to call on every project change, and
 * it writes only when the colour would actually differ.
 */
export async function refreshProjectToken(countdownId) {
    if (!game.user.isGM) return;
    const token = projectTokenOf(countdownId);
    if (!token) return;
    const want = tintFor(countdownId);
    const changes = {};
    /* THE TINT IS A Color ON THE DOCUMENT, and a Color is never `===` a string: this
       compared an object with "#d8c98a" and wrote the tint of every project token on
       every scene draw, for as long as it has existed (found 22.09). The Color prints
       as its hex, which is what `want` is. */
    if (String(token.texture?.tint ?? "") !== want) changes["texture.tint"] = want;
    /* A token placed before 1.2.53 wears Foundry's hazard sign; only that exact default
       moves, as the actor above does. */
    if (token.texture?.src === PROJECT_TOKEN.oldIcon) changes["texture.src"] = PROJECT_TOKEN.icon;
    /* A token placed before 1.2.51 has the picture at full size; the sync that runs on
       every scene draw brings it down to the one that fits its frame. */
    if (isoOn() && token.getFlag?.(ISO_MODULE, "scale") !== PROJECT_TOKEN.isoScale) {
        changes[`flags.${ISO_MODULE}.scale`] = PROJECT_TOKEN.isoScale;
    }
    if (!Object.keys(changes).length) return;
    try {
        await token.update(changes);
    } catch (err) {
        error(`Could not refresh the project token for ${countdownId}`, err);
    }
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
 */
async function onProjectTokenMoved(tokenDoc, changes) {
    if (!game.user.isGM) return;
    if (changes?.x === undefined && changes?.y === undefined) return;
    const id = projectIdOf(tokenDoc);
    if (!id) return;

    const { roomAt } = await import("./movement.mjs");
    const grid = tokenDoc.parent?.grid?.size ?? canvas?.grid?.size ?? 100;
    // The token's centre decides, not its corner - a two-square token straddling
    // a boundary belongs to the room most of it is in.
    const centre = {
        x: (changes.x ?? tokenDoc.x) + (tokenDoc.width * grid) / 2,
        y: (changes.y ?? tokenDoc.y) + (tokenDoc.height * grid) / 2
    };
    const landedIn = roomAt(centre.x, centre.y, tokenDoc);
    const was = roomOf(id);
    if (!landedIn || landedIn === was) return;

    await setProjectMeta(id, { room: landedIn });
    const name = allProjects().find(p => p.id === id)?.name ?? id;
    await whisperToGms(`<p>${game.i18n.format("DRPG.Project.tokenMoved", {
        project: esc(name), from: esc(was ?? "-"), to: esc(landedIn)
    })}</p>`);
    log(`Project ${id} moved from ${was ?? "nowhere"} to ${landedIn} by its token.`);
}

let syncWaitingForReady = false;

/**
 * Bring the map into line with the projects. GM only.
 *
 * Called on `canvasReady` rather than only at creation, because a project can
 * gain a room long after it was made, a scene can be swapped, and a GM can
 * delete a token by hand - and in all three the tray and the map would
 * otherwise disagree until somebody reloaded.
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
    if (!game.user.isGM || !canvas?.scene) return 0;
    // The base actor's own housekeeping (ownership, the hammer), when there is one to keep.
    if (game.actors.getName(PROJECT_ACTOR)) await ensureProjectActor();

    let touched = 0;
    for (const project of allProjects() ?? []) {
        const ref = tokenRefOf(project.id);
        const live = projectTokenOf(project.id);

        // A reference pointing at a token somebody deleted by hand.
        if (ref && !live) {
            await setProjectMeta(project.id, { tokenId: null, tokenScene: null });
            touched++;
        }
        if (!roomOf(project.id)) {
            // It lost its room: it has no place, so it has no token.
            if (live) { await removeProjectToken(project.id); touched++; }
            continue;
        }
        if (!projectTokenOf(project.id)) {
            if (await placeProjectToken(project.id)) touched++;
        } else {
            await refreshProjectToken(project.id);
        }
    }
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
 */
function showProjectCard(app, element) {
    const actor = app?.document;
    if (!actor?.getFlag?.(MODULE_ID, PROJECT_TOKEN_FLAG)) return;

    const token = actor.isToken ? actor.token : null;
    const id = token ? projectIdOf(token) : null;
    const project = typeof id === "string" && knowsProject(id)
        ? allProjects().find(p => p.id === id) ?? null
        : null;

    const body = element.querySelector(".window-content") ?? element;
    body.innerHTML = project ? projectCard(project) : unknownProjectCard(Boolean(token));
    if (game.user.isGM && project) {
        body.querySelector("[data-drpg-project-manager]")?.addEventListener("click", async event => {
            event.preventDefault();
            const { openProjectManager } = await import("./projects-ui.mjs");
            await openProjectManager();
        });
    }
    // Sized for a stat block; this is a card, exactly as the trace's is - and a frame
    // later for the same reason: set inside the render hook, the application's own
    // first-render positioning overwrote it (see showRemnantCard).
    requestAnimationFrame(() => app.setPosition?.({ height: "auto", width: 480 }));
}

/** The card itself. Pure: everything it prints is handed to it or asked of game state. */
function projectCard(project) {
    const t = key => game.i18n.localize(key);
    const target = Number(project.start) || 0;
    const current = Math.max(0, Math.min(target || Infinity, Number(project.current) || 0));
    const share = target > 0 ? Math.round((current / target) * 100) : 0;

    const rows = [
        [t("DRPG.Project.cardProgress"), `${current} / ${target}`],
        [t("DRPG.Project.room"), esc(project.room ?? t("DRPG.Project.anyRoom"))]
    ];
    let actions = "";
    if (game.user.isGM) {
        const status = project.complete ? "cardDone" : (project.frozen ? "cardFrozen" : "cardUnderway");
        rows.push([t("DRPG.Project.cardStatus"), esc(t(`DRPG.Project.${status}`))]);
        rows.push([t("DRPG.Project.cardSecrecy"),
            esc(t(isSecret(project.id) ? "DRPG.Project.cardSecret" : "DRPG.Project.cardPublic"))]);
        // The same predicate that draws the token for each of them - so this list and
        // what each player's map shows cannot disagree.
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
             aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${current}"><span style="width: ${share}%"></span></div>
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
    Hooks.on("updateToken", (tokenDoc, changes) => {
        onProjectTokenMoved(tokenDoc, changes)
            .catch(err => error("Could not move a project with its token", err));
    });
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
