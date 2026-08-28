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
import { log, error, isPrimaryGm, plural, whisperToGms } from "./utils.mjs";

/**
 * The chime the messenger played from a hard-coded path until E2, and which
 * E2's first migration clause then wrote into the sound map as a default.
 *
 * IT IS NOT A DEFAULT ANY MORE (Dawid, 28.08 — no default sounds; the GM
 * assigns every file). Kept only as the fingerprint of that seed, so the clause
 * below can take back exactly what was put in and nothing else.
 */
const SEEDED_CHIME = "sounds/notify.wav";

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
 * Empty at E0 by design. The clauses named in the plan arrive with the stages
 * that need them: the messenger chime (E2, and then taken back out again by the
 * same clause), trial playlists (E6), stash seeding and `stashRoom` (E11), the
 * old motive record (E14) and the safeword (E15).
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
        key: "unseedMessengerChime",
        since: "1.1.10",
        /*
         * THE MODULE HAS NO DEFAULT SOUNDS, AND THIS UNDOES THE ONE IT HAD.
         *
         * E2 seeded `chatReceive` with the path the messenger used to hard-code,
         * so that no world in play went quiet. Dawid's rule (28.08) is simpler
         * and better: the module ships no audio and assigns none either — every
         * file is the GM's choice, made in the Sound panel, and Season setup now
         * has a row telling them so. A mapping the module wrote is a mapping
         * nobody chose, and on a table that never wanted that chime it is a
         * sound arriving from nowhere.
         *
         * REMOVES ONLY WHAT IT PUT THERE. The value is compared against the
         * seeded path first: a GM who has since pointed the event at their own
         * file keeps it. A GM who deliberately chose that same Foundry file
         * loses it once and can pick it again — the two are indistinguishable
         * from here, and of the two mistakes this is the recoverable one.
         *
         * Deletes the key rather than blanking it, through the same write the
         * panel uses: "never assigned" and "assigned to nothing" have to stay
         * one state, and `-=key` cannot be trusted to remove anything in this
         * Foundry — so the whole object is written back and read back.
         */
        run: async () => {
            const map = getSetting(SETTINGS.sfxMap) ?? {};
            if (map.chatReceive !== SEEDED_CHIME) return null;

            const next = { ...map };
            delete next.chatReceive;
            await setSetting(SETTINGS.sfxMap, next);

            // Read back, because a clause that REMOVES something cannot take
            // the write having resolved as proof — see the header.
            const after = getSetting(SETTINGS.sfxMap) ?? {};
            if (after.chatReceive) throw new Error("the seeded chime is still mapped");
            return { removed: { chatReceive: SEEDED_CHIME } };
        }
    },
    {
        key: "trialMusicStates",
        since: "1.1.15",
        /*
         * THE TRIAL'S ONE MUSIC STATE BECAME THREE, AND THE OLD KEY WOULD
         * OTHERWISE BE ORPHANED.
         *
         * Before E6 the whole Class Trial was one state, `trial`, mapped to one
         * playlist. It is now `trial.objection`, `trial.debate` and
         * `trial.discussion` — and none of those is spelled `trial`, so a world
         * that had trial music chosen would have had trial SILENCE the moment it
         * updated, with a mapping still sitting in the setting pointing at a
         * state nothing tests any more. Silence that arrives with an update and
         * a setting that looks correct is the worst pair of symptoms this file
         * exists to prevent.
         *
         * IT GOES TO `trial.debate`, which is what the old state actually was:
         * `trial` tested "is the floor open", and an open floor is a debate or
         * a rebuttal in every case but one. That one — an Objection — is left
         * unmapped on purpose. Nothing mapped means the music is left alone
         * (see `apply` in music.mjs), so a GM who has not yet chosen an
         * Objection playlist keeps hearing the debate through it, which is
         * exactly what they heard before this update. The new sound is
         * something they opt into, not something the migration invents.
         *
         * Never over a choice already made: if `trial.debate` is set, the GM has
         * been in the new window and said something, and this only clears up
         * after them.
         */
        run: async () => {
            const map = getSetting(SETTINGS.musicMap) ?? {};
            if (!map.trial) return null;

            const next = { ...map };
            const kept = Boolean(next["trial.debate"]);
            if (!kept) next["trial.debate"] = map.trial;
            delete next.trial;
            await setSetting(SETTINGS.musicMap, next);

            // Read back: this clause REMOVES a key, and a resolved write is not
            // proof of that in this Foundry — see the header.
            const after = getSetting(SETTINGS.musicMap) ?? {};
            if (after.trial) throw new Error("the old trial mapping is still there");

            // The music has already decided what to play by now. `ready` starts
            // this pass without awaiting it, so `registerMusic`'s first look at
            // the world happened while the map still said `trial` — which no
            // state answers to, so it found nothing mapped and left the room
            // alone. Asking again is the three lines the header calls not
            // optional.
            try {
                const { refreshMusic } = await import("./music.mjs");
                refreshMusic();
            } catch (err) {
                // A mapping that is right but not yet acted on is fixed by the
                // next state change. Never fail the clause over it.
                error("Could not re-assert the music after moving the trial mapping", err);
            }

            return {
                movedTo: kept ? null : "trial.debate",
                keptExisting: kept,
                playlist: game.playlists?.get(map.trial)?.name ?? map.trial
            };
        }
    },
    {
        key: "seedTableRoles",
        since: "1.1.19",
        /*
         * THE TABLES A WORLD ALREADY HAS DO NOT KNOW ABOUT ROLES.
         *
         * `installTables` is idempotent on purpose — a GM's edits are never
         * overwritten — so a world that installed its tables before E8 keeps
         * entries with no `roles` flag on them, and the pools rebuilt in E9
         * (tier 2 and 3 do two jobs) reach nobody who is already playing.
         *
         * `rolesOfResult` falls back to the name map at draw time, so those
         * worlds were not broken; they were relying on a last resort that
         * breaks the moment somebody renames an entry. This writes the flag,
         * which is what the fallback exists to avoid needing.
         *
         * ONLY WHERE THE FLAG IS ABSENT. A GM who ticked "also a weapon" on
         * their own screwdriver has said something, and a migration that knows
         * better than the person who runs the game is a migration nobody should
         * trust. An empty array counts as having been said.
         */
        run: async () => {
            const { POOL_ROLES } = await import("./tables.mjs");
            const touched = [];

            for (const table of game.tables ?? []) {
                if (!table.getFlag(MODULE_ID, "category")) continue;

                const updates = [];
                for (const result of table.results ?? []) {
                    if (Array.isArray(result.getFlag(MODULE_ID, "roles"))) continue;
                    const name = result.name ?? result.text ?? "";
                    const roles = POOL_ROLES[name] ? [...POOL_ROLES[name]] : [];
                    updates.push({
                        _id: result.id,
                        [`flags.${MODULE_ID}.roles`]: roles
                    });
                }

                if (!updates.length) continue;
                try {
                    await table.updateEmbeddedDocuments("TableResult", updates);
                    touched.push(`${table.name}: ${updates.length}`);
                } catch (err) {
                    error(`Could not write roles onto "${table.name}"`, err);
                }
            }

            return touched.length ? { tables: touched.length, entries: touched } : null;
        }
    },
    {
        key: "seedItemRoles",
        since: "1.1.20",
        /*
         * AND THE THINGS PEOPLE ARE ALREADY CARRYING.
         *
         * `seedTableRoles` fixed the tables; it did nothing for the knife
         * already in somebody's pocket. An item written before E8 has no roles
         * flag, so a Crowbar a player found last session is a tool and nothing
         * else — and the sheet, which now shows what a thing can do, says so.
         *
         * Same guard as the tables: only where no flag is set. And by NAME,
         * which is the fragile way — but the item came out of a pool by that
         * name, and the alternative is leaving live inventories wrong.
         */
        run: async () => {
            const { POOL_ROLES } = await import("./tables.mjs");
            const { ITEM_FLAGS } = await import("./inventory.mjs");
            const touched = [];

            for (const actor of game.actors ?? []) {
                const updates = [];
                for (const item of actor.items) {
                    if (Array.isArray(item.getFlag(MODULE_ID, ITEM_FLAGS.roles))) continue;
                    const roles = POOL_ROLES[item.name];
                    if (!roles?.length) continue;
                    updates.push({
                        _id: item.id,
                        [`flags.${MODULE_ID}.${ITEM_FLAGS.roles}`]: [...roles]
                    });
                }

                if (!updates.length) continue;
                try {
                    await actor.updateEmbeddedDocuments("Item", updates);
                    touched.push(`${actor.name}: ${updates.length}`);
                } catch (err) {
                    error(`Could not write roles onto ${actor.name}'s items`, err);
                }
            }

            return touched.length ? { actors: touched.length, items: touched } : null;
        }
    },
    {
        key: "motiveTimer",
        since: "1.1.37",
        /*
         * TRAP 101 — A MOTIVE ANNOUNCED AT THE TABLE CANNOT VANISH MID-SESSION.
         *
         * The old record was `{ text, chapter, at }`. The new one carries a
         * deadline in times of day, a consequence, and the flag that stops the
         * deadline being announced twice. A world upgraded mid-chapter holds
         * the old shape, and every reader of the new one would find
         * `remaining` undefined — which `motive()` reads as zero, which is
         * "due". The motive would still be on screen, and it would be on
         * screen having already expired.
         *
         * REWRITTEN, NOT DELETED. The alternative was to drop the record on
         * the grounds that it has no timer, and that is exactly the wrong
         * trade: the motive was announced out loud, players have been playing
         * against it, and no data shape justifies taking it off their screens.
         *
         * The timer starts at the default and the consequence is left empty,
         * because the module does not know either — it was never asked. The
         * GM can withdraw and re-announce with the real numbers, and the
         * whisper below tells them so.
         */
        run: async () => {
            const stored = getSetting(SETTINGS.motive) ?? {};
            if (!stored.text) return null;
            if (Number.isFinite(stored.remaining) && Number.isFinite(stored.timesOfDay)) return null;

            const { MOTIVE } = await import("./config.mjs");
            const next = {
                ...stored,
                consequence: String(stored.consequence ?? ""),
                timesOfDay: MOTIVE.defaultTimesOfDay,
                remaining: MOTIVE.defaultTimesOfDay,
                dueAnnounced: false
            };
            await setSetting(SETTINGS.motive, next);

            // Read back, not believed: this clause CHANGES a shape other code
            // now depends on, and a write that resolved is not a write that
            // landed.
            const check = getSetting(SETTINGS.motive) ?? {};
            if (!Number.isFinite(check.remaining)) {
                error("The motive record could not be given a timer");
                return null;
            }

            await whisperToGms(`<p>${game.i18n.format("DRPG.Motive.migrated", {
                n: MOTIVE.defaultTimesOfDay
            })}</p>`);

            return { motive: stored.text, timesOfDay: MOTIVE.defaultTimesOfDay };
        }
    },
    {
        key: "openStudentSheets",
        since: "1.1.21",
        /*
         * CUDZA KARTA MUSI DAĆ SIĘ OTWORZYĆ, ŻEBY DAŁO SIĘ JĄ OCENZUROWAĆ.
         *
         * Before E9 every character sat at `ownership.default: NONE`, which is
         * what the old rule wanted: the sheet did not open at all. The redacted
         * view (G-44) needs the sheet to render IN FULL so it can be censored
         * in place, and OBSERVER is the level that renders everything and still
         * refuses every edit.
         *
         * So: anything below becomes OBSERVER. Anything already ABOVE it — a
         * character handed to the table as OWNER — is left alone and REPORTED
         * rather than lowered, because a GM did that on purpose; they should
         * know the redaction never runs for an owner, so on that character the
         * sheet opens whole.
         */
        run: async () => {
            const OBSERVER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
            const opened = [];
            const wideOpen = [];

            for (const actor of game.actors ?? []) {
                if (actor.type !== "character") continue;
                const level = actor.ownership?.default ?? 0;
                if (level > OBSERVER) { wideOpen.push(actor.name); continue; }
                if (level === OBSERVER) continue;

                try {
                    await actor.update({ "ownership.default": OBSERVER });
                    opened.push(actor.name);
                } catch (err) {
                    error(`Could not open ${actor.name}'s sheet to the redacted view`, err);
                }
            }

            if (wideOpen.length) {
                await whisperToGms(`<p class="drpg-warning">${game.i18n.format(
                    "DRPG.Anonymity.aboveLimited", {
                        actors: foundry.utils.escapeHTML(wideOpen.join(", "))
                    })}</p>`);
            }

            return opened.length || wideOpen.length ? { opened, wideOpen } : null;
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
