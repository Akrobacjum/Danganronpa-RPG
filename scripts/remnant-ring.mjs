/**
 * Danganronpa RPG - a Remnant wears its type as a ring.
 * ---------------------------------------------------------------------------
 * A scene late in a chapter carries a dozen Remnants, and until now they were
 * a dozen identical markers: the GM had to click each one to find out whether
 * it was a preparation trace, an autopsy note or the thing that solves the
 * case. The type was already recorded on the token and shown on every badge in
 * the player's own Truth Bullet row - it just never made it onto the map,
 * which is the one place
 * everybody is looking during an investigation.
 *
 * The ring is drawn rather than tinted, because a tint would fight the artwork
 * a Remnant already uses to say what it depicts. Its shape is a SQUARE pixel
 * frame (Dawid, 26.08) - filled bars one sprite-cell thick on the token's own
 * 12-cell grid, hard edges, no antialiased stroke - so the marker speaks the
 * same pixel language as the glyph inside it.
 *
 * Colours are read from the stylesheet at runtime instead of being written
 * here. The palette is declared once in `danganronpa.css` and this reads the
 * same tokens the Truth Bullet badges do, so the map and the pack cannot drift
 * apart - and re-hueing the palette moves the rings with it, without touching
 * this file.
 */

import { MODULE_ID, TRUTH_BULLET_TYPES, REMNANT_VISIBILITY_LABELS } from "./config.mjs";
import { REMNANT_FLAGS, remnantData, setRemnantPublic, markRemnantEdited, keyOf as remnantKeyOf,
    traceWhen, actionLabelOf } from "./remnants.mjs";
import { TRUTH_BULLET_FLAGS, isIdentified, hasReading } from "./truth-bullets.mjs";
// The viewer's own bullets, indexed by the Remnant they came from and memoised
// there - see `myTruthBulletFor`. visibility.mjs does not reach back into this
// file, so the static import is safe.
import { myBulletForRemnant } from "./visibility.mjs";
/* A PROJECT'S TOKEN WEARS THE SAME FRAME (Dawid, 16.09: "token projektu nie ma tej
   samej ramki, co remnanty"). projects-map.mjs is already in this file's graph -
   visibility.mjs imports it - and it does not import this one, so the static import
   adds no cycle. */
import { projectIdOf } from "./projects-map.mjs";
import { debug, error, esc, cssColour, forgetCssColours } from "./utils.mjs";
// The ledger's key, for the repaint after a change to it (E90). utils.mjs imports settings.mjs already: no new cycle.
import { SETTINGS } from "./settings.mjs";
import { glassOn as motionGlassOn } from "./motion.mjs";
/* The room border's own hairline. A ring under this theme is the same seam as the
   border the token is standing inside, so it takes the same number from the same place
   rather than a second copy of the formula that could drift from it. */
import { seamWidth } from "./fog.mjs";
// E88 C0: the counters `fps()` and scenario 86 read (perf-counters.mjs); an increment each, nothing timed.
import { count } from "./perf-counters.mjs";
/* E88 C1: the frame's light drawn once into a texture its frame shape shares, instead of a blur on every frame
   (fog-reveal.mjs "THE SEAMS' LIGHT DRAWN ONCE"). Imported from its family file, as fog.mjs re-exports only
   `seamWidth`; fog-reveal.mjs imports neither ring file back. */
import { wearHalo, releaseHalo, sweepHalos, restrikeHalos, ringHalo, HALO_BAKED, ringKept, positionOnly, haloBlurOn } from "./fog-reveal.mjs";

const RING_NAME = "drpgRemnantRing";
/* The seam's light, told apart from the seam - the same reason
   `SEAM_GLOW_NAME` exists in fog-reveal.mjs: anything measuring "the ring" by taking the
   first child would measure the bloom instead, which is strokes two to three times wider
   under a blur. */
const RING_GLOW_NAME = "drpgRemnantRingGlow";

/** The zoom the rings were last struck at - see the `canvasPan` guard below. */
let ringZoom = 0;

/** True when this browser wears Stained Glass. The SETTING first, then the class: the
    class lands at ready and tokens are drawn before that - fog-reveal.mjs `flashOutline` records
    in full what reading the class alone cost there. */
const glassOn = motionGlassOn;

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
/* A project's frame, for a token that has no type because a project does not have one. */
const PROJECT_FALLBACK = 0xd8c98a;   // PROJECT_TOKEN.workingTint, if the tint cannot be read

