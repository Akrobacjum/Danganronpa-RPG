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
 * (room-tile.mjs `openRoomWindow`). The incident tracker is captured as this world has it, with no incident: its empty
 * state since E47-C2 (until then it opened nothing without one, and opening one writes the world, which this probe
 * leaves as it found it).
 *
 * BY WINDOW, BY LANGUAGE, ELSEWHERE (E46 C0, 09.11.2026; E46-02: E46's and E47's groups each re-capture only their own
 * windows, and the comparison of STAGE E46 draws each window in Polish too). Three environment options:
 *     DRPG_CAPTURE_ONLY=give,bullet   only the windows of WINDOWS with those ids (a window's tabs come with it); the
 *                                     manifest's other rows are kept as they were and the named windows' rows rewritten,
 *                                     in WINDOWS's order (`mergeManifest`), and a file the named window no longer draws is
 *                                     removed - so two groups working in parallel each commit only their own rows. An id
 *                                     not in WINDOWS stops the run before the first window.
 *     DRPG_CAPTURE_LANG=pl            the module's language set to Polish on each capturing client first, as scenario
 *                                     50-lang does (`game.settings.set(MOD, "language", "pl")`, then i18n.mjs
 *                                     `applyModuleLanguage()`), and the setting put back to English after the last window
 *                                     (the strings stay Polish until the page reloads, as at a table); each row says
 *                                     `lang`. English is the default; a language other than English needs
 *                                     DRPG_CAPTURE_OUT, so the committed English captures are never overwritten.
 *     DRPG_CAPTURE_OUT=<dir>          the files and manifest.json written into <dir> (resolved from audit/harness) instead
 *                                     of audit/windows; with DRPG_CAPTURE_ONLY the manifest merged is <dir>'s own.
 * E46 C0 also adds four GM windows, each opened on the first student (monokuma.mjs `studentActors`) where it takes one,
 * with no state built and closed unanswered: the Give window (gm-items.mjs `gmGiveItemDialog`, kept per tab, so its
 * Give existing tab is `give--existing`), Give a Truth Bullet (`giveTruthBulletDialog`, per tab), the Students window
 * (gm-students.mjs `openWhoIsAliveDialog`) and the project manager (projects-ui.mjs `openProjectManager`).
 *
 * SEEDED (E49 A4, A5; 11.11.2026). Two windows are kept with the state their fault needs, built by the row's `before`
 * and taken away by its `after` (run once the window is closed, whatever the capture did): `item-tables--rooms`, Item
 * tables on its Room pools tab (`open`, the tab pressed before the capture) with a room pool of 41 names - 7 Murder
 * Weapons, 7 Cleaning Tools, 7 Tools, 9 Healing, 9 Sanity Relief from the module's own lists and 2 no tier pool holds,
 * the owner's screenshot of 10.11 ("Everything 39") and the unfiled pair - made as a RollTable and deleted after; and
 * `rooms-passages--rows`, Room setup's Passages tab with four rows on the working scene written into the GMs' passage
 * stores (passages-gm.mjs `PASSAGE_STORES`) and dropped after: a tunnel with its way picker and a student who knows it,
 * a public passage, a broken one and a closed one. Both names keep the window's `--` form with no `of` (a row of its
 * own, not a tab of another). The world dump around the run says what, if anything, the drop leaves behind.
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
const MOD = "danganronpa-rpg";
/* The three options of the header (E46 C0). */
const ONLY = (process.env.DRPG_CAPTURE_ONLY ?? "").split(",").map(id => id.trim()).filter(Boolean);
const LANG = (process.env.DRPG_CAPTURE_LANG ?? "").trim() || "en";
const OUT = process.env.DRPG_CAPTURE_OUT ? path.resolve(process.env.DRPG_CAPTURE_OUT) : path.resolve(HERE, "..", "..", "windows");
/* The first student, for the windows opened on one (E46 C0). */
const STUDENT = "const student = (await import(`${repoUrl}/scripts/monokuma.mjs`)).studentActors()[0];";

/*
 * The windows, each `{ id, client, module, call, press, click }`: the opener's module under scripts/ and the call made on it
 * (`m` is the module), on the GM unless `client` names a player; with `press`, the window the opener drew is a step on
 * the way, and the one its footer's button of that action opens is captured (Pre-season checks, from Season setup). The list is E44's mockup set as far as an opener
 * opens it with no state built first; a window that needs one (a trial running, a vote, a roll drawn with no GM) is
 * the mockup round's to build, not this probe's.
 */
