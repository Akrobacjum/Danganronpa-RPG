/**
 * Danganronpa RPG — setting a season up, and taking one down.
 * ---------------------------------------------------------------------------
 * The pre-season checks answer "what is missing". This answers "fix it", and it
 * is the same list read from the other end: every row here is a row there, in
 * the same order, using the same words. Two views, one truth — a check that
 * turns green is a row here that has nothing left to do.
 *
 * NOT A STEP-BY-STEP WIZARD. A next/back flow has one property this must not
 * have: a step you have passed is off screen, and a step skipped is invisible.
 * The complaint that produced this stage was three things missing from a world
 * somebody was already playing in — the failure mode is not "the GM could not
 * find the button", it is "nobody was ever told the button mattered". So every
 * row stays on screen with its state showing, and an outstanding one is
 * outstanding in front of you until it is done.
 *
 * Nothing here does anything the GM could not do by hand. What it does is say
 * what there is to do, in the order a season is actually built.
 */

import { MODULE_ID, FLAGS, STARTING, ITEM_CATEGORIES, CHAPTERS_PER_SEASON } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { getClock, setClock } from "./clock.mjs";
import { studentActors } from "./monokuma.mjs";
import { monokumaFor } from "./assignments.mjs";
import { listExperiences, initCharacter } from "./character.mjs";
import { monokumas } from "./despair.mjs";
import { mastermindActor } from "./mastermind.mjs";
import { dialogContent, log, error, workingScene, MESSAGE_FLAG } from "./utils.mjs";
import { MESSENGER_FLAGS } from "./messenger.mjs";
import { NOTE_FLAG } from "./pre-session-note.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/* ==========================================================================
 * WHAT THE SEASON STILL NEEDS
 * ========================================================================== */

/**
 * One row per thing a season needs, each able to say whether it is done.
 *
 * `missing` returns the names it is waiting on, so a row can say "3: Aoi, Leon,
 * Sakura" rather than "not ready" — the GM's next action is on that list, and a
 * count with no names is a second lookup.
 */
function steps() {
    const roster = studentActors();
    const clock = getClock();

    return [
        {
            key: "name",
            done: Boolean(clock.campaignName?.trim()),
            missing: () => [],
            /** Fixed inside this window; see the form below. */
            inline: true
        },
        {
            key: "cast",
            done: roster.length > 0,
            missing: () => []
        },
        {
            key: "monokumas",
            done: monokumas().length > 0,
            missing: () => []
        },
        {
            key: "resources",
            done: roster.every(a => (a.system?.resources?.hitPoints?.max ?? 0) === STARTING.hp
                && (a.system?.resources?.stress?.max ?? 0) === STARTING.stress),
            missing: () => roster.filter(a => (a.system?.resources?.hitPoints?.max ?? 0) !== STARTING.hp
                || (a.system?.resources?.stress?.max ?? 0) !== STARTING.stress).map(a => a.name),
            // The one row that can finish itself: the guide's numbers are the
            // guide's numbers, and there is nothing to decide.
            fix: async () => {
                let n = 0;
                for (const actor of studentActors()) {
                    const hp = actor.system?.resources?.hitPoints?.max ?? 0;
                    const stress = actor.system?.resources?.stress?.max ?? 0;
                    if (hp === STARTING.hp && stress === STARTING.stress) continue;
                    await initCharacter(actor);
                    n++;
                }
                return n;
            }
        },
        {
            key: "ultimate",
            done: roster.every(a => a.getFlag(MODULE_ID, "ultimate")),
            missing: () => roster.filter(a => !a.getFlag(MODULE_ID, "ultimate")).map(a => a.name),
            // An Ultimate is a sentence somebody writes, so this opens the sheet
            // rather than inventing one.
            open: names => openFirstSheet(names)
        },
        {
            key: "experiences",
            done: roster.every(a => listExperiences(a).length >= STARTING.experiences),
            missing: () => roster.filter(a => listExperiences(a).length < STARTING.experiences)
                .map(a => `${a.name} (${listExperiences(a).length}/${STARTING.experiences})`),
            open: names => openFirstSheet(names)
        },
        {
            key: "items",
            done: roster.every(a => a.items.some(i =>
                Object.keys(ITEM_CATEGORIES).includes(i.getFlag(MODULE_ID, "category")))),
            missing: () => roster.filter(a => !a.items.some(i =>
                Object.keys(ITEM_CATEGORIES).includes(i.getFlag(MODULE_ID, "category")))).map(a => a.name),
            open: async () => (await import("./gm-items.mjs")).openItemManager()
        },
        {
            key: "assignments",
            done: roster.every(a => monokumaFor(a)),
            missing: () => roster.filter(a => !monokumaFor(a)).map(a => a.name),
            open: async () => (await import("./gm-team-dialog.mjs")).openGmTeamDialog()
        },
        {
            key: "rooms",
            done: (workingScene()?.regions?.size ?? 0) > 0,
            missing: () => [],
            open: async () => (await import("./vault.mjs")).openRoomSetupDialog()
        },
        {
            key: "mastermind",
            // The one row that is allowed to stay unticked for ever.
            //
            // A season without a Mastermind is a legal season — the guide's
            // endgame is one way to end a killing game, not the only one — so
            // this reports its state without the red cross that means "you have
            // forgotten something". Everything else on this list is a promise
            // the module has made to a rule; this is an offer.
            optional: true,
            done: Boolean(mastermindActor()),
            missing: () => [],
            open: async () => (await import("./mastermind.mjs")).openMastermindDialog()
        }
    ];
}

