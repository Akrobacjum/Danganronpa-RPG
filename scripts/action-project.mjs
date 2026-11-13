/**
 * Danganronpa RPG - Work on Project and Sabotage.
 * ---------------------------------------------------------------------------
 * A project from its window to its progress: `performProject`, a project
 * proposed (`startProject`: one window, its request and its one Send on the
 * GM's road, since E22 C5c) or worked on (`workOnProject`), the progress a
 * roll makes (`projectProgress`) and the extras it is held to
 * (`CONCEALED_WITH_DESPAIR`, `PROJECT_BONUS_MOST`, `heldTo`, `reliefHeld`,
 * `projectExtrasHeld`), an indirect murder's concealment and traces
 * (`concealProjectIntent`, `hideProjectTraces`), and the project picker
 * (`projectOptionsHtml`, `projectTrait`, `chooseProject`). Then the Sabotage:
 * `performSabotage`, its targets (`sabotageTargets`), its concealment and who
 * watched (`concealSabotage`, `sabotageWatchedLine`), its bar and hit
 * (`sabotageBar`, `sabotageHit`, `sabotageExtrasHeld`), the repair a hit
 * leaves (`sabotageRepairScale`, which the primary GM's derive reads in
 * gm-bridge.mjs and a Reroll in reroll.mjs), its trace (`dropSabotageTrace`)
 * and its sound (`soundSabotage`).
 *
 * WHERE IT SITS. Moved out of action-rolls.mjs by E41 C4 (1.2.97), a pure move
 * that `node tools/moved-only.mjs` proves line by line. The Sabotage lives
 * with the project because `performProject` calls `performSabotage`, which
 * calls `chooseProject` and `projectTrait`: two files would import each
 * other. action-rolls.mjs re-exports the 9 names here it exported before, so
 * every importer still imports action-rolls.mjs, and nothing here imports it
 * back (the facade rule, .claude/rules/code.md). `performProject` and
 * `performSabotage` are exported now because `performAction`, which stays
 * there, dispatches to them; action-rolls.mjs does not re-export them. Of the
 * action family it reads the shared layer and action-listen.mjs
 * (`listenLabels`: a new project names the rooms beyond a wall as Listen
 * names them).
 */

import { MODULE_ID, ACTIONS, TRAITS, INDIRECT_MURDER, PROJECT_SCALE, SABOTAGE_CONCEAL } from "./config.mjs";
import { facilityLineFor } from "./facilities.mjs";
import { spendAction, refundAction } from "./actions.mjs";
import { carriedFor, repairable } from "./inventory.mjs";
import { roomOfActor, othersInRoom, locateActor } from "./movement.mjs";
import {
    addProgress, isIndirectMurder, isSecret, projectsListedIn, buildsOwnMurder, projectLabel
} from "./projects.mjs";
import { callGm } from "./gm-bridge.mjs";
import { announce, resolveThreshold, whisperToOwner, plural, cardHead, esc, easedBy } from "./utils.mjs";
import { equippedFor, tierOf } from "./use-items.mjs";
import { playSfx } from "./sfx.mjs";
import {
    toolRelief, rollTrait, neededNote, rollInHand, remnantRef, noteRollContext, abort, spentAfterRoll, canAfford,
    roomAudience
} from "./action-pipeline.mjs";
import { report } from "./action-report.mjs";
import { briefingBlock } from "./action-briefing.mjs";
import { actionWindow, chooseVariant, requestFieldHtml, readRequestField, traitFieldHtml, readProposal } from "./action-menus.mjs";
import { listenLabels } from "./action-listen.mjs";
import { drpgWindow, formGrid, helpText, box } from "./ui-kit.mjs";

/* ==========================================================================
 * PROJECTS
 * ========================================================================== */

/** Start something new (GM ruling) or push an existing project (automatic). */
export async function performProject(actor, def, options) {
    const { projectsAvailableIn } = await import("./projects.mjs");
    // Where the character stands, the room and its scene: a project is listed on its own scene only (E12 fix r1-G3).
    const place = locateActor(actor);
    const room = place?.room ?? null;
    const here = room ? projectsAvailableIn(place) : [];

    // ONE WINDOW: which kind of work, and WHICH project.
    //
    // It used to be two - pick "Work on", then pick the project on a screen of
    // its own. Sabotage never did that; it asked for its target and its
    // statistic together, and there was never a reason for the two to differ.
    // The second window carried one <select> and a button.
    //
    // The list rides along as `extra`, the same way Search's "what
    // specifically" textarea does: it belongs to exactly one of the two rows,
    // and a window of its own is the friction this pattern exists to remove.
    //
    // "Work on" is struck through rather than missing when there is nothing
    // here to push - the reason is the useful half of the answer, and a player
    // who cannot see the option cannot tell whether they are in the wrong room
    // or the module has forgotten the project exists.
    //
    // No statistic is asked here any more (E32+E07 C11d; the owner's rules of
    // 28.09.2026): Work on a project and a Sabotage of it roll the project's own,
    // and a project stored without one asks a GM once (`projectTrait`).

    /*
     * THE THIRD ROW: BREAKING ONE.
     *
     * Sabotage stopped being a tile of its own in E12 and became the other
     * thing you can do to a project in the room you are standing in. That is
     * what it always was - it uses the project's own trait, it is refused
     * outside the room, and it sat on the grid next to a tile that opened a
     * list of the very same objects.
     *
     * The question the tile used to answer by going dark is answered here as a
     * struck-through row instead, which is strictly more: "nothing here to
     * break" now appears an inch from "propose one", where before it was a
     * closed door with the alternative on a different tile.
     *
     * Both halves of the old check, verbatim. `isMonokuma(actor)` alone and not
     * `game.user.isGM ||` - a GM opening a student's sheet is still a student
     * standing in one room.
     */
    const { isMonokuma } = await import("./monokuma.mjs");
    const { sabotageTargetsIn } = await import("./projects.mjs");
    const breakable = sabotageTargetsIn(place, { anyRoom: isMonokuma(actor) });

    const picked = await chooseVariant({
        actor,
        title: def.label,
        intro: briefingBlock(actor, "project", def),
        prompt: game.i18n.localize("DRPG.Project.choosePrompt"),
        // Work and Sabotage roll; Propose leads to the proposal's window, whose button sends it (E100 item 6, R4105).
        confirm: game.i18n.localize("DRPG.Action.roll"),
        options: [
            {
                value: "work", icon: "fa-hammer",
                label: game.i18n.localize("DRPG.Project.workOn"),
                hint: plural("DRPG.Project.workOnHint", { n: here.length }),
                disabled: !here.length,
                // The room by name (E47-FB, comparison 2's ac049): `noneHere` carries `{room}`, and a `localize` of it
                // put the raw "{room}" on the row in both languages since the row was written.
                why: room ? game.i18n.format("DRPG.Project.noneHere", { room })
                    : game.i18n.localize("DRPG.Action.noRoomNote")
            },
            {
                value: "start", icon: "fa-lightbulb", gmRoute: true, confirm: game.i18n.localize("DRPG.Action.next"),
                label: game.i18n.localize("DRPG.Project.startNew"),
                hint: game.i18n.localize("DRPG.Project.startNewHint")
            },
            {
                value: "sabotage", icon: ACTIONS.sabotage.icon,
                label: ACTIONS.sabotage.label,
                hint: plural("DRPG.Project.sabotageHint", { n: breakable.length }),
                disabled: !breakable.length,
                why: game.i18n.localize("DRPG.Project.nothingToSabotage")
            }
        ],
        // Both targets ride along (ROLL-12): which project to push, and which
        // to break. Sabotage used to open a second window that asked for the
        // same two things this one already showed.
        //
        // EACH UNDER ITS OWN ROW (E51 fix round FG4, 31.10.2026; the owner at the table: "Which project?" and
        // "Sabotage which project?" stood on screen together whatever was picked). Each select names the row it
        // belongs to (`data-drpg-when`, the stylesheet's variant menu rule); Propose shows neither. Both stay in the
        // form, so the branches below read the picked one by name after the window has closed. Tier 1's R1142 holds
        // the attribute and the cascade, tier 2's E51-T28 the window as drawn and its reading.
        extra: `${here.length
            ? `<label class="drpg-specific-note" data-drpg-when="work">
                <span>${game.i18n.localize("DRPG.Project.whichWork")}</span>
                <select name="project">${projectOptionsHtml(here)}</select>
            </label>`
            : ""}${breakable.length
            ? `<label class="drpg-specific-note" data-drpg-when="sabotage">
                <span>${game.i18n.localize("DRPG.Project.whichSabotage")}</span>
                <select name="sabotage">${projectOptionsHtml(breakable)}</select>
            </label>`
            : ""}`
    });

    if (!picked) return null;
    if (picked.value === "start") return startProject(actor);
    // Straight through to the action it always was - its own concealment roll,
    // its own trace - with the target read off THIS window.
    if (picked.value === "sabotage") {
        const target = breakable.find(pr => pr.id === picked.form?.querySelector("[name=sabotage]")?.value)
            ?? breakable[0];
        return performSabotage(actor, ACTIONS.sabotage, options, { project: target });
    }

    // The window is closed by now, but `chooseVariant` hands back the form it
    // was read from, so the field is still there to be read.
    const chosen = here.find(pr => pr.id === picked.form?.querySelector("[name=project]")?.value)
        ?? here[0];
    return workOnProject(actor, def, options, { project: chosen });
}

