/**
 * Danganronpa RPG - the guard on Daggerheart's GM relay.
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS (E03, 24.09.2026; audit S16-01, project N4a).
 *
 * Daggerheart lets a player's browser ask a GM's browser to write things the
 * player has no permission to write: a player's roll takes Hope and Stress off
 * a character, ticks a countdown, moves Fear, marks a save on a chat card. It
 * does this with one socket channel, `system.daggerheart`, and two packets,
 * `DhGMUpdate` and `DhGMCreate`. On every GM's client, Daggerheart's handler
 * (`registerSocketHooks`, socket.mjs, identical in 2.6.5 and 2.10.5) takes the
 * packet and performs it: `document.update(data)` on whatever uuid it names,
 * `game.settings.set` on whatever setting it names, `cls.create(data)` for
 * whatever document type it names. Foundry tells a socket listener who sent the
 * packet, and Daggerheart's listener drops that on the floor.
 *
 * So a player with a console could have any GM's browser give their account
 * the Gamemaster role, give their user OWNER on somebody else's character,
 * rewrite the Countdowns setting - where this module keeps every Project,
 * secret murder plans included - or create any document at all. Every other
 * guard this module has is written on the GM's side of a socket; this was a
 * door next to all of them.
 *
 * WHAT THIS DOES. At `init` it takes Daggerheart's listener off the channel
 * and puts one of its own in front of it. On a player's client, and for the
 * packets that only redraw something, the packet goes straight through. On
 * the primary GM's client, a packet from a player is judged against the
 * shapes Daggerheart itself sends for players (`judgeRelay`, the table below,
 * read off 2.6.5 and 2.10.5), and then passed on narrowed to what was allowed,
 * written by this file, or refused. Other GMs drop these packets: one writer,
 * which also ends Daggerheart's double write with two GMs online.
 *
 * WHEN DAGGERHEART CHANGES. This leans on Daggerheart's own code, so it checks
 * that it is looking at what was reviewed (`fingerprintOf`). A listener it
 * cannot find, a list of cases that grew, a packet it does not know: every one
 * of those fails CLOSED on the GM's client and is said out loud, once, to the
 * GM. It never quietly lets an unreviewed shape through.
 *
 * WHAT IT DOES NOT DO. A player's own Hope, Stress, Health and costs still
 * arrive through here, within the resource's bounds, because that is how
 * Daggerheart charges a player's roll; whether the roll behind them was honest
 * is the second layer of the trust model (E28, E29).
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { isPrimaryGm, whisperToGms, debug, warn, error } from "./utils.mjs";
import { senderOf, tellRefused } from "./gm-bridge.mjs";

const GM_UPDATE = "DhGMUpdate";
const GM_CREATE = "DhGMCreate";

/** Packets that redraw something on every client and write nothing. */
const UI_ONLY = new Set(["DhRefresh", "DhFearUpdate", "DowntimeTrigger", "DhTagTeamStart", "DhGroupRollStart"]);

/** The cases of `handleSocketEvent` this file was written against (2.6.5 and 2.10.5 agree). */
export const REVIEWED_CASES = [
    "GMUpdate", "GMCreate", "DhpFearUpdate", "Refresh", "DowntimeTrigger", "TagTeamStart", "GroupRollStart"
];

const SUB = {
    document: "DhGMUpdateDocument",
    effect: "DhGMUpdateEffect",
    setting: "DhGMUpdateSetting",
    fear: "DhGMUpdateFear",
    countdowns: "DhGMUpdateCountdowns",
    save: "DhGMUpdateSaveMessage"
};

/** Daggerheart's `RefreshType` values (socket.mjs). */
const REFRESH_TYPES = new Set([
    "DhCoundownRefresh", "DhTagTeamRollRefresh", "DhGroupRollRefresh",
    "DhEffectsDisplayRefresh", "DhSceneRefresh", "DhCompendiumBrowserRefresh"
]);

/* Written as strings, not regex literals: the suite's name check (R22) reads
   `handleSocketEvent(` in a literal as a call to a function this file lacks. */
/** Daggerheart's listener by name; rollup renames a clashing function `name$1`. */
const LISTENER_NAME = new RegExp("^handleSocketEvent(?:\\$\\d+)?$");
/** One `case socketEvent.X:` of that listener's switch. */
const CASE_LINE = new RegExp("case\\s+socketEvent(?:\\$\\d+)?\\.(\\w+)", "g");

