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
 * WHICH ROLLS. A roll the module throws for an action (`DRPG_ACTION_ROLL`,
 * action-rolls.mjs), by a player, while a primary GM is connected; and since C13 a
 * statistic from the sheet (`sheetRollOf`), whose message keeps Daggerheart's card and is
 * read on the roller's browser alone (private-rolls.mjs `readableHere`). Daggerheart's own
 * item rolls (their source names an item or an action) and a Monocub's Meddle (a plain
 * `Roll`, monocub.mjs) are not drawn; a GM's own roll is its own; with no GM the roll is
 * thrown here, as in 1.2.66, until C18 makes an action wait. What the roll adds up to beyond its dice - the
 * statistic, the experiences, the advantage - is the roller's configuration, which
 * the GM holds against what it expects (C12b, "WHAT THE GM EXPECTS" below); the dice
 * are the GM's from here on.
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
 * GM is told once per Daggerheart version (`announceRollDraw`). R217 reads it.
 * There is no world switch: the owner's Q2 (a), 03.10.2026.
 */

import { MODULE_ID, TIMING, ACTIONS, TRAITS, TRAIT_BY_DH, MURDER_OPENING } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { primaryGmId, isPrimaryGm, whisperToGms, warn, error, esc } from "./utils.mjs";
import { bridgeRequest } from "./bridge-guards.mjs";
import { rollStore } from "./gm-stores.mjs";
import { ROLL_NONCE, supersedingRoll, rollClaimOf, keepSubject, neutralRollOf, readHere, awaitDrawn } from "./private-rolls.mjs";
import { LOADED_DIE, loadDie, standAsideFor } from "./forced-roll.mjs";
import { DRPG_ACTION_ROLL, DRAWN_ROLL, TRAIT_BY_GM, searchOdds, stashStepFor } from "./action-rolls.mjs";
import { armedCallsShown, situationalAdvantage, spendCallsByNonce } from "./call-effects.mjs";
import { isBrokenDown } from "./character.mjs";
import { isMonokuma } from "./monokuma.mjs";
import { roomOfActor } from "./movement.mjs";
import { cardFlag } from "./secret.mjs";

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
 * class is wrapped already. Exported for R217.
 */
export function reviewBuild(cls) {
    if (typeof cls !== "function") return { ok: false, why: "no duality roll class" };
    const build = cls.build?.[SEAM] ? Function.prototype.toString.call(cls.build.original) : (sourcesOf(cls, "build")[0] ?? "");
    const at = ["buildConfigure", "buildEvaluate", "buildPost"].map(step => build.indexOf(`.${step}(`));
    if (at.some(i => i < 0) || !(at[0] < at[1] && at[1] < at[2])) {
        return { ok: false, why: "build does not call buildConfigure, buildEvaluate and buildPost in that order" };
    }
    // `\x60` is the backtick. Written as one, it opened a template string for the suite's
    // source reader (tests-kit.mjs `stripStrings`), which then hid every name down to the
    // next backtick from R22 (C12b's first suite run, 04.10.2026).
    if (!sourcesOf(cls, "buildConfigure").some(text => /\.post\$\{[^}]*\}RollConfiguration\x60/.test(text))) {
        return { ok: false, why: "buildConfigure fires no configuration hook by Daggerheart's template" };
    }
    const hooks = typeof cls.getHooks === "function" ? cls.getHooks() : [];
    if (!Array.isArray(hooks) || !hooks.includes("Duality")) return { ok: false, why: "the class names no Duality hooks" };
    const missing = ["fromData", "toMessage", "buildEvaluate", "dualityUpdate"].filter(name => typeof cls[name] !== "function");
    if (missing.length) return { ok: false, why: `the class has no ${missing.join(", ")}` };
    return { ok: true, why: "" };
}

/** What the seam found on this client, for R217 and patches.mjs. */
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
    standAsideFor(drawnByGm);
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

