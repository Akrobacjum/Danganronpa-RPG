/**
 * Danganronpa RPG - the Passages tab of Room Setup (E79 C5, 1.2.79).
 * ---------------------------------------------------------------------------
 * The GMs' table of the secret passages on the scene Room Setup was opened on, after the Doors
 * tab (room-setup.mjs `ROOM_SETUP_TABS`), drawn as the D31 mockup drew it (the E79 plan's 2.4): a row
 * per passage - its rooms; who knows it, a chip per student with the way they learnt it, a cross
 * that revokes it and '+' that gives it to another (two clicks); who knows it from the season's
 * start; its state (secret, closed, or broken when its wall moved, with the students no player of
 * theirs has been sent it yet and the players who share a student); and Show, Close or Open, and
 * Delete. Every button writes at once through passages-gm.mjs, as `game.drpg.passages` does, and
 * nothing waits for Apply: the window's Apply and Cancel read none of this tab.
 *
 * The cross asks first only when the student stands in one of the passage's rooms on its scene -
 * the rooms on the map either side of its stretch (passages-gm.mjs `passageRoomsOnMap`), not the
 * names the row shows: 'Revoke now' or 'Revoke when they leave the room' (`revokeWhenLeaving`); a
 * student anywhere else forgets it at once. On a public passage the cross always asks, and says what a revoke
 * does there: nothing until Make secret, then whether the student still knows it (E80 fix r1-G8). The Mastermind knows every passage (the owner's Q7)
 * and is listed nowhere here.
 *
 * Nothing here names a passage's wall or stretch (R560: the records' files alone do); Show asks
 * passages-gm.mjs for the stretch's middle. The table is redrawn whole after each button and when
 * the records change on another GM's browser (`keepFresh` on the three stores) or a player is sent
 * their copy (`drpgPassagesTold`, which the "not yet delivered" line reads), so the tab holds
 * no field of its own to lose. 'New passage' over the table, and 'Pick again' on a broken row,
 * start the pick on the board (passages-gm.mjs `startPassagePick`, E79 C6): Room Setup is minimized
 * for the two clicks and the table redrawn after them. E44 and E46 take the tab's table with the
 * other Room Setup tables when they rebuild them.
 *
 * 'Tunnel or stairs' beside it (E80 C1) starts the same pick for a tunnel's two ends, a click in each
 * room (`startPassagePick` with `shape` "tunnel"); its row is a row as any passage's, named by the two
 * rooms its ends stand in.
 *
 * Since E80 C6 (18.10.2026; D4) the columns are Rooms, Kind (secret or public), Shape (in a wall, or a tunnel or
 * stairs), Origin (the GM's, or a converted secret door), then who knows it, the start, the state and the buttons,
 * where 'Make public' and 'Make secret' stand beside Close (passages-gm.mjs `makePassagePublic`, `makePassageSecret`).
 * A public passage's chips stay the students who knew it before, whom Make secret leaves knowing it.
 *
 * Since H81 (20.10.2026; the owner's calls C and E of 20.10) a tunnel's Shape holds which way it goes - both ways, or
 * from one of its rooms to the other (`wayPicker`, passages-gm.mjs `setPassageWay`) - and 'At season start' carries a
 * line, and the footnote a sentence, saying it gives the passage at the next season's reset and nothing now.
 */

import { error } from "./utils.mjs";
import { drpgWindow, drpgConfirm, dataTable, chip as kitChip, chips } from "./ui-kit.mjs";
import { keepFresh } from "./live.mjs";
import {
    PASSAGE_STORES, listPassages, grantPassage, revokePassage, revokeWhenLeaving, setStartAccess, setPassageWay,
    closePassage, openPassage, deletePassage, isMastermindActor, undeliveredOf, passageMiddle, startPassagePick, passageRoomsOnMap,
    makePassagePublic, makePassageSecret, restoreBreach, whyText
} from "./passages-gm.mjs";
import { viewPassage, oneWayOf } from "./passages.mjs";

import { tipAttr, tipText } from "./ui-kit.mjs";

