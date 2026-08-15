/**
 * DRPG voice spike — LiveKit breakout probe (temporary, GM only)
 * ---------------------------------------------------------------------------
 * HISTORICAL. Question 1 below was answered "yes", and the module was built on
 * that answer — then rebuilt, because "the client CAN be moved this way" turned
 * out not to mean "the client WILL be": avclient-livekit only listens on that
 * socket between its own `ready` and the next refresh, and drops anything that
 * arrives earlier. scripts/voice.mjs no longer uses the registry or that socket;
 * see the notes at the top of scripts/voice-client.mjs.
 *
 * Still useful as a manual probe of the LiveKit server itself (question 3), and
 * left alone for that. It is not how the module works.
 *
 * Etap A of the voice-chat plan: answers three questions about
 * avclient-livekit's Breakout Rooms before scripts/voice.mjs (Etap C) gets
 * built for real.
 *
 *   1. Can a client be forced into an arbitrary named room from OUTSIDE the
 *      module — by writing its breakoutRoomRegistry setting and emitting its
 *      own socket event — the same way scripts/voice.mjs would need to?
 *   2. How long does the reconnect take (rough timing only; watch the second
 *      client with your own eyes and ears for the real answer)?
 *   3. Does this world actually have LiveKit credentials configured, or just
 *      a room name with nothing behind it?
 *
 * HOW TO RUN THIS
 *   1. Enable "LiveKit AVClient" and configure a real server under
 *      Configure Game Settings > Audio/Video (Forge / Tavern / Custom).
 *   2. Log in as GM in one browser, and as a second REAL test account in a
 *      second browser (or a private window) — a second tab as the same user
 *      will not prove anything, you need two distinct connections.
 *   3. Run this macro as the GM. Pick the test account, type a room name,
 *      click Assign.
 *   4. Watch the test account's client: did their A/V bar say they joined
 *      the new room? Can the GM account (or a third test account you also
 *      put in the same room name) actually hear them?
 *   5. Run it again with the checkbox "clear the assignment" to send them
 *      back, and again with a different room name to get a feel for how
 *      disruptive switching is.
 *
 * Delete this macro once scripts/voice.mjs (Etap C) ships — it exists only
 * to answer the question above once, on your real Forge setup.
 */

const AV_MODULE = "avclient-livekit";
const DialogV2 = foundry.applications.api.DialogV2;

if (!game.user.isGM) {
    ui.notifications.warn("Voice spike: GM only.");
    return;
}

const mod = game.modules.get(AV_MODULE);
if (!mod?.active) {
    ui.notifications.error(`"${AV_MODULE}" is not installed or not enabled — turn it on first.`);
    return;
}

/* ==========================================================================
 * QUESTION 3 — what is actually configured, without printing secrets
 * ========================================================================== */

console.group("DRPG voice spike");

try {
    console.log("game.webrtc.mode:", game.webrtc?.mode);
    console.log("game.webrtc.settings.world (Foundry's own AV config):",
        foundry.utils.deepClone(game.webrtc?.settings?.world ?? {}));
} catch (err) {
    console.warn("Could not read game.webrtc.settings.world:", err);
}

try {
    // This is the module's own connection settings object, as seen in its
    // source (LiveKitAVClient.ts). Key names may differ across versions —
    // that is exactly what we are checking, so failure here is itself an
    // answer, not a bug in this script.
    const conn = game.settings.get(AV_MODULE, "liveKitConnectionSettings");
    const safe = conn ? { ...conn } : null;
    if (safe) {
        for (const key of ["apiKey", "secretKey", "tavernPatreonToken"]) {
            if (key in safe) safe[key] = safe[key] ? "(set — value hidden)" : "(empty)";
        }
    }
    console.log(`${AV_MODULE}.liveKitConnectionSettings (secrets masked):`, safe);
} catch (err) {
    console.warn(`Could not read ${AV_MODULE}.liveKitConnectionSettings — the setting key may have changed:`, err);
}

console.groupEnd();
ui.notifications.info("Connection details logged to the console (F12). Secrets are masked there too.");

/* ==========================================================================
 * QUESTIONS 1 & 2 — force a target user into a named room, time it
 * ========================================================================== */

const others = game.users.filter(u => u.id !== game.user.id);
if (!others.length) {
    ui.notifications.warn("No other logged-in users to test with. Log in a second test account first.");
    return;
}

const userOptions = others
    .map(u => `<option value="${u.id}">${foundry.utils.escapeHTML(u.name)}${u.active ? "" : " (offline)"}</option>`)
    .join("");

const result = await DialogV2.wait({
    window: { title: "Voice spike — assign a breakout room" },
    content: `<form>
        <p>Pick the test account and a room name, then watch <em>their</em> client —
        this only reports whether the assignment was sent, not whether it worked.</p>
        <label>Target user
            <select name="userId">${userOptions}</select>
        </label>
        <label>Room name
            <input type="text" name="room" value="drpg-spike-room-1" />
        </label>
        <label class="drpg-checkbox">
            <input type="checkbox" name="clear" />
            Clear the assignment instead (send them back to the main room)
        </label>
    </form>`,
    buttons: [
        {
            action: "go", label: "Assign", default: true,
            callback: (event, button, dialog) => {
                const form = dialog.element.querySelector("form");
                return {
                    userId: form.userId.value,
                    room: form.clear.checked ? undefined : form.room.value.trim()
                };
            }
        },
        { action: "cancel", label: "Cancel" }
    ],
    rejectClose: false
});

if (!result || result === "cancel") return;

const targetName = others.find(u => u.id === result.userId)?.name ?? "?";

try {
    const registry = game.settings.get(AV_MODULE, "breakoutRoomRegistry") ?? {};
    registry[result.userId] = result.room;

    console.time("DRPG voice spike: registry write + socket emit");
    await game.settings.set(AV_MODULE, "breakoutRoomRegistry", registry);
    game.socket.emit(`module.${AV_MODULE}`, {
        action: "breakout",
        userId: result.userId,
        breakoutRoom: result.room
    }, { recipients: [result.userId] });
    console.timeEnd("DRPG voice spike: registry write + socket emit");

    ui.notifications.info(result.room
        ? `Sent. Watch ${targetName}'s client — do they land in "${result.room}"? Time the reconnect yourself.`
        : `Sent. Watch ${targetName}'s client — do they return to the main room?`);
} catch (err) {
    console.error("DRPG voice spike: could not write/emit the breakout assignment.", err);
    ui.notifications.error(`Could not reach ${AV_MODULE}'s breakout settings — see console (F12). `
        + "This itself answers question 1: the registry/socket approach needs rework.");
}
