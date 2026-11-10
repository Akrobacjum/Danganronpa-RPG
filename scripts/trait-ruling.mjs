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
 * The listed traits are read from config on both sides (a project's from the
 * world), never carried: the GM's card and the GM's check of the pick
 * (messenger-app.mjs `rulePickTrait`) read this browser's `listedTraits`, and the
 * packet says only which definition.
 *
 * The crisis actions ask (C11b), and so do the openings and Stage 6's rolls
 * (C11c): an opening on a GM's browser alone, since a GM sends it (murder-rules.mjs
 * `rollOpening`; `guardTraitRuling` refuses one from a player), and a clean-up
 * from whoever throws it - until E68 C5 (DA4) put Stage 6 on Shadow alone, which asks nobody.
 *
 * OUTSIDE THE INCIDENT NOTHING ASKS (C11d; the owner's rules of 28.09.2026). Search
 * rolls Eye alone, and a Project's roll - Work on it, or a Sabotage of it - the one
 * statistic the project was given when it was made. The one exception is a project
 * stored without one, which both forms allowed until 1.2.66: no world data says which
 * statistic the GM meant, so the first roll on it asks a GM once (kind `project`, key
 * the project's id) and the pick is written to the project (`keepProjectPick`), its
 * statistic from then on. An action of the generic table - a key of ACTIONS with no
 * performer of its own, the kind `generic` that roll-draw.mjs and bridge-guards.mjs name -
 * would ask when its definition lists several; every key has a performer of its own
 * (`OWN_PERFORMERS`), so the table is empty (E41 C1a deleted its fallback, R1230).
 *
 * THE PLAYER PROPOSES, THE GM APPROVES (E68 C1, 10.11.2026; DA18 of 05.10.2026: "Wszedzie gracz
 * ma proponowac, a DM zatwierdzac lub zmieniac"). A caller may hand `traitFor` the statistic the
 * player proposes and a few words of how (`{ proposed, note }`, beside the seams). The proposal is
 * a claim like any packet field: one the definition does not list is dropped here and refused on
 * the GM (`guardTraitRuling`), and the card's buttons are read from the GM's config, never from
 * the packet (`guardTraitRuling`, by `PROPOSAL_NOTE_MAX`). The GM's card then holds three answers: "Approve: {stat}" (the proposal), "Change
 * to: {stat}" (each other listed statistic, only from the list) and "Refuse"; any GM may press
 * one, and one press rules (bridge-asks.mjs `claimCard`, as every card since E18 C3). A GM's own
 * window offers the same, the proposal first. Nothing is spent before the answer and a refusal
 * costs nothing, as before. After a "Change to" the player may still say no (DA46; QUESTIONS.md
 * Q11): their window shows "Roll {stat}" and "I'll pass (nothing spent)", and a pass writes one
 * line in their thread, which the GM reads under the card, and answers null. The roll window
 * says which it was (roll-dialog.mjs `lockTrait`): `byGm` is "approved" or "changed" where a
 * proposal was made, true where the GM picked with none. Without a proposal the card is the one
 * C11b drew: a button per listed statistic and Refuse.
 *
 * THE CALLERS PROPOSE (E68 C4, 10.11.2026). The crisis menu asks for the proposal under the picked row
 * (action-murder.mjs `openCrisisMenu`, the field action-menus.mjs `traitFieldHtml` draws: "Which statistic do
 * you propose?" and "How do you do it? (optional)"), a trap victim's table pre-checked on Body, its first; a
 * project stored without a statistic asks it before its roll (action-project.mjs `projectTrait`), and a
 * Dynamic action carries it to its own card (action-dynamic.mjs `askDynamicDifficulty`). The three exceptions:
 * a trap victim's opening, which a GM picks on its own browser (murder-rules.mjs `openingTraitFor`; the killer's
 * opening proposes from C9), an armed Resolve (above, the roll window's picker) and Search on Eye (one listed
 * statistic until C6, no card on Eye after it). R213 holds every caller of `traitFor` to one or the other.
 *
 * THE VALVE (E68 C2, 10.11.2026; DA41 = 2, DA50 = 1). A world setting, off by default
 * (`autoApproveTraits`), approves a proposal with no GM's press in Daily Life - the clock's phase
 * Daily Life, no Night Eclipse and no incident running - for the definitions of its scope: a
 * Search (`{ kind: "action", key: "search" }`, which lists Eye alone until C6 and so asks nobody
 * yet) and a project stored without a statistic (kind `project`). Never a crisis action, a
 * clean-up, an opening, a Dynamic action (its own card) or Resolve (which asks nobody):
 * `autoApprovable`. On a player's ask the primary GM posts the card as for any proposal and then
 * presses its "Approve" by the click's road (messenger-app.mjs `pressCard`: claimed, ruled by
 * `rulePickTrait`, settled), so the answer, the card's line ("Approved automatically.") and the
 * ruling it keeps (`auto: true`) are the ones a press makes; on a GM's own browser no window opens.
 */
import { TRAITS, CRISIS_ACTIONS, MURDER_OPENING, CLEANUP, ACTIONS } from "./config.mjs";
import { pendingCalls } from "./call-effects.mjs";
import { allProjects } from "./projects.mjs";
import { esc, warn } from "./utils.mjs";
import { drpgWindow } from "./ui-kit.mjs";

/**
 * The actions action-rolls.mjs `performAction` hands to a performer of their own, which
 * decides the statistic its own way; a key of ACTIONS not listed here would be the kind
 * `generic` here, and `performAction`'s switch has no default for one (E41 C1a). A copy
 * of that switch's cases, and R213 holds the two together.
 */
export const OWN_PERFORMERS = Object.freeze(["move", "dynamic", "search", "project", "sabotage", "tamper", "palm",
    "analyze", "rest", "listen", "observe", "directMurder"]);

/**
 * The definition a spec names, from this browser's config (a project's, from the
 * world), or null for a kind or key it does not know. `variant` is "indirectVictim"
 * for the table a trap's victim rolls (`def.indirectVictim`), else null. `part` names a
 * part of an action of kind `action` that names a statistic of its own.
 */
function definitionOf({ kind, key, variant = null, part = null } = {}) {
    if (kind === "crisis" && Object.hasOwn(CRISIS_ACTIONS, key ?? "")) {
        const base = CRISIS_ACTIONS[key];
        const def = !variant ? base : variant === "indirectVictim" ? base.indirectVictim ?? null : null;
        // A variant that does not restate the traits rolls the action's own.
        return def && variant && !def.traits ? base : def;
    }
    if (variant) return null;
    if (kind === "opening" && Object.hasOwn(MURDER_OPENING, key ?? "")) return MURDER_OPENING[key];
    // The clean-up itself, or one of Stage 6's actions, which roll the clean-up's list unless they name their own.
    if (kind === "cleanup" && key === "cleanup") return CLEANUP;
    if (kind === "cleanup" && Object.hasOwn(CLEANUP.actions ?? {}, key ?? "")) {
        return CLEANUP.actions[key].traits ? CLEANUP.actions[key] : CLEANUP;
    }
    if (kind === "generic" && Object.hasOwn(ACTIONS, key ?? "") && !OWN_PERFORMERS.includes(key)) return ACTIONS[key];
    // An action of the table whoever performs it, whole or the part of it that names a statistic of
    // its own (a Palm's `unseen`, its cover): what a drawn roll of it is held to where it lists one
    // (roll-draw.mjs `listedFor`, the `fixed` row; E29 fix r1-G10).
    if (kind === "action" && Object.hasOwn(ACTIONS, key ?? "")) {
        if (!part) return ACTIONS[key];
        const piece = Object.hasOwn(ACTIONS[key], part) ? ACTIONS[key][part] : null;
        return typeof piece?.trait === "string" ? { traits: [piece.trait] } : null;
    }
    if (kind === "project") {
        // A project with a statistic rolls it; one without asks, from the list a statistic is given from.
        const project = allProjects().find(p => p.id === key);
        if (!project) return null;
        return project.trait ? { traits: [project.trait] } : ACTIONS.project;
    }
    return null;
}

/** The traits a definition lists: `[]` for a kind or key this browser does not know. */
export function listedTraits(spec = {}) {
    const def = definitionOf(spec);
    const traits = Array.isArray(def?.traits) ? def.traits : [];
    return traits.filter(t => Object.hasOwn(TRAITS, t));
}

/**
 * Every definition of config a ruling can be asked about, by identity, for R213: a
 * definition that lists several traits and is not here would be rolled without a GM.
 * Sabotage beside Projects: a Sabotage rolls the statistic of the project it targets,
 * and its four traits are the same list a project's statistic is given from.
 */
export function ruledDefinitions() {
    const specs = [
        ...Object.keys(CRISIS_ACTIONS).flatMap(key => [{ kind: "crisis", key }, { kind: "crisis", key, variant: "indirectVictim" }]),
        ...Object.keys(MURDER_OPENING).map(key => ({ kind: "opening", key })),
        ...["cleanup", ...Object.keys(CLEANUP.actions ?? {})].map(key => ({ kind: "cleanup", key })),
        // Search on six (E68 C6): its own definition, ruled under the kind `action`.
        { kind: "action", key: "search" },
        ...Object.keys(ACTIONS).map(key => ({ kind: "generic", key }))
    ];
    const defs = new Set([...specs.map(definitionOf), ACTIONS.project, ACTIONS.sabotage]);
    defs.delete(null);
    return defs;
}

/**
 * Whether a Resolve is armed on this character for its next roll: the one Call that buys the
 * picker. Exported for the crisis menu, which says who will pick (action-murder.mjs `crisisDetails`).
 */
export function resolveArmed(actor) {
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
 * the suite hands one in: the opening (murder-rules.mjs `rollOpening`), whose roll is a
 * supporting one that every Call is shielded from, so an armed Resolve buys no
 * picker there and the GM picks.
 */
export async function traitFor(actor, spec, seams = {}) {
    const listed = listedTraits(spec);
    if (!listed.length) return null;
    if (listed.length === 1) return { trait: listed[0], byGm: false };
    const armed = seams.resolveArmed ?? resolveArmed;
    if (armed(actor)) return { trait: listed[0], byGm: false };

    // The proposal, where the caller has one: a statistic the definition lists, and the player's words, bounded.
    const proposal = proposalOf(seams, listed);
    const isGm = seams.isGm ?? Boolean(game.user?.isGM);
    // The valve (C2): a GM's own proposal of its scope is approved here, with no window; a player's, on the primary.
    if (isGm && proposal.proposed && (await (seams.autoApprovable ?? autoApprovable)(spec))) {
        await keepProjectPick(spec, proposal.proposed);
        return { trait: proposal.proposed, byGm: "approved" };
    }
    // `onPass` (E68 C4): told when the player passes after a "Change to", which answers null as a refusal does -
    // the crisis menu opens again on it (QUESTIONS.md Q11), and a refusal ends the turn's choice as before.
    const picked = isGm ? await (seams.pickHere ?? pickHere)(actor, spec, listed, proposal)
        : await (seams.askGms ?? askGms)(actor, spec, { ...proposal, onPass: seams.onPass });
    if (!listed.includes(picked)) return null;
    // A player's pick is kept by the GM who answered the card (messenger-app.mjs `rulePickTrait`).
    if (isGm) await keepProjectPick(spec, picked);
    return { trait: picked, byGm: !proposal.proposed ? true : picked === proposal.proposed ? "approved" : "changed" };
}

/** The definitions the valve may approve (C2), by kind and key; a key of null is any key of that kind. */
const AUTO_SCOPE = Object.freeze([Object.freeze({ kind: "action", key: "search" }), Object.freeze({ kind: "project", key: null })]);

/**
 * Whether the valve approves a proposal for `spec` in the state named (C2): the setting `on`, the clock's `phase`
 * "dailyLife", no Night Eclipse (`eclipse`) and no incident (`incident`), and a definition of `AUTO_SCOPE` with no
 * variant. Pure, for the suite (R3150); `autoApprovable` reads the state off this world.
 */
export function autoApprovableIn(spec = {}, { on = false, phase = null, eclipse = false, incident = false } = {}) {
    if (on !== true || phase !== "dailyLife" || eclipse || incident || spec?.variant) return false;
    return AUTO_SCOPE.some(row => row.kind === spec?.kind && (row.key === null || row.key === spec?.key));
}

/** The same, on this world: the setting, the clock, the Eclipse and the incident as this browser holds them. */
export async function autoApprovable(spec = {}) {
    try {
        const { SETTINGS, getSetting, getClock, isEclipse } = await import("./settings.mjs");
        const { murderState } = await import("./murder.mjs");
        return autoApprovableIn(spec, { on: getSetting(SETTINGS.autoApproveTraits) === true, phase: getClock()?.phase ?? null,
            eclipse: Boolean(isEclipse()), incident: Boolean(murderState()?.active) });
    } catch {
        return false;
    }
}

/** The longest note of how a proposal is carried out, in characters: a sentence or two, said on the GM's card. */
export const PROPOSAL_NOTE_MAX = 280;

/**
 * `{ proposed, note }` as a ruling carries them: `proposed` a statistic `listed` names, else null; `note` the
 * player's words trimmed to `PROPOSAL_NOTE_MAX`, else "". Read on both sides: the asker drops what it would
 * be refused for, and the GM's guard refuses a packet whose proposal is off the list or whose note is longer
 * (bridge-guards.mjs `guardTraitRuling`).
 */
export function proposalOf({ proposed = null, note = "" } = {}, listed = []) {
    const trait = typeof proposed === "string" && listed.includes(proposed) ? proposed : null;
    const words = typeof note === "string" ? note.trim().slice(0, PROPOSAL_NOTE_MAX) : "";
    return { proposed: trait, note: words };
}

/**
 * The buttons a proposal's answer offers, in order, for the GM's window and the card: "Approve: {stat}" first,
 * then "Change to: {stat}" for each other listed statistic; with no proposal a button per listed statistic.
 * `{ trait, label, how }`, `how` "approve", "change" or "pick".
 */
export function proposalChoices(actor, listed, proposed = null) {
    const stat = trait => traitWithValue(actor, trait);
    if (!proposed || !listed.includes(proposed)) return listed.map(trait => ({ trait, label: stat(trait), how: "pick" }));
    return [{ trait: proposed, label: game.i18n.format("DRPG.TraitRuling.approve", { stat: stat(proposed) }), how: "approve" },
        ...listed.filter(t => t !== proposed).map(trait => ({ trait, label: game.i18n.format("DRPG.TraitRuling.change", { stat: stat(trait) }), how: "change" }))];
}

/**
 * A GM's pick for a project stored without a statistic is written to the project, so
 * it is that project's statistic from then on and nobody is asked again (C11d). On a
 * GM's browser only - project data is the world's - and for kind `project` only; the
 * rest are a no-op. The project's statistic is public data every browser holds, as a
 * statistic given at creation always was.
 */
export async function keepProjectPick(spec, trait) {
    if (spec?.kind !== "project" || !game.user?.isGM || !Object.hasOwn(TRAITS, trait ?? "")) return null;
    const { updateProject } = await import("./projects.mjs");
    return updateProject(spec.key, { trait });
}

/** A player's client: the request, and the notice that stays up while a GM reads the thread. */
async function askGms(actor, { kind, key, variant = null }, { proposed = null, note = "", onPass = null } = {}) {
    const { showWaiting } = await import("./popup.mjs");
    const waiting = showWaiting(game.i18n.localize("DRPG.TraitRuling.waiting"), game.i18n.localize("DRPG.TraitRuling.title"));
    let answer = null;
    try {
        // Never from a GM's client, which `traitFor` sends to its own window: the packet would go to itself (R6).
        if (game.user?.isGM) return null;
        const { requestTraitRuling } = await import("./gm-bridge.mjs");
        const res = await requestTraitRuling({ actorId: actor.id, kind, key, variant, proposed, note });
        // `false` is the GM's Refuse; a request not carried out has been told already, by the bridge.
        if (res.ok && res.value === false) ui.notifications.info(game.i18n.localize("DRPG.TraitRuling.refused"));
        answer = res.ok && typeof res.value === "string" ? res.value : null;
    } finally {
        waiting();
    }
    // A "Change to": the player rolls the GM's statistic or passes, and nothing was spent either way (DA46, Q11).
    if (answer && proposed && answer !== proposed && !(await rollChanged(actor, proposed, answer))) {
        onPass?.();
        return null;
    }
    return answer;
}

/**
 * The player's window after a GM's "Change to" (DA46; QUESTIONS.md Q11): "Roll {stat}" or "I'll pass (nothing
 * spent)". True to roll. A pass, or the window closed, is a pass: one line in the player's thread says it, so
 * the GM reads it under the card (messenger.mjs `sendMessage`, the thread's own road), and the caller does nothing.
 */
async function rollChanged(actor, proposed, trait) {
    const stat = t => TRAITS[t]?.label ?? t;
    const chosen = await drpgWindow({
        classes: ["drpg-panel", "drpg-narrow", "drpg-trait-changed"],
        prompt: true,
        title: game.i18n.localize("DRPG.TraitRuling.changedTitle"),
        body: `<p><strong>${esc(actor?.name ?? "?")}</strong></p>
            <p>${esc(game.i18n.format("DRPG.TraitRuling.changedBody", { proposed: stat(proposed), stat: stat(trait) }))}</p>`,
        footer: { primary: { action: "roll", label: game.i18n.format("DRPG.TraitRuling.rollIt", { stat: stat(trait) }) },
            secondary: [{ action: "pass", label: game.i18n.localize("DRPG.TraitRuling.pass") }], close: "pass" },
        rejectClose: false
    });
    if (chosen === "roll") return true;
    try {
        const { sendMessage } = await import("./messenger.mjs");
        await sendMessage(game.user.id, game.i18n.format("DRPG.TraitRuling.passedLine", { stat: stat(trait) }));
    } catch (err) {
        warn("The pass after a GM's change of statistic could not be written in the thread.", err);
    }
    return false;
}

/** What the ruling is about, for the GM's window and card: the definition's label. */
export function rulingLabel({ kind, key }) {
    if (kind === "crisis") return CRISIS_ACTIONS[key]?.label ?? key ?? "";
    if (kind === "opening") return MURDER_OPENING[key]?.label ?? key ?? "";
    if (kind === "cleanup") return key === "cleanup" ? CLEANUP.label ?? key : CLEANUP.actions?.[key]?.label ?? key ?? "";
    if (kind === "project") return allProjects().find(p => p.id === key)?.name ?? key ?? "";
    if (kind === "generic" || kind === "action") return ACTIONS[key]?.label ?? key ?? "";
    return key ?? "";
}

/** One trait with this character's value, as the GM's buttons print it. */
export function traitWithValue(actor, trait) {
    const value = Number(actor?.system?.traits?.[TRAITS[trait]?.dh]?.value) || 0;
    return `${TRAITS[trait]?.label ?? trait} (${value > 0 ? "+" : ""}${value})`;
}

/**
 * The class of the GM's window that picks for a kind of roll: the opening's is closed
 * when the incident it was for closes (murder-rules.mjs `revokeOpeningInvitation`), because
 * nothing awaits that window but the invitation it would send.
 */
export const pickWindowClass = kind => `drpg-trait-pick-${kind}`;

/**
 * A GM's client: a button per listed trait, and Cancel. The first is the default: on the kit (E21 C4) the primary, on the
 * right and the first submit button; the others secondaries on the left, after Cancel, in the list's order.
 */
async function pickHere(actor, spec, listed, { proposed = null, note = "" } = {}) {
    const [first, ...rest] = proposalChoices(actor, listed, proposed).map(({ trait, label }) => ({ action: trait, label }));
    const said = proposed ? `<p>${esc(game.i18n.format("DRPG.TraitRuling.proposed", { stat: TRAITS[proposed]?.label ?? proposed }))}${
        note ? ` · <em>${esc(note)}</em>` : ""}</p>` : "";
    const picked = await drpgWindow({
        classes: ["drpg-panel", "drpg-narrow", pickWindowClass(spec.kind)],
        // A GM's ruling the roll waits on: kept above the sheet (stacking.mjs; E23 C5a).
        prompt: true,
        title: game.i18n.localize("DRPG.TraitRuling.title"),
        body: `<p><strong>${esc(actor?.name ?? "?")}</strong> · ${esc(rulingLabel(spec))}</p>${said}
            <p class="notes">${game.i18n.localize(proposed ? "DRPG.TraitRuling.gmBodyProposed" : "DRPG.TraitRuling.gmBody")}</p>`,
        footer: { primary: first, secondary: rest, close: "cancel" },
        rejectClose: false
    });
    return listed.includes(picked) ? picked : null;
}
