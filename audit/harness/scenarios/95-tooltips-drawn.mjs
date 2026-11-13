/**
 * E102's tooltips as the windows draw them (REVIEW-E102-code C1, claude/e93 de7aff40; 13.11.2026).
 * ---------------------------------------------------------------------------
 *     node cluster.mjs scenarios/95-tooltips-drawn.mjs        (from audit/harness)
 *
 * The family tests (R4751-R4754, R4761) read where a key sits in its function's source (scripts/tests-tips.mjs). This
 * scenario draws: it opens every window probe 08 opens (probes/08-capture-windows.mjs `WINDOWS`, through its own
 * `capture`: real windows on their client, each other tab pressed, closed unanswered, each row's seed put back), reads
 * every drawn control's tooltip - `data-tooltip`, `data-tooltip-text`, `title` on a button, select, input, textarea,
 * summary, `<a>` or an element with role="tab" - and holds each key of DRAWN to its English words on such a control.
 *
 * DRAWN is the keys the run of 13.11.2026 found drawn, by family. A key a window stops drawing is red; a key found and
 * not in DRAWN is noted (add it). The keys these windows never draw (a window probe 08 does not open, a state it does not
 * build, a card, a sheet) are counted and listed in the evidence as not drawn here: what holds them is their family test
 * and `node tools/check.mjs tooltips`. A key with a placeholder or a plural is not looked for (its words vary).
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { JSDOM } from "jsdom";
import { WINDOWS, capture } from "../probes/08-capture-windows.mjs";

export const layers = ["ci"];

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..", "..");

/** The keys this scenario holds drawn, by family (the run of 13.11.2026). */
export const DRAWN = {
    Actions: [
        "DRPG.Tips.Actions.clearTheOverflowTooltip", "DRPG.Tips.Actions.detailsTooltip", "DRPG.Tips.Actions.frameStudentTooltip",
        "DRPG.Tips.Actions.indirectMurderWindowTooltip", "DRPG.Tips.Actions.notTheOneWhoTooltip", "DRPG.Tips.Actions.onPerRuleTooltip",
        "DRPG.Tips.Actions.onlyAfterDarkTooltip", "DRPG.Tips.Actions.requiredWork2Tooltip", "DRPG.Tips.Actions.room2Tooltip",
        "DRPG.Tips.Actions.secretAProjectSTooltip"
    ],
    Gm: [
        "DRPG.Tips.Gm.aCharacterDiesTooltip", "DRPG.Tips.Gm.campaignNameTooltip", "DRPG.Tips.Gm.categoryTooltip",
        "DRPG.Tips.Gm.chapterTooltip", "DRPG.Tips.Gm.despairPoolTooltip", "DRPG.Tips.Gm.giveATruthBulletTooltip",
        "DRPG.Tips.Gm.howHardTheOriginalTooltip", "DRPG.Tips.Gm.phaseTooltip", "DRPG.Tips.Gm.poolNameTooltip",
        "DRPG.Tips.Gm.roleTooltip", "DRPG.Tips.Gm.stateTooltip", "DRPG.Tips.Gm.studentsTooltip",
        "DRPG.Tips.Gm.tabsPoolsMonokumasStudentsTooltip", "DRPG.Tips.Gm.tierTooltip", "DRPG.Tips.Gm.whatItReallyIsTooltip",
        "DRPG.Tips.Gm.whatThePlayerIsTooltip", "DRPG.Tips.Gm.whichRemnantTooltip", "DRPG.Tips.Gm.whichStudentTooltip"
    ],
    Setup: [
        "DRPG.Tips.Setup.aStudentKnownAtTooltip", "DRPG.Tips.Setup.aStudentSNameStartTooltip", "DRPG.Tips.Setup.aStudentSNameTooltip",
        "DRPG.Tips.Setup.aStudentWhoKnowsTooltip", "DRPG.Tips.Setup.addAnItemTooltip", "DRPG.Tips.Setup.categoryTooltip",
        "DRPG.Tips.Setup.createTableTooltip", "DRPG.Tips.Setup.deleteTableTooltip", "DRPG.Tips.Setup.installReinstallTooltip",
        "DRPG.Tips.Setup.nameInATableTooltip", "DRPG.Tips.Setup.playTooltip", "DRPG.Tips.Setup.playlistForAStateTooltip",
        "DRPG.Tips.Setup.resetMusicTooltip", "DRPG.Tips.Setup.resetTheSeasonTooltip", "DRPG.Tips.Setup.sectionTooltip",
        "DRPG.Tips.Setup.tabsTierPoolsRoomTooltip"
    ],
    Trial: [
        "DRPG.Tips.Trial.findingWhenSolvedTooltip", "DRPG.Tips.Trial.findingsNTooltip", "DRPG.Tips.Trial.killerTooltip",
        "DRPG.Tips.Trial.rightAnswerZoneATooltip", "DRPG.Tips.Trial.schoolTrialHallTooltip", "DRPG.Tips.Trial.setTooltip",
        "DRPG.Tips.Trial.thesisTooltip", "DRPG.Tips.Trial.trialEvidenceLogTooltip", "DRPG.Tips.Trial.zoneAZoneBTooltip"
    ]
};

