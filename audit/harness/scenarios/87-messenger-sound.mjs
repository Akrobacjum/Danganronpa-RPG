/**
 * 87: the messenger and the Sound window on two GMs' browsers and the players' (E50).
 *
 * The messenger is the channel of every GM decision: a thread read where nobody saw it, or a text lost on a failed
 * send, is a request lost. Each part names which browser does what and reads the result on the others. The read map
 * is a client setting, so gm and gm2 each keep their own; gm2's id sorts after gm's, so gm stays the primary.
 *
 *   A (E50 C1; E50-01 to E50-05) - the messenger window reads only what is in front of its reader:
 *     A1 gm2 opens p1's thread and goes to the Note tab; p1 writes; gm2's Note tab is drawn again: unread 1 on gm2
 *        and 1 on gm; gm2 goes to Chat: 0 on gm2, still 1 on gm.
 *     A2 gm2's window on Chat with another window in front of it; p1 asks the GM through `callGm`: the bubble is in
 *        gm2's window AND gm2 is shown the card, kept as the thread's (`source` "messenger", its `messageId`,
 *        `link.messenger` p1); gm2 brings the window forward: read.
 *     A3 p1's window on Chat, p1's page hidden; gm writes: unread 1 on p1 and p1 is shown the card; the page shown
 *        again: read.
 *     A4 p1's message fails once (a page hook makes `ChatMessage.create` throw once on p1): the words stay in the
 *        field, one `sendFailed` toast, no such message on gm or gm2; the second try lands and the field is empty.
 *     A5 gm deletes p1's thread's cards one by one while p1's and gm2's windows are open: each leaves both windows,
 *        and the last one gone puts the empty notice back on both.
 *     A0 the harness's models (`ui.activeWindow` set by a first render and `bringToFront`, cleared by a close; a page
 *        hidden by `__pageVisibility`) are listed as unconfirmed on v14 (LIVE-E50-01, LIVE-E50-02).
 *
 *   B (E50 C2; E50-11, E50-13) - the counts and the GM's roster:
 *     B1 gm, the primary, posts an ask in p1's thread from its own session, as the bridge does (`callGm` run on gm):
 *        gm's badge, its roster row for p1 and its count say 1 more, and gm2's too; gm reads it in p1's window: 0 on
 *        gm, still 1 on gm2. gm posts a second ask: 1 on gm; gm settles it (`settleCall`): 0 on gm, 2 on gm2; gm2
 *        reads the thread: 0.
 *     B2 the roster on gm and on gm2: three clicks inside leave it open, the outside click after them closes it,
 *        two opens in a row leave one roster.
 *
 *   C (E50 C3; E50-20 to E50-22, E50-25) - the Sound window saves as you go, and the primary follows:
 *     C0 Foundry's curve for the Music slider (AudioHelper, read in fvtt-types) is listed as unconfirmed (LIVE-E50-03).
 *     C1 the music switched on and two fixture playlists made on gm; gm2 opens its Sound window and maps the current
 *        state to one of them (no Apply: its row says saved): gm, the primary, plays it after MAP_SETTLE_MS and the
 *        settle, p1 reads it playing, and gm2 runs no `apply` of its own (its `music.apply` counter, read past the
 *        time its own follow would have run) and calls no Playlist write to start or stop anything (its prototype's
 *        playAll, stopAll, playSound, stopSound and update counted). The count is what tells two drivers apart: a
 *        second driver arriving after the primary finds the playlist playing and writes nothing.
 *     C2 gm and gm2 each change a different row of their open windows; gm2's next read of the map is stood in by the
 *        map before gm's write (the read two GMs make in one tick, which a harness of separate processes cannot hit
 *        on purpose), so gm2's write takes gm's row away: gm writes it again on the echo, and both rows are stored on
 *        both browsers (gm hears the writes gm, gm2, gm).
 *     C3 p1 sets its Music slider to 50: `core.globalPlaylistVolume` 0.3536, and 50 again when the window is drawn
 *        again. The map, the switch, the volume and the playlists are put back.
 *
 * Red at 419d3b42 (E50 C1's parent) for part A, at cbe52a4e's module code (E50 C2's parent) for part B and at
 * 83ca7142's (E50 C3's parent) for part C, measured 30.10.2026: see each commit's message.
 */
export const layers = ["ci"];
export const timeoutMs = 240000;
export const accounts = [
    { who: "gm2", id: "USERGM2000000000", name: "Second GM", role: 4, character: null, color: "#66aaff" }
];

const J = value => JSON.stringify(value);
const WORDS = {
    a1: "S87 A1 a word while the Note tab shows",
    a2: "S87 A2 a question for the GM",
    a3: "S87 A3 a reply while the page is hidden",
    a4: "S87 A4 words that must not be lost",
    b1: "S87 B1 an ask the primary posts",
    b1b: "S87 B1 a second ask, settled"
};

