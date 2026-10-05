/**
 * Danganronpa RPG - Despair pools, one per Monokuma.
 * ---------------------------------------------------------------------------
 * Guide: "There are at least two GMs. […] Each GM has their own Despair pool -
 * a maximum of 12 per GM."
 *
 * Daggerheart only models a single shared Fear pool, so this replaces its
 * tracker with one row per full Gamemaster. Assistant GMs are deliberately
 * excluded: they are helpers, not Monokumas, and the guide gives Despair only
 * to the two people running the killing game.
 *
 * Pools are on every screen with their counts public (D3); what a player's copy
 * masks is the overflow's caption. The spend itself is announced with the Call,
 * so the table sees it happen. A conversion to Hope is not a Call: what it takes
 * is owed, and the pool pays it at the next time of day (E05 C12, "THE OWED
 * DESPAIR" below).
 */

import { MODULE_ID, STARTING, DESPAIR_CALLS, callEffect } from "./config.mjs";
import { SETTINGS, getClock } from "./settings.mjs";
import { resourceValue } from "./character.mjs";
import { automatedUpdate } from "./resource-guard.mjs";
import { announce, whisperToOwner, log, warn, error, isPrimaryGm, plural } from "./utils.mjs";
import { despairOwedStore } from "./gm-stores.mjs";
import { overflowStatus } from "./overflow.mjs";
import { spentSince, markSpent } from "./motion.mjs";
import { narrowColumn } from "./narrow.mjs";

const WIDGET_ID = "drpg-despair";

export function registerDespair() {
    Hooks.once("ready", () => {
        renderDespairBar();
        // The store outlives its authors: worlds carry entries for accounts
        // long deleted and, in one measured case, a "[object Object]" key an
        // old caller once wrote. `deleteUser` was the only broom, so junk that
        // arrived any other way stayed for the life of the world - a sweep at
        // ready clears it. Primary GM only: one writer, no race between GMs.
        if (isPrimaryGm()) {
            prunePools().catch(err => error("Could not prune the Despair pools at ready", err));
            // What was owed before a time of day that moved on while no primary was here (E05 C12).
            settleOwed().catch(err => error("Could not settle the owed Despair at ready", err));
        }
    });
    // The owed Despair is paid when the time of day moves on, by the primary (E05 C12).
    Hooks.on("drpgTimeOfDayChanged", () => {
        settleOwed().catch(err => error("Could not settle the owed Despair at the time of day's change", err));
    });
    Hooks.on("canvasReady", () => renderDespairBar());
    // Keep every client's rows in step when a pool changes.
    Hooks.on("userConnected", () => renderDespairBar());
    // A row is one full Gamemaster. Promoting a player, demoting a GM or
    // renaming one all change the roster, and none of them fired anything -
    // the widget kept showing yesterday's Monokumas until a scene reloaded.
    Hooks.on("updateUser", () => renderDespairBar());
    Hooks.on("createUser", () => renderDespairBar());
    // A deleted GM's pool stayed in the world setting for good. Nothing reads
    // it any more, but it is still world state nobody can reach or clear.
    Hooks.on("deleteUser", user => {
        renderDespairBar();
        prunePools(user?.id).catch(err => error("Could not prune a deleted Monokuma's pool", err));
    });
}

/** Drop pool entries for users who no longer exist. GM only. */
export async function prunePools(removedId = null) {
    if (!game.user.isGM) return null;

    const store = pools();
    const cleaned = {};
    for (const [userId, value] of Object.entries(store)) {
        if (userId === SETTLED) {
            cleaned[userId] = value;
            continue;
        }
        if (userId === removedId) continue;
        if (!game.users.get(userId)) continue;
        cleaned[userId] = value;
    }

    if (Object.keys(cleaned).length !== Object.keys(store).length) {
        await game.settings.set(MODULE_ID, SETTINGS.despairPools, cleaned);
        log("Pruned Despair pools belonging to users that no longer exist.");
    }

    // Custom labels and opted-in extras are dead state for the same accounts.
    const names = { ...poolNames() };
    let namesChanged = false;
    for (const userId of Object.keys(names)) {
        if (userId === removedId || !game.users.get(userId)) {
            delete names[userId];
            namesChanged = true;
        }
    }
    if (namesChanged) await game.settings.set(MODULE_ID, SETTINGS.poolNames, names);

    const beforeExtra = extraPoolUserIds();
    const afterExtra = beforeExtra.filter(id => id !== removedId && game.users.get(id));
    if (afterExtra.length !== beforeExtra.length) {
        await game.settings.set(MODULE_ID, SETTINGS.extraPoolUsers, afterExtra);
    }

    return cleaned;
}

/* ==========================================================================
 * DATA
 * ========================================================================== */

/** Maximum any one Monokuma can hold. */
export function despairMax() {
    return STARTING.despairMax;
}

/**
 * The users who get a pool: every full Gamemaster automatically, plus any
 * Assistant GM explicitly granted one - see `extraPoolUserIds`.
 *
 * `User#isGM` is true for Assistant GMs too, which is why a full Gamemaster
 * still has to be found by role: an assistant only gets a pool by being
 * opted in, not just by helping at the table.
 */
