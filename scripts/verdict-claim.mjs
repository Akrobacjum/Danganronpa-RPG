/**
 * Danganronpa RPG - a stopped verdict taken by the GM who finishes it.
 * ---------------------------------------------------------------------------
 * The primary GM's claim of a stopped verdict for the full GM who pressed Finish the verdict (2.0 line T3 TRIAL-03, PRIM-06,
 * 27.11.2026): `claimVerdict`, run on the primary by its own Finish and by `verdict.finish` (bridge-runs-records.mjs
 * `handleVerdictFinish`); the steps then run on the GM it grants (verdict.mjs `finishVerdict`). A file of its own because
 * verdict.mjs stands at the 1500 lines of the split's rule (tools/check.mjs `lengths`); it reads verdict.mjs, which reads it
 * by `import()` alone, so no static cycle (R161).
 */

import { isPrimaryGm, serverNow, serialWrite } from "./utils.mjs";
import { TRIAL_PROGRESS_KEY, writeTrialProgressInStep } from "./trial-progress.mjs";
import { verdictStopped, verdictRunner, verdictRunningHere, latchVerdictHere } from "./verdict.mjs";

/**
 * THE CLAIM OF A STOPPED VERDICT, ON THE PRIMARY (2.0 line T3 TRIAL-03, PRIM-06, 27.11.2026). One step of the record's
 * queue (`TRIAL_PROGRESS_KEY`) reads the verdict as this primary finds it: stopped (`verdictStopped`: a step failed, or
 * its GM gone; this browser's `verdictRunning` false), or the asker's own (its `by` the asker, whose browser says nothing
 * runs there - its reload cut the verdict), and writes it the asker's - `by`, `failed: []`, `claimedAt` - in the same
 * step, so of two presses the queue grants one and the other reads a verdict being given. A claim of the primary itself
 * closes this browser's latch inside the step. Answers `{ granted: true }`, or null with the reason said (`say`):
 * `DRPG.Vote.finishTaken` with the GM giving it, or `DRPG.Vote.verdictAlreadyApplied`. A verdict whose GM is still in
 * its windows is not stopped, and nobody takes it (TRIAL-11 stays).
 */
export async function claimVerdict(sender, { say = (key, data = {}) => ui.notifications.warn(game.i18n.format(key, data)) } = {}) {
    if (!game.user?.isGM || !isPrimaryGm() || !sender?.id) return null;
    // An Assistant GM finishes only a verdict it gave, on its own browser (`finishRoute`): its claim is refused naming the runner.
    if (sender.role !== CONST.USER_ROLES.GAMEMASTER) {
        say("DRPG.Vote.finishOtherGm", { name: game.users.get(verdictRunner())?.name ?? "?" });
        return null;
    }
    let answer = null, refusal = null;
    await serialWrite(TRIAL_PROGRESS_KEY, () => writeTrialProgressInStep(record => {
        const verdict = record?.verdict;
        const own = verdict?.stage === "applying" && verdict.by === sender.id && !(sender.id === game.user.id && verdictRunningHere());
        if (!verdictStopped(record) && !own) {
            refusal = verdict?.stage === "applying"
                ? ["DRPG.Vote.finishTaken", { name: game.users.get(verdict.by)?.name ?? "?" }]
                : ["DRPG.Vote.verdictAlreadyApplied", {}];
            return null;
        }
        if (sender.id === game.user.id) latchVerdictHere();
        answer = { granted: true };
        return { verdict: { ...verdict, by: sender.id, failed: [], claimedAt: serverNow() } };
    }));
    if (refusal) say(...refusal);
    return answer;
}
