/**
 * Danganronpa RPG - the Passages tab of Room Setup (E79 C5, 1.2.78).
 * ---------------------------------------------------------------------------
 * The GMs' table of the secret passages on the scene Room Setup was opened on, after the Doors
 * tab (vault.mjs `ROOM_SETUP_TABS`), drawn as the D31 mockup drew it (the E79 plan's 2.4): a row
 * per passage - its rooms; who knows it, a chip per student with the way they learnt it, a cross
 * that revokes it and '+' that gives it to another (two clicks); who knows it from the season's
 * start; its state (secret, closed, or broken when its wall moved, with the students no player of
 * theirs has been sent it yet and the players who share a student); and Show, Close or Open, and
 * Delete. Every button writes at once through passages-gm.mjs, as `game.drpg.passages` does, and
 * nothing waits for Apply: the window's Apply and Cancel read none of this tab.
 *
 * The cross asks first only when the student stands in one of the passage's rooms on its scene:
 * 'Revoke now' or 'Revoke when they leave the room' (passages-gm.mjs `revokeWhenLeaving`); a
 * student anywhere else forgets it at once. The Mastermind knows every passage (the owner's Q7)
 * and is listed nowhere here.
 *
 * Nothing here names a passage's wall or stretch (R560: the records' files alone do); Show asks
 * passages-gm.mjs for the stretch's middle. The table is redrawn whole after each button and when
 * the records change on another GM's browser (`keepFresh` on the three stores), so the tab holds
 * no field of its own to lose. 'New passage' over the table, and 'Pick again' on a broken row,
 * start the pick on the board (passages-gm.mjs `startPassagePick`, E79 C6): Room Setup is minimized
 * for the two clicks and the table redrawn after them. E44 and E46 take the tab's table with the
 * other Room Setup tables when they rebuild them.
 */

import { error } from "./utils.mjs";
import { keepFresh } from "./live.mjs";
import {
    PASSAGE_STORES, listPassages, grantPassage, revokePassage, revokeWhenLeaving, setStartAccess,
    closePassage, openPassage, deletePassage, isMastermindActor, undeliveredOf, passageMiddle, startPassagePick
} from "./passages-gm.mjs";

const esc = text => foundry.utils.escapeHTML(String(text ?? ""));
const t = key => game.i18n.localize(key);
const tf = (key, data) => game.i18n.format(key, data);
const HOW = { gm: "DRPG.Passage.tab.howGm", start: "DRPG.Passage.tab.howStart", shown: "DRPG.Passage.tab.howShown" };

/** A passage's rooms as the tab and its windows name it: "Kitchen - Dining Hall", or that none is named. */
export function passageTitle(passage) {
    const rooms = (passage?.rooms ?? []).filter(r => typeof r === "string" && r);
    return rooms.length ? rooms.join(" - ") : t("DRPG.Passage.tab.noRooms");
}

/** A student's name for the table, or the tab's word for a character this world no longer holds. */
function nameOf(actorId, actors) {
    return actors?.get?.(actorId)?.name ?? t("DRPG.Passage.tab.unknown");
}

/** One chip of a column, with its cross: `act` is what the cross does, `how` the way the student learnt it (Who knows only). */
function chip(actorId, { actors, act, how = null, leave = null, cross }) {
    const name = esc(nameOf(actorId, actors));
    const label = how ? ` <b>${esc(t(HOW[how] ?? HOW.gm))}</b>` : "";
    const until = leave ? ` <b data-drpg-passage-leave>${esc(tf("DRPG.Passage.tab.leaving", { room: leave }))}</b>` : "";
    return `<span class="drpg-room-chip drpg-passage-chip"${how ? ` data-how="${esc(how)}"` : ""} data-drpg-actor="${esc(actorId)}">${
        name}${label}${until}<button type="button" class="drpg-passage-chip-x" data-drpg-passage-act="${act}" data-drpg-actor="${esc(actorId)}"
        aria-label="${esc(cross)}: ${name}" title="${esc(cross)}">x</button></span>`;
}