export function monokumas() {
    const extra = new Set(extraPoolUserIds());
    return game.users
        .filter(u => u.role === CONST.USER_ROLES.GAMEMASTER || (u.isGM && extra.has(u.id)))
        .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Assistant GMs eligible to be granted a pool: GM, but not already one
 * automatically (a full Gamemaster) and not already opted in.
 */
export function poolCandidates() {
    const extra = new Set(extraPoolUserIds());
    return game.users
        .filter(u => u.isGM && u.role !== CONST.USER_ROLES.GAMEMASTER && !extra.has(u.id))
        .sort((a, b) => a.name.localeCompare(b.name));
}

/** Assistant GMs currently granted their own pool, beyond the automatic set. */
export function extraPoolUserIds() {
    try {
        return game.settings.get(MODULE_ID, SETTINGS.extraPoolUsers) ?? [];
    } catch {
        return [];
    }
}

/** Grant an Assistant GM their own pool. GM only. */
export async function addPool(userId) {
    if (!game.user.isGM) return null;
    const user = game.users.get(userId);
    if (!user?.isGM || user.role === CONST.USER_ROLES.GAMEMASTER) return null;

    const extra = new Set(extraPoolUserIds());
    if (extra.has(userId)) return null;
    extra.add(userId);
    await game.settings.set(MODULE_ID, SETTINGS.extraPoolUsers, Array.from(extra));
    log(`${user.name} granted a Despair pool.`);
    return true;
}

/**
 * Revoke a pool granted via `addPool`. Only ever applies to an opted-in
 * Assistant GM - a full Gamemaster's pool is the guide's rule, not a setting,
 * so there is nothing here to take away from one.
 */
export async function removePool(userId) {
    if (!game.user.isGM) return null;

    const extra = new Set(extraPoolUserIds());
    if (!extra.delete(userId)) return null;
    await game.settings.set(MODULE_ID, SETTINGS.extraPoolUsers, Array.from(extra));

    // The number and the custom label are dead state once the pool is gone.
    const store = { ...pools() };
    delete store[userId];
    await game.settings.set(MODULE_ID, SETTINGS.despairPools, store);
    await setPoolLabel(userId, null);

    log(`Despair pool revoked for user ${userId}.`);
    return true;
}

/* ---- naming --------------------------------------------------------------
 * A pool's display label defaults to the account's own name, but the account
 * name is not always what the table calls that Monokuma - two GMs literally
 * renamed their Foundry accounts "Monokuma" and "Monominie" to work around
 * not having this, which meant every part of the UI that colour-codes or
 * otherwise reads `user.name` was reading roleplay fiction as if it were
 * account identity. This decouples the two.
 * -------------------------------------------------------------------------- */

function poolNames() {
    try {
        return game.settings.get(MODULE_ID, SETTINGS.poolNames) ?? {};
    } catch {
        return {};
    }
}

/** The label to show for this pool - custom if set, the account name otherwise. */
export function poolLabel(user) {
    return poolNames()[user?.id]?.trim() || user?.name || "?";
}

/** Set (or clear, with `null`/empty) a pool's custom label. GM only. */
export async function setPoolLabel(userId, label) {
    if (!game.user.isGM) return null;
    const store = { ...poolNames() };
    if (label && label.trim()) store[userId] = label.trim();
    else delete store[userId];
    await game.settings.set(MODULE_ID, SETTINGS.poolNames, store);
    return store[userId] ?? null;
}

/** Raw pool store: { [userId]: number }. */
function pools() {
    return game.settings.get(MODULE_ID, SETTINGS.despairPools) ?? {};
}

/*
 * THE SETTLEMENT'S MARK (E05 fix r2-G2, 27.09.2026; review F5). Beside the pools, their world
 * value holds the time of day the owed Despair was last settled in (`settleOwed`), under a key
 * no user id can be (an id is sixteen characters). It is the clock's own reading, written at
 * every change of the time of day whether anything was owed or not, so it tells a console
 * nothing the clock does not; and it travels in the one write that pays, so a pool cannot be
 * paid without the mark saying so. `prunePools` and `zeroAllDespair` pass it through.
 */
const SETTLED = "settled";

/** Despair currently held by one Monokuma. */
export function getDespair(userId) {
    const raw = Number(pools()[userId] ?? 0);
    if (!Number.isFinite(raw)) return 0;
    return Math.min(Math.max(Math.round(raw), 0), despairMax());
}

/** Set one Monokuma's pool. GM only. */
export async function setDespair(userId, value) {
    if (!game.user.isGM) return null;

    // A User object handed to this signature used to be stringified into a
    // "[object Object]" key - a pool no bar could show and only a deleted-user
    // prune could remove. Resolve an id, refuse anything that has none.
    const key = typeof userId === "string" ? userId : userId?.id;
    if (!key) {
        error(`setDespair: not a user id: ${String(userId)}`);
        return null;
    }

    const next = Math.min(Math.max(Math.round(value), 0), despairMax());
    const store = { ...pools(), [key]: next };
    await game.settings.set(MODULE_ID, SETTINGS.despairPools, store);
    return next;
}

/**
 * Add to (or subtract from) a pool.
 *
 * WHAT WILL NOT FIT SPILLS (Z10). `setDespair` clamps at the cap and always
 * has; the difference is that the clamped remainder now goes somewhere. Caught
 * here rather than inside `setDespair` because the two signatures mean
 * different things: this one is INCOME, and an absolute `setDespair(id, 20)` is
 * a GM correcting a number by hand, which should not darken the world.
 */
export async function adjustDespair(userId, delta) {
    /*
     * ONE WRITER (DESP-12). The pools are one world object, written whole from
     * the local cache; two GM clients writing at once - the primary awarding a
     * roll's point while an assistant pays a Call from their own pool - lost
     * one write. An assistant GM's adjustment goes to the primary over the
     * bridge, like a player's reroll correction does, and is applied there.
     */
    if (game.user?.isGM && !isPrimaryGm() && userId) {
        try {
            // `sendDespairToPrimary`, not `requestDespairAdjust` (retired in E08+E28 C8):
            // that one handed a GM straight back here. And no `hasGm` - it was never exported, so asking
            // for it threw and this fell through to writing locally, every time.
            const { sendDespairToPrimary } = await import("./gm-bridge.mjs");
            const { primaryGmId } = await import("./utils.mjs");
            const primary = game.users.get(primaryGmId() ?? "");
            if (primary?.active && primary.id !== game.user.id) {
                void sendDespairToPrimary(userId, delta);
                return Math.min(Math.max(getDespair(userId) + delta, 0), despairMax());
            }
        } catch (err) {
            warn("Could not route a Despair adjustment to the primary GM; writing it here", err);
        }
    }

    const before = getDespair(userId);
    const wanted = before + delta;
    const applied = await setDespair(userId, wanted);

    const max = despairMax();
    if (delta > 0 && wanted > max) {
        try {
            await spillFrom(userId, before, delta, "pool spill");
        } catch (err) {
            // The pool write already landed. A failure to record the spill is
            // worth a line in the log and nothing more - refusing the income
            // over it would be the larger bug.
            warn("Could not send spilled Despair to the overflow", err);
        }
    }

    return applied;
}

/**
 * Fill every Monokuma to maximum. The guide does this when the vote convicts
 * the wrong person: "Each GM (Monokuma) fills their Despair pool to max (12)."
 */
export async function fillAllDespair() {
    if (!game.user.isGM) return null;

    const store = { ...pools() };
    for (const user of monokumas()) store[user.id] = despairMax();
    await game.settings.set(MODULE_ID, SETTINGS.despairPools, store);
    // A full pool owes nothing (E05 C12): what a conversion took is inside the fill.
    await clearOwed();

    log("Every Monokuma's Despair pool filled to maximum.");
    return store;
}

/**
 * Every pool back to nothing, for the season reset.
 *
 * The mirror of `fillAllDespair` above, and deliberately next to it: two
 * functions in one file are much harder to let drift apart than one function
 * and a loop written into the reset.
 *
 * It differs from the mirror in one way. Filling walks the CURRENT Monokumas,
 * because a pool for somebody who is not one has nothing to fill. Zeroing walks
 * every entry in the store, because a pool left behind by somebody who has
 * since left the team is still last season's number - and the next GM handed
 * that role would open the bar on a stranger's Despair.
 *
 * The keys stay. They are the record of who has a pool at all, which belongs to
 * the table the same way `poolNames` and `gmAssignments` do; only the values
 * belong to the season.
 */
export async function zeroAllDespair() {
    if (!game.user.isGM) return null;

    const store = { ...pools() };
    for (const id of Object.keys(store)) if (id !== SETTLED) store[id] = 0;
    for (const user of monokumas()) store[user.id] = 0;
    await game.settings.set(MODULE_ID, SETTINGS.despairPools, store);
    // An empty pool has nothing left to pay (E05 C12).
    await clearOwed();

    log("Every Despair pool emptied.");
    return store;
}

/* ==========================================================================
 * THE OWED DESPAIR (E05 C12, 27.09.2026; audit S09-28)
 * --------------------------------------------------------------------------
 * A conversion to Hope took the donor's pool down at the moment the recipient's
 * Hope went up, and its card spoke as the recipient: the pools are public (D3), so
 * every console could pair the two - a Mastermind kept afloat, a Monocub fuelled,
 * and by which Monokuma. The Hope still comes at once (an actor's resources are
 * world data whatever this does); the pool's drop waits in the GMs' store
 * `despairOwed` and is paid at the next time of day, when every pool may have
 * moved for a dozen public reasons. The card is veiled.
 *
 * Until then the pool shows more than it can spend, for up to one time of day. So
 * every spending path - a Call, another conversion, the pickers that offer either -
 * asks `spendableDespair`, the pool less what it owes, and income that will not fit
 * in a full pool pays what it owes before anything spills, which leaves the pool and
 * the overflow where an immediate drop would have left them. `owedAfter` is that
 * arithmetic, pure (R196); the functions after it are its writers.
 * ========================================================================== */

/**
 * One pool and what it owes, after one thing that moves them. Pure (R196). `held`
 * is `{ pool, owed }`; `event` is
 *   { kind: "income", n }   Despair in (n > 0) or out (n < 0): what will not fit in
 *                           the pool pays what it owes first, and only the rest spills;
 *   { kind: "convert", n }  a conversion to Hope: the pool stands and owes n more;
 *   { kind: "settle" }      the time of day moved on: the pool pays, never below 0.
 * Answers `{ pool, owed, spill }`.
 */
export function owedAfter(held, event, max = despairMax()) {
    const pool = Math.min(Math.max(Math.round(Number(held?.pool) || 0), 0), max);
    const owed = Math.max(Math.round(Number(held?.owed) || 0), 0);
    const n = Math.round(Number(event?.n) || 0);
    switch (event?.kind) {
        case "income": {
            const wanted = pool + n;
            const over = Math.max(wanted - max, 0);
            const paid = Math.min(over, owed);
            return { pool: Math.min(Math.max(wanted, 0), max), owed: owed - paid, spill: over - paid };
        }
        case "convert":
            return { pool, owed: owed + Math.max(n, 0), spill: 0 };
        case "settle":
            return { pool: Math.max(pool - owed, 0), owed: 0, spill: 0 };
        default:
            return { pool, owed, spill: 0 };
    }
}

/*
 * A ROW PER CONVERSION (E05 fix r2-G2, 27.09.2026; review F5). A row's key is the pool's user
 * id, the converting GM's and the moment, `<pool>:<gm>:<ms>`. Until this fix a pool had one
 * row whose absolute `owed` every conversion rewrote from its own GM's reading, so two GMs
 * converting from one pool before either had heard the other kept the newer row, and the
 * other conversion's Hope was never paid for; two rows merge as two. What a pool owes is the
 * sum of its rows. A key without a colon is read as the pool's own.
 */
function poolOfRow(key) {
    return String(key).split(":")[0];
}

function owedRows(userId) {
    return Object.entries(despairOwedStore.entries()).filter(([key]) => poolOfRow(key) === userId);
}

/** What a pool owes and has not paid: a GM's reading; 0 on a player's client, which holds no GM store. */
export function owedOf(userId) {
    if (!game.user?.isGM || !userId) return 0;
    let owed = 0;
    for (const [, row] of owedRows(userId)) {
        const n = Number(row?.owed);
        if (Number.isFinite(n) && n > 0) owed += Math.round(n);
    }
    return owed;
}

/** What a Monokuma can spend now: the pool less what it owes. */
export function spendableDespair(userId) {
    return Math.max(getDespair(userId) - owedOf(userId), 0);
}

/*
 * The time of day a row was recorded in. A row is due once the clock has left it - not at
 * every write of the clock, which `drpgTimeOfDayChanged` follows: an Eclipse's opening is
 * one, and paying then would drop the pool moments after the conversion it hides.
 */
function timeOfDayMark(clock = getClock()) {
    return `${clock?.session ?? 0}.${clock?.day ?? 1}.${clock?.timeOfDay ?? ""}`;
}

/*
 * A conversion's debt, a row of its own in this GM's store and so every GM's, dated this time
 * of day. The read that allowed the conversion waited for the other GMs' rows
 * (`convertDespairToHope`); the write reads nothing.
 */
async function recordOwed(userId, n) {
    await despairOwedStore.patch(`${userId}:${game.user.id}:${Date.now()}`, { owed: n, since: timeOfDayMark() });
}

/*
 * INCOME INTO A FULL POOL PAYS WHAT IT OWES FIRST. `before` is the pool before the income
 * and `n` the income; what is left over after the debt goes to the overflow. Both roads that
 * find a pool full take it: `adjustDespair` and a roll's point (despair-award.mjs), on the
 * primary. The debt is read once the store holds the other GMs' rows (E05 fix r2-G2; review
 * F5, S2-m7): read before, a debt another GM recorded was not paid and its Despair spilled.
 * What is paid comes off the oldest rows first - a row paid whole goes, a row paid in part
 * keeps the rest. Answers `owedAfter`'s result.
 */
export async function spillFrom(userId, before, n, reason) {
    if (!game.user?.isGM) return null;
    await despairOwedStore.whenHydrated();
    const owed = owedOf(userId);
    const next = owedAfter({ pool: before, owed }, { kind: "income", n });
    let left = owed - next.owed;
    const paid = [];
    for (const [key, row] of owedRows(userId).sort(([a], [b]) => despairOwedStore.stampOf(a) - despairOwedStore.stampOf(b))) {
        if (left <= 0) break;
        const has = Math.max(Math.round(Number(row?.owed) || 0), 0);
        if (has <= left) paid.push(key);
        else await despairOwedStore.patch(key, { owed: has - left });
        left -= Math.min(has, left);
    }
    if (paid.length) await despairOwedStore.dropMany(paid);
    if (next.spill > 0) {
        const { addOverflow } = await import("./overflow.mjs");
        await addOverflow(next.spill, { reason });
    }
    return next;
}

/* Every row goes: after a fill or a zero no pool owes anything. */
async function clearOwed() {
    const ids = Object.keys(despairOwedStore.entries());
    if (ids.length) await despairOwedStore.dropMany(ids);
}

/**
 * WHAT A SETTLEMENT PAYS (E05 fix r2-G2, 27.09.2026; review F5), pure (R200). `rows` are the
 * store's entries, `held` the pools' world value with its mark (`SETTLED`), `now` the time of
 * day's mark. A row of this time of day waits. A row of an earlier one is paid when it was
 * recorded in the time of day the last settlement wrote as its mark, or when no settlement
 * has paid anything yet; a row of any other time of day was due at a settlement that has
 * already run, and goes unpaid. That is the row a GM's browser still held because it left
 * before the primary's removal reached it: opened later with nobody to hear from, that GM
 * was the primary, and until this fix paid it a second time - the pools are world data, the
 * rows each GM's own. Every row due goes.
 *
 * What it costs: a conversion recorded on another GM's client in the moment the time of day
 * moves, which the primary had not received when it settled, is dropped unpaid by the next
 * settlement - the pool keeps that Despair rather than paying twice. Not measured at a table.
 * The mark is written with every payment and at every change of the time of day after the
 * first one (`write`); a world that has never paid holds none and needs none.
 *
 * Answers `{ pools, drop, paid, write }`: the world value to write, the rows to drop, how many
 * rows paid, and whether the value is to be written.
 */
export function settlementOf(rows, held, now) {
    const mark = typeof held?.[SETTLED] === "string" ? held[SETTLED] : null;
    const pools = { ...(held ?? {}), [SETTLED]: now };
    const drop = [];
    let paid = 0;
    for (const [key, row] of rows ?? []) {
        if (row?.since === now) continue;
        drop.push(key);
        const userId = poolOfRow(key);
        if (mark !== null && row?.since !== mark) continue;
        if (userId === SETTLED || !Object.hasOwn(pools, userId)) continue;
        pools[userId] = owedAfter({ pool: pools[userId], owed: row?.owed }, { kind: "settle" }).pool;
        paid++;
    }
    return { pools, drop, paid, write: paid > 0 || (mark !== null && mark !== now) };
}

/**
 * THE OWED DESPAIR IS PAID AT THE TIME OF DAY'S CHANGE, on the primary GM - the pools'
 * one writer (DESP-12). What `settlementOf` finds due comes out of its pools in one write of
 * the pools' world value, the mark with it, and then the rows go: in that order, so a moment
 * between the two shows a pool that still owes what it has paid - less to spend - and a
 * settlement run again then finds the mark moved and pays nothing twice. Asked at every write
 * of the clock (`drpgTimeOfDayChanged`, registerDespair) and at the primary's ready, each time
 * once the other GMs' copies arrived or stopped being waited for: a row another GM already
 * settled reaches this one's store as a removal first, and one that does not (a timed-out
 * wait, a browser that was away) is known by the mark. A row of a pool no longer in the store
 * just goes. One settlement at a time, in the order asked (fix r2-G2): the one a write of the
 * clock asks for arrives through `sync.mjs`, whose events are merged over a short window, so
 * whoever writes the clock and then the pools - tier 2's restore - waits on `settleOwed()`
 * itself, which runs after any asked before it. Answers how many rows were paid.
 */
let settling = Promise.resolve(0);

export function settleOwed() {
    const turn = settling.then(settleOnce, settleOnce);
    settling = turn.catch(() => 0);
    return turn;
}

async function settleOnce() {
    if (!isPrimaryGm()) return 0;
    await despairOwedStore.whenHydrated();
    const plan = settlementOf(Object.entries(despairOwedStore.entries()), pools(), timeOfDayMark());
    if (plan.write) await game.settings.set(MODULE_ID, SETTINGS.despairPools, plan.pools);
    if (plan.drop.length) await despairOwedStore.dropMany(plan.drop);
    if (plan.paid) log(`Paid the Despair ${plan.paid} row(s) owed for conversions to Hope.`);
    return plan.paid;
}

/**
 * A donor in a conversion's picker (the GM panel, the Monocub and Mastermind windows):
 * the pool's label and what it can spend, and what it owes when it owes anything.
 */
export function donorLabel(user) {
    const owed = owedOf(user?.id);
    const spendable = spendableDespair(user?.id);
    return owed ? `${poolLabel(user)} (${spendable}, ${plural("DRPG.Despair.owed", { n: owed })})` : `${poolLabel(user)} (${spendable})`;
}

/**
 * Turn a Monokuma's Despair into Hope for somebody else, 1:1.
 *
 * The guide gives this exact exchange to two very different people for two
 * different reasons - a Monocub "prosi DMa" to fuel Meddle, a Mastermind
 * "może prosić DMów… by odnawiać hope" to stay afloat unnoticed - but it is
 * the same trade both times: a GM ruling that moves real Despair out of a
 * real pool, never a self-service button. One function, so both callers stay
 * one honest despair-check away from a duplicate bug.
 *
 * @param {string} monokumaUserId  Whose pool pays.
 * @param {Actor} actor            Who receives the Hope.
 * @param {number} amount          Requested. May be trimmed to what the pool
 *   and the receiver's Hope cap can actually cover.
 * @returns {Promise<number>} Hope actually granted, 0 if none was.
 */
export async function convertDespairToHope(monokumaUserId, actor, amount) {
    if (!game.user.isGM || !actor || amount <= 0) return 0;

    // What the pool can spend, not what it shows: an earlier conversion may still be owed (E05 C12),
    // on this GM's client or another's - read once the store holds the other GMs' rows (fix r2-G2).
    await despairOwedStore.whenHydrated();
    const held = spendableDespair(monokumaUserId);
    if (held < amount) {
        ui.notifications.warn(game.i18n.format("DRPG.Despair.notEnoughPool", {
            held, needed: amount
        }));
        return 0;
    }

    // While the "Despair" darkening runs no Hope can be earned: the actor hook
    // deletes the increase, and this used to take the Despair and report a
    // grant that never landed (DESP-04). Asked before anything is paid.
    const { overflowBlocksHope } = await import("./overflow.mjs");
    if (overflowBlocksHope()) {
        ui.notifications.warn(game.i18n.localize("DRPG.Overflow.hopeBlocked"));
        return 0;
    }

    const { hopeMax } = await import("./calls.mjs");
    const hope = resourceValue(actor, "hope");
    const granted = Math.min(amount, hopeMax(actor) - hope);
    if (granted <= 0) {
        ui.notifications.warn(game.i18n.localize("DRPG.Despair.hopeAlreadyFull"));
        return 0;
    }

    /*
     * THE HOPE NOW, THE POOL AT THE NEXT TIME OF DAY, THE CARD VEILED (E05 C12, 27.09.2026;
     * audit S09-28). The pool went down here, public on every bar, as the recipient's Hope
     * went up, and the card was a whisper spoken by the recipient - a document every console
     * receives. The drop is owed now (`recordOwed`; paid by `settleOwed`), recorded before the
     * Hope so no window redrawn by the Hope's write offers the Despair again, and the card
     * speaks as nobody (secret.mjs).
     */
    await recordOwed(monokumaUserId, granted);
    await automatedUpdate(actor, { "system.resources.hope.value": hope + granted });

    const user = game.users.get(monokumaUserId);
    await whisperToOwner(actor, `<p>${game.i18n.format("DRPG.Despair.hopeConverted", {
        n: granted, who: foundry.utils.escapeHTML(poolLabel(user))
    })}</p>`, { veiled: true });

    log(`Converted ${granted} Despair from ${user?.name} into Hope for ${actor.name}; the pool pays at the next time of day.`);
    return granted;
}

/**
 * Spend Despair on one of the guide's Despair Calls. Refuses when the pool is
 * short, and announces the spend publicly - these are Monokuma's moves.
 *
 * @param {string} userId  Which Monokuma is paying.
 * @param {string} callKey Key from DESPAIR_CALLS.
 * @param {{announce?: boolean}} [options]  `announce: false` leaves the card to
 *   the caller, which posts it after the effect - see the note below.
 */
export async function spendDespairCall(userId, callKey, { announce: post = true } = {}) {
    const call = DESPAIR_CALLS[callKey];
    if (!call) {
        ui.notifications.error(game.i18n.format("DRPG.Despair.unknownCall", { key: callKey }));
        return false;
    }
    // A GM's purchase - see `spendDespairCallFor` (E03; audit S09-11).
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Calls.despairGmOnly"));
        return false;
    }

    // Less what the pool owes for its conversions (E05 C12): that Despair is spent already, and
    // another GM's rows count once they have arrived (fix r2-G2).
    await despairOwedStore.whenHydrated();
    const held = spendableDespair(userId);
    if (held < call.cost) {
        ui.notifications.warn(game.i18n.format("DRPG.Despair.notEnough", {
            call: call.label, cost: call.cost, held
        }));
        return false;
    }

    // The pool has to have moved for the Call to be bought: `adjustDespair`
    // answers null when this client could not write it (E03; audit S09-11).
    const paid = await adjustDespair(userId, -call.cost);
    if (paid === null || paid === undefined) return false;

    /*
     * ONE PURCHASE, ONE CARD, AND IT COMES AFTER THE EFFECT (DESP-11; the review
     * line's CALL-13 found the same).
     *
     * This card used to be posted unconditionally, one line after the pool was
     * charged and BEFORE `applyCall` had run - while `spendDespairCallFor` posted
     * its own public card afterwards with the same label on it. So every Despair
     * Call bought from a sheet posted two cards, the first of them out before
     * anybody knew whether the Call had landed; on a failure the pool is handed
     * back and the Monokuma warned privately, and the table kept a public receipt
     * for a purchase that did not happen. `refusalBeforePaying` turns the common
     * causes away before anything is paid, but it cannot turn away all of them:
     * `applyCall` can still fail, which is why the card waits for it.
     *
     * A FLAG, NOT A SECOND FUNCTION, AND IT DEFAULTS TO TRUE.
     * `game.drpg.spendDespairCall` is a documented API that pays and tells the
     * table, and a bare API spend has no second card to carry the price, so it
     * keeps this one. The sheet's road, `spendDespairCallFor`, passes
     * `announce: false` and posts ONE card after the effect lands, with the
     * effect's receipt lines and this card's price sentence folded into it - the
     * card that has always carried the Blood popup and the despairCall sound.
     */
    if (!post) return true;

    // The announcement must never be able to swallow the effect. Despair has
    // already been paid at this point; if the chat card fails, the caller still
    // has to go on and apply what was bought.
    try {
        const user = game.users?.get?.(userId) ?? game.users?.find?.(u => u.id === userId);
        await announce({
            content: `<h3>${game.i18n.localize("DRPG.Despair.callTitle")}</h3>
                      <p><strong>${foundry.utils.escapeHTML(call.label)}</strong> - ${foundry.utils.escapeHTML(callEffect(call))}</p>
                      <p><em>${game.i18n.format("DRPG.Despair.spent", {
                          // The pool's label, not the account name; and no
                          // "left" - the player rail masks the pool for a
                          // reason, and this card told the room the number.
                          name: foundry.utils.escapeHTML(poolLabel(user) ?? user?.name ?? "?"),
                          cost: call.cost
                      })}</em></p>`
        });
    } catch (err) {
        error("Despair was spent but the announcement failed", err);
    }

    return true;
}

