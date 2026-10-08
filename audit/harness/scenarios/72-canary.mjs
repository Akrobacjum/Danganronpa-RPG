/**
 * 72-canary: what a player's browser holds of the GM's secrets and of another
 * player's plans (E30, 24.09.2026; audit S17-07; lib/canary.mjs).
 *
 * The canary's self-test first, so an absence below means something: each surface
 * is shown being read, and a leak planted on purpose comes back as a hit. Then one
 * marker in each secret field the module writes from the GM's side or a killer's -
 * the Key Remnant plan, a trace's note and subject, a Truth Bullet's GM note, a
 * secret project and an indirect murder's condition, a player's pre-session note,
 * a Direct Murder parked in an Eclipse, a hidden token, the name the GM gives a
 * found trace - and one scan of every player's browser once the table is at rest.
 * A marker found where it may not be
 * is a hit: one known-leaks.json describes is that leak, reproduced, and red until
 * its stage; any other fails this run. At rest p1's `game.drpg.keyPlan()` is asked
 * too: the plan is the GMs' store since E05 C5; and a spill is planted and the
 * Despair overflow's count read on the GM and on p1: the GMs' record since E05 C12;
 * and the found trace's token and Aiko's copy of it are read on the GM, p1 and p2:
 * what it is called, and where it came from, are its finder's and the GMs' since E05 C13.
 *
 * THROUGH A CHAPTER (E05 C2, 26.09.2026). After "rest" the chapter those secrets
 * belong to is played on, and after each phase the markers are scanned again and
 * p1's and p2's world data - neither is the killer's player's - is read against
 * scripts/world-secrets.mjs and for Chie's actor id (`canary.worldScan`):
 *   trap          the indirect murder's bar filled and its trap armed (it watches Storage);
 *                 its receipt, a veiled card in Chie's player's thread, read on p3 and p1 (E06 C8);
 *   eclipse       p1 crosses twice, and no crossing's card names Aiko or p1 (E05 C4);
 *                 the GM allows Chie's parked Direct Murder: the ask names neither her
 *                 player nor her (E05 C3), and p3 is sent no card of the allowance (C19b);
 *   incident      the lights: Chie kills Botan (p2's), her opening thrown on p3's
 *                 client with forced dice (deleted after use), then a Finishing Blow;
 *                 the GM leaves an incident's trace in Dorm B while it runs, and in
 *                 Stage 6 Chie erases another (E06 C1);
 *   undiscovered  the incident closed with the body not found; its trace, which nobody
 *                 copied, is read hidden and unmarked on p1 and p2 (E05 C14); Chie
 *                 takes a watch off Botan, and p1 reads no word of him on her sheet
 *                 (E05 fix r2-F0b);
 *   discovery     a Faint Prep trace in Dorm B; Aiko and Daichi walk in, and the
 *                 promotion dialog ticks it - its row and p1's copy of its token are
 *                 read (E05 C14); the watch's Truth Bullet reaches Chie, naming Botan
 *                 (E05 fix r2-F0b); Aiko takes a torch off Botan's body (E05 C14);
 *   verdict       a trial naming Daichi, a wrong verdict: Chie survives, nothing is written on
 *                 her, and her Reinforced Level Up waits in the GMs' store (E05 C11).
 * Each later E05 commit adds its checks to the phase that shows its secret.
 * From rest to the discovery the chat of each phase's bystanders is read too (E06 C1,
 * `canary.chatScan`): what a card's document says of the cast beyond its words.
 *
 * E43 extends this to the season (the identity needles of lib/canary.mjs's path).
 */
export const layers = ["ci"];

const MOD = "danganronpa-rpg";

