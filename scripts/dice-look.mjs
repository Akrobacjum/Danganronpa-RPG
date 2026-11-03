/**
 * Danganronpa RPG - the dice look, as each browser draws it (E60 C5b, 03.11.2026; E60-14, E60-15).
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS. The owner, after installing 1.2.97: "Kostki, a wlasciwie ich wyglad miedzy graczami sie nie
 * zgadzaja - cos z dice so nice sie nie zgadza. Potrzebujemy diagnostyki." The investigation (the stage's
 * dice/findings.md, outside the repository) found eleven ways two browsers draw one throw differently, and most of
 * them live on one browser alone: Daggerheart's Hope/Despair preset is a client setting (2.9.4 settings.mjs
 * registers Appearance `scope: 'client'`), a die's preset lands on the browser that evaluates it and travels in the
 * roll's JSON, Dice So Nice's "only my dice" and effects are each viewer's own flag, and a name one browser has not
 * registered (a system, a colorset, a texture, a material) falls back there only (DSN 6.2.9 Utils.js
 * `sanitizeAppearance`). So nothing here asks another browser anything (the owner's answer of 03.11, "lekka": no
 * bridge row, no socket): `game.drpg.diagnoseDiceLook()` reads what the browser running it holds, and each person
 * runs it on their own browser and sends the GM its text.
 *
 * WHAT A GM'S RUN READS. Every User's Dice So Nice flags (`settings`: its display; whether it holds the table's
 * forced look, dice-sync.mjs `holdsTableLook`; the fuse that stopped putting it back), the overlays on the actors
 * each player owns against the GMs' copy (gm-stores.mjs `diceLookStore`), the named or last roll's dice with the
 * preset each carried and who its dice were sent to (private-rolls.mjs's audience), and this browser's own versions,
 * Daggerheart preset, Dice So Nice registry and the last throws it was handed. A player's run reads the same of its
 * own browser and its own User only: one row, nothing of the other users' flags, nothing of the GMs' store, and no
 * audience (the incident's audience is the GMs' to know). Nothing is written, posted or sent.
 *
 * THE TEST THROW (`test: true`). A fixed duality roll - a Hope d12 and a Fear d12 - built and evaluated on this
 * browser, so Daggerheart's modifiers lay this browser's preset on it, awaited up to `TEST_WAIT_MS` (2.9.4's
 * `hope()` does not await its preset), read with `throwLook`, and thrown here alone as this user's dice
 * (`showForRoll(roll, game.user, false)`): no message, no sync, nothing written. What it looks like on each screen
 * against what its row says is LIVE-E60-05.
 *
 * THE LAST THROWS. Dice So Nice calls `diceSoNiceRollStart` with each throw it is about to draw on this browser
 * (6.2.9 Dice3D.js `showForRoll`, after its "only my dice" return), its `context.roll` the roll as handed. The last
 * `THROWS_KEPT` are kept here, in memory, as `throwLook` reads them.
 */

import { MODULE_ID, moduleVersion } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { esc, error, dialogContent, markFired } from "./utils.mjs";
import { canonicalLook, holdsTableLook, isForced, fuseStoppedFor, tableLookSource } from "./dice-sync.mjs";
import { lastRollWindow } from "./roll-dialog.mjs";

