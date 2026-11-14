/**
 * Danganronpa RPG - the death fade and the Monocub's return on the curtain (E62 C3, 13.11.2026; the storyboard SB-C3 and
 * the owner's answers to it and to the live mockup MK-C3, docs/dev/e62/STORYBOARD-C3.md on the e62-c3 line, e64968c6).
 * ---------------------------------------------------------------------------
 * The listener of spectator-dead.mjs's `drpgDeadSpectator`, which only the dead student's own browser calls: a death in
 * play turns the curtain's glass bare, batch by batch from the outside in, in 3.6 s; becoming a Monocub lights it again
 * from the player's tools outward in 2.4 s; a GM's correction (`silent`), reduced motion, the table's sequences switch
 * off and Escape go to the end state at once. "Bare glass" is the rest state while the student is dead and no Monocub,
 * and a page that loads then shows it at once, with no animation. DOM only: nothing is written, nothing sent.
 *
 * STAINED GLASS. The storyboard's batches were named by pane index at 1366x768 (20 panes). The panes carry the block
 * they hold (glass.mjs `LAST.panes[].tone`), so the same batches are read at any size by that, not by the index:
 *   1. the top slivers (no block, centre above half the height); 2. the bottom slivers; 3. the Despair rail, the status
 *   ("three"), the event strip and the tray; 4. the clock ("hud"), the notes and the room tile; 5. the voice tile, the
 *   tiles' row and the launchers.
 * Each batch is a layer after the curtain (`.drpg-bare-layer`), clipped to its panes, its backdrop greyed and darkened
 * (`batchLayers` says why the backdrop and not the glass's canvas); it is shown at its onset, its colour back for 90 ms at +180 and out for good
 * at +270 (the frame table's pattern). The pulse goes down with each batch and off at 3000 ms; the edges flicker twice
 * (3000, 3300); at 3600 the rest state is the body's class `drpg-bare-glass` (stained-glass.css), which greys the frost
 * under the glass and the glass whatever the curtain redraws, and the batch layers go.
 * MONOKUMA LEGACY has no curtain: its four groups (the Despair bar, the status and projects, the clock with the room
 * tile, the voice tile with the launchers) grey one by one with a CSS class, at the same onsets, each flickering once.
 *
 * At most three flickers in any second (transitions.mjs `flashRate`, R4559). The sound is spectator-dead.mjs's (the
 * "Death fade" row), played at the fade's start whatever this file draws.
 */

import { MODULE_ID, FLAGS } from "./config.mjs";
import { SETTINGS, getSetting, isDeadForGm } from "./settings.mjs";
import { reducedMotion } from "./motion.mjs";
import { count } from "./perf-counters.mjs";

/** The body class of the rest state (stained-glass.css, monokuma-legacy.css). */
export const BARE_CLASS = "drpg-bare-glass";
/** The Legacy groups' classes, in the fade's order (`drpg-bare-g1` .. `drpg-bare-g4`). */
export const LEGACY_GROUPS = Object.freeze(["drpg-bare-g1", "drpg-bare-g2", "drpg-bare-g3", "drpg-bare-g4"]);

const FADE_ONSETS = Object.freeze([0, 600, 1200, 1800, 2400]);
const FADE_MS = 3600;
const RETURN_MS = 2400;   // the storyboard's length; the rest lands after M5's last step (2470)
const FLICKER_AT = 180, FLICKER_END = 270;

/* ------------------------------------------------------------------------------------------------------------------
 * THE PLAN (pure)
 * ------------------------------------------------------------------------------------------------------------------ */

/**
 * The batch (1-5) a pane of the curtain goes out in, by the block it holds and where it stands (see the header).
 * `pane` is a `LAST.panes` row; `H` the screen's height. Pure.
 */
export function batchOf(pane, H) {
    const tone = pane?.tone ?? null;
    if (["rail", "three", "event", "tray"].includes(tone)) return 3;
    if (["hud", "note-block", "room-block"].includes(tone)) return 4;
    if (["voice-block", "tiles-row", "launch"].includes(tone)) return 5;
    const y = ((Number(pane?.y0) || 0) + (Number(pane?.y1) || 0)) / 2;
    return y < (Number(H) || 0) / 2 ? 1 : 2;
}

