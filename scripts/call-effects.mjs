/**
 * Danganronpa RPG — making Calls actually happen.
 * ---------------------------------------------------------------------------
 * A Call that only deducts a resource and prints a sentence is a receipt, not a
 * rule. These apply the effect:
 *
 *   · effects that land now      — damage, stress, project progress, sealed rooms
 *   · effects that arm the dice  — advantage, experiences, a free critical
 *
 * The second kind is stored as a *pending call* on the character. The roll
 * dialog keeps those controls disabled until one is armed, which is what makes
 * them Calls rather than free checkboxes — see roll-dialog.mjs.
 */

import { MODULE_ID, FLAGS, HOPE_CALLS, DESPAIR_CALLS } from "./config.mjs";
import { automatedUpdate } from "./resource-guard.mjs";
import { resourceValue, resourceMax } from "./character.mjs";
import { log, error } from "./utils.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/* ==========================================================================
 * PENDING CALLS
 * ========================================================================== */

/** The Call currently armed on this character, if any. */
export function pendingCall(actor) {
    return actor?.getFlag?.(MODULE_ID, FLAGS.pendingCall) ?? null;
}

/**
 * Arm a Call so the next roll can use what it bought.
 *
 * Support and For the Game arm someone *else*, and a player has no write access
 * to another player's actor — the flag write throws "lacks permission". Those go
 * through the GM, who does have it. The Monokuma side never needs the detour:
 * a GM can write to anyone.
 */
export async function armCall(actor, { key, kind, grants, from = null }) {
    if (!actor || !grants) return null;

    const payload = { key, kind, grants, from };

    if (!actor.isOwner) {
        const { requestArmCall } = await import("./gm-bridge.mjs");
        const sent = await requestArmCall(actor.id, payload);
        if (!sent) return null;
        log(`Asked the GM to arm ${key} on ${actor.name} (${grants}).`);
        return true;
    }

    await actor.setFlag(MODULE_ID, FLAGS.pendingCall, payload);
    log(`${actor.name} has ${key} armed (${grants}).`);
    return true;
}

/** Spend the armed Call. Called by the roll pipeline once it has been used. */
export async function consumeCall(actor) {
    const pending = pendingCall(actor);
    if (!pending) return null;
    await actor.unsetFlag(MODULE_ID, FLAGS.pendingCall);
    return pending;
}

/** Does this character have permission for a given roll control right now? */
export function grants(actor, what) {
    return pendingCall(actor)?.grants === what;
}

/* ==========================================================================
 * APPLYING A CALL
 * ========================================================================== */

/**
 * Apply everything a Call does, after it has been paid for.
 *
 * @param {Actor} actor    Who made the Call.
 * @param {string} key
 * @param {"hope"|"despair"} kind
 * @param {object} choice  { target, project, room, item } from the picker.
 * @returns {Promise<string[]>} lines describing what happened.
 */