const OWNER = 3;
/** A countdown the GM has not touched for this long is not a stale copy on its way. */
const RECENT_MS = 10_000;
const FEAR_STEPS_PER_WINDOW = 2;
const WARN_EVERY_MS = 30_000;

const status = {
    state: "idle", wrapped: 0, names: [], fingerprint: [], unreviewed: [],
    version: null, refused: {}
};
const originals = [];
let wrapper = null;
let backstopOn = false;

/* ==========================================================================
 * INSTALLING
 * ========================================================================== */

export function registerRelayGuard() {
    ensureWrapped();
    Hooks.once("setup", ensureWrapped);
    Hooks.once("ready", () => {
        ensureWrapped();
        watchRecency();
        announce().catch(err => error("Could not report on the Daggerheart relay guard", err));
    });
}

/** The channel Daggerheart listens on. */
function channelName() {
    return game.system?.id ? `system.${game.system.id}` : null;
}

/**
 * Take Daggerheart's listener off the channel and stand in front of it.
 *
 * Asked again at `setup` and `ready`, so a listener registered after this
 * module's `init` is wrapped too, and a second call changes nothing.
 */
function ensureWrapped() {
    try {
        status.version = game.system?.version ?? null;
        const channel = channelName();
        const sock = game.socket;
        if (!channel) { status.state = "notFound"; return; }
        if (typeof sock?.listeners !== "function" || typeof sock?.off !== "function" || typeof sock?.on !== "function") {
            status.state = "noApi";
            installBackstop(channel);
            return;
        }
        // A COPY: the emitter hands back its own live array, and `off` below edits it.
        const loose = [...sock.listeners(channel)].filter(fn => !fn.__drpgRelayGuard);
        if (!loose.length) {
            if (!originals.length) {
                status.state = "notFound";
                installBackstop(channel);
            }
            return;
        }
        // Rollup renames a clashing function `name$1`; the name is still there.
        const named = loose.filter(fn => LISTENER_NAME.test(fn.name ?? ""));
        const taken = named.length ? named : loose;
        for (const fn of taken) sock.off(channel, fn);
        originals.push(...taken);
        if (!wrapper) {
            wrapper = (payload, senderId) => onRelay(payload, senderId);
            wrapper.__drpgRelayGuard = true;
            sock.on(channel, wrapper);
        }

        status.wrapped = originals.length;
        status.names = originals.map(fn => fn.name || "(anonymous)");
        status.fingerprint = fingerprintOf(originals);
        status.unreviewed = status.fingerprint.filter(name => !REVIEWED_CASES.includes(name));
        const unnamed = originals.some(fn => !LISTENER_NAME.test(fn.name ?? ""));
        status.state = unnamed ? "unnamed"
            : (!status.fingerprint.length || status.unreviewed.length) ? "changed" : "ok";
        debug(`Daggerheart relay guard: ${status.state}, ${status.wrapped} listener(s) wrapped.`);
    } catch (err) {
        status.state = "noApi";
        error("Could not put the guard in front of Daggerheart's GM relay", err);
    }
}

/**
 * Which `socketEvent` cases a listener's own source handles. Daggerheart ships
 * as a rollup build without minification, so the switch is readable. A build
 * that cannot be read has no fingerprint, which counts as changed.
 */
export function fingerprintOf(fns) {
    const cases = new Set();
    for (const fn of fns) {
        for (const match of String(fn).matchAll(CASE_LINE)) cases.add(match[1]);
    }
    return [...cases];
}

/**
 * THE LAST RESORT, and only when the listener could not be found or the socket
 * has no way to take it off. `prependAny` listeners run before every event
 * listener, synchronously, with the same packet object - so a refused packet is
 * disarmed IN PLACE, by renaming its action to one Daggerheart has no case for.
 *
 * This is the one place in the module that mutates a shared socket payload,
 * which gm-bridge.mjs forbids everywhere else, and it is allowed here because
 * there is no other way left to stop the write. It is protection, not
 * fidelity: without a queue, what this file would have written itself (Fear,
 * countdown ticks) is applied here directly and may race another write.
 */
