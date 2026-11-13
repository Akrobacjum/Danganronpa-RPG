/**
 * Danganronpa RPG - the zone modes on screen: the console's panel, the GM's picker window and Logic Dive's set editor,
 * the side-pick window a participant with no hall token gets, and the zones drawn on the hall (E73 C2-C6, 12.11.2026).
 * ---------------------------------------------------------------------------
 * THE PANEL CONTRACT (`ZONE_PANELS`; the owner's 10.11 console note, Q-E73-2's deviation in docs/dev/e73/STATUS.md).
 * One row per zone mode: the mode's name key, the console's action that starts it (trial-floor.mjs `MODE_STARTS` names
 * the same) and `panel(view)`, the markup of the console's middle while that mode holds the floor - its question, each
 * zone's answer and who stands there now, the phase and its clock, a Logic Dive's count in its pause, a Scrum's speaker
 * and its theses. The console reads the row of the mode on the floor (trial-floor-ui.mjs `trialConsoleHtml`); a console
 * rebuilt later reads the same rows.
 *
 * Everything here is drawn from the floor and the sides (trial-zones.mjs `sidesNow`), which every client reads alike;
 * the truth of a Logic Dive question is the GMs' store's and is drawn only in the GM's set editor, never in the console.
 */

import { MODULE_ID, TRIAL } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { trialScene } from "./rooms.mjs";
import { zoneRegions, zonesReady, tokenZone } from "./zone-geometry.mjs";
import { ZONE_MODES, isZoneMode, zoneOf } from "./zone-machine.mjs";
import { sidesNow, hallTokenOf, zoneStartRefusal, startStrawPoll, startScrumDebate, startLogicDive, findingsNow, addFinding, editFinding,
    deleteFinding, confirmFinding } from "./trial-zones.mjs";
import { trialParticipants } from "./vote.mjs";
import { diveSetStore } from "./gm-stores.mjs";
import { drpgWindow, drpgConfirm, formGrid, box, tipAttr, tipText } from "./ui-kit.mjs";
import { esc, error, serverNow, localeFormat } from "./utils.mjs";

/** A name of `actorId`, escaped. */
function nameOf(id) {
    return esc(game.actors?.get?.(id ?? "")?.name ?? "-");
}

/** Seconds left on the zone floor now, never below zero. */
function leftOn(floor) {
    return Math.max(Math.round((Number(floor?.seconds) || 0) - (serverNow() - (Number(floor?.startedAt) || 0)) / 1000), 0);
}

/** One zone's line on the panel: its name, its answer and who stands there. */
function zoneLine(side, zone, sides) {
    const label = game.i18n.localize(side === "a" ? "DRPG.TrialScene.zoneA" : "DRPG.TrialScene.zoneB");
    const who = sides[side].map(nameOf).join(", ") || esc(game.i18n.localize("DRPG.Zones.panel.nobody"));
    return `<li data-drpg-zone-side="${side}"><strong>${esc(label)}</strong>: ${esc(zone.answers?.[side] ?? "-")}
        <span class="drpg-zone-count">(${sides[side].length})</span><br><small>${who}</small></li>`;
}

/**
 * The console's middle for a zone floor (`ZONE_PANELS`' `panel`): `view.floor` the floor, `view.sides` the sides
 * (`sidesNow`) - read here when not handed in.
 */
