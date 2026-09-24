/**
 * Danganronpa RPG - the GM team panel ("Despair Flow").
 * ---------------------------------------------------------------------------
 * Four tabs - pools, Monokumas, students, overflow - opened from Between
 * sessions and from the season checklist (audit S10-73: this header described
 * the first two and a "more" menu that no longer exists). The first two are the
 * questions that used to be two separate dialogs with two separate shortcuts on
 * screen (a gear on the Despair widget):
 *
 *   1. Which actors are Monokumas, and whose Despair pool each one draws on.
 *      `poolUserFor` guessed this from ownership before this existed, and
 *      every GM is an owner of every actor - with two Gamemasters the guess
 *      collapsed to "whoever is looking at the sheet", so two Monokumas
 *      showed and spent the same pool.
 *
 *   2. Which Monokuma looks after which student - a division set once per
 *      season, not something that earns a permanent button on the HUD.
 *
 * Merged into one screen: setup you do once per season, not mid-session upkeep.
 */

import {
    monokumas, poolLabel, setPoolLabel, poolCandidates, extraPoolUserIds, addPool, removePool,
    getDespair
} from "./despair.mjs";
import { isMonokuma, setMonokuma, poolFor, setPools } from "./monokuma.mjs";
import { students, assignments, monokumaFor, setAssignments, autoAssign, NO_MONOKUMA } from "./assignments.mjs";
import { dialogContent, error, tableDialog, panelTabs, wirePanelTabs } from "./utils.mjs";
import { setOverflowRules, overflowSection, overflowNowLine, readOverflowForm } from "./overflow.mjs";
import { alreadyOpen, keepFresh, reopen } from "./live.mjs";
import { SETTINGS } from "./settings.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/**
 * What the GM has typed here but not applied (TEAM-01, 20.09).
 *
 * Add a pool, Revoke a pool and Split evenly all act at once and then open this
 * window again so the rows are current - and the copy that comes back is built
 * from the WORLD, so a pool renamed in the box above, a Monokuma ticked and an
 * overflow threshold nudged all went back to what they were. Nothing said so.
 *
 * THE ASSIGNMENTS ARE DELIBERATELY NOT CARRIED. Those three buttons change which
 * pools exist and who feeds whom, which is exactly what that table lists: putting
 * a stale set of assignments back over a roster that has just been re-divided
 * would be worse than rebuilding it, so it is rebuilt.
 */
function readTeamDraft(root, gms, actors) {
    if (!root) return null;
    const pools = {};
    for (const user of gms) {
        const field = root.querySelector(`[name="poolName.${CSS.escape(user.id)}"]`);
        if (field) pools[user.id] = field.value;
    }
    const monokumas = {};
    // The pool beside each tick as well (review of stage D): a GM who ticked a new
    // Monokuma and chose its pool lost the choice on the first reopen, and Save then
    // wrote the default into the character's flags.
    const monokumaPools = {};
    for (const actor of actors) {
        const box = root.querySelector(`[name="mk.${CSS.escape(actor.id)}"]`);
        if (box) monokumas[actor.id] = box.checked;
        const select = root.querySelector(`[name="pool.${CSS.escape(actor.id)}"]`);
        if (select) monokumaPools[actor.id] = select.value;
    }
    return { pools, monokumas, monokumaPools, overflow: readOverflowForm(root) };
}

/** Put a carried draft back, once the new copy has rendered. */
function paintTeamDraft(root, draft) {
    if (!root || !draft) return;
    for (const [id, value] of Object.entries(draft.pools ?? {})) {
        const field = root.querySelector(`[name="poolName.${CSS.escape(id)}"]`);
        // Whatever they typed, including a box they emptied on purpose.
        if (field) field.value = value;
    }
    for (const [id, on] of Object.entries(draft.monokumas ?? {})) {
        const box = root.querySelector(`[name="mk.${CSS.escape(id)}"]`);
        if (box) box.checked = on;
    }
    for (const [id, value] of Object.entries(draft.monokumaPools ?? {})) {
        const select = root.querySelector(`[name="pool.${CSS.escape(id)}"]`);
        // A pool revoked since is no longer an option; the row keeps what the world says.
        if (select && Array.from(select.options).some(o => o.value === value)) select.value = value;
    }
    const rules = draft.overflow;
    if (!rules) return;
    const threshold = root.querySelector('[name="ovf-threshold"]');
    if (threshold && Number.isFinite(rules.threshold)) threshold.value = rules.threshold;
    for (const [key, effect] of Object.entries(rules.effects ?? {})) {
        const on = root.querySelector(`[name="ovf-${key}-on"]`);
        if (on) on.checked = Boolean(effect.on);
        const by = root.querySelector(`[name="ovf-${key}-by"]`);
        if (by && Number.isFinite(effect.by)) by.value = effect.by;
    }
}

