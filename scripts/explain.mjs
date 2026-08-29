/**
 * Danganronpa RPG — the panels explain themselves.
 * ---------------------------------------------------------------------------
 * Four widgets sit on screen for the whole session and none of them said what
 * they were. The clock says "Investigation" without saying what an
 * Investigation is; the Despair rows say a number nobody has explained; the
 * strip in the corner counts actions a new player has to be told about out
 * loud; the Projects tray is a list of bars. Every one of those is a question
 * somebody asks at the table in session one and again in session four, and the
 * answer has always been the GM's voice.
 *
 * So each panel opens a window that says it (Dawid, 26.08). Click the panel —
 * player or GM, same gesture, same window — and it tells you what you are
 * looking at, plus where things actually stand right now.
 *
 * WHAT THESE WINDOWS MUST NOT DO IS LEAK. The Despair rows are masked for
 * players by the widget itself, and a window that explained them by printing
 * the numbers would undo that in one click; the room block prints a Project's
 * existence but never its name, exactly as the HUD does. So each section asks
 * the same question the widget asks — "may this user see this?" — rather than
 * assuming that a window somebody opened deliberately is a window they are
 * entitled to more from.
 */

import { MODULE_ID, TIMES_OF_DAY, TIME_OF_DAY_LABELS, PHASES } from "./config.mjs";
import { getClock, campaignName, phaseLabel, timeOfDayLabel } from "./clock.mjs";
import { dialogContent, error, workingScene } from "./utils.mjs";
import { isMonokuma } from "./monokuma.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
const t = (key, data) => data ? game.i18n.format(key, data) : game.i18n.localize(key);

/**
 * One shell for all four, so they are recognisably the same kind of window.
 *
 * A single OK button and nothing to fill in: these windows answer a question
 * and change nothing, which is the whole reason a player can be handed one
 * mid-scene without worrying about what pressing something might do.
 */
function explainer(title, body) {
    return DialogV2.wait({
        window: { title },
        classes: ["drpg-panel", "drpg-explain"],
        position: { height: "auto" },
        content: dialogContent(`<div class="drpg-explain-body">${body}</div>`),
        buttons: [{ action: "close", label: t("DRPG.Panel.close"), default: true }],
        rejectClose: false
    });
}

/** A titled block. `lines` are already-escaped HTML fragments. */
function section(heading, lines) {
    const rows = lines.filter(Boolean).map(l => `<p>${l}</p>`).join("");
    if (!rows) return "";
    return `<section class="drpg-explain-section">
        <h4>${esc(heading)}</h4>${rows}</section>`;
}

/** The actor this user is asking about: their own, or the one they have selected. */
function subjectActor() {
    return game.user.character
        ?? canvas?.tokens?.controlled?.[0]?.actor
        ?? null;
}

/* ==========================================================================
 * WHERE THINGS STAND — the clock
 * ========================================================================== */

/**
 * What the phase means, in the phase's own words.
 *
 * An Eclipse is not a phase in the rules — it is a state the clock wears — but
 * it is the loudest thing on screen while it runs and the one a player is most
 * likely to be confused by, so it answers here first.
 */
function phaseExplanation(clock) {
    if (clock?.eclipse === true) return t("DRPG.Explain.phase.eclipse");
    const key = clock?.phase ?? "dailyLife";
    // The hint on the phase itself is the short form the GM panel shows; the
    // long form lives in the language file beside it. Both, in that order:
    // the hint names the thing, the paragraph explains it.
    const hint = PHASES[key]?.hint ?? "";
    const long = game.i18n.has(`DRPG.Explain.phase.${key}`)
        ? t(`DRPG.Explain.phase.${key}`) : "";
    return [hint, long].filter(Boolean).map(esc).join("<br>");
}

/** "Evening — the 4th of 5", and the whole day listed with this one marked. */
function timeOfDayBlock(clock) {
    const now = clock?.timeOfDay;
    const index = TIMES_OF_DAY.indexOf(now);
    const strip = TIMES_OF_DAY.map(key => {
        const label = esc(TIME_OF_DAY_LABELS[key] ?? key);
        return key === now
            ? `<strong class="drpg-explain-now">${label}</strong>`
            : `<span class="drpg-explain-later">${label}</span>`;
    }).join(" · ");

    const heading = index >= 0
        ? esc(t("DRPG.Explain.time.position", {
            time: timeOfDayLabel(now), n: index + 1, of: TIMES_OF_DAY.length
        }))
        : esc(timeOfDayLabel(now));

    return [heading, strip, esc(t("DRPG.Explain.time.what"))];
}

