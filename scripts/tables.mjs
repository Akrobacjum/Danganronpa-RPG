/**
 * Danganronpa RPG - the item tables' facade.
 * ---------------------------------------------------------------------------
 * THE FACADE (E41 C8, 1.2.97). This file holds no code. A table's names in
 * both languages and every name it has carried, the tier pools and a room's
 * tables, the built-in pools, the roles, the draw with its steps and the index
 * of every entry's name, with this header's account of the built-in lists,
 * moved to tables-pools.mjs; the item tables window and Install, which call
 * each other, to tables-editor.mjs. Each moved by a pure move that
 * `node tools/moved-only.mjs` proves.
 *
 * This file keeps its name and every name it exported - twenty-eight of
 * tables-pools.mjs's and four of tables-editor.mjs's, re-exported below - so
 * every importer still imports tables.mjs, and neither file imports it. New
 * code goes into the file of its role, never here: a table's name, a pool, a
 * role or the draw, into tables-pools.mjs; the window or Install, into
 * tables-editor.mjs.
 */

export {
    tableName, tableNameCandidates, classifyTableName, flaggedTables, tierTablesFor, existingTableName,
    refreshTableCopy, isTierPool, tierPoolOf, isTierPoolTable, roomStockTables, poolNameRefusal, roomTableBases,
    tierPoolForms, USABLE_GOALS, usableKindFor, ITEM_POOLS, POOL_ROLES, MAX_EXTRA_ROLES, MULTI_ROLE_TIER,
    rolesForPoolItem, rolesOfResult, tierTableIdFor, randomItem, foundAs, entryAs, DRAW_STEPS, drawItem, moduleTables
} from "./tables-pools.mjs";
export { installTables, promptForTableName, poolPaneHtml, openItemTables } from "./tables-editor.mjs";
