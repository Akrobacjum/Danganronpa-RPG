/**
 * Danganronpa RPG - the killing game's rules.
 * ---------------------------------------------------------------------------
 * Monokuma's standing rules: the ones announced at the start, and every one
 * bought since with the "New Rule" Despair Call (priced in DESPAIR_CALLS).
 *
 * Until now that Call posted its rule to chat and the module forgot it. A rule
 * that scrolls out of the log is a rule nobody can be held to - and being held
 * to them is the entire point of a killing game. So they live in world state
 * and get a permanent home on every character sheet, in the slot Daggerheart
 * uses for Effects (a tab for magical conditions this game does not have).
 *
 * WORLD-SCOPED, AND THAT IS CORRECT. Unlike the Truth Bullet ledger or the
 * Mastermind, these are the opposite of secret: a rule exists so that everybody
 * knows it. See D6 - world data reaches every client, which is exactly what is
 * wanted here.
 */

import { MODULE_ID, MOTIVE } from "./config.mjs";
import { cardWarn } from "./chat-card.mjs";
import { SETTINGS, seasonEpoch, sameSeason } from "./settings.mjs";
import { getClock } from "./clock.mjs";
import { announce, log, error, plural, esc} from "./utils.mjs";
import { drpgWindow, tipAttr, tipText } from "./ui-kit.mjs";
import { alreadyOpen, RAISED, keepLive } from "./live.mjs";
// The Monokuma Motive's hidden words, its outcomes and its reward (2.0 line T5): motives.mjs reaches nothing that reaches
// this file (R161), and gm-stores.mjs the store the manager's read-out watches.
import { hiddenMonokumaWords, keepHiddenMonokumaWords, keepMonokumaOutcome, rewardMonokumaMotive } from "./motives.mjs";
import { motiveStore } from "./gm-stores.mjs";
// A leaf (season-exceptions.mjs alone): the registry of season state the reset walks (E42 C3).
import { registerSeasonState } from "./season-reset.mjs";

/* ==========================================================================
 * READING
 * ========================================================================== */

/**
 * Every standing rule, in the order they were introduced.
 *
 * Shape: `{ id, text, chapter, at }`. The chapter stamp is what lets the table
 * say "that came in after the second trial", which matters when a rule is the
 * reason somebody is about to die.
 */
export function rules() {
    try {
        const stored = game.settings.get(MODULE_ID, SETTINGS.killingGameRules);
        return Array.isArray(stored) ? stored : [];
    } catch {
        return [];
    }
}

/* ==========================================================================
 * THE MONOKUMA MOTIVE
 * --------------------------------------------------------------------------
 * 2.0 line T5, D2-23 and D2-24 (the owner, 27.11.2026; docs/dev/v2/SPEC-MOTIVES.md, scripts/motives.mjs's header).
 * The class's goal, always about working together, bought with the Despair Call "Monokuma Motive": one at a time (#4),
 * public, or hidden - the players see that there is one and not what it says (#2) - with a deadline only when the GM
 * gives one (#5) and a penalty that is the Monokuma's words, carried out by hand (#1). Changing or withdrawing it asks
 * whether the last one was passed; a pass gives every living student 3 Hope (motives.mjs `rewardMonokumaMotive`), and
 * the outcome is kept for the chapter's Level Up list (`keepMonokumaOutcome`).
 *
 * Until 2.0 this block was Monokuma's Motive of the guide's p. 16, "powód roleplayowy do zabijania", with a demand, a
 * deadline of 1-10 times of day and a consequence, in the world setting `motive`. The owner retired it (#9: "znika");
 * migrate.mjs `oldMotiveGone` tells the GMs what an old one in force said and clears the key. The names `motive`,
 * `setMotive`, `tickMotive`, `untickMotive` and `announceOwedMotive` stay, for their callers (clock.mjs,
 * murder-rules.mjs, call-effects.mjs) and for the record's shape below.
 *
 * WHAT EVERY BROWSER HOLDS. The world setting `monokumaMotive` (SETTINGS.monokumaMotive): `{ id, hidden, text, penalty,
 * timesOfDay, remaining, chapter, epoch, at, dueAnnounced, heldIn, heldRemaining, dueToldIn }`, `timesOfDay` null for no
 * deadline. A hidden one's `text` and `penalty` are empty there, and its words stand in the GMs' store alone (motives.mjs
 * `keepHiddenMonokumaWords`; world-secrets.mjs, the rule `motives`). Stamped with its chapter and its season, so it
 * lapses on its own when the chapter turns or a reset starts a new season (R356).
 * ========================================================================== */