function installBackstop(channel) {
    if (backstopOn) return;
    const sock = game.socket;
    if (typeof sock?.prependAny !== "function") return;
    sock.prependAny((event, payload, senderId) => {
        // Steps aside for good once the wrapper is up (a later `ensureWrapped`
        // found the listener): judging a packet twice would apply it twice.
        if (wrapper || event !== channel) return;
        try {
            neutralise(payload, senderId);
        } catch (err) {
            if (payload && typeof payload === "object") payload.action = "__drpgRefused";
            error("The Daggerheart relay backstop failed; the packet was refused", err);
        }
    });
    backstopOn = true;
    status.state = "backstop";
}

function neutralise(payload, senderId) {
    const action = payload?.action;
    if (!game.user?.isGM || UI_ONLY.has(action)) return;
    if (action !== GM_UPDATE && action !== GM_CREATE) { payload.action = "__drpgRefused"; return; }
    if (!isPrimaryGm()) { payload.action = "__drpgRefused"; return; }
    const sender = senderOf(senderId);
    if (!sender) { payload.action = "__drpgRefused"; return; }
    if (sender.isGM) return;
    const verdict = judgeRelay(payload, sender);
    if (verdict.verdict === "forward") {
        payload.data = verdict.packet.data;
        return;
    }
    payload.action = "__drpgRefused";
    if (verdict.verdict === "own") enqueue(verdict);
    if (verdict.verdict === "refuse") reportRefusal(verdict, sender);
}

/** What the guard is doing, for `game.drpg.relayGuard()` and the suite. */
export function relayGuardStatus() {
    return foundry.utils.deepClone({ ...status, backstop: backstopOn });
}

/* ==========================================================================
 * EVERY PACKET
 * ========================================================================== */

function forward(packet, senderId) {
    for (const fn of originals) {
        try {
            fn(packet, senderId);
        } catch (err) {
            error("Daggerheart's relay failed on a packet the guard passed on", err);
        }
    }
}

function onRelay(payload, senderId) {
    try {
        const action = payload?.action;
        // A player's client, and a redraw anywhere: Daggerheart's GM handlers
        // do nothing on a player's client, so there is nothing to judge.
        if (UI_ONLY.has(action) || !game.user?.isGM) return forward(payload, senderId);
        if (action !== GM_UPDATE && action !== GM_CREATE) {
            shapeWarning(String(action));
            return;
        }
        if (!isPrimaryGm()) {
            debug(`Daggerheart relay: "${payload?.data?.action ?? action}" left to the primary GM.`);
            return;
        }
        const sender = senderOf(senderId);
        if (!sender) {
            debug("Daggerheart relay: a packet from nobody Foundry knows, dropped.");
            return;
        }
        if (sender.isGM) return forward(payload, senderId);

        const verdict = judgeRelay(payload, sender);
        if (verdict.verdict === "forward") return forward(verdict.packet, senderId);
        if (verdict.verdict === "own") return enqueue(verdict, sender);
        if (verdict.verdict === "refuse") return reportRefusal(verdict, sender);
        debug(`Daggerheart relay: "${verdict.sub}" from ${sender.name} changes nothing (${verdict.why}).`);
    } catch (err) {
        error("The Daggerheart relay guard failed; the change was not made", err);
    }
}

/* ==========================================================================
 * THE JUDGEMENT
 * --------------------------------------------------------------------------
 * `judgeRelay(payload, sender, world)` answers one of:
 *   forward  - Daggerheart's own handler runs, on `packet` (built here, narrowed)
 *   own      - this file makes the change itself (`ops`), in a queue
 *   refuse   - nothing changes; `kind` is "forged" (a shape only a console
 *              makes), "refused" (a real Daggerheart feature this game keeps
 *              to the GM, or a limit) or "shape" (something unreviewed)
 *   drop     - Daggerheart's handler would do nothing with it either
 * `world` is everything it reads, so the suite can hand it a made-up one.
 * ========================================================================== */

const forwardTo = (sub, packet) => ({ verdict: "forward", sub, packet });
const refuseAs = (sub, kind, why) => ({ verdict: "refuse", sub, kind, why });
const dropAs = (sub, why) => ({ verdict: "drop", sub, why });

