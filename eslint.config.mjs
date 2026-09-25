/**
 * What `npm run lint` holds the code to (E30, audit S17-05): no-undef, and nothing else yet.
 * ---------------------------------------------------------------------------
 * Run from audit/harness (`npm run lint`, or `node run-all.mjs lint`), which
 * points ESLint at the repository root and this file. It imports nothing, so
 * it needs no package of its own, and it is export-ignored with the rest of
 * the repository's plumbing.
 *
 * THE GLOBALS ARE LISTED, NOT TAKEN FROM THE `globals` PACKAGE. `globals.browser`
 * declares every window property - `name`, `status`, `event`, `top`, `length`
 * among them - so a leftover bare read of one of those resolves to the window
 * property and passes. On a scratch copy on 24.09.2026 a planted
 * `status + name` in scripts/utils.mjs was reported twice with these lists;
 * globals.browser declares both names, so it would have passed. The lists are
 * what the code reads bare, measured the same day - 154 files, 0 problems,
 * 3.7 s; 163 files once audit/gate and audit/live arrived - and no Daggerheart
 * or module name is read bare anywhere in scripts/.
 * A new bare name is added here, next to the place that needs it.
 */
const names = list => Object.fromEntries(list.trim().split(/\s+/).map(n => [n, "readonly"]));
// Foundry v14 names the module reads bare: 16 names, 6165 reads in scripts/ on 24.09.2026.
const FOUNDRY = names(`game ui canvas CONFIG CONST Hooks foundry PIXI
    ChatMessage Actor Playlist RollTable Folder Roll fromUuid fromUuidSync`);
// Browser names the module reads bare. Not globals.browser: it would let a leftover `name` or `status` through.
const BROWSER = names(`window document console fetch performance PerformanceObserver
    setTimeout clearTimeout setInterval clearInterval requestAnimationFrame queueMicrotask
    getComputedStyle matchMedia innerWidth innerHeight devicePixelRatio location addEventListener
    CSS CSSTransition HTMLElement Element Node Event CustomEvent KeyboardEvent MouseEvent FocusEvent
    MutationObserver ResizeObserver Blob FormData URL structuredClone`);  // structuredClone: tests-kit.mjs, R159's dump fixtures
// Response: client-entry.mjs serves the checkout's stylesheets to jsdom; structuredClone: tools/stages.mjs, lib/seed.mjs;
// fetch, AbortController: the local gate's probe and verifier (audit/gate).
const NODE = names(`process console setTimeout clearTimeout setInterval clearInterval performance URL Buffer
    Response structuredClone fetch AbortController`);
const RULES = { "no-undef": ["error", { typeof: true }] };
const LANG = { ecmaVersion: "latest", sourceType: "module" };
export default [
    { ignores: ["**/node_modules/**", "audit/harness/results/**", "audit/gate/evidence/**", "audit/gate/.work/**",
        "docs/**",                         // design papers (docs/design/glass-recipe.js), not code that runs
        "macros/**",                       // Foundry macro bodies: top-level return and await, which a module parser refuses
        "audit/handoff/**",                // a temporary hand-over folder, deleted in the 1.2.61 release commit
        "audit/harness/lib/dh-relay.mjs"]  // Daggerheart's relay, copied verbatim and never edited (CLAUDE.md)
    },
    { files: ["scripts/**/*.mjs"], languageOptions: { ...LANG, globals: { ...BROWSER, ...FOUNDRY } },
      linterOptions: { reportUnusedDisableDirectives: "error" }, rules: RULES },
    { files: ["tools/**/*.mjs", "audit/**/*.mjs", "eslint.config.mjs"], languageOptions: { ...LANG, globals: NODE },
      linterOptions: { reportUnusedDisableDirectives: "error" }, rules: RULES },
    // client-entry.mjs makes jsdom's window and document globals of the client process.
    { files: ["audit/harness/client-entry.mjs"], languageOptions: { globals: { window: "readonly", document: "readonly" } } },
    // Daggerheart's roll pipeline as the harness models it runs inside a client, whose shim puts Foundry's names on globalThis.
    { files: ["audit/harness/lib/daggerheart.mjs"], languageOptions: { globals: { ...NODE, ...FOUNDRY } } },
    // The live runner's page.evaluate functions run inside Foundry's page.
    { files: ["audit/live/**/*.mjs"], languageOptions: { globals: { ...NODE, ...BROWSER, ...FOUNDRY } } },
    { files: ["audit/live/page-hooks.js"], languageOptions: { ecmaVersion: "latest", sourceType: "script", globals: { ...BROWSER, ...FOUNDRY } }, rules: RULES }
];
