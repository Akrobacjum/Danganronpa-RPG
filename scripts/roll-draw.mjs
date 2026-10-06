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
 * `Roll`, which the GM throws itself since C17, monocub.mjs `meddleOnGm`) are not drawn; a GM's
 * own roll is its own; with no GM an action's roll is not made and any other roll is thrown here,
 * as in 1.2.66, stamped and moving nothing until a GM grants it (C18, "WITH NO GM CONNECTED"
 * below). What the roll adds up to beyond its dice - the
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

import { MODULE_ID, TIMING, ACTIONS, TRAITS, TRAIT_BY_DH, MURDER_OPENING, CRITICAL, CRISIS_ACTIONS, PRICE_CHAINS, CLEANUP, LEGAL_ROLL_MODIFIERS } from "./config.mjs";
import { SETTINGS, getClock } from "./settings.mjs";
import { primaryGmId, isPrimaryGm, announce, whisperToGms, warn, error, esc } from "./utils.mjs";
import { bridgeRequest, ownsActor } from "./bridge-guards.mjs";
import { readDuality, awardRollDespair } from "./despair-award.mjs";
import { answerKeysOpen, rollStore, sheetMarkStore } from "./gm-stores.mjs";
import { ROLL_NONCE, supersedingRoll, rollClaimOf, keepSubject, neutralRollOf, readHere, awaitDrawn } from "./private-rolls.mjs";
import { LOADED_DIE, loadDie, standAsideFor } from "./forced-roll.mjs";
import { DRPG_ACTION_ROLL, DRAWN_ROLL, searchOdds, stashStepFor } from "./action-rolls.mjs";
import { actionsLeft, freeActionsLeft } from "./actions.mjs";
import { armedCallsShown, situationalAdvantage, spendCallsByNonce } from "./call-effects.mjs";
import { isBrokenDown } from "./character.mjs";
import { isMonokuma } from "./monokuma.mjs";
import { roomOfActor } from "./movement.mjs";
import { cardFlag, cardWriter } from "./secret.mjs";

/** Marks the wrapper, so a second registration is a no-op and patches.mjs can recognise it. */
const SEAM = Symbol.for("drpgRollDraw");

/*
 * HOW LONG THE ROLLER WAITS FOR THE GM'S DRAW. The GM's side is an evaluation and one
 * message, with no window and nothing a person decides, so the answer's clock is a
 * bound for a GM who went away mid-draw - the roll is then not made, as a closed roll
 * window is not (the plan's 3.8) - chosen, not measured (LIVE-E28-03). It holds the GM's own
 * waits within a draw too: a pick's (`PICK_WAIT_MS`), and before this GM's stores open its marks'
 * (`marksOpen`, at most `TIMING.gmStoreOpenMs`; E29 fix r2-H3).
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

/**
 * What `registerRollDraw` decides for `cls`, wrapping nothing: "ok" - to be wrapped - or
 * "changed", with the review's reason. Split out in fix r2-H6 (05.10.2026; review m3) so R217
 * reads the decision on a build that is not the reviewed one, not only the review.
 */
export function seamFor(cls) {
    const review = reviewBuild(cls);
    return review.ok ? { state: "ok", why: "" } : { state: "changed", why: review.why };
}

/**
 * THE FALLBACK, STOOD IN FOR BY THE SUITE (fix r2-H6, 05.10.2026; review m3). No table of the
 * suite's runs on a Daggerheart the draw was not written for, so what this client does on one -
 * the primary's word to the GMs (`announceRollDraw`), every packet's numbers standing
 * (bridge-guards.mjs `rollsFor`) - was run by nothing. This client's seam reads as `state` until
 * the function answered is called, which puts the live one back. Nothing is wrapped or unwrapped.
 */
export function standInSeam(state) {
    const live = seam;
    seam = { state, why: "stood in by the suite" };
    return () => { seam = live; };
}

