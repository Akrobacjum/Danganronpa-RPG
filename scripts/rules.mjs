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
import { SETTINGS, seasonEpoch, sameSeason } from "./settings.mjs";
import { getClock } from "./clock.mjs";
import { announce, dialogContent, log, error, plural, tableDialog, esc} from "./utils.mjs";
import { alreadyOpen } from "./live.mjs";

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
 * MOTIVES
 * --------------------------------------------------------------------------
 * Guide, p. 16: "Monokuma w każdym momencie rozdziału może dać graczom motyw -
 * powód roleplayowy do zabijania, od różnych metod szantażu, aż po ostrzeżenie,
 * że zabije 2 losowych graczy w wypadku sprzeciwu. Motyw musi być ogłaszany
 * publicznie i trwać maksymalnie do końca rozdziału."
 *
 * A motive is NOT a rule, which is why it does not live in the list above: a
 * rule is permanent and a motive expires. Both halves of that sentence are
 * modelled - announcing it is what `setMotive` does, and the chapter stamp is
 * what makes it lapse without anybody having to remember to clear it.
 * ========================================================================== */

/**
 * The motive in force this chapter, or null.
 *
 * `due` is derived rather than stored twice: the record holds one number, and
 * every reader - the HUD row, the card, the tick - asks the same question of
 * it in the same place.
 */
export function motive() {
    try {
        const stored = game.settings.get(MODULE_ID, SETTINGS.motive) ?? {};
        if (!stored.text) return null;
        // Expired by arithmetic rather than by a cleanup pass: a motive from an
        // earlier chapter simply stops being the current one. The guide's outer
        // bound ("maksymalnie do końca rozdziału") survives the countdown being
        // added inside it - a motive can run out early, never late.
        // And of this season (E11 C12): a reset that keeps the motive starts the clock at
        // chapter 1 again, where last season's chapter-1 motive read as in force.
        if (stored.chapter !== getClock().chapter || !sameSeason(stored)) return null;
        return { ...stored, due: (stored.remaining ?? 0) <= 0 };
    } catch {
        return null;
    }
}

/**
 * THE RECORD AS STORED, WITHOUT WHAT `motive()` DERIVES (E51 C7, 31.10.2026; audit S10-56). `due` is read off
 * `remaining` at every read, as the note above says, and the tick, the rewind and the close wrote `{ ...motive() }`
 * back - so the world held a `due` beside the number it is derived from. Every write of a read record goes through
 * this. E51-T20 reads the setting raw after a tick and a rewind.
 */
function storedMotive(record) {
    const { due: _derived, ...stored } = record ?? {};
    return stored;
}

/**
 * Announce a motive, or withdraw the current one with `null`.
 *
 * Announced out loud, always. The guide's "musi być ogłaszany publicznie" is
 * the whole mechanism - a motive works by everybody knowing it is on the table.
 *
 * THREE FIELDS, NOT ONE (E14). A motive is a demand, a deadline and a price
 * for missing it. Written as a single sentence it was none of those things
 * mechanically: nothing counted down, nothing came due, and whether it was
 * still in force was a memory test the table failed two sessions later.
 *
 * NOT A GM ENTRANCE ANY MORE. This is reached from the Motive Despair Call and
 * from `game.drpg.setMotive` for repair; the free route the rules manager used
 * to offer is gone, because a motive that costs nothing is a move Monokuma can
 * make every time of day forever.
 *
 * @param {object|string|null} input  `{ text, timesOfDay, consequence }`, or a
 *   bare string for the demand alone (the API's old shape), or null to
 *   withdraw.
 */
export async function setMotive(input) {
    if (!game.user.isGM) return null;

    const given = typeof input === "string" || input == null ? { text: input } : input;
    const trimmed = String(given.text ?? "").trim();

    if (!trimmed) {
        await game.settings.set(MODULE_ID, SETTINGS.motive, {});
        await announce({
            content: `<h3>${game.i18n.localize("DRPG.Motive.title")}</h3>
                      <p>${game.i18n.localize("DRPG.Motive.withdrawn")}</p>`
        });
        log("Motive withdrawn.");
        return null;
    }

    // Clamped rather than trusted: this arrives from a number input, and a
    // motive with a deadline of zero would be due before it was announced.
    const asked = Math.trunc(Number(given.timesOfDay)) || MOTIVE.defaultTimesOfDay;
    const timesOfDay = Math.min(MOTIVE.maxTimesOfDay, Math.max(MOTIVE.minTimesOfDay, asked));

    const record = {
        text: trimmed,
        consequence: String(given.consequence ?? "").trim(),
        timesOfDay,
        remaining: timesOfDay,
        chapter: getClock().chapter,
        epoch: seasonEpoch(),
        at: Date.now()
    };
    await game.settings.set(MODULE_ID, SETTINGS.motive, record);

    const consequence = record.consequence
        ? `<p class="drpg-warning">${game.i18n.format("DRPG.Motive.orElse", {
            what: esc(record.consequence)
        })}</p>`
        : "";

    await announce({
        flags: { [MODULE_ID]: { sfx: { key: "motive", gm: true } } },
        content: `<div class="drpg-evidence-card">
            <div class="drpg-objection-banner">${game.i18n.localize("DRPG.Motive.banner")}</div>
            <p>${esc(trimmed)}</p>
            ${consequence}
            <p class="notes">${plural("DRPG.Motive.deadline", { n: timesOfDay })}</p>
        </div>`
    });

    log(`Motive announced for chapter ${record.chapter} (${timesOfDay} times of day): ${trimmed}`);
    return record;
}

