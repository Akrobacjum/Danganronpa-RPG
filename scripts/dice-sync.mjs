/**
 * Danganronpa RPG - one dice look for the whole table (D19a; E16 p1 C3, audits S02-67 and S16-02).
 * ---------------------------------------------------------------------------
 * WHERE DICE SO NICE KEEPS A LOOK. In the User document's flags: `dice-so-nice.appearance` (the colours,
 * texture, material, font and system per die scope) and `dice-so-nice.sfxList` (the special effects), which
 * every browser reads off the roller's User to draw a throw. `dice-so-nice.settings` beside them is that
 * machine's display and performance (the owner's Q2 of 19.10: not forced). This is the 26.09 design's reading
 * of DSN 6.2.9; DSN's source is not on this machine and was not read again. Until C3 this file pushed DSN's
 * client setting `settings` over the module's socket - a setting 6.x only migrates - so it changed nothing
 * anyone drew, and the socket road is gone with it.
 *
 * WHAT IS FORCED. With `forceDiceLook` on (world, default on: the owner's Q1), every User below full
 * Gamemaster - players, trusted players and Assistant GMs (Q3: "Tak") - holds the look of the full Gamemaster
 * `diceLookSource` names. A full Gamemaster's own look is never written. Off, nothing is written and nothing
 * restored (Q4).
 *
 * WHO WRITES, AND ON WHAT. The primary GM alone (utils.mjs `isPrimaryGm`): at Dice So Nice's ready (or at the
 * module's when DSN was there first) one sweep of every such User, offline ones too; at a user's connect; and
 * after any update of such a User, read on the state the update left - never on who wrote it or on anything a
 * player's packet says, so a player's console, DSN's own six-write save, its GM push or another GM's edit are
 * the same case. A change of the source's own look reaches everyone. Each write replaces both flags whole
 * (v14's ForcedReplacement), so a scope a player added goes too.
 *
 * NO LOOP. A put-back waits 400 ms after the user's last update (DSN's save is six updates in a row), compares
 * before it writes, and stops for that user after five in a minute, with one console error and one notice to
 * the GM: something else is writing that user's look back each time.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { isPrimaryGm, log, error, forcedReplacement } from "./utils.mjs";
import { stableJson } from "./gm-store.mjs";

const DSN = "dice-so-nice";
/** The wait after a user's last update before its look is read and put back: DSN's save is six updates in a row. */
const PUT_BACK_WAIT_MS = 400;
/** At most this many put-backs of one user inside the window, then none for that user until reload. */
const FUSE_LIMIT = 5;
const FUSE_WINDOW_MS = 60000;
/** The key the source's own change and the source setting share in the debounce, so they fold into one sweep. */
const SWEEP = "*";

const timers = new Map();
const putBacks = new Map();
const blown = new Set();
let saidNoSource = false, saidRefused = false, toldPlayer = false, ownWriteAt = 0;

/**
 * Called from module.mjs's own `ready` hook, not from a `Hooks.once("ready")` registered here: Foundry does not
 * call a hook's listener added while that hook is firing.
 */
export function registerDiceSync() {
    if (!game.modules.get(DSN)?.active) {
        log("Dice So Nice is not active: the table's dice look is not forced.");
        return;
    }
    Hooks.on("updateUser", onUserUpdated);
    Hooks.on("deleteUser", user => { if (isSource(user)) schedule(SWEEP); });
    Hooks.on("updateSetting", setting => {
        if (setting?.key === `${MODULE_ID}.${SETTINGS.diceLookSource}`) schedule(SWEEP);
    });
    // A user who joins gets the look before its first throw: this runs on the primary when the joiner's socket connects.
    Hooks.on("userConnected", (user, connected) => {
        if (!connected || !isForced(user) || !isPrimaryGm()) return;
        void putBack(user.id, { count: false });
    });
    if (game.dice3d) void sweep();
    else Hooks.once("diceSoNiceReady", () => void sweep());
}

/** The switch, read at each step: a world setting, and off writes nothing (Q4). */
function enforcing() {
    try { return game.settings.get(MODULE_ID, SETTINGS.forceDiceLook) === true; }
    catch { return false; }
}

