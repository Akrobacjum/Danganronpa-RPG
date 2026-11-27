/**
 * 58-case-two-gms: the investigation, the trial and the chapter's end at a table of two full GMs and the players
 * (2.0 line T3, 27.11.2026; docs/dev/v2/LINE-T3.md, decision D2-27). Whichever full GM presses a button, the same thing
 * happens, and a refusal tells its real reason to the GM who pressed.
 *
 * The seed's GM and three players, and `gm2`, a second Gamemaster declared late whose id sorts after the seed GM's, so
 * the seed GM stays the primary while both are connected (utils.mjs `primaryGmId`), as in 97-two-gms. Every check reads
 * something the run made happen first, and says so in its own condition. Each part is named by the line's item it
 * measures.
 *
 * Parts, in the order they run:
 *   TRIAL-02  gm2 presses Finish the chapter's end with no end stopped: the primary refuses with
 *             `DRPG.Chapter.notStopped`, and that reason is a toast on gm2's screen, none on gm's.
 *
 * What this cannot see: a real server's delivery times and a real F5 (97-two-gms's header says what its `reload` is).
 */
export const layers = ["ci"];

export const accounts = [
    { who: "gm2", id: "USERGM2T3C580000", name: "Second GM", role: 4, character: null, color: "#66aaff", late: true }
];

const J = value => JSON.stringify(value);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Poll `read` until `done(value)` or `ms` pass; the last reading either way. */
async function until(read, done, ms = 6000, step = 150) {
    const end = Date.now() + ms;
    let value = await read();
    while (!done(value) && Date.now() < end) {
        await wait(step);
        value = await read();
    }
    return value;
}

export async function run(api) {
    const { gm, gm2, check, phase, settle, connect, primaryOn, repoUrl: REPO, IDS } = api;
    const imp = file => `await import("${REPO}/scripts/${file}")`;
    const GM2 = accounts[0].id;
    const allRead = (on, id) => Object.keys(on).length >= 5 && Object.values(on).every(v => v === id);
    const toastsSince = (who, mark) => who.eval(`return globalThis.__notifications.slice(${mark}).map(n => [n.level, n.msg]);`);
    const toastMark = who => who.eval(`return globalThis.__notifications.length;`);

    phase("0 gm2 joins");
    await connect("gm2");
    const joined = await until(primaryOn, on => Object.keys(on).length === 5);
    check("0: gm2, whose id sorts after the seed GM's, joins and every client reads the seed GM as the primary",
        GM2 > IDS.gm && allRead(joined, IDS.gm), J(joined));
    await settle(1000);

    /* ------------------------------------------------------------- TRIAL-02 */
    phase("TRIAL-02 a relayed refusal says its reason to the GM who pressed");
    const notStopped = await gm2.eval(`return game.i18n.localize("DRPG.Chapter.notStopped");`);
    const stoppedNow = await gm.eval(`const C = ${imp("chapter.mjs")}; return Boolean(C.chapterEndStopped());`);
    const [m1, m2] = [await toastMark(gm), await toastMark(gm2)];
    const finished = await gm2.eval(`const C = ${imp("chapter.mjs")}; return await C.finishChapterEnd() ?? null;`, { timeout: 60000 });
    await settle(800);
    const onGm2 = await toastsSince(gm2, m2), onGm = await toastsSince(gm, m1);
    check("TRIAL-02: gm2's Finish the chapter's end with no end stopped is refused on the primary, and gm2 is shown why (DRPG.Chapter.notStopped); the primary shows no toast",
        stoppedNow === false && finished === null && onGm2.some(([level, msg]) => level === "warn" && msg === notStopped)
            && onGm.length === 0, J({ stoppedNow, finished, onGm2, onGm }));
}
