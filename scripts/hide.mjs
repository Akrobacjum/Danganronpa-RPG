/**
 * Danganronpa RPG - Hide, a row of the Infiltrate tile: a character out of everyone's sight and silent until they show.
 * ---------------------------------------------------------------------------
 * S0-HIDE (E129, 23.11.2026; the owner: "Dodajmy nowa akcje (w infiltrate) "schowaj sie". Udany rzut na shadow chowa
 * calkowicie token gracza i wycisza go, dopoki nie kliknie ujawnij sie na panelu livekit. Schowanie sie sprawia tez ze
 * gracz nie musi rzucac na shadow przy akcjach ktore tego wymagaja jako jednego z dwoch rzutow. Gracz widzi swoj token
 * wtedy z nizszym opacity, inni gracze wcale (lacznie z ramka)"). The coordinator's defaults of that day, each a constant
 * or one rule below, are put to the owner.
 *
 *   - THE ROLL. One action and Shadow at `INFILTRATE.hide.dc`, drawn on the primary GM; then `hide.start`, which the
 *     primary judges off the GMs' record of the roll (bridge-runs-acts.mjs `handleHideStart`). A hit or a critical hides;
 *     a miss hides nothing and the action is spent. A critical adds nothing but Daggerheart's own critical Hope.
 *   - HOW. As the opening's veil does (mask-gm.mjs, E112v road (b)): the primary writes one flag, `hiding`, on each of
 *     the character's tokens - none on a trial hall's (`flaggable`), where the Class Trial seats everyone - and no
 *     Foundry `hidden`, which on v14 takes the owner's own vision (LIVE-E112-01). The flag says that the token is hidden
 *     and nothing about whose it is. visibility.mjs `tokenShownTo` hides it on every player's browser but its owners',
 *     a Spectator's too (the owner's "inni gracze wcale"), and with it the frame (own-ring.mjs draws none on a token not
 *     drawn), the bars, the name and the ruler; its owner draws it at `INFILTRATE.hide.ownAlpha`, a GM as a GM's hidden
 *     token (`hidingAlpha`). The GMs keep a row per character in the store `hides` (gm-stores.mjs `hideStore`).
 *   - THE VOICE. The microphone is held by the trial's block with one more reason (voice.mjs `micHold` "hiding",
 *     `settleTrialVoices` with `hideMutedIds`), outside a Class Trial; the room is still heard. Another player's voice
 *     tile neither lists nor counts the hidden player: the veil's predicate (mask-gm.mjs `veilHidesHere`) answers for a
 *     hiding token as for a veiled one, and so do the pickers that read it (`seenHere`). Their own tile keeps a Reveal
 *     yourself button (voice-tile.mjs `paintUnhide`), which asks the primary (`mask.reveal` with `of: "hide"`).
 *   - THE COVERS. While hidden, a Shadow roll that is one of an action's two rolls - Palm's and a Frisk's unseen, Tail's
 *     unseen, Pick the Lock's cover, a Take's cover, the concealments of a Sabotage, an indirect murder's work and a
 *     clean-up - is not thrown (`coverWhileHidden`): it counts as passed, at `INFILTRATE.hide.coverTotal`, and its card
 *     says so. It earns no Hope (the owner's answer of 23.11.2026). Where the GM reads that roll off its record, the
 *     declaration's roll is marked `cover` and the GM takes the pass only while it holds the hider's row (bridge-guards.mjs
 *     `rollsFor`), so a packet that claims it otherwise names a roll as before.
 *   - WHEN IT ENDS. Reveal yourself, a GM's reveal (`game.drpg.unhide(actor)`, and the GM's voice list), the chapter's end
 *     (a clock whose chapter is not the row's) and the season's reset (the store's "actions" group; the flags a cut row
 *     leaves are swept, `settleHides`); and the character's death, at the primary's next settle (`drpgDeathsChanged`).
 *     Not at a new time of day, a move or another action.
 *   - NOT OFFERED in a Class Trial (`hideShutWhy`), nor again while hidden. Observe and Search find nobody hidden in this
 *     release: a hidden character is left out of every picker this browser builds (`seenHere`).
 *
 * THE MASK AND THE HIDE ARE TWO THINGS. A killer behind a "?" (mask-gm.mjs) who hides keeps both: the mask's flag and the
 * hide's, each ended by its own road - the mask at the next time of day or its reveal, the hide by its own Reveal yourself
 * (a second button, beside the mask's) - and neither reads the other. While both stand the token is not drawn for other
 * players at all (the hide's branch is asked first), the mask's silent room still holds the voice, and once the mask ends
 * the hide stands on.
 *
 * WHAT IT CANNOT HIDE (Foundry's limit, the known leak `foundry-hiding-token-actor`, as the veil's): a token's flags reach
 * every browser, and every browser that hides the token has to know which one to hide, so a console lists the token
 * carrying the flag and reads by its `actorId` whose it is.
 */

