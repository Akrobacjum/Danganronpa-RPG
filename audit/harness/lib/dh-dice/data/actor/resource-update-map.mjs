/*
 * HARNESS GLUE, NOT DAGGERHEART'S FILE (E76, 12.11.2026). From 2.12 the dice code beside this imports
 * `ResourceUpdateMap` from Daggerheart's module/data/actor/resource-update-map.mjs (dice/helpers.mjs,
 * 2.12.8); up to 2.10.x it came from data/action/baseAction.mjs, whose glue stays beside this for the
 * older copy. The map is the one lib/daggerheart.mjs already holds; 2.12.8's class
 * (resource-update-map.mjs, `ResourceUpdateMap`) reads the same, statement for statement, compared
 * with `git show 2.12.8:module/data/actor/resource-update-map.mjs` on 12.11.2026.
 */
export { ResourceUpdateMap } from "../../../daggerheart.mjs";