/**
 * The steps of a fade or a return: `[{ at, batch, on }]` for a batch's grey (on: bare), `{ at, pulse }` for the pulse's
 * opacity, `{ at, seams }` ("dim" or "lit"), and `{ at, rest }` last ("bare" or "lit"). `kind` is "fade" or "return";
 * `batches` is how many (5 for Stained Glass, 4 for Legacy). Pure.
 */
export function fadePlan(kind = "fade", batches = 5) {
    const steps = [];
    const flick = (at, batch, on) => steps.push({ at, batch, on }, { at: at + FLICKER_AT, batch, on: !on }, { at: at + FLICKER_END, batch, on });
    if (kind === "fade") {
        for (let b = 1; b <= batches; b++) {
            const at = FADE_ONSETS[b - 1];
            // batch 1 goes out in one step (D2: "out 0-180"); every later one flickers once
            if (b === 1) steps.push({ at, batch: b, on: true });
            else flick(at, b, true);
            steps.push({ at, pulse: Math.max(0, 1 - b / batches) });
        }
        steps.push({ at: 3000, pulse: 0 }, { at: 3000, seams: "dim" }, { at: 3090, seams: "lit" }, { at: 3300, seams: "dim" },
            { at: 3390, seams: "lit" }, { at: FADE_MS, rest: "bare" });
    } else {
        // M2: the edges on 0-90, off 90-200, on from 200; M3: the pulse back at 500; the batches from the player's tools out
        steps.push({ at: 0, seams: "lit" }, { at: 90, seams: "dim" }, { at: 200, seams: "lit" }, { at: 500, pulse: 1 });
        const onsets = [600, 1000, 1400, 1800, 2200];
        for (let k = 0; k < batches; k++) {
            const b = batches - k;
            flick(onsets[k + (5 - batches)] ?? onsets[k], b, false);
        }
        // the rest after the last batch settles: M5 runs 2200-2470 ("rest at about 2.4 s"); at 2400 it cut batch 1's last step
        steps.push({ at: Math.max(RETURN_MS, ...steps.map(st => st.at)), rest: "lit" });
    }
    return steps.sort((a, b) => a.at - b.at);
}

/** The flickers of a plan, as onsets (ms): a batch's colour back, and the edges' dims. For the flash rule. Pure. */
export function flickerOnsets(steps) {
    const out = [];
    const seen = new Map();
    for (const s of steps) {
        if (s.batch !== undefined) {
            const n = (seen.get(s.batch) ?? 0) + 1;
            seen.set(s.batch, n);
            if (n === 2) out.push(s.at);
        } else if (s.seams === "dim") out.push(s.at);
    }
    return out;
}

/* ------------------------------------------------------------------------------------------------------------------
 * WHO IS DEAD HERE
 * ------------------------------------------------------------------------------------------------------------------ */

/**
 * Whether this browser's curtain rests bare: a player (no GM) who owns at least one student, every one of them dead as
 * this browser may know it (`isDeadForGm`: the flag, or the player's own copy of a kept death) and no Monocub. A
 * Spectator's own character (E92's flag) and a Monokuma are no student here.
 */
export function restsBare(user = game.user, actors = game.actors) {
    if (!user || user.isGM) return false;
    let students = 0;
    for (const actor of actors ?? []) {
        if (actor?.type !== "character" || !actor.testUserPermission?.(user, "OWNER")) continue;
        if (actor.getFlag?.(MODULE_ID, FLAGS.monokuma) || actor.getFlag?.(MODULE_ID, FLAGS.spectator)) continue;
        students += 1;
        if (!isDeadForGm(actor) || actor.getFlag?.(MODULE_ID, FLAGS.monocub)) return false;
    }
    return students > 0;
}

/* ------------------------------------------------------------------------------------------------------------------
 * THE DRAWING
 * ------------------------------------------------------------------------------------------------------------------ */

function stainedGlass() {
    try {
        return getSetting(SETTINGS.theme) === "stainedGlass";
    } catch {
        return false;
    }
}

function sequencesOn() {
    try {
        return getSetting(SETTINGS.sequences) !== false;
    } catch {
        return true;
    }
}

let running = null;
/* glass.mjs, read once the page is ready (`registerDeathFade`): its panes as the curtain last cut them (`LAST.panes`). */
let glassModule = null;

