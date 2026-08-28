/**
 * Danganronpa RPG — the camera dock.
 * ---------------------------------------------------------------------------
 * Two things, both applied on every `renderCameraViews`:
 *
 *   1. Restyle it to match the rest of this module — the same purple accents
 *      and dark panels every other DRPG surface uses, instead of Foundry's
 *      default chrome sitting next to it looking like a different app.
 *
 *   2. Put a real name on each tile. Voice already scopes who is even in a call
 *      to "people in your room" (see voice.mjs), so nothing is leaked by this
 *      that the room itself has not already — it just means the label matches
 *      what the sheet and the map already call that person.
 *
 * WHAT FOUNDRY PUTS THERE, AND WHY IT IS NOT USABLE AS-IS.
 * `CameraViews#_prepareUserContext` (client/applications/apps/av/cameras.mjs)
 * builds the nameplate like this:
 *
 *     const charname = user.character?.name.split(" ").shift() || "";
 *     charname: user.isGM ? _loc("USER.GM") : charname,
 *
 * Two consequences, and both of them are what the dock actually shows:
 *
 *   · every GM's tile reads the literal string "GM" — `USER.GM` — whatever
 *     their account or their Monokuma is called. Two GMs are indistinguishable.
 *   · a character's name is truncated to its FIRST WORD, so "Player A" reads
 *     "Player" and "Kaede Akamatsu" reads "Kaede".
 *
 * So this replaces the charname with the full one, and gives a GM the name the
 * table actually uses for them: their Monokuma, or their Despair pool's label.
 *
 * WHAT IT DELIBERATELY DOES NOT TOUCH. The GM's own nameplate MODE setting
 * (Foundry's `AVSettings.NAMEPLATE_MODES`). Off means off — no label is
 * created. "Player names only" means the account name was asked for on purpose,
 * so the account name is what stays.
 */

import { isMonokuma, poolUserFor } from "./monokuma.mjs";
import { poolLabel } from "./despair.mjs";
import { error } from "./utils.mjs";

export function registerCameraView() {
    Hooks.on("renderCameraViews", onRenderCameraViews);

    /*
     * HOW HIGH THE FLOOR IS, published for the CSS.
     *
     * `#players` rises over the camera dock on its own because it is
     * `position: static` — it sits in Foundry's own bottom-left column, and a
     * dock appearing above it makes the column taller. Our two round buttons
     * are `position: fixed` against the viewport edge, so they knew nothing
     * about it and the camera bar simply covered them (Dawid, 28.08, with a
     * screenshot of exactly that: latency box up, buttons still down).
     *
     * The dock is core markup this module does not own — the note over the
     * CAMERA DOCK section in the stylesheet says why it is tinted and not
     * restructured. So nothing here moves the dock: the height is MEASURED and
     * handed to the stylesheet as `--drpg-av-lift`, and the buttons add it to
     * their own offset. Same shape as `--drpg-despair-height` in hud.mjs.
     *
     * Remeasured on the three events that can change it, and only those: the
     * dock rendering (somebody joins, leaves, turns a camera on), the window
     * resizing, and the dock being hidden — which `renderCameraViews` also
     * reports, as a render with nothing visible in it.
     */
    Hooks.on("renderCameraViews", () => measureCameraDock());
    Hooks.on("collapseCameraViews", () => measureCameraDock());
    Hooks.on("ready", () => measureCameraDock());
    window.addEventListener("resize", () => measureCameraDock());
}

/**
 * The height the camera dock takes off the bottom of the screen, or zero.
 *
 * ZERO WHEN IT IS NOT THERE, and "not there" has four spellings: no dock in the
 * document at all (A/V off), a dock with no height (nobody connected), one that
 * is hidden, and one that has been collapsed to its bar. All four have to read
 * as zero or the buttons float in the middle of the screen for no reason.
 *
 * Measured from the BOTTOM of the viewport rather than taken as the element's
 * height: a dock that does not reach the bottom edge is not standing on the
 * things this is trying to lift, and a dock taller than the space below them
 * would lift them further than it needs to.
 */