/**
 * Ask before a pool's Despair goes with it (TEAM-01, 20.09).
 *
 * `removePool` drops the account from the opted-in list, deletes its entry from
 * the Despair store and clears its name - so the pool's Despair is gone, and the
 * button that did it sat in a four-button footer one place along from Save with
 * nothing asked. Every other destruction in this module asks first.
 *
 * NOT `DialogV2.confirm`: that puts Yes FIRST in the footer, and Enter presses the
 * first submit in DOM order whatever carries `default` - so the keyboard answer to
 * "shall I destroy this" would have been yes. Cancel is first and default here,
 * the shape `openFinalVerdictDialog` settled on for the same reason.
 */
async function confirmRemovePool(user) {
    const held = getDespair(user.id) ?? 0;
    const answer = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Despair.removePool") },
        classes: ["drpg-panel", "drpg-narrow", "drpg-window-removepool"],
        content: `<p>${game.i18n.format("DRPG.Despair.removePoolAsk", {
            name: foundry.utils.escapeHTML(poolLabel(user)), n: held
        })}</p>`,
        buttons: [
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel"), default: true },
            { action: "remove", label: game.i18n.localize("DRPG.Despair.removePool") }
        ],
        rejectClose: false
    });
    return answer === "remove";
}

/**
 * Save, the pool add and remove (when there is somebody to add or remove), split
 * evenly, close. Add, Revoke and Split evenly bring the form's draft with their
 * answer, because each of them reopens the window (TEAM-01, `readTeamDraft`).
 */
function gmTeamButtons({ gms, actors, roster, candidates, removable }) {
    const buttons = [
        {
            action: "save",
            label: game.i18n.localize("DRPG.Assign.save"),
            default: true,
            callback: (event, button, dialog) => ({
                pools: readPoolNameForm(dialog, gms),
                monokumas: readMonokumaForm(dialog, actors),
                assignments: roster.length ? readAssignmentForm(dialog, roster) : null,
                overflow: readOverflowForm(dialog.element)
            })
        }
    ];
    if (candidates.length) {
        buttons.push({
            action: "addPool",
            label: game.i18n.localize("DRPG.Despair.addPool"),
            callback: (event, button, dialog) => ({
                op: "add",
                userId: dialog.element.querySelector('[name="newPoolCandidate"]')?.value,
                draft: readTeamDraft(dialog.element, gms, actors)
            })
        });
    }
    if (removable.length) {
        buttons.push({
            action: "removePool",
            label: game.i18n.localize("DRPG.Despair.removePool"),
            callback: (event, button, dialog) => ({
                op: "remove",
                userId: dialog.element.querySelector('[name="removePoolCandidate"]')?.value,
                draft: readTeamDraft(dialog.element, gms, actors)
            })
        });
    }
    if (roster.length) {
        buttons.push({
            action: "auto",
            label: game.i18n.localize("DRPG.Assign.splitEvenly"),
            // A callback of its own, only so the form comes back with the answer
            // (TEAM-01) - `auto` used to be a bare action, which returns a string.
            callback: (event, button, dialog) => ({
                op: "auto",
                draft: readTeamDraft(dialog.element, gms, actors)
            })
        });
    }
    buttons.push({ action: "cancel", label: game.i18n.localize("DRPG.Panel.close") });
    return buttons;
}

/** Write the four things the form edits, in the order the reads depend on. */
async function saveGmTeam(result) {
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

        // Saved through the same button as the rest - every pane stays in the
        // DOM, which is the whole reason `panelTabs` works this way.
        if (result.overflow) await setOverflowRules(result.overflow);

        ui.notifications.info(game.i18n.localize("DRPG.Monokuma.saved"));
        return true;
    } catch (err) {
        error("Could not save the GM team panel", err);
        ui.notifications.error(game.i18n.localize("DRPG.Assign.failed"));
        return null;
    }
}

