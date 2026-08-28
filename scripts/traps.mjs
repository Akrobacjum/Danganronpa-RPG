/**
 * Danganronpa RPG — the module watches, the GM fires.
 * ---------------------------------------------------------------------------
 * Dawid, 28.08: "nie jest możliwe, by GM monitorował jeden pokój przez dwie
 * sesje z rzędu i to, co mówią/robią gracze."
 *
 * He is right, and until now the module asked him to. A finished indirect
 * murder sent one card carrying the killer's typed condition and a Fire button,
 * and after that it was the GM's memory against two sessions of play. Two
 * sessions later nobody remembers.
 *
 * THE LINE THIS WHOLE FILE IS BUILT ON. The module watches; the GM fires. Never
 * the other way round. An engine that opens the murder by itself takes from the
 * GM the one thing a computer is no good at — "not now, we are mid-trial", "she
 * would have noticed that", "wrong person" — and at the same time leaves them
 * the one thing a person is no good at: watching thirty rooms for four hours.
 * `fireTrap` is untouched. The only thing that changes is WHEN the card comes.
 *
 * ---------------------------------------------------------------------------
 * FIVE LISTENERS FOR EIGHT TRIGGERS, AND THAT IS THE POINT OF DOING IT HERE.
 *
 * The plan called it eight listeners on hot paths. It is five, because three of
 * the triggers are the same event asked three questions (`drpgActionResolved`
 * for Search, project and sabotage) and two more are the same crossing:
 *
 *   crossing   → enters, alone
 *   action     → search, project, sabotage
 *   rest       → rest
 *   stash      → stash
 *   item       → item
 *
 * A room crossing and an action resolution happen several hundred times in a
 * session, so what each listener does FIRST matters more than what it does
 * afterwards. Every one of them starts with a lookup in `armed()` — a Map built
 * once and rebuilt only when the projects change — and returns on a miss before
 * touching an actor, a token or a setting. Walking every project on every step
 * is the shape that produced the quadratic in E11, found by measuring rather
 * than by anything going wrong.
 *
 * ---------------------------------------------------------------------------
 * WHAT LIVES WHERE, AND WHY THE ITEM TRIGGER IS DIFFERENT.
 *
 * Seven triggers are answered from `projectMeta`, where the trap's condition
 * already lives. The eighth — the planted item — must not be, and the reason is
 * the whole design decision of this stage: an item on a character sheet is
 * fully readable from its owner's console, so a flag saying "this is the trap"
 * would be a poisoned first aid kit with POISONED written on it.
 *
 * So the truth sits in a GM-side ledger (`trapLedger`, client-scoped, the same
 * shape the Remnant secrets use), keyed by an identity every module item
 * carries. See `drpgItemId` in inventory.mjs: a random name on everything in
 * everybody's bag, which is a name and not a mark. Which of those names is
 * poisoned is known only to the GM's own browser.
 */

import { MODULE_ID, TRAP_TRIGGERS, TRAP_MODIFIERS, AFTER_DARK,
    TIME_OF_DAY_LABELS } from "./config.mjs";
import { SETTINGS, getSetting, setSetting } from "./settings.mjs";
import { isPrimaryGm, debug, log, error } from "./utils.mjs";
// Statically, because `trapProjects` has to answer synchronously. The
// dependency only goes this way at load time — projects.mjs reaches back
// into this file through dynamic imports, which is not a cycle.
import { allProjects } from "./projects.mjs";

/* ==========================================================================
 * THE ARMED MAP — trap 157
 * ========================================================================== */

/**
 * Every armed trap, indexed by what its listener will be holding.
 *
 * Rebuilt from `projectMeta` rather than kept in step by hand: the meta is a
 * world setting and every write to it reaches every client, so invalidating on
 * that one event covers creation, arming, disarming, freezing and deletion
 * without any of them having to remember to say so.
 *
 * `null` means "no map built yet", which is different from "a map with nothing
 * in it" — the second is a real answer and costs nothing to give again.
 */
let index = null;

