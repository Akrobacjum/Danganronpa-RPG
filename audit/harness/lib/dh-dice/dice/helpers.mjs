/*
 * DAGGERHEART'S OWN CODE, copied VERBATIM for the headless harness (E33 C2a; the owner's decision P6
 * of 06.10.2026: Daggerheart's dice classes run in the harness, as its GM relay does in dh-relay.mjs).
 *
 * Source: Foundryborne Daggerheart, tag 2.10.5 (commit 6bf4b69f98), module/dice/helpers.mjs - the whole file
 * (28 lines). Everything after this comment and the one blank line under it is that file byte for
 * byte, its imports included. An import that leaves module/dice/ lands on the harness's glue at the
 * same relative path under lib/dh-dice/ (applications/, helpers/, data/), which says it is not
 * Daggerheart's; audit/harness/README.md ("Daggerheart's dice") names the boundary.
 *
 * Re-copy it on an upgrade; never edit it. A model of this file could be wrong in the module's
 * favour - the reason it is the file itself.
 *
 * MIT License, Copyright (c) 2025 WBHarry. The notice in full: lib/dh-dice/LICENSE.
 */

import { ResourceUpdateMap } from '../data/action/baseAction.mjs';

export function updateResourcesForDualityReroll(oldDuality, newDuality, actor) {
    const hope = (newDuality >= 0 ? 1 : 0) - (oldDuality >= 0 ? 1 : 0);
    const stress = (newDuality === 0 ? 1 : 0) - (oldDuality === 0 ? 1 : 0);
    const fear = (newDuality === -1 ? 1 : 0) - (oldDuality === -1 ? 1 : 0);

    const { hopeFear, countdownAutomation } = 
        game.settings.get(CONFIG.DH.id, CONFIG.DH.SETTINGS.gameSettings.Automation);

    if (game.user.isGM ? hopeFear.gm : hopeFear.players) {
        const updates = [];
        if (hope !== 0) updates.push({ key: 'hope', value: hope, enabled: true });
        if (stress !== 0) updates.push({ key: 'stress', value: -1 * stress, enabled: true });
        if (fear !== 0) updates.push({ key: 'fear', value: fear, enabled: true })

        const resourceUpdates = new ResourceUpdateMap(actor);
        resourceUpdates.addResources(updates);
        resourceUpdates.updateResources();
    }

    if (countdownAutomation && fear !== 0) {
        game.system.api.applications.ui.DhCountdowns.updateCountdowns({ 
            type: CONFIG.DH.GENERAL.countdownProgressionTypes.fear.id, 
            undo: fear === 1 ? false : true 
        });
    }
}
