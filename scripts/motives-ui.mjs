/**
 * Danganronpa RPG - the players' motives on screen: the sheet's Personal tab, the GMs' windows and cards.
 * ---------------------------------------------------------------------------
 * 2.0 line T5, D2-23 and D2-24 (27.11.2026; docs/dev/v2/SPEC-MOTIVES.md "Interfejs"; motives.mjs holds the record and
 * its rules, and says who may read what). What this file draws:
 *
 *   - THE PERSONAL TAB (`injectMotives`, a step of sheet.mjs `SHEET_STEPS`). Daggerheart's Biography tab is named
 *     "Personal" (its id `biography` stays: `dropTab`, `keepTabScroll` and the stylesheets find it by that), and on top of
 *     it the motives: the Monokuma Motive in force (its words, or "unknown" while hidden; its deadline and penalty when it
 *     has them), then the student's Personal and Relationship Motives with their state - from the owner's copy on a
 *     player's browser, the GMs' store on a GM's - and below them the biography as before. Its owner gets "Report done"
 *     for an open or rejected motive; a GM gets Edit, Pass and Reject. Another player who may look at the sheet sees the
 *     Monokuma Motive alone: their browser holds no copy of anybody else's motives. The dead and the Spectators hold none
 *     (#7); a Monokuma's sheet has no such tab.
 *   - A GM'S CARD OF A REPORT (`rulingCardHtml`, `wireRulingCard`): whispered to the GMs alone (secret.mjs), its Pass and
 *     Reject in its words, wired on a GM's render as a find's "Write it here" is (observe.mjs `wireDescribeHere`).
 *   - THE GMS' WINDOWS: one student's motives (`openStudentMotives`, from the tab, the Students window's column and the
 *     overview), the overview behind the GM panel's tile (`openMotivesOverview`: the Monokuma Motive, the reports waiting,
 *     every student), and after a Class Trial the Level Up list (`pickMotiveLevelUps`, verdict.mjs's step `motives`).
 */

import { esc, plural, error } from "./utils.mjs";
import { drpgWindow, drpgConfirm, dataTable, tipAttr, emptyOption } from "./ui-kit.mjs";
import { keepLive } from "./live.mjs";
import { motiveStore } from "./gm-stores.mjs";
import { MOTIVE_KINDS, motivesOf, motivesEnabled, holdsMotives, levelUpReading, levelUpReason, chapterHasMotives, monokumaLog } from "./motives.mjs";
// The Monokuma Motive as each browser may read it (rules.mjs reaches nothing that reaches this file: R161).
import { motive, motiveForGm } from "./rules.mjs";

const L = key => game.i18n.localize(key);
const kindLabel = kind => L(kind === "personal" ? "DRPG.Motives.personal" : "DRPG.Motives.relationship");
const stateLabel = status => L(`DRPG.Motives.state.${status ?? "none"}`);

/** The roster, read where it lives (monokuma.mjs) by `import()`, as motives.mjs reads it. */
async function roster() {
    const { studentActors } = await import("./monokuma.mjs");
    return studentActors();
}

/* ==========================================================================
 * THE PERSONAL TAB
 * ========================================================================== */

/**
 * WHAT THE PERSONAL TAB SHOWS (R9347): `{ monokuma, own }` - `monokuma` the Monokuma Motive as this viewer may read it
 * (null for none, or for the dead and the Spectators), `own` whether the student's own motives are drawn (its owner and
 * the GMs, for a student who holds motives) with `personal` and `relationship` from `motivesOf`. Pure but for the
 * reads it is handed: `record` the Monokuma Motive (rules.mjs `motive()`, or `motiveForGm()` on a GM), `mode` the
 * sheet's (sheet-mode.mjs `sheetMode`), `holds` whether the student holds motives, `rows` `motivesOf(actor.id)`.
 */
