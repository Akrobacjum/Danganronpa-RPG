/*
 * HARNESS GLUE, NOT DAGGERHEART'S FILE (E33 C2a, 07.10.2026). The dice code beside this imports
 * `ResourceUpdateMap` from Daggerheart's module/data/action/baseAction.mjs, a file of actions,
 * forms and costs the harness does not load. The map is the one lib/daggerheart.mjs already holds,
 * copied from 2.6.5 (E30); 2.10.5's class (baseAction.mjs, `ResourceUpdateMap`) reads the same,
 * line for line, compared on 07.10.2026.
 */
export { ResourceUpdateMap } from "../../../daggerheart.mjs";
