/**
 * Probe: a window left open while the world changes under it, set beside the same window opened fresh (the audit of
 * 1.2.118, 20.11.2026; audit/AUDIT-1.2.42.md section 16, the live-refresh pass).
 * ---------------------------------------------------------------------------
 *     node cluster.mjs probes/43-stale-windows.mjs                   (from audit/harness)
 *
 * WHAT IT ASKS. The owner's words of 20.11.2026: a window should refresh where it stands, not only after it is closed
 * and opened again (the Planner was the example). For each window of probe 08's list (`WINDOWS`, opened as probe 42
 * opens it, on its own client) and for each change of CHANGES, made on the GM's client through the module's own
 * functions and not through the window:
 *     1. the window stands open; its state is read (`stateOf`, probe 42: its words, its fields' values, its controls'
 *        states; not the count of its elements);
 *     2. the change is made; 0.8 s pass (the redraw's debounce is 120 ms, at most 360: config.mjs TIMING.coalesceMs);
 *     3. the standing window is read again: LIVE;
 *     4. it is closed and opened again, and read: FRESH.
 * FRESH differing from step 1 says the window shows this change at all (`relevant`); LIVE equal to FRESH says it showed
 * it where it stood (`live`). A relevant change the standing window did not show is `stale`, with the place the two
 * readings first differ. The change is then taken back and the same three readings made again, so every change is read
 * twice (`apply`, `undo`).
 *
 * THE OWNER'S RULE (20.11.2026, relayed by the coordinator: "Zawsze odswiezamy okna od razu przy zmianie" - a window
 * refreshes at once when something changes). live.mjs holds a redraw while the focus is inside the live region ("never
 * redraw under the cursor"), so a window can be late by design until the GM clicks elsewhere; under the owner's rule
 * that is a finding. So where a change was read `live` and the window has a field, the change is made once more with
 * the focus put in the window's first field (`apply-focused`): `held-by-focus` when the standing window did not show
 * it, with whether it showed it once the focus left (`releasedOnBlur`); `live-under-focus` when it did. And a stale
 * window that had the focus inside it by itself is read once more after the focus is taken out (`stale-until-blur`).
 * One change is a thing moved by hand rather than by the module's function: a Remnant's token moved to another room
 * with a plain token update (`trace-moved`), the coordinator's example of 20.11 for the Planner.
 *
 * WHAT IT DOES NOT ASK, AND WHERE IT IS BLIND.
 * - It asserts nothing (probes/README.md).
 * - A change made on the GM's own client reaches its windows by the same hooks a change from another browser does for
 *   world settings and documents (Foundry tells every client), but a GM store's change from ANOTHER GM arrives by the
 *   stores' exchange instead: that road is scenario 61's and 97's, not this probe's.
 * - Fourteen changes, each one move of one thing: a window stale only for a change that is not among them reads clean.
 * - A window that redraws itself with time (a stopwatch) differs between any two readings: each window is first read
 *   twice with nothing changed (`restless`), and a restless window's rows are to be read with that in mind.
 * - A row of probe 08 that builds state before its window and takes it away after can undo the change itself (a seed
 *   that puts the clock back): after every reopen the change is checked to still stand, and a row where it does not
 *   is written `confounded` and not counted.
 * - jsdom: no layout and no CSS, so "drawn" is the DOM, not the screen.
 *
 * THE WORLD. Tier 2's `snapshot` before the first window and `restore` after every window (as probe 42); what the dump
 * still shows different at the end is written in the evidence.
 *
 * Options: DRPG_STALE_ONLY=id,id (windows); DRPG_STALE_CHANGES=id,id (changes); DRPG_STALE_ALL=1 (also the variants of
 * one window that SKIP leaves out); DRPG_STALE_OUT=<file> (the evidence as JSON, resolved from audit/harness).
 */
import fs from "node:fs";
import path from "node:path";
import { WINDOWS } from "./08-capture-windows.mjs";
import { open, close, stateOf } from "./42-press-controls.mjs";

