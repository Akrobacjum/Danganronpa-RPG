/**
 * Danganronpa RPG — Observe, resolved on the GM's client.
 * ---------------------------------------------------------------------------
 * Guide, p. 30: the player declares what they are looking for, and what they
 * find follows from that declaration.
 *
 *   general      "I look around"                 the easiest Remnant in the room
 *   specific     "something to do with the body" the one closest to the request
 *   non-obvious  "something out of place"        the hardest Remnant in the room
 *
 * and above all of it: "DM zawsze w pierwszej kolejności pokazuje Remnants
 * związane z zabójstwem."
 *
 * WHY THIS RUNS ON THE GM'S CLIENT. Everything the roll is judged against is
 * something the observer must not know: which Remnants are in the room, what
 * kind each one is, and therefore what the difficulty is. Remnant tokens are
 * hidden, but Foundry still ships every scene's tokens — flags and all — to
 * every client, so a player's browser physically holds the answers. Resolving
 * there would mean asking the person being tested to score their own test.
 *
 * So the observer's client does exactly two things: ask for a target, and throw
 * the dice. The number travels here; the verdict, the Truth Bullet and the
 * Sanity are all produced on this side. The player is told the outcome, never
 * the difficulty.
 */

import { OBSERVE_FAIL_STRESS, TIMES_OF_DAY } from "./config.mjs";
import { rankForObserve } from "./remnants.mjs";
import { createTruthBullet, copiedRemnants, dropSecret } from "./truth-bullets.mjs";
import { automatedUpdate } from "./resource-guard.mjs";
import { resourceValue, resourceMax } from "./character.mjs";
import { dialogContent, whisperToOwner, whisperToGms, log, warn, error } from "./utils.mjs";
import { playSfx } from "./sfx.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/** How the player said they were looking. */
export const DECLARATIONS = {
    general: "general",
    specific: "specific",
    nonObvious: "nonObvious",
    followTraces: "followTraces"
};

/**
 * Targets chosen but not yet rolled against.
 *
 * Kept after the roll rather than consumed by it, because a Reroll has to be
 * judged against the same Remnant — the dice are taken back, not the search.
 * Entries are swept on age so a session's worth of abandoned declarations
 * cannot pile up.
 */
const pending = new Map();
const PENDING_TTL_MS = 60 * 60 * 1000;

function sweepPending() {
    const cutoff = Date.now() - PENDING_TTL_MS;
    for (const [key, entry] of pending) {
        if (entry.at < cutoff) pending.delete(key);
    }
}

/* ==========================================================================
 * PHASE 1 — WHAT ARE THEY LOOKING AT
 * ========================================================================== */

/**
 * Pick the Remnant this Observe is aimed at.
 *
 * For a "specific" declaration the choice is a human judgement, and a GM who
 * knew the total could pick a target to suit the number. That is still
 * prevented, but by what this function is GIVEN rather than by when it runs:
 * the payload carries the actor, the declaration and the player's sentence, and
 * no total. The number arrives separately in `resolveObserve`, after the pick.
 *
 * (The player's own client now rolls before it asks them what they were after —
 * see `observeSpecific` in action-rolls.mjs — so "before any dice are thrown" is
 * no longer true and was never what kept this honest.)
 *
 * @returns {Promise<{ok: boolean, key?: string, reason?: string}>}
 */
