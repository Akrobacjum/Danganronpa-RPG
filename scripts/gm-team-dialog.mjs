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
import { isMonokuma, setMonokuma, poolFor, setPools, studentCensus } from "./monokuma.mjs";
import { students, assignments, monokumaFor, setAssignments, autoAssign, NO_MONOKUMA } from "./assignments.mjs";
import { MODULE_ID } from "./config.mjs";
import { dialogContent, error } from "./utils.mjs";
import { kitTabs, wireKitTabs, drpgWindow, drpgConfirm, dataTable, box } from "./ui-kit.mjs";
import { setOverflowRules, overflowSection, overflowNowLine, readOverflowForm, overflowStatus, clearOverflowAsGm, overflowSuggestionLine } from "./overflow.mjs";
import { alreadyOpen, keepFresh, reopen, RAISED } from "./live.mjs";
import { SETTINGS } from "./settings.mjs";


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
 * the shape `openFinalVerdictDialog` settled on for the same reason - since E21 C2b
 * the kit's destructive question (ui-kit.mjs `drpgConfirm`), whose yes is never the
 * default and stands after Cancel in the tree. The yes answers "remove", as before.
 */
async function confirmRemovePool(user) {
    const held = getDespair(user.id) ?? 0;
    const answer = await drpgConfirm({
        title: game.i18n.localize("DRPG.Despair.removePool"),
        classes: ["drpg-panel", "drpg-narrow", "drpg-window-removepool"],
        body: `<p>${game.i18n.format("DRPG.Despair.removePoolAsk", {
            name: foundry.utils.escapeHTML(poolLabel(user)), n: held
        })}</p>`,
        yes: { role: "destructive", action: "remove", label: game.i18n.localize("DRPG.Despair.removePool"), callback: () => "remove" },
        rejectClose: false
    });
    return answer === "remove";
}

/**
 * The Overflow tab's Clear (H84-06, 27.10.2026; the owner's live session on 1.2.85, triage C6): asked first, then the
 * count back to 0 on the primary (overflow.mjs `clearOverflowAsGm`), the darkening already drawn left standing. Cancel
 * first and the default, as `confirmRemovePool` and for its reason: Enter answers no (the kit's destructive question
 * since E21 C2b; the yes answers "clear"). The window stays open; its count line follows the store (`keepFresh`).
 * Answers true when cleared.
 */
export async function clearOverflowFromTab() {
    if (!game.user.isGM) return false;
    const { count, threshold } = overflowStatus();
    const answer = await drpgConfirm({
        title: game.i18n.localize("DRPG.Overflow.clear"),
        classes: ["drpg-panel", "drpg-narrow", "drpg-window-clearoverflow"],
        body: `<p>${foundry.utils.escapeHTML(game.i18n.format("DRPG.Overflow.clearAsk", { count, max: threshold }))}</p>`,
        yes: { role: "destructive", action: "clear", label: game.i18n.localize("DRPG.Overflow.clearConfirm"), callback: () => "clear" },
        rejectClose: false
    });
    if (answer !== "clear") return false;
    const cleared = await clearOverflowAsGm();
    if (cleared) ui.notifications.info(game.i18n.localize("DRPG.Overflow.cleared"));
    return Boolean(cleared);
}

/**
 * The footer by role (ui-kit.mjs `footerButtons`, E21 C2a): Save the primary; the pool add and remove (when there is
 * somebody to add or remove) and Split evenly secondary - the remove asks first (`confirmRemovePool`), its question's
 * yes is what cannot be undone; Cancel, since Save is still to answer (E21 rule 3), its answer "cancel" as before.
 * Add, Revoke and Split evenly bring the form's draft with their answer, because each of them reopens the window
 * (TEAM-01, `readTeamDraft`).
 */