const DSN = "dice-so-nice";
/** How many throws this browser keeps, newest last. */
const THROWS_KEPT = 8;
/** How long the test throw waits for Daggerheart's preset to land on its dice. */
const TEST_WAIT_MS = 3000;
/** The die classes Daggerheart lays a preset on, and the modifier each carries (2.9.4 baseDie.mjs `MODIFIERS`). */
const DUALITY = Object.freeze({ HopeDie: "hope", FearDie: "fear", AdvantageDie: "advantage", DisadvantageDie: "disadvantage" });
const DUALITY_MODIFIER = Object.freeze({ h: "hope", f: "fear", a: "advantage", d: "disadvantage" });
/** What of a preset is read: the names a browser must have registered, and the colours. */
const PRESET_KEYS = Object.freeze(["system", "colorset", "texture", "material", "font", "foreground", "background", "outline", "edge"]);
/** The finding codes, a closed list (R1294), each with its sentence's key. */
const FINDING_KEYS = Object.freeze({
    notForced: "DRPG.DiceLook.diag.finding.notForced", fuseStopped: "DRPG.DiceLook.diag.finding.fuseStopped",
    overlay: "DRPG.DiceLook.diag.finding.overlay", onlyMine: "DRPG.DiceLook.diag.finding.onlyMine",
    othersSfxOff: "DRPG.DiceLook.diag.finding.othersSfxOff", lowQuality: "DRPG.DiceLook.diag.finding.lowQuality",
    presetDiffers: "DRPG.DiceLook.diag.finding.presetDiffers", presetMissing: "DRPG.DiceLook.diag.finding.presetMissing",
    missingSystem: "DRPG.DiceLook.diag.finding.missingSystem", missingColorset: "DRPG.DiceLook.diag.finding.missingColorset",
    missingTexture: "DRPG.DiceLook.diag.finding.missingTexture", missingMaterial: "DRPG.DiceLook.diag.finding.missingMaterial",
    dsnApiMoved: "DRPG.DiceLook.diag.finding.dsnApiMoved", rolesUnforced: "DRPG.DiceLook.diag.finding.rolesUnforced",
    otherBrowser: "DRPG.DiceLook.diag.finding.otherBrowser"
});
export const LOOK_CODES = Object.freeze(Object.keys(FINDING_KEYS));
/** A duality die's name in a sentence. */
const DIE_KEYS = Object.freeze({ hope: "DRPG.DiceLook.diag.die.hope", fear: "DRPG.DiceLook.diag.die.fear",
    advantage: "DRPG.DiceLook.diag.die.advantage", disadvantage: "DRPG.DiceLook.diag.die.disadvantage" });

const lastThrows = [];

/** Called from module.mjs's `ready`, beside dice-sync.mjs: the listener that keeps the last throws seen here. */
export function registerDiceLook() {
    Hooks.on("diceSoNiceRollStart", onRollStart);
}

function onRollStart(messageId, context) {
    // The contract register's row `hook-dice-so-nice-roll-start` reads it fired (R1545).
    markFired("diceSoNiceRollStart");
    try {
        lastThrows.push({ messageId: typeof messageId === "string" ? messageId : null, by: context?.user?.id ?? null, at: Date.now(),
            dice: throwLook(context?.roll) });
        while (lastThrows.length > THROWS_KEPT) lastThrows.shift();
    } catch (err) {
        error("Could not keep a throw's look", err);
    }
}

/** The throws this browser was handed, newest last (a copy). */
export function lastThrowsSeen() {
    return lastThrows.map(row => ({ ...row, dice: row.dice.map(d => ({ ...d })) }));
}

const text = value => (typeof value === "string" ? value.slice(0, 64) : value === null || value === undefined ? null : String(value).slice(0, 64));

/** A preset's names and colours, or null where the die carries none. */
function presetOf(appearance) {
    if (!appearance || typeof appearance !== "object") return null;
    const out = {};
    for (const key of PRESET_KEYS) if (appearance[key] !== undefined) out[key] = text(appearance[key]);
    return Object.keys(out).length ? out : null;
}

/** Which duality die a term is, by its class or its modifiers, or null. */
function dualityOf(die) {
    const cls = die?.constructor?.name && die.constructor.name !== "Object" ? die.constructor.name : die?.class ?? null;
    if (DUALITY[cls]) return DUALITY[cls];
    const mods = Array.isArray(die?.modifiers) ? die.modifiers : [];
    for (const [mod, kind] of Object.entries(DUALITY_MODIFIER)) if (mods.includes(mod)) return kind;
    return null;
}