/**
 * Propose a project: one window, and the GM's card it sends.
 *
 * The form's answers and the player's own sentence for the GM go out on one
 * card in the player's thread (`callGm`); nothing exists in the world until a GM
 * approves it there (`approveProject`). Answers `{ proposed, name }`, or null when
 * nothing was sent. Exported for the suite (R1370, E22-T4).
 */
export async function startProject(actor) {
    const { allRooms } = await import("./movement.mjs");
    const { projectTraitOptions, descriptionField, guardDescription, descriptionRefusal, presetDescription, wirePresetDescription, projectWindowWidth } = await import("./projects-ui.mjs");
    const { projectDescriptionProblem } = await import("./config.mjs");
    const room = roomOfActor(actor);
    // The rooms of the scene the character stands on (E12 C2a): the project is started where they are.
    const rooms = allRooms(locateActor(actor)?.scene);

    const scaleOptions = Object.entries(PROJECT_SCALE)
        .map(([key, s]) => `<option value="${s.progress}"${key === "everyday" ? " selected" : ""}>${s.label} - ${s.progress} progress</option>`)
        .join("");
    const roomOptions = [
        `<option value="">${game.i18n.localize("DRPG.Project.anyRoom")}</option>`,
        ...rooms.map(r => `<option value="${foundry.utils.escapeHTML(r)}"${r === room ? " selected" : ""}>${foundry.utils.escapeHTML(r)}</option>`)
    ].join("");

    /*
     * A SECRET PASSAGE, WHERE THIS ROOM SHARES A WALL (E15 part 2 C2, 25.10.2026; A10 step 14). Offered only when the
     * room the character stands in shares a wall with another room on its floor (passages-gm.mjs `secretPassageOffer`,
     * read here from the walls and rooms every browser holds); the rooms beyond are named as Listen names them - a room
     * this player has not been in is "Unexplored room n" (`listenLabels`) - and the options carry an index, so the
     * page names no room the fog hides. What the card asks is a claim: the GM's approval reads the builder's room
     * where the GMs read the character and picks the stretch on that wall (projects-ui.mjs `openProjectDialog`).
     */
    const { secretPassageOffer, passageProjectOffer, presetScale, PASSAGE_PRESETS } = await import("./passages-gm.mjs");
    const { levelOf } = await import("./rooms.mjs");
    const { roomsKnownToMe, passageRooms } = await import("./movement.mjs");
    const here = locateActor(actor);
    const offer = here?.room ? secretPassageOffer({ scene: here.scene, room: here.room, level: levelOf(here.tokenDoc) }) : null;
    const beyond = offer ? listenLabels(offer.neighbours, roomsKnownToMe(here.scene)) : new Map();
    /*
     * THE OWNER'S THREE OF 15.10 (E15 part 2 C5): Seal the passage, offered with the passages this character knows that
     * have a side in the room it stands in (this browser's copy, passages.mjs `knownPassages`); Close the breach, with
     * the standing breaches of that room (their holes are walls every browser holds); Repair an item, with the usables
     * and tools of its own sheet that are broken or worn (inventory.mjs `repairable`). The rooms are named as Listen names
     * them and each option is an index: the card carries the passage's, the breach's or the item's id, which this
     * player's browser holds already, and the GM's approval judges it again (projects-ui.mjs `openProjectDialog`).
     */
    const { knownPassages } = await import("./passages.mjs");
    const owned = here?.room ? passageProjectOffer({ scene: here.scene, room: here.room, level: levelOf(here.tokenDoc) },
        { known: knownPassages(), actorId: actor.id, sides: passageRooms }) : { seal: [], breaches: [] };
    const named = rooms => {
        const labels = listenLabels(rooms.filter(Boolean), roomsKnownToMe(here?.scene));
        return rooms.map(r => (r ? labels.get(r) ?? r : "-")).join(" - ");
    };
    const mendable = (actor.items?.contents ?? [...(actor.items ?? [])]).filter(repairable);
    /* REPAIR THE LOCK (E74 C5): offered where a door of this room - the room itself or a neighbour - has a lock forced open
       (the public flag every browser holds, movement.mjs `roomBroken`); the GM's approval judges it again, with whether a
       project repairs it already, which this browser cannot see. */
    const { roomBroken, neighbouringRooms } = await import("./movement.mjs");
    const lockable = here?.room ? [here.room, ...neighbouringRooms(here.scene, here.room)].filter(room => roomBroken(here.scene, room)) : [];
    const kinds = [...(offer ? ["secretPassage", "breach"] : []), ...(owned.seal.length ? ["sealPassage"] : []),
        ...(owned.breaches.length ? ["closeBreach"] : []), ...(mendable.length ? ["repairItem"] : []), ...(lockable.length ? ["repairLock"] : [])];
    const esc1 = text => foundry.utils.escapeHTML(String(text ?? ""));
    /* ON THE KIT'S `formGrid` (E47-C6, 09.11.2026; card M19, approved by the owner on 09.11 with one change): a field with
       a caption is a row of the grid - the caption, then the field with its notes in the kit's fine print - and the rest
       lines across both, in the order they had (D31). The change: "Say what you are actually doing" takes the form's
       full width ("za waskie pole do wypelnienia w stained glass" - too narrow a field under Stained Glass), a line of
       its own, not a row. The agreement's warning is the kit's warning box. */
    const uid = foundry.utils.randomID(6);
    const idOf = name => `drpg-propose-${name}-${uid}`;
    const choose = (name, label, options, note) => ({ label: game.i18n.localize(label), id: idOf(name),
        field: `<select name="${name}" id="${idOf(name)}">${options.map((text, i) => `<option value="${i}">${esc1(text)}</option>`).join("")}</select>
                ${note.map(key => helpText(key)).join("")}` });
    const presetRows = kinds.length ? [
        { label: game.i18n.localize("DRPG.Project.kind"), id: idOf("preset"),
            field: `<select name="preset" id="${idOf("preset")}"><option value="">${game.i18n.localize("DRPG.Project.kindOwn")}</option>${
                kinds.map(key => `<option value="${key}">${game.i18n.localize(`DRPG.Project.preset.${key}`)}</option>`).join("")}</select>` },
        ...(offer ? [choose("to", "DRPG.Project.passageTo", offer.neighbours.map(r => beyond.get(r) ?? r), ["DRPG.Project.passageNote", "DRPG.Project.breachNote"])] : []),
        ...(owned.seal.length ? [choose("seal", "DRPG.Project.sealWhich", owned.seal.map(p => named(p.rooms)), ["DRPG.Project.sealNote"])] : []),
        ...(owned.breaches.length ? [choose("unbreach", "DRPG.Project.unbreachWhich", owned.breaches.map(b => named(b.rooms)), ["DRPG.Project.unbreachNote"])] : []),
        ...(mendable.length ? [choose("mend", "DRPG.Project.repairWhich", mendable.map(i => game.i18n.format("DRPG.Project.repairOption", { item: i.name, tier: tierOf(i) })),
            ["DRPG.Project.repairNote"])] : []),
        ...(lockable.length ? [choose("lockfix", "DRPG.Project.repairLockWhich", lockable.map(r => named([r])), ["DRPG.Project.repairLockNote"])] : [])] : [];

    // On the kit's frame (E21 C5a): the proposal is the GM's road (D11), its one answer; Cancel withdraws it.
    const result = await drpgWindow({
        title: game.i18n.localize("DRPG.Project.startNew"),
        classes: ["drpg-panel", "drpg-project-form"],
        // Today's width, or the kit's `wide` where this person's setting asks for it (E47-C6; the owner's O4).
        width: projectWindowWidth(),
        body: `<form>${formGrid([
            { full: box("warning", game.i18n.localize("DRPG.Project.agreedWarning")) },
            ...presetRows,
            { label: game.i18n.localize("DRPG.Project.name"), id: idOf("name"),
                field: `<input type="text" name="name" id="${idOf("name")}" placeholder="${game.i18n.localize("DRPG.Project.namePlaceholder")}" autofocus />` },
            descriptionField(""),
            { label: game.i18n.localize("DRPG.Project.scale"), id: idOf("target"), field: `<select name="target" id="${idOf("target")}">${scaleOptions}</select>` },
            { label: game.i18n.localize("DRPG.Project.room"), id: idOf("room"), field: `<select name="room" id="${idOf("room")}">${roomOptions}</select>` },
            { label: game.i18n.localize("DRPG.Project.trait"), id: idOf("trait"), field: `<select name="trait" id="${idOf("trait")}" required>${projectTraitOptions()}</select>` },
            { full: `<label class="drpg-checkbox">
                <input type="checkbox" name="murder" /> ${game.i18n.localize("DRPG.Project.indirectMine")}</label>` },
            { label: game.i18n.localize("DRPG.Project.condition"), id: idOf("condition"),
                field: `<input type="text" name="condition" id="${idOf("condition")}"
                       placeholder="${game.i18n.localize("DRPG.Project.conditionPlaceholder")}" />${helpText("DRPG.Project.conditionNote")}` },
            { full: requestFieldHtml({
                prompt: game.i18n.localize("DRPG.Project.proposalPrompt"),
                placeholder: game.i18n.localize("DRPG.Project.proposalPlaceholder"),
                optional: false
            }) },
            { full: helpText("DRPG.Project.startNote") }
        ])}</form>`,
        footer: { gmRoute: [{
                action: "create",
                label: game.i18n.localize("DRPG.Project.proposeButton"),
                // Red by its role (the kit's `gmRoute`, utils.mjs `GM_ROUTE_CLASS`), like the variant that opened
                // this window: proposing a project does not start one - it sends the GM a card and waits (D11).
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return {
                        name: f.name.value.trim(),
                        target: Number(f.target.value) || PROJECT_SCALE.everyday.progress,
                        room: f.room.value || null,
                        trait: f.trait.value || null,
                        murder: f.murder.checked,
                        condition: f.condition.value.trim(),
                        preset: f.preset?.value || null,
                        to: f.to?.value ?? null,
                        seal: f.seal?.value ?? null,
                        unbreach: f.unbreach?.value ?? null,
                        mend: f.mend?.value ?? null,
                        lockfix: f.lockfix?.value ?? null,
                        // As typed; a preset's own label stands in for an empty one below (E44 C9, fix FG1).
                        description: d.element.querySelector('[name="description"]')?.value ?? "",
                        // The player's sentence for the GM, from this window (E22 C5c): the card's quote.
                        request: readRequestField(d.element)
                    };
                }
            }], close: "cancel" },
        /* Propose refused at the field while the description is empty or too long (E44 C9; Q-C9-3), but for a preset,
           whose own label fills the untouched field as soon as it is chosen (fix FG1) and stands in for one emptied
           again. Cancel goes. */
        render: (event, dialog) => {
            guardDescription(dialog.element, "create",
                { optional: () => Boolean(dialog.element.querySelector('[name="preset"]')?.value) });
            wirePresetDescription(dialog.element);
        },
        rejectClose: false
    });

    /* A CLOSED WINDOW SAYS NOTHING WAS SENT (E22 C5c; audit S10-31). The proposal's second window, which a player
       closed believing the first Send had sent it, is gone; this one closed or Cancelled has sent nothing, and says so. */
    if (!result || result === "cancel") {
        ui.notifications.info(game.i18n.localize("DRPG.Project.proposalNotSent"));
        return null;
    }
    // A preset's own answers (PASSAGE_PRESETS): its statistic, its size, never a murder, from the room the character is in.
    // Breach the Wall since E15 part 2 C3: the same offer (a wall shared with a room beyond), its own statistic and summary.
    // The owner's three since C5: the target an index into what was offered, its id on the card; the room the one it stands in
    // (Repair an item: the room the form names), the item's tier its size.
    const presetKey = kinds.includes(result.preset) ? result.preset : null;
    const preset = presetKey ? PASSAGE_PRESETS[presetKey] : null;
    const walled = presetKey === "secretPassage" || presetKey === "breach";
    const field = { secretPassage: "to", breach: "to", sealPassage: "seal", closeBreach: "unbreach", repairItem: "mend", repairLock: "lockfix" }[presetKey];
    const toIndex = preset ? Number(result[field]) : NaN;
    const chosen = !preset || !Number.isInteger(toIndex) ? null
        : walled ? offer.neighbours[toIndex] : presetKey === "sealPassage" ? owned.seal[toIndex] : presetKey === "closeBreach" ? owned.breaches[toIndex]
            : presetKey === "repairLock" ? lockable[toIndex] : mendable[toIndex];
    if (preset) {
        if (!chosen) return null;
        const scale = presetKey === "repairItem" ? presetScale(presetKey, { tier: tierOf(chosen) }) : preset.scale;
        Object.assign(result, { name: result.name || (presetKey === "repairItem" ? game.i18n.format("DRPG.Project.repairItemName", { item: chosen.name })
            : game.i18n.localize(`DRPG.Project.preset.${presetKey}`)), target: PROJECT_SCALE[scale].progress,
            trait: preset.trait, room: walled ? offer.from : presetKey === "repairItem" ? result.room : here.room, murder: false, condition: "" });
    }
    if (!result.name) {
        ui.notifications.warn(game.i18n.localize("DRPG.Project.needsName"));
        return null;
    }
    if (!Object.hasOwn(TRAITS, result.trait ?? "")) {
        ui.notifications.warn(game.i18n.localize("DRPG.Project.traitRequired"));
        return null;
    }
    /* A PRESET'S OWN LINE, AND THE DESCRIPTION (E44 C9; Q-C9-3; fix FG1, 05.11.2026). The line the card has always
       carried for a preset (its summary below) names the room beyond the wall, a passage's rooms or an item, so it stays
       on the card alone; a preset's description, when the field is left empty, is the preset's own label, which names
       none of them (projects-ui.mjs `presetDescription`: the description is projectMeta's, on every browser - C9 wrote
       the summary there, the end review's S-B1). The GM's window opens on it, to be changed. Any other proposal needs
       words of its own: the guard said so at the field, and an answer read past it is refused here, before anything is
       sent. */
    const presetLine = walled ? game.i18n.format(presetKey === "breach" ? "DRPG.Project.breachSummary" : "DRPG.Project.passageSummary",
        { to: beyond.get(offer.neighbours[toIndex]) ?? "-" })
        : preset ? game.i18n.format(`DRPG.Project.${presetKey}Summary`, { target: presetKey === "repairItem" ? chosen.name
            : presetKey === "repairLock" ? named([chosen]) : named(chosen.rooms) })
        : null;
    result.description = String(result.description ?? "").trim() || (preset ? presetDescription(presetKey) : "");
    const descriptionWhy = projectDescriptionProblem(result.description);
    if (descriptionWhy) {
        ui.notifications.warn(descriptionRefusal(descriptionWhy, result.description));
        return null;
    }

    // A PROPOSAL, NOT A PROJECT.
    //
    // This used to create the countdown outright, on the reasoning that the
    // guide has projects agreed with the GM beforehand and a rubber stamp
    // mid-turn is friction. In practice the agreement is where the work is: what
    // it takes, which room it belongs to, whether it is quietly a murder weapon.
    // A player filling in five fields alone was making all of those calls by
    // themselves and the GM found out afterwards, from a tray that had grown a
    // row.
    //
    // Same shape as the direct-murder declaration (see `performDirectMurder`):
    // the form becomes a card the GM reads, with the answers on it, and one
    // press opens their own creation screen prefilled so they can correct
    // anything before it lands. Nothing exists in the world until they do.
    const scaleLabel = Object.values(PROJECT_SCALE)
        .find(s => s.progress === result.target)?.label ?? `${result.target}`;

    const summary = [
        `<strong>${esc(result.name)}</strong>`,
        `${esc(scaleLabel)} · ${result.target} progress`,
        result.room ? esc(result.room) : game.i18n.localize("DRPG.Project.anyRoom"),
        TRAITS[result.trait].label,
        ...(presetLine ? [esc(presetLine)] : [])
    ].join(" · ");

    /*
     * ONE WINDOW, ONE SEND (E22 C5c, 07.11.2026; audit S10-31; Q-E21-5, its default). `promptAndCallGm` opened a
     * SECOND window here - the sentence for the GM, with a second "Send to GM" - after the form's own Send, which sent
     * nothing: a player who closed it believing the proposal had gone proposed nothing, silently. The sentence is the
     * form's own field now (`request`, above), and the card goes from here with the arguments `promptAndCallGm` gave
     * `callGm`: the title, no roll, the words, the room, the GM's body and buttons, and nothing spent before it. With no
     * GM connected `callGm` says so once ("noGm", nothing spent) and answers false, and posts nothing.
     *
     * AND THE ANSWER IS READ (ACT-15, 20.09). The whisper below said "your proposal has been sent" whatever the call
     * answered; it follows a posted card alone.
     */
    const sent = await callGm(actor, {
        title: game.i18n.localize("DRPG.Project.proposalTitle"),
        roll: null,
        request: result.request ?? "",
        room,
        // The description as the player wrote it, its line breaks kept, under the summary (E44 C9).
        body: `${summary}<br>${esc(result.description).replace(/\n/g, "<br>")}${result.condition ? `<br><em>${esc(result.condition)}</em>` : ""}${
            result.murder ? `<br><span class="drpg-warning">${
                esc(game.i18n.localize("DRPG.Project.indirectMine"))}</span>` : ""}`,
        actions: [
            {
                action: "approveProject",
                label: game.i18n.localize("DRPG.Project.approveButton"),
                // Lowercase keys only: `data-*` attributes arrive through
                // `dataset`, which lowercases everything, so `killerId` would
                // come back as `killerid` and quietly read undefined.
                data: {
                    by: actor.id,
                    pname: result.name,
                    target: String(result.target),
                    room: result.room ?? "",
                    trait: result.trait ?? "",
                    murder: result.murder ? "1" : "",
                    condition: result.condition ?? "",
                    // What the player wrote (E44 C9): the GM's window opens on it (messenger-app.mjs `ruleApproveProject`).
                    description: result.description,
                    // A Secret Passage (E15 part 2 C2) or a breach (C3): the preset and the neighbour's index, never its name.
                    // The owner's three (C5): the passage's, the breach's or the item's id, held by this browser already.
                    ...(preset ? { preset: presetKey, to: walled ? String(toIndex) : presetKey === "repairLock" ? String(chosen) : String(chosen.id) } : {})
                }
            },
            {
                action: "declineProject",
                label: game.i18n.localize("DRPG.Project.declineButton"),
                data: { by: actor.id }
            }
        ],
        nothingSpent: true
    });
    if (sent === false) return null;

    await whisperToOwner(actor, `${cardHead({
        action: game.i18n.localize("DRPG.Project.startNew")
    })}<p>${
        game.i18n.format("DRPG.Project.proposalSent", { name: esc(result.name) })
    }</p>`);

    return { proposed: true, name: result.name };
}

