/**
 * Danganronpa RPG — Remnants on the map.
 * ---------------------------------------------------------------------------
 * Guide: "Remnants as hidden tokens, so nobody loses track of them."
 *
 * A Remnant is dropped where the character was standing when they left it, and
 * is hidden from players until someone Observes it. Rendering choices, all from
 * the brief: half transparent, and sorted BELOW character tokens so a cluttered
 * crime scene never hides the people in it.
 *
 * They are Tokens rather than Tiles or Notes because tokens carry flags, can be
 * hidden and revealed per-document, and sit on a layer the GM already knows how
 * to manipulate.
 */

import { MODULE_ID, ACTIONS, REMNANT_TYPES, REMNANT_VISIBILITY_LABELS, TIME_OF_DAY_LABELS,
    observeDc } from "./config.mjs";
// Statically imported: `remnantsInRoom` is synchronous, and movement.mjs does
// not reach back into this file, so there is no cycle to break.
import { roomOfToken } from "./movement.mjs";
import { SETTINGS } from "./settings.mjs";
import { gmIds, log, warn, error, plural, workingScene } from "./utils.mjs";

/**
 * Everything the guide says a Remnant carries, recorded on the token so an
 * investigation two sessions later can still answer "where did this come from".
 */
export const REMNANT_FLAGS = {
    isRemnant: "isRemnant",
    /** key | neutral | faint | prep | incident | resolution | autopsy | final */
    type: "remnantType",
    /** obvious | evident | subtle | hidden — how hard it is to spot. */
    visibility: "visibility",
    /** Cannot be removed by the killer in Stage 6. */
    reinforced: "reinforced",
    /** Wiped at chapter end unless tied to a murder. */
    faint: "faint",
    /**
     * Left by a crime tool, a cleaning tool or the murder itself. The guide's
     * exception to the chapter-end sweep: "wiped at chapter end **unless tied
     * to the murder or a tool**". Without this the sweep deleted exactly the
     * traces the investigation was supposed to find.
     */
    tiedToCrime: "tiedToCrime",
    /** Free-text note for the GM. */
    note: "note",
    /** Which action produced it: search | sabotage | project | incident | resolution | manual */
    action: "action",
    /** What was found or done — the item drawn, the project sabotaged. */
    subject: "subject",
    /** Who left it. */
    sourceActor: "sourceActor",
    sourceName: "sourceName",
    /** Room, chapter, day and time of day at the moment it was left. */
    room: "room",
    chapter: "chapter",
    day: "day",
    timeOfDay: "timeOfDay",
    /** Points the finger at this character — used by "Misleading trail". */
    pointsAt: "pointsAt"
};

/**
 * The token to drop a Remnant on.
 *
 * `getActiveTokens()` only returns tokens that are *rendered* and on the scene
 * this client is currently looking at, so it comes back empty often enough to
 * matter — a GM resolving something on another scene, a canvas mid-load. The
 * scene's own token list is checked as well, which needs neither.
 */
function tokenFor(actor) {
    if (!actor) return null;

    const active = actor.getActiveTokens?.()?.[0];
    if (active?.document) return active;

    for (const scene of [canvas?.scene, ...game.scenes]) {
        if (!scene) continue;
        const doc = scene.tokens.find(t => t.actorId === actor.id);
        if (doc) return { document: doc };
    }
    return null;
}

/** Name of the hidden actor every Remnant token is built from. */
const REMNANT_ACTOR = "Remnant";

const ICON = "icons/svg/hazard.svg";

/** Colour per Remnant type, so a glance at the map reads. */
const TINTS = {
    key: "#f3c267",
    prep: "#9d4edd",
    incident: "#b3324a",
    resolution: "#4ea3dd",
    autopsy: "#c9c9c9",
    faint: "#6b6b6b",
    neutral: "#8a8a8a",
    final: "#ffffff"
};

/**
 * Difficulty as a tag a player can read, not a number.
 *
 * Four bands over `observeDc()`'s six actual values (6, 9, 12, 15, 18, 21),
 * named for how solid the lead feels rather than for what a GM would call the
 * visibility band — "Obvious" and "Evident" are already spoken for, and this
 * is a different axis: a Faint trace at Obvious (12) is genuinely harder to
 * spot than a Key one at Obvious (6), which is the whole reason `observeDc`
 * takes the type as well as the visibility. Naming the bands after the DC
 * range rather than reusing REMNANT_VISIBILITY_LABELS keeps the two axes from
 * being read as the same thing.
 *
 * NO EXACT NUMBER, ever — DC is derived from the trace's REAL type
 * (`OBSERVE_TYPE_ALIAS` in config.mjs), so printing "DC 9" would let a player
 * back out whether they are looking at a Key trace or a Prep one just by
 * comparing it to a Key trace they found earlier. The four bands are wide
 * enough that neighbouring types usually land in the same one.
 */
const DIFFICULTY_BANDS = [
    { max: 9, key: "slight" },
    { max: 12, key: "modest" },
    { max: 15, key: "firm" },
    { max: Infinity, key: "deep" }
];

/** The difficulty tag for a trace, or `null` when it has no Observe DC at all. */
export function difficultyTag(visibility, type) {
    const dc = observeDc(visibility, type);
    if (dc === null) return null;
    const band = DIFFICULTY_BANDS.find(b => dc <= b.max) ?? DIFFICULTY_BANDS[DIFFICULTY_BANDS.length - 1];
    return game.i18n.localize(`DRPG.Remnant.difficulty.${band.key}`);
}

/**
 * Whether a player is told anything at all about a trace they (or their
 * side) just left — the one gate `report()` in action-rolls.mjs and its
 * counterparts in cleanup.mjs, murder.mjs and reroll.mjs all share.
 *
 * Guide-approved: Hope shows it, a plain Despair does not, and a critical
 * always does — uniformly, with no exception per action. What is shown, when
 * it is shown, is never the exact visibility band a trace was left at: that
 * word is the ledger's own DC lookup key (`observeDc`'s `OBSERVE_TYPE_ALIAS`),
 * and a player told "Obvious" or "Hidden" for their own trace could compare
 * it against later finds and back out what type each one really was — the
 * same leak `difficultyTag` exists to close on the finder's side of the same
 * question.
 *
 * @param {{isCritical?: boolean, withHope?: boolean}} roll
 * @param {*} placed  What `dropRemnant`/`placeRemnant`/`retuneRemnant`
 *   returned — nothing to report if nothing was actually placed or changed.
 */
