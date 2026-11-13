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
 *   NOT BEFORE READY; LATE FOR 10 MINUTES (gaps-111, 13.11.2026: the owner's answer to Q-E61-1 and Q-E94-4, "Przez 10
 *     minut"). A browser that loads during a trial is not told the phase moved (sync.mjs `heard` is read at ready) and a
 *     card in the log is not created again, so no hook plays the event there. Instead, once at ready, `catchUpSequences`
 *     plays the newest event under 10 minutes old (`LATE_PLAY_MS`) - the trial's entry, the verdict's cut-in, the
 *     start-of-day board - that this browser would have seen live and has not played (`lateSequence`); past 10 minutes,
 *     nothing, and the end state stands. Once per event per browser: every start is written to this browser's own
 *     record (`localStorage`, `drpg-sequences-played`, kept 10 minutes), which a reload reads; nothing goes to the world.
 *     The end-of-day board is not played late: its rows are the day that ended, whose start the new clock no longer
 *     holds. E62's transitions (the curtain's turn, the discovery's flicker) are not sequences and play nothing late.
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

import { MODULE_ID, TIME_OF_DAY_LABELS, MOOD_SHARES } from "./config.mjs";
import { SETTINGS, getSetting, getClock, isDeceased } from "./settings.mjs";
import { reducedMotion } from "./motion.mjs";
import { count } from "./perf-counters.mjs";
import { esc, serverNow } from "./utils.mjs";
import { slideAt } from "./glass-close.mjs";
import { spectatorViewer } from "./spectator.mjs";

export const SEQUENCE_HOST_ID = "drpg-sequence";
export const SEQUENCE_ATTR = "data-drpg-sequence";

/**
 * Each sequence's frames in ms (the mockups' storyboards), and its still frame's hold. E61-A: the panes close by 900,
 * the title with its impact at 1400, the panes open from 2500 and the hall stands at 3400; the copies of the curtain
 * cross over with the live one in the first `handIn` ms (500) and the last `hand` ms (400: at 300, the seam report's
 * 200-300, the probe read the exit's last frames +4.4 apart, at 400 at most +2.9). E61-B: the band at 0, the portrait
 * at 250, the votes at 900,
 * the stamp's hit at 1700 (MK-R2: earlier than round 1's 2500, so the verdict does not wait), the card's sentence at
 * 1950, frame 5 held to 3500, then a 180 ms fade (MK-R1 #10).
 */
export const SEQUENCE_TIMES = Object.freeze({
    trialEntry: Object.freeze({ close: 860, closed: 900, title: 1400, titleIn: 240, titleOut: 2500, open: 820, end: 3400, still: 1500, sound: 1400, handIn: 500, hand: 400 }),
    /* The trial's exit (the owner's decision of 12.11.2026, every default accepted): the entry's frames and length, the
       still frame 1.5 s; no sound of its own - the table hears End the trial's card (`trialClose`) - so `sound` is never
       played (`playTrialExit` hands none). */
    trialExit: Object.freeze({ close: 860, closed: 900, title: 1400, titleIn: 240, titleOut: 2500, open: 820, end: 3400, still: 1500, sound: 0, handIn: 500, hand: 400 }),
    /* E94 C2, the start-of-day board (MK-R2 #4, #8): the board rises at 300 ms over 600, the cast one by one 140 ms apart
       from 600, the morning line at 1800, held to 4900, gone in 420; still, the board for 5 s; the chime at once. */
    dayStart: Object.freeze({ board: 300, rise: 600, cast: 600, castStep: 140, announce: 1800, hold: 4900, fade: 420, end: 5350, still: 5000, sound: 0 }),
    /* E94 C3, the end-of-day board: the board rises at 200 ms over 500, the rows one by one 120 ms apart from 700, the
       school's mood at 2000 (no number since the owner's word of 12.11), held to 6000, gone in 420; still, 6 s. */
    dayEnd: Object.freeze({ board: 200, rise: 500, rows: 700, rowStep: 120, mood: 2000, hold: 6000, fade: 420, end: 6450, still: 6000, sound: 0 }),
    verdictCut: Object.freeze({ band: 250, portrait: 250, portraitIn: 420, votes: 900, rowIn: 320, rowStep: 90, bars: 980, barsIn: 600, stamp: 1700, stampIn: 200, sentence: 1950, sentenceIn: 380, hold: 3500, fade: 180, end: 3700, still: 3000, sound: 1700 })
});

/* The eases of motion.css (`--drpg-ease-arrive`, `--drpg-ease-leave`), the same four numbers: an animation's easing
   cannot read a var(), as glass.mjs's ARRIVE says. */
const ARRIVE = "cubic-bezier(0.16, 0.84, 0.28, 1)";
const LEAVE = "cubic-bezier(0.6, 0, 0.84, 0.2)";

let ready = false;
let running = null;
const started = new Set();

/** How long after its event a browser that loads still plays a sequence (the owner's "Przez 10 minut", 13.11.2026). */
export const LATE_PLAY_MS = 10 * 60 * 1000;
/* This browser's own record of the sequences it started, `{ id: when }` (server time), so a reload inside the 10 minutes
   plays nothing twice. The browser's storage, never the world's; anything older than the window is dropped as it is
   written, and a browser whose storage cannot be read plays as if it had played nothing. */
const PLAYED_KEY = "drpg-sequences-played";
function playedRecord() {
    try {
        const record = JSON.parse(globalThis.localStorage?.getItem(PLAYED_KEY) ?? "{}");
        return record && typeof record === "object" && !Array.isArray(record) ? record : {};
    } catch {
        return {};
    }
}
function notePlayed(id, now = serverNow()) {
    try {
        const record = playedRecord();
        for (const [k, at] of Object.entries(record)) if (!(now - Number(at) < LATE_PLAY_MS)) delete record[k];
        record[id] = now;
        globalThis.localStorage?.setItem(PLAYED_KEY, JSON.stringify(record));
    } catch { /* a browser that keeps nothing plays again on a reload, within the window */ }
}

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
    /* WHAT FOLLOWS (E94 C3): the end-of-day board hands on to the start-of-day board. Only when the sequence ended on its
       own or was skipped: one cut by another sequence or a phase change hands on nothing, so a trial's entry is never
       followed by a board it cut. */
    if (run.then && (why === "ended" || why === "skipped")) queueMicrotask(() => { try { run.then(why); } catch { /* never let what follows break this */ } });
    // and whoever waits for it to be over, however it ended (the trial's exit: the day's boards wait for it)
    if (run.onEnd) queueMicrotask(() => { try { run.onEnd(why); } catch { /* never let what follows break this */ } });
    return true;
}

