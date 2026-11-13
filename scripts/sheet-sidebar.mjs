/**
 * The sheet's sidebar and its other tabs (E54, the sheet's family): the sidebar tidied, the reserves
 * (`paintReserves`, `writeReserve`, `paintPartyReserves`), the equipped tools, an empty experience, the known passages and
 * the step through one, the safeword and the biography (`tidyBiography`, `saveBiography`).
 */

import { STATES, MODULE_ID, ITEM_CATEGORIES, EQUIPPABLE, USABLE_KINDS } from "./config.mjs";
import { RESERVES, reserveView, reserveRow, reserveOf } from "./character.mjs";
import { rolesOf } from "./inventory.mjs";
import { equippedIn, isUsable, usableKindOf } from "./use-items.mjs";
import { locateActor, passageRooms, passageOpenFor, roomsKnownToMe, tunnelVerdict, tunnelRefusalText, isPlacing, tunnelStepTarget, whenAtRest, gmSpotWhy, isLocked } from "./movement.mjs";
import { levelOf, isMoveChange, roomRegions } from "./rooms.mjs";
import { passagesKnownBy, passageSpot, viewPassage, tunnelEndsFor } from "./passages.mjs";
import { listenLabels } from "./action-rolls.mjs";
import { safeword } from "./safeword.mjs";
import { spentSince, markSpent } from "./motion.mjs";
import { error, debug } from "./utils.mjs";
import { trustedWrite } from "./resource-guard.mjs";
import { stateHeld } from "./states.mjs";
import { sheetMode, modeOf } from "./sheet-mode.mjs";
import { dropTab, classSafe } from "./sheet-item.mjs";

/*
 * A MONOKUMA'S SHEET IS NO STUDENT'S (E45 C1, 08.11.2026; audit S03-33). Daggerheart draws the sidebar's Equipped and
 * Experience headings and the Biography tab on every character; on a Monokuma the first two were headings over nothing
 * and the third a student's backstory form on a GM's mask. The sections are hidden in place (Daggerheart's own markup,
 * left in the DOM for whatever reads it by its selector); the biography's link leaves the tab bar, its part is emptied,
 * and a sheet that came up on it is moved to the Actions tab (`features`) as `leaveLoadoutTab` moves one off Loadout.
 */
function hideSidebarSection(element, name) {
    const root = element instanceof HTMLElement ? element : element?.[0];
    const section = root?.querySelector(`.character-sidebar-sheet .${name}`);
    if (!section) return;
    section.hidden = true;
    section.style.display = "none";
}

function dropBiographyTab(app, element, part) {
    dropTab(app, element, part, "biography");
}

/* ==========================================================================
 * SIDEBAR
 * --------------------------------------------------------------------------
 * "Equipment" becomes "Equipped" - in this game the word equipment means the
 * whole inventory, and the sidebar block only lists what is in hand. Loadout is
 * removed outright: it holds domain cards, which do not exist here.
 * ========================================================================== */

export function tidySidebar(element) {
    const sidebar = element.querySelector(".character-sidebar-sheet");
    if (!sidebar) return;

    // Structural selectors first - the template's own `.equipment-section` and
    // `.loadout-section` wrappers, not the English caption text they happen to
    // render today. Matching by text meant a language pack translating
    // "Equipment"/"Loadout" would silently stop this from finding either block;
    // the system has only ever shipped English, so that never surfaced, but it
    // was one `lang/*.json` away from failing quietly. The text match is kept
    // as a fallback for a template that renders without those wrapper classes.
    const equipment = sidebar.querySelector(".equipment-section h3")
        ?? findHeadingByText(sidebar, "equipment");
    if (equipment && !equipment.dataset.drpgRenamed) {
        equipment.textContent = game.i18n.localize("DRPG.Sheet.equipped");
        equipment.dataset.drpgRenamed = "1";
    }

    const loadoutHeading = sidebar.querySelector(".loadout-section h3") ?? findHeadingByText(sidebar, "loadout");
    const loadoutBlock = loadoutHeading?.closest(".loadout-section, section, fieldset") ?? loadoutHeading?.parentElement;
    loadoutBlock?.classList.add("drpg-hidden-block");
}

/* ==========================================================================
 * THE RESERVE ON THE SHEET (E24 C1a, 08.11.2026)
 * --------------------------------------------------------------------------
 * The owner's D5 (option 1): Health and Sanity are said as their reserve
 * everywhere - "N left", a full bar a full reserve. D46 (option 2): with
 * Daggerheart's pips on (its client setting useResourcePips), the module draws
 * its own pips counting the reserve; without, its bar; both from one helper and
 * one painter, which a render and a repaint both call.
 *
 * UNTIL E24 THE BAR DREW MARKS. Daggerheart stores both as marks counted up -
 * 0/4 untouched, 4/4 the wound - and `paintResourceBars`, which this replaces,
 * read the marks off the system's `<progress>` and filled the bar by them: a
 * bar at 100 % was a student out of road, and the pip layout was not touched
 * at all (S17-38). Measured at E24 C0 on `?sheet=parts`: Health 1 of 4 marked
 * drew a 25 % bar, Sanity 2 of 6 a 33.3 % one.
 *
 * WHAT IT READS. The numbers come off the actor through character.mjs
 * `reserveView`, never off the DOM, so a render and a repaint draw the same
 * thing (the repaint used to feed the system's input and progress from the
 * actor first, then read them back). Each block is found by its system key,
 * never by its order: the bar layout by its number field's `name`, the pip
 * layout by its slots' toggle (`RESERVE_PIPS`), and once painted by the
 * `data-drpg-reserve` this writes on it, which the stylesheets colour by - and
 * which a redacted sheet still carries after anonymity.mjs took the toggles'
 * `data-action` away.
 *
 * WHAT IT HIDES. Daggerheart's progress, number field, "/" and maximum (the
 * bar layout), and its slots and their "n / max" (the pip layout), each by a
 * class (`drpg-reserve-hidden`): kept in the DOM, since the system may still
 * write to them, and no longer read by anybody. The pips this draws are for
 * reading only; a click on them does nothing.
 *
 * THE FIELD. For an editor - the mode's `reserveField`: on a sheet the viewer
 * may edit, a GM always, a player who owns the student only with "Lock player
 * resources" off (Q-E24-1's default); never on the dead's or a Monokuma's - the
 * number in the row is a field of the reserve, 0 to the maximum; a change writes the marks it
 * comes to (`writeReserve`, the road resource-guard.mjs names `sheetReserve`).
 * Nobody else gets one.
 *
 * WHAT A VIEWER READS. Sanity is another player's to keep (the owner, 28.10):
 * for a user `reserveView` does not show it to, the block says "?", its track is
 * empty, no pip is drawn and no number is written into an attribute - the track
 * no longer carries `data-value`/`data-max` for anybody. The system's own
 * controls of it are emptied and its slots removed (`emptyReserveControls`,
 * EMPTIED, NOT HIDDEN), with anonymity enforced or not; anonymity.mjs empties
 * them again on a sheet it redacts.
 * ========================================================================== */

/** The pip layout's slot of each reserve, by the toggle Daggerheart 2.10.5 puts on it (resource-bar.hbs). */
const RESERVE_PIPS = Object.freeze({
    hitPoints: ".slot[data-action='toggleHitPoints']",
    stress: ".slot[data-action='toggleStress']"
});

/** What the field says it is (its label and its tooltip). */
const RESERVE_FIELD = Object.freeze({
    hitPoints: "DRPG.Reserve.fieldHealth",
    stress: "DRPG.Reserve.fieldSanity"
});

/** The class that hides the system's own controls of a reserve, which stay in the DOM. */
const RESERVE_HIDDEN = "drpg-reserve-hidden";

/**
 * A reserve's block in the sidebar's resources: painted before, the bar layout's (among `bars`, by its number field's
 * name), or the pip layout's (by its slots' toggle).
 */
function reserveBlock(section, key, bars) {
    return section.querySelector(`[data-drpg-reserve="${key}"]`)
        ?? bars.find(bar => bar.querySelector(`input.bar-input[name="system.resources.${key}.value"]`))
        ?? section.querySelector(RESERVE_PIPS[key])?.closest(".slot-value")
        ?? null;
}

