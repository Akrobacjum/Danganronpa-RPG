/**
 * Danganronpa RPG - the murder's privacy: the killer behind a "?".
 * ---------------------------------------------------------------------------
 * E69 C8, 13.11.2026 (the owner's 10.11 (c), the plan's C8; built for 1.2.113 by the owner's decision of 13.11 that every
 * change from the audit goes in it, which the coordinator read as overriding Q-E69-4's default). A direct murder whose
 * opening roll succeeds with Hope, or is a critical (`opensMask`), hides its killer until they reveal themselves or the
 * time of day ends:
 *
 *   - THE "?" TOKEN. The primary GM rewrites the killer's tokens on every place scene (`maskPatch`): the name "?", the
 *     texture Foundry's mystery man, no ring, no name or bars drawn, and one flag, `masked: true`, which says that this
 *     token is hidden and nothing about whose it is. What it looked like is kept in the GMs' store `masks` alone
 *     (gm-stores.mjs `maskStore`), never in a flag or a world setting, and written back at the end (`restorePatch`).
 *     A GM's browser, and a Spectator's (the coordinator's default: a Spectator sees through it, as it sees secret
 *     projects), draws the character's own name over the "?" (`drawMaskName`), from the documents it already holds.
 *   - THE VOICE. The killer is sent to a silent room of their own (voice.mjs `maskedRow`; the coordinator's answer of
 *     13.11: a name in the victim's voice list would defeat the mask), so they neither speak to the room nor hear it and
 *     no list there names them; and their account is blocked by C6's block with one more reason (`settleTrialVoices`,
 *     `maskMutedIds`), given back exactly as found. The owner may revise the silent room (LIVE-E69-05).
 *   - THE CAST. Every copy but the killers' holds `killerId` and `killerTurnId` null while the mask stands (incident-store.mjs
 *     `castCopyFor`, the rule a trap's victim already had); the victim's first whisper says "someone" (murder-rules.mjs).
 *   - THE SHEET. Another player's browser closes the sheet of a character whose token is masked (anonymity.mjs), read
 *     off the token it already holds.
 *   - THE QUESTION. The killer's owners are asked whether to reveal themselves (`askReveal`, on their own browser, read off
 *     their own masked token), and the voice tile keeps a Reveal yourself button while the mask stands. The answer is the
 *     bridge road `mask.reveal`.
 *
 * WHEN IT ENDS: the reveal, or a new time of day (`drpgTimeOfDayChanged`), whichever comes first; the season's reset cuts
 * the store. The incident's own end does not end it (a default, docs/dev/e69/STATUS.md).
 *
 * WHAT IT CANNOT HIDE (Foundry's limit, recorded by 30-security's note): a token document keeps its `actorId`, so a
 * console can still read `game.actors.get(token.actorId).name` (it needs a console, not the interface). LIVE-E69-05 reads it at a
 * table.
 */

import { MODULE_ID } from "./config.mjs";
import { isPrimaryGm, log, error, whisperToOwnerOnly, esc } from "./utils.mjs";
import { maskStore } from "./gm-stores.mjs";

/** The name a masked token wears, and its picture (Foundry's own, served by every install). */
export const MASK_NAME = "?";
export const MASK_IMG = "icons/svg/mystery-man.svg";
/** The token flag that marks a masked token. It says the token is hidden, never whose it is. */
export const MASK_FLAG = "masked";
/** Foundry's "never" for a token's name and bars (CONST.TOKEN_DISPLAY_MODES.NONE). */
const DISPLAY_NONE = 0;

/** The time of day a mask is counted in: the clock's chapter, day and time of day. */
const markNow = async () => (await import("./eavesdrop-gm.mjs")).markNow();

/**
 * Whether an opening opens a mask (the owner's 10.11 (c): "an opening at or above the threshold with Hope, or a
 * critical"): a direct murder, not self-inflicted, that succeeded on Hope or a critical. Pure (R6027).
 */
