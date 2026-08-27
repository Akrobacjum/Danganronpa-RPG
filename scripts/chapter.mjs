/**
 * Danganronpa RPG — how a chapter ends, and how a character stops.
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
 *   the session starts  the evidence is cleared out, Faint excepted
 *
 * All three are GM buttons rather than clock triggers, and deliberately so. Two
 * of them delete things that cannot be brought back, and the moment a chapter
 * "ends" is a judgement about the fiction — after the verdict, after the
 * execution, when the table is ready — not a number ticking over. A sweep that
 * fired by itself because somebody nudged the session counter would be the
 * worst bug this module could have.
 *
 * Everything here runs on a GM client: the answer key lives there (see D6 and
 * truth-bullets.mjs), and only a GM may write to another player's sheet.
 */

import { MODULE_ID, FLAGS, ITEM_CATEGORIES, REMNANT_TYPES } from "./config.mjs";
import { getClock, setPhase } from "./clock.mjs";
import { TRUTH_BULLET_FLAGS, bulletsOf, secretOf, dropSecret } from "./truth-bullets.mjs";
import { remnantsOn, remnantData, REMNANT_FLAGS } from "./remnants.mjs";
import { studentActors } from "./monokuma.mjs";
import { announce, dialogContent, whisperToGms, gmIds, ownerOf, log, error, plural }
    from "./utils.mjs";

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
 * Decision D1, in one procedure: everything they were carrying goes, Truth
 * Bullets included, and the answer-key entries go with the bullets so the
 * ledger does not fill up with rows nothing can ever reach again.
 *
 * Quiet on purpose. A murder is a secret until somebody finds the body — the
 * announcement belongs to `discoverBody`, not here. Only the GMs are told.
 *
 * The token stays where it is. A body is usually the thing the cast will be
 * standing around looking at; what changes is that the rules stop counting them
 * as a person in the room (see `FLAGS.deceased` and `othersInRoom`).
 *
 * @param {Actor} actor
 * @param {object} [options]
 * @param {boolean} [options.keepItems]  Leave the inventory alone. For a death
 *   that is not a killing-game murder — a retcon, a test — where D1's "it all
 *   vanishes" would just be destructive.
 */
