/**
 * Danganronpa RPG — the killing game's rules.
 * ---------------------------------------------------------------------------
 * Monokuma's standing rules: the ones announced at the start, and every one
 * bought since with the 12-Despair "New Rule" Call.
 *
 * Until now that Call posted its rule to chat and the module forgot it. A rule
 * that scrolls out of the log is a rule nobody can be held to — and being held
 * to them is the entire point of a killing game. So they live in world state
 * and get a permanent home on every character sheet, in the slot Daggerheart
 * uses for Effects (a tab for magical conditions this game does not have).
 *
 * WORLD-SCOPED, AND THAT IS CORRECT. Unlike the Truth Bullet ledger or the
 * Mastermind, these are the opposite of secret: a rule exists so that everybody
 * knows it. See D6 — world data reaches every client, which is exactly what is
 * wanted here.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { getClock } from "./clock.mjs";
import { announce, dialogContent, log, error, plural, tableDialog } from "./utils.mjs";

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
 * modelled — announcing it is what `setMotive` does, and the chapter stamp is
 * what makes it lapse without anybody having to remember to clear it.
 * ========================================================================== */

/** The motive in force this chapter, or null. */
export function motive() {
    try {
        const stored = game.settings.get(MODULE_ID, SETTINGS.motive) ?? {};
        if (!stored.text) return null;
        // Expired by arithmetic rather than by a cleanup pass: a motive from an
        // earlier chapter simply stops being the current one.
        if (stored.chapter !== getClock().chapter) return null;
        return stored;
    } catch {
        return null;
    }
}

/**
 * Announce a motive, or withdraw the current one with `null`.
 *
 * Announced out loud, always. The guide's "musi być ogłaszany publicznie" is
 * the whole mechanism — a motive works by everybody knowing it is on the table.
 */
export async function setMotive(text) {
    if (!game.user.isGM) return null;

    const trimmed = String(text ?? "").trim();
    if (!trimmed) {
        await game.settings.set(MODULE_ID, SETTINGS.motive, {});
        await announce({
            content: `<h3>${game.i18n.localize("DRPG.Motive.title")}</h3>
                      <p>${game.i18n.localize("DRPG.Motive.withdrawn")}</p>`
        });
        log("Motive withdrawn.");
        return null;
    }

    const record = { text: trimmed, chapter: getClock().chapter, at: Date.now() };
    await game.settings.set(MODULE_ID, SETTINGS.motive, record);

    await announce({
        content: `<div class="drpg-evidence-card">
            <div class="drpg-objection-banner">${game.i18n.localize("DRPG.Motive.banner")}</div>
            <p>${foundry.utils.escapeHTML(trimmed)}</p>
            <p class="notes">${game.i18n.localize("DRPG.Motive.untilChapterEnd")}</p>
        </div>`
    });

    log(`Motive announced for chapter ${record.chapter}: ${trimmed}`);
    return record;
}

/* ==========================================================================
 * WRITING — GM only, like every other world setting in the module
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
 * Called by hand from the manager, and by the New Rule Despair Call — which is
 * the reason this is a function and not a dialog: the Call has already taken
 * twelve Despair and asked for the wording by the time it gets here.
 *
 * @param {string} text
 * @returns {Promise<object|null>} the stored rule.
 */
export async function addRule(text) {
    const body = String(text ?? "").trim();
    if (!game.user.isGM || !body) return null;

    const rule = {
        id: foundry.utils.randomID(),
        text: body,
        chapter: getClock().chapter,
        at: Date.now()
    };

    const next = [...rules(), rule];
    if (!await write(next)) return null;

    log(`New killing game rule (chapter ${rule.chapter}): ${body}`);
    return rule;
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
 * Edit the whole list on one screen.
 *
 * A textarea per rule rather than a per-rule edit dialog: the GM's question
 * here is almost always "what do these say together" — whether a new rule
 * contradicts one from two chapters ago — and that is not a question you can
 * answer one modal at a time.
 */
export async function openRulesManager() {
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
        classes: ["drpg-panel", "drpg-projects"],
        content: dialogContent(`<form>
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
                        added: f.querySelector('[name="new"]')?.value ?? ""
                    };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return null;

    // One write, not one per row: each `game.settings.set` is a round trip to
    // every client, and a five-rule edit should not be five of them.
    let next = rules()
        .filter(r => !result.edited.find(e => e.id === r.id)?.remove)
        .map(r => {
            const edit = result.edited.find(e => e.id === r.id);
            const text = String(edit?.text ?? r.text).trim();
            return text ? { ...r, text } : r;
        });

    const fresh = String(result.added ?? "").trim();
    if (fresh) {
        next = [...next, {
            id: foundry.utils.randomID(),
            text: fresh,
            chapter: getClock().chapter,
            at: Date.now()
        }];
    }

    await write(next);
    ui.notifications.info(plural("DRPG.Rules.saved", { n: next.length }));
    return next;
}