export function judgeRelay(payload, sender, world = liveWorld()) {
    const data = payload?.data;
    if (payload?.action === GM_CREATE) {
        const type = String(data?.documentType ?? "?");
        // D-a: every region in this game is a room (movement.mjs reads rooms off
        // region names), so a player's Daggerheart area would move the map.
        if (type === "Region") return refuseAs("DhGMCreate", "refused", "a Daggerheart area (a Region) placed by a player");
        return refuseAs("DhGMCreate", "forged", `a new ${type}`);
    }

    const sub = data?.action;
    switch (sub) {
        case SUB.document: return judgeDocument(data, sender, world);
        case SUB.fear: return judgeFear(data, sender, world);
        case SUB.countdowns: return judgeCountdowns(data, sender, world);
        case SUB.save: return judgeSave(data, sender, world);
        case SUB.effect: return refuseAs(sub, "forged", "an effect applied by the GM's hand");
        case SUB.setting: return refuseAs(sub, "forged", `the setting "${String(data?.uuid ?? "?")}"`);
        default: return refuseAs(String(sub ?? "?"), "shape", `"${String(sub ?? "?")}", which this module has not reviewed`);
    }
}

/** Daggerheart's refresh packet, kept only when it is one of its own. */
export function validRefresh(refresh) {
    if (!refresh || typeof refresh !== "object" || !REFRESH_TYPES.has(refresh.refreshType)) return null;
    const kept = { refreshType: refresh.refreshType };
    if (typeof refresh.action === "string") kept.action = refresh.action;
    if (Array.isArray(refresh.parts)) kept.parts = refresh.parts.filter(p => typeof p === "string");
    return kept;
}

function judgeDocument(data, sender, world) {
    const sub = SUB.document;
    const doc = world.doc(data?.uuid);
    if (!doc || !data?.data || typeof data.data !== "object") return dropAs(sub, "nothing to update");
    const flat = foundry.utils.flattenObject(data.data);
    if (!Object.keys(flat).length) return dropAs(sub, "an empty update");

    const kind = doc.documentName;
    let why;
    if (kind === "Actor" && doc.type === "party") why = partyRefusal(doc, flat, sender, world);
    else if (kind === "Actor") why = actorRefusal(doc, flat, sender);
    else if (kind === "Item") why = itemRefusal(doc, flat, sender);
    else if (kind === "Scene") why = sceneRefusal(doc, flat);
    else why = `a change to a ${kind}`;
    if (why) return refuseAs(sub, "forged", why);

    return forwardTo(sub, {
        action: GM_UPDATE,
        data: { action: sub, uuid: data.uuid, data: flat, refresh: validRefresh(data.refresh) }
    });
}

const RESOURCE_VALUE = /^system\.resources\.([\w-]+)\.value$/;

/**
 * Hope, Stress, Health, the Actions resource: a resource's value, inside its
 * bounds. On the sender's own character, or on an actor that is not a student
 * (an adversary their attack damaged); never on another student, whose
 * resources move only through the GM and this module's own GM-side flows.
 */
function actorRefusal(doc, flat, sender) {
    for (const [key, value] of Object.entries(flat)) {
        const match = RESOURCE_VALUE.exec(key);
        if (!match) return `"${key}" on ${doc.name}`;
        const resource = doc.system?.resources?.[match[1]];
        if (!resource) return `"${match[1]}", which ${doc.name} does not have`;
        const number = Number(value);
        if (!Number.isFinite(number) || number < 0) return `${match[1]} on ${doc.name} set to ${value}`;
        const max = Number(resource.max);
        if (Number.isFinite(max) && number > max) return `${match[1]} on ${doc.name} set above its maximum`;
    }
    if (doc.type === "character" && !doc.testUserPermission(sender, "OWNER")) {
        return `the resources of ${doc.name}, another student`;
    }
    return null;
}

/** An item's own charges or count, on an item a character of the sender's holds. */
function itemRefusal(doc, flat, sender) {
    if (doc.parent?.documentName !== "Actor" || !doc.testUserPermission(sender, "OWNER")) {
        return `${doc.name}, an item the sender does not hold`;
    }
    for (const [key, value] of Object.entries(flat)) {
        const number = Number(value);
        if (key === "system.resource.value") {
            if (!Number.isFinite(number) || number < 0) return `the charges of ${doc.name} set to ${value}`;
            continue;
        }
        if (key === "system.quantity") {
            if (!Number.isInteger(number) || number < 0) return `the quantity of ${doc.name} set to ${value}`;
            continue;
        }
        return `"${key}" on ${doc.name}`;
    }
    return null;
}