/**
 * Per die of a roll (a Roll, or its JSON): its class, faces, modifiers, which duality die it is, the preset its
 * options carry (`options.appearance`, Daggerheart's or a console's), its model file and its Dice So Nice role
 * (6.3+, where a system sets one). Pure.
 */
export function throwLook(roll) {
    const dice = Array.isArray(roll?.dice) && roll.dice.length ? roll.dice
        : (Array.isArray(roll?.terms) ? roll.terms : []).filter(term => typeof term?.faces === "number");
    return dice.slice(0, 16).map(die => ({
        class: text(die?.constructor?.name && die.constructor.name !== "Object" ? die.constructor.name : die?.class ?? null),
        faces: Number.isFinite(die?.faces) ? die.faces : null,
        modifiers: (Array.isArray(die?.modifiers) ? die.modifiers : []).slice(0, 8).map(text),
        duality: dualityOf(die),
        preset: presetOf(die?.options?.appearance),
        modelFile: text(die?.options?.modelFile ?? null),
        role: text(die?.options?.role ?? null)
    }));
}

/** This browser's Daggerheart Hope/Despair preset (2.9 and older), or null where the system keeps none (2.10+: roles). */
function dhPresetHere() {
    let appearance = null;
    try { appearance = game.settings.get("daggerheart", "Appearance"); } catch { return null; }
    const dsn = appearance?.diceSoNice;
    if (!dsn || typeof dsn !== "object") return null;
    const out = {};
    for (const kind of Object.values(DUALITY)) out[kind] = presetOf(dsn[kind]);
    return out;
}

/**
 * Every name a look uses that this browser's Dice So Nice has not registered: `[{ kind, name }]`; null where it cannot
 * tell. Read as DSN 6.2.9's `sanitizeAppearance` reads them (Utils.js): the systems off the factory, the colorsets and
 * textures off `game.dice3d.exports` (Dice3D.js sets `COLORSETS` and `TEXTURELIST` there), the materials off the
 * factory's `material_options`; a list this DSN does not expose is not judged. Whether a name another module adds at
 * run time is in them at a table is LIVE-E60-07.
 */
function missingNames(appearances) {
    const dice3d = game.dice3d;
    const factory = dice3d?.DiceFactory;
    if (!factory) return null;
    const known = {
        system: name => factory.systems?.has?.(name) ?? true,
        colorset: name => name === "custom" || !dice3d.exports?.COLORSETS || Boolean(dice3d.exports.COLORSETS[name]),
        texture: name => name === "none" || name.startsWith("custom:") || !dice3d.exports?.TEXTURELIST || Boolean(dice3d.exports.TEXTURELIST[name]),
        material: name => name === "auto" || !factory.material_options || Boolean(factory.material_options[name])
    };
    const missing = new Map();
    for (const look of appearances) {
        for (const scope of Object.values(look ?? {})) {
            if (!scope || typeof scope !== "object") continue;
            for (const kind of Object.keys(known)) {
                const name = scope[kind];
                if (typeof name === "string" && name && !known[kind](name)) missing.set(`${kind}:${name}`, { kind, name: text(name) });
            }
        }
    }
    return [...missing.values()].slice(0, 64);
}

/** This browser's display of Dice So Nice, as DSN reads it for this user, else its User's flag. */
function displayOf(user, { here = false } = {}) {
    let config = null;
    if (here) {
        try { config = game.dice3d?.constructor?.CONFIG?.(user) ?? null; } catch { config = null; }
    }
    config ??= user?.getFlag?.(DSN, "settings") ?? null;
    if (!config || typeof config !== "object") return { visibility: "all", showOthersSFX: true, imageQuality: null, read: false };
    return { visibility: text(config.visibility ?? "all"), showOthersSFX: config.showOthersSFX !== false,
        imageQuality: text(config.imageQuality ?? null), read: true };
}

/**
 * THIS BROWSER: the versions it runs, Dice So Nice's state and the API the forced look reads, its display, its
 * Daggerheart preset, the names the looks it can read use that it has not registered, and the last throws it was
 * handed. Read only.
 */
