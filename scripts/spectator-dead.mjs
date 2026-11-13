/**
 * Danganronpa RPG - the dead as Spectators (E62 C3b, 13.11.2026; docs/dev/e62/STORYBOARD-C3.md on the e62-c3 line, the
 * owner's answers to Q-C3b-1..6 and the default of Q-C3b-7).
 * ---------------------------------------------------------------------------
 * A student who dies, and is no Monocub, watches the rest of the season as a Spectator: a new actor of its own (the
 * "watcher"), owned by the student's player, named after the student and carrying the student's sheet image and token
 * image (Q-C3b-2: "zmiana typu na obserwatora zawsze ma pozostawiac ten sam obraz karty i tokenu"), with one token where
 * the body's token stands. The body's own token stays the corpse.
 *
 * WHAT IT REUSES. The watcher carries E92's `FLAGS.spectator`, so every road E92 gave a Spectator holds for it: the
 * roster leaves it out (monokuma.mjs `studentActors`), its token is hidden from every other player and shown to its
 * owner (visibility.mjs `tokenShownTo`), a GM sees it at 0.3 (`dressSpectator`), and it walks free (movement.mjs's
 * exemptions; Q-C3b-3). The flag is on the new actor only, never on the student: the student's player still owns an
 * unflagged student, so `spectatorViewer` stays false and the dead keep a dead student's view (B), not a Spectator's.
 * visibility.mjs `myRooms` leaves such a token out for the same reason (a watcher walking into a room shows the dead
 * nothing of it).
 *
 * THE LINK IS THE GMS' (the coordinator's spec update of 13.11, e64968c6): which watcher is whose lives in the GMs'
 * `deaths` row (`watcher`) while the death is kept, never in a world flag - no module flag names a death before
 * `publishDeath` (world-secrets.mjs). The actor itself, its name and its images are world data every browser receives:
 * the owner accepted that a console can read the death off them (Q-C3b-1). Once the death is the table's the row is
 * dropped, so the link moves onto the watcher as `FLAGS.watcherOf` (the student's id), which names a public death only.
 * A default of this build, not the spec's words; reported as open.
 *
 * THE CURTAIN'S HOOK. The token is made and taken away with `options[DEAD_SPECTATOR_OPTION]` = `{ phase, silent }`,
 * which Foundry hands every browser's createToken/deleteToken/updateToken hook. The owner's browser (the victim's
 * player) calls `Hooks.callAll(DEAD_SPECTATOR_HOOK, { phase, silent, studentId, tokenId })` for glass.mjs and
 * sequence.mjs to listen to (another line draws the fade and the return; nothing listens here yet), and plays the
 * "Death fade" sound at a fade that is not silent (sfx-play.mjs `playSfx`, on that browser alone). `phase` is "fade" (a
 * death), "return" (a revive), "monocub" (the token becomes the Monocub's) or "spectator" (a Monocub no more).
 * `silent` is a GM's correction (the Students window, Edit campaign, the season reset): the rest state at once.
 */

import { MODULE_ID, FLAGS } from "./config.mjs";
import { log, warn, error } from "./utils.mjs";
import { deathStore } from "./gm-stores.mjs";

/** The hook the curtain listens to (glass.mjs, sequence.mjs: another line's; called on the victim's browser). */
export const DEAD_SPECTATOR_HOOK = "drpgDeadSpectator";
/** The create/delete/update option the moment travels in. */
export const DEAD_SPECTATOR_OPTION = "drpgDeadSpectator";
/** The Sound row of the fade (config.mjs `SFX_EVENTS`). */
export const DEATH_FADE_SFX = "deathFade";

const OWNER = 3;
const NONE = 0;

/**
 * The watcher actor of `student`, as a GM holds it: the kept death's row (`watcher.actorId`), else an actor whose
 * `FLAGS.watcherOf` names the student (a public death). Null when there is none. `row` may be handed in.
 */
export function watcherActorOf(student, { row = undefined, actors = game.actors } = {}) {
    if (!student?.id) return null;
    const held = row === undefined ? (game.user?.isGM ? deathStore.get(student.id) : null) : row;
    const id = held?.watcher?.actorId ?? null;
    if (id && actors?.get?.(id)) return actors.get(id);
    return [...(actors ?? [])].find(a => a?.getFlag?.(MODULE_ID, FLAGS.watcherOf) === student.id) ?? null;
}