import { INFILTRATE, MODULE_ID } from "./config.mjs";
import { getClock, SETTINGS } from "./settings.mjs";
import { isPrimaryGm, log, error, whisperToOwnerOnly, esc, forcedDeletion } from "./utils.mjs";
import { hideStore } from "./gm-stores.mjs";

/** The token flag that marks a hidden character's token. It says the token is hidden, never whose it is. */
export const HIDE_FLAG = "hiding";

/** Foundry's own alpha for a GM's hidden token on a GM's canvas (Token#_getTargetAlpha: `hidden` draws at 0.5). */
export const GM_HIDDEN_ALPHA = 0.5;

/** Whether a token is hidden by Hide, by its one flag (every browser reads it: it says nothing of whose it is). Pure. */
export function isHidingToken(token) {
    return Boolean((token?.flags ?? token?._source?.flags)?.[MODULE_ID]?.[HIDE_FLAG]);
}

/** The patch that hides a token - the one flag, no `hidden` - and the one that shows it again (`gone`, a deletion). Pure. */
export function hidePatch() {
    return { [`flags.${MODULE_ID}.${HIDE_FLAG}`]: true };
}
export function unhidePatch(gone = null) {
    return { [`flags.${MODULE_ID}.${HIDE_FLAG}`]: gone ?? false };
}

/**
 * The alpha a hiding token is drawn at on a browser, or null for none of the hide's: `ownAlpha` for its owner, Foundry's
 * hidden alpha for a GM; another player's browser does not draw it (`tokenShownTo` "hide"). Pure (R8902).
 */
export function hidingAlpha(tokenDoc, { gm = false, owns = false } = {}) {
    if (!isHidingToken(tokenDoc)) return null;
    if (gm) return GM_HIDDEN_ALPHA;
    return owns ? INFILTRATE.hide.ownAlpha : null;
}

/** Whether `actor` hides now, read off the tokens every browser holds: one of its tokens carries the flag. */
export function isHidingActor(actor, { scenes = game.scenes } = {}) {
    if (!actor) return false;
    for (const scene of scenes ?? []) for (const token of scene?.tokens ?? []) if (token.actorId === actor.id && isHidingToken(token)) return true;
    return false;
}

/** This player's own character that hides now, off its own token's flag, or null; never on a GM's browser. */
export function myHiding(user = game.user, { scenes = game.scenes } = {}) {
    if (!user || user.isGM) return null;
    for (const scene of scenes ?? []) for (const token of scene?.tokens ?? []) {
        if (isHidingToken(token) && token.actor?.testUserPermission?.(user, "OWNER")) return token.actor;
    }
    return null;
}

/**
 * THE SKIPPED COVER (the owner's "nie musi rzucac na shadow przy akcjach ktore tego wymagaja jako jednego z dwoch
 * rzutow"): while `actor` hides, the roll an action's cover would throw is not thrown, and this stands in its place -
 * passed at `coverTotal`, never a critical, no Hope - with `hidden` for the card's line (`coverLine`). Null while it does
 * not hide, and the caller throws its roll. Read off the tokens this browser holds, as the rest of the table does; the GM
 * holds a declaration's cover to its own row (bridge-guards.mjs `rollsFor`). Pure but for the tokens (R8903).
 */
export function coverWhileHidden(actor, { scenes = game.scenes, clock = getClock() } = {}) {
    // Not in a Class Trial (TRIAL's S0-PALM opens Palm there, 1.2.128): the trial seats everyone, so a hide stands aside
    // there as the microphone's block does, and the cover is thrown.
    if (clock?.phase === "classTrial") return null;
    return isHidingActor(actor, { scenes }) ? HIDDEN_COVER : null;
}