/**
 * The Monokuma Motive in force this chapter, as every browser may read it, or null. `due` and `deadline` are derived:
 * `deadline` whether the GM gave one, `due` whether it has run out.
 */
export function motive() {
    try {
        const stored = game.settings.get(MODULE_ID, SETTINGS.monokumaMotive) ?? {};
        if (!stored.id) return null;
        // Expired by arithmetic rather than by a cleanup pass, and of this season (E11 C12): a reset that keeps the
        // motive starts the clock at chapter 1 again, where last season's chapter-1 motive read as in force.
        if (stored.chapter !== getClock().chapter || !sameSeason(stored)) return null;
        const deadline = Number.isFinite(stored.timesOfDay) && stored.timesOfDay > 0;
        return { ...stored, deadline, due: deadline && (stored.remaining ?? 0) <= 0 };
    } catch {
        return null;
    }
}

/**
 * The Monokuma Motive as a GM reads it: `motive()` with a hidden one's words from the GMs' store (`hiddenText`,
 * `hiddenPenalty`). A player's browser gets `motive()` alone.
 */
export function motiveForGm() {
    const record = motive();
    if (!record || !record.hidden || !game.user?.isGM) return record;
    const words = hiddenMonokumaWords(record.id);
    return { ...record, hiddenText: words?.text ?? "", hiddenPenalty: words?.penalty ?? "" };
}

/** The record as stored, without what `motive()` derives (E51 C7): every write of a read record goes through this. */
function storedMotive(record) {
    const { due: _due, deadline: _deadline, hiddenText: _text, hiddenPenalty: _penalty, ...stored } = record ?? {};
    return stored;
}

/** The deadline asked for, clamped to `MOTIVE`'s bounds, or null for none (#5): an empty or zero field is none. */
export function deadlineOf(asked) {
    const n = Math.trunc(Number(asked));
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.min(MOTIVE.maxTimesOfDay, Math.max(MOTIVE.minTimesOfDay, n));
}

/**
 * The Monokuma Motive in force ends: its outcome kept for the chapter (motives.mjs `keepMonokumaOutcome`), and a pass
 * rewarded (`rewardMonokumaMotive`). `passed` is the GM's answer to "was it passed?" - anything but `true` is no.
 */
async function endMotive(record, passed) {
    await keepMonokumaOutcome(record, passed === true);
    await keepHiddenMonokumaWords(null);
    if (passed === true) await rewardMonokumaMotive();
}

/**
 * Set or change the Monokuma Motive, or withdraw it with `null`.
 *
 * Announced out loud, always: everybody knows there is one, and what it says unless it is hidden. Reached from the
 * Despair Call (call-effects.mjs `motiveEffect`), the rules manager's Withdraw and Reveal, and `game.drpg.motives` for
 * repair. `passed` answers "was the Monokuma Motive in force passed?" for the one it replaces or withdraws; the windows
 * ask it with no default, and the API's default is no.
 *
 * @param {object|string|null} input  `{ text, hidden, timesOfDay, penalty }`, a bare string for the words alone, or null
 * @param {{ passed?: boolean }} [options]
 */
export async function setMotive(input, { passed = false } = {}) {
    if (!game.user.isGM) return null;

    const given = typeof input === "string" || input == null ? { text: input } : input;
    const trimmed = String(given.text ?? "").trim();
    const current = motive();
    if (current) await endMotive(current, passed);

    if (!trimmed) {
        await game.settings.set(MODULE_ID, SETTINGS.monokumaMotive, {});
        if (current) {
            await announce({
                content: `<h3>${esc(game.i18n.localize("DRPG.Motive.title"))}</h3>
                      <p>${esc(game.i18n.localize("DRPG.Motive.withdrawn"))}</p>
                      <p class="notes">${esc(game.i18n.localize(passed === true ? "DRPG.Motive.withdrawnPassed" : "DRPG.Motive.withdrawnFailed"))}</p>`
            });
        }
        log("Monokuma Motive withdrawn.");
        return null;
    }

    const hidden = Boolean(given.hidden);
    const penalty = String(given.penalty ?? "").trim();
    const timesOfDay = deadlineOf(given.timesOfDay);
    const id = foundry.utils.randomID();
    const record = {
        id, hidden,
        text: hidden ? "" : trimmed,
        penalty: hidden ? "" : penalty,
        timesOfDay,
        remaining: timesOfDay,
        chapter: getClock().chapter,
        epoch: seasonEpoch(),
        at: Date.now()
    };
    // The words first, where only the GMs read them, then the public record: no browser reads a hidden motive's id
    // before the GMs hold what it says.
    if (hidden) await keepHiddenMonokumaWords({ id, text: trimmed, penalty });
    await game.settings.set(MODULE_ID, SETTINGS.monokumaMotive, record);

    await announce({
        flags: { [MODULE_ID]: { sfx: { key: "motive", gm: true } } },
        content: motiveCardHtml(record, {
            // A change says so on the line above the banner, with whether the last one was passed: one banner in capitals.
            outcome: current ? (passed === true ? "DRPG.Motive.lastPassed" : "DRPG.Motive.lastFailed") : null })
    });

    log(`Monokuma Motive set for chapter ${record.chapter}${hidden ? " (hidden)" : `: ${trimmed}`}${timesOfDay ? `, ${timesOfDay} times of day` : ""}.`);
    return record;
}