/** The student a watcher stands for, on a GM: its flag, else the kept row naming it. Null for any other actor. */
export function studentOfWatcher(actor, { rows = null } = {}) {
    if (!actor?.id) return null;
    const flagged = actor.getFlag?.(MODULE_ID, FLAGS.watcherOf);
    if (flagged) return flagged;
    if (!game.user?.isGM) return null;
    const all = rows ?? deathStore.entries();
    for (const [studentId, row] of Object.entries(all ?? {})) if (row?.watcher?.actorId === actor.id) return studentId;
    return null;
}

/** Whether `actor` is a dead student's watcher, as this browser can tell (`studentOfWatcher`). */
export function isDeadWatcher(actor, options) {
    return Boolean(studentOfWatcher(actor, options));
}

/** The student's token image: the body's token's texture where it stands, else its prototype's, else its portrait. */
function tokenImageOf(student, tokenDoc) {
    return tokenDoc?.texture?.src ?? student?.prototypeToken?.texture?.src ?? student?.img ?? null;
}

/** The non-GM owners of `student`, the watcher's owners. */
function playerOwners(student) {
    return (game.users ?? []).filter(u => !u.isGM && student.testUserPermission?.(u, "OWNER")).map(u => u.id);
}

/** Every token of `actor` on every scene, `{ scene, tokenDoc }`. */
export function tokensOf(actor) {
    const out = [];
    if (!actor?.id) return out;
    for (const scene of game.scenes ?? []) {
        for (const tokenDoc of scene.tokens ?? []) if (tokenDoc.actorId === actor.id) out.push({ scene, tokenDoc });
    }
    return out;
}

/**
 * MAKE THE WATCHER (Q-C3b-1, Q-C3b-2). On a GM, for a student dead in the GMs' records and no Monocub, once: the actor
 * with both images and E92's flag, owned by the student's players, and a token where the body's token stands (none when
 * the body has no token - the actor alone). `kept`: the death is not the table's yet, so the link goes into the GMs' row;
 * else onto the watcher's flag. `silent`: a correction - no fade. Answers the watcher, or null.
 */
export async function ensureDeadSpectator(student, { silent = false, kept = false } = {}) {
    if (!game.user?.isGM || !student || student.type !== "character") return null;
    const store = deathStore;
    const { isMonocub } = await import("./monocub.mjs");
    if (isMonocub(student)) return null;
    const existing = watcherActorOf(student, { row: store.get(student.id) ?? null });
    if (existing) {
        if (!kept) await linkPublicly(existing, student);
        return existing;
    }
    const { locateActor } = await import("./movement.mjs");
    const place = locateActor(student);
    const ownership = { default: NONE };
    for (const id of playerOwners(student)) ownership[id] = OWNER;
    const tokenImg = tokenImageOf(student, place?.tokenDoc);
    let watcher = null;
    try {
        watcher = await Actor.create({
            name: student.name, type: "character", img: student.img, ownership,
            prototypeToken: { name: student.name, actorLink: true, texture: { src: tokenImg }, disposition: student.prototypeToken?.disposition ?? 0 },
            flags: { [MODULE_ID]: { [FLAGS.spectator]: true, ...(kept ? {} : { [FLAGS.watcherOf]: student.id }) } }
        }, { [DEAD_SPECTATOR_OPTION]: { phase: "make", silent: true } });
    } catch (err) {
        error(`Could not make ${student.name}'s Spectator`, err);
        return null;
    }
    if (!watcher) return null;
    if (kept && store.get(student.id)) await store.patch(student.id, { watcher: { actorId: watcher.id } });
    if (place?.tokenDoc && place.scene) {
        const at = place.tokenDoc;
        try {
            const data = (await watcher.getTokenDocument({ x: at.x, y: at.y, elevation: at.elevation ?? 0,
                width: at.width, height: at.height, texture: { src: tokenImg }, hidden: false })).toObject();
            const level = at.level ?? at._source?.level;
            if (level !== undefined) data.level = level;
            await place.scene.createEmbeddedDocuments("Token", [data], { [DEAD_SPECTATOR_OPTION]: { phase: "fade", silent, studentId: student.id } });
        } catch (err) {
            error(`Could not place ${student.name}'s Spectator where the body lies`, err);
        }
    }
    log(`${student.name} watches as a Spectator now.`);
    return watcher;
}

/** The death is the table's: the link leaves the GMs' row for the watcher's own flag (`FLAGS.watcherOf`). */
async function linkPublicly(watcher, student) {
    if (!game.user?.isGM) return;
    if (watcher.getFlag?.(MODULE_ID, FLAGS.watcherOf) === student.id) return;
    try {
        await watcher.setFlag(MODULE_ID, FLAGS.watcherOf, student.id);
    } catch (err) {
        warn(`Could not link ${student.name}'s Spectator to the death made public`, err);
    }
}

