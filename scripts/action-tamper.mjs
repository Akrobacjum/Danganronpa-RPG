/**
 * Danganronpa RPG - Tamper.
 * ---------------------------------------------------------------------------
 * The Tamper action: its menu - cover, reshape, frame and, for the killer on
 * their own night, the body (`chooseTamper`) - the choice carried out by
 * cleanup.mjs's own functions (`runTamperChoice`) and `performTamper` itself.
 *
 * WHERE IT SITS. Moved out of action-rolls.mjs by E41 C4 (1.2.97), a pure move
 * that `node tools/moved-only.mjs` proves line by line. Nothing here was
 * exported before; `performTamper` is exported now because `performAction`,
 * which stays in action-rolls.mjs, dispatches to it, and action-rolls.mjs does
 * not re-export it. Nothing here imports action-rolls.mjs (the facade rule,
 * .claude/rules/code.md). Of the action family it reads action-briefing.mjs
 * (`briefingBlock`, `tamperThresholdFacts`) and action-menus.mjs
 * (`chooseVariant`).
 */

import { CLEANUP, RESOLUTION_STRESS_COST } from "./config.mjs";
// The killer's skipped step, for the menu's price (`tamperQuote`). Static:
// cleanup.mjs reaches the action family only through `import()` of
// action-rolls.mjs (action-briefing.mjs imports it for `briefingFacts`).
import { tamperQuote } from "./cleanup.mjs";
import { roomOfActor } from "./movement.mjs";
import { plural, esc } from "./utils.mjs";
// For the Tamper menu's "what you have readied" line (action-project.mjs reads
// use-items.mjs as well). use-items.mjs does not import this file.
import { equippedFor } from "./use-items.mjs";
import { briefingBlock, tamperThresholdFacts } from "./action-briefing.mjs";
import { chooseVariant } from "./action-menus.mjs";
import { tipAttr } from "./ui-kit.mjs";

/* ==========================================================================
 * TAMPER
 * ========================================================================== */

/**
 * Cleaning up, and lying with the evidence, as an ordinary action.
 *
 * NOTHING HERE IS NEW MACHINERY. Both branches end in cleanup.mjs, in the very
 * functions Stage 6 calls, with `viaAction: true` saying which door they came
 * through - see the note at the top of that file. This is the menu, the two
 * lists the menu needs, and nothing else. A second implementation of "erase a
 * trace" would be a second set of thresholds to keep in step with the first.
 *
 * BOTH LISTS ARE FETCHED BEFORE THE MENU OPENS, because both decide whether a
 * row can be offered at all, and a menu that offers you something and then says
 * "actually, no" is the friction `chooseVariant`'s struck-through rows exist to
 * remove. One of the two costs a socket round trip: which traces are yours is a
 * question only a GM's client can answer (trap 85).
 */