/** The public card of a Monokuma Motive: its words or "unknown", its penalty, its deadline when it has one. */
function motiveCardHtml(record, { outcome = null } = {}) {
    const words = record.hidden ? `<p><em>${esc(game.i18n.localize("DRPG.Motive.unknown"))}</em></p>` : `<p>${esc(record.text)}</p>`;
    const penalty = !record.hidden && record.penalty
        ? cardWarn(game.i18n.format("DRPG.Motive.penalty", { what: esc(record.penalty) }))
        : "";
    const deadline = Number(record.timesOfDay) > 0 ? `<p class="notes">${esc(plural("DRPG.Motive.deadline", { n: record.timesOfDay }))}</p>` : "";
    return `<div class="drpg-evidence-card">
            ${outcome ? `<p class="notes">${esc(game.i18n.localize(outcome))}</p>` : ""}
            <div class="drpg-objection-banner">${esc(game.i18n.localize("DRPG.Motive.banner"))}</div>
            ${words}
            ${penalty}
            ${deadline}
        </div>`;
}

/**
 * Reveal a hidden Monokuma Motive (SPEC: "odslaniany, gdy GM zdecyduje"): its words and penalty written into the public
 * record, the GMs' copy of them dropped, and the table told. GM only. Answers the record, or null.
 */
export async function revealMotive() {
    if (!game.user?.isGM) return null;
    const current = motiveForGm();
    if (!current?.hidden) return null;
    const record = { ...storedMotive(current), hidden: false, text: current.hiddenText ?? "", penalty: current.hiddenPenalty ?? "" };
    await game.settings.set(MODULE_ID, SETTINGS.monokumaMotive, record);
    await keepHiddenMonokumaWords(null);
    await announce({ flags: { [MODULE_ID]: { sfx: { key: "motive", gm: true } } }, content: motiveCardHtml(record, { outcome: "DRPG.Motive.revealedNote" }) });
    log("The hidden Monokuma Motive is revealed.");
    return record;
}

/**
 * One time of day has passed. Returns the record, or null if there was none - or none with a deadline (#5): a
 * Monokuma Motive with no deadline runs until it is changed, withdrawn or the chapter turns.
 *
 * ZERO IS A STATE, NOT AN END. The counter floors at zero and the motive stays on the board, marked due, until it is
 * changed or withdrawn or the chapter turns - the moment it matters is the moment it runs out. Announced ONCE when it
 * comes due, guarded by a stored flag: the tick can be re-entered by a rewind and a re-advance.
 */