/** Where the reader is standing, and everything true about it. */
async function roomBlock() {
    const actor = subjectActor();
    if (!actor) return section(t("DRPG.Explain.room.title"), [esc(t("DRPG.Explain.room.noActor"))]);

    const { roomOfActor } = await import("./movement.mjs");
    const room = roomOfActor(actor);
    if (!room) {
        return section(t("DRPG.Explain.room.title"), [esc(t("DRPG.Hud.roomNowhere"))]);
    }

    const lines = [`<strong>${esc(room)}</strong>`];

    // The GM's own words about the place, when they have written any — see the
    // Description tab in Room Setup. Escaped: it is typed prose, and it is
    // shown to everybody.
    const { roomDescription } = await import("./vault.mjs");
    const description = roomDescription(room);
    if (description) {
        lines.push(`<em class="drpg-explain-prose">${esc(description)}</em>`);
    }

    const { SearchTokens } = await import("./search-tokens.mjs");
    lines.push(esc(t("DRPG.Explain.room.tokens", {
        left: SearchTokens.left(room, workingScene()), max: SearchTokens.max
    })));

    // Whether there is something to work on here — never WHAT. The HUD makes
    // the same call for the same reason: this window is open while people
    // share a screen, and a project's name is between its owner and the GM.
    const { projectsAvailableIn } = await import("./projects.mjs");
    lines.push(esc(t(projectsAvailableIn(room, game.user).length
        ? "DRPG.Hud.roomProject" : "DRPG.Hud.roomNoProject")));

    return section(t("DRPG.Explain.room.title"), lines);
}

/** The clock panel, explained. Anyone may open it. */
export async function openStateExplainer() {
    try {
        const clock = getClock();
        const body = [
            section(t("DRPG.Explain.state.title"), [
                `<strong>${esc(campaignName(clock))}</strong>`,
                esc(t("DRPG.Hud.chapter", { n: clock.chapter })
                    + " · " + t("DRPG.Hud.day", { n: clock.day ?? 1 }))
            ]),
            section(clock?.eclipse === true
                ? t("DRPG.Explain.phase.eclipseTitle")
                : phaseLabel(clock.phase), [phaseExplanation(clock)]),
            section(t("DRPG.Explain.time.title"), timeOfDayBlock(clock)),
            await roomBlock()
        ].join("");

        return explainer(t("DRPG.Explain.state.window"), body);
    } catch (err) {
        error("Could not explain the state of play", err);
        return null;
    }
}

/* ==========================================================================
 * DESPAIR
 * ========================================================================== */

/**
 * What the Despair rows are.
 *
 * The numbers are the GM's. The widget masks them for players and so does
 * this: a player gets the rules and no count, which is the same bargain the
 * strip on screen already offers them.
 */
export async function openDespairExplainer() {
    try {
        const lines = [esc(t("DRPG.Explain.despair.what")), esc(t("DRPG.Explain.despair.spent"))];

        if (game.user.isGM) {
            const { monokumas, getDespair, despairMax, poolLabel } = await import("./despair.mjs");
            const rows = monokumas().map(user =>
                esc(`${poolLabel(user)}: ${getDespair(user.id)} / ${despairMax()}`));
            lines.push(rows.length
                ? rows.join("<br>")
                : esc(t("DRPG.Explain.despair.noPools")));
        } else {
            lines.push(esc(t("DRPG.Explain.despair.masked")));
        }

        /*
         * "What is despair overflow" (Z10). Its own section rather than another
         * line in the one above, because it answers a different question: the
         * pools are what a Monokuma HAS, and this is what happens to what they
         * cannot hold. A player who clicked the pips to ask about the bar reads
         * the caption sitting directly above it on the way.
         */
        const overflowLines = [esc(t("DRPG.Overflow.explainBody")),
                               esc(t("DRPG.Overflow.explainVeil"))];
        if (game.user.isGM) {
            const { overflowStatus } = await import("./overflow.mjs");
            const { count, threshold } = overflowStatus();
            overflowLines.push(esc(t("DRPG.Overflow.gmHint")
                .replace("{count}", count).replace("{max}", threshold)));
        }

        return explainer(t("DRPG.Explain.despair.window"),
            section(t("DRPG.Explain.despair.title"), lines)
            + section(t("DRPG.Overflow.explainTitle"), overflowLines));
    } catch (err) {
        error("Could not explain the Despair pool", err);
        return null;
    }
}

/* ==========================================================================
 * ACTIONS, MOVE, HOPE
 * ========================================================================== */

