/**
 * 88: how long the main flows are, in clicks and windows (E51 C8, 31.10.2026; audit S17-49; E51-49).
 *
 * E28 and E29 each made a flow longer for a reason, and nothing would have said if one had added a step for none. This
 * drives each flow tests-flows.mjs `FLOW_LENGTHS` names on the harness's clients, as a person at the table would, and
 * counts on every browser while it runs:
 *   - a click: a `click` event that reaches the page on a control (a button, a link, a tab, a radio or a box, a
 *     module control by its data attribute), heard in the capture phase on the document - the presses a person makes,
 *     and the ones the harness makes for them: Daggerheart's roll window here is the harness's stand-in, which presses
 *     its own Roll (lib/dh-dice/applications/dialogs/d20RollDialog.mjs), and every DialogV2 window is drawn
 *     (`__dialogWindows`) and pressed by this scenario's own person (`INSTRUMENT`), as a player would press it;
 *   - a window: an application rendered for the first time (`renderApplicationV2`, once per window: a window that
 *     closes and comes back is a window again), and a `DialogV2.confirm` or `prompt`, which the harness's shim answers
 *     without drawing (its log, `__dialogLog`): one window and the one press that answers it.
 * Not counted: typing (a field filled is no click), a card's own drawing in a chat log or a thread the harness draws
 * nowhere (a GM's press on a card is counted on the card, drawn into the page for it; opening the messenger to find it
 * is not), and the windows that stand open when the flow starts (each flow's `from` in the baseline says which).
 *
 * THE BASELINE. `audit/harness/flow-length.json` holds each flow's counts per browser. A count above it fails ("a step
 * was added"); one below it fails too, until the baseline is lowered in the same commit ("lower the baseline"): a
 * shorter flow is good news nobody should lose by leaving the file behind. `DRPG_FLOW_LENGTH_WRITE=1` writes the counts
 * measured into the file instead of judging them, for the commit that changes a flow on purpose; the flows and their
 * `from` are tests-flows.mjs `FLOW_LENGTHS`, which R1133 holds to FLOWS.
 *
 * ITS LAYERS ARE THE CI'S ALONE, not the local gate's the stage planned: it needs the harness's drawn DialogV2
 * windows (`__dialogWindows`), its answer queue for the trial's opening (`__dialogAnswers`) and its scripted dice
 * (`__forceRoll`), none of which the sandbox adapter gives (audit/live/sandbox-cluster.mjs `missingFrom`; a scenario
 * of the local gate that asks for one is red in `node tools/check.mjs registry`). The counts at a real table, Dice
 * So Nice installed, are LIVE-E51-06.
 */
import fs from "node:fs";
import url from "node:url";
import { FLOW_LENGTHS } from "../../../scripts/tests-flows.mjs";

export const layers = ["ci"];
export const timeoutMs = 900000;

const MOD = "danganronpa-rpg";
const J = value => JSON.stringify(value);
const BASELINE = url.fileURLToPath(new URL("../flow-length.json", import.meta.url));
const WHO = ["gm", "p1", "p2", "p3"];

/*
 * THE INSTRUMENT, the same on every browser. `__fl.on` while a flow runs. The person presses a drawn DialogV2 window
 * 150 ms after it is drawn: as the flow's plan says for its title (`__fl.plan`: a title's words, or the whole title
 * with `same`; the controls it clicks first, the fields it fills, the button it presses), else the window's default
 * button, else its first; a window the plan holds (`hold`) is left open for the flow to press inside and close.
 */