export async function tickMotive() {
    if (!game.user.isGM) return null;

    const stored = motive();
    if (!stored?.deadline) return null;

    const remaining = Math.max(0, (stored.remaining ?? 0) - 1);
    const due = remaining === 0;
    let announceDue = due && !stored.dueAnnounced;

    /*
     * DUE IN AN INCIDENT, TOLD TO ITS TABLE AND OWED TO THE REST (E17 C7 and fix p2-G3, 26.10.2026; audit S10-07, the end
     * review's E17p2-R3, R5). The clock moves in private while an incident runs, so this card goes where that move's card
     * goes - veiled, to the GMs and the incident's audience - and the bystanders' Event panel keeps the count the
     * incident's first private tick found (`heldRemaining` under `heldIn`, `shownMotive`) until the close posts the
     * public card (`announceOwedMotive`, murder-rules.mjs `closeIncident`). Tier 2 "the Eclipse and the incident (E17-T10)".
     */
    const { murderState, incidentAudienceIds } = await import("./murder.mjs");
    const incident = murderState();
    const key = incident ? incidentKey(incident) : null;
    const toldHere = Boolean(incident) && stored.dueToldIn === key;
    if (toldHere) announceDue = false;

    await game.settings.set(MODULE_ID, SETTINGS.monokumaMotive, {
        ...storedMotive(stored), remaining, dueAnnounced: stored.dueAnnounced || (due && !incident),
        heldIn: key,
        heldRemaining: incident ? (stored.heldIn === key && Number.isFinite(stored.heldRemaining) ? stored.heldRemaining : (stored.remaining ?? 0)) : null,
        dueToldIn: incident && due && !stored.dueAnnounced ? key : (incident ? (stored.dueToldIn ?? null) : null)
    });

    if (announceDue) {
        const card = dueCard(stored);
        if (incident) {
            const { whisperToGms, gmIds } = await import("./utils.mjs");
            await whisperToGms(card.content, {
                whisper: Array.from(new Set([...gmIds(), ...incidentAudienceIds(incident)])), veiled: true, flags: card.flags
            });
            log("The Monokuma Motive has come due, told to the incident's table; the table is told after it.");
        } else {
            await announce(card);
            log("The Monokuma Motive has come due.");
        }
    }

    return { ...stored, remaining, due };
}

/** The key a motive's held countdown and its private telling are kept under: the incident's `openedAt`. Pure. */
export function incidentKey(state) {
    return state ? String(state.openedAt ?? "open") : null;
}

/**
 * THE MOTIVE AS A BROWSER MAY SHOW IT (E17 fix p2-G3, 26.10.2026; the end review's E17p2-R3): `record` (`motive()`'s
 * answer) unless `hide` - a bystander of the running incident, incident-store.mjs `clockHiddenHere` - and the record
 * holds a countdown for that incident (`heldIn` equal to `key`); then the count and the due as the incident's first
 * private move of the clock found them, as the bystander's HUD keeps the clock. Pure.
 */
export function shownMotive(record, { hide = false, key = null } = {}) {
    if (!record || !hide || !key || record.heldIn !== key || !Number.isFinite(record.heldRemaining)) return record;
    return { ...record, remaining: record.heldRemaining, due: record.heldRemaining <= 0 };
}

/**
 * THE PUBLIC CARD OF A MOTIVE THAT CAME DUE INSIDE AN INCIDENT (E17 fix p2-G3): posted once by the incident's close
 * (murder-rules.mjs `closeIncident`), and the motive marked announced; nothing when no motive is due, when it was
 * announced, or while an incident still runs. GM only. Answers whether it posted.
 */
export async function announceOwedMotive() {
    if (!game.user.isGM) return false;
    const stored = motive();
    if (!stored?.due || stored.dueAnnounced) return false;
    const { murderState } = await import("./murder.mjs");
    if (murderState()) return false;
    await game.settings.set(MODULE_ID, SETTINGS.monokumaMotive, { ...storedMotive(stored), dueAnnounced: true, heldIn: null, heldRemaining: null, dueToldIn: null });
    await announce(dueCard(stored));
    log("The Monokuma Motive came due in the incident; the table is told now it is closed.");
    return true;
}

/**
 * The Monokuma Motive's "due" card, as `tickMotive` and `announceOwedMotive` post it: its words (or "unknown") and the
 * penalty's words - the module takes nothing; the Monokuma carries the penalty out by hand (#1).
 */
function dueCard(stored) {
    return {
        flags: { [MODULE_ID]: { sfx: { key: "motive", gm: true } } },
        content: `<div class="drpg-evidence-card">
                <div class="drpg-objection-banner">${esc(game.i18n.localize("DRPG.Motive.dueBanner"))}</div>
                ${stored.hidden ? `<p><em>${esc(game.i18n.localize("DRPG.Motive.unknown"))}</em></p>` : `<p>${esc(stored.text)}</p>`}
                ${!stored.hidden && stored.penalty ? cardWarn(game.i18n.format("DRPG.Motive.penalty", { what: esc(stored.penalty) })) : ""}
                <p class="notes">${esc(game.i18n.localize("DRPG.Motive.dueNote"))}</p>
            </div>`
    };
}

/**
 * Give the time of day back. A rewind is a correction for a misclick, and a misclick must not cost the cast a time of
 * day off the deadline. Capped at what was given, and nothing for a motive with no deadline.
 */