/**
 * TAKE THE WATCHER AWAY (Q-C3b-4): a revive, or the season reset. Its tokens go with the phase "return" (the curtain's
 * return; `silent` for a correction), then the actor. Answers whether a watcher was found.
 */
export async function removeDeadSpectator(student, { silent = false, row = undefined } = {}) {
    if (!game.user?.isGM || !student) return false;
    /* A MONOCUB REVIVED AS IT STANDS (E62 C3b fix, the coordinator's 7): the token it walks is the Spectator's, given to it
       (`watcherBecomesMonocub`), and goes with the revive as the Spectator's would; the corpse stays the student's. */
    for (const { scene, tokenDoc } of tokensOf(student).filter(({ tokenDoc }) => tokenDoc.getFlag?.(MODULE_ID, FLAGS.cubToken))) {
        try {
            await scene.deleteEmbeddedDocuments("Token", [tokenDoc.id], { [DEAD_SPECTATOR_OPTION]: { phase: "return", silent, studentId: student.id } });
        } catch (err) {
            error(`Could not take ${student.name}'s Monocub token off the map`, err);
        }
    }
    const watcher = watcherActorOf(student, { row: row === undefined ? deathStore.get(student.id) ?? null : row });
    if (!watcher) return false;
    for (const { scene, tokenDoc } of tokensOf(watcher)) {
        try {
            await scene.deleteEmbeddedDocuments("Token", [tokenDoc.id], { [DEAD_SPECTATOR_OPTION]: { phase: "return", silent, studentId: student.id } });
        } catch (err) {
            error(`Could not take ${student.name}'s Spectator token off the map`, err);
        }
    }
    try {
        await watcher.delete({ [DEAD_SPECTATOR_OPTION]: { phase: "return", silent: true } });
    } catch (err) {
        error(`Could not delete ${student.name}'s Spectator`, err);
    }
    return true;
}

/**
 * THE SEASON'S END (the storyboard's F; season-reset's "deaths" group, chapter.mjs `clearSeasonDeaths`): every watcher
 * the GMs know of - a kept death's row naming one, a watcher flagged with its student - taken away silently, its tokens
 * first. Answers how many went.
 */
export async function removeAllDeadSpectators() {
    if (!game.user?.isGM) return 0;
    const ids = new Set(Object.values(deathStore.entries() ?? {}).map(row => row?.watcher?.actorId).filter(Boolean));
    for (const actor of game.actors ?? []) if (actor?.getFlag?.(MODULE_ID, FLAGS.watcherOf)) ids.add(actor.id);
    let gone = 0;
    for (const id of ids) {
        const watcher = game.actors?.get?.(id);
        if (!watcher) continue;
        for (const { scene, tokenDoc } of tokensOf(watcher)) {
            try {
                await scene.deleteEmbeddedDocuments("Token", [tokenDoc.id], { [DEAD_SPECTATOR_OPTION]: { phase: "return", silent: true } });
            } catch (err) {
                error(`Could not take ${watcher.name}'s Spectator token off the map`, err);
            }
        }
        try {
            await watcher.delete({ [DEAD_SPECTATOR_OPTION]: { phase: "return", silent: true } });
            gone += 1;
        } catch (err) {
            error(`Could not delete ${watcher.name}'s Spectator`, err);
        }
    }
    return gone;
}

/**
 * THE MONOCUB (Q-C3b-7's default, asked of the owner): the watcher's token stays where it stands and becomes the
 * student's own, a Monocub's token - re-linked to the student's actor, with the student's token image (the module has no
 * image of a Monocub of its own, so the student's is the Monocub's), marked `FLAGS.cubToken` so the way back finds it;
 * the watcher actor is removed; the body's token stays the corpse. Answers the tokens re-linked.
 */
export async function watcherBecomesMonocub(student) {
    if (!game.user?.isGM || !student) return 0;
    const watcher = watcherActorOf(student);
    if (!watcher) return 0;
    let moved = 0;
    for (const { tokenDoc } of tokensOf(watcher)) {
        try {
            await tokenDoc.update({ actorId: student.id, actorLink: true, name: student.name,
                [`flags.${MODULE_ID}.${FLAGS.cubToken}`]: true },
            { [DEAD_SPECTATOR_OPTION]: { phase: "monocub", silent: false, studentId: student.id } });
            moved += 1;
        } catch (err) {
            error(`Could not turn ${student.name}'s Spectator token into the Monocub's`, err);
        }
    }
    try {
        await watcher.delete({ [DEAD_SPECTATOR_OPTION]: { phase: "monocub", silent: true } });
    } catch (err) {
        error(`Could not delete ${student.name}'s Spectator`, err);
    }
    return moved;
}

