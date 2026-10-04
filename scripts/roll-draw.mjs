/**
 * Danganronpa RPG - a player's roll, drawn by the GM (E08+E28 C12a, 04.10.2026; audit S16-05).
 * ---------------------------------------------------------------------------
 * Until 1.2.67 a player's browser threw every roll it made, wrote its message and
 * committed its Hope, and the GM read the numbers it was told. D2 asks for the dice
 * to be the GM's. So a player's action roll is configured where it is thrown -
 * Daggerheart's own hooks and roll window, unchanged - and then sent, unevaluated,
 * to the primary GM (`roll.draw`, private-rolls.mjs `ROLL_ACTIONS`), who throws it
 * with its own randomness, writes its message, settles its Hope, Stress and Fear on
 * its own client, records it (`rollStore`, gm-stores.mjs) and answers with the faces
 * it drew. The roller's browser plays those faces back into its own copy of the roll
 * through Daggerheart's `buildEvaluate`, so everything after the roll reads the
 * system's own shape, and plays the dice on its own screen.
 *
 * WHICH ROLLS, IN THIS COMMIT. A roll the module throws for an action
 * (`DRPG_ACTION_ROLL`, action-rolls.mjs), by a player, while a primary GM is
 * connected. A statistic from the sheet is not drawn until C13 gives it its card; a
 * GM's own roll is its own; with no GM the roll is thrown here, as in 1.2.66, until
 * C18 makes an action wait. What the roll adds up to beyond its dice - the
 * statistic, the experiences, the advantage - is the roller's configuration, which
 * C12b holds against what the GM expects; the dice are the GM's from here on.
 *
 * THE SEAM IS DAGGERHEART'S `build` (the plan's 3.2), wrapped once, as critical.mjs
 * wraps `addDualityResourceUpdates`, and registered in patches.mjs. Not a hook: a
 * configuration hook's `false` is no abort in 2.10.5 - `buildConfigure` answers
 * `[]`, which `build` takes for a roll and throws on (dhRoll.mjs:33-39, :74-79) - and
 * `skips.createMessage` throws the dice to every screen (helpers/utils.mjs:805-813).
 * The wrap runs Daggerheart's `buildConfigure` and `buildEvaluate` itself and not
 * `buildPost`: no local message, no local resources, no countdown, no trigger - the
 * GM ran them. Read in 2.10.5's source (dhRoll.mjs, dualityRoll.mjs, d20Roll.mjs,
 * unchanged to 2.10.8 - the plan measured); the harness's roll is modelled on the
 * same reading (client-entry.mjs `DualityRollMock`, C10). Not measured at a table:
 * LIVE-E28-03 is the round trip's cost.
 *
 * THE FALLBACK (D1). The wrap is put only on the build it was written for
 * (`reviewBuild`): `build` calling `buildConfigure`, `buildEvaluate` and `buildPost`
 * in that order, a configuration hook named by Daggerheart's template, and the
 * class's `fromData`, `toMessage` and `dualityUpdate`. Any other build is left
 * alone - rolls are thrown in the player's browser as in 1.2.66 - and the primary
 * GM is told once per Daggerheart version (`announceRollDraw`). R216 reads it.
 * There is no world switch: the owner's Q2 (a), 03.10.2026.
 */

import { MODULE_ID, TIMING } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { primaryGmId, isPrimaryGm, whisperToGms, warn, error, esc } from "./utils.mjs";
import { bridgeRequest } from "./bridge-guards.mjs";
import { rollStore } from "./gm-stores.mjs";
import { ROLL_NONCE, supersedingRoll, rollClaimOf, keepSubject, neutralRollOf } from "./private-rolls.mjs";
import { LOADED_DIE, loadDie } from "./forced-roll.mjs";
import { DRPG_ACTION_ROLL, DRAWN_ROLL } from "./action-rolls.mjs";
import { armedCallsShown } from "./call-effects.mjs";

/** Marks the wrapper, so a second registration is a no-op and patches.mjs can recognise it. */
const SEAM = Symbol.for("drpgRollDraw");

/*
 * HOW LONG THE ROLLER WAITS FOR THE GM'S DRAW. The GM's side is an evaluation and one
 * message, with no window and nothing a person decides, so the answer's clock is a
 * bound for a GM who went away mid-draw - the roll is then not made, as a closed roll
 * window is not (the plan's 3.8) - chosen, not measured (LIVE-E28-03).
 */
const DRAW_ANSWER_MS = 30_000;

/** What the wrap found on this client: "ok" (wrapped), "changed" (left alone, `why`), or "none" yet. */
let seam = { state: "none", why: "" };

