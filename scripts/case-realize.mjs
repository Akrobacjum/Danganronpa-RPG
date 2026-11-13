/**
 * THE CASE'S REALIZATION AND THE QUESTION AT A BODY (E97 C10, C11, 12.11.2026; the owner's goal for E97: "the
 * realization has a preview and does nothing until the GM clicks Run realization; everything it creates gets a marker,
 * and Undo realization removes only what the players have not found yet. At Body found the GM gets a small window
 * asking about the realization - nothing happens by itself"; Q5, Q7, Q8 of 11.11).
 *
 * WHAT IT DOES. The Key Remnant plan's slots that are not on the map yet, within the chapter's limit (investigation.mjs
 * `caseKeyCount`), are placed by the planner's own road (`placeInSlot`: `createKeyRemnant` in a room's region, the slot
 * pointed at it) - each in the room the GM picks for it in the preview, since the plan holds no room (the Table's Place
 * asks in a window of its own for the same reason). A slot with no room picked is left as it is. Each placed Remnant is
 * marked in the chapter's meta row of the GMs' case store (`made`: its key -> the run and the slot), never on its token,
 * which every browser holds (world-secrets.mjs `flags.Token`).
 *
 * UNDO TAKES ONLY WHAT NOBODY FOUND (Q-E97-3's default): a marked Remnant no student holds a copy of (the dead
 * included: investigation.mjs `findersByAnyRemnant`) and that Monokuma's reveal did not show (`keyRevealRecord`) is
 * deleted by the road `clearChapterKeyRemnants` uses (its answer key first, then the token; `removeRemnant` refuses a
 * reinforced Key Remnant) and its slot freed; a found one stays, marked, and the GM is told how many.
 *
 * WHO (Q8: every GM, an Assistant too). TWO GMs PRESSING RUN (Q-E97-5): the plan's default asks the run of the primary
 * GM; this writes the run's id to the chapter's meta row first, lets the GMs' stores settle, and goes on only while the
 * row still names its own run - the later writer of the field wins on every GM (gm-store.mjs, a stamp per field), so
 * one of two runs stops before it places anything. Not a lock across a slow network: LIVE-E97-04.
 */
import { esc, error, placeRoomOptions, primaryGmId, plural } from "./utils.mjs";
import { bodiesFoundIn } from "./settings.mjs";
import { drpgWindow } from "./ui-kit.mjs";
import { caseRows, caseMetaOf, setCaseMeta, caseNodeOf, autopsiesDue, bodiesInOrder } from "./case-schema.mjs";
import { keyPlan, keyPlanStatus, caseKeyCount, placeInSlot, setKeyPlan, findersByAnyRemnant, keyRevealRecord, autopsyCount } from "./investigation.mjs";
import { remnantById, dropRemnantSecret } from "./remnants.mjs";
import { BODY_ANNOUNCED_HOOK } from "./chapter.mjs";
import { placeScenes, roomNames } from "./rooms.mjs";

const L = key => game.i18n.localize(key);
const F = (key, data) => game.i18n.format(key, data);

/**
 * WHAT A RUN WOULD DO (pure over its arguments): one line per Key plan slot - "create" (not on the map, within the
 * limit; the GM picks its room), "placed" (on the map already, by any road), "overLimit" (past the chapter's limit) -
 * `{ action, slot, name }`.
 */
export function realizationLines({ plan, status, limit }) {
    return (plan?.entries ?? []).map((entry, slot) => {
        const name = entry?.name || "";
        if (entry?.tokenId && status?.entries?.[slot]?.placed !== false) return { action: "placed", slot, name };
        if (limit !== null && limit !== undefined && slot >= limit) return { action: "overLimit", slot, name };
        return { action: "create", slot, name };
    });
}

/** The chapter's marks: `{ key: { run, slot } }` of what a run placed, read off its meta row. */
export function madeOf(chapter) {
    return caseMetaOf(caseRows(chapter).meta).made;
}

