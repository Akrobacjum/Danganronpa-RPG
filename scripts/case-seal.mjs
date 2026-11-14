/**
 * Danganronpa RPG - the case's sealed copy in the world (E111, 14.11.2026).
 * ---------------------------------------------------------------------------
 * WHY (the owner, 14.11.2026): "Planer zagadki powinien przechowywac dane w przegladarce gmow i byc wspolny dla
 * kazdego gma" - the owner opened the world alone from another computer and the Key Remnant plan and the case schema
 * were not there. The case lives in the GMs' browsers (gm-store.mjs), and browsers bring each other up to date only
 * while two of them are online together; a world setting would reach every browser, a player's among them (the trust
 * model, D2; the GM handbook's 14.8). So the world holds the case ENCRYPTED: one world setting, `caseSealed`, whose
 * ciphertext a player's browser holds like every world setting, and whose key only a GM who knows the passphrase has.
 *
 * WHAT IS SEALED: the case file `backupCase` writes (gm-stores.mjs `caseFileNow`: every store with `backup: true`,
 * the format `caseFileOf` builds), as JSON, padded with spaces to a multiple of SEAL_PAD bytes. What is read back goes
 * through `restoreCase` - the same merge Restore from a file uses: newer wins per field, removals by their stamps, a
 * season reset's cut never crossed, another world's file refused. No merge rule of its own.
 *
 * THE CRYPTO: WebCrypto (`crypto.subtle`) and nothing else. The key is PBKDF2-HMAC-SHA-256 over the passphrase and a
 * random 16-byte salt, SEAL_ITERATIONS rounds (600 000: OWASP's password storage guidance, its figure
 * for PBKDF2-HMAC-SHA256, read 14.11.2026), an AES-GCM 256 key; every write takes a fresh random 12-byte IV, and the
 * format, version, world id and salt are the ciphertext's additional data, so a blob moved to another world or with
 * its salt edited does not open. Measured here (Node 22.23, 4-core Xeon 2.1 GHz, 14.11.2026): one derivation of
 * 600 000 rounds 106-109 ms, three runs; a GM machine's time is LIVE-E111-02.
 *
 * WHAT THIS BROWSER KEEPS: the derived key, not the passphrase - the client setting `caseSealKey`, a section per world
 * `{ salt, key, at }`, the key's raw bytes in base64. It opens the copy as the passphrase would, and the words the GM
 * typed (which a person may use elsewhere) stay nowhere. The salt is the world copy's: a passphrase changed on another
 * browser writes a new salt, and the key kept here no longer matches it ("otherPassphrase").
 *
 * WHO WRITES: the primary GM, after the case's stores change, debounced (SEAL_QUIET_MS after the last change, at most
 * SEAL_MOST_MS after the first), and only while `sealRefusal` finds nothing: a GM, the primary, holding this world's
 * key, with its stores hydrated (`gmStoresHydrated`), and having READ the copy the world holds now - a browser that
 * opens empty reads the copy before it may write one, so an empty browser never overwrites a full copy. Setting or
 * changing the passphrase writes at once, from the GM who does it.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS, getSetting, setSetting } from "./settings.mjs";
import { isPrimaryGm, warn, error } from "./utils.mjs";
import { gmStoresHydrated, gmStoreHandles, onGmStoresHydrated, stableJson } from "./gm-store.mjs";
import { caseFileNow, restoreCase } from "./gm-stores.mjs";

export const SEAL_FORMAT = "drpg-case-sealed";
export const SEAL_VERSION = 1;
/** PBKDF2-HMAC-SHA256 rounds: OWASP's password storage guidance, 600 000 (read 14.11.2026). */
export const SEAL_ITERATIONS = 600000;
/** Bytes of salt and of IV: 16 (NIST SP 800-132 asks at least 128 bits of salt) and 12 (AES-GCM's 96-bit IV). */
export const SEAL_SALT_BYTES = 16;
export const SEAL_IV_BYTES = 12;
/**
 * The plaintext is padded with spaces to a multiple of this, so the ciphertext's length moves in steps of 4 KiB and
 * not with each row: a player's browser reads the length of every write. No compression before the encryption, on
 * purpose: a player can put text of their own into the case (a pre-session note) and read the length after, and a
 * compressed length would say whether their text matched something already in it.
 */
