/**
 * Danganronpa RPG — diagnostics.
 * ---------------------------------------------------------------------------
 * Answers "why isn't this working" without guesswork. Run from the console:
 *
 *     game.drpg.diagnoseDice()        dice skins
 *     game.drpg.diagnoseDespair()     Despair from rolls
 *     game.drpg.diagnoseCharacters()  who has not been set up yet
 */

import { MODULE_ID, STARTING } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { monokumas, getDespair, despairMax } from "./despair.mjs";
import { monokumaFor, students, unassigned } from "./assignments.mjs";
import { studentActors } from "./monokuma.mjs";
import { isPrimaryGm } from "./utils.mjs";

/**
 * Why Dice So Nice might be rolling unskinned dice.
 *
 * Daggerheart assigns skins with
 *   `rollResult.dice[0].options = await getDiceSoNicePreset(...)`
 * and that helper looks the chosen skin up with
 *   `game.dice3d.DiceFactory.systems.get(type.system)`.
 * If the configured dice system is not installed, the lookup fails and the
 * dice fall back to plain defaults — exactly the "dice appear, skin doesn't"
 * symptom. This reports whether that is what is happening.
 */
export function diagnoseDice() {
    const lines = [];
    const dsn = game.modules.get("dice-so-nice");

    lines.push(`Dice So Nice installed: ${dsn ? "yes" : "no"}${dsn ? `, active: ${dsn.active}` : ""}`);
    if (!dsn?.active) {
        lines.push("→ Nothing else matters until Dice So Nice is enabled.");
        return report("Dice diagnostics", lines);
    }

    const factory = game.dice3d?.DiceFactory;
    if (!factory) {
        lines.push("game.dice3d.DiceFactory is unavailable — Dice So Nice has not finished loading.");
        return report("Dice diagnostics", lines);
    }

    const installed = Array.from(factory.systems?.keys?.() ?? []);
    lines.push(`Dice systems available (${installed.length}): ${installed.join(", ") || "none"}`);

    let appearance;
    try {
        appearance = game.settings.get("daggerheart", "Appearance");
    } catch {
        appearance = null;
    }

    const dsnConfig = appearance?.diceSoNiceData ?? appearance?.diceSoNice;
    if (!dsnConfig) {
        lines.push("Could not read Daggerheart's Appearance settings.");
        return report("Dice diagnostics", lines);
    }

    for (const key of ["hope", "fear"]) {
        const chosen = dsnConfig[key]?.system;
        const exists = chosen ? factory.systems?.has?.(chosen) : false;
        lines.push(
            `${key === "fear" ? "despair" : key} skin: "${chosen ?? "(unset)"}" — ` +
            (exists ? "installed ✓" : "NOT INSTALLED ✗  ← this is why the skin does not apply")
        );
    }

    lines.push("");
    lines.push("Fix: Configure Settings → Daggerheart → Appearance → Dice So Nice, and pick a dice system that is in the list above.");

    return report("Dice diagnostics", lines);
}

/** Why a roll with Despair might not be feeding a pool. */
export function diagnoseDespair() {
    const lines = [];

    const enabled = game.settings.get(MODULE_ID, SETTINGS.despairFromRolls);
    lines.push(`"Rolls grant Despair" setting: ${enabled ? "on" : "OFF ← nothing will be awarded"}`);

    const gms = monokumas();
    lines.push(`Monokumas (full Gamemasters): ${gms.length ? gms.map(u => `${u.name} [${getDespair(u.id)}/${despairMax()}]`).join(", ") : "NONE ← no pools exist"}`);

    const assistants = game.users.filter(u => u.role === CONST.USER_ROLES.ASSISTANT);
    if (assistants.length) {
        lines.push(`Assistant GMs (no pool by design): ${assistants.map(u => u.name).join(", ")}`);
    }

    lines.push(`This client is the primary GM (the one that applies awards): ${isPrimaryGm() ? "yes" : "no"}`);
    if (!isPrimaryGm() && game.user.isGM) {
        lines.push("→ Another GM client is handling awards. That is normal with two GMs connected.");
    }
    if (!game.user.isGM) {
        lines.push("→ You are not a GM, so this client never applies awards. Check from a GM client.");
    }

    const roster = students();
    const loose = unassigned();
    lines.push(`Students: ${roster.length}, never explicitly assigned: ${loose.length}${loose.length ? ` (${loose.map(a => a.name).join(", ")})` : ""}`);

    for (const actor of roster.slice(0, 12)) {
        lines.push(`   ${actor.name} → ${monokumaFor(actor)?.name ?? "nobody"}`);
    }

    const last = [...game.messages].reverse().find(m => (m.rolls?.length ?? 0) > 0);
    if (last) {
        lines.push("");
        lines.push(`Most recent roll message: type "${last.type}", speaker actor "${last.speaker?.actor ?? "(none)"}"`);
        import("./despair-award.mjs").then(m => {
            const outcome = m.readDuality(last);
            console.log(`${MODULE_ID} | last roll read as:`, outcome ?? "not a duality roll");
        });
        lines.push("→ How that roll was read has been logged to the console.");
    }

    return report("Despair diagnostics", lines);
}

