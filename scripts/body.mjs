/**
 * A body found (E54, the plan's D2): the prep traces promoted (`faintPrepCandidates`, `promoteFaintPrep`), the discovery
 * and its queue (`discoverBody`, `runDiscovery`), the bodies published (`publishFoundBodies`), the announcement and its
 * hook (`announceBody`, `BODY_ANNOUNCED_HOOK`, `registerBodyAnnounced`), who finds a body and who saw it
 * (`bodiesToDiscover`, `witnessesOf`, `checkBodyFound`, `tellLoneFinder`) and the discovery window
 * (`openBodyDiscoveryDialog`). Moved out of chapter.mjs, which re-exports every name it exported. Not body-tile.mjs, E63's tile.
 */

import { REMNANT_TYPES, MODULE_ID, FLAGS } from "./config.mjs";
import { getClock } from "./clock.mjs";
import { sameSeason, deathRecordFor, seasonEpoch, setBodyDiscovery, isDeadForGm, recordBodyFound, SETTINGS, bodiesFoundIn, pendingDeath, deadIn, bodyDiscovery } from "./settings.mjs";
import { remnantsOn, remnantData, setRemnantFlagsMany } from "./remnants.mjs";
import { studentActors } from "./monokuma.mjs";
import { log, error, isPrimaryGm, primaryGmId, announce, whisperToGms, serverNow, plural, warn, ownerIdsOf } from "./utils.mjs";
import { drpgWindow, emptyOption } from "./ui-kit.mjs";
import { deathStore } from "./gm-stores.mjs";
import { sceneOfRoom, placeScenes, roomNames } from "./rooms.mjs";
import { bodyPlaceOf } from "./body-tile.mjs";
import { publishDeath, chooseFirst } from "./death.mjs";

/* ==========================================================================
 * THE BODY IS FOUND
 * ========================================================================== */

/**
 * The Faint Prep traces a discovery in `chapter` asks about: Faint, Prep, not tied to the crime
 * already, and left in this chapter (E11 C4, 1.2.73; audit S06-44: the list offered the Faint
 * Prep of every earlier chapter as well). A trace with no chapter - placed by hand, or from before
 * traces carried one - is taken as this chapter's, as every trace was before. And of this season
 * (E11 C12; the early review of C4): a reset that leaves the Remnants group unticked keeps last
 * season's traces, and its chapter of the same number is not this one (settings.mjs `sameSeason`).
 */
export function faintPrepCandidates(chapter = getClock().chapter) {
    const candidates = [];
    for (const scene of game.scenes) {
        for (const token of remnantsOn(scene)) {
            const data = remnantData(token);
            if (!data?.faint) continue;
            if (data.type !== "prep") continue;
            if (data.tiedToCrime) continue;
            if ((data.chapter ?? chapter) !== chapter || !sameSeason(data)) continue;
            candidates.push({ token, data, scene });
        }
    }
    return candidates;
}

/**
 * Faint Prep traces that belong to this murder stop being doubtful.
 *
 * Which ones those are is a judgement only the GM can make - a Prep Remnant is
 * left by anyone gathering tools, and most of them mean nothing. So this offers
 * the list and the GM ticks. Ticking sets `tiedToCrime` as well as clearing
 * `faint`, which is what actually exempts a trace from the chapter-end sweep.
 *
 * NOT ONE ALREADY TIED TO THE CRIME (E05 C14, 27.09.2026; audit S05-06). A Faint
 * Prep trace a GM had tied by hand, or that delivered the weapon (remnants.mjs
 * `tieTraceForItem`), was offered at every discovery as though it were still a
 * question - and it survives the sweep already. Exported for the suite, which
 * answers the window itself.
 *
 * ASKED AFTER THE ANNOUNCEMENT, HEADED BY ITS ROOM (E11 C4, 1.2.73; audit S06-44). The
 * discovery awaited this before its card and its gather, so two students walking in on a body
 * gave the GM a window about Prep traces with no word of a body, and the table waited on the
 * answer. `runDiscovery` asks it last now, not awaited, under "Body found in {room}", and only
 * about this chapter's traces (`faintPrepCandidates`).
 */