export function personalTabReading({ record = null, mode = {}, holds = false, rows = null } = {}) {
    if (!motivesEnabled() || mode.monokuma || mode.spectator || mode.npc || mode.dead) return { monokuma: null, own: false, personal: null, relationship: null };
    const own = Boolean(mode.owner) && holds;
    return {
        monokuma: record ?? null,
        own,
        personal: own ? (rows?.personal ?? null) : null,
        relationship: own ? (rows?.relationship ?? null) : null
    };
}

/** The Monokuma Motive's block of the tab: its words or "unknown", its deadline and penalty. */
function monokumaBlock(record, { gm = false } = {}) {
    if (!record?.id) return `<p class="notes">${esc(L("DRPG.Motive.none"))}</p>`;
    const words = record.hidden
        ? (gm && record.hiddenText ? `<p>${esc(record.hiddenText)} <em class="notes">(${esc(L("DRPG.Motive.hiddenTag"))})</em></p>` : `<p><em>${esc(L("DRPG.Motive.unknown"))}</em></p>`)
        : `<p>${esc(record.text)}</p>`;
    const penaltyText = record.hidden ? (gm ? record.hiddenPenalty : "") : record.penalty;
    const left = !record.deadline ? "" : record.due ? L("DRPG.Motive.dueShort") : plural("DRPG.Motive.left", { n: Math.max(0, Number(record.remaining) || 0) });
    return `${words}${left ? `<p class="notes">${esc(left)}</p>` : ""}${penaltyText ? `<p class="notes">${esc(game.i18n.format("DRPG.Motive.penalty", { what: penaltyText }))}</p>` : ""}`;
}

/** One private motive's block: its words, who a Relationship Motive names, its state, the GM's reason, its buttons. */
function motiveBlock(actor, kind, motive, { gm = false, owner = false } = {}) {
    if (!motive) {
        return `<div class="drpg-motive" data-drpg-motive-kind="${kind}"><h5>${esc(kindLabel(kind))}</h5>
            <p class="notes">${esc(L("DRPG.Motives.notGiven"))}</p>${gm ? `<p>${editButton(actor)}</p>` : ""}</div>`;
    }
    const other = kind === "relationship" && motive.withActorId ? game.actors.get(motive.withActorId)?.name ?? "?" : null;
    const buttons = [];
    if (owner && !gm && ["open", "rejected"].includes(motive.status)) {
        buttons.push(`<button type="button" class="drpg-mini-button" data-drpg-motive-report="${kind}" data-actor="${actor.id}"${tipAttr("DRPG.Motives.tip.report")}>${esc(L("DRPG.Motives.report"))}</button>`);
    }
    if (gm) {
        buttons.push(editButton(actor));
        if (motive.status !== "done") buttons.push(`<button type="button" class="drpg-mini-button" data-drpg-motive-pass="${kind}" data-actor="${actor.id}"${tipAttr("DRPG.Motives.tip.pass")}>${esc(L("DRPG.Motives.pass"))}</button>`);
        if (motive.status === "reported") buttons.push(`<button type="button" class="drpg-mini-button" data-drpg-motive-reject="${kind}" data-actor="${actor.id}"${tipAttr("DRPG.Motives.tip.reject")}>${esc(L("DRPG.Motives.reject"))}</button>`);
    }
    return `<div class="drpg-motive" data-drpg-motive-kind="${kind}" data-drpg-motive-state="${esc(motive.status)}">
        <h5>${esc(kindLabel(kind))}${other ? ` <span class="notes">- ${esc(game.i18n.format("DRPG.Motives.with", { name: other }))}</span>` : ""}</h5>
        <p>${esc(motive.text)}</p>
        <p class="notes">${esc(game.i18n.format("DRPG.Motives.stateLine", { state: stateLabel(motive.status) }))}</p>
        ${motive.report ? `<p class="notes">${esc(game.i18n.format("DRPG.Motives.reportLine", { text: motive.report }))}</p>` : ""}
        ${motive.status === "rejected" && motive.reason ? `<p class="notes">${esc(game.i18n.format("DRPG.Motives.reasonLine", { text: motive.reason }))}</p>` : ""}
        ${buttons.length ? `<p>${buttons.join(" ")}</p>` : ""}
    </div>`;
}

