/**
 * Danganronpa RPG - the GMs' audit of a player's move through a wall (E79 C4, 1.2.79).
 * ---------------------------------------------------------------------------
 * A player's browser stops its own token at a wall: Foundry's move backend, cut where the
 * character knows a secret passage (passages.mjs, C2). A console steps past that browser, so the
 * primary GM reads every move of a student's token by a player as it lands, against the walls of
 * the token's own scene (`auditMove`): the same rule for an ordinary wall and for a passage's wall,
 * the passages the character knows read from the GMs' records, never from a player's copy. What
 * it finds is a row in the Debug log (`moveAudit` "log", the default - the plan's AM-1) or the token
 * put back where the GM last saw it, its player told and the GMs warned ("sendBack").
 *
 * ONE CALL SITE (R560): movement.mjs `noteGmPosition`, on the primary GM, before `gmSeen` moves -
 * so the start of the route is where the GM last saw the token, never a field of the update. The
 * readers it needs from movement.mjs are handed in (`ctx`): this file is imported by movement.mjs
 * and does not import it back (R161).
 *
 * Its own geometry repeats Foundry's rule for a wall as far as the plan names it (risk K1-K3):
 * a wall that does not restrict movement, an open door, a one-way wall seen from its open side,
 * and the floors; Foundry's own source was not read for it, and the audit in "log" mode at a table,
 * with a GM on another scene and with floors, is LIVE-E79-02. E17
 * extends `auditMove` rather than writing a second audit: since E17 C1 the doors' rules put a token back
 * from it too, in either mode (`RULE_CODES`). The default stays "log" for the walls and floors (session 0:
 * "tylko log" at the table of 26.10; the default after it is E82's).
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { warn, error, esc, whisperToGms, primaryGmId } from "./utils.mjs";
import { isMoveChange, levelOf, onLevel, isPlaceScene } from "./rooms.mjs";
import { openSegmentsFor, cutSegment, stepCrosses, arrivingPrimary } from "./passages.mjs";
import { actsAsMastermind, secretDoorHeldShut } from "./passages-gm.mjs";
import { isMonokuma } from "./monokuma.mjs";
import { playSfx } from "./sfx.mjs";

const SOCKET_EVENT = `module.${MODULE_ID}`;

/**
 * The doors' rules the audit puts a token back for (E17 C1, 26.10.2026; audit S07-02, the owner's 13.10, the stage's
 * "the rules put back in either mode"), each a code of bridge-guards.mjs `REASONS` whose words a player's browser says
 * (`DRPG.Bridge.why.<code>`): the incident's lock, a GM's lock, a seal, Chained, the courtroom, and `cannotNow` for
 * another's bedroom shut to the mover (movement.mjs `ruleOf`: only the bedroom's `cannotNow`, never the connected-rooms
 * rule's, which is the walls' and floors' and follows `moveAudit`). `noBudget` is the payer's and never a put-back.
 * Since E17 C2 a crossing the primary sees past the Eclipse's allowance too (`eclipseSpent`; movement.mjs
 * `eclipseSighting`). movement.mjs reads this list (it imports this file, R161).
 */
export const RULE_CODES = Object.freeze(["cannotLeave", "doorLocked", "roomSealed", "chained", "cannotNow", "trialLocked", "eclipseSpent"]);

/** The codes a `move.sentBack` may carry: a wall, and since E80 C2 a floor the doors' rules do not join, and since E17 C1
 *  the rules' codes (`RULE_CODES`) - the things the audit sends a token back for, one packet for all of them. */
const SENT_BACK_CODES = new Set(["wall", "floor", ...RULE_CODES]);

