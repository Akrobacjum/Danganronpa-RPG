/**
 * S7 on Forge: the windows a table uses most, photographed and measured (the road to 2.0, F3; written 24.11.2026,
 * NEVER RUN).
 * ---------------------------------------------------------------------------
 *     DRPG_FORGE_URL=... DRPG_FORGE_WORLD=DRPG-QA-Forge DRPG_FULL_RENDER=1 node audit/forge/run.mjs s7-look
 *     (and again with DRPG_BROWSER=firefox: the messenger's write box grows by CSS `field-sizing`, which Firefox may lack)
 *
 * GM1 and P1, Stained Glass (D2-03), at each of DRPG_SIZES - 1920x1080 and 2560x1440 by default, the owner's targets (D2-20) - (`page.setViewportSize`). At each size, on the page that
 * uses it, each window is opened as the table opens it (the module's API: the launcher's own road), given 1.5 s to
 * settle, measured, photographed (`ctx.shot`, `<role>-<w>x<h>-<window>.png`) and closed:
 *   GM1   the HUD, the GM panel, the messenger on P1's thread, P1's character sheet, the Students window, Investigation,
 *         the Class Trial console
 *   P1    the HUD, the messenger, the character sheet, a notification stack (six of Foundry's toasts and, where the
 *         module's own copy is reachable, three of its cards)
 *
 * CHECKS, per window and size
 *   - it is on screen (the Class Trial console is noted instead when it is not: outside a trial it may decline to open)
 *   - no part of it lies past the viewport (its root's box, 1 px of slack)
 *   - no text overflows: every visible element of it holding text of its own (buttons, labels, headings, cells) whose
 *     `scrollWidth` exceeds its `clientWidth` by more than 1 px and whose text (a Range over its contents) reaches more
 *     than 1 px past its content box, scrolling boxes and form fields left out; the first 15 are listed (both readings:
 *     `scrollWidth` alone counts a pseudo-element's frame, the Range alone a turned element's box; 25.11.2026)
 *   - the messenger's write box (P1's and the GM's; 1.2.129, OWNER-129-WRITEBOX) opens at least three lines tall where
 *     the browser supports `field-sizing: content` (`CSS.supports`); its heights - empty, five lines, ten lines - are
 *     noted on every browser, as is whether it grew
 *
 * NOTES (no verdict)
 *   - EXP-PL-01: Foundry's permissions for the cursor, the ruler and pings (`core.permissions`) and whether the Player
 *     role holds each; and, after P1's mouse crosses the board, whether GM1's canvas draws P1's cursor. Whether one
 *     player's canvas draws another's needs two players: with S7's roles it is the permission's reading alone
 *   - FORGE-03: the LiveKit toasts on each page (recorded by the page hooks and on screen), with DRPG_FAKE_MEDIA's state:
 *     without a fake microphone voice fails, and the count is FORGE-03's
 *
 * WRITES: nothing to the world. Each test browser's client setting `theme` is set to Stained Glass when it is another
 * (and put back); the messenger's write box is typed into and emptied, never sent; the notices are this page's alone
 * (the module's cards with `record: false`, kept out of the notice history).
 *
 * UNMEASURED: that each opener answers a window Foundry lists in `foundry.applications.instances` (else the window is
 * looked for by its class); that `canvas.controls` keeps the cursors where it is read (its shape is recorded raw); that
 * Foundry's toasts stack in `#notifications`; that the module's popup host stacks cards drawn through an imported
 * `popup.mjs` the same as its own (used only when the import reaches the page's own copy).
 */

import { config } from "../lib.mjs";
import { J, sleep, inPage, ensureKit, present, liveKitToasts } from "../table.mjs";

export const meta = {
    id: "s7-look",
    title: "The windows a table uses most, at 1920x1080 and 2560x1440 in Stained Glass: fit, overflow, the write box",
    roles: ["gm1", "p1"],
    writes: false,
    triage: ["EXP-PL-01", "FORGE-03", "OWNER-129-WRITEBOX"]
};

const SIZES = (await import("../lib.mjs")).config.sizes;
const WINDOWS = {
    gm1: [["hud", "#drpg-hud"], ["gmPanel", null], ["messengerGm", ".drpg-messenger"], ["sheetGm", null], ["students", null], ["investigation", null], ["trial", null]],
    p1: [["hud", "#drpg-hud"], ["messenger", ".drpg-messenger"], ["sheet", null], ["notices", "#notifications"]]
};
const OPTIONAL = new Set(["trial"]);