function armed() {
    if (index) return index;

    const next = { byRoom: new Map(), byProject: new Map(), any: 0 };
    let projects;
    try {
        projects = trapProjects();
    } catch (err) {
        error("Could not read the armed traps", err);
        return next;
    }

    for (const trap of projects) {
        next.any++;
        const room = trap.room;
        if (room) {
            const list = next.byRoom.get(room) ?? [];
            list.push(trap);
            next.byRoom.set(room, list);
        }
        const target = trap.trigger?.targetId;
        if (target) {
            const list = next.byProject.get(target) ?? [];
            list.push(trap);
            next.byProject.set(target, list);
        }
    }

    index = next;
    return index;
}

/** Throw the map away. Cheap; the next event rebuilds it. */
export function forgetArmedTraps() {
    index = null;
}

/**
 * Every trap that is armed and could still fire.
 *
 * TRAP 154 LIVES HERE, and it is two rules rather than one. A frozen project is
 * a sabotaged project and a sabotaged trap must stop hunting, or breaking the
 * scaffold means nothing. And a dead killer's trap must stop too — a murder
 * opened in a dead person's name is not a murder, it is a bug with a corpse in
 * it.
 */
function trapProjects() {
    const meta = getSetting(SETTINGS.projectMeta) ?? {};
    const out = [];

    /*
     * THE NAME COMES OFF THE COUNTDOWN, because the meta does not carry one.
     *
     * Measured on the first run of this: the alert card came out titled
     * "— something set it off". `projectMeta` holds the room, the secrecy and
     * the killer; the NAME lives on the countdown document, which is the one
     * place it can be renamed. Copying it into the meta would have made a
     * second copy that goes stale the first time somebody edits the project.
     *
     * Built once per map rebuild rather than per event — this whole function
     * runs only when `projectMeta` changes, not on every crossing.
     */
    const names = new Map(allProjects().map(p => [p.id, p.name]));

    for (const [id, entry] of Object.entries(meta)) {
        if (!entry?.indirectMurder) continue;
        const trigger = entry.trigger;
        if (!trigger?.kind || !trigger.armed) continue;
        if (trigger.firedAt) continue;             // trap 153 — one alert, then quiet
        if (entry.frozenBy) continue;              // trap 154 — sabotaged, so blind
        if (!TRAP_TRIGGERS[trigger.kind]?.watch) continue;

        const killer = game.actors.get(entry.killerId ?? entry.by ?? "");
        if (!killer) continue;
        if (killer.statuses?.has?.("dead") || isDead(killer)) continue;

        out.push({
            id,
            name: names.get(id) ?? entry.name ?? "",
            room: entry.room ?? null,
            killer, trigger
        });
    }
    return out;
}

/** Deceased without importing chapter.mjs on a hot path. */
function isDead(actor) {
    try {
        return Boolean(actor?.getFlag(MODULE_ID, "deceased"));
    } catch {
        return false;
    }
}

/* ==========================================================================
 * THE TWO MODIFIERS
 * ========================================================================== */

/**
 * Does this trap care about who, and about when?
 *
 * Both are asked here rather than at five call sites, so a third modifier is
 * one line in one place — and so that "not the one who built it" cannot be
 * remembered in four listeners and forgotten in the fifth.
 */
function passesModifiers(trap, actor) {
    const mods = trap.trigger ?? {};

    const notBuilder = mods.notBuilder ?? TRAP_MODIFIERS.notBuilder.default;
    if (notBuilder && actor?.id === trap.killer?.id) return false;

    if (mods.afterDark ?? TRAP_MODIFIERS.afterDark.default) {
        if (!afterDark()) return false;
    }
    return true;
}

function afterDark() {
    try {
        const clock = getSetting(SETTINGS.clock) ?? {};
        if (clock.eclipse) return true;
        return AFTER_DARK.includes(clock.timeOfDay);
    } catch {
        return false;
    }
}

/* ==========================================================================
 * THE ALERT — traps 153, 155, 156
 * ========================================================================== */

/**
 * Tell the GM, once, and tell them what the module thinks it saw.
 *
 * TRAP 155. Not "condition met". The card names the rule that matched, the
 * person it matched on, the room and the time of day, because the GM's job here
 * is to DISAGREE with the reading when the reading is wrong — and an alert
 * without its reasoning is a machine with a button on it.
 *
 * TRAP 156. Nothing reaches the victim. This goes down `callGm`, the same road
 * every ruling card already takes, so there is no new route for a leak — there
 * is, however, a new opportunity to build one by accident, which is why the
 * victim's name appears in exactly one place and that place is GM-only.
 *
 * TRAP 153. The trap disarms itself on the way out. A trap in the Main Hall
 * watching for "somebody enters" would otherwise fire twenty cards a session,
 * and a GM who has learned to skim those cards will skim the one that mattered.
 * Re-arming is a deliberate act — see `rearmTrap`.
 */
