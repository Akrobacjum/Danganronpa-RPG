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

import { MODULE_ID, FLAGS, HOPE_CALLS, DESPAIR_CALLS, STARTING } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { automatedUpdate } from "./resource-guard.mjs";
import { resourceValue, resourceMax } from "./character.mjs";
import { announce, whisperToOwner, dialogContent, log, error, plural, cardHead } from "./utils.mjs";

/** Let the victim of a Call know what has been done to them. */
async function tell(actor, key) {
    try {
        await whisperToOwner(actor, `<p class="drpg-warning">${game.i18n.localize(key)}</p>`);
    } catch {
        // The restriction stands whether or not the notice got through.
    }
}

const DialogV2 = foundry.applications.api.DialogV2;

/* ==========================================================================
 * PENDING CALLS
 * ========================================================================== */

/**
 * Supporting rolls must not touch an armed Call.
 *
 * Sabotage rolls to conceal itself before it rolls to sabotage; an indirect
 * murder rolls to conceal intent and again to hide its traces. Every one of
 * those went through the same pipeline as the real roll, so a Call bought for
 * the sabotage was applied to — and consumed by — the concealment roll instead.
 * The player paid for advantage on the thing that mattered and got it on the
 * thing that did not.
 *
 * Held as a module-level flag rather than threaded through every call site: the
 * roll dialog reads the armed Call from its own hook, with no access to the
 * action's arguments.
 */
let shielded = 0;

export function shieldCalls() { shielded += 1; }
export function unshieldCalls() { shielded = Math.max(0, shielded - 1); }

/**
 * Advantage that nobody paid Hope for.
 *
 * Some advantage comes from the situation rather than from a Call: looking for
 * bandages in the medic's office, digging through a stash somebody has taken
 * pains to hide. It is armed around one roll and cleared straight after, and it
 * hides behind the same shield as a Call so a supporting roll cannot eat it.
 *
 * A module-level value for the same reason `shielded` is one: the roll dialog
 * reads this from its own hook and never sees the action's arguments.
 */
let situational = 0;

export function armSituational(value) { situational = Math.sign(value) || 0; }
export function clearSituational() { situational = 0; }

/** -1, 0 or 1. Zero while a supporting roll is shielded. */
export function situationalAdvantage() {
    return shielded ? 0 : situational;
}

