/**
 * L2: what the interface does when NOTHING has changed.
 *
 * The module redraws constantly - the clock every ten seconds, the status strip
 * on every setting write and every actor update, the accessibility sweep on
 * every window render - and most of those redraws print exactly what was
 * already on the screen. The cost of a redraw that changes nothing is invisible
 * from inside the thing doing it, which is why this is a scenario: it watches
 * the DOM from outside and counts what the redraw wrote.
 *
 * It matters because three MutationObservers in this module listen to the body
 * (glass.mjs's state change, fog.mjs's room outline, remnant-ring.mjs's repaint
 * of every token on the canvas), a fourth listens to the module's columns
 * (a11y.mjs), and under Stained Glass a child-list change in those columns is a
 * recut of the curtain - measured at 13-19 ms of blocking JS on a desk-sized
 * screen. A widget that re-inserts itself for nothing buys all of that.
 *
 * None of these are about how the module LOOKS. Every check here is "it said
 * the same thing, so it wrote nothing", and the first half of each one is that
 * it still says the thing.
 */
const MOD = "danganronpa-rpg";

export async function run({ gm, p1, check, settle, repoUrl }) {
    /* ---- 1. the clock ------------------------------------------------------
       `renderHud` stamps the phase and the hour on the body for the strip, the
       tray and the curtain's seams to read. Setting a dataset attribute to the
       value it already holds still queues a MutationRecord, so an unguarded
       write woke all three body observers on every redraw. */
    const hud = await gm.eval(`
        const H = await import("${repoUrl}/scripts/hud.mjs");
        H.renderHud();
        await new Promise(r => setTimeout(r, 150));
        let records = 0;
        const mo = new MutationObserver(recs => { records += recs.length; });
        mo.observe(document.body, { attributes: true, attributeFilter: ["data-drpg-phase", "data-drpg-time", "class"] });
        for (let i = 0; i < 5; i++) { H.renderHud(); await new Promise(r => setTimeout(r, 60)); }
        await new Promise(r => setTimeout(r, 200));
        mo.disconnect();
        return { records, phase: document.body.dataset.drpgPhase ?? null, time: document.body.dataset.drpgTime ?? null };
    `, { timeout: 60000 });
    check("the clock still stamps the phase and the hour on the body",
        Boolean(hud.phase) && hud.time !== null, JSON.stringify(hud));
    check("five identical clock redraws write nothing to the body",
        hud.records === 0, JSON.stringify(hud));

    /* ---- 2. the elapsed line is NOT checked here, and that is on purpose ----
       It prints whole minutes on a ten-second interval, so five ticks in six say
       what the line already said, and `setText` in hud.mjs now compares before
       writing. Asserting it needs the interval itself - `paintElapsed` is not
       exported, and rebuilding the HUD replaces the element, so an observer put
       on the line before a redraw is watching a detached node and would report a
       clean zero for the wrong reason. Waiting out a real ten-second tick is the
       only honest road and it is not deterministic either: a minute rolling over
       mid-test is a legitimate write. So the guard is stated in the code, with
       the reading that chose it, and is not claimed here. */

    /* ---- 3. the status strip ----------------------------------------------
       It redrew by removing its node and prepending a new one, on every module
       setting write and every update of any student. Under Stained Glass that
       pair of child-list mutations is a recut of the curtain. */
    const strip = await p1.eval(`
        const S = await import("${repoUrl}/scripts/player-status.mjs");
        S.renderPlayerStatus();
        await new Promise(r => setTimeout(r, 150));
        const host = document.querySelector("#ui-right-column-1") ?? document.getElementById("interface");
        const first = document.getElementById("drpg-player-status");
        if (!first || !host) return { missing: true };
        let records = 0;
        const mo = new MutationObserver(recs => { records += recs.length; });
        mo.observe(host, { childList: true });
        for (let i = 0; i < 5; i++) { S.renderPlayerStatus(); await new Promise(r => setTimeout(r, 40)); }
        await new Promise(r => setTimeout(r, 200));
        mo.disconnect();
        const now = document.getElementById("drpg-player-status");
        return { records, same: now === first, present: Boolean(now) };
    `, { timeout: 60000 });
    check("the status strip is on the screen", strip.present === true, JSON.stringify(strip));
    check("five identical strip redraws leave the same node where it was",
        strip.same === true && strip.records === 0, JSON.stringify(strip));

    /* ---- 4. the accessibility sweep ---------------------------------------
       A control the sweep cannot name used to be left unmarked, so every later
       sweep read its whole subtree again for the life of the session. It is
       marked now - and a control that CAN be named still gets its name. */
    const swept = await gm.eval(`
        const A = await import("${repoUrl}/scripts/a11y.mjs");
        const panel = document.createElement("div");
        panel.className = "drpg-panel";
        panel.innerHTML = "<button id='drpg-suite-nameless'></button>"
            + "<button id='drpg-suite-named' data-tooltip='Otwórz'></button>";
        document.body.append(panel);
        A.nameControls();
        const nameless = document.getElementById("drpg-suite-nameless");
        const named = document.getElementById("drpg-suite-named");
        const out = {
            namelessMarked: nameless.dataset.drpgNamed ?? null,
            namedMarked: named.dataset.drpgNamed ?? null,
            namedLabel: named.getAttribute("aria-label"),
            namelessLabel: named ? nameless.getAttribute("aria-label") : null
        };
        panel.remove();
        return out;
    `, { timeout: 60000 });
    check("a control that carries a name is given it",
        swept.namedMarked === "swept" && swept.namedLabel === "Otwórz", JSON.stringify(swept));
    check("a control the sweep cannot name is marked, not re-read forever",
        swept.namelessMarked === "none" && swept.namelessLabel === null, JSON.stringify(swept));
    check("and no name was invented for it", swept.namelessLabel === null, JSON.stringify(swept));

    await settle(200);
}
