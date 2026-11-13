/**
 * Danganronpa RPG - the Students window.
 * ---------------------------------------------------------------------------
 * The GM panel's Students tile: every student with their state, the dead
 * included, for the GM to change it. The table, rebuilt in place while the
 * window stands open (`aliveTableHtml`), with a row's Refund last crossing
 * (`refundButton`); the row buttons that close the window, run a procedure and
 * bring it back as one promise (`wireAliveRow`), and the donation's wiring
 * (`wireAliveTable`); the window itself (`openWhoIsAliveDialog`) and what its
 * Apply writes, driven by the answer it is handed (`applyAliveStates`).
 *
 * WHERE IT SITS. Moved out of gm-panel.mjs by E41 C7a (1.2.97), a pure move
 * that `node tools/moved-only.mjs` proves line by line. gm-panel.mjs re-exports
 * the two names here it exported before (`openWhoIsAliveDialog`,
 * `applyAliveStates`), so every importer still imports gm-panel.mjs, and the
 * panel's tile reaches the window through it; nothing here imports it back (the
 * facade rule, .claude/rules/code.md). `applyAliveStates` stands last, so a cut
 * of it by name runs to this file's end (tier 0 R66, R67).
 *
 * EVERY CHARACTER, ON THE KIT (E47-C8, 09.11.2026; the owner's 09.11 ask and
 * Q-E47-3). The table is the kit's `dataTable`, and every row carries the
 * character's Role (`changeRole`), its Level Up and its Items: the students
 * first, then the Monokumas and the characters not in the class, so a mark made
 * here can be undone here. Each control calls a road that exists - the sheet
 * header's - with its own row's actor; the window adds no road.
 */

import { studentActors, isMonokuma, isNotInClass, isSpectator, markFromSheet, setMonokuma, setNotInClass, setSpectator } from "./monokuma.mjs";
import { error, plural, esc, wholeNumber } from "./utils.mjs";
import { stepper, drpgWindow, dataTable, iconButton, roleButton } from "./ui-kit.mjs";
import { keepLive, alreadyOpen, handOff, RAISED } from "./live.mjs";
import { crossingStore } from "./gm-stores.mjs";
import { actionsLeft, actionsMax, hasFreeMove } from "./actions.mjs";

import { tipAttr, tipText } from "./ui-kit.mjs";

/**
 * WHO IS ALIVE - three windows, one table.
 * ---------------------------------------------------------------------------
 * "A character dies", the Monocub manager and the alive/dead/Monocub repair
 * table were three tiles in two sections answering one question about one
 * cast, and each of them could only see part of it: the death dialog listed
 * only the living, the Monocub dialog only the dead, and the repair table
 * could move the flags but refused to run either procedure properly.
 *
 * THE DROPDOWN IS STILL THE REPAIR TOOL, exactly as it was - it moves the two
 * flags and nothing else, which is what you want after a mis-click. The two
 * row buttons are the real procedures:
 *
 *   Kill                 `openDeathDialog` for that one character, with the
 *                        warning about the inventory it destroys.
 *   Invite as a Monocub  the guide's offer to somebody already dead.
 *
 * The Monocub half of the old window comes across whole: how much Hope a cub
 * is holding, the donation control that spends a real Despair pool, and the
 * silence a cub is put under after a crime they watched.
 *
 * Built from a list of everything the three windows did, checked off after the
 * merge - see the stage's verification. The one thing deliberately NOT carried
 * across is the death dialog's own character picker: this table is the picker.
 */
/*
 * THE TABLE, REBUILDABLE. Everything above is a function of the world now,
 * so this can be called again in place while the window stays open.
 */
