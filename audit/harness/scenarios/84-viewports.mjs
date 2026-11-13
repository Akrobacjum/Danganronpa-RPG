/**
 * 84-viewports: the windows E21 and E23 brought onto the screen, held there at the screens the module supports (E49 B7,
 * 11.11.2026; audit S17-47, D32 as narrowed by the owner's [17]: a desktop browser from 1280x720, narrow windows
 * supported, phones and tablets not).
 *
 * At 1366x768 and 1280x720, each at a browser zoom of 80, 100 and 120 %, on a player's page and the GM's:
 * - the player's own sheet: the Stop (safeword) button, and the sheet's window with its footers after each of its
 *   tabs, every rectangle inside the viewport (`getBoundingClientRect`);
 * - Level Up (level-up.mjs `openAdvancementFor`, the player's own character): the window whole on the screen;
 * - Set the season up (season-setup.mjs `openSeasonSetup`) on the GM: its top on the screen (the window opens from the
 *   top, its header at y >= 0) and its foot in view;
 * - the season's checks on the GM: the Season checklist's cast row (`openSeasonChecklist`, `li[data-drpg-key="cast"]`) on the
 *   screen - Pre-season checks' cast part until E101 item 2 made the two windows one (changed by reading, not run here);
 * - and the layout the module chose against settings.mjs `BREAKPOINTS`: `narrowScreen()` is true exactly when the
 *   viewport is under `BREAKPOINTS.narrow` wide.
 *
 * THE ZOOM IS THE VIEWPORT'S CSS SIZE. A browser zoom z lays a W x H window out as a CSS viewport of W/z x H/z, so the
 * page is sized so (the sandbox adapter's `viewport`, Playwright's `setViewportSize`); what a real Ctrl +/- changes
 * besides the layout (the pixel density) is LIVE-E49-05.
 *
 * LAYER local-gate ONLY: it reads a real browser's layout, which the harness's jsdom does not have (README, "What the
 * harness cannot do"). Not run here: the local gate records it as not run until a v14 sandbox runs it. Every window it
 * opens it closes; nothing is written to the world.
 */
export const layers = ["local-gate"];

const SIZES = [[1366, 768], [1280, 720]];
const ZOOMS = [0.8, 1, 1.2];

/* In the page: whether a rectangle is inside the viewport, with half a pixel for rounding. */
const INSIDE = `const inside = r => Boolean(r) && r.width > 0 && r.height > 0 && r.left >= -0.5 && r.top >= -0.5
    && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5;
const box = el => { const r = el?.getBoundingClientRect?.(); return r ? { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom), width: Math.round(r.width), height: Math.round(r.height) } : null; };
const settle = ms => new Promise(r => setTimeout(r, ms));`;