const editButton = actor => `<button type="button" class="drpg-mini-button" data-drpg-motive-edit="${actor.id}"${tipAttr("DRPG.Motives.tip.edit")}>${esc(L("DRPG.Motives.edit"))}</button>`;

/** The tab's motives section, as markup (`injectMotives`). */
export function personalSectionHtml(actor, reading, { gm = false } = {}) {
    if (!reading.monokuma && !reading.own) return "";
    const own = reading.own
        ? (reading.personal || reading.relationship || gm
            ? MOTIVE_KINDS.map(kind => motiveBlock(actor, kind, reading[kind], { gm, owner: true })).join("")
            : `<p class="notes">${esc(L("DRPG.Motives.noneYet"))}</p>`)
        : "";
    return `<section class="drpg-motives" data-drpg-motives="${actor.id}">
        <h4>${esc(L("DRPG.Motives.title"))}</h4>
        <div class="drpg-motive drpg-motive-monokuma"><h5>${esc(L("DRPG.Motive.title"))}</h5>${monokumaBlock(reading.monokuma, { gm })}</div>
        ${own}
    </section>`;
}

/**
 * THE SHEET STEP (sheet.mjs `SHEET_STEPS`, "injectMotives"): the Biography tab's name in the tab bar made "Personal",
 * and the motives section drawn on top of the tab. Synchronous: what it reads is in memory (the setting, the store or
 * the copy, the roster through the sheet's mode).
 */
export function injectMotives(app, element, mode) {
    const tab = element?.querySelector?.('section[data-application-part="biography"]');
    if (!tab) return;
    relabelBiographyNav(element);
    tab.querySelector(":scope > .drpg-motives")?.remove();
    const actor = app?.document ?? null;
    if (!actor) return;
    const gm = Boolean(game.user?.isGM);
    const record = readMonokuma(gm);
    const holds = holdsMotives(actor, game.actors.filter(a => a.id === actor.id && !mode?.monokuma && !mode?.spectator && !mode?.npc));
    const reading = personalTabReading({ record, mode, holds, rows: holds && mode?.owner ? motivesOf(actor.id) : null });
    const html = personalSectionHtml(actor, reading, { gm });
    if (!html) return;
    tab.insertAdjacentHTML("afterbegin", html);
    wireSection(tab.querySelector(":scope > .drpg-motives"), actor);
}

/** The Monokuma Motive as this browser may read it: a GM's with a hidden one's words, a player's without. */
function readMonokuma(gm) {
    return gm ? motiveForGm() : motive();
}

/** The tab bar's Biography entry, named "Personal" (the tab's id stays `biography`). */
function relabelBiographyNav(element) {
    const nav = element.querySelector("nav.sheet-tabs, .sheet-tabs, nav.tabs");
    const link = nav?.querySelector('[data-tab="biography"]');
    if (!link || link.dataset.drpgPersonal) return;
    link.dataset.drpgPersonal = "1";
    const label = L("DRPG.Motives.tab");
    link.setAttribute("aria-label", label);
    link.dataset.tooltip = label;
    for (const node of link.childNodes) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
            node.textContent = ` ${label}`;
            return;
        }
    }
    const caption = link.querySelector("span");
    if (caption) caption.textContent = label;
    else if (!link.querySelector("i")) link.textContent = label;
}

/** The section's buttons: Report done (the owner), Edit, Pass, Reject (a GM). */
function wireSection(section, actor) {
    if (!section) return;
    section.addEventListener("click", event => {
        const button = event.target?.closest?.("button");
        if (!button || button.disabled) return;
        const d = button.dataset;
        if (d.drpgMotiveReport) void reportMotive(actor, d.drpgMotiveReport);
        else if (d.drpgMotiveEdit) void openStudentMotives(actor);
        else if (d.drpgMotivePass) void ruleMotive(actor, d.drpgMotivePass, true);
        else if (d.drpgMotiveReject) void ruleMotive(actor, d.drpgMotiveReject, false);
    });
}