/** The scene's environments, put in another order - the one thing the scene bar asks. */
function sceneRefusal(doc, flat) {
    const entries = Object.entries(flat);
    if (entries.length !== 1 || entries[0][0] !== "flags.daggerheart.sceneEnvironments") {
        return `"${entries.map(([key]) => key).join(", ")}" on the scene ${doc.name}`;
    }
    const next = entries[0][1];
    const current = doc.flags?.daggerheart?.sceneEnvironments ?? [];
    const same = Array.isArray(next) && Array.isArray(current) && next.length === current.length
        && [...next].map(String).sort().join("\n") === [...current].map(String).sort().join("\n");
    return same ? null : `the environments of ${doc.name}, which is not a reordering`;
}

/** A group roll or a tag team on a party the sender has a member in. */
function partyRefusal(doc, flat, sender, world) {
    for (const key of Object.keys(flat)) {
        const inside = ["system.groupRoll", "system.tagTeam"].some(root => key === root || key.startsWith(`${root}.`));
        if (!inside) return `"${key}" on the party ${doc.name}`;
    }
    const members = doc.system?.partyMembers;
    if (!members) {
        shapeWarning("party members");
        return null;
    }
    // Asked of each member document itself, so the judgement reads only what it
    // is handed - the suite gives it made-up documents.
    const actors = [...members].map(member => typeof member === "string" ? world.doc(member) : member).filter(Boolean);
    return actors.some(actor => actor.testUserPermission?.(sender, "OWNER"))
        ? null : `the party ${doc.name}, which has none of the sender's characters`;
}

/**
 * Fear, one step at a time. Daggerheart sends the absolute value it computed on
 * the player's client - their copy of Fear plus or minus one - and a copy a
 * moment old would otherwise put back whatever the GM changed since. So only the
 * direction is taken, applied to the GM's own value, and only twice in ten
 * seconds per player.
 */
function judgeFear(data, sender, world) {
    const sub = SUB.fear;
    const asked = Number(data?.data);
    if (!Number.isFinite(asked)) return refuseAs(sub, "forged", `Fear set to ${data?.data}`);
    const fear = world.fear();
    const gap = Math.round(asked) - fear;
    const step = Math.max(-1, Math.min(1, gap));
    if (!step) return dropAs(sub, "Fear is already there");
    if (!world.fearAllowed(sender.id)) return refuseAs(sub, "refused", "more Fear changes than a roll makes");
    const suspicious = Math.abs(gap) > 1 && world.now() - world.fearChangedAt() > RECENT_MS
        ? [`Fear set to ${asked} while it stood at ${fear}`] : [];
    return { verdict: "own", sub, ops: [{ kind: "fear", step }], suspicious };
}

/**
 * Countdowns - the setting that holds every Project, secret ones included.
 *
 * Daggerheart sends the player's WHOLE copy of the setting, with their change
 * made in it, and the GM's handler wrote it over the GM's. So this reads it as
 * a list of changes to individual countdowns and takes only the ones a player
 * could have made: a tick of a countdown the rules tick on a roll, or any
 * change to one the player owns. Projects never move this way - the module's
 * own bridge is their only road. Nothing is created, nothing is deleted, and
 * every accepted change is applied as a difference to the GM's current value.
 */