export const layers = ["probe"];

const list = name => (process.env[name] ?? "").split(",").map(id => id.trim()).filter(Boolean);
const ONLY = list("DRPG_STALE_ONLY"), ONLY_CHANGES = list("DRPG_STALE_CHANGES");
const OUT = process.env.DRPG_STALE_OUT ? path.resolve(process.env.DRPG_STALE_OUT) : null;
/* Variants of one window in another seeded state or with another node picked: the same window's listening, read once. */
const SKIP = /^(investigation--map-(node|trace|slot|planned|autopsy|zone|final|bullet)|class-trial--(case-objection|counted|verdict-given|summary-sent|objection|case)|item-manager--(item-new|bullet-new|key)|notices-player-250|action-loot--long|drpg-settings-player-voice|look-player|look-gm|pre-season-checks|case-realize--made|rooms-passages--rows|season-setup--zones)$/;
const WAIT = 800;

/*
 * The changes, each made on the GM's client by the module's own functions: `make` does it and keeps what `undo` needs on
 * `S`; `holds` answers a value that tells the changed world from the unchanged one. `R` is the repository's URL, `MOD`
 * the module's id, `student` the first student (monokuma.mjs `studentActors`) and `other` the last.
 */
const CHANGES = [
    { id: "time-of-day", what: "the time of day set to another (clock.mjs setClock)",
        make: `const C = await import(R + "/scripts/clock.mjs"); S.tod = C.getClock().timeOfDay; await C.setClock({ timeOfDay: S.tod === "noon" ? "afternoon" : "noon" });`,
        undo: `const C = await import(R + "/scripts/clock.mjs"); await C.setClock({ timeOfDay: S.tod });`,
        holds: `return (await import(R + "/scripts/clock.mjs")).getClock().timeOfDay;` },
    { id: "despair", what: "a Monokuma's Despair moved by one (despair.mjs setDespair)",
        make: `const D = await import(R + "/scripts/despair.mjs"); const u = D.monokumas()[0]; S.despair = { id: u.id, value: D.getDespair(u.id) }; await D.setDespair(u.id, S.despair.value > 0 ? S.despair.value - 1 : 1);`,
        undo: `const D = await import(R + "/scripts/despair.mjs"); await D.setDespair(S.despair.id, S.despair.value);`,
        holds: `const D = await import(R + "/scripts/despair.mjs"); return D.getDespair(D.monokumas()[0].id);` },
    { id: "overflow", what: "the Overflow's count raised by one (overflow.mjs addOverflow)",
        make: `S.overflow = foundry.utils.deepClone(game.settings.get(MOD, "overflow")); await (await import(R + "/scripts/overflow.mjs")).addOverflow(1);`,
        undo: `await game.settings.set(MOD, "overflow", S.overflow);`,
        holds: `return JSON.stringify(game.settings.get(MOD, "overflow"));` },
    { id: "hope", what: "a student's Hope moved by one (the actor's update)",
        make: `S.hope = student.system.resources.hope.value; await student.update({ "system.resources.hope.value": S.hope > 0 ? S.hope - 1 : 1 });`,
        undo: `await student.update({ "system.resources.hope.value": S.hope });`,
        holds: `return student.system.resources.hope.value;` },
    { id: "health", what: "a student's Health marked by one (the actor's update)",
        make: `S.hp = student.system.resources.hitPoints.value; await student.update({ "system.resources.hitPoints.value": S.hp > 0 ? S.hp - 1 : 1 });`,
        undo: `await student.update({ "system.resources.hitPoints.value": S.hp });`,
        holds: `return student.system.resources.hitPoints.value;` },
    { id: "actions", what: "a student's actions left changed by one (actions.mjs setActions)",
        make: `const A = await import(R + "/scripts/actions.mjs"); S.actions = A.actionsLeft(student); await A.setActions(student, S.actions > 0 ? S.actions - 1 : 1);`,
        undo: `const A = await import(R + "/scripts/actions.mjs"); await A.setActions(student, S.actions);`,
        holds: `return (await import(R + "/scripts/actions.mjs")).actionsLeft(student);` },
    { id: "item", what: "a tool given to a student (inventory.mjs grantItem)",
        make: `const I = await import(R + "/scripts/inventory.mjs"); const it = await I.grantItem(student, { name: "Probe 43 lamp", category: "tool", tier: 1, override: true, quiet: true }); S.item = it?.id ?? null;`,
        undo: `if (S.item && student.items.has(S.item)) await student.deleteEmbeddedDocuments("Item", [S.item]);`,
        holds: `return student.items.filter(i => i.name === "Probe 43 lamp").length;` },
    { id: "truth-bullet", what: "a Truth Bullet given to a student (truth-bullets.mjs createTruthBullet)",
        make: `const T = await import(R + "/scripts/truth-bullets.mjs"); const b = await T.createTruthBullet(student, { name: "Probe 43 bullet", realType: "neutral", playerText: "A probe's bullet." }); S.bullet = b?.id ?? null; S.bulletUuid = b?.uuid ?? null;`,
        undo: `const T = await import(R + "/scripts/truth-bullets.mjs"); if (S.bulletUuid) await T.dropSecret(S.bulletUuid).catch(() => {}); if (S.bullet && student.items.has(S.bullet)) await student.deleteEmbeddedDocuments("Item", [S.bullet]);`,
        holds: `return student.items.filter(i => i.name === "Probe 43 bullet").length;` },
    { id: "trace", what: "a Remnant placed on the scene (remnants.mjs placeRemnant, setRemnantPublic)",
        make: `const Rm = await import(R + "/scripts/remnants.mjs"); const ch = (await import(R + "/scripts/clock.mjs")).getClock().chapter;
            const t = await Rm.placeRemnant({ type: "prep", visibility: "evident", x: 0, y: 0, scene: canvas.scene, chapter: ch, note: "probe 43" });
            if (t) await Rm.setRemnantPublic(t, { name: "Probe 43 trace", playerText: "A probe's trace." }); globalThis.__probe43trace = t ?? null;`,
        undo: `const Rm = await import(R + "/scripts/remnants.mjs"); const t = globalThis.__probe43trace; delete globalThis.__probe43trace;
            if (t) { await Rm.dropRemnantSecret(t).catch(() => {}); await t.delete().catch(() => {}); }`,
        holds: `return globalThis.__probe43trace ? 1 : 0;` },
    { id: "trace-moved", what: "a Remnant's token moved by hand to another room (a plain token update, no module function)",
        setup: `const Rm = await import(R + "/scripts/remnants.mjs"); const Mv = await import(R + "/scripts/movement.mjs"); const ch = (await import(R + "/scripts/clock.mjs")).getClock().chapter;
            const rooms = Mv.allRooms(canvas.scene); const like = canvas.scene.tokens.find(t => t.actorId) ?? null;
            const a = Mv.positionIn(rooms[0], like), b = Mv.positionIn(rooms[1], like);
            const t = a && b ? await Rm.placeRemnant({ type: "prep", visibility: "evident", x: a.x, y: a.y, scene: canvas.scene, chapter: ch, note: "probe 43 moved" }) : null;
            if (t) await Rm.setRemnantPublic(t, { name: "Probe 43 moved trace", playerText: "A probe's trace, moved by hand." });
            globalThis.__probe43moved = t ? { t, a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y }, rooms: [rooms[0], rooms[1]] } : null;`,
        make: `const m = globalThis.__probe43moved; if (m) await m.t.update(m.b, { teleport: true, movementAction: "displace", animate: false });`,
        undo: `const m = globalThis.__probe43moved; if (m) await m.t.update(m.a, { teleport: true, movementAction: "displace", animate: false });`,
        teardown: `const Rm = await import(R + "/scripts/remnants.mjs"); const m = globalThis.__probe43moved; delete globalThis.__probe43moved;
            if (m) { await Rm.dropRemnantSecret(m.t).catch(() => {}); await m.t.delete().catch(() => {}); }`,
        holds: `const m = globalThis.__probe43moved; return m ? [m.t.x, m.t.y] : null;` },
    { id: "project", what: "a public project created (projects.mjs createProject)",
        make: `const P = await import(R + "/scripts/projects.mjs"); const made = await P.createProject({ name: "Probe 43 project" }); S.project = made?.id ?? null;`,
        undo: `const P = await import(R + "/scripts/projects.mjs"); if (S.project) await P.deleteProject(S.project);`,
        holds: `const P = await import(R + "/scripts/projects.mjs"); return P.allProjects().filter(p => p.name === "Probe 43 project").length;` },
    { id: "case-node", what: "a deduction added to the chapter's case in the GMs' store (case-schema.mjs setCaseNode)",
        make: `const CS = await import(R + "/scripts/case-schema.mjs"); S.ch = (await import(R + "/scripts/clock.mjs")).getClock().chapter; await CS.setCaseNode(S.ch, "probe43-d1", { kind: "deduction", label: "Probe 43 deduction" });`,
        undo: `const CS = await import(R + "/scripts/case-schema.mjs"); await CS.dropCaseNode(S.ch, "probe43-d1");`,
        holds: `const CS = await import(R + "/scripts/case-schema.mjs"); const ch = (await import(R + "/scripts/clock.mjs")).getClock().chapter; return CS.caseGraph(ch).nodes.filter(n => n.id === "probe43-d1").length;` },
    { id: "death", what: "a student killed, the death public (chapter.mjs killCharacter), and revived",
        make: `const C = await import(R + "/scripts/chapter.mjs"); await C.killCharacter(other, { secret: false, keepBullets: true });`,
        undo: `const C = await import(R + "/scripts/chapter.mjs"); if (C.isDeadForGm(other)) await C.reviveCharacter(other, { quiet: true });`,
        holds: `return (await import(R + "/scripts/chapter.mjs")).isDeadForGm(other);` },
    { id: "eclipse", what: "an Eclipse started (eclipse.mjs startEclipse) and ended without moving the clock",
        make: `await (await import(R + "/scripts/eclipse.mjs")).startEclipse();`,
        undo: `await (await import(R + "/scripts/eclipse.mjs")).endEclipse({ advance: false });`,
        holds: `return (await import(R + "/scripts/eclipse.mjs")).isEclipse();` }
];

