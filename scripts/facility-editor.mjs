/**
 * Danganronpa RPG - the GM's editors of the room actions: a room's (Room Setup's Facilities tab) and a project's (the
 * project manager's row).
 * ---------------------------------------------------------------------------
 * E93 C2 (12.11.2026; the owner's audit entry E93 (2) and (4), the 08.11 switch; docs/dev/e93/SPEC.md). Both editors are
 * GM windows on the kit's frame; what they read off the form is cleaned again by facilities.mjs (`cleanActions`,
 * `cleanFacility`) as it is written, so a field typed past its limits is held to the closed list there, not here. A
 * room's actions are written at once on Save (`setRoomActions`), as Room Setup's search token buttons write at once; a
 * project's through its own step (`setProjectFacility`).
 */

import { FACILITIES, TRAITS } from "./config.mjs";
import { esc, wholeNumber, plural, listOf } from "./utils.mjs";
import { drpgWindow, stepper, toggle, tipAttr, tipText, wireSteppers } from "./ui-kit.mjs";
import { roomActions, setRoomActions, setProjectFacility, projectFacilityOf, cleanAction, cleanEffect, cleanFacility } from "./facilities.mjs";
import { stableJson } from "./gm-store.mjs";
import { projectSecretStore } from "./gm-stores.mjs";
import { keepFresh } from "./live.mjs";

const t = key => game.i18n.localize(`DRPG.Facility.editor.${key}`);

/** A `<select>` of `options` (`[value, label]`), `value` selected; `tip` the key of its tooltip (E102 C12: a line's
 *  fields have no visible label, only `aria-label`). */
function select(name, options, value, label, tip = "") {
    return `<select name="${esc(name)}" aria-label="${esc(label)}"${tipAttr(tip)}>${options.map(([v, text]) =>
        `<option value="${esc(v)}"${v === value ? " selected" : ""}>${esc(text)}</option>`).join("")}</select>`;
}

/** The statistics a GM's action may roll, by their module names. */
const traitOptions = () => Object.entries(TRAITS).map(([key, trait]) => [key, trait.label]);
/** The effects, "none" first. */
const kindOptions = () => [["", t("noEffect")], ...Object.keys(FACILITIES.effects).map(key => [key, game.i18n.localize(`DRPG.Facility.effect.${key}`)])];
/** Who an effect falls on. */
const scopeOptions = () => FACILITIES.scopes.map(key => [key, game.i18n.localize(`DRPG.Facility.scope.${key}`)]);
/** How long a timed effect lasts (the owner's answer to Q-E93-3): the ends a GM may pick in the editor. */
const untilOptions = () => ["timeOfDay", "day"].map(key => [key, game.i18n.localize(`DRPG.Facility.until.${key}`)]);

/** One action's effects as fields, `prefix.e<j>.<field>`, each effect on one line: a kind, its amount, its scope and its text. */
function effectFields(prefix, effects) {
    return Array.from({ length: FACILITIES.maxEffects }, (_, j) => {
        const e = effects?.[j] ?? {};
        const name = field => `${prefix}.e${j}.${field}`;
        return `<div class="drpg-facility-line drpg-facility-effect">
            ${select(name("kind"), kindOptions(), e.kind ?? "", `${t("effect")} ${j + 1}`, "DRPG.Tips.Setup.facilityEffectTooltip")}
            ${stepper({ name: name("n"), value: e.n ?? 1, min: 1, max: 10, compact: true,
                attrs: { "aria-label": `${t("amount")} ${j + 1}`, "data-tooltip": tipText("DRPG.Tips.Setup.facilityAmountTooltip") } })}
            ${select(name("scope"), scopeOptions(), e.scope ?? "self", `${t("scope")} ${j + 1}`, "DRPG.Tips.Setup.facilityScopeTooltip")}
            ${select(name("trait"), traitOptions(), e.trait ?? Object.keys(TRAITS)[0], `${t("trait")} ${j + 1}`, "DRPG.Tips.Setup.facilityEffectTraitTooltip")}
            ${select(name("until"), untilOptions(), e.until ?? "timeOfDay", `${t("until")} ${j + 1}`, "DRPG.Tips.Setup.facilityUntilTooltip")}
            <input type="text" name="${esc(name("text"))}" value="${esc(e.text ?? "")}" maxlength="${FACILITIES.maxText}"
                placeholder="${esc(t("textPlaceholder"))}" aria-label="${esc(`${t("text")} ${j + 1}`)}"${tipAttr("DRPG.Tips.Setup.facilityTextTooltip")} />
        </div>`;
    }).join("");
}

