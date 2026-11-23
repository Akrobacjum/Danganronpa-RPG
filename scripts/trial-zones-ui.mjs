/**
 * Danganronpa RPG - the zone modes on screen: the console's panel, the GM's picker window and Logic Dive's set editor,
 * the side-pick window a participant with no hall token gets, and the zones drawn on the hall (E73 C2-C6, 12.11.2026).
 * ---------------------------------------------------------------------------
 * THE PANEL CONTRACT (`ZONE_PANELS`; the owner's 10.11 console note, Q-E73-2's deviation in docs/dev/e73/STATUS.md).
 * One row per zone mode: the mode's name key, the console's action that starts it (trial-floor.mjs `MODE_STARTS` names
 * the same) and `panel(view)`, the markup of the console's middle while that mode holds the floor - its question, each
 * zone's answer and who stands there now, the phase and its clock, a Logic Dive's count in its pause, a Scrum's speaker
 * and its theses. The console reads the row's `panel` alone, for the mode on the floor (trial-floor-ui.mjs
 * `trialConsoleHtml`); a console rebuilt later reads the same rows. The rows' `name` and `start` are read by nothing in
 * scripts/ (git grep, 21.11.2026): tier 1 R3905 reads `start` ("zones", as `MODE_STARTS` names it), and `name` is the row's label alone.
 *
 * Everything here is drawn from the floor and the sides (trial-zones.mjs `sidesNow`), which every client reads alike;
 * the truth of a Logic Dive question is the GMs' store's and is drawn only in the GM's set editor, never in the console.
 */

import { MODULE_ID, TRIAL } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { trialScene } from "./rooms.mjs";
import { zoneRegions, zonesReady, tokenZone } from "./zone-geometry.mjs";
import { ZONE_MODES, isZoneMode, zoneOf, conferCamps } from "./zone-machine.mjs";
import { sidesNow, hallTokenOf, zoneStartRefusal, zoneArgsRefusal, startStrawPoll, startScrumDebate, startLogicDive, findingsNow, addFinding, editFinding,
    deleteFinding, confirmFinding } from "./trial-zones.mjs";
import { trialParticipants, trialProgress } from "./vote.mjs";
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

/** One zone's line on the panel: its answer, named as on the hall (E129 S0-ZONESTYLE, no "Zone A"), and who stands there. */
function zoneLine(side, zone, sides) {
    const who = sides[side].map(nameOf).join(", ") || esc(game.i18n.localize("DRPG.Zones.panel.nobody"));
    return `<li data-drpg-zone-side="${side}"><strong>${esc(zone.answers?.[side] ?? "-")}</strong>
        <span class="drpg-zone-count">(${sides[side].length})</span><br><small>${who}</small></li>`;
}

/**
 * The console's middle for a zone floor (`ZONE_PANELS`' `panel`): `view.floor` the floor, `view.sides` the sides
 * (`sidesNow`) - read here when not handed in.
 */