/**
 * Why the sheet might not look the way it does on another install.
 *
 * Written for exactly one situation: identical module version, identical
 * stylesheet, and the trait frames appear locally but not on a hosted server.
 * That can only be the stylesheet failing to load, the custom properties failing
 * to resolve, or the selector matching nothing — and this says which, from the
 * machine where it is going wrong.
 *
 *     game.drpg.diagnoseStyles()
 */
export function diagnoseStyles() {
    const lines = [];

    // 1. Is our stylesheet on the page at all, and did it parse?
    const sheets = Array.from(document.styleSheets ?? []);
    const ours = sheets.filter(s => (s.href ?? "").includes(MODULE_ID));
    lines.push(`Stylesheets from this module: ${ours.length}`);
    for (const sheet of ours) {
        let rules = null;
        try {
            rules = sheet.cssRules?.length ?? null;
        } catch {
            rules = "unreadable (served cross-origin — this is the CDN case)";
        }
        lines.push(`   ${sheet.href}`);
        lines.push(`   rules parsed: ${rules ?? "none"}${rules === 0 ? "  ← loaded but EMPTY" : ""}`);
    }
    if (!ours.length) {
        lines.push("   ← the module CSS is not attached to this page at all.");
    }

    // 2. Do the theme tokens resolve?
    const root = getComputedStyle(document.documentElement);
    const purple = root.getPropertyValue("--drpg-purple").trim();
    lines.push(`--drpg-purple resolves to: "${purple || "(empty) ← tokens missing"}"`);

    // 3. Did anything on an open sheet actually get framed?
    const framed = document.querySelectorAll(".drpg-trait-frame");
    const areas = document.querySelectorAll(".trait-value-area");
    lines.push(`Elements tagged .drpg-trait-frame right now: ${framed.length}`);
    lines.push(`Elements matching .trait-value-area right now: ${areas.length}`);

    if (!framed.length && !areas.length) {
        lines.push("→ Open a character sheet and run this again — with none open there is nothing to measure.");
    }

    const sample = framed[0] ?? areas[0];
    if (sample) {
        const style = getComputedStyle(sample);
        lines.push(`Computed border on the first one: "${style.border}"`);
        lines.push(`   border-style: ${style.borderStyle}, width: ${style.borderWidth}, colour: ${style.borderColor}`);
        if (style.borderStyle === "none") {
            lines.push("   ← the frame rule is not winning. Something later is overriding it, or the CSS did not load.");
        }
    }

    lines.push("");
    lines.push(`Module version: ${game.modules.get(MODULE_ID)?.version ?? "?"}`);
    lines.push(`Foundry ${game.version}, system ${game.system.id} ${game.system.version}`);
    lines.push(`Other active modules: ${game.modules.filter(m => m.active && m.id !== MODULE_ID).map(m => m.id).join(", ") || "none"}`);

    return report("Style diagnostics", lines);
}

/**
 * Are the Truth Bullets whole?
 *
 * Two things can go quietly wrong. The rows are injected into Daggerheart's own
 * inventory DOM, so a system update that renames the inventory section leaves
 * the badges rendering nowhere — visible here as bullets that exist but have no
 * rows on an open sheet. And because the answer key lives in a GM-side ledger
 * keyed by item uuid, the two halves can drift: a bullet with no entry, or an
 * entry whose bullet is gone.
 *
 *     game.drpg.diagnoseTruthBullets()
 */