/* ==========================================================================
 * WIDGET
 * ========================================================================== */

/** Build or rebuild the Despair rows. Safe to call repeatedly. */
/**
 * THE NAME COLUMN IS AS WIDE AS THE LONGEST NAME (Dawid, 22.09: "napisy w despair pool nachodza
 * na ikonki i sa przez to uciete").
 *
 * It was a fixed 76 px on the type scale, sized when the names were set smaller: measured on
 * 22.09 at 1920x1080 the column was 65 px and the names needed 71 ("Monokuma") and 80
 * ("Monominie") - cut, and run into the first skull. Fixed was right about one thing, that every
 * row's pips start at the same x, so the column is still one width for every row; it is just
 * the widest name's, read off the names themselves. A name somebody typed at novel length is
 * still stopped by the column's `max-width` and ends in an ellipsis.
 */
function fitNameColumn(wrapper) {
    const names = [...wrapper.querySelectorAll(".drpg-despair-name")];
    if (!names.length) return;
    /* Released first: `scrollWidth` never reads less than the box, so a column set wide by a
       first draw in the fallback face (116 px, measured) would never come back down. */
    wrapper.style.removeProperty("--drpg-despair-name-w");
    void wrapper.offsetWidth;
    const widest = Math.max(...names.map(n => n.scrollWidth));
    if (widest > 0) wrapper.style.setProperty("--drpg-despair-name-w", `${Math.ceil(widest) + 2}px`);
}