/**
 * A MONOCUB NO MORE, STILL DEAD (the storyboard's E: "gives the Spectator back, bare glass at once"): a new watcher, and
 * each token the Monocub walked (`FLAGS.cubToken`) re-linked to it in place, silently; with none, the watcher is placed
 * at the body as at a death, silently. Answers the watcher.
 */
export async function monocubBecomesWatcher(student) {
    if (!game.user?.isGM || !student) return null;
    const cubTokens = tokensOf(student).filter(({ tokenDoc }) => tokenDoc.getFlag?.(MODULE_ID, FLAGS.cubToken));
    if (!cubTokens.length) return ensureDeadSpectator(student, { silent: true });
    const watcher = await ensureWatcherActorOnly(student);
    if (!watcher) return null;
    for (const { tokenDoc } of cubTokens) {
        try {
            await tokenDoc.update({ actorId: watcher.id, actorLink: true },
                { [DEAD_SPECTATOR_OPTION]: { phase: "spectator", silent: true, studentId: student.id } });
            await tokenDoc.unsetFlag(MODULE_ID, FLAGS.cubToken);
        } catch (err) {
            error(`Could not give ${student.name}'s Spectator its token back`, err);
        }
    }
    return watcher;
}

/** The watcher actor alone (no token), for a public death. */
async function ensureWatcherActorOnly(student) {
    if (!game.user?.isGM) return null;
    const existing = watcherActorOf(student);
    if (existing) return existing;
    const ownership = { default: NONE };
    for (const id of playerOwners(student)) ownership[id] = OWNER;
    try {
        return await Actor.create({
            name: student.name, type: "character", img: student.img, ownership,
            prototypeToken: { name: student.name, actorLink: true, texture: { src: tokenImageOf(student, null) } },
            flags: { [MODULE_ID]: { [FLAGS.spectator]: true, [FLAGS.watcherOf]: student.id } }
        }, { [DEAD_SPECTATOR_OPTION]: { phase: "make", silent: true } });
    } catch (err) {
        error(`Could not make ${student.name}'s Spectator`, err);
        return null;
    }
}

/* ==========================================================================
 * THE VICTIM'S BROWSER
 * ========================================================================== */

/**
 * The moment as the owner's browser reads it off a token hook's options: `{ phase, silent, studentId, tokenId }`, or
 * null when the hook is not one of ours or the token is not this player's. A GM's browser answers null (the GMs see the
 * token at 0.3 and play nothing). Pure but for `game.user` and the token's ownership; tier 1 asks it.
 */
export function momentOf(tokenDoc, options, user = game.user) {
    const moment = options?.[DEAD_SPECTATOR_OPTION];
    if (!moment || typeof moment !== "object" || !user || user.isGM) return null;
    const actor = tokenDoc?.actor ?? game.actors?.get?.(tokenDoc?.actorId);
    const mine = Boolean(actor?.testUserPermission?.(user, "OWNER")) || Boolean(tokenDoc?.testUserPermission?.(user, "OWNER"));
    if (!mine) return null;
    return { phase: String(moment.phase ?? ""), silent: moment.silent === true, studentId: moment.studentId ?? null, tokenId: tokenDoc?.id ?? null };
}

/** What the victim's browser does with a moment: the curtain's hook, and the fade's sound when it is not silent. */
export async function playMoment(moment) {
    if (!moment) return false;
    Hooks.callAll(DEAD_SPECTATOR_HOOK, moment);
    if (moment.phase === "fade" && !moment.silent) {
        try {
            (await import("./sfx-play.mjs")).playSfx(DEATH_FADE_SFX);
        } catch (err) {
            warn("Could not play the death's fade", err);
        }
    }
    return true;
}

/** Registered at init (module.mjs). */
export function registerDeadSpectator() {
    const on = (tokenDoc, options) => {
        const moment = momentOf(tokenDoc, options);
        if (moment) void playMoment(moment);
    };
    Hooks.on("createToken", (tokenDoc, options) => on(tokenDoc, options));
    Hooks.on("deleteToken", (tokenDoc, options) => on(tokenDoc, options));
    Hooks.on("updateToken", (tokenDoc, _change, options) => on(tokenDoc, options));
}