function measureCameraDock() {
    try {
        const dock = document.querySelector("#camera-views, .camera-views");
        let lift = 0;

        if (dock && dock.isConnected) {
            const box = dock.getBoundingClientRect();
            const visible = box.height > 0 && box.width > 0
                && getComputedStyle(dock).visibility !== "hidden";
            /*
             * UNDER THE BUTTONS, not merely touching the same edge.
             *
             * The first version of this asked one question — does the dock
             * reach the bottom of the screen — and a dock docked on the LEFT
             * answers yes: it is a tall column, and it touches the bottom the
             * whole way down. So the buttons were lifted by the height of that
             * column, which is most of the viewport, and left the screen
             * entirely. Dawid found it the same evening: "the AV client on the
             * left hides the chat and speaker icons".
             *
             * The dock has to be standing under the CORNER the buttons live in.
             * Their horizontal position does not depend on the lift — they are
             * pinned to the right edge — so it can be read without circling
             * back on the value being computed.
             */
            const corner = document.getElementById("drpg-messenger-launcher");
            const cornerX = corner
                ? corner.getBoundingClientRect().left + corner.offsetWidth / 2
                : window.innerWidth - 40;
            const underneath = box.left <= cornerX && box.right >= cornerX;

            if (visible && underneath && box.bottom >= window.innerHeight - 4) {
                // And never more than the room there is: a dock that fills the
                // screen would otherwise push them off the top of it, which is
                // the same failure in a different spelling.
                lift = Math.min(Math.round(box.height),
                    Math.round(window.innerHeight / 2));
            }
        }

        document.body.style.setProperty("--drpg-av-lift", `${lift}px`);
    } catch (err) {
        // A measurement that fails must not take the corner with it: the
        // buttons keep whatever offset they had.
        error("Could not measure the camera dock", err);
    }
}

function onRenderCameraViews(app, element) {
    try {
        const root = element instanceof HTMLElement ? element : element?.[0];
        if (!root) return;

        root.classList.add("drpg-camera-dock");

        // `.camera-view` specifically. `[data-user]` alone also matches the
        // `.user-controls` bar (templates/apps/av/controls.hbs), which holds no
        // nameplate — and the text-matching fallback below would then go
        // rummaging through a row of buttons looking for a name.
        for (const box of root.querySelectorAll(".camera-view[data-user]")) {
            const userId = box.dataset.user;
            if (!userId) continue;
            relabel(box, userId);
        }
    } catch (err) {
        error("Could not style the camera dock", err);
    }
}

/**
 * The name this person should be shown under.
 *
 * An explicit `user.character` is a statement and always wins. Failing that a
 * GM is named by their Monokuma — the actor whose Despair pool points at them,
 * the same relationship voice.mjs uses to decide which room they follow — and
 * then by their pool label, which is what the Despair widget already shows.
 *
 * The ownership search is for PLAYERS only: `testUserPermission(gm, "OWNER")`
 * is true for every actor in the world, so running it for a GM returns
 * whichever character happens to be first in the collection.
 */
function displayNameFor(user) {
    if (user.character?.name) return user.character.name;

    if (user.isGM) {
        const mine = game.actors.find(a =>
            a.type === "character" && isMonokuma(a) && poolUserFor(a)?.id === user.id);
        return mine?.name ?? poolLabel(user);
    }

    const owned = game.actors.find(a =>
        a.type === "character" && a.testUserPermission(user, "OWNER"));
    return owned?.name ?? user.name;
}

/** Which of the two nameplate strings Foundry is currently rendering. */
function nameplateMode() {
    const MODES = foundry.av?.AVSettings?.NAMEPLATE_MODES;
    if (!MODES) return null;
    return {
        MODES,
        mode: game.webrtc?.settings?.client?.nameplates ?? MODES.BOTH
    };
}

/** Swap Foundry's truncated (or hardcoded) charname for the real one. */
function relabel(box, userId) {
    const user = game.users.get(userId);
    if (!user) return;

    const plate = nameplateMode();
    if (plate) {
        const { MODES, mode } = plate;
        // Nothing is drawn at all.
        if (mode === MODES.OFF) return;
        // The account name is exactly what this mode asks for — leave it.
        if (mode === MODES.PLAYER_ONLY) return;
    }

    const label = box.querySelector(".player-name");
    if (!label) return;

    const name = displayNameFor(user);
    if (!name) return;

    // The charname is always the LAST `<strong>`: the template renders the
    // account name first and the character second, and this only runs in the
    // two modes where the character half is present at all.
    const strongs = label.querySelectorAll("strong");
    const target = strongs[strongs.length - 1] ?? label;

    if (target.textContent === name) return;   // already ours
    target.textContent = name;

    // `.player-name` carries `.ellipsis`, so a long name is clipped rather than
    // breaking the tile — which makes the full one worth having on hover.
    label.dataset.tooltip = name;
}
