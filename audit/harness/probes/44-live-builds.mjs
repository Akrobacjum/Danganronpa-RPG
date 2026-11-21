/**
 * Probe: does every live region's build return the region itself (the audit of 1.2.118, its re-check after 1.2.119,
 * 21.11.2026)?
 * ---------------------------------------------------------------------------
 *     node cluster.mjs probes/44-live-builds.mjs                     (from audit/harness)
 *
 * WHAT IT ASKS. live.mjs `keepLive` replaces the region (`region`, a selector) with what `build` returns, and finds the
 * region again by the same selector on the next change. A build that returns the region's inside instead of the region
 * draws its first element where the region stood, drops the rest, and is never found again: the region is lost to
 * every later change, with nothing said. The Mastermind's Give Hope box did this on v1.2.119 (claude/hopebox-120
 * a5661b39) and the case trial schema before it (case-trial.mjs's comment, "found by the round-4 sweep"). For each
 * window of probe 08's list (`WINDOWS`, opened as probe 42 opens it, on its client), it reads the window's live regions
 * (live.mjs `liveRegions(app)`), calls each one's build once, and writes whether the element it returns matches the
 * region's selector, and whether the drawn window held a node matching it before the call.
 *
 * WHAT IT DOES NOT ASK. It asserts nothing (probes/README.md): its rows are readings. A build is called once, in the
 * window's state as opened; a build whose first element depends on the state (an empty list, a GM or a player) is read
 * in that state only. Windows probe 08 does not open (a Remnant's or a project's card, the HUD) are not here; their
 * regions are named in the notes as not read. A build with side effects runs them once.
 *
 * Options: DRPG_LIVE_ONLY=id,id (only those windows of WINDOWS); DRPG_LIVE_OUT=<file> (the evidence also written there).
 */
import fs from "node:fs";
import path from "node:path";
import { WINDOWS } from "./08-capture-windows.mjs";
import { open, close } from "./42-press-controls.mjs";

export const layers = ["probe"];

const ONLY = (process.env.DRPG_LIVE_ONLY ?? "").split(",").map(id => id.trim()).filter(Boolean);
const OUT = process.env.DRPG_LIVE_OUT ? path.resolve(process.env.DRPG_LIVE_OUT) : null;

const readRegions = repoUrl => `
    const P = globalThis.__probe42;
    if (!P?.app) return { regions: [], why: "no window" };
    const { liveRegions } = await import("${repoUrl}/scripts/live.mjs");
    const out = [];
    for (const r of liveRegions(P.app)) {
        const row = { region: r.region, drawn: !!P.app.element?.querySelector(r.region) };
        try {
            const built = r.build();
            let el = null;
            if (built instanceof HTMLElement) el = built;
            else { const holder = document.createElement("div"); holder.innerHTML = String(built ?? ""); el = holder.firstElementChild; }
            row.returned = el ? \`<\${el.tagName.toLowerCase()} class="\${[...el.classList].join(" ")}">\`.slice(0, 160) : null;
            row.matches = !!el?.matches?.(r.region);
            row.alsoInside = !!el?.querySelector?.(r.region);
        } catch (err) { row.threw = String(err?.message ?? err).slice(0, 200); }
        out.push(row);
    }
    return { regions: out };
`;

export async function run({ gm, p1, note, settle, repoUrl }) {
    const clients = { gm, p1 };
    const base = ONLY.length ? WINDOWS.filter(w => ONLY.includes(w.id)) : WINDOWS;
    const p1Id = await p1.eval("return game.user.id;");
    const onGm = step => gm.eval(`const repoUrl = ${JSON.stringify(repoUrl)}; ${step.replaceAll("__P1__", p1Id)} return true;`, { timeout: 60000 });
    await settle(3000);
    const windows = [];
    const totals = { windows: 0, opened: 0, regions: 0, matches: 0, wrong: 0, threw: 0 };
    for (const w of base) {
        const client = clients[w.client ?? "gm"];
        const row = { id: w.id, client: w.client ?? "gm" };
        try {
            if (w.gmSeed) await onGm(w.gmSeed);
            const got = await client.eval(open(repoUrl, w), { timeout: 60000 });
            row.opened = got.opened; row.title = got.title;
            totals.windows++;
            if (got.opened) {
                totals.opened++;
                const read = await client.eval(readRegions(repoUrl), { timeout: 60000 });
                row.regions = read.regions;
                for (const r of read.regions) {
                    totals.regions++;
                    if (r.threw) totals.threw++;
                    else if (r.matches) totals.matches++;
                    else totals.wrong++;
                }
            }
        } catch (err) { row.notWalked = String(err?.message ?? err).slice(0, 300); }
        try { await client.eval(close(repoUrl, w), { timeout: 60000 }); } catch { /* the next open closes what is left */ }
        if (w.gmAfter) { try { await onGm(w.gmAfter); } catch { /* as probe 42 */ } }
        windows.push(row);
        const wrong = (row.regions ?? []).filter(r => !r.matches);
        if (row.notWalked) note(w.id, `not walked (${row.notWalked.slice(0, 160)})`);
        else if (!row.opened) note(w.id, "not opened");
        else note(w.id, `"${row.title}": ${(row.regions ?? []).length} live region(s)${wrong.length ? `; NOT THE REGION: ${wrong.map(r => `${r.region} -> ${r.threw ? `threw ${r.threw}` : r.returned}`).join("; ")}` : ""}`);
        if (OUT) { try { fs.writeFileSync(OUT, `${JSON.stringify({ totals, windows }, null, 1)}\n`); } catch { /* the notes hold the rows */ } }
    }
    note("totals", JSON.stringify(totals));
    const evidence = { about: "probe 44 (audit/harness/probes/44-live-builds.mjs): each live region of each window of probe 08's list, its build called once, and whether what it returns is the region itself. A reading, not a verdict.", only: ONLY, totals, windows };
    if (OUT) fs.writeFileSync(OUT, `${JSON.stringify(evidence, null, 1)}\n`);
    return evidence;
}