/**
 * Is this roll drawn by the GM? A player's roll with a primary GM to draw it, thrown and written
 * (not `evaluate: false`, not `skips.createMessage`, not a roll of a message already written):
 * an action roll the module claimed, or a statistic from the sheet.
 */
function drawsHere(config) {
    if (game.user?.isGM || !primaryGmId()) return false;
    if (!config || config.evaluate === false || config.skips?.createMessage || config.source?.message) return false;
    if (config[DRPG_ACTION_ROLL] === true) return Boolean(rollClaimOf(config[ROLL_NONCE])?.subject);
    return Boolean(sheetRollOf(config));
}

/**
 * A STATISTIC FROM THE SHEET (E08+E28 C13; the plan's 3.4): the character a duality roll of a
 * statistic is about, when the module did not throw it and no item or action of Daggerheart's is
 * its source - the sheet's statistic (character-sheet.mjs `rollTrait`, actor.mjs `diceRoll`, read
 * in 2.10.5), a reaction a GM asks for in the chat, a companion's roll on its partner - and this
 * player owns that character; else null. Daggerheart's own item rolls go on to a damage step,
 * targets and effects the draw does not carry, and stay this browser's.
 */
function sheetRollOf(config) {
    if (config?.[DRPG_ACTION_ROLL] === true || typeof config?.roll?.trait !== "string") return null;
    if (config.source?.item || config.source?.action || typeof config.source?.actor !== "string") return null;
    let actor = null;
    try { actor = fromUuidSync(config.source.actor); } catch { actor = null; }
    return actor?.documentName === "Actor" && actor.type === "character" && actor.testUserPermission(game.user, "OWNER") ? actor : null;
}

/**
 * Will this configuration be drawn by the GM - the seam is in place and `drawsHere` says so?
 * Asked by what stands aside for a drawn roll on the roller's browser (E08+E28 C12b): the Loaded
 * Die's local swap (forced-roll.mjs `onConfigured`) and the roll window's spend of its Calls
 * (roll-dialog.mjs `onCloseApplication`), both the GM's for a roll it draws.
 */
export function drawnByGm(config) {
    return seam.state === "ok" && drawsHere(config);
}

/**
 * The wrap's body: Daggerheart's own build for anything not drawn; for a drawn roll, configure,
 * ask, play back. A statistic from the sheet comes with no claim of the module's, so it is given
 * one here, as a roll the module throws is (private-rolls.mjs `supersedingRoll`): the nonce the
 * GM's guard asks of the roll, and the place the roll window leaves the Calls it applied
 * (`noteWindowCalls`), which the GM spends. Its card is Daggerheart's (`keepCard`).
 */
async function drawOrThrow(cls, original, config, message) {
    if (!drawsHere(config)) return original.call(cls, config, message);
    if (config[DRPG_ACTION_ROLL] === true) return drawAndPlay(cls, config, message);
    return supersedingRoll(nonce => {
        config[ROLL_NONCE] = nonce;
        return drawAndPlay(cls, config, message);
    }, { subject: sheetRollOf(config), facts: { calls: [], context: {} }, keepCard: true });
}

/**
 * Configure the roll here, ask the GM to draw it, play its answer back. While the GM draws, this
 * browser reads the message the GM writes for this roll's nonce (private-rolls.mjs `awaitDrawn`),
 * and after it by the message's id (`playBack`).
 */
