/**
 * Danganronpa RPG — actions as abilities.
 * ---------------------------------------------------------------------------
 * The guide's promise: "the player does not call the GM when performing
 * repeatable actions."
 *
 * Every action opens with a briefing of what it does, then either resolves
 * itself (Search, Work on Project, Sabotage, Dynamic) or whispers a ruling
 * request to the GM (Think, Listen, Analyze, Observe, Direct Murder, starting
 * a project) — because those are the ones the guide wants a human to judge.
 *
 * Movement is not here: crossing a room boundary charges itself, in
 * movement.mjs.
 */

import {
    MODULE_ID, FLAGS, ACTIONS, TRAITS, DYNAMIC_THRESHOLDS, INDIRECT_MURDER,
    OBSERVE_FAIL_STRESS, PROJECT_SCALE, ITEM_CATEGORIES, SABOTAGE_CONCEAL
} from "./config.mjs";
import { actionsLeft, spendAction, refundAction, hasFreeMove } from "./actions.mjs";
import { SearchTokens } from "./search-tokens.mjs";
import { drawItem } from "./tables.mjs";
import { roomOfActor, othersInRoom } from "./movement.mjs";
import { projectsAvailableIn, projectsElsewhere, addProgress, isIndirectMurder, scaleFor } from "./projects.mjs";
import { callGm, promptAndCallGm } from "./gm-bridge.mjs";
import { resolveThreshold, whisperToOwner, log, error } from "./utils.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/* ==========================================================================
 * ENTRY POINT
 * ========================================================================== */

/**
 * Run an action from the panel. Always starts with the briefing.
 *
 * @param {Actor} actor
 * @param {string} actionKey  A key from ACTIONS, or "dynamic".
 */
export async function performAction(actor, actionKey, options = {}) {
    try {
        if (!actor || actor.type !== "character") {
            ui.notifications.warn(game.i18n.localize("DRPG.Character.notACharacter"));
            return null;
        }

        const def = actionKey === "dynamic" ? dynamicDef() : ACTIONS[actionKey];
        if (!def) {
            ui.notifications.error(game.i18n.format("DRPG.Action.unknown", { key: actionKey }));
            return null;
        }

        if (!options.skipBriefing) {
            const go = await briefing(actor, actionKey, def);
            if (!go) return null;
        }

        switch (actionKey) {
            case "move": return null;                    // handled by the briefing
            case "dynamic": return performDynamic(actor, options);
            case "search": return performSearch(actor, def, options);
            case "project": return performProject(actor, def, options);
            case "sabotage": return performSabotage(actor, def, options);
            case "analyze": return performAnalyze(actor, def, options);
            case "rest": return performRest(actor);
            case "listen": return performListen(actor, def, options);
            case "observe": return performGmAction(actor, actionKey, def, options);
            case "directMurder": return performDirectMurder(actor, def, options);
            default: return performGeneric(actor, actionKey, def, options);
        }
    } catch (err) {
        error(`Action "${actionKey}" failed`, err);
        ui.notifications.error(game.i18n.localize("DRPG.Action.failed"));
        return null;
    }
}

/* ==========================================================================
 * BRIEFING
 * ========================================================================== */

/**
 * What this action does, before committing to it. Move only ever shows the
 * briefing — there is nothing to confirm, you just drag your token.
 */
async function briefing(actor, actionKey, def) {
    const room = roomOfActor(actor);
    const cost = def.cost ?? 1;

    const facts = [];
    if (actionKey === "move") {
        facts.push(hasFreeMove(actor)
            ? game.i18n.localize("DRPG.Move.freeAvailable")
            : game.i18n.format("DRPG.Move.freeSpent", { left: actionsLeft(actor) }));
    } else if (cost > 0) {
        facts.push(game.i18n.format("DRPG.Action.willCost", { n: cost, left: actionsLeft(actor) }));
    }

    if (def.traits?.length) {
        facts.push(game.i18n.format("DRPG.Action.usesTrait", {
            traits: def.traits.map(t => TRAITS[t]?.label ?? t).join(" / ")
        }));
    }

    facts.push(room
        ? game.i18n.format("DRPG.Action.youAreIn", { room: foundry.utils.escapeHTML(room) })
        : game.i18n.localize("DRPG.Action.noRoomNote"));

    if (def.callsGm) facts.push(game.i18n.localize("DRPG.Action.callsGmNote"));

    const instruction = def.instruction
        ? `<p class="drpg-briefing-instruction">${foundry.utils.escapeHTML(def.instruction)}</p>`
        : "";

    const buttons = actionKey === "move"
        ? [{ action: "ok", label: game.i18n.localize("DRPG.Action.gotIt"), default: true }]
        : [
            { action: "go", label: game.i18n.localize("DRPG.Action.proceed"), default: true },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ];

    const result = await DialogV2.wait({
        window: { title: def.label },
        classes: ["drpg-panel", "drpg-briefing"],
        content: `<div>
                    <p>${foundry.utils.escapeHTML(def.description ?? def.hint ?? "")}</p>
                    ${instruction}
                    <ul class="drpg-briefing-facts">${facts.map(f => `<li>${f}</li>`).join("")}</ul>
                  </div>`,
        buttons,
        rejectClose: false
    });

    return result === "go";
}

function dynamicDef() {
    return {
        label: game.i18n.localize("DRPG.Action.dynamicLabel"),
        icon: "fa-wand-magic-sparkles",
        cost: 1,
        traits: Object.keys(TRAITS),
        description: game.i18n.localize("DRPG.Action.dynamicDescription")
    };
}

/* ==========================================================================
 * ROLLING
 * ========================================================================== */

/**
 * Roll through the system so dice, skins and chat cards behave normally.
 *
 * Daggerheart's roll pipeline only *prepares* the resource changes a duality
 * roll causes — +1 Hope, -1 Stress on a critical, +1 Fear — and leaves them in
 * `result.resourceUpdates` for the caller to commit. The sheet's own trait
 * button calls `updateResources()`; ours has to as well, or actions roll dice
 * and quietly hand out nothing.
 */
