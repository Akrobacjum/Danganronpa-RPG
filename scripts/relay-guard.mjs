/**
 * Danganronpa RPG - the guard on Daggerheart's GM relay.
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS (E03, 24.09.2026; audit S16-01, project N4a).
 *
 * Some of what a player does in Daggerheart is written by a GM's browser on
 * the player's behalf: a roll's Hope and Stress cost, a countdown tick, a Fear
 * step, a save marked on a chat card. The request travels on the socket
 * channel `system.daggerheart` as `DhGMUpdate` or `DhGMCreate`, and
 * Daggerheart's handler (`registerSocketHooks`, socket.mjs) carries it out
 * without asking who sent it. Every other road from a player to a GM in this
 * module asks that first (gm-bridge.mjs, `senderOf` and `ownsActor`); this file
 * puts the same question in front of that one.
 *
 * WHAT THIS DOES. At `init` it takes Daggerheart's listener off the channel
 * and puts one of its own in front of it. On a player's client, and for the
 * packets that only redraw something, the packet goes straight through -
 * Daggerheart's GM handlers do nothing on a player's client. On the primary
 * GM's client, a request from a player is judged against the shapes
 * Daggerheart itself sends for players (`judgeRelay`, the table below), and
 * then passed on narrowed to what was allowed, written by this file, or
 * refused. Other GMs drop these packets: one writer, which also ends
 * Daggerheart's double write with two GMs online. The table was read off
 * 2.10.5 and checked against 2.6.5's source; the two differ only where this
 * file does not lean on them (how `DowntimeTrigger` is dispatched, where the
 * Fear limit is read from).
 *
 * WHEN DAGGERHEART CHANGES. This leans on Daggerheart's own code, so it checks
 * that it is looking at what was reviewed (`fingerprintOf`), and on the primary
 * GM's client it refuses what it does not know:
 *   - a list of cases that grew, or a listener it cannot name: the unreviewed
 *     shapes are refused, and the GM is told once per Daggerheart version;
 *   - a packet name it does not know: refused, and the first few names are said
 *     in the GMs' chat (`SHAPES_WHISPERED`), the rest in the console;
 *   - a listener it cannot find, or a socket it cannot take one off: the
 *     last-resort backstop refuses in its place, and the GM is told once per
 *     version; where even that is impossible the relay is NOT guarded, and the
 *     GM is told so on every load, because that is a security state;
 *   - a sender Foundry does not name: refused, and said once per session. A
 *     named sender this client sees as disconnected is refused quietly.
 *
 * WHAT IT DOES NOT DO. It narrows, it does not referee. Still taken as sent: a
 * player's Hope, Stress and Health on their own character, and the resources of
 * an actor that is not a student (companions included), each between 0 and its
 * maximum; their own items' charges (not below 0; the item's own maximum is a
 * formula this file does not evaluate) and quantities (whole, not below 0); a
 * Fear step of one either way, never refused, only pointed out past
 * `FEAR_STEPS_NOTED`; a tick of one on any automated countdown that is not a
 * project, and any change between 0 and its start to a countdown the player
 * owns; a save total for a token they play; the group-roll and tag-team data of
 * a party one of their characters is in; a new order for a scene's
 * environments. None has a limit on how often. Whether the roll behind any of
 * those was honest is the second layer of the trust model (E28, E29).
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
/** More Fear steps than this from one player in `RECENT_MS` are pointed out to the GM (never refused). */
const FEAR_STEPS_NOTED = 4;
const WARN_EVERY_MS = 30_000;
/** Distinct unreviewed packet names whispered to the GMs in one session; the rest go to the console. */
const SHAPES_WHISPERED = 3;

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
            if (backstopOn) status.state = "backstop";
            return;
        }
        // A COPY: the emitter hands back its own live array, and `off` below edits it.
        const loose = [...sock.listeners(channel)].filter(fn => !fn.__drpgRelayGuard);
        if (!loose.length) {
            if (!originals.length) {
                // Asked again at `setup` and `ready`: a backstop that is already
                // standing is what this state is, not "not found".
                status.state = "notFound";
                installBackstop(channel);
                if (backstopOn) status.state = "backstop";
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
        try {
            const channel = channelName();
            if (channel) installBackstop(channel);
            if (backstopOn) status.state = "backstop";
        } catch { /* nothing left to try; `announce` says the relay is unguarded */ }
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
 * fidelity: other listeners on the channel see the renamed or narrowed packet.
 * What this file writes itself (Fear, countdown ticks) goes through the same
 * `enqueue` queue as the wrapper's.
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
    if (action !== GM_UPDATE && action !== GM_CREATE) {
        if (isPrimaryGm()) shapeWarning(String(action));
        payload.action = "__drpgRefused";
        return;
    }
    if (!isPrimaryGm()) { payload.action = "__drpgRefused"; return; }
    const sender = senderOf(senderId);
    if (!sender) {
        noSender(payload, senderId);
        payload.action = "__drpgRefused";
        return;
    }
    if (sender.isGM) return;
    const verdict = judgeRelay(payload, sender);
    if (verdict.verdict === "forward") {
        payload.data = verdict.packet.data;
        return;
    }
    payload.action = "__drpgRefused";
    if (verdict.verdict === "own") enqueue(verdict, sender);
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
            // Said by the primary GM only, so one GM speaks for the table.
            if (isPrimaryGm()) shapeWarning(String(action));
            return;
        }
        if (!isPrimaryGm()) {
            debug(`Daggerheart relay: "${payload?.data?.action ?? action}" left to the primary GM.`);
            return;
        }
        const sender = senderOf(senderId);
        if (!sender) return noSender(payload, senderId);
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
 *   refuse   - nothing changes; `kind` is "forged" (a shape Daggerheart does
 *              not send for a player - as far as its source has been read),
 *              "refused" (a real Daggerheart feature this game keeps to the
 *              GM) or "shape" (something unreviewed)
 *   drop     - nothing to do: Daggerheart's handler would change nothing
 *              either, or the player's own client asked for nothing
 * An `own` verdict may carry `noted`: what in it looked odd, for the console.
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
    // A string is a shape Daggerheart does not send; `{ refused }` is one it does.
    if (why?.refused) return refuseAs(sub, "refused", why.refused);
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
 *
 * That last one is REFUSED, not called forged: Daggerheart sends exactly this
 * when a player's ability heals or damages somebody else (`takeHealing`,
 * `takeDamage`, damageField.mjs). The game keeps it to the GM; nobody at the
 * table did anything wrong by asking.
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
        return { refused: `the resources of ${doc.name}, another student` };
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
        // A Daggerheart whose party no longer lists its members: nothing to
        // judge the sender against, so it is refused rather than let through.
        shapeWarning("party members");
        return { refused: `the party ${doc.name}, whose members this Daggerheart does not list` };
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
 * direction is taken, applied to the GM's own value.
 *
 * NOT RATIONED. The first version let a player move Fear twice in ten seconds
 * and refused the third step, and honest play makes a third: a roll with Fear,
 * a Reroll to Hope, a Reroll back to Fear (the E03 review measured Fear left at
 * 0 where the dice said 1), or one player rolling for two characters. A refused
 * honest step is a wrong number nobody sees. So every step lands, and a player
 * whose client moves Fear more than `FEAR_STEPS_NOTED` times in ten seconds is
 * pointed out to the GM, who can see the chat and judge it.
 */