async function drawAndPlay(cls, config, message) {
    const roll = await cls.buildConfigure(config, message);
    // Daggerheart's own build returns on no roll, and throws as it evaluates the `[]` a
    // configuration hook's `false` leaves; here that is a roll not made, said in the log.
    if (!roll) return;
    if (typeof roll.toJSON !== "function") {
        warn("A roll configured to be drawn by the GM was not a roll; nothing was thrown.");
        return;
    }
    const claim = rollClaimOf(config[ROLL_NONCE]);
    const drawn = awaitDrawn(config[ROLL_NONCE]);
    try {
        const answer = await bridgeRequest("roll.draw", drawPacketOf(roll, config, claim), { settle: "reply", timeoutMs: DRAW_ANSWER_MS });
        // Refused, or no answer: the waiter has said so once (`sayNotDone`); the roll is not made.
        if (!answer?.ok || typeof answer.value?.messageId !== "string") return;
        await playBack(cls, roll, config, message, answer.value, claim.subject);
    } finally {
        drawn();
    }
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
 *
 * And what the GM holds the roll against (E08+E28 C12b), each the roller's word: the statistic
 * and the experiences, which the neutral roll drops; the Calls the roll applied (the claim's
 * `facts`, the roll window's list, private-rolls.mjs `noteWindowCalls`); the action's context a
 * check reads (a Search's category and stash, a project's id, an opening's side, `CONTEXT_SENT`);
 * and the situation's dice as this browser armed them (call-effects.mjs `situationalAdvantage`),
 * which the GM reads for itself where it can.
 */
const SENT_WITHOUT = new Set(["resourceUpdates", "message", "messageRoll", "data", "effects", "bonusEffects"]);
const CONTEXT_SENT = Object.freeze({ category: "text", stashDie: "bool", projectId: "id", targetProjectId: "id", side: "text" });
const LISTED_MAX = 16;

/** The context fields a check on the GM reads, plain; nothing else of the action's context leaves. */
function contextSent(context) {
    const out = {};
    for (const [key, kind] of Object.entries(CONTEXT_SENT)) {
        const value = context?.[key];
        if (kind === "bool" && typeof value === "boolean") out[key] = value;
        else if (kind !== "bool" && typeof value === "string" && value.length > 0 && value.length <= 128) out[key] = value;
    }
    return out;
}

/** At most `LISTED_MAX` strings of a list, or none. */
const strings = list => (Array.isArray(list) ? list : []).filter(item => typeof item === "string" && item.length <= 128).slice(0, LISTED_MAX);

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
        // The module's card stands for the roll and Daggerheart's is hidden - not for a statistic from the sheet (C13).
        claimed: claim.keepCard !== true,
        loaded: typeof config[LOADED_DIE] === "string" ? config[LOADED_DIE] : null,
        costs: (Array.isArray(config.costs) ? config.costs : []).filter(c => c?.enabled)
            .map(c => ({ key: c.key, value: c.value, enabled: true })),
        trait: typeof options.roll?.trait === "string" ? options.roll.trait : null,
        experiences: strings(options.experiences),
        calls: strings(claim.facts?.calls),
        context: contextSent(claim.facts?.context),
        situational: situationalAdvantage(),
        roll: neutralRollOf({ ...plain, options })
    };
}

/**
 * The GM's faces, played into this browser's copy of the roll. The Loaded Die is the GM's
 * to load on its own throw (forced-roll.mjs `onConfigured` stands aside for a drawn roll,
 * C12b), and this copy only repeats what fell. Each face f is drawn as `u = 1 - (f - 0.5) / faces` - the
 * middle of the band Foundry's `ceil((1 - u) * faces)` maps to f - in the order the GM's
 * dice drew them, then the randomiser again for anything the GM did not draw. A total
 * this copy reads differently is the GM's (the record stands) and is logged. What the
 * GM decided beside the dice rides on the config with the record's id (`DRAWN_ROLL`):
 * the hidden stash's step it drew (`stash`, action-rolls.mjs `stashStepOf`) and whether
 * it loaded the die (`loaded`).
 */
async function playBack(cls, roll, config, message, { rollId, messageId, faces, total, stash = null, loaded = false }, subject) {
    config[DRAWN_ROLL] = { rollId, messageId, stash: stash && typeof stash === "object" ? stash : null, loaded: loaded === true };
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
    // asks nothing: the GM kept it as it wrote the message. And the message is this browser's
    // to read from here on (C13), as it was while the GM drew it (`awaitDrawn`).
    if (subject?.id) keepSubject(messageId, subject.id, game.user?.id ?? null);
    readHere(messageId);
    await playDice(roll);
}

/*
 * THE ROLLER'S DICE, ON THE ROLLER'S SCREEN (the plan's 3.4, its first line). Played from
 * this copy of the roll, as this user's, not synchronised: nobody else's screen throws
 * them (the GMs' and the incident's audience are the relay's, private-rolls.mjs
 * `relayDrawnDice`, in this user's colours too, C13; Dice So Nice's own decision is off for the
 * GM's message on every browser, `keepDiceToReaders`). With no
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
 * written, settled, held against what this GM expects (`expectedFor`, `checkRoll`), its Calls
 * spent and recorded; answered `{ rollId, messageId, faces, total, stash, loaded }`. `claimed` false
 * is a statistic from the sheet, whose message keeps Daggerheart's card (C13).
 */
export async function drawOnGm({ actorId, actionKey, nonce, claimed, loaded, costs, roll: json,
    trait = null, experiences = [], calls = [], context = {}, situational = 0 }, sender) {
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
    const key = typeof actionKey === "string" && /^[a-zA-Z]{1,32}$/.test(actionKey) ? actionKey : null;
    const told = { trait: typeof trait === "string" ? trait : null, experiences: strings(experiences), context: contextSent(context),
        situational: Number.isFinite(Number(situational)) ? Math.trunc(Number(situational)) : 0, byGm: config[TRAIT_BY_GM] === true };
    // What the roll applied, as this GM holds it: read before the dice, and spent after them.
    const applied = appliedCalls(actor, calls);
    const expected = await expectedFor(actor, { actionKey: key, applied, ...told });
    // The Loaded Die (forced-roll.mjs): loaded here only while the character's armed Calls
    // hold the mark and the roll applied it.
    const loads = typeof loaded === "string" && applied.some(call => call?.grants === "critical" && call.nonce === loaded);
    if (loads) loadDie(roll, loaded);
    await cls.buildEvaluate(roll, config, {});
    const rollId = foundry.utils.randomID();
    const message = await writeDrawnMessage(cls, roll, config, { actor, nonce, rollId, sender, keepCard: claimed === false });
    await cls.dualityUpdate(config);
    if (typeof cls.handleTriggers === "function") await cls.handleTriggers(roll, config);
    if (config.costs.length) config.resourceUpdates.addResources(config.costs.map(c => ({ ...c, value: -c.value })));
    await config.resourceUpdates.updateResources();
    // The hidden stash's step (action-rolls.mjs `stashStep`), drawn here on this GM's dice
    // where the room the GM sees the searcher in holds one; the searcher takes this step and
    // draws none of its own (`stashStepOf`).
    const stash = expected.stashDie && told.context.stashDie === true ? await stashStepFor(roll, actor) : null;
    const flags = checkRoll(roll, actor, told, expected);
    const used = applied.map(call => call.nonce);
    if (used.length) await spendCallsByNonce(actor, used);
    await keepRecord({
        rollId, actorId: actor.id, userId: sender.id, actionKey: key,
        messageId: message.id, claimed: Boolean(claimed), formula: roll.formula,
        // The statistic and the experiences the roll was thrown with, as the GM was told them at
        // the draw - a Reroll rebuilds the roll from these (reroll.mjs `rollAsThrown`), not from a
        // bookmark the roller may send again.
        trait: traitKeyOf(told.trait), experiences: told.experiences.filter(name => actor.system?.experiences?.[name]),
        dice: roll.dice.map(die => ({ faces: die.faces, results: die.results.map(r => ({ result: r.result, active: r.active !== false })) })),
        total: roll.total, hope: roll.dHope?.total ?? null, fear: roll.dFear?.total ?? null,
        isCritical: Boolean(roll.isCritical), withHope: Boolean(roll.withHope), withFear: Boolean(roll.withFear),
        modifiers: (Array.isArray(config.roll?.modifiers) ? config.roll.modifiers : []).map(m => Number(m?.value) || 0),
        expected: recordOf(expected), flags, used: { calls: used, stash, loaded: loads }, versions: [], at: Date.now()
    });
    if (flags.length) await tellUnexpected(actor, flags);
    return { reply: { rollId, messageId: message.id, faces: facesOf(roll), total: roll.total, stash, loaded: loads } };
}

/* ==========================================================================
 * WHAT THE GM EXPECTS OF A ROLL (E08+E28 C12b, 04.10.2026; the plan's 3.3)
 * --------------------------------------------------------------------------
 * The dice are the GM's from C12a; what the roll adds up to beyond them - the statistic, its
 * value, the experiences, the bonus, the advantage dice - is still configured in the roller's
 * browser, by Daggerheart's window under roll-dialog.mjs's locks. D2 (the owner, as E28 says
 * it): a modifier outside the GM's record is at least flagged in 1.2.67, enforced from E29.
 * So this GM reads, for each roll it draws, what it expects from what it holds, and a
 * difference is a `flags` entry on the record, one whisper to the GMs per roll
 * (`DRPG.Rolls.unexpected`) and a line in `game.drpg.rollFlags()`. The roll stands as drawn.
 *
 * What it reads, and from where:
 *   - the statistic: Eye for a Search (ACTIONS.search), the project's own for a Work on it or
 *     a Sabotage of it (projects.mjs, C11d), the opening's as the GM picked it (the incident's
 *     `openingTrait`, C11c), and, for a roll whose window says a GM picked it, the newest pick
 *     card for this character no drawn roll has used yet (gm-bridge.mjs `settleCall`'s
 *     `ruling`, C11b), waited for a moment, as the card's meta can land after the answer; an
 *     armed Resolve's roll is the player's pick, and any statistic stands. Any other roll's
 *     statistic is not checked here: its action is the roller's word (E29);
 *   - the flat modifier: the statistic's value off the character as this GM holds it, each
 *     experience's value - one, and only where an Experience Call bought it, since the module's
 *     window locks them otherwise and strips their Hope cost - the Calls' bonus, and
 *     Daggerheart's roll bonuses from the character's active effects, as a range
 *     (`effectRange`): which of them a roll's window selects is not sent;
 *   - the advantage dice: the Calls the roll applied, Breakdown, and the situation's dice -
 *     read by this GM for a Search (the room's favour and hindrance, vault.mjs) and an opening
 *     (the Night's die, murder.mjs `atNight`), the roller's word elsewhere (a weapon in hand,
 *     a second try, a tool) - summed and capped as roll-dialog.mjs `advantageSources` does;
 *   - a hidden stash in the room this GM sees the searcher in, against the packet's word.
 * Monokuma's rolls are not locked by the window (roll-dialog.mjs `isStudentRoll`), and nothing
 * is expected of them.
 *
 * WHAT THE HARNESS CANNOT SHOW. Daggerheart's roll window is not in the headless harness, so
 * a roll there is built without the dice and the bonus the window would impose: a drawn roll
 * that applied a dice or bonus Call is flagged there, truthfully - its dice lack it - where a
 * table's window would have put it on. Not measured at a table: LIVE-E28.
 * ========================================================================== */

/** The most Calls a packet may name; more is no roll's. */
const CALLS_KEPT = 16;
/** How long a roll a GM picked the statistic for waits for the pick card's meta. Chosen, not measured. */
const PICK_WAIT_MS = 2000;

/** The Calls the roll applied: the ones the packet names that are armed on the character as this GM holds them. */
function appliedCalls(actor, nonces) {
    const named = new Set(strings(nonces).slice(0, CALLS_KEPT));
    return named.size ? armedCallsShown(actor).filter(call => named.has(call?.nonce)) : [];
}

/** Daggerheart's roll bonuses from the character's active effects, `[lowest, highest]` they can add up to. */
function effectRange(actor) {
    let low = 0, high = 0;
    for (const effect of actor?.appliedEffects ?? []) {
        for (const change of effect?.system?.changes ?? effect?.changes ?? []) {
            if (!/bonuses\.roll/.test(String(change?.key ?? ""))) continue;
            const value = Number(change.value) * (change.type === "subtract" ? -1 : 1);
            if (!Number.isFinite(value)) continue;
            if (value > 0) high += value;
            else low += value;
        }
    }
    return [low, high];
}

/** The module's key of a statistic, from Daggerheart's or the module's own; null for neither. */
function traitKeyOf(trait) {
    if (typeof trait !== "string") return null;
    return TRAIT_BY_DH[trait] ?? (Object.hasOwn(TRAITS, trait) ? trait : null);
}

/** The pick kind of a GM's statistic card (trait-ruling.mjs) an action's roll is held to. */
function pickKindOf(actionKey) {
    if (actionKey === "crisis" || actionKey === "cleanup") return actionKey;
    if (actionKey === "project" || actionKey === "sabotage") return "project";
    return "generic";
}

/**
 * The newest pick card a GM settled for this character and kind within the Reroll's window
 * (`{ trait, pick }`, the card's id), or null - also when a drawn roll's record names that card
 * already, so an older pick nobody rolled is never the one a roll is held to.
 */
function gmPickOf(actor, kind) {
    const since = Date.now() - TIMING.rerollWindowMinutes * 60_000;
    const used = new Set(Object.values(rollStore.entries() ?? {}).map(row => row?.expected?.pick).filter(Boolean));
    const messages = game.messages?.contents ?? [];
    for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        if (typeof message.timestamp === "number" && message.timestamp < since) break;
        const ruling = cardFlag(message, "ruling");
        if (ruling?.type !== "trait" || ruling.actorId !== actor.id || ruling.kind !== kind) continue;
        return used.has(message.id) ? null : { trait: traitKeyOf(ruling.trait), pick: message.id };
    }
    return null;
}