/* In the page: open one window by its name; answers the ids of the windows that appeared (up to 8 s), or none. */
async function openWindow({ name, p1Id }) {
    const qa = window.__qa;
    const before = new Set(qa.appIds());
    const openers = {
        gmPanel: () => game.drpg.gmPanel(),
        messengerGm: () => game.drpg.openMessenger(p1Id),
        messenger: () => game.drpg.openMessenger(),
        sheet: () => game.user.character?.sheet?.render({ force: true }),
        sheetGm: () => game.users.get(p1Id)?.character?.sheet?.render({ force: true }),
        students: () => game.drpg.monocubDialog(),
        investigation: () => game.drpg.investigationDashboard(),
        trial: () => game.drpg.manageClassTrial()
    };
    if (!openers[name]) return { ids: [], none: "no opener" };
    let threw = null;
    window.__qaOpenError = null;
    try { Promise.resolve(openers[name]()).catch(err => { window.__qaOpenError = String(err?.message ?? err); }); }
    catch (err) { threw = String(err?.message ?? err); }
    const t0 = Date.now();
    let ids = [];
    while (Date.now() - t0 < 8000) {
        ids = qa.appIds().filter(id => !before.has(id));
        if (ids.length) break;
        await new Promise(r => setTimeout(r, 200));
    }
    await new Promise(r => setTimeout(r, 1500));
    ids = qa.appIds().filter(id => !before.has(id));
    return { ids, threw: threw ?? window.__qaOpenError, described: ids.map(id => qa.describe(id, qa.apps().get(id))) };
}

/* In the page: the box and the text overflow of the windows named by id, or of the element a selector names. */
function measure({ ids, selector }) {
    const qa = window.__qa;
    const roots = ids?.length ? ids.map(id => qa.appEl(qa.apps().get(id))).filter(Boolean) : [...document.querySelectorAll(selector ?? "#none")].filter(el => el.getClientRects().length);
    const vw = innerWidth, vh = innerHeight;
    const path = el => {
        const parts = [];
        for (let n = el; n && n !== document.body && parts.length < 4; n = n.parentElement) {
            parts.unshift(`${n.tagName.toLowerCase()}${n.id ? `#${n.id}` : ""}${[...n.classList].slice(0, 2).map(c => `.${c}`).join("")}`);
        }
        return parts.join(" > ");
    };
    const ownText = el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    const out = [];
    for (const root of roots) {
        const r = root.getBoundingClientRect();
        const past = { left: Math.round(-r.left), top: Math.round(-r.top), right: Math.round(r.right - vw), bottom: Math.round(r.bottom - vh) };
        const overflow = [];
        for (const el of root.querySelectorAll("*")) {
            if (!ownText(el) || !el.getClientRects().length || /^(INPUT|TEXTAREA|SELECT|OPTION|SCRIPT|STYLE)$/.test(el.tagName)) continue;
            const cs = getComputedStyle(el);
            if (cs.visibility === "hidden" || cs.display === "none" || /auto|scroll/.test(cs.overflowX)) continue;
            /* Text overflows when both readings say so: `scrollWidth` over `clientWidth`, and the text's own extent (a
               Range over the element's contents) past its content box. The first run (25.11.2026, owner's PC) found
               `scrollWidth` alone 5 px over on every Stained Glass button by a `::before` frame drawn at
               `inset: -4px -5px` while the text fitted (a pseudo-element is no text), and the Range alone 1-3 px over
               on the tilted HUD (a turned element's bounding box is wider than its text). Text that really spills
               raises both; text clipped by an ellipsis still lays out past the box, so it still counts. */
            if (el.clientWidth <= 0) continue;
            const range = document.createRange();
            range.selectNodeContents(el);
            const t = range.getBoundingClientRect();
            const b = el.getBoundingClientRect();
            const left = b.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft);
            const right = b.left + parseFloat(cs.borderLeftWidth) + el.clientWidth - parseFloat(cs.paddingRight);
            const spill = Math.max(left - t.left, t.right - right);
            if (el.scrollWidth > el.clientWidth + 1 && t.width > 0 && spill > 1) {
                overflow.push({ at: path(el), text: el.textContent.trim().slice(0, 60), textWidth: Math.round(t.width), contentWidth: Math.round(right - left), spill: Math.round(spill),
                    scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, overflowX: cs.overflowX, ellipsis: cs.textOverflow === "ellipsis" });
            }
        }
        out.push({ root: path(root), box: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }, viewport: { w: vw, h: vh },
            fits: past.left <= 1 && past.top <= 1 && past.right <= 1 && past.bottom <= 1, past, overflowCount: overflow.length, overflow: overflow.slice(0, 15) });
    }
    return out;
}

