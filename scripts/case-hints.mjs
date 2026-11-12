/**
 * HINTS AFTER PRESENTATIONS (E99 C4, 12.11.2026; the plan's C4 and Q-E99-13's default, owner to confirm). At the trial
 * the GM's schema marks each input a student presented and, where the presentations would carry a conclusion, shows
 * a hint at it - a hint for the GM, never a tick: a node counts as discovered only when a GM ticks it (Q-E99-2), and
 * nothing here writes (R3664 reads this file for the words of a write).
 *
 * THE RULE is E98's reachability (case-schema.mjs `reachability`) over what was presented instead of what is held:
 * students other than the culprit presented strictly more than half of a conclusion's inputs, a ticked deduction
 * counting as an input, and a bullet only the culprit presented is marked on the schema and counts for nothing.
 *
 * A CARD WITH NO REMNANT BEHIND IT - a bullet copied before E97, or one a GM gave by hand - hints nothing; the
 * answer counts such cards (`unknown`) so the schema can say so to the GM instead of looking as if nobody presented.
 */
import { MODULE_ID } from "./config.mjs";
import { reachability } from "./case-schema.mjs";
import { TRIAL_FLAGS } from "./trial.mjs";
import { secretOf } from "./truth-bullets.mjs";

/**
 * Pure: `presentations` are `{ nodeId, actorId }` (casePresentations); answers `{ presented, hints, unknown }` -
 * the schema's evidence presented (by anyone, in the graph's order), the conclusions hinted and not ticked (in the
 * graph's order), and how many cards named no node of the graph.
 */
export function presentationHints(graph, presentations = [], { culpritId = null, ticks = {} } = {}) {
    const nodes = graph?.nodes ?? [];
    const evidence = new Set(nodes.filter(n => n.evidence).map(n => n.id));
    /* A copy whose key holds the Remnant but not its scene (investigation.mjs `caseReach` matches by the token alone
       for the same reason) is found by its token id. */
    const byToken = new Map(nodes.filter(n => n.evidence && n.trace).map(n => [String(n.trace).split(".").pop(), n.id]));
    const by = {};
    let unknown = 0;
    for (const p of presentations) {
        const id = !p?.nodeId ? null : evidence.has(p.nodeId) ? p.nodeId : byToken.get(String(p.nodeId).split(".").pop()) ?? null;
        if (!id) { unknown++; continue; }
        (by[id] ??= []).push(p.actorId);
    }
    const reach = reachability(graph, by, { culpritId, ticks });
    return {
        presented: nodes.filter(n => n.evidence && by[n.id]).map(n => n.id),
        hints: nodes.filter(n => !n.evidence && reach[n.id]?.reachable && ticks?.[n.id] !== true).map(n => n.id),
        unknown
    };
}

/**
 * The chapter's Present cards as `{ nodeId, actorId }`, in the chat's order (a GM's read: the answer key is the GMs').
 * The presenter is the card's speaker; the bullet is that actor's item the card names, and its trace the GMs' key
 * (`sceneId.remnantId`, the id graphOf gives a Remnant). A withdrawn Objection showed no bullet and is skipped; a
 * refused one showed its bullet and counts. `messages` and `secret` are the world's unless a test plants them.
 */
export function casePresentations(chapter, { messages = null, secret = null } = {}) {
    const flags = TRIAL_FLAGS;
    const list = messages ?? (game.user?.isGM ? game.messages?.contents ?? [] : []);
    const keyOf = secret ?? secretOf;
    const out = [];
    for (const m of list) {
        const flag = k => m?.getFlag?.(MODULE_ID, k);
        if (!flag(flags.present) || flag(flags.chapter) !== chapter || flag(flags.withdrawn)) continue;
        const actorId = m?.speaker?.actor ?? null;
        const itemId = flag(flags.item);
        if (!actorId || !itemId) continue;
        const key = keyOf(`Actor.${actorId}.Item.${itemId}`) ?? {};
        out.push({ nodeId: key.remnantId ? `${key.sceneId ?? ""}.${key.remnantId}` : null, actorId });
    }
    return out;
}