/**
 * The rest state on this page: `bare` true or false. Every batch layer and group class goes.
 *
 * Only a class the body carries is removed (1.2.112's release CI, 13.11.2026): `classList.remove` of a class that is not
 * there still writes the attribute, and each write wakes the body's observers (scenario 14-quiet). A death's copy settles
 * the rest state 1.5 s after the deaths change, on every page and the GMs' too, so at a world's start that was seven
 * writes for nothing - and 14-quiet's clock check, which watches the body's class, read them as the clock's (7 records,
 * red on run 43488628121 and three times out of three in a session at 5090bf9b).
 */
export function setRest(bare) {
    const body = document.body;
    stopRunning();
    body.classList.toggle(BARE_CLASS, Boolean(bare));
    for (const cls of [...LEGACY_GROUPS, "drpg-bare-b4", "drpg-bare-b5", "drpg-bare-seams"]) {
        if (body.classList.contains(cls)) body.classList.remove(cls);
    }
    for (const c of document.querySelectorAll(".drpg-bare-layer")) c.remove();
    curtainPart("pulse")?.style.removeProperty("opacity");
    return Boolean(bare);
}

function stopRunning() {
    if (!running) return;
    for (const t of running.timers) clearTimeout(t);
    running = null;
}

function curtainPart(cls) {
    return document.querySelector(`#drpg-curtain > canvas.${cls}`);
}

/**
 * One grey layer per batch (Stained Glass), hidden until its onset: a sibling after the curtain in its box, its backdrop
 * greyed and darkened (stained-glass.css `.drpg-bare-layer`), clipped to the batch's panes. The glass is translucent -
 * what shows through it is the frost's blur of the map - so a filter on the glass's canvas alone greys nothing a player
 * sees (measured in audit/death-fade-drawn.mjs, 13.11.2026: the rest state's saturation 0.23 against 0.27 lit); the
 * backdrop of a layer above the curtain takes the frost, the glass, the pulse and the edges under it at once.
 */
function batchLayers(panes, H) {
    const host = document.getElementById("drpg-curtain");
    if (!host) return null;
    const box = host.getBoundingClientRect();
    const z = host.style.zIndex || getComputedStyle(host).zIndex || "0";
    const layers = new Map();
    let after = document.getElementById("drpg-curtain-turn") ?? host;
    for (let b = 1; b <= 5; b++) {
        const own = panes.filter(p => batchOf(p, H) === b && p.poly?.length);
        const d = own.map(p => p.poly.map((q, i) => `${i ? "L" : "M"}${Math.round(q[0] * 10) / 10} ${Math.round(q[1] * 10) / 10}`).join(" ") + " Z").join(" ");
        const el = document.createElement("div");
        el.className = `drpg-bare-layer drpg-bare-layer-${b}`;
        el.style.cssText = `position:fixed;left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px;z-index:${z};opacity:0;`
            + (d ? `clip-path:path('${d}');` : "display:none;");
        after.after(el);
        after = el;
        layers.set(b, el);
    }
    return layers;
}

/**
 * Play a fade ("fade") or a return ("return") on this page, or go to its end state at once (`still`). Answers what was
 * done: "drawn", "rest" (at once) or null (nothing to do). The plan's steps are timers; a second call cuts the first.
 */
export function playCurtain(kind, { still = false, glass = stainedGlass(), panes = null, H = innerHeight } = {}) {
    const end = kind === "fade";
    if (still) {
        setRest(end);
        count("deathFade.rest");
        return "rest";
    }
    stopRunning();
    const body = document.body;
    const steps = fadePlan(kind, glass ? 5 : 4);
    let layers = null;
    if (glass) {
        // the return starts from bare glass: every batch grey, the rest class off under them
        layers = batchLayers(panes ?? (glassModule?.LAST?.panes ?? []), H);
        if (!layers) {
            setRest(end);
            return "rest";
        }
        if (kind === "return") {
            for (const c of layers.values()) c.style.opacity = "1";
            body.classList.add("drpg-bare-b4", "drpg-bare-b5");
        }
        body.classList.remove(BARE_CLASS);
    } else if (kind === "return") {
        body.classList.remove(BARE_CLASS);
        for (const cls of LEGACY_GROUPS) body.classList.add(cls);
    }
    const timers = [];
    running = { timers, kind };
    const apply = s => {
        if (s.rest !== undefined) { setRest(s.rest === "bare"); return; }
        if (s.batch !== undefined) {
            if (glass) {
                const c = layers?.get(s.batch);
                if (c) {
                    c.style.transition = s.on && s.batch === 1 ? "opacity 180ms var(--drpg-ease-leave, ease-in)" : "none";
                    c.style.opacity = s.on ? "1" : "0";
                }
                // the room tile's and the voice tile's art go with their batches (stained-glass.css)
                if (s.batch >= 4) body.classList.toggle(`drpg-bare-b${s.batch}`, s.on);
            } else body.classList.toggle(LEGACY_GROUPS[s.batch - 1], s.on);
            return;
        }
        if (s.pulse !== undefined) {
            const p = curtainPart("pulse");
            if (p) p.style.opacity = String(s.pulse);
            return;
        }
        if (s.seams !== undefined) body.classList.toggle("drpg-bare-seams", s.seams === "dim");
    };
    for (const s of steps) timers.push(setTimeout(() => apply(s), s.at));
    count("deathFade.drawn");
    return "drawn";
}