/** The preview's body: a table of the lines, a room picker on each line a run would create. */
function previewHtml(lines, plan = null) {
    /* Named by its column and its slot (E97 fix, 12.11.2026): a select in a table cell has no label of its own, and
       tier 2's "every control ... has a name to be read out" read it nameless once the preview had been opened. */
    const room = slot => `<select name="room:${slot}" aria-label="${esc(`${L("DRPG.CaseRealize.colRoom")}, ${F("DRPG.CaseMap.slotNumber", { n: slot + 1 })}`)}"><option value="">${esc(L("DRPG.CaseRealize.noRoom"))}</option>${placeRoomOptions({ room: plan?.entries?.[slot]?.room || null })}</select>`;
    const rows = lines.map(l => `<tr data-drpg-line="${l.action}"><td>${esc(L(`DRPG.CaseRealize.action.${l.action}`))}</td>`
        + `<td>${esc(F("DRPG.CaseMap.slotNumber", { n: l.slot + 1 }))}</td><td>${esc(l.name || L("DRPG.CaseMap.noName"))}</td>`
        + `<td>${l.action === "create" ? room(l.slot) : ""}</td></tr>`).join("");
    return `<p>${esc(L("DRPG.CaseRealize.intro"))}</p>`
        + `<table class="drpg-case-realize"><thead><tr><th>${esc(L("DRPG.CaseRealize.colWhat"))}</th><th>${esc(L("DRPG.CaseRealize.colSlot"))}</th>`
        + `<th>${esc(L("DRPG.CaseRealize.colName"))}</th><th>${esc(L("DRPG.CaseRealize.colRoom"))}</th></tr></thead><tbody>${rows}</tbody></table>`
        + `<p class="notes">${esc(L("DRPG.CaseRealize.undoNote"))}</p>`;
}

/* The preview's width (E64-inv round 2): its table and a footer of three in one row, measured in Chromium (the fit pass). */
const REALIZE_WIDTH = 720;

/**
 * THE PREVIEW'S FOOTER (C10; Q7: Close, the default and Enter's, and "Run realization", a state change never under
 * Enter). UNDO LIVES HERE (E64-inv, 12.11.2026; the owner's pick of the Investigation review): it was a destructive
 * button of the Investigation bar, pressed rarely and only after a run; it is this window's, shown only while a run's
 * marks stand (`made`, the count of `madeOf`), and asks first as before (`confirmUndoRealization`). Pure over its
 * arguments; exported for R3967.
 */
export function realizationFooter({ made = 0, run = null } = {}) {
    return {
        close: { role: "close", action: "close" },
        secondary: [{ action: "run", label: L("DRPG.CaseRealize.run"), class: "drpg-state-change", callback: run }],
        ...(made > 0 ? { destructive: [{ action: "undo", label: L("DRPG.CaseRealize.undo") }] } : {}),
        default: "close"
    };
}

/**
 * THE PREVIEW (C10). It writes nothing; Run hands the rooms picked to `runRealization`, Undo goes to its question.
 * Answers what was said, for the panel's line.
 */
export async function openRealization({ chapter = keyPlan().chapter } = {}) {
    if (!game.user?.isGM) return null;
    const plan = keyPlan();
    const lines = realizationLines({ plan, status: keyPlanStatus(), limit: caseKeyCount(plan.chapter) });
    /* A slot's planned room (13.11.2026) is its line's first choice; one no place scene has any more is said in one line,
       and its line starts on "leave it", as before. */
    const known = new Set(placeScenes().flatMap(scene => roomNames(scene)));
    for (const l of lines) {
        const room = l.action === "create" ? plan.entries[l.slot]?.room : "";
        if (room && !known.has(room)) ui.notifications.warn(F("DRPG.Investigation.plannedRoomGone", { room }));
    }
    const picks = await drpgWindow({
        title: F("DRPG.CaseRealize.title", { chapter }),
        classes: ["drpg-panel", "drpg-window-case-realize"],
        /* A stated width (E64-inv round 2, 12.11.2026): at the kit's default its table ran 521 px in a 510 px body under
           Monokuma Legacy, and with Undo its footer went to two rows and its body scrolled 12 px in Polish under Stained
           Glass at 1366x768 (audit/style-sweep.mjs `--fit`, STILL `case-realize--made`). */
        width: REALIZE_WIDTH,
        body: previewHtml(lines, plan),
        footer: realizationFooter({
            made: Object.keys(madeOf(chapter)).length,
            run: (event, button, dialog) => lines.filter(l => l.action === "create").map(l => {
                const select = dialog.element.querySelector(`[name="room:${l.slot}"]`);
                return { slot: l.slot, room: select?.value ?? "", sceneId: select?.selectedOptions?.[0]?.dataset.scene ?? "" };
            }).filter(p => p.room)
        }),
        rejectClose: false
    });
    if (picks === "undo") return confirmUndoRealization({ chapter });
    if (!Array.isArray(picks)) return null;
    const ran = await runRealization(chapter, picks);
    return ran ? F("DRPG.CaseRealize.ran", { n: ran.placed }) : L("DRPG.CaseRealize.notRun");
}