export async function untickMotive() {
    if (!game.user.isGM) return null;

    const stored = motive();
    if (!stored?.deadline) return null;

    const cap = stored.timesOfDay;
    const remaining = Math.min(cap, (stored.remaining ?? 0) + 1);
    if (remaining === stored.remaining) return stored;

    const next = { ...storedMotive(stored), remaining, dueAnnounced: remaining === 0 && stored.dueAnnounced,
        // Un-happened as well (E17 fix p2-G3): a motive that comes due again in the same incident is told to its table again.
        dueToldIn: remaining === 0 ? (stored.dueToldIn ?? null) : null };
    await game.settings.set(MODULE_ID, SETTINGS.monokumaMotive, next);
    return { ...next, due: remaining <= 0 };
}

/**
 * MONOKUMA'S STANDING RULES GO WITH THE SEASON (R-1, Dawid 18.09: "Domyslnie znikac"; the reset's rules group, E42 C3).
 * They used to survive it, which is the one thing in the reset a table would notice by accident: a new cast walking
 * into a killing game already governed by rules written for people who are dead - rules bought with the Despair the
 * reset zeroes. Ticked by default like every other group, and a GM who wants to carry them over unticks the box. An
 * empty ARRAY, because that is the setting's type.
 */
async function clearSeasonRules() {
    await game.settings.set(MODULE_ID, SETTINGS.killingGameRules, []);
}

registerSeasonState({ group: "rules", clear: clearSeasonRules, settings: [SETTINGS.killingGameRules] });

/* ==========================================================================
 * WRITING - GM only, like every other world setting in the module
 * ========================================================================== */

async function write(next) {
    if (!game.user.isGM) return null;
    try {
        await game.settings.set(MODULE_ID, SETTINGS.killingGameRules, next);
        return next;
    } catch (err) {
        error("Could not write the killing game rules", err);
        return null;
    }
}

/**
 * Introduce a rule.
 *
 * Called by hand from the manager, and by the New Rule Despair Call - which is
 * the reason this is a function and not a dialog: the Call has already taken
 * its price and asked for the wording by the time it gets here.
 *
 * @param {string} text
 * @returns {Promise<object|null>} the stored rule.
 */
export async function addRule(text) {
    const body = String(text ?? "").trim();
    if (!game.user.isGM || !body) return null;

    const rule = makeRule(body);
    const next = [...rules(), rule];
    if (!await write(next)) return null;

    log(`New killing game rule (chapter ${rule.chapter}): ${body}`);
    return rule;
}

/**
 * A NEW RULE'S RECORD, ONE BUILDER (E51 C7, 31.10.2026; audit S10-56): `addRule` and the manager's "Introduce a new
 * rule" both build it here - the manager built its own copy beside the one `addRule`'s note said it called.
 *
 * @param {string} body  the rule's wording, trimmed
 */
function makeRule(body) {
    return { id: foundry.utils.randomID(), text: body, chapter: getClock().chapter, at: Date.now() };
}

/** Reword one. The id survives, so nothing pointing at it comes loose. */
export async function updateRule(id, text) {
    const body = String(text ?? "").trim();
    if (!game.user.isGM || !id || !body) return null;

    const next = rules().map(r => (r.id === id ? { ...r, text: body } : r));
    return write(next);
}

/** Revoke one. Monokuma is allowed to change his mind. */
export async function removeRule(id) {
    if (!game.user.isGM || !id) return null;
    return write(rules().filter(r => r.id !== id));
}

/* ==========================================================================
 * THE GM'S EDITOR
 * ========================================================================== */

/**
 * THE MONOKUMA MOTIVE IN THE MANAGER (E20 C6, 30.10.2026; S10-55; 2.0 line T5, D2-23). The manager shows the Monokuma
 * Motive in force - its words (a hidden one's too, to the GM, marked hidden), its time left when it has a deadline, its
 * penalty - with Withdraw, which asks first whether it was passed (`askPassed`; a pass gives every living student 3 Hope),
 * and, for a hidden one, Reveal (`revealMotive`). One block, drawn and wired here and nowhere else.
 *
 * @param {object|null} [record]  `motiveForGm()`'s answer, or `motive()`'s
 */