/* ------------------------------------------------------------------------------------------------------------------
 * THE HOOK
 * ------------------------------------------------------------------------------------------------------------------ */

/**
 * A moment of spectator-dead.mjs (`{ phase, silent }`) on this browser: "fade" a death, "monocub" the return, "return" a
 * revive (its token taken away: the glass lit again, the return drawn unless silent), "spectator" a Monocub no more
 * (bare at once: the storyboard's #10). Answers `playCurtain`'s answer or null.
 */
export function onDeadMoment(moment, { on = sequencesOn(), still = reducedMotion() } = {}) {
    const phase = moment?.phase;
    const quiet = moment?.silent === true || !on || still;
    if (phase === "fade") return playCurtain("fade", { still: quiet });
    if (phase === "monocub" || phase === "return") return playCurtain("return", { still: quiet });
    if (phase === "spectator") return playCurtain("fade", { still: true });
    return null;
}

/**
 * Escape while a fade or a return runs: its end state at once, and the key is the curtain's (the e93 line's G4): left to
 * Foundry as well, the same press closed a window or opened its menu. Claimed as sequence.mjs `holdEscape`'s Escape claims
 * it; with nothing running it is left alone.
 */
function onEscape(event) {
    if (event.key !== "Escape" || event.defaultPrevented || !running) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const end = running.kind === "fade";
    setRest(end);
    count("deathFade.skipped");
}

/** At ready (module.mjs): the rest state as this page finds it, then the hook. */
export async function registerDeathFade() {
    const { DEAD_SPECTATOR_HOOK } = await import("./spectator-dead.mjs");
    glassModule = await import("./glass.mjs").catch(() => null);
    setRest(restsBare());
    Hooks.on(DEAD_SPECTATOR_HOOK, moment => { lastMoment = Date.now(); onDeadMoment(moment); });
    Hooks.on("drpgDeathsChanged", onDeathsChanged);
    Hooks.on("updateActor", actor => { if (restOutOfStep(actor)) onDeathsChanged(); });
    document.addEventListener("keydown", onEscape, true);
}

/*
 * THE PLAYER'S COPY OF A KEPT DEATH ARRIVES BEFORE ITS MOMENT. The GMs send the copy (incident-store.mjs `tellDeaths`)
 * before they place the Spectator's token, whose hook plays the fade; a rest state set at the copy would light the fade's
 * first frame bare. So the copy settles the rest state only after `SETTLE_MS` with no moment heard meanwhile - a death
 * whose body has no token (no moment comes), or a revive - and never while a fade or a return runs.
 */
const SETTLE_MS = 1500;

/*
 * AND THE TABLE'S FLAGS (the e93 line's G1, 13.11.2026). A public death and a revive are the student's own flag, a
 * Monocub its own flag, on the student's actor - not the deaths' copy - and a body with no token makes no Spectator
 * token, so no moment comes: the curtain stayed lit at such a death, and bare after such a revive, until a reload. So an
 * update of a character this player owns settles the rest state the same way, after `SETTLE_MS` with no moment heard,
 * when the death predicates' answer (`restsBare`) no longer matches the curtain. Read through `restsBare` and not off
 * the change's keys: the deceased flag is the death predicates' to read (R192).
 */
export function restOutOfStep(actor, user = game.user) {
    if (!user || user.isGM || actor?.type !== "character" || !actor.testUserPermission?.(user, "OWNER")) return false;
    return restsBare(user) !== document.body.classList.contains(BARE_CLASS);
}

let lastMoment = 0;
function onDeathsChanged() {
    const asked = Date.now();
    setTimeout(() => {
        if (running || lastMoment >= asked) return;
        setRest(restsBare());
    }, SETTLE_MS);
}
