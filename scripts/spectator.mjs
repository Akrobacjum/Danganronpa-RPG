/**
 * Danganronpa RPG - the Spectator, as the browser that draws reads it (E92 C4, 12.11.2026).
 * ---------------------------------------------------------------------------
 * A Spectator is a character flagged `spectator` (config.mjs `FLAGS.spectator`), owned by its account and no student
 * (monokuma.mjs `isSpectator`, `studentActors`). The fog and the token visibility ask, on every repaint and every
 * refresh of a token, whether the viewer is one; they read the flag here, in a leaf that imports config.mjs alone,
 * because monokuma.mjs reaches half the module (fog.mjs `isMine` says the same of the Monokuma's flag) and visibility.mjs
 * imports none of it.
 *
 * A VIEWER, NOT A SECRET. Who watches is the table's to know (config.mjs's note on the flag), and what a Spectator's
 * browser draws is display: every browser holds every token and every world flag (the trust model, D2), so a console
 * on a Spectator's browser reads what Foundry sends it - the map's rooms come from its own copy of the class's ledger
 * (gm-stores.mjs `spectatorFogSection`, sent by the GMs), never from a store it does not hold.
 */

import { MODULE_ID, FLAGS } from "./config.mjs";

/**
 * THE OLD "SPECTATOR TALK" SWITCH (E92 C6, 12.11.2026 - owner-116, 15.11.2026): true took a Spectator's account to the
 * Spectators' room, absent left it listening where its token stood. Read by nothing since owner-116: its true is the
 * default now, and its absence, the old default, is what the owner changed - so a world that holds either value keeps
 * the Spectator in the Spectators' room, as the owner wants, and a flag left behind changes nothing. Named so that the
 * role's road can tidy it off an account (monokuma.mjs `setSpectator`).
 */
export const SPECTATOR_TALK_FLAG = "spectatorTalk";

/**
 * THE SPECTATORS' ROOM IS A SPECTATOR'S DEFAULT (owner-116, 15.11.2026; the owner: "Spectatorzy - niech ich pokój voice
 * chat będzie globalny (graczy dalej per room)"): a Spectator's account talks in the Spectators' room from anywhere on
 * the map, and its own switch - this flag on its own User document, which its player writes, the one choice of a
 * Spectator's that crosses to the GMs - takes it to listen where its token stands, muted, until it is taken off. A new
 * name, not the old flag read the other way: a stored `spectatorTalk: true` read as "listen here" would have taken the
 * Spectators who chose the room out of it. The primary honours it only for a Spectator's account (voice.mjs
 * `spectatorTalks`): a student's player who writes it changes nothing. Who talks with the Spectators is no secret, so
 * world-secrets.mjs has no rule for it.
 */
export const SPECTATOR_LISTEN_FLAG = "spectatorListenHere";

/** Whether `user` talks in the Spectators' room - its listen flag not set - on the document handed. */
export function talksWithSpectators(user) {
    return user?.getFlag?.(MODULE_ID, SPECTATOR_LISTEN_FLAG) !== true;
}

/*
 * A MONOCUB'S TWO TOKENS (E62 C3b fix, 13.11.2026; the coordinator's 7). From E62 C3b a dead student's Spectator token
 * becomes their Monocub's (spectator-dead.mjs `watcherBecomesMonocub`, `FLAGS.cubToken`), and the token they died as
 * stays the corpse. So a Monocub can hold two tokens: the one it walks, and its body. `isCubToken` reads the first;
 * `isMonocubCorpse` the second - a Monocub's token without the mark while another token of the same actor on the same
 * scene has it (a Monocub with one token, from before E62 C3b or with no Spectator token made, walks that one).
 */
export function isCubToken(tokenDoc) {
    return Boolean(tokenDoc?.getFlag?.(MODULE_ID, FLAGS.cubToken) ?? tokenDoc?.flags?.[MODULE_ID]?.[FLAGS.cubToken]);
}

/** Whether `tokenDoc` is a Monocub's corpse beside the token it walks (above). */
export function isMonocubCorpse(tokenDoc) {
    const actorId = tokenDoc?.actorId;
    if (!actorId || isCubToken(tokenDoc)) return false;
    const actor = tokenDoc.actor ?? game.actors?.get?.(actorId);
    if (!actor?.getFlag?.(MODULE_ID, FLAGS.monocub)) return false;
    return [...(tokenDoc.parent?.tokens ?? [])].some(other => other !== tokenDoc && other.actorId === actorId && isCubToken(other));
}