export function traceFeedback(roll, placed) {
    return Boolean(placed) && Boolean(roll?.isCritical || roll?.withHope);
}

/* ==========================================================================
 * CREATION
 * ========================================================================== */

/**
 * Drop a Remnant where a character is standing.
 *
 * @param {Actor} actor            Whose position to use.
 * @param {object} options
 * @param {string} options.type    Key from REMNANT_TYPES.
 * @param {string} options.visibility  obvious | evident | subtle | hidden
 * @param {boolean} [options.faint]
 * @param {boolean} [options.reinforced]
 * @param {string} [options.note]  What it actually is, for the GM.
 */
export async function dropRemnant(actor, {
    type = "prep", visibility = "evident", faint = false, reinforced = false,
    note = "", action = "manual", subject = "", pointsAt = null, tiedToCrime = false
} = {}) {
    const token = tokenFor(actor);
    if (!token) {
        // Loud, not silent. This used to warn to the console and return null, so
        // an action reported "you leave a trace behind" while no Remnant existed
        // anywhere — the one failure the investigation can never recover from.
        warn(`No token for ${actor?.name}; the Remnant was not placed.`);
        ui.notifications.error(game.i18n.format("DRPG.Remnant.noToken", {
            actor: actor?.name ?? "?"
        }));
        const { whisperToGms } = await import("./utils.mjs");
        await whisperToGms(`<p class="drpg-warning">${game.i18n.format("DRPG.Remnant.noTokenGm", {
            actor: foundry.utils.escapeHTML(actor?.name ?? "?"),
            action: foundry.utils.escapeHTML(action)
        })}</p>`);
        return null;
    }

    // Stamp when and where, so an investigation can reconstruct the timeline.
    const { getClock } = await import("./clock.mjs");
    const { roomOfActor } = await import("./movement.mjs");
    const clock = getClock();

    return placeRemnant({
        x: token.document.x,
        y: token.document.y,
        // A scene id, not the Scene itself: this object may travel over a
        // socket to the GM, and a live document does not survive that.
        sceneId: token.document.parent?.id,
        type, visibility, faint, reinforced, note, action, subject, pointsAt, tiedToCrime,
        sourceActor: actor.id,
        sourceName: actor.name,
        room: roomOfActor(actor),
        chapter: clock.chapter,
        day: clock.day,
        timeOfDay: clock.timeOfDay
    });
}

/**
 * Place a Remnant at explicit coordinates. GM-only: creating tokens needs it,
 * so a player action routes through the GM bridge.
 */
export async function placeRemnant(data = {}) {
    if (!game.user.isGM) {
        const { requestRemnant } = await import("./gm-bridge.mjs");
        return requestRemnant(data);
    }

    const {
        x, y, scene = null, sceneId = null, type = "prep", visibility = "evident",
        faint = false, reinforced = false, note = "", action = "manual",
        subject = "", pointsAt = null, tiedToCrime = false,
        sourceActor = null, sourceName = "",
        room = null, chapter = null, day = null, timeOfDay = null
    } = data;

    const target = scene ?? (sceneId ? game.scenes.get(sceneId) : null) ?? canvas?.scene;
    if (!target) return null;

    const actor = await ensureRemnantActor();
    if (!actor) return null;

    // A Remnant is the GM's own note. Players never see one — Observing it
    // produces a separate Truth Bullet, which the GM fills in. So the name can
    // and should carry everything: who, what, and from which action.
    const kind = `${REMNANT_VISIBILITY_LABELS[visibility] ?? visibility} ${faint ? "Faint " : ""}${REMNANT_TYPES[type]?.label ?? "Remnant"}`;
    const who = sourceName ? ` · ${sourceName}` : "";
    const what = subject
        ? ` · ${actionLabel(action)}: ${subject}`
        : (action && action !== "manual" ? ` · ${actionLabel(action)}` : "");
    const label = `${kind}${who}${what}`;

    // WHAT THE DOCUMENT IS CALLED, which is not the same thing.
    //
    // The name used to be `label` — "Obvious Faint Prep Remnant · Player B ·
    // Search: Cleaning agent" — and a token's name travels to every client with
    // the token. A player listing the scene read the whole crime scene off the
    // names alone. `label` still exists and still says all of that; it goes into
    // the ledger, where the GM's screens read it from.
    const publicName = game.i18n.localize("DRPG.Remnant.tokenName");
    const size = canvas?.grid?.size ?? 100;

    try {
        const [created] = await target.createEmbeddedDocuments("Token", [{
            name: publicName,
            actorId: actor.id,
            actorLink: false,
            x, y,
            // Full grid square, same as a character.
            //
            // At half size these were genuinely hard to see and harder to click,
            // which matters for the one kind of token a GM manipulates most: a
            // crime scene ends up with several of them and they have to be
            // told apart at a glance. `sort: -10` below still keeps them under
            // the cast, so a crowded room still reads as people first.
            width: 1,
            height: 1,
            // One tint for every trace. `TINTS[type]` painted the type onto
            // the document itself, which is a colour-coded legend a player can
            // read without ever seeing the map. The GM still gets the colour —
            // `remnant-ring.mjs` paints it from the ledger, on their client.
            texture: { src: ICON, tint: TINTS.neutral },
            // Half transparent, and below characters: the map must still read
            // as "people in a room", not "a pile of clues".
            alpha: 0.5,
            sort: -10,
            // Always hidden. A Remnant is never revealed to players: Observing
            // one copies it into a Truth Bullet, and that is what they see.
            hidden: true,
            disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL,
            lockRotation: true,
            // THE MARKER AND NOTHING ELSE. Everything that was here is the
            // answer key and now lives in the GM-side ledger — see the block at
            // the top of this file. A player's client still receives this token;
            // what it no longer receives is what the token means.
            flags: { [MODULE_ID]: { [REMNANT_FLAGS.isRemnant]: true } }
        }]);

        // The answer key, off the token and onto the GM's own shelf.
        if (created) {
            await setRemnantSecret(created, {
                type, visibility, faint,
                reinforced: reinforced || Boolean(REMNANT_TYPES[type]?.reinforced),
                note, action, subject, pointsAt,
                tiedToCrime: Boolean(tiedToCrime),
                sourceActor, sourceName, room, chapter, day, timeOfDay,
                // Kept for the GM's own screens, which used to read it off the
                // token's name — see `label` above.
                label
            });
        }

        log(`Remnant placed: ${label} (by ${sourceName || "?"})`);
        if (created) await announceRemnant(created);
        return created ?? null;
    } catch (err) {
        error("Could not place the Remnant", err);
        return null;
    }
}

