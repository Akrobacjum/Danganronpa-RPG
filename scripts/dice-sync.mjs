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
 * THE SOURCE'S OWN LOOK (E16 fix r1-G1, 19.10.2026; findings C3-S1 and C3-C3). An Assistant GM may write any
 * User (LIVE-E30-04), the source's too, and until this fix the primary spread whatever the source's flags then
 * held: an Assistant, forced like a player by the owner's Q3, set the table's look by writing it on the
 * Gamemaster. So each GM browser keeps a copy of the source's look - its two flags and its colour, which DSN's
 * `ALL_CUSTOMIZATION` builds a look from - taken as it loads and at each write of the source's by a full
 * Gamemaster (and by anyone while a full Gamemaster has the switch off: then nothing is forced). A write of it by anyone below full
 * Gamemaster, and one no hook heard that a sweep finds, is put back to that copy before anything spreads, with
 * the users' wait and fuse. The copy is memory: an Assistant's write while no full Gamemaster's browser was
 * there is the copy at the next load, the family of fix early-C4-G1's gap on the GMs' stores.
 *
 * THE TWO SWITCHES (E16 fix r1b-G1, 19.10.2026; finding E16-COR-2, the owner's Q5 run on its default (a)). Foundry
 * lets an Assistant GM write a world setting, so an Assistant lifted its own forcing by switching `forceDiceLook`
 * off, or moved the table's look by pointing `diceLookSource` at another full Gamemaster. Each GM browser keeps a
 * copy of both as a full Gamemaster left them - taken as it loads and at each full Gamemaster's write - and the
 * primary writes a change by anyone below full Gamemaster back to that copy before a sweep spreads anything,
 * telling its GM once a minute. The primary's own write is its copy too: an Assistant primary (no full Gamemaster
 * connected) judges for itself, and its own console's change stands until a full Gamemaster's browser loads, which
 * takes the value it finds (the copy is memory, as the source's is).
 *
 * NO LOOP. A put-back waits 400 ms after the user's last update (DSN's save is six updates in a row), compares
 * before it writes, and stops for that user after five in a minute, with one console error and one notice to
 * the GM, once a session: something else is writing that user's look back each time. A minute after its last
 * put-back it is put back again (E16 fix r1-G1, finding C3-C2: until then it stayed stopped until the primary
 * reloaded, so six writes in a minute bought a player its own look for the session).
 *
 * AN ACTOR'S OWN LOOK (C4). DSN lays an actor's `flags.dice-so-nice.appearance` over its user's look
 * (`Dice3D.APPEARANCE(user, actor)`, the same design's reading; its header control on a sheet writes it), so an
 * owner could throw in a look of its own through its character. The GMs' copy of each actor's overlay is a GM
 * store (gm-stores.mjs `diceLookStore`), which the primary writes at each write of a full Gamemaster's; the
 * primary puts an overlay a user below full Gamemaster wrote (Assistants too, Q3) back to that copy, with the
 * same wait, comparison and fuse. Here the writer is read, since the overlay has no canonical value of its own:
 * it is the one Foundry stamps on the update, never a packet's. The store takes rows from a full Gamemaster's
 * browser only (`fullGmOnly`, E16 fix r1-G2, finding sec-3): an Assistant's console wrote it until then. In a world with no full Gamemaster no overlay is
 * put back, as no user's look is (E16 fix r1-G1, finding E16-C4-F3). A full Gamemaster's overlay on one unlinked
 * token never becomes its base actor's copy: a synthetic actor (`isToken`, its base's id) is no row of the store
 * (E16 fix r1-G2, finding E16-C4-F5). Its own overlay (its ActorDelta's flags) is held to the base actor's copy
 * (E16 fix r1b-G1, finding sec-4): a write of it below full Gamemaster, should v14 fire `updateActor` for the
 * synthetic actor (LIVE-E16-03), and every throw a user below full Gamemaster makes as that token - the message's
 * `speaker.token` read through its scene, as private-rolls.mjs `rollSubjectNow` reads it - are put back on the
 * token's actor. A full Gamemaster's own throw as a token is not checked, so a GM's look on an NPC's token stands
 * until a player throws as it. The harness has no synthetic actor (lib/shim.mjs `TokenDocumentImpl.actor`
 * answers the base), so tier 2 stands one in. Daggerheart's GM relay, which writes as the GM,
 * carries no actor flag (relay-guard.mjs `actorRefusal` lets through resource values only). Which actor DSN lays
 * over a throw, and what the throw then looks like, is not drawn headless: LIVE-E16-03.
 *
 * WITH NO GM WATCHING (E16 fix early-C4-G1, 19.10.2026; finding E16-C4-F1). Until this fix the copy was each GM
 * browser's memory, taken from the world as DSN got ready, so an overlay a player wrote while no GM was connected,
 * or one the fuse had stopped putting back, was the GMs' copy from the next GM's load on. The store outlives a
 * reload and a session and is synced between the GMs. Once the primary's stores have the other GMs' copies
 * (`compareOverlays`), every actor whose overlay is not the copy is put back, and the world's overlay is taken
 * only for an actor the store holds no row for - the first run, or an actor made while no GM was connected - and
 * weakly, so that a copy another GM's browser holds wins as the two meet. An actor a user below full Gamemaster
 * makes has none in the copy. So the comparison is as good as the copy the loading GM's browser holds, as the
 * sheets' marks are (sheet-audit.mjs): one alone on a browser whose copy is older than another GM browser's puts an
 * overlay a full Gamemaster gave since back to its own. A GM alone on a browser that never held the store (another
 * machine, cleared site data) took every overlay as found, so one a player wrote with no GM connected became the
 * GMs' copy there (E16 fix r1b-G1, findings sec-5 and E16-COR-3): an unseen actor that a user below Assistant
 * owns - its player, or the player who made it - is taken with none and put back to none; only an actor no
 * player owns is taken as found. A full Gamemaster's overlay on a player's character is lost the same way, once,
 * on such a browser.
 *
 * A WRITE NO HOOK HEARS. An update with `noHook` reaches no listener (in the harness; on v14 LIVE-E16-04), so the
 * primary also compares at each message a user posts - a throw's card is one - the author's look and the
 * overlay of the actor it speaks as, and at each connect the user's look: one throw late at most. A Reroll gives
 * an old message new dice and shows them as the roller's, so a message's rolls rewritten are checked the same way
 * (`updateChatMessage`; E16 fix r1-G2, finding E16-C4-F6). A roll the GM
 * draws for a player (roll-draw.mjs) is the GM's message, so there the roller is the user the GMs' record of
 * the roll names, the sender Foundry named to the draw. At a message the overlay is held to the GMs' copy
 * whoever wrote it, since nothing says who did: a full Gamemaster's own `noHook` overlay is put back there too.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { isPrimaryGm, log, error, forcedReplacement, forcedDeletion } from "./utils.mjs";
import { stableJson, onGmStoresHydrated, gmStoresHydrated, gmStoresQuiet } from "./gm-store.mjs";
import { diceLookStore } from "./gm-stores.mjs";

const DSN = "dice-so-nice";
/** The wait after a user's last update before its look is read and put back: DSN's save is six updates in a row. */
const PUT_BACK_WAIT_MS = 400;
/** At most this many put-backs of one user inside the window, then none until the window has passed since the last. */
const FUSE_LIMIT = 5;
const FUSE_WINDOW_MS = 60000;
/** The key the source's own change and the source setting share in the debounce, so they fold into one sweep. */
const SWEEP = "*";
/** How often, and how far apart, a drawn roll's record is looked for: the draw keeps it after its message is written. */
const RECORD_TRIES = 10;
const RECORD_WAIT_MS = 200;
/** The debounce key of an actor's overlay, beside the users' ids. */
const ACTOR = "actor:";
/** The fuse's key of the source's own look, put back to the GMs' copy. */
const SOURCE = "source:";
/** The debounce and fuse key of an unlinked token's own overlay: `token:<sceneId>.<tokenId>`. */
const TOKEN = "token:";
/** The world settings only a full Gamemaster sets (the owner's Q5, its default (a)). */
const SWITCHES = [SETTINGS.forceDiceLook, SETTINGS.diceLookSource];

const timers = new Map();
const putBacks = new Map();
const blown = new Set();
/** The keys whose stop has been said: once a session each. */
const saidStopped = new Set();
/** This browser's copy of the source's look: `{ id, look }`, its flags and colour as a full Gamemaster left them. */
let sourceCopy = null;
let saidNoSource = false, saidRefused = false, toldPlayer = false, ownWriteAt = 0;
/** This GM browser's copy of SWITCHES as a full Gamemaster left them, by name; the put-back in flight; its last notice. */
const switchCopy = new Map();
let holdingSwitches = null, toldSwitchAt = 0;

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
    Hooks.on("createActor", (actor, _options, userId) => onActorWritten(actor, userId, true, { created: true }));
    Hooks.on("updateActor", (actor, changes, _options, userId) => {
        if (changes?.flags !== undefined) onActorWritten(actor, userId, touchesLook(changes.flags));
    });
    // The copy goes with its actor; the compaction takes the tombstone once the actor is gone (gm-stores.mjs `exists`).
    // Only a row the store holds, as sheet-audit.mjs drops a mark: a tombstone of no row is a write of nothing.
    Hooks.on("deleteActor", actor => {
        if (actor?.id && !actor.isToken && isPrimaryGm() && gmStoresHydrated() && diceLookStore.has(actor.id)) void diceLookStore.drop(actor.id);
    });
    Hooks.on("createChatMessage", onMessage);
    // A Reroll gives a message new dice and shows them as the roller's (private-rolls.mjs `relayRerolledDice`):
    // the same check as a new message (E16 fix r1-G2, finding E16-C4-F6), so a `noHook` look is one throw late at most.
    Hooks.on("updateChatMessage", (message, changes) => {
        if (changes && typeof changes === "object" && Object.hasOwn(changes, "rolls")) onMessage(message);
    });
    // The deleted user is gone from `game.users` as the hook runs, so `lookSource` cannot name it: the setting is read raw.
    Hooks.on("deleteUser", user => {
        if (!user?.id) return;
        if (sourceCopy?.id === user.id) sourceCopy = null;
        if (user.id === namedSourceId()) schedule(SWEEP);
    });
    // A world setting's first write creates its document: both hooks name the writer last.
    Hooks.on("updateSetting", (setting, _changes, _options, userId) => onSwitchWritten(setting, userId));
    Hooks.on("createSetting", (setting, _options, userId) => onSwitchWritten(setting, userId));
    // A user who joins gets the look before its first throw: this runs on the primary when the joiner's socket connects.
    Hooks.on("userConnected", (user, connected) => {
        if (!connected || !isForced(user) || !isPrimaryGm()) return;
        void putBack(user.id, { count: false });
    });
    if (game.user?.isGM) {
        copySwitches();
        copySource();
    }
    // The overlays wait for the other GMs' copies of the store, not for DSN: they are flags, read as they stand.
    if (gmStoresHydrated()) onStoresHydrated();
    else onGmStoresHydrated(onStoresHydrated);
    const ready = () => { void sweep(); };
    if (game.dice3d) ready();
    else Hooks.once("diceSoNiceReady", ready);
}