export function opensMask({ success = false, band = null, indirect = false, selfInflicted = false } = {}) {
    return Boolean(success && !indirect && !selfInflicted && (band === "hope" || band === "critical"));
}

/** A token's look as it stands, from its source: what `restorePatch` writes back. Pure (R6029). */
export function lookOf(token) {
    const src = token?._source ?? token ?? {};
    return { name: src.name ?? "", src: src.texture?.src ?? null, ring: src.ring?.enabled === undefined ? null : Boolean(src.ring.enabled),
        displayName: src.displayName ?? null, displayBars: src.displayBars ?? null };
}

/** The patch that masks a token. Pure (R6029). */
export function maskPatch() {
    return { name: MASK_NAME, "texture.src": MASK_IMG, "ring.enabled": false, displayName: DISPLAY_NONE, displayBars: DISPLAY_NONE,
        [`flags.${MODULE_ID}.${MASK_FLAG}`]: true };
}

/** The patch that puts a token's kept look back, the flag taken off. Pure (R6029). */
export function restorePatch(look, gone = null) {
    // A field the token's source did not hold (a document written without it) is taken off again, not set to the mask's.
    const patch = { name: look.name, "texture.src": look.src };
    if (look.ring !== null) patch["ring.enabled"] = look.ring;
    else if (gone !== null) patch.ring = gone;
    for (const field of ["displayName", "displayBars"]) {
        if (look[field] !== null) patch[field] = look[field];
        else if (gone !== null) patch[field] = gone;
    }
    patch[`flags.${MODULE_ID}.${MASK_FLAG}`] = gone ?? false;
    return patch;
}

/** Whether a token is masked, by its one flag (every browser reads it: it says nothing of whose it is). */
export function isMaskedToken(token) {
    return Boolean((token?.flags ?? token?._source?.flags)?.[MODULE_ID]?.[MASK_FLAG]);
}

/** Whether `actor` stands behind a "?" now: a token of it on any scene is masked. */
export function isMaskedActor(actor) {
    if (!actor) return false;
    for (const scene of game.scenes ?? []) for (const token of scene.tokens ?? []) if (token.actorId === actor.id && isMaskedToken(token)) return true;
    return false;
}

/** This browser's own masked character, read off the tokens it holds (a player's), or null. */
export function myMask(user = game.user) {
    if (!user || user.isGM) return null;
    for (const scene of game.scenes ?? []) for (const token of scene.tokens ?? []) {
        if (isMaskedToken(token) && token.actor?.testUserPermission?.(user, "OWNER")) return token.actor;
    }
    return null;
}

/** The users whose microphone a mask holds blocked: every masked killer's owners as the row names them. */
export function maskMutedIds() {
    const ids = new Set();
    for (const row of Object.values(maskStore.entries() ?? {})) for (const id of row?.userIds ?? []) ids.add(id);
    return ids;
}

/** Whether `killerId`'s mask stands, on a GM. */
export function maskStands(killerId) {
    return Boolean(killerId && maskStore.get(killerId));
}

/** The players (no GM) who own `actor`. */
const ownersOf = actor => (game.users ?? []).filter(u => !u.isGM && actor?.testUserPermission?.(u, "OWNER")).map(u => u.id);

/** The killer's tokens on every scene, each `{ scene, token }`. */
function tokensOf(actor) {
    const out = [];
    for (const scene of game.scenes ?? []) for (const token of scene.tokens ?? []) if (token.actorId === actor.id) out.push({ scene, token });
    return out;
}

/**
 * Hide `state`'s killer behind a "?" (on the primary GM, after the opening's stage is written). Answers whether it did.
 * A mask already standing for that killer is kept as it is.
 */
