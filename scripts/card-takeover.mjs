/**
 * Danganronpa RPG - a card taken over by another GM (2.0 line T2, CALLS-01, EXP-GM-05, CALLS-12, 27.11.2026).
 * ---------------------------------------------------------------------------
 * The GM's browser's half of a take-over: the claims this browser rules under now and the windows each opened
 * (`startClaimRun`, `endClaimRun`, `claimLostHere`), the primary's word that another GM took one over and what it
 * closes (`onCardTakenOver`, `cardTakenOverHere`), the question a press on a card another GM holds asks
 * (`askTakeOver`), the answer to a press on a card this GM's own other window holds (`raiseOwnClaim`), and the card's
 * own Take over (`takeOverFromCard`). bridge-asks.mjs `claimCard` runs a claim through it; the primary's half is
 * call-gm.mjs `claimOnPrimary`.
 *
 * WHERE IT SITS. A file of its own and not part of bridge-asks.mjs, which it would have put past the split's 1500
 * lines (tools/check.mjs `lengths`: 1595 measured with it there, 27.11.2026); no facade re-exports it. It imports
 * bridge-asks.mjs only by `import()` (bridge-asks.mjs imports it), and call-gm.mjs reaches it the same way.
 */

import { MODULE_ID } from "./config.mjs";
import { debug, esc, localeFormat, primaryGmId } from "./utils.mjs";
import { drpgWindow, tipText } from "./ui-kit.mjs";
import { sayRefusedHere } from "./call-gm.mjs";
import { ACTION_CARD_TAKEN } from "./bridge-wire.mjs";

/*
 * THE CLAIMS THIS BROWSER IS RULING UNDER NOW (2.0 line T2, CALLS-01, 27.11.2026): messageId -> `{ windows, before, lost }`
 * - the windows first drawn while the claim's work runs, the ids of those open when it began, and the GM who took the
 * card over, once the primary said so. In memory: a reload holds no claim's window, and the GM's own claims are let go
 * at its ready (call-gm.mjs `releaseOwnClaims`, CALLS-02). Two claims of this GM's at once each keep every window drawn
 * meanwhile, so a take-over of one closes the other's too: a case this does not tell apart (no claim names its window).
 */
const runningClaims = new Map();
let claimWindowsWatched = false;

/** A claim of `messageId` begins to run here (bridge-asks.mjs `claimCard`): its record, which keeps its windows. */
export function startClaimRun(messageId) {
    const run = { windows: new Set(), before: new Set(foundry.applications?.instances?.keys?.() ?? []), lost: null };
    runningClaims.set(messageId, run);
    watchClaimWindows();
    return run;
}

/** The claim `run` of `messageId` has ended here. */
export function endClaimRun(messageId, run) {
    if (runningClaims.get(messageId) === run) runningClaims.delete(messageId);
}

/** Keep each window first drawn while a claim runs with that claim (`runningClaims`); once per browser. */
function watchClaimWindows() {
    if (claimWindowsWatched) return;
    claimWindowsWatched = true;
    Hooks.on("renderApplicationV2", (app, element, context, options) => {
        if (!runningClaims.size || options?.isFirstRender === false) return;
        for (const run of runningClaims.values()) if (!run.lost && !run.before.has(app?.id)) run.windows.add(app);
    });
}

/** Whether the claim this browser is ruling `messageId` under was taken over by another GM (CALLS-01): a ruling whose
    effect follows its window here reads it before it acts (messenger-app.mjs). */
export function claimLostHere(messageId) {
    return Boolean(runningClaims.get(messageId ?? "")?.lost);
}

/**
 * Another GM, `by`, has taken over the card this browser's claim was ruling (CALLS-01): its windows are closed, the claim
 * is marked lost, and this GM is told (`DRPG.Bridge.claimTakenOver`). The primary's own claim comes here with no packet
 * (call-gm.mjs `tellTakenOver`). Answers whether a claim of this card was running here. `say` is a test's (R9020).
 */
export function cardTakenOverHere(messageId, by, { say = sayRefusedHere } = {}) {
    const run = runningClaims.get(messageId ?? "");
    if (!run || run.lost) return false;
    run.lost = by || "?";
    for (const app of run.windows) {
        if (app?.rendered) Promise.resolve(app.close()).catch(err => debug("Could not close a window of a card taken over", err));
    }
    say(game.i18n.format("DRPG.Bridge.claimTakenOver", { gm: game.users.get(by ?? "")?.name ?? "?" }));
    return true;
}