export function zonePanelHtml({ floor, sides = null } = {}) {
    const zone = zoneOf(floor);
    if (!zone) return "";
    // While the camps confer, the panel names the camps as they were kept at the Sides' end - the rooms they talk in -
    // and nobody outside them (the owner's 13.11.2026; zone-machine.mjs `conferCamps`).
    const camps = conferCamps(floor);
    const s = camps ? { ...camps, none: [], line: [] } : sides ?? sidesNow({ floor });
    const L = key => game.i18n.localize(key);
    const mode = L(`DRPG.Floor.mode.${floor.mode}`);
    const phase = game.i18n.format(`DRPG.Zones.panel.${floor.mode}.${zone.phase}`, {
        seconds: leftOn(floor), n: (zone.set?.index ?? 0) + 1, total: zone.set?.total ?? 1, turn: zone.turn ?? 0, turns: zone.turns ?? 0,
        who: nameOf(floor.holderId), answer: esc(zone.answers?.[zone.side] ?? "")
    });
    const counted = zone.phase === "pause" && zone.counts
        ? `<p class="drpg-zone-counted">${game.i18n.format("DRPG.Zones.panel.counted", { na: zone.counts.a, nb: zone.counts.b, a: esc(zone.answers?.a ?? ""), b: esc(zone.answers?.b ?? "") })}</p>` : "";
    const outside = [...s.none, ...s.line];
    const left = outside.length ? `<p class="notes">${game.i18n.format("DRPG.Zones.panel.outside", { names: outside.map(nameOf).join(", ") })}</p>` : "";
    const theses = (zone.theses ?? []).map(t => `<li>${nameOf(t.actorId)} (${esc(zone.answers?.[t.side] ?? "")}): ${esc(t.text)}</li>`).join("");
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
    if (at) return game.i18n.format("DRPG.Zones.dive.replayStopped", { when, n: at, outcome });
    // Started and never ended or stopped (the needsCode line, R6910): replay's "it ended {when} (played)" was not true.
    if (!set.endedAt) return game.i18n.format("DRPG.Zones.dive.replayUnfinished", { when });
    return game.i18n.format("DRPG.Zones.dive.replay", { when, outcome });
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
function setRefusal(set) {
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
async function saveDiveSet(id, set) {
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
    const field = (name, value) => `<input type="text" name="q${i}.${name}" value="${esc(value ?? "")}" maxlength="${name === "question" ? TRIAL.modes.zones.questionLength : TRIAL.modes.zones.answerLength}"${
        name === "question" ? tipAttr("DRPG.Tips.Sweep.Trial.zoneQuestionTooltip") : tipAttr("DRPG.Tips.Sweep.Trial.zoneAnswerTooltip")}>`;
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
 *
 * A SET REFUSED OPENS AGAIN AS TYPED (1.2.122; CTRL-08, CASE-47, STG-19). A footer press closes a kit window before its
 * answer is judged (ui-kit.mjs `drpgWindow`), so a set with no name, a blank answer or an unmarked right answer was told
 * in a toast and everything typed was gone. Now the editor opens again on what was typed (`draft`), with the reason above
 * the form, until it is saved or cancelled.
 */
export async function editDiveSet(id = null, { draft = null, refused = null } = {}) {
    if (!game.user.isGM) return null;
    await diveSetStore.whenHydrated();
    const stored = id ? diveSetStore.get(id) : null;
    const was = draft ? { ...(stored ?? {}), ...draft } : stored;
    const max = Number(TRIAL.modes.zones.dive.maxQuestions) || 5;
    const qs = [...(was?.questions ?? [])];
    while (qs.length < max) qs.push({ question: "", a: "", b: "", truth: null });
    const asked = await drpgWindow({
        title: game.i18n.localize(stored ? "DRPG.Zones.dive.editor.editTitle" : "DRPG.Zones.dive.editor.newTitle"),
        classes: ["drpg-panel", "drpg-dive-editor"],
        body: `<form>
            ${refused ? box("warning", `<p data-drpg-dive-refused>${esc(refused)}</p>`) : ""}
            ${box("secret", `<p>${esc(game.i18n.localize("DRPG.Zones.dive.editor.secret"))}</p>`)}
            ${formGrid([
        { label: game.i18n.localize("DRPG.Zones.dive.editor.name"), field: `<input type="text" name="name" value="${esc(was?.name ?? "")}" maxlength="80"${tipAttr("DRPG.Tips.Sweep.Trial.diveSetNameTooltip")}>` },
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
            primary: { action: "save", label: game.i18n.localize("DRPG.Zones.dive.editor.save"), tooltip: tipText("DRPG.Tips.Sweep.Trial.diveSetSaveTooltip"), callback: (e, b, d) => readSetForm(d.element) },
            close: "cancel"
        },
        rejectClose: false
    });
    if (!asked || asked === "cancel") return null;
    const why = setRefusal(asked);
    if (why) {
        ui.notifications.warn(why);
        return editDiveSet(id, { draft: asked, refused: why });
    }
    return saveDiveSet(id, asked);
}

/** A set deleted, after the GM's yes. */
async function deleteDiveSet(id) {
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

/**
 * The picker's Logic Dive fields: the sets' select (`plan.setId` chosen), each set's replay warning and the sets' button.
 * Drawn again in the open picker whenever the sets change (1.2.122, CTRL-09, STG-20: a set made through its own button
 * was not in the picker until it was opened again).
 */
export function diveFieldsHtml({ sets = diveSets(), plan = null } = {}) {
    const L = key => game.i18n.localize(key);
    const named = key => `aria-label="${esc(L(key))}"`;
    const setOptions = sets.map(s => `<option value="${esc(s.id)}"${plan?.setId && s.id === plan.setId ? " selected" : ""}>${esc(s.name)} (${s.questions.length})</option>`).join("");
    const warnings = sets.map(s => {
        const w = replayWarning(s);
        return w ? `<p data-drpg-dive-replay="${esc(s.id)}" hidden>${esc(w)}</p>` : "";
    }).join("");
    return `<div data-drpg-zone-fields="dive">
            ${sets.length ? formGrid([{ label: L("DRPG.Zones.picker.set"), field: `<select name="setId" ${named("DRPG.Zones.picker.set")}${tipAttr("DRPG.Tips.Trial.setTooltip")}>${setOptions}</select>` }])
        : `<p>${esc(L("DRPG.Zones.picker.noSets"))}</p>`}
            <div class="drpg-dive-replay">${warnings ? box("secret", warnings) : ""}</div>
            <button type="button" data-drpg-dive-edit${tipAttr("DRPG.Tips.Sweep.Trial.diveSetsTooltip")}>${esc(L("DRPG.Zones.picker.editSets"))}</button>
        </div>`;
}

/** The picker's body: a mode each, its fields; a Logic Dive's set list with each set's replay warning. */
export function pickerHtml({ mode = ZONE_MODES.straw, sets = diveSets(), plan = null, refused = null } = {}) {
    // a node's planned minigame (case-trial.mjs `startFromNode`, 13.11.2026): its fields filled in, its set picked
    const p = key => esc(plan?.[key] ?? "");
    const L = key => game.i18n.localize(key);
    const radio = m => `<label class="drpg-zone-mode-pick"><input type="radio" name="mode" value="${m}"${m === mode ? " checked" : ""}> ${esc(L(`DRPG.Floor.mode.${m}`))}</label>`;
    /* Named by its row's label (13.11.2026): formGrid's <label> has no `for`, so a field of this window had no name a
       screen reader could read, and tier 2's "every control in the module's own chrome has a name to be read out"
       reported the question and the set once a test opened the window with a set in the store. */
    const named = key => `aria-label="${esc(L(key))}"`;
    return `<form>
        ${refused ? box("warning", `<p data-drpg-zone-refused>${esc(refused)}</p>`) : ""}
        <fieldset class="drpg-zone-modes"><legend>${esc(L("DRPG.Zones.picker.mode"))}</legend>${Object.values(ZONE_MODES).map(radio).join(" ")}</fieldset>
        <p class="notes" data-drpg-zone-hint></p>
        <div data-drpg-zone-fields="free">${formGrid([
        { label: L("DRPG.Zones.picker.question"), field: `<input type="text" name="question" ${named("DRPG.Zones.picker.question")} value="${p("question")}" maxlength="${TRIAL.modes.zones.questionLength}"${tipAttr("DRPG.Tips.Sweep.Trial.zoneQuestionTooltip")}>` },
        { label: L("DRPG.Zones.picker.a"), field: `<input type="text" name="a" ${named("DRPG.Zones.picker.a")} value="${p("a")}" maxlength="${TRIAL.modes.zones.answerLength}"${tipAttr("DRPG.Tips.Sweep.Trial.zoneAnswerTooltip")}>` },
        { label: L("DRPG.Zones.picker.b"), field: `<input type="text" name="b" ${named("DRPG.Zones.picker.b")} value="${p("b")}" maxlength="${TRIAL.modes.zones.answerLength}"${tipAttr("DRPG.Tips.Sweep.Trial.zoneAnswerTooltip")}>` }
    ])}
            <div data-drpg-zone-fields="scrum">${formGrid([{ label: L("DRPG.Zones.picker.thesis"), field: `<input type="text" name="thesis" ${named("DRPG.Zones.picker.thesis")} value="${p("thesis")}" maxlength="${TRIAL.modes.zones.scrum.thesisLength}"${tipAttr("DRPG.Tips.Trial.thesisTooltip")}>` }])}</div>
        </div>
        ${diveFieldsHtml({ sets, plan })}
    </form>`;
}

/**
 * THE ZONE MODES' WINDOW (the console's "Hall zones" button; `game.drpg.openZonePicker(mode)`): one mode picked, its
 * question and two answers typed (a Scrum's thesis optional), or a Logic Dive set chosen, a set played before warned of
 * where it ended (GM-only); Start. Refused first when no zones are picked or another mode holds the floor.
 */
export async function openZonePicker({ mode = ZONE_MODES.straw, plan = null, refused: told = null } = {}) {
    if (!game.user.isGM) return null;
    const refused = zoneStartRefusal();
    if (refused) {
        ui.notifications.warn(refused);
        return null;
    }
    await diveSetStore.whenHydrated();
    let picker = null;
    let repaint = null;
    const asked = await drpgWindow({
        title: game.i18n.localize("DRPG.Zones.picker.title"),
        classes: ["drpg-panel", "drpg-narrow", "drpg-zone-picker"],
        body: pickerHtml({ mode: isZoneMode(mode) ? mode : ZONE_MODES.straw, plan, refused: told }),
        // The sets' select follows the GMs' store, the set chosen kept (CTRL-09, STG-20).
        live: {
            region: '[data-drpg-zone-fields="dive"]',
            build: () => {
                const root = picker?.element;
                const setId = root?.querySelector('[name="setId"]')?.value ?? plan?.setId ?? null;
                const hidden = root?.querySelector('[data-drpg-zone-fields="dive"]')?.hidden ?? false;
                return diveFieldsHtml({ plan: { setId } }).replace('data-drpg-zone-fields="dive"', `data-drpg-zone-fields="dive"${hidden ? " hidden" : ""}`);
            },
            after: () => repaint?.(),
            watch: { stores: [diveSetStore] }
        },
        render: (event, dialog) => {
            const root = dialog?.element;
            if (!root) return;
            picker = dialog;
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
            repaint = paint;
            root.addEventListener("change", paint);
            // Heard on the root: the button is drawn again with the sets (above).
            root.addEventListener("click", e => {
                if (e.target?.closest?.("[data-drpg-dive-edit]")) openDiveSets().catch(err => error("The Logic Dive sets did not open", err));
            });
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
    /* WHAT THE FORM CANNOT START, SAID AND KEPT (1.2.122; CASE-47, CTRL-46). Start closes the window before its answer is
       judged, so a Straw Poll with an answer left blank lost its question and answers to a toast, and a Logic Dive with
       no set closed with no word at all. The machine's reason for the form (trial-zones.mjs `zoneArgsRefusal`) is now
       read first: told, and the window opened again as typed with the reason above it. A refusal of the floor or the
       trial is startZone's, as before. */
    const op = asked.mode === ZONE_MODES.dive ? "dive" : asked.mode === ZONE_MODES.scrum ? "scrum" : "straw";
    const why = await zoneArgsRefusal(op, op === "dive" ? { set: asked.setId } : { text: asked.question, a: asked.a, b: asked.b, thesis: asked.thesis });
    if (why) {
        const said = game.i18n.localize(why);
        ui.notifications.warn(said);
        return openZonePicker({ mode: asked.mode, plan: { question: asked.question, a: asked.a, b: asked.b, thesis: asked.thesis, setId: asked.setId || null }, refused: said });
    }
    if (asked.mode === ZONE_MODES.dive) return startLogicDive(asked.setId);
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
            <button type="button" data-drpg-dive-act="edit"${tipAttr("DRPG.Tips.Sweep.Trial.diveSetEditTooltip")}>${esc(game.i18n.localize("DRPG.Zones.dive.editor.edit"))}</button>
            <button type="button" data-drpg-dive-act="delete"${tipAttr("DRPG.Tips.Sweep.Trial.diveSetDeleteTooltip")}>${esc(game.i18n.localize("DRPG.Zones.dive.editor.delete"))}</button></li>`).join("")}</ul>`;
    };
    return drpgWindow({
        title: game.i18n.localize("DRPG.Zones.dive.editor.listTitle"),
        classes: ["drpg-panel", "drpg-dive-sets-window"],
        body: `<div data-drpg-dive-list>${rows()}</div>`,
        // The list follows the GMs' store: another GM's set, a delete, a Logic Dive's end and its replay line (REFR-71).
        live: { region: "[data-drpg-dive-list]", build: () => `<div data-drpg-dive-list>${rows()}</div>`, watch: { stores: [diveSetStore] } },
        render: (event, dialog) => {
            const root = dialog?.element;
            if (!root?.querySelector("[data-drpg-dive-list]")) return;
            // Heard on the root: the list is drawn again in place (above).
            root.addEventListener("click", async e => {
                const button = e.target?.closest?.("[data-drpg-dive-act]");
                const id = button?.closest("[data-drpg-dive-set]")?.dataset.drpgDiveSet;
                if (!id) return;
                if (button.dataset.drpgDiveAct === "edit") await editDiveSet(id);
                else await deleteDiveSet(id);
                const list = root.querySelector("[data-drpg-dive-list]");
                if (list) list.innerHTML = rows();
            });
        },
        footer: {
            secondary: [{ action: "new", label: game.i18n.localize("DRPG.Zones.dive.editor.new"), tooltip: tipText("DRPG.Tips.Sweep.Trial.diveSetNewTooltip"), callback: () => "new" }],
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
        <button type="button" data-drpg-finding-act="confirm"${f.confirmed ? " disabled" : ""}${tipAttr("DRPG.Tips.Trial.monokumaConfirmsTooltip", null, { title: true })}>${L("DRPG.Zones.findings.confirm")}</button></li>`).join("")}</ul>`;
}

/**
 * One line of text asked of the GM: a Finding's words. Save is held while the field is empty or, for an edit, holds the
 * words already there (1.2.122, CTRL-47: it closed the window and wrote nothing, with no word), and its answer is an
 * object, so a Finding typed as the word "cancel" is not read as Cancel. Answers the words, or null.
 */
async function askFindingText(title, value = "") {
    const was = String(value ?? "").trim();
    const out = await drpgWindow({
        title, classes: ["drpg-panel", "drpg-narrow", "drpg-finding-text"],
        body: `<form>${formGrid([{ label: game.i18n.localize("DRPG.Zones.findings.text"), field: `<input type="text" name="text" value="${esc(value)}" maxlength="${TRIAL.modes.zones.answerLength * 3}"${tipAttr("DRPG.Tips.Sweep.Trial.findingTextTooltip")}>` }])}</form>`,
        render: (event, dialog) => {
            const root = dialog?.element;
            const field = root?.querySelector('[name="text"]');
            const save = root?.querySelector('button[data-action="ok"]');
            if (!field || !save) return;
            const hold = () => {
                const now = field.value.trim();
                const why = !now ? "DRPG.Zones.findings.empty" : now === was ? "DRPG.Zones.findings.unchanged" : null;
                save.disabled = Boolean(why);
                save.title = why ? game.i18n.localize(why) : tipText("DRPG.Tips.Trial.saveTooltip");
            };
            field.addEventListener("input", hold);
            hold();
        },
        footer: { primary: { action: "ok", label: game.i18n.localize("DRPG.Zones.findings.save"), tooltip: tipText("DRPG.Tips.Trial.saveTooltip"), callback: (e, b, d) => ({ text: d.element.querySelector('[name="text"]')?.value ?? "" }) }, close: "cancel" },
        rejectClose: false
    });
    const text = typeof out?.text === "string" ? out.text.trim() : "";
    return text && text !== was ? text : null;
}

/** The trial's Findings, on a GM: the list with each press public on its card (trial-zones.mjs). */
export async function openFindings() {
    if (!game.user.isGM) return null;
    const draw = async () => findingsListHtml(await findingsNow());
    return drpgWindow({
        title: game.i18n.localize("DRPG.Zones.findings.title"),
        classes: ["drpg-panel", "drpg-findings-window"],
        body: `<p class="notes">${esc(game.i18n.localize("DRPG.Zones.findings.intro"))}</p><div data-drpg-findings>${await draw()}</div>`,
        // The list follows the trial's record: a Finding a zone mode writes at its end, another GM's press (REFR-43, STG-24).
        live: { region: "[data-drpg-findings]", build: () => `<div data-drpg-findings>${findingsListHtml([...(trialProgress().findings ?? [])])}</div>`, watch: { settings: [SETTINGS.trialProgress] } },
        render: (event, dialog) => {
            const root = dialog?.element;
            if (!root?.querySelector("[data-drpg-findings]")) return;
            root.addEventListener("click", async e => {
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
                const box = root.querySelector("[data-drpg-findings]");
                if (box) box.innerHTML = await draw();
            });
        },
        footer: { secondary: [{ action: "add", label: game.i18n.localize("DRPG.Zones.findings.add"), tooltip: tipText("DRPG.Tips.Sweep.Trial.findingAddTooltip"), callback: () => "add" }], close: "close" },
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
let pickWindow = null;
let pickAgain = null;

/** How long a side-pick window closed without an answer waits before it is offered again (CTRL-07). */
export const PICK_AGAIN_MS = 15000;

/**
 * The pick a floor asks of a participant with no hall token, as a key, or null when it asks none: the mode's opening and,
 * in a Logic Dive, the question's index - each question is answered on its own (CASE-46, CTRL-06; zone-machine.mjs
 * `diveQuestion` clears the picks with the question) - and nothing in a Logic Dive's pause, whose count is taken.
 */
export function pickRoundOf(floor) {
    const zone = zoneOf(floor);
    if (!zone || zone.phase === "pause") return null;
    return `${floor.mode}|${zone.openedAt}|${zone.set?.index ?? 0}`;
}

/** The side-pick window's body and its two buttons, for the question on `floor` (REFR-44: drawn for each question). */
function sidePickSpec(floor) {
    const zone = zoneOf(floor);
    const L = k => game.i18n.localize(k);
    return {
        title: L(`DRPG.Floor.mode.${floor.mode}`),
        body: `<p>${esc(L("DRPG.Zones.pick.body"))}</p>${zone.question ? `<p><strong>${esc(zone.question)}</strong></p>` : ""}`,
        footer: {
            primary: { action: "a", label: game.i18n.format("DRPG.Zones.pick.side", { answer: zone.answers?.a ?? "" }) },
            secondary: [{ action: "b", label: game.i18n.format("DRPG.Zones.pick.side", { answer: zone.answers?.b ?? "" }) }],
            close: "cancel"
        }
    };
}

/**
 * A zone mode on the floor and this player's student taking part with no token in the hall: a window to pick Zone A or
 * Zone B (bridge "trial.side"), once per pick the floor asks (`pickRoundOf`: the mode's opening, each Logic Dive
 * question). Called from trial-floor.mjs `renderTrialFloor` on every client.
 *
 * THE WINDOW FOLLOWS THE FLOOR (1.2.122; REFR-44, CTRL-06, CTRL-07, CASE-46). It closes itself once the floor asks
 * another pick or none - the next question, the pause, the mode's end - and the next question gets a window of its own
 * with its words and answers, so a press always answers the question it shows. Closed by the participant without an
 * answer (Cancel, the X, Escape) it says so and comes back after `PICK_AGAIN_MS` while the same pick is still asked and
 * none is held: until 1.2.122 it never came back, and the student stood in neither zone for the whole mode.
 */
async function offerSidePick(floor) {
    const zone = zoneOf(floor);
    if (!zone || game.user.isGM) return;
    const key = pickRoundOf(floor);
    if (pickWindow && pickWindow.key !== key) {
        const was = pickWindow;
        was.superseded = true;
        await was.app?.close?.().catch?.(() => {});
    }
    if (!key || pickOpenFor === key) return;
    const mine = trialParticipants().find(p => p.user.id === game.user.id);
    if (!mine || hallTokenOf(mine.actor) || zone.picks?.[mine.actor.id]) return;
    pickOpenFor = key;
    if (pickAgain) clearTimeout(pickAgain);
    pickAgain = null;
    const spec = sidePickSpec(floor);
    const own = { key, app: null, superseded: false };
    pickWindow = own;
    let asked = null;
    try {
        asked = await drpgWindow({
            title: spec.title,
            classes: ["drpg-panel", "drpg-narrow", "drpg-side-pick"],
            body: spec.body,
            footer: spec.footer,
            render: (event, dialog) => {
                own.app = dialog;
                // Closed as soon as the floor asks another pick, or none (the turn prompts' watch, trial-prompt.mjs).
                const watch = setInterval(() => {
                    if (!dialog.element?.isConnected) return void clearInterval(watch);
                    if (pickRoundOf(storedFloorNow()) === key) return;
                    clearInterval(watch);
                    own.superseded = true;
                    dialog.close();
                }, 500);
            },
            rejectClose: false
        });
    } finally {
        if (pickWindow === own) pickWindow = null;
    }
    if (asked === "a" || asked === "b") {
        if (pickRoundOf(storedFloorNow()) !== key) return;
        const { requestTrialSide } = await import("./gm-bridge.mjs");
        const res = await requestTrialSide({ actorId: mine.actor.id, side: asked });
        if (res.ok) ui.notifications.info(game.i18n.format("DRPG.Zones.pick.done", { answer: zone.answers?.[asked] ?? "" }));
        return;
    }
    if (own.superseded || pickRoundOf(storedFloorNow()) !== key) return;
    // Closed without an answer: told, and offered again while this pick is still asked and none is held.
    ui.notifications.warn(game.i18n.format("DRPG.Zones.pick.dismissed", { seconds: Math.round(PICK_AGAIN_MS / 1000) }));
    pickAgain = setTimeout(() => {
        pickAgain = null;
        const now = storedFloorNow();
        if (pickRoundOf(now) !== key || pickOpenFor !== key) return;
        pickOpenFor = null;
        offerSidePick(now).catch(err => error("The side-pick window did not open", err));
    }, PICK_AGAIN_MS);
}

/** The floor as this browser holds it now. */
function storedFloorNow() {
    const stored = game.settings.get(MODULE_ID, SETTINGS.trialQueue) ?? {};
    return stored.active ? stored : null;
}

/* ==========================================================================
 * THE ZONES ON THE HALL (DZ7: ignored outside the modes; in one, drawn like discovered rooms, named after the mode's
 * answers, hiding no token; an entry plays the zone's outline and `zoneEntered`, else `roomEntered`)
 * ========================================================================== */

const DRAWN = "drpgZoneOutlines";
let drawn = null;
let lastSide = null;
/* Which draw is the newest: the rooms' pieces come by `import()`, so two floors rendered in a row could otherwise finish
   in the other order and leave the older answers standing. */
let drawSeq = 0;
/* The floor drawn and the zoom its seam was struck at, for the Stained Glass seam held at one weight (`rezoomZones`). */
let drawnFloor = null;
let drawnZoom = 0;
let panHooked = false;

/** Take the drawing down, and any light it baked into a texture of its own (fog-reveal.mjs `freeOwned`). */
function clearZoneDrawing() {
    try {
        if (drawn) drawn.drpgFree?.(drawn);
        drawn?.destroy?.({ children: true });
    } catch (err) {
        error("Could not take the zones' drawing down", err);
    }
    drawn = null;
    drawnFloor = null;
}

/**
 * The words a zone shows on the hall (E129 S0-ZONESTYLE): its answer in the mode open now, alone - "bez zone a/b - sama
 * tresc", the owner's note of 23.11.2026 - or after "Zone A:" while `TRIAL.modes.zones.label.prefix` is on. Exported for
 * R8774.
 */
export function zoneLabelText(zone, side, { prefix = TRIAL.modes?.zones?.label?.prefix ?? false } = {}) {
    const answer = String(zone?.answers?.[side] ?? "").trim();
    if (!prefix) return answer;
    return `${game.i18n.localize(side === "a" ? "DRPG.TrialScene.zoneA" : "DRPG.TrialScene.zoneB")}: ${answer}`;
}

/**
 * The size a zone's name is drawn at (E129 S0-ZONESTYLE): from `base` (the room name's) down by a tenth at a time until
 * `measure(fontSize, wrapWidth)` - `{ width, height }` of the words wrapped at `wrapWidth` - fits `fitWidth` of the box's
 * width and `fitHeight` of its height, and never under `minFontPx`. `{ fontSize, wrapWidth, fits }`: `fits` false at the
 * floor means the words are clipped to the zone. Pure; exported for R8774.
 */
export function fitZoneLabel({ box, base, measure, fitWidth = 0.9, fitHeight = 0.9, minFontPx = 12 }) {
    const wrapWidth = Math.max(1, (Number(box?.w) || 0) * fitWidth);
    const maxHeight = Math.max(1, (Number(box?.h) || 0) * fitHeight);
    const fitsAt = size => {
        const m = measure(size, wrapWidth) ?? {};
        return Number(m.width) <= wrapWidth && Number(m.height) <= maxHeight;
    };
    for (let size = Math.max(minFontPx, Math.round(base)); size > minFontPx; size = Math.max(minFontPx, Math.floor(size * 0.9))) {
        if (fitsAt(size)) return { fontSize: size, wrapWidth, fits: true };
    }
    return { fontSize: minFontPx, wrapWidth, fits: fitsAt(minFontPx) };
}

/*
 * How wide and tall words wrapped at `wrapWidth` stand at `fontSize`: PIXI's own `TextMetrics` on the label's style where
 * PIXI has it (a table), else 0.6 of the size a character and 1.2 a line, a greedy wrap by words (the harness's stand-in
 * PIXI measures no text; the fit there is this estimate's, not a font's).
 */
function measureLabel(label) {
    const Metrics = PIXI.TextMetrics;
    return (fontSize, wrapWidth) => {
        if (Metrics?.measureText && PIXI.TextStyle) {
            const style = new PIXI.TextStyle({ ...(label.style ?? {}), fontSize, wordWrap: true, wordWrapWidth: wrapWidth, breakWords: true });
            const m = Metrics.measureText(String(label.text ?? ""), style);
            return { width: m.width, height: m.height };
        }
        const per = fontSize * 0.6;
        let lines = 1, run = 0, widest = 0;
        for (const word of String(label.text ?? "").split(/\s+/).filter(Boolean)) {
            const w = word.length * per;
            const next = run ? run + per + w : w;
            if (run && next > wrapWidth) { widest = Math.max(widest, run); lines += 1; run = w; } else run = next;
        }
        widest = Math.max(widest, run);
        return { width: widest, height: lines * fontSize * 1.2 };
    };
}

/** The stage's zoom, for the seam's weight (fog-reveal.mjs `seamWidth` divides by it). */
function stageZoom() {
    const zoom = globalThis.canvas?.stage?.scale?.x;
    return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
}

/*
 * THE SEAM HELD AT ONE WEIGHT UNDER STAINED GLASS, as a room's is (fog-reveal.mjs `rezoomRoomOutline`): the zones are
 * drawn again when the zoom has moved by a fifth since they were struck, never on a pan, and only while they stand. The
 * hook is put on once, by the first draw - nothing is read on a canvas with no zones drawn.
 */
function rezoomZones() {
    if (!drawn || !drawnFloor || !document.body.classList.contains("drpg-theme-stained-glass")) return;
    if (Math.abs(Math.log(stageZoom() / (drawnZoom || 1))) < 0.18) return;
    drawZones(drawnFloor).catch(err => error("Could not draw the trial hall's zones again for the zoom", err));
}

/**
 * The zones drawn on the hall while a zone mode holds the floor and this browser views the hall (E73 C2; E129
 * S0-ZONESTYLE, 23.11.2026: as a room is on the map, the owner's note of that day). Each zone is outlined with the rooms'
 * own widths and colours (fog-reveal.mjs `outlineWidths`; fog-doorways.mjs `outlineColour`): an ink keyline under a bone
 * line under Monokuma Legacy, the seam's hairline and its light (`seamHalo`, baked once by `bakeOutlineHalo`) under
 * Stained Glass; closed, since a zone has no walls to open; no fill, as a room has none. Its answer (`zoneLabelText`)
 * stands at the middle of its largest piece (`labelPoint`) in the room name's face and size (`roomNameText`), fitted to
 * the zone (`fitZoneLabel`), and does not fade: it stands until the floor leaves the zone modes (DZ7) - a room's name
 * fades after 5.4 s (`fadeLabel`), and the owner asked that this one stay. Nothing is drawn without a canvas, and the
 * harness draws through a stand-in PIXI (LIVE-E73-03; the look at a table, a LIVE item proposed in E129's report).
 */
export async function drawZones(floor) {
    const seq = ++drawSeq;
    const zone = zoneOf(floor);
    const hall = trialScene();
    const stage = globalThis.canvas?.interface ?? globalThis.canvas?.controls ?? null;
    if (!zone || !hall || globalThis.canvas?.scene?.id !== hall.id || !stage || typeof PIXI === "undefined") return clearZoneDrawing();
    const regions = zoneRegions(hall);
    if (!zonesReady(regions)) return clearZoneDrawing();
    const [R, D, G, { boundsOf }, { glassOn }] = await Promise.all([import("./fog-reveal.mjs"), import("./fog-doorways.mjs"),
        import("./fog-geometry.mjs"), import("./movement.mjs"), import("./motion.mjs")]);
    if (seq !== drawSeq) return null;
    clearZoneDrawing();
    try {
        const group = new PIXI.Container();
        group.name = DRAWN;
        group.eventMode = "none";
        group.drpgFree = R.freeOwned;
        const glass = glassOn();
        const grid = hall.grid?.size ?? 100;
        const bone = D.outlineColour();
        const ink = D.colourOf("--drpg-ink", 0x1a1620);
        const { boneWidth, inkWidth } = R.outlineWidths(glass, grid);
        const fit = TRIAL.modes?.zones?.label ?? {};
        const origin = { x: 0, y: 0 };
        for (const side of ["a", "b"]) {
            const region = regions[side];
            const piece = new PIXI.Container();
            piece.name = `${DRAWN}-${side}-piece`;
            if (glass) {
                const light = piece.addChild(R.seamHalo({ bone, boneWidth, edges: [], rect: origin, gapPad: 0, stubFloor: 0, region }));
                R.bakeOutlineHalo(piece, light, stage);
            }
            // The room outline's own stroke (fog-reveal.mjs `flashOutline`'s `stroke`): square caps, miter joins at 2.
            const g = new PIXI.Graphics();
            g.name = `${DRAWN}-${side}`;
            const stroke = (width, color) => g.lineStyle({ width, color, alpha: 1, cap: "square", join: "miter", miterLimit: 2 });
            if (inkWidth) { stroke(inkWidth, ink); G.traceRegionPathsAt(g, region, origin); }
            stroke(boneWidth, bone);
            G.traceRegionPathsAt(g, region, origin);
            piece.addChild(g);
            const words = zoneLabelText(zone, side);
            const at = R.labelPoint(region, origin);
            const box = boundsOf(G.largestPiece(region));
            if (words && at && box) {
                const label = R.roomNameText(words, { glass, grid, bone });
                label.name = `${DRAWN}-${side}-label`;
                const sized = fitZoneLabel({ box, base: label.style?.fontSize ?? 28, measure: measureLabel(label),
                    fitWidth: fit.fitWidth, fitHeight: fit.fitHeight, minFontPx: fit.minFontPx });
                Object.assign(label.style, { fontSize: sized.fontSize, wordWrap: true, wordWrapWidth: sized.wrapWidth, breakWords: true });
                label.position.set(at.x, at.y);
                if (!sized.fits) {
                    const mask = new PIXI.Graphics();
                    mask.beginFill(0xffffff);
                    G.traceRegionPathsAt(mask, region, origin);
                    mask.endFill();
                    piece.addChild(mask);
                    label.mask = mask;
                }
                piece.addChild(label);
            }
            group.addChild(piece);
        }
        stage.addChild(group);
        drawn = group;
        drawnFloor = floor;
        drawnZoom = stageZoom();
        if (!panHooked) { panHooked = true; Hooks.on("canvasPan", rezoomZones); }
        return group;
    } catch (err) {
        error("Could not draw the trial hall's zones", err);
        clearZoneDrawing();
        return null;
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
    // The outline alone pulses, inside its zone's piece; the name stands as it is.
    const g = drawn?.getChildByName?.(`${DRAWN}-${side}-piece`)?.getChildByName?.(`${DRAWN}-${side}`);
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
    drawZones(floor).catch(err => error("Could not draw the trial hall's zones", err));
    offerSidePick(floor).catch(err => error("The side-pick window did not open", err));
}