/**
 * Health and Sanity on the sheet, as the reserve, in whichever layout the system drew (see the block above). Called
 * by the render (`onRenderCharacterSheet`) and by the repaint (`repaintInPlace`); `user` is whose eyes it draws for.
 */
export function paintReserves(app, element, actor = app?.document, user = game.user) {
    const root = element instanceof HTMLElement ? element : element?.[0];
    const section = root?.querySelector?.(".character-sidebar-sheet .resources-section");
    if (!section || !actor) return;
    // Whether `user` may type the reserves: the mode's (`reserveField`), the sheet's editability read off `app`; with
    // no app, ownership, as the mode reads a sheet it is not handed.
    const editor = sheetMode(actor, user, { app }).reserveField;
    // The bar layout's blocks, as patches.mjs SHEET_ANCHORS names them for the contract.
    const bars = [...root.querySelectorAll(".character-sidebar-sheet .resources-section .status-bar")];

    for (const key of Object.keys(RESERVES)) {
        const block = reserveBlock(section, key, bars);
        if (!block) continue;
        const view = reserveView(actor, key, user);
        block.dataset.drpgReserve = key;
        // The flare's memory is the reserve held, so a band or a pip lights the part that moved; nothing is
        // remembered of a view this user may not read.
        const change = view.shown && actor.id ? spentSince(`resource:${key}`, actor.id, view.left) : null;
        if (block.classList.contains("slot-value")) paintReservePips(block, view, change);
        else paintReserveBar(block, view, change);
        if (!view.shown) emptyReserveControls(block);
        paintReserveRow(block, view, actor, editor);
    }
    paintStateBadges(section, actor);
}

/*
 * THE TWO STATES ARE PUBLIC ON THE SHEET (E95 C5, 10.11.2026; the owner's "Breakdown i wounded maja byc publiczne w
 * karcie postaci, tak jak np. imie albo hp"). The same commit took both icons off every token (states.mjs
 * `effectIconShown`), so the sheet is where a table reads them. Measured on bc750112 before (STATUS E95-C5): no reader
 * of either layout - the owner, a GM, another player, an Observer - found Breakdown anywhere on the sheet, and Wounded
 * only as the Actions label's class and tooltip. Now a badge of each state the character is in stands under the
 * reserves, for every reader, a student's, a Monokuma's and an NPC's alike: its icon, its name and a tooltip saying
 * what it does (`DRPG.States.<id>.description`). The row sits after the reserves' section, outside every reserve's
 * block, so anonymity.mjs `redactValues`, which strips the Sanity block's tooltips, leaves it whole: the state is
 * public, the Sanity number is not ("?" as before), though a Breakdown badge tells another player Sanity is gone (the
 * owner asked for that). Read from the rule (`stateHeld`, the reading `syncOnce` writes the status from), so a sheet
 * drawn before the status lands already says it; redrawn by every paint, so a repaint takes a lifted state off. The row
 * itself is never taken off (E95 C5 fix): its height is reserved, so no state moves the sheet.
 */
function paintStateBadges(section, actor) {
    const held = Object.values(STATES).filter(state => stateHeld(actor, state));
    // The row stays in every state, empty when none is held, and the stylesheet gives it its height either way: a badge
    // that comes or goes moves nothing below it (E95 C5 fix; the owner's 10.11: "layout karty powinien uwzgledac puste miejsce").
    let row = section.parentElement?.querySelector(":scope > .drpg-state-badges") ?? null;
    if (!row) {
        row = document.createElement("div");
        row.className = "drpg-state-badges";
        section.after(row);
    }
    row.replaceChildren(...held.map(state => {
        const badge = document.createElement("span");
        badge.className = "drpg-state-badge";
        badge.dataset.drpgState = state.id;
        badge.dataset.tooltip = game.i18n.localize(`DRPG.States.${state.id}.description`);
        badge.tabIndex = 0;
        const icon = document.createElement("img");
        icon.src = state.img;
        icon.alt = "";
        const name = document.createElement("span");
        name.textContent = game.i18n.localize(`DRPG.States.${state.id}.name`);
        badge.append(icon, name);
        return badge;
    }));
}

/**
 * EMPTIED, NOT HIDDEN, whatever the anonymity setting (E24 fix G2B; general m2, security N-2; E24-06, R1445). The class
 * hides the system's controls of a reserve; for a view not shown they also held it - the progress's `value` and `max`,
 * the number field's, the label's maximum, and in the pip layout one slot a point, the marked ones `filled` - which
 * anonymity.mjs empties only on a sheet it redacts, so with "Enforce anonymity" off another player's sheet kept
 * Sanity in its DOM. Here they are emptied on every such sheet, and the slots go: their count is the maximum.
 */
function emptyReserveControls(block) {
    for (const progress of block.querySelectorAll("progress")) {
        progress.removeAttribute("value");
        progress.removeAttribute("max");
    }
    for (const input of block.querySelectorAll("input.bar-input")) {
        input.removeAttribute("value");
        input.removeAttribute("max");
        input.value = "";
    }
    for (const label of block.querySelectorAll(".bar-label, .slot-label .value")) label.textContent = "";
    for (const slot of block.querySelectorAll(".slot")) slot.remove();
}

/**
 * The bar layout: the module's flat bar filled to what is LEFT, the band over the part that just moved, the system's
 * controls hidden.
 *
 * THE BAR IS UPDATED, NOT REBUILT (Dawid's flicker, kept from `paintResourceBars`). A MutationObserver over one
 * Health change found the bar removed and added again, twice; a new element has no width to travel from, so the fill
 * snapped instead of sliding. So the track is kept and its fill's width moved; a render builds it once.
 *
 * THE FLARE IS THE PIPS' ONE, aimed at the piece that changed, resuming mid-animation on a redraw (`markSpent`
 * carries the age). `spentSince` counts what is HELD, which is now what the bar draws, so its range is the band.
 */
function paintReserveBar(block, view, change) {
    const value = block.querySelector(".status-value") ?? block;
    const progress = value.querySelector("progress.progress-bar");
    const pct = view.shown ? view.pct : 0;
    // The system's controls, kept: hidden by a class, in the DOM, read by nobody.
    for (const el of value.children) {
        if (el.matches("input.bar-input") || el.matches(".bar-label") || (el.localName === "span" && el.textContent.trim() === "/")) {
            el.classList.add(RESERVE_HIDDEN);
        }
    }
    if (progress) {
        progress.classList.add("drpg-bar-replaced");
        progress.style.setProperty("--drpg-bar-pct", `${pct}%`);
    }

    for (const stale of value.querySelectorAll(".drpg-resource-bar")) {
        if (stale.dataset.resource !== view.key) stale.remove();
    }
    let track = value.querySelector(".drpg-resource-bar");
    let fill = track?.querySelector(".drpg-resource-fill") ?? null;
    if (!track || !fill) {
        track?.remove();
        track = document.createElement("div");
        track.className = "drpg-resource-bar";
        fill = document.createElement("span");
        fill.className = "drpg-resource-fill";
        track.append(fill);
        if (progress) progress.after(track);
        else value.append(track);
    }
    // The band from last time goes whatever happens: it describes a change that is no longer the latest.
    track.querySelectorAll(".drpg-resource-delta").forEach(band => band.remove());
    track.dataset.resource = view.key;
    // No number in an attribute (E24 C1a): the track carried `data-value` and `data-max` until E24.
    delete track.dataset.value;
    delete track.dataset.max;
    fill.style.width = `${pct}%`;

    if (change && view.max > 0) {
        const from = Math.max(0, change.from - 1);
        const to = Math.min(view.max, change.to);
        if (to > from) {
            const band = document.createElement("span");
            band.className = "drpg-resource-delta";
            band.style.left = `${(from / view.max) * 100}%`;
            band.style.width = `${((to - from) / view.max) * 100}%`;
            markSpent(band, change, change.from);
            track.append(band);
        }
    }
}

/**
 * The pip layout (D46 = 2): the module's own pips, `max` of them with `left` filled, in place of the system's slots,
 * which are hidden. For reading only - no `data-action`, no listener. A view not shown draws none.
 */
