/**
 * S2: the second GM does every GM job a table needs, and gets what the primary gets (the road to 2.0, F3; 24.11.2026).
 * ---------------------------------------------------------------------------
 *     DRPG_FORGE_URL=... DRPG_FORGE_WORLD=DRPG-QA-Forge node audit/forge/run.mjs s2-second-gm
 *
 * GM1, GM2, P1 and P2 log in. Which GM is the primary is read on the pages (utils.mjs `primaryGmId`: the connected full
 * GM with the smallest id), never assumed; `prim` and `sec` below are the two roles as read. Written 24.11.2026 and NOT
 * YET RUN on Forge: every reading of the page is defensive, and what the code could not settle is marked UNMEASURED.
 * A check is the 2.0 behaviour (docs/dev/v2/DECISIONS.md and the triage); on 1.2.129 the checks of a known defect fail.
 *
 * Phases, in order:
 *   0  the table: roles, the primary on every page, tokens for P1-P4's characters (made where absent), the game unpaused.
 *   A  a player's request card ruled by each GM: a Dynamic action's difficulty (by prim, then by sec, same tier) and its
 *      refusal (sec); a Hope Call's yes (prim, then sec) and its refusal (sec). The requests are the bridge's own
 *      (bridge-asks.mjs `requestDynamicDifficulty`, `requestHopeCallApproval`) from the player's page, so no dice are
 *      thrown and nothing is spent; the press is the card's drawn button, else messenger-app.mjs `pressCard`.
 *   B  CALLS-01: prim presses Set difficulty and leaves its window open; sec presses the same card at once and again
 *      every 20 s for up to 150 s (under the player's own 180 s): sec takes it over, or the hold is let go, and sec's
 *      ruling reaches the player; then prim's window is closed and writes nothing.
 *   C  CALLS-03: every difficulty window sec drew shows the time left; then a real Dynamic action from P1's sheet road
 *      (`game.drpg.performAction(actor, "dynamic")`) left unanswered past TIMING.rulingMs, ruled late by sec: the late
 *      ruling reaches P1, or P1's next Dynamic window holds the words P1 wrote.
 *   D  INV-01, INV-02: prim's Observe naming window for P1's find (observe.mjs `describeFind`, as 97-two-gms R drives
 *      it) left open; sec is shown it (a card in sec's corner or the window itself); sec opens Write it here, prim
 *      answers first, and sec's window closes.
 *   E  Announce the body, pressed on sec (chapter.mjs `discoverBody`, no victim named), in a room of the scene.
 *   F  End the chapter, pressed on sec (chapter.mjs `applyChapterEnd`) with Next session alone ticked.
 *   G  TRIAL-02: sec presses Finish the chapter's end with none stopped; the reason the primary refuses for is shown to
 *      sec, who pressed.
 *   H  TRIAL-04 only to the offer: sec asks for the season's reset (season-wipe.mjs `resetSeason`); a window is offered on
 *      sec (2.0) or sec is refused (1.2.129). Every window drawn on either GM in this phase is closed by the kit 0.3 s
 *      after it is drawn, its buttons never pressed: the reset needs its word typed and is never run.
 *   I  DAY-01: the clock set to Night; sec writes the morning line (the client setting `morningLineDraft` on sec's
 *      browser, as Edit campaign keeps it), prim moves the clock to the next morning (clock.mjs `advanceTimeOfDay`, the
 *      call the panel's Next makes after its round): every page's clock carries sec's line.
 *   J  EXP-GM-01, PRIM-01: on each GM, with the GM panel and the Students window opened: who is connected is shown,
 *      and who the primary GM is.
 *   Z  the clock, the pause and the windows put back.
 *
 * WHAT IT WRITES to DRPG-QA-Forge: tokens for P1-P4's characters where the active scene has none (left there for the
 * next run); chat cards (requests, rulings, a body found, the chapter's end card, time-of-day cards); one Remnant placed
 * and deleted (D); the settings `bodyFound` and `bodiesFound`, put back to what they held (E), and the tokens the body's
 * gather moved, put back (E); the chapter's end record `chapterEnd` and the session counter, moved by one and put back
 * (F, Z); the clock moved to Night and to the next morning and put back (I, Z), which refills every student's actions;
 * P1's actions filled before C. GM stores the module writes on its own (the claim rows of the cards, the body's pending
 * row, the end's card) stay.
 *
 * UNMEASURED (the code could not settle these; a check that rests on one says so in its details):
 *   - that a ruling window "shows the time left" is read as a clock time, a count of seconds or minutes, or an element
 *     named for a countdown in the window (page-kit.mjs `timeShown`); 2.0 may show it otherwise.
 *   - CALLS-01's 2.0 shape: a take-over at the press, a take-over question (the kit presses yes/take/confirm on sec), or a
 *     hold let go after a time; 150 s is this scenario's bound, chosen under the player's 180 s, not a decided number.
 *   - CALLS-03's "the text survives": read as either the late ruling reaching P1 or P1's next Dynamic window prefilled.
 *   - INV-01's "sec is shown it": a `.drpg-popup` of the whisper's message, any card naming the find, or the window on sec.
 *   - EXP-GM-01: a connection shown is Foundry's players list visible with the players' names, or words or a marker of
 *     connection in the module's GM panel or Students window. PRIM-01: an element of a GM window whose own text names
 *     the primary GM beside "primary"/"główny". Both are heuristics over a UI 2.0 has not drawn yet.
 *   - the chat log's card buttons are found by `[data-message-id]`; where none is drawn the press is `pressCard`.
 *   - a body announced with no victim is a legal announcement (body.mjs `runDiscovery` names none and stamps the room).
 */

