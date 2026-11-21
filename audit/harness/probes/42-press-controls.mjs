/**
 * Probe: every control of every window probe 08 opens, pressed once, and what the press did (the audit of 1.2.118,
 * 20.11.2026; audit/AUDIT-1.2.42.md section 15, the controls pass).
 * ---------------------------------------------------------------------------
 *     node cluster.mjs probes/42-press-controls.mjs                  (from audit/harness)
 *
 * WHAT IT ASKS. The owner's words of 20.11.2026: look for buttons and functions that do not work. A reader can follow a
 * label to its handler in the source; this probe is the other half, a press. For each window of probe 08's list
 * (`WINDOWS`, opened the same way: the same opener, seeds and steps, on the same client) it lists what a person could
 * press in the drawn window - every `button`, link, tab, `summary`, element with `data-action` or a role of a button,
 * and every element the module hung a `click` listener on while the window was drawn (read by wrapping
 * `addEventListener` for the time of the draw) - and then, for each one, opens the window fresh, presses that one
 * control and writes down what it saw in the next 0.9 s (and 1.2 s more when it saw nothing): the window closed, another
 * window opened (its title), the window's text or the control itself changed, the opener answered, a notice was shown,
 * a file was offered, the focus moved, the server took a document write, a setting write or a socket packet (the
 * cluster's own logs, read around the press), or something threw (`__errors`, and `console.error` counted for the time
 * of the press). A press that showed none of these is written `nothing`: a candidate for a dead control, to be read in
 * the source, not a verdict. A window with the kit's tab bar is walked once per tab, so a control on a pane that is not
 * showing is pressed where it shows.
 *
 * WHAT IT DOES NOT ASK, AND WHERE IT IS BLIND.
 * - It asserts nothing (probes/README.md): its rows are readings.
 * - jsdom draws no layout and applies almost no CSS: a control hidden or covered by a stylesheet rule is pressed here
 *   and could not be at a table, and one disabled only by `pointer-events` is pressed too. `disabled`, `hidden` and
 *   `aria-disabled` are honoured: such a control is listed with the reason and not pressed.
 * - Repeated controls of a table's or a list's rows are pressed once a kind (the first row's), and the count of the
 *   rest is written (`alike`); at most MAX_PRESSES presses a window, the rest listed as `capped`.
 * - Only what probe 08 opens: 08's list is the windows an opener opens with no state built first, about half of the
 *   162 in docs/dev/e59/WINDOWS.md. Windows a press opens are not walked in turn.
 * - Fields (inputs, selects, text areas) are counted, not pressed: a field does nothing until its window is saved.
 * - A press whose whole effect is a sound, a tooltip, the clipboard, a scroll or Foundry's own file picker shows as
 *   `nothing` here, and so does a stepper already at its end.
 * - The harness's DialogV2 is a stand-in (lib/shim.mjs): what Foundry's own window chrome does is not here.
 *
 * THE WORLD. A press can write (Save, Apply, a tile that starts something). Before the first window the GM's world is
 * recorded with tier 2's own `snapshot` and after every press that reached the server (a document or a setting write)
 * it is put back with `restore` (scripts/tests-tier2.mjs, as the suite's runner does: the incident ended, the stores
 * idle, then the restore). A control is found again on each fresh draw by what it is (its tag, place, action, label and
 * data), not by its position; one the fresh draw does not hold is written `not-pressed` with the reason. What the dump
 * (tests-kit.mjs `worldDump`) still shows different after the last window is written in the evidence, not assumed away.
 *
 * Options: DRPG_PRESS_ONLY=id,id (only those windows of WINDOWS, their tabs with them);
 *          DRPG_PRESS_OUT=<file> (the evidence also written there as JSON, resolved from audit/harness, after every
 *          window, so a run whose client dies still leaves what it read). Each window is caught on its own: one that
 *          throws is written `notWalked` with the error and the next one runs. Every `nothing` press is named in its
 *          window's note and listed in the evidence's `nothing`.
 */
import fs from "node:fs";
import path from "node:path";
import { WINDOWS } from "./08-capture-windows.mjs";

export const layers = ["probe"];

const ONLY = (process.env.DRPG_PRESS_ONLY ?? "").split(",").map(id => id.trim()).filter(Boolean);
const OUT = process.env.DRPG_PRESS_OUT ? path.resolve(process.env.DRPG_PRESS_OUT) : null;
const MAX_PRESSES = 45;

