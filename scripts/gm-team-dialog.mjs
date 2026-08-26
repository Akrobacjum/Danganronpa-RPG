/**
 * Danganronpa RPG — the GM team panel.
 * ---------------------------------------------------------------------------
 * Two questions that used to be two separate dialogs with two separate
 * shortcuts on screen (a gear on the Despair widget):
 *
 *   1. Which actors are Monokumas, and whose Despair pool each one draws on.
 *      `poolUserFor` guessed this from ownership before this existed, and
 *      every GM is an owner of every actor — with two Gamemasters the guess
 *      collapsed to "whoever is looking at the sheet", so two Monokumas
 *      showed and spent the same pool.
 *
 *   2. Which Monokuma looks after which student — a division set once per
 *      season, not something that earns a permanent button on the HUD.
 *
 * Merged into one screen, reachable only from the GM panel's "more" menu —
 * setup you do once per season, not mid-session upkeep.
 */

import {
    monokumas, poolLabel, setPoolLabel, poolCandidates, extraPoolUserIds, addPool, removePool
} from "./despair.mjs";
import { isMonokuma, setMonokuma, poolFor, setPools } from "./monokuma.mjs";
import { students, assignments, monokumaFor, setAssignments, autoAssign, NO_MONOKUMA } from "./assignments.mjs";
import { dialogContent, error, tableDialog, panelTabs, wirePanelTabs } from "./utils.mjs";

/** Open the combined panel. GM only. */
export async function openGmTeamDialog() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const gms = monokumas();
    if (!gms.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Assign.noMonokumas"));
        return null;
    }

    const actors = game.actors
        .filter(a => a.type === "character")
        .sort((a, b) => a.name.localeCompare(b.name));
    if (!actors.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.noCharacters"));
        return null;
    }

    // Fixed at open time. Flipping a Monokuma flag in the top table does not
    // live-update the roster below it — reopen once after saving if a change
    // there should also change who is available to divide up as a student.
    const roster = students();
    const candidates = poolCandidates();
    const extraIds = new Set(extraPoolUserIds());
    const removable = gms.filter(u => extraIds.has(u.id));

    const buttons = [
        {
            action: "save",
            label: game.i18n.localize("DRPG.Assign.save"),
            default: true,
            callback: (event, button, dialog) => ({
                pools: readPoolNameForm(dialog, gms),
                monokumas: readMonokumaForm(dialog, actors),
                assignments: roster.length ? readAssignmentForm(dialog, roster) : null
            })
        }
    ];
    if (candidates.length) {
        buttons.push({
            action: "addPool",
            label: game.i18n.localize("DRPG.Despair.addPool"),
            callback: (event, button, dialog) => ({
                op: "add",
                userId: dialog.element.querySelector('[name="newPoolCandidate"]')?.value
            })
        });
    }
    if (removable.length) {
        buttons.push({
            action: "removePool",
            label: game.i18n.localize("DRPG.Despair.removePool"),
            callback: (event, button, dialog) => ({
                op: "remove",
                userId: dialog.element.querySelector('[name="removePoolCandidate"]')?.value
            })
        });
    }
    if (roster.length) buttons.push({ action: "auto", label: game.i18n.localize("DRPG.Assign.splitEvenly") });
    buttons.push({ action: "cancel", label: game.i18n.localize("DRPG.Panel.close") });

    const result = await tableDialog({
        window: { title: game.i18n.localize("DRPG.Panel.gmTeam") },
        // `drpg-assign` was missing, and with it five stylesheet rules written
        // for exactly this window: the counts box, the asterisk marking an
        // implicit assignment, the dimming of an excluded row, the empty-state
        // line and the table's own spacing. All of them keyed off a class no
        // dialog carried, so this screen has been rendering unstyled.
        classes: ["drpg-panel", "drpg-projects", "drpg-monokuma-panel", "drpg-assign"],
        content: buildContent(actors, gms, roster, candidates, removable),
        buttons,
        render: (event, dialog) => {
            wirePanelTabs(dialog.element);
            wireMonokumaLive(dialog);
            if (roster.length) wireAssignmentLive(dialog, gms);
        },
        rejectClose: false
    });

    if (result === "auto") {
        await autoAssign();
        ui.notifications.info(game.i18n.localize("DRPG.Assign.splitDone"));
        return openGmTeamDialog();
    }
    if (result?.op === "add") {
        if (result.userId && await addPool(result.userId)) {
            ui.notifications.info(game.i18n.localize("DRPG.Despair.poolAdded"));
        }
        return openGmTeamDialog();
    }
    if (result?.op === "remove") {
        if (result.userId && await removePool(result.userId)) {
            ui.notifications.info(game.i18n.localize("DRPG.Despair.poolRemoved"));
        }
        return openGmTeamDialog();
    }
    if (!result || result === "cancel") return null;

    try {
        for (const [userId, label] of Object.entries(result.pools ?? {})) {
            await setPoolLabel(userId, label);
        }

        // The flag first: `setMonokuma` clears the action budget and Hope, and
        // a pool entry for an actor that is not a Monokuma would be dead state.
        for (const row of result.monokumas) {
            const actor = game.actors.get(row.id);
            if (!actor) continue;
            if (isMonokuma(actor) !== row.monokuma) await setMonokuma(actor, row.monokuma);
        }

        const pools = {};
        for (const row of result.monokumas) {
            if (row.monokuma && row.pool) pools[row.id] = row.pool;
        }
        await setPools(pools);

        if (result.assignments) await setAssignments(result.assignments);

        ui.notifications.info(game.i18n.localize("DRPG.Monokuma.saved"));
        return true;
    } catch (err) {
        error("Could not save the GM team panel", err);
        ui.notifications.error(game.i18n.localize("DRPG.Assign.failed"));
        return null;
    }
}