/** Below full Gamemaster: players, trusted players and, by the owner's Q3, Assistant GMs. */
export function isForced(user) {
    return Boolean(user) && user.role < CONST.USER_ROLES.GAMEMASTER;
}

const isFullGm = user => user?.role === CONST.USER_ROLES.GAMEMASTER;

/**
 * The full Gamemaster whose look is the table's: the one `diceLookSource` names, or - when it names nobody, or
 * a user who is no longer a full Gamemaster - this browser's user if it is one, else the full Gamemaster with
 * the lowest id, offline too. Written back to the setting by the primary, so the look does not change with
 * the primary. Null in a world with no full Gamemaster.
 */
function lookSource({ write = false } = {}) {
    let named = null;
    try { named = game.users.get(game.settings.get(MODULE_ID, SETTINGS.diceLookSource)) ?? null; } catch { named = null; }
    if (isFullGm(named)) return named;
    const picked = isFullGm(game.user) ? game.user : game.users.filter(isFullGm).sort((a, b) => a.id.localeCompare(b.id))[0] ?? null;
    if (!picked) {
        if (!saidNoSource) log("No full Gamemaster in this world: the table's dice look is not forced.");
        saidNoSource = true;
        return null;
    }
    if (write && isPrimaryGm()) {
        game.settings.set(MODULE_ID, SETTINGS.diceLookSource, picked.id)
            .catch(err => error("Could not record whose dice look is the table's", err));
    }
    return picked;
}

const isSource = user => Boolean(user) && lookSource()?.id === user.id;

const plain = value => (value && typeof value === "object" ? foundry.utils.deepClone(value) : null);

/**
 * The look the source throws in, as every forced user must hold it. The appearance is the one DSN works out for
 * the source (`Dice3D.ALL_CUSTOMIZATION`, read in the 26.09 design: a GM with no flag of their own still has a
 * look, from their colour), or the raw flag where DSN is not built (no canvas; the harness, whose `game.dice3d`
 * has no such method). A library die's owner is written in where it is missing, since DSN looks the die up in
 * its owner's library and a player's own would not hold it. Effects that run a macro are left out: the GM's
 * macro would run on every browser at a player's throw.
 */
export function canonicalLook() {
    const source = lookSource();
    if (!source) return null;
    let appearance = null;
    const all = game.dice3d?.constructor?.ALL_CUSTOMIZATION;
    if (typeof all === "function") {
        try { appearance = plain(all.call(game.dice3d.constructor, source, game.dice3d.DiceFactory)?.appearance); }
        catch (err) { error("Could not read the GM's dice look from Dice So Nice", err); }
    }
    appearance ??= plain(source.getFlag(DSN, "appearance")) ?? {};
    for (const scope of Object.values(appearance)) {
        if (scope && typeof scope === "object" && scope.libraryDieId && !scope.libraryDieOwner) scope.libraryDieOwner = source.id;
    }
    const raw = plain(source.getFlag(DSN, "sfxList"));
    const keep = effect => effect?.specialEffect !== "PlayMacro";
    const sfxList = Array.isArray(raw) ? raw.filter(keep)
        : raw ? Object.fromEntries(Object.entries(raw).filter(([, effect]) => keep(effect))) : [];
    return { appearance, sfxList };
}

/** A user's look as its flags hold it; a missing flag reads as an empty one, as DSN's own default does. */
function lookOf(user) {
    return { appearance: plain(user?.getFlag(DSN, "appearance")) ?? {}, sfxList: plain(user?.getFlag(DSN, "sfxList")) ?? [] };
}

/** Equal whatever the order of the keys (the harness's `foundry.utils` has no `objectsEqual`). */
function sameLook(a, b) {
    return stableJson(a) === stableJson(b);
}

function schedule(key) {
    clearTimeout(timers.get(key));
    timers.set(key, setTimeout(() => {
        timers.delete(key);
        void (key === SWEEP ? sweep() : putBack(key));
    }, PUT_BACK_WAIT_MS));
}

/**
 * Every update of a User reaches here on every browser. The primary puts a forced user's look back, and spreads
 * the source's own change; a role that changes may change who is forced or who the source is. On a forced
 * user's own browser the first put-back of its own change is said, once a session.
 */
