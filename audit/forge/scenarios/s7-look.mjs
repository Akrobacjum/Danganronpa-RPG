/**
 * S7 on Forge: the windows a table uses most, photographed and measured (the road to 2.0, F3; written 24.11.2026, run
 * on the owner's PC 25.11.2026 in Chromium and Firefox, F3-forge-PC-2.md).
 * ---------------------------------------------------------------------------
 *     DRPG_FORGE_URL=... DRPG_FORGE_WORLD=DRPG-QA-Forge DRPG_FULL_RENDER=1 node audit/forge/run.mjs s7-look
 *     (and again with DRPG_BROWSER=firefox: the messenger's write box grows by CSS `field-sizing`, which Firefox may lack)
 *     (and with DRPG_S7_FOG=1 for the fog-leak phase, EXP-PL-04, which writes and puts back: below)
 *
 * GM1 and P1, Stained Glass (D2-03), at each of DRPG_SIZES - 1920x1080 and 2560x1440 by default, the owner's targets (D2-20) - (`page.setViewportSize`). At each size, on the page that
 * uses it, each window is opened as the table opens it (the module's API: the launcher's own road), given 1.5 s to
 * settle, measured, photographed (`ctx.shot`, `<role>-<w>x<h>-<window>.png`) and closed:
 *   GM1   the HUD, the GM panel, the messenger on P1's thread, P1's character sheet, the Students window, Investigation,
 *         the Class Trial console
 *   P1    the HUD, the messenger, the character sheet, a notification stack (six of Foundry's toasts and, where the
 *         module's own copy is reachable, three of its cards)
 *   both  the handbooks, from the corner's book (R111: its whole rectangle inside the viewport, a check with R111's id in
 *         place of the generic "no part past the viewport"; 2.0 line T4, 27.11.2026)
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
 * FOG-LEAK (only with DRPG_S7_FOG=1; EXP-PL-04, a measurement for the owner's decision; 2.0 line T4, 27.11.2026). A room
 * P1 has visited is drawn under a partial veil (the ink `VEIL_ALPHA` 0.6 over the live map, fog.mjs and fog-reveal.mjs),
 * and its tiles and door icons are not hidden room by room: unmeasured on a canvas. At each of DRPG_SIZES, with P1
 * standing in another room: GM1 picks a room of P1's discovery ledger (fog.mjs `discoveredFor`) that P1 does not stand
 * in, and P1's view is panned over it (its own camera; put back). Then, one change at a time, each between a
 * screenshot of P1's screen clipped to the room before and after (`p1-<w>x<h>-fogleak-<n>-<change>-before|after.png`):
 * a tile of Foundry's `icons/svg/skull.svg` placed in the room (tagged `flags.world.drpgQa`, page-kit.mjs `runTag`),
 * the room's doors set open, then closed, then locked (`ds`, a GM's door control), and its AmbientLight switched off
 * where it has one. Each pair is compared in P1's page: the mean difference per channel and the share of pixels with a
 * channel changed by more than FOG_THRESHOLD (24); and the door icons are read off P1's `canvas.controls.doors` (shown,
 * alpha, state) before and after. Every number is a NOTE, no verdict (the owner decides after the measurement, and no
 * change of fog.mjs or visibility.mjs comes before it). One check, FLOW: the phase ran - every change measured at
 * every size - and put everything back (no tagged tile left, every door's state and the light's as found), the put-back
 * in `finally`.
 *
 * WRITES: nothing to the world, but in the fog-leak phase (DRPG_S7_FOG=1), which writes and puts back: one tile per size
 * (deleted), the room's doors' states (set back to each one's own) and its light's `hidden` (set back). Each test
 * browser's client setting `theme` is set to Stained Glass when it is another (and put back); the messenger's write box
 * is typed into and emptied, never sent; the notices are this page's alone (the module's cards with `record: false`,
 * kept out of the notice history).
 *
 * UNMEASURED: that each opener answers a window Foundry lists in `foundry.applications.instances` (else the window is
 * looked for by its class); that `canvas.controls` keeps the cursors where it is read (its shape is recorded raw); that
 * Foundry's toasts stack in `#notifications`; that the module's popup host stacks cards drawn through an imported
 * `popup.mjs` the same as its own (used only when the import reaches the page's own copy). Fog-leak: that
 * `canvas.stage.worldTransform` maps the scene to the board's CSS pixels and `canvas.pan` moves only this page's view;
 * that `canvas.controls.doors.children` hold one DoorControl per door with its `wall`; that a wall's `ds` is v14's
 * door state (CONST.WALL_DOOR_STATES) and a GM's update of it is what the door control writes; that a tile's
 * `texture.src`, `width` and `height` place it; that the screen over the room shows nothing else that changes in the
 * 2 s between two shots (a toast, the HUD's clock) - the clip is the room's box, not the room alone.
 */

