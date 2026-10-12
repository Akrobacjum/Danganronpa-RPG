/**
 * Danganronpa RPG - the notice history: what this browser showed this user, kept to the season's reset.
 * ---------------------------------------------------------------------------
 * WHY (E81, A7; audit S16-08). A card closed was a card gone: a player who clicked a
 * whisper away, or reloaded, could not read again what the module had told them. The
 * owner's answers (07.10 and 11.10.2026): the GM has the same history (Q0), it lasts to
 * the season's reset (Q1), and on a browser several accounts share every account's
 * history stays in the one value until that reset (Q9, "Bierzemy alternatywę").
 *
 * WHAT IT IS. One client setting, `SETTINGS.noticeHistory`, whose value is
 *
 *     { v: 1, sections: { "<world id>.<user id>": Section } }
 *
 * keyed by world and user as `readableKey` keys the readable rolls (private-rolls.mjs),
 * and a section is `{ epoch, touched, clearedAt, gone: { id: at }, entries: [] }`. It is
 * written only by this client, from what this client drew: no packet, no socket, no
 * document. A registered setting rather than a raw localStorage key, so the suite's world
 * dump reads it (R159); the runner holds it for the length of tier 2 (R473).
 *
 * THIS COMMIT (E81 C1) IS THE STORE. Nothing records into it yet: `showPopup`'s recorder
 * is C3, the direct calls and `sayNotDone` C4, the marks C5, giving way to the other
 * stores C6, the cleaning of a snapshot C2 and the window C7. What is here:
 * - the entry's shape and its budgets (a JSON length, never a byte count: the engine
 *   cannot read what a browser's quota counts);
 * - the epoch: a section written before the season's last reset is cleared when it is
 *   next read, every account's section of this world alike (Q9: the one road by which an
 *   absent account's history goes);
 * - the merge with another tab's write, with tombstones and an upsert by message and
 *   source, and the debounced write that flushes at once when the page hides;
 * - the suite's hold, under which nothing reaches the setting (`holdNoticeHistory`).
 *
 * WHAT ANOTHER LOGIN CAN READ. Every account's section is in one value of this browser's
 * storage, so anybody at this browser's console reads every section in it, a GM's and a
 * killer's included. The owner accepted that on 11.10.2026 (Q9); the GM's handbook is to
 * say so (E81 C15), and the window (E81 C7) is to draw only this login's section.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS, getClock, moduleLanguage } from "./settings.mjs";
import { debug, warn } from "./utils.mjs";

const FORMAT = 1;

/** A document id as Foundry makes them (`randomID()`): the shape an entry's `id`, `messageId` and `author` must have. */
const ID = /^[A-Za-z0-9]{16}$/;
/* A card's kind and tone, as a word. The closed lists are popup.mjs's (`KINDS`, `TONES`), and checking an entry
   read back against them is C2's, with the cleaning (census: the console's road). */
const WORD = /^[A-Za-z][\w-]{0,31}$/;

/** Where an entry came from (the A7 design, P1-1). `author` is kept only for "player". */
export const NOTICE_SOURCES = Object.freeze(["mine", "public", "player", "messenger", "evidence", "summary", "safeword", "notDone"]);
const STATES = ["open", "read", "unread"];
const MARKS = [null, "rerolled", "settled", "deleted"];

/**
 * The reset groups whose cut moves the epoch (the A7 design, 1c): a reset that clears the clock, the
 * incident, the cards or the rest of the chat log ends what the history is a history of; one that clears
 * only, say, the remnants does not. R297 holds each to a key of `RESET_GROUPS` (season-exceptions.mjs).
 */
export const EPOCH_GROUPS = Object.freeze(["clock", "incident", "cards", "chatRest"]);

/** The texts an entry or the store's state carries; the window (E81 C7) draws them. */
export const NOTICE_TEXTS = Object.freeze({ notSaved: "DRPG.Notices.notSaved", clipped: "DRPG.Notices.clipped" });