import { call, run as inPage, J, wait, poll, step, readTable, prepare, restore, words, noticeWith, runTag } from "../page-kit.mjs";

export const meta = {
    id: "s2-second-gm",
    title: "The second GM does every GM job and gets the primary's result",
    roles: ["gm1", "gm2", "p1", "p2"],
    writes: true,
    triage: ["E-GM-01", "CALLS-01", "CALLS-03", "INV-01", "INV-02", "TRIAL-02", "TRIAL-04", "DAY-01", "EXP-GM-01", "PRIM-01"]
};

const DIFFICULTY = { titleKey: "DRPG.Action.dynamicTitle" };
const DESCRIBE = { titleKey: "DRPG.Observe.describeTitle" };

export async function run(ctx) {
    const { check, note, settle } = ctx;
    let tab = null, before = null;
    const actorOf = role => tab?.me?.[role]?.character ?? null;

    /* ------------------------------------------------------------------ 0 */
    ctx.phase("0 the table");
    tab = await readTable(ctx, meta.roles);
    note("the table as read", J(tab));
    check("0.1: every page reads one primary GM, and it is one of this run's two GMs", tab.agree && tab.prim && tab.sec, J({ prim: tab.prim, sec: tab.sec, primId: tab.primId }));
    if (!tab.prim || !tab.sec) throw new Error("no primary and second GM among the roles: nothing below would mean what it says");
    const { prim, sec } = tab;
    const nameOf = role => tab.me[role].name;
    const T = { difficulty: await words(ctx, sec, DIFFICULTY.titleKey), describe: await words(ctx, sec, DESCRIBE.titleKey) };
    const players = ["p1", "p2"];
    const characters = await inPage(ctx, prim, `return ["P1", "P2", "P3", "P4"].map(n => game.users.getName(n)?.character?.id ?? game.actors.getName(n)?.id ?? null).filter(Boolean);`);
    before = await prepare(ctx, prim, characters);
    note("preconditions", J(before));
    check("0.2: the active scene has rooms, each player's character a token in a room, and the game runs",
        !before.err && before.rooms?.length > 1 && players.every(p => actorOf(p) && before.roomOf?.[actorOf(p)]) && before.unpaused, J(before));

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
    const jobOn = (role, name, timeout = 60_000) => poll(() => call(ctx, role, "job", name), v => v?.done, { timeout, every: 1000 });
    const other = role => (role === prim ? sec : prim);

    /** One request ruled by `ruler`: answers what the player got and what each GM's card says. */
    async function ruling(ruler, { kind, press, player, tier = "1" }) {
        const tag = runTag(`S2A-${kind}-${press}-${ruler}`);
        const t0 = Date.now();
        await call(ctx, ruler, "setRules", [{ ...DIFFICULTY, fill: { 'select[name="tier"]': tier }, read: ['select[name="tier"]'], press: ["ok"] }]);
        if (kind === "dynamic") await askDynamic(player, tag); else await askHope(player, tag);
        const onRuler = await cardOn(ruler, tag, press);
        const onOther = await cardOn(other(ruler), tag, press);
        const road = onRuler?.id ? await call(ctx, ruler, "press", onRuler.id, press) : "no card";
        const got = await jobOn(player, tag, kind === "hope" ? 90_000 : 60_000);
        const r = onRuler?.id ? await poll(() => call(ctx, ruler, "card", onRuler.id), v => v?.settled, { timeout: 20_000 }) : null;
        const o = onRuler?.id ? await poll(() => call(ctx, other(ruler), "card", onRuler.id), v => v?.settled, { timeout: 20_000 }) : null;
        const seen = await call(ctx, ruler, "since", t0);
        await call(ctx, ruler, "setRules", []);
        return { tag, road, cards: Boolean(onRuler?.id && onOther?.id), got, settledHere: Boolean(r?.settled), settledThere: Boolean(o?.settled),
            line: r?.text?.slice(-200) ?? null, row: r?.row ?? null,
            windows: seen.dialogs.map(d => ({ title: d.title, acted: d.acted, hasTime: d.hasTime, read: d.read })), notices: seen.seen.map(n => n.text) };
    }
    const secWindows = [];

    /* ------------------------------------------------------------------ A */
    await step(ctx, "A request cards ruled by each GM", ["E-GM-01"], async () => {
        const dynPrim = await ruling(prim, { kind: "dynamic", press: "setDifficulty", player: "p1" });
        const dynSec = await ruling(sec, { kind: "dynamic", press: "setDifficulty", player: "p1" });
        secWindows.push(...dynSec.windows);
        note("A1 a difficulty by the primary (the reading sec is held to)", J(dynPrim));
        const sameDifficulty = r => r.cards && r.got?.value?.ok === true && r.got.value.value?.tier === 1 && r.settledHere && r.settledThere;
        check("A1: a Dynamic action's difficulty set on the second GM reaches the player as the primary's does, and both GMs' cards read answered",
            sameDifficulty(dynSec) && sameDifficulty(dynPrim) && dynSec.got.value.value.trait === dynPrim.got.value.value.trait, J({ dynSec, prim: { got: dynPrim.got, road: dynPrim.road } }), { ids: ["E-GM-01"] });

        const refuse = await ruling(sec, { kind: "dynamic", press: "refuseDynamic", player: "p2" });
        check("A2: a Dynamic action refused on the second GM reaches the player as a refusal, and both GMs' cards read answered",
            refuse.cards && refuse.got?.value?.ok === true && refuse.got.value.value === false && refuse.settledHere && refuse.settledThere, J(refuse), { ids: ["E-GM-01"] });

        /* Different players for the two yeses: a yes is kept on the primary for its arm (60 s, bridge-guards.mjs CALL_YES_MS),
           and a second ask of the same character inside it is a case this phase is not about. */
        const yesPrim = await ruling(prim, { kind: "hope", press: "approveCall", player: "p2" });
        const yesSec = await ruling(sec, { kind: "hope", press: "approveCall", player: "p1" });
        note("A3 a Call's yes by the primary", J(yesPrim));
        const sameYes = r => r.cards && r.got?.value?.ok === true && r.got.value.value === true && r.settledHere && r.settledThere;
        check("A3: a Hope Call approved on the second GM reaches the player as a yes, as the primary's does, and both GMs' cards read answered (nothing armed, nothing paid)",
            sameYes(yesSec) && sameYes(yesPrim), J({ yesSec, prim: { got: yesPrim.got, road: yesPrim.road } }), { ids: ["E-GM-01"] });

        const noSec = await ruling(sec, { kind: "hope", press: "refuseCall", player: "p2" });
        check("A4: a Hope Call refused on the second GM reaches the player as a no, and both GMs' cards read answered",
            noSec.cards && noSec.got?.value?.ok === true && noSec.got.value.value === false && noSec.settledHere && noSec.settledThere, J(noSec), { ids: ["E-GM-01"] });
    });

    /* ------------------------------------------------------------------ B */
    await step(ctx, "B CALLS-01 a card held open by one GM", ["CALLS-01"], async () => {
        const tag = runTag("S2B-held");
        await call(ctx, prim, "setRules", [{ ...DIFFICULTY, hold: true }]);
        await call(ctx, sec, "setRules", [{ ...DIFFICULTY, fill: { 'select[name="tier"]': "2" }, press: ["ok"] },
            { title: "", press: ["yes", "take", "takeOver", "takeover", "confirm", "ok"] }]);
        const t0 = Date.now();
        await askDynamic("p1", tag);
        const card = await cardOn(prim, tag, "setDifficulty");
        await cardOn(sec, tag, "setDifficulty");
        if (!card?.id) throw new Error("the request's card did not reach the primary");
        const roadPrim = await call(ctx, prim, "press", card.id, "setDifficulty");
        const held = await poll(() => call(ctx, prim, "open", DIFFICULTY), v => v?.length > 0, { timeout: 20_000 });
        const rowHeld = await poll(() => call(ctx, prim, "card", card.id), v => v?.row?.pending === true, { timeout: 10_000 });
        const tHeld = Date.now();
        const presses = [];
        let took = null;
        while (!took && Date.now() - tHeld < 150_000) {
            const at = Date.now();
            const road = await call(ctx, sec, "press", card.id, "setDifficulty");
            await wait(5000);
            const seen = await call(ctx, sec, "since", at);
            const opened = seen.dialogs.find(d => d.at >= at && d.title.includes(T.difficulty));
            presses.push({ afterMs: at - tHeld, road, notices: seen.seen.map(n => n.text).slice(0, 3), windows: seen.dialogs.map(d => `${d.title} -> ${d.acted}`) });
            if (opened) { took = { afterMs: at - tHeld, acted: opened.acted }; break; }
            const state = await call(ctx, sec, "card", card.id);
            if (state?.settled) break;
            await wait(15_000);
        }
        const got = await jobOn("p1", tag, 40_000);
        const closed = await call(ctx, prim, "act", DIFFICULTY, { close: true });
        await settle(3000);
        const endPrim = await call(ctx, prim, "card", card.id), endSec = await call(ctx, sec, "card", card.id);
        await call(ctx, prim, "setRules", []);
        await call(ctx, sec, "setRules", []);
        const busy = await words(ctx, sec, "DRPG.Bridge.claimBusy", { gm: nameOf(prim) });
        note("B what the second GM was told at its first press", J({ first: presses[0], busyWords: busy, toldBusy: Boolean(presses[0]?.notices?.some(n => n.includes(busy))) }));
        check("B1: a card the primary holds open in its window can be ruled by the second GM - taken over at the press or let go within 150 s - and that ruling reaches the player",
            Boolean(took) && got?.value?.ok === true && got.value.value?.tier === 2,
            J({ roadPrim, held: held?.length ?? 0, rowHeld: rowHeld?.row ?? null, took, presses, got, sinceAskMs: tHeld - t0 }), { ids: ["CALLS-01"] });
        check("B2: the holder's window, closed after, rules nothing more: the card stays ruled once, by the second GM, on both GMs",
            Boolean(took) && endPrim?.settled && endSec?.settled && endPrim.row?.by === tab.me[sec].id,
            J({ closed, endPrim, endSec }), { ids: ["CALLS-01"] });
    });

    /* ------------------------------------------------------------------ C */
    await step(ctx, "C CALLS-03 the ruling window's clock and a late ruling", ["CALLS-03"], async () => {
        const drawn = secWindows.filter(w => w.title.includes(T.difficulty));
        check("C1: every difficulty window the second GM drew showed the time left to rule",
            drawn.length > 0 && drawn.every(w => w.hasTime), J(drawn), { ids: ["CALLS-03"] });

        const tag = runTag("S2C-late words P1 wrote");
        const limits = await inPage(ctx, sec, `const { TIMING } = await fk.imp("config.mjs"); return { rulingMs: TIMING.rulingMs, ackMs: TIMING.ackMs };`);
        await inPage(ctx, prim, `const a = game.actors.get(${J(actorOf("p1"))}); await game.drpg.setActions(a, game.drpg.actionsMax(a)); return game.drpg.actionsLeft(a);`);
        await call(ctx, "p1", "setRules", [{ titleKey: "DRPG.Action.dynamicLabel", fill: { 'textarea[name="request"]': tag }, press: ["send", "ok"], once: true }]);
        await inPage(ctx, "p1", `fk.track("late", game.drpg.performAction(game.actors.get(${J(actorOf("p1"))}), "dynamic")); return true;`);
        const card = await cardOn(sec, tag, "setDifficulty", 45_000);
        if (!card?.id) throw new Error("P1's Dynamic action posted no card the second GM could find");
        const timedOut = await jobOn("p1", "late", (limits?.rulingMs ?? 180_000) + 40_000);
        await call(ctx, sec, "setRules", [{ ...DIFFICULTY, fill: { 'select[name="tier"]': "0" }, press: ["ok"] }]);
        const tLate = Date.now();
        const road = await call(ctx, sec, "press", card.id, "setDifficulty");
        await settle(12_000);
        const secSaw = await call(ctx, sec, "since", tLate);
        const p1Saw = await call(ctx, "p1", "since", tLate);
        const late = await call(ctx, "p1", "job", "late");
        let prefill = null;
        if (!late?.value) {
            await call(ctx, "p1", "setRules", [{ titleKey: "DRPG.Action.dynamicLabel", read: ['textarea[name="request"]'], close: true, once: true }]);
            const tAgain = Date.now();
            await inPage(ctx, "p1", `fk.track("again", game.drpg.performAction(game.actors.get(${J(actorOf("p1"))}), "dynamic")); return true;`);
            const shown = await poll(async () => (await call(ctx, "p1", "since", tAgain)).dialogs.find(d => d.read && Object.keys(d.read).length), Boolean, { timeout: 20_000 });
            prefill = shown?.read?.['textarea[name="request"]'] ?? null;
        }
        await call(ctx, "p1", "closeWindows", { dialogsOnly: false }).catch(() => 0);
        await call(ctx, "p1", "setRules", []);
        await call(ctx, sec, "setRules", []);
        check("C2: a ruling given after the player's clock ran out is not lost: it reaches the player, or the player's next Dynamic window holds the words they wrote",
            Boolean(late?.value) || prefill === tag,
            J({ limits, timedOut, road, late, prefill, secNotices: secSaw.seen.map(n => n.text), p1Notices: p1Saw.seen.map(n => n.text) }), { ids: ["CALLS-03"] });
        await inPage(ctx, prim, `const a = game.actors.get(${J(actorOf("p1"))}); await game.drpg.setActions(a, game.drpg.actionsMax(a)); return true;`);
    });

    /* ------------------------------------------------------------------ D */
    await step(ctx, "D INV-01 INV-02 naming an Observe's find", ["INV-01", "INV-02"], async () => {
        const tag = runTag("S2D-find");
        const room = before.roomOf[actorOf("p1")] ?? before.rooms[0];
        await call(ctx, prim, "setRules", [{ ...DESCRIBE, hold: true }]);
        await call(ctx, sec, "setRules", [{ ...DESCRIBE, hold: true }]);
        const t0 = Date.now();
        const placed = await inPage(ctx, prim, `
            const R = await fk.imp("remnants.mjs"), Rooms = await fk.imp("rooms.mjs"), M = await fk.imp("movement.mjs"), OB = await fk.imp("observe.mjs");
            const scene = game.scenes.active, room = ${J(room)};
            const box = M.boundsOf(Rooms.roomRegions(scene, room)[0]);
            if (!box) return { err: "no bounds for " + room };
            const t = await R.placeRemnant({ type: "prep", visibility: "evident", scene, x: Math.round(box.x + box.w / 3), y: Math.round(box.y + box.h / 3), room, note: ${J(tag)} });
            if (!t) return { err: "no Remnant placed" };
            const entry = { sceneId: scene.id, tokenId: t.id, room, data: R.remnantData(R.remnantById(scene.id, t.id)) };
            fk.track(${J(tag)}, OB.describeFind(game.actors.get(${J(actorOf("p1"))}), entry, false, ${J(`${tag} fallback`)}, null, { waitMs: 150000 }));
            return { token: t.id, scene: scene.id, room };`);
        if (placed?.err) throw new Error(placed.err);
        const primWindow = await poll(() => call(ctx, prim, "open", DESCRIBE), v => v?.length > 0, { timeout: 20_000 });
        const whisper = await cardOn(sec, placed.token, null, 20_000);
        await settle(3000);
        const secSaw = await call(ctx, sec, "since", t0);
        const corner = await call(ctx, sec, "popupsNow");
        const p1Name = await inPage(ctx, prim, `return game.actors.get(${J(actorOf("p1"))})?.name ?? "";`);
        const shown = Boolean(whisper?.id && (corner.some(c => c.message === whisper.id) || secSaw.seen.some(n => n.message === whisper.id)))
            || secSaw.seen.some(n => n.kind === "popup" && n.text.includes(p1Name) && n.text.includes(room))
            || secSaw.dialogs.some(d => d.title.includes(T.describe));
        check("D1: the primary's naming window for a player's find is shown to the second GM: a card in its corner, or the window itself",
            primWindow?.length > 0 && shown, J({ placed, primWindow: primWindow?.length ?? 0, whisper: whisper?.id ?? null, corner, secSeen: secSaw.seen, secWindows: secSaw.dialogs }), { ids: ["INV-01"] });

        const road = whisper?.id ? await inPage(ctx, sec, `
            const id = ${J(whisper.id)};
            const drawn = [...document.querySelectorAll('[data-message-id="' + id + '"] [data-drpg-describe-find]')].find(b => !b.disabled);
            if (drawn) { drawn.click(); return "dom"; }
            const S = await fk.imp("secret.mjs"), OB = await fk.imp("observe.mjs"), m = game.messages.get(id);
            if (!m) return "no whisper";
            const box = document.createElement("div"); box.style.display = "none"; box.innerHTML = String(S.contentOf(m) ?? ""); document.body.append(box);
            OB.wireDescribeHere(box);
            const button = box.querySelector("[data-drpg-describe-find]");
            if (!button) return "no button";
            button.click();
            return "a wired copy";`) : "no whisper";
        const secWindow = await poll(() => call(ctx, sec, "open", DESCRIBE), v => v?.length > 0, { timeout: 20_000 });
        const tAnswer = Date.now();
        const answered = await call(ctx, prim, "act", DESCRIBE, { fill: { 'input[name="name"]': `${tag} named by the primary`, 'textarea[name="playerText"]': "S2 D words" }, press: ["ok"] });
        const words1 = await jobOn(prim, tag, 30_000);
        const secClosed = await poll(() => call(ctx, sec, "open", DESCRIBE), v => Array.isArray(v) && v.length === 0, { timeout: 15_000 });
        const secTold = await call(ctx, sec, "since", tAnswer);
        check("D2: the second GM's Write it here window closes once the primary has answered, and the second GM is told",
            secWindow?.length > 0 && Array.isArray(secClosed) && secClosed.length === 0 && secTold.seen.length > 0,
            J({ road, secWindow: secWindow?.length ?? 0, answered, words: words1, stillOpen: secClosed, told: secTold.seen }), { ids: ["INV-02"] });
        await call(ctx, sec, "act", DESCRIBE, { close: true });
        await call(ctx, prim, "act", DESCRIBE, { close: true });
        await call(ctx, prim, "setRules", []);
        await call(ctx, sec, "setRules", []);
        await inPage(ctx, prim, `const R = await fk.imp("remnants.mjs"); const t = game.scenes.get(${J(placed.scene)})?.tokens.get(${J(placed.token)});
            if (t) { await R.dropRemnantSecret(t); await t.delete(); } return true;`);
    });

    /* ------------------------------------------------------------------ E */
    await step(ctx, "E Announce the body, on the second GM", ["E-GM-01"], async () => {
        const room = before.rooms[1] ?? before.rooms[0];
        const kept = await inPage(ctx, prim, `return { bodyFound: game.settings.get("danganronpa-rpg", "bodyFound") ?? null, bodiesFound: game.settings.get("danganronpa-rpg", "bodiesFound") ?? null,
            tokens: game.scenes.active.tokens.map(t => [t.id, { x: t.x, y: t.y }]) };`);
        const t0 = Date.now(), tag = runTag("S2E-body");
        /* The discovery's Prep question (body.mjs `askPromotion`, not awaited) opens on the primary when the room holds a
           Faint trace: closed unanswered, which ticks none. */
        await call(ctx, prim, "setRules", [{ title: "", close: true, delay: 800 }]);
        await inPage(ctx, sec, `const C = await fk.imp("chapter.mjs"); fk.track(${J(tag)}, C.discoverBody({ room: ${J(room)}, scene: game.scenes.active })); return true;`);
        const done = await jobOn(sec, tag, 90_000);
        const held = {};
        for (const role of meta.roles) {
            held[role] = await poll(() => inPage(ctx, role, `return JSON.stringify(game.settings.get("danganronpa-rpg", "bodyFound") ?? null);`), v => String(v).includes(room), { timeout: 20_000 });
        }
        const secSaw = await call(ctx, sec, "since", t0);
        await call(ctx, prim, "setRules", []);
        const refusedWords = await words(ctx, sec, "DRPG.Chapter.bodyPrimaryOnly", { name: nameOf(prim) });
        check("E1: Announce the body pressed on the second GM announces it: the room is the found body's on every page, and the second GM is not refused",
            done?.value != null && meta.roles.every(r => String(held[r]).includes(room)) && !noticeWith(secSaw.seen, refusedWords),
            J({ room, done, held, notices: secSaw.seen.map(n => n.text) }), { ids: ["E-GM-01"] });
        const back = await inPage(ctx, prim, `const kept = ${J(kept)};
            await game.settings.set("danganronpa-rpg", "bodyFound", kept.bodyFound);
            await game.settings.set("danganronpa-rpg", "bodiesFound", kept.bodiesFound);
            const scene = game.scenes.active, moved = [];
            for (const [id, at] of kept.tokens) { const t = scene.tokens.get(id); if (t && (t.x !== at.x || t.y !== at.y)) { await t.update(at, { teleport: true, movementAction: "displace", animate: false }); moved.push(id); } }
            return { moved: moved.length };`, { timeout: 120_000 });
        note("E the body's settings and the gathered tokens put back", J(back));
    });

    /* ------------------------------------------------------------------ F */
    let s0 = null;
    await step(ctx, "F End the chapter, on the second GM", ["E-GM-01"], async () => {
        const standing = await inPage(ctx, prim, `const C = await fk.imp("chapter.mjs"); return C.chapterEndStopped() ? C.chapterEndStopped() : null;`);
        if (standing) { note("F skipped: an end of the chapter stands stopped in the world; finishing it here would run its steps", J(standing)); return; }
        s0 = await inPage(ctx, prim, `return game.drpg.getClock().session;`);
        const t0 = Date.now(), tag = runTag("S2F-end");
        await inPage(ctx, sec, `const C = await fk.imp("chapter.mjs"); fk.track(${J(tag)}, C.applyChapterEnd({ nextSession: true, opened: game.drpg.getClock() })); return true;`);
        const done = await jobOn(sec, tag, 120_000);
        const read = {};
        for (const role of meta.roles) {
            read[role] = await poll(() => inPage(ctx, role, `const r = game.settings.get("danganronpa-rpg", "chapterEnd") ?? {};
                return { stage: r.stage ?? null, by: r.by ?? null, ending: r.ending?.session ?? null, session: game.drpg.getClock().session };`),
            v => v?.session === s0 + 1, { timeout: 30_000 });
        }
        const secSaw = await call(ctx, sec, "since", t0);
        const refusedWords = await words(ctx, sec, "DRPG.Chapter.endPrimaryOnly", { name: nameOf(prim) });
        check("F1: End the chapter pressed on the second GM ends it: the end is recorded done, and every page reads the next session",
            done?.value != null && meta.roles.every(r => read[r]?.stage === "done" && read[r].ending === s0 && read[r].session === s0 + 1) && !noticeWith(secSaw.seen, refusedWords),
            J({ s0, done, read, notices: secSaw.seen.map(n => n.text) }), { ids: ["E-GM-01"] });
        await inPage(ctx, prim, `await game.drpg.setClock({ session: ${J(s0)} }); return game.drpg.getClock().session;`);
    });

    /* ------------------------------------------------------------------ G */
    await step(ctx, "G TRIAL-02 the reason reaches the GM who pressed", ["TRIAL-02"], async () => {
        const standing = await inPage(ctx, prim, `const C = await fk.imp("chapter.mjs"); return Boolean(C.chapterEndStopped());`);
        if (standing) { note("G skipped: an end stands stopped, so Finish would run it"); return; }
        const t0 = Date.now(), tag = runTag("S2G-finish");
        await inPage(ctx, sec, `const C = await fk.imp("chapter.mjs"); fk.track(${J(tag)}, C.finishChapterEnd()); return true;`);
        const done = await jobOn(sec, tag, 60_000);
        await settle(2000);
        const reason = await words(ctx, sec, "DRPG.Chapter.notStopped");
        const secSaw = await call(ctx, sec, "since", t0), primSaw = await call(ctx, prim, "since", t0);
        check("G1: the second GM's Finish the chapter's end, refused on the primary because none stands stopped, tells the second GM that reason",
            Boolean(noticeWith(secSaw.seen, reason)),
            J({ done, reason, sec: secSaw.seen.map(n => n.text), prim: primSaw.seen.map(n => n.text) }), { ids: ["TRIAL-02"] });
    });

    /* ------------------------------------------------------------------ H */
    await step(ctx, "H TRIAL-04 the season's reset offered to the second GM", ["TRIAL-04"], async () => {
        const closeAll = [{ title: "", close: true, delay: 300 }, { id: "season-reset", close: true, delay: 300 }];
        await call(ctx, sec, "setRules", closeAll);
        await call(ctx, prim, "setRules", closeAll);
        const t0 = Date.now(), tag = runTag("S2H-reset");
        const asked = await inPage(ctx, sec, `const W = await fk.imp("season-wipe.mjs");
            if (typeof W.resetSeason !== "function") return "no resetSeason";
            fk.track(${J(tag)}, W.resetSeason()); return "asked";`);
        const refusedWords = await words(ctx, sec, "DRPG.GmStore.resetPrimaryOnly", { name: nameOf(prim) });
        const seen = await poll(() => call(ctx, sec, "since", t0), v => v?.dialogs?.length > 0 || Boolean(noticeWith(v?.seen, refusedWords)), { timeout: 30_000 });
        await settle(2000);
        const onPrim = await call(ctx, prim, "since", t0);
        await call(ctx, sec, "act", {}, { close: true });
        await call(ctx, prim, "act", {}, { close: true });
        const done = await jobOn(sec, tag, 30_000);
        await call(ctx, sec, "setRules", []);
        await call(ctx, prim, "setRules", []);
        check("H1: the season's reset pressed on the second GM is offered to it (its window drawn there, closed unpressed by the kit), not refused",
            asked === "asked" && seen?.dialogs?.length > 0 && !noticeWith(seen.seen, refusedWords),
            J({ asked, secWindows: seen?.dialogs?.map(d => ({ id: d.id, title: d.title, acted: d.acted })), secNotices: seen?.seen?.map(n => n.text),
                primWindows: onPrim.dialogs.map(d => ({ id: d.id, title: d.title, acted: d.acted })), done }), { ids: ["TRIAL-04"] });
    });

    /* ------------------------------------------------------------------ I */
    await step(ctx, "I DAY-01 the morning line written on the second GM", ["DAY-01"], async () => {
        const line = runTag("S2I-morning line written on the second GM");
        const drafts = await inPage(ctx, prim, `const was = game.settings.get("danganronpa-rpg", "morningLineDraft") ?? "";
            await game.settings.set("danganronpa-rpg", "morningLineDraft", "");
            await game.drpg.setClock({ timeOfDay: "night" });
            return { primDraft: was, clock: game.drpg.getClock().timeOfDay };`);
        await inPage(ctx, sec, `await game.settings.set("danganronpa-rpg", "morningLineDraft", ${J(line)}); return true;`);
        await settle(1500);
        const tag = runTag("S2I-advance");
        await inPage(ctx, prim, `fk.track(${J(tag)}, game.drpg.advanceTimeOfDay({ resetActions: true })); return true;`);
        const done = await jobOn(prim, tag, 90_000);
        const read = {};
        for (const role of meta.roles) {
            read[role] = await poll(() => inPage(ctx, role, `const c = game.drpg.getClock(); return { timeOfDay: c.timeOfDay, day: c.day, morningLine: c.morningLine ?? null };`),
                v => v?.timeOfDay === "morning", { timeout: 30_000 });
        }
        const leftOnSec = await inPage(ctx, sec, `return game.settings.get("danganronpa-rpg", "morningLineDraft") ?? "";`);
        check("I1: the morning line the second GM wrote is the one the next morning shows on every page, when the primary moves the clock",
            meta.roles.every(r => read[r]?.timeOfDay === "morning" && String(read[r].morningLine ?? "").includes(line)),
            J({ drafts, done: done?.done ?? false, read, leftOnSec }), { ids: ["DAY-01"] });
        await inPage(ctx, sec, `await game.settings.set("danganronpa-rpg", "morningLineDraft", ""); return true;`);
        await inPage(ctx, prim, `await game.settings.set("danganronpa-rpg", "morningLineDraft", ${J(drafts.primDraft ?? "")}); return true;`);
        await restore(ctx, prim, { ...before, paused: false });
    });

    /* ------------------------------------------------------------------ J */
    await step(ctx, "J EXP-GM-01 PRIM-01 who is connected and who is primary, in a GM's interface", ["EXP-GM-01", "PRIM-01"], async () => {
        const playerNames = players.map(nameOf);
        const primName = nameOf(prim);
        for (const gm of [prim, sec]) {
            const ui1 = await inPage(ctx, gm, `
                const had = new Set([...foundry.applications.instances.keys()]);
                try { await Promise.race([Promise.resolve(game.drpg.gmPanel()), new Promise(r => setTimeout(r, 5000))]); } catch { /* read what opened */ }
                try { const G = await fk.imp("gm-students.mjs"); void G.openWhoIsAliveDialog(); } catch { /* read what opened */ }
                await new Promise(r => setTimeout(r, 3000));
                const opened = [...foundry.applications.instances.values()].filter(a => a.rendered && !had.has(a.id));
                const mine = [...foundry.applications.instances.values()].filter(a => a.rendered && /drpg/.test(String(a.id) + " " + String(a.element?.className ?? "")));
                const els = [...new Set([...opened, ...mine])].map(a => a.element).filter(Boolean);
                const list = document.getElementById("players");
                const listText = fk.squash(list);
                const listShown = Boolean(list) && getComputedStyle(list).display !== "none" && list.getClientRects().length > 0;
                const CONN = /\\b(connected|disconnected|offline|online)\\b|po\\u0142\\u0105czon|roz\\u0142\\u0105czon|niepo\\u0142\\u0105czon/i;
                const marker = els.some(el => el.querySelector("[data-online], [data-connected], [data-drpg-online], [data-drpg-connected], .online, .offline, .connected, .disconnected"));
                const words = els.some(el => CONN.test(fk.squash(el)));
                const PRIM = /primary|g\\u0142\\u00f3wn/i, name = ${J(primName)};
                const primShown = [...els, document.getElementById("ui-right"), document.getElementById("ui-left")].filter(Boolean).some(root =>
                    [...root.querySelectorAll("*")].some(el => { const own = fk.squash(el); return own.length < 160 && own.includes(name) && PRIM.test(own); }));
                for (const a of opened) { try { await a.close(); } catch { /* left open */ } }
                return { listShown, listNames: ${J(playerNames)}.filter(n => listText.includes(n)), marker, words, primShown, windows: els.length };`, { timeout: 60_000 });
            check(`J1 (${gm}): a GM sees in the interface which players are connected`,
                (ui1.listShown && ui1.listNames.length === playerNames.length) || ui1.marker || ui1.words, J(ui1), { ids: ["EXP-GM-01"] });
            check(`J2 (${gm}): a GM sees in the interface who the primary GM is`, ui1.primShown, J(ui1), { ids: ["PRIM-01"] });
        }
    });

    /* ------------------------------------------------------------------ Z */
    ctx.phase("Z put back");
    for (const role of meta.roles) {
        if (!ctx.c[role]) continue;
        await call(ctx, role, "setRules", []).catch(() => 0);
        await call(ctx, role, "closeWindows").catch(() => 0);
    }
    const back = await restore(ctx, prim, before);
    note("the clock and the pause put back", J(back));
}