/** Open the sheet of the first character a row is waiting on. */
function openFirstSheet(names) {
    const first = studentActors().find(a => names.some(n => n.startsWith(a.name)));
    first?.sheet?.render(true);
}

/* ==========================================================================
 * THE WINDOW
 * ========================================================================== */

export async function openSeasonSetup() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const clock = getClock();
    const list = steps();
    const esc = s => foundry.utils.escapeHTML(String(s ?? ""));

    const rows = list.map(step => {
        const names = step.done ? [] : step.missing();
        const detail = names.length
            ? `<div class="drpg-setup-missing">${esc(names.join(", "))}</div>`
            : "";
        const button = step.done || step.inline
            ? ""
            : `<button type="button" class="drpg-setup-do" data-step="${step.key}">${
                esc(game.i18n.localize(step.fix ? "DRPG.Season.doIt" : "DRPG.Season.openIt"))}</button>`;

        // An optional row that is not done is not a failure, so it gets neither
        // the cross nor the "outstanding" styling — a dash and its own note.
        const mark = step.done ? "✓" : step.optional ? "–" : "✗";

        return `<li class="drpg-setup-step${step.done ? " done" : ""}${
            step.optional && !step.done ? " optional" : ""}">
            <span class="drpg-setup-mark">${mark}</span>
            <div class="drpg-setup-body">
                <strong>${esc(game.i18n.localize(`DRPG.Season.step.${step.key}`))}</strong>
                <div class="notes">${esc(game.i18n.localize(`DRPG.Season.hint.${step.key}`))}</div>
                ${detail}
            </div>
            ${button}
        </li>`;
    }).join("");

    const outstanding = list.filter(s => !s.done && !s.optional).length;

    const result = await DialogV2.wait({
        classes: ["drpg-panel", "drpg-wide"],
        window: { title: game.i18n.localize("DRPG.Season.title") },
        content: dialogContent(`<form>
            <p>${esc(game.i18n.format(outstanding
                ? "DRPG.Season.introOutstanding"
                : "DRPG.Season.introReady", { n: outstanding }))}</p>

            <label>${esc(game.i18n.localize("DRPG.Season.campaignName"))}
                <input type="text" name="campaignName"
                       value="${esc(clock.campaignName ?? "")}"
                       placeholder="${esc(game.i18n.localize("DRPG.Season.campaignPlaceholder"))}" /></label>
            <label>${esc(game.i18n.localize("DRPG.Season.chapter"))}
                <input type="number" name="chapter" min="1" max="${CHAPTERS_PER_SEASON}"
                       value="${Number(clock.chapter) || 1}" /></label>

            <ul class="drpg-setup-list">${rows}</ul>
            <p class="notes">${esc(game.i18n.localize("DRPG.Season.note"))}</p>
        </form>`),
        buttons: [
            {
                action: "save", label: game.i18n.localize("DRPG.Assign.save"), default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return { campaignName: f.campaignName.value.trim(), chapter: Number(f.chapter.value) || 1 };
                }
            },
            // The other end of this same list. "What is missing" and "fix it"
            // are one errand, and the checks used to be a GM-panel tile of
            // their own next to this one — one door fewer, same two answers.
            { action: "checks", label: game.i18n.localize("DRPG.Panel.seasonChecks") },
            { action: "close", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        // Wire the per-row buttons against the mounted DOM — a listener attached
        // to the detached content element never reaches the page. Same reason
        // projects-ui.mjs wires its portrait pickers from `render`.
        render: (event, dialog) => {
            for (const button of dialog.element.querySelectorAll(".drpg-setup-do")) {
                button.addEventListener("click", async ev => {
                    ev.preventDefault();
                    const step = steps().find(s => s.key === button.dataset.step);
                    if (!step) return;
                    try {
                        if (step.fix) {
                            const n = await step.fix();
                            ui.notifications.info(game.i18n.format("DRPG.Season.fixed", { n }));
                        } else {
                            await step.open(step.missing());
                        }
                    } catch (err) {
                        error(`Could not act on the "${step.key}" setup step`, err);
                    }
                    // Reopen so the marks are current: every one of these can
                    // change what another row reports.
                    await dialog.close();
                    openSeasonSetup();
                });
            }
        },
        rejectClose: false
    });

    if (!result || result === "close") return null;

    if (result === "checks") {
        await runPreSessionChecks();
        return openSeasonSetup();
    }

    await setClock({ campaignName: result.campaignName, chapter: result.chapter });
    log(`Season setup saved: "${result.campaignName}", chapter ${result.chapter}.`);
    return result;
}

