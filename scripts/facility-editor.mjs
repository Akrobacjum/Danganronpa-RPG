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
import { esc, wholeNumber } from "./utils.mjs";
import { drpgWindow, stepper, toggle, tipAttr, tipText } from "./ui-kit.mjs";
import { roomActions, setRoomActions, setProjectFacility, projectFacilityOf } from "./facilities.mjs";

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

/** Open a room's editor on `scene`; Save writes the room's actions at once. Answers the actions written, or null. */
export async function editRoomActions(scene, room) {
    if (!game.user?.isGM || !scene || !room) return null;
    const result = await drpgWindow({
        title: game.i18n.format("DRPG.Facility.editor.roomTitle", { room }),
        classes: ["drpg-panel", "drpg-facility-window"],
        width: "tables",
        body: roomActionsBody(room, roomActions(scene, room)),
        footer: {
            primary: { action: "save", label: t("save"), callback: (e, b, d) => readRoomActions(d.element) },
            close: { role: "cancel", action: "cancel" }
        },
        rejectClose: false
    });
    if (!Array.isArray(result)) return null;
    return setRoomActions(scene, room, result);
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
        <div class="drpg-facility-line">${toggle({ name: "p.costsAction", checked: f.costsAction !== false, label: t("costsAction") })}</div>
        <div class="drpg-facility-line">
            ${select("p.life", FACILITIES.lifetimes.map(k => [k, t(`life.${k}`)]), life.kind, t("lifetime"), "DRPG.Tips.Setup.facilityLifetimeTooltip")}
            ${stepper({ name: "p.n", value: life.n ?? 1, min: 1, max: FACILITIES.maxLifetime, compact: true, attrs: { "aria-label": t("lifetimeN") } })}
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
        lifetime: { kind: value("p.life"), n: wholeNumber(value("p.n"), { fallback: 1 }) }
    };
}

/** Open a project's editor; Save gives the project its action, Remove takes it off. Answers what was written, or null. */
export async function editProjectFacility(project) {
    if (!game.user?.isGM || !project?.id) return null;
    const { facility } = await projectFacilityOf(project.id);
    const result = await drpgWindow({
        title: game.i18n.format("DRPG.Facility.editor.projectTitle", { project: project.name }),
        classes: ["drpg-panel", "drpg-facility-window"],
        width: "tables",
        body: projectFacilityBody(project, facility),
        footer: {
            primary: { action: "save", label: t("saveProject"), callback: (e, b, d) => readProjectFacility(d.element) },
            secondary: [{ action: "remove", label: t("remove"), tooltip: tipText("DRPG.Tips.Setup.facilityRemoveTooltip") }],
            close: { role: "cancel", action: "cancel" }
        },
        rejectClose: false
    });
    if (result === "remove") return setProjectFacility(project.id, null);
    if (!result || typeof result !== "object") return null;
    return setProjectFacility(project.id, result);
}