const esc = text => foundry.utils.escapeHTML(String(text ?? ""));
const t = key => game.i18n.localize(key);
const tf = (key, data) => game.i18n.format(key, data);
const HOW = { gm: "DRPG.Passage.tab.howGm", start: "DRPG.Passage.tab.howStart", shown: "DRPG.Passage.tab.howShown", found: "DRPG.Passage.tab.howFound",
    // A Secret Passage's (E15 part 2 C2): its builder, and whoever the secret project was shared with before it was finished.
    built: "DRPG.Passage.tab.howBuilt", shared: "DRPG.Passage.tab.howShared" };

/** A passage's rooms as the tab and its windows name it: "Kitchen - Dining Hall", or that none is named. */
function passageTitle(passage) {
    const rooms = (passage?.rooms ?? []).filter(r => typeof r === "string" && r);
    return rooms.length ? rooms.join(" - ") : t("DRPG.Passage.tab.noRooms");
}

/** A student's name for the table, or the tab's word for a character this world no longer holds. */
function nameOf(actorId, actors) {
    return actors?.get?.(actorId)?.name ?? t("DRPG.Passage.tab.unknown");
}

/**
 * One chip of a column (E46-C2b, 09.11.2026; the owner's A10 of 11.10: "the kit's access chips"): the kit's `chip`, pressed -
 * the student has it - and its press is what the cross did before (`act`: revoke, or start-off), asked as before. `how` is
 * the way the student learnt it (Who knows only), in the chip's `<b>`, and `leave` the room it closes on leaving. Until
 * C2b a `span.drpg-room-chip` held the name and a cross button of its own; a kit chip is a button, which holds no other,
 * so the chip is the cross now and the "x" a mark inside it (`aria-hidden`: its name says it). The module's class and
 * attributes are the kit chip's `cls` and `attrs` since E47-KFa (written in after `class="drpg-chip"` before it); the
 * leaving note and the mark are still put inside the drawn button, the chip's markup taking only its label and count;
 * the readers' selectors (`.drpg-passage-chip[data-drpg-actor]`, `[data-drpg-passage-act][data-drpg-actor]`,
 * `[data-drpg-passage-leave]` inside the chip) hold.
 */
function chip(actorId, { actors, act, how = null, leave = null, cross, tip = "" }) {
    const name = nameOf(actorId, actors);
    const until = leave ? ` <b data-drpg-passage-leave>${esc(tf("DRPG.Passage.tab.leaving", { room: leave }))}</b>` : "";
    const attrs = { "data-how": how, "data-drpg-passage-act": act, "data-drpg-actor": actorId, "aria-label": `${cross}: ${name}`, ...(tip ? { "data-tooltip": tip } : { title: cross }) };
    return kitChip({ label: name, pressed: true, count: how ? t(HOW[how] ?? HOW.gm) : null, cls: "drpg-passage-chip", attrs })
        .replace(/<\/button>$/, `${until}<span class="drpg-passage-chip-mark" aria-hidden="true">x</span></button>`);
}

/** A cell's chips and its '+': the kit's `chips` toolbar, named by its column, with the module's markup inside it. */
function chipCell(column, inner) {
    return chips([], { label: t(`DRPG.Passage.tab.${column}`) }).replace(/<\/div>$/, `${inner}</div>`);
}

/** '+' and the students it offers, hidden until it is pressed: the second click is the student's name. */
function adder(menu, act, offer, label) {
    if (!offer.length) return "";
    return `<button type="button" class="drpg-mini-button drpg-passage-add" data-drpg-passage-act="menu" data-drpg-menu="${menu}"
        aria-label="${esc(label)}" title="${esc(label)}" aria-expanded="false">+</button><span class="drpg-passage-menu" data-drpg-menu-of="${menu}" hidden>${
        offer.map(a => `<button type="button" class="drpg-mini-button" data-drpg-passage-act="${act}" data-drpg-actor="${esc(a.id)}"${act === "grant" ? tipAttr("DRPG.Tips.Setup.aStudentSNameTooltip") : tipAttr("DRPG.Tips.Setup.aStudentSNameStartTooltip")}>${
            esc(a.name)}</button>`).join("")}</span>`;
}