/** The run (C10): places each picked slot by the planner's road and marks it; answers `{ run, placed }` or null. */
export async function runRealization(chapter, picks = []) {
    if (!game.user?.isGM || !picks.length) return null;
    const run = foundry.utils.randomID(8);
    await setCaseMeta(chapter, { run });
    await new Promise(r => setTimeout(r, 300));
    if (caseMetaOf(caseRows(chapter).meta).run !== run) return null;
    const made = { ...madeOf(chapter) };
    let placed = 0;
    for (const pick of picks) {
        const plan = keyPlan();
        const entry = plan.entries[pick.slot];
        if (!entry || entry.tokenId) continue;
        const scene = game.scenes.get(pick.sceneId) ?? null;
        try {
            const token = await placeInSlot(plan, scene, { slot: pick.slot, room: pick.room, visibility: "evident",
                name: entry.name, text: entry.text, analysis: entry.analysis ?? "", note: entry.note });
            if (!token) continue;
            made[`${token.parent?.id ?? scene?.id}.${token.id}`] = { run, slot: pick.slot };
            placed++;
        } catch (err) { error("The realization could not place a Key Remnant", err); }
    }
    await setCaseMeta(chapter, { made });
    return { run, placed };
}

/**
 * UNDO (C10; Q5): each marked Remnant nobody found and Monokuma did not reveal is deleted and its slot freed; the rest
 * stay marked. Answers `{ removed, kept }`.
 */
export async function undoRealization(chapter = keyPlan().chapter) {
    if (!game.user?.isGM) return null;
    const made = madeOf(chapter);
    const finders = findersByAnyRemnant();
    const revealed = new Set(keyRevealRecord(chapter).revealed);
    const left = {};
    let removed = 0, kept = 0;
    for (const [key, mark] of Object.entries(made)) {
        const [sceneId, tokenId] = key.split(".");
        const token = remnantById(sceneId, tokenId);
        if (!token) continue;
        if ((finders.get(tokenId)?.size ?? 0) > 0 || revealed.has(tokenId) || revealed.has(String(mark.slot))) { left[key] = mark; kept++; continue; }
        await dropRemnantSecret(token);
        await token.parent.deleteEmbeddedDocuments("Token", [token.id]);
        const entries = [];
        entries[mark.slot] = { tokenId: null, sceneId: null };
        await setKeyPlan({ chapter, entries });
        removed++;
    }
    await setCaseMeta(chapter, { made: left, ...(Object.keys(left).length ? {} : { run: null }) });
    return { removed, kept };
}

/** Undo, asked first (the preview's footer, destructive, since E64-inv): answers what was said. */
export async function confirmUndoRealization({ chapter = keyPlan().chapter } = {}) {
    if (!game.user?.isGM) return null;
    const { drpgConfirm } = await import("./ui-kit.mjs");
    const n = Object.keys(madeOf(chapter)).length;
    if (!n) return L("DRPG.CaseRealize.nothingMade");
    const sure = await drpgConfirm({
        yes: { role: "destructive", label: L("DRPG.CaseRealize.undo") }, no: "cancel", title: L("DRPG.CaseRealize.undo"),
        classes: ["drpg-panel"], body: `<p>${esc(F("DRPG.CaseRealize.undoAsk", { n }))}</p>`
    });
    if (!sure) return null;
    const done = await undoRealization(chapter);
    return done ? F("DRPG.CaseRealize.undone", { removed: done.removed, kept: done.kept }) : null;
}

/**
 * THE QUESTION AT A BODY (C11; Q4: both roads, the primary GM alone, once a chapter). On the browser that wrote the
 * discovery (`writer`, the primary - body.mjs `runDiscovery` runs there on both roads), a payload not the suite's
 * rehearsal, a chapter with a case built (a schema row or a Key slot not yet on the map) whose realization has not
 * run and that was not asked yet: a small window, "Show the preview" or "Not now". Nothing is handed `waitUntil`: the
 * gather does not wait for it, and the window opens after the stamp. Answering writes `askedAt`, so a second body asks
 * nothing.
 */
export function registerCaseAsk() {
    /* the planned Autopsy goes out first, with no window (13.11.2026; `sendPlannedAutopsy`). On the primary GM alone,
       not on the discovery's writer: every discovery stamps on the primary today, but one stamped on another GM would
       then go out from nobody (perf-open's review for 1.2.111, section 2). `sending` and each one's sent mark keep it once. */
    Hooks.on(BODY_ANNOUNCED_HOOK, payload => {
        if (payload?.rehearsal === true || !game.user?.isGM || game.user.id !== primaryGmId()) return;
        sendPlannedAutopsy(payload.chapter).catch(err => error("The planned Autopsy could not be sent", err));
    });
    Hooks.on(BODY_ANNOUNCED_HOOK, payload => {
        if (!payload?.writer || payload.rehearsal === true || !game.user?.isGM || game.user.id !== primaryGmId()) return;
        setTimeout(() => { askAtBody(payload.chapter).catch(err => error("The case's question at a body failed", err)); }, 0);
    });
}