export function renderDespairBar() {
    try {
        // the module's own stack on a narrow screen, Foundry's top bar on a desk
        const host = narrowColumn() ?? document.querySelector("#ui-top") ?? document.querySelector("#ui-middle");
        if (!host) return;

        document.getElementById(WIDGET_ID)?.remove();

        const gms = monokumas();
        if (!gms.length) return;

        const wrapper = document.createElement("div");
        wrapper.id = WIDGET_ID;
        wrapper.classList.toggle("single", gms.length === 1);
        wrapper.classList.toggle("gm-editable", game.user.isGM);
        // Players keep the bar but not the numbers - see `buildRow`.
        // `masked` used to hide the pips from a player; the count is public since D3.
        wrapper.classList.remove("masked");

        /*
         * A HEADING, BECAUSE THE ROWS DO NOT SAY WHAT THEY ARE.
         *
         * Each row carries a pool's name, so a strip of numbers at the top of
         * the screen was identifiable only to somebody who already knew what
         * it was. One line in the same pixel type as the
         * rest of the HUD beside it.
         *
         * It is inside the wrapper rather than above it because the wrapper is
         * what gets removed and rebuilt, and a heading outside would outlive
         * the thing it titles. There is no "no pools" case to hide for: this
         * function has already returned when there are no Monokumas.
         */
        const heading = document.createElement("div");
        heading.className = "drpg-despair-title";
        heading.textContent = game.i18n.localize("DRPG.Despair.widgetTitle");
        wrapper.append(heading);

        for (const user of gms) wrapper.append(buildRow(user));

        // UNDER THE POOLS (Dawid, 29.08). It reads as the consequence of the
        // rows above it rather than as a heading for them, which is what it is:
        // the pools are what the Monokumas hold, and this is what would not fit.
        const caption = buildOverflowCaption();
        if (caption) wrapper.append(caption);

        wrapper.addEventListener("pointerdown", event => event.stopPropagation());
        host.append(wrapper);
        fitNameColumn(wrapper);
        // Measured again once the pixel face is in: a first draw in the fallback font is narrower.
        document.fonts?.ready?.then(() => { if (wrapper.isConnected) fitNameColumn(wrapper); });

        /*
         * PUBLISH THIS PANEL'S HEIGHT, AND NOTHING ELSE.
         *
         * `matchStripToDespair` writes it to `--drpg-despair-height`, which the
         * player's status strip matches. That has to happen here because the
         * overflow caption is a row this panel grew, and until now the widget
         * could be rebuilt without anything being told - which did not matter
         * while its height only changed when a Monokuma was added.
         *
         * THE RIGHT-HAND RAIL IS DELIBERATELY NOT RE-ALIGNED FROM HERE, and the
         * first version of this was wrong to do it. `alignRightColumn` hangs the
         * rail off this panel's TOP, which does not move when the panel grows
         * downward - so there was nothing to recompute. What it does do on the
         * way is `clearSceneList`, which measures the clock and rewrites a
         * column margin; calling that on every redraw of the Despair widget
         * churns the page layout continuously, because this widget redraws on
         * every pool change.
         *
         * MEASURED, BY BISECT. v1.1.79 runs the suite 106/106; with this call in
         * place it was 105/1 twice, and the casualty was "no piece of a room's
         * outline is shorter than the line it is drawn with" - a canvas test
         * catching the outline mid-rebuild, a hundred lines away from anything
         * this feature is about. A layout write is not free just because it is
         * idempotent.
         *
         * Imported late rather than at the top: hud.mjs reaches into this file
         * to redraw the bar, and a static import back would close that circle
         * for one measurement.
         */
        import("./hud.mjs").then(m => m.matchStripToDespair()).catch(() => {});
    } catch (err) {
        error("Could not render the Despair tracker", err);
    }
}

