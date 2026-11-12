/**
 * Danganronpa RPG - the trial hall's two zones as shapes: which regions they are, which zone a point stands in, and
 * whether the two cover the hall (E73 C1, 12.11.2026; plan E73 C1, the owner's TR20 = 1, DX1 = 2, DX5 = 1, DZ7).
 * ---------------------------------------------------------------------------
 * The hall is a place for nobody (rooms.mjs): no region on it is a room, so nothing that asks about rooms - the veto,
 * the charge, fog, traps, voice, Search - ever reads a zone. A zone is read by the three zone modes of the Class Trial
 * alone (trial-zones.mjs), and by the Scenes tab that picks it (trial-scene.mjs). The GM picks two regions of the linked
 * hall as Zone A and Zone B; they are stored in `sceneRoles` as `zones: { a, b }`, beside `school` and `trial`, with no
 * migration (the setting's note, settings.mjs).
 *
 * A LEAF but for rooms.mjs and config.mjs (R161 counts static imports): trial-scene.mjs and trial-zones.mjs both read it.
 *
 * WHICH ZONE A POINT IS IN (`zoneAt`): the region's `testPoint` at the point with the token's elevation - a v14 region is
 * a volume, and a point with no elevation is outside every one (movement.mjs `roomAt`'s note) - else, where the region
 * cannot be asked, its polygon tree, else its box. A region with a hole answers no for a point in the hole, which is
 * what a GM who drew the hole meant. A point both zones hold is on the line between them and on neither side (`line`):
 * the Scenes tab has warned the GM of the overlap. Whether v14's regions answer this way with holes and Levels in the
 * hall is LIVE-E73-01.
 */

import { MODULE_ID } from "./config.mjs";
import { sceneRoles, trialScene } from "./rooms.mjs";

/** The two zones' keys, in the order they are named: Zone A, Zone B. */
export const ZONE_SIDES = Object.freeze(["a", "b"]);

/** The zones as stored in `roles` (`sceneRoles`): `{ a, b }`, each a region id or null. Pure. */
export function storedZones(roles = sceneRoles()) {
    const zones = roles?.zones && typeof roles.zones === "object" ? roles.zones : {};
    const id = value => (typeof value === "string" && value ? value : null);
    return { a: id(zones.a), b: id(zones.b) };
}

/** The hall's two zone regions as documents, `{ a, b }`, each null when not picked or gone; both null with no hall. */
export function zoneRegions(scene = trialScene(), roles = sceneRoles()) {
    const ids = storedZones(roles);
    const get = id => (id && scene?.regions?.get?.(id)) || null;
    return { a: get(ids.a), b: get(ids.b) };
}

/** Whether the hall's zones are both there, two regions and not one: the zone modes draw and count only then. */
export function zonesReady(regions = zoneRegions()) {
    return Boolean(regions.a && regions.b && regions.a.id !== regions.b.id);
}