function judgeCountdowns(data, sender, world) {
    const sub = SUB.countdowns;
    const theirs = data?.data;
    if (!theirs || typeof theirs !== "object" || !theirs.countdowns || typeof theirs.countdowns !== "object") {
        return refuseAs(sub, "forged", "the whole Countdowns setting");
    }
    const ours = world.countdowns();
    const oursById = ours?.countdowns ?? {};
    const stale = id => world.now() - world.changedAt(id) >= RECENT_MS;
    const deltas = [];
    const suspicious = [];
    const created = [];

    for (const [id, next] of Object.entries(theirs.countdowns)) {
        const now = oursById[id];
        if (!now) {
            created.push(String(next?.name ?? id));
            continue;
        }
        const dCurrent = Number(next?.progress?.current) - Number(now.progress?.current);
        const dStart = Number(next?.progress?.start) - Number(now.progress?.start);
        const moved = (Number.isFinite(dCurrent) && dCurrent !== 0) || (Number.isFinite(dStart) && dStart !== 0);
        if (differsBeyondProgress(now, next) && stale(id)) suspicious.push(`the settings of ${now.name ?? id}`);
        if (!moved) continue;

        if (world.isProject(id)) {
            if (stale(id)) suspicious.push(`the project ${now.name ?? id}`);
            continue;
        }
        if (world.levelOf(id, sender) >= OWNER) {
            deltas.push({
                id,
                current: Number.isFinite(dCurrent) ? dCurrent : 0,
                start: now.progress?.looping && now.progress.looping !== "noLooping" && Number.isFinite(dStart) ? dStart : 0
            });
            continue;
        }
        if (world.automationOn() && now.progress?.type !== "custom" && Math.abs(dCurrent) === 1
            && (!Number.isFinite(dStart) || dStart === 0)) {
            deltas.push({ id, current: dCurrent, start: 0 });
            continue;
        }
        if (stale(id)) suspicious.push(`the countdown ${now.name ?? id}`);
    }
    for (const id of Object.keys(oursById)) {
        if (!(id in theirs.countdowns) && stale(id)) suspicious.push(`the removal of ${oursById[id]?.name ?? id}`);
    }
    for (const key of ["hideNewCountdowns", "defaultOwnership"]) {
        if (key in theirs && JSON.stringify(theirs[key]) !== JSON.stringify(ours?.[key]) && world.now() - world.changedAt("*") >= RECENT_MS) {
            suspicious.push(`"${key}"`);
        }
    }

    // D-b: a countdown a Daggerheart ability starts is the GM's to start here.
    if (created.length) return refuseAs(sub, "refused", `new countdowns (${created.join(", ")})`);
    if (deltas.length) return { verdict: "own", sub, ops: [{ kind: "countdowns", deltas }], suspicious };
    if (suspicious.length) return refuseAs(sub, "forged", suspicious.join(", "));
    return dropAs(sub, "no change a player could make");
}

function differsBeyondProgress(now, next) {
    const strip = countdown => {
        const copy = foundry.utils.deepClone(countdown ?? {});
        delete copy.id;
        if (copy.progress) {
            delete copy.progress.current;
            delete copy.progress.start;
        }
        return copy;
    };
    return JSON.stringify(sortKeys(strip(now))) !== JSON.stringify(sortKeys(strip(next)));
}

function sortKeys(value) {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortKeys(value[key])]));
}

/** A save rolled for a token the sender plays, marked on the card that asked for it. */
function judgeSave(data, sender, world) {
    const sub = SUB.save;
    const inner = data?.data ?? {};
    const message = world.message(inner.message);
    if (!message) return dropAs(sub, "no such chat card");
    const token = world.tokenFor(message, inner.token);
    if (!token?.actor?.testUserPermission?.(sender, "OWNER")) {
        return refuseAs(sub, "refused", "a save for a token the sender does not play");
    }
    const total = Number(inner.result?.roll?.total);
    if (!Number.isFinite(total)) return refuseAs(sub, "forged", "a save with no number");
    return forwardTo(sub, {
        action: GM_UPDATE,
        data: {
            action: sub, uuid: null, refresh: validRefresh(data.refresh),
            data: {
                action: typeof inner.action === "string" ? inner.action : null,
                message: message.id, token: String(inner.token),
                result: { roll: { total: Math.round(total), isCritical: Boolean(inner.result.roll.isCritical) } }
            }
        }
    });
}

/* ==========================================================================
 * THE WORLD, AS THE GM'S CLIENT SEES IT
 * ========================================================================== */

function dhKey(name, fallback) {
    return CONFIG.DH?.SETTINGS?.gameSettings?.[name] ?? fallback;
}
const countdownsKey = () => dhKey("Countdowns", "Countdowns");
const fearKey = () => CONFIG.DH?.SETTINGS?.gameSettings?.Resources?.Fear ?? "ResourcesFear";
const dhId = () => CONFIG.DH?.id ?? "daggerheart";

function readCountdowns() {
    const setting = game.settings.get(dhId(), countdownsKey());
    return setting?.toObject?.() ?? foundry.utils.deepClone(setting ?? {});
}

function maxFear() {
    const fromSystem = Number(game.system?.settings?.homebrew?.maxFear);
    if (Number.isFinite(fromSystem)) return fromSystem;
    try {
        const homebrew = game.settings.get(dhId(), dhKey("Homebrew", "Homebrew"));
        const value = Number(homebrew?.maxFear);
        if (Number.isFinite(value)) return value;
    } catch { /* the setting may not exist */ }
    return 12;
}