/* ==========================================================================
 * A PLAYER'S REPORT, A GM'S RULING
 * ========================================================================== */

/** The owner reports `kind` done: "What did you do?", then `motive.report`. The words are a claim the GMs read. */
export async function reportMotive(actor, kind) {
    const answer = await drpgWindow({
        title: game.i18n.format("DRPG.Motives.reportTitle", { what: kindLabel(kind) }),
        classes: ["drpg-panel", "drpg-window-motive-report"], prompt: true,
        body: `<form><label>${esc(L("DRPG.Motives.reportLabel"))}
            <textarea name="text" rows="4" placeholder="${esc(L("DRPG.Motives.reportPlaceholder"))}"></textarea></label>
            <p class="notes">${esc(L("DRPG.Motives.reportNote"))}</p></form>`,
        footer: { primary: { action: "send", label: L("DRPG.Motives.reportSend"),
            callback: (e, b, dialog) => ({ text: dialog.element.querySelector("[name=text]")?.value ?? "" }) },
        close: { role: "cancel", action: "cancel" } },
        rejectClose: false
    }).catch(() => null);
    if (!answer || typeof answer !== "object") return false;
    const { requestMotiveReport } = await import("./bridge-asks.mjs");
    const res = await requestMotiveReport({ actorId: actor.id, kind, text: String(answer.text ?? "").trim() });
    if (res.ok) ui.notifications?.info?.(L("DRPG.Motives.reportSent"));
    return Boolean(res.ok);
}

/** A GM passes or rejects `kind` of `actor`'s motive (a reject asks for a reason, which may stay empty). */
export async function ruleMotive(actor, kind, pass) {
    let reason = "";
    if (!pass) {
        const answer = await drpgWindow({
            title: game.i18n.format("DRPG.Motives.rejectTitle", { name: actor.name, what: kindLabel(kind) }),
            classes: ["drpg-panel", "drpg-window-motive-reject"], prompt: true,
            body: `<form><label>${esc(L("DRPG.Motives.rejectLabel"))}<textarea name="reason" rows="3"${tipAttr("DRPG.Motives.tip.reason")}></textarea></label></form>`,
            footer: { primary: { action: "reject", label: L("DRPG.Motives.reject"),
                callback: (e, b, dialog) => ({ reason: dialog.element.querySelector("[name=reason]")?.value ?? "" }) },
            close: { role: "cancel", action: "cancel" } },
            rejectClose: false
        }).catch(() => null);
        if (!answer || typeof answer !== "object") return false;
        reason = String(answer.reason ?? "").trim();
    }
    const { requestMotiveRule } = await import("./bridge-asks.mjs");
    const res = await requestMotiveRule({ actorId: actor.id, kind, pass, reason });
    return Boolean(res.ok);
}

/** The GMs' card of a player's report: who, which motive, its words, the report, and Pass and Reject in its words. */
export function rulingCardHtml(actor, kind, motive) {
    const other = kind === "relationship" && motive?.withActorId ? game.actors.get(motive.withActorId)?.name ?? "?" : null;
    return `<div class="drpg-evidence-card drpg-motive-card" data-drpg-motive-card="${actor.id}">
        <p><strong>${esc(game.i18n.format("DRPG.Motives.cardTitle", { name: actor.name, what: kindLabel(kind) }))}</strong></p>
        <p>${esc(motive?.text ?? "")}${other ? ` <span class="notes">- ${esc(game.i18n.format("DRPG.Motives.with", { name: other }))}</span>` : ""}</p>
        <p class="notes">${esc(game.i18n.format("DRPG.Motives.reportLine", { text: motive?.report || L("DRPG.Motives.reportEmpty") }))}</p>
        <p class="drpg-call-actions"><button type="button" data-drpg-motive-rule="pass" data-actor="${actor.id}" data-kind="${kind}"${tipAttr("DRPG.Motives.tip.pass")}>${esc(L("DRPG.Motives.pass"))}</button>
            <button type="button" data-drpg-motive-rule="reject" data-actor="${actor.id}" data-kind="${kind}"${tipAttr("DRPG.Motives.tip.reject")}>${esc(L("DRPG.Motives.reject"))}</button></p>
    </div>`;
}