/** Not while the suite holds the stores or stands them in another world: a hydration then is the suite's. */
function onStoresHydrated() {
    if (!isPrimaryGm() || gmStoresQuiet()) return;
    compareOverlays().catch(err => error("Could not hold the characters' dice looks to the GMs' copy", err));
}

/** The switch, read at each step: a world setting, and off writes nothing (Q4). */
function enforcing() {
    try { return game.settings.get(MODULE_ID, SETTINGS.forceDiceLook) === true; }
    catch { return false; }
}

/** The switch as a full Gamemaster left it, where this browser holds a copy: off only by a full Gamemaster's hand. */
function enforcingAsHeld() {
    return switchCopy.has(SETTINGS.forceDiceLook) ? switchCopy.get(SETTINGS.forceDiceLook) === true : enforcing();
}

/** One of SWITCHES as it stands, or undefined where it cannot be read. */
function switchValue(name) {
    try { return game.settings.get(MODULE_ID, name); } catch { return undefined; }
}

/** Both switches as they stand taken as this GM browser's copy (at its load). */
function copySwitches() {
    for (const name of SWITCHES) {
        const value = switchValue(name);
        if (value !== undefined) switchCopy.set(name, value);
    }
}

/**
 * A write of a world setting as every browser hears it. On a GM's browser a full Gamemaster's write of a switch is
 * the copy from then on, and so is the primary's own; on the primary anyone else's is written back to the copy.
 * Either switch moved may move the table's look: one sweep, which waits for the put-back first.
 */