function paintReservePips(block, view, change) {
    const slots = block.querySelector(".slot-bar");
    slots?.classList.add(RESERVE_HIDDEN);
    block.querySelector(".slot-label .value")?.classList.add(RESERVE_HIDDEN);
    let pips = block.querySelector(".drpg-reserve-pips");
    if (!pips) {
        pips = document.createElement("div");
        pips.className = "drpg-reserve-pips";
        pips.setAttribute("aria-hidden", "true");
        if (slots) slots.after(pips);
        else block.prepend(pips);
    }
    const count = view.shown ? view.max : 0;
    pips.replaceChildren(...Array.from({ length: count }, (_, i) => {
        const pip = document.createElement("span");
        pip.className = i < view.left ? "drpg-reserve-pip drpg-pip-full" : "drpg-reserve-pip";
        return markSpent(pip, change, i + 1);
    }));
}

/**
 * The row under the bar or the pips: "3 / 4" (`reserveRow`), "?" for a view not shown, and for an editor the
 * number is the field. A field that has the focus keeps what is being typed into it; its maximum still follows.
 */
function paintReserveRow(block, view, actor, editor) {
    let row = block.querySelector(".drpg-reserve-row");
    if (!row) {
        row = document.createElement("div");
        row.className = "drpg-reserve-row";
        const host = block.querySelector(".status-value") ?? block.querySelector(".drpg-reserve-pips") ?? null;
        if (host?.classList.contains("status-value")) host.append(row);
        else if (host) host.after(row);
        else block.append(row);
    }
    if (!editor || !view.shown) {
        row.textContent = reserveRow(view);
        return;
    }
    const typing = row.querySelector("input.drpg-reserve-field");
    if (typing && typing === document.activeElement) {
        typing.max = String(view.max);
        return;
    }
    const field = document.createElement("input");
    field.type = "number";
    field.className = "drpg-reserve-field";
    field.min = "0";
    field.max = String(view.max);
    field.step = "1";
    field.value = String(view.left);
    const label = game.i18n.localize(RESERVE_FIELD[view.key]);
    field.setAttribute("aria-label", label);
    field.dataset.tooltip = label;
    // Not the system's form: the field has no `name`, and its change goes no further than here, so Daggerheart's
    // submit-on-change sends nothing for it; Enter writes it rather than submitting the sheet.
    field.addEventListener("change", event => {
        event.stopPropagation();
        // Nothing written: the field shows the reserve again - unless a repaint has replaced it (the new one was drawn
        // from the actor) or it is being typed into again (E24 fix G2B; general n3, R1497).
        writeReserve(actor, view.key, field.valueAsNumber)
            .then(done => {
                if (done === null && field.isConnected && field !== document.activeElement) field.value = String(reserveView(actor, view.key).left);
            })
            .catch(err => error("Could not write a reserve from the sheet", err));
    });
    field.addEventListener("keydown", event => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        event.stopPropagation();
        field.blur();
    });
    // The row's text around the number, in the page's language (" / 4" since 1.2.102): the field stands where `{n}` stands.
    const [before, after = ""] = game.i18n.format("DRPG.Reserve.leftRow", { n: "{n}", max: view.max }).split("{n}");
    row.replaceChildren(before, field, after);
}

/**
 * The field's write (E24 C1a; MARKED): `n` is the reserve typed, held to 0..max, and the marks it comes to are
 * written - `max - n` - through resource-guard.mjs's road as `sheetReserve`. A GM's write is the GM's own. A player's
 * goes as a plain write, which the GMs' audit treats as it treated Daggerheart's own number field, and which this
 * browser's guard cuts while "Lock player resources" is on (the reason is not in `JUDGED`, and the road marks it as a
 * hand edit: resource-guard.mjs's note). Nothing to write answers null.
 */
export async function writeReserve(actor, key, n) {
    if (!RESERVES[key] || !actor) return null;
    const { max, left } = reserveOf(actor, key);
    const want = Math.min(max, Math.max(0, Math.round(Number(n))));
    if (!Number.isFinite(want) || want === left) return null;
    return trustedWrite(actor, { [`system.resources.${key}.value`]: max - want }, { reason: "sheetReserve" });
}

/* The Party sheet's two slot sections of a member, by the label's tooltip key (party-members.hbs, Daggerheart 2.10.5):
   found with no slot drawn too (a maximum of 0). */
const PARTY_RESERVES = Object.freeze({ hitPoints: "DAGGERHEART.GENERAL.HitPoints.plural", stress: "DAGGERHEART.GENERAL.stress" });

/**
 * THE PARTY SHEET AS THE RESERVE (E24 C1b, 08.11.2026; Q-E24-3's default, the owner's D5 option 1 and 28.10).
 * Daggerheart's Party sheet (templates/sheets/actors/party/party-members.hbs) draws each member's Health and Stress as
 * the marks: `.current` the marks, a slot `filled` per point marked, and every slot a toggle (`toggleHitPoints`,
 * `toggleStress`) whose `data-value` is the marks it sets. For every character member - a student, and since E24 fix
 * G2B an NPC kept out of the class and a Monokuma, as their sheets read (general m4; the token side is states.mjs's) -
 * through `reserveView` for `user`: `.current` what is left, the first `left` slots filled. For a GM (the mode's
 * `pipEdit`) each
 * slot's `data-value` is turned (`max - i + 1` on the i-th), so that Daggerheart's own toggle - "a point at or below
 * the value takes it to one less, any other sets it" - fills or empties the reserve up to the pip pressed; for a player
 * the toggles go (a player changes their reserve on their own sheet, where Lock player resources allows). Sanity not
 * shown to `user` is emptied, not hidden: "?" in place of its numbers and no slot, since their count is its maximum.
 * Exported for R1447 and R1484, which hand `find` a stand-in's member.
 */
export function paintPartyReserves(app, element, user = game.user, find = uuid => globalThis.fromUuidSync?.(uuid) ?? null) {
    const root = element instanceof HTMLElement ? element : element?.[0];
    for (const member of root?.querySelectorAll?.(".actor-resources") ?? []) {
        const uuid = member.querySelector("[data-action='openDocument'][data-uuid]")?.dataset.uuid
            ?? member.querySelector("[data-actor-id]")?.dataset.actorId ?? null;
        const actor = uuid ? find(uuid) : null;
        if (actor?.type !== "character") continue;
        const toggles = sheetMode(actor, user).pipEdit;
        for (const [key, tip] of Object.entries(PARTY_RESERVES)) {
            const section = member.querySelector(`.slot-label[data-tooltip="${tip}"]`)?.closest(".slot-section");
            if (!section) continue;
            const view = reserveView(actor, key, user);
            const value = section.querySelector(".slot-label .value");
            const slots = [...section.querySelectorAll(".slot")];
            if (!view.shown) {
                // No slot: their count is the maximum (E24 fix G2B; security S-2, R1484).
                slots.forEach(slot => slot.remove());
                if (value) value.textContent = "?";
                continue;
            }
            slots.forEach((slot, i) => {
                slot.classList.toggle("filled", i < view.left);
                if (toggles) slot.dataset.value = String(view.max - i);
                else {
                    delete slot.dataset.action;
                    delete slot.dataset.value;
                }
            });
            const current = value?.querySelector(".current"), top = value?.querySelector(".max");
            if (current) current.textContent = String(view.left);
            if (top) top.textContent = String(view.max);
        }
    }
}

/**
 * Put the readied Crime and Cleaning Tool into the sidebar's Equipped list.
 *
 * That list is Daggerheart's `equippedItems`, which means its own weapons and
 * armour. This module's tools are `loot` with a category flag, so nothing put
 * them there - and "Equipped" showing everything except the two things the
 * module calls equipped is worse than not renaming the heading at all. It also
 * made the one mechanic that now depends on readying something (see
 * `equippedWeapon` in murder-rules.mjs) invisible in the place a player looks to
 * check it.
 *
 * Rows are built to match `daggerheart.inventory-item-compact` - same classes,
 * same order - so they inherit the system's styling instead of needing a
 * parallel set of rules that would drift from it.
 */