/**
 * The primary's word that another GM took over this GM's card (`card.takenOver`, GM -> GM; CALLS-01). Taken only on a
 * GM's browser, addressed to this user, and only from the primary GM by Foundry's own `senderId` - not from any field of
 * the packet: another GM's or a player's console could send one, and it would close a GM's window of a card nobody took.
 * The card's id names only which of this browser's own claims ends; nothing else is read. Answers whether it acted.
 * `roads` (a test's, R9020) is handed on; Foundry calls a listener with two arguments.
 */
export function onCardTakenOver(payload, senderId, roads = {}) {
    if (payload?.action !== ACTION_CARD_TAKEN) return false;
    if (!game.user?.isGM || payload.userId !== game.user.id) return false;
    if (!senderId || senderId !== primaryGmId()) return false;
    return cardTakenOverHere(payload.messageId, payload.by, roads);
}

/**
 * Ask this GM whether to take over the card `taken.by` is ruling on since `taken.at` (CALLS-01). True for Take over. The
 * question closes itself, answering no, once the GMs' row of `messageId` no longer says that GM holds it - ruled, let go
 * or taken by a third GM meanwhile (F3 S4 A: two GMs pressing one card at once, the one who lost asked a question about a
 * card the other ruled a moment later).
 */
export async function askTakeOver(taken, messageId = null) {
    const gm = game.users.get(taken.by ?? "")?.name ?? String(taken.by ?? "?");
    const time = typeof taken.at === "number" ? localeFormat("time", taken.at, { hour: "2-digit", minute: "2-digit" }) : "?";
    const { ruledCardStore } = await import("./gm-stores.mjs");
    const key = `${MODULE_ID}.${ruledCardStore.spec.key}`;
    let hook = null;
    const answer = await drpgWindow({
        classes: ["drpg-panel"],
        title: game.i18n.localize("DRPG.Bridge.takeOverTitle"),
        body: `<p>${esc(game.i18n.format("DRPG.Bridge.takeOverAsk", { gm, time }))}</p>`,
        footer: {
            primary: { action: "take", label: game.i18n.localize("DRPG.Bridge.takeOver"), tooltip: tipText("DRPG.Bridge.takeOverNowTooltip") },
            close: { role: "cancel", action: "cancel", callback: () => null },
            default: "cancel"
        },
        render: (event, dialog) => {
            if (!messageId || hook !== null) return;
            hook = Hooks.on("clientSettingChanged", changed => {
                if (changed !== key) return;
                const row = ruledCardStore.get(messageId);
                if (!(row?.pending && row.by === taken.by) && dialog?.rendered) void dialog.close();
            });
        },
        rejectClose: false
    });
    if (hook !== null) Hooks.off("clientSettingChanged", hook);
    return answer === "take";
}

/** This GM's own other window holds the card (CALLS-12): said so, and that window brought to the front if it is found. */
export function raiseOwnClaim(messageId, say = sayRefusedHere) {
    say(game.i18n.localize("DRPG.Bridge.claimOwnOpen"));
    const open = [...(runningClaims.get(messageId)?.windows ?? [])].filter(app => app?.rendered);
    const app = open[open.length - 1];
    if (!app) return false;
    try {
        if (app.minimized) void app.maximize?.();
        app.bringToFront?.();
    } catch (err) { debug("Could not bring a card's open window to the front", err); }
    return true;
}

/**
 * Take over from the card's own button (EXP-GM-05, 2.0 line T2, 27.11.2026; messenger-app.mjs `wireCallActions`): the
 * claim's "takeover" and, at once, its "drop" - the other GM's window closes and the card is free, and this GM presses
 * one of the card's answers as usual. A claim held here with no window open would hold the card in this GM's own name
 * (CALLS-12's answer to the next press), so none is kept. Answers whether the other GM's claim was ended. `claim` and
 * `say` are a test's (R9070).
 */
export async function takeOverFromCard(messageId, { claim = null, say = sayRefusedHere } = {}) {
    if (!messageId || !game.user?.isGM) return false;
    claim ??= (await import("./bridge-asks.mjs")).askCardClaim;
    const taken = await claim(messageId, "takeover");
    if (!taken?.taken) {
        if (taken?.why === "ruled") say(game.i18n.format("DRPG.Bridge.alreadyRuled", { gm: game.users.get(taken.by ?? "")?.name ?? "?" }));
        else if (taken?.why === "settled") say(game.i18n.localize("DRPG.Bridge.alreadySettled"));
        return false;
    }
    await claim(messageId, "drop");
    return true;
}
