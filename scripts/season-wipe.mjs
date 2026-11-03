/**
 * Danganronpa RPG - taking a season down.
 * ---------------------------------------------------------------------------
 * The season reset: its window (`resetSeason`) with what it would take
 * (`resetTallies`, `resetGoesHtml`) and where the cast goes (`castFieldset`,
 * `placeCast`); its steps in E11's order (`RESET_STEPS`, `RESET_CHOICES`),
 * walked by `wipeSeason` on steps.mjs `runSteps` over the registry of season
 * state (season-reset.mjs); each student's part of a cast group
 * (`wipeStudent`); the reset's own entries (the items, the advancement, the
 * stashes found, the cards, the rest of the chat, the clock); and its record
 * (`seasonResetRecord`, `unfinishedGroups`), which opens the next window on
 * what a stopped reset left.
 *
 * WHERE IT SITS. Moved out of season-setup.mjs by E42 C5 (1.2.97), a pure move
 * that `node tools/moved-only.mjs` proves line by line. season-setup.mjs keeps
 * the wizard and re-exports the nine names here it exported before, so every
 * importer still imports season-setup.mjs, and nothing here imports it (the
 * facade rule, .claude/rules/code.md). The registry is a leaf of its own: an
 * owner of season state imports season-reset.mjs, never this file, so the
 * reset's imports close no cycle with them (R161, R1254).
 */

import { MODULE_ID, FLAGS, STARTING, ITEM_CATEGORIES, TIMING } from "./config.mjs";
import { SETTINGS, isDeceased, isDeadForGm } from "./settings.mjs";
// What a reset is allowed to keep (R-1). Static and by a literal path, so the
// suite's own source sweep can follow it.
import {
    RESET_GROUPS, RESET_SECTIONS, groupLabel, sectionLabel,
    rememberedExceptions, rememberExceptions, planFrom, resetCutPatch
} from "./season-exceptions.mjs";
// The reset's cut is a GM store stamp, taken once this browser has the other GMs' copies.
import { gmStoreStamp, whenGmStoresHydrated } from "./gm-store.mjs";
import { getClock, setClock } from "./clock.mjs";
import { studentActors } from "./monokuma.mjs";
import { initCharacter } from "./character.mjs";
import { forgetAllStashesFound, reconcileBedroomKeys, unconcealStashes, allBedroomsAnywhere } from "./vault.mjs";
import { roomRegions, roomPieces, piecesByName } from "./rooms.mjs";
import { dialogContent, log, error, plural, MESSAGE_FLAG, esc, isPrimaryGm, primaryGmId, serverNow, whisperToGms, listOf } from "./utils.mjs";
import { MESSENGER_FLAGS } from "./messenger.mjs";
import { cardFlag } from "./secret.mjs";
import { alreadyOpen } from "./live.mjs";
// A leaf (season-exceptions.mjs alone): the registry of season state the reset walks and its window counts (E42 C3).
import { registerSeasonState, seasonStateEntries, seasonStateFor, everyPart } from "./season-reset.mjs";
// A leaf (utils.mjs alone): the one runner of the procedures that cannot be taken back (E42 C1b).
import { runSteps } from "./steps.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/* ==========================================================================
 * TAKING A SEASON DOWN
 * --------------------------------------------------------------------------
 * Without this the only way to start again is a new world, which throws away
 * the cast, the map and the room setup along with the season - an hour of work
 * to undo a chapter.
 *
 * The line it draws is between the CAST and the CHAPTER. Actors, scenes, room
 * regions and who watches whom are the table's; the clock, the projects, the
 * traces, the evidence, the deaths and every trace of an incident belong to the
 * season that just ended. That split is why this is safe to offer at all - the
 * expensive half is never touched.
 * ========================================================================== */

/**
 * Items a season put in somebody's hands, wherever they ended up.
 *
 * Truth Bullets are excluded on purpose: they are one of these categories, and
 * they have their own step that drops the answer key behind each one before
 * deleting it. Counting them here would say the same thing twice, and clearing
 * them here would skip that step.
 */
function seasonItems(actor) {
    const categories = Object.keys(ITEM_CATEGORIES).filter(c => c !== "truthBullet");
    return actor.items.filter(i => categories.includes(i.getFlag(MODULE_ID, "category")));
}

/** Chat this module wrote, and the messenger threads underneath it. */
function moduleMessages() {
    return game.messages.filter(m =>
        m.getFlag(MODULE_ID, MESSAGE_FLAG) || cardFlag(m, MESSENGER_FLAGS.thread));
}

/**
 * WHAT A RESET WOULD DESTROY, COUNTED NOW (E42 C3; audit S17-30). Each entry's `tally` (season-reset.mjs), asked once
 * as the window opens: the lines under its group's row, keyed by the group, in the window's order. Until C3 a hand list
 * here (`resetTally` and `GOES_DETAIL`) counted ten groups beside the reset's runs, and a group whose owner added state
 * counted none of it until somebody remembered the list. A tally that throws counts nothing and is logged: the window
 * still opens.
 */
export async function resetTallies() {
    const out = {};
    for (const entry of seasonStateEntries()) {
        if (!entry.tally) continue;
        try {
            const lines = await entry.tally();
            out[entry.group] = Array.isArray(lines) ? lines.filter(text => typeof text === "string" && text.length > 0) : [];
        } catch (err) {
            error(`Season reset: could not count the group "${entry.group}"`, err);
            out[entry.group] = [];
        }
    }
    return out;
}

/**
 * THE "THIS GOES" LIST, FROM THE TICKS (E11 C9; audit S06-49, the plan's 3.3).
 *
 * The list above the ticks was written by hand: twelve lines that went whatever was
 * ticked, one of them ("the incident, the Mastermind, the trial queue, ...") six things
 * at once, and twelve of the twenty-nine groups on no line (counted off 4fcc2b4's list,
 * 10.10.2026). Now one row per group in
 * `RESET_GROUPS`, its label the tick's label and its counts `resetTally`'s (until E42 C3); a group
 * the plan keeps is struck through and `aria-disabled`, so a screen reader is told what
 * the line through it says. `resetSeason` draws it again whenever a box changes.
 * Since E42 C3 the counts are the entries' (`resetTallies`: a group's lines, none for a group whose entry counts
 * nothing), and each descriptive entry of the registry - the notice history's (A7) - is a line of its own, with no
 * tick and no count: what goes with the clock, the incident or the chat on each player's own browser. Pure over its two
 * arguments and the registry, which is what tier 1's R353 and R1255 read.
 */