/** Human-readable name for the action that produced a Remnant. */
function actionLabel(action) {
    const key = `DRPG.Remnant.action.${action}`;
    const label = game.i18n.localize(key);
    return label === key ? action : label;
}

/**
 * Tell the GMs, in chat, the moment a Remnant appears — who left it, doing
 * what, where and when.
 *
 * This replaces an attempted hover tooltip, which could never have worked:
 * `hoverToken` hands you the PIXI placeable, while the tooltip manager needs an
 * HTML element.
 *
 * The culprit is deliberately kept OUT of the token's name. Remnants get
 * revealed to players during an investigation, and a token labelled
 * "…left by Kaede" would hand them the answer instead of a clue.
 */
async function announceRemnant(tokenDoc) {
    const data = remnantData(tokenDoc);
    if (!data) return;

    const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
    const when = [
        data.chapter ? `Chapter ${data.chapter}` : null,
        data.day ? `Day ${data.day}` : null,
        data.timeOfDay
    ].filter(Boolean).join(" · ");

    const { whisperToGms } = await import("./utils.mjs");
    await whisperToGms(`
        <h3>${esc(data.visibilityLabel)} ${esc(data.typeLabel)}${data.faint ? " (Faint)" : ""}</h3>
        <p><strong>${game.i18n.localize("DRPG.Remnant.leftBy")}:</strong> ${esc(data.sourceName || "—")}</p>
        ${data.note ? `<p>${esc(data.note)}</p>` : ""}
        <p><small>${esc(data.room ?? "—")}${when ? ` · ${when}` : ""}${
            data.reinforced ? ` · ${game.i18n.localize("DRPG.Remnant.reinforcedShort")}` : ""
        }</small></p>`);
}

/** The hidden actor Remnant tokens are instances of. Created once. */
async function ensureRemnantActor() {
    let actor = game.actors.getName(REMNANT_ACTOR);
    if (actor) return actor;

    if (!game.user.isGM) return null;

    try {
        actor = await Actor.create({
            name: REMNANT_ACTOR,
            type: "npc",
            img: ICON,
            ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE },
            flags: { [MODULE_ID]: { [REMNANT_FLAGS.isRemnant]: true } }
        });
        log("Created the hidden Remnant actor.");
        return actor;
    } catch (err) {
        error("Could not create the Remnant actor", err);
        return null;
    }
}

/* ==========================================================================
 * QUERYING
 * ========================================================================== */

/** Everything recorded on a Remnant, as a plain object. */

/* ==========================================================================
 * WHAT A REMNANT REALLY IS
 * --------------------------------------------------------------------------
 * Everything below the `isRemnant` marker used to live in flags on the token.
 * Foundry ships every token on a scene to every client — hidden or not, flags
 * and all — so a player's console could read all forty traces on the map with
 * who left each one, whether it belonged to the murder, how hard it was to spot
 * and the GM's own sentence about it. Measured on a player client: forty tokens,
 * every field readable. That is the entire investigation, for free, and the GM
 * would never know it had happened.
 *
 * So the answer key moves to browser storage on GM clients and travels between
 * GMs on a recipient-addressed socket — the same shape `truth-bullets.mjs` uses,
 * for the same reason, and its header carries the longer argument.
 *
 * WHAT STAYS ON THE TOKEN is `isRemnant` and nothing else. A player can still
 * see that a hidden marker exists at a position, which is a real but much
 * smaller thing to know than what it is; keeping it is what lets every GM-side
 * query find its own tokens without a ledger lookup first. The name and the tint
 * are neutral for the same reason — both used to spell the answer out.
 * ========================================================================== */

const SOCKET_EVENT = `module.${MODULE_ID}`;
const RM = { secret: "rm.secret", request: "rm.ledgerRequest", full: "rm.ledgerFull" };

/**
 * Ledger key. Token ids are only unique inside their own scene.
 * Exported for visibility.mjs, which needs the SAME shape to match a Truth
 * Bullet's public `remnantRef` flag against a token — see `applyToRemnantToken`.
 */
export function keyOf(tokenDoc) {
    const scene = tokenDoc?.parent?.id ?? tokenDoc?.parent ?? null;
    return scene && tokenDoc?.id ? `${scene}.${tokenDoc.id}` : null;
}

function readRemnantLedger() {
    if (!game.user.isGM) return {};
    try {
        return game.settings.get(MODULE_ID, SETTINGS.remnantSecrets) ?? {};
    } catch (err) {
        warn("Could not read the Remnant ledger", err);
        return {};
    }
}

async function writeRemnantLedger(ledger) {
    if (!game.user.isGM) return;
    try {
        await game.settings.set(MODULE_ID, SETTINGS.remnantSecrets, ledger);
    } catch (err) {
        error("Could not write the Remnant ledger", err);
    }
}

/**
 * Forget all of them, for the season reset.
 *
 * Tombstones rather than an empty object, one per key, through the same push
 * `dropRemnantSecret` uses. This setting is client-scoped: every GM holds their
 * own copy, and `mergeRemnantEntries` is newest-wins PER ENTRY, so an empty
 * ledger sent across merges into nothing and changes no other GM's mind. A
 * tombstone is the only shape the merge understands, which is the same reason
 * the single-item drop writes one.
 *
 * Called after the reset has deleted the tokens themselves. An entry whose
 * token is gone is already unreachable — `remnantData` is looked up by token —
 * so this is about not carrying a dead season's answer key forward, not about
 * a wrong answer today.
 */
export async function clearRemnantLedger() {
    if (!game.user.isGM) return null;

    const ledger = readRemnantLedger();
    const keys = Object.keys(ledger).filter(k => !ledger[k]?.deleted);
    if (!keys.length) return 0;

    const stamp = Date.now();
    for (const key of keys) ledger[key] = { deleted: true, updated: stamp };
    await writeRemnantLedger(ledger);
    for (const key of keys) pushRemnantSecret(key, ledger[key]);

    return keys.length;
}