/* ==========================================================================
 * MARKUP
 * ========================================================================== */

function buildContent(actors, gms, roster, candidates, removable) {
    const poolRows = gms.map(u => `
        <tr>
            <td>${foundry.utils.escapeHTML(u.name)}</td>
            <td><input type="text" name="poolName.${u.id}" value="${foundry.utils.escapeHTML(poolLabel(u))}"
                       placeholder="${foundry.utils.escapeHTML(u.name)}" /></td>
        </tr>`).join("");

    const addRow = candidates.length ? `
        <label>${game.i18n.localize("DRPG.Despair.grantTo")}
            <select name="newPoolCandidate">${candidates.map(u =>
                `<option value="${u.id}">${foundry.utils.escapeHTML(u.name)}</option>`).join("")}</select>
        </label>` : `<p class="notes">${game.i18n.localize("DRPG.Despair.noCandidates")}</p>`;

    const removeRow = removable.length ? `
        <label>${game.i18n.localize("DRPG.Despair.revokeFrom")}
            <select name="removePoolCandidate">${removable.map(u =>
                `<option value="${u.id}">${foundry.utils.escapeHTML(poolLabel(u))}</option>`).join("")}</select>
        </label>` : "";

    const poolSection = `
        <p>${game.i18n.localize("DRPG.Despair.poolsIntro")}</p>
        <table>
            <thead><tr>
                <th>${game.i18n.localize("DRPG.Panel.character")}</th>
                <th>${game.i18n.localize("DRPG.Despair.poolName")}</th>
            </tr></thead>
            <tbody>${poolRows}</tbody>
        </table>
        ${addRow}
        ${removeRow}`;

    const mkRows = actors.map(actor => {
        const marked = isMonokuma(actor);
        const pool = poolFor(actor);

        const options = [
            `<option value="">${game.i18n.localize("DRPG.Monokuma.noPool")}</option>`,
            ...gms.map(u => `<option value="${u.id}"${u.id === pool ? " selected" : ""}>${
                foundry.utils.escapeHTML(poolLabel(u))
            }</option>`)
        ].join("");

        return `<tr data-actor="${actor.id}"${marked ? ' class="drpg-is-monokuma"' : ""}>
            <td>
                <img src="${actor.img}" alt="" class="drpg-monokuma-portrait" />
                ${foundry.utils.escapeHTML(actor.name)}
            </td>
            <td style="text-align:center">
                <input type="checkbox" name="mk.${actor.id}" data-drpg-mk ${marked ? "checked" : ""} />
            </td>
            <td>
                <select name="pool.${actor.id}" data-drpg-pool ${marked ? "" : "disabled"}>${options}</select>
            </td>
        </tr>`;
    }).join("");

    const monokumaSection = `
        <p>${game.i18n.localize("DRPG.Monokuma.panelIntro")}</p>
        <div class="drpg-monokuma-warning"></div>
        <table>
            <thead><tr>
                <th>${game.i18n.localize("DRPG.Panel.character")}</th>
                <th>${game.i18n.localize("DRPG.Monokuma.isMonokuma")}</th>
                <th>${game.i18n.localize("DRPG.Monokuma.pool")}</th>
            </tr></thead>
            <tbody>${mkRows}</tbody>
        </table>
        <p class="notes">${game.i18n.localize("DRPG.Monokuma.panelNote")}</p>`;

    const assignSection = roster.length ? `
        <p>${game.i18n.localize("DRPG.Assign.intro")}</p>
        <div class="drpg-assign-counts"></div>
        <table>
            <thead><tr>
                <th>${game.i18n.localize("DRPG.Panel.character")}</th>
                <th>${game.i18n.localize("DRPG.Assign.monokuma")}</th>
            </tr></thead>
            <tbody>${buildAssignRows(roster, gms)}</tbody>
        </table>
        <p class="notes">${game.i18n.localize("DRPG.Assign.footnote")}</p>` : "";

    // Three stacked sections made one long scroll; they are tabs now, with
    // the old <h3> headings as the tab labels (Dawid, 26.08). The mechanism
    // lives in utils.mjs (`panelTabs`/`wirePanelTabs`) because Music and the
    // item tables wear the same bar; the trick it depends on is documented
    // there — every pane stays in the DOM, so the single Save that reads all
    // three forms at once keeps working.
    const body = panelTabs([
        { key: "pools", label: game.i18n.localize("DRPG.Despair.poolsTitle"), html: poolSection },
        { key: "monokumas", label: game.i18n.localize("DRPG.Monokuma.panelTitle"), html: monokumaSection },
        ...(roster.length ? [{ key: "students", label: game.i18n.localize("DRPG.Assign.title"), html: assignSection }] : [])
    ]);

    // Built as an element, not a string: DialogV2 runs a string `content`
    // through `cleanHTML`, whose allow-list drops `placeholder` — so the pool
    // name fields lost the hint telling the GM what the default is. Same reason
    // every other form in this module goes through `dialogContent()`.
    return dialogContent(`<form>${body}</form>`);
}