/** Where two readings of a window first differ, and in which part. */
function diffOf(live, fresh) {
    const a = live.split("\u0001"), b = fresh.split("\u0001");
    const names = ["words", "fields", "controls"];
    const k = [0, 1, 2].find(i => a[i] !== b[i]) ?? 0;
    let i = 0;
    while (i < (a[k] ?? "").length && a[k][i] === (b[k] ?? "")[i]) i++;
    const cut = s => String(s ?? "").slice(Math.max(0, i - 60), i + 80);
    return { part: names[k], live: cut(a[k]), fresh: cut(b[k]) };
}

export async function run({ gm, p1, note, settle, repoUrl }) {
    const clients = { gm, p1 };
    for (const [name, ids, all] of [["DRPG_STALE_ONLY", ONLY, WINDOWS.map(w => w.id)], ["DRPG_STALE_CHANGES", ONLY_CHANGES, CHANGES.map(c => c.id)]]) {
        const unknown = ids.filter(id => !all.includes(id));
        if (unknown.length) throw new Error(`${name} names nothing of the list: ${unknown.join(", ")}`);
    }
    const windows = ONLY.length ? WINDOWS.filter(w => ONLY.includes(w.id)) : WINDOWS.filter(w => process.env.DRPG_STALE_ALL || !SKIP.test(w.id));
    const changes = ONLY_CHANGES.length ? CHANGES.filter(c => ONLY_CHANGES.includes(c.id)) : CHANGES;
    const p1Id = await p1.eval("return game.user.id;");
    const PRE = `const R = ${JSON.stringify(repoUrl)}, repoUrl = R, MOD = "danganronpa-rpg"; const S = globalThis.__probe43 ??= {};
        const all = (await import(R + "/scripts/monokuma.mjs")).studentActors(); const student = all[0], other = all[all.length - 1];`;
    const onGm = (code, timeout = 60000) => gm.eval(`${PRE} ${code.replaceAll("__P1__", p1Id)}`, { timeout });
    /* The count of elements is left out of a reading (probe 42's `stateOf` ends on it): a region rebuilt in place and the
       same region drawn fresh can differ by a wrapper nobody sees (read on the Investigation window, 498 against 497
       with the same words, fields and controls). */
    const read = client => client.eval(`const stateOf = ${stateOf.toString()}; const P = globalThis.__probe42;
        const standing = !!P?.app?.element?.isConnected && foundry.applications.instances.has(P.app.id);
        return { standing, state: standing ? stateOf(P.app.element).split("\\u0001").slice(0, 3).join("\\u0001") : "gone", focusInside: standing && P.app.element.contains(document.activeElement) && document.activeElement !== document.body };`, { timeout: 30000 });
    const blur = client => client.eval("document.activeElement?.blur?.(); return true;");

    await settle(3000);
    const dump = `const K = await import(R + "/scripts/tests-kit.mjs"); const d = await K.worldDump();`;
    await onGm(`${dump} globalThis.__probe43dump = d; return d.size;`);
    await onGm(`const T = await import(R + "/scripts/tests-tier2.mjs"); globalThis.__probe43snap = await T.snapshot(all); return true;`, 120000);
    const putBack = () => onGm(`const T = await import(R + "/scripts/tests-tier2.mjs"); const { gmStoresIdle } = await import(R + "/scripts/gm-store.mjs");
        try { await game.drpg.endMurder({ reason: "test", followUp: false }); } catch {}
        await gmStoresIdle(); await T.restore(globalThis.__probe43snap); return true;`, 120000);

    const rows = [];
    const totals = { windows: 0, opened: 0, readings: 0, relevant: 0, live: 0, stale: 0, staleUntilBlur: 0, confounded: 0, restless: 0, failed: 0,
        focusedReadings: 0, heldByFocus: 0, liveUnderFocus: 0 };
    /* The focus put in the window's first field a person could type in or pick from; false when it has none. */
    const focusField = client => client.eval(`const P = globalThis.__probe42; const el = P?.app?.element;
        const f = el ? [...el.querySelectorAll("input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])")].find(x => !x.closest("[hidden]")) : null;
        if (!f) return false; f.focus(); return document.activeElement === f ? (f.name || f.id || f.tagName.toLowerCase()) : false;`, { timeout: 30000 });
    /* Written after every window (DRPG_STALE_OUT), and each window caught on its own: the run of 21.11.2026 on
       1eee4d62 lost its GM to a JavaScript heap out of memory after 34 windows and, ending in a throw, wrote no evidence
       at all. Now the rows read so far stay, and a window that throws is written `notWalked` with the error. */
    const save = (changed, ended) => {
        if (!OUT) return;
        try { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, `${JSON.stringify({ about: "probe 43 (audit/harness/probes/43-stale-windows.mjs): each window of probe 08's list left open while one thing in the world changed, set beside the same window opened fresh. A reading, not a verdict.", ended, changes: changes.map(c => ({ id: c.id, what: c.what })), totals, worldChanged: changed, windows: rows }, null, 1)}\n`); } catch { /* the notes hold the rows */ }
    };
    for (const w of windows) {
      try {
        const client = clients[w.client ?? "gm"];
        const row = { id: w.id, client: w.client ?? "gm", opener: (w.opener ?? `${w.module} ${w.call}`).slice(0, 160), readings: [] };
        const openOnce = async () => {
            if (w.gmSeed) await onGm(`${w.gmSeed} return true;`);
            const during = w.gmDuring ? new Promise(r => setTimeout(r, 400)).then(() => onGm(`${w.gmDuring} return true;`)).catch(err => String(err?.message ?? err)) : null;
            let got;
            try { got = await client.eval(open(repoUrl, w), { timeout: 60000 }); } catch (err) { got = { opened: false, threw: String(err?.message ?? err).slice(0, 300) }; }
            if (during) await during;
            return got;
        };
        const closeOnce = async () => {
            try { await client.eval(close(repoUrl, w), { timeout: 60000 }); } catch { /* the next open closes what is left */ }
            if (w.gmAfter) { try { await onGm(`${w.gmAfter} return true;`); } catch { /* written by probe 08's own run */ } }
        };
        totals.windows++;
        const first = await openOnce();
        Object.assign(row, { opened: first.opened, title: first.title ?? null, threw: first.threw ?? null });
        if (!first.opened) { await closeOnce(); rows.push(row); note(w.id, `not opened (${first.threw ?? "the opener answered"})`); continue; }
        totals.opened++;
        /* Read twice with nothing changed, then fresh: a window that differs here is restless by itself. */
        let was = (await read(client)).state;
        await new Promise(r => setTimeout(r, WAIT));
        const idle = (await read(client)).state;
        await closeOnce(); await openOnce();
        let fresh0 = (await read(client)).state;
        if (idle !== was || fresh0 !== was) { row.restless = diffOf(idle !== was ? idle : was, idle !== was ? was : fresh0); totals.restless++; }
        was = fresh0;
        for (const c of changes) {
            if (c.setup) {
                try { await onGm(`${c.setup} return true;`); await new Promise(r => setTimeout(r, WAIT)); await closeOnce(); await openOnce(); was = (await read(client)).state; }
                catch (err) { row.readings.push({ change: c.id, step: "setup", verdict: "failed", why: String(err?.message ?? err).slice(0, 240) }); totals.failed++; continue; }
            }
            let appliedLive = false;
            for (const step of ["apply", "undo"]) {
                const reading = { change: c.id, step };
                try {
                    await onGm(`${step === "apply" ? c.make : c.undo} return true;`);
                    const holds = await onGm(c.holds);
                    await new Promise(r => setTimeout(r, WAIT));
                    const live = await read(client);
                    let afterBlur = null;
                    if (live.standing && live.state === was && live.focusInside) {
                        await blur(client);
                        await new Promise(r => setTimeout(r, WAIT));
                        afterBlur = (await read(client)).state;
                    }
                    await closeOnce(); await openOnce();
                    const fresh = await read(client);
                    const still = await onGm(c.holds);
                    totals.readings++;
                    if (JSON.stringify(still) !== JSON.stringify(holds)) { reading.verdict = "confounded"; reading.why = `the change read ${JSON.stringify(holds)} and after the reopen ${JSON.stringify(still)}`; totals.confounded++; }
                    else if (!fresh.standing) { reading.verdict = "failed"; reading.why = "the window did not open again"; totals.failed++; }
                    else if (fresh.state === was) reading.verdict = "not-shown";
                    else {
                        totals.relevant++;
                        if (!live.standing) { reading.verdict = "closed-itself"; }
                        else if (live.state === fresh.state) { reading.verdict = "live"; totals.live++; if (step === "apply") appliedLive = true; }
                        else if (afterBlur !== null && afterBlur === fresh.state) { reading.verdict = "stale-until-blur"; reading.diff = diffOf(live.state, fresh.state); totals.staleUntilBlur++; }
                        else { reading.verdict = live.state === was ? "stale" : "partly"; reading.focusInside = live.focusInside; reading.diff = diffOf(afterBlur ?? live.state, fresh.state); totals.stale++; }
                    }
                    was = fresh.standing ? fresh.state : was;
                } catch (err) { reading.verdict = "failed"; reading.why = String(err?.message ?? err).slice(0, 240); totals.failed++; }
                row.readings.push(reading);
            }
            /* The owner's rule: the same change with the focus in a field of the window (see the header). */
            if (appliedLive) {
                const reading = { change: c.id, step: "apply-focused" };
                try {
                    const field = await focusField(client);
                    if (field) {
                        reading.field = field;
                        await onGm(`${c.make} return true;`);
                        await new Promise(r => setTimeout(r, WAIT));
                        const held = await read(client);
                        totals.focusedReadings++;
                        if (held.standing && held.state === was) {
                            await blur(client);
                            await new Promise(r => setTimeout(r, WAIT));
                            reading.verdict = "held-by-focus"; reading.releasedOnBlur = (await read(client)).state !== was; totals.heldByFocus++;
                        } else { reading.verdict = "live-under-focus"; totals.liveUnderFocus++; }
                        await onGm(`${c.undo} return true;`);
                        await new Promise(r => setTimeout(r, WAIT));
                        await closeOnce(); await openOnce();
                        was = (await read(client)).state;
                        row.readings.push(reading);
                    }
                } catch (err) { reading.verdict = "failed"; reading.why = String(err?.message ?? err).slice(0, 240); totals.failed++; row.readings.push(reading); }
            }
            if (c.teardown) {
                try { await onGm(`${c.teardown} return true;`); await new Promise(r => setTimeout(r, WAIT)); await closeOnce(); await openOnce(); was = (await read(client)).state; }
                catch (err) { row.readings.push({ change: c.id, step: "teardown", verdict: "failed", why: String(err?.message ?? err).slice(0, 240) }); totals.failed++; }
            }
        }
        await closeOnce();
        try { await putBack(); } catch (err) { row.putBack = `threw: ${String(err?.message ?? err).slice(0, 200)}`; }
        rows.push(row);
        const count = v => row.readings.filter(r => r.verdict === v).length;
        note(w.id, `"${row.title}": ${row.readings.length} reading(s) - ${count("live")} live, ${count("stale") + count("partly")} stale, ${count("stale-until-blur")} stale until the focus left, ${count("held-by-focus")} held by the focus in a field, ${count("live-under-focus")} live under it, ${count("not-shown")} not shown, ${count("confounded")} confounded, ${count("failed")} failed${row.restless ? "; restless" : ""}`);
      } catch (err) {
        rows.push({ id: w.id, notWalked: String(err?.message ?? err).slice(0, 300) });
        note(w.id, `not walked (${String(err?.message ?? err).slice(0, 160)})`);
      }
      save(null, "in progress");
    }
    let changed = null;
    try { changed = await onGm(`${dump} const diff = K.dumpDiff(globalThis.__probe43dump, d).map(x => x.unit); delete globalThis.__probe43dump; delete globalThis.__probe43snap; delete globalThis.__probe43; return diff;`);
    note("the world", changed.length ? `${changed.length} unit(s) differ after the last restore: ${changed.slice(0, 10).join(", ")}` : "the world dump is equal before and after"); }
    catch (err) { note("the world", `not compared: ${String(err?.message ?? err).slice(0, 200)}`); }
    note("totals", JSON.stringify(totals));
    const evidence = { about: "probe 43 (audit/harness/probes/43-stale-windows.mjs): each window of probe 08's list left open while one thing in the world changed, set beside the same window opened fresh. A reading, not a verdict.",
        ended: "done", changes: changes.map(c => ({ id: c.id, what: c.what })), totals, worldChanged: changed, windows: rows };
    if (OUT) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, `${JSON.stringify(evidence, null, 1)}\n`); }
    return evidence;
}