/** Record or amend what a trace is, and tell the other GMs. */
/**
 * The same write, addressed by ids rather than by a document.
 *
 * Observe resolves on the GM's client, which is very often looking at a
 * different scene from the one the trace is on — so `canvas.tokens.get` is not
 * available and the token has to be found through the scene it belongs to. The
 * two ids are what the pending-observe entry already carries.
 */
export async function setRemnantSecretById(sceneId, tokenId, patch = {}) {
    if (!game.user.isGM || !sceneId || !tokenId) return null;
    const tokenDoc = game.scenes.get(sceneId)?.tokens?.get(tokenId) ?? null;
    if (!tokenDoc) return null;
    return setRemnantSecret(tokenDoc, patch);
}

export async function setRemnantSecret(tokenDoc, patch = {}) {
    if (!game.user.isGM) return null;
    const key = keyOf(tokenDoc);
    if (!key) return null;

    const ledger = readRemnantLedger();
    const entry = { ...(ledger[key] ?? {}), ...patch, updated: Date.now() };
    delete entry.deleted;
    ledger[key] = entry;

    await writeRemnantLedger(ledger);
    pushRemnantSecret(key, entry);
    return entry;
}

/** Forget one. A tombstone, so the removal reaches a GM who was offline. */
export async function dropRemnantSecret(tokenDoc) {
    if (!game.user.isGM) return;
    const key = keyOf(tokenDoc);
    if (!key) return;

    const ledger = readRemnantLedger();
    if (!ledger[key]) return;
    ledger[key] = { deleted: true, updated: Date.now() };
    await writeRemnantLedger(ledger);
    pushRemnantSecret(key, ledger[key]);
}

/* ==========================================================================
 * ONE RECORD, THREE VIEWS
 * --------------------------------------------------------------------------
 * The description used to live in three places that could disagree: this
 * ledger's own `described` (a sentence appended the first time somebody
 * Observed the trace), a Truth Bullet item's own `playerText` and `name`, and
 * the token's permanently neutral name on the map. Whichever the GM edited,
 * the other two stayed stale.
 *
 * `public` is the one structure a player is ever shown anything from:
 * `{ name, img, playerText, tags }`. Every one of the three views below reads
 * ONLY from it — never from `type`, `note`, `tiedToCrime`, `pointsAt` or
 * `sourceActor`, which stay answer-key fields for exactly the reason D6 (see
 * the header of this file) already gives.
 * ========================================================================== */

function defaultPublic(entry) {
    return {
        // `entry.label` is NOT a fallback here, on purpose — it is the GM's own
        // reading of the token, "Obvious Faint Prep Remnant · Player B ·
        // Search: Cleaning agent", built for the ledger and readable only by a
        // GM. `entry.described`, by contrast, is exactly what a GM has already
        // typed FOR a player on an earlier find, which is safe by construction.
        // A trace nobody has described yet gets the same neutral name the
        // token already carries — no more information than "something is
        // here", which is all a hidden token has ever said.
        name: entry?.described?.name || game.i18n.localize("DRPG.Remnant.tokenName"),
        img: ICON,
        playerText: entry?.described?.playerText || "",
        tags: []
    };
}

/**
 * Read what a player may eventually be shown about this trace. GM-side only —
 * a player's client never holds the ledger this reads from (see `remnantData`).
 *
 * TWO TAGS ARE COMPUTED HERE RATHER THAN STORED IN `tags`, for the same
 * reason in both cases: a tag written once at creation describes the trace as
 * it was, and both of these facts can change afterwards. `retuneRemnant`
 * moves a trace's visibility, so a stored difficulty would go stale; and a GM
 * correcting which room a trace was left in would leave a stored room tag
 * pointing at the wrong place. Derived on read, they cannot disagree with the
 * ledger.
 *
 * The room tag is what replaces the Casebook's grouping. Grouping was a view —
 * it existed only inside that one window — whereas a tag is a property of the
 * object, so it travels automatically onto the token, into the Truth Bullet in
 * the player's pack, onto the evidence card in the trial and into the
 * Investigation dashboard. Same information, in every view at once, which is
 * what makes the Casebook safe to delete in this stage.
 *
 * The GM's own manual tags stay first, so the two derived ones read as a
 * consistent suffix rather than shuffling around whatever was typed.
 */
export function remnantPublic(tokenDoc) {
    if (!game.user.isGM) return null;
    const key = keyOf(tokenDoc);
    const entry = key ? readRemnantLedger()[key] : null;
    if (!entry || entry.deleted) return null;

    const pub = { ...defaultPublic(entry), ...(entry.public ?? {}) };
    const derived = [entry.room || null, difficultyTag(entry.visibility, entry.type)]
        .filter(Boolean);

    return {
        ...pub,
        // Deduplicated: a GM who typed the room name in by hand before this
        // was derived should not now see it twice on the same card.
        tags: Array.from(new Set([...pub.tags, ...derived]))
    };
}

/**
 * Change what a player may eventually be shown, and push the change out to
 * every view that reads it.
 *
 * @param {object} patch  Any of `name`, `img`, `playerText`, `tags` — merged
 *   over what is already stored, so a caller changing one field does not have
 *   to resend the other three.
 */
export async function setRemnantPublic(tokenDoc, patch = {}) {
    if (!game.user.isGM || !tokenDoc) return null;
    const key = keyOf(tokenDoc);
    if (!key) return null;

    const ledger = readRemnantLedger();
    const entry = ledger[key];
    if (!entry || entry.deleted) return null;

    const merged = { ...defaultPublic(entry), ...(entry.public ?? {}), ...patch };
    await setRemnantSecret(tokenDoc, { public: merged });
    await propagatePublic(tokenDoc, merged);
    return merged;
}

/**
 * Token and Truth Bullets, brought into line with `public`.
 *
 * The token only moves once it is actually revealed — see the note on
 * `revealRemnantToFinder` — because writing a player-facing name onto a
 * token that is still `hidden: true` would be the answer key leaking through
 * a field nobody thought to check.
 *
 * The token gets a COPY, never a reference: it is a world document a scene
 * exports and imports independently of the ledger, so anything short of a
 * copy would desync the moment either one changed without the other.
 */