function onUserUpdated(user, changes, _options, userId) {
    if (!enforcing()) return;
    const touched = changes?.flags !== undefined || changes?.role !== undefined;
    if (!touched) return;
    if (!isPrimaryGm()) return tellPlayer(user, changes, userId);
    if (changes.role !== undefined || isSource(user)) return schedule(SWEEP);
    if (isForced(user)) schedule(user.id);
}

/** "Your dice look is set by the GM.", once a session, on the browser of a user whose own change a GM put back. */
function tellPlayer(user, changes, userId) {
    if (user?.id !== game.user?.id || !isForced(user) || changes?.flags?.[DSN] === undefined) return;
    if (userId === game.user.id) { ownWriteAt = Date.now(); return; }
    if (toldPlayer || !game.users.get(userId)?.isGM || Date.now() - ownWriteAt > FUSE_WINDOW_MS) return;
    toldPlayer = true;
    ui.notifications?.info(game.i18n.localize("DRPG.DiceLook.setByGm"));
}

/** One sweep: every forced user whose look is not the source's, offline ones too, in one write. */
async function sweep() {
    if (!enforcing() || !isPrimaryGm()) return;
    const source = lookSource({ write: true });
    const look = canonicalLook();
    if (!source || !look) return;
    const behind = game.users.filter(u => isForced(u))
        .filter(u => !blown.has(u.id) && !sameLook(lookOf(u), look));
    await writeLooks(behind, look);
}

/**
 * One user's look read and put back. `count` is false for a connect: the fuse counts the answers to a user's
 * own changes, not the primary's first word to it.
 */
async function putBack(userId, { count = true } = {}) {
    const user = game.users.get(userId);
    if (!enforcing() || !isPrimaryGm() || !isForced(user) || blown.has(userId)) return;
    const look = canonicalLook();
    if (!look) return;
    if (sameLook(lookOf(user), look)) return;
    if (count && !fuseHolds(user)) return;
    await writeLooks([user], look);
}

/** False once a user's look has been put back FUSE_LIMIT times inside the window: said once, then left. */
function fuseHolds(user) {
    const now = Date.now();
    const recent = (putBacks.get(user.id) ?? []).filter(at => now - at < FUSE_WINDOW_MS);
    if (recent.length >= FUSE_LIMIT) {
        blown.add(user.id);
        error(`The dice look of ${user.name} was put back ${FUSE_LIMIT} times in a minute and keeps changing: it is no longer put back until this browser reloads.`);
        ui.notifications?.warn(game.i18n.format("DRPG.DiceLook.stopped", { name: user.name }));
        return false;
    }
    recent.push(now);
    putBacks.set(user.id, recent);
    return true;
}

/**
 * Both flags replaced whole: in one `updateDocuments` of the User class where v14's ForcedReplacement is there, else unset
 * and set one user at a time, as utils.mjs `replaceFlag` does in the module's own scope. A write refused (an
 * Assistant primary writing another Assistant's User may be, on v14: LIVE-E16-04) is tried user by user and
 * said once.
 */
async function writeLooks(users, look) {
    // R220's census reads a gate in the writing declaration itself; sweep and putBack hold the same one.
    if (!isPrimaryGm() || !users.length) return;
    const replaced = value => forcedReplacement(foundry.utils.deepClone(value));
    const updates = users.map(u => ({ _id: u.id, flags: { [DSN]: { appearance: replaced(look.appearance), sfxList: replaced(look.sfxList) } } }));
    if (updates[0].flags[DSN].appearance !== null) {
        try { return void await CONFIG.User.documentClass.updateDocuments(updates); }
        catch (err) { if (users.length === 1) return refused(users[0], err); }
        for (const update of updates) {
            try { await CONFIG.User.documentClass.updateDocuments([update]); }
            catch (err) { refused(game.users.get(update._id), err); }
        }
        return;
    }
    for (const user of users) {
        try {
            await user.unsetFlag(DSN, "appearance");
            await user.unsetFlag(DSN, "sfxList");
            await user.setFlag(DSN, "appearance", foundry.utils.deepClone(look.appearance));
            await user.setFlag(DSN, "sfxList", foundry.utils.deepClone(look.sfxList));
        } catch (err) { refused(user, err); }
    }
}

function refused(user, err) {
    if (saidRefused) return;
    saidRefused = true;
    error(`Could not write the table's dice look on ${user?.name ?? "a user"}`, err);
}