/*
 * WHAT THE AUDIT KEEPS, on the primary GM, in this page's memory (E79 fix r1-G1, 1.2.79). The Debug log was its
 * only record: the first 60 distinct rows of a page, the rest dropped uncounted (utils.mjs `record`), so a session
 * in "log" mode could not say how many moves went through a wall (review r1, goal F6). `rows` is its own: one row
 * per crossing it judged, a burst of the same token, mover, wall and mode within `BURST_MS` folded into one with
 * `times`, the newest `AUDIT_ROWS_KEPT` kept and the rest counted in `dropped`; `game.drpg.passages.audit()` reads
 * it. `told` is when the GMs were last whispered of a token and its mover: in "sendBack" mode a console looping
 * through a wall wrote one chat message per move (review r1, cor F3), so one whisper per token and mover within
 * `BURST_MS`, the rest counted on the row (`quiet`). `lines` is the side of a wall's line a token's route was last
 * strictly on, for a token that stands on that line (`firstWallCrossed`). Nothing of it is a world document.
 */
const BURST_MS = 30_000;
const AUDIT_ROWS_KEPT = 1000;
const book = { rows: [], told: new Map(), lines: new Map(), dropped: 0 };

/** Foundry's `orient2dFast`: > 0 one side of a -> b, < 0 the other, 0 on its line. */
const orient = (a, b, c) => (a.y - c.y) * (b.x - c.x) - (a.x - c.x) * (b.y - c.y);

/**
 * Whether a one-way wall lets a step through that sets out from `side` of its line (the sign of
 * `orient` against the wall's own two ends): Foundry's rule as the plan reads it - a wall with a
 * direction (`dir` 1 LEFT, 2 RIGHT) is no wall to a step that starts on the side it names
 * (`orient2dFast` < 0 is LEFT, > 0 RIGHT). Not read in v14's source.
 */
function oneWayOpen(wall, side) {
    const dir = Number(wall.dir ?? 0);
    return Boolean(dir) && side !== 0 && (side < 0 ? 1 : 2) === dir;
}

/** Whether the step a -> b crosses the piece p: its ends strictly on both sides of the piece's line, the piece's ends not both on one side of the step. */
function crosses(a, b, p) {
    const p1 = { x: p.x1, y: p.y1 }, p2 = { x: p.x2, y: p.y2 };
    return orient(p1, p2, a) * orient(p1, p2, b) < 0 && orient(a, b, p1) * orient(a, b, p2) <= 0;
}

/** Where a point of p's line lies along p: 0 at its first end, 1 at its second. */
function along(p, q) {
    const dx = p.x2 - p.x1, dy = p.y2 - p.y1;
    return ((q.x - p.x1) * dx + (q.y - p.y1) * dy) / ((dx * dx + dy * dy) || 1);
}

/** Whether a stretch of a route that ran on a wall's line (`run`, its points there) met the piece p of that line. */
function runMeets(run, p) {
    const at = run.map(q => along(p, q));
    return Math.max(Math.min(...at), 0) <= Math.min(Math.max(...at), 1);
}

/** A spot's centre for this token, `{ x, y }` its top-left corner, measured with its own scene's grid (movement.mjs `centresOf`'s rule). */
function centreOf(tokenDoc, spot) {
    const size = tokenDoc?.parent?.grid?.size ?? 100;
    return { x: Number(spot?.x) + ((tokenDoc?.width ?? 1) * size) / 2, y: Number(spot?.y) + ((tokenDoc?.height ?? 1) * size) / 2 };
}

/**
 * The route the GM judges, top-left corners: where the GM last saw the token (`was`), the waypoints
 * this move passed, and where it stands now. The waypoints are the mover's (`tokenDoc.movement`, a
 * field of v14's move not modelled by the harness, where the route is the straight step): a route
 * through them that crosses no wall ends where a lawful walk ends, so a claimed one can only make a
 * move refused, never let a wall through. Only those after the last that stands where `was` stands.
 */