/**
 * A row about something that has stopped existing (trap 91).
 *
 * A SILENT STEAL LEAVES ONE. An unseen steal or rifle (palm.mjs
 * `stealFromPerson`, stash-reach.mjs `stealFromVault`, through inventory.mjs `transferItem`
 * since E35 C3) deletes the item with `render: false` so the victim's open
 * sheet does not redraw for it - the thing has really gone, and what is
 * suppressed is the refresh. Until something else
 * redraws the sheet the row is still on screen, and every control on it is
 * pointing at a document that is not there: readying it, using it, handing it
 * over, opening its sheet. An exception in the victim's console is a worse
 * notification than the notification it was avoiding.
 *
 * Registered in the CAPTURE phase on the row itself, so it runs before the
 * row's own listener AND before any button inside it - one guard covering
 * seven controls, rather than seven guards that could drift apart.
 *
 * And it is not only about theft. A GM taking something away by hand, a Reroll
 * unwinding a Search, an item spent on another client: every one of them can
 * leave a row behind for a moment. This is what that moment does.
 */
export function guardRow(li, item, app) {
    li.addEventListener("click", event => {
        if (item?.actor?.items?.get(item.id)) return;

        event.stopPropagation();
        event.preventDefault();
        li.remove();
        ui.notifications.info(game.i18n.format("DRPG.Items.rowGone", {
            item: item?.name ?? "?"
        }));
        // Which is how they find out. The rule was always "not until they look
        // again" - this IS looking again.
        app?.render(false);
    }, true);
}

export function injectEquippedTools(app, element, mode = modeOf(app)) {
    const actor = app.document;
    if (!mode.equipped) {
        hideSidebarSection(element, "equipment-section");
        return;
    }

    const list = element.querySelector(".character-sidebar-sheet .equipment-section .items-sidebar-list");
    if (!list) return;

    // Rebuilt every render, like the action panels: what is readied changes and
    // a stale row is a lie about what is in the character's hand.
    list.querySelectorAll("[data-drpg-equipped], .drpg-equipped-empty").forEach(row => row.remove());

    let readied = 0;
    for (const category of EQUIPPABLE) {
        const item = equippedIn(actor, category);
        if (!item) continue;
        readied++;

        const tier = item.getFlag(MODULE_ID, "tier");
        /* BOTH TAGS (E24 C3b, 08.11.2026; E24-23, the owner's 28.10): the row drew its slot's label alone, so a
           Murder Weapon that is also a Tool read as a Murder Weapon only. The gear row's own tags (`itemTags`: the
           home and the other roles, each once), the tier after them; the slot's label where an item has none. */
        const tags = itemTags(item, true);
        // One line, as the slot's label was: the tags side by side, not a block each (shots/c3b: three stacked lines).
        const labels = (tags.length ? tags : [{ key: category, label: ITEM_CATEGORIES[category]?.label ?? category, hint: null }])
            .map(tag => `<span class="drpg-equipped-tag" data-drpg-role="${classSafe(tag.key)}"${tag.hint
                ? ` data-tooltip="${foundry.utils.escapeHTML(tag.hint)}"` : ""}>${foundry.utils.escapeHTML(tag.label)}</span>`).join(" · ");
        const tierLabel = tier !== undefined && tier !== null
            ? `<span class="drpg-equipped-tier"> - T${foundry.utils.escapeHTML(String(tier))}</span>` : "";
        const li = document.createElement("li");
        li.className = "inventory-item inventory-item-compact drpg-equipped-tool";
        li.dataset.drpgEquipped = category;
        li.dataset.itemId = item.id;
        li.dataset.itemUuid = item.uuid;
        li.draggable = false;
        li.innerHTML = `
            <div class="img-portait" data-tooltip="#item#${item.uuid}">
                <img src="${foundry.utils.escapeHTML(item.img ?? "")}" class="item-img" alt="" />
            </div>
            <span class="item-name">${foundry.utils.escapeHTML(item.name)}</span>
            <div class="item-labels"><div class="label">${labels}${tierLabel}</div></div>`;

        guardRow(li, item, app);
        li.addEventListener("click", event => {
            if (event.target.closest("[data-drpg-row-action]")) return;
            item.sheet?.render(true);
        });

        list.append(li);
    }

    // Daggerheart's own rows in this list are hidden by CSS - "Equipped" here
    // means the two things this game lets you ready, not the system's weapons
    // and armour. That leaves an empty box when nothing is readied, so say so,
    // and say why it matters rather than just that it is empty.
    if (!readied) {
        const empty = document.createElement("li");
        empty.className = "drpg-equipped-empty";
        empty.textContent = game.i18n.localize("DRPG.Items.noneReadied");
        list.append(empty);
    }
}

/*
 * AN EMPTY EXPERIENCE SAYS SO (E24 C3b, 08.11.2026; E24-23, audit S15-02, S03-29). A student with no experiences
 * showed the Experience heading over nothing, which reads as a part that failed to draw. One line, as the Equipped
 * list says its own empty state (`drpg-experience-empty`), worded from the player handbook (two at +2 at the start,
 * one more from a Level Up). Not for a Monokuma, whose sheet has no experiences to keep.
 */
export function noteEmptyExperience(app, element, mode = modeOf(app)) {
    const actor = app?.document;
    if (!actor) return;
    if (!mode.experience) {
        hideSidebarSection(element, "experience-section");
        return;
    }
    const list = element.querySelector(".character-sidebar-sheet .experience-section .experience-list");
    if (!list) return;
    list.querySelectorAll(".drpg-experience-empty").forEach(row => row.remove());
    if (Object.keys(actor.system?.experiences ?? {}).length) return;
    const empty = document.createElement("p");
    empty.className = "notes drpg-experience-empty";
    empty.textContent = game.i18n.localize("DRPG.SheetNotes.noExperiences");
    list.append(empty);
}

/*
 * KNOWN PASSAGES (E79 C7, 15.10.2026; the E79 plan's P9-0 and P10-0, the mockup of 14.10). The secret
 * passages this character knows, under its Experience, on its owners' sheets: each named by the two
 * rooms it joins as this viewer may name them, 'the way is shut' where the veto would turn the
 * character back now (movement.mjs `passageOpenFor`, the frame's own question), a click on the name
 * taking this browser's camera there, and 'Show the passage' to a student in the same room. Read from
 * this browser's copy (passages.mjs `passagesKnownBy`) - a GM's browser reads the GMs' records - and
 * drawn again when the copy changes (`drpgPassagesChanged`). The page holds the rooms' names and the
 * two words; the passage's id and its stretch stay in this function's closures (R562, scenario 76 G).
 */

/**
 * The list's rows, `[{ passage, label, shut, way }]` sorted by `label`: `passage` the stretch
 * (`passagesKnownBy`'s row), `label` "Room - Room" as `listenLabels` names them for this viewer, `shut`
 * whether the passage does not open for the character from where it stands, `way` a one-way tunnel's
 * `{ from, to }` named as the label names them, null for one that goes both ways (H81-02). A passage on a scene this
 * world no longer holds is left out. `deps` are the suite's (R562).
 */