function aliveTableHtml({ roster, others, stateOf, donors, isCrimeSilenced, resourceValue, resourceMax, levelUp, offers }) {
    /*
     * THE THREE MONOCUB COLUMNS ARE ALWAYS THERE (E49 A3, 11.11.2026; the owner's "Tak, naprawiamy oba" and the rule of
     * 10.11: a state changes look, never layout). From D-F4 to E49 they appeared the moment somebody accepted the
     * invitation and not before - three columns that a death mid-session added under the GM's hand, the table widening
     * and every column after them moving. D-F4's reason was the cost of the headings ("Turn a Monokuma's Despair into
     * Hope") on a table two thirds dashes; the owner chose the fixed layout over that width. A student who is not a
     * Monocub reads a dimmed "-" in the three (`drpg-alive-none`, its words "Not a Monocub" as aria-label and tooltip),
     * a Monokuma's or an NPC's row empty cells, as the Actions and Free Move columns read (A2).
     */

    const L = key => game.i18n.localize(key);

    /*
     * A STUDENT'S ROW is today's: the State select (the repair tool), the three Monocub cells (a dimmed "-" unless a Monocub),
     * and the Do cell's procedures. E47-C8 puts the Role select after the name and the Level Up before Do, and the
     * Items button beside the name (the owner's 09.11 ask).
     */
    const studentRow = a => {
        const state = stateOf(a);
        const cub = state === "monocub";

        /*
         * CALLED, not read (E47-C8): `anyCub` was a function read as a value, always truthy, so the cub cells were built
         * on every row under a head of three columns fewer. Since E49 A3 there is no gate to misread: the cells and the
         * heads are built on every student's row and in every table.
         */
        const none = `<span class="drpg-alive-none" aria-label="${esc(L("DRPG.Monocub.notCub"))}" data-tooltip="${esc(L("DRPG.Monocub.notCub"))}">-</span>`;
        const cubCells = {
            hope: cub ? `${resourceValue(a, "hope")} / ${resourceMax(a, "hope")}` : none,
            give: !cub ? none : donors ? `
                <select name="donor:${a.id}"${tipAttr("DRPG.Tips.Gm.monokumaPoolTooltip")}>${donors}</select>
                ${stepper({ name: `amount:${a.id}`, value: 1, min: 1, compact: true,
                    attrs: { "data-tooltip": tipText("DRPG.Tips.Gm.amountTooltip") } })}
                <button type="button" class="drpg-mini-button" data-drpg-give="${a.id}"${tipAttr("DRPG.Tips.Gm.giveTooltip")}>
                    ${L("DRPG.Monocub.give")}</button>` : "-",
            silenced: cub
                ? `<input type="checkbox" name="silenced:${a.id}" ${isCrimeSilenced(a) ? "checked" : ""} />`
                : none
        };

        /*
         * ACTIONS AND FREE MOVE (E49 A2, 10.11.2026; the owner's Q6 "tak": two columns of each row). The GM panel's
         * own table went for one line (gm-panel.mjs `studentsLeftHtml`), and its two figures came here: what is left of
         * the action budget of the time of day against its maximum, and the free Move as the panel drew it - the
         * footprint solid while the step is there, outline once it is spent, the sheet's own pair. Read for a student
         * who acts (alive, or a Monocub, as monokuma.mjs `actingStudents` counts them); a dead student's two cells read
         * "-", so the columns stand in every row whatever the state (the owner's rule of the same day: a state changes
         * look, never layout).
         */
        const acts = state === "alive" || cub;
        const free = acts && hasFreeMove(a);
        const moveWord = L(free ? "DRPG.Actions.freeMoveAvailable" : "DRPG.Actions.freeMoveSpent");
        const economy = !acts ? { actions: "-", freeMove: "-" } : {
            actions: `<span data-drpg-actions-left="${actionsLeft(a)}">${actionsLeft(a)} / ${actionsMax(a)}</span>`,
            freeMove: `<i class="${free ? "fa-solid" : "fa-regular"} fa-shoe-prints drpg-pix-foot" data-drpg-free-move="${free ? "yes" : "no"}"`
                + ` role="img" aria-label="${esc(moveWord)}" data-tooltip="${esc(moveWord)}"></i>`
        };

        return {
            id: a.id, ...shared(a), ...cubCells, ...economy,
            // Its name, not its options' words (E48 K4: a11y.mjs no longer names a select by what it holds).
            state: `<select name="state.${a.id}" aria-label="${esc(`${L("DRPG.Panel.stateColumn")} - ${a.name}`)}"${tipAttr("DRPG.Tips.Gm.stateTooltip")}>
                ${(state === "unfound" ? ["alive", "unfound", "dead", "monocub"] : ["alive", "dead", "monocub"]).map(sKey =>
                    `<option value="${sKey}"${sKey === state ? " selected" : ""}>${
                        L(sKey === "unfound" ? "DRPG.Chapter.deadUnfound" : `DRPG.Panel.state.${sKey}`)}</option>`).join("")}
            </select>`,
            do: `${state === "alive"
                ? `<button type="button" class="drpg-mini-button drpg-gm-route"
                       data-drpg-kill="${a.id}"${tipAttr("DRPG.Tips.Gm.aCharacterDiesTooltip")}>${L("DRPG.Chapter.deathTitle")}</button>`
                : state === "dead"
                    ? `<button type="button" class="drpg-mini-button" data-drpg-cub="${a.id}"${tipAttr("DRPG.Tips.Gm.inviteAsAMonocubTooltip")}>${L("DRPG.Monocub.invite")}</button>`
                    : ""}${refundButton(a)}`
        };
    };

    /*
     * A MONOKUMA'S OR AN NPC'S ROW (Q-E47-3): the name, Items, the Role and the Level Up its sheet gives - no State, no
     * Monocub cells and nothing to do, since neither is a student (E24's gates: no death, no ballot, no invitation).
     * Without the row, a character marked out of the class here would leave the one row that marks it back.
     */
    const otherRow = a => ({ id: a.id, ...shared(a), state: "", actions: "", freeMove: "", hope: "", give: "", silenced: "", do: "" });

    /*
     * THE SHEET AND ITEMS BUTTONS IN A COLUMN OF THEIR OWN (E92 owner fix, 12.11.2026; the owner: "przyciski karty postaci
     * i dania przedmiotu niech beda w osobnej kolumnie niz imie i nazwisko, zawsze na tej samej szerokosci"). They stood
     * after the name in its cell, so each row's buttons began where its name ended. Now the name's cell holds the name
     * alone and the next cell the two buttons, the sheet's then the items', in every row; a Monokuma, whose sheet has no
     * Inventory, keeps the items' slot empty (a copy of the button no one sees, reads or reaches with Tab), so its sheet
     * button stands where every other row's does. components.css gives the column one fixed width (R3862).
     */
    const sheetButton = a => iconButton({ icon: "fa-solid fa-id-card", label: game.i18n.format("DRPG.Panel.openSheet", { name: a.name }),
        cls: "drpg-mini-button", attrs: { "data-drpg-sheet": a.id } });
    const itemsButton = a => iconButton({ icon: "fa-solid fa-box-open", label: L("DRPG.Items.hubButton"), cls: "drpg-mini-button", attrs: { "data-drpg-items": a.id } });
    const keptSlot = () => iconButton({ icon: "fa-solid fa-box-open", label: L("DRPG.Items.hubButton"), cls: "drpg-mini-button drpg-alive-slot",
        attrs: { "data-drpg-items-slot": "", "aria-hidden": "true", tabindex: "-1" }, disabled: true });

    /*
     * What every row carries: the name with its sheet and its Items, the Role, the Level Up. NO ITEMS ON A MONOKUMA'S ROW (E95 C7; the owner's 10.11): its sheet has no Inventory tab, so no road opens one.
     THE SHEET FROM THE ROW
     * (E95 C6; the owner's 10.11): an icon button beside the name opens that character's sheet (`openSheet`, the
     * actor's own `sheet.render(true)`, so a second press brings the one window forward instead of drawing another),
     * a student's, a Monokuma's and an NPC's alike; its label, the tooltip and the aria-label, names the character.
     */
    const shared = a => {
        const role = roleOf(a);
        const n = offers(a);
        return {
            name: esc(a.name),
            open: `${sheetButton(a)}${role === "monokuma" ? keptSlot() : itemsButton(a)}`,
            role: `<select name="role:${a.id}" data-drpg-role-select="${a.id}" aria-label="${esc(`${a.name}: ${L("DRPG.Panel.roleColumn")}`)}"${tipAttr("DRPG.Tips.Gm.roleTooltip")}>${
                ROLES.map(r => `<option value="${r}"${r === role ? " selected" : ""}>${L(ROLE_WORDS[r])}</option>`).join("")}</select>`,
            levelUp: !levelUp(a) ? "" : roleButton({ role: "secondary", cls: "drpg-mini-button", attrs: { "data-drpg-levelup": a.id },
                label: n ? plural("DRPG.Advance.standing", { n }) : L("DRPG.Advance.buttonTooltip") })
        };
    };

    const students = roster();
    const rest = others();
    // The Spectators (E92 C1) are a group of their own, with the NPC's row: no State, nothing to do - no student.
    const groups = [["students", students, studentRow], ["monokumas", rest.filter(a => roleOf(a) === "monokuma"), otherRow],
        ["spectators", rest.filter(a => roleOf(a) === "spectator"), otherRow],
        ["notInClass", rest.filter(a => roleOf(a) === "npc"), otherRow]].filter(([, list]) => list.length);
    // One group needs no heading: the rows say it already.
    const headed = groups.length > 1;
    const rows = groups.flatMap(([key, list, build]) => [...(headed ? [{ group: L(`DRPG.Panel.group.${key}`), count: list.length }] : []), ...list.map(build)]);
    const columns = [
        { key: "name", label: L("DRPG.Panel.character"), cls: "name" },
        { key: "open", label: L("DRPG.Panel.openColumn"), cls: "open" },
        { key: "role", label: L("DRPG.Panel.roleColumn") },
        { key: "state", label: L("DRPG.Panel.stateColumn") },
        { key: "actions", label: L("DRPG.Actions.label") },
        { key: "freeMove", label: L("DRPG.Panel.freeMove") },
        { key: "hope", label: L("DRPG.Monocub.hope") }, { key: "give", label: L("DRPG.Monocub.giveHopeColumn") },
        { key: "silenced", label: L("DRPG.Monocub.silenced"), cls: "silenced", tooltip: L("DRPG.Monocub.silencedNote") },
        { key: "levelUp", label: L("DRPG.Panel.levelUpColumn") },
        { key: "do", label: L("DRPG.Panel.doColumn") }
    ];
    return `<div class="drpg-alive-live">
        <p class="notes">${L("DRPG.Panel.whoIsAliveNote")}</p>
        ${dataTable({ columns, rows, rowAttrs: r => ({ "data-actor": r.id }) })}
    </div>`;
}

