/*
 * Daggerheart's GM relay, copied VERBATIM for the headless harness.
 *
 * Source: Foundryborne Daggerheart, tag 2.10.11 (commit a093ec5c0f),
 * module/systemRegistration/socket.mjs lines 3-148 - `handleSocketEvent` with
 * its default branch, `socketEvent`, `GMUpdateEvent`, `RefreshType`,
 * `EVENT_HANDLERS` and `registerSocketHooks`. Left out: the
 * `DamageReductionDialog` import on line 1, `registerUserQueries` (lines
 * 150-153) and the helpers a client sends with (`emitGMUpdate`, `emitGMCreate`,
 * `emitAsGM`, `emitAsOwner`, lines 155-183), none of which the relay calls.
 * Nothing else is changed. It replaced 2.10.8's copy in E75 C1 (10.10.2026);
 * socket.mjs is the same file in 2.10.10 and 2.10.11.
 *
 * Re-copy it; never edit it. The point of having it here is that the security
 * scenario (30-security, part 8) checks the guard against the real relay, not a
 * stand-in that could be wrong in the module's favour.
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

export async function handleSocketEvent({ action = null, data = {} } = {}) {
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
            break;
        case socketEvent.TransferItem: {
            // Transfer events only occur when a player needs to request a GM update, so using a hook would be inconsistent
            if (game.user.isActiveGM) {
                const item = await fromUuid(data.item);
                const targetActor = await fromUuid(data.targetActor);
                if (!item || !targetActor) return;
                targetActor.transferItem({ item, quantity: Number(data.quantity || 1) });
            }
            break;
        }
        default:
            EVENT_HANDLERS[data.action]?.(data.data);
    }
}

export const socketEvent = {
    GMUpdate: 'DhGMUpdate',
    GMCreate: 'DhGMCreate',
    Refresh: 'DhRefresh',
    AddCountdowns: 'DhAddCountdowns',
    DhpFearUpdate: 'DhFearUpdate',
    DowntimeTrigger: 'DowntimeTrigger',
    TagTeamStart: 'DhTagTeamStart',
    GroupRollStart: 'DhGroupRollStart',
    TransferItem: 'DhTransferItem'
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

/** Registered socket events that are invoked when an event is received. May also be invoked directly without a socket if the user is a GM  */
const EVENT_HANDLERS = {
    [socketEvent.GMUpdate]: async data => {
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
    },
    [socketEvent.GMCreate]: async ({ data, documentType, scene }) => {
        switch (documentType) {
            default:
                const cls = getDocumentClass(documentType);
                cls.create(data, { parent: game.scenes.get(scene) });
                break;
        }
    },
    [socketEvent.AddCountdown]: async data => {
        const setting = game.settings.get(CONFIG.DH.id, CONFIG.DH.SETTINGS.gameSettings.Countdowns);
        const countdowns = data.countdowns ?? [];
        // User created countdowns should always be not hidden
        for (const countdown of countdowns) {
            countdown.hidden = false;
        }
        await setting.add(...countdowns);
    }
}

export const registerSocketHooks = () => {
    Hooks.on(socketEvent.GMUpdate, async data => {
        if (!game.user.isGM) return;
        return EVENT_HANDLERS[socketEvent.GMUpdate](data);
    });

    Hooks.on(socketEvent.GMCreate, async options => {
        if (!game.user.isGM) return;
        return EVENT_HANDLERS[socketEvent.GMCreate](options);
    });
};