/** A cover not thrown while hidden: passed at `coverTotal`, never a critical, no Hope; the GM's stand-in record too. */
export const HIDDEN_COVER = Object.freeze({ total: INFILTRATE.hide.coverTotal, isCritical: false, withHope: true, hidden: true, messageId: null });

/** The line a card adds for a cover not thrown while hidden, or "" for a cover that was. */
export function coverLine(cover) {
    return cover?.hidden ? `<p>${esc(game.i18n.localize("DRPG.Hide.coverSkipped"))}</p>` : "";
}

/** A card's plain sentence with the line of a cover not thrown while hidden after it, else as it was (Palm's, a Frisk's). */
export function withCover(text, cover) {
    return cover?.hidden ? [text, game.i18n.localize("DRPG.Hide.coverSkipped")].filter(Boolean).join(" ") : text;
}

/** The users whose microphone a hide holds blocked: every hidden character's owners as its row names them. On a GM. */
export function hideMutedIds() {
    const ids = new Set();
    for (const row of Object.values(hideStore.entries() ?? {})) for (const id of row?.userIds ?? []) ids.add(id);
    return ids;
}

/** Whether the GMs hold `actorId` hidden (its row in `hides`). On a GM; what bridge-guards.mjs asks of a skipped cover. */
export function hiddenOnGm(actorId, { clock = getClock() } = {}) {
    return Boolean(game.user?.isGM && actorId && clock?.phase !== "classTrial" && hideStore.get(actorId));
}

/** Why the Hide row is shut on this browser now, or null: a Class Trial, or this character hides already. */
export function hideShutWhy(actor, { clock = getClock(), scenes = game.scenes } = {}) {
    if (clock?.phase === "classTrial") return game.i18n.localize("DRPG.Hide.notInTrial");
    if (isHidingActor(actor, { scenes })) return game.i18n.localize("DRPG.Hide.already");
    return null;
}

/* ------------------------------ the player's half ------------------------------ */

/** Hide: the action, the Shadow roll, the ask. Answers `{ hidden, roll }` or null. */
export async function performHide(actor, options = {}) {
    const { gmOnline, sayNotDone } = await import("./bridge-guards.mjs");
    if (!gmOnline()) {
        sayNotDone("hide.start", "noGm", { nothingSpent: true });
        return null;
    }
    const why = hideShutWhy(actor);
    if (why) {
        ui.notifications.warn(why);
        return null;
    }
    const { spendAction } = await import("./actions.mjs");
    const { rollTrait, rollInHand, abort, canAfford } = await import("./action-pipeline.mjs");
    const rule = INFILTRATE.hide;
    const cost = options.free ? 0 : rule.cost;
    if (!canAfford(actor, cost)) return null;
    const paid = cost > 0 ? await spendAction(actor, cost) : null;
    if (cost > 0 && !paid) return null;
    const title = game.i18n.localize("DRPG.Infiltrate.row.hide.label");
    const roll = await rollTrait(actor, rule.traits[0], { actionKey: "hide", title, dc: rule.dc });
    if (!roll) return abort(actor, paid);
    const { requestHideStart } = await import("./bridge-asks.mjs");
    const res = await requestHideStart({ actorId: actor.id, total: roll.total, isCritical: Boolean(roll.isCritical),
        rollId: rollInHand(actor)?.messageId ?? null });
    if (!res.ok || res.value?.refused) return null;
    const hidden = res.value?.hidden === true;
    const { rollResultCard } = await import("./action-report.mjs");
    const { whisperToOwner } = await import("./utils.mjs");
    await whisperToOwner(actor, ...rollResultCard(title, roll,
        `<p>${esc(game.i18n.localize(hidden ? "DRPG.Hide.hidden" : "DRPG.Hide.notHidden"))}</p>`));
    return { hidden, roll };
}

/** Reveal yourself (the voice tile's button): the primary GM ends the hide (`mask.reveal`, `of: "hide"`). */
export async function requestUnhide(actor = myHiding()) {
    if (!actor) return false;
    const { requestMaskReveal } = await import("./bridge-asks.mjs");
    const res = await requestMaskReveal({ actorId: actor.id, of: "hide" });
    return Boolean(res.ok);
}

/* ------------------------------ the GMs' half ------------------------------ */

const ownersOf = actor => (game.users ?? []).filter(u => !u.isGM && actor?.testUserPermission?.(u, "OWNER")).map(u => u.id);