export function resetGoesHtml(plan, tallies = {}) {
    const rows = RESET_GROUPS.map(({ key }) => {
        const goes = plan?.groups?.has(key) ?? false;
        const counts = Array.isArray(tallies?.[key]) ? tallies[key] : [];
        const text = `${esc(groupLabel(key))}${counts.length
            ? ` <span class="notes">(${counts.map(esc).join("; ")})</span>` : ""}`;
        return goes
            ? `<li data-group="${key}">${text}</li>`
            : `<li data-group="${key}" aria-disabled="true"><s>${text}</s></li>`;
    });
    const described = seasonStateEntries().filter(entry => !entry.group)
        .map(entry => `<li data-describes="${esc(entry.describes)}">${esc(game.i18n.localize(entry.label))}</li>`);
    return `<ul class="drpg-reset-goes">${[...rows, ...described].join("")}</ul>`;
}

/**
 * The ticks, read by name off the table rather than by walking the form: a box the
 * window failed to render must not read as an exception nobody chose.
 */
function tickedIn(root) {
    return RESET_GROUPS
        .filter(group => root?.querySelector(`[name="wipe.${group.key}"]`)?.checked)
        .map(group => group.key);
}

/**
 * WHERE THE CAST'S TOKENS GO, AS THE WINDOW ASKS IT (E11 C10b, 1.2.73; the owner's Q2 of
 * 09.10.2026: "do wyboru przez gma"). (a) they stay, the default every time the window opens;
 * (b) each student to their own bedroom; (c) everyone to one room the GM picks here. The room is
 * this reset's and is stored nowhere: a world setting would be one more thing a reset keeps.
 */
const CAST_TO = Object.freeze(["stay", "bedroom", "point"]);

/**
 * Every room on every map, by scene and the id of its first piece - the GM's camera is no part of the
 * answer (ITEM-16). Until E12 fix r1-G5 (review goal-r1 N1) every named region was offered, a
 * Teleport's and a player's among them, and a room of two pieces twice.
 */
function castPoints() {
    return game.scenes.contents.flatMap(scene => [...piecesByName(scene)]
        .map(([name, pieces]) => ({ value: `${scene.id}.${pieces[0].id}`, label: `${scene.name}: ${name}` })));
}

/** The cast's choice in the window's words, for the reset's report: the bedrooms' label, or the room's as its list drew it. */
function castPlace(choice) {
    if (choice?.to === "bedroom") return game.i18n.localize("DRPG.Season.resetCastBedroom");
    const point = castPoints().find(entry => entry.value === `${choice?.scene}.${choice?.region}`);
    return `${game.i18n.localize("DRPG.Season.resetCastPoint")} ${point?.label ?? "?"}`;
}

/** The window's answer to "where the cast goes", bounded: anything else is (a). */
function castChoiceIn(root) {
    const to = root?.querySelector('[name="castTo"]:checked')?.value;
    if (to !== "point") return { to: CAST_TO.includes(to) ? to : "stay" };
    const [scene, region] = String(root?.querySelector('[name="castPoint"]')?.value ?? "").split(".");
    return { to, scene: scene || null, region: region || null };
}

function castFieldset() {
    const points = castPoints();
    const choice = (value, key, { disabled = false, after = "" } = {}) => `<label class="drpg-inline-check">
        <input type="radio" name="castTo" value="${value}"${value === "stay" ? " checked" : ""}${disabled ? " disabled" : ""} />
        ${esc(game.i18n.localize(key))}${after}</label>`;
    const options = points.length
        ? points.map(point => `<option value="${esc(point.value)}">${esc(point.label)}</option>`).join("")
        : `<option value="">${esc(game.i18n.localize("DRPG.Season.resetCastNoRooms"))}</option>`;
    return `<fieldset class="drpg-reset-section drpg-reset-cast">
        <legend>${esc(game.i18n.localize("DRPG.Season.resetCastTitle"))}</legend>
        <p class="notes">${esc(game.i18n.localize("DRPG.Season.resetCastNote"))}</p>
        ${choice("stay", "DRPG.Season.resetCastStay")}
        ${choice("bedroom", "DRPG.Season.resetCastBedroom")}
        ${choice("point", "DRPG.Season.resetCastPoint", { disabled: !points.length,
            after: ` <select name="castPoint"${points.length ? "" : " disabled"}>${options}</select>` })}
    </fieldset>`;
}

/**
 * Wipe the season, keep the cast.
 *
 * Typed confirmation, not a clicked one. Every other destructive control in this
 * module asks with a Yes button, and that is right for deleting one project or
 * one Remnant. This deletes a chapter's worth of everything at once and cannot
 * be undone by any route the module offers, so it asks for the word - the point
 * of typing is the half-second it buys to read the list above it.
 */