/**
 * Play a sequence: `kind` one of SEQUENCE_TIMES, `key` the event's own name (one start per key), `draw(ctx)` the
 * sequence's frames, `sound` the event's sound (played once, at `SEQUENCE_TIMES[kind].sound` in motion, at once when
 * still or when the table's switch is off). Synchronous; answers what it did - "off", "still", "motion", or null when
 * the event started nothing (before ready, or heard again). Never throws to its caller. `on` is the table's switch as
 * read now (`sequencesOn`); the suite hands in false, since tiers 0-1 write no setting. `then` is called once the sequence
 * has ended on its own or been skipped (or at once with the switch off), never when another one cut it (E94 C3).
 */
export function playSequence(kind, key, draw, { sound = null, on = sequencesOn(), then = null, onEnd = null } = {}) {
    const times = SEQUENCE_TIMES[kind];
    if (!ready || !times || key == null) return null;
    const id = `${kind}\u0000${key}`;
    if (started.has(id)) return null;
    started.add(id);
    notePlayed(id);
    endSequence("cut");
    count("sequence.started");
    // and by kind, so a reading can tell the trial's entry from the cut-in (E61 C6: scenario 63 counts each per browser)
    count(`sequence.${kind}`);
    if (!on) {
        count("sequence.off");
        sound?.();
        if (then) queueMicrotask(() => { try { then("off"); } catch { /* never let what follows break this */ } });
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
    const run = { kind, key, host, mode: still ? "still" : "motion", timers: [], anims: [], undo: [], then, onEnd };
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

/**
 * Whether the table plays this crossing of the trial's edge (the owner's rule of 12.11.2026: "edytuj kampanie nie ma
 * odpalac animacji"): not when the clock says the last crossing was written by Edit campaign or another road that plays
 * nothing (clock.mjs `trialCutOf`, `clock.trialCut` false). A clock without the mark - one from before it, the suite's
 * own - plays as before.
 */
export function edgeShown(clock) {
    return clock?.trialCut !== false;
}

/** The event's key: the clock's stamp of the trial's edge (clock.mjs stamps `timeOfDayStartedAt` on every road in). */
export function trialEntryKey(clock = getClock()) {
    return clock?.phase === "classTrial" ? `classTrial:${clock.timeOfDayStartedAt ?? clock.writtenAt ?? "?"}` : null;
}

/* The title's words by the edge: into the trial "CLASS TRIAL" and the courtroom, out of it "TRIAL ADJOURNED" and back
   to school (the owner's decision of 12.11.2026), each with the chapter's line when the clock has a chapter. */
const TITLE_KEYS = Object.freeze({
    trialEntry: ["DRPG.Sequence.trialTitle", "DRPG.Sequence.trialSubtitle", "DRPG.Sequence.trialSubtitleNoChapter"],
    trialExit: ["DRPG.Sequence.exitTitle", "DRPG.Sequence.exitSubtitle", "DRPG.Sequence.exitSubtitleNoChapter"]
});
function titleBand(chapter, kind = "trialEntry") {
    const [title, line, bare] = TITLE_KEYS[kind] ?? TITLE_KEYS.trialEntry;
    const band = document.createElement("div"), words = game.i18n.localize(title);
    // a title longer than CLASS TRIAL's eleven letters stands smaller (TRIAL ADJOURNED ran out of its band under Legacy's wide face)
    band.className = `drpg-seq-title${String(words).length > 12 ? " is-long" : ""}`;
    const sub = chapter != null ? game.i18n.format(line, { chapter }) : game.i18n.localize(bare);
    band.innerHTML = `<div class="drpg-seq-title-band">${esc(words)}</div><div class="drpg-seq-title-sub">${esc(sub)}</div>`;
    return band;
}

/** The panes on screen as elements: each pane's box and its canvases, the old look over the new one. */
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

/* the hour's colour leaves a pane in its batch, outer panes first (MK-R2 #2) */
const FADE_MS = 320, FADE_STEP = 90;

/* the lead round a growing pane: the curtain's own three strokes (glass.mjs `paintGlass`: the lead 1.2 px, the bevel
   0.5 px a pixel lower, the neon core 0.7 px in the hour's colour), so a pane coming in is edged as the panes beside it */
function leadRound(g, poly, acc) {
    const trace = () => { g.beginPath(); poly.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); };
    g.lineCap = "round"; g.lineJoin = "round";
    g.globalAlpha = 0.95; g.strokeStyle = "#08050d"; g.lineWidth = 1.2; trace(); g.stroke();
    g.save(); g.translate(0, 1); g.globalAlpha = 0.22; g.strokeStyle = "#ffffff"; g.lineWidth = 0.5; trace(); g.stroke(); g.restore();
    g.globalAlpha = 0.92; g.strokeStyle = acc; g.lineWidth = 0.7; trace(); g.stroke();
    g.globalAlpha = 1;
}

/**
 * The new panes as one canvas over the screen: `draw(offsets)` paints each pane moved by its offset this frame
 * (glass-close.mjs `slideAt`: along its edge's normal, at its own size), clipped to its own place - so what is still
 * behind the edge it slides from is not seen - with the lead round it. Answers how many panes it drew.
 */
function slideCanvas(fill, W, H, acc) {
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    canvas.className = "drpg-seq-grow";
    canvas.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;`;
    const g = canvas.getContext("2d");
    let shown = 0;
    const draw = offsets => {
        if (!g) return 0;
        g.clearRect(0, 0, W, H);
        shown = 0;
        offsets.forEach((o, i) => {
            if (!o) return;
            const p = fill[i], moved = p.poly.map(([x, y]) => [x + o[0], y + o[1]]);
            g.save();
            g.beginPath(); p.poly.forEach((q, k) => (k ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.clip();
            g.drawImage(p.canvas, p.box.x0 + o[0], p.box.y0 + o[1]);
            leadRound(g, moved, acc);
            g.restore();
            shown++;
        });
        return shown;
    };
    return { canvas, draw, get shown() { return shown; } };
}

/** The closed curtain's look as an element over the screen. */
function closedCanvas(look) {
    const c = document.createElement("canvas");
    c.width = look.width; c.height = look.height;
    c.className = "drpg-seq-closed";
    c.style.cssText = `position:absolute;left:0;top:0;width:100%;height:100%;`;
    c.getContext("2d")?.drawImage(look, 0, 0);
    return c;
}

/* What goes under the closed curtain with its glass and comes back as it opens (A8; the entry's hand-over): the room and
   voice tiles and the interface's blocks - the clock, Despair, the event panel, the status, the tray, the corner's
   launchers (glass.mjs `LAUNCHERS`). danganronpa.css hides them by the body's `-cover` mark. */
export const COVERED = "#drpg-room-tile, #drpg-room-art, #drpg-voice-tile, #drpg-voice-art, #drpg-hud, #drpg-despair, #drpg-events, #drpg-player-status, #countdowns, #drpg-messenger-launcher, #drpg-sound-launcher, #drpg-book-launcher, [data-drpg-cluster]";

/* The cover, the mark and in motion the fades (the entry's hand-over, 12.11.2026): each block fades out over the
   sequence's first `handIn` ms and back in over `handIn` from the opening, by an animation of its own from the opacity it
   stood at - the mark alone took the HUD away in one frame, and gave it back in one. */
function coverBlocks(ctx) {
    const { still, times: T, anim, at } = ctx;
    const els = still ? [] : [...document.querySelectorAll(COVERED)].map(el => [el, getComputedStyle(el).opacity]);
    document.body.setAttribute(`${SEQUENCE_ATTR}-cover`, "");
    ctx.undo(() => document.body.removeAttribute(`${SEQUENCE_ATTR}-cover`));
    if (still) return;
    const out = els.map(([el, o]) => anim(el, [{ opacity: o }, { opacity: 0 }], { duration: T.handIn, easing: "linear", fill: "forwards" }));
    at(T.titleOut, () => {
        out.forEach(a => a?.cancel());
        document.body.removeAttribute(`${SEQUENCE_ATTR}-cover`);
        els.forEach(([el, o]) => anim(el, [{ opacity: 0 }, { opacity: o }], { duration: T.handIn, easing: "linear", fill: "none" }));
    });
}

/* THE CURTAIN UNDER THE WINDOWS, THE TITLE OVER THEM (E105, the owner's ask of 13.11.2026: "zamkniecie kurtyny niech
   bedzie pod otwartymi oknami, napis i jego tlo na otwartych oknach"). The trial's edges draw in two layers of their own,
   each fixed over the screen and stacked by danganronpa.css (THE SEQUENCES): the curtain's - the panes, the closed
   curtain, the lids - under Foundry's window layer and over the board and the interface, so an open window, and one
   opened while it plays, stands over the closing curtain and takes its clicks; and the title's - the band with its
   background and the chapter's line - over every window. The host is no box of its own there (`display: contents`): a
   fixed box is a stacking context, and its children could not stand on both sides of the windows. Until E105 the host
   was one layer at 99980 and its children with it, over every window. The other sequences - the verdict's cut-in, the
   day's boards - close no curtain and keep the one host. */
function seqLayer(cls) {
    const el = document.createElement("div");
    el.className = cls;
    el.setAttribute("aria-hidden", "true");
    return el;
}

/**
 * The entry's frames. Under Stained Glass with a curtain painted, the panes stand where they are and the hole they
 * leave fills with new panes of the curtain's kind, each sliding out at its own size from behind an edge it shares with
 * glass already there (glass.mjs `entryPieces`, glass-close.mjs; the owner's reviews of rounds 1 to 3, 12.11.2026); closed, the
 * curtain is the curtain's own paint of the whole cut; it opens the same way in reverse onto the trial's cut.
 * Otherwise - Monokuma Legacy, a narrow screen, a curtain not cut yet - two lids close from above and below (MK-R1:
 * "two black panels with a red edge"). Both carry the title. The trial's exit is the same frames on the cut it leaves,
 * closing in Daily Life's colour and opening onto the hour's cut, with its own title (`kind`).
 */
function drawTrialEntry(ctx, glass, clock = getClock(), kind = "trialEntry") {
    const { host, still, times: T, anim, at, ARRIVE: IN } = ctx;
    const chapter = clock?.chapter ?? null;
    host.dataset.drpgSequenceLook = glass ? "glass" : "lids";
    const title = titleBand(chapter, kind);
    // the curtain's layer under the windows, the title's over them (above); the fades in and out are the curtain's
    const curtain = seqLayer("drpg-seq-curtain"), top = seqLayer("drpg-seq-top");
    host.append(curtain, top);
    if (glass) {
        host.style.setProperty("--drpg-seq-w", `${glass.W}px`);
        const closed = closedCanvas(glass.closed);
        /* THE HAND-OVER (the owner at the table, 12.11.2026: "calosc blyska"; glass.mjs `holdCurtain`): the live curtain
           and its glow go to 0 under the copies and come back under them at the end, both ends crossing over in `hand`
           ms; however the sequence ends, the hold is let go. Still, the closed curtain stands over a curtain at 0. */
        ctx.undo(() => glass.release?.());
        if (still) {
            glass.hold?.(0);
            curtain.append(closed);
        } else {
            glass.hold?.(T.handIn);
            anim(curtain, [{ opacity: 0 }, { opacity: 1 }], { duration: T.handIn, easing: "linear" });
            at(T.end - T.hand, () => {
                anim(curtain, [{ opacity: 1 }, { opacity: 0 }], { duration: T.hand, easing: "linear", fill: "forwards" });
                glass.handBack?.(T.hand);
            });
            const close = pieceLayer(glass.close.panes, "is-close"), open = pieceLayer(glass.open.panes, "is-open");
            const growIn = slideCanvas(glass.close.fill, glass.W, glass.H, glass.acc), growOut = slideCanvas(glass.open.fill, glass.W, glass.H, glass.acc);
            close.layer.append(growIn.canvas);
            open.layer.append(growOut.canvas);
            closed.hidden = true;
            open.layer.hidden = true;
            curtain.append(close.layer, closed, open.layer);
            host.drpgEntry = { growIn, growOut, fill: [glass.close.fill, glass.open.fill] };
            glass.close.panes.forEach(p => anim(p.old, [{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, delay: p.batch * FADE_STEP, easing: "linear" }));
            const t0 = performance.now();
            let frame = 0, phase = "close";
            const step = now => {
                if (!host.isConnected) return;
                // a frame's stamp is its start, which can fall before `t0` when the pieces' cut held the thread
                const ms = Math.max(0, now - t0);
                if (phase === "close") growIn.draw(slideAt(glass.close.fill, ms));
                else if (phase === "open") {
                    if (!growOut.draw(slideAt(glass.open.fill, ms - T.titleOut, { open: true })) && ms > T.titleOut + 50) return;
                }
                if (phase !== "held") frame = requestAnimationFrame(step);
            };
            frame = requestAnimationFrame(step);
            ctx.undo(() => globalThis.cancelAnimationFrame?.(frame));
            /* closed: the curtain's own paint of the whole cut until the title goes. No wash over it: the pulse of 420 ms
               laid 10 % Bone over the whole screen above the closed curtain, and the probe read it as a flash of +19 on
               the whole frame (the seam report, 12.11.2026); the curtain's own pulse is in its paint. */
            at(T.closed, () => {
                phase = "held";
                globalThis.cancelAnimationFrame?.(frame);
                close.layer.remove();
                closed.hidden = false;
            });
            at(T.titleOut, () => {
                closed.remove();
                open.layer.hidden = false;
                growOut.draw(glass.open.fill.map(() => [0, 0]));
                phase = "open";
                frame = requestAnimationFrame(step);
            });
        }
    } else {
        const lids = ["top", "bottom"].map(side => {
            const lid = document.createElement("div");
            lid.className = `drpg-seq-lid is-${side}`;
            curtain.append(lid);
            return lid;
        });
        if (!still) {
            lids.forEach((lid, i) => anim(lid, [{ transform: `translateY(${i ? 100 : -100}%)` }, { transform: "translateY(0)" }], { duration: T.close }));
            at(T.titleOut, () => lids.forEach((lid, i) => anim(lid, [{ transform: "translateY(0)" }, { transform: `translateY(${i ? 100 : -100}%)` }], { duration: T.open, easing: ctx.LEAVE })));
        }
    }
    coverBlocks(ctx);
    if (still) { top.append(title); return; }
    at(T.title, () => {
        top.append(title);
        anim(title, [{ transform: "rotate(-3deg) scale(1.12)", opacity: 0 }, { transform: "rotate(-3deg) scale(1)", opacity: 1 }], { duration: T.titleIn, easing: IN });
    });
    at(T.titleOut, () => anim(title, [{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: "linear" }));
}

/**
 * The entry, from the phase's hook on this browser. Answers what `playSequence` answered. `glass` is the closed
 * curtain's pieces (glass.mjs `entryPieces`), asked here and not by the hook's caller: the glass is only moved when the
 * sequence is drawn, so the table's switch off and a second hearing of the event leave the curtain's own turn alone.
 */
export async function playTrialEntry(clock = getClock(), { pieces = undefined } = {}) {
    const key = trialEntryKey(clock);
    if (!key || !edgeShown(clock) || sequenceStarted("trialEntry", key) || !ready) return null;
    let glass = pieces ?? null;
    if (pieces === undefined && sequencesOn() && document.body.classList.contains("drpg-theme-stained-glass")) {
        // the attribute the HUD writes from the same clock row; written here too, so the curtain reads the trial's colour
        document.body.dataset.drpgPhase = "classTrial";
        try { glass = (await import("./glass.mjs")).entryPieces?.() ?? null; } catch { glass = null; }
    }
    // `pieces`: the suite's stand-in for the curtain's (R3917); a start that plays nothing lets the curtain's hold go
    const played = playSequence("trialEntry", key, ctx => drawTrialEntry(ctx, glass, clock), { sound: () => playSound("trialStart") });
    if (played === null || played === "off") glass?.release?.();
    return played;
}

/* ========================================================================== *
 *  OUT OF THE CLASS TRIAL (the owner's decision of 12.11.2026, every default accepted)
 * ========================================================================== */

/**
 * The exit's key: the clock's stamp of the trial's end (clock.mjs stamps `trialEndedAt` on every road out), so a chapter's
 * end whose next morning lands in the same run of the clock's row still names its exit by the trial's end and not by
 * the morning's own stamp. Null while the clock is in the trial.
 */
export function trialExitKey(clock = getClock()) {
    if (!clock || clock.phase === "classTrial") return null;
    return `trialExit:${clock.trialEndedAt ?? clock.timeOfDayStartedAt ?? clock.writtenAt ?? "?"}`;
}

/* The exit's end, for whoever waits on it (the day's boards: transitions.mjs). Set as the exit is asked for, before its
   pieces are taken, so a new day heard in between waits too; settled however the exit ends or does not start. */
let exitWait = null;

/** A promise settled once the trial's exit asked for on this browser has ended, or at once with none. */
export function whenTrialExitEnds() {
    return exitWait ?? Promise.resolve(null);
}

/**
 * The trial's exit on this browser (transitions.mjs, from the clock's move out of the Class Trial): the entry's frames on
 * the cut the trial leaves - the panes close in Daily Life's colour, TRIAL ADJOURNED and the chapter's line on the
 * closed curtain, and they open onto the hour's cut - for the entry's 3.4 s, still 1.5 s under reduced motion, Escape
 * earlier; the lids under Monokuma Legacy and on a stacked screen. No sound: End the trial's card carries `trialClose`.
 * Nothing when the crossing was Edit campaign's (`edgeShown`), heard again, or before ready. `pieces`, the suite's
 * stand-in for the curtain's. Answers what `playSequence` answered.
 */
export function playTrialExit(clock = getClock(), { pieces = undefined, on = sequencesOn() } = {}) {
    const key = trialExitKey(clock);
    if (!key || !on || !edgeShown(clock) || sequenceStarted("trialExit", key) || !ready) return Promise.resolve(null);
    let settle = null;
    const wait = new Promise(r => { settle = r; });
    const done = why => { settle(why); if (exitWait === wait) exitWait = null; };
    exitWait = wait;
    // never longer than the exit could stand, whatever happens to it
    setTimeout(() => done("timeout"), SEQUENCE_TIMES.trialExit.end + 2000);
    return (async () => {
        let glass = pieces ?? null;
        if (pieces === undefined && document.body.classList.contains("drpg-theme-stained-glass")) {
            // the HUD writes it from the same clock row; written here too, so the curtain closes in the new phase's colour
            document.body.dataset.drpgPhase = clock.phase ?? "dailyLife";
            try { glass = (await import("./glass.mjs")).exitPieces?.() ?? null; } catch { glass = null; }
        }
        const played = playSequence("trialExit", key, ctx => drawTrialEntry(ctx, glass, clock, "trialExit"), { on, onEnd: done });
        if (played === null || played === "off") { glass?.release?.(); done(played ?? "none"); }
        return played;
    })().catch(err => { done("failed"); console.error(`${MODULE_ID} | the trial's exit failed`, err); return null; });
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
   tile reads a portrait), read at ready by `import()` so this file stays a leaf: vault-store.mjs reaches most of the
   module. Before it is read, and for Foundry's stand-in silhouette, the initial stands instead of a portrait. */
let safeImage = () => null;
function portraitOf(actor) {
    const path = safeImage(actor?.img);
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
            <div class="drpg-seq-name${String(s.name ?? "").length > 18 ? " is-long" : ""}">${esc(s.name)}</div>
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

export function drawVerdictCut(ctx, board) {
    const { host, still, times: T, anim } = ctx;
    const el = verdictBoardElement(board);
    host.append(el);
    if (still) return;
    anim(el.querySelector(".drpg-seq-vband"), [{ transform: "translateX(-110%)" }, { transform: "translateX(0)" }], { duration: T.band });
    el.querySelectorAll(".drpg-seq-person").forEach((p, i) => {
        anim(p.querySelector(".drpg-seq-portrait"), [{ transform: "translateX(70vw) rotate(3deg)" }, { transform: "translateX(0) rotate(3deg)" }], { duration: T.portraitIn, delay: T.portrait + i * 60 });
        anim(p.querySelector(".drpg-seq-name"), [{ transform: "translateX(80vw)" }, { transform: "translateX(0)" }], { duration: T.portraitIn, delay: T.portrait + 80 + i * 60 });
        anim(p.querySelector(".drpg-seq-stamp"), [{ opacity: 0, transform: "translateY(-50%) rotate(-14deg) scale(1.6)" }, { opacity: 1, transform: "translateY(-50%) rotate(-14deg) scale(1)" }], { duration: T.stampIn, delay: T.stamp });
    });
    /* the count comes in row by row, each row's bar growing after it (the owner's review of round 1, 12.11.2026: the
       rows had come in as one block in 180 ms, which read as appearing rather than arriving) */
    anim(el.querySelector(".drpg-seq-votes h4"), [{ opacity: 0, transform: "translateX(-60px)" }, { opacity: 1, transform: "translateX(0)" }], { duration: T.rowIn, delay: T.votes });
    el.querySelectorAll(".drpg-seq-vrow").forEach((row, k) => {
        anim(row, [{ opacity: 0, transform: "translateX(-80px)" }, { opacity: 1, transform: "translateX(0)" }], { duration: T.rowIn, delay: T.votes + (k + 1) * T.rowStep });
        const bar = row.querySelector(".drpg-seq-vbar i");
        if (bar) anim(bar, [{ transform: "scaleX(0)" }, { transform: bar.style.transform }], { duration: T.barsIn, delay: T.bars + k * T.rowStep });
    });
    anim(el.querySelector(".drpg-seq-sentence"), [{ opacity: 0, transform: "rotate(-4deg) translateY(24px)" }, { opacity: 1, transform: "rotate(-4deg) translateY(0)" }], { duration: T.sentenceIn, delay: board.variant === "nobody" ? T.stamp : T.sentence });
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
 *  E94: THE START-OF-DAY BOARD
 * ========================================================================== */

/**
 * What the start-of-day board shows (E94 C2; MK-R2 #4, #8, #9, #10): the day, the chapter, the time of day, and the
 * cast as the table knows it - the dead by the table's own fact (`isDeceased`, the published flag; never a death the
 * GMs keep, E05), greyed in their place with their name and "we remember", never crossed out - and the GM's morning
 * line when there is one (an empty line is not shown; the GM writes it in Edit campaign, and it reaches the clock at
 * the day's start, E94 C1). Pure but for the names
 * and pictures; `students` is the cast in its order.
 */
export function dayStartBoard(clock, students = [], announcement = "") {
    const cast = students.map(a => ({ id: a.id, name: a.name, img: portraitOf(a), dead: isDeceased(a) }));
    return {
        day: Number(clock?.day) || 0, chapter: clock?.chapter ?? null, time: TIME_OF_DAY_LABELS[clock?.timeOfDay] ?? clock?.timeOfDay ?? "",
        cast, alive: cast.filter(c => !c.dead).length, total: cast.length, announcement: String(announcement ?? "").trim()
    };
}

/** The start-of-day board as an element, still: what its frames move, and its whole still frame. */
export function dayStartElement(board) {
    const el = document.createElement("div");
    el.className = "drpg-seq-day";
    const sub = game.i18n.format(board.chapter != null ? "DRPG.Sequence.daySub" : "DRPG.Sequence.daySubNoChapter",
        { chapter: board.chapter ?? "", time: board.time, alive: board.alive, total: board.total });
    el.innerHTML = `<h2 class="drpg-seq-day-title">${esc(game.i18n.format("DRPG.Sequence.dayTitle", { day: board.day }))}</h2>
        <div class="drpg-seq-day-sub">${esc(sub)}</div>
        <div class="drpg-seq-cast">${board.cast.map(c => `<div class="drpg-seq-who${c.dead ? " is-dead" : ""}">
            <div class="drpg-seq-face">${c.img ? `<img src="${esc(c.img)}" alt="">` : `<span>${esc((c.name ?? "?").slice(0, 1))}</span>`}</div>
            ${c.dead ? `<i>${esc(game.i18n.localize("DRPG.Sequence.weRemember"))}</i>` : ""}<b>${esc(c.name)}</b></div>`).join("")}</div>
        ${board.announcement ? `<div class="drpg-seq-announce"><small>${esc(game.i18n.localize("DRPG.Sequence.morningLine"))}</small>${esc(board.announcement)}</div>` : ""}`;
    return el;
}

function drawDayStart(ctx, board) {
    const { host, times: T, anim } = ctx;
    const el = dayStartElement(board);
    host.append(el);
    // the board stands centred by its own transform, so the rise carries it (an animation's transform replaces the rule's)
    anim(el, [{ opacity: 0, transform: "translate(-50%, -50%) translateY(40px)" }, { opacity: 1, transform: "translate(-50%, -50%)" }], { duration: T.rise, delay: T.board });
    el.querySelectorAll(".drpg-seq-who").forEach((w, i) => anim(w, [{ opacity: 0, transform: "translateY(16px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 400, delay: T.cast + i * T.castStep }));
    anim(el.querySelector(".drpg-seq-announce"), [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: T.announce });
    anim(el, [{ opacity: 1 }, { opacity: 0 }], { duration: T.fade, delay: T.hold, easing: ctx.LEAVE, fill: "forwards" });
}

/**
 * The start-of-day board on this browser, from the clock's one event of a new day (transitions.mjs, E62's `newDay`):
 * on every connected browser, about 5 s, gone by itself, Esc earlier (MK-R2 #8). `students` defaults to the cast as
 * monokuma.mjs `studentActors` reads it. Answers what `playSequence` answered.
 */
/** The start-of-day board's event key: the season, the day and the session. */
export function dayStartKey(clock) {
    return `day:${clock?.season ?? ""}:${Number(clock?.day) || 0}:${clock?.session ?? ""}`;
}

export async function playDayStart(clock = getClock(), { students = null, on = sequencesOn() } = {}) {
    if (!clock || !ready) return null;
    const cast = students ?? (await import("./monokuma.mjs")).studentActors();
    const board = dayStartBoard(clock, cast, clock.morningLine ?? "");
    return playSequence("dayStart", dayStartKey(clock), ctx => drawDayStart(ctx, board),
        { sound: () => playSound("dayStart"), on });
}

/* ========================================================================== *
 *  E94 C1, C3, C4: THE MORNING LINE, THE END-OF-DAY BOARD, THE SCHOOL'S MOOD
 * ========================================================================== */

/** The GM's morning line as the clock takes it: at most 200 characters, trimmed; null when there is none. */
export function morningLineOf(text) {
    const line = String(text ?? "").replace(/\s+/g, " ").trim().slice(0, MORNING_LINE_MAX);
    return line || null;
}
export const MORNING_LINE_MAX = 200;

/**
 * What a move of the clock folds into its one write for the morning line and the mood (E94 C1, C4; clock.mjs
 * `advanceTimeOfDay`): at the day's roll-over the GM's line (`draft`, kept on that GM's browser until then, so it is in
 * no world data before the day starts) and the mood's word; at any other move only the morning line is cleared (when
 * one stands), so it does not outlive the morning it was written for, and the mood is left as it is until the next
 * roll-over writes it again. And at the roll-over the new `day`, when handed in, as the boards' stamp (`dayBoard`,
 * 12.11.2026; the owner's rule of that day): the day's boards play on a new day whose clock carries it (transitions.mjs
 * `boardsFor`), so the real roll-over - Next time of day, the Morning Eclipse's end - plays them and Edit campaign's
 * day + 1, which writes no stamp, does not. Pure.
 */
export function dayStartPatch({ rolledOver = false, draft = "", mood = null, before = {}, day = null } = {}) {
    if (rolledOver) {
        const patch = { morningLine: morningLineOf(draft), mood: MOOD_BANDS.includes(mood) ? mood : null };
        if (day != null && Number.isFinite(Number(day))) patch.dayBoard = Number(day);
        return patch;
    }
    const patch = {};
    if (before?.morningLine != null) patch.morningLine = null;
    return patch;
}

/* THE SCHOOL'S MOOD (E94 C4; the owner's word of 12.11.2026: "liczony z proporcji cale hope uczniow vs hope monocubow +
   despair monokumow + despair overflow. Matma tajna, jedynie widoczny nastroj"). Three words from one share: the living
   students' Hope over the whole - that Hope, the Monocubs' Hope, the Monokumas' Despair and the Overflow count - against
   config.mjs `MOOD_SHARES`. Nothing dark at all is calm. Worked out on a GM's browser (a player's `overflowCount` is 0,
   E05 C12) and published as the word alone: no input, share or bar leaves the GM. Pure; a missing, negative or not
   finite input counts 0. */
export const MOOD_BANDS = Object.freeze(["calm", "uneasy", "spilling"]);
export function moodBand({ hope = 0, monocubHope = 0, despair = 0, overflow = 0 } = {}, shares = MOOD_SHARES) {
    const n = v => { const x = Number(v); return Number.isFinite(x) && x > 0 ? x : 0; };
    const light = n(hope), dark = n(monocubHope) + n(despair) + n(overflow);
    if (dark <= 0) return "calm";
    const share = light / (light + dark);
    return share >= shares.calm ? "calm" : share >= shares.uneasy ? "uneasy" : "spilling";
}

/**
 * The mood's four inputs as this GM's browser holds them (E94 C4): the Hope of every student of the class who is neither
 * dead by the published flag nor a Monocub - a death nobody has found leaves its Hope in, so the mood the table sees does
 * not move on it -, the Monocubs' Hope, the Despair of every Monokuma (`getDespair`, the pools the HUD shows) and the
 * Overflow count, which only a GM holds. On a player, null. Never written anywhere: `moodBand` turns it into the word.
 */
export async function moodInputs() {
    if (!game.user?.isGM) return null;
    const [{ actingStudents }, { isMonocub }, D, O] = await Promise.all([
        import("./monokuma.mjs"), import("./monocub.mjs"), import("./despair.mjs"), import("./overflow.mjs")]);
    const hopeOf = a => { const v = Number(a?.system?.resources?.hope?.value); return Number.isFinite(v) && v > 0 ? v : 0; };
    let hope = 0, monocubHope = 0;
    // the one cast (R1192), by the published death: the living students, and the dead back only as a Monocub
    for (const a of actingStudents({ dead: isDeceased })) {
        if (isMonocub(a)) monocubHope += hopeOf(a);
        else hope += hopeOf(a);
    }
    const despair = D.monokumas().reduce((t, u) => t + (Number(D.getDespair(u.id)) || 0), 0);
    const overflow = Number(O.overflowCount()) || 0;
    return { hope, monocubHope, despair, overflow };
}

/**
 * What the end-of-day board shows this browser (E94 C3; the plan's C3, MK-R2 #5): the day and the chapter; this browser's
 * own rows of the day (its private-card store, secret.mjs `secretSummaries` - a player's own actor's, a GM's the table's),
 * counted and the last few named; the day's public cards (no whisper, no blind roll: the chat's own audience test); the
 * school's mood as the GM published it. No number of Hope or Despair (the owner's word of 12.11.2026: "Chowamy hope i
 * despair w podsumowaniu"), no other player's row, no secret event, no Overflow count. Pure but for the reads it is
 * handed.
 *
 * A SPECTATOR'S BOARD (E92 with E94; the owner's word of 12.11.2026: "Dostaje tylko koniec dnia i nastroj szkoly"):
 * `watcher` true, the board is the day that ends and the mood's word alone - no chapter, no rows, no tally or quiet day,
 * no public card, whatever it is handed (R3868).
 */
export function dayEndBoard({ clock = {}, rows = [], publicCards = [], mood = null, watcher = false } = {}) {
    const day = Number(clock?.day) || 0;
    if (watcher) return { day, chapter: null, rows: [], count: 0, found: 0, events: [], mood: MOOD_BANDS.includes(mood) ? mood : null, watcher: true };
    return {
        day, chapter: clock?.chapter ?? null,
        rows: rows.slice(-6).map(r => ({ action: String(r.action ?? ""), room: r.room ? String(r.room) : "", found: Boolean(r.item) })),
        count: rows.length, found: rows.filter(r => r.item).length,
        events: publicCards.slice(-4).map(c => String(c ?? "")).filter(Boolean),
        mood: MOOD_BANDS.includes(mood) ? mood : null
    };
}

/** The end-of-day board as an element, still: its whole last frame, and what its notice card keeps. */
export function dayEndElement(board) {
    const L = key => game.i18n.localize(key);
    const el = document.createElement("div");
    el.className = "drpg-seq-day drpg-seq-dayend";
    const sub = board.chapter != null ? game.i18n.format("DRPG.Sequence.dayEndSub", { chapter: board.chapter }) : "";
    const mood = board.mood ? `<div class="drpg-seq-mood" data-drpg-mood="${board.mood}"><small>${esc(L("DRPG.Sequence.moodLabel"))}</small>${esc(L(`DRPG.Sequence.mood.${board.mood}`))}</div>` : "";
    if (board.watcher) {
        el.innerHTML = `<h2 class="drpg-seq-day-title">${esc(game.i18n.format("DRPG.Sequence.dayEndTitle", { day: board.day }))}</h2>${mood}`;
        return el;
    }
    el.innerHTML = `<h2 class="drpg-seq-day-title">${esc(game.i18n.format("DRPG.Sequence.dayEndTitle", { day: board.day }))}</h2>
        ${sub ? `<div class="drpg-seq-day-sub">${esc(sub)}</div>` : ""}
        <div class="drpg-seq-dayend-cols">
            <section class="drpg-seq-yours"><h3>${esc(L(game.user?.isGM ? "DRPG.Sequence.tableDay" : "DRPG.Sequence.yourDay"))}</h3>
                ${board.count ? `<ol>${board.rows.map(r => `<li class="drpg-seq-row">${esc(r.action)}${r.room ? ` <span>${esc(r.room)}</span>` : ""}${r.found ? ` <em>${esc(L("DRPG.Sequence.foundSomething"))}</em>` : ""}</li>`).join("")}</ol>
                <p class="drpg-seq-tally">${esc(game.i18n.format("DRPG.Sequence.dayTally", { actions: board.count, found: board.found }))}</p>`
                : `<p class="drpg-seq-tally">${esc(L("DRPG.Sequence.quietDay"))}</p>`}</section>
            ${board.events.length ? `<section class="drpg-seq-events"><h3>${esc(L("DRPG.Sequence.publicEvents"))}</h3><ol>${board.events.map(e => `<li class="drpg-seq-row">${esc(e)}</li>`).join("")}</ol></section>` : ""}
        </div>
        ${mood}`;
    return el;
}

function drawDayEnd(ctx, board) {
    const { host, times: T, anim } = ctx;
    const el = dayEndElement(board);
    host.append(el);
    anim(el, [{ opacity: 0, transform: "translate(-50%, -50%) translateY(40px)" }, { opacity: 1, transform: "translate(-50%, -50%)" }], { duration: T.rise, delay: T.board });
    el.querySelectorAll(".drpg-seq-row").forEach((r, i) => anim(r, [{ opacity: 0, transform: "translateX(-24px)" }, { opacity: 1, transform: "translateX(0)" }], { duration: 360, delay: T.rows + i * T.rowStep }));
    anim(el.querySelector(".drpg-seq-mood"), [{ opacity: 0, transform: "scale(1.08)" }, { opacity: 1, transform: "scale(1)" }], { duration: 420, delay: T.mood });
    anim(el, [{ opacity: 1 }, { opacity: 0 }], { duration: T.fade, delay: T.hold, easing: ctx.LEAVE, fill: "forwards" });
}

/** The rows of the day a browser may show (E94 C3): a GM's, all of them; a player's, those of a student it owns or of no student. Pure but for `owns`. */
export function dayRowsFor(entries, { gm = false, owns = id => Boolean(game.actors.get(id)?.isOwner) } = {}) {
    return gm ? entries.slice() : entries.filter(e => !e.actorId || owns(e.actorId));
}

/** The day's public cards (E94 C3): the module's own messages over [since, until) that nobody is whispered and no roll is blind - what every browser at the table was shown. Their words, cut to 80 characters. Pure. */
export function publicCardsOf(messages, since, until = null) {
    const words = m => {
        const flavor = String(m.flavor || "").trim();
        if (flavor) return flavor;
        const d = document.createElement("div");
        d.innerHTML = String(m.content ?? "");
        return (d.querySelector("h1, h2, h3, h4, strong, b")?.textContent ?? d.textContent ?? "").trim();
    };
    return (messages ?? []).filter(m => {
        const at = Number(m.timestamp);
        return Number.isFinite(at) && at >= since && (until === null || !Number.isFinite(until) || at < until)
            && m.flags?.[MODULE_ID] && !(m.whisper?.length) && !m.blind;
    }).map(m => words(m).replace(/\s+/g, " ").slice(0, 80)).filter(Boolean);
}

/* What this browser knows of the day that ended: its own rows from its private-card store over [the day's start, the
   new day's start) and the public cards of the chat over the same span. */
async function dayEndReads(before, clock) {
    const since = Number(before?.dayStartedAt), until = Number(clock?.timeOfDayStartedAt);
    const known = Number.isFinite(since) && since > 0;
    let rows = [];
    if (known) {
        const { entriesSince } = await import("./day-summary.mjs");
        rows = dayRowsFor(entriesSince(since, Number.isFinite(until) ? until : null), { gm: game.user.isGM });
    }
    const publicCards = known ? publicCardsOf(game.messages?.contents ?? [], since, Number.isFinite(until) ? until : null) : [];
    return { rows, publicCards };
}

/**
 * The end-of-day board this browser shows for the day that ended (`before`) at the new clock (`clock`): a Spectator's
 * (scripts/spectator.mjs `spectatorViewer`) the heading and the mood alone, with the day's reads never made; anybody
 * else's from its own reads (`reads`, the suite's to hand, or `dayEndReads`). The mood is the new clock's word.
 */
export async function dayEndBoardFor(before, clock, { watcher = spectatorViewer(), reads = null } = {}) {
    if (watcher) return dayEndBoard({ clock: before, mood: clock?.mood ?? null, watcher: true });
    const got = reads ?? await dayEndReads(before, clock);
    return dayEndBoard({ clock: before, rows: got.rows, publicCards: got.publicCards, mood: clock?.mood ?? null });
}

/**
 * The end-of-day board on this browser, at the day's roll-over (transitions.mjs, E62's `newDay`), before the start-of-day
 * board, which it hands on to (`then`). About 6 s, Esc earlier; still under reduced motion; with the switch off, nothing
 * plays and `then` runs at once. What it showed goes to this browser's notice history as one card, which stays until
 * closed (the plan's C3), and stands in for the Night's own summary (Q-E94-5's default; day-summary.mjs). `before` is the
 * clock of the day that ended, `clock` the new one; a Spectator's browser shows the heading and the mood alone
 * (`dayEndBoardFor`). `keep` false puts up no card (the suite's: tiers 0-1 write nothing, and
 * the notice history is a setting). Answers what `playSequence` answered.
 */
export async function playDayEnd(before, clock = getClock(), { on = sequencesOn(), then = null, reads = null, keep = true } = {}) {
    if (!before || !clock || !ready) { then?.("none"); return null; }
    const board = await dayEndBoardFor(before, clock, { reads });
    const played = playSequence("dayEnd", `dayEnd:${before.season ?? ""}:${board.day}:${before.session ?? ""}`, ctx => drawDayEnd(ctx, board),
        { sound: () => playSound("dayEnd"), on, then });
    if (played === null) then?.("none");
    if (played && on && keep) {
        // the card is day-summary.mjs's, beside the summary it stands in for: this file puts up no notice (A7, the header)
        import("./day-summary.mjs").then(m => m.keepDayEndCard(dayEndElement(board).outerHTML, game.i18n.format("DRPG.Sequence.dayEndTitle", { day: board.day }))).catch(() => null);
    }
    return played;
}

/* ========================================================================== *
 *  SOUND, ESCAPE, REGISTRATION
 * ========================================================================== */

function playSound(key) {
    import("./sfx-play.mjs").then(m => m.playSfx(key)).catch(() => null);
}

/* A transition the curtain plays (transitions.mjs, E62 C8) that Escape may end: `{ until, skip }`, for its length. */
let held = null;

/** Let Escape end something for the next `ms` (E62 C8): `skip` is called once, on the first Escape, and the key is taken. */
export function holdEscape(ms, skip) {
    held = typeof skip === "function" ? { until: performance.now() + Math.max(0, ms), skip } : null;
}

function onEscape(event) {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    const transition = !running && held && performance.now() < held.until ? held : null;
    if (!running && !transition) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (running) { endSequence("skipped"); return; }
    held = null;
    count("sequence.transitionSkipped");
    try { transition.skip(); } catch { /* the transition's own clean-up */ }
}

/** The phase moved on this browser (sync.mjs's clock row): a running sequence ends - the entry itself excepted, when
    the trial is what it was heard for, and the exit when the trial is what it left - and the trial's phase starts the
    entry, unless Edit campaign moved it (`edgeShown`, in `playTrialEntry`). Answers the entry's promise or null. */
export function onPhaseChanged(phase, clock = getClock()) {
    // the trial's exit is the phase's own event too (transitions.mjs starts it from the same clock row)
    if (running && !(running.kind === "trialEntry" && phase === "classTrial") && !(running.kind === "trialExit" && phase !== "classTrial")) endSequence("cut");
    if (phase !== "classTrial") return null;
    return playTrialEntry(clock).catch(err => { console.error(`${MODULE_ID} | the trial's entry failed`, err); return null; });
}

/**
 * THE EVENT A LATE BROWSER STILL PLAYS (gaps-111; the header's "LATE FOR 10 MINUTES"). From what this browser holds -
 * the clock and the chat it was sent - the newest of: the trial's entry (the clock in a Class Trial, its edge stamped
 * `timeOfDayStartedAt`), a GM's verdict card (its `verdictAt`, at the message's time; one this user cannot see is not
 * theirs, as it never reached them live) and the start-of-day board (a day the real roll-over stamped, `dayBoard`, at
 * `dayStartedAt`; a correction writes no stamp and plays nothing, as live). An event counts while `now` is under
 * `LATE_PLAY_MS` after it - one stamped a little ahead of this browser's server time is the writer's skew, and new - and
 * when `played` (this browser's record) does not hold it. Every connected browser plays these three live, the GMs, the
 * dead and a Spectator included (Q-E61-9; a Spectator's start-of-day board is everybody's), so the gate is the one the
 * live hooks have: what reached this browser. Pure. Answers `{ kind, key, at, message? }` or null. R4934.
 */
export function lateSequence({ clock = null, messages = [], now = 0, played = {} } = {}) {
    const found = [];
    const trialKey = trialEntryKey(clock);
    if (trialKey) found.push({ kind: "trialEntry", key: trialKey, at: Number(clock?.timeOfDayStartedAt) });
    if (clock && clock.dayBoard != null && Number(clock.dayBoard) === Number(clock.day)) {
        found.push({ kind: "dayStart", key: dayStartKey(clock), at: Number(clock.dayStartedAt ?? clock.timeOfDayStartedAt) });
    }
    for (const message of messages ?? []) {
        if (!message?.author?.isGM || message.visible === false) continue;
        const at = message.getFlag?.(MODULE_ID, "verdictAt");
        if (at == null) continue;
        found.push({ kind: "verdictCut", key: `verdict:${at}`, at: Number(message.timestamp), message });
    }
    const fresh = found.filter(e => Number.isFinite(e.at) && now - e.at < LATE_PLAY_MS && !(`${e.kind}\u0000${e.key}` in (played ?? {})));
    return fresh.sort((a, b) => b.at - a.at)[0] ?? null;
}

/**
 * Once at ready, after `registerSequences` (the header's "LATE FOR 10 MINUTES"): play the event `lateSequence` picks,
 * through the same road its live hook takes, so the table's switch, reduced motion and the sound are as live: the
 * trial's entry and the cut-in go through `playSequence` (off: the sound alone; still: the still frame), and the
 * start-of-day board, which the table's switch off never plays live, is not played late either. Writes nothing to the
 * world. Answers what the road answered, or null.
 */
export async function catchUpSequences({ now = serverNow(), on = sequencesOn() } = {}) {
    if (!ready) return null;
    const late = lateSequence({ clock: getClock(), messages: game.messages?.contents ?? [], now, played: playedRecord() });
    if (!late) return null;
    count("sequence.late");
    if (late.kind === "trialEntry") return playTrialEntry(getClock());
    if (late.kind === "verdictCut") return playVerdictCut(late.message);
    if (late.kind === "dayStart" && on) return playDayStart(getClock(), { on });
    return null;
}

/**
 * Once at ready, before foundry-windows.mjs's own Escape listener (module.mjs): from now on an event starts a
 * sequence. The phase's hook starts the entry and ends anything else that plays; a GM's verdict card starts the cut-in;
 * and an event of the last 10 minutes this browser missed plays once (`catchUpSequences`).
 */
export function registerSequences() {
    if (ready) return;
    ready = true;
    setTimeout(() => { catchUpSequences().catch(err => console.error(`${MODULE_ID} | a late sequence failed`, err)); }, 0);
    import("./vault-store.mjs").then(m => { safeImage = m.safeRoomImage; }).catch(() => null);
    window.addEventListener("keydown", onEscape, { capture: true });
    Hooks.on("drpgPhaseChanged", onPhaseChanged);
    Hooks.on("createChatMessage", message => {
        try { playVerdictCut(message); } catch (err) { console.error(`${MODULE_ID} | the verdict's cut-in failed`, err); }
    });
}