/** Whether a token of a hidden character on `scene` carries the flag: every token but a trial hall's (the trial seats
 *  everyone). `isTrial` is the suite's (R8903); else rooms.mjs `isTrialScene`. */
export async function flaggable(scene, isTrial = null) {
    const trial = isTrial ?? (await import("./rooms.mjs")).isTrialScene;
    return !trial(scene);
}

/** The microphone block settled on the primary (voice.mjs `settleTrialVoices`, which reads `hideMutedIds`). */
async function settleBlock() {
    if (!isPrimaryGm()) return null;
    const { settleTrialVoices } = await import("./voice.mjs");
    return settleTrialVoices();
}

/** Why `actor` may not hide now, as the GMs read it, or null. English: the bridge maps it to a code. */
export async function hideRefusal(actor) {
    const { isDeadForGm } = await import("./settings.mjs");
    const { gmPlaceOf } = await import("./movement.mjs");
    if (!gmPlaceOf(actor)?.room) return "the character is not standing in any room";
    if (isDeadForGm(actor) || getClock()?.phase === "classTrial") return "that cannot be done now";
    if (hideStore.get(actor.id)) return "that cannot be done now";
    return null;
}

/**
 * Hide `actor` on the primary GM (the run of `hide.start`), the Shadow roll's `total` and `isCritical` the GMs' record of
 * it. Answers `{ refused }` or `{ hidden }`.
 */
export async function startHide({ actor, total = 0, isCritical = false, userId = null }) {
    await hideStore.whenHydrated();
    const why = await hideRefusal(actor);
    if (why) return { refused: why };
    const hidden = Boolean(isCritical) || (Number(total) || 0) >= INFILTRATE.hide.dc;
    if (!hidden) {
        log(`${actor.name} does not manage to hide (${Number(total) || 0}).`);
        return { hidden: false };
    }
    await hideStore.patch(actor.id, { actorId: actor.id, userIds: ownersOf(actor), chapter: getClock()?.chapter ?? null,
        total: Number(total) || 0, critical: Boolean(isCritical), userId, at: Date.now() });
    // The microphone first, then the token, as the veil does: nobody hears a character from a token nobody sees.
    await settleBlock();
    await flagTokens(actor);
    log(`${actor.name} hides (${Number(total) || 0}${isCritical ? ", a critical" : ""}).`);
    return { hidden: true };
}

/** Each token of `actor` that may carry the flag and does not, flagged. Answers how many it wrote. */
async function flagTokens(actor) {
    if (!game.user?.isGM) return 0;
    let n = 0;
    for (const scene of game.scenes ?? []) {
        if (!(await flaggable(scene))) continue;
        for (const token of scene.tokens ?? []) {
            if (token.actorId !== actor.id || isHidingToken(token)) continue;
            await token.update(hidePatch()).catch(err => error(`Could not hide a token of ${actor.name}`, err));
            n += 1;
        }
    }
    return n;
}

/** Every token of `actorId` (or, with none, every token whose character no row holds) shown again. Answers how many. */
async function unflagTokens(actorId = null) {
    if (!game.user?.isGM) return 0;
    let n = 0;
    for (const scene of game.scenes ?? []) for (const token of scene.tokens ?? []) {
        if (!isHidingToken(token)) continue;
        if (actorId ? token.actorId !== actorId : hideStore.get(token.actorId ?? "")) continue;
        await token.update(unhidePatch(forcedDeletion())).catch(err => error("Could not show a hidden token again", err));
        n += 1;
    }
    return n;
}

/**
 * End `actorId`'s hide on the primary, `why` "reveal" (their own press), "gm", "chapter" or "reset": the row dropped, the
 * flag off every token, the block lifted. A hide ended by anyone but its owner is told to them in one line. Answers
 * `{ ended }` or `{ refused }`.
 */
export async function endHide(actorId, why = "reveal") {
    if (!game.user?.isGM) return { refused: "only a GM can carry that out" };
    await hideStore.whenHydrated();
    const row = hideStore.get(actorId ?? "");
    if (!row) return { refused: "nothing was carried out: that character is not hidden" };
    await hideStore.drop(actorId);
    await unflagTokens(actorId);
    await settleBlock();
    const actor = game.actors.get(actorId);
    if (actor && why !== "reveal") {
        await whisperToOwnerOnly(actor, { glyph: "ACTIONS.listen", body: `<p>${esc(game.i18n.localize(`DRPG.Hide.ended.${why}`))}</p>` },
            { veiled: true }).catch(err => error("Could not tell a hidden character their hide ended", err));
    }
    log(`${actor?.name ?? actorId} is no longer hidden (${why}).`);
    return { ended: true };
}

