/**
 * WHICH STATISTIC A ROLL TAKES, WHEN ITS DEFINITION LISTS SEVERAL (E32+E07 C11b,
 * 02.10.2026; audit S04-23, the owner's Q4 as corrected on 28.09.2026).
 *
 * A crisis action lists several traits ("Rolls: Hand / Leg / Shadow") and rolled
 * the first of them, always: `(variant?.traits ?? def.traits)[0]` in
 * `takeCrisisAction`, with nobody asked. The owner's ruling: wherever the module
 * offers several traits, the player tells the GM in their thread what the
 * character does and a GM picks one of the listed traits; the roll window opens
 * on it, its Statistic select locked ("Chosen by the GM"). The one exception is
 * an armed Resolve (`grants: "trait"`), which buys the player the whole picker -
 * nobody is asked and the window's select is open, as roll-dialog.mjs
 * `lockTrait` has always opened it for that Call.
 *
 * Nothing is spent before the pick: a caller asks here before it pays an action,
 * Sanity or a price, and a refusal or a request not carried out answers null,
 * after which the caller does nothing. A GM's client (a GM's own character, a
 * throw for an absent player) picks in a local window; a player's client asks the
 * primary GM through the bridge (`requestTraitRuling`, gm-bridge.mjs), which puts
 * a veiled card in the player's thread - veiled because the action's name is the
 * incident's - and answers with the GM's pick.
 *
 * The listed traits are read from config on both sides, never carried: the GM's
 * card and the GM's check of the pick (messenger-app.mjs `rulePickTrait`) read
 * this browser's `listedTraits`, and the packet says only which definition.
 *
 * The crisis actions ask (C11b), and so do the openings and Stage 6's rolls
 * (C11c): an opening on a GM's browser alone, since a GM sends it (murder.mjs
 * `rollOpening`; `guardTraitRuling` refuses one from a player), and a clean-up
 * from whoever throws it. A project, and an action of the generic table, are not
 * a kind yet (C11d).
 */
import { TRAITS, CRISIS_ACTIONS, MURDER_OPENING, CLEANUP } from "./config.mjs";
import { pendingCalls } from "./call-effects.mjs";
import { dialogContent, esc } from "./utils.mjs";

/**
 * The traits a definition lists, from this browser's config: `[]` for a kind or
 * key it does not know. `variant` is "indirectVictim" for the table a trap's
 * victim rolls (`def.indirectVictim`), else null. Pure.
 */
export function listedTraits({ kind, key, variant = null } = {}) {
    let def = null;
    if (kind === "crisis" && Object.hasOwn(CRISIS_ACTIONS, key ?? "")) {
        const base = CRISIS_ACTIONS[key];
        def = !variant ? base : variant === "indirectVictim" ? base.indirectVictim ?? null : null;
        // A variant that does not restate the traits rolls the action's own.
        if (def && variant && !def.traits) def = base;
    } else if (kind === "opening" && !variant && Object.hasOwn(MURDER_OPENING, key ?? "")) {
        def = MURDER_OPENING[key];
    } else if (kind === "cleanup" && !variant) {
        // The clean-up itself, or one of Stage 6's actions, which roll the clean-up's list unless they name their own.
        if (key === "cleanup") def = CLEANUP;
        else if (Object.hasOwn(CLEANUP.actions ?? {}, key ?? "")) def = { traits: CLEANUP.actions[key].traits ?? CLEANUP.traits };
    }
    const traits = Array.isArray(def?.traits) ? def.traits : [];
    return traits.filter(t => Object.hasOwn(TRAITS, t));
}

/** Whether a Resolve is armed on this character for its next roll: the one Call that buys the picker. */
function resolveArmed(actor) {
    try {
        return pendingCalls(actor).some(entry => entry?.grants === "trait");
    } catch {
        return false;
    }
}

