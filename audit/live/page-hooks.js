/*
 * The harness's page hooks, for a real Foundry page (E30, 24.09.2026). NEVER RUN
 * against a real Foundry (audit/live/README.md).
 *
 * Added to every page with Playwright's addInitScript, so it runs before
 * Foundry's own scripts. It gives a scenario the globals the headless harness's
 * client provides (client-entry.mjs) - as far as a real page can - and nothing
 * else: __notifications, __errors, __missingI18n, __dialogAuto, __dialogLog.
 * __forceRoll is not here: a scenario that uses it is refused by the adapter
 * (sandbox-cluster.mjs) rather than run with dice it did not choose.
 */
(() => {
    "use strict";
    window.__notifications = [];
    window.__errors = [];
    window.__missingI18n = [];
    window.__dialogLog = [];
    /** A scenario puts answers here - { "<window title fragment>": "<button action>" } - before it opens a window. */
    window.__dialogAuto = {};
    window.addEventListener("error", e => window.__errors.push(String(e.error?.stack ?? e.message)));
    window.addEventListener("unhandledrejection", e => window.__errors.push(String(e.reason?.stack ?? e.reason)));

    /* Foundry's objects exist only after its scripts ran; the hooks attach at "init" and "ready". */
    const attach = () => {
        if (!window.Hooks) return setTimeout(attach, 50);
        Hooks.once("ready", () => {
            const notify = ui.notifications.notify.bind(ui.notifications);
            ui.notifications.notify = (message, type = "info", options) => {
                window.__notifications.push({ message: String(message), type });
                return notify(message, type, options);
            };
            const localize = game.i18n.localize.bind(game.i18n);
            game.i18n.localize = key => {
                const out = localize(key);
                if (out === key && typeof key === "string" && key.startsWith("DRPG.")) window.__missingI18n.push(key);
                return out;
            };
            const DialogV2 = foundry.applications?.api?.DialogV2;
            if (DialogV2?.wait) {
                const wait = DialogV2.wait.bind(DialogV2);
                DialogV2.wait = options => {
                    const title = String(options?.window?.title ?? "");
                    window.__dialogLog.push({ title, buttons: (options?.buttons ?? []).map(b => b.action) });
                    const key = Object.keys(window.__dialogAuto).find(k => title.includes(k));
                    return key ? Promise.resolve(window.__dialogAuto[key]) : wait(options);
                };
            }
        });
    };
    attach();
})();