export function browserLook({ looks = [] } = {}) {
    const dsn = game.modules.get(DSN);
    const preset = dhPresetHere();
    const version = game.system?.version ?? null;
    return {
        module: moduleVersion(), foundry: text(game.version ?? null),
        system: { id: text(game.system?.id ?? null), version: text(version),
            roles: game.system?.id === "daggerheart" && typeof version === "string" && foundry.utils.isNewerVersion(version, "2.9.99") },
        dsn: { version: text(dsn?.version ?? null), active: dsn?.active === true, ready: Boolean(game.dice3d),
            api: { allCustomization: typeof game.dice3d?.constructor?.ALL_CUSTOMIZATION === "function" } },
        display: displayOf(game.user, { here: true }),
        dhPreset: preset,
        registry: { missing: missingNames([...looks, ...(preset ? [preset] : [])]) },
        lastThrows: lastThrowsSeen(),
        // What opened this browser's last roll window (roll-dialog.mjs `noteOpening`, E60 C5c).
        lastWindow: lastRollWindow()
    };
}

/** The roll message a run reads: the one named, else the newest with dice this browser may read. */
function rollMessage(messageId, gm) {
    if (messageId) return game.messages.get(messageId) ?? null;
    return game.messages.contents.filter(m => (m.rolls?.length ?? 0) > 0 && (gm || m.visible !== false)).at(-1) ?? null;
}

/** An actor's Dice So Nice overlay, or null. */
const overlayOf = actor => actor?.flags?.[DSN]?.appearance ?? null;

/**
 * Everything one run reads, as a view `lookFindings` judges: this browser's report, a row per user it may read
 * (every User on a GM, its own on a player), whether the look is forced and by whom, and the roll read. `gm` and
 * `user` are this browser's, stood in for a player by E60-T14.
 */
export async function lookView({ messageId = null, gm = game.user?.isGM === true, user: self = game.user } = {}) {
    let forcing = false;
    try { forcing = game.settings.get(MODULE_ID, SETTINGS.forceDiceLook) === true; } catch { forcing = false; }
    const source = tableLookSource();
    const look = forcing && source ? canonicalLook(source) : null;
    const users = (gm ? game.users.contents : [self]).filter(Boolean);
    let copyOf = () => undefined;
    if (gm) {
        const { diceLookStore } = await import("./gm-stores.mjs");
        copyOf = actorId => (diceLookStore.has(actorId) ? diceLookStore.get(actorId)?.look ?? null : undefined);
    }
    const rows = users.map(user => {
        const owned = (game.actors?.contents ?? []).filter(actor => !user.isGM && actor.testUserPermission?.(user, "OWNER"));
        const overlays = owned.filter(actor => {
            const overlay = overlayOf(actor);
            if (!gm) return overlay !== null;
            const copy = copyOf(actor.id);
            return copy !== undefined && JSON.stringify(overlay ?? null) !== JSON.stringify(copy ?? null);
        }).map(actor => text(actor.name));
        return {
            id: user.id, name: text(user.name), here: user.id === self?.id, gm: user.isGM === true, active: user.active === true,
            forced: isForced(user), holds: look && isForced(user) ? holdsTableLook(user, look) : null,
            stopped: gm ? fuseStoppedFor(user.id) : null, overlays, display: displayOf(user, { here: user.id === game.user?.id })
        };
    });
    const looks = users.map(user => user.getFlag?.(DSN, "appearance")).filter(Boolean);
    const message = rollMessage(messageId, gm);
    let roll = null;
    if (message) {
        let by = message.author?.id ?? null, audience = null;
        if (gm) {
            const P = await import("./private-rolls.mjs");
            if (P.isDrawnRoll(message)) {
                const { drawnRecordOf } = await import("./roll-draw.mjs");
                by = drawnRecordOf(message)?.userId ?? by;
                audience = P.drawnDiceAudienceIds(message, by);
            } else audience = P.diceAudienceIds(message);
        }
        roll = { messageId: message.id, by, dice: (message.rolls ?? []).flatMap(r => throwLook(r)), audience };
    }
    return { gm, me: self?.id ?? null, forcing, sourceId: source?.id ?? null, users: rows, browser: browserLook({ looks }), roll };
}