export function knownPassageRows(actor, { known, mastermind = false, sceneOf = id => game.scenes?.get(id) ?? null,
    sides = passageRooms, knownRooms = roomsKnownToMe, opens = passageOpenFor, place = locateActor } = {}) {
    const given = known === undefined ? {} : { known };
    const here = place(actor);
    const rows = [];
    for (const passage of passagesKnownBy(actor, { mastermind, ...given })) {
        const scene = sceneOf(passage.sceneId);
        if (!scene) continue;
        const rooms = sides(scene, passage, passage.level) ?? [];
        const names = listenLabels(rooms.filter(Boolean), knownRooms(scene));
        const label = [rooms[0], rooms[1]].map(room => (room ? names.get(room) : "-")).join(" - ");
        // A one-way tunnel's two rooms in its direction, as the label names them (H81-02); null both ways.
        const one = passage.oneWay === 0 || passage.oneWay === 1 ? passage.oneWay : null;
        const way = one === null ? null : { from: rooms[one] ? names.get(rooms[one]) : "-", to: rooms[1 - one] ? names.get(rooms[1 - one]) : "-" };
        const from = here?.scene?.id === scene.id ? here.room : null;
        // The frame's own question, asked as the frame asks it (fog-doorways.mjs): no mover but on a GM's
        // browser for the Mastermind, whom only the GMs' record names there; at the token's height, where `from`
        // was read (H81 fix r1, movement.mjs `passageRooms`' note). The label's rooms are the map's, for no token.
        const elevation = from !== null && Number.isFinite(here?.tokenDoc?.elevation) ? here.tokenDoc.elevation : null;
        const shut = !opens(actor, passage, scene, { from, level: passage.level, mover: mastermind ? { mastermind: true } : null, elevation, ...given });
        rows.push({ passage, label, shut, way, rooms: [rooms[0] ?? null, rooms[1] ?? null] });
    }
    return rows.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * This browser's camera to a passage, on its scene and floor (passages.mjs `viewPassage`, E80 fix r1-G2): a
 * stretch's middle, or a tunnel's end on the floor on screen when it has one there, else its first end, that
 * end's floor viewed.
 */
async function panToPassage(passage) {
    return viewPassage(level => passageSpot(passage, level));
}

/** 'Show the passage': who in the room to show it to (handover.mjs `askWhoIsHere`), then the primary GM's judgement. */
async function showPassageDialog(actor, row) {
    const { askWhoIsHere } = await import("./handover.mjs");
    const targetId = await askWhoIsHere(actor, {
        title: game.i18n.format("DRPG.Passage.show.title", { passage: row.label }),
        intro: room => game.i18n.format("DRPG.Passage.show.intro", { room }),
        note: game.i18n.localize("DRPG.Passage.show.note"),
        okLabel: game.i18n.localize("DRPG.Passage.show.button"),
        listBox: true
    });
    if (!targetId) return;
    const { requestPassageShare } = await import("./gm-bridge.mjs");
    const res = await requestPassageShare({ actorId: actor.id, targetId, passageId: row.passage.id });
    if (!res.ok) debug("A secret passage was not shown", res.reason);
}

/**
 * 'Go through' (E80 C2): a tunnel's row asks first on this browser, by the doors' rules as this browser holds them
 * (movement.mjs `tunnelVerdict`, the price included), and a refusal is said here in its key's words, as the bridge
 * says it (`tunnelRefusalText`: `DRPG.Bridge.why.<code>`, "that room" for the room); then the primary GM judges it
 * again and moves the token (gm-bridge.mjs `passage.cross`), and says its refusal through the bridge. The button
 * waits for the answer, so one click asks once. Scenario 76 U clicks it.
 *
 * ENABLED WHEREVER THE TOKEN STANDS (H81-03, 20.10.2026; the owner's item 4b and the design A10's step 11, which
 * disables it away from an end). A disabled button says the truth only while the row is drawn again as the token
 * moves, and nothing draws it then: of sheet.mjs's hooks (`registerSheetTweaks`) none draws the list on a token's move -
 * the list is drawn on the sheet's own render and on `drpgPassagesChanged`; `onTunnelStep` hears a move (H81-13), and
 * goes through, but draws nothing - and a linked token's move is no update of its
 * actor, which is what renders an actor's sheet (Foundry's rule as this module reads it; Daggerheart's sheet is not on
 * this machine). Read off the source, not a table. So the click says where to stand instead: `notAtPassage`'s words.
 * A token moved onto an end takes this road too, with no button (`onTunnelStep`), and the bridge's `hush` for it.
 *
 * ONE ASK PER CHARACTER AT A TIME, FROM EITHER ROAD (H81 fix C3, 21.10.2026; the review's H81-C3-R2). The button stopped
 * a second ask only for itself; a drag asks with no button, and the primary judges each ask from where the token stands
 * when its turn comes (`crossTunnel`'s `serialWrite`), so a click while a drag's ask was on its way went through twice -
 * two prices, and back where she started. While `crossingsAsked` holds the character, another ask here, a drag's or a
 * click's from any open sheet, is not sent.
 */
const crossingsAsked = new Set();

async function goThrough(actor, row, button, mastermind, { hush = [] } = {}) {
    if (crossingsAsked.has(actor.id)) return;
    const scene = game.scenes?.get(row.passage.sceneId) ?? null;
    const ask = token => tunnelVerdict(actor, { id: row.passage.id, sceneId: row.passage.sceneId }, token,
        { mover: mastermind ? { gm: true, mastermind: true } : null });
    // As the primary picks it (passages-gm.mjs `crossTunnel`): of two tokens on the scene, the one at an end.
    const verdicts = Array.from(scene?.tokens ?? []).filter(t => t.actorId === actor.id).map(ask);
    const verdict = verdicts.find(v => !v?.code) ?? verdicts[0] ?? ask(null);
    if (verdict?.code) {
        ui.notifications.warn(tunnelRefusalText(verdict));
        return;
    }
    crossingsAsked.add(actor.id);
    if (button) button.disabled = true;
    try {
        const { requestPassageCross } = await import("./gm-bridge.mjs");
        const res = await requestPassageCross({ actorId: actor.id, passageId: row.passage.id }, { hush });
        if (!res.ok) debug("A tunnel was not gone through", res.reason);
    } finally {
        crossingsAsked.delete(actor.id);
        if (button) button.disabled = false;
    }
}

/*
 * A TOKEN MOVED ONTO A TUNNEL'S END GOES THROUGH IT (H81-13 and H81-14, 21.10.2026; the owner's call of 21.10, the
 * token chosen over a click on the mark: a GM's browser draws no mark, and a click on one cannot be measured headless).
 * The mover's browser alone reads the move - the user whose update it is, Foundry's `userId` - once the token is at rest
 * (movement.mjs `whenAtRest`, as fog.mjs reads a room, so the landing does not race the drag's animation), decides it
 * with movement.mjs `tunnelStepTarget`, and takes the button's road: `goThrough`'s own check and words, then the
 * bridge's `passage.cross`, judged and written on the primary GM. Nothing new goes on the wire and nothing is written
 * here. Where the move started is read before it is written (`preUpdateToken` runs on the writer's browser alone) and
 * kept through the updates of one move until it rests; a move vetoed before it is written leaves nothing waiting, and
 * the next one reads its start again. Only for a student whose sheet shows 'Known passages' to this user
 * (`injectKnownPassages`: its owner, never a Monokuma), the Mastermind as the sheet asks for it. Scenario 76 U drags one.
 *
 * WHAT IS NOT THIS USER'S STEP (H81 fix C3, 21.10.2026; the review's H81-C3-R1 and H81-C3-R3). A token this browser
 * places itself through Foundry's region teleport (movement.mjs `isPlacing`: the gather, the cast's placing, a
 * Clean-up's body) is never a step, whatever options Foundry writes. A move of the token by anybody else - the
 * primary's landing, the GMs' put-back, a GM's hand - while this browser's move comes to rest ends that move's wait:
 * where the token rests is no longer where this user put it, and a click's landing read as a drag onto the far end was a
 * second crossing. At rest, a put-back this browser sent is on its way (`gmSpotWhy` = "putBack", filled in the
 * refusing hook, before its write): the refusal has said its words, and the drag asks nothing. One the GMs send that
 * lands after the ask is refused by the primary as `cannotNow`, which the drag's road keeps quiet (`hush`): the
 * put-back says its own line. Tier 2 "H81 C3 drag" and scenario 76 U.
 */
const tunnelSteps = new Map();

const stepSpot = tokenDoc => ({ x: tokenDoc.x, y: tokenDoc.y, level: levelOf(tokenDoc), width: tokenDoc.width ?? 1, height: tokenDoc.height ?? 1 });

/** Before this browser writes a token's move: where it starts, unless a move of the same token is still coming to rest. */
export function noteStepStart(tokenDoc, changes) {
    if (!tokenDoc?.id || !isMoveChange(changes) || isPlacing(tokenDoc) || tunnelSteps.get(tokenDoc.id)?.waiting) return;
    tunnelSteps.set(tokenDoc.id, { from: stepSpot(tokenDoc), turn: 0, waiting: false });
}

/** After it: once the token rests, the newest update of the move decides whether it goes through a tunnel. */
export async function onTunnelStep(tokenDoc, changes, options, userId) {
    if (!isMoveChange(changes)) return;
    if (userId !== game.user?.id || isPlacing(tokenDoc)) {
        tunnelSteps.delete(tokenDoc?.id);
        return;
    }
    const entry = tunnelSteps.get(tokenDoc?.id);
    if (!entry) return;
    const scene = tokenDoc.parent ?? null;
    const actor = tokenDoc.actorId ? game.actors?.get(tokenDoc.actorId) ?? null : null;
    const mode = actor?.type === "character" ? sheetMode(actor) : null;
    if (!scene || !mode?.passages) {
        tunnelSteps.delete(tokenDoc.id);
        return;
    }
    const turn = ++entry.turn;
    entry.waiting = true;
    await whenAtRest(tokenDoc);
    if (tunnelSteps.get(tokenDoc.id) !== entry || entry.turn !== turn) return;
    tunnelSteps.delete(tokenDoc.id);
    if (gmSpotWhy(tokenDoc) === "putBack") return;
    const mastermind = mode.mastermind;
    const step = tunnelStepTarget({ changes, options, from: entry.from, to: stepSpot(tokenDoc), ends: tunnelEndsFor(actor, scene.id, null, { mastermind }),
        grid: scene.grid?.size ?? 100, userId, me: game.user.id });
    if (step) await goThrough(actor, { passage: { id: step.id, sceneId: scene.id } }, null, mastermind, { hush: ["cannotNow"] });
}

/**
 * One row of 'Known passages', `knownPassageRows`' `row` drawn, its buttons not yet wired (`injectKnownPassages` wires
 * them): the rooms as a link, 'the way is shut' where it is, a line under them saying what a player does with it -
 * walk through the gap of a passage in a wall, which has no button (H81-04), or which way a one-way tunnel goes
 * (H81-02) - 'Go through' for a tunnel and 'Show the passage'. Each line holds while the row stands: which way a
 * passage goes is in the copy, and a changed copy draws the list again (`drpgPassagesChanged`). R904 draws it.
 */
export function knownPassageItem(row) {
    const t = key => foundry.utils.escapeHTML(game.i18n.localize(key));
    const li = document.createElement("li");
    li.className = `drpg-passage-row${row.shut ? " is-shut" : ""}`;
    const tunnel = Array.isArray(row.passage?.ends);
    const note = tunnel
        ? (row.way ? `<span class="drpg-passage-note" data-drpg-passage-note="oneWay">${foundry.utils.escapeHTML(game.i18n.format("DRPG.Passage.list.oneWay", row.way))}</span>` : "")
        : `<span class="drpg-passage-note" data-drpg-passage-note="walk">${t("DRPG.Passage.list.walk")}</span>`;
    li.innerHTML = `<a class="drpg-passage-where" role="button" tabindex="0" title="${t("DRPG.Passage.list.where")}">${
        foundry.utils.escapeHTML(row.label)}</a>${row.shut ? `<span class="drpg-passage-shut">${t("DRPG.Passage.list.shut")}</span>` : ""}${note}`
        + (tunnel ? `<button type="button" class="drpg-mini-button drpg-passage-cross">${t("DRPG.Passage.list.cross")}</button>` : "")
        + `<button type="button" class="drpg-mini-button drpg-passage-show">${t("DRPG.Passage.show.button")}</button>`
        // The Mastermind's Seal on a passage at their door (E91 C5, D038; `injectKnownPassages` marks the row).
        + (row.seal ? `<button type="button" class="drpg-mini-button drpg-passage-seal" data-tooltip="${t("DRPG.Passage.list.sealTip")}">${
            t("DRPG.Passage.list.seal")}</button>` : "");
    return li;
}

/**
 * THE MASTERMIND'S DOOR ON THEIR SHEET (E91 C4, C5; D038, 12.11.2026). On the browser of the player who holds the part
 * (settings.mjs `myMastermindLair`; a GM locks rooms in Room Setup and closes passages in the tab): a line naming the
 * room and whether its door is locked, with Lock or Unlock, and a Seal on every passage the sheet lists with a side in
 * it. The lock is the GM's room lock (`isLocked`, as the door reads it), asked of the primary GM (bridge-asks.mjs
 * `requestLairLock`, `requestLairSeal`). Nothing here is drawn on anybody else's browser.
 */
function lairLocked(room) {
    return [...(game.scenes ?? [])].some(scene => roomRegions(scene, room).length && isLocked(scene, room));
}

function lairBlock(actor, room) {
    const t = key => foundry.utils.escapeHTML(game.i18n.localize(key));
    const locked = lairLocked(room);
    const div = document.createElement("div");
    div.className = "drpg-lair-line";
    div.innerHTML = `<span class="drpg-lair-room">${foundry.utils.escapeHTML(game.i18n.format("DRPG.Mastermind.lair.room", { room }))}</span>`
        + `<span class="drpg-lair-state">${t(locked ? "DRPG.Mastermind.lair.locked" : "DRPG.Mastermind.lair.open")}</span>`
        + `<button type="button" class="drpg-mini-button drpg-lair-lock">${t(locked ? "DRPG.Mastermind.lair.unlock" : "DRPG.Mastermind.lair.lock")}</button>`;
    const button = div.querySelector(".drpg-lair-lock");
    button.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        button.disabled = true;
        try {
            const { requestLairLock } = await import("./gm-bridge.mjs");
            await requestLairLock({ actorId: actor.id, lock: !locked });
        } catch (err) {
            error("Could not change the room's lock", err);
        } finally {
            actor.sheet?.render(false);
        }
    });
    return div;
}

