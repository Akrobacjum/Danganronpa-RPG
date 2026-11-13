/**
 * Danganronpa RPG - Room Setup.
 * ---------------------------------------------------------------------------
 * The GM's window for a scene's rooms (`openRoomSetupDialog`): its tabs
 * (`ROOM_SETUP_TABS`, `roomSetupTab` - the Passages tab's row among them, drawn
 * by passages-tab.mjs, which this file reaches by `import()`: passages-tab.mjs
 * stays a file of its own, A10), its columns and cells (`ROOM_SETUP_COLUMN`,
 * `roomCells`, `roomSetupContent`: kit `dataTable`s since E46-C2a), the fog's and the
 * tokens' rows (`fogMatrixRows`, `recountTokenCells`), the stash matrix
 * (`STASH_GLYPHS`, `stashState`, `stashMatrixRows`, `PLACE_STATES`,
 * `placeToggle`); the form read back (`readRoomSetupForm`) and wired
 * (`wireRoomRatio`, `wireStashCells`, `wirePlaceSwitches`, `wireTokenButtons`,
 * `wireFogButtons`, `wireTwoRoomsCheck`); what Apply refuses on (`applyBlocks`,
 * `setApplyBlock`, `bedroomClaimedTwice`, `neighboursWritten`,
 * `neighboursTyped`, `namedByName`); and Apply's writes (`applyRoomRows`,
 * `applyStashMatrix`, `seedOwnerStashes`), through vault-store.mjs's
 * `setVaultRoom`, `updateRoom`, `setStash` and `ensureBedroomStash`.
 *
 * WHERE IT SITS. Moved out of vault.mjs by E41 C6 (1.2.97), a pure move that
 * `node tools/moved-only.mjs` proves line by line. vault.mjs re-exports the 5
 * names here it exported before (`ROOM_SETUP_TABS`, `roomSetupTab`,
 * `wireRoomRatio`, `setApplyBlock`, `openRoomSetupDialog`), so every importer
 * still imports vault.mjs, and nothing here imports it back (the facade rule,
 * .claude/rules/code.md). Of the stash's family it reads the fifteen names of
 * vault-store.mjs that made the store a file of its own.
 */

import { MODULE_ID, ITEM_CATEGORIES } from "./config.mjs";
import { pickableCategories } from "./inventory.mjs";
import { neighbouringRooms, ROOM_FLAGS, roomBroken, setRoomBroken } from "./movement.mjs";
import { SETTINGS } from "./settings.mjs";
import { SEARCH_FLAGS } from "./search-tokens.mjs";
import { SearchTokens } from "./search-tokens.mjs";
// Static is safe: the tables' family reaches back into this one only lazily (tables-pools.mjs `tableForRoom`'s
// `import("./vault.mjs")`).
import { roomStockTables } from "./tables.mjs";
import {
    dialogContent, plural, workingScene,
    forcedDeletion, wirePortraitPickers
} from "./utils.mjs";
import { kitTabs, wireKitTabs, emptyOption, drpgWindow, box, dataTable, stepper, toggle, iconButton } from "./ui-kit.mjs";
import { alreadyOpen, keepFresh, RAISED } from "./live.mjs";
import { roomActions } from "./facilities.mjs";
import {
    ROOM_FLAG, canBeRoom, namedRegions, playerRegionIds, roomDecided, setRoomFlag, roomNames, roomRegions, flagOver,
    listOver, isTrialScene, homeScene, sceneHoldsRooms
} from "./rooms.mjs";
import {
    VAULT_FLAGS, reconcileBedroomKeys, safeRoomImage, updateRoom, vaultOwnerOf, stashIn, setStash, ensureBedroomStash,
    startLocked, isConcealed, stashItemsIn, roomCensusOf, roomRatioLine, setVaultRoom, writeRoomLock
} from "./vault-store.mjs";

/* ==========================================================================
 * GM SETUP
 * ========================================================================== */

/**
 * One screen for everything a room IS.
 *
 * Whose bedroom it is, whether the stash in it is hidden, what searching it
 * draws from, what it is a good place to search for - and, since they are the
 * same kind of question asked of the same regions on the same evening, which
 * rests it allows. Those two used to be separate dialogs on separate GM-panel
 * entries, which meant setting up a map was a lap of the panel per room rather
 * than one pass down a table.
 *
 * Every column is a region flag written when the map is built. `rest.mjs` still
 * owns the two rest flags and their readers; this only edits them.
 */
/**
 * Write the live search-token count into every cell that has one.
 *
 * Read from `SearchTokens` rather than from the cell, so a spend that arrived from a
 * player's client is reflected instead of overwritten - which is the whole point of
 * having this run on somebody else's write as well as on the GM's own.
 */
/* E46-C2a (09.11.2026): the count is a compact kit stepper's field (`roomCells`' `tokens`), and the recount writes
   its value and the value it was drawn at (`data-drpg-shown`, what `wireTokenButtons` measures a step from) and
   nothing else of the row - never the GM's ticks (`keepFresh` below). */
function recountTokenCells(root, scene) {
    for (const input of root.querySelectorAll("input[data-drpg-token]")) {
        const text = String(SearchTokens.left(input.dataset.drpgToken, scene));
        if (input.value !== text) input.value = text;
        input.dataset.drpgShown = text;
    }
}

/*
 * ROOMS DOWN, PEOPLE ACROSS - the same way round as every other tab here.
 *
 * It used to be the other way, and it was the only table in the window that
 * was: rooms across the top, students down the side. With eighteen rooms the
 * headings had to be stood on end to fit, and a column heading you read by
 * tilting your head is one you read twice.
 *
 * The shape decides it. A cast is four to eight; a map is six to thirty-six.
 * The long axis belongs to the side that scrolls, and the short one to the
 * side that has to stay on screen - so rooms are rows and people are columns
 * whose names lie down and read at a glance.
 *
 * THE INPUT NAMES DO NOT CHANGE. `fog:${room}:${actorId}` carries both
 * coordinates, so Apply reads the same form it always did and never learns
 * which way the table was laid out.
 */
function fogMatrixRows(rooms, students, known, mastermindId = null) {
    /* THE MASTERMIND'S COLUMN (E91 C4; the owner's deferred item D067): the ledger keeps no row of their walks (fog.mjs
       `recordDiscovery`) and every reader that asks for them counts every room as known (`myDiscoveredRooms`), so their
       boxes are drawn ticked and disabled, the reason as the tooltip - drawn empty, a GM's tick wrote cells nobody reads.
       A disabled box is never changed, so `readRoomSetupForm` sends nothing for it. */
    const why = foundry.utils.escapeHTML(game.i18n.localize("DRPG.Vault.fogMastermind"));
    // A row a room for the kit's `dataTable` (E46-C2a): the room's cell under `name`, a student's under their id.
    return rooms.map(room => {
        const escRoom = foundry.utils.escapeHTML(room);
        // Both coordinates, as the input's name has them: a screen reader walking the
        // grid hears "Big IT Room - Player A", not "checkbox" seventy-two times.
        return Object.fromEntries([["name", `<strong>${escRoom}</strong>`], ...students.map(actor => [actor.id,
            `<input type="checkbox"
                aria-label="${escRoom} - ${foundry.utils.escapeHTML(actor.name)}"
                name="fog:${escRoom}:${actor.id}" ${actor.id === mastermindId ? `checked disabled data-tooltip="${why}"`
                : known.get(actor.id)?.has(room) ? "checked" : ""} />`])]);
    });
}

/* One column per student, for the two matrices: the kit's head cut after its second line, the whole name in its title
   and its accessible name (`lines: 2`; E46-C2a, the owner's Q-E46-2 of 09.11.2026 - two lines, as every table of the
   kit cuts a head). Until E46-C2a one line cut with an ellipsis (E12 C15, audit S12-23: the audit read the student
   columns at 52-79 px beside a 1030 px Room column, and the names broke over two and three lines, each aligned
   differently); at 1366x768 all four names of the suite's world were cut on that one line (probe/summary.txt). */
function studentColumns(students) {
    return students.map(a => ({ key: a.id, label: a.name, cls: "student", lines: 2 }));
}

/*
 * THE STASH MATRIX. Same shape as the Fog one above - rooms down, students
 * across - because four tables that look alike read as one window.
 *
 * ONE BUTTON PER CELL, NOT TWO CHECKBOXES. A stash cell carries two facts
 * ("is there one" and "is it hidden") and the obvious encoding is a pair of
 * boxes. At eight students and twelve rooms that is 192 targets to hit, half
 * of which are meaningless - "hidden" on a room with no stash - so the cell
 * cycles through the three states that actually exist instead.
 *
 * The state lives in a hidden input rather than on the button, because Apply
 * reads this form by input NAME and knows nothing about how the cell was
 * drawn - the same contract the fog matrix keeps.
 */
const STASH_GLYPHS = {
    "": '<span class="drpg-stash-none">-</span>',
    open: '<i class="fa-solid fa-box-open"></i>',
    hidden: '<i class="fa-solid fa-box"></i><i class="fa-solid fa-lock drpg-stash-lock"></i>'
};

function stashState(room, actorId, scene) {
    const entry = stashIn(room, actorId, scene);
    if (!entry) return "";
    return entry.concealed ? "hidden" : "open";
}

function stashGlyph(state) {
    return STASH_GLYPHS[state] ?? STASH_GLYPHS[""];
}

/* The three states a stash cell cycles, drawn with the cells' own glyphs above the table (E12 C15,
   audit S12-23: the icons had no legend, and the dash of an empty cell was all but invisible). */