/** '+' and the students it offers, hidden until it is pressed: the second click is the student's name. */
function adder(menu, act, offer, label) {
    if (!offer.length) return "";
    return `<button type="button" class="drpg-mini-button drpg-passage-add" data-drpg-passage-act="menu" data-drpg-menu="${menu}"
        aria-label="${esc(label)}" title="${esc(label)}" aria-expanded="false">+</button><span class="drpg-passage-menu" data-drpg-menu-of="${menu}" hidden>${
        offer.map(a => `<button type="button" class="drpg-mini-button" data-drpg-passage-act="${act}" data-drpg-actor="${esc(a.id)}">${
            esc(a.name)}</button>`).join("")}</span>`;
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
        leave: typeof cell?.leave === "string" ? cell.leave : null, cross: t("DRPG.Passage.tab.revoke") })).join("") : none}${
        adder("grant", "grant", offer(knows.map(([actorId]) => actorId)), t("DRPG.Passage.tab.grant"))}`;
    const startCell = `${start.length ? start.map(actorId => chip(actorId, { actors, act: "start-off", cross: t("DRPG.Passage.tab.startRemove") })).join("") : none}${
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

    return `<tr data-drpg-passage="${esc(passage.id)}">
        <td>${esc(passageTitle(passage))}</td>
        <td><span class="drpg-passage-chips">${knowsCell}</span></td>
        <td><span class="drpg-passage-chips">${startCell}</span></td>
        <td class="drpg-passage-state-cell"><span class="drpg-passage-state" data-state="${state}">${esc(t(stateWord))}</span>${notes.join("")}</td>
        <td class="act"><span class="drpg-passage-actions">
            <button type="button" class="drpg-mini-button" data-drpg-passage-act="show">${esc(t("DRPG.Passage.tab.show"))}</button>${
                state === "broken" ? `
            <button type="button" class="drpg-mini-button" data-drpg-passage-act="repick">${esc(t("DRPG.Passage.pick.repick"))}</button>` : ""}
            <button type="button" class="drpg-mini-button" data-drpg-passage-act="${toggle}"${state === "broken" ? " disabled" : ""}>${esc(t(toggle === "open" ? "DRPG.Passage.tab.open" : "DRPG.Passage.tab.close"))}</button>
            <button type="button" class="drpg-mini-button" data-drpg-passage-act="delete">${esc(t("DRPG.Passage.tab.delete"))}</button>
        </span></td>
    </tr>`;
}

/**
 * The tab's table and its notes for one scene, from the GMs' records: the inside of the
 * `[data-drpg-passages]` box `passagesTabHtml` draws, and what the box is redrawn with. A scene with no
 * passage draws no table, only the line that says so.
 */
export function passagesTabBody(scene, { stores = PASSAGE_STORES, students = [], actors = game.actors, users = game.users, told } = {}) {
    if (!game.user?.isGM) return "";
    const passages = listPassages({ stores }).filter(p => p.sceneId === scene?.id)
        .sort((a, b) => passageTitle(a).localeCompare(passageTitle(b)) || a.id.localeCompare(b.id));
    const table = passages.length ? `<table class="drpg-vault-table drpg-room-setup-table drpg-passage-table">
        <colgroup><col class="drpg-col-room" /><col class="drpg-col-knows" /><col class="drpg-col-knows-start" /><col class="drpg-col-state" /><col class="drpg-col-actions" /></colgroup>
        <thead><tr><th>${esc(t("DRPG.Passage.tab.rooms"))}</th><th>${esc(t("DRPG.Passage.tab.knows"))}</th><th>${esc(t("DRPG.Passage.tab.start"))}</th><th>${esc(t("DRPG.Passage.tab.state"))}</th><th></th></tr></thead>
        <tbody>${passages.map(p => rowHtml(p, { stores, students, actors, users, told })).join("")}</tbody></table>`
        : `<p class="drpg-passage-none" data-drpg-passage-empty>${esc(t("DRPG.Passage.tab.empty"))}</p>`;
    return `${table}<p class="notes">${esc(t("DRPG.Passage.tab.footnote"))}</p>`;
}

/** The Passages panel's inside, for Room Setup (vault.mjs `roomSetupContent`): nothing on a player's browser. */
export function passagesTabHtml(scene, options = {}) {
    if (!game.user?.isGM) return "";
    return `<p>${esc(t("DRPG.Passage.tab.intro"))}</p><div class="drpg-passage-bar"><button type="button" class="drpg-mini-button"
        data-drpg-passage-new>${esc(t("DRPG.Passage.pick.new"))}</button><span class="notes">${esc(t("DRPG.Passage.pick.newHint"))}</span></div>
        <div data-drpg-passages>${passagesTabBody(scene, options)}</div>`;
}

/* ------------------------------------------------------------------------------------------- *
 * What the buttons ask, each replaceable by the suite (R561) and by scenario 76's real windows.
 * ------------------------------------------------------------------------------------------- */