/** The effects read back off the form under `prefix`: a row with a kind, its amount, scope and text as typed. */
function readEffects(form, prefix) {
    const value = name => form.querySelector(`[name="${CSS.escape(name)}"]`)?.value ?? "";
    return Array.from({ length: FACILITIES.maxEffects }, (_, j) => ({
        kind: value(`${prefix}.e${j}.kind`), n: wholeNumber(value(`${prefix}.e${j}.n`), { fallback: 1 }), scope: value(`${prefix}.e${j}.scope`),
        text: value(`${prefix}.e${j}.text`), trait: value(`${prefix}.e${j}.trait`), until: value(`${prefix}.e${j}.until`)
    })).filter(e => e.kind);
}

/**
 * The body of a room's editor: one row per action, the room's own and blank ones up to two more (at most
 * `FACILITIES.maxActions`); an action with no name is dropped on Save. Pure but for the language.
 */
export function roomActionsBody(room, actions) {
    const count = Math.min(FACILITIES.maxActions, actions.length + 2);
    const blocks = Array.from({ length: count }, (_, i) => {
        const a = actions[i] ?? {};
        const p = `a${i}`;
        return `<fieldset class="drpg-facility-action">
            <legend>${esc(game.i18n.format("DRPG.Facility.editor.actionN", { n: i + 1 }))}</legend>
            <div class="drpg-facility-line">
                <input type="hidden" name="${p}.id" value="${esc(a.id ?? "")}" />
                <input type="text" name="${p}.label" value="${esc(a.label ?? "")}" maxlength="${FACILITIES.maxLabel}"
                    placeholder="${esc(t("labelPlaceholder"))}" aria-label="${esc(`${t("label")} ${i + 1}`)}"${tipAttr("DRPG.Tips.Setup.facilityNameTooltip")} />
                ${select(`${p}.trait`, traitOptions(), a.trait ?? Object.keys(TRAITS)[0], `${t("trait")} ${i + 1}`, "DRPG.Tips.Setup.facilityRollTraitTooltip")}
                ${stepper({ name: `${p}.dc`, value: a.dc ?? FACILITIES.defaultDc, min: FACILITIES.dc.min, max: FACILITIES.dc.max, compact: true,
                    attrs: { "aria-label": `${t("dc")} ${i + 1}`, "data-tooltip": tipText("DRPG.Tips.Setup.facilityDcTooltip") } })}
            </div>
            ${effectFields(p, a.effects)}
        </fieldset>`;
    }).join("");
    return `<div class="drpg-facility-editor">
        <p>${esc(game.i18n.format("DRPG.Facility.editor.roomIntro", { room }))}</p>
        ${blocks}
        <p class="notes">${esc(t("roomNote"))}</p>
    </div>`;
}

/** The actions read back off a room's editor (`form`: the window, or any element holding its fields), before cleaning (`setRoomActions` cleans them). */
export function readRoomActions(form) {
    const value = name => form.querySelector(`[name="${CSS.escape(name)}"]`)?.value ?? "";
    const out = [];
    for (let i = 0; i < FACILITIES.maxActions; i++) {
        if (!form.querySelector(`[name="a${i}.label"]`)) break;
        out.push({ id: value(`a${i}.id`) || null, label: value(`a${i}.label`), trait: value(`a${i}.trait`), dc: wholeNumber(value(`a${i}.dc`), { fallback: FACILITIES.defaultDc }),
            effects: readEffects(form, `a${i}`) });
    }
    return out;
}