export async function maskKiller(state) {
    if (!game.user?.isGM || !isPrimaryGm()) return false;
    const killer = game.actors.get(state?.killerId ?? "");
    if (!killer) return false;
    await maskStore.whenHydrated();
    if (maskStore.get(killer.id)) return false;
    const tokens = tokensOf(killer).map(({ scene, token }) => ({ sceneId: scene.id, tokenId: token.id, look: lookOf(token) }));
    await maskStore.patch(killer.id, { killerId: killer.id, victimId: state.victimId ?? null, userIds: ownersOf(killer),
        mark: await markNow(), tokens, at: Date.now() });
    // The voice first, then the face: the killer goes to a silent room of their own (voice.mjs `maskedRow`) and their
    // microphone is blocked, before anybody sees the "?".
    await settleBlock();
    await placeVoicesNow();
    for (const { scene, token } of tokensOf(killer)) await token.update(maskPatch()).catch(err => error(`Could not mask a token of ${killer.name}`, err));
    await retell();
    // Veiled (E43's season canary, 14.11.2026): its document names no speaker and no reader, so it does not say whose mask
    // it is. In an incident postSecret veils it anyway (secret.mjs `incidentVeils`); the end's card below needs it always.
    await whisperToOwnerOnly(killer, { glyph: "ACTIONS.listen", body: `<p>${esc(game.i18n.localize("DRPG.Mask.card"))}</p>` }, { veiled: true });
    log(`${killer.name} hides behind a "?" until they reveal themselves or the time of day ends.`);
    return true;
}

/** End `killerId`'s mask (`why` for the log): every token's look put back, the block lifted, the cast sent again. */
export async function endMask(killerId, why = "end") {
    if (!game.user?.isGM) return false;
    const row = maskStore.get(killerId);
    if (!row) return false;
    await maskStore.drop(killerId);
    const { forcedDeletion } = await import("./utils.mjs");
    for (const { sceneId, tokenId, look } of row.tokens ?? []) {
        const token = game.scenes.get(sceneId)?.tokens?.find(t => t.id === tokenId);
        if (!token || !look) continue;
        await token.update(restorePatch(look, forcedDeletion())).catch(err => error("Could not give a masked token its look back", err));
    }
    await settleBlock();
    await placeVoicesNow();
    await retell();
    const killer = game.actors.get(killerId);
    /* VEILED (E43's season canary, 14.11.2026; FINDINGS E43-F10). A mask ends at a new time of day, often after its
       incident closed, when postSecret no longer veils by itself (secret.mjs `incidentVeils`): this card went out spoken
       by the killer and addressed to the killer's player, and every browser holds every chat document - 72's "chapter
       end" read Chie's actor id, name and p3's user id on p1 and p2, the Blackened of a verdict that missed her. */
    if (why === "timeOfDay" && killer) await whisperToOwnerOnly(killer, { glyph: "ACTIONS.listen", body: `<p>${esc(game.i18n.localize("DRPG.Mask.ended"))}</p>` }, { veiled: true });
    log(`${killer?.name ?? killerId} is no longer behind a "?" (${why}).`);
    return true;
}

/** A new time of day: every mask ends. Answers how many. */
export async function masksAtNewTimeOfDay() {
    if (!isPrimaryGm()) return 0;
    let n = 0;
    for (const killerId of Object.keys(maskStore.entries() ?? {})) if (await endMask(killerId, "timeOfDay")) n++;
    return n;
}

/** The reveal (the run of `mask.reveal`): the sender's character's mask ended. */
export async function revealMask(actorId) {
    if (!maskStore.get(actorId)) return { refused: "nothing was carried out: that character is not hidden" };
    await endMask(actorId, "reveal");
    return { revealed: true };
}

async function settleBlock() {
    if (!isPrimaryGm()) return null;
    const { settleTrialVoices } = await import("./voice.mjs");
    return settleTrialVoices();
}

/** The voice pass at once, on the primary (voice.mjs `scheduleReconcile`). */
async function placeVoicesNow() {
    try {
        (await import("./voice.mjs")).scheduleReconcile({ immediate: true });
    } catch (err) {
        error("Could not place the voices again", err);
    }
}

