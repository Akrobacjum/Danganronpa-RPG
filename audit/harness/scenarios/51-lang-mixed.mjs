/**
 * 51-lang-mixed (E57 C5, 14.11.2026): English and Polish browsers at one table - a GM in Polish, p1 and p3 in English,
 * p2 in Polish - and the window registry in both languages.
 *
 * THE WINDOW REGISTRY is the screen map's window rows (tools/text-map.mjs SCREENS, `kind: "window"`: 48 on
 * 14.11.2026). The plan names "the window registry in both languages" and defines it nowhere (docs/dev/e57/SPEC.md,
 * Q-E57-16, the default taken): each row is either opened here on the clients that may open it - OPENED, with the
 * function that opens it and the key its title shows - or listed in NOT_OPENED with the reason a fresh world cannot
 * open it (most are prompts a game state asks). A window row added to SCREENS and named in neither is red, so the
 * registry cannot grow past this scenario unread.
 *
 * WHAT A WINDOW MUST SHOW, on each client in its own language: something drawn (a DialogV2 the harness logs, or an
 * application it registers), no raw key ("DRPG." followed by a name) in its title or its text, no key the code asked
 * for and the client's language lacks (`__missingI18n`, against the client's own baseline before anything opened), and
 * its title the value of its title key in that client's language (cut at its first placeholder). Every window answers
 * as closed (`__dialogAuto = false`), so nothing a window would apply is applied. A control first: a kit window with a
 * raw key planted in its title and its body must be read as one, by the same reader.
 *
 * WHAT IT DOES NOT SEE. Text drawn after a window opens (a live footer, a tab not shown first) is read only as far as
 * the harness's log of the window's content goes (400 characters of its content, and its words); an application's
 * whole text. A card in the chat is the D34 question (a document's language), not this one.
 */
import url from "node:url";
import path from "node:path";

export const layers = ["ci"];

const MOD = "danganronpa-rpg";
const TOOLS = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../../../tools");

/* The rows of SCREENS opened here: who opens it (gm, players or all), the module file and the function, its arguments, its title key. */
export const OPENED = Object.freeze({
    "gm-panel": { who: "gm", file: "gm-panel.mjs", fn: "openGmPanel", title: "Panel.title" },
    "season-setup": { who: "gm", file: "season-setup.mjs", fn: "openSeasonSetup", title: "Season.title" },
    "room-setup": { who: "gm", file: "room-setup.mjs", fn: "openRoomSetupDialog", title: "Vault.manageTitleOn" },
    "clock": { who: "gm", file: "gm-campaign.mjs", fn: "openClockDialog", title: "Panel.jump" },
    "trial-console": { who: "gm", file: "trial-floor-ui.mjs", fn: "manageClassTrial", title: null },
    "gm-stores": { who: "gm", file: "gm-stores.mjs", fn: "openCaseWindow", title: "Case.tile" },
    "murder-window": { who: "gm", file: "murder-ui.mjs", fn: "openMurderDialog", title: "Murder.openTitle" },
    "item-tables": { who: "gm", file: "tables-editor.mjs", fn: "openItemTables", title: "Tables.editorTitle" },
    "stash-inspector": { who: "gm", file: "stash-reach.mjs", fn: "openVaultInspector", title: "Vault.inspectTitle" },
    "gm-team": { who: "gm", file: "gm-team-dialog.mjs", fn: "openGmTeamDialog", title: null },
    "mastermind": { who: "gm", file: "mastermind.mjs", fn: "openMastermindDialog", title: "Mastermind.dialogTitle" },
    "investigation": { who: "gm", file: "investigation.mjs", fn: "openInvestigationDashboard", title: "Investigation.dashboardTitle" },
    /* The GMs' manager: a player who asks is told DRPG.Panel.gmOnly and gets none. */
    "projects": { who: "gm", file: "projects-ui.mjs", fn: "openProjectManager", title: null },
    "notice-history": { who: "all", file: "notice-history-app.mjs", fn: "openNotices", title: null },
    "handbooks": { who: "all", file: "handbooks.mjs", fn: "openHandbooks", title: "Handbooks.title" },
    /* A player's own thread; a GM asking for "the messenger" gets the roster (messenger-app.mjs, D-F4), no thread window. */
    "messenger": { who: "players", file: "messenger-app.mjs", fn: "openMessenger", title: null },
    "explain": { who: "all", file: "explain.mjs", fn: "openStatusExplainer", title: null }
});