export function registerRemnantRings() {
    // The refresh's flags go to `paint` (E88 C2): a refresh may keep a drawing that still stands; a call without flags
    // (a repaint of the scene, a type written on the token) always draws again.
    Hooks.on("refreshToken", (token, flags) => { count("refreshToken.remnantRing"); paint(token, flags ?? {}); });
    Hooks.on("canvasReady", () => { ringZoom = 0; restrikeHalos(); sweepHalos(); repaintAll(); });

    /* A SEAM HOLDS ONE WEIGHT WHILE THE MAP IS ZOOMED, and nothing else here would
       redraw it: `refreshToken` fires when a token moves or changes, never when the
       view does. The ring is drawn in scene units, so without this it would fatten as
       you zoom in and vanish as you zoom out - the opposite of what quoting the curtain
       means. Same guard as `rezoomRoomOutline`: a fifth of a zoom step, never on a plain
       pan. Legacy's pixel frame is a statement about the token's own 12-cell grid and
       holds still, so it is not redrawn at all. */
    Hooks.on("canvasPan", () => {
        if (!glassOn()) return;
        const zoom = canvas?.stage?.scale?.x;
        if (!Number.isFinite(zoom) || zoom <= 0.05) return;
        if (ringZoom && Math.abs(Math.log(zoom / ringZoom)) < 0.18) return;
        ringZoom = zoom;
        restrikeHalos();
        repaintAll();
    });

    /* The theme itself, and the hour with it. The two themes draw different rings, so a
       switch is a redraw rather than a re-tint. Same observer and the same 60 ms settle
       fog.mjs uses for the room outline, for the reason written out there: the attribute
       changing IS the colour changing, with nothing in between to get the order wrong. */
    let themeTimer = 0;
    new MutationObserver(() => {
        // The colours the stylesheet answers may have changed with it (utils.mjs `cssColour`'s memo, E88 C2).
        forgetCssColours();
        clearTimeout(themeTimer);
        themeTimer = setTimeout(() => {
            try { repaintAll(); } catch (err) { debug("Could not repaint the Remnant rings", err); }
        }, 60);
    }).observe(document.body, { attributes: true, attributeFilter: ["class", "data-drpg-phase", "data-drpg-time"] });
    Hooks.on("updateToken", (doc, changes) => {
        // A type change has to redraw immediately; a move does not, because the
        // refresh that follows it already will.
        if (changes.flags?.[MODULE_ID]) doc.object && paint(doc.object);
    });

    /* A RING THAT MISSED ITS ROW OR ITS SIGHT IS PAINTED AGAIN (E90, 31.10.2026). A trace's frame is its row's type
       (`frameFor`), and a token is framed only while it is visible. Until 1.2.91 every `sightRefresh` flagged every
       token (visibility.mjs `applyAll`), and the refresh that followed drew whatever ring a token lacked; E89 C4
       (c2fd2931) made that one pass that flags only a token visibility.mjs hid, so on a GM, which hides nothing, no
       refresh followed at all. Measured headless at 1.2.92 (probe of 31.10.2026): a trace's ring taken away and a
       `sightRefresh` - remnantRing.rebuilt 0 and no ring; at 1.2.90, 6 refreshes and the ring back. And a ledger write
       nudges the icons alone (remnant-icons.mjs `repaintRemnants`, which reads that a trace is created first and
       recorded second): tier 2 E90-T3 at 248e798e, a type written into the store left the ring in the old type's colour,
       the row dropped left it standing, and a token shown again wore it hidden. So nothing drew the ring of a trace whose
       first paint came before its row (its own placement, a row from another GM merged after the token arrived) or while
       it was hidden. Two passes now, each once on the next frame and only over the tokens that can need one:
       after a change to the ledger, every Remnant token, through `paint` with the refresh's own rule (kept where its
       frame key stands, drawn where it changed, hidden where its row is gone); after `sightRefresh`, only a Remnant or
       a project token that is visible and has no visible ring drawn - not `ringKept`, which a light left live beside a
       renderer never satisfies and which would draw those again on every frame of a slide (fog-reveal.mjs). A trace
       whose row this browser does not hold is passed over until the ledger changes (`noFrameFor`), so a slide does not
       read its row on each frame. Tier 2 E90-T3; scenario 86's counters. */
    Hooks.on("clientSettingChanged", key => {
        if (key === `${MODULE_ID}.${SETTINGS.remnantSecrets}`) { ledgerGen++; ringPassNextFrame("ledger"); }
    });
    Hooks.on("sightRefresh", () => ringPassNextFrame("sight"));

    // ONE hook only - ApplicationV2 fires a render hook for every class in the
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
 * tabs, and the token's own name printed twice - for a smear on a floor. None
 * of what a Remnant actually IS appeared anywhere on it. Measured before this:
 * type, visibility, the room, who left it and the GM's note were all absent
 * from the only window the object opens.
 *
 * Replaced rather than restyled. There is no arrangement of an adversary sheet
 * that describes a trace; the fields are not there to lay out.
 *
 * WHAT A PLAYER SEES IS NOT WHAT A GM SEES, and it is not the same as what
 * `remnantData` returns either - that answers "what does the ledger say",
 * which is `null` on a player's client by construction (see D6). A player who
 * reaches a token here has necessarily copied it already - visibility.mjs
 * hides a revealed Remnant from anyone who has not - so what this renders for
 * them is THEIR OWN Truth Bullet: its category once Analyze has actually
 * identified it, and the neutral placeholder before that. Two players who
 * have and have not analysed the same trace get two different cards, on
 * purpose - that is exactly what they know.
 */
function showRemnantCard(app, element) {
    const actor = app?.document;
    /* The token the sheet was opened from, and nothing else (E12 fix r2-S1, 11.10.2026; review
       round 2 O3). It fell back to `getActiveTokens(true, true)`, a linked token of this
       actor drawn on this browser's canvas - which no trace has: remnants.mjs places every one
       unlinked (`actorLink: false`), read in the code, so the fallback answered nothing and was
       the camera by another road. R430 keeps it out. */
    const token = actor?.token ?? null;
    const source = token ?? actor;
    if (!source?.getFlag?.(MODULE_ID, REMNANT_FLAGS.isRemnant)) return;

    const body = element.querySelector(".window-content") ?? element;

    const html = game.user.isGM
        ? gmRemnantCard(token ?? actor, esc)
        : playerRemnantCard(token ?? actor, esc);
    if (!html) return;

    body.innerHTML = html;
    if (game.user.isGM) wireCardEditing(body, token ?? actor);
    // The window is sized for a stat block and this is a card.
    //
    // A FRAME LATER, NOT HERE (21.09). Set inside the render hook, the size was
    // overwritten by the application's own first-render positioning a moment later:
    // measured, every card sat in the stat block's 660 x 600 window. Deferred one
    // frame it holds - 480 wide, as tall as the card.
    requestAnimationFrame(() => app.setPosition?.({ height: "auto", width: 480 }));
}

/**
 * The card's pixel emblem - the same glyph the token itself wears on the map
 * (remnant-icons.mjs), so opening a trace confirms what the map already said
 * instead of introducing a second visual language. Keyed by the trace's
 * ACTION; anything unrecognised (or unearned) wears the Despair pool's
 * question mark, exactly like the token does.
 */
const GLYPH_ACTIONS = ["search", "project", "sabotage", "dynamic", "resolution",
    "incident", "discard", "manual", "loot"];

function glyph(action) {
    const act = GLYPH_ACTIONS.includes(action) ? action : "unknown";
    return `<span class="drpg-remnant-glyph" data-drpg-act="${act}" aria-hidden="true"></span>`;
}

/**
 * The player-facing fields - the name, the Observe sentence and the lab
 * reading - editable from the card itself.
 *
 * Until now this card showed the GM's own note - the answer key - and nothing
 * at all of `public`, the record a player actually reads off their Truth
 * Bullet. So a GM who double-clicked a trace to fix the sentence a player was
 * seeing found the one field they wanted missing, and had to go and open the
 * Investigation Dashboard instead.
 *
 * NOT A SECOND WRITE PATH. Every field goes through `setRemnantPublic`, which is
 * the same function the dashboard's Traces tab and `observe.mjs`'s first find
 * already call - one record, so the two screens cannot disagree and nothing has
 * to be synchronised between them. `setRemnantPublic` also propagates: every
 * Truth Bullet copied from this trace takes the field changed here, and only
 * that one (E09 fix r2-G1), while the token keeps its neutral name.
 *
 * SAVES ON BLUR, with a brief mark rather than a Save button. The window is 380
 * wide and has no footer to put one in, and there is nothing here worth a
 * two-step commit - this is a GM correcting a sentence, not a form.
 */
function wireCardEditing(body, tokenOrActor) {
    for (const field of body.querySelectorAll("[data-drpg-public]")) {
        field.addEventListener("blur", async () => {
            const key = field.dataset.drpgPublic;
            const value = field.value.trim();
            if (value === (field.dataset.drpgWas ?? "")) return;

            try {
                await setRemnantPublic(tokenOrActor, { [key]: value });
                // The GM just wrote what this trace says (E7).
                await markRemnantEdited(tokenOrActor);
                field.dataset.drpgWas = value;
                // The same mark the rest of the module uses for "that landed",
                // removed again so a card left open does not keep claiming it.
                field.classList.add("drpg-saved");
                setTimeout(() => field.classList.remove("drpg-saved"), 1200);
            } catch (err) {
                error("Could not save the Remnant's player-facing text", err);
                ui.notifications.error(game.i18n.localize("DRPG.Remnant.cardSaveFailed"));
            }
        });
    }
}

function gmRemnantCard(tokenOrActor, esc) {
    const data = remnantData(tokenOrActor);
    if (!data) return null;

    const t = key => game.i18n.localize(key);
    // The same line the dashboard, the digest and the report print (remnants.mjs `traceWhen`).
    const when = traceWhen(data);

    // The same badge vocabulary the Truth Bullet rows on the sheet speak:
    // type in the type's colour, visibility beside it, then the three GM
    // verdicts as chips - which used to be a whispered line of plain text at
    // the bottom of the card.
    const badges = [
        `<span class="drpg-tb-badge type ${esc(data.type)}">${esc(data.typeLabel)}</span>`,
        `<span class="drpg-tb-badge visibility">${esc(data.visibilityLabel)}</span>`,
        data.tiedToCrime ? `<span class="drpg-tb-badge crime">${esc(t("DRPG.Remnant.crimeColumn"))}</span>` : null,
        data.faint ? `<span class="drpg-tb-badge faint">${esc(t("DRPG.TruthBullet.faint"))}</span>` : null,
        data.reinforced ? `<span class="drpg-tb-badge reinforced">${esc(t("DRPG.Remnant.reinforcedColumn"))}</span>` : null
    ].filter(Boolean).join("");

    const rows = [
        [t("DRPG.Remnant.cardWhere"), esc(data.room ?? "-")],
        [t("DRPG.Remnant.cardWhen"), esc(when || "-")],
        [t("DRPG.Remnant.cardWho"), esc(data.sourceName ?? "-")],
        [t("DRPG.Remnant.cardAction"), esc(actionLabelOf(data.action) ?? "-")],
        [t("DRPG.Remnant.cardSubject"), esc(data.subject ?? "-")]
    ];

    /* The record the three editable fields below read and write. It went out with
       the tag row it used to share a block with, and every `pub.` below was left
       reading a name nothing declared - so the GM's card threw before it drew. */
    const pub = data.public ?? {};

    return `<div class="drpg-panel drpg-remnant-card">
        <header class="drpg-remnant-head">
            ${glyph(data.action)}
            <div class="drpg-remnant-title">
                <h3>${esc(pub.name || t("DRPG.Remnant.cardTitle"))}</h3>
                <div class="drpg-tb-badges">${badges}</div>
            </div>
        </header>
        <section class="drpg-remnant-box">
            <h4>${esc(t("DRPG.Remnant.cardFacts"))}</h4>
            <dl class="drpg-remnant-facts">
                ${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}
            </dl>
            ${data.note ? `<p class="drpg-remnant-note">${esc(data.note)}</p>` : ""}
        </section>
        <section class="drpg-remnant-box drpg-remnant-public">
            <h4>${esc(t("DRPG.Remnant.cardPlayerHalf"))}</h4>
            <label>${esc(t("DRPG.TruthBullet.name"))}
                <input type="text" data-drpg-public="name" data-drpg-was="${esc(pub.name ?? "")}"
                       value="${esc(pub.name ?? "")}" /></label>
            <label>${esc(t("DRPG.TruthBullet.playerText"))}
                <textarea rows="3" data-drpg-public="playerText"
                    data-drpg-was="${esc(pub.playerText ?? "")}"
                    placeholder="${esc(t("DRPG.TruthBullet.playerTextPlaceholder"))}">${esc(pub.playerText ?? "")}</textarea></label>
            <label>${esc(t("DRPG.TruthBullet.analyzedText"))}
                <textarea rows="3" data-drpg-public="analyzedText"
                    data-drpg-was="${esc(pub.analyzedText ?? "")}"
                    placeholder="${esc(t("DRPG.TruthBullet.analyzedTextPlaceholder"))}">${esc(pub.analyzedText ?? "")}</textarea></label>
            <p class="notes">${esc(t("DRPG.TruthBullet.analyzedTextNote"))}</p>
            <p class="notes">${esc(t("DRPG.Remnant.cardEditNote"))}</p>
        </section>
    </div>`;
}

function playerRemnantCard(tokenOrActor, esc) {
    const tokenDoc = tokenOrActor?.document ?? tokenOrActor;
    const bullet = myTruthBulletFor(tokenDoc);

    if (!bullet) {
        return `<div class="drpg-panel drpg-remnant-card">
            <header class="drpg-remnant-head">
                ${glyph(null)}
                <div class="drpg-remnant-title">
                    <h3>${esc(game.i18n.localize("DRPG.Remnant.cardTitle"))}</h3>
                </div>
            </header>
            <p class="notes">${esc(game.i18n.localize("DRPG.Remnant.cardPlayer"))}</p>
        </div>`;
    }

    const flag = key => bullet.getFlag(MODULE_ID, key);
    const shownType = flag(TRUTH_BULLET_FLAGS.shownType) ?? "neutral";
    const known = isIdentified(bullet);
    // Not the same question for a Key or a Final, whose kind shows on pickup
    // and whose reading waits for an Analyze (21.09) - see `hasReading`.
    const read = hasReading(bullet);
    const playerText = flag(TRUTH_BULLET_FLAGS.playerText) ?? "";
    /* Read off the ITEM, not decided here. The flag is empty until this holder
       has analysed this copy, so the card needs no rule of its own: it prints
       what their browser is actually allowed to hold. `read` still gates it,
       because a bullet can be identified with no reading written for it. */
    const analyzedText = flag(TRUTH_BULLET_FLAGS.analyzedText) ?? "";
    const visibility = flag(TRUTH_BULLET_FLAGS.visibility) ?? null;
    /* WHERE IT WAS PICKED UP, as a badge rather than as a tag. The tag row this
       replaces carried the room and a difficulty band, both appended by
       `remnantPublic`; the band has gone entirely (it was derived from the REAL
       type, so it hinted at the answer - see the note in remnants.mjs) and the
       room is a field on the bullet, so it is drawn from that, the same way the
       inventory row draws it. */
    const room = flag(TRUTH_BULLET_FLAGS.room) ?? null;

    // The emblem the player has EARNED, exactly as on the map: the action's
    // glyph once their copy is identified, the question mark before -
    // `sourceAction` is null on the item until analyze.mjs publishes it, so
    // `glyph` falls back on its own.
    const emblem = glyph(known ? flag(TRUTH_BULLET_FLAGS.sourceAction) : null);

    const badges = [
        `<span class="drpg-tb-badge type ${esc(shownType)}">${
            esc(TRUTH_BULLET_TYPES[shownType]?.label ?? shownType)}</span>`,
        visibility ? `<span class="drpg-tb-badge visibility">${
            esc(REMNANT_VISIBILITY_LABELS[visibility] ?? visibility)}</span>` : null,
        room ? `<span class="drpg-tb-badge room">${esc(room)}</span>` : null
    ].filter(Boolean).join("");

    return `<div class="drpg-panel drpg-remnant-card">
        <header class="drpg-remnant-head">
            ${emblem}
            <div class="drpg-remnant-title">
                <h3>${esc(bullet.name)}</h3>
                <div class="drpg-tb-badges">${badges}</div>
            </div>
        </header>
        ${playerText || analyzedText || !read ? `<section class="drpg-remnant-box">
            ${playerText ? `<p class="drpg-remnant-text">${esc(playerText)}</p>` : ""}
            ${read && analyzedText ? `<p class="drpg-remnant-text drpg-bullet-analysis"><strong>${
                esc(game.i18n.localize("DRPG.TruthBullet.analysisHeading"))
            }</strong> ${esc(analyzedText)}</p>` : ""}
            ${read ? "" : `<p class="notes">${esc(game.i18n.localize(known
                ? "DRPG.Remnant.cardUnread" : "DRPG.Remnant.cardUnanalyzed"))}</p>`}
        </section>` : ""}
    </div>`;
}

/**
 * The current user's own Truth Bullet copied from this exact token, if any.
 *
 * This used to walk every actor the viewer owns and every Truth Bullet on each
 * of them, per token, per paint - the same double loop visibility.mjs already
 * ran one file away, and had already memoised there for exactly this reason
 * ("every revealed Remnant on the scene would otherwise re-scan every character
 * this user owns"). Two copies of one question with two lifetimes; now one,
 * built once per `applyAll` pass and read here.
 *
 * Measured before the change, on a player's client: 0.0026 ms per scan with one
 * owned character and no bullets, and it ran zero times on a 41-Remnant scene
 * because a Remnant a player has not copied is not visible to them and `paint`
 * returns before asking. So the saving is small and the duplication was the
 * real cost - this is one loop deleted, not a hot path rescued.
 */
function myTruthBulletFor(tokenDoc) {
    return myBulletForRemnant(remnantKeyOf(tokenDoc));
}

/** Resolve a CSS custom property to the integer PIXI wants. */
function colourOf(type) {
    const name = TYPE_TOKEN[type];
    if (!name) return FALLBACK;
    /* THROUGH `cssColour`, AND THE NOTE THAT USED TO BE HERE WAS WRONG (20.09). It
       said `Color.from` handles "#rrggbb" and "rgb(r, g, b)" alike; measured on
       14.365 it returns NaN for `rgb(...)`, for a named colour and for a hex string
       with a space on it, and it reads "#f82" as 0xf82. This module's palette is
       six-digit hex throughout, so these rings have been drawing the right colours -
       but the claim was load-bearing for the next token somebody adds. See the note
       on `cssColour` for what was measured. */
    return cssColour(name, FALLBACK);
}

function repaintAll() {
    for (const token of canvas?.tokens?.placeables ?? []) paint(token);
}

/* The ledger's changes heard on this browser (E90): a trace painted with no row is passed over by the sight pass until
   the next one (`token.drpgRingNoFrame`). */
let ledgerGen = 0;
let ringPass = { frame: 0, ledger: false };

function ringPassNextFrame(why) {
    if (why === "ledger") ringPass.ledger = true;
    if (ringPass.frame) return;
    ringPass.frame = requestAnimationFrame(() => {
        const ledger = ringPass.ledger;
        ringPass = { frame: 0, ledger: false };
        try { ringPassNow({ ledger }); } catch (err) { debug("Could not repaint the Remnant rings after a change", err); }
    });
}

/** Whether a token wears a ring drawn and shown: what the sight pass leaves alone (E90). */
function ringShown(token) {
    const ring = token?.[RING_NAME];
    return Boolean(ring && !ring.destroyed && ring.visible && ring.drpgRingKey);
}

/**
 * The pass of `ringPassNextFrame` (E90): with `ledger`, every Remnant token painted by the refresh's rule; otherwise
 * each visible Remnant or project token with no ring shown, a trace this browser holds no row for since the last
 * ledger change passed over. Exported for the suite (E90-T3), which runs it on the canvas on screen. Answers how many
 * tokens it painted.
 */
export function ringPassNow({ ledger = false, placeables = canvas?.tokens?.placeables ?? [] } = {}) {
    count(ledger ? "remnantRing.ledgerPass" : "remnantRing.sightPass");
    let painted = 0;
    for (const token of placeables) {
        const doc = token?.document;
        if (!doc || token.destroyed) continue;
        const isRemnant = doc.getFlag(MODULE_ID, REMNANT_FLAGS.isRemnant);
        if (ledger) {
            if (!isRemnant) continue;
        } else {
            if (!token.visible || ringShown(token)) continue;
            if (isRemnant ? token.drpgRingNoFrame === ledgerGen : !projectIdOf(doc)) continue;
        }
        paint(token, {});
        painted++;
    }
    count("remnantRing.passPainted", painted);
    return painted;
}

/**
 * The ring's two pieces, made once and kept.
 *
 * A Graphics was enough while the ring was four filled bars; the seam needs a second one
 * under an additive blend and a blur, and those belong to a display object rather than to a
 * draw call. Both are cleared and redrawn on every refresh, exactly as the single Graphics
 * was - what is NOT rebuilt is the container, the blend mode and the filter, none of which a
 * token taking a step has any reason to allocate again.
 */
function ringParts(token) {
    let group = token[RING_NAME];
    if (!group || group.destroyed) {
        group = token.addChild(new PIXI.Container());
        group.name = RING_NAME;
        const halo = new PIXI.Graphics();
        halo.name = RING_GLOW_NAME;
        halo.blendMode = PIXI.BLEND_MODES?.ADD ?? 1;
        /* The light drawn once (E88 C1): a sprite over the texture its frame shape shares, between the live halo it
           stands in for - kept, empty and hidden while the sprite shows - and the core. */
        const baked = new PIXI.Sprite();
        baked.name = HALO_BAKED;
        baked.eventMode = "none";
        baked.visible = false;
        group.addChild(halo, baked, new PIXI.Graphics());
        token[RING_NAME] = group;
    }
    const [halo, baked, core] = group.children;
    return { group, halo, baked, core };
}

/**
 * Draw, update or remove one token's ring.
 *
 * Rebuilt whole when asked without `flags` (a repaint of the scene, a type written on the token). A refresh (`flags`,
 * the refresh's own) keeps the ring as drawn when what it was drawn for has not changed (E88 C2): a refresh that only
 * moves the token, or one whose frame key - Remnant or project, size, colour, weight, theme, seam - is the one it was
 * drawn with, while its light still stands (fog-reveal.mjs `ringKept`). "The cost of a circle is not worth the
 * bookkeeping", this said until C2; scenario 86 at 41cf2e9f counted 30 of them drawn again on the GM's browser for
 * one step of somebody else's, and the key is the size, the type's colour and the weight that would otherwise have
 * left a token wearing a ring drawn for what it used to be.
 */
function paint(token, flags) {
    try {
        if (!token?.document) return;

        const existing = token[RING_NAME];
        const isRemnant = token.document.getFlag(MODULE_ID, REMNANT_FLAGS.isRemnant);
        const project = isRemnant ? null : projectIdOf(token.document);

        if (!isRemnant && !project) {
            count("remnantRing.skipped");
            if (existing) {
                releaseHalo(existing.children?.find(c => c?.name === HALO_BAKED));
                existing.destroy({ children: true });
                token[RING_NAME] = null;
            }
            return;
        }

        // A Remnant the viewer cannot see must not be outlined into existence -
        // the ring would give away a hidden trace to the whole table. The same
        // sentence, word for word, is the whole secrecy of a project's token:
        // visibility.mjs decides per client whether it is on this person's map,
        // and a ring drawn regardless would announce it to everybody.
        if (!token.visible) {
            count("remnantRing.skipped");
            if (existing) existing.visible = false;
            return;
        }

        if (flags && positionOnly(flags) && ringKept(existing)) {
            count("remnantRing.kept");
            existing.visible = true;
            return;
        }

        const { colour, reinforced } = frameFor(token.document, isRemnant);
        if (colour == null) {
            count("remnantRing.skipped");
            if (existing) existing.visible = false;
            // No row here to frame it by: the sight pass waits for the ledger's next change (E90, `ringPassNow`).
            token.drpgRingNoFrame = ledgerGen;
            return;
        }

        const w = Math.round(token.w ?? token.document.width * (canvas.grid?.size ?? 100));
        const h = Math.round(token.h ?? token.document.height * (canvas.grid?.size ?? 100));
        const glass = glassOn();
        const key = [glass ? "glass" : "legacy", isRemnant ? "remnant" : "project", `${w}x${h}`, colour, reinforced ? 2 : 1,
            glass ? seamWidth().toFixed(5) : ""].join("|");
        if (flags && ringKept(existing, key)) {
            count("remnantRing.kept");
            existing.visible = true;
            return;
        }

        const { group, halo, baked, core } = ringParts(token);
        count("remnantRing.rebuilt");
        group.visible = true;
        group.drpgRingKey = key;
        group.drpgRingLight = glass ? null : "";
        core.clear();
        halo.clear();

        if (!glass) {
            halo.visible = false;
            releaseHalo(baked);
            // A square pixel frame: four filled bars on integer coordinates, one
            // cell of the sprite's own 12-cell grid thick - hard edges, no
            // antialiased stroke. A reinforced trace cannot be cleaned up, so it
            // gets the heavier frame (two cells) - the one distinction a GM acts
            // on without opening anything.
            const cell = Math.max(1, Math.round(Math.min(w, h) / 12));
            const t = (reinforced ? 2 : 1) * cell;
            core.beginFill(colour, 0.95);
            core.drawRect(0, 0, w, t);
            core.drawRect(0, h - t, w, t);
            core.drawRect(0, t, t, h - 2 * t);
            core.drawRect(w - t, t, t, h - 2 * t);
            core.endFill();
            return;
        }

        /*
         * UNDER STAINED GLASS THE FRAME IS A SEAM, AND IT IS THE SAME SEAM AS THE ROOM'S.
         *
         * The pixel frame above is Dawid's decision of 26.08 and Monokuma Legacy keeps it to
         * the pixel - four filled bars a twelfth of the token thick, which at grid 100 is an
         * 8 px slab. This theme asks the opposite of the same marker: not a sprite outline but
         * a join between two pieces of glass, which is a hairline core carrying a wide, faint
         * light. The numbers are the curtain's, taken off `flashOutline` rather than invented a
         * second time: `seamWidth()` for the core, three additive passes at 2.6 / 1.8 / 1.2
         * times it at alpha 0.46 / 0.50 / 0.58, and a blur six times the core in SCREEN pixels,
         * so the light weighs the same at any zoom exactly as it does on the curtain.
         *
         * THE COLOUR IS STILL THE TYPE'S. What changes is the material, not the meaning - a ring
         * says what the trace is, and the room border beside it says the hour. Reading both as
         * glass is the point; reading them as the same colour would not be.
         *
         * THE REINFORCED WEIGHT SURVIVES as a doubled core. It is the one distinction a GM acts
         * on without opening anything, and at 1 px against 2 px on the display it is still the
         * difference between a hairline and a line - which is the difference the curtain itself
         * draws between a seam and a crossing.
         *
         * ONE RECTANGLE, FOUR STROKES. Every pass traces the path the core traces, inset by half
         * the CORE width, so the light straddles the line instead of sitting beside it. Inset by
         * its own half-width each pass would have drawn four rectangles of four different sizes.
         */
        const seam = seamWidth() * (reinforced ? 2 : 1);
        const rect = [seam / 2, seam / 2, Math.max(1, w - seam), Math.max(1, h - seam)];
        core.lineStyle({ width: seam, color: colour, alpha: 1, cap: "square", join: "miter", miterLimit: 2 });
        core.drawRect(...rect);
        /* THE LIGHT, DRAWN ONCE (E88 C1): every trace of one type, size and weight wears one texture of these passes
           and this blur (fog-reveal.mjs `wearHalo`) - 30 Remnants of one type on a GM's screen are one render, not 30
           blurs a frame. The live halo below stays for a browser that cannot make the texture. */
        const shape = ringHalo(w, h, colour);
        if (wearHalo(baked, { seen: token.parent ?? token, key: `remnant|${w}x${h}|${colour}`, seamFactor: reinforced ? 2 : 1, shape })) {
            halo.visible = false;
            halo.filters = null;
            group.drpgRingLight = baked.drpgHaloKey;
            return;
        }
        halo.visible = true;
        shape.draw(halo, seam);
        const Blur = PIXI.BlurFilter ?? PIXI.filters?.BlurFilter;
        // With the glass's blur off the live light is the passes alone, as the baked one is (E88 fix G3, E88-END-02; Q2).
        // The list is kept aside, not dropped, and worn again when the blur comes back: the same filter, retuned below.
        if (!haloBlurOn()) {
            if (halo.filters?.length) halo.drpgLiveFilters = halo.filters;
            halo.filters = null;
        } else if (Blur) {
            if (!halo.filters?.length && halo.drpgLiveFilters) halo.filters = halo.drpgLiveFilters;
            /* The filter is kept and retuned rather than rebuilt: `refreshToken` fires on every
               step a token takes, and a new filter per step is a new shader uniform buffer per
               step on a scene that can carry a dozen traces. */
            let filter = halo.filters?.[0];
            if (!(filter instanceof Blur)) { filter = new Blur(Math.max(6, seam * 6), 3); halo.filters = [filter]; }
            else filter.blur = Math.max(6, seam * 6);
            filter.padding = seam * 14;
        }
    } catch (err) {
        debug("Could not paint a Remnant ring", err);
    }
}

/**
 * What the ring should paint, for whoever is looking.
 *
 * `type`/`reinforced` used to be read straight off the token's own flags,
 * which stopped meaning anything the moment the answer key moved into the
 * ledger (see the header of remnants.mjs) - every ring on the map painted the
 * fallback grey for everyone, GM included, because `placeRemnant` never wrote
 * those flags onto the token in the first place.
 *
 * A GM reads the real type off the ledger and gets the reinforced weight with
 * it. A player reads only what their OWN Truth Bullet currently shows -
 * `shownType`, already "neutral" until Analyze succeeds or the type is
 * self-evident - and never the reinforced weight, which is not part of
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

/**
 * The colour and weight of one frame, whatever kind of token is wearing it.
 *
 * A PROJECT HAS NO TYPE, SO IT DOES NOT ASK FOR ONE. Its token already carries
 * its state as a tint - amber while it is being built, green once it is done
 * (`tintFor` in projects-map.mjs writes one of `PROJECT_TOKEN`'s two colours) -
 * and that tint is on the document this client is already holding. Reading the
 * frame off it means the map cannot disagree with itself: a project whose
 * countdown finished gets the green frame at the same moment its icon turns
 * green, from the same number, with no second lookup that could be stale and no
 * read of the countdown itself, which is hidden from the interface - not from
 * the console (S09-05) - and may not be this client's to show at all.
 *
 * ONE WEIGHT FOR A PROJECT, and that is a decision rather than an omission. The
 * heavy frame means "reinforced" on a trace - the one thing a GM acts on without
 * opening anything. On a project, finished-or-not is already said by the colour,
 * and saying it twice would leave the heavy frame meaning two different things
 * on one map.
 */
export function frameFor(tokenDoc, isRemnant) {
    if (isRemnant) {
        const { type, reinforced } = colourInputsFor(tokenDoc);
        return { colour: type ? colourOf(type) : null, reinforced };
    }
    let colour = PROJECT_FALLBACK;
    try {
        const raw = tokenDoc?.texture?.tint;
        // v13 writes the tint as "#rrggbb"; a Color or a number also answers to `from`.
        if (raw != null && raw !== "") colour = foundry.utils.Color.from(raw).valueOf();
    } catch {
        colour = PROJECT_FALLBACK;
    }
    return { colour, reinforced: false };
}