function onSwitchWritten(setting, userId) {
    const name = SWITCHES.find(key => setting?.key === `${MODULE_ID}.${key}`);
    if (!name) return;
    if (game.user?.isGM) {
        const writer = game.users.get(userId);
        if (isFullGm(writer) || (writer?.id === game.user.id && isPrimaryGm())) {
            const value = switchValue(name);
            if (value !== undefined) switchCopy.set(name, value);
        } else if (isPrimaryGm()) void holdSwitches(writer);
    }
    schedule(SWEEP);
}

/**
 * On the primary, each switch that is not its copy written back to it, once at a time; a sweep awaits it before it
 * spreads anything. The GM reads one notice a minute at most, naming the writer where one is known.
 */
function holdSwitches(writer = null) {
    if (holdingSwitches) return holdingSwitches;
    const run = (async () => {
        if (!isPrimaryGm()) return;
        let held = false;
        for (const name of SWITCHES) {
            if (!switchCopy.has(name) || switchValue(name) === switchCopy.get(name)) continue;
            try {
                await game.settings.set(MODULE_ID, name, switchCopy.get(name));
                held = true;
            } catch (err) { error(`Could not put back the setting ${name} of the table's dice look`, err); }
        }
        if (held && Date.now() - toldSwitchAt > FUSE_WINDOW_MS) {
            toldSwitchAt = Date.now();
            const name = writer?.name ?? "?";
            log(`${name} changed the table's dice look settings below full Gamemaster: put back.`);
            try { ui.notifications?.warn(game.i18n.format("DRPG.DiceLook.settingBack", { name })); }
            catch (err) { error("Could not tell the GM that the dice look settings were put back", err); }
        }
    })();
    // Cleared once it has run, never before it is stored: a run with nothing to write ends before it is returned.
    holdingSwitches = run;
    void run.finally(() => { if (holdingSwitches === run) holdingSwitches = null; });
    return run;
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
    const named = game.users.get(namedSourceId()) ?? null;
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

/** The id `diceLookSource` holds, as written, or null. */
function namedSourceId() {
    try { return game.settings.get(MODULE_ID, SETTINGS.diceLookSource) || null; } catch { return null; }
}

/** A user's colour as a write takes it: v14's Color, a number in the harness, a CSS string either way. */
function colourOf(user) {
    const colour = user?.color;
    if (colour === null || colour === undefined) return null;
    return typeof colour === "string" ? colour : String(colour.css ?? colour);
}

/** What of the source's makes the table's look: its two flags as they are (null for none) and its colour. */
function sourceLookOf(user) {
    return { appearance: plain(user?.getFlag(DSN, "appearance")), sfxList: plain(user?.getFlag(DSN, "sfxList")), color: colourOf(user) };
}

/** The source's look as it stands taken as this browser's copy. */
function copySource(source = lookSource()) {
    sourceCopy = source ? { id: source.id, look: sourceLookOf(source) } : null;
}

/** Whether the source holds the copy; a copy of another user (the source changed) is taken anew first. */
function sourceHeld(source) {
    if (!source) return true;
    if (sourceCopy?.id !== source.id) copySource(source);
    return sameLook(sourceLookOf(source), sourceCopy.look);
}

/**
 * The source's look put back to the copy, on the primary, counted against the fuse; true when the source holds
 * it after. Both flags whole, a missing one deleted, and the colour where it moved.
 */
async function holdSource(source) {
    if (!isPrimaryGm() || sourceHeld(source)) return true;
    if (!fuseHolds(SOURCE + source.id, source.name)) return false;
    const look = sourceCopy.look;
    const whole = value => (value === null ? forcedDeletion() : forcedReplacement(foundry.utils.deepClone(value)));
    const colour = look.color !== null && look.color !== colourOf(source) ? { color: look.color } : {};
    try {
        const appearance = whole(look.appearance), sfxList = whole(look.sfxList);
        if (appearance !== null && sfxList !== null) {
            await source.update({ [`flags.${DSN}.appearance`]: appearance, [`flags.${DSN}.sfxList`]: sfxList, ...colour });
        } else {
            for (const key of ["appearance", "sfxList"]) {
                await source.unsetFlag(DSN, key);
                if (look[key] !== null) await source.setFlag(DSN, key, foundry.utils.deepClone(look[key]));
            }
            if (colour.color) await source.update(colour);
        }
    } catch (err) {
        refused(source, err);
        return false;
    }
    return sourceHeld(source);
}

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
        if (key === SWEEP) void sweep();
        else if (key.startsWith(ACTOR)) void putBackActor(key.slice(ACTOR.length));
        else if (key.startsWith(TOKEN)) void putBackToken(key.slice(TOKEN.length));
        else void putBack(key);
    }, PUT_BACK_WAIT_MS));
}