/** Whether `chapter` has something a realization would do and was not asked about (pure over the world's reads). */
export function shouldAskAtBody(chapter) {
    const { rows, meta } = caseRows(chapter);
    const m = caseMetaOf(meta);
    if (m.askedAt !== null || m.run !== null) return false;
    const plan = keyPlan();
    const pending = plan.chapter === chapter && realizationLines({ plan, status: keyPlanStatus(), limit: caseKeyCount(chapter) }).some(l => l.action === "create");
    return pending || Object.keys(rows).length > 0;
}

export async function askAtBody(chapter) {
    if (!game.user?.isGM || !Number.isInteger(chapter) || !shouldAskAtBody(chapter)) return null;
    await setCaseMeta(chapter, { askedAt: Date.now() });
    const answer = await drpgWindow({
        title: L("DRPG.CaseRealize.askTitle"),
        classes: ["drpg-panel", "drpg-window-case-ask"],
        body: `<p>${esc(L("DRPG.CaseRealize.askBody"))}</p>`,
        footer: { close: { role: "close", action: "later", label: L("DRPG.CaseRealize.notNow") },
            secondary: [{ action: "preview", label: L("DRPG.CaseRealize.showPreview") }], default: "later" },
        rejectClose: false
    });
    if (answer === "preview") return openRealization({ chapter });
    return null;
}

/**
 * THE PLANNED AUTOPSIES, SENT AT THE BODIES (the owner, 13.11.2026: "gracze dostaja od razu po odkryciu ciala. Bez kliku
 * GMa"; and "zaplanowane autopsy moga byc wiecej niz 1"). On the primary GM's browser, from the discovery's hook
 * (`registerCaseAsk`): each of the chapter's planned Autopsies that is due (case-schema.mjs `autopsiesDue`: of the
 * chapter's count, `autopsyCount`; with a name or words written; not sent; its body - the `atBody`-th found, its own
 * number by default - found, the bodies read off the chapter's stamps, `bodiesInOrder`), in order, goes to every
 * student not dead - the GM panel's window's own default (gm-items.mjs `issueAutopsyDialog`) - by the same road
 * (truth-bullets.mjs `issueAutopsy`: the answer key and the GM's note stay the GMs'), marked sent on the meta row
 * (`autopsySent`), and the GM told how many got it. A discovery of two bodies sends the two due. An Autopsy sent by
 * hand blocks none: the planned ones go out on their own bodies, and the GM may send more by hand whenever (the GM
 * panel's window fills in the next one planned and marks it sent, gm-items.mjs). Two calls at once send once
 * (`sending`). Answers how many students got one, over all sent.
 */
const sending = new Set();
export async function sendPlannedAutopsy(chapter) {
    if (!game.user?.isGM || game.user.id !== primaryGmId() || !Number.isInteger(chapter) || sending.has(chapter)) return 0;
    const { rows, meta } = caseRows(chapter);
    const due = autopsiesDue({ count: autopsyCount(chapter), rows, sent: caseMetaOf(meta).autopsySent,
        bodies: bodiesInOrder(bodiesFoundIn(chapter)).length });
    if (!due.length) return 0;
    sending.add(chapter);
    let total = 0;
    try {
        const [{ studentActors }, { isDeadForGm }, { issueAutopsy }, { TRUTH_BULLET_TYPES }] = await Promise.all([
            import("./monokuma.mjs"), import("./chapter.mjs"), import("./truth-bullets.mjs"), import("./config.mjs")]);
        for (const { id } of due) {
            const plan = caseNodeOf(caseRows(chapter).rows[id]);
            const living = studentActors().filter(a => !isDeadForGm(a));
            if (!plan || !living.length) break;
            const issued = await issueAutopsy(living, { name: plan.label || TRUTH_BULLET_TYPES.autopsy.label, playerText: plan.text, gmNote: plan.note ?? "" });
            if (!issued) continue;
            await setCaseMeta(chapter, { autopsySent: { ...caseMetaOf(caseRows(chapter).meta).autopsySent, [id]: Date.now() } });
            ui.notifications.info(plural("DRPG.CaseMap.autopsyWentOut", { n: issued }));
            total += issued;
        }
        return total;
    } finally {
        sending.delete(chapter);
    }
}