/* ---- what runs on a client: functions kept as source and handed over whole ---- */

/** What a person could press in a drawn window, in document order, each with a row that describes it. */
function controlsOf(app, clicks) {
    const root = app.element;
    const all = [...root.querySelectorAll("*")];
    const picked = new Set(root.querySelectorAll('button, a[href], a[data-action], [role="button"], [role="tab"], [role="menuitem"], [data-action], summary'));
    for (const el of all) if (clicks.has(el)) picked.add(el);
    const nodes = all.filter(el => picked.has(el));
    const label = el => (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || el.getAttribute("data-tooltip") || "").replace(/\s+/g, " ").trim().slice(0, 90);
    const lists = [...root.querySelectorAll("table, ul, ol, .drpg-table, [data-drpg-rows]")];
    return nodes.map((el, index) => {
        const holds = nodes.some(n => n !== el && el.contains(n));
        const where = el.closest("footer") ? "footer" : el.closest("nav") ? "nav" : el.closest("header") ? "header" : "body";
        const off = el.disabled ? "disabled" : (el.hidden || el.closest("[hidden]")) ? "hidden"
            : el.getAttribute("aria-disabled") === "true" ? "aria-disabled" : null;
        const row = el.closest("tr, li");
        const list = row ? lists.findIndex(l => l.contains(row)) : -1;
        const shape = [el.tagName, el.dataset?.action ?? "", [...el.classList].filter(c => !/^(active|is-|default$)/.test(c)).sort().join("."),
            Object.keys(el.dataset ?? {}).sort().join(",")].join("|");
        const data = Object.entries(el.dataset ?? {}).filter(([k]) => !/^tooltip/.test(k)).map(([k, v]) => `${k}=${String(v).slice(0, 40)}`).slice(0, 6);
        return { el, row: {
            index, tag: el.tagName.toLowerCase(), where, label: label(el), action: el.dataset?.action ?? null, data,
            classes: [...el.classList].slice(0, 6), off, holds, own: clicks.has(el),
            showing: el.getAttribute("role") === "tab" && el.getAttribute("aria-selected") === "true",
            kind: row && list >= 0 ? `row|${list}|${shape}` : `one|${index}`,
            sign: [el.tagName, where, el.dataset?.action ?? "", label(el), data.join("&")].join("|")
        } };
    }).map((c, i, every) => { c.row.nth = every.slice(0, i).filter(o => o.row.sign === c.row.sign).length; return c; });
}

/** A drawn window as a reader would tell two states of it apart: its words, its fields' values, its controls' states. */
export function stateOf(el) {
    if (!el?.isConnected) return "gone";
    const words = el.textContent.replace(/\s+/g, " ").trim();
    const fields = [...el.querySelectorAll("input, select, textarea")].map(f => `${f.name || f.id || f.type}=${f.type === "checkbox" || f.type === "radio" ? f.checked : f.value}`).join("&");
    const marks = [...el.querySelectorAll('button, [role="tab"], details, [aria-pressed], [aria-selected], [aria-expanded], [hidden]')]
        .map(b => `${b.disabled ? "d" : ""}${b.hidden ? "h" : ""}${b.open ? "o" : ""}${b.getAttribute("aria-pressed") ?? ""}${b.getAttribute("aria-selected") ?? ""}${b.getAttribute("aria-expanded") ?? ""}${b.classList.contains("active") ? "a" : ""}`).join("");
    return `${words}\u0001${fields}\u0001${marks}\u0001${el.querySelectorAll("*").length}`;
}

const SHARED = `const controlsOf = ${controlsOf.toString()};\n    const stateOf = ${stateOf.toString()};`;

