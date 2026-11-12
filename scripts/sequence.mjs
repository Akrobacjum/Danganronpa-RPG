/**
 * THE SEQUENCES (E61 C1-C5, 12.11.2026; the owner's storyboard SB-R1 and the approved mockups MK-R1 and MK-R2 of 05.11).
 * ---------------------------------------------------------------------------
 * One engine for the short full-screen sequences a table event plays on every browser: the entry into the Class Trial
 * (E61-A) and the verdict's cut-in (E61-B), and the boards and transitions later stages build on it (E62, E94). What the
 * engine holds, for every sequence the same:
 *
 *   ONE EVENT, ONE START. A sequence starts from the event itself on each browser - the phase's hook, a GM's card - and
 *     never from a client's clock; the same event heard twice (the bus and the setting's `onChange` both describe a
 *     write) starts it once (`started`, by the event's key). Nothing waits for it: it is called from the listener and
 *     never awaited by a writer, so the phase, the turn clock and the first mode card are live from the write.
 *   NOT BEFORE READY, AND NOT AFTER A RELOAD. A browser that loads during a trial is not told the phase moved (sync.mjs
 *     `heard` is read at ready) and a card in the log is not created again, so a client that came late, or reloaded in
 *     the middle of a sequence, plays nothing and shows the end state (the plan's Q-E61-1 default; E62's rule).
 *   ONE AT A TIME, CUT NOT QUEUED. A new sequence, or a phase change, ends the running one at once (the owner's 05.11).
 *   ESCAPE ENDS IT HERE. A capture listener on `window`, registered before foundry-windows.mjs's (module.mjs orders the
 *     two), acts only while a sequence plays and takes the key from the windows behind it; the next Escape reaches
 *     Foundry tools again. There is no Skip button (SB-R1 of 05.11).
 *   STILL UNDER REDUCED MOTION. The Look window's switch or the system's (motion.mjs `reducedMotion`): the sequence's
 *     still frame for its hold, nothing moving (`data-drpg-sequence-mode="still"`), as popup.mjs's critical cut is drawn.
 *   THE TABLE'S SWITCH. A world setting, on by default (`sequences`): off, nothing is drawn on any browser and the
 *     event's sound still plays (the plan's Q-E61-2 default: the sound is the event's).
 *   THE INTERFACE LEFT AS IT STOOD. The sequence opens no window and calls neither `showPopup` nor `recordNotice`
 *     (A7, 11.10): the notice tile and `#drpg-notices-corner` stand above it the whole time (MK-R1: "the notice tile stays
 *     on top"), and `#drpg-popups` keeps its cards. Foundry tools and Map tools are hidden for the span by a body
 *     attribute - never `toggleFoundryTools(false)`, which collapses the sidebar - and stand as they were after it (A8).
 *   NO WORLD STATE. Nothing here writes a setting, a document or a flag; R3700 reads the harness's write log over a run.
 *   COUNTED. `sequence.started`, `.still`, `.off`, `.skipped`, `.ended`, `.cut` through perf-counters.mjs, for E53's
 *     budget and scenario 86 (at rest nothing moves them).
 *
 * The times are the mockups' (MK-R1 #3, #4; MK-R2 #2, #3), written once in `SEQUENCE_TIMES`. They are holds of a
 * sequence's frames, not motion tokens: motion.css zeroes its tokens under reduced motion, and the still frame must
 * still stand its 1.5 s or 3 s there, so the frames' times are read here and the movement under them is never played
 * when the still frame is drawn.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS, getSetting, getClock } from "./settings.mjs";
import { reducedMotion } from "./motion.mjs";
import { count } from "./perf-counters.mjs";
import { esc } from "./utils.mjs";
import { safeRoomImage } from "./vault-store.mjs";

export const SEQUENCE_HOST_ID = "drpg-sequence";
export const SEQUENCE_ATTR = "data-drpg-sequence";

/**
 * Each sequence's frames in ms (the mockups' storyboards), and its still frame's hold. E61-A: the panes close by 900,
 * one pulse of the seams under the closed curtain while the hall changes under it, the title with its impact at 1400,
 * the panes open from 2500 and the hall stands at 3400. E61-B: the band at 0, the portrait at 250, the votes at 900,
 * the stamp's hit at 1700 (MK-R2: earlier than round 1's 2500, so the verdict does not wait), the card's sentence at
 * 1950, frame 5 held to 3500, then a 180 ms fade (MK-R1 #10).
 */
