/**
 * Danganronpa RPG — the 1.2.0 data migration.
 * ---------------------------------------------------------------------------
 * The Sweet & Sound update changes the SHAPE of saved data in five places: the
 * trial playlist mapping, the seeding of stashes, the old motive record, the
 * safeword, and the `stashRoom` flag on items. Five separate "remember to run
 * this" notes is how a world ends up half-migrated and nobody able to say which
 * half, so there is one function here instead, and every stage that changes a
 * saved shape appends its clause to `CLAUSES` below.
 *
 * WHY IT COMPARES VERSIONS INSTEAD OF ASKING "HAS 1.2.0 RUN YET".
 *
 * A boolean stamp would be wrong for exactly the way this update is being
 * built. It ships as a ladder of test builds — 1.1.1, 1.1.2, and so on, one per
 * stage — and a new clause arrives with almost every rung. A world that ran an
 * empty migration at 1.1.1 and stamped "done" would never see a single clause
 * added afterwards, and would look perfectly migrated while being nothing of
 * the kind.
 *
 * So the stamp holds the module version the migration last completed under, and
 * the set runs again whenever the manifest has moved. That costs a handful of
 * reads on a world that is already current and it heals one that was upgraded
 * halfway. It is only affordable because of the next rule.
 *
 * EVERY CLAUSE IS IDEMPOTENT, AND THAT IS NOT A NICETY.
 *
 * A clause checks whether it has anything to do and leaves if it does not.
 * Running the whole set twice must change nothing the second time. This is the
 * only property that makes the function safe to re-run by hand when something
 * has gone wrong, which is the one moment anybody will actually want it.
 *
 * IT MEASURES INSTEAD OF BELIEVING.
 *
 * Each clause returns what it changed and the report carries it up. A migration
 * that returns `true` cannot be checked, and in this Foundry it cannot even be
 * trusted: deleting a key with the `-=key` syntax can be accepted and do
 * nothing at all. Any clause that REMOVES something has to verify by reading it
 * back, not by the write having resolved.
 *
 * Silent when it changed nothing. It runs at `ready` on the primary GM's client
 * every time the version moves, and a migration that announces itself every
 * session is one people learn to click past.
 */

import { MODULE_ID, moduleVersion } from "./config.mjs";
import { SETTINGS, getSetting, setSetting } from "./settings.mjs";
import { log, error, isPrimaryGm, plural } from "./utils.mjs";

/**
 * One entry per saved shape this update changes.
 *
 * Each stage that changes a saved shape appends here rather than writing its
 * own migration somewhere else. Keep the entries in the order the stages run:
 * a later clause is allowed to assume the earlier ones have been through.
 *
 *   key    stable identifier, used in the report and in the console
 *   since  the build that introduced the clause — the first question anybody
 *          debugging a half-migrated world asks is "when did this appear"
 *   run    async () => object|null. Return what changed, or `null` for
 *          "nothing to do". NEVER throw for an absent world shape; a world
 *          that has no trials yet is not an error.
 *
 * Empty at E0 by design. The five clauses named in the plan arrive with the
 * stages that need them: trial playlists (E6), stash seeding and `stashRoom`
 * (E11), the old motive record (E14) and the safeword (E15).
 *
 * A CLAUSE THAT REPAIRS SOMETHING THE BOOT PASSES HAVE ALREADY READ MUST ASK
 * THEM TO RUN AGAIN. This function is started at `ready` and not awaited, so
 * that a slow pass cannot hold the interface shut — which means `issueMissingKeys`,
 * `sealProjects` and the rest may well have read the OLD shape a moment before
 * a clause fixed it. Ordering does not solve that and pretending it does is how
 * a world ends up looking migrated and behaving as if it were not. The clause
 * that changes bedroom keys re-runs the bedroom-key pass itself; the one that
 * changes projects re-runs project secrecy. It is three lines at the bottom of
 * the clause and it is not optional.
 */
const CLAUSES = [];

/**
 * Bring this world's saved data up to the shape the installed build expects.
 *
 *     game.drpg.migrate1_2_0()                  // run if the version moved
 *     game.drpg.migrate1_2_0({ force: true })   // run regardless, for repair
 *
 * Runs by itself at `ready` on the primary GM's client — see module.mjs. The
 * manual call is the repair route, and it is why `force` exists: a world whose
 * stamp says it is current but whose data plainly is not needs a way to be told
 * to look again.
 *
 * @param {object}  [options]
 * @param {boolean} [options.force]  Run even when the stamp is already current.
 * @param {boolean} [options.quiet]  No notification, whatever happened. Used by
 *                                   the automatic pass so that a world with
 *                                   nothing to do says nothing.
 * @returns {Promise<object|null>}   The report, or `null` if it did not run.
 */
export async function migrate1_2_0({ force = false, quiet = false } = {}) {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Migrate.gmOnly"));
        return null;
    }

    const to = moduleVersion();
    const from = getSetting(SETTINGS.migratedVersion) || "";

    if (!force && from === to) {
        log(`Migration: nothing to do — this world is already at ${to}.`);
        return null;
    }

    const report = { from, to, forced: force, clauses: {}, changed: 0, failed: [] };

    for (const clause of CLAUSES) {
        try {
            const result = await clause.run();
            if (result) {
                report.clauses[clause.key] = result;
                report.changed++;
                log(`Migration: ${clause.key} (since ${clause.since}) —`, result);
            }
        } catch (err) {
            // One clause failing must not cost the others their run, and must
            // not stamp the world as migrated. A partial pass that claims to be
            // complete is worse than one that admits it stopped short.
            report.failed.push(clause.key);
            error(`Migration clause "${clause.key}" failed`, err);
        }
    }

    if (report.failed.length) {
        ui.notifications.error(game.i18n.format("DRPG.Migrate.failed", {
            clauses: report.failed.join(", ")
        }));
        log("Migration: stamp NOT written, because a clause failed.", report);
        return report;
    }

    await setSetting(SETTINGS.migratedVersion, to);

    if (report.changed && !quiet) {
        ui.notifications.info(plural("DRPG.Migrate.done", {
            n: report.changed, version: to
        }));
    }
    log(`Migration: ${from || "an unstamped world"} → ${to}, `
        + `${report.changed} of ${CLAUSES.length} clause(s) had something to do.`, report);
    return report;
}

/**
 * The automatic pass, from `ready`.
 *
 * Primary GM only. Every clause writes world data, and with up to four
 * Monokumas at the table the alternative is four browsers performing the same
 * migration on the same documents at the same moment — which is not four times
 * as safe, it is one race per clause.
 */
export function runMigrationOnLoad() {
    if (!isPrimaryGm()) return;

    migrate1_2_0({ quiet: true })
        .catch(err => error("The 1.2.0 migration could not run", err));
}

/**
 * What the migration would say about this world, without writing anything.
 *
 *     game.drpg.migrationStatus()
 *
 * The question "has this world been migrated" has to be answerable without
 * migrating it — that is what makes it usable in a bug report.
 */
export function migrationStatus() {
    const from = getSetting(SETTINGS.migratedVersion) || "";
    const to = moduleVersion();
    return {
        module: MODULE_ID,
        stampedAt: from || null,
        installed: to,
        current: from === to,
        clauses: CLAUSES.map(c => ({ key: c.key, since: c.since }))
    };
}