/*
 * THE BUDGETS (the A7 design, 1a), in characters of JSON. An entry is at most 10 000 with
 * at most 8 000 of html, a day summary 26 000 with 24 000 (a GM's summary table reaches
 * 26 000 characters, the design's reading); an entry over its limit keeps its title and
 * text and drops the html (`clipped`). A player's section keeps 250 entries and 200 000
 * characters, a GM's 150 and 100 000; the whole value 500 000. A section holds at most 4
 * full day summaries (E37 gives one at every boundary of a time of day), and at most 40
 * cards from each player author. None of these is a measurement of a browser's quota:
 * localStorage is shared with the private cards and the GM stores, and C6 is to make the
 * history give way to them when it runs out.
 */
const BUDGET = Object.freeze({
    title: 200, text: 600,
    entry: 10000, entryHtml: 8000, summary: 26000, summaryHtml: 24000,
    player: Object.freeze({ entries: 250, chars: 200000 }),
    gm: Object.freeze({ entries: 150, chars: 100000 }),
    total: 500000, perAuthor: 40, fullSummaries: 4
});
/* A tombstone outlives any tab's unsaved copy of what it buried: the write is debounced 400 ms and
   flushed when a page hides, so ten minutes is the design's margin, not a measured one. */
const TOMBSTONE_MS = 10 * 60 * 1000;
const DEBOUNCE_MS = 400;

const isPlain = v => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const num = v => (Number.isFinite(v) ? v : 0);
const str = v => (typeof v === "string" ? v : "");
const clip = (text, max) => (text.length > max ? text.slice(0, max) : text);
const worldOfKey = key => key.slice(0, key.lastIndexOf("."));

/**
 * The epoch: which season's reset a section was written after, as a JSON fingerprint of the clock's
 * `seasonStartedAt` and the cuts of `EPOCH_GROUPS` (`resetCutPatch`, season-exceptions.mjs, moves
 * `seasonStartedAt` with the clock group only). An entry's `at` is never compared with a cut: a cut is a
 * GM's stamp, `at` this browser's clock.
 */
export function noticeEpoch(clock) {
    const cuts = isPlain(clock?.resetCuts) ? clock.resetCuts : {};
    return JSON.stringify([num(clock?.seasonStartedAt), ...EPOCH_GROUPS.map(group => num(cuts[group]))]);
}

/**
 * One engine over one environment, as `createGmStoreEngine` is (gm-store.mjs), so R292 runs it on a
 * value in memory.
 *
 * env: worldId(), userId(), isGM(), now(), randomId(), clock() -> the campaign clock,
 * userExists(id), storage { read() -> the stored value as JSON text or null, write(value) -> Promise },
 * timers { set(fn, ms), clear(handle) }, log { warn, debug }.
 */