export async function chooseObserveTarget({ actorId, declaration, request = "" } = {}) {
    if (!game.user.isGM) return { ok: false, reason: "notGm" };
    sweepPending();

    const actor = game.actors.get(actorId);
    if (!actor) return { ok: false, reason: "noActor" };

    // Located without the canvas on purpose. This runs on the GM's client, which
    // is very often looking at a different scene than the player acting — and
    // the canvas-bound lookup would report the character as standing nowhere,
    // quietly turning every Observe into the Daily Life fallback.
    const { locateActor } = await import("./movement.mjs");
    const where = locateActor(actor);
    if (!where?.room) return { ok: false, reason: "noRoom" };

    // A Remnant already copied is not a second find — the guide's Truth Bullet
    // is the player's copy of a trace, and one trace yields one copy per person.
    const already = copiedRemnants(actor);
    const followingTraces = declaration === DECLARATIONS.followTraces;
    const candidates = rankForObserve(where.room, where.scene,
        { preferSource: followingTraces ? actorId : null })
        .filter(c => !already.has(c.token.id));
    if (!candidates.length) return { ok: false, reason: "none" };
    const room = where.room;

    let chosen;
    if (declaration === DECLARATIONS.specific) {
        chosen = await askWhichRemnant(actor, room, request, candidates);
        // A GM who closes the picker has refused the request, which is a real
        // answer: the player keeps their action and nothing is rolled.
        if (!chosen) return { ok: false, reason: "refused" };
    } else if (followingTraces) {
        // `preferSource` above already put the observer's own traces first,
        // sorted the normal way within that group — so the first one IS the
        // easiest of their own. When they have none here, this reads exactly
        // as "general": no message saying so, because "you left nothing here"
        // is information the action never paid for.
        const mine = candidates.filter(c => c.data.sourceActor === actorId);
        chosen = mine.length ? mine[0] : mostRelevant(candidates)[0];
    } else {
        // The preference picks the SHELF; the declaration picks off it.
        //
        // Both of these were reading off the full list, which sorts crime-tied
        // Remnants first and then by difficulty. "The easiest" therefore did
        // land on the right one — but "the hardest" walked to the far end of the
        // list, which is the hardest Remnant that has nothing to do with the
        // murder. The guide is the other way round: "DM zawsze w pierwszej
        // kolejności pokazuje Remnants związane z zabójstwem", and a preference
        // that only holds for one of the two declarations is not a preference.
        const shelf = mostRelevant(candidates);
        chosen = declaration === DECLARATIONS.nonObvious ? shelf[shelf.length - 1] : shelf[0];
    }

    const key = foundry.utils.randomID();
    pending.set(key, {
        at: Date.now(),
        actorId,
        room,
        declaration,
        request,
        tokenId: chosen.token.id,
        sceneId: where.scene?.id ?? null,
        dc: chosen.dc,
        data: chosen.data
    });

    log(`Observe: ${actor.name} is looking at a ${chosen.data.visibility} ${chosen.data.type} in ${room} (DC ${chosen.dc}).`);
    return { ok: true, key };
}

/**
 * How recently a Remnant was left, as one comparable number.
 *
 * Remnants are stamped with the chapter, day and time of day they were dropped.
 * Packed largest-unit-first so ordinary `-` comparison sorts them, and a missing
 * stamp counts as the oldest thing in the room rather than the newest — an
 * unstamped Remnant is one from before this bookkeeping existed, and it should
 * not outrank a trace from the body currently on the floor.
 */
function recencyOf(data) {
    const time = TIMES_OF_DAY.indexOf(data?.timeOfDay);
    return (Number(data?.chapter) || 0) * 1e6
         + (Number(data?.day) || 0) * 1e3
         + (time < 0 ? 0 : time);
}

/**
 * The shelf an untargeted Observe picks from, in difficulty order.
 *
 * Three tiers, and the first non-empty one wins outright:
 *
 *   1. traces of the most recent incident   the guide's "w pierwszej kolejności"
 *   2. anything else tied to a crime        an older murder still beats scenery
 *   3. everything in the room               nothing is tied; there is no
 *                                           preference left to express
 *
 * Tier 1 is what `tiedToCrime` alone could never give: it is a flag, not a date,
 * so by the third chapter every Remnant in the building carries it and the
 * preference stops meaning anything. Measured on the test world — 34 Remnants,
 * all of them tied, spanning five different days.
 *
 * The input is already sorted by difficulty and that order is preserved here, so
 * the caller can keep taking the first or the last.
 */
function mostRelevant(candidates) {
    const tied = candidates.filter(c => c.data.tiedToCrime);
    if (!tied.length) return candidates;

    const newest = Math.max(...tied.map(c => recencyOf(c.data)));
    const latest = tied.filter(c => recencyOf(c.data) === newest);
    return latest.length ? latest : tied;
}