/**
 * The card's buttons, on a GM's render (`registerMotivesUi`): either rules once on the primary (`motive.rule`); a second
 * press, or a press on another GM's copy, is refused there as already passed, and the card's buttons go once pressed.
 */
export function wireRulingCard(body) {
    if (!game.user?.isGM || !body?.querySelectorAll) return;
    for (const button of body.querySelectorAll("[data-drpg-motive-rule]")) {
        if (button.dataset.drpgWired) continue;
        button.dataset.drpgWired = "1";
        button.addEventListener("click", async event => {
            event.preventDefault();
            if (button.disabled) return;
            const actor = game.actors.get(button.dataset.actor ?? "");
            if (!actor) return;
            const row = button.closest(".drpg-call-actions");
            for (const b of row?.querySelectorAll("button") ?? [button]) b.disabled = true;
            const done = await ruleMotive(actor, button.dataset.kind, button.dataset.drpgMotiveRule === "pass").catch(err => {
                error("Could not rule on a motive from its card", err);
                return false;
            });
            if (!done) for (const b of row?.querySelectorAll("button") ?? [button]) b.disabled = false;
            else row?.remove();
        });
    }
}

/* ==========================================================================
 * THE GMS' WINDOWS
 * ========================================================================== */

/**
 * One student's motives, written by a GM by hand (SPEC: "bez gotowych wzorow"): the Personal Motive's words, the
 * Relationship Motive's words and the other living student it names. A new motive over one given this chapter replaces
 * it, after the GM says so (#4). Saved through `motive.set` on the primary.
 */
export async function openStudentMotives(actor) {
    if (!game.user?.isGM || !actor) return null;
    const students = await roster();
    if (!holdsMotives(actor, students)) {
        ui.notifications?.warn?.(L("DRPG.Motives.holdsNone"));
        return null;
    }
    const now = motivesOf(actor.id);
    const others = students.filter(a => a.id !== actor.id && holdsMotives(a, students));
    const options = others.map(a => `<option value="${a.id}"${now.relationship?.withActorId === a.id ? " selected" : ""}>${esc(a.name)}</option>`).join("");
    const answer = await drpgWindow({
        title: game.i18n.format("DRPG.Motives.editTitle", { name: actor.name }),
        classes: ["drpg-panel", "drpg-window-motives-edit"], prompt: true,
        body: `<form>
            <p class="notes">${esc(L("DRPG.Motives.editNote"))}</p>
            <label>${esc(L("DRPG.Motives.personal"))}<textarea name="personal" rows="3">${esc(now.personal?.text ?? "")}</textarea></label>
            <label>${esc(L("DRPG.Motives.relationship"))}<textarea name="relationship" rows="3">${esc(now.relationship?.text ?? "")}</textarea></label>
            <label>${esc(L("DRPG.Motives.withLabel"))}<select name="withActorId">${emptyOption("DRPG.Motives.nobodyOption")}${options}</select></label>
        </form>`,
        footer: { primary: { action: "save", label: L("DRPG.Motives.save"), callback: (e, b, dialog) => {
            const f = dialog.element.querySelector("form");
            return { personal: f.querySelector("[name=personal]")?.value ?? "", relationship: f.querySelector("[name=relationship]")?.value ?? "",
                withActorId: f.querySelector("[name=withActorId]")?.value || null };
        } }, close: { role: "cancel", action: "cancel" } },
        rejectClose: false
    }).catch(() => null);
    if (!answer || typeof answer !== "object") return null;
    const { requestMotiveSet } = await import("./bridge-asks.mjs");
    const done = [];
    for (const kind of MOTIVE_KINDS) {
        const words = String(answer[kind] ?? "").trim();
        const was = now[kind];
        const sameWith = kind !== "relationship" || (was?.withActorId ?? null) === (answer.withActorId ?? null);
        if ((was?.text ?? "") === words && sameWith) continue;
        if (was && words && !(await drpgConfirm({ title: kindLabel(kind), body: `<p>${esc(L("DRPG.Motives.replaceQuestion"))}</p>`,
            yes: { label: L("DRPG.Motives.replace") } }).catch(() => false))) continue;
        const res = await requestMotiveSet({ actorId: actor.id, kind, text: words, withActorId: kind === "relationship" ? answer.withActorId : null });
        if (res.ok) done.push(kind);
    }
    return done;
}