/*
 * THE ROLE (E47-C8, 09.11.2026; the owner's 09.11 ask). Student, Monokuma or Not in the class, as the sheet's own
 * `sheetMode` reads the two flags (a Monokuma first: a character carrying both is a Monokuma). The select acts when it
 * is changed, never on Apply, through the sheet header's roads (sheet.mjs `injectClassControls`), which are a GM's
 * alone - each refuses a player itself (`game.user.isGM`), and a player's own write of either flag is put back by the
 * GMs' audit (sheet-audit.mjs `GM_FLAGS`, E24 fix G1):
 *   to Monokuma           monokuma.mjs `markFromSheet` - a player's character is asked first, Cancel the default;
 *   from Monokuma         `setMonokuma(actor, false)` - not asked, as on the sheet;
 *   to / from out         `setNotInClass(actor, true | false)`.
 * Monokuma to Not in the class is the two in order (unmark, then mark out). Not in the class to Monokuma marks FIRST
 * and unmarks out after a yes: STAGE.md's order (unmark out, then mark) wrote the unmark before the ask, so a Cancel
 * left a student who had been an NPC. Answers whether the role moved; false when the ask was cancelled or a road refused.
 * `roads` is the suite's to hand (R2081, R2084, R3851): stand-ins for the four, each called as the module's own.
 *
 * THE SPECTATOR, A FOURTH ROLE (E92 C1, 12.11.2026; the owner's 04.11 amend: "the GM assigns it in the Students
 * window"): monokuma.mjs `setSpectator(actor, true | false)`, a GM's road as the other two. The role it leaves is
 * unmarked first (a Monokuma's by `setMonokuma(actor, false)`, an NPC's by `setNotInClass(actor, false)`), then the
 * flag set; to Monokuma marks first and unmarks the Spectator after a yes, as from an NPC. A Monokuma flag wins over it
 * (`roleOf`, as the sheet reads a character carrying both), and a Spectator over "Not in the class".
 */
