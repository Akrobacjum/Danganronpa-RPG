/**
 * The old keys `-=` and `==` in the "ignored" reading (E76 C4, 12.11.2026; the owner's DY7): lib/old-keys.mjs runs
 * its parts A-C, and lib/operators.mjs says what the reading is. Its twin, 92-old-keys-honoured, runs the
 * same in the other reading. Which one v14 has is LIVE-E76-03.
 */
import { runOldKeys } from "../lib/old-keys.mjs";

export const layers = ["ci"];
export const legacyReading = "ignored";

export async function run(api) {
    await runOldKeys(api, legacyReading);
}
