/**
 * Danganronpa RPG - the trial hall's cast: which of its tokens the trial shows.
 * ---------------------------------------------------------------------------
 * THE HALL IS SET ONCE, AND THE MODULE ONLY SHOWS AND HIDES IN IT (E13 C2,
 * 12.10.2026; plan-E13 3.3, decision D7, audit S06-57). The GM builds the hall
 * scene with a token for everybody who may stand in it, links it (rooms.mjs
 * `sceneRoles`), and chooses which of those tokens a trial shows. Opening the
 * trial shows the chosen ones and closing it hides them all; the module creates
 * no token in the hall, deletes none and moves none. The design before D7 placed
 * and cleared seats (A5's `ensureTrialTokens`, `clearTrialTokens`): gone with it.
 *
 * THE CAST is the hall's tokens whose actor is a "character" - a student,
 * Monokuma among them. An NPC token, a prop, a token with no actor, is never the
 * module's to show or hide: it stays as the GM left it.
 *
 * THE CHOICE IS THE GMS' (D7; plan-E13 1.x 2). The audit's fix named a flag on
 * the token, and a token's flags are written by whoever owns it - the student's
 * own player. So the choice is a row of a GM store (gm-stores.mjs
 * `trialCastStore`), `{ reveal, epoch }`, written only on a GM's client (the
 * store refuses anywhere else), and a row of another season reads as no row
 * (decision D12). A token with no row is decided by `defaultReveal`: Monokuma
 * shown, a student a player owns shown - the dead and a Monocub too (the owner's
 * answer Q-E13-1 a, 09.10.2026: the dead stand in the hall under the dead
 * overlay, immovable by the corpse veto), a student nobody plays hidden (a test
 * token, a hidden culprit's spare), and the second token of one actor hidden
 * and named to the GMs.
 *
 * WHO WRITES `hidden`. The reveal and the hide are one scene update by the GM
 * whose phase change opened or closed the trial (clock.mjs `reconcilePhase`).
 * A player who owns a hall token may be able to write its `hidden` themselves:
 * whether Foundry v14 lets an owner do that is not measured (LIVE-E13-08) - the
 * headless harness lets an owner's update through, so the put-back below was
 * measured only there. The primary GM puts a player's change back to what stood
 * before it (`castPutBack`) and tells the GMs; a GM's change stands, and does
 * not change the stored choice.
 *
 * `hidden` IS A DRAW STATE, NOT A SECRET. Every client holds every token of the
 * hall in the scene's data, hidden or not (known-leaks `foundry-hidden-tokens`),
 * so nothing here may rest on a player not knowing who is in the hall.
 *
 * Before this file nothing showed or hid the hall's cast: scenario 41 as E13 C2 left it, run on
 * 12.10.2026 against C1's code, failed a2, a3, c1, d1, d2 and e1 (9/15) - entering the trial showed
 * nobody, leaving it hid nobody the GM had shown by hand, and p1's hide stood. Those are the rows
 * this file turns.
 */

import { MODULE_ID, FLAGS } from "./config.mjs";
import { seasonEpoch } from "./settings.mjs";
import { trialCastStore, answerKeysOpen } from "./gm-stores.mjs";
import { trialScene } from "./rooms.mjs";
import { flagsHeldNow } from "./sheet-audit.mjs";
import { isPrimaryGm, whisperToGms, ownerIdsOf, esc, log, error } from "./utils.mjs";

/** The options every write of this file carries: a mark to read in a log, never a pass (see `castPutBack`). */
function castWrite() {
    return { [MODULE_ID]: { trialCast: true } };
}

/** The store's key for one hall token. */
export function castKey(sceneId, tokenId) {
    return `${sceneId}.${tokenId}`;
}

/** Whether a hall token is the module's to show and hide: its actor is a student or Monokuma. */
export function isCastToken(tokenDoc) {
    return game.actors?.get?.(tokenDoc?.actorId)?.type === "character";
}

/** The hall's cast: its tokens whose actor is a "character". */
export function castTokens(scene) {
    return scene?.tokens?.filter?.(isCastToken) ?? [];
}

/**
 * One token's stored choice, `{ reveal }`, or null: no row, a row of another season, or a row that
 * says nothing. Reads only what it is handed (R116 asks it of plain rows).
 */
export function castRow(rows, sceneId, tokenId, epoch = seasonEpoch()) {
    const row = rows?.[castKey(sceneId, tokenId)];
    if (!row || row.epoch !== epoch || typeof row.reveal !== "boolean") return null;
    return { reveal: row.reveal };
}