async function workOnProject(actor, def, options, chosen = null) {
    const cost = options.free ? 0 : def.cost;
    if (!canAfford(actor, cost)) return null;

    const place = locateActor(actor);
    const room = place?.room ?? null;
    // Two lists, because a finished project is neither absent nor workable.
    // `listed` is what the player sees; `workable` is what they may pick.
    const listed = projectsListedIn(place);
    const here = listed.filter(p => !p.complete);
    if (!here.length) {
        // Say that there is nothing here, and nothing else.
        //
        // This used to list every project running anywhere on the map, by name
        // and by room, to any player who walked into an empty room - indirect
        // murders included. "Prepare the poison (Chemistry Lab)" handed to the
        // whole table by a mis-click is not a hint, it is the answer to the
        // chapter. Where other people's projects are is theirs to reveal.
        //
        // A room whose only projects are finished gets a different sentence:
        // "there is nothing here" is a lie the player can see out of the window,
        // and it is the sentence that used to send them looking for the bug.
        ui.notifications.warn(listed.length
            ? game.i18n.format("DRPG.Project.allComplete", { room: room ?? "-" })
            : game.i18n.format("DRPG.Project.noneHere", { room: room ?? "-" }));
        return null;
    }

    // Normally the project was picked in the window that got us here.
    // The fallback is not dead code: this function is the one entry point that
    // knows how to run a project roll, and a caller that has not asked yet -
    // or has asked about a project that has since been finished or frozen -
    // still needs somewhere to ask.
    const stillThere = chosen?.project && here.some(pr => pr.id === chosen.project.id);
    const project = stillThere
        ? chosen.project
        : await chooseProject(listed, "DRPG.Project.whichWork", actor, def, { disableComplete: true });
    if (!project) return null;
    // Before anything is paid: a project stored without a statistic waits for a GM here.
    const ruled = await projectTrait(actor, project);
    if (!ruled) return null;
    const { trait, byGm } = ruled;

    const indirect = isIndirectMurder(project.id);
    const witnesses = othersInRoom(actor);
    const lines = [];

    // Pay before any dice are thrown.
    //
    // An indirect murder rolls to conceal intent *before* the project roll, and
    // every roll commits its resources - Hope, Sanity, and a Despair point to a
    // Monokuma. With the charge sitting after the main roll, backing out of that
    // roll left the conceal roll's winnings in place at no cost, which is a Hope
    // generator anyone could run all day.
    const paid = cost > 0 ? await spendAction(actor, cost) : null;
    if (cost > 0 && !paid) return null;

    const concealment = await concealProjectIntent(actor, { indirect, witnesses, paid, lines });
    if ("exit" in concealment) return concealment.exit;
    const { bonus, rolledAlready } = concealment;

    /*
     * A TOOL IN HAND IS WORTH A DIE (E8).
     *
     * `armSituational` rather than a flat bonus, so after E7 it adds to the
     * room's favour and to a Hope Call rather than replacing either: a tool, in
     * a room that suits the work, with an Ultimate behind it is genuinely three
     * dice. The concealment roll above cannot pick this up - it goes through
     * `remember: false`, which shields it (trap 61), and that was already true
     * before this line existed.
     */
    const { equippedFor, breakOnDespair, tierOf } = await import("./use-items.mjs");
    const calls = await import("./call-effects.mjs");
    const tool = equippedFor(actor, "tool");
    if (tool) calls.armSituational(1);

    // ...and a better tool is a lower bar on top of that die (Dawid, 31.08).
    const relief = toolRelief(tool, tierOf);
    if (relief) {
        lines.push(`<p><em>${game.i18n.format("DRPG.Project.toolRelief", {
            item: foundry.utils.escapeHTML(tool.name), tier: relief
        })}</em></p>`);
    }

    let roll;
    try {
        roll = await rollTrait(actor, trait, {
            actionKey: "project",
            byGm,
            title: game.i18n.localize(indirect ? "DRPG.Roll.murderProject" : "DRPG.Roll.project"),
            dc: (def.thresholds ?? []).map(t => Math.max(0, t.min - relief)).join(" / "),
            context: { room: roomOfActor(actor), projectId: project.id, bonus, cost }
        });
    } finally {
        // Cleared whatever happened, like every other armed situation: one that
        // outlived its roll would attach itself to the next unrelated one.
        calls.clearSituational();
    }
    if (!roll) return rolledAlready ? spentAfterRoll(actor, def) : abort(actor, paid);

    await breakOnDespair(actor, tool, roll);

    const { hit, progress } = projectProgress(roll, { relief, bonus }, def);

    let applied = null;
    /* Named for this roll (E08+E28 C2): the GMs' bookmark keeps what it added, and a Call's progress names none.
       Since C16 the GM adds what the roll earned on its record, with what only this browser saw - the tool's
       relief and the concealment's bonus - held to what the rules allow (bridge-runs-records.mjs `progressOf`). */
    if (progress > 0) {
        applied = await addProgress(project.id, progress, { actorId: actor.id, rollId: rollInHand(actor)?.messageId ?? null, relief, bonus });
    }

    // Reroll needs to know what this roll gave the project, so it can take the
    // same amount back before applying the new result.
    //
    // The bonus is recorded apart from the threshold progress on purpose. Reroll
    // rescores the new dice against the thresholds alone, so storing only the
    // combined figure made it subtract a bonus it could never recompute - an
    // indirect murder quietly lost its alone/Despair progress on every reroll.
    await noteRollContext(actor, {
        actionKey: "project", projectId: project.id, progress, bonus,
        // What the readied tool took off the bands, so a Reroll scores the new
        // dice against the same bands (ROLL-04). From here, never from the
        // inventory at reroll time: the tool may have broken on this roll.
        relief,
        room: roomOfActor(actor),
        // Whether the critical's free action has already been handed back, so a
        // reroll that loses the critical knows there is one to take away again.
        refunded: Boolean(hit?.refundAction && cost > 0),
        // What paid for it, so a Reroll that takes the critical back takes back
        // the same thing - a Burst stays a Burst (review of ACT-07).
        burst: Boolean(paid?.grant)
    });

    const traceLeftTrace = indirect ? await hideProjectTraces(actor, project, progress, lines) : false;

    // A critical on a project hands the action back. Applied here, where the
    // action was spent, rather than inside `report()`.
    if (hit?.refundAction && paid) await refundAction(actor, cost, paid);

    const outcome = {
        success: progress > 0,
        progress,
        project: project.name,
        applied,
        refundAction: Boolean(hit?.refundAction),
        leftTrace: traceLeftTrace,
        extra: lines.join(""),
        text: progress > 0
            ? game.i18n.format("DRPG.Action.progressOn", { n: progress, project: project.name })
            : def.failure
    };

    await report(actor, def, roll, outcome);
    // `projectId` because `outcome` carries only the project's NAME, and a trap
    // that watches "somebody works on THAT project" needs the identity - two
    // projects are allowed to share a name and one of them is the trap.
    Hooks.callAll("drpgActionResolved", {
        actor, actionKey: "project", roll, outcome, projectId: project.id
    });
    return outcome;
}