function stashLegend() {
    const STATES = [["", "DRPG.Vault.stashNone"], ["open", "DRPG.Vault.stashOpen"], ["hidden", "DRPG.Vault.stashHidden"]];
    return `<p class="drpg-stash-legend" data-drpg-stash-legend>${STATES.map(([state, key]) =>
        `<span data-drpg-stash-state="${state}">${stashGlyph(state)} ${game.i18n.localize(key)}</span>`).join("")
    }<span><span class="drpg-stash-swatch"></span> ${game.i18n.localize("DRPG.Vault.stashOwnBedroom")}</span></p>`;
}

/*
 * A room's place for one category: neither, good or bad (E12 C15) - see `placeSwitches` in
 * `roomCells`. The button says its state three ways, because each reader needs a different one:
 * the glyph and the colour for the eye, the words in its accessible name for a screen reader, and
 * `data-drpg-place` for the click that moves it on.
 */
const PLACE_STATES = {
    "": { glyph: "fa-regular fa-circle", key: "DRPG.Vault.placeNeither" },
    good: { glyph: "fa-solid fa-thumbs-up", key: "DRPG.Vault.favours" },
    bad: { glyph: "fa-solid fa-thumbs-down", key: "DRPG.Vault.hinders" }
};

function placeToggle(state, label) {
    const { glyph, key } = PLACE_STATES[state] ?? PLACE_STATES[""];
    const name = foundry.utils.escapeHTML(label);
    return `<button type="button" class="drpg-place-toggle" data-drpg-place="${state}" data-drpg-label="${name}"
        aria-label="${name}: ${foundry.utils.escapeHTML(game.i18n.localize(key))}"
        title="${foundry.utils.escapeHTML(game.i18n.localize("DRPG.Vault.placeCycle"))}"><i class="${glyph}"></i> ${name}</button>`;
}

function stashMatrixRows(rooms, students, scene) {
    return rooms.map(room => {
        const escRoom = foundry.utils.escapeHTML(room);
        const bedroomOwner = vaultOwnerOf(room, scene);
        const cells = students.map(actor => {
            const state = stashState(room, actor.id, scene);
            // The bedroom owner's CELL is shaded - one per bedroom row, not a column -
            // so a GM can see at a glance which stash appeared by itself when they
            // assigned the room (the legend above the table says so, E12 C15).
            // On the cell's button since E46-C2a: the kit's `dataTable` dresses a cell by its column only.
            const own = bedroomOwner === actor.id ? " drpg-stash-bedroom" : "";
            return [actor.id, `<input type="hidden" name="stash:${escRoom}:${actor.id}" value="${state}" data-drpg-drawn="${state}" />
                <button type="button" class="drpg-stash-toggle${own}"
                    data-drpg-stash="${escRoom}:${actor.id}"
                    title="${foundry.utils.escapeHTML(
                        game.i18n.localize("DRPG.Vault.stashCycle"))}">${stashGlyph(state)}</button>`];
        });
        return Object.fromEntries([["name", `<strong>${escRoom}</strong>`], ...cells]);
    });
}

/* One pass gathers every fact about a room; the tabs then deal the same
 * cells into four thematic tables. The input NAMES are the contract with
 * the Apply callback below, identical whichever table a cell sits in -
 * Apply reads the whole form and never asks which tab was showing. */
function roomCells(rooms, { students, tables, categories, regions, scene, maxTokens, REST_FLAGS }) {
    /* THE PLACEHOLDER ONCE (E46-C2a; audit S13-36 (4)): the example sentence stood in every empty description, eighteen
       times on a school of eighteen rooms; it shows how to write one, so it stands in the first empty field alone. */
    const words = new Map(rooms.map(room => [room, flagOver(regions.get(room) ?? [], VAULT_FLAGS.description) ?? ""]));
    const firstEmpty = rooms.find(room => !words.get(room));
    return rooms.map(room => {
        // Off the pieces the form writes back (E12 C2a): the room readers read rooms only, and
        // this window lists every named region so that a GM can make one a room - a cell read
        // through them would show a region that is no room yet as empty, and Apply clear it.
        // Every piece that can be a room, read as one (E12 fix r1-G1, 11.10.2026; review round 1
        // EARLY-C2a-1, EARLY-C2a-2): until then the cells read the LAST region of the name - a
        // Teleport's, or a piece drawn after the room was set up - so they showed the room
        // unowned, unlocked and unsealed while the rules read it locked, and Apply wrote that.
        const pieces = regions.get(room) ?? [];
        const owner = flagOver(pieces, VAULT_FLAGS.owner) ?? "";
        const table = flagOver(pieces, VAULT_FLAGS.table) || "";
        const favours = listOver(pieces, VAULT_FLAGS.favours);
        const hinders = listOver(pieces, VAULT_FLAGS.hinders);
        // NOT `esc`: every other file in this module uses that name for the
        // escaping FUNCTION, so a local string by the same name here means the
        // next `esc(x)` written inside this block is a TypeError.
        const escRoom = foundry.utils.escapeHTML(room);
        const picture = safeRoomImage(flagOver(pieces, VAULT_FLAGS.image));
        const pickLabel = foundry.utils.escapeHTML(game.i18n.localize("DRPG.Vault.imagePick"));
        const clearLabel = foundry.utils.escapeHTML(game.i18n.localize("DRPG.Vault.imageClear"));

        const people = students.map(a =>
            `<option value="${a.id}"${a.id === owner ? " selected" : ""}>${
                foundry.utils.escapeHTML(a.name)}</option>`).join("");
        const tableOptions = tables.map(t =>
            `<option value="${foundry.utils.escapeHTML(t)}"${t === table ? " selected" : ""}>${
                foundry.utils.escapeHTML(t)}</option>`).join("");
        /*
         * ONE SWITCH A CATEGORY, THREE STATES (E12 C15, audit S08-26). This was the same set of
         * category boxes twice, in a "Good place" and a "Bad place" column, so a category could be
         * ticked as both and a render hook had to untick the other side. Now one button a category
         * cycles neither -> good -> bad, as a stash cell cycles its three states. The two boxes are
         * still in the cell, hidden, under the names Apply has always read (`fav:` and `hin:`); the
         * button ticks at most one of them, so the form posts the same names and values as before
         * and `readRoomSetupForm` is unchanged. A stored row holding a category in both lists is
         * drawn as good, which is what Apply's own filter has always kept of it.
         */
        /* The two boxes are hidden, and still controls: a11y.mjs `CONTROLS` reads a checkbox with the
           `hidden` attribute as one, and a reader that reaches it reads it out. With no name they
           turned both control-name sweeps of tier 2 red - "every standing GM window names every
           control it draws" counted 48 unnamed on Floor 1's Room Setup (harness, 19abd42 with this
           commit's tests, 11.10.2026; E12 fix r2-S2, review EARLY-C15-1). Each is named as `named`
           below names a column - "Good place to look for: Usable: Big IT Room". */
        const boxName = (key, label) => ` aria-label="${foundry.utils.escapeHTML(game.i18n.localize(key))}: ${
            foundry.utils.escapeHTML(label)}: ${escRoom}"`;
        const placeSwitches = categories.map(([key, cat]) => {
            const state = favours.includes(key) ? "good" : hinders.includes(key) ? "bad" : "";
            return `<span class="drpg-place-switch">
                <input type="checkbox" hidden class="drpg-place-box" name="fav:${escRoom}:${key}"${
                    boxName("DRPG.Vault.favours", cat.label)}${state === "good" ? " checked" : ""} />
                <input type="checkbox" hidden class="drpg-place-box" name="hin:${escRoom}:${key}"${
                    boxName("DRPG.Vault.hinders", cat.label)}${state === "bad" ? " checked" : ""} />
                ${placeToggle(state, cat.label)}</span>`;
        }).join("");

        /* A NAME A SCREEN READER CAN SAY (21.09). A control in a table row is named by
           its column header only for the eye; 1.2.47's a11y sweep found these with no
           name at all, and it can only copy a name the control already carries. Each
           says its column and its room: "Locked: Big IT Room", not "checkbox". */
        const COLUMN = {
            owner: "DRPG.Vault.owner", isroom: "DRPG.Vault.isRoomColumn", locked: "DRPG.Vault.lockedColumn",
            startlocked: "DRPG.Vault.lockedAtStartColumn", notshared: "DRPG.Vault.notSharedColumn",
            neighbours: "DRPG.Vault.neighboursColumn", broken: "DRPG.Vault.brokenColumn",
            nosearch: "DRPG.SearchTokens.sealedColumn", table: "DRPG.Vault.table",
            short: "DRPG.Rest.shortColumn", long: "DRPG.Rest.longColumn",
            desc: "DRPG.Vault.descriptionColumn"
        };
        const named = key => COLUMN[key]
            ? ` aria-label="${foundry.utils.escapeHTML(game.i18n.localize(COLUMN[key]))}: ${escRoom}"` : "";
        // A cell's markup for the kit's `dataTable` (E46-C2a); a hint is the cell's `title` (`{ html, title }`), centred by its column's rule.
        const check = (name, on, title = "") => {
            const html = `<input type="checkbox" name="${name}:${escRoom}"${named(name)}
                ${on ? "checked" : ""} />`;
            return title ? { html, title } : html;
        };
        /*
         * THIS IS A ROOM (E12 C1, 11.10.2026; rooms.mjs). Every region of the name, since a room is
         * a name on a scene. Decided - every piece carries the flag - the box reads whether any
         * piece is marked; undecided, whether a piece may be a room at all, which is what Apply then
         * writes: the GM who applies this window has decided. No piece may be one (a passage's
         * behaviour, a region a player drew): the box is drawn off and Apply writes nothing. The
         * pieces are those that may be rooms (`namedByName`), so a Teleport of the name, which is
         * never decided, leaves the box reading what the GM decided of the rest.
         */
        const possible = pieces.length > 0;
        const decided = pieces.length > 0 && pieces.every(roomDecided);
        const isRoomNow = decided ? pieces.some(piece => piece.getFlag(MODULE_ID, ROOM_FLAG) === true) : possible;
        // Undecided, the box is a suggestion until Apply (E20 fix round, C-10): the ratio line counts it apart (`data-drpg-undecided`).

        return {
            name: `<strong>${escRoom}</strong>`,
            owner: `<select name="owner:${escRoom}"${named("owner")}>${emptyOption("DRPG.Vault.noOwner")}${people}</select>`,
            /* The kit's switch (E46-C2a; E46's goal, "the 'This is a room' switch"): `toggle` draws the input and its
               words, and the column's name and the room are its accessible name, as every control here says both;
               `data-drpg-undecided` rides the input as it did, for `wireRoomRatio`. Both through the switch's `attrs`
               since E47-KFa (written into the drawn input after `role="switch"` before it). */
            isroom: {
                html: toggle({ name: `isroom:${room}`, checked: isRoomNow, label: "", disabled: !possible,
                    attrs: { "aria-label": `${game.i18n.localize(COLUMN.isroom)}: ${room}`, "data-drpg-undecided": possible && !decided } }),
                title: game.i18n.localize("DRPG.Vault.isRoomHint")
            },
            concealed: check("concealed", isConcealed(room, scene)),
            short: check("short", flagOver(pieces, REST_FLAGS.short)),
            /* THE ROOM'S ACTIONS (E93 C2): how many, and the button that opens their editor (facility-editor.mjs
               `editRoomActions`), which writes at once on its Save, as the search token buttons write at once; Apply reads
               nothing of this cell. Drawn off where no piece of the name may be a room (nothing could hold them). */
            facilities: `<span class="drpg-facility-cell"><span data-drpg-facility-count="${escRoom}">${roomActions(scene, room).length}</span>
                ${iconButton({ icon: "fa-solid fa-pen-to-square", label: `${game.i18n.localize("DRPG.Facility.editor.edit")}: ${room}`,
                    disabled: !possible, attrs: { "data-drpg-facility-edit": room } })}</span>`,
            long: check("long", flagOver(pieces, REST_FLAGS.long)),
            locked: check("locked", flagOver(pieces, ROOM_FLAGS.locked)),
            startlocked: check("startlocked", pieces.some(startLocked),
                game.i18n.localize("DRPG.Vault.lockedAtStartHint")),
            // Broken (E74 C5): a lock Force the Door or a breach forced (movement.mjs `roomBroken`); unticked and applied,
            // the lock holds again - the GM's repair by hand.
            broken: check("broken", roomBroken(scene, room), game.i18n.localize("DRPG.Vault.brokenHint")),
            nosearch: check("nosearch", flagOver(pieces, SEARCH_FLAGS.sealed)),
            // Advice only: it changes no rule, just which regions the ratio
            // line above the table counts. See `sharedRooms`.
            notshared: check("notshared", flagOver(pieces, VAULT_FLAGS.notShared),
                game.i18n.localize("DRPG.Vault.notSharedHint")),
            // The list every piece holds (E12 C14); greyed under it when blank, the rooms the
            // rules connect this one to now - its walls and the lists that name it.
            neighbours: `<input type="text" name="neighbours:${escRoom}"${named("neighbours")}
                value="${foundry.utils.escapeHTML(neighboursWritten(pieces))}"
                placeholder="${foundry.utils.escapeHTML(neighbouringRooms(scene, room).join(", "))}"
                title="${foundry.utils.escapeHTML(game.i18n.localize("DRPG.Vault.neighboursHint"))}" />`,
            /* [-] 2 [+] / 3 [refill] on one line (E12 C15, audit S08-26; the kit's since E46-C2a): the count a compact kit
               `stepper` in its cell - its - and + a step of one, read by `wireTokenButtons` as one write a click - its
               cap after it and the refill an icon button. A button is a block in Foundry's own sheet, so until E12 C15
               the three stood one under another after the count and a room's row was about 128 px tall in the audit's
               screenshot - 2200 px of scrolling for 17 rooms; 88 px a row under the glass at 1366x768 before E46-C2a
               (probe/summary.txt). The field has no name: Apply never reads it (the count acts at once). */
            tokens: `<span class="drpg-token-step">${stepper({ value: SearchTokens.left(room, scene), min: 0, max: maxTokens, compact: true,
                words: { down: game.i18n.localize("DRPG.SearchTokens.spendOne"), up: game.i18n.localize("DRPG.SearchTokens.giveOne") },
                attrs: { "data-drpg-token": room, "aria-label": `${game.i18n.localize("DRPG.SearchTokens.title")}: ${room}` } })}<span
                class="drpg-token-max">/ ${maxTokens}</span>${iconButton({ icon: "fa-solid fa-rotate-left",
                label: game.i18n.localize("DRPG.SearchTokens.refillRoom"), attrs: { "data-drpg-token-refill": room } })}</span>`,
            table: `<select name="table:${escRoom}"${named("table")}>
                <option value="">${game.i18n.localize("DRPG.Vault.globalPool")}</option>
                ${tableOptions}</select>`,
            place: `<span class="drpg-place-switches">${placeSwitches}</span>`,
            // A textarea, not an input: these are sentences. The cell escapes
            // the wrapping-cell rule the rest of this table lives under - see
            // the `:has(input[type="text"], textarea)` exception in the
            // stylesheet - so the prose wraps instead of stretching the window.
            description: `<textarea name="desc:${escRoom}" rows="5"${named("desc")}${room === firstEmpty
                ? ` placeholder="${foundry.utils.escapeHTML(game.i18n.localize("DRPG.Vault.descriptionPlaceholder"))}"` : ""}
                >${foundry.utils.escapeHTML(words.get(room))}</textarea>`,
            /* The picture (E77 C1): `wirePortraitPickers`' thumbnail and hidden field, keyed by the room's name
               as the description is, and a button that empties both. The thumbnail shows only what
               `safeRoomImage` accepts of the stored path - a value it refuses is drawn as no picture, and the
               next Apply of the row writes what the window shows. Under it, since E46-C2a, the line that says the picture
               is too large or does not load (`wirePictureWarnings`; the owner's 13.10 amend), empty until it is read. */
            image: `<img class="drpg-room-picture" data-drpg-portrait="${escRoom}" alt=""${
                picture ? ` src="${foundry.utils.escapeHTML(picture)}"` : ""}
                title="${pickLabel}" aria-label="${pickLabel}: ${escRoom}" />
                <input type="hidden" name="img:${escRoom}" value="${foundry.utils.escapeHTML(picture ?? "")}" />
                <button type="button" class="drpg-mini-button" data-drpg-picture-clear
                    title="${clearLabel}" aria-label="${clearLabel}: ${escRoom}">✕</button>
                <div class="drpg-room-picture-say" data-drpg-picture-say aria-live="polite"></div>`
        };
    });
}