export async function run({ gm, p1, check, note, phase, settle, repoUrl }) {
    if (typeof p1.viewport !== "function" || typeof gm.viewport !== "function") {
        check("the adapter sizes the page (sandbox-cluster.mjs `viewport`)", false, "this runner hands no viewport(); the scenario cannot size the screen");
        return;
    }
    note("zoom", "a browser zoom z is the CSS viewport W/z x H/z (Playwright setViewportSize); the real Ctrl +/- is LIVE-E49-05");
    for (const [W, H] of SIZES) {
        for (const z of ZOOMS) {
            const w = Math.round(W / z), h = Math.round(H / z);
            const at = `${W}x${H} at ${Math.round(z * 100)}% (CSS ${w}x${h})`;
            phase(at);
            await p1.viewport(w, h);
            await gm.viewport(w, h);
            await settle(800);

            const player = await p1.eval(`${INSIDE}
                const S = await import("${repoUrl}/scripts/settings.mjs");
                const actor = game.user.character;
                if (!actor) return { noActor: true };
                const sheet = actor.sheet;
                await sheet.render({ force: true });
                await settle(700);
                const root = sheet.element;
                const tabs = [...(root?.querySelectorAll(".tab-navigation a[data-tab], nav.sheet-tabs a[data-tab], nav.tabs a[data-tab]") ?? [])];
                const perTab = [];
                for (const tab of tabs) {
                    tab.click();
                    await settle(350);
                    const feet = [...root.querySelectorAll("footer, .sheet-footer, .window-footer, [data-drpg-footer]")]
                        .filter(f => f.getBoundingClientRect().height > 0);
                    perTab.push({ tab: tab.dataset.tab, window: inside(root.getBoundingClientRect()), feet: feet.length,
                        feetIn: feet.every(f => inside(f.getBoundingClientRect())), at: box(root) });
                }
                const stop = root?.querySelector(".drpg-safeword-button") ?? null;
                const stopIn = inside(stop?.getBoundingClientRect());
                const stopAt = box(stop);
                await sheet.close();
                const L = await import("${repoUrl}/scripts/level-up.mjs");
                const before = new Set(Object.keys(foundry.applications.instances ? Object.fromEntries(foundry.applications.instances) : {}));
                const opening = L.openAdvancementFor(actor);
                await settle(900);
                const opened = [...(foundry.applications.instances?.values?.() ?? [])].filter(a => a.rendered && !before.has(a.id));
                const levelUp = opened[0] ?? null;
                const levelUpIn = inside(levelUp?.element?.getBoundingClientRect());
                const levelUpAt = box(levelUp?.element);
                for (const app of opened) await app.close().catch(() => {});
                await Promise.race([opening, settle(500)]).catch(() => {});
                return { width: innerWidth, height: innerHeight, narrowSaid: S.narrowScreen(), narrowAt: S.BREAKPOINTS.narrow,
                    tabs: perTab, stop: Boolean(stop), stopIn, stopAt, levelUp: Boolean(levelUp), levelUpIn, levelUpAt };
            `, { timeout: 120000 });
            if (player?.noActor) { check(`${at}: p1 has a character to open`, false, "game.user.character is empty on p1"); continue; }
            check(`${at}: the layout the module chose matches BREAKPOINTS on p1`, player.narrowSaid === (player.width < player.narrowAt), JSON.stringify(player));
            check(`${at}: the sheet's Stop is on the screen`, player.stop && player.stopIn, JSON.stringify({ stop: player.stop, at: player.stopAt }));
            check(`${at}: the sheet and its footers are on the screen after each tab`, player.tabs.length > 0
                && player.tabs.every(t => t.window && t.feetIn), JSON.stringify(player.tabs));
            check(`${at}: Level Up is whole on the screen`, player.levelUp && player.levelUpIn, JSON.stringify({ at: player.levelUpAt }));

            const master = await gm.eval(`${INSIDE}
                const S = await import("${repoUrl}/scripts/settings.mjs");
                const ids = () => new Set([...(foundry.applications.instances?.values?.() ?? [])].filter(a => a.rendered).map(a => a.id));
                const closeNew = async before => { for (const app of [...(foundry.applications.instances?.values?.() ?? [])]) if (app.rendered && !before.has(app.id)) await app.close().catch(() => {}); };
                const M = await import("${repoUrl}/scripts/season-setup.mjs");
                let before = ids();
                M.openSeasonSetup().catch(() => {});
                await settle(1000);
                const season = document.querySelector(".drpg-window-season");
                const head = season?.querySelector(".window-header") ?? season;
                const foot = season?.querySelector("footer, .form-footer, .window-footer") ?? null;
                const seasonRead = { open: Boolean(season), topIn: Boolean(head) && head.getBoundingClientRect().top >= -0.5 && inside(head.getBoundingClientRect()),
                    footIn: inside(foot?.getBoundingClientRect()), at: box(season) };
                await closeNew(before);
                before = ids();
                M.openSeasonChecklist().catch(() => {});
                await settle(1000);
                const cast = document.querySelector('.drpg-window-season-checklist li[data-drpg-key="cast"]');
                const castRead = { found: Boolean(cast), in: inside(cast?.getBoundingClientRect()), at: box(cast) };
                await closeNew(before);
                return { width: innerWidth, narrowSaid: S.narrowScreen(), narrowAt: S.BREAKPOINTS.narrow, season: seasonRead, cast: castRead };
            `, { timeout: 120000 });
            check(`${at}: the layout the module chose matches BREAKPOINTS on the GM`, master.narrowSaid === (master.width < master.narrowAt), JSON.stringify(master));
            check(`${at}: Set the season up opens from the top, its foot in view`, master.season.open && master.season.topIn && master.season.footIn, JSON.stringify(master.season));
            check(`${at}: the Season checklist's cast row is on the screen`, master.cast.found && master.cast.in, JSON.stringify(master.cast));
        }
    }
    await p1.viewport(1366, 768);
    await gm.viewport(1366, 768);
}