async function propagatePublic(tokenDoc, pub) {
    if (tokenDoc && !tokenDoc.hidden) {
        try {
            await tokenDoc.update({
                name: pub.name || game.i18n.localize("DRPG.Remnant.tokenName"),
                "texture.src": pub.img || ICON
            });
        } catch (err) {
            error("Could not copy `public` onto the Remnant token", err);
        }
    }

    try {
        const { propagateRemnantPublic } = await import("./truth-bullets.mjs");
        await propagateRemnantPublic(tokenDoc.id, pub);
    } catch (err) {
        error("Could not propagate `public` to the Truth Bullets copied from this trace", err);
    }
}

/**
 * The moment a trace stops being only the GM's note: somebody just copied it
 * as a Truth Bullet, so the object it came from is real now, not merely a
 * marker on the map.
 *
 * Only the FIRST copy reveals it — a second finder walks up to a token
 * already sitting there. Nothing happens if it is already revealed, so this
 * is safe to call on every copy without checking first.
 *
 * REVEALING BY UNSETTING `hidden`, never by forcing `token.visible` — Foundry
 * recomputes `visible` from its own vision logic on every refresh (see the
 * note in visibility.mjs's `hide()`), so overwriting it directly is exactly
 * as unreliable there as it would be here. `hidden: false` is the one flag
 * Foundry actually owns and keeps honest across versions. Per-player secrecy
 * from here on is a DIFFERENT question — whether each individual player who
 * has NOT yet found this trace still sees it — and that is answered in
 * visibility.mjs, the same way the room rule already is: by forcing
 * `visible = false` back down on `refreshToken` for anyone who does not
 * qualify, not by keeping the token `hidden` for everyone.
 */
export async function revealRemnantToFinder(tokenDoc) {
    if (!game.user.isGM || !tokenDoc) return null;
    if (!tokenDoc.hidden) return tokenDoc;

    await tokenDoc.update({ hidden: false });
    const pub = remnantPublic(tokenDoc);
    if (pub) await propagatePublic(tokenDoc, pub);
    return tokenDoc;
}

/**
 * By ids rather than a document — Observe resolves on the GM's client, which
 * is very often looking at a scene other than the one the trace is on, the
 * same reason `setRemnantSecretById` exists.
 */
function tokenById(sceneId, tokenId) {
    return game.scenes.get(sceneId)?.tokens?.get(tokenId) ?? null;
}

export function remnantPublicById(sceneId, tokenId) {
    const tokenDoc = tokenById(sceneId, tokenId);
    return tokenDoc ? remnantPublic(tokenDoc) : null;
}

export async function setRemnantPublicById(sceneId, tokenId, patch = {}) {
    const tokenDoc = tokenById(sceneId, tokenId);
    return tokenDoc ? setRemnantPublic(tokenDoc, patch) : null;
}

export async function revealRemnantToFinderById(sceneId, tokenId) {
    const tokenDoc = tokenById(sceneId, tokenId);
    return tokenDoc ? revealRemnantToFinder(tokenDoc) : null;
}

function pushRemnantSecret(key, entry) {
    const recipients = gmIds().filter(id => id !== game.user.id);
    if (!recipients.length) return;
    try {
        game.socket.emit(SOCKET_EVENT,
            { action: RM.secret, from: game.user.id, key, entry }, { recipients });
    } catch (err) {
        error("Could not sync the Remnant ledger", err);
    }
}

/** Newest write wins, per entry. */
async function mergeRemnantEntries(incoming = {}) {
    if (!game.user.isGM) return;
    const ledger = readRemnantLedger();
    let changed = false;
    for (const [key, entry] of Object.entries(incoming)) {
        if (!entry || typeof entry !== "object") continue;
        const mine = ledger[key];
        if (mine && (mine.updated ?? 0) >= (entry.updated ?? 0)) continue;
        ledger[key] = entry;
        changed = true;
    }
    if (changed) await writeRemnantLedger(ledger);
}

/**
 * Socket wiring and the join-time catch-up.
 *
 * A GM whose browser storage was cleared looks exactly like a GM who was offline
 * for one write, so the request is unconditional and cheap.
 */
export function registerRemnantLedger() {
    game.socket.on(SOCKET_EVENT, async payload => {
        if (!game.user.isGM || !payload) return;
        try {
            if (payload.action === RM.secret) {
                await mergeRemnantEntries({ [payload.key]: payload.entry });
            } else if (payload.action === RM.request && payload.from !== game.user.id) {
                game.socket.emit(SOCKET_EVENT,
                    { action: RM.full, from: game.user.id, ledger: readRemnantLedger() },
                    { recipients: [payload.from] });
            } else if (payload.action === RM.full) {
                await mergeRemnantEntries(payload.ledger ?? {});
            }
        } catch (err) {
            error("Could not handle a Remnant ledger message", err);
        }
    });

    // Asked immediately, NOT from a `ready` hook. This function is itself called
    // from `ready` in module.mjs, and a `Hooks.once("ready")` registered inside a
    // ready handler never fires — the hook has already run. Same trap the
    // page-tinting warning fell into.
    if (!game.user.isGM) return;
    const recipients = gmIds().filter(id => id !== game.user.id);
    if (!recipients.length) return;
    try {
        game.socket.emit(SOCKET_EVENT, { action: RM.request, from: game.user.id }, { recipients });
    } catch (err) {
        error("Could not ask the other GMs for the Remnant ledger", err);
    }
}

export function remnantData(tokenDoc) {
    if (!tokenDoc?.getFlag?.(MODULE_ID, REMNANT_FLAGS.isRemnant)) return null;

    // `{}` for anyone who is not a GM — not an error, the honest answer to
    // "what do you know about this". A player's client holds the token; it has
    // never held what the token means, and `null` here is what enforces that.
    if (!game.user.isGM) return null;

    const key = keyOf(tokenDoc);
    const entry = key ? readRemnantLedger()[key] : null;
    if (!entry || entry.deleted) {
        // A trace this GM has no record of. Says so rather than inventing a
        // blank one, because a blank Remnant would rank as the easiest thing in
        // the room and quietly become the answer to every Observe.
        return null;
    }

    return {
        id: tokenDoc.id,
        type: entry.type,
        typeLabel: REMNANT_TYPES[entry.type]?.label ?? entry.type,
        visibility: entry.visibility,
        visibilityLabel: REMNANT_VISIBILITY_LABELS[entry.visibility] ?? entry.visibility,
        faint: Boolean(entry.faint),
        reinforced: Boolean(entry.reinforced),
        tiedToCrime: Boolean(entry.tiedToCrime),
        action: entry.action,
        subject: entry.subject,
        note: entry.note,
        pointsAt: entry.pointsAt,
        sourceActor: entry.sourceActor,
        sourceName: entry.sourceName,
        room: entry.room,
        chapter: entry.chapter,
        day: entry.day,
        timeOfDay: entry.timeOfDay,
        hidden: tokenDoc.hidden,
        // What a player is shown, or would be once they find it — see
        // `remnantPublic`. Included here so a GM screen reading `remnantData`
        // does not have to make a second pass over the ledger for it.
        public: remnantPublic(tokenDoc)
    };
}

