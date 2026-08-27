/**
 * Danganronpa RPG — Despair pools, one per Monokuma.
 * ---------------------------------------------------------------------------
 * Guide: "There are at least two GMs. […] Each GM has their own Despair pool —
 * a maximum of 12 per GM."
 *
 * Daggerheart only models a single shared Fear pool, so this replaces its
 * tracker with one row per full Gamemaster. Assistant GMs are deliberately
 * excluded: they are helpers, not Monokumas, and the guide gives Despair only
 * to the two people running the killing game.
 *
 * Pools are public. When Monokuma spends Despair the table is meant to see it.
 */

import { MODULE_ID, STARTING, DESPAIR_CALLS, callEffect } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { resourceValue } from "./character.mjs";
import { automatedUpdate } from "./resource-guard.mjs";
import { announce, whisperToOwner, log, error, isPrimaryGm } from "./utils.mjs";
import { spentSince, markSpent } from "./motion.mjs";

const WIDGET_ID = "drpg-despair";

export function registerDespair() {
    Hooks.once("ready", () => {
        renderDespairBar();
        // The store outlives its authors: worlds carry entries for accounts
        // long deleted and, in one measured case, a "[object Object]" key an
        // old caller once wrote. `deleteUser` was the only broom, so junk that
        // arrived any other way stayed for the life of the world — a sweep at
        // ready clears it. Primary GM only: one writer, no race between GMs.
        if (isPrimaryGm()) {
            prunePools().catch(err => error("Could not prune the Despair pools at ready", err));
        }
    });
    Hooks.on("canvasReady", () => renderDespairBar());
    // Keep every client's rows in step when a pool changes.
    Hooks.on("userConnected", () => renderDespairBar());
    // A row is one full Gamemaster. Promoting a player, demoting a GM or
    // renaming one all change the roster, and none of them fired anything —
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
 * Assistant GM explicitly granted one — see `extraPoolUserIds`.
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
 * Assistant GM — a full Gamemaster's pool is the guide's rule, not a setting,
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
 * name is not always what the table calls that Monokuma — two GMs literally
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

/** The label to show for this pool — custom if set, the account name otherwise. */
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
    // "[object Object]" key — a pool no bar could show and only a deleted-user
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

/** Add to (or subtract from) a pool. */
export async function adjustDespair(userId, delta) {
    return setDespair(userId, getDespair(userId) + delta);
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
 * since left the team is still last season's number — and the next GM handed
 * that role would open the bar on a stranger's Despair.
 *
 * The keys stay. They are the record of who has a pool at all, which belongs to
 * the table the same way `poolNames` and `gmAssignments` do; only the values
 * belong to the season.
 */
export async function zeroAllDespair() {
    if (!game.user.isGM) return null;

    const store = { ...pools() };
    for (const id of Object.keys(store)) store[id] = 0;
    for (const user of monokumas()) store[user.id] = 0;
    await game.settings.set(MODULE_ID, SETTINGS.despairPools, store);

    log("Every Despair pool emptied.");
    return store;
}

/**
 * Turn a Monokuma's Despair into Hope for somebody else, 1:1.
 *
 * The guide gives this exact exchange to two very different people for two
 * different reasons — a Monocub "prosi DMa" to fuel Meddle, a Mastermind
 * "może prosić DMów… by odnawiać hope" to stay afloat unnoticed — but it is
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

    const held = getDespair(monokumaUserId);
    if (held < amount) {
        ui.notifications.warn(game.i18n.format("DRPG.Despair.notEnoughPool", {
            held, needed: amount
        }));
        return 0;
    }

    const { hopeMax } = await import("./calls.mjs");
    const hope = resourceValue(actor, "hope");
    const granted = Math.min(amount, hopeMax(actor) - hope);
    if (granted <= 0) {
        ui.notifications.warn(game.i18n.localize("DRPG.Despair.hopeAlreadyFull"));
        return 0;
    }

    await adjustDespair(monokumaUserId, -granted);
    await automatedUpdate(actor, { "system.resources.hope.value": hope + granted });

    const user = game.users.get(monokumaUserId);
    await whisperToOwner(actor, `<p>${game.i18n.format("DRPG.Despair.hopeConverted", {
        n: granted, who: foundry.utils.escapeHTML(poolLabel(user))
    })}</p>`);

    log(`Converted ${granted} Despair from ${user?.name} into Hope for ${actor.name}.`);
    return granted;
}

/**
 * Spend Despair on one of the guide's Despair Calls. Refuses when the pool is
 * short, and announces the spend publicly — these are Monokuma's moves.
 *
 * @param {string} userId  Which Monokuma is paying.
 * @param {string} callKey Key from DESPAIR_CALLS.
 */
export async function spendDespairCall(userId, callKey) {
    const call = DESPAIR_CALLS[callKey];
    if (!call) {
        ui.notifications.error(game.i18n.format("DRPG.Despair.unknownCall", { key: callKey }));
        return false;
    }

    const held = getDespair(userId);
    if (held < call.cost) {
        ui.notifications.warn(game.i18n.format("DRPG.Despair.notEnough", {
            call: call.label, cost: call.cost, held
        }));
        return false;
    }

    await adjustDespair(userId, -call.cost);

    // The announcement must never be able to swallow the effect. Despair has
    // already been paid at this point; if the chat card fails, the caller still
    // has to go on and apply what was bought.
    try {
        const user = game.users?.get?.(userId) ?? game.users?.find?.(u => u.id === userId);
        await announce({
            content: `<h3>${game.i18n.localize("DRPG.Despair.callTitle")}</h3>
                      <p><strong>${foundry.utils.escapeHTML(call.label)}</strong> — ${foundry.utils.escapeHTML(callEffect(call))}</p>
                      <p><em>${game.i18n.format("DRPG.Despair.spent", {
                          name: foundry.utils.escapeHTML(user?.name ?? "?"),
                          cost: call.cost,
                          left: getDespair(userId)
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
export function renderDespairBar() {
    try {
        const host = document.querySelector("#ui-top") ?? document.querySelector("#ui-middle");
        if (!host) return;

        document.getElementById(WIDGET_ID)?.remove();

        const gms = monokumas();
        if (!gms.length) return;

        const wrapper = document.createElement("div");
        wrapper.id = WIDGET_ID;
        wrapper.classList.toggle("single", gms.length === 1);
        wrapper.classList.toggle("gm-editable", game.user.isGM);
        // Players keep the bar but not the numbers — see `buildRow`.
        wrapper.classList.toggle("masked", !game.user.isGM);

        /*
         * A HEADING, BECAUSE THE ROWS DO NOT SAY WHAT THEY ARE.
         *
         * Each row carries a pool's name or a generic label, so a strip of
         * numbers at the top of the screen was identifiable only to somebody
         * who already knew what it was. One line in the same pixel type as the
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

        for (const user of gms) wrapper.append(buildRow(user, gms.length > 1));

        wrapper.addEventListener("pointerdown", event => event.stopPropagation());
        host.append(wrapper);
    } catch (err) {
        error("Could not render the Despair tracker", err);
    }
}

function buildRow(user, showName) {
    const held = getDespair(user.id);
    const max = despairMax();
    const isGM = game.user.isGM;
    const isOwnPool = game.user.id === user.id;

    // Only a GM has a reading to lose. A player's bar is question marks by
    // design (see the note on the pips below), so there is nothing to confirm
    // and nothing to give away by confirming it — which is also why this is not
    // even asked on their client: `spentSince` records as it reads, and a
    // player recording a pool they cannot see would be keeping a copy of the
    // one number this bar exists to withhold.
    const spent = isGM ? spentSince("despair", user.id, held) : null;

    const row = document.createElement("div");
    row.className = "drpg-despair-row";
    row.dataset.userId = user.id;

    if (showName) {
        const name = document.createElement("span");
        name.className = "drpg-despair-name";
        name.textContent = poolLabel(user);
        // Deliberately NOT that user's own Foundry account colour — every
        // Monokuma pool reads as the same purple regardless of whichever
        // colour a GM happened to pick for their account. Two rows are told
        // apart by name, not by borrowing account theming into game UI.
        row.append(name);
    } else {
        const label = document.createElement("span");
        label.className = "drpg-despair-name";
        label.textContent = game.i18n.localize("DRPG.Despair.label");
        row.append(label);
    }

    const pips = document.createElement("div");
    pips.className = "drpg-despair-pips";

    for (let i = 1; i <= max; i++) {
        const pip = document.createElement("span");
        // "You will not see that table. You will see its effects." — Player
        // Handbook, p. 12. The bar stays (a player should know the Monokumas
        // have a currency and roughly how big it can get) but the reading does
        // not: every pip renders as a question mark and none of them is marked
        // `filled`, so counting the DOM gives nothing away either.
        //
        // Not a secrecy mechanism, and it is not pretending to be one: the pool
        // is a world setting, so a determined player can still read it from the
        // console (see the note on world-scoped data in settings.mjs). This is
        // about not putting the answer on screen unasked.
        pip.className = `drpg-despair-pip${isGM && i <= held ? " filled" : ""}`;
        // The pips between the old reading and the new one: the ones that were
        // just paid. They are built empty, like every other unspent socket, and
        // the class only says how they got that way. See the keyframes in the
        // stylesheet.
        markSpent(pip, spent, i);
        pip.dataset.value = String(i);

        if (isGM) {
            const label = game.i18n.format("DRPG.Despair.pipTooltip", { n: i, name: user.name });
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
    // The cap is public — the handbook prints it — so only the reading is hidden.
    count.textContent = isGM ? `${held}/${max}` : `?/${max}`;
    row.append(count);

    if (isGM) {
        row.append(
            stepper("fa-minus", () => adjustDespair(user.id, -1), held <= 0),
            stepper("fa-plus", () => adjustDespair(user.id, +1), held >= max)
        );
        if (isOwnPool) row.classList.add("own");
    }

    return row;
}

function stepper(icon, handler, disabled) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "drpg-despair-button";
    button.disabled = disabled;
    button.innerHTML = `<i class="fa-solid ${icon}" inert></i>`;
    button.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        await handler();
    });
    return button;
}

export { WIDGET_ID };