import { config } from "../lib.mjs";
import { J, sleep, inPage, ensureKit, present, liveKitToasts } from "../table.mjs";
import { runTag } from "../page-kit.mjs";

const FOG = process.env.DRPG_S7_FOG === "1";
/* A channel changed by more than this (of 255) counts as a changed pixel (EXP-PL-04's row: "np. 24 na kanał"). */
const FOG_THRESHOLD = 24;

export const meta = {
    id: "s7-look",
    title: "The windows a table uses most, at 1920x1080 and 2560x1440 in Stained Glass: fit, overflow, the write box",
    roles: ["gm1", "p1"],
    writes: FOG,
    triage: ["EXP-PL-01", "FORGE-03", "OWNER-129-WRITEBOX", "R111", ...(FOG ? ["EXP-PL-04"] : [])]
};

const SIZES = (await import("../lib.mjs")).config.sizes;
/* The handbooks (R111; 2.0 line T4, 27.11.2026): the suite's R111 read the window off the bottom of a 1920x1080 screen
   on Forge (F3-forge-PC-2.md, FORGE-09d), which S7's list did not hold. Opened as the table opens it, the corner's book
   (`#drpg-book-launcher`, handbooks.mjs `renderBookLauncher`; `game.drpg` has no opener), on both pages; found by its
   class (`.drpg-handbook`) when it was open already. */