/**
 * Both pre-session checks, answered in one window.
 *
 * "Is everybody set up" and "can anybody read a sheet they should not" are one
 * question asked at one moment — before a session — so they are one tile and
 * now one answer. Neither report goes to chat from here: they are handed back
 * as text and put on screen, because a question asked with a button should be
 * answered where the button was.
 */
async function runPreSessionChecks() {
    const [{ diagnoseCharacters }, { auditAnonymity }, { diagnoseScenes }] = await Promise.all([
        import("./diagnostics.mjs"), import("./anonymity.mjs"), import("./fog.mjs")
    ]);

    const setup = diagnoseCharacters({ toChat: false });
    const anon = await auditAnonymity({ toChat: false });
    // A scene that has rooms but still uses Foundry's own vision renders as a
    // black screen for players on v14 and says nothing about why, so it belongs
    // on the list of things checked before anybody sits down.
    const scenes = diagnoseScenes();

    await DialogV2.wait({
        classes: ["drpg-panel", "drpg-wide"],
        window: { title: game.i18n.localize("DRPG.Panel.seasonChecks") },
        content: dialogContent(`<div>
            <h3>${game.i18n.localize("DRPG.Panel.checksSetup")}</h3>
            <pre class="drpg-check-report">${foundry.utils.escapeHTML(setup)}</pre>
            <h3>${game.i18n.localize("DRPG.Fog.checksScenes")}</h3>
            <pre class="drpg-check-report">${foundry.utils.escapeHTML(scenes)}</pre>
            <h3>${game.i18n.localize("DRPG.Anonymity.audit.title")}</h3>
            ${anon.body ?? ""}
        </div>`),
        buttons: [{ action: "close", label: game.i18n.localize("DRPG.Panel.close"), default: true }],
        rejectClose: false
    });
}

/* ==========================================================================
 * TAKING A SEASON DOWN
 * --------------------------------------------------------------------------
 * Without this the only way to start again is a new world, which throws away
 * the cast, the map and the room setup along with the season — an hour of work
 * to undo a chapter.
 *
 * The line it draws is between the CAST and the CHAPTER. Actors, scenes, room
 * regions and who watches whom are the table's; the clock, the projects, the
 * traces, the evidence, the deaths and every trace of an incident belong to the
 * season that just ended. That split is why this is safe to offer at all — the
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
        m.getFlag(MODULE_ID, MESSAGE_FLAG) || m.getFlag(MODULE_ID, MESSENGER_FLAGS.thread));
}

/**
 * The free-text note on a character sheet, wherever this system keeps it.
 *
 * NOT the biography. Pronouns, age, faith and connections are who somebody is —
 * the same side of the line as the name, the portrait and the Ultimate, all of
 * which this reset leaves alone. A note is what got written down during the
 * season that just ended.
 *
 * Both paths are probed because the field has moved between Daggerheart
 * versions, and a path that is not there simply is not written.
 */