export async function resetSeason() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    /*
     * THE RESET IS THE PRIMARY GM'S (E04 C10; audit S06-20, D12). What it wipes lives
     * in every GM's browser now (the GM stores), and it reaches them through one cut in
     * the clock and the stores' clears, which are the primary's alone (the handle's
     * `clear`): one browser decides, the one that already answers for the table. On
     * 1.2.62 an assistant's reset cleared its own browser and left last season's trap
     * plants on the primary's, which hands a Search its find. Another GM is told whose
     * the reset is. And the window waits for this browser to have the other GMs' copies
     * before it opens, so the cut's stamp is taken over every row they hold (the
     * design's row 12).
     */
    if (!isPrimaryGm()) {
        const name = game.users.get(primaryGmId())?.name ?? "?";
        ui.notifications.warn(game.i18n.format("DRPG.GmStore.resetPrimaryOnly", { name }));
        return null;
    }

    if (alreadyOpen("drpg-window-season-reset")) return null;
    await whenGmStoresHydrated();
    if (alreadyOpen("drpg-window-season-reset")) return null;

    const tallies = await resetTallies();
    const word = game.i18n.localize("DRPG.Season.resetWord");
    const remembered = rememberedExceptions();
    /*
     * A RESET THAT DID NOT FINISH OPENS THE NEXT WINDOW (E42 C4, 1.2.97; E42-18). Its record names the groups it left -
     * failed, not run, or never reached by a tab that closed - and the window says so and ticks those alone, not the
     * remembered exceptions' complement; a reset run from it leaves the remembered exceptions as they are, since nothing
     * the GM unticks there is a decision about the next season. A reset that finished opens the window as before. Since
     * E42 fix FG3 that window does not say the choice is remembered (`resetGroupsNote`): there it is not (the end review's
     * G-F7 = C-n1, STATUS Open 32).
     */
    const unfinished = unfinishedGroups();
    const ticks = key => unfinished.length ? unfinished.includes(key) : !remembered.keys.has(key);

    /*
     * ONE WINDOW, NEVER TWO (R-1). A chain of dialogs would pay the awaited-close
     * stall twice and would throw away whatever was ticked but not applied - and
     * the ticks ARE the decision here, not a detail of it.
     */
    const rows = RESET_SECTIONS.map(section => {
        const inSection = RESET_GROUPS.filter(group => group.section === section);
        if (!inSection.length) return "";
        return `<fieldset class="drpg-reset-section">
            <legend>${esc(sectionLabel(section))}</legend>
            ${inSection.map(group => `<label class="drpg-inline-check">
                <input type="checkbox" name="wipe.${group.key}"
                    ${ticks(group.key) ? "checked" : ""} />
                ${esc(groupLabel(group.key))}</label>`).join("")}
        </fieldset>`;
    }).join("");

    // A GM whose browser is closed keeps its copy of the case until it next opens this
    // world, and is cut then (the clock carries the cut): said, so nobody reads a GM
    // who was away still holding last season as a reset that failed.
    const offline = game.users.filter(user => user.isGM && !user.active).map(user => user.name);
    const offlineLine = offline.length
        ? `<p class="notes">${esc(plural("DRPG.GmStore.resetOfflineGms", { n: offline.length, names: offline.join(", ") }))}</p>`
        : "";

    const unfinishedLine = unfinished.length
        ? `<p class="drpg-warning">${esc(game.i18n.format("DRPG.Season.resetUnfinished", { groups: listOf(unfinished.map(groupLabel)) }))}</p>`
        : "";
    const memoryLine = remembered.keys.size && !unfinished.length
        ? `<p class="notes">${esc(plural("DRPG.Season.resetRemembered",
            { n: remembered.keys.size }))}${remembered.dropped
                ? ` ${esc(plural("DRPG.Season.resetForgotten", { n: remembered.dropped }))}` : ""}</p>`
        : "";

    const typed = await DialogV2.wait({
        classes: ["drpg-panel", "drpg-window-season-reset"],
        window: { title: game.i18n.localize("DRPG.Season.resetTitle") },
        content: dialogContent(`<form>
            <p class="drpg-warning">${esc(game.i18n.localize("DRPG.Season.resetWarning"))}</p>
            ${offlineLine}
            ${unfinishedLine}
            <p><strong>${esc(game.i18n.localize("DRPG.Season.resetGoes"))}</strong></p>
            <div class="drpg-reset-goes-list">${resetGoesHtml(
                planFrom(RESET_GROUPS.map(group => group.key).filter(ticks)), tallies)}</div>
            <p><strong>${esc(game.i18n.localize("DRPG.Season.resetKeeps"))}</strong></p>

            <!-- R-1. Every step of the wipe, ticked. An unticked box is an
                 exception: that group is left exactly as it is, and the choice is
                 remembered for the next reset. The line under the list says what
                 was remembered, because a GM must never have to work out why a
                 box is already clear. -->
            <p><strong>${esc(game.i18n.localize("DRPG.Season.resetGroupsTitle"))}</strong></p>
            ${unfinished.length ? "" : `<p class="notes">${esc(game.i18n.localize("DRPG.Season.resetGroupsNote"))}</p>`}
            ${memoryLine}
            <div class="drpg-reset-groups">${rows}</div>
            ${castFieldset()}

            <label>${esc(game.i18n.format("DRPG.Season.resetType", { word }))}
                <input type="text" name="confirm" autocomplete="off" autofocus /></label>
        </form>`),
        // The list above the ticks follows them: a box unticked strikes its row out.
        render: (event, dialog) => {
            const root = dialog.element;
            root?.querySelector(".drpg-reset-groups")?.addEventListener("change", () => {
                const list = root.querySelector(".drpg-reset-goes-list");
                if (list) list.innerHTML = resetGoesHtml(planFrom(tickedIn(root)), tallies);
            });
        },
        buttons: [
            {
                action: "reset", label: game.i18n.localize("DRPG.Season.resetButton"),
                class: "drpg-gm-route drpg-destructive",
                callback: (e, b, d) => ({
                    word: d.element.querySelector("[name=confirm]").value.trim(),
                    ticked: tickedIn(d.element),
                    cast: castChoiceIn(d.element)
                })
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel"), default: true }
        ],
        rejectClose: false
    });

    if (!typed || typed === "cancel" || !typed.word) return null;
    /* EXACTLY, AS THE WINDOW SAYS (E11 fix r2-H4; goal D3 / S06-49). Until then the word was compared
       case-blind under "type {word} exactly", so "reset" wiped a season. A destructive confirm takes the
       word as the window prints it; only the spaces around it are trimmed (the button's callback). */
    if (typed.word !== word) {
        ui.notifications.warn(game.i18n.format("DRPG.Season.resetMistyped", { word }));
        return null;
    }
    /* STILL THE PRIMARY WHEN THE WINDOW CLOSES (E11 fix r2-H4; round 2's sec S4 and COR2-8). The check
       above runs before the window, which can stand for minutes: a GM with a lower id (or a full GM,
       when an assistant opened it) arriving meanwhile made another browser the primary, and the reset
       ran here anyway - the cast's step moved nobody and named nobody (and, read in the code, the
       deaths step dropped this browser's rows instead of clearing the store). Asked again, with the
       same words, before anything is written. Scenario 65 U1 (the returning GM connecting while the
       window stands). */
    if (!isPrimaryGm()) {
        const name = game.users.get(primaryGmId())?.name ?? "?";
        ui.notifications.warn(game.i18n.format("DRPG.GmStore.resetPrimaryOnly", { name }));
        return null;
    }

    // Where the cast goes rides on the plan: a choice, not a tick, so `planFrom` (the ticks') does not read it.
    const plan = { ...planFrom(typed.ticked), cast: typed.cast ?? { to: "stay" } };
    if (!plan.groups.size) {
        // Nothing ticked is not a reset, and it is worth saying so rather than
        // running a wipe that does nothing and reporting success.
        ui.notifications.warn(game.i18n.localize("DRPG.Season.resetNothing"));
        return null;
    }

    // Remembered BEFORE the wipe: everything stored is what the wipe is about to
    // leave alone, so nothing it does can lose the decision. Not by a reset that finishes an unfinished one (E42 C4).
    if (!unfinished.length) await rememberExceptions(plan.keep);

    return wipeSeason(plan);
}

/**
 * Delete chat in batches.
 *
 * A season's worth of messages deleted one document at a time is one socket
 * round trip each, and a few thousand of those locks the GM's client for long
 * enough to look like a crash. Five hundred at a time is well inside what a
 * single update can carry and short enough that nothing times out.
 */
async function deleteMessages(ids) {
    for (let i = 0; i < ids.length; i += TIMING.chatDeleteBatch) {
        await ChatMessage.deleteDocuments(ids.slice(i, i + TIMING.chatDeleteBatch));
    }
    return ids.length;
}

