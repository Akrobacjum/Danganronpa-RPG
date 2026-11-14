/**
 * Scenario 71 - the character sheet on the GM and two players, through the harness's render after a write (E45 C3a,
 * 08.11.2026; STAGE E45 "71-sheet", the slice's parts A-H, rows E45-11..E45-15).
 *
 * WHAT IT MODELS. There are no Daggerheart sheets here. Each client opens a stand-in sheet app (`installStand` below):
 * a root shaped as Daggerheart 2.10.5's resource-bar.hbs and sidebar.hbs draw it - the bar layout, or with `pips` the
 * pip layout - with the Hope diamonds, the tab bar, the features, inventory and biography parts; its own `render`
 * (on its prototype, as ApplicationV2's is, so sheet-repaint.mjs `installRenderPlan` wraps it) builds the root again from the
 * actor and calls the render hooks the module listens on (`renderCharacterSheet`, then `renderActorSheetV2`, the base
 * class's, which anonymity.mjs reads), and counts each call (`calls`); its `close` takes the root
 * out of the page and fires `closeCharacterSheet`. It is registered in the actor's `apps` and stands as the actor's
 * `sheet` on its client, so the shim's render after a write (client-entry.mjs `renderApps`) and the module's own
 * `actor.sheet.render(false)` both reach it. A `calls` of 0 after a write is a sheet repainted in place; 1 or more is a
 * sheet rendered again.
 *
 * WHAT IT CANNOT SAY. The render after a write is the harness's model of Foundry's (`render(false, { renderContext:
 * "update<Doc>", renderData })` on every client, from v13/v14 notes, not v14's source): LIVE-E45-01. Whether a real
 * table blinks, how a real ApplicationV2 swaps its parts, the canvas's token bars as drawn, and Daggerheart's own
 * templates are not read here: LIVE-E45-01..04 (AUDIT 9.2) hold them. The stand-in's markup is from the templates as
 * the module's anchors name them (patches.mjs SHEET_ANCHORS), not a copy of them.
 *
 * Clients: gm, p1 (Aiko's owner), p2 (another player, Botan's). Parts:
 *   A - fast Health writes: p1 writes Health three times from the field with the lock off and the GM twice; every
 *       client's sheet is repainted (no render) and reads the same reserve; again with the pip layout on p1 and the
 *       bar on p2 (D46: the same number).
 *   B - a write cut in preUpdate: p1's Sanity write with the lock on (resource-guard.mjs), p1's Hope gain under Despair
 *       (overflow.mjs), then an item the GM creates on Aiko - its row on every client's sheet (S03-07).
 *   C - the Monocub's tile: Aiko a Monocub with no Hope; the GM gives her one: Confusion turns affordable on p1's sheet
 *       with no render.
 *   D - the reserve agrees: after a hit the GM writes, the sheet on all three clients and the token's bar attribute say
 *       the same Health; p2 reads no Sanity of Aiko's in the bar or the sheet.
 *   E - the gates: Aiko dead, a Monocub, an NPC not in the class, and Monokuma's sheet, as owner and viewer: the mode
 *       the sheet drew (`sheetMode`) against the matrix R1471 answers.
 *   F - the biography: typed and closed by the X, saved once; typed and the tab changed, saved; opened and closed
 *       untouched, nothing; p2's field read-only (E24-17).
 *   G - the redacted sheet: p2's view of Aiko has no Sanity number in the row, the track, or any tooltip, label or
 *       title; Health's row is there (E24-06, S03-06).
 *   H - the Level Up offer's cycle: offered by the GM, taken by p1 through the bridge, offered again and taken back
 *       by the GM; p1's and the GM's sheets follow each step (H4, the GM's button unlit after p1's take: E45-C3b's B1).
 *   I - the biography held unsaved on p1 while the GM writes it (E45-C3b's B2, general n6): the GM's text stands, p1's
 *       stays in the field and p1 is told once; p1's next save writes p1's.
 *   J - fixes already on the tree, on live clients (E45-C3b's B3): the Party sheet's Sanity to a non-owner (security
 *       S-2); p2's redacted sheet repainted after p1's Sanity and Hope writes, read for any Sanity or Hope number in its
 *       text, attributes and classes (security "For 71"); a Hope maximum written alone (general n1). E2 is general m3:
 *       a dead student's Hope write repaints with no mark.
 *
 * Red first: A, B and C on E45-C1's tree (before C2's render without state) - C3a's message quotes them; H4, I2, I3
 * and J3 on da8e8a3b - C3b's message quotes them.
 */

/* The client-side steps below run in a page (stringified for `eval`), where these are the page's. */
/* global document, Hooks, game, ui, Event, MouseEvent */

export const layers = ["ci"];

const MOD = "danganronpa-rpg";

