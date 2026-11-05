/**
 * Probe: the module's windows as the harness draws them, kept as HTML (E44 C1d, 04.11.2026).
 * ---------------------------------------------------------------------------
 *     node cluster.mjs probes/08-capture-windows.mjs                 (from audit/harness)
 *
 * Opens each window of WINDOWS on its client with real windows drawn (`__dialogWindows`, as tier 2 and the
 * scenarios draw them), in each listed state, waits for the application Foundry would register
 * (`foundry.applications.instances`), and keeps what it drew: the element's `outerHTML`, the title, the classes,
 * the footer's buttons (action, label, default) and the width it was given. Then it closes the window, so the next
 * one opens on a clean page, and writes audit/windows/<id>.html and audit/windows/manifest.json. A window that does
 * not open within its wait is written in the manifest as not captured, with what the opener answered or threw - never
 * left out. It asserts nothing (probes/README.md). Each opener runs with no answer given, and every window it opened
 * is closed unanswered, which every opener reads as dismissed; the GM's world dump (tests-kit.mjs worldDump) is read
 * before the first window and after the last, and what differs is written down as a note and in the evidence.
 *
 * PER TAB, AND THE PLAYER'S WINDOWS (E21 C1c, for the fit sweep: audit/style-sweep.mjs `--fit`). A window drawn with the
 * kit's tab bar is kept once per tab: as it opened (`<id>`), then each other tab pressed in the drawn window, through
 * the module's own wiring, and kept as `<id>--<key>` (the row names its window, `of`, and its `tab`); Room setup keeps
 * its one opener per tab (`perTab: false`). The player's action windows are opened on p1 through `performAction` on the
 * character p1 owns (Observe, Search, Analyze, Tamper, Rest, Projects, Palm), as `chooseVariant` draws them, and closed
 * unanswered (dismissed: no roll, no price). The notice history is kept again on p1 with 250 notices recorded first
 * (`before`; this browser's own history, no world write), and the room's description window as a phone opens it
 * (room-tile.mjs `openRoomWindow`). The incident tracker stays not captured: it opens on an incident, and opening one
 * writes the world, which this probe leaves as it found it.
 *
 * Read by audit/style-harness.html (one window a page, inside the module's sheets) and by E44's mockup round, whose
 * "today" is these captures. WHAT A CAPTURE IS NOT: the harness's DialogV2 draws its form and footer with no window
 * header (audit/harness/lib/shim.mjs `_renderHTML`), Foundry's own stylesheet is absent, and the content is the
 * harness's seeded world (audit/harness/lib/seed.mjs).
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

export const layers = ["probe"];

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "..", "..", "windows");

/*
 * The windows, each `{ id, client, module, call, press }`: the opener's module under scripts/ and the call made on it
 * (`m` is the module), on the GM unless `client` names a player; with `press`, the window the opener drew is a step on
 * the way, and the one its footer's button of that action opens is captured (Pre-season checks, from Season setup). The list is E44's mockup set as far as an opener
 * opens it with no state built first; a window that needs one (a trial running, a vote, a roll drawn with no GM) is
 * the mockup round's to build, not this probe's.
 */