const WINDOWS = {
    gm1: [["hud", "#drpg-hud"], ["gmPanel", null], ["messengerGm", ".drpg-messenger"], ["sheetGm", null], ["students", null], ["investigation", null], ["trial", null], ["handbooks", ".drpg-handbook"]],
    p1: [["hud", "#drpg-hud"], ["messenger", ".drpg-messenger"], ["sheet", null], ["notices", "#notifications"], ["handbooks", ".drpg-handbook"]]
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
        trial: () => game.drpg.manageClassTrial(),
        handbooks: async () => {
            const book = document.getElementById("drpg-book-launcher");
            if (book) { book.click(); return; }
            if ((await qa.sameInstance()) === true) return (await qa.mod("handbooks.mjs")).openHandbooks();
            throw new Error("no #drpg-book-launcher on the page, and the module's copy is not reachable");
        }
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
    /* The handbook's text arrives after its window (a fetch of the book): measured once the text is in, up to 8 s
       more, since under Stained Glass the window grows with it (handbooks.mjs, the comment over `HandbookApp`). */
    if (name === "handbooks") {
        const t1 = Date.now();
        while (Date.now() - t1 < 8000 && String(document.querySelector(".drpg-handbook .drpg-handbook-main")?.textContent ?? "").trim().length < 200) await new Promise(r => setTimeout(r, 250));
        await new Promise(r => setTimeout(r, 1000));
    }
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

/* On GM1: P1's character and token, the room P1 stands in, the rooms of P1's discovery ledger on the active scene
   (fog.mjs `discoveredFor`), and for the room chosen - visited, not P1's own, a bedroom last - its box, its doors and
   its first AmbientLight (each by a point inside the box grown by half a grid square). Writes nothing. */
async function fogRoom({ p1Name }) {
    const qa = window.__qa;
    const R = await qa.mod("rooms.mjs"), M = await qa.mod("movement.mjs"), Fg = await qa.mod("fog.mjs");
    const scene = game.scenes.active;
    if (!scene) return { none: "no active scene" };
    const user = game.users.getName(p1Name);
    const actor = user?.character ?? null;
    const token = actor ? scene.tokens.find(t => t.actorId === actor.id) ?? null : null;
    const here = token ? M.roomOfToken(token) ?? null : null;
    const visited = actor ? [...(Fg.discoveredFor(scene.id, actor.id) ?? [])] : [];
    const beds = new Set((game.drpg.allBedrooms?.(scene) ?? []).map(b => b.room));
    const names = R.roomNames(scene);
    const candidates = visited.filter(r => r !== here && names.includes(r)).sort((a, b) => Number(beds.has(a)) - Number(beds.has(b)) || a.localeCompare(b));
    const room = candidates[0] ?? null;
    /* The ledger is a GM store, held in the module's memory: an import that built a second copy reads it empty, which
       `sameInstance` (../table.mjs) says. */
    const base = { sceneId: scene.id, actorId: actor?.id ?? null, tokenId: token?.id ?? null, here, visited, room, sameInstance: await qa.sameInstance() };
    if (!room) return { ...base, none: "P1 has visited no room on this scene but the one it stands in" };
    const boxes = R.roomRegions(scene, room).map(M.boundsOf).filter(b => b && Number.isFinite(b.x));
    if (!boxes.length) return { ...base, none: `the room ${room} has no box` };
    const x0 = Math.min(...boxes.map(b => b.x)), y0 = Math.min(...boxes.map(b => b.y));
    const box = { x: x0, y: y0, w: Math.max(...boxes.map(b => b.x + b.w)) - x0, h: Math.max(...boxes.map(b => b.y + b.h)) - y0 };
    const pad = (scene.grid?.size ?? 100) / 2;
    const inside = (x, y) => x >= box.x - pad && x <= box.x + box.w + pad && y >= box.y - pad && y <= box.y + box.h + pad;
    const doors = scene.walls.filter(w => w.door > 0 && inside((w.c[0] + w.c[2]) / 2, (w.c[1] + w.c[3]) / 2)).map(w => ({ id: w.id, ds: w.ds, door: w.door }));
    const light = scene.lights.find(l => inside(l.x, l.y)) ?? null;
    return { ...base, bedroom: beds.has(room), box, grid: scene.grid?.size ?? 100, doors, light: light ? { id: light.id, hidden: Boolean(light.hidden) } : null };
}

/* On P1: its view put over the box (`canvas.pan`, this page's camera alone), and the box's rectangle on the screen,
   clamped to the viewport; the view before is answered, for the put-back. */
async function fogView({ box, view = null }) {
    const before = { x: canvas.stage.pivot.x, y: canvas.stage.pivot.y, scale: canvas.stage.scale.x };
    if (view) await canvas.pan(view);
    else {
        const scale = Math.min(before.scale, (innerWidth * 0.6) / box.w, (innerHeight * 0.6) / box.h);
        await canvas.pan({ x: box.x + box.w / 2, y: box.y + box.h / 2, scale: Math.max(0.1, scale) });
    }
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const t = canvas.stage.worldTransform;
    const at = canvas.app.view.getBoundingClientRect();
    const a = t.apply({ x: box.x, y: box.y }), b = t.apply({ x: box.x + box.w, y: box.y + box.h });
    const x = Math.max(0, Math.floor(at.left + Math.min(a.x, b.x))), y = Math.max(0, Math.floor(at.top + Math.min(a.y, b.y)));
    const right = Math.min(innerWidth, Math.ceil(at.left + Math.max(a.x, b.x))), bottom = Math.min(innerHeight, Math.ceil(at.top + Math.max(a.y, b.y)));
    return { before, now: { x: canvas.stage.pivot.x, y: canvas.stage.pivot.y, scale: canvas.stage.scale.x }, clip: { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) } };
}