const NOTE_PATHS = ["system.notes", "system.biography.notes"];

function writtenNotes(actor) {
    const found = {};
    for (const path of NOTE_PATHS) {
        const current = foundry.utils.getProperty(actor, path);
        if (typeof current === "string" && current.trim()) found[path] = "";
    }
    return found;
}

/** What a reset would destroy, counted now rather than described in general. */
function resetTally() {
    const remnants = game.scenes.reduce((n, scene) =>
        n + scene.tokens.filter(t => t.getFlag(MODULE_ID, "isRemnant")).length, 0);

    const bullets = game.actors.reduce((n, a) =>
        n + a.items.filter(i => i.getFlag(MODULE_ID, "isTruthBullet")).length, 0);

    const dead = studentActors().filter(a => a.getFlag(MODULE_ID, "deceased")).length;

    let projects = 0;
    try {
        projects = (game.settings.get("daggerheart", "Countdowns")?.countdowns
            ?? game.settings.get(MODULE_ID, SETTINGS.projectMeta) ?? {});
        projects = Object.keys(projects).length;
    } catch {
        projects = 0;
    }

    const students = studentActors();
    const items = students.reduce((n, a) => n + seasonItems(a).length, 0);
    const advances = students.reduce((n, a) =>
        n + Number(a.getFlag(MODULE_ID, FLAGS.advances) ?? 0), 0);
    const notes = students.filter(a => Object.keys(writtenNotes(a)).length).length
        + game.users.filter(u => u.getFlag(MODULE_ID, NOTE_FLAG)).length;

    const cards = moduleMessages().length;
    const chat = game.messages.size;

    let despair = 0;
    try {
        despair = Object.values(game.settings.get(MODULE_ID, SETTINGS.despairPools) ?? {})
            .filter(v => Number(v) > 0).length;
    } catch {
        despair = 0;
    }

    return { projects, remnants, bullets, dead, items, advances, notes, cards, chat, despair };
}

/**
 * Wipe the season, keep the cast.
 *
 * Typed confirmation, not a clicked one. Every other destructive control in this
 * module asks with a Yes button, and that is right for deleting one project or
 * one Remnant. This deletes a chapter's worth of everything at once and cannot
 * be undone by any route the module offers, so it asks for the word — the point
 * of typing is the half-second it buys to read the list above it.
 */