const ROOM_TABS = ["bedrooms", "doors", "passages", "search", "rest", "stashes", "description", "fog", "scenes"];
/* The player's action windows (E21 C1c): `performAction` on the character p1 owns, each window dismissed. */
const MINE = "game.actors.find(a => a.type === \"character\" && a.isOwner)";
const ACTION_WINDOWS = ["observe", "search", "analyze", "tamper", "rest", "project", "palm", "dynamic"];
/* 250 notices recorded on p1 before its history is opened (E21 C1c, the 11.10 amend A7): its own browser's history. */
const NOTICES_250 = "const h = await import(`${repoUrl}/scripts/notice-history.mjs`); for (let i = 1; i <= 250; i++) h.recordNotice({ kind: \"info\", source: \"mine\", state: i > 240 ? \"unread\" : \"read\", title: `Probe notice ${i}`, text: `The probe's notice number ${i}, one of 250.` });";
/* The seeds of the header's SEEDED (E49 A4, A5): each `before` keeps what it made on `globalThis.__probe08seed` for its
   `after`. */
const SEED_ROOM_POOL = `const P = await import(\`\${repoUrl}/scripts/tables-pools.mjs\`);
    const flat = tiers => [...new Set(Object.values(tiers).flat())];
    const names = [...new Set([...flat(P.ITEM_POOLS.crimeTool).slice(0, 7), ...flat(P.ITEM_POOLS.cleaningTool).slice(0, 7), ...flat(P.ITEM_POOLS.tool).slice(0, 7),
        ...flat(P.USABLE_GOALS.healing.pool).slice(0, 9), ...flat(P.USABLE_GOALS.stress.pool).slice(0, 9), "Probe brass key", "Probe odd sock"])];
    const table = await RollTable.create({ name: "Probe Furniture Shop", flags: { "danganronpa-rpg": { roomPool: true } },
        results: names.map((name, i) => ({ type: "text", name, text: name, description: name, range: [i + 1, i + 1], weight: 1 })) });
    globalThis.__probe08seed = { table: table.id };`;
const DROP_ROOM_POOL = "await game.tables.get(globalThis.__probe08seed?.table)?.delete(); delete globalThis.__probe08seed;";
const SEED_PASSAGES = `const PG = await import(\`\${repoUrl}/scripts/passages-gm.mjs\`);
    const U = await import(\`\${repoUrl}/scripts/utils.mjs\`);
    const [A, B] = (await import(\`\${repoUrl}/scripts/monokuma.mjs\`)).studentActors();
    const scene = U.workingScene(), st = PG.PASSAGE_STORES;
    const id = n => \`\${scene.id}.probe08p\${n}\`;
    const row = (n, rooms, extra = {}) => ({ sceneId: scene.id, level: null, shape: "wall", passageWallId: \`PROBE08WALL\${n}\`,
        passageSeg: { x1: 100 * n, y1: 400, x2: 100 * n + 66, y2: 400 }, rooms, state: "secret", startAccess: [], ...extra });
    await st.map.patchMany({
        [id(1)]: row(1, ["Jeweler's Shop", "Dorm"], { shape: "tunnel", ends: [{ x: 100, y: 400 }, { x: 900, y: 400 }], startAccess: B ? [B.id] : [] }),
        [id(2)]: row(2, ["Dorm", "Lab"], { public: true }),
        [id(3)]: row(3, ["Kitchen", "Dining Hall"], { state: "broken" }),
        [id(4)]: row(4, ["Library", "Art Room"], { state: "closed" })
    });
    const access = A ? { [\`\${id(1)}/\${A.id}\`]: { how: "gm", at: 1, by: { [game.user.id]: 1 } } } : {};
    await st.access.patchMany(access);
    globalThis.__probe08seed = { rows: [1, 2, 3, 4].map(id), access: Object.keys(access) };`;
const DROP_PASSAGES = `const st = (await import(\`\${repoUrl}/scripts/passages-gm.mjs\`)).PASSAGE_STORES;
    await st.access.dropMany(globalThis.__probe08seed?.access ?? []); await st.map.dropMany(globalThis.__probe08seed?.rows ?? []);
    delete globalThis.__probe08seed;`;