async function rollTrait(actor, drpgTrait) {
    const dhTrait = TRAITS[drpgTrait]?.dh ?? drpgTrait;

    const { pendingCall, consumeCall } = await import("./call-effects.mjs");
    const armed = pendingCall(actor);

    // A Free Critical still throws the dice — it just decides in advance what
    // they will say. See forced-roll.mjs for why a real roll matters.
    const free = armed?.grants === "critical";
    if (free) {
        const { armMaximum } = await import("./forced-roll.mjs");
        armMaximum();
    }

    // Always open the configuration window.
    //
    // Daggerheart derives `dialog.configure` from `config.event`, reading
    // modifier keys off it. Called from our own code there is no event, so the
    // window was being skipped — actions rolled straight to chat with no chance
    // to use a Call. Both are supplied explicitly.
    let result;
    try {
        result = await actor.rollTrait(dhTrait, {
            event: { shiftKey: false, altKey: false, ctrlKey: false },
            dialog: { configure: true }
        });
    } finally {
        if (free) {
            const { disarmMaximum } = await import("./forced-roll.mjs");
            disarmMaximum();
        }
    }
    if (!result) return null;

    const roll = result.roll ?? result;
    const total = roll?.total ?? result?.total;
    if (typeof total !== "number") return null;

    await commitResources(result);
    // Whatever the Call bought, it bought it for this roll and no other.
    if (armed) await consumeCall(actor);

    const outcome = {
        total,
        ...dualityOf(roll),
        trait: drpgTrait,
        freeCritical: free,
        raw: result
    };

    if (free) {
        await whisperToOwner(actor, `<p><strong>${game.i18n.localize("DRPG.Calls.freeCritTitle")}</strong> — ${
            game.i18n.format("DRPG.Calls.freeCritUsed", { name: foundry.utils.escapeHTML(actor.name) })
        }</p>`);
    }

    await rememberRoll(actor, outcome, result);
    return outcome;
}

/**
 * Record what was just rolled, so the Reroll Hope Call has something to take
 * back. Only the newest roll is kept — the guide's Reroll undoes an action, not
 * a history.
 */
async function rememberRoll(actor, outcome, result) {
    try {
        const messageId = result?.message?.id ?? result?.message?._id ?? null;
        await actor.setFlag(MODULE_ID, FLAGS.lastAction, {
            messageId,
            trait: outcome.trait,
            total: outcome.total,
            withFear: outcome.withFear,
            isCritical: outcome.isCritical,
            at: game.time?.worldTime ?? 0
        });
    } catch {
        // Losing the bookmark costs a Reroll, not the roll itself.
    }
}

/** Attach the action's own context to the bookmark, once it is known. */
async function noteRollContext(actor, data) {
    try {
        const current = actor.getFlag(MODULE_ID, FLAGS.lastAction);
        if (!current) return;
        await actor.setFlag(MODULE_ID, FLAGS.lastAction, { ...current, ...data });
    } catch {
        // Same again: informational only.
    }
}

/**
 * Read Hope / Despair / critical off a finished roll.
 *
 * What `rollTrait` hands back is the roll *config*, not the Roll object, and the
 * config does not carry `withHope`/`withFear` — it records the same fact as
 * `result.duality`: 1 for Hope, -1 for Despair, 0 for a tie, which is a
 * critical. Reading the getters instead silently produced `false` for both, so
 * "with Despair" consequences — the sabotage reveal, the indirect-murder bonus —
 * could never fire. The dice are compared as a fallback for any other shape.
 */
export function dualityOf(roll) {
    const isCritical = Boolean(roll?.isCritical);
    const duality = roll?.result?.duality;

    if (typeof duality === "number") {
        return { isCritical: isCritical || duality === 0, withHope: duality === 1, withFear: duality === -1 };
    }

    const hope = roll?.hope?.value;
    const fear = roll?.fear?.value;
    if (typeof hope === "number" && typeof fear === "number") {
        return { isCritical: isCritical || hope === fear, withHope: hope > fear, withFear: hope < fear };
    }

    return {
        isCritical,
        withHope: Boolean(roll?.withHope),
        withFear: Boolean(roll?.withFear)
    };
}

/** Apply the Hope/Stress/Fear changes the roll produced, plus any costs. */
async function commitResources(result) {
    const updates = result?.resourceUpdates;
    if (!updates?.updateResources) return;

    try {
        const costs = (result.costs ?? [])
            .filter(c => c.enabled)
            .map(c => ({ ...c, value: -c.value }));
        if (costs.length) updates.addResources(costs);
        await updates.updateResources();
    } catch (err) {
        error("Could not apply the roll's resource changes", err);
    }
}

