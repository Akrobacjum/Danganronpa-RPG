/**
 * S4: both GMs press the same thing at the same moment (the road to 2.0, F3; 24.11.2026).
 * ---------------------------------------------------------------------------
 *     DRPG_FORGE_URL=... DRPG_FORGE_WORLD=DRPG-QA-Forge node audit/forge/run.mjs s4-two-gms-at-once
 *
 * GM1, GM2 and P1 log in; `prim` and `sec` are the two GM roles as the pages read them (utils.mjs `primaryGmId`). Each
 * press is two evals in Promise.all whose bodies wait in the page for one moment, `at`, 2 s ahead, read off the clock of
 * the machine both browsers run on, so the two presses leave their pages within a few milliseconds of each other (the
 * Forge server's order of arrival is not read; UNMEASURED). Written 24.11.2026 and NOT YET RUN on Forge.
 *
 * Phases, in order:
 *   0  the table: roles, the primary on every page, tokens for P1-P4's characters (made where absent), the game unpaused.
 *   A  one card's ruling pressed by both GMs at once: a Dynamic action's refusal, its difficulty (the two GMs' windows
 *      filled with different tiers, so whose ruling went is readable), a Hope Call's yes. Exactly one ruling written,
 *      the same on both GMs, the player's answer that one, the other GM told something sensible or nothing.
 *   B  Next time of day pressed by both GMs at once (boundary.mjs `nextTimeOfDay`: the readiness round, P1 answers Done):
 *      the clock moves one time of day, written once, every page reads the same clock, no round left open.
 *   C  End the Eclipse pressed by both at once (boundary.mjs `toggleEclipse`; the Eclipse started by the primary first):
 *      it ends once, on every page, one time of day on (DAY-06: the second press joins the round; DAY-03: the end is
 *      carried out where the primary's register of legal positions is, read as the writer of the clock's end). Then
 *      DAY-06 proper: the primary holds a Next time of day round open and the second GM presses the Eclipse.
 *   D  the same Truth Bullet given to P1's character by both GMs at once (bridge-asks.mjs `requestGiveBullet`, the Give
 *      window's road, D153): one copy on every page.
 *   E  every page in one state: the same clock, no Eclipse, no incident, no round open, every card of this run answered.
 *   Z  the clock, the pause and the windows put back.
 *
 * WHAT IT WRITES to DRPG-QA-Forge: tokens for P1-P4's characters where the active scene has none (left for the next run);
 * request and ruling cards; the clock moved twice (B, C) and an Eclipse started and ended (both refill every student's
 * actions), put back at the end; the readiness rounds' record; one Remnant placed and deleted and the Truth Bullets made
 * from it deleted (D). Chat cards and GM-store rows stay.
 *
 * UNMEASURED:
 *   - "at the same moment" is the two pages' own clocks; which press the server delivers first is not read.
 *   - C2 (DAY-03) is a proxy: 2.0's fix may keep the end on whichever GM pressed and share the register instead; the
 *     check reads whose browser wrote the clock's end (`updateSetting`'s user), which is the primary's when the end is
 *     carried out there.
 *   - DAY-06's 2.0 words are not known: the check passes on a notice naming the GM whose round is open, or on the second
 *     GM being shown that round (its window drawn), and fails on the bridge's generic "cannot do that now".
 *   - the readiness round's buttons by `data-action` (boundary.mjs `goButtons`, `confirmGo`, the player's "done").
 */

import { call, run as inPage, J, poll, step, readTable, prepare, restore, words, runTag } from "../page-kit.mjs";

export const meta = {
    id: "s4-two-gms-at-once",
    title: "Both GMs press the same thing at the same moment",
    roles: ["gm1", "gm2", "p1"],
    writes: true,
    triage: ["E-GM-01", "DAY-03", "DAY-06"]
};

const DIFFICULTY = { titleKey: "DRPG.Action.dynamicTitle" };
const GM_GO = { title: "", press: ["go", "end", "yes"] };
const PLAYER_DONE = { title: "", press: ["done"] };
const TIMES = ["morning", "noon", "afternoon", "evening", "night"];

