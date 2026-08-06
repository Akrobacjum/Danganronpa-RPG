/**
 * Danganronpa RPG — Despair earned from rolls.
 * ---------------------------------------------------------------------------
 * Guide: "A higher Hope die gives the player +1 Hope, a higher Despair die
 * gives one GM +1 Despair."
 *
 * Which GM is not arbitrary: it is the Monokuma who looks after that student
 * (see assignments.mjs). Daggerheart only knows one shared Fear pool, so the
 * award is read off the finished roll rather than hooked into the system's own
 * Fear plumbing — that keeps working whatever the system does internally.
 *
 * Only one client may write, or two GMs would both credit the same roll.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { adjustDespair, getDespair, despairMax } from "./despair.mjs";
import { monokumaFor } from "./assignments.mjs";
import { isPrimaryGm, debug, error } from "./utils.mjs";

export function registerDespairAwards() {
    Hooks.on("createChatMessage", onChatMessage);
}

async function onChatMessage(message) {
    try {
        if (!isPrimaryGm()) return;
        if (!game.settings.get(MODULE_ID, SETTINGS.despairFromRolls)) return;

        const outcome = readDuality(message);
        if (!outcome) {
            debug("Message carried no duality dice; no Despair awarded.", message?.type);
            return;
        }
        if (!outcome.withFear) return;

        const actor = resolveActor(message);
        if (!actor || actor.type !== "character") {
            debug("Despair roll had no character behind it; nothing awarded.", message?.speaker);
            return;
        }

        const monokuma = monokumaFor(actor);
        if (!monokuma) return;

        const before = getDespair(monokuma.id);
        if (before >= despairMax()) {
            debug(`${monokuma.name} is already at maximum Despair; the roll granted nothing.`);
            return;
        }

        await adjustDespair(monokuma.id, 1);
        debug(`${actor.name} rolled with Despair -> +1 to ${monokuma.name} (${before + 1}/${despairMax()}).`);
    } catch (err) {
        error("Could not award Despair from a roll", err);
    }
}

/**
 * Pull the Hope/Despair outcome off a chat message.
 *
 * The dice are checked FIRST, on purpose. Daggerheart exposes `withHope` and
 * `withFear` as getters that bail out to `undefined` when the roll is not
 * evaluated or is a guaranteed critical, and `message.system.roll` is itself a
 * getter that resolves by `instanceof DualityRoll` — which can come back null
 * depending on how the roll reached chat. Comparing the two d12s is the one
 * signal that is always present once the dice have landed.
 *
 * A tie is a critical: it grants Hope, never Despair.
 */
export function readDuality(message) {
    const dice = findDualityDice(message);
    if (dice) {
        const { hope, fear } = dice;
        return {
            withFear: fear > hope,
            withHope: hope > fear,
            isCritical: hope === fear,
            source: "dice"
        };
    }

    // Fall back to the flags if the dice could not be located.
    for (const candidate of [message?.system?.roll, message?.rolls?.[0]]) {
        if (typeof candidate?.withFear === "boolean" || typeof candidate?.withHope === "boolean") {
            return {
                withFear: Boolean(candidate.withFear) && !candidate.isCritical,
                withHope: Boolean(candidate.withHope),
                isCritical: Boolean(candidate.isCritical),
                source: "flags"
            };
        }
    }

    return null;
}

/**
 * Locate the Hope and Despair d12 totals on a message.
 *
 * Tries the named accessors, then any roll carrying them, then falls back to
 * scanning the raw dice terms for the two twelve-sided dice a duality roll is
 * built from. The raw scan is what keeps trait rolls working regardless of how
 * the system happens to package them.
 */
function findDualityDice(message) {
    const rolls = message?.rolls ?? [];
    const candidates = [message?.system?.roll, ...rolls].filter(Boolean);

    for (const roll of candidates) {
        const hope = roll?.dHope?.total;
        const fear = roll?.dFear?.total;
        if (typeof hope === "number" && typeof fear === "number") return { hope, fear };
    }

    // Raw scan: a duality roll is two d12s, in Hope-then-Despair order.
    for (const roll of candidates) {
        const d12s = (roll?.dice ?? []).filter(d => d?.faces === 12);
        if (d12s.length < 2) continue;

        const hope = d12s[0]?.total ?? d12s[0]?.values?.[0];
        const fear = d12s[1]?.total ?? d12s[1]?.values?.[0];
        if (typeof hope === "number" && typeof fear === "number") return { hope, fear };
    }

    return null;
}

/**
 * The actor a chat message came from. Trait rolls, action rolls and item rolls
 * all identify their actor differently, so every route is tried.
 */
function resolveActor(message) {
    const speaker = message?.speaker;

    if (speaker?.actor) {
        const actor = game.actors.get(speaker.actor);
        if (actor) return actor;
    }

    if (speaker?.token && speaker?.scene) {
        const scene = game.scenes.get(speaker.scene);
        const token = scene?.tokens?.get(speaker.token);
        if (token?.actor) return token.actor;
    }

    // Daggerheart records the originating actor as a UUID on action rolls.
    const sourceUuid = message?.system?.source?.actor;
    if (sourceUuid) {
        const doc = fromUuidSync(sourceUuid);
        const actor = doc?.documentName === "Actor" ? doc : doc?.actor ?? null;
        if (actor) return actor;
    }

    // Finally, the rolling user's own character.
    const user = game.users.get(message?.author?.id ?? message?.user?.id);
    return user?.character ?? null;
}