/** At `setup`, beside critical.mjs: wrap the duality roll's build, or leave it and say why. */
export function registerRollDraw() {
    const cls = game.system?.api?.dice?.DualityRoll;
    if (cls?.build?.[SEAM]) return;
    // The payments are watched on any build (fix r2-H2): a Hope Call's progress is held to its
    // price on the GM (`takeCallPayment`) whether or not this GM draws the dice.
    Hooks.once("ready", () => { for (const actor of game.actors ?? []) notePayments(actor); });
    Hooks.on("createActor", actor => notePayments(actor));
    Hooks.on("updateActor", notePayments);
    const decided = seamFor(cls);
    if (decided.state !== "ok") {
        seam = decided;
        warn(`Rolls are not drawn by the GM on this Daggerheart (${game.system?.version ?? "?"}): ${decided.why}.`);
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
 *
 * With no GM connected (C18), before any of that: an action's roll is not made, and any other
 * roll is thrown here, stamped and moving nothing ("WITH NO GM CONNECTED" below).
 */
async function drawOrThrow(cls, original, config, message) {
    if (awayFromGms(config)) {
        if (config[DRPG_ACTION_ROLL] === true) return void ui.notifications?.warn(game.i18n.localize("DRPG.Rolls.waitsForGm"));
        return throwUnwitnessed(cls, original, config, message);
    }
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
 * WHAT THE ROLL TAKES TO THE GM. The roll as Foundry writes it (`toJSON`), unevaluated, with
 * only the options a window may say of the roll the GM writes for itself (`DRAWN_OPTIONS`, E29
 * fix r2-H1, "THE GM'S OWN OPTIONS" below), made plain and then neutral as its message would keep
 * them (private-rolls.mjs `neutralRollOf`): the GM needs nothing of the character - it has the
 * character - and a key past the list is refused (bridge-guards.mjs `guardDrawnRoll`). Its `data`
 * goes empty, not absent: Daggerheart's constructor reads it (`rollFromLegal`'s note). The Loaded
 * Die's mark, which the neutral roll drops, travels beside it, and so do the window's costs.
 * Exported for the suite, which sends the GM a packet of its own roll's shape (tests-tier2.mjs
 * `drawnForPlayer`).
 *
 * And what the roller claims of it (E08+E28 C12b), each the roller's word - since E29 C10 a claim
 * the GM records beside the roll its own list makes, compares and never counts: the statistic
 * and the experiences, which the neutral roll drops; the Calls the roll applied (the claim's
 * `facts`, the roll window's list, private-rolls.mjs `noteWindowCalls`); the action's context a
 * check reads (a Search's category, goal and stash, a project's id, an opening's side, the crisis
 * action a crisis roll is thrown for - fix r2-H1 - and since E29 C9 a clean-up's step and whether it
 * came through Tamper's door, which decide its statistic and its tool's die - `CONTEXT_SENT`; the goal
 * since E29 fix r1-G8);
 * and the situation's dice as this browser armed them (call-effects.mjs `situationalAdvantage`),
 * which the GM no longer reads: it reads every action's situation for itself (E29 C9,
 * `LEGAL_READERS`). The field still travels; nothing on the GM reads it.
 */
export const DRAWN_OPTIONS = Object.freeze([ROLL_NONCE, "actionType", "roll", "experiences", "guaranteedCritical", "extraFormula", "data"]);
const CONTEXT_SENT = Object.freeze({ category: "text", goal: "text", stashDie: "bool", projectId: "id", targetProjectId: "id", side: "text",
    crisis: "text", cleanupKey: "text", cleanupVia: "bool" });
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

/** The project a Work's or a Sabotage's roll is thrown for, as its sent context names it; null for any other roll, or none named. */
function projectNamed(actionKey, context) {
    const id = actionKey === "project" ? context?.projectId : actionKey === "sabotage" ? context?.targetProjectId : null;
    return typeof id === "string" ? id : null;
}

/** At most `LISTED_MAX` strings of a list, or none. */
const strings = list => (Array.isArray(list) ? list : []).filter(item => typeof item === "string" && item.length <= 128).slice(0, LISTED_MAX);

export function drawPacketOf(roll, config, claim) {
    const json = roll.toJSON();
    const options = {};
    for (const key of DRAWN_OPTIONS) {
        const value = json.options?.[key];
        if (key === "data" || value === undefined || typeof value === "function" || value?.documentName) continue;
        try { options[key] = JSON.parse(JSON.stringify(value)); } catch { /* not JSON, so not on a message either */ }
    }
    options.data = {};
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
 * The GM's roll, played back here. The Loaded Die is the GM's
 * to load on its own throw (forced-roll.mjs `onConfigured` stands aside for a drawn roll,
 * C12b), and this copy only repeats what fell. A total
 * this copy reads differently is the GM's (the record stands) and is logged. What the
 * GM decided beside the dice rides on the config with the record's id (`DRAWN_ROLL`):
 * the hidden stash's step it drew (`stash`, action-rolls.mjs `stashStepOf`) and whether
 * it loaded the die (`loaded`).
 */
async function playBack(cls, roll, config, message, answer, subject) {
    const { rollId, messageId, total, stash = null, loaded = false } = answer;
    config[DRAWN_ROLL] = { rollId, messageId, stash: stash && typeof stash === "object" ? stash : null, loaded: loaded === true };
    const played = await rollerCopyOf(cls, roll, config, message, answer);
    if (typeof total === "number" && played.total !== total) {
        warn(`The GM drew ${total} for roll ${rollId}; this browser read ${played.total} from the same faces. The GM's stands.`);
        if (config.roll && typeof config.roll === "object") config.roll.total = total;
    }
    const { messageArrives } = await import("./secret.mjs");
    config.message = game.messages.get(messageId) ?? await messageArrives(messageId);
    // Whose roll it is, kept here as for a roll this browser threw, so `reportRollSubject`
    // asks nothing: the GM kept it as it wrote the message. And the message is this browser's
    // to read from here on (C13), as it was while the GM drew it (`awaitDrawn`) - after a
    // reload too (`keep`, fix r2-H7).
    if (subject?.id) keepSubject(messageId, subject.id, game.user?.id ?? null);
    readHere(messageId, { keep: true });
    await playDice(played);
}

/*
 * THE ROLLER'S COPY IS THE GM'S ROLL (E29 C10, 05.10.2026; the stage plan's 3.6). Until C10 this
 * browser evaluated the roll its own window configured, on the GM's faces: the dice matched the
 * GM's, and everything beside them - the statistic, the modifiers, the advantage dice - was this
 * window's, so where the GM did not count a modifier (`legalRollOf`) the roller's `config.roll`
 * read the claim's numbers and only its total was put right. The answer carries the roll the GM
 * built, unevaluated (`roll`); this browser rebuilds it (`rollFromLegal`) and plays the GM's faces
 * into it, each face f drawn as `u = 1 - (f - 0.5) / faces` - the middle of the band Foundry's
 * `ceil((1 - u) * faces)` maps to f - in the order the GM's dice drew them, then the randomiser
 * again for anything the GM did not draw. So `config.roll` and every reading here are the GM's
 * numbers, and Dice So Nice throws the advantage dice the GM decided. An answer without the
 * roll (none is sent today) plays into the configured roll, as before C10. Exported for the
 * suite, which plays a draw's answer back on the GM's browser.
 */
export async function rollerCopyOf(cls, configured, config, message, { faces = [], roll: legal = null } = {}) {
    const roll = legal && typeof legal === "object" ? rollFromLegal(cls, foundry.utils.deepClone(legal), configured?.data) : configured;
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
    return roll;
}

/**
 * A roll rebuilt from the JSON the GM wrote (`legalRollOf`), on either side. Daggerheart's
 * constructor, which `fromData` runs first, writes `options.roll.modifiers` again from the roll's
 * data and its window's choices (d20Roll.mjs `configureModifiers`, :96-124, read in 2.10.5), and
 * the roll's data there is the empty `data` its options carry (dhRoll.mjs:11 takes `options.data`
 * where the roll's own is empty, as `fromData`'s is): the GM's statistic, modifiers, advantage and
 * experiences are put back on the instance after it. Not measured at a table (LIVE-E28-12 reads
 * `fromData` there). `json` is consumed - Daggerheart's `fromData` names the dice's classes in it.
 *
 * AND DAGGERHEART CAN BUILD IT (E29 fix r2-H1, 05.10.2026; review round 2's cor B1). That
 * constructor reads `options.data.system` (d20Roll.mjs:103), `this.data.traits` where the roll
 * names a statistic (dualityRoll.mjs:174) and `options.source.item` (:185), none of them with `?.`
 * (2.6.5 and 2.10.5 alike). The packet left `data` out from E08+E28 C12a, and the GM's roll was
 * built from the packet's: run on Daggerheart 2.10.5's own roll classes, Foundry's `fromData` stood
 * in for as the harness models it (e29-review/cor-r2-fromdata/probe.mjs), C10's roll threw a
 * TypeError at dualityRoll.mjs:174 and 1.2.67's packet one at d20Roll.mjs:103; with `data` empty
 * it built. The same probe on the JSON a headless draw of a statistic from the sheet handed
 * `fromData` (e29run/scratch/r2h1-probe): at 070b72b the GM's and the roller's each threw at
 * dualityRoll.mjs:174; with this fix each built. The suite stayed green because the harness's
 * constructor read none of it (client-entry.mjs `DualityRollMock` reads all three since this fix).
 * The GM writes both into its own options (`drawnOptions`); they are put here too for a JSON
 * written before the fix. Built so, the constructor's formula (`_formula`) is the dice alone,
 * `1d12 + 1d12` in that probe - it is written before `fromData` puts the JSON's terms in, and the
 * terms carry the numbers; what Foundry's `formula` reads back at a table is not measured here.
 */
function rollFromLegal(cls, json, data = null) {
    const options = json.options && typeof json.options === "object" ? json.options : (json.options = {});
    options.data ??= {};
    options.source ??= {};
    const said = foundry.utils.deepClone(options.roll ?? {});
    const experiences = Array.isArray(options.experiences) ? [...options.experiences] : [];
    const roll = cls.fromData(json);
    roll.options.roll = roll.options.roll && typeof roll.options.roll === "object" ? roll.options.roll : {};
    for (const key of ["trait", "modifiers", "advantage"]) {
        if (said[key] === undefined) delete roll.options.roll[key];
        else roll.options.roll[key] = said[key];
    }
    roll.options.experiences = experiences;
    if (data) roll.data = data;
    return roll;
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
    /*
     * FROM THE GMS' VALUE, AND WAITED FOR (E29 fix r1-G5, 05.10.2026; review round 1 sec M1).
     * Daggerheart's `modifyResource` adds each change to the value the document holds and returns
     * before its write lands (actor.mjs:930-1005, 2.10.5). On a student it runs as a GM's write of
     * the student's means (sheet-audit.mjs `gmMeansWrite`): a change of a resource the GMs hold is
     * moved by the difference between their value and the document's (`fromHeld`), so Daggerheart
     * writes the GMs' value moved by the roll, not a forged Hope the judge has not put back yet; and
     * the student's queue waits until that write has been heard, or `GRANT_WAIT_MS` where none
     * comes. Where Daggerheart's own arithmetic says the write changes nothing (`dhWrites`) nothing
     * is waited for: Foundry sends no such update (sheet.mjs's note, measured on 14.365). A Reroll's
     * resource step is written the same way since fix r2-H5 (reroll.mjs `modifyRollActor`).
     */
    async updateResources() {
        if (!this.size || !this.#actor) return;
        await modifyFromHeld(this.#actor.system?.partner ?? this.#actor, [...this.values()]);
    }
}

/** Daggerheart's `modifyResource` of `resources` on `target`, as a GM's write of its means from the GMs' value (`updateResources`' note). */
export async function modifyFromHeld(target, resources) {
    const { gmMeansWrite } = await import("./sheet-audit.mjs");
    await gmMeansWrite(target, async held => {
        const changes = resources.map(change => fromHeld(target, change, held));
        const before = Object.fromEntries(Object.entries(target.system?.resources ?? {})
            .map(([key, resource]) => [key, { value: resource?.value, max: resource?.max, isReversed: resource?.isReversed }]));
        let heard = null;
        const landed = new Promise(resolve => { heard = resolve; });
        const hook = Hooks.on("updateActor", (doc, data, options, userId) => { if (doc?.id === target.id && userId === game.user?.id) heard(); });
        try {
            await target.modifyResource(changes);
            if (dhWrites(before, changes)) await Promise.race([landed, new Promise(resolve => setTimeout(resolve, GRANT_WAIT_MS))]);
        } finally {
            Hooks.off("updateActor", hook);
        }
    });
}

/** A roll's change of a resource the GMs hold, moved so that Daggerheart's sum starts from their value (`updateResources`). */
function fromHeld(target, change, held) {
    const now = target.system?.resources?.[change.key]?.value;
    if (change.clear || change.itemId || !Number.isFinite(held[change.key]) || !Number.isFinite(now) || held[change.key] === now) return change;
    return { ...change, value: (change.value ?? 0) + held[change.key] - now };
}

/**
 * Whether Daggerheart's `modifyResource` writes the actor (actor.mjs:933-976, 2.10.5, read 05.10.2026):
 * a change of one of its resources but Fear and armour - a Stress past its maximum already turned into
 * a Hit Point - moved or emptied, held to 0..max, to a value the actor does not hold already.
 */
function dhWrites(before, changes) {
    return changes.some(change => {
        const now = before[change.key];
        if (change.itemId || change.key === "fear" || change.key === "armor" || !now) return false;
        const moved = change.clear ? (now.max && !now.isReversed ? now.max : 0) : (now.value ?? 0) + (change.value ?? 0);
        return Math.max(Math.min(moved, now.max), 0) !== now.value;
    });
}

/*
 * WHAT A ROLL'S WINDOW SAYS IT COSTS. A cost is taken off the roller's own character
 * (`commitResources`, action-rolls.mjs, took it there until C12a), and the one cost
 * Daggerheart's window adds to a trait roll is a Hope for each experience it selects
 * (d20RollDialog.mjs `selectExperience`, read in 2.10.5) - which the module's window takes off
 * again on every render (roll-dialog.mjs `stripExperienceCosts`), so a roll it configured sends
 * none. Until fix r2-H1 (04.10.2026; review M2) this kept any key of up to 32 characters,
 * negated: the review's packet of eight Fear costs of 12 moved the GM's Fear 10 -> -86
 * (Daggerheart's `modifyResource` sends `fear` to the Fear tracker), and by the review's
 * reading, not run here, a `stress` cost would have cleared a Sanity mark. A packet asking
 * anything but those Hopes is refused before the draw (bridge-guards.mjs `guardDrawnCosts`);
 * this keeps the Hopes again, one each.
 */
const COSTS_KEPT = 8;
function paidCosts(costs) {
    return (Array.isArray(costs) ? costs : [])
        .filter(c => c?.key === "hope" && c.value === 1 && c.enabled === true)
        .slice(0, COSTS_KEPT)
        .map(() => ({ key: "hope", value: 1, enabled: true }));
}

/* ==========================================================================
 * A DRAW IS AN ACTION'S, MADE ONCE (E08+E28 fix r2-H1, 04.10.2026; review S2-1)
 * --------------------------------------------------------------------------
 * A record's `actionKey` is the roller's word at the draw, and until this fix a draw asked
 * nothing more of it: a console drew rolls of an action it never took or paid, as many as it
 * liked, and settled with whichever unsettled row of that action it chose - the round-2
 * review's probe drew three Work rolls of Aiko's (21, 3, 4) with her actions 3 -> 3, and had
 * the OLDEST, the 21, taken for progress. Now a player's draw belongs to an action being taken,
 * and a settlement to the newest roll of it (`keepRecord` below, bridge-guards.mjs
 * `rollRefusal`):
 *   - an action the roller pays for - the grid's, a Dynamic, a Tamper or a clean-up - is paid
 *     on their browser before its roll (actions.mjs `spendAction`, price.mjs `payPrice`), and
 *     this GM sees the payment land, written by the player: the character's actions or a Burst
 *     going down, or the later step of the action's price chain, a Hope or a Sanity mark, where
 *     PRICE_CHAINS offers it now (`paysFor`). Each payment is one ticket, which one draw takes; a
 *     Palm's two rolls ride on one (`ROLLED_TOGETHER`). A rise the player writes - the refund of
 *     a window closed before its roll - takes back as many tickets nobody drew on, newest first,
 *     and none outlives the Reroll's window. A GM's write is neither: Sanity marks dealt in an
 *     incident, a Reroll's Hope or an Objection charged on the primary pay for no roll;
 *   - a crisis action's roll is its character's turn's (`crisisRefusal`, at the draw as at its
 *     packet), for the crisis action it names - the record keeps it, and the packet that settles
 *     it has to name the same (gm-bridge.mjs `murder.crisis`) - and one stands unsettled a turn;
 *     an opening's is the opening roller's, once an incident; a free clean-up attempt (a
 *     critical Finishing blow's) is the grant's, one unsettled at a time;
 *   - a roll that names no action - a concealment, a statistic from the sheet - settles
 *     nothing, and is drawn as before;
 *   - two draws of one character's action at once are one too many (`drawing`).
 * WHAT THIS DOES NOT CLOSE. A payment is the roller's own write to their own character, which
 * Foundry lets an owner make - and so is the rise that gives it back: a console that pays, draws
 * and then hands itself the action back has paid, as far as this GM can see (CLAUDE.md, layer
 * two). A Move or a Rest lowers the actions too, and is a ticket nobody honest draws on. The
 * tickets are each GM's own memory, and a draw takes one on the GM that draws it: a payment made
 * before a GM loaded is not seen there, and its roll is refused as a closed window is - the
 * action hands the payment back (action-rolls.mjs `abort`) unless a roll of it has landed
 * already (`spentAfterRoll`), and the next try pays again.
 * ========================================================================== */

/** How long a draw waits for its payment to reach this GM. The roller's browser pays before the roll's window opens, so this is a margin. Chosen, not measured. */
const PAY_WAIT_MS = 1500;
/** The rolls one payment buys together: a Palm's unseen roll and its hand (action-rolls.mjs `performPalm`). */
const ROLLED_TOGETHER = Object.freeze([Object.freeze(["palm", "steal"])]);
/** The price chain an action's roll is paid by, where it has one (PRICE_CHAINS; cleanup.mjs `chargeTamper`). */
const CHAIN_OF = Object.freeze({ analyze: "analyze", cleanup: "tamper" });
/** Each character's tickets on this GM: `{ at, pay, kinds, size }`, `kinds` the rolls drawn on it (or `call`, a Hope Call's progress: `takeCallPayment`), `size` how much it paid. */
const payments = new Map();
/**
 * The option a GM's write of a character's budget carries to count as that character's player's
 * payment: the suite's (tests-tier2.mjs `payAction`), which runs on a GM's browser and pays there.
 * A GM may write anything to a character, so it opens nothing a GM could not do already.
 */
export const PAID_AS_PLAYER = "drpgPaidAsPlayer";
/** Each character's actions, Bursts, Hope and Sanity marks as this GM last saw them. */
const budgets = new Map();
/** The draws under way on this GM, `actorId:actionKey`. */
const drawing = new Set();

/** What a payment is read from on a character. */
function budgetOf(actor) {
    const r = actor?.system?.resources ?? {};
    return { action: actionsLeft(actor), grant: freeActionsLeft(actor), hope: Number(r.hope?.value) || 0, stress: Number(r.stress?.value) || 0 };
}

/** A character's tickets, those past the Reroll's window dropped. */
function ticketsOf(actorId) {
    const since = Date.now() - TIMING.rerollWindowMinutes * 60_000;
    const kept = (payments.get(actorId) ?? []).filter(ticket => ticket.at >= since);
    payments.set(actorId, kept);
    return kept;
}

/**
 * On `updateActor` (and `createActor`, and at `ready` for every character), on every GM: what a
 * player's own write took down is a payment, what it put back takes back as many undrawn tickets
 * of its kind. Any other write - a GM's, or one before this GM had a reading - only moves the
 * reading the next is measured from.
 */
function notePayments(actor, changes = null, options = null, userId = null) {
    if (!game.user?.isGM || actor?.type !== "character") return;
    const now = budgetOf(actor), was = budgets.get(actor.id);
    budgets.set(actor.id, now);
    const writer = game.users?.get(userId ?? "");
    if (!was || !writer || (writer.isGM && options?.[PAID_AS_PLAYER] !== true)) return;
    const tickets = ticketsOf(actor.id);
    const paid = (pay, size = 1) => tickets.push({ at: Date.now(), pay, kinds: [], size });
    const undo = (pay, n) => {
        for (let i = tickets.length - 1; i >= 0 && n > 0; i--) {
            if (tickets[i].pay === pay && !tickets[i].kinds.length) { tickets.splice(i, 1); n--; }
        }
    };
    const rise = Math.max(0, now.action - was.action) + Math.max(0, now.grant - was.grant);
    if (rise) undo("action", rise);
    else if (now.action < was.action || now.grant < was.grant) paid("action");
    if (now.hope < was.hope) paid("hope", was.hope - now.hope);
    else if (now.hope > was.hope) undo("hope", now.hope - was.hope);
    if (now.stress > was.stress) paid("stress");
    else if (now.stress < was.stress) undo("stress", was.stress - now.stress);
}

/** What can pay for a roll of `key` now: an action, or a later step of its price chain where the chain offers it in this phase. */
function paysFor(key) {
    const chain = PRICE_CHAINS[CHAIN_OF[key]];
    if (!chain) return ["action"];
    const steps = chain.stepsBeyondFirst && getClock()?.phase !== chain.stepsBeyondFirst ? chain.steps.slice(0, 1) : chain.steps;
    return steps.map(step => step.pay);
}

/** The ticket a draw of `key` would take: one its partner was drawn on, else the oldest undrawn one it can be paid by; or null. */
function ticketFor(actorId, key) {
    const tickets = ticketsOf(actorId);
    const partners = ROLLED_TOGETHER.find(set => set.includes(key)) ?? [];
    const riding = [...tickets].reverse().find(t => t.kinds.length && !t.kinds.includes(key) && t.kinds.every(k => partners.includes(k)));
    if (riding) return riding;
    const pays = paysFor(key);
    return tickets.find(t => !t.kinds.length && pays.includes(t.pay)) ?? null;
}

/** This character's records of `key`. */
const rowsOf = (actorId, key) => Object.values(rollStore.entries() ?? {}).filter(row => row?.actorId === actorId && row.actionKey === key);
/** A record that has settled nothing, and that no later roll of its action replaced. */
const unsettled = row => !row?.superseded && !(Array.isArray(row?.resolved) && row.resolved.length);
/** The incident's turn, as a draw made in it is stamped (the record's `incident`). */
const turnOf = state => ({ openedAt: state?.openedAt ?? null, turn: state?.turn ?? null, turnSide: state?.turnSide ?? null,
    killerTurnId: state?.killerTurnId ?? null });
const sameTurn = (a, b) => ["openedAt", "turn", "turnSide", "killerTurnId"].every(field => (a?.[field] ?? null) === (b?.[field] ?? null));

/**
 * Why this GM draws no roll of `actor`'s for the action `key` now, or null - see the note above.
 * Asked of a player's draw; the ticket a roll is let through on is taken here, in the same tick
 * as the last look at it.
 */
async function drawRefusal(actor, key, context) {
    if (!key) return null;
    await rollStore.whenHydrated();
    const { murderState, crisisRefusal } = await import("./murder.mjs");
    const state = murderState();
    if (key === "crisis") {
        const crisis = typeof context.crisis === "string" && Object.hasOwn(CRISIS_ACTIONS, context.crisis) ? context.crisis : null;
        if (!crisis || CRISIS_ACTIONS[crisis].noRoll) return "no crisis action that throws a roll is named";
        const why = crisisRefusal(actor, crisis, state)?.why;
        if (why) return why;
        return rowsOf(actor.id, key).some(row => unsettled(row) && sameTurn(row.incident, turnOf(state)))
            ? "that character's roll of that action has been thrown already" : null;
    }
    if (key === "murderOpening") {
        const side = state?.active && state.stage === "openingRoll" ? (state.indirect ? "victim" : "killer") : null;
        if (!side || context.side !== side || state[`${side}Id`] !== actor.id) return "that character has no opening roll to throw now";
        return rowsOf(actor.id, key).some(row => row.incident?.openedAt === state.openedAt)
            ? "that character's roll of that action has been thrown already" : null;
    }
    if (key === "cleanup" && state?.active && state.freeCleanup === actor.id
        && !rowsOf(actor.id, key).some(row => unsettled(row) && row.incident?.openedAt === state.openedAt)) return null;
    for (const end = Date.now() + PAY_WAIT_MS; !ticketFor(actor.id, key) && Date.now() < end;) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    const ticket = ticketFor(actor.id, key);
    if (!ticket) return "no payment of that character's stands for that roll";
    ticket.kinds.push(key);
    return null;
}

/** For the suite: the tickets this GM holds for a character (a copy), and forgetting them. */
export function paymentsOf(actorId) {
    return ticketsOf(actorId).map(ticket => ({ ...ticket, kinds: [...ticket.kinds] }));
}
export function forgetPayments(actorId) {
    payments.delete(actorId);
}

/*
 * A HOPE CALL'S PROGRESS IS PAID FOR, ONCE (E08+E28 fix r2-H2, 05.10.2026; review S2-5). Progress
 * that names no roll is a Call's (call-effects.mjs `progressEffect`), and the GM held it to the
 * largest Call's 2 and to nothing else: the round-2 review's probe sent three such packets for
 * Aiko on a project in a room she was not in, and its bar went 0 -> 6. A Hope Call is paid on its
 * buyer's browser before its effect is asked for (calls.mjs `spendHopeCall`): one write of the
 * character's Hope, down by the Call's cost, which this GM sees land as it sees an action's
 * (`notePayments`) - a ticket of `hope`, with the size of the drop. A Call's progress takes one
 * such ticket no roll was drawn on, of at least the Call's cost, waiting as a draw waits for its
 * payment (bridge-guards.mjs `guardCallProgress`, asked after every other guard of the packet, so
 * a Call refused for its room or a frozen project takes none, and the refund of its price takes
 * the ticket back). What `notePayments` cannot tell apart this cannot either: the drop is the
 * roller's own write, and a drop as large paid for something else stands for a Call as well.
 */
export async function takeCallPayment(actorId, cost) {
    const find = () => ticketsOf(actorId).find(ticket => ticket.pay === "hope" && !ticket.kinds.length && ticket.size >= cost);
    for (const end = Date.now() + PAY_WAIT_MS; !find() && Date.now() < end;) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    const ticket = find();
    if (!ticket) return false;
    ticket.kinds.push("call");
    return true;
}

/*
 * NO ROLL BEFORE THE GMS' MARKS (E29 fix r2-H3, 06.10.2026; the round-2 security review's m3, by
 * reading). The Calls a drawn roll applies are the ones the GMs' mark of the character holds armed
 * (sheet-audit.mjs `armedCallsHeld`, C8), and before this GM's stores have their copies there is no
 * mark to ask: the character's own flag was read alone, so an entry a player's browser wrote there
 * counted - for up to `gmStoreSyncMs` after a primary loads beside another GM, by the review's
 * reading. The harness runs one GM, whose stores open alone at once, so that window is not measured
 * here. Now a draw waits for the marks as an Analyze waits for its answer keys (gm-stores.mjs
 * `answerKeysOpen`): until they open, this GM's open fails, or `TIMING.gmStoreOpenMs` passes - not
 * `gmStoreSyncMs`, whose clock starts at the hello (config.mjs) - and is refused, told, if they have
 * not opened - before its payment's ticket is taken (`drawRefusal`). A character the opened stores
 * hold no mark of - made a moment ago, or cut by a reset and not filled yet - is read off its
 * document, as the audit then takes its document for the mark (`unmarkedWrite`, E29 fix r1-G6).
 */
/** Whether this GM's marks are open, waited for within the bound. */
const marksOpen = async () => (await answerKeysOpen({ store: sheetMarkStore })) === "open";

/**
 * The run of `roll.draw` on the primary GM (private-rolls.mjs `drawRollOnGm`). The guards
 * have tied the character to the sender, the roll to a duality roll nobody threw and its
 * costs to its experiences' Hope. The GMs' marks are waited for (`marksOpen`, fix r2-H3). A
 * player's roll is then held to the action it is for (`drawRefusal`, fix r2-H1) - refused,
 * `{ refused }`, before anything is thrown - and only then thrown (`throwDrawn`).
 */
export async function drawOnGm(packet, sender) {
    const actor = game.actors.get(packet?.actorId ?? "");
    const key = typeof packet?.actionKey === "string" && /^[a-zA-Z]{1,32}$/.test(packet.actionKey) ? packet.actionKey : null;
    const lock = actor && key ? `${actor.id}:${key}` : null;
    if (lock && drawing.has(lock)) return { refused: "a roll of that action is being thrown already" };
    if (lock) drawing.add(lock);
    try {
        if (!await marksOpen()) return { refused: "the GMs' marks of the characters are not open on this GM's browser" };
        const why = actor && !sender?.isGM ? await drawRefusal(actor, key, contextSent(packet.context)) : null;
        if (why) return { refused: why };
        const { murderState } = await import("./murder.mjs");
        const state = murderState();
        return await throwDrawn(packet, sender, state?.active ? turnOf(state) : null);
    } finally {
        if (lock) drawing.delete(lock);
    }
}

/*
 * THE ROLL IS THROWN ON THE GM'S TERMS (E08+E28 fix r2-H8, 05.10.2026; found reading E29's design).
 * Until this fix the GM threw the roll `fromData` rebuilt from the packet, and so took from the
 * packet what makes a roll what it is: its dice's faces, numbers and keep modifiers (`checkRoll`
 * counts dice, not faces); Daggerheart's `guaranteedCritical`, a critical whatever the dice
 * (dualityRoll.mjs:13, :89-101, read in 2.10.5); and the roll's kind and steps - a `reaction`, or
 * `skips.resources`, `updateCountdowns` and `triggers`, give the GM no Fear on a roll with Fear
 * and tick no countdown (:256-321). Measured at 33bc497's runtime (tier 2, "a drawn roll is
 * thrown on the GM's dice ..." and "... is the kind its action makes it ..."): a Hope and a Fear
 * die of one face, the Hope die two of them kept high, drew 1 and 1 - a critical every time; a 3
 * and a 9 with a critical guaranteed were recorded a critical, with no Fear; three advantage dice
 * of twenty faces were thrown as such; a Search's roll sent as a reaction, or with its resource
 * step skipped, left the GM's Fear at 0 on a Fear result, and a statistic from the sheet sent as
 * an action gave it 1. So the GM writes those parts of the roll itself, before `fromData`, as
 * Daggerheart builds them where its window runs:
 *   - the Hope and the Fear die, one each, at the faces the character's rules give
 *     (`rules.dualityRoll`, character.mjs; dualityRoll.mjs `createBaseDice`), 12 by default;
 *   - the advantage or disadvantage die where the roll has one, fifth, where `fromData` looks for
 *     it (:122-129): its count is the window's - a modifier, held against what the GM expects
 *     (`checkRoll`) - up to `ADVANTAGE_CAP`; its faces the rules', read as the window reads them
 *     (roll-dialog.mjs `forceAdvantage`), 6 by default; the highest kept of several and its sign
 *     the die's (`applyAdvantage`, :143-168); and `roll.advantage` said as the die is;
 *   - a critical guaranteed only by the character's own effects, read as Daggerheart's
 *     `buildConfigure` reads them (:194-198) - a death move's Blaze of Glory is one;
 *   - the kind: the roll of an action, or one of the module's, is an action; a student's
 *     statistic from the sheet is the reaction the roll window makes it (roll-dialog.mjs
 *     `forceReaction`, despair-award.mjs) - also when the window was skipped, which until now
 *     threw it as an action; a Monokuma's statistic, whichever of the two its window said. And
 *     every one of Daggerheart's steps runs: no `skips`.
 * Where the dice are not what the packet sent, the formula is written again from them:
 * Daggerheart's constructor builds the roll's own formula - which its message keeps and a
 * Reroll is built from - out of the formula's dice and the options, not out of the terms
 * `fromData` then puts in (d20Roll.mjs:6-9, :81-86, read). Any other die is a modifier, thrown on
 * the GM's randomness at the packet's size and flagged (`dice`); what a drawn roll may be built
 * of at all is the guard's (bridge-guards.mjs `guardDrawnRoll`). Foundry's own `fromData` is not
 * on this machine: the harness models it (lib/shim.mjs), and Daggerheart's constructor is
 * modelled as far as `guaranteedCritical` and, since fix r2-H1, the options it reads before any
 * modifier is written (client-entry.mjs `DualityRollMock`; `rollFromLegal`'s note).
 */

/** Daggerheart's advantage dice, by the class `fromData` gives the fifth term, and the sign each is thrown with. */
const ADVANTAGE_DICE = Object.freeze({ AdvantageDie: 1, DisadvantageDie: -1 });
/** The letter Daggerheart's constructor of each of its dice adds to the die's modifiers (die/hopeDie.mjs and its siblings). */
const DIE_LETTER = Object.freeze({ HopeDie: "h", FearDie: "f", AdvantageDie: "a", DisadvantageDie: "d" });

/** A whole number of faces above zero from a rule's value (`12`, `"d20"`), else `fallback`. */
function facesFrom(value, fallback) {
    const faces = Number.parseInt(String(value ?? "").replace(/^d/, ""), 10);
    return Number.isInteger(faces) && faces > 0 ? faces : fallback;
}

/** The first five terms as a throw reads them: each die's number, faces and modifiers but its class's own letter; each sign. */
function diceShape(terms) {
    return JSON.stringify(terms.slice(0, 5).map(term => ("faces" in (term ?? {})
        ? [term.number, term.faces, (term.modifiers ?? []).filter(m => m !== DIE_LETTER[term.class])]
        : term?.operator ?? term?.number ?? null)));
}

/** A formula written from terms the way Foundry writes one (`Roll.getFormula`): a sign spaced, a die `XdY` and its modifiers. */
function formulaOf(terms) {
    return terms.map(term => (term?.operator ? ` ${term.operator} `
        : "faces" in (term ?? {}) ? `${term.number}d${term.faces}${(term.modifiers ?? []).join("")}` : String(term?.number ?? ""))).join("");
}

/**
 * The roll's JSON, its dice, its critical and its kind written by this GM - see the note above. The
 * faces and the kind are the list's (config.mjs `LEGAL_ROLL_MODIFIERS`, E29 C9): `hopeDie`,
 * `fearDie`, `advantageDie` and `kind`, read by their readers below. Since E29 C10 a student's roll
 * is built whole from the list (`legalRollOf`), and this writes only the roll of a character
 * nothing is expected of - a Monokuma's - whose numbers and advantage dice stay its window's. Its
 * options are the GM's own since fix r2-H1 (`drawnOptions`), its modifiers the numbers it throws.
 */
async function onGmTerms(json, actor, { key = null, claimed = true, nonce = null } = {}) {
    const { ADVANTAGE_CAP } = await import("./roll-dialog.mjs");
    const die = (cls, faces, number = 1, modifiers = []) => ({ class: cls, options: {}, evaluated: false, number, faces, modifiers, results: [] });
    const sign = op => ({ class: "OperatorTerm", options: {}, evaluated: false, operator: op });
    const terms = Array.isArray(json.terms) ? json.terms : (json.terms = []);
    const draw = { key, claimed, actionType: json.options?.actionType };
    const sent = diceShape(terms);
    terms[0] = die("HopeDie", await legal("hopeDie", actor, draw));
    terms[1] = sign("+");
    terms[2] = die("FearDie", await legal("fearDie", actor, draw));
    const advantage = ADVANTAGE_DICE[terms[4]?.class] ?? 0;
    if (advantage) {
        const number = Math.min(ADVANTAGE_CAP, Math.max(1, Math.trunc(Number(terms[4].number)) || 1));
        const faces = (await legal("advantageDie", actor, draw))[advantage > 0 ? "advantage" : "disadvantage"];
        terms[3] = sign(advantage > 0 ? "+" : "-");
        terms[4] = die(terms[4].class, faces, number, number > 1 ? ["kh"] : []);
    }
    const formula = diceShape(terms) !== sent ? formulaOf(terms) : json.formula;
    const { actionType, critical } = await legal("kind", actor, draw);
    const modifiers = terms.flatMap((term, i) => (typeof term?.number === "number" && !("faces" in term)
        ? [{ label: "", value: (terms[i - 1]?.operator === "-" ? -1 : 1) * term.number }] : []));
    return { class: json.class, formula, terms, evaluated: false, options: drawnOptions(nonce, { actionType, critical, advantage, modifiers }) };
}

/*
 * THE GM THROWS ITS OWN LIST (E29 C10, 05.10.2026; audit S17-12; decision D2, option 2: "a
 * modifier outside the GM's record is enforced from E29"; the stage plan's 3.4 and 3.5). Until
 * C10 the GM threw the packet's roll on its own dice and kind (`onGmTerms`): what the roll added up
 * to beyond them - the statistic's value, the experiences, the bonuses, how many advantage dice -
 * was the roller's window's, held against the list and flagged where it differed, and counted all
 * the same. Measured at C9's runtime (tier 2, then "a roll with a bonus the GM did not expect is
 * flagged to the GMs and scored as drawn", green in e29run/c9): a Search's packet with 3 added to
 * its formula was recorded, answered and written with the 3. Now the GM writes the whole roll from
 * what it read (`expectedFor`), as Daggerheart's window would have built it:
 *   - the Hope and the Fear die at the list's faces, and fifth the advantage or disadvantage dice of
 *     the GM's own sum (`advantage`, capped as roll-dialog.mjs `advantageSources` caps it), the
 *     highest kept of several, at the list's faces - `applyAdvantage`'s shape (dualityRoll.mjs:143-168);
 *   - one number per flat source, each labelled in `options.roll.modifiers` as Daggerheart labels
 *     its own (dualityRoll.mjs `applyBaseBonus`, d20Roll.mjs `configureModifiers`): the statistic's
 *     value off the character as this GM holds it - the statistic the list names (where a pick was
 *     due and none came, the lowest the action lists, since fix r2-H2), else the one the roller
 *     chose (a statistic from the sheet, after a Resolve); the experiences an Experience Call
 *     bought, at their value here; the Calls' bonus; a hindering Call's; and the part of the claim
 *     the list cannot read - the effects a window toggles - clamped into the range the character's
 *     effects allow (`effectRange`);
 *   - `options.roll.trait`, `.advantage` and `options.experiences` to match, its kind and critical as
 *     `onGmTerms` writes them, no `skips`, no `extraFormula`, no `baseModifiers` - and, since fix
 *     r2-H1, nothing else of the packet's options ("THE GM'S OWN OPTIONS" below).
 * The packet keeps only what the GM cannot know and the list lets it say: the statistic of a roll
 * whose action names none, the experiences named (counted as far as a Call bought one) and the
 * effects' part, clamped. Its numbers are the claim (`claimOf`), recorded beside what was thrown
 * (`scored`) and held against it (`checkRoll`): a difference changes nothing of the roll, is flagged
 * to the GMs and, where the claim had something the GM did not count, told to the roller in one line
 * (`rollerLine`, the owner's Q1 (a) of 05.10.2026). The switch rests on the harness's explanation of
 * each flag kind it raises (E29 C9's note), not on a table's reading of `game.drpg.rollFlags()` (the
 * owner's Q5 (b); LIVE-E29-03). The formula is written again where the dice or the numbers differ
 * from the packet's; an honest roll keeps its own, as `onGmTerms` keeps it. A Monokuma's roll, of
 * which nothing is expected, is written as before (`onGmTerms`).
 */

/** A die, a sign and a number as Foundry writes their JSON, unevaluated. */
const dieJson = (cls, faces, number = 1, modifiers = []) => ({ class: cls, options: {}, evaluated: false, number, faces, modifiers, results: [] });
const signJson = op => ({ class: "OperatorTerm", options: {}, evaluated: false, operator: op });
const numberJson = n => ({ class: "NumericTerm", options: {}, evaluated: false, number: n });

/** The plain numbers of a roll's terms with their signs, smallest first - what a formula adds beyond its dice. */
const numbersOf = terms => JSON.stringify(terms.flatMap((term, i) => (typeof term?.number === "number" && !("faces" in term)
    ? [(terms[i - 1]?.operator === "-" ? -1 : 1) * term.number] : [])).sort((a, b) => a - b));
/** A statistic's value off the character as this GM holds it. */
const traitValueOf = (actor, key) => Number(actor.system?.traits?.[TRAITS[key]?.dh ?? ""]?.value) || 0;

/**
 * The character's numbers a roll adds up, as this GM holds them at one moment (E29 fix r2-H3): each
 * statistic's value by the module's key, and each experience it holds, `{ name, value }` by its key.
 * Read by `expectedFor` with the rest of the list ("WHAT THE GM THROWS IS READ IN ONE STEP" below);
 * the claim and what the GM throws are read off it, not off the character.
 */
function sheetOf(actor) {
    const held = Object.entries(actor?.system?.experiences ?? {}).filter(([, experience]) => experience);
    return { traits: Object.fromEntries(Object.keys(TRAITS).map(key => [key, traitValueOf(actor, key)])),
        experiences: Object.fromEntries(held.map(([key, { name, value }]) => [key, { name: name ?? key, value: Number(value) || 0 }])) };
}

/** The packet's numbers against the character's (`sheet`): its statistic, the experiences it names that the character holds, its flat sum, its advantage dice and any other dice. */
function claimOf(terms, sheet, told) {
    const fifth = ADVANTAGE_DICE[terms[4]?.class] ?? 0;
    const trait = traitKeyOf(told.trait);
    return { trait, traitValue: trait ? sheet.traits[trait] ?? 0 : 0,
        experiences: told.experiences.filter(key => Object.hasOwn(sheet.experiences, key)),
        flat: flatOf({ terms }), advantage: fifth * (Math.max(1, Math.trunc(Number(terms[4]?.number)) || 1)),
        dice: Math.max(0, terms.filter(term => "faces" in (term ?? {})).length - 2 - (fifth ? 1 : 0)) };
}

/**
 * What the GM throws of its list for this roll - see the note above: the statistic, the experiences
 * counted, each flat source `{ key, label, value }` (a statistic's or an experience's own name as its
 * label; the list's line for the rest), their sum, the advantage dice, and what of the claim's flat
 * sum was not counted (`uncounted`: experiences no Call bought, and the effects' part past its range).
 * The values are the character's as the list read them (`expected.sheet`, fix r2-H3).
 */
function scoredOf(expected, claim) {
    const { read, sheet } = expected;
    const trait = expected.trait ?? claim.trait;
    const experiences = claim.experiences.slice(0, expected.experiences);
    const valueOf = keys => keys.reduce((sum, key) => sum + (sheet.experiences[key]?.value ?? 0), 0);
    // The claim's flat sum past its statistic, its experiences and the Calls' bonus is the effects' part.
    const rest = claim.flat - claim.traitValue - valueOf(claim.experiences) - read.callBonus;
    const [low, high] = expected.effects;
    const effects = Math.min(high, Math.max(low, rest));
    const modifiers = [
        ...(trait ? [{ key: "trait", name: trait, label: TRAITS[trait]?.label ?? trait, value: sheet.traits[trait] ?? 0 }] : []),
        ...experiences.map(name => ({ key: "experience", name, label: sheet.experiences[name]?.name ?? name, value: sheet.experiences[name]?.value ?? 0 })),
        { key: "callBonus", value: read.callBonus },
        { key: "hostile", value: read.hostile.bonus },
        { key: "effects", value: effects }
    ].filter(m => m.key === "trait" || m.value);
    return { trait, traitValue: trait ? sheet.traits[trait] ?? 0 : 0, experiences, modifiers,
        flat: modifiers.reduce((sum, m) => sum + m.value, 0), advantage: expected.advantage,
        uncounted: rest - effects + valueOf(claim.experiences.slice(experiences.length)) };
}

/** A flat source's label as Daggerheart's card reads it: a statistic by Daggerheart's own key, an experience by its name, the rest by the list's line. */
function modifierLabel(m) {
    if (m.key === "trait") return `DAGGERHEART.CONFIG.Traits.${TRAITS[m.name]?.dh ?? m.name}.name`;
    return m.key === "experience" ? m.label : game.i18n.localize(LEGAL[m.key]?.label ?? "");
}

/**
 * The terms of what the GM threw (`scored`) at the list's faces (`read`): the Hope and the Fear die,
 * the advantage or disadvantage dice of its sum, the highest kept of several, and one number per flat
 * source - a draw's (`legalRollOf`) and its Reroll's (`rollOnRecord`) alike.
 */
function termsOf(scored, read) {
    const terms = [dieJson("HopeDie", read.hopeDie), signJson("+"), dieJson("FearDie", read.fearDie)];
    if (scored.advantage) {
        const up = scored.advantage > 0, number = Math.abs(scored.advantage);
        terms.push(signJson(up ? "+" : "-"),
            dieJson(up ? "AdvantageDie" : "DisadvantageDie", read.advantageDie[up ? "advantage" : "disadvantage"], number, number > 1 ? ["kh"] : []));
    }
    for (const m of scored.modifiers) terms.push(signJson(m.value < 0 ? "-" : "+"), numberJson(Math.abs(m.value)));
    return terms;
}

/*
 * THE GM'S OWN OPTIONS (E29 fix r2-H1, 05.10.2026; review round 2's sec B1). A Daggerheart roll's
 * options are its whole config (dhRoll.mjs:45), and every step the GM runs after the dice reads
 * it. Until this fix the GM's roll started from a clone of the packet's and had written over only
 * the options it named, so any other one the packet carried stayed on the roll the GM threw: the
 * review's Search sent with Daggerheart's `rerolledRoll` beside a Fear result left the GM's Fear
 * 1 -> 1, and on a Hope result took one off, 1 -> 0, recording no flag (its probe 99 P1, at
 * 070b72b's runtime) - the resource step pays the difference from that "earlier" roll
 * (dualityRoll.mjs `addDualityResourceUpdates`, :290-297). So the GM writes every option of the
 * roll it throws into a fresh object, from its own list: the claim's nonce (which the guard held
 * to the packet's), the kind and the critical its readers decided, a statistic's roll (`type`)
 * with the advantage, the modifiers and the statistic it counted, the experiences it counted,
 * every step run (`skips` empty), the empty `data` and `source` Daggerheart's constructor reads
 * (`rollFromLegal`'s note; the GM puts the character's uuid on `source` as it throws), and
 * `hasRoll`. Daggerheart's card shows the roll's result only under `hasRoll` (roll.hbs:6, 2.10.5),
 * read off the message's `system` (dhRoll.mjs `_prepareChatRenderContext`, :198-213), which
 * `toMessage` writes from these options (:151-155); its `rollTrait` sets it (actor.mjs:678), and
 * at 070b72b the honest packet carried it to the GM's roll (e29run/scratch/r2h1-probe). Without
 * it a drawn roll's card would show no result at a table - read in the source, not measured
 * there; the harness renders no Daggerheart card, so the suite reads the key, not the card.
 * Nothing else - an extra formula, base modifiers, a difficulty, a window's statistic mark - and
 * nothing of the packet's `roll`. The packet itself may carry only `DRAWN_OPTIONS` (each a key
 * the GM writes over, and the empty `data`), and one carrying any other key is refused and told
 * (bridge-guards.mjs `guardDrawnRoll`). Every roll the GM draws is a statistic's (`drawsHere`).
 */
function drawnOptions(nonce, { actionType, critical, advantage, modifiers, trait = null, experiences = [] }) {
    const roll = { type: "trait", advantage, modifiers };
    if (trait) roll.trait = trait;
    const options = { [ROLL_NONCE]: nonce, actionType, roll, experiences: [...experiences], skips: {}, data: {}, source: {}, hasRoll: true };
    if (critical) options.guaranteedCritical = true;
    return options;
}

/**
 * The roll this GM throws, as JSON for `fromData`, with what it scored (`scored`) and the packet's
 * numbers (`claim`) - see the note above. `scored` is null for a roll nothing is expected of. Of the
 * packet's roll only its class and its formula are kept (the guard holds both), the formula only
 * where the dice and the numbers are the GM's.
 */
async function legalRollOf(packetRoll, actor, expected, told, { key = null, claimed = true, nonce = null } = {}) {
    const json = foundry.utils.deepClone(packetRoll && typeof packetRoll === "object" ? packetRoll : {});
    const sent = Array.isArray(json.terms) ? json.terms : [];
    const claim = claimOf(sent, expected.sheet, told);
    if (!expected.checked) return { json: await onGmTerms(json, actor, { key, claimed, nonce }), scored: null, claim };
    const scored = scoredOf(expected, claim);
    const { read } = expected;
    const terms = termsOf(scored, read);
    const formula = diceShape(terms) !== diceShape(sent) || numbersOf(terms) !== numbersOf(sent) ? formulaOf(terms) : json.formula;
    const options = drawnOptions(nonce, { actionType: read.kind.actionType, critical: read.kind.critical, advantage: Math.sign(scored.advantage),
        modifiers: scored.modifiers.map(m => ({ label: modifierLabel(m), value: m.value })),
        trait: scored.trait ? TRAITS[scored.trait]?.dh ?? scored.trait : null, experiences: scored.experiences });
    return { json: { class: json.class, formula, terms, evaluated: false, options }, scored, claim };
}

/**
 * The roller's one line (the owner's Q1 (a), 05.10.2026): what the GM counted, and what of the claim
 * it did not - a statistic other than the one thrown, a modifier past the list's, dice beyond
 * Daggerheart's, advantage dice past the GM's sum in their own direction. Null where the claim had
 * nothing the GM did not count: a source the GM counted and the window lacked is the GMs' to see
 * (`checkRoll`), not the roller's to be told of. Exported for the suite.
 */
export function rollerLine({ scored = null, claim = null } = {}) {
    if (!scored || !claim) return null;
    const kind = what => game.i18n.localize(FLAG_KINDS[what]);
    const missed = [];
    if (claim.trait && claim.trait !== scored.trait) missed.push(`${kind("trait")} ${TRAITS[claim.trait]?.label ?? claim.trait}`);
    // Below nothing is a source the GM counted and the window lacked: the GMs' to see, not the roller's (fix r2-H3; cor m4).
    if (scored.uncounted > 0) missed.push(`${kind("modifier")} ${signed(scored.uncounted)}`);
    if (claim.dice > 0) missed.push(`${kind("dice")} ${claim.dice}`);
    if ((claim.advantage > 0 && claim.advantage > scored.advantage) || (claim.advantage < 0 && claim.advantage < scored.advantage)) {
        missed.push(`${kind("advantage")} ${signed(claim.advantage)}`);
    }
    if (!missed.length) return null;
    const counted = scored.modifiers.map(m => `${m.label ?? game.i18n.localize(LEGAL[m.key]?.label ?? "")} ${signed(m.value)}`);
    if (scored.advantage) counted.push(`${kind("advantage")} ${signed(scored.advantage)}`);
    return game.i18n.format("DRPG.Rolls.notCounted", {
        counted: game.i18n.format("DRPG.Rolls.counted", { list: counted.join(", ") || signed(0) }), list: missed.join(", ") });
}

/** The roller's line, to the roller alone, where there is one. A private card the GM posts, naming nobody. */
async function tellRoller(sender, legal) {
    const line = rollerLine(legal);
    if (!line || !sender?.id) return;
    try {
        await announce({ content: `<p>${esc(line)}</p>`, whisper: [sender.id] });
    } catch (err) {
        error("Could not tell the roller what the GM counted of their roll", err);
    }
}

/**
 * The draw itself. What this GM holds legal for the roll is read first (`expectedFor`), and the
 * roll is built from it (`legalRollOf`, E29 C10) and rebuilt with Daggerheart's `fromData` - never
 * the constructor, which builds the advantage die again from the options (reroll.mjs
 * `rerollKeepingDice`) - thrown here, written, settled, its claim held against it (`checkRoll`),
 * its Calls spent and recorded, with the incident's turn it was thrown in (`incident`); answered
 * `{ rollId, messageId, faces, total, stash, loaded, roll }`, `roll` the JSON it was built from
 * (`rollerCopyOf`). `claimed` false is a statistic from the sheet, whose message keeps
 * Daggerheart's card (C13).
 */
async function throwDrawn({ actorId, actionKey, nonce, claimed, loaded, costs, roll: json,
    trait = null, experiences = [], calls = [], context = {} }, sender, incident = null) {
    const actor = game.actors.get(actorId ?? "");
    const cls = game.system?.api?.dice?.DualityRoll;
    if (!actor || typeof cls?.fromData !== "function") throw new Error("there is no character or no duality roll to draw");
    const key = typeof actionKey === "string" && /^[a-zA-Z]{1,32}$/.test(actionKey) ? actionKey : null;
    const told = { trait: typeof trait === "string" ? trait : null, experiences: strings(experiences), context: contextSent(context) };
    // What the roll applied, as this GM holds it: read before the dice, and spent after them. Held means
    // the GMs' mark of the armed list (E29 C8): an entry a player's browser wrote itself is not a Call.
    // And the hostile Calls it did not name, armed long enough before it (`hostileCalls`, E29 C9).
    const { armedCallsHeld } = await import("./sheet-audit.mjs");
    const held = await armedCallsHeld(actor);
    const applied = appliedCalls(actor, calls, held);
    const hostile = hostileCalls(actor, applied, held, { key, claimed });
    const expected = await expectedFor(actor, { actionKey: key, applied, hostile, context: told.context, claimed, loaded,
        actionType: json?.options?.actionType ?? null });
    // The roll this GM throws is the one it builds from its list (`legalRollOf`, E29 C10); the packet's is a claim.
    const legal = await legalRollOf(json, actor, expected, told, { key, claimed, nonce });
    const roll = rollFromLegal(cls, foundry.utils.deepClone(legal.json));
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
    // hold the mark and the roll applied it (`loadedDie`).
    const loads = expected.read.loadedDie;
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
    const flags = checkRoll(legal, told, expected);
    const used = [...applied, ...hostile].map(call => call.nonce);
    if (used.length) await spendCallsByNonce(actor, used);
    await keepRecord({
        rollId, actorId: actor.id, userId: sender.id, actionKey: key,
        messageId: message.id, claimed: Boolean(claimed), formula: roll.formula,
        // The statistic and the experiences the roll was thrown with, as the GM was told them at
        // the draw - a Reroll of a roll with no `scored` rebuilds the roll from these (reroll.mjs
        // `rollAsThrown`), not from a bookmark the roller may send again; one with it, from `scored`
        // (`rollOnRecord`, E29 C11).
        trait: traitKeyOf(told.trait), experiences: told.experiences.filter(name => Object.hasOwn(expected.sheet.experiences, name)),
        dice: roll.dice.map(die => ({ faces: die.faces, results: die.results.map(r => ({ result: r.result, active: r.active !== false })) })),
        total: roll.total, hope: roll.dHope?.total ?? null, fear: roll.dFear?.total ?? null,
        isCritical: Boolean(roll.isCritical), withHope: Boolean(roll.withHope), withFear: Boolean(roll.withFear),
        modifiers: (Array.isArray(config.roll?.modifiers) ? config.roll.modifiers : []).map(m => Number(m?.value) || 0),
        // What the GM read (`legal`), what it threw of it (`scored`) and the packet's numbers (`claim`), E29 C10.
        legal: recordOf(expected), scored: legal.scored, claim: legal.claim, flags, used: { calls: used, stash, loaded: loads }, versions: [],
        // What the roll was drawn for beyond its action (fix r2-H1): the crisis action it names, the
        // incident's turn it was thrown in, and the later roll of its action that replaced it, if one does;
        // and the project a Work's or a Sabotage's names, null where it named none (fix r2-H2); a
        // Search's goal, which the find's judge reads (sheet-audit.mjs `searchFind`, E29 fix r1-G8).
        crisis: key === "crisis" ? told.context.crisis ?? null : null, project: projectNamed(key, told.context),
        goal: key === "search" ? told.context.goal ?? null : null,
        incident, superseded: null, at: Date.now()
    });
    if (flags.length) await tellUnexpected(actor, flags);
    await tellRoller(sender, legal);
    return { reply: { rollId, messageId: message.id, faces: facesOf(roll), total: roll.total, stash, loaded: loads, roll: legal.json } };
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
 * (`DRPG.Rolls.unexpected`) and a line in `game.drpg.rollFlags()`. The roll stood as drawn until
 * E29 C10; since then the GM throws what it reads ("THE GM THROWS ITS OWN LIST" above), and the
 * difference is the claim's.
 *
 * WHAT IT READS IS ONE LIST, ALL OF IT THE GM'S (E29 C9, 05.10.2026; audit S17-12, its second
 * half; the stage plan's 3.2). Until C9 this note listed what the GM read, and half of it was the
 * roller's word: the statistic of any roll whose action names one only where the packet said a GM
 * picked (fix r2-H8 took that back), and the situation's dice of every action but a Search and an
 * opening - a weapon in hand, a second try, a trap's victim, a tool - as the roller's browser armed
 * them: by reading, a crisis roll's packet that said 0 with a weapon in hand was expected 0 and
 * flagged nothing (tier 2, "a crisis roll's weapon die is the GM's reading ...", measures it). Now each part a roll may add up to is a row of config.mjs `LEGAL_ROLL_MODIFIERS`, read
 * by the reader of its name (`LEGAL_READERS` below) from what this GM holds:
 *   - the statistic (`trait`), from the first row of `TRAIT_SOURCES` that answers (fix r1-G10): an
 *     armed Resolve's roll is the player's pick; the opening's as the GM picked it; Eye for a
 *     Search; the project's own for a Work on it or a Sabotage of it; for an action that lists
 *     several, the newest pick card a GM wrote for this character and that action, naming a
 *     statistic it lists, that no drawn roll has used yet - waited for a moment, as the card's
 *     meta can land after the answer - and where none came, the lowest it lists, flagged
 *     (`pick`); for one that lists one - an action, a crisis action, a clean-up's step, Tamper's door,
 *     a Palm's cover - that one. A roll that names no action - a statistic from the sheet, a
 *     concealment - is held to no statistic;
 *   - the flat modifier: the statistic's value off the character as this GM holds it, one
 *     experience where an Experience Call bought it (`experience`), the Calls' bonus (`callBonus`),
 *     and Daggerheart's roll bonuses from the character's active effects as a range (`effects`):
 *     which of them a roll's window selects is not sent;
 *   - the advantage dice, summed and capped as roll-dialog.mjs `advantageSources` sums them: the
 *     Calls the roll applied (`calls`), the hostile ones it did not name (`hostile`, below),
 *     Breakdown (`breakdown`), and the situation (`situation`), per action: a Search's room, an
 *     opening's Night, a crisis action's own (murder.mjs `crisisSituational`), a tool in hand for
 *     a Work or a Sabotage, a Cleaning Tool for a clean-up but a body moved;
 *   - a hidden stash in the room this GM sees the searcher in (`stashStep`), against the packet's word.
 * A HOSTILE CALL COUNTS NAMED OR NOT (the owner's Q3 (a), 05.10.2026). A disadvantage or a bonus below
 * nothing armed on the character - an Obstacle, a Meddle's hinder - more than `HOSTILE_GRACE` before
 * the draw is applied whether the packet names it or not, and spent with the rest; one armed later is
 * neither, and waits for the next roll, as one armed while a window stood open waits (E08+E28 C7).
 * An entry armed before 1.2.68 carries no time (call-effects.mjs `appendArmedCall`) and counts as
 * armed long before. A roll that spends no Call - a supporting roll (action-rolls.mjs `rollTrait`'s
 * `remember: false`: a Palm's unseen roll, an opening, a concealment, which names no action) - is
 * given none.
 * Monokuma's rolls are not locked by the window (roll-dialog.mjs `isStudentRoll`), and nothing
 * is expected of them. The record keeps the expectation as `legal`, with each reader's value
 * (`read`), and a flag of the advantage dice or of the modifier names the rows that made the
 * GM's number (`from`), so a flag says what the GM counted.
 *
 * WHAT THE HARNESS CANNOT SHOW. Daggerheart's roll window is not in the headless harness, so
 * a roll there is built without the dice and the bonus the window would impose: a drawn roll
 * that applied a dice or bonus Call, or whose situation the GM reads as a die - a tool in hand, a
 * crisis weapon, a trap's victim, the Night's opening, Breakdown - is flagged there, truthfully: its
 * dice lack it, where a table's window would have put it on. Since E29 C10 the GM throws that die
 * all the same (its face is the GM's randomiser's: a scenario's `__forceRoll` names the Hope and the
 * Fear die alone), and the roller is told nothing, the claim having nothing the GM did not count.
 * The suite's packets put the dice on as a window would. Not measured at a table: LIVE-E28.
 * ========================================================================== */

/** The most Calls a packet may name; more is no roll's. */
const CALLS_KEPT = 16;
/** How long a roll a GM picked the statistic for waits for the pick card's meta. Chosen, not measured. */
const PICK_WAIT_MS = 2000;

/**
 * The Calls the roll applied: the ones the packet names that are armed on the character as this GM
 * holds them - on the flag and in the GMs' mark of it (`held`, sheet-audit.mjs `armedCallsHeld`), or
 * a Confusion of the GMs' store. AN ARMED CALL IS THE GMS' (E29 C8, 05.10.2026; the plan's 1.5 item 5,
 * fix r2-H8's H8-6): until 1.2.68 a Call on one's own character was written by the player's browser,
 * and this read the flag alone, so a console's entry, paid for by nothing, counted - a Loaded Die's
 * 12 included, by the plan's reading. Every player's Call is bought on the GM now (gm-bridge.mjs `call.arm`), the audit
 * puts back an entry a player adds, and this waits for that student's writes to be judged before it
 * reads. Where the GMs keep no mark the flag is read alone, as before.
 */
function appliedCalls(actor, nonces, held = null) {
    const named = new Set(strings(nonces).slice(0, CALLS_KEPT));
    return named.size ? armedCallsShown(actor, { held }).filter(call => named.has(call?.nonce)) : [];
}

/** A Call that hinders the roll it is spent on: a disadvantage, or a bonus below nothing (a Meddle's -1). */
const hinders = call => call?.grants === "disadvantage" || (call?.grants === "bonus" && Number(call.amount) < 0);
/** The actions whose roll spends no Call (action-rolls.mjs `rollTrait`'s `remember: false`): a Palm's unseen roll and an opening. */
const SPENDS_NO_CALL = new Set(["palm", "murderOpening"]);

/**
 * The hostile Calls held armed on the character that the roll did not name and that were armed more
 * than `HOSTILE_GRACE` before now - see "A HOSTILE CALL COUNTS NAMED OR NOT" above. None for a roll
 * that spends no Call: an action of `SPENDS_NO_CALL`, or a roll of the module's that names no action
 * (a concealment; a statistic from the sheet, `claimed` false, spends its window's Calls).
 */
function hostileCalls(actor, applied, held, { key = null, claimed = true } = {}) {
    if (SPENDS_NO_CALL.has(key) || (!key && claimed !== false)) return [];
    const named = new Set(applied.map(call => call?.nonce));
    const armedBy = Date.now() - LEGAL.hostile.bound;
    return armedCallsShown(actor, { held }).filter(call => hinders(call) && !named.has(call?.nonce) && !(Number(call.at) > armedBy));
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

/*
 * WHOSE WORD SAYS A GM PICKED THE STATISTIC (E08+E28 fix r2-H8, 05.10.2026). Until this fix the
 * GM looked for a pick card only where the roll window said a GM had picked (`TRAIT_BY_GM`),
 * which is the packet's to say: at 33bc497's runtime (tier 2, "a crisis roll's statistic is held
 * to the GM's pick whatever ..."), two crisis rolls of a Strike sent without it - one after a card
 * picking Body, rolled with Eye; one with no card made for it - were held to nothing and flagged
 * nothing. Now this GM
 * reads the action's own definition, as the ruling reads it (trait-ruling.mjs `listedTraits`):
 * a crisis action at the variant the character rolls here (murder.mjs `crisisVariant`), a project
 * given no statistic, an action of the generic table - a pick is due where it lists several. The
 * clean-up's step and its door were not in the packet's context, so until E29 C9 a clean-up rolled
 * with a statistic one of its single-statistic roads rolls - Tamper's Shadow, a Stage 6 action's own -
 * was held to no pick whatever its step. Both ride in the context since (`CONTEXT_SENT`, the roller's
 * word, as the step always was for a Reroll): Tamper's door and a step that lists one statistic -
 * moving the body - are held to that statistic, any other step to a pick. Since fix r1-G10 the
 * definition is read once for both (`listedFor`): several statistics ask a pick (`gm`), one is
 * expected as it stands (`fixed`) - see "WHERE A ROLL'S STATISTIC COMES FROM" below.
 */

/** The parts of an action told under a key of their own (`rollTrait`'s `actionKey`): a Palm's cover as "palm", its hand as "steal" (action-rolls.mjs `performPalm`). */
const TOLD_AS = Object.freeze({ palm: Object.freeze({ key: "palm", part: "unseen" }), steal: Object.freeze({ key: "palm" }) });

/**
 * The statistics the definition a roll is told for lists, read from this GM's config as the
 * ruling reads it (trait-ruling.mjs `listedTraits`): a crisis action at the variant the character
 * rolls here (murder.mjs `crisisVariant`), the project a Work or a Sabotage names, a clean-up's
 * step - through Tamper's door Tamper's first, which cleanup.mjs `cleanupTrait` rolls whatever
 * the step - or an action of the table, whole or the part its key is told for (`TOLD_AS`). `[]`
 * for none this GM knows.
 *
 * TAMPER'S DOOR IS THE PACKET'S WORD WHERE AN HONEST BROWSER SAYS IT, AND NOWHERE ELSE (E29 fix
 * r2-H2, 05.10.2026; the round-2 reviews' sec m2 = cor m5, by reading). `cleanupVia` held any
 * clean-up to Tamper's one statistic, so a roll of Stage 6's cleaner, whose step lists three and
 * waits for a GM's pick, skipped the pick by saying it. An honest browser says it only for a
 * roller who is not Stage 6's cleaner (action-rolls.mjs `viaAction = !stageSix`; Stage 6's own
 * doors say nothing), and the GMs take a statistic ruling for a clean-up from the cleaner alone
 * (bridge-guards.mjs `guardTraitRuling`): so it is honoured only for a roller this GM does not
 * hold to be the cleaner of its incident (cleanup.mjs `isCleaner`). The fix list's first way;
 * the door is not read from that state outright, which would hold a roll of moving the body
 * outside Stage 6 to Tamper's statistic too (tier 2's test of every definition of one statistic
 * draws one there, at Body).
 */
async function listedFor(actor, key, context) {
    const { listedTraits } = await import("./trait-ruling.mjs");
    if (key === "crisis") {
        const { crisisVariant } = await import("./murder.mjs");
        const crisis = context.crisis ?? null;
        return listedTraits({ kind: "crisis", key: crisis, variant: crisisVariant(actor, crisis) });
    }
    if (key === "project" || key === "sabotage") return listedTraits({ kind: "project", key: projectNamed(key, context) });
    if (key === "cleanup" && context.cleanupVia === true && !(await import("./cleanup.mjs")).isCleaner(actor)) {
        return (ACTIONS.tamper?.traits ?? []).slice(0, 1);
    }
    if (key === "cleanup") return listedTraits({ kind: "cleanup", key: cleanupStepOf(context) });
    return listedTraits({ kind: "action", ...(Object.hasOwn(TOLD_AS, key ?? "") ? TOLD_AS[key] : { key }) });
}

/** The clean-up's step a packet's context names (cleanup.mjs `cleanupKey`): one of Stage 6's actions, else the clean-up itself. */
function cleanupStepOf(context) {
    return Object.hasOwn(CLEANUP.actions ?? {}, context?.cleanupKey ?? "") ? context.cleanupKey : "cleanup";
}

/**
 * The definition a GM's statistic card names for a roll (`{ kind, key, variant }`, as messenger-app.mjs
 * `rulePickTrait` keeps it), read as `listedFor` reads the roll's: a crisis action at the variant
 * the character rolls here, the project a Work or a Sabotage names, the clean-up's step, or an
 * action of the generic table.
 */
async function pickSpecOf(actor, key, context) {
    if (key === "crisis") {
        const { crisisVariant } = await import("./murder.mjs");
        const crisis = context.crisis ?? null;
        return { kind: "crisis", key: crisis, variant: crisisVariant(actor, crisis) };
    }
    if (key === "project" || key === "sabotage") return { kind: "project", key: projectNamed(key, context), variant: null };
    if (key === "cleanup") return { kind: "cleanup", key: pickKeyOf("cleanup", cleanupStepOf(context)), variant: null };
    return { kind: "generic", key, variant: null };
}

/**
 * The key a statistic card is asked under, for matching: a clean-up's step that rolls the
 * clean-up's own list is the clean-up's, as the two roads ask - cleanup.mjs asks "cleanup" for an
 * erase whose roll names "eraseTrace", and "misleadingTrail" for a trail, both rolling the
 * clean-up's three. Every other key as it is.
 */
const pickKeyOf = (kind, key) => (kind === "cleanup" && !CLEANUP.actions?.[key]?.traits ? "cleanup" : key ?? null);

/**
 * The newest pick card a GM wrote for this character and this definition (`spec`, `pickSpecOf`)
 * within the Reroll's window (`{ trait, pick }`, the card's id), or null - also when a drawn
 * roll's record names that card already, so an older pick nobody rolled is never the one a roll
 * is held to, and when the statistic it names is not one the definition lists here (`listed`).
 *
 * A PICK IS A GM'S CARD, FOR THE ROLL'S OWN DEFINITION (E29 fix r2-H2, 05.10.2026; the round-2
 * security review's B2 and m1). Until this fix every card carrying a `ruling` was read, whoever
 * wrote it, and the newest held whichever action of its kind the character rolled next, to
 * whatever statistic it named. A GM keeps a real pick in its card's meta (gm-bridge.mjs
 * `settleCall`), which a player's own card may not carry (secret.mjs `GM_META`), but this read the
 * document's flag first: the review's console posted a card with the flag on it and the GM threw
 * Body for a clean-up, which does not list it, recorded as the GM's pick with nothing flagged (its
 * probe 96 H, at 070b72b's runtime; at a4a7f25's, tier 2's test of this fix and 30-security read a
 * Work held by a card a player wrote, by a GM's card for another project, and to an Eye a project
 * does not list - e29run/r2h2red). Now a card counts only where a GM wrote it (secret.mjs
 * `cardWriter`, as the away card's buttons are read below), for this definition - its kind, its
 * key (`pickKeyOf`) and its variant the roll's - naming a statistic the definition lists.
 */
function gmPickOf(actor, spec, listed) {
    const since = Date.now() - TIMING.rerollWindowMinutes * 60_000;
    // `expected` is a record's name for it before E29 C9 (`legal` since): a row of the Reroll's window across the update.
    const used = new Set(Object.values(rollStore.entries() ?? {}).map(row => (row?.legal ?? row?.expected)?.pick).filter(Boolean));
    const messages = game.messages?.contents ?? [];
    for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        if (typeof message.timestamp === "number" && message.timestamp < since) break;
        const ruling = cardFlag(message, "ruling");
        if (ruling?.type !== "trait" || ruling.actorId !== actor.id || ruling.kind !== spec.kind || !cardWriter(message)?.isGM) continue;
        if (pickKeyOf(ruling.kind, ruling.key) !== spec.key || (ruling.variant || null) !== (spec.variant ?? null)) continue;
        const trait = traitKeyOf(ruling.trait);
        return used.has(message.id) || !listed.includes(trait) ? null : { trait, pick: message.id };
    }
    return null;
}

/** Of the statistics `listed`, the one lowest in the character's numbers (`sheetOf`), the first listed of equals - what a roll whose pick did not come is thrown on (the `gm` row below). */
const lowestOf = (sheet, listed) => listed.reduce((low, trait) => ((sheet.traits[trait] ?? 0) < (sheet.traits[low] ?? 0) ? trait : low));

/*
 * WHERE A ROLL'S STATISTIC COMES FROM IS ONE TABLE (E29 fix r1-G10, 05.10.2026; audit S18-01, the
 * auditor's own correction of that day, which lands here). The GM expected the statistic of a
 * Search, a project, the opening, a pick card and Stage 6's single-statistic steps (C9), and of
 * nothing else: an action whose definition lists ONE statistic - Observe, Analyze, Listen, a
 * Palm's hand and its cover, a crisis action such as Pin - was held to none, "any statistic
 * stands", so a console rolled it on a better one and nothing noticed, against D2 (tier 2, "every
 * definition and part that lists one statistic ...", at 9b5b72a's runtime: ten of the thirteen
 * expected nothing - Observe, Analyze, Listen, a Palm's two rolls, five crisis actions - and of
 * eight rolls drawn on another statistic five went unflagged). Now the rows are read in order and
 * the first that answers decides; `traitFrom` is its name, `trait` null where any statistic stands:
 *   - `resolve`: an armed Resolve's roll is the player's pick;
 *   - `opening`: the opening's statistic as the GM picked it, for the side this GM sees rolling it;
 *   - `search`: Search's one statistic - the `fixed` rule's case under the name its record has
 *     carried since E08+E28 C12b, which a later stage gives a rule of its own (S18-09);
 *   - `project`: the project's own, for a Work on it or a Sabotage of it;
 *   - `gm`: where the definition lists several, the newest pick card a GM wrote for this character
 *     and this definition no drawn roll has used yet (`gmPickOf`), waited for a moment as the
 *     card's meta can land after the answer - and where none came, the lowest statistic the
 *     definition lists as this GM holds the character (`lowestOf`; chosen with the rest of the
 *     list once the wait is over, `traitThrown`, fix r2-H3), which `checkRoll` flags
 *     (`pick`). Until fix r2-H2 (the round-2 security review's M2) it was none, and the roll was
 *     thrown on the statistic its packet claimed, any of the six: the review's console rolled a
 *     clean-up claiming Hand with no pick, and the GM threw Hand (its probe 99 P3, at 070b72b's
 *     runtime). A claim never chooses the statistic of a roll a GM was to pick. The stage plan
 *     names none for a pick that does not come (its 3.2 and the owner's answer of 28.09 say the
 *     GM picks), so the rule is the round-2 fix list's: the lowest, a statistic the action lists
 *     that no roller gains by not asking;
 *   - `fixed`: where it lists one, that one - an action of the table, a crisis action, a clean-up's
 *     step, Tamper's door, a part of an action told under a key of its own (`TOLD_AS`).
 * The definition is this GM's config (`listedFor`); the packet names only which. S18-01 has the
 * packet say which part of an action a roll is (`part`), for parts told under their action's own
 * key: none is at 1.2.68 - a Palm's two rolls are two keys - so no packet carries one yet. A roll
 * that names no action - a statistic from the sheet, a concealment, a discard - is held to none.
 */
const TRAIT_SOURCES = Object.freeze([
    { from: "resolve", read: (actor, { applied }) => (applied.some(call => call?.grants === "trait") ? { trait: null } : null) },
    { from: "opening", read: async (actor, { key, context }) => {
        if (key !== "murderOpening") return null;
        const { murderState } = await import("./murder.mjs");
        const state = murderState();
        return openingSideOf(actor, context, state) ? { trait: traitKeyOf(state.openingTrait) } : null;
    } },
    { from: "search", read: (actor, { key, listed }) => (key === "search" && listed.length === 1 ? { trait: listed[0] } : null) },
    { from: "project", read: async (actor, { key, context }) => {
        if (key !== "project" && key !== "sabotage") return null;
        const { allProjects } = await import("./projects.mjs");
        const project = allProjects().find(p => p.id === projectNamed(key, context));
        return project?.trait ? { trait: traitKeyOf(project.trait) } : null;
    } },
    { from: "gm", read: async (actor, { key, context, listed }) => {
        if (listed.length < 2) return null;
        const spec = await pickSpecOf(actor, key, context);
        let found = gmPickOf(actor, spec, listed);
        for (const end = Date.now() + PICK_WAIT_MS; !found && Date.now() < end;) {
            await new Promise(resolve => setTimeout(resolve, 100));
            found = gmPickOf(actor, spec, listed);
        }
        return found ?? { lowest: listed };
    } },
    { from: "fixed", read: (actor, { listed }) => (listed.length === 1 ? { trait: listed[0] } : null) }
]);

/**
 * Where a roll's statistic comes from, `{ trait, traitFrom, pick, lowest }`: the first of
 * `TRAIT_SOURCES` that answers, or none - the part of the `trait` row that takes time, read before
 * the rest (`readyFor`). `lowest` names the statistics the lowest of which is thrown, chosen with the
 * rest of the list (`traitThrown`, fix r2-H3).
 */
async function traitReading(actor, draw) {
    const listed = await listedFor(actor, draw.key, draw.context);
    for (const { from, read } of TRAIT_SOURCES) {
        const got = await read(actor, { ...draw, listed });
        if (got) return { trait: got.trait ?? null, traitFrom: from, pick: got.pick ?? null, lowest: got.lowest ?? null };
    }
    return { trait: null, traitFrom: null, pick: null, lowest: null };
}

/** The `trait` row, `{ trait, traitFrom, pick }`: the statistic `traitReading` found, or of those it named, the lowest in the character's numbers. */
const traitThrown = ({ lowest, ...source }, sheet) => (lowest ? { ...source, trait: lowestOf(sheet, lowest) } : source);

/** The side whose opening roll this is, as the GM sees the incident now (`killer`, `victim`), or null. */
function openingSideOf(actor, context, state) {
    const side = context.side === "killer" || context.side === "victim" ? context.side : null;
    return side && state?.stage === "openingRoll" && state[`${side}Id`] === actor.id ? side : null;
}

/*
 * The situation's dice of a roll, read on this GM for its action with the modules `readyFor` loaded - the `situation`
 * row; see the note above.
 * A CRISIS WEAPON, A TOOL, A CLEANING TOOL AS THE GMS HOLD THEM (E29 fix r2-H20, 06.10.2026; H18's seam). Whether a
 * weapon, a tool or a Cleaning Tool is in hand is read off the character's items as the GMs hold them (sheet-audit.mjs
 * `actorHeldNow`, handed in by `readyFor` as `heldNow`): a role, a tier, a break or a stash a player's browser wrote and
 * the audit puts back is not read, nor one whose put-back failed. Read for these three actions only, in the list's one
 * step ("WHAT THE GM THROWS IS READ IN ONE STEP" below, fix r2-H3): after its wait (`judgedFor`), awaiting nothing -
 * `actorHeldNow` is `actorAsHeld` without the wait, which the draw has made. No judgement waits for anything the draw
 * makes before its dice - its Calls are spent after them, and a find comes after its roll (by reading, not measured).
 * Until this fix (4d1532c, e29run/r2h20red, 06.10.2026) a readied knife a write took out of the stash the GMs' mark
 * keeps it in read as a weapon in hand on a crisis swing (0, not an unarmed -1) and as a tool and a Cleaning Tool on a
 * project's and a clean-up's roll (1 each, not 0). Written on the side line before fix r2-H3 met it, this reading
 * awaited `actorAsHeld` itself; the merge of the two lines (06.10.2026) reads it in the one step instead.
 */
function situationReading(actor, { key, context, ready: { vault, murder, items, cleanup, heldNow } }) {
    if (key === "search") return searchOdds(actor, roomOfActor(actor), context.category ?? null, vault).situational;
    if (key === "murderOpening") {
        // The Night's die, the opening roll's own (murder.mjs `throwOpeningRoll`, `rollTrait`'s `situational`).
        const side = openingSideOf(actor, context, murder.murderState());
        const def = side ? MURDER_OPENING[side] ?? {} : {};
        return side && murder.atNight() ? (def.nightAdvantage ? 1 : def.nightDisadvantage ? -1 : 0) : 0;
    }
    if (key === "crisis") {
        const crisis = typeof context.crisis === "string" && Object.hasOwn(CRISIS_ACTIONS, context.crisis) ? context.crisis : null;
        return crisis ? murder.crisisSituational(actor, crisis, undefined, heldNow(actor)) : 0;
    }
    // A tool in hand is worth a die (action-rolls.mjs, "A TOOL IN HAND IS WORTH A DIE").
    if (key === "project" || key === "sabotage") return items.equippedFor(heldNow(actor), "tool") ? 1 : 0;
    if (key === "cleanup") {
        // A Cleaning Tool's die, but not on a body moved (cleanup.mjs `attemptCleanup`, Stage 6's actions).
        return CLEANUP.toolAdvantage && cleanup.cleaningTool(heldNow(actor)) && cleanupStepOf(context) !== "moveBody" ? 1 : 0;
    }
    return 0;
}

/** Advantage minus disadvantage across Calls, as roll-dialog.mjs `callDice` counts a window's. */
const diceOf = calls => calls.reduce((sum, call) => sum + (call?.grants === "advantage" ? 1 : call?.grants === "disadvantage" ? -1 : 0), 0);
/** The flat bonus of Calls (a Meddle's +1 or -1). */
const bonusOf = calls => calls.filter(call => call?.grants === "bonus" && Number.isFinite(Number(call.amount)))
    .reduce((sum, call) => sum + Number(call.amount), 0);
/** The character's rules as a roll reads them (character.mjs, Daggerheart's `getRollData`). */
const rulesOf = actor => actor.getRollData?.()?.rules ?? actor.system?.rules ?? {};

/**
 * ONE READER PER ROW of config.mjs `LEGAL_ROLL_MODIFIERS`, each `(actor, draw, row)` with `draw` =
 * `{ key, claimed, actionType, applied, hostile, context, loaded }` as this GM holds them - see the
 * note above - and, from `expectedFor`, `ready` (`readyFor`) and `sheet` (`sheetOf`). Each answers at
 * once, awaiting nothing ("WHAT THE GM THROWS IS READ IN ONE STEP" below). `onGmTerms` reads the
 * faces and the kind, `expectedFor` every row.
 */
const LEGAL_READERS = Object.freeze({
    hopeDie: (actor, draw, row) => facesFrom(rulesOf(actor).dualityRoll?.defaultHopeDice, row.bound),
    fearDie: (actor, draw, row) => facesFrom(rulesOf(actor).dualityRoll?.defaultFearDice, row.bound),
    // Each kind of die at the rules' own faces where they name some, as roll-dialog.mjs `forceAdvantage` reads them.
    advantageDie: (actor, draw, row) => {
        const roll = rulesOf(actor).roll ?? {}, faces = facesFrom(roll.advantageFaces, row.bound);
        return { advantage: facesFrom(roll.defaultAdvantageDice, faces), disadvantage: facesFrom(roll.defaultDisadvantageDice, faces) };
    },
    trait: (actor, { ready, sheet }) => traitThrown(ready.trait, sheet),
    experience: (actor, draw, row) => (draw.applied.some(call => call?.grants === "experience") ? row.bound : 0),
    callBonus: (actor, draw) => bonusOf(draw.applied),
    effects: actor => effectRange(actor),
    calls: (actor, draw) => diceOf(draw.applied),
    hostile: (actor, draw) => ({ dice: diceOf(draw.hostile), bonus: bonusOf(draw.hostile) }),
    breakdown: (actor, draw, row) => (isBrokenDown(actor) ? row.bound : 0),
    situation: (actor, draw) => situationReading(actor, draw),
    loadedDie: (actor, draw) => typeof draw.loaded === "string" && draw.applied.some(call => call?.grants === "critical" && call.nonce === draw.loaded),
    stashStep: (actor, { key, context, ready }) => key === "search"
        && Boolean(searchOdds(actor, roomOfActor(actor), context.category ?? null, ready.vault).stashDie),
    // A module action's roll is an action; a student's statistic from the sheet the reaction its window makes it; a
    // Monokuma's whichever its window said. A critical guaranteed only by the character's own effects (`buildConfigure`).
    kind: (actor, { key, claimed, actionType }) => ({
        actionType: key || claimed !== false ? "action" : !isMonokuma(actor) ? "reaction" : actionType === "reaction" ? "reaction" : "action",
        critical: [...(actor.appliedEffects ?? [])].some(effect => (effect?.system?.changes ?? effect?.changes ?? [])
            .some(change => change?.key === "system.rules.roll.guaranteedCritical"))
    })
});
/** The list's rows by key. */
const LEGAL = Object.freeze(Object.fromEntries(LEGAL_ROLL_MODIFIERS.map(row => [row.key, row])));
/** One row read: its reader, handed the row. */
const legal = (key, actor, draw) => LEGAL_READERS[key](actor, draw, LEGAL[key]);

/*
 * WHAT THE GM THROWS IS READ IN ONE STEP (E29 fix r2-H3, 06.10.2026; the round-2 security review's
 * M1). The GMs' audit judges a player's write on the primary as its hook hears it, and puts back
 * what nothing covers (sheet-audit.mjs) - a moment after the write landed. A draw waited for the
 * character's queue once, before its Calls (`armedCallsHeld`), and read the rest of the list after
 * awaits of its own - the pick card's wait above all, up to `PICK_WAIT_MS` - off the character as
 * it stood then, so a write that landed during them and was not put back yet was thrown: by the
 * review's probe 99 P3 at 070b72b's runtime, a clean-up waiting for a pick while p1's console made
 * effects guaranteeing a critical every 10 ms was thrown a critical (Hope 3, Fear 8, no flag).
 * At 7a040b9's runtime the same held still (e29run/r2h3red), the put-back waiting behind a GM's own
 * write of the character's means (sheet-audit.mjs `gmMeansWrite`) rather than wherever a flood
 * left it: a Work waiting for a pick was thrown the critical and Hand at the player's 9, where the
 * GMs hold Body lowest at 0, and the audit put both back after the throw (tier 2's "what a drawn
 * roll throws is the GMs' record once its waits are over", scenario 30's check after C10's).
 * Now what takes time comes first (`readyFor`: the modules the rows read with, and where the
 * statistic comes from - the pick card waited for), then the draw waits until every write heard on
 * the character has been judged (`judgedFor`) and reads every row in one step, awaiting nothing
 * between: the faces, the statistic and the experiences (`sheetOf`, which the claim and what is
 * thrown are read off), the effects' range and the critical, Breakdown, the situation's dice, the
 * stash. Every write that reached this GM before that step was judged and, where nothing covered
 * it, put back first - the judge awaits its put-back - and none lands within it.
 * Not the GMs' mark itself, the fix list's first way: the mark keeps each path's source
 * (sheet-audit.mjs `markFrom`), and a roll adds the character's prepared values, which Daggerheart
 * moves with effects - a statistic's too: its armour feature Cumbersome takes one off Finesse
 * (itemConfig.mjs:228-245), and 70 documents of its 2.10.5 packs carry a change to a statistic's
 * value (counted 06.10.2026). Off the mark, a student in such armour would be thrown one higher
 * than Daggerheart's sheet and window show. The harness prepares no effect into a character's
 * values (lib/shim.mjs `getRollData`), so it could not show that difference either way: by reading.
 * Not covered: a put-back that fails (the audit logs it) leaves the write on the character, and the
 * draw reads it.
 */

/** What the list's rows need that takes time, ready before them: the audit's wait, the modules the rows read with (and the audit's reading of a character's items as the GMs hold them, `heldNow`, fix r2-H20), and where the statistic comes from (`traitReading`). */
async function readyFor(actor, draw) {
    const [{ judgedFor, actorHeldNow }, { ADVANTAGE_CAP }, vault, murder, items, cleanup] = await Promise.all([import("./sheet-audit.mjs"),
        import("./roll-dialog.mjs"), import("./vault.mjs"), import("./murder.mjs"), import("./use-items.mjs"), import("./cleanup.mjs")]);
    return { judgedFor, heldNow: actorHeldNow, advantageCap: ADVANTAGE_CAP, vault, murder, items, cleanup, trait: await traitReading(actor, draw) };
}

/**
 * What this GM expects of a roll of `actor` for `actionKey` - every row of the list read, see the
 * note above. `applied` are the Calls it applied (`appliedCalls`), `hostile` the hostile ones it did
 * not name (`hostileCalls`); `context`, `claimed` and `loaded` the packet's word, `actionType` the
 * kind this GM gave the roll (`onGmTerms`). The expected `trait` is null where any statistic stands
 * or none is known here; `traitFrom` says which. `read` is each row's reading, `sheet` the
 * character's numbers read with them. Exported for the suite.
 */
export async function expectedFor(actor, { actionKey = null, applied = [], hostile = [], context = {}, claimed = true, loaded = null, actionType = null } = {}) {
    const draw = { key: actionKey, claimed, actionType, applied, hostile, context, loaded };
    draw.ready = await readyFor(actor, draw);
    await draw.ready.judgedFor(actor?.id);
    draw.sheet = sheetOf(actor);
    const read = {};
    for (const row of LEGAL_ROLL_MODIFIERS) read[row.key] = legal(row.key, actor, draw);
    const dice = read.calls + read.hostile.dice + read.breakdown + read.situation;
    return { checked: !isMonokuma(actor), ...read.trait, advantage: Math.sign(dice) * Math.min(draw.ready.advantageCap, Math.abs(dice)),
        situationFrom: "gm", bonus: read.callBonus + read.hostile.bonus, experiences: read.experience, effects: read.effects,
        stashDie: read.stashStep, sheet: draw.sheet, read };
}

/** What the record keeps of an expectation (`legal`): plain, with each row's reading and the pick card that a later roll may not use again. */
function recordOf(expected) {
    const { trait, traitFrom, pick, advantage, situationFrom, bonus, experiences, effects, stashDie, checked, read } = expected;
    return { checked, trait, traitFrom, pick, advantage, situationFrom, bonus, experiences, effects, stashDie, read: JSON.parse(JSON.stringify(read)) };
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

/** What each row adds to the flat sum or to the advantage dice, from its reading - the rows a flag says the GM counted. */
const COUNTED = Object.freeze({
    flat: Object.freeze({ experience: n => n, callBonus: n => n, hostile: h => h?.bonus, effects: range => (range?.[0] || range?.[1] ? 1 : 0) }),
    dice: Object.freeze({ calls: n => n, hostile: h => h?.dice, breakdown: n => n, situation: n => n })
});

/** The rows of `part` ("flat", "dice") whose reading gave this GM's number something. */
function countedIn(expected, part) {
    return Object.entries(COUNTED[part]).filter(([key, of]) => Boolean(Number(of(expected.read?.[key])))).map(([key]) => key);
}

/**
 * The claim against what the GM threw (E29 C10: `scored` and `claim`, `legalRollOf`; until C10 the
 * roll as thrown against the expectation): `[{ kind, expected, claimed }]`, empty when nothing differs.
 * Kinds: `trait`, `pick` (a statistic a GM was to pick, and no pick was made; fix r2-H8 - the
 * roll thrown on the lowest its action lists since fix r2-H2, and `trait` beside it where the
 * claim had another),
 * `modifier` (the flat sum past the statistic, which `trait` says), `dice` (a die beyond Hope,
 * Fear and the advantage die), `advantage`, `stash` (a hidden stash the packet did not name). A
 * `modifier` or an `advantage` flag names the list's rows that made the GM's number (`from`, E29 C9),
 * and its `expected` is the GM's number as thrown.
 */
function checkRoll({ scored, claim }, told, expected) {
    const flags = [];
    if (expected.stashDie && told.context.stashDie !== true) flags.push({ kind: "stash", expected: "1", claimed: "0" });
    if (!expected.checked || !scored) return flags;
    if (expected.trait && claim.trait !== expected.trait) flags.push({ kind: "trait", expected: expected.trait, claimed: claim.trait ?? "-" });
    if (expected.traitFrom === "gm" && !expected.pick) flags.push({ kind: "pick", expected: "1", claimed: "0" });
    if (claim.flat - claim.traitValue !== scored.flat - scored.traitValue || claim.experiences.length > scored.experiences.length) {
        flags.push({ kind: "modifier", expected: signed(scored.flat), claimed: signed(claim.flat), from: countedIn(expected, "flat") });
    }
    if (claim.dice > 0) flags.push({ kind: "dice", expected: "0", claimed: String(claim.dice) });
    if (claim.advantage !== scored.advantage) {
        flags.push({ kind: "advantage", expected: signed(scored.advantage), claimed: signed(claim.advantage), from: countedIn(expected, "dice") });
    }
    return flags;
}

const signed = n => (n > 0 ? `+${n}` : String(n));

/** The line each kind is said as - written out, so each key is a literal the lang check can find. */
const FLAG_KINDS = Object.freeze({
    trait: "DRPG.Rolls.flagKind.trait",
    pick: "DRPG.Rolls.flagKind.pick",
    modifier: "DRPG.Rolls.flagKind.modifier",
    dice: "DRPG.Rolls.flagKind.dice",
    advantage: "DRPG.Rolls.flagKind.advantage",
    stash: "DRPG.Rolls.flagKind.stash"
});

/**
 * One flag as words: what, what the roll had, what the GM expected - and, where the flag names
 * them, the list's rows the GM counted (`DRPG.Rolls.legal.*`). A statistic is said by its label.
 */
export function flagText(flag) {
    const word = value => (flag?.kind === "trait" ? TRAITS[value]?.label ?? value : value);
    const line = game.i18n.format("DRPG.Rolls.flagLine", {
        what: game.i18n.localize(FLAG_KINDS[flag?.kind] ?? "DRPG.Rolls.flagKind.modifier"),
        claimed: String(word(flag?.claimed) ?? "-"), expected: String(word(flag?.expected) ?? "-")
    });
    const from = (Array.isArray(flag?.from) ? flag.from : []).map(key => LEGAL[key]?.label).filter(Boolean);
    return from.length ? game.i18n.format("DRPG.Rolls.flagFrom", { line, list: from.map(key => game.i18n.localize(key)).join(", ") }) : line;
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
 * `supersededRoll` flag, and each browser that reads it heads it with the roll's character, not
 * with this GM (private-rolls.mjs `signAsRoller`, fix r2-H4). `toMessage` then waits for Dice So
 * Nice, which does not animate this message and so answers at once (`keepDiceToReaders`); the
 * draw does not wait for it either (the plan's 3.3): it goes on as soon as the message exists.
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
 *
 * AND IT REPLACES ITS ACTION'S OLDER ROLL (fix r2-H1, 04.10.2026; review S2-1). A row of the
 * same character and action, older and unsettled - it settled nothing yet - is marked
 * `superseded` with this roll's id as this one is written, and settles nothing from then on
 * (bridge-guards.mjs `rollRefusal`): a settlement takes the newest roll of an action. A row
 * that settled anything is left alone - its trace, its theft may follow it still - and so is
 * a roll that names no action. Palm's two rolls are two actions (`palm`, `steal`).
 */
async function keepRecord(record) {
    await rollStore.whenHydrated();
    const cutoff = record.at - TIMING.rerollWindowMinutes * 60_000;
    const rows = Object.entries(rollStore.entries());
    const old = rows.filter(([, row]) => !(row?.at >= cutoff)).map(([id]) => id);
    const replaced = record.actionKey ? rows.filter(([id, row]) => id !== record.rollId && row?.at >= cutoff && row.at <= record.at
        && row.actorId === record.actorId && row.actionKey === record.actionKey && unsettled(row)).map(([id]) => id) : [];
    if (old.length) await rollStore.dropMany(old);
    for (const id of replaced) await rollStore.patch(id, { superseded: record.rollId });
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

/*
 * A DRAWN ROLL IS THROWN AGAIN AS THE GM THREW IT (E29 C11, 05.10.2026; the stage plan's 3.7). A
 * Reroll rebuilds the roll it throws again (reroll.mjs `rollAsThrown`), and until C11 it rebuilt a
 * drawn roll from its message's roll with the record's statistic and experiences put back. Those
 * were the packet's (`trait`, `experiences` on the record are what the GM was told), and
 * Daggerheart's constructor builds the modifiers again out of the options alone - the statistic's
 * value, the experiences named, every enabled effect's roll bonus (d20Roll.mjs `configureModifiers`,
 * dhRoll.mjs `bonusEffectBuilder`, read in 2.10.5) - so, by that reading, an experience no Call
 * bought and an effect the GM clamped away at the draw (C10) came back on the Reroll, and a Call's
 * bonus or a hindering Call's -1 the GM counted was gone from it. The harness's constructor keeps the
 * formula it is given, so there the Reroll took whatever the roll it was handed added up to: at
 * C10's runtime (tier 2, "a Reroll keeps the legal modifiers, not the claim", handed the roll as its
 * class rebuilds it from the packet) a Search whose packet named an experience and added 3 more,
 * scored without both, was thrown again with both.
 * Now a drawn roll is thrown again from the record's `scored` (`legalRollOf`): the formula of the
 * same dice at the list's faces and the same numbers, the statistic and the experiences the GM
 * counted, and every other number the GM counted as a base modifier (`baseModifiers`, which
 * Daggerheart's `applyBaseBonus` starts from) with no effects for it to read again - so the
 * constructor, which drops the formula's numbers and writes its own, comes back to the GM's sum.
 * The statistic's and the experiences' values it reads come from the roll's data (dualityRoll.mjs
 * :174, d20Roll.mjs:103), which until fix r2-H3 was the character's as it stood at the Reroll - with
 * a write the audit had not put back yet, or a GM's change since the draw, in it (the round-2
 * security review's M1, by reading); the data is the record's now (`data`), holding only those
 * values. Not measured at a table (LIVE-E06-02 reads the rebuild there). The record's `scored`
 * stands for every version a Reroll writes (`keepRerolledVersion`): a Reroll changes the dice, not
 * what they are added to. Null for a roll with no `scored` - a Monokuma's, of which nothing is
 * expected, or one drawn before 1.2.68 - which `rollAsThrown` rebuilds as before.
 */
export function rollOnRecord(record) {
    const scored = record?.scored ?? null, read = record?.legal?.read ?? null;
    if (!scored || !Array.isArray(scored.modifiers) || !read?.kind) return null;
    const labelled = m => ({ label: modifierLabel(m), value: m.value });
    const roll = { advantage: Math.sign(scored.advantage), modifiers: scored.modifiers.map(labelled),
        baseModifiers: scored.modifiers.filter(m => m.key !== "trait" && m.key !== "experience").map(labelled) };
    if (scored.trait) roll.trait = TRAITS[scored.trait]?.dh ?? scored.trait;
    const counted = key => scored.modifiers.filter(m => m.key === key);
    const data = { traits: roll.trait ? { [roll.trait]: { value: counted("trait")[0]?.value ?? 0 } } : {},
        system: { experiences: Object.fromEntries(counted("experience").map(m => [m.name, { name: m.label ?? m.name, value: m.value }])) } };
    return { formula: formulaOf(termsOf(scored, read)), roll, experiences: Array.isArray(scored.experiences) ? [...scored.experiences] : [],
        critical: read.kind.critical === true, actionType: read.kind.actionType ?? null, data };
}

/*
 * A REROLL WRITES THE RECORD'S NEXT VERSION (E08+E28 C17, 04.10.2026; the plan's 3.6). The
 * Reroll is made on a GM (reroll.mjs `makeReroll`) and rewrites the roll's message in place:
 * the message keeps its id and the record its key, and until C17 the record kept the dice of
 * the draw while the message showed the Reroll's. Once a Reroll stands, the record takes the
 * new roll's dice, total and duality, and what it held goes on its `versions`, oldest first:
 * the draw itself stays `versions[0]` for as long as the record lives (D2), each later
 * Reroll's roll after it, each with the time it was thrown. `scored` is not versioned: a drawn
 * roll's Reroll is thrown from it (`rollOnRecord`, E29 C11), so it holds for every version. A packet that names the roll from
 * then on - a theft from the stash a rerolled Search found - is read on the roll that stands.
 * The record's `at` stays the draw's: the Reroll's reach is counted from the first throw. A
 * roll the GM did not draw has no record, and nothing is written; answers whether one was.
 */
const VERSIONED = Object.freeze(["dice", "total", "hope", "fear", "isCritical", "withHope", "withFear"]);

export async function keepRerolledVersion(message, roll) {
    const record = drawnRecordOf(message);
    if (!record || !roll) return false;
    const previous = Object.fromEntries(VERSIONED.map(field => [field, foundry.utils.deepClone(record[field] ?? null)]));
    previous.at = record.rerolledAt ?? record.at ?? null;
    await rollStore.patch(record.rollId, {
        dice: Array.isArray(roll.dice) ? roll.dice.map(die => ({ faces: die.faces, results: die.results.map(r => ({ result: r.result, active: r.active !== false })) })) : [],
        total: roll.total, hope: roll.dHope?.total ?? null, fear: roll.dFear?.total ?? null,
        isCritical: Boolean(roll.isCritical), withHope: Boolean(roll.withHope), withFear: Boolean(roll.withFear),
        versions: [...(Array.isArray(record.versions) ? record.versions : []), previous], rerolledAt: Date.now()
    });
    return true;
}

/* ==========================================================================
 * WITH NO GM CONNECTED (E08+E28 C18, 04.10.2026; the plan's 3.7)
 * --------------------------------------------------------------------------
 * With nobody to draw it, a player's roll had two ways to go, and the plan took both:
 *   - AN ACTION'S ROLL IS NOT MADE. The action is refused at its start, before anything is
 *     paid (action-rolls.mjs `performAction`, "an action roll waits for a GM"); a GM who
 *     leaves between the window and the draw has the roll refused here, as a closed window
 *     is, each action's own close path after it.
 *   - ANY OTHER ROLL (a statistic from the sheet, a reaction, Daggerheart's own item rolls)
 *     is thrown in this browser as in 1.2.66, its message stamped as it is created - the
 *     module's flag `unwitnessed`, `{ nonce, actorId, at }` (the plan's `flags.drpg`) - and Daggerheart's
 *     resource step skipped (`skips.resources`, dualityRoll.mjs `addDualityResourceUpdates`,
 *     read in 2.10.5): no Hope, no Stress, no Fear. Read in the same source, a player's
 *     resource write goes through Daggerheart's GM relay (actor.mjs `modifyResource`,
 *     socket.mjs `emitAsGM`), so with no GM it reached nobody before C18 either; the skip
 *     makes that a rule rather than a lost packet, and the stamp keeps what was owed.
 *     The card says so to whoever reads it (`DRPG.Rolls.unwitnessed`, the owner's Q3 (a)).
 * On a GM's return the primary posts one card to the GMs (`askAboutUnwitnessed`): each
 * stamped roll nobody has decided, its character, its dice as the player's browser threw
 * them and what they would have moved - and, since E29 C11, what it claimed beside what the GM's
 * list gives (`awayClaimOf`) -, with Grant all and Grant none. The grant is the GM's
 * (`decideUnwitnessed`): Daggerheart's own resource step on the GM, as the draw runs it
 * (`DrawnResources`, so critical.mjs's rule and Daggerheart's own gates apply), and the
 * Despair through `awardRollDespair`, whose award at the message's creation stands aside
 * for a stamped roll (despair-award.mjs). A stamp is the roller's browser's word, so a
 * forged one only asks the GM, and the dice on the card are the ones the GM is asked to
 * believe. The fallback (D1) has no seam, so on a build the draw was not written for
 * only the action's refusal at its start applies, and nothing is stamped.
 * ========================================================================== */

/** The flag a stamped roll's message carries: `{ nonce, actorId, at }`, and `granted` once a GM decided. */
export const UNWITNESSED_FLAG = "unwitnessed";
/**
 * The key the stamp's nonce rides under on the roll's config, which Daggerheart makes the
 * roll's options and the message keeps (as private-rolls.mjs `ROLL_NONCE` does): how the
 * message created for this roll is told from any other as it is created.
 */
const UNWITNESSED = "drpgUnwitnessed";
/** The stamps of the rolls this browser is throwing with no GM, by nonce, until their message is created. */
const pendingStamps = new Map();
/** This client's decisions, one after another: a second click waits for the first's marks and writes. */
let decisions = Promise.resolve();
/** How long a grant waits for its character's write to land before the next decision. Chosen, not measured. */
const GRANT_WAIT_MS = 2000;

/**
 * Is this a player's roll, with no GM connected to draw it, that will write a message? The
 * same rolls `drawsHere` asks about, but for whether a GM is there; a GM's own roll is never one.
 */
function awayFromGms(config) {
    if (game.user?.isGM || primaryGmId()) return false;
    return Boolean(config) && config.evaluate !== false && !config.skips?.createMessage && !config.source?.message;
}

/** Daggerheart's own build, with the resource step skipped and the stamp handed to the message as it is created. */
async function throwUnwitnessed(cls, original, config, message) {
    let actorId = null;
    try {
        actorId = typeof config.source?.actor === "string" ? fromUuidSync(config.source.actor)?.id ?? null : null;
    } catch {
        actorId = null;
    }
    const stamp = { nonce: foundry.utils.randomID(), actorId, at: Date.now() };
    config.skips = { ...(config.skips ?? {}), resources: true };
    config[UNWITNESSED] = stamp.nonce;
    pendingStamps.set(stamp.nonce, stamp);
    try {
        return await original.call(cls, config, message);
    } finally {
        pendingStamps.delete(stamp.nonce);
    }
}

/** `preCreateChatMessage`: the stamp written into the message of a roll thrown with no GM, as it is created. */
function stampUnwitnessed(message, data) {
    if (!pendingStamps.size) return;
    let roll = message?.rolls?.[0] ?? data?.rolls?.[0] ?? null;
    if (typeof roll === "string") {
        try { roll = JSON.parse(roll); } catch { return; }
    }
    const stamp = pendingStamps.get(roll?.options?.[UNWITNESSED] ?? "");
    if (!stamp) return;
    pendingStamps.delete(stamp.nonce);
    message.updateSource({ [`flags.${MODULE_ID}.${UNWITNESSED_FLAG}`]: { ...stamp } });
}

/**
 * A stamped roll no GM has decided, as the GMs' card lists it: the message, the character
 * the stamp names - played by the message's author, or the stamp asks nothing - the two
 * dice, and whether it was a reaction, which moves nothing. Null for anything else.
 */
function awayRowOf(message) {
    const stamp = message?.getFlag?.(MODULE_ID, UNWITNESSED_FLAG);
    if (!stamp || typeof stamp !== "object" || Object.hasOwn(stamp, "granted")) return null;
    const author = message.author ?? null;
    const actor = game.actors.get(typeof stamp.actorId === "string" ? stamp.actorId : "");
    if (!author || author.isGM || !actor || !ownsActor(author, actor.id)) return null;
    const outcome = readDuality(message);
    if (!outcome) return null;
    const dice = message.rolls?.[0] ?? null;
    return { message, actor, outcome, reaction: dice?.options?.actionType === "reaction",
        hope: dice?.dHope?.total ?? null, fear: dice?.dFear?.total ?? null };
}

/** What a stamped roll would have moved, in words: Hope, Despair, or nothing for a reaction. */
function awayMoves({ outcome, reaction }) {
    if (reaction) return game.i18n.localize("DRPG.Rolls.awayNothing");
    const moves = [];
    const hope = outcome.isCritical ? CRITICAL.hope : outcome.withHope ? 1 : 0;
    if (hope) moves.push(game.i18n.format("DRPG.Rolls.awayHope", { n: hope }));
    if (outcome.withFear) moves.push(game.i18n.localize("DRPG.Rolls.awayDespair"));
    return moves.join(", ");
}

/*
 * WHAT IT CLAIMED, BESIDE THE GM'S LIST (E29 C11, 05.10.2026; the stage plan's 3.8). A roll thrown
 * with no GM connected was not drawn, so nothing of the list was held to it: its modifier and its
 * advantage dice are its window's. The GMs' card says, for each, what it claimed and what the list
 * would have given it (`expectedFor`, read now on this GM, as a statistic from the sheet is read: the
 * statistic it names - a roll naming no action is held to none -, no experience, no Call having been
 * bought on a GM, the hindering Calls armed long enough before now, the effects' part clamped).
 * Information only: a grant moves what the dice moved, as before, and nothing is flagged or spent.
 * The claim is read off the stamped message's roll: its total less its Hope, Fear and advantage dice
 * is its modifier, so any other die its window added is counted in it.
 */
async function awayClaimOf({ message, actor }) {
    const roll = message.rolls?.[0] ?? null;
    const options = roll?.options ?? {};
    const up = roll?.dAdvantage ?? null, down = roll?.dDisadvantage ?? null;
    const flat = Number(roll?.total) - (Number(roll?.dHope?.total) || 0) - (Number(roll?.dFear?.total) || 0)
        - (Number(up?.total) || 0) + (Number(down?.total) || 0);
    if (!Number.isFinite(flat)) return null;
    const { armedCallsHeld } = await import("./sheet-audit.mjs");
    const hostile = hostileCalls(actor, [], await armedCallsHeld(actor), { claimed: false });
    const expected = await expectedFor(actor, { hostile, claimed: false, actionType: options.actionType ?? null });
    const trait = traitKeyOf(options.roll?.trait);
    const claim = { trait, traitValue: trait ? expected.sheet.traits[trait] ?? 0 : 0,
        experiences: strings(options.experiences).filter(key => Object.hasOwn(expected.sheet.experiences, key)),
        flat, advantage: (Number(up?.number) || 0) - (Number(down?.number) || 0), dice: 0 };
    const scored = scoredOf(expected, claim);
    const said = ({ flat: sum, advantage }) => [`${game.i18n.localize(FLAG_KINDS.modifier)} ${signed(sum)}`,
        ...(advantage ? [`${game.i18n.localize(FLAG_KINDS.advantage)} ${signed(advantage)}`] : [])].join(", ");
    return game.i18n.format("DRPG.Rolls.awayClaimed", { claimed: said(claim), legal: said(scored) });
}

/**
 * THE GMs' CARD. At the primary GM's `ready` (module.mjs), and on the primary for a stamped
 * message created while it is here - a roll begun as it connected, or a stamp a console wrote,
 * which only asks. Lists `messages` (every message in the log when not given) that carry a
 * stamp nobody decided; posts nothing when there is none. Answers the card, or null.
 */
export async function askAboutUnwitnessed(messages = null) {
    if (!isPrimaryGm()) return null;
    const rows = (messages ?? game.messages?.contents ?? []).map(awayRowOf).filter(Boolean);
    if (!rows.length) return null;
    const lines = (await Promise.all(rows.map(async row => {
        const claimed = await awayClaimOf(row).catch(err => {
            error("Could not read what a roll thrown with no GM claimed", err);
            return null;
        });
        return `<li>${esc(game.i18n.format("DRPG.Rolls.awayLine", {
            name: row.actor.name, hope: String(row.hope ?? "-"), fear: String(row.fear ?? "-"), moves: awayMoves(row) }))}${claimed ? ` ${esc(claimed)}` : ""}</li>`;
    }))).join("");
    return whisperToGms(`<div class="drpg-away-card"><h3>${esc(game.i18n.localize("DRPG.Rolls.awayTitle"))}</h3><ul>${lines}</ul>`
        + `<div class="drpg-away-actions"><button type="button" data-drpg-away="grant">${esc(game.i18n.localize("DRPG.Rolls.grantAll"))}</button>`
        + `<button type="button" data-drpg-away="none">${esc(game.i18n.localize("DRPG.Rolls.grantNone"))}</button></div></div>`,
    { flags: { [MODULE_ID]: { awayCard: true, awayRolls: rows.map(row => row.message.id) } } });
}

/**
 * GRANT ALL, GRANT NONE: each listed roll still undecided is marked `granted` (true or false)
 * and handed to this GM as its author, and, granted, gets what it would have moved. Handing it
 * over is what makes the mark the GMs': a message's author may rewrite its flags, and a mark
 * its roller could take off would list the roll again, to be granted again. A GM may set a
 * message's author (the harness's model of Foundry allows it; not measured at a table). The
 * mark is written before the grant, so a second card or a second click finds the roll decided,
 * and this client's decisions run one after another (`decisions`). Two GMs clicking within a
 * round trip each found the rolls undecided on their own copy and each granted them (the
 * round-2 review's m5, read in the code), so a click is decided on the primary GM since fix
 * r2-H7 (`askToDecide`): one client, one queue. GM only. Answers the rolls granted.
 */
export function decideUnwitnessed(messageIds, grant) {
    const run = decisions.then(() => decideNow(messageIds, grant));
    decisions = run.catch(() => null);
    return run;
}

/**
 * A GM's click on the GMs' card, decided on the primary GM (`roll.grant`, private-rolls.mjs
 * `ROLL_ACTIONS`; E08+E28 fix r2-H7): here when this is the primary, asked of it otherwise.
 * Answers the rolls granted, or none where nothing was decided.
 */
export async function askToDecide(messageIds, grant) {
    const res = await bridgeRequest("roll.grant", { messageIds, grant: grant === true }, {
        settle: "reply", onPrimary: true, local: () => decideUnwitnessed(messageIds, grant) });
    return res.ok && Array.isArray(res.value) ? res.value : [];
}

async function decideNow(messageIds, grant) {
    if (!game.user?.isGM) return [];
    const granted = [];
    for (const id of new Set((Array.isArray(messageIds) ? messageIds : []).filter(id => typeof id === "string"))) {
        const row = awayRowOf(game.messages.get(id));
        if (!row) continue;
        try {
            await row.message.update({ author: game.user.id, [`flags.${MODULE_ID}.${UNWITNESSED_FLAG}.granted`]: grant === true });
            if (grant === true) granted.push(row);
        } catch (err) {
            error("Could not decide a roll thrown with no GM connected", err);
        }
    }
    try {
        await grantRolls(granted);
    } catch (err) {
        error("Could not grant the rolls thrown with no GM connected", err);
    }
    return granted.map(row => ({ messageId: row.message.id, actorId: row.actor.id }));
}

/**
 * What the rolls would have moved, moved now on this GM: Daggerheart's resource step for each
 * (`addDualityResourceUpdates`, critical.mjs's top-up and Daggerheart's own gates - the Hope and
 * Fear automation, a dead or defeated character - with it), summed into one map per character
 * and written once, and each roll's Despair to its Monokuma. A reaction moves nothing.
 *
 * ONE WRITE PER CHARACTER, AND WAITED FOR. Daggerheart's `modifyResource` adds to the value it
 * holds and returns before its write lands (actor.mjs, 2.10.5), so a grant per roll lost all but
 * one of a character's: the first build of the suite's "Grant all grants each stamped roll once"
 * granted a 9-4 and a 7-7 from Hope 0 and read 2, not 3 (04.10.2026, e08run/c18a1). The next
 * decision waits for the write's `updateActor`, or `GRANT_WAIT_MS` - chosen, not measured -
 * where none comes (a value already at its bound writes nothing).
 */
async function grantRolls(rows) {
    const cls = game.system?.api?.dice?.DualityRoll;
    const maps = new Map();
    for (const { message, actor, outcome, reaction } of rows) {
        if (reaction) continue;
        if (!maps.has(actor.id)) maps.set(actor.id, new DrawnResources(actor));
        const config = {
            source: { actor: actor.uuid }, actionType: message.rolls?.[0]?.options?.actionType ?? "action", skips: {},
            roll: { isCritical: outcome.isCritical, result: { duality: outcome.withHope ? 1 : outcome.withFear ? -1 : 0 } },
            resourceUpdates: maps.get(actor.id)
        };
        if (typeof cls?.addDualityResourceUpdates === "function") await cls.addDualityResourceUpdates(config);
    }
    for (const [actorId, map] of maps) {
        if (!map.size) continue;
        const actor = game.actors.get(actorId);
        const target = actor?.system?.partner ?? actor;
        let heard = null;
        const landed = new Promise(resolve => { heard = resolve; });
        const hook = Hooks.on("updateActor", doc => { if (doc?.id === target?.id) heard(); });
        try {
            await map.updateResources();
            await Promise.race([landed, new Promise(resolve => setTimeout(resolve, GRANT_WAIT_MS))]);
        } finally {
            Hooks.off("updateActor", hook);
        }
    }
    for (const { actor, outcome, reaction } of rows) {
        if (!reaction && outcome.withFear) await awardRollDespair(actor, 1);
    }
}

/** The stamp's line on the roll's card, and the GMs' card's two buttons, wired on a GM. */
function onRenderUnwitnessed(message, element) {
    try {
        const body = element.querySelector(".message-content") ?? element;
        if (message.getFlag?.(MODULE_ID, UNWITNESSED_FLAG) && !body.querySelector(".drpg-unwitnessed")) {
            body.insertAdjacentHTML("beforeend", `<p class="drpg-warning drpg-unwitnessed">${esc(game.i18n.localize("DRPG.Rolls.unwitnessed"))}</p>`);
        }
        // A GM's card only: a player's card to the GMs may carry any buttons it likes - one a GM posted
        // for a player in an incident included (secret.mjs `cardWriter`, E08+E28 fix r2-H5).
        if (!game.user?.isGM || !cardWriter(message)?.isGM || !cardFlag(message, "awayCard")) return;
        const ids = cardFlag(message, "awayRolls");
        const open = Array.isArray(ids) && ids.some(id => awayRowOf(game.messages.get(id)));
        if (!open) return void element.querySelector(".drpg-away-actions")?.remove();
        element.addEventListener("click", async event => {
            const button = event.target?.closest?.("[data-drpg-away]");
            if (!button) return;
            event.preventDefault();
            element.querySelector(".drpg-away-actions")?.remove();
            await askToDecide(ids, button.dataset.drpgAway === "grant");
        });
    } catch (err) {
        error("Could not draw a roll thrown with no GM connected", err);
    }
}

/** At `setup`, beside the draw: the stamp as a message is created, its line and the GMs' card as one is drawn. */
export function registerUnwitnessedRolls() {
    Hooks.on("preCreateChatMessage", stampUnwitnessed);
    Hooks.on("renderChatMessageHTML", onRenderUnwitnessed);
    Hooks.on("createChatMessage", message => {
        if (!isPrimaryGm() || !awayRowOf(message)) return;
        askAboutUnwitnessed([message]).catch(err => error("Could not ask the GMs about a roll thrown with no GM connected", err));
    });
}