function automationOn() {
    const fromSystem = game.system?.settings?.automation?.countdownAutomation;
    if (fromSystem !== undefined) return Boolean(fromSystem);
    try {
        return Boolean(game.settings.get(dhId(), dhKey("Automation", "Automation"))?.countdownAutomation);
    } catch {
        return false;
    }
}

function levelOf(id, user) {
    const model = game.settings.get(dhId(), countdownsKey())?.countdowns?.[id];
    if (typeof model?.getUserLevel === "function") return model.getUserLevel(user);
    if (user.isGM) return OWNER;
    const raw = readCountdowns();
    const countdown = raw.countdowns?.[id] ?? {};
    const own = countdown.ownership?.[user.id];
    if (own !== undefined && own !== -1) return own;
    if (countdown.hidden) return 0;
    return raw.defaultOwnership ?? 2;
}

function isProject(id) {
    try {
        return Object.hasOwn(game.settings.get(MODULE_ID, SETTINGS.projectMeta) ?? {}, id);
    } catch {
        return false;
    }
}

function tokenFor(message, tokenId) {
    if (!tokenId) return null;
    const scene = game.scenes.get(message?.speaker?.scene ?? "");
    const here = scene?.tokens?.get(tokenId);
    if (here) return here;
    for (const other of game.scenes ?? []) {
        const found = other.tokens?.get(tokenId);
        if (found) return found;
    }
    return null;
}

const fearSteps = new Map();

function fearAllowed(userId) {
    const now = Date.now();
    const recent = (fearSteps.get(userId) ?? []).filter(at => now - at < RECENT_MS);
    if (recent.length >= FEAR_STEPS_PER_WINDOW) {
        fearSteps.set(userId, recent);
        return false;
    }
    recent.push(now);
    fearSteps.set(userId, recent);
    return true;
}

const changedAt = new Map();
let fearChangedAt = 0;
let lastCountdowns = null;

/** When the GM's own copy of each countdown last changed - so a stale copy is not an alarm. */
function watchRecency() {
    try {
        lastCountdowns = readCountdowns();
    } catch {
        lastCountdowns = null;
    }
    Hooks.on("updateSetting", setting => {
        try {
            const key = setting?.key ?? "";
            if (key === `${dhId()}.${fearKey()}`) fearChangedAt = Date.now();
            if (key !== `${dhId()}.${countdownsKey()}`) return;
            const next = readCountdowns();
            const before = lastCountdowns?.countdowns ?? {};
            const after = next?.countdowns ?? {};
            const now = Date.now();
            for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) {
                if (JSON.stringify(before[id]) !== JSON.stringify(after[id])) changedAt.set(id, now);
            }
            if (lastCountdowns?.hideNewCountdowns !== next?.hideNewCountdowns
                || lastCountdowns?.defaultOwnership !== next?.defaultOwnership) changedAt.set("*", now);
            lastCountdowns = next;
        } catch (err) {
            debug("Could not note a countdown change", err);
        }
    });
}

function liveWorld() {
    return {
        doc: uuid => {
            if (typeof uuid !== "string" || !uuid) return null;
            try { return fromUuidSync(uuid) ?? null; } catch { return null; }
        },
        countdowns: readCountdowns,
        isProject,
        levelOf,
        automationOn,
        fear: () => Number(game.settings.get(dhId(), fearKey())) || 0,
        fearAllowed,
        fearChangedAt: () => fearChangedAt,
        changedAt: id => changedAt.get(id) ?? 0,
        message: id => game.messages.get(id ?? "") ?? null,
        tokenFor,
        now: () => Date.now()
    };
}

/* ==========================================================================
 * WHAT THIS FILE WRITES ITSELF
 * ========================================================================== */

let queue = Promise.resolve();

function enqueue(verdict, sender = null) {
    queue = queue.catch(() => null).then(() => applyOps(verdict.ops ?? []));
    if (verdict.suspicious?.length && sender) {
        reportRefusal({ ...verdict, kind: "forged", why: verdict.suspicious.join(", ") }, sender, { partly: true });
    }
    return queue;
}