const sameShown = (a, b) => ["system", "colorset", "texture", "material", "foreground", "background"].every(key => (a?.[key] ?? null) === (b?.[key] ?? null));

/**
 * THE FINDINGS: `[{ userId, code, words }]`, each code of `LOOK_CODES` raised by its own fact in the view and by no
 * other (R1294). A user's row: the forced look not held, its fuse stopped, a character's overlay, "only my dice",
 * others' effects off, low image quality, and - on a GM's run, for another user - that their browser is not read
 * here. This browser's row: a preset differing from the read roll's, a duality die of it with no preset, names
 * not registered here, Dice So Nice's moved API, Daggerheart's roles. Pure but for the words.
 */
export function lookFindings(view) {
    const out = [];
    const say = (userId, code, data = {}) => out.push({ userId, code, words: game.i18n.format(FINDING_KEYS[code], data) });
    const dieName = kind => game.i18n.localize(DIE_KEYS[kind] ?? DIE_KEYS.hope);
    for (const user of view?.users ?? []) {
        const name = user.name ?? "?";
        if (view.forcing && user.forced && user.holds === false && user.stopped !== true) say(user.id, "notForced", { name });
        if (user.stopped === true) say(user.id, "fuseStopped", { name });
        if ((user.overlays ?? []).length) say(user.id, "overlay", { name, actors: user.overlays.join(", ") });
        if (user.display?.visibility === "mine") say(user.id, "onlyMine", { name });
        if (user.display?.showOthersSFX === false) say(user.id, "othersSfxOff", { name });
        if (user.display?.imageQuality === "low") say(user.id, "lowQuality", { name });
        if (view.gm && !user.here) say(user.id, "otherBrowser", { name });
    }
    const me = view?.me ?? null;
    const browser = view?.browser ?? {};
    const duality = (view?.roll?.dice ?? []).filter(die => die.duality);
    for (const die of duality) {
        if (!die.preset) say(view.roll.by ?? me, "presetMissing", { duality: dieName(die.duality) });
        else if (browser.dhPreset?.[die.duality] && !sameShown(die.preset, browser.dhPreset[die.duality])) say(me, "presetDiffers", { duality: dieName(die.duality) });
    }
    const kinds = { system: "missingSystem", colorset: "missingColorset", texture: "missingTexture", material: "missingMaterial" };
    for (const row of browser.registry?.missing ?? []) if (kinds[row.kind]) say(me, kinds[row.kind], { name: row.name });
    if (browser.dsn?.active && browser.dsn.api?.allCustomization === false) say(me, "dsnApiMoved", { version: browser.dsn.version ?? "?" });
    if (browser.system?.roles === true) say(me, "rolesUnforced", { version: browser.system.version ?? "?" });
    return out;
}

/** The test throw: a fixed Hope d12 and Fear d12 evaluated here, its preset awaited, read and thrown here alone. */
async function testThrow() {
    const die = cls => ({ class: cls, options: {}, evaluated: false, number: 1, faces: 12, modifiers: [], results: [] });
    try {
        const roll = Roll.fromData({ class: "Roll", options: {}, dice: [], formula: "1d12 + 1d12", evaluated: false,
            terms: [die("HopeDie"), { class: "OperatorTerm", options: {}, evaluated: false, operator: "+" }, die("FearDie")] });
        await roll.evaluate();
        roll.dice.forEach((d, i) => { if (d.results?.[0]) d.results[0].result = [7, 5][i] ?? d.results[0].result; });
        const started = Date.now();
        const landed = () => roll.dice.every(d => !dualityOf(d) || presetOf(d.options?.appearance));
        while (game.dice3d && !landed() && Date.now() - started < TEST_WAIT_MS) await new Promise(resolve => setTimeout(resolve, 100));
        const dice = throwLook(roll);
        let shown = false;
        if (typeof game.dice3d?.showForRoll === "function") shown = Boolean(await game.dice3d.showForRoll(roll, game.user, false));
        return { dice, waitedMs: Date.now() - started, shown, error: null };
    } catch (err) {
        error("Could not make the dice look's test throw", err);
        return { dice: [], waitedMs: 0, shown: false, error: text(err?.message ?? err) };
    }
}