/**
 * What a Work on a Project's roll earns: the band its total reaches with the readied tool's
 * `relief` off the bands (a critical reads none), plus an indirect murder's concealment `bonus`
 * whatever the band - `bonus` in the answer is the whole of it. The one reading `workOnProject`,
 * the GM's (bridge-runs-records.mjs `progressOf`, E08+E28 C16) and the Reroll's (reroll.mjs
 * `settleProgress`) share.
 *
 * THE BONUS ON ANY OUTCOME (E15 C2, 25.10.2026; audit S02-08, the owner's D13: "bonus +1 za
 * samotną pracę bezwarunkowy i przeżywa Reroll"). It rode only on progress the bands had earned,
 * so a killer working alone read "the project gains +1 progress" beside "No progress." on one
 * card, and the GMs' bookmark kept the bonus at 0 for that miss: a Reroll of it to 18 paid 2
 * where the card's rule pays 3. Measured on d90687dc by E15-T2 (a lone miss at 8 paid 0) and
 * E15-T3 (that miss rerolled to 18 left the bar at 2).
 */
export function projectProgress(roll, { relief = 0, bonus = 0 } = {}, def = ACTIONS.project) {
    const hit = roll?.isCritical ? def.critical : resolveThreshold(Number(roll?.total) || 0, easedBy(def.thresholds, relief));
    return { hit, progress: (hit?.progress ?? 0) + bonus, bonus };
}

/** A concealment of intent made with Despair adds this much (the guide); working alone adds `aloneBonus`. */
const CONCEALED_WITH_DESPAIR = 1;