/* The rows not opened here, each with why a fresh world on these clients cannot open it. */
export const NOT_OPENED = Object.freeze({
    "stash": "a character's own stash at its room: opened from the sheet with a character placed at its stash",
    "season-wipe": "the season reset: a window that takes a season down, opened from Season setup's footer; read by 65-season",
    "trial-turn": "a round's turn on a participant: opened only while a Class Trial round runs",
    "incident-tracker": "the GM's tracker: opened only while an incident runs",
    "passages-gm": "a passage's GM card: opened only for a passage being built",
    "death-window": "a death's window: opened for a student being killed",
    "body-discovery": "a body's discovery: opened only once a body lies on the map",
    "transform": "a Tamper's transform: a prompt of a clean-up in an incident",
    "key-remnant": "a Key Remnant's placing: opened from the dashboard's row, with a case planned",
    "advancement": "Level Up: offered after a verdict",
    "vote": "the ballot and the verdict: opened only by a Class Trial's vote",
    "project-start": "a project's start: a prompt of Work on Project",
    "move-body": "Move the Body: a prompt of a clean-up in an incident",
    "tier-zero": "a tier 0 rating: a prompt of an incident's resolution",
    "trial-exit": "End the trial's question: opened only while a Class Trial stands",
    "give-items": "giving an item: opened from a character's row with a character chosen",
    "gm-items": "a character's items as a GM manages them: opened with a character",
    "table-names": "a table's name: a prompt of the item tables' editor",
    "sheet-other": "a sheet's part, not a window of its own",
    "betrayal": "a betrayal's or a Dynamic action's prompt: opened only by those actions",
    "roll-window": "a roll's window: opened by a roll, read by 83-roll-integrity",
    "eclipse-hud": "the Eclipse's questions: opened only at an Eclipse's start or end",
    "bridge-request": "a request to the GM: a prompt of an action that asks one",
    "item-effect": "an item's effect asked by the messenger: opened by an item given in a thread",
    "after-incident": "after an incident: opened only at an incident's close",
    "which-resource": "which reserve an item restores: a prompt of using an item",
    "diagnostics": "the diagnostics' windows: the GM's console reports, English by design (CLAUDE.md: diagnostics.mjs's console stays English)",
    "sheet": "Daggerheart's own sheet with the module's parts: read by 71-sheet",
    "settings": "Foundry's settings window: read by its own tests (the settings' names and hints in both languages, R1164 and the text lint)",
    "daggerheart": "Daggerheart's own windows: not the module's text",
    "suite": "the suite's own window: English, a tool for the GM"
});

/** The reader of one window's drawing, as a string a client evaluates: what was drawn and what it shows. */
const READ_WINDOW = `
    const rawKey = /\\bDRPG\\.[A-Z][A-Za-z]*(\\.[A-Za-z0-9]+)+/;
    const drawn = { dialogs: globalThis.__dialogLog.map(d => ({ title: String(d.title ?? ""), text: [d.content, d.text].filter(Boolean).join(" ") })), apps: [] };
    for (const app of foundry.applications.instances.values()) {
        if (before.has(app.id)) continue;
        drawn.apps.push({ id: app.id, title: String(app.title ?? ""), text: (app.element?.textContent ?? "").replace(/\\s+/g, " ") });
    }
    const titles = [...drawn.dialogs.map(d => d.title), ...drawn.apps.map(a => a.title)];
    const texts = [...drawn.dialogs.map(d => d.title + " " + d.text), ...drawn.apps.map(a => a.title + " " + a.text)];
    const raw = texts.map(t => rawKey.exec(t)?.[0]).filter(Boolean);
    const missing = [...globalThis.__missingI18n].filter(k => k.startsWith("DRPG.") && !baseline.has(k));
    for (const app of foundry.applications.instances.values()) if (!before.has(app.id)) { try { await app.close(); } catch {} }
    /* The next window's baseline: a key this one asked for and lacked is this one's finding, not the next's. */
    globalThis.__e57missing = [...globalThis.__missingI18n];
    return { count: drawn.dialogs.length + drawn.apps.length, titles, raw, missing, sample: texts.join(" | ").slice(0, 240) };
`;