async function alert(trap, actor, why) {
    if (!isPrimaryGm()) return null;

    // Stamped BEFORE the card. If the write fails the alert must not go out at
    // all: an alert that could not disarm itself is the twenty-cards-a-session
    // failure with an extra step.
    const stamped = await stampFired(trap.id);
    if (!stamped) return null;

    const def = TRAP_TRIGGERS[trap.trigger.kind];
    const room = trap.room ?? roomOf(actor) ?? "?";
    const clock = getSetting(SETTINGS.clock) ?? {};

    const esc = foundry.utils.escapeHTML;
    const triggerLabel = localised(`DRPG.Trap.trigger.${trap.trigger.kind}`, def?.label ?? trap.trigger.kind);
    const body = `<p><strong>${esc(triggerLabel)}</strong></p>
        <p>${game.i18n.format("DRPG.Trap.alertReading", {
            who: esc(actor?.name ?? "?"),
            room: esc(room),
            // Off the module's own table rather than a guessed i18n key: the
            // first version of this printed the literal "DRPG.Clock.night".
            when: esc(TIME_OF_DAY_LABELS[clock.timeOfDay] ?? clock.timeOfDay ?? "?")
        })}</p>
        ${why ? `<p class="notes">${esc(why)}</p>` : ""}
        ${trap.trigger.condition
            ? `<p><strong>${game.i18n.localize("DRPG.Project.trapCondition")}</strong> ${
                esc(trap.trigger.condition)}</p>`
            : ""}`;

    const { callGm } = await import("./gm-bridge.mjs");
    await callGm(trap.killer, {
        // TRAP 156. Without this the card goes into the KILLER's messenger
        // thread — it names their actor, so that is where `callGm` files it —
        // and hands them both the fact that their trap went off and the name of
        // the person who set it off, before the GM has ruled on any of it.
        gmOnly: true,
        title: game.i18n.format("DRPG.Trap.alertTitle", { name: esc(trap.name) }),
        body,
        request: trap.name,
        actions: [
            {
                action: "fireTrap",
                label: game.i18n.localize("DRPG.Project.trapFire"),
                data: { killer: trap.killer.id, victim: actor?.id ?? null }
            },
            {
                // The other half of trap 153: a GM who decides "not this one"
                // needs a way to put the trap back that is not a console call.
                action: "rearmTrap",
                label: game.i18n.localize("DRPG.Trap.rearm"),
                data: { project: trap.id }
            }
        ]
    });

    log(`Trap "${trap.name}" saw ${actor?.name ?? "?"} in ${room} (${trap.trigger.kind}).`);
    return true;
}

/** Mark a trap as having spoken. Read back, because trap 153 depends on it. */
async function stampFired(projectId) {
    try {
        const { setProjectMeta, metaFor } = await import("./projects.mjs");
        const trigger = { ...(metaFor(projectId).trigger ?? {}), firedAt: Date.now() };
        await setProjectMeta(projectId, { trigger });
        if (!metaFor(projectId).trigger?.firedAt) {
            error(`Could not disarm trap "${projectId}" — no alert sent`);
            return false;
        }
        forgetArmedTraps();
        return true;
    } catch (err) {
        error("Could not disarm a trap before alerting", err);
        return false;
    }
}

/** Put a trap that has spoken back on watch. The GM's "not this one". */
export async function rearmTrap(projectId) {
    if (!game.user.isGM) return null;
    const { setProjectMeta, metaFor } = await import("./projects.mjs");
    const trigger = { ...(metaFor(projectId).trigger ?? {}), armed: true, firedAt: null };
    await setProjectMeta(projectId, { trigger });
    forgetArmedTraps();
    log(`Trap "${projectId}" is watching again.`);
    return true;
}

