/**
 * Danganronpa RPG — a Remnant wears its type as a ring.
 * ---------------------------------------------------------------------------
 * A scene late in a chapter carries a dozen Remnants, and until now they were
 * a dozen identical markers: the GM had to click each one to find out whether
 * it was a preparation trace, an autopsy note or the thing that solves the
 * case. The type was already recorded on the token and shown on every badge in
 * the player's own Truth Bullet row — it just never made it onto the map,
 * which is the one place
 * everybody is looking during an investigation.
 *
 * The ring is drawn rather than tinted, because a tint would fight the artwork
 * a Remnant already uses to say what it depicts.
 *
 * Colours are read from the stylesheet at runtime instead of being written
 * here. The palette is declared once in `danganronpa.css` and this reads the
 * same tokens the Truth Bullet badges do, so the map and the pack cannot drift
 * apart — and re-hueing the palette moves the rings with it, without touching
 * this file.
 */

import { MODULE_ID, TRUTH_BULLET_TYPES } from "./config.mjs";
import { REMNANT_FLAGS, remnantData, keyOf as remnantKeyOf } from "./remnants.mjs";
import { TRUTH_BULLET_FLAGS, bulletsOf } from "./truth-bullets.mjs";
import { debug, error } from "./utils.mjs";

const RING_NAME = "drpgRemnantRing";

/**
 * Which token each type borrows. Same assignments the `.drpg-tb-badge.type.*`
 * rules use, so a Remnant reads identically on the map and in the pack.
 */
const TYPE_TOKEN = {
    key: "--drpg-gold",
    prep: "--drpg-eye",
    incident: "--drpg-crimson",
    resolution: "--drpg-tb-resolution",
    autopsy: "--drpg-tb-autopsy",
    faint: "--drpg-tb-faint",
    neutral: "--drpg-tb-neutral",
    final: "--drpg-bone"
};

const FALLBACK = 0x8a8296;   // --drpg-dim, for a type nobody has named yet

export function registerRemnantRings() {
    Hooks.on("refreshToken", token => paint(token));
    Hooks.on("canvasReady", () => repaintAll());
    Hooks.on("updateToken", (doc, changes) => {
        // A type change has to redraw immediately; a move does not, because the
        // refresh that follows it already will.
        if (changes.flags?.[MODULE_ID]) doc.object && paint(doc.object);
    });

    // ONE hook only — ApplicationV2 fires a render hook for every class in the
    // inheritance chain, so listening to the concrete sheet as well runs this
    // twice. Same reasoning as anonymity.mjs.
    Hooks.on("renderActorSheetV2", (app, element) => {
        try {
            showRemnantCard(app, element);
        } catch (err) {
            // A trace that opens the system's sheet is ugly, not broken. Never
            // let this throw into somebody else's render.
            error("Could not draw the Remnant card", err);
        }
    });
}

/**
 * What a Remnant shows when you double-click it on the map.
 *
 * It used to show Daggerheart's adversary sheet: 660x600 of stat block, two
 * tabs, and the token's own name printed twice — for a smear on a floor. None
 * of what a Remnant actually IS appeared anywhere on it. Measured before this:
 * type, visibility, the room, who left it and the GM's note were all absent
 * from the only window the object opens.
 *
 * Replaced rather than restyled. There is no arrangement of an adversary sheet
 * that describes a trace; the fields are not there to lay out.
 *
 * WHAT A PLAYER SEES IS NOT WHAT A GM SEES, and it is not the same as what
 * `remnantData` returns either — that answers "what does the ledger say",
 * which is `null` on a player's client by construction (see D6). A player who
 * reaches a token here has necessarily copied it already — visibility.mjs
 * hides a revealed Remnant from anyone who has not — so what this renders for
 * them is THEIR OWN Truth Bullet: its category once Analyze has actually
 * identified it, and the neutral placeholder before that. Two players who
 * have and have not analysed the same trace get two different cards, on
 * purpose — that is exactly what they know.
 */