export const SEQUENCE_TIMES = Object.freeze({
    trialEntry: Object.freeze({ close: 860, closed: 900, title: 1400, titleIn: 240, titleOut: 2500, open: 820, end: 3400, still: 1500, sound: 1400 }),
    verdictCut: Object.freeze({ band: 250, portrait: 250, portraitIn: 420, votes: 900, bars: 980, barsIn: 600, stamp: 1700, stampIn: 200, sentence: 1950, hold: 3500, fade: 180, end: 3700, still: 3000, sound: 1700 })
});

/* The eases of motion.css (`--drpg-ease-arrive`, `--drpg-ease-leave`), the same four numbers: an animation's easing
   cannot read a var(), as glass.mjs's ARRIVE says. */
const ARRIVE = "cubic-bezier(0.16, 0.84, 0.28, 1)";
const LEAVE = "cubic-bezier(0.6, 0, 0.84, 0.2)";

let ready = false;
let running = null;
const started = new Set();

/** The table's switch: whether sequences are drawn at this table (a world setting, on unless a GM turned it off). */
export function sequencesOn() {
    try {
        return getSetting(SETTINGS.sequences) !== false;
    } catch {
        return true;
    }
}

/** The sequence playing on this browser now - `{ kind, key, mode }` - or null. For the suite and the scenarios. */
export function sequenceNow() {
    return running ? { kind: running.kind, key: running.key, mode: running.mode } : null;
}

/** Whether this browser has started the sequence of `kind` for the event `key` (one start per event). */
export function sequenceStarted(kind, key) {
    return started.has(`${kind}\u0000${key}`);
}

/**
 * End the sequence playing here, if one is: every timer cleared, every animation cancelled, the host taken out, the
 * body's attribute gone. `why` is counted: "skipped" (Escape), "cut" (a new sequence or a phase change), "ended" (its
 * last frame). A sound already started plays out (Q-E61-2's default).
 */
export function endSequence(why = "cut") {
    const run = running;
    if (!run) return false;
    running = null;
    for (const t of run.timers) clearTimeout(t);
    for (const a of run.anims) { try { a.cancel(); } catch { /* an animation of an element already gone */ } }
    for (const undo of run.undo) { try { undo(); } catch { /* never let the clean-up break what follows */ } }
    run.host.remove();
    document.body.removeAttribute(SEQUENCE_ATTR);
    document.body.removeAttribute(`${SEQUENCE_ATTR}-cover`);
    count(`sequence.${why}`);
    return true;
}

/**
 * Play a sequence: `kind` one of SEQUENCE_TIMES, `key` the event's own name (one start per key), `draw(ctx)` the
 * sequence's frames, `sound` the event's sound (played once, at `SEQUENCE_TIMES[kind].sound` in motion, at once when
 * still or when the table's switch is off). Synchronous; answers what it did - "off", "still", "motion", or null when
 * the event started nothing (before ready, or heard again). Never throws to its caller.
 */
