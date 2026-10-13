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
 *      hall token from its own browser and the primary puts it back. Since E13 fix r1-F2: (a4) two changes
 *      of one player landing before the primary answers the first, twice from p1 on Aiko and once from p2
 *      on Botan the GM hid by hand; (a5) p3 drops a shown token of Chie, unticked, into the hall; since E13 fix
 *      r2-H2 (a7) p3 deletes it again.
 *   b  p1 moves Aiko's hall token from one of the hall's rooms to the other during the trial: vetoes,
 *      Aiko's actions, the chat, and every other write the move caused; and (C1) what every browser, the
 *      hall active and on its screen, takes for the school and makes of the hall.
 *   h  `voiceTargets()` on each browser in the trial: since E13 C4 one room for everybody (D8).
 *   l  (fix r1-F2) Room Setup's Scenes tab in the trial: the GM unlinks the hall; Apply held, and pressed anyway.
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
 *      the body cards and discovery stamps, before and after (the ledger's V12). Since E81 fix r1-D3 only the cast
 *      goes: the three students made here are ticked, and Chie, unticked since a, stays where she stood, unnamed (i5).
 *   j  (C3) the chapter end during the trial (`applyChapterEnd({ endTrial: true })`, the screen's "End the
 *      trial" ticked; the owner's 10.10 item 2: it offers no scene or room): where every browser looks, the
 *      hall's tokens, and whether any token of the school moved.
 *   k  (C6) Start the Class Trial through its window drawn on the GM: what it says of the hall, the tokens it
 *      will show and the table's rule, the hall's preload, and where every browser goes; then, inside the trial,
 *      the console's Back to school, a player's and then the GM's `showCourtroom` through game.drpg,
 *      with `trialSceneReport`: where every browser looks, the hall's tokens, the phase; and after End the
 *      trial, both doors refused to the GM.
 *   s  (E81 fix r1-D2) the module's tokens in the hall: (k1b) Start the Class Trial's window cancelled stores and starts
 *      nothing; (s1) a made token the GM moves is made there at the next entry; (s2) an entry inside the trial makes
 *      no second token, and a leave the GM's browser never ran is tidied by the next GM's \`ready\`; (s3) a Scenes tab
 *      Apply in the trial makes and deletes the token of the actor it ticks and unticks.
 *   z  (fix r2-H2) outside the trial and in the one after: a GM's show of Aiko heard, the hall unlinked, Aiko
 *      hidden by hand on the unlinked hall, the hall linked again; then p1 shows Aiko. (l2) a trial opened with
 *      no hall linked, and the Scenes tab with a first hall picked.
 *   r  (fix r2-H2) in the trial, Botan hidden by the GM's hand, then a second GM `gm0` loads and is the
 *      primary; p2 shows Botan.
 *   e  the season reset during the trial: the active scene, where every browser looks, the hall's tokens.
 *   m  (fix r2-H3) the tier-2 suite run by name at this table, the hall linked: the trial console test and the hall
 *      it must leave alone, and the four End the trial carry tests with a fence token refused by a module, and with a
 *      student made after the fence.
 * Since E13 C3 the module takes the table: entering the trial activates the hall and leaving it the school
 * (trial-scene.mjs `followPhase`), so `byHand` and `handBack` find nothing left to do.
 * Since E81 DZ6 (fix r1-D2, 12.10.2026; the DZ6 design's section 9) the hall holds the GMs' tokens of Botan, Monokuma,
 * the test student and the decoration only; Aiko and the dead student, ticked with none there, get a token the module
 * makes as the trial opens (trial-scene.mjs `stageHall`) and deletes as it ends, noting where it stood (`trialSeats`);
 * a token the GMs placed is shown or hidden and never deleted. Aiko's and the dead student's prototype tokens are named
 * "Aiko" and "Ghost" here, so the made tokens carry the names the checks read by. z places a token of Aiko's by hand
 * for its put-back readings and takes it away after.
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
 * E13 fix r1-F2's a4, a5 and l1: 28 checks in 66.7 s, one run on 12.10.2026 (`--verbose`, lane A; whether a run of another
 * worktree was on the machine at the time not checked).
 * E13 fix r2-H3's m1-m3 (six suite runs by name): 32 checks in 86.6 s, one run on 12.10.2026 (`--verbose`, lane A; m3
 *   then failed on a reading of its own, fixed since; whether a run of another worktree was on the machine not checked).
 * E13 fix r2-H2's a7, z1-z3, l2 and r1 (gm0's connect among them): 35 checks in 101.9 s, one run on 12.10.2026
 * (`--verbose`, lane A; whether a run of another worktree was on the machine at the time not checked) - a third of
 * run-all.mjs's five minutes, so still no `timeoutMs`.
 * The checkpoint k6 at a8f036e (S/e12run/k6/cmp.txt, after E13 fix r2-H2's merge): 38 checks in 119.2 s, one run on
 * 12.10.2026 in the checkpoint's ci set (whether alone on its lane not read) - about 40% of the five minutes.
 * E13 fix l1-L1's n1 and n2: 40 checks in 136.7 s, one run on 12.10.2026 (a2.sh's fast set, lane A, two other lanes
 *   running beside it; a0, a6 and k3 failed there as they do at 8b4974a without n, alone: 35/38 in 121.3 s) - still no
 *   `timeoutMs`.
 * E13 fix l2-L2's a00 (the hall put back unprepared): 41 checks in 127.9 s, one run on 12.10.2026 (`--verbose`, lane A;
 *   no other harness client of the e12 trees alive when it started, other worktrees not checked) - still no `timeoutMs`.
 */
export const layers = ["ci"];
const GM0 = "USERGA0000000000";
/* f's player, seeded inactive and brought to the table held at the end of its load (cluster.mjs `connect`). */
export const accounts = [
    { who: "p4", id: "USERP4000000000A", name: "Player Four", role: 1, character: null, color: "#66aa66", late: true },
    /* r's GM, whose browser loads during the trial; its id sorts before the seeded GM's, so it is the primary while it is
       at the table (utils.mjs `primaryGmId`). Seeded inactive, it is one of the GMs every whisper goes to (`gmIds`). */
    { who: "gm0", id: GM0, name: "Returning GM", role: 4, character: null, color: "#aa0000", late: true }
];

const MOD = "danganronpa-rpg";
const J = value => JSON.stringify(value);
/* The hall's tokens by name; CHOICE is the GM's (since C2 kept in a GmStore, `trialCast`), CAST every token the module may show. */
const CAST = ["Aiko", "Botan", "Chie", "Ghost", "Monokuma", "Test"];
/* E81 DZ6: the module's tokens of the cast, made as the trial opens - the ticked with no token the GMs placed. */
const MADE = ["Aiko", "Ghost"];
const CHOICE = ["Aiko", "Botan", "Ghost", "Monokuma"];

export async function run({ gm, gm0, p1, p2, p3, p4, check, note, phase, settle, connect, disconnect, finishLoading, opLog, settingLog, IDS, repoUrl }) {
    const clients = [gm, p1, p2, p3];
    /* Every whisper to the GMs goes to every GM account, gm0's included while it is away (utils.mjs `gmIds`). */
    const GMS = J([IDS.gm, GM0].sort());
    const UNTIL = `const until = async (test, ms = 6000) => { const end = Date.now() + ms; let v; while (!(v = await test()) && Date.now() < end) await new Promise(r => setTimeout(r, 100)); return v; };`;
    const HALL = `const hall = game.scenes.find(s => s.name === "41 Trial Hall"), academy = game.scenes.get("${IDS.scene}");`;
    const CARDS = `const cards = () => game.messages.filter(m => m.flags?.["${MOD}"]?.sfx?.key === "bodyFound").length;`;
    /* What one browser shows and holds of the hall: the scene on its canvas, the active one, each hall token's `hidden`
       by name, the hall's token ids, and the creates and deletes it has been sent (client-entry.mjs `__documentCounts`). */
    const READ = `${HALL} return { view: canvas.scene?.id === hall?.id ? "hall" : canvas.scene?.id === academy.id ? "school" : canvas.scene?.id ?? null,
        active: game.scenes.active?.id === hall?.id ? "hall" : game.scenes.active?.id === academy.id ? "school" : game.scenes.active?.id ?? null,
        hidden: Object.fromEntries((hall?.tokens.contents ?? []).map(t => [t.name, t.hidden])), ids: (hall?.tokens.contents ?? []).map(t => t.id).sort(),
        made: (globalThis.__documentCounts.createToken ?? 0), gone: (globalThis.__documentCounts.deleteToken ?? 0),
        open: Object.entries(hall?.getFlag("${MOD}", "trialSeats") ?? {}).filter(([, seat]) => seat?.token).map(([id]) => id).sort(),
        at: Object.fromEntries((hall?.tokens.contents ?? []).map(t => [t.name, [t.x, t.y]])) };`;
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
    /* The hall nobody prepared (E13 fix l2-L2, 12.10.2026). Its two rooms are drawn before it is linked, so the hall gains
       its first room while it is still a place, and the room fog on the primary GM puts it into room-based vision at once
       (fog.mjs \`prepareRoomScene\` -> \`applySceneVisionMode\`, E12 C7): token vision off, global light on, exploration fog
       off, and the record \`visionBefore\` that only that writer leaves. Until E13 fix n1-N1 the harness did not put an
       update's fields onto the document, so the hall read unprepared anyway and a0, a6 and k3 were written against that;
       at 8b4974a the update landed and the three failed (35/38, e12run/scratch/l1head-41.log). a00 records the
       conversion; then the hall is put back as Foundry leaves a new scene - token vision on, global light off,
       exploration fog on, Foundry's Scene defaults (known, not read from a Foundry install here; the shim has none) -
       and the record dropped, in one update and one unsetFlag, so a0, a6 and k3 read the hall they mean: linked
       without "Prepare the hall". Once linked the hall holds no room (rooms.mjs \`roomPieces\`), so the fog leaves it. */
    const built = await gm.eval(`${UNTIL} const C = await import("${repoUrl}/scripts/chapter.mjs"); const academy = game.scenes.get("${IDS.scene}");
        const T = await import("${repoUrl}/scripts/trial-scene.mjs");
        const ghost = await Actor.create({ name: "S41 Ghost", type: "character", prototypeToken: { name: "Ghost", texture: { src: "icons/svg/mystery-man.svg" } } });
        await game.actors.get("${IDS.aiko}").update({ prototypeToken: { name: "Aiko", texture: { src: "icons/svg/mystery-man.svg" } } });
        const test = await Actor.create({ name: "S41 Test", type: "character" });
        const decor = await Actor.create({ name: "S41 Decor", type: "npc" });
        const died = Boolean(await C.killCharacter(ghost, { secret: false, keepBullets: true }));
        const hall = await Scene.create({ name: "41 Trial Hall", width: 3000, height: 2000, grid: { size: 100 }, active: false });
        await hall.createEmbeddedDocuments("Region", [
            { name: "Stand", shapes: [{ type: "rectangle", x: 200, y: 200, width: 800, height: 600 }], flags: { "${MOD}": { room: true } }, behaviors: [] },
            { name: "Gallery", shapes: [{ type: "rectangle", x: 1200, y: 200, width: 800, height: 600 }], flags: { "${MOD}": { room: true } }, behaviors: [] }]);
        await until(() => hall.getFlag("${MOD}", "visionBefore") !== undefined, 3000);
        const vision = () => ({ tokenVision: hall.tokenVision ?? null, globalLight: hall.environment?.globalLight?.enabled ?? null,
            exploration: hall.fog?.mode ?? hall.fog?.exploration ?? null, record: hall.getFlag("${MOD}", "visionBefore") !== undefined });
        const lit = { ...vision(), patch: Object.keys(T.hallPreparePatch(hall)).sort() };
        await hall.update({ tokenVision: true, "environment.globalLight.enabled": false, "fog.exploration": true });
        await hall.unsetFlag("${MOD}", "visionBefore");
        const putBack = { ...vision(), patch: Object.keys(T.hallPreparePatch(hall)).sort() };
        const token = (name, actorId, x, hidden = true) => ({ name, actorId, actorLink: true, x, y: 400, width: 1, height: 1, hidden, flags: {},
            texture: { src: "icons/svg/mystery-man.svg" } });
        await hall.createEmbeddedDocuments("Token", [token("Botan", "${IDS.botan}", 400), token("Monokuma", "ACTORMONOKUMA000", 700),
            token("Test", test.id, 800), token("Decor", decor.id, 1500, false)]);
        return { hall: hall.id, died, dead: game.drpg.isDeadForGm(ghost), tokens: hall.tokens.size, lit, putBack, ghost: ghost.id, test: test.id };`, { timeout: 60000 });
    /* Each name of CAST by its actor (E81 DZ6): Aiko, Chie and the dead student have no token in the hall to be read by. */
    const ACTORS = { Aiko: IDS.aiko, Botan: IDS.botan, Chie: IDS.chie, Ghost: built.ghost, Monokuma: "ACTORMONOKUMA000", Test: built.test };
    check("a00: a hall that gains its first room before it is linked is put into room-based vision by the room fog (lit, no exploration fog, its record left) and, put back as Foundry leaves a new scene, reads unprepared again (E13 fix l2-L2)",
        J(built.lit) === J({ tokenVision: false, globalLight: true, exploration: false, record: true, patch: [] })
            && J(built.putBack) === J({ tokenVision: true, globalLight: false, exploration: true, record: false,
                patch: ["environment.globalLight.enabled", "fog.exploration", "tokenVision"] }),
        J({ lit: built.lit, putBack: built.putBack }), { flow: "trial-scene" });
    /* The scenes linked and the cast chosen as a GM does it since E13 C5: in Room Setup's Scenes tab, its window drawn on the
       GM (over the Academy, the scene the GM views), the Academy picked as the school and the hall as the trial hall, the
       hall's cast list drawn for it, Chie unticked and the dead student ticked (nobody plays him, so he is hidden by default);
       Aiko, Botan and Monokuma as \`defaultReveal\` has them, the test student hidden. Until C5 this phase wrote the setting
       and \`saveTrialCast\` from the console. Since E81 DZ6 (12.10.2026) a box is an actor's (\`cast:\${actorId}\`) and the
       choice is stored by actor; each name below is the actor of the hall token of that name. */
    const tab = await gm.eval(`${UNTIL} ${HALL} const V = await import("${repoUrl}/scripts/vault.mjs"); const R = await import("${repoUrl}/scripts/rooms.mjs");
        const T = await import("${repoUrl}/scripts/trial-scene.mjs");
        const title = game.i18n.format("DRPG.Vault.manageTitleOn", { scene: academy.name });
        const drawn = () => [...foundry.applications.instances.values()].find(a => a.rendered && a.options?.window?.title === title);
        const ACT = ${J(ACTORS)}, byName = name => ACT[name];
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
                placedByGm: ["Aiko", "Botan", "Chie", "Ghost", "Monokuma", "Test"].filter(name => box(name)?.closest("li")?.querySelector('[data-drpg-cast-note="placedByGm"]')),
                handPlaced: Boolean(el?.querySelector('[data-drpg-cast-note="handPlaced"]')),
                held: Boolean(el?.querySelector('footer button[data-action="ok"]')?.disabled) };
            if (box("Chie")) box("Chie").checked = false;
            if (box("Ghost")) box("Ghost").checked = true;
            el?.querySelector('footer button[data-action="ok"]')?.click();
            closed = await Promise.race([pending.then(() => "closed"), new Promise(r => setTimeout(() => r("hung"), 8000))]);
        } finally { globalThis.__dialogWindows = was; }
        await new Promise(r => setTimeout(r, 800));
        const roles = R.sceneRoles(), stored = T.readTrialCast(hall);
        const names = Object.fromEntries(Object.entries(stored).map(([id, reveal]) => [Object.keys(ACT).find(name => ACT[name] === id) ?? id, reveal]));
        return { read, closed, linked: roles.school === academy.id && roles.trial === hall.id, stored: names };`, { timeout: 60000 });
    Object.assign(built, { linked: tab.linked, chose: tab.linked && J(tab.stored) === J({ Chie: false, Ghost: true }) });
    await settle(400);
    /* Since E13 fix r1-F3 the tab also names a hall nobody prepared (token vision, global light or exploration fog as
       Foundry leaves them; "Prepare the hall" is not ticked here): "hallDark". The hall is that one since E13 fix l2-L2:
       the room fog lit it when its rooms were drawn, and the scenario put it back (a00). */
    check("a0: Room Setup's last tab, Scenes, links the Academy and the hall, names the hall's two rooms and that it is unprepared, draws the cast by actor as `defaultReveal` has it - the three the GMs placed a token of noted so, no Monokuma line (his token is there) - and stores Chie unticked and the dead student ticked (E13 C5; E81 DZ6)",
        tab.closed === "closed" && tab.read?.last === "scenes" && J(tab.read.warnings) === J(["hallHasRooms", "hallDark"]) && tab.read.rooms === true && tab.read.held === false
            && J(tab.read.placedByGm) === J(["Botan", "Monokuma", "Test"]) && tab.read.handPlaced === false
            && J(tab.read.ticks) === J({ Aiko: true, Botan: true, Chie: true, Ghost: false, Monokuma: true, Test: false }) && built.chose === true,
        J(tab), { flow: "trial-scene" });
    const before = await readAll();
    const opsA = opLog.length;
    const opened = await gm.eval(`const { setClock } = await import("${repoUrl}/scripts/clock.mjs"); const { getClock } = await import("${repoUrl}/scripts/settings.mjs");
        await setClock({ phase: "classTrial" }); await new Promise(r => setTimeout(r, 800)); return getClock().phase;`, { timeout: 60000 });
    await settle(400);
    const inTrial = await readAll();
    const tokenOps = from => opLog.slice(from).map(o => `${o.who} ${o.action} ${o.coll}${o.embeddedName ? "." + o.embeddedName : ""}`)
        .filter(op => /embedded-(?:create|delete) Scene\.Token$/.test(op));
    const opsInA = tokenOps(opsA);
    /* The hall's ids with the module's two tokens: the GMs' as they were and two more (E81 DZ6). */
    const withMade = r => r.ids.length === before.gm.ids.length + MADE.length && before.gm.ids.every(id => r.ids.includes(id));
    const cell = ([x, y]) => x % 100 === 0 && y % 100 === 0 && x >= 0 && y >= 0 && x <= 2900 && y <= 1900;
    note(`a: the hall ${built.hall}, ${built.tokens} tokens, the Ghost dead ${built.dead}; phase ${opened}`);
    /* Read 12.10.2026 at C2's tree: every browser still showed the school, the school active. Since E13 C3 entering the
       trial activates the hall, so Foundry takes every browser there. */
    check("a1: setClock opens the Class Trial and every browser shows the hall, the hall active (E13 C3)",
        built.tokens === 4 && built.dead === true && opened === "classTrial" && views(inTrial).every(v => v === "hall")
            && Object.values(inTrial).every(r => r.active === "hall"),
        J({ built, opened, views: views(inTrial) }), { flow: "trial-scene" });
    /* Read 12.10.2026 at C1's tree: no hall token shown. Since E13 C2 the module shows the GMs' choice on entering the trial.
       Since E81 DZ6 it makes a token for each of it with none the GMs placed - Aiko and the dead student - in one create
       on the GM, at cells of a ring round the hall's centre on its grid, and deletes nothing; the GMs' tokens keep their ids.
       Red at 4f4c24b: nothing was made, and Aiko and the dead student had no token in the hall. */
    check("a2: the GM's choice is shown on every browser - Aiko and the dead student in tokens the module made, in one create, on distinct grid cells inside the hall; Botan and Monokuma in the GMs'; the decoration as it was - nothing deleted, the GMs' ids as before, the record naming the two (E13 C2; E81 DZ6)",
        built.chose === true && J(opsInA) === J(["gm embedded-create Scene.Token"]) && Object.entries(inTrial).every(([who, r]) => before[who].made === 4
            && J(shown(before[who])) === J(["Decor"]) && J(shown(r)) === J([...CHOICE, "Decor"].sort()) && withMade(r) && r.made === before[who].made + MADE.length
            && r.gone === before[who].gone && r.open.length === MADE.length && MADE.every(name => cell(r.at[name] ?? [-1, -1])))
            && J(inTrial.gm.at.Aiko) !== J(inTrial.gm.at.Ghost),
        J({ chose: built.chose, opsInA, before, after: inTrial }), { flow: "trial-scene" });
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
            && toldPut.length === 1 && J(toldPut[0]) === GMS,
        J({ putBack, afterPut: Object.fromEntries(Object.entries(afterPut).map(([who, r]) => [who, shown(r)])), toldPut }), { flow: "trial-scene" });
    /* What the GMs were whispered of one hall token and one user, as each whisper's recipients (`key` a TrialScene text). */
    const toldOf = (key, userId, name) => gm.eval(`const { wordsOf } = await import("${repoUrl}/scripts/secret.mjs");
        const text = "<p>" + game.i18n.format("DRPG.TrialScene.${key}", { user: game.users.get("${userId}").name, name: ${J(name)} }) + "</p>";
        const told = [];
        for (const m of game.messages) if (await wordsOf(m, 2000) === text) told.push((m.whisper ?? []).slice().sort());
        return told;`, { timeout: 60000 });
    /* Two changes of one player landing before the primary answers the first (E13 fix r1-F2, review r1 sec A). Review r1
       measured at 45e6bcf that C2's put-back answered each against itself: p1 hiding and showing Aiko left her hidden on
       every browser with two whispers, and so did the pair with its second write sent whole. Here both pairs, and the
       other way round against a GM's own hide: the GM hides Botan by hand, p2 shows him and hides him again. The
       put-back now writes what the GMs last wrote, once per change it undid; Botan is shown again by the GM after. */
    const toldA4 = [(await toldOf("hiddenPutBack", IDS.p1, "Aiko")).length, (await toldOf("hiddenPutBack", IDS.p2, "Botan")).length];
    const handHide = await gm.eval(`${HALL} const t = hall.tokens.find(x => x.name === "Botan"); await t.update({ hidden: true }); return hall.tokens.get(t.id).hidden;`,
        { timeout: 30000 });
    await settle(400);
    const pairs = await p1.eval(`${HALL} const t = hall.tokens.find(x => x.name === "Aiko");
        await t.update({ hidden: true }); await t.update({ hidden: false });
        await new Promise(r => setTimeout(r, 1500));
        const first = hall.tokens.get(t.id).hidden;
        const sent = t.update({ hidden: true }); await t.update({ hidden: false }, { diff: false }); await sent;
        return { first };`, { timeout: 30000 });
    await p2.eval(`${HALL} const t = hall.tokens.find(x => x.name === "Botan"); await t.update({ hidden: false }); await t.update({ hidden: true }); return true;`,
        { timeout: 30000 });
    await settle(3000);
    const afterPairs = await readAll();
    const toldPairs = [(await toldOf("hiddenPutBack", IDS.p1, "Aiko")).length - toldA4[0], (await toldOf("hiddenPutBack", IDS.p2, "Botan")).length - toldA4[1]];
    check("a4: two changes of one player landing before the primary answers the first end as the GMs left the token on every browser, one whisper per change undone - p1's hide and show of Aiko, twice (the second show sent whole), and p2's show and hide of Botan the GM hid by hand (E13 fix r1-F2)",
        handHide === true && pairs.first === false && Object.values(afterPairs).every(r => r.hidden.Aiko === false && r.hidden.Botan === true)
            && J(toldPairs) === J([2, 1]),
        J({ handHide, pairs, afterPairs: Object.fromEntries(Object.entries(afterPairs).map(([who, r]) => [who, shown(r)])), toldPairs }), { flow: "trial-scene" });
    await gm.eval(`${HALL} const t = hall.tokens.find(x => x.name === "Botan"); if (t.hidden) await t.update({ hidden: false }); return true;`, { timeout: 30000 });
    await settle(400);
    /* A player drops a shown token of their own student into the hall during the trial (E13 fix r1-F2, review r1 sec B):
       a drag from the Actors tab where the world grants players TOKEN_CREATE - the harness lets a player's create of a
       token of an actor they own through since this fix (cluster.mjs), and refused it before, so review r1's check of it
       measured the refusal. Chie is unticked; C2 only told the GMs and left the token shown on every browser. Now the
       primary hides it and tells the GMs once. p3 deletes it in a7. */
    const toldA5 = (await toldOf("playerTokenCreated", IDS.p3, "Chie dropped")).length;
    const dropped = await p3.eval(`${HALL} try {
            const [t] = await hall.createEmbeddedDocuments("Token", [{ name: "Chie dropped", actorId: "${IDS.chie}", actorLink: true, x: 900, y: 400,
                width: 1, height: 1, hidden: false, flags: {}, texture: { src: "icons/svg/mystery-man.svg" } }]);
            return { id: t?.id ?? null, err: null };
        } catch (err) { return { id: null, err: String(err?.message ?? err) }; }`, { timeout: 30000 });
    await settle(2500);
    const afterDrop = {};
    for (const c of clients) afterDrop[c.who] = await c.eval(`${HALL} return hall.tokens.get(${J(dropped.id)})?.hidden ?? null;`);
    const toldDrop = (await toldOf("playerTokenCreated", IDS.p3, "Chie dropped")).map(to => J(to));
    check("a5: a shown token of Chie (unticked) that p3 drops into the hall during the trial is hidden on every browser, and the GMs are told once (E13 fix r1-F2)",
        Boolean(dropped.id) && Object.values(afterDrop).every(hidden => hidden === true) && toldDrop.length - toldA5 === 1 && toldDrop.at(-1) === GMS,
        J({ dropped, afterDrop, toldDrop, toldA5 }), { flow: "trial-scene" });
    /* The dark hall on entering (E13 fix r1-F3, 12.10.2026; goal S07-47): the hall was linked without "Prepare the hall",
       and until the fix entering the trial whispered the GMs only the students the hall has no token for (none here). */
    const toldDark = await gm.eval(`${HALL} const { wordsOf } = await import("${repoUrl}/scripts/secret.mjs");
        const T = await import("${repoUrl}/scripts/trial-scene.mjs");
        const text = "<p>" + game.i18n.localize("DRPG.TrialScene.hallDark") + "</p>";
        const told = [];
        for (const m of game.messages) if (await wordsOf(m, 2000) === text) told.push((m.whisper ?? []).slice().sort());
        return { unprepared: Object.keys(T.hallPreparePatch(hall)).sort(), told };`, { timeout: 60000 });
    check("a6: entering the trial with an unprepared hall whispers the GMs to prepare it, once (E13 fix r1-F3)",
        toldDark.unprepared.length > 0 && toldDark.told.length === 1 && J(toldDark.told[0]) === GMS,
        J(toldDark), { flow: "trial-scene" });
    /* A player deletes a hall cast token of their own student (E13 fix r2-H2, review r2 sec S2-4, plausible by reading at
       5b2b2ed): where the world grants players TOKEN_DELETE - the harness lets a player's delete of a token of an actor they
       own through since this fix (cluster.mjs), and refused every one before, so the road had never run. The module makes
       a token in the hall only for the ticked with none there, and Chie is unticked, so the token stays gone; until the
       fix nobody was told. p3 deletes the token it dropped in
       a5; the GM's delete after is the scenario's own tidy-up, for a run where p3's was refused. */
    const toldA7 = (await toldOf("playerTokenDeleted", IDS.p3, "Chie dropped")).length;
    const deleted = dropped.id ? await p3.eval(`${HALL} try { await hall.deleteEmbeddedDocuments("Token", [${J(dropped.id)}]); return null; }
        catch (err) { return String(err?.message ?? err); }`, { timeout: 30000 }) : "no token was dropped";
    await settle(2500);
    const afterDelete = {};
    for (const c of clients) afterDelete[c.who] = await c.eval(`${HALL} return Boolean(hall.tokens.get(${J(dropped.id)}));`);
    const toldDelete = (await toldOf("playerTokenDeleted", IDS.p3, "Chie dropped")).map(to => J(to));
    check("a7: a hall token of Chie that p3 deletes during the trial is gone on every browser, and the GMs are told once (E13 fix r2-H2)",
        deleted === null && Object.values(afterDelete).every(present => present === false) && toldDelete.length - toldA7 === 1 && toldDelete.at(-1) === GMS,
        J({ deleted, afterDelete, toldDelete, toldA7 }), { flow: "trial-scene" });
    if (dropped.id) await gm.eval(`${HALL} if (hall.tokens.get(${J(dropped.id)})) await hall.deleteEmbeddedDocuments("Token", [${J(dropped.id)}]); return true;`, { timeout: 30000 });
    await settle(400);
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

    /* ------------------------------ l. the hall is not relinked during the trial ------------------------------ */
    phase("l: the trial hall cannot be relinked or unlinked while the trial runs", { flow: "trial-scene" });
    /* Review r1 cor C, by reading at 45e6bcf: in a running trial an Apply of the Scenes tab that unlinked or relinked the
       hall was written, nothing hid the old hall's shown cast, and after an unlink End the trial had no hall to leave,
       so the table stayed in the old hall with nobody told. Since E13 fix r1-F2 the window holds Apply with the reason,
       and an Apply that gets through anyway (the button freed here by hand) writes nothing and warns. Room Setup opens
       on the school during the trial (E13 C1), its Scenes tab drawn on the GM. */
    const relink = await gm.eval(`${UNTIL} ${HALL} const V = await import("${repoUrl}/scripts/vault.mjs"); const R = await import("${repoUrl}/scripts/rooms.mjs");
        const drawn = () => [...foundry.applications.instances.values()].find(a => a.rendered && a.element?.querySelector?.('[name="scenes:trial"]'));
        const reason = game.i18n.localize("DRPG.TrialScene.hallInTrial"), told = globalThis.__notifications.length;
        const was = globalThis.__dialogWindows; globalThis.__dialogWindows = true;
        let held = null, label = null, closed = "hung";
        try {
            const pending = V.openRoomSetupDialog({ tab: "scenes" });
            const el = (await until(() => drawn()?.element, 8000)) ?? null;
            const trial = el?.querySelector('[name="scenes:trial"]');
            if (trial) { trial.value = ""; trial.dispatchEvent(new Event("change")); }
            const ok = el?.querySelector('footer button[data-action="ok"]');
            held = Boolean(ok?.disabled);
            label = ok?.getAttribute("aria-label") === reason;
            if (ok) { ok.disabled = false; ok.click(); }
            closed = await Promise.race([pending.then(() => "closed"), new Promise(r => setTimeout(() => r("hung"), 8000))]);
        } finally { globalThis.__dialogWindows = was; }
        await new Promise(r => setTimeout(r, 800));
        return { held, label, closed, linked: R.sceneRoles().trial === hall.id && R.trialScene()?.id === hall.id,
            warned: globalThis.__notifications.slice(told).some(n => n.msg === reason) };`, { timeout: 60000 });
    await settle(400);
    check("l1: in the trial, the Scenes tab with the hall unlinked holds Apply with the reason, and an Apply pressed anyway writes nothing and warns - the hall stays linked (E13 fix r1-F2)",
        relink.held === true && relink.label === true && relink.closed === "closed" && relink.linked === true && relink.warned === true,
        J(relink), { flow: "trial-scene" });

    /* ------------------------------ c. closeTrial ------------------------------ */
    phase("c: closeTrial", { flow: "trial-scene" });
    const closed = await gm.eval(`const UI = await import("${repoUrl}/scripts/trial-floor-ui.mjs"); const { getClock } = await import("${repoUrl}/scripts/settings.mjs");
        const done = await UI.closeTrial(); await new Promise(r => setTimeout(r, 800)); return { done, phase: getClock().phase };`, { timeout: 60000 });
    await settle(400);
    const afterClose = await readAll();
    /* Read 12.10.2026 at C2's tree: every browser stayed on the hall. Since E13 C3 leaving the trial activates the school. */
    check("c1: closeTrial ends the trial and takes every browser to the school, the school active (E13 C3), the GMs' cast hidden (E13 C2), the module's two deleted and the record naming none (E81 DZ6)",
        closed.done === true && closed.phase === "dailyLife" && views(afterClose).every(v => v === "school")
            && Object.values(afterClose).every(r => r.active === "school" && J(shown(r)) === J(["Decor"]) && J(r.ids) === J(before.gm.ids) && !r.open.length),
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
    check("d1: Edit campaign, asked and answered yes, opens the trial: its question says the table goes to the hall (E13 C6), every browser shows the hall (as a1: E13 C3), the GM's choice shown (as a2: E13 C2), the module's two made again where they stood when the trial before ended - Aiko where p1 moved her in b1 (E81 DZ6)",
        editIn.phase === "classTrial" && editIn.asked.length === 2 && editIn.said === true && views(dIn).every(v => v === "hall")
            && Object.values(dIn).every(r => J(shown(r)) === J([...CHOICE, "Decor"].sort()) && withMade(r) && J(r.at.Aiko) === J([1500, 400])
                && J(r.at.Ghost) === J(inTrial.gm.at.Ghost)),
        J({ editIn, dIn }), { flow: "trial-scene" });
    await byHand();
    await settle(400);
    const editOut = await gm.eval(EDIT("dailyLife"), { timeout: 60000 });
    await settle(400);
    const dOut = await readAll();
    check("d2: Edit campaign back to Daily Life ends the trial: every browser is taken to the school (as c1: E13 C3), the cast hidden (as c1: E13 C2)",
        editOut.phase === "dailyLife" && editOut.asked.length === 1 && views(dOut).every(v => v === "school")
            && Object.values(dOut).every(r => J(shown(r)) === J(["Decor"]) && J(r.ids) === J(before.gm.ids) && !r.open.length),
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
    /* The owner's answer f of 09.10 and items 1 and 3 of 10.10. A living student whose only token stands on another place
       scene, one whose only token stands on a map with no rooms, and a Monocub on the school (dead, and walks), made here
       and gone at the end of the phase; Aiko
       and Chie walked out of the room of the body and the executed, so the gather is a living token entering it. Every
       token of every scene by position and room, before and after; End the trial pressed in its window drawn on the GM, the
       body's room on the Academy chosen in it. Until E13 fix r1-F1 the student on the other place scene stayed there and
       was named (i2 and i3 read that at 45e6bcf); now it comes as a copy of its token, under a new id, and the one the
       module cannot move is the one on the map with no rooms, which C3b neither moved nor named (review r1 cor A).
       E81 fix r1-D3 (12.10.2026; the owner's DZ6, the design's 5 and 9 i5): the return takes the hall's cast only. The three
       students made here are nobody's, so unticked by default: the GM ticks them for the hall (the stage makes their
       tokens there on the way in, and deletes them on the way out), and drops the rows before they go. Chie, unticked
       since a, walked out of the room with Aiko: she stays in that room and nobody is told of her. */
    const fixI = await gm.eval(`const R = await import("${repoUrl}/scripts/rooms.mjs"); const T = await import("${repoUrl}/scripts/trial-scene.mjs");
        const awayStudent = await Actor.create({ name: "S41 Away", type: "character" });
        const stray = await Actor.create({ name: "S41 Stray", type: "character" });
        const map = await Scene.create({ name: "41 Stray Map", width: 2000, height: 2000, grid: { size: 100 }, active: false, navigation: false });
        await map.createEmbeddedDocuments("Token", [{ name: stray.name, actorId: stray.id, actorLink: true, x: 1200, y: 1200, width: 1, height: 1 }]);
        const cub = await Actor.create({ name: "S41 Cub", type: "character", flags: { "${MOD}": { deceased: true, monocub: true } } });
        const place = await Scene.create({ name: "41 Away Place", width: 2000, height: 2000, grid: { size: 100 }, active: false, navigation: false });
        await place.createEmbeddedDocuments("Region", [{ name: "Shed", shapes: [{ type: "rectangle", x: 0, y: 0, width: 800, height: 800 }],
            flags: { "${MOD}": { [R.ROOM_FLAG]: true } }, behaviors: [] }]);
        await place.createEmbeddedDocuments("Token", [{ name: awayStudent.name, actorId: awayStudent.id, actorLink: true, x: 1200, y: 1200, width: 1, height: 1 }]);
        const [cubToken] = await game.scenes.get("${IDS.scene}").createEmbeddedDocuments("Token", [{ name: cub.name, actorId: cub.id, actorLink: true,
            x: 600, y: 600, width: 1, height: 1 }]);
        await T.saveTrialCast(game.scenes.find(s => s.name === "41 Trial Hall"), { [awayStudent.id]: true, [cub.id]: true, [stray.id]: true });
        return { place: place.id, map: map.id, actors: [awayStudent.id, cub.id, stray.id], cubToken: cubToken.id };`, { timeout: 30000 });
    const outI = [await walk(IDS.aiko, away), await walk(IDS.chie, away)];
    const PLACES = `const M = await import("${repoUrl}/scripts/movement.mjs"); const where = {};
        for (const s of game.scenes) for (const t of s.tokens) where[s.name + "/" + t.name] = { at: [t.x, t.y], room: M.roomOfToken(t), id: t.id };`;
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
        return { where, cards: cards(), stamps: game.settings.get("${MOD}", "bodiesFound"), chie: game.actors.get("${IDS.chie}")?.name ?? null,
            told: await Promise.all(game.messages.filter(m => !said.has(m.id) && (m.whisper?.length ?? 0) > 0).map(m => wordsOf(m, 2000))) };`);
    await gm.eval(`await game.scenes.get(${J(fixI.place)})?.delete(); await game.scenes.get(${J(fixI.map)})?.delete();
        const ids = ${J(fixI.actors)}, academy = game.scenes.get("${IDS.scene}");
        const { saveTrialCast } = await import("${repoUrl}/scripts/trial-scene.mjs");
        await saveTrialCast(game.scenes.find(s => s.name === "41 Trial Hall"), Object.fromEntries(ids.map(id => [id, null])));
        const made = [...academy.tokens].filter(t => ids.includes(t.actorId)).map(t => t.id);
        if (made.length) await academy.deleteEmbeddedDocuments("Token", made);
        for (const id of ids) await game.actors.get(id)?.delete(); return true;`, { timeout: 30000 });
    const academyName = Object.keys(i0.where).find(key => key.endsWith("/Aiko") && i0.where[key].room !== null)?.split("/")[0] ?? null;
    const MOVERS = ["Aiko", "S41 Cub"].map(name => `${academyName}/${name}`), CHIE = `${academyName}/Chie`;
    const movedI = Object.keys(i0.where).filter(key => J(i0.where[key].at) !== J(i1.where[key]?.at)).sort();
    const AWAY = ["41 Away Place/S41 Away", `${academyName}/S41 Away`], awayCopy = i1.where[AWAY[1]] ?? null;
    check("i1: End the trial's window offers End the trial and Cancel only and every room of each place scene, the school's first room chosen; ended there, every browser is on the school with the hall's cast hidden (E13 C3b; the owner's items 3 of 10.10)",
        J(endI.read?.buttons) === J(["ok", "cancel"]) && endI.read.options[0]?.startsWith(`${academyName}/`) && endI.read.options.includes(`${academyName}/${found.room}`)
            && endI.read.options.includes("41 Away Place/Shed") && endI.read.first === endI.read.options[0].split("/").slice(1).join("/")
            && endI.ended === true && endI.phase === "dailyLife" && views(viewsI).every(v => v === "school") && Object.values(viewsI).every(r => J(shown(r)) === J(["Decor"])),
        J({ fixI, outI, endI, viewsI: views(viewsI) }), { flow: "trial-scene" });
    check("i2: the living of the cast on the school and the Monocub go to the chosen room, and the living student on another place scene comes too, its token there gone and a copy under a new id in the room; the dead, Monokuma, the hall's tokens and the student on a map with no rooms stay where they stood (E13 C3b and fix r1-F1; the owner's f and item 1 of 10.10)",
        academyName && outI.every(r => r === away) && J(movedI) === J([...MOVERS, AWAY[0]].sort()) && MOVERS.every(key => i1.where[key]?.room === found.room)
            && !(AWAY[0] in i1.where) && !(AWAY[1] in i0.where) && awayCopy?.room === found.room && awayCopy.id !== i0.where[AWAY[0]]?.id,
        J({ academyName, movedI, awayCopy, before: i0.where, after: i1.where }), { flow: "trial-scene" });
    check("i3: the GMs are told once how many went and that the student on a map with no rooms could not be moved, by name, and the carried student is not named (E13 C3b and fix r1-F1; the owner's item 1 of 10.10, review r1 cor A)",
        i1.told.filter(text => text.includes("S41 Stray")).length === 1 && i1.told.some(text => text.includes("S41 Stray") && text.includes(found.room))
            && !i1.told.some(text => text.includes("S41 Away")),
        J(i1.told), { flow: "trial-scene" });
    check("i4: the living entering the room of the body and the executed post no body card and leave the stamps as they were (E13 C3b; the ledger's V12)",
        i1.cards === i0.cards && J(i1.stamps) === J(i0.stamps), J({ before: [i0.cards, i0.stamps], after: [i1.cards, i1.stamps] }), { flow: "trial-scene" });
    /* Red at 3148dc0 (the return took every living student): Chie went to the chosen room with the rest. */
    check("i5: End the trial leaves Chie, left out of the cast, where she stood on the school, and no whisper names her (E81 fix r1-D3; the owner's DZ6 of 12.10, the design's 5)",
        academyName && i0.where[CHIE]?.room === away && J(i1.where[CHIE]?.at) === J(i0.where[CHIE]?.at) && i1.chie && i1.told.length > 0 && !i1.told.some(text => text.includes(i1.chie)),
        J({ before: i0.where[CHIE] ?? null, after: i1.where[CHIE] ?? null, chie: i1.chie, told: i1.told }), { flow: "trial-scene" });

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
            && Object.values(jOut).every(r => r.active === "school" && J(shown(r)) === J(["Decor"]) && J(r.ids) === J(before.gm.ids) && !r.open.length) && J(spots1) === J(spots0),
        J({ jIn: views(jIn), ended, jOut, spots0, spots1 }), { flow: "trial-scene" });

    /* ------------------------------ k. Start the Class Trial's window, and the doors inside the trial ------------------------------ */
    phase("k: Start the Class Trial says where the table goes, and the table moves inside the trial", { flow: "trial-scene" });
    /* Read 12.10.2026 at C5's tree: the window named neither the hall nor the rule and preloaded nothing; the console
       had no door and game.drpg no showCourtroom. Four tokens: Aiko and Botan (played - Botan executed in g, the dead
       shown, Q-E13-1 a), the dead student ticked in a0, Monokuma; Chie unticked, the test student nobody plays.
       E81 DZ6 (12.10.2026): the window names the hall with no count and holds the cast picker, its ticks prefilled from
       a0's choice and \`defaultReveal\`; Botan is unticked in it and Start pressed, so Botan is stored unticked and stays
       hidden as the trial opens. Then his row is dropped and the cast shown again on the GM, so the clauses after k1 read
       the hall a0 chose. Red at 0697d0f: the line carried a count and the window no tick. */
    const startK = await gm.eval(`${UNTIL} ${HALL} const UI = await import("${repoUrl}/scripts/trial-floor-ui.mjs");
        const { getClock } = await import("${repoUrl}/scripts/settings.mjs");
        const title = game.i18n.localize("DRPG.Floor.startTrial");
        const drawn = () => [...foundry.applications.instances.values()].find(a => a.rendered && a.options?.window?.title === title);
        const from = globalThis.__scenePreloads.length;
        const was = globalThis.__dialogWindows; globalThis.__dialogWindows = true;
        const T = await import("${repoUrl}/scripts/trial-scene.mjs");
        const ACT = ${J(ACTORS)}, actorOf = name => ACT[name];
        let text = null, pending = null, ticks = null, heading = false;
        try {
            pending = UI.startClassTrial();
            const el = (await until(() => drawn()?.element, 8000)) ?? null;
            text = el?.querySelector("form")?.textContent?.replace(/\\s+/g, " ") ?? null;
            const box = name => el?.querySelector(\`[data-drpg-cast="\${hall.id}"] [name="cast:\${actorOf(name)}"]\`) ?? null;
            ticks = Object.fromEntries(["Aiko", "Botan", "Chie", "Ghost", "Monokuma", "Test"].map(name => [name, box(name)?.checked ?? null]));
            heading = Boolean(text?.includes(game.i18n.localize("DRPG.TrialScene.castPickHeading")));
            if (box("Botan")) box("Botan").checked = false;
            el?.querySelector('footer button[data-action="ok"]')?.click();
        } finally { globalThis.__dialogWindows = was; }
        const started = await Promise.race([pending, new Promise(r => setTimeout(() => r("hung"), 15000))]);
        await new Promise(r => setTimeout(r, 800));
        const botan = { row: T.readTrialCast(hall)[actorOf("Botan")] ?? null, hidden: hall.tokens.find(t => t.name === "Botan")?.hidden ?? null };
        await T.saveTrialCast(hall, { [actorOf("Botan")]: null });
        await T.stageHall(hall, { into: true });
        await new Promise(r => setTimeout(r, 800));
        return { started, phase: getClock().phase, drawn: text !== null, preloads: globalThis.__scenePreloads.slice(from), hall: hall.id,
            hallLine: Boolean(text?.includes(game.i18n.format("DRPG.Floor.startTrialHall", { hall: "41 Trial Hall" }))),
            rule: Boolean(text?.includes(game.i18n.localize("DRPG.Floor.tableRuleDead"))), ticks, heading, botan, back: T.readTrialCast(hall)[actorOf("Botan")] ?? null };`, { timeout: 60000 });
    await settle(400);
    const kIn = await readAll();
    check("k1: Start the Class Trial's window names the hall and states the table's rule, and holds who takes part, ticked as a0 chose; Botan unticked there is stored so and stays hidden as the trial opens; the hall is preloaded on every client before the click, and the trial opens there (E13 C6; E81 DZ6)",
        startK.started === true && startK.phase === "classTrial" && startK.hallLine && startK.rule && J(startK.preloads) === J([{ sceneId: startK.hall, push: true }])
            && startK.heading === true && J(startK.ticks) === J({ Aiko: true, Botan: true, Chie: false, Ghost: true, Monokuma: true, Test: false })
            && J(startK.botan) === J({ row: false, hidden: true }) && startK.back === null
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
            && views(kBack).every(v => v === "school") && Object.values(kBack).every(r => r.active === "school" && J(shown(r)) === J(["Decor"]) && J(r.ids) === J(before.gm.ids) && !r.open.length),
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
                shown: report.shown.map(name).sort(), made: (report.made ?? null)?.map(name).sort() ?? null, warnings: report.warnings.map(w => w.key) } };`, { timeout: 60000 });
    await settle(400);
    const kHall = await readAll();
    /* "hallDark" in k3's warnings: nobody prepared the hall since a00 put it back, and the linked hall holds no room, so
       the room fog leaves it (E13 fix l2-L2). */
    check("k3: a player's showCourtroom changes nothing; the GM's takes every browser back to the hall with the GM's choice shown, the phase kept, and trialSceneReport names the school, the hall, the table, the four tokens and the two the module made again (E13 C6; E81 DZ6)",
        playerDoor === null && views(kPlayer).every(v => v === "school") && J(apiK.door) === J({ hall: true, activated: true }) && apiK.phase === "classTrial"
            && J(apiK.report) === J({ school: true, hall: true, table: true, shown: [...CHOICE].sort(), made: MADE, warnings: ["hallHasRooms", "hallDark"] })
            && views(kHall).every(v => v === "hall") && Object.values(kHall).every(r => J(shown(r)) === J([...CHOICE, "Decor"].sort()) && withMade(r)),
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

    /* ------------------------------ s. the module's tokens in the hall (E81 fix r1-D2) ------------------------------ */
    phase("s: the module's tokens in the hall - a Start cancelled, a seat the GM moved, an entry inside the trial, a leave never finished", { flow: "trial-scene" });
    /* The DZ6 design's section 9 (12.10.2026). k1b: Start the Class Trial's window drawn on the GM, Chie ticked in it and
       Cancel pressed - the ticks are stored only on Start (trial-floor-ui.mjs `startClassTrial`), so nothing is stored,
       nothing starts and the hall is as it was. Red at 4f4c24b as far as s1 and s2 go; k1b held there too (D1 made the
       window), and is read here because the cast's tokens now hang on what it stores. */
    const cancelK = await gm.eval(`${UNTIL} ${HALL} const UI = await import("${repoUrl}/scripts/trial-floor-ui.mjs"); const T = await import("${repoUrl}/scripts/trial-scene.mjs");
        const { getClock } = await import("${repoUrl}/scripts/settings.mjs");
        const title = game.i18n.localize("DRPG.Floor.startTrial");
        const drawn = () => [...foundry.applications.instances.values()].find(a => a.rendered && a.options?.window?.title === title);
        const stored = JSON.stringify(T.readTrialCast(hall)), ids = JSON.stringify(hall.tokens.map(t => t.id).sort());
        const was = globalThis.__dialogWindows; globalThis.__dialogWindows = true;
        let pending = null, ticked = false, started = "hung";
        try {
            pending = UI.startClassTrial();
            const el = (await until(() => drawn()?.element, 8000)) ?? null;
            const box = el?.querySelector('[name="cast:${ACTORS.Chie}"]');
            if (box && !box.checked) { box.checked = true; ticked = true; }
            el?.querySelector('footer button[data-action="cancel"]')?.click();
            started = await Promise.race([pending, new Promise(r => setTimeout(() => r("hung"), 8000))]);
        } finally { globalThis.__dialogWindows = was; }
        await new Promise(r => setTimeout(r, 600));
        return { ticked, started, phase: getClock().phase, stored: JSON.stringify(T.readTrialCast(hall)) === stored,
            ids: JSON.stringify(hall.tokens.map(t => t.id).sort()) === ids, active: hall.active };`, { timeout: 60000 });
    await settle(400);
    check("k1b: Start the Class Trial's window with Chie ticked and Cancel pressed stores nothing and starts nothing - the phase, the choice and the hall's tokens as they were (E81 DZ6)",
        J(cancelK) === J({ ticked: true, started: null, phase: "dailyLife", stored: true, ids: true, active: false }),
        J(cancelK), { flow: "trial-scene" });
    /* s1: the trial opened, Aiko's made token moved by the GM, the trial ended (her seat noted, her token deleted) and
       opened again: she is made where the GM left her, under a new id. */
    const seatS = await gm.eval(`${UNTIL} ${HALL} const { setClock } = await import("${repoUrl}/scripts/clock.mjs"); const UI = await import("${repoUrl}/scripts/trial-floor-ui.mjs");
        const { getClock } = await import("${repoUrl}/scripts/settings.mjs"); const wait = ms => new Promise(r => setTimeout(r, ms));
        const aiko = () => hall.tokens.find(t => t.actorId === "${IDS.aiko}");
        await setClock({ phase: "classTrial" }); await wait(1200);
        const made = aiko()?.id ?? null, seat = aiko() ? [aiko().x, aiko().y] : null;
        await aiko()?.update({ x: 1700, y: 1100 }); await wait(400);
        await UI.closeTrial();
        await until(() => !aiko() && hall.getFlag("${MOD}", "trialSeats")?.["${IDS.aiko}"]?.token === null, 8000);
        /* A copy: here \`getFlag\` handed the hall's own object, and a first run read the next entry's id in it (12.10.2026). */
        const kept = JSON.parse(JSON.stringify(hall.getFlag("${MOD}", "trialSeats")?.["${IDS.aiko}"] ?? null)), gone = !aiko();
        await setClock({ phase: "classTrial" }); await until(() => aiko() && !aiko().hidden, 8000);
        const again = aiko() ? { fresh: aiko().id !== made, at: [aiko().x, aiko().y], hidden: aiko().hidden } : null;
        return { made: typeof made === "string", seat, kept, gone, again, phase: getClock().phase };`, { timeout: 90000 });
    await settle(400);
    check("s1: Aiko's made token, moved by the GM in the trial, is deleted when it ends with her seat noted there, and made there - under a new id, shown - when the next trial opens (E81 DZ6)",
        J(seatS) === J({ made: true, seat: [1500, 400], kept: { x: 1700, y: 1100, token: null }, gone: true,
            again: { fresh: true, at: [1700, 1100], hidden: false }, phase: "classTrial" }),
        J(seatS), { flow: "trial-scene" });
    /* s2: inside that trial an entry again (the stage's way in, as `showCourtroom` and a Scenes tab Apply run it) makes
       nothing and deletes nothing. Then a leave the GM's browser never ran: the clock written straight to Daily Life, as
       a browser closed between the phase write and the stage would leave it (`reconcilePhase` runs only from `setClock`,
       clock.mjs), so the module's tokens stand in a hall nobody is in a trial in. gm0 loads - the primary while it is at
       the table - and its \`ready\` tidy (trial-scene.mjs \`tidyHallTokens\`) runs the way out: the two deleted, in one
       delete of gm0's, the record naming none, the GMs' tokens hidden. Then the trial's own way out, by \`setClock\`
       from the trial again, so what the phase's leave does besides the hall is done as at any other end. */
    const opsS = opLog.length;
    const againS = await gm.eval(`${HALL} const T = await import("${repoUrl}/scripts/trial-scene.mjs");
        const ids = JSON.stringify(hall.tokens.map(t => t.id).sort());
        const entered = await T.enterTrialScene(hall); await new Promise(r => setTimeout(r, 600));
        return { made: entered?.cast?.made ?? null, removed: entered?.cast?.removed ?? null, same: JSON.stringify(hall.tokens.map(t => t.id).sort()) === ids };`,
        { timeout: 60000 });
    const opsAgain = tokenOps(opsS);
    /* s3: the Scenes tab's Apply in the trial, the hall on screen, stages it again (trial-scene.mjs \`applyScenesTab\`; the
       orchestrator's Q4 of 12.10.2026): Chie ticked there gets a token the module makes, shown and in the record, and
       unticked again loses it, the record naming none. Added after the first full run of this phase, when the mutant that
       made that Apply only show and hide (r1d2-m8) turned nothing red. */
    const tabS = await gm.eval(`${HALL} const T = await import("${repoUrl}/scripts/trial-scene.mjs"); const { gmStoresIdle } = await import("${repoUrl}/scripts/gm-store.mjs");
        const wait = ms => new Promise(r => setTimeout(r, ms)), chie = () => hall.tokens.find(t => t.actorId === "${IDS.chie}");
        const apply = tick => T.applyScenesTab({ school: academy.id, trial: hall.id, drawn: { school: academy.id, trial: hall.id },
            cast: { sceneId: hall.id, changes: { "${IDS.chie}": tick } }, prepare: null });
        const before = T.readTrialCast(hall)["${IDS.chie}"] ?? null, had = Boolean(chie());
        const on = await apply(true); await gmStoresIdle(); await wait(600);
        const made = chie() ? { shown: !chie().hidden, recorded: T.readSeats(hall)["${IDS.chie}"]?.token === chie().id, answered: (on?.shown?.made ?? []).includes(chie().id) } : null;
        await apply(false); await gmStoresIdle(); await wait(600);
        return { before, had, made, gone: !chie(), named: T.readSeats(hall)["${IDS.chie}"]?.token ?? null };`, { timeout: 60000 });
    await settle(400);
    check("s3: in the trial, a Scenes tab Apply that ticks Chie makes her token, shown and recorded, and one that unticks her deletes it, the record naming none (E81 DZ6)",
        tabS.before !== true && J({ ...tabS, before: null }) === J({ before: null, had: false, made: { shown: true, recorded: true, answered: true }, gone: true, named: null }),
        J(tabS), { flow: "trial-scene" });
    const cut = await gm.eval(`${HALL} const { getClock, SETTINGS } = await import("${repoUrl}/scripts/settings.mjs");
        await game.settings.set("${MOD}", SETTINGS.clock, { ...getClock(), phase: "dailyLife" }); await new Promise(r => setTimeout(r, 600));
        const seats = hall.getFlag("${MOD}", "trialSeats") ?? {};
        return { phase: getClock().phase, active: hall.active, open: Object.values(seats).filter(seat => seat?.token && hall.tokens.get(seat.token)).length };`,
        { timeout: 60000 });
    await settle(400);
    const opsTidy = opLog.length;
    await connect("gm0");
    const tidied = await gm.eval(`${UNTIL} ${HALL} const open = () => Object.values(hall.getFlag("${MOD}", "trialSeats") ?? {}).filter(seat => seat?.token).length;
        const hidden = () => ["Botan", "Monokuma"].every(name => hall.tokens.find(t => t.name === name)?.hidden);
        await until(() => open() === 0 && hidden(), 8000);
        return { open: open(), ids: hall.tokens.map(t => t.id).sort(), hidden: Object.fromEntries(hall.tokens.contents.map(t => [t.name, t.hidden])) };`, { timeout: 30000 });
    const opsTidied = tokenOps(opsTidy);
    await disconnect("gm0");
    await settle(600);
    await gm.eval(`const { getClock, SETTINGS } = await import("${repoUrl}/scripts/settings.mjs"); const { setClock } = await import("${repoUrl}/scripts/clock.mjs");
        await game.settings.set("${MOD}", SETTINGS.clock, { ...getClock(), phase: "classTrial" });
        await setClock({ phase: "dailyLife" }); await new Promise(r => setTimeout(r, 1000)); return true;`, { timeout: 60000 });
    await handBack();
    await settle(400);
    const sOut = await readAll();
    check("s2: an entry inside the trial makes and deletes nothing; a leave never run leaves the module's two standing out of the trial, and the next GM's ready deletes them in one delete, the record naming none, the GMs' tokens hidden and their ids as before (E81 DZ6)",
        J(againS) === J({ made: [], removed: [], same: true }) && J(opsAgain) === J([]) && J(cut) === J({ phase: "dailyLife", active: true, open: 2 })
            && tidied.open === 0 && J(tidied.ids) === J(before.gm.ids) && J(tidied.hidden) === J({ Botan: true, Monokuma: true, Test: true, Decor: false })
            && J(opsTidied) === J(["gm0 embedded-delete Scene.Token"])
            && views(sOut).every(v => v === "school") && Object.values(sOut).every(r => J(shown(r)) === J(["Decor"]) && J(r.ids) === J(before.gm.ids) && !r.open.length),
        J({ againS, opsAgain, cut, tidied, opsTidied, sOut: views(sOut) }), { flow: "trial-scene" });

    /* ------------------------------ z. the GMs' last write across an unlink and a relink ------------------------------ */
    phase("z: what the GMs last wrote on a hall token outlives an unlink and a relink of the hall", { flow: "trial-scene" });
    /* Review r2 sec S2-1, run on 12.10.2026 at 5b2b2ed (this phase, through `applyScenesTab`, the function the Scenes tab's
       Apply calls): the GM shows Aiko on the linked hall outside the trial, unlinks, hides Aiko by hand on the unlinked hall
       (heard by nobody: only the linked hall is watched) and relinks - the relink's own hide writes nothing, Aiko being
       hidden. The put-back still held "shown": p1's show stood on all four browsers with no whisper, outside the trial (z1)
       and in the trial after, Aiko unticked in that relink (z2). Since E13 fix r2-H2 every GM reads the linked hall again
       on a change of the scene roles (trial-scene.mjs `reseedCastHeld`), whoever wrote them: z2 unlinks by a plain write
       of the setting, as a console would and as every other GM's client hears an Apply, not through `applyScenesTab`.
       z3 is the control: a GM's hide heard on the linked hall, put back before the fix as well. */
    const TAB = `const T = await import("${repoUrl}/scripts/trial-scene.mjs"); const R = await import("${repoUrl}/scripts/rooms.mjs");
        const { getClock } = await import("${repoUrl}/scripts/settings.mjs"); const wait = ms => new Promise(r => setTimeout(r, ms));
        const aiko = () => hall.tokens.find(t => t.name === "Aiko");
        const tab = (trial, drawn, cast = null) => T.applyScenesTab({ school: academy.id, trial, drawn: { school: academy.id, trial: drawn }, cast, prepare: null });`;
    const AIKO = r => Object.fromEntries(Object.entries(r).map(([who, x]) => [who, x.hidden.Aiko]));
    /* Since E81 DZ6 Aiko has no token in the hall out of a trial (hers is made and deleted with it), and the put-back is
       about a token the GMs keep: one is placed here, hidden, a GM's own, and taken away after z3. The trial z2 opens
       makes none for her - she is unticked there and has this one. */
    const zAiko = await gm.eval(`${HALL} const [t] = await hall.createEmbeddedDocuments("Token", [{ name: "Aiko", actorId: "${IDS.aiko}", actorLink: true,
        x: 300, y: 400, width: 1, height: 1, hidden: true, flags: {}, texture: { src: "icons/svg/mystery-man.svg" } }]); return t.id;`, { timeout: 30000 });
    await settle(400);
    const toldZ0 = (await toldOf("hiddenPutBack", IDS.p1, "Aiko")).length;
    const z0 = await gm.eval(`${HALL} ${TAB}
        const out = { phase: getClock().phase, linked0: R.trialScene()?.id === hall.id };
        if (!aiko().hidden) { await aiko().update({ hidden: true }); await wait(300); }
        await aiko().update({ hidden: false }); await wait(300);
        out.heardShow = T.heldHidden(aiko(), hall);
        out.unlink = await tab("", hall.id); await wait(300);
        out.unlinked = R.trialScene()?.id ?? null; out.aikoUnlinked = aiko().hidden;
        await aiko().update({ hidden: true }); await wait(300);
        out.relink = await tab(hall.id, ""); await wait(300);
        out.linked1 = R.trialScene()?.id === hall.id; out.aiko1 = aiko().hidden; out.held1 = T.heldHidden(aiko(), hall);
        return out;`, { timeout: 60000 });
    await settle(600);
    const z1 = await p1.eval(`${HALL} const t = hall.tokens.find(x => x.name === "Aiko"); try { await t.update({ hidden: false }); return true; } catch { return false; }`, { timeout: 30000 });
    await settle(2000);
    const afterZ1 = await readAll();
    const toldZ1 = (await toldOf("hiddenPutBack", IDS.p1, "Aiko")).length - toldZ0;
    check("z1: outside the trial, after a GM's show heard, an unlink, a GM's hide on the unlinked hall and a relink, p1 showing Aiko is put back on every browser with one whisper (E13 fix r2-H2)",
        z0.phase === "dailyLife" && z0.linked0 && z0.unlinked === null && z0.linked1 && z1 === true
            && Object.values(afterZ1).every(r => r.hidden.Aiko === true) && toldZ1 === 1,
        J({ z0, z1, aiko: AIKO(afterZ1), toldZ1 }), { flow: "trial-scene" });
    const toldZ2 = (await toldOf("hiddenPutBack", IDS.p1, "Aiko")).length;
    const z2gm = await gm.eval(`${HALL} ${TAB} const { setClock } = await import("${repoUrl}/scripts/clock.mjs"); const { gmStoresIdle } = await import("${repoUrl}/scripts/gm-store.mjs");
        if (!aiko().hidden) { await aiko().update({ hidden: true }); await wait(300); }
        await aiko().update({ hidden: false }); await wait(300);
        const out = { heardShow: T.heldHidden(aiko(), hall) };
        const { SETTINGS } = await import("${repoUrl}/scripts/settings.mjs");
        await game.settings.set("${MOD}", SETTINGS.sceneRoles, { ...R.sceneRoles(), trial: null }); await wait(300);
        out.unlink = R.trialScene() === null;
        await aiko().update({ hidden: true }); await wait(300);
        out.relink = await tab(hall.id, "", { sceneId: hall.id, changes: { [aiko().actorId]: false } }); await gmStoresIdle(); await wait(300);
        out.row = T.readTrialCast(hall)[aiko().actorId] ?? null;
        await setClock({ phase: "classTrial" }); await wait(1200);
        out.phase = getClock().phase; out.active = hall.active; out.aiko = aiko().hidden; out.held = T.heldHidden(aiko(), hall);
        return out;`, { timeout: 90000 });
    await settle(800);
    const z2 = await p1.eval(`${HALL} const t = hall.tokens.find(x => x.name === "Aiko"); try { await t.update({ hidden: false }); return true; } catch { return false; }`, { timeout: 30000 });
    await settle(2000);
    const afterZ2 = await readAll();
    const toldZ2b = (await toldOf("hiddenPutBack", IDS.p1, "Aiko")).length - toldZ2;
    check("z2: in the trial that follows such a relink, Aiko unticked in it and hidden, p1 showing Aiko is put back on every browser with one whisper (E13 fix r2-H2)",
        z2gm.unlink === true && z2gm.phase === "classTrial" && z2gm.active === true && z2gm.aiko === true && z2 === true
            && Object.values(afterZ2).every(r => r.hidden.Aiko === true) && toldZ2b === 1,
        J({ z2gm, z2, aiko: AIKO(afterZ2), toldZ2b }), { flow: "trial-scene" });
    const z3gm = await gm.eval(`${HALL} ${TAB} if (!aiko().hidden) { await aiko().update({ hidden: true }); await wait(300); } return T.heldHidden(aiko(), hall);`, { timeout: 30000 });
    await settle(600);
    const toldZ3 = (await toldOf("hiddenPutBack", IDS.p1, "Aiko")).length;
    await p1.eval(`${HALL} const t = hall.tokens.find(x => x.name === "Aiko"); try { await t.update({ hidden: false }); } catch {} return true;`, { timeout: 30000 });
    await settle(2000);
    const afterZ3 = await readAll();
    const toldZ3b = (await toldOf("hiddenPutBack", IDS.p1, "Aiko")).length - toldZ3;
    check("z3: (control) after a GM's hide heard on the linked hall, the same show of p1's is put back with one whisper",
        z3gm === true && Object.values(afterZ3).every(r => r.hidden.Aiko === true) && toldZ3b === 1,
        J({ z3gm, aiko: AIKO(afterZ3), toldZ3b }), { flow: "trial-scene" });
    await gm.eval(`const { setClock } = await import("${repoUrl}/scripts/clock.mjs"); await setClock({ phase: "dailyLife" }); await new Promise(r => setTimeout(r, 800)); return true;`, { timeout: 60000 });
    await settle(600);
    await gm.eval(`${HALL} if (hall.tokens.get(${J(zAiko)})) await hall.deleteEmbeddedDocuments("Token", [${J(zAiko)}]); return true;`, { timeout: 30000 });
    await settle(400);
    /* A FIRST hall linked in a trial that runs without one (review r2 cor E, by reading at 5b2b2ed): the Scenes tab holds
       Apply, rightly - the table never entered a hall, and End the trial would leave one - but until E13 fix r2-H2 the
       reason read "A Class Trial is running in the linked trial hall", with no hall linked. The hall is unlinked through
       `applyScenesTab`, the trial opened where the table is, the hall picked in the tab drawn on the GM, the Apply pressed
       anyway; then the trial ends and the hall is linked again. */
    const first = await gm.eval(`${UNTIL} ${HALL} ${TAB} const V = await import("${repoUrl}/scripts/vault.mjs"); const { setClock } = await import("${repoUrl}/scripts/clock.mjs");
        const drawn = () => [...foundry.applications.instances.values()].find(a => a.rendered && a.element?.querySelector?.('[name="scenes:trial"]'));
        const reason = game.i18n.localize("DRPG.TrialScene.hallFirstInTrial");
        const out = { unlink: Boolean(await tab("", hall.id)) }; await wait(300);
        await setClock({ phase: "classTrial" }); await wait(1200);
        out.phase = getClock().phase; out.unlinked = R.trialScene() === null;
        const told = globalThis.__notifications.length;
        const was = globalThis.__dialogWindows; globalThis.__dialogWindows = true;
        try {
            const pending = V.openRoomSetupDialog({ tab: "scenes" });
            const el = (await until(() => drawn()?.element, 8000)) ?? null;
            const trial = el?.querySelector('[name="scenes:trial"]');
            out.drawn = trial?.dataset.drawn ?? null;
            if (trial) { trial.value = hall.id; trial.dispatchEvent(new Event("change")); }
            const ok = el?.querySelector('footer button[data-action="ok"]');
            out.held = Boolean(ok?.disabled); out.label = ok?.getAttribute("aria-label") ?? null; out.labelIsFirst = out.label === reason;
            if (ok) { ok.disabled = false; ok.click(); }
            out.closed = await Promise.race([pending.then(() => "closed"), new Promise(r => setTimeout(() => r("hung"), 8000))]);
        } finally { globalThis.__dialogWindows = was; }
        await wait(800);
        out.stillUnlinked = R.trialScene() === null;
        out.warned = globalThis.__notifications.slice(told).filter(n => n.level === "warn").map(n => n.msg === reason ? "first" : n.msg);
        await setClock({ phase: "dailyLife" }); await wait(1000);
        out.relink = Boolean(await tab(hall.id, "")); await wait(300);
        out.linked = R.trialScene()?.id === hall.id;
        return out;`, { timeout: 90000 });
    await settle(600);
    check("l2: in a trial opened with no hall linked, the Scenes tab with a first hall picked holds Apply with the reason that no hall is linked, and an Apply pressed anyway writes nothing and warns so (E13 fix r2-H2)",
        first.phase === "classTrial" && first.unlinked && first.drawn === "" && first.held === true && first.labelIsFirst === true && first.closed === "closed"
            && first.stillUnlinked === true && J(first.warned) === J(["first"]) && first.linked === true,
        J(first), { flow: "trial-scene" });

    /* ------------------------------ r. a GM's browser loading during the trial ------------------------------ */
    phase("r: a GM's browser that loads during the trial holds the hall as a GM's hand left it", { flow: "trial-scene" });
    /* Review r2 sec S2-1's second road, by reading at 5b2b2ed: a GM client loading mid-trial held nothing, and its seed
       skipped the token being changed, so the first token a player changed was held as the stored choice would show it,
       not as a GM had left it by hand. Here the GM hides Botan (ticked, so the way in showed him) by hand, then gm0 loads -
       a full GM whose id sorts first, so it is the primary while it is at the table - and p2 shows Botan. Since E13 fix
       r2-H2 every GM reads the linked hall at its `ready` (`reseedCastHeld`). gm0 leaves after, and the trial ends. */
    const rIn = await gm.eval(`${HALL} const { setClock } = await import("${repoUrl}/scripts/clock.mjs"); const { getClock } = await import("${repoUrl}/scripts/settings.mjs");
        await setClock({ phase: "classTrial" }); await new Promise(r => setTimeout(r, 1200));
        const botan = hall.tokens.find(t => t.name === "Botan"); const shownIn = !botan.hidden;
        if (!botan.hidden) await botan.update({ hidden: true });
        await new Promise(r => setTimeout(r, 300));
        return { phase: getClock().phase, active: hall.active, shownIn, hidden: botan.hidden };`, { timeout: 60000 });
    await settle(400);
    await connect("gm0");
    await settle(600);
    const rGm0 = await gm0.eval(`${HALL} const T = await import("${repoUrl}/scripts/trial-scene.mjs"); const { isPrimaryGm } = await import("${repoUrl}/scripts/utils.mjs");
        const botan = hall.tokens.find(t => t.name === "Botan"); return { primary: isPrimaryGm(), hidden: botan.hidden, held: T.heldHidden(botan, hall) };`, { timeout: 30000 });
    const toldR = (await toldOf("hiddenPutBack", IDS.p2, "Botan")).length;
    const r1 = await p2.eval(`${HALL} const t = hall.tokens.find(x => x.name === "Botan"); try { await t.update({ hidden: false }); return true; } catch { return false; }`, { timeout: 30000 });
    await settle(2500);
    const afterR = await readAll([...clients, gm0]);
    const toldR1 = (await toldOf("hiddenPutBack", IDS.p2, "Botan")).map(to => J(to));
    check("r1: with Botan hidden by the GM's hand in the trial, a GM's browser that loads then puts p2's show of Botan back on every browser and the GMs are told once (E13 fix r2-H2)",
        rIn.phase === "classTrial" && rIn.active === true && rIn.shownIn === true && rIn.hidden === true && rGm0.primary === true && r1 === true
            && Object.values(afterR).every(r => r.hidden.Botan === true) && toldR1.length - toldR === 1 && toldR1.at(-1) === GMS,
        J({ rIn, rGm0, r1, botan: Object.fromEntries(Object.entries(afterR).map(([who, x]) => [who, x.hidden.Botan])), toldR1, toldR }), { flow: "trial-scene" });
    await disconnect("gm0");
    await settle(600);
    await gm.eval(`${HALL} const { setClock } = await import("${repoUrl}/scripts/clock.mjs");
        await setClock({ phase: "dailyLife" }); await new Promise(r => setTimeout(r, 1000)); return true;`, { timeout: 60000 });
    await settle(600);

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
    check("e1: the season reset during the trial takes every browser to the school, the school active (E13 C3), the cast hidden (E13 C2), the module's token deleted after the reset's cut (E81 DZ6)",
        handE.activated === false && reset.done && reset.phase === "dailyLife" && views(afterReset).every(v => v === "school")
            && Object.values(afterReset).every(r => r.active === "school" && J(shown(r)) === J(["Decor"]) && J(r.ids) === J(before.gm.ids) && !r.open.length),
        J({ handE, reset, afterReset }), { flow: "trial-scene" });

    /* ------------------------------ m. the tier-2 suite at a table with the hall linked ------------------------------ */
    /* E13 fix r2-H3 (12.10.2026; review r2 cor C and sec S2-3). This world is a table's: the Academy linked as the school
       and the hall as the trial hall, the cast chosen. The suite's tests are run here by name through `runTests`, as a GM
       at a table runs them, with the GM's reading taken around each run. */
    phase("m: the tier-2 suite at a table with the hall linked", { flow: "trial-scene" });
    const SUITE = only => `const r = await game.drpg.runTests({ tier: 2, only: ${J(only)}, confirmed: game.world.id });
        const mine = (r?.results ?? []).filter(x => x.tier === 2 && x.name.startsWith(${J(only)}))
            .map(x => ({ name: x.name.slice(0, 48), outcome: x.outcome, message: String(x.message ?? "").slice(0, 400) }));
        const runner = (r?.results ?? []).filter(x => x.outcome === "fail" && !x.name.startsWith(${J(only)})).map(x => x.name.slice(0, 80));`;
    /* What the GM holds of the world's hall and links: the links, the hall's module flags, its tokens' hidden by name, the
       active scene, and every scene activated on the GM since `__m1active` was set. */
    const HALLNOW = `${HALL} return { roles: game.settings.get("${MOD}", "sceneRoles"), flags: hall.flags?.["${MOD}"] ?? {},
        hidden: Object.fromEntries(hall.tokens.contents.map(t => [t.name, t.hidden])), active: game.scenes.active?.id ?? null,
        activated: [...(globalThis.__m1active ?? [])] };`;
    const hallBefore = await gm.eval(`globalThis.__m1active = [];
        if (!globalThis.__m1hook) globalThis.__m1hook = Hooks.on("updateScene", (scene, changes) => { if (changes?.active === true) globalThis.__m1active.push(scene.name); });
        ${HALLNOW}`, { timeout: 30000 });
    const consoleRun = await gm.eval(`${SUITE("the trial console names the next step in every state of the trial")}
        return { passed: r?.passed, failed: r?.failed, mine, runner };`, { timeout: 200000 });
    await settle(400);
    const hallAfter = await gm.eval(HALLNOW, { timeout: 30000 });
    const mViews = await readAll();
    /* Read 12.10.2026 at d08652d with this file kept (e12run/e13r2h3red; cor C's probe on 5b2b2ed read the same failure):
       the console test failed - End the trial asked through the window it did not read - and the trial it opened
       activated this hall and then the Academy on the GM. */
    check("m1: with the hall linked, the tier-2 trial console test passes and leaves the world's hall alone - no scene activated, the hall's flags and tokens as they were, the links put back, every browser on the school (E13 fix r2-H3)",
        consoleRun.failed === 0 && consoleRun.mine.length === 1 && consoleRun.mine[0].outcome === "pass" && hallBefore.roles?.trial
            && hallAfter.activated.length === 0 && J(hallAfter) === J(hallBefore) && views(mViews).every(v => v === "school")
            && Object.values(hallBefore.flags.trialSeats ?? {}).every(seat => seat?.token === null),
        J({ consoleRun, hallBefore, hallAfter, views: views(mViews) }), { flow: "trial-scene" });

    /* The four tests that drive End the trial's carry, each with a fence around the world's students. A module that refuses
       one token of that fence - Aiko's, hidden, where the fence stands - leaves her outside it; her own tokens are read
       before and after each run. */
    const CARRY = ["End the trial moves the living to the GM's room", "End the trial carries a living student from another scene with rooms",
        "End the trial carries a student's token across scenes whole", "End the trial never leaves a living student without a token"];
    const TOKENS = id => `return game.scenes.contents.flatMap(s => s.tokens.contents.filter(t => t.actorId === "${id}").map(t => s.name + ":" + t.id)).sort();`;
    const aikoBefore = await gm.eval(TOKENS(IDS.aiko), { timeout: 30000 });
    await gm.eval(`globalThis.__m2refuse = Hooks.on("preCreateToken", (doc, data) => doc.parent?.name?.startsWith("SUITE E13")
        && data.actorId === "${IDS.aiko}" && data.hidden === true && data.y === 1500 ? false : undefined); return true;`, { timeout: 30000 });
    const fenceRuns = [];
    try {
        for (const only of CARRY) fenceRuns.push(await gm.eval(`${SUITE(only)} return { mine, runner };`, { timeout: 200000 }));
    } finally {
        await gm.eval(`Hooks.off("preCreateToken", globalThis.__m2refuse); return true;`, { timeout: 30000 });
    }
    const aikoAfter = await gm.eval(TOKENS(IDS.aiko), { timeout: 30000 });
    const FENCE = "the fence around the world's students did not hold";
    const stopped = runs => runs.length > 0 && runs.every(({ mine }) => mine.length === 1 && mine[0].outcome === "fail" && mine[0].message.includes(FENCE));
    /* Read 12.10.2026 at d08652d with this file kept (e12run/e13r2h3red): with the fence unread, three of the four tests
       failed on their own readings, one passed, and after the four Aiko had no token on any scene - her Academy token
       and her hall token both gone (which test took which not read). */
    check("m2: a fence token another module refuses stops each of the four carry tests with a failure that says so, and Aiko keeps every token she had (E13 fix r2-H3)",
        stopped(fenceRuns) && fenceRuns.every(run => run.mine[0].message.includes("Aiko") && !run.runner.length) && aikoBefore.length > 0
            && J(aikoAfter) === J(aikoBefore),
        J({ fenceRuns, aikoBefore, aikoAfter }), { flow: "trial-scene" });

    /* The other road: a student made after the fence - by a module, once the fence's first token lands - played by p1 and
       standing on the Academy. The runner's restore after the test takes the new actor away and leaves its token, and says
       so ("could not restore the world after"): that line is the world changing under the run, as it would at a table. */
    await gm.eval(`globalThis.__m3late = null;
        globalThis.__m3make = Hooks.on("preCreateToken", (doc, data) => {
            if (globalThis.__m3late || !doc.parent?.name?.startsWith("SUITE E13") || data.hidden !== true || data.y !== 1500) return;
            globalThis.__m3late = Actor.create({ name: "M3 Late", type: "character", ownership: { default: 0, "${IDS.p1}": 3 } })
                .then(actor => game.scenes.get("${IDS.scene}").createEmbeddedDocuments("Token", [{ name: "M3 Late", actorId: actor.id, actorLink: true,
                    x: 300, y: 500, width: 1, height: 1, hidden: false }]).then(() => actor.id));
        }); return true;`, { timeout: 30000 });
    let lateRun = null, made = null;
    try {
        lateRun = await gm.eval(`${SUITE(CARRY[0])} return { mine, runner };`, { timeout: 200000 });
    } finally {
        made = await gm.eval(`Hooks.off("preCreateToken", globalThis.__m3make);
            const id = await globalThis.__m3late; const actor = game.actors.get(id);
            const tokens = game.scenes.contents.flatMap(s => s.tokens.contents.filter(t => t.actorId === id).map(t => s.id === "${IDS.scene}" ? "academy" : s.name));
            for (const s of game.scenes.contents) { const ids = s.tokens.contents.filter(t => t.actorId === id).map(t => t.id); if (ids.length) await s.deleteEmbeddedDocuments("Token", ids); }
            await actor?.delete();
            return { made: typeof id === "string", tokens };`, { timeout: 60000 });
    }
    /* Read 12.10.2026 at d08652d with this file kept: the test failed on its own readings and the late student's
       Academy token was gone. */
    check("m3: a student made after the fence stops the carry test too, by name, and keeps the token on the Academy (E13 fix r2-H3)",
        stopped([lateRun]) && lateRun.mine[0].message.includes("M3 Late") && made.made && J(made.tokens) === J(["academy"]),
        J({ lateRun, made }), { flow: "trial-scene" });

    /* ------------------------------ n. a body stays where it fell ------------------------------ */
    phase("n: a dead student's token does not move for its player, on the school and in the hall", { flow: "trial-scene" });
    /* E13 fix l1-L1 (the 1.2.74 ledger; the owner's Q-E13-1 a: the dead revealed in the hall are immovable for their player
       through the corpse veto that was there before). movement.mjs `onPreUpdateToken` runs the veto on the mover's browser
       and returns before it for a GM, so tier 1 and tier 2, which run on the GM's, cannot reach it: it is driven here, by
       p1. A dead student p1 plays and a Monocub p1 plays (dead, and walks), made here and gone at the end of the phase, each
       with a token on the Academy where Aiko stands and one in the linked hall. p1 moves each token a step that stays in
       the room it stands in (none in the hall, which holds no room), so no crossing rule answers; then the GM moves the
       dead student's two. Until this phase no test of any tier drove the veto (`git grep isCorpse` at 8b4974a: one census
       row). */
    const fixN = await gm.eval(`${HALL} const R = await import("${repoUrl}/scripts/rooms.mjs");
        const aiko = academy.tokens.find(t => t.actorId === "${IDS.aiko}");
        const own = { default: 0, "${IDS.p1}": 3 };
        const dead = await Actor.create({ name: "S41 Fallen", type: "character", ownership: own, flags: { "${MOD}": { deceased: true } } });
        const cub = await Actor.create({ name: "S41 Cub n", type: "character", ownership: own, flags: { "${MOD}": { deceased: true, monocub: true } } });
        const token = (actor, x, y) => ({ name: actor.name, actorId: actor.id, actorLink: true, x, y, width: 1, height: 1, hidden: false });
        const [deadHere, cubHere] = await academy.createEmbeddedDocuments("Token", [token(dead, aiko.x, aiko.y), token(cub, aiko.x, aiko.y)]);
        const [deadHall, cubHall] = await hall.createEmbeddedDocuments("Token", [token(dead, 1200, 700), token(cub, 1200, 700)]);
        return { actors: [dead.id, cub.id], academy: [deadHere.id, cubHere.id], hall: [deadHall.id, cubHall.id],
            role: R.sceneRole(hall), place: R.isPlaceScene(academy) };`, { timeout: 30000 });
    await settle(1000);
    /* One move of token `id` on the scene `where` names, by browser `c`, to a spot in the room it stands in; what that
       browser holds of the token after, and what it was told. */
    const moveN = (c, where, id) => c.eval(`${HALL} const M = await import("${repoUrl}/scripts/movement.mjs");
        const scene = ${where}, t = scene.tokens.get(${J(id)}), room = M.roomOfToken(t), before = [t.x, t.y];
        const step = [[100, 0], [-100, 0], [0, 100], [0, -100]].find(([dx, dy]) => M.roomAt(t.x + dx, t.y + dy, t) === room) ?? null;
        const told = globalThis.__notifications.length;
        let threw = null;
        if (step) try { await t.update({ x: t.x + step[0], y: t.y + step[1] }); } catch (err) { threw = String(err?.message ?? err); }
        await new Promise(r => setTimeout(r, 1200));
        const now = scene.tokens.get(${J(id)});
        return { room, before, to: step && [before[0] + step[0], before[1] + step[1]], at: [now.x, now.y], threw,
            told: globalThis.__notifications.slice(told).map(n => n.level + ":" + n.msg) };`, { timeout: 30000 });
    const ON = { academy: "academy", hall: "hall" };
    const AT = `${HALL} const at = (scene, id) => { const t = scene.tokens.get(id); return t ? [t.x, t.y] : null; };`;
    const movesN = {
        deadSchool: await moveN(p1, ON.academy, fixN.academy[0]), deadHall: await moveN(p1, ON.hall, fixN.hall[0]),
        cubSchool: await moveN(p1, ON.academy, fixN.academy[1]), cubHall: await moveN(p1, ON.hall, fixN.hall[1])
    };
    await settle(400);
    /* What the GM holds after p1's moves, before its own. */
    const midN = await gm.eval(`${AT} return { academy: ${J(fixN.academy)}.map(id => at(academy, id)), hall: ${J(fixN.hall)}.map(id => at(hall, id)) };`);
    Object.assign(movesN, { gmSchool: await moveN(gm, ON.academy, fixN.academy[0]), gmHall: await moveN(gm, ON.hall, fixN.hall[0]) });
    await settle(400);
    const heldN = await gm.eval(`${AT}
        const out = { dead: game.i18n.localize("DRPG.Move.dead"), academy: ${J(fixN.academy)}.map(id => at(academy, id)), hall: ${J(fixN.hall)}.map(id => at(hall, id)) };
        await academy.deleteEmbeddedDocuments("Token", ${J(fixN.academy)}.filter(id => academy.tokens.get(id)));
        await hall.deleteEmbeddedDocuments("Token", ${J(fixN.hall)}.filter(id => hall.tokens.get(id)));
        for (const id of ${J(fixN.actors)}) await game.actors.get(id)?.delete();
        return out;`, { timeout: 30000 });
    const vetoed = move => move.to && J(move.at) === J(move.before) && move.told.includes(`warn:${heldN.dead}`);
    const stood = move => move.to && move.threw === null && J(move.at) === J(move.to) && !move.told.includes(`warn:${heldN.dead}`);
    check("n1: p1's move of the token of a dead student it plays is refused on the Academy and in the linked hall, with the corpse veto's warning, and the token stays where it was on p1's browser and the GM's (E13 fix l1-L1; Q-E13-1 a)",
        fixN.role === "trial" && fixN.place === true && vetoed(movesN.deadSchool) && vetoed(movesN.deadHall)
            && J(midN.academy[0]) === J(movesN.deadSchool.before) && J(midN.hall[0]) === J(movesN.deadHall.before),
        J({ fixN, movesN, midN }), { flow: "trial-scene" });
    check("n2: the Monocub p1 plays moves on the Academy and in the hall, unwarned, and the GM's move of the dead student's tokens stands on both, unwarned - the veto is the player's, and a Monocub is no body (E13 fix l1-L1)",
        stood(movesN.cubSchool) && stood(movesN.cubHall) && stood(movesN.gmSchool) && stood(movesN.gmHall)
            && J(midN.academy[1]) === J(movesN.cubSchool.to) && J(midN.hall[1]) === J(movesN.cubHall.to)
            && J(heldN.academy[0]) === J(movesN.gmSchool.to) && J(heldN.hall[0]) === J(movesN.gmHall.to),
        J({ movesN, midN, heldN }), { flow: "trial-scene" });
}
