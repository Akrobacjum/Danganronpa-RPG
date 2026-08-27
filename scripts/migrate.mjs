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
 * The chime the messenger played from a hard-coded path until E2.
 *
 * A Foundry file, not one of ours — which is why seeding it is safe: it is
 * there in every installation, and the world it is being written into has been
 * hearing it all along.
 */
const MESSENGER_CHIME = "sounds/notify.wav";

/**
 * One entry per saved shape this update changes.
 *
 * Each stage that changes a saved shape appends here rather than writing its
 * own migration somewhere else. Keep the entries in the order the stages run:
 * a later clause is allowed to assume the earlier ones have been through.
 *
 *   key    stable identifier, used in the report and in the console
 *   since  the build that introduced the clause. NOT DOCUMENTATION: a clause is
 *          skipped when this world has already been stamped by a build at or
 *          after it. See the note below — this is what stops a clause that
 *          seeds a default from putting the default back every time the version
 *          moves, after a GM has deliberately removed it.
 *   run    async ({ from, to, force }) => object|null. Return what changed, or
 *          `null` for "nothing to do". NEVER throw for an absent world shape; a
 *          world that has no trials yet is not an error.
 *
 * WHY `since` GATES INSTEAD OF ANNOTATING (changed in E2).
 *
 * The stamp holds a version and this update ships a ladder of test builds, so
 * the set is re-entered on almost every rung. Idempotence makes that safe for a
 * clause that REPAIRS something — it finds nothing to do and leaves. It is not
 * enough for a clause that SEEDS something: "the mapping is missing" is true
 * both before the seed and after a GM has cleared it on purpose, and those two
 * must not be treated alike. Gating on `since` tells them apart by the one fact
 * that distinguishes them — whether this world has already been through a
 * build that carried the clause. `force: true` ignores the gate, so the repair
 * route is untouched, and that is the only moment anybody wants every clause
 * re-entered regardless.
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
const CLAUSES = [
    {
        key: "messengerChime",
        since: "1.1.8",
        /*
         * The messenger's arrival sound became a mapped event in E2, and an
         * unmapped event is silent. Left alone, every world already in play
         * would have lost a sound it had been hearing since the messenger was
         * written — a silent regression, the kind nobody reports because it
         * reads as "I must have imagined it".
         *
         * So the mapping starts life holding the exact path the code used to
         * name. The GM can point it somewhere else, or clear it, and the gate
         * on `since` is what makes clearing it stick.
         */
        run: async () => {
            const map = getSetting(SETTINGS.sfxMap) ?? {};
            if (map.chatReceive) return null;

            await setSetting(SETTINGS.sfxMap,
                { ...map, chatReceive: MESSENGER_CHIME });
            return { chatReceive: MESSENGER_CHIME };
        }
    }
];

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

    const report = {
        from, to, forced: force, clauses: {}, changed: 0, skipped: [], failed: []
    };

    for (const clause of CLAUSES) {
        // Already been through a build that carried this clause — see the note
        // on `since`. An unstamped world has been through nothing, so it runs
        // everything, which is also exactly what a brand-new world needs.
        if (!force && from && !foundry.utils.isNewerVersion(clause.since, from)) {
            report.skipped.push(clause.key);
            continue;
        }

        try {
            const result = await clause.run({ from, to, force });
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
    const considered = CLAUSES.length - report.skipped.length;
    log(`Migration: ${from || "an unstamped world"} → ${to}, `
        + `${report.changed} of ${considered} clause(s) considered had something `
        + `to do, ${report.skipped.length} already been through.`, report);
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
        // `pending` is the question the stamp alone cannot answer: a world can
        // be behind on the version and still have nothing owing.
        clauses: CLAUSES.map(c => ({
            key: c.key,
            since: c.since,
            pending: !from || foundry.utils.isNewerVersion(c.since, from)
        }))
    };
}