/** The overview's body: the Monokuma Motive, the reports waiting, every student who holds motives. */
async function overviewBody() {
    const students = (await roster()).filter(a => holdsMotives(a, [a]));
    const record = motiveForGm();
    const cell = (actor, kind) => {
        const m = motivesOf(actor.id)[kind];
        return m ? `${esc(stateLabel(m.status))}${m.status === "reported" ? ` <button type="button" class="drpg-mini-button" data-drpg-motive-pass="${kind}" data-actor="${actor.id}"${tipAttr("DRPG.Motives.tip.pass")}>${esc(L("DRPG.Motives.pass"))}</button>` : ""}`
            : `<span class="notes">${esc(L("DRPG.Motives.state.none"))}</span>`;
    };
    const waiting = students.filter(a => MOTIVE_KINDS.some(kind => motivesOf(a.id)[kind]?.status === "reported"));
    const rows = [...waiting, ...students.filter(a => !waiting.includes(a))].map(a => ({
        id: a.id, name: esc(a.name), personal: cell(a, "personal"), relationship: cell(a, "relationship"),
        edit: editButton(a)
    }));
    return `<div class="drpg-motives-live">
        <section><h4>${esc(L("DRPG.Motive.title"))}</h4>${monokumaBlock(record, { gm: true })}</section>
        ${waiting.length ? `<p class="notes">${esc(plural("DRPG.Motives.waiting", { n: waiting.length }))}</p>` : ""}
        ${dataTable({ columns: [
            { key: "name", label: L("DRPG.Panel.character"), cls: "name" },
            { key: "personal", label: L("DRPG.Motives.personal") },
            { key: "relationship", label: L("DRPG.Motives.relationship") },
            { key: "edit", label: L("DRPG.Panel.doColumn") }
        ], rows, empty: "DRPG.Motives.nobody", rowAttrs: r => ({ "data-actor": r.id }) })}
    </div>`;
}

/** The GM panel's tile "Motives": the overview, drawn again as the store or the Monokuma Motive changes. */
export async function openMotivesOverview() {
    if (!game.user?.isGM) return null;
    const body = await overviewBody();
    let latest = body;
    return drpgWindow({
        title: L("DRPG.Motives.overviewTitle"),
        classes: ["drpg-panel", "drpg-window-motives"], fit: true,
        body,
        footer: { close: { role: "close", action: "close" } },
        render: (event, dialog) => {
            dialog.element?.addEventListener("click", ev => {
                const button = ev.target?.closest?.("button");
                const actor = game.actors.get(button?.dataset?.actor ?? button?.dataset?.drpgMotiveEdit ?? "");
                if (!button || !actor) return;
                if (button.dataset.drpgMotiveEdit) void openStudentMotives(actor);
                else if (button.dataset.drpgMotivePass) void ruleMotive(actor, button.dataset.drpgMotivePass, true);
            });
            // Heard until the window is closed: the first change after the close takes the listener off.
            const hook = Hooks.on("drpgMotivesChanged", () => {
                if (!dialog.rendered) return void Hooks.off("drpgMotivesChanged", hook);
                void overviewBody().then(html => { latest = html; Hooks.callAll("drpgMotivesOverviewDrawn"); });
            });
            return keepLive(dialog, { region: ".drpg-motives-live", build: () => latest,
                watch: { hooks: ["drpgMotivesOverviewDrawn"], stores: [motiveStore] } });
        },
        rejectClose: false
    });
}