export async function applyCall(actor, key, kind, choice = {}) {
    const call = kind === "despair" ? DESPAIR_CALLS[key] : HOPE_CALLS[key];
    if (!call) return [];

    const done = [];

    try {
        // --- effects that arm the next roll ---
        if (call.grants) {
            // Support and For the Game arm someone else; the rest arm the caller.
            const beneficiary = choice.target ?? actor;
            await armCall(beneficiary, { key, kind, grants: call.grants, from: actor.id });
            done.push(game.i18n.format("DRPG.Calls.armed", {
                name: beneficiary.name,
                what: game.i18n.localize(`DRPG.Calls.grants.${call.grants}`)
            }));
        }

        // --- damage and stress ---
        if (call.damage && choice.target) {
            const update = {};
            for (const [resource, amount] of Object.entries(call.damage)) {
                // HP and Stress are reverse resources: marks count up to max.
                const marks = resourceValue(choice.target, resource);
                const max = resourceMax(choice.target, resource);
                update[`system.resources.${resource}.value`] = Math.min(max, marks + amount);
            }
            await automatedUpdate(choice.target, update);
            done.push(game.i18n.format("DRPG.Calls.damaged", {
                name: choice.target.name,
                what: Object.entries(call.damage).map(([r, n]) => `${n} ${r === "hitPoints" ? "HP" : "Stress"}`).join(", ")
            }));
        }

        // --- project progress ---
        //
        // Named from the local project list rather than from what `addProgress`
        // returns: a player's write is forwarded to the GM and comes back as a
        // bare acknowledgement, so reading the name off it produced a receipt
        // saying "progress on ?" — which reads exactly like nothing happened.
        if ((call.progress || call.wipesProgress) && choice.project) {
            const { addProgress, allProjects } = await import("./projects.mjs");
            const project = allProjects().find(p => p.id === choice.project);

            if (!project) {
                ui.notifications.warn(game.i18n.localize("DRPG.Project.gone"));
            } else if (call.wipesProgress) {
                if (project.current) await addProgress(choice.project, -project.current);
                done.push(game.i18n.format("DRPG.Calls.wiped", { name: project.name }));
            } else {
                const applied = await addProgress(choice.project, call.progress);
                if (!applied) throw new Error(`addProgress refused ${choice.project}`);

                // A GM's write says outright whether the bar moved. A player's
                // is forwarded, so the answer comes back as a whisper instead —
                // never claim a number this side of the socket.
                if (applied.changed === false) {
                    done.push(game.i18n.format("DRPG.Calls.progressRefused", { name: project.name }));
                } else if (applied.changed) {
                    done.push(game.i18n.format("DRPG.Calls.progressedTo", {
                        name: project.name, current: applied.to, target: applied.target
                    }));
                } else {
                    done.push(game.i18n.format("DRPG.Calls.progressSent", {
                        name: project.name, n: call.progress > 0 ? `+${call.progress}` : call.progress
                    }));
                }
            }
        }

        // --- reroll the last action ---
        if (call.reroll) {
            const { rerollLastAction } = await import("./reroll.mjs");
            const lines = await rerollLastAction(actor);
            if (!lines) throw new Error("nothing to reroll");
            done.push(...lines);
        }

        // --- a new rule, announced to everyone ---
        if (call.announces && choice.text) {
            await ChatMessage.create({
                content: `<div class="drpg-new-rule">
                    <h3>${game.i18n.localize("DRPG.Calls.newRuleTitle")}</h3>
                    <p>${foundry.utils.escapeHTML(choice.text)}</p>
                </div>`
            });
            done.push(game.i18n.localize("DRPG.Calls.newRuleAnnounced"));
        }

        // --- sealed rooms ---
        if (call.sealsRoom && choice.room) {
            await sealRoom(choice.room);
            done.push(game.i18n.format("DRPG.Calls.sealed", { room: choice.room }));
        }

        // --- gather everyone ---
        if (call.gathersEveryone && choice.room) {
            const moved = await gatherEveryone(choice.room);
            done.push(game.i18n.format("DRPG.Calls.gathered", { room: choice.room, n: moved }));
        }

        // --- destroy an item ---
        if (call.target === "item" && choice.item) {
            const name = choice.item.name;
            await choice.item.delete();
            done.push(game.i18n.format("DRPG.Calls.destroyed", { item: name }));
        }
    } catch (err) {
        // A Call that has been paid for and did nothing must say so. Failing
        // quietly is how "Contribution adds no progress, no error" happened.
        error(`Could not fully apply ${key}`, err);
        ui.notifications.error(game.i18n.format("DRPG.Calls.effectFailed", { call: call.label }));
        done.push(game.i18n.format("DRPG.Calls.effectFailed", { call: call.label }));
    }

    return done;
}

/* ==========================================================================
 * ROOM EFFECTS
 * ========================================================================== */

/** Rooms sealed for this time of day. Cleared when the clock advances. */
export function sealedRooms() {
    try {
        return game.settings.get(MODULE_ID, "sealedRooms") ?? [];
    } catch {
        return [];
    }
}

export function isSealed(room) {
    return sealedRooms().includes(room);
}

async function sealRoom(room) {
    if (!game.user.isGM) return null;
    const current = new Set(sealedRooms());
    current.add(room);
    await game.settings.set(MODULE_ID, "sealedRooms", Array.from(current));
    return true;
}

/** Called when the time of day advances — a seal lasts one time of day. */
export async function clearSeals() {
    if (!game.user.isGM) return null;
    await game.settings.set(MODULE_ID, "sealedRooms", []);
    return true;
}

/**
 * Teleport every student into one room.
 *
 * Moving a token by writing x/y is a *move*: Foundry measures the path, and a
 * wall between here and there stops it dead — which is why Public Announcement
 * kept reporting "blocked by a wall" while everyone stayed put. Regions know how
 * to receive tokens instead: `teleportTokens` places them at a random point
 * inside the region with no path to block, which is exactly what Monokuma's
 * announcement does to the cast.
 */
async function gatherEveryone(room) {
    if (!game.user.isGM || !canvas?.scene) return 0;

    const region = canvas.scene.regions.find(r => r.name === room);
    if (!region) {
        ui.notifications.warn(game.i18n.format("DRPG.Calls.noSuchRoom", { room }));
        return 0;
    }

    const { isMonokuma } = await import("./monokuma.mjs");
    const tokens = canvas.tokens.placeables
        .filter(t => t.actor?.type === "character" && !isMonokuma(t.actor))
        .map(t => t.document);

    if (!tokens.length) return 0;

    // Nobody is billed for this: the move is made by a GM client, and
    // movement.mjs exempts GM-initiated moves outright.
    try {
        await region.teleportTokens(tokens, { placement: "random", snap: true, pan: false });
        return tokens.length;
    } catch (err) {
        error("Region teleport failed; falling back to a direct placement", err);
        const { REVERT } = await import("./movement.mjs");
        return fallbackGather(region, tokens, REVERT);
    }
}

/**
 * If the region cannot place the tokens — an unusual shape, or a version that
 * does not offer `teleportTokens` — write the positions directly, spread around
 * the region's centre and flagged so the movement rules leave them alone.
 */