/**
 * The trait `actor` rolls for the definition `spec` names, or null when the roll
 * is not to be made (the GM refused, the request was not carried out - which the
 * bridge has told the player once - or a GM closed the window).
 *
 * `{ trait, byGm }`: `byGm` true when a GM picked it, so the roll window shows
 * the select locked as the GM's choice (`rollTrait`'s `byGm`). One listed trait is
 * that trait; with Resolve armed the first listed, and the window's picker open.
 * An object rather than the design's bare trait-or-null, because "Resolve: the
 * roller picks" and "refused: nothing happens" would otherwise both be null.
 *
 * `seams` is the suite's (R212): who this browser is, whether Resolve is armed,
 * and the two ways of asking, each defaulting to the real one. One caller outside
 * the suite hands one in: the opening (murder.mjs `rollOpening`), whose roll is a
 * supporting one that every Call is shielded from, so an armed Resolve buys no
 * picker there and the GM picks.
 */
export async function traitFor(actor, spec, seams = {}) {
    const listed = listedTraits(spec);
    if (!listed.length) return null;
    if (listed.length === 1) return { trait: listed[0], byGm: false };
    const armed = seams.resolveArmed ?? resolveArmed;
    if (armed(actor)) return { trait: listed[0], byGm: false };

    const isGm = seams.isGm ?? Boolean(game.user?.isGM);
    const picked = isGm ? await (seams.pickHere ?? pickHere)(actor, spec, listed)
        : await (seams.askGms ?? askGms)(actor, spec);
    return listed.includes(picked) ? { trait: picked, byGm: true } : null;
}

/** A player's client: the request, and the notice that stays up while a GM reads the thread. */
async function askGms(actor, { kind, key, variant = null }) {
    const { showWaiting } = await import("./popup.mjs");
    const waiting = showWaiting(game.i18n.localize("DRPG.TraitRuling.waiting"), game.i18n.localize("DRPG.TraitRuling.title"));
    try {
        // Never from a GM's client, which `traitFor` sends to its own window: the packet would go to itself (R6).
        if (game.user?.isGM) return null;
        const { requestTraitRuling } = await import("./gm-bridge.mjs");
        const res = await requestTraitRuling({ actorId: actor.id, kind, key, variant });
        // `false` is the GM's Refuse; a request not carried out has been told already, by the bridge.
        if (res.ok && res.value === false) ui.notifications.info(game.i18n.localize("DRPG.TraitRuling.refused"));
        return res.ok && typeof res.value === "string" ? res.value : null;
    } finally {
        waiting();
    }
}

/** What the ruling is about, for the GM's window and card: the definition's label. */
export function rulingLabel({ kind, key }) {
    if (kind === "crisis") return CRISIS_ACTIONS[key]?.label ?? key ?? "";
    if (kind === "opening") return MURDER_OPENING[key]?.label ?? key ?? "";
    if (kind === "cleanup") return key === "cleanup" ? CLEANUP.label ?? key : CLEANUP.actions?.[key]?.label ?? key ?? "";
    return key ?? "";
}

/** One trait with this character's value, as the GM's buttons print it. */
export function traitWithValue(actor, trait) {
    const value = Number(actor?.system?.traits?.[TRAITS[trait]?.dh]?.value) || 0;
    return `${TRAITS[trait]?.label ?? trait} (${value > 0 ? "+" : ""}${value})`;
}

/**
 * The class of the GM's window that picks for a kind of roll: the opening's is closed
 * when the incident it was for closes (murder.mjs `revokeOpeningInvitation`), because
 * nothing awaits that window but the invitation it would send.
 */
export const pickWindowClass = kind => `drpg-trait-pick-${kind}`;

/** A GM's client: a button per listed trait, and Cancel. The first is the default. */
async function pickHere(actor, spec, listed) {
    const DialogV2 = foundry.applications.api.DialogV2;
    const picked = await DialogV2.wait({
        classes: ["drpg-panel", "drpg-narrow", pickWindowClass(spec.kind)],
        window: { title: game.i18n.localize("DRPG.TraitRuling.title") },
        content: dialogContent(`<p><strong>${esc(actor?.name ?? "?")}</strong> · ${esc(rulingLabel(spec))}</p>
            <p class="notes">${game.i18n.localize("DRPG.TraitRuling.gmBody")}</p>`),
        buttons: [
            ...listed.map((trait, i) => ({ action: trait, label: traitWithValue(actor, trait), default: i === 0 })),
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });
    return listed.includes(picked) ? picked : null;
}