/** The list, after the Experience, on an owner's sheet of a student that knows a passage; none for a Monokuma. */
export function injectKnownPassages(app, element, mode = modeOf(app)) {
    const actor = app.document;
    const root = element instanceof HTMLElement ? element : element?.[0];
    const host = root?.querySelector(".character-sidebar-sheet .shortcut-items-section");
    if (!host) return;
    host.querySelector(".drpg-passages-section")?.remove();
    if (!actor || !mode.passages) return;
    const { mastermind } = mode;
    // The Mastermind's own room, on their player's browser alone (`lairBlock`).
    const lair = mode.lair ?? null;
    const rows = knownPassageRows(actor, { mastermind }).map(row => ({ ...row, seal: Boolean(lair) && row.rooms.includes(lair) }));
    if (!rows.length && !lair) return;

    const t = key => foundry.utils.escapeHTML(game.i18n.localize(key));
    const section = document.createElement("div");
    section.className = "drpg-passages-section";
    section.innerHTML = (rows.length ? `<div class="title"><side-line-div class="invert"></side-line-div><h3>${t("DRPG.Passage.list.title")}</h3>`
        + `<side-line-div></side-line-div></div>` : "") + `<ul class="drpg-passage-list"></ul>`;
    const list = section.querySelector("ul");
    if (lair) list.before(lairBlock(actor, lair));
    for (const row of rows) {
        const li = knownPassageItem(row);
        li.querySelector(".drpg-passage-seal")?.addEventListener("click", async event => {
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.disabled = true;
            try {
                const { requestLairSeal } = await import("./gm-bridge.mjs");
                await requestLairSeal({ actorId: actor.id, passageId: row.passage.id });
            } catch (err) {
                error("Could not seal a secret passage", err);
            }
        });
        const where = li.querySelector(".drpg-passage-where");
        const pan = event => {
            event.preventDefault();
            event.stopPropagation();
            panToPassage(row.passage).catch(err => debug("Could not show a secret passage on the map", err));
        };
        where.addEventListener("click", pan);
        where.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") pan(event); });
        li.querySelector(".drpg-passage-show").addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            showPassageDialog(actor, row).catch(err => error("Could not show a secret passage", err));
        });
        const cross = li.querySelector(".drpg-passage-cross");
        cross?.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            goThrough(actor, row, cross, mastermind).catch(err => error("Could not go through a secret passage", err));
        });
        list.append(li);
    }
    const experience = host.querySelector(".experience-section");
    if (experience) experience.after(section);
    else host.append(section);
}

/** This browser's copy of the passages changed: the open sheets of its own students are drawn again. */
export function redrawPassageSheets() {
    for (const actor of game.actors ?? []) {
        if (actor.type === "character" && actor.sheet?.rendered && sheetMode(actor).owner) actor.sheet.render(false);
    }
}