/**
 * Every update of a User reaches here on every browser. The primary puts a forced user's look back, and spreads
 * the source's own change; a role that changes may change who is forced or who the source is. On a forced
 * user's own browser the first put-back of its own change is said, once a session.
 */
function onUserUpdated(user, changes, _options, userId) {
    const touched = changes?.flags !== undefined || changes?.role !== undefined || changes?.color !== undefined;
    if (!touched) return;
    // The copy of the source's look, on every GM browser, so that the next primary holds it too.
    const look = touchesLook(changes.flags) || changes.color !== undefined;
    if (look && game.user?.isGM && isSource(user) && (!enforcingAsHeld() || isFullGm(game.users.get(userId)))) copySource(user);
    if (!enforcing()) return;
    if (!isPrimaryGm()) return tellPlayer(user, changes, userId);
    // The sweep puts the source back to the copy before it spreads anything: a write below full Gamemaster spreads nothing.
    if (changes.role !== undefined || isSource(user)) return schedule(SWEEP);
    if (isForced(user)) schedule(user.id);
}

/** "Your dice look is set by the GM.", once a session, on the browser of a user whose own change a GM put back. */
function tellPlayer(user, changes, userId) {
    if (user?.id !== game.user?.id || !isForced(user) || changes?.flags?.[DSN] === undefined) return;
    toldAfter(userId);
}