/**
 * Open the combined panel. GM only. `draft` is what the copy that just closed
 * was holding, painted back over the fresh rows (TEAM-01).
 */
export async function openGmTeamDialog({ draft = null } = {}) {
    // ONE OF THESE, NOT FOUR - see `alreadyOpen` in live.mjs. Two copies of a
    // window each read the world when they opened and neither knows about the
    // other, so the older one goes on looking authoritative while showing
    // something that stopped being true. Raised rather than refused: pressing
    // twice usually means the window is behind something.
    if (alreadyOpen("drpg-window-gmteam")) return null;

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
    // live-update the roster below it - reopen once after saving if a change
    // there should also change who is available to divide up as a student.
    const roster = students();
    const candidates = poolCandidates();
    const extraIds = new Set(extraPoolUserIds());
    const removable = gms.filter(u => extraIds.has(u.id));

    const buttons = gmTeamButtons({ gms, actors, roster, candidates, removable });

    const result = await tableDialog({
        window: { title: game.i18n.localize("DRPG.Panel.despairFlow") },
        // `drpg-assign` was missing, and with it five stylesheet rules written
        // for exactly this window: the counts box, the asterisk marking an
        // implicit assignment, the dimming of an excluded row, the empty-state
        // line and the table's own spacing. All of them keyed off a class no
        // dialog carried, so this screen has been rendering unstyled.
        classes: ["drpg-panel", "drpg-projects", "drpg-monokuma-panel", "drpg-assign", "drpg-window-gmteam"],
        content: buildContent(actors, gms, roster, candidates, removable),
        buttons,
        render: (event, dialog) => {
            wirePanelTabs(dialog.element);
            // Anything typed in the copy that closed to add, revoke or re-divide a
            // pool (TEAM-01). After the tabs, so the panes exist to be painted.
            paintTeamDraft(dialog.element, draft);
            wireMonokumaLive(dialog);
            if (roster.length) wireAssignmentLive(dialog, gms);

            /* THE ONE NUMBER ON THIS WINDOW THAT MOVES WHILE IT IS OPEN.

               Everything else here is a setting being edited - pool names, who is a
               Monokuma, which pool feeds whom, the overflow rules - and none of it
               changes underneath the GM. The spilled-Despair count does, constantly:
               every Call that overfills a pool, every Key Remnant shortfall, every
               boundary. Measured on 11.09 with this window open: the count went from 84
               to 89 and the line went on reading 84.

               Written in place rather than through `keepLive`, because it sits in the
               middle of the rules form - see `keepFresh`. */
            keepFresh(dialog, {
                run: root => {
                    const line = root.querySelector(".drpg-overflow-now");
                    if (line) line.textContent = overflowNowLine();
                },
                watch: { settings: [SETTINGS.overflow] }
            });
        },
        rejectClose: false
    });

    /*
     * THE THREE BUTTONS THAT ACT AT ONCE CARRY THE FORM WITH THEM (TEAM-01, 20.09).
     *
     * Each of them writes the world and opens this window again so the rows are
     * current; the copy that comes back is built from the world, so everything typed
     * and not applied used to go with it. `carried` is read from the answer these
     * callbacks now bring - see `readTeamDraft` for what is carried and what is
     * deliberately rebuilt.
     */
    const carried = result?.draft ?? null;

    if (result === "auto" || result?.op === "auto") {
        await autoAssign();
        ui.notifications.info(game.i18n.localize("DRPG.Assign.splitDone"));
        return openGmTeamDialog({ draft: carried });
    }
    /* THROUGH `reopen` WHERE THE ROAD MAY AWAIT NOTHING (LIVE-REOPEN-01, review of
       stage D). A refusal - the pool already granted by another GM, the account
       gone, a revoke whose user is no longer on the list - comes back here before
       the old copy has closed, `alreadyOpen` refuses the new one, and the GM is
       left with no window and their draft gone. `reopen` closes the old copy
       first. The auto branch awaits a settings write and was always safe. */
    if (result?.op === "add") {
        if (result.userId && await addPool(result.userId)) {
            ui.notifications.info(game.i18n.localize("DRPG.Despair.poolAdded"));
        }
        return reopen("drpg-window-gmteam", () => openGmTeamDialog({ draft: carried }));
    }
    if (result?.op === "remove") {
        /*
         * ASKED, AND THE ID RE-CHECKED AGAINST THE LIST AS IT IS NOW. The select was
         * built when this window opened, and a second GM can opt somebody in or out
         * while it stands there; a revoke is destructive, so it is checked against
         * the opted-in extras at the moment it is pressed rather than against the
         * list it was offered from. A refusal says so rather than doing nothing.
         */
        const user = result.userId ? game.users.get(result.userId) : null;
        const stillExtra = user && extraPoolUserIds().includes(user.id);
        if (!stillExtra) {
            if (result.userId) ui.notifications.warn(game.i18n.localize("DRPG.Despair.poolGone"));
        } else if (await confirmRemovePool(user)) {
            if (await removePool(user.id)) {
                ui.notifications.info(game.i18n.localize("DRPG.Despair.poolRemoved"));
            }
        }
        return reopen("drpg-window-gmteam", () => openGmTeamDialog({ draft: carried }));
    }
    if (!result || result === "cancel") return null;

    return saveGmTeam(result);
}