function routeOf(tokenDoc, was) {
    const passed = Array.isArray(tokenDoc.movement?.passed?.waypoints) ? tokenDoc.movement.passed.waypoints : [];
    const points = passed.filter(p => Number.isFinite(p?.x) && Number.isFinite(p?.y));
    const from = points.findLastIndex(p => p.x === was.x && p.y === was.y);
    return [was, ...points.slice(from + 1), { x: tokenDoc.x, y: tokenDoc.y }];
}

/**
 * The first wall the route crosses, `{ wall, passage, step }` or null, and `lines`: each step's
 * centres against every wall of the token's scene on the floor it set out from that restricts
 * movement and is not an open door or a one-way wall seen from its open side, a passage's wall cut
 * where this character may pass (`open`). `passage` names a secret passage on that wall whose
 * stretch the route went through, for the log row alone: the result is the same either way.
 *
 * ON THE LINE (E79 fix r1-G1, 1.2.79; review r1, goal F1). A step was a crossing only with its two
 * ends strictly on both sides of the wall's line, so a route through a point exactly on the line -
 * one step onto it, the next off it on the other side, in one move's waypoints or in two moves - was
 * judged clear: the review's replica measured it (S/e79-review/f1-replica.mjs), and R559 and 76 D
 * read it red at the parent. Now each wall keeps the side the route was last strictly on and the
 * points it has stood on the line since (`run`): a point off the line on the other side is a crossing
 * where that run met a piece of the wall, and one back on the same side is none. A route that ends
 * on a line hands the side and the run on (`lines`, by wall id), and the next move of the token
 * starts from them (`carried`) - its start is where this one ended.
 */
function firstWallCrossed(tokenDoc, route, level, open, secret, carried = null) {
    const walls = Array.from(tokenDoc.parent?.walls ?? []).filter(wall => onLevel(wall, level));
    const centres = route.map(spot => centreOf(tokenDoc, spot));
    const lines = new Map();
    let found = null;
    for (const wall of walls) {
        const c = Array.isArray(wall?.c) ? wall.c.map(Number) : [];
        if (c.length < 4 || !c.every(Number.isFinite)) continue;
        if (Number(wall.move ?? 20) === 0) continue;
        // A secret door a player opened is read shut until the primary GM's put-back lands (E80 C5, P1-18;
        // passages-gm.mjs `putBackSecretDoor`): the step that follows the opening is judged against it. R601.
        if (Number(wall.door ?? 0) > 0 && Number(wall.ds) === 1 && !secretDoorHeldShut(wall.id)) continue;
        const whole = { x1: c[0], y1: c[1], x2: c[2], y2: c[3] };
        const pieces = cutSegment(whole, open.filter(seg => seg.wallId === wall.id)) ?? [whole];
        const ends = [{ x: c[0], y: c[1] }, { x: c[2], y: c[3] }];
        const kept = carried?.get(wall.id) ?? null;
        let side = kept?.side ?? 0, run = kept ? [...kept.run] : [];
        for (let i = 0; i < centres.length; i++) {
            const a = centres[i - 1], b = centres[i], here = Math.sign(orient(ends[0], ends[1], b));
            if (here === 0) {
                run.push(b);
                continue;
            }
            if (side && here !== side && !oneWayOpen(wall, side) && (!found || i < found.step)) {
                const through = run.length ? (seg => runMeets(run, seg)) : (seg => crosses(a, b, seg));
                if (pieces.some(through)) {
                    const passage = secret.find(seg => seg.wallId === wall.id && (run.length ? runMeets(run, seg) : stepCrosses(a, b, seg)))?.id ?? null;
                    found = { wall: wall.id ?? null, passage, step: i };
                }
            }
            side = here;
            run = [];
        }
        if (side && run.length) lines.set(wall.id, { side, run });
    }
    return { found, lines };
}

/** The sides `firstWallCrossed` handed on for this token, taken out of the book: only where its last route ended at `was`, on this scene. */
function takeLines(ledger, tokenDoc, scene, was) {
    const kept = ledger.lines.get(tokenDoc.id) ?? null;
    ledger.lines.delete(tokenDoc.id);
    const here = kept && was && kept.scene === scene.id && kept.x === was.x && kept.y === was.y && (kept.level ?? null) === (was.level ?? null);
    return here ? kept : null;
}