/** The strip in the corner: what each of its three counters is for. */
export async function openStatusExplainer() {
    try {
        const actor = subjectActor();
        const { actionsLeft, actionsMax, hasFreeMove } = await import("./actions.mjs");
        const { resourceValue, resourceMax } = await import("./character.mjs");

        /*
         * A MONOKUMA HAS NONE OF THE THREE THINGS THIS SECTION COUNTS.
         *
         * "Right now" answered with actions, the free Move and Hope — three
         * sentences about something a GM's character does not have, on the one
         * screen that exists to explain what the strip in the corner means.
         *
         * Every line below is a rule this module already keeps, said out loud:
         * `resetActionsFor` skips a Monokuma on purpose, movement charges them
         * nothing and grants them nothing, they spend Despair where a student
         * spends Hope, and walls do not stop them. All four are written in the
         * comment on `FLAGS.monokuma`; this is describing the existing game,
         * not adding to it.
         */
        const standing = actor && isMonokuma(actor)
            ? [
                esc(t("DRPG.Explain.status.monokumaActions")),
                esc(t("DRPG.Explain.status.monokumaMove")),
                esc(t("DRPG.Explain.status.monokumaDespair")),
                esc(t("DRPG.Explain.status.monokumaWalls"))
            ]
            : actor
            ? [
                esc(t("DRPG.Explain.status.actionsNow", {
                    left: actionsLeft(actor), max: actionsMax(actor)
                })),
                esc(t(hasFreeMove(actor)
                    ? "DRPG.Actions.freeMoveAvailable" : "DRPG.Explain.status.moveSpent")),
                esc(t("DRPG.Explain.status.hopeNow", {
                    held: resourceValue(actor, "hope"), max: resourceMax(actor, "hope")
                }))
            ]
            : [esc(t("DRPG.Explain.room.noActor"))];

        const body = [
            section(t("DRPG.Explain.status.actionsTitle"), [
                esc(t("DRPG.Explain.status.actionsWhat")),
                esc(t("DRPG.Explain.status.actionsWounded"))
            ]),
            section(t("DRPG.Explain.status.moveTitle"), [esc(t("DRPG.Explain.status.moveWhat"))]),
            section(t("DRPG.Explain.status.hopeTitle"), [esc(t("DRPG.Explain.status.hopeWhat"))]),
            section(t("DRPG.Explain.status.standing"), standing)
        ].join("");

        return explainer(t("DRPG.Explain.status.window"), body);
    } catch (err) {
        error("Could not explain the action strip", err);
        return null;
    }
}

/* ==========================================================================
 * PROJECTS
 * ========================================================================== */

/** The Projects tray: what a project is, and which ones this reader can see. */
export async function openProjectsExplainer() {
    try {
        const { visibleProjects } = await import("./projects.mjs");
        const mine = visibleProjects(game.user);

        // `current` counts UP toward `start`, whichever way the underlying
        // countdown is stored — `allProjects()` has already normalised that,
        // and reading the raw countdown here would undo it for half of them.
        const rows = mine.map(p => esc(`${p.name ?? "—"} — ${p.current ?? 0}/${p.start ?? 0}`));

        const body = [
            section(t("DRPG.Explain.projects.title"), [
                esc(t("DRPG.Explain.projects.what")),
                esc(t("DRPG.Explain.projects.progress")),
                esc(t("DRPG.Explain.projects.secret"))
            ]),
            section(t("DRPG.Explain.projects.yours"),
                rows.length ? [rows.join("<br>")] : [esc(t("DRPG.Explain.projects.none"))])
        ].join("");

        return explainer(t("DRPG.Explain.projects.window"), body);
    } catch (err) {
        error("Could not explain the Projects tray", err);
        return null;
    }
}

/* ==========================================================================
 * WIRING
 * ========================================================================== */

/**
 * Which panel a click landed in, and what it should open.
 *
 * By id rather than by listener-per-widget, because three of these four are
 * rebuilt from scratch whenever their contents change — a listener bound at
 * render time would go with the element it was bound to, every render, for the
 * rest of the session. One delegated listener on the document outlives all of
 * them.
 */
const PANELS = [
    ["#drpg-hud", openStateExplainer],
    ["#drpg-despair", openDespairExplainer],
    ["#drpg-player-status", openStatusExplainer],
    ["#countdowns", openProjectsExplainer]
];

/**
 * A click on a CONTROL is not a click on the panel.
 *
 * All four of these carry working controls for one role or another — the GM's
 * time-of-day arrows, the Despair pips they set by clicking, the Projects
 * tray's own buttons and its collapse toggle. Opening a window on top of
 * somebody's button press would make every one of those controls feel broken,
 * so anything that is or sits inside an interactive element is left alone.
 */
/*
 * A TAG LIST MISSES THE CONTROLS THIS MODULE ACTUALLY BUILDS.
 *
 * The Despair pips and the sheet's action pips are `<span role="button"
 * tabindex="0">`, which none of the selectors above matches — so clicking a pip
 * set the value AND opened the explainer on top of the panel the person was
 * still using. Roles and focusability are what make a thing a control here, not
 * its tag name. `tabindex="-1"` is excluded because it means the opposite:
 * focusable by script, not by a person.
 */
const INTERACTIVE = "button, a, input, select, textarea, [data-action],"
    + " [contenteditable='true'], [role='button'], [tabindex]:not([tabindex='-1'])";

export function registerExplainers() {
    document.addEventListener("click", event => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.closest(INTERACTIVE)) return;

        for (const [selector, open] of PANELS) {
            if (!target.closest(selector)) continue;
            event.preventDefault();
            open().catch(err => error("Could not open the panel's explanation", err));
            return;
        }
    });

    // A pointer that says the panel answers to a click. Set here rather than in
    // the stylesheet for the same reason the listener is delegated: three of
    // the four elements do not exist yet, and two of them are not ours.
    document.body.classList.add("drpg-explainers");

    console.debug(`${MODULE_ID} | panels explain themselves on click.`);
}
