/**
 * Probe: the GM's messenger window kept as HTML, for the owner's screenshots (1.2.124, OWNER-124-CONSOLE, 22.11.2026).
 * ---------------------------------------------------------------------------
 *     node cluster.mjs probes/124-console-shots.mjs                  (from audit/harness)
 *
 * What the owner approves before the window merges: the GM's window with the Timeline - three players, a card waiting
 * for a ruling, a stream of chat, action cards and notices - and one player's conversation. The world is given those
 * through the module's own functions on the browsers that do each at a table: each player writes to the GM
 * (messenger.mjs `sendMessage` on that player's page), the GM answers one of them, a player's Search for something
 * specific posts its ruling card from that player's page (call-gm.mjs `callGm`, as action-search.mjs `searchSpecific`
 * posts it, with its three answers), and two notices are shown on the GM's page (popup.mjs `showPopup`, which keeps them
 * in the notice history the Timeline reads). Then the GM's launcher's road opens the window (messenger-app.mjs
 * `openMessenger()`): the Timeline is kept, then the first player's view. Each is kept as its element's outerHTML with
 * its width and height, in docs/dev/owner124/console/capture/ (`console.html`, `player.html`, `manifest.json`), for
 * docs/dev/owner124/console/shots.html and shoot.mjs to draw in Chromium under the module's sheets.
 *
 * It checks only that each view was kept, and the Timeline with a card waiting and items in its stream. The cards and messages it posts are left in the harness's world, which the next boot seeds afresh.
 * WHAT A CAPTURE IS NOT: Foundry's own stylesheet and frame (the shots page writes a header as Foundry writes one), and
 * the stained glass drawn behind a window (glass.mjs paints the screen, not the window; the page stands on a plain ground).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../../../docs/dev/owner124/console/capture");

export const layers = ["probe"];

export async function run({ gm, p1, p2, p3, check, note, settle, repoUrl, IDS }) {
    const imp = file => `await import("${repoUrl}/scripts/${file}")`;
    fs.mkdirSync(OUT, { recursive: true });
    await settle(2000);

    const ids = await gm.eval(`return game.users.filter(u => !u.isGM).sort((a, b) => a.name.localeCompare(b.name))
        .map(u => ({ id: u.id, name: u.name, actor: u.character?.id ?? null }));`);
    note("players", JSON.stringify(ids));
    const send = (client, thread, text) => client.eval(`const M = ${imp("messenger.mjs")};
        return Boolean(await M.sendMessage(${JSON.stringify(thread)}, ${JSON.stringify(text)}));`, { timeout: 30000 });
    const pause = () => new Promise(r => setTimeout(r, 400));

    // Each player writes into their own thread, as the launcher's window lets them (the seed's p1, p2, p3).
    const byId = id => ids.find(u => u.id === id);
    const [a, b, c] = [byId(IDS.p1), byId(IDS.p2), byId(IDS.p3)];
    note("sent", JSON.stringify([
        await send(p1, a.id, "Is the kitchen door locked from the inside? I want to check before I try the handle."),
        (await pause(), await send(gm, a.id, "It is locked. You hear something heavy being moved behind it.")),
        (await pause(), await send(p2, b.id, "Can I use my free action to look under the bed before the bell?")),
        (await pause(), await send(p3, c.id, "I'll wait in the library until someone comes by."))
    ]));
    await pause();
    const asked = await p2.eval(`const C = ${imp("call-gm.mjs")}; const P = ${imp("action-pipeline.mjs")};
        const actor = game.user.character;
        if (!actor) return "no character";
        const posted = await C.callGm(actor, {
            title: "Search",
            request: "a crowbar",
            room: "Workshop",
            gmBody: "<p>" + game.i18n.format("DRPG.Action.specificFound", { tier: 2 }) + " <em>" + game.i18n.localize("DRPG.Bridge.createItemStays") + "</em></p>",
            actions: [
                { action: "createItem", label: game.i18n.localize("DRPG.Bridge.createItem"), data: { by: actor.id, category: "tool", tier: "2", room: "Workshop", want: "a crowbar" } },
                { action: "giveItem", label: game.i18n.localize("DRPG.Bridge.giveItem"), data: { by: actor.id } },
                P.ruledMissAction(actor),
                P.declineAction(actor, null)
            ]
        });
        return Boolean(posted);`, { timeout: 60000 });
    note("ruling card posted", String(asked));
    await settle(1500);
    const shown = await gm.eval(`const P = ${imp("popup.mjs")};
        P.showPopup("<p>Chie Satonaka walked into the Library.</p>", { title: "Library" });
        P.showPopup("<p>The afternoon has ended. The clock moves to the evening.</p>", { title: "Time of day" });
        return true;`, { timeout: 30000 });
    note("notices", String(shown));
    await settle(1500);

    const capture = async (view, file) => gm.eval(`const A = ${imp("messenger-app.mjs")};
        const app = A.openMessenger(${view === "console" ? "" : JSON.stringify(view)});
        await new Promise(r => setTimeout(r, 1200));
        const el = app?.element;
        if (!el) return null;
        return { html: el.outerHTML, width: app.position?.width ?? null, height: app.position?.height ?? null, title: app.title,
            waiting: el.querySelectorAll(".drpg-console-waiting-list .drpg-console-card").length,
            stream: el.querySelectorAll(".drpg-console-stream-list .drpg-console-item").length };`, { timeout: 60000 });
    const manifest = [];
    for (const [view, file] of [["console", "console.html"], [a.id, "player.html"]]) {
        const got = await capture(view, file);
        if (!got) { manifest.push({ view, file, captured: false }); continue; }
        fs.writeFileSync(path.join(OUT, file), got.html);
        manifest.push({ view: view === "console" ? "console" : a.name, file, captured: true, title: got.title, width: got.width,
            height: got.height, waiting: got.waiting, stream: got.stream });
        note(`kept ${file}`, JSON.stringify({ width: got.width, height: got.height, waiting: got.waiting, stream: got.stream }));
    }
    const kept = manifest.find(row => row.file === "console.html");
    check("the Timeline was kept with a card waiting and items in its stream",
        Boolean(kept?.captured && kept.waiting >= 1 && kept.stream >= 3), JSON.stringify(kept));
    check("the player's view was kept", Boolean(manifest.find(row => row.file === "player.html")?.captured));
    fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify({ about: "probes/124-console-shots.mjs", windows: manifest }, null, 2) + "\n");
    return { manifest };
}