export async function run({ gm, gm2, p1, check, phase, settle, environment, IDS, repoUrl }) {
    const P1 = p1.userId;
    const UNTIL = `const until = async (test, ms = 6000) => { const end = Date.now() + ms; while (!(await test()) && Date.now() < end) await new Promise(r => setTimeout(r, 100)); return test(); };`;
    const M = `const M = await import("${repoUrl}/scripts/messenger.mjs"); const A = await import("${repoUrl}/scripts/messenger-app.mjs");`;
    const UNREAD = `${M} return M.unreadCount("${P1}");`;
    const unread = async () => ({ gm: await gm.eval(UNREAD), gm2: await gm2.eval(UNREAD), p1: await p1.eval(UNREAD) });
    // What a browser's open window of p1's thread shows: its tab, the bubbles' words, the empty notice, whether it is in front.
    const WINDOW = `${M} const app = A.DrpgMessengerApp.instances.get("${P1}") ?? null;
        const log = app?.element?.querySelector(".drpg-messenger-log") ?? null;
        return { open: Boolean(app?.rendered), tab: app?.tab ?? null, front: Boolean(app) && ui.activeWindow === app,
            bubbles: log ? [...log.querySelectorAll(".drpg-messenger-bubble")].map(b => ({ id: b.dataset.messageId, text: b.textContent.trim().slice(-60) })) : null,
            empty: Boolean(log?.querySelector(".drpg-messenger-empty")) };`;
    const OPEN = `${M} ${UNTIL} const app = A.openMessenger("${P1}"); await until(() => app?.rendered); return Boolean(app?.rendered);`;
    const kept = text => `const NH = await import("${repoUrl}/scripts/notice-history.mjs");
        return NH.noticeEntries().filter(e => String(e.text ?? "").includes(${J(text)})).map(e => ({ source: e.source, messageId: e.messageId ?? null, link: e.link?.messenger ?? null }));`;

    /* ------------------------------ A0. the harness's models ------------------------------ */
    phase("A0: what the harness models of the window in front and of a hidden page");
    const unconfirmed = environment?.unconfirmed ?? [];
    check("A0: the window in front and the hidden page are the harness's models, listed as unconfirmed on v14 (LIVE-E50-01, LIVE-E50-02; E50-05)",
        ["LIVE-E50-01", "LIVE-E50-02"].every(id => unconfirmed.includes(id)), J(unconfirmed.filter(id => id.startsWith("LIVE-E50"))));
    const model = await gm2.eval(`${UNTIL}
        const app = new foundry.applications.api.ApplicationV2({ id: "s87-model", window: { title: "S87 model" } });
        await app.render({ force: true });
        const drawn = ui.activeWindow === app;
        ui.activeWindow = null; app.bringToFront(); const raised = ui.activeWindow === app;
        await app.close(); const closed = ui.activeWindow === null;
        const was = document.visibilityState; globalThis.__pageVisibility("hidden"); const hidden = [document.visibilityState, document.hidden];
        globalThis.__pageVisibility("visible");
        return { drawn, raised, closed, was, hidden, back: [document.visibilityState, document.hidden] };`);
    check("A0: in the harness a first render and bringToFront put a window in front, a close clears it, and a page can be hidden and shown",
        model.drawn && model.raised && model.closed && model.was === "visible" && J(model.hidden) === J(["hidden", true]) && J(model.back) === J(["visible", false]),
        J(model));

    /* ------------------------------ A1. the Note tab reads nothing ------------------------------ */
    phase("A1: gm2 on p1's Note tab while p1 writes", { flow: "messenger" });
    const start = { thread: await gm.eval(`${M} return M.threadMessages("${P1}").length;`), unread: await unread() };
    check("A1: p1's thread starts empty and unread nowhere", start.thread === 0 && start.unread.gm === 0 && start.unread.gm2 === 0 && start.unread.p1 === 0, J(start));
    const opened = await gm2.eval(OPEN);
    await gm2.eval(`${M} ${UNTIL} const app = A.DrpgMessengerApp.instances.get("${P1}");
        app.element.querySelector('[data-drpg-tab="note"]').click(); await until(() => app.element.querySelector(".drpg-messenger-note-text")); return true;`);
    const a1Sent = await p1.eval(`${M} const m = await M.sendMessage("${P1}", ${J(WORDS.a1)}); return m?.id ?? null;`, { timeout: 60000 });
    await settle(900);
    // The Note tab drawn again (a note changed, a click on Note): a render that does not show the chat.
    await gm2.eval(`${M} ${UNTIL} const app = A.DrpgMessengerApp.instances.get("${P1}"); await app.render(); await new Promise(r => setTimeout(r, 200)); return app.tab;`);
    const a1Note = { unread: await unread(), window: await gm2.eval(WINDOW) };
    check("A1: p1's message stays unread on gm2 while gm2's window is drawn on its Note tab, and is unread on gm (S11-37, E50-01)",
        opened && Boolean(a1Sent) && a1Note.window.tab === "note" && a1Note.unread.gm2 === 1 && a1Note.unread.gm === 1 && a1Note.unread.p1 === 0,
        J({ opened, a1Sent, a1Note }), { flow: "messenger" });
    await gm2.eval(`${M} ${UNTIL} const app = A.DrpgMessengerApp.instances.get("${P1}");
        app.element.querySelector('[data-drpg-tab="chat"]').click(); await until(() => app.element.querySelector(".drpg-messenger-log")); await new Promise(r => setTimeout(r, 300)); return true;`);
    const a1Chat = { unread: await unread(), window: await gm2.eval(WINDOW) };
    check("A1: gm2 goes to the Chat tab: read on gm2, still unread on gm - each browser keeps its own read state",
        a1Chat.window.tab === "chat" && a1Chat.unread.gm2 === 0 && a1Chat.unread.gm === 1
            && (a1Chat.window.bubbles ?? []).some(b => b.id === a1Sent),
        J(a1Chat), { flow: "messenger" });

    /* ------------------------------ A2. a window behind another ------------------------------ */
    phase("A2: gm2's window on Chat behind another window; p1 asks the GM", { flow: "messenger" });
    await gm2.eval(`const other = new foundry.applications.api.ApplicationV2({ id: "s87-other", window: { title: "S87 other" } });
        await other.render({ force: true }); return ui.activeWindow === other;`);
    const a2Asked = await p1.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        return await B.callGm(game.actors.get("${IDS.aiko}"), { title: "S87 A2", request: ${J(WORDS.a2)} });`, { timeout: 60000 });
    const a2 = await gm2.eval(`${M} ${UNTIL}
        const S = await import("${repoUrl}/scripts/secret.mjs");
        const ask = () => M.threadMessages("${P1}").find(m => S.cardFlag(m, M.MESSENGER_FLAGS.gmAsk));
        await until(() => ask() && document.querySelector('.drpg-messenger-bubble[data-message-id="' + ask().id + '"]'));
        const NH = await import("${repoUrl}/scripts/notice-history.mjs");
        await until(() => NH.noticeEntries().some(e => e.messageId === ask()?.id));
        const id = ask()?.id ?? null;
        return { id, bubble: Boolean(id && document.querySelector('.drpg-messenger-bubble[data-message-id="' + id + '"]')),
            kept: NH.noticeEntries().filter(e => e.messageId === id).map(e => ({ source: e.source, messageId: e.messageId, link: e.link?.messenger ?? null })),
            unread: M.unreadCount("${P1}") };`, { timeout: 60000 });
    check("A2: the ask lands in gm2's open window behind another AND gm2 is shown its card, kept as the thread's (E50-02)",
        a2Asked === true && a2.bubble && a2.unread === 1 && a2.kept.length === 1
            && J(a2.kept[0]) === J({ source: "messenger", messageId: a2.id, link: P1 }),
        J({ a2Asked, a2 }), { flow: "messenger" });
    const a2Front = await gm2.eval(`${M} const app = A.DrpgMessengerApp.instances.get("${P1}"); app.bringToFront();
        await new Promise(r => setTimeout(r, 300)); await foundry.applications.instances.get("s87-other")?.close();
        return { front: ui.activeWindow === app, unread: M.unreadCount("${P1}") };`);
    check("A2: gm2 brings the window forward: read", a2Front.unread === 0, J(a2Front), { flow: "messenger" });

    /* ------------------------------ A3. a hidden page ------------------------------ */
    phase("A3: p1's window on Chat, p1's page hidden; gm writes", { flow: "messenger" });
    const p1Opened = await p1.eval(OPEN);
    await settle(300);
    await p1.eval(`globalThis.__pageVisibility("hidden"); return document.visibilityState;`);
    const a3Sent = await gm.eval(`${M} const m = await M.sendMessage("${P1}", ${J(WORDS.a3)}); return m?.id ?? null;`, { timeout: 60000 });
    const a3Hidden = await p1.eval(`${M} ${UNTIL}
        const NH = await import("${repoUrl}/scripts/notice-history.mjs");
        await until(() => document.querySelector('.drpg-messenger-bubble[data-message-id="${a3Sent}"]'));
        await until(() => NH.noticeEntries().some(e => e.messageId === "${a3Sent}"), 3000);
        const app = A.DrpgMessengerApp.instances.get("${P1}");
        return { front: ui.activeWindow === app, bubble: Boolean(document.querySelector('.drpg-messenger-bubble[data-message-id="${a3Sent}"]')), unread: M.unreadCount("${P1}"),
            kept: NH.noticeEntries().filter(e => e.messageId === "${a3Sent}").map(e => ({ source: e.source, link: e.link?.messenger ?? null })) };`, { timeout: 60000 });
    check("A3: with p1's page hidden, gm's reply is in p1's window, unread on p1, and p1 is shown its card (E50-01, E50-02)",
        p1Opened && Boolean(a3Sent) && a3Hidden.front && a3Hidden.bubble && a3Hidden.unread === 1
            && J(a3Hidden.kept) === J([{ source: "messenger", link: P1 }]),
        J({ p1Opened, a3Sent, a3Hidden }), { flow: "messenger" });
    const a3Back = await p1.eval(`${M} globalThis.__pageVisibility("visible"); await new Promise(r => setTimeout(r, 300)); return M.unreadCount("${P1}");`);
    check("A3: p1's page shown again with the window in front: read", a3Back === 0, J({ a3Back }), { flow: "messenger" });

    /* ------------------------------ A4. a failed send ------------------------------ */
    phase("A4: p1's send fails once", { flow: "messenger" });
    const SUBMIT = `${M} ${UNTIL}
        const app = A.DrpgMessengerApp.instances.get("${P1}");
        const area = app.element.querySelector(".drpg-messenger-input textarea");
        area.value = ${J(WORDS.a4)};
        app.element.querySelector(".drpg-messenger-input").requestSubmit();
        await new Promise(r => setTimeout(r, 50));
        await until(() => !area.disabled);
        await new Promise(r => setTimeout(r, 300));`;
    const COUNT = `${M} return M.threadMessages("${P1}").length;`;
    const a4Start = { gm: await gm.eval(COUNT), gm2: await gm2.eval(COUNT) };
    const a4Fail = await p1.eval(`
        const toasts = [], realError = ui.notifications.error;
        ui.notifications.error = function (text, ...rest) { toasts.push(String(text)); return realError.call(this, text, ...rest); };
        const had = Object.getOwnPropertyDescriptor(ChatMessage, "create");
        let refused = 0;
        Object.defineProperty(ChatMessage, "create", { configurable: true, writable: true, value: async function () { refused++; throw new Error("S87 A4 refused once"); } });
        let out;
        try {
            ${SUBMIT}
            out = { field: area.value, disabled: area.disabled };
        } finally {
            if (had) Object.defineProperty(ChatMessage, "create", had); else delete ChatMessage.create;
            ui.notifications.error = realError;
        }
        return { ...out, refused, toasts, failed: game.i18n.localize("DRPG.Messenger.sendFailed") };`, { timeout: 60000 });
    await settle(900);
    const HAS_A4 = `${M} return M.threadMessages("${P1}").filter(m => document.querySelector('.drpg-messenger-bubble[data-message-id="' + m.id + '"]')?.textContent.includes(${J(WORDS.a4)})
        || String(m.content ?? "").includes(${J(WORDS.a4)})).length;`;
    const a4None = { gm: await gm.eval(COUNT), gm2: await gm2.eval(COUNT), gm2Words: await gm2.eval(HAS_A4) };
    check("A4: a send that fails keeps p1's words in the field, gives the field back and says so once; nothing reached the GMs (S11-38, E50-03)",
        a4Fail.refused === 1 && a4Fail.field === WORDS.a4 && a4Fail.disabled === false
            && J(a4Fail.toasts) === J([a4Fail.failed]) && a4Fail.failed !== "DRPG.Messenger.sendFailed"
            && a4None.gm === a4Start.gm && a4None.gm2 === a4Start.gm2 && a4None.gm2Words === 0,
        J({ a4Start, a4Fail, a4None }), { flow: "messenger" });
    const a4Again = await p1.eval(`${SUBMIT} return { field: area.value };`, { timeout: 60000 });
    await settle(900);
    const a4Landed = { gm: await gm.eval(COUNT), gm2: await gm2.eval(COUNT), gm2Words: await gm2.eval(HAS_A4) };
    check("A4: the second try lands on both GMs and empties the field",
        a4Again.field === "" && a4Landed.gm === a4Start.gm + 1 && a4Landed.gm2 === a4Start.gm2 + 1 && a4Landed.gm2Words === 1,
        J({ a4Start, a4Again, a4Landed }), { flow: "messenger" });

    /* ------------------------------ A5. deleted cards ------------------------------ */
    phase("A5: gm deletes p1's thread's cards while p1's and gm2's windows are open", { flow: "messenger" });
    const ids = await gm.eval(`${M} return M.threadMessages("${P1}").map(m => m.id);`);
    const before = { p1: await p1.eval(WINDOW), gm2: await gm2.eval(WINDOW) };
    const reads = [];
    for (const id of ids) {
        await gm.eval(`await game.messages.get("${id}")?.delete(); return true;`);
        await settle(600);
        const p1Window = await p1.eval(WINDOW), gm2Window = await gm2.eval(WINDOW);
        reads.push({ id, p1: p1Window.bubbles?.map(b => b.id) ?? null, gm2: gm2Window.bubbles?.map(b => b.id) ?? null, p1Empty: p1Window.empty, gm2Empty: gm2Window.empty });
    }
    const left = (i, list) => J(list) === J(ids.slice(i + 1));
    check("A5: each deleted card leaves p1's and gm2's open windows, and the last one gone puts the empty notice back on both (S11-35, E50-04)",
        ids.length >= 2 && J(before.p1.bubbles?.map(b => b.id)) === J(ids) && J(before.gm2.bubbles?.map(b => b.id)) === J(ids)
            && reads.every((r, i) => left(i, r.p1) && left(i, r.gm2))
            && reads.slice(0, -1).every(r => !r.p1Empty && !r.gm2Empty) && reads.at(-1)?.p1Empty === true && reads.at(-1)?.gm2Empty === true,
        J({ ids, before: { p1: before.p1.bubbles, gm2: before.gm2.bubbles }, reads }), { flow: "messenger" });

    for (const client of [p1, gm2]) await client.eval(`${M} await A.DrpgMessengerApp.instances.get("${P1}")?.close(); return true;`);
    await settle(200);

    /* ------------------------------ B1. the primary's own asks ------------------------------ */
    phase("B1: gm, the primary, posts an ask in p1's thread from its own session; gm and gm2 count it", { flow: "messenger" });
    // A GM's three readings of p1's thread: the count, the launcher's badge, and p1's row in the roster (opened, read, closed by an outside click).
    const COUNTS = `${M} ${UNTIL}
        const badge = Number(document.querySelector("#drpg-messenger-launcher .drpg-messenger-badge")?.textContent ?? 0);
        A.openMessenger();
        await until(() => document.getElementById("drpg-messenger-roster"), 2000);
        const name = game.users.get("${P1}")?.name;
        const row = [...document.querySelectorAll("#drpg-messenger-roster .drpg-messenger-roster-row")].find(li => li.querySelector(".drpg-messenger-roster-name")?.textContent === name);
        const inRow = row ? Number(row.querySelector(".drpg-messenger-badge")?.textContent ?? 0) : null;
        await new Promise(r => setTimeout(r, 50));
        document.body.click();
        await until(() => !document.getElementById("drpg-messenger-roster"), 2000);
        for (const left of document.querySelectorAll("#drpg-messenger-roster")) left.remove();
        return { unread: M.unreadCount("${P1}"), badge, row: inRow };`;
    const counts = async () => ({ gm: await gm.eval(COUNTS), gm2: await gm2.eval(COUNTS) });
    const ASK = words => `const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        return await B.callGm(game.actors.get("${IDS.aiko}"), { title: "S87 B1", request: ${J(words)} });`;
    const ASK_HERE = words => `${M} ${UNTIL} const S = await import("${repoUrl}/scripts/secret.mjs");
        const find = () => M.threadMessages("${P1}").find(m => S.cardFlag(m, M.MESSENGER_FLAGS.gmAsk) && S.contentOf(m).includes(${J(words)}));
        await until(() => find()); return find()?.id ?? null;`;
    const b1Before = await counts();
    const b1Asked = await gm.eval(ASK(WORDS.b1), { timeout: 60000 });
    const b1Card = { gm: await gm.eval(ASK_HERE(WORDS.b1), { timeout: 60000 }), gm2: await gm2.eval(ASK_HERE(WORDS.b1), { timeout: 60000 }) };
    await settle(600);
    const b1Author = await gm.eval(`return game.messages.get(${J(b1Card.gm)})?.author?.id ?? null;`);
    const b1After = await counts();
    const plusOne = (after, before) => after.unread === before.unread + 1 && after.badge === before.badge + 1 && after.row === (before.row ?? 0) + 1;
    check("B1: an ask the primary posts in p1's thread from its own session is unread for it - its badge, its roster row and its count - and for gm2 (S11-45, E50-11)",
        b1Asked === true && Boolean(b1Card.gm) && b1Card.gm === b1Card.gm2 && b1Author === gm.userId
            && plusOne(b1After.gm, b1Before.gm) && plusOne(b1After.gm2, b1Before.gm2),
        J({ b1Asked, b1Card, b1Author, b1Before, b1After }), { flow: "messenger" });
    await gm.eval(OPEN);
    await settle(400);
    const b1Read = await counts();
    check("B1: gm reads p1's thread: 0 on gm, the ask still unread on gm2",
        b1Read.gm.unread === 0 && b1Read.gm2.unread === b1After.gm2.unread, J(b1Read), { flow: "messenger" });
    await gm.eval(`${M} await A.DrpgMessengerApp.instances.get("${P1}")?.close(); return true;`);
    await settle(200);
    await gm.eval(ASK(WORDS.b1b), { timeout: 60000 });
    const b1bId = await gm.eval(ASK_HERE(WORDS.b1b), { timeout: 60000 });
    await gm2.eval(ASK_HERE(WORDS.b1b), { timeout: 60000 });
    await settle(600);
    const b1bOpen = { gm: await gm.eval(UNREAD), gm2: await gm2.eval(UNREAD) };
    const b1bSettled = await gm.eval(`${M} ${UNTIL} const B = await import("${repoUrl}/scripts/gm-bridge.mjs"); const S = await import("${repoUrl}/scripts/secret.mjs");
        await B.settleCall(game.messages.get(${J(b1bId)}), "S87 B1 settled");
        await until(() => S.cardFlag(game.messages.get(${J(b1bId)}), M.MESSENGER_FLAGS.settled)); return Boolean(S.cardFlag(game.messages.get(${J(b1bId)}), M.MESSENGER_FLAGS.settled));`, { timeout: 60000 });
    await settle(600);
    const b1bAfter = { gm: await gm.eval(UNREAD), gm2: await gm2.eval(UNREAD) };
    check("B1: the primary's second ask counts on gm until it is settled, then not; on gm2 both asks are unread (E50-11)",
        Boolean(b1bId) && b1bOpen.gm === 1 && b1bSettled === true && b1bAfter.gm === 0 && b1bAfter.gm2 === b1Read.gm2.unread + 1,
        J({ b1bId, b1bOpen, b1bSettled, b1bAfter }), { flow: "messenger" });
    await gm2.eval(OPEN);
    await settle(400);
    const b1bRead = await gm2.eval(UNREAD);
    check("B1: gm2 reads p1's thread: 0 on gm2", b1bRead === 0, J({ b1bRead }), { flow: "messenger" });
    await gm2.eval(`${M} await A.DrpgMessengerApp.instances.get("${P1}")?.close(); return true;`);
    await settle(200);

    /* ------------------------------ B2. one road to close the roster ------------------------------ */
    phase("B2: the roster on gm and gm2 - clicks inside, the outside click, two opens", { flow: "messenger" });
    const ROSTER = `${M} ${UNTIL}
        const n = () => document.querySelectorAll("#drpg-messenger-roster").length;
        try {
            A.openMessenger();
            await new Promise(r => setTimeout(r, 50));
            const panel = document.getElementById("drpg-messenger-roster");
            for (const target of [panel?.querySelector("h4"), panel, panel?.querySelector("h4")]) target?.click();
            const inside = n() === 1 && !panel.classList.contains("leaving");
            document.body.click();
            const closed = await until(() => n() === 0, 2000);
            A.openMessenger();
            A.openMessenger();
            const twice = n();
            await new Promise(r => setTimeout(r, 50));
            document.body.click();
            const after = await until(() => n() === 0, 2000);
            return { inside, closed: Boolean(closed), twice, after: Boolean(after) };
        } finally {
            for (const left of document.querySelectorAll("#drpg-messenger-roster")) left.remove();
        }`;
    const b2 = { gm: await gm.eval(ROSTER), gm2: await gm2.eval(ROSTER) };
    const b2Want = J({ inside: true, closed: true, twice: 1, after: true });
    check("B2: on gm and on gm2 the roster stays open through clicks inside, closes on the outside click after them, and two opens leave one (S11-44, E50-13)",
        J(b2.gm) === b2Want && J(b2.gm2) === b2Want, J(b2), { flow: "messenger" });

    /* ------------------------------ C. the Sound window and the primary's playback ------------------------------ */
    const MU = `const MU = await import("${repoUrl}/scripts/music.mjs"); const ST = await import("${repoUrl}/scripts/settings.mjs");`;
    // The Sound window on this browser: drawn as a real window (`__dialogWindows`), opened, and a select or slider found.
    const SOUND = `const root = () => document.querySelector(".drpg-window-sound");
        const windows = globalThis.__dialogWindows; globalThis.__dialogWindows = true;
        const closeSound = async () => { root()?.querySelector('footer.form-footer button[data-action="close"]')?.click(); await until(() => !root(), 3000); };`;
    const SELECT = (key, value) => `const s = root()?.querySelector('select[name="state:${key}"]');
        if (s) { s.value = ${J(value)}; s.dispatchEvent(new Event("change", { bubbles: true })); }
        const marker = () => s?.closest("tr")?.querySelector("[data-drpg-save]")?.dataset.drpgSave ?? null;`;
    const MAP = `${MU} return ST.getSetting(ST.SETTINGS.musicMap) ?? {};`;

    phase("C0: what the harness assumes of Foundry's Music slider");
    check("C0: Foundry's curve for the Music slider (AudioHelper, read in fvtt-types 14.366) is listed as unconfirmed on v14 (LIVE-E50-03; E50-25)",
        unconfirmed.includes("LIVE-E50-03"), J(unconfirmed.filter(id => id.startsWith("LIVE-E50"))));

    phase("C1: gm2 maps the current state in its Sound window; gm, the primary, plays it");
    const c1Setup = await gm.eval(`${MU}
        globalThis.__s87Music = { map: ST.getSetting(ST.SETTINGS.musicMap) ?? {}, on: ST.getSetting(ST.SETTINGS.musicEnabled) };
        await ST.setSetting(ST.SETTINGS.musicEnabled, true);
        const made = [];
        for (const name of ["S87 C1 the state's playlist", "S87 C2 a playlist"]) {
            made.push((await Playlist.create({ name, sounds: [{ name: name + " - its track", path: "sounds/lock.wav" }] })).id);
        }
        const state = MU.currentState();
        const free = MU.MUSIC_STATES.map(s => s.key).filter(k => k !== state && k !== "murder" && !globalThis.__s87Music.map[k]);
        return { state, made, free, on: ST.getSetting(ST.SETTINGS.musicEnabled) };`, { timeout: 60000 });
    const [C1_PLAYLIST, C2_PLAYLIST] = c1Setup.made;
    await settle(600);
    // gm2's own playback calls, counted from here: every Playlist write it would make to start or stop music.
    await gm2.eval(`const proto = Object.getPrototypeOf(game.playlists.get(${J(C1_PLAYLIST)}));
        const C = await import("${repoUrl}/scripts/perf-counters.mjs");
        globalThis.__s87Applies = C.snapshot()["music.apply"] ?? 0;
        globalThis.__s87Calls = []; globalThis.__s87Wrapped = [];
        for (const name of ["playAll", "stopAll", "playSound", "stopSound", "update"]) {
            const real = proto[name], own = Object.prototype.hasOwnProperty.call(proto, name);
            globalThis.__s87Wrapped.push([name, real, own]);
            proto[name] = function (...args) { globalThis.__s87Calls.push(name + " " + this.name); return real.apply(this, args); };
        }
        return true;`);
    const c1Change = await gm2.eval(`${MU} ${UNTIL} ${SOUND}
        try {
            MU.openSoundDialog();
            await until(() => root()?.querySelector("select[name^='state:']"));
            ${SELECT(c1Setup.state, C1_PLAYLIST)}
            const saved = await until(() => marker() === "saved", 4000);
            return { opened: Boolean(s), saved: Boolean(saved), at: Date.now() };
        } finally { globalThis.__dialogWindows = windows; }`, { timeout: 60000 });
    const c1Play = await gm.eval(`${UNTIL} const playing = await until(() => game.playlists.get(${J(C1_PLAYLIST)})?.playing, 5000);
        return { playing: Boolean(playing), at: Date.now() };`, { timeout: 60000 });
    // Past the time gm2's own follow would have run (MAP_SETTLE_MS and the settle after its write), had it one.
    await settle(1200);
    const c1Seen = { p1: await p1.eval(`return game.playlists.get(${J(C1_PLAYLIST)})?.playing === true;`),
        gm2Applies: await gm2.eval(`const C = await import("${repoUrl}/scripts/perf-counters.mjs");
            const n = (C.snapshot()["music.apply"] ?? 0) - globalThis.__s87Applies; delete globalThis.__s87Applies; return n;`),
        gm2Calls: await gm2.eval(`const calls = globalThis.__s87Calls; for (const [name, real, own] of globalThis.__s87Wrapped) {
            const proto = Object.getPrototypeOf(game.playlists.get(${J(C1_PLAYLIST)})); if (own) proto[name] = real; else delete proto[name]; }
            delete globalThis.__s87Calls; delete globalThis.__s87Wrapped; return calls;`) };
    const c1Wait = c1Play.at - c1Change.at;
    check("C1: gm2 maps the current state to a playlist in its Sound window (no Apply) and gm, the primary, plays it after the settle; p1 hears it; gm2 runs no apply of its own and starts or stops no playlist (S11-34, E50-22)",
        Boolean(c1Setup.state) && c1Setup.on === true && c1Change.opened && c1Change.saved && c1Play.playing && c1Wait >= 1400 && c1Wait <= 1500 + 400 + 1500
            && c1Seen.p1 === true && c1Seen.gm2Applies === 0 && J(c1Seen.gm2Calls) === J([]),
        J({ c1Setup, c1Change, c1Play, c1Wait, c1Seen }));

    phase("C2: gm and gm2 change a different row each, gm2 reading the map gm's write has not reached yet");
    const [KA, KB] = c1Setup.free;
    const OPEN_SOUND = `${MU} ${UNTIL} ${SOUND} MU.openSoundDialog(); const opened = Boolean(await until(() => root()?.querySelector("select[name^='state:']"))); globalThis.__dialogWindows = windows; return opened;`;
    const c2Open = { gm: await gm.eval(OPEN_SOUND), gm2: await gm2.eval(OPEN_SOUND) };
    // gm's musicMap writes heard from here: its own, gm2's, and the one gm writes again for the key gm2's write took away.
    await gm.eval(`globalThis.__s87Writes = []; globalThis.__s87Hook = Hooks.on("updateSetting", (setting, changed, options, userId) => {
        if (setting?.key === "danganronpa-rpg.musicMap") globalThis.__s87Writes.push(userId === game.user.id ? "gm" : "gm2"); }); return true;`);
    // The map as gm2 reads it now, before gm's write: gm2's write is made from it - the read two GMs make in one tick.
    await gm2.eval(`${MU} globalThis.__s87Stale = foundry.utils.deepClone(ST.getSetting(ST.SETTINGS.musicMap) ?? {}); return true;`);
    // gm2's next read of the map, armed just before its change, answers the map it read before gm's write landed.
    const STALE = `const settings = game.settings, own = Object.prototype.hasOwnProperty.call(settings, "get"), real = settings.get;
        const unarm = () => { if (settings.get !== real) { if (own) settings.get = real; else delete settings.get; } };
        settings.get = function (ns, key, ...rest) {
            if (ns === "danganronpa-rpg" && key === "musicMap") { unarm(); return foundry.utils.deepClone(globalThis.__s87Stale); }
            return real.call(this, ns, key, ...rest);
        };`;
    const CHANGE = (key, value, arm = "") => `${UNTIL} const root = () => document.querySelector(".drpg-window-sound"); ${arm}
        try {
            ${SELECT(key, value)}
            return { found: Boolean(s), saved: Boolean(await until(() => marker() === "saved", 4000)) };
        } finally { ${arm ? "unarm(); delete globalThis.__s87Stale;" : ""} }`;
    const c2Gm = await gm.eval(CHANGE(KA, C2_PLAYLIST), { timeout: 60000 });
    const c2Gm2 = await gm2.eval(CHANGE(KB, C2_PLAYLIST, STALE), { timeout: 60000 });
    await settle(1500);
    const c2Maps = { gm: await gm.eval(MAP), gm2: await gm2.eval(MAP) };
    const c2Writes = await gm.eval(`Hooks.off("updateSetting", globalThis.__s87Hook); const w = globalThis.__s87Writes; delete globalThis.__s87Writes; delete globalThis.__s87Hook; return w;`);
    const both = map => map[KA] === C2_PLAYLIST && map[KB] === C2_PLAYLIST && map[c1Setup.state] === C1_PLAYLIST;
    check("C2: gm and gm2 each change a different row, gm2's write made from the map before gm's: both rows stored on both browsers, gm writing its row once more (E50-21)",
        Boolean(KA && KB) && c2Open.gm && c2Open.gm2 && c2Gm.saved && c2Gm2.saved && both(c2Maps.gm) && both(c2Maps.gm2) && J(c2Writes) === J(["gm", "gm2", "gm"]),
        J({ KA, KB, c2Open, c2Gm, c2Gm2, c2Maps, c2Writes }));
    for (const client of [gm, gm2]) await client.eval(`${UNTIL} ${SOUND} await closeSound(); globalThis.__dialogWindows = windows; return true;`);

    phase("C3: p1 sets the Music slider to 50");
    const c3 = await p1.eval(`${MU} ${UNTIL} ${SOUND}
        const was = game.settings.get("core", "globalPlaylistVolume");
        const slider = () => root()?.querySelector('input[name="vol:music"]');
        try {
            MU.openSoundDialog();
            await until(() => slider());
            const input = slider();
            if (input) { input.value = "50"; input.dispatchEvent(new Event("input", { bubbles: true })); }
            await until(() => game.settings.get("core", "globalPlaylistVolume") !== was, 3000);
            const written = Math.round(Number(game.settings.get("core", "globalPlaylistVolume")) * 1e4) / 1e4;
            await closeSound();
            MU.openSoundDialog();
            await until(() => slider());
            const shown = slider()?.value ?? null;
            await closeSound();
            return { was, written, shown };
        } finally {
            globalThis.__dialogWindows = windows;
            await game.settings.set("core", "globalPlaylistVolume", was);
        }`, { timeout: 60000 });
    check("C3: p1's Music slider at 50 writes Foundry's 0.3536 and reads 50 again when the window is drawn again (S11-41, E50-25)",
        c3.written === 0.3536 && c3.shown === "50", J(c3));

    // Put back: the map, the switch, the playlists.
    await gm.eval(`${MU} const was = globalThis.__s87Music; delete globalThis.__s87Music;
        await ST.setSetting(ST.SETTINGS.musicMap, was.map);
        await ST.setSetting(ST.SETTINGS.musicEnabled, was.on);
        for (const id of ${J(c1Setup.made)}) { const p = game.playlists.get(id); if (p?.playing) await p.stopAll(); await p?.delete(); }
        return true;`, { timeout: 60000 });
    await settle(600);
}