async function fallbackGather(region, tokens, REVERT) {
    const bounds = region.object?.bounds ?? region.bounds;
    const centre = bounds
        ? { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
        : { x: canvas.scene.width / 2, y: canvas.scene.height / 2 };

    const spread = (canvas.grid?.size ?? 100) * 1.2;
    const updates = tokens.map((doc, index) => {
        const angle = (index / 8) * Math.PI * 2;
        return {
            _id: doc.id,
            x: Math.round(centre.x + Math.cos(angle) * spread),
            y: Math.round(centre.y + Math.sin(angle) * spread)
        };
    });

    await canvas.scene.updateEmbeddedDocuments("Token", updates, {
        [REVERT]: true,
        teleport: true,
        movementAction: "displace",
        animate: false
    });
    return updates.length;
}

/* ==========================================================================
 * PICKERS
 * ========================================================================== */

/**
 * Ask for whatever the Call needs pointing at. Returns null if cancelled, or an
 * empty object when the Call needs nothing.
 */
export async function pickTarget(actor, call, kind) {
    // The one Call whose content is the point: a new rule has to be written
    // before it can be announced.
    if (call.announces) return pickText(call);

    switch (call.target) {
        case "player": return pickPlayer(actor, call, kind);
        case "project": return pickProject(actor);
        case "room": return pickRoom();
        case "item": return pickItem();
        default: return {};
    }
}

/** The wording of a new killing game rule, which everyone will be shown. */
async function pickText(call) {
    const text = await DialogV2.wait({
        window: { title: call.label },
        classes: ["drpg-panel", "drpg-despair-dialog"],
        content: `<form>
            <p>${game.i18n.localize("DRPG.Calls.newRulePrompt")}</p>
            <textarea name="text" rows="3"
                placeholder="${game.i18n.localize("DRPG.Calls.newRulePlaceholder")}"></textarea>
            <p class="notes">${game.i18n.localize("DRPG.Calls.newRuleNote")}</p>
        </form>`,
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Action.proceed"), default: true,
                callback: (e, b, d) => d.element.querySelector("[name=text]").value.trim()
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!text || text === "cancel") return null;
    return { text };
}

async function pickPlayer(actor, call, kind) {
    const { isMonokuma } = await import("./monokuma.mjs");
    const { othersInRoom } = await import("./movement.mjs");

    // Support explicitly requires the same room; Monokuma reaches anyone.
    const sameRoomOnly = kind === "hope";
    const pool = sameRoomOnly
        ? othersInRoom(actor)
        : game.actors.filter(a => a.type === "character" && !isMonokuma(a) && a.id !== actor.id);

    if (!pool.length) {
        ui.notifications.warn(game.i18n.localize(
            sameRoomOnly ? "DRPG.Calls.nobodyHere" : "DRPG.Calls.noPlayers"));
        return null;
    }

    const id = await choose("DRPG.Calls.whichPlayer",
        pool.map(a => ({ value: a.id, label: a.name })));
    if (!id) return null;
    return { target: pool.find(a => a.id === id) };
}

async function pickProject(actor) {
    const { allProjects, projectsAvailableIn } = await import("./projects.mjs");
    const { roomOfActor } = await import("./movement.mjs");

    // Hope's Contribution is "a project being run in your current room";
    // Monokuma reaches any of them.
    const room = roomOfActor(actor);
    const pool = projectsAvailableIn(room).length ? projectsAvailableIn(room) : allProjects();

    if (!pool.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Project.none"));
        return null;
    }

    const id = await choose("DRPG.Calls.whichProject",
        pool.map(p => ({ value: p.id, label: `${p.name} — ${p.current}/${p.start}` })));
    if (!id) return null;
    return { project: id };
}

async function pickRoom() {
    const { allRooms } = await import("./movement.mjs");
    const rooms = allRooms();
    if (!rooms.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Rest.noRegions"));
        return null;
    }
    const room = await choose("DRPG.Calls.whichRoom", rooms.map(r => ({ value: r, label: r })));
    return room ? { room } : null;
}

async function pickItem() {
    const entries = [];
    for (const actor of game.actors) {
        if (actor.type !== "character") continue;
        for (const item of actor.items) {
            if (!item.getFlag(MODULE_ID, "category")) continue;
            entries.push({ value: item.uuid, label: `${actor.name} — ${item.name}` });
        }
    }
    if (!entries.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Calls.noItems"));
        return null;
    }
    const uuid = await choose("DRPG.Calls.whichItem", entries);
    if (!uuid) return null;
    return { item: await fromUuid(uuid) };
}

/** One-dropdown picker. */
async function choose(promptKey, options) {
    const html = options
        .map(o => `<option value="${foundry.utils.escapeHTML(o.value)}">${foundry.utils.escapeHTML(o.label)}</option>`)
        .join("");

    const picked = await DialogV2.wait({
        window: { title: game.i18n.localize(promptKey) },
        classes: ["drpg-panel"],
        content: `<form><label>${game.i18n.localize(promptKey)}
                    <select name="choice">${html}</select></label></form>`,
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Action.proceed"), default: true,
                callback: (e, b, d) => d.element.querySelector("[name=choice]").value
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    return (picked && picked !== "cancel") ? picked : null;
}
