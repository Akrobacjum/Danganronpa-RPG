/**
 * Danganronpa RPG - the murder's privacy: the killer behind a "?".
 * ---------------------------------------------------------------------------
 * E69 C8, 13.11.2026 (the owner's 10.11 (c), the plan's C8; built for 1.2.113 by the owner's decision of 13.11 that every
 * change from the audit goes in it, which the coordinator read as overriding Q-E69-4's default). A direct murder whose
 * opening roll succeeds with Hope, or is a critical (`opensMask`), hides its killer until they reveal themselves or the
 * time of day ends:
 *
 *   - THE "?" TOKEN. The primary GM rewrites the killer's tokens on every scene, the trial hall's included (`tokensOf`,
 *     `maskPatch`): the name "?", the module's own "?" picture (`MASK_IMG`, icons/mask-unknown.svg since 1.2.116), no ring, no name or bars drawn, and one flag, `masked: true`, which says that this
 *     token is hidden and nothing about whose it is. What it looked like is kept in the GMs' store `masks` alone
 *     (gm-stores.mjs `maskStore`), never in a flag or a world setting, and written back at the end (`restorePatch`).
 *     The Actor's portrait wears the same "?" since E112 item 2b, kept on the row and written back (`portraitOf`,
 *     `portraitBack`; the audit's D271 of 1.2.122: this header did not say so).
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
 * the store; and, since 1.2.128, the incident's end and the killer leaving the room the mask went up in
 * (`endMasksAtClose`, `maskLeftRoom`). Until then the incident's own end did not end it (a default,
 * docs/dev/e69/STATUS.md); the owner, at the table of 22.11.2026: "po przerwaniu morderstwa morderca dalej mial ? i
 * wyciszenie (modul nie ujawnil go automatycznie)", and on 23.11: "Zawsze zdejmujemy maske na koniec incydentu
 * morderstwa (po sprzataniu) lub po opuszczeniu pokoju". The incident's end ends it only where the victim died, since 2.0
 * line T1 (MURDER-02; the owner's D2-06 of 26.11.2026: "Gdy ofiara przezyla incydent, maska zabojcy zostaje do konca pory
 * dnia albo do wyjscia zabojcy z pokoju, cokolwiek nastapi pierwsze"): a victim who lived stood in the room with the
 * killer and watched the "?" turn into a face as the incident closed (`maskEndsAtClose`). The rest of the mask's rule
 * stands for the time after it - the silent voice room among it (the owner's P5 default).
 *
 * WHAT IT CANNOT HIDE (Foundry's limit, recorded by 30-security's note): a token document keeps its `actorId`, so a
 * console can still read `game.actors.get(token.actorId).name` (it needs a console, not the interface). LIVE-E69-05 reads it at a
 * table.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS, isDeadForGm } from "./settings.mjs";
import { isPrimaryGm, log, error, whisperToOwnerOnly, esc, forcedDeletion } from "./utils.mjs";
import { maskStore, veilStore } from "./gm-stores.mjs";
import { count } from "./perf-counters.mjs";
import { isHidingToken } from "./hide.mjs";

/**
 * The name a masked token wears, and its picture. THE MODULE'S OWN "?" (E112 item 2a, 15.11.2026; the owner: "Morderca
 * tez nie ma zastapionej ikony tokenu znakiem zapytania gdy jest ukryty ... chodzi tez o ikone tokenu na mapie"): until
 * 1.2.116 it was Foundry's mystery man, a grey silhouette and no question mark. icons/mask-unknown.svg is a "?" drawn in
 * the module's pixel manner - a light glyph and ring with a dark outline on a dark disc - read at 120 and 48 px on a
 * light, a green, a dark and a black ground in Chromium (15.11.2026, a screenshot in the stage's notes), not on a map.
 */
export const MASK_NAME = "?";
export const MASK_IMG = `modules/${MODULE_ID}/icons/mask-unknown.svg`;
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
        displayName: src.displayName ?? null, displayBars: src.displayBars ?? null, subject: src.ring?.subject?.texture ?? null };
}

/**
 * The patch that masks a token. Pure (R6029). THE RING'S SUBJECT TOO (owner-115 item 1b, 14.11.2026; the coordinator's road
 * (a)): a v14 token's dynamic ring draws its own subject texture (`ring.subject.texture`, fvtt-types 14.370
 * client/documents/token.d.mts RingSubjectSchema, null for the token's own picture), which the patch left, so a ring put
 * back on by anyone kept the killer's art. It wears the mask's "?" (`MASK_IMG`) as well, and gets its own back (R7402).
 */
export function maskPatch() {
    return { name: MASK_NAME, "texture.src": MASK_IMG, "ring.enabled": false, "ring.subject.texture": MASK_IMG, displayName: DISPLAY_NONE,
        displayBars: DISPLAY_NONE, [`flags.${MODULE_ID}.${MASK_FLAG}`]: true };
}

/**
 * THE PORTRAIT TOO (E112 item 2b, 15.11.2026): the patch left `actor.img` alone, so the sheet, the actors' list, the voice
 * tile's face (camera-view.mjs `voiceIdentity`), a drawn roll's header (private-rolls.mjs `signAsRoller`), the sequence
 * boards and Daggerheart's own cards kept the killer's face. The actor's own picture and its prototype token's - which
 * Foundry may move along with `img` when they were the same - are kept on the row and written back exactly at the end,
 * as a token's look is. Pure (R7406).
 */
export function portraitOf(actor) {
    const src = actor?._source ?? actor ?? {};
    return { img: src.img ?? null, proto: src.prototypeToken?.texture?.src ?? null };
}
export function portraitBack(portrait) {
    // A prototype picture the actor never held is not written as null: the world's restore reads that as a change (tier
    // 2's restore, 15.11.2026: `prototypeToken (none) -> {"texture":{"src":null}}` on three actors).
    return { img: portrait?.img ?? null, ...(portrait?.proto ? { "prototypeToken.texture.src": portrait.proto } : {}) };
}