/* Opens the window as probe 08's `capture` does and leaves it open, its state on `globalThis.__probe42`. */
export const open = (repoUrl, w) => `
    const repoUrl = "${repoUrl}";
    ${SHARED}
    const rest = globalThis.__probe42rest ??= new Set(foundry.applications.instances.keys());
    for (const a of [...foundry.applications.instances.values()]) if (!rest.has(a.id)) { try { await a.close(); } catch {} }
    const P = globalThis.__probe42 = { before: new Set(foundry.applications.instances.keys()),
        keep: { windows: globalThis.__dialogWindows, answers: [...globalThis.__dialogAnswers] },
        answered: "pending", threw: null, app: null, clicks: new Set(), consoleErrors: [] };
    globalThis.__dialogWindows = true;
    globalThis.__dialogAnswers.length = 0;
    const ET = document.defaultView.EventTarget.prototype;
    P.add = ET.addEventListener;
    ET.addEventListener = function (type, fn, opts) { if (type === "click" && this?.nodeType === 1) P.clicks.add(this); return P.add.call(this, type, fn, opts); };
    P.consoleError = console.error;
    console.error = (...args) => { P.consoleErrors.push(args.map(a => String(a?.message ?? a)).join(" ").slice(0, 240)); return P.consoleError.apply(console, args); };
    try {
        ${w.before ?? ""}
        const m = await import("${repoUrl}/scripts/${w.module}");
        Promise.resolve(${w.call}).then(v => { P.answered = v === null ? "null" : v === undefined ? "undefined" : typeof v; }, err => { P.threw = String(err?.stack ?? err).slice(0, 400); });
    } catch (err) { P.threw = String(err?.stack ?? err).slice(0, 400); }
    for (let i = 0; i < 60 && !P.app && !P.threw; i++) {
        await new Promise(r => setTimeout(r, 50));
        P.app = [...foundry.applications.instances.values()].find(a => !P.before.has(a.id) && a.element?.isConnected) ?? null;
    }
    await new Promise(r => setTimeout(r, 150));
    const tab = ${JSON.stringify(w.open ?? null)};
    if (P.app && tab) {
        P.app.element.querySelector(\`nav.drpg-tabs > button[data-drpg-tab-key="\${tab}"]\`)?.click();
        await new Promise(r => setTimeout(r, 150));
    }
    const click = ${JSON.stringify(w.click ?? null)};
    for (const selector of P.app && click ? [].concat(click) : []) {
        P.app.element.querySelector(selector)?.click();
        await new Promise(r => setTimeout(r, 300));
    }
    const waitFor = ${JSON.stringify(w.waitFor ?? null)};
    for (let i = 0; P.app && waitFor && i < 120 && !P.app.element.querySelector(waitFor); i++) await new Promise(r => setTimeout(r, 50));
    const press = ${JSON.stringify(w.press ?? null)};
    if (P.app && press) {
        const step = new Set(foundry.applications.instances.keys());
        const button = P.app.element.querySelector(\`[data-action="\${press}"]\`);
        let next = null;
        if (button) {
            button.click();
            for (let i = 0; i < 60 && !next; i++) {
                await new Promise(r => setTimeout(r, 50));
                next = [...foundry.applications.instances.values()].find(a => !step.has(a.id) && a.element?.isConnected) ?? null;
            }
        }
        if (!next) P.threw = button ? \`pressing "\${press}" opened no window\` : \`no button "\${press}" in the first window\`;
        P.app = next;
        await new Promise(r => setTimeout(r, 150));
    }
    const list = P.app ? controlsOf(P.app, P.clicks) : [];
    return { opened: !!P.app, title: P.app?.title ?? null, classes: P.app ? [...P.app.element.classList].filter(c => /^drpg-window-/.test(c)) : [],
        threw: P.threw, answered: P.answered, controls: list.map(c => c.row),
        tabs: P.app ? [...P.app.element.querySelectorAll('nav.drpg-tabs > button[role="tab"]')].map(b => ({ key: b.dataset.drpgTabKey, on: b.getAttribute("aria-selected") === "true" })) : [],
        fields: P.app ? P.app.element.querySelectorAll("input, select, textarea").length : 0 };
`;