/**
 * Which way a tunnel or stairs goes, under its Shape (H81-02, 20.10.2026; the owner's call of 20.10): 'Both ways', or
 * only from one end's room to the other's, each room as the row names it (`rooms`, in the order of the ends). Its change
 * writes through passages-gm.mjs `setPassageWay`, as every button here writes at once. None for a passage in a wall.
 */
function wayPicker(passage) {
    if (passage.shape !== "tunnel" || !Array.isArray(passage.ends)) return "";
    const rooms = [0, 1].map(i => (typeof passage.rooms?.[i] === "string" && passage.rooms[i] ? passage.rooms[i] : t("DRPG.Passage.tab.noRooms")));
    const now = String(oneWayOf(passage) ?? "both");
    const option = (value, label) => `<option value="${value}"${now === value ? " selected" : ""}>${esc(label)}</option>`;
    return `<select class="drpg-passage-way" data-drpg-passage-way aria-label="${esc(t("DRPG.Passage.tab.way"))}" title="${esc(t("DRPG.Passage.tab.way"))}">${
        option("both", t("DRPG.Passage.tab.wayBoth"))}${option("0", tf("DRPG.Passage.tab.wayOnly", { from: rooms[0], to: rooms[1] }))}${
        option("1", tf("DRPG.Passage.tab.wayOnly", { from: rooms[1], to: rooms[0] }))}</select>`;
}

/** The players (no GM) who own a student - every one of them is sent the passages it knows (the plan's K12). */
function playersOf(actor, users) {
    return [...(users ?? [])].filter(u => u && !u.isGM && actor?.testUserPermission?.(u, "OWNER"));
}

