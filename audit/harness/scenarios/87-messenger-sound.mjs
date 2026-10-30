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
 * Red at 419d3b42 (E50 C1's parent), measured 30.10.2026: see the commit's message.
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
    a4: "S87 A4 words that must not be lost"
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
}