const ROOM_TABS = ["bedrooms", "doors", "passages", "search", "rest", "stashes", "description", "fog", "scenes"];
/* The player's action windows (E21 C1c): `performAction` on the character p1 owns, each window dismissed. */
const MINE = "game.actors.find(a => a.type === \"character\" && a.isOwner)";
const ACTION_WINDOWS = ["observe", "search", "analyze", "tamper", "rest", "project", "palm"];
/* 250 notices recorded on p1 before its history is opened (E21 C1c, the 11.10 amend A7): its own browser's history. */
const NOTICES_250 = "const h = await import(`${repoUrl}/scripts/notice-history.mjs`); for (let i = 1; i <= 250; i++) h.recordNotice({ kind: \"info\", source: \"mine\", state: i > 240 ? \"unread\" : \"read\", title: `Probe notice ${i}`, text: `The probe's notice number ${i}, one of 250.` });";
export const WINDOWS = [
    ...ROOM_TABS.map(tab => ({ id: `rooms-${tab}`, module: "room-setup.mjs", call: `m.openRoomSetupDialog({ tab: ${JSON.stringify(tab)} })`, perTab: false })),
    { id: "sound", module: "sound-panel.mjs", call: "m.openSoundDialog()" },
    { id: "despair-flow", module: "gm-team-dialog.mjs", call: "m.openGmTeamDialog()" },
    { id: "season-setup", module: "season-setup.mjs", call: "m.openSeasonSetup()" },
    { id: "pre-season-checks", module: "season-setup.mjs", call: "m.openSeasonSetup()", press: "checks" },
    { id: "investigation", module: "investigation.mjs", call: "m.openInvestigationDashboard()" },
    { id: "class-trial", module: "trial-floor-ui.mjs", call: "m.manageClassTrial()" },
    { id: "edit-campaign", module: "gm-campaign.mjs", call: "m.openClockDialog()" },
    { id: "murder", module: "murder-ui.mjs", call: "m.openMurderDialog()" },
    { id: "incident-tracker", module: "murder-ui.mjs", call: "m.openIncidentTracker()" },
    { id: "level-up", module: "level-up.mjs", call: "m.openAdvancementFor(game.actors.find(a => a.type === \"character\"))" },
    { id: "item-manager", module: "gm-items.mjs", call: "m.openItemManager()" },
    { id: "item-tables", module: "tables-editor.mjs", call: "m.openItemTables()" },
    { id: "look-gm", module: "look.mjs", call: "m.openLookDialog()" },
    { id: "notices-gm", module: "notice-history-app.mjs", call: "m.openNotices()" },
    { id: "gm-panel", module: "gm-panel.mjs", call: "m.openGmPanel()" },
    { id: "sound-player", client: "p1", module: "sound-panel.mjs", call: "m.openSoundDialog()" },
    { id: "look-player", client: "p1", module: "look.mjs", call: "m.openLookDialog()" },
    { id: "notices-player", client: "p1", module: "notice-history-app.mjs", call: "m.openNotices()" },
    ...ACTION_WINDOWS.map(key => ({ id: `action-${key}`, client: "p1", module: "action-rolls.mjs", call: `m.performAction(${MINE}, ${JSON.stringify(key)})` })),
    { id: "notices-player-250", client: "p1", module: "notice-history-app.mjs", before: NOTICES_250, call: "m.openNotices()" },
    { id: "room-window", client: "p1", module: "room-tile.mjs", call: "m.openRoomWindow()" }
];

const capture = (repoUrl, w) => `
    const before = new Set(foundry.applications.instances.keys());
    const keep = { windows: globalThis.__dialogWindows, answers: [...globalThis.__dialogAnswers] };
    globalThis.__dialogWindows = true;
    globalThis.__dialogAnswers.length = 0;
    let answered = "pending", threw = null;
    const repoUrl = "${repoUrl}";
    try {
        ${w.before ?? ""}
        const m = await import("${repoUrl}/scripts/${w.module}");
        Promise.resolve(${w.call}).then(v => { answered = v === null ? "null" : typeof v; }, err => { threw = String(err?.stack ?? err).slice(0, 400); });
    } catch (err) { threw = String(err?.stack ?? err).slice(0, 400); }
    let app = null;
    for (let i = 0; i < 60 && !app && !threw; i++) {
        await new Promise(r => setTimeout(r, 50));
        app = [...foundry.applications.instances.values()].find(a => !before.has(a.id) && a.element?.isConnected) ?? null;
    }
    await new Promise(r => setTimeout(r, 150));
    const press = ${JSON.stringify(w.press ?? null)};
    if (app && press) {
        const step = new Set(foundry.applications.instances.keys());
        const button = app.element.querySelector(\`[data-action="\${press}"]\`);
        let next = null;
        if (button) {
            button.click();
            for (let i = 0; i < 60 && !next; i++) {
                await new Promise(r => setTimeout(r, 50));
                next = [...foundry.applications.instances.values()].find(a => !step.has(a.id) && a.element?.isConnected) ?? null;
            }
        }
        if (!next) threw = button ? \`pressing "\${press}" opened no window\` : \`no button "\${press}" in the first window\`;
        app = next;
        await new Promise(r => setTimeout(r, 150));
    }
    /* Each other tab of a kit tab bar, pressed in the drawn window through the module's wiring, and kept (E21 C1c). */
    const tabs = [];
    if (app && ${JSON.stringify(w.perTab !== false)}) {
        const keys = [...app.element.querySelectorAll('nav.drpg-tabs > button[role="tab"]')];
        const first = keys.find(b => b.getAttribute("aria-selected") === "true") ?? keys[0];
        for (const b of keys) {
            if (b === first) continue;
            b.click();
            await new Promise(r => setTimeout(r, 150));
            tabs.push({ key: b.dataset.drpgTabKey, html: app.element.outerHTML,
                buttons: [...app.element.querySelectorAll("footer.form-footer button, footer button")].filter(x => !x.hidden).map(x => ({ action: x.dataset.action ?? null, label: x.textContent.trim(), default: x.classList.contains("default") })) });
        }
        first?.click();
        await new Promise(r => setTimeout(r, 100));
    }
    const out = app ? {
        captured: true,
        title: app.title ?? null,
        classes: [...app.element.classList],
        tag: app.element.tagName.toLowerCase(),
        width: app.position?.width ?? app.options?.position?.width ?? null,
        buttons: [...app.element.querySelectorAll("footer.form-footer button, footer button")].map(b => ({ action: b.dataset.action ?? null, label: b.textContent.trim(), default: b.classList.contains("default") })),
        html: app.element.outerHTML,
        tabs
    } : { captured: false, answered, threw };
    for (const a of [...foundry.applications.instances.values()]) if (!before.has(a.id)) { try { await a.close(); } catch {} }
    await new Promise(r => setTimeout(r, 100));
    globalThis.__dialogWindows = keep.windows;
    globalThis.__dialogAnswers.length = 0; globalThis.__dialogAnswers.push(...keep.answers);
    return out;
`;