/** Start watching. Called when an indirect murder's bar fills. */
export async function armTrap(projectId, { condition = "" } = {}) {
    if (!game.user.isGM) return null;
    const { setProjectMeta, metaFor } = await import("./projects.mjs");
    const trigger = { ...(metaFor(projectId).trigger ?? {}) };
    if (!trigger.kind) return null;
    await setProjectMeta(projectId, {
        trigger: { ...trigger, armed: true, firedAt: null, condition: condition || trigger.condition }
    });
    forgetArmedTraps();
    return true;
}

/**
 * A localised string, or the fallback — never the key itself.
 *
 * `game.i18n.localize` returns the KEY when it misses, which is truthy, so
 * `localize(k) || fallback` never reaches the fallback and the card prints
 * "DRPG.Trap.trigger.alone" at the table. Measured on the first run of this.
 */
function localised(key, fallback) {
    const hit = game.i18n.localize(key);
    return hit && hit !== key ? hit : fallback;
}

function roomOf(actor) {
    try {
        return game.drpg?.roomOfActor?.(actor) ?? null;
    } catch {
        return null;
    }
}

/* ==========================================================================
 * THE LEDGER AND THE PLANT — the item trigger
 * ========================================================================== */

/** `drpgItemId` -> project id. GM browsers only; see the header. */
function ledger() {
    return getSetting(SETTINGS.trapLedger) ?? {};
}

/** Rooms holding something waiting to be found. GM browsers only. */
function plants() {
    return getSetting(SETTINGS.trapPlants) ?? {};
}

const plantKey = (room, sceneId) => `${sceneId ?? game.scenes?.current?.id ?? "-"}::${room}`;

/**
 * Leave something in a room for the first person who searches it.
 *
 * The identity is minted HERE, by the GM, and travels with the plant — so when
 * a player's Search is handed the item there is no second round trip to learn
 * what it was called. The ledger entry is written at the same moment for the
 * same reason: the only client that ever knows this item is the trap is the one
 * that decided it.
 */
export async function plantItem(projectId, room, { sceneId = null, ...item } = {}) {
    if (!game.user.isGM || !projectId || !room) return null;

    const drpgItemId = foundry.utils.randomID(16);
    const store = { ...plants() };
    store[plantKey(room, sceneId)] = { projectId, drpgItemId, ...item };
    await setSetting(SETTINGS.trapPlants, store);

    await setSetting(SETTINGS.trapLedger, { ...ledger(), [drpgItemId]: projectId });
    log(`Planted "${item.name ?? "?"}" in ${room} for trap ${projectId}.`);
    return drpgItemId;
}

/**
 * Is something waiting here? Take it if so — traps 165 and 166.
 *
 * TRAP 165. Returned INSTEAD of the draw, never added to the room's table. A
 * plant dropped into the pool is not certain, it is likely, and in a
 * well-stocked room with three tokens it is not even that. The killer would be
 * paying a project's full price for a lottery ticket.
 *
 * TRAP 166. The caller sends it down the `substitute: true` path, which the
 * module has had since v1.1.33 for "the room had none of what you asked for and
 * gave you this instead". Same sentence, same token spent, same everything. If
 * the planted-item card differed by so much as a comma, the table would learn
 * the difference inside three sessions and the best defence against an indirect
 * murder would be reading your own chat more carefully than the fiction.
 *
 * ONCE. The plant comes out of the store as it is handed over: it is one object
 * somebody left, not a property the room has acquired.
 */
export async function takePlant(room, sceneId = null) {
    if (!game.user.isGM || !room) return null;

    const store = plants();
    const key = plantKey(room, sceneId);
    const found = store[key];
    if (!found) return null;

    const rest = { ...store };
    delete rest[key];
    await setSetting(SETTINGS.trapPlants, rest);

    debug(`A planted item was taken out of ${room}.`);
    return found;
}

/**
 * Ask the GM what the trap is and where it is waiting.
 *
 * ON THE GM'S CLIENT, and that is not a convenience. The killer knows what they
 * made, but the answer has to be written into a setting only GM browsers hold —
 * so either the GM types it, or a player types it and it travels over a socket
 * that would then exist for exactly one purpose and carry exactly the secret
 * this whole design is built to keep off the wire. The GM types it.
 *
 * The item does not exist yet, and must not: an Item document on the killer's
 * sheet is readable by the killer, and one lying in a room is a token anybody
 * can see. It is a description until the moment somebody searches the room and
 * finds it — see `takePlant` and the Search path.
 */