/**
 * THE RESET'S ORDER, AS ONE LIST (E11 C9, 10.10.2026; audit S06-15, the plan's 3.1 and
 * p10change). `wipeSeason` runs the ticked groups in this order, once each, after its cut -
 * each group's entry of the registry (season-reset.mjs) since E42 C3; `RESET_GROUPS`
 * (season-exceptions.mjs) is the window's order, by section, and R50 holds the two to the same
 * keys and every key to its entry.
 *
 * The incident first: a reset abandons the running incident before anything it could write
 * about is wiped, so whatever a kept group still holds afterwards was not written by the reset.
 * Until C9 it ran fourth, after the traces, the Truth Bullets and the deaths. Then the cast's
 * armed Despair Calls, the board, the deaths, the case and the cast's sheets; the chat last but
 * the clock, so a card an earlier step posted goes with it; and the clock last of all, so
 * nothing armed fires on a clock still reading the old season.
 *
 * One step is not a group (E11 C10b): `placeCast`, where the cast's tokens go, after the cast's
 * groups - so the deaths the reset clears are cleared before it asks who is dead - and before the
 * chat. It is asked for by the window's choice rather than a tick (`RESET_CHOICES`): "stay" runs
 * nothing and is no exception, so the window has no box for it and nothing remembers it.
 */
export const RESET_STEPS = Object.freeze([
    "incident", "seals", "projects", "mastermind", "passages", "deaths",
    "remnants", "bullets", "trialFloor", "trialProgress", "bodyFound", "discovered", "searchTokens",
    "keyPlan", "eclipseMoves", "motive", "rules", "assembly",
    "items", "advancement", "actions", "despair", "assignments", "overflow", "doors", "stashesFound",
    "placeCast",
    "preNotes", "cards", "chatRest",
    "clock"
]);

/** The steps of `RESET_STEPS` the window's choices ask for, not its ticks (E11 C10b). R50 holds the rest to the groups. */
export const RESET_CHOICES = Object.freeze(["placeCast"]);

/**
 * THE CAST'S GROUPS, ONE STUDENT AT A TIME (E11 C10, 10.10.2026; audit S06-21, S06-41, S08-32;
 * D12 option 1). What a cast group takes off one student, under the group's key: the owners' clears
 * call it for every student through the reset's `ctx.everyStudent` (E42 C3), and tier 2's "each cast group of the reset takes what its label
 * says off one student and nothing else" calls it for one actor of its own - a reset of a real
 * world is not the suite's to run, and the cut `wipeSeason` writes first is the whole world's.
 *
 * Until C10 three of the window's promises were kept by another tick, or by none. Health, Sanity
 * and Hope came back only with `advancement` (`initCharacter`'s values), so a table that kept the
 * advances kept last season's wounds and Hope under a `despair` row that said "every Hope back to
 * the start" (S06-21). A Call armed for the next roll outlived `seals` and fell on the new season's
 * first roll, and the bedroom keys went with `items` and came back only at the next load
 * (S06-41). A stash's hiding place outlived the reset that took everything around it (S08-32).
 * Each value is the reset's constant, written with no read: it supersedes whatever a put-back
 * still owes (the plan's 1b.2). The Reroll's last roll is the GMs' store `rerollBookmarks`, cut by
 * `actions` since E08+E28 C2 (gm-stores.mjs); the actor flag `lastAction` the plan names here is
 * 1.2.63's, taken off every actor by a migration (action-pipeline.mjs `dropRollBookmarks`), so
 * nothing here writes it.
 *
 * `left`, when given, collects what the `advancement` part could not tell apart (E11 C11): a
 * student's experiences a Level Up may have added before 1.2.73 wrote them down, kept on the
 * sheet, as `{ name, experiences }` - the reset's report names them (the owner's Q1 (a)).
 *
 * @returns {Promise<boolean>} false when it is not a GM's browser, not a character or no cast group.
 */
export async function wipeStudent(actor, key, { left = null } = {}) {
    if (!game.user.isGM || actor?.type !== "character") return false;
    const { trustedWrite } = await import("./resource-guard.mjs");
    const parts = {
        // An armed Call is the board's, as a seal is (D12): unset before the clock step, so
        // nothing armed is spent on a roll of the new season.
        seals: async () => {
            if (actor.getFlag(MODULE_ID, FLAGS.pendingCall) !== undefined) await actor.unsetFlag(MODULE_ID, FLAGS.pendingCall);
        },
        deaths: async () => {
            const { reviveCharacter } = await import("./chapter.mjs");
            const { setMonocub } = await import("./monocub.mjs");
            // Quiet (E51 C6; audit S06-46): the reset's own report says what it did, not a toast per Monocub.
            if (actor.getFlag(MODULE_ID, "monocub")) await setMonocub(actor, false, { quiet: true });
            if (isDeceased(actor)) await reviveCharacter(actor, { quiet: true });
            // Everybody comes back whole, the living too: `reverse` resources, 0 is unharmed.
            await trustedWrite(actor, { "system.resources.hitPoints.value": 0, "system.resources.stress.value": 0 },
                { reason: "setup" });
        },
        items: async () => {
            const ids = seasonItems(actor).map(i => i.id);
            if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
            // The bedroom keys went with the rest; each owner gets theirs back at once (D12).
            await reconcileBedroomKeys({ silent: true, owners: [actor.id] });
        },
        // Restore first, THEN re-initialise: `initCharacter` stamps the starting sheet as it
        // goes, and stamping before the restore would record the advanced spread as the one to
        // come back to. The maxima only: the values are `deaths`' and `despair`'s since C10.
        // A Level Up's experiences go in the restore since E11 C11 (character.mjs `seasonExperiences`).
        advancement: async () => {
            const { restoreStartingSheet } = await import("./character.mjs");
            const restored = await restoreStartingSheet(actor);
            if (restored?.left?.length && Array.isArray(left)) left.push({ name: actor.name, experiences: restored.left });
            await initCharacter(actor, { resetValues: false, quiet: true });
        },
        // A stamp keyed to a clock that is about to read session 1, day 1 again: "rested this
        // session". Left standing it refused the first Long Rest of the new season. The other
        // flag is the betrayal offer's shape before CASE-04, which only the upgrade's lift
        // (incident-store.mjs) reads or unsets now, and a world it could not lift keeps; the offer
        // itself is the cast's record and goes with the incident group (`clearBetrayalOffer`), which
        // is why this group's label no longer promises the betrayal window (E11 fix r2-H4, S06-49).
        actions: async () => {
            for (const flag of [FLAGS.restsTaken, FLAGS.betrayalWindow]) {
                if (actor.getFlag(MODULE_ID, flag) !== undefined) await actor.unsetFlag(MODULE_ID, flag);
            }
        },
        despair: async () => {
            await trustedWrite(actor, { "system.resources.hope.value": STARTING.hope }, { reason: "setup" });
        },
        // "I have found X's hiding place" was written on the finder and cleared by nothing;
        // next season the same character opened the same drawer for free. And the hiding
        // places themselves.
        stashesFound: async () => {
            await forgetAllStashesFound([actor]);
            await unconcealStashes(actor.id);
        }
    };
    if (!parts[key]) return false;
    await parts[key]();
    return true;
}