function gmTeamButtons({ gms, actors, roster, candidates, removable }) {
    const secondary = [];
    const primary = {
            action: "save",
            label: game.i18n.localize("DRPG.Assign.save"),
            callback: (event, button, dialog) => ({
                pools: readPoolNameForm(dialog, gms),
                monokumas: readMonokumaForm(dialog, actors),
                assignments: roster.length ? readAssignmentForm(dialog, roster) : null,
                overflow: readOverflowForm(dialog.element)
            })
    };
    if (candidates.length) {
        secondary.push({
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
        secondary.push({
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
        secondary.push({
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
    return { primary, secondary, close: { role: "cancel", action: "cancel" } };
}

/** The footer buttons each tab shows beside Save and Close (ui-kit.mjs `wireKitTabs`). */
const TAB_BUTTONS = Object.freeze({ pools: ["addPool", "removePool"], students: ["auto"] });

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
        // DOM, which is the whole reason the kit's tabs (`kitTabs`) work this way.
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
    if (alreadyOpen("drpg-window-gmteam")) return RAISED;

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

    const footer = gmTeamButtons({ gms, actors, roster, candidates, removable });

    const result = await drpgWindow({
        title: game.i18n.localize("DRPG.Panel.despairFlow"),
        // `drpg-assign` was missing, and with it five stylesheet rules written
        // for exactly this window: the counts box, the asterisk marking an
        // implicit assignment, the dimming of an excluded row, the empty-state
        // line and the table's own spacing. All of them keyed off a class no
        // dialog carried, so this screen has been rendering unstyled.
        classes: ["drpg-panel", "drpg-projects", "drpg-monokuma-panel", "drpg-assign", "drpg-window-gmteam"],
        // On the kit's frame, as wide as its widest table (ui-kit.mjs `fitKitWidth`; utils.mjs `tableDialog` until E21 C2a),
        // opening at the GM's managers' width (E46-C5a): the Overflow's rules table holds four columns and its "what it
        // does" wraps, so a window opened narrower kept it in a 137 px column (Chromium, glass, 1366x768, 09.11.2026).
        width: "wide",
        fit: true,
        body: buildContent(actors, gms, roster, candidates, removable).innerHTML,
        footer,
        render: (event, dialog) => {
            /* A FOOTER PER TAB (E15 C6, 25.10.2026; audit S13-11, S10-62). Split evenly divides the
               students between the pools and stood in the footer of every tab, the pools' names among
               them, where a GM new to the window could not tell what it would divide; Add and Remove
               pool are the pools' tab's. Save and Close stay on every tab: one Save reads all four. */
            // `win` and `app`: the bar may widen the window, and a press puts it back on the screen (E21 C1b).
            wireKitTabs(dialog.element, { buttons: TAB_BUTTONS, always: ["save", "cancel"], win: dialog.element, app: dialog });
            // Anything typed in the copy that closed to add, revoke or re-divide a
            // pool (TEAM-01). After the tabs, so the panes exist to be painted.
            paintTeamDraft(dialog.element, draft);
            wireMonokumaLive(dialog);
            if (roster.length) wireAssignmentLive(dialog, gms);
            dialog.element.querySelector("[data-drpg-overflow-clear]")?.addEventListener("click", event => {
                event.preventDefault();
                void clearOverflowFromTab();
            });

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
                // The count is the GMs' store since E05 C12, whose write fires its own hook.
                watch: { settings: [SETTINGS.overflow], hooks: ["drpgOverflowChanged"] }
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

/*
 * FOUNDRY'S DEFAULT PORTRAIT IS NOT THE PICTURE (E105 FT-13, the owner's 11.11.2026 "pozbyc sie [...] miejsc gdzie
 * przebija sie grafika [...] z foundry"). An actor nobody gave a picture wears core's mystery man
 * (`CONST.DEFAULT_TOKEN`, icons/svg/mystery-man.svg), and the Monokumas tab drew it at the head of every such row: the
 * survey read five of five rows of the harness's world wearing it (despair-flow--monokumas, 54493dbf). The row now
 * draws the module's own unset portrait, icons/portrait-none.svg - a 12 x 12 bust in the item drawings' manner
 * (config.mjs `itemIcon`: a 16 x 16 view, crispEdges, ink #1a1620 on Bone #e8e3ec), the same in both themes as the
 * item drawings are. Only the row's picture: the actor's `img` is not read for anything else here and is not
 * written, and a picture somebody chose - anything that is not core's default - is drawn as it is.
 */
const UNSET_PORTRAIT = `modules/${MODULE_ID}/icons/portrait-none.svg`;
const CORE_PORTRAITS = new Set(["icons/svg/mystery-man.svg"]);
function shownPortrait(img) {
    const core = globalThis.CONST?.DEFAULT_TOKEN;
    return !img || CORE_PORTRAITS.has(img) || (core && img === core) ? UNSET_PORTRAIT : img;
}

function buildContent(actors, gms, roster, candidates, removable) {
    const L = key => game.i18n.localize(key);

    /* THE THREE TABLES ARE THE KIT'S (E46-C5a, 09.11.2026; card M3, STAGE E46's Despair Flow shape). At 3c952c67
       each tab drew a hand `<table>` with no class, its Monokuma column centred by an inline style; each is a
       `dataTable` now (ui-kit.mjs), today's columns in today's order, the fields' names and data attributes as they
       were - Save and the live wiring below read the same names (R2030). The columns' own rules are components.css's
       Despair Flow section (`drpg-data-col-despair-*`). */
    const poolTable = dataTable({
        columns: [
            { key: "account", label: L("DRPG.Despair.account") },
            { key: "name", label: L("DRPG.Despair.poolName") }
        ],
        rows: gms.map(u => ({
            account: foundry.utils.escapeHTML(u.name),
            name: `<input type="text" name="poolName.${u.id}" value="${foundry.utils.escapeHTML(poolLabel(u))}"
                       aria-label="${foundry.utils.escapeHTML(`${L("DRPG.Despair.poolName")}: ${u.name}`)}"
                       placeholder="${foundry.utils.escapeHTML(u.name)}" />`
        }))
    });

    const addRow = candidates.length ? `
        <label>${L("DRPG.Despair.grantTo")}
            <select name="newPoolCandidate">${candidates.map(u =>
                `<option value="${u.id}">${foundry.utils.escapeHTML(u.name)}</option>`).join("")}</select>
        </label>` : `<p class="notes">${L("DRPG.Despair.noCandidates")}</p>`;

    const removeRow = removable.length ? `
        <label>${L("DRPG.Despair.revokeFrom")}
            <select name="removePoolCandidate">${removable.map(u =>
                `<option value="${u.id}">${foundry.utils.escapeHTML(poolLabel(u))}</option>`).join("")}</select>
        </label>` : "";

    const poolSection = `
        <p>${L("DRPG.Despair.poolsIntro")}</p>
        ${poolTable}
        ${addRow}
        ${removeRow}`;

    const mkTable = dataTable({
        columns: [
            { key: "who", label: L("DRPG.Panel.character"), cls: "despair-who" },
            { key: "mark", label: L("DRPG.Monokuma.isMonokuma"), cls: "despair-mark" },
            { key: "pool", label: L("DRPG.Monokuma.pool") }
        ],
        rows: actors.map(actor => {
            const marked = isMonokuma(actor);
            const pool = poolFor(actor);
            const options = [
                `<option value="">${L("DRPG.Monokuma.noPool")}</option>`,
                ...gms.map(u => `<option value="${u.id}"${u.id === pool ? " selected" : ""}>${foundry.utils.escapeHTML(poolLabel(u))}</option>`)
            ].join("");
            return {
                actorId: actor.id,
                marked,
                who: `<img src="${foundry.utils.escapeHTML(shownPortrait(actor.img))}" alt="" class="drpg-monokuma-portrait" />${foundry.utils.escapeHTML(actor.name)}`,
                mark: `<input type="checkbox" name="mk.${actor.id}" data-drpg-mk ${marked ? "checked" : ""}
                       aria-label="${foundry.utils.escapeHTML(`${L("DRPG.Monokuma.isMonokuma")}: ${actor.name}`)}" />`,
                pool: `<span class="drpg-cell-none" data-drpg-pool-none${marked ? " hidden" : ""}>-</span>
                <select name="pool.${actor.id}" data-drpg-pool ${marked ? "" : "disabled hidden"}
                        aria-label="${foundry.utils.escapeHTML(`${L("DRPG.Monokuma.pool")}: ${actor.name}`)}">${options}</select>`
            };
        }),
        rowAttrs: r => ({ "data-actor": r.actorId, class: r.marked ? "drpg-is-monokuma" : null })
    });

    // The shared pool's warning: a kit box, written by `wireMonokumaLive` while two ticked Monokumas share a pool,
    // hidden while none do (E46-C5a; it was a red paragraph, E21's carried W site).
    const monokumaSection = `
        <p>${L("DRPG.Monokuma.panelIntro")}</p>
        <div class="drpg-monokuma-warning" hidden></div>
        ${mkTable}
        <p class="notes">${L("DRPG.Monokuma.panelNote")}</p>`;

    const assignSection = roster.length ? `
        <p>${L("DRPG.Assign.intro")}</p>
        <div class="drpg-assign-counts"></div>
        ${dataTable({
            columns: [
                { key: "who", label: L("DRPG.Panel.character"), cls: "despair-who" },
                { key: "pool", label: L("DRPG.Assign.monokuma") }
            ],
            rows: buildAssignRows(roster, gms),
            rowAttrs: r => ({ class: r.excluded ? "drpg-assign-excluded" : null })
        })}
        <p class="notes">${L("DRPG.Assign.footnote")}</p>` : "";

    // Three stacked sections made one long scroll; they are tabs now (Dawid,
    // 26.08). The mechanism is the kit's (ui-kit.mjs `kitTabs`/`wireKitTabs`)
    // because every tabbed window wears the same bar; the trick it depends on
    // is documented there - every pane stays in the DOM, so the single Save
    // that reads all the forms at once keeps working.
    //
    // SHORT LABELS OF THEIR OWN (E44 C4a, the owner's word on DR-E44-M1,
    // 04.11.2026: "skrocmy nazwy zakladek po prostu"). The tabs wore the old
    // <h3> headings, "Monokumas and Despair pools" among them, which a bar of
    // four equal tabs cut or folded; each tab has its own key now, and the
    // section titles they borrowed stay what they are where else they are read.
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
    const body = kitTabs([
        { key: "pools", label: game.i18n.localize("DRPG.Despair.tabPools"), html: poolSection },
        { key: "monokumas", label: game.i18n.localize("DRPG.Despair.tabMonokumas"), html: monokumaSection },
        ...(roster.length ? [{ key: "students", label: game.i18n.localize("DRPG.Despair.tabStudents"), html: assignSection }] : []),
        { key: "overflow", label: game.i18n.localize("DRPG.Despair.tabOverflow"), html: overflowSection({ suggestion: overflowSuggestionNow() }) }
    ]);

    // Built as an element, not a string: DialogV2 runs a string `content`
    // through `cleanHTML`, whose allow-list drops `placeholder` on a `<textarea>`
    // (v14 keeps it on an `<input>`). Built this way so a field that becomes a
    // textarea keeps its hint - the same reason every other form in this module
    // goes through `dialogContent()`.
    return dialogContent(`<form>${body}</form>`);
}

/**
 * The overflow threshold suggested for the season as it is (E20 C6, S02-59, D21): its living students and its pools,
 * or the line that waits for the cast. Beside the threshold's field in the Overflow tab.
 */
export function overflowSuggestionNow() {
    const living = studentCensus().count;
    return living > 0 ? overflowSuggestionLine(living, monokumas().length) : game.i18n.localize("DRPG.Overflow.suggestNone");
}

/** A never-assigned student's "(fallback)" option: Save writes no row for it (`readAssignmentForm` skips ""). */
const FALLBACK_PICK = "";

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
        /* THE FALLBACK SAYS SO IN THE SELECT (E15 C6, 25.10.2026; audit S10-62). A red "*" after the
           name read as "required", and the select showed the first pool as if the GM had chosen it.
           Now the pool a student falls back to is named "(fallback)" in its own option, the select dim
           and in italics until the GM picks something, the hint on it.
           THE FALLBACK IS AN OPTION OF ITS OWN (E15 part 1 fix e1-G4, 25.10.2026; findings
           E15p1-END-4, R3). The "(fallback)" option carried the pool's own id, so it was the only way to pick
           that pool: choosing it wrote nothing (its value was the one drawn), and a student could not be pinned
           to the first pool in one Save - a later full GM sorting first by name would move them (tier 2 E15-T8
           at c93be060: the pool picked, saved, no row). Now "(fallback)" is `FALLBACK_PICK` (""), which Save
           skips, beside every pool by its plain name, which Save writes. */
        const fallbackTo = gms.find(u => u.id === assigned) ?? gms.find(u => u.id === monokumaFor(actor)?.id) ?? gms[0];
        const shown = explicit ? options : [
            `<option value="${FALLBACK_PICK}" selected>${foundry.utils.escapeHTML(
                game.i18n.format("DRPG.Assign.fallbackOption", { name: poolLabel(fallbackTo) }))}</option>`,
            ...gms.map(u => `<option value="${u.id}">${foundry.utils.escapeHTML(poolLabel(u))}</option>`),
            `<option value="${NO_MONOKUMA}">${game.i18n.localize("DRPG.Assign.nobody")}</option>`
        ].join("");

        // What the row held as it was drawn (S10-47): Save writes a row the GM changed or one the world
        // already held, and leaves a fallback a fallback (`readAssignmentForm`).
        return {
            excluded,
            who: foundry.utils.escapeHTML(actor.name),
            pool: `<select name="assign.${actor.id}" data-drpg-assign data-drpg-was="${explicit ? assigned : FALLBACK_PICK}"
                        data-drpg-fallback="${fallbackTo.id}" data-drpg-explicit="${explicit ? 1 : 0}"
                        ${explicit ? "" : `class="drpg-assign-fallback" data-tooltip="${foundry.utils.escapeHTML(game.i18n.localize("DRPG.Assign.implicitHint"))}"`}
                        aria-label="${foundry.utils.escapeHTML(`${game.i18n.localize("DRPG.Assign.monokuma")}: ${actor.name}`)}">${shown}</select>`
        };
    });
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

            // A pool means something only for a Monokuma: an actor not ticked shows a "-" (S10-62).
            select.disabled = !box.checked;
            select.hidden = !box.checked;
            const none = row.querySelector("[data-drpg-pool-none]");
            if (none) none.hidden = box.checked;
            if (!box.checked) continue;

            const value = select.value;
            if (!value) continue;
            if (!used.has(value)) used.set(value, []);
            used.get(value).push(row.querySelector("td")?.textContent?.trim() ?? "?");
        }

        if (!warning) return;
        const clashes = Array.from(used.entries()).filter(([, names]) => names.length > 1);
        warning.innerHTML = clashes.length
            ? box("warning", clashes.map(([userId, names]) =>
                  game.i18n.format("DRPG.Monokuma.sharedPool", {
                      name: foundry.utils.escapeHTML(poolLabel(game.users.get(userId))),
                      actors: foundry.utils.escapeHTML(names.join(", "))
                  })).join("<br>"))
            : "";
        warning.hidden = !clashes.length;
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
            const pool = select.value === FALLBACK_PICK ? select.dataset.drpgFallback : select.value;
            if (pool === NO_MONOKUMA) excluded++;
            else if (pool in tally) tally[pool]++;
            select.closest("tr")?.classList.toggle("drpg-assign-excluded", select.value === NO_MONOKUMA);
            // Dim only while it is still the fallback nobody chose.
            select.classList.toggle("drpg-assign-fallback", select.dataset.drpgExplicit !== "1" && select.value === select.dataset.drpgWas);
        }

        const counts = gms.map(u =>
            `<span class="drpg-assign-count"><strong>${foundry.utils.escapeHTML(poolLabel(u))}</strong>: ${tally[u.id]}</span>`
        );
        if (excluded) {
            counts.push(`<span class="drpg-assign-count drpg-assign-none">${game.i18n.localize("DRPG.Assign.outside")}: ${excluded}</span>`);
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

/*
 * ONLY WHAT THE GM SET (E15 C6, 25.10.2026; audit S10-47). Every row was written, so a Save that only
 * renamed a pool turned each student's fallback ("*") into an explicit assignment to the first pool,
 * and the window stopped showing who had never been assigned; a student just ticked as a Monokuma on
 * the next tab was given an assignment too. Measured at 8de5a242 by tier 2 (E15-T8): a rename and
 * a student ticked a Monokuma wrote all four students. Now a row is written when the world held one or the
 * GM changed its select (`data-drpg-was`, what it showed when drawn), and a row whose actor is ticked
 * a Monokuma is left out. The setting is written whole (assignments.mjs `setAssignments`), so a row
 * left out stays a fallback.
 */
function readAssignmentForm(dialog, roster) {
    const root = dialog.element;
    const map = {};
    for (const actor of roster) {
        const select = root.querySelector(`[name="assign.${CSS.escape(actor.id)}"]`);
        if (!select?.value) continue;   // "(fallback)" (`FALLBACK_PICK`): a fallback stays one
        if (root.querySelector(`[name="mk.${CSS.escape(actor.id)}"]`)?.checked) continue;
        if (select.dataset.drpgExplicit === "1" || select.value !== select.dataset.drpgWas) map[actor.id] = select.value;
    }
    return map;
}
