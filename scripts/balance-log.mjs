/**
 * Danganronpa RPG - the balance log: what the table's rolls did, kept for the owner's balance questions.
 * ---------------------------------------------------------------------------
 * E53 C3 (15.11.2026; the plan's item 3; Q-E53-3, the owner's answer of 15.11.2026: "behind a world switch, off by
 * default, recording only, no rule number changes" - D21). Nothing here tunes a number: it records, and
 * `balanceReport()` reads what was recorded beside the exact count of what the dice should give.
 *
 * WHAT IS RECORDED, while the world setting `balanceLog` is on, on the primary GM alone:
 *   - `roll`: each action roll the primary GM drew (roll-draw.mjs, after the GMs' record of it is written): the action,
 *     the statistic, the total, the Hope and Fear dice, the critical, the flat modifiers' sum and the advantage die
 *     (its faces and sign), and when in the chapter it was thrown. A roll not drawn on the GM (no GM connected, an item
 *     roll) is not in it - the log holds what the GMs hold.
 *   - `note`: a GM's own entry (`game.drpg.balanceNote(text)`), for what the session's protocol asks that no roll says.
 * The rules' before and after (D21b) are docs/balance.md's, beside E64's table: they are the repository's, not a world's.
 *
 * WHERE: a GM store (gm-stores.mjs `balanceLogStore`): every GM holds it, no player's browser does, it goes with the
 * case's backup and no season's reset cuts it (a season's data is what sessions 0 compare). The canary (72) scans every
 * player's browser and world data for what the GMs hold; the store is in neither.
 *
 * THE EXACT COUNT (the coordinator's Q9, 15.11.2026): what a roll should give is counted over every throw of the two d12
 * - 144, times the advantage die's faces where one was thrown - not sampled. A critical is matching Hope and Fear dice,
 * and a success whatever the total; Hope is the Hope die higher, Fear the Fear die higher. `exactCount` is pure, and
 * R7407 holds it to E64's own counts (a first tier at 11: 104 of 144; at 12: 94 of 144).
 */

import { ACTIONS } from "./config.mjs";
import { SETTINGS, getSetting, getClock } from "./settings.mjs";
import { isPrimaryGm, log } from "./utils.mjs";
import { balanceLogStore } from "./gm-stores.mjs";

/** Under this many rolls an action's line says it is too few to read, not a rate (the proposal's floor, 15.11.2026). */
export const BALANCE_FLOOR = 20;

/** The longest note a GM's entry keeps. */
const NOTE_MAX = 2000;

/** Whether the world's switch is on. Off on any read that fails: the log records only when a GM said so. */
export function balanceLogOn() {
    try { return getSetting(SETTINGS.balanceLog) === true; } catch { return false; }
}

/**
 * The row a drawn roll's record (roll-draw.mjs `keepRecord`'s) is kept as. The two d12 are the Hope and Fear dice; a
 * die of other faces is the advantage die, its sign read off the total (positive for advantage, negative for
 * disadvantage). Pure.
 */
export function balanceRowOf(record, clock = getClock()) {
    const hope = Number(record?.hope) || 0, fear = Number(record?.fear) || 0, total = Number(record?.total) || 0;
    const flat = (Array.isArray(record?.modifiers) ? record.modifiers : []).reduce((sum, n) => sum + (Number(n) || 0), 0);
    const other = (Array.isArray(record?.dice) ? record.dice : []).find(die => Number(die?.faces) !== 12);
    const rest = total - hope - fear - flat;
    const adv = other && rest !== 0 ? { faces: Number(other.faces) || 0, sign: Math.sign(rest) } : null;
    return {
        kind: "roll", at: Number(record?.at) || Date.now(),
        chapter: clock?.chapter ?? null, day: clock?.day ?? null, timeOfDay: clock?.timeOfDay ?? null,
        actionKey: typeof record?.actionKey === "string" ? record.actionKey : null,
        trait: typeof record?.trait === "string" ? record.trait : null,
        total, hope, fear, flat, adv,
        critical: Boolean(record?.isCritical), withHope: Boolean(record?.withHope), withFear: Boolean(record?.withFear)
    };
}

/** Keep a drawn roll, on the primary GM while the switch is on. Answers whether a row was written. */
export async function noteBalanceRoll(record) {
    if (!record?.rollId || !isPrimaryGm() || !balanceLogOn()) return false;
    await balanceLogStore.patch(`r:${record.rollId}`, balanceRowOf(record));
    return true;
}

/** `game.drpg.balanceNote(text)`: a GM's own entry, kept while the switch is on. Answers the row's key, or null. */
export async function balanceNote(text) {
    if (!game.user?.isGM || !balanceLogOn()) return null;
    const words = String(text ?? "").trim().slice(0, NOTE_MAX);
    if (!words) return null;
    const clock = getClock();
    const key = `n:${foundry.utils.randomID(12)}`;
    await balanceLogStore.patch(key, { kind: "note", at: Date.now(), chapter: clock?.chapter ?? null, text: words, by: game.user.id });
    return key;
}