function showRemnantCard(app, element) {
    const actor = app?.document;
    const token = actor?.token ?? actor?.getActiveTokens?.(true, true)?.[0] ?? null;
    const source = token ?? actor;
    if (!source?.getFlag?.(MODULE_ID, REMNANT_FLAGS.isRemnant)) return;

    const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
    const body = element.querySelector(".window-content") ?? element;

    const html = game.user.isGM
        ? gmRemnantCard(token ?? actor, esc)
        : playerRemnantCard(token ?? actor, esc);
    if (!html) return;

    body.innerHTML = html;
    // The window is sized for a stat block and this is a card.
    app.setPosition?.({ height: "auto", width: 380 });
}

function gmRemnantCard(tokenOrActor, esc) {
    const data = remnantData(tokenOrActor);
    if (!data) return null;

    const when = [data.chapter ? `Ch ${data.chapter}` : null,
                  data.day ? `D ${data.day}` : null,
                  data.timeOfDay].filter(Boolean).join(" · ");

    const rows = [
        [game.i18n.localize("DRPG.Remnant.cardWhat"), `${esc(data.visibilityLabel)} ${esc(data.typeLabel)}`],
        [game.i18n.localize("DRPG.Remnant.cardWhere"), esc(data.room ?? "—")],
        [game.i18n.localize("DRPG.Remnant.cardWhen"), esc(when || "—")],
        [game.i18n.localize("DRPG.Remnant.cardWho"), esc(data.sourceName ?? "—")],
        [game.i18n.localize("DRPG.Remnant.cardSubject"), esc(data.subject ?? "—")]
    ];

    return `<div class="drpg-panel drpg-remnant-card">
        <h3>${esc(data.public?.name || game.i18n.localize("DRPG.Remnant.cardTitle"))}</h3>
        <dl class="drpg-remnant-facts">
            ${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}
        </dl>
        ${data.note ? `<p class="drpg-remnant-note">${esc(data.note)}</p>` : ""}
        ${data.faint || data.reinforced || data.tiedToCrime ? `<p class="drpg-remnant-tags">${[
            data.tiedToCrime ? esc(game.i18n.localize("DRPG.Remnant.crimeColumn")) : null,
            data.faint ? esc(game.i18n.localize("DRPG.Remnant.faintColumn")) : null,
            data.reinforced ? esc(game.i18n.localize("DRPG.Remnant.reinforcedColumn")) : null
        ].filter(Boolean).join(" · ")}</p>` : ""}
    </div>`;
}

function playerRemnantCard(tokenOrActor, esc) {
    const tokenDoc = tokenOrActor?.document ?? tokenOrActor;
    const bullet = myTruthBulletFor(tokenDoc);

    if (!bullet) {
        return `<div class="drpg-panel drpg-remnant-card">
            <h3>${esc(game.i18n.localize("DRPG.Remnant.cardTitle"))}</h3>
            <p>${esc(game.i18n.localize("DRPG.Remnant.cardPlayer"))}</p>
        </div>`;
    }

    const flag = key => bullet.getFlag(MODULE_ID, key);
    const shownType = flag(TRUTH_BULLET_FLAGS.shownType) ?? "neutral";
    const analyzed = Boolean(flag(TRUTH_BULLET_FLAGS.analyzed));
    const playerText = flag(TRUTH_BULLET_FLAGS.playerText) ?? "";
    const tags = flag(TRUTH_BULLET_FLAGS.tags) ?? [];

    return `<div class="drpg-panel drpg-remnant-card">
        <h3>${esc(bullet.name)}</h3>
        ${playerText ? `<p>${esc(playerText)}</p>` : ""}
        ${analyzed
            ? `<p class="drpg-remnant-category">${esc(TRUTH_BULLET_TYPES[shownType]?.label ?? shownType)}</p>`
            : `<p class="notes">${esc(game.i18n.localize("DRPG.Remnant.cardUnanalyzed"))}</p>`}
        ${tags.length ? `<p class="drpg-remnant-tags">${tags.map(esc).join(" · ")}</p>` : ""}
    </div>`;
}

