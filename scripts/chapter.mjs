/**
 * Danganronpa RPG - how a chapter ends, and how a character stops.
 * ---------------------------------------------------------------------------
 * Guide, p. 29: "Typ Truth Bullets zostaje ujawniony na finał rozdziału. Na
 * początku następnej sesji wszystkie zostają usunięte z ekwipunku gracza
 * z wyjątkiem Faint Truth Bullets."
 *
 * Three moments, and none of them fire on their own:
 *
 *   the body is found   traces that were doubtful become permanent, everyone is
 *                       called to the scene, and the phase turns to Investigation
 *   the chapter ends    every Truth Bullet gives up what it really was
 *   the GM sweeps       the evidence is cleared out, Faint excepted
 *
 * All three are GM buttons rather than clock triggers, and deliberately so. Two
 * of them delete things that cannot be brought back, and the moment a chapter
 * "ends" is a judgement about the fiction - after the verdict, after the
 * execution, when the table is ready - not a number ticking over. A sweep that
 * fired by itself because somebody nudged the session counter would be the
 * worst bug this module could have.
 *
 * That is the one place this file departs from the page above it. The guide
 * puts the sweep at the start of the next session; here it is a button in the
 * Investigation Dashboard and the session counter does not touch it. The
 * reasoning, and the season run behind it, is written out over
 * `sweepTruthBullets` at the bottom of this file.
 *
 * Everything here runs on a GM client: the answer key lives there (see D6 and
 * truth-bullets.mjs), and only a GM may write to another player's sheet.
 */

import { MODULE_ID, FLAGS, REMNANT_TYPES, CHAPTERS_PER_SEASON } from "./config.mjs";
import { getClock } from "./clock.mjs";
import { bodyDiscovery, setBodyDiscovery, clearBodyDiscovery } from "./settings.mjs";
import { TRUTH_BULLET_FLAGS, bulletsOf, secretOf, dropSecret, faintOf } from "./truth-bullets.mjs";
import { remnantsOn, remnantData, setRemnantFlagsMany } from "./remnants.mjs";
import { studentActors } from "./monokuma.mjs";
import { announce, dialogContent, whisperToGms, gmIds, ownerOf, log, error, plural, esc }
    from "./utils.mjs";
import { caseMark } from "./gm-stores.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/* ==========================================================================
 * DEATH
 * ========================================================================== */

/** Is this student dead? */
export function isDeceased(actor) {
    return Boolean(actor?.getFlag(MODULE_ID, FLAGS.deceased));
}

/** When they died, or `null`. */
export function deathRecord(actor) {
    return actor?.getFlag(MODULE_ID, FLAGS.deceased) ?? null;
}

/** Every student still alive. */
export function livingStudents() {
    return studentActors().filter(a => !isDeceased(a));
}

/**
 * Kill a character.
 *
 * What perishes is the Truth Bullets - carried and stashed alike - and the
 * answer-key entries go with them, so the ledger does not fill up with rows
 * nothing can ever reach again. Everything else they owned stays on the sheet
 * to be found on the body; decision D1 used to take that too, and no longer
 * does (see the long note inside).
 *
 * Quiet on purpose. A murder is a secret until somebody finds the body - the
 * announcement belongs to `discoverBody`, not here. Only the GMs are told.
 *
 * The token stays where it is. A body is usually the thing the cast will be
 * standing around looking at; what changes is that the rules stop counting them
 * as a person in the room (see `FLAGS.deceased` and `othersInRoom`).
 *
 * @param {Actor} actor
 * @param {object} [options]
 * @param {boolean} [options.keepBullets]  Leave the Truth Bullets alone. For a
 *   death that is not a killing-game murder - a retcon, a test - where taking
 *   somebody's conclusions away would just be destructive. The belongings stay
 *   either way.
 */
/**
 * Mark somebody dead and say nothing (F16, 20.09).
 *
 * The counterpart to `reviveCharacter`, and the reason it exists: the Players
 * window's dropdown is a REPAIR tool - its own header says it "moves the two
 * flags and nothing else" - and it was calling `killCharacter`, which is the
 * whole death procedure. A GM straightening out a row that had got out of step
 * whispered "A student is dead" to the GMs and to the owners of everyone in a
 * running incident, stamped the death chapter, tied this chapter's traces off and
 * offered Stage 6. None of that is a repair.
 *
 * What is left here is the record and the token marker, which IS the state both
 * halves have to write. `killCharacter` keeps its order and calls this in the
 * middle of it, so there is one place that knows what "deceased" means.
 *
 * Returns the record it wrote, or null if the flag would not take - which is what
 * `killCharacter` reads to decide whether the rest of the procedure should run.
 */
export async function markDeceased(actor) {
    if (!game.user.isGM || !actor) return null;

    const clock = getClock();
    const record = { chapter: clock.chapter, day: clock.day, timeOfDay: clock.timeOfDay };

    try {
        await actor.setFlag(MODULE_ID, FLAGS.deceased, record);
    } catch (err) {
        error(`Could not mark ${actor.name} as deceased`, err);
        return null;
    }

    // Foundry's own dead marker, so the token reads as a body on any client
    // without this module having to draw anything. Wrapped: it is a convenience,
    // not the record - `FLAGS.deceased` is what the rules read.
    try {
        await actor.toggleStatusEffect("dead", { active: true, overlay: true });
    } catch (err) {
        log(`Could not apply the "dead" status to ${actor.name}; the flag is set regardless.`);
    }

    return record;
}