/** 'Revoke now' ("now"), 'Revoke when they leave the room' ("leave") or neither (null). */
async function askRevoke({ name, room, title }) {
    const answer = await foundry.applications.api.DialogV2.wait({
        window: { title: tf("DRPG.Passage.tab.revokeTitle", { passage: title }) },
        classes: ["drpg-panel"],
        content: `<p>${esc(tf("DRPG.Passage.tab.revokeAsk", { name, room }))}</p><p class="notes">${esc(tf("DRPG.Passage.tab.revokeNote", { room }))}</p>`,
        buttons: [
            { action: "now", label: t("DRPG.Passage.tab.revokeNow"), default: true },
            { action: "leave", label: t("DRPG.Passage.tab.revokeLeave") },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });
    return answer === "now" || answer === "leave" ? answer : null;
}

async function confirmDelete({ title }) {
    return Boolean(await foundry.applications.api.DialogV2.confirm({
        window: { title: t("DRPG.Passage.tab.deleteTitle") },
        classes: ["drpg-panel"],
        content: `<p>${esc(tf("DRPG.Passage.tab.deleteAsk", { passage: title }))}</p>`,
        rejectClose: false
    }));
}

/** The room the student's token stands in on the passage's scene, or null (no token there, or in no room); movement.mjs `locateActor` finds the token, as every other walk of the scenes does (R114). */
async function studentRoomOn(actorId, sceneId) {
    const { locateActor } = await import("./movement.mjs");
    const place = locateActor(game.actors?.get(actorId), { sceneId });
    return place?.scene?.id === sceneId ? place.room : null;
}

/** The GM's camera to the passage's middle, on its scene (viewed first when another is on screen). */
async function showPassage(passageId) {
    const at = passageMiddle(passageId);
    if (!at) return false;
    const scene = game.scenes?.get(at.sceneId);
    if (!scene) return false;
    if (canvas?.scene?.id !== scene.id) await scene.view();
    await canvas?.animatePan?.({ x: at.x, y: at.y });
    return true;
}

/**
 * Wire the tab inside Room Setup's element `root`, for `scene`. Each button's work runs after the
 * one before it (a second click waits, so two writes never interleave) and redraws the box; 'New
 * passage' and 'Pick again' wait for the pick (`pick`, the suite's to replace). With
 * `dialog`, the box follows the records while the window is open. Answers `{ draw, settled }`:
 * `settled()` is the promise of the last button's work, which the suite and scenario 76 wait on.
 */
export function wirePassagesTab(root, scene, { dialog = null, stores = PASSAGE_STORES, students = [], ask = askRevoke,
    confirm = confirmDelete, roomOf = studentRoomOn, show = showPassage, pick = startPassagePick } = {}) {
    const box = root?.querySelector?.("[data-drpg-passages]");
    if (!box || !game.user?.isGM) return null;
    const draw = () => { box.innerHTML = passagesTabBody(scene, { stores, students }); };
    let busy = Promise.resolve();

    const work = async (act, passageId, actorId) => {
        const passage = listPassages({ stores }).find(p => p.id === passageId);
        if (!passage) return;
        const title = passageTitle(passage);
        switch (act) {
            case "grant": return grantPassage(passageId, actorId, { stores });
            case "start-on": return setStartAccess(passageId, actorId, true, { stores });
            case "start-off": return setStartAccess(passageId, actorId, false, { stores });
            case "close": return closePassage(passageId, { stores });
            case "open": return openPassage(passageId, { stores });
            case "show": return show(passageId);
            case "repick": return pick(scene, { dialog, passageId, stores });
            case "delete": return (await confirm({ title })) ? deletePassage(passageId, { stores }) : false;
            case "revoke": {
                const cell = passage.access?.[actorId];
                if (!cell) return false;
                const room = typeof cell.leave === "string" ? null : await roomOf(actorId, passage.sceneId);
                if (!room || !(passage.rooms ?? []).includes(room)) return revokePassage(passageId, actorId, { stores });
                const choice = await ask({ name: nameOf(actorId, game.actors), room, title });
                if (choice === "now") return revokePassage(passageId, actorId, { stores });
                if (choice === "leave") return revokeWhenLeaving(passageId, actorId, room, { stores });
                return false;
            }
            default: return false;
        }
    };

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
    if (dialog) keepFresh(dialog, { run: draw, watch: { stores: [stores.map, stores.access, stores.mastermind], hooks: ["userConnected"] } });
    return { draw, settled: () => busy };
}
