/*
 * DAGGERHEART'S OWN CODE, copied VERBATIM for the headless harness (E33 C2a; the owner's decision P6
 * of 06.10.2026: Daggerheart's dice classes run in the harness, as its GM relay does in dh-relay.mjs).
 *
 * Source: Foundryborne Daggerheart, tag 2.10.5 (commit 6bf4b69f98), module/dice/die/disadvantageDie.mjs - the whole file
 * (11 lines). Everything after this comment and the one blank line under it is that file byte for
 * byte, its imports included. An import that leaves module/dice/ lands on the harness's glue at the
 * same relative path under lib/dh-dice/ (applications/, helpers/, data/), which says it is not
 * Daggerheart's; audit/harness/README.md ("Daggerheart's dice") names the boundary.
 *
 * Re-copy it on an upgrade; never edit it. A model of this file could be wrong in the module's
 * favour - the reason it is the file itself.
 *
 * MIT License, Copyright (c) 2025 WBHarry. The notice in full: lib/dh-dice/LICENSE.
 */

import BaseDie from './baseDie.mjs';

export default class DisadvantageDie extends BaseDie { 
    constructor(options) {
        options.modifiers = options.modifiers ? 
            (options.modifiers.includes('d') ? options.modifiers : [...options.modifiers, 'd'])
            : ['d'];
            
        super(options);
    }
}