export async function killCharacter(actor, { keepBullets = false } = {}) {
    if (!game.user.isGM || !actor) return null;
    if (isDeceased(actor)) {
        ui.notifications.warn(game.i18n.format("DRPG.Chapter.alreadyDead", { name: actor.name }));
        return null;
    }

    /*
     * WHAT DIES WITH THEM, AND WHAT DOES NOT (Dawid, 27.08).
     *
     * This used to take the whole inventory - decision D1's "it all vanishes" -
     * which made a body a thing to look at and nothing to search. The belongings
     * stay now: they are on the sheet, other students can take them, and taking
     * one is evidence (see `lootBody`).
     *
     * TRUTH BULLETS STILL PERISH, and that half is unchanged. What somebody
     * worked out is not an object in their pocket; it died with them, and a
     * murder that handed the killer their victim's conclusions would be a murder
     * that pays.
     */
    let removed = 0;
    if (!keepBullets) {
        // The ledger entries first, while the items still exist to be read.
        for (const bullet of bulletsOf(actor)) await dropSecret(bullet.uuid);

        const doomed = bulletsOf(actor).map(i => i.id);

        if (doomed.length) {
            try {
                await actor.deleteEmbeddedDocuments("Item", doomed);
                removed = doomed.length;
            } catch (err) {
                error(`Could not clear ${actor.name}'s inventory on death`, err);
            }
        }
    }

    // The record and the token marker, which the Players window's repair
    // dropdown writes on its own (F16) - one place decides what deceased means.
    const record = await markDeceased(actor);
    if (!record) return null;

    /*
     * WHO IS TOLD A STUDENT DIED (Dawid, 28.08 - widen it).
     *
     * The card used to reach the GMs alone. It now also reaches the owners of
     * everyone inside a running incident, which is the audience the sound is
     * for and therefore the audience the card has to have: the flag rides the
     * message, so the two cannot drift apart. Nobody learns anything they did
     * not already know - they were in the room.
     *
     * Outside an incident there are no participants and this is exactly what
     * it always was, a whisper to the GMs.
     *
     * The list is built the way `announceTimeOfDay` builds it in clock.mjs,
     * from `gmIds()` plus the participants' owners - same function, same
     * shape, no second idea of who counts as "inside this".
     */
    const deathAudience = await (async () => {
        try {
            const { murderState, participantIds } = await import("./murder.mjs");
            const state = murderState();
            if (!state) return null;
            const owners = [...participantIds(state)]
                .map(id => ownerOf(game.actors.get(id))?.id)
                .filter(Boolean);
            return Array.from(new Set([...gmIds(), ...owners]));
        } catch (err) {
            // A death that cannot work out its audience is still a death the
            // GMs must be told about.
            error("Could not widen the death card to the incident", err);
            return null;
        }
    })();

    await whisperToGms(`
        <h3>${game.i18n.localize("DRPG.Chapter.deathTitle")}</h3>
        <p>${game.i18n.format("DRPG.Chapter.died", {
            name: foundry.utils.escapeHTML(actor.name),
            chapter: record.chapter
        })}</p>
        ${keepBullets ? "" : `<p>${plural("DRPG.Chapter.bulletsGone", { n: removed })}</p>`}
        <p><small>${game.i18n.localize("DRPG.Chapter.vaultPending")}</small></p>`, {
        whisper: deathAudience ?? gmIds(),
        // The audience of a death card mid-incident is the incident's cast.
        veiled: true,
        flags: { [MODULE_ID]: { sfx: { key: "death", gm: true } } }
    });

    log(`${actor.name} is dead (chapter ${record.chapter}); ${removed} Truth Bullet(s) destroyed.`);

    // The VICTIM of the running incident died - and only then (Dawid, 26.08):
    // the chapter's traces are the case now, so they arrive in the
    // Investigation Dashboard with "Tied to crime" already checked. Gated on
    // `sideOf` so an execution after the trial, the mastermind's end or a
    // GM's story ruling ties nothing. Checked BEFORE `offerStageSix` below,
    // which can close the incident and take the answer with it.
    try {
        const { sideOf } = await import("./murder.mjs");
        if (sideOf(actor) === "victim") {
            const { tieChapterTraces } = await import("./remnants.mjs");
            await tieChapterTraces(record.chapter);
        }
    } catch (err) {
        error("Could not mark the chapter's traces as tied to the murder", err);
    }

    // A death that ends an incident should end the incident.
    try {
        await offerStageSix(actor);
    } catch (err) {
        error("Could not offer the clean-up stage after the death", err);
    }

    return record;
}

/**
 * The victim of a running incident just died - offer Stage 6.
 *
 * The murder engine only reaches Stage 6 through a Finishing Blow, and a GM
 * who kills the victim any other way (this screen, a ruling, a Despair Call)
 * left the incident frozen at stage "incident" around a corpse: `isCleaner`
 * false, no clean-up screen for the killer, and the whole Stage 6 branch
 * unreachable. Measured before this existed - the stage stayed "incident" and
 * `attemptStageSix` refused with "you are not the one cleaning up this scene",
 * which was not the reason.
 *
 * Asked rather than done: the GM may be killing somebody mid-incident for a
 * reason that is not the incident ending - Monokuma's punishment, a Call, a
 * mistake being corrected.
 */
async function offerStageSix(victim) {
    const { murderState, beginResolution } = await import("./murder.mjs");
    const state = murderState();
    if (!state?.active || state.stage !== "incident") return;
    if (state.victimId !== victim.id) return;

    const killer = game.actors.get(state.killerId);

    const sure = await DialogV2.confirm({
        classes: ["drpg-panel"],
        window: { title: game.i18n.localize("DRPG.Chapter.stageSixTitle") },
        content: dialogContent(`<div>
            <p>${game.i18n.format("DRPG.Chapter.stageSixIntro", {
                victim: foundry.utils.escapeHTML(victim.name),
                killer: foundry.utils.escapeHTML(killer?.name ?? "?")
            })}</p>
            <p>${game.i18n.format("DRPG.Chapter.stageSixWhat", {
                killer: foundry.utils.escapeHTML(killer?.name ?? "?")
            })}</p>
        </div>`),
        yes: { label: game.i18n.localize("DRPG.Chapter.stageSixYes") },
        no: { label: game.i18n.localize("DRPG.Chapter.stageSixNo") },
        rejectClose: false
    });

    if (sure) await beginResolution("victimKilled");
}

/**
 * Undo the marking. The inventory does NOT come back - those documents are
 * gone - so this is for a mis-click, not for a resurrection.
 */