/* The Scenes tab last (E13 C5; the owner's answer Q-E13-1 e, 09.10.2026): it is set once a season,
   the others every session. Its panel is trial-scene.mjs's (`scenesTabHtml`). The Passages tab
   after Doors (E79 C5; the plan's D31 mockup): a secret passage is a way between two rooms, as a
   door is. Its panel is passages-tab.mjs's (`passagesTabHtml`), and its buttons write at once. */
export const ROOM_SETUP_TABS = Object.freeze([
    ["bedrooms", "DRPG.Vault.tabBedrooms"],
    ["doors", "DRPG.Vault.tabDoors"],
    ["passages", "DRPG.Vault.tabPassages"],
    ["search", "DRPG.Vault.tabSearching"],
    // The Rest tab is the Facilities tab since E93 C2 (the owner's audit entry E93 (1)): the two rest flags and the room's
    // actions. Its key stays `rest`, as the tile's does.
    ["rest", "DRPG.Vault.tabFacilities"],
    ["stashes", "DRPG.Vault.tabStashes"],
    ["description", "DRPG.Vault.tabDescription"],
    ["fog", "DRPG.Vault.tabFog"],
    ["scenes", "DRPG.Vault.tabScenes"]
]);

/**
 * The tab Room Setup opens on: the one asked for when it is a tab, else Bedrooms on a scene that
 * holds a room and Scenes on one that holds none (Q-E13-1 e) - a GM who opens Room Setup on a new
 * map, or before any room is marked, has nothing to set on the room tabs yet.
 */
export function roomSetupTab(tab, holdsRooms) {
    if (ROOM_SETUP_TABS.some(([key]) => key === tab)) return tab;
    return holdsRooms ? "bedrooms" : "scenes";
}

/*
 * FIXED COLUMNS, ONE WIDTH A KIND OF CELL (E12 C15, audit S08-26 and S12-23).
 *
 * The tables were laid out by their content, so the audit read the checkbox columns of Doors and
 * Fog at anything from 190 to 460 px in a 1400 px window that was mostly empty, a Room column of
 * 1030 px on Stashes beside student columns of 52-79 px, and a different width for the same kind
 * of column on every tab. Each table now states its columns with a `<col>` per column, the room
 * first, and the stylesheet gives each kind one width (`.drpg-col-*`, `table-layout: fixed`), so
 * the column of a checkbox is as wide on Doors as on Rests and every student's column on Stashes is
 * as wide as on Fog. What a column holds is the key below; the student matrices are "student".
 *
 * ON THE KIT (E46-C2a, 09.11.2026). Each table is the kit's `dataTable`, a kind its column's `cls`: the kit writes
 * `drpg-data-col-<kind>` on the `<col>`, the head and every cell, and components.css's section "Room setup" gives the
 * widths, the room's first ("room", the 220 px E12 C15 chose).
 */
const ROOM_SETUP_COLUMN = {
    owner: "select", isroom: "check", locked: "check", startlocked: "check", broken: "check", notshared: "check",
    neighbours: "text", nosearch: "check", tokens: "step", table: "select", place: "place",
    short: "check", long: "check", facilities: "step", description: "prose", image: "picture"
};

