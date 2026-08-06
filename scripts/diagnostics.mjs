/**
 * Danganronpa RPG — diagnostics.
 * ---------------------------------------------------------------------------
 * Answers "why isn't this working" without guesswork. Run from the console:
 *
 *     game.drpg.diagnoseDice()      dice skins
 *     game.drpg.diagnoseDespair()   Despair from rolls
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { monokumas, getDespair, despairMax } from "./despair.mjs";
import { monokumaFor, students, unassigned } from "./assignments.mjs";
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

function report(title, lines) {
    const text = lines.join("\n");
    console.log(`${MODULE_ID} | ${title}\n${text}`);

    ChatMessage.create({
        content: `<h3>${title}</h3><pre style="white-space:pre-wrap;font-size:0.85em">${foundry.utils.escapeHTML(text)}</pre>`,
        whisper: [game.user.id]
    });

    return text;
}