/**
 * One line of context about a trace: who left it, where, when and doing what.
 *
 * Every one of these facts is already in `remnantData()`, and until now each
 * screen decided for itself which subset of them to render — the dashboard's
 * Key Remnant row showed the scale and the note, the planner's "on the map"
 * picker showed the visibility and the room, and a GM planning the fifth clue
 * had to open the card on the map to find out who had left the other four.
 * They are the same six facts everywhere now, in the same order, formatted
 * once here.
 *
 * Empty fields are DROPPED rather than dashed. A row of "— · — · Ch 2" reads
 * as missing data; a shorter line reads as a trace that simply has no source,
 * which is what a GM-placed clue is.
 *
 * @param {object} data  A `remnantData()` record.
 * @returns {string}  Plain text, unescaped — the caller escapes it.
 */
export function traceContextLine(data) {
    if (!data) return "";
    const timeOfDay = data.timeOfDay
        ? (TIME_OF_DAY_LABELS[data.timeOfDay] ?? data.timeOfDay) : null;
    return [
        data.sourceName || null,
        data.room || null,
        data.chapter ? `Ch ${data.chapter}` : null,
        data.day ? `D ${data.day}` : null,
        timeOfDay,
        data.action ? (ACTIONS[data.action]?.label ?? data.action) : null
    ].filter(Boolean).join(" · ");
}

/**
 * GM-readable summary of every Remnant.
 *
 * Every scene by default, matching `clearFaintRemnants`: the two were reading
 * from different worlds — the sweep already covered every scene, so a GM
 * checking this report first could be told "None" while Remnants the very next
 * chapter-end sweep was about to delete sat untouched on a scene the report
 * never looked at. Pass an explicit `scene` to scope it to one, same as before.
 */
export async function reportRemnants(scene = null) {
    const scenes = scene ? [scene] : Array.from(game.scenes);
    const multi = scenes.length > 1;

    const rows = scenes.flatMap(s =>
        remnantsOn(s).map(t => remnantData(t)).filter(Boolean).map(r => `
        <tr>
            <td>${foundry.utils.escapeHTML(r.visibilityLabel)} ${foundry.utils.escapeHTML(r.typeLabel)}${r.faint ? ` ${game.i18n.localize("DRPG.Remnant.report.faintTag")}` : ""}${r.reinforced ? " ★" : ""}</td>
            ${multi ? `<td>${foundry.utils.escapeHTML(s.name)}</td>` : ""}
            <td>${foundry.utils.escapeHTML(r.room ?? "—")}</td>
            <td>${foundry.utils.escapeHTML(r.sourceName ?? "—")}<br><small>${foundry.utils.escapeHTML(r.action ?? "")}${r.subject ? `: ${foundry.utils.escapeHTML(r.subject)}` : ""}</small></td>
            <td>${game.i18n.format("DRPG.Remnant.report.stamp", {
                chapter: r.chapter ?? "?", day: r.day ?? "?"
            })}<br><small>${foundry.utils.escapeHTML(r.timeOfDay ?? "")}</small></td>
            <td>${game.i18n.localize(r.hidden
                ? "DRPG.Remnant.report.hidden" : "DRPG.Remnant.report.revealed")}</td>
        </tr>`)
    ).join("");

    const { whisperToGms } = await import("./utils.mjs");
    // The headings used to be typed into this template in English, which put
    // them outside i18n and outside every measurement made of the rest of the
    // module's text. Four of the five columns already had a key — the Remnant
    // card asks the same questions of the same record — so they are reused
    // rather than written twice.
    const t = key => game.i18n.localize(key);
    const heading = `<h3>${t("DRPG.Remnant.report.heading")}</h3>`;

    return whisperToGms(rows
        ? `${heading}<table><thead><tr>
               <th>${t("DRPG.Remnant.cardWhat")}</th>
               ${multi ? `<th>${t("DRPG.Remnant.report.scene")}</th>` : ""}
               <th>${t("DRPG.Remnant.cardWhere")}</th>
               <th>${t("DRPG.Remnant.leftBy")}</th>
               <th>${t("DRPG.Remnant.report.when")}</th>
               <th></th>
           </tr></thead><tbody>${rows}</tbody></table>
           <p><small>${t("DRPG.Remnant.report.reinforcedNote")}</small></p>`
        : `${heading}<p>${t(scene
            ? "DRPG.Remnant.report.noneScene" : "DRPG.Remnant.report.noneAnywhere")}</p>`);
}

/* ==========================================================================
 * GM: EDITING WHAT A REMNANT IS
 * --------------------------------------------------------------------------
 * Three flags decide whether a trace is still on the map when the chapter ends,
 * and until now all three could only be chosen at the moment it was created —
 * which is exactly the wrong moment. Whether a Remnant turns out to be tied to
 * the crime is usually only clear once the murder has happened, several times of
 * day after the Search that dropped it.
 *
 * So the GM can change their mind here:
 *   Faint          wiped at chapter end (guide: "doubtful connection to the case")
 *   Tied to crime  the guide's exception to that sweep — survives it
 *   Reinforced     the killer cannot remove it at all
 * ========================================================================== */

/** Set the sweep-related flags on one Remnant token. GM only. */
export async function setRemnantFlags(tokenDoc, { faint = null, tiedToCrime = null, reinforced = null } = {}) {
    if (!game.user.isGM || !tokenDoc) return null;

    const patch = {};
    if (faint !== null) patch.faint = Boolean(faint);
    if (tiedToCrime !== null) patch.tiedToCrime = Boolean(tiedToCrime);
    if (reinforced !== null) patch.reinforced = Boolean(reinforced);
    if (!Object.keys(patch).length) return null;

    // Into the ledger, not onto the token. `tiedToCrime` in particular is the
    // single most valuable bit in the game — it is the difference between a
    // trace from the murder and a trace from somebody's laundry — and it used to
    // be a flag every client could read.
    await setRemnantSecret(tokenDoc, patch);
    return tokenDoc;
}