/**
 * "Despair overflow · 7/20", above the pools that feed it.
 *
 * THE VEIL IS ONE CHARACTER WIDE AND HONEST ABOUT ITSELF. A player sees "?"
 * where the count would be; the threshold is public, because knowing the world
 * can get worse at twenty is part of playing in it, and not knowing how close
 * it is happens to be the whole tension. That asymmetry is a courtesy rather
 * than a secret: the counter is a WORLD setting, so a determined player can
 * read it from their own console exactly as they could read a stash flag. It
 * is drawn this way because a table plays better without the number on screen,
 * not because the number could be protected - and nothing about the
 * investigation lives in it either way. The popup says so in as many words.
 *
 * ALWAYS DRAWN, and the first version of this was wrong to hide itself while
 * the counter sat at zero. Two reasons it is permanent now. Dawid asked for a
 * standing caption on the pool window - X is public precisely so the table can
 * see what it is playing against before anything happens. And a row that comes
 * and goes changes this panel's height mid-session, which moves the status
 * strip and the right-hand rail with it: the "equal heights and margins across
 * the canvas" this feature was supposed to preserve, broken by the feature.
 *
 * The `is-active` state is what has to catch an eye that was not looking, and
 * it can do that without the row appearing out of nowhere to do it.
 */
function buildOverflowCaption() {
    try {
        const { count, threshold, active } = overflowStatus();
        const isGM = game.user.isGM;
        const line = document.createElement("div");
        line.className = `drpg-overflow-caption${active ? " is-active" : ""}`;
        line.classList.toggle("masked", !isGM);

        const shown = isGM ? String(count) : game.i18n.localize("DRPG.Overflow.hiddenValue");
        line.textContent = `${game.i18n.localize("DRPG.Overflow.caption")} · ${shown}/${threshold}`;
        // Two GM sentences, not one: while a darkening is running, "fires at
        // the next boundary" is the wrong half of the truth and the tooltip was
        // saying it over a caption that already read "Darkened".
        // And a third: a darkened time of day holds a full counter back until it
        // ends (CALL-06), and a caption at 20/20 with no card needs to say so.
        line.title = isGM
            ? game.i18n.format(active
                ? (count >= threshold ? "DRPG.Overflow.gmHintActiveFull" : "DRPG.Overflow.gmHintActive")
                : "DRPG.Overflow.gmHint", { count, max: threshold })
            : game.i18n.format("DRPG.Overflow.playerHint", { max: threshold });

        if (active) {
            const badge = document.createElement("span");
            badge.className = "drpg-overflow-badge";
            // WHICH darkening, not only that one runs (DESP-17): the card at
            // the boundary was the only place the name appeared.
            const name = overflowStatus().effectName;
            badge.textContent = name
                ? `${game.i18n.localize("DRPG.Overflow.activeNow")} · ${name}`
                : game.i18n.localize("DRPG.Overflow.activeNow");
            line.append(" ", badge);
        }

        return line;
    } catch (err) {
        // The bar is more important than the caption on it.
        error("Could not draw the Despair overflow caption", err);
        return null;
    }
}