export function zonePanelHtml({ floor, sides = null } = {}) {
    const zone = zoneOf(floor);
    if (!zone) return "";
    const s = sides ?? sidesNow({ floor });
    const L = key => game.i18n.localize(key);
    const mode = L(`DRPG.Floor.mode.${floor.mode}`);
    const phase = game.i18n.format(`DRPG.Zones.panel.${floor.mode}.${zone.phase}`, {
        seconds: leftOn(floor), n: (zone.set?.index ?? 0) + 1, total: zone.set?.total ?? 1, turn: zone.turn ?? 0, turns: zone.turns ?? 0,
        who: nameOf(floor.holderId), zone: String(zone.side ?? "").toUpperCase()
    });
    const counted = zone.phase === "pause" && zone.counts
        ? `<p class="drpg-zone-counted">${game.i18n.format("DRPG.Zones.panel.counted", { a: zone.counts.a, b: zone.counts.b })}</p>` : "";
    const outside = [...s.none, ...s.line];
    const left = outside.length ? `<p class="notes">${game.i18n.format("DRPG.Zones.panel.outside", { names: outside.map(nameOf).join(", ") })}</p>` : "";
    const theses = (zone.theses ?? []).map(t => `<li>${nameOf(t.actorId)} (${esc(String(t.side ?? "").toUpperCase())}): ${esc(t.text)}</li>`).join("");
    const thesis = zone.thesis ? `<p>${game.i18n.format("DRPG.Zones.panel.thesis", { text: esc(zone.thesis) })}</p>` : "";
    return `<div class="drpg-zone-panel" data-drpg-zone-panel="${esc(floor.mode)}">
            <p><strong>${esc(mode)}</strong>${zone.question ? ` - ${esc(zone.question)}` : ""}</p>
            ${thesis}
            <p>${phase}</p>
            ${counted}
            <ul class="drpg-zone-sides">${zoneLine("a", zone, s)}${zoneLine("b", zone, s)}</ul>
            ${left}
            ${theses ? `<ul class="drpg-zone-theses">${theses}</ul>` : ""}
        </div>`;
}

/** THE PANEL CONTRACT: a row per zone mode, its name, the console's start action and its panel. */
export const ZONE_PANELS = Object.freeze({
    [ZONE_MODES.straw]: Object.freeze({ name: "DRPG.Floor.mode.straw", start: "zones", panel: zonePanelHtml }),
    [ZONE_MODES.dive]: Object.freeze({ name: "DRPG.Floor.mode.dive", start: "zones", panel: zonePanelHtml }),
    [ZONE_MODES.scrum]: Object.freeze({ name: "DRPG.Floor.mode.scrum", start: "zones", panel: zonePanelHtml })
});

/* ==========================================================================
 * LOGIC DIVE'S SETS (E73 C4; Q-E73-3: a kit window for editing, the run in the console)
 * ========================================================================== */

/** The sets as the GMs hold them, newest first: `[{ id, ...row }]`. */
export function diveSets() {
    return Object.entries(diveSetStore.entries() ?? {})
        .map(([id, row]) => ({ id, ...row }))
        .filter(row => Array.isArray(row.questions))
        .sort((x, y) => (Number(y.made) || 0) - (Number(x.made) || 0));
}

/**
 * The GM-only warning before a set is played again (TR32 = 2): where and how it ended last, or null for a set never
 * played. Plain text.
 */
export function replayWarning(set) {
    if (!set?.usedAt) return null;
    const when = localeFormat("dateTime", Number(set.endedAt || set.usedAt));
    const at = Number.isInteger(set.stoppedAt) ? set.stoppedAt + 1 : null;
    const outcome = game.i18n.localize(`DRPG.Zones.dive.outcome.${set.outcome ?? "played"}`);
    return at
        ? game.i18n.format("DRPG.Zones.dive.replayStopped", { when, n: at, outcome })
        : game.i18n.format("DRPG.Zones.dive.replay", { when, outcome });
}

/**
 * The students' names a question's words hold (TR9 = 1: no question in the zones asks who did it), each once, for the
 * editor's warning. `text` the question and its answers, `names` the students' names.
 */
export function namesIn(text, names = game.actors?.filter?.(a => a.type === "character").map(a => a.name) ?? []) {
    const hay = String(text ?? "").toLocaleLowerCase();
    return [...new Set(names.filter(n => n && n.length > 1 && hay.includes(n.toLocaleLowerCase())))];
}

/** Why a set as typed cannot be saved, in the GM's words, or null: a name; 1-5 questions, each with two answers and a truth. */
export function setRefusal(set) {
    if (!String(set?.name ?? "").trim()) return game.i18n.localize("DRPG.Zones.dive.editor.noName");
    const qs = Array.isArray(set?.questions) ? set.questions : [];
    const max = Number(TRIAL.modes.zones.dive.maxQuestions) || 5;
    if (qs.length < 1 || qs.length > max) return game.i18n.format("DRPG.Zones.dive.editor.count", { max });
    for (const q of qs) {
        if (!String(q.question ?? "").trim() || !String(q.a ?? "").trim() || !String(q.b ?? "").trim()) return game.i18n.localize("DRPG.Zones.dive.editor.blank");
        if (q.truth !== "a" && q.truth !== "b") return game.i18n.localize("DRPG.Zones.dive.editor.noTruth");
    }
    return null;
}