/* ==========================================================================
 * THE BUILD IT WAS WRITTEN FOR
 * ========================================================================== */

/** The source of `name` on `cls` and on each class it extends, nearest first. */
function sourcesOf(cls, name) {
    const out = [];
    for (let at = cls; at && at !== Function.prototype; at = Object.getPrototypeOf(at)) {
        if (Object.hasOwn(at, name) && typeof at[name] === "function") out.push(Function.prototype.toString.call(at[name]));
    }
    return out;
}

/**
 * Is `cls`'s build the one the draw was written for? `{ ok, why }`, `why` in English for
 * the log. Reads the functions' own source, as relay-guard.mjs `fingerprintOf` reads
 * the relay's - Daggerheart ships unminified - and the wrapper's original where the
 * class is wrapped already. Exported for R216.
 */
export function reviewBuild(cls) {
    if (typeof cls !== "function") return { ok: false, why: "no duality roll class" };
    const build = cls.build?.[SEAM] ? Function.prototype.toString.call(cls.build.original) : (sourcesOf(cls, "build")[0] ?? "");
    const at = ["buildConfigure", "buildEvaluate", "buildPost"].map(step => build.indexOf(`.${step}(`));
    if (at.some(i => i < 0) || !(at[0] < at[1] && at[1] < at[2])) {
        return { ok: false, why: "build does not call buildConfigure, buildEvaluate and buildPost in that order" };
    }
    if (!sourcesOf(cls, "buildConfigure").some(text => /\.post\$\{[^}]*\}RollConfiguration`/.test(text))) {
        return { ok: false, why: "buildConfigure fires no configuration hook by Daggerheart's template" };
    }
    const hooks = typeof cls.getHooks === "function" ? cls.getHooks() : [];
    if (!Array.isArray(hooks) || !hooks.includes("Duality")) return { ok: false, why: "the class names no Duality hooks" };
    const missing = ["fromData", "toMessage", "buildEvaluate", "dualityUpdate"].filter(name => typeof cls[name] !== "function");
    if (missing.length) return { ok: false, why: `the class has no ${missing.join(", ")}` };
    return { ok: true, why: "" };
}

/** What the seam found on this client, for R216 and patches.mjs. */
export function rollDrawState() {
    return { ...seam };
}

/** At `setup`, beside critical.mjs: wrap the duality roll's build, or leave it and say why. */
export function registerRollDraw() {
    const cls = game.system?.api?.dice?.DualityRoll;
    if (cls?.build?.[SEAM]) return;
    const review = reviewBuild(cls);
    if (!review.ok) {
        seam = { state: "changed", why: review.why };
        warn(`Rolls are not drawn by the GM on this Daggerheart (${game.system?.version ?? "?"}): ${review.why}.`);
        return;
    }
    const original = cls.build;
    async function drawnBuild(config = {}, message = {}) {
        return drawOrThrow(this, original, config, message);
    }
    drawnBuild[SEAM] = true;
    drawnBuild.original = original;
    cls.build = drawnBuild;
    seam = { state: "ok", why: "" };
}

/**
 * At `ready`, on the primary GM: a build the draw was not written for is said once per
 * Daggerheart version, as the relay guard's unreviewed cases are (relay-guard.mjs
 * `announce`).
 */
export async function announceRollDraw() {
    if (!isPrimaryGm() || seam.state === "ok") return;
    const version = String(game.system?.version ?? "?");
    let warned = "";
    try { warned = String(game.settings.get(MODULE_ID, SETTINGS.rollDrawWarned) ?? ""); } catch { warned = ""; }
    if (warned === version) return;
    await whisperToGms(`<p class="drpg-warning">${esc(game.i18n.format("DRPG.Rolls.notDrawnHere", { version }))}</p>`);
    try { await game.settings.set(MODULE_ID, SETTINGS.rollDrawWarned, version); } catch { /* said again next load */ }
}

/* ==========================================================================
 * THE ROLLER'S SIDE
 * ========================================================================== */

/** Is this roll drawn by the GM? A player's action roll the module claimed, with a primary GM to draw it. */
function drawsHere(config) {
    if (game.user?.isGM || !primaryGmId()) return false;
    if (config?.[DRPG_ACTION_ROLL] !== true || config.evaluate === false || config.skips?.createMessage || config.source?.message) return false;
    return Boolean(rollClaimOf(config[ROLL_NONCE])?.subject);
}

/** The wrap's body: Daggerheart's own build for anything not drawn; for a drawn roll, configure, ask, play back. */
async function drawOrThrow(cls, original, config, message) {
    if (!drawsHere(config)) return original.call(cls, config, message);
    const roll = await cls.buildConfigure(config, message);
    // Daggerheart's own build returns on no roll, and throws as it evaluates the `[]` a
    // configuration hook's `false` leaves; here that is a roll not made, said in the log.
    if (!roll) return;
    if (typeof roll.toJSON !== "function") {
        warn("A roll configured to be drawn by the GM was not a roll; nothing was thrown.");
        return;
    }
    const claim = rollClaimOf(config[ROLL_NONCE]);
    const answer = await bridgeRequest("roll.draw", drawPacketOf(roll, config, claim), { settle: "reply", timeoutMs: DRAW_ANSWER_MS });
    // Refused, or no answer: the waiter has said so once (`sayNotDone`); the roll is not made.
    if (!answer?.ok || typeof answer.value?.messageId !== "string") return;
    await playBack(cls, roll, config, message, answer.value, claim.subject);
    return config;
}

/*
 * WHAT THE ROLL TAKES TO THE GM. The roll as Foundry writes it (`toJSON`), unevaluated,
 * its options made plain and then neutral as its message would keep them
 * (private-rolls.mjs `neutralRollOf`): the GM's message is written from it, and needs
 * nothing of the character - the GM has the character. A document on the config (a
 * character, a token) is left out rather than serialised: it would name the roll's
 * character in every browser's copy of the message. The Loaded Die's mark, which the
 * neutral roll drops, travels beside it, and so do the window's costs. Exported for the suite,
 * which sends the GM a packet of its own roll's shape (tests-tier2.mjs `drawnForPlayer`).
 */
const SENT_WITHOUT = new Set(["resourceUpdates", "message", "messageRoll", "data", "effects", "bonusEffects"]);

export function drawPacketOf(roll, config, claim) {
    const json = roll.toJSON();
    const options = {};
    for (const [key, value] of Object.entries(json.options ?? {})) {
        if (SENT_WITHOUT.has(key) || value === undefined || typeof value === "function" || value?.documentName) continue;
        try { options[key] = JSON.parse(JSON.stringify(value)); } catch { /* not JSON, so not on a message either */ }
    }
    const plain = JSON.parse(JSON.stringify({ ...json, options: {} }));
    return {
        actorId: claim.subject?.id ?? null,
        actionKey: claim.actionKey ?? null,
        nonce: config[ROLL_NONCE],
        claimed: true,
        loaded: typeof config[LOADED_DIE] === "string" ? config[LOADED_DIE] : null,
        costs: (Array.isArray(config.costs) ? config.costs : []).filter(c => c?.enabled)
            .map(c => ({ key: c.key, value: c.value, enabled: true })),
        roll: neutralRollOf({ ...plain, options })
    };
}

/**
 * The GM's faces, played into this browser's copy of the roll. forced-roll.mjs's shadow
 * of `evaluate` is taken off first: the GM loaded the die on its own throw, and this copy
 * only repeats what fell. Each face f is drawn as `u = 1 - (f - 0.5) / faces` - the
 * middle of the band Foundry's `ceil((1 - u) * faces)` maps to f - in the order the GM's
 * dice drew them, then the randomiser again for anything the GM did not draw. A total
 * this copy reads differently is the GM's (the record stands) and is logged.
 */
async function playBack(cls, roll, config, message, { rollId, messageId, faces, total }, subject) {
    if (Object.hasOwn(roll, "evaluate")) delete roll.evaluate;
    config[DRAWN_ROLL] = { rollId, messageId };
    const script = (Array.isArray(faces) ? faces : [])
        .map(face => 1 - (Number(face?.result) - 0.5) / Number(face?.faces))
        .filter(u => Number.isFinite(u));
    const dice = CONFIG.Dice;
    const real = dice.randomUniform;
    dice.randomUniform = () => (script.length ? script.shift() : real());
    try {
        await cls.buildEvaluate(roll, config, message);
    } finally {
        dice.randomUniform = real;
    }
    if (typeof total === "number" && roll.total !== total) {
        warn(`The GM drew ${total} for roll ${rollId}; this browser read ${roll.total} from the same faces. The GM's stands.`);
        if (config.roll && typeof config.roll === "object") config.roll.total = total;
    }
    const { messageArrives } = await import("./secret.mjs");
    config.message = game.messages.get(messageId) ?? await messageArrives(messageId);
    // Whose roll it is, kept here as for a roll this browser threw, so `reportRollSubject`
    // asks nothing: the GM kept it as it wrote the message.
    if (subject?.id) keepSubject(messageId, subject.id, game.user?.id ?? null);
    await playDice(roll);
}