/** The GM decides which trace is closest to what the player asked for. */
async function askWhichRemnant(actor, room, request, candidates) {
    const options = candidates.map((c, i) => {
        const label = [
            `${c.data.visibilityLabel} ${c.data.typeLabel}`,
            c.data.tiedToCrime ? game.i18n.localize("DRPG.Observe.tiedFlag") : null,
            c.data.subject || null,
            `DC ${c.dc}`
        ].filter(Boolean).join(" · ");
        return `<option value="${i}">${foundry.utils.escapeHTML(label)}</option>`;
    }).join("");

    const picked = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Observe.pickTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p>${game.i18n.format("DRPG.Observe.pickIntro", {
                actor: foundry.utils.escapeHTML(actor.name),
                room: foundry.utils.escapeHTML(room)
            })}</p>
            <blockquote>${foundry.utils.escapeHTML(request || game.i18n.localize("DRPG.Observe.noRequest"))}</blockquote>
            <label>${game.i18n.localize("DRPG.Observe.whichRemnant")}
                <select name="remnant">${options}</select></label>
            <p class="notes">${game.i18n.localize("DRPG.Observe.pickNote")}</p>
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Observe.pickConfirm"), default: true,
                callback: (e, b, d) => d.element.querySelector("[name=remnant]").value
            },
            { action: "refuse", label: game.i18n.localize("DRPG.Observe.pickRefuse") }
        ],
        rejectClose: false
    });

    if (picked === null || picked === undefined || picked === "refuse") return null;
    return candidates[Number(picked)] ?? null;
}

/* ==========================================================================
 * PHASE 2 — WHAT THE DICE DID
 * ========================================================================== */

/**
 * Score a thrown Observe against the target chosen in phase 1.
 *
 * @param {object} options
 * @param {string} options.key         From `chooseObserveTarget`.
 * @param {number} options.total
 * @param {boolean} options.isCritical
 * @param {boolean} [options.undo]     A Reroll replacing an earlier result.
 */
export async function resolveObserve({ key, total, isCritical = false, undo = false } = {}) {
    if (!game.user.isGM) return null;
    sweepPending();

    const entry = pending.get(key);
    if (!entry) {
        // The declaration is gone from this browser's memory.
        //
        // `pending` is deliberately not persisted — it holds the answer key's
        // half of an Observe — so it does not survive the GM reloading, a
        // different GM becoming primary, or the hour-long sweep. That is
        // acceptable for a fresh Observe, which simply gets declared again.
        //
        // It is NOT acceptable for a Reroll: the player has already paid three
        // Hope, the dice have already been rewritten, and this side quietly
        // doing nothing leaves the FIRST roll's Truth Bullet in place with the
        // second roll's number on the card. A console warning is not enough for
        // something a human now has to put right by hand.
        warn(`Observe: no pending target for key ${key}.`);
        if (undo) {
            await whisperToGms(`<p class="drpg-warning">${
                game.i18n.localize("DRPG.Observe.rerollLost")
            }</p>`);
        }
        return null;
    }

    const actor = game.actors.get(entry.actorId);
    if (!actor) return null;

    // A Reroll replaces a result rather than adding to it. What the first throw
    // produced is recorded here rather than sent to the observer and quoted
    // back: the bullet is part of the answer key's bookkeeping, and the player's
    // client has no business knowing which item id to name.
    if (undo) await undoPrevious(actor, entry);

    entry.at = Date.now();
    const success = isCritical || total >= entry.dc;

    if (!success) {
        await applyFailure(actor, total, entry);
        entry.result = { success: false, bulletId: null, stress: OBSERVE_FAIL_STRESS };
        return { success: false, key };
    }

    const item = await createFind(actor, entry, isCritical);
    entry.result = { success: true, bulletId: item?.id ?? null, stress: 0 };
    return { success: true, key };
}

/** Put back whatever the previous throw of this same Observe did. */
async function undoPrevious(actor, entry) {
    const previous = entry.result;
    if (!previous) return;

    if (previous.bulletId) {
        const item = actor.items.get(previous.bulletId);
        if (item) {
            const uuid = item.uuid;
            try {
                await item.delete();
                await dropSecret(uuid);
            } catch (err) {
                error("Could not take back the Truth Bullet a reroll undid", err);
            }
        }
    }

    // Sanity taken for a miss that is no longer a miss has to come back, or a
    // Reroll would charge for a failure it just erased.
    if (previous.stress) {
        const marks = resourceValue(actor, "stress");
        const next = Math.max(0, marks - previous.stress);
        if (next !== marks) {
            try {
                await automatedUpdate(actor, { "system.resources.stress.value": next });
            } catch (err) {
                error("Could not return the Sanity a reroll undid", err);
            }
        }
    }

    entry.result = null;
}

