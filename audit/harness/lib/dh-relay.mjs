/*
 * Daggerheart's GM relay, copied VERBATIM for the headless harness.
 *
 * Source: Foundryborne Daggerheart, tag 2.10.5 (commit 6bf4b69f98),
 * module/systemRegistration/socket.mjs lines 3-116 - `handleSocketEvent`, the
 * three event tables and `registerSocketHooks`. Left out: the
 * `DamageReductionDialog` import on line 1 and `registerUserQueries` (lines
 * 118-121), which the relay does not use. Nothing else is changed.
 *
 * Re-copy it; never edit it. The point of having it here is that the security
 * scenario (30-security, part 7) attacks the real relay, not a stand-in that
 * could be wrong in the module's favour.
 *
 * MIT License, Copyright (c) 2025 WBHarry. Permission is hereby granted, free of
 * charge, to any person obtaining a copy of this software and associated
 * documentation files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use, copy, modify,
 * merge, publish, distribute, sublicense, and/or sell copies of the Software, and
 * to permit persons to whom the Software is furnished to do so, subject to the
 * following conditions: The above copyright notice and this permission notice
 * shall be included in all copies or substantial portions of the Software. THE
 * SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
 * PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

export function handleSocketEvent({ action = null, data = {} } = {}) {
    switch (action) {
        case socketEvent.GMUpdate:
            Hooks.callAll(socketEvent.GMUpdate, data);
            break;
        case socketEvent.GMCreate:
            Hooks.callAll(socketEvent.GMCreate, data);
            break;
        case socketEvent.DhpFearUpdate:
            Hooks.callAll(socketEvent.DhpFearUpdate);
            break;
        case socketEvent.Refresh:
            Hooks.call(socketEvent.Refresh, data);
            break;
        case socketEvent.DowntimeTrigger:
            Hooks.callAll(CONFIG.DH.HOOKS.hooksConfig.downtimeTrigger, data);
            break;
        case socketEvent.TagTeamStart:
            Hooks.callAll(CONFIG.DH.HOOKS.hooksConfig.tagTeamStart, data);
            break;
        case socketEvent.GroupRollStart:
            Hooks.callAll(CONFIG.DH.HOOKS.hooksConfig.groupRollStart, data);
    }
}

export const socketEvent = {
    GMUpdate: 'DhGMUpdate',
    GMCreate: 'DhGMCreate',
    Refresh: 'DhRefresh',
    DhpFearUpdate: 'DhFearUpdate',
    DowntimeTrigger: 'DowntimeTrigger',
    TagTeamStart: 'DhTagTeamStart',
    GroupRollStart: 'DhGroupRollStart'
};

export const GMUpdateEvent = {
    UpdateDocument: 'DhGMUpdateDocument',
    UpdateEffect: 'DhGMUpdateEffect',
    UpdateSetting: 'DhGMUpdateSetting',
    UpdateFear: 'DhGMUpdateFear',
    UpdateCountdowns: 'DhGMUpdateCountdowns',
    UpdateSaveMessage: 'DhGMUpdateSaveMessage'
};

export const RefreshType = {
    Countdown: 'DhCoundownRefresh',
    TagTeamRoll: 'DhTagTeamRollRefresh',
    GroupRoll: 'DhGroupRollRefresh',
    EffectsDisplay: 'DhEffectsDisplayRefresh',
    Scene: 'DhSceneRefresh',
    CompendiumBrowser: 'DhCompendiumBrowserRefresh'
};

export const registerSocketHooks = () => {
    Hooks.on(socketEvent.GMUpdate, async data => {
        if (game.user.isGM) {
            const document = data.uuid ? await fromUuid(data.uuid) : null;
            switch (data.action) {
                case GMUpdateEvent.UpdateDocument:
                    if (document && data.data) await document.update(data.data);
                    break;
                case GMUpdateEvent.UpdateEffect:
                    if (document && data.data)
                        await game.system.api.fields.ActionFields.EffectsField.applyEffects.call(document, data.data);
                    break;
                case GMUpdateEvent.UpdateSetting:
                    await game.settings.set(CONFIG.DH.id, data.uuid, data.data);
                    break;
                case GMUpdateEvent.UpdateFear:
                    await game.settings.set(
                        CONFIG.DH.id,
                        CONFIG.DH.SETTINGS.gameSettings.Resources.Fear,
                        Math.max(
                            0,
                            Math.min(game.system.settings.homebrew.maxFear, data.data)
                        )
                    );
                    break;
                case GMUpdateEvent.UpdateCountdowns:
                    await game.settings.set(CONFIG.DH.id, CONFIG.DH.SETTINGS.gameSettings.Countdowns, data.data);
                    Hooks.callAll(socketEvent.Refresh, { refreshType: RefreshType.Countdown });
                    break;
                case GMUpdateEvent.UpdateSaveMessage:
                    const message = game.messages.get(data.data.message);
                    if (!message) return;
                    game.system.api.fields.ActionFields.SaveField.updateSaveMessage(
                        data.data.result,
                        message,
                        data.data.token
                    );
                    break;
            }

            if (data.refresh) {
                await game.socket.emit(`system.${CONFIG.DH.id}`, {
                    action: socketEvent.Refresh,
                    data: data.refresh
                });
                Hooks.call(socketEvent.Refresh, data.refresh);
            }
        }
    });

    Hooks.on(socketEvent.GMCreate, async ({ data, documentType, scene }) => {
        if (!game.user.isGM) return;

        switch (documentType) {
            default:
                const cls = getDocumentClass(documentType);
                cls.create(data, { parent: game.scenes.get(scene) });
                break;
        }
    });
};