export function createNoticeEngine(env) {
    let opened = false;
    let ownKey = null;
    let mine = null;               // this login's section, as this client holds it
    const pending = [];            // recorded before `ready`, when the clock (and so the epoch) is not read yet
    let held = 0;                  // the suite's hold, nested
    let saving = true;             // false: the value is kept in memory only (a write failed twice, or a newer format)
    let timer = null;
    let flushing = null, again = false;
    const listeners = new Set();

    const epochNow = () => noticeEpoch(env.clock());
    const emptySection = () => ({ epoch: epochNow(), touched: 0, clearedAt: 0, gone: {}, entries: [] });
    const changed = () => { for (const fn of listeners) { try { fn(); } catch (err) { env.log.debug("A notice history listener threw", err); } } };

    /* ------------------------------ reading ------------------------------ */

    function normalizeEntry(raw) {
        if (!isPlain(raw) || !ID.test(raw.id) || !(Number.isFinite(raw.at) && raw.at > 0)) return null;
        const mark = raw.mark ?? null, messageId = raw.messageId ?? null, tone = raw.tone ?? null;
        if (!NOTICE_SOURCES.includes(raw.source) || !STATES.includes(raw.state) || !MARKS.includes(mark)) return null;
        if (messageId !== null && !ID.test(messageId)) return null;
        if (!WORD.test(raw.kind) || (tone !== null && !WORD.test(tone))) return null;
        const clock = isPlain(raw.clock) ? raw.clock : {};
        const entry = {
            id: raw.id, at: raw.at, messageId, kind: raw.kind, tone, source: raw.source, state: raw.state, mark,
            title: clip(str(raw.title), BUDGET.title), text: clip(str(raw.text), BUDGET.text), html: str(raw.html),
            clipped: raw.clipped === true,
            clock: {
                chapter: num(clock.chapter), day: num(clock.day), session: num(clock.session),
                timeOfDay: clip(str(clock.timeOfDay), 32), eclipse: clock.eclipse === true
            }
        };
        if (raw.source === "player" && ID.test(raw.author)) entry.author = raw.author;
        if (isPlain(raw.link) && ID.test(raw.link.messenger) && env.userExists(raw.link.messenger)) entry.link = { messenger: raw.link.messenger };
        return fit(entry);
    }

    /** An entry over its budget keeps its title and text and loses its html (`clipped`). */
    function fit(entry) {
        const summary = entry.source === "summary";
        if (entry.html.length > (summary ? BUDGET.summaryHtml : BUDGET.entryHtml)
            || JSON.stringify(entry).length > (summary ? BUDGET.summary : BUDGET.entry)) return { ...entry, html: "", clipped: true };
        return entry;
    }

    function normalizeSection(raw) {
        if (!isPlain(raw)) return null;
        const gone = {};
        if (isPlain(raw.gone)) for (const [id, at] of Object.entries(raw.gone)) if (ID.test(id) && Number.isFinite(at) && at > 0) gone[id] = at;
        const seen = new Set(), entries = [];
        for (const entry of (Array.isArray(raw.entries) ? raw.entries : []).map(normalizeEntry)) {
            if (!entry || seen.has(entry.id)) continue;
            seen.add(entry.id);
            entries.push(entry);
        }
        return { epoch: str(raw.epoch), touched: num(raw.touched), clearedAt: num(raw.clearedAt), gone, entries: entries.sort((a, b) => a.at - b.at) };
    }

    /**
     * The stored value, every section of another world or another account as it was written - never
     * read into this login's history, only weighed for the budget and epoch-checked in this world. A value
     * in another format: one a newer build wrote is left alone (this client keeps its own in memory), any
     * other is read as empty and replaced at the next write.
     */
    function readValue() {
        let raw = null;
        try {
            raw = env.storage.read();
        } catch (err) {
            env.log.debug("Could not read the notice history", err);
        }
        let value = raw;
        if (typeof raw === "string") {
            try { value = JSON.parse(raw); } catch { value = null; }
        }
        if (!isPlain(value)) return { sections: {} };
        if (Number.isInteger(value.v) && value.v > FORMAT) return { sections: {}, newer: true };
        if (value.v !== FORMAT || !isPlain(value.sections)) return { sections: {} };
        return { sections: { ...value.sections } };
    }

    /**
     * Clears what the season's reset ended: every section of this world whose epoch is not the clock's,
     * this login's included (the owner's Q9: the reset is the one road by which an absent account's
     * history goes). Answers whether anything was taken.
     */
    function applyEpoch(value) {
        const world = env.worldId(), epoch = epochNow();
        let taken = false;
        for (const [key, section] of Object.entries(value.sections)) {
            if (worldOfKey(key) !== world || (isPlain(section) && section.epoch === epoch)) continue;
            delete value.sections[key];
            taken = true;
        }
        return taken;
    }

    /* ------------------------------- merging ------------------------------ */

    /**
     * Another tab's copy of this login's section into this one: the union by id (this tab's copy of an
     * entry both hold wins), one entry per message and source (the newest), nothing at or before the
     * last Clear and nothing buried; tombstones older than ten minutes let go.
     */
    function mergeInto(into, theirs) {
        if (theirs) {
            into.clearedAt = Math.max(into.clearedAt, theirs.clearedAt);
            for (const [id, at] of Object.entries(theirs.gone)) into.gone[id] = Math.max(into.gone[id] ?? 0, at);
            const ids = new Set(into.entries.map(entry => entry.id));
            for (const entry of theirs.entries) if (!ids.has(entry.id)) into.entries.push(entry);
        }
        const now = env.now();
        for (const [id, at] of Object.entries(into.gone)) if (now - at > TOMBSTONE_MS) delete into.gone[id];
        const newest = new Map();
        for (const entry of into.entries) {
            if (entry.messageId === null) continue;
            const pair = `${entry.messageId}|${entry.source}`;
            if (!newest.has(pair) || newest.get(pair).at <= entry.at) newest.set(pair, entry);
        }
        into.entries = into.entries
            .filter(entry => entry.at > into.clearedAt && !Object.hasOwn(into.gone, entry.id)
                && (entry.messageId === null || newest.get(`${entry.messageId}|${entry.source}`) === entry))
            .sort((a, b) => a.at - b.at);
    }

    /* ------------------------------- budgets ------------------------------ */

    const sizeOf = value => JSON.stringify(value).length;

    function trimSection(section) {
        let full = 0;
        for (let i = section.entries.length - 1; i >= 0; i--) {
            const entry = section.entries[i];
            if (entry.source !== "summary" || entry.clipped) continue;
            if (++full > BUDGET.fullSummaries) section.entries[i] = { ...entry, html: "", clipped: true };
        }
        /* Newest first, so the oldest of an author over 40 go. */
        const kept = new Map(), drop = new Set();
        for (let i = section.entries.length - 1; i >= 0; i--) {
            const entry = section.entries[i];
            if (entry.source !== "player" || !entry.author) continue;
            const n = (kept.get(entry.author) ?? 0) + 1;
            kept.set(entry.author, n);
            if (n > BUDGET.perAuthor) drop.add(entry);
        }
        if (drop.size) section.entries = section.entries.filter(entry => !drop.has(entry));
        const cap = env.isGM() ? BUDGET.gm : BUDGET.player;
        if (section.entries.length > cap.entries) section.entries.splice(0, section.entries.length - cap.entries);
        let size = sizeOf(section);
        while (size > cap.chars && section.entries.length) size -= sizeOf(section.entries.shift()) + 1;
    }

    /**
     * The whole value over 500 000: other worlds' sections go first, the least recently written first;
     * then this world's other accounts' sections, the same way (the A7 design, 1b); then this login's
     * oldest entries.
     */
    function trimValue(value) {
        let size = sizeOf(value);
        if (size <= BUDGET.total) return;
        const world = env.worldId();
        const byTouched = (a, b) => num(a[1]?.touched) - num(b[1]?.touched);
        const others = Object.entries(value.sections).filter(([key]) => key !== ownKey);
        for (const [key] of [...others.filter(([key]) => worldOfKey(key) !== world).sort(byTouched),
            ...others.filter(([key]) => worldOfKey(key) === world).sort(byTouched)]) {
            if (size <= BUDGET.total) return;
            delete value.sections[key];
            size = sizeOf(value);
        }
        while (size > BUDGET.total && mine.entries.length) {
            size -= sizeOf(mine.entries.shift()) + 1;
            value.sections[ownKey] = mine;
        }
    }

    /* ------------------------------- writing ------------------------------ */

    function schedule() {
        if (held || !saving || timer !== null) return;
        timer = env.timers.set(() => { timer = null; void flush(); }, DEBOUNCE_MS);
    }

    /**
     * Read the stored value afresh, clear what the epoch ended, merge this login's section in, keep the
     * budgets and write. This login's section missing from the value (another account's write, or a
     * console) is written again from memory. A write that throws drops the oldest quarter and tries once
     * more; a second failure keeps the history in memory for the rest of the session (`status`), with no
     * notification: the window's footer says it (E81 C7).
     */
    async function flush() {
        if (timer !== null) { env.timers.clear(timer); timer = null; }
        if (!opened || held || !saving) return;
        if (flushing) { again = true; return flushing; }
        flushing = (async () => {
            const value = readValue();
            if (value.newer) {
                saving = false;
                env.log.warn("The notice history is stored in a newer format by another build; this one keeps it in memory only.");
                changed();
                return;
            }
            applyEpoch(value);
            if (mine.epoch !== epochNow()) mine = emptySection();
            const theirs = normalizeSection(value.sections[ownKey]);
            mergeInto(mine, theirs?.epoch === mine.epoch ? theirs : null);
            trimSection(mine);
            mine.touched = env.now();
            value.sections[ownKey] = mine;
            trimValue(value);
            for (let attempt = 0; ; attempt++) {
                try {
                    await env.storage.write({ v: FORMAT, sections: value.sections });
                    return;
                } catch (err) {
                    if (attempt) {
                        saving = false;
                        env.log.warn("The notice history could not be saved in this browser; it is kept in memory until this page closes.", err);
                        changed();
                        return;
                    }
                    mine.entries.splice(0, Math.ceil(mine.entries.length / 4));
                    value.sections[ownKey] = mine;
                }
            }
        })();
        try {
            await flushing;
        } finally {
            flushing = null;
        }
        if (again) {
            again = false;
            await flush();
        }
    }

    /* ------------------------------- the API ------------------------------ */

    /**
     * At `ready`, when the clock is read: this login's section from the value, cleared if the season was
     * reset since; what was open when the page went is unread now (it was on screen, and is not); every
     * section of this world the reset ended is taken out at the next write. Nothing of another account's
     * section is touched otherwise (Q9).
     */
    function open({ atReady = true } = {}) {
        opened = true;
        ownKey = `${env.worldId()}.${env.userId()}`;
        const value = readValue();
        if (value.newer) saving = false;
        let dirty = applyEpoch(value);
        const stored = normalizeSection(value.sections[ownKey]);
        mine = stored ?? emptySection();
        for (const entry of atReady ? mine.entries : []) {
            if (entry.state !== "open") continue;
            entry.state = "unread";
            dirty = true;
        }
        for (const entry of pending.splice(0)) add(entry);
        if (dirty) schedule();
        changed();
    }

    function add(entry) {
        if (mine.epoch !== epochNow()) mine = emptySection();
        /* `at <= clearedAt` is what a merge refuses, so nothing recorded after a Clear may share its millisecond. */
        entry.at = Math.max(entry.at, mine.clearedAt + 1);
        if (entry.messageId !== null) mine.entries = mine.entries.filter(e => e.messageId !== entry.messageId || e.source !== entry.source);
        mine.entries.push(entry);
        trimSection(mine);
        schedule();
    }

    /**
     * Keep one notice (E81 C3 and C4 call it; the entry's shape is the A7 design's P1-1). `id`, `at` and
     * `clock` are this client's: `at` is `Date.now()` here whatever the caller passes, never a packet's
     * (the lesson of E02-D08). Answers the entry's id, or null for an entry the shape refuses.
     */
    function record(input = {}) {
        const clock = env.clock() ?? {};
        const entry = normalizeEntry({
            id: env.randomId(), at: env.now(), messageId: input.messageId ?? null, kind: input.kind ?? "info", tone: input.tone ?? null,
            source: input.source, state: input.state ?? "open", mark: null, title: input.title, text: input.text, html: input.html,
            clipped: false, author: input.author, link: input.link,
            clock: { chapter: clock.chapter, day: clock.day, session: clock.session, timeOfDay: clock.timeOfDay, eclipse: clock.eclipse }
        });
        if (!entry) {
            env.log.debug("A notice the history's shape refuses was not kept", input);
            return null;
        }
        if (!opened) pending.push(entry);
        else add(entry);
        changed();
        return entry.id;
    }

    return {
        open,
        record,
        flush,
        /** This login's entries, oldest first, as copies. */
        entries: () => structuredClone(mine?.entries ?? pending),
        /** Clear: nothing kept so far comes back from another tab (`clearedAt` and a tombstone each). */
        clear() {
            if (!mine) return;
            const now = env.now();
            for (const entry of mine.entries) mine.gone[entry.id] = now;
            mine.clearedAt = Math.max(now, mine.clearedAt);
            mine.entries = [];
            schedule();
            changed();
        },
        /** Take one entry out (E81 C5's withdraw): a tombstone, so another tab's copy does not bring it back. */
        remove(id) {
            if (!mine || !mine.entries.some(entry => entry.id === id)) return false;
            mine.gone[id] = env.now();
            mine.entries = mine.entries.filter(entry => entry.id !== id);
            schedule();
            changed();
            return true;
        },
        /** Another tab wrote the value (the `storage` event): its copy of this login's section merged in, nothing written. */
        external() {
            if (!opened) return;
            const value = readValue();
            const theirs = normalizeSection(value.sections[ownKey]);
            if (mine.epoch !== epochNow()) mine = emptySection();
            mergeInto(mine, theirs?.epoch === mine.epoch ? theirs : null);
            changed();
        },
        /** The clock changed: a reset since this section was written clears it now, and the others at the write. */
        checkEpoch() {
            if (!opened || mine.epoch === epochNow()) return false;
            mine = emptySection();
            schedule();
            changed();
            return true;
        },
        /**
         * The suite's hold (tests.mjs, beside `gmStoreHold`): what was waiting is written first (the
         * promise answered settles when it is, so the runner reads the setting after it), then nothing is
         * until the hold is let go; let go, the memory is what the setting holds, and whatever a test
         * recorded meanwhile is forgotten.
         */
        hold(on) {
            if (on) {
                const waiting = !held && (timer !== null || flushing) ? flush() : null;
                held++;
                return waiting ?? Promise.resolve();
            }
            if (held && !--held && opened) open({ atReady: false });
            return Promise.resolve();
        },
        status: () => ({ saving, note: saving ? null : NOTICE_TEXTS.notSaved }),
        onChange(fn) {
            listeners.add(fn);
            return () => listeners.delete(fn);
        }
    };
}

