/*
 * HARNESS GLUE, NOT DAGGERHEART'S CODE (E33 C2a, 07.10.2026). Daggerheart's roll window
 * (module/applications/dialogs/d20RollDialog.mjs, 2.10.5) is a window the harness does not draw;
 * dhRoll.mjs, d20Roll.mjs and dualityRoll.mjs beside this import it as their `DefaultDialog`, and
 * this is what they get: the window pressed at once, the roll and its configuration unchanged -
 * what the harness's own roll class answered before C2a. The window's choices (advantage, faces,
 * experiences) are not run here; the module's hooks on the window are called on a stand-in where
 * a test reads them (tests-tier2.mjs `rollWindow`).
 */
export default class D20RollDialog {
    static async configure(roll, config) {
        return config;
    }
}