/* On P1: the door icons of `ids` as P1's canvas draws them (`canvas.controls.doors`), with the view's position. */
function fogDoors({ ids }) {
    const list = [...(canvas.controls?.doors?.children ?? [])].filter(c => ids.includes(c?.wall?.id ?? c?.wall?.document?.id));
    return { view: { x: canvas.stage.pivot.x, y: canvas.stage.pivot.y, scale: canvas.stage.scale.x },
        icons: list.map(c => ({ wallId: c.wall?.id ?? c.wall?.document?.id ?? null, visible: Boolean(c.visible), worldVisible: c.worldVisible ?? null,
            renderable: c.renderable ?? null, alpha: Number.isFinite(c.alpha) ? Math.round(c.alpha * 100) / 100 : null, ds: c.wall?.document?.ds ?? null,
            icon: String(c.icon?.texture?.baseTexture?.resource?.src ?? c.icon?.texture?.textureCacheIds?.[0] ?? "").split("/").pop() || null })),
        drawn: list.length, of: ids.length };
}

/* On P1: two PNGs (base64) of one size compared: the mean difference per channel (RGB, 0-255) and the share of pixels
   with a channel changed by more than `threshold`. */
async function pngDiff({ a, b, threshold }) {
    const decode = async b64 => {
        const bytes = Uint8Array.from(globalThis.atob(b64), ch => ch.charCodeAt(0));
        const bmp = await globalThis.createImageBitmap(new Blob([bytes], { type: "image/png" }));
        const c = new globalThis.OffscreenCanvas(bmp.width, bmp.height);
        const g = c.getContext("2d");
        g.drawImage(bmp, 0, 0);
        return { w: bmp.width, h: bmp.height, d: g.getImageData(0, 0, bmp.width, bmp.height).data };
    };
    const A = await decode(a), B = await decode(b);
    if (A.w !== B.w || A.h !== B.h) return { mismatch: { a: [A.w, A.h], b: [B.w, B.h] } };
    let sum = 0, changed = 0;
    const n = A.w * A.h;
    for (let i = 0; i < A.d.length; i += 4) {
        const dr = Math.abs(A.d[i] - B.d[i]), dg = Math.abs(A.d[i + 1] - B.d[i + 1]), db = Math.abs(A.d[i + 2] - B.d[i + 2]);
        sum += dr + dg + db;
        if (dr > threshold || dg > threshold || db > threshold) changed++;
    }
    return { pixels: n, meanPerChannel: Math.round((sum / (n * 3)) * 100) / 100, changedShare: Math.round((changed / n) * 10000) / 10000, changed };
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
                    } else if (!selector || name === "messengerGm" || name === "messenger" || name === "handbooks") {
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
                        /* The handbooks' fit is R111's claim, so it carries R111's id and says it in R111's words. */
                        if (name === "handbooks") check(`${label}: the handbooks window is on screen (its whole rectangle inside the ${size} viewport)`, boxes.length > 0 && boxes.every(b => b.fits), J(boxes.map(b => ({ root: b.root, box: b.box, past: b.past }))), { ids: ["R111"] });
                        else check(`${label}: no part of it lies past the ${size} viewport`, boxes.length > 0 && boxes.every(b => b.fits), J(boxes.map(b => ({ root: b.root, box: b.box, past: b.past }))));
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

        if (FOG) await fogLeak(ctx);
    } finally {
        for (const role of present(ctx, roles)) {
            if (themeWas[role] && themeWas[role] !== "stainedGlass") await inPage(ctx, role, was => game.settings.set("danganronpa-rpg", "theme", was), themeWas[role]).catch(() => {});
        }
    }
}

/*
 * EXP-PL-04: what P1 sees of a visited room's tiles, doors and light through the fog (the header's FOG-LEAK). Every
 * reading is a note; the one check is FLOW. Each size starts from the world as found: what a size changed is put back in
 * its `finally` before the next.
 */