/*
 * WHAT SAVE DOES NOT KEEP IS SAID (the audit's CTRL-71, 1.2.122, 21.11.2026). The cleaning drops an action with no name and
 * an effect of a kind that needs its text with none (facilities.mjs `cleanAction`, `cleanEffect`), and the window closed on
 * Save with no word of it. `droppedLines` counts what the GM typed and the cleaning refuses - a row left wholly blank, as
 * the editor draws two, is no line - and Save tells it.
 */
export function droppedLines(raw) {
    let n = 0;
    for (const action of Array.isArray(raw) ? raw : []) {
        const effects = Array.isArray(action?.effects) ? action.effects : [];
        if (!cleanAction(action)) { if (effects.length) n++; continue; }
        n += effects.filter(e => !cleanEffect(e)).length;
    }
    return n;
}

/*
 * ANOTHER GM'S SAVE, NOT WRITTEN OVER (the audit's REFR-58, 1.2.122, 21.11.2026). Each editor is drawn once and its Save
 * wrote the whole list, so the second of two GMs to press Save took out the first one's new action with neither told.
 * The window is not redrawn under the GM's hands (its form is the whole window); at Save the room's list is read again,
 * and an action another GM added meanwhile - an id the window did not open with - is kept beside this GM's and named.
 * Pure: answers `{ list, kept }`.
 */
export function mergedRoomActions(saved, openedIds, now) {
    const list = Array.isArray(saved) ? [...saved] : [];
    const kept = (Array.isArray(now) ? now : []).filter(a => a?.id && !openedIds.has(a.id) && !list.some(b => b?.id === a.id));
    return { list: [...list, ...kept].slice(0, FACILITIES.maxActions), kept };
}

/*
 * THE EDITOR FOLLOWS ANOTHER GM'S SAVE, WHAT IS TYPED KEPT (the audit's REFR-58, 1.2.122, 21.11.2026; the owner's rule of
 * every window). Both editors were drawn once: a Save made elsewhere while one stood open was not shown, and the merge at
 * Save (`mergedRoomActions`, the savedOver toast) was all that kept the other GM's work. `followSaved` draws the editor
 * again whenever what it edits changes - the room's region flag, the project's meta or its GMs' half - and puts back each
 * field the GM had changed and not saved (a text or number against the value it was drawn with, a select against its
 * drawn option, a switch against its drawn tick), with the focus and its caret: a field the GM is writing in wins over the
 * other GM's value of it, since this GM's Save writes it either way. `keyOf` says which field is which across a redraw:
 * by its name, and in a room's editor by its action's id, so a row the other GM added or removed above does not move
 * what was typed onto another action (the blank rows by their order among the blank rows).
 */
function changedFields(root, keyOf, all = false) {
    const out = new Map();
    for (const f of root.querySelectorAll("[name]")) {
        if (f.type === "hidden") continue;
        const changed = all || (f.type === "checkbox" ? f.checked !== f.defaultChecked
            : f.tagName === "SELECT" ? [...f.options].some(o => o.selected !== o.defaultSelected)
                : f.value !== f.defaultValue);
        if (changed) out.set(keyOf(f), f.type === "checkbox" ? f.checked : f.value);
    }
    return out;
}

function followSaved(dialog, { read, body, keyOf = f => f.name, watch, redrawn = () => {}, drewDraft = false }) {
    let drawn = stableJson(read() ?? null);
    // A window opened again on what a refused Save had typed (`editProjectFacility`'s draft) drew that as its values: all
    // of it is the GM's typing, kept whole by the first redraw.
    let allTyped = drewDraft;
    keepFresh(dialog, { watch, run: el => {
        const now = read() ?? null;
        const key = stableJson(now);
        if (key === drawn) return;
        const editor = el?.querySelector?.(".drpg-facility-editor");
        if (!editor) return;
        const typed = changedFields(editor, keyOf, allTyped);
        allTyped = false;
        const active = editor.contains(document.activeElement) && document.activeElement.name
            ? { key: keyOf(document.activeElement), start: document.activeElement.selectionStart ?? null, end: document.activeElement.selectionEnd ?? null } : null;
        const holder = document.createElement("div");
        holder.innerHTML = body(now);
        const fresh = holder.firstElementChild;
        editor.replaceWith(fresh);
        for (const f of fresh.querySelectorAll("[name]")) {
            const k = keyOf(f);
            if (typed.has(k)) {
                if (f.type === "checkbox") f.checked = typed.get(k);
                else f.value = typed.get(k);
            }
            if (active && k === active.key) {
                f.focus({ preventScroll: true });
                try { if (active.start !== null) f.setSelectionRange(active.start, active.end); } catch { /* not a text field */ }
            }
        }
        wireSteppers(fresh);
        drawn = key;
        redrawn(now);
    } });
}