/** Keep the sides a route that ended on a wall's line handed on, under the spot it ended at. */
function keepLines(ledger, tokenDoc, entry) {
    if (entry?.sides?.size) ledger.lines.set(tokenDoc.id, entry);
}

/*
 * AN EXEMPT LANDING KEEPS ITS SIDE (E79 fix r2-G1, 1.2.79; review r2, SEC M2). The sides a route hands on were taken
 * out of the book before the audit asked whether the move was its to judge, and an exempt move - a GM's, an accepted
 * REVERT or send-back, the stairs, a Monokuma - returned without keeping any: a REVERT onto a spot of the GMs' record
 * that lies exactly on a wall's line, then a step off it to the far side, counted no crossing (the reviewer's SECR2-P2:
 * Botan at 1550,400, 0 rows; R559 and 76 D read it red at 33ea568). Now an exempt landing keeps, for each wall whose
 * line it lands on, the side its start was strictly on - the step from `was` straight to the landing, never the
 * waypoints a REVERT names - or the side it was handed, as a judged step does. What it costs: a GM who sets a token
 * exactly on a wall's line from its far side makes the token's next step to the near side a crossing. A landing on
 * another floor than its start keeps nothing: the walls it stands on were not those of the step.
 */
function exemptLanding(tokenDoc, scene, was, kept) {
    if (!was || (was.level ?? null) !== levelOf(tokenDoc)) return null;
    const { lines } = firstWallCrossed(tokenDoc, [was, { x: tokenDoc.x, y: tokenDoc.y }], was.level ?? null, [], [], kept?.sides ?? null);
    return { scene: scene.id, x: tokenDoc.x, y: tokenDoc.y, level: tokenDoc.level ?? null, sides: lines };
}

/*
 * WHO ASKED A GM'S WRITE (E79 fix r2-G1, 1.2.79; review r2, SEC M1 = cor F2 = goal H1 a). The bridge's send-back
 * (gm-bridge.mjs `handleSendback`) is written by the GM and was exempt as a GM's move before anything else was read,
 * and `guardSendbackPlace` accepts the centre of a room the token stood in as well as a spot of the record: the
 * owner's send-back to the centre of the room Botan stood in, across a wall, undid the audit's put-back with no row
 * (the reviewers' SECR2-P1 and probe76: Botan at 1550,450, 0 rows, 0 whispers). Its write names the player who asked
 * (`SENT_BACK`, read only on a GM's write, as `WALL_PUT_BACK` is), and the audit judges it as that player's own revert:
 * exempt only where `sendBackRefusal` accepts the landing against the GMs' record, which holds no centre, and any
 * other landing by the wall rule with that player as the mover. The guard is left as it is: refusing a centre a wall
 * stands in front of would refuse the send-back of a token Foundry itself let through a wall. The audit's own put-back
 * names nobody, so it does not loop. movement.mjs's judge of arrivals reads the same asker for the same write (E79
 * fix r3-G2, SEC S4).
 */
export function askerOf(named, users) {
    const user = typeof named === "string" ? users?.get(named) : null;
    return user && !user.isGM ? user.id : null;
}

/**
 * One crossing on the audit's rows (`book`, above), folded into the newest row of the same token,
 * mover, wall, passage and mode when that row's last crossing is within `BURST_MS`.
 */
function noteRow(ledger, row, now) {
    const same = ledger.rows.findLast(r => now - r.last <= BURST_MS && r.token === row.token && r.user === row.user
        && r.wall === row.wall && r.passage === row.passage && r.mode === row.mode);
    if (same) {
        same.times += 1;
        same.last = now;
        return same;
    }
    const fresh = { ...row, at: now, last: now, times: 1, quiet: 0 };
    ledger.rows.push(fresh);
    if (ledger.rows.length > AUDIT_ROWS_KEPT) {
        ledger.rows.shift();
        ledger.dropped += 1;
    }
    return fresh;
}