/** Whether `actor` carries the Spectator's flag, on the document handed. */
export function flaggedSpectator(actor) {
    return Boolean(actor?.getFlag?.(MODULE_ID, FLAGS.spectator));
}

/**
 * WHAT A DEAD STUDENT'S PLAYER SEES (1.2.128, E129; the owner, 23.11.2026: "ofiara po smierci od razu powinna stawac sie
 * spectatorem", and on the table of 22.11: "Nie dostala spectatora automatycznie"). "spectator": a student dead to this
 * browser, whose watcher this player owns (spectator-dead.mjs, E62 C3b), counts as watching, so the player has the
 * Spectator's view at once, walking the watcher's token. "student": the dead keep a dead student's view (B), as from
 * E62 C3b until 1.2.128. Read on each browser for itself (`spectatorViewer`); the GMs' Spectator roads
 * (`spectatorUserIds`: the projects in sight, the voice's Spectator account) are not changed by it, so nothing reaches
 * another player before the body is found.
 */
export const DEAD_VIEW = "spectator";

/** Whether `actor` is dead to this browser: spectator-dead.mjs hands settings.mjs `isDeadForGm` (`readDeathsWith`). */
let deadHere = () => false;

/** The reader of this browser's deaths (spectator-dead.mjs hands `isDeadForGm`; this file imports config.mjs alone). */
export function readDeathsWith(reader) {
    if (typeof reader === "function") deadHere = reader;
}

/**
 * Whether `user` watches: no GM, and every character it owns that is no Monokuma is a Spectator, at least one - the
 * rule voice.mjs `spectatorAccount` holds an account to, read here on the documents (a display's question). With
 * `DEAD_VIEW` "spectator" a student dead to this browser is passed over where the user owns a Spectator besides (its
 * watcher). `actors` and `dead` are the suite's to hand; the world's otherwise.
 */
export function spectatorViewer(user = game.user, actors = game.actors, { dead = deadHere, view = DEAD_VIEW } = {}) {
    if (!user || user.isGM) return false;
    let watching = 0;
    for (const actor of actors ?? []) {
        if (actor?.type !== "character" || !actor.testUserPermission?.(user, "OWNER")) continue;
        if (actor.getFlag?.(MODULE_ID, FLAGS.monokuma)) continue;
        if (flaggedSpectator(actor)) { watching += 1; continue; }
        if (view === "spectator" && dead(actor)) continue;
        return false;
    }
    return watching > 0;
}

/** The Spectator `user` plays, by `spectatorViewer`'s rule: its first such character by id, or null. */
export function watcherOf(user = game.user, actors = game.actors) {
    if (!spectatorViewer(user, actors)) return null;
    return [...(actors ?? [])].filter(a => a?.type === "character" && flaggedSpectator(a) && a.testUserPermission?.(user, "OWNER"))
        .sort((a, b) => String(a.id).localeCompare(String(b.id)))[0] ?? null;
}

/*
 * WHO IS A SPECTATOR, AS THE GMS HOLD IT (E92, the owner's DRPG-D1 of 12.11.2026). The GMs' roads that give a Spectator
 * more than a student - every project in sight (projects-secrecy.mjs `ownershipMap`) - read the flag as the GMs hold
 * it, not as the document stands: a student's console that writes the flag on its own character has it put back by the
 * audit, and must not be shown a secret project meanwhile. sheet-audit.mjs hands its reader here when it registers
 * (`readSpectatorsWith(flagsHeldNow)`); a player's browser keeps the document's, which is all it holds.
 */
let heldFlags = actor => actor;

/** sheet-audit.mjs's reader of the flags the GMs hold for a character (`flagsHeldNow`). */
export function readSpectatorsWith(reader) {
    if (typeof reader === "function") heldFlags = reader;
}

/** The users who play a Spectator and no student, by `spectatorViewer`'s rule on the flags as held here. */
export function spectatorUserIds(users = game.users, actors = game.actors) {
    const out = new Set();
    for (const user of users ?? []) {
        if (!user || user.isGM) continue;
        let watching = 0, student = false;
        for (const actor of actors ?? []) {
            if (actor?.type !== "character" || !actor.testUserPermission?.(user, "OWNER")) continue;
            const flags = heldFlags(actor) ?? actor;
            if (flags?.getFlag?.(MODULE_ID, FLAGS.monokuma)) continue;
            if (flags?.getFlag?.(MODULE_ID, FLAGS.spectator)) watching += 1;
            else student = true;
        }
        if (watching && !student) out.add(user.id);
    }
    return out;
}
