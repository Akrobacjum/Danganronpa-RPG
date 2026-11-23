/**
 * Probe: a player's list 'Who you hear' kept as HTML, for the owner's screenshots (E129, the owner's S0-VOICE of
 * 23.11.2026; the coordinator's addition: a peer muted for the listener reads plainly so, with a one-press undo).
 * ---------------------------------------------------------------------------
 *     node cluster.mjs probes/129-voice-list.mjs                  (from audit/harness)
 *
 * On p1, the harness's LiveKit shim (lib/livekit.mjs, as scenario 75 installs it) with the GM, p2 and p3 in p1's Room.
 * Each participant is given an open microphone's publication in p1's page (the shim models none); p1 opens 'Who you
 * hear' from the tile's speaker, mutes the GM for themselves ('Mute for me', the row's own button), and p3's <audio> is
 * taken out of the dock, as a page that lost it after a reconnect has none. One check (voice-tile.mjs `checkHearing`)
 * paints the list. Kept: the tile's and the list's outerHTML in docs/dev/owner129/comm/voice/capture/, for
 * voice-shots.html beside it. It checks only that the list was kept with its two lines; the shim is p1's alone and the
 * next boot starts afresh. WHAT A CAPTURE IS NOT: LiveKit, Foundry's dock or a real browser's audio (LIVE-129-COMM-01).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../../../docs/dev/owner129/comm/voice/capture");

export const layers = ["probe"];

export async function run({ p1, check, note, settle, IDS, repoUrl }) {
    fs.mkdirSync(OUT, { recursive: true });
    await settle(1500);
    const got = await p1.eval(`
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const until = async (test, ms = 4000) => { const end = Date.now() + ms; while (Date.now() < end && !test()) await sleep(25); return test(); };
        if (typeof globalThis.__liveKit?.install !== "function") return { error: "no shim" };
        await __liveKit.install();
        __liveKit.setRoster({ [__liveKit.MAIN_ROOM]: ${JSON.stringify([IDS.gm, IDS.p1, IDS.p2, IDS.p3])} });
        await game.webrtc.connect();
        await until(() => document.getElementById("drpg-voice-tile"));
        const room = game.webrtc.client._liveKitClient.liveKitRoom;
        for (const p of room.remoteParticipants.values()) p.audioTrackPublications = new Map([["mic", { source: "microphone", isMuted: false, isSubscribed: true }]]);
        const VT = await import("${repoUrl}/scripts/voice-tile.mjs");
        document.querySelector("#drpg-voice-tile .drpg-voice-speaker")?.click();
        const list = () => document.getElementById("drpg-voice-list");
        await until(() => list()?.hidden === false);
        list()?.querySelector('.drpg-voice-row[data-user-id="${IDS.gm}"] .drpg-voice-row-mute')?.click();
        await until(() => list()?.querySelector('.drpg-voice-row[data-user-id="${IDS.gm}"] .drpg-voice-row-mute')?.getAttribute("aria-pressed") === "true");
        for (const el of document.querySelectorAll('.camera-view[data-user="${IDS.p3}"]')) el.remove();
        VT.checkHearing(undefined, { report: () => {} });
        await sleep(200);
        const tile = document.getElementById("drpg-voice-tile");
        return { tile: tile?.outerHTML ?? null, list: list()?.outerHTML ?? null, inTile: Boolean(tile?.contains(list())),
            mutedMe: list()?.querySelector(".drpg-voice-row-mutedme:not([hidden])")?.textContent ?? null,
            gap: list()?.querySelector(".drpg-voice-row-gap:not([hidden])")?.textContent ?? null,
            body: document.body.className };`, { timeout: 60000 });
    note("kept", JSON.stringify({ inTile: got?.inTile, mutedMe: got?.mutedMe, gap: got?.gap, error: got?.error ?? null }));
    if (got?.tile) fs.writeFileSync(path.join(OUT, "tile.html"), got.tile);
    if (got?.list && !got.inTile) fs.writeFileSync(path.join(OUT, "list.html"), got.list);
    fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify({ about: "probes/129-voice-list.mjs", inTile: got?.inTile ?? null, body: got?.body ?? "" }, null, 2) + "\n");
    check("the list 'Who you hear' was kept with 'Muted by you' and a gap's line", Boolean(got?.tile && got?.mutedMe && got?.gap), JSON.stringify({ mutedMe: got?.mutedMe, gap: got?.gap }));
}
