/**
 * Danganronpa RPG - the boundary between two times of day: one road to start and end an Eclipse.
 * ---------------------------------------------------------------------------
 * ONE ROAD (E37 C2, 01.11.2026; audit S10-54, decision D44b: "Obie drogi (szewron i panel) tą samą funkcją
 * toggleEclipse, z pytaniem tylko wtedy, gdy ktoś nie rozstawił postaci"). The HUD's chevron and the GM panel's "Do it"
 * were two roads with two behaviours: the chevron asked E17's question before a start and ended a running Eclipse at
 * once, over a student who had not placed; the panel started one without the question and showed the placement table
 * at every end, whoever had placed. Both call `toggleEclipse` now (tier 0 R1194, tier 2 E37-T2). The writes are
 * eclipse.mjs `startEclipse` and `endEclipse`, as before; this file asks the GM and chooses which.
 *
 * In the clock's family (clock.mjs, eclipse.mjs), and imported by the HUD and the panel with `import()`, as they import
 * eclipse.mjs.
 */

import { getClock, timeOfDayLabel, boundaryStamp } from "./clock.mjs";
import { isEclipse, incomingTimeOfDay, startEclipse, endEclipse, startRefusal, placementStatus, eclipseLabel } from "./eclipse.mjs";
import { tableDialog } from "./utils.mjs";

/**
 * Start the Eclipse, or end the running one (D44b).
 *
 * A START: the refusals first, with their words (eclipse.mjs `startRefusal`: a body nobody has answered, an incident
 * before Stage 6, a Class Trial - the HUD dims its chevron with the same words), then E17's question (`askEclipse`,
 * "Not yet" the default), then `startEclipse`. The panel's "Do it" asks it too now (Q-E37-3, approved 01.11.2026): until
 * E37 it started an Eclipse without asking, and a misclick there cost the five-minute take-back.
 *
 * AN END: nothing is asked when every placing student has crossed at least once (`placementStatus`, the one cast's
 * `moved`): the Eclipse ends and the clock moves to the time of day it led into. Otherwise the placement table - who
 * has crossed and where they stand, the ones who have not dimmed - with End and move the clock, End without advancing
 * and Close. The Night Eclipse, which places freely (D197), reads the same: its crossings are counted too (eclipse.mjs
 * `countCrossingInStep`), so a student at 0 holds its end as well.
 */
export async function toggleEclipse() {
    if (!game.user.isGM) return null;
    if (!isEclipse()) {
        const refusal = await startRefusal(getClock());
        if (refusal) {
            ui.notifications.warn(game.i18n.localize(refusal));
            return null;
        }
        if (!await askEclipse(incomingTimeOfDay(getClock()))) return null;
        return startEclipse();
    }

    const rows = placementStatus();
    if (rows.every(s => s.moved > 0)) return endEclipse({ advance: true });
    const choice = await placementTable(rows);
    if (choice === "end") return endEclipse({ advance: true });
    if (choice === "endOnly") return endEclipse({ advance: false });
    return null;
}

/**
 * THE QUESTION ASKS FIRST, AND "NO" IS THE DEFAULT (E17 C7, 26.10.2026; audit S10-42; moved here from hud.mjs by E37 C2).
 * One press opened the Eclipse: the refill, the grants and the seals gone and a card on every screen, from a control
 * beside the rewind. The press asks, the Eclipse it opens named, and Enter or a closed window answers no. Asked on both
 * roads since E37 C2 (`toggleEclipse`), after the refusals, so a held start is refused with its words and not asked.
 */
async function askEclipse(incoming) {
    const DialogV2 = foundry.applications.api.DialogV2;
    const name = game.i18n.format("DRPG.Eclipse.named", { time: timeOfDayLabel(incoming) });
    return Boolean(await DialogV2.confirm({
        classes: ["drpg-panel"],
        window: { title: name },
        content: `<p>${eclipseQuestion(getClock(), name).text}</p>`,
        yes: { label: game.i18n.localize("DRPG.Hud.eclipseAskYes") },
        no: { label: game.i18n.localize("DRPG.Hud.eclipseAskNo"), default: true },
        rejectClose: false
    }));
}

/**
 * WHAT THE QUESTION SAYS (E17 fix p2-G2, 26.10.2026; the end review's E17p2-R4; moved here from hud.mjs by E37 C2):
 * `{ key, text }` for the Eclipse `name` over `clock`. A boundary refilled already (`refilledFor`, an Eclipse for it
 * ended without advancing more than five minutes ago) refills nobody again (eclipse.mjs `startEclipse`), and the
 * question said everyone's actions refill: it says so now. Pure but for the words (R1004).
 */
export function eclipseQuestion(clock, name) {
    const key = clock?.refilledFor && clock.refilledFor === boundaryStamp(clock) ? "DRPG.Hud.eclipseAskRefilled" : "DRPG.Hud.eclipseAsk";
    return { key, text: game.i18n.format(key, { name: foundry.utils.escapeHTML(String(name ?? "")) }) };
}

/**
 * The placement table, for an end with somebody who has not crossed (moved here from gm-panel.mjs `toggleEclipse` by
 * E37 C2): a row a placing student, the ones at 0 dimmed, under `DRPG.Eclipse.endPrompt`. Answers the button pressed:
 * "end", "endOnly", or "cancel" / null for Close.
 */
function placementTable(rows) {
    const body = rows.map(s => `
        <tr${s.moved === 0 ? ' style="opacity:.55"' : ""}>
            <td>${foundry.utils.escapeHTML(s.actor.name)}</td>
            <td>${foundry.utils.escapeHTML(s.room ?? "-")}</td>
            <td style="text-align:center">${
                // A free-placement Eclipse has no budget, so the column reports
                // how often they have crossed - whether they have placed at all,
                // which is the question the GM is holding this window open to answer.
                s.allowance === null ? s.moved : `${s.moved} / ${s.allowance}`
            }</td>
        </tr>`).join("");

    return tableDialog({
        window: { title: eclipseLabel() },
        classes: ["drpg-panel"],
        content: `<p>${game.i18n.localize("DRPG.Eclipse.endPrompt")}</p>
            <table><thead><tr>
                <th>${game.i18n.localize("DRPG.Panel.character")}</th>
                <th>${game.i18n.localize("DRPG.Project.room")}</th>
                <th>${game.i18n.localize("DRPG.Eclipse.movesColumn")}</th>
            </tr></thead><tbody>${body}</tbody></table>`,
        buttons: [
            { action: "end", label: game.i18n.localize("DRPG.Eclipse.endAndAdvance"), default: true },
            { action: "endOnly", label: game.i18n.localize("DRPG.Eclipse.endOnly") },
            { action: "cancel", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        rejectClose: false
    });
}