export async function reviveCharacter(actor, { quiet = false } = {}) {
    if (!game.user.isGM || !actor) return false;

    try {
        await actor.unsetFlag(MODULE_ID, FLAGS.deceased);
        await actor.toggleStatusEffect("dead", { active: false });
    } catch (err) {
        error(`Could not un-mark ${actor.name}`, err);
        return false;
    }

    // `quiet`: the season reset revives every corpse in a row and deletes every
    // Truth Bullet anyway, so a toast per body said nothing (CORE-18).
    if (!quiet) ui.notifications.info(game.i18n.format("DRPG.Chapter.revived", { name: actor.name }));
    return true;
}

/** Mark somebody dead, from the GM panel. */
export async function openDeathDialog({ actor = null } = {}) {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return false;
    }

    const alive = livingStudents();
    if (!actor && !alive.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Chapter.nobodyLeft"));
        return false;
    }

    // The picker is skipped when the caller already knows who.
    //
    // "Who is alive" in the GM panel is a table with one row per character and
    // a Kill button on each of them, so by the time this opens the question the
    // select asks has been answered by pressing a button next to a name.
    // Everything else about the procedure - the warning, the choice about the
    // inventory, `killCharacter` itself - has to stay exactly the same, which
    // is why that button opens this rather than reimplementing it.
    const picker = actor
        ? `<p><strong>${foundry.utils.escapeHTML(actor.name)}</strong></p>`
        : `<label>${game.i18n.localize("DRPG.Chapter.whoDied")}
                <select name="actor">${alive
                    .map(a => `<option value="${a.id}">${
                        foundry.utils.escapeHTML(a.name)}</option>`).join("")}</select></label>`;

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Chapter.deathTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            ${picker}
            <label class="drpg-checkbox">
                <input type="checkbox" name="keepBullets" />
                ${game.i18n.localize("DRPG.Chapter.keepBullets")}</label>
            <p class="notes">${game.i18n.localize("DRPG.Chapter.deathNote")}</p>
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Chapter.confirmDeath"), default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return { id: actor?.id ?? f.actor.value, keepBullets: f.keepBullets.checked };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return false;

    const dying = game.actors.get(result.id);
    if (!dying) return false;
    return Boolean(await killCharacter(dying, { keepBullets: result.keepBullets }));
}

/* ==========================================================================
 * THE BODY IS FOUND
 * ========================================================================== */

/**
 * Faint Prep traces that belong to this murder stop being doubtful.
 *
 * Which ones those are is a judgement only the GM can make - a Prep Remnant is
 * left by anyone gathering tools, and most of them mean nothing. So this offers
 * the list and the GM ticks. Ticking sets `tiedToCrime` as well as clearing
 * `faint`, which is what actually exempts a trace from the chapter-end sweep.
 */
async function promoteFaintPrep() {
    const candidates = [];
    for (const scene of game.scenes) {
        for (const token of remnantsOn(scene)) {
            const data = remnantData(token);
            if (!data?.faint) continue;
            if (data.type !== "prep") continue;
            candidates.push({ token, data, scene });
        }
    }

    if (!candidates.length) return 0;

    const rows = candidates.map((c, i) => `
        <label class="drpg-checkbox">
            <input type="checkbox" name="promote" value="${i}" />
            ${foundry.utils.escapeHTML(
                `${c.data.visibilityLabel} ${REMNANT_TYPES[c.data.type]?.label ?? c.data.type}`
                + `${c.data.room ? ` · ${c.data.room}` : ""}`
                + `${c.data.sourceName ? ` · ${c.data.sourceName}` : ""}`
                + `${c.data.subject ? ` · ${c.data.subject}` : ""}`
            )}</label>`).join("");

    const picked = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Chapter.promoteTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p>${game.i18n.localize("DRPG.Chapter.promoteIntro")}</p>
            <fieldset>${rows}</fieldset>
            <p class="notes">${game.i18n.localize("DRPG.Chapter.promoteNote")}</p>
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Chapter.promoteConfirm"), default: true,
                callback: (e, b, d) => Array.from(
                    d.element.querySelectorAll("[name=promote]:checked")).map(i => Number(i.value))
            },
            { action: "skip", label: game.i18n.localize("DRPG.Chapter.promoteSkip") }
        ],
        rejectClose: false
    });

    if (!Array.isArray(picked) || !picked.length) return 0;

    /* INTO THE LEDGER (E04, 1.2.63; the owner's Q2, S06-02's writer half). The ticks
       were written onto the token as `faint: false` and `tiedToCrime: true`, flags
       every player's client receives and nothing read: the ledger row - what the
       dashboard, Observe and the chapter-end sweep read - kept `faint: true`. They
       are the dashboard's own write now, one store write for every trace ticked, and
       they reach the copied bullets as a hand-ticked box does. */
    const tokens = picked.map(index => candidates[index]?.token).filter(Boolean);
    let promoted = 0;
    try {
        promoted = await setRemnantFlagsMany(tokens, { faint: false, tiedToCrime: true });
    } catch (err) {
        error("Could not promote the Faint Prep Remnants", err);
    }

    log(`Promoted ${promoted} Faint Prep Remnant(s) to permanent evidence.`);
    return promoted;
}

/*
 * ONE DISCOVERY AT A TIME, IN ORDER (17.09).
 *
 * A teleport moves every token at once, so an assembly or a discovery fires one
 * `updateToken` per student within the same moment. The guard used to be a flag set just
 * before `discoverBody` - after three awaited imports - so every one of those checks got
 * past it before the first had set it, and each announced the same body and gathered the
 * cast again. Measured on 16.09: five "A BODY HAS BEEN DISCOVERED" cards from one assembly.
 *
 * Queued rather than dropped: a check that arrives while another runs may be the one that
 * completes the count of two witnesses, so it waits its turn, and by then the first has
 * written the discovery record that makes it a no-op if it was not.
 *
 * The GM's own announcement goes through the same queue (BODY-1). It used to call the
 * discovery directly, so its gather set off automatic checks that ran before its record
 * was written and announced the body a second time.
 */
let bodyWorkQueue = Promise.resolve(null);

function enqueueBodyWork(work) {
    const next = bodyWorkQueue.catch(() => null).then(work);
    bodyWorkQueue = next;
    return next;
}

/**
 * The body discovery announcement: promote the traces, call everyone to the
 * scene, and hold the game there until the GM answers.
 *
 * @param {object} options
 * @param {string} options.room     Where the body is.
 * @param {Actor} [options.victim]  Named in the announcement when given.
 */