/* Presses the control of that signature (its `nth` occurrence) in the window OPEN left standing, and says what it saw. */
const pressAt = (sign, nth) => `
    ${SHARED}
    const P = globalThis.__probe42;
    if (!P?.app) return { missing: "no window" };
    const list = controlsOf(P.app, P.clicks);
    const c = list.filter(o => o.row.sign === ${JSON.stringify(sign)})[${nth}];
    if (!c) return { missing: \`not in this draw (\${list.length} control(s)): the window drew differently than when it was listed\` };
    if (c.row.off) return { missing: \`\${c.row.off} on this draw\` };
    const was = { state: stateOf(P.app.element), own: c.el.outerHTML.slice(0, 400), instances: new Set(foundry.applications.instances.keys()), answered: P.answered,
        errors: globalThis.__errors.length, notices: globalThis.__notifications.length, saved: globalThis.__savedFiles.length,
        consoleErrors: P.consoleErrors.length, focus: document.activeElement };
    let threw = null;
    try { c.el.click(); } catch (err) { threw = String(err?.stack ?? err).slice(0, 300); }
    const read = () => {
        const fresh = [...foundry.applications.instances.values()].filter(a => !was.instances.has(a.id) && a.element?.isConnected);
        const standing = !!P.app.element?.isConnected && foundry.applications.instances.has(P.app.id);
        return {
            threw,
            closed: !standing,
            opened: fresh.map(a => String(a.title ?? a.constructor?.name ?? "?").slice(0, 80)),
            redrawn: standing ? stateOf(P.app.element) !== was.state : null,
            self: c.el.isConnected ? c.el.outerHTML.slice(0, 400) !== was.own : null,
            answered: P.answered !== was.answered ? P.answered : null,
            openerThrew: P.threw,
            errors: globalThis.__errors.slice(was.errors).map(e => \`\${e.where}: \${e.message}\`.slice(0, 260)),
            consoleErrors: P.consoleErrors.slice(was.consoleErrors).slice(0, 4),
            notices: globalThis.__notifications.slice(was.notices).map(n => \`\${n.level}: \${String(n.msg).slice(0, 160)}\`).slice(0, 4),
            saved: globalThis.__savedFiles.length - was.saved,
            focusMoved: document.activeElement !== was.focus
        };
    };
    const quiet = o => !o.threw && !o.closed && !o.opened.length && !o.redrawn && !o.self && !o.answered && !o.openerThrew && !o.errors.length
        && !o.consoleErrors.length && !o.notices.length && !o.saved && !o.focusMoved;
    await new Promise(r => setTimeout(r, 900));
    let out = read();
    if (quiet(out)) { await new Promise(r => setTimeout(r, 1200)); out = read(); out.waited = 2100; }
    return out;
`;

/* Closes what the window and the press opened, runs the row's `after`, and puts the page's hooks back. */
export const close = (repoUrl, w) => `
    const repoUrl = "${repoUrl}";
    const P = globalThis.__probe42;
    const out = {};
    if (!P) return out;
    for (const a of [...foundry.applications.instances.values()]) if (!P.before.has(a.id)) { try { await a.close(); } catch {} }
    await new Promise(r => setTimeout(r, 120));
    document.defaultView.EventTarget.prototype.addEventListener = P.add;
    console.error = P.consoleError;
    try { ${w.after ?? ""} } catch (err) { out.afterThrew = String(err?.message ?? err).slice(0, 200); }
    globalThis.__dialogWindows = P.keep.windows;
    globalThis.__dialogAnswers.length = 0; globalThis.__dialogAnswers.push(...P.keep.answers);
    delete globalThis.__probe42;
    return out;
`;

/** What a press showed, as one word a row and the reasons behind it. */
function verdictOf(seen, server) {
    const effects = [];
    if (seen.closed) effects.push("closed its window");
    if (seen.opened?.length) effects.push(`opened ${seen.opened.map(t => `"${t}"`).join(", ")}`);
    if (seen.redrawn) effects.push("the window changed");
    else if (seen.self) effects.push("the control changed");
    if (seen.answered) effects.push(`the opener answered ${seen.answered}`);
    if (seen.notices?.length) effects.push(`notice ${seen.notices[0]}`);
    if (seen.saved) effects.push("a file offered");
    if (server.ops || server.settings || server.packets) effects.push(`server: ${server.ops} document write(s), ${server.settings} setting write(s), ${server.packets} packet(s)`);
    const threw = seen.threw || seen.openerThrew || seen.errors?.length || seen.consoleErrors?.length;
    if (!effects.length && seen.focusMoved) effects.push("the focus moved");
    return { verdict: threw ? "threw" : effects.length ? "acted" : "nothing", effects };
}