export function motiveSection(record = motiveForGm()) {
    const t = key => esc(game.i18n.localize(key));
    if (!record?.id) {
        return `<section class="drpg-rules-motive"><h4>${t("DRPG.Motive.title")}</h4>
            <p class="notes">${t("DRPG.Motive.none")}</p></section>`;
    }
    const words = record.hidden ? (record.hiddenText ?? "") : record.text;
    const penalty = record.hidden ? (record.hiddenPenalty ?? "") : record.penalty;
    const left = !record.deadline ? t("DRPG.Motive.noDeadline")
        : record.due ? t("DRPG.Motive.dueShort") : esc(plural("DRPG.Motive.left", { n: Math.max(0, Number(record.remaining) || 0) }));
    return `<section class="drpg-rules-motive"><h4>${t("DRPG.Motive.title")}</h4>
        ${record.hidden ? `<p class="notes">${t("DRPG.Motive.hiddenNote")}</p>` : ""}
        <p>${esc(words)}</p>
        <p class="notes">${left}</p>
        ${penalty ? `<p class="notes">${esc(game.i18n.format("DRPG.Motive.penalty", { what: penalty }))}</p>` : ""}
        <p><button type="button" data-drpg-motive-withdraw>${t("DRPG.Motive.withdraw")}</button>${
            record.hidden ? ` <button type="button" data-drpg-motive-reveal>${t("DRPG.Motive.reveal")}</button>` : ""}</p>
        <p class="notes">${t("DRPG.Motive.withdrawNote")}</p></section>`;
}

/** Which Monokuma Motive is in force, as one string: its id, chapter and stamp (`motive()`'s record), or "" for none. */
export function motiveMark(record = motive()) {
    return record?.id ? JSON.stringify([record.id, record.chapter ?? null, record.at ?? null]) : "";
}

/**
 * "WAS THE MONOKUMA MOTIVE PASSED?" - Yes, No, or the window closed (null): asked before a change or a withdrawal, with
 * no default (the line's M3: no "Yes" the GM did not choose). Answers true, false or null.
 */
export async function askPassed() {
    const answer = await drpgWindow({
        title: game.i18n.localize("DRPG.Motive.title"),
        classes: ["drpg-panel", "drpg-window-motive-passed"],
        body: `<p>${esc(game.i18n.localize("DRPG.Motive.passedQuestion"))}</p><p class="notes">${esc(game.i18n.localize("DRPG.Motive.passedNote"))}</p>`,
        // Enter presses Cancel, not Yes: the GM chooses the answer (M3).
        footer: {
            primary: { action: "yes", label: game.i18n.localize("DRPG.Motive.passedYes"), tooltip: tipText("DRPG.Motive.tip.passedYes"), callback: () => "yes" },
            secondary: [{ action: "no", label: game.i18n.localize("DRPG.Motive.passedNo"), tooltip: tipText("DRPG.Motive.tip.passedNo"), callback: () => "no" }],
            close: { role: "cancel", action: "cancel" },
            default: "cancel"
        },
        rejectClose: false
    });
    return answer === "yes" ? true : answer === "no" ? false : null;
}

/**
 * Wire the section's Withdraw and Reveal: Withdraw asks whether the motive was passed, then withdraws it (`setMotive(null,
 * { passed })`); pressed once (the button goes off at once). `withdraw` is that unless the suite hands a stand-in
 * (R1520), handed the answer. A motive that is no longer the one drawn is drawn instead and the GM told (REFR-22).
 *
 * @returns {{ done: () => Promise<unknown> }} what the last press is still doing
 */
export function wireMotiveWithdraw(root, { withdraw = passed => setMotive(null, { passed }), ask = askPassed,
    shown = motiveMark(), now = () => motiveMark() } = {}) {
    let pending = Promise.resolve();
    const button = root?.querySelector?.("[data-drpg-motive-withdraw]");
    const reveal = root?.querySelector?.("[data-drpg-motive-reveal]");
    const redraw = async record => {
        const section = root?.querySelector?.(".drpg-rules-motive");
        const host = section?.parentNode ?? null;
        if (!host) return;
        section.outerHTML = motiveSection(record);
        wireMotiveWithdraw(host, { withdraw, ask, now });
    };
    reveal?.addEventListener("click", () => {
        if (reveal.disabled) return;
        reveal.disabled = true;
        pending = Promise.resolve().then(() => revealMotive()).then(() => redraw(motiveForGm()))
            .catch(err => { reveal.disabled = false; error("Could not reveal the Monokuma Motive", err); });
    });
    if (!button) return { done: () => pending };
    button.addEventListener("click", () => {
        if (button.disabled) return;
        button.disabled = true;
        if (now() !== shown) {
            void redraw(motiveForGm());
            ui.notifications.info(game.i18n.localize("DRPG.Motive.changedMeanwhile"));
            return;
        }
        pending = Promise.resolve()
            .then(() => ask())
            .then(passed => {
                if (passed === null) { button.disabled = false; return null; }
                return Promise.resolve(withdraw(passed)).then(() => redraw(null));
            })
            .catch(err => {
                button.disabled = false;
                error("Could not withdraw the Monokuma Motive", err);
            });
    });
    return { done: () => pending };
}