const CONTROL = "button, select, input, textarea, summary, a, [role='tab']";

export async function run({ gm, p1, check, note, evidence, settle, repoUrl }) {
    const clients = { gm, p1 };
    const en = JSON.parse(fs.readFileSync(path.join(REPO, "lang", "en.json"), "utf8")).DRPG?.Tips ?? {};
    const words = new Map();
    for (const [fam, keys] of Object.entries(en)) {
        for (const [k, v] of Object.entries(keys)) if (typeof v === "string" && !/\{/.test(v)) words.set(`DRPG.Tips.${fam}.${k}`, v);
    }
    check("the language file has E102's tooltips to look for", words.size > 100, `${words.size}`);
    await settle(3000);
    const drawn = new Map(), opened = [], failed = [];
    for (const w of WINDOWS) {
        let got;
        try { got = await clients[w.client ?? "gm"].eval(capture(repoUrl, w)); } catch (err) { got = { captured: false, threw: String(err?.message ?? err) }; }
        if (!got?.captured) { failed.push(`${w.id}: ${got?.threw ?? got?.answered ?? "not opened"}`); continue; }
        opened.push(w.id);
        for (const html of [got.html, ...(got.tabs ?? []).map(t => t.html)]) {
            const doc = new JSDOM(`<body>${html}</body>`).window.document;
            for (const el of doc.querySelectorAll(CONTROL)) {
                for (const said of [el.getAttribute("data-tooltip"), el.getAttribute("data-tooltip-text"), el.getAttribute("title")]) {
                    if (!said) continue;
                    for (const [key, text] of words) if (said === text && !drawn.has(key)) drawn.set(key, `${w.id} ${el.localName}`);
                }
            }
        }
    }
    note("windows", `${opened.length} of ${WINDOWS.length} opened${failed.length ? `; not opened: ${failed.slice(0, 6).join("; ")}` : ""}`);
    const expected = Object.values(DRAWN).flat();
    const lost = expected.filter(k => !drawn.has(k));
    const fresh = [...drawn.keys()].filter(k => !expected.includes(k));
    check("every key DRAWN holds is drawn on a control of a window, in its English words", expected.length > 0 && lost.length === 0,
        lost.length ? `not drawn: ${lost.join(", ")}` : `${expected.length} key(s) drawn`);
    if (fresh.length) note("drawn and not held", `${fresh.length}: ${fresh.join(", ")} - add them to DRAWN`);
    /* A card's close (REVIEW-E102-code C8, R4763's other half): a recorded card says the notice history keeps it, a
       record: false card says nothing. Drawn on p1 here, not in tier 1: recording writes this browser's history. */
    const cards = await p1.eval(`
        const { showPopup } = await import("${repoUrl}/scripts/popup.mjs");
        const host = () => document.getElementById("drpg-popups");
        const draw = async opts => {
            const before = new Set(host()?.querySelectorAll(".drpg-popup") ?? []);
            const dismiss = showPopup("<p>94</p>", { title: "94", sticky: true, ...opts });
            await new Promise(r => setTimeout(r, 80));
            const card = [...(host()?.querySelectorAll(".drpg-popup") ?? [])].find(c => !before.has(c));
            const close = card?.querySelector(".drpg-popup-close");
            const read = close ? close.getAttribute("data-tooltip") : "no card";
            if (typeof dismiss === "function") dismiss();
            return read;
        };
        return { kept: await draw({ record: true, persist: "session" }), unkept: await draw({ record: false }) };`);
    check("a recorded card's close says the notice history keeps it; a record: false card's says nothing",
        cards.kept === words.get("DRPG.Tips.Setup.closeXTooltip") && cards.unkept === null, JSON.stringify(cards));
    const notHere = [...words.keys()].filter(k => !drawn.has(k));
    evidence?.("tooltips", { drawn: Object.fromEntries(drawn), notDrawnHere: notHere, opened, failed });
    note("not drawn here", `${notHere.length} of ${words.size} keys (held by their family tests and the census)`);
    return { drawn: drawn.size, of: words.size, opened: opened.length, windows: WINDOWS.length };
}