/**
 * Table of every Remnant on the scene, with its three flags editable.
 *
 * Deliberately a table rather than a per-token control: the question the GM is
 * actually asking at chapter end is "which of these survive", and that is a
 * question about the whole scene at once.
 */
/**
 * Count the Faint traces that would go, confirm, then clear them.
 *
 * Counted BEFORE the confirmation, not after: these tokens do not come back,
 * and "delete 14 things?" is a question a GM can answer while "deleted 14
 * things" is only a report. Lives here rather than in the GM panel because the
 * button that calls it now sits on the Remnant table.
 */
export async function confirmClearFaint() {
    const DialogV2 = foundry.applications.api.DialogV2;

    let doomed = 0;
    for (const scene of game.scenes) {
        doomed += remnantsOn(scene).filter(t => {
            const d = remnantData(t);
            return d?.faint && !d.reinforced && !d.tiedToCrime;
        }).length;
    }

    if (!doomed) {
        ui.notifications.info(game.i18n.localize("DRPG.Panel.faintNone"));
        return 0;
    }

    const sure = await DialogV2.confirm({
        window: { title: game.i18n.localize("DRPG.Panel.clearFaint") },
        classes: ["drpg-panel"],
        content: `<p>${plural("DRPG.Panel.faintConfirm", { n: doomed })}</p>
                  <p class="notes">${game.i18n.localize("DRPG.Panel.faintConfirmNote")}</p>`,
        rejectClose: false
    });
    if (!sure) return 0;

    const cleared = await clearFaintRemnants();
    ui.notifications.info(plural("DRPG.Panel.faintCleared", { n: cleared }));
    return cleared;
}

/**
 * Change or remove a Remnant that has already been placed.
 *
 * Reroll needs this: a trace whose visibility came from a roll that has just
 * been taken back is wrong, and a trace left by an action that no longer
 * succeeds should not be on the map at all. Creating and deleting tokens is
 * GM-only, so a player's reroll routes through the bridge exactly as placing one
 * does.
 *
 * @param {string} sceneId
 * @param {string} tokenId
 * @param {object} patch
 * @param {string} [patch.visibility]  New visibility band.
 * @param {boolean} [patch.remove]     Delete it outright.
 * @returns {Promise<boolean|object|null>}
 */
export async function retuneRemnant(sceneId, tokenId, { visibility = null, remove = false } = {}) {
    if (!tokenId) return null;

    if (!game.user.isGM) {
        const { requestRemnantEdit } = await import("./gm-bridge.mjs");
        return requestRemnantEdit(sceneId, tokenId, { visibility, remove });
    }

    const scene = (sceneId ? game.scenes.get(sceneId) : null) ?? canvas?.scene;
    const token = scene?.tokens?.get(tokenId);
    if (!token) return null;

    if (remove) {
        // A reinforced Remnant is one the killer may not wipe. A reroll is not
        // the killer, but the rule is worth honouring: the GM placed it to make
        // the case solvable.
        if (remnantData(token)?.reinforced) return null;
        await token.delete();
        return true;
    }

    if (!visibility) return null;

    // The band is carried in the flag and echoed in the token's name, which is
    // what the GM actually reads on the map — so both have to move together.
    const current = remnantData(token);
    const label = String(token.name ?? "");
    const oldLabel = REMNANT_VISIBILITY_LABELS[current?.visibility] ?? current?.visibility ?? "";
    const newLabel = REMNANT_VISIBILITY_LABELS[visibility] ?? visibility;

    await token.update({
        name: oldLabel && label.startsWith(oldLabel)
            ? `${newLabel}${label.slice(oldLabel.length)}`
            : label
    });
    // The band is a ledger field now, so the name and the meaning are written
    // in two places rather than one — the name is what the GM reads on the map,
    // the ledger is what Observe scores against.
    await setRemnantSecret(token, { visibility });
    return true;
}

/**
 * The Remnants in a room, ordered the way Observe wants to read them.
 *
 * Two rules from the guide, applied in this order:
 *
 *   "DM zawsze w pierwszej kolejności pokazuje Remnants związane z zabójstwem"
 *      — anything tied to the crime outranks everything else, whichever end of
 *        the difficulty scale the player asked for.
 *   "Najłatwiejszy / najtrudniejszy remnant w pokoju"
 *      — within a group, order by the actual Observe DC rather than by
 *        visibility alone. A Hidden Key Remnant (15) really is easier to find
 *        than a Subtle Prep one (15 as well) is to beat by luck, and an Obvious
 *        Faint (12) is harder than an Obvious Key (6) despite being "obvious".
 *        Visibility is only half of the number the guide prints.
 *
 * Autopsy Remnants are dropped: their column says "no roll", because the
 * Autopsy bullet is handed out rather than found.
 *
 * @param {object} [options]
 * @param {string} [options.preferSource]  An actor id. "Follow my traces"
 *   asks for the observer's OWN traces first — see action-rolls.mjs — which
 *   outranks even `tiedToCrime`: a player looking for what they themselves
 *   left behind is not asking the guide's "show me the murder first"
 *   question, and this shelf is what answers theirs instead.
 * @returns {Array<{token: TokenDocument, data: object, dc: number}>} easiest first.
 */
export function rankForObserve(room, scene = workingScene(), { preferSource = null } = {}) {
    const ranked = remnantsInRoom(room, scene)
        .map(token => {
            const data = remnantData(token);
            if (!data) return null;
            const dc = observeDc(data.visibility, data.type);
            return dc === null ? null : { token, data, dc };
        })
        .filter(Boolean);

    return ranked.sort((a, b) => {
        if (preferSource) {
            const aMine = a.data.sourceActor === preferSource;
            const bMine = b.data.sourceActor === preferSource;
            if (aMine !== bMine) return aMine ? -1 : 1;
        }
        if (a.data.tiedToCrime !== b.data.tiedToCrime) return a.data.tiedToCrime ? -1 : 1;
        return a.dc - b.dc;
    });
}