/** The Tamper menu: cover, reshape, frame, and - for the killer on their own night - the body. */
async function chooseTamper(actor, def, { erasable, mine, candidates, stageSix, tamperFacts, cleanup }) {
    return chooseVariant({
        actor,
        title: def.label,
        intro: briefingBlock(actor, "tamper", def, { extraFacts: tamperFacts }),
        prompt: game.i18n.localize("DRPG.Tamper.prompt"),
        confirm: game.i18n.localize("DRPG.Action.roll"),
        options: [
            {
                value: "cover", icon: "fa-eraser",
                label: game.i18n.localize("DRPG.Tamper.cover"),
                hint: plural("DRPG.Tamper.coverHint", { n: erasable.length }),
                disabled: !erasable.length,
                // Two different nothings, and the difference is the whole
                // answer: a room with none of your traces in it is a room to
                // walk out of, and a room where every one of them is reinforced
                // is a room where this action will never work.
                why: game.i18n.localize(mine.length
                    ? "DRPG.Tamper.onlyReinforced" : "DRPG.Tamper.nothingOfYours")
            },
            // Z5: the same list of traces as "cover", because it is the same
            // question - which of your traces are you standing over - and a
            // different answer to it. Struck through for the same reason too:
            // there is nothing to relabel if there is nothing here of yours.
            // Red (E22 C5c; A4, audit S02-25): since N-3 a reshape is a GM's to
            // approve (cleanup.mjs `proposeReshape`), and its hint says so and
            // that a refusal gives nothing back. The tile is not red - the other
            // rows resolve by themselves (Q-E21-1 (a)).
            {
                value: "reshape", icon: "fa-pen-nib", gmRoute: true,
                label: game.i18n.localize("DRPG.Cleanup.transformAction"),
                hint: game.i18n.localize("DRPG.Cleanup.transformActionHint"),
                disabled: !erasable.length,
                why: game.i18n.localize(mine.length
                    ? "DRPG.Tamper.onlyReinforced" : "DRPG.Tamper.nothingOfYours")
            },
            {
                value: "frame", icon: "fa-signs-post",
                label: game.i18n.localize("DRPG.Tamper.frame"),
                hint: game.i18n.format("DRPG.Tamper.frameHint", { n: CLEANUP.actions.misleadingTrail.threshold }),
                disabled: !candidates.length,
                why: game.i18n.localize("DRPG.Cleanup.trailNobody")
            },
            // The third row exists only for the person standing over a body
            // they made. Struck through rather than absent when they are not
            // next to it, because "the body is in the other room" is the useful
            // half of that answer.
            ...(stageSix ? [{
                value: "body", icon: "fa-person-falling",
                label: game.i18n.localize("DRPG.Cleanup.moveAction"),
                hint: game.i18n.format("DRPG.Cleanup.moveHint", { n: RESOLUTION_STRESS_COST }),
                disabled: !cleanup.bodyIsHere(actor),
                why: game.i18n.localize("DRPG.Cleanup.bodyNotHere")
            }] : [])
        ],
        // What is readied, said where the clean-up is chosen. The clean-up
        // panel carried this line; the panel is gone and the sentence is not -
        // a Cleaning Tool lowers the number and grants advantage, and a player
        // deciding whether to scrub should know whether they are doing it
        // bare-handed. A line of its own: this window asks no statistic
        // (`cleanupTrait` does, after), and until fix r2-G3 the note was drawn
        // only inside a trait field, so it never showed.
        traitNote: (() => {
            const tool = equippedFor(actor, "cleaningTool");
            return tool
                ? game.i18n.format("DRPG.Cleanup.readied", { item: esc(tool.name) })
                : game.i18n.localize("DRPG.Cleanup.noneReadied");
        })(),
        // The selects are always in the form and the CSS shows the one that
        // belongs to the checked row - the same trick Search's "what
        // specifically" box uses. Reading the wrong one is impossible because
        // the branch below reads by name, not by position.
        extra: `${erasable.length ? `<label class="drpg-specific-note" data-drpg-when="cover">
                <span>${game.i18n.localize("DRPG.Tamper.whichTrace")}</span>
                <select name="trace"${tipAttr("DRPG.Tips.Actions.whichRemnantEraseATooltip")}>${erasable.map(t =>
                    `<option value="${esc(t.id)}">${esc(t.label)}</option>`).join("")}</select>
            </label>
            <label class="drpg-specific-note" data-drpg-when="reshape">
                <span>${game.i18n.localize("DRPG.Tamper.whichTrace")}</span>
                <select name="reshapeTrace"${tipAttr("DRPG.Tips.Actions.whichRemnantEraseATooltip")}>${erasable.map(t =>
                    `<option value="${esc(t.id)}">${esc(t.label)}</option>`).join("")}</select>
            </label>` : ""}${candidates.length ? `<label class="drpg-specific-note" data-drpg-when="frame">
                <span>${game.i18n.localize("DRPG.Cleanup.trailWho")}</span>
                <select name="who"${tipAttr("DRPG.Tips.Actions.frameStudentTooltip")}>${candidates.map(a =>
                    `<option value="${a.id}">${esc(a.name)}</option>`).join("")}</select>
            </label>` : ""}`
    });
}