export function playSequence(kind, key, draw, { sound = null } = {}) {
    const times = SEQUENCE_TIMES[kind];
    if (!ready || !times || key == null) return null;
    const id = `${kind}\u0000${key}`;
    if (started.has(id)) return null;
    started.add(id);
    endSequence("cut");
    count("sequence.started");
    if (!sequencesOn()) {
        count("sequence.off");
        sound?.();
        return "off";
    }
    const still = reducedMotion();
    const host = document.createElement("div");
    host.id = SEQUENCE_HOST_ID;
    host.className = `drpg-sequence drpg-sequence-${kind}`;
    host.dataset.drpgSequence = kind;
    host.dataset.drpgSequenceMode = still ? "still" : "motion";
    // the event is told to a screen reader by its own card and the HUD (a11y.mjs hears the phase); this is a picture
    host.setAttribute("aria-hidden", "true");
    const run = { kind, key, host, mode: still ? "still" : "motion", timers: [], anims: [], undo: [] };
    running = run;
    document.body.setAttribute(SEQUENCE_ATTR, kind);
    document.body.append(host);
    const ctx = {
        host, still, times,
        /** Run `fn` at `ms` from the start, while this sequence is the one playing. */
        at: (ms, fn) => { run.timers.push(setTimeout(() => { if (running === run) fn(); }, Math.max(0, ms))); },
        /** Keyframes on an element of the sequence (`fill: both`: the host goes as a whole at the end). */
        anim: (el, frames, opts) => {
            if (still || !el?.animate) return null;
            try { const a = el.animate(frames, { fill: "both", easing: ARRIVE, ...opts }); run.anims.push(a); return a; } catch { return null; }
        },
        /** Something outside the host the sequence changed, put back however the sequence ends. */
        undo: fn => run.undo.push(fn),
        ARRIVE, LEAVE
    };
    try {
        draw(ctx);
    } catch (err) {
        console.error(`${MODULE_ID} | the ${kind} sequence could not be drawn`, err);
        endSequence("ended");
        sound?.();
        return null;
    }
    if (still) {
        count("sequence.still");
        sound?.();
        ctx.at(times.still, () => endSequence("ended"));
    } else {
        if (sound) ctx.at(times.sound, sound);
        ctx.at(times.end, () => endSequence("ended"));
    }
    return run.mode;
}

/* ========================================================================== *
 *  E61-A: INTO THE CLASS TRIAL
 * ========================================================================== */

/** The event's key: the clock's stamp of the trial's edge (clock.mjs stamps `timeOfDayStartedAt` on every road in). */
export function trialEntryKey(clock = getClock()) {
    return clock?.phase === "classTrial" ? `classTrial:${clock.timeOfDayStartedAt ?? clock.writtenAt ?? "?"}` : null;
}

function titleBand(chapter) {
    const band = document.createElement("div");
    band.className = "drpg-seq-title";
    const sub = chapter != null ? game.i18n.format("DRPG.Sequence.trialSubtitle", { chapter }) : game.i18n.localize("DRPG.Sequence.trialSubtitleNoChapter");
    band.innerHTML = `<div class="drpg-seq-title-band">${esc(game.i18n.localize("DRPG.Sequence.trialTitle"))}</div><div class="drpg-seq-title-sub">${esc(sub)}</div>`;
    return band;
}

/** The pieces of glass as elements: each pane's box, its canvases, the transform `closed` held when `shut`. */
function pieceLayer(pieces, cls) {
    const layer = document.createElement("div");
    layer.className = `drpg-seq-glass ${cls}`;
    const els = pieces.map(p => {
        const el = document.createElement("div");
        el.className = "drpg-seq-piece";
        el.style.cssText = `left:${p.box.x0}px;top:${p.box.y0}px;width:${p.box.x1 - p.box.x0}px;height:${p.box.y1 - p.box.y0}px;`;
        for (const c of [p.canvas, p.old].filter(Boolean)) { c.style.cssText = "position:absolute;left:0;top:0;"; el.append(c); }
        if (p.old) p.old.classList.add("drpg-seq-old");
        layer.append(el);
        return el;
    });
    return { layer, els };
}

/**
 * The entry's frames. Under Stained Glass with a curtain painted, the panes on screen are carried to the closed
 * curtain and back (glass.mjs `entryPieces`, the closed plan); otherwise - Monokuma Legacy, a narrow screen, a curtain
 * not cut yet - two lids close from above and below (MK-R1: "two black panels with a red edge"). Both carry the title.
 */