export async function run(ctx) {
    const { check, note, settle } = ctx;
    let tab = null, before = null;
    const actorOf = role => tab?.me?.[role]?.character ?? null;
    const cards = [];

    /* ------------------------------------------------------------------ 0 */
    ctx.phase("0 the table");
    tab = await readTable(ctx, meta.roles);
    note("the table as read", J(tab));
    check("0.1: every page reads one primary GM, and it is one of this run's two GMs", tab.agree && tab.prim && tab.sec, J({ prim: tab.prim, sec: tab.sec, primId: tab.primId }));
    if (!tab.prim || !tab.sec) throw new Error("no primary and second GM among the roles");
    const { prim, sec } = tab;
    const gms = [prim, sec];
    const idOf = role => tab.me[role].id, nameOf = role => tab.me[role].name;
    const roleOfId = id => meta.roles.find(r => tab.me[r].id === id) ?? null;
    const T = { difficulty: await words(ctx, sec, DIFFICULTY.titleKey) };
    const characters = await inPage(ctx, prim, `return ["P1", "P2", "P3", "P4"].map(n => game.users.getName(n)?.character?.id ?? game.actors.getName(n)?.id ?? null).filter(Boolean);`);
    before = await prepare(ctx, prim, characters);
    note("preconditions", J(before));
    check("0.2: the active scene has rooms, P1's character a token in a room, and the game runs",
        !before.err && before.rooms?.length > 0 && actorOf("p1") && before.roomOf?.[actorOf("p1")] && before.unpaused, J(before));

    const cardOn = (role, tag, action = null, timeout = 30_000) => poll(() => call(ctx, role, "findCard", tag, { with: action }), v => v?.id, { timeout });
    const jobOn = (role, name, timeout = 60_000) => poll(() => call(ctx, role, "job", name), v => v?.done, { timeout });
    const clockOn = role => inPage(ctx, role, `const c = game.drpg.getClock();
        return { chapter: c.chapter, session: c.session, day: c.day, timeOfDay: c.timeOfDay, phase: c.phase, eclipse: game.drpg.isEclipse() };`);
    /** Both GMs run `body` (page code, `fk` in scope) at one moment `at`; answers each GM's value. */
    const atOnce = async body => {
        const at = Date.now() + 2000;
        const wrapped = `const at = ${J(at)}; while (Date.now() < at) await new Promise(r => setTimeout(r, 2)); const left = Date.now(); ${body}`;
        const [a, b] = await Promise.all(gms.map(gm => inPage(ctx, gm, wrapped).catch(err => ({ threw: String(err.message) }))));
        return { [prim]: a, [sec]: b, at };
    };
    const ask = async (kind, tag) => inPage(ctx, "p1", `
        const B = await fk.imp("bridge-asks.mjs"), M = await fk.imp("movement.mjs"), a = game.actors.get(${J(actorOf("p1"))});
        fk.track(${J(tag)}, ${J(kind)} === "hope"
            ? B.requestHopeCallApproval({ actorId: a.id, actorName: a.name, key: "experience", callLabel: "Experience", effect: "", cost: 1, note: ${J(tag)}, nonce: foundry.utils.randomID() })
            : B.requestDynamicDifficulty({ description: ${J(tag)}, actorName: a.name, actorId: a.id, room: M.roomOfActor(a), proposed: null }));
        return true;`);
    /** Writes of the clock this page heard since `t0`: how many moved the time of day, and how many ended an Eclipse, and by whom. */
    const clockWrites = async (role, t0, from) => {
        const writes = (await call(ctx, role, "since", t0)).writes.filter(w => w.key === "clock" && w.value);
        let tod = from.timeOfDay, ecl = from.eclipse, moves = 0;
        const ends = [];
        for (const w of writes) {
            if (w.value.timeOfDay !== tod) { moves++; tod = w.value.timeOfDay; }
            if (ecl && !w.value.eclipse) ends.push(w.userId);
            ecl = w.value.eclipse;
        }
        return { moves, ends, n: writes.length };
    };

    /* ------------------------------------------------------------------ A */
    await step(ctx, "A one card ruled by both GMs at once", ["E-GM-01"], async () => {
        for (const [kind, press, fills] of [["dynamic", "refuseDynamic", null], ["dynamic", "setDifficulty", { [prim]: "0", [sec]: "2" }], ["hope", "approveCall", null]]) {
            const tag = runTag(`S4A-${press}`);
            for (const gm of gms) await call(ctx, gm, "setRules", fills ? [{ ...DIFFICULTY, fill: { 'select[name="tier"]': fills[gm] }, press: ["ok"] }] : []);
            await ask(kind, tag);
            const card = await cardOn(prim, tag, press);
            await cardOn(sec, tag, press);
            if (!card?.id) { check(`A (${press}): the request's card reached both GMs`, false, tag); continue; }
            cards.push(card.id);
            const t0 = Date.now();
            const pressed = await atOnce(`return { road: await fk.press(${J(card.id)}, ${J(press)}), left };`);
            const got = await jobOn("p1", tag, kind === "hope" ? 90_000 : 60_000);
            const ends = {};
            for (const gm of gms) ends[gm] = await poll(() => call(ctx, gm, "card", card.id), v => v?.settled, { timeout: 20_000 });
            const onPlayer = await call(ctx, "p1", "card", card.id);
            const saw = {}, drew = {};
            for (const gm of gms) {
                const s = await call(ctx, gm, "since", t0);
                saw[gm] = s.seen.map(n => n.text);
                drew[gm] = s.dialogs.filter(d => d.title.includes(T.difficulty)).length;
                await call(ctx, gm, "setRules", []);
            }
            const by = roleOfId(ends[prim]?.row?.by ?? null);
            const loser = by === prim ? sec : by === sec ? prim : null;
            const line = ends[prim]?.text ?? "";
            const expected = kind === "hope" ? true : press === "refuseDynamic" ? false : null;
            const answerFits = expected !== null ? got?.value?.value === expected
                : got?.value?.value?.tier === Number(fills?.[by] ?? NaN);
            check(`A (${press}): two GMs' presses at one moment rule the card once: one GM's ruling, the same line on both GMs, and the player's answer is that ruling`,
                Boolean(by) && ends[prim]?.settled && ends[sec]?.settled && ends[prim].text === ends[sec].text
                    && line.includes(nameOf(by)) && !line.includes(nameOf(loser)) && got?.value?.ok === true && answerFits
                    && (!fills || (drew[by] === 1 && drew[loser] === 0)),
                J({ pressed, got, by, line, rows: { prim: ends[prim]?.row, sec: ends[sec]?.row }, drew, onPlayer: { settled: onPlayer?.settled ?? null, gone: onPlayer?.gone ?? null } }), { ids: ["E-GM-01"] });
            const alreadyWords = [await words(ctx, loser ?? sec, "DRPG.Bridge.alreadyRuled", { gm: nameOf(by ?? prim) }),
                await words(ctx, loser ?? sec, "DRPG.Bridge.claimBusy", { gm: nameOf(by ?? prim) }), await words(ctx, loser ?? sec, "DRPG.Bridge.alreadySettled")];
            note(`A (${press}): what the GM whose press lost was told`, J({ loser, told: saw[loser] ?? null, named: alreadyWords.filter(w => (saw[loser] ?? []).some(t => t.includes(w))) }));
        }
    });

    /* ------------------------------------------------------------------ B */
    await step(ctx, "B Next time of day pressed by both GMs at once", ["E-GM-01"], async () => {
        const from = await clockOn(prim);
        if (from.eclipse) throw new Error("an Eclipse runs; Next time of day is refused during one");
        for (const gm of gms) await call(ctx, gm, "setRules", [GM_GO]);
        await call(ctx, "p1", "setRules", [PLAYER_DONE]);
        const t0 = Date.now();
        const pressed = await atOnce(`const Bd = await fk.imp("boundary.mjs"); fk.track("next", Bd.nextTimeOfDay()); return { left };`);
        const jobs = {};
        for (const gm of gms) jobs[gm] = await jobOn(gm, "next", 150_000);
        await settle(3000);
        const want = from.timeOfDay === TIMES[TIMES.length - 1] ? TIMES[0] : TIMES[TIMES.indexOf(from.timeOfDay) + 1];
        const read = {}, wrote = {}, round = {};
        for (const role of meta.roles) {
            read[role] = await clockOn(role);
            wrote[role] = await clockWrites(role, t0, from);
            round[role] = await inPage(ctx, role, `const Bd = await fk.imp("boundary.mjs"); return Bd.roundOf(Bd.readyRecord(), game.drpg.getClock())?.id ?? null;`);
        }
        for (const role of meta.roles) await call(ctx, role, "setRules", []);
        check("B1: Next time of day pressed by both GMs at one moment moves the clock one time of day, written once, and every page reads that clock",
            meta.roles.every(r => read[r].timeOfDay === want && J(read[r]) === J(read[prim]) && wrote[r].moves === 1),
            J({ from, want, pressed, jobs, read, wrote }), { ids: ["E-GM-01"] });
        check("B2: no readiness round is left open on any page after the double press", meta.roles.every(r => round[r] === null), J(round), { ids: ["E-GM-01"] });
    });

    /* ------------------------------------------------------------------ C */
    await step(ctx, "C End the Eclipse pressed by both GMs at once", ["DAY-03", "DAY-06"], async () => {
        const started = await inPage(ctx, prim, `return Boolean(await game.drpg.startEclipse());`);
        const on = {};
        for (const role of meta.roles) on[role] = await poll(() => clockOn(role), v => v?.eclipse === true, { timeout: 30_000 });
        if (!meta.roles.every(r => on[r]?.eclipse)) throw new Error(`no Eclipse on every page (startEclipse answered ${started})`);
        const from = on[prim];
        for (const gm of gms) await call(ctx, gm, "setRules", [GM_GO]);
        await call(ctx, "p1", "setRules", [PLAYER_DONE]);
        const t0 = Date.now();
        const pressed = await atOnce(`const Bd = await fk.imp("boundary.mjs"); fk.track("end", Bd.toggleEclipse()); return { left };`);
        const jobs = {};
        for (const gm of gms) jobs[gm] = await jobOn(gm, "end", 150_000);
        const read = {}, wrote = {};
        for (const role of meta.roles) {
            read[role] = await poll(() => clockOn(role), v => v?.eclipse === false, { timeout: 30_000 });
            wrote[role] = await clockWrites(role, t0, from);
        }
        const saw = {};
        for (const gm of gms) saw[gm] = (await call(ctx, gm, "since", t0)).seen.map(n => n.text);
        for (const role of meta.roles) await call(ctx, role, "setRules", []);
        const generic = await words(ctx, sec, "DRPG.Bridge.why.cannotNow");
        check("C1: End the Eclipse pressed by both GMs at one moment ends it once: no Eclipse on any page, one end written, the same clock everywhere, and neither GM refused with the generic words",
            meta.roles.every(r => read[r]?.eclipse === false && J(read[r]) === J(read[prim]) && wrote[r].ends.length === 1)
                && !gms.some(gm => saw[gm].some(t => t.includes(generic))),
            J({ from, pressed, jobs, read, wrote, saw }), { ids: ["DAY-06"] });
        const writer = wrote[prim].ends[0] ?? null;
        check("C2: the Eclipse's end is carried out by the primary GM's browser, which holds the register of legal positions the end judges by (a proxy, see the header)",
            writer === idOf(prim), J({ writer, writerRole: roleOfId(writer), prim: idOf(prim) }), { ids: ["DAY-03"] });

        /* DAY-06 proper: a round of one kind open on the primary, the Eclipse pressed on the second GM. */
        await call(ctx, prim, "setRules", [{ title: "", hold: true }]);
        await call(ctx, "p1", "setRules", [{ title: "", hold: true }]);
        const t1 = Date.now();
        await inPage(ctx, prim, `const Bd = await fk.imp("boundary.mjs"); fk.track("held", Bd.nextTimeOfDay()); return true;`);
        const open = await poll(() => inPage(ctx, sec, `const Bd = await fk.imp("boundary.mjs"); return Bd.roundOf(Bd.readyRecord(), game.drpg.getClock())?.kind ?? null;`),
            v => v === "next", { timeout: 30_000 });
        await call(ctx, sec, "setRules", [{ title: "", text: "", press: ["yes"], once: true }, { title: "", hold: true }]);
        const t2 = Date.now();
        await inPage(ctx, sec, `const Bd = await fk.imp("boundary.mjs"); fk.track("eclipse", Bd.toggleEclipse()); return true;`);
        const secJob = await jobOn(sec, "eclipse", 30_000);
        await settle(2000);
        const secSaw = await call(ctx, sec, "since", t2);
        const joined = secSaw.dialogs.some(d => d.actions?.some(a => ["go", "end", "endOnly", "notNow"].includes(a)) && d.acted === "hold");
        const named = secSaw.seen.some(n => n.text.includes(nameOf(prim)));
        const onlyGeneric = secSaw.seen.some(n => n.text.includes(generic)) && !named;
        check("C3: a GM pressing the Eclipse while the other GM's Next time of day round is open is told whose round it is or shown it, not only that it cannot be done now",
            open === "next" && (named || joined) && !onlyGeneric,
            J({ open, secJob, notices: secSaw.seen.map(n => n.text), windows: secSaw.dialogs.map(d => ({ title: d.title, actions: d.actions, acted: d.acted })) }), { ids: ["DAY-06"] });
        for (const role of meta.roles) { await call(ctx, role, "setRules", []); await call(ctx, role, "act", {}, { close: true }); }
        await jobOn(prim, "held", 30_000);
        note("C3: the held round closed (Not now on its window)", J(await call(ctx, prim, "since", t1).then(s => s.dialogs.map(d => `${d.title} -> ${d.acted}`))));
    });

    /* ------------------------------------------------------------------ D */
    await step(ctx, "D the same Truth Bullet given by both GMs at once", ["E-GM-01"], async () => {
        const tag = runTag("S4D-bullet");
        const room = before.roomOf[actorOf("p1")] ?? before.rooms[0];
        const placed = await inPage(ctx, prim, `
            const R = await fk.imp("remnants.mjs"), Rooms = await fk.imp("rooms.mjs"), M = await fk.imp("movement.mjs");
            const scene = game.scenes.active, room = ${J(room)};
            const box = M.boundsOf(Rooms.roomRegions(scene, room)[0]);
            if (!box) return { err: "no bounds for " + room };
            const t = await R.placeRemnant({ type: "prep", visibility: "evident", scene, x: Math.round(box.x + box.w / 3), y: Math.round(box.y + box.h / 3), room, note: ${J(tag)} });
            return t ? { token: t.id, scene: scene.id, room } : { err: "no Remnant placed" };`);
        if (placed?.err) throw new Error(placed.err);
        await settle(3000);
        const payload = { name: tag, remnantId: placed.token, sceneId: placed.scene, room: placed.room, realType: "neutral", visibility: "evident", playerText: "S4 D" };
        const given = await atOnce(`const B = await fk.imp("bridge-asks.mjs");
            const res = await B.requestGiveBullet(game.actors.get(${J(actorOf("p1"))}), ${J(payload)});
            return { ok: res.ok, value: res.value ?? null, left };`);
        await settle(5000);
        const COUNT = `const a = game.actors.get(${J(actorOf("p1"))}); return a ? a.items.filter(i => i.name === ${J(tag)}).map(i => i.id) : null;`;
        const copies = {};
        for (const role of meta.roles) copies[role] = await poll(() => inPage(ctx, role, COUNT), v => Array.isArray(v) && v.length > 0, { timeout: 20_000 });
        await settle(3000);
        for (const role of meta.roles) copies[role] = await inPage(ctx, role, COUNT);
        const made = [given[prim]?.value?.given, given[sec]?.value?.given];
        check("D1: the same trace's Truth Bullet given to one student by both GMs at one moment makes one copy, on every page",
            meta.roles.every(r => copies[r]?.length === 1), J({ given, copies }), { ids: ["E-GM-01"] });
        check("D2: of the two gives, one made the copy and the other was answered that the student holds it already",
            made.filter(m => m === "bullet").length === 1 && made.filter(m => m === "already").length === 1, J(given), { ids: ["E-GM-01"] });
        const cleaned = await inPage(ctx, prim, `const a = game.actors.get(${J(actorOf("p1"))}), R = await fk.imp("remnants.mjs");
            const ids = a ? a.items.filter(i => i.name === ${J(tag)}).map(i => i.id) : [];
            if (ids.length) await a.deleteEmbeddedDocuments("Item", ids);
            const t = game.scenes.get(${J(placed.scene)})?.tokens.get(${J(placed.token)});
            if (t) { await R.dropRemnantSecret(t); await t.delete(); }
            return { items: ids.length, remnant: Boolean(t) };`);
        note("D the bullets and the Remnant deleted", J(cleaned));
    });

    /* ------------------------------------------------------------------ E */
    await step(ctx, "E one state on every page", ["E-GM-01"], async () => {
        await settle(3000);
        const read = {};
        for (const role of meta.roles) {
            read[role] = await inPage(ctx, role, `const c = game.drpg.getClock(), Bd = await fk.imp("boundary.mjs");
                let incident = null; try { incident = Boolean(game.drpg.murderState()?.active); } catch { incident = "unread"; }
                return { clock: { chapter: c.chapter, session: c.session, day: c.day, timeOfDay: c.timeOfDay, phase: c.phase }, eclipse: game.drpg.isEclipse(),
                    incident, round: Bd.roundOf(Bd.readyRecord(), c)?.id ?? null };`);
        }
        const settledCards = {};
        for (const gm of gms) settledCards[gm] = await Promise.all(cards.map(id => call(ctx, gm, "card", id).then(c => Boolean(c?.settled))));
        check("E1: after the double presses every page holds one state: the same clock, no Eclipse, no incident, no round open, and every card of this run answered on both GMs",
            meta.roles.every(r => J(read[r].clock) === J(read[prim].clock) && read[r].eclipse === false && read[r].incident === false && read[r].round === null)
                && gms.every(gm => settledCards[gm].every(Boolean)),
            J({ read, settledCards }), { ids: ["E-GM-01"] });
    });

    /* ------------------------------------------------------------------ Z */
    ctx.phase("Z put back");
    for (const role of Object.keys(ctx.c)) {
        await call(ctx, role, "setRules", []).catch(() => 0);
        await call(ctx, role, "closeWindows").catch(() => 0);
    }
    note("the clock and the pause put back", J(await restore(ctx, prim, before)));
}