function rowHtml(passage, { stores, students, actors, users, told }) {
    const mm = actorId => isMastermindActor(actorId, { mastermind: stores.mastermind });
    const knows = Object.entries(passage.access ?? {}).filter(([actorId]) => !mm(actorId))
        .sort(([a], [b]) => nameOf(a, actors).localeCompare(nameOf(b, actors)));
    const start = (passage.startAccess ?? []).filter(actorId => !mm(actorId));
    const offer = list => students.filter(a => !list.includes(a.id) && !mm(a.id));
    const none = `<span class="drpg-passage-none">${esc(t("DRPG.Passage.tab.none"))}</span>`;

    const knowsCell = `${knows.length ? knows.map(([actorId, cell]) => chip(actorId, { actors, act: "revoke", how: cell?.how ?? "gm",
        leave: typeof cell?.leave === "string" ? cell.leave : null, cross: t("DRPG.Passage.tab.revoke"), tip: tipText("DRPG.Tips.Setup.aStudentWhoKnowsTooltip") })).join("") : none}${
        adder("grant", "grant", offer(knows.map(([actorId]) => actorId)), t("DRPG.Passage.tab.grant"))}`;
    const startCell = `${start.length ? start.map(actorId => chip(actorId, { actors, act: "start-off", cross: t("DRPG.Passage.tab.startRemove"), tip: tipText("DRPG.Tips.Setup.aStudentKnownAtTooltip") })).join("") : none}${
        adder("start", "start-on", offer(start), t("DRPG.Passage.tab.startAdd"))}`;

    const state = ["secret", "closed", "broken"].includes(passage.state) ? passage.state : "secret";
    const notes = [];
    const pending = (undeliveredOf(passage.id, { stores, actors, users, ...(told ? { told } : {}) }) ?? []).filter(actorId => !mm(actorId));
    if (pending.length) {
        notes.push(`<span class="drpg-passage-state" data-state="pending">${esc(tf("DRPG.Passage.tab.pending", { names: pending.map(a => nameOf(a, actors)).join(", ") }))}</span>`);
    }
    for (const [actorId] of knows) {
        const players = playersOf(actors?.get?.(actorId), users);
        if (players.length > 1) {
            notes.push(`<span class="drpg-passage-state" data-state="shared">${esc(tf("DRPG.Passage.tab.shared",
                { student: nameOf(actorId, actors), players: players.map(u => u.name).join(", ") }))}</span>`);
        }
    }
    const stateWord = { secret: "DRPG.Passage.tab.stateSecret", closed: "DRPG.Passage.tab.stateClosed", broken: "DRPG.Passage.tab.stateBroken" }[state];
    const toggle = state === "closed" ? "open" : "close";
    // A breach (E15 part 2 C3) is a hole in the world's wall: its row is public, and its one button gives the wall back.
    const breach = Boolean(passage.breach?.breachId);
    const kind = breach ? "breach" : passage.public === true ? "public" : "secret";
    const shape = passage.shape === "tunnel" ? "shapeTunnel" : "shapeWall";
    const origin = passage.origin === "door" ? "originDoor" : passage.origin?.by === "project" ? "originProject" : "originGm";
    const reveal = kind === "public" ? "secret" : "public";
    /* THE SAME FIVE BUTTONS IN THE SAME FIVE PLACES IN EVERY STATE (E49 A5, 11.11.2026; the rule of 10.11: no state adds,
       removes or shifts a control). Show, Pick again, Close or Open, Make public or Make secret, Delete: until A5 Pick again
       was drawn on a broken passage alone, between Show and Close, so a moved wall moved the row's buttons. Now it stands
       on every row, held with its reason where the wall did not move, and Close is held on a broken passage with its own;
       a label's change (Close, Open) keeps its place, the cell being a grid of two columns (danganronpa.css, Q5: the
       buttons inside their cell, wrapping their words). A breach is a kind, not a state: its row is Show and Close the
       breach, as before. */
    const broken = state === "broken";

    return { id: passage.id,
        rooms: esc(passageTitle(passage)),
        kind: `<span class="drpg-passage-kind" data-kind="${kind}">${esc(t({ breach: "DRPG.Passage.tab.kindBreach", public: "DRPG.Passage.tab.kindPublic" }[kind] ?? "DRPG.Passage.tab.kindSecret"))}</span>`,
        shape: `${esc(t(`DRPG.Passage.tab.${shape}`))}${wayPicker(passage)}`,
        origin: esc(t(`DRPG.Passage.tab.${origin}`)),
        knows: chipCell("knows", knowsCell),
        start: chipCell("start", startCell),
        state: `<span class="drpg-passage-state" data-state="${state}">${esc(t(stateWord))}</span>${notes.join("")}`,
        actions: `<span class="drpg-passage-actions" role="group">${breach
            ? `${button("show", "DRPG.Passage.tab.show")}${button("closeBreach", "DRPG.Passage.tab.closeBreach")}`
            : `${button("show", "DRPG.Passage.tab.show")}${button("repick", "DRPG.Passage.pick.repick", { held: !broken && "DRPG.Passage.tab.repickHeld" })}${
                button(toggle, toggle === "open" ? "DRPG.Passage.tab.open" : "DRPG.Passage.tab.close", { held: broken && "DRPG.Passage.tab.toggleHeld" })}${
                button(reveal, reveal === "public" ? "DRPG.Passage.tab.makePublic" : "DRPG.Passage.tab.makeSecret")}${button("delete", "DRPG.Passage.tab.delete")}`}</span>` };
}

/**
 * One button of a row's actions (E49 A5): `act` its `data-drpg-passage-act`, `key` its words; `held` the key of the reason it
 * cannot be pressed in this state - disabled, the reason as its tooltip - or nothing.
 */
function button(act, key, { held = null } = {}) {
    const why = held ? ` disabled data-tooltip="${esc(t(held))}" aria-description="${esc(t(held))}"` : "";
    return `<button type="button" class="drpg-mini-button" data-drpg-passage-act="${act}"${why}>${esc(t(key))}</button>`;
}

/**
 * The table's columns in the owner's A10 order (11.10: Rooms, Kind, Shape, Origin, Who knows, At season start, the
 * state, the actions), each `cls` the kind components.css's section "Room setup" gives its width
 * (`drpg-data-col-<kind>`; R606 sums them); the Rooms column is the room tabs' (`room`). The actions' head has no words.
 */
