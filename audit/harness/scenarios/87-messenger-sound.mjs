/**
 * 87: the messenger and the Sound window on two GMs' browsers and the players' (E50).
 *
 * The messenger is the channel of every GM decision: a thread read where nobody saw it, or a text lost on a failed
 * send, is a request lost. Each part names which browser does what and reads the result on the others. The read map
 * is a client setting, so gm and gm2 each keep their own; gm2's id sorts after gm's, so gm stays the primary.
 *
 *   A (E50 C1; E50-01 to E50-05) - the messenger window reads only what is in front of its reader:
 *     A1 gm2 opens p1's thread and goes to the Note tab; p1 writes; gm2's Note tab is drawn again: unread 1 on gm2
 *        and 1 on gm; gm2 goes to Chat: 0 on gm2, still 1 on gm. Then (fix FG2, G3), the window in front on Chat and the
 *        page shown, p1 asks the GM through `callGm`: on gm2 the bubble is appended, no card is kept for it and it is
 *        read at once; on gm, with no window, the card is kept and the count is one more.
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
 *        gm, still 1 on gm2. gm posts a second ask: 1 on gm; gm settles it (`settleCall`): 0 on gm, 2 on gm2; and
 *        (fix FG2, F2) the launcher's badge is the count on both before anything is opened, again after gm posts a
 *        third ask and gm2 settles it (the settle reaching gm as new words alone); gm2 reads the thread: 0.
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
 *        again.
 *     C4 (fix FG1, F3) gm2 maps the current state to the second playlist while gm is the primary; once gm has heard
 *        the echo, gm is stood in as gone on gm's page and gm2's (`_source.active`, as client-entry.mjs marks a user
 *        who left), so gm2 is the primary when the settle ends: gm2 plays the new playlist with one `music.apply`, gm
 *        with none, and the first playlist, which gm started and the map no longer names, is stopped (fix FG1b). A
 *        real GM leaving a real server is LIVE-E50-04.
 *     C5 (fix FG1, G8) a mapping onto a playlist named "Situational" (the world's, or one made) stored as before
 *        1.2.94; `dropCueMappings()` with its defaults, as `ready` calls it, on gm2 and then on gm: gm2 drops nothing
 *        and writes nothing, gm drops that key with one write (heard once on both), every other key kept.
 *        The map, the switch, the volume and the playlists are put back.
 *
 *   D (E50 C4; E50-30, E50-31) - the murder music (E19 C5) on every account in the killing:
 *     D1 p1's Aiko kills p2's Botan (opened on gm, the opening roll held on p1 and ruled a success, as 13-murder-signals
 *        does), a murder playlist of 8 tracks: gm's, gm2's, p1's and p2's `murderMusicHere().track` the same; p3's
 *        Chie, elsewhere, plays none.
 *     D3 p1's band (`nowPlayingHere`) names the murder track during it, and nothing at Music 0.
 *     D4 (fix FG2; F4, S2, G6) p1 writes to the GM in its window during the incident, where the primary posts it
 *        (secret.mjs `askGm`): too long, then with gm and gm2 stood in as gone on p1's page - each says only its
 *        refusal; then with gm holding the card.post packet past p1's `TIMING.ackMs` - "did not answer in time" and
 *        "may not have been sent" (no "not sent"), and gm, released, posts it: the words stay in the field each time.
 *     D2 p2 moves its Music slider during it; the incident ends (`endMurder`): p2's volume is the moved one, every
 *        other browser keeps its 0.8, no browser's `musicDuckedFrom` changed, the track stopped everywhere.
 *   E (E50 C4; E50-32) - the Take on a body (anonymity.mjs `buildBodyLoot`), drawn into p1's page; Botan dead on a
 *     published death with a Tool on him, Aiko beside him:
 *     E1 p1 presses Take; gm holds the packet (its module socket's handlers wrapped) while Aiko walks out of the room,
 *        then judges it: refused "not where it needs to be" - no "took" toast, the Take opened and shut again by the
 *        gate with that sentence, the Tool still on the body.
 *     E2 Aiko back; gm and gm2 stood in as gone on p1's page: no GM to ask - no "took" toast, "No GM is connected."
 *        once, the Take open again, nothing sent.
 *     E4 (fix FG2, G4) p1's page answers no character of its own for the click's read: "no character" once, no
 *        "took" toast, the Take open again, nothing sent.
 *     E3 the Take lands: the toast once, the Take stays shut, a second press sends nothing (one packet counted on gm).
 *   S (E50 C4; E50-33, flow "sound") - sfx.mjs's socket road, counted where `fire` hands a file to the audio layer
 *     (`sfx.played`), a key mapped and every browser's Sound slider at 0.8:
 *     S1 gm plays a sound for p1 (`playSfxForUsers`): 1 on p1, 0 on gm, gm2, p2 and p3.
 *     S2 p2's page sends `playSfxFor` packets, one to p1 and one to everybody: 0 everywhere.
 *
 * Red at 419d3b42 (E50 C1's parent) for part A, at cbe52a4e's module code (E50 C2's parent) for part B, at
 * 83ca7142's (E50 C3's parent) for part C and at 50d9e9c6's (E50 C4's parent) for parts E and S1, measured
 * 30.10.2026: see each commit's message. D and S2 are green there; their mutants are in C4's message. C4 is red at
 * 8d509dc7's module code and C5 is green there (it reads wiring C3 made): see fix FG1's message; C4's stopped first
 * playlist is red at 422142bc's (fix FG1b's message). B1's badge and D4 are red at 0f2058bf's module code; A1's ask
 * in front and E4 are green there and red on a planted fault each (fix FG2's message).
 */
export const layers = ["ci"];
export const timeoutMs = 240000;
export const accounts = [
    { who: "gm2", id: "USERGM2000000000", name: "Second GM", role: 4, character: null, color: "#66aaff" }
];

const MOD = "danganronpa-rpg";
const J = value => JSON.stringify(value);
const WORDS = {
    a1: "S87 A1 a word while the Note tab shows",
    a1b: "S87 A1 an ask while the window shows the thread",
    a2: "S87 A2 a question for the GM",
    a3: "S87 A3 a reply while the page is hidden",
    a4: "S87 A4 words that must not be lost",
    b1: "S87 B1 an ask the primary posts",
    b1b: "S87 B1 a second ask, settled",
    b1c: "S87 B1 a third ask, settled by gm2"
};