/**
 * THE CAST WHERE THE GM CHOSE (E11 C10b, 1.2.73; the owner's Q2 of 09.10.2026, and of 10.10.2026
 * for a token on another map). `choice.to`: "stay" moves nothing; "bedroom" moves each student's
 * token into the room Room Setup gave them (the region flag `VAULT_FLAGS.owner`, read through
 * `allBedroomsAnywhere` - every scene, never the one on this GM's screen: ITEM-16); "point" moves
 * every student's token into the room `choice.scene`/`choice.region` names. Only on the map the room
 * is drawn on: Foundry moves no token between scenes, so a student whose token is on another map,
 * who has no token there or no bedroom, stays where they are and is answered in `stayed`, which the
 * reset's report names. A cross-scene move is E13's to measure (C3b), and a later commit's to reuse.
 *
 * A body stays where it fell and is not named: the gather's rule (call-world.mjs `gatherEveryone`,
 * DESP-15), read here off the primary's mark (`flagsHeldNow`) in the one synchronous pass that
 * decides every move before the first is made (H3). With `deaths` ticked the reset has revived
 * everybody by now; a death is still standing here only when that box was unticked.
 * A bedroom whose name another map's room already has is not found: `allBedroomsAnywhere` keeps the
 * first scene's (read in the code); that student stays and is named.
 *
 * The moves are the gather's (`teleportInto`), made by a GM, which movement.mjs does not bill.
 * AND EACH CAMERA GOES WITH ITS TOKEN, as the gather's does (E11 fix r2-H4; goal census K4, the
 * class of S06-07 that C3 closed for the gather): until then a player whose token the reset moved
 * kept looking at the room it had left. After each room's moves, `SYNC.gather` names the room, its
 * scene and the tokens moved there; each client pans to its own (call-world.mjs `panToGathered`),
 * and the packet is applied only from a GM (sync.mjs `registerSync`). Scenario 65 U0.
 * Called by the reset's step on the primary GM, and by tier 2's "the cast goes where the GM chose"
 * with three students of its own.
 *
 * @returns {Promise<{moved: string[], stayed: string[]}|null>} the actor ids; null on any browser
 *   but the primary GM's, which moves nothing - and which the reset's step files as failed.
 */
export async function placeCast(choice, actors = studentActors()) {
    if (!isPrimaryGm()) return null;
    const placed = { moved: [], stayed: [] };
    const to = CAST_TO.includes(choice?.to) ? choice.to : "stay";
    if (to === "stay") return placed;
    const { flagsHeldNow } = await import("./sheet-audit.mjs");
    const { isMonocub } = await import("./monocub.mjs");
    const { teleportInto } = await import("./call-world.mjs");

    const bedrooms = to === "bedroom" ? allBedroomsAnywhere() : [];
    const pointScene = to === "point" ? game.scenes.get(choice.scene) : null;
    // A room's piece only (E12 fix r1-G5): the window offers no other, and a choice naming one is no point.
    const pointRegion = pointScene ? roomPieces(pointScene).find(region => region.id === choice.region) : null;
    const point = pointRegion ? { scene: pointScene, region: pointRegion } : null;
    const tokensOf = (actor, scene) => [...(scene?.tokens ?? [])].filter(token => token.actorId === actor.id);
    const batches = new Map();
    for (const actor of actors) {
        const held = flagsHeldNow(actor);
        if (isDeadForGm(held) && !isMonocub(held)) continue;
        let target = point;
        if (to === "bedroom") {
            const mine = bedrooms.filter(entry => entry.owner?.id === actor.id);
            const bedroom = mine.find(entry => tokensOf(actor, entry.scene).length) ?? mine[0];
            const region = bedroom ? roomRegions(bedroom.scene, bedroom.room)[0] ?? null : null;
            target = region ? { scene: bedroom.scene, region } : null;
        }
        const tokens = target ? tokensOf(actor, target.scene) : [];
        if (!tokens.length) {
            placed.stayed.push(actor.id);
            continue;
        }
        const key = `${target.scene.id}.${target.region.id}`;
        if (!batches.has(key)) batches.set(key, { ...target, tokens: [] });
        batches.get(key).tokens.push(...tokens);
        placed.moved.push(actor.id);
    }
    const { broadcast, SYNC } = await import("./sync.mjs");
    for (const { scene, region, tokens } of batches.values()) {
        await teleportInto(scene, region, tokens);
        broadcast(SYNC.gather, { room: region.name, scene: scene.id, tokenIds: tokens.map(t => t.id) });
    }
    return placed;
}

/**
 * THE RESET'S OWN ENTRIES (E42 C3). Six groups have no owner but the reset: three cast groups whose part on each
 * student's sheet is `wipeStudent`'s, the chat in two groups, and the clock. Each a named function, registered below
 * like any owner's; their bodies and their comments are the runs of `wipeSeason` they were until C3. And the cast's
 * step (`placeCastStep`), which is the window's choice rather than a group, the walker's own.
 */

/** The season's items on every student, the bedroom keys handed back at once (`wipeStudent`'s `items` part, D12). */
async function clearSeasonItems(ctx) {
    await ctx.everyStudent("items");
}

/** What the window counts of the items: the season's on every student (`seasonItems`). */
function tallySeasonItems() {
    return [plural("DRPG.Season.resetItems", { n: studentActors().reduce((n, a) => n + seasonItems(a).length, 0) })];
}

/*
 * The most irreversible thing here, and the reason the dialog names the number of advances before the word is typed.
 * The Level Ups on offer go with it (E04, the owner's Q4), and not in this step: the reset's cut withdraws them from
 * every GM's store and every owner's copy - a GM or an owner away now included - and an owner's sheet is drawn again
 * when its copy is cut (gm-stores.mjs `offerCopy`).
 */
async function clearSeasonAdvancement(ctx) {
    await ctx.everyStudent("advancement");
}

/** What the window counts of the advancement: every student's advances. */
function tallySeasonAdvancement() {
    const advances = studentActors().reduce((n, a) => n + Number(a.getFlag(MODULE_ID, FLAGS.advances) ?? 0), 0);
    return [plural("DRPG.Season.resetAdvances", { n: advances })];
}

/** The hiding places found and the stashes concealed, on every student (`wipeStudent`'s `stashesFound` part). */
async function clearSeasonStashesFound(ctx) {
    await ctx.everyStudent("stashesFound");
}

/** The module's own cards and the messenger threads under them (`moduleMessages`). */
async function clearSeasonCards() {
    await deleteMessages(moduleMessages().map(m => m.id));
}

/** What the window counts of the cards: the module's own in the chat. */
function tallySeasonCards() {
    return [plural("DRPG.Season.resetCards", { n: moduleMessages().length })];
}

