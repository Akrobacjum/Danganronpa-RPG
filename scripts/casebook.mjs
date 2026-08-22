/**
 * Danganronpa RPG — what this character knows, on one screen.
 * ---------------------------------------------------------------------------
 * Evidence lives in the inventory, one row at a time, in the order it happened
 * to be picked up. That is the right place to KEEP it and the wrong place to
 * think with it: a player walking into a Class Trial wants "what do I have on
 * the Library", "which of these still has an unanswered question on it", and an
 * inventory list answers neither without scrolling and remembering.
 *
 * So this is the same evidence, grouped the way it is actually used — by where
 * it was found — with the two states that decide what to do next called out:
 *
 *   still Neutral      nobody has worked out what it is. Analyze may still be
 *                      available, or this copy may be locked until the chapter
 *                      ends because an attempt already failed on it.
 *   identified         what it really is, and therefore what it argues.
 *
 * Read-only and player-facing. Everything on it is already on the character's
 * own sheet — this rearranges, it does not reveal. The GM's equivalent, which
 * DOES reveal, is the Investigation dashboard, and the two are deliberately
 * separate screens: see investigation.mjs.
 */

import { TRUTH_BULLET_TYPES } from "./config.mjs";
import { bulletsOf, truthBulletData, isAnalysable } from "./truth-bullets.mjs";
import { getClock } from "./clock.mjs";
import { dialogContent, plural, tableDialog } from "./utils.mjs";

/**
 * Every Truth Bullet this character holds, grouped by where it was found.
 *
 * Rooms in alphabetical order, and anything with no room recorded last under
 * its own heading rather than dropped — a bullet whose origin was never written
 * down is still evidence, and hiding it would make the count disagree with the
 * inventory.
 */
export function casebook(actor) {
    const chapter = getClock().chapter;
    const rooms = new Map();

    for (const item of bulletsOf(actor)) {
        const data = truthBulletData(item);
        if (!data) continue;

        const where = data.room || null;
        if (!rooms.has(where)) rooms.set(where, []);
        rooms.get(where).push({
            ...data,
            analysable: isAnalysable(item, chapter),
            // "Locked" is the specific reason a Neutral bullet cannot be worked
            // on right now, and it is the one a player most needs distinguished
            // from "you simply have not tried yet".
            locked: !data.analyzed && data.shownType === "neutral"
                && !isAnalysable(item, chapter)
        });
    }

    const named = Array.from(rooms.entries())
        .filter(([room]) => room)
        .sort((a, b) => a[0].localeCompare(b[0]));
    const unplaced = rooms.get(null);

    return {
        groups: named.map(([room, bullets]) => ({ room, bullets })),
        unplaced: unplaced ?? [],
        total: Array.from(rooms.values()).reduce((n, list) => n + list.length, 0)
    };
}

/** The counts a player checks before a trial: how much, and how much unanswered. */
export function casebookSummary(actor) {
    const book = casebook(actor);
    const all = [...book.groups.flatMap(g => g.bullets), ...book.unplaced];

    return {
        total: book.total,
        identified: all.filter(b => b.analyzed || b.shownType !== "neutral").length,
        analysable: all.filter(b => b.analysable).length,
        locked: all.filter(b => b.locked).length
    };
}

export async function openCasebook(actor) {
    if (!actor) return null;

    const book = casebook(actor);
    if (!book.total) {
        ui.notifications.info(game.i18n.localize("DRPG.Casebook.empty"));
        return null;
    }

    const summary = casebookSummary(actor);
    const sections = [
        ...book.groups.map(g => section(g.room, g.bullets)),
        ...(book.unplaced.length
            ? [section(game.i18n.localize("DRPG.Casebook.noRoom"), book.unplaced)]
            : [])
    ].join("");

    await tableDialog({
        window: { title: game.i18n.format("DRPG.Casebook.title", { actor: actor.name }) },
        classes: ["drpg-panel", "drpg-casebook"],
        content: dialogContent(`<div>
            <p class="notes">${plural("DRPG.Casebook.summary", summary, "total")}</p>
            ${summary.locked ? `<p class="notes">${
                game.i18n.format("DRPG.Casebook.lockedNote", { n: summary.locked })}</p>` : ""}
            ${sections}
        </div>`),
        buttons: [{ action: "close", label: game.i18n.localize("DRPG.Panel.close"), default: true }],
        rejectClose: false
    });

    return book;
}

function section(room, bullets) {
    const rows = bullets.map(b => `<tr class="${stateClass(b)}">
        <td>${foundry.utils.escapeHTML(b.name)}</td>
        <td>${foundry.utils.escapeHTML(label(b))}</td>
        <td class="notes">${foundry.utils.escapeHTML(b.playerText || "—")}</td>
    </tr>`).join("");

    return `<h4>${foundry.utils.escapeHTML(room)} <span class="drpg-casebook-count">${
        bullets.length}</span></h4>
        <table class="drpg-vault-table"><thead><tr>
            <th>${game.i18n.localize("DRPG.Casebook.what")}</th>
            <th>${game.i18n.localize("DRPG.Casebook.kind")}</th>
            <th>${game.i18n.localize("DRPG.Casebook.note")}</th>
        </tr></thead><tbody>${rows}</tbody></table>`;
}

/**
 * What this bullet is, in the player's own terms.
 *
 * A Neutral bullet is never described as "Neutral" and left at that — that word
 * means "unidentified", and the useful half is whether anything can still be
 * done about it. So the kind column carries the state as well as the type.
 */
function label(bullet) {
    const kind = TRUTH_BULLET_TYPES[bullet.shownType]?.label ?? bullet.shownType;
    if (bullet.analyzed || bullet.shownType !== "neutral") return kind;
    if (bullet.locked) return game.i18n.localize("DRPG.Casebook.lockedLabel");
    return game.i18n.localize("DRPG.Casebook.analysableLabel");
}

function stateClass(bullet) {
    if (bullet.analyzed || bullet.shownType !== "neutral") return "drpg-casebook-known";
    return bullet.locked ? "drpg-casebook-locked" : "drpg-casebook-open";
}