/** The same line for an overlay on an actor this browser's user owns. */
function tellOwner(actor, touched, userId) {
    if (!touched || !actor?.isOwner || !isForced(game.user)) return;
    toldAfter(userId);
}

function toldAfter(userId) {
    if (userId === game.user.id) { ownWriteAt = Date.now(); return; }
    if (toldPlayer || !game.users.get(userId)?.isGM || Date.now() - ownWriteAt > FUSE_WINDOW_MS) return;
    toldPlayer = true;
    ui.notifications?.info(game.i18n.localize("DRPG.DiceLook.setByGm"));
}

/** One sweep: every forced user whose look is not the source's, offline ones too, in one write. */
async function sweep() {
    if (!isPrimaryGm()) return;
    await holdSwitches();
    if (!enforcing()) return;
    const source = lookSource({ write: true });
    if (!source || !(await holdSource(source))) return;
    const look = canonicalLook();
    if (!look) return;
    const behind = game.users.filter(u => isForced(u))
        .filter(u => !stopped(u.id) && !sameLook(lookOf(u), look));
    await writeLooks(behind, look);
}

/**
 * One user's look read and put back. `count` is false for a connect: the fuse counts the answers to a user's
 * own changes, not the primary's first word to it.
 */
async function putBack(userId, { count = true } = {}) {
    const user = game.users.get(userId);
    if (!enforcing() || !isPrimaryGm() || !isForced(user) || stopped(userId)) return;
    // A source that does not hold the GMs' copy is the sweep's: it puts the source back, then reaches this user.
    if (!sourceHeld(lookSource())) return schedule(SWEEP);
    const look = canonicalLook();
    if (!look) return;
    if (sameLook(lookOf(user), look)) return;
    if (count && !fuseHolds(user.id, user.name)) return;
    await writeLooks([user], look);
}

/**
 * False once a look has been put back FUSE_LIMIT times inside the window, and until the window has passed since
 * the last of them: said once a session, then left. `key` is a user's id, an actor's debounce key or the
 * source's, `name` the one the GM reads.
 */
function fuseHolds(key, name) {
    if (stopped(key)) return false;
    const now = Date.now();
    const recent = (putBacks.get(key) ?? []).filter(at => now - at < FUSE_WINDOW_MS);
    putBacks.set(key, recent);
    if (recent.length >= FUSE_LIMIT) {
        blown.add(key);
        if (!saidStopped.has(key)) {
            saidStopped.add(key);
            error(`The dice look of ${name} was put back ${FUSE_LIMIT} times in a minute and keeps changing: it is left as it is for a minute.`);
            ui.notifications?.warn(game.i18n.format("DRPG.DiceLook.stopped", { name }));
        }
        return false;
    }
    recent.push(now);
    return true;
}

/** Whether the fuse holds `key` stopped: true until the window has passed since its last put-back, then re-armed. */
function stopped(key) {
    if (!blown.has(key)) return false;
    const last = (putBacks.get(key) ?? []).at(-1) ?? 0;
    if (Date.now() - last < FUSE_WINDOW_MS) return true;
    blown.delete(key);
    putBacks.delete(key);
    return false;
}