/** The patch that puts a token's kept look back, the flag taken off. Pure (R6029). */
export function restorePatch(look, gone = null) {
    // A field the token's source did not hold (a document written without it) is taken off again, not set to the mask's.
    const patch = { name: look.name, "texture.src": look.src, "ring.subject.texture": look.subject ?? null };
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

/**
 * THE NAMES A READER MAY NOT READ (owner-115 item 1b, 14.11.2026; the owner's principle via the coordinator: while the mask
 * stands, the killer's identity is secret from everyone not in on it - a Frisk, a Steal, a Palm, any card or onlooker
 * line). The characters behind a "?" - read off the tokens every browser holds, by their one flag, so a player's browser
 * that posts a card knows it as a GM's does - that `userId` does not own; none for a GM. secret.mjs `wordsFor` cuts them out
 * of every private card's words for that reader (`setNameMask`, handed this at ready by `registerMasks`). An accomplice is
 * not told apart here: they read "?" on a card outside the fight, and the name on the fight's own (murder-rules.mjs
 * `maskedName`). R7403.
 */
export function namesHiddenFrom(userId, { scenes = game.scenes, users = game.users } = {}) {
    const user = users?.get?.(userId ?? "");
    if (!user || user.isGM) return [];
    const names = new Set();
    for (const scene of scenes ?? []) for (const token of scene.tokens ?? []) {
        if (!isMaskedToken(token)) continue;
        const actor = token.actor ?? game.actors?.get?.(token.actorId ?? "");
        if (!actor?.name || actor.testUserPermission?.(user, "OWNER")) continue;
        names.add(actor.name);
    }
    return [...names];
}

/**
 * The name a list this browser draws gives `actor` (owner-115 item 1b): "?" for a character behind a mask that `user` does
 * not own, on a player's browser; its name otherwise. The pickers of the people in a room - Palm, Tail, Tamper's frame, a
 * handover, a Call's target, a Monocub's - named a masked killer to whoever stood beside them. The option's value is still
 * the actor's id (the road needs it): Foundry's limit, as the token's `actorId` (the header). R7404.
 */
export function nameAsSeen(actor, { user = game.user, masked = null } = {}) {
    if (!actor) return "";
    if (!user?.isGM && (masked ?? isMaskedActor(actor)) && !actor.testUserPermission?.(user, "OWNER")) return MASK_NAME;
    return actor.name ?? "";
}

/** Who stands behind a mask now, `[{ id, name }]` read off the masked tokens: secret.mjs keeps it with a GM's words (`hid`). */
export function maskedNow({ scenes = game.scenes } = {}) {
    const rows = new Map();
    for (const scene of scenes ?? []) for (const token of scene.tokens ?? []) {
        if (!isMaskedToken(token)) continue;
        const actor = token.actor ?? game.actors?.get?.(token.actorId ?? "");
        if (actor?.id) rows.set(actor.id, { id: actor.id, name: actor.name ?? "" });
    }
    return [...rows.values()];
}

/** Whether any token on any scene is masked now (secret.mjs veils every card while one is: `setNameMask`'s `stands`). */
export function anyMaskStands() {
    for (const scene of game.scenes ?? []) for (const token of scene.tokens ?? []) if (isMaskedToken(token)) return true;
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

/**
 * WHO SEES THROUGH A MASK (owner-115 item 1, 14.11.2026; the owner at a table on 1.2.114: "ikona tokenu mordercy u ofiary
 * powinna byc zamieniona na "?"... co zdradza tosamosc mordercy"). On a GM: null when no mask stands for `actorId`, else the
 * user ids that may still be told who it is - every GM, and every player who owns `actorId` or one of `killers` (an
 * accomplice seated with the killer, as the cast's copies keep the killer for them: incident-store.mjs `castCopyFor`).
 * Everyone else is told "?" (murder-rules.mjs `maskedName`) and sent no dice as the killer's player's
 * (private-rolls.mjs `maskSplit`).
 */
export function maskInsiders(actorId, killers = []) {
    if (!maskStands(actorId)) return null;
    const ids = new Set((game.users ?? []).filter(u => u.isGM).map(u => u.id));
    for (const id of new Set([actorId, ...(killers ?? [])])) for (const userId of ownersOf(game.actors?.get?.(id))) ids.add(userId);
    return [...ids];
}

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
    /* A ROW ALREADY STANDING (E112 item 2, the coordinator's H2 of 15.11.2026): this returned false and patched nothing,
       so a row left standing - restored from a backup (the store is backed up), or not ended because no primary was
       there at the time of day's change - met the next opening with cards that said "someone" and tokens that wore the
       real art. Read off the code, not seen at a table. Now every token of the killer the row does not hold masked is
       adopted (`adoptToken`) and masked; the row's own looks stay as kept. */
    if (maskStore.get(killer.id)) {
        let n = 0;
        for (const { token } of tokensOf(killer)) {
            const listed = (maskStore.get(killer.id)?.tokens ?? []).some(row => row.tokenId === token.id);
            if (!listed) await adoptToken(token);
            else if (!isMaskedToken(token)) await token.update(maskPatch()).catch(err => maskFailed(killer, err));
            else continue;
            n++;
        }
        // The portrait as well, kept first where the row has none (a row of 1.2.115 kept no portrait).
        if (killer._source?.img !== MASK_IMG) {
            if (!maskStore.get(killer.id)?.portrait) await maskStore.patch(killer.id, { portrait: portraitOf(killer) });
            await killer.update({ img: MASK_IMG }).catch(err => error(`Could not mask ${killer.name}'s portrait`, err));
            n++;
        }
        return n > 0;
    }
    const tokens = tokensOf(killer).map(({ scene, token }) => ({ sceneId: scene.id, tokenId: token.id, look: lookOf(token) }));
    // The room the mask goes up in, the crime room: leaving it ends the mask (1.2.128, `maskLeftRoom`).
    const { locateActor } = await import("./movement.mjs");
    const at = locateActor(killer);
    await maskStore.patch(killer.id, { killerId: killer.id, victimId: state.victimId ?? null, userIds: ownersOf(killer),
        mark: await markNow(), tokens, portrait: portraitOf(killer), at: Date.now(), room: at?.room ?? null, sceneId: at?.scene?.id ?? null });
    // The voice first, then the face: the killer goes to a silent room of their own (voice.mjs `maskedRow`) and their
    // microphone is blocked, before anybody sees the "?".
    await settleBlock();
    await placeVoicesNow();
    for (const { token } of tokensOf(killer)) await token.update(maskPatch()).catch(err => maskFailed(killer, err));
    // And the portrait (E112 item 2b), after the tokens: the map is what the room looks at.
    await killer.update({ img: MASK_IMG }).catch(err => error(`Could not mask ${killer.name}'s portrait`, err));
    await retell();
    // Veiled (E43's season canary, 14.11.2026): its document names no speaker and no reader, so it does not say whose mask
    // it is. In an incident postSecret veils it anyway (secret.mjs `incidentVeils`); the end's card below needs it always.
    await whisperToOwnerOnly(killer, { glyph: "ACTIONS.listen", body: `<p>${esc(game.i18n.localize("DRPG.Mask.card"))}</p>` }, { veiled: true });
    log(`${killer.name} hides behind a "?" until they reveal themselves or the time of day ends.`);
    return true;
}

/**
 * A TOKEN THE MASK COULD NOT WRITE IS SAID ON THE GM'S SCREEN (E112 item 2, the coordinator's H4 of 15.11.2026): it was
 * only logged, on the primary's console, so a table saw the real art and nobody knew why. Said once a character a load.
 */
const failedFor = new Set();
function maskFailed(actor, err) {
    error(`Could not mask a token of ${actor?.name ?? "a character"}`, err);
    if (failedFor.has(actor?.id ?? "")) return;
    failedFor.add(actor?.id ?? "");
    ui.notifications?.error?.(game.i18n.format("DRPG.Mask.tokenFailed", { name: actor?.name ?? "?" }));
}

/**
 * THE MASKS OF AN INCIDENT THAT ENDED (1.2.128, S0-MASKLEFT; the owner, 23.11.2026: "Zawsze zdejmujemy maske na koniec
 * incydentu morderstwa (po sprzataniu) lub po opuszczeniu pokoju"). On the primary, after the close's wipe
 * (murder-rules.mjs `closeIncident`): every one of `killerIds` whose mask stands is ended (`endMask`, "incidentEnd")
 * where its victim died - a dead killer's too, the owner deciding it knowing that its "?" comes off a body nobody has
 * found (the line's report says what that shows). WHERE THE VICTIM LIVED IT STANDS (2.0 line T1 MURDER-02; the owner's
 * D2-06: "Gdy ofiara przezyla incydent, maska zabojcy zostaje do konca pory dnia albo do wyjscia zabojcy z pokoju,
 * cokolwiek nastapi pierwsze"): an escape, Survive, a crowding out, the GM's End before a death - the victim read off
 * the mask's row and the GMs' deaths (`isDeadForGm`), so a second GM's close, asked of the primary, is judged the same
 * (`maskEndsAtClose`). Not a killer an incident running now names: the close of one incident does not
 * end the mask of the next. A second GM's close asks the primary (`mask.veil`, "unmask"), held there to its own rows,
 * whatever the packet names. Answers how many masks ended. Tier 2 "1.2.128 S0-MASKLEFT".
 *
 * QUIET WHEN THE INCIDENT IS ABANDONED (1.2.128, the coordinator's bisect of 23.11.2026: tier 2 "a reset abandons an
 * incident" red at 54769b4c, one card posted for the stab). The season reset abandons an incident (`conclude: false`),
 * and an abandon posts nothing; the mask still ends, as the owner's rule wants, but tells nobody (`endMask`, "abandoned",
 * a reason with no line). A second GM asks it as "unmaskQuiet".
 */
export async function endMasksAtClose(killerIds = [], { quiet = false } = {}) {
    if (!game.user?.isGM) return 0;
    if (!isPrimaryGm()) return (await askPrimaryVeil(quiet ? "unmaskQuiet" : "unmask", killerIds))?.ended ?? 0;
    const { murderState, killerIds: killersOf } = await import("./incident-store.mjs");
    const running = murderState()?.active ? killersOf(murderState()) : [];
    let n = 0;
    for (const id of new Set((Array.isArray(killerIds) ? killerIds : []).filter(id => typeof id === "string"))) {
        const row = maskStore.get(id);
        if (!row || running.includes(id)) continue;
        // The victim the mask went up for, as the GMs hold their death (D2-06): the row names them (`maskKiller`).
        const victim = game.actors.get(row.victimId ?? "");
        if (!maskEndsAtClose({ victimAlive: Boolean(victim) && !isDeadForGm(victim), quiet })) continue;
        if (await endMask(id, quiet ? "abandoned" : "incidentEnd")) n++;
    }
    return n;
}

/**
 * WHETHER AN INCIDENT'S CLOSE ENDS ITS KILLER'S MASK (2.0 line T1 MURDER-02; the owner's D2-06): not while the victim lives
 * - the mask then stands to the end of the time of day or until the killer leaves the room, whichever comes first
 * (`masksAtNewTimeOfDay`, `endMasksBeforeTheBoard`, `maskLeftRoom`, unchanged) - and so the killer is told no
 * `DRPG.Mask.endedIncident` either; yes where the victim died, after Stage 6's clean-up, as the owner's rule of 23.11.2026
 * said; and yes, quietly, when the season's reset abandons the incident (`quiet`). Pure (R8922).
 */
export function maskEndsAtClose({ victimAlive = false, quiet = false } = {}) {
    if (quiet) return true;
    return !victimAlive;
}

/**
 * AND WHEN THE KILLER LEAVES THE ROOM (1.2.128, the owner's same answer: "lub po opuszczeniu pokoju"). The row keeps the
 * room and scene the killer stood in as the mask went up (`maskKiller`: the crime room); on the primary, a write that
 * moves one of that killer's tokens to another room or scene ends the mask (`endMask`, "leftRoom"). A row from before
 * 1.2.128 names no room and is left to the incident's end. Answers whether it ended one.
 */
export async function maskLeftRoom(tokenDoc) {
    if (!game.user?.isGM || !isPrimaryGm()) return false;
    const row = tokenDoc?.actorId ? maskStore.get(tokenDoc.actorId) : null;
    if (!row?.room) return false;
    const { roomOfToken } = await import("./movement.mjs");
    const here = roomOfToken(tokenDoc);
    if (here === row.room && (!row.sceneId || tokenDoc.parent?.id === row.sceneId)) return false;
    return endMask(tokenDoc.actorId, "leftRoom");
}

/** End `killerId`'s mask (`why` for the log): every token's look put back, the block lifted, the cast sent again. */
export async function endMask(killerId, why = "end") {
    if (!game.user?.isGM) return false;
    const row = maskStore.get(killerId);
    if (!row) return false;
    await maskStore.drop(killerId);
    for (const { sceneId, tokenId, look } of row.tokens ?? []) {
        const token = game.scenes.get(sceneId)?.tokens?.find(t => t.id === tokenId);
        if (!token || !look) continue;
        await token.update(restorePatch(look, forcedDeletion())).catch(err => error("Could not give a masked token its look back", err));
    }
    const killer = game.actors.get(killerId);
    if (killer && row.portrait) await killer.update(portraitBack(row.portrait)).catch(err => error("Could not give a masked character its portrait back", err));
    await settleBlock();
    await placeVoicesNow();
    await retell();
    /* VEILED (E43's season canary, 14.11.2026; FINDINGS E43-F10). A mask ends at a new time of day, often after its
       incident closed, when postSecret no longer veils by itself (secret.mjs `incidentVeils`): this card went out spoken
       by the killer and addressed to the killer's player, and every browser holds every chat document - 72's "chapter
       end" read Chie's actor id, name and p3's user id on p1 and p2, the Blackened of a verdict that missed her. */
    // A reveal: the name is no longer kept cut on the cards this GM holds (secret.mjs `forgetHeldMask`); any other end keeps it.
    if (why === "reveal") await import("./secret.mjs").then(m => m.forgetHeldMask(killerId, { tell: true })).catch(err => error("Could not let the cards name a revealed killer", err));
    // And the Monocubs' bets and the Bounty on them name them again (monocub.mjs `forgetMaskedTarget`, 1.2.121).
    if (why === "reveal") await import("./monocub.mjs").then(m => m.forgetMaskedTarget(killerId)).catch(err => error("Could not let the Monocubs' rows name a revealed killer", err));
    if (why === "timeOfDay" && killer) await whisperToOwnerOnly(killer, { glyph: "ACTIONS.listen", body: `<p>${esc(game.i18n.localize("DRPG.Mask.ended"))}</p>` }, { veiled: true });
    // The incident ended, or the killer left its room (1.2.128, `endMasksAtClose`, `maskLeftRoom`): told, as at a time of day.
    const said = { incidentEnd: "DRPG.Mask.endedIncident", leftRoom: "DRPG.Mask.endedLeftRoom" }[why];
    if (said && killer) await whisperToOwnerOnly(killer, { glyph: "ACTIONS.listen", body: `<p>${esc(game.i18n.localize(said))}</p>` }, { veiled: true });
    log(`${killer?.name ?? killerId} is no longer behind a "?" (${why}).`);
    return true;
}

/**
 * EVERY MASK ENDS BEFORE THE START-OF-DAY BOARD (E112 item 6, 15.11.2026; the owner: "make sure the start-of-day screen
 * does not show a dead person while the body is undiscovered", and the coordinator's risk from item 2b). The board draws
 * every student's portrait (sequence.mjs `dayStartBoard`) on the clock write that begins a day - the Morning Eclipse's
 * start, or a roll-over with none - and a mask ended only on `drpgTimeOfDayChanged`, written after that clock: the
 * killer's place on every browser's board drew no picture, the masked one being refused, and named the killer by
 * elimination (tier 2 "E112 - the start-of-day board ...", red at 9cc67507 on both roads). On a GM, before the clock's
 * write, so each portrait's write reaches every browser ahead of the board's: the time of day the mask was for ends with
 * that write either way. Since 1.2.119 before every advance (clock.mjs `advanceTimeOfDay`), since every board can play
 * on one: the end board at Night and the discovery's two after any hour (tier 2 "E119 - the masks end before every
 * advance"); and before the Class Trial's entry and, since 1.2.121, before any write that stamps a day's board, the chapter
 * end's next morning among them (clock.mjs `setClock`, `writesBoardStamp`). Answers how many.
 */
export async function endMasksBeforeTheBoard() {
    if (!game.user?.isGM) return 0;
    await maskStore.whenHydrated();
    let n = 0;
    for (const killerId of Object.keys(maskStore.entries() ?? {})) if (await endMask(killerId, "timeOfDay")) n++;
    return n;
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

/* ------------------------------ the opening's veil (E112) ------------------------------ */

/*
 * THE OPENING'S VEIL (E112, 15.11.2026; the owner's request 1: "gdy morderca rzuca, dopoki nie rzuci otwarcia, jego token
 * powinien byc niewidzialny dla ofiary, a sam morderca wyciszony. Dopiero po rzucie odslaniamy token"). The owner's answers
 * through the coordinator: hidden from every player but the killer's side, bystanders included; muted is the microphone
 * alone, the killer still hears the room; an accomplice seated with the killer at the opening is veiled too; from the
 * start of the time of day the murder is declared in; the killer told in one line.
 *
 *   - WHO: a direct murder's killers (`veilWanted`: the killer, and a third seated on the killers' side, `thirdSide`),
 *     while the incident waits on its opening (`openingRoll`). A trap and a self-inflicted death have none - and, since
 *     2.0 line T1 MURDER-01 (the owner's D2-07 of 26.11.2026: "Poza Eclipse token zabojcy nie znika na czas rzutu
 *     otwarcia. Przy porazce nic sie na mapie nie zmienia"), neither has an incident opened outside an Eclipse's lights:
 *     the murder window's, a ruling card's or the console's open. There the token stays where the room saw it, and a
 *     Hope or critical opening puts the "?" on over it at once (D2-12), the table seeing the change.
 *   - WHEN IT BEGINS: only for a murder declared in an Eclipse (the incident's `atLights`, murder-rules.mjs `openMurder`),
 *     as the Eclipse ends and before its lights show anyone
 *     (eclipse.mjs `endEclipse`, `veilAtTheLights`): a row of `why: "lights"` for every killer the lights will judge,
 *     kept while they judge and taken over by the incident that opens, or lifted if none does. The declaration itself
 *     is in the dark: an Eclipse hides every player's token from every other (visibility.mjs `tokenShownTo`).
 *   - HOW: the primary GM writes one flag, `veiled`, on each of the character's tokens on every scene; it names nobody,
 *     and visibility.mjs hides the token on every browser but its owner's, the killers' side's and the GMs'
 *     (`tokenShownTo`), as the rooms hide a token. The tokens are listed on the GMs' store `veils` (gm-stores.mjs
 *     `veilStore`). The microphone is C6's block with one more reason (voice.mjs `settleTrialVoices`, `veilMutedIds`);
 *     unlike the mask's, no silent room: the killer hears the room.
 *   - NOT FOUNDRY'S `hidden` (E112v, 16.11.2026; the owner's decision, road (b)). Until E112v the veil was Foundry's
 *     `hidden` beside the flag, each token's own `hidden` kept on the row and written back. The owner's local run L1 on
 *     Foundry 14.370 read the defect (LIVE-E112-01): a hidden token is drawn for its owner but is no vision source for
 *     them (its vision-source test answers false), so with every player an observer of every character Foundry gave the killer's
 *     browser the sight of an observed token - the victim's. So the veil writes no `hidden` (`veilPatch`): Foundry's
 *     vision rules stay as they are for the killer's own token, and a `hidden` on a veiled token is a GM's (utils.mjs
 *     `hiddenByGm`). A row written by 1.2.116-1.2.117 (no `hides`) still holds each token's own `hidden`: the primary's
 *     settle writes it back and keeps the flag (`convertVeil`), and its lift writes it back (R7700, tier 2 "E112v - a
 *     veil written by 1.2.116 ...").
 *   - WHEN IT ENDS: on every road out of the opening, read off the incident by one rule (`settleVeils`): the opening
 *     scored (the stage moves on), failed or closed (the incident ends), a re-opened incident (another `openedAt`). The
 *     primary settles at its ready and when a primary leaves, so a GM gone or reloaded mid opening is swept. A success
 *     that opens a mask puts the "?" on first (murder-rules.mjs `resolveKillerOpening`: `maskKiller`, then the stage,
 *     then this): no browser draws the real face for a frame. A closed roll window is no road out: the opening is not
 *     optional and is offered again (`throwOpeningRoll`), and the veil stands until it is thrown or the murder ends.
 *
 * WHAT IT CANNOT HIDE (Foundry's limit, the known leak `foundry-veiled-token-actor`): a token's flags reach every browser,
 * and every browser that hides the token has to know which one to hide, so a console lists the token carrying the flag
 * and reads by its `actorId` whose it is (docs/dev/e112v/DESIGN.md section 3). The killer's vision on a real canvas is
 * LIVE-E112V-01.
 */

/** The token flag that marks a token the opening veils. It says the token is veiled, never whose it is. */
export const VEIL_FLAG = "veiled";

/** Whether a token is veiled, by its one flag (every browser reads it: it says nothing of whose it is). */
export function isVeiledToken(token) {
    return Boolean((token?.flags ?? token?._source?.flags)?.[MODULE_ID]?.[VEIL_FLAG]);
}

/**
 * Whom the opening of `state` veils: a direct murder's killers, while it waits on the opening - the killer, and a third
 * seated on the killers' side (incident-store.mjs `killerIds`' rule). None for a trap, a self-inflicted death, any other
 * stage, and since 2.0 line T1 MURDER-01 none for an incident the Eclipse's lights did not open (`atLights`, the owner's
 * D2-07): outside an Eclipse the killer's token stays on the map through the opening. Pure (R7405, R8920).
 */
export function veilWanted(state) {
    if (!state?.active || state.stage !== "openingRoll" || state.indirect || state.selfInflicted || state.atLights !== true) return [];
    return [...new Set([state.killerId, state.thirdSide === "killer" ? state.thirdId : null].filter(Boolean))];
}

/**
 * WHO SEES THROUGH A VEIL, ON A GM (1.2.121 line M1, 21.11.2026; the audit's N119-1): null when no veil stands for
 * `actorId`, else the user ids that may be told of them - every GM, and every player who owns a veiled character (the
 * killer, and a third seated on the killers' side: `veilWanted`'s, a row each). The veil's own answer on the GMs' side, as
 * `maskInsiders` is the mask's; a player's browser asks `veiledFromHere` of its own token verdict instead. A room action's
 * lines leave a character out for anyone else (facilities-gm.mjs `applyEffects`).
 */
export function veilInsiders(actorId) {
    if (!game.user?.isGM || !actorId || !veilStore.get(actorId)) return null;
    const ids = new Set((game.users ?? []).filter(u => u.isGM).map(u => u.id));
    for (const id of Object.keys(veilStore.entries() ?? {})) for (const userId of ownersOf(game.actors?.get?.(id))) ids.add(userId);
    return [...ids];
}

/** The users whose microphone a veil holds blocked: every veiled character's owners as the row names them. */
export function veilMutedIds() {
    const ids = new Set();
    for (const row of Object.values(veilStore.entries() ?? {})) for (const id of row?.userIds ?? []) ids.add(id);
    return ids;
}

/** The patch that veils a token - the one flag, no `hidden` (E112v) - and the one that lifts it (`gone`, a deletion). Pure (R7405, R7700). */
export function veilPatch() {
    return { [`flags.${MODULE_ID}.${VEIL_FLAG}`]: true };
}
export function unveilPatch(gone = null) {
    return { [`flags.${MODULE_ID}.${VEIL_FLAG}`]: gone ?? false };
}

/** How a row of E112v's hides its tokens: by the module, its tokens' own `hidden` untouched. A row without it is 1.2.116-1.2.117's. */
const HIDES = "module";

/** Whether `row` was written before E112v: its tokens carry the veil's `hidden`, each token's own kept on the row. */
function writtenWithHidden(row) {
    return Boolean(row) && row.hides !== HIDES;
}

/** While an Eclipse's lights judge its declarations (`veilAtTheLights`), their rows of "lights" stand. */
let lightsJudging = false;

/** Veil `actorId` on the primary, `why` and `openedAt` kept on its row. A row already there is kept as it is. */
async function veilActor(actorId, { why, openedAt = null, tell = true }) {
    if (!game.user?.isGM) return false;
    const actor = game.actors.get(actorId ?? "");
    if (!actor || veilStore.get(actor.id)) return false;
    const tokens = tokensOf(actor).map(({ scene, token }) => ({ sceneId: scene.id, tokenId: token.id }));
    await veilStore.patch(actor.id, { actorId: actor.id, userIds: ownersOf(actor), why, openedAt, hides: HIDES, tokens, at: Date.now() });
    // The microphone first, then the face, as the mask does: nobody hears the killer from a token nobody sees.
    await settleBlock();
    for (const { token } of tokensOf(actor)) await token.update(veilPatch()).catch(err => error(`Could not veil a token of ${actor.name}`, err));
    if (tell) await tellVeiled(actor);
    log(`${actor.name} is veiled until the opening is thrown (${why}).`);
    return true;
}

/**
 * The killer's one line (the owner's answer (5)): veiled, as the mask's card - its document names no speaker and no
 * reader. Not at the lights, which may still refuse the murder: there, when the opening takes the row over.
 */
async function tellVeiled(actor) {
    await whisperToOwnerOnly(actor, { glyph: "ACTIONS.listen", body: `<p>${esc(game.i18n.localize("DRPG.Veil.card"))}</p>` }, { veiled: true });
}

/** Lift `actorId`'s veil (`why` for the log): the flag off every token (and a 1.2.116 row's kept `hidden` back), the block lifted. */
async function liftVeil(actorId, why = "end") {
    if (!game.user?.isGM) return false;
    const row = veilStore.get(actorId);
    if (!row) return false;
    await veilStore.drop(actorId);
    const legacy = writtenWithHidden(row);
    for (const { sceneId, tokenId, hidden } of row.tokens ?? []) {
        const token = game.scenes.get(sceneId)?.tokens?.find(t => t.id === tokenId);
        if (!token) continue;
        const patch = legacy ? { hidden: Boolean(hidden), ...unveilPatch(forcedDeletion()) } : unveilPatch(forcedDeletion());
        await token.update(patch).catch(err => error("Could not lift a token's veil", err));
    }
    await settleBlock();
    log(`${game.actors.get(actorId)?.name ?? actorId} is no longer veiled (${why}).`);
    return true;
}

/**
 * A row of 1.2.116-1.2.117 the opening still holds (E112v): each token's own `hidden` written back, the flag kept, the row
 * marked as hiding by the module - so a world updated while an opening waits gives the killer their vision back at the
 * primary's first settle. Answers whether it wrote.
 */
async function convertVeil(actorId, row) {
    if (!game.user?.isGM || !writtenWithHidden(row)) return false;
    for (const { sceneId, tokenId, hidden } of row.tokens ?? []) {
        const token = game.scenes.get(sceneId)?.tokens?.find(t => t.id === tokenId);
        if (!token) continue;
        await token.update({ hidden: Boolean(hidden), ...veilPatch() }).catch(err => error("Could not give a veiled token its own hidden back", err));
    }
    await veilStore.patch(actorId, { hides: HIDES, tokens: (row.tokens ?? []).map(({ sceneId, tokenId }) => ({ sceneId, tokenId })) });
    log(`${game.actors.get(actorId)?.name ?? actorId}'s veil hides by the module now, not by Foundry's hidden.`);
    return true;
}

let settling = Promise.resolve();

/**
 * THE VEIL SETTLED TO THE INCIDENT, ON THE PRIMARY (E112). Every row the incident no longer wants is lifted - its
 * character is no killer of a direct murder waiting on its opening, or the row is another incident's - and every killer
 * it wants is veiled; a row of "lights" stands while the lights judge, and is taken over by the incident that opens for
 * its character. One settle at a time, in the order asked. Answers `{ lifted, veiled }` on the primary, else null.
 */
export function settleVeils() {
    // Another GM asks the primary and waits for it (STG-31, `veilOnPrimary`): its own settle would write nothing.
    if (game.user?.isGM && !isPrimaryGm()) return askPrimaryVeil("settle");
    const run = () => settleVeilsNow();
    const next = settling.then(run, run);
    settling = next.catch(() => null);
    return next;
}

async function settleVeilsNow() {
    if (!game.user?.isGM || !isPrimaryGm()) return null;
    await veilStore.whenHydrated();
    const { murderState } = await import("./murder.mjs");
    const state = murderState();
    const wanted = new Set(veilWanted(state));
    const openedAt = state?.openedAt ?? null;
    const out = { lifted: [], veiled: [] };
    for (const [actorId, row] of Object.entries(veilStore.entries() ?? {})) {
        if (wanted.has(actorId) && row?.why === "lights") {
            await convertVeil(actorId, row);
            await veilStore.patch(actorId, { why: "opening", openedAt });
            const actor = game.actors.get(actorId);
            if (actor) await tellVeiled(actor);
            continue;
        }
        if (wanted.has(actorId) && row?.openedAt === openedAt) {
            await convertVeil(actorId, row);
            continue;
        }
        if (row?.why === "lights" && lightsJudging) {
            await convertVeil(actorId, row);
            continue;
        }
        if (await liftVeil(actorId, wanted.has(actorId) ? "another incident" : "the opening is over")) out.lifted.push(actorId);
    }
    for (const actorId of wanted) if (await veilActor(actorId, { why: "opening", openedAt })) out.veiled.push(actorId);
    return out;
}

/**
 * THE LIGHTS (E112; the owner's answer (4): "Od poczatku pory dnia w ktorej jest zadeklarowane morderstwo"). A direct murder
 * is declared in an Eclipse and opens at its lights, at the start of the next time of day (eclipse.mjs
 * `judgePendingMurders`), after the Eclipse's flag has gone - when every token is drawn again. So the killers the lights
 * will judge are veiled before the flag goes (`endEclipse`), and `lightsJudged` settles once the lights have judged.
 * Since 1.2.121 (DOC-01) `endEclipse` hands only the killers the lights can still open - none the room alone cancels - and
 * one cancelled at the lights is lifted as it is (`liftAtTheLights`).
 */
export async function veilAtTheLights(killerIds = []) {
    if (!game.user?.isGM) return 0;
    if (!isPrimaryGm()) return (await askPrimaryVeil("lights", killerIds))?.veiled ?? 0;
    await veilStore.whenHydrated();
    lightsJudging = true;
    let n = 0;
    for (const id of new Set(killerIds)) if (await veilActor(id, { why: "lights", tell: false })) n++;
    return n;
}

/**
 * A killer the lights cancelled (DOC-01, 1.2.121; eclipse.mjs `judgePendingMurders`): their row of "lights" lifted at once,
 * in the settles' order, so they are drawn again before the judgement goes on to the next declaration - not after the whole
 * of it at `lightsJudged`. A row the opening took over, or none, is left. On the primary; answers whether it lifted.
 */
export function liftAtTheLights(actorId) {
    if (!game.user?.isGM) return Promise.resolve(false);
    if (!isPrimaryGm()) return askPrimaryVeil("lift", [actorId]).then(out => Boolean(out?.lifted));
    const run = () => (veilStore.get(actorId ?? "")?.why === "lights" ? liftVeil(actorId, "the lights cancelled it") : false);
    const next = settling.then(run, run);
    settling = next.catch(() => null);
    return next;
}

export async function lightsJudged() {
    lightsJudging = false;
    if (game.user?.isGM && !isPrimaryGm()) return askPrimaryVeil("judged");
    return settleVeils();
}

/*
 * THE VEIL FROM ANOTHER GM'S BROWSER (1.2.122; the audit's STG-31). The veil is the primary's to write, and on another GM
 * the lights' veil (`veilAtTheLights`), their lift (`liftAtTheLights`), their end (`lightsJudged`) and the open's settle
 * (`settleVeils`) answered nothing, so an Eclipse ended or a murder opened there put the veil up only once the primary
 * heard the incident's write: the killer's token drawn for the victim meanwhile. That GM now asks the primary
 * (`mask.veil`, bridge-asks.mjs `requestMaskVeil`) and waits for its answer; the primary runs its own road
 * (`veilOnPrimary`). The lights' killers are held to the primary's own declarations of the Eclipse. Measured with a
 * second GM in scenario 97-two-gms (1.2.122 STG-31); tier 2 reads the primary's side (`veilOnPrimary`) alone.
 */
async function askPrimaryVeil(what, killerIds = []) {
    try {
        const { requestMaskVeil } = await import("./bridge-asks.mjs");
        const res = await requestMaskVeil({ what, killerIds });
        return res.ok ? res.value ?? null : null;
    } catch (err) {
        error("Could not ask the primary GM for the opening's veil", err);
        return null;
    }
}

/** The primary's side of `mask.veil` (`askPrimaryVeil`): answers what its road did, or null off the primary. */
export async function veilOnPrimary({ what, killerIds = [] } = {}) {
    if (!game.user?.isGM || !isPrimaryGm()) return null;
    const { pendingMurderStore } = await import("./gm-stores.mjs");
    const declared = (Array.isArray(killerIds) ? killerIds : [])
        .filter(id => typeof id === "string" && pendingMurderStore.has(id) && game.actors.get(id));
    if (what === "lights") return { veiled: await veilAtTheLights(declared) };
    if (what === "lift") return { lifted: declared.length ? await liftAtTheLights(declared[0]) : false };
    if (what === "judged") return { settled: Boolean(await lightsJudged()) };
    if (what === "settle") return { settled: Boolean(await settleVeils()) };
    // A second GM's close of an incident (1.2.128): held to the primary's own rows (`endMasksAtClose`).
    if (what === "unmask" || what === "unmaskQuiet") return { ended: await endMasksAtClose(killerIds, { quiet: what === "unmaskQuiet" }) };
    return null;
}

/* ------------------------------ a token made while a mask or a veil stands ------------------------------ */

/*
 * A TOKEN MADE WHILE A MASK OR A VEIL STANDS (E112 item 2, the coordinator's H1 of 15.11.2026). Both rows list the tokens
 * that stood when they went up, and nothing looked at a token made afterwards: one made from the prototype (a GM's drag,
 * the trial hall) wore the real art, and one carried to another scene (call-world.mjs `carryAcross`, a whole copy under a
 * new id) kept the "?" or `hidden` after the end, its row naming only the token it replaced. Read off the code, not seen
 * at a table: whether this is the owner's map of 15.11 waits on their answers. So the primary adopts every token of such
 * a character as it is created: the row gains it - the look, or the `hidden`, of the token it was carried from where the
 * carry's mark names one, else its own as made - and it is masked or veiled if it is not already. Answers what it did.
 * Since E112v a veil keeps no `hidden` (`veilPatch`): the new token joins the row and takes the flag, its own `hidden` as
 * made.
 */
const CARRY_MARK = "carriedFrom";

/** The id of the token `tokenDoc` was carried from (call-world.mjs `carryAcross` marks it "sceneId.tokenId"), or null. */
function carriedFrom(tokenDoc) {
    const mark = (tokenDoc?.flags ?? tokenDoc?._source?.flags)?.[MODULE_ID]?.[CARRY_MARK];
    return typeof mark === "string" && mark.includes(".") ? mark.split(".")[1] || null : null;
}

export async function adoptToken(tokenDoc) {
    if (!game.user?.isGM || !isPrimaryGm()) return null;
    const actorId = tokenDoc?.actorId ?? null, sceneId = tokenDoc?.parent?.id ?? null;
    if (!actorId || !sceneId) return null;
    await maskStore.whenHydrated();
    await veilStore.whenHydrated();
    const from = carriedFrom(tokenDoc);
    const out = { masked: false, veiled: false };
    const mask = maskStore.get(actorId);
    if (mask && !(mask.tokens ?? []).some(row => row.tokenId === tokenDoc.id)) {
        const rows = mask.tokens ?? [];
        let look = (from && rows.find(row => row.tokenId === from)?.look) ?? (isMaskedToken(tokenDoc) ? rows[0]?.look ?? null : lookOf(tokenDoc));
        // Made from a prototype with no picture of its own, a token takes the actor's portrait - the "?" while the mask
        // stands (tier 2 "E112 - a token made while ...", 15.11.2026): it gets the picture the mask kept instead.
        if (look?.src === MASK_IMG) look = { ...look, src: mask.portrait?.proto ?? mask.portrait?.img ?? rows[0]?.look?.src ?? null };
        // A token that copied a masked token's look without its flag (the trial hall's, trial-scene.mjs `hallTokenData`,
        // 1.2.113-1.2.115) is not kept as "?": its name, picture and ring are the row's kept look (E112, 16.11.2026).
        if (look && (look.name === MASK_NAME || look.src === MASK_IMG) && rows[0]?.look) look = { ...rows[0].look };
        if (look) await maskStore.patch(actorId, { tokens: [...rows, { sceneId, tokenId: tokenDoc.id, look }] });
        if (!isMaskedToken(tokenDoc)) await tokenDoc.update(maskPatch()).catch(err => maskFailed(game.actors.get(actorId), err));
        out.masked = true;
    }
    let veil = veilStore.get(actorId);
    if (veil && !(veil.tokens ?? []).some(row => row.tokenId === tokenDoc.id)) {
        // A 1.2.116 row (E112): converted first (`convertVeil`); a copy carried from one of its tokens took the veil's
        // `hidden` with it, and gets the `hidden` that row kept for the token it was carried from.
        const kept = writtenWithHidden(veil) && from ? (veil.tokens ?? []).find(row => row.tokenId === from)?.hidden : undefined;
        if (writtenWithHidden(veil)) {
            await convertVeil(actorId, veil);
            veil = veilStore.get(actorId) ?? veil;
        }
        await veilStore.patch(actorId, { tokens: [...(veil.tokens ?? []), { sceneId, tokenId: tokenDoc.id }] });
        const patch = { ...(typeof kept === "boolean" && Boolean(tokenDoc._source?.hidden ?? tokenDoc.hidden) !== kept ? { hidden: kept } : {}),
            ...(isVeiledToken(tokenDoc) ? {} : veilPatch()) };
        if (Object.keys(patch).length) await tokenDoc.update(patch).catch(err => error("Could not veil a token made behind a veil", err));
        out.veiled = true;
    }
    return out;
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

/*
 * THE ROOM'S PEOPLE AS A PLAYER'S PICKER LISTS THEM, UNDER THE OPENING'S VEIL (1.2.119, 20.11.2026; the audit's adversarial
 * pass through the coordinator, a blocker: "the hand-over picker names the killer hidden by the opening's veil"). The
 * room's people (movement.mjs `othersInRoom`, `countsAsPresent`) leave out a GM's `hidden` alone, and since E112v the veil
 * writes only its flag: the veiled killer stays a witness, a target and a finder - the rules' reading, on the GM's side
 * and on every browser that counts the room (`countsAsPresent`'s own note), which this leaves as it is. But the pickers a
 * player's browser builds from the room listed them by name, `nameAsSeen` hiding a masked character and not a veiled one
 * (scenario 21 "road", red at 8098249c: the hand-over's, Palm's, a Hope Call's and Tail's lists on the victim's browser
 * held "Chie Mori"). So a picker passes its room through `seenHere`: an actor with a veiled token this browser does not
 * draw - visibility.mjs `tokenShownTo`'s own verdict, "hide", bound here at ready (visibility.mjs is reached from files
 * this one is) - is left out, as their token is. A GM, the token's owner and the killers' side, to whom the token is
 * shown, list them as before. Before the binding, nobody is left out.
 */
let shownHere = null;

/*
 * ONE VEIL PREDICATE FOR THE PICKERS AND THE VOICE TILE (1.2.122 line MURDER; a known gap since 1.2.119). The pickers asked
 * `veiledFromHere` of an actor and the voice tile asked visibility.mjs `voiceVeiledHere` of a user, each with a loop of its
 * own over every scene's tokens, two flag readers (`isVeiledToken`, visibility.mjs's own `veiledToken`) and two GM tests -
 * one rule written twice, which could drift apart. Both now ask `veilHidesHere`: some veiled token on a scene that
 * `isTheirs` claims, which `shown` - this browser's `tokenShownTo` - answers "hide" for, and never on a GM's browser.
 * `veiledFromHere` claims an actor's tokens; `userVeiledFromHere`, which the voice tile reads through `voiceVeiledHere`,
 * the tokens of every actor `subject` owns. R8221 holds that for a user owning one student the two never differ.
 */
export function veilHidesHere(isTheirs, { scenes = game.scenes, shown = shownHere, gm = Boolean(game.user?.isGM) } = {}) {
    if (gm || typeof shown !== "function" || typeof isTheirs !== "function") return false;
    for (const scene of scenes ?? []) for (const token of scene?.tokens ?? []) {
        // A token Hide hides (S0-HIDE, E129; hide.mjs) is left out by the same rule: the pickers and the voice tile.
        if ((isVeiledToken(token) || isHidingToken(token)) && isTheirs(token) && shown(token) === "hide") return true;
    }
    return false;
}

/** Whether this browser does not draw a veiled token of `actor` (`tokenShownTo` "hide"): never on a GM's. */
export function veiledFromHere(actor, { scenes = game.scenes, shown = shownHere, user = game.user } = {}) {
    if (!actor) return false;
    return veilHidesHere(token => token.actorId === actor.id, { scenes, shown, gm: Boolean(user?.isGM) });
}

/**
 * Whether the veil hides `subject` - a user - from this browser: a veiled token of a character they own that this browser
 * does not draw. Never for a GM's account, nor for this browser's own (`user`), nor on a GM's browser.
 */
export function userVeiledFromHere(subject, { scenes = game.scenes, shown = shownHere, user = game.user, gm = Boolean(user?.isGM) } = {}) {
    if (!subject || subject.isGM || subject.id === user?.id) return false;
    return veilHidesHere(token => Boolean(token.actor?.testUserPermission?.(subject, "OWNER")), { scenes, shown, gm });
}

/** `actors` without those whose veiled token this browser does not draw (`veiledFromHere`): a picker's room, as it sees it. */
export function seenHere(actors, options = {}) {
    return (actors ?? []).filter(a => !veiledFromHere(a, options));
}

let spectatorViewerOf = () => false;
const isSpectatorViewer = () => spectatorViewerOf();

/** At ready: the primary's end at a new time of day, the GMs' and Spectators' names, the killer's question. */
export function registerMasks() {
    Hooks.on("drpgTimeOfDayChanged", () => {
        if (isPrimaryGm()) masksAtNewTimeOfDay().catch(err => error("The masks could not end with the time of day", err));
    });
    // The opening's veil (E112): settled on the primary at every write of the incident, at its ready, and when a primary
    // leaves (the GM who becomes it sweeps what no opening holds).
    const settle = () => { if (isPrimaryGm()) settleVeils().catch(err => error("The opening's veil could not be settled", err)); };
    Hooks.on("updateSetting", setting => { if (setting?.key === `${MODULE_ID}.${SETTINGS.murderState}`) settle(); });
    Hooks.once("ready", settle);
    Hooks.on("userConnected", (user, connected) => { if (!connected && user?.isGM) settle(); });
    // A killer's token moved out of the room its mask went up in ends the mask (1.2.128, `maskLeftRoom`), on the primary.
    Hooks.on("updateToken", (tokenDoc, change) => {
        if (!isPrimaryGm() || !change || !("x" in change || "y" in change || "level" in change) || !maskStore.get(tokenDoc?.actorId ?? "")) return;
        maskLeftRoom(tokenDoc).catch(err => error("Could not end the mask of a killer who left the room", err));
    });
    // A token made while a mask or a veil stands joins it (E112, `adoptToken`).
    Hooks.on("createToken", tokenDoc => { if (isPrimaryGm()) adoptToken(tokenDoc).catch(err => error("Could not mask or veil a new token", err)); });
    import("./spectator.mjs").then(m => { spectatorViewerOf = () => Boolean(m.spectatorViewer?.()); }).catch(() => {});
    // The veil's verdict for this browser's pickers (`seenHere`): the token's own rule, by `import()` as the Spectator's above.
    import("./visibility.mjs").then(m => { shownHere = doc => m.tokenShownTo(doc, m.viewerHere(d => Boolean(d?.isOwner))); }).catch(() => {});
    // By `import()`: secret.mjs is reached from gm-stores.mjs (through notice-history.mjs), which this file imports.
    import("./secret.mjs").then(m => m.setNameMask(namesHiddenFrom, { stands: anyMaskStands, masked: maskedNow })).catch(err => error("Could not hand the cards the masked names", err));
    /* THE OWN MASK WHEN AN OWN TOKEN'S MASK TURNS, NOT ON EVERY REDRAW (the audit's CASE-71, 1.2.122): `noticeOwnMask`
       walked every token of every scene on each `refreshToken` of a player's browser, whether or not a mask stood. It is
       asked now only when a token this player owns is redrawn with its mask flag other than the redraw before saw it
       (`ownMaskFlags`, one flag read a redraw), and at ready (below); counted (`refreshToken.mask`) as the other refresh
       listeners are. No token hook of its own: a mask's write redraws the token, and the censuses of the room, trial
       and passage roads read none here. */
    Hooks.on("refreshToken", token => {
        count("refreshToken.mask");
        drawMaskName(token);
        if (!game.user?.isGM && ownMaskTurned(token)) noticeOwnMask();
    });
    if (game.user?.isGM) return;
    noticeOwnMask();
}

/* Whether each of this player's own tokens wore the mask at its last redraw, by token id (`ownMaskTurned`). */
const ownMaskFlags = new Map();

/** Whether `token` is this player's own and its mask flag differs from its last redraw's (the first redraw counts). */
export function ownMaskTurned(token) {
    const doc = token?.document ?? token;
    if (!doc?.id || !doc.isOwner) return false;
    const masked = isMaskedToken(doc);
    if (ownMaskFlags.get(doc.id) === masked) return false;
    ownMaskFlags.set(doc.id, masked);
    return true;
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