export const PASSAGE_COLUMNS = Object.freeze([
    ["rooms", "room"], ["kind", "kind"], ["shape", "shape"], ["origin", "origin"], ["knows", "knows"], ["start", "knows-start"],
    ["state", "state"], ["actions", "actions"]
].map(([key, cls]) => Object.freeze({ key, cls, label: key === "actions" ? "" : `DRPG.Passage.tab.${key}`, act: key === "actions" })));

/**
 * The tab's table and its notes for one scene, from the GMs' records: the inside of the
 * `[data-drpg-passages]` box `passagesTabHtml` draws, and what the box is redrawn with. A scene with no
 * passage draws no table, only the line that says so.
 */
export function passagesTabBody(scene, { stores = PASSAGE_STORES, students = [], actors = game.actors, users = game.users, told } = {}) {
    if (!game.user?.isGM) return "";
    const passages = listPassages({ stores }).filter(p => p.sceneId === scene?.id)
        .sort((a, b) => passageTitle(a).localeCompare(passageTitle(b)) || a.id.localeCompare(b.id));
    /* The kit's table (E46-C2b): its `rowAttrs` the row's passage, read by every button's handler. At season start's head
       keeps its hint in `title` as the hand table had it: the column's `title` since E47-KFa (written in after the
       column's class before it). */
    const table = passages.length ? dataTable({
        columns: PASSAGE_COLUMNS.map(c => ({ key: c.key, cls: c.cls, act: c.act, label: c.label ? t(c.label) : "",
            title: c.cls === "knows-start" ? t("DRPG.Passage.tab.startHint") : null })),
        rows: passages.map(p => rowHtml(p, { stores, students, actors, users, told })),
        rowAttrs: row => ({ "data-drpg-passage": row.id })
    })
        : `<p class="drpg-passage-none" data-drpg-passage-empty>${esc(t("DRPG.Passage.tab.empty"))}</p>`;
    // What "At season start" does (H81-05) and which way a passage goes (H81-02), after the rest of the footnote.
    return `${table}<p class="notes">${esc(t("DRPG.Passage.tab.footnote"))} ${esc(t("DRPG.Passage.tab.startHint"))} ${esc(t("DRPG.Passage.tab.wayHint"))}</p>`;
}

/** The Passages panel's inside, for Room Setup (room-setup.mjs `roomSetupContent`): nothing on a player's browser. */
export function passagesTabHtml(scene, options = {}) {
    if (!game.user?.isGM) return "";
    return `<p>${esc(t("DRPG.Passage.tab.introLine"))}</p><div class="drpg-passage-bar"><button type="button" class="drpg-mini-button"
        data-drpg-passage-new>${esc(t("DRPG.Passage.pick.new"))}</button><button type="button" class="drpg-mini-button"
        data-drpg-passage-tunnel>${esc(t("DRPG.Passage.pick.tunnel"))}</button><span class="notes">${esc(t("DRPG.Passage.pick.newHint"))} ${
        esc(t("DRPG.Passage.pick.tunnelHint"))}</span></div>
        <div data-drpg-passages>${passagesTabBody(scene, options)}</div>`;
}

/* ------------------------------------------------------------------------------------------- *
 * What the buttons ask, each replaceable by the suite (R561) and by scenario 76's real windows.
 * ------------------------------------------------------------------------------------------- */

/**
 * What the cross asks the GM, `{ ask, note, buttons }` (each button `[action, label]`). A secret passage: when it
 * closes to the student, now or when they leave `room`. A public one (`isPublic`, E80 fix r1-G8, the review's
 * E80-C6-3): every student knows it until Make secret, so the revoke closes nothing now and the question says so -
 * only whether `name` still knows it then, with no room question. Pure (R615).
 */
export function revokeQuestion({ name, room = null, isPublic = false }) {
    const cancel = ["cancel", game.i18n.localize("DRPG.Advance.cancel")];
    if (isPublic) return { ask: tf("DRPG.Passage.tab.revokePublicAsk", { name }), note: t("DRPG.Passage.tab.revokePublicNote"),
        buttons: [["now", t("DRPG.Passage.tab.revoke")], cancel] };
    return { ask: tf("DRPG.Passage.tab.revokeAsk", { name, room }), note: tf("DRPG.Passage.tab.revokeNote", { room }),
        buttons: [["now", t("DRPG.Passage.tab.revokeNow")], ["leave", t("DRPG.Passage.tab.revokeLeave")], cancel] };
}