/*
 * THE ROLLER'S DICE, ON THE ROLLER'S SCREEN (the plan's 3.4, its first line). Played from
 * this copy of the roll, as this user's, not synchronised: nobody else's screen throws
 * them (the GMs' and the incident's audience are the relay's, private-rolls.mjs). With no
 * Dice So Nice, the dice sound. Waited for as Daggerheart's `toMessage` waits for the
 * animation, so the module's card does not land while the dice still fall - bounded as
 * `diceSettled` is (action-rolls.mjs), for a tab in the background.
 */
async function playDice(roll) {
    try {
        if (typeof game.dice3d?.showForRoll !== "function") return void foundry.audio.AudioHelper.play({ src: CONFIG.sounds.dice });
        await Promise.race([
            game.dice3d.showForRoll(roll, game.user, false),
            new Promise(resolve => setTimeout(resolve, TIMING.diceSettleMs))
        ]);
    } catch (err) {
        error("Could not show the dice of a roll the GM drew", err);
    }
}

/* ==========================================================================
 * THE GM'S SIDE
 * ========================================================================== */

/*
 * DAGGERHEART'S `ResourceUpdateMap` (data/action/baseAction.mjs:490-528, 2.10.5, read
 * 04.10.2026), which the system hands out on no `game.system.api` path read: what a roll's
 * resource step adds up, keyed by resource, written in one `modifyResource` on the
 * character or its partner. Written again here for the GM's own throw of a player's roll;
 * an empty map writes nothing, where Daggerheart's writes an empty list.
 */