/** The most a concealment adds to a Work's progress: the two never both apply (`projectExtrasHeld`). */
export const PROJECT_BONUS_MOST = Math.max(INDIRECT_MURDER.concealIntent.aloneBonus ?? 0, CONCEALED_WITH_DESPAIR);

/*
 * WHAT ONLY THE ROLLER SAW OF A PROJECT'S ROLL, HELD THE SAME WAY EVERYWHERE THE GM SCORES IT
 * (E08+E28 C16, 04.10.2026; one reading since fix r2-H3, 05.10.2026 - the round-2 review's M1 and
 * S2-9). A Work's tool relief and concealment bonus and a Sabotage's concealment penalty and tool
 * relief are the roller's word: the GM sees the tools and the project, not the readied hand or the
 * concealment roll, which names no action. C16 held them on the first throw (gm-bridge.mjs
 * `progressOf`, `repairOf`), and two other readers did not: the Reroll's replays scored the row's
 * claims raw (reroll.mjs `settleProgress`, `settleSabotage`) - the review's EXP-R2 rerolled a Work
 * claiming a bonus of 40 on a project that is no indirect murder into 13 and moved it 0 -> 41 - and
 * a Sabotage's trace was banded with the tool readied on the sheet now (gm-bridge.mjs
 * `traceBandOf`), so a tool that broke on a roll with Fear froze the project at the first band and
 * left the trace at a miss's. All four read the claims through these two now, each with the throw
 * the claims were made on (`roll`: `actorId`, `withFear`, `isCritical`):
 *   - a concealment's bonus only on an indirect murder, at most `PROJECT_BONUS_MOST`;
 *   - a concealment's penalty from what one thrown with Despair takes, `SABOTAGE_CONCEAL.despairPenalty`, to 0;
 *   - a tool's relief at most what the GM sees in the character's hand - or, for a roll with Fear
 *     that is no critical, whose Despair wears the readied tool before the packets leave
 *     (use-items.mjs `breakOnDespair`), the best tool the character carries, broken or not.
 * What the GM sees there is the tools as the GMs hold them (E29 fix r2-H18, 06.10.2026;
 * sheet-audit.mjs `actorAsHeld`): once every write queued on the character has been judged, a
 * tool's place, category, roles, tier and broken flag as the sheet audit's mark holds them, so a
 * tier, a role or a readied tool's mend the roller's console wrote a moment before the packet is
 * not what the relief is held to. At 0c75739 (e29run/r2h18red, 06.10.2026) a readied Tier 1 tool given
 * tier 3 where the mark did not see it held a claimed relief of 3 to 3, on a roll with Hope and on
 * one with Fear; it holds it to 1 now.
 */
function heldTo(claimed, low, high) {
    return Math.max(low, Math.min(high, Math.trunc(Number(claimed) || 0)));
}

async function reliefHeld(roll, claimed) {
    const actor = game.actors.get(roll?.actorId ?? "");
    if (!actor) return 0;
    const { actorAsHeld } = await import("./sheet-audit.mjs");
    const held = await actorAsHeld(actor);
    const tools = roll.withFear && !roll.isCritical ? carriedFor(held, "tool") : [equippedFor(held, "tool")].filter(Boolean);
    return heldTo(claimed, 0, Math.max(0, ...tools.map(tool => toolRelief(tool, tierOf))));
}

/** A Work's `relief` and `bonus` as `claimed` says them, held to the rules for `projectId`. */
export async function projectExtrasHeld(roll, claimed, projectId) {
    return {
        relief: await reliefHeld(roll, claimed?.relief),
        bonus: isIndirectMurder(projectId) ? heldTo(claimed?.bonus, 0, PROJECT_BONUS_MOST) : 0
    };
}

/** A Sabotage's `penalty` and `relief` as `claimed` says them, held to the rules. */
export async function sabotageExtrasHeld(roll, claimed) {
    return { penalty: heldTo(claimed?.penalty, SABOTAGE_CONCEAL.despairPenalty, 0), relief: await reliefHeld(roll, claimed?.relief) };
}

// Guide: with someone else in the room, the killer must hide their intent
// first; alone, the project simply gains +1 progress.
async function concealProjectIntent(actor, { indirect, witnesses, paid, lines }) {
    let bonus = 0;
    let rolledAlready = false;
    if (indirect) {
        if (witnesses.length) {
            const conceal = await rollTrait(actor, INDIRECT_MURDER.concealIntent.trait, {
                remember: false, title: game.i18n.localize("DRPG.Roll.concealIntent"),
                dc: INDIRECT_MURDER.concealIntent.threshold
            });
            if (!conceal) return { exit: await abort(actor, paid) };
            rolledAlready = true;
            const ok = conceal.isCritical || conceal.total >= INDIRECT_MURDER.concealIntent.threshold;
            lines.push(`<p><strong>${INDIRECT_MURDER.concealIntent.label}</strong> - ${conceal.total}${neededNote(conceal.dc)}: ${
                ok ? (conceal.withFear
                        ? INDIRECT_MURDER.concealIntent.successWithDespair
                        : INDIRECT_MURDER.concealIntent.success)
                   : INDIRECT_MURDER.concealIntent.failure
            }</p>`);
            if (ok && conceal.withFear) bonus += CONCEALED_WITH_DESPAIR;
            /*
             * A FAILED CONCEALMENT IS TOLD TO THE ROOM (E16 part 2 C4, 26.10.2026; audit S02-17, the owner's Q5 of
             * 19.10: "samo"). The failure's sentence ("the others get a general description of what you are doing")
             * went on the roller's own card alone, so the witnesses it names were told nothing unless a GM noticed it
             * and passed it on - while a Sabotage seen in the same room is announced to that room by itself
             * (`performSabotage`). The room is told now, as Sabotage tells it (`roomAudience`: the GMs, the roller's
             * players and the players of everyone standing there), in a neutral sentence that names the roller and
             * the room and no project: a trap is the murder, and its name is the killer's secret.
             */
            if (!ok) {
                await announce({
                    content: `<p><em>${game.i18n.format("DRPG.Project.concealSeen", {
                        actor: foundry.utils.escapeHTML(actor.name),
                        room: foundry.utils.escapeHTML(roomOfActor(actor) ?? "-")
                    })}</em></p>`,
                    whisper: roomAudience(actor)
                });
            }
        } else {
            bonus += INDIRECT_MURDER.concealIntent.aloneBonus;
            lines.push(`<p><em>${game.i18n.localize("DRPG.Project.aloneBonus")}</em></p>`);
        }
    }
    return { bonus, rolledAlready };
}

/**
 * Guide: every project action also rolls to hide the traces it leaves - a Work on an indirect
 * murder (`workOnProject`) and, since E15 C2 (audit S09-06, the owner's D13: "Contribution do
 * pułapki woła ten sam rzut ukrycia"), a Contribution to one (call-effects.mjs `progressEffect`).
 * `lines` takes the card's HTML lines; answers whether the roller is told a trace was left.
 */
export async function hideProjectTraces(actor, project, progress, lines) {
    let traceLeftTrace = false;
    const trace = await rollTrait(actor, INDIRECT_MURDER.hideTraces.trait, {
        remember: false, title: game.i18n.localize("DRPG.Roll.hideTraces"),
        dc: (INDIRECT_MURDER.hideTraces.thresholds ?? []).map(t => t.min).filter(Boolean).join(" / ")
    });
    /*
     * A CLOSED WINDOW COVERS NOTHING (E32+E07 C13, 03.10.2026; audit S02-03). The whole drop
     * sat under `if (trace)`, so closing this window - the progress already added above - left
     * no trace at all, and an indirect murder could be built to the end without one. A window
     * closed is the roll not made: the worst band's trace, the first of the table's thresholds
     * ("obvious"), and a line on the card that says the traces were left as they were.
     */
    const band = !trace
        ? INDIRECT_MURDER.hideTraces.thresholds?.[0]
        : trace.isCritical
            ? INDIRECT_MURDER.hideTraces.critical
            : resolveThreshold(trace.total, INDIRECT_MURDER.hideTraces.thresholds);
    const traceRemnant = band?.remnant ?? "obvious";
    const noteArgs = { actor: actor.name, project: project.name, room: roomOfActor(actor) ?? "?", progress };

    const { dropRemnant, traceFeedback } = await import("./remnants.mjs");
    const placed = await dropRemnant(actor, {
        type: "prep",
        visibility: traceRemnant,
        faint: true,
        // THE EFFECT OF A PROJECT TIED TO THE MURDER is part of it
        // (Dawid, 28.08). An indirect murder IS the murder, built in
        // instalments, so the traces of building it are the traces of
        // committing it. `null` for every other project, which leaves
        // the incident rule free to answer - and for a bystander's Work on
        // somebody else's trap, which the bridge has left untied for a
        // player's since fix r2-G3 and a GM's own client tied until E09 fix
        // r1-G4 (`buildsOwnMurder`, the same question on both).
        tiedToCrime: buildsOwnMurder(project.id, actor.id) ? true : null,
        // A player's packet is never taken at its word on the tie: the GM reads it off this
        // project (bridge-runs-records.mjs `handleRemnant`, fix r2-G3).
        projectId: project.id,
        action: "project",
        subject: project.name,
        note: trace
            ? game.i18n.format("DRPG.Remnant.projectNote", { ...noteArgs, total: trace.total })
            : game.i18n.format("DRPG.Remnant.projectNoteUncovered", noteArgs)
    });
    if (!trace) {
        lines.push(`<p><strong>${INDIRECT_MURDER.hideTraces.label}</strong> - ${
            game.i18n.localize("DRPG.Project.tracesUncovered")}</p>`);
        return false;
    }
    traceLeftTrace = traceFeedback(trace, placed);

    // Just the score - never the band this rolled into (see
    // `traceFeedback`). Whether anything is said about the trace
    // itself is `report()`'s generic `outcome.leftTrace` line below,
    // the same one every other action uses, so this does not print
    // its own second copy of that sentence.
    lines.push(`<p><strong>${INDIRECT_MURDER.hideTraces.label}</strong> - ${trace.total}</p>`);
    return traceLeftTrace;
}