/** Save a set (any GM): `id` null for a new one. Answers its id, or null when refused (told). */
export async function saveDiveSet(id, set) {
    if (!game.user.isGM) return null;
    const refused = setRefusal(set);
    if (refused) {
        ui.notifications.warn(refused);
        return null;
    }
    const key = id || foundry.utils.randomID(12);
    const questions = set.questions.map(q => ({ question: String(q.question).trim(), a: String(q.a).trim(), b: String(q.b).trim(), truth: q.truth }));
    const was = diveSetStore.get(key);
    await diveSetStore.patch(key, { name: String(set.name).trim(), conclusion: String(set.conclusion ?? "").trim() || null, questions,
        chapter: Number(game.settings.get(MODULE_ID, SETTINGS.clock)?.chapter) || null, made: was?.made ?? Date.now(), by: game.user.id,
        ...(was ? {} : { usedAt: null, endedAt: null, stoppedAt: null, outcome: null }) });
    return key;
}

/** One question's rows in the editor. */
function questionRows(q, i) {
    const n = i + 1;
    const field = (name, value) => `<input type="text" name="q${i}.${name}" value="${esc(value ?? "")}" maxlength="${name === "question" ? TRIAL.modes.zones.questionLength : TRIAL.modes.zones.answerLength}">`;
    const truth = side => `<label><input type="radio" name="q${i}.truth" value="${side}"${q.truth === side ? " checked" : ""}${tipAttr("DRPG.Tips.Trial.rightAnswerZoneATooltip")}> ${esc(game.i18n.localize(side === "a" ? "DRPG.TrialScene.zoneA" : "DRPG.TrialScene.zoneB"))}</label>`;
    return `<fieldset class="drpg-dive-question" data-drpg-dive-q="${i}"><legend>${esc(game.i18n.format("DRPG.Zones.dive.editor.question", { n }))}</legend>
        ${formGrid([
        { label: game.i18n.localize("DRPG.Zones.picker.question"), field: field("question", q.question) },
        { label: game.i18n.localize("DRPG.Zones.picker.a"), field: field("a", q.a) },
        { label: game.i18n.localize("DRPG.Zones.picker.b"), field: field("b", q.b) },
        { label: game.i18n.localize("DRPG.Zones.dive.editor.truth"), field: `${truth("a")} ${truth("b")}` }
    ])}</fieldset>`;
}

/** The editor's form read back. */
function readSetForm(root) {
    const v = name => root.querySelector(`[name="${name}"]`)?.value ?? "";
    const questions = [...root.querySelectorAll("[data-drpg-dive-q]")].map(fs => {
        const i = fs.dataset.drpgDiveQ;
        return { question: v(`q${i}.question`), a: v(`q${i}.a`), b: v(`q${i}.b`), truth: root.querySelector(`[name="q${i}.truth"]:checked`)?.value ?? null };
    }).filter(q => q.question.trim() || q.a.trim() || q.b.trim());
    return { name: v("name"), conclusion: v("conclusion"), questions };
}

/**
 * THE SET EDITOR (Q-E73-3: a kit window): a set's name, its Finding when solved (optional), and 1-5 questions, each
 * with its two answers and the true one - the GMs' alone. A student's name in a question or an answer is warned of
 * (TR9 = 1) and saves anyway. Answers the set's id, or null.
 */