class DrawnResources extends Map {
    #actor;
    constructor(actor) {
        super();
        this.#actor = actor;
    }
    addResources(resources) {
        if (!resources?.length || resources.some(resource => !resource.key)) return;
        for (const resource of resources) {
            const existing = this.get(resource.key);
            if (!existing || resource.clear) this.set(resource.key, resource);
            else if (!existing.clear) this.set(resource.key, { ...existing, value: existing.value + (resource.value ?? 0) });
        }
    }
    async updateResources() {
        if (!this.size || !this.#actor) return;
        const target = this.#actor.system?.partner ?? this.#actor;
        await target.modifyResource([...this.values()]);
    }
}

/*
 * WHAT A ROLL'S WINDOW SAYS IT COSTS. A cost is taken off the roller's own character
 * (`commitResources`, action-rolls.mjs, took it there until now): whole numbers from 1
 * to 12, enabled, at most eight - so a cost can only be paid, never turned into a gain.
 * The bounds are this function's, not a table's largest window, measured.
 */
const COSTS_KEPT = 8;
function paidCosts(costs) {
    return (Array.isArray(costs) ? costs : [])
        .filter(c => c && c.enabled === true && typeof c.key === "string" && c.key.length > 0 && c.key.length <= 32
            && Number.isInteger(c.value) && c.value >= 1 && c.value <= 12)
        .slice(0, COSTS_KEPT)
        .map(c => ({ key: c.key, value: c.value, enabled: true }));
}

/**
 * The run of `roll.draw` on the primary GM (private-rolls.mjs `drawRollOnGm`). The guards
 * have tied the character to the sender and the roll to a duality roll nobody threw. The
 * roll is rebuilt with Daggerheart's `fromData` - never the constructor, which builds the
 * advantage die again from the options (reroll.mjs `rerollKeepingDice`) - thrown here,
 * written, settled and recorded; answered `{ rollId, messageId, faces, total }`.
 */
export async function drawOnGm({ actorId, actionKey, nonce, claimed, loaded, costs, roll: json }, sender) {
    const actor = game.actors.get(actorId ?? "");
    const cls = game.system?.api?.dice?.DualityRoll;
    if (!actor || typeof cls?.fromData !== "function") throw new Error("there is no character or no duality roll to draw");
    const roll = cls.fromData(foundry.utils.deepClone(json));
    // A Daggerheart roll's options are its config (dhRoll.mjs:45). What the GM's own steps
    // read is put back in memory: the character's uuid for the resource step, its roll data
    // for the triggers (dualityRoll.mjs:253-276), and its own resource map; `mute` is
    // `toMessage`'s `sound: null`. The message is emptied of all of it as it is created.
    const config = roll.options;
    config.source = { ...(config.source ?? {}), actor: actor.uuid };
    config.mute = true;
    config.costs = paidCosts(costs);
    config.resourceUpdates = new DrawnResources(actor);
    roll.data = actor.getRollData?.() ?? {};
    // The Loaded Die (forced-roll.mjs): loaded here only while the character's armed Calls
    // hold the mark. Its check of everything else a roll claims is C12b's.
    if (typeof loaded === "string" && armedCallsShown(actor).some(call => call?.grants === "critical" && call.nonce === loaded)) {
        loadDie(roll, loaded);
    }
    await cls.buildEvaluate(roll, config, {});
    const rollId = foundry.utils.randomID();
    const message = await writeDrawnMessage(cls, roll, config, { actor, nonce, rollId, sender });
    await cls.dualityUpdate(config);
    if (typeof cls.handleTriggers === "function") await cls.handleTriggers(roll, config);
    if (config.costs.length) config.resourceUpdates.addResources(config.costs.map(c => ({ ...c, value: -c.value })));
    await config.resourceUpdates.updateResources();
    await keepRecord({
        rollId, actorId: actor.id, userId: sender.id,
        actionKey: typeof actionKey === "string" && /^[a-zA-Z]{1,32}$/.test(actionKey) ? actionKey : null,
        messageId: message.id, claimed: Boolean(claimed), formula: roll.formula,
        dice: roll.dice.map(die => ({ faces: die.faces, results: die.results.map(r => ({ result: r.result, active: r.active !== false })) })),
        total: roll.total, hope: roll.dHope?.total ?? null, fear: roll.dFear?.total ?? null,
        isCritical: Boolean(roll.isCritical), withHope: Boolean(roll.withHope), withFear: Boolean(roll.withFear),
        modifiers: (Array.isArray(config.roll?.modifiers) ? config.roll.modifiers : []).map(m => Number(m?.value) || 0),
        expected: null, flags: [], used: {}, versions: [], at: Date.now()
    });
    return { reply: { rollId, messageId: message.id, faces: facesOf(roll), total: roll.total } };
}

/** Every face the roll drew, in the order its dice drew them. */
function facesOf(roll) {
    return roll.dice.flatMap(die => die.results.map(r => ({ faces: die.faces, result: r.result })));
}

/*
 * THE MESSAGE, AS DAGGERHEART'S `toMessage` SHAPES IT, WRITTEN BY THE GM. Inside a claim of
 * the roller's nonce (private-rolls.mjs `supersedingRoll`), so the module's rule for a roll it
 * threw applies as it is created: claimed, emptied of its character, whispered to the GMs where
 * rolls are private, the record's id and `drawn` beside the claim's flag. The claim's subject
 * is kept as the message is created - before the Despair award, which listens later in the same
 * hook, asks for it - and the incident's audience is sent its dice, the roller left out: their
 * dice are played from the answer. `toMessage` then waits for Dice So Nice; the draw does not
 * (the plan's 3.3): it goes on as soon as the message exists.
 */
async function writeDrawnMessage(cls, roll, config, { actor, nonce, rollId, sender }) {
    let heard = null;
    const created = new Promise(resolve => { heard = resolve; });
    const writing = supersedingRoll(() => cls.toMessage(roll, config),
        { subject: actor, nonce, stamp: { rollId, drawn: true }, except: [sender.id], onCreated: heard });
    const message = await Promise.race([created, writing]);
    writing.catch(err => error("The message of a roll the GM drew failed after it was written", err));
    if (!message?.id) throw new Error("the drawn roll's message was not written");
    return message;
}

/*
 * THE RECORD (the plan's 3.3), on the primary: keyed by `rollId`, synced to the other GMs.
 * Swept as each is written - a row older than a Reroll can reach is worth nothing, and the
 * record of a draw whose answer never arrived goes with it (the plan's 3.8).
 */
async function keepRecord(record) {
    await rollStore.whenHydrated();
    const cutoff = record.at - TIMING.rerollWindowMinutes * 60_000;
    const old = Object.entries(rollStore.entries()).filter(([, row]) => !(row?.at >= cutoff)).map(([id]) => id);
    if (old.length) await rollStore.dropMany(old);
    await rollStore.patch(record.rollId, record);
}

/** The GMs' record of a drawn roll, or null. */
export function rollRecord(rollId) {
    return typeof rollId === "string" && rollId ? rollStore.get(rollId) : null;
}

/** The record of the roll a message holds, when the GM drew it and the record names that message; else null. */
export function drawnRecordOf(message) {
    if (!message?.getFlag?.(MODULE_ID, "drawn")) return null;
    const row = rollRecord(message.getFlag(MODULE_ID, "rollId"));
    return row && row.messageId === message.id ? row : null;
}