/**
 * What this GM expects of a roll of `actor` for `actionKey` - see the note above. `applied` are
 * the Calls it applied (`appliedCalls`); `context`, `situational` and `byGm` the packet's word.
 * `trait` null where any statistic stands or none is known here; `traitFrom` says which.
 * Exported for the suite.
 */
export async function expectedFor(actor, { actionKey = null, applied = [], context = {}, situational = 0, byGm = false } = {}) {
    const grants = applied.map(call => call?.grants);
    const out = { checked: !isMonokuma(actor), trait: null, traitFrom: null, pick: null, advantage: 0, situationFrom: "roller",
        bonus: 0, experiences: grants.includes("experience") ? 1 : 0, effects: effectRange(actor), stashDie: false };
    let situation = Math.max(-3, Math.min(3, Math.trunc(Number(situational)) || 0));
    if (actionKey === "search") {
        const odds = searchOdds(actor, roomOfActor(actor), context.category ?? null, await import("./vault.mjs"));
        situation = odds.situational;
        out.situationFrom = "gm";
        out.stashDie = Boolean(odds.stashDie);
    }
    if (actionKey === "murderOpening") {
        const { murderState, atNight } = await import("./murder.mjs");
        const state = murderState();
        const side = context.side === "killer" || context.side === "victim" ? context.side : null;
        if (side && state?.stage === "openingRoll" && state[`${side}Id`] === actor.id) {
            const def = MURDER_OPENING[side] ?? {};
            situation = atNight() ? (def.nightAdvantage ? 1 : def.nightDisadvantage ? -1 : 0) : 0;
            out.situationFrom = "gm";
            if (!grants.includes("trait")) Object.assign(out, { trait: traitKeyOf(state.openingTrait), traitFrom: "opening" });
        }
    }
    if (grants.includes("trait")) out.traitFrom = "resolve";
    else if (actionKey === "search" && (ACTIONS.search?.traits ?? []).length === 1) Object.assign(out, { trait: ACTIONS.search.traits[0], traitFrom: "search" });
    else if (actionKey === "project" || actionKey === "sabotage") {
        const id = actionKey === "project" ? context.projectId : context.targetProjectId;
        const { allProjects } = await import("./projects.mjs");
        const project = allProjects().find(p => p.id === id);
        if (project?.trait) Object.assign(out, { trait: traitKeyOf(project.trait), traitFrom: "project" });
    }
    if (!out.trait && !out.traitFrom && byGm && actionKey !== "murderOpening") {
        const kind = pickKindOf(actionKey);
        let found = gmPickOf(actor, kind);
        for (const end = Date.now() + PICK_WAIT_MS; !found && Date.now() < end;) {
            await new Promise(resolve => setTimeout(resolve, 100));
            found = gmPickOf(actor, kind);
        }
        if (found?.trait) Object.assign(out, { trait: found.trait, traitFrom: "gm", pick: found.pick });
    }
    const { ADVANTAGE_CAP } = await import("./roll-dialog.mjs");
    const dice = grants.reduce((sum, g) => sum + (g === "advantage" ? 1 : g === "disadvantage" ? -1 : 0), 0)
        + situation + (isBrokenDown(actor) ? -1 : 0);
    out.advantage = Math.sign(dice) * Math.min(ADVANTAGE_CAP, Math.abs(dice));
    out.bonus = applied.filter(call => call?.grants === "bonus" && Number.isFinite(Number(call.amount)))
        .reduce((sum, call) => sum + Number(call.amount), 0);
    return out;
}