function buildAssignRows(roster, gms) {
    const current = assignments();

    return roster.map(actor => {
        const raw = current[actor.id];
        const excluded = raw === NO_MONOKUMA;
        const assigned = excluded ? NO_MONOKUMA : (raw ?? monokumaFor(actor)?.id ?? gms[0].id);

        const options = [
            ...gms.map(u => `<option value="${u.id}"${u.id === assigned ? " selected" : ""}>${foundry.utils.escapeHTML(poolLabel(u))}</option>`),
            `<option value="${NO_MONOKUMA}"${excluded ? " selected" : ""}>${game.i18n.localize("DRPG.Assign.nobody")}</option>`
        ].join("");

        const explicit = excluded || gms.some(u => u.id === raw);

        return `<tr${excluded ? ' class="drpg-assign-excluded"' : ""}>
                    <td>${foundry.utils.escapeHTML(actor.name)}${explicit ? "" : ` <span class="drpg-assign-implicit" data-tooltip="${game.i18n.localize("DRPG.Assign.implicitHint")}">*</span>`}</td>
                    <td><select name="assign.${actor.id}" data-drpg-assign>${options}</select></td>
                </tr>`;
    }).join("");
}

/* ==========================================================================
 * LIVE WIRING
 * ========================================================================== */

/**
 * The pool picker only means anything for a Monokuma, and two Monokumas
 * sharing one pool is the exact mistake this panel exists to catch — so it is
 * called out live rather than discovered three sessions later.
 */