export function discoverBody(options = {}) {
    if (!game.user.isGM || !options?.room) return Promise.resolve(null);
    return enqueueBodyWork(() => runDiscovery(options));
}

async function runDiscovery({ room, victim = null } = {}) {
    if (!game.user.isGM || !room) return null;

    // The Eclipse is a placement window nobody has finished crossing yet - see
    // the note on `maybeBodyFound`. Two things refuse before this now:
    // `openBodyDiscoveryDialog` asks before it opens its form, and the case
    // dashboard greys the footer button that reaches it (F12 - it used to be a GM
    // panel tile, and the greying stayed behind with the tile). This is the
    // backstop for anyone who gets here anyway, `game.drpg` console access
    // included.
    const { isEclipse } = await import("./eclipse.mjs");
    if (isEclipse()) {
        ui.notifications.warn(game.i18n.localize("DRPG.Eclipse.bodyLocked"));
        return null;
    }

    const promoted = await promoteFaintPrep();

    // Stage 7 takes the gloves. The guide puts the cleaning tool's destruction
    // here rather than at the end of Stage 6 - see CLEANUP.destroysToolsOnDiscovery.
    await import("./cleanup.mjs")
        .then(m => m.destroyCleaningTools())
        .catch(err => error("Could not destroy the cleaning tools at body discovery", err));

    const { gatherEveryone } = await import("./call-effects.mjs");
    const moved = await gatherEveryone(room);

    // The moment the chapter changes genre, on every screen at once. The card
    // is already public, so the flag needs nothing else from anybody.
    await announce({
        flags: { [MODULE_ID]: { sfx: { key: "bodyFound", gm: true } } },
        content: `<div class="drpg-evidence-card">
            <div class="drpg-objection-banner">${
                game.i18n.localize("DRPG.Chapter.bodyBanner")}</div>
            <p>${victim
                ? game.i18n.format("DRPG.Chapter.bodyFoundNamed", {
                    name: foundry.utils.escapeHTML(victim.name),
                    room: foundry.utils.escapeHTML(room)
                })
                : game.i18n.format("DRPG.Chapter.bodyFound", {
                    room: foundry.utils.escapeHTML(room)
                })}</p>
            <p>${game.i18n.localize("DRPG.Chapter.bodyCalled")}</p>
        </div>`
    });

    /*
     * THE DISCOVERY IS NOT THE INVESTIGATION (D5).
     *
     * This used to move the phase, which meant finding a body ended Daily
     * Life on the spot. It is a held state now: the card stands, the music
     * stops, and the phase waits for the GM to start the Investigation.
     * Written on every route, including one that reaches here with the phase
     * already at `investigation` - the card has nothing else to read, since
     * `endMurder` wipes `murderState` before the GM presses anything.
     */
    await setBodyDiscovery({ room, victimId: victim?.id ?? null });

    ui.notifications.info(plural("DRPG.Chapter.bodyDone", { moved, promoted }, "promoted"));
    log(`Body discovered in ${room}: ${promoted} trace(s) promoted, ${moved} token(s) gathered.`);
    return { promoted, moved };
}

/**
 * Two or more people walk in on a corpse, at least one of them with nothing to
 * do with the death. That is the discovery.
 *
 * The guide's trigger is people finding the body, not a GM remembering to press
 * a button - and the button was the only thing that could fire Stage 7, so an
 * investigation began when somebody noticed the screen rather than when the
 * cast noticed the body. Watched on token movement, the same way a third party
 * walking into a running incident is watched.
 *
 * The killer standing alone over their own victim has not discovered anything -
 * that is the classic frame-up, and the guide leaves it to the table. But a
 * killer or an accomplice (`blackenedIds` carries both across the end of the
 * incident, which is why this can run after the state is gone) DOES count
 * toward the two once somebody unconnected to the incident is standing there
 * too: walking back to your own crime scene alongside a witness is still being
 * found there. A Monokuma is not a witness either - see `maybeThirdParty`,
 * same rule - and nor is a hidden token or a second body.
 *
 * Two is the count, and at least one of the two has to be unconnected to the
 * incident - a room full of nothing but killers and accomplices is not a
 * discovery.
 */
// Queued with the GM's own announcement - see `enqueueBodyWork`.
export function maybeBodyFound(tokenDoc) {
    if (!game.user.isGM) return Promise.resolve(null);
    return enqueueBodyWork(() => checkBodyFound(tokenDoc));
}