/**
 * One time of day has passed. Returns the record, or null if there was none.
 *
 * ZERO IS A STATE, NOT AN END. The counter floors at zero and the motive stays
 * on the board, marked due, until Monokuma withdraws it or the chapter turns.
 * The alternative - expiring at zero - hides the motive at the exact moment it
 * matters, which is the moment somebody has to decide whether the threat was
 * real.
 *
 * Announced ONCE when it comes due, guarded by a stored flag rather than by
 * "was it above zero a moment ago": the tick can be re-entered by a rewind and
 * a re-advance, and a deadline announced twice reads as a second deadline.
 */
export async function tickMotive() {
    if (!game.user.isGM) return null;

    const stored = motive();
    if (!stored) return null;

    const remaining = Math.max(0, (stored.remaining ?? 0) - 1);
    const due = remaining === 0;
    let announceDue = due && !stored.dueAnnounced;

    /*
     * DUE IN AN INCIDENT, TOLD TO ITS TABLE AND OWED TO THE REST (E17 C7, 26.10.2026; audit S10-07). The clock moves in
     * private while an incident runs (clock.mjs `announceTimeOfDay`), and this card on the same move told every screen
     * that the GM had just moved it. Now it goes where that move's card goes - veiled, to the GMs and the incident's
     * audience (`incidentAudienceIds`) - and the motive is not marked announced, so the public card comes with the
     * first move of the clock after the incident. Tier 2 "the Eclipse and the incident (E17-T10)".
     *
     * AND THE COUNTDOWN HELD FOR THE BYSTANDERS, THE TABLE TOLD ONCE, THE REST AT THE CLOSE (E17 fix p2-G3, 26.10.2026;
     * the end review's E17p2-R3, R8 of correctness and R5 of goal). The Event panel's motive card (events.mjs
     * `motiveCard`) reads `remaining` on every browser, so the move inside the incident turned it "Due" on every
     * bystander's screen at once: every tick inside an incident keeps `heldRemaining`, the count as the incident's first
     * private tick found it, under `heldIn` (the incident's `openedAt`), and a bystander's card reads that
     * (`shownMotive`) until the incident closes; a tick with no incident lets it go. The table's whisper is marked
     * (`dueToldIn`), so a second move inside the same incident does not whisper it again; and the public card is posted
     * by the close (`announceOwedMotive`, murder-rules.mjs `closeIncident`), where the bystanders' clock catches up,
     * not at the next move of the clock, which may be a whole time of day later.
     */
    const { murderState, incidentAudienceIds } = await import("./murder.mjs");
    const incident = murderState();
    const key = incident ? incidentKey(incident) : null;
    const toldHere = Boolean(incident) && stored.dueToldIn === key;
    if (toldHere) announceDue = false;

    await game.settings.set(MODULE_ID, SETTINGS.motive, {
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
            log("The motive has come due, told to the incident's table; the table is told after it.");
        } else {
            await announce(card);
            log("The motive has come due.");
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
 * THE PUBLIC CARD OF A MOTIVE THAT CAME DUE INSIDE AN INCIDENT (E17 fix p2-G3, 26.10.2026; the end review's E17p2-R5,
 * goal): posted once by the incident's close (murder-rules.mjs `closeIncident`), where the bystanders' clock catches
 * up, and the motive marked announced; nothing when no motive is due, when it was announced, or while an incident
 * still runs. GM only. Answers whether it posted.
 */
export async function announceOwedMotive() {
    if (!game.user.isGM) return false;
    const stored = motive();
    if (!stored?.due || stored.dueAnnounced) return false;
    const { murderState } = await import("./murder.mjs");
    if (murderState()) return false;
    await game.settings.set(MODULE_ID, SETTINGS.motive, { ...storedMotive(stored), dueAnnounced: true, heldIn: null, heldRemaining: null, dueToldIn: null });
    await announce(dueCard(stored));
    log("The motive came due in the incident; the table is told now it is closed.");
    return true;
}

/** The motive's "due" card, as `tickMotive` and `announceOwedMotive` post it. */
function dueCard(stored) {
    return {
        flags: { [MODULE_ID]: { sfx: { key: "motive", gm: true } } },
        content: `<div class="drpg-evidence-card">
                <div class="drpg-objection-banner">${game.i18n.localize("DRPG.Motive.dueBanner")}</div>
                <p>${esc(stored.text)}</p>
                ${stored.consequence
                    ? `<p class="drpg-warning">${esc(stored.consequence)}</p>`
                    : ""}
            </div>`
    };
}

/**
 * Give the time of day back. A rewind is a correction for a misclick, and a
 * misclick must not cost the cast a time of day off Monokuma's deadline.
 *
 * Capped at what was bought, so repeated rewinds cannot inflate a three-time-
 * of-day motive into a longer one. `dueAnnounced` is cleared on the way back
 * up, because the deadline that was announced has been un-happened.
 */
export async function untickMotive() {
    if (!game.user.isGM) return null;

    const stored = motive();
    if (!stored) return null;

    const cap = stored.timesOfDay ?? MOTIVE.defaultTimesOfDay;
    const remaining = Math.min(cap, (stored.remaining ?? 0) + 1);
    if (remaining === stored.remaining) return stored;

    const next = { ...storedMotive(stored), remaining, dueAnnounced: remaining === 0 && stored.dueAnnounced,
        // Un-happened as well (E17 fix p2-G3): a motive that comes due again in the same incident is told to its table again.
        dueToldIn: remaining === 0 ? (stored.dueToldIn ?? null) : null };
    await game.settings.set(MODULE_ID, SETTINGS.motive, next);
    return { ...next, due: remaining <= 0 };
}

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
 * THE MOTIVE IN THE MANAGER (E20 C6, 30.10.2026; S10-55). A motive Monokuma had carried out hung on the HUD and in the
 * Event panel, the handbook said "until you withdraw it", and the console's `setMotive(null)` was the only road. The
 * manager shows the motive in force - its demand, its time left, its price - with Withdraw, which is `setMotive(null)`:
 * written and announced to the table. One block, drawn and wired here and nowhere else.
 *
 * @param {object|null} [record]  `motive()`'s answer
 */
export function motiveSection(record = motive()) {
    const t = key => esc(game.i18n.localize(key));
    if (!record?.text) {
        return `<section class="drpg-rules-motive"><h4>${t("DRPG.Motive.title")}</h4>
            <p class="notes">${t("DRPG.Motive.none")}</p></section>`;
    }
    const left = record.due ? t("DRPG.Motive.dueShort") : esc(plural("DRPG.Motive.left", { n: Math.max(0, Number(record.remaining) || 0) }));
    return `<section class="drpg-rules-motive"><h4>${t("DRPG.Motive.title")}</h4>
        <p>${esc(record.text)}</p>
        <p class="notes">${left}</p>
        ${record.consequence ? `<p class="notes">${esc(game.i18n.format("DRPG.Motive.orElse", { what: record.consequence }))}</p>` : ""}
        <p><button type="button" data-drpg-motive-withdraw>${t("DRPG.Motive.withdraw")}</button></p>
        <p class="notes">${t("DRPG.Motive.withdrawNote")}</p></section>`;
}

/**
 * Wire the section's Withdraw: pressed once (the button goes off at once, so a second press withdraws nothing more),
 * then the section says there is no motive. `withdraw` is `setMotive(null)` unless the suite hands a stand-in (R1520).
 *
 * @returns {{ done: () => Promise<unknown> }} what the last press is still doing
 */
export function wireMotiveWithdraw(root, { withdraw = () => setMotive(null) } = {}) {
    let pending = Promise.resolve();
    const button = root?.querySelector?.("[data-drpg-motive-withdraw]");
    if (!button) return { done: () => pending };
    button.addEventListener("click", () => {
        if (button.disabled) return;
        button.disabled = true;
        pending = Promise.resolve()
            .then(() => withdraw())
            .then(() => {
                const section = button.closest(".drpg-rules-motive");
                if (section?.parentNode) section.outerHTML = motiveSection(null);
            })
            .catch(err => {
                button.disabled = false;
                error("Could not withdraw the motive", err);
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
    if (alreadyOpen("drpg-window-rules")) return null;

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
                <input type="checkbox" name="delete:${rule.id}" />
            </td>
        </tr>`).join("");

    const result = await tableDialog({
        window: { title: game.i18n.localize("DRPG.Rules.manageTitle") },
        classes: ["drpg-panel", "drpg-projects", "drpg-window-rules"],
        content: dialogContent(`<form>
            ${motiveSection()}
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
        </form>`),
        buttons: [
            {
                action: "save", label: game.i18n.localize("DRPG.Assign.save"), default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return {
                        edited: current.map(rule => ({
                            id: rule.id,
                            text: f.querySelector(`[name="text:${CSS.escape(rule.id)}"]`)?.value ?? rule.text,
                            remove: Boolean(
                                f.querySelector(`[name="delete:${CSS.escape(rule.id)}"]`)?.checked)
                        })),
                        added: f.querySelector('[name="new"]')?.value ?? "",
                        announce: Boolean(f.querySelector('[name="announce"]')?.checked)
                    };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        render: (_event, dialog) => { wireMotiveWithdraw(dialog?.element); },
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
 * @param {{ edited: Array<{id: string, text: string, remove: boolean}>, added: string, announce?: boolean }} result
 * @returns {Promise<object[]|null>} the rules written, or null when the write was refused
 */
async function saveRulesEdit(result) {
    const emptied = [];
    const before = rules();
    let next = before
        .filter(r => !result.edited.find(e => e.id === r.id)?.remove)
        .map(r => {
            const edit = result.edited.find(e => e.id === r.id);
            const text = String(edit?.text ?? r.text).trim();
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