const ROLES = Object.freeze(["student", "monokuma", "spectator", "npc"]);
const ROLE_WORDS = Object.freeze({ student: "DRPG.Panel.role.student", monokuma: "DRPG.Monokuma.isMonokuma", spectator: "DRPG.Spectator.role",
    npc: "DRPG.Class.notInClass" });
const ROLE_ROADS = Object.freeze({ markFromSheet, setMonokuma, setNotInClass, setSpectator });

/** The role a character holds by its flags, as the window's select names it. */
function roleOf(actor) {
    return isMonokuma(actor) ? "monokuma" : isSpectator(actor) ? "spectator" : isNotInClass(actor) ? "npc" : "student";
}

/** Move `actor` to the role `to` through the roads above; see the note above. */
export async function changeRole(actor, to, roads = {}) {
    if (!actor || !ROLES.includes(to)) return false;
    const from = roleOf(actor);
    if (from === to) return false;
    const road = { ...ROLE_ROADS, ...roads };
    if (to === "monokuma") {
        if (!(await road.markFromSheet(actor))) return false;
        if (from === "spectator") return Boolean(await road.setSpectator(actor, false));
        return from === "npc" ? Boolean(await road.setNotInClass(actor, false)) : true;
    }
    if (from === "monokuma" && !(await road.setMonokuma(actor, false))) return false;
    if (from === "spectator" && !(await road.setSpectator(actor, false))) return false;
    if (to === "spectator") {
        if (isNotInClass(actor) && !(await road.setNotInClass(actor, false))) return false;
        return Boolean(await road.setSpectator(actor, true));
    }
    // The sheet sets the two flags apart: a Monokuma marked out as well is out already, and is unmarked out on its way to student.
    if (to === "npc") return isNotInClass(actor) ? true : Boolean(await road.setNotInClass(actor, true));
    return isNotInClass(actor) ? Boolean(await road.setNotInClass(actor, false)) : true;
}

/*
 * REFUND LAST CROSSING (E17 C3, 26.10.2026; audit S07-16, D18). On the row of a character whose newest crossing the GMs
 * hold and have not given back (gm-stores.mjs `crossingStore`); its tooltip names the two rooms. One click gives it back
 * on the primary GM (bridge-asks.mjs `requestRefundCrossing`, movement.mjs `refundLastCrossing`); the store's change
 * redraws the row on every GM (`drpgCrossingsChanged`), so the button goes once it is used, wherever it was pressed.
 */
function refundButton(actor) {
    const row = crossingStore.get(actor.id);
    if (!row || row.refunded) return "";
    const outside = game.i18n.localize("DRPG.Movement.outsideRooms");
    const note = game.i18n.format("DRPG.Panel.refundCrossingNote", { from: row.from ?? outside, to: row.to ?? outside });
    // On the kit's secondary role (E47-C8): a button that answers nothing of the window's, beside the row's procedures.
    return ` ${roleButton({ role: "secondary", cls: "drpg-mini-button", attrs: { "data-drpg-refund": actor.id, "data-tooltip": note }, label: game.i18n.localize("DRPG.Panel.refundCrossing") })}`;
}