/* Runs in a client: the stand-in sheet, installed once a page. Stringified, never run in node. */
async function installStand() {
    if (globalThis.__s71) return true;
    const esc = text => String(text ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
    const block = (key, label, action, r, pips) => {
        const value = Number(r?.value ?? 0), max = Number(r?.max ?? 0);
        if (pips) {
            let slots = "";
            for (let n = 1; n <= max; n++) slots += `<span class="slot${value >= n ? " filled" : ""}" data-action="${action}" data-value="${n}"></span>`;
            return `<div class="slot-value"><div class="slot-bar">${slots}</div>`
                + `<div class="slot-label"><span class="label">${label}</span><span class="value">${value} / ${max}</span></div></div>`;
        }
        return `<div class="status-bar"><div class="status-value"><progress class="progress-bar" max="${max}" value="${value}"></progress>`
            + `<input class="bar-input" name="system.resources.${key}.value" min="0" max="${max}" value="${value}" type="number"><span>/</span>`
            + `<span class="bar-label">${max}</span></div><div class="status-label pointy"><h4>${label}</h4></div></div>`;
    };
    const build = (actor, pips) => {
        const res = actor.system?.resources ?? {};
        const hope = Number(res.hope?.value ?? 0);
        let diamonds = "";
        for (let n = 1; n <= Number(res.hope?.max ?? 6); n++) {
            diamonds += `<span class="hope-value" data-value="${n}"><i class="${n <= hope ? "fa-solid" : "fa-regular"} fa-diamond"></i></span>`;
        }
        const root = document.createElement("div");
        root.className = "drpg-s71-sheet application sheet";
        root.innerHTML = `<div class="window-content">`
            + `<div class="character-header-sheet"><div class="name-row"><h1>${esc(actor.name)}</h1></div><div class="character-details"></div>`
            + `<div class="character-row"><div class="resource-section"><div class="hope-section">${diamonds}</div></div></div></div>`
            + `<aside class="character-sidebar-sheet"><div class="portrait"><img src="" alt=""></div><div class="info-section${pips ? " pip-display" : ""}">`
            + `<div class="resources-section">${block("hitPoints", "Health", "toggleHitPoints", res.hitPoints, pips)}${block("stress", "Sanity", "toggleStress", res.stress, pips)}</div></div></aside>`
            + `<nav class="sheet-tabs tabs" data-group="primary"><a data-tab="features" data-group="primary">Features</a>`
            + `<a data-tab="inventory" data-group="primary">Inventory</a><a data-tab="biography" data-group="primary">Biography</a></nav>`
            + `<section class="tab active" data-tab="features" data-group="primary" data-application-part="features"></section>`
            + `<section class="tab" data-tab="inventory" data-group="primary" data-application-part="inventory"></section>`
            + `<section class="tab" data-tab="biography" data-group="primary" data-application-part="biography"><fieldset><legend>Background</legend>`
            + `<prose-mirror name="system.biography.background"></prose-mirror></fieldset></section></div>`;
        return root;
    };
    class Stand71 {
        constructor(actor, { pips = false } = {}) {
            this.id = `s71-${actor.id}`;
            this.document = actor;
            this.pips = pips;
            this.rendered = false;
            this.element = null;
            this.calls = 0;
            this.tabGroups = { primary: "features" };
            this.options = { classes: ["daggerheart", "sheet", "actor", "character"] };
        }
        get actor() { return this.document; }
        get isEditable() { return Boolean(this.document?.isOwner); }
        render() {
            this.calls++;
            const first = !this.rendered;
            const root = build(this.document, this.pips);
            if (this.element?.isConnected) this.element.replaceWith(root);
            else document.body.append(root);
            this.element = root;
            this.rendered = true;
            // A render hook per class of the chain, the concrete sheet's first (ApplicationV2; 12-social reads both).
            for (const name of ["renderCharacterSheet", "renderActorSheetV2"]) Hooks.callAll(name, this, root, {}, { isFirstRender: first });
            return Promise.resolve(this);
        }
        async close() {
            const root = this.element;
            root?.remove();
            this.rendered = false;
            Hooks.callAll("closeCharacterSheet", this, root);
            if (this.document?.apps) delete this.document.apps[this.id];
            if (Object.hasOwn(this.document, "sheet")) delete this.document.sheet;
            return this;
        }
    }
    const rowText = row => (row ? [...row.childNodes].map(node => (node.localName === "input" ? node.value : node.textContent)).join("") : null);
    globalThis.__s71 = {
        open(actor, options = {}) {
            globalThis.__s71.get(actor)?.close();
            const app = new Stand71(actor, options);
            actor.apps[app.id] = app;
            Object.defineProperty(actor, "sheet", { configurable: true, get: () => app });
            app.render(true);
            app.calls = 0;
            return app;
        },
        get(actor) { return actor?.apps?.[`s71-${actor.id}`] ?? null; },
        async closeAll() { for (const actor of game.actors) await globalThis.__s71.get(actor)?.close(); return true; },
        read(actor) {
            const app = globalThis.__s71.get(actor), root = app?.element ?? null;
            const block = key => root?.querySelector(`[data-drpg-reserve="${key}"]`) ?? null;
            const hp = block("hitPoints");
            return {
                calls: app?.calls ?? null, connected: Boolean(root?.isConnected),
                layout: hp ? (hp.classList.contains("slot-value") ? "pips" : "bar") : null,
                health: rowText(hp?.querySelector(".drpg-reserve-row")), sanity: rowText(block("stress")?.querySelector(".drpg-reserve-row")),
                pips: hp ? hp.querySelectorAll(".drpg-reserve-pip.drpg-pip-full").length : null,
                fill: hp?.querySelector(".drpg-resource-fill")?.style.width ?? null
            };
        },
        rowText
    };
    return true;
}

export async function run({ gm, p1, p2, check, note, phase, settle, repoUrl, IDS }) {
    const J = JSON.stringify;
    const counts = {};
    let current = null;
    const begin = (letter, name) => { phase(`${letter}: ${name}`); current = letter; counts[letter] = 0; };
    const verdict = (name, ok, details) => { counts[current]++; check(`${current}${counts[current]}: ${name}`, ok, typeof details === "string" ? details : J(details)); };
    /* A function of this file run in a client with its arguments (it sees the page's globals, not this file's). */
    const on = (client, fn, ...args) => client.eval(`return await (${fn.toString()})(${J(repoUrl)}, ...${J(args)});`, { timeout: 60000 });
    const all = { gm, p1, p2 };
    const each = async (fn, ...args) => {
        const out = {};
        for (const [who, client] of Object.entries(all)) out[who] = await on(client, fn, ...args);
        return out;
    };
    for (const client of Object.values(all)) await client.eval(`return await (${installStand.toString()})();`, { timeout: 30000 });

    /* Client-side steps, each `(repo, ...args)`. */
    const open = async (repo, actorId, options) => { globalThis.__s71.open(game.actors.get(actorId), options ?? {}); await new Promise(r => setTimeout(r, 200)); return globalThis.__s71.read(game.actors.get(actorId)); };
    const read = async (repo, actorId) => {
        const C = await import(`${repo}/scripts/character.mjs`);
        const actor = game.actors.get(actorId);
        const left = key => C.reserveOf(actor, key);
        const hp = left("hitPoints");
        return { ...globalThis.__s71.read(actor), want: game.i18n.format("DRPG.Reserve.leftRow", { n: hp.left, max: hp.max }), left: hp.left, max: hp.max, pct: hp.pct };
    };
    const zero = async (repo, actorId) => { const app = globalThis.__s71.get(game.actors.get(actorId)); if (app) app.calls = 0; return Boolean(app); };
    const closeAll = async () => globalThis.__s71.closeAll();
    /* The header's Hope as the sheet shows it: the diamonds drawn, those held (a solid glyph), those marked spent or
       gained (motion.mjs `markSpent`'s classes), the render calls since the open, and the Hope the client holds. */
    const hopeRead = async (repo, actorId) => {
        const actor = game.actors.get(actorId);
        const app = globalThis.__s71.get(actor);
        const slots = [...(app?.element?.querySelectorAll(".character-header-sheet .hope-section .hope-value") ?? [])];
        return { calls: app?.calls ?? null, slots: slots.length, held: slots.filter(s => s.querySelector("i.fa-solid")).length,
            marked: slots.filter(s => s.classList.contains("drpg-spent") || s.classList.contains("drpg-gained")).length,
            hope: Number(actor.system.resources.hope.value), max: Number(actor.system.resources.hope.max) };
    };
    const setLock = async (repo, value) => {
        const { SETTINGS } = await import(`${repo}/scripts/settings.mjs`);
        await game.settings.set("danganronpa-rpg", SETTINGS.lockPlayerResources, value);
        return game.settings.get("danganronpa-rpg", SETTINGS.lockPlayerResources);
    };
    const gmWrite = async (repo, actorId, changes) => {
        const { trustedWrite } = await import(`${repo}/scripts/resource-guard.mjs`);
        await trustedWrite(game.actors.get(actorId), changes, { reason: "gmRuling" });
        return true;
    };
    /* The field of the reserve, as an editor types into it: its value set and its change fired. */
    const typeField = async (repo, actorId, key, values, gapMs) => {
        const app = globalThis.__s71.get(game.actors.get(actorId));
        const typed = [];
        for (const n of values) {
            const field = app?.element?.querySelector(`[data-drpg-reserve="${key}"] input.drpg-reserve-field`);
            if (!field) { typed.push(null); continue; }
            field.value = String(n);
            field.dispatchEvent(new Event("change", { bubbles: true }));
            typed.push(n);
            if (gapMs) await new Promise(r => setTimeout(r, gapMs));
        }
        return typed;
    };
    const wait = ms => settle(ms);
    const same = (o, pred) => Object.values(o).every(pred);

    try {
        /* ------------------------------ A ------------------------------ */
        begin("A", "fast Health writes from the field and the GM: every client repaints, the same reserve");
        const lockA = await on(gm, setLock, false);
        await wait(400);
        const openedA = await each(open, IDS.aiko, {});
        const typedA = await on(p1, typeField, IDS.aiko, "hitPoints", [5, 4, 3], 0);
        await wait(900);
        const typedGmA = await on(gm, typeField, IDS.aiko, "hitPoints", [2, 1], 60);
        await wait(1500);
        const a1 = await each(read, IDS.aiko);
        console.log(`[71 A] ${J({ lockA, openedA, typedA, typedGmA, a1 })}`);
        verdict("the lock is off and Aiko's sheet stands open on gm, p1 and p2 in the bar layout, each with its field for an editor",
            lockA === false && same(openedA, o => o.connected && o.layout === "bar") && typedA.every(n => n !== null) && typedGmA.every(n => n !== null),
            { lockA, openedA, typedA, typedGmA });
        verdict("after p1's three writes and the GM's two, Aiko's Health left is 1 of 6 on every client",
            same(a1, r => r.left === 1 && r.max === 6), a1);
        verdict("no client rendered the sheet again: each repainted it in place (render calls 0 on gm, p1 and p2)",
            same(a1, r => r.calls === 0), a1);
        verdict("every client's sheet reads the reserve it holds: the row \"Left: 1 / 6\" and the bar filled to what is left",
            same(a1, r => r.health === r.want && r.fill === `${r.pct}%`), a1);

        // The pip layout on p1, the bar on p2 (D46: the same number in both).
        await on(p1, open, IDS.aiko, { pips: true });
        await on(p2, open, IDS.aiko, {});
        for (const c of [gm, p1, p2]) await on(c, zero, IDS.aiko);
        const typedPips = await on(p1, typeField, IDS.aiko, "hitPoints", [3, 4], 0);
        await wait(900);
        await on(gm, typeField, IDS.aiko, "hitPoints", [5], 0);
        await wait(1500);
        const a2 = await each(read, IDS.aiko);
        console.log(`[71 A pips] ${J({ typedPips, a2 })}`);
        verdict("with the pip layout on p1 and the bar on p2, after two writes of p1's and one of the GM's, every client repainted (calls 0)",
            a2.p1.layout === "pips" && a2.p2.layout === "bar" && typedPips.every(n => n !== null) && same(a2, r => r.calls === 0), { typedPips, a2 });
        verdict("p1's pips and p2's bar say the same reserve: 5 left of 6, five pips full, the bar at its percentage, the same row",
            a2.p1.left === 5 && a2.p1.pips === 5 && a2.p2.fill === `${a2.p2.pct}%` && same(a2, r => r.health === r.want && r.left === 5), a2);
        await on(gm, gmWrite, IDS.aiko, { "system.resources.hitPoints.value": 0 });
        await wait(800);

        /* ------------------------------ B ------------------------------ */
        begin("B", "a write cut in preUpdate leaves the next render whole: the item created after it is on every sheet");
        await on(p1, open, IDS.aiko, {});
        const lockB = await on(gm, setLock, true);
        await wait(600);
        for (const c of [gm, p1, p2]) await on(c, zero, IDS.aiko);
        const cut = await on(p1, async (repo, actorId) => {
            const actor = game.actors.get(actorId);
            const warn = ui.notifications.warn;
            ui.notifications.warn = () => null;
            const stressWas = Number(actor.system.resources.stress.value);
            try { await actor.update({ "system.resources.stress.value": stressWas + 2 }); } finally { ui.notifications.warn = warn; }
            await new Promise(r => setTimeout(r, 400));
            // Despair, in this browser's memory only: overflow.mjs cuts a Hope gain in this writer's own preUpdate.
            const { SETTINGS } = await import(`${repo}/scripts/settings.mjs`);
            const MODULE_ID = "danganronpa-rpg";
            const real = game.settings.get, clock = real.call(game.settings, MODULE_ID, SETTINGS.clock) ?? {};
            const stamp = { session: clock.session, day: clock.day, timeOfDay: clock.timeOfDay };
            const hopeWas = Number(actor.system.resources.hope.value);
            game.settings.get = function (module, key, ...rest) {
                if (module === MODULE_ID && key === SETTINGS.overflow) return { active: { ...stamp, effect: "despair" } };
                if (module === MODULE_ID && key === SETTINGS.overflowRules) return {};
                return real.call(this, module, key, ...rest);
            };
            ui.notifications.warn = () => null;
            try { await actor.update({ "system.resources.hope.value": hopeWas + 1 }); } finally { game.settings.get = real; ui.notifications.warn = warn; }
            await new Promise(r => setTimeout(r, 400));
            return { stress: [stressWas, Number(actor.system.resources.stress.value)], hope: [hopeWas, Number(actor.system.resources.hope.value)] };
        }, IDS.aiko);
        await wait(800);
        const itemName = "S71 B the item after a cut";
        const made = await on(gm, async (repo, actorId, name) => {
            const [item] = await game.actors.get(actorId).createEmbeddedDocuments("Item", [{ name, type: "loot", system: { description: "", quantity: 1 } }]);
            return item?.id ?? null;
        }, IDS.aiko, itemName);
        await wait(1500);
        const b1 = await each(async (repo, actorId, name) => {
            const app = globalThis.__s71.get(game.actors.get(actorId));
            const part = app?.element?.querySelector('[data-application-part="inventory"]');
            return { calls: app?.calls ?? null, row: Boolean(part?.textContent?.includes(name)), connected: Boolean(app?.element?.isConnected) };
        }, IDS.aiko, itemName);
        console.log(`[71 B] ${J({ lockB, cut, made, b1 })}`);
        verdict("with the lock on, p1's Sanity write is cut by resource-guard.mjs and p1's Hope gain under Despair by overflow.mjs: neither is written",
            lockB === true && cut.stress[0] === cut.stress[1] && cut.hope[0] === cut.hope[1], { lockB, cut });
        // p2's view of Aiko is redacted: anonymity.mjs empties its inventory pane, so the row is read on the GM's and the owner's.
        verdict("the GM creates an item on Aiko: every client renders the sheet for it (calls 1 or more); its row is in the inventory on gm and p1, and not on p2's redacted view",
            Boolean(made) && same(b1, r => r.connected && r.calls >= 1) && b1.gm.row && b1.p1.row && !b1.p2.row, { made, b1 });
        await on(gm, async (repo, actorId, id) => { await game.actors.get(actorId).deleteEmbeddedDocuments("Item", [id]); return true; }, IDS.aiko, made);
        await on(gm, setLock, false);
        await wait(800);

        /* ------------------------------ C ------------------------------ */
        begin("C", "the Monocub's Confusion tile turns affordable on the GM's Hope top-up, with no render");
        const monocubOn = await on(gm, async (repo, actorId) => {
            const { FLAGS } = await import(`${repo}/scripts/config.mjs`);
            const { trustedWrite } = await import(`${repo}/scripts/resource-guard.mjs`);
            const actor = game.actors.get(actorId);
            await trustedWrite(actor, { "system.resources.hope.value": 0 }, { reason: "gmRuling" });
            await actor.setFlag("danganronpa-rpg", FLAGS.monocub, true);
            return true;
        }, IDS.aiko);
        await wait(1000);
        const tile = async (repo, actorId) => {
            const { MONOCUB } = await import(`${repo}/scripts/config.mjs`);
            const app = globalThis.__s71.get(game.actors.get(actorId));
            const label = MONOCUB.abilities.confusion?.label ?? Object.values(MONOCUB.abilities)[0]?.label;
            const buttons = [...(app?.element?.querySelectorAll(".drpg-monocub-panel .drpg-action-button") ?? [])];
            const button = buttons.find(b => b.querySelector(".drpg-action-name")?.textContent?.split(String.fromCharCode(173)).join("").trim() === label) ?? null;
            return { calls: app?.calls ?? null, panel: Boolean(app?.element?.querySelector(".drpg-monocub-panel")), found: Boolean(button),
                affordable: button ? !button.classList.contains("unaffordable") : null, hope: Number(game.actors.get(actorId).system.resources.hope.value) };
        };
        await on(p1, open, IDS.aiko, {});
        const c0 = await on(p1, tile, IDS.aiko);
        await on(gm, gmWrite, IDS.aiko, { "system.resources.hope.value": 1 });
        await wait(1500);
        const c1 = await on(p1, tile, IDS.aiko);
        console.log(`[71 C] ${J({ monocubOn, c0, c1 })}`);
        verdict("Aiko a Monocub with no Hope: p1's sheet draws the Monocub's panel with Confusion unaffordable",
            monocubOn && c0.panel && c0.found && c0.affordable === false && c0.hope === 0, c0);
        verdict("the GM gives her one Hope: on p1's sheet Confusion is affordable, and the sheet was not rendered again (calls 0)",
            c1.found && c1.affordable === true && c1.hope === 1 && c1.calls === 0, c1);
        await on(gm, async (repo, actorId) => {
            const { FLAGS } = await import(`${repo}/scripts/config.mjs`);
            const actor = game.actors.get(actorId);
            await actor.unsetFlag("danganronpa-rpg", FLAGS.monocub);
            const { trustedWrite } = await import(`${repo}/scripts/resource-guard.mjs`);
            await trustedWrite(actor, { "system.resources.hope.value": 2 }, { reason: "gmRuling" });
            return true;
        }, IDS.aiko);
        await wait(800);

        /* ------------------------------ D ------------------------------ */
        begin("D", "a hit read alike on every client's sheet and the token's bar; no Sanity on a viewer's");
        for (const c of [gm, p1, p2]) await on(c, open, IDS.aiko, {});
        await on(gm, gmWrite, IDS.aiko, { "system.resources.hitPoints.value": 2, "system.resources.stress.value": 1 });
        await wait(1500);
        const d1 = await each(async (repo, actorId) => {
            const C = await import(`${repo}/scripts/character.mjs`);
            const actor = game.actors.get(actorId);
            const token = game.scenes.contents.flatMap(s => s.tokens.contents).find(t => t.actorId === actorId) ?? null;
            const bar = attr => { try { return token?.getBarAttribute?.("bar1", { alternative: attr }) ?? null; } catch { return "threw"; } };
            const hp = C.reserveOf(actor, "hitPoints"), st = C.reserveOf(actor, "stress");
            const app = globalThis.__s71.get(actor);
            return { ...globalThis.__s71.read(actor), want: game.i18n.format("DRPG.Reserve.leftRow", { n: hp.left, max: hp.max }),
                left: hp.left, sanityLeft: st.left, barHp: bar("resources.hitPoints"), barSt: bar("resources.stress"),
                sanityDigits: (app?.element?.querySelector('[data-drpg-reserve="stress"]')?.textContent ?? "").match(/\d/g)?.length ?? 0 };
        }, IDS.aiko);
        console.log(`[71 D] ${J(d1)}`);
        verdict("after the GM's hit (2 marks of 6), Aiko's sheet on gm, p1 and p2 reads \"Left: 4 / 6\"",
            same(d1, r => r.left === 4 && r.health === r.want), d1);
        verdict("the token's Health bar attribute says the same reserve on every client: 4 of 6",
            same(d1, r => r.barHp && r.barHp.value === 4 && r.barHp.max === 6), Object.fromEntries(Object.entries(d1).map(([k, r]) => [k, r.barHp])));
        verdict("p2 reads no Sanity of Aiko's: no number in the sheet's Sanity block and none in the token's Sanity bar; p1 and the GM read 5 left",
            d1.p2.sanityDigits === 0 && !(d1.p2.barSt && Number.isFinite(d1.p2.barSt.value)) && d1.p1.sanityDigits > 0 && d1.gm.sanityDigits > 0,
            Object.fromEntries(Object.entries(d1).map(([k, r]) => [k, { barSt: r.barSt, digits: r.sanityDigits, sanity: r.sanity }])));

        /* ------------------------------ E ------------------------------ */
        begin("E", "the gates on live sheets: dead, a Monocub, an NPC and Monokuma, as owner and viewer");
        const modeOn = async (repo, actorId) => {
            const S = await import(`${repo}/scripts/sheet.mjs`);
            const actor = game.actors.get(actorId);
            const app = globalThis.__s71.open(actor, {});
            await new Promise(r => setTimeout(r, 250));
            const m = S.sheetMode(actor, game.user, { app });
            const root = app.element;
            const drawn = root.querySelector(".drpg-monocub-panel") ? "monocub" : root.querySelector(".drpg-npc-panel") ? "npc"
                : root.querySelector(".drpg-despair-panel") ? "calls" : root.querySelector(".drpg-action-panel") ? "panel" : null;
            return { mode: m.mode, actions: m.actions, use: m.rows.use, drawn };
        };
        const flagOn = async (repo, actorId, flag, value) => {
            const { FLAGS } = await import(`${repo}/scripts/config.mjs`);
            const actor = game.actors.get(actorId);
            if (value) await actor.setFlag("danganronpa-rpg", FLAGS[flag], true);
            else await actor.unsetFlag("danganronpa-rpg", FLAGS[flag]);
            return true;
        };
        const matrix = {};
        const killed = await on(gm, async (repo, actorId) => {
            const { killCharacter } = await import(`${repo}/scripts/chapter.mjs`);
            return Boolean(await killCharacter(game.actors.get(actorId), { secret: false, keepBullets: true }));
        }, IDS.aiko);
        await wait(1500);
        matrix.dead = { owner: await on(p1, modeOn, IDS.aiko), viewer: await on(p2, modeOn, IDS.aiko) };
        /* B3 (E45-C3b; E24 fix G2B, general m3): a dead student's Hope write repaints her sheet and marks nothing - her
           header is still, as `flashHope` keeps it on a render. Read on the owner's and the GM's sheets. */
        await on(gm, gmWrite, IDS.aiko, { "system.resources.hope.value": 2 });
        await wait(600);
        for (const c of [gm, p1]) await on(c, open, IDS.aiko, {});
        await on(gm, gmWrite, IDS.aiko, { "system.resources.hope.value": 1 });
        await wait(1200);
        const deadHope = { gm: await on(gm, hopeRead, IDS.aiko), p1: await on(p1, hopeRead, IDS.aiko) };
        console.log(`[71 E dead Hope] ${J(deadHope)}`);
        // A Monocub is a dead student who plays on (D15): the flag on the body, then off before she is revived.
        await on(gm, flagOn, IDS.aiko, "monocub", true);
        await wait(800);
        matrix.monocub = { owner: await on(p1, modeOn, IDS.aiko), viewer: await on(p2, modeOn, IDS.aiko) };
        await on(gm, flagOn, IDS.aiko, "monocub", false);
        await on(gm, async (repo, actorId) => {
            const { reviveCharacter } = await import(`${repo}/scripts/chapter.mjs`);
            await reviveCharacter(game.actors.get(actorId), { quiet: true });
            return true;
        }, IDS.aiko);
        await wait(1200);
        await on(gm, flagOn, IDS.aiko, "notInClass", true);
        await wait(800);
        matrix.npc = { owner: await on(p1, modeOn, IDS.aiko), viewer: await on(p2, modeOn, IDS.aiko), gm: await on(gm, modeOn, IDS.aiko) };
        await on(gm, flagOn, IDS.aiko, "notInClass", false);
        await wait(800);
        const monokumaId = await gm.eval(`return game.actors.find(a => a.getFlag("${MOD}", "monokuma"))?.id ?? null;`);
        matrix.monokuma = { owner: await on(gm, modeOn, monokumaId), viewer: await on(p1, modeOn, monokumaId) };
        matrix.student = { owner: await on(p1, modeOn, IDS.aiko), viewer: await on(p2, modeOn, IDS.aiko) };
        console.log(`[71 E] ${J({ killed, matrix })}`);
        const WANT = {
            dead: { owner: { mode: "dead", actions: "dead", use: false, drawn: "panel" }, viewer: { mode: "dead", actions: null, use: false, drawn: null } },
            monocub: { owner: { mode: "monocub", actions: "monocub", use: false, drawn: "monocub" }, viewer: { mode: "monocub", actions: null, use: false, drawn: null } },
            npc: { owner: { mode: "npc", actions: null, use: true, drawn: null }, viewer: { mode: "npc", actions: null, use: false, drawn: null },
                gm: { mode: "npc", actions: "npc", use: true, drawn: "npc" } },
            monokuma: { owner: { mode: "monokuma", actions: "calls", use: false, drawn: "calls" }, viewer: { mode: "monokuma", actions: null, use: false, drawn: null } },
            student: { owner: { mode: "student", actions: "grid", use: true, drawn: "panel" }, viewer: { mode: "student", actions: null, use: false, drawn: null } }
        };
        verdict("Aiko is dead on a published death", killed, { killed });
        verdict("her Hope written 2 -> 1 while dead: the sheet on gm and p1 is repainted (calls 0), one diamond held, and no diamond marked spent or gained",
            same(deadHope, r => r.calls === 0 && r.held === 1 && r.slots > 0 && r.marked === 0), deadHope);
        for (const kind of Object.keys(WANT)) {
            verdict(`${kind}: the mode each viewer's sheet was drawn in, and the action panel drawn for it`, J(matrix[kind]) === J(WANT[kind]), { got: matrix[kind], want: WANT[kind] });
        }
        await each(closeAll);

        /* ------------------------------ F ------------------------------ */
        begin("F", "the biography: saved once by the X and by a tab change, nothing for an untouched sheet, read-only for a viewer");
        await gm.eval(`globalThis.__s71Bio = []; globalThis.__s71BioHook = Hooks.on("updateActor", (doc, changes) => {
            const v = foundry.utils.getProperty(changes, "system.biography.background");
            if (doc.id === "${IDS.aiko}" && v !== undefined) globalThis.__s71Bio.push(v);
        }); return true;`);
        const bioWas = await gm.eval(`return game.actors.get("${IDS.aiko}").system.biography.background;`);
        const typeBio = async (repo, actorId, text, how) => {
            const actor = game.actors.get(actorId);
            const app = globalThis.__s71.open(actor, {});
            await new Promise(r => setTimeout(r, 200));
            const area = app.element.querySelector("textarea.drpg-biography-text");
            const pane = app.element.querySelector('[data-application-part="biography"]');
            const shape = { area: Boolean(area), readOnly: area ? area.readOnly : null, name: area ? area.getAttribute("name") : null,
                pane: Boolean(pane), redacted: app.element.classList.contains("drpg-redacted-sheet") };
            if (area && text !== null) {
                area.focus();
                area.value = text;
                area.dispatchEvent(new Event("input", { bubbles: true }));
            }
            if (how === "close") await app.close();
            else if (how === "tab") app.element.querySelector('nav [data-tab="inventory"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
            await new Promise(r => setTimeout(r, 600));
            if (how === "tab") await app.close();
            return shape;
        };
        const fBio = async () => gm.eval(`return { writes: [...globalThis.__s71Bio], now: game.actors.get("${IDS.aiko}").system.biography.background };`);
        const fx = await on(p1, typeBio, IDS.aiko, "S71 F typed, then the X", "close");
        await wait(1200);
        const f1 = await fBio();
        await on(p1, typeBio, IDS.aiko, "S71 F typed, then a tab", "tab");
        await wait(1200);
        const f2 = await fBio();
        await on(p1, typeBio, IDS.aiko, null, "close");
        await wait(1200);
        const f3 = await fBio();
        const fv = await on(p2, typeBio, IDS.aiko, null, "close");
        console.log(`[71 F] ${J({ fx, f1, f2, f3, fv })}`);
        verdict("p1's biography is a field of the module's, not Daggerheart's form (no `name`)", fx.area && fx.readOnly === false && fx.name === null, fx);
        verdict("typed and closed by its X: saved once, the text typed", J(f1.writes) === J(["S71 F typed, then the X"]) && f1.now === "S71 F typed, then the X", f1);
        verdict("typed and the tab changed: saved once more, the new text", J(f2.writes) === J(["S71 F typed, then the X", "S71 F typed, then a tab"]) && f2.now === "S71 F typed, then a tab", f2);
        verdict("opened and closed untouched: nothing written", f3.writes.length === 2, f3);
        // A viewer's sheet of a student is redacted (anonymity.mjs empties the pane): no field to type into at all.
        verdict("p2, a viewer, has no field it can type into: the pane is drawn and redacted, the field absent or read-only",
            fv.pane && fv.redacted && (!fv.area || fv.readOnly === true) && J(f3.writes) === J((await fBio()).writes), fv);
        await gm.eval(`Hooks.off("updateActor", globalThis.__s71BioHook); return true;`);
        await on(gm, gmWrite, IDS.aiko, { "system.biography.background": bioWas });
        await wait(600);

        /* ------------------------------ G ------------------------------ */
        begin("G", "the redacted sheet: no Sanity number anywhere on p2's view of Aiko, Health's row there");
        const scan = async (repo, actorId) => {
            const C = await import(`${repo}/scripts/character.mjs`);
            const actor = game.actors.get(actorId);
            const app = globalThis.__s71.open(actor, {});
            await new Promise(r => setTimeout(r, 250));
            const root = app.element;
            const st = C.reserveOf(actor, "stress"), hp = C.reserveOf(actor, "hitPoints");
            const sanityBlock = root.querySelector('[data-drpg-reserve="stress"]');
            const attrs = [];
            for (const el of root.querySelectorAll("[data-tooltip], [aria-label], [title]")) {
                for (const name of ["data-tooltip", "aria-label", "title"]) if (el.hasAttribute(name)) attrs.push(el.getAttribute(name));
            }
            const sanityWords = /sanity|stress|poczytalno/i;
            const leaks = attrs.filter(a => (sanityWords.test(a) && /\d/.test(a)) || a.includes(`${st.left} / ${st.max}`) || a.includes(`${st.left}/${st.max}`));
            const inBlock = sanityBlock ? [...sanityBlock.querySelectorAll("*")].flatMap(el => [...el.attributes].filter(at => /\d/.test(at.value) && !["class", "style", "min"].includes(at.name)).map(at => `${at.name}=${at.value}`)) : null;
            return { attrs: attrs.length, leaks, inBlock, row: globalThis.__s71.rowText(sanityBlock?.querySelector(".drpg-reserve-row")),
                health: globalThis.__s71.rowText(root.querySelector('[data-drpg-reserve="hitPoints"] .drpg-reserve-row')),
                wantHealth: game.i18n.format("DRPG.Reserve.leftRow", { n: hp.left, max: hp.max }), sanityLeft: st.left };
        };
        const gView = await on(p2, scan, IDS.aiko);
        const gOwner = await on(p1, scan, IDS.aiko);
        console.log(`[71 G] ${J({ gView, gOwner })}`);
        verdict("the owner's sheet carries Aiko's Sanity (the scan reads something): its row names the number left",
            Boolean(gOwner.row) && gOwner.row.includes(String(gOwner.sanityLeft)), gOwner);
        verdict("p2's view: Sanity's row has no digit, its block no number in an attribute, and no tooltip, label or title anywhere says a Sanity number",
            gView.attrs > 0 && gView.row !== null && !/\d/.test(gView.row) && Array.isArray(gView.inBlock) && gView.inBlock.length === 0 && gView.leaks.length === 0, gView);
        verdict("p2's view keeps Health's row: \"Left: 4 / 6\"", gView.health === gView.wantHealth, gView);
        await each(closeAll);

        /* ------------------------------ H ------------------------------ */
        begin("H", "the Level Up offer's cycle: offered, taken by p1, offered again and taken back by the GM");
        const lit = async (repo, actorId) => {
            const app = globalThis.__s71.get(game.actors.get(actorId));
            const button = app?.element?.querySelector(".character-header-sheet [data-drpg-advance]") ?? null;
            const L = await import(`${repo}/scripts/level-up.mjs`);
            return { button: Boolean(button), offered: Boolean(button?.classList.contains("is-offered")), calls: app?.calls ?? null,
                standing: L.standingOffers(game.actors.get(actorId)).length };
        };
        await on(gm, open, IDS.aiko, {});
        await on(p1, open, IDS.aiko, {});
        const h0 = { gm: await on(gm, lit, IDS.aiko), p1: await on(p1, lit, IDS.aiko) };
        const offer = async (repo, actorId) => {
            const L = await import(`${repo}/scripts/level-up.mjs`);
            const made = await L.offerAdvancement(game.actors.get(actorId), "standard", { quiet: true });
            return Boolean(made);
        };
        const offered1 = await on(gm, offer, IDS.aiko);
        await wait(1500);
        const h1 = { gm: await on(gm, lit, IDS.aiko), p1: await on(p1, lit, IDS.aiko) };
        const taken = await on(p1, async (repo, actorId) => {
            const L = await import(`${repo}/scripts/level-up.mjs`);
            const B = await import(`${repo}/scripts/gm-bridge.mjs`);
            const actor = game.actors.get(actorId);
            const pending = L.pendingAdvance(actor);
            const experience = Object.keys(actor.system.experiences ?? {}).find(id => actor.system.experiences[id]?.name === "Star Pupil") ?? null;
            const res = await B.requestAdvancement({ actorId, kind: pending?.kind ?? "standard", offerId: pending?.id ?? null,
                picks: [{ option: "experienceUp", experience }] });
            return { pending: Boolean(pending), ok: res?.ok === true && !res?.refused, reason: res?.reason ?? res?.refused ?? null };
        }, IDS.aiko);
        await wait(2000);
        const h2 = { gm: await on(gm, lit, IDS.aiko), p1: await on(p1, lit, IDS.aiko) };
        const offered2 = await on(gm, offer, IDS.aiko);
        await wait(1500);
        const h3 = { gm: await on(gm, lit, IDS.aiko), p1: await on(p1, lit, IDS.aiko) };
        const back = await on(gm, async (repo, actorId) => {
            const L = await import(`${repo}/scripts/level-up.mjs`);
            const actor = game.actors.get(actorId);
            const [standing] = L.standingOffers(actor);
            return standing ? L.takeBackOffer(actor, standing.id) : false;
        }, IDS.aiko);
        await wait(1500);
        const h4 = { gm: await on(gm, lit, IDS.aiko), p1: await on(p1, lit, IDS.aiko) };
        console.log(`[71 H] ${J({ h0, offered1, h1, taken, h2, offered2, h3, back, h4 })}`);
        verdict("before an offer: the GM's button stands unlit, p1 has none", h0.gm.button && !h0.gm.offered && !h0.p1.button, h0);
        verdict("the GM offers a Level Up: lit on p1's sheet and on the GM's", offered1 && h1.p1.offered && h1.gm.offered, { offered1, h1 });
        verdict("p1 takes it through the bridge: the offer is spent on the GM's store and p1's button is gone",
            taken.pending && taken.ok && h2.gm.standing === 0 && h2.p1.standing === 0 && !h2.p1.button, { taken, h2 });
        /* E45-C3b's B1 (C3a's Open 1, measured 08.11.2026 on 52955be4 + C3a): after a player's take the GM's own sheet
           kept the lit button - level-up.mjs `applyAdvancement` writes the rises (the sheet renders for them, the offer
           still standing) and withdraws the offer after, and `dropOffer` told the owners only; nothing rendered the GM's
           sheet again. Red on da8e8a3b; `dropOffer` now draws the character's open sheet on the GM that drops it. */
        verdict("after p1's take the GM's own sheet is drawn again: its button stands unlit, the offer spent",
            h2.gm.button && !h2.gm.offered && h2.gm.standing === 0, { gm: h2.gm });
        verdict("offered again: lit on both", offered2 && h3.p1.offered && h3.gm.offered, { offered2, h3 });
        verdict("the GM takes it back: p1's button is gone and the GM's unlit", back === true && !h4.p1.button && h4.gm.button && !h4.gm.offered, { back, h4 });
        await each(closeAll);

        /* ------------------------------ I ------------------------------ */
        /* E45-C3b's B2 (general n6): p1 holds biography text not yet saved while the GM writes the background. Measured
           on da8e8a3b: p1's next save wrote p1's text over the GM's, no word said. Now (Q-E45-C3b-1's default) that save
           writes nothing: the GM's text stands, p1's stays in the field unsaved, p1 is told once; p1's next save writes
           theirs. */
        begin("I", "the biography held unsaved while the GM writes it: the GM's write stands, p1 told once, p1's next save writes p1's");
        const bioWasI = await gm.eval(`return game.actors.get("${IDS.aiko}").system.biography.background;`);
        const bioStep = async (repo, actorId, step, text) => {
            const actor = game.actors.get(actorId);
            if (!globalThis.__s71Told) {
                globalThis.__s71Told = [];
                for (const kind of ["info", "warn", "error"]) {
                    const own = ui.notifications[kind]?.bind(ui.notifications);
                    ui.notifications[kind] = (message, ...rest) => { globalThis.__s71Told.push(String(message)); return own?.(message, ...rest); };
                }
            }
            if (step === "type") {
                const app = globalThis.__s71.open(actor, {});
                await new Promise(r => setTimeout(r, 200));
                const area = app.element.querySelector("textarea.drpg-biography-text");
                area.focus();
                area.value = text;
                area.dispatchEvent(new Event("input", { bubbles: true }));
            } else if (step === "save") {
                globalThis.__s71.get(actor)?.element?.querySelector('nav [data-tab="inventory"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
                await new Promise(r => setTimeout(r, 300));
            }
            const app = globalThis.__s71.get(actor);
            const words = game.i18n.localize("DRPG.Sheet.biographyChanged");
            return { field: app?.element?.querySelector("textarea.drpg-biography-text")?.value ?? null, calls: app?.calls ?? null,
                stored: actor.system.biography.background, told: globalThis.__s71Told.filter(m => m === words).length };
        };
        const P1_TEXT = "S71 I p1's text, typed and not saved", GM_TEXT = "S71 I the GM's edit, made meanwhile";
        const i0 = await on(p1, bioStep, IDS.aiko, "type", P1_TEXT);
        await on(gm, gmWrite, IDS.aiko, { "system.biography.background": GM_TEXT });
        await wait(1200);
        const i1 = await on(p1, bioStep, IDS.aiko, "read");
        await on(p1, bioStep, IDS.aiko, "save");
        await wait(1200);
        const i2 = { p1: await on(p1, bioStep, IDS.aiko, "read"), gm: await gm.eval(`return game.actors.get("${IDS.aiko}").system.biography.background;`) };
        await on(p1, bioStep, IDS.aiko, "save");
        await wait(1200);
        const i3 = { p1: await on(p1, bioStep, IDS.aiko, "read"), gm: await gm.eval(`return game.actors.get("${IDS.aiko}").system.biography.background;`) };
        console.log(`[71 I] ${J({ i0, i1, i2, i3 })}`);
        verdict("the GM's write reaches p1 while p1 types: p1's sheet is drawn again and its field keeps p1's unsaved text",
            i0.field === P1_TEXT && i1.stored === GM_TEXT && i1.calls >= 1 && i1.field === P1_TEXT, { i0, i1 });
        verdict("p1's save after the GM's write writes nothing: the GM's text stands on the GM, p1's stays in p1's field, and p1 is told once",
            i2.gm === GM_TEXT && i2.p1.stored === GM_TEXT && i2.p1.field === P1_TEXT && i2.p1.told === 1, i2);
        verdict("p1's next save writes p1's text, and says nothing more", i3.gm === P1_TEXT && i3.p1.told === 1, i3);
        await each(closeAll);
        await on(gm, gmWrite, IDS.aiko, { "system.biography.background": bioWasI });
        await wait(600);

        /* ------------------------------ J ------------------------------ */
        /* E45-C3b's B3: fixes already on the tree, on live clients (E24 fix G2B; security "For 71"). */
        begin("J", "the Party sheet's Sanity, a redacted sheet's repaint, a Hope maximum written alone");
        // The Party sheet's member row for Aiko, as party-members.hbs draws it (2.10.5), painted by the module's hook.
        const partyRead = async (repo, actorId) => {
            const actor = game.actors.get(actorId);
            const section = (key, tip, action) => {
                const { value, max } = actor.system.resources[key];
                let slots = "";
                for (let n = 1; n <= max; n++) slots += `<span class="slot${value >= n ? " filled" : ""}" data-action="${action}" data-value="${n}"></span>`;
                return `<div class="slot-section"><div class="slot-label" data-tooltip="${tip}"><span class="label"><i class="fa-solid" inert></i></span>`
                    + `<span class="value"><span class="current">${value}</span> / <span class="max">${max}</span></span></div><div class="slot-bar">${slots}</div></div>`;
            };
            const root = document.createElement("div");
            root.innerHTML = `<ul class="actors-list"><li class="actor-resources"><header><a data-action="openDocument" data-uuid="Actor.${actor.id}">${actor.name}</a></header>`
                + `<section class="body"><section class="resources">${section("hitPoints", "DAGGERHEART.GENERAL.HitPoints.plural", "toggleHitPoints")}`
                + `${section("stress", "DAGGERHEART.GENERAL.stress", "toggleStress")}</section></section></li></ul>`;
            Hooks.callAll("renderPartySheet", {}, root);
            const of = tip => root.querySelector(`.slot-label[data-tooltip="${tip}"]`)?.closest(".slot-section") ?? null;
            const st = of("DAGGERHEART.GENERAL.stress"), hp = of("DAGGERHEART.GENERAL.HitPoints.plural");
            const text = el => el?.querySelector(".slot-label .value")?.textContent.replace(/\s+/g, " ").trim() ?? null;
            return { sanity: text(st), sanitySlots: st?.querySelectorAll(".slot").length ?? null, health: text(hp),
                healthSlots: hp?.querySelectorAll(".slot").length ?? null, sanityMax: Number(actor.system.resources.stress.max) };
        };
        const j1 = await each(partyRead, IDS.aiko);
        console.log(`[71 J party] ${J(j1)}`);
        verdict("the Party sheet: Sanity's row on gm and p1 has its slots and a number; on p2's it reads \"?\" with no slot (S-2), Health's slots there",
            [j1.gm, j1.p1].every(r => r.sanitySlots === r.sanityMax && /\d/.test(r.sanity ?? "")) && j1.p2.sanity === "?" && j1.p2.sanitySlots === 0 && j1.p2.healthSlots > 0, j1);

        // A redacted sheet repainted: p1 (the owner) writes Sanity from the field and Hope by hand with the lock off.
        const lockWasJ = await gm.eval(`return game.settings.get("${MOD}", "lockPlayerResources");`);
        await on(gm, setLock, false);
        await on(gm, gmWrite, IDS.aiko, { "system.resources.hope.value": 3, "system.resources.stress.value": 1 });
        await wait(800);
        for (const c of [p1, p2]) await on(c, open, IDS.aiko, {});
        const stLeft = await on(p1, async (repo, actorId) => (await import(`${repo}/scripts/character.mjs`)).reserveOf(game.actors.get(actorId), "stress").left, IDS.aiko);
        const typedJ = await on(p1, typeField, IDS.aiko, "stress", [stLeft - 1], 0);
        await wait(900);
        const hopeJ = await p1.eval(`await game.actors.get("${IDS.aiko}").update({ "system.resources.hope.value": 2 }); return game.actors.get("${IDS.aiko}").system.resources.hope.value;`);
        await wait(1200);
        const redactRead = async (repo, actorId) => {
            const actor = game.actors.get(actorId);
            const app = globalThis.__s71.get(actor), root = app?.element ?? null;
            const stress = root?.querySelector('[data-drpg-reserve="stress"]') ?? null;
            const hope = root?.querySelector(".character-header-sheet .hope-section") ?? null;
            const numbered = el => (el ? [el, ...el.querySelectorAll("*")] : []).flatMap(node => [...node.attributes]
                .filter(at => /\d/.test(at.value) && !["style", "min"].includes(at.name)).map(at => `${at.name}=${at.value}`));
            const attrs = [];
            for (const el of root?.querySelectorAll("[data-tooltip], [aria-label], [title]") ?? []) {
                for (const name of ["data-tooltip", "aria-label", "title"]) if (el.hasAttribute(name)) attrs.push(el.getAttribute(name));
            }
            return { calls: app?.calls ?? null, redacted: Boolean(root?.classList.contains("drpg-redacted-sheet")),
                row: globalThis.__s71.rowText(stress?.querySelector(".drpg-reserve-row")), stressText: stress?.textContent ?? null, stressAttrs: numbered(stress),
                stressClasses: stress ? [...stress.querySelectorAll(".filled, .drpg-pip-full, .drpg-spent, .drpg-gained")].length : null,
                hopeText: hope?.textContent ?? null, hopeAttrs: numbered(hope), hopeSlots: hope ? hope.querySelectorAll(".hope-value").length : null,
                hopeClasses: hope ? [...hope.querySelectorAll("i.fa-solid, i.fa-regular, .drpg-spent, .drpg-gained")].length : null,
                hopeMarked: hope ? hope.querySelectorAll(".drpg-spent, .drpg-gained").length : null,
                tips: attrs.filter(a => /sanity|stress|poczytalno|hope|nadziej/i.test(a) && /\d/.test(a)),
                sanityLeft: Number(actor.system.resources.stress.max) - Number(actor.system.resources.stress.value), hopeNow: Number(actor.system.resources.hope.value) };
        };
        const j2 = { p2: await on(p2, redactRead, IDS.aiko), p1: await on(p1, redactRead, IDS.aiko), p1Hope: await on(p1, hopeRead, IDS.aiko) };
        console.log(`[71 J redacted] ${J({ stLeft, typedJ, hopeJ, j2 })}`);
        verdict("p1's own writes landed and p1's sheet shows them: the new Sanity in its row, two diamonds held, the spent one marked",
            typedJ[0] !== null && hopeJ === 2 && j2.p1.row?.includes(String(j2.p1.sanityLeft)) && j2.p1Hope.held === 2 && j2.p1Hope.marked > 0,
            { typedJ, hopeJ, p1: j2.p1, p1Hope: j2.p1Hope });
        // E49 B2 (the owner's Q1, 10.11.2026: a request - Hope's maximum reads "?" too): Hope is ONE "?", no diamond a
        // maximum could be counted from, and no `data-value` on it (read as a number since; it was let through before).
        verdict("p2's redacted sheet repainted for both writes (calls 0) and holds no Sanity or Hope number: none in the text, attributes or classes of either block, nor in a tooltip, label or title; Hope one \"?\" in one slot",
            j2.p2.redacted && j2.p2.calls === 0 && !/\d/.test(j2.p2.stressText ?? "x1") && j2.p2.stressAttrs.length === 0 && j2.p2.stressClasses === 0
                && j2.p2.hopeText === "?" && j2.p2.hopeSlots === 1 && j2.p2.hopeAttrs.length === 0 && j2.p2.hopeClasses === 0 && j2.p2.tips.length === 0, j2.p2);

        // A Hope maximum written alone (n1): the diamonds follow it on every sheet holding it.
        for (const c of [gm, p1]) await on(c, open, IDS.aiko, {});
        const maxWas = await gm.eval(`return game.actors.get("${IDS.aiko}").system.resources.hope.max;`);
        await on(gm, gmWrite, IDS.aiko, { "system.resources.hope.max": maxWas - 1 });
        await wait(1200);
        const j3 = { gm: await on(gm, hopeRead, IDS.aiko), p1: await on(p1, hopeRead, IDS.aiko) };
        await on(gm, gmWrite, IDS.aiko, { "system.resources.hope.max": maxWas });
        await wait(600);
        console.log(`[71 J max] ${J({ maxWas, j3 })}`);
        verdict("the GM writes Hope's maximum alone (one less): the sheet on gm and p1 draws that many diamonds",
            same(j3, r => r.max === maxWas - 1 && r.slots === maxWas - 1), { maxWas, j3 });
        await on(gm, setLock, lockWasJ);
    } finally {
        await each(closeAll).catch(() => null);
    }
}