/**
 * A failed Observe costs 2 Sanity. Sanity is a reverse resource in Daggerheart:
 * marks count up towards the maximum, so a failure raises the value.
 */
async function applyFailure(actor, total, entry) {
    const marks = resourceValue(actor, "stress");
    const max = resourceMax(actor, "stress");
    const next = Math.min(max, marks + OBSERVE_FAIL_STRESS);

    if (next !== marks) {
        try {
            await automatedUpdate(actor, { "system.resources.stress.value": next });
        } catch (err) {
            error("Could not apply the Sanity from a failed Observe", err);
        }
    }

    // It costs 2 Sanity and looks exactly like a success until the card is
    // read. Local, on the observer's client — the card is theirs.
    playSfx("observeFail");

    await whisperToOwner(actor, `
        <p><strong>${game.i18n.localize("DRPG.Observe.failedTitle")}</strong></p>
        <p>${game.i18n.format("DRPG.Observe.failed", { stress: OBSERVE_FAIL_STRESS })}</p>`);

    log(`Observe: ${actor.name} rolled ${total} against DC ${entry.dc} and found nothing.`);
}

/**
 * Turn the Remnant into a Truth Bullet on the observer's sheet.
 *
 * The GM is asked what the character actually sees, prefilled from the Remnant.
 * That is a human sentence the module cannot write, and this is the moment the
 * table is waiting on it anyway. Cancelling still creates the bullet with the
 * prefilled text: a result that has already been rolled must never evaporate
 * because a dialog was dismissed.
 */
async function createFind(actor, entry, isCritical) {
    const data = entry.data;
    const fallbackName = data.subject
        || game.i18n.format("DRPG.Observe.defaultName", { room: entry.room });

    /*
     * ONE TRACE, ONE DESCRIPTION — now `public` on the Remnant itself, not a
     * field private to this file.
     *
     * The GM used to be asked to describe the find on EVERY observation, and the
     * answer went onto that one player's Truth Bullet and nowhere else. Two
     * people looking at the same smear on the same wall therefore got two
     * different names for it, written minutes apart by a GM with no reminder of
     * what they had said the first time — and in a game whose entire endgame is
     * players comparing notes in a trial, two names for one object is not a
     * cosmetic problem. It is a false contradiction the table has to spend the
     * trial resolving.
     *
     * So the description IS the Remnant's `public.name`/`public.playerText` —
     * see remnants.mjs — written back the first time it is given, and every
     * later observer (and the Investigation Dashboard, and the token itself
     * once revealed) reads the same words without the GM being asked again.
     *
     * A CRITICAL still asks. The guide gives it "a big hint from the GM" on top
     * of the category (p. 30), so there is genuinely something new to say — and
     * the box opens prefilled with what the trace is already called, so pressing
     * straight through keeps the name identical.
     */
    const {
        remnantPublicById, setRemnantPublicById, revealRemnantToFinderById
    } = await import("./remnants.mjs");

    const stored = remnantPublicById(entry.sceneId, entry.tokenId);
    const neutralName = game.i18n.localize("DRPG.Remnant.tokenName");
    // Has anybody actually described this yet, or is `stored.name` just the
    // neutral placeholder every fresh trace starts with?
    const described = stored?.name && stored.name !== neutralName ? stored : null;

    const written = (described && !isCritical)
        ? described
        : await describeFind(actor, entry, isCritical, described?.name || stored?.name || fallbackName, described);

    // Written back on the GM's client, where the ledger lives. Only when there
    // is something to write: a dismissed dialog must not overwrite a good
    // description with an empty one.
    let pub = stored;
    if (written?.name && written.name !== described?.name
        || written?.playerText && written.playerText !== described?.playerText) {
        try {
            pub = await setRemnantPublicById(entry.sceneId, entry.tokenId, {
                name: written.name || described?.name || fallbackName,
                playerText: written.playerText || described?.playerText || ""
            });
        } catch (err) {
            error("Could not record the description on the Remnant", err);
        }
    }

    const item = await createTruthBullet(actor, {
        name: pub?.name || written?.name || fallbackName,
        realType: data.type,
        // A critical identifies the category outright — guide, p. 30: "Truth
        // Bullet ze zidentyfikowaną kategorią i duża podpowiedź od DMa."
        shownType: isCritical ? data.type : "neutral",
        visibility: data.visibility,
        faint: Boolean(data.faint),
        playerText: pub?.playerText ?? written?.playerText ?? "",
        img: pub?.img ?? null,
        tags: pub?.tags ?? [],
        gmNote: data.note ?? "",
        remnantId: entry.tokenId,
        sceneId: entry.sceneId,
        // Passed explicitly: this is the GM's client, which may be looking at a
        // different scene entirely, so the canvas-bound default would stamp null.
        room: entry.room,
        // Into the bullet's secret; public on the item only once identified —
        // immediately for this critical find, at Analyze for everyone else.
        sourceAction: data.action ?? null,
        tiedToCrime: Boolean(data.tiedToCrime)
    });

    if (!item) return null;

    // The object is real now, not just a note in the GM's ledger — the first
    // person to copy it reveals the token it came from. See
    // `revealRemnantToFinder` in remnants.mjs for why this is `hidden: false`
    // rather than forcing `visible`, and visibility.mjs for how it then stays
    // invisible to everyone who has not found it themselves.
    try {
        await revealRemnantToFinderById(entry.sceneId, entry.tokenId);
    } catch (err) {
        error("Could not reveal the Remnant token to its finder", err);
    }

    await whisperToOwner(actor, `
        <h3>${game.i18n.localize("DRPG.TruthBullet.received")}</h3>
        <p><strong>${foundry.utils.escapeHTML(item.name)}</strong></p>
        ${pub?.playerText ? `<p>${foundry.utils.escapeHTML(pub.playerText)}</p>` : ""}
        ${isCritical ? `<p><em>${game.i18n.localize("DRPG.Observe.critIdentified")}</em></p>` : ""}
        <p><small>${game.i18n.localize("DRPG.TruthBullet.whereToFind")}</small></p>`);

    log(`Observe: ${actor.name} copied a ${data.type} Remnant as "${item.name}".`);
    return item;
}