export async function run({ gm, gm2, p1, p2, p3, check, phase, settle, environment, IDS, repoUrl }) {
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
    /* E50-02's other half on a real window (fix FG2; the end review's G3): a window that shows the thread raises no card.
       An ask, since a GM is shown a card for an ask alone; R297's stand-in has no `seesThread` and reads the fallback. */
    const a1Asked = await p1.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        return await B.callGm(game.actors.get("${IDS.aiko}"), { title: "S87 A1", request: ${J(WORDS.a1b)} });`, { timeout: 60000 });
    const SEEN = wait => `${M} ${UNTIL} const S = await import("${repoUrl}/scripts/secret.mjs"); const NH = await import("${repoUrl}/scripts/notice-history.mjs");
        const ask = () => M.threadMessages("${P1}").find(m => S.cardFlag(m, M.MESSENGER_FLAGS.gmAsk) && S.contentOf(m).includes(${J(WORDS.a1b)}));
        await until(() => ask() && ${wait});
        const id = ask()?.id ?? null, app = A.DrpgMessengerApp.instances.get("${P1}") ?? null;
        return { id, front: Boolean(app) && ui.activeWindow === app, tab: app?.tab ?? null, visible: document.visibilityState,
            bubble: Boolean(id && document.querySelector('.drpg-messenger-bubble[data-message-id="' + id + '"]')),
            kept: NH.noticeEntries().filter(e => e.messageId === id).length, unread: M.unreadCount("${P1}") };`;
    const a1Seen = { gm2: await gm2.eval(SEEN(`document.querySelector('.drpg-messenger-bubble[data-message-id="' + ask().id + '"]')`), { timeout: 60000 }),
        gm: await gm.eval(SEEN(`NH.noticeEntries().some(e => e.messageId === ask().id)`), { timeout: 60000 }) };
    check("A1: with gm2's window in front on its Chat tab and the page shown, p1's ask is appended there, raises no card on gm2 and is read at once; on gm, with no window, it is shown as a card and counts one more (E50-02; fix FG2, G3)",
        a1Asked === true && Boolean(a1Seen.gm2.id) && a1Seen.gm2.id === a1Seen.gm.id && a1Seen.gm2.front && a1Seen.gm2.tab === "chat" && a1Seen.gm2.visible === "visible"
            && a1Seen.gm2.bubble && a1Seen.gm2.kept === 0 && a1Seen.gm2.unread === 0 && a1Seen.gm.kept === 1 && a1Seen.gm.unread === a1Chat.unread.gm + 1,
        J({ a1Asked, a1Seen }), { flow: "messenger" });

    /* ------------------------------ A2. a window behind another ------------------------------ */
    phase("A2: gm2's window on Chat behind another window; p1 asks the GM", { flow: "messenger" });
    await gm2.eval(`const other = new foundry.applications.api.ApplicationV2({ id: "s87-other", window: { title: "S87 other" } });
        await other.render({ force: true }); return ui.activeWindow === other;`);
    const a2Asked = await p1.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        return await B.callGm(game.actors.get("${IDS.aiko}"), { title: "S87 A2", request: ${J(WORDS.a2)} });`, { timeout: 60000 });
    const a2 = await gm2.eval(`${M} ${UNTIL}
        const S = await import("${repoUrl}/scripts/secret.mjs");
        const ask = () => M.threadMessages("${P1}").find(m => S.cardFlag(m, M.MESSENGER_FLAGS.gmAsk) && S.contentOf(m).includes(${J(WORDS.a2)}));
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
    // The launcher as it stands, before anything is opened (fix FG2; the end review's F2): its badge, and the count it should show.
    const BADGE = `${M} return { badge: Number(document.querySelector("#drpg-messenger-launcher .drpg-messenger-badge")?.textContent ?? 0), total: M.totalUnread() };`;
    const b1bBadge = { gm: await gm.eval(BADGE), gm2: await gm2.eval(BADGE) };
    const b1bAfter = { gm: await gm.eval(UNREAD), gm2: await gm2.eval(UNREAD) };
    check("B1: the primary's second ask counts on gm until it is settled, then not; on gm2 both asks are unread (E50-11)",
        Boolean(b1bId) && b1bOpen.gm === 1 && b1bSettled === true && b1bAfter.gm === 0 && b1bAfter.gm2 === b1Read.gm2.unread + 1,
        J({ b1bId, b1bOpen, b1bSettled, b1bAfter }), { flow: "messenger" });
    // A third ask the primary posts, settled by gm2: the settle reaches gm as new words for the card alone (`updateSecret`).
    await gm.eval(ASK(WORDS.b1c), { timeout: 60000 });
    const b1cId = await gm.eval(ASK_HERE(WORDS.b1c), { timeout: 60000 });
    await gm2.eval(ASK_HERE(WORDS.b1c), { timeout: 60000 });
    await settle(600);
    const b1cOpen = await gm.eval(BADGE);
    const b1cSettled = await gm2.eval(`${M} const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        return Boolean(await B.settleCall(game.messages.get(${J(b1cId)}), "S87 B1 settled by gm2"));`, { timeout: 60000 });
    const b1cOnGm = await gm.eval(`${M} ${UNTIL} const S = await import("${repoUrl}/scripts/secret.mjs");
        return await until(() => Boolean(S.cardFlag(game.messages.get(${J(b1cId)}), M.MESSENGER_FLAGS.settled)));`, { timeout: 60000 });
    await settle(600);
    const b1cBadge = { gm: await gm.eval(BADGE), gm2: await gm2.eval(BADGE) };
    check("B1: a settled ask leaves the launcher's badge at the count, on the GM that settled it and on the other one, before anything is opened: gm's own, then gm2's settle of gm's third (E50-11; fix FG2, F2)",
        b1bBadge.gm.badge === b1bBadge.gm.total && b1bBadge.gm2.badge === b1bBadge.gm2.total
            && Boolean(b1cId) && b1cOpen.total === b1bBadge.gm.total + 1 && b1cOpen.badge === b1cOpen.total && b1cSettled && b1cOnGm
            && b1cBadge.gm.total === b1bBadge.gm.total && b1cBadge.gm.badge === b1cBadge.gm.total && b1cBadge.gm2.badge === b1cBadge.gm2.total,
        J({ b1bBadge, b1cId, b1cOpen, b1cSettled, b1cOnGm, b1cBadge }), { flow: "messenger" });
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

    phase("C4: gm2 maps the current state again and is the primary before the settle ends");
    const APPLIES = `const C = await import("${repoUrl}/scripts/perf-counters.mjs"); return C.snapshot()["music.apply"] ?? 0;`;
    // gm stood in as gone on gm's page and gm2's (as client-entry.mjs marks a user who left), so gm2 is the primary on
    // both: the music's one test of who drives is `isPrimaryGm()`, read when a timer fires.
    const GM_HERE = here => `const u = game.users.get(${J(gm.userId)}); u._source.active = ${here};
        const U = await import("${repoUrl}/scripts/utils.mjs"); return U.isPrimaryGm();`;
    const c4Before = { gm: await gm.eval(APPLIES), gm2: await gm2.eval(APPLIES) };
    const c4Write = await gm2.eval(`${MU} ${UNTIL} const at = Date.now();
        await MU.saveMusicKey(${J(c1Setup.state)}, ${J(C2_PLAYLIST)});
        return { primary: (await import("${repoUrl}/scripts/utils.mjs")).isPrimaryGm(), saved: Date.now() - at };`, { timeout: 60000 });
    // The echo heard on gm, the primary when it arrived, before gm goes.
    const c4Echo = await gm.eval(`${MU} ${UNTIL} return Boolean(await until(() => (ST.getSetting(ST.SETTINGS.musicMap) ?? {})[${J(c1Setup.state)}] === ${J(C2_PLAYLIST)}, 3000));`);
    const c4Gone = { gm: await gm.eval(GM_HERE(false)), gm2: await gm2.eval(GM_HERE(false)) };
    let c4 = null;
    try {
        c4 = await gm2.eval(`${UNTIL} const playing = await until(() => game.playlists.get(${J(C2_PLAYLIST)})?.playing, 1500 + 400 + 2500);
            await new Promise(r => setTimeout(r, 800));
            return { playing: Boolean(playing), old: game.playlists.get(${J(C1_PLAYLIST)})?.playing === true };`, { timeout: 60000 });
    } finally {
        c4Gone.back = { gm: await gm.eval(GM_HERE(true)), gm2: await gm2.eval(GM_HERE(true)) };
    }
    const c4Applies = { gm: (await gm.eval(APPLIES)) - c4Before.gm, gm2: (await gm2.eval(APPLIES)) - c4Before.gm2 };
    check("C4: a mapping change made while gm is the primary is followed by gm2 when gm leaves within the settle: gm2, the primary when the timer ends, plays the state's new playlist with one apply, gm with none, and the playlist the state left is stopped (F3, FG1b, E50-22, LIVE-E50-04)",
        c4Write.primary === false && c4Echo && c4Gone.gm === false && c4Gone.gm2 === true && c4?.playing === true && c4?.old === false
            && c4Applies.gm2 === 1 && c4Applies.gm === 0 && c4Gone.back.gm === true && c4Gone.back.gm2 === false,
        J({ c4Write, c4Echo, c4Gone, c4, c4Applies }));

    phase("C5: a mapping onto the cue playlist stored before 1.2.94; the ready road's drop with the world's defaults on gm2, then on gm");
    const [, , KC] = c1Setup.free;
    const c5Setup = await gm.eval(`${MU} ${UNTIL} const C = await import("${repoUrl}/scripts/config.mjs");
        const found = game.playlists.find(p => p.name.trim().toLowerCase() === C.SITUATIONAL_PLAYLIST.trim().toLowerCase()) ?? null;
        const cue = found ?? await Playlist.create({ name: C.SITUATIONAL_PLAYLIST });
        globalThis.__s87Cue = found ? null : cue.id;
        await ST.setSetting(ST.SETTINGS.musicMap, { ...(ST.getSetting(ST.SETTINGS.musicMap) ?? {}), ${J(KC)}: cue.id });
        return { cue: cue.id, made: !found, name: cue.name };`, { timeout: 60000 });
    await settle(900);
    const HEAR = `globalThis.__s87Heard = []; globalThis.__s87Hook = Hooks.on("updateSetting", (setting, changed, options, userId) => {
        if (setting?.key === "danganronpa-rpg.musicMap") globalThis.__s87Heard.push(userId === ${J(gm.userId)} ? "gm" : userId === ${J(gm2.userId)} ? "gm2" : userId); }); return true;`;
    const HEARD = `Hooks.off("updateSetting", globalThis.__s87Hook); const h = globalThis.__s87Heard; delete globalThis.__s87Heard; delete globalThis.__s87Hook; return h;`;
    const c5Before = { gm: await gm.eval(MAP), gm2: await gm2.eval(MAP) };
    for (const client of [gm, gm2]) await client.eval(HEAR);
    const DROP = `${MU} return MU.dropCueMappings();`;
    const c5Drop = { gm2: await gm2.eval(DROP, { timeout: 60000 }) };
    await settle(600);
    c5Drop.gm = await gm.eval(DROP, { timeout: 60000 });
    await settle(900);
    const c5Maps = { gm: await gm.eval(MAP), gm2: await gm2.eval(MAP) };
    const c5Heard = { gm: await gm.eval(HEARD), gm2: await gm2.eval(HEARD) };
    const withoutCue = map => { const next = { ...map }; delete next[KC]; return J(Object.entries(next).sort()); };
    check("C5: the drop at ready with its defaults: gm2, not the primary, writes nothing; gm, the primary, takes the cue playlist's mapping out with one write, every other key kept on both browsers (Q-E50-1, E50-23, G8)",
        Boolean(KC) && c5Before.gm[KC] === c5Setup.cue && c5Before.gm2[KC] === c5Setup.cue
            && J(c5Drop.gm2) === J([]) && J(c5Drop.gm) === J([KC]) && !(KC in c5Maps.gm) && !(KC in c5Maps.gm2)
            && J(Object.entries(c5Maps.gm).sort()) === withoutCue(c5Before.gm) && J(Object.entries(c5Maps.gm2).sort()) === withoutCue(c5Before.gm2)
            && J(c5Heard.gm) === J(["gm"]) && J(c5Heard.gm2) === J(["gm"]),
        J({ KC, c5Setup, c5Before, c5Drop, c5Maps, c5Heard }));

    // Put back: the map, the switch, the playlists (the cue playlist when C5 made it).
    await gm.eval(`${MU} const was = globalThis.__s87Music; delete globalThis.__s87Music;
        await ST.setSetting(ST.SETTINGS.musicMap, was.map);
        await ST.setSetting(ST.SETTINGS.musicEnabled, was.on);
        const cue = globalThis.__s87Cue; delete globalThis.__s87Cue;
        for (const id of [...${J(c1Setup.made)}, ...(cue ? [cue] : [])]) { const p = game.playlists.get(id); if (p?.playing) await p.stopAll(); await p?.delete(); }
        return true;`, { timeout: 60000 });
    await settle(600);

    const BROWSERS = [["gm", gm], ["gm2", gm2], ["p1", p1], ["p2", p2], ["p3", p3]];
    const onEvery = async code => Object.fromEntries(await Promise.all(BROWSERS.map(async ([who, c]) => [who, await c.eval(code, { timeout: 60000 })])));
    const PLACE = `{ teleport: true, movementAction: "displace", animate: false }`;

    /* ------------------------------ D. the murder music on every account in it ------------------------------ */
    phase("D1: p1's Aiko kills p2's Botan, a murder playlist of 8 tracks; p3's Chie is elsewhere", { flow: "murder-incident" });
    const DMUSIC = `const M = await import("${repoUrl}/scripts/music.mjs"); const S = await import("${repoUrl}/scripts/settings.mjs");`;
    const dSetup = await gm.eval(`${MU}
        globalThis.__s87Murder = { map: ST.getSetting(ST.SETTINGS.musicMap) ?? {} };
        const pl = await Playlist.create({ name: "S87 D the murder playlist",
            sounds: Array.from({ length: 8 }, (_, i) => ({ name: "S87 D track " + (i + 1), path: "sounds/s87-murder-" + (i + 1) + ".ogg" })) });
        await ST.setSetting(ST.SETTINGS.musicMap, { ...(ST.getSetting(ST.SETTINGS.musicMap) ?? {}), murder: pl.id });
        const G = await import("${repoUrl}/scripts/gm-stores.mjs"); await G.castStore.whenHydrated();
        return { playlist: pl.id, tracks: [...pl.sounds].map(s => s.name).sort(), running: Boolean(game.drpg.murderState()?.active) };`, { timeout: 60000 });
    await gm2.eval(`const G = await import("${repoUrl}/scripts/gm-stores.mjs"); await G.castStore.whenHydrated(); return true;`, { timeout: 60000 });
    // Every browser's Music volume at 0.8 for the incident, and what it parked (`musicDuckedFrom`) read before it.
    const dBefore = await onEvery(`const v = { volume: game.settings.get("core", "globalPlaylistVolume"), ducked: game.settings.get("${MOD}", "musicDuckedFrom") };
        globalThis.__s87Volume = v.volume; await game.settings.set("core", "globalPlaylistVolume", 0.8); return v;`);
    await settle(900);
    // The players' windows left unanswered, as 13-murder-signals leaves them; the killer's opening roll held on p1, as 13 holds
    // it, and the GM rules it a success.
    for (const c of [p1, p2, p3]) await c.eval(`globalThis.__s87Auto = globalThis.__dialogAuto; globalThis.__dialogAuto = false; return true;`);
    await p1.eval(`globalThis.__s87Held = [];
        game.actors.get("${IDS.aiko}").rollTrait = function () { return new Promise(r => globalThis.__s87Held.push(r)); }; return true;`);
    const dOpened = await gm.eval(`const opened = (await game.drpg.openMurder({ killerId: "${IDS.aiko}", victimId: "${IDS.botan}", openingTrait: "body" }))?.stage ?? null;
        await game.drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        return { opened, stage: game.drpg.murderState()?.stage ?? null };`, { timeout: 60000 });
    await settle(900);
    /* The opening roll reaches p1 when its invitation lands, which a fixed 900 ms missed once under load (fix FG2's quick
       run, dHeld 0 with every browser on the same track): waited for, up to 4 s. */
    const dHeld = await p1.eval(`${UNTIL} await until(() => (globalThis.__s87Held ?? []).length > 0, 4000);
        delete game.actors.get("${IDS.aiko}").rollTrait; const held = globalThis.__s87Held ?? []; delete globalThis.__s87Held;
        for (const r of held) r(null); return held.length;`);
    const MURDER_HERE = wait => `${DMUSIC} const end = Date.now() + 4000;
        while (${wait ? "!M.murderMusicHere().playing" : "false"} && Date.now() < end) await new Promise(r => setTimeout(r, 100));
        const m = M.murderMusicHere(); return { witness: S.incidentWitness().witness, playing: m.playing, track: m.track, playlist: m.playlist };`;
    await settle(600);
    const d1 = { gm: await gm.eval(MURDER_HERE(true)), gm2: await gm2.eval(MURDER_HERE(true)), p1: await p1.eval(MURDER_HERE(true)),
        p2: await p2.eval(MURDER_HERE(true)), p3: await p3.eval(MURDER_HERE(false)) };
    const inIt = ["gm", "gm2", "p1", "p2"];
    const d1Track = d1.p1.track;
    check("D1: the killer's, the victim's, the primary GM's and the second GM's browsers play the same murder track of the 8; the bystander's plays none (E50-30)",
        dSetup.running === false && dSetup.tracks.length === 8 && dOpened.opened === "openingRoll" && dOpened.stage === "incident" && dHeld === 1
            && dSetup.tracks.includes(d1Track) && inIt.every(k => d1[k].witness === true && d1[k].playing === true && d1[k].track === d1Track)
            && d1.p3.witness === false && d1.p3.playing === false && d1.p3.track === null,
        /* The readings that decide first, the eight track names last (E37 C5b, 01.11.2026): CI's annotation keeps 300
           characters of these details, and three red D1s (FG2's quick run; CI runs 41270613334 and 41354325721) were cut
           inside the track list, so none said which browser did not play: `off` names them. */
        J({ dHeld, dOpened, off: Object.entries(d1).filter(([k, r]) => (inIt.includes(k)
            ? !(r.witness === true && r.playing === true && r.track === d1Track) : !(r.witness === false && r.playing === false && r.track === null)))
            .map(([k]) => k), d1, running: dSetup.running, tracks: dSetup.tracks.length, list: dSetup.tracks }), { flow: "murder-incident" });

    phase("D3: what p1's band names during the incident", { flow: "murder-incident" });
    const d3 = await p1.eval(`${DMUSIC} const was = game.settings.get("core", "globalPlaylistVolume");
        const during = M.nowPlayingHere();
        await game.settings.set("core", "globalPlaylistVolume", 0);
        const silent = M.nowPlayingHere();
        await game.settings.set("core", "globalPlaylistVolume", was);
        return { was, during, silent };`);
    check("D3: on p1 the band under the clock names the murder track during the incident, and nothing at Music 0 (E50-31)",
        d3.was === 0.8 && d3.during?.track === d1Track && d3.during?.playlist === "S87 D the murder playlist" && d3.silent === null,
        J({ d1Track, d3 }), { flow: "murder-incident" });

    /* D4 (fix FG2; the end review's F4, S2, G6): during an incident a player's message is posted by the primary (secret.mjs
       `askGm`), so a send can fail three ways that each say why already, and one of them - no answer in time - may have
       been posted all the same. p1's window, its every toast, and the card.post packets gm is sent held while asked. */
    phase("D4: p1 writes to the GM during the incident - too long, no GM, no answer in time", { flow: "messenger" });
    const D4_WORDS = "S87 D4 a word to the GM in the killing";
    const d4Open = await p1.eval(`${OPEN.replace("return Boolean(app?.rendered);", "")}
        globalThis.__s87Says = []; globalThis.__s87SaysReal = {};
        for (const kind of ["info", "warn", "error"]) {
            const realFn = globalThis.__s87SaysReal[kind] = ui.notifications[kind];
            ui.notifications[kind] = function (text, ...rest) { globalThis.__s87Says.push([kind, String(text)]); return realFn.call(this, text, ...rest); };
        }
        return { open: Boolean(app?.rendered), running: Boolean(game.settings.get("${MOD}", "murderState")?.active),
            tooLong: game.i18n.format("DRPG.Secret.tooLong", { kb: 32 }), noGm: game.i18n.localize("DRPG.Bridge.why.noGm"),
            noAnswer: game.i18n.localize("DRPG.Bridge.why.noAnswer"), failed: game.i18n.localize("DRPG.Messenger.sendFailed"),
            unsure: game.i18n.localize("DRPG.Messenger.sendUnsure") };`, { timeout: 60000 });
    const D4_SEND = words => `${M} ${UNTIL} const words = ${J(words)};
        const app = A.DrpgMessengerApp.instances.get("${P1}");
        const area = app.element.querySelector(".drpg-messenger-input textarea");
        const from = globalThis.__s87Says.length;
        area.value = words;
        app.element.querySelector(".drpg-messenger-input").requestSubmit();
        await new Promise(r => setTimeout(r, 50));
        await until(() => !area.disabled, 20000);
        await new Promise(r => setTimeout(r, 300));
        return { field: area.value === words ? "kept" : area.value, disabled: area.disabled, toasts: globalThis.__s87Says.slice(from) };`;
    const d4Long = await p1.eval(D4_SEND(`S87 D4 ${"x".repeat(33 * 1024)}`), { timeout: 60000 });
    const d4NoGm = await p1.eval(`const gone = game.users.filter(u => u.isGM && u.active);
        for (const u of gone) u._source.active = false;
        try { return { gone: gone.length, ...(await (async () => { ${D4_SEND(D4_WORDS)} })()) }; }
        finally { for (const u of gone) u._source.active = true; }`, { timeout: 60000 });
    // Every card.post packet gm is sent, held until released: the answer misses p1's clock (TIMING.ackMs), the post does not.
    await gm.eval(`const list = game.socket._handlers.get("module.${MOD}") ?? []; const real = [...list];
        globalThis.__s87Card = { real, held: [], packets: 0 };
        list.splice(0, list.length, ...real.map((fn, at) => function (packet, ...rest) {
            const b = globalThis.__s87Card;
            if (packet?.action === "card.post" && b) { if (at === 0) b.packets++; b.held.push(() => fn.call(this, packet, ...rest)); return undefined; }
            return fn.call(this, packet, ...rest);
        }));
        return true;`);
    const d4Late = await p1.eval(D4_SEND(D4_WORDS), { timeout: 60000 });
    const ON_GM = `${M} const S = await import("${repoUrl}/scripts/secret.mjs");
        return M.threadMessages("${P1}").filter(m => S.contentOf(m).includes(${J(D4_WORDS)})).map(m => m.id);`;
    const d4Posted = await gm.eval(`${UNTIL} const b = globalThis.__s87Card; delete globalThis.__s87Card;
        const list = game.socket._handlers.get("module.${MOD}"); if (list && b) list.splice(0, list.length, ...b.real);
        const before = await (async () => { ${ON_GM} })();
        for (const go of b?.held ?? []) await go();
        await until(async () => (await (async () => { ${ON_GM} })()).length > before.length, 8000);
        return { held: b?.packets ?? 0, before, after: await (async () => { ${ON_GM} })() };`, { timeout: 60000 });
    const sayOnly = (toasts, ...texts) => toasts.length === texts.length && texts.every((t, i) => toasts[i]?.[1].includes(t));
    check("D4: during the incident a send that already said why (too long, no GM) says nothing more; one whose answer did not come says it may not have been sent and to look first, and the primary posted it after all; the words stay in the field each time (E50-03; fix FG2, F4, S2, G6)",
        d4Open.open && d4Open.running && d4Open.unsure !== "DRPG.Messenger.sendUnsure"
            && d4Long.field === "kept" && sayOnly(d4Long.toasts, d4Open.tooLong)
            && d4NoGm.gone === 2 && d4NoGm.field === "kept" && sayOnly(d4NoGm.toasts, d4Open.noGm)
            && d4Late.field === "kept" && d4Late.disabled === false && sayOnly(d4Late.toasts, d4Open.noAnswer, d4Open.unsure)
            && !d4Late.toasts.some(([, text]) => text === d4Open.failed)
            && d4Posted.held === 1 && d4Posted.before.length === 0 && d4Posted.after.length === 1,
        J({ d4Open, d4Long: { ...d4Long, toasts: d4Long.toasts.map(([k, t]) => [k, t.slice(0, 80)]) }, d4NoGm, d4Late, d4Posted }), { flow: "messenger" });
    // Put back: p1's toasts and window, and the card the primary posted.
    await p1.eval(`${M} for (const [kind, fn] of Object.entries(globalThis.__s87SaysReal ?? {})) ui.notifications[kind] = fn;
        delete globalThis.__s87SaysReal; delete globalThis.__s87Says;
        await A.DrpgMessengerApp.instances.get("${P1}")?.close(); return true;`);
    await gm.eval(`const ids = await (async () => { ${ON_GM} })(); for (const id of ids) await game.messages.get(id)?.delete(); return ids.length;`, { timeout: 60000 });
    await settle(600);

    phase("D2: p2 moves its Music slider during the incident; the incident ends", { flow: "murder-incident" });
    const d2Move = await p2.eval(`${MU} ${UNTIL} ${SOUND}
        const slider = () => root()?.querySelector('input[name="vol:music"]');
        const was = game.settings.get("core", "globalPlaylistVolume");
        try {
            MU.openSoundDialog();
            await until(() => slider());
            const input = slider();
            if (input) { input.value = "70"; input.dispatchEvent(new Event("input", { bubbles: true })); }
            await until(() => game.settings.get("core", "globalPlaylistVolume") !== was, 3000);
            const moved = game.settings.get("core", "globalPlaylistVolume");
            await closeSound();
            return { was, moved, playing: MU.murderMusicHere().playing };
        } finally { globalThis.__dialogWindows = windows; }`, { timeout: 60000 });
    await gm.eval(`await game.drpg.endMurder({ reason: "suite", followUp: false }); return true;`, { timeout: 60000 });
    await settle(1500);
    const dAfter = await onEvery(`${DMUSIC} return { volume: game.settings.get("core", "globalPlaylistVolume"), ducked: game.settings.get("${MOD}", "musicDuckedFrom"),
        playing: M.murderMusicHere().playing, running: Boolean(game.settings.get("${MOD}", "murderState")?.active) };`);
    check("D2: p2's Music slider moved during the incident is p2's volume after it ends; every other browser keeps 0.8, none writes musicDuckedFrom, and the murder track stops everywhere (E50-31)",
        d2Move.was === 0.8 && d2Move.playing === true && d2Move.moved !== 0.8 && Math.abs(d2Move.moved - 0.7 ** 1.5) < 1e-3
            && dAfter.p2.volume === d2Move.moved && ["gm", "gm2", "p1", "p3"].every(k => dAfter[k].volume === 0.8)
            && BROWSERS.every(([k]) => dAfter[k].ducked === dBefore[k].ducked && dAfter[k].playing === false && dAfter[k].running === false),
        J({ d2Move, dBefore, dAfter }), { flow: "murder-incident" });
    // Put back: every browser's volume, p1's dialogs, the map and the playlist.
    await onEvery(`await game.settings.set("core", "globalPlaylistVolume", globalThis.__s87Volume); delete globalThis.__s87Volume; return true;`);
    for (const c of [p1, p2, p3]) await c.eval(`globalThis.__dialogAuto = globalThis.__s87Auto; delete globalThis.__s87Auto; return true;`);
    await gm.eval(`${MU} const was = globalThis.__s87Murder; delete globalThis.__s87Murder;
        await ST.setSetting(ST.SETTINGS.musicMap, was.map);
        await game.playlists.get(${J(dSetup.playlist)})?.delete();
        return true;`, { timeout: 60000 });
    await settle(600);

    /* ------------------------------ E. the Take on a body ------------------------------ */
    phase("E: Botan dead on a published death, a Tool on him, Aiko beside him; p1 draws his loot window", { flow: "give-take-stash" });
    const LOOT_NAME = "S87 E a body's crowbar";
    const eSetup = await gm.eval(`const C = await import("${repoUrl}/scripts/chapter.mjs"); const INV = await import("${repoUrl}/scripts/inventory.mjs");
        const { sheetAuditIdle } = await import("${repoUrl}/scripts/sheet-audit.mjs"); const { ITEM_CATEGORIES } = await import("${repoUrl}/scripts/config.mjs");
        const scene = canvas.scene, aiko = game.actors.get("${IDS.aiko}"), botan = game.actors.get("${IDS.botan}");
        const tok = scene.tokens.get("TOKAIKO000000000");
        const back = globalThis.__s87Loot = { at: { x: tok.x, y: tok.y }, aikoItems: aiko.items.map(i => i.id), tokens: scene.tokens.map(t => t.id), stowed: [] };
        // A hand of Aiko's free for a Tool (tier 2's handFreeFor): what takes the slot put in her stash, and back after.
        const group = ITEM_CATEGORIES.tool?.limitGroup ?? null, flag = "flags.${MOD}." + INV.ITEM_FLAGS.location;
        const slot = i => { const c = i.getFlag("${MOD}", INV.ITEM_FLAGS.category); return c === "tool" || (group !== null && ITEM_CATEGORIES[c]?.limitGroup === group); };
        if (!INV.canCarry(aiko, "tool").ok) for (const i of aiko.items.filter(i => slot(i) && !INV.isStashed(i))) {
            back.stowed.push([i.id, i.getFlag("${MOD}", INV.ITEM_FLAGS.location) ?? null]); await i.update({ [flag]: INV.LOCATIONS.vault });
        }
        await tok.update({ x: 1500, y: 400 }, ${PLACE});
        const dead = Boolean(await C.killCharacter(botan, { secret: false, keepBullets: true }));
        const item = await INV.grantItem(botan, { name: ${J(LOOT_NAME)}, category: "tool", tier: 1, override: true, quiet: true });
        await sheetAuditIdle();
        // Every body.loot packet this GM is sent, counted; while held, kept until released (the module socket's handlers wrapped).
        const list = game.socket._handlers.get("module.${MOD}") ?? [];
        const real = [...list];
        globalThis.__s87Bridge = { real, n: 0, hold: false, held: [], heldPackets: 0 };
        list.splice(0, list.length, ...real.map((fn, at) => function (packet, ...rest) {
            const b = globalThis.__s87Bridge;
            if (packet?.action === "body.loot") {
                if (at === 0) b.n++;
                if (b.hold) { if (at === 0) b.heldPackets++; b.held.push(() => fn.call(this, packet, ...rest)); return undefined; }
            }
            return fn.call(this, packet, ...rest);
        }));
        return { dead, item: item?.id ?? null, canCarry: INV.canCarry(aiko, "tool").ok, stowed: back.stowed.length, room: (await import("${repoUrl}/scripts/movement.mjs")).locateActor?.(aiko)?.room ?? null };`, { timeout: 60000 });
    const LOOT_ITEM = eSetup.item;
    // p1's page: the body's loot window drawn into the page (anonymity.mjs buildBodyLoot, the viewer's own character the taker), and every toast.
    const eDrawn = await p1.eval(`${UNTIL} const A = await import("${repoUrl}/scripts/anonymity.mjs"); const S = await import("${repoUrl}/scripts/settings.mjs");
        const body = game.actors.get("${IDS.botan}");
        await until(() => S.isDeadForGm(body) && body.items.has(${J(LOOT_ITEM)}));
        globalThis.__s87Toasts = []; globalThis.__s87Real = {};
        for (const kind of ["info", "warn", "error"]) {
            const realFn = globalThis.__s87Real[kind] = ui.notifications[kind];
            ui.notifications[kind] = function (text, ...rest) { globalThis.__s87Toasts.push([kind, String(text)]); return realFn.call(this, text, ...rest); };
        }
        const root = document.createElement("div"); root.id = "s87-loot";
        root.innerHTML = '<a data-tab="inventory"></a><section class="tab" data-tab="inventory"></section>';
        document.body.append(root);
        await A.buildBodyLoot(root, body);
        await new Promise(r => setTimeout(r, 200));
        const take = [...root.querySelectorAll(".drpg-loot-list li")].find(li => li.textContent.includes(${J(LOOT_NAME)}))?.querySelector(".drpg-loot-take");
        return { take: take ? [take.disabled, take.dataset.tooltip ?? ""] : null, open: game.i18n.localize("DRPG.Loot.takeTooltip") };`, { timeout: 60000 });
    // The Take's state, its opens and shuts since the last click (a MutationObserver on `disabled`), and the toasts since.
    const TAKE = `const take = [...document.querySelectorAll("#s87-loot .drpg-loot-list li")].find(li => li.textContent.includes(${J(LOOT_NAME)}))?.querySelector(".drpg-loot-take") ?? null;`;
    const CLICK = `${TAKE} globalThis.__s87Flips = []; globalThis.__s87Seen?.disconnect();
        globalThis.__s87Seen = new MutationObserver(records => { for (const r of records) if (r.attributeName === "disabled") globalThis.__s87Flips.push(r.oldValue === null ? "shut" : "open"); });
        if (take) globalThis.__s87Seen.observe(take, { attributes: true, attributeOldValue: true, attributeFilter: ["disabled"] });
        globalThis.__s87From = globalThis.__s87Toasts.length;
        const was = take ? [take.disabled, take.dataset.tooltip ?? ""] : null;
        take?.click();
        return was;`;
    const AFTER = `${TAKE} await new Promise(r => setTimeout(r, 50));
        return { take: take ? [take.disabled, take.dataset.tooltip ?? ""] : null, flips: [...globalThis.__s87Flips], toasts: globalThis.__s87Toasts.slice(globalThis.__s87From),
            onBody: game.actors.get("${IDS.botan}").items.has(${J(LOOT_ITEM)}) };`;
    const WORDS_E = await p1.eval(`return { took: game.i18n.format("DRPG.Loot.took", { item: ${J(LOOT_NAME)} }), notThere: game.i18n.localize("DRPG.Bridge.why.notThere"),
        noGm: game.i18n.localize("DRPG.Bridge.why.noGm"), open: game.i18n.localize("DRPG.Loot.takeTooltip") };`);
    const tookToasts = toasts => toasts.filter(([kind, text]) => kind === "info" && text === WORDS_E.took).length;

    phase("E1: p1 presses Take; Aiko walks out of the room before the primary judges it", { flow: "give-take-stash" });
    const loots = () => gm.eval(`return globalThis.__s87Bridge.n;`);
    const e1Loots = await loots();
    await gm.eval(`globalThis.__s87Bridge.hold = true; return true;`);
    const e1Was = await p1.eval(CLICK);
    const e1Held = await gm.eval(`${UNTIL} await until(() => globalThis.__s87Bridge.heldPackets > 0, 4000);
        await canvas.scene.tokens.get("TOKAIKO000000000").update(globalThis.__s87Loot.at, ${PLACE});
        const b = globalThis.__s87Bridge; b.hold = false; const held = b.held.splice(0); for (const go of held) await go();
        return globalThis.__s87Bridge.heldPackets;`, { timeout: 60000 });
    const e1 = await p1.eval(`${UNTIL} ${TAKE} await until(() => (take?.dataset.tooltip ?? "") === ${J(WORDS_E.notThere)} && globalThis.__s87Toasts.length > globalThis.__s87From, 4000);
        await new Promise(r => setTimeout(r, 300)); ${AFTER.replace(TAKE, "")}`, { timeout: 60000 });
    const e1Gm = { loots: (await loots()) - e1Loots, onBody: await gm.eval(`return game.actors.get("${IDS.botan}").items.has(${J(LOOT_ITEM)});`) };
    check("E1: a Take the primary refuses (the taker gone from the body's room) shows no \"took\" toast, opens and is shut again by the gate with the reason's sentence, and the Tool stays on the body (S11-36, E50-32)",
        eSetup.dead && Boolean(LOOT_ITEM) && eSetup.room === "Cafeteria" && eSetup.canCarry && J(eDrawn.take) === J([false, WORDS_E.open]) && J(e1Was) === J([false, WORDS_E.open]) && e1Held === 1
            && tookToasts(e1.toasts) === 0 && e1.toasts.some(([, text]) => text.includes(WORDS_E.notThere))
            && e1.flips.includes("open") && J(e1.take) === J([true, WORDS_E.notThere]) && e1.onBody === true && e1Gm.onBody === true && e1Gm.loots === 1,
        J({ eSetup, eDrawn, e1Was, e1Held, e1, e1Gm }), { flow: "give-take-stash" });

    phase("E2: Aiko back beside the body; p1 presses Take with both GMs gone from p1's page", { flow: "give-take-stash" });
    await gm.eval(`await canvas.scene.tokens.get("TOKAIKO000000000").update({ x: 1500, y: 400 }, ${PLACE}); return true;`, { timeout: 60000 });
    const e2Ready = await p1.eval(`${UNTIL} ${TAKE} await until(() => take && !take.disabled, 4000); return take ? [take.disabled, take.dataset.tooltip ?? ""] : null;`);
    const e2Loots = await loots();
    // gm and gm2 stood in as gone on p1's page alone (as client-entry.mjs marks a user who left), and put back after.
    const e2 = await p1.eval(`${UNTIL} const gone = game.users.filter(u => u.isGM && u.active);
        for (const u of gone) u._source.active = false;
        try {
            const was = await (async () => { ${CLICK} })();
            ${TAKE}
            await until(() => take && !take.disabled && globalThis.__s87Toasts.length > globalThis.__s87From, 4000);
            await new Promise(r => setTimeout(r, 300));
            return { was, gone: gone.length, ...(await (async () => { ${AFTER} })()) };
        } finally { for (const u of gone) u._source.active = true; }`, { timeout: 60000 });
    const e2Gm = { loots: (await loots()) - e2Loots, onBody: await gm.eval(`return game.actors.get("${IDS.botan}").items.has(${J(LOOT_ITEM)});`) };
    check("E2: a Take with no GM to answer it shows no \"took\" toast, says no GM is connected, and opens again as the gate reads it; nothing reached the primary (E50-32)",
        J(e2Ready) === J([false, WORDS_E.open]) && e2.gone === 2 && J(e2.was) === J([false, WORDS_E.open])
            && tookToasts(e2.toasts) === 0 && e2.toasts.filter(([, text]) => text.includes(WORDS_E.noGm)).length === 1
            && e2.flips.includes("open") && J(e2.take) === J([false, WORDS_E.open]) && e2.onBody === true && e2Gm.onBody === true && e2Gm.loots === 0,
        J({ e2Ready, e2, e2Gm }), { flow: "give-take-stash" });

    /* E4 (fix FG2; the end review's G4): the Take with no character, as the player handbook says it ("or you play no
       character - says only why, and opens again"). p1's page answers no character of its own for the one synchronous
       read the click makes (anonymity.mjs `myCharacter`: `game.actors.filter`, then `game.user.character`), put back
       before anything else runs; the list's taker, read when it was drawn, is still Aiko, so the gate opens it again. */
    phase("E4: p1 presses Take while p1's page reads no character of its own", { flow: "give-take-stash" });
    const e4Loots = await loots();
    const e4 = await p1.eval(`${UNTIL} const user = game.user, actors = game.actors;
        const hadFilter = Object.getOwnPropertyDescriptor(actors, "filter"), hadChar = Object.getOwnPropertyDescriptor(user, "character");
        let was = null;
        Object.defineProperty(actors, "filter", { configurable: true, writable: true, value: () => [] });
        Object.defineProperty(user, "character", { configurable: true, get: () => null });
        try { was = (() => { ${CLICK} })(); }
        finally {
            if (hadFilter) Object.defineProperty(actors, "filter", hadFilter); else delete actors.filter;
            if (hadChar) Object.defineProperty(user, "character", hadChar); else delete user.character;
        }
        ${TAKE}
        await until(() => take && !take.disabled && globalThis.__s87Toasts.length > globalThis.__s87From, 4000);
        await new Promise(r => setTimeout(r, 300));
        return { was, taken: take?.dataset.drpgTaken ?? null, ownAgain: Boolean(user.character), ...(await (async () => { ${AFTER} })()) };`, { timeout: 60000 });
    const e4Gm = { loots: (await loots()) - e4Loots, onBody: await gm.eval(`return game.actors.get("${IDS.botan}").items.has(${J(LOOT_ITEM)});`) };
    const NO_CHARACTER = await p1.eval(`return game.i18n.localize("DRPG.Loot.noCharacter");`);
    check("E4: a Take with no character of the viewer's own says only why, once, shows no \"took\" toast, and opens again; nothing reached the primary (E50-32; fix FG2, G4)",
        J(e4.was) === J([false, WORDS_E.open]) && NO_CHARACTER !== "DRPG.Loot.noCharacter" && J(e4.toasts) === J([["warn", NO_CHARACTER]])
            && e4.flips.includes("shut") && e4.flips.includes("open") && J(e4.take) === J([false, WORDS_E.open]) && e4.taken === null && e4.ownAgain
            && e4.onBody === true && e4Gm.onBody === true && e4Gm.loots === 0,
        J({ e4, e4Gm }), { flow: "give-take-stash" });

    phase("E3: p1 presses Take, and again", { flow: "give-take-stash" });
    const e3Loots = await loots();
    const e3Was = await p1.eval(CLICK);
    const e3 = await p1.eval(`${UNTIL} await until(() => globalThis.__s87Toasts.length > globalThis.__s87From, 6000);
        ${TAKE} take?.click();
        await new Promise(r => setTimeout(r, 1200)); ${AFTER.replace(TAKE, "")}`, { timeout: 60000 });
    const e3Gm = { loots: (await loots()) - e3Loots,
        where: await gm.eval(`return { body: game.actors.get("${IDS.botan}").items.has(${J(LOOT_ITEM)}), taker: game.actors.get("${IDS.aiko}").items.some(i => i.name === ${J(LOOT_NAME)}) };`) };
    check("E3: a Take that lands says so once and stays shut, a second press sends nothing, and the Tool leaves the body for the taker (E50-32)",
        J(e3Was) === J([false, WORDS_E.open]) && tookToasts(e3.toasts) === 1 && e3.toasts.length === 1 && e3.take?.[0] === true && !e3.flips.includes("open")
            && e3.onBody === false && e3Gm.loots === 1 && e3Gm.where.body === false && e3Gm.where.taker === true,
        J({ e3Was, e3, e3Gm }), { flow: "give-take-stash" });
    // Put back: p1's page, the GM's socket, Botan alive, what Aiko took and its trace, her place and her stashed things.
    await p1.eval(`globalThis.__s87Seen?.disconnect(); delete globalThis.__s87Seen; delete globalThis.__s87Flips; delete globalThis.__s87From;
        for (const [kind, fn] of Object.entries(globalThis.__s87Real ?? {})) ui.notifications[kind] = fn;
        delete globalThis.__s87Real; delete globalThis.__s87Toasts; document.getElementById("s87-loot")?.remove(); return true;`);
    await gm.eval(`const C = await import("${repoUrl}/scripts/chapter.mjs"); const { sheetAuditIdle } = await import("${repoUrl}/scripts/sheet-audit.mjs");
        const b = globalThis.__s87Bridge; delete globalThis.__s87Bridge;
        const list = game.socket._handlers.get("module.${MOD}"); if (list && b) list.splice(0, list.length, ...b.real);
        const back = globalThis.__s87Loot; delete globalThis.__s87Loot;
        const scene = canvas.scene, aiko = game.actors.get("${IDS.aiko}"), botan = game.actors.get("${IDS.botan}");
        if (C.isDeadForGm(botan)) await C.reviveCharacter(botan, { quiet: true });
        for (const i of [...aiko.items].filter(i => !back.aikoItems.includes(i.id))) await i.delete();
        for (const i of [...botan.items].filter(i => i.name === ${J(LOOT_NAME)})) await i.delete();
        for (const t of [...scene.tokens].filter(t => !back.tokens.includes(t.id))) await t.delete();
        for (const [id, was] of back.stowed) await aiko.items.get(id)?.update({ ["flags.${MOD}.location"]: was ?? (await import("${repoUrl}/scripts/utils.mjs")).forcedDeletion() });
        await scene.tokens.get("TOKAIKO000000000").update(back.at, ${PLACE});
        await sheetAuditIdle();
        return true;`, { timeout: 60000 });
    await settle(900);

    /* ------------------------------ S. a sound played for another browser ------------------------------ */
    phase("S: gm plays a sound for p1 alone; p2 forges one", { flow: "sound" });
    const SFX = `const SFX = await import("${repoUrl}/scripts/sfx.mjs"); const ST = await import("${repoUrl}/scripts/settings.mjs");`;
    const SFX_KEY = "newRule";
    const sSetup = await gm.eval(`${SFX} globalThis.__s87Sfx = ST.getSetting(ST.SETTINGS.sfxMap) ?? {};
        await SFX.setSoundFor("${SFX_KEY}", "sounds/s87-a-sound.ogg"); return { was: globalThis.__s87Sfx, now: ST.getSetting(ST.SETTINGS.sfxMap) };`, { timeout: 60000 });
    // Sound above 0 on every browser (`fire` plays nothing at 0, and the counter counts a play only), put back after.
    const sVolumes = await onEvery(`${SFX} globalThis.__s87SfxVolumes = foundry.utils.deepClone(ST.getSetting(ST.SETTINGS.sfxVolumes) ?? {});
        await SFX.setSfxVolume("sound", 0.8); return SFX.sfxVolume("sound");`);
    await settle(900);
    const PLAYED = `const C = await import("${repoUrl}/scripts/perf-counters.mjs"); return C.snapshot()["sfx.played"] ?? 0;`;
    const played = () => onEvery(PLAYED);
    const delta = (after, before) => Object.fromEntries(BROWSERS.map(([k]) => [k, after[k] - before[k]]));
    const s1Before = await played();
    const s1Mapped = await p1.eval(`${SFX} return SFX.soundFor("${SFX_KEY}");`);
    await gm.eval(`${SFX} SFX.playSfxForUsers(["${P1}"], "${SFX_KEY}"); return true;`);
    await settle(900);
    const s1 = delta(await played(), s1Before);
    check("S1: a GM's sound for p1 plays on p1's browser alone (sfx.played: 1 on p1, 0 on gm, gm2, p2 and p3; E50-33)",
        s1Mapped === "sounds/s87-a-sound.ogg" && BROWSERS.every(([k]) => sVolumes[k] === 0.8) && J(s1) === J({ gm: 0, gm2: 0, p1: 1, p2: 0, p3: 0 }),
        J({ sSetup, sVolumes, s1Mapped, s1Before, s1 }), { flow: "sound" });
    const s2Before = await played();
    // p2's page sends what only a GM may: one packet addressed to p1, one to every browser with no user named.
    await p2.eval(`game.socket.emit("module.${MOD}", { action: "playSfxFor", key: "${SFX_KEY}", userId: "${P1}" }, { recipients: ["${P1}"] });
        game.socket.emit("module.${MOD}", { action: "playSfxFor", key: "${SFX_KEY}" }); return true;`);
    await settle(900);
    const s2 = delta(await played(), s2Before);
    check("S2: a player's forged playSfxFor packets, to p1 and to everybody, play nothing on any browser (E50-33)",
        J(s2) === J({ gm: 0, gm2: 0, p1: 0, p2: 0, p3: 0 }), J({ s2Before, s2 }), { flow: "sound" });
    await onEvery(`${SFX} await ST.setSetting(ST.SETTINGS.sfxVolumes, globalThis.__s87SfxVolumes); delete globalThis.__s87SfxVolumes; return true;`);
    await gm.eval(`${SFX} await ST.setSetting(ST.SETTINGS.sfxMap, globalThis.__s87Sfx); delete globalThis.__s87Sfx; return true;`, { timeout: 60000 });
    await settle(600);
}