/** What the record keeps of an expectation: plain, and with the pick card that a later roll may not use again. */
function recordOf(expected) {
    const { trait, traitFrom, pick, advantage, situationFrom, bonus, experiences, effects, stashDie, checked } = expected;
    return { checked, trait, traitFrom, pick, advantage, situationFrom, bonus, experiences, effects, stashDie };
}

/** The roll's flat modifier: every term that is a plain number, with the sign of the operator before it. */
function flatOf(roll) {
    let flat = 0;
    const terms = roll.terms ?? [];
    for (let i = 0; i < terms.length; i++) {
        const term = terms[i];
        if (typeof term?.number !== "number" || Array.isArray(term.results) || term.faces !== undefined) continue;
        flat += (terms[i - 1]?.operator === "-" ? -1 : 1) * term.number;
    }
    return flat;
}

/** The roll's advantage dice as a signed count, read as Daggerheart's `dAdvantage` / `dDisadvantage` hold them. */
function advantageOf(roll) {
    const die = roll.dAdvantage ?? roll.dDisadvantage ?? null;
    const count = Number(die?.number) || (die ? 1 : 0);
    return roll.dAdvantage ? count : -count;
}

/**
 * The roll against the expectation: `[{ kind, expected, claimed }]`, empty when nothing differs.
 * Kinds: `trait`, `modifier` (the flat sum), `dice` (a die beyond Hope, Fear and the advantage
 * die), `advantage`, `stash` (a hidden stash the packet did not name).
 */