/* In the page: the messenger's write box, empty, at five lines and at ten; put back as it was. */
async function writeBox({ ids }) {
    const qa = window.__qa;
    const root = ids?.length ? ids.map(id => qa.appEl(qa.apps().get(id))).find(Boolean) : document.querySelector(".drpg-messenger");
    const box = root?.querySelector(".drpg-messenger-input textarea");
    if (!box) return { none: true };
    const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const cs = getComputedStyle(box);
    const fontPx = parseFloat(cs.fontSize);
    const linePx = cs.lineHeight === "normal" ? fontPx * 1.2 : parseFloat(cs.lineHeight);
    const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const read = () => ({ offsetHeight: box.offsetHeight, clientHeight: box.clientHeight, scrollHeight: box.scrollHeight, lines: Math.round(((box.clientHeight - pad) / linePx) * 100) / 100 });
    const was = box.value;
    const set = async text => { box.value = text; box.dispatchEvent(new Event("input", { bubbles: true })); await frame(); return read(); };
    const empty = await set("");
    const five = await set("1\n2\n3\n4\n5");
    const ten = await set("1\n2\n3\n4\n5\n6\n7\n8\n9\n10");
    await set(was);
    return { supportsFieldSizing: CSS.supports("field-sizing", "content"), fieldSizing: cs.getPropertyValue("field-sizing") || null,
        fontPx, linePx, padPx: pad, minHeight: cs.minHeight, maxHeight: cs.maxHeight, empty, five, ten, grew: five.offsetHeight > empty.offsetHeight };
}

