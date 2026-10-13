/**
 * A player's notice history after F5, and the GM's own diet (E81 C3, 12.10.2026; the A7 plan's 2.2).
 *
 * The history is the browser's, so the suite - which runs on the GM alone - cannot read it on a player:
 * this does, on four clients. A (C3): a player is shown three cards - one whispered to an owner (the
 * owner and the GMs), an announcement for everybody and a veiled card with words for that player alone
 * - closes the announcement with its X and leaves the other two on screen; the page goes as a reload
 * takes it, after the history's 400 ms write; and the same browser, back, holds all three: the one
 * closed read, the two it never closed unread, the veiled card's words kept. Another player's browser
 * holds the announcement and nothing of the first player's cards, and the GM's holds the announcement
 * alone - a whisper of a record and a veiled card without the GM among its readers are no card on a
 * GM's screen (popup.mjs `onCreateChatMessage`), and so nothing kept. S (C4): a player calls the safeword
 * with a GM connected; the GM's detail card - who called it, and where - is a safeword entry in the GM's
 * stored value, which is what a reload reads back (the owner's Q7: kept like every other notice), and in no
 * player's; the public card is one safeword entry of the same words on the GM, the caller and another
 * player. N (C4): a request not carried out - `murder.cleanup` with nothing spent, kept like the rest
 * (the owner's Q4) - is one notDone entry, read, of the toast's words in that player's stored value and
 * in nobody else's. B (C5): three cards whispered to a player; one deleted with the module's withdraw option
 * (as `undoLastCrisis` and `retireOpeningNotices` delete) leaves that player's history and screen, one deleted
 * without it leaves the screen and stays, unread and marked deleted; one deleted while the player's page was
 * closed is marked deleted when the page is back (the log read at `ready`); and the GM's Clear chat
 * (`deleteDocuments([], { deleteAll: true })`, the option taken out before the hook as Foundry 14.365 does by
 * the design's reading - the harness's shim mirrors it, LIVE-E81-11 at a table) leaves every entry on two
 * players, each of a chat card marked deleted. C (C7): the same player opens the history's window - the
 * unread banner counts what the history holds unread, the entries stand newest first, and expanding every
 * one draws no card, starts no sound, sends no chat message and moves no messenger badge; closed, the
 * window has read them all, in memory and as stored. D (C8): the GM whispers the same player one more card; while
 * it is on screen it is no unread notice, so the tile's corner button - its last child - carries no badge, and
 * pressing it opens the window once and closes no card. The page goes with the card on it, and back, the button
 * says "1" in its badge and its name - the one unread notice, because phase C read every other one - and shows
 * none of its words; pressed, one window, and closed, no badge. G3 (E81 fix r1-G3): a player's own cards - one
 * deleted with the withdraw option, two updated with `settled` and `rerolled`, a private one whose meta they send
 * again with both - move nothing in the GM's history or another player's but the plain deletion's mark, while a
 * GM's update and a GM's meta still mark. S3 (E81 fix r2-H1, review round 2's S3): with no GM connected a player
 * calls the safeword; the caller posts the card, another player keeps it under the caller's id, and that player's
 * window draws the entry with no user's name and no time (the window's tag skips a safeword entry's author). H (E77
 * fix r2-H4), run before S3 because it needs the GM: the GM starts an Eclipse and ends it with the clock moved; on the
 * GM and on p1 the window's foot holds Clear and no prose, each announcement's row is titled by its card's heading and
 * says the time of day once, and the Eclipse's entry, opened, shows its words once. E77 fix r2-H7: the Eclipse's group
 * is named for the time of day it opened into, and H4 runs a second Eclipse from Night, whose group names the next day.
 * E77 fix r2-H8: H5 reads every group heading of that window - no "·" can start a line.
 *
 * THE PLAYER WHO RELOADS IS A LATE ACCOUNT, `p4`, not p1 as the plan wrote it: the seeded four cannot
 * connect again (cluster.mjs `connect`), and a reload is a disconnect and a connect with the storage the
 * page left (`storageOf`). The harness fires no `pagehide` when it ends a client, so the write the
 * history makes on the page's way out is not what is measured here - the debounced one is, which is why
 * the page waits past it (LIVE-E81-03 is the F5 right after a card, at a table).
 */
export const layers = ["ci"];
/* Measured alone on 12.10.2026 (C3's phase A, two runs): 11.5 and 11.7 s from the cluster's start to its end, the checks
   7.3 s of it (A5 waits to 4.5 s after the cards were posted, for the veiled card's words p2 never gets). A fifth of
   run-all's shared five minutes, stated so that C5, C7 and C8, which add phases here, raise it with a reading of their own.
   C5's phase B (12.10.2026, alone, once): 22.4 s from start to end by the results file, the checks 16.4 s of it (phases N
   and S came between, so the rise is not B's alone and was not split by phase). Still well inside 60 s, so it stays.
   C7's phase C (12.10.2026, alone, once): 21.9 s from start to end by the results file, the checks 17.5 s of it - no
   more than C5's reading, so a run's spread is larger than phase C, which was not timed apart. It stays.
   C8's phase D (12.10.2026, alone, once): 31.3 s from start to end by the results file, the checks 22.6 s of it - 5.1 s
   more checks than C7's reading, from one run each and not timed apart by phase. Still inside 60 s, so it stays.
   E81 fix r1-G3's phase G3 (12.10.2026, alone, once): 26.5 s from start to end by the results file, the checks 17.9 s
   of it. It stays.
   E81 fix r2-H1's phase S3 (13.10.2026, alone, once): 28.8 s from start to end by the results file, the checks 24.7 s
   of it - the phase disconnects the GM and waits on the caller's own card. Still inside 60 s, so it stays.
   E77 fix r2-H4's phase H (13.10.2026, alone, once, its final form): the cluster's own line read "27/27 checks passed,
   0 failed in 29940ms", 35 s by the wall clock with the cluster's start - the Eclipse started and ended and two windows
   opened, not timed apart by phase. Still inside 60 s, so it stays.
   E77 fix r2-H7's H4 (13.10.2026, alone, once): "28/28 checks passed, 0 failed in 31530ms"; in a2.sh's fast set beside
   two other lanes 36157ms. Still inside 60 s. */
export const timeoutMs = 60000;

export const accounts = [{ who: "p4", id: "USERP4000000000A", name: "Player Four", role: 1, character: null, color: "#2a7f62", late: true }];

const MOD = "danganronpa-rpg";
const KEY = `${MOD}.noticeHistory`;
const J = value => JSON.stringify(value);

const WORDS = { owner: "S73 owner card words", announcement: "S73 announcement words", veiled: "S73 veiled words" };