const word = key => game.i18n.localize(key);

/** A user's forced-look cell. */
function forcedCell(view, user) {
    if (!view.forcing) return word("DRPG.DiceLook.diag.forced.off");
    if (!user.forced) return word("DRPG.DiceLook.diag.forced.notForced");
    if (user.holds === null) return word("DRPG.DiceLook.diag.forced.unknown");
    return word(user.holds ? "DRPG.DiceLook.diag.forced.held" : "DRPG.DiceLook.diag.forced.notHeld");
}

/** A die's preset, short: "hope: standard/inspired/astralsea/metal". */
function dieLine(die) {
    const p = die.preset;
    const shown = p ? [p.system, p.colorset, p.texture, p.material].map(v => v ?? "-").join("/") : word("DRPG.DiceLook.diag.noPreset");
    return `${die.duality ?? die.class ?? "?"} d${die.faces ?? "?"}: ${shown}`;
}

/** The run as plain lines: the report's part and the console's copy. */
function viewLines(view, findings) {
    const b = view.browser;
    const lines = [`${word("DRPG.DiceLook.diag.browser")}: Danganronpa RPG ${b.module} - Foundry ${b.foundry ?? "?"} - ${b.system.id ?? "?"} ${b.system.version ?? "?"}`
        + ` - Dice So Nice ${b.dsn.active ? b.dsn.version ?? "?" : word("DRPG.DiceLook.diag.dsnOff")}`];
    lines.push(`${word("DRPG.DiceLook.diag.preset")}: ${b.dhPreset ? Object.entries(b.dhPreset).map(([k, p]) => `${k} ${p ? [p.system, p.colorset, p.texture, p.material].join("/") : "-"}`).join("; ") : word("DRPG.DiceLook.diag.presetNone")}`);
    for (const user of view.users) {
        lines.push(`${user.name}: ${forcedCell(view, user)}; ${word("DRPG.DiceLook.diag.display")} ${user.display.visibility}${user.display.showOthersSFX ? "" : ", -sfx"}`
            + `${user.display.imageQuality ? `, ${user.display.imageQuality}` : ""}`);
    }
    if (view.roll) {
        const by = game.users.get(view.roll.by ?? "")?.name ?? "?";
        lines.push(`${word("DRPG.DiceLook.diag.roll")}: ${by} - ${view.roll.dice.map(dieLine).join("; ") || "-"}`);
        if (view.roll.audience) lines.push(`${word("DRPG.DiceLook.diag.audience")}: ${view.roll.audience.map(id => game.users.get(id)?.name ?? id).join(", ") || "-"}`);
    }
    if (view.test) lines.push(`${word("DRPG.DiceLook.diag.test")}: ${view.test.error ?? (view.test.dice.map(dieLine).join("; ") || "-")}`);
    if (b.lastWindow) {
        const w = b.lastWindow;
        lines.push(`${word("DRPG.DiceLook.diag.lastWindow")}: ${w.actor ?? "?"} - actionRoll ${w.actionRoll}, nonce ${w.nonce}, `
            + `${w.actionKey ?? "-"}, ${w.actionType ?? "-"}, ${w.held ?? "-"}`);
    }
    if (b.lastThrows.length) lines.push(`${word("DRPG.DiceLook.diag.lastThrows")}: ${b.lastThrows.map(t => t.dice.filter(d => d.duality).map(dieLine).join(", ") || "-").join(" | ")}`);
    for (const f of findings) lines.push(`- ${f.words}`);
    if (!findings.length) lines.push(word("DRPG.DiceLook.diag.nothingFound"));
    return lines;
}