function drawTrialEntry(ctx, glass) {
    const { host, still, times: T, anim, at, ARRIVE: IN, LEAVE: OUT } = ctx;
    const chapter = getClock()?.chapter ?? null;
    host.dataset.drpgSequenceLook = glass ? "glass" : "lids";
    const title = titleBand(chapter);
    if (glass) {
        host.style.setProperty("--drpg-seq-w", `${glass.W}px`);
        const close = pieceLayer(glass.close, "is-close"), open = pieceLayer(glass.open, "is-open");
        host.append(close.layer, open.layer);
        if (still) {
            close.layer.remove();
            glass.open.forEach((p, i) => { open.els[i].style.transform = p.closed; });
        } else {
            open.layer.hidden = true;
            const stagger = p => p.batch * 32;
            glass.close.forEach((p, i) => {
                anim(close.els[i], [{ transform: "none" }, { transform: p.closed }], { duration: T.close, delay: stagger(p) });
                // the hour's colour goes from the Investigation's blue to the trial's pink in batches, outer panes first
                anim(p.old, [{ opacity: 1 }, { opacity: 0 }], { duration: 320, delay: p.batch * 90, easing: "linear" });
            });
            at(T.closed, () => {
                close.layer.remove();
                open.layer.hidden = false;
                glass.open.forEach((p, i) => { open.els[i].style.transform = p.closed; });
                const pulse = document.createElement("div");
                pulse.className = "drpg-seq-pulse";
                host.append(pulse);
                anim(pulse, [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }], { duration: 420, easing: "linear" });
            });
            at(T.titleOut, () => {
                const last = Math.max(0, ...glass.open.map(p => p.batch));
                glass.open.forEach((p, i) => {
                    open.els[i].style.transform = "";
                    anim(open.els[i], [{ transform: p.closed }, { transform: "none" }], { duration: T.open - (last - p.batch) * 10, delay: (last - p.batch) * 10, easing: OUT });
                });
            });
        }
    } else {
        const lids = ["top", "bottom"].map(side => {
            const lid = document.createElement("div");
            lid.className = `drpg-seq-lid is-${side}`;
            host.append(lid);
            return lid;
        });
        if (!still) {
            lids.forEach((lid, i) => anim(lid, [{ transform: `translateY(${i ? 100 : -100}%)` }, { transform: "translateY(0)" }], { duration: T.close }));
            at(T.titleOut, () => lids.forEach((lid, i) => anim(lid, [{ transform: "translateY(0)" }, { transform: `translateY(${i ? 100 : -100}%)` }], { duration: T.open, easing: OUT })));
        }
    }
    // the room tile and the voice tile go with their glass, and come back with it (A8)
    document.body.setAttribute(`${SEQUENCE_ATTR}-cover`, "");
    ctx.undo(() => document.body.removeAttribute(`${SEQUENCE_ATTR}-cover`));
    if (!still) at(T.titleOut, () => document.body.removeAttribute(`${SEQUENCE_ATTR}-cover`));
    if (still) { host.append(title); return; }
    at(T.title, () => {
        host.append(title);
        anim(title, [{ transform: "rotate(-3deg) scale(1.12)", opacity: 0 }, { transform: "rotate(-3deg) scale(1)", opacity: 1 }], { duration: T.titleIn, easing: IN });
    });
    at(T.titleOut, () => anim(title, [{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: "linear" }));
}

/**
 * The entry, from the phase's hook on this browser. Answers what `playSequence` answered. `glass` is the closed
 * curtain's pieces (glass.mjs `entryPieces`), asked here and not by the hook's caller: the glass is only moved when the
 * sequence is drawn, so the table's switch off and a second hearing of the event leave the curtain's own turn alone.
 */
export async function playTrialEntry(clock = getClock()) {
    const key = trialEntryKey(clock);
    if (!key || sequenceStarted("trialEntry", key) || !ready) return null;
    let glass = null;
    if (sequencesOn() && document.body.classList.contains("drpg-theme-stained-glass")) {
        // the attribute the HUD writes from the same clock row; written here too, so the curtain reads the trial's colour
        document.body.dataset.drpgPhase = "classTrial";
        try { glass = (await import("./glass.mjs")).entryPieces?.() ?? null; } catch { glass = null; }
    }
    return playSequence("trialEntry", key, ctx => drawTrialEntry(ctx, glass), { sound: () => playSound("trialStart") });
}

/* ========================================================================== *
 *  E61-B: THE VERDICT'S CUT-IN
 * ========================================================================== */