/* ------------------------------------------------------------------------ *
 * The module's engine, over the real Foundry.
 * ------------------------------------------------------------------------ */

const engine = createNoticeEngine({
    worldId: () => String(game.world?.id ?? ""),
    userId: () => String(game.user?.id ?? ""),
    isGM: () => Boolean(game.user?.isGM),
    now: () => Date.now(),
    randomId: () => foundry.utils.randomID(16),
    clock: () => getClock(),
    userExists: id => Boolean(game.users?.get(id)),
    storage: {
        read: () => game.settings?.storage?.get?.("client")?.getItem?.(`${MODULE_ID}.${SETTINGS.noticeHistory}`) ?? null,
        write: value => game.settings.set(MODULE_ID, SETTINGS.noticeHistory, value)
    },
    timers: { set: (fn, ms) => setTimeout(fn, ms), clear: handle => clearTimeout(handle) },
    log: { warn: (...a) => warn(...a), debug: (...a) => debug(...a) }
});

/**
 * Keep one notice in this browser's history: the one road into it for E81's recorder (C3) and direct
 * calls (C4), and for E18, E50, E62 and E70 after it, which take this interface as it is.
 */
export const recordNotice = entry => engine.record(entry);
/** This login's notices, oldest first (the window, E81 C7). */
export const noticeEntries = () => engine.entries();
/** Whether the history is saved, or kept in memory only, and the text that says so. */
export const noticeHistoryStatus = () => engine.status();
/** Run `fn` whenever this login's history changes here or in another tab (the window and the badge, E81 C7 and C8). */
export const onNoticeHistoryChange = fn => engine.onChange(fn);
/** Suite only (tests.mjs, beside `gmStoreHold`): while held the history is kept in memory and the setting is not written; awaited, the hold has written what was waiting. */
export const holdNoticeHistory = on => engine.hold(on);

/**
 * A notice's time of day as the module's language writes it. The interface E66 takes over: its date
 * helper replaces this body, and every caller keeps the call.
 */
export function noticeTime(at) {
    return new Intl.DateTimeFormat(moduleLanguage(), { hour: "2-digit", minute: "2-digit" }).format(new Date(at));
}

/**
 * Called from `init`, after the popups: the history opens at `ready` (the clock, and so the epoch, is
 * read then), follows another tab's writes and the clock's resets, and writes what waits at once when
 * the page hides - a reload right after a card would otherwise lose it to the debounce. Whether Foundry
 * 14's client setting reaches localStorage before `pagehide` returns is the design's reading of
 * Foundry's client-settings.mjs, not measured here (LIVE-E81-03).
 */
export function registerNoticeHistory() {
    Hooks.once("ready", () => engine.open());
    Hooks.on("updateSetting", setting => {
        if (setting?.key === `${MODULE_ID}.${SETTINGS.clock}`) engine.checkEpoch();
    });
    window.addEventListener("storage", event => {
        if (event.key === `${MODULE_ID}.${SETTINGS.noticeHistory}`) engine.external();
    });
    window.addEventListener("pagehide", () => { void engine.flush(); });
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") void engine.flush();
    });
}