async function checkBodyFound(tokenDoc) {
    if (!game.user.isGM) return null;
    // Already in Stage 7, or a body found and waiting on the GM. Both are
    // "this has already been discovered"; the second is the whole of D5.
    if (getClock().phase === "investigation" || bodyDiscovery()) return null;

    // The Eclipse is everyone crossing the map with their eyes shut - the guide
    // gives that window to placement, not to the cast stumbling over a body
    // while half of them have not finished moving yet. Without this, two
    // students placing through the same room mid-Eclipse would "discover" a
    // body in the middle of a window nobody has confirmed.
    const { isEclipse } = await import("./eclipse.mjs");
    if (isEclipse()) return null;

    // Everything here compares actor IDs, never actor objects.
    //
    // An unlinked token does not carry the world actor - Foundry hands it a
    // synthetic copy with the token's own overrides applied - so `includes(actor)`
    // is false for every unlinked token on the scene, however plainly the person
    // is standing there. Measured: a student in the room with the body was not
    // counted as a witness for exactly this reason.
    const students = new Set(studentActors().map(a => a.id));
    // A BODY IS THIS CHAPTER'S DEAD, AND NOT A MONOCUB (17.09, BODY-2, BODY-3). A Monocub keeps
    // the deceased flag and walks the board, so standing beside two students announced their
    // own corpse; and a body from an earlier chapter, found and tried long ago, set off a
    // second discovery the first time two people passed it. The death record carries the
    // chapter it happened in; a record without one is treated as this chapter's.
    const chapter = getClock().chapter;
    const bodies = new Set(studentActors()
        .filter(a => isDeceased(a) && !a.getFlag(MODULE_ID, FLAGS.monocub)
            && (deathRecord(a)?.chapter ?? chapter) === chapter)
        .map(a => a.id));
    if (!bodies.size) return null;

    const { roomOfToken } = await import("./movement.mjs");
    const room = roomOfToken(tokenDoc);
    if (!room) return null;

    // The body has to be in the room somebody just walked into.
    const scene = tokenDoc.parent;
    const bodyHere = scene?.tokens?.find(t =>
        t.actor && bodies.has(t.actor.id) && !t.hidden && roomOfToken(t) === room);
    if (!bodyHere) return null;

    /* AND THE KILLERS STILL CLEANING UP (22.09). The Blackened register is written when the
       murder is closed, so during the clean-up it was empty: a killer and a partner in crime
       standing by the body were two "witnesses", and the body was discovered in the middle of
       their own Stage 6. The running incident's killers count as involved too. */
    const { blackenedIds, killerIds, murderState } = await import("./murder.mjs");
    const involved = new Set([...blackenedIds(), ...killerIds(murderState())]);

    const witnesses = scene.tokens.filter(t => {
        const actor = t.actor;
        if (!actor || actor.type !== "character") return false;
        if (t.hidden) return false;
        if (bodies.has(actor.id)) return false;
        if (!students.has(actor.id)) return false;            // excludes Monokumas
        return roomOfToken(t) === room;
    });

    // Two in the room, and at least one of them did not do this. A killer is
    // part of the pool, never the whole of it.
    if (witnesses.length < 2) return null;
    if (!witnesses.some(w => !involved.has(w.actor.id))) return null;

    log(`Body found in ${room}: ${witnesses.map(t => t.actor.name).join(", ")} walked in.`);
    // Already inside the queue: straight to the work, not back through `discoverBody`,
    // which would wait behind this very call.
    return await runDiscovery({ room, victim: bodyHere.actor });
}

/** The body-discovery announcement, from the case dashboard's footer. */
export async function openBodyDiscoveryDialog() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    /*
     * REFUSED BEFORE THE FORM, NOT AFTER IT (F12).
     *
     * `runDiscovery` has always refused an Eclipse and is still the backstop for
     * anything that reaches the work directly - but it refuses AFTER the GM has
     * chosen a room and a victim and pressed Announce, so the answer arrived as a
     * warning over work that was then thrown away. Asked here, the window never
     * opens, on every route at once: the case dashboard's footer, the
     * post-incident window's first button, and the console.
     *
     * SECOND IN THE ORDER, deliberately. Who may press this comes before when it
     * may be pressed, and both come before what the map happens to have: a GM told
     * "this scene has no room regions" mid-Eclipse would go and draw some for a
     * window that was going to refuse anyway.
     */
    const { isEclipse } = await import("./eclipse.mjs");
    if (isEclipse()) {
        ui.notifications.warn(game.i18n.localize("DRPG.Eclipse.bodyLocked"));
        return null;
    }

    const { allRooms } = await import("./movement.mjs");
    const rooms = allRooms();
    if (!rooms.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Chapter.noRooms"));
        return null;
    }

    // The dead are the candidates here - the victim is normally already marked
    // by the time anybody trips over them.
    const dead = studentActors().filter(isDeceased);
    const victims = dead
        .map(a => `<option value="${a.id}">${foundry.utils.escapeHTML(a.name)}</option>`).join("");

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Chapter.bodyTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <label>${game.i18n.localize("DRPG.Chapter.whereBody")}
                <select name="room">${rooms
                    .map(r => `<option value="${foundry.utils.escapeHTML(r)}">${
                        foundry.utils.escapeHTML(r)}</option>`).join("")}</select></label>
            <label>${game.i18n.localize("DRPG.Chapter.whoseBody")}
                <select name="victim">
                    <option value="">${game.i18n.localize("DRPG.Chapter.unnamedVictim")}</option>
                    ${victims}
                </select></label>
            <p class="notes">${game.i18n.localize("DRPG.Chapter.bodyNote")}</p>
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Chapter.announce"), default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return { room: f.room.value, victimId: f.victim.value };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return null;

    return discoverBody({
        room: result.room,
        victim: result.victimId ? game.actors.get(result.victimId) : null
    });
}

/* ==========================================================================
 * CHAPTER END AND THE NEXT SESSION
 * ========================================================================== */

/** Every Truth Bullet in the world, with the actor holding it. */
function allBullets() {
    const out = [];
    for (const actor of game.actors) {
        if (actor.type !== "character") continue;
        for (const item of bulletsOf(actor)) out.push({ actor, item });
    }
    return out;
}

/**
 * The chapter is over: every Truth Bullet gives up what it really was.
 *
 * Reads the answer key and writes it onto the items, so the reveal survives on
 * the players' sheets rather than being a message they have to remember.
 */