/** The Call currently armed on this character, if any. */
export function pendingCall(actor) {
    if (shielded) return null;
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
export async function armCall(actor, { key, kind, grants, amount = null, from = null }) {
    if (!actor || !grants) return null;

    // `amount` only means something for `grants: "bonus"` — Monocub's Meddle is
    // the one caller that needs it, for the +1/-1 tier of its table. Every
    // other grant ignores it; carried through unconditionally so this stays a
    // small, boring change rather than a bonus-specific code path.
    const payload = { key, kind, grants, amount, from };

    if (!actor.isOwner) {
        const { requestArmCall } = await import("./gm-bridge.mjs");
        const sent = await requestArmCall(actor.id, payload);
        if (!sent) return null;
        log(`Asked the GM to arm ${key} on ${actor.name} (${grants}).`);
        return true;
    }

    await actor.setFlag(MODULE_ID, FLAGS.pendingCall, payload);
    log(`${actor.name} has ${key} armed (${grants}).`);

    // Tell the beneficiary, when they are not the buyer.
    //
    // A GM owns every actor, so a Monokuma arming Obstacle or For the Game took
    // this branch and set the flag in silence — the player then met a roll
    // window with disadvantage already switched on and locked, and no reason
    // given. The socket path told them; the path that actually matters did not.
    if (from && from !== actor.id) {
        await whisperToOwner(actor, `${cardHead({
            action: game.i18n.localize("DRPG.Calls.armedTitle")
        })}<p>${
            game.i18n.format("DRPG.Calls.armedForYou", {
                what: game.i18n.localize(`DRPG.Calls.grants.${grants}`)
            })
        }</p>`);
    }

    return true;
}

/** Spend the armed Call. Called by the roll pipeline once it has been used. */
export async function consumeCall(actor) {
    if (shielded) return null;
    const pending = actor?.getFlag?.(MODULE_ID, FLAGS.pendingCall) ?? null;
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
 * @returns {Promise<{lines: string[], failed: boolean}>} what happened, and
 *   whether the Call delivered nothing — in which case the caller must hand the
 *   price back. A Call that has been paid for and did nothing is a theft: the
 *   Reroll costs 3 Hope, and "there was nothing to reroll" used to keep all
 *   three of them.
 */
export async function applyCall(actor, key, kind, choice = {}) {
    const call = kind === "despair" ? DESPAIR_CALLS[key] : HOPE_CALLS[key];
    if (!call) return { lines: [], failed: true };

    const done = [];

    try {
        // --- effects that arm the next roll ---
        if (call.grants) {
            // Support and For the Game arm someone else; the rest arm the caller.
            const beneficiary = choice.target ?? actor;
            const armed = await armCall(beneficiary, { key, kind, grants: call.grants, from: actor.id });

            // `armCall` returns null when the flag could not be written — no GM
            // online to forward it, or the write itself failed. Announcing it
            // anyway is how six Hope bought a Free Critical that was never armed
            // and never refunded, because the receipt line made the Call look
            // like it had done something.
            if (!armed) throw new Error(`could not arm ${key} on ${beneficiary.name}`);

            done.push(game.i18n.format("DRPG.Calls.armed", {
                name: beneficiary.name,
                what: game.i18n.localize(`DRPG.Calls.grants.${call.grants}`)
            }));
        }

        // --- Despair spent as somebody else's Hope ---
        //
        // The pool has ALREADY been charged by `spendDespairCall`, so this only
        // credits the Hope. Routing it through `convertDespairToHope` would take
        // the Despair a second time — the exchange rate is the Call's own cost.
        if (call.grantsHope && choice.target) {
            const max = resourceMax(choice.target, "hope") || STARTING.hopeMax;
            const held = resourceValue(choice.target, "hope");
            const next = Math.min(max, held + call.grantsHope);

            if (next === held) {
                ui.notifications.warn(game.i18n.localize("DRPG.Despair.hopeAlreadyFull"));
                throw new Error(`${choice.target.name} is already at maximum Hope`);
            }

            await automatedUpdate(choice.target, { "system.resources.hope.value": next });
            done.push(game.i18n.format("DRPG.Calls.hopeGranted", {
                name: choice.target.name, n: next - held
            }));
            await whisperToOwner(choice.target, `<p>${game.i18n.format("DRPG.Despair.hopeConverted", {
                n: next - held, who: foundry.utils.escapeHTML(actor?.name ?? "Monokuma")
            })}</p>`);
        }

        // --- damage and stress ---
        if (call.damage && choice.target) {
            const update = {};
            for (const [resource, amount] of Object.entries(call.damage)) {
                // Health and Sanity are reverse resources: marks count up to max.
                const marks = resourceValue(choice.target, resource);
                const max = resourceMax(choice.target, resource);
                update[`system.resources.${resource}.value`] = Math.min(max, marks + amount);
            }
            await automatedUpdate(choice.target, update);
            done.push(game.i18n.format("DRPG.Calls.damaged", {
                name: choice.target.name,
                what: Object.entries(call.damage).map(([r, n]) => `${n} ${r === "hitPoints" ? "Health" : "Sanity"}`).join(", ")
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
                throw new Error(`project ${choice.project} no longer exists`);
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

        // --- a new rule, announced to everyone AND written down ---
        //
        // Twelve Despair used to buy a chat message that scrolled away. The
        // rule now lands on the standing list every character sheet carries,
        // which is the only form in which a rule can actually bind anybody.
        if (call.announces && choice.text) {
            const { addRule } = await import("./rules.mjs");
            const recorded = await addRule(choice.text);
            if (recorded) done.push(game.i18n.localize("DRPG.Rules.recorded"));

            await announce({
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

        // --- silence: no Hope Calls until the clock moves ---
        if (call.silences && choice.target) {
            await restrict(choice.target, { silenced: true });
            done.push(game.i18n.format("DRPG.Calls.silenced", { name: choice.target.name }));
            await tell(choice.target, "DRPG.Calls.silencedNotice");
        }

        // --- chained: pinned to the room they are standing in ---
        if (call.chains && choice.target) {
            const { roomOfActor } = await import("./movement.mjs");
            const here = roomOfActor(choice.target);
            await restrict(choice.target, { chained: true, room: here });
            done.push(game.i18n.format("DRPG.Calls.chained", {
                name: choice.target.name, room: here ?? "—"
            }));
            await tell(choice.target, "DRPG.Calls.chainedNotice");
        }

        // --- gather everyone ---
        if (call.gathersEveryone && choice.room) {
            const moved = await gatherEveryone(choice.room);
            done.push(plural("DRPG.Calls.gathered", { room: choice.room, n: moved }));
        }

        // --- destroy an item ---
        if (call.target === "item" && choice.item) {
            const name = choice.item.name;
            await choice.item.delete();
            done.push(game.i18n.format("DRPG.Calls.destroyed", { item: name }));
        }
    } catch (err) {
        // A Call that has been paid for and did nothing must say so, and must
        // give the price back. Failing quietly is how "Contribution adds no
        // progress, no error" happened.
        error(`Could not fully apply ${key}`, err);
        ui.notifications.error(game.i18n.format("DRPG.Calls.effectFailed", { call: call.label }));
        done.push(game.i18n.format("DRPG.Calls.effectFailed", { call: call.label }));
        return { lines: done, failed: true };
    }

    // Nothing thrown, but nothing happened either: a Call whose every branch was
    // skipped because the picker came back empty is still a Call that took the
    // resource and delivered none of what it promised.
    return { lines: done, failed: done.length === 0 };
}

/* ==========================================================================
 * ROOM EFFECTS AND RESTRICTIONS
 * --------------------------------------------------------------------------
 * Three Despair Calls buy a restriction that lasts until the clock moves:
 * a sealed room nobody may enter, a silenced player who may spend no Hope, and
 * a chained player who may not leave the room they are standing in.
 *
 * All three are stored as world state and *enforced* rather than merely
 * recorded. The seal used to be recorded only — the room was announced as
 * sealed and players walked straight in.
 * ========================================================================== */

/** Rooms sealed for this time of day. Cleared when the clock advances. */
export function sealedRooms() {
    try {
        return game.settings.get(MODULE_ID, SETTINGS.sealedRooms) ?? [];
    } catch {
        return [];
    }
}

export function isSealed(room) {
    return Boolean(room) && sealedRooms().includes(room);
}

async function sealRoom(room) {
    const current = new Set(sealedRooms());
    current.add(room);
    await writeWorld(SETTINGS.sealedRooms, Array.from(current));
    return true;
}

/** Per-actor restrictions: { [actorId]: { silenced, chained, room } }. */
export function restrictions() {
    try {
        return game.settings.get(MODULE_ID, SETTINGS.restrictions) ?? {};
    } catch {
        return {};
    }
}

/** May this character still spend Hope Calls? */
export function isSilenced(actor) {
    return Boolean(actor && restrictions()[actor.id]?.silenced);
}

/** Is this character pinned to the room they were in when the Call landed? */
export function isChained(actor) {
    return Boolean(actor && restrictions()[actor.id]?.chained);
}

async function restrict(actor, patch) {
    const all = { ...restrictions() };
    all[actor.id] = { ...(all[actor.id] ?? {}), ...patch };
    await writeWorld(SETTINGS.restrictions, all);
    return true;
}

/** Called when the time of day advances — every restriction lasts one. */
export async function clearSeals() {
    if (!game.user.isGM) return null;
    await game.settings.set(MODULE_ID, SETTINGS.sealedRooms, []);
    await game.settings.set(MODULE_ID, SETTINGS.restrictions, {});
    await announceRestrictions();
    return true;
}

/**
 * Write a world setting and tell every client.
 *
 * These are always set from a Monokuma's sheet, so the writer is a GM. The
 * broadcast is what makes the other screens agree: a seal that only the GM's
 * client knows about is a seal that only the GM's client enforces.
 */
async function writeWorld(key, value) {
    if (!game.user.isGM) return null;
    await game.settings.set(MODULE_ID, key, value);
    await announceRestrictions();
    return true;
}

async function announceRestrictions() {
    const { broadcast, SYNC } = await import("./sync.mjs");
    broadcast(SYNC.restrictions, {});
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
export async function gatherEveryone(room) {
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
    // WHAT AM I BUYING? — asked before the first decision, not after it.
    //
    // A Call with no target (Reroll) goes straight to `confirmCall`, which
    // opens with the name, the sentence and the price. A Call WITH a target
    // used to open with a bare dropdown of names and no explanation at all,
    // and only reached that sentence once the target had been chosen. Same
    // purchase, two different orders, and the one that showed the price last
    // was the one where the choice mattered more.
    //
    // Carried on `pendingHeader` rather than passed down through six pickers:
    // every one of them ends in `choose()` or a small form of its own, and
    // threading a header parameter through all of them to reach two template
    // strings is more moving parts than the same fact read once at the point
    // it is rendered.
    pendingHeader = callHeader(call, kind);
    try {
        // The one Call whose content is the point: a new rule has to be written
        // before it can be announced.
        if (call.announces) return await pickText(call);

        switch (call.target) {
            case "player": return await pickPlayer(actor, call, kind);
            case "monocub": return await pickMonocub();
            case "project": return await pickProject(actor);
            case "room": return await pickRoom();
            case "item": return await pickItem();
            default: return {};
        }
    } finally {
        pendingHeader = "";
    }
}

/**
 * The name, the effect and the price — the same three lines `confirmCall`
 * shows, rendered above whichever picker this Call needs.
 */
let pendingHeader = "";

function callHeader(call, kind) {
    const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
    return `<div class="drpg-call-header">
        <h3>${esc(call.label)}</h3>
        <p>${esc(call.effect)}</p>
        <p class="notes">${game.i18n.format(
            kind === "hope" ? "DRPG.Calls.costsHopeShort" : "DRPG.Calls.costsDespairShort",
            { cost: call.cost })}</p>
    </div>`;
}

/**
 * Which Monocub is being fuelled.
 *
 * Only actual Monocubs: a dead student who has not opted in has nothing to
 * spend Hope on, and a living one is not what this Call is for.
 */
async function pickMonocub() {
    const { monocubActors } = await import("./monocub.mjs");
    const cubs = monocubActors();

    if (!cubs.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Monocub.noneYet"));
        return null;
    }

    const id = await choose("DRPG.Monocub.who",
        cubs.map(a => ({
            value: a.id,
            label: `${a.name} — ${game.i18n.format("DRPG.Monocub.hopeShort", {
                held: a.system?.resources?.hope?.value ?? 0
            })}`
        })));
    if (!id) return null;
    return { target: cubs.find(a => a.id === id) };
}

/** The wording of a new killing game rule, which everyone will be shown. */
async function pickText(call) {
    const text = await DialogV2.wait({
        window: { title: call.label },
        classes: ["drpg-panel", "drpg-despair-dialog"],
        content: dialogContent(`${pendingHeader}<form>
            <p>${game.i18n.localize("DRPG.Calls.newRulePrompt")}</p>
            <textarea name="text" rows="3"
                placeholder="${game.i18n.localize("DRPG.Calls.newRulePlaceholder")}"></textarea>
            <p class="notes">${game.i18n.localize("DRPG.Calls.newRuleNote")}</p>
        </form>`),
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
    const { isDeceased } = await import("./chapter.mjs");

    // Support explicitly requires the same room; Monokuma reaches anyone.
    const sameRoomOnly = kind === "hope";
    const reachable = sameRoomOnly
        ? othersInRoom(actor)
        : game.actors.filter(a => a.type === "character" && !isMonokuma(a) && a.id !== actor.id);

    /*
     * THE DEAD ARE NOT A TARGET (D-F4).
     *
     * The wide pool filtered on type, on Monokuma and on "not me", and never
     * asked whether the person was still alive — so every Obstacle offered the
     * cast plus everybody the cast had already buried. Neither Call means
     * anything on a corpse: there is no roll of theirs to help and none to
     * hinder.
     *
     * Filtered here rather than at each Call, because it is a fact about who
     * can be targeted at all, not about what a particular Call does. A dead
     * student who opted in as a Monocub is still reachable — through
     * `pickMonocub`, which is the Call written for them.
     */
    const pool = reachable.filter(a => !isDeceased(a));

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
    const { visibleProjects, projectsAvailableIn } = await import("./projects.mjs");
    const { roomOfActor } = await import("./movement.mjs");

    // Hope's Contribution is "a project being run in your current room";
    // Monokuma reaches any of them.
    //
    // Either way the list is filtered to what this user is allowed to know
    // exists. The fallback used to be `allProjects()`, so a player standing in a
    // room with no project was shown a dropdown of every secret plan at the
    // table — the same leak as Work on Project, one dialog further along.
    const room = roomOfActor(actor);
    const here = projectsAvailableIn(room);
    const pool = here.length ? here : visibleProjects();

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
        content: `${pendingHeader}<form><label>${game.i18n.localize(promptKey)}
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