export async function resetSeason() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const tally = resetTally();
    const word = game.i18n.localize("DRPG.Season.resetWord");
    const esc = s => foundry.utils.escapeHTML(String(s ?? ""));

    const typed = await DialogV2.wait({
        classes: ["drpg-panel"],
        window: { title: game.i18n.localize("DRPG.Season.resetTitle") },
        content: dialogContent(`<form>
            <p class="drpg-warning">${esc(game.i18n.localize("DRPG.Season.resetWarning"))}</p>
            <p><strong>${esc(game.i18n.localize("DRPG.Season.resetGoes"))}</strong></p>
            <ul>
                <li>${esc(game.i18n.format("DRPG.Season.resetProjects", { n: tally.projects }))}</li>
                <li>${esc(game.i18n.format("DRPG.Season.resetRemnants", { n: tally.remnants }))}</li>
                <li>${esc(game.i18n.format("DRPG.Season.resetBullets", { n: tally.bullets }))}</li>
                <li>${esc(game.i18n.format("DRPG.Season.resetDead", { n: tally.dead }))}</li>
                <li>${esc(game.i18n.format("DRPG.Season.resetItems", { n: tally.items }))}</li>
                <li>${esc(game.i18n.format("DRPG.Season.resetAdvances", { n: tally.advances }))}</li>
                <li>${esc(game.i18n.format("DRPG.Season.resetCards", { n: tally.cards }))}</li>
                <li>${esc(game.i18n.format("DRPG.Season.resetNotes", { n: tally.notes }))}</li>
                <li>${esc(game.i18n.format("DRPG.Season.resetPools",
                    { n: tally.despair, hope: STARTING.hope }))}</li>
                <li>${esc(game.i18n.localize("DRPG.Season.resetDoors"))}</li>
                <li>${esc(game.i18n.localize("DRPG.Season.resetState"))}</li>
            </ul>
            <p><strong>${esc(game.i18n.localize("DRPG.Season.resetKeeps"))}</strong></p>

            <!-- The one line of this that reaches outside the module. Everything
                 above is the module's own bookkeeping; the rest of the chat log
                 belongs to Foundry and to whoever typed in it, so it is asked
                 for separately and can be left alone without cancelling. -->
            <label class="drpg-inline-check"><input type="checkbox" name="alsoChat" checked />
                ${esc(game.i18n.format("DRPG.Season.resetChat",
                    { n: Math.max(tally.chat - tally.cards, 0) }))}</label>

            <label>${esc(game.i18n.format("DRPG.Season.resetType", { word }))}
                <input type="text" name="confirm" autocomplete="off" autofocus /></label>
        </form>`),
        buttons: [
            {
                action: "reset", label: game.i18n.localize("DRPG.Season.resetButton"),
                class: "drpg-gm-route",
                callback: (e, b, d) => ({
                    word: d.element.querySelector("[name=confirm]").value.trim(),
                    alsoChat: Boolean(d.element.querySelector("[name=alsoChat]")?.checked)
                })
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel"), default: true }
        ],
        rejectClose: false
    });

    if (!typed || typed === "cancel" || !typed.word) return null;
    if (typed.word.toLowerCase() !== word.toLowerCase()) {
        ui.notifications.warn(game.i18n.format("DRPG.Season.resetMistyped", { word }));
        return null;
    }

    return wipeSeason({ alsoChat: typed.alsoChat });
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
    for (let i = 0; i < ids.length; i += 500) {
        await ChatMessage.deleteDocuments(ids.slice(i, i + 500));
    }
    return ids.length;
}

/**
 * The wipe itself.
 *
 * Each step is guarded on its own. A world where one of these settings was never
 * registered — an older save, a module half-installed — must still get the rest
 * of the reset rather than stopping at the first throw and leaving the season
 * half-cleared, which is a worse state than either end.
 */