/**
 * What the audit has judged a crossing on this browser since the page loaded, oldest first, each row
 * `{ token, actor, user, scene, wall, passage, mode, verdict, at, last, times, quiet, sent? }` (`quiet`: the
 * put-backs on it the GMs were not whispered of; `sent`, in "sendBack" mode: those written, and `verdict` "sent
 * back" only when every one was, else "not sent back"), and how many older rows were let go: rows exist on
 * the primary GM's browser alone, where the audit runs. `game.drpg.passages.audit()`.
 */
export function auditRows() {
    return { rows: book.rows.map(row => ({ ...row })), dropped: book.dropped };
}

/**
 * Judge one landed move of a token on the primary GM, and act on a wall it went through: `ctx` holds
 * movement.mjs's readers (`REVERT`, `SENT_BACK`, `history`, `sendBackRefusal`, `stairLinks`,
 * `roomAt`, `held`, `sendBack`, `floorRefused`, `ruleRefused`) and, for the suite (R559), `mode`, `users`, `known`, `mastermind`,
 * `socket`, `whisper`, `warn`, `book` and `now` (`mastermind` the Mastermind's record, as gm-stores.mjs's). Answers `{ verdict, why?, wall?, passage?, mode?, rule?, back? }`: "skip"
 * for a move it does not judge, "exempt", "clear", "crossed" or, since E17 C1, "refused" (a rule's code in `rule`;
 * `back`, the spot a put-back is sent to). Every
 * exemption is the GM's own reading - the hook's user, the GMs' record of the token, the stairs on the map, the flags
 * as the GMs hold them - and none is an option of the update but the player a GM's send-back names, who is then
 * judged as the mover (`askerOf`): a REVERT is exempt only where `sendBackRefusal`
 * accepts it against the GMs' record, which holds no spot this audit put the token back from
 * (movement.mjs `sightingsAfter`), and Foundry's teleport and displace are moves like any other. Fails open: a throw is
 * an error row and nothing else.
 */