/**
 * 'Revoke now' ("now"), 'Revoke when they leave the room' ("leave", a secret passage's only) or neither (null). A
 * revoke is what cannot be undone (E22, the slice's C2b): both answers destructive, never the default; Cancel is
 * (`revokeQuestion`'s last button, the role's word since E21 C2b).
 */
async function askRevoke({ name, room, title, isPublic = false }) {
    const question = revokeQuestion({ name, room, isPublic });
    const answer = await drpgWindow({
        title: tf("DRPG.Passage.tab.revokeTitle", { passage: title }),
        classes: ["drpg-panel", "drpg-window-revoke-passage"],
        body: `<p>${esc(question.ask)}</p><p class="notes">${esc(question.note)}</p>`,
        footer: {
            destructive: question.buttons.filter(([action]) => action !== "cancel").map(([action, label]) => ({ action, label })),
            close: { role: "cancel", action: "cancel" },
            default: "cancel"
        },
        rejectClose: false
    });
    return question.buttons.some(([action]) => action === answer && action !== "cancel") ? answer : null;
}

/** Delete a passage: what cannot be undone, the kit's destructive question (E21 C2b), Cancel the default. */
async function confirmDelete({ title }) {
    return Boolean(await drpgConfirm({
        yes: { role: "destructive", label: t("DRPG.Passage.tab.deleteTitle") },
        title: t("DRPG.Passage.tab.deleteTitle"),
        classes: ["drpg-panel", "drpg-window-delete-passage"],
        body: `<p>${esc(tf("DRPG.Passage.tab.deleteAsk", { passage: title }))}</p>`,
        rejectClose: false
    }));
}

/** The room the student's token stands in on the passage's scene, or null (no token there, or in no room); movement.mjs `locateActor` finds the token, as every other walk of the scenes does (R114). */
async function studentRoomOn(actorId, sceneId) {
    const { locateActor } = await import("./movement.mjs");
    const place = locateActor(game.actors?.get(actorId), { sceneId });
    return place?.scene?.id === sceneId ? place.room : null;
}

/**
 * The GM's camera to the passage, on its scene and floor (passages.mjs `viewPassage`, E80 fix r1-G2): a
 * tunnel's end on the floor on screen when it has one there, else its first end, that end's floor viewed.
 */
async function showPassage(passageId) {
    return viewPassage(level => passageMiddle(passageId, { level }));
}

/**
 * Wire the tab inside Room Setup's element `root`, for `scene`. Each button's work runs after the
 * one before it (a second click waits, so two writes never interleave) and redraws the box; 'New
 * passage' and 'Pick again' wait for the pick (`pick`, the suite's to replace). With
 * `dialog`, the box follows the records while the window is open. `actors`, `users` and `told` are
 * the suite's, for the body (R561). Answers `{ draw, settled }`: `settled()` is the promise of the
 * last button's work, which the suite and scenario 76 wait on.
 */