const INSTRUMENT = `
    if (!globalThis.__fl) {
        const F = globalThis.__fl = { on: false, clicks: [], windows: [], seen: new Set(), answered: new Set(), plan: [], log0: 0, drawn: [] };
        const CONTROL = "button, a, [role=button], [role=link], [role=tab], [role=menuitem], input[type=checkbox], input[type=radio], "
            + "[data-action], [data-drpg-action], [data-drpg-call], [data-drpg-bar], [data-drpg-run], [data-drpg-refund]";
        const name = el => (el.dataset?.action ?? el.dataset?.drpgAction ?? el.dataset?.drpgCall ?? el.dataset?.drpgBar ?? el.dataset?.drpgRun
            ?? el.getAttribute?.("name") ?? el.textContent ?? "").trim().replace(/\\s+/g, " ").slice(0, 40);
        const title = app => String(app?.options?.window?.title ?? app?.title ?? app?.constructor?.name ?? "?").slice(0, 60);
        F.title = title;
        document.addEventListener("click", ev => {
            if (!F.on) return;
            const control = ev.target?.closest?.(CONTROL);
            if (control) F.clicks.push(name(control));
        }, true);
        Hooks.on("renderApplicationV2", app => {
            if (!F.on || F.seen.has(app.id)) return;
            F.seen.add(app.id);
            F.windows.push(title(app));
        });
        const stepFor = t => {
            const step = F.plan.find(p => !p.used && (p.same ? t === p.title : t.includes(p.title))) ?? null;
            if (step?.once) step.used = true;
            return step;
        };
        const press = app => {
            const el = app.element;
            if (!el?.isConnected) return;
            const t = title(app), step = stepFor(t);
            F.drawn.push({ title: t, inputs: [...el.querySelectorAll("input, select, textarea")].map(i => (i.name || i.tagName) + "=" + (i.value ?? "")).slice(0, 12),
                buttons: [...el.querySelectorAll("footer button")].map(b => b.dataset.action + (b.classList.contains("default") ? "*" : "")) });
            if (step?.hold) return;
            for (const sel of step?.click ?? []) el.querySelector(sel)?.click();
            for (const [sel, value] of Object.entries(step?.fill ?? {})) {
                const field = el.querySelector(sel);
                if (field) { field.value = value; field.dispatchEvent(new Event("input", { bubbles: true })); field.dispatchEvent(new Event("change", { bubbles: true })); }
            }
            const footer = [...el.querySelectorAll("footer button")];
            const button = (step?.button ? footer.find(b => b.dataset.action === step.button) : null)
                ?? footer.find(b => b.classList.contains("default")) ?? footer[0] ?? null;
            button?.click();
        };
        setInterval(() => {
            if (!F.on) return;
            for (const app of foundry.applications.instances.values()) {
                if (!(app instanceof foundry.applications.api.DialogV2) || F.answered.has(app.id) || !app.rendered || !app.element?.isConnected) continue;
                F.answered.add(app.id);
                setTimeout(() => press(app), 150);
            }
        }, 100);
    }
    return true;`;

/** Start counting on a browser, with the plan for its windows. The windows standing are not counted, nor pressed. */
const START = plan => `const F = globalThis.__fl;
    F.plan = ${J(plan ?? [])}; F.clicks = []; F.windows = []; F.drawn = [];
    F.seen = new Set(foundry.applications.instances.keys()); F.answered = new Set(foundry.applications.instances.keys());
    F.log0 = globalThis.__dialogLog.length; F.on = true;
    return true;`;
/** Stop counting: the clicks and windows since START, with the confirms and prompts the shim answered undrawn. */
const STOP = `const F = globalThis.__fl;
    F.on = false;
    const undrawn = globalThis.__dialogLog.slice(F.log0).filter(d => d.kind === "confirm" || d.kind === "prompt").map(d => String(d.title ?? "?"));
    return { clicks: F.clicks.length + undrawn.length, windows: F.windows.length + undrawn.length,
        pressed: [...F.clicks, ...undrawn.map(t => "(answered) " + t)], opened: [...F.windows, ...undrawn], drawn: F.drawn };`;