/* E97 C5: the Investigation panel's Map view, with a small case seeded in the GMs' store (two deductions on the
   chapter's evidence, a counter, the solution) and dropped after; the view is the GM's own User flag, stubbed for the
   capture (`getFlag` answers "map" for it) rather than written, so the world dump is the same before and after. */
const SEED_CASE = `const CS = await import(\`\${repoUrl}/scripts/case-schema.mjs\`);
    const ch = (await import(\`\${repoUrl}/scripts/clock.mjs\`)).getClock().chapter;
    const ev = CS.caseGraph(ch).nodes.filter(n => n.evidence).map(n => n.id);
    const real = game.user.getFlag;
    globalThis.__probe08case = { ch, real, ids: ["probe08-d1", "probe08-d2", "probe08-c1", "probe08-s1"] };
    game.user.getFlag = function (scope, key) { return key === "investigationView" ? "map" : real.call(this, scope, key); };
    await CS.setCaseNode(ch, "probe08-d1", { kind: "deduction", label: "The killing was before 23:40", inputs: ev.slice(0, 2), mode: "debate" });
    await CS.setCaseNode(ch, "probe08-d2", { kind: "deduction", label: "The culprit came in with a key", inputs: ev.slice(1, 3) });
    await CS.setCaseNode(ch, "probe08-c1", { kind: "counter", label: "The clock could have stopped by itself", refutes: ["probe08-d1"] });
    await CS.setCaseNode(ch, "probe08-s1", { kind: "solution", label: "It was done in the library", inputs: ["probe08-d1", "probe08-d2"] });`;
const DROP_CASE = `const CS = await import(\`\${repoUrl}/scripts/case-schema.mjs\`);
    const c = globalThis.__probe08case;
    if (c) { for (const id of c.ids) await CS.dropCaseNode(c.ch, id); game.user.getFlag = c.real; }
    delete globalThis.__probe08case;`;