async function applyOps(ops) {
    for (const op of ops) {
        try {
            if (op.kind === "fear") {
                const fresh = Number(game.settings.get(dhId(), fearKey())) || 0;
                const next = Math.max(0, Math.min(maxFear(), fresh + op.step));
                if (next !== fresh) await game.settings.set(dhId(), fearKey(), next);
            } else if (op.kind === "countdowns") {
                const fresh = readCountdowns();
                for (const delta of op.deltas) {
                    const countdown = fresh.countdowns?.[delta.id];
                    if (!countdown?.progress) continue;
                    const start = Math.max(0, Number(countdown.progress.start ?? 0) + delta.start);
                    countdown.progress.start = start;
                    const current = Number(countdown.progress.current ?? 0) + delta.current;
                    countdown.progress.current = Math.max(0, start > 0 ? Math.min(start, current) : current);
                }
                await game.settings.set(dhId(), countdownsKey(), fresh);
                // What Daggerheart's own handler does after this write (socket.mjs).
                const refresh = { refreshType: "DhCoundownRefresh" };
                game.socket.emit(channelName(), { action: "DhRefresh", data: refresh });
                Hooks.callAll("DhRefresh", refresh);
            }
        } catch (err) {
            error("Could not make a Daggerheart change the relay guard accepted", err);
        }
    }
}

/* ==========================================================================
 * SAYING NO
 * ========================================================================== */

const lastWarned = new Map();
const shapesWarned = new Set();

function reportRefusal(verdict, sender, { partly = false } = {}) {
    const sub = verdict.sub ?? "?";
    status.refused[sub] = (status.refused[sub] ?? 0) + 1;
    warn(`Refused a Daggerheart "${sub}" from ${sender.name}: ${verdict.why}.`);

    const key = `${sender.id}|${sub}`;
    const now = Date.now();
    if (now - (lastWarned.get(key) ?? 0) >= WARN_EVERY_MS) {
        lastWarned.set(key, now);
        ui.notifications?.warn(game.i18n.format("DRPG.Relay.refused", { name: sender.name, what: verdict.why }));
        if (verdict.kind === "forged") {
            whisperToGms(`<p class="drpg-warning">${game.i18n.format("DRPG.Relay.forged", {
                name: foundry.utils.escapeHTML(sender.name),
                what: foundry.utils.escapeHTML(verdict.why)
            })}</p>`).catch(err => debug("Could not tell the GMs about a refused relay packet", err));
        }
    }
    if (verdict.kind === "shape") shapeWarning(sub);
    if (!partly) tellRefused(sender.id, "daggerheart");
}

/** Once per name per session: Daggerheart sent something this file has not reviewed. */
function shapeWarning(what) {
    if (shapesWarned.has(what)) return;
    shapesWarned.add(what);
    warn(`Daggerheart sent "${what}", which the relay guard has not reviewed; this client did not run it.`);
    if (game.user?.isGM) {
        whisperToGms(`<p class="drpg-warning">${game.i18n.format("DRPG.Relay.unreviewed", {
            version: foundry.utils.escapeHTML(String(game.system?.version ?? "?")),
            cases: foundry.utils.escapeHTML(what)
        })}</p>`).catch(err => debug("Could not report an unreviewed Daggerheart packet", err));
    }
}

/**
 * At `ready`, on the primary GM: an unguarded relay is said on every load, and
 * loudly, because it is a security state; an unreviewed Daggerheart once per
 * version.
 */
async function announce() {
    if (!isPrimaryGm()) return;
    const version = String(game.system?.version ?? "?");
    if (status.state === "notFound" || status.state === "noApi") {
        const text = game.i18n.format("DRPG.Relay.unguarded", { version });
        ui.notifications?.error(text, { permanent: true });
        await whisperToGms(`<p class="drpg-warning">${foundry.utils.escapeHTML(text)}</p>`);
        return;
    }
    if (status.state !== "unnamed" && status.state !== "changed") return;
    let warned = "";
    try { warned = String(game.settings.get(MODULE_ID, SETTINGS.relayWarned) ?? ""); } catch { warned = ""; }
    if (warned === version) return;
    const cases = status.unreviewed.length ? status.unreviewed.join(", ")
        : game.i18n.localize("DRPG.Relay.unreadable");
    await whisperToGms(`<p class="drpg-warning">${game.i18n.format("DRPG.Relay.unreviewed", {
        version: foundry.utils.escapeHTML(version), cases: foundry.utils.escapeHTML(cases)
    })}</p>`);
    try { await game.settings.set(MODULE_ID, SETTINGS.relayWarned, version); } catch { /* said again next load */ }
}
