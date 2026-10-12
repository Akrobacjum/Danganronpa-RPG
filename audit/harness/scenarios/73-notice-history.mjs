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
 * GM's screen (popup.mjs `onCreateChatMessage`), and so nothing kept. C5, C7 and C8 add the GM's
 * clearing of the log, the window and the corner badge.
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
   run-all's shared five minutes, stated so that C5, C7 and C8, which add phases here, raise it with a reading of their own. */
export const timeoutMs = 60000;

export const accounts = [{ who: "p4", id: "USERP4000000000A", name: "Player Four", role: 1, character: null, color: "#2a7f62", late: true }];

const MOD = "danganronpa-rpg";
const KEY = `${MOD}.noticeHistory`;
const J = value => JSON.stringify(value);

const WORDS = { owner: "S73 owner card words", announcement: "S73 announcement words", veiled: "S73 veiled words" };

/** One browser's kept notices, from its stored value: `[label, state, source]` for each S73 card, in the order kept. */
function storedNotices(storage, sectionKey) {
    const raw = storage?.[KEY];
    if (typeof raw !== "string") return null;
    let value = JSON.parse(raw);
    if (typeof value === "string") value = JSON.parse(value);
    return (value?.sections?.[sectionKey]?.entries ?? []).map(entry => [label(entry.text), entry.state, entry.source]);
}

const label = text => Object.keys(WORDS).find(key => String(text ?? "").includes(WORDS[key])) ?? `other: ${String(text ?? "").slice(0, 60)}`;

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
}