/** The GM's sentence, prefilled. Never blocks the result — see `createFind`. */
async function describeFind(actor, entry, isCritical, fallbackName, stored = null) {
    const data = entry.data;

    return DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Observe.describeTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p>${game.i18n.format("DRPG.Observe.describeIntro", {
                actor: foundry.utils.escapeHTML(actor.name),
                room: foundry.utils.escapeHTML(entry.room)
            })}</p>
            <p class="notes">${foundry.utils.escapeHTML(
                `${data.visibilityLabel} ${data.typeLabel}${data.note ? ` — ${data.note}` : ""}`
            )}</p>
            ${stored
                ? `<p class="notes">${game.i18n.localize("DRPG.Observe.alreadyDescribed")}</p>`
                : ""}
            ${isCritical
                ? `<p><strong>${game.i18n.localize("DRPG.Observe.critPrompt")}</strong></p>`
                : ""}
            <label>${game.i18n.localize("DRPG.TruthBullet.name")}
                <input type="text" name="name" autofocus
                       value="${foundry.utils.escapeHTML(fallbackName)}" /></label>
            <label>${game.i18n.localize("DRPG.TruthBullet.playerText")}
                <textarea name="playerText" rows="3"
                    placeholder="${game.i18n.localize("DRPG.TruthBullet.playerTextPlaceholder")}"
                    >${foundry.utils.escapeHTML(stored?.playerText ?? "")}</textarea></label>
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Observe.describeConfirm"), default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return { name: f.name.value.trim(), playerText: f.playerText.value.trim() };
                }
            }
        ],
        rejectClose: false
    // Closing the dialog resolves to null, which `createFind` reads as "use the
    // prefilled name and no description" — the find still lands either way.
    }).catch(() => null);
}

/** Forget every pending target. A console tool for a stuck declaration. */
export function clearPendingObserves() {
    const n = pending.size;
    pending.clear();
    return n;
}