export async function editDiveSet(id = null) {
    if (!game.user.isGM) return null;
    await diveSetStore.whenHydrated();
    const was = id ? diveSetStore.get(id) : null;
    const max = Number(TRIAL.modes.zones.dive.maxQuestions) || 5;
    const qs = [...(was?.questions ?? [])];
    while (qs.length < max) qs.push({ question: "", a: "", b: "", truth: null });
    const asked = await drpgWindow({
        title: game.i18n.localize(was ? "DRPG.Zones.dive.editor.editTitle" : "DRPG.Zones.dive.editor.newTitle"),
        classes: ["drpg-panel", "drpg-dive-editor"],
        body: `<form>
            ${box("secret", `<p>${esc(game.i18n.localize("DRPG.Zones.dive.editor.secret"))}</p>`)}
            ${formGrid([
        { label: game.i18n.localize("DRPG.Zones.dive.editor.name"), field: `<input type="text" name="name" value="${esc(was?.name ?? "")}" maxlength="80">` },
        { label: game.i18n.localize("DRPG.Zones.dive.editor.conclusion"), field: `<input type="text" name="conclusion" value="${esc(was?.conclusion ?? "")}" maxlength="${TRIAL.modes.zones.answerLength * 3}"${tipAttr("DRPG.Tips.Trial.findingWhenSolvedTooltip")}>` }
    ])}
            ${qs.map(questionRows).join("")}
            <div data-drpg-dive-names aria-live="polite"></div>
        </form>`,
        render: (event, dialog) => {
            const root = dialog?.element;
            const out = root?.querySelector("[data-drpg-dive-names]");
            if (!root || !out) return;
            const paint = () => {
                const read = readSetForm(root);
                const found = namesIn(read.questions.map(q => `${q.question} ${q.a} ${q.b}`).join(" "));
                out.innerHTML = found.length ? box("warning", `<p>${game.i18n.format("DRPG.Zones.dive.editor.names", { names: esc(found.join(", ")) })}</p>`) : "";
            };
            root.addEventListener("input", paint);
            paint();
        },
        footer: {
            primary: { action: "save", label: game.i18n.localize("DRPG.Zones.dive.editor.save"), callback: (e, b, d) => readSetForm(d.element) },
            close: "cancel"
        },
        rejectClose: false
    });
    if (!asked || asked === "cancel") return null;
    return saveDiveSet(id, asked);
}

/** A set deleted, after the GM's yes. */
export async function deleteDiveSet(id) {
    if (!game.user.isGM || !diveSetStore.get(id)) return false;
    const yes = await drpgConfirm({ title: game.i18n.localize("DRPG.Zones.dive.editor.deleteTitle"),
        body: `<p>${esc(game.i18n.format("DRPG.Zones.dive.editor.deleteBody", { name: diveSetStore.get(id)?.name ?? "-" }))}</p>`,
        yes: { label: game.i18n.localize("DRPG.Zones.dive.editor.delete"), role: "destructive" } });
    if (!yes) return false;
    await diveSetStore.drop(id);
    return true;
}

/* ==========================================================================
 * THE PICKER (the console's one button for the zone modes)
 * ========================================================================== */

/** The picker's body: a mode each, its fields; a Logic Dive's set list with each set's replay warning. */
export function pickerHtml({ mode = ZONE_MODES.straw, sets = diveSets() } = {}) {
    const L = key => game.i18n.localize(key);
    const radio = m => `<label class="drpg-zone-mode-pick"><input type="radio" name="mode" value="${m}"${m === mode ? " checked" : ""}> ${esc(L(`DRPG.Floor.mode.${m}`))}</label>`;
    const setOptions = sets.map(s => `<option value="${esc(s.id)}">${esc(s.name)} (${s.questions.length})</option>`).join("");
    const warnings = sets.map(s => {
        const w = replayWarning(s);
        return w ? `<p data-drpg-dive-replay="${esc(s.id)}" hidden>${esc(w)}</p>` : "";
    }).join("");
    return `<form>
        <fieldset class="drpg-zone-modes"><legend>${esc(L("DRPG.Zones.picker.mode"))}</legend>${Object.values(ZONE_MODES).map(radio).join(" ")}</fieldset>
        <p class="notes" data-drpg-zone-hint></p>
        <div data-drpg-zone-fields="free">${formGrid([
        { label: L("DRPG.Zones.picker.question"), field: `<input type="text" name="question" maxlength="${TRIAL.modes.zones.questionLength}">` },
        { label: L("DRPG.Zones.picker.a"), field: `<input type="text" name="a" maxlength="${TRIAL.modes.zones.answerLength}">` },
        { label: L("DRPG.Zones.picker.b"), field: `<input type="text" name="b" maxlength="${TRIAL.modes.zones.answerLength}">` }
    ])}
            <div data-drpg-zone-fields="scrum">${formGrid([{ label: L("DRPG.Zones.picker.thesis"), field: `<input type="text" name="thesis" maxlength="${TRIAL.modes.zones.scrum.thesisLength}"${tipAttr("DRPG.Tips.Trial.thesisTooltip")}>` }])}</div>
        </div>
        <div data-drpg-zone-fields="dive">
            ${sets.length ? formGrid([{ label: L("DRPG.Zones.picker.set"), field: `<select name="setId"${tipAttr("DRPG.Tips.Trial.setTooltip")}>${setOptions}</select>` }])
        : `<p>${esc(L("DRPG.Zones.picker.noSets"))}</p>`}
            <div class="drpg-dive-replay">${warnings ? box("secret", warnings) : ""}</div>
            <button type="button" data-drpg-dive-edit>${esc(L("DRPG.Zones.picker.editSets"))}</button>
        </div>
    </form>`;
}