/**
 * Edit the whole list on one screen.
 *
 * A textarea per rule rather than a per-rule edit dialog: the GM's question
 * here is almost always "what do these say together" - whether a new rule
 * contradicts one from two chapters ago - and that is not a question you can
 * answer one modal at a time.
 */
export async function openRulesManager() {
    // ONE OF THESE, NOT FOUR - see `alreadyOpen` in live.mjs. Two copies of a
    // window each read the world when they opened and neither knows about the
    // other, so the older one goes on looking authoritative while showing
    // something that stopped being true. Raised rather than refused: pressing
    // twice usually means the window is behind something.
    if (alreadyOpen("drpg-window-rules")) return RAISED;

    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const current = rules();

    const rows = current.map((rule, i) => `
        <tr>
            <td class="drpg-rule-number">${i + 1}</td>
            <td>
                <textarea name="text:${rule.id}" rows="2">${
                    foundry.utils.escapeHTML(rule.text)}</textarea>
                <small class="notes">${game.i18n.format("DRPG.Rules.added", {
                    chapter: rule.chapter ?? "?"
                })}</small>
            </td>
            <td style="text-align:center">
                <input type="checkbox" name="delete:${rule.id}"${tipAttr("DRPG.Tips.Sweep.Gm.revokeRuleTooltip")} />
            </td>
        </tr>`).join("");

    const result = await drpgWindow({
        title: game.i18n.localize("DRPG.Rules.manageTitle"),
        classes: ["drpg-panel", "drpg-projects", "drpg-window-rules"],
        // On the kit's frame, as wide as its widest table (ui-kit.mjs `fitKitWidth`; utils.mjs `tableDialog` until E21 C2a).
        fit: true,
        body: `<form>
            ${motiveSection(motiveForGm())}
            <hr />
            <p>${game.i18n.localize("DRPG.Rules.manageIntro")}</p>
            ${current.length ? `<table class="drpg-vault-table"><thead><tr>
                <th>#</th>
                <th>${game.i18n.localize("DRPG.Rules.rule")}</th>
                <th>${game.i18n.localize("DRPG.Project.delete")}</th>
            </tr></thead><tbody>${rows}</tbody></table>`
                : `<p class="notes">${game.i18n.localize("DRPG.Rules.none")}</p>`}
            <hr />
            <label>${game.i18n.localize("DRPG.Rules.addNew")}
                <textarea name="new" rows="2"
                    placeholder="${game.i18n.localize("DRPG.Calls.newRulePlaceholder")}"></textarea></label>
            <p class="notes">${game.i18n.localize("DRPG.Rules.manageNote")}</p>
            <label class="drpg-checkbox"><input type="checkbox" name="announce" checked />
                ${game.i18n.localize("DRPG.Rules.announce")}</label>
        </form>`,
        footer: {
            primary: {
                action: "save", label: game.i18n.localize("DRPG.Assign.save"),
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return {
                        edited: current.map(rule => ({
                            id: rule.id,
                            // The words drawn, so the save can tell a row the GM reworded from one left as drawn.
                            was: rule.text,
                            text: f.querySelector(`[name="text:${CSS.escape(rule.id)}"]`)?.value ?? rule.text,
                            remove: Boolean(
                                f.querySelector(`[name="delete:${CSS.escape(rule.id)}"]`)?.checked)
                        })),
                        added: f.querySelector('[name="new"]')?.value ?? "",
                        announce: Boolean(f.querySelector('[name="announce"]')?.checked)
                    };
                }
            },
            // Save still to answer: Cancel (E21 rule 3), the answer "cancel" as before.
            close: { role: "cancel", action: "cancel" }
        },
        render: (_event, dialog) => {
            wireMotiveWithdraw(dialog?.element);
            // The motive is a read-out: drawn again when it changes, wherever (REFR-22, 1.2.122). The rules' rows are the
            // GM's form and are not redrawn under their hands; the save reads them against today's list (`saveRulesEdit`).
            // A hidden one's words are the GMs' store's (2.0 line T5): drawn with them (`motiveForGm`), the store watched too.
            keepLive(dialog, { region: ".drpg-rules-motive", build: () => motiveSection(motiveForGm()),
                watch: { settings: [SETTINGS.monokumaMotive, SETTINGS.clock], stores: [motiveStore] }, after: el => wireMotiveWithdraw(el) });
        },
        rejectClose: false
    });

    if (!result || result === "cancel") return null;
    return saveRulesEdit(result);
}