/** One browser's kept notices, from its stored value: `[label, state, source]` for each S73 card, in the order kept. */
function storedNotices(storage, sectionKey) {
    if (typeof storage?.[KEY] !== "string") return null;
    return storedEntries(storage, sectionKey).map(entry => [label(entry.text), entry.state, entry.source]);
}

const label = text => Object.keys(WORDS).find(key => String(text ?? "").includes(WORDS[key])) ?? `other: ${String(text ?? "").slice(0, 60)}`;

/** One browser's stored sections, as written: `{}` for a browser that wrote none. */
function storedSections(storage) {
    const raw = storage?.[KEY];
    if (typeof raw !== "string") return {};
    let value = JSON.parse(raw);
    if (typeof value === "string") value = JSON.parse(value);
    return value?.sections ?? {};
}

/** One browser's stored entries of one section, as written: `[]` for a section that is not there. */
function storedEntries(storage, sectionKey) {
    return storedSections(storage)[sectionKey]?.entries ?? [];
}

export async function run({ gm, p1, p2, p4, check, phase, settle, connect, disconnect, storageOf, IDS, repoUrl }) {
    phase("A: a player's history after a reload, another player's and the GM's");
    const P4 = accounts[0].id;
    const UNTIL = `const until = async (test, ms = 8000) => { const end = Date.now() + ms; while (!test() && Date.now() < end) await new Promise(r => setTimeout(r, 100)); return test(); };`;
    const readHistory = `const NH = await import("${repoUrl}/scripts/notice-history.mjs");
        return { world: game.world.id, user: game.user.id, entries: NH.noticeEntries().map(e => ({ text: e.text, state: e.state, source: e.source, html: e.html })) };`;

    await connect("p4");
    const gmBefore = await gm.eval(readHistory);
    await gm.eval(`await game.actors.get("${IDS.daichi}").update({ ownership: { "${P4}": 3 } }); return true;`);
    try {
        const posted = await gm.eval(`const U = await import("${repoUrl}/scripts/utils.mjs");
            const daichi = game.actors.get("${IDS.daichi}");
            const owner = await U.whisperToOwner(daichi, "<p>${WORDS.owner}</p>");
            const announcement = await U.announce({ content: "<p>${WORDS.announcement}</p>" });
            const veiled = await U.announce({ content: "<p>${WORDS.veiled}</p>", whisper: ["${P4}"], veiled: true });
            return { owner: owner?.id ?? null, announcement: announcement?.id ?? null, veiled: veiled?.id ?? null, at: Date.now() };`);
        check("A0: the GM posted the three cards", Boolean(posted.owner && posted.announcement && posted.veiled), J(posted));

        const shown = await p4.eval(`${UNTIL}
            const cards = () => [...document.querySelectorAll(".drpg-popup .drpg-popup-body")].map(b => b.textContent);
            const all = await until(() => ${J(Object.values(WORDS))}.every(w => cards().some(t => t.includes(w))));
            const card = [...document.querySelectorAll(".drpg-popup")].find(c => c.textContent.includes("${WORDS.announcement}"));
            card?.querySelector(".drpg-popup-close")?.click();
            return { all, cards: cards().filter(t => t.includes("S73")), closed: Boolean(card) };`);
        check("A1: the player is shown the three cards and closes the announcement with its X", shown.all && shown.closed, J(shown));

        // Past the history's 400 ms write (notice-history.mjs DEBOUNCE_MS) before the page goes.
        await settle(800);
        await disconnect("p4");
        const left = await storageOf("p4");
        const leftKept = storedNotices(left, `${gmBefore.world}.${P4}`);
        check("A2: the page that went had written its three notices: the announcement read, the two on screen open",
            J([...(leftKept ?? [])].sort()) === J([["announcement", "read", "public"], ["owner", "open", "mine"], ["veiled", "open", "mine"]]),
            J(leftKept));

        await connect("p4", { storage: left });
        const back = await p4.eval(readHistory);
        const backKept = back.entries.map(e => [label(e.text), e.state, e.source]);
        check("A3: back after the reload, the same browser holds the three: the one closed read, the two never closed unread",
            backKept.length === 3 && J([...backKept].sort()) === J([["announcement", "read", "public"], ["owner", "unread", "mine"], ["veiled", "unread", "mine"]]),
            J(backKept));
        check("A4: the veiled card's words are kept", back.entries.some(e => e.text.includes(WORDS.veiled) && e.html.includes(WORDS.veiled)), J(back.entries.map(e => e.text)));

        // A veiled card waits up to 4 s for its words on every client it was whispered to (secret.mjs `wordsOf`).
        await settle(Math.max(0, posted.at + 4500 - Date.now()));
        const other = await p2.eval(readHistory);
        const otherStored = await storageOf("p2");
        check("A5: another player keeps the announcement and nothing of the first player's cards",
            J(other.entries.map(e => [label(e.text), e.source])) === J([["announcement", "public"]])
                && ![WORDS.owner, WORDS.veiled].some(w => String(otherStored?.[KEY] ?? "").includes(w)),
            J({ entries: other.entries.map(e => e.text), stored: String(otherStored?.[KEY] ?? "").length }));
        const gmAfter = await gm.eval(readHistory);
        const gmNew = gmAfter.entries.slice(gmBefore.entries.length).map(e => [label(e.text), e.source]);
        check("A6: the GM keeps the announcement alone - neither the owner's whisper nor the veiled card",
            J(gmNew) === J([["announcement", "public"]]) && gmAfter.entries.length === gmBefore.entries.length + 1,
            J({ before: gmBefore.entries.length, new: gmNew }));
    } finally {
        await gm.eval(`await game.actors.get("${IDS.daichi}").update({ ownership: { "${P4}": 0 } }); return true;`);
    }

    phase("S: the safeword - the GM's detail kept in the GM's browser alone, the public card the same on every one");
    const ROOM = "S73 safeword room";
    const bannerOf = `const NH = await import("${repoUrl}/scripts/notice-history.mjs");
        const banner = game.i18n.localize("DRPG.Safeword.banner");
        return { user: game.user.id, world: game.world.id, kept: NH.noticeEntries().filter(e => e.title === banner).map(e => [e.source, e.text, e.html]) };`;
    try {
        // A player's press with a GM connected: the packet to the GM, the GM's detail card and its public card (safeword.mjs).
        const called = await p2.eval(`const S = await import("${repoUrl}/scripts/safeword.mjs"); return await S.callSafeword({ room: "${ROOM}" });`, { timeout: 30000 });
        // Past the history's 400 ms write on the GM and on the players the card reached.
        await settle(1500);
        const [gmBanner, p2Banner, p4Banner] = [await gm.eval(bannerOf), await p2.eval(bannerOf), await p4.eval(bannerOf)];
        const stored = { gm: await storageOf("gm"), p2: await storageOf("p2"), p4: await storageOf("p4") };
        const detail = storedEntries(stored.gm, `${gmBanner.world}.${gmBanner.user}`).filter(e => String(e.text).includes(ROOM)).map(e => [e.source, e.kind]);
        const onPlayers = ["p2", "p4"].filter(who => String(stored[who]?.[KEY] ?? "").includes(ROOM));
        check("S1: the GM's safeword detail is one safeword entry in the GM's stored value - there after a reload - and in no player's",
            called === true && J(detail) === J([["safeword", "error"]]) && onPlayers.length === 0,
            J({ called, detail, onPlayers }));
        const banners = [gmBanner, p2Banner, p4Banner].map(b => b.kept);
        check("S2: the public safeword card is one safeword entry of the same words on the GM, on the caller and on another player",
            banners.every(kept => kept.length === 1 && kept[0][0] === "safeword") && new Set(banners.map(kept => J(kept))).size === 1,
            J(banners));
    } finally {
        // The table is unpaused and every card of the press taken down, as the scenario found the screens.
        await gm.eval(`if (game.paused) game.togglePause(false, { broadcast: true }); return true;`);
        for (const client of [gm, p2, p4]) {
            await client.eval(`const titles = [game.i18n.localize("DRPG.Safeword.banner"), game.i18n.localize("DRPG.Safeword.gmTitle")];
                for (const card of document.querySelectorAll(".drpg-popup")) {
                    if (titles.includes(card.querySelector(".drpg-popup-title")?.firstChild?.textContent)) card.dispatchEvent(new CustomEvent("drpg-dismiss", { detail: { instant: true } }));
                }
                return true;`);
        }
    }

    phase("N: a request not carried out - kept in the asker's stored value, and in nobody else's");
    // The toast's own notify is a test's: the words, the entry and the write are `sayNotDone`'s whoever shows them.
    const said = await p2.eval(`const B = await import("${repoUrl}/scripts/bridge-guards.mjs");
        return { user: game.user.id, world: game.world.id, text: B.sayNotDone("murder.cleanup", "noGm", { nothingSpent: true, notify: () => {} }) };`);
    await settle(1500);
    const kept = { gm: await storageOf("gm"), p2: await storageOf("p2"), p4: await storageOf("p4") };
    const notDone = storedEntries(kept.p2, `${said.world}.${said.user}`).filter(e => e.source === "notDone").map(e => [e.kind, e.state, e.text === said.text]);
    const elsewhere = ["gm", "p4"].filter(who => Object.keys(storedSections(kept[who])).some(key => storedEntries(kept[who], key).some(e => e.text === said.text)));
    check("N1: murder.cleanup not carried out is one notDone entry, read, of the toast's words in the asker's stored value - there after a reload - and in nobody else's",
        typeof said.text === "string" && said.text.length > 0 && J(notDone) === J([["error", "read", true]]) && elsewhere.length === 0,
        J({ said: said.text, notDone, elsewhere }));

    phase("B: a card the module takes back leaves the history; any other deletion, one while the page was closed and a cleared log leave the entry, marked");
    const GONE = { withdrawn: "S73 withdrawn words", deleted: "S73 deleted words", away: "S73 away words" };
    const which = text => Object.keys(GONE).find(key => String(text ?? "").includes(GONE[key])) ?? null;
    const readMarks = `const NH = await import("${repoUrl}/scripts/notice-history.mjs");
        return { user: game.user.id, world: game.world.id, entries: NH.noticeEntries().map(e => ({ text: e.text, state: e.state, mark: e.mark, messageId: e.messageId })) };`;
    const gone = entries => Object.fromEntries(entries.filter(e => which(e.text)).map(e => [which(e.text), [e.state, e.mark]]));
    const sent = await gm.eval(`const U = await import("${repoUrl}/scripts/utils.mjs");
        const out = {};
        for (const [key, words] of Object.entries(${J(GONE)})) out[key] = (await U.announce({ content: "<p>" + words + "</p>", whisper: ["${P4}"] }))?.id ?? null;
        return out;`);
    const onScreen = `${UNTIL}
        const shown = key => [...document.querySelectorAll(".drpg-popup:not(.leaving) .drpg-popup-body")].some(b => b.textContent.includes(${J(GONE)}[key]));`;
    const drawn = await p4.eval(`${onScreen} return await until(() => ["withdrawn", "deleted", "away"].every(shown));`);
    check("B0: the GM whispered the player three cards and the player is shown them", Object.values(sent).every(Boolean) && drawn === true, J({ sent, drawn }));

    // The module's own withdraw, as undoLastCrisis and retireOpeningNotices delete; and a deletion without it.
    await gm.eval(`await game.messages.get("${sent.withdrawn}")?.delete({ "${MOD}": { withdraw: true } });
        await game.messages.get("${sent.deleted}")?.delete();
        return true;`);
    const afterDelete = await p4.eval(`${onScreen}
        const NH = await import("${repoUrl}/scripts/notice-history.mjs");
        const has = words => NH.noticeEntries().some(e => e.text.includes(words));
        await until(() => !has(${J(GONE.withdrawn)}) && NH.noticeEntries().some(e => e.text.includes(${J(GONE.deleted)}) && e.mark === "deleted") && !shown("withdrawn") && !shown("deleted"));
        return { shown: ["withdrawn", "deleted", "away"].filter(shown) };`);
    const marked1 = gone((await p4.eval(readMarks)).entries);
    check("B1: the withdrawn card is gone from the player's history and screen; the one deleted without the option leaves the screen and stays, unread and marked deleted",
        J(marked1) === J({ deleted: ["unread", "deleted"], away: ["open", null] }) && J(afterDelete.shown) === J(["away"]),
        J({ marked1, afterDelete }));

    // Past the history's 400 ms write; the card deleted while the page is closed is told by the log at `ready`.
    await settle(800);
    await disconnect("p4");
    const closedAt = await storageOf("p4");
    await gm.eval(`await game.messages.get("${sent.away}")?.delete(); return true;`);
    await connect("p4", { storage: closedAt });
    const marked2 = gone((await p4.eval(readMarks)).entries);
    check("B2: back after a reload, a card deleted while the page was closed is marked deleted, the deleted one still is and the withdrawn one did not come back",
        J(marked2) === J({ deleted: ["unread", "deleted"], away: ["unread", "deleted"] }), J(marked2));

    // The GM's Clear chat: Foundry's `deleteDocuments([], { deleteAll: true })`, the option taken out before the hook.
    const before = { p4: await p4.eval(readMarks), p2: await p2.eval(readMarks) };
    await p4.eval(`globalThis.__s73Options = []; Hooks.on("deleteChatMessage", (m, options) => globalThis.__s73Options.push(Object.keys(options ?? {}).sort().join()));
        return true;`);
    const cleared = await gm.eval(`await ChatMessage.deleteDocuments([], { deleteAll: true }); return game.messages.size;`);
    await settle(1500);
    const after = { p4: await p4.eval(readMarks), p2: await p2.eval(readMarks) };
    const options = await p4.eval(`return globalThis.__s73Options;`);
    const stored = { p4: await storageOf("p4"), p2: await storageOf("p2") };
    const unmarked = who => after[who].entries.filter(e => e.messageId !== null && e.mark !== "deleted").length;
    const storedUnmarked = who => storedEntries(stored[who], `${after[who].world}.${after[who].user}`).filter(e => e.messageId !== null && e.mark !== "deleted").length;
    check("B3: the GM clears the log - every entry stays on both players, each of a chat card marked deleted, in memory and as stored; the hook was never handed deleteAll",
        cleared === 0 && ["p4", "p2"].every(who => after[who].entries.length === before[who].entries.length && after[who].entries.some(e => e.messageId !== null)
            && unmarked(who) === 0 && storedUnmarked(who) === 0)
        && options.length > 0 && !options.some(keys => keys.split(",").includes("deleteAll")),
        J({ cleared, count: ["p4", "p2"].map(who => [before[who].entries.length, after[who].entries.length]), unmarked: ["p4", "p2"].map(unmarked),
            stored: ["p4", "p2"].map(storedUnmarked), options: [...new Set(options)] }));

    phase("C: the player opens the history - the unread banner, newest first, and nothing shown again");
    const opened = await p4.eval(`${UNTIL}
        const NH = await import("${repoUrl}/scripts/notice-history.mjs");
        const U = await import("${repoUrl}/scripts/utils.mjs");
        const page = () => ({ cards: document.querySelectorAll(".drpg-popup").length,
            badges: [...document.querySelectorAll(".drpg-messenger-badge")].map(b => b.textContent).join() });
        const before = page(), plays = [], undo = [];
        for (const [owner, name] of [[foundry.audio?.AudioHelper, "play"], [foundry.audio?.Sound?.prototype, "play"], [globalThis.HTMLMediaElement?.prototype, "play"]]) {
            if (typeof owner?.[name] !== "function") continue;
            const own = Object.hasOwn(owner, name), original = owner[name];
            owner[name] = function (...args) { plays.push(name); return original.apply(this, args); };
            undo.push(() => { if (own) owner[name] = original; else delete owner[name]; });
        }
        let created = 0;
        const hook = Hooks.on("preCreateChatMessage", () => { created++; });
        try {
            const entries = NH.noticeEntries();
            const unread = entries.filter(e => e.state === "unread").length;
            // Without the window (HEAD) every check below fails rather than the scenario throwing.
            const win = await game.drpg.openNotices?.();
            const root = win?.element;
            const banner = root?.querySelector(".drpg-notices-banner");
            const listed = [...(root?.querySelectorAll("details.drpg-notice-entry") ?? [])];
            for (const details of listed) details.open = true;
            const expanded = await until(() => listed.every(d => d.querySelector(".drpg-notice-more")), 3000);
            const out = {
                unread, banner: [banner?.hidden ?? null, banner?.querySelector("span")?.textContent === U.plural("DRPG.Notices.unreadBanner", { n: unread })],
                newestFirst: JSON.stringify(listed.map(d => d.dataset.drpgKey)) === JSON.stringify(entries.map(e => e.id).reverse()),
                count: [entries.length, listed.length], expanded, inWindow: root?.querySelectorAll(".drpg-popup").length ?? -1
            };
            await win?.close();
            return { ...out, page: [before, page()], plays, created, unreadAfter: NH.noticeEntries().filter(e => e.state === "unread").length };
        } finally {
            Hooks.off("preCreateChatMessage", hook);
            for (const put of undo) put();
        }`);
    check("C1: the player opens the history - the banner counts the history's unread notices, every entry listed, newest first",
        opened.unread > 0 && J(opened.banner) === J([false, true]) && opened.newestFirst && opened.count[0] === opened.count[1] && opened.count[0] > 0,
        J({ unread: opened.unread, banner: opened.banner, newestFirst: opened.newestFirst, count: opened.count }));
    check("C2: expanding every entry shows nothing again - no card drawn, on the page or in the window, no sound, no chat message, the messenger's badges as they were",
        opened.expanded && opened.inWindow === 0 && J(opened.page[0]) === J(opened.page[1]) && opened.plays.length === 0 && opened.created === 0,
        J({ expanded: opened.expanded, inWindow: opened.inWindow, page: opened.page, plays: opened.plays, created: opened.created }));
    // Past the history's 400 ms write.
    await settle(800);
    const read = await storageOf("p4");
    const storedUnread = storedEntries(read, `${gmBefore.world}.${P4}`).filter(e => e.state === "unread").length;
    check("C3: closed, the window has read every notice - none unread in memory or as stored",
        opened.unreadAfter === 0 && storedUnread === 0 && storedEntries(read, `${gmBefore.world}.${P4}`).length === opened.count[0],
        J({ unreadAfter: opened.unreadAfter, storedUnread }));

    phase("D: the tile's corner button - no badge for a card on screen, '1' after the reload, one window, and no card closed");
    const BADGE = "S73 badge words";
    const windows = `const windows = () => document.querySelectorAll(".drpg-window-notices").length;
        const theWindow = () => [...foundry.applications.instances.values()].find(app => app.options?.classes?.includes("drpg-window-notices")) ?? null;`;
    const corner = `const host = document.getElementById("drpg-popups"), button = document.getElementById("drpg-notices-corner");
        const at = () => ({ last: Boolean(button) && host?.lastElementChild === button, buttons: document.querySelectorAll("#drpg-notices-corner").length,
            badge: button?.dataset.unread ?? null, name: button?.getAttribute("aria-label") ?? null, words: String(button?.outerHTML ?? "").includes(${J(BADGE)}) });`;
    const whispered = await gm.eval(`const U = await import("${repoUrl}/scripts/utils.mjs");
        return (await U.announce({ content: "<p>${BADGE}</p>", whisper: ["${P4}"] }))?.id ?? null;`);
    const pressed = await p4.eval(`${UNTIL} ${windows}
        const NH = await import("${repoUrl}/scripts/notice-history.mjs");
        const card = () => [...document.querySelectorAll(".drpg-popup:not(.leaving)")].find(c => c.textContent.includes(${J(BADGE)})) ?? null;
        const shown = await until(() => card() !== null);
        ${corner}
        const before = { ...at(), titled: button?.getAttribute("aria-label") === game.i18n.localize("DRPG.Notices.title"), unread: NH.noticeUnread?.() ?? null };
        button?.click();
        const opened = await until(() => windows() === 1, 3000);
        button?.click();
        await new Promise(r => setTimeout(r, 300));
        const out = { shown, before, opened, windows: windows(), card: card() !== null, after: at() };
        await theWindow()?.close();
        return out;`);
    check("D1: a card on screen is no unread notice: the tile's button, its last child, carries no badge; pressed twice it opens one window and closes no card",
        Boolean(whispered) && pressed.shown && J({ ...pressed.before, name: null }) === J({ last: true, buttons: 1, badge: null, name: null, words: false, titled: true, unread: 0 })
            && pressed.opened && pressed.windows === 1 && pressed.card && pressed.after.last,
        J({ whispered: Boolean(whispered), ...pressed }));

    // Past the history's 400 ms write, with the card still on screen: it goes with the page as unread.
    await settle(800);
    await disconnect("p4");
    const badgeLeft = await storageOf("p4");
    await connect("p4", { storage: badgeLeft });
    const back2 = await p4.eval(`${UNTIL} ${windows}
        const NH = await import("${repoUrl}/scripts/notice-history.mjs");
        const U = await import("${repoUrl}/scripts/utils.mjs");
        ${corner}
        const reached = await until(() => at().badge !== null, 4000);
        const out = { reached, back: { ...at(), unread: NH.noticeUnread?.() ?? null }, expected: U.plural("DRPG.Notices.buttonUnread", { n: 1 }),
            cards: [...document.querySelectorAll(".drpg-popup")].filter(c => c.textContent.includes(${J(BADGE)})).length };
        button?.click();
        out.opened = await until(() => windows() === 1, 3000);
        button?.click();
        await new Promise(r => setTimeout(r, 300));
        out.windows = windows();
        await theWindow()?.close();
        out.closed = { ...at(), unread: NH.noticeUnread?.() ?? null };
        return out;`);
    check("D2: back after the reload, the tile's last child is its button, badged '1' and named for one unread notice, none of the card's words on it",
        back2.reached && J(back2.back) === J({ last: true, buttons: 1, badge: "1", name: back2.expected, words: false, unread: 1 }) && back2.cards === 0,
        J({ reached: back2.reached, back: back2.back, cards: back2.cards }));
    check("D3: pressed, the button opens one window, and the window closed takes the badge away",
        back2.opened && back2.windows === 1 && back2.closed.badge === null && back2.closed.unread === 0 && back2.closed.last,
        J({ opened: back2.opened, windows: back2.windows, closed: back2.closed }));

    phase("G3: only a GM rewrites what a kept entry says about a card - a player's withdraw, update and meta mark nobody's history");
    /* E81 fix r1-G3 (12.10.2026; review round 1's O13, O14 and F2, which the security review measured on these
       roads in the harness at 0697d0f): the withdraw option was honoured from any deleter, and a mark read off
       the card whoever wrote it. A player's deletion with the option is now any deletion - the entry stays,
       marked deleted - and only a GM's update or a GM's meta marks. Whether Foundry 14 lets a player delete or
       update a message they wrote is not measured here: the harness lets them, and the rule holds either way. */
    const G3 = { withdrawn: "S73 G3 withdrawn words", settled: "S73 G3 settled words", rerolled: "S73 G3 rerolled words",
        ruled: "S73 G3 ruled words", meta: "S73 G3 meta words" };
    const users = { gm: await gm.eval(`return game.user.id;`), p2: await p2.eval(`return game.user.id;`) };
    const marksOf = `${UNTIL}
        const NH = await import("${repoUrl}/scripts/notice-history.mjs");
        const marks = () => Object.fromEntries(Object.entries(${J(G3)}).map(([key, words]) => [key, NH.noticeEntries().filter(e => e.text.includes(words)).map(e => e.mark ?? null)]));`;
    const g3 = await p1.eval(`const U = await import("${repoUrl}/scripts/utils.mjs");
        const out = {};
        for (const key of ["withdrawn", "settled", "rerolled", "ruled"]) out[key] = (await U.announce({ content: "<p>" + ${J(G3)}[key] + "</p>" }))?.id ?? null;
        out.meta = (await U.announce({ content: "<p>${G3.meta}</p>", whisper: ["${users.p2}", "${users.gm}"] }))?.id ?? null;
        return out;`);
    const heldBefore = {
        gm: await gm.eval(`${marksOf} await until(() => ["withdrawn", "settled", "rerolled", "ruled"].every(key => marks()[key].length === 1)); return marks();`),
        p2: await p2.eval(`${marksOf} await until(() => Object.values(marks()).every(list => list.length === 1)); return marks();`)
    };
    // The GM is among the private card's readers too; whether a GM's screen draws it is the catch-all's (part A), not asked here.
    const publicOf = marks => ({ withdrawn: marks.withdrawn, settled: marks.settled, rerolled: marks.rerolled, ruled: marks.ruled });
    check("G3a: a player's four public cards are kept on the GM and another player, and the private one on its reader, none marked",
        Object.values(g3).every(Boolean) && J(publicOf(heldBefore.gm)) === J({ withdrawn: [null], settled: [null], rerolled: [null], ruled: [null] })
            && J(heldBefore.p2) === J({ withdrawn: [null], settled: [null], rerolled: [null], ruled: [null], meta: [null] }),
        J({ g3, heldBefore }));

    // The player's own writes: the withdraw option, the two marks on the document and both in the private card's meta.
    const wrote = await p1.eval(`const S = await import("${repoUrl}/scripts/secret.mjs");
        const ids = ${J(g3)};
        try {
            await game.messages.get(ids.withdrawn).delete({ "${MOD}": { withdraw: true } });
            await game.messages.get(ids.settled).update({ "flags.${MOD}.settled": true });
            await game.messages.get(ids.rerolled).update({ "flags.${MOD}.rerolled": { from: 3, to: 19, tone: "hope", at: Date.now() } });
            // Words of its own: the author is not among the card's readers, so this browser holds none of them to send again.
            await S.updateSecret(game.messages.get(ids.meta), "<p>${G3.meta} again</p>", null, { settled: true, rerolled: { from: 2, to: 12, tone: "hope", at: Date.now() } });
            return { ok: true, gone: !game.messages.has(ids.withdrawn) };
        } catch (err) { return { error: String(err?.message ?? err) }; }`);
    // A GM's own update of a player's card, the road `settleCall` takes on a card that is not private.
    await gm.eval(`await game.messages.get("${g3.ruled}")?.update({ "flags.${MOD}.settled": true }); return true;`);
    const ruledSeen = `await until(() => marks().ruled[0] === "settled" && marks().withdrawn[0] === "deleted");`;
    await settle(1500);
    const heldAfter = { gm: await gm.eval(`${marksOf} ${ruledSeen} return marks();`), p2: await p2.eval(`${marksOf} ${ruledSeen} return marks();`) };
    // That the player's meta arrived at all: its reader holds the words it came with (a check that it was not refused for its form).
    const delivered = await p2.eval(`const S = await import("${repoUrl}/scripts/secret.mjs");
        return String(S.secretHtml(game.messages.get("${g3.meta}")) ?? "").includes("${G3.meta} again");`);
    check("G3b: the player's withdraw leaves the entry marked deleted, their settled, rerolled and meta mark nothing - on the GM and another player; a GM's update marks",
        wrote?.ok === true && wrote.gone === true && delivered === true
            && J(publicOf(heldAfter.gm)) === J({ withdrawn: ["deleted"], settled: [null], rerolled: [null], ruled: ["settled"] })
            && J(heldAfter.p2) === J({ withdrawn: ["deleted"], settled: [null], rerolled: [null], ruled: ["settled"], meta: [null] }),
        J({ wrote, delivered, heldAfter }));

    // A GM's meta on the same private card, as `markReplacedCard` sends a Reroll's mark: the road is still open to a GM.
    await gm.eval(`const S = await import("${repoUrl}/scripts/secret.mjs");
        const card = game.messages.get("${g3.meta}");
        await S.updateSecret(card, S.secretHtml(card), null, { rerolled: { from: 2, to: 12, tone: "hope", at: Date.now() } });
        return true;`);
    const metaMarked = await p2.eval(`${marksOf} await until(() => marks().meta[0] === "rerolled"); return marks().meta;`);
    check("G3c: a GM's meta on the private card marks its reader's entry rerolled", J(metaMarked) === J(["rerolled"]), J(metaMarked));

    phase("H: an Eclipse and the time of day after it, read again in the history's window on the GM and a player");
    /* E77 fix r2-H4 (13.10.2026; the owner's screenshot of 1.2.75's window, GM view, and his answers of the same day).
       The GM starts an Eclipse and ends it with the clock moved (eclipse.mjs `startEclipse`, `endEclipse`), which posts
       the two announcements of the screenshot; the GM and p1 each open their window. H1: the foot holds Clear and no
       prose - the line that saving stopped is hidden while the history saves. H2: each of the two rows is titled by its
       card's heading, its text without that heading, and the time of day's row says its time of day once. H3: opened,
       the Eclipse's entry shows its sentence and its name once each, not on the row and again in the card.
       E77 fix r2-H7 (13.10.2026; the owner, shown H4's shots with "Noon Eclipse" under "... Morning · ECLIPSE", chose
       the change): the Eclipse's group names the clock the Eclipse opened into, read here as the clock after it ended
       with the Eclipse's mark, and the time of day after it stands in a group of its own (H2; red at 22a1eb9, where the
       group read the clock the notice came under). H4 does the same from Night, where the clock it opens into is the
       next day and session. */
    const hBefore = { gm: await gm.eval(`const NH = await import("${repoUrl}/scripts/notice-history.mjs"); return NH.noticeEntries().map(e => e.id);`),
        p1: await p1.eval(`const NH = await import("${repoUrl}/scripts/notice-history.mjs"); return NH.noticeEntries().map(e => e.id);`) };
    const hRan = await gm.eval(`const E = await import("${repoUrl}/scripts/eclipse.mjs");
        const C = await import("${repoUrl}/scripts/clock.mjs");
        const started = Boolean(await E.startEclipse());
        const name = E.eclipseLabel(), during = C.getClock();
        await E.endEclipse();
        const after = C.getClock();
        return { started, name, during: [during.timeOfDay, during.eclipse], ended: !E.isEclipse(), time: C.timeOfDayLabel(after.timeOfDay),
            opened: { chapter: after.chapter, day: after.day, session: after.session, timeOfDay: after.timeOfDay, eclipse: after.eclipse } };`, { timeout: 90000 });
    const hRead = earlier => `${UNTIL}
        const NH = await import("${repoUrl}/scripts/notice-history.mjs");
        const C = await import("${repoUrl}/scripts/clock.mjs");
        const E = await import("${repoUrl}/scripts/eclipse.mjs");
        const earlier = new Set(${J(earlier)});
        const heading = e => new DOMParser().parseFromString(e.html, "text/html").querySelector("h1, h2, h3, h4, h5, h6")?.textContent.trim() ?? null;
        const find = words => NH.noticeEntries().find(e => !earlier.has(e.id) && e.source === "public" && heading(e) === words) ?? null;
        await until(() => find(${J(hRan.name)}) && find(${J(hRan.time)}));
        const eclipse = find(${J(hRan.name)}), time = find(${J(hRan.time)});
        const sentence = eclipse ? new DOMParser().parseFromString(eclipse.html, "text/html").querySelector("p")?.textContent.replace(/\\s+/g, " ").trim() ?? "" : "";
        const visible = node => {
            let out = "";
            const walk = n => {
                if (n.nodeType === Node.TEXT_NODE) { out += n.textContent + " "; return; }
                if (n.nodeType === Node.ELEMENT_NODE && n.hidden) return;
                for (const child of n.childNodes) walk(child);
            };
            if (node) walk(node);
            return out.replace(/\\s+/g, " ").trim();
        };
        const times = (text, words) => words ? text.split(words).length - 1 : -1;
        const win = await game.drpg.openNotices();
        const root = win?.element;
        try {
            const row = entry => {
                const details = entry ? root?.querySelector(\`details.drpg-notice-entry[data-drpg-key="\${CSS.escape(entry.id)}"]\`) : null;
                if (!details) return null;
                let group = details.previousElementSibling;
                while (group && !group.matches(".drpg-notices-group")) group = group.previousElementSibling;
                const title = details.querySelector(":scope > summary > .drpg-notice-title")?.textContent ?? null;
                const text = details.querySelector(":scope > summary > .drpg-notice-text")?.textContent ?? "";
                return { details, title, text, group: group?.textContent.replace(/\u00a0/g, " ") ?? null };
            };
            const foot = root?.querySelector(".drpg-notices-foot");
            const clear = foot?.querySelector('[data-drpg-do="clear"]');
            const footWords = visible(foot).replace(clear?.textContent ?? "", "").trim();
            const e = row(eclipse), t = row(time);
            const rows = {
                eclipse: e && { title: e.title, startsWithTitle: e.text.startsWith(e.title), group: e.group,
                    opensInto: C.clockSummary({ ...${J(hRan.opened)}, eclipse: true }), named: E.eclipseLabel(eclipse.clock), atEclipse: eclipse.clock.eclipse },
                time: t && { title: t.title, startsWithTitle: t.text.startsWith(t.title), said: times(\`\${t.title} \${t.text}\`, ${J(hRan.time)}), row: \`\${t.title} | \${t.text}\`,
                    group: t.group, opened: C.clockSummary(${J(hRan.opened)}) }
            };
            let open = null;
            if (e) {
                e.details.open = true;
                await until(() => e.details.querySelector(".drpg-notice-more"), 3000);
                const shown = visible(e.details);
                open = { sentence: times(shown, sentence), name: times(shown, ${J(hRan.name)}), shown: shown.slice(0, 400) };
                // The list drawn again with the entry open (what a new notice does when the reader is not in the list).
                win.redraw();
                const again = row(eclipse)?.details;
                await until(() => again?.open && again.querySelector(".drpg-notice-more"), 3000);
                const redrawn = visible(again);
                open.redrawn = [again !== e.details, times(redrawn, sentence), times(redrawn, ${J(hRan.name)})];
                (again ?? e.details).open = false;
                await until(() => !(again ?? e.details).querySelector(":scope > summary > .drpg-notice-text")?.hidden, 1000);
                open.closedText = visible((again ?? e.details).querySelector(":scope > summary")).includes(sentence);
            }
            return { found: [Boolean(eclipse), Boolean(time)], sentence, foot: { words: footWords, clear: Boolean(clear), unsaved: foot?.querySelector(".drpg-notices-unsaved")?.hidden ?? null }, rows, open };
        } finally {
            await win?.close();
            for (const card of document.querySelectorAll(".drpg-popup")) card.dispatchEvent(new CustomEvent("drpg-dismiss", { detail: { instant: true } }));
        }`;
    const hSeen = { gm: await gm.eval(hRead(hBefore.gm)), p1: await p1.eval(hRead(hBefore.p1)) };
    const hBoth = test => ["gm", "p1"].every(who => hSeen[who] && test(hSeen[who]));
    check("H1: the window's foot holds Clear and no prose on how the history keeps a notice, on the GM and on a player - the line that saving stopped hidden while it saves",
        hRan.started && hRan.ended && hBoth(seen => J(seen.found) === J([true, true]) && seen.foot.words === "" && seen.foot.clear && seen.foot.unsaved === true),
        J({ ran: hRan, foot: { gm: hSeen.gm?.foot, p1: hSeen.p1?.foot } }));
    check("H2: an untitled card's row is titled by its heading and its text does not start with it - the Eclipse's in a group named for the time of day it opened into, the time of day's in its own group saying its time of day once",
        hBoth(({ rows: { eclipse, time } }) => eclipse !== null && time !== null
            && eclipse.title === hRan.name && !eclipse.startsWithTitle && eclipse.group === eclipse.opensInto && eclipse.atEclipse === true && eclipse.named === hRan.name
            && time.title === hRan.time && !time.startsWithTitle && time.said === 1 && time.group === time.opened && time.group !== eclipse.group),
        J({ ran: hRan, rows: { gm: hSeen.gm?.rows, p1: hSeen.p1?.rows } }));
    check("H3: opened, the Eclipse's entry shows its sentence and its name once each - not on the row and again in the card - also once the list is drawn again, and closed, the row's text is back",
        hBoth(({ open, sentence }) => sentence.length > 0 && open !== null && open.sentence === 1 && open.name === 1
            && J(open.redrawn) === J([true, 1, 1]) && open.closedText === true),
        J({ gm: hSeen.gm?.open, p1: hSeen.p1?.open, sentence: hSeen.gm?.sentence }));

    // H4 (E77 fix r2-H7): an Eclipse begun at Night opens into the next day's Morning, a new session - its group says so;
    // its two notices (the Eclipse's card and one more) under that one heading.
    const nBefore = { gm: await gm.eval(`const NH = await import("${repoUrl}/scripts/notice-history.mjs"); return NH.noticeEntries().map(e => e.id);`),
        p1: await p1.eval(`const NH = await import("${repoUrl}/scripts/notice-history.mjs"); return NH.noticeEntries().map(e => e.id);`) };
    const nRan = await gm.eval(`const E = await import("${repoUrl}/scripts/eclipse.mjs");
        const C = await import("${repoUrl}/scripts/clock.mjs");
        await C.setClock({ timeOfDay: "night" });
        const before = C.getClock();
        const started = Boolean(await E.startEclipse());
        const name = E.eclipseLabel();
        // A second notice inside the same Eclipse, and time for every client to keep it before the clock moves.
        const U = await import("${repoUrl}/scripts/utils.mjs");
        await U.announce({ content: "<p>H4: a second notice while the lights are out</p>" });
        await new Promise(r => setTimeout(r, 1000));
        await E.endEclipse();
        const after = C.getClock();
        return { started, name, ended: !E.isEclipse(), time: C.timeOfDayLabel(after.timeOfDay), before: [before.timeOfDay, before.day, before.session],
            opened: { chapter: after.chapter, day: after.day, session: after.session, timeOfDay: after.timeOfDay, eclipse: after.eclipse } };`, { timeout: 90000 });
    const nRead = earlier => `${UNTIL}
        const NH = await import("${repoUrl}/scripts/notice-history.mjs");
        const C = await import("${repoUrl}/scripts/clock.mjs");
        const earlier = new Set(${J(earlier)});
        const heading = e => new DOMParser().parseFromString(e.html, "text/html").querySelector("h1, h2, h3, h4, h5, h6")?.textContent.trim() ?? null;
        const fresh = () => NH.noticeEntries().filter(e => !earlier.has(e.id));
        const find = words => fresh().find(e => e.source === "public" && heading(e) === words) ?? null;
        await until(() => find(${J(nRan.name)}) && find(${J(nRan.time)}));
        const during = fresh().filter(e => e.clock.eclipse === true), time = find(${J(nRan.time)});
        const win = await game.drpg.openNotices();
        const root = win?.element;
        try {
            const groupOf = entry => {
                let group = entry ? root?.querySelector(\`details.drpg-notice-entry[data-drpg-key="\${CSS.escape(entry.id)}"]\`) : null;
                while (group && !group.matches(".drpg-notices-group")) group = group.previousElementSibling;
                return group ?? null;
            };
            const groups = during.map(groupOf), after = groupOf(time);
            const words = node => node?.textContent.replace(/\u00a0/g, " ") ?? null;
            return { during: during.length, one: groups.length > 0 && !groups.includes(null) && new Set(groups).size === 1,
                group: words(groups[0]), opensInto: C.clockSummary({ ...${J(nRan.opened)}, eclipse: true }),
                after: words(after), opened: C.clockSummary(${J(nRan.opened)}), apart: Boolean(after) && after !== groups[0],
                headings: [...(root?.querySelectorAll(".drpg-notices-group") ?? [])].map(node => node.textContent) };
        } finally {
            await win?.close();
            for (const card of document.querySelectorAll(".drpg-popup")) card.dispatchEvent(new CustomEvent("drpg-dismiss", { detail: { instant: true } }));
        }`;
    const nSeen = { gm: await gm.eval(nRead(nBefore.gm)), p1: await p1.eval(nRead(nBefore.p1)) };
    check("H4: an Eclipse begun at Night stands in one group, both its notices, named for the next day's session and time of day it opened into, and the time of day after it in a group of its own, on the GM and on a player",
        nRan.started && nRan.ended && nRan.before[0] === "night" && nRan.opened.day === nRan.before[1] + 1
            && ["gm", "p1"].every(who => nSeen[who] && nSeen[who].during >= 2 && nSeen[who].one && nSeen[who].group === nSeen[who].opensInto
                && nSeen[who].after === nSeen[who].opened && nSeen[who].apart),
        J({ ran: nRan, gm: nSeen.gm, p1: nSeen.p1 }));
    /* H5 (E77 fix r2-H8, 13.10.2026; the orchestrator, reading H7's shots: "... SESSION 1 · NOON" wrapped over "· ECLIPSE").
       The harness lays nothing out, so the heading's text is read instead of its lines: before each "·" a no-break space
       (no break opportunity there), after it an ordinary space (the line may still break after the dot). Every group
       heading of the window H4 opened, at least the Eclipse's and the time of day's after it. H2 and H4 compare the
       heading's words with `clockSummary`'s, so they read it with each no-break space put back as a space (the two
       `replace(/\u00a0/g, " ")` above). Red at 0dc9232, where every space in the heading was ordinary. */
    const keepsSeparators = heading => (heading.match(/·/g) ?? []).length > 0
        && (heading.match(/·/g) ?? []).length === (heading.match(/\u00a0· /g) ?? []).length;
    check("H5: no group heading of the history can start a line with its separator - each \"·\" follows a no-break space and is followed by a space - on the GM and on a player",
        ["gm", "p1"].every(who => nSeen[who] && nSeen[who].headings.length >= 2 && nSeen[who].headings.every(keepsSeparators)),
        J({ gm: nSeen.gm?.headings, p1: nSeen.p1?.headings }));

    phase("S3: the safeword with no GM connected - the caller's own card names nobody in another player's history window");
    /* E81 fix r2-H1 (13.10.2026; review round 2's C2-1, which the correctness review measured in the harness at eefa79f:
       p1's window tagged the entry "PlayerTwo"). With no GM connected the caller posts the public card itself
       (safeword.mjs `safewordPoster`), so the card's author is that player and the entry stores it for the per-author
       bound - and the window drew it as a tag. Here the stored author is read as the precondition, and the entry as drawn
       must carry the caller's name nowhere: not in its text, not in an attribute, and no time either (the A7 design's
       P4-0). Last on purpose: a seeded account cannot connect again (cluster.mjs `connect`), so the GM stays away. */
    const s3caller = await p2.eval(`return { id: game.user.id, name: game.user.name };`);
    // Phase S's public card is a safeword entry on p1 too: only an entry kept after this line is read.
    const s3earlier = await p1.eval(`const NH = await import("${repoUrl}/scripts/notice-history.mjs"); return NH.noticeEntries().map(e => e.id);`);
    await disconnect("gm");
    await settle(1500);
    const s3pressed = await p2.eval(`const S = await import("${repoUrl}/scripts/safeword.mjs");
        return { poster: S.safewordPoster(), called: await S.callSafeword({ room: "S73 S3 room" }) };`, { timeout: 40000 });
    const s3drawn = await p1.eval(`${UNTIL}
        const NH = await import("${repoUrl}/scripts/notice-history.mjs");
        const banner = game.i18n.localize("DRPG.Safeword.banner");
        const earlier = new Set(${J(s3earlier)});
        const mine = () => NH.noticeEntries().filter(e => e.source === "safeword" && e.title === banner && !earlier.has(e.id));
        await until(() => mine().length > 0);
        const kept = mine().map(e => ({ id: e.id, author: e.author ?? null }));
        const win = await game.drpg.openNotices();
        const rows = [];
        try {
            for (const { id } of kept) {
                const summary = win?.element?.querySelector(\`details.drpg-notice-entry[data-drpg-key="\${CSS.escape(id)}"] > summary\`);
                if (!summary) { rows.push(null); continue; }
                const said = [summary.textContent, ...[summary, ...summary.querySelectorAll("*")].flatMap(node => [...node.attributes].map(a => a.value))].join("\\n");
                rows.push({ tags: [...summary.querySelectorAll(".drpg-notice-tags span")].map(tag => tag.textContent),
                    named: said.includes(${J(s3caller.name)}), time: Boolean(summary.querySelector(".drpg-notice-time")) });
            }
        } finally {
            await win?.close();
            for (const card of document.querySelectorAll(".drpg-popup")) card.dispatchEvent(new CustomEvent("drpg-dismiss", { detail: { instant: true } }));
        }
        return { kept, rows };`);
    await p2.eval(`for (const card of document.querySelectorAll(".drpg-popup")) card.dispatchEvent(new CustomEvent("drpg-dismiss", { detail: { instant: true } })); return true;`);
    check("S3: with no GM connected the caller's safeword card is kept on another player under the caller, and that player's window draws the entry with no user's name and no time",
        s3pressed.poster === "caller" && s3pressed.called === true && s3drawn.kept.length === 1 && s3drawn.kept[0].author === s3caller.id
            && s3drawn.rows.length === 1 && s3drawn.rows[0] !== null && s3drawn.rows[0].named === false && s3drawn.rows[0].time === false,
        J({ caller: s3caller, pressed: s3pressed, drawn: s3drawn }));
}