/* ==========================================================================
 * MARKUP
 * ========================================================================== */

function buildContent(actors, gms, roster, candidates, removable) {
    const poolRows = gms.map(u => `
        <tr>
            <td>${foundry.utils.escapeHTML(u.name)}</td>
            <td><input type="text" name="poolName.${u.id}" value="${foundry.utils.escapeHTML(poolLabel(u))}"
                       aria-label="${foundry.utils.escapeHTML(`${game.i18n.localize("DRPG.Despair.poolName")}: ${u.name}`)}"
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
                <img src="${foundry.utils.escapeHTML(actor.img ?? "")}" alt="" class="drpg-monokuma-portrait" />
                ${foundry.utils.escapeHTML(actor.name)}
            </td>
            <td style="text-align:center">
                <input type="checkbox" name="mk.${actor.id}" data-drpg-mk ${marked ? "checked" : ""}
                       aria-label="${foundry.utils.escapeHTML(`${game.i18n.localize("DRPG.Monokuma.isMonokuma")}: ${actor.name}`)}" />
            </td>
            <td>
                <select name="pool.${actor.id}" data-drpg-pool ${marked ? "" : "disabled"}
                        aria-label="${foundry.utils.escapeHTML(`${game.i18n.localize("DRPG.Monokuma.pool")}: ${actor.name}`)}">${options}</select>
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
    // there - every pane stays in the DOM, so the single Save that reads all
    // three forms at once keeps working.
    /*
     * FOUR TABS NOW, AND THE FOURTH IS WHY THIS WINDOW IS CALLED DESPAIR FLOW
     * (Dawid, 29.08). Pools, the Monokumas who spend them, the students they
     * are assigned to - and what happens to the Despair that will not fit in
     * any of them. It is one subject with four faces rather than a team roster
     * with a rule bolted on, which is what the old name had stopped describing.
     *
     * The overflow's markup comes from overflow.mjs, where the rules it edits
     * live. It used to be a window of its own with a tile on the GM panel; both
     * are gone, because two doors into one form is one door too many.
     */
    const body = panelTabs([
        { key: "pools", label: game.i18n.localize("DRPG.Despair.poolsTitle"), html: poolSection },
        { key: "monokumas", label: game.i18n.localize("DRPG.Monokuma.panelTitle"), html: monokumaSection },
        ...(roster.length ? [{ key: "students", label: game.i18n.localize("DRPG.Assign.title"), html: assignSection }] : []),
        { key: "overflow", label: game.i18n.localize("DRPG.Overflow.title"), html: overflowSection() }
    ]);

    // Built as an element, not a string: DialogV2 runs a string `content`
    // through `cleanHTML`, whose allow-list drops `placeholder` on a `<textarea>`
    // (v14 keeps it on an `<input>`). Built this way so a field that becomes a
    // textarea keeps its hint - the same reason every other form in this module
    // goes through `dialogContent()`.
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
                    <td><select name="assign.${actor.id}" data-drpg-assign
                        aria-label="${foundry.utils.escapeHTML(`${game.i18n.localize("DRPG.Assign.monokuma")}: ${actor.name}`)}">${options}</select></td>
                </tr>`;
    }).join("");
}

/* ==========================================================================
 * LIVE WIRING
 * ========================================================================== */

/**
 * The pool picker only means anything for a Monokuma, and two Monokumas
 * sharing one pool is the exact mistake this panel exists to catch - so it is
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