async function wipeSeason({ alsoChat = false } = {}) {
    const done = [];
    const step = async (label, fn) => {
        try {
            await fn();
            done.push(label);
        } catch (err) {
            error(`Season reset: could not clear ${label}`, err);
        }
    };

    await step("Remnants", async () => {
        for (const scene of game.scenes) {
            const ids = scene.tokens.filter(t => t.getFlag(MODULE_ID, "isRemnant")).map(t => t.id);
            if (ids.length) await scene.deleteEmbeddedDocuments("Token", ids);
        }
        // The tokens are the half everyone can see. The register of what each
        // one really was is the half that matters, and it does not go with them
        // — deleting a token has never pruned it.
        const { clearRemnantLedger } = await import("./remnants.mjs");
        await clearRemnantLedger();
    });

    await step("Truth Bullets", async () => {
        const { dropSecret } = await import("./truth-bullets.mjs");
        for (const actor of game.actors) {
            const bullets = actor.items.filter(i => i.getFlag(MODULE_ID, "isTruthBullet"));
            for (const bullet of bullets) await dropSecret(bullet.uuid);
            if (bullets.length) {
                await actor.deleteEmbeddedDocuments("Item", bullets.map(b => b.id));
            }
        }
    });

    await step("deaths and Monocubs", async () => {
        const { reviveCharacter } = await import("./chapter.mjs");
        const { setMonocub } = await import("./monocub.mjs");
        for (const actor of studentActors()) {
            if (actor.getFlag(MODULE_ID, "monocub")) await setMonocub(actor, false);
            if (actor.getFlag(MODULE_ID, "deceased")) await reviveCharacter(actor);
        }
    });

    await step("the incident", async () => {
        const { endMurder, clearBlackened } = await import("./murder.mjs");
        const { clearParkedMurders } = await import("./eclipse.mjs");
        await endMurder({ reason: "seasonReset", followUp: false });
        await clearBlackened();
        // A murder declared in the dark and never judged is an incident that
        // has not happened yet. It would open on the first Eclipse of the new
        // season, against a cast that has no idea what it is about.
        await clearParkedMurders();
    });

    await step("projects", async () => {
        const { clearAllProjects } = await import("./projects.mjs");
        await clearAllProjects();
    });

    await step("the Mastermind", async () => {
        const { clearMastermind } = await import("./mastermind.mjs");
        await clearMastermind();
    });

    await step("Despair Calls in force", async () => {
        const { clearSeals } = await import("./call-effects.mjs");
        await clearSeals();
    });

    await step("the module's chat and the messenger", async () => {
        await deleteMessages(moduleMessages().map(m => m.id));
    });

    // Separate step, and separate from the checkbox that authorised it: if the
    // module's own cards fail to clear, the rest of the log should still go
    // when it was asked for, and the other way round.
    if (alsoChat) {
        await step("the rest of the chat log", async () => {
            await deleteMessages(game.messages.map(m => m.id));
        });
    }

    await step("notes", async () => {
        for (const user of game.users) {
            if (user.getFlag(MODULE_ID, NOTE_FLAG)) {
                await user.setFlag(MODULE_ID, NOTE_FLAG, "");
            }
        }
        for (const actor of studentActors()) {
            const cleared = writtenNotes(actor);
            if (Object.keys(cleared).length) await actor.update(cleared);
        }
    });

    await step("what the cast is carrying", async () => {
        for (const actor of studentActors()) {
            const ids = seasonItems(actor).map(i => i.id);
            if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
        }
    });

    // The most irreversible thing here, and the reason the dialog names the
    // number of advances before the word is typed.
    await step("advancement", async () => {
        const { restoreStartingSheet } = await import("./character.mjs");
        for (const actor of studentActors()) {
            // Restore first, THEN re-initialise: `initCharacter` stamps the
            // starting sheet as it goes, and stamping before the restore would
            // record the advanced spread as the one to come back to.
            await restoreStartingSheet(actor);
            await initCharacter(actor, { quiet: true });
        }
    });

    await step("Despair pools", async () => {
        const { zeroAllDespair } = await import("./despair.mjs");
        await zeroAllDespair();
    });

    await step("locked doors", async () => {
        const { ROOM_FLAGS } = await import("./movement.mjs");
        const { startLocked } = await import("./vault.mjs");
        for (const scene of game.scenes) {
            // A room is a region with a name; the rest are shapes somebody drew.
            for (const region of Array.from(scene.regions ?? []).filter(r => r.name)) {
                const shouldBe = startLocked(region);
                if (Boolean(region.getFlag(MODULE_ID, ROOM_FLAGS.locked)) !== shouldBe) {
                    await region.setFlag(MODULE_ID, ROOM_FLAGS.locked, shouldBe);
                }
            }
        }
    });

    // World settings that hold nothing but this season's bookkeeping. The clock
    // is deliberately NOT among them — it is reset to the season's opening
    // reading below, campaign name kept, because the name belongs to the table.
    for (const [label, key, value] of [
        ["the trial floor", SETTINGS.trialQueue, {}],
        ["search tokens", SETTINGS.searchTokens, {}],
        ["Eclipse placements", SETTINGS.eclipseMoves, {}],
        ["the Key Remnant plan", SETTINGS.keyRemnantPlan, {}],
        ["discovered rooms", SETTINGS.discoveredRooms, {}],
        // Written directly rather than through `setMotive("")`, which announces
        // the withdrawal in chat. Nobody needs to be told a motive is over
        // during a reset that is also clearing the chat it would be posted in.
        ["the motive", SETTINGS.motive, {}],
        ["the trial's progress", SETTINGS.trialProgress, {}]
    ]) {
        await step(label, () => game.settings.set(MODULE_ID, key, value));
    }

    await step("the clock", async () => {
        const clock = getClock();
        await setClock({
            chapter: 1, day: 1, session: 1, timeOfDay: "morning",
            phase: "dailyLife", eclipse: false, pausedAt: null,
            timeOfDayStartedAt: Date.now(),
            // Kept: the season is new, the campaign is not.
            campaignName: clock.campaignName
        });
    });

    log(`Season reset. Cleared: ${done.join(", ")}.`);
    ui.notifications.info(game.i18n.localize("DRPG.Season.resetDone"));
    return { cleared: done };
}