/**
 * Move every existing Remnant's answer key off its token and into the ledger.
 *
 *     game.drpg.migrateRemnants()
 *
 * Run once per GM browser, because the ledger is per-browser: the first GM to
 * run it strips the tokens, and the others pick the entries up over the socket.
 * Safe to run twice — a token whose flags are already gone is skipped rather
 * than overwritten with blanks, which is the mistake that would erase a case.
 */
export async function migrateRemnants() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    let moved = 0, stripped = 0, already = 0, publicSeeded = 0;

    for (const scene of game.scenes) {
        for (const token of scene.tokens) {
            if (!token.getFlag(MODULE_ID, REMNANT_FLAGS.isRemnant)) continue;

            const old = token.getFlag(MODULE_ID, REMNANT_FLAGS.type);
            if (old === undefined) {
                already++;
                publicSeeded += await seedPublicIfMissing(token);
                continue;
            }

            const f = key => token.getFlag(MODULE_ID, REMNANT_FLAGS[key]);
            await setRemnantSecret(token, {
                type: f("type"), visibility: f("visibility"),
                faint: Boolean(f("faint")), reinforced: Boolean(f("reinforced")),
                note: f("note"), action: f("action"), subject: f("subject"),
                pointsAt: f("pointsAt"), tiedToCrime: Boolean(f("tiedToCrime")),
                sourceActor: f("sourceActor"), sourceName: f("sourceName"),
                room: f("room"), chapter: f("chapter"), day: f("day"),
                timeOfDay: f("timeOfDay"),
                // The old token name WAS the label, so it is the best record of
                // how the GM has been reading this trace on the map.
                label: token.name
            });
            moved++;
            publicSeeded += await seedPublicIfMissing(token);

            // Strip the flags and neutralise the name in one write. `-=` is
            // Foundry's delete syntax; anything less removes the value and
            // leaves the key, which still travels.
            const drop = {};
            for (const key of Object.keys(REMNANT_FLAGS)) {
                if (key === "isRemnant") continue;
                drop[`flags.${MODULE_ID}.-=${REMNANT_FLAGS[key]}`] = null;
            }
            await token.update({
                ...drop,
                name: game.i18n.localize("DRPG.Remnant.tokenName"),
                "texture.tint": TINTS.neutral
            });
            stripped++;
        }
    }

    const line = `Remnants migrated: ${moved} moved into the ledger, ${stripped} tokens stripped, `
        + `${already} already done, ${publicSeeded} \`public\` record(s) backfilled.`;
    log(line);
    ui.notifications.info(line);
    return { moved, stripped, already, publicSeeded };
}

/**
 * Backfill `public` on a ledger entry that predates it, from `described` and
 * `label` — the two fields that already carried a player-facing name and
 * sentence before `public` existed. Idempotent: an entry that already has a
 * `public` is left alone, so this is safe to run over every Remnant on every
 * migration pass rather than only the ones this run happens to touch.
 *
 * @returns {Promise<number>} 1 if a record was seeded, 0 otherwise — summed
 *   by the caller into a single count for the summary line.
 */
async function seedPublicIfMissing(tokenDoc) {
    const key = keyOf(tokenDoc);
    if (!key) return 0;
    const ledger = readRemnantLedger();
    const entry = ledger[key];
    if (!entry || entry.deleted || entry.public) return 0;

    await setRemnantSecret(tokenDoc, { public: defaultPublic(entry) });
    return 1;
}

/** Every Remnant token on a scene. */
export function remnantsOn(scene = workingScene()) {
    if (!scene) return [];
    return scene.tokens.filter(t => t.getFlag(MODULE_ID, REMNANT_FLAGS.isRemnant));
}

/**
 * Remnants inside a named room region.
 *
 * Resolved through `roomOfToken`, which falls back to a geometric test when a
 * token's region set is empty. Reading `t.regions` directly returned nothing at
 * all here: Remnant tokens are created by script, and Foundry has not populated
 * their region membership at that point.
 */
export function remnantsInRoom(room, scene = workingScene()) {
    if (!room) return [];
    return remnantsOn(scene).filter(t => roomOfToken(t) === room);
}

/**
 * Reveal a Remnant on the map.
 *
 * Rarely what you want: the intended flow is that a player Observes a Remnant
 * and receives a Truth Bullet, leaving the Remnant itself the GM's note. This
 * exists for the cases where the GM genuinely wants the token on the table.
 */
export async function revealRemnant(tokenDoc) {
    if (!game.user.isGM || !tokenDoc) return null;
    ui.notifications.warn(game.i18n.localize("DRPG.Remnant.revealWarning"));
    return tokenDoc.update({ hidden: false });
}

/** Remove one — the killer wiped it clean. */
export async function removeRemnant(tokenDoc) {
    if (!game.user.isGM || !tokenDoc) return null;
    // The ledger row goes with it. Left behind, the ledger grows for the life of
    // the world and a reused token id would inherit a dead trace's meaning.
    if (remnantData(tokenDoc)?.reinforced) {
        ui.notifications.warn(game.i18n.localize("DRPG.Remnant.reinforced"));
        return null;
    }
    // Only once the refusal above has not fired: dropping the row for a trace
    // that then survives would leave a Remnant the GM can see and not read.
    await dropRemnantSecret(tokenDoc);
    return tokenDoc.delete();
}

/**
 * Chapter end: the guide clears every Faint Remnant not tied to a murder,
 * a crime tool or a cleaning tool.
 */
export async function clearFaintRemnants(scene = null) {
    if (!game.user.isGM) return 0;

    // Every scene by default, not just the one on screen. A chapter ends for the
    // whole season, and Remnants left in rooms nobody is currently looking at
    // were quietly surviving the sweep.
    const scenes = scene ? [scene] : Array.from(game.scenes);
    let cleared = 0;

    for (const target of scenes) {
        const doomed = remnantsOn(target).filter(t => {
            const d = remnantData(t);
            if (!d?.faint) return false;
            if (d.reinforced) return false;
            // The guide's exception, which this function claimed to honour and
            // did not: anything left by a crime tool, a cleaning tool or the
            // murder stays. Those are the traces the trial is built on.
            if (d.tiedToCrime) return false;
            return true;
        });

        if (!doomed.length) continue;
        await target.deleteEmbeddedDocuments("Token", doomed.map(t => t.id));
        cleared += doomed.length;
    }

    log(`Cleared ${cleared} Faint Remnant(s) across ${scenes.length} scene(s).`);
    return cleared;
}