export const SEAL_PAD = 4096;
/**
 * The debounce of a write: SEAL_QUIET_MS after the last change, and at most SEAL_MOST_MS after the first one waiting.
 * A restore or a chapter's close writes many stores one flush at a time (gm-stores.mjs `registerCaseHealth`), and each
 * write of the copy is one world setting sent to every browser at the table; fifteen seconds gathers such a burst into
 * one write, and a minute bounds what a browser closed mid-session can leave out of the copy. Chosen, not measured at a
 * table (LIVE-E111-01 measures what one write costs a real server).
 */
export const SEAL_QUIET_MS = 15000;
export const SEAL_MOST_MS = 60000;
/** The shortest passphrase `setCasePassphrase` takes (Q-E111-1: the default, twelve characters). */
export const SEAL_MIN_LENGTH = 12;

const isPlain = o => o !== null && typeof o === "object" && !Array.isArray(o);
const subtle = () => globalThis.crypto?.subtle ?? null;

/* ------------------------------ bytes ------------------------------ */

export function toBase64(bytes) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let out = "";
    // In pieces: a spread of a megabyte's bytes into one call overflows the stack.
    for (let i = 0; i < u8.length; i += 0x8000) out += String.fromCharCode(...u8.subarray(i, i + 0x8000));
    return globalThis.btoa(out);
}

export function fromBase64(text) {
    const raw = globalThis.atob(String(text ?? ""));
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
}

const randomBytes = n => globalThis.crypto.getRandomValues(new Uint8Array(n));

/** The ciphertext's additional data: the format, its version, the world and the salt the key came from. */
const additionalData = (worldId, salt) => new globalThis.TextEncoder().encode(`${SEAL_FORMAT}:${SEAL_VERSION}:${worldId}:${salt}`);

/* ------------------------------ the crypto, pure ------------------------------ */

/** A passphrase this module takes, or why not: "empty", "short". */
export function passphraseProblem(passphrase) {
    const text = typeof passphrase === "string" ? passphrase : "";
    if (!text.trim()) return "empty";
    if ([...text].length < SEAL_MIN_LENGTH) return "short";
    return null;
}

/** The AES-GCM key of `passphrase` and `salt` (base64), extractable so this browser can keep it. */
export async function deriveSealKey(passphrase, salt, iterations = SEAL_ITERATIONS) {
    const base = await subtle().importKey("raw", new globalThis.TextEncoder().encode(String(passphrase)), "PBKDF2", false, ["deriveKey"]);
    return subtle().deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: fromBase64(salt), iterations },
        base, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