// The per-row buttons act at once rather than waiting for Apply: each one
// runs a real procedure - a death that empties an inventory, a donation
// that spends a Despair pool - and a GM who then cancels the form should
// not find those undone with it. The window closes and reopens so the table
// is rebuilt around what actually happened.
/*
 * WHICH ROW ACTIONS CLOSE THIS WINDOW, AND WHICH DO NOT (E6).
 *
 * An action that opens a window of its own closes this one first and brings
 * it back after: the death dialog is a place the GM goes and comes back
 * from, and so is the item manager behind a row's Items button (the footer's
 * until E47-C8) - D-F5-2 settled that one deliberately, its own Close is the
 * one exit - and the Level Up's menu.
 *
 * An action that opens NOTHING has no reason to. `setMonocub` writes a flag;
 * closing and reopening the whole table for it threw away the GM's scroll
 * position to show them a row that `keepLive` was already about to redraw
 * on `updateActor`. So `keepOpen` leaves the window alone and lets the live
 * region do what it is for.
 */
/*
 * A WINDOW THAT CLOSES IN ORDER TO COME BACK HAS NOT FINISHED (F7, 20.09).
 *
 * `tableDialog` is `DialogV2.wait`, which resolves the moment this window
 * closes, whoever closed it - so the reopen used to happen OUTSIDE the promise
 * the caller is holding. The GM panel awaits `item.run()`, that resolved on
 * the close, and `openGmPanel()` ran before the GM had answered the death
 * dialog the row had just opened: three windows on screen for one action, and
 * the panel in front of the one being asked a question.
 *
 * So the whole round trip - close, do the thing, open the table again - is ONE
 * promise, handed to `onHandOff` in the same turn as the close and returned by
 * `openWhoIsAliveDialog`. See `handOff` (live.mjs) for why it cannot be written
 * with an `await` in front of it. The footer's Items button had this shape
 * from the start; the row buttons did not, and since E47-C8 Items is a row's.
 */
function wireAliveRow(dialog, attribute, run, { keepOpen = false, onHandOff = null, reopen = () => openWhoIsAliveDialog() } = {}) {
        for (const button of dialog.element.querySelectorAll(`[${attribute}]`)) {
            button.addEventListener("click", async ev => {
                ev.preventDefault();
                const actor = game.actors.get(button.getAttribute(attribute));
                if (!actor) return;
                const work = async () => {
                    try {
                        await run(actor, dialog);
                    } catch (err) {
                        error(`GM panel: "${attribute}" failed`, err);
                    }
                };
                // A row that opens nothing leaves the window alone and lets the
                // live region redraw it - see the note above.
                if (keepOpen) return void await work();
                const trip = handOff(dialog, async () => {
                    await work();
                    return reopen();
                });
                onHandOff?.(trip);
            });
        }
}

/*
 * THE ROLE SELECT ACTS ON CHANGE (E47-C8), wired beside the row buttons: `wireAliveRow` answers a click, this a
 * select's `change`. The window stays (the owner's ask; `keepOpen`'s reason, E6): the role's flags are an actor's, and
 * `keepLive` draws the row again from them. A change that did not happen - the ask cancelled, a road refusing, a
 * failure - puts the select back on the role the character holds, since nothing redraws a row nothing wrote.
 */
function wireRoleSelects(dialog, roads) {
    for (const select of dialog.element.querySelectorAll("select[data-drpg-role-select]")) {
        select.addEventListener("change", async () => {
            const actor = game.actors.get(select.dataset.drpgRoleSelect);
            if (!actor) return;
            const held = roleOf(actor);
            let moved = false;
            select.disabled = true;
            try {
                moved = await changeRole(actor, select.value, roads);
            } catch (err) {
                error(`GM panel: the role of ${actor.name} did not change`, err);
            } finally {
                select.disabled = false;
                if (!moved) select.value = roleOf(actor) ?? held;
            }
        });
    }
}

/*
 * WIRED IN A FUNCTION, because `keepLive` replaces the table's DOM
 * and every listener on it goes with the nodes. A live region whose
 * buttons stopped working would be worse than a stale one: the GM
 * reads a table that is true and presses a Kill that does nothing.
 *
 * `onHandOff` carries a row's round trip back to the window (F7) - see the
 * note above `wireAliveRow`.
 */
