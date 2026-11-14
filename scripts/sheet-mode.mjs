/**
 * The sheet's mode (E54, the sheet's family): what the person looking at a character sheet may see and do -
 * `sheetMode`, built once a render; the render's mode kept for the row builders (`RENDER_MODES`, `modeOf`); the row's and
 * the header's gates (`rowGate`, `headerGate`); and the sheets open for an actor (`sheetsFor`). A leaf of the family: every
 * other sheet file reads it, and it reads none of them.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS, isMutedDead, myMastermindLair } from "./settings.mjs";
import { isMonokuma, isNotInClass, isSpectator } from "./monokuma.mjs";
import { getClock } from "./clock.mjs";
import { presentRefusal, trialFloor } from "./trial-floor.mjs";
import { isMonocub } from "./monocub.mjs";
import { isDeceased, isDeadForGm } from "./chapter.mjs";
import { isMastermindActor } from "./passages-gm.mjs";

/*
 * ONE SHEET MODE (E45 C1, 08.11.2026; audit S17-37, S03-33; the owner's A8 of 11.10). The gates of the sheet asked
 * their own questions in 27 functions - 57 lines on E24's tip that tested death, a Monocub, a Monokuma, "Not in the
 * class", the mastermind, ownership, the GM's role or `isEditable` each where it drew - and the curtain's strip, the
 * HUD's Objection, the redaction and the room tile asked theirs again. E24 C3a named the row's and the header's in
 * two helpers; this is the one place all of them are built, once a render (`onRenderCharacterSheet` hands the answer
 * to every step through `SHEET_STEPS`; `modeOf` reads it back for a row builder during that render). The answers are
 * the ones those predicates gave (R1455's matrix runs unchanged; R1471 holds every gate), with one change the plan
 * names: a Monokuma's sheet without a student's groups, headings and biography (S03-33).
 *
 * Dead as the person looking may know it (E05 C9, rule C; code.md "Death is two predicates"): on a sheet the viewer
 * owns - their own, or any sheet on a GM - what their browser holds; on anybody else's, the table's fact - so the
 * victim's own player sees the dead panel before anybody has found the body, and nobody else does (E05 C10).
 *
 * Client gates are courtesy: the GM's guards judge every request (D2); the redaction still fails closed
 * (anonymity.mjs `onRenderSheet` closes the sheet on a throw, R1474). The suite hands `facts` ({ clock, record }, as
 * settings.mjs `isMutedDead` takes them) for the trial's phase and its muted dead.
 *
 * @param {Actor} actor
 * @param {User} [user] whose view: this browser's by default
 * @param {{app?: object, editable?: boolean, facts?: object}} [options] `app`, the sheet: its `isEditable` decides the
 *   editable parts; `editable` the suite's answer for it; with neither, whether the user owns the actor
 * @returns {Readonly<object>} the mode; see the fields below
 */