/** An actor's overlay as its flags hold it, or null for none. */
function overlayOf(actor) {
    return plain(actor?.flags?.[DSN]?.appearance);
}

/** Whether a write's flags name DSN's scope: v14 deletes a key with an operator under its own name. */
function touchesLook(flags) {
    return Boolean(flags) && typeof flags === "object" && Object.hasOwn(flags, DSN);
}

/** The GMs' copy of an actor's overlay, as their store holds it: null for none, and for an actor it holds no row for. */
function heldOverlay(actorId) {
    return plain(diceLookStore.get(actorId)?.look);
}

/**
 * An actor created, or its flags updated, as every browser hears it. On the primary, a full Gamemaster's write of
 * the overlay (or a creation) is the GMs' copy from then on, written to their store; a creation by anyone else
 * gives the copy none; and anyone else's write is put back, after the same wait as a user's.
 */
function onActorWritten(actor, userId, touched, { created = false } = {}) {
    if (!actor?.id) return;
    if (!isPrimaryGm()) return tellOwner(actor, touched, userId);
    // An unlinked token's actor carries its base actor's id: its overlay is no row of the copy (finding E16-C4-F5),
    // and one written below full Gamemaster goes back to its base's copy (finding sec-4).
    if (actor.isToken) {
        const ref = tokenRef(actor);
        if (ref && touched && enforcing() && !isFullGm(game.users.get(userId))) schedule(TOKEN + ref);
        return;
    }
    if (isFullGm(game.users.get(userId))) {
        if (touched) void diceLookStore.patch(actor.id, { look: overlayOf(actor) });
        return;
    }
    if (created) void diceLookStore.patch(actor.id, { look: null });
    if (enforcing()) schedule(ACTOR + actor.id);
}

/**
 * THE FIRST RUN'S COPY (E16 fix early-C4-G1): every actor the GMs' store holds no row for, its overlay as the world
 * has it now - weakly, and only where nothing is held, so that a copy another GM's browser holds wins as the two
 * meet. Called by `compareOverlays`, which asks for the hydration itself.
 */
function takeUnseenOverlays() {
    const unseen = (game.actors?.contents ?? []).filter(actor => !diceLookStore.has(actor.id));
    if (!unseen.length) return Promise.resolve();
    const rows = unseen.map(actor => [actor.id, { look: ownedBelowGm(actor) ? null : overlayOf(actor) }]);
    return diceLookStore.patchMany(Object.fromEntries(rows), { weak: true, fillOnly: true });
}

/**
 * Whether a user below Assistant owns the actor (E16 fix r1b-G1, findings sec-5 and E16-COR-3): a player could have
 * written its overlay while no GM watched, so a browser that never held the actor's row takes none for it. An
 * Assistant owns every actor as a GM does, so it is not asked here (the family of fix r1-G2's Assistant-primary gap).
 */
function ownedBelowGm(actor) {
    return game.users.some(user => !user.isGM && actor.testUserPermission?.(user, "OWNER"));
}

/**
 * THE COMPARISON AT LOAD (E16 fix early-C4-G1; exported for tier 2, which stands it in for a reload): on the
 * primary, once its stores hold the other GMs' copies (`registerDiceSync`), the first run's copy is taken for
 * every actor the store has never held, then every actor whose overlay is not the GMs' copy is put back - not
 * counted against the fuse, as a connect is not. Answers the ids put back, or null where this is not the primary
 * or its stores have not heard the other GMs.
 */
export async function compareOverlays() {
    if (!isPrimaryGm() || !diceLookStore.isHydrated()) return null;
    await takeUnseenOverlays();
    const back = [];
    for (const actor of game.actors?.contents ?? []) {
        if (await putBackActor(actor.id, { count: false })) back.push(actor.id);
    }
    return back;
}

/** Suite only: what a reload forgets - the fuse's counts and the users and actors it stopped - for tier 2's reload. */
export function forgetFuses() {
    putBacks.clear();
    blown.clear();
}

/** Suite only: the fuse's clock moved `ms` on, for tier 2's wait of a minute (E16 fix r1-G1, finding C3-C2). */
export function ageFuses(ms) {
    for (const [key, times] of putBacks) putBacks.set(key, times.map(at => at - ms));
}