export async function run({ gm, p1, p2, p3, check, phase, settle, repoUrl, IDS }) {
    const clients = { gm, p1, p2, p3 };
    const until = `const until = async (test, ms) => { const end = Date.now() + ms; let v; while (!(v = await test()) && Date.now() < end) await new Promise(r => setTimeout(r, 120)); return v; };`;
    for (const who of WHO) await clients[who].eval(`globalThis.__s88windows = globalThis.__dialogWindows; globalThis.__dialogWindows = true; ${INSTRUMENT}`);
    const measured = {}, details = {};

    /** One flow: START on every browser with its plans, `drive` it, wait `rest` ms, STOP everywhere; `done` reads what it did. */
    const flow = async (name, { plans = {}, drive, rest = 1500, done = null }) => {
        for (const who of WHO) await clients[who].eval(START(plans[who]));
        let err = null, did = null;
        try { await drive(); } catch (e) { err = String(e?.stack ?? e).slice(0, 400); }
        await settle(rest);
        const counts = {}, read = {};
        for (const who of WHO) {
            const r = await clients[who].eval(STOP);
            read[who] = r;
            if (r.clicks || r.windows) counts[who] = { clicks: r.clicks, windows: r.windows };
        }
        try { did = done ? await done() : null; } catch (e) { did = { threw: String(e?.message ?? e).slice(0, 200) }; }
        measured[name] = counts;
        details[name] = { err, did, read };
        console.log(`[88 ${name}] ${J({ err, did, counts, read })}`);
        return { err, did, counts };
    };

    /* A sheet as Daggerheart's would hand it to the module's render hook (tier 2's `drawnSheet`): the header's name row,
       where sheet.mjs puts the Level Up button, and the features part, where it draws the action tiles and the Calls.
       Drawn before a flow starts, and again where a flow needs what changed (an offer standing); its controls are what
       is pressed. */
    const SHEET = actorId => `${until}
        document.querySelector('.drpg-s88-sheet[data-actor="${actorId}"]')?.remove();
        const a = game.actors.get("${actorId}");
        const element = document.createElement("div"); element.className = "drpg-s88-sheet"; element.dataset.actor = "${actorId}";
        element.innerHTML = '<div class="character-header-sheet"><div class="name-row"></div><div class="character-row"></div></div>'
            + '<section data-application-part="features" class="tab" data-tab="features"></section><section data-application-part="inventory"></section>';
        document.body.append(element);
        Hooks.callAll("renderCharacterSheet", { document: a, isEditable: true, element, rendered: true, render() {} }, element, {}, { isFirstRender: true });
        await until(() => element.querySelector("[data-drpg-action]"), 8000);
        return { tiles: [...element.querySelectorAll("[data-drpg-action]")].map(b => b.dataset.drpgAction),
            calls: [...element.querySelectorAll("[data-drpg-call]")].map(b => b.dataset.drpgCall),
            advance: Boolean(element.querySelector("[data-drpg-advance]")) };`;
    const PRESS = (actorId, selector) => `const el = document.querySelector('.drpg-s88-sheet[data-actor="${actorId}"]');
        const b = el?.querySelector(${J(selector)}); b?.click(); return Boolean(b);`;
    /* A card's button pressed by the GM, as in the messenger's thread (messenger-app.mjs `wireCallActions` on the card's
       words, drawn into the page so the press is heard): the newest card holding `data-drpg-call="<call>"`. */
    const CARD = call => `${until}
        const { contentOf } = await import("${repoUrl}/scripts/secret.mjs");
        const { wireCallActions } = await import("${repoUrl}/scripts/messenger-app.mjs");
        const find = () => game.messages.contents.slice().reverse().find(m => String(contentOf(m) ?? "").includes('data-drpg-call="${call}"')) ?? null;
        const card = await until(() => find(), 8000);
        if (!card) return false;
        const body = document.createElement("div"); body.className = "drpg-s88-card";
        body.innerHTML = contentOf(card); document.body.append(body);
        wireCallActions(body, card);
        body.querySelector('[data-drpg-call="${call}"]')?.click();
        await new Promise(r => setTimeout(r, 1500));
        body.remove();
        return true;`;
    const spent = actorId => `return game.drpg.actionsLeft(game.actors.get("${actorId}"));`;
    const refill = actorId => gm.eval(`const a = game.actors.get("${actorId}"); await game.drpg.setActions(a, game.drpg.actionsMax(a)); return game.drpg.actionsLeft(a);`);

    /* ---------------------------------------------------------------- setup */
    phase("setup");
    await gm.eval(`await game.drpg.setMonokuma(game.actors.get("${IDS.monokuma}"), true).catch(() => {});
        await game.drpg.setClock({ chapter: 1, day: 1, session: 1, timeOfDay: "morning", phase: "dailyLife" });
        await game.drpg.resetAllActions();
        return true;`, { timeout: 60000 });
    await settle(600);
    const sheets = { p1: await p1.eval(SHEET(IDS.aiko), { timeout: 30000 }), p2: await p2.eval(SHEET(IDS.botan), { timeout: 30000 }) };
    check("setup: Aiko's sheet on p1 and Botan's on p2 draw the action tiles and the Calls",
        sheets.p1.tiles.includes("search") && sheets.p2.calls.includes("ultimate"), J(sheets));

    /* ---------------------------------------------------------------- Search, Observe, Analyze */
    for (const [name, key, flowId, faces] of [["search", "search", "search-observe", { hope: 9, fear: 5 }],
        ["observe", "observe", "search-observe", { hope: 12, fear: 11 }], ["analyze", "analyze", "analyze", { hope: 12, fear: 11 }]]) {
        if (name === "analyze") phase("Analyze", { flow: "analyze" });
        else if (name === "observe") phase("Observe", { flow: "search-observe" });
        else phase("Search", { flow: "search-observe" });
        const left = await refill(IDS.aiko);
        await p1.eval(`globalThis.__forceRoll = ${J(faces)}; return true;`);
        await flow(name, { drive: async () => { await p1.eval(PRESS(IDS.aiko, `[data-drpg-action="${key}"]`)); await settle(3000); },
            done: async () => ({ left, after: await p1.eval(spent(IDS.aiko)) }) });
        await p1.eval(`delete globalThis.__forceRoll; return true;`);
        check(`${name}: the flow ran and charged one action (${flowId})`, !details[name].err && details[name].did?.after === left - 1, J(details[name].did));
    }

    /* ---------------------------------------------------------------- Hope Call */
    phase("Hope Call", { flow: "hope-call" });
    await gm.eval(`await game.actors.get("${IDS.botan}").update({ "system.resources.hope.value": 3 }); return true;`);
    await settle(400);
    const hope0 = await p2.eval(`return game.actors.get("${IDS.botan}").system.resources.hope.value;`);
    await flow("hopeCall", { plans: { p2: [{ title: "", fill: { '[name="callNote"]': "S88 I am the Ultimate Locksmith and this is a lock." } }] }, drive: async () => {
        await p2.eval(PRESS(IDS.botan, '[data-drpg-call="ultimate"]'));
        await settle(1500);
        details.hopeCallCard = await gm.eval(CARD("approveCall"), { timeout: 30000 });
        await settle(1500);
    }, done: async () => ({ hope0, hope: await p2.eval(`return game.actors.get("${IDS.botan}").system.resources.hope.value;`), card: details.hopeCallCard }) });
    check("hopeCall: the GM's yes on the card charges Botan's Hope", details.hopeCallCard === true && details.hopeCall.did?.hope < hope0, J(details.hopeCall.did));

    /* ---------------------------------------------------------------- Dynamic */
    phase("Dynamic", { flow: "action-roll" });
    const dynLeft = await refill(IDS.aiko);
    await p1.eval(`globalThis.__forceRoll = { hope: 9, fear: 5 }; return true;`);
    await flow("dynamic", { plans: { p1: [{ title: "", fill: { '[name="request"]': "S88 picks the archive's lock" } }] }, drive: async () => {
        await p1.eval(PRESS(IDS.aiko, '[data-drpg-action="dynamic"]'));
        await settle(1500);
        details.dynamicCard = await gm.eval(CARD("setDifficulty"), { timeout: 30000 });
        await settle(4000);
    }, done: async () => ({ left: dynLeft, after: await p1.eval(spent(IDS.aiko)), card: details.dynamicCard }) });
    await p1.eval(`delete globalThis.__forceRoll; return true;`);
    check("dynamic: the GM rules it from its card and p1's roll charges one action", details.dynamicCard === true && details.dynamic.did?.after === dynLeft - 1, J(details.dynamic.did));

    /* ---------------------------------------------------------------- the GM panel, standing */
    /** A window opened and left standing before a flow: drawn with the person holding it, not counted. */
    const standing = async (client, title, open) => {
        await client.eval(START([{ title, same: true, hold: true }]));
        const drawn = await client.eval(`${until} ${open}
            return Boolean(await until(() => [...foundry.applications.instances.values()].find(a => a.rendered && a.element?.isConnected
                && globalThis.__fl.title(a) === ${J(title)}), 8000));`, { timeout: 30000 });
        await client.eval(STOP);
        return drawn;
    };
    const T = await gm.eval(`const L = k => game.i18n.localize(k);
        return { panel: L("DRPG.Panel.title"), alive: L("DRPG.Panel.whoIsAlive"), trial: L("DRPG.Floor.manageTrial"), vote: L("DRPG.Vote.openTitle"),
            ballot: L("DRPG.Vote.ballotTitle"), verdict: L("DRPG.Vote.verdictTitle"), queue: L("DRPG.Advance.queueTitle"),
            advance: game.i18n.format("DRPG.Advance.title", { actor: game.actors.get("${IDS.aiko}").name }) };`);
    const inWindow = (title, selector) => `${until}
        const el = await until(() => [...foundry.applications.instances.values()].find(a => a.rendered && a.element?.isConnected
            && globalThis.__fl.title(a) === ${J(title)})?.element?.querySelector(${J(selector)}), 8000);
        el?.click(); return Boolean(el);`;

    /* ---------------------------------------------------------------- Refund */
    /* A crossing of Aiko's as the primary hears a player's (tier 2 E17-T6's road: a scene of two rooms, the token moved
       with `SENT_BACK` naming p1, the move's action stamped), made before the flow; the flow is the GM's, from the GM
       panel standing: its Students tile, then the row's Refund last crossing. */
    phase("Refund", { flow: "crossing-fee-refund" });
    const crossed = await gm.eval(`${until}
        const M = await import("${repoUrl}/scripts/movement.mjs"), S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const R = await import("${repoUrl}/scripts/rooms.mjs"), ACT = await import("${repoUrl}/scripts/actions.mjs");
        const { SETTINGS } = await import("${repoUrl}/scripts/settings.mjs"); const { FLAGS } = await import("${repoUrl}/scripts/config.mjs");
        const aiko = game.actors.get("${IDS.aiko}");
        await game.settings.set("${MOD}", SETTINGS.chargeMovement, true);
        await game.settings.set("${MOD}", SETTINGS.moveAudit, "log");
        const mark = { "${MOD}": { [R.ROOM_FLAG]: true } };
        const room = (name, x) => ({ name, shapes: [{ type: "rectangle", x, y: 0, width: 1000, height: 1000 }], flags: mark, behaviors: [] });
        const scene = await Scene.create({ name: "S88 refund", width: 2000, height: 1000, grid: { size: 100 }, active: false, navigation: false });
        await scene.createEmbeddedDocuments("Region", [room("S88 Hall", 0), room("S88 Lab", 1000)]);
        const [token] = await scene.createEmbeddedDocuments("Token", [{ actorId: aiko.id, actorLink: true, name: aiko.name, x: 300, y: 300, width: 1, height: 1 }]);
        await new Promise(r => setTimeout(r, 400));
        await S.crossingStore.drop(aiko.id);
        await aiko.update({ "system.resources.actions.value": 2, "system.resources.actions.max": 2, ["flags.${MOD}." + FLAGS.freeMoveUsed]: true,
            ["flags.${MOD}." + FLAGS.freeMoveGrants]: 0, ["flags.${MOD}." + FLAGS.freeActionGrants]: 0 });
        const at = Date.now();
        await token.update({ x: 1310, y: 310 }, { teleport: true, movementAction: "displace", animate: false, [M.SENT_BACK]: "${IDS.p1}" });
        await until(() => (S.crossingStore.get(aiko.id)?.at ?? 0) >= at, 2000);
        await aiko.update({ "system.resources.actions.value": 1 }, { noHook: true });
        Hooks.callAll("updateActor", aiko, { system: { resources: { actions: { value: 1 } } } }, { drpgWrite: { reason: "spend", ref: ACT.MOVE_SPEND } }, "${IDS.p1}");
        await until(() => S.crossingStore.get(aiko.id)?.kind, 2000);
        globalThis.__s88refund = { scene: scene.id, token: token.id };
        return { kind: S.crossingStore.get(aiko.id)?.kind ?? null };`, { timeout: 60000 });
    const panelUp = await standing(gm, T.panel, `const GP = await import("${repoUrl}/scripts/gm-panel.mjs"); GP.openGmPanel();`);
    await flow("refund", { plans: { gm: [{ title: T.panel, same: true, hold: true }, { title: T.alive, same: true, hold: true }] }, drive: async () => {
        await gm.eval(inWindow(T.panel, '[data-drpg-run="whoIsAlive"]'), { timeout: 30000 });
        await settle(800);
        await gm.eval(inWindow(T.alive, `[data-drpg-refund="${IDS.aiko}"]`), { timeout: 30000 });
        await settle(2000);
    }, done: async () => gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        return { refunded: S.crossingStore.get("${IDS.aiko}")?.refunded ?? null, left: game.drpg.actionsLeft(game.actors.get("${IDS.aiko}")) };`) });
    check("refund: the crossing was recorded, and the Students window's Refund gave it back",
        crossed.kind === "action" && panelUp && details.refund.did?.refunded === true, J({ crossed, panelUp, did: details.refund.did }));
    await gm.eval(`for (const app of [...foundry.applications.instances.values()]) if ([${J(T.alive)}, ${J(T.panel)}].includes(globalThis.__fl.title(app))) await app.close();
        const r = globalThis.__s88refund; if (r) await game.scenes.get(r.scene)?.delete();
        await game.drpg.setActions(game.actors.get("${IDS.aiko}"), game.drpg.actionsMax(game.actors.get("${IDS.aiko}")));
        return true;`, { timeout: 30000 });

    /* ---------------------------------------------------------------- the Class Trial */
    /* As 63-class-trial's A: a victim killed, Chie in the register, the trial opened (its window answered "ok" from the
       harness's queue); then the console stands open, held, for the GM's flows. */
    phase("the Class Trial", { flow: "class-trial" });
    const trial = await gm.eval(`const C = await import("${repoUrl}/scripts/chapter.mjs");
        const { blackenedStore } = await import("${repoUrl}/scripts/gm-stores.mjs");
        const { seasonEpoch, getClock } = await import("${repoUrl}/scripts/settings.mjs");
        const victim = await Actor.create({ name: "S88 Victim", type: "character" });
        await C.killCharacter(victim, { secret: false, keepBullets: true });
        await blackenedStore.patch("${IDS.chie}", { chapter: getClock().chapter, epoch: seasonEpoch(), at: Date.now(), victims: [victim.id] });
        globalThis.__dialogAnswers.push("ok");
        const { startClassTrial } = await import("${repoUrl}/scripts/trial-floor-ui.mjs");
        return { started: await startClassTrial(), phase: getClock().phase };`, { timeout: 60000 });
    await settle(800);
    const consoleUp = await standing(gm, T.trial, `const UI = await import("${repoUrl}/scripts/trial-floor-ui.mjs"); UI.manageClassTrial();`);
    check("the trial: opened, and its console stands on the GM", trial.started === true && trial.phase === "classTrial" && consoleUp, J({ trial, consoleUp }));
    const floorMode = `const F = await import("${repoUrl}/scripts/trial-floor.mjs"); return F.trialFloor()?.mode ?? null;`;
    const HOLD_ALL = [{ title: "", hold: true }];

    /* The mode bar, a mode at a time: the console's footer starts it, its own window answered, and the bar's
       End this mode ends it. The players' turn windows are counted and left as they stand. */
    for (const [mode, action] of [["testimony", "startTestimony"], ["panic", "startPanic"], ["closing", "startClosing"]]) {
        phase(`the mode bar: ${mode}`, { flow: "class-trial" });
        const name = `modeBar.${mode}`;
        await flow(name, { plans: { gm: [{ title: T.trial, same: true, hold: true }], p1: HOLD_ALL, p2: HOLD_ALL, p3: HOLD_ALL }, drive: async () => {
            await gm.eval(inWindow(T.trial, `footer button[data-action="${action}"]`), { timeout: 30000 });
            details[`${name}.ran`] = await gm.eval(`${until} const F = await import("${repoUrl}/scripts/trial-floor.mjs");
                return await until(() => F.trialFloor()?.mode ?? null, 8000);`, { timeout: 30000 });
            await settle(1500);
            await gm.eval(inWindow(T.trial, '[data-drpg-bar="endMode"]'), { timeout: 30000 });
            await settle(1500);
        }, done: async () => ({ ran: details[`${name}.ran`], after: await gm.eval(floorMode) }) });
        check(`${name}: the console's footer started the mode and the bar ended it`,
            Boolean(details[name].did?.ran) && details[name].did.ran !== "debate" && details[name].did.after === null, J(details[name].did));
        for (const who of ["p1", "p2", "p3"]) await clients[who].eval(`for (const app of [...foundry.applications.instances.values()])
            if (app instanceof foundry.applications.api.DialogV2 && app.rendered) await app.close(); return true;`, { timeout: 30000 });
    }

    /* ---------------------------------------------------------------- the verdict */
    phase("the verdict", { flow: "class-trial" });
    const ballot = [{ title: T.ballot, same: true, click: [`input[name="choice0"][value="${IDS.chie}"]`] }];
    await flow("verdict", { plans: {
        gm: [{ title: T.trial, same: true, hold: true }, { title: T.vote, same: true, once: true, button: "open" }, { title: T.vote, same: true, once: true, button: "tally" },
            { title: T.verdict, same: true, button: "correct" }, { title: T.queue, same: true, button: "allPlayers" }],
        p1: ballot, p2: ballot, p3: ballot }, drive: async () => {
        await gm.eval(inWindow(T.trial, 'footer button[data-action="vote"]'), { timeout: 30000 });
        details.votesIn = await gm.eval(`${until} const V = await import("${repoUrl}/scripts/vote.mjs");
            return await until(() => V.votesIn() >= 3 ? V.votesIn() : null, 15000) ?? V.votesIn();`, { timeout: 30000 });
        await settle(800);
        await gm.eval(inWindow(T.trial, 'footer button[data-action="vote"]'), { timeout: 30000 });
        await settle(2500);
        await gm.eval(inWindow(T.trial, 'footer button[data-action="verdict"]'), { timeout: 30000 });
        await settle(4000);
    }, rest: 2500, done: async () => gm.eval(`const V = await import("${repoUrl}/scripts/vote.mjs");
        const S = await import("${repoUrl}/scripts/gm-stores.mjs"), L = await import("${repoUrl}/scripts/level-up.mjs");
        const p = V.trialProgress();
        return { closed: p.voteClosed ?? null, applied: p.verdictApplied ?? null, accused: p.accusedIds ?? null,
            offer: L.offerList(S.offerStore.get("${IDS.aiko}")).length };`) });
    check("verdict: three ballots for Chie, counted, the correct verdict applied, and Aiko offered a Level Up",
        details.votesIn === 3 && details.verdict.did?.applied === true && J(details.verdict.did?.accused) === J([IDS.chie]) && details.verdict.did?.offer > 0,
        J({ votesIn: details.votesIn, did: details.verdict.did }));

    /* ---------------------------------------------------------------- the Level Up */
    phase("the Level Up", { flow: "class-trial" });
    await p1.eval(`${until} const L = await import("${repoUrl}/scripts/level-up.mjs");
        return Boolean(await until(() => L.pendingAdvance(game.actors.get("${IDS.aiko}")), 8000));`, { timeout: 30000 });
    const lit = await p1.eval(SHEET(IDS.aiko), { timeout: 30000 });
    const advances = `return game.actors.get("${IDS.aiko}").getFlag("${MOD}", "advances") ?? 0;`;
    const before = await p1.eval(advances);
    /* The window's Apply reads its form with Foundry's FormDataExtended, else the page's FormData (level-up.mjs
       `readFormData`); the harness has neither in the page's own realm - its global FormData is Node's, which refused
       jsdom's form ("Argument 1 could not be converted", measured 31.10) - so the page's own is stood in for the flow. */
    await p1.eval(`globalThis.__s88FormData = globalThis.FormData; globalThis.FormData = window.FormData; return true;`);
    await flow("levelUp", { plans: { p1: [{ title: T.advance, same: true, click: ['input[type="checkbox"]', 'input[type="radio"]'] }] }, drive: async () => {
        await p1.eval(PRESS(IDS.aiko, "[data-drpg-advance]"));
        await settle(4000);
    }, rest: 3000, done: async () => ({ before, after: await p1.eval(advances), ...(await p1.eval(`const L = await import("${repoUrl}/scripts/level-up.mjs");
        return { still: Boolean(L.pendingAdvance(game.actors.get("${IDS.aiko}"))), notes: globalThis.__notifications.slice(-4).map(n => n.level + ": " + n.msg) };`)),
        gmNotes: await gm.eval(`return globalThis.__notifications.slice(-4).map(n => n.level + ": " + n.msg);`) }) });
    await p1.eval(`globalThis.FormData = globalThis.__s88FormData; return true;`);
    check("levelUp: p1's lit button opens Aiko's offer and the pick raises her advances by one",
        lit.advance === true && details.levelUp.did?.after === before + 1, J({ lit, did: details.levelUp.did }));

    /* ---------------------------------------------------------------- the baseline */
    phase("the baseline");
    const names = FLOW_LENGTHS.map(f => f.name);
    check("every flow FLOW_LENGTHS names was driven, and no other", J(Object.keys(measured).sort()) === J([...names].sort()),
        J({ measured: Object.keys(measured), names }));
    /* By side, the GM's and the players' together: which player a round's first turn falls to is the round's draw
       (measured: p2's in one run, p3's in the next), and the players' sum is the same either way. */
    const shape = counts => {
        const side = list => list.reduce((sum, w) => ({ clicks: sum.clicks + (counts?.[w]?.clicks ?? 0), windows: sum.windows + (counts?.[w]?.windows ?? 0) }), { clicks: 0, windows: 0 });
        return Object.fromEntries([["gm", side(["gm"])], ["players", side(["p1", "p2", "p3"])]].filter(([, n]) => n.clicks || n.windows));
    };
    const SIDES = ["gm", "players"];
    if (process.env.DRPG_FLOW_LENGTH_WRITE === "1") {
        let kept = {};
        try { kept = JSON.parse(fs.readFileSync(BASELINE, "utf8")); } catch { /* a first baseline */ }
        const flows = Object.fromEntries(FLOW_LENGTHS.map(f => [f.name, { flow: f.flow, from: f.from, ...shape(measured[f.name]) }]));
        fs.writeFileSync(BASELINE, `${JSON.stringify({ ...kept, flows }, null, 2)}\n`);
        console.log(`[88] the baseline written: ${BASELINE}`);
    }
    let base = null;
    try { base = JSON.parse(fs.readFileSync(BASELINE, "utf8")); } catch (err) { base = { error: err.message }; }
    check("the baseline is read: one row a flow, the same flows", Boolean(base?.flows) && J(Object.keys(base.flows).sort()) === J([...names].sort()),
        J(base?.error ?? Object.keys(base?.flows ?? {})));
    for (const f of FLOW_LENGTHS) {
        const now = shape(measured[f.name]), row = base?.flows?.[f.name] ?? {};
        const was = Object.fromEntries(SIDES.filter(side => row[side]).map(side => [side, row[side]]));
        const over = [], under = [];
        for (const w of SIDES) for (const k of ["clicks", "windows"]) {
            const n = now[w]?.[k] ?? 0, b = was[w]?.[k] ?? 0;
            if (n > b) over.push(`${w} ${k} ${b} -> ${n}`);
            if (n < b) under.push(`${w} ${k} ${b} -> ${n}`);
        }
        const pressed = Object.fromEntries(WHO.filter(w => details[f.name]?.read?.[w]?.clicks).map(w => [w, details[f.name].read[w].pressed]));
        check(`${f.name}: as long as the baseline - ${over.length ? `a step was added (${over.join(", ")})` : under.length ? `shorter: lower the baseline (${under.join(", ")})` : J(now)}`,
            !over.length && !under.length, J({ now, baseline: was, pressed }), { flow: f.flow });
    }

    console.log(`[88 measured] ${J(measured)}`);
    console.log(`[88 drawn] ${J(Object.fromEntries(Object.entries(details).filter(([, d]) => d?.read).map(([k, d]) => [k, Object.fromEntries(WHO.map(w => [w, d.read[w].drawn]))])))}`);
    for (const who of WHO) await clients[who].eval(`document.querySelectorAll(".drpg-s88-sheet").forEach(el => el.remove()); globalThis.__dialogWindows = globalThis.__s88windows; return true;`);
}