/** A room editor's field by its action: `<id>.<field>` for a saved action, `new<k>.<field>` for the k-th blank row. */
function roomFieldKey(f) {
    const row = f.closest?.("fieldset.drpg-facility-action");
    const tail = String(f.name ?? "").replace(/^a\d+\./, "");
    const id = row?.querySelector('input[type="hidden"][name$=".id"]')?.value;
    if (id) return `${id}.${tail}`;
    const blanks = [...(row?.parentElement?.querySelectorAll("fieldset.drpg-facility-action") ?? [])]
        .filter(r => !r.querySelector('input[type="hidden"][name$=".id"]')?.value);
    return `new${blanks.indexOf(row)}.${tail}`;
}

/** Open a room's editor on `scene`; Save writes the room's actions at once. Answers the actions written, or null. */
export async function editRoomActions(scene, room) {
    if (!game.user?.isGM || !scene || !room) return null;
    let opened = new Set(roomActions(scene, room).map(a => a.id));
    const result = await drpgWindow({
        title: game.i18n.format("DRPG.Facility.editor.roomTitle", { room }),
        classes: ["drpg-panel", "drpg-facility-window"],
        width: "tables",
        body: roomActionsBody(room, roomActions(scene, room)),
        footer: {
            primary: { action: "save", label: t("save"), tooltip: tipText("DRPG.Tips.Sweep.Setup.facilitySaveRoomTooltip"), callback: (e, b, d) => readRoomActions(d.element) },
            close: { role: "cancel", action: "cancel" }
        },
        // What the window shows is what Save merges against: a redraw moves `opened` to the actions it drew.
        render: (event, dialog) => followSaved(dialog, { read: () => roomActions(scene, room), keyOf: roomFieldKey,
            body: now => roomActionsBody(room, now ?? []), watch: { hooks: ["updateRegion", "createRegion", "deleteRegion"] },
            redrawn: now => { opened = new Set((now ?? []).map(a => a.id)); } }),
        rejectClose: false
    });
    if (!Array.isArray(result)) return null;
    const dropped = droppedLines(result);
    const { list, kept } = mergedRoomActions(result, opened, roomActions(scene, room));
    const written = await setRoomActions(scene, room, list);
    if (written && dropped) ui.notifications.warn(plural("DRPG.Facility.editor.dropped", { n: dropped }));
    if (written && kept.length) ui.notifications.info(game.i18n.format("DRPG.Facility.editor.keptOthers", { items: listOf(kept.map(a => a.label)) }));
    return written;
}

/** The body of a project's editor: its action's name, effects, whether it costs an action, and its lifetime. */
export function projectFacilityBody(project, facility) {
    const f = facility ?? {};
    const life = f.lifetime ?? { kind: "forever" };
    return `<div class="drpg-facility-editor">
        <p>${esc(game.i18n.format("DRPG.Facility.editor.projectIntro", { project: project.name }))}</p>
        <div class="drpg-facility-line">
            <input type="text" name="p.label" value="${esc(f.label ?? "")}" maxlength="${FACILITIES.maxLabel}"
                placeholder="${esc(t("labelPlaceholder"))}" aria-label="${esc(t("label"))}"${tipAttr("DRPG.Tips.Setup.facilityNameTooltip")} />
        </div>
        ${effectFields("p", f.effects)}
        <div class="drpg-facility-line">${toggle({ name: "p.costsAction", checked: f.costsAction !== false, label: t("costsAction"),
            attrs: { "data-tooltip": tipText("DRPG.Tips.Sweep.Setup.facilityCostsActionTooltip") } })}</div>
        <div class="drpg-facility-line">
            ${select("p.life", FACILITIES.lifetimes.map(k => [k, t(`life.${k}`)]), life.kind, t("lifetime"), "DRPG.Tips.Setup.facilityLifetimeTooltip")}
            ${stepper({ name: "p.n", value: life.n ?? 1, min: 1, max: FACILITIES.maxLifetime, compact: true,
                attrs: { "aria-label": t("lifetimeN"), "data-tooltip": tipText("DRPG.Tips.Setup.facilityLifetimeTooltip") } })}
        </div>
        <div class="drpg-facility-line">
            ${select("p.limit", FACILITIES.limits.map(k => [k, t(`limits.${k}`)]), f.limit ?? FACILITIES.defaultLimit, t("limit"), "DRPG.Tips.Setup.facilityLimitTooltip")}
        </div>
        <p class="notes">${esc(t("projectNote"))}</p>
    </div>`;
}

