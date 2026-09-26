/*
 * The fixture of drpg/bridge-result (eslint.config.mjs; E31, 25.09.2026). Not code:
 * the tree's own lint ignores this folder, and run-all's lint part lints this text
 * as if it were scripts/__bridge-result__.mjs, red unless the rule reports exactly
 * the seven lines marked "reported" - each lets a request's answer leave the place
 * it was asked for - and none of the three below them, which read it there.
 */
import { requestSabotage } from "./gm-bridge.mjs";
import { bridgeRequest } from "./bridge-guards.mjs";

export async function returned() { return requestSabotage("a", 3); } // reported
export const arrow = () => requestSabotage("a", 3); // reported
export async function tested() { if (await requestSabotage("a", 3)) return 1; return 0; } // reported
export async function negated() { return !(await requestSabotage("a", 3)); } // reported
export async function passedOn() { return Promise.all([requestSabotage("a", 3)]); } // reported
export async function stored() { const res = await bridgeRequest("x.y", {}); return res; } // reported
export async function dynamic() { const { requestEclipseMove } = await import("./gm-bridge.mjs"); return requestEclipseMove("a") && 1; } // reported

export async function bare() { await requestSabotage("a", 3); }
export function voided() { void bridgeRequest("x.y", {}, { settle: "none" }); }
export async function read() { const res = await requestSabotage("a", 3); return res.ok ? res.value : null; }