/**
 * The safeword, bottom-left of the sheet.
 *
 * On the sheet rather than in the HUD or a floating launcher for one reason:
 * the sheet is the window a player already has open and already looks at, and
 * the moment this is needed is not the moment to go hunting for a control.
 *
 * Present for everyone - a Monokuma's player is at the same table, and a
 * character who died an hour ago does not stop being someone's evening.
 * Anchored to the window content, so it does not depend on Daggerheart's
 * internal layout holding still.
 */
export function injectSafeword(app, element, mode = modeOf(app)) {
    const root = element instanceof HTMLElement ? element : element?.[0];
    const host = root?.querySelector(".window-content") ?? root;
    if (!host) return;

    host.querySelector(".drpg-safeword-button")?.remove();
    // A Monokuma's sheet is the GM's, and the Stop is the players' (E49 B2, S03-31).
    if (mode && !mode.safeword) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "drpg-safeword-button";
    button.dataset.tooltip = game.i18n.localize("DRPG.Safeword.tooltip");
    button.setAttribute("aria-label", game.i18n.localize("DRPG.Safeword.tooltip"));
    /*
     * THE WORD IS THE TABLE'S, NOT THE MODULE'S (E15).
     *
     * It used to be `DRPG.Safeword.word` - a string in the language file, and
     * therefore one word for everybody who installs this. That is wrong for the
     * one control in the module whose whole job is to be reached without
     * thinking: a table that has never met this group's in-joke reads an
     * unfamiliar word and hesitates, and the hesitation is precisely what the
     * button exists to remove.
     *
     * Read at render rather than cached, and the setting's `onChange` redraws
     * every open sheet - otherwise the button would keep offering the old word
     * to everyone who has not reopened their character since it changed.
     */
    // The table's word, and above it what the button is (E49 B2, S03-31: "the safeword shows the table's word alone" -
    // a word nobody has met reads as a name, not as the Stop).
    button.innerHTML = `<i class="fa-solid fa-hand" inert></i>
        <span class="drpg-safeword-caption">${foundry.utils.escapeHTML(game.i18n.localize("DRPG.Safeword.title"))}</span>
        <span class="drpg-safeword-word">${foundry.utils.escapeHTML(safeword())}</span>`;

    button.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        const { safewordDialog } = await import("./safeword.mjs");
        await safewordDialog(app.document);
    });

    host.append(button);
}

/** Fallback when the structural class cannot be found: match the caption text. */
function findHeadingByText(root, text) {
    for (const heading of root.querySelectorAll("h3, .title h3, .title")) {
        if (heading.textContent.trim().toLowerCase() === text) return heading;
    }
    return null;
}

/**
 * Biography: the guide asks for three sentences of backstory. Pronouns, Age,
 * Faith and Connections belong to a different game.
 *
 * Structural first: pronouns/age/faith are `system.biography.characteristics.*`
 * fields and connections is `system.biography.connections`, so every one of
 * them can be found by its `name` attribute regardless of what language the
 * caption next to it is rendered in. That match climbs to `.input` - the actual
 * wrapper the characteristics fields sit in - rather than the `fieldset`/
 * `.form-group` this used to look for and never found there, which is exactly
 * how "hiding the input alone left the word floating on its own" happened: the
 * caption's wrapper was never being hidden at all, only whatever `.closest()`
 * happened to land on.
 *
 * The caption-text match stays as a fallback for a template that renders these
 * fields under different names.
 */
const BIOGRAPHY_CUTS = ["pronouns", "age", "faith", "connections"];
const BIOGRAPHY_ANCESTORS = "fieldset, .form-group, .biography-field, .input, label";

/**
 * HTML to something a textarea can hold, keeping the line breaks.
 *
 * One direction only, and never written back on its own: a field that has held
 * formatting since before this change keeps holding it until somebody edits it,
 * and what they see meanwhile is the text without the markup. Flattening on
 * open would be this module rewriting a player's backstory because they looked
 * at it.
 */
function plainBiography(html) {
    if (!html) return "";
    const box = document.createElement("div");
    box.innerHTML = String(html)
        .replace(/<\s*br\s*\/?>/gi, "\n")
        .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, "\n");
    return (box.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Save the backstory once, from what the player typed (E24 C2; S03-25, S17-39, A6).
 *
 * The value comes from the app, not from the textarea: `tidyBiography` keeps what was typed and not yet saved on
 * `app._drpgBiography`, so this needs no element and saves the same whether it runs on `focusout`, on a tab change or
 * after the sheet's close, when Foundry has already taken the window out of the page (v13's ApplicationV2 runs the
 * close hooks after it removes the element, as remembered; the harness's shim fires no `closeCharacterSheet` at all
 * and removes the element first; a table reads v14's order, E24's live check of the saves in AUDIT 9.2). Cleared before the write, so a focusout
 * followed by a close is one write, not two. Compared against the FLATTENED current value (`plainBiography`): a
 * formatted backstory merely opened, focused and left is not rewritten.
 */
export function saveBiography(app) {
    const held = app?._drpgBiography;
    if (!held) return null;
    const actor = app.document ?? null;
    if (!actor) {
        app._drpgBiography = null;
        return null;
    }
    const next = String(held.value ?? "").trim();
    const now = plainBiography(foundry.utils.getProperty(actor, "system.biography.background"));
    /*
     * SOMEBODY ELSE WROTE IT MEANWHILE (E45-C3b, 09.11.2026; general n6; Q-E45-C3b-1's default). `held.base` is the
     * backstory as this browser last knew it stored when the typing began (`tidyBiography`). A save that finds another
     * text stored writes nothing: the other write stands, the typed text stays held - the field keeps it, unsaved - and
     * the typist is told once; their next save writes theirs, as the base is now what they were told of. Scenario 71
     * I2 read on da8e8a3b: the player's save wrote their text over the GM's edit, no word said.
     */
    if (held.base !== undefined && held.base !== now && next !== now) {
        app._drpgBiography = { ...held, base: now };
        ui.notifications?.warn(game.i18n.localize("DRPG.Sheet.biographyChanged"));
        return null;
    }
    app._drpgBiography = null;
    // The same text already on its way (a tab's click, then the field's focusout, before the write is back) is not a second write.
    if (next === now || next === app._drpgBiographySending) return null;
    app._drpgBiographySending = next;
    app._drpgBiographyBase = next;
    return trustedWrite(actor, { "system.biography.background": next }, { reason: "sheetText" })
        .catch(err => error("Could not save the backstory", err))
        .finally(() => { if (app._drpgBiographySending === next) app._drpgBiographySending = null; });
}