export async function revealAllBulletTypes() {
    if (!game.user.isGM) return 0;

    let revealed = 0;
    for (const { item } of allBullets()) {
        const realType = secretOf(item.uuid).realType;
        if (!realType) continue;
        if (item.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.shownType) === realType
            && item.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.analyzed)) continue;

        try {
            await item.update({
                [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.shownType}`]: realType,
                [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.analyzed}`]: true,
                /* Faint goes public with the type, because this is the same moment
                   Analyze is - the bullet gives up what it really was. Without this
                   line the chapter's reveal would leave every doubtful trace looking
                   solid on the sheets it has just been written onto. */
                [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.faint}`]: faintOf(item)
            });
            revealed++;
        } catch (err) {
            error(`Could not reveal the type of "${item.name}"`, err);
        }
    }

    log(`Revealed the real type of ${revealed} Truth Bullet(s).`);
    return revealed;
}

/**
 * Clear the evidence out, Faint and Final excepted.
 *
 * Guide, p. 29. Faint bullets are what survive, and Stage 3's lock is written
 * per chapter, so a Faint bullet carried across becomes analysable again all by
 * itself - nothing here has to unlock anything.
 *
 * NOTHING CALLS THIS ON A SCHEDULE ANY MORE (Z7). It used to be a tick in the
 * end-of-chapter window, and the season run measured what that tick was worth:
 * thirty to sixty bullets a chapter deleted, while the FOG the investigation was
 * actually drowning in - the four hundred Prep traces left by ordinary searches
 * - survived every time, because a death ties every trace of its chapter to the
 * crime and tied traces are exempt. The sweep took the evidence and left the
 * noise. Precisely backwards.
 *
 * So it stops happening because a date passed, and stays available because a GM
 * asks: the button is in the Investigation Dashboard, next to the one that
 * clears Faint Remnants, and both say how many before they do anything.
 */
export async function sweepTruthBullets() {
    if (!game.user.isGM) return { removed: 0, kept: 0 };

    let removed = 0;
    let kept = 0;

    for (const actor of game.actors) {
        if (actor.type !== "character") continue;

        const doomed = [];
        for (const item of bulletsOf(actor)) {
            /* `faintOf`, NOT THE ITEM'S FLAG. Since 1.2.47 Faint is published onto
               a player's item only once they have analysed the bullet, so the flag
               reads false for every doubtful trace nobody has spent a Head roll on -
               and this sweep would have taken exactly the evidence Faint exists to
               carry across. The ledger is the truth and this runs GM-side, where the
               ledger is readable; `faintOf` falls back to the item for a world made
               before the change. */
            if (faintOf(item)) {
                kept++;
                continue;
            }
            // Guide, p. 32: a Final Truth Bullet is "wyłączony ze sweepu" - it
            // points at the Mastermind across the whole season, not one chapter's
            // case, so the same reveal-and-clear cadence that resets everything
            // else must leave it alone.
            if (secretOf(item.uuid).realType === "final") {
                kept++;
                continue;
            }
            doomed.push(item);
        }

        if (!doomed.length) continue;

        for (const item of doomed) await dropSecret(item.uuid);
        try {
            await actor.deleteEmbeddedDocuments("Item", doomed.map(i => i.id));
            removed += doomed.length;
        } catch (err) {
            error(`Could not sweep ${actor.name}'s Truth Bullets`, err);
        }
    }

    log(`Swept ${removed} Truth Bullet(s); ${kept} Faint one(s) carried over.`);
    return { removed, kept };
}

/**
 * The GM's end-of-chapter panel.
 *
 * One screen with counts, because two of these three cannot be undone and a GM
 * deserves to see the number before it happens rather than after.
 */
/**
 * Take this chapter's planted Key Remnants off the map.
 *
 * NOTHING DID THIS, AND NOTHING COULD. A Key Remnant is placed `reinforced` and
 * `tiedToCrime` on purpose - it has to survive the killer's clean-up and the Faint sweep,
 * or the trial it exists to make solvable can be erased by the person it accuses. The cost
 * of that armour is that no existing sweep can ever remove one: measured on 10.09, chapter
 * two began with chapter one's five clues still lying about, and the planner - which resets
 * with the chapter - could no longer see them to say so.
 *
 * Scoped to the chapter that is ending, so a clue planted early for a later chapter stays,
 * and the ledger row goes with the token rather than being left behind as a trace a GM can
 * see and not read (the same pairing `removeRemnant` makes).
 */
export async function clearChapterKeyRemnants(chapter) {
    if (!game.user.isGM) return 0;
    const { dropRemnantSecret } = await import("./remnants.mjs");
    let cleared = 0;
    for (const scene of game.scenes) {
        const doomed = remnantsOn(scene).filter(t => {
            const info = remnantData(t);
            return info?.type === "key" && info.chapter === chapter;
        });
        if (!doomed.length) continue;
        for (const token of doomed) await dropRemnantSecret(token);
        await scene.deleteEmbeddedDocuments("Token", doomed.map(t => t.id));
        cleared += doomed.length;
    }
    log(`Took ${cleared} Key Remnant(s) off the map at the end of chapter ${chapter}.`);
    return cleared;
}

/** The chapter window's line about the case's last backup (E04), from the world's case mark. */
function backupReminder() {
    const at = caseMark().lastBackupAt;
    const days = at ? Math.floor((Date.now() - at) / 86400000) : null;
    return game.i18n.format("DRPG.Case.chapterReminder", {
        when: days === null ? game.i18n.localize("DRPG.Case.backupNever")
            : days < 1 ? game.i18n.localize("DRPG.Case.backupToday") : plural("DRPG.Case.backupAgo", { n: days })
    });
}