/** The GM's reveal (`game.drpg.unhide(actor)`, the GM's voice list): on the primary, else asked of it. */
export async function gmUnhide(actorOrId) {
    if (!game.user?.isGM) return false;
    const actorId = typeof actorOrId === "string" ? actorOrId : actorOrId?.id;
    if (!actorId) return false;
    if (isPrimaryGm()) return Boolean((await endHide(actorId, "gm")).ended);
    const { requestMaskReveal } = await import("./bridge-asks.mjs");
    return Boolean((await requestMaskReveal({ actorId, of: "hide" })).ok);
}

/** The hidden characters as a GM's voice list names them: `[{ actorId, name }]`, from the GMs' rows. */
export function hiddenUnderWay() {
    if (!game.user?.isGM) return [];
    return Object.values(hideStore.entries() ?? {}).filter(row => row?.actorId)
        .map(row => ({ actorId: row.actorId, name: game.actors?.get?.(row.actorId)?.name ?? "?" }));
}

let settling = Promise.resolve();

/**
 * THE HIDES SETTLED, ON THE PRIMARY: a row of another chapter ended ("chapter"), a token made since the hide began
 * flagged, and a flag no row holds - a season's reset cuts the rows and leaves the tokens - taken off. One settle at a
 * time, in the order asked. Answers `{ ended, flagged, swept }` on the primary, else null.
 */
export function settleHides() {
    const run = () => settleHidesNow();
    const next = settling.then(run, run);
    settling = next.catch(() => null);
    return next;
}

async function settleHidesNow() {
    if (!game.user?.isGM || !isPrimaryGm()) return null;
    await hideStore.whenHydrated();
    const chapter = getClock()?.chapter ?? null;
    const out = { ended: [], flagged: 0, swept: 0 };
    const { isDeadForGm } = await import("./settings.mjs");
    for (const [actorId, row] of Object.entries(hideStore.entries() ?? {})) {
        if (!row?.actorId || !game.actors.get(actorId)) continue;
        // A hidden character who dies is hidden no more (COMM's note of 23.11.2026): their player's microphone goes back to
        // the dead's rules, and the token is drawn as any dead student's. No card: the death says it.
        if (isDeadForGm(game.actors.get(actorId))) {
            if ((await endHide(actorId, "reveal")).ended) out.ended.push(actorId);
            continue;
        }
        if (row.chapter !== null && row.chapter !== undefined && row.chapter !== chapter) {
            if ((await endHide(actorId, "chapter")).ended) out.ended.push(actorId);
            continue;
        }
        out.flagged += await flagTokens(game.actors.get(actorId));
    }
    out.swept = await unflagTokens(null);
    if (out.swept) await settleBlock();
    return out;
}

/* What this browser last saw of its own hide (an actor id, or null), so a redraw that changes nothing is quiet. */
let ownHideSeen = null;

/** This player's own hide went up or came down on a token's redraw: the voice tile repaints (`drpgHideChanged`). */
function noticeOwnHide() {
    const mine = myHiding()?.id ?? null;
    if (mine === ownHideSeen) return;
    ownHideSeen = mine;
    Hooks.callAll("drpgHideChanged");
}

/** At ready: the primary's settle at its ready, at every clock write and for a token made; a player's own redraws. */
export function registerHides() {
    const settle = () => { if (isPrimaryGm()) settleHides().catch(err => error("The hides could not be settled", err)); };
    Hooks.once("ready", settle);
    Hooks.on("updateSetting", setting => { if (setting?.key === `${MODULE_ID}.${SETTINGS.clock}`) settle(); });
    Hooks.on("userConnected", (user, connected) => { if (!connected && user?.isGM) settle(); });
    Hooks.on("createToken", () => settle());
    Hooks.on("drpgDeathsChanged", () => settle());
    if (game.user?.isGM) return;
    Hooks.on("updateToken", doc => { if (doc?.isOwner) noticeOwnHide(); });
    Hooks.once("ready", noticeOwnHide);
}