/**
 * Pick a project from an explicit list, and - only when at least one
 * candidate leaves the required trait open - the trait to use for it, in the
 * SAME window instead of a second one immediately after.
 *
 * Used to be two sequential dialogs every time: which project, then (when
 * the project had no fixed trait) which trait. The trait field costs nothing
 * to show up front - it is simply ignored once the chosen project turns out
 * to have one fixed, exactly as the old second dialog would never have
 * appeared in that case either.
 *
 * @returns {Promise<{project: object, trait: string}|null>} null on cancel,
 *   or if the resolved trait is empty (no trait allowed at all).
 */
/**
 * One project as an <option>: its name, how far along it is, and where.
 *
 * `disableComplete` is only ever set by Work on Project. A finished project is
 * shown - struck through and unpickable - rather than dropped from the list,
 * because dropping it looks like the project was cleared away and sends the
 * player to ask a GM what happened to it. Sabotage does not pass the flag: a
 * finished project is a perfectly good thing to break.
 *
 * The first project that can still be worked on is marked `selected` by hand.
 * Browsers do skip disabled options when choosing a default, but only in the
 * absence of an explicit one, and a picker whose default depends on that is a
 * picker one browser update away from opening on an unpickable row.
 */
function projectOptionsHtml(list, { disableComplete = false } = {}) {
    let defaulted = false;
    return list.map(p => {
        const done = disableComplete && p.complete;

        let mark = "";
        if (done) {
            mark = ` disabled class="is-complete"`;
        } else if (!defaulted) {
            mark = " selected";
            defaulted = true;
        }

        // The word as well as the line through it. The strike is the glance and
        // the word is the answer, and only one of the two survives a picker
        // drawn by a browser that will not style an <option>. The statistic its
        // roll takes (C11d): the project's own, said before it is picked. One
        // formatter for every list of projects (`projectLabel`, E51 C1).
        // A finished project that gives a room action says so, and for how long (E93 C4; the owner's 05.11 option A).
        const facility = p.complete ? facilityLineFor(p.id) : "";
        return `<option value="${p.id}"${mark}>${
            foundry.utils.escapeHTML(`${projectLabel(p, { scale: true, room: true, stat: true, complete: done })}${facility ? ` · ${facility}` : ""}`)}</option>`;
    }).join("");
}

/**
 * The statistic a roll on `project` takes - Work on it, or a Sabotage of it:
 * `{ trait, byGm }`, or null when it is not to be rolled.
 *
 * THE PROJECT'S OWN, AND NOBODY ELSE'S (E32+E07 C11d; the owner's rules of 28.09.2026).
 * The Projects window carried a Statistic select for a project that left its
 * statistic open, and a player could pick the one they were best at - for their own
 * project, or for one they were breaking. A project's roll takes the statistic it was
 * given when it was made; a Sabotage takes its target's, because breaking a thing
 * takes the same kind of work as building it. A project stored without one (both
 * forms allowed it until 1.2.66) asks a GM once, through the ruling every several-trait
 * roll asks (trait-ruling.mjs `traitFor`, kind `project`), and the pick becomes the
 * project's. Shared by both rolls, so Work on Project and Sabotage cannot drift.
 */
async function projectTrait(actor, project) {
    const { traitFor, listedTraits, resolveArmed } = await import("./trait-ruling.mjs");
    const spec = { kind: "project", key: project.id };
    // A player proposes where the GM is to be asked (E68 C4; DA18): a project stored without a statistic, no Resolve
    // armed. A GM's own browser picks in its own window, as before. Closed, nothing is asked and nothing spent.
    const listed = listedTraits(spec);
    const asks = !game.user?.isGM && listed.length > 1 && !resolveArmed(actor);
    const proposal = asks ? await proposeProjectTrait(actor, project, listed) : {};
    if (!proposal) return null;
    const ruled = await traitFor(actor, spec, { proposed: proposal.proposed ?? null, note: proposal.note ?? "" });
    if (ruled && project.trait) {
        ui.notifications.info(game.i18n.format("DRPG.Project.traitFixed", {
            trait: TRAITS[project.trait]?.label ?? project.trait
        }));
    }
    return ruled;
}

/**
 * A player's proposal for a project stored without a statistic (E68 C4): which statistic and how, the GM's road
 * (D11) to the card. `{ proposed, note }`, or null when the window was closed.
 */
async function proposeProjectTrait(actor, project, listed) {
    const answer = await drpgWindow({
        classes: ["drpg-panel", "drpg-narrow", "drpg-trait-propose"],
        prompt: true,
        title: game.i18n.localize("DRPG.TraitRuling.title"),
        body: `<form><p><strong>${esc(project.name ?? "?")}</strong></p>
            <p>${game.i18n.localize("DRPG.TraitRuling.projectBody")}</p>${traitFieldHtml(actor, listed, { propose: true })}</form>`,
        footer: {
            gmRoute: [{ action: "propose", label: game.i18n.localize("DRPG.TraitRuling.propose"),
                callback: (event, button, dialog) => readProposal(dialog.element.querySelector("form"), listed) }],
            close: "cancel"
        },
        rejectClose: false
    });
    return answer?.proposed ? answer : null;
}

async function chooseProject(list, promptKey, actor, def, { disableComplete = false } = {}) {
    const projectOptions = projectOptionsHtml(list, { disableComplete });

    // An action's window (E68 C12, action-menus.mjs `actionWindow`).
    const result = await actionWindow({
        title: game.i18n.localize("DRPG.Project.title"),
        classes: ["drpg-panel"],
        // No briefing here: Work-on-Project already showed one on the window
        // before this. Sabotage only reaches this dialog through the API's own
        // door (the Projects window picks its target itself, ROLL-12), and that
        // is when the briefing is shown.
        brief: def === ACTIONS.sabotage ? briefingBlock(actor, "sabotage", def) : "",
        ask: `<form>
            <label>${game.i18n.localize(promptKey)}
                <select name="project">${projectOptions}</select></label>
        </form>`,
        footer: {
            primary: {
                action: "ok", label: game.i18n.localize("DRPG.Action.roll"),
                callback: (e, b, d) => ({ id: d.element.querySelector("[name=project]").value })
            },
            close: "cancel"
        },
        rejectClose: false
    });

    if (!result || result === "cancel") return null;
    const project = list.find(p => p.id === result.id) ?? null;
    if (!project) return null;

    // The row was disabled, so this should be unreachable - and it is the kind
    // of unreachable that a keyboard, a screen reader or a browser that draws
    // its own picker can reach anyway. Refusing here costs one comparison and
    // is the difference between "the option was greyed" and "the option cannot
    // be taken".
    if (disableComplete && project.complete) {
        ui.notifications.warn(game.i18n.format("DRPG.Project.alreadyComplete", {
            name: project.name
        }));
        return null;
    }
    return project;
}

/* ==========================================================================
 * SABOTAGE
 * ========================================================================== */