export function tidyBiography(app, element, mode = modeOf(app)) {
    const tab = element.querySelector('section[data-application-part="biography"]');
    if (!tab) return;
    if (!mode.biography) {
        dropBiographyTab(app, element, tab);
        return;
    }

    /*
     * THREE SENTENCES OF BACKSTORY DO NOT NEED BOLD.
     *
     * The field arrives as a `<prose-mirror>` with its own edit toggle: an
     * editor to open, a toolbar to read, and a save step to remember, for a
     * paragraph. It becomes a textarea that writes itself on `focusout` -
     * exactly how the item tables edit their rows and how the pre-session note
     * already works, so this is the module's one way of editing text rather
     * than a third one.
     *
     * The toggle goes with it because it lives INSIDE the element being
     * replaced. Nothing is left to restyle, which is a better outcome than the
     * plan's - that asked for the button to be re-dressed in the module's own
     * skin, and a button nobody needs is better removed than repainted.
     *
     * NOT A FIELD OF DAGGERHEART'S FORM (E24 C2, 08.11.2026; S03-25, S17-39). The textarea carried the system's
     * `name`, so the sheet's `submitOnChange` form sent the flattened text with ANY field's change: a formatted
     * backstory rewritten as plain text, and two writes and two renders for one edit. It has no `name` now
     * (`data-drpg-field` instead) and saves through `saveBiography` alone: on `focusout`, on a tab change (the tab
     * bar's click, in the capture phase, before the switch) and on the sheet's close (`registerSheetTweaks`). What is
     * typed and not yet saved lives on the app (`app._drpgBiography`: the text, the selection, whether it had the
     * focus), so a render while somebody types - a GM writing their Hope - draws the new textarea with the text, the
     * selection and the focus the old one had. A sheet its viewer cannot edit gets a read-only field and no listener.
     */
    const actor = app?.document ?? null;
    const editor = tab.querySelector('prose-mirror[name="system.biography.background"]');

    if (actor && editor) {
        const area = document.createElement("textarea");
        area.dataset.drpgField = "biography";
        area.className = "drpg-biography-text";
        area.rows = 8;
        area.placeholder = game.i18n.localize("DRPG.Sheet.biographyPlaceholder");
        // Daggerheart's legend over the field, on the module's own key (A6, D10): the word is the module's.
        const legend = editor.closest("fieldset")?.querySelector(":scope > legend");
        if (legend) legend.textContent = game.i18n.localize("DRPG.Sheet.biographyLabel");

        const held = app._drpgBiography ?? null;
        const editable = mode.editable;
        // Read once the field is in the sheet (below): whether it is in the page, and the text it was drawn with.
        let inPage = false, drawn = "";
        const stored = plainBiography(foundry.utils.getProperty(actor, "system.biography.background"));
        // The stored text the next typing starts from (`saveBiography`'s base): what this draw shows, unless typed text is held.
        if (!held) app._drpgBiographyBase = stored;
        area.value = editable && held ? held.value : stored;

        if (!editable) {
            area.readOnly = true;
        } else {
            const remember = () => {
                app._drpgBiography = { value: area.value, start: area.selectionStart, end: area.selectionEnd,
                    focused: document.activeElement === area, base: app._drpgBiography?.base ?? app._drpgBiographyBase };
            };
            area.addEventListener("input", remember);
            // The caret moved without a keystroke that typed: kept only while there is something unsaved.
            for (const type of ["keyup", "pointerup"]) area.addEventListener(type, () => { if (app._drpgBiography) remember(); });
            area.addEventListener("focusout", () => {
                /* A textarea a render or the close took out of the page is not a player leaving the field: the
                   render's new textarea takes the text, the close hook saves it. Asked once the removal is done. A
                   root that was never in the page (a stand-in's) has nothing to be taken out of. A value set without
                   an `input` (a script's) is what the old field saved on focusout, and still is. */
                queueMicrotask(() => {
                    if (inPage && !area.isConnected) return;
                    if (!app._drpgBiography && area.value !== drawn) remember();
                    saveBiography(app);
                });
            });
        }

        editor.replaceWith(area);
        inPage = area.isConnected;
        drawn = area.value;

        if (editable && held?.focused) {
            try {
                area.focus({ preventScroll: true });
                area.setSelectionRange(held.start ?? area.value.length, held.end ?? area.value.length);
            } catch { /* a field the page cannot focus keeps its text */ }
        }
    }

    // A tab change saves before the switch; bound once per window, as the window outlives its renders.
    const root = element instanceof HTMLElement ? element : element?.[0];
    if (root && !root.dataset.drpgBiographyTabs) {
        root.dataset.drpgBiographyTabs = "1";
        root.addEventListener("click", ev => {
            if (ev.target?.closest?.("nav [data-tab]")) saveBiography(app);
        }, { capture: true });
    }

    // Every characteristics field, plus connections, found by name.
    for (const field of tab.querySelectorAll('[name*="characteristics"], [name*="connections"]')) {
        (field.closest(BIOGRAPHY_ANCESTORS) ?? field).classList.add("drpg-hidden-block");
    }

    // Fallback: anything whose own text is one of the unwanted captions, for a
    // template shape the name-based pass above did not anticipate.
    for (const node of tab.querySelectorAll("h1, h2, h3, h4, label, legend, span, div")) {
        const text = node.textContent?.trim().toLowerCase().replace(/[:*]/g, "");
        if (!text || text.length > 12) continue;
        if (!BIOGRAPHY_CUTS.includes(text)) continue;

        // Take the labelled block, not just the caption.
        const block = node.closest(BIOGRAPHY_ANCESTORS) ?? node;
        block.classList.add("drpg-hidden-block");
        // The input usually sits next to the caption rather than inside it.
        const sibling = block.nextElementSibling;
        if (sibling && sibling.querySelector?.("input, select, textarea, [contenteditable]")) {
            sibling.classList.add("drpg-hidden-block");
        }
    }
}

/* ==========================================================================
 * INVENTORY GROUPS
 * --------------------------------------------------------------------------
 * The guide's inventory is three capped categories, not one flat list. Items
 * carry their category as a flag, so they are sorted into labelled groups with
 * the carry limit shown - a player should be able to see "Weapons 1/1" without
 * counting.
 * ========================================================================== */

/*
 * ONE ROW FOR EVERYTHING YOU HOLD (E9, Dawid 27.08).
 *
 * E8 gave the three gear categories one shared budget of three, which left the
 * sheet drawing the same "2 / 3" three times under three headings - three
 * statements of one fact, and a player reading "1 / 3" over a full inventory in
 * three places has been told three contradictory things by one window.
 *
 * So they become one row, and what an item IS moves onto the item, as tags.
 * The category has not gone anywhere: it is still the key to the search table,
 * to Stage 6's confiscation and to the item manager. It is simply no longer
 * what decides which heading a thing sits under.
 */
export const GEAR_GROUP = "gear";

export const INVENTORY_GROUPS = [
    { key: "usable", labelKey: "DRPG.Sheet.groupUsables" },
    { group: GEAR_GROUP, labelKey: "DRPG.Sheet.groupGear" },
    { key: "truthBullet", labelKey: "DRPG.Sheet.groupTruthBullets" },
    // Last, under the evidence: a key is not something you found or made, it is
    // something a door means. See the note on keys in vault.mjs.
    { key: "bedroomKey", labelKey: "DRPG.Sheet.groupKeys" }
];

/**
 * The chips on one inventory row: what this is, then what else it can do.
 *
 * ONE PLACE, because three kinds of row want tags for three different reasons
 * and each of them would otherwise grow its own version. Gear names its home
 * first - the category is the tag tied to the table the thing came out of - and
 * then its extra roles. A Usable names the resource it refills, which is the
 * only thing anybody wants to know about one at a glance. Truth Bullets and
 * keys get nothing here: bullets carry their own richer badges (see
 * `bulletBadges`) and a key row that said "Room Key" under a heading reading
 * Room Keys would be furniture.
 *
 * @returns {{key: string, label: string, hint: string}[]}
 */
export function itemTags(item, inGearRow) {
    const named = (key, label, hint) => ({ key, label, hint });

    if (isUsable(item)) {
        const kind = usableKindOf(item);
        const def = kind ? USABLE_KINDS[kind] : null;
        return def
            ? [named(kind, def.chip ?? def.label,
                game.i18n.format("DRPG.Items.restores", { what: def.chip ?? def.label }))]
            : [];
    }

    if (!inGearRow) return [];

    const home = item.getFlag(MODULE_ID, "category");
    const label = role => ITEM_CATEGORIES[role]?.label ?? role;

    /*
     * THE HOME IS NEVER DRAWN TWICE, AND IT CAN ARRIVE TWICE.
     *
     * "Add an item" offers every equippable role as a tick box INCLUDING the
     * item's own category, and that is deliberate - see the note above
     * `roleChecks` in tables-editor.mjs. The reasoning there is about MECHANICS and it
     * still holds: `servesAs` checks the home first, so ticking "Tool" on a
     * tool changes nothing about what the thing can do, and a list that
     * reshuffles as the category dropdown moves is worse to use than one
     * redundant box.
     *
     * What that note could not know is that these tags would later become
     * VISIBLE. Once a badge is drawn per role, a redundant tick stops being
     * harmless: the row grows a duplicate "Tool · Tool", and an item Dawid
     * capped at two tags shows three. So the display de-duplicates rather than
     * the form growing a rule - the form's reasoning is still right, and this
     * is the half that changed.
     *
     * The seeded pool has never carried one (measured: 24 tables, 0 hits), so
     * nothing in the box is wrong today. This is for the GM who adds their own.
     */
    const extra = Array.from(new Set(rolesOf(item))).filter(role => role !== home);
    return [
        named(home, label(home), game.i18n.format("DRPG.Items.isA", { role: label(home) })),
        ...extra.map(role =>
            named(role, label(role), game.i18n.format("DRPG.Items.alsoServes", { role: label(role) })))
    ];
}