export const exportSealKey = async key => toBase64(await subtle().exportKey("raw", key));
export const importSealKey = raw => subtle().importKey("raw", fromBase64(raw), { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
export const newSalt = () => toBase64(randomBytes(SEAL_SALT_BYTES));

/**
 * Seal `file` (a case file) with `key`: the world setting's value. `salt` and `iterations` are written beside it, so a
 * GM who types the passphrase on another browser derives the same key. A fresh IV every call.
 */
export async function sealCase(file, key, { salt, iterations = SEAL_ITERATIONS, worldId, writtenBy = null, writtenAt = Date.now() }) {
    const json = JSON.stringify(file);
    const bytes = new globalThis.TextEncoder().encode(json);
    const padded = new Uint8Array(Math.ceil((bytes.length + 1) / SEAL_PAD) * SEAL_PAD).fill(0x20);
    padded.set(bytes);
    const iv = randomBytes(SEAL_IV_BYTES);
    const ciphertext = await subtle().encrypt({ name: "AES-GCM", iv, additionalData: additionalData(worldId, salt) }, key, padded);
    return {
        format: SEAL_FORMAT, version: SEAL_VERSION,
        kdf: { name: "PBKDF2", hash: "SHA-256", iterations, salt },
        iv: toBase64(iv), ciphertext: toBase64(ciphertext),
        writtenAt, writtenBy, worldId
    };
}

/** Whether `sealed` has the shape `sealCase` writes, or why not: "absent", "unreadable", "newer". */
export function sealedProblem(sealed) {
    if (!isPlain(sealed) || !sealed.format) return "absent";
    if (sealed.format !== SEAL_FORMAT || !Number.isInteger(sealed.version) || sealed.version < 1) return "unreadable";
    if (sealed.version > SEAL_VERSION) return "newer";
    const kdf = sealed.kdf;
    if (!isPlain(kdf) || kdf.name !== "PBKDF2" || kdf.hash !== "SHA-256" || !Number.isInteger(kdf.iterations) || kdf.iterations < 1
        || typeof kdf.salt !== "string" || typeof sealed.iv !== "string" || typeof sealed.ciphertext !== "string"
        || typeof sealed.worldId !== "string") return "unreadable";
    return null;
}

/**
 * Open `sealed` with `key`: `{ file }`, or `{ refused }` - "absent", "unreadable" or "newer" (`sealedProblem`), and
 * "wrong" when the key does not open it (AES-GCM's tag: a wrong passphrase, another world's blob, an edited one).
 */
export async function openSealed(sealed, key) {
    const problem = sealedProblem(sealed);
    if (problem) return { refused: problem };
    let plain;
    try {
        plain = await subtle().decrypt({ name: "AES-GCM", iv: fromBase64(sealed.iv), additionalData: additionalData(sealed.worldId, sealed.kdf.salt) },
            key, fromBase64(sealed.ciphertext));
    } catch {
        return { refused: "wrong" };
    }
    try { return { file: JSON.parse(new globalThis.TextDecoder().decode(plain)) }; }
    catch { return { refused: "unreadable" }; }
}

/**
 * Why this browser may not write the copy now, or null (pure over what it is handed). `primary: false` asks it for an
 * explicit write (setting the passphrase), which any GM may make; the debounced writes ask it with the primary's answer.
 *   notGm          - a player's browser: it holds no case and no key.
 *   notPrimary     - a debounced write is the primary GM's alone, as the stores' other writes are.
 *   noKey          - this browser holds no key for this world.
 *   notHydrated    - its stores have not heard the other GMs yet: what it holds may be less than the case.
 *   otherPassphrase- the copy in the world was sealed under another salt: the passphrase was changed elsewhere.
 *   otherWorld     - the copy names another world (a duplicated world): it is not overwritten unasked.
 *   unread         - the world holds a copy this browser has not read since it changed: read it first.
 * `explicit` is the GM's own act (a new passphrase, or replacing a copy this browser cannot read): the copy in the world
 * is the one it replaces, so only the first four hold - the caller has read the copy first, or the GM confirmed.
 */
export function sealRefusal({ isGM, primary = true, hydrated, key, sealed, seen, worldId, explicit = false }) {
    if (!isGM) return "notGm";
    if (!primary) return "notPrimary";
    if (!key) return "noKey";
    if (!hydrated) return "notHydrated";
    if (!explicit && sealedProblem(sealed) === null) {
        if (sealed.kdf.salt !== key.salt) return "otherPassphrase";
        if (sealed.worldId !== worldId) return "otherWorld";
        if (sealed.iv !== seen) return "unread";
    }
    return null;
}

/* ------------------------------ this browser and this world ------------------------------ */

/** The sealed copy the world holds, or null. */
export function worldSealed() {
    try {
        const value = getSetting(SETTINGS.caseSealed);
        return isPlain(value) && value.format ? value : null;
    } catch { return null; }
}

/** This browser's key for this world, `{ salt, key, at }`, or null. */
export function keptKey(worldId = game.world?.id) {
    try {
        const all = getSetting(SETTINGS.caseSealKey);
        const mine = isPlain(all) ? all[worldId] : null;
        return isPlain(mine) && typeof mine.salt === "string" && typeof mine.key === "string" ? mine : null;
    } catch { return null; }
}

async function keepKey(entry) {
    const all = { ...(getSetting(SETTINGS.caseSealKey) ?? {}) };
    if (entry) all[game.world.id] = entry;
    else delete all[game.world.id];
    await setSetting(SETTINGS.caseSealKey, all);
}

/**
 * THIS SESSION'S STATE. `seen`: the IV of the last copy this browser read or wrote - the copy it is up to date with.
 * `last`: what the last read found ("read", or the refusal), for the health check and the window. The suite reads both
 * (`sealState`) and may stand in for the stores' hydration (SEAL_DEPS.hydrated: 34-case-seal's unhydrated case).
 */
const state = { seen: null, last: null, timer: null, first: 0, writing: null, wrote: 0, refusedWrites: {} };
export const SEAL_DEPS = { hydrated: () => gmStoresHydrated() };
export const sealState = () => ({ seen: state.seen, last: state.last, pending: state.timer !== null, wrote: state.wrote,
    refusedWrites: { ...state.refusedWrites } });

/** The case's stores, as one digest: what the copy is compared with. */
const casePart = file => stableJson(file?.stores ?? {});

/** Whether the case planner holds nothing here: the Key Remnant plan and the case schema both empty. */
export function plannerEmpty() {
    return gmStoreHandles().filter(h => ["keyPlan", "caseSchema"].includes(h.name)).every(h => !Object.keys(h.entries()).length);
}

/**
 * What this browser can do with the world's copy, for the health check and the window:
 * `{ present, writtenAt, writtenBy, readable, why }` - `why` one of "noKey", "otherPassphrase", "otherWorld", "wrong",
 * "unreadable", "newer", or null when this browser holds the copy's key.
 */
export function sealStatus() {
    const sealed = worldSealed();
    const key = keptKey();
    if (!sealed) return { present: false, key: Boolean(key), readable: false, why: null };
    const problem = sealedProblem(sealed);
    let why = problem;
    if (!why) {
        if (!key) why = "noKey";
        else if (key.salt !== sealed.kdf.salt) why = "otherPassphrase";
        else if (sealed.worldId !== game.world?.id) why = "otherWorld";
        else if (state.last && state.last !== "read" && state.seen !== sealed.iv) why = state.last;
    }
    return { present: true, key: Boolean(key), writtenAt: sealed.writtenAt ?? null, writtenBy: sealed.writtenBy ?? null,
        readable: !why, why: why ?? null };
}

/**
 * Read the world's copy into this browser's stores, by `restoreCase`'s merge (quiet: no toast, no health check of its
 * own, the stores not marked restored). Answers what it did: "read", "same" (already up to date with it), or the reason
 * it did not ("absent", "noKey", "otherPassphrase", "wrong", "unreadable", "newer", "otherWorld", "notGm").
 */
export async function readSealedCopy({ force = false } = {}) {
    if (!game.user?.isGM) return "notGm";
    const sealed = worldSealed();
    const problem = sealedProblem(sealed);
    if (problem) return (state.last = problem);
    if (!force && sealed.iv === state.seen) return "same";
    const kept = keptKey();
    if (!kept) return (state.last = "noKey");
    if (kept.salt !== sealed.kdf.salt) return (state.last = "otherPassphrase");
    const opened = await openSealed(sealed, await importSealKey(kept.key));
    if (opened.refused) return (state.last = opened.refused);
    const result = await restoreCase(opened.file, { quiet: true, recheck: false });
    if (result?.refused) return (state.last = result.refused);
    state.seen = sealed.iv;
    state.last = "read";
    /* What this browser holds beyond the copy - a row written here while no GM with the key was on - goes into the
       next copy: compared after the merge, so a browser that only learnt from it writes nothing back. */
    if (casePart(await caseFileNow()) !== casePart(opened.file)) scheduleSeal();
    return "read";
}

/**
 * Write the copy now, if `sealRefusal` allows it: the case this browser holds, sealed with its key. `explicit` is a
 * GM's own act (setting the passphrase), which any GM may make; the debounced writes are the primary's. Answers
 * "written", "same" (the copy already holds this case) or the refusal.
 */
export async function sealCaseNow({ explicit = false } = {}) {
    if (state.writing) await state.writing.catch(() => {});
    const kept = keptKey();
    const sealed = worldSealed();
    const why = sealRefusal({ isGM: Boolean(game.user?.isGM), primary: explicit || isPrimaryGm(), hydrated: SEAL_DEPS.hydrated(),
        key: kept, sealed, seen: state.seen, worldId: game.world?.id, explicit });
    if (why) {
        state.refusedWrites[why] = (state.refusedWrites[why] ?? 0) + 1;
        if (why === "unread") void readSealedCopy();
        return why;
    }
    const run = (async () => {
        const file = await caseFileNow();
        const key = await importSealKey(kept.key);
        if (!explicit && sealedProblem(sealed) === null) {
            const opened = await openSealed(sealed, key);
            if (opened.file && casePart(opened.file) === casePart(file)) return "same";
        }
        // Read again just before the write: a hydration or another GM's copy that arrived while the case was built.
        if (!SEAL_DEPS.hydrated() || (worldSealed()?.iv ?? null) !== (sealed?.iv ?? null)) return "notHydrated";
        const value = await sealCase(file, key, { salt: kept.salt, worldId: game.world.id, writtenBy: game.user.name });
        // Seen before the write lands, so its own echo (updateSetting here) is not read back as news; put back if it fails.
        const before = state.seen;
        state.seen = value.iv;
        try { await setSetting(SETTINGS.caseSealed, value); }
        catch (err) { state.seen = before; throw err; }
        state.wrote++;
        return "written";
    })();
    state.writing = run;
    try { return await run; }
    catch (err) { error("The case's sealed copy could not be written", err); return "failed"; }
    finally { if (state.writing === run) state.writing = null; }
}

/** Ask for a write: SEAL_QUIET_MS after the last ask, at most SEAL_MOST_MS after the first one waiting. */
export function scheduleSeal() {
    if (!game.user?.isGM || !keptKey()) return false;
    const now = Date.now();
    if (state.timer === null) state.first = now;
    else clearTimeout(state.timer);
    const wait = Math.max(0, Math.min(SEAL_QUIET_MS, state.first + SEAL_MOST_MS - now));
    state.timer = setTimeout(() => {
        state.timer = null;
        if (isPrimaryGm()) void sealCaseNow();
    }, wait);
    return true;
}

/** The pending write, written now (the suite, and a GM's "Back up" path): answers what `sealCaseNow` answers, or null. */
export async function flushSeal() {
    if (state.timer === null) return null;
    clearTimeout(state.timer);
    state.timer = null;
    return sealCaseNow();
}

/* ------------------------------ the GM's acts ------------------------------ */

/**
 * Set (or change) the passphrase for this world: a new salt, the key kept on this browser, and the copy written at
 * once. Refused: not a GM ("notGm"), a passphrase too short ("short", "empty"), stores not hydrated ("notHydrated"),
 * and a copy in the world this browser cannot read, unless `replace` (the GM confirmed: "unreadable"). Answers
 * `{ ok: true }` or `{ refused }`.
 */
export async function setCasePassphrase(passphrase, { replace = false } = {}) {
    if (!game.user?.isGM) return { refused: "notGm" };
    const problem = passphraseProblem(passphrase);
    if (problem) return { refused: problem };
    if (!SEAL_DEPS.hydrated()) return { refused: "notHydrated" };
    const sealed = worldSealed();
    if (sealed && !replace) {
        const status = sealStatus();
        if (!status.readable) return { refused: "unreadable", why: status.why };
        // Read it first: what the copy holds beyond this browser goes into the new one.
        const read = await readSealedCopy();
        if (read !== "read" && read !== "same") return { refused: "unreadable", why: read };
    }
    const salt = newSalt();
    const key = await deriveSealKey(passphrase, salt);
    await keepKey({ salt, key: await exportSealKey(key), at: Date.now() });
    const wrote = await sealCaseNow({ explicit: true });
    if (wrote !== "written") return { refused: wrote };
    return { ok: true };
}

/**
 * The passphrase typed on this browser: the key derived from the copy's salt, tried on the copy, and kept only when it
 * opens it; then the copy read into this browser's stores. "wrong" changes nothing. Answers `{ ok, read }` or `{ refused }`.
 */
export async function unlockCaseCopy(passphrase) {
    if (!game.user?.isGM) return { refused: "notGm" };
    const sealed = worldSealed();
    const problem = sealedProblem(sealed);
    if (problem) return { refused: problem };
    if (typeof passphrase !== "string" || !passphrase) return { refused: "empty" };
    const key = await deriveSealKey(passphrase, sealed.kdf.salt, sealed.kdf.iterations);
    const opened = await openSealed(sealed, key);
    if (opened.refused) return { refused: opened.refused };
    await keepKey({ salt: sealed.kdf.salt, key: await exportSealKey(key), at: Date.now() });
    const read = await readSealedCopy({ force: true });
    return read === "read" ? { ok: true, read } : { refused: read };
}

/** "Forget on this browser": this world's key removed from this browser. The copy in the world stays. */
export async function forgetCasePassphrase() {
    if (!game.user?.isGM) return { refused: "notGm" };
    await keepKey(null);
    state.seen = null;
    state.last = null;
    if (state.timer !== null) { clearTimeout(state.timer); state.timer = null; }
    return { ok: true };
}

/* ------------------------------ the wiring ------------------------------ */

let registered = false;

/**
 * Registered at ready (module.mjs), on a GM's browser only: once the stores are hydrated the copy is read (or, when
 * this browser cannot read it and its planner is empty, the GM is told how to get it); a change of the world's copy
 * is read; a change of a backed-up store asks for a write.
 */
export function registerCaseSeal() {
    if (registered || !game.user?.isGM) return;
    registered = true;
    onGmStoresHydrated(() => { void sealAtLoad(); });
    for (const hook of ["updateSetting", "createSetting"]) {
        Hooks.on(hook, setting => {
            if (setting?.key !== `${MODULE_ID}.${SETTINGS.caseSealed}`) return;
            if (!SEAL_DEPS.hydrated()) return;
            readSealedCopy().catch(err => error("The case's sealed copy could not be read", err));
        });
    }
    Hooks.on("clientSettingChanged", key => {
        if (!gmStoreHandles().some(h => h.spec.backup && key === `${MODULE_ID}.${h.spec.key}`)) return;
        scheduleSeal();
    });
}

async function sealAtLoad() {
    try {
        const status = sealStatus();
        if (status.present && status.readable) await readSealedCopy();
        else if (!status.present && keptKey() && isPrimaryGm()) scheduleSeal();
        const after = sealStatus();
        if (after.present && !after.readable && plannerEmpty()) {
            ui.notifications?.warn?.(game.i18n.localize(`DRPG.Case.seal.emptyHere.${after.why === "otherPassphrase" ? "changed" : "noKey"}`), { permanent: true });
        }
    } catch (err) {
        warn("The case's sealed copy could not be read at load", err);
    }
}