export async function openPlantDialog(projectId) {
    if (!game.user.isGM) return null;

    const { metaFor } = await import("./projects.mjs");
    const { allRooms } = await import("./movement.mjs");
    const { ITEM_CATEGORIES } = await import("./config.mjs");

    const meta = metaFor(projectId);
    const esc = foundry.utils.escapeHTML;
    const rooms = allRooms();
    const roomOptions = rooms.map(r =>
        `<option value="${esc(r)}"${r === meta.room ? " selected" : ""}>${esc(r)}</option>`).join("");
    const catOptions = Object.entries(ITEM_CATEGORIES)
        .filter(([key]) => key !== "truthBullet")
        .map(([key, c]) => `<option value="${key}">${esc(c.label ?? key)}</option>`).join("");

    const DialogV2 = foundry.applications.api.DialogV2;
    const { dialogContent } = await import("./utils.mjs");

    const answer = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Trap.plantTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p class="notes">${game.i18n.localize("DRPG.Trap.plantPrompt")}</p>
            <label>${game.i18n.localize("DRPG.Trap.plantItem")}
                <input type="text" name="name" value="" /></label>
            <label>${game.i18n.localize("DRPG.Trap.plantRoom")}
                <select name="room">${roomOptions}</select></label>
            <label>${game.i18n.localize("DRPG.Items.category")}
                <select name="category">${catOptions}</select></label>
        </form>`),
        buttons: [
            {
                action: "plant", default: true,
                label: game.i18n.localize("DRPG.Trap.plantAction"),
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return {
                        name: f.name.value.trim(),
                        room: f.room.value,
                        category: f.category.value
                    };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        rejectClose: false
    });

    if (!answer || answer === "cancel" || !answer.name || !answer.room) return null;

    await plantItem(projectId, answer.room, {
        name: answer.name,
        category: answer.category,
        // Tier 1 so it reads as an ordinary useful thing when it is found. The
        // point is that it looks like a find, not like a plot device.
        tier: 1
    });

    await import("./utils.mjs").then(m => m.whisperToGms(
        `<p>${game.i18n.format("DRPG.Trap.planted", {
            item: foundry.utils.escapeHTML(answer.name),
            room: foundry.utils.escapeHTML(answer.room)
        })}</p>`));

    return answer;
}

/** Which trap does this item belong to, if any? GM-side only. */
export function trapForItemId(drpgItemId) {
    if (!drpgItemId) return null;
    return ledger()[drpgItemId] ?? null;
}

/* ==========================================================================
 * THE FIVE LISTENERS
 * ========================================================================== */

const SOCKET_EVENT = `module.${MODULE_ID}`;
const TRAP_EVENT = "trap.event";

export function registerTraps() {
    // The map is rebuilt from the setting, so one listener covers every way a
    // trap can appear, change or go away.
    Hooks.on("updateSetting", setting => {
        if (setting?.key === `${MODULE_ID}.${SETTINGS.projectMeta}`) forgetArmedTraps();
    });
    // A killer who dies stops hunting, and `trapProjects` reads that off the
    // actor — so the map has to be dropped when one changes.
    Hooks.on("updateActor", () => forgetArmedTraps());

    /*
     * THE RELAY, AND WITHOUT IT EIGHT OF THE NINE TRIGGERS NEVER FIRED IN PLAY.
     *
     * Measured in E17, on two accounts: a player walked from Main Hall into
     * Dinner Hall and `drpgRoomCrossed` fired ON THE PLAYER'S CLIENT ONLY. The
     * GM's browser never saw it. Every handler below opens with `isPrimaryGm()`,
     * so on the player's client it returns immediately and on the GM's client it
     * is never called — the trap stays armed and nothing happens, which looks
     * exactly like a trap nobody walked into.
     *
     * Four of the five hooks are raised by the client that DID the thing: a
     * crossing is charged on the mover's client, an action resolves on the
     * roller's, a rest and a stash hunt likewise. Only `createChatMessage`
     * reaches everybody, which is why the item trigger was the one that worked.
     *
     * So the acting client says "this happened" and the GM decides what it
     * means. The packet carries ids and a room name and nothing else: the GM
     * re-derives the trap, the modifiers and the audience on their own side,
     * because a claim from a client is a claim about an EVENT, never about a
     * consequence. A forged packet costs a false alert on the GM's screen, and
     * the GM was always the one who fires.
     */
    const relay = (kind, payload) => {
        if (isPrimaryGm()) return false;
        try {
            game.socket.emit(SOCKET_EVENT, { action: TRAP_EVENT, kind, ...payload });
        } catch (err) {
            error("Could not tell the GM about something a trap might be watching for", err);
        }
        return true;
    };

    Hooks.on("drpgRoomCrossed", event => {
        if (relay("crossing", { actorId: event?.actor?.id, to: event?.to })) return;
        onCrossed(event);
    });
    Hooks.on("drpgActionResolved", event => {
        if (relay("action", {
            actorId: event?.actor?.id, actionKey: event?.actionKey,
            hit: Boolean(event?.outcome?.success ?? event?.outcome?.hit),
            projectId: event?.projectId ?? event?.outcome?.projectId ?? null
        })) return;
        onActionResolved(event);
    });
    Hooks.on("drpgRested", event => {
        if (relay("rest", { actorId: event?.actor?.id, room: event?.room ?? null })) return;
        onRested(event);
    });
    Hooks.on("drpgStashHunted", event => {
        if (relay("stash", { actorId: event?.actor?.id, room: event?.room ?? null })) return;
        onStashHunted(event);
    });

    // Raised on every client already, so it needs no relay — and it is the only
    // one of the five that was ever working.
    Hooks.on("createChatMessage", onChatMessage);

    game.socket.on(SOCKET_EVENT, async payload => {
        if (payload?.action !== TRAP_EVENT) return;
        if (!isPrimaryGm()) return;
        const actor = payload.actorId ? game.actors.get(payload.actorId) : null;
        if (!actor) return;
        try {
            switch (payload.kind) {
                case "crossing": await onCrossed({ actor, to: payload.to }); break;
                case "action": await onActionResolved({
                    actor, actionKey: payload.actionKey,
                    outcome: { success: payload.hit }, projectId: payload.projectId
                }); break;
                case "rest": await onRested({ actor, room: payload.room }); break;
                case "stash": await onStashHunted({ actor, room: payload.room }); break;
            }
        } catch (err) {
            error("A trap could not react to something a player did", err);
        }
    });
}

/** Triggers 1 and 2. One crossing, two questions. */
async function onCrossed({ actor, to } = {}) {
    try {
        if (!isPrimaryGm() || !to) return;
        const here = armed().byRoom.get(to);
        if (!here?.length) return;

        // Asked once for the whole room rather than once per trap: `othersInRoom`
        // reads the canvas and there is no reason to read it twice.
        let alone = null;
        for (const trap of here) {
            const kind = trap.trigger.kind;
            if (kind !== "enters" && kind !== "alone") continue;
            if (!passesModifiers(trap, actor)) continue;

            if (kind === "alone") {
                if (alone === null) alone = await isAlone(actor, to);
                if (!alone) continue;
            }
            await alert(trap, actor, game.i18n.localize(
                kind === "alone" ? "DRPG.Trap.why.alone" : "DRPG.Trap.why.enters"));
        }
    } catch (err) {
        error("A trap could not react to a crossing", err);
    }
}

/**
 * Asked about the ROOM THE EVENT NAMED, not about where the actor is.
 *
 * The crossing hook already knows which room was entered, and it is the better
 * witness: during a move the token document has been updated and the canvas
 * placeable it is drawn from has not necessarily caught up, so re-deriving the
 * room from the actor can answer about where they WERE. A trigger whose whole
 * subject is "and there was nobody else there" cannot afford to be asking about
 * the previous room.
 */
async function isAlone(actor, room) {
    try {
        const { othersInNamedRoom } = await import("./movement.mjs");
        return othersInNamedRoom(room, actor).length === 0;
    } catch {
        // Cannot tell, so do not claim it. A trap that fires on "alone" when
        // the room was full is worse than one that misses a beat.
        return false;
    }
}

/** Triggers 3, 6 and 7 — the same hook, three questions. */
async function onActionResolved({ actor, actionKey, outcome, projectId } = {}) {
    try {
        if (!isPrimaryGm() || !actionKey) return;
        const map = armed();
        if (!map.any) return;

        const candidates = [];
        if (actionKey === "search") {
            // A failed Search found nothing and disturbed nothing.
            if (!outcome?.success) return;
            const room = outcome?.room ?? roomOf(actor);
            if (room) candidates.push(...(map.byRoom.get(room) ?? []));
        } else if (projectId) {
            candidates.push(...(map.byProject.get(projectId) ?? []));
        }
        if (!candidates.length) return;

        for (const trap of candidates) {
            const def = TRAP_TRIGGERS[trap.trigger.kind];
            if (def?.watch !== "action" || def.actionKey !== actionKey) continue;
            if (def.needs === "project" && trap.trigger.targetId !== projectId) continue;
            if (!passesModifiers(trap, actor)) continue;
            await alert(trap, actor, game.i18n.localize(`DRPG.Trap.why.${trap.trigger.kind}`));
        }
    } catch (err) {
        error("A trap could not react to an action", err);
    }
}

/** Trigger 4. */
async function onRested({ actor, room } = {}) {
    try {
        if (!isPrimaryGm()) return;
        const where = room ?? roomOf(actor);
        if (!where) return;
        for (const trap of armed().byRoom.get(where) ?? []) {
            if (trap.trigger.kind !== "rest") continue;
            if (!passesModifiers(trap, actor)) continue;
            await alert(trap, actor, game.i18n.localize("DRPG.Trap.why.rest"));
        }
    } catch (err) {
        error("A trap could not react to a rest", err);
    }
}

/**
 * Trigger 8. EVERY ATTEMPT, and it is fired before the dice are consulted.
 *
 * Dawid, 28.08. The trap answers somebody who is rummaging through other
 * people's hiding places; whether they were any good at it is a different
 * question and not this one.
 */
async function onStashHunted({ actor, room } = {}) {
    try {
        if (!isPrimaryGm() || !room) return;
        for (const trap of armed().byRoom.get(room) ?? []) {
            if (trap.trigger.kind !== "stash") continue;
            if (!passesModifiers(trap, actor)) continue;
            await alert(trap, actor, game.i18n.localize("DRPG.Trap.why.stash"));
        }
    } catch (err) {
        error("A trap could not react to a stash hunt", err);
    }
}

/**
 * Trigger 5, and the shape this stage chose (Dawid, 28.08: "zrób tak, jak
 * uważasz, że będzie lepiej i spójniej z resztą modułu").
 *
 * The use card is going to the GM anyway. This reads the identity off it and
 * asks the GM's own ledger — the same shape `despair-award.mjs` uses, and the
 * same shape the Remnant secrets use: the truth is in a setting on the GM's
 * browser and the object out in the world carries nothing.
 *
 * The effect has already been applied by the time this runs, and that is the
 * better scene rather than the price of the design. Poison in a medicine is
 * supposed to work as medicine first; a trap that refuses to let somebody heal
 * reads as the module declining an action, not as a story.
 */
async function onChatMessage(message) {
    try {
        if (!isPrimaryGm()) return;
        const used = message?.getFlag?.(MODULE_ID, "usedItem");
        if (!used) return;

        const projectId = trapForItemId(used.id);
        if (!projectId) return;

        const trap = trapProjects().find(t => t.id === projectId);
        if (!trap) return;

        const actor = game.actors.get(used.actorId ?? "")
            ?? game.actors.get(message.speaker?.actor ?? "");
        if (!passesModifiers(trap, actor)) return;

        await alert(trap, actor, game.i18n.format("DRPG.Trap.why.item", {
            item: foundry.utils.escapeHTML(used.name ?? "?")
        }));
    } catch (err) {
        error("A trap could not react to an item being used", err);
    }
}

/** What is watching right now, for the diagnostics. */
export function diagnoseTraps() {
    const map = armed();
    return {
        armed: map.any,
        rooms: [...map.byRoom.keys()],
        projects: [...map.byProject.keys()],
        plants: game.user.isGM ? Object.keys(plants()).length : "GM only",
        ledger: game.user.isGM ? Object.keys(ledger()).length : "GM only",
        list: trapProjects().map(t => ({
            name: t.name, room: t.room, kind: t.trigger.kind,
            afterDark: Boolean(t.trigger.afterDark),
            notBuilder: t.trigger.notBuilder ?? TRAP_MODIFIERS.notBuilder.default
        }))
    };
}