export function sheetMode(actor, user = game.user, { app = null, editable, facts = {} } = {}) {
    const gm = Boolean(user?.isGM);
    const owner = gm || Boolean(typeof actor?.testUserPermission === "function"
        ? actor.testUserPermission(user, "OWNER") : user === game.user && actor?.isOwner);
    const canEdit = editable !== undefined ? Boolean(editable) : app ? Boolean(app.isEditable) : owner;
    // A stand-in with no flags at all (a Party sheet's member read by its uuid, the suite's) is a student of the class.
    const flagged = typeof actor?.getFlag === "function";
    const monokuma = flagged && isMonokuma(actor);
    // A Spectator (E92 C5): a watcher's sheet - no student's panel, Calls, rows, Level Up, strip, OBJECTION! or tile.
    const spectator = flagged && !monokuma && isSpectator(actor);
    const npc = flagged && !spectator && isNotInClass(actor);
    const monocub = flagged && isMonocub(actor);
    const dead = owner ? isDeadForGm(actor) : isDeceased(actor);
    const mode = monokuma ? "monokuma" : spectator ? "spectator" : npc ? "npc" : monocub ? "monocub" : dead ? "dead" : "student";
    // A Monocub's sheet plays on; the dead's and an NPC's header is still (E24 C3a).
    const cub = dead && monocub;
    const header = Object.freeze({ acts: (!dead || cub) && !npc && !spectator, dead, mark: dead && !cub, npc });
    // The action panel, by the order it always asked: a Monokuma's Despair Calls, an NPC's line (to a GM), a Monocub's
    // two tiles, the dead's panel, the student's grid; nothing on a sheet the viewer may not edit.
    const actions = !canEdit || spectator ? null : monokuma ? "calls" : npc ? (gm ? "npc" : null) : monocub ? "monocub" : dead ? "dead" : "grid";
    // The row buttons (D15: a Monocub's body keeps its items, so no Use, Discard or Stash for it either).
    const live = canEdit && !monokuma && !dead && !spectator;
    const rows = Object.freeze({ use: live, equip: live, discard: live, stash: live, give: live, bullets: live });
    // Present (E70 C10): hidden outside a trial, for the table's dead and the trial's muted dead; held by the floor
    // with trial-floor.mjs `presentRefusal`'s line, the Present window's own (trial.mjs). Asked only by the Present
    // button: in a trial the muted dead are the trial's record (`trialProgress`), a setting the strip and the tile do
    // not redraw on, so a mode built for them must not read it (R1013 inside a Class Trial; E45 C1 fix).
    const presentFor = () => (facts.clock ?? getClock())?.phase === "classTrial" && !isDeceased(actor) && !isMutedDead(actor, facts);
    const present = (floor = trialFloor()) => {
        const shown = presentFor();
        return { shown, held: shown ? presentRefusal(floor, actor?.id) : null };
    };
    return Object.freeze({
        mode, gm, owner, viewer: !owner, editable: canEdit, dead, monokuma, npc, monocub, spectator,
        // Dead, and nobody has found them yet (E05 C10): the victim's own player, and a GM.
        unfound: dead && !isDeceased(actor),
        header, actions, rows,
        calls: actions === "grid" || actions === "calls",
        levelUp: !npc && !spectator, offers: owner, init: gm && !monokuma, itemButton: gm && !monokuma, classControls: gm,
        // The Stop is a player's (E49 B2, S03-31): a Monokuma's sheet, a GM's character, draws none.
        safeword: !monokuma && !spectator,
        pipEdit: gm, realBullets: gm, otherRemove: gm && canEdit, creators: gm,
        // A Monokuma's sheet is no student's (S03-33): no student groups, no Equipped or Experience, no biography.
        groups: !monokuma, equipped: !monokuma, experience: !monokuma, biography: !monokuma, inventory: !monokuma,
        passages: owner && !monokuma, mastermind: gm && isMastermindActor(actor),
        // The Mastermind's own room, on their player's browser alone (E91 C4, C5; D038; `injectKnownPassages`).
        lair: owner && !gm && !monokuma ? myMastermindLair() : null,
        present,
        get presentShown() {
            return presentFor();
        },
        // The redaction (anonymity.mjs): another player's sheet, when the table enforces anonymity. Read when asked, so
        // the strip and the tile, which never ask, read no setting that does not redraw them (R1013). A setting that
        // cannot be read redacts: the redaction fails closed (E24 fix G2B; security N-3, R1474).
        get redact() {
            if (owner) return false;
            try {
                return Boolean(game.settings.get(MODULE_ID, SETTINGS.enforceAnonymity));
            } catch {
                return true;
            }
        },
        // The reserve's field (`paintReserves`; E24 C1a, Q-E24-1): on a sheet the viewer may edit, a GM's, or the
        // owner's while "Lock player resources" is off; never on the dead's (a Monocub's plays on) or a Monokuma's
        // (E24 fix G2B; general m1, R1497). Read when asked, as `redact` is; a setting that cannot be read gives none.
        get reserveField() {
            if (!canEdit || monokuma || (dead && !cub)) return false;
            if (gm) return true;
            if (!owner) return false;
            try {
                return !game.settings.get(MODULE_ID, SETTINGS.lockPlayerResources);
            } catch {
                return false;
            }
        },
        // The curtain's strip (player-status.mjs): nothing for a Monokuma or an NPC, the dead's one row, else full.
        strip: monokuma || npc || spectator ? "none" : dead && !monocub ? "dead" : "full",
        // The HUD's OBJECTION! (hud.mjs `objectionControl`): a living student of the class.
        objection: mode === "student",
        // The room tile (room-tile.mjs `viewerRoom`): a body lies in its room and a Monocub walks; an NPC is no student.
        tile: !npc && !spectator
    });
}

/** The mode of the render in progress for `app` (`onRenderCharacterSheet`), or one computed now. */
export const RENDER_MODES = new WeakMap();
export function modeOf(app) {
    return RENDER_MODES.get(app) ?? sheetMode(app?.document, game.user, { app });
}

/**
 * Whether an item row on this sheet carries buttons: an editable sheet, no Monokuma, nobody dead - a Monocub included.
 * Exported with `headerGate` for the suite (R1455); both read `sheetMode` since E45 C1.
 */
export function rowGate(app) {
    return modeOf(app).rows.use;
}

/**
 * What the header says of this character: `acts`, whether Hope, the Actions pips and the free Move are live (a flash,
 * a budget's tooltip, a GM's correction) - the living and a Monocub, never the dead or an NPC not in the class;
 * `dead`, dead as this viewer may know it; `mark`, the death mark on the portrait - the dead, not a Monocub, whose
 * sheet plays on; `npc`, not in the class.
 */
export function headerGate(actor) {
    return sheetMode(actor).header;
}

/** Every open character sheet for this actor. */
export function sheetsFor(actor) {
    return Object.values(actor?.apps ?? {})
        .filter(app => app?.document?.type === "character" && app.element);
}