async function fogLeak(ctx) {
    const { check, note, phase, settle, shot } = ctx;
    phase("fog-leak");
    const tag = runTag("s7");
    /* v14's door states, read on GM1's page below; these are the values until then (open 1, closed 0, locked 2). */
    const states = { open: 1, closed: 0, locked: 2 };
    const sizes = [];
    let found = null;
    try {
        found = await inPage(ctx, "gm1", fogRoom, { p1Name: config.users.p1 }, { timeout: 60_000 });
        note("fog-leak: the room measured (P1's discovery ledger, a room P1 does not stand in)", J(found));
        if (found.none) return;
        const read = await inPage(ctx, "gm1", () => ({ ...(CONST.WALL_DOOR_STATES ?? {}) }));
        Object.assign(states, { open: read.OPEN ?? 1, closed: read.CLOSED ?? 0, locked: read.LOCKED ?? 2 });
        note("fog-leak: v14's door states (CONST.WALL_DOOR_STATES)", J(read));
        for (const [w, h] of SIZES) {
            const size = `${w}x${h}`;
            const row = { size, steps: [], putBack: null };
            sizes.push(row);
            for (const role of ["gm1", "p1"]) await ctx.c[role].page.setViewportSize({ width: w, height: h });
            await settle(2500);
            const view = await inPage(ctx, "p1", fogView, { box: found.box });
            row.view = view;
            if (view.clip.width < 20 || view.clip.height < 20) { note(`fog-leak ${size}: the room is not on P1's screen after the pan`, J(view)); continue; }
            let n = 0;
            const step = async (name, write) => {
                n++;
                const ids = found.doors.map(d => d.id);
                const doorsBefore = await inPage(ctx, "p1", fogDoors, { ids });
                const before = await shot("p1", `${size}-fogleak-${n}-${name}-before`, { clip: view.clip });
                const wrote = await inPage(ctx, "gm1", write.fn, write.arg, { timeout: 60_000 }).catch(err => ({ threw: err.message }));
                await settle(2000);
                const after = await shot("p1", `${size}-fogleak-${n}-${name}-after`, { clip: view.clip });
                const doorsAfter = await inPage(ctx, "p1", fogDoors, { ids });
                const diff = before && after ? await inPage(ctx, "p1", pngDiff, { a: before.toString("base64"), b: after.toString("base64"), threshold: FOG_THRESHOLD }, { timeout: 60_000 }) : { none: "a shot was not taken" };
                const r = { name, wrote, diff, doorsBefore: doorsBefore.icons, doorsAfter: doorsAfter.icons, viewMoved: J(doorsBefore.view) !== J(doorsAfter.view) || J(doorsAfter.view) !== J(view.now) };
                row.steps.push(r);
                note(`fog-leak ${size}: ${name} - P1's screen over ${found.room} (EXP-PL-04, no verdict)`, J(r));
                return r;
            };
            try {
                await step("tile", { fn: async ({ sceneId, box, grid, tag }) => {
                    const scene = game.scenes.get(sceneId);
                    const size = grid * 2;
                    const [tile] = await scene.createEmbeddedDocuments("Tile", [{ texture: { src: "icons/svg/skull.svg" }, x: Math.round(box.x + box.w / 2 - size / 2),
                        y: Math.round(box.y + box.h / 2 - size / 2), width: size, height: size, hidden: false, flags: { world: { drpgQa: tag } } }]);
                    return { tileId: tile?.id ?? null };
                }, arg: { sceneId: found.sceneId, box: found.box, grid: found.grid, tag } });
                if (found.doors.length) {
                    for (const name of ["open", "closed", "locked"]) {
                        await step(`doors-${name}`, { fn: async ({ sceneId, ids, ds }) => {
                            const scene = game.scenes.get(sceneId);
                            await scene.updateEmbeddedDocuments("Wall", ids.map(id => ({ _id: id, ds })));
                            return { ds, doors: ids.length };
                        }, arg: { sceneId: found.sceneId, ids: found.doors.map(d => d.id), ds: states[name] } });
                    }
                } else note(`fog-leak ${size}: the room has no door within its box - the doors' steps not run`, J(found.box));
                if (found.light) {
                    await step("light-off", { fn: async ({ sceneId, id, hidden }) => {
                        await game.scenes.get(sceneId).updateEmbeddedDocuments("AmbientLight", [{ _id: id, hidden }]);
                        return { hidden };
                    }, arg: { sceneId: found.sceneId, id: found.light.id, hidden: !found.light.hidden } });
                } else note(`fog-leak ${size}: the room has no AmbientLight within its box - the light's step not run`, "");
            } finally {
                /* Put back, whatever broke: every tile of this run's tag (found by the tag, not by an id), each door's own
                   state, the light's `hidden`, P1's view. */
                row.putBack = await inPage(ctx, "gm1", async ({ sceneId, tag, doors, light }) => {
                    const scene = game.scenes.get(sceneId);
                    const out = { tiles: 0, doors: 0, light: false, failed: [] };
                    const tiles = scene.tiles.filter(t => t.flags?.world?.drpgQa === tag).map(t => t.id);
                    try { if (tiles.length) { await scene.deleteEmbeddedDocuments("Tile", tiles); out.tiles = tiles.length; } } catch (err) { out.failed.push(`tiles: ${err.message}`); }
                    const back = doors.filter(d => scene.walls.get(d.id) && scene.walls.get(d.id).ds !== d.ds).map(d => ({ _id: d.id, ds: d.ds }));
                    try { if (back.length) { await scene.updateEmbeddedDocuments("Wall", back); out.doors = back.length; } } catch (err) { out.failed.push(`doors: ${err.message}`); }
                    if (light && scene.lights.get(light.id) && Boolean(scene.lights.get(light.id).hidden) !== light.hidden) {
                        try { await scene.updateEmbeddedDocuments("AmbientLight", [{ _id: light.id, hidden: light.hidden }]); out.light = true; } catch (err) { out.failed.push(`light: ${err.message}`); }
                    }
                    await new Promise(r => setTimeout(r, 1000));
                    out.left = { tiles: scene.tiles.filter(t => t.flags?.world?.drpgQa === tag).length,
                        doors: doors.filter(d => scene.walls.get(d.id) && scene.walls.get(d.id).ds !== d.ds).map(d => d.id),
                        light: Boolean(light && scene.lights.get(light.id) && Boolean(scene.lights.get(light.id).hidden) !== light.hidden) };
                    return out;
                }, { sceneId: found.sceneId, tag, doors: found.doors, light: found.light }, { timeout: 60_000 }).catch(err => ({ threw: err.message }));
                await inPage(ctx, "p1", fogView, { box: found.box, view: view.before }).catch(() => null);
                note(`fog-leak ${size}: put back`, J(row.putBack));
            }
        }
    } finally {
        const want = found && !found.none ? 1 + (found.doors.length ? 3 : 0) + (found.light ? 1 : 0) : 0;
        const measured = sizes.length === SIZES.length && sizes.every(r => r.steps.length === want && r.steps.every(st => Number.isFinite(st.diff?.meanPerChannel)));
        const back = sizes.length > 0 && sizes.every(r => r.putBack && !r.putBack.threw && !r.putBack.failed?.length && r.putBack.left?.tiles === 0 && !r.putBack.left?.doors?.length && !r.putBack.left?.light);
        note("fog-leak: every change at every size, as numbers (mean difference per channel; share of pixels over the threshold; door icons shown before -> after)",
            sizes.flatMap(r => r.steps.map(st => `${r.size} ${st.name.padEnd(13)} mean ${st.diff?.meanPerChannel ?? "-"}, changed ${st.diff?.changedShare ?? "-"} (>${FOG_THRESHOLD}); doors ${st.doorsBefore.map(d => `${d.visible ? "shown" : "hidden"}/${d.ds}`).join(",") || "-"} -> ${st.doorsAfter.map(d => `${d.visible ? "shown" : "hidden"}/${d.ds}`).join(",") || "-"}${st.viewMoved ? " (view moved)" : ""}`)).join("\n") || "nothing measured");
        check("fog-leak (EXP-PL-04): the phase ran and put everything back", Boolean(found && !found.none) && measured && back,
            J({ room: found?.room ?? null, none: found?.none ?? null, want, sizes: sizes.map(r => ({ size: r.size, steps: r.steps.map(st => st.name), clip: r.view?.clip ?? null, putBack: r.putBack })) }), { ids: ["FLOW"] });
    }
}