function wireAliveTable(dialog, { openDeathDialog, setMonocub, onHandOff, roads, reopen }) {
    // The full death procedure, on the one character the row is about.
    // `openDeathDialog` owns the warning about the inventory and the
    // "keep their things" choice; repeating either here would be a
    // second copy of a rule that can only be right in one place.
    wireAliveRow(dialog, "data-drpg-kill", actor => openDeathDialog({ actor }), { onHandOff, reopen });
    /*
     * ITEMS ON EVERY ROW (E47-C8; the owner's 09.11 ask: "no single Items button that then asks which student - each
     * row its own Items button beside the name"). The round trip the footer's Items made (D-F5-2): this window closes,
     * the hub runs to its own Close, the table comes back. The Level Up is the sheet's GM button's road
     * (`openAdvancementFor`, sheet.mjs `injectAdvanceButton`), a window of its own, so the same round trip.
     */
    wireAliveRow(dialog, "data-drpg-items", actor => roads.openItemManager(actor), { onHandOff, reopen });
    // The sheet is a window of its own that does not end in an answer, so the table stays where it is (E6), beside it.
    wireAliveRow(dialog, "data-drpg-sheet", actor => roads.openSheet(actor), { keepOpen: true, reopen });
    wireAliveRow(dialog, "data-drpg-levelup", actor => roads.openAdvancementFor(actor), { onHandOff, reopen });
    wireRoleSelects(dialog, roads);
    // The Silenced head's tooltip (`DRPG.Monocub.silencedNote`) is its column's `tooltip` since E47-KFa (set on the drawn head before).
    // No window of its own, so the table stays where it is (E6).
    wireAliveRow(dialog, "data-drpg-cub", actor => setMonocub(actor, true),
        { keepOpen: true, reopen });
    // Nothing of its own to open either (E17 C3): the store's change redraws the row.
    wireAliveRow(dialog, "data-drpg-refund", actor => import("./gm-bridge.mjs").then(m => m.requestRefundCrossing(actor.id)),
        { keepOpen: true });

    for (const button of dialog.element.querySelectorAll("[data-drpg-give]")) {
        button.addEventListener("click", async ev => {
            ev.preventDefault();
            const id = button.dataset.drpgGive;
            const actor = game.actors.get(id);
            const donorId = dialog.element.querySelector(`[name="donor:${id}"]`)?.value;
            const amount = wholeNumber(dialog.element.querySelector(`[name="amount:${id}"]`)?.value, { min: 0, fallback: 0 });
            if (!actor || !donorId || amount <= 0) return;

            const { convertDespairToHope } = await import("./despair.mjs");
            await convertDespairToHope(donorId, actor, amount);
            /*
             * The window stays open (E6). This changes two resources on
             * two actors, and `keepLive` here watches actors - so the
             * two rows redraw themselves with the new numbers while the
             * GM is still looking at the row they pressed, instead of
             * the whole table blinking out and coming back scrolled to
             * the top.
             */
        });
    }
}

/**
 * The Students window (the panel's tile); exported for tier 2's click of its Refund last crossing (E17 fix e1-G2).
 * A GM's: on a player's browser it opens nothing (E47-C8, R2084), as each road its rows call refuses a player.
 * `roads` is the suite's to hand (R2081-R2083): stand-ins for `markFromSheet`, `setMonokuma`, `setNotInClass`,
 * `openAdvancementFor` and `openItemManager`, carried into the window a round trip opens again.
 */