/** The total an action's roll must reach to land at all: its first band's `min`, else its `dc`; null for neither. */
export function thresholdOf(actionKey) {
    const def = ACTIONS[actionKey];
    const min = Array.isArray(def?.thresholds) ? Number(def.thresholds[0]?.min) : NaN;
    if (Number.isFinite(min)) return min;
    return Number.isFinite(Number(def?.dc)) ? Number(def.dc) : null;
}

/**
 * Every throw of the two d12 (and the advantage die, where there is one) counted: `{ throws, hit, critical, hope, fear }`,
 * `hit` null where there is no threshold. A critical (matching dice) is a hit whatever the total. Pure.
 */
export function exactCount({ flat = 0, adv = null, threshold = null } = {}) {
    const faces = adv && Number(adv.faces) > 0 ? Number(adv.faces) : 0;
    const sign = adv ? Math.sign(Number(adv.sign) || 0) : 0;
    let throws = 0, hit = 0, critical = 0, hope = 0, fear = 0;
    for (let h = 1; h <= 12; h++) {
        for (let f = 1; f <= 12; f++) {
            for (let a = faces ? 1 : 0; a <= faces; a++) {
                throws++;
                const crit = h === f;
                if (crit) critical++;
                else if (h > f) hope++;
                else fear++;
                if (threshold !== null && (crit || h + f + flat + sign * a >= threshold)) hit++;
            }
        }
    }
    return { throws, hit: threshold === null ? null : hit, critical, hope, fear };
}

const pct = x => `${(Math.round(x * 1000) / 10).toFixed(1)}%`;

/**
 * The report's lines from the log's rows (pure): one an action, its rolls counted - the hits against the exact count's
 * rate for the same modifiers, the Hope, Fear and critical split against theirs - or "too few to read" under `floor`;
 * then every roll together, and the notes counted.
 */
export function balanceLines(rows, { floor = BALANCE_FLOOR } = {}) {
    const rolls = (rows ?? []).filter(row => row?.kind === "roll");
    const notes = (rows ?? []).filter(row => row?.kind === "note");
    const lines = [];
    const byAction = new Map();
    for (const row of rolls) {
        const key = row.actionKey ?? "(no action)";
        if (!byAction.has(key)) byAction.set(key, []);
        byAction.get(key).push(row);
    }
    const split = group => {
        const seen = { hope: 0, fear: 0, critical: 0 }, want = { hope: 0, fear: 0, critical: 0 };
        for (const row of group) {
            if (row.critical) seen.critical++;
            else if (row.withHope) seen.hope++;
            else if (row.withFear) seen.fear++;
            const c = exactCount({ flat: row.flat, adv: row.adv });
            for (const k of ["hope", "fear", "critical"]) want[k] += c[k] / c.throws;
        }
        const n = group.length;
        return `Hope ${seen.hope}, Fear ${seen.fear}, critical ${seen.critical} (exact count: ${pct(want.hope / n)}, ${pct(want.fear / n)}, ${pct(want.critical / n)})`;
    };
    lines.push(`Rolls the GMs drew while the log was on: ${rolls.length}; notes: ${notes.length}.`);
    for (const [key, group] of [...byAction].sort((a, b) => a[0].localeCompare(b[0]))) {
        if (group.length < floor) {
            lines.push(`  ${key}: ${group.length} roll(s) - too few to read (fewer than ${floor})`);
            continue;
        }
        const threshold = thresholdOf(key);
        let hitLine = "no fixed difficulty to land at";
        if (threshold !== null) {
            let hits = 0, want = 0;
            for (const row of group) {
                if (row.critical || row.total >= threshold) hits++;
                const c = exactCount({ flat: row.flat, adv: row.adv, threshold });
                want += c.hit / c.throws;
            }
            hitLine = `landed ${hits} (${pct(hits / group.length)}) at ${threshold} or a critical, against ${pct(want / group.length)} by the exact count`;
        }
        lines.push(`  ${key}: ${group.length} rolls - ${hitLine}; ${split(group)}`);
    }
    if (rolls.length >= floor) lines.push(`  every roll: ${split(rolls)}`);
    return lines;
}

/**
 * `game.drpg.balanceReport()`: the log read against the exact count, on a GM. Answers the text (and logs it); says so
 * when the switch is off or nothing was recorded. Reads, never writes.
 */
export async function balanceReport() {
    if (!game.user?.isGM) return "The balance log is the GMs': a player's browser holds none of it.";
    await balanceLogStore.whenHydrated();
    const rows = Object.values(balanceLogStore.entries() ?? {});
    const head = [`Danganronpa RPG - the balance log (${balanceLogOn() ? "recording" : "off: nothing new is recorded"})`];
    const text = [...head, ...balanceLines(rows)].join("\n");
    log(`\n${text}`);
    return text;
}