export async function killCharacter(actor, { keepItems = false } = {}) {
    if (!game.user.isGM || !actor) return null;
    if (isDeceased(actor)) {
        ui.notifications.warn(game.i18n.format("DRPG.Chapter.alreadyDead", { name: actor.name }));
        return null;
    }

    const clock = getClock();
    const record = { chapter: clock.chapter, day: clock.day, timeOfDay: clock.timeOfDay };

    let removed = 0;
    if (!keepItems) {
        // The ledger entries first, while the items still exist to be read.
        for (const bullet of bulletsOf(actor)) await dropSecret(bullet.uuid);

        const doomed = actor.items
            .filter(i => Object.keys(ITEM_CATEGORIES).includes(i.getFlag(MODULE_ID, "category")))
            .map(i => i.id);

        if (doomed.length) {
            try {
                await actor.deleteEmbeddedDocuments("Item", doomed);
                removed = doomed.length;
            } catch (err) {
                error(`Could not clear ${actor.name}'s inventory on death`, err);
            }
        }
    }

    try {
        await actor.setFlag(MODULE_ID, FLAGS.deceased, record);
    } catch (err) {
        error(`Could not mark ${actor.name} as deceased`, err);
        return null;
    }

    // Foundry's own dead marker, so the token reads as a body on any client
    // without this module having to draw anything. Wrapped: it is a convenience,
    // not the record — `FLAGS.deceased` is what the rules read.
    try {
        await actor.toggleStatusEffect("dead", { active: true, overlay: true });
    } catch (err) {
        log(`Could not apply the "dead" status to ${actor.name}; the flag is set regardless.`);
    }

    /*
     * WHO IS TOLD A STUDENT DIED (Dawid, 28.08 — widen it).
     *
     * The card used to reach the GMs alone. It now also reaches the owners of
     * everyone inside a running incident, which is the audience the sound is
     * for and therefore the audience the card has to have: the flag rides the
     * message, so the two cannot drift apart. Nobody learns anything they did
     * not already know — they were in the room.
     *
     * Outside an incident there are no participants and this is exactly what
     * it always was, a whisper to the GMs.
     *
     * The list is built the way `announceTimeOfDay` builds it in clock.mjs,
     * from `gmIds()` plus the participants' owners — same function, same
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
        ${keepItems ? "" : `<p>${plural("DRPG.Chapter.itemsGone", { n: removed })}</p>`}
        <p><small>${game.i18n.localize("DRPG.Chapter.vaultPending")}</small></p>`, {
        whisper: deathAudience ?? gmIds(),
        flags: { [MODULE_ID]: { sfx: { key: "death", gm: true } } }
    });

    log(`${actor.name} is dead (chapter ${record.chapter}); ${removed} item(s) removed.`);

    // The VICTIM of the running incident died — and only then (Dawid, 26.08):
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
 * The victim of a running incident just died — offer Stage 6.
 *
 * The murder engine only reaches Stage 6 through a Finishing Blow, and a GM
 * who kills the victim any other way (this screen, a ruling, a Despair Call)
 * left the incident frozen at stage "incident" around a corpse: `isCleaner`
 * false, no clean-up screen for the killer, and the whole Stage 6 branch
 * unreachable. Measured before this existed — the stage stayed "incident" and
 * `attemptStageSix` refused with "you are not the one cleaning up this scene",
 * which was not the reason.
 *
 * Asked rather than done: the GM may be killing somebody mid-incident for a
 * reason that is not the incident ending — Monokuma's punishment, a Call, a
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
 * Undo the marking. The inventory does NOT come back — those documents are
 * gone — so this is for a mis-click, not for a resurrection.
 */
export async function reviveCharacter(actor) {
    if (!game.user.isGM || !actor) return false;

    try {
        await actor.unsetFlag(MODULE_ID, FLAGS.deceased);
        await actor.toggleStatusEffect("dead", { active: false });
    } catch (err) {
        error(`Could not un-mark ${actor.name}`, err);
        return false;
    }

    ui.notifications.info(game.i18n.format("DRPG.Chapter.revived", { name: actor.name }));
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
    // Everything else about the procedure — the warning, the choice about the
    // inventory, `killCharacter` itself — has to stay exactly the same, which
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
                <input type="checkbox" name="keepItems" />
                ${game.i18n.localize("DRPG.Chapter.keepItems")}</label>
            <p class="notes">${game.i18n.localize("DRPG.Chapter.deathNote")}</p>
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Chapter.confirmDeath"), default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return { id: actor?.id ?? f.actor.value, keepItems: f.keepItems.checked };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return false;

    const dying = game.actors.get(result.id);
    if (!dying) return false;
    return Boolean(await killCharacter(dying, { keepItems: result.keepItems }));
}

/* ==========================================================================
 * THE BODY IS FOUND
 * ========================================================================== */

/**
 * Faint Prep traces that belong to this murder stop being doubtful.
 *
 * Which ones those are is a judgement only the GM can make — a Prep Remnant is
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

    let promoted = 0;
    for (const index of picked) {
        const entry = candidates[index];
        if (!entry) continue;
        try {
            await entry.token.update({
                [`flags.${MODULE_ID}.${REMNANT_FLAGS.faint}`]: false,
                [`flags.${MODULE_ID}.${REMNANT_FLAGS.tiedToCrime}`]: true
            });
            promoted++;
        } catch (err) {
            error("Could not promote a Faint Prep Remnant", err);
        }
    }

    log(`Promoted ${promoted} Faint Prep Remnant(s) to permanent evidence.`);
    return promoted;
}

/**
 * The body discovery announcement: promote the traces, call everyone to the
 * scene, and turn the phase over to Investigation.
 *
 * @param {object} options
 * @param {string} options.room     Where the body is.
 * @param {Actor} [options.victim]  Named in the announcement when given.
 */
export async function discoverBody({ room, victim = null } = {}) {
    if (!game.user.isGM || !room) return null;

    // The Eclipse is a placement window nobody has finished crossing yet — see
    // the note on `maybeBodyFound`. The panel tile that reaches this is greyed
    // out with a tooltip while an Eclipse runs (see gm-panel.mjs); this is the
    // backstop for anyone who gets here anyway, `game.drpg` console access
    // included.
    const { isEclipse } = await import("./eclipse.mjs");
    if (isEclipse()) {
        ui.notifications.warn(game.i18n.localize("DRPG.Eclipse.bodyLocked"));
        return null;
    }

    const promoted = await promoteFaintPrep();

    // Stage 7 takes the gloves. The guide puts the cleaning tool's destruction
    // here rather than at the end of Stage 6 — see CLEANUP.destroysToolsOnDiscovery.
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

    await setPhase("investigation");

    ui.notifications.info(plural("DRPG.Chapter.bodyDone", { moved, promoted }, "promoted"));
    log(`Body discovered in ${room}: ${promoted} trace(s) promoted, ${moved} token(s) gathered.`);
    return { promoted, moved };
}

/**
 * Two or more people walk in on a corpse, at least one of them with nothing to
 * do with the death. That is the discovery.
 *
 * The guide's trigger is people finding the body, not a GM remembering to press
 * a button — and the button was the only thing that could fire Stage 7, so an
 * investigation began when somebody noticed the screen rather than when the
 * cast noticed the body. Watched on token movement, the same way a third party
 * walking into a running incident is watched.
 *
 * The killer standing alone over their own victim has not discovered anything —
 * that is the classic frame-up, and the guide leaves it to the table. But a
 * killer or an accomplice (`blackenedIds` carries both across the end of the
 * incident, which is why this can run after the state is gone) DOES count
 * toward the two once somebody unconnected to the incident is standing there
 * too: walking back to your own crime scene alongside a witness is still being
 * found there. A Monokuma is not a witness either — see `maybeThirdParty`,
 * same rule — and nor is a hidden token or a second body.
 *
 * Two is the count, and at least one of the two has to be unconnected to the
 * incident — a room full of nothing but killers and accomplices is not a
 * discovery.
 */
let bodyCheckRunning = false;

export async function maybeBodyFound(tokenDoc) {
    if (!game.user.isGM || bodyCheckRunning) return null;
    if (getClock().phase === "investigation") return null;   // already in Stage 7

    // The Eclipse is everyone crossing the map with their eyes shut — the guide
    // gives that window to placement, not to the cast stumbling over a body
    // while half of them have not finished moving yet. Without this, two
    // students placing through the same room mid-Eclipse would "discover" a
    // body in the middle of a window nobody has confirmed.
    const { isEclipse } = await import("./eclipse.mjs");
    if (isEclipse()) return null;

    // Everything here compares actor IDs, never actor objects.
    //
    // An unlinked token does not carry the world actor — Foundry hands it a
    // synthetic copy with the token's own overrides applied — so `includes(actor)`
    // is false for every unlinked token on the scene, however plainly the person
    // is standing there. Measured: a student in the room with the body was not
    // counted as a witness for exactly this reason.
    const students = new Set(studentActors().map(a => a.id));
    const bodies = new Set(studentActors().filter(a => isDeceased(a)).map(a => a.id));
    if (!bodies.size) return null;

    const { roomOfToken } = await import("./movement.mjs");
    const room = roomOfToken(tokenDoc);
    if (!room) return null;

    // The body has to be in the room somebody just walked into.
    const scene = tokenDoc.parent;
    const bodyHere = scene?.tokens?.find(t =>
        t.actor && bodies.has(t.actor.id) && !t.hidden && roomOfToken(t) === room);
    if (!bodyHere) return null;

    const { blackenedIds } = await import("./murder.mjs");
    const involved = new Set(blackenedIds());

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

    bodyCheckRunning = true;
    try {
        log(`Body found in ${room}: ${witnesses.map(t => t.actor.name).join(", ")} walked in.`);
        return await discoverBody({ room, victim: bodyHere.actor });
    } finally {
        bodyCheckRunning = false;
    }
}

/** The body-discovery announcement, from the GM panel. */
export async function openBodyDiscoveryDialog() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const { allRooms } = await import("./movement.mjs");
    const rooms = allRooms();
    if (!rooms.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Chapter.noRooms"));
        return null;
    }

    // The dead are the candidates here — the victim is normally already marked
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
                [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.analyzed}`]: true
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
 * The next session begins: clear the evidence out, Faint excepted.
 *
 * Guide, p. 29. Faint bullets are what survive, and Stage 3's lock is written
 * per chapter, so a Faint bullet carried across becomes analysable again all by
 * itself — nothing here has to unlock anything.
 */
export async function sweepTruthBullets() {
    if (!game.user.isGM) return { removed: 0, kept: 0 };

    let removed = 0;
    let kept = 0;

    for (const actor of game.actors) {
        if (actor.type !== "character") continue;

        const doomed = [];
        for (const item of bulletsOf(actor)) {
            if (item.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.faint)) {
                kept++;
                continue;
            }
            // Guide, p. 32: a Final Truth Bullet is "wyłączony ze sweepu" — it
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
export async function openChapterEndDialog() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const bullets = allBullets();
    // Matches `sweepTruthBullets`'s own logic exactly, so the preview never
    // promises a number the sweep does not deliver.
    const kept = bullets.filter(({ item }) =>
        item.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.faint)
        || secretOf(item.uuid).realType === "final").length;
    // The SAME test the reveal itself applies, or the preview promises work the
    // action will not do.
    //
    // It used to count every unanalysed bullet, while `revealAllBulletTypes`
    // skips any bullet with no real type in the answer key. So a table with two
    // unanalysed bullets that nobody had ever assigned a type to was offered
    // "reveal 2" and got back "Revealed 0" — and no way to tell whether the
    // tool had worked.
    const unanalysed = bullets.filter(({ item }) =>
        !item.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.analyzed));
    const hidden = unanalysed.filter(({ item }) => secretOf(item.uuid).realType).length;
    // ...and the difference is worth saying out loud rather than swallowing: a
    // bullet nobody assigned a type to is a loose end, not a rounding error.
    const typeless = unanalysed.length - hidden;

    const { finalTruthPlacedThisChapter } = await import("./mastermind.mjs");
    const finalTruthPlaced = finalTruthPlacedThisChapter();

    let faintRemnants = 0;
    for (const scene of game.scenes) {
        faintRemnants += remnantsOn(scene).filter(t => {
            const d = remnantData(t);
            return d?.faint && !d.reinforced && !d.tiedToCrime;
        }).length;
    }

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Chapter.endTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p>${game.i18n.format("DRPG.Chapter.endIntro", { chapter: getClock().chapter })}</p>
            <label class="drpg-checkbox">
                <input type="checkbox" name="reveal" checked />
                ${game.i18n.format("DRPG.Chapter.optReveal", { n: hidden })}</label>
            <label class="drpg-checkbox">
                <input type="checkbox" name="remnants" />
                ${game.i18n.format("DRPG.Chapter.optRemnants", { n: faintRemnants })}</label>
            <label class="drpg-checkbox">
                <input type="checkbox" name="sweep" />
                ${game.i18n.format("DRPG.Chapter.optSweep", {
                    n: bullets.length - kept, kept
                })}</label>
            ${typeless ? `<p class="notes drpg-warning">${
                plural("DRPG.Chapter.typeless", { n: typeless })}</p>` : ""}
            <hr />
            <label class="drpg-checkbox">
                <input type="checkbox" name="nextChapter" checked />
                ${game.i18n.format("DRPG.Chapter.optNextChapter", {
                    from: getClock().chapter, to: getClock().chapter + 1 })}</label>
            <label class="drpg-checkbox">
                <input type="checkbox" name="nextSession" checked />
                ${game.i18n.format("DRPG.Chapter.optNextSession", {
                    from: getClock().session, to: getClock().session + 1 })}</label>
            <p class="notes">${game.i18n.localize("DRPG.Chapter.endNote")}</p>
            <p class="notes${finalTruthPlaced ? "" : " drpg-warning"}">${game.i18n.localize(
                finalTruthPlaced
                    ? "DRPG.Mastermind.finalTruthPlaced"
                    : "DRPG.Mastermind.finalTruthReminder")}</p>
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Chapter.endConfirm"), default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return {
                        reveal: f.reveal.checked,
                        remnants: f.remnants.checked,
                        sweep: f.sweep.checked,
                        nextChapter: f.nextChapter.checked,
                        nextSession: f.nextSession.checked
                    };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return null;

    const done = [];
    if (result.reveal) {
        done.push(plural("DRPG.Chapter.doneReveal", { n: await revealAllBulletTypes() }));
    }
    if (result.remnants) {
        const { clearFaintRemnants } = await import("./remnants.mjs");
        done.push(plural("DRPG.Chapter.doneRemnants", { n: await clearFaintRemnants() }));
    }
    if (result.sweep) {
        const swept = await sweepTruthBullets();
        done.push(plural("DRPG.Chapter.doneSweep", swept));
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
    // clean-ups without touching either counter — measured, the clock read
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

    if (!done.length) return null;

    await whisperToGms(`<h3>${game.i18n.localize("DRPG.Chapter.endTitle")}</h3>
        <ul>${done.map(d => `<li>${d}</li>`).join("")}</ul>`);
    return done;
}