export async function openWhoIsAliveDialog(options = {}) {
    if (!game.user.isGM) return;
    // ONE OF THESE, NOT FOUR - see `alreadyOpen` in live.mjs. Two copies of a
    // window each read the world when they opened and neither knows about the
    // other, so the older one goes on looking authoritative while showing
    // something that stopped being true. Raised rather than refused: pressing
    // twice usually means the window is behind something.
    if (alreadyOpen("drpg-window-alive")) return RAISED;

    // `killCharacter`, `reviveCharacter` and `setSilenced` went with the apply loop
    // (F15): `applyAliveStates` below imports what it writes.
    const { isDeceased, isDeadForGm, openDeathDialog } = await import("./chapter.mjs");
    const { isMonocub, setMonocub, isCrimeSilenced } = await import("./monocub.mjs");
    const { monokumas, donorLabel } = await import("./despair.mjs");
    const { resourceValue, resourceMax } = await import("./character.mjs");
    // The sheet's own gate for its Level Up and the GMs' store of offers (E47-C8): read, never copied.
    const { sheetMode } = await import("./sheet.mjs");
    const { standingOffers, openAdvancementFor } = await import("./level-up.mjs");
    const roads = {
        ...ROLE_ROADS,
        openAdvancementFor,
        openItemManager: actor => import("./gm-items.mjs").then(m => m.openItemManager(actor)),
        openSheet: actor => actor.sheet?.render(true),
        ...(options?.roads ?? {})
    };
    const reopen = () => openWhoIsAliveDialog(options);

    /*
     * READ FRESH, because somebody dies while this window is open (E22, E17).
     *
     * The table used to be built once from the cast as it stood, and a death,
     * a revival or a Monocub accepting the invitation reached it only if the GM
     * closed and reopened. `keepLive` rebuilds it in place instead - and the
     * roster has to be a function for the same reason the rows do, because a
     * character created mid-session would otherwise have a row nobody reads on
     * Apply.
     */
    const roster = () => studentActors();
    /* EVERY OTHER CHARACTER (Q-E47-3): the Monokumas and the characters not in the class, for their Role, Items and
       Level Up. Apply reads `roster()` alone, as before - a Monokuma and an NPC have no State to write. */
    const others = () => {
        const students = new Set(roster().map(a => a.id));
        return game.actors.filter(a => a.type === "character" && !students.has(a.id));
    };
    // A world whose last student was marked out still opens: the row that marks them back is here.
    if (!roster().length && !others().length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.noCharacters"));
        return;
    }

    /* "Dead, not found" (E05 C10): a death kept by the GMs, which only this window and the
       body's discovery make known - choosing "dead" here publishes it (`applyAliveStates`). */
    const stateOf = a => isMonocub(a) ? "monocub" : isDeceased(a) ? "dead" : isDeadForGm(a) ? "unfound" : "alive";
    /*
     * CALLED, NOT READ ONCE (F15, 20.09). This was a string, built when the
     * window opened, and the table rebuilds itself on every actor change - so
     * every redraw put the same figures back: a pool that had just paid for a
     * donation went on offering the Despair it no longer had, and a Monokuma who
     * opted in while the window stood open never appeared in the list at all. The
     * row above it made exactly this mistake with `anyCub` and says so.
     *
     * What each pool can spend, and what it owes (E05 C12): a conversion's Despair is
     * taken from the pool at the next time of day (despair.mjs `donorLabel`).
     */
    const buildDonors = () => monokumas().map(u =>
        `<option value="${u.id}">${esc(donorLabel(u))}</option>`).join("");

    const table = () => {
        const donors = buildDonors();
        return aliveTableHtml({ roster, others, stateOf, donors, isCrimeSilenced, resourceValue, resourceMax,
            levelUp: a => Boolean(sheetMode(a, game.user).levelUp), offers: a => standingOffers(a).length });
    };

    // A row button's round trip, if one is running: this window did not answer,
    // it handed over (F7). Set by `wireAliveRow` through the callback below.
    let roundTrip = null;

    const chosen = await drpgWindow({
        title: game.i18n.localize("DRPG.Panel.whoIsAlive"),
        /* `drpg-projects` went (E47-C8): the project windows' rules (E47-C6's to delete) reached this table through it;
           the four that did - the table's width, the select's, the rows' wash and their hover - are the window's own
           in components.css. */
        classes: ["drpg-panel", "drpg-window-alive"],
        // On the kit's frame, as wide as its widest table (ui-kit.mjs `fitKitWidth`; utils.mjs `tableDialog` until E21 C2a).
        fit: true,
        body: `<form>${table()}</form>`,
        footer: {
            primary: {
                action: "save", label: game.i18n.localize("DRPG.Panel.apply"),
                callback: (e, b, d) => Object.fromEntries(roster().map(a => [a.id, {
                    state: d.element.querySelector(`[name="state.${a.id}"]`)?.value ?? null,
                    silenced: Boolean(d.element.querySelector(`[name="silenced:${a.id}"]`)?.checked)
                }]))
            },
            /* ITEMS ON EVERY ROW, NOT IN THE FOOTER (E47-C8): the owner's 09.11 ask reverses "ITEMS FROM THE FOOTER,
               NOT FROM EVERY ROW (Dawid, 03.09)" - each row's Items opens the hub on its own character. */
            // Apply is still to answer: Cancel (E21 rule 3), the answer "cancel" as before.
            close: { role: "cancel", action: "cancel" }
        },
        render: (event, dialog) => {
            const wireAll = () => wireAliveTable(dialog, {
                openDeathDialog, setMonocub, onHandOff: trip => { roundTrip = trip; }, roads, reopen
            });

            wireAll();
            /*
             * A DEATH IS AN ACTOR FLAG, so `watch: { actors: true }` is what
             * carries it here - the same listener the GM panel's own standing
             * line uses. E17's criterion for this window is exactly that: kill
             * somebody while it is open and watch the row change without
             * touching it.
             */
            keepLive(dialog, {
                region: ".drpg-alive-live",
                build: table,
                // A death kept by the GMs writes no actor (E05 C10): its store's change is the sign.
                watch: { actors: true, hooks: ["drpgDeathsChanged", "drpgDespairOwedChanged", "drpgCrossingsChanged"] },
                after: wireAll
            });
        },
        rejectClose: false
    });

    // Returned rather than awaited-and-dropped, so the GM panel's tile waits
    // for the round trip instead of opening the panel over it (F7).
    if (roundTrip) return roundTrip;

    if (!chosen || chosen === "cancel") return;

    const changed = await applyAliveStates(chosen);

    ui.notifications.info(changed
        ? plural("DRPG.Panel.stateSaved", { n: changed })
        : game.i18n.localize("DRPG.Panel.stateUnchanged"));
}