export function auditMove(tokenDoc, changes, options, userId, was, ctx = {}) {
    try {
        const { REVERT, SENT_BACK } = ctx;
        const actor = tokenDoc?.actor ?? null;
        const scene = tokenDoc?.parent ?? null;
        if (!isMoveChange(changes) || !actor || actor.type !== "character" || !scene) return { verdict: "skip", why: "not a student's move" };
        const ledger = ctx.book ?? book, now = ctx.now ?? Date.now(), users = ctx.users ?? game.users;
        const kept = takeLines(ledger, tokenDoc, scene, was);
        const exempt = why => {
            keepLines(ledger, tokenDoc, exemptLanding(tokenDoc, scene, was, kept));
            return { verdict: "exempt", why };
        };
        let mover = userId ?? null;
        if (users?.get(userId)?.isGM) {
            mover = askerOf(options?.[SENT_BACK], users);
            if (!mover) return exempt("a GM's move");
        }
        /*
         * THE DOORS' RULES, AFTER THE WALLS AND FLOORS (E17 C1, 26.10.2026; audit S07-02, the owner's 13.10 and A10: "S07-02,
         * S07-08 i poziom z S07-45 idą do TEGO hooka i tej drogi, po regule ścian, bez drugiego listenera i bez zwolnień z
         * opcji pakietu"). The rules were asked on the mover's browser alone (`onPreUpdateToken`), which a console steps
         * past, and the primary's judge of arrivals (movement.mjs `judgeArrival`, asked just before this) held such an
         * arrival unlawful and put nothing back. Now every judged landing of a player's move - clear of the walls, a wall
         * or floor only noted in "log" mode, a REVERT the GMs' record accepts, the stairs, a token never seen - asks the
         * judge's verdict (`ctx.ruleRefused`: whether the judge read this landing as one a rule refuses, and the spot it
         * last read the token standing on lawfully) and puts the token back there - x, y, elevation and floor - in either
         * mode, its player sent the rule's code and the GMs told once a burst. A wall or floor put back in "sendBack" mode
         * is the wall rule's put-back, and asks nothing more. What the judge holds the rule against is the player's move:
         * the hook's player, or the player a GM's send-back names (`mover`); a GM's own move makes a spot lawful, so it
         * never comes here. Nothing of the update's options decides it. A wall noted in "log" mode changes no standing
         * (14.10's D7): what moves the witness is the rule's put-back, which the judge reads as the GM's write it is.
         */
        const rules = judged => {
            const refused = mover && typeof ctx.ruleRefused === "function" ? ctx.ruleRefused(tokenDoc) : null;
            if (!refused?.back) return judged;
            const socket = ctx.socket ?? game.socket;
            const row = noteRow(ledger, { token: tokenDoc.id, actor: actor.id, user: mover, scene: scene.id, wall: null, passage: null, rule: refused.code,
                mode: "rules", verdict: "not sent back" }, now);
            ctx.sendBack(tokenDoc, refused.back, {
                sound: false,
                // Marked as the audit's (movement.mjs `sightingsAfter`): the refused spot is no reader's afterwards.
                audited: true,
                elevation: true,
                landed: wrote => {
                    row.sent = (row.sent ?? 0) + (wrote ? 1 : 0);
                    row.verdict = row.sent >= row.times ? "sent back" : "not sent back";
                    if (wrote) socket.emit(SOCKET_EVENT, { action: "move.sentBack", userId: mover, sceneId: scene.id, tokenId: tokenDoc.id, code: refused.code }, { recipients: [mover] });
                }
            });
            const told = `${tokenDoc.id} ${mover} rules`, last = ledger.told.get(told);
            if (last !== undefined && now - last <= BURST_MS) row.quiet += 1;
            else {
                ledger.told.set(told, now);
                const said = game.i18n.format("DRPG.Movement.ruleSentBack", { name: actor.name ?? tokenDoc.name ?? "",
                    room: refused.room ?? game.i18n.localize("DRPG.Movement.outsideRooms"), scene: scene.name ?? "" });
                (ctx.whisper ?? whisperToGms)(`<p class="drpg-warning" data-drpg-rule="${esc(tokenDoc.id)}">${esc(said)}</p><p>${esc(refused.reason ?? "")}</p>`)
                    ?.catch?.(err => error("Could not tell the GMs of a token the rules sent back", err));
            }
            // `back`: the GMs' sighting becomes it at once, as a wall's put-back's does (movement.mjs `noteGmPosition`).
            return { verdict: "refused", rule: refused.code, back: refused.back };
        };
        if (isMonokuma((ctx.held ?? (a => a))(actor))) return exempt("Monokuma");
        if (!isPlaceScene(scene)) return { verdict: "skip", why: "no rooms" };
        if (!was) return rules({ verdict: "skip", why: "never seen" });
        if (options?.[REVERT] || options?.[SENT_BACK]) {
            const spot = { x: tokenDoc.x, y: tokenDoc.y, elevation: tokenDoc.elevation ?? 0, level: tokenDoc.level ?? undefined };
            if (!ctx.sendBackRefusal(spot, { scene, history: ctx.history ?? [] })) return rules(exempt("a send-back the GM accepts"));
        }
        const from = was.level ?? null, to = levelOf(tokenDoc);
        if (from !== to) {
            const pair = [ctx.roomAt(was.x, was.y, tokenDoc, from), ctx.roomAt(tokenDoc.x, tokenDoc.y, tokenDoc, to)].sort();
            if (pair.every(Boolean) && (ctx.stairLinks(scene) ?? []).some(link => link[0] === pair[0] && link[1] === pair[1])) {
                return rules(exempt("the stairs"));
            }
        }
        const known = ctx.known ? { known: ctx.known } : {};
        // The Mastermind as the mover acts, the door's reading (passages-gm.mjs `actsAsMastermind`; E79 fix r2-G2, SEC M3).
        const mastermind = actsAsMastermind(actor, users?.get?.(mover) ?? null, { users, ...(ctx.mastermind ? { mastermind: ctx.mastermind } : {}) });
        const open = openSegmentsFor(actor, scene.id, from, { mastermind, ...known });
        const secret = openSegmentsFor(actor, scene.id, from, { mastermind: true, ...known });
        const { found, lines } = firstWallCrossed(tokenDoc, routeOf(tokenDoc, was), from, open, secret, kept?.sides ?? null);
        const landed = { scene: scene.id, x: tokenDoc.x, y: tokenDoc.y, level: tokenDoc.level ?? null, sides: lines };
        /* THE FLOOR RULE (E80 C2, 18.10.2026; the stage's write road "token own update ... floor rule"). A change of
           floor no wall stands in the way of - a console's jump to a tunnel's far end upstairs - is the doors' to judge:
           `ctx.floorRefused` (movement.mjs `floorJumpRefused`) asks their connected-rooms rule, the stairs. Read after
           the wall rule, which names the wall when there is one; the stairs that link the two rooms are exempt above. */
        const floor = !found && from !== to && typeof ctx.floorRefused === "function" && (() => {
            const a = ctx.roomAt(was.x, was.y, tokenDoc, from), b = ctx.roomAt(tokenDoc.x, tokenDoc.y, tokenDoc, to);
            return Boolean(a && b && a !== b && ctx.floorRefused(scene, a, b, { from, to }));
        })();
        if (!found && !floor) {
            keepLines(ledger, tokenDoc, landed);
            return rules({ verdict: "clear" });
        }

        const mode = ctx.mode ?? game.settings.get(MODULE_ID, SETTINGS.moveAudit);
        const sending = mode === "sendBack";
        const crossing = floor ? { wall: null, passage: null, floor: true } : { wall: found.wall, passage: found.passage };
        (ctx.warn ?? warn)(`A player's move took a token ${floor ? "to another floor" : "through a wall"} (${sending ? "sent back" : "noted"})`,
            { token: tokenDoc.id, actor: actor.id, user: mover, scene: scene.id, ...crossing, mode: sending ? "sendBack" : "log" });
        // "not sent back" until the put-back is written (`landed`, below): review r2, cor F4.
        const row = noteRow(ledger, { token: tokenDoc.id, actor: actor.id, user: mover, scene: scene.id, ...crossing,
            mode: sending ? "sendBack" : "log", verdict: sending ? "not sent back" : "noted" }, now);
        if (!sending) {
            keepLines(ledger, tokenDoc, landed);
            return rules({ verdict: "crossed", ...crossing, mode: "log" });
        }

        const socket = ctx.socket ?? game.socket;
        ctx.sendBack(tokenDoc, was, {
            sound: false,
            // Marked as this audit's (movement.mjs `sightingsAfter`): every GM's record drops the spot it leaves.
            audited: true,
            // The row says what was written (E79 fix r2-G1; review r2, cor F4): it said "sent back" before the
            // write, and a write that failed (`sendBack` logs it and the token stays) left it saying so. A row of a
            // burst says "sent back" only once every put-back on it is written (`sent`). The mover is told once the
            // token stands back where it was, so its line names that room; the sides a route that ended on a wall's
            // line handed on are the token's again, where it stands.
            landed: wrote => {
                row.sent = (row.sent ?? 0) + (wrote ? 1 : 0);
                row.verdict = row.sent >= row.times ? "sent back" : "not sent back";
                if (!wrote) return;
                keepLines(ledger, tokenDoc, kept);
                if (mover) socket.emit(SOCKET_EVENT, { action: "move.sentBack", userId: mover, sceneId: scene.id, tokenId: tokenDoc.id, code: floor ? "floor" : "wall" }, { recipients: [mover] });
            }
        });
        const told = `${tokenDoc.id} ${mover ?? ""}`, last = ledger.told.get(told);
        if (last !== undefined && now - last <= BURST_MS) row.quiet += 1;
        else {
            ledger.told.set(told, now);
            const name = actor.name ?? tokenDoc.name ?? "";
            const said = game.i18n.format(floor ? "DRPG.Movement.floorJumped" : "DRPG.Movement.wallCrossed", { name, scene: scene.name ?? "" });
            (ctx.whisper ?? whisperToGms)(`<p class="drpg-warning" data-drpg-wall="${esc(tokenDoc.id)}">${esc(said)}</p>`)
                ?.catch?.(err => error("Could not tell the GMs of a token sent back through a wall", err));
        }
        // `back`: where the token is sent, which the GMs' sighting becomes at once (movement.mjs `noteGmPosition`).
        return { verdict: "crossed", ...crossing, mode: "sendBack", back: was };
    } catch (err) {
        error(`Could not audit the move of "${tokenDoc?.name}"`, err);
        return { verdict: "skip", why: "failed" };
    }
}