/* Each column's heading, by the cell's key in `roomCells`. */
const ROOM_SETUP_HEAD = {
    owner: "DRPG.Vault.owner", isroom: "DRPG.Vault.isRoomColumn", locked: "DRPG.Vault.lockedColumn",
    startlocked: "DRPG.Vault.lockedAtStartColumn", broken: "DRPG.Vault.brokenColumn", notshared: "DRPG.Vault.notSharedColumn",
    neighbours: "DRPG.Vault.neighboursColumn", nosearch: "DRPG.SearchTokens.sealedColumn", tokens: "DRPG.SearchTokens.title", table: "DRPG.Vault.table",
    place: "DRPG.Vault.placeColumn", short: "DRPG.Rest.shortColumn", long: "DRPG.Rest.longColumn",
    facilities: "DRPG.Facility.roomColumn",
    description: "DRPG.Vault.descriptionColumn", image: "DRPG.Vault.imageColumn"
};

/** The window's body: the tab strip and one panel per tab, dealt from the same cells. */
function roomSetupContent({ initial, cells, students, stashRows, fogRows, uncovered, maxTokens, scenesPanel, passagesPanel = "" }) {
    // The kit's tables (E46-C2a): the room first, its kind "room"; then the tab's columns in their order, or the students.
    const roomColumn = { key: "name", label: game.i18n.localize("DRPG.Vault.room"), cls: "room" };
    const tableFor = cols => dataTable({ columns: [roomColumn, ...cols.map(key =>
        ({ key, label: game.i18n.localize(ROOM_SETUP_HEAD[key]), cls: ROOM_SETUP_COLUMN[key] }))], rows: cells });
    const matrix = rows => dataTable({ columns: [roomColumn, ...studentColumns(students)], rows });

    // Each tab's pane, by its key; the bar and the panes are the kit's (`kitTabs`), in ROOM_SETUP_TABS's order.
    const panes = {
        bedrooms: `
            <p>${game.i18n.localize("DRPG.Vault.bedroomsIntro")}</p>
            ${/* a warning box (E46-C2a; E21's carried site ~431), shown only while a student has two bedrooms */ ""}
            <div data-drpg-two-rooms-box hidden>${box("warning", `<p data-drpg-two-rooms></p>`)}</div>
            ${tableFor(["owner"])}
        `,

        doors: `
            <p>${game.i18n.localize("DRPG.Vault.doorsIntro")}</p>
            ${/* information, not a warning (D11; audit S06-59, E22 C6b): the count advises and changes no rule */ ""}
            ${box("info", `<p class="notes" data-drpg-ratio></p>`)}
            ${tableFor(["isroom", "locked", "startlocked", "broken", "notshared", "neighbours"])}
            <p class="notes">${game.i18n.localize("DRPG.Vault.notSharedNote")}</p>
            <p class="notes">${game.i18n.localize("DRPG.Vault.neighboursNote")}</p>
        `,

        passages: passagesPanel,

        search: `
            <p>${game.i18n.localize("DRPG.Vault.searchIntro")}</p>
            ${tableFor(["nosearch", "tokens", "table", "place"])}
            <p class="notes">${game.i18n.localize("DRPG.Vault.manageNote")}</p>
            <p class="notes">${game.i18n.format("DRPG.SearchTokens.roomSetupNote",
                { max: maxTokens })}</p>
            <p class="notes">${game.i18n.localize("DRPG.SearchTokens.sealedNote")}</p>
        `,

        rest: `
            <p>${game.i18n.localize("DRPG.Rest.manageIntro")}</p>
            ${tableFor(["short", "long", "facilities"])}
            <p class="notes">${game.i18n.localize("DRPG.Facility.editor.tabNote")}</p>
        `,

        stashes: `
            <p>${game.i18n.localize("DRPG.Vault.stashesIntro")}</p>
            ${stashLegend()}
            ${matrix(stashRows)}
            <p class="notes">${game.i18n.localize("DRPG.Vault.stashesNote")}</p>
        `,

        description: `
            <p>${game.i18n.localize("DRPG.Vault.descriptionIntro")}</p>
            ${tableFor(["description", "image"])}
            <p class="notes">${game.i18n.localize("DRPG.Vault.descriptionNote")}</p>
        `,

        fog: `
            <p>${game.i18n.localize("DRPG.Vault.fogIntro")}</p>
            ${uncovered > 0 ? box("warning", `<p>${game.i18n.format("DRPG.Vault.fogUncovered",
                { pct: uncovered })}</p>`) : ""}
            <div class="drpg-fog-bulk">
                <button type="button" class="drpg-mini-button" data-drpg-fog-all="discover">${
                    game.i18n.localize("DRPG.Vault.discoverAll")}</button>
                <button type="button" class="drpg-mini-button" data-drpg-fog-all="hide">${
                    game.i18n.localize("DRPG.Vault.hideAll")}</button>
            </div>
            ${matrix(fogRows)}
            <p class="notes">${game.i18n.localize("DRPG.Vault.fogNote")}</p>
        `,

        scenes: scenesPanel
    };

    return dialogContent(`<form>
            <p class="notes">${game.i18n.localize("DRPG.Vault.manageIntro")}</p>
            ${/* information, not a warning (E46-C2a; E21's carried site ~499): a new map has no room yet */ ""}
            ${cells.length ? "" : box("info", `<p>${game.i18n.localize("DRPG.Vault.noRooms")}</p>`)}
            ${kitTabs(ROOM_SETUP_TABS.map(([key, label]) => ({ key, label: game.i18n.localize(label), html: panes[key] })), { active: initial })}
        </form>`);
}

/** What Apply hands back: every row, the Fog boxes the GM changed and the stash matrix, read off the form by input name. */
function readRoomSetupForm(d, { rooms, students, categories }) {
    const f = d.element.querySelector("form");
    const pick = name => f.querySelector(`[name="${CSS.escape(name)}"]`);
    // `null` when the box is drawn off: no piece of the name may be a room (`roomCells`).
    const roomBox = box => box && !box.disabled ? box.checked : null;
    const roomRows = rooms.map(room => ({
        room,
        owner: pick(`owner:${room}`)?.value ?? "",
        shortRest: Boolean(pick(`short:${room}`)?.checked),
        longRest: Boolean(pick(`long:${room}`)?.checked),
        locked: Boolean(pick(`locked:${room}`)?.checked),
        lockedAtStart: Boolean(pick(`startlocked:${room}`)?.checked),
        broken: Boolean(pick(`broken:${room}`)?.checked),
        noSearch: Boolean(pick(`nosearch:${room}`)?.checked),
        notShared: Boolean(pick(`notshared:${room}`)?.checked),
        isRoom: roomBox(pick(`isroom:${room}`)),
        ...neighboursTyped(pick(`neighbours:${room}`), room, rooms),
        description: (pick(`desc:${room}`)?.value ?? "").trim(),
        // The picture's hidden field (E77 C1), checked by `applyRoomRows` before anything is written.
        image: (pick(`img:${room}`)?.value ?? "").trim(),
        table: pick(`table:${room}`)?.value ?? "",
        favours: categories
            .map(([key]) => key)
            .filter(key => pick(`fav:${room}:${key}`)?.checked),
        // The place switch ticks at most one of the two boxes
        // (E12 C15); the filter repeats it here so a row somebody
        // edited by other means still cannot say both.
        hinders: categories
            .map(([key]) => key)
            .filter(key => pick(`hin:${room}:${key}`)?.checked
                && !pick(`fav:${room}:${key}`)?.checked)
    }));
    // Only the boxes the GM changed, against what the window drew - see
    // `applyDiscoveryChanges` (ROOM-01). The ledger keeps growing while this
    // is open, and a box nobody touched says nothing about a room found since.
    const fogChanges = [];
    for (const actor of students) {
        for (const room of rooms) {
            const box = pick(`fog:${room}:${actor.id}`);
            if (box && box.checked !== box.defaultChecked) {
                fogChanges.push({ actorId: actor.id, room, value: box.checked });
            }
        }
    }
    // Room -> every stash cell as the GM left it (`state`) beside the state it was drawn in (`drawn`, E89 C7):
    // "" no stash, "open" or "hidden". `applyStashMatrix` acts on a cell whose two differ, and on no other.
    const stashMatrix = {};
    for (const room of rooms) {
        stashMatrix[room] = students.flatMap(actor => {
            const cell = pick(`stash:${room}:${actor.id}`);
            if (!cell) return [];
            return [{ actorId: actor.id, state: cell.value ?? "", drawn: cell.getAttribute("data-drpg-drawn") ?? "" }];
        });
    }
    return { rooms: roomRows, fogChanges, stashes: stashMatrix };
}

/*
 * HOW BIG THIS BUILDING IS FOR THE PEOPLE STILL IN IT (Dawid, 31.08).
 *
 * G-36 asks for one and a half SHARED rooms per player, and that rule
 * lives at season setup where nobody reads it again. Students die and
 * rooms do not: after the third trial eight people rattle around a
 * building built for sixteen, nobody meets anybody, and there are no
 * witnesses to anything.
 *
 * Deliberately not a mechanic - the GM closes wings by hand, which is
 * what the locks below are for. The line follows the boxes as they are
 * ticked rather than reporting the state the window opened in.
 *
 * ONE CENSUS (E20 C1; the owner's Q-3, 29.10.2026). The count is
 * `roomCensusOf`'s, the rule the checklist and Pre-season checks read off
 * the flags: marked, no owner, not "No privacy", and a locked room
 * counted - this line used to drop it, so a locked room and a dead
 * student made it disagree with the checklist about one map. How many
 * of the counted rooms are locked is said after the ratio, so closing a
 * wing still shows here. Exported for R1500, which reads it on a form of
 * its own.
 */