export function diagnoseTruthBullets() {
    const lines = [];

    if (!game.user.isGM) {
        lines.push("Not a GM — the answer key is not on this client, so only the visible half can be checked.");
    }

    const bullets = [];
    for (const actor of game.actors) {
        if (actor.type !== "character") continue;
        for (const item of actor.items) {
            if (item.getFlag(MODULE_ID, "category") !== "truthBullet") continue;
            bullets.push({ actor, item });
        }
    }
    lines.push(`Truth Bullets in the world: ${bullets.length}`);

    const unmigrated = bullets.filter(b => !b.item.getFlag(MODULE_ID, "shownType"));
    lines.push(`   without a shown type (never migrated): ${unmigrated.length}${
        unmigrated.length ? "  ← run game.drpg.migrateTruthBullets()" : ""
    }`);

    if (game.user.isGM) {
        const ledger = game.settings.get(MODULE_ID, SETTINGS.truthBulletSecrets) ?? {};
        const live = new Set(bullets.map(b => b.item.uuid));
        const known = Object.entries(ledger).filter(([, e]) => e && !e.deleted).map(([uuid]) => uuid);

        const missing = bullets.filter(b => !known.includes(b.item.uuid));
        const orphans = known.filter(uuid => !live.has(uuid));

        lines.push(`Ledger entries on this browser: ${known.length}`);
        lines.push(`   bullets with no entry: ${missing.length}${
            missing.length ? "  ← they will read as Neutral to every GM" : ""
        }`);
        for (const m of missing.slice(0, 10)) lines.push(`      ${m.actor.name} — ${m.item.name}`);
        lines.push(`   entries whose bullet is gone: ${orphans.length}${
            orphans.length ? "  ← harmless, but dropSecret() was missed somewhere" : ""
        }`);
        lines.push("Back the ledger up with game.drpg.exportLedger() — it lives in browser storage, not the world.");
    }

    // "Neutral" describes a BULLET the player has not identified yet, not a kind
    // of trace anyone leaves. A Neutral Remnant on the map is almost always a GM
    // who meant to pick a real category — Observe prices it as Prep so it still
    // works, but the GM should know it is guessing on their behalf.
    const neutral = [];
    for (const scene of game.scenes) {
        for (const token of scene.tokens) {
            if (!token.getFlag(MODULE_ID, "isRemnant")) continue;
            if (token.getFlag(MODULE_ID, "remnantType") !== "neutral") continue;
            neutral.push(scene.name);
        }
    }
    if (neutral.length) {
        lines.push(`Neutral Remnants on the map: ${neutral.length}  ← give each a real category`);
        lines.push(`   scenes: ${Array.from(new Set(neutral)).join(", ")}`);
    }

    // The DOM half: only meaningful with a sheet open, so say so rather than
    // report a zero that means "nothing is open".
    const rows = document.querySelectorAll(".drpg-truth-bullet");
    const groups = document.querySelectorAll('.drpg-inventory-group[data-category="truthBullet"]');
    lines.push(`Bullet rows rendered right now: ${rows.length} (in ${groups.length} inventory group(s))`);
    if (!groups.length) {
        lines.push("   ← open a character sheet on the Inventory tab and run this again;");
        lines.push("      still zero with a sheet open means the injection point moved.");
    }

    return report("Truth Bullet diagnostics", lines);
}

/**
 * Why per-region voice is not moving anybody.
 *
 * Every failure this subsystem can have is silent by design — an assignment
 * nobody can apply settles quietly, a client that is not using LiveKit reports
 * "unavailable", a world with A/V off never reaches the server. That is right
 * for the log and useless for a GM staring at a table that is all in one room.
 * This is the one place that says which of the five links is broken.
 *
 * Run it on the client that is complaining, not only on the GM's.
 */