function checkRoll(roll, actor, told, expected) {
    const flags = [];
    if (expected.stashDie && told.context.stashDie !== true) flags.push({ kind: "stash", expected: "1", claimed: "0" });
    if (!expected.checked) return flags;
    const said = traitKeyOf(told.trait);
    if (expected.trait && said !== expected.trait) flags.push({ kind: "trait", expected: expected.trait, claimed: said ?? "-" });
    const traitValue = Number(actor.system?.traits?.[TRAITS[said]?.dh ?? ""]?.value) || 0;
    const owned = told.experiences.filter(key => actor.system?.experiences?.[key]);
    const fromExperiences = owned.slice(0, expected.experiences)
        .reduce((sum, key) => sum + (Number(actor.system.experiences[key].value) || 0), 0);
    const base = traitValue + fromExperiences + expected.bonus;
    const off = flatOf(roll) - base;
    const [low, high] = expected.effects;
    if (off < low || off > high || owned.length > expected.experiences) {
        flags.push({ kind: "modifier", expected: signed(base), claimed: signed(flatOf(roll)) });
    }
    const extra = (roll.dice?.length ?? 0) - 2 - (roll.dAdvantage || roll.dDisadvantage ? 1 : 0);
    if (extra > 0) flags.push({ kind: "dice", expected: "0", claimed: String(extra) });
    const dice = advantageOf(roll);
    if (dice !== expected.advantage) flags.push({ kind: "advantage", expected: signed(expected.advantage), claimed: signed(dice) });
    return flags;
}