export function wireRoomRatio(dialog, rooms, living) {
    const ratio = dialog.element.querySelector("[data-drpg-ratio]");
    if (ratio) {
        const paintRatio = () => {
            const form = dialog.element.querySelector("form");
            /*
             * READ OFF THE FORM, NOT OFF THE FLAGS (audit A21).
             *
             * Every column the census asks is one the GM is looking at
             * right now - the owner on the Bedrooms tab, "This is a room",
             * "No privacy" and the lock on this one - so the line follows
             * the ticks rather than the saved state.
             */
            const field = (prefix, room) => form?.querySelector(`[name="${CSS.escape(`${prefix}:${room}`)}"]`);
            const ticked = (prefix, room) => Boolean(field(prefix, room)?.checked);
            /* A box drawn off is a name no piece of which may be a room (`roomCells`). A box nobody decided yet is ticked
               as a suggestion (`data-drpg-undecided`), and counted only once the GM has changed it in this window: on a
               fresh map every named region read as a room here, 12 against the checklist's 0 (E20 fix round, the
               correctness review's C-10). The suggestions are said apart, after the ratio. */
            const box = room => field("isroom", room);
            const open = room => Boolean(box(room) && !box(room).disabled && box(room).checked);
            const suggested = room => open(room) && box(room).hasAttribute("data-drpg-undecided") && !changed.has(room);
            const census = roomCensusOf(rooms.map(room => ({
                name: room,
                room: open(room) && !suggested(room),
                owner: field("owner", room)?.value ?? "",
                notShared: ticked("notshared", room),
                locked: ticked("locked", room)
            })));
            const pending = rooms.filter(suggested).length;
            ratio.textContent = pending ? `${roomRatioLine(census, living)} ${plural("DRPG.Vault.roomCensusUndecided", { n: pending })}`
                : roomRatioLine(census, living);
        };
        const changed = new Set();
        dialog.element.addEventListener("change", ev => {
            const name = String(ev.target?.name ?? "");
            if (name.startsWith("isroom:")) changed.add(name.slice("isroom:".length));
            if (name.startsWith("locked:") || name.startsWith("notshared:")
                || name.startsWith("owner:") || name.startsWith("isroom:")) paintRatio();
        });
        paintRatio();
    }
}

/*
 * Cycle a stash cell: none -> open -> hidden -> none.
 *
 * The hidden input is the truth and the glyph follows it, never the
 * other way round - Apply reads the input, and a cell whose picture
 * and value could disagree is a cell that lies to whoever saves it.
 */
function wireStashCells(root) {
    const NEXT = { "": "open", open: "hidden", hidden: "" };
    for (const button of root.querySelectorAll("[data-drpg-stash]")) {
        button.addEventListener("click", ev => {
            ev.preventDefault();
            const input = button.parentElement?.querySelector("input[type=hidden]");
            if (!input) return;
            input.value = NEXT[input.value] ?? "open";
            button.innerHTML = stashGlyph(input.value);
        });
    }
}

/*
 * Cycle a place switch: neither -> good -> bad -> neither (E12 C15).
 *
 * A room cannot favour and hinder the same category, and with one switch it
 * cannot be asked to: each state ticks at most one of the cell's two hidden
 * boxes. This replaced a change listener that unticked the other column's box
 * when one was ticked. The boxes are the truth and the button follows them,
 * as in `wireStashCells` above.
 */
function wirePlaceSwitches(root) {
    const NEXT = { "": "good", good: "bad", bad: "" };
    for (const button of root.querySelectorAll("[data-drpg-place]")) {
        button.addEventListener("click", ev => {
            ev.preventDefault();
            const [fav, hin] = button.parentElement?.querySelectorAll("input.drpg-place-box") ?? [];
            if (!fav || !hin) return;
            const state = NEXT[fav.checked ? "good" : hin.checked ? "bad" : ""];
            fav.checked = state === "good";
            hin.checked = state === "bad";
            const { glyph, key } = PLACE_STATES[state];
            button.dataset.drpgPlace = state;
            button.querySelector("i")?.setAttribute("class", glyph);
            button.setAttribute("aria-label", `${button.dataset.drpgLabel}: ${game.i18n.localize(key)}`);
        });
    }
}

// The search-token controls act AT ONCE and recount in place.
//
// They are not part of Apply, for the same reason the Monocub
// manager's "give Hope" button is not: this is a counter the table
// is currently spending, and a GM who nudges it and then cancels the
// rest of the form should not find the nudge undone with it. The
// count is re-read from `SearchTokens` after the write rather than
// guessed from the cell, so a spend that arrived from a player's
// client mid-edit is reflected instead of overwritten.
//
// ONE WRITE A CLICK, ON THE KIT'S STEPPER (E46-C2a, 09.11.2026). The count is a compact kit stepper: its - and + set
// the field one step and send one `change` (ui-kit.mjs `wireStepper`; its `input` is not listened to), so a click is
// one write, as the three buttons of before were. The step is measured from the value the field was drawn or last
// recounted at (`data-drpg-shown`) and added to the count read now, as `now + by` was: a spend a player made while the
// GM clicked is kept, not overwritten. A number typed is a step of its difference, the same rule. Refill writes the
// cap. `SearchTokens` is the window's own, handed in, so R2010 counts the writes on a stand-in.
/** The Facilities tab's edit buttons (E93 C2): each opens its room's editor, and the count in its cell follows the Save. */
export function wireFacilityButtons(root, scene) {
    for (const button of root.querySelectorAll("button[data-drpg-facility-edit]")) {
        button.addEventListener("click", async ev => {
            ev.preventDefault();
            const room = button.dataset.drpgFacilityEdit;
            const { editRoomActions } = await import("./facility-editor.mjs");
            await editRoomActions(scene, room);
            const count = root.querySelector(`[data-drpg-facility-count="${CSS.escape(room)}"]`);
            if (count) count.textContent = String(roomActions(scene, room).length);
        });
    }
}

export function wireTokenButtons(root, scene, recount, { tokens = SearchTokens } = {}) {
    for (const input of root.querySelectorAll("input[data-drpg-token]")) {
        input.dataset.drpgShown ??= input.value;
        input.addEventListener("change", async () => {
            const room = input.dataset.drpgToken;
            const was = Number(input.dataset.drpgShown);
            const typed = Number(input.value);
            if (!Number.isFinite(typed) || !Number.isFinite(was) || typed === was) return;
            input.dataset.drpgShown = String(typed);
            await tokens.setFor(room, tokens.left(room, scene) + (typed - was), scene);
            // The write comes back through `recount` below like anybody
            // else's, so there is no second copy of "what the cell says".
            recount(root);
        });
    }
    for (const button of root.querySelectorAll("button[data-drpg-token-refill]")) {
        button.addEventListener("click", async ev => {
            ev.preventDefault();
            await tokens.setFor(button.dataset.drpgTokenRefill, tokens.max, scene);
            recount(root);
        });
    }
}

/*
 * THE PICTURE'S SIZE, SAID IN ITS CELL (E46-C2a; the owner's 13.10 amend). Pre-season checks say a room picture is over
 * `ROOM_IMAGE_LIMITS` or does not load; the GM who picks one here was told nothing until they ran them. Each picture
 * cell reads its picture once on open and again on every pick (the thumbnail's `src`, which the file picker and Remove
 * the picture set - `wirePortraitPickers` sends no event), through room-tile.mjs `imageFacts`: the HEAD and the decode
 * Pre-season checks make. The line is a warning box in the cell, in Pre-season checks' words for a size; it never holds
 * Apply - the picture is the GM's choice, and a slow one still shows. `facts` is handed in for R2015.
 */
export function pictureWarning(facts) {
    if (!facts) return "";
    if (facts.gone) return game.i18n.localize("DRPG.Vault.imageBroken");
    const sizes = [];
    if (facts.pixels) sizes.push(game.i18n.format("DRPG.Panel.checksImagesPixels", { width: facts.width, height: facts.height }));
    if (facts.heavy) sizes.push(game.i18n.format("DRPG.Panel.checksImagesBytes", { mb: (facts.bytes / 1048576).toFixed(1) }));
    return sizes.length ? game.i18n.format("DRPG.Vault.imageLarge", { size: sizes.join(", ") }) : "";
}

export function wirePictureWarnings(root, { facts = null } = {}) {
    const read = facts ?? (async src => (await import("./room-tile.mjs")).imageFacts(src));
    for (const img of root.querySelectorAll("img[data-drpg-portrait]")) {
        const say = img.closest("td")?.querySelector("[data-drpg-picture-say]");
        if (!say) continue;
        let asked = 0;
        const paint = async () => {
            const src = img.getAttribute("src") ?? "";
            const mine = ++asked;
            if (!src) { say.innerHTML = ""; return; }
            let text = "";
            try { text = pictureWarning(await read(src)); } catch { text = ""; }
            if (mine !== asked) return;
            say.innerHTML = text ? box("warning", `<p>${foundry.utils.escapeHTML(text)}</p>`) : "";
        };
        new MutationObserver(paint).observe(img, { attributes: true, attributeFilter: ["src"] });
        paint();
    }
}

/*
 * DISCOVER ALL / HIDE ALL TICK THE BOXES, AND APPLY DECIDES (ROOM-03).
 *
 * They used to be submit buttons that wrote the ledger and reopened the
 * window, which threw away every unapplied edit on the other six tabs - and
 * they sat in the footer of all of them, so "Hide all" pressed from Bedrooms
 * emptied the fog with no warning. Since ROOM-03 they tick the Fog tab's boxes
 * and Apply or Cancel decides, like every other box in this window.
 *
 * ABOVE THE TABLE, NOT IN THE FOOTER (E12 C15, audit S08-26). They were footer
 * buttons shown on the Fog tab only, and the footer centres its buttons, so
 * switching to Fog moved Apply by about 270 px (the audit's reading) for two
 * buttons that only tick boxes. They sit over the matrix they tick now, and
 * the footer is Apply and Cancel on every tab. Not in DialogV2's `buttons`
 * and with no `data-action`, so the window's own click handling never hears
 * them, and `type="button"`, so the form is not submitted.
 */