/** A project's action read back off its editor, before cleaning (`setProjectFacility` cleans it). */
export function readProjectFacility(form) {
    const value = name => form.querySelector(`[name="${CSS.escape(name)}"]`)?.value ?? "";
    return {
        label: value("p.label"), effects: readEffects(form, "p"),
        costsAction: Boolean(form.querySelector('[name="p.costsAction"]')?.checked),
        lifetime: { kind: value("p.life"), n: wholeNumber(value("p.n"), { fallback: 1 }) },
        limit: value("p.limit")
    };
}

/**
 * Open a project's editor; Save gives the project its action, Remove takes it off. Answers what was written, or null.
 * A Save with no name writes nothing, says so and opens the editor again on what was typed (`draft`; CTRL-71, 1.2.122);
 * one made after another GM changed the action meanwhile says that it was saved over theirs (REFR-58, 1.2.122).
 */
export async function editProjectFacility(project, { draft = null } = {}) {
    if (!game.user?.isGM || !project?.id) return null;
    const { facility: stored } = await projectFacilityOf(project.id);
    const facility = draft ?? stored;
    let opened = stableJson(stored ?? null);
    const result = await drpgWindow({
        title: game.i18n.format("DRPG.Facility.editor.projectTitle", { project: project.name }),
        classes: ["drpg-panel", "drpg-facility-window"],
        width: "tables",
        body: projectFacilityBody(project, facility),
        footer: {
            primary: { action: "save", label: t("saveProject"), tooltip: tipText("DRPG.Tips.Sweep.Setup.facilitySaveProjectTooltip"), callback: (e, b, d) => readProjectFacility(d.element) },
            secondary: [{ action: "remove", label: t("remove"), tooltip: tipText("DRPG.Tips.Setup.facilityRemoveTooltip") }],
            close: { role: "cancel", action: "cancel" }
        },
        // Redrawn on the meta and on the GMs' half of a secret project (the store `projectSecretStore`, projects-secrecy.mjs
        // `secretsOf`); a redraw moves `opened`, so a Save after it is
        // "saved over theirs" only for a change the window did not show.
        render: (event, dialog) => followSaved(dialog, { read: () => projectFacilityOf(project.id).facility,
            body: now => projectFacilityBody(project, now), watch: { settings: ["projectMeta"], stores: [projectSecretStore] }, drewDraft: Boolean(draft),
            redrawn: now => { opened = stableJson(now ?? null); } }),
        rejectClose: false
    });
    if (result === "remove") return setProjectFacility(project.id, null);
    if (!result || typeof result !== "object") return null;
    if (!cleanFacility(result)) {
        ui.notifications.warn(t("needsName"));
        return editProjectFacility(project, { draft: result });
    }
    const dropped = droppedLines([{ ...result, id: null }]);
    const changed = stableJson((await projectFacilityOf(project.id)).facility ?? null) !== opened;
    const written = await setProjectFacility(project.id, result);
    if (written && dropped) ui.notifications.warn(plural("DRPG.Facility.editor.dropped", { n: dropped }));
    if (written && changed) ui.notifications.info(t("savedOver"));
    return written;
}