/**
 * WHAT THE MANAGER'S SAVE WRITES, AND WHAT IT SAYS (E51 C7, 31.10.2026; audit S10-56, the owner's D44d = 1).
 *
 * One write, not one per row: each `game.settings.set` is a round trip to every client, and a five-rule edit should
 * not be five of them. Then four things the save used not to do:
 * - AN EMPTIED RULE IS REFUSED, SAID SO. A rule whose wording was cleared and whose box was not ticked keeps its old
 *   text, as before - but the GM is told which, and that the box is how a rule is revoked; before, the text came back
 *   without a word and read as a save that ignored them.
 * - THE WRITE'S ANSWER IS READ: "Saved" only when `write` answered, else "could not be saved" and nothing announced.
 *   The toast said "Saved - 4 rules in force" over a refused write.
 * - "ANNOUNCE CHANGES", TICKED BY DEFAULT (D44d = 1): one public card listing the rules introduced and revoked. A rule
 *   exists so that everybody knows it (this file's header), and a rule the manager added or revoked reached nobody's
 *   chat. A rule revoked and introduced again in the same save, word for word, is listed once, as introduced. A save
 *   that only rewords posts nothing (D44d names the introduced and the revoked). Unticked for a GM fixing a typo.
 * - THE NEW RULE IS `makeRule`'S, the builder `addRule` uses.
 *
 * @param {{ edited: Array<{id: string, text: string, was?: string, remove: boolean}>, added: string, announce?: boolean }} result
 * @returns {Promise<object[]|null>} the rules written, or null when the write was refused
 */
async function saveRulesEdit(result) {
    const emptied = [];
    const before = rules();
    let next = before
        .filter(r => !result.edited.find(e => e.id === r.id)?.remove)
        .map(r => {
            const edit = result.edited.find(e => e.id === r.id);
            /* A ROW LEFT AS DRAWN KEEPS TODAY'S WORDS (the audit's REFR-22, 1.2.122, 21.11.2026). Save sent every drawn
               row's text, changed or not, so a rule another GM reworded while this window stood got the words drawn at
               the open back. Only a row whose text differs from the one drawn (`was`) is this GM's rewording. */
            const reworded = edit && (edit.was === undefined || String(edit.text) !== String(edit.was));
            const text = String(reworded ? edit.text : r.text).trim();
            if (!text) emptied.push(before.indexOf(r) + 1);
            return text ? { ...r, text } : r;
        });
    if (emptied.length) {
        ui.notifications.warn(game.i18n.format("DRPG.Rules.emptyKept", { rules: emptied.join(", ") }));
    }

    const fresh = String(result.added ?? "").trim();
    if (fresh) next = [...next, makeRule(fresh)];

    if (!await write(next)) {
        ui.notifications.error(game.i18n.localize("DRPG.Rules.saveFailed"));
        return null;
    }
    ui.notifications.info(plural("DRPG.Rules.saved", { n: next.length }));

    const kept = new Set(next.map(r => r.id));
    const revoked = before.filter(r => !kept.has(r.id) && r.text.trim() !== fresh).map(r => r.text);
    if (result.announce !== false && (fresh || revoked.length)) await announceRuleChanges({ added: fresh ? [fresh] : [], revoked });
    return next;
}

/** The card the manager's "Announce changes" posts: the rules introduced, then the rules revoked; public. */
async function announceRuleChanges({ added = [], revoked = [] }) {
    const list = (key, texts) => texts.length
        ? `<p><strong>${esc(game.i18n.localize(key))}</strong></p><ul>${texts.map(text => `<li>${esc(text)}</li>`).join("")}</ul>`
        : "";
    await announce({
        content: `<div class="drpg-evidence-card">
            <div class="drpg-objection-banner">${esc(game.i18n.localize("DRPG.Rules.announceTitle"))}</div>
            ${list("DRPG.Rules.announceAdded", added)}
            ${list("DRPG.Rules.announceRevoked", revoked)}
        </div>`
    });
    log(`Killing game rules changed: ${added.length} introduced, ${revoked.length} revoked.`);
}