/**
 * Write what the Players window was told, row by row, outside in: deceased first,
 * then Monocub, then silence. Answers how many CHARACTERS changed (E51 C7, 31.10.2026;
 * audit S10-60): the ids written go into a Set, so a row whose state and silence both
 * moved is one, where the window's toast used to say "2 characters changed" over it.
 *
 * DRIVEN BY THE ANSWER, NOT BY THE ROSTER THE WINDOW OPENED WITH (F15, 20.09). The
 * loop used to walk `students`, read once when the window opened, while the answer
 * was built from `roster()` at the moment of Apply - so a character created while
 * the window stood open got a row, got read, and was then skipped by the loop.
 * Nothing said so: the count at the end only counts what the loop wrote.
 *
 * Exported because it is the part of this window that can be checked without a
 * window, now that it is driven by a plain object rather than by a form - and it
 * imports what it writes for the same reason.
 *
 * `"silenced" in want` RATHER THAN ITS TRUTHINESS. The dialog always sends the
 * key, but a caller that only means to move a state must not be read as asking for
 * a silence to be lifted - a function driven by an answer has to tell "they said
 * no" from "they were not asked".
 */
export async function applyAliveStates(chosen = {}) {
    if (!game.user.isGM) return 0;

    const { isDeceased, isDeadForGm, reviveCharacter, markDeceased, publishDeath, pendingDeath, incidentVictimDied } = await import("./chapter.mjs");
    const { isMonocub, setMonocub, isCrimeSilenced, setSilenced } = await import("./monocub.mjs");
    const { isMonokuma } = await import("./monokuma.mjs");
    const stateOf = a => isMonocub(a) ? "monocub" : isDeceased(a) ? "dead" : isDeadForGm(a) ? "unfound" : "alive";
    /* A death kept by the GMs is published by the GM's hand here (E05 C10; the owner's Q3):
       its record, its Truth Bullets and its row go as the discovery takes them. A student
       with no such death is marked as the repair always marked them. */
    const makeKnown = a => (pendingDeath(a) ? publishDeath(a) : markDeceased(a));

    const changed = new Set();
    for (const [id, want] of Object.entries(chosen)) {
        const actor = game.actors.get(id);
        if (!actor || actor.type !== "character" || isMonokuma(actor) || !want?.state) continue;

        // Order matters: a Monocub is a dead student with a second flag, so the
        // flags are set from the outside in - deceased first, then Monocub.
        //
        // Dying through the DROPDOWN keeps the inventory AND stays quiet (F16).
        // This half of the window is the repair tool: nobody expects a select to
        // empty a bag or to announce a death to the table, and the row's own Kill
        // button is the one that runs the real procedure, warning and all.
        if (want.state !== stateOf(actor)) {
            // A death this pass makes, not one the GMs kept: that one went through `killCharacter`.
            const living = !isDeadForGm(actor);
            let died = null;
            if (want.state === "alive") {
                await setMonocub(actor, false);
                await reviveCharacter(actor);
            } else if (want.state === "dead") {
                await setMonocub(actor, false);
                if (!isDeceased(actor)) died = await makeKnown(actor);
            } else if (want.state === "unfound") {
                // Only a killing keeps a death secret; a row that was published meanwhile stays so.
                continue;
            } else {
                if (!isDeceased(actor)) died = await makeKnown(actor);
                await setMonocub(actor, true);
            }
            /* THE ONE THING THE REPAIR DOES THAT IS NOT A FLAG (E32+E07 C13, 03.10.2026; audit
               S10-77, the owner's D13): the running incident's victim dead from this list ties the
               chapter's traces and offers Stage 6, as a death by the Kill button does - the fight
               stood at "incident" around a body until then. Nothing else of `killCharacter`'s: no
               card, the bag kept (F16). Anybody else's death here, and a death outside an incident,
               does nothing more (`incidentVictimDied` asks). */
            if (living && died?.chapter) await incidentVictimDied(actor, died.chapter);
            changed.add(actor.id);
        }

        // Silence only means anything for a cub, and only after the state above has
        // settled. THE WINDOW DRAWS THE BOX FOR A CURRENT MONOCUB ONLY (E51 C7; audit
        // S10-60): a student made a Monocub by the dropdown and Apply gets the box the
        // next time the window opens, one made by the row's Invite as the open table
        // redraws (`keepLive`). A caller that hands both at once - the suite, the
        // console - gets both in this pass, counted as one character.
        if (isMonocub(actor) && "silenced" in want && want.silenced !== isCrimeSilenced(actor)) {
            await setSilenced(actor, want.silenced);
            changed.add(actor.id);
        }
    }
    return changed.size;
}