export async function run({ gm, p1, p2, p3, check, phase, settle, canary, repoUrl, IDS }) {
    phase("selftest");
    await canary.selfTest();

    phase("plant");
    /* The GM's plan for the Key Remnants (investigation.mjs, setKeyPlan). */
    const kp = { name: canary.marker("keyplan.name"), text: canary.marker("keyplan.text"),
        analysis: canary.marker("keyplan.analysis"), note: canary.marker("keyplan.note") };
    await gm.eval(`await game.drpg.setKeyPlan({ chapter: 1, entries: [{ name: "${kp.name}", text: "${kp.text}", analysis: "${kp.analysis}", note: "${kp.note}" }] });
        return true;`);

    /* A trace, not an incident's: hidden, and its note and subject for the GM's ledger only. */
    const trace = { note: canary.marker("remnant.note"), subject: canary.marker("remnant.subject") };
    const traceId = await gm.eval(`const t = await game.drpg.placeRemnant({ room: "Gym", type: "prep", visibility: "obvious",
            note: "${trace.note}", subject: "${trace.subject}" });
        return t?.id ?? null;`, { timeout: 60000 });
    check("gm: a trace is placed, its token on the GM's scene", Boolean(traceId), String(traceId));

    /* A Truth Bullet on Aiko (p1's): the bullet is hers to read, its GM note is not. */
    const bulletNote = canary.marker("bullet.note");
    const bullet = await gm.eval(`const item = await game.drpg.createTruthBullet(game.actors.get("${IDS.aiko}"), { name: "A torn ticket", playerText: "Half a cinema ticket.", gmNote: "${bulletNote}" });
        return item?.uuid ?? null;`, { timeout: 60000 });
    check("gm: a Truth Bullet is made on Aiko's sheet", Boolean(bullet), String(bullet));

    /* A secret project that is an indirect murder: the killer's (p3's) and the GM's. */
    const project = { name: canary.marker("project.name", { allowed: ["gm", "p3"] }),
        condition: canary.marker("project.condition", { allowed: ["gm", "p3"] }) };
    const made = await gm.eval(`const p = await game.drpg.createProject({ name: "${project.name}", indirectMurder: true, secret: true,
            killerId: "${IDS.chie}", condition: "${project.condition}" });
        return p?.id ?? null;`, { timeout: 60000 });
    check("gm: a secret indirect-murder project is made for Chie", Boolean(made), String(made));

    /* p3's own pre-session note (pre-session-note.mjs), which is for the GMs. */
    const note = canary.marker("note.player", { allowed: ["gm", "p3"] });
    const noteSaved = await p3.eval(`const { saveNote } = await import("${repoUrl}/scripts/pre-session-note.mjs");
        return await saveNote(game.user.id, "${note}");`, { timeout: 30000 });

    /* A Direct Murder parked during an Eclipse, by the killer's player (eclipse.mjs). */
    const park = canary.marker("park.note", { allowed: ["gm", "p3"] });
    const beforeEclipse = await gm.eval(`return game.messages.contents.map(m => m.id);`);
    const eclipse = await gm.eval(`await game.drpg.startEclipse(); return game.drpg.isEclipse();`, { timeout: 60000 });
    check("gm: an Eclipse is open", eclipse === true, String(eclipse));
    /* The Eclipse's start tells each student's player where they stand and how far they may go
       (eclipse.mjs `startEclipse`): one card to every player, Chie's among them, spoken as each
       student - it says nothing of anybody that the others' cards do not. The chat read below
       passes over them (E06 C1; measured 27.09: on the C1 tree the card to p3 was the rest
       phase's only hit, as chat.id, chat.name and chat.whisper). */
    const eclipseCards = await gm.eval(`const had = new Set(${JSON.stringify(beforeEclipse)});
        return game.messages.contents.filter(m => !had.has(m.id)).map(m => m.id);`);
    await canary.chatMark({ ids: eclipseCards });
    const beforePark = await gm.eval(`return game.messages.size;`);
    await p3.eval(`const { parkDirectMurder } = await import("${repoUrl}/scripts/eclipse.mjs");
        await parkDirectMurder({ killerId: "${IDS.chie}", room: "Gym", note: "${park}" });
        return true;`, { timeout: 60000 });
    await settle(1000);
    // In the GMs' store since E05 C3; the world's old key is read by 72's world scan, on the players.
    const parked = await gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        return Boolean(S.pendingMurderStore.get("${IDS.chie}"));`);
    check("gm: Chie's Direct Murder is parked, waiting for the GM", parked === true, String(parked));
    /* The cards a declaration makes, found on the GM - who reads every one of their words - by
       what they say: the ask quotes the park's note. Their documents are read on p1 and p2 in
       phase eclipse. */
    const cardsSaying = (from, text) => gm.eval(`const { contentOf } = await import("${repoUrl}/scripts/secret.mjs");
        const text = ${JSON.stringify(text)};
        return game.messages.contents.slice(${from}).filter(m => contentOf(m).includes(text)).map(m => m.id);`);
    const askCards = await cardsSaying(beforePark, park);

    /* A token the GM hid. */
    const hidden = canary.marker("token.hidden");
    await gm.eval(`const scene = game.scenes.active ?? canvas.scene;
        const [t] = await scene.createEmbeddedDocuments("Token", [{ name: "${hidden}", hidden: true, x: 3000, y: 2500 }]);
        return t?.id ?? null;`);

    /* A FOUND TRACE, NAMED BY THE GM (E05 C13, 27.09.2026; audit S05-39 (1), (2)). The GM reveals a
       trace in the Gym, names it with a marker, and copies it onto Aiko's sheet (p1's). The copy is
       named apart from the trace: a bullet is an item on its holder's sheet, and Foundry sends every
       browser every actor with its items - which the GM handbook writes down as Foundry's (S05-39 (4)),
       and which would find the marker on p2 whatever the token said. So the marker measures the token
       alone: until 1.2.64 the public name went onto it, where every browser reads it. The trace was
       revealed before the copy, so the copy's own reveal writes nothing - the name reaches the token
       only as the GM names it. */
    const publicName = canary.marker("remnant.publicName", { allowed: ["gm", "p1"] });
    const foundTrace = await gm.eval(`const R = await import("${repoUrl}/scripts/remnants.mjs");
        const t = await game.drpg.placeRemnant({ room: "Gym", type: "prep", visibility: "obvious" });
        if (!t) return null;
        await game.drpg.revealRemnant(t);
        await R.setRemnantPublic(t, { name: "${publicName}" });
        const item = await game.drpg.createTruthBullet(game.actors.get("${IDS.aiko}"), { name: "A scrap of ribbon", playerText: "Red, frayed at one end.",
            realType: "prep", visibility: "obvious", remnantId: t.id, sceneId: t.parent.id });
        return { id: t.id, scene: t.parent.id, uuid: item?.uuid ?? null, hidden: t.hidden, named: R.remnantPublic(t)?.name === "${publicName}" };`, { timeout: 60000 });
    check("gm: a trace is revealed, named by the GM and copied onto Aiko's sheet under a name of its own",
        Boolean(foundTrace?.uuid) && foundTrace.hidden === false && foundTrace.named === true, JSON.stringify(foundTrace), { flow: "truth-bullets" });

    phase("rest");
    await settle(1500);
    await canary.scan({ phase: "rest" });

    /* THE CHAT, READ FOR WHO AND WHAT (E06 C1, 27.09.2026; lib/canary.mjs `chatScan`). Here and
       after each phase of the chapter below, the cards that reached the phase's bystanders since
       the last read are read for the cast - its actors' ids and names, its players - and for the
       titles of the secret actions: the crisis actions, the openings, Stage 6's, the murder
       project's and Confusion. Until the lights the cast is Chie and p3, and p1 and p2 are read;
       from the lights Botan and p2 are cast beside them, and Botan meets Chie face to face (D6),
       so p1 alone is read, through the discovery, when the body is the table's and the killer is
       not. The verdict is not read: a wrong verdict reveals the blackened by design (en.json
       `outcomeEscaped`). Each hit a later E06 commit closes is a known-leaks.json entry. */
    const TITLES = await gm.eval(`const C = await import("${repoUrl}/scripts/config.mjs"); const L = k => game.i18n.localize(k);
        return [...Object.values(C.CRISIS_ACTIONS), ...Object.values(C.MURDER_OPENING), ...Object.values(C.CLEANUP.actions ?? {})].map(d => d?.label)
            .concat([L("DRPG.Cleanup.action"), L("DRPG.Cleanup.transformAction"), L("DRPG.Tamper.coverAction"), L("DRPG.Roll.crisis"),
                L("DRPG.Roll.murderProject"), L("DRPG.Roll.concealIntent"), L("DRPG.Roll.hideTraces"), ...Object.values(C.MONOCUB?.abilities ?? {}).map(d => d?.label)])
            .filter((t, i, all) => typeof t === "string" && t.trim() && !t.startsWith("DRPG.") && all.indexOf(t) === i);`);
    const castNames = await gm.eval(`return ${JSON.stringify([IDS.chie, IDS.botan])}.map(id => game.actors.get(id)?.name ?? "");`);
    const KILLER_CHAT = { who: ["p1", "p2"], actorIds: [IDS.chie], names: [castNames[0]], userIds: [p3.userId], titles: TITLES };
    const INCIDENT_CHAT = { who: ["p1"], actorIds: [IDS.chie, IDS.botan], names: castNames, userIds: [p3.userId, p2.userId], titles: TITLES };
    check("gm: the secret actions' titles are read for the chat scan - the crisis actions, the openings, Stage 6's, the murder project's and Confusion",
        TITLES.length >= 20 && ["Finishing blow", "Confusion"].every(t => TITLES.includes(t)) && castNames.every(Boolean), JSON.stringify({ TITLES, castNames }));
    await canary.chatScan({ phase: "rest", ...KILLER_CHAT });

    /* THE KEY REMNANT PLAN IS THE GMS' (E05 C5, 26.09.2026; audit S01-01, S05-02): a GM store since
       1.2.64, so on the GM the first slot holds the markers planted above, and on p1
       `game.drpg.keyPlan()` - which asks nobody who is calling - has nothing to build from: the
       clock's chapter and five blank slots. The scan above looks for the markers everywhere on
       every player; the world scan reads the old key empty from phase trap on. Red on 5ba3389
       (C4) with this check, the rule and known leak S01-01 taken out: p1's plan was the GM's, one
       slot holding all four markers; the scan found the four on p1, p2 and p3 in each of its
       seven scans, and the world scan keyRemnantPlan on p1 and p2 in all six of its (26.09). */
    const planOf = p => p.eval(`const plan = game.drpg.keyPlan();
        return { chapter: plan.chapter, slots: plan.entries.length, first: [plan.entries[0]?.name ?? null, plan.entries[0]?.note ?? null],
            written: plan.entries.filter(e => e.name || e.text || e.analysis || e.note || e.tokenId).length };`);
    const planGm = await planOf(gm), planP1 = await planOf(p1);
    check("p1: game.drpg.keyPlan() is five blank slots, and the plan is the GM's",
        planGm.first[0] === kp.name && planGm.first[1] === kp.note && planP1.slots === 5 && planP1.written === 0, JSON.stringify({ planGm, planP1 }));

    /* THE INDIRECT MURDER'S KILLER IS NOT IN WORLD DATA (E05 C1, 26.09.2026; audit S09-05, D3). The
       scan reads the condition's marker; the killer and the builder are actor ids, which carry no
       marker, so they are asked of the setting itself - on the two browsers that are not the
       killer's player's. The project's own row has to be there, or its absence measures nothing.
       Red on 93bbde8 (1.2.63) with this check alone, as known leak S09-05: p1 and p2 each held the
       project's killerId, by, condition and trigger, and Chie's actor id. */
    const metaHolds = p => p.eval(`const meta = game.settings.get("${MOD}", "projectMeta") ?? {};
        const fields = Object.entries(meta).flatMap(([id, row]) => ["killerId", "by", "condition", "trigger"]
            .filter(f => row && typeof row === "object" && Object.hasOwn(row, f)).map(f => id + "." + f));
        return { row: Object.hasOwn(meta, "${made ?? "none"}"), fields, killer: JSON.stringify(meta).includes("${IDS.chie}") };`);
    const metaP1 = await metaHolds(p1), metaP2 = await metaHolds(p2);
    check("p1 and p2: projectMeta holds no killerId, by, condition or trigger, and no character id of the killer",
        Boolean(made) && [metaP1, metaP2].every(m => m.row && !m.fields.length && !m.killer), JSON.stringify({ p1: metaP1, p2: metaP2 }));

    /* THE PRE-SESSION NOTE IS THE GMS' (E05 C6, 26.09.2026; audit S11-03, S01-08): p3 saved it
       through the primary GM, whose store keeps it, and it is no flag of p3's User document, which
       every browser holds. The scan above looks for its marker on every player; here it is read
       where each reads it - the GM from its store, p1 nothing of p3's - and p3's flag is read on p1:
       that a note is written, and no text. Red on 50a79af (C5) with this check, the rule and known
       leak S11-03 taken out (26.09): saveNote answered true, p1 read p3's note from the flag, which
       held its text, the scan found the marker on p1 and p2 at the flag's text in each of its seven
       scans, and the world scan the flag's text on both in all six of its phases. */
    const noteOn = c => c.eval(`const N = await import("${repoUrl}/scripts/pre-session-note.mjs");
        return { text: N.noteFor("${p3.userId}"), flag: game.users.get("${p3.userId}").getFlag("${MOD}", "preSessionNote") ?? null };`);
    const noteGm = await noteOn(gm), noteP1 = await noteOn(p1);
    check("p3's pre-session note is sent to the GMs and kept in their store; p1 reads none of it, and p3's flag holds no text",
        noteSaved === "sent" && noteGm.text === note && noteP1.text === "" && noteP1.flag?.written === true && !Object.hasOwn(noteP1.flag ?? {}, "text"),
        JSON.stringify({ noteSaved, noteGm, noteP1 }), { flow: "pre-session-note" });

    /* THE OVERFLOW'S COUNT IS THE GMS' (E05 C12, 27.09.2026; audit S01-60): the record of a GM store
       since 1.2.64, and the world setting `overflow` keeps the darkening's stamp alone. A spill is
       planted the way a roll's point makes one - the GM's pool filled, then two points more through
       `adjustDespair` - and the count read where each reads it: the GM's from the record, two up;
       p1's world value holding no count, and p1's `overflowCount()` 0. The pool is put back; the
       two points stay, below any X. The world scans of the chapter below read the rule's
       `overflow.count` on p1 and p2 after it. */
    const overflowOn = c => c.eval(`const o = await import("${repoUrl}/scripts/overflow.mjs");
        return { count: o.overflowCount(), world: game.settings.get("${MOD}", "overflow") ?? null };`);
    const poolBefore = await gm.eval(`return game.drpg.getDespair(game.user.id);`);
    const beforeSpill = await overflowOn(gm);
    await gm.eval(`await game.drpg.setDespair(game.user.id, game.drpg.despairMax()); await game.drpg.adjustDespair(game.user.id, 2); return true;`);
    await settle(800);
    const spillGm = await overflowOn(gm), spillP1 = await overflowOn(p1);
    await gm.eval(`await game.drpg.setDespair(game.user.id, ${Number(poolBefore) || 0}); return true;`);
    check("a spill counts on the GM, and p1's world value holds no overflow count",
        spillGm.count === beforeSpill.count + 2 && spillP1.count === 0 && !Object.hasOwn(spillP1.world ?? {}, "count"),
        JSON.stringify({ beforeSpill, spillGm, spillP1 }));

    /* A FOUND TRACE'S NAME IS ITS FINDER'S AND THE GMS' (E05 C13, 27.09.2026; audit S05-39 (1), (2)).
       The scan above reads the GM's name for the trace everywhere on every player; here the found
       trace is read where each reads it. Its token says the neutral word and wears the question mark
       on the GM, p1 and p2 alike. What each screen calls it (remnant-icons.mjs `shownOnTrace`, which a
       canvas would draw): the GM the row's name - compared on the GM, so no player is handed the
       marker - p1 its own copy's, p2 nothing. And which trace Aiko's bullet came from: no flag of the
       item says so on any of them; the GM reads it off the row, p1 off its copy of its own bullets'
       keys (`mineBulletRefs`), p2 not at all. The world scans of the chapter below read the rule's
       Item half - no `remnantRef` on any item - on p1 and p2 after every phase. */
    // The marker goes into the GM's code alone: a player is never handed one it may not hold.
    const foundOn = (c, mark = null) => c.eval(`const icons = await import("${repoUrl}/scripts/remnant-icons.mjs");
        const B = await import("${repoUrl}/scripts/truth-bullets.mjs");
        const t = game.scenes.get("${foundTrace?.scene ?? "none"}")?.tokens?.get("${foundTrace?.id ?? "none"}") ?? null;
        const item = fromUuidSync("${foundTrace?.uuid ?? "none"}");
        const shown = t && typeof icons.shownOnTrace === "function" ? icons.shownOnTrace(t) : null;
        return { token: t ? [t.hidden, t.name === game.i18n.localize("DRPG.Remnant.tokenName"), t.texture?.src ?? null] : null,
            shown: ${mark ? `shown?.name === ${JSON.stringify(mark)} ? "the row's" : (shown?.name ?? null)` : "shown?.name ?? null"},
            ref: !item ? "no item" : typeof B.bulletRefOf === "function" ? B.bulletRefOf(item) : "no bulletRefOf",
            flag: item ? Object.hasOwn(item.flags?.["${MOD}"] ?? {}, "remnantRef") : null };`);
    const foundGm = await foundOn(gm, publicName), foundP1 = await foundOn(p1), foundP2 = await foundOn(p2);
    const traceKey = foundTrace ? `${foundTrace.scene}.${foundTrace.id}` : "none";
    const questionMark = `modules/${MOD}/icons/remnant-unknown.svg`;
    check("a found trace's token says the neutral word and wears the question mark on every browser; the GM calls it by the row, p1 by its copy, p2 nothing",
        [foundGm, foundP1, foundP2].every(f => f.token?.[0] === false && f.token[1] === true && f.token[2] === questionMark)
        && foundGm.shown === "the row's" && foundP1.shown === "A scrap of ribbon" && foundP2.shown === null,
        JSON.stringify({ foundGm, foundP1, foundP2 }), { flow: "truth-bullets" });
    check("Aiko's bullet names its trace in no flag; the GM reads the key off the row, p1 off its own copy, and p2 holds none",
        [foundGm, foundP1, foundP2].every(f => f.flag === false) && foundGm.ref === traceKey && foundP1.ref === traceKey && foundP2.ref === null,
        JSON.stringify({ key: traceKey, gm: foundGm.ref, p1: foundP1.ref, p2: foundP2.ref, flags: [foundGm.flag, foundP1.flag, foundP2.flag] }), { flow: "truth-bullets" });

    /* An unfound trace is a token, and a token reaches every browser (S17-64): not a
       marker in a field, so it is asked of the scene itself. */
    const holders = [];
    for (const p of [p1, p2, p3]) {
        if (await p.eval(`return Boolean((game.scenes.active ?? canvas.scene)?.tokens.get("${traceId ?? "none"}"));`)) holders.push(p.who);
    }
    check("an unfound trace's token reaches no player's browser", holders.length === 0,
        holders.length ? `trace token ${traceId} on ${holders.join(", ")}` : "", { knownLeak: "S17-64", measured: Boolean(traceId) });

    /* ------------------------------ E05: a chapter ------------------------------ */

    /* The chapter the planted secrets belong to, played on from where plant left it: the
       Eclipse is running and Chie's Direct Murder parked. Each phase waits for the state it
       needs, then `canary.scan` (the markers) and `canary.worldScan` (the world-secrets rule,
       and Chie's actor id in world data) run on p1 and p2. Positions are the GM's to set - a
       GM's move is free (movement.mjs) - so who stands where is the scenario's, not the dice's. */
    const settled = async (name, what, ms = 20000) => {
        const until = Date.now() + ms;
        let v = await what();
        while (!v && Date.now() < until) { await settle(250); v = await what(); }
        return v;
    };
    const scanned = async (name, chat = null) => {
        await settle(800);
        await canary.scan({ phase: name });
        await canary.worldScan({ phase: name, ids: [IDS.chie] });
        if (chat) await canary.chatScan({ phase: name, ...chat });
    };
    const PROJ = `const P = await import("${repoUrl}/scripts/projects.mjs"); const T = await import("${repoUrl}/scripts/traps.mjs");`;

    /* trap: the indirect murder's bar is filled and its trap armed - it watches Storage, where
       nobody goes. */
    phase("trap");
    const armedTrap = await gm.eval(`${PROJ}
        await P.updateProject("${made ?? "none"}", { room: "Storage", trigger: { kind: "enters", afterDark: false, notBuilder: true } });
        const row = P.allProjects().find(p => p.id === "${made ?? "none"}");
        if (row) await P.addProgress(row.id, Math.max(1, row.start - row.current), { by: "${IDS.chie}" });
        await new Promise(r => setTimeout(r, 300));
        return { armed: T.diagnoseTraps().armed, complete: P.isComplete(P.allProjects().find(p => p.id === "${made ?? "none"}")) };`, { timeout: 60000 });
    check("gm: the indirect murder's bar is filled and its trap armed", armedTrap.complete === true && armedTrap.armed >= 1, JSON.stringify(armedTrap));
    await scanned("trap", KILLER_CHAT);
    /* The trap's receipt (E06 C8): a veiled thread card. Found on the GM in Chie's player's
       thread by its title, then read by id on p3 - listed in her own thread from the meta its
       words brought - and on p1, where the document names no thread and no player, and lists
       in no thread. */
    const receiptId = await gm.eval(`const M = await import("${repoUrl}/scripts/messenger.mjs"); const S = await import("${repoUrl}/scripts/secret.mjs");
        const title = foundry.utils.escapeHTML(game.i18n.localize("DRPG.Trap.armedTitle"));
        return M.threadMessages("${p3.userId}").reverse().find(m => S.contentOf(m).includes(title))?.id ?? null;`);
    const receiptOn = c => c.eval(`const M = await import("${repoUrl}/scripts/messenger.mjs"); const S = await import("${repoUrl}/scripts/secret.mjs");
        const m = game.messages.get("${receiptId ?? "none"}");
        return m ? { listed: M.threadMessages("${p3.userId}").some(x => x.id === m.id), placed: S.cardFlag(m, "thread") ?? null,
            flags: Object.keys(m.toObject().flags?.["${MOD}"] ?? {}).sort(), unaddressed: game.users.filter(u => !m.whisper.includes(u.id)).length } : null;`);
    const [receiptP3, receiptP1] = [await receiptOn(p3), await receiptOn(p1)];
    check("trap: the trap's receipt is a veiled card in Chie's player's thread - listed there on p3's browser, and naming no thread on p1's (E06 C8)",
        Boolean(receiptId) && receiptP3?.listed === true && receiptP3.placed === p3.userId
        && receiptP1?.listed === false && receiptP1.placed === null && receiptP1.unaddressed === 0
        && JSON.stringify(receiptP1.flags) === JSON.stringify(["secret", "veiled"]),
        JSON.stringify({ receiptId, receiptP3, receiptP1 }));

    /* eclipse: p1 crosses twice - through `judgeEclipseCrossing` on p1's client, the road a token
       dragged across a border takes (movement.mjs `settleRoute`), so each crossing's card is the
       game's own (E05 C4); the count is the GM's - and the GM allows Chie's parked declaration now,
       so the lights do not wait on a window. */
    phase("eclipse");
    const beforeCrossing = await p1.eval(`return game.messages.size;`);
    // Into the room she stands in: the token does not move here, and the GM's card names where it stands.
    const crossedInto = await p1.eval(`return (await import("${repoUrl}/scripts/movement.mjs")).roomOfActor(game.actors.get("${IDS.aiko}"));`);
    const crossings = await p1.eval(`const E = await import("${repoUrl}/scripts/eclipse.mjs");
        const actor = game.actors.get("${IDS.aiko}");
        const first = await E.judgeEclipseCrossing(actor, null, ${JSON.stringify(crossedInto)}), second = await E.judgeEclipseCrossing(actor, null, ${JSON.stringify(crossedInto)});
        return [first, second];`, { timeout: 60000 });
    // What p3, Chie's player, holds before the allowance: read again just before the lights.
    const p3HeldBefore = await p3.eval(`return game.messages.contents.map(m => m.id);`);
    const ruled = await gm.eval(`await game.drpg.ruleOnParkedMurder("${IDS.chie}", true);
        return { left: game.drpg.eclipseMovesLeft(game.actors.get("${IDS.aiko}")), eclipse: game.drpg.isEclipse() };`, { timeout: 60000 });
    check("p1: Aiko crosses twice in the Eclipse and has no crossing left", JSON.stringify(crossings) === "[true,true]" && ruled.left === 0 && ruled.eclipse === true,
        JSON.stringify({ crossings, ruled }));
    /* WHAT A CROSSING'S CARD SAYS OF WHO CROSSED (E05 C4, 26.09.2026; audit S07-46, S10-39). The card
       tells its owner the room they walked into, and its words go to them alone; but it was posted
       by the mover's client, speaking as the character, to the owner - so every browser's copy of
       the document said who crossed, and when. Found on p1 by its words (the room), read on p2 and
       p3; the two cards have to be found, or their absence measures nothing. */
    await settle(600);
    const crossingCards = await p1.eval(`const { contentOf } = await import("${repoUrl}/scripts/secret.mjs");
        return game.messages.contents.slice(${beforeCrossing}).filter(m => contentOf(m).includes(${JSON.stringify(crossedInto ?? "-")})).map(m => m.id);`);
    const crossNaming = [];
    for (const p of [p2, p3]) {
        const docs = await p.eval(`return ${JSON.stringify(crossingCards)}.map(id => {
            const m = game.messages.get(id);
            if (!m) return { id, held: false };
            const s = m._source;
            return { id, held: true, author: s.author ?? null, speaker: s.speaker?.actor ?? null, whisper: s.whisper ?? [] };
        });`);
        for (const d of docs) {
            if (d.held && (d.author === p1.userId || d.speaker === IDS.aiko || (d.whisper.includes(p1.userId) && !d.whisper.includes(p.userId)))) crossNaming.push({ who: p.who, ...d });
        }
    }
    check("p2 and p3: the cards of Aiko's two crossings name neither Aiko nor her player, and p1 did not post them",
        Boolean(crossedInto) && crossingCards.length === 2 && crossNaming.length === 0, JSON.stringify({ crossedInto, crossingCards, crossNaming }));
    /* WHAT THE DECLARATION'S CARDS SAY OF WHO DECLARED (E05 C3, 26.09.2026; audit S11-02). The
       words of the GM's ask travel to the GMs alone, but every browser holds its document. On
       1.2.63 the ask was a card in the killer's player's messenger thread - the document names
       the thread - and the ruling was addressed to that player with Chie as its speaker: a new
       card of either during an Eclipse said who had declared. Read on p1 and p2: the ask may not
       name p3's thread, be addressed to p3 without them, or speak as Chie; it has to be found, or
       its absence measures nothing. The allowance has no card since E08+E28 C19b (04.10.2026:
       a declaration allowed in the dark can still be refused at the lights, and its killer was
       told yes, then no): read on p3, no card that came after it carries words for p3 before
       the lights - the crossings' cards came before it and are p1's. */
    await settle(600);
    const declared = [...askCards];
    const p3Told = await p3.eval(`const S = await import("${repoUrl}/scripts/secret.mjs"); const had = new Set(${JSON.stringify(p3HeldBefore)});
        return game.messages.contents.filter(m => !had.has(m.id) && (S.secretHtml(m) !== null || (!S.isVeiled(m) && m.whisper.includes(game.user.id))))
            .map(m => ({ id: m.id, words: S.contentOf(m).replace(/<[^>]+>/g, " ").trim().slice(0, 80) }));`);
    const naming = [];
    for (const p of [p1, p2]) {
        const docs = await p.eval(`return ${JSON.stringify(declared)}.map(id => {
            const m = game.messages.get(id);
            if (!m) return { id, held: false };
            const s = m._source;
            return { id, held: true, thread: s.flags?.["${MOD}"]?.thread ?? null, speaker: s.speaker?.actor ?? null, whisper: s.whisper ?? [] };
        });`);
        for (const d of docs) {
            if (d.held && (d.thread === p3.userId || d.speaker === IDS.chie || (d.whisper.includes(p3.userId) && !d.whisper.includes(p.userId)))) naming.push({ who: p.who, ...d });
        }
    }
    check("p1 and p2: the GM's ask about Chie's declaration names neither her player's thread, her player nor Chie; p3 is sent no card of its allowance",
        askCards.length >= 1 && naming.length === 0 && p3Told.length === 0, JSON.stringify({ askCards, naming, p3Told }));
    await scanned("eclipse", KILLER_CHAT);

    /* incident: the lights. Botan (p2's) stands beside Chie in Dorm B and nobody else is there;
       the Eclipse ends and the allowed declaration opens the incident. Chie's opening is thrown on
       p3's client with forced dice - a critical, which always opens (61 F) - deleted after use;
       p1 and p2 answer nothing, and the GM resolves the Finishing Blow, as 10-murder does. */
    phase("incident");
    for (const c of [p1, p2]) await c.eval(`globalThis.__dialogAuto = false; return true;`);
    await gm.eval(`await canvas.scene.tokens.get("TOKBOTAN00000000").update({ x: 500, y: 1400 }); return true;`);
    await p3.eval(`globalThis.__forceRoll = { hope: 10, fear: 10 }; return true;`);
    await gm.eval(`await game.drpg.endEclipse(); return true;`, { timeout: 90000 });
    const opened = await settled("incident", () => gm.eval(`const s = game.drpg.murderState(); return s?.stage === "incident" ? s.stage : null;`));
    /* AN INCIDENT'S TRACE (E05 C14, 27.09.2026; audit S05-42). The GM leaves one in Dorm B while the
       incident runs: D11 creates it un-hidden and marked as the incident's, for its cast to draw. It is
       read again once the incident has closed (phase undiscovered). */
    const incidentTrace = await gm.eval(`const t = await game.drpg.placeRemnant({ room: "Dorm B", type: "incident", visibility: "evident", note: "72: an incident's trace" });
        return t ? { id: t.id, scene: t.parent?.id ?? null, hidden: t.hidden, marked: t.getFlag("${MOD}", "fromIncident") ?? null } : null;`, { timeout: 60000 });
    await p3.eval(`delete globalThis.__forceRoll; globalThis.__dialogAuto = false; return true;`);
    /* THE CRISIS ROLL'S BOOKMARK (E05 C7, 26.09.2026; audit S02-01). A crisis action's roll is
       bookmarked for a Reroll (murder-rules.mjs `takeCrisisAction`); here p3 throws Chie's the way that
       roll is thrown, and the GM rules the blow as before. Until 1.2.64 the bookmark was Chie's
       actor flag, which this phase's world scan found on p1 and p2 (measured on the C6 tree with
       this roll); E05 C7 made it p3's own client setting, and E08+E28 C4a the GMs' row, which
       p3's browser reports the roll to (action-rolls.mjs `tellGmsOfRoll`). Since E08+E28 fix
       r2-H1 the GM draws a crisis roll only at its character's turn, so the turn is passed to
       Chie, the killer, first: the incident opens on the victim's. */
    const chieTurn = await gm.eval(`for (let i = 0; i < 4 && game.drpg.murderState()?.turnSide !== "killer"; i++) await game.drpg.passTurn();
        return game.drpg.murderState()?.turnSide ?? null;`, { timeout: 60000 });
    await p3.eval(`const A = await import("${repoUrl}/scripts/action-rolls.mjs");
        globalThis.__forceRoll = { hope: 8, fear: 3 };
        try { await A.rollTrait(game.actors.get("${IDS.chie}"), "body", { actionKey: "crisis", context: { crisis: "finishingBlow" } }); }
        finally { delete globalThis.__forceRoll; }
        return true;`, { timeout: 60000 });
    const crisisMark = await gm.eval(`const { rerollBookmarkStore } = await import("${repoUrl}/scripts/gm-stores.mjs");
        for (let i = 0; i < 40 && rerollBookmarkStore.get("${IDS.chie}")?.by !== "${IDS.p3}"; i++) await new Promise(r => setTimeout(r, 100));
        const row = rerollBookmarkStore.get("${IDS.chie}");
        return row ? { actionKey: row.actionKey, by: row.by } : null;`, { timeout: 60000 });
    check("gm: Chie's crisis roll is kept for a Reroll on the GMs, as p3 threw it", crisisMark?.actionKey === "crisis" && crisisMark.by === IDS.p3,
        JSON.stringify({ crisisMark, chieTurn }));
    /* THE GM'S MESSAGE OF A DRAWN ROLL, IN A BYSTANDER'S BROWSER (E08+E28 C12a, 04.10.2026). Chie's
       crisis roll above was thrown on p3's client and drawn by the GM (roll-draw.mjs): the GM wrote
       its message, the record's id and `drawn` beside the claim's flag. p1 holds the document, as
       every browser does: its author is the GM, its module flags are those three, and nothing in it
       names Chie or p3, by id or by name. And p1, a bystander, cannot read it (E08+E28 C13): a roll
       the GM drew is read beside the GMs only where the draw's answer or a GM's dice packet says
       (private-rolls.mjs `readableHere`), which is p3's browser and the victim's, not p1's. */
    const drawnCopy = await p1.eval(`const m = game.messages.contents.filter(x => x.getFlag("${MOD}", "drawn")).at(-1) ?? null;
        const doc = m ? JSON.stringify(m.toObject()) : "";
        const terms = ["${IDS.chie}", "${IDS.p3}", game.actors.get("${IDS.chie}")?.name, game.users.get("${IDS.p3}")?.name].filter(Boolean);
        return { id: m?.id ?? null, author: m?.author?.id ?? null, flags: Object.keys(m?.flags?.["${MOD}"] ?? {}).sort(), named: terms.filter(t => doc.includes(t)),
            readable: m ? m.isContentVisible : null };`);
    check("p1: the GM's message of p3's drawn crisis roll is the GM's, holds three module flags, and names neither Chie nor p3",
        Boolean(drawnCopy.id) && drawnCopy.author === IDS.gm && JSON.stringify(drawnCopy.flags) === JSON.stringify(["drawn", "rollId", "supersededRoll"])
            && drawnCopy.named.length === 0, JSON.stringify(drawnCopy));
    check("p1: a bystander's browser cannot read the GM's message of p3's drawn crisis roll",
        Boolean(drawnCopy.id) && drawnCopy.readable === false, JSON.stringify(drawnCopy));
    /* A DEATH IN TWO PHASES (E05 C10, 26.09.2026; audit S06-11). Botan carries a Truth Bullet
       into the incident; the blow kills him for the GMs and for his own player (p2), and p1's
       browser reads him alive - no flag, no marker, his bullet still on the sheet - until the
       discovery. Red on 3377e7d: the flag and the status reached p1 with the blow. */
    const hunch = await gm.eval(`const b = await game.drpg.createTruthBullet(game.actors.get("${IDS.botan}"), { name: "72: Botan's hunch", playerText: "72" });
        return b?.id ?? null;`, { timeout: 60000 });
    const killed = await gm.eval(`await game.drpg.resolveCrisisAction({ actorId: "${IDS.chie}", key: "finishingBlow", total: 99, isCritical: false, withHope: true });
        await new Promise(r => setTimeout(r, 1500));
        return { stage: game.drpg.murderState()?.stage ?? null, dead: game.drpg.isDeadForGm(game.actors.get("${IDS.botan}")) };`, { timeout: 60000 });
    check("gm: at the lights Chie's declaration opens the incident, and her Finishing Blow kills Botan",
        opened === "incident" && killed.dead === true && killed.stage === "resolution", JSON.stringify({ opened, killed }));
    await settle(800);
    const botanOn = c => c.eval(`const a = game.actors.get("${IDS.botan}");
        return { flag: a.getFlag("${MOD}", "deceased") ?? null, status: a.statuses?.has?.("dead") ?? false, known: game.drpg.isDeadForGm(a),
            bullet: Boolean(a.items.get("${hunch ?? "none"}")) };`);
    const [onP1, onP2] = [await botanOn(p1), await botanOn(p2)];
    check("p1: Botan dead in no world data on p1's browser before the discovery - no flag, no status, his bullet still there",
        Boolean(hunch) && onP1.flag === null && onP1.status === false && onP1.known === false && onP1.bullet === true, JSON.stringify({ hunch, onP1 }));
    check("p2: Botan's own player knows he is dead (isDeadForGm) while the table does not", onP2.known === true && onP2.flag === null, JSON.stringify(onP2));
    /* STAGE 6 BY THE KILLER (E06 C1). The chat read wants the cards of every stage an incident
       has, and 72 had no Stage 6 action: Chie, alone in Dorm B with the body, erases a trace the
       GM leaves there for her, thrown on p3's client with forced dice - a success with Hope, which
       asks no question. Read here: her roll came back, and the GM's ruling took the trace away. */
    const sixTrace = await gm.eval(`const t = await game.drpg.placeRemnant({ room: "Dorm B", type: "incident", visibility: "subtle", note: "72: Stage 6's trace" });
        return t ? { id: t.id, scene: t.parent?.id ?? null } : null;`, { timeout: 60000 });
    const sixRoll = await p3.eval(`const Cl = await import("${repoUrl}/scripts/cleanup.mjs");
        globalThis.__forceRoll = { hope: 11, fear: 2 };
        try { const r = await Cl.attemptCleanup(game.actors.get("${IDS.chie}"), "${sixTrace?.id ?? "none"}"); return { rolled: Boolean(r?.roll), total: r?.roll?.total ?? null }; }
        finally { delete globalThis.__forceRoll; }`, { timeout: 60000 });
    const sixErased = await settled("incident", () => gm.eval(`return game.scenes.get("${sixTrace?.scene ?? "none"}")?.tokens.get("${sixTrace?.id ?? "none"}") ? null : true;`));
    check("p3: in Stage 6 Chie erases a trace in Dorm B, and the GM's ruling takes it away (E06 C1)",
        Boolean(sixTrace?.scene) && sixRoll.rolled === true && sixErased === true, JSON.stringify({ sixTrace, sixRoll, sixErased }));
    await scanned("incident", INCIDENT_CHAT);

    /* undiscovered: the incident is closed with nobody having found Botan. */
    phase("undiscovered");
    const closed = await gm.eval(`await game.drpg.endMurder({ reason: "closed", followUp: false });
        return { stage: game.drpg.murderState()?.stage ?? null, found: game.settings.get("${MOD}", "bodyFound") ?? null };`, { timeout: 60000 });
    check("gm: the incident closes with the body not yet found", !closed.stage || closed.stage === "idle", JSON.stringify(closed));
    /* THE CLOSED INCIDENT'S TRACE (E05 C14, 27.09.2026; audit S05-42). Nobody copied it, so the close
       hid it, and it is no longer marked as an incident's: the mark names no incident, and until 1.2.64
       the cast of every later incident was drawn it - where this crime scene was. The drawing needs a
       canvas; what p1's and p2's copies of the token say is read here. And a trace of the incident type
       placed now, with none running, is created hidden and unmarked. Red on the C13 tree: both un-hidden
       and marked. */
    const lateTrace = await gm.eval(`const t = await game.drpg.placeRemnant({ room: "Dorm B", type: "incident", visibility: "evident", note: "72: an incident's trace, after the close" });
        return t?.id ?? null;`, { timeout: 60000 });
    await settle(600);
    const tracesOn = c => c.eval(`const scene = game.scenes.get("${incidentTrace?.scene ?? "none"}");
        return ${JSON.stringify([incidentTrace?.id ?? "none", lateTrace ?? "none"])}.map(id => { const t = scene?.tokens.get(id);
            return t ? [t.hidden, t.getFlag("${MOD}", "fromIncident") ?? null] : null; });`);
    const [tracesP1, tracesP2] = [await tracesOn(p1), await tracesOn(p2)];
    check("p1 and p2: the closed incident's trace nobody copied is hidden and no longer the incident's, and one placed after the close is created so (E05 C14)",
        incidentTrace?.hidden === false && incidentTrace?.marked === true
        && JSON.stringify(tracesP1) === JSON.stringify([[true, null], [true, null]]) && JSON.stringify(tracesP2) === JSON.stringify(tracesP1),
        JSON.stringify({ incidentTrace, lateTrace, tracesP1, tracesP2 }));
    /* A BODY LOOTED BEFORE ANYBODY FOUND IT (E05 fix r2-F0b, 27.09.2026; the owner's Q1-Q3). Chie, still
       in Dorm B, takes a watch the GM put on Botan - p3's own request, as one who knows of the death
       (Q2). The watch moving between two sheets is world data, which the owner chose; the Truth Bullet
       of it was an item on Chie's sheet, and its creation reached every browser saying "Taken from
       Botan's body." - a death nobody had found (red on e47a5d5). p1 knows nothing yet: what p1's
       browser was sent of Chie's items (each creation and change, as it arrived) and what it holds
       after are the watch, no bullet, and no word of Botan. The bullet comes with the discovery (below). */
    const WHAT = `const botan = game.actors.get("${IDS.botan}")?.name ?? "?";
        const what = i => ({ name: i.name, bullet: i.getFlag("${MOD}", "category") === "truthBullet",
            names: [i.name, i.system?.description ?? "", JSON.stringify(i.flags?.["${MOD}"] ?? {})].join(" ").includes(botan) });`;
    const newOnChie = (c, before) => c.eval(`${WHAT} const had = new Set(${JSON.stringify(before ?? [])});
        return game.actors.get("${IDS.chie}").items.filter(i => !had.has(i.id)).map(what);`);
    const chieHad = await p1.eval(`${WHAT} globalThis.__chieSent = [];
        globalThis.__chieHook = (i, how) => { if (i?.parent?.id === "${IDS.chie}") globalThis.__chieSent.push({ how, ...what(i) }); };
        globalThis.__chieHooks = [["createItem", i => globalThis.__chieHook(i, "create")], ["updateItem", i => globalThis.__chieHook(i, "update")]];
        for (const [name, fn] of globalThis.__chieHooks) Hooks.on(name, fn);
        return game.actors.get("${IDS.chie}").items.map(i => i.id);`);
    const watch = await gm.eval(`const INV = await import("${repoUrl}/scripts/inventory.mjs");
        const item = await INV.grantItem(game.actors.get("${IDS.botan}"), { name: "72: Botan's watch", category: "tool", tier: 1, override: true, quiet: true });
        return item?.id ?? null;`, { timeout: 60000 });
    const tookWatch = await p3.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        return await B.requestBodyLoot({ takerId: "${IDS.chie}", bodyId: "${IDS.botan}", itemId: "${watch ?? "none"}" });`, { timeout: 60000 });
    await settled("undiscovered", async () => ((await newOnChie(p1, chieHad)).length ? true : null));
    await settle(800);
    const watchOnP1 = await newOnChie(p1, chieHad);
    const sentToP1 = await p1.eval(`for (const [name, fn] of globalThis.__chieHooks ?? []) Hooks.off(name, fn);
        const sent = globalThis.__chieSent ?? []; delete globalThis.__chieSent; delete globalThis.__chieHooks; delete globalThis.__chieHook; return sent;`);
    check("p1: Chie's loot of Botan's body before the discovery reaches p1 as the watch alone - sent and held: no Truth Bullet, and no word of Botan (E05 fix r2-F0b)",
        Boolean(watch) && tookWatch?.ok === true && JSON.stringify(watchOnP1) === JSON.stringify([{ name: "72: Botan's watch", bullet: false, names: false }])
        && sentToP1.some(r => r.how === "create" && r.name === "72: Botan's watch") && !sentToP1.some(r => r.bullet || r.names),
        JSON.stringify({ watch, tookWatch, watchOnP1, sentToP1 }));
    /* THE LONE FINDER (E05 C10; the owner's Q1, 26.09.2026). Chie leaves Dorm B for the Hall, and
       Aiko (p1's), in no part of the incident, walks in alone: p1 is told privately and knows
       Botan is dead, the table reads no flag, and nothing is announced - two witnesses stay the
       rule, so the discovery below is Aiko's and Daichi's. */
    const told = await p1.eval(`return globalThis.__notifications?.length ?? 0;`);
    await gm.eval(`await canvas.scene.tokens.get("TOKCHIE000000000").update({ x: 2400, y: 400 });
        await canvas.scene.tokens.get("TOKAIKO000000000").update({ x: 600, y: 1300 }); return true;`, { timeout: 60000 });
    const alone = await settled("undiscovered", () => p1.eval(`const a = game.actors.get("${IDS.botan}");
        const told = (globalThis.__notifications ?? []).slice(${told}).map(n => n.msg);
        return game.drpg.isDeadForGm(a) && told.length ? { flag: a.getFlag("${MOD}", "deceased") ?? null, told } : null;`));
    const announced = await gm.eval(`return game.settings.get("${MOD}", "bodyFound")?.room ?? null;`);
    check("p1: Aiko alone with Botan's body is told privately and knows he is dead - no flag on p1, and no body announcement",
        Boolean(alone) && alone.flag === null && announced === null, JSON.stringify({ alone, announced }));
    await scanned("undiscovered", INCIDENT_CHAT);

    /* discovery: a Faint Prep trace is left in Dorm B; Aiko and Daichi walk in, the second
       witness sets the discovery off, and the GM's promotion dialog ticks every trace it lists. */
    phase("discovery");
    const prep = await gm.eval(`const t = await game.drpg.placeRemnant({ room: "Dorm B", type: "prep", visibility: "obvious", faint: true, note: "72: a Faint Prep trace" });
        globalThis.__promoted = null;
        globalThis.__dialogAnswers.push(async function promote(cfg) {
            if (cfg.window?.title !== game.i18n.localize("DRPG.Chapter.promoteTitle")) { globalThis.__dialogAnswers.unshift(promote); return null; }
            const el = document.createElement("dialog");
            if (typeof cfg.content === "string") el.innerHTML = cfg.content; else el.append(cfg.content.cloneNode(true));
            const boxes = [...el.querySelectorAll('input[name="promote"]')];
            boxes.forEach(box => { box.checked = true; });
            globalThis.__promoted = boxes.length;
            const ok = (cfg.buttons ?? []).find(b => b.action === "ok");
            return ok.callback(new window.Event("click"), { form: null }, { element: el });
        });
        return t?.id ?? null;`, { timeout: 60000 });
    await gm.eval(`await canvas.scene.tokens.get("TOKAIKO000000000").update({ x: 600, y: 1300 });
        await canvas.scene.tokens.get("TOKDAICHI0000000").update({ x: 650, y: 1500 }); return true;`, { timeout: 60000 });
    const found = await settled("discovery", () => gm.eval(`const b = game.settings.get("${MOD}", "bodyFound"); return b?.room ? { room: b.room, promoted: globalThis.__promoted } : null;`));
    check("gm: Aiko and Daichi find Botan in Dorm B, and the promotion dialog lists the Faint Prep trace",
        Boolean(prep) && found?.room === "Dorm B" && found?.promoted >= 1, JSON.stringify({ prep, found }));
    await settle(800);
    const afterP1 = await botanOn(p1);
    check("p1: the discovery made Botan's death the table's - the flag and the status on p1, his bullet gone",
        Boolean(afterP1.flag) && afterP1.status === true && afterP1.bullet === false, JSON.stringify(afterP1));
    /* THE WATCH'S BULLET (E05 fix r2-F0b): the publication gave Chie what the death's row owed her - the
       Truth Bullet of the watch, which names Botan's body now that the table knows it. */
    const watchBullet = await settled("discovery", async () => {
        const got = (await newOnChie(p1, chieHad)).filter(i => i.bullet);
        return got.length ? got : null;
    });
    const watchBulletName = await p1.eval(`return game.i18n.format("DRPG.Loot.bulletName", { item: "72: Botan's watch" });`);
    check("p1: with the discovery Chie holds the Truth Bullet of Botan's watch, and it names his body (E05 fix r2-F0b)",
        JSON.stringify(watchBullet) === JSON.stringify([{ name: watchBulletName, bullet: true, names: true }]), JSON.stringify({ watchBullet, watchBulletName }));
    /* WHAT THE PROMOTION WROTE (E05 C14, 27.09.2026; audit S05-06, S06-02). The dialog above ticked the
       Faint Prep trace: its row on the GM reads faint no more and tied to the crime, and p1's copy of its
       token carries nothing of it - until E04 the ticks went onto the token, where every console read
       them and nothing else did. The token reaches p1 as every hidden token does (S17-64). */
    const REM = `const R = await import("${repoUrl}/scripts/remnants.mjs"); const scene = game.scenes.active ?? canvas.scene;`;
    const promotedRow = await gm.eval(`${REM} const d = R.remnantData(scene.tokens.get("${prep ?? "none"}"));
        return d ? { faint: d.faint, tied: d.tiedToCrime } : null;`);
    const promotedOnP1 = await p1.eval(`const t = (game.scenes.active ?? canvas.scene).tokens.get("${prep ?? "none"}");
        return t ? Object.keys(t._source?.flags?.["${MOD}"] ?? {}).sort() : null;`);
    check("gm and p1: the promoted Faint Prep trace's row reads faint no more and tied to the crime, and p1's copy of its token carries neither (E05 C14)",
        promotedRow?.faint === false && promotedRow?.tied === true && JSON.stringify(promotedOnP1) === JSON.stringify(["isRemnant"]),
        JSON.stringify({ promotedRow, promotedOnP1 }));
    /* A BODY LOOTED (E05 C14, 27.09.2026; audit S05-39 (3)). Botan's death is the table's now; the GM
       puts a torch on him, and Aiko (p1's) takes it through p1's own request. The GMs' row names the
       body's trace and the torch, and Botan carries no `lootTrace` flag on p1 or p2 - until 1.2.64 he
       did, and every console read the trace's token id and what had been taken off him (red on the C13
       tree). The torch moving between two sheets is world data, which the handbook writes down (S05-39 (4)). */
    const torch = await gm.eval(`const INV = await import("${repoUrl}/scripts/inventory.mjs");
        const item = await INV.grantItem(game.actors.get("${IDS.botan}"), { name: "72: Botan's torch", category: "tool", tier: 1, override: true, quiet: true });
        return item?.id ?? null;`, { timeout: 60000 });
    const looted = await p1.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        return await B.requestBodyLoot({ takerId: "${IDS.aiko}", bodyId: "${IDS.botan}", itemId: "${torch ?? "none"}" });`, { timeout: 60000 });
    const lootRow = await settled("discovery", () => gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const row = S.lootTraceStore?.get("${IDS.botan}"); return row?.tokenId ? { tokenId: row.tokenId, taken: row.taken } : null;`));
    const lootFlag = c => c.eval(`return game.actors.get("${IDS.botan}")?.flags?.["${MOD}"]?.lootTrace ?? null;`);
    const [lootP1, lootP2] = [await lootFlag(p1), await lootFlag(p2)];
    check("gm, p1 and p2: Aiko's loot of Botan's torch is the GMs' row, and Botan carries no loot record on p1 or p2 (E05 C14)",
        Boolean(torch) && (lootRow?.taken ?? []).includes("72: Botan's torch") && lootP1 === null && lootP2 === null,
        JSON.stringify({ torch, looted, lootRow, lootP1, lootP2 }));
    await scanned("discovery", { ...KILLER_CHAT, who: ["p1"] });

    /* verdict: the trial names Daichi, which is wrong - Chie survives, and is the Blackened
       the verdict rewards. p1 votes; p3 (the killer's player) too; p2's student is dead. */
    phase("verdict");
    await gm.eval(`await game.drpg.setClock({ phase: "classTrial" }); await game.drpg.startFloor(); return true;`, { timeout: 60000 });
    for (const c of [p1, p3]) {
        await c.eval(`globalThis.__dialogAuto = true;
            globalThis.__dialogAnswers.push(async function ballot(cfg) {
                if (!(cfg.classes ?? []).includes("drpg-ballot")) { globalThis.__dialogAnswers.unshift(ballot); return null; }
                const el = document.createElement("dialog");
                if (typeof cfg.content === "string") el.innerHTML = cfg.content; else el.append(cfg.content.cloneNode(true));
                const radio = el.querySelector('input[name="choice0"][value="${IDS.daichi}"]');
                if (!radio) return null;
                radio.checked = true;
                const button = (cfg.buttons ?? []).find(b => b.default) ?? cfg.buttons?.[0];
                return button.callback(new window.Event("click"), { form: null }, { element: el });
            });
            return true;`);
    }
    const ballots = await gm.eval(`return await game.drpg.openVote();`, { timeout: 60000 });
    await settled("verdict", () => gm.eval(`const V = await import("${repoUrl}/scripts/vote.mjs"); return V.votesIn() >= 2 ? true : null;`));
    /* The surviving Blackened's Level Up (E05 C11; audit S03-01, S06-01): until 1.2.64 the wrong
       verdict applied it at once, and p1 read Chie's new maximum Health and `advances`, and a card
       spoken by Chie with the Level Up's sound. The GM's Level Up window, if one opens, is answered
       with every pick "+1 max Health" (the harness's own default press cannot read that form), so
       a verdict that still applied it would show on p1 as a rise; it waits in the GMs' store now. */
    const chieOnP1 = () => p1.eval(`const a = game.actors.get("${IDS.chie}");
        const fresh = game.messages.filter(m => !(globalThis.__verdictFrom ?? new Set()).has(m.id));
        return { max: a.system?.resources?.hitPoints?.max ?? null, advances: a.getFlag("${MOD}", "advances") ?? 0,
            spoken: fresh.filter(m => m.speaker?.actor === "${IDS.chie}").length,
            sfx: fresh.filter(m => m.flags?.["${MOD}"]?.sfx === "levelUp").length };`);
    await p1.eval(`globalThis.__verdictFrom = new Set(game.messages.map(m => m.id)); return true;`);
    const chieBefore = await chieOnP1();
    const verdict = await gm.eval(`globalThis.__dialogAnswers.push(async function advance(cfg) {
            if (!(cfg.classes ?? []).includes("drpg-advance")) { globalThis.__dialogAnswers.unshift(advance); return null; }
            const n = (String(cfg.content ?? "").match(/name="pick\\.\\d+\\.option"/g) ?? []).length;
            return Array.from({ length: n }, () => ({ option: "hp" }));
        });
        const r = await game.drpg.closeVote();
        try {
            await game.drpg.applyVerdict?.({ correct: false, executedIds: ["${IDS.daichi}"], blackenedIds: ["${IDS.chie}"] });
        } finally {
            const q = globalThis.__dialogAnswers, at = q.findIndex(f => f?.name === "advance");
            if (at >= 0) q.splice(at, 1);
        }
        const V = await import("${repoUrl}/scripts/vote.mjs");
        return { accused: r?.accusedId ?? null, applied: V.trialProgress().verdictApplied === true,
            chieAlive: !game.drpg.isDeceased(game.actors.get("${IDS.chie}")) };`, { timeout: 90000 });
    check("gm: the vote names Daichi, a wrong verdict, and Chie survives it",
        ballots >= 2 && verdict.accused === IDS.daichi && verdict.applied && verdict.chieAlive, JSON.stringify({ ballots, verdict }));
    await settle(800);
    const chieAfter = await chieOnP1();
    check("p1: the wrong verdict wrote nothing on Chie - her maximum Health and advances are as they were (E05 C11)",
        chieAfter.max === chieBefore.max && chieAfter.advances === chieBefore.advances, JSON.stringify({ chieBefore, chieAfter }));
    check("p1: no card of the wrong verdict is spoken by Chie or carries the Level Up's sound (E05 C11)",
        chieAfter.spoken === 0 && chieAfter.sfx === 0, JSON.stringify(chieAfter));
    const waiting = await gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const row = S.deferredOfferStore?.get("${IDS.chie}"); return row ? { kind: row.kind, count: row.count } : null;`);
    check("gm: Chie's Reinforced Level Up waits in the GMs' store for the class (E05 C11)",
        waiting?.kind === "reinforced" && waiting?.count === 1, JSON.stringify(waiting));
    await scanned("verdict");
}