function wireMonokumaLive(dialog) {
    const root = dialog.element;
    const warning = root.querySelector(".drpg-monokuma-warning");

    const refresh = () => {
        const used = new Map();

        for (const box of root.querySelectorAll("[data-drpg-mk]")) {
            const row = box.closest("tr");
            const select = row?.querySelector("[data-drpg-pool]");
            row?.classList.toggle("drpg-is-monokuma", box.checked);
            if (!select) continue;

            select.disabled = !box.checked;
            if (!box.checked) continue;

            const value = select.value;
            if (!value) continue;
            if (!used.has(value)) used.set(value, []);
            used.get(value).push(row.querySelector("td")?.textContent?.trim() ?? "?");
        }

        if (!warning) return;
        const clashes = Array.from(used.entries()).filter(([, names]) => names.length > 1);
        warning.innerHTML = clashes.length
            ? `<p class="drpg-warning">${clashes.map(([userId, names]) =>
                  game.i18n.format("DRPG.Monokuma.sharedPool", {
                      name: foundry.utils.escapeHTML(poolLabel(game.users.get(userId))),
                      actors: foundry.utils.escapeHTML(names.join(", "))
                  })).join("<br>")}</p>`
            : "";
    };

    root.querySelectorAll("[data-drpg-mk], [data-drpg-pool]")
        .forEach(el => el.addEventListener("change", refresh));
    refresh();
}

/** Live tally per Monokuma, so an uneven split is obvious before saving. */
function wireAssignmentLive(dialog, gms) {
    const root = dialog.element;
    const box = root.querySelector(".drpg-assign-counts");
    if (!box) return;

    const update = () => {
        const tally = Object.fromEntries(gms.map(u => [u.id, 0]));
        let excluded = 0;

        for (const select of root.querySelectorAll("[data-drpg-assign]")) {
            if (select.value === NO_MONOKUMA) excluded++;
            else if (select.value in tally) tally[select.value]++;
            select.closest("tr")?.classList.toggle("drpg-assign-excluded", select.value === NO_MONOKUMA);
        }

        const counts = gms.map(u =>
            `<span class="drpg-assign-count"><strong>${foundry.utils.escapeHTML(poolLabel(u))}</strong>: ${tally[u.id]}</span>`
        );
        if (excluded) {
            counts.push(`<span class="drpg-assign-count drpg-assign-none">${game.i18n.localize("DRPG.Assign.nobody")}: ${excluded}</span>`);
        }
        box.innerHTML = counts.join("");
    };

    root.querySelectorAll("[data-drpg-assign]").forEach(s => s.addEventListener("change", update));
    update();
}

/* ==========================================================================
 * READING
 * ========================================================================== */

function readPoolNameForm(dialog, gms) {
    const root = dialog.element;
    const map = {};
    for (const user of gms) {
        const value = root.querySelector(`[name="poolName.${CSS.escape(user.id)}"]`)?.value ?? "";
        map[user.id] = value.trim();
    }
    return map;
}

function readMonokumaForm(dialog, actors) {
    const root = dialog.element;
    return actors.map(actor => ({
        id: actor.id,
        monokuma: root.querySelector(`[name="mk.${CSS.escape(actor.id)}"]`)?.checked ?? false,
        pool: root.querySelector(`[name="pool.${CSS.escape(actor.id)}"]`)?.value || null
    }));
}

function readAssignmentForm(dialog, roster) {
    const root = dialog.element;
    const map = {};
    for (const actor of roster) {
        const select = root.querySelector(`[name="assign.${CSS.escape(actor.id)}"]`);
        if (select?.value) map[actor.id] = select.value;
    }
    return map;
}
