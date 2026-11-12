/**
 * The old keys `-=` and `==` in the "honoured" reading (E76 C4, 12.11.2026; the owner's DY7): lib/old-keys.mjs runs
 * its parts A-C, and lib/operators.mjs says what the reading is. Its twin, 91-old-keys-ignored, runs the
 * same in the other reading. Which one v14 has is LIVE-E76-03.
 */
import { runOldKeys } from "../lib/old-keys.mjs";

export const layers = ["ci"];
export const legacyReading = "honoured";

export async function run(api) {
    await runOldKeys(api, legacyReading);
}