export async function openChapterEndDialog() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const bullets = allBullets();
    // The SAME test the reveal itself applies, or the preview promises work the
    // action will not do.
    //
    // It used to count every unanalysed bullet, while `revealAllBulletTypes`
    // skips any bullet with no real type in the answer key. So a table with two
    // unanalysed bullets that nobody had ever assigned a type to was offered
    // "reveal 2" and got back "Revealed 0" - and no way to tell whether the
    // tool had worked.
    const unanalysed = bullets.filter(({ item }) =>
        !item.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.analyzed));
    const hidden = unanalysed.filter(({ item }) => secretOf(item.uuid).realType).length;
    // ...and the difference is worth saying out loud rather than swallowing: a
    // bullet nobody assigned a type to is a loose end, not a rounding error.
    const typeless = unanalysed.length - hidden;

    const { finalTruthPlacedThisChapter } = await import("./mastermind.mjs");
    const finalTruthPlaced = finalTruthPlacedThisChapter();

    /* WHAT THE THREE CLEAN-UPS WOULD TAKE, COUNTED BEFORE THEY ARE OFFERED.
       Each count applies the same rule its action does, for the reason the reveal count
       above already gives: a checkbox that promises work the action will not do is worse
       than no checkbox. `sweepTruthBullets` keeps Faint and Final; `clearFaintRemnants`
       keeps anything reinforced or tied to the crime; the Key sweep takes this chapter's
       own planted clues and nothing older. */
    const endingChapter = getClock().chapter;
    const sweepable = bullets.filter(({ item }) =>
        // the same reader the sweep itself uses, or the count would promise work
        // the action will not do - which is the whole point of the note above
        !faintOf(item)
        && secretOf(item.uuid).realType !== "final").length;
    /* AND WHETHER THE TRIAL IS STILL SITTING. The clock is the authority, not the
       floor: a trial in session with nobody holding the floor has no floor record at
       all, and it is still a trial - see the note on the HUD's four states. */
    const trialSitting = getClock().phase === "classTrial";
    // The season's last chapter (CORE-10): moving on to a seventh is never what
    // the GM means; the reset lives under Between sessions.
    const lastChapter = (Number(getClock().chapter) || 1) >= CHAPTERS_PER_SEASON;

    let faintable = 0, keyable = 0;
    for (const scene of game.scenes) {
        for (const token of remnantsOn(scene)) {
            const info = remnantData(token);
            if (!info) continue;
            if (info.faint && !info.reinforced && !info.tiedToCrime) faintable++;
            if (info.type === "key" && info.chapter === endingChapter) keyable++;
        }
    }

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Chapter.endTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p>${game.i18n.format("DRPG.Chapter.endIntro", { chapter: getClock().chapter })}</p>
            <label class="drpg-checkbox">
                <input type="checkbox" name="reveal" checked />
                ${game.i18n.format("DRPG.Chapter.optReveal", { n: hidden })}</label>
            ${typeless ? `<p class="notes drpg-warning">${
                plural("DRPG.Chapter.typeless", { n: typeless })}</p>` : ""}
            <hr />
            <label class="drpg-checkbox">
                <input type="checkbox" name="sweep"${sweepable ? " checked" : " disabled"} />
                ${game.i18n.format("DRPG.Chapter.optSweep", { n: sweepable })}</label>
            <label class="drpg-checkbox">
                <input type="checkbox" name="faint"${faintable ? " checked" : " disabled"} />
                ${game.i18n.format("DRPG.Chapter.optFaint", { n: faintable })}</label>
            <label class="drpg-checkbox">
                <input type="checkbox" name="keys"${keyable ? " checked" : " disabled"} />
                ${game.i18n.format("DRPG.Chapter.optKeys", { n: keyable })}</label>
            <hr />
            <label class="drpg-checkbox">
                <input type="checkbox" name="endTrial"${trialSitting ? " checked" : " disabled"} />
                ${game.i18n.localize("DRPG.Chapter.optEndTrial")}</label>
            <label class="drpg-checkbox">
                <input type="checkbox" name="nextChapter"${lastChapter ? "" : " checked"} />
                ${game.i18n.format("DRPG.Chapter.optNextChapter", {
                    from: getClock().chapter, to: getClock().chapter + 1 })}</label>
            ${lastChapter ? `<p class="notes drpg-warning">${game.i18n.format("DRPG.Chapter.lastChapter", {
                    n: getClock().chapter, next: getClock().chapter + 1 })}</p>` : ""}
            <label class="drpg-checkbox">
                <input type="checkbox" name="nextSession" checked />
                ${game.i18n.format("DRPG.Chapter.optNextSession", {
                    from: getClock().session, to: getClock().session + 1 })}</label>
            <label class="drpg-checkbox">
                <input type="checkbox" name="nextMorning" checked />
                ${game.i18n.format("DRPG.Chapter.optNextMorning", {
                    day: (getClock().day ?? 1) + 1 })}</label>
            <p class="notes">${game.i18n.localize("DRPG.Chapter.endNote")}</p>
            <p class="notes${finalTruthPlaced ? "" : " drpg-warning"}">${game.i18n.localize(
                finalTruthPlaced
                    ? "DRPG.Mastermind.finalTruthPlaced"
                    : "DRPG.Mastermind.finalTruthReminder")}</p>
            <p class="notes">${esc(backupReminder())}
                <button type="button" data-drpg-backup>${esc(game.i18n.localize("DRPG.Case.backupTile"))}</button></p>
        </form>`),
        // The case's backup, from the window a chapter closes in (E04): the answer
        // keys it is about to reveal and sweep live in GM browsers, not the world.
        render: (event, dialog) => {
            dialog.element?.querySelector("[data-drpg-backup]")?.addEventListener("click", ev => {
                ev.preventDefault();
                import("./gm-stores.mjs").then(m => m.backupCase({ ask: true }))
                    .catch(err => error("Could not back up the case", err));
            });
        },
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Chapter.endConfirm"), default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return {
                        reveal: f.reveal.checked,
                        sweep: f.sweep.checked,
                        faint: f.faint.checked,
                        keys: f.keys.checked,
                        endTrial: f.endTrial.checked,
                        nextChapter: f.nextChapter.checked,
                        nextSession: f.nextSession.checked,
                        nextMorning: f.nextMorning.checked,
                        // The chapter this window was opened for, so a second
                        // GM's End of chapter cannot end the next one (CORE-17).
                        endingChapter: getClock().chapter
                    };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return null;

    return applyChapterEnd(result);
}

/**
 * Everything the End of chapter screen does, once the GM has said which parts.
 *
 * SEPARATE FROM THE ASKING, and the reason is a test that could not be written.
 * The wiring here has been wrong twice - the archive that never fired, the trial
 * left sitting - and both times what caught it was driving a whole chapter through
 * a browser, which is a fifteen-minute answer to a question the suite should give
 * in a second. A dialog cannot be called from a test; this can.
 *
 * It also gives the console and a macro the same door the screen has:
 * `game.drpg.applyChapterEnd({ endTrial: true, nextChapter: true })`.
 *
 * The world is read HERE rather than passed in from the dialog. Everything below
 * is scoped to "the chapter that is ending" and "is the trial sitting", and both
 * are facts about the moment the work runs, not about the moment the GM was asked.
 *
 * @param {object} choices Which parts to do. Anything absent is not done, so a
 *   caller can ask for one step without knowing about the others.
 */
export async function applyChapterEnd(choices = {}) {
    if (!game.user.isGM) return null;

    const result = choices;
    const endingChapter = getClock().chapter;
    const trialSitting = getClock().phase === "classTrial";

    // Two GMs with the console open pressing End of chapter a few seconds
    // apart moved the clock two chapters and swept twice (CORE-17). Optional,
    // so the API and the suite can still call this without naming a chapter.
    if (choices.endingChapter != null && choices.endingChapter !== endingChapter) {
        await whisperToGms(`<p class="drpg-warning">${game.i18n.format("DRPG.Chapter.alreadyEnded", {
            n: choices.endingChapter
        })}</p>`);
        return null;
    }

    const done = [];
    if (result.reveal) {
        done.push(plural("DRPG.Chapter.doneReveal", { n: await revealAllBulletTypes() }));
    }

    /* THE THREE CLEAN-UPS, IN THE ORDER THEY HAVE TO HAPPEN.
       Reveal first (above) - it reads the bullets the sweep is about to take. Then the
       sweep, then the Remnants, and only then the clock, because everything here is scoped
       to the chapter that is ENDING and the moment the clock moves, "this chapter" means
       the next one. Measured on 10.09: crossing a chapter with none of this wired left the
       map holding the previous case's five clues and the players holding its Truth Bullets,
       while the plan that described them was silently discarded - the module dropped the
       GM's knowledge and kept everybody else's. */
    if (result.sweep) {
        const { removed } = await sweepTruthBullets();
        done.push(plural("DRPG.Chapter.doneSweep", { n: removed }));
    }
    if (result.faint) {
        const { clearFaintRemnants } = await import("./remnants.mjs");
        done.push(plural("DRPG.Chapter.doneFaint", { n: await clearFaintRemnants() }));
    }
    if (result.keys) {
        done.push(plural("DRPG.Chapter.doneKeys",
            { n: await clearChapterKeyRemnants(endingChapter) }));
    }

    /* AND THE PLAN IS FILED BEFORE THE CLOCK MOVES. `keyPlan()` returns a fresh set of rows
       the moment the chapter changes, so whatever the GM wrote about this case is only
       reachable until the line below runs. Silent, and unconditional: it costs nothing, it
       cannot fail in a way worth reporting, and the alternative is a GM who ends a chapter
       and finds their five clues gone. */
    try {
        const { archiveKeyPlan } = await import("./investigation.mjs");
        await archiveKeyPlan(endingChapter);
    } catch (err) {
        error("Could not file the chapter's Key Remnant plan", err);
    }

    // The register of who killed belongs to the chapter that is ending. Cleared
    // whatever else was ticked, and silently: it is bookkeeping the GM never
    // asked for and would only wonder about.
    try {
        const { clearBlackened, blackenedIds } = await import("./murder.mjs");
        if (blackenedIds().length) await clearBlackened();
    } catch (err) {
        error("Could not clear the chapter's Blackened register", err);
    }

    // And the chapter actually ends.
    //
    // The window is called "End of chapter / new session" and did three
    // clean-ups without touching either counter - measured, the clock read
    // Chapter 1 · Session 5 before and after, and the GM had to go and nudge
    // both by hand in "Edit campaign…". Tidying up and moving on are one event
    // at the table, so they are one screen here.
    const clock = getClock();
    const move = {};
    if (result.nextChapter) move.chapter = clock.chapter + 1;
    if (result.nextSession) move.session = clock.session + 1;
    if (Object.keys(move).length) {
        const { setClock } = await import("./clock.mjs");
        await setClock(move);
        done.push(game.i18n.format("DRPG.Chapter.moved", {
            chapter: move.chapter ?? clock.chapter,
            session: move.session ?? clock.session
        }));
    }

    /* AND THE ROOM EMPTIES. LAST, AND THAT ORDER IS THE POINT.

       Everything above is scoped to the chapter that is ending, so it has to run
       while the clock still says so. This one is scoped to what comes AFTER: the
       phase the next chapter opens in, and the elapsed clock that the first Daily
       Life of it is measured against. Closing the trial before the move would start
       that clock against a chapter that had not begun yet.

       Measured on 10.09, with the whole chapter driven end to end: this screen moved
       the clock to chapter 2 and left `phase: "classTrial"` with the debate floor
       open. The GM was told "The debate is open - Nonstop Debate." and pointed back
       at the trial they had just finished; every player's HUD read "Chapter 2 - Day 2
       - Class Trial". The way out existed - one button, listed BELOW this screen's
       own on the trial console - and nothing anywhere said to press it. */
    if (result.endTrial && trialSitting) {
        try {
            const { closeTrial } = await import("./trial-floor-ui.mjs");
            if (await closeTrial()) done.push(game.i18n.localize("DRPG.Chapter.doneEndTrial"));
        } catch (err) {
            error("Could not close the trial at the end of the chapter", err);
        }
    }

    /* AND THE NEXT CHAPTER OPENS THE FOLLOWING MORNING.

       This screen moved the chapter and the session and nothing else, which left the
       clock reading whatever the trial ended on. Measured across two chapters run end
       to end on 11.09: chapter 1 finished at Day 1 - Night and chapter 2 opened at Day
       1 - Night, with everybody's actions still spent from the time of day before the
       murder. The panel duly reported "1 student still has actions to spend", which was
       true and was a leftover.

       Murders happen at night, so this is not an edge case - it is where every chapter
       ends. And the fix is not "reset the clock": it is the next MORNING, one day on,
       which is the beat the table is actually resuming from. Actions and search tokens
       come back because that is what a new time of day does, through the same call
       every other advance uses rather than a second copy of the rule.

       LAST, AFTER THE TRIAL IS CLOSED. `closeTrial` puts the phase back to Daily Life
       and starts the elapsed clock; announcing a new morning before that would post the
       card into a Class Trial that has not finished. */
    if (result.nextMorning) {
        try {
            const { setTimeOfDay } = await import("./clock.mjs");
            // One write for the day and the hour: each write is a full redraw
            // on every client (CORE-12).
            await setTimeOfDay("morning", {
                resetActions: true, resetSearchTokens: true, announce: true,
                also: { day: (getClock().day ?? 1) + 1 }
            });
            done.push(game.i18n.format("DRPG.Chapter.doneNextMorning",
                { day: getClock().day }));
        } catch (err) {
            error("Could not open the next chapter on a fresh morning", err);
        }
    }

    // Nothing outlives its chapter. Ordinarily the trial's phase change cleared
    // this long ago; a GM who ended a chapter straight out of Daily Life would
    // otherwise carry a body card into the next one.
    await clearBodyDiscovery();

    if (!done.length) return null;

    await whisperToGms(`<h3>${game.i18n.localize("DRPG.Chapter.endTitle")}</h3>
        <ul>${done.map(d => `<li>${d}</li>`).join("")}</ul>`);
    return done;
}