async function retell() {
    try {
        const { retellCast } = await import("./incident-store.mjs");
        retellCast();
    } catch (err) {
        error("Could not send the incident's cast again", err);
    }
}

/* ------------------------------ the killer's browser ------------------------------ */

let askedFor = null;

/** Ask this browser's masked character whether to reveal now (once a load for each mask). */
export async function askReveal({ actor = myMask() } = {}) {
    if (!actor || askedFor === actor.id) return null;
    askedFor = actor.id;
    const { drpgWindow, tipText } = await import("./ui-kit.mjs");
    const answer = await drpgWindow({
        classes: ["drpg-panel", "drpg-narrow", "drpg-mask-ask"],
        prompt: true,
        title: game.i18n.localize("DRPG.Mask.askTitle"),
        body: `<p>${esc(game.i18n.localize("DRPG.Mask.ask"))}</p>`,
        footer: {
            primary: { action: "reveal", label: game.i18n.localize("DRPG.Mask.reveal"), tooltip: tipText("DRPG.Tips.Actions.maskRevealTooltip"),
                callback: () => "reveal" },
            secondary: [{ action: "stay", label: game.i18n.localize("DRPG.Mask.stay"), tooltip: tipText("DRPG.Tips.Actions.maskStayTooltip"),
                callback: () => "stay" }]
        },
        rejectClose: false
    }).catch(() => null);
    if (answer === "reveal") return requestReveal(actor);
    return null;
}

/** Reveal `actor` (the voice tile's button and the question's): the primary GM ends the mask (`mask.reveal`). */
export async function requestReveal(actor = myMask()) {
    if (!actor) return false;
    const { requestMaskReveal } = await import("./bridge-asks.mjs");
    const res = await requestMaskReveal({ actorId: actor.id });
    return Boolean(res.ok);
}

/** On a GM's and a Spectator's canvas: the character's own name over a masked token (the documents they hold). */
function drawMaskName(token) {
    try {
        if (!isMaskedToken(token?.document)) return;
        const sees = game.user?.isGM || isSpectatorViewer();
        if (!sees || !token.nameplate) return;
        token.nameplate.text = `? (${token.document.actor?.name ?? ""})`;
        token.nameplate.visible = true;
    } catch (err) {
        error("Could not draw a masked token's name", err);
    }
}

let spectatorViewerOf = () => false;
const isSpectatorViewer = () => spectatorViewerOf();

/** At ready: the primary's end at a new time of day, the GMs' and Spectators' names, the killer's question. */
export function registerMasks() {
    Hooks.on("drpgTimeOfDayChanged", () => {
        if (isPrimaryGm()) masksAtNewTimeOfDay().catch(err => error("The masks could not end with the time of day", err));
    });
    import("./spectator.mjs").then(m => { spectatorViewerOf = () => Boolean(m.spectatorViewer?.()); }).catch(() => {});
    Hooks.on("refreshToken", token => {
        drawMaskName(token);
        if (!game.user?.isGM) noticeOwnMask();
    });
    if (game.user?.isGM) return;
    noticeOwnMask();
}

/* The mask this browser last saw on its own character (an actor id, or null), so a redraw that changes nothing is quiet. */
let ownMaskSeen = null;

/**
 * The killer's browser notices its own mask go up or come down on a token's redraw (Foundry redraws a token whose
 * document changed): asked once whether to reveal, and the voice tile's button repainted (`drpgMaskChanged`).
 */
function noticeOwnMask() {
    const mine = myMask()?.id ?? null;
    if (mine === ownMaskSeen) return;
    ownMaskSeen = mine;
    if (!mine) askedFor = null;
    else askReveal().catch(err => error("Could not ask whether to reveal", err));
    Hooks.callAll("drpgMaskChanged");
}