/**
 * Why a `move.sentBack` is not this browser's to take, or null: addressed to this user, sent by the
 * primary GM (passages.mjs `passageRowsRefusal`'s rule, the GM whose world has just loaded counted as
 * connected, `arrivingPrimary` - review r1, SEC S6), and naming a code it knows. `me`, `users`,
 * `arriving` and `primary` are the suite's to hand: with `users` and `arriving` alone the primary is
 * worked out as on a table (R559, review r2 goal O10).
 */
export function sentBackRefusal(payload, senderId, { me = game.user, users = game.users, arriving = arrivingPrimary(), primary = primaryGmId({ arriving, users }) } = {}) {
    if (me?.isGM) return "a GM's browser is not told";
    if (payload?.userId !== me?.id) return "addressed to somebody else";
    if (!users?.get(senderId)?.isGM) return "not sent by a GM";
    if (senderId !== primary) return "not sent by the primary GM";
    if (!SENT_BACK_CODES.has(payload?.code)) return "an unknown code";
    return null;
}

/**
 * Player: the primary GM put this user's token back from a wall - the refusal's sound and the veto's
 * line, naming the room it stands in - or, since E17 C1, for a rule: the bridge's words for its code
 * (`DRPG.Bridge.why.<code>`, the player's own language). Answers whether it was taken; a refusal is a Debug log row.
 */
export async function onSentBack(payload, senderId) {
    if (payload?.action !== "move.sentBack") return false;
    const refused = sentBackRefusal(payload, senderId);
    if (refused) {
        warn(`A token's send-back was not taken: ${refused}`);
        return false;
    }
    playSfx("refused");
    if (payload.code !== "wall" && payload.code !== "floor") {
        ui.notifications.warn(game.i18n.localize(`DRPG.Bridge.why.${payload.code}`));
        return true;
    }
    const token = game.scenes?.get(payload.sceneId)?.tokens?.get(payload.tokenId) ?? null;
    const { roomOfToken } = await import("./movement.mjs");
    const from = (token && roomOfToken(token)) || game.i18n.localize("DRPG.Movement.outsideRooms");
    ui.notifications.warn(game.i18n.format("DRPG.Move.cannotReach", { from }));
    return true;
}

/** At ready, on a player's browser: the listener for the primary GM's send-back. */
export function registerMoveAudit() {
    Hooks.once("ready", () => {
        if (game.user.isGM) return;
        game.socket.on(SOCKET_EVENT, (payload, senderId) => {
            onSentBack(payload, senderId).catch(err => error("Could not take the GM's send-back", err));
        });
    });
}