/** Ask which trait to use when the action allows a choice. */
async function chooseTrait(actor, def) {
    const allowed = def.traits ?? [];
    if (!allowed.length) return null;
    if (allowed.length === 1) return allowed[0];

    const options = allowed.map(key => {
        const t = TRAITS[key];
        const value = actor.system.traits?.[t.dh]?.value ?? 0;
        return `<option value="${key}">${t.label} (${value > 0 ? "+" : ""}${value})</option>`;
    }).join("");

    const picked = await DialogV2.wait({
        window: { title: game.i18n.format("DRPG.Action.chooseTrait", { action: def.label }) },
        content: `<form><label>${game.i18n.localize("DRPG.Advance.whichTrait")}
                    <select name="trait">${options}</select></label></form>`,
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Action.roll"), default: true,
                callback: (e, b, d) => d.element.querySelector("[name=trait]").value
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    return (picked && picked !== "cancel") ? picked : null;
}

/** Common guard: enough actions left? */
function canAfford(actor, cost) {
    if (cost <= 0 || actionsLeft(actor) >= cost) return true;
    ui.notifications.warn(game.i18n.format("DRPG.Actions.notEnough", {
        actor: actor.name, left: actionsLeft(actor), needed: cost
    }));
    return false;
}

/* ==========================================================================
 * SEARCH
 * ========================================================================== */

async function performSearch(actor, def, options) {
    const cost = options.free ? 0 : def.cost;
    if (!canAfford(actor, cost)) return null;

    const room = options.room ?? roomOfActor(actor);
    if (!room) {
        ui.notifications.warn(game.i18n.localize("DRPG.Action.noRoom"));
        return null;
    }

    const category = await chooseSearchCategory();
    if (!category) return null;

    if (!await SearchTokens.spend(room)) {
        ui.notifications.warn(game.i18n.localize("DRPG.SearchTokens.exhausted"));
        return null;
    }

    const trait = await chooseTrait(actor, def);
    if (!trait) return null;

    const roll = await rollTrait(actor, trait);
    if (!roll) return null;
    if (cost > 0) await spendAction(actor, cost);

    const hit = resolveThreshold(roll.total, def.thresholds);
    if (!hit && !roll.isCritical) {
        await report(actor, def, roll, { text: def.failure, room, tokensLeft: SearchTokens.left(room) });
        return { success: false };
    }

    const baseTier = hit?.tier ?? 0;
    const tier = roll.isCritical ? Math.min(3, baseTier + (def.critical?.tierBonus ?? 1)) : baseTier;
    const drawn = await drawItem(category, tier);

    // The item actually goes into the inventory, subject to the carry limits.
    let granted = null;
    if (drawn?.name) {
        const { grantItem } = await import("./inventory.mjs");
        granted = await grantItem(actor, { name: drawn.name, category, tier });
    }

    // Only murder and cleaning gear leaves a trace, per the guide.
    const leaves = category !== "usable";
    const visibility = roll.isCritical ? def.critical?.remnant : hit?.remnant;

    if (leaves && visibility) {
        const { dropRemnant } = await import("./remnants.mjs");
        const catLabel = ITEM_CATEGORIES[category]?.label ?? category;
        await dropRemnant(actor, {
            type: "prep",
            visibility,
            faint: true,
            action: "search",
            subject: drawn?.name ?? "",
            note: game.i18n.format("DRPG.Remnant.searchNote", {
                actor: actor.name,
                room: room ?? "?",
                category: catLabel,
                item: drawn?.name ?? "?",
                tier,
                total: roll.total
            })
        });
    }

    const outcome = {
        success: true, tier, category,
        item: drawn?.name ?? null,
        carried: Boolean(granted),
        remnant: leaves ? visibility : null,
        room, tokensLeft: SearchTokens.left(room)
    };

    await report(actor, def, roll, outcome);
    Hooks.callAll("drpgActionResolved", { actor, actionKey: "search", roll, outcome });
    return outcome;
}

async function chooseSearchCategory() {
    const picked = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Action.searchGoalTitle") },
        content: `<p>${game.i18n.localize("DRPG.Action.searchGoalHint")}</p>`,
        buttons: [
            { action: "usable", label: game.i18n.localize("DRPG.Action.goalUsable"), default: true },
            { action: "crimeTool", label: game.i18n.localize("DRPG.Action.goalCrime") },
            { action: "cleaningTool", label: game.i18n.localize("DRPG.Action.goalCleaning") },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });
    return (picked && picked !== "cancel") ? picked : null;
}

/* ==========================================================================
 * PROJECTS
 * ========================================================================== */

/** Start something new (GM ruling) or push an existing project (automatic). */
async function performProject(actor, def, options) {
    const choice = await DialogV2.wait({
        window: { title: def.label },
        content: `<p>${game.i18n.localize("DRPG.Project.choosePrompt")}</p>`,
        buttons: [
            { action: "work", label: game.i18n.localize("DRPG.Project.workOn"), default: true },
            { action: "start", label: game.i18n.localize("DRPG.Project.startNew") },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!choice || choice === "cancel") return null;

    if (choice === "start") return startProject(actor);
    return workOnProject(actor, def, options);
}

/**
 * Start a project without waiting for the GM.
 *
 * The guide has projects agreed with the GM beforehand, so the dialog says so
 * plainly rather than pretending otherwise — but it then creates the project,
 * because making the player wait mid-turn for a rubber stamp they already have
 * is exactly the friction the guide asks us to remove. The GM is told what was
 * created and can adjust or delete it.
 */
async function startProject(actor) {
    const { allRooms } = await import("./movement.mjs");
    const room = roomOfActor(actor);
    const rooms = allRooms();

    const scaleOptions = Object.entries(PROJECT_SCALE)
        .map(([key, s]) => `<option value="${s.progress}"${key === "everyday" ? " selected" : ""}>${s.label} — ${s.progress} progress</option>`)
        .join("");
    const roomOptions = [
        `<option value="">${game.i18n.localize("DRPG.Project.anyRoom")}</option>`,
        ...rooms.map(r => `<option value="${foundry.utils.escapeHTML(r)}"${r === room ? " selected" : ""}>${foundry.utils.escapeHTML(r)}</option>`)
    ].join("");

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Project.startNew") },
        classes: ["drpg-panel"],
        content: `<form>
            <p class="drpg-warning">${game.i18n.localize("DRPG.Project.agreedWarning")}</p>
            <label>${game.i18n.localize("DRPG.Project.name")}
                <input type="text" name="name" placeholder="${game.i18n.localize("DRPG.Project.namePlaceholder")}" autofocus /></label>
            <label>${game.i18n.localize("DRPG.Project.scale")}
                <select name="target">${scaleOptions}</select></label>
            <label>${game.i18n.localize("DRPG.Project.room")}
                <select name="room">${roomOptions}</select></label>
            <label>${game.i18n.localize("DRPG.Project.trait")}
                <select name="trait">
                    <option value="">${game.i18n.localize("DRPG.Project.anyTrait")}</option>
                    ${Object.entries(TRAITS).map(([k, t]) => `<option value="${k}">${t.label}</option>`).join("")}
                </select></label>
            <label class="drpg-checkbox">
                <input type="checkbox" name="murder" /> ${game.i18n.localize("DRPG.Project.indirectMine")}</label>
            <p class="notes">${game.i18n.localize("DRPG.Project.startNote")}</p>
        </form>`,
        buttons: [
            {
                action: "create",
                label: game.i18n.localize("DRPG.Project.createButton"),
                default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return {
                        name: f.name.value.trim(),
                        target: Number(f.target.value) || 4,
                        room: f.room.value || null,
                        trait: f.trait.value || null,
                        murder: f.murder.checked
                    };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return null;
    if (!result.name) {
        ui.notifications.warn(game.i18n.localize("DRPG.Project.needsName"));
        return null;
    }

    // Creating a countdown writes a world setting, so a player's request is
    // applied by the GM. An indirect murder is secret to everyone but them.
    const { requestProjectCreate } = await import("./gm-bridge.mjs");
    const owner = game.users.find(u => !u.isGM && actor.testUserPermission(u, "OWNER"));

    await requestProjectCreate({
        name: result.name,
        target: result.target,
        room: result.room,
        trait: result.trait,
        indirectMurder: result.murder,
        secret: result.murder,
        viewers: owner ? [owner.id] : [],
        by: actor.name
    });

    await whisperToOwner(actor, `<p><strong>${game.i18n.localize("DRPG.Project.startNew")}</strong> — ${
        game.i18n.format("DRPG.Project.startedOk", { name: foundry.utils.escapeHTML(result.name) })
    }</p>`);

    return { created: true, name: result.name };
}

async function workOnProject(actor, def, options) {
    const cost = options.free ? 0 : def.cost;
    if (!canAfford(actor, cost)) return null;

    const room = roomOfActor(actor);
    const project = await chooseProject(room, "DRPG.Project.whichWork");
    if (!project) return null;

    // The GM fixes which kind of work a project demands. Only fall back to
    // asking when they left it open.
    const trait = project.trait ?? await chooseTrait(actor, def);
    if (!trait) return null;
    if (project.trait) {
        ui.notifications.info(game.i18n.format("DRPG.Project.traitFixed", {
            trait: TRAITS[project.trait]?.label ?? project.trait
        }));
    }

    const indirect = isIndirectMurder(project.id);
    const witnesses = othersInRoom(actor);
    const lines = [];
    let bonus = 0;

    // Guide: with someone else in the room, the killer must hide their intent
    // first; alone, the project simply gains +1 progress.
    if (indirect) {
        if (witnesses.length) {
            const conceal = await rollTrait(actor, INDIRECT_MURDER.concealIntent.trait);
            if (!conceal) return null;
            const ok = conceal.isCritical || conceal.total >= INDIRECT_MURDER.concealIntent.threshold;
            lines.push(`<p><strong>${INDIRECT_MURDER.concealIntent.label}</strong> — ${conceal.total}: ${
                ok ? (conceal.withFear
                        ? INDIRECT_MURDER.concealIntent.successWithDespair
                        : INDIRECT_MURDER.concealIntent.success)
                   : INDIRECT_MURDER.concealIntent.failure
            }</p>`);
            if (ok && conceal.withFear) bonus += 1;
        } else {
            bonus += INDIRECT_MURDER.concealIntent.aloneBonus;
            lines.push(`<p><em>${game.i18n.localize("DRPG.Project.aloneBonus")}</em></p>`);
        }
    }

    const roll = await rollTrait(actor, trait);
    if (!roll) return null;
    if (cost > 0) await spendAction(actor, cost);

    const hit = roll.isCritical ? def.critical : resolveThreshold(roll.total, def.thresholds);
    const progress = (hit?.progress ?? 0) + (hit?.progress ? bonus : 0);

    let applied = null;
    if (progress > 0) applied = await addProgress(project.id, progress);

    // Reroll needs to know what this roll gave the project, so it can take the
    // same amount back before applying the new result.
    await noteRollContext(actor, {
        actionKey: "project", projectId: project.id, progress
    });

    // Guide: every project action also rolls to hide the traces it leaves.
    let traceRemnant = null;
    if (indirect) {
        const trace = await rollTrait(actor, INDIRECT_MURDER.hideTraces.trait);
        if (trace) {
            const band = trace.isCritical
                ? INDIRECT_MURDER.hideTraces.critical
                : resolveThreshold(trace.total, INDIRECT_MURDER.hideTraces.thresholds);
            traceRemnant = band?.remnant ?? "obvious";
            lines.push(`<p><strong>${INDIRECT_MURDER.hideTraces.label}</strong> — ${trace.total}: ${
                game.i18n.format("DRPG.Action.leavesRemnant", { visibility: traceRemnant })
            }</p>`);

            const { dropRemnant } = await import("./remnants.mjs");
            await dropRemnant(actor, {
                type: "prep",
                visibility: traceRemnant,
                faint: true,
                action: "project",
                subject: project.name,
                note: game.i18n.format("DRPG.Remnant.projectNote", {
                    actor: actor.name,
                    project: project.name,
                    room: roomOfActor(actor) ?? "?",
                    progress,
                    total: trace.total
                })
            });
        }
    }

    const outcome = {
        success: progress > 0,
        progress,
        project: project.name,
        applied,
        refundAction: Boolean(hit?.refundAction),
        remnant: traceRemnant,
        extra: lines.join(""),
        text: progress > 0
            ? game.i18n.format("DRPG.Action.progressOn", { n: progress, project: project.name })
            : def.failure
    };

    await report(actor, def, roll, outcome);
    Hooks.callAll("drpgActionResolved", { actor, actionKey: "project", roll, outcome });
    return outcome;
}

/** Pick from an explicit list of projects. */
async function chooseFrom(list, promptKey) {
    const options = list.map(p => {
        const target = p.start ? ` — ${p.current}/${p.start}` : "";
        const where = p.room ? ` · ${p.room}` : "";
        return `<option value="${p.id}">${foundry.utils.escapeHTML(p.name)}${target}${where}</option>`;
    }).join("");

    const id = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Project.title") },
        classes: ["drpg-panel"],
        content: `<form><label>${game.i18n.localize(promptKey)}
                    <select name="project">${options}</select></label></form>`,
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Action.proceed"), default: true,
                callback: (e, b, d) => d.element.querySelector("[name=project]").value
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!id || id === "cancel") return null;
    return list.find(p => p.id === id) ?? null;
}

/** Pick a project to work on, limited to those in this room and not frozen. */
async function chooseProject(room, promptKey) {
    const here = projectsAvailableIn(room);

    if (!here.length) {
        const elsewhere = projectsElsewhere(room);
        ui.notifications.warn(elsewhere.length
            ? game.i18n.format("DRPG.Project.wrongRoom", {
                room: room ?? "—",
                names: elsewhere.map(p => `${p.name} (${p.room})`).join(", ")
              })
            : game.i18n.localize("DRPG.Project.none"));
        return null;
    }

    const options = here.map(p => {
        const target = p.start ? ` — ${p.current}/${p.start}${scaleFor(p.start) ? `, ${scaleFor(p.start)}` : ""}` : "";
        const where = p.room ? ` · ${p.room}` : "";
        return `<option value="${p.id}">${foundry.utils.escapeHTML(p.name)}${target}${where}</option>`;
    }).join("");

    const id = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Project.title") },
        content: `<form><label>${game.i18n.localize(promptKey)}
                    <select name="project">${options}</select></label></form>`,
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Action.proceed"), default: true,
                callback: (e, b, d) => d.element.querySelector("[name=project]").value
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!id || id === "cancel") return null;
    return here.find(p => p.id === id) ?? null;
}

/* ==========================================================================
 * SABOTAGE
 * ========================================================================== */

async function performSabotage(actor, def, options) {
    const cost = options.free ? 0 : def.cost;
    if (!canAfford(actor, cost)) return null;

    const room = roomOfActor(actor);
    const { sabotageTargetsIn, sabotageProject } = await import("./projects.mjs");

    const targets = sabotageTargetsIn(room);
    if (!targets.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Project.nothingToSabotage"));
        return null;
    }

    const project = await chooseFrom(targets, "DRPG.Project.whichSabotage");
    if (!project) return null;

    // Breaking a thing takes the same kind of work as building it, so sabotage
    // uses the project's own trait. The player does not get to pick an easier
    // one than the people who built it had to use.
    const trait = project.trait ?? await chooseTrait(actor, def);
    if (!trait) return null;
    if (project.trait) {
        ui.notifications.info(game.i18n.format("DRPG.Project.traitFixed", {
            trait: TRAITS[project.trait]?.label ?? project.trait
        }));
    }

    // Someone is watching. Cover what you are doing before you do it, exactly
    // as an indirect murder covers its intent — and learn the answer while
    // there is still time to walk away.
    const witnesses = othersInRoom(actor);
    const lines = [];
    let penalty = 0;

    if (witnesses.length) {
        const conceal = await rollTrait(actor, SABOTAGE_CONCEAL.trait);
        if (!conceal) return null;

        const hidden = conceal.isCritical || conceal.total >= SABOTAGE_CONCEAL.threshold;
        if (hidden && conceal.withFear) penalty = SABOTAGE_CONCEAL.despairPenalty;

        lines.push(`<p><strong>${SABOTAGE_CONCEAL.label}</strong> — ${conceal.total}: ${
            hidden
                ? (conceal.withFear ? SABOTAGE_CONCEAL.successWithDespair : SABOTAGE_CONCEAL.success)
                : SABOTAGE_CONCEAL.failure
        }</p>`);

        // A failure is public: the room saw enough to describe it.
        if (!hidden) {
            await ChatMessage.create({
                content: `<p><em>${game.i18n.format("DRPG.Action.sabotageWatched", {
                    actor: foundry.utils.escapeHTML(actor.name),
                    room: foundry.utils.escapeHTML(room ?? "—"),
                    project: foundry.utils.escapeHTML(project.name)
                })}</em></p>`
            });

            const carryOn = await DialogV2.confirm({
                window: { title: def.label },
                content: `<p>${SABOTAGE_CONCEAL.failure}</p>
                          <p>${game.i18n.localize("DRPG.Action.sabotageCarryOn")}</p>`,
                rejectClose: false
            });
            if (!carryOn) return { aborted: true, seen: true };
        }
    } else {
        lines.push(`<p><em>${SABOTAGE_CONCEAL.aloneNote}</em></p>`);
    }

    const roll = await rollTrait(actor, trait);
    if (!roll) return null;
    if (cost > 0) await spendAction(actor, cost);

    const score = roll.total + penalty;
    const hit = roll.isCritical ? def.critical : resolveThreshold(score, def.thresholds);
    const success = Boolean(hit);

    // A successful sabotage freezes the project and spawns its repair. The
    // better the roll, the harder the repair — the guide scales it from
    // "simple" to "hidden-difficulty".
    let repair = null;
    if (success) {
        const difficulty = roll.isCritical ? 8 : score >= 18 ? 6 : 4;
        repair = await sabotageProject(project.id, difficulty);
    }

    // Sabotage always leaves a trace, success or not.
    const visibility = success ? hit.remnant : def.failureRemnant;
    const { dropRemnant } = await import("./remnants.mjs");
    await dropRemnant(actor, {
        type: "prep",
        visibility,
        faint: true,
        action: "sabotage",
        subject: project.name,
        note: game.i18n.format("DRPG.Remnant.sabotageNote", {
            actor: actor.name,
            project: project.name,
            room: room ?? "?",
            total: roll.total,
            outcome: success
                ? game.i18n.format("DRPG.Remnant.sabotageWorked", { repair: repair?.repair?.name ?? "?" })
                : game.i18n.localize("DRPG.Remnant.sabotageFailed")
        })
    });

    const outcome = {
        success,
        project: project.name,
        remnant: visibility,
        extra: lines.join(""),
        // Despair reveals the attempt to anyone else in the room.
        revealed: roll.withFear && witnesses.length > 0,
        text: success
            ? `${hit.result} — ${game.i18n.format("DRPG.Project.frozenNow", {
                  name: project.name,
                  repair: repair?.repair?.name ?? game.i18n.format("DRPG.Project.repairName", { name: project.name })
              })}`
            : def.failure
    };

    if (outcome.revealed) {
        await ChatMessage.create({
            content: `<p><em>${game.i18n.format("DRPG.Action.sabotageSeen", {
                actor: foundry.utils.escapeHTML(actor.name),
                room: foundry.utils.escapeHTML(room ?? "—")
            })}</em></p>`
        });
    }

    await report(actor, def, roll, outcome);
    Hooks.callAll("drpgActionResolved", { actor, actionKey: "sabotage", roll, outcome });
    return outcome;
}

/* ==========================================================================
 * ACTIONS THAT NEED A HUMAN
 * ========================================================================== */

/** Think, Listen, Analyze, Observe: roll, then hand the result to the GM. */
async function performGmAction(actor, actionKey, def, options) {
    const cost = options.free ? 0 : def.cost;
    if (!canAfford(actor, cost)) return null;

    const trait = await chooseTrait(actor, def);
    if (!trait) return null;

    const roll = await rollTrait(actor, trait);
    if (!roll) return null;
    if (cost > 0) await spendAction(actor, cost);

    const body = buildGmBody(actionKey, def, roll);

    await promptAndCallGm(actor, {
        title: def.label,
        prompt: game.i18n.format("DRPG.Action.gmPrompt", { action: def.label }),
        placeholder: game.i18n.localize(`DRPG.Action.placeholder.${actionKey}`),
        roll,
        room: roomOfActor(actor)
    });

    await whisperToOwner(actor, `<p><strong>${def.label}</strong> — ${roll.total}${
        roll.isCritical ? ` · <em>${game.i18n.localize("DRPG.Action.critical")}</em>` : ""
    }</p>${body}`);

    return { calledGm: true, roll };
}

/** The reference the GM needs to rule, right next to the roll. */
function buildGmBody(actionKey, def, roll) {
    if (def.thresholds?.length) {
        const rows = def.thresholds.map(t =>
            `<li>${t.min}+ — ${foundry.utils.escapeHTML(t.result ?? "")}</li>`).join("");
        const crit = def.critical?.result
            ? `<li><em>${game.i18n.localize("DRPG.Action.critical")} — ${foundry.utils.escapeHTML(def.critical.result)}</em></li>`
            : "";
        return `<ul class="drpg-gm-reference">${rows}${crit}</ul>`;
    }

    if (actionKey === "observe") {
        return `<p><small>${game.i18n.format("DRPG.Action.observeGm", { total: roll.total })}</small></p>`;
    }
    if (actionKey === "analyze") {
        return `<p><small>${game.i18n.localize("DRPG.Action.analyzeGm")}</small></p>`;
    }
    return "";
}

/**
 * Analyze: one action, two uses. Either identify a Neutral Truth Bullet, or
 * just ask the GM for a nudge. Both are Head rolls that end in a ruling.
 */
async function performAnalyze(actor, def, options) {
    const cost = options.free ? 0 : def.cost;
    if (!canAfford(actor, cost)) return null;

    const { itemsInCategory } = await import("./inventory.mjs");
    const bullets = itemsInCategory(actor, "truthBullet");

    const buttons = [
        { action: "hint", label: game.i18n.localize("DRPG.Analyze.askHint"), default: !bullets.length },
        { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
    ];
    if (bullets.length) {
        buttons.unshift({ action: "bullet", label: game.i18n.localize("DRPG.Analyze.analyseBullet"), default: true });
    }

    const choice = await DialogV2.wait({
        window: { title: def.label },
        classes: ["drpg-panel"],
        content: `<p>${game.i18n.localize("DRPG.Analyze.prompt")}</p>${
            bullets.length ? "" : `<p class="notes">${game.i18n.localize("DRPG.Analyze.noBullets")}</p>`
        }`,
        buttons,
        rejectClose: false
    });

    if (!choice || choice === "cancel") return null;

    let subject = null;
    if (choice === "bullet") {
        const options = bullets
            .map(b => `<option value="${b.id}">${foundry.utils.escapeHTML(b.name)}</option>`).join("");
        const id = await DialogV2.wait({
            window: { title: game.i18n.localize("DRPG.Analyze.analyseBullet") },
            content: `<form><label>${game.i18n.localize("DRPG.Analyze.whichBullet")}
                        <select name="bullet">${options}</select></label></form>`,
            buttons: [
                {
                    action: "ok", label: game.i18n.localize("DRPG.Action.roll"), default: true,
                    callback: (e, b, d) => d.element.querySelector("[name=bullet]").value
                },
                { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
            ],
            rejectClose: false
        });
        if (!id || id === "cancel") return null;
        subject = bullets.find(b => b.id === id) ?? null;
    }

    const roll = await rollTrait(actor, "head");
    if (!roll) return null;
    if (cost > 0) await spendAction(actor, cost);

    // A hint has its own thresholds; analysis is judged against the DC table.
    let body;
    if (choice === "hint") {
        const rows = def.hintThresholds.map(t =>
            `<li>${t.min}+ — ${foundry.utils.escapeHTML(t.result)}</li>`).join("");
        body = `<ul class="drpg-gm-reference">${rows}
                <li><em>${game.i18n.localize("DRPG.Action.critical")} — ${foundry.utils.escapeHTML(def.hintCritical.result)}</em></li></ul>`;
    } else {
        body = `<p><small>${game.i18n.localize("DRPG.Action.analyzeGm")}</small></p>`;
    }

    await promptAndCallGm(actor, {
        title: subject
            ? game.i18n.format("DRPG.Analyze.onBullet", { name: subject.name })
            : game.i18n.localize("DRPG.Analyze.askHint"),
        prompt: game.i18n.format("DRPG.Action.gmPrompt", { action: def.label }),
        placeholder: game.i18n.localize("DRPG.Action.placeholder.analyze"),
        roll,
        room: roomOfActor(actor)
    });

    await whisperToOwner(actor, `<p><strong>${def.label}</strong> — ${roll.total}${
        roll.isCritical ? ` · <em>${game.i18n.localize("DRPG.Action.critical")}</em>` : ""
    }</p>${body}`);

    return { calledGm: true, roll, subject: subject?.name ?? null };
}

/**
 * Listen — fully automatic, no GM.
 *
 * The guide's three outcomes map onto three amounts of information:
 *   pass      you learn how many people are in the chosen room, not who
 *   strong    you learn who they are
 *   critical  every neighbouring room at once
 *
 * The anonymous tier matters: "someone is in the kitchen" is a very different
 * piece of information from "Kaede is in the kitchen", and the guide draws that
 * line deliberately.
 */
async function performListen(actor, def, options) {
    const cost = options.free ? 0 : def.cost;
    if (!canAfford(actor, cost)) return null;

    const { neighbouringRooms, occupantsOf } = await import("./movement.mjs");
    const here = roomOfActor(actor);
    const neighbours = neighbouringRooms(here);

    if (!neighbours.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Listen.noNeighbours"));
        return null;
    }

    const options_ = neighbours
        .map(r => `<option value="${foundry.utils.escapeHTML(r)}">${foundry.utils.escapeHTML(r)}</option>`)
        .join("");

    const target = await DialogV2.wait({
        window: { title: def.label },
        classes: ["drpg-panel"],
        content: `<form>
            <p>${game.i18n.format("DRPG.Listen.prompt", { room: foundry.utils.escapeHTML(here ?? "—") })}</p>
            <label>${game.i18n.localize("DRPG.Listen.which")}
                <select name="room">${options_}</select></label>
        </form>`,
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Action.roll"), default: true,
                callback: (e, b, d) => d.element.querySelector("[name=room]").value
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!target || target === "cancel") return null;

    const roll = await rollTrait(actor, "shadow");
    if (!roll) return null;
    if (cost > 0) await spendAction(actor, cost);

    const hit = resolveThreshold(roll.total, def.thresholds);
    const lines = [];
    let outcome;

    if (roll.isCritical) {
        // Everything, everywhere.
        const sweep = neighbours.map(room => {
            const who = occupantsOf(room, actor).map(a => a.name);
            return `<li><strong>${foundry.utils.escapeHTML(room)}</strong> — ${
                who.length ? who.map(n => foundry.utils.escapeHTML(n)).join(", ") : game.i18n.localize("DRPG.Listen.empty")
            }</li>`;
        }).join("");
        lines.push(`<p>${game.i18n.localize("DRPG.Listen.critical")}</p><ul>${sweep}</ul>`);
        outcome = { success: true, isCritical: true, rooms: neighbours };
    } else if (hit?.min >= 18) {
        // Named.
        const who = occupantsOf(target, actor).map(a => a.name);
        lines.push(`<p>${game.i18n.format("DRPG.Listen.named", {
            room: foundry.utils.escapeHTML(target),
            who: who.length ? who.map(n => foundry.utils.escapeHTML(n)).join(", ") : game.i18n.localize("DRPG.Listen.empty")
        })}</p>`);
        outcome = { success: true, room: target, named: who };
    } else if (hit) {
        // Anonymous: a count, no identities.
        const count = occupantsOf(target, actor).length;
        lines.push(`<p>${count
            ? game.i18n.format("DRPG.Listen.anonymous", { room: foundry.utils.escapeHTML(target), n: count })
            : game.i18n.format("DRPG.Listen.emptyRoom", { room: foundry.utils.escapeHTML(target) })
        }</p>`);
        outcome = { success: true, room: target, count };
    } else {
        lines.push(`<p>${def.failure}</p>`);
        outcome = { success: false };
    }

    await whisperToOwner(actor, `<p><strong>${def.label}</strong> · Shadow · <strong>${roll.total}</strong>${
        roll.isCritical ? ` · <em>${game.i18n.localize("DRPG.Action.critical")}</em>` : ""
    }</p>${lines.join("")}`);

    Hooks.callAll("drpgActionResolved", { actor, actionKey: "listen", roll, outcome });
    return outcome;
}

/**
 * Rest: pick short or long. Each option shows its cost and whether the room
 * you are standing in actually allows it, so the choice is informed.
 */
async function performRest(actor) {
    const { takeRest, roomAllows, restRooms } = await import("./rest.mjs");
    const room = roomOfActor(actor);

    const line = kind => {
        const allowed = roomAllows(room, kind);
        const rooms = restRooms(kind);
        return `<li><strong>${game.i18n.localize(kind === "long" ? "DRPG.Rest.long" : "DRPG.Rest.short")}</strong> — ${
            game.i18n.format("DRPG.Action.willCost", { n: kind === "long" ? 2 : 1, left: actionsLeft(actor) })
        }<br>${allowed
            ? `<em>${game.i18n.format("DRPG.Rest.allowedHere", { room: foundry.utils.escapeHTML(room) })}</em>`
            : `<em>${rooms.length
                ? game.i18n.format("DRPG.Rest.allowedIn", { rooms: foundry.utils.escapeHTML(rooms.join(", ")) })
                : game.i18n.format("DRPG.Rest.noRooms", { kind: "" })}</em>`
        }</li>`;
    };

    const choice = await DialogV2.wait({
        window: { title: ACTIONS.rest.label },
        classes: ["drpg-panel", "drpg-rest"],
        content: `<ul class="drpg-briefing-facts">${line("short")}${line("long")}</ul>`,
        buttons: [
            { action: "short", label: game.i18n.localize("DRPG.Rest.short"), default: true },
            { action: "long", label: game.i18n.localize("DRPG.Rest.long") },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!choice || choice === "cancel") return null;
    return takeRest(actor, choice);
}

/** Direct Murder: never automatic, always a conversation. */
async function performDirectMurder(actor, def, options) {
    const cost = options.free ? 0 : def.cost;
    if (!canAfford(actor, cost)) return null;

    const confirmed = await DialogV2.confirm({
        window: { title: def.label },
        content: `<p>${game.i18n.localize("DRPG.Action.murderConfirm")}</p>`,
        rejectClose: false
    });
    if (!confirmed) return null;

    if (cost > 0) await spendAction(actor, cost);

    await promptAndCallGm(actor, {
        title: def.label,
        prompt: game.i18n.localize("DRPG.Action.murderPrompt"),
        placeholder: game.i18n.localize("DRPG.Action.placeholder.directMurder"),
        room: roomOfActor(actor)
    });

    return { calledGm: true };
}

/* ==========================================================================
 * GENERIC + DYNAMIC
 * ========================================================================== */

async function performGeneric(actor, actionKey, def, options) {
    const cost = options.free ? 0 : (def.cost ?? 1);
    if (!canAfford(actor, cost)) return null;

    const trait = await chooseTrait(actor, def);
    if (!trait) return null;

    const roll = await rollTrait(actor, trait);
    if (!roll) return null;
    if (cost > 0) await spendAction(actor, cost);

    const hit = roll.isCritical ? def.critical : resolveThreshold(roll.total, def.thresholds ?? []);
    const outcome = {
        success: Boolean(hit),
        text: hit?.result ?? def.failure ?? game.i18n.localize("DRPG.Action.nothing"),
        remnant: hit?.remnant ?? null
    };

    await report(actor, def, roll, outcome);
    Hooks.callAll("drpgActionResolved", { actor, actionKey, roll, outcome });
    return outcome;
}

async function performDynamic(actor, options) {
    const def = dynamicDef();
    if (!canAfford(actor, options.free ? 0 : 1)) return null;

    // Describe it FIRST. The GM cannot set a sensible difficulty for something
    // they have not heard yet, and asking the player to pick a threshold before
    // saying what they are doing is backwards.
    const description = await promptAndCallGm(actor, {
        title: game.i18n.localize("DRPG.Action.dynamicLabel"),
        prompt: game.i18n.localize("DRPG.Action.dynamicDescribe"),
        placeholder: game.i18n.localize("DRPG.Action.dynamicPlaceholder"),
        room: roomOfActor(actor)
    });
    if (description === null) return null;

    const rows = DYNAMIC_THRESHOLDS.map((t, i) =>
        `<option value="${i}">${t.range[0]}–${t.range[1]} · ${t.difficulty}</option>`).join("");

    const picked = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Action.dynamicTitle") },
        classes: ["drpg-panel"],
        content: `<form>
                    <p>${game.i18n.localize("DRPG.Action.dynamicSetBy")}</p>
                    <blockquote>${foundry.utils.escapeHTML(description)}</blockquote>
                    <label>${game.i18n.localize("DRPG.Action.difficulty")}
                        <select name="tier">${rows}</select></label>
                    <label>${game.i18n.localize("DRPG.Advance.whichTrait")}
                        <select name="trait">${Object.entries(TRAITS)
                            .map(([k, t]) => `<option value="${k}">${t.label}</option>`).join("")}</select></label>
                  </form>`,
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Action.roll"), default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return { tier: Number(f.tier.value), trait: f.trait.value };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!picked || picked === "cancel") return null;

    const band = DYNAMIC_THRESHOLDS[picked.tier];
    const roll = await rollTrait(actor, picked.trait);
    if (!roll) return null;
    if (!options.free) await spendAction(actor, 1);

    const success = roll.isCritical || roll.total >= band.range[0];
    const outcome = {
        success,
        tier: success ? band.tier : null,
        remnant: success ? band.remnant : null,
        text: success ? game.i18n.format("DRPG.Action.tierFound", { tier: band.tier })
                      : game.i18n.localize("DRPG.Action.nothing")
    };

    await report(actor, def, roll, outcome);
    Hooks.callAll("drpgActionResolved", { actor, actionKey: "dynamic", roll, outcome });
    return outcome;
}

/* ==========================================================================
 * REPORTING
 * ========================================================================== */

async function report(actor, def, roll, outcome) {
    if (!outcome) return;

    const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
    const traitLabel = TRAITS[roll?.trait]?.label ?? "";
    const lines = [];

    lines.push(`<p><strong>${esc(def.label)}</strong>${traitLabel ? ` · ${traitLabel}` : ""} · <strong>${roll?.total ?? "—"}</strong>${
        roll?.isCritical ? ` · <em>${game.i18n.localize("DRPG.Action.critical")}</em>` : ""
    }</p>`);

    if (outcome.extra) lines.push(outcome.extra);

    if (outcome.item) {
        lines.push(`<p>${game.i18n.format("DRPG.Action.found", { tier: outcome.tier, item: esc(outcome.item) })}${
            outcome.carried === false ? ` <em>${game.i18n.localize("DRPG.Inventory.notCarried")}</em>` : ""
        }</p>`);
    } else if (outcome.text) {
        lines.push(`<p>${esc(outcome.text)}</p>`);
    }

    // Only a GM's own write knows the resulting numbers. A player's is applied
    // over the socket and answered by a separate whisper, so printing "now ?/?"
    // here would be inventing a figure.
    if (outcome.applied?.changed === true) {
        lines.push(`<p><small>${game.i18n.format("DRPG.Project.now", {
            project: esc(outcome.applied.name), current: outcome.applied.to, target: outcome.applied.target
        })}</small></p>`);
    } else if (outcome.applied?.changed === false) {
        lines.push(`<p><small>${game.i18n.format("DRPG.Project.alreadyFull", {
            name: esc(outcome.applied.name), current: outcome.applied.from, target: outcome.applied.target
        })}</small></p>`);
    }

    if (outcome.remnant) {
        lines.push(`<p><em>${game.i18n.format("DRPG.Action.leavesRemnant", { visibility: outcome.remnant })}</em></p>`);
    }

    if (outcome.room) {
        lines.push(`<p><small>${game.i18n.format("DRPG.Action.tokensLeft", {
            room: esc(outcome.room), n: outcome.tokensLeft
        })}</small></p>`);
    }

    if (outcome.refundAction) {
        await refundAction(actor, 1);
        lines.push(`<p><em>${game.i18n.localize("DRPG.Action.actionReturned")}</em></p>`);
    }

    await whisperToOwner(actor, lines.join(""));
    log(`${actor.name}: ${def.label} = ${roll?.total}`);
}

/** Re-exported so other modules keep a single source for "where am I". */
export { roomOfActor as currentRoom };