export async function promoteFaintPrep({ room = null, chapter = getClock().chapter } = {}) {
    const candidates = faintPrepCandidates(chapter);
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

    const picked = await drpgWindow({
        title: room ? game.i18n.format("DRPG.Chapter.promoteTitle", { room }) : game.i18n.localize("DRPG.Chapter.bodyBanner"),
        classes: ["drpg-panel"],
        body: `<form>
            <p>${game.i18n.localize("DRPG.Chapter.promoteIntro")}</p>
            <fieldset>${rows}</fieldset>
            <p class="notes">${game.i18n.localize("DRPG.Chapter.promoteNote")}</p>
        </form>`,
        footer: {
            primary: {
                action: "ok", label: game.i18n.localize("DRPG.Chapter.promoteConfirm"),
                callback: (e, b, d) => Array.from(
                    d.element.querySelectorAll("[name=promote]:checked")).map(i => Number(i.value))
            },
            // Skip withdraws the question (E21 rule 3): the role's Cancel, its answer "skip" as before.
            close: { role: "cancel", action: "skip" }
        },
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
 * The body discovery announcement: call everyone to the room and write the hold (until the
 * Investigation starts), then ask, not awaited, which Prep traces belong to the murder.
 *
 * @param {object} options
 * @param {string} options.room     Where the body is.
 * @param {Actor} [options.victim]  Named in the announcement when given.
 * @param {Scene} [options.scene]   The scene the room is on; this client's own when not given.
 */
export function discoverBody(options = {}) {
    if (!game.user.isGM || !options?.room) return Promise.resolve(null);
    if (!discoveryHere()) return Promise.resolve(null);
    return enqueueBodyWork(() => runDiscovery(options));
}

/* THE DISCOVERY IS THE PRIMARY GM'S (E11 fix r1-G2, 1.2.73; round 1's sec F1 and goal K6). The
   walk-in watcher has always run on the primary only (murder-rules.mjs, `updateToken`); the GM's
   own announcement ran on whichever GM pressed it. On any other GM `flagsHeldNow` reads the
   document, so a player's own `deceased` write the audit had not put back yet was stamped as a
   found body and named on the Investigation card (measured by the review at 0d860df, with a
   second GM put first in the users); and two GMs announcing one body at once each posted a card
   and each wrote the stamp from its own copy (`bodyWorkQueue` orders one browser only; 17-assistant
   F1). One browser decides, as the season's reset does (season-wipe.mjs), and another GM is told
   whose the announcement is. Refused rather than sent on to the primary: a forwarded press would
   be a new GM-to-GM request with its own checks and census row, for a window the primary GM can
   open just as well. Tier 2 "a GM who is not the primary announces no body and is told whose it is". */
function discoveryHere() {
    if (isPrimaryGm()) return true;
    const name = game.users.get(primaryGmId())?.name ?? "?";
    ui.notifications.warn(game.i18n.format("DRPG.Chapter.bodyPrimaryOnly", { name }));
    return false;
}

/* A BODY THIS CHAPTER HAS ANNOUNCED ALREADY (E11 fix r1-G2, 1.2.73; round 1's goal K5). The GM's
   list offered every dead student, one announced this chapter unmarked among them, and announcing
   it again posted a second card and wrote a second stamp row. `held` as `bodiesToDiscover` reads
   it (the caller's `flagsHeldNow`), and the death's record is the flag or the GMs' row
   (`deathRecordFor`); a death revived and given again is a new death, not yet announced
   (`announcedIn`, E11 fix r1-G1). */
function announcedAlready(actor, held, { clock = getClock(), epoch = seasonEpoch() } = {}) {
    return announcedIn(clock.chapter, epoch)(actor.id, deathRecordFor(held(actor)));
}

/**
 * Whether this chapter's discoveries announced `actor`'s present death (E19 C3; the owner's A9 of 11.10): the dead
 * channel's trigger "the body found" (voice.mjs `deathVoiceGone`). A9's thin wrapper over `announcedAlready`, read
 * with the primary's mark (`flagsHeldNow`), as the GM's list of bodies reads it. Not settings.mjs `bodyAnnounced`,
 * which reads any discovery of the season by id: a student revived and killed again would read as found at once.
 * Async because sheet-audit.mjs is imported where it is needed, as everywhere in this file.
 *
 * @param {Actor} actor
 * @returns {Promise<boolean>}
 */
export async function deathAnnounced(actor) {
    if (!actor?.id) return false;
    const { flagsHeldNow } = await import("./sheet-audit.mjs");
    return announcedAlready(actor, flagsHeldNow);
}

async function runDiscovery({ room, victim = null, scene = null, by = "gm" } = {}) {
    if (!game.user.isGM || !room) return null;
    // The chapter and season the discovery happens in, read before anything is awaited: the
    // stamp is filed under these, whatever the clock reads by the time it is written (E11 C1).
    const clock = getClock(), epoch = seasonEpoch();

    /* THE BODY'S SCENE, NOT THE ONE IN VIEW (E05 fix r2-G3, 27.09.2026; review F6). The
       watcher runs on the primary GM, whatever scene that GM is looking at, and this read the
       one in view: the bodies to publish and the gather both went to a same-named room there
       (or nowhere), and a second body in the real room stayed unpublished with the discovery
       marked done - measured on the harness (10-murder): with the GM looking at another scene,
       two witnesses walked in on two kept bodies and the one the watcher did not name stayed
       a death nobody had found. `checkBodyFound` passes the scene the walk happened on and the
       GM's form the one it chose its room from.
       AND NEVER THE CAMERA (E12 C5, 1.2.74; audit S16-07). A caller that passed no scene - the
       console's `discoverBody` - still fell back to the scene in view, then the active one; it
       gets the scene that holds the room now (rooms.mjs `sceneOfRoom`: the school first), and
       the stamp's `sceneId` is that scene, not the camera's. */
    const where = scene ?? sceneOfRoom(room);

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

    /* A NAMED BODY THIS CHAPTER ALREADY ANNOUNCED IS NOT ANNOUNCED AGAIN (E11 fix r1-G2; goal K5).
       Asked inside the queue, so a second press of the same body waits for the first one's stamp
       and is then refused. The watcher names only a body still to discover, so this refuses only
       the GM's road. Tier 2 "a body already announced is marked in the GM's list and not
       announced twice in the chapter". */
    const { flagsHeldNow, judgedFor } = await import("./sheet-audit.mjs");
    /* A NAMED DEATH THE MARK DOES NOT HOLD YET IS WAITED FOR (E11 fix r2-J1; r2-H1's doubt). A death
       already public is read off the primary's mark, and the GM's write that made it public reaches the
       mark only when its judgement comes up on that student's queue: behind another write still being
       judged, the named victim read no death here, the stamp named none (`deaths` null), and once the
       mark caught up the same body was a body to find again - tier 2 "a death made public while its
       student's queue is busy is stamped by its discovery and not found again" read [true, false, true]
       for [the mark lagged, the stamp names the death, a body to find after] with the code before this
       (11.10.2026, e11run/r2j1red). So the named
       victim's queue is drained first, before any of the reads below, when the mark holds no death for
       them; a kept death is read off the GMs' row and waits for nothing. The wait holds up nothing that
       holds it up: sheet-audit.mjs imports nothing of this file, so no judgement waits for a discovery
       (read in the code). The walk-in road names only a body the mark already holds dead. */
    if (victim && !deathRecordFor(flagsHeldNow(victim))) await judgedFor(victim.id);
    if (victim && announcedAlready(victim, flagsHeldNow, { clock, epoch })) {
        ui.notifications.warn(game.i18n.format("DRPG.Chapter.bodyAnnouncedAlready", { name: victim.name }));
        return null;
    }

    /* THE TABLE LEARNS OF THE DEATH HERE (E05 C10; audit S06-11): the named victim and every
       body kept by the GMs lying in this room are published before anything else - before the
       gather moves the cast in, before the card names them - so every screen reads them dead
       by the time it is told a body was found. */
    const { found, victims, deaths, unpublished } = await publishFoundBodies(room, victim, where, { clock, epoch });

    /* ONLY A PUBLISHED DEATH IS NAMED (E11 fix r2-H1, 1.2.73; round 1's residue R3). A death whose
       publication failed is still the GMs' alone (`publishFoundBodies` leaves it out of the stamp,
       E11 fix r1-G2), but the card below named the victim to every client and the hold, a world
       setting, carried their id. The card names a victim the discovery announces, or nobody; the
       hold likewise; and the GMs are told whose death could not be made known. Tier 2 "a body whose
       publication failed is named neither on the chat card nor in the hold and the GMs are told
       whose it is". */
    const named = victim && victims.includes(victim.id) ? victim : null;
    for (const id of unpublished) {
        const body = game.actors.get(id);
        await whisperToGms({ tone: "warning", body: `<p>${game.i18n.format("DRPG.Chapter.bodyNotPublished", {
            name: foundry.utils.escapeHTML(body?.name ?? id) })}</p>` });
    }

    /* AND THE DISCOVERY IS STAMPED, ONCE, UNDER ITS CHAPTER AND SEASON (E11 C1, 1.2.73; audit
       S06-03, decision D8). The hold below is cleared at the next phase change, and it was the
       only memory of the discovery: after End the trial a walk into the room announced a body
       found before the trial again (65-season B4: a second card at 4aad1fd). The stamp outlives the
       hold; the watcher passes over a body it names (`bodiesToDiscover`). Written as soon as the
       deaths are the table's, before the gather and the card, so a failure in either leaves the
       bodies known as found. Its `at` is the server's clock, as the trial's end it is compared
       with is (`bodyFoundSinceTrial`; E11 fix r1-G3). */
    await announceBody({ chapter: clock.chapter, epoch, at: serverNow(), room, sceneId: where?.id ?? null,
        victimIds: victims, deaths, by, day: clock.day ?? 1, timeOfDay: clock.timeOfDay });

    /* AND OF WHAT EACH OF THOSE DEATHS TIED, AND NOTHING ELSE (E09 fix r1-G1, 08.10.2026; the
       round-1 reviews' sec F8). C4 sent every tie of the chapter here, so a discovery sent the
       ties a second death, still kept, had made (tier 2 "a body's discovery sends only the ties
       its own death made"). Each body published above sends its own (`publishDeath`). */

    // Stage 7 takes the gloves. The guide puts the cleaning tool's destruction
    // here rather than at the end of Stage 6 - see CLEANUP.destroysToolsOnDiscovery.
    // The gloves of the bodies found, and no others (fix r2-G3: `destroyCleaningTools`).
    await import("./cleanup.mjs")
        .then(m => m.destroyCleaningTools(found))
        .catch(err => error("Could not destroy the cleaning tools at body discovery", err));

    const { gatherEveryone } = await import("./call-effects.mjs");
    const moved = await gatherEveryone(room, where);

    // The moment the chapter changes genre, on every screen at once. The card
    // is already public, so the flag needs nothing else from anybody.
    // Posted as the assemblies are (call-world.mjs): its own title in the bar, not
    // 'Notice', and an objection's weight, which keeps the notices over the windows
    // (E18 C6; audit S11-17, S11-23). As a plain public card it would have been the
    // one notice of a murder to stand under an open sheet.
    await announce({
        flags: { [MODULE_ID]: {
            sfx: { key: "bodyFound", gm: true },
            // in the middle of every screen, then into the history (E62 C5; MK-R3's E62-3 frames 1 and 4)
            popupCentre: true,
            popupKind: "objection",
            popupTitle: game.i18n.localize("DRPG.Chapter.bodyTitle")
        } },
        content: `<div class="drpg-evidence-card">
            <div class="drpg-objection-banner">${
                game.i18n.localize("DRPG.Chapter.bodyBanner")}</div>
            <p>${named
                ? game.i18n.format("DRPG.Chapter.bodyFoundNamed", {
                    name: foundry.utils.escapeHTML(named.name),
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
    await setBodyDiscovery({ room, victimId: named?.id ?? null });

    ui.notifications.info(game.i18n.format("DRPG.Chapter.bodyDone", { room }));
    log(`Body discovered in ${room}: ${moved} token(s) gathered.`);

    /* ANNOUNCE FIRST, ASK AFTER (E11 C4, 1.2.73; audit S06-44). The Prep question was awaited
       before the card and the gather: the GM was asked about traces with no word of a body while
       the table waited on the answer, and the toast that followed counted tokens and "traces made
       permanent" (confirmed at a table). The question is asked last, headed by the room, and not
       awaited, so the queue above lets the next discovery through while it is open; questions
       wait for each other (`promotionQueue`), so a second one lists only what the first left
       Faint (read in the code; no test drives two at once). Its own toast comes only when a trace was ticked. Tier 2 "the discovery card comes
       before the Prep question"; 65-season B1c on the witnesses' road. */
    const promotion = askPromotion({ room, chapter: clock.chapter });
    return { moved, promotion };
}

let promotionQueue = Promise.resolve(0);

/** The discovery's Prep question, after any still open; answers how many traces were ticked. */
function askPromotion(where) {
    promotionQueue = promotionQueue.catch(() => 0).then(() => promoteFaintPrep(where)).then(promoted => {
        if (promoted > 0) ui.notifications.info(plural("DRPG.Chapter.promoted", { n: promoted }));
        return promoted;
    }).catch(err => {
        error("Could not ask which Prep traces belong to the murder", err);
        return 0;
    });
    return promotionQueue;
}

/**
 * The named victim, and every body kept by the GMs standing in `room` on `scene`, published
 * (`publishDeath`). Answers `found`, every body the discovery found - the named victim and every
 * body dead for the GMs in the room, a death the table already knew included - whose killers'
 * cleaning tools it breaks (E32+E07 fix r2-G3; cleanup.mjs `destroyCleaningTools`), and
 * `victims`, the ones this discovery announces: the named victim and the room's bodies still to
 * discover (`bodiesToDiscover`), which the stamp names (E11 C1), with `deaths`, each one's
 * `deathId`. A death whose publication failed is in none of them and in `unpublished` (E11 fix
 * r2-H1): the table does not know of it, and a broken pair of gloves would tell it.
 */
async function publishFoundBodies(room, victim, scene, { clock = getClock(), epoch = seasonEpoch() } = {}) {
    const ids = new Set(victim && deathStore.has(victim.id) ? [victim.id] : []);
    const found = new Set(victim ? [victim.id] : []);
    const victims = new Set(victim ? [victim.id] : []);
    const { roomOfToken } = await import("./movement.mjs");
    const { flagsHeldNow } = await import("./sheet-audit.mjs");
    /* WHICH DEATH EACH BODY IS, READ BEFORE ANY IS PUBLISHED (E11 fix r2-H1, 1.2.73; round 2's cor
       COR2-1). The stamp names each body's `deathId` (E11 fix r1-G1), and this read it off the
       primary's mark after the publications - but a GM's own write reaches the mark only when its
       judgement comes up on that student's queue (sheet-audit.mjs `inOrder`), and nothing waited
       for it: behind a slow judgement on the same student (measured with a player's write whose
       judgement was held at its write of the mark) the read found no death, the stamp named none,
       and once the hold was answered the same body was found again. The record is the one
       `bodiesToDiscover` matched, read in the same step as the room below: the GMs' row for a death
       they keep, whose `deathId` `publishDeath` copies onto the flag, and the flag for one already
       public. Tier 2 "a kept body's discovery names its death and is not found again with its Truth
       Bullets deleted or its player's write waiting". */
    const deathIdOf = actor => deathRecordFor(flagsHeldNow(actor))?.deathId ?? null;
    const deaths = new Map(victim ? [[victim.id, deathIdOf(victim)]] : []);
    try {
        /* AS THE GMS HOLD THEM, IN ONE STEP (E11 C1; plan 1b.2, H3). Every death below is read
           off the primary's mark (`flagsHeldNow`), with nothing awaited between two reads (the
           named victim's death included, above), and before any of them is published: a player's
           own `deceased` write the audit has not put back yet makes nobody a body. That holds
           because a discovery runs on the primary GM only (`discoveryHere`, E11 fix r1-G2): on
           another GM this reader reads the document. */
        const students = new Set(studentActors().map(a => a.id));
        const here = [...(scene?.tokens ?? [])].filter(t => t.actor?.id && roomOfToken(t) === room);
        const fresh = new Set(bodiesToDiscover({ actors: here.map(t => t.actor).filter(a => students.has(a.id)), clock, epoch,
            announced: announcedIn(clock.chapter, epoch), held: flagsHeldNow }));
        for (const t of here) {
            const id = t.actor.id;
            if (deathStore.has(id)) ids.add(id);
            if (deathStore.has(id) || isDeadForGm(flagsHeldNow(t.actor))) found.add(id);
            if (!fresh.has(id)) continue;
            victims.add(id);
            if (!deaths.has(id)) deaths.set(id, deathIdOf(t.actor));
        }
    } catch (err) {
        error("Could not read which bodies lie in the room of the discovery", err);
    }
    for (const id of ids) {
        const body = game.actors.get(id);
        if (body) await publishDeath(body);
    }
    /* ONLY WHAT WAS PUBLISHED IS STAMPED (E11 fix r1-G2; early review EARLY-C1-3). A publication
       that failed leaves the GMs' row, and the death is still theirs alone; the stamp is
       world-readable and the Investigation card draws it, so a body it named here was a death the
       table did not know of, and read as announced for the rest of the chapter. Tier 2 "a body
       whose publication failed is neither stamped as found nor drawn on the card". */
    const unpublished = [...ids].filter(id => deathStore.has(id));
    for (const id of unpublished) {
        victims.delete(id);
        found.delete(id);
    }
    return { found: [...found], victims: [...victims], unpublished,
        deaths: Object.fromEntries([...victims].filter(id => game.actors.has(id)).map(id => [id, deaths.get(id) ?? null])) };
}

/**
 * THE ONE WRITER OF THE DISCOVERY'S STAMP (E11 C1, 1.2.73; decision D8): `row` is
 * `{ chapter, epoch, at, room, sceneId, victimIds, deaths, by, day, timeOfDay }` (`deaths`: each
 * body's `deathId`, E11 fix r1-G1), filed under its own
 * chapter and season (settings.mjs `recordBodyFound`; tier 0 R349 holds that nothing else calls
 * it). Who walked in is not in it - the GMs' log has it (`checkBodyFound`). E19's channel, E13's
 * trial room and E70 read the stamp through `bodiesFoundIn`, `bodyAnnounced` and
 * `chapterBodyFound`. Answers the stamp, or null when it could not be written - logged, and the discovery goes on: its
 * deaths are already the table's.
 *
 * AND THE BODY'S ANNOUNCEMENT, ONE NAMED HOOK (E95 C4, 10.11.2026; E72 amend[16], item (2); QUESTIONS Q5 (a), Q6).
 * Once the stamp is written, and before this answers - so before `runDiscovery` gathers everyone - this browser calls
 * `BODY_ANNOUNCED_HOOK` with the stamp's fields (`bodyAnnouncedPayload`) and `writer: true`, and waits for what its
 * listeners handed `waitUntil(promise)` before their first `await` (`callBodyAnnounced`), at most
 * `BODY_ANNOUNCED_WAIT_MS`: E69 ends a Tail there before the gather, E72 opens its bet window on the primary (and both
 * ignore a payload with `rehearsal: true`, the suite's). Every other browser calls it from the stamp's arrival
 * (`registerBodyAnnounced`), `writer: false`, with no `waitUntil`. A failed stamp calls nothing. The row is marked
 * seen before the write, so the stamp's `updateSetting` on this browser does not call it a second time.
 */
export async function announceBody(row) {
    if (!game.user.isGM || !row) return null;
    const key = `${Number.isFinite(row.epoch) ? row.epoch : seasonEpoch()}:${row.chapter}`;
    const seen = announcedRowKey(key, { at: row.at, victimIds: [...new Set(row.victimIds ?? [])] });
    announcedSeen.add(seen);
    let stamp = null;
    try {
        stamp = await recordBodyFound(row);
        if (stamp) log(`The discovery in ${row.room} is stamped for chapter ${row.chapter}: ${stamp.victimIds.length} bod(ies), by ${row.by}.`);
    } catch (err) {
        error("Could not stamp the body's discovery", err);
    }
    if (!stamp) {
        announcedSeen.delete(seen);
        return null;
    }
    await callBodyAnnounced(bodyAnnouncedPayload(key, stamp), { writer: true });
    return stamp;
}

/*
 * THE BODY'S ANNOUNCEMENT ON EVERY BROWSER (E95 C4, 10.11.2026; QUESTIONS Q5 (a), Q6). One name, spelt here only
 * (tier 0 R3145). Its payload is `{ chapter, epoch, victimIds, room, sceneId, at, by, writer }` and, on the writer,
 * `waitUntil`, and on a suite's stamp `rehearsal: true` (below): the stamp's own fields and its key's, which every
 * browser holds in the world setting `bodiesFound` already (tier 2 and scenario 10 compare the two), so a listener
 * learns nothing its browser could not read.
 *
 * A ROW IS ITS KEY, `at` AND `victimIds` (`announcedRowKey`). A browser marks every row the setting holds at `ready`
 * as seen, and calls the hook for each row it has not seen when the setting is written (`bodiesFound`'s
 * `updateSetting`): a renamed room (settings.mjs `carryBodyRooms` changes `room` alone), the reset's clear (rows
 * gone), a stamp that failed (no write) and a page loaded after the discovery (its rows seen at `ready`) call nothing.
 * The hook and `Setting#key` as Foundry v13 has them, the setting's arrival on the other browsers as the harness
 * models it (LIVE-E95-03).
 *
 * AN OLD ROW HANDED BACK (E95 fix RV-11, 10.11.2026). A browser that connected while a row was absent from the setting,
 * and is then handed it back by a whole-setting write (tier 2's put-back, a tool that rewrites the setting), has not
 * seen it. It announces an arrived row only if its `at` is no older than this browser's `ready` (the server's time,
 * utils.mjs `serverNow`) less `BODY_ANNOUNCED_STALE_MS`, 60 s - chosen, not measured: a stamp written while this page
 * loaded is still announced, one from before it is not. An older row is marked seen and calls nothing.
 *
 * A REHEARSAL (E95 fix RV-12). The suite's stamps carry `rehearsal: true`, and so does every payload they wake the hook
 * with, on the writer and on every browser the setting reaches. EVERY LISTENER MUST IGNORE A REHEARSAL - E69's Tail, E72's
 * bet window and any other: a GM's `runTests({ tier: 2 })` at a table writes stamps of chapter 97, and a listener that
 * acts on one acts on a discovery that never happened. A real discovery's stamp (`runDiscovery`) carries none.
 *
 * THE WAIT (Q6). A Foundry hook cannot be awaited, so the writer's payload carries `waitUntil(promise)` and
 * `announceBody` waits for every promise handed it while the hook is being called - synchronously, before the
 * listener's first `await` (`callBodyAnnounced`; a later call is not waited for) - settled or not, at most 1500 ms -
 * chosen, not measured: long
 * enough for one write on the primary (a Tail's end), short enough that the gather's card is not held up for long when
 * a listener never settles. The gather waits by at most that much. A listener that throws is Foundry's to log
 * (`Hooks.callAll`) and stops nobody else's.
 */
export const BODY_ANNOUNCED_HOOK = "drpgBodyAnnounced";
export const BODY_ANNOUNCED_WAIT_MS = 1500;
export const BODY_ANNOUNCED_STALE_MS = 60000;
const announcedSeen = new Set();
let announcedPrimed = false;
let announcedReadyAt = 0;

/** A stamp's identity: its `<epoch>:<chapter>` key, its `at` and its bodies, as one string (E95 C4). */
function announcedRowKey(key, row) {
    return JSON.stringify([key, Number(row?.at) || 0, [...(row?.victimIds ?? [])].map(String).sort()]);
}

/**
 * The hook's payload for `row`, filed under `key` (E95 C4): the stamp's fields and its key's, nothing else; and
 * `rehearsal: true` where the stamp carries it (E95 fix RV-12), which only the suite's stamps do.
 */
export function bodyAnnouncedPayload(key, row) {
    const [epoch, chapter] = String(key).split(":").map(Number);
    const payload = { chapter, epoch, victimIds: [...(row?.victimIds ?? [])], room: row?.room ?? null, sceneId: row?.sceneId ?? null,
        at: row?.at ?? null, by: row?.by ?? null };
    if (row?.rehearsal === true) payload.rehearsal = true;
    return payload;
}

/**
 * Call `BODY_ANNOUNCED_HOOK` with `payload`; on the writer, wait for what was handed `waitUntil`, at most the bound.
 * ONLY WHAT IS HANDED DURING THE CALL (E95 fix RV-7, 10.11.2026). `Hooks.callAll` runs each listener up to its first
 * `await` and returns, and the promises are counted on the next line, before any microtask runs. So a listener must
 * call `waitUntil` synchronously, before its first `await` - an `await import(...)` included: import first, or hand
 * `waitUntil` a promise of the whole async work (`p.waitUntil((async () => { ... })())`). A call after that is not
 * waited for: it throws nothing, is logged once as a warning, and the gather does not wait for it.
 */
async function callBodyAnnounced(payload, { writer }) {
    const waits = [];
    const data = { ...payload, writer };
    let open = true, toldLate = false;
    if (writer) data.waitUntil = promise => {
        if (!open) {
            if (!toldLate) warn(`${BODY_ANNOUNCED_HOOK}: waitUntil was called after the listener's first await, so it is not waited for.`);
            toldLate = true;
            return;
        }
        if (promise && typeof promise.then === "function") waits.push(promise);
    };
    Hooks.callAll(BODY_ANNOUNCED_HOOK, data);
    open = false;
    if (!waits.length) return 0;
    let timer = null;
    await Promise.race([Promise.allSettled(waits), new Promise(resolve => { timer = setTimeout(resolve, BODY_ANNOUNCED_WAIT_MS); })]);
    clearTimeout(timer);
    return waits.length;
}

/** Every stamp the world setting holds on this browser, each as `[key, row]`. */
function stampsHeld() {
    let all = {};
    try { all = game.settings.get(MODULE_ID, SETTINGS.bodiesFound) ?? {}; } catch { all = {}; }
    return Object.entries(all && typeof all === "object" ? all : {})
        .flatMap(([key, rows]) => (Array.isArray(rows) ? rows.filter(row => row && typeof row === "object").map(row => [key, row]) : []));
}

/**
 * The stamps that arrived on this browser and were not seen, each announced once (E95 C4; `registerBodyAnnounced`).
 * Answers how many it announced. Before `ready` has marked the rows already held it announces none, and a row older
 * than `ready` less `BODY_ANNOUNCED_STALE_MS` it marks seen and announces never (E95 fix RV-11; the header's OLD ROW).
 */
export function announceArrivedBodies() {
    if (!announcedPrimed) return 0;
    let called = 0;
    const oldest = announcedReadyAt - BODY_ANNOUNCED_STALE_MS;
    for (const [key, row] of stampsHeld()) {
        const seen = announcedRowKey(key, row);
        if (announcedSeen.has(seen)) continue;
        announcedSeen.add(seen);
        if (!(Number(row?.at) >= oldest)) continue;
        callBodyAnnounced(bodyAnnouncedPayload(key, row), { writer: false });
        called++;
    }
    return called;
}

/** The announcement's listeners on this browser (E95 C4; module.mjs `init`): the rows held at `ready`, then each arrival. */
export function registerBodyAnnounced() {
    Hooks.once("ready", () => {
        for (const [key, row] of stampsHeld()) announcedSeen.add(announcedRowKey(key, row));
        announcedReadyAt = serverNow();
        announcedPrimed = true;
    });
    Hooks.on("updateSetting", setting => {
        if (setting?.key === `${MODULE_ID}.${SETTINGS.bodiesFound}`) announceArrivedBodies();
    });
}

/*
 * THE DEATHS THIS CHAPTER'S DISCOVERIES ANNOUNCED, in the season `epoch`: a test on an id and its
 * death's record (the GM panel's next line reads it too). A stamp counts only for the death it
 * stamped (E11 fix r1-G1; early review EARLY-C1-1): C1 read the ids alone, so a student revived
 * after their body was found and killed again in the same chapter was never found the second time
 * - nothing takes a stamp back when a death is undone (`reviveCharacter`). A record with no
 * `deathId` (from before 1.2.73) is matched by its id, as C1 did. Tier 2 "a student revived and
 * killed again in the chapter is found again - once".
 */
export function announcedIn(chapter, epoch) {
    const rows = bodiesFoundIn(chapter, epoch);
    return (id, record = null) => rows.some(row => row?.victimIds?.includes?.(id)
        && (!record?.deathId || row.deaths?.[id] === record.deathId));
}

/*
 * THE BODIES TO DISCOVER (E11 C1, 1.2.73; audit S06-03, amend 26.09; tier 0 R347). Of `actors`
 * (students), the ids of those a walk-in would discover: dead for the GMs, not a Monocub, died in
 * this chapter (a record with no chapter is taken as this chapter's, as before) of this season (a
 * record with no `epoch` is taken as this season's), not in the Class Trial - an execution is the
 * trial's own ending, public at once, and no body to find - and not announced by a discovery of
 * this chapter (`announced`, a test on an id and the death's record: `announcedIn`). A record from before 1.2.73 says no phase, so it
 * cannot tell an execution from a murder: it counts only while the GMs still hold it, which an
 * execution never is. Measured at 4aad1fd: after End the trial a walk-in discovered Daichi,
 * found before the trial, again (65-season B4), and a verdict executing a death the GMs held
 * left a body the next walk found (tier 2 "a body the verdict executed is not found again").
 * Pure but for its readers: `held` hands each actor's flags as the GMs hold them (the caller's
 * `flagsHeldNow`, read in one step) and `pending` an id's death the GMs hold (`pendingDeath`);
 * tier 0 hands it fakes. "Announced" is this chapter's stamps, not the season's (`bodyAnnounced`):
 * the record has to be this chapter's anyway, and a student revived and killed again in a later
 * chapter is a body again there.
 */
export function bodiesToDiscover({ actors = [], clock = getClock(), epoch = seasonEpoch(), announced = () => false,
    held = actor => actor, pending = id => pendingDeath({ id }) } = {}) {
    return [...new Set([...actors].filter(actor => {
        if (!actor?.id) return false;
        const view = held(actor);
        if (!view || !deadIn(view, pending) || view.getFlag(MODULE_ID, FLAGS.monocub)) return false;
        const row = pending(actor.id);
        const record = view.getFlag(MODULE_ID, FLAGS.deceased) || row;
        if (announced(actor.id, record)) return false;
        if ((record?.chapter ?? clock.chapter) !== clock.chapter) return false;
        if ((record?.epoch ?? epoch) !== epoch) return false;
        if (!record?.phase) return Boolean(row);
        return record.phase !== "classTrial";
    }).map(actor => actor.id))];
}

/*
 * THE WITNESSES OF A WALK-IN (E11 C1, 1.2.73; audit S06-14, S13-02; DC7/DX1; tier 0 R348). The
 * tokens of `tokens` standing in `room` that count toward the two: a student's character
 * (`students`, which leaves a Monokuma out), not hidden, not one of the `bodies`, and alive for
 * the GMs - the dead are not witnesses, and since E72 C3 a Monocub neither (DC7: "never"; until
 * then a Monocub was the one dead witness; `monocubs` keeps it one for a reader that finds no body). Until 1.2.73 a dead student's token
 * standing in the room counted, so one living student walking in on a body beside an earlier
 * victim's was "two witnesses". `held` and `pending` as `bodiesToDiscover` reads them; `roomOf` is
 * movement.mjs `roomOfToken`, or `lawfulRoomOf` (E12 C12).
 *
 * WITNESSES ARE STUDENTS, NOT TOKENS (E12 fix r2-H3, 11.10.2026; security review r2 SEC2-1). One
 * student with two tokens in the room was two witnesses, so one player's second token opened the
 * discovery the rule of two keeps for two people. One token a student is kept, the first that counts.
 */
export function witnessesOf({ tokens = [], room = null, bodies = new Set(), students = new Set(), held = actor => actor,
    pending = id => pendingDeath({ id }), roomOf = () => null, monocubs = false } = {}) {
    const counted = new Set();
    return [...tokens].filter(t => {
        const actor = t.actor;
        if (!actor || actor.type !== "character") return false;
        if (t.hidden) return false;
        if (bodies.has(actor.id)) return false;
        if (!students.has(actor.id)) return false;            // excludes Monokumas
        // No dead student finds a body, a Monocub neither (E72 C3, 12.11.2026; the owner's DC7, "never"). `monocubs` for
        // a reader that is no discovery: who sees what one student does to another (frisk.mjs `roomWitnessesOnGm`, A11-12).
        const view = held(actor);
        if (deadIn(view, pending) && !(monocubs && view.getFlag(MODULE_ID, FLAGS.monocub))) return false;
        if (roomOf(t) !== room || counted.has(actor.id)) return false;
        counted.add(actor.id);
        return true;
    });
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
 * same rule - and nor is a hidden token, a second body or, since E11 C1, the
 * dead (`witnessesOf`; a Monocub among them since E72 C3).
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
    /* EVERYTHING THIS DECIDES BY IS READ IN ONE STEP (E11 C1, 1.2.73; plan 1b.2, H3 and H17). The
       modules are fetched first; from the phase below to the witnesses nothing is awaited, so no
       write is judged between two reads, and the deaths and Monocubs are read off the primary's
       mark (`flagsHeldNow`) without waiting for the audit - a walk waits on nothing a judgement
       waits on. */
    const { isEclipse } = await import("./eclipse.mjs");
    const { roomOfToken, lawfulRoomOf } = await import("./movement.mjs");
    const { blackenedIds, killerIds, murderState } = await import("./murder.mjs");
    const { flagsHeldNow } = await import("./sheet-audit.mjs");

    // Already in Stage 7, or a body found and waiting on the GM. Both are
    // "this has already been discovered"; the second is the whole of D5.
    // And the Class Trial (E11 C1; audit S06-03): the bodies were found before it began.
    const clock = getClock();
    if (["investigation", "classTrial"].includes(clock.phase) || bodyDiscovery()) return null;

    // The Eclipse is everyone crossing the map with their eyes shut - the guide
    // gives that window to placement, not to the cast stumbling over a body
    // while half of them have not finished moving yet. Without this, two
    // students placing through the same room mid-Eclipse would "discover" a
    // body in the middle of a window nobody has confirmed.
    if (isEclipse()) return null;

    // Everything here compares actor IDs, never actor objects.
    //
    // An unlinked token does not carry the world actor - Foundry hands it a
    // synthetic copy with the token's own overrides applied - so `includes(actor)`
    // is false for every unlinked token on the scene, however plainly the person
    // is standing there. Measured: a student in the room with the body was not
    // counted as a witness for exactly this reason.
    const cast = studentActors();
    const students = new Set(cast.map(a => a.id));
    // A BODY IS THIS CHAPTER'S DEAD, AND NOT A MONOCUB (17.09, BODY-2, BODY-3). A Monocub keeps
    // the deceased flag and walks the board, so standing beside two students announced their
    // own corpse; and a body from an earlier chapter, found and tried long ago, set off a
    // second discovery the first time two people passed it. Since E11 C1 also not an execution,
    // not one this chapter's discoveries already announced, and not last season's
    // (`bodiesToDiscover`).
    const epoch = seasonEpoch();
    const bodies = new Set(bodiesToDiscover({ actors: cast, clock, epoch, announced: announcedIn(clock.chapter, epoch), held: flagsHeldNow }));
    if (!bodies.size) return null;

    const room = roomOfToken(tokenDoc);
    if (!room) return null;

    /* The body has to be in the room somebody just walked into - WHERE THE BODY LIES (E72 C3, 12.11.2026; the plan's
       Q-E72-3, default taken): its tile since E63, its token where it has none (body-tile.mjs `bodyPlaceOf`, as Frisk's
       gate reads it), with the GMs' flags. Until E72 the victim's token was read, and a token walks on from its tile. */
    const scene = tokenDoc.parent;
    const bodyHere = [...bodies].map(id => game.actors.get(id)).find(actor => {
        const place = actor ? bodyPlaceOf(actor, { held: flagsHeldNow }) : null;
        return Boolean(place) && !place.hidden && place.scene?.id === scene?.id && place.room === room;
    });
    if (!bodyHere) return null;

    /* AND THE KILLERS STILL CLEANING UP (22.09). The Blackened register is written when the
       murder is closed, so during the clean-up it was empty: a killer and a partner in crime
       standing by the body were two "witnesses", and the body was discovered in the middle of
       their own Stage 6. The running incident's killers count as involved too. */
    const involved = new Set([...blackenedIds(), ...killerIds(murderState())]);

    // And the dead are not witnesses, a Monocub neither since E72 C3 (E11 C1; `witnessesOf`). Nor is a student
    // who reached the room by a crossing the rules refuse, until they stand somewhere lawful (E12
    // C12, the owner's Q3 a): the room they count in is the witness judge's (movement.mjs
    // `lawfulRoomOf`), read in this same step. Scenario 66 I1 read Aiko, jumped into the locked
    // Storage by her player's console, as the second witness until 1.2.74.
    const witnesses = witnessesOf({ tokens: scene.tokens, room, bodies, students, held: flagsHeldNow, roomOf: lawfulRoomOf });

    /* ONE, ALONE, AND NOT IN IT (E05 C10; the owner's Q1, 26.09.2026). A student who walks in
       on a body nobody has found with nobody else there sees it - told privately by the GMs,
       their copy naming it, the dead marker drawn on their screen alone - and nothing is
       announced: the rule of two witnesses stays.
       NOT IN THAT DEATH, WHATEVER ELSE THEY DID (E05 fix r2-G1, 27.09.2026; review F10). This
       branch was closed to `involved` - every Blackened of the chapter, all of its incidents -
       so a killer of the chapter's first incident who walked alone onto the second's body was
       told nothing (measured on the harness: the row's `known` did not gain their player).
       Who already knows of that death is `tellLoneFinder`'s to pass over (the
       row's `known`, the body's owners); `involved` stays the rule of two witnesses'. */
    if (witnesses.length === 1) {
        await tellLoneFinder(witnesses[0].actor, scene, room);
        return null;
    }

    // Two in the room, and at least one of them did not do this. A killer is
    // part of the pool, never the whole of it.
    if (witnesses.length < 2) return null;
    if (!witnesses.some(w => !involved.has(w.actor.id))) return null;

    log(`Body found in ${room}: ${witnesses.map(t => t.actor.name).join(", ")} walked in.`);
    // Already inside the queue: straight to the work, not back through `discoverBody`,
    // which would wait behind this very call.
    return await runDiscovery({ room, victim: bodyHere, scene, by: "witnesses" });
}

/**
 * THE LONE FINDER (E05 C10; the owner's Q1, 26.09.2026). The finder's player is added to the
 * `known` of every body nobody has found lying in `room`, sent their copy, and told by an
 * addressed packet - no chat message, which every console would receive. Once per body: a
 * player who already knows is told nothing again. Answers how many bodies they learnt of.
 */
async function tellLoneFinder(finder, scene, room) {
    // Every player who owns the finder (E91 C6, D078): a co-owner shares its sheet and its screen's marks.
    const users = ownerIdsOf(finder).map(id => game.users.get(id)).filter(Boolean);
    if (!users.length) return 0;
    const { roomOfToken } = await import("./movement.mjs");
    const { knowsOfDeath, tellDeaths, tellFinder } = await import("./murder.mjs");
    const found = [];
    for (const t of scene?.tokens ?? []) {
        const id = t.actor?.id;
        const row = id ? deathStore.get(id) : null;
        if (!row || t.hidden || roomOfToken(t) !== room) continue;
        const fresh = users.filter(user => !knowsOfDeath(user, id, row));
        if (!fresh.length) continue;
        await deathStore.patch(id, { known: [...new Set([...(Array.isArray(row.known) ? row.known : []), ...fresh.map(u => u.id)])] });
        found.push([t, fresh]);
    }
    if (!found.length) return 0;
    tellDeaths([...new Set(found.flatMap(([, fresh]) => fresh.map(u => u.id)))]);
    for (const [t, fresh] of found) for (const user of fresh) tellFinder(user.id, t, room);
    log(`${finder.name} found ${found.map(([t]) => t.name).join(", ")} alone in ${room}; their player(s) were told privately.`);
    return found.length;
}

/** The body-discovery announcement, from the case dashboard's footer. */
export async function openBodyDiscoveryDialog() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }
    // Another GM is told whose the announcement is before a form it could not send (E11 fix r1-G2).
    if (!discoveryHere()) return null;

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

    /* THE GM PICKS THE SCENE WITH THE ROOM (E12 C5, 1.2.74; audit S16-07). The rooms were the
       scene on this GM's screen, and the discovery was handed that scene: a GM looking at another
       map announced a body in a same-named room there, or had no room to pick. Every place
       scene's rooms are offered, grouped under the scene's name when there is more than one, the
       school's first and its first room chosen (rooms.mjs `placeScenes`, `homeScene`); the option
       carries its scene, and the discovery is handed it. */
    const places = placeScenes().map(scene => ({ scene, rooms: roomNames(scene) })).filter(p => p.rooms.length);
    if (!places.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Chapter.noRooms"));
        return null;
    }
    /* THE ROOM IS CHOSEN, NOT THE FIRST (E22 C3b, 06.11.2026; audit S06-08): the select opened on the school's first room,
       and one Enter announced a body in "Big IT Room" with nobody dead there. It opens on "- choose -" with Announce shut
       until a room is chosen; while an incident stands, its victim's room - where the body is - is chosen already. */
    const { murderState } = await import("./murder.mjs");
    const incident = murderState();
    const { locateActor } = await import("./movement.mjs");
    const atIncident = incident?.active ? locateActor(game.actors.get(incident.victimId ?? "")) : null;
    const known = atIncident?.room ? { room: atIncident.room, sceneId: atIncident.scene?.id ?? null } : null;
    const roomOption = (scene, r) => `<option value="${foundry.utils.escapeHTML(r)}" data-scene="${scene.id}"${
        known && known.room === r && (!known.sceneId || known.sceneId === scene.id) ? " selected" : ""}>${
        foundry.utils.escapeHTML(r)}</option>`;
    const roomOptions = places.length === 1
        ? places[0].rooms.map(r => roomOption(places[0].scene, r)).join("")
        : places.map(({ scene, rooms }) => `<optgroup label="${foundry.utils.escapeHTML(scene.name ?? scene.id)}">${
            rooms.map(r => roomOption(scene, r)).join("")}</optgroup>`).join("");

    // The dead are the candidates here - the victim is normally already marked
    // by the time anybody trips over them. One this chapter has announced says so (E11 fix
    // r1-G2): `runDiscovery` refuses it a second time.
    const dead = studentActors().filter(isDeadForGm);
    const { flagsHeldNow } = await import("./sheet-audit.mjs");
    const victims = dead.map(a => {
        const name = foundry.utils.escapeHTML(a.name);
        const label = announcedAlready(a, flagsHeldNow) ? game.i18n.format("DRPG.Chapter.victimAnnounced", { name }) : name;
        return `<option value="${a.id}"${incident?.active && a.id === incident.victimId ? " selected" : ""}>${label}</option>`;
    }).join("");
    /* THE NOTE SAYS WHAT THIS PRESS DOES NOW (E11 C4, 1.2.73; audit S13-27). One note said "the
       phase stays Daily Life ... until you start the Investigation" in every phase - from the
       Investigation's own footer too - and promised the doubtful Prep traces, which a world with
       none never showed. The hold's sentence is Daily Life's; elsewhere the phase is left as it is
       (`runDiscovery` writes no phase). The traces' sentence only when this chapter has some. */
    const notes = [game.i18n.localize(getClock().phase === "dailyLife" ? "DRPG.Chapter.bodyNote" : "DRPG.Chapter.bodyNoteLater")];
    if (faintPrepCandidates().length) notes.push(game.i18n.localize("DRPG.Chapter.bodyNoteTraces"));

    const result = await drpgWindow({
        title: game.i18n.localize("DRPG.Chapter.bodyTitle"),
        // Its own class, for the stylesheet's form layout: "Which room?" and "Whose body?" one column (E11 fix r1-G4).
        classes: ["drpg-panel", "drpg-window-body"],
        body: `<form>
            <label>${game.i18n.localize("DRPG.Chapter.whereBody")}
                <select name="room">${emptyOption("DRPG.Chapter.chooseOne", { selected: !roomOptions.includes(" selected") })}${roomOptions}</select></label>
            <label>${game.i18n.localize("DRPG.Chapter.whoseBody")}
                <select name="victim">
                    <option value="">${game.i18n.localize("DRPG.Chapter.unnamedVictim")}</option>
                    ${victims}
                </select></label>
            <p class="notes">${notes.join(" ")}</p>
        </form>`,
        // A body announced to the table is not taken back (E22 rule 4): destructive, Cancel the default and first under Enter.
        footer: {
            destructive: [{
                action: "ok", label: game.i18n.localize("DRPG.Chapter.announce"), disabled: !roomOptions.includes(" selected"),
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    if (!f.room.value) return false;
                    return { room: f.room.value, sceneId: f.room.selectedOptions?.[0]?.dataset.scene ?? null, victimId: f.victim.value };
                }
            }],
            close: "cancel",
            default: "cancel"
        },
        render: (event, dialog) => chooseFirst(dialog, "room"),
        rejectClose: false
    });

    if (!result || result === "cancel" || !result.room) return null;

    return discoverBody({
        room: result.room,
        victim: result.victimId ? game.actors.get(result.victimId) : null,
        // The scene of the option chosen; an answer that names none (a caller of the window's own) gets the room's.
        scene: game.scenes.get(result.sceneId ?? "") ?? sceneOfRoom(result.room)
    });
}