export async function run({ gm, p1, note, settle, repoUrl }) {
    const clients = { gm, p1 };
    fs.mkdirSync(OUT, { recursive: true });
    const manifest = [];
    /* The world before and after, as the suite reads it (tests-kit.mjs worldDump): a window closed unanswered is read as
       dismissed by its opener, and the difference, if any, is written down rather than assumed away. */
    const dump = `const K = await import("${repoUrl}/scripts/tests-kit.mjs"); globalThis.__probe08 ??= {}; const d = await K.worldDump();`;
    /* Read once the boot has settled: a dump taken while the GM's stores and the migration are still writing reads their
       writes as the windows'. Two reads 3 s apart, the second kept; how many units moved between them is noted. */
    await settle(3000);
    await gm.eval(`${dump} globalThis.__probe08.first = d; return d.size;`);
    await settle(3000);
    const drift = await gm.eval(`${dump} const moved = K.dumpDiff(globalThis.__probe08.first, d).length; globalThis.__probe08.before = d; return moved;`);
    note("the world at rest", `${drift} unit(s) moved between two reads 3 s apart before the first window`);
    /* The module's own en dash, em dash and minus sign as character references: the same page once parsed, and no such
       character in a line the repository adds (the house rule on dashes; the line's pre-push check). */
    const keep = (id, html) => fs.writeFileSync(path.join(OUT, `${id}.html`), `${html.replace(/[\u2013\u2014\u2212]/g, c => `&#${c.codePointAt(0)};`)}\n`);
    for (const w of WINDOWS) {
        const client = clients[w.client ?? "gm"];
        let got;
        try { got = await client.eval(capture(repoUrl, w)); } catch (err) { got = { captured: false, threw: String(err?.message ?? err).slice(0, 400) }; }
        const row = { id: w.id, client: w.client ?? "gm", opener: `${w.module} ${w.call}` };
        if (got?.captured) {
            keep(w.id, got.html);
            Object.assign(row, { captured: true, title: got.title, classes: got.classes, tag: got.tag, width: got.width, buttons: got.buttons, file: `${w.id}.html` });
        } else Object.assign(row, { captured: false, answered: got?.answered ?? null, threw: got?.threw ?? null });
        manifest.push(row);
        note(w.id, row.captured ? `captured: "${row.title}", ${row.buttons.length} button(s)${got.tabs?.length ? `, ${got.tabs.length + 1} tab(s)` : ""}` : `not captured (${row.threw ?? `the opener answered ${row.answered}`})`);
        for (const t of got?.tabs ?? []) {
            const id = `${w.id}--${t.key}`;
            keep(id, t.html);
            manifest.push({ id, client: row.client, opener: row.opener, of: w.id, tab: t.key, captured: true, title: row.title, classes: row.classes, tag: row.tag, width: row.width, buttons: t.buttons, file: `${id}.html` });
        }
    }
    const changed = await gm.eval(`${dump} const diff = K.dumpDiff(globalThis.__probe08.before, d).map(x => x.unit); delete globalThis.__probe08; return diff;`);
    note("the world", changed.length ? `${changed.length} unit(s) differ after the windows: ${changed.slice(0, 8).join(", ")}` : "the world dump is equal before and after");
    fs.writeFileSync(path.join(OUT, "manifest.json"), `${JSON.stringify({
        about: "The module's windows as the harness drew them (probe 08, audit/harness/probes/08-capture-windows.mjs): one file a window, its element's HTML; each row its opener, its title, classes and buttons, or why it was not captured. Written by the probe from a run, never by hand.",
        windows: manifest
    }, null, 2)}\n`);
    return { captured: manifest.filter(r => r.captured).length, of: manifest.length, worldChanged: changed, windows: manifest.map(r => ({ id: r.id, captured: r.captured })) };
}