function wireFogButtons(root) {
    for (const button of root.querySelectorAll("[data-drpg-fog-all]")) {
        button.addEventListener("click", ev => {
            ev.preventDefault();
            const value = button.dataset.drpgFogAll === "discover";
            for (const box of root.querySelectorAll('input[type="checkbox"][name^="fog:"]')) {
                // The Mastermind's column is shut (E91 C4, `fogMatrixRows`): every room stays known to them.
                if (box.disabled) continue;
                box.checked = value;
            }
        });
    }
}

/*
 * ONE STUDENT, ONE BEDROOM - REFUSED WHILE THE FORM IS STILL HERE (ROOM-02).
 *
 * The check used to run after the window had closed and after the fog had
 * been written, and then gave up on everything else: a GM who moved a
 * student by picking the new room before clearing the old one lost every
 * description, lock and stash typed since opening. Apply now waits, greyed,
 * with the reason on the Bedrooms tab and on the button. `bedroomClaimedTwice`
 * below is the backstop for a form that got past this.
 */
function wireTwoRoomsCheck(root, rooms) {
    const twoRoomsNote = root.querySelector("[data-drpg-two-rooms]");
    const checkBedrooms = () => {
        const seen = new Map();
        let clash = null;
        for (const room of rooms) {
            const owner = root.querySelector(`[name="${CSS.escape(`owner:${room}`)}"]`)?.value;
            if (!owner) continue;
            if (seen.has(owner)) {
                clash = { name: game.actors.get(owner)?.name ?? "?", a: seen.get(owner), b: room };
                break;
            }
            seen.set(owner, room);
        }
        const text = clash ? game.i18n.format("DRPG.Vault.twoRooms", clash) : "";
        setApplyBlock(root, "bedrooms", text || null);
        if (twoRoomsNote) {
            twoRoomsNote.textContent = text;
            const shown = twoRoomsNote.closest("[data-drpg-two-rooms-box]");
            if (shown) shown.hidden = !clash;
        }
    };
    root.addEventListener("change", ev => {
        if (String(ev.target?.name ?? "").startsWith("owner:")) checkBedrooms();
    });
    checkBedrooms();
}

/*
 * TWO REASONS TO HOLD APPLY, ONE BUTTON (E13 C5; the A5 design's step 16). One student in two
 * bedrooms held Apply by writing `disabled` itself, and the Scenes tab holds it while both its
 * selects name one scene: two checks writing the same field would each free the button the other
 * held. So each sets or clears its own reason here, and Apply is free only when none is left; its
 * label is the first reason still standing.
 */
const applyBlocks = new WeakMap();

export function setApplyBlock(root, key, reason) {
    const apply = root?.querySelector?.('footer button[data-action="ok"]');
    if (!apply) return;
    const reasons = applyBlocks.get(apply) ?? new Map();
    applyBlocks.set(apply, reasons);
    if (reason) reasons.set(key, reason);
    else reasons.delete(key);
    const text = reasons.values().next().value ?? null;
    apply.disabled = Boolean(text);
    if (text) {
        apply.setAttribute("data-tooltip", "");
        apply.setAttribute("aria-label", text);
    } else {
        apply.removeAttribute("data-tooltip");
        apply.removeAttribute("aria-label");
    }
}

// One owner, one room. Two bedrooms pointing at the same student would make
// `vaultRoomFor` answer differently depending on region order, which is the
// kind of bug that only shows up mid-session. The form greys Apply while that
// is on screen (`wireTwoRoomsCheck`); this is the backstop, and Apply runs it
// before ANY write so a refusal is never half a save (ROOM-02).
function bedroomClaimedTwice(rowResults) {
    const claimed = new Map();
    for (const row of rowResults) {
        if (!row.owner) continue;
        if (claimed.has(row.owner)) {
            ui.notifications.error(game.i18n.format("DRPG.Vault.twoRooms", {
                name: game.actors.get(row.owner)?.name ?? "?",
                a: claimed.get(row.owner), b: row.room
            }));
            return true;
        }
        claimed.set(row.owner, row.room);
    }
    return false;
}

/**
 * A room's Neighbours as its pieces hold them (`ROOM_FLAGS.neighbours`, E12 C14): every piece's
 * list, each name once, in the order written, joined as the column draws it.
 */
function neighboursWritten(pieces) {
    const names = pieces.flatMap(piece => {
        const value = piece.getFlag(MODULE_ID, ROOM_FLAGS.neighbours);
        return typeof value === "string" ? value.split(",").map(name => name.trim()).filter(Boolean) : [];
    });
    return [...new Set(names)].join(", ");
}

/**
 * A Neighbours cell as Apply writes it (E12 C14): each name typed once, in the order typed, spelt
 * as the window's row of that name when one matches it without regard to case, never the room's
 * own; `neighbours` null when the window drew no cell. A room whose name holds a comma cannot be
 * listed: the list is the flag's comma-separated string, which GMs typed by hand before this
 * column. Which of the names is no room is `applyRoomRows`'s to say (E12 fix r2-H2).
 */
function neighboursTyped(cell, room, rooms) {
    if (!cell) return { neighbours: null };
    const lower = new Map(rooms.map(name => [name.toLowerCase(), name]));
    const listed = [];
    for (const typed of String(cell.value ?? "").split(",").map(name => name.trim()).filter(Boolean)) {
        const name = rooms.includes(typed) ? typed : lower.get(typed.toLowerCase()) ?? typed;
        if (name === room || listed.includes(name)) continue;
        listed.push(name);
    }
    return { neighbours: listed.join(", ") };
}

/**
 * The named regions of a scene by name - Room Setup's own map (E12 C2a): every name, with the
 * pieces of it that can be rooms, marked or not (none for a name only a Teleport or a player's
 * region carries). Not `piecesByName`, which holds rooms only: this window is where a region
 * becomes one. Until E12 fix r1-G1 it held the LAST region of a name, whatever it was, and the
 * window read and compared that one piece (rooms.mjs, "ONE ROOM OF MANY PIECES").
 */
function namedByName(scene) {
    const players = playerRegionIds();
    const map = new Map();
    for (const region of namedRegions(scene)) {
        if (!map.has(region.name)) map.set(region.name, []);
        if (canBeRoom(region, players)) map.get(region.name).push(region);
    }
    return map;
}

/**
 * Write every row that differs from its region. Answers the rooms it changed and whose bedroom moved.
 * Every write lands on every region of the row's name (E12 C2a, `updateRoom`): one write to the
 * piece `regionsByName` held left a Kitchen of two pieces locked on one of them (66 D1).
 */