function judgeFear(data, sender, world) {
    const sub = SUB.fear;
    const asked = Number(data?.data);
    if (!Number.isFinite(asked)) return refuseAs(sub, "forged", `Fear set to ${data?.data}`);
    const fear = world.fear();
    const gap = Math.round(asked) - fear;
    const step = Math.max(-1, Math.min(1, gap));
    if (!step) return dropAs(sub, "Fear is already there");
    const noted = Math.abs(gap) > 1 && world.now() - world.fearChangedAt() > RECENT_MS
        ? [`Fear asked for as ${asked} while it stood at ${fear}; moved by one`] : [];
    const steps = world.fearSteps(sender.id);
    return { verdict: "own", sub, ops: [{ kind: "fear", step }], noted, busy: steps > FEAR_STEPS_NOTED ? steps : 0 };
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
    // With a tick in it, the rest is most likely a copy that fell behind: the
    // tick lands, and the difference is left in the console.
    if (deltas.length) return { verdict: "own", sub, ops: [{ kind: "countdowns", deltas }], noted: suspicious };
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
    // A save whose dialog was closed: Daggerheart sends the packet anyway, with
    // no roll in it (`rollSave` returned nothing; chatMessage.mjs). Nothing to mark.
    const total = Number(inner.result?.roll?.total);
    if (inner.result?.roll?.total === undefined || inner.result?.roll?.total === null || !Number.isFinite(total)) {
        return dropAs(sub, "a save with no roll in it");
    }
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

const fearStepsOf = new Map();

/** Count this step, and say how many this player's client has sent in `RECENT_MS`. */
function countFearStep(userId) {
    const now = Date.now();
    const recent = (fearStepsOf.get(userId) ?? []).filter(at => now - at < RECENT_MS);
    recent.push(now);
    fearStepsOf.set(userId, recent);
    return recent.length;
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
        fearSteps: countFearStep,
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
    if (verdict.noted?.length) {
        warn(`Daggerheart "${verdict.sub}" from ${sender?.name ?? "a player"}: accepted in part; left out ${verdict.noted.join(", ")}.`);
    }
    if (verdict.busy && sender) noteBusyFear(sender, verdict.busy);
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
let unknownSaid = false;

/**
 * Text read off a packet, made safe to show: no markup, and not a page long.
 * A toast's escaping is not something this file has measured on v14, so what
 * reaches one carries no angle brackets to begin with.
 */
export function plainWhat(text) {
    const flat = String(text ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
    return flat.length > 160 ? `${flat.slice(0, 159)}…` : flat;
}

function reportRefusal(verdict, sender) {
    // An unreviewed name is one bucket, not one per name a packet can invent.
    const sub = verdict.kind === "shape" ? "unreviewed" : (verdict.sub ?? "?");
    const what = plainWhat(verdict.why);
    status.refused[sub] = (status.refused[sub] ?? 0) + 1;
    warn(`Refused a Daggerheart "${plainWhat(verdict.sub)}" from ${sender.name}: ${what}.`);

    // The kind is in the key: a refused request must not use up the window a
    // forged one needs to reach the GMs' chat (E03 second review).
    const key = `${sender.id}|${sub}|${verdict.kind}`;
    const now = Date.now();
    if (now - (lastWarned.get(key) ?? 0) >= WARN_EVERY_MS) {
        lastWarned.set(key, now);
        ui.notifications?.warn(game.i18n.format("DRPG.Relay.refused", { name: plainWhat(sender.name), what }));
        if (verdict.kind === "forged") {
            whisperToGms(`<p class="drpg-warning">${game.i18n.format("DRPG.Relay.forged", {
                name: foundry.utils.escapeHTML(sender.name),
                what: foundry.utils.escapeHTML(what)
            })}</p>`).catch(err => debug("Could not tell the GMs about a refused relay packet", err));
        }
    }
    if (verdict.kind === "shape") shapeWarning(verdict.sub ?? "?");
    tellRefused(sender.id, "daggerheart");
}

/**
 * A packet with no sender this client can judge. Refused either way.
 *
 * A sender Foundry did not name - no id, or one no user has - is said, once a
 * session, because if Foundry stopped naming senders on a system channel every
 * player's Daggerheart cost would stop landing and nobody would know why.
 * Whether Foundry v14 names them there is NOT measured: the harness stamps a
 * sender on every packet it relays (cluster.mjs), so it cannot tell. Live check
 * in AUDIT §9.2, item 18.
 *
 * A named user this client sees as disconnected - a tab closed right after a
 * roll, a reconnect in flight - is not that failure, and is only logged.
 */
function noSender(payload, senderId) {
    const named = senderId ? game.users?.get(senderId) : null;
    if (!named) return unknownSender(payload);
    status.refused.inactiveSender = (status.refused.inactiveSender ?? 0) + 1;
    warn(`Refused a Daggerheart "${plainWhat(payload?.data?.action ?? payload?.action)}" from ${plainWhat(named.name)}, who is not connected here.`);
}

function unknownSender(payload) {
    status.refused.unknownSender = (status.refused.unknownSender ?? 0) + 1;
    warn(`Refused a Daggerheart "${plainWhat(payload?.data?.action ?? payload?.action)}" from a sender Foundry did not name.`);
    if (unknownSaid) return;
    unknownSaid = true;
    const text = game.i18n.localize("DRPG.Relay.unknownSender");
    ui.notifications?.warn(text);
    whisperToGms(`<p class="drpg-warning">${foundry.utils.escapeHTML(text)}</p>`)
        .catch(err => debug("Could not report a relay packet with no sender", err));
}

/** A player's client moving Fear more often than rolls do. Nothing refused. */
function noteBusyFear(sender, steps) {
    warn(`Daggerheart moved Fear ${steps} times in ten seconds for ${sender.name}.`);
    const key = `${sender.id}|busyFear`;
    const now = Date.now();
    if (now - (lastWarned.get(key) ?? 0) < WARN_EVERY_MS) return;
    lastWarned.set(key, now);
    ui.notifications?.info(game.i18n.format("DRPG.Relay.busyFear", { name: plainWhat(sender.name), steps }));
}

/**
 * Once per name per session: Daggerheart sent something this file has not
 * reviewed. Only the first few names reach the GMs' chat; a new Daggerheart
 * has a handful, and anything past that is noise to a table, so it stays in
 * the console.
 */
function shapeWarning(what) {
    what = plainWhat(what);
    if (shapesWarned.has(what)) return;
    shapesWarned.add(what);
    warn(`Daggerheart sent "${what}", which the relay guard has not reviewed; this client did not run it.`);
    if (!game.user?.isGM || shapesWarned.size > SHAPES_WHISPERED) return;
    whisperToGms(`<p class="drpg-warning">${game.i18n.format("DRPG.Relay.unreviewed", {
        version: foundry.utils.escapeHTML(String(game.system?.version ?? "?")),
        cases: foundry.utils.escapeHTML(what)
    })}</p>`).catch(err => debug("Could not report an unreviewed Daggerheart packet", err));
}

/**
 * At `ready`, on the primary GM: an unguarded relay is said on every load, and
 * loudly, because it is a security state; an unreviewed Daggerheart, or a relay
 * held only by the backstop, once per version.
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
    if (status.state !== "unnamed" && status.state !== "changed" && status.state !== "backstop") return;
    let warned = "";
    try { warned = String(game.settings.get(MODULE_ID, SETTINGS.relayWarned) ?? ""); } catch { warned = ""; }
    // Which warning, as well as which version: a GM told about unreviewed cases
    // on this version is still told when the relay later falls to the backstop.
    const stamp = status.state === "backstop" ? `backstop|${version}` : version;
    if (warned === stamp) return;
    if (status.state === "backstop") {
        await whisperToGms(`<p class="drpg-warning">${foundry.utils.escapeHTML(
            game.i18n.format("DRPG.Relay.backstop", { version }))}</p>`);
    } else {
        const cases = status.unreviewed.length ? status.unreviewed.join(", ")
            : game.i18n.localize("DRPG.Relay.unreadable");
        await whisperToGms(`<p class="drpg-warning">${game.i18n.format("DRPG.Relay.unreviewed", {
            version: foundry.utils.escapeHTML(version), cases: foundry.utils.escapeHTML(cases)
        })}</p>`);
    }
    try { await game.settings.set(MODULE_ID, SETTINGS.relayWarned, stamp); } catch { /* said again next load */ }
}
