/**
 * S0-GMLIST (1.2.129): the GM panel with its roster, captured as the harness draws it, in the states the owner asked
 * about - "upewnijmy sie ze wyswietla poprawnie ile akcji i ruchow ma dany gracz, rowniez w eclipse".
 *
 *     cd audit/harness && DRPG_CAPTURE_OUT=<dir> node cluster.mjs ../../docs/dev/owner129/ui/capture.mjs
 *
 * Probe 08's `capture` (audit/harness/probes/08-capture-windows.mjs) on the GM, twice, into <dir> (gm-panel-day.html,
 * gm-panel-eclipse.html and a manifest.json in probe 08's shape): (1) a day refilled by the rules (`resetAllActions`;
 * the harness world seeds 3 of 3) and spent into - Aiko fresh, Botan with one
 * action spent, the Free Move taken, a Burst and a Sprint banked, Chie with no action left; (2) an Eclipse opened over
 * it (`startEclipse` refills the actions) with Botan's one crossing and Chie's two counted (`applyRecordedMove`, no
 * card). Every write goes through the module's own functions; the budgets are put back (`budgetsOf` /
 * `putBackBudgets`), the Eclipse ended without advancing and the crossing rows dropped. Nothing under audit/windows is
 * written. shots.mjs beside this file draws the captures. It asserts nothing.
 */
import fs from "node:fs";
import path from "node:path";
import { capture } from "../../../../audit/harness/probes/08-capture-windows.mjs";

export const layers = ["probe"];

export async function run({ gm, note, settle, repoUrl }) {
    const OUT = process.env.DRPG_CAPTURE_OUT;
    if (!OUT) throw new Error("DRPG_CAPTURE_OUT names the folder the captures go to");
    fs.mkdirSync(OUT, { recursive: true });
    await settle(3000);
    const setup = await gm.eval(`
        const A = await import("${repoUrl}/scripts/actions.mjs");
        globalThis.__s0gm = { budgets: A.budgetsOf() };
        const by = n => game.actors.getName(n);
        const [aiko, botan, chie] = [by("Aiko Hoshino"), by("Botan Kage"), by("Chie Mori")];
        // From the rules' refill first: the harness world seeds 3 of 3, where a time of day gives STARTING.actions (2).
        await A.resetAllActions();
        await A.spendAction(botan, 1, { quiet: true });
        await A.takeMove(botan, { quiet: true });
        await A.grantFreeActions(botan, 1);
        await A.grantFreeMoves(botan, 1);
        await A.setActions(chie, 0);
        return [aiko, botan, chie].map(a => a.name + " " + A.actionsLeft(a) + "/" + A.actionsMax(a));
    `);
    note("the day", setup.join("; "));
    await settle(800);
    const rows = [];
    const keep = (id, got) => {
        if (!got?.captured) { rows.push({ id, captured: false, threw: got?.threw ?? null }); return; }
        fs.writeFileSync(path.join(OUT, `${id}.html`), `${got.html.replace(/[–—−]/g, c => `&#${c.codePointAt(0)};`)}\n`);
        rows.push({ id, client: "gm", captured: true, title: got.title, classes: got.classes, tag: got.tag, width: got.width, buttons: got.buttons, file: `${id}.html` });
    };
    const W = { module: "gm-panel.mjs", call: "m.openGmPanel()", perTab: false };
    keep("gm-panel-day", await gm.eval(capture(repoUrl, W), { timeout: 60000 }));
    try {
        const dark = await gm.eval(`
            const E = await import("${repoUrl}/scripts/eclipse.mjs");
            await E.startEclipse();
            await new Promise(r => setTimeout(r, 600));
            if (!E.isEclipse()) return "no Eclipse";
            const by = n => game.actors.getName(n);
            await E.applyRecordedMove(by("Botan Kage").id, { card: false });
            await E.applyRecordedMove(by("Chie Mori").id, { card: false });
            await E.applyRecordedMove(by("Chie Mori").id, { card: false });
            return ["Aiko Hoshino", "Botan Kage", "Chie Mori"].map(n => n + " " + E.movesLeft(by(n)) + " of " + E.eclipseAllowanceFor(by(n))).join("; ");
        `, { timeout: 60000 });
        note("the Eclipse", String(dark));
        await settle(800);
        keep("gm-panel-eclipse", await gm.eval(capture(repoUrl, W), { timeout: 60000 }));
    } finally {
        await gm.eval(`
            const E = await import("${repoUrl}/scripts/eclipse.mjs");
            const A = await import("${repoUrl}/scripts/actions.mjs");
            const { eclipseMoveStore } = await import("${repoUrl}/scripts/gm-stores.mjs");
            if (E.isEclipse()) await E.endEclipse({ advance: false });
            for (const n of ["Botan Kage", "Chie Mori"]) { const id = game.actors.getName(n).id; if (eclipseMoveStore.has(id)) await eclipseMoveStore.drop(id); }
            await A.putBackBudgets(globalThis.__s0gm.budgets);
            return true;
        `, { timeout: 60000 });
    }
    fs.writeFileSync(path.join(OUT, "manifest.json"), `${JSON.stringify({ about: "S0-GMLIST captures (docs/dev/owner129/ui/capture.mjs)", windows: rows }, null, 2)}\n`);
    note("captured", rows.map(r => `${r.id}: ${r.captured}`).join(", "));
}