/**
 * What the cut-in shows, read from the GM's card and the public record alone: the card's `verdictCut` flag (the
 * sentenced's ids and whether the class got it right, both said in the card's own words) and the vote's count
 * (`trialProgress.accused`, `total`, `majority`: public since the count's card). Nothing of the Blackened, of Findings,
 * of Zones or of any GM store (05.10; R3708 plants a Blackened to show it). Pure but for the actors' names and pictures.
 */
export function verdictBoard(message, progress = null) {
    const flag = message?.getFlag?.(MODULE_ID, "verdictCut") ?? null;
    if (!flag || typeof flag !== "object") return null;
    const ids = Array.isArray(flag.sentenced) ? flag.sentenced.filter(id => typeof id === "string").slice(0, 2) : [];
    const sentenced = ids.map(id => game.actors.get(id)).filter(Boolean).map(a => ({ id: a.id, name: a.name, img: portraitOf(a) }));
    const variant = !sentenced.length ? "nobody" : flag.right === true ? "guilty" : "innocent";
    const p = progress ?? safeProgress();
    const total = Number.isFinite(p?.total) && p.total > 0 ? p.total : null;
    const name = id => id === "monokuma" ? game.i18n.localize("DRPG.Vote.monokuma") : (game.actors.get(id)?.name ?? "?");
    const votes = Array.isArray(p?.accused) ? p.accused.filter(r => r && typeof r.n === "number").slice(0, 4).map(r => ({ name: name(r.id), n: r.n })) : [];
    const sentence = game.i18n.localize(variant === "nobody" ? "DRPG.Vote.nobodyExecuted" : variant === "guilty" ? "DRPG.Vote.verdictRight" : "DRPG.Vote.verdictWrong");
    return { variant, sentenced, votes, total, majority: Number.isFinite(p?.majority) ? p.majority : null, sentence };
}

function safeProgress() {
    try { return getSetting(SETTINGS.trialProgress) ?? null; } catch { return null; }
}

/* The sentenced's picture through the module's one filter of image paths (vault-store.mjs `safeRoomImage`, as the voice
   tile reads a portrait); Foundry's stand-in silhouette is no portrait, and the initial stands instead. */
function portraitOf(actor) {
    const path = safeRoomImage(actor?.img);
    return path && !/mystery-man|\/icons\/svg\//.test(path) ? path : null;
}

/**
 * Frame 5 of the cut-in, alone and still, as an element: the band, the portrait(s) with the stamp over them, the name,
 * the votes and the card's sentence. The cut-in draws it and moves its parts; E99's summary takes it whole.
 */
export function verdictBoardElement(board) {
    const el = document.createElement("div");
    el.className = `drpg-seq-verdict is-${board.variant}`;
    el.dataset.drpgVerdict = board.variant;
    const stamp = game.i18n.localize(board.variant === "guilty" ? "DRPG.Sequence.stampGuilty" : "DRPG.Sequence.stampInnocent");
    const share = n => board.total ? Math.round(100 * n / board.total) : 0;
    const people = board.sentenced.map(s => `<div class="drpg-seq-person">
            <div class="drpg-seq-portrait">${s.img ? `<img src="${esc(s.img)}" alt="">` : `<span class="drpg-seq-initial">${esc((s.name ?? "?").slice(0, 1))}</span>`}
                <div class="drpg-seq-stamp">${esc(stamp)}</div></div>
            <div class="drpg-seq-name">${esc(s.name)}</div>
        </div>`).join("");
    el.innerHTML = `<div class="drpg-seq-vband"></div>
        ${people ? `<div class="drpg-seq-people">${people}</div>` : ""}
        <div class="drpg-seq-votes">
            <h4>${esc(game.i18n.localize("DRPG.Sequence.votesCounted"))}</h4>
            ${board.votes.map(v => `<div class="drpg-seq-vrow"><span class="drpg-seq-vname">${esc(v.name)}</span><span class="drpg-seq-vbar"><i style="transform: scaleX(${share(v.n) / 100})"></i>${board.majority && board.total ? `<b style="left: ${share(board.majority)}%"></b>` : ""}</span><em>${v.n}</em></div>`).join("")}
        </div>
        <div class="drpg-seq-sentence">${esc(board.sentence)}</div>`;
    return el;
}