/** The current user's own Truth Bullet copied from this exact token, if any. */
function myTruthBulletFor(tokenDoc) {
    const key = remnantKeyOf(tokenDoc);
    if (!key) return null;

    for (const actor of game.actors) {
        if (actor.type !== "character" || !actor.isOwner) continue;
        for (const item of bulletsOf(actor)) {
            if (item.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.remnantRef) === key) return item;
        }
    }
    return null;
}

/** Resolve a CSS custom property to the integer PIXI wants. */
function colourOf(type) {
    const name = TYPE_TOKEN[type];
    if (!name) return FALLBACK;
    try {
        const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        if (!raw) return FALLBACK;
        // `Color.from` handles "#rrggbb" and "rgb(r, g, b)" alike, which matters
        // because the palette holds both.
        return foundry.utils.Color.from(raw).valueOf();
    } catch {
        return FALLBACK;
    }
}

function repaintAll() {
    for (const token of canvas?.tokens?.placeables ?? []) paint(token);
}

/**
 * Draw, update or remove one token's ring.
 *
 * Everything is rebuilt each refresh rather than cached: a token that changes
 * size, type or Remnant-ness mid-scene would otherwise keep a ring drawn for
 * what it used to be, and the cost of a circle is not worth the bookkeeping.
 */
function paint(token) {
    try {
        if (!token?.document) return;

        const existing = token[RING_NAME];
        const isRemnant = token.document.getFlag(MODULE_ID, REMNANT_FLAGS.isRemnant);

        if (!isRemnant) {
            if (existing) {
                existing.destroy();
                token[RING_NAME] = null;
            }
            return;
        }

        // A Remnant the viewer cannot see must not be outlined into existence —
        // the ring would give away a hidden trace to the whole table.
        if (!token.visible) {
            if (existing) existing.visible = false;
            return;
        }

        const { type, reinforced } = colourInputsFor(token.document);
        if (!type) {
            if (existing) existing.visible = false;
            return;
        }

        const ring = existing ?? token.addChild(new PIXI.Graphics());
        token[RING_NAME] = ring;
        ring.visible = true;
        ring.clear();

        const w = token.w ?? token.document.width * (canvas.grid?.size ?? 100);
        const h = token.h ?? token.document.height * (canvas.grid?.size ?? 100);
        const radius = Math.min(w, h) / 2;

        // A reinforced trace cannot be cleaned up, so it gets the heavier ring —
        // the one distinction a GM acts on without opening anything.
        ring.lineStyle(reinforced ? 4 : 2, colourOf(type), 0.95);
        ring.drawCircle(w / 2, h / 2, Math.max(4, radius - 2));
    } catch (err) {
        debug("Could not paint a Remnant ring", err);
    }
}

/**
 * What the ring should paint, for whoever is looking.
 *
 * `type`/`reinforced` used to be read straight off the token's own flags,
 * which stopped meaning anything the moment the answer key moved into the
 * ledger (see the header of remnants.mjs) — every ring on the map painted the
 * fallback grey for everyone, GM included, because `placeRemnant` never wrote
 * those flags onto the token in the first place.
 *
 * A GM reads the real type off the ledger and gets the reinforced weight with
 * it. A player reads only what their OWN Truth Bullet currently shows —
 * `shownType`, already "neutral" until Analyze succeeds or the type is
 * self-evident — and never the reinforced weight, which is not part of
 * `public` and stays the GM's to know.
 */
function colourInputsFor(tokenDoc) {
    if (game.user.isGM) {
        const data = remnantData(tokenDoc);
        return { type: data?.type ?? null, reinforced: Boolean(data?.reinforced) };
    }

    const bullet = myTruthBulletFor(tokenDoc);
    if (!bullet) return { type: null, reinforced: false };
    return { type: bullet.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.shownType) ?? "neutral", reinforced: false };
}