/** A region's box, from its shapes (rectangles, polygons, ellipses), or null. */
function boxOf(region) {
    const b = region?.bounds;
    if (b && Number.isFinite(b.x) && Number.isFinite(b.width)) return { x: b.x, y: b.y, w: b.width, h: b.height };
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of Array.from(region?.shapes ?? [])) {
        const points = Array.isArray(s?.points) && s.points.length >= 2 ? s.points
            : Number.isFinite(s?.width) ? [s.x, s.y, s.x + s.width, s.y + s.height]
                : Number.isFinite(s?.radiusX) ? [s.x - s.radiusX, s.y - s.radiusY, s.x + s.radiusX, s.y + s.radiusY] : [];
        for (let i = 0; i + 1 < points.length; i += 2) {
            x0 = Math.min(x0, points[i]); y0 = Math.min(y0, points[i + 1]);
            x1 = Math.max(x1, points[i]); y1 = Math.max(y1, points[i + 1]);
        }
    }
    return Number.isFinite(x0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

/**
 * Whether `region` holds the point (`x`, `y`) at `elevation`: `testPoint` where the region can be asked, else its
 * polygon tree, else its box (the module's own chain, movement.mjs `piecesAt`; a region asked that says no is outside).
 */
export function regionHolds(region, x, y, elevation = 0) {
    if (!region) return false;
    if (typeof region.testPoint === "function") {
        try {
            return Boolean(region.testPoint({ x, y, elevation: Number.isFinite(elevation) ? elevation : 0 }));
        } catch {
            // A region that throws on the question is asked the next way.
        }
    }
    const tree = region.polygonTree;
    if (typeof tree?.testPoint === "function") return Boolean(tree.testPoint({ x, y }));
    const b = boxOf(region);
    return Boolean(b) && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
}

/**
 * Which zone the point is in: "a", "b", "line" when both hold it, or null. `regions` is `zoneRegions`' answer. Pure
 * over the regions handed in.
 */
export function zoneAt(regions, x, y, elevation = 0) {
    const inA = regionHolds(regions?.a, x, y, elevation);
    const inB = regionHolds(regions?.b, x, y, elevation);
    if (inA && inB) return "line";
    return inA ? "a" : inB ? "b" : null;
}

/** A token's centre on its scene: its own `center` where it has one, else from its size and the scene's grid. */
export function tokenCentre(tokenDoc) {
    const c = tokenDoc?.center;
    if (c && Number.isFinite(c.x) && Number.isFinite(c.y)) return { x: c.x, y: c.y };
    const size = tokenDoc?.parent?.grid?.size ?? 100;
    return { x: (Number(tokenDoc?.x) || 0) + ((Number(tokenDoc?.width) || 1) * size) / 2,
        y: (Number(tokenDoc?.y) || 0) + ((Number(tokenDoc?.height) || 1) * size) / 2 };
}

/**
 * Which zone a token stands in (`zoneAt`'s answers). The region's own list of the tokens inside it first, when exactly
 * one of the two zones names the token - v14 keeps it as tokens move; then the centre, asked as `zoneAt` asks.
 */
export function tokenZone(regions, tokenDoc) {
    if (!tokenDoc) return null;
    const lists = ZONE_SIDES.map(side => {
        const list = regions?.[side]?.tokens;
        return typeof list?.has === "function" ? list.has(tokenDoc) : null;
    });
    if (lists[0] !== null && lists[1] !== null && lists[0] !== lists[1]) return lists[0] ? "a" : "b";
    const { x, y } = tokenCentre(tokenDoc);
    return zoneAt(regions, x, y, Number(tokenDoc.elevation) || 0);
}

/*
 * WHETHER THE ZONES COVER THE HALL (E73 C1; Q-E73-4). A point at the centre of every grid square of the scene's own
 * rectangle (`dimensions.sceneRect`, the padding left out) is asked `zoneAt`: one in neither zone is a gap, one in both
 * an overlap. A gridless hall has no squares, so a 50 px lattice stands in, and its count can be large: past
 * `budgetMs` (200 ms) the sampling stops and the answer says it was not checked, rather than claim a coverage it did
 * not read. The squares are sampled, not the shapes compared: a sliver narrower than a square between two zones can be
 * missed, and the warning says "part of the hall", never how much. A gridded hall is sampled whole, whatever it costs:
 * a 100 x 100 grid is 10 000 points, measured at 9-14 ms headless on 12.11 (R3901's planted hall).
 */
export const COVERAGE = Object.freeze({ gridlessStep: 50, budgetMs: 200 });

/** `{ checked, gap, overlap, samples }` for the two zones on `scene`. Null when either zone is missing. */
export function zoneCoverage(scene, regions = zoneRegions(scene), { budgetMs = COVERAGE.budgetMs, now = () => performance.now() } = {}) {
    if (!scene || !regions?.a || !regions?.b) return null;
    const rect = scene.dimensions?.sceneRect ?? { x: 0, y: 0, width: scene.width ?? 0, height: scene.height ?? 0 };
    const gridless = Number(scene.grid?.type) === 0;
    const step = gridless ? COVERAGE.gridlessStep : Math.max(Number(scene.grid?.size) || 100, 1);
    const started = now();
    let gap = false, overlap = false, samples = 0;
    for (let y = rect.y + step / 2; y < rect.y + rect.height; y += step) {
        for (let x = rect.x + step / 2; x < rect.x + rect.width; x += step) {
            const side = zoneAt(regions, x, y, 0);
            samples++;
            if (side === null) gap = true;
            else if (side === "line") overlap = true;
            if (gap && overlap) return { checked: true, gap, overlap, samples };
            if (gridless && samples % 256 === 0 && now() - started > budgetMs) return { checked: false, gap, overlap, samples };
        }
    }
    return { checked: true, gap, overlap, samples };
}

/**
 * What is wrong with the zones picked for `hall` - the Scenes tab's, the Scenes report's and the Pre-season check's
 * warnings (`sceneReport`'s `zones`): a list of keys of `DRPG.TrialScene.zones.<key>`, empty when both are right.
 * `zonesNone` neither picked; `zoneMissing` one picked and one not, or a picked region gone; `zonesSame` one region for
 * both; `zonesOverlap`, `zonesGap`, `zonesUnchecked` from `zoneCoverage`. Pure over what it is handed.
 */
export function zoneWarnings(hall, roles = sceneRoles(), { coverage = null } = {}) {
    if (!hall) return [];
    const ids = storedZones(roles);
    if (!ids.a && !ids.b) return ["zonesNone"];
    if (ids.a && ids.a === ids.b) return ["zonesSame"];
    const regions = zoneRegions(hall, roles);
    if (!regions.a || !regions.b) return ["zoneMissing"];
    const read = coverage ?? zoneCoverage(hall, regions);
    const out = [];
    if (read?.overlap) out.push("zonesOverlap");
    if (read?.gap) out.push("zonesGap");
    if (read && !read.checked) out.push("zonesUnchecked");
    return out;
}

/** The regions of `hall` a GM may pick as a zone: every region that is not a room (rooms.mjs: the hall holds none). */
export function zoneCandidates(hall) {
    return Array.from(hall?.regions ?? [])
        .filter(region => region?.getFlag?.(MODULE_ID, "room") !== true)
        .sort((x, y) => String(x.name ?? "").localeCompare(String(y.name ?? "")));
}