export const WINDOWS = [
    ...ROOM_TABS.map(tab => ({ id: `rooms-${tab}`, module: "room-setup.mjs", call: `m.openRoomSetupDialog({ tab: ${JSON.stringify(tab)} })`, perTab: false })),
    // E49 A5: Passages with four rows seeded (the header's SEEDED).
    { id: "rooms-passages--rows", module: "room-setup.mjs", before: SEED_PASSAGES, after: DROP_PASSAGES, perTab: false, call: "m.openRoomSetupDialog({ tab: \"passages\" })" },
    { id: "sound", module: "sound-panel.mjs", call: "m.openSoundDialog()" },
    { id: "despair-flow", module: "gm-team-dialog.mjs", call: "m.openGmTeamDialog()" },
    { id: "season-setup", module: "season-setup.mjs", call: "m.openSeasonSetup()" },
    { id: "pre-season-checks", module: "season-setup.mjs", call: "m.openSeasonSetup()", press: "checks" },
    { id: "investigation", module: "investigation.mjs", call: "m.openInvestigationDashboard()" },
    { id: "investigation--map", module: "investigation.mjs", before: SEED_CASE, after: DROP_CASE, perTab: false, call: "m.openInvestigationDashboard()" },
    { id: "investigation--map-node", module: "investigation.mjs", before: SEED_CASE, after: DROP_CASE, perTab: false, click: ".drpg-case-node--deduction", call: "m.openInvestigationDashboard()" },
    { id: "class-trial", module: "trial-floor-ui.mjs", call: "m.manageClassTrial()" },
    // E21 C4: the trial's questions a GM opens with no world state (M13's Reveal with a row of its own, End the trial with
    // no hall, the vote window before a vote); Your turn and I volunteer open only on a round's speaker's own browser.
    { id: "reveal-confirm", module: "trial-floor-ui.mjs", call: "m.confirmReveal({ id: \"probe08\", name: \"The torn ticket\", text: \"\" }, { left: 0 })" },
    { id: "trial-end", module: "trial-floor-ui.mjs", call: "m.askTrialEnd()" },
    { id: "vote", module: "trial-floor-ui.mjs", call: "m.openVoteDialog()" },
    { id: "edit-campaign", module: "gm-campaign.mjs", call: "m.openClockDialog()" },
    { id: "murder", module: "murder-ui.mjs", call: "m.openMurderDialog()" },
    { id: "incident-tracker", module: "murder-ui.mjs", call: "m.openIncidentTracker()" },
    { id: "level-up", module: "level-up.mjs", call: "m.openAdvancementFor(game.actors.find(a => a.type === \"character\"))" },
    { id: "item-manager", module: "gm-items.mjs", call: "m.openItemManager()" },
    { id: "item-tables", module: "tables-editor.mjs", call: "m.openItemTables()" },
    // E49 A4: Room pools with a room pool seeded (the header's SEEDED).
    { id: "item-tables--rooms", module: "tables-editor.mjs", before: SEED_ROOM_POOL, after: DROP_ROOM_POOL, open: "editRooms", perTab: false, call: "m.openItemTables()" },
    { id: "look-gm", module: "look.mjs", call: "m.openLookDialog()" },
    // E49 A1: the DRPG Settings window, every section drawn (one shown), as a GM and as a player (the client rows alone).
    { id: "drpg-settings", module: "settings-window.mjs", call: "m.openSettingsWindow()" },
    { id: "notices-gm", module: "notice-history-app.mjs", call: "m.openNotices()" },
    { id: "gm-panel", module: "gm-panel.mjs", call: "m.openGmPanel()" },
    // E46 C0: the four GM windows E46 and E47 change that open with no state built.
    { id: "give", module: "gm-items.mjs", before: STUDENT, call: "m.gmGiveItemDialog(student)" },
    { id: "bullet", module: "gm-items.mjs", before: STUDENT, call: "m.giveTruthBulletDialog(student)" },
    { id: "students", module: "gm-students.mjs", call: "m.openWhoIsAliveDialog()" },
    { id: "projects", module: "projects-ui.mjs", call: "m.openProjectManager()" },
    { id: "sound-player", client: "p1", module: "sound-panel.mjs", call: "m.openSoundDialog()" },
    { id: "look-player", client: "p1", module: "look.mjs", call: "m.openLookDialog()" },
    { id: "drpg-settings-player", client: "p1", module: "settings-window.mjs", call: "m.openSettingsWindow()" },
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
    /* A seeded row's tab (E49 A4): pressed in the drawn window through the module's wiring before it is kept. */
    const open = ${JSON.stringify(w.open ?? null)};
    if (app && open) {
        app.element.querySelector(\`nav.drpg-tabs > button[data-drpg-tab-key="\${open}"]\`)?.click();
        await new Promise(r => setTimeout(r, 150));
    }
    /* A node of the drawn window clicked before it is kept (E97 C5: a node of the case map picked). */
    const click = ${JSON.stringify(w.click ?? null)};
    if (app && click) {
        app.element.querySelector(click)?.click();
        await new Promise(r => setTimeout(r, 300));
    }
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
    try { ${w.after ?? ""} } catch (err) { out.afterThrew = String(err?.message ?? err).slice(0, 200); }
    globalThis.__dialogWindows = keep.windows;
    globalThis.__dialogAnswers.length = 0; globalThis.__dialogAnswers.push(...keep.answers);
    return out;
`;

/*
 * The manifest after a run (E46 C0): every row of this run when no window was named; with DRPG_CAPTURE_ONLY, the old
 * manifest's rows of every other window as they were and this run's rows of the named ones, window by window in
 * `order` (WINDOWS's ids, the order a whole run writes), then the old rows of a window no longer in WINDOWS. A row is
 * its window's by `of` (a tab's row) or its `id`. Pure: R2000 runs it on a fixture.
 */
export function mergeManifest(old, fresh, only, order) {
    if (!only.length) return fresh;
    const windowOf = row => row.of ?? row.id;
    const rowsOf = id => (only.includes(id) ? fresh : old).filter(row => windowOf(row) === id);
    return [...order.flatMap(rowsOf), ...old.filter(row => !order.includes(windowOf(row)))];
}

export async function run({ gm, p1, note, settle, repoUrl }) {
    const clients = { gm, p1 };
    const unknown = ONLY.filter(id => !WINDOWS.some(w => w.id === id));
    if (unknown.length) throw new Error(`DRPG_CAPTURE_ONLY names no window of WINDOWS: ${unknown.join(", ")}`);
    if (!["en", "pl"].includes(LANG)) throw new Error(`DRPG_CAPTURE_LANG is "${LANG}": the module has en and pl`);
    if (LANG !== "en" && !process.env.DRPG_CAPTURE_OUT) throw new Error("DRPG_CAPTURE_LANG other than en needs DRPG_CAPTURE_OUT: the committed captures are English");
    const list = ONLY.length ? WINDOWS.filter(w => ONLY.includes(w.id)) : WINDOWS;
    fs.mkdirSync(OUT, { recursive: true });
    const manifestFile = path.join(OUT, "manifest.json");
    const old = ONLY.length && fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, "utf8")).windows ?? [] : [];
    const manifest = [];
    /* The module's language on each client that captures (E46 C0), as 50-lang sets it; back to English after. */
    const speakers = [...new Set(list.map(w => w.client ?? "gm"))];
    if (LANG !== "en") {
        for (const who of speakers) {
            const r = await clients[who].eval(`await game.settings.set("${MOD}", "language", ${JSON.stringify(LANG)}); const I = await import("${repoUrl}/scripts/i18n.mjs"); return { applied: await I.applyModuleLanguage(), lang: I.moduleLanguage() };`, { timeout: 30000 });
            note(`language on ${who}`, `${r.lang}, the file applied: ${r.applied}`);
            if (!r.applied || r.lang !== LANG) throw new Error(`the ${LANG} file did not apply on ${who}: ${JSON.stringify(r)}`);
        }
    }
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
    for (const w of list) {
        const client = clients[w.client ?? "gm"];
        let got;
        try { got = await client.eval(capture(repoUrl, w)); } catch (err) { got = { captured: false, threw: String(err?.message ?? err).slice(0, 400) }; }
        const row = { id: w.id, client: w.client ?? "gm", opener: `${w.module} ${w.call}`, ...(LANG === "en" ? {} : { lang: LANG }) };
        if (got?.captured) {
            keep(w.id, got.html);
            Object.assign(row, { captured: true, title: got.title, classes: got.classes, tag: got.tag, width: got.width, buttons: got.buttons, file: `${w.id}.html` });
        } else Object.assign(row, { captured: false, answered: got?.answered ?? null, threw: got?.threw ?? null });
        manifest.push(row);
        note(w.id, `${row.captured ? `captured: "${row.title}", ${row.buttons.length} button(s)${got.tabs?.length ? `, ${got.tabs.length + 1} tab(s)` : ""}` : `not captured (${row.threw ?? `the opener answered ${row.answered}`})`}${got?.afterThrew ? `; its after threw: ${got.afterThrew}` : ""}`);
        for (const t of got?.tabs ?? []) {
            const id = `${w.id}--${t.key}`;
            keep(id, t.html);
            manifest.push({ id, client: row.client, opener: row.opener, ...(LANG === "en" ? {} : { lang: LANG }), of: w.id, tab: t.key, captured: true, title: row.title, classes: row.classes, tag: row.tag, width: row.width, buttons: t.buttons, file: `${id}.html` });
        }
    }
    const changed = await gm.eval(`${dump} const diff = K.dumpDiff(globalThis.__probe08.before, d).map(x => x.unit); delete globalThis.__probe08; return diff;`);
    note("the world", changed.length ? `${changed.length} unit(s) differ after the windows: ${changed.slice(0, 8).join(", ")}` : "the world dump is equal before and after");
    if (LANG !== "en") {
        for (const who of speakers) await clients[who].eval(`await game.settings.set("${MOD}", "language", "en"); return true;`);
    }
    /* A file a named window drew before and not in this run (a tab gone): removed, so no page outlives its row. */
    for (const row of old) {
        if (ONLY.includes(row.of ?? row.id) && row.file && !manifest.some(r => r.file === row.file)) fs.rmSync(path.join(OUT, row.file), { force: true });
    }
    const rows = mergeManifest(old, manifest, ONLY, WINDOWS.map(w => w.id));
    fs.writeFileSync(manifestFile, `${JSON.stringify({
        about: "The module's windows as the harness drew them (probe 08, audit/harness/probes/08-capture-windows.mjs): one file a window, its element's HTML; each row its opener, its title, classes and buttons, or why it was not captured. Written by the probe from a run, never by hand.",
        windows: rows
    }, null, 2)}\n`);
    return { captured: manifest.filter(r => r.captured).length, of: manifest.length, rows: rows.length, only: ONLY, lang: LANG, out: OUT, worldChanged: changed, windows: manifest.map(r => ({ id: r.id, captured: r.captured })) };
}