export function wirePassagesTab(root, scene, { dialog = null, stores = PASSAGE_STORES, students = [], ask = askRevoke,
    confirm = confirmDelete, roomOf = studentRoomOn, show = showPassage, pick = startPassagePick, actors, users, told } = {}) {
    const box = root?.querySelector?.("[data-drpg-passages]");
    if (!box || !game.user?.isGM) return null;
    const draw = () => { box.innerHTML = passagesTabBody(scene, { stores, students, actors, users, told }); };
    let busy = Promise.resolve();

    const work = async (act, passageId, actorId) => {
        const passage = listPassages({ stores }).find(p => p.id === passageId);
        if (!passage) return;
        const title = passageTitle(passage);
        switch (act) {
            case "grant": return grantPassage(passageId, actorId, { stores });
            case "start-on": return setStartAccess(passageId, actorId, true, { stores });
            case "start-off": return setStartAccess(passageId, actorId, false, { stores });
            case "way": return setPassageWay(passageId, actorId === "0" ? 0 : actorId === "1" ? 1 : null, { stores });
            case "close": return closePassage(passageId, { stores });
            case "open": return openPassage(passageId, { stores });
            case "public": return makePassagePublic(passageId, { stores });
            case "secret": return makePassageSecret(passageId, { stores });
            case "closeBreach": {
                const done = passage.breach?.breachId ? await restoreBreach(passage.sceneId, passage.breach.breachId, { stores }) : null;
                if (done?.refused) ui.notifications?.warn?.(game.i18n.format("DRPG.Passage.tab.closeBreachRefused", { why: whyText(done.refused) }));
                return Boolean(done?.closed);
            }
            case "show": return show(passageId);
            case "repick": return pick(scene, { dialog, passageId, stores });
            case "delete": return (await confirm({ title })) ? deletePassage(passageId, { stores }) : false;
            case "revoke": {
                const cell = passage.access?.[actorId];
                if (!cell) return false;
                // A public passage: the revoke closes nothing until Make secret, and the GM is told so (E80-C6-3).
                if (passage.public === true) {
                    const choice = await ask({ name: nameOf(actorId, game.actors), room: null, title, isPublic: true });
                    return choice === "now" ? revokePassage(passageId, actorId, { stores }) : false;
                }
                const room = typeof cell.leave === "string" ? null : await roomOf(actorId, passage.sceneId);
                if (!room || !(await passageRoomsOnMap(passageId, { stores, scene })).includes(room)) return revokePassage(passageId, actorId, { stores });
                const choice = await ask({ name: nameOf(actorId, game.actors), room, title });
                if (choice === "now") return revokePassage(passageId, actorId, { stores });
                if (choice === "leave") return revokeWhenLeaving(passageId, actorId, room, { stores });
                return false;
            }
            default: return false;
        }
    };

    // Which way a tunnel goes (H81-02): its select's value in the place of a student, through the same queue as a button.
    box.addEventListener("change", event => {
        const select = event.target?.closest?.("[data-drpg-passage-way]");
        if (!select || !box.contains(select)) return;
        const passageId = select.closest("[data-drpg-passage]")?.dataset.drpgPassage;
        busy = busy.then(() => work("way", passageId, select.value))
            .catch(err => error("The way of a tunnel could not be set", err))
            .then(draw);
    });
    box.addEventListener("click", event => {
        const button = event.target?.closest?.("[data-drpg-passage-act]");
        if (!button || !box.contains(button) || button.disabled) return;
        event.preventDefault();
        const act = button.dataset.drpgPassageAct;
        if (act === "menu") {
            const menu = button.parentElement?.querySelector(`[data-drpg-menu-of="${button.dataset.drpgMenu}"]`);
            if (menu) menu.hidden = !menu.hidden;
            button.setAttribute("aria-expanded", String(Boolean(menu && !menu.hidden)));
            return;
        }
        const passageId = button.closest("[data-drpg-passage]")?.dataset.drpgPassage;
        const actorId = button.dataset.drpgActor ?? null;
        busy = busy.then(() => work(act, passageId, actorId))
            .catch(err => error("A button of the Passages tab failed", err))
            .then(draw);
    });
    root.querySelector("[data-drpg-passage-new]")?.addEventListener("click", event => {
        event.preventDefault();
        busy = busy.then(() => pick(scene, { dialog, stores }))
            .catch(err => error("The pick of a new secret passage failed", err))
            .then(draw);
    });
    root.querySelector("[data-drpg-passage-tunnel]")?.addEventListener("click", event => {
        event.preventDefault();
        busy = busy.then(() => pick(scene, { dialog, stores, shape: "tunnel" }))
            .catch(err => error("The pick of a new tunnel failed", err))
            .then(draw);
    });
    if (dialog) keepFresh(dialog, { run: draw, watch: { stores: [stores.map, ...(stores.season ? [stores.season] : []), stores.access, stores.mastermind], hooks: ["userConnected", "drpgPassagesTold"] } });
    return { draw, settled: () => busy };
}