/* ==========================================================================
 * THE STUDENTS WINDOW'S COLUMN (gm-students.mjs, the column last)
 * ========================================================================== */

/** The column "Motives" of the Students window: its header, appended last to `columns`. */
export function motiveColumn() {
    return { key: "motives", label: L("DRPG.Motives.column") };
}

/** A row's cell: "P: reported, R: open" and the button that opens the student's motives; empty for one who holds none. */
export function motiveCell(actor, students = []) {
    if (!motivesEnabled() || !actor || !holdsMotives(actor, students)) return "";
    const now = motivesOf(actor.id);
    const short = kind => game.i18n.format(kind === "personal" ? "DRPG.Motives.cellPersonal" : "DRPG.Motives.cellRelationship", { state: stateLabel(now[kind]?.status ?? "none") });
    return `<span class="drpg-motive-cell">${esc(short("personal"))}, ${esc(short("relationship"))}</span>
        ${editButton(actor)}`;
}

/** The column's buttons, wired once on the Students window's root (gm-students.mjs). */
export function wireMotiveColumn(root) {
    if (!root || root.dataset?.drpgMotivesWired) return;
    if (root.dataset) root.dataset.drpgMotivesWired = "1";
    root.addEventListener("click", event => {
        const button = event.target?.closest?.("[data-drpg-motive-edit]");
        if (!button) return;
        const actor = game.actors.get(button.dataset.drpgMotiveEdit);
        if (actor) void openStudentMotives(actor);
    });
}

/* ==========================================================================
 * THE LEVEL UP LIST AFTER A CLASS TRIAL (verdict.mjs, the step `motives`)
 * ========================================================================== */

/**
 * "Tick who did every motive": a row per survivor of the verdict, ticked where the record says (#6), with the reason;
 * the GM changes the ticks. Answers the actors ticked, `[]` for none, or null when the window was closed.
 */
export async function pickMotiveLevelUps(actors, { log = [], running = false } = {}) {
    const rows = actors.map(actor => {
        const reading = levelUpReading(motivesOf(actor.id), log, running);
        return { actor, reading, reason: levelUpReason(reading) };
    });
    const body = `<form><p class="notes">${esc(L("DRPG.Motives.levelUpNote"))}</p>
        ${rows.map(({ actor, reading, reason }) => `<label class="drpg-checkbox"><input type="checkbox" name="motive.${actor.id}"${reading.ticked ? " checked" : ""} />
            <strong>${esc(actor.name)}</strong> <span class="notes">${esc(reason)}</span></label>`).join("")}</form>`;
    const answer = await drpgWindow({
        title: L("DRPG.Motives.levelUpTitle"), classes: ["drpg-panel", "drpg-window-motive-levelups"], prompt: true, body,
        footer: { primary: { action: "give", label: L("DRPG.Motives.levelUpGive"), callback: (e, b, dialog) =>
            rows.filter(({ actor }) => dialog.element.querySelector(`[name="motive.${actor.id}"]`)?.checked).map(({ actor }) => actor.id) },
        close: { role: "cancel", action: "cancel" } },
        rejectClose: false
    }).catch(() => null);
    if (!Array.isArray(answer)) return null;
    return actors.filter(actor => answer.includes(actor.id));
}

/* ==========================================================================
 * REGISTRATION
 * ========================================================================== */