/**
 * One actor's overlay read and put back to the GMs' copy (none where the copy has none); true when written.
 * `count` is false at a message and at load: the fuse counts the answers to writes, not the primary's checks.
 * Not before the primary's stores have the other GMs' copies, which may be ahead of this browser's: the
 * comparison at load reads it then.
 */
async function putBackActor(actorId, { count = true } = {}) {
    if (!isPrimaryGm()) return false;
    return putBackOverlay(game.actors?.get(actorId), ACTOR + actorId, { count });
}

/** Where an unlinked token's actor stands: `<sceneId>.<tokenId>`, or null where it names no token on a scene. */
function tokenRef(actor) {
    const token = actor?.token, scene = token?.parent;
    return token?.id && scene?.id ? `${scene.id}.${token.id}` : null;
}

/**
 * An unlinked token's own overlay put back to its base actor's copy, on the token's actor (E16 fix r1b-G1, finding
 * sec-4). A linked token's actor is the base, which `putBackActor` holds. True when written.
 */
async function putBackToken(ref, { count = true } = {}) {
    if (!isPrimaryGm()) return false;
    const [sceneId, tokenId] = String(ref).split(".");
    const actor = game.scenes?.get(sceneId)?.tokens?.get(tokenId)?.actor ?? null;
    if (!actor?.isToken) return false;
    return putBackOverlay(actor, TOKEN + ref, { count });
}

/** One actor's overlay held to the GMs' copy of its id (a token's actor carries its base's); `key` is the fuse's. */
async function putBackOverlay(actor, key, { count = true } = {}) {
    if (!isPrimaryGm()) return false;
    if (!actor || !enforcing() || stopped(key) || !diceLookStore.isHydrated()) return false;
    // A world with no full Gamemaster forces nothing (the stage's rule; `lookSource` says so once).
    if (!lookSource()) return false;
    const held = heldOverlay(actor.id);
    if (sameLook(overlayOf(actor), held)) return false;
    if (count && !fuseHolds(key, actor.name)) return false;
    const path = `flags.${DSN}.appearance`;
    try {
        const replaced = held === null ? null : forcedReplacement(foundry.utils.deepClone(held));
        if (held === null) await actor.update({ [path]: forcedDeletion() });
        else if (replaced !== null) await actor.update({ [path]: replaced });
        else {
            await actor.unsetFlag(DSN, "appearance");
            await actor.setFlag(DSN, "appearance", foundry.utils.deepClone(held));
        }
        return true;
    } catch (err) {
        refused(actor, err);
        return false;
    }
}

/**
 * A message posted, on the primary: the roller's look and the overlay of the actor it speaks as, held to the
 * GMs' at once, for what a `noHook` write left behind - and, for a roller below full Gamemaster, the overlay of the
 * unlinked token it speaks as (finding sec-4). Nothing is counted against the fuse.
 */
function onMessage(message) {
    if (!isPrimaryGm()) return;
    if (!enforcing()) return;
    const speaker = message?.speaker;
    // A throw as an unlinked token is checked for a roller below full Gamemaster only: a GM's look on its NPC stands.
    const ref = typeof speaker?.scene === "string" && typeof speaker?.token === "string" && speaker.scene && speaker.token
        ? `${speaker.scene}.${speaker.token}` : null;
    void rollerOf(message).then(roller => {
        if (!isForced(roller)) return;
        void putBack(roller.id, { count: false });
        if (ref) void putBackToken(ref, { count: false });
    });
    const actorId = speaker?.actor;
    if (typeof actorId === "string" && actorId) void putBackActor(actorId, { count: false });
}

/**
 * Whose dice a message throws: its author, or, for a roll the GM drew, the user the GMs' record names
 * (roll-draw.mjs `drawnRecordOf`, which answers only for a GM's message). The record is written after the
 * message, so it is looked for a few times; null when none comes.
 */
async function rollerOf(message) {
    const author = message?.author ?? null;
    if (!author?.isGM || !message?.getFlag?.(MODULE_ID, "drawn")) return author;
    try {
        const { drawnRecordOf } = await import("./roll-draw.mjs");
        for (let tries = 0; tries < RECORD_TRIES; tries++) {
            const row = drawnRecordOf(message);
            if (row) return game.users.get(row.userId) ?? null;
            await new Promise(resolve => setTimeout(resolve, RECORD_WAIT_MS));
        }
    } catch (err) { error("Could not read whose roll the GM drew", err); }
    return null;
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