/*
 * Separate group, and separate from the one above it: if the module's own cards fail to clear, the rest of the log
 * should still go when it was asked for, and the other way round. It is the one line of this reset that reaches outside
 * the module, which is why it has always been asked for on its own - and since R-1 it is asked for as a group like
 * every other.
 */
async function clearSeasonChat() {
    await deleteMessages(game.messages.map(m => m.id));
}

/*
 * A PATCH, NOT A NEW CLOCK (E10 C10, 1.2.71; audit S06-16, D12 option 1). The season counter went nowhere - a patch
 * that does not name `season` keeps 1 for ever - and the Final Trial's flag rode into the next season's first trial
 * ("This trial is the Final Trial."). Both are named now. The audit's fix built the step from `{ ...DEFAULT_CLOCK,
 * campaignName, ... }`: that would have put DEFAULT_CLOCK's `seasonStartedAt: null` and empty `resetCuts` over what
 * the cut wrote a moment before (season-exceptions.mjs `resetCutPatch`) - the cuts every store and the fog's ledger
 * are read under (settings.mjs reads `resetCuts.discovered`) - and a fresh `Date.now()` is not the cut's stamp, the
 * season's epoch (`seasonEpoch`) the Blackened register, the stores' compaction and an Eclipse's name read. So
 * `setClock` merges as before, and both stay the cut's (tier 2, "a reset counts the season and keeps the fog epoch").
 * The clock is kept out of the settings written whole, campaign name kept, because the name belongs to the table.
 *
 * THE SENTENCE BEFORE THE PHASE (E70 C4): this write leaves a running trial, and the way out of one carries out its
 * sentence (trial-progress.mjs `executeAtExit`) - on a student the "deaths" step may just have brought back, in a
 * season that is over. Taken back first, whichever groups were ticked.
 *
 * AND THE CLOCK'S TWO RECORDS WITH IT (E42 C4, 1.2.97; E42-16, Q-E42-2): the readiness round (`readyRound`, E37 C3) and
 * the End of chapter's record (`chapterEnd`, E42 C2) are read against the clock - a round by its boundary, an end that
 * stopped by the chapter, session and day it began on - so they go when it does, each written empty by its owner's own
 * road (boundary.mjs `clearReadyRound` in a step of `READY_KEY`, chapter.mjs `clearChapterEndRecord` in the end's
 * queue). Until C4 no group cleared either. Every part is tried (`everyPart`): one that fails does not keep the clock
 * from its new season, and the step fails with it.
 */
async function clearSeasonClock() {
    const { clearSentence } = await import("./vote.mjs");
    await clearSentence();
    const { clearReadyRound } = await import("./boundary.mjs");
    const { clearChapterEndRecord } = await import("./chapter.mjs");
    await everyPart(clearReadyRound, clearChapterEndRecord, async () => {
        const clock = getClock();
        await setClock({
            chapter: 1, day: 1, session: 1, timeOfDay: "morning",
            phase: "dailyLife", eclipse: false, pausedAt: null,
            timeOfDayStartedAt: serverNow(),
            // Kept: the season is new, the campaign is not.
            campaignName: clock.campaignName,
            season: (clock.season ?? 1) + 1,
            finalTrial: false
        });
    });
}

registerSeasonState({ group: "items", clear: clearSeasonItems, tally: tallySeasonItems });
registerSeasonState({ group: "advancement", clear: clearSeasonAdvancement, tally: tallySeasonAdvancement });
registerSeasonState({ group: "stashesFound", clear: clearSeasonStashesFound });
registerSeasonState({ group: "cards", clear: clearSeasonCards, tally: tallySeasonCards });
registerSeasonState({ group: "chatRest", clear: clearSeasonChat });
registerSeasonState({ group: "clock", clear: clearSeasonClock, settings: [SETTINGS.clock, SETTINGS.readyRound, SETTINGS.chapterEnd] });

/*
 * A cast that could not be placed is a failed step (E11 fix r2-H4; sec S4, COR2-8): `placeCast` answers null off the
 * primary - a GM with a lower id arrived after the window closed - and until then the step read that as "nobody
 * stayed", was filed done and named nobody, while the GM had picked a place. Thrown, the report names it with the
 * failed groups. 65 U2. Who stayed where they were goes on the reset's report (`ctx.stayed`).
 */
async function placeCastStep(ctx) {
    const placed = await placeCast(ctx.plan.cast);
    if (!placed) throw new Error("the cast was not placed: this browser is no longer the primary GM's");
    ctx.stayed.push(...placed.stayed);
}

/** Whether a reset runs on this browser now (`wipeSeason`): its record says "applying" while it runs, and is not unfinished. */
let wiping = false;

/** The clock's fields a reset's record names at each write, and `unfinishedGroups` holds the clock to (E42 fix FG3b). */
const RECORD_POSITION = Object.freeze(["season", "chapter", "session", "day", "timeOfDay"]);

/** Where the clock stands now, in `RECORD_POSITION`'s fields: `getClock`'s, every field present; null for one stored null. */
function clockPosition(clock = getClock()) {
    return Object.fromEntries(RECORD_POSITION.map(key => [key, clock[key] ?? null]));
}

/**
 * THE RESET'S RECORD (E42 C4, 1.2.97; E42-18; audit S17-30). The world setting `seasonReset`, written by the primary GM
 * alone, inside `wipeSeason`: `{ stage, by, at, groups, done, failed, notRun, season, chapter, session, day, timeOfDay }` -
 * the groups the GM ticked, the steps that ran, failed or did not run (step keys, `placeCast` among them), the GM's id and
 * the clock's position at the write (`RECORD_POSITION`, `clockPosition`), no text and no secret (world-secrets.mjs names
 * it). Written "applying" once the cut stands and before the first step, again after every step that changed it, and at
 * the end "done" when every ticked group ran, or left "applying". `{}` before the first reset. Until 1.2.97 a reset kept
 * no record: its card named what failed, and a tab closed half way told nobody which groups had run.
 */
export function seasonResetRecord() {
    try {
        return game.settings.get(MODULE_ID, SETTINGS.seasonReset) ?? {};
    } catch {
        return {};
    }
}