/** Run what the menu chose. Each road charges itself - see the notes on the branches. */
async function runTamperChoice(actor, picked, { cleanup, erasable, candidates, viaAction }) {
    if (picked.value === "body") {
        // Where the body goes is a decision, not a result, so it is asked
        // before the dice - by the dialog that has always owned that question.
        return cleanup.openMoveBodyDialog(actor);
    }

    if (picked.value === "cover") {
        const traceId = picked.form?.querySelector("[name=trace]")?.value ?? erasable[0]?.id;
        if (!traceId) return null;
        // The price is charged inside - `chargeTamper` takes one step of the
        // chain on both routes, after the concealment roll, and charging here as
        // well would take two (T-1). The row's number goes to the window (E16 C0).
        const row = erasable.find(t => t.id === traceId);
        return cleanup.attemptCleanup(actor, traceId, { viaAction, dc: row?.dc ?? null });
    }

    if (picked.value === "reshape") {
        const traceId = picked.form?.querySelector("[name=reshapeTrace]")?.value
            ?? erasable[0]?.id;
        if (!traceId) return null;
        // Declared before the dice and before anything is charged, so backing
        // out of the question costs nothing at all.
        const change = await cleanup.askTransformChange(actor);
        if (!change) return null;
        const row = erasable.find(t => t.id === traceId);
        return cleanup.attemptCleanup(actor, traceId, {
            viaAction, mode: "transform", change, dc: row?.dc ?? null
        });
    }

    const whoId = picked.form?.querySelector("[name=who]")?.value ?? candidates[0]?.id;
    if (!whoId) return null;
    return cleanup.attemptStageSix(actor, "misleadingTrail", whoId, { viaAction });
}

export async function performTamper(actor, def, options) {
    /*
     * WHAT THE CHAIN WOULD TAKE, ASKED BEFORE THE MENU OPENS (T-1).
     *
     * Nothing is charged here - `chargeTamper` inside cleanup.mjs does that,
     * after the concealment roll, on both roads. All this decides is whether to
     * refuse, and it asks the same two questions the charge will: what the chain
     * can pay, with the killer's own night skipping the action step (D3), and
     * whether a full Sanity track makes a WATCHED attempt impossible.
     *
     * `free` is a GM's bypass only: `performAction` is on the API, and the chain
     * it skips is no longer only an action.
     */
    const { tamperWatchBlock } = await import("./cleanup.mjs");
    const free = Boolean(options.free) && game.user.isGM;
    if (!free) {
        const quote = tamperQuote(actor);
        if (quote.blocked) {
            ui.notifications.warn(quote.blocked);
            return null;
        }
        const watched = await tamperWatchBlock(actor);
        if (watched) {
            ui.notifications.warn(watched);
            return null;
        }
    }

    const room = roomOfActor(actor);
    if (!room) {
        ui.notifications.warn(game.i18n.localize("DRPG.Action.noRoom"));
        return null;
    }

    const { requestCleanableTraces } = await import("./gm-bridge.mjs");
    const cleanup = await import("./cleanup.mjs");

    /*
     * WHICH STAGE IS THIS TILE STANDING IN.
     *
     * Stage 6's three actions used to have a panel of their own under the
     * action grid; they are these three rows now (Dawid, 28.08). One tile, two
     * economies, and `isCleaner` is the whole of the difference:
     *
     *   the killer, in Stage 6   a Sanity mark: their chain skips its action
     *                            step on their own night (D3, T-1). The
     *                            trace list is the WHOLE ROOM, because the
     *                            guide opens their eyes to their own scene.
     *                            Carrying the body is offered.
     *   anybody, any afternoon   an action, or a Sanity mark once the actions
     *                            are gone. The trace list is only what this
     *                            character has actually found (see
     *                            `cleanableTracesForPlayer`). No body.
     */
    const stageSix = cleanup.isCleaner(actor);

    const [mine, candidates] = await Promise.all([
        requestCleanableTraces(actor.id, { mine: !stageSix }),
        cleanup.framingCandidates(actor)
    ]);

    // A reinforced trace is not going anywhere, whoever left it. Kept out of
    // the select rather than shown disabled: Stage 6 shows them because a
    // killer needs to know what they are stuck with, and that is a fact about
    // their crime scene. Here it would be a row you can neither pick nor learn
    // anything from.
    const erasable = mine.filter(t => !t.reinforced);

    const tamperFacts = tamperThresholdFacts(actor, cleanup);

    const picked = await chooseTamper(actor, def, { erasable, mine, candidates, stageSix, tamperFacts, cleanup });

    if (!picked) return null;

    // `viaAction` is the flag that says which economy this is - see the note on
    // `stageSix` above and the header of cleanup.mjs.
    const viaAction = !stageSix;

    return runTamperChoice(actor, picked, { cleanup, erasable, candidates, viaAction });
}
