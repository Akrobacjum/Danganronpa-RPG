/**
 * S3: disconnects - a player offline, a player's reload, the primary's reload, a GM leaving for good (the road to 2.0,
 * F3; 24.11.2026).
 * ---------------------------------------------------------------------------
 *     DRPG_FORGE_URL=... DRPG_FORGE_WORLD=DRPG-QA-Forge node audit/forge/run.mjs s3-disconnects
 *
 * GM1, GM2, P1, P2 and P3 log in; `prim` and `sec` are the two GM roles as the pages read them (utils.mjs
 * `primaryGmId`), never assumed. For each disconnect the scenario asks the F1 files' section C questions (F1-calls.md
 * CF-*, F1-infra.md C*, F1-daily.md DAY-F*): does the side that waits see something sensible, does anything stay stuck,
 * can a GM get out. Written 24.11.2026 and NOT YET RUN on Forge; on 1.2.129 the checks of a known defect fail.
 *
 * Phases, in order:
 *   0  the table: roles, the primary on every page, tokens for P1-P4's characters (made where absent), the game unpaused.
 *   A  P1 asks a Dynamic action's difficulty (bridge-asks.mjs `requestDynamicDifficulty`), and P1's browser goes offline
 *      for 20 s (ctx.offline); back, the primary rules the card: the ruling reaches P1 and the card ends (CF-02, DAY-F01).
 *      In the first 6 s offline P1's page is read for the voice tile's word that the server is lost (FORGE-04).
 *   B  P3 asks a Hope Call's yes (`requestHopeCallApproval`) and reloads: the GMs' card says P3 no longer waits; the second
 *      GM's yes on the old card is told so; P3 asks again and is ruled; no stale waiting card on P3 (CALLS-04, CF-01).
 *   C  P1 asks a difficulty; the primary presses Set difficulty and leaves its window open, then reloads (ctx.reload): the
 *      second GM samples which GM it takes for the primary every 250 ms, and P2 asks a difficulty the moment the
 *      reloading GM is connected again; then the card the reloaded GM held is ruled (CALLS-02, PRIM-03, CF-07, C6, C9).
 *   E  the primary starts an Eclipse (eclipse.mjs `startEclipse`); the second GM presses the Eclipse's end (boundary.mjs
 *      `toggleEclipse`), which asks the players, and leaves (ctx.leave) with its window open: the players' window, the
 *      round and the Eclipse's end with the GM who stayed (DAY-F08, DAY-F11, C7). The second GM logs in again (ctx.rejoin).
 *   D  the primary starts an Eclipse; P2 has a difficulty open; the primary leaves for good (ctx.leave): the second GM
 *      takes over and is told (PRIM-02), its interface names it primary (PRIM-01), it rules P2's card (C6, C8), P1's
 *      crossing in the dark is judged (DAY-F05), the voice plan read (VOICE-05, a note); then, the only GM, it holds a
 *      ruling window open and reloads (CALLS-02 proper, CF-07), and ends the Eclipse.
 *   F  the old primary logs in again (ctx.rejoin): who is the primary 30 s later (PRIM-02).
 *   Z  the clock, the pause and the windows put back, by whichever GM is the primary then.
 *
 * WHAT IT WRITES to DRPG-QA-Forge: tokens for P1-P4's characters where the active scene has none (left for the next run);
 * request and ruling cards; two Eclipses started and ended (each refills the students' actions and moves the clock),
 * the clock put back at the end; P1's token moved once in the dark; one stuck card deleted where a claim holds it (D,
 * CALLS-02's only way out on 1.2.129); the readiness rounds' record. Chat cards and GM-store rows stay.
 *
 * UNMEASURED (each check that rests on one says so in its details):
 *   - Playwright's `setOffline` cuts Foundry's open websocket in Chromium (it emulates offline for the network stack; an
 *     open socket may survive it). A notes whether the GMs saw P1 leave at all; without that, A measures a short stall.
 *   - after a reload or a rejoin the kit is installed only once the page is ready, so a notice raised during the boot
 *     is not in `seen`; the popups standing are read instead (`popupsNow`).
 *   - PRIM-03's bound: 3 s with no GM that both is the primary and is listening. A choice of this scenario, not a
 *     decided number; the samples are in the details.
 *   - PRIM-02's 2.0 rule is read from the triage's recommendation (F1-infra.md: the role stays with the GM who took it
 *     over), which D2-07 accepted for packs 1 and 2; that 2.0 keeps it so is assumed, not read in code.
 *   - "the GM who takes over is told" is any notice on that GM's page within 20 s of the primary's leaving.
 *   - a player's token moved by a document update in the dark is a crossing the module judges (movement.mjs), as a drag is.
 *   - the readiness round's windows are found by being DialogV2s drawn after the press; their buttons by `data-action`
 *     (boundary.mjs `goButtons`: "end", "endOnly", "go"; the player's "done"; `confirmGo`'s "yes").
 */