/**
 * THE ZONE MODES' WINDOW (the console's "Hall zones" button; `game.drpg.openZonePicker(mode)`): one mode picked, its
 * question and two answers typed (a Scrum's thesis optional), or a Logic Dive set chosen, a set played before warned of
 * where it ended (GM-only); Start. Refused first when no zones are picked or another mode holds the floor.
 */
export async function openZonePicker({ mode = ZONE_MODES.straw } = {}) {
    if (!game.user.isGM) return null;
    const refused = zoneStartRefusal();
    if (refused) {
        ui.notifications.warn(refused);
        return null;
    }
    await diveSetStore.whenHydrated();
    const asked = await drpgWindow({
        title: game.i18n.localize("DRPG.Zones.picker.title"),
        classes: ["drpg-panel", "drpg-narrow", "drpg-zone-picker"],
        body: pickerHtml({ mode: isZoneMode(mode) ? mode : ZONE_MODES.straw }),
        render: (event, dialog) => {
            const root = dialog?.element;
            if (!root) return;
            const paint = () => {
                const m = root.querySelector('[name="mode"]:checked')?.value ?? ZONE_MODES.straw;
                root.querySelector('[data-drpg-zone-fields="free"]').hidden = m === ZONE_MODES.dive;
                root.querySelector('[data-drpg-zone-fields="scrum"]').hidden = m !== ZONE_MODES.scrum;
                root.querySelector('[data-drpg-zone-fields="dive"]').hidden = m !== ZONE_MODES.dive;
                const hint = root.querySelector("[data-drpg-zone-hint]");
                if (hint) hint.textContent = game.i18n.localize(`DRPG.Zones.picker.hint.${m}`);
                const set = root.querySelector('[name="setId"]')?.value ?? "";
                for (const p of root.querySelectorAll("[data-drpg-dive-replay]")) p.hidden = p.dataset.drpgDiveReplay !== set;
            };
            root.addEventListener("change", paint);
            root.querySelector("[data-drpg-dive-edit]")?.addEventListener("click", () => openDiveSets().catch(err => error("The Logic Dive sets did not open", err)));
            paint();
        },
        footer: {
            primary: {
                action: "start", label: game.i18n.localize("DRPG.Zones.picker.start"),
                callback: (e, b, d) => {
                    const v = name => d.element.querySelector(`[name="${name}"]`)?.value ?? "";
                    return { mode: d.element.querySelector('[name="mode"]:checked')?.value ?? ZONE_MODES.straw,
                        question: v("question"), a: v("a"), b: v("b"), thesis: v("thesis"), setId: v("setId") };
                }
            },
            close: "cancel"
        },
        rejectClose: false
    });
    if (!asked || asked === "cancel") return null;
    if (asked.mode === ZONE_MODES.dive) return asked.setId ? startLogicDive(asked.setId) : null;
    if (asked.mode === ZONE_MODES.scrum) return startScrumDebate(asked);
    return startStrawPoll(asked);
}