async function applyRoomRows(rowResults, { REST_FLAGS, setRestRoom, scene }) {
    const changed = new Set();
    // Rooms whose BEDROOM OWNER moved in this Apply. Collected rather than acted
    // on inline because the seeding below has to run after the stash matrix has
    // been written, or it would seed into a list it is about to overwrite.
    const ownerMoved = [];
    // The owner each of them had is `setVaultRoom`'s to read: it takes the old owner's keys (E14 part 1 C2, S08-11; fix e1-G2).
    const named = namedByName(scene);
    /* The rooms of this scene once this Apply is written, for the Neighbours names that are none
       (E12 fix r2-H2, 11.10.2026; early review EARLY-C14-2). The names were checked against the
       window's rows, and a row is any named region that could be a room - so a list naming a Teleport
       or a region nobody marked was taken without a word, though `neighbouringRooms` reads rooms only
       and the name connected nothing. A box ticked or cleared in this same Apply counts. */
    const roomsAfter = new Set(roomNames(scene));
    for (const row of rowResults) {
        if (row.isRoom === true) roomsAfter.add(row.room);
        else if (row.isRoom === false) roomsAfter.delete(row.room);
    }
    for (const row of rowResults) {
        // The pieces that can be rooms, read as one as the cells were (E12 fix r1-G1): a name
        // with none - a Teleport's alone - has nothing a row may write.
        const pieces = named.get(row.room) ?? [];
        if (!pieces.length) continue;

        const before = {
            owner: flagOver(pieces, VAULT_FLAGS.owner),
            table: flagOver(pieces, VAULT_FLAGS.table),
            favours: listOver(pieces, VAULT_FLAGS.favours),
            hinders: listOver(pieces, VAULT_FLAGS.hinders),
            description: flagOver(pieces, VAULT_FLAGS.description) ?? "",
            // As stored, not as `safeRoomImage` reads it: a value it refuses was drawn as no picture, so a row
            // that leaves it so differs and its Apply writes null over it.
            image: flagOver(pieces, VAULT_FLAGS.image) ?? ""
        };
        /* THE PICTURE IS JUDGED BEFORE THE ROW IS COMPARED (E77 C1). A path `safeRoomImage` refuses is not
           written and the GM is told which room; the row's other columns are written as usual. `refused`
           also keeps the picture out of `same`, so a refused path alone writes nothing at all. */
        const picture = row.image ? safeRoomImage(row.image) : "";
        const refused = picture === null;
        if (refused) ui.notifications.warn(game.i18n.format("DRPG.Vault.imageRefused", { room: row.room }));
        const beforeRest = {
            short: Boolean(flagOver(pieces, REST_FLAGS.short)),
            long: Boolean(flagOver(pieces, REST_FLAGS.long))
        };
        const wasLocked = Boolean(flagOver(pieces, ROOM_FLAGS.locked));
        const wasLockedAtStart = pieces.some(startLocked);
        const wasBroken = roomBroken(scene, row.room);
        const wasSealed = Boolean(flagOver(pieces, SEARCH_FLAGS.sealed));
        const wasNotShared = Boolean(flagOver(pieces, VAULT_FLAGS.notShared));
        // Settled when every piece that can be a room already says what the row says (E12 C1);
        // the scene is the pieces' own, so the flag goes where the row was read.
        const roomSettled = row.isRoom === null
            || pieces.every(piece => piece.getFlag(MODULE_ID, ROOM_FLAG) === row.isRoom);
        // Likewise the Neighbours list (E12 C14): every piece holds the list the row says - the
        // pieces `updateRoom` writes, as for the mark (E12 fix r1-G1).
        const neighboursSettled = row.neighbours === null
            || pieces.every(piece => neighboursWritten([piece]) === row.neighbours);

        const same = before.owner === (row.owner || null)
            && before.table === (row.table || null)
            && beforeRest.short === row.shortRest
            && beforeRest.long === row.longRest
            && before.favours.length === row.favours.length
            && before.favours.every(f => row.favours.includes(f))
            && before.hinders.length === row.hinders.length
            && before.hinders.every(h => row.hinders.includes(h))
            && wasLocked === row.locked
            && wasLockedAtStart === row.lockedAtStart
            && wasBroken === row.broken
            && wasSealed === row.noSearch
            && wasNotShared === row.notShared
            && roomSettled
            && neighboursSettled
            && before.description === row.description
            && (refused || before.image === picture);
        if (before.owner !== (row.owner || null) && row.owner) {
            ownerMoved.push({ room: row.room, owner: row.owner });
        }
        if (same) continue;
        // Broken (E74 C5): written on the room's pieces by its one writer, before the rest of the row.
        if (wasBroken !== row.broken) {
            await setRoomBroken(scene, row.room, row.broken);
            // Mended by hand: a Repair the Lock under way on it goes, with a note to the GMs (E74 C5).
            if (!row.broken) await (await import("./doors-gm.mjs")).dropLockRepairs(scene, row.room);
        }

        // "Stash hidden" is the Stashes tab's business (ITEM-02): the column
        // this tab used to carry wrote the LEGACY flag, which the Stashes list
        // then read back and undid in the same Apply.
        await setVaultRoom(row.room, {
            owner: row.owner,
            table: row.table,
            favours: row.favours,
            hinders: row.hinders,
            description: row.description,
            image: refused ? undefined : picture || null,
            scene
        });

        // Through rest.mjs's own writer rather than a second flag path, so the
        // two rest flags keep one owner.
        await setRestRoom(row.room, { short: row.shortRest, long: row.longRest, scene });

        // No announcement either way. A room nobody can search says so on the
        // action tile the moment anybody stands in it and looks - which is a
        // better place to learn it than a chat line scrolling past hours
        // earlier, and it does not tell the whole cast which room the GM has
        // just decided is interesting enough to close.
        if (wasSealed !== row.noSearch) {
            await updateRoom(scene, row.room, { [`flags.${MODULE_ID}.${SEARCH_FLAGS.sealed}`]: row.noSearch });
        }

        // Nothing to announce: this moves a line of advice on two GM screens
        // and no rule at all.
        if (wasNotShared !== row.notShared) {
            await updateRoom(scene, row.room, { [`flags.${MODULE_ID}.${VAULT_FLAGS.notShared}`]: row.notShared });
        }

        // Nothing announced: whether a region is a room is the GM's map, not news. A name that was no room and is one
        // now gives its owner a stash (E89 C7, E89-22): an owner given while it was unmarked was refused one, since
        // `setStash` writes rooms only. Only on that change, so a piece drawn and marked onto a standing room puts
        // back no stash the GM removed (TRAP 76).
        if (!roomSettled) {
            const wasRoom = roomRegions(scene, row.room).length > 0;
            await setRoomFlag(scene, row.room, ROOM_FLAG, row.isRoom);
            if (row.isRoom === true && !wasRoom) await ensureBedroomStash(scene, row.room);
        }

        // Nothing announced: a door on the GM's map is learnt by walking through it. A name that
        // is no room of this scene is kept as typed and the GM told: it connects nothing, and the
        // room it names may be drawn or marked after this Apply.
        if (!neighboursSettled) {
            await updateRoom(scene, row.room, { [`flags.${MODULE_ID}.${ROOM_FLAGS.neighbours}`]:
                row.neighbours || (forcedDeletion() ?? null) });
            const unknown = (row.neighbours ?? "").split(", ").filter(name => name && !roomsAfter.has(name));
            if (unknown.length) {
                ui.notifications.warn(game.i18n.format("DRPG.Vault.neighboursUnknown",
                    { room: row.room, names: unknown.join(", ") }));
            }
        }

        // Written whether or not it changed, because "unset" and "unset but
        // equal to the current lock" are the same thing to `startLocked` and
        // only one of them survives a mid-season change to the lock itself.
        await updateRoom(scene, row.room, { [`flags.${MODULE_ID}.${ROOM_FLAGS.lockedAtStart}`]: row.lockedAtStart });

        // The one writer of a room's lock, and its card when it opens (vault-store.mjs `writeRoomLock`; E91 C4, D038):
        // the Mastermind's own lair is locked through it too, so it is this lock.
        if (wasLocked !== row.locked) await writeRoomLock(scene, row.room, row.locked);

        changed.add(row.room);
    }
    return { changed, ownerMoved };
}

/*
 * THE STASH MATRIX, and the two rules that make it safe.
 *
 * TRAP 77 - A STASH WITH THINGS IN IT IS NOT REMOVED. Taking one away would
 * leave every item in it pointing at a stash that no longer exists, which is
 * an item on no list at all: not carried, not in any drawer, gone from the
 * sheet and findable only by a GM reading flags. So the removal is refused,
 * with the count, and the GM is told whose things and how many. The cell
 * snaps back on the next open because the form is redrawn from the flags.
 */
/*
 * THE CELLS THE GM CHANGED, AND NO OTHER (E89 C7, 30.10.2026; E89-21). Until 1.2.91 this compared the cells as
 * drawn when the window opened with the room as it stood after this Apply's rows were written, so a stash the rows
 * brought into being - a room marked in this Apply whose owner was given before, read as the owner's stash because
 * it held no stored list - was absent from the cells and read as one the GM had removed: `stashes: []` was written
 * and nothing put it back (the tier-2 "a Bedroom set up the usual way ...", red at 55ed2e36 on that road), and a
 * stash another GM wrote while this window was open was removed the same way. Now a cell acts only where the GM
 * left it other than it was drawn (`state` beside `drawn`, `readRoomSetupForm`), against the room as it is now.
 */
async function applyStashMatrix(stashes, scene) {
    const changed = new Set();
    for (const [room, cells] of Object.entries(stashes)) {
        for (const { actorId, state, drawn } of cells) {
            if (state === drawn) continue;
            const now = stashIn(room, actorId, scene);
            if (!state) {
                if (!now) continue;
                const owner = game.actors.get(actorId);
                const held = owner ? stashItemsIn(owner, room, scene).length : 0;
                if (held) {
                    ui.notifications.warn(plural("DRPG.Vault.stashNotEmpty", {
                        name: owner?.name ?? "?", room, n: held
                    }));
                    continue;      // refused: leave it alone
                }
                // Counted only when written (E12 fix r1-G1; review EARLY-C4-1): a cell of a name no
                // room carries - a Teleport's - wrote nothing and was counted a changed room.
                if (await setStash(room, actorId, { present: false, scene })) changed.add(room);
                continue;
            }
            const concealed = state === "hidden";
            if (now && now.concealed === concealed) continue;
            if (await setStash(room, actorId, { concealed, scene })) changed.add(room);
        }
    }
    return changed;
}

/*
 * TRAP 76 - SEEDING RUNS ON AN OWNER CHANGE, NEVER ON EVERY APPLY.
 *
 * Giving somebody a bedroom gives them a stash in it, which is what makes
 * the split invisible to a GM who never opens the new tab. But if it ran
 * every time the form was saved, then removing a stash on the Stashes tab
 * and pressing Apply would put it straight back - a button that unclicks
 * itself, and the GM would have no way to tell it apart from a bug.
 *
 * `?? false` rather than a plain create: `setStash` leaves an existing entry
 * alone when told nothing about concealment, so a GM who already hid the
 * owner's stash keeps it hidden.
 */
async function seedOwnerStashes(ownerMoved, scene) {
    const changed = new Set();
    for (const { room } of ownerMoved) {
        if (await ensureBedroomStash(scene, room)) changed.add(room);
    }
    return changed;
}