function buildRow(user) {
    const held = getDespair(user.id);
    const max = despairMax();
    const isGM = game.user.isGM;
    const isOwnPool = game.user.id === user.id;

    // Everyone has a reading now (D3): the pool's count is shown on every
    // client, so the pips that were just paid animate on every client too.
    // Only the OVERFLOW stays masked for a player - see `renderOverflowCaption`.
    const spent = spentSince("despair", user.id, held);

    const row = document.createElement("div");
    row.className = "drpg-despair-row";
    row.dataset.userId = user.id;

    /*
     * THE POOL'S NAME, EVEN WHEN IT IS THE ONLY POOL (24.09.2026, reported from a
     * table). A lone pool used to read "Despair", on the reasoning that one row
     * needs no telling apart. But the name is the Monokuma's, set by the GM in
     * Despair Flow for the table to see, and a table that went from two GMs to
     * one watched it turn into the generic word overnight - which looked like
     * a regression, and was a rule nobody had asked for. With no name set, the
     * account's name stands in, as it always has with two.
     */
    const name = document.createElement("span");
    name.className = "drpg-despair-name";
    name.textContent = poolLabel(user);
    // Deliberately NOT that user's own Foundry account colour - every
    // Monokuma pool reads as the same purple regardless of whichever
    // colour a GM happened to pick for their account. Two rows are told
    // apart by name, not by borrowing account theming into game UI.
    row.append(name);

    const pips = document.createElement("div");
    pips.className = "drpg-despair-pips";

    for (let i = 1; i <= max; i++) {
        const pip = document.createElement("span");
        // THE READING IS PUBLIC (D3, Dawid 13.09). The bar used to show a
        // player question marks - "you will see its effects, not the table" -
        // and the table could not tell what its own Despair rolls were feeding.
        // The count is shown to everyone now; what stays hidden is the
        // overflow: when the hat fires is still Monokuma's to know.
        pip.className = `drpg-despair-pip${i <= held ? " filled" : ""}`;
        // The pips between the old reading and the new one: the ones that were
        // just paid. They are built empty, like every other unspent socket, and
        // the class only says how they got that way. See the keyframes in the
        // stylesheet.
        markSpent(pip, spent, i);
        pip.dataset.value = String(i);

        if (isGM) {
            const label = game.i18n.format("DRPG.Despair.pipTooltip", { n: i, name: poolLabel(user) });
            pip.dataset.tooltip = label;
            // Same reasoning as the action pips on the sheet: a `<span>` with a
            // click handler cannot be reached from the keyboard, and this is the
            // control a GM uses most.
            pip.tabIndex = 0;
            pip.setAttribute("role", "button");
            pip.setAttribute("aria-label", label);
            const set = () => setDespair(user.id, i === held ? i - 1 : i);
            pip.addEventListener("click", set);
            pip.addEventListener("keydown", event => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                set();
            });
        }
        pips.append(pip);
    }
    row.append(pips);

    const count = document.createElement("span");
    count.className = "drpg-despair-count";
    count.textContent = `${held}/${max}`;
    row.append(count);

    /*
     * THE STEPPERS ARE BUILT FOR EVERYONE, AND ONLY A GM CAN SEE THEM.
     *
     * Dawid, 29.08: the Despair panel and the action strip must be the same
     * size on a GM's screen and on a player's. They were not, and this is the
     * whole of the difference - the panel is `width: max-content`, so two
     * buttons that exist on one client and not on the other make the box two
     * buttons narrower there, and the status strip opposite it takes its height
     * from this panel (`matchStripToDespair`), so the second box inherited the
     * first one's disagreement.
     *
     * `visibility: hidden` and not `display: none`: the point is to keep the
     * space. They are also `disabled` and out of the tab order, and no handler
     * is attached on a player's client - a hidden button that still works would
     * be a considerably worse bug than a panel of the wrong width.
     */
    const ghost = !isGM;
    row.append(
        stepper("fa-minus", () => adjustDespair(user.id, -1), held <= 0, ghost,
            game.i18n.localize("DRPG.Look.stepDown")),
        stepper("fa-plus", () => adjustDespair(user.id, +1), held >= max, ghost,
            game.i18n.localize("DRPG.Look.stepUp"))
    );
    if (isGM && isOwnPool) row.classList.add("own");

    return row;
}

function stepper(icon, handler, disabled, ghost = false, label = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `drpg-despair-button${ghost ? " is-ghost" : ""}`;
    button.disabled = disabled || ghost;
    button.innerHTML = `<i class="fa-solid ${icon}" inert></i>`;
    /* A GLYPH IS NOT A NAME. These four were the module's only icon-only controls
       with nothing to read out or hover (audit, 08.09): a plus and a minus beside a
       Monokuma's count, which is a number a GM changes under time pressure. The two
       strings already existed for the Look window's own steppers. */
    if (label) {
        button.dataset.tooltip = label;
        button.setAttribute("aria-label", label);
    }

    // A shape, not a control. See `buildRow`.
    if (ghost) {
        button.tabIndex = -1;
        button.setAttribute("aria-hidden", "true");
        return button;
    }

    button.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        await handler();
    });
    return button;
}

export { WIDGET_ID };