/** Logic Dive's sets, listed: each one's name, its questions, how it last ended; New, Edit, Delete. */
export async function openDiveSets() {
    if (!game.user.isGM) return null;
    await diveSetStore.whenHydrated();
    const rows = () => {
        const sets = diveSets();
        if (!sets.length) return `<p>${esc(game.i18n.localize("DRPG.Zones.picker.noSets"))}</p>`;
        return `<ul class="drpg-dive-sets">${sets.map(s => `<li data-drpg-dive-set="${esc(s.id)}"><strong>${esc(s.name)}</strong>
            (${s.questions.length})${replayWarning(s) ? ` - <small>${esc(replayWarning(s))}</small>` : ""}
            <button type="button" data-drpg-dive-act="edit">${esc(game.i18n.localize("DRPG.Zones.dive.editor.edit"))}</button>
            <button type="button" data-drpg-dive-act="delete">${esc(game.i18n.localize("DRPG.Zones.dive.editor.delete"))}</button></li>`).join("")}</ul>`;
    };
    return drpgWindow({
        title: game.i18n.localize("DRPG.Zones.dive.editor.listTitle"),
        classes: ["drpg-panel", "drpg-dive-sets-window"],
        body: `<div data-drpg-dive-list>${rows()}</div>`,
        render: (event, dialog) => {
            const root = dialog?.element;
            const list = root?.querySelector("[data-drpg-dive-list]");
            if (!list) return;
            list.addEventListener("click", async e => {
                const button = e.target?.closest?.("[data-drpg-dive-act]");
                const id = button?.closest("[data-drpg-dive-set]")?.dataset.drpgDiveSet;
                if (!id) return;
                if (button.dataset.drpgDiveAct === "edit") await editDiveSet(id);
                else await deleteDiveSet(id);
                list.innerHTML = rows();
            });
        },
        footer: {
            secondary: [{ action: "new", label: game.i18n.localize("DRPG.Zones.dive.editor.new"), callback: () => "new" }],
            close: "close"
        },
        rejectClose: false
    }).then(out => (out === "new" ? editDiveSet(null) : null));
}

/* ==========================================================================
 * THE FINDINGS WINDOW (E73 C6; TR21, TR28 = 1), the console's "Findings" button and `game.drpg.openFindings()`
 * ========================================================================== */

/** The Findings window's list: each Finding with Edit, Delete and "Monokuma confirms" (greyed once confirmed). */
export function findingsListHtml(list) {
    if (!list.length) return `<p>${esc(game.i18n.localize("DRPG.Zones.findings.none"))}</p>`;
    const L = key => esc(game.i18n.localize(key));
    return `<ul class="drpg-findings-list">${list.map(f => `<li data-drpg-finding="${esc(f.id)}"><span>${esc(f.text)}</span>
        ${f.mode ? `<small>(${esc(game.i18n.localize(`DRPG.Floor.mode.${f.mode}`))})</small>` : ""}
        ${f.confirmed ? `<strong>${L("DRPG.Zones.findings.confirmedMark")}</strong>` : ""}
        <button type="button" data-drpg-finding-act="edit"${tipAttr("DRPG.Tips.Trial.editTooltip")}>${L("DRPG.Zones.findings.edit")}</button>
        <button type="button" data-drpg-finding-act="delete"${tipAttr("DRPG.Tips.Trial.deleteTooltip")}>${L("DRPG.Zones.findings.delete")}</button>
        <button type="button" data-drpg-finding-act="confirm"${f.confirmed ? " disabled" : ""}${tipAttr("DRPG.Tips.Trial.monokumaConfirmsTooltip")}>${L("DRPG.Zones.findings.confirm")}</button></li>`).join("")}</ul>`;
}

/** One line of text asked of the GM: a Finding's words. */
async function askFindingText(title, value = "") {
    const out = await drpgWindow({
        title, classes: ["drpg-panel", "drpg-narrow"],
        body: `<form>${formGrid([{ label: game.i18n.localize("DRPG.Zones.findings.text"), field: `<input type="text" name="text" value="${esc(value)}" maxlength="${TRIAL.modes.zones.answerLength * 3}">` }])}</form>`,
        footer: { primary: { action: "ok", label: game.i18n.localize("DRPG.Zones.findings.save"), tooltip: tipText("DRPG.Tips.Trial.saveTooltip"), callback: (e, b, d) => d.element.querySelector('[name="text"]')?.value ?? "" }, close: "cancel" },
        rejectClose: false
    });
    return typeof out === "string" && out !== "cancel" ? out : null;
}