/** At init: the GMs' cards wired as drawn, and the open sheets drawn again when the motives change. */
export function registerMotivesUi() {
    Hooks.on("renderChatMessageHTML", (message, element) => {
        if (!game.user?.isGM) return;
        Promise.resolve().then(() => wireRulingCard(element?.querySelector?.(".message-content") ?? element))
            .catch(err => error("Could not wire a motive's card", err));
    });
    let pending = null;
    Hooks.on("drpgMotivesChanged", () => {
        if (pending) return;
        pending = setTimeout(() => {
            pending = null;
            redrawMotiveSheets().catch(err => error("Could not draw the motives on the open sheets", err));
        }, 120);
    });
}

/*
 * The open character sheets drawn again for a motive's change, which writes no actor (2.0 line T5): through each actor's
 * own sheets (sheet-mode.mjs `sheetsFor`, the actor's `apps`), the road a kept death's stamp takes (sheet.mjs
 * `redrawDeathMarks`). Until scenario 71 L read it on open sheets (28.11.2026) this was clock.mjs `refreshSheets`, which
 * walks `ui.windows` and `foundry.applications.instances`: the harness's sheet stands in `apps` alone, and the open sheets
 * on gm and p1 kept "not given" after the motives were written.
 */
async function redrawMotiveSheets() {
    const { sheetsFor } = await import("./sheet-mode.mjs");
    for (const actor of game.actors ?? []) {
        if (actor?.type !== "character") continue;
        for (const app of sheetsFor(actor)) app.render(false);
    }
}

/*
 * THE MOTIVES' LEVEL UP, A STEP OF THE VERDICT (2.0 line T5, D2-23 and D2-24, 27.11.2026; SPEC-MOTIVES.md "Przebieg
 * zaliczenia" 4-5; verdict.mjs `verdictMotives` hands it the survivors, `promptAdvancements` and `setTrialProgress`). After a
 * Class Trial the GM is asked who did every motive of the chapter - their Personal and Relationship Motives and every
 * Monokuma Motive of the chapter - and each one ticked takes one Level Up (`runAdvancementBatch`, the class's road,
 * "standard"); the verdict's own Level Ups are the steps above and below, unchanged (SPEC 5). The survivors of the verdict
 * are its rows (`verdictReading`: the dead hold no motives, #7), each ticked already where the record says they did
 * everything, with the reason in words (#6; motives.mjs `levelUpReading`, motives-ui.mjs `pickMotiveLevelUps`). A
 * chapter with no motive at all - the mechanics unused, the switch off - opens nothing and writes nothing but the
 * summary's line "No motives this chapter" (scenario 63 and Forge's s1b draw no new window). `motivesGiven`, written
 * after each row, keeps a Finish (`finishVerdict`) from giving one twice, as `given` does the class's. The Final Trial
 * has no such step (the line's question 8.6). The window closed gives nobody anything and the step is done.
 */
export async function verdictMotivesStep(context, { survivors: survivorsOf, promptAdvancements, setTrialProgress }) {
    if (!motivesEnabled() || !(await chapterHasMotives())) {
        context.lines.push(game.i18n.localize("DRPG.Motives.levelUpNone"));
        return;
    }
    const survivors = await survivorsOf();
    const given = new Set(context.record.motivesGiven ?? []);
    const rows = survivors.filter(actor => !given.has(actor.id) && holdsMotives(actor, survivors));
    if (!rows.length) return;
    const ticked = await pickMotiveLevelUps(rows, { log: monokumaLog(), running: Boolean(motive()) });
    if (!ticked?.length) {
        context.lines.push(game.i18n.localize("DRPG.Motives.levelUpNobody"));
        return;
    }
    const done = await promptAdvancements(ticked, "standard", {
        given: context.record.motivesGiven ?? [],
        onGiven: async actor => {
            context.record = { ...context.record, motivesGiven: [...(context.record.motivesGiven ?? []), actor.id] };
            await setTrialProgress({ verdict: context.record });
        }
    });
    if (done === null) throw new Error("the motives' Level Ups did not open");
    context.lines.push(plural("DRPG.Motives.levelUpGiven", { n: ticked.length }));
}
