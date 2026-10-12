/**
 * The Class Trial and the scenes, as they are today (E13 C0, 11.10.2026; plan-E13 sections 2.1 and 2.2).
 *
 * Nothing in the module moves the table between scenes: the Class Trial opens and closes on whatever
 * scene each browser shows, and a GM who keeps a hall for the trial activates it and shows its tokens by
 * hand. No scenario drove that, because the harness could not switch a scene on more than one browser
 * (plan-E13 1.x item 6). This one does, on the seeded GM and three players and a late player `p4`, on a
 * hall it builds itself (no seed changes). Every reading is asserted at its value at 48efd99 (E12's last
 * commit), measured on this harness, and its check names the E13 commit that changes it; that commit
 * rewrites the check with the code. Where the module does nothing today the GM does by hand what a GM
 * does at a table now (`byHand` below: activate the hall, show the chosen tokens; and back) - C2 and C3
 * make the module do it, and the hand step then finds nothing left to do.
 *
 *   S  the shim (C0): activating the Annex on the GM moves all four browsers there and leaves the Academy
 *      inactive in every world copy, one `canvasReady` each; a browser whose canvas is loading only warns
 *      and stays; a token's `hidden` written by the GM reaches every browser's `updateToken` hook with its
 *      options and the GM's id; `game.scenes.preload` keeps its calls.
 *   a  the hall (`41 Trial Hall`, two marked rooms, seven hidden-or-not tokens: Aiko, Botan and Chie, a
 *      dead student, Monokuma, a test student no player owns, a decoration that is no student) and
 *      `setClock({ phase: "classTrial" })`: where every browser looks, which hall tokens are shown, and
 *      whether a token was created or deleted. The GM's choice is Aiko, Botan, the dead student and
 *      Monokuma; Chie is unticked, the test student stays hidden, the decoration is never touched. Since
 *      E13 C1 the GM links the Academy as the school and the hall as the trial hall once it is built, and
 *      since C2 stores that choice (trial-scene.mjs `saveTrialCast`: Chie unticked, the dead student
 *      ticked - nobody plays him - and the rest as `defaultReveal` has them) and the module shows it; since
 *      C5 (a0) both through Room Setup's Scenes tab, its window drawn on the GM; and (a3) p1 hides Aiko's
 *      hall token from its own browser and the primary puts it back.
 *   b  p1 moves Aiko's hall token from one of the hall's rooms to the other during the trial: vetoes,
 *      Aiko's actions, the chat, and every other write the move caused; and (C1) what every browser, the
 *      hall active and on its screen, takes for the school and makes of the hall.
 *   h  `voiceTargets()` on each browser in the trial: since E13 C4 one room for everybody (D8).
 *   c  `closeTrial()`: where every browser looks, the hall's tokens, their ids.
 *   d  a and c again through Edit campaign (`openClockDialog`, E11 C6's question answered yes); since E13 C6 that
 *      question says the trial takes the table to the hall.
 *   f  `p4` connects held at the end of its load while the trial opens and the hall is activated; where it
 *      looks after its first `canvasReady`, and (C3) after a GM's later pull to the school.
 *   g  a body found before the trial, a wrong verdict executing Botan, End the trial, and two living
 *      students walking out of and back into the room where the body and the executed lie: the body
 *      cards, what every browser is told, and the chapter's discovery stamps, before and after. Since
 *      E13 C3b End the trial asks for a room (the window answered here with the Academy's room the
 *      walks start from), and the living are gathered there first.
 *   i  (C3b) End the trial's scene and room, through its window drawn on the GM: a living student whose
 *      only token stands on another place scene, and a Monocub on the school; Aiko and Chie walked out of
 *      the room of the body and the executed, the trial opened, and that room chosen. Its buttons and
 *      rooms; where every browser looks; which tokens moved and where to; whom the GMs were told of; and
 *      the body cards and discovery stamps, before and after (the ledger's V12).
 *   j  (C3) the chapter end during the trial (`applyChapterEnd({ endTrial: true })`, the screen's "End the
 *      trial" ticked; the owner's 10.10 item 2: it offers no scene or room): where every browser looks, the
 *      hall's tokens, and whether any token of the school moved.
 *   k  (C6) Start the Class Trial through its window drawn on the GM: what it says of the hall, the tokens it
 *      will show and the table's rule, the hall's preload, and where every browser goes; then, inside the trial,
 *      the console's Back to school, a player's and then the GM's `showCourtroom` through game.drpg,
 *      with `trialSceneReport`: where every browser looks, the hall's tokens, the phase; and after End the
 *      trial, both doors refused to the GM.
 *   e  the season reset during the trial: the active scene, where every browser looks, the hall's tokens.
 * Since E13 C3 the module takes the table: entering the trial activates the hall and leaving it the school
 * (trial-scene.mjs `followPhase`), so `byHand` and `handBack` find nothing left to do.
 *
 * Headless limits: no canvas draw (a view is `canvas.scene` and one `canvasReady`, lib/shim.mjs and
 * client-entry.mjs `_viewScene`); no textures, so `preload` is counted, not loaded; Foundry's own
 * activation and its warning while loading are A5's reading of Foundry, not read in v14 (LIVE-E13-02).
 * A hidden token reaches every browser here as in Foundry (known-leaks.json `foundry-hidden-tokens`).
 *
 * Its bound: 13 checks in 33.9-34.9 s, 39 s from the command to its exit, on 12.10.2026 (alone, `--verbose`, the
 * working tree of 48efd99 and C0) - an eighth of run-all.mjs's five minutes, so it states no `timeoutMs`. With
 * E13 C1's b2: 14 checks in 36.6 s, one run on 12.10.2026 (alone, `--verbose`).
 * E13 C2's a3: 15 checks in 36.5 s, 41 s from the command to its exit, one run on 12.10.2026 (alone, `--verbose`).
 * E13 C3b's i: 20 checks in 47.1 s, one run on 12.10.2026 (alone, `--verbose`; C3's j and e were in it already).
 * E13 C4's h1 (rewritten, no check added): 20 checks in 52.1 s, and 49.8 s with HEAD's voice.mjs, one run each on
 * 12.10.2026 (`--verbose`, lane A; other harness runs were on the machine at the time, so not alone).
 * E13 C5's a0: 21 checks in 49.2 s, 53 s from the command to its exit, one run on 12.10.2026 (`--verbose`; no other
 * run of this worktree beside it, whether one of another was on the machine not checked).
 * E13 C6's k (four checks, d1 extended): 25 checks in 55.0 s, 59 s from the command to its exit, one run on
 * 12.10.2026 (`--verbose`; no other run of this worktree beside it, whether one of another was on the machine not checked).
 */
export const layers = ["ci"];
/* f's player, seeded inactive and brought to the table held at the end of its load (cluster.mjs `connect`). */
export const accounts = [
    { who: "p4", id: "USERP4000000000A", name: "Player Four", role: 1, character: null, color: "#66aa66", late: true }
];

const MOD = "danganronpa-rpg";
const J = value => JSON.stringify(value);
/* The hall's tokens by name; CHOICE is the GM's (since C2 kept in a GmStore, `trialCast`), CAST every token the module may show. */
const CAST = ["Aiko", "Botan", "Chie", "Ghost", "Monokuma", "Test"];
const CHOICE = ["Aiko", "Botan", "Ghost", "Monokuma"];