export async function run({ gm, p1, note, settle, repoUrl, opLog, settingLog, socketTraffic }) {
    const clients = { gm, p1 };
    const unknown = ONLY.filter(id => !WINDOWS.some(w => w.id === id));
    if (unknown.length) throw new Error(`DRPG_PRESS_ONLY names no window of WINDOWS: ${unknown.join(", ")}`);
    const base = ONLY.length ? WINDOWS.filter(w => ONLY.includes(w.id)) : WINDOWS;
    const p1Id = await p1.eval("return game.user.id;");
    const onGm = step => gm.eval(`const repoUrl = ${JSON.stringify(repoUrl)}; ${step.replaceAll("__P1__", p1Id)} return true;`, { timeout: 60000 });
    const serverNow = () => ({ ops: opLog.length, settings: settingLog.length, packets: socketTraffic.length });

    await settle(3000);
    const dump = `const K = await import("${repoUrl}/scripts/tests-kit.mjs"); const d = await K.worldDump();`;
    await gm.eval(`${dump} globalThis.__probe42dump = d; return d.size;`, { timeout: 60000 });
    await gm.eval(`const T = await import("${repoUrl}/scripts/tests-tier2.mjs"); const { studentActors } = await import("${repoUrl}/scripts/monokuma.mjs");
        globalThis.__probe42snap = await T.snapshot(studentActors()); return true;`, { timeout: 120000 });
    const putBack = () => gm.eval(`const T = await import("${repoUrl}/scripts/tests-tier2.mjs"); const { gmStoresIdle } = await import("${repoUrl}/scripts/gm-store.mjs");
        try { await game.drpg.endMurder({ reason: "test", followUp: false }); } catch {}
        await gmStoresIdle(); await T.restore(globalThis.__probe42snap); return true;`, { timeout: 120000 });

    const windows = [];
    const totals = { windows: 0, opened: 0, controls: 0, pressed: 0, acted: 0, nothing: 0, threw: 0, off: 0, alike: 0, capped: 0, containers: 0 };

    /* One window, in one state: listed, then each control pressed on a fresh draw. `skip` holds the footer and nav
       presses its base window already made, so a tab's pass presses its pane's controls and the ones new to it. */
    const walk = async (w, skip = null) => {
        const client = clients[w.client ?? "gm"];
        const row = { id: w.id, client: w.client ?? "gm", opener: w.opener ?? `${w.module} ${w.call}`.slice(0, 160), pressed: [], notPressed: [] };
        const openOnce = async () => {
            if (w.gmSeed) await onGm(w.gmSeed);
            const during = w.gmDuring ? new Promise(r => setTimeout(r, 400)).then(() => onGm(w.gmDuring)).catch(err => String(err?.message ?? err)) : null;
            let got;
            try { got = await client.eval(open(repoUrl, w), { timeout: 60000 }); } catch (err) { got = { opened: false, threw: String(err?.message ?? err).slice(0, 300), controls: [], tabs: [] }; }
            if (during) await during;
            return got;
        };
        const closeOnce = async () => {
            let out = {};
            try { out = await client.eval(close(repoUrl, w), { timeout: 60000 }); } catch (err) { out = { afterThrew: String(err?.message ?? err).slice(0, 200) }; }
            if (w.gmAfter) { try { await onGm(w.gmAfter); } catch (err) { out.gmAfterThrew = String(err?.message ?? err).slice(0, 200); } }
            return out;
        };
        const first = await openOnce();
        await closeOnce();
        Object.assign(row, { opened: first.opened, title: first.title, classes: first.classes, threw: first.threw ?? null, fields: first.fields ?? 0, controls: first.controls.length });
        totals.windows++;
        if (!first.opened) { windows.push(row); note(w.id, `not opened (${first.threw ?? `the opener answered ${first.answered}`})`); return { row, tabs: [] }; }
        totals.opened++; totals.controls += first.controls.length;
        const kinds = new Map();
        let reached = false;
        for (const c of first.controls) {
            const key = `${c.where}|${c.action ?? ""}|${c.label}`;
            if (c.holds && c.tag !== "button" && c.tag !== "a" && c.tag !== "summary") { totals.containers++; continue; }
            if (c.showing) { row.notPressed.push({ label: c.label, action: c.action, where: c.where, why: "the tab showing" }); continue; }
            if (c.off) { row.notPressed.push({ label: c.label, action: c.action, where: c.where, why: c.off }); totals.off++; continue; }
            if (skip?.has(key) && c.where !== "body") continue;
            if (kinds.has(c.kind)) { kinds.get(c.kind).alike++; totals.alike++; continue; }
            if (row.pressed.length >= MAX_PRESSES) { row.notPressed.push({ label: c.label, action: c.action, where: c.where, why: "capped" }); totals.capped++; continue; }
            const again = await openOnce();
            const at = serverNow();
            let seen;
            if (!again.opened) seen = { missing: `the window did not open again (${again.threw ?? again.answered})` };
            else { try { seen = await client.eval(pressAt(c.sign, c.nth), { timeout: 60000 }); } catch (err) { seen = { threw: `the press's eval: ${String(err?.message ?? err).slice(0, 200)}`, opened: [], errors: [], consoleErrors: [], notices: [] }; } }
            const now = serverNow();
            const server = { ops: now.ops - at.ops, settings: now.settings - at.settings, packets: now.packets - at.packets };
            const closed = await closeOnce();
            const entry = { label: c.label, action: c.action, where: c.where, tag: c.tag, data: c.data, alike: 0 };
            if (seen.missing) Object.assign(entry, { verdict: "not-pressed", why: seen.missing });
            else {
                Object.assign(entry, verdictOf(seen, server), { server, seen });
                totals.pressed++; totals[entry.verdict]++;
                if (server.ops || server.settings) {
                    reached = true;
                    try { await putBack(); } catch (err) { entry.putBack = `threw: ${String(err?.message ?? err).slice(0, 200)}`; }
                }
            }
            if (closed.afterThrew || closed.gmAfterThrew) entry.afterThrew = closed.afterThrew ?? closed.gmAfterThrew;
            kinds.set(c.kind, entry);
            row.pressed.push(entry);
            skip?.add(key);
        }
        row.reachedTheServer = reached;
        windows.push(row);
        const count = v => row.pressed.filter(p => p.verdict === v).length;
        const quiet = row.pressed.filter(p => p.verdict === "nothing").map(p => `"${p.label}"${p.action ? ` [${p.action}]` : ""} (${p.where})`);
        note(w.id, `"${row.title}": ${first.controls.length} control(s), ${row.pressed.length} pressed - ${count("acted")} acted, ${count("nothing")} nothing, ${count("threw")} threw; ${row.notPressed.length} not pressed${quiet.length ? `; nothing: ${quiet.join(", ")}` : ""}`);
        return { row, tabs: first.tabs ?? [] };
    };

    /* Each window is caught on its own and the evidence is written after every window (DRPG_PRESS_OUT), so a client
       that dies part way (the run of 20.11.2026 23:03Z lost its GM to the kernel's out-of-memory kill and with it the
       whole evidence block) still leaves every row it read, with the windows it could not walk named and why. */
    const evidenceOf = (changed, ended) => ({ about: "probe 42 (audit/harness/probes/42-press-controls.mjs): each control of each window of probe 08's list pressed once on a fresh draw, and what the press showed. A reading, not a verdict: `nothing` is a candidate to read in the source.",
        only: ONLY, ended, totals, worldChanged: changed, windows,
        nothing: windows.flatMap(r => (r.pressed ?? []).filter(p => p.verdict === "nothing").map(p => ({ window: r.id, title: r.title ?? null, label: p.label, action: p.action, where: p.where, tag: p.tag, data: p.data }))) });
    const save = (changed, ended) => {
        if (!OUT) return;
        try { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, `${JSON.stringify(evidenceOf(changed, ended), null, 1)}\n`); } catch { /* the notes still hold the rows */ }
    };
    for (const w of base) {
        try {
            const pressedOutside = new Set();
            const { row, tabs } = await walk(w, pressedOutside);
            if (row.opened && w.perTab !== false && !w.open) {
                for (const t of tabs.filter(t => !t.on && t.key)) {
                    const id = `${w.id}--${t.key}`;
                    if (WINDOWS.some(x => x.id === id)) continue;
                    try { await walk({ ...w, id, open: t.key }, pressedOutside); }
                    catch (err) { windows.push({ id, opened: false, notWalked: String(err?.message ?? err).slice(0, 300) }); note(id, `not walked (${String(err?.message ?? err).slice(0, 160)})`); }
                }
            }
        } catch (err) {
            windows.push({ id: w.id, opened: false, notWalked: String(err?.message ?? err).slice(0, 300) });
            note(w.id, `not walked (${String(err?.message ?? err).slice(0, 160)})`);
        }
        save(null, "in progress");
    }

    try { await putBack(); } catch (err) { note("the last restore", `threw: ${String(err?.message ?? err).slice(0, 200)}`); }
    let changed = null;
    try {
        changed = await gm.eval(`${dump} const diff = K.dumpDiff(globalThis.__probe42dump, d).map(x => x.unit); delete globalThis.__probe42dump; delete globalThis.__probe42snap; return diff;`, { timeout: 60000 });
        note("the world", changed.length ? `${changed.length} unit(s) differ after the last restore: ${changed.slice(0, 10).join(", ")}` : "the world dump is equal before and after");
    } catch (err) { note("the world", `not compared: ${String(err?.message ?? err).slice(0, 200)}`); }
    note("totals", JSON.stringify(totals));
    save(changed, "done");
    return evidenceOf(changed, "done");
}