function drawVerdictCut(ctx, board) {
    const { host, still, times: T, anim } = ctx;
    const el = verdictBoardElement(board);
    host.append(el);
    if (still) return;
    anim(el.querySelector(".drpg-seq-vband"), [{ transform: "translateX(-110%)" }, { transform: "translateX(0)" }], { duration: T.band });
    el.querySelectorAll(".drpg-seq-person").forEach((p, i) => {
        anim(p.querySelector(".drpg-seq-portrait"), [{ transform: "translateX(70vw) rotate(3deg)" }, { transform: "translateX(0) rotate(3deg)" }], { duration: T.portraitIn, delay: T.portrait + i * 60 });
        anim(p.querySelector(".drpg-seq-name"), [{ transform: "translateX(80vw)" }, { transform: "translateX(0)" }], { duration: T.portraitIn, delay: T.portrait + 80 + i * 60 });
        anim(p.querySelector(".drpg-seq-stamp"), [{ opacity: 0, transform: "rotate(-14deg) scale(1.6)" }, { opacity: 1, transform: "rotate(-14deg) scale(1)" }], { duration: T.stampIn, delay: T.stamp });
    });
    anim(el.querySelector(".drpg-seq-votes"), [{ opacity: 0, transform: "translateX(-60px)" }, { opacity: 1, transform: "translateX(0)" }], { duration: 180, delay: T.votes });
    el.querySelectorAll(".drpg-seq-vbar i").forEach(i => anim(i, [{ transform: "scaleX(0)" }, { transform: i.style.transform }], { duration: T.barsIn, delay: T.bars }));
    anim(el.querySelector(".drpg-seq-sentence"), [{ opacity: 0, transform: "rotate(-4deg) translateY(16px)" }, { opacity: 1, transform: "rotate(-4deg) translateY(0)" }], { duration: 240, delay: board.variant === "nobody" ? T.stamp : T.sentence });
    anim(el, [{ opacity: 1 }, { opacity: 0 }], { duration: T.fade, delay: T.hold, easing: ctx.LEAVE, fill: "forwards" });
}

/**
 * The cut-in, from a new chat message on this browser: a GM's card with the verdict's flags (verdict.mjs
 * `postVerdictCard`), created after this client's ready. A player's message with the same flags starts nothing.
 */
export function playVerdictCut(message) {
    if (!message?.author?.isGM) return null;
    const at = message.getFlag?.(MODULE_ID, "verdictAt");
    if (at == null) return null;
    const board = verdictBoard(message);
    if (!board) return null;
    return playSequence("verdictCut", `verdict:${at}`, ctx => drawVerdictCut(ctx, board), { sound: () => playSound("verdictCut") });
}

/* ========================================================================== *
 *  SOUND, ESCAPE, REGISTRATION
 * ========================================================================== */

function playSound(key) {
    import("./sfx-play.mjs").then(m => m.playSfx(key)).catch(() => null);
}

function onEscape(event) {
    if (!running || event.key !== "Escape" || event.defaultPrevented) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    endSequence("skipped");
}

/**
 * Once at ready, before foundry-windows.mjs's own Escape listener (module.mjs): from now on an event starts a
 * sequence. The phase's hook starts the entry and ends anything else that plays; a GM's verdict card starts the cut-in.
 */
export function registerSequences() {
    if (ready) return;
    ready = true;
    window.addEventListener("keydown", onEscape, { capture: true });
    Hooks.on("drpgPhaseChanged", phase => {
        if (running && !(running.kind === "trialEntry" && phase === "classTrial")) endSequence("cut");
        if (phase === "classTrial") playTrialEntry().catch(err => console.error(`${MODULE_ID} | the trial's entry failed`, err));
    });
    Hooks.on("createChatMessage", message => {
        try { playVerdictCut(message); } catch (err) { console.error(`${MODULE_ID} | the verdict's cut-in failed`, err); }
    });
}
