/*
 * DAGGERHEART'S OWN CODE, copied VERBATIM for the headless harness (E76, 12.11.2026; the owner's yes of 12.11,
 * relayed by the coordinator; the owner's decision P6 of 06.10.2026: Daggerheart's dice classes run in the harness).
 *
 * Source: Foundryborne Daggerheart, tag 2.12.8 (commit 71c318de25), module/helpers/functional.mjs - the whole file
 * (102 lines). Everything after this comment and the one blank line under it is that file byte for
 * byte, its imports included. It is here because the dice copied beside it import it, or because 2.12's
 * `actor.rollTrait` builds its config with it (the harness's actor, client-entry.mjs); an import that
 * lands outside what is copied lands on the harness's glue at the same relative path under lib/dh-dice/,
 * which says it is not Daggerheart's; audit/harness/README.md ("Daggerheart's dice") names the boundary.
 *
 * Re-copy it on an upgrade; never edit it. A model of this file could be wrong in the module's
 * favour - the reason it is the file itself.
 *
 * MIT License, Copyright (c) 2025 WBHarry. The notice in full: lib/dh-dice/LICENSE.
 */

/**
 * Methods that basically can be removed by installing something like es-toolkit.
 * These are basic helpers to operate on arrays and objects.
 */

/** Given an object, returns a new object with the keys listed in keys */
export function pick(obj, keys) {
    return keys.reduce((r, k) => {
        r[k] = obj[k];
        return r;
    }, {});
}

/**
 * @template {T extends Record<string, any>} T
 * @param {T} obj 
 * @param {(value: T[keyof T], key: keyof T) => boolean} fn 
 * @returns {Partial<T>}
 */
export function pickBy(obj, fn) {
    return Object.entries(obj).reduce((r, [k, v]) => {
        if (fn(v, k)) {
            r[k] = obj[k];
        }
        return r;
    }, {});
}

/** Given an object, returns a new object with the keys not listed in keys */
export function omit(obj, keys) {
    const keysAsString = keys.map(k => String(k));
    return Object.keys(obj).reduce((r, k) => {
        if (!keysAsString.includes(k)) {
            r[k] = obj[k];
        }
        return r;
    }, {});
}

/** 
 * Given an object, returns a new object with each value altered by a transform function
 * @template {string} K
 * @template V
 * @template R
 * @param {Record<K, V>} obj object to transform
 * @param {(value: V, key: K) => R} transform mapping function
 * @returns {Record<K, R>} new object with mapped values
 */
export function mapValues(obj, transform) {
    return Object.entries(obj).reduce((r, [k, v]) => {
        r[k] = transform(v, k);
        return r;
    }, {});
}

/**
 * Given an array, creates an object that references each element by a key gen function
 * @template T
 * @template K
 * @param {T[]} arr 
 * @param {(value: T) => K} keyFn 
 * @returns {Record<K, T>}
 */
export function keyBy(arr, keyFn) {
    return arr.reduce((r, current) => {
        r[keyFn(current)] = current;
        return r;
    }, {})
}

/**
 * Returns an array sorted by a function that returns a thing to compare, or an array to compare in order
 * Similar to lodash's sortBy function.
 */
export function sortBy(arr, fn) {
    const directCompare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
    const cmp = (a, b) => {
        const resultA = fn(a);
        const resultB = fn(b);
        if (Array.isArray(resultA) && Array.isArray(resultB)) {
            for (let idx = 0; idx < Math.min(resultA.length, resultB.length); idx++) {
                const result = directCompare(resultA[idx], resultB[idx]);
                if (result !== 0) return result;
            }
            return 0;
        }
        return directCompare(resultA, resultB);
    };
    return arr.sort(cmp);
}

export function shuffleArray(array) {
    let currentIndex = array.length;
    while (currentIndex != 0) {
        let randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }

    return array;
}
