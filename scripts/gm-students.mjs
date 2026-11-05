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
 */

import { studentActors } from "./monokuma.mjs";
import { dialogContent, error, plural, tableDialog, esc, wholeNumber } from "./utils.mjs";
import { stepper } from "./ui-kit.mjs";
import { keepLive, alreadyOpen, handOff, RAISED } from "./live.mjs";
import { crossingStore } from "./gm-stores.mjs";

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
function aliveTableHtml({ roster, stateOf, donors, isCrimeSilenced, resourceValue, resourceMax }) {
    /*
     * THE THREE MONOCUB COLUMNS ONLY EXIST WHEN A MONOCUB DOES (D-F4).
     *
     * Hope, the donation controls and Silenced are meaningless for a living
     * student and for an ordinary corpse - they were rendered as "-", three
     * columns wide, for every row. In a cast where nobody has opted in yet
     * that is a table two thirds made of dashes, and the widest heading on it
     * ("Turn a Monokuma's Despair into Hope") was paying for a column that had
     * nothing in it.
     *
     * So they appear the moment somebody accepts the invitation and not before.
     * The alternative - keeping the columns and hiding the dashes - leaves the
     * headings, which are the expensive part.
     */
    const anyCub = () => roster().some(a => stateOf(a) === "monocub");

    const buildRows = () => roster().map(a => {
        const state = stateOf(a);
        const cub = state === "monocub";

        /*
         * CALLED, not read. `anyCub` became a function when this table learned
         * to rebuild itself (E22) and this line was left reading the reference
         * - which is a function object, which is always truthy, so the cub
         * cells were built on EVERY row whether or not a Monocub existed. The
         * heading above calls it properly, so for four releases a table with no
         * Monocub in it had three columns of heading over six columns of row.
         */
        const cubCells = !anyCub() ? "" : `
            <td>${cub ? `${resourceValue(a, "hope")} / ${resourceMax(a, "hope")}` : "-"}</td>
            <td>${cub && donors ? `
                <select name="donor:${a.id}">${donors}</select>
                ${stepper({ name: `amount:${a.id}`, value: 1, min: 1, attrs: { style: "width:3.5em" } })}
                <button type="button" class="drpg-mini-button" data-drpg-give="${a.id}">
                    ${game.i18n.localize("DRPG.Monocub.give")}</button>` : "-"}</td>
            <td style="text-align:center">${cub
                ? `<input type="checkbox" name="silenced:${a.id}" ${
                    isCrimeSilenced(a) ? "checked" : ""} />`
                : "-"}</td>`;

        return `<tr data-actor="${a.id}">
            <td>${esc(a.name)}</td>
            <td><select name="state.${a.id}">
                ${(state === "unfound" ? ["alive", "unfound", "dead", "monocub"] : ["alive", "dead", "monocub"]).map(sKey =>
                    `<option value="${sKey}"${sKey === state ? " selected" : ""}>${
                        game.i18n.localize(sKey === "unfound" ? "DRPG.Chapter.deadUnfound" : `DRPG.Panel.state.${sKey}`)}</option>`).join("")}
            </select></td>${cubCells}
            <td>
                ${state === "alive"
                    ? `<button type="button" class="drpg-mini-button drpg-gm-route"
                           data-drpg-kill="${a.id}">${
                           game.i18n.localize("DRPG.Chapter.deathTitle")}</button>`
                    : state === "dead"
                        ? `<button type="button" class="drpg-mini-button" data-drpg-cub="${a.id}">${
                            game.i18n.localize("DRPG.Monocub.invite")}</button>`
                        : ""}${refundButton(a)}</td>
        </tr>`;
    }).join("");

    const cubs = anyCub();
    return `<div class="drpg-alive-live">
        <p class="notes">${game.i18n.localize("DRPG.Panel.whoIsAliveNote")}</p>
        <table class="drpg-vault-table"><thead><tr>
            <th>${game.i18n.localize("DRPG.Panel.character")}</th>
            <th>${game.i18n.localize("DRPG.Panel.stateColumn")}</th>
            ${cubs ? `
            <th>${game.i18n.localize("DRPG.Monocub.hope")}</th>
            <th>${game.i18n.localize("DRPG.Monocub.giveHopeColumn")}</th>
            <th data-tooltip="${esc(game.i18n.localize("DRPG.Monocub.silencedNote"))}">${game.i18n.localize("DRPG.Monocub.silenced")}</th>` : ""}
            <th>${game.i18n.localize("DRPG.Panel.doColumn")}</th>
        </tr></thead><tbody>${buildRows()}</tbody></table>
    </div>`;
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
    return ` <button type="button" class="drpg-mini-button" data-drpg-refund="${esc(actor.id)}" data-tooltip="${esc(note)}">${
        game.i18n.localize("DRPG.Panel.refundCrossing")}</button>`;
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
 * from, and so is the item manager behind the footer's Items button -
 * D-F5-2 settled that one deliberately, its own Close is the one exit.
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
 * with an `await` in front of it. The footer's Items button has always had
 * this shape; the row buttons did not.
 */
function wireAliveRow(dialog, attribute, run, { keepOpen = false, onHandOff = null } = {}) {
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
                    return openWhoIsAliveDialog();
                });
                onHandOff?.(trip);
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
function wireAliveTable(dialog, { openDeathDialog, setMonocub, onHandOff }) {
    // The full death procedure, on the one character the row is about.
    // `openDeathDialog` owns the warning about the inventory and the
    // "keep their things" choice; repeating either here would be a
    // second copy of a rule that can only be right in one place.
    wireAliveRow(dialog, "data-drpg-kill", actor => openDeathDialog({ actor }), { onHandOff });
    // No window of its own, so the table stays where it is (E6).
    wireAliveRow(dialog, "data-drpg-cub", actor => setMonocub(actor, true),
        { keepOpen: true });
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

/** The Students window (the panel's tile); exported for tier 2's click of its Refund last crossing (E17 fix e1-G2). */
export async function openWhoIsAliveDialog() {
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
    const students = roster();
    if (!students.length) {
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
        return aliveTableHtml({ roster, stateOf, donors, isCrimeSilenced, resourceValue, resourceMax });
    };

    // A row button's round trip, if one is running: this window did not answer,
    // it handed over (F7). Set by `wireAliveRow` through the callback below.
    let roundTrip = null;

    const chosen = await tableDialog({
        window: { title: game.i18n.localize("DRPG.Panel.whoIsAlive") },
        classes: ["drpg-panel", "drpg-projects", "drpg-window-alive"],
        content: dialogContent(`<form>${table()}</form>`),
        buttons: [
            {
                action: "save", label: game.i18n.localize("DRPG.Panel.apply"), default: true,
                callback: (e, b, d) => Object.fromEntries(roster().map(a => [a.id, {
                    state: d.element.querySelector(`[name="state.${a.id}"]`)?.value ?? null,
                    silenced: Boolean(d.element.querySelector(`[name="silenced:${a.id}"]`)?.checked)
                }]))
            },
            /*
             * ITEMS FROM THE FOOTER, NOT FROM EVERY ROW (Dawid, 03.09).
             *
             * The Give / take hub asks which student itself - a select at the
             * top of its own window, with that student's pockets and stash
             * under it - so a button per row was sixteen doors to the same
             * room, each answering a question the room asks again. One button,
             * nobody pre-picked. No callback, so the answer is the action's
             * own name, which is what the branch under the window reads.
             */
            { action: "items", label: game.i18n.localize("DRPG.Items.hubButton") },
            { action: "cancel", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        render: (event, dialog) => {
            const wireAll = () => wireAliveTable(dialog, {
                openDeathDialog, setMonocub, onHandOff: trip => { roundTrip = trip; }
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

    if (chosen === "items") {
        // The same round trip the row's Kill makes (E6): this window closed
        // when the button was pressed, the hub runs for as long as the GM
        // wants it - its own Close is the one exit (D-F5-2) - and the table
        // comes back after, rebuilt around whatever was handed over.
        const { openItemManager } = await import("./gm-items.mjs");
        await openItemManager();
        return openWhoIsAliveDialog();
    }
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