/** The trial's Findings, on a GM: the list with each press public on its card (trial-zones.mjs). */
export async function openFindings() {
    if (!game.user.isGM) return null;
    const draw = async () => findingsListHtml(await findingsNow());
    return drpgWindow({
        title: game.i18n.localize("DRPG.Zones.findings.title"),
        classes: ["drpg-panel", "drpg-findings-window"],
        body: `<p class="notes">${esc(game.i18n.localize("DRPG.Zones.findings.intro"))}</p><div data-drpg-findings>${await draw()}</div>`,
        render: (event, dialog) => {
            const box = dialog?.element?.querySelector("[data-drpg-findings]");
            box?.addEventListener("click", async e => {
                const button = e.target?.closest?.("[data-drpg-finding-act]");
                const id = button?.closest("[data-drpg-finding]")?.dataset.drpgFinding;
                if (!id) return;
                const act = button.dataset.drpgFindingAct;
                const row = (await findingsNow()).find(f => f.id === id);
                if (act === "edit") {
                    const text = await askFindingText(game.i18n.localize("DRPG.Zones.findings.edit"), row?.text ?? "");
                    if (text !== null) await editFinding(id, text);
                } else if (act === "delete") await deleteFinding(id);
                else if (act === "confirm") await confirmFinding(id);
                box.innerHTML = await draw();
            });
        },
        footer: { secondary: [{ action: "add", label: game.i18n.localize("DRPG.Zones.findings.add"), callback: () => "add" }], close: "close" },
        rejectClose: false
    }).then(async out => {
        if (out !== "add") return null;
        const text = await askFindingText(game.i18n.localize("DRPG.Zones.findings.add"));
        return text ? addFinding(text) : null;
    });
}

/* ==========================================================================
 * THE SIDE-PICK WINDOW (E73 C2), on a participant's browser with no token in the hall
 * ========================================================================== */

let pickOpenFor = null;

/**
 * A zone mode on the floor and this player's student taking part with no token in the hall: a window to pick Zone A or
 * Zone B (bridge "trial.side"), once per mode's opening. Called from trial-floor.mjs `renderTrialFloor` on every client.
 */
export async function offerSidePick(floor) {
    const zone = zoneOf(floor);
    if (!zone || game.user.isGM) return;
    const key = `${floor.mode}|${zone.openedAt}`;
    if (pickOpenFor === key) return;
    const mine = trialParticipants().find(p => p.user.id === game.user.id);
    if (!mine || hallTokenOf(mine.actor) || zone.picks?.[mine.actor.id]) return;
    pickOpenFor = key;
    const L = k => game.i18n.localize(k);
    const asked = await drpgWindow({
        title: L(`DRPG.Floor.mode.${floor.mode}`),
        classes: ["drpg-panel", "drpg-narrow", "drpg-side-pick"],
        body: `<p>${esc(L("DRPG.Zones.pick.body"))}</p>${zone.question ? `<p><strong>${esc(zone.question)}</strong></p>` : ""}`,
        footer: {
            primary: { action: "a", label: game.i18n.format("DRPG.Zones.pick.side", { zone: L("DRPG.TrialScene.zoneA"), answer: zone.answers?.a ?? "" }) },
            secondary: [{ action: "b", label: game.i18n.format("DRPG.Zones.pick.side", { zone: L("DRPG.TrialScene.zoneB"), answer: zone.answers?.b ?? "" }) }],
            close: "cancel"
        },
        rejectClose: false
    });
    if (asked !== "a" && asked !== "b") return;
    const { requestTrialSide } = await import("./gm-bridge.mjs");
    const res = await requestTrialSide({ actorId: mine.actor.id, side: asked });
    if (res.ok) ui.notifications.info(game.i18n.format("DRPG.Zones.pick.done", { zone: L(asked === "a" ? "DRPG.TrialScene.zoneA" : "DRPG.TrialScene.zoneB") }));
}

/* ==========================================================================
 * THE ZONES ON THE HALL (DZ7: ignored outside the modes; in one, drawn like discovered rooms, named after the mode's
 * answers, hiding no token; an entry plays the zone's outline and `zoneEntered`, else `roomEntered`)
 * ========================================================================== */

const DRAWN = "drpgZoneOutlines";
let drawn = null;
let lastSide = null;

/** The theme's line colour, read off the page (the fog's own `--drpg-bone`), as a number. */
function lineColour() {
    const raw = getComputedStyle(document.body).getPropertyValue("--drpg-bone").trim() || "#e8e1d0";
    const hex = raw.startsWith("#") ? raw.slice(1) : "e8e1d0";
    return Number.parseInt(hex.length === 3 ? hex.split("").map(c => c + c).join("") : hex.slice(0, 6), 16) || 0xe8e1d0;
}