export async function openRoomSetupDialog({ tab = null } = {}) {
    // ONE OF THESE, NOT FOUR - see `alreadyOpen` in live.mjs. Two copies of a
    // window each read the world when they opened and neither knows about the
    // other, so the older one goes on looking authoritative while showing
    // something that stopped being true. Raised rather than refused: pressing
    // twice usually means the window is behind something.
    if (alreadyOpen("drpg-window-rooms")) return RAISED;

    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    /*
     * THE SCENE THIS WINDOW WAS OPENED ON, AND NO OTHER (E12 C4, R119; audit S08-16).
     *
     * Read once, here, and handed to every read and every write below, Apply's included. Until
     * 1.2.74 the rows were written to the scene on screen when Apply was pressed (`regionsByName()`
     * read the camera inside them, and since E12 C2a the call below handed it `workingScene()`), and
     * the Stashes tab's cells and the stash a new bedroom owner is given went to `setStash`'s own
     * default, the camera too: a GM who opened this on the dorms, looked at the gym while deciding,
     * and pressed Apply wrote the dorms' table onto the gym's rooms of the same names (scenario 66
     * B1 read the lock on the Annex's Gym before this commit). The title names the scene, so the GM can see which
     * map the table is. Rooms are still listed alphabetically: a GM opens this looking for ONE
     * room by name, and the order regions were drawn in is nobody's mental model of the building.
     */
    // Never the trial hall (E13 C1, R115): nobody stands there and it holds no rooms whatever its
    // regions say (rooms.mjs), so a GM viewing it during a trial is shown the school's table.
    let scene = workingScene();
    if (isTrialScene(scene)) scene = homeScene();
    /* NO ROOM IS NO REFUSAL (E13 C5; the owner's answer Q-E13-1 e, 09.10.2026). This refused a
       scene with no named region, so the GM of a world with no rooms yet could not reach the
       Scenes tab, and over a scene whose only named region was a Teleport (no room) it opened on
       Bedrooms (read in the code, 12.10). It opens on the Scenes tab whenever its scene holds no room
       (`roomSetupTab`), the room tabs empty or listing the regions still to be marked; only
       with no scene at all is there nothing to open. */
    if (!scene) {
        ui.notifications.warn(game.i18n.localize("DRPG.Vault.noRooms"));
        return null;
    }
    const rooms = Array.from(namedByName(scene).keys()).sort((a, b) => a.localeCompare(b));
    const scenesTab = await import("./trial-scene.mjs");
    const passagesTab = await import("./passages-tab.mjs");

    const { studentActors, studentCensus } = await import("./monokuma.mjs");
    const { REST_FLAGS, setRestRoom } = await import("./rest.mjs");
    const { discoveredFor, applyDiscoveryChanges, sceneUncoveredPercent } =
        await import("./fog.mjs");
    const students = studentActors();
    // The living as the checklist counts them (E20 C1, `studentCensus`): `isDeceased` here missed a death the GMs keep.
    const living = studentCensus(students).count;
    // Room pools only. The tier pools (`tableName()`'s family) answer dice
    // rolls and are never a room's stock - see `roomStockTables` in tables-pools.mjs:
    // by their flags since E14 fix e1-G2, so one the GM renamed in the sidebar
    // is not offered here as "Kitchen knives".
    const tables = roomStockTables();
    /*
     * WHAT A ROOM CAN BE GOOD OR BAD FOR (audit A24).
     *
     * Truth Bullets are not searched for, and neither are bedroom keys - a key
     * is granted with a room on it, never drawn from a pool - so neither is a
     * category a room can stock or favour. The key was on offer here because
     * this list was `ITEM_CATEGORIES` minus Truth Bullets alone; ticking it
     * bought nothing, because no Search ever asks for that category.
     *
     * `splitUsables: false` on purpose, and it is the one place that asks for
     * it: a Search hands `favoursCategory` the CATEGORY it is drawing on, and
     * both usable kinds draw on `usable`. Splitting the column would offer a
     * distinction the lookup cannot honour.
     */
    const categories = pickableCategories({ splitUsables: false })
        .map(c => [c.key, ITEM_CATEGORIES[c.key]]);
    const regions = namedByName(scene);

    const uncovered = sceneUncoveredPercent(scene);
    const maxTokens = SearchTokens.max;

    const known = new Map(students.map(a => [a.id, new Set(discoveredFor(scene?.id, a.id))]));
    const { mastermindActor } = await import("./mastermind.mjs");
    const fogRows = fogMatrixRows(rooms, students, known, mastermindActor()?.id ?? null);
    const stashRows = stashMatrixRows(rooms, students, scene);
    const cells = roomCells(rooms, { students, tables, categories, regions, scene, maxTokens, REST_FLAGS });

    const initial = roomSetupTab(tab, sceneHoldsRooms(scene));

    const result = await drpgWindow({
        title: game.i18n.format("DRPG.Vault.manageTitleOn", { scene: scene?.name ?? "" }),
        // `drpg-projects` as well as `drpg-panel`: that is the class the
        // stylesheet hangs the table treatment on - full width, a scrolling
        // window-content and sane select sizing. Without it this dialog asked
        // for 860px, lost to the 26rem `.drpg-panel` cap, and clipped its own
        // right-hand columns with no way to scroll to them.
        classes: ["drpg-panel", "drpg-projects", "drpg-room-setup", "drpg-window-rooms"],
        // One width for all nine tabs, taken from the biggest of them - see the
        // kit's `fitKitWidth`. Without it the window is fitted to whichever tab
        // is showing and jumps between 708px and 1504px as the GM switches.
        fit: true,
        body: roomSetupContent({ initial, cells, students, stashRows, fogRows, uncovered, maxTokens,
            scenesPanel: scenesTab.scenesTabHtml(), passagesPanel: passagesTab.passagesTabHtml(scene, { students }) }).innerHTML,
        footer: {
            primary: {
                action: "ok", label: game.i18n.localize("DRPG.Panel.apply"),
                callback: (e, b, d) => ({ ...readRoomSetupForm(d, { rooms, students, categories }),
                    scenes: scenesTab.readScenesTab(d.element) })
            },
            close: { role: "cancel", action: "cancel" }
        },
        render: (event, dialog) => {
            wireRoomRatio(dialog, rooms, living);
            const root = dialog.element;

            // Deliberately no REFIT of the width on a switch. The window was measured
            // for the biggest tab when it opened and keeps that width for all of
            // them: switching tabs is a comparison, and a window that resizes
            // under a comparison is the thing being complained about. A press puts
            // the window back on the screen (`app`, E21 C1b); the footer stands
            // outside the kit's body that scrolls, so nothing pins it across a
            // sideways scroll any more (C-F5-8's `pinFooterAcrossScroll`, retired by
            // E21 C2a). The footer's buttons are Apply and Cancel on every tab (E12 C15).
            wireFogButtons(root);
            wireKitTabs(root, { win: root, app: dialog });
            wireTwoRoomsCheck(root, rooms);
            scenesTab.wireScenesTab(root, reason => setApplyBlock(root, "scenes", reason));
            passagesTab.wirePassagesTab(root, scene, { dialog, students });

            const recount = where => recountTokenCells(where, scene);

            wireStashCells(root);
            wirePlaceSwitches(root);
            wireTokenButtons(root, scene, recount);
            wireFacilityButtons(root, scene);

            // The picture column (E77 C1): the file picker on each thumbnail, its field named `img:<room>`
            // as the description's is `desc:<room>`, and the button that empties the cell it stands in.
            wirePortraitPickers(root, { prefix: "img:" });
            wirePictureWarnings(root);
            for (const button of root.querySelectorAll("[data-drpg-picture-clear]")) {
                button.addEventListener("click", () => {
                    const cell = button.closest("td");
                    const field = cell?.querySelector('input[type="hidden"]');
                    if (field) field.value = "";
                    cell?.querySelector("[data-drpg-portrait]")?.removeAttribute("src");
                });
            }

            /* AND THE COUNTS FOLLOW THE TABLE THAT IS SPENDING THEM.

               Every Search a player makes writes this number, and this window is open
               during Daily Life precisely because a GM is watching them do it. Measured
               on 11.09: with Room Setup open, a room went from 1 token to 0 and the cell
               went on reading 1.

               `keepFresh` rather than `keepLive`: the count sits in a row that also
               carries the sealed checkbox and the item-table select, and those are saved
               on Apply. Swapping the region out would throw away whatever the GM has
               ticked and not yet applied, and take the three buttons above with it. So
               the numbers are written in place and nothing else is touched.

               Scoped to the search-token setting: a window this size has no business
               redrawing because somebody rolled a die. */
            keepFresh(dialog, {
                run: recount,
                watch: { settings: [SETTINGS.searchTokens] }
            });
        },
        rejectClose: false
    });

    if (!result || typeof result !== "object") return null;

    const rowResults = result.rooms;
    if (!Array.isArray(rowResults)) return null;

    if (bedroomClaimedTwice(rowResults)) return null;
    // The Scenes tab's backstop, as `bedroomClaimedTwice` is the Bedrooms tab's: nothing is written.
    if (scenesTab.scenesClash(result.scenes)) {
        ui.notifications.warn(game.i18n.localize("DRPG.TrialScene.sameScene"));
        return null;
    }
    // And its second: the trial hall is not linked, relinked or unlinked while a Class Trial runs (E13 fix r1-F2;
    // the reason for a first hall since r2-H2).
    const hallLock = scenesTab.hallLockReason(result.scenes);
    if (hallLock) {
        ui.notifications.warn(game.i18n.localize(hallLock));
        return null;
    }

    await applyDiscoveryChanges(scene, result.fogChanges ?? []);

    /* ROOMS CHANGED, NOT WRITES MADE (E12 C4, audit S08-16). The count added one per row written,
       one per stash cell and one per stash a new owner was given: one room locked, given a stash and
       given to an owner in one Apply counted 3 (the tier-2 "Room Setup writes to the scene it was
       opened on ...", before this commit, 11.10.2026). It is now the rooms any of the three touched. */
    const { changed: rowsChanged, ownerMoved } = await applyRoomRows(rowResults,
        { REST_FLAGS, setRestRoom, scene });
    const changed = new Set(rowsChanged);

    if (result.stashes && typeof result.stashes === "object") {
        for (const room of await applyStashMatrix(result.stashes, scene)) changed.add(room);
    }

    for (const room of await seedOwnerStashes(ownerMoved, scene)) changed.add(room);

    // AFTER the loop, and outside it: keys are issued by sweeping every owned
    // room, not by noticing an owner change. See `reconcileBedroomKeys` for why
    // - in short, a row the GM did not touch is skipped above, and rooms
    // assigned before keys existed are all of those. Not silent: a key arriving
    // on your sheet is news, and the sweep only writes when one was missing.
    await reconcileBedroomKeys({ silent: false });

    await scenesTab.applyScenesTab(result.scenes);

    ui.notifications.info(plural("DRPG.Vault.appliedOn", { count: changed.size, scene: scene?.name ?? "" }, "count"));
    return changed.size;
}
