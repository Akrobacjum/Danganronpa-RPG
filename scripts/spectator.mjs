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
 * THE "SPECTATOR TALK" SWITCH (E92 C6): a flag on the Spectator's own User document, which its player writes - the one
 * choice of a Spectator's that crosses to the GMs. The primary honours it only for a Spectator's account
 * (voice.mjs `spectatorTalks`): a student's player who writes it changes nothing. Who talks with the Spectators is no
 * secret, so world-secrets.mjs has no rule for it.
 */
export const SPECTATOR_TALK_FLAG = "spectatorTalk";

/** Whether `user`'s switch is on, on the document handed. */
export function talkSwitchOn(user) {
    return user?.getFlag?.(MODULE_ID, SPECTATOR_TALK_FLAG) === true;
}

/** Whether `actor` carries the Spectator's flag, on the document handed. */
export function flaggedSpectator(actor) {
    return Boolean(actor?.getFlag?.(MODULE_ID, FLAGS.spectator));
}

/**
 * Whether `user` watches: no GM, and every character it owns that is no Monokuma is a Spectator, at least one - the
 * rule voice.mjs `spectatorAccount` holds an account to, read here on the documents (a display's question). `actors`
 * is the suite's to hand; the world's otherwise.
 */
export function spectatorViewer(user = game.user, actors = game.actors) {
    if (!user || user.isGM) return false;
    let watching = 0;
    for (const actor of actors ?? []) {
        if (actor?.type !== "character" || !actor.testUserPermission?.(user, "OWNER")) continue;
        if (actor.getFlag?.(MODULE_ID, FLAGS.monokuma)) continue;
        if (!flaggedSpectator(actor)) return false;
        watching += 1;
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