export async function run({ gm, p1, p2, p3, p4, check, note, phase, settle, connect, finishLoading, opLog, settingLog, IDS, repoUrl }) {
    const clients = [gm, p1, p2, p3];
    const UNTIL = `const until = async (test, ms = 6000) => { const end = Date.now() + ms; let v; while (!(v = await test()) && Date.now() < end) await new Promise(r => setTimeout(r, 100)); return v; };`;
    const HALL = `const hall = game.scenes.find(s => s.name === "41 Trial Hall"), academy = game.scenes.get("${IDS.scene}");`;
    const CARDS = `const cards = () => game.messages.filter(m => m.flags?.["${MOD}"]?.sfx?.key === "bodyFound").length;`;
    /* What one browser shows and holds of the hall: the scene on its canvas, the active one, each hall token's `hidden`
       by name, the hall's token ids, and the creates and deletes it has been sent (client-entry.mjs `__documentCounts`). */
    const READ = `${HALL} return { view: canvas.scene?.id === hall?.id ? "hall" : canvas.scene?.id === academy.id ? "school" : canvas.scene?.id ?? null,
        active: game.scenes.active?.id === hall?.id ? "hall" : game.scenes.active?.id === academy.id ? "school" : game.scenes.active?.id ?? null,
        hidden: Object.fromEntries((hall?.tokens.contents ?? []).map(t => [t.name, t.hidden])), ids: (hall?.tokens.contents ?? []).map(t => t.id).sort(),
        made: (globalThis.__documentCounts.createToken ?? 0), gone: (globalThis.__documentCounts.deleteToken ?? 0) };`;
    const readAll = async (list = clients) => { const out = {}; for (const c of list) out[c.who] = await c.eval(READ); return out; };
    const shown = r => Object.entries(r.hidden).filter(([, hidden]) => !hidden).map(([name]) => name).sort();
    const views = all => Object.values(all).map(r => r.view);
    /* What a GM does by hand today: the hall activated and the chosen tokens shown; and back - the Academy activated and
       the cast hidden. Each answers what it had to do, so a commit that makes the module do it reads that as nothing. */
    const byHand = () => gm.eval(`${HALL} const did = { activated: false, shown: [] };
        if (!hall.active) { await hall.activate(); did.activated = true; }
        const show = hall.tokens.filter(t => ${J(CHOICE)}.includes(t.name) && t.hidden);
        if (show.length) await hall.updateEmbeddedDocuments("Token", show.map(t => ({ _id: t.id, hidden: false })));
        did.shown = show.map(t => t.name).sort();
        return did;`, { timeout: 30000 });
    const handBack = () => gm.eval(`${HALL} if (!academy.active) await academy.activate();
        const hide = hall.tokens.filter(t => ${J(CAST)}.includes(t.name) && !t.hidden);
        if (hide.length) await hall.updateEmbeddedDocuments("Token", hide.map(t => ({ _id: t.id, hidden: true })));
        return true;`, { timeout: 30000 });

    /* ------------------------------ S. the shim ------------------------------ */
    phase("S: an activation reaches every browser", { flow: "trial-scene" });
    /* Each browser's canvasReady count, and the scenes active in its copy as it fires (cluster.mjs sends the
       old scene's `active: false` before the new one's `true`, so the view finds one). */
    const COUNT = `globalThis.__s41ready = 0; globalThis.__s41atReady = null; if (!globalThis.__s41hook) globalThis.__s41hook = Hooks.on("canvasReady", () => {
        globalThis.__s41ready += 1; globalThis.__s41atReady = game.scenes.filter(s => s.active).map(s => s.id); }); return true;`;
    for (const c of clients) await c.eval(COUNT);
    await gm.eval(`await game.scenes.get("${IDS.annex}").activate(); return true;`, { timeout: 30000 });
    await settle(400);
    const SEEN = `return { view: canvas.scene?.id ?? null, ready: globalThis.__s41ready, atReady: globalThis.__s41atReady,
        active: game.scenes.filter(s => s.active).map(s => s.id) };`;
    const onAnnex = {};
    for (const c of clients) onAnnex[c.who] = await c.eval(SEEN);
    check("S1: activating the Annex on the GM moves all four browsers to it, one canvasReady each, and every world copy holds the Annex alone active, already as it draws",
        Object.values(onAnnex).every(r => r.view === IDS.annex && r.ready === 1 && J(r.active) === J([IDS.annex]) && J(r.atReady) === J([IDS.annex])),
        J(onAnnex), { flow: "trial-scene" });
    /* p3 loading: the GM activates the Academy again; p3 warns and stays on the Annex, the rest move. */
    await p3.eval(`canvas.loading = true; globalThis.__s41told = globalThis.__notifications.length; return true;`);
    for (const c of clients) await c.eval(COUNT);
    await gm.eval(`await game.scenes.get("${IDS.scene}").activate(); return true;`, { timeout: 30000 });
    await settle(400);
    const loading = {};
    for (const c of clients) loading[c.who] = await c.eval(SEEN);
    const warned = await p3.eval(`const told = globalThis.__notifications.slice(globalThis.__s41told).map(n => n.level + ":" + n.msg);
        canvas.loading = false; await game.scenes.get("${IDS.scene}").view(); return told;`);
    check("S2: a browser whose canvas is loading only warns and stays where it was; the others follow the activation",
        [gm, p1, p2].every(c => loading[c.who].view === IDS.scene && loading[c.who].ready === 1) && loading.p3.view === IDS.annex && loading.p3.ready === 0
            && J(loading.p3.active) === J([IDS.scene]) && warned.length === 1 && warned[0].startsWith("warn:"),
        J({ loading, warned }), { flow: "trial-scene" });
    const HEARD = `globalThis.__s41heard = []; if (!globalThis.__s41tok) globalThis.__s41tok = Hooks.on("updateToken", (t, changed, options, userId) => {
        if ("hidden" in changed) globalThis.__s41heard.push({ id: t.id, hidden: changed.hidden, mark: options?.s41 ?? null, userId }); }); return true;`;
    for (const c of clients) await c.eval(HEARD);
    const traceHidden = await gm.eval(`const t = game.scenes.get("${IDS.annex}").tokens.get("${IDS.trace}");
        await t.update({ hidden: false }, { s41: "shown" }); await t.update({ hidden: true }, { s41: "hidden" });
        await game.scenes.preload("${IDS.annex}", true);
        return { preloads: globalThis.__scenePreloads };`, { timeout: 30000 });
    await settle(300);
    const heard = {};
    for (const c of clients) heard[c.who] = await c.eval(`return globalThis.__s41heard;`);
    const want = [{ id: IDS.trace, hidden: false, mark: "shown", userId: IDS.gm }, { id: IDS.trace, hidden: true, mark: "hidden", userId: IDS.gm }];
    check("S3: a token's hidden written by the GM reaches every browser's updateToken hook with its options and the GM's id; preload keeps its call",
        Object.values(heard).every(h => J(h) === J(want)) && J(traceHidden.preloads) === J([{ sceneId: IDS.annex, push: true }]),
        J({ heard, traceHidden }), { flow: "trial-scene" });

    /* ------------------------------ a. the hall, and setClock ------------------------------ */
    phase("a: the hall built, and setClock opens the Class Trial", { flow: "trial-scene" });
    const built = await gm.eval(`const C = await import("${repoUrl}/scripts/chapter.mjs"); const academy = game.scenes.get("${IDS.scene}");
        const ghost = await Actor.create({ name: "S41 Ghost", type: "character" });
        const test = await Actor.create({ name: "S41 Test", type: "character" });
        const decor = await Actor.create({ name: "S41 Decor", type: "npc" });
        const died = Boolean(await C.killCharacter(ghost, { secret: false, keepBullets: true }));
        const hall = await Scene.create({ name: "41 Trial Hall", width: 3000, height: 2000, grid: { size: 100 }, active: false });
        await hall.createEmbeddedDocuments("Region", [
            { name: "Stand", shapes: [{ type: "rectangle", x: 200, y: 200, width: 800, height: 600 }], flags: { "${MOD}": { room: true } }, behaviors: [] },
            { name: "Gallery", shapes: [{ type: "rectangle", x: 1200, y: 200, width: 800, height: 600 }], flags: { "${MOD}": { room: true } }, behaviors: [] }]);
        const token = (name, actorId, x, hidden = true) => ({ name, actorId, actorLink: true, x, y: 400, width: 1, height: 1, hidden, flags: {},
            texture: { src: "icons/svg/mystery-man.svg" } });
        await hall.createEmbeddedDocuments("Token", [token("Aiko", "${IDS.aiko}", 300), token("Botan", "${IDS.botan}", 400), token("Chie", "${IDS.chie}", 500),
            token("Ghost", ghost.id, 600), token("Monokuma", "ACTORMONOKUMA000", 700), token("Test", test.id, 800), token("Decor", decor.id, 1500, false)]);
        return { hall: hall.id, died, dead: game.drpg.isDeadForGm(ghost), tokens: hall.tokens.size };`, { timeout: 60000 });
    /* The scenes linked and the cast chosen as a GM does it since E13 C5: in Room Setup's Scenes tab, its window drawn on the
       GM (over the Academy, the scene the GM views), the Academy picked as the school and the hall as the trial hall, the
       hall's cast list drawn for it, Chie unticked and the dead student ticked (nobody plays him, so he is hidden by default);
       Aiko, Botan and Monokuma as \`defaultReveal\` has them, the test student hidden. Until C5 this phase wrote the setting
       and \`saveTrialCast\` from the console. */
    const tab = await gm.eval(`${UNTIL} ${HALL} const V = await import("${repoUrl}/scripts/vault.mjs"); const R = await import("${repoUrl}/scripts/rooms.mjs");
        const T = await import("${repoUrl}/scripts/trial-scene.mjs");
        const title = game.i18n.format("DRPG.Vault.manageTitleOn", { scene: academy.name });
        const drawn = () => [...foundry.applications.instances.values()].find(a => a.rendered && a.options?.window?.title === title);
        const byName = name => hall.tokens.find(t => t.name === name).id;
        const was = globalThis.__dialogWindows; globalThis.__dialogWindows = true;
        let read = null, closed = "hung";
        try {
            const pending = V.openRoomSetupDialog();
            const el = (await until(() => drawn()?.element, 8000)) ?? null;
            const field = name => el?.querySelector(\`[name="\${name}"]\`) ?? null;
            const pick = (role, id) => { const select = field("scenes:" + role); if (select) { select.value = id; select.dispatchEvent(new Event("change")); } };
            pick("school", academy.id);
            pick("trial", hall.id);
            const box = name => field("cast:" + byName(name));
            read = { last: [...(el?.querySelectorAll("[data-drpg-tab]") ?? [])].at(-1)?.dataset.drpgTab ?? null,
                warnings: [...(el?.querySelectorAll("[data-drpg-scene-warning]") ?? [])].map(p => p.dataset.drpgSceneWarning),
                rooms: el?.querySelector('[data-drpg-scene-warning="hallHasRooms"]')?.textContent
                    === game.i18n.format("DRPG.TrialScene.hallHasRooms", { names: "Gallery, Stand" }),
                ticks: Object.fromEntries(["Aiko", "Botan", "Chie", "Ghost", "Monokuma", "Test"].map(name => [name, box(name)?.checked ?? null])),
                held: Boolean(el?.querySelector('footer button[data-action="ok"]')?.disabled) };
            if (box("Chie")) box("Chie").checked = false;
            if (box("Ghost")) box("Ghost").checked = true;
            el?.querySelector('footer button[data-action="ok"]')?.click();
            closed = await Promise.race([pending.then(() => "closed"), new Promise(r => setTimeout(() => r("hung"), 8000))]);
        } finally { globalThis.__dialogWindows = was; }
        await new Promise(r => setTimeout(r, 800));
        const roles = R.sceneRoles(), stored = T.readTrialCast(hall);
        const names = Object.fromEntries(Object.entries(stored).map(([id, reveal]) => [hall.tokens.get(id)?.name ?? id, reveal]));
        return { read, closed, linked: roles.school === academy.id && roles.trial === hall.id, stored: names };`, { timeout: 60000 });
    Object.assign(built, { linked: tab.linked, chose: tab.linked && J(tab.stored) === J({ Chie: false, Ghost: true }) });
    await settle(400);
    /* Since E13 fix r1-F3 the tab also names a hall nobody prepared (token vision, global light or exploration fog as
       Foundry leaves them; "Prepare the hall" is not ticked here): "hallDark". */
    check("a0: Room Setup's last tab, Scenes, links the Academy and the hall, names the hall's two rooms and that it is unprepared, draws the hall's cast as `defaultReveal` has it, and stores Chie unticked and the dead student ticked (E13 C5)",
        tab.closed === "closed" && tab.read?.last === "scenes" && J(tab.read.warnings) === J(["hallHasRooms", "hallDark"]) && tab.read.rooms === true && tab.read.held === false
            && J(tab.read.ticks) === J({ Aiko: true, Botan: true, Chie: true, Ghost: false, Monokuma: true, Test: false }) && built.chose === true,
        J(tab), { flow: "trial-scene" });
    const before = await readAll();
    const opened = await gm.eval(`const { setClock } = await import("${repoUrl}/scripts/clock.mjs"); const { getClock } = await import("${repoUrl}/scripts/settings.mjs");
        await setClock({ phase: "classTrial" }); await new Promise(r => setTimeout(r, 800)); return getClock().phase;`, { timeout: 60000 });
    await settle(400);
    const inTrial = await readAll();
    note(`a: the hall ${built.hall}, ${built.tokens} tokens, the Ghost dead ${built.dead}; phase ${opened}`);
    /* Read 12.10.2026 at C2's tree: every browser still showed the school, the school active. Since E13 C3 entering the
       trial activates the hall, so Foundry takes every browser there. */
    check("a1: setClock opens the Class Trial and every browser shows the hall, the hall active (E13 C3)",
        built.tokens === 7 && built.dead === true && opened === "classTrial" && views(inTrial).every(v => v === "hall")
            && Object.values(inTrial).every(r => r.active === "hall"),
        J({ built, opened, views: views(inTrial) }), { flow: "trial-scene" });
    /* Read 12.10.2026 at C1's tree: no hall token shown. Since E13 C2 the module shows the GMs' choice on entering the trial. */
    check("a2: the GM's choice is shown on every browser - Aiko, Botan, the dead student and Monokuma, the decoration as it was - none created or deleted, the ids as before (E13 C2)",
        built.chose === true && Object.entries(inTrial).every(([who, r]) => before[who].made === 7 && J(shown(before[who])) === J(["Decor"])
            && J(shown(r)) === J([...CHOICE, "Decor"].sort()) && J(r.ids) === J(before[who].ids) && r.made === before[who].made && r.gone === before[who].gone),
        J({ chose: built.chose, before, after: inTrial }), { flow: "trial-scene" });
    /* A player hides their own hall token from their browser (whether Foundry v14 lets an owner do it is LIVE-E13-08; the
       harness lets the write through): the primary puts it back and tells the GMs. */
    const putBack = await p1.eval(`${HALL} const t = hall.tokens.find(x => x.name === "Aiko"); let wrote = true;
        try { await t.update({ hidden: true }); } catch { wrote = false; }
        return wrote;`, { timeout: 30000 });
    await settle(1200);
    const afterPut = await readAll();
    const toldPut = await gm.eval(`const { wordsOf } = await import("${repoUrl}/scripts/secret.mjs");
        const text = "<p>" + game.i18n.format("DRPG.TrialScene.hiddenPutBack", { user: game.users.get("${IDS.p1}").name, name: "Aiko" }) + "</p>";
        const told = [];
        for (const m of game.messages) if (await wordsOf(m, 2000) === text) told.push((m.whisper ?? []).slice().sort());
        return told;`, { timeout: 60000 });
    check("a3: p1 hiding Aiko's hall token from its own browser is put back by the primary - shown on every browser - and the GMs are told (E13 C2)",
        putBack === true && Object.values(afterPut).every(r => r.hidden.Aiko === false && J(shown(r)) === J([...CHOICE, "Decor"].sort()))
            && toldPut.length === 1 && J(toldPut[0]) === J([IDS.gm]),
        J({ putBack, afterPut: Object.fromEntries(Object.entries(afterPut).map(([who, r]) => [who, shown(r)])), toldPut }), { flow: "trial-scene" });
    /* The dark hall on entering (E13 fix r1-F3, 12.10.2026; goal S07-47): the hall was linked without "Prepare the hall",
       and until the fix entering the trial whispered the GMs only the students the hall has no token for (none here). */
    const toldDark = await gm.eval(`${HALL} const { wordsOf } = await import("${repoUrl}/scripts/secret.mjs");
        const T = await import("${repoUrl}/scripts/trial-scene.mjs");
        const text = "<p>" + game.i18n.localize("DRPG.TrialScene.hallDark") + "</p>";
        const told = [];
        for (const m of game.messages) if (await wordsOf(m, 2000) === text) told.push((m.whisper ?? []).slice().sort());
        return { unprepared: Object.keys(T.hallPreparePatch(hall)).sort(), told };`, { timeout: 60000 });
    check("a4: entering the trial with an unprepared hall whispers the GMs to prepare it, once (E13 fix r1-F3)",
        toldDark.unprepared.length > 0 && toldDark.told.length === 1 && J(toldDark.told[0]) === J([IDS.gm]),
        J(toldDark), { flow: "trial-scene" });
    const handA = await byHand();
    await settle(400);
    note(`a: by hand ${J(handA)} (since E13 C2 the module has shown the choice and since C3 activated the hall: nothing left to do)`);

    /* ------------------------------ b. a move in the hall ------------------------------ */
    phase("b: a player moves in the hall during the trial", { flow: "trial-scene" });
    const ops0 = opLog.length, settings0 = settingLog.length;
    const moved = await p1.eval(`${HALL} const M = await import("${repoUrl}/scripts/movement.mjs"); const veto = game.i18n.localize("DRPG.Trial.moveLocked");
        const aiko = game.actors.get("${IDS.aiko}"), t = hall.tokens.find(x => x.name === "Aiko");
        const told = globalThis.__notifications.length, chat = game.messages.size, actions = aiko.system.resources.actions.value;
        const from = M.roomOfToken(t);
        await t.update({ x: 1500, y: 400 });
        await new Promise(r => setTimeout(r, 1500));
        return { from, to: M.roomOfToken(hall.tokens.get(t.id)), at: [hall.tokens.get(t.id).x, hall.tokens.get(t.id).y],
            told: globalThis.__notifications.slice(told).map(n => n.level + ":" + n.msg), chat: game.messages.size - chat,
            actions: [actions, aiko.system.resources.actions.value], veto };`, { timeout: 30000 });
    await settle(400);
    /* Where every browser finds the school and what it makes of the hall, with the hall active and on every screen (byHand). */
    const homes = {};
    for (const c of clients) homes[c.who] = await c.eval(`${HALL} const R = await import("${repoUrl}/scripts/rooms.mjs");
        return { view: canvas.scene?.id === hall.id, active: game.scenes.active?.id === hall.id, home: R.homeScene()?.id === academy.id,
            role: R.sceneRole?.(hall) ?? null, place: R.isPlaceScene(hall), pieces: R.roomPieces(hall).length };`);
    const writes = { ops: opLog.slice(ops0).map(o => `${o.who} ${o.action} ${o.coll}${o.embeddedName ? "." + o.embeddedName : ""}`),
        settings: settingLog.slice(settings0).map(s => s.key ?? s) };
    /* Read 12.10.2026 at 48efd99: movement.mjs's courtroom veto (DRPG.Trial.moveLocked) answered the move and the token
       stayed in Stand. Since E13 C1 the hall holds no rooms, so the move is no crossing. Read 12.10.2026 with C1 before
       its arrival judge asked about the hall: the move stood, but the primary judged it from the Stand it had recorded
       before the link (the tokens are built first) and whispered the GMs the courtroom rule - ops [p1's token update,
       the GM's ChatMessage]. With the judge asking: it stands, nobody is told, nothing is charged or posted, and the one
       write is the token's own. */
    check("b1: Aiko's move across the hall's two marked regions is no crossing: it stands, nobody is told anything, nothing is charged or posted, and the one write is the token's (E13 C1)",
        built.linked === true && moved.from === null && moved.to === null && J(moved.at) === J([1500, 400]) && !moved.told.length
            && moved.chat === 0 && J(moved.actions) === J([2, 2]) && J(writes.ops) === J(["p1 embedded-update Scene.Token"]) && !writes.settings.length,
        J({ linked: built.linked, moved, writes }), { flow: "trial-scene" });
    check("b2: with the hall active and on every screen, every browser finds the school linked as the school and the hall a place for nobody (E13 C1, R115)",
        Object.values(homes).every(r => r.view && r.active && r.home && r.role === "trial" && r.place === false && r.pieces === 0),
        J(homes), { flow: "trial-scene" });

    /* ------------------------------ h. the voice in the trial ------------------------------ */
    phase("h: the voice rooms in the trial", { flow: "trial-scene" });
    const voices = {};
    const accounts = {};
    for (const c of clients) {
        const read = await c.eval(`const { voiceTargets } = await import("${repoUrl}/scripts/voice.mjs");
            const { rows, byUser } = await voiceTargets();
            return { rows: rows.map(r => [r.actor.name, r.target]), byUser: [...byUser].map(([id, r]) => [game.users.get(id)?.name ?? id, r.target]).sort() };`,
            { timeout: 30000 });
        voices[c.who] = read.rows;
        accounts[c.who] = read.byUser;
    }
    /* Read 12.10.2026 at 48efd99, the same on all four: Aiko, Botan and Monokuma in the hall's Stand, Chie (unticked,
       her hall token hidden) in the Academy's Dorm B, Daichi, the dead student and the test student with no room.
       Read 12.10.2026 with E13 C1, the same on all four: the hall is no place, so each is where their Academy token
       stands - Aiko in Dorm A, Botan in the Cafeteria, Chie in Dorm B, Monokuma in the Academy's Hall - and the three
       others with no room, as before.
       Since E13 C4 (D8) the trial is one voice room: every row and every connected account is sent to the main room
       (target null), the dead student and Monokuma too, the same on all four. */
    check("h1: in the trial every character and every connected account is sent to the one main room (target null), the hall's and the school's rooms alike, the same on every browser (E13 C4, D8, R117)",
        Object.values(voices).every(v => J(v) === J(voices.gm)) && Object.values(accounts).every(v => J(v) === J(accounts.gm))
            && voices.gm.length === 7 && voices.gm.every(([, target]) => target === null)
            && J(accounts.gm.map(([name]) => name)) === J(["GM", "PlayerOne", "PlayerThree", "PlayerTwo"]) && accounts.gm.every(([, target]) => target === null),
        J({ voices, accounts }), { flow: "trial-scene" });

    /* ------------------------------ c. closeTrial ------------------------------ */
    phase("c: closeTrial", { flow: "trial-scene" });
    const closed = await gm.eval(`const UI = await import("${repoUrl}/scripts/trial-floor-ui.mjs"); const { getClock } = await import("${repoUrl}/scripts/settings.mjs");
        const done = await UI.closeTrial(); await new Promise(r => setTimeout(r, 800)); return { done, phase: getClock().phase };`, { timeout: 60000 });
    await settle(400);
    const afterClose = await readAll();
    /* Read 12.10.2026 at C2's tree: every browser stayed on the hall. Since E13 C3 leaving the trial activates the school. */
    check("c1: closeTrial ends the trial and takes every browser to the school, the school active (E13 C3), the cast hidden, none deleted (E13 C2)",
        closed.done === true && closed.phase === "dailyLife" && views(afterClose).every(v => v === "school")
            && Object.values(afterClose).every(r => r.active === "school" && J(shown(r)) === J(["Decor"]) && J(r.ids) === J(before.gm.ids)),
        J({ closed, afterClose }), { flow: "trial-scene" });
    await handBack();
    await settle(400);

    /* ------------------------------ d. Edit campaign ------------------------------ */
    phase("d: into the trial and out of it through Edit campaign", { flow: "trial-scene" });
    /* Two windows going in (Edit campaign, then E11 C6's "Open the Class Trial"), one coming out (12.10.2026). */
    const EDIT = target => `const G = await import("${repoUrl}/scripts/gm-panel.mjs"); const { getClock } = await import("${repoUrl}/scripts/settings.mjs");
        const c = getClock(), from = globalThis.__dialogLog.length;
        globalThis.__dialogAnswers.push(() => ({ campaignName: c.campaignName ?? "", chapter: c.chapter, day: c.day ?? 1, phase: "${target}",
            session: c.session, timeOfDay: c.timeOfDay, reset: false }), "ok");
        try { await G.openClockDialog(); } finally { globalThis.__dialogAnswers.length = 0; }
        await new Promise(r => setTimeout(r, 800));
        const moves = game.i18n.format("DRPG.TrialScene.phaseSwitchesScene", { hall: "41 Trial Hall" });
        return { phase: getClock().phase, asked: globalThis.__dialogLog.slice(from).map(d => d.title),
            said: globalThis.__dialogLog.slice(from).some(d => String(d.content ?? "").includes(moves)) };`;
    const editIn = await gm.eval(EDIT("classTrial"), { timeout: 60000 });
    await settle(400);
    const dIn = await readAll();
    /* Read 12.10.2026 at C5's tree: the trial's question named the budget and the charge, not the hall. */
    check("d1: Edit campaign, asked and answered yes, opens the trial: its question says the table goes to the hall (E13 C6), every browser shows the hall (as a1: E13 C3), the GM's choice shown (as a2: E13 C2)",
        editIn.phase === "classTrial" && editIn.asked.length === 2 && editIn.said === true && views(dIn).every(v => v === "hall")
            && Object.values(dIn).every(r => J(shown(r)) === J([...CHOICE, "Decor"].sort()) && J(r.ids) === J(before.gm.ids)),
        J({ editIn, dIn }), { flow: "trial-scene" });
    await byHand();
    await settle(400);
    const editOut = await gm.eval(EDIT("dailyLife"), { timeout: 60000 });
    await settle(400);
    const dOut = await readAll();
    check("d2: Edit campaign back to Daily Life ends the trial: every browser is taken to the school (as c1: E13 C3), the cast hidden (as c1: E13 C2)",
        editOut.phase === "dailyLife" && editOut.asked.length === 1 && views(dOut).every(v => v === "school")
            && Object.values(dOut).every(r => J(shown(r)) === J(["Decor"]) && J(r.ids) === J(before.gm.ids)),
        J({ editOut, dOut }), { flow: "trial-scene" });
    await handBack();
    await settle(400);

    /* ------------------------------ f. a browser loading while the trial opens ------------------------------ */
    phase("f: a player's browser loading while the trial opens", { flow: "trial-scene" });
    await connect("p4", { holdLoading: true });
    const fOpened = await gm.eval(`const { setClock } = await import("${repoUrl}/scripts/clock.mjs"); const { getClock } = await import("${repoUrl}/scripts/settings.mjs");
        await setClock({ phase: "classTrial" }); await new Promise(r => setTimeout(r, 800)); return getClock().phase;`, { timeout: 60000 });
    const handF = await byHand();
    await settle(400);
    const held = await p4.eval(`${HALL} return { loading: canvas.loading, view: canvas.scene?.id === academy.id ? "school" : canvas.scene?.id === hall.id ? "hall" : null,
        told: globalThis.__notifications.filter(n => n.level === "warn").map(n => n.msg) };`);
    await finishLoading("p4");
    await settle(400);
    const late = await p4.eval(READ);
    /* A GM's later pull of p4 to the school while the hall stays active (Foundry's pull ends in the browser's own
       `view()`): the self-repair ran once, at the load, so the pull stands. */
    const pulled = await p4.eval(`${HALL} await academy.view(); await new Promise(r => setTimeout(r, 600));
        return canvas.scene?.id === academy.id ? "school" : canvas.scene?.id === hall.id ? "hall" : null;`, { timeout: 30000 });
    /* Read 12.10.2026 at C2's tree, the hall activated by hand: p4 warned, stayed, and showed the school after its first
       canvasReady. Since E13 C3 the module activates the hall, and p4's own browser puts its view right once on that
       first canvasReady (trial-scene.mjs `selfRepair`, Q-E13-1 c). */
    check("f1: p4, loading when the trial activates the hall, warns and stays, shows the hall after its first canvasReady (E13 C3's self-repair), and a later pull to the school stands",
        fOpened === "classTrial" && handF.activated === false && held.loading === true && held.view === "school" && held.told.length === 1
            && late.view === "hall" && late.active === "hall" && pulled === "school",
        J({ fOpened, handF, held, late, pulled }), { flow: "trial-scene" });
    await gm.eval(`const UI = await import("${repoUrl}/scripts/trial-floor-ui.mjs"); await UI.closeTrial(); return true;`, { timeout: 60000 });
    await handBack();
    await settle(400);

    /* ------------------------------ g. no second discovery after the trial ------------------------------ */
    phase("g: a body found before the trial is not found again after it", { flow: "trial-scene" });
    const walk = (actorId, room) => gm.eval(`const M = await import("${repoUrl}/scripts/movement.mjs");
        const t = game.scenes.get("${IDS.scene}").tokens.find(x => x.actorId === "${actorId}");
        const spot = M.positionIn(${J(room)}, t);
        if (spot.x === t.x && spot.y === t.y) spot.x += 10;
        await t.update(spot, { teleport: true, movementAction: "displace", animate: false });
        await new Promise(r => setTimeout(r, 1500));
        return M.roomOfToken(t);`, { timeout: 30000 });
    const found = await gm.eval(`${UNTIL} ${CARDS} const C = await import("${repoUrl}/scripts/chapter.mjs"); const M = await import("${repoUrl}/scripts/movement.mjs");
        const { bodyDiscovery, bodiesFoundIn, getClock } = await import("${repoUrl}/scripts/settings.mjs");
        const daichi = game.actors.get("${IDS.daichi}");
        const kept = Boolean(await C.killCharacter(daichi, { secret: true, keepBullets: true }));
        const room = M.roomOfActor(daichi), before = cards();
        return { kept, room, before };`, { timeout: 60000 });
    await walk(IDS.aiko, found.room);
    await walk(IDS.botan, found.room);
    const discovered = await gm.eval(`${UNTIL} ${CARDS} const { bodyDiscovery, bodiesFoundIn, getClock } = await import("${repoUrl}/scripts/settings.mjs");
        await until(() => bodyDiscovery(), 6000); await new Promise(r => setTimeout(r, 800));
        return { cards: cards(), hold: bodyDiscovery()?.room ?? null, stamps: game.settings.get("${MOD}", "bodiesFound") };`, { timeout: 30000 });
    /* The room the walks start from - and, since E13 C3b, the one End the trial sends the living to (C3's tree read the
       answer as a yes: its question was a confirm). */
    const away = found.room === "Cafeteria" ? "Storage" : "Cafeteria";
    const tried = await gm.eval(`${HALL} const { setPhase } = await import("${repoUrl}/scripts/clock.mjs"); const { getClock } = await import("${repoUrl}/scripts/settings.mjs");
        await setPhase("investigation");
        globalThis.__dialogAnswers.push("ok");
        const UI = await import("${repoUrl}/scripts/trial-floor-ui.mjs");
        const started = await UI.startClassTrial();
        await new Promise(r => setTimeout(r, 400));
        const inHall = game.scenes.active?.id === hall.id && canvas.scene?.id === hall.id;
        await game.drpg.applyVerdict({ correct: false, executedIds: ["${IDS.botan}"], blackenedIds: ["${IDS.chie}"] });
        await new Promise(r => setTimeout(r, 800));
        globalThis.__dialogAnswers.push({ sceneId: "${IDS.scene}", room: ${J(away)} });
        const ended = await UI.endClassTrial();
        await new Promise(r => setTimeout(r, 1000));
        return { started, inHall, ended, phase: getClock().phase, botan: game.drpg.isDeadForGm(game.actors.get("${IDS.botan}")),
            back: game.scenes.active?.id === "${IDS.scene}" && canvas.scene?.id === "${IDS.scene}" };`, { timeout: 90000 });
    /* Out first: the discovery's gather brought every token to the body's room, and a step inside a room enters
       none - so the walks in measured nothing until they started outside it (12.10.2026: mutants e13c0-m10 and m11,
       which make the body or the executed findable again, stayed green). And what every browser was told: with
       m10 the walk reaches a discovery and chapter.mjs's second guard (`announcedAlready`) refuses it with a
       warning on the GM and no card, so the cards and stamps alone cannot see it; today nobody is told anything. */
    const told0 = {};
    for (const c of clients) told0[c.who] = await c.eval(`return globalThis.__notifications.length;`);
    const left = [await walk(IDS.chie, away), await walk(IDS.aiko, away)];
    /* And the executed laid in that room: Botan's token stood in no room after the verdict (12.10.2026, read with
       mutant e13c0-m11, which makes an execution a body and stayed green while it did), so the GM puts it there. */
    const laid = await walk(IDS.botan, found.room);
    const walked = [await walk(IDS.chie, found.room), await walk(IDS.aiko, found.room)];
    const toldG = {};
    for (const c of clients) toldG[c.who] = await c.eval(`return globalThis.__notifications.slice(${told0[c.who]}).map(n => n.level + ":" + n.msg);`);
    const afterG = await gm.eval(`${CARDS} const { bodyDiscovery } = await import("${repoUrl}/scripts/settings.mjs");
        return { cards: cards(), hold: Boolean(bodyDiscovery()), stamps: game.settings.get("${MOD}", "bodiesFound") };`);
    /* Read 12.10.2026 at C2's tree: g1 held with the table never having left the school, so `back` measured nothing
       there. Since E13 C3 Start the Class Trial takes the table to the hall (`inHall`) and End the trial brings it back. */
    check("g1: Start the Class Trial takes the table to the hall (E13 C3) and, after End the trial takes it back to the school, Chie and Aiko walking into the room of the body found before it and of the executed Botan post no body card, tell nobody anything and leave the stamps as they were (held at 48efd99; E13 C3 keeps it)",
        found.kept && discovered.cards === found.before + 1 && tried.started === true && tried.inHall === true && tried.ended === true && tried.phase === "dailyLife" && tried.botan === true && tried.back === true
            && left.every(r => r === away) && laid === found.room && walked.every(r => r === found.room) && Object.values(toldG).every(t => !t.length) && afterG.cards === discovered.cards && J(afterG.stamps) === J(discovered.stamps),
        J({ found, discovered, tried, left, laid, walked, toldG, afterG }), { flow: "trial-scene" });

    /* ------------------------------ i. End the trial's scene and room (E13 C3b) ------------------------------ */
    phase("i: End the trial sends the living to the room the GM picks", { flow: "trial-scene" });
    /* The owner's answer f of 09.10 and items 1 and 3 of 10.10. A living student the module cannot move - its only token on
       another place scene - and a Monocub on the school (dead, and walks), made here and gone at the end of the phase; Aiko
       and Chie walked out of the room of the body and the executed, so the gather is a living token entering it. Every
       token of every scene by position and room, before and after; End the trial pressed in its window drawn on the GM, the
       body's room on the Academy chosen in it. */
    const fixI = await gm.eval(`const R = await import("${repoUrl}/scripts/rooms.mjs");
        const awayStudent = await Actor.create({ name: "S41 Away", type: "character" });
        const cub = await Actor.create({ name: "S41 Cub", type: "character", flags: { "${MOD}": { deceased: true, monocub: true } } });
        const place = await Scene.create({ name: "41 Away Place", width: 2000, height: 2000, grid: { size: 100 }, active: false, navigation: false });
        await place.createEmbeddedDocuments("Region", [{ name: "Shed", shapes: [{ type: "rectangle", x: 0, y: 0, width: 800, height: 800 }],
            flags: { "${MOD}": { [R.ROOM_FLAG]: true } }, behaviors: [] }]);
        await place.createEmbeddedDocuments("Token", [{ name: awayStudent.name, actorId: awayStudent.id, actorLink: true, x: 1200, y: 1200, width: 1, height: 1 }]);
        const [cubToken] = await game.scenes.get("${IDS.scene}").createEmbeddedDocuments("Token", [{ name: cub.name, actorId: cub.id, actorLink: true,
            x: 600, y: 600, width: 1, height: 1 }]);
        return { place: place.id, actors: [awayStudent.id, cub.id], cubToken: cubToken.id };`, { timeout: 30000 });
    const outI = [await walk(IDS.aiko, away), await walk(IDS.chie, away)];
    const PLACES = `const M = await import("${repoUrl}/scripts/movement.mjs"); const where = {};
        for (const s of game.scenes) for (const t of s.tokens) where[s.name + "/" + t.name] = { at: [t.x, t.y], room: M.roomOfToken(t) };`;
    const i0 = await gm.eval(`${PLACES} ${CARDS} return { where, cards: cards(), stamps: game.settings.get("${MOD}", "bodiesFound"), said: game.messages.map(m => m.id) };`);
    await gm.eval(`const { setClock } = await import("${repoUrl}/scripts/clock.mjs"); await setClock({ phase: "classTrial" });
        await new Promise(r => setTimeout(r, 800)); return true;`, { timeout: 60000 });
    await settle(400);
    const endI = await gm.eval(`${UNTIL} const UI = await import("${repoUrl}/scripts/trial-floor-ui.mjs"); const { getClock } = await import("${repoUrl}/scripts/settings.mjs");
        const title = game.i18n.localize("DRPG.Floor.endTrial");
        const drawn = () => [...foundry.applications.instances.values()].find(a => a.rendered && a.options?.window?.title === title);
        const was = globalThis.__dialogWindows; globalThis.__dialogWindows = true;
        let read = null, ended = "hung";
        try {
            const pending = UI.endClassTrial();
            const el = (await until(() => drawn()?.element, 8000)) ?? null;
            const select = el?.querySelector('select[name="room"]'), options = [...(select?.options ?? [])];
            read = { buttons: [...(el?.querySelectorAll("footer button[data-action]") ?? [])].map(b => b.dataset.action),
                options: options.map(o => (game.scenes.get(o.dataset.scene)?.name ?? o.dataset.scene) + "/" + o.value), first: select?.selectedOptions?.[0]?.value ?? null };
            const pick = options.find(o => o.dataset.scene === "${IDS.scene}" && o.value === ${J(found.room)});
            if (pick) pick.selected = true;
            el?.querySelector('footer button[data-action="ok"]')?.click();
            ended = await Promise.race([pending, new Promise(r => setTimeout(() => r("hung"), 8000))]);
        } finally { globalThis.__dialogWindows = was; }
        await new Promise(r => setTimeout(r, 1500));
        return { read, ended, phase: getClock().phase };`, { timeout: 60000 });
    await settle(400);
    const viewsI = await readAll();
    /* A whisper's words are read as the GM's browser reads them (secret.mjs `wordsOf`): its `content` is a placeholder. */
    const i1 = await gm.eval(`${PLACES} ${CARDS} const said = new Set(${J(i0.said)}); const { wordsOf } = await import("${repoUrl}/scripts/secret.mjs");
        return { where, cards: cards(), stamps: game.settings.get("${MOD}", "bodiesFound"),
            told: await Promise.all(game.messages.filter(m => !said.has(m.id) && (m.whisper?.length ?? 0) > 0).map(m => wordsOf(m, 2000))) };`);
    await gm.eval(`await game.scenes.get(${J(fixI.place)})?.delete(); await game.scenes.get("${IDS.scene}").tokens.get(${J(fixI.cubToken)})?.delete();
        for (const id of ${J(fixI.actors)}) await game.actors.get(id)?.delete(); return true;`, { timeout: 30000 });
    const academyName = Object.keys(i0.where).find(key => key.endsWith("/Aiko") && i0.where[key].room !== null)?.split("/")[0] ?? null;
    const MOVERS = ["Aiko", "Chie", "S41 Cub"].map(name => `${academyName}/${name}`);
    const movedI = Object.keys(i0.where).filter(key => J(i0.where[key].at) !== J(i1.where[key]?.at)).sort();
    check("i1: End the trial's window offers End the trial and Cancel only and every room of each place scene, the school's first room chosen; ended there, every browser is on the school with the hall's cast hidden (E13 C3b; the owner's items 3 of 10.10)",
        J(endI.read?.buttons) === J(["ok", "cancel"]) && endI.read.options[0]?.startsWith(`${academyName}/`) && endI.read.options.includes(`${academyName}/${found.room}`)
            && endI.read.options.includes("41 Away Place/Shed") && endI.read.first === endI.read.options[0].split("/").slice(1).join("/")
            && endI.ended === true && endI.phase === "dailyLife" && views(viewsI).every(v => v === "school") && Object.values(viewsI).every(r => J(shown(r)) === J(["Decor"])),
        J({ fixI, outI, endI, viewsI: views(viewsI) }), { flow: "trial-scene" });
    check("i2: the living on the school and the Monocub go to the chosen room; the dead, Monokuma, the hall's tokens and the student on another scene stay where they stood (E13 C3b; the owner's f)",
        academyName && outI.every(r => r === away) && J(movedI) === J([...MOVERS].sort()) && MOVERS.every(key => i1.where[key]?.room === found.room),
        J({ academyName, movedI, before: i0.where, after: i1.where }), { flow: "trial-scene" });
    check("i3: the GMs are told once how many went and that the student on another scene was not moved, by name (E13 C3b; the owner's item 1 of 10.10)",
        i1.told.filter(text => text.includes("S41 Away")).length === 1 && i1.told.some(text => text.includes("S41 Away") && text.includes(found.room)),
        J(i1.told), { flow: "trial-scene" });
    check("i4: the living entering the room of the body and the executed post no body card and leave the stamps as they were (E13 C3b; the ledger's V12)",
        i1.cards === i0.cards && J(i1.stamps) === J(i0.stamps), J({ before: [i0.cards, i0.stamps], after: [i1.cards, i1.stamps] }), { flow: "trial-scene" });

    /* ------------------------------ j. the chapter end during the trial ------------------------------ */
    phase("j: the chapter end ends the trial", { flow: "trial-scene" });
    /* The owner's 10.10 item 2: the chapter-end screen offers no scene or room; it switches to the school and moves nobody.
       Every token of the school by id and position, before the trial and after the chapter end. */
    const SPOTS = `return Object.fromEntries(game.scenes.get("${IDS.scene}").tokens.map(t => [t.id, [t.x, t.y, t.elevation ?? 0]]));`;
    const spots0 = await gm.eval(SPOTS);
    await gm.eval(`const { setClock } = await import("${repoUrl}/scripts/clock.mjs"); await setClock({ phase: "classTrial" });
        await new Promise(r => setTimeout(r, 800)); return true;`, { timeout: 60000 });
    await settle(400);
    const jIn = await readAll();
    const ended = await gm.eval(`const C = await import("${repoUrl}/scripts/chapter.mjs"); const { getClock } = await import("${repoUrl}/scripts/settings.mjs");
        const result = await C.applyChapterEnd({ endTrial: true }); await new Promise(r => setTimeout(r, 800));
        return { result: result === null ? null : typeof result, phase: getClock().phase };`, { timeout: 90000 });
    await settle(400);
    const jOut = await readAll();
    const spots1 = await gm.eval(SPOTS);
    check("j1: the chapter end with End the trial ticked takes every browser from the hall to the school, the cast hidden, and moves no token of the school (E13 C3; the owner's 10.10 item 2)",
        views(jIn).every(v => v === "hall") && ended.phase === "dailyLife" && views(jOut).every(v => v === "school")
            && Object.values(jOut).every(r => r.active === "school" && J(shown(r)) === J(["Decor"]) && J(r.ids) === J(before.gm.ids)) && J(spots1) === J(spots0),
        J({ jIn: views(jIn), ended, jOut, spots0, spots1 }), { flow: "trial-scene" });

    /* ------------------------------ k. Start the Class Trial's window, and the doors inside the trial ------------------------------ */
    phase("k: Start the Class Trial says where the table goes, and the table moves inside the trial", { flow: "trial-scene" });
    /* Read 12.10.2026 at C5's tree: the window named neither the hall nor the rule and preloaded nothing; the console
       had no door and game.drpg no showCourtroom. Four tokens: Aiko and Botan (played - Botan executed in g, the dead
       shown, Q-E13-1 a), the dead student ticked in a0, Monokuma; Chie unticked, the test student nobody plays. */
    const startK = await gm.eval(`${UNTIL} ${HALL} const UI = await import("${repoUrl}/scripts/trial-floor-ui.mjs"); const { plural } = await import("${repoUrl}/scripts/utils.mjs");
        const { getClock } = await import("${repoUrl}/scripts/settings.mjs");
        const title = game.i18n.localize("DRPG.Floor.startTrial");
        const drawn = () => [...foundry.applications.instances.values()].find(a => a.rendered && a.options?.window?.title === title);
        const from = globalThis.__scenePreloads.length;
        const was = globalThis.__dialogWindows; globalThis.__dialogWindows = true;
        let text = null, pending = null;
        try {
            pending = UI.startClassTrial();
            const el = (await until(() => drawn()?.element, 8000)) ?? null;
            text = el?.querySelector("form")?.textContent?.replace(/\\s+/g, " ") ?? null;
            el?.querySelector('footer button[data-action="ok"]')?.click();
        } finally { globalThis.__dialogWindows = was; }
        const started = await Promise.race([pending, new Promise(r => setTimeout(() => r("hung"), 15000))]);
        await new Promise(r => setTimeout(r, 800));
        return { started, phase: getClock().phase, drawn: text !== null, preloads: globalThis.__scenePreloads.slice(from), hall: hall.id,
            hallLine: Boolean(text?.includes(plural("DRPG.Floor.startTrialHall", { n: 4, hall: "41 Trial Hall" }))),
            rule: Boolean(text?.includes(game.i18n.localize("DRPG.Floor.tableRuleDead"))) };`, { timeout: 60000 });
    await settle(400);
    const kIn = await readAll();
    check("k1: Start the Class Trial's window names the hall and the four tokens it will show and states the table's rule; the hall is preloaded on every client before the click, and the trial opens there (E13 C6)",
        startK.started === true && startK.phase === "classTrial" && startK.hallLine && startK.rule && J(startK.preloads) === J([{ sceneId: startK.hall, push: true }])
            && views(kIn).every(v => v === "hall") && Object.values(kIn).every(r => J(shown(r)) === J([...CHOICE, "Decor"].sort())),
        J({ startK, kIn: views(kIn) }), { flow: "trial-scene" });
    /* The console drawn on the GM: its line and door, Back to school pressed, then the console it reopens on. */
    const consoleK = await gm.eval(`${UNTIL} ${HALL} const UI = await import("${repoUrl}/scripts/trial-floor-ui.mjs"); const { getClock } = await import("${repoUrl}/scripts/settings.mjs");
        const title = game.i18n.localize("DRPG.Floor.manageTrial");
        const windows = () => [...foundry.applications.instances.values()].filter(a => a.rendered && a.options?.window?.title === title);
        const on = scene => game.i18n.format("DRPG.TrialScene.tableOn", { scene: scene.name });
        const read = el => ({ line: [...el.querySelectorAll(".drpg-trial-console p")].map(p => p.textContent.trim()).filter(t => t === on(hall) || t === on(academy)),
            doors: [...el.querySelectorAll("footer button[data-action]")].map(b => b.dataset.action).filter(a => a === "showHall" || a === "backToSchool") });
        const was = globalThis.__dialogWindows; globalThis.__dialogWindows = true;
        const seen = []; let pending = null, done = "hung";
        try {
            pending = UI.manageClassTrial();
            const first = (await until(() => windows()[0]?.element, 8000)) ?? null;
            if (first) seen.push(read(first));
            first?.querySelector('footer button[data-action="backToSchool"]')?.click();
            const second = (await until(() => windows().find(a => a.element && a.element !== first)?.element, 15000)) ?? null;
            if (second) seen.push(read(second));
            second?.querySelector('footer button[data-action="close"]')?.click();
            done = await Promise.race([pending.then(() => "closed"), new Promise(r => setTimeout(() => r("hung"), 8000))]);
        } finally { globalThis.__dialogWindows = was; }
        return { seen, done, phase: getClock().phase, lines: [on(hall), on(academy)] };`, { timeout: 60000 });
    await settle(400);
    const kBack = await readAll();
    check("k2: inside the trial the console says the table is on the hall and offers Back to school; pressed, every browser shows the school, the cast hidden, the phase kept, and the console says the table is on the school and offers Show the hall (E13 C6)",
        consoleK.done === "closed" && consoleK.phase === "classTrial" && J(consoleK.seen) === J([{ line: [consoleK.lines[0]], doors: ["backToSchool"] }, { line: [consoleK.lines[1]], doors: ["showHall"] }])
            && views(kBack).every(v => v === "school") && Object.values(kBack).every(r => r.active === "school" && J(shown(r)) === J(["Decor"]) && J(r.ids) === J(before.gm.ids)),
        J({ consoleK, kBack }), { flow: "trial-scene" });
    const playerDoor = await p1.eval(`return typeof game.drpg.showCourtroom === "function" ? await game.drpg.showCourtroom() : "absent";`, { timeout: 30000 });
    await settle(400);
    const kPlayer = await readAll();
    const apiK = await gm.eval(`${HALL} const { getClock } = await import("${repoUrl}/scripts/settings.mjs");
        const door = typeof game.drpg.showCourtroom === "function" ? await game.drpg.showCourtroom() : "absent";
        await new Promise(r => setTimeout(r, 800));
        const report = typeof game.drpg.trialSceneReport === "function" ? await game.drpg.trialSceneReport() : null;
        const name = id => hall.tokens.get(id)?.name ?? id;
        return { door: door && typeof door === "object" ? { hall: door.hall === hall.id, activated: door.activated } : door, phase: getClock().phase,
            report: report && { school: report.school === academy.id, hall: report.hall === hall.id, table: report.table === hall.id,
                shown: report.shown.map(name).sort(), warnings: report.warnings.map(w => w.key) } };`, { timeout: 60000 });
    await settle(400);
    const kHall = await readAll();
    check("k3: a player's showCourtroom changes nothing; the GM's takes every browser back to the hall with the GM's choice shown, the phase kept, and trialSceneReport names the school, the hall, the table and the four tokens (E13 C6)",
        playerDoor === null && views(kPlayer).every(v => v === "school") && J(apiK.door) === J({ hall: true, activated: true }) && apiK.phase === "classTrial"
            && J(apiK.report) === J({ school: true, hall: true, table: true, shown: [...CHOICE].sort(), warnings: ["hallHasRooms", "hallDark"] })
            && views(kHall).every(v => v === "hall") && Object.values(kHall).every(r => J(shown(r)) === J([...CHOICE, "Decor"].sort())),
        J({ playerDoor, kPlayer: views(kPlayer), apiK, kHall }), { flow: "trial-scene" });
    await gm.eval(`const UI = await import("${repoUrl}/scripts/trial-floor-ui.mjs"); await UI.closeTrial(); await new Promise(r => setTimeout(r, 800)); return true;`, { timeout: 60000 });
    await settle(400);
    /* Outside the trial both doors are shut, for a GM too: the hall is never shown away from the trial (C5's tab hides
       its cast there), and each refusal warns with the console's "No Class Trial is running" line. */
    const outK = await gm.eval(`const { getClock } = await import("${repoUrl}/scripts/settings.mjs"); const from = globalThis.__notifications.length;
        const doors = [];
        for (const name of ["showCourtroom", "showSchool"]) doors.push(typeof game.drpg[name] === "function" ? await game.drpg[name]() : "absent");
        await new Promise(r => setTimeout(r, 800));
        const notStarted = game.i18n.localize("DRPG.Floor.lead.start");
        return { doors, phase: getClock().phase, warned: globalThis.__notifications.slice(from).filter(n => n.level === "warn" && n.msg === notStarted).length };`, { timeout: 60000 });
    await settle(400);
    const kOut = await readAll();
    check("k4: after End the trial the GM's showCourtroom and showSchool each warn that no trial runs and change nothing - every browser on the school, the cast hidden (E13 C6)",
        J(outK) === J({ doors: [null, null], phase: "dailyLife", warned: 2 })
            && views(kOut).every(v => v === "school") && Object.values(kOut).every(r => r.active === "school" && J(shown(r)) === J(["Decor"])),
        J({ outK, kOut: views(kOut) }), { flow: "trial-scene" });

    /* ------------------------------ e. the season reset during the trial ------------------------------ */
    phase("e: the season reset during the trial", { flow: "trial-scene" });
    await gm.eval(`const { setClock } = await import("${repoUrl}/scripts/clock.mjs"); await setClock({ phase: "classTrial" }); return true;`, { timeout: 60000 });
    const handE = await byHand();
    await settle(400);
    const reset = await gm.eval(`const R = await import("${repoUrl}/scripts/season-setup.mjs"); const X = await import("${repoUrl}/scripts/season-exceptions.mjs");
        const { gmStoresIdle } = await import("${repoUrl}/scripts/gm-store.mjs"); const { getClock } = await import("${repoUrl}/scripts/settings.mjs");
        const word = game.i18n.localize("DRPG.Season.resetWord");
        globalThis.__dialogAnswers.push(config => { const c = config?.content;
            return { word, ticked: X.RESET_GROUPS.map(g => g.key), cast: { to: c?.querySelector?.('[name="castTo"]:checked')?.value ?? null } }; });
        let result = null;
        try { result = await R.resetSeason(); } finally { globalThis.__dialogAnswers.length = 0; }
        await gmStoresIdle(); await new Promise(r => setTimeout(r, 800));
        return { done: Boolean(result), phase: getClock().phase, season: getClock().season };`, { timeout: 120000 });
    await settle(400);
    const afterReset = await readAll();
    /* Read 12.10.2026 at C2's tree, the hall activated by hand: the reset left it active and on every browser. Since E13 C3
       the reset's clock step leaves the trial through the same door and takes the table to the school. */
    check("e1: the season reset during the trial takes every browser to the school, the school active (E13 C3), the cast hidden (E13 C2)",
        handE.activated === false && reset.done && reset.phase === "dailyLife" && views(afterReset).every(v => v === "school")
            && Object.values(afterReset).every(r => r.active === "school" && J(shown(r)) === J(["Decor"]) && J(r.ids) === J(before.gm.ids)),
        J({ handE, reset, afterReset }), { flow: "trial-scene" });
}