const signed = n => (n > 0 ? `+${n}` : String(n));

/** The line each kind is said as - written out, so each key is a literal the lang check can find. */
const FLAG_KINDS = Object.freeze({
    trait: "DRPG.Rolls.flagKind.trait",
    modifier: "DRPG.Rolls.flagKind.modifier",
    dice: "DRPG.Rolls.flagKind.dice",
    advantage: "DRPG.Rolls.flagKind.advantage",
    stash: "DRPG.Rolls.flagKind.stash"
});

/** One flag as words: what, what the roll had, what the GM expected. A statistic is said by its label. */
export function flagText(flag) {
    const word = value => (flag?.kind === "trait" ? TRAITS[value]?.label ?? value : value);
    return game.i18n.format("DRPG.Rolls.flagLine", {
        what: game.i18n.localize(FLAG_KINDS[flag?.kind] ?? "DRPG.Rolls.flagKind.modifier"),
        claimed: String(word(flag?.claimed) ?? "-"), expected: String(word(flag?.expected) ?? "-")
    });
}

/** One whisper to the GMs for a roll with anything flagged: whose roll, and each difference. */
async function tellUnexpected(actor, flags) {
    try {
        await whisperToGms(`<p class="drpg-warning">${esc(game.i18n.format("DRPG.Rolls.unexpected", {
            name: actor.name, list: flags.map(flagText).join("; ") }))}</p>`);
    } catch (err) {
        error("Could not tell the GMs of a roll's unexpected modifiers", err);
    }
}