export async function performSabotage(actor, def, options, preset = null) {
    const cost = options.free ? 0 : def.cost;
    if (!canAfford(actor, cost)) return null;

    const place = locateActor(actor);
    const room = place?.room ?? null;
    const { sabotageTargetsIn, sabotageProject } = await import("./projects.mjs");

    const { targets, withheld } = await sabotageTargets(actor, place, { sabotageTargetsIn });

    if (!targets.length) {
        ui.notifications.warn(withheld.length
            ? game.i18n.format("DRPG.Project.allSabotaged", {
                  names: withheld.map(p => p.name).join(", ")
              })
            : game.i18n.localize("DRPG.Project.nothingToSabotage"));
        return null;
    }

    if (withheld.length) {
        ui.notifications.warn(game.i18n.format("DRPG.Project.someSabotaged", {
            names: withheld.map(p => p.name).join(", ")
        }));
    }

    // Breaking a thing takes the same kind of work as building it, so sabotage
    // uses the project's own trait. The player does not get to pick an easier
    // one than the people who built it had to use - see `projectTrait`.
    // Already chosen on the Projects window (ROLL-12) - as long as the target
    // is still one that can be broken; the API's direct door still asks here.
    const chosen = preset?.project && targets.some(p => p.id === preset.project.id) ? preset.project : null;
    const project = chosen ?? await chooseProject(targets, "DRPG.Project.whichSabotage", actor, def);
    if (!project) return null;
    // Before the action is paid below, and before the concealment roll.
    const ruled = await projectTrait(actor, project);
    if (!ruled) return null;
    const { trait, byGm } = ruled;

    const witnesses = othersInRoom(actor);
    const lines = [];

    // Paid before the concealment roll, for the same reason as Work on Project:
    // that roll grants Hope and feeds a Despair pool, and an uncharged cancel
    // afterwards turned it into free resources.
    const paid = cost > 0 ? await spendAction(actor, cost) : null;
    if (cost > 0 && !paid) return null;

    const concealment = await concealSabotage(actor, { room, project, witnesses, paid, lines });
    if ("exit" in concealment) return concealment.exit;
    const { penalty, rolledAlready, watched, tellRoom } = concealment;

    // Sabotage is project work with the sign flipped, so the tool counts here
    // too - the guide's own "including sabotage". `performSabotage` did not look
    // at the inventory at all before this (trap 60), so it is armed here rather
    // than assumed to arrive from the project path.
    const { equippedFor, breakOnDespair, tierOf } = await import("./use-items.mjs");
    const calls = await import("./call-effects.mjs");
    const tool = equippedFor(actor, "tool");
    if (tool) calls.armSituational(1);

    // Project work with the sign flipped eases the same way.
    const relief = toolRelief(tool, tierOf);
    if (relief) {
        lines.push(`<p><em>${game.i18n.format("DRPG.Project.toolRelief", {
            item: foundry.utils.escapeHTML(tool.name), tier: relief
        })}</em></p>`);
    }

    let roll;
    try {
        /* The relief rides the roll's own bookmark with the penalty (fix r2-H3; the round-2 review's
           S2-9): the GM bands this Sabotage's trace with the relief claimed for the roll, held as its
           repair holds it (bridge-runs-records.mjs `traceBandOf`), and the trace's packet leaves before
           `noteRollContext` below tells the GMs anything more. */
        roll = await rollTrait(actor, trait, {
            actionKey: "sabotage",
            byGm,
            // The bar `sabotageHit` judges, so the window says what the total must reach (E16 C0).
            dc: sabotageBar(def, relief, penalty).map(band => band.min).join(" / "),
            context: { room, targetProjectId: project.id, penalty, relief, witnesses: witnesses.length }
        });
    } finally {
        calls.clearSituational();
    }
    if (!roll) {
        // The room saw the cover fail (`concealSabotage`): told even when the sabotage roll is not thrown.
        await tellRoom?.();
        return rolledAlready ? spentAfterRoll(actor, def) : abort(actor, paid);
    }

    await breakOnDespair(actor, tool, roll);

    // `penalty` stays on the score and the relief stays on the bands: one is a
    // modifier the roll earned, the other is a change to what it has to beat.
    const score = roll.total + penalty;
    const hit = sabotageHit(roll, { penalty, relief }, def);
    const success = Boolean(hit);

    // A successful sabotage freezes the project and spawns its repair. The
    // better the roll, the harder the repair - the guide scales it from
    // "simple" to "hidden-difficulty".
    //
    // `sabotageProject` now waits for the GM's client to confirm the freeze and
    // the repair actually landed, rather than handing back `{pending: true}`
    // the instant the request was sent. It used to report success on the
    // strength of the emit alone, which is exactly how a player sabotaging a
    // project and immediately trying to keep working on it could win the race:
    // the roll called it frozen before the world setting agreed.
    let repair = null;
    /* Named, so the GM writes the freeze on this roll's row and no other (fix r1-G1); since E08+E28 C16 the
       GM makes the repair the roll earned on its record, with this browser's concealment and tool held to
       the rules (bridge-runs-records.mjs `repairOf`). A player's miss is sent too, as a repair of 0: it freezes
       nothing and tells the GMs alone its target, for a Reroll of it that succeeds (the orchestrator's
       decision of 04.10.2026). A GM's own row keeps its target from `noteRollContext` below. */
    const named = { rollId: rollInHand(actor)?.messageId ?? null, actorId: actor.id, penalty, relief };
    if (success) {
        repair = await sabotageProject(project.id, sabotageRepairScale(roll, score, relief), named);
    } else if (!game.user.isGM) {
        await sabotageProject(project.id, 0, named);
    }
    // The dice succeeded but nobody was there (or ready in time) to actually
    // write the freeze - say so rather than claiming a state that never
    // landed. `success` stays true below: the attempt itself still happened,
    // still leaves a trace, and can still reveal the actor on a Despair.
    const applied = Boolean(repair?.repair);
    const applyFailed = success && !applied;

    const { traceFeedback } = await import("./remnants.mjs");
    const placed = await dropSabotageTrace(actor, def, roll, { project, room, success, hit, repair });

    const outcome = {
        success,
        applied,
        project: project.name,
        leftTrace: traceFeedback(roll, placed),
        extra: lines.join(""),
        // Despair reveals the attempt to anyone else in the room.
        revealed: roll.withFear && witnesses.length > 0,
        text: !success
            ? def.failure
            : applyFailed
                ? game.i18n.format("DRPG.Project.sabotageNotApplied", { name: project.name })
                : `${hit.result} - ${game.i18n.format("DRPG.Project.frozenNow", {
                      name: project.name, repair: repair.repair.name
                  })}`
    };

    await soundSabotage(actor, room, outcome, { watched, tellRoom });

    // What Reroll has to unpick: the freeze on the target, the repair project it
    // spawned, and the trace. The concealment penalty rides along because the new
    // roll is scored the same way this one was.
    await noteRollContext(actor, {
        actionKey: "sabotage",
        room,
        targetProjectId: project.id,
        repairId: repair?.repair?.id ?? null,
        penalty,
        relief,
        witnesses: witnesses.length,
        ...remnantRef(placed)
    });

    await report(actor, def, roll, outcome);
    // See the note on the project hook above. The sabotage path already had the
    // id to hand - it writes it into `noteRollContext` so a Reroll can undo the
    // right one - it simply was not saying it out loud.
    Hooks.callAll("drpgActionResolved", {
        actor, actionKey: "sabotage", roll, outcome, projectId: project.id
    });
    return outcome;
}

/** What this character can sabotage from where they stand, and what is being held back from them. */
async function sabotageTargets(actor, place, { sabotageTargetsIn }) {
    // WHICH CHARACTER, NOT WHICH ACCOUNT.
    //
    // This used to read `game.user.isGM || isMonokuma(actor)`, and the first
    // half is the bug: it asks who is holding the mouse rather than who is in
    // the fiction. A GM opening a student's sheet - to test it, to play an
    // absent player's character, to walk somebody through their turn - got the
    // whole map as targets, because the ACCOUNT was privileged even though the
    // CHARACTER was a student standing in one room. That is the "sabotage
    // reaches projects in other rooms" report, and no player ever saw it,
    // which is why it looked intermittent.
    //
    // A Monokuma still reaches anywhere: they walk the map freely and are not
    // standing in the players' geography at all. That is a fact about the
    // character, and it survives whoever is logged in as them.
    const { isMonokuma } = await import("./monokuma.mjs");
    const anyRoom = isMonokuma(actor);
    const targets = sabotageTargetsIn(place, { anyRoom });

    // Say what is being held back and why.
    //
    // Two rules quietly remove projects from this list - a project already
    // frozen by an earlier sabotage, and a repair project, which there is no
    // sense in breaking. Both are correct and both were invisible, so a Monokuma
    // saw some projects and not others with nothing to explain the difference.
    // The SAME reach `sabotageTargetsIn` uses, or this list names projects in
    // other rooms - which is both a leak and a lie, since they were never
    // candidates and are not being "held back" from anything.
    const { visibleProjects, isFrozen, repairs, standsAtProject } = await import("./projects.mjs");
    const withheld = visibleProjects()
        .filter(p => anyRoom || standsAtProject(place, p.id))
        .filter(p => isFrozen(p.id) || repairs(p.id));
    return { targets, withheld };
}