/**
 * The groups a reset that did not finish left undone, in the window's order, or []: its record "applying", no reset
 * running on this browser, and of the groups it was given those it did not do - failed, not run, or never reached by a
 * tab that closed. A group a later release no longer knows is dropped, as `rememberedExceptions` drops one. The record
 * is read whoever wrote it: the primary GM now finishes a reset another primary began.
 *
 * ONLY WHILE THE CLOCK STANDS WHERE IT LEFT IT (E42 fix FG3 and FG3b, 03.11.2026; the end review's C-m3). A record
 * "applying" never went stale: a reset whose chat group failed, then a season played to its end, opened that season's
 * reset on the chat alone, every other group struck through. FG3 stamped the record with the season alone, and the season
 * moves only in the reset's own clock clear (`clearSeasonClock`; the cut writes `seasonStartedAt` and `resetCuts`, never
 * the season - `resetCutPatch`): a reset whose clock group ran and another failed left a record of the season the clock
 * then read for the whole of it, and the next reset resumed it. So each write names the clock's position then - its
 * season, chapter, session, day and time of day (`clockPosition`); the last write is the reset's end, so the next
 * season's first morning when its clock group ran, and where the clock stood when it did not - and the window resumes
 * the record only while the clock reads that same position in all five. Once the clock has moved on in any of them - a
 * time of day passed, a session or chapter begun, a season counted - the record is read as finished for the window, as
 * is one that names less than the five (written before FG3b; STATUS Open 48), and the window opens as before (tier 2
 * E42-T13: a time of day on, then put back). The phase and an Eclipse are not part of the position: neither moves the
 * record on.
 */
export function unfinishedGroups(record = seasonResetRecord()) {
    if (wiping || record?.stage !== "applying") return [];
    const now = clockPosition();
    if (RECORD_POSITION.some(key => record[key] !== now[key])) return [];
    const asked = new Set(Array.isArray(record.groups) ? record.groups : []);
    const done = new Set(Array.isArray(record.done) ? record.done : []);
    return RESET_GROUPS.map(group => group.key).filter(key => asked.has(key) && !done.has(key));
}

/**
 * The wipe itself.
 *
 * Each step is guarded on its own. A world where one of these settings was never
 * registered - an older save, a module half-installed - must still get the rest
 * of the reset rather than stopping at the first throw and leaving the season
 * half-cleared, which is a worse state than either end.
 */
