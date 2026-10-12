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
 * players, each of a chat card marked deleted. C7 and C8 add the window and the corner badge.
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
   and S came between, so the rise is not B's alone and was not split by phase). Still well inside 60 s, so it stays. */
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

export async function run({ gm, p2, p4, check, phase, settle, connect, disconnect, storageOf, IDS, repoUrl }) {
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
}
