/**
 * THE BALLOTS A DISCONNECTED PLAYER HOLDS (2.0 line T3 TRIAL-06, 27.11.2026; the owner's recommendation: "Ostrzeżenie mówi
 * wprost, ile kart mają rozłączeni gracze (i kto)"). The count's base stands (D6, CASE-14 in vote.mjs `ballotBase`: a
 * ballot issued and not returned is one that never came back, and the public card says how many). The GMs are told,
 * besides, how many of those sit with a player who is not connected now and whose student they are: in the vote window
 * (trial-floor-ui.mjs `openVoteDialog`), the count's preview (`previewVoteResult`, EXP-GM-04) and the verdict's window
 * (verdict.mjs `openVerdictDialog`, through verdict-skips.mjs `goneVerdictHtml`). Never on the table's card. A leaf of
 * the vote's family, so the verdict's window reads it without the vote's facade (vote.mjs imports verdict.mjs).
 */
import { plural, listOf, esc } from "./utils.mjs";
import { trialProgress } from "./trial-progress.mjs";
import { ballotStore } from "./gm-stores.mjs";
import { studentActors } from "./monokuma.mjs";

/** The user ids of `issued` not in `cast` whose user `users` holds and reads not connected. Pure on its readings (R9142). */
export function goneBallots({ issued = [], cast = [], users = game.users } = {}) {
    const back = new Set(cast);
    return [...new Set(issued)].filter(id => !back.has(id) && users?.get?.(id) && users.get(id).active !== true);
}

/** The students of the players `goneBallots` names, by name: the player's assigned character, else a student they own, else their own name. */
export function goneNames(userIds = []) {
    return userIds.map(id => game.users.get(id)).filter(Boolean)
        .map(user => user.character?.name ?? studentActors().find(actor => actor.testUserPermission(user, "OWNER"))?.name ?? user.name);
}

/**
 * The GMs' line of the ballots disconnected players hold, or "": the vote's record as it stands and this browser's copy
 * of its round's ballots (the rows vote.mjs `roundBallots` reads: the record's chapter and round, a choice).
 */
export function goneBallotsLine(progress = trialProgress()) {
    if (!game.user?.isGM || !progress?.vote) return "";
    const cast = Object.entries(ballotStore.entries() ?? {}).filter(([, row]) => row?.chapter === progress.chapter
        && row?.round === progress.vote.round && Array.isArray(row?.choice)).map(([userId]) => userId);
    const names = goneNames(goneBallots({ issued: progress.vote.issued ?? [], cast, users: game.users }));
    return names.length ? plural("DRPG.Vote.silentGone", { n: names.length, names: listOf(names.map(name => esc(name))) }) : "";
}