export async function run({ gm, p1, p2, p3, check, settle, repoUrl: REPO }) {
    const lang = { gm: "pl", p1: "en", p2: "pl", p3: "en" };
    const clients = [gm, p1, p2, p3];

    // ---- 0. the registry: every window row of the screen map is opened here or listed with its reason ----------
    const { SCREENS } = await import(url.pathToFileURL(path.join(TOOLS, "text-map.mjs")).href);
    const windows = SCREENS.filter(r => r.kind === "window").map(r => r.id);
    const unlisted = windows.filter(id => !OPENED[id] && !NOT_OPENED[id]);
    const stale = [...Object.keys(OPENED), ...Object.keys(NOT_OPENED)].filter(id => !windows.includes(id));
    const twice = Object.keys(OPENED).filter(id => NOT_OPENED[id]);
    check(`the window registry: each of the screen map's ${windows.length} window rows is opened here or listed with its reason, and no row named here is gone`,
        windows.length > 40 && !unlisted.length && !stale.length && !twice.length, JSON.stringify({ windows: windows.length, unlisted, stale, twice }));

    // ---- 1. each browser in its own language, applied as i18nInit applies it --------------------------------
    for (const c of clients) {
        const r = await c.eval(`
            await game.settings.set("${MOD}", "language", "${lang[c.who]}");
            const I = await import("${REPO}/scripts/i18n.mjs");
            await I.applyModuleLanguage();
            globalThis.__e57was = { auto: globalThis.__dialogAuto, windows: globalThis.__dialogWindows };
            globalThis.__dialogAuto = false; globalThis.__dialogWindows = false;
            return { lang: I.moduleLanguage(), panel: game.i18n.localize("DRPG.Panel.title") };`, { timeout: 30000 });
        const want = lang[c.who] === "pl" ? "Danganronpa - panel GM-a" : "Danganronpa - GM Panel";
        check(`${c.who}: the page is in ${lang[c.who] === "pl" ? "Polish" : "English"}`, r.lang === lang[c.who] && r.panel === want, JSON.stringify(r));
    }

    /* One window opened on one client: the reader above, after the opener ran (or 1.5 s, for a window that waits). */
    const open = (c, row, extra = "") => c.eval(`
        const baseline = new Set(globalThis.__e57missing ?? []);
        const before = new Set(foundry.applications.instances.keys());
        globalThis.__dialogLog.length = 0;
        ${extra}
        const m = await import("${REPO}/scripts/${row.file}");
        try { await Promise.race([Promise.resolve(m.${row.fn}()), new Promise(r => setTimeout(r, 1500))]); } catch (err) { globalThis.__e57threw = String(err?.message ?? err); }
        await new Promise(r => setTimeout(r, 200));
        ${READ_WINDOW}`, { timeout: 30000 });
    const words = async (c, key) => (key ? c.eval(`return game.i18n.localize("DRPG.${key}").split("{")[0].trim();`) : null);

    for (const c of clients) await c.eval(`globalThis.__e57missing = [...globalThis.__missingI18n]; return true;`);

    // ---- 2. the control: a raw key planted in a kit window is read as one -----------------------------------
    const planted = await gm.eval(`
        const baseline = new Set(globalThis.__e57missing ?? []);
        const before = new Set(foundry.applications.instances.keys());
        globalThis.__dialogLog.length = 0;
        const K = await import("${REPO}/scripts/ui-kit.mjs");
        await K.drpgWindow({ title: "DRPG.Planted.windowTitle", body: "<p>DRPG.Planted.bodyText</p>" });
        ${READ_WINDOW}`, { timeout: 30000 });
    check("control: a kit window with a raw key planted in its title and body is read as showing one", planted.count > 0 && planted.raw.length >= 1, JSON.stringify(planted));

    // ---- 3. every window of OPENED on every client that may open it, in that client's language ----------------
    for (const [id, row] of Object.entries(OPENED)) {
        for (const c of clients) {
            if ((row.who === "gm" && c !== gm) || (row.who === "players" && c === gm)) continue;
            const seen = await open(c, row);
            const title = await words(c, row.title);
            const titled = !title || seen.titles.some(t => t.startsWith(title));
            check(`${c.who} (${lang[c.who]}): ${id} is drawn, with no raw key, no missing key${row.title ? " and its title in its language" : ""}`,
                seen.count > 0 && !seen.raw.length && !seen.missing.length && titled,
                JSON.stringify({ count: seen.count, raw: seen.raw.slice(0, 4), missing: seen.missing.slice(0, 6), titles: seen.titles.slice(0, 3), want: title, sample: seen.sample }));
        }
        await settle(100);
    }

    // ---- 4. put the clients back: every window answers again as it did ------------------------------------------
    for (const c of clients) {
        await c.eval(`globalThis.__dialogAuto = globalThis.__e57was?.auto; globalThis.__dialogWindows = globalThis.__e57was?.windows; return true;`);
    }
}