/**
 * THE LIST E29 NEEDS (`game.drpg.rollFlags()`): every drawn roll whose record holds a flag, newest
 * first, as this GM holds the records - which are swept past the Reroll's window
 * (`TIMING.rerollWindowMinutes`, `keepRecord`), so it lists the last minutes, not a session. A
 * table of them goes to the console under `DRPG.Rolls.flagsTitle`; a player's browser holds no
 * record and answers an empty list.
 */
export function rollFlags({ quiet = false } = {}) {
    if (!game.user?.isGM) return [];
    const rows = Object.entries(rollStore.entries() ?? {})
        .filter(([, row]) => Array.isArray(row?.flags) && row.flags.length)
        .sort(([, a], [, b]) => (b.at ?? 0) - (a.at ?? 0))
        .map(([rollId, row]) => ({
            rollId, at: new Date(row.at ?? 0).toISOString(), character: game.actors.get(row.actorId)?.name ?? row.actorId,
            player: game.users.get(row.userId)?.name ?? row.userId, action: row.actionKey ?? "-", messageId: row.messageId,
            flags: row.flags.map(flagText).join("; ")
        }));
    if (!quiet) {
        console.log(game.i18n.format("DRPG.Rolls.flagsTitle", { n: rows.length }));
        if (rows.length) console.table(rows);
    }
    return rows;
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
 * hook, asks for it - and its dice are shown as the roller's (`by`) to the GMs and the roll's
 * audience, the roller left out: their dice are played from the answer (private-rolls.mjs
 * `relayDrawnDice`, C13). A statistic from the sheet keeps Daggerheart's card (`keepCard`): no
 * `supersededRoll` flag. `toMessage` then waits for Dice So Nice, which does not animate this
 * message and so answers at once (`keepDiceToReaders`); the draw does not wait for it either
 * (the plan's 3.3): it goes on as soon as the message exists.
 */
async function writeDrawnMessage(cls, roll, config, { actor, nonce, rollId, sender, keepCard = false }) {
    let heard = null;
    const created = new Promise(resolve => { heard = resolve; });
    const writing = supersedingRoll(() => cls.toMessage(roll, config),
        { subject: actor, nonce, stamp: { rollId, drawn: true }, by: sender.id, keepCard, onCreated: heard });
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