export function diagnoseVoice() {
    const lines = [];
    const av = game.modules.get("avclient-livekit");

    lines.push(`Regional voice setting: ${game.settings.get(MODULE_ID, SETTINGS.voiceEnabled) ? "on" : "OFF"}`);
    lines.push(`avclient-livekit installed: ${av ? "yes" : "no"}${av ? `, active: ${av.active}` : ""}`);
    if (!av?.active) {
        lines.push("→ Nothing else matters until LiveKit AVClient is enabled.");
        return report("Voice diagnostics", lines);
    }

    const modes = foundry.av.AVSettings.AV_MODES;
    const mode = game.webrtc?.mode;
    const modeName = Object.entries(modes).find(([, v]) => v === mode)?.[0] ?? String(mode);
    lines.push(`World A/V mode: ${modeName}${mode === modes.DISABLED ? "  ← nothing can connect" : ""}`);

    const client = game.webrtc?.client;
    const liveKit = client?._liveKitClient;
    lines.push(`A/V client class: ${client?.constructor?.name ?? "none"}`);
    if (!liveKit) {
        lines.push("→ This world is not using the LiveKit client, so no room switching is possible.");
        return report("Voice diagnostics", lines);
    }

    lines.push(`LiveKit init state: ${liveKit.initState}`);
    lines.push(`LiveKit connection: ${liveKit.connectionState}`);
    lines.push(`Room this client is in: ${client.room ?? "(none)"}`);
    lines.push(`Breakout this client was told: ${liveKit.breakoutRoom ?? "(main room)"}`);

    // Region names are what room assignments are built from — a scene with none
    // is a scene where everybody shares the main room, and that looks identical
    // to the subsystem being broken.
    const regions = Array.from(canvas?.scene?.regions ?? []).map(r => r.name).filter(Boolean);
    lines.push(`Named regions on the current scene: ${regions.length}${
        regions.length ? ` (${regions.join(", ")})` : "  ← nothing to assign anyone to"}`);

    lines.push(`This client runs the assignment loop: ${isPrimaryGm() ? "yes" : "no"}`);
    if (!isPrimaryGm() && !game.users.find(u => u.isGM && u.active)) {
        lines.push("   ← and no GM is connected, so nobody is running it at all.");
    }

    return report("Voice diagnostics", lines);
}

/**
 * Which characters have never been given the guide's starting resources.
 *
 * The one check worth running before a session zero. Daggerheart derives max HP
 * and Stress from a class; this game has none, so `initCharacter` is the only
 * thing that ever writes them — and a character it has not touched reads
 * `max: 0` on both tracks, which is indistinguishable from a character who has
 * been beaten unconscious. The sheet grows a button while that is true (see
 * `injectInitButton` in sheet.mjs); this answers the same question for the
 * whole roster at once.
 */
export function diagnoseCharacters() {
    const lines = [];
    const roster = studentActors();

    lines.push(`Students (Monokumas excluded): ${roster.length}`);
    lines.push(`Guide's starting resources: ${STARTING.hp} HP, ${STARTING.stress} Stress, ${STARTING.hope} Hope`);
    lines.push("");

    const pending = [];
    for (const actor of roster) {
        const hp = actor.system?.resources?.hitPoints?.max ?? 0;
        const stress = actor.system?.resources?.stress?.max ?? 0;
        const ok = hp === STARTING.hp && stress === STARTING.stress;
        if (!ok) pending.push(actor);
        lines.push(`   ${ok ? "✓" : "✗"} ${actor.name} — HP max ${hp}, Stress max ${stress}${
            ok ? "" : "  ← not set up"}`);
    }

    lines.push("");
    if (pending.length) {
        lines.push(`${pending.length} character(s) still need their starting resources.`);
        lines.push("Each of them counts as Wounded AND Broken Down right now: one action");
        lines.push("instead of two, and disadvantage forced onto every roll.");
        lines.push("");
        lines.push("Fix: open the sheet and press the wand button next to the name,");
        lines.push("or run  game.drpg.initCharacter(actor)  for each.");
    } else if (roster.length) {
        lines.push("Every character has the guide's starting resources.");
    }

    return report("Character setup", lines);
}

function report(title, lines) {
    const text = lines.join("\n");
    console.log(`${MODULE_ID} | ${title}\n${text}`);

    ChatMessage.create({
        content: `<h3>${title}</h3><pre style="white-space:pre-wrap;font-size:0.85em">${foundry.utils.escapeHTML(text)}</pre>`,
        whisper: [game.user.id]
    });

    return text;
}