import { call, run as inPage, J, wait, poll, step, readTable, prepare, restore, words, runTag, uiProbe, watchServerLost, serverLostShown } from "../page-kit.mjs";

export const meta = {
    id: "s3-disconnects",
    title: "Disconnects: what the waiting side sees, what stays stuck, how a GM gets out",
    roles: ["gm1", "gm2", "p1", "p2", "p3"],
    writes: true,
    triage: ["CALLS-02", "CALLS-04", "PRIM-01", "PRIM-02", "PRIM-03", "VOICE-05", "CF-01", "CF-02", "CF-07", "C6", "C8", "C9", "DAY-F01", "DAY-F05", "DAY-F08", "DAY-F11", "C7"]
};

const DIFFICULTY = { titleKey: "DRPG.Action.dynamicTitle" };
const SET_TIER = tier => ({ ...DIFFICULTY, fill: { 'select[name="tier"]': tier }, press: ["ok"] });
/* The GM's side of a round and of the Eclipse's end: the round window's end, a confirmation's yes, the placement table's end. */
const GM_ENDS = { title: "", press: ["end", "yes", "go"] };
const PLAYER_DONE = { title: "", press: ["done"] };

export async function run(ctx) {
    const { check, note, settle } = ctx;
    let tab = null, before = null;
    const actorOf = role => tab?.me?.[role]?.character ?? null;
    const here = () => Object.keys(ctx.c);

    /* ------------------------------------------------------------------ 0 */
    ctx.phase("0 the table");
    tab = await readTable(ctx, meta.roles);
    note("the table as read", J(tab));
    check("0.1: every page reads one primary GM, and it is one of this run's two GMs", tab.agree && tab.prim && tab.sec, J({ prim: tab.prim, sec: tab.sec, primId: tab.primId }));
    if (!tab.prim || !tab.sec) throw new Error("no primary and second GM among the roles");
    const { prim, sec } = tab;
    const idOf = role => tab.me[role].id, nameOf = role => tab.me[role].name;
    const T = { difficulty: await words(ctx, sec, DIFFICULTY.titleKey) };
    const characters = await inPage(ctx, prim, `return ["P1", "P2", "P3", "P4"].map(n => game.users.getName(n)?.character?.id ?? game.actors.getName(n)?.id ?? null).filter(Boolean);`);
    before = await prepare(ctx, prim, characters);
    note("preconditions", J(before));
    check("0.2: the active scene has rooms, each player's character a token in a room, and the game runs",
        !before.err && before.rooms?.length > 1 && ["p1", "p2", "p3"].every(p => actorOf(p) && before.roomOf?.[actorOf(p)]) && before.unpaused, J(before));

    const askDynamic = (player, tag) => inPage(ctx, player, `
        const B = await fk.imp("bridge-asks.mjs"), M = await fk.imp("movement.mjs"), a = game.actors.get(${J(actorOf(player))});
        fk.track(${J(tag)}, B.requestDynamicDifficulty({ description: ${J(tag)}, actorName: a.name, actorId: a.id, room: M.roomOfActor(a), proposed: null }));
        return true;`);
    const askHope = (player, tag) => inPage(ctx, player, `
        const B = await fk.imp("bridge-asks.mjs"), a = game.actors.get(${J(actorOf(player))});
        fk.track(${J(tag)}, B.requestHopeCallApproval({ actorId: a.id, actorName: a.name, key: "experience", callLabel: "Experience", effect: "",
            cost: 1, note: ${J(tag)}, nonce: foundry.utils.randomID() }));
        return true;`);
    const cardOn = (role, tag, action = null, timeout = 30_000) => poll(() => call(ctx, role, "findCard", tag, { with: action }), v => v?.id, { timeout });
    const jobOn = (role, name, timeout = 60_000) => poll(() => call(ctx, role, "job", name), v => v?.done, { timeout });
    const clockOn = role => inPage(ctx, role, `const c = game.drpg.getClock(); return { timeOfDay: c.timeOfDay, day: c.day, eclipse: game.drpg.isEclipse() };`);
    const ofRound = d => d.actions?.some(a => ["done", "wait", "end", "endOnly", "go", "notNow"].includes(a));

    /* ------------------------------------------------------------------ A */
    await step(ctx, "A a player offline for 20 s with a request open", ["CF-02", "DAY-F01"], async () => {
        const tag = runTag("S3A-offline");
        await askDynamic("p1", tag);
        const card = await cardOn(prim, tag, "setDifficulty");
        if (!card?.id) throw new Error("P1's request posted no card");
        const t0 = Date.now();
        const off = ctx.offline("p1", 20_000);
        /* FORGE-04 (2.0 line T4, 27.11.2026): P1's page read raw from the cut on, before Foundry's reload at about 6.5 s
           (page-kit.mjs `watchServerLost`), while the primary is polled below. */
        const lostWatch = watchServerLost(ctx.c.p1.page, { ms: 6000, every: 250 });
        const seenByGm = [];
        while (Date.now() - t0 < 21_000) {
            seenByGm.push(await inPage(ctx, prim, `return { at: Date.now(), active: Boolean(game.users.get(${J(idOf("p1"))})?.active) };`).catch(e => ({ err: e.message })));
            await wait(2000);
        }
        await off;
        const lost = await lostWatch;
        await settle(5000);
        /* The first run on the owner's PC (25.11.2026): about 6.5 s into the cut Foundry said "Server connection lost"
           and reloaded the page, which, offline, landed on chrome-error:// and stayed there when the network came back;
           every later phase then called a page with no game. P1's page is read raw here (the kit needs `ui`), and when
           it has left the game it is logged in again: A1 reads what reached P1 either way. */
        const p1Url = ctx.c.p1.page.url();
        const p1InGame = await ctx.c.p1.eval("return typeof game !== 'undefined' && game.ready === true;", { timeout: 10_000 }).catch(() => false);
        if (!p1InGame) {
            note("A P1's page left the game while offline (Foundry's reload after the lost connection); P1 logged in again", J({ url: p1Url }));
            await ctx.leave("p1");
            await ctx.rejoin("p1");
            await settle(5000);
        }
        const waiting = await call(ctx, "p1", "job", tag);
        const p1Saw = await call(ctx, "p1", "since", t0);
        note("A while P1 was offline: what the primary read of P1, and what P1's page showed", J({ seenByGm, p1Notices: p1Saw.seen.map(n => n.text), waiting }));
        await call(ctx, prim, "setRules", [SET_TIER("1")]);
        const road = await call(ctx, prim, "press", card.id, "setDifficulty");
        const got = await jobOn("p1", tag, 40_000);
        const ended = await poll(() => call(ctx, sec, "card", card.id), v => v?.settled, { timeout: 20_000 });
        const endedPrim = await call(ctx, prim, "card", card.id);
        await call(ctx, prim, "setRules", []);
        check("A1: a request open while its player was offline for 20 s is still ruled once they are back: the ruling reaches the player",
            got?.value?.ok === true && got.value.value?.tier === 1,
            J({ road, got, wentInactive: seenByGm.some(s => s?.active === false), p1PageLeftGame: !p1InGame, waitingAfter: waiting }), { ids: ["CF-02", "DAY-F01"] });
        check("A2: nothing stays stuck: the card reads answered on both GMs and holds no pending claim",
            ended?.settled && endedPrim?.settled && endedPrim.row?.pending !== true, J({ ended, endedPrim }), { ids: ["CF-02"] });
        /* The tile's attribute and words, or - with the world's voice tile off - one warning toast with those words
           (`serverLostShown`); `road` says which was seen, `left` when and where the page went. */
        check("FORGE-04: P1's voice tile says the server is lost before the page leaves the game",
            serverLostShown(lost), J({ road: lost.seen?.road ?? null, ...lost }), { ids: ["FORGE-04"] });
    });

    /* ------------------------------------------------------------------ B */
    await step(ctx, "B a player's reload mid-request", ["CALLS-04", "CF-01"], async () => {
        const tag = runTag("S3B-reload");
        await askHope("p3", tag);
        const card = await cardOn(prim, tag, "approveCall");
        if (!card?.id) throw new Error("P3's Call posted no card");
        await cardOn(sec, tag, "approveCall");
        const tR = Date.now();
        await ctx.reload("p3");
        const tBack = Date.now();
        const marked = await poll(async () => {
            const c = await call(ctx, prim, "card", card.id);
            return c?.settled || (c && !c.actions?.includes("approveCall")) ? c : null;
        }, Boolean, { timeout: 20_000 });
        const p3Corner = await call(ctx, "p3", "popupsNow");
        /* The words before a placeholder (`waitingGm` names its Call), long enough to mean the waiting card. */
        const waitingWords = [await words(ctx, "p3", "DRPG.Calls.waitingGm"), await words(ctx, "p3", "DRPG.Action.dynamicWaiting")]
            .map(w => String(w ?? "").split("{")[0].replace(/[:\s]+$/, "").trim()).filter(w => w.length > 5 && !w.startsWith("DRPG."));
        check("B1: once the player has reloaded, the GMs' card says the player no longer waits (within 20 s), instead of standing live",
            Boolean(marked), J({ reloadMs: tBack - tR, marked, card: await call(ctx, prim, "card", card.id) }), { ids: ["CALLS-04"] });

        const tYes = Date.now();
        const road = await call(ctx, sec, "press", card.id, "approveCall");
        const after = await poll(() => call(ctx, sec, "card", card.id), v => v?.settled, { timeout: 30_000 });
        const secSaw = await call(ctx, sec, "since", tYes);
        const gone = await words(ctx, sec, "DRPG.Bridge.settledGone");
        const notHeld = await words(ctx, sec, "DRPG.Bridge.askNotHeld");
        check("B2: the second GM's yes on the old card is told the player no longer waits (the card's line or a notice), not ruled into nothing",
            Boolean(after?.text?.includes(gone) || secSaw.seen.some(n => n.text.includes(notHeld))) || Boolean(marked?.settled),
            J({ road, after, notices: secSaw.seen.map(n => n.text) }), { ids: ["CALLS-04", "CF-01"] });

        const tag2 = runTag("S3B-again");
        await askHope("p3", tag2);
        const card2 = await cardOn(prim, tag2, "refuseCall");
        const road2 = card2?.id ? await call(ctx, prim, "press", card2.id, "refuseCall") : "no card";
        const got2 = await jobOn("p3", tag2, 60_000);
        check("B3: the reloaded player can ask again at once, and the new request is ruled",
            got2?.value?.ok === true && got2.value.value === false, J({ road2, got2 }), { ids: ["CF-01"] });
        check("B4: the reloaded player's page shows no card still saying it waits for the GM",
            !p3Corner.some(c => waitingWords.some(w => c.text.includes(w))), J({ p3Corner, waitingWords }), { ids: ["CALLS-04"] });
    });

    /* ------------------------------------------------------------------ C */
    await step(ctx, "C the primary reloads with a ruling window open", ["CALLS-02", "PRIM-03", "CF-07", "C6", "C9"], async () => {
        const tag = runTag("S3C-held");
        await call(ctx, prim, "setRules", [{ ...DIFFICULTY, hold: true }]);
        await askDynamic("p1", tag);
        const tAsk = Date.now();
        const card = await cardOn(prim, tag, "setDifficulty");
        if (!card?.id) throw new Error("P1's request posted no card");
        await call(ctx, prim, "press", card.id, "setDifficulty");
        const held = await poll(() => call(ctx, prim, "card", card.id), v => v?.row?.pending === true, { timeout: 20_000 });
        await call(ctx, sec, "sampleOn", 250);
        const tR = Date.now();
        const reloading = ctx.reload(prim);
        const back = await poll(async () => (await call(ctx, sec, "since", tR)).conn.filter(x => x.userId === idOf(prim) && x.active)[0] ?? null,
            Boolean, { timeout: 180_000, every: 250 });
        const probe = runTag("S3C-probe");
        if (back) await askDynamic("p2", probe);
        await reloading;
        const tReady = Date.now();
        const samples = await call(ctx, sec, "sampleOff");
        const tConn = back?.at ?? null;
        const orphan = tConn ? samples.filter(s => s.at >= tConn && s.at < tReady && s.primary === idOf(prim)) : [];
        const orphanMs = orphan.length ? Math.min(tReady, orphan[orphan.length - 1].at + 250) - orphan[0].at : 0;
        const probeCard = await cardOn(sec, probe, "setDifficulty", 60_000);
        check("C1: while the reloading primary is connected but not yet listening, another GM still answers for the table (no more than 3 s with nobody)",
            Boolean(tConn) && orphanMs <= 3000,
            J({ reloadMs: tReady - tR, connectedAfterMs: tConn ? tConn - tR : null, orphanMs, samples: samples.filter(s => s.at >= tR - 1000).slice(0, 80),
                probe: { card: probeCard?.id ?? null, cardAt: probeCard?.at ?? null, sinceReadyMs: probeCard?.at ? probeCard.at - tReady : null } }), { ids: ["PRIM-03", "C9"] });

        const left = 180_000 - (Date.now() - tAsk);
        const stillAsked = !(await call(ctx, "p1", "job", tag))?.done;
        await call(ctx, prim, "setRules", [SET_TIER("1")]);
        const tPress = Date.now();
        const road = await call(ctx, prim, "press", card.id, "setDifficulty");
        await wait(5000);
        const primSaw = await call(ctx, prim, "since", tPress);
        const opened = primSaw.dialogs.some(d => d.title.includes(T.difficulty));
        const got = stillAsked ? await jobOn("p1", tag, 30_000) : await call(ctx, "p1", "job", tag);
        const endCard = await poll(() => call(ctx, prim, "card", card.id), v => v?.settled, { timeout: 30_000 });
        await call(ctx, prim, "setRules", []);
        check("C2: the card the primary held when it reloaded is not held by it after: its press opens the ruling window and the card ends",
            opened && Boolean(endCard?.settled) && (!stillAsked || got?.value?.ok === true),
            J({ held: held?.row ?? null, msLeftOfPlayersClock: left, stillAsked, road, opened, notices: primSaw.seen.map(n => n.text), got, endCard }), { ids: ["CALLS-02", "CF-07"] });
        if (probeCard?.id) {
            await call(ctx, sec, "press", probeCard.id, "refuseDynamic");
            const gotProbe = await jobOn("p2", probe, 30_000);
            check("C3: a request asked the moment the reloading primary reconnected is answered (sent again or held), not lost",
                gotProbe?.value?.ok === true, J({ gotProbe }), { ids: ["C6"] });
        } else {
            check("C3: a request asked the moment the reloading primary reconnected is answered (sent again or held), not lost",
                false, J({ asked: Boolean(back), probe: await call(ctx, "p2", "job", probe) }), { ids: ["C6"] });
        }
    });

    /* ------------------------------------------------------------------ E */
    await step(ctx, "E a GM leaving mid-Eclipse with the players asked", ["DAY-F08", "DAY-F11", "C7"], async () => {
        try { await leavingMidEclipse(); }
        finally {
            /* D needs both GMs: the second GM logs in again whatever E came to. */
            if (!ctx.c[sec]) await ctx.rejoin(sec);
            await settle(5000);
            tab = await readTable(ctx, meta.roles);
            note("E the second GM logged in again; the table as read", J({ prim: tab.prim, sec: tab.sec, agree: tab.agree }));
        }
    });
    async function leavingMidEclipse() {
        const started = await inPage(ctx, prim, `return Boolean(await game.drpg.startEclipse());`);
        const on = await poll(() => clockOn("p1"), v => v?.eclipse === true, { timeout: 30_000 });
        if (!on?.eclipse) throw new Error(`no Eclipse started (startEclipse answered ${started})`);
        for (const p of ["p1", "p2", "p3"]) await call(ctx, p, "setRules", []);
        await call(ctx, sec, "setRules", [{ title: "", hold: true }]);
        const t0 = Date.now();
        await inPage(ctx, sec, `const Bd = await fk.imp("boundary.mjs"); fk.track("end", Bd.toggleEclipse()); return true;`);
        const asked = await poll(async () => (await call(ctx, "p1", "since", t0)).dialogs.filter(ofRound), v => v?.length > 0, { timeout: 30_000 });
        const secWindow = await call(ctx, sec, "open", {});
        const tLeave = Date.now();
        await ctx.leave(sec);
        const closed = await poll(async () => (await call(ctx, "p1", "since", t0)).dialogs.filter(d => ofRound(d) && !d.closedAt), v => Array.isArray(v) && v.length === 0, { timeout: 30_000 });
        const p1Saw = await call(ctx, "p1", "since", tLeave);
        check("E1: the players asked by a GM who then left are not left with the question: their window closes within 30 s",
            asked?.length > 0 && Array.isArray(closed) && closed.length === 0,
            J({ asked: asked?.map(d => d.title), secWindow: secWindow.map(d => d.title), stillOpen: closed, p1Notices: p1Saw.seen.map(n => n.text) }), { ids: ["DAY-F08"] });
        await call(ctx, prim, "setRules", [GM_ENDS]);
        for (const p of ["p1", "p2", "p3"]) await call(ctx, p, "setRules", [PLAYER_DONE]);
        const tEnd = Date.now();
        await inPage(ctx, prim, `const Bd = await fk.imp("boundary.mjs"); fk.track("end", Bd.toggleEclipse()); return true;`);
        const off = {};
        for (const role of here()) off[role] = await poll(() => clockOn(role), v => v?.eclipse === false, { timeout: 90_000 });
        const primSaw = await call(ctx, prim, "since", tEnd);
        check("E2: the GM who stayed ends the Eclipse the other GM was ending: no Eclipse on any page within 90 s, the round the leaver opened cleared",
            Object.values(off).every(v => v?.eclipse === false),
            J({ off, primNotices: primSaw.seen.map(n => n.text), primWindows: primSaw.dialogs.map(d => `${d.title} -> ${d.acted}`), job: await call(ctx, prim, "job", "end") }), { ids: ["DAY-F08", "DAY-F11", "C7"] });
        for (const role of here()) await call(ctx, role, "setRules", []);
    }

    /* ------------------------------------------------------------------ D */
    let taker = sec, leaver = prim;
    await step(ctx, "D the primary leaves for good mid-Eclipse", ["PRIM-01", "PRIM-02", "VOICE-05", "C6", "C8", "DAY-F05", "CALLS-02", "CF-07"], async () => {
        leaver = tab.prim; taker = tab.sec;
        const started = await inPage(ctx, leaver, `return Boolean(await game.drpg.startEclipse());`);
        const on = await poll(() => clockOn("p1"), v => v?.eclipse === true, { timeout: 30_000 });
        note("D an Eclipse started by the primary before it leaves", J({ started, on }));
        const tag = runTag("S3D-open");
        await askDynamic("p2", tag);
        const card = await cardOn(taker, tag, "setDifficulty");
        const t0 = Date.now();
        await ctx.leave(leaver);
        const took = await poll(() => call(ctx, taker, "me"), v => v?.primary === idOf(taker), { timeout: 30_000, every: 500 });
        const tTake = Date.now();
        await settle(Math.max(0, 20_000 - (Date.now() - t0)));
        const told = await call(ctx, taker, "since", t0);
        /* Notices that say nothing of the take-over do not count. The second S3 run on the owner's PC (25.11.2026)
           passed D1 on Forge's "Access Unauthorized. Please enter your API key or sign in to The Forge." alone: the
           taker writing the case's server copy (FORGE-01), not a word about running the table. Also left out: the case
           planner's empty-copy line (FORGE-01) and avclient-livekit's toasts (FORGE-03); and since 2.0 line T4
           (27.11.2026) FORGE-01's own words, by stable pieces in both languages: the warning that this host refuses the
           case's copy (`DRPG.Case.copy.refused.host`: "does not let this browser save the case" / "nie pozwala tej
           przeglądarce zapisać kopii sprawy"), the empty planner's corner card ("The case planner is empty on this
           browser" / "Planer sprawy jest pusty w tej przeglądarce") and the card "Save the case to a file" / "Zapisz
           sprawę do pliku" - a GM who becomes the primary may be shown any of them, and none says it runs the table. */
        const unrelated = /access unauthorized|sign in to the forge|case planner is empty|livekit|does not let this browser save the case|nie pozwala tej przeglądarce zapisać kopii sprawy|planer sprawy jest pusty|save the case to a file|zapisz sprawę do pliku/i;
        const aboutTakeOver = told.seen.filter(n => !unrelated.test(n.text ?? ""));
        check("D1: the GM who takes over the table is told it now runs it, within 20 s of the primary's leaving",
            took?.primary === idOf(taker) && aboutTakeOver.length > 0, J({ tookAfterMs: tTake - t0, notices: aboutTakeOver, leftOut: told.seen.length - aboutTakeOver.length, all: told.seen }), { ids: ["PRIM-02"] });
        const probe = await uiProbe(ctx, taker, { primName: nameOf(taker), playerNames: ["p1", "p2", "p3"].map(nameOf) });
        check("D2: the GM who took over sees in its interface that it is now the primary GM", Boolean(probe?.primShown), J(probe), { ids: ["PRIM-01"] });
        try { note("D VOICE-05: the voice plan on the GM who took over, 5 s after", J(await inPage(ctx, taker, `try { return await game.drpg.voicePlan(); } catch (e) { return "voicePlan threw: " + e.message; }`))); }
        catch (err) { note("D VOICE-05: the voice plan could not be read", String(err.message)); }

        await call(ctx, taker, "setRules", [SET_TIER("1")]);
        const road = card?.id ? await call(ctx, taker, "press", card.id, "setDifficulty") : "no card";
        const got = await jobOn("p2", tag, 60_000);
        check("D3: a request open when the primary left is answered by the GM who took over",
            got?.value?.ok === true && got.value.value?.tier === 1, J({ road, got }), { ids: ["C6", "C8"] });
        await call(ctx, taker, "setRules", []);

        const cross = await inPage(ctx, taker, `const M = await fk.imp("movement.mjs"), scene = game.scenes.active, a = game.actors.get(${J(actorOf("p1"))});
            const t = scene.tokens.find(x => x.actorId === a.id), from = M.roomOfActor(a);
            const to = (M.neighbouringRooms(scene, from) ?? [])[0] ?? null;
            return { from, to, at: to && t ? M.positionIn(to, t) : null, token: t?.id ?? null };`);
        if (cross?.at && cross.token) {
            const tMove = Date.now();
            const moved = await inPage(ctx, "p1", `const t = game.scenes.active.tokens.get(${J(cross.token)});
                try { await t.update({ x: ${J(cross.at.x)}, y: ${J(cross.at.y)} }); return "asked"; } catch (e) { return "threw: " + e.message; }`);
            const where = await poll(() => inPage(ctx, taker, `const M = await fk.imp("movement.mjs"); return M.roomOfActor(game.actors.get(${J(actorOf("p1"))}));`),
                v => v === cross.to, { timeout: 20_000 });
            const p1Saw = await call(ctx, "p1", "since", tMove);
            check("D4: a student's crossing in the dark after the primary left is judged by the GM who took over: the token is in the room crossed into, or the player is told why not",
                where === cross.to || p1Saw.seen.length > 0, J({ cross, moved, where, p1Notices: p1Saw.seen.map(n => n.text) }), { ids: ["DAY-F05"] });
        } else note("D4 not run: no neighbouring room of P1's room to cross into", J(cross));

        const tagS = runTag("S3D-alone");
        await call(ctx, taker, "setRules", [{ ...DIFFICULTY, hold: true }]);
        await askDynamic("p3", tagS);
        const cardS = await cardOn(taker, tagS, "setDifficulty");
        if (!cardS?.id) throw new Error("P3's request posted no card");
        await call(ctx, taker, "press", cardS.id, "setDifficulty");
        const heldS = await poll(() => call(ctx, taker, "card", cardS.id), v => v?.row?.pending === true, { timeout: 20_000 });
        await ctx.reload(taker);
        await call(ctx, taker, "setRules", [SET_TIER("2")]);
        const tPress = Date.now();
        const roadS = await call(ctx, taker, "press", cardS.id, "setDifficulty");
        await wait(6000);
        const sawS = await call(ctx, taker, "since", tPress);
        const openedS = sawS.dialogs.some(d => d.title.includes(T.difficulty));
        const busySelf = await words(ctx, taker, "DRPG.Bridge.claimBusy", { gm: nameOf(taker) });
        const gotS = await jobOn("p3", tagS, 30_000);
        check("D5: the only GM, who reloaded with a ruling window open, can rule that card after: its press opens the window and is not refused in its own name",
            openedS && !sawS.seen.some(n => n.text.includes(busySelf)),
            J({ heldS: heldS?.row ?? null, roadS, openedS, notices: sawS.seen.map(n => n.text), gotS }), { ids: ["CALLS-02", "CF-07"] });
        const endS = await call(ctx, taker, "card", cardS.id);
        if (!endS?.settled && endS?.row?.pending) {
            const removed = await inPage(ctx, taker, `const m = game.messages.get(${J(cardS.id)}); if (m) await m.delete(); return Boolean(m);`);
            note("D the card held by the reloaded GM's own claim was deleted, the only way out on 1.2.129", J({ removed, endS }));
        }
        await call(ctx, taker, "setRules", [GM_ENDS]);
        for (const p of ["p1", "p2", "p3"]) await call(ctx, p, "setRules", [PLAYER_DONE]);
        await inPage(ctx, taker, `const Bd = await fk.imp("boundary.mjs"); fk.track("end", Bd.toggleEclipse()); return true;`);
        const off = {};
        for (const role of here()) off[role] = await poll(() => clockOn(role), v => v?.eclipse === false, { timeout: 90_000 });
        check("D6: the GM who stayed ends the Eclipse the departed primary opened: no Eclipse on any page within 90 s",
            Object.values(off).every(v => v?.eclipse === false), J({ off, windows: (await call(ctx, taker, "since", tPress)).dialogs.map(d => `${d.title} -> ${d.acted}`) }), { ids: ["C7", "DAY-F11"] });
        for (const role of here()) await call(ctx, role, "setRules", []);
        try { note("D VOICE-05: the voice plan on the GM who took over, at the phase's end", J(await inPage(ctx, taker, `try { return await game.drpg.voicePlan(); } catch (e) { return "voicePlan threw: " + e.message; }`))); }
        catch (err) { note("D VOICE-05: the voice plan could not be read", String(err.message)); }
    });

    /* ------------------------------------------------------------------ F */
    await step(ctx, "F the old primary comes back", ["PRIM-02"], async () => {
        if (ctx.c[leaver]) { note("F: the old primary never left"); return; }
        await ctx.rejoin(leaver);
        await settle(30_000);
        const read = {};
        for (const role of here()) read[role] = (await call(ctx, role, "me")).primary;
        check("F1: the role stays with the GM who took it over: 30 s after the old primary logged in again, every page still reads that GM as the primary",
            Object.values(read).every(id => id === idOf(taker)), J({ taker: idOf(taker), leaver: idOf(leaver), read }), { ids: ["PRIM-02"] });
    });

    /* ------------------------------------------------------------------ Z */
    ctx.phase("Z put back");
    for (const role of here()) {
        await call(ctx, role, "setRules", []).catch(() => 0);
        await call(ctx, role, "closeWindows").catch(() => 0);
    }
    const nowPrim = here().find(r => tab.me[r]?.gm && ctx.c[r]) ?? null;
    let primNow = null;
    if (nowPrim) primNow = (await call(ctx, nowPrim, "me")).primary;
    const putter = here().find(r => tab.me[r]?.id === primNow) ?? nowPrim;
    note("the clock and the pause put back", J({ by: putter, back: putter ? await restore(ctx, putter, before) : null }));
}
