/**
 * Probe: a player's own messenger window kept as HTML at four fillings, for the owner's screenshots (1.2.129,
 * OWNER-129-CHATRECT, 23.11.2026; the owner: "niech trzyma u graczy ksztalt prostokata, bez rozszerzania jak teraz").
 * ---------------------------------------------------------------------------
 *     DRPG_SHOTS_DIR=docs/dev/owner129/chatrect node cluster.mjs probes/129-chatrect.mjs        (from audit/harness)
 *
 * Each player's own window, opened by the launcher's road (messenger-app.mjs `openMessenger()`) on that player's page:
 * p2's with no message (`empty.html`), p1's with three (`few.html`), p3's with forty (`many.html`: each player message
 * written on p3's page, the GM's answers on the GM's, through messenger.mjs `sendMessage`), and p1's on its Note tab
 * (`note.html`). Each is kept as its element's outerHTML in <DRPG_SHOTS_DIR>/capture/ with a manifest whose rows say
 * `kind: "player"`, so docs/dev/owner124/console/shots.html stands each at the size messenger-gm.mjs `messengerSize` gives
 * a player at the screen it is drawn on, and docs/dev/owner129/chatrect/measure.mjs reads its height in Chromium.
 *
 * It checks only that each window was kept. The messages it posts are left in the harness's world, which the next boot
 * seeds afresh. WHAT A CAPTURE IS NOT: Foundry's own stylesheet and frame, and the stained glass painted behind a window.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../../..", process.env.DRPG_SHOTS_DIR ?? "docs/dev/owner129/chatrect", "capture");

export const layers = ["probe"];
export const timeoutMs = 300000;

export async function run({ gm, p1, p2, p3, check, note, settle, repoUrl, IDS }) {
    const imp = file => `await import("${repoUrl}/scripts/${file}")`;
    fs.mkdirSync(OUT, { recursive: true });
    await settle(2000);
    const send = (client, thread, text) => client.eval(`const M = ${imp("messenger.mjs")};
        return Boolean(await M.sendMessage(${JSON.stringify(thread)}, ${JSON.stringify(text)}));`, { timeout: 30000 });
    const pause = () => new Promise(r => setTimeout(r, 120));

    const sent = { few: 0, many: 0 };
    for (const [client, text] of [[p1, "Is the kitchen door locked from the inside?"], [gm, "It is locked. You hear something heavy behind it."],
        [p1, "Then I knock twice and wait."]]) {
        if (await send(client, IDS.p1, text)) sent.few++;
        await pause();
    }
    for (let i = 1; i <= 40; i++) {
        const fromGm = i % 3 === 0;
        const text = fromGm ? `Answer ${i}: the corridor stays quiet, and the lights hum over the lockers.`
            : `Message ${i}: I walk past the gym and look through the window in the door before I go on.`;
        if (await send(fromGm ? gm : p3, IDS.p3, text)) sent.many++;
        await pause();
    }
    note("sent", JSON.stringify(sent));

    const keep = async (client, tab) => client.eval(`const A = ${imp("messenger-app.mjs")};
        const app = A.openMessenger();
        await new Promise(r => setTimeout(r, 1200));
        if (${JSON.stringify(tab)} === "note") { app.tab = "note"; await app.render(); await new Promise(r => setTimeout(r, 800)); }
        const el = app?.element;
        const out = el ? { html: el.outerHTML, width: app.position?.width ?? null, height: app.position?.height ?? null, title: app.title,
            items: el.querySelectorAll(".drpg-msg, .drpg-messenger-msg, li").length } : null;
        await app?.close?.();
        return out;`, { timeout: 60000 });
    const manifest = [];
    for (const [file, client, tab, view] of [["empty.html", p2, "chat", "no message"], ["few.html", p1, "chat", "three messages"],
        ["many.html", p3, "chat", "forty messages"], ["note.html", p1, "note", "the Note tab"]]) {
        const got = await keep(client, tab);
        if (got) {
            fs.writeFileSync(path.join(OUT, file), got.html);
            manifest.push({ view, file, kind: "player", captured: true, title: got.title, width: got.width, height: got.height, items: got.items });
        } else manifest.push({ view, file, kind: "player", captured: false });
        note(`kept ${file}`, JSON.stringify(manifest.at(-1)));
    }
    check("each player's window was kept", manifest.every(row => row.captured), JSON.stringify(manifest));
    check("the messages were sent", sent.few === 3 && sent.many === 40, JSON.stringify(sent));
    fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify({ about: "probes/129-chatrect.mjs", windows: manifest }, null, 2) + "\n");
    return { manifest, sent };
}