/** The hall's stored choice this season, `{ tokenId: reveal }`: the tokens with no row are absent. */
export function readTrialCast(scene, { rows = trialCastStore.entries(), epoch = seasonEpoch() } = {}) {
    const out = {};
    for (const token of castTokens(scene)) {
        const row = castRow(rows, scene.id, token.id, epoch);
        if (row) out[token.id] = row.reveal;
    }
    return out;
}

/**
 * Store the GMs' choice for the hall's tokens: `{ tokenId: true | false | null }`, null dropping the row
 * (back to `defaultReveal`). A GM's client only - the store refuses anywhere else. Shows and hides
 * nothing: the choice is read when the trial opens. Answers whether anything was written.
 */
export async function saveTrialCast(scene, choice = {}) {
    if (!game.user?.isGM || !scene?.id) return false;
    const epoch = seasonEpoch();
    const rows = {};
    const gone = [];
    for (const [tokenId, reveal] of Object.entries(choice ?? {})) {
        if (!scene.tokens?.get?.(tokenId)) continue;
        if (reveal === null) gone.push(castKey(scene.id, tokenId));
        else if (typeof reveal === "boolean") rows[castKey(scene.id, tokenId)] = { reveal, epoch };
    }
    if (Object.keys(rows).length) await trialCastStore.patchMany(rows);
    if (gone.length) await trialCastStore.dropMany(gone);
    return Boolean(Object.keys(rows).length || gone.length);
}

/**
 * Whether a token with no stored row is shown (plan-E13 3.3; Q-E13-1 a). A second token of one actor
 * is hidden; otherwise Monokuma is shown and a student a player owns is shown, the dead and a
 * Monocub among them - only the `monokuma` flag decides of the three the plan named (census
 * `SHEET trial-scene.mjs#readCast`). Plain arguments, so R116 asks it of plain objects.
 */
export function defaultReveal({ monokuma = false, player = false, second = false } = {}) {
    if (second) return false;
    return Boolean(monokuma) || Boolean(player);
}

/**
 * The cast as the GMs hold it, read in ONE synchronous pass (H3): per token its id, name, `hidden`,
 * the actor's `monokuma` flag as the primary holds it (sheet-audit.mjs `flagsHeldNow` - a student's
 * flag a player's browser could have written since the last judgement reads as judged), whether a
 * player owns the actor, and whether an earlier token of the hall stands for the same actor.
 */
export function readCast(scene) {
    const seen = new Set();
    return castTokens(scene).map(token => {
        const actor = game.actors.get(token.actorId);
        const held = flagsHeldNow(actor);
        const second = seen.has(token.actorId);
        seen.add(token.actorId);
        return {
            id: token.id, name: token.name ?? actor?.name ?? token.id, actorId: token.actorId,
            hidden: Boolean(token.hidden), monokuma: Boolean(held.getFlag(MODULE_ID, FLAGS.monokuma)),
            player: ownerIdsOf(actor).length > 0, second
        };
    });
}

/**
 * What one open or close changes: `{ diff, seconds }`. `diff` holds `{ _id, hidden }` for every cast
 * token whose `hidden` differs from what it should be - on the way in the stored row, else
 * `defaultReveal`; on the way out hidden - and nothing else, so a second run on the same hall finds
 * an empty diff. `seconds` names the second tokens of one actor (reported on the way in). Pure.
 */
export function castDiff(cast, { reveal, sceneId, rows = {}, epoch = seasonEpoch() } = {}) {
    const diff = [];
    const seconds = [];
    for (const token of cast ?? []) {
        if (token.second) seconds.push(token.id);
        let show = false;
        if (reveal) {
            const row = token.second ? null : castRow(rows, sceneId, token.id, epoch);
            show = row ? row.reveal : defaultReveal(token);
        }
        if (Boolean(token.hidden) !== !show) diff.push({ _id: token.id, hidden: !show });
    }
    return { diff, seconds };
}

/**
 * Show the cast (`reveal`) or hide it, on a GM's client: one `updateEmbeddedDocuments` with only the
 * rows that change, no create, no delete, no position (D7). The way in waits for the store as an
 * answer key does (gm-stores.mjs `answerKeysOpen`, at most `TIMING.gmStoreOpenMs`): a store still not
 * hydrated could be missing an untick, so then nobody is shown and the GMs are told - showing a
 * hidden player is the one mistake a GM cannot take back by hand in time. Hiding needs no choice.
 * Answers `{ shown, hidden, seconds }` (token ids), or null when nothing was judged.
 */