export async function run(ctx) {
    const { check, note, phase, settle, shot } = ctx;
    const roles = present(ctx, ["gm1", "p1"]);
    const themeWas = {};
    if (!ctx.c.gm1 || !ctx.c.p1) { check("setup: GM1 and P1 logged in", false, J(roles)); return; }

    phase("setup");
    for (const role of roles) {
        await ensureKit(ctx, role);
        themeWas[role] = await inPage(ctx, role, async () => {
            const was = game.settings.get("danganronpa-rpg", "theme");
            if (!document.body.classList.contains("drpg-theme-stained-glass")) {
                await game.settings.set("danganronpa-rpg", "theme", "stainedGlass");
                await new Promise(r => setTimeout(r, 2500));
            }
            return was;
        });
        const on = await inPage(ctx, role, () => document.body.classList.contains("drpg-theme-stained-glass"));
        check(`setup: ${role}'s page wears Stained Glass`, on, J({ settingWas: themeWas[role] }));
    }
    const p1Id = await inPage(ctx, "gm1", name => game.users.getName(name)?.id ?? null, config.users.p1);
    const sameCopy = await inPage(ctx, "p1", () => window.__qa.sameInstance());
    note("setup", J({ engine: config.engine, fakeMedia: config.fakeMedia, p1Id, p1ImportsItsOwnCopy: sameCopy }));

    try {
        for (const [w, h] of SIZES) {
            const size = `${w}x${h}`;
            phase(size);
            for (const role of roles) await ctx.c[role].page.setViewportSize({ width: w, height: h });
            await settle(2500);
            for (const role of roles) {
                for (const [name, selector] of WINDOWS[role]) {
                    const label = `${size} ${role} ${name}`;
                    let opened = { ids: [] };
                    if (name === "notices") {
                        opened.cards = await inPage(ctx, role, async () => {
                            for (let i = 1; i <= 5; i++) ui.notifications.info(`QA notice ${i} of 6: a sentence long enough to wrap in the corner of the screen`);
                            ui.notifications.warn("QA notice 6 of 6: a warning");
                            let cards = "not drawn: the import does not reach this page's copy of the module";
                            if ((await window.__qa.sameInstance()) === true) {
                                const { showPopup } = await window.__qa.mod("popup.mjs");
                                for (let i = 1; i <= 3; i++) showPopup(`<p>QA card ${i} of 3: a card of the module's own, as a refusal or an arrival draws one.</p>`, { title: `QA ${i}`, record: false });
                                cards = 3;
                            }
                            await new Promise(r => setTimeout(r, 800));
                            return cards;
                        });
                    } else if (!selector || name === "messengerGm" || name === "messenger") {
                        opened = await inPage(ctx, role, openWindow, { name, p1Id }, { timeout: 30_000 });
                    }
                    const boxes = await inPage(ctx, role, measure, { ids: opened.ids, selector });
                    if (name === "notices") boxes.push(...await inPage(ctx, role, measure, { ids: [], selector: "#drpg-popups .drpg-popup" }));
                    await shot(role, `${size}-${name}`);
                    if (!boxes.length && OPTIONAL.has(name)) {
                        note(`${label}: did not open (outside a Class Trial it may decline)`, J(opened));
                    } else {
                        /* Each check asks for a box first: a window that is not there measures nothing, and fails. */
                        check(`${label}: is on screen`, boxes.length > 0, J(opened.described ?? opened));
                        check(`${label}: no part of it lies past the ${size} viewport`, boxes.length > 0 && boxes.every(b => b.fits), J(boxes.map(b => ({ root: b.root, box: b.box, past: b.past }))));
                        check(`${label}: no text overflows its box (scrollWidth over clientWidth, on elements holding text)`, boxes.length > 0 && boxes.every(b => b.overflowCount === 0),
                            J(boxes.filter(b => b.overflowCount).map(b => ({ root: b.root, n: b.overflowCount, first: b.overflow }))));
                    }
                    if (name === "messenger" || name === "messengerGm") {
                        const wb = await inPage(ctx, role, writeBox, { ids: opened.ids });
                        note(`${label}: the write box's heights (${config.engine})`, J(wb));
                        if (wb.none) check(`${label}: the messenger has a write box`, false, J(opened));
                        else if (wb.supportsFieldSizing) check(`${label}: the write box opens at least three lines tall (field-sizing supported here)`, wb.empty.lines >= 2.95, J(wb), { ids: ["OWNER-129-WRITEBOX"] });
                        else note(`${label}: field-sizing is not supported in ${config.engine}; the box's three lines are its min-height's alone`, J({ lines: wb.empty.lines, grew: wb.grew }));
                    }
                    if (name === "notices") {
                        await inPage(ctx, role, () => {
                            try { ui.notifications.clear?.(); } catch { /* the toasts time out by themselves */ }
                            for (const card of document.querySelectorAll("#drpg-popups .drpg-popup")) if (/QA card/.test(card.textContent)) card.remove();
                        });
                    } else if (opened.ids.length) {
                        await inPage(ctx, role, ids => Promise.all(ids.map(id => window.__qa.apps().get(id)?.close({ animate: false }))), opened.ids).catch(() => {});
                        await sleep(500);
                    }
                }
            }
        }

        phase("EXP-PL-01");
        const perms = await inPage(ctx, "gm1", () => {
            const roles = CONST.USER_ROLES ?? {};
            const want = Object.keys(CONST.USER_PERMISSIONS ?? {}).filter(k => /CURSOR|RULER|PING/.test(k));
            let stored = {};
            try { stored = game.settings.get("core", "permissions") ?? {}; } catch (err) { stored = { threw: err.message }; }
            return Object.fromEntries(want.map(k => {
                const list = stored[k] ?? CONST.USER_PERMISSIONS[k]?.defaultRole ?? null;
                const allowed = Array.isArray(list) ? list : Number.isFinite(list) ? Object.values(roles).filter(r => r >= list) : null;
                return [k, { roles: allowed, player: allowed ? allowed.includes(roles.PLAYER) : null, trusted: allowed ? allowed.includes(roles.TRUSTED) : null }];
            }));
        });
        note("EXP-PL-01: Foundry's cursor, ruler and ping permissions (roles allowed; whether the Player and Trusted Player roles hold each)", J(perms));
        const p1Page = ctx.c.p1.page;
        const vp = p1Page.viewportSize() ?? { width: 1920, height: 1080 };
        for (let i = 0; i <= 10; i++) { await p1Page.mouse.move(vp.width * (0.35 + i * 0.02), vp.height * (0.45 + (i % 3) * 0.02)); await sleep(150); }
        await sleep(1500);
        const cursor = await inPage(ctx, "gm1", id => {
            const cc = canvas?.controls;
            const raw = cc?.cursors;
            const entry = raw?.[id] ?? raw?.get?.(id) ?? raw?.children?.find?.(c => c?.user?.id === id || c?.name === id) ?? null;
            return { cursorsType: raw ? raw.constructor?.name ?? typeof raw : null, keys: raw && typeof raw === "object" && !raw.children ? Object.keys(raw).slice(0, 10) : null,
                p1Cursor: entry ? { visible: entry.visible ?? null, renderable: entry.renderable ?? null, x: Math.round(entry.x ?? NaN), y: Math.round(entry.y ?? NaN), name: entry.name ?? null } : null };
        }, p1Id);
        note("EXP-PL-01: after P1's mouse crossed the board, GM1's canvas holds P1's cursor (a player's own canvas reads the same permission; S7 has one player)", J(cursor));

        phase("FORGE-03");
        for (const role of roles) {
            const t = await liveKitToasts(ctx, role).catch(err => ({ err: err.message }));
            const av = await inPage(ctx, role, () => window.__qa.av()).catch(() => null);
            note(`FORGE-03: ${role}'s LiveKit toasts (fake microphone ${config.fakeMedia ? "on" : "off"}; Room ${av?.state ?? "?"})`, J({ ...t, av }));
        }
    } finally {
        for (const role of present(ctx, roles)) {
            if (themeWas[role] && themeWas[role] !== "stainedGlass") await inPage(ctx, role, was => game.settings.set("danganronpa-rpg", "theme", was), themeWas[role]).catch(() => {});
        }
    }
}