/** Take the drawing down. */
export function clearZoneDrawing() {
    try {
        drawn?.destroy?.({ children: true });
    } catch (err) {
        error("Could not take the zones' drawing down", err);
    }
    drawn = null;
}

/** A region's shapes as polygons' points, for the outline. */
function shapePoints(region) {
    return Array.from(region?.shapes ?? []).map(s => (Array.isArray(s.points) && s.points.length >= 6 ? s.points
        : Number.isFinite(s.width) ? [s.x, s.y, s.x + s.width, s.y, s.x + s.width, s.y + s.height, s.x, s.y + s.height] : null)).filter(Boolean);
}

/**
 * The zones drawn on the hall while a zone mode holds the floor and this browser views the hall: an outline each and
 * its name with the mode's answer, above the tokens' layer's background and under nobody (`eventMode` none, no fill).
 * Nothing without a canvas (the harness) - LIVE-E73-03.
 */
export function drawZones(floor) {
    const zone = zoneOf(floor);
    const hall = trialScene();
    const stage = globalThis.canvas?.interface ?? globalThis.canvas?.controls ?? null;
    if (!zone || !hall || globalThis.canvas?.scene?.id !== hall.id || !stage || typeof PIXI === "undefined") return clearZoneDrawing();
    const regions = zoneRegions(hall);
    if (!zonesReady(regions)) return clearZoneDrawing();
    clearZoneDrawing();
    try {
        const group = new PIXI.Container();
        group.name = DRAWN;
        group.eventMode = "none";
        const colour = lineColour();
        for (const side of ["a", "b"]) {
            const g = new PIXI.Graphics();
            g.name = `${DRAWN}-${side}`;
            g.lineStyle({ width: Math.max((hall.grid?.size ?? 100) / 20, 3), color: colour, alpha: 0.9 });
            for (const pts of shapePoints(regions[side])) g.drawPolygon(pts);
            group.addChild(g);
            const words = `${game.i18n.localize(side === "a" ? "DRPG.TrialScene.zoneA" : "DRPG.TrialScene.zoneB")}: ${zone.answers?.[side] ?? ""}`;
            const label = new PIXI.Text(words, { fontFamily: "Signika, sans-serif", fontSize: Math.max((hall.grid?.size ?? 100) / 3, 18), fill: colour,
                stroke: 0x1a1620, strokeThickness: 4 });
            const first = shapePoints(regions[side])[0] ?? [0, 0];
            label.position.set(first[0] + 12, first[1] + 12);
            group.addChild(label);
        }
        stage.addChild(group);
        drawn = group;
    } catch (err) {
        error("Could not draw the trial hall's zones", err);
        clearZoneDrawing();
    }
}

/**
 * This browser's own student entering a zone (`updateToken` on the hall, during a zone mode): its outline pulses and
 * `zoneEntered` plays here, or `roomEntered` when no file is set for it.
 */
export async function onZoneEntered(tokenDoc) {
    const floor = game.settings.get(MODULE_ID, SETTINGS.trialQueue) ?? {};
    if (!floor.active || !zoneOf(floor) || tokenDoc?.parent?.id !== trialScene()?.id) return;
    if (!tokenDoc.actor?.isOwner || game.user.isGM) return;
    const side = tokenZone(zoneRegions(), tokenDoc);
    if (side !== "a" && side !== "b") { lastSide = null; return; }
    if (side === lastSide) return;
    lastSide = side;
    const g = drawn?.getChildByName?.(`${DRAWN}-${side}`);
    if (g) {
        g.alpha = 0.3;
        setTimeout(() => { if (!g.destroyed) g.alpha = 1; }, 260);
    }
    try {
        const { soundFor, playSfx } = await import("./sfx-play.mjs");
        playSfx(soundFor("zoneEntered") ? "zoneEntered" : "roomEntered");
    } catch (err) {
        error("Could not play the zone's sound", err);
    }
}

/** The floor moved, on every client (trial-floor.mjs `renderTrialFloor`): the drawing, and a participant's pick window. */
export function onZoneFloor(floor) {
    if (!zoneOf(floor)) {
        lastSide = null;
        return clearZoneDrawing();
    }
    drawZones(floor);
    offerSidePick(floor).catch(err => error("The side-pick window did not open", err));
}