export async function applyTrialCast(scene, { reveal = true, open = () => answerKeysOpen({ store: trialCastStore }) } = {}) {
    if (!game.user?.isGM || !scene?.tokens) return null;
    if (reveal && await open() !== "open") {
        await whisperToGms(`<p>${game.i18n.localize("DRPG.TrialScene.castUnavailable")}</p>`);
        return null;
    }
    const cast = readCast(scene);
    const { diff, seconds } = castDiff(cast, { reveal, sceneId: scene.id, rows: trialCastStore.entries() });
    if (diff.length) await scene.updateEmbeddedDocuments("Token", diff, castWrite());
    if (reveal && seconds.length) {
        const names = seconds.map(id => esc(cast.find(t => t.id === id)?.name ?? id)).join(", ");
        await whisperToGms(`<p>${game.i18n.format("DRPG.TrialScene.duplicateToken", { names })}</p>`);
    }
    return {
        shown: diff.filter(d => !d.hidden).map(d => d._id),
        hidden: diff.filter(d => d.hidden).map(d => d._id),
        seconds
    };
}

export const revealTrialTokens = (scene = trialScene()) => applyTrialCast(scene, { reveal: true });
export const hideTrialTokens = (scene = trialScene()) => applyTrialCast(scene, { reveal: false });

/**
 * The phase's step for the hall, called last by clock.mjs `reconcilePhase` on the GM who moved the
 * phase: into the trial shows the cast, out of it hides it. No hall linked, nothing.
 */
export async function followCast(from, to) {
    if (from === to) return null;
    const hall = trialScene();
    if (!hall) return null;
    if (to === "classTrial") return revealTrialTokens(hall);
    if (from === "classTrial") return hideTrialTokens(hall);
    return null;
}

/**
 * What the primary writes back after a change to a hall token's `hidden`, or null when it stands
 * (plan-E13 3.3, MARKED). A GM's change stands; a player's to a cast token of the linked hall is
 * undone - `changed` holds only what differed, so the state before it was the other one. Plain
 * arguments (R434 asks it of plain objects).
 *
 * The plan exempted a write carrying this file's `trialCast` option. It is not exempt here: an
 * option is the writer's own claim, and a player's console can send it as easily as the module
 * does; every write of this file is a GM's, and a GM's change already stands. Nor does it write
 * the stored choice in the trial, as the plan said: a GM may have shown or hidden a token by hand
 * since the trial opened, and a refusal changes nothing - so it puts back what stood.
 */
export function castPutBack(tokenDoc, changed, options, user, hall = trialScene()) {
    if (typeof changed?.hidden !== "boolean") return null;
    if (!user || user.isGM) return null;
    if (!hall || tokenDoc?.parent?.id !== hall.id || !isCastToken(tokenDoc)) return null;
    return { hidden: !changed.hidden };
}

/** The primary's `updateToken` watcher on the hall: a player's `hidden` change is put back and told. */
export async function watchCast(tokenDoc, changed, options, userId) {
    if (!isPrimaryGm()) return;
    try {
        const user = game.users?.get?.(userId) ?? null;
        const back = castPutBack(tokenDoc, changed, options, user);
        if (!back) return;
        await tokenDoc.update(back, castWrite());
        log(`${user.name} changed whether the hall token ${tokenDoc.name} is hidden; put back.`);
        await whisperToGms(`<p>${game.i18n.format("DRPG.TrialScene.hiddenPutBack", {
            user: esc(user.name), name: esc(tokenDoc.name ?? tokenDoc.id) })}</p>`);
    } catch (err) {
        error("Could not put back a hall token's hidden state", err);
    }
}

/**
 * The primary's `createToken` watcher on the hall: a cast token a player dropped there is told to the
 * GMs, not deleted (D7: the module deletes nothing in the hall). It joins the cast as any hall token
 * does, and the next entry names it if it is a second token of its actor.
 */
async function watchCastCreated(tokenDoc, options, userId) {
    if (!isPrimaryGm()) return;
    try {
        const user = game.users?.get?.(userId) ?? null;
        const hall = trialScene();
        if (!user || user.isGM || !hall || tokenDoc?.parent?.id !== hall.id || !isCastToken(tokenDoc)) return;
        await whisperToGms(`<p>${game.i18n.format("DRPG.TrialScene.playerTokenCreated", {
            user: esc(user.name), name: esc(tokenDoc.name ?? tokenDoc.id) })}</p>`);
    } catch (err) {
        error("Could not tell the GMs of a token a player made in the trial hall", err);
    }
}

export function registerTrialScene() {
    Hooks.on("updateToken", watchCast);
    Hooks.on("createToken", watchCastCreated);
}