// Someone is watching. Cover what you are doing before you do it, exactly
// as an indirect murder covers its intent. A failure is seen, and the
// sabotage goes ahead anyway: the roll that decided who saw it has already
// paid out, so there is no walking away from it (see below).
async function concealSabotage(actor, { room, project, witnesses, paid, lines }) {
    let penalty = 0;
    let rolledAlready = false;
    let watched = false;
    let tellRoom = null;
    if (witnesses.length) {
        const conceal = await rollTrait(actor, SABOTAGE_CONCEAL.trait,
            { remember: false, title: game.i18n.localize("DRPG.Roll.concealIntent"), dc: SABOTAGE_CONCEAL.threshold });
        if (!conceal) return { exit: await abort(actor, paid) };
        rolledAlready = true;

        const hidden = conceal.isCritical || conceal.total >= SABOTAGE_CONCEAL.threshold;
        if (hidden && conceal.withFear) penalty = SABOTAGE_CONCEAL.despairPenalty;

        lines.push(`<p><strong>${SABOTAGE_CONCEAL.label}</strong> - ${conceal.total}${neededNote(conceal.dc)}: ${
            hidden
                ? (conceal.withFear ? SABOTAGE_CONCEAL.successWithDespair : SABOTAGE_CONCEAL.success)
                : SABOTAGE_CONCEAL.failure
        }</p>`);

        /*
         * A FAILURE IS PUBLIC, AND THERE IS NO WALKING AWAY FROM IT (Dawid 18.09).
         *
         * The room saw enough to describe it, and the question that used to follow
         * - "carry on anyway? nothing is spent yet" - handed the action back. That
         * made the concealment roll a free look: it had already paid out its Hope,
         * or a Monokuma's Despair, and the player kept the action too. His rule is
         * that no action may be withdrawn from once the roll for who can see you
         * has been made. Nothing else in the module asks such a question; the test
         * for it is R40.
         */
        if (!hidden) {
            /* THE ROOM'S ONE CARD, AND ITS ONE SOUND (E51 C1; audit S02-51 (e)). A watched sabotage whose roll then came
               with Fear was announced twice to the same room - this line, then `soundSabotage`'s "is seen doing
               something" - with the sound on the second. Now the room is told once, by this line.
               AND THE SOUND ONLY WHEN FEAR REVEALS IT (E51 fix round FG7, 31.10.2026; review goal G4). C1 put the seen
               sound on this card for every watched sabotage and silenced `soundSabotage` for all of them, where row
               E51-07 asked it of the one also revealed by Fear: a watched one with no Fear played the seen sound to the
               room, which it never had, and a failed one lost `sabotageFailed` on the saboteur's browser. Whether Fear
               reveals it is the sabotage roll's, which comes after this one, and a card's sound is played as it
               arrives - so the line waits for that roll (`tellRoom`, once): `soundSabotage` posts it, with the sound
               when the roll revealed the act, and `performSabotage` posts it bare when the sabotage roll is not thrown.
               The owner is told at once, as before. E51-T3 and E51-T30 count the cards and the sounds. */
            let told = false;
            watched = true;
            tellRoom = async ({ seen = false } = {}) => {
                if (told) return;
                told = true;
                await announce({
                    content: `<p><em>${sabotageWatchedLine(actor, room, project)}</em></p>`,
                    whisper: roomAudience(actor),
                    ...(seen ? { flags: { [MODULE_ID]: { sfx: "sabotageSeen" } } } : {})
                });
            };
            await whisperToOwner(actor, `<p>${SABOTAGE_CONCEAL.failure}</p>
                <p>${game.i18n.localize("DRPG.Action.sabotageSeenOn")}</p>`);
        }
    } else {
        lines.push(`<p><em>${SABOTAGE_CONCEAL.aloneNote}</em></p>`);
    }
    return { penalty, rolledAlready, watched, tellRoom };
}

/**
 * What the room is told of a sabotage it watched, escaped. A secret project, or an indirect
 * murder, is not named (E06 C10, 28.09.2026; audit S02-12): the room is everybody standing
 * there, whether or not they can see the project, and the line told them its name. They
 * still see who did it, and roughly what.
 */
export function sabotageWatchedLine(actor, room, project) {
    const unnamed = isSecret(project.id) || isIndirectMurder(project.id);
    return game.i18n.format(unnamed ? "DRPG.Action.sabotageWatchedAnon" : "DRPG.Action.sabotageWatched", {
        actor: foundry.utils.escapeHTML(actor.name),
        room: foundry.utils.escapeHTML(room ?? "-"),
        ...(unnamed ? {} : { project: foundry.utils.escapeHTML(project.name) })
    });
}

/**
 * The Sabotage table as the roll's own total has to reach it: each band's `min` eased by the readied
 * tool's `relief` (never below 0), then moved by the concealment's `penalty` - a penalty of -1 (one
 * thrown with Despair) takes one off the total, so the total must reach one more.
 *
 * ONE BAR FOR THE WINDOW AND THE JUDGE (E16 part 2 C0, 26.10.2026; audit S02-14). The window wrote
 * `t.min - relief + penalty` while `sabotageHit` scored `total + penalty` against the eased bands:
 * with the Despair concealment's -1 the window read "beat 11 / 17" and a total needed 13 / 19, so an
 * 11 or a 12 read as a success and came back "Nothing happens.". Both read this now; tier 1's R985
 * holds each number to the least total the judge puts in its band.
 */
export function sabotageBar(def = ACTIONS.sabotage, relief = 0, penalty = 0) {
    return easedBy(def.thresholds, relief).map(band => ({ ...band, min: band.min - penalty }));
}

/**
 * The band of the Sabotage table a roll reaches, or null: `penalty` on its total (a concealment
 * thrown with Despair), the readied tool's `relief` off the bands - read as `sabotageBar`, the
 * numbers the roll window shows. The one reading `performSabotage` and the GM's band of the
 * Sabotage's trace share (bridge-runs-records.mjs `traceBandOf`, E08+E28 C15).
 */
export function sabotageHit(roll, { penalty = 0, relief = 0 } = {}, def = ACTIONS.sabotage) {
    return roll?.isCritical ? def.critical : resolveThreshold(Number(roll?.total) || 0, sabotageBar(def, relief, penalty));
}

    // Guide's Sabotage table, by the repair project it demands:
    //   12 -> trivial (3)   18 -> complex (6)   crit -> desperate (8)
    // The 12 band was creating a 4-progress "everyday" repair, one scale
    // step harder than the guide asks for.
export function sabotageRepairScale(roll, score, relief) {
    // The complex band is the Sabotage table's top row, read off config.mjs `ACTIONS.sabotage.thresholds` (18 there)
    // rather than written again here (E41 C1b; audit S02-65). It is the same band `easedBy` just lowered, read a
    // second time - so it comes down by the same amount, or a good tool would buy the band without buying the
    // repair it names.
    const complex = Math.max(...ACTIONS.sabotage.thresholds.map(band => band.min));
    return roll.isCritical
        ? PROJECT_SCALE.desperate.progress
        : score >= complex - relief
            ? PROJECT_SCALE.complex.progress
            // The simple repair, its own number since E64 (S02-75): `ACTIONS.sabotage.simpleRepair`.
            : ACTIONS.sabotage.simpleRepair;
}

    // Sabotage always leaves a trace, success or not.
async function dropSabotageTrace(actor, def, roll, { project, room, success, hit, repair }) {
    const { dropRemnant } = await import("./remnants.mjs");
    const visibility = success ? hit.remnant : def.failureRemnant;
    // The type and the Faint mark are the Sabotage's `leavesRemnant` (config.mjs), not spelt here (E41 C1b).
    const { type, faint } = def.leavesRemnant;
    return dropRemnant(actor, {
        type,
        // Sabotaging a murder project is working on the murder too - the saboteur's own: a
        // bystander's Sabotage of somebody else's trap is untied (the E09 plan's C5), and on a GM's
        // own client it was tied until E09 fix r1-G4 (`buildsOwnMurder`, as the bridge asks it).
        tiedToCrime: project && buildsOwnMurder(project.id, actor.id) ? true : null,
        visibility,
        faint,
        action: "sabotage",
        rollId: rollInHand(actor)?.messageId ?? null,
        subject: project.name,
        note: game.i18n.format("DRPG.Remnant.sabotageNote", {
            actor: actor.name,
            project: project.name,
            room: room ?? "?",
            total: roll.total,
            outcome: success
                ? game.i18n.format("DRPG.Remnant.sabotageWorked", { repair: repair?.repair?.name ?? "?" })
                : game.i18n.localize("DRPG.Remnant.sabotageFailed")
        })
    });
}

    /*
     * ONE SOUND FOR ONE SABOTAGE, and which one depends on who found out.
     *
     * These two can both be true - you can fail AND be seen failing - and
     * played together they would be two sounds for one act. Resolved by
     * precedence rather than by `yieldsTo`: the reveal is a public card that
     * arrives whenever the GM's client gets to it, so there is no reliable
     * window for the yield timer to measure. The branch is deterministic and
     * decided here, where both facts are already known.
     *
     * The reveal wins because it is the bigger event and the wider audience: a
     * failure is a fact about your own turn, being watched is a fact about the
     * chapter. And the saboteur is on the announcement's audience too, so
     * playing only the failure would have left them hearing the smaller half.
     */
async function soundSabotage(actor, room, outcome, { watched = false, tellRoom = null } = {}) {
    // Watched (`concealSabotage`): the room's one card is its watched line, with the seen sound only when Fear revealed
    // the act (E51 C1, E51 fix round FG7); a failure not revealed still plays its own below, as before E51.
    if (watched) {
        await tellRoom?.({ seen: outcome.revealed });
        if (outcome.revealed) return;
        if (!outcome.success) playSfx("sabotageFailed");
        return;
    }
    if (outcome.revealed) {
        await announce({
            content: `<p><em>${game.i18n.format("DRPG.Action.sabotageSeen", {
                actor: foundry.utils.escapeHTML(actor.name),
                room: foundry.utils.escapeHTML(room ?? "-")
            })}</em></p>`,
            // The room, not the table (D6): the people who saw it and the GMs.
            // Word of it reaches the rest the way news does in a locked school.
            whisper: roomAudience(actor),
            flags: { [MODULE_ID]: { sfx: "sabotageSeen" } }
        });
    } else if (!outcome.success) {
        // Local: this branch runs on the saboteur's own client. A sabotage that
        // missed still dropped its Remnant (`dropSabotageTrace`, called before
        // this) - the sound is for the trace, not for the miss.
        playSfx("sabotageFailed");
    }
}