/** The report's part (diagnostics.mjs `REPORT_SECTIONS`): this browser's run, read here, no test throw, nothing asked. */
export async function diceLookLines({ gm = game.user?.isGM === true } = {}) {
    const view = await lookView({ gm });
    return viewLines(view, lookFindings(view)).join("\n");
}

/** The window: one row per user, the findings under the name each is about, and the lines to copy. */
function windowHtml(view, findings, lines) {
    const head = ["DRPG.DiceLook.diag.who", "DRPG.DiceLook.diag.forcedHead", "DRPG.DiceLook.diag.display", "DRPG.DiceLook.diag.findings"]
        .map(key => `<th>${esc(word(key))}</th>`).join("");
    const body = view.users.map(user => {
        const said = findings.filter(f => f.userId === user.id).map(f => `<li>${esc(f.words)}</li>`).join("");
        return `<tr><td>${esc(user.name)}</td><td>${esc(forcedCell(view, user))}</td>`
            + `<td>${esc([user.display.visibility, user.display.showOthersSFX ? null : "-sfx", user.display.imageQuality].filter(Boolean).join(", "))}</td>`
            + `<td><ul>${said}</ul></td></tr>`;
    }).join("");
    const mine = findings.filter(f => !view.users.some(u => u.id === f.userId)).map(f => `<li>${esc(f.words)}</li>`).join("");
    return `<div>
        <p class="notes">${esc(word(view.gm ? "DRPG.DiceLook.diag.introGm" : "DRPG.DiceLook.diag.introPlayer"))}</p>
        <table class="drpg-dice-look"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
        ${mine ? `<ul>${mine}</ul>` : ""}
        <pre class="drpg-diagnose-report">${esc(lines.join("\n"))}</pre>
    </div>`;
}

/**
 * `game.drpg.diagnoseDiceLook({ messageId, test })`: the dice look as this browser reads it (the header), in a
 * window and on the console (`console.table`); answers `{ view, findings, text }`. `show: false` draws no window;
 * `gm` and `user` stand in for a player (E60-T14).
 */
export async function diagnoseDiceLook({ messageId = null, test = false, show = true, gm = game.user?.isGM === true, user = game.user } = {}) {
    const view = await lookView({ messageId: typeof messageId === "string" ? messageId : null, gm, user });
    if (test) view.test = await testThrow();
    const findings = lookFindings(view);
    const lines = viewLines(view, findings);
    const text = lines.join("\n");
    try {
        console.table(view.users.map(user => ({ user: user.name, forced: forcedCell(view, user), visibility: user.display.visibility,
            othersSfx: user.display.showOthersSFX, findings: findings.filter(f => f.userId === user.id).map(f => f.code).join(", ") })));
    } catch { /* a console without table() still has the text */ }
    if (show) {
        const { alreadyOpen } = await import("./live.mjs");
        if (!alreadyOpen("drpg-window-dice-look")) {
            foundry.applications.api.DialogV2.wait({
                classes: ["drpg-panel", "drpg-wide", "drpg-window-dice-look"],
                window: { title: word("DRPG.DiceLook.diag.title") },
                content: dialogContent(windowHtml(view, findings, lines)),
                buttons: [
                    { action: "close", label: game.i18n.localize("DRPG.Panel.close"), default: true },
                    { action: "copy", label: game.i18n.localize("DRPG.Diagnose.copy"),
                        callback: () => { void game.clipboard?.copyPlainText?.(text); return "copy"; } }
                ],
                rejectClose: false
            }).catch(err => error("Could not show the dice look", err));
        }
    }
    return { view, findings, text };
}