async function wipeSeason(plan) {
    // The students `placeCast` could not move (E11 C10b): the report names them.
    const stayed = [];
    // The experiences `advancement` kept because nothing told a Level Up's from the GM's (E11 C11): named likewise.
    const left = [];

    /*
     * THE CUT FIRST, AND OUTSIDE EVERY STEP (E04 C10; the design's 2.10, D12 option 1).
     * One clock patch: every wiped group cut at one stamp. The steps below delete what
     * the world holds and clear this browser's stores, whose watermark reaches a GM
     * when the two exchange copies; the cut reaches every client when the clock does
     * (gm-store.mjs `applyCuts`), each player's copies with it, and a GM's browser that
     * is closed now when it next opens this world - alone, too, with nobody to hand it
     * the clears. Written before the steps, so one that fails leaves the cut standing;
     * and when it cannot be written nothing is wiped, or a GM who was away would open
     * the world alone holding last season, and act on it.
     */
    /* THE TRIAL'S MICROPHONES GIVEN BACK FIRST (E70 C5): the cut empties the store of what the trial's mute found
       (gm-stores.mjs `trialMuteStore`, the trial's group), and a block nobody remembers is never put back. */
    try {
        const { settleTrialVoices } = await import("./voice.mjs");
        await settleTrialVoices({ release: true });
    } catch (err) {
        error("Season reset: could not give the trial's muted microphones back", err);
    }
    try {
        await setClock(resetCutPatch(plan, getClock(), gmStoreStamp()));
    } catch (err) {
        error("Season reset: could not write the reset's cut on the clock, so nothing was cleared", err);
        ui.notifications.error(game.i18n.format("DRPG.GmStore.resetCutFailed", { error: String(err?.message ?? err) }));
        return null;
    }

    /*
     * THE RECORD ONCE THE CUT STANDS (E42 C4; E42-18). The primary's alone: a record write on a browser that lost primacy
     * is not made (the next primary reads what this one wrote), and a write that fails is logged and costs the reset
     * nothing - the record serves the next window, and a group it misses is offered again, ticked, for the GM to read.
     */
    let written = null;
    // Each write names the clock's position then (`clockPosition`, read by `unfinishedGroups`; E42 fix FG3, FG3b).
    const writeRecord = async record => {
        const next = { ...record, ...clockPosition() };
        if (!isPrimaryGm() || JSON.stringify(next) === JSON.stringify(written)) return;
        try {
            await game.settings.set(MODULE_ID, SETTINGS.seasonReset, next);
            written = next;
        } catch (err) {
            error("Season reset: could not write its record", err);
        }
    };
    const record = { stage: "applying", by: game.user.id, at: serverNow(), groups: [...plan.groups], done: [], failed: [], notRun: [] };
    await writeRecord(record);

    // A cast group's part on each student's sheet (`wipeStudent`, E11 C10), reached by an owner's clear through `ctx`.
    const context = {
        plan, left, stayed,
        everyStudent: async key => {
            for (const actor of studentActors()) await wipeStudent(actor, key, { left });
        }
    };

    /*
     * ONE STEP PER GROUP, IN `RESET_STEPS`' ORDER, FROM THE REGISTRY (E11 C9; E42 C3, audit S17-30). Each group's step
     * is its entry's `clear` (season-reset.mjs), registered by the file that owns the state - a group stored in more
     * than one place, the incident, the bodies found, the discovered rooms, is cleared in all of them by its one
     * clear. Until C3 the clears were the members of one table here, `runs`, and a group's owner had to remember it.
     * The entry is read as its step runs, so the clear that runs is the one registered then. A group with no entry
     * throws at its step and is reported as failed; R1254 says so before a GM ever meets it.
     *
     * EVERY STEP IS GATED BY ITS OWN GROUP (R-1, Dawid 18.09). A group the GM unticked is an exception: it is kept
     * (`ask` false), its entry's `keep` runs instead (the Key Remnant plan's trim, before the clock's step), and the
     * log says what was kept as well as what went - because "cleared: nine things" with no mention of the seven that
     * stayed is the half of the sentence that gets misread later. The cast's step is the window's choice (E11 C10b):
     * left at "stay" it is not a step at all - it runs nothing and keeps nothing.
     *
     * A STEP THAT FAILS IS TOLD (E11 C9; audit S06-49, the plan's 3.4). Until then its error went to the console
     * alone and the GM read "The season has been reset"; at 4fcc2b4 scenario 65 F measured a reset whose chat could
     * not be deleted reporting success. The rest still runs (steps.mjs `runSteps`: each step in its own try/catch),
     * and the cut stays written: a group already cut reads empty, so running the reset again with only the failed
     * groups ticked is safe.
     *
     * THE PRIMARY'S TO THE LAST STEP (E11 fix r2-J1; r2-H4's open road, the orchestrator's ruling of 11.10.2026).
     * `resetSeason` asks before its window and again as it closes; the steps after the cut await documents for
     * seconds, and a GM with a lower id connecting meanwhile made another browser the primary while this one went on -
     * the deaths step dropped this browser's rows instead of clearing the store, and the clock was counted on from a
     * browser that no longer answers for the table: 65-season U2 read the deaths and the clock cleared there, the
     * cast's step failed and the season counted on, with the code before that fix (11.10.2026, e11run/r2j1red). So
     * every step asks again (`stop`), a kept one too (the Key Remnant plan's trim writes); lost, the reset stops
     * there. What ran stays done, nothing is rolled back, and the steps still asked for are named as not run, for the
     * primary GM to finish with another reset; a group the GM unticked is kept, as it was before the stop.
     */
    const chosen = key => RESET_CHOICES.includes(key);
    const steps = RESET_STEPS.filter(key => !chosen(key) || (plan.cast?.to ?? "stay") !== "stay").map(key => chosen(key)
        ? { key, run: placeCastStep }
        : {
            key,
            ask: () => plan.groups.has(key),
            keep: ctx => seasonStateFor(key)?.keep?.(ctx),
            run: async ctx => {
                const entry = seasonStateFor(key);
                if (typeof entry?.clear !== "function") throw new Error(`no entry of the registry clears the group "${key}"`);
                await entry.clear(ctx);
            }
        });
    wiping = true;
    let walked;
    try {
        walked = await runSteps({ steps, context, record, label: "season reset", stop: () => !isPrimaryGm(),
            save: (current, { end = false } = {}) => (end ? null : writeRecord(current)) });
    } finally {
        wiping = false;
    }
    const asked = key => chosen(key) || plan.groups.has(key);
    const done = walked.done;
    const failed = walked.failed;
    const kept = [...walked.kept, ...walked.notRun.filter(key => !asked(key))];
    const notRun = walked.notRun.filter(asked);
    // "done" once every ticked group ran; a cast that could not be placed is told by its own words (`failedCast`).
    await writeRecord({ ...walked.record, stage: [...plan.groups].every(key => walked.record.done.includes(key)) ? "done" : "applying", notRun });

    log(`Season reset. Cleared: ${done.join(", ") || "nothing"}.${
        kept.length ? ` Kept: ${kept.join(", ")}.` : ""}${failed.length ? ` Failed: ${failed.join(", ")}.` : ""}${
        notRun.length ? ` Not run (no longer the primary GM's): ${notRun.join(", ")}.` : ""}`);
    const label = key => RESET_CHOICES.includes(key) ? game.i18n.localize("DRPG.Season.resetCastTitle") : groupLabel(key);
    const names = keys => keys.map(label).join("; ");
    /* THE CAST'S MOVE IS NOT A TICK (E11 fix r2-H6; the words r2-H4 left owed). `DRPG.Season.failed` tells the GM
       to run the reset again with only those ticked, and a reset with nothing ticked does not run (`resetNothing`,
       above): a failed `placeCast`, named under those words since r2-H4 (65 U2), sent the GM down a road that
       refuses. The groups keep their words; the cast's step has its own, which say to move the tokens by hand. */
    const groupsFailed = failed.filter(key => !RESET_CHOICES.includes(key));
    const castFailed = failed.some(key => RESET_CHOICES.includes(key)) ? game.i18n.localize("DRPG.Season.failedCast") : "";
    // Who stayed where they were, by name (E11 C10b): on the card and in a warning of its own.
    const stayedLine = stayed.length ? game.i18n.format("DRPG.Season.reportCard.stayed",
        { names: stayed.map(id => game.actors.get(id)?.name ?? id).join(", ") }) : "";
    const stoppedLine = notRun.length ? game.i18n.format("DRPG.Season.stoppedPrimary",
        { name: game.users.get(primaryGmId())?.name ?? "?", groups: names(notRun) }) : "";
    /* WHERE THE TOKENS WENT, ON A LINE OF ITS OWN (E11 fix r2-J1; r2-H6's doubt). The cast's step was
       listed with the groups under "Cleared:", as "Where the cast's tokens go" - and a move clears
       nothing: 65-season J2 read "Cleared: Where the cast's tokens go; The clock, ..." with the code before
       this (11.10.2026, e11run/r2j1red). The groups' lines name groups;
       the move says where it sent the tokens, in the window's own words for the choice. */
    const castLine = done.some(key => RESET_CHOICES.includes(key))
        ? game.i18n.format("DRPG.Season.reportCard.cast", { where: castPlace(plan.cast) }) : "";
    const groupsDone = done.filter(key => !RESET_CHOICES.includes(key));
    if (failed.length || notRun.length) {
        ui.notifications.error([stoppedLine,
            groupsFailed.length ? game.i18n.format("DRPG.Season.failed", { groups: names(groupsFailed) }) : "",
            castFailed].filter(Boolean).join(" "));
    } else {
        ui.notifications.info(kept.length
            ? plural("DRPG.Season.resetDoneKept", { n: kept.length })
            : game.i18n.localize("DRPG.Season.resetDone"));
    }
    if (stayedLine) ui.notifications.warn(stayedLine);
    /* The experiences left in place (E11 C11; the owner's Q1 (a), the plan's 3.4): a starting sheet stamped before
       1.2.73 with no experience in it cannot tell a Level Up's from the GM's, so they stay and the GMs read whose and
       which on the card - on the card only: they are a question for the GM's next look at the sheets, not news. */
    const leftLine = left.length ? game.i18n.format("DRPG.Season.reportCard.experiences",
        { list: left.map(entry => `${entry.name}: ${entry.experiences.join(", ")}`).join("; ") }) : "";
    if (leftLine) log(`Season reset: ${leftLine}`);
    const unfinished = failed.length || notRun.length;
    if (unfinished || stayedLine || leftLine) {
        try {
            const line = (key, keys) => keys.length
                ? `<p>${esc(game.i18n.format(`DRPG.Season.reportCard.${key}`, { groups: names(keys) }))}</p>` : "";
            // The card says the reset did not finish only when it did not; one that finished and left
            // somebody standing has a title of its own, and one that left experiences on a sheet another.
            const title = unfinished ? "DRPG.Season.reportCard.title"
                : leftLine ? "DRPG.Season.reportCard.titleLeft" : "DRPG.Season.reportCard.titleCast";
            await whisperToGms(`<h3>${esc(game.i18n.localize(title))}</h3>
                ${notRun.length ? `<p>${esc(game.i18n.format("DRPG.Season.reportCard.notRun", { groups: names(notRun) }))}</p>` : ""}${
                unfinished ? `${line("failed", groupsFailed)}${castFailed ? `<p>${esc(castFailed)}</p>` : ""}${line("done", groupsDone)}${line("kept", kept)}` : ""}${
                castLine ? `<p>${esc(castLine)}</p>` : ""}${stayedLine ? `<p>${esc(stayedLine)}</p>` : ""}${leftLine ? `<p>${esc(leftLine)}</p>` : ""}`);
        } catch (err) {
            error("Season reset: could not post its report", err);
        }
    }
    return { cleared: done, kept, failed, stayed, left, notRun };
}
