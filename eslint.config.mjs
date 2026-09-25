/**
 * What `npm run lint` holds the code to (E30, audit S17-05): no-undef, and, for scripts/, drpg/bridge-result (E31).
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
/*
 * drpg/bridge-result (E31, 25.09.2026; audit S17-09). A request to the GM answers
 * the bridge's result, `{ ok, pending?, value?, refused?, reason? }`, and an object
 * is truthy whatever it says: a caller that returned it, tested it or handed it on
 * would read a refusal as success, two hops from where anybody could see it. So a
 * call of a producer - `bridgeRequest`, `ask`, `sendDespairToPrimary`, or a
 * `request[A-Z]...` imported (statically, or destructured from `await import()`)
 * from gm-bridge.mjs, bridge-guards.mjs or search-tokens.mjs, but not the two that
 * answer their value (`requestCleanableTraces`, `requestObserveTarget`) - may be a
 * bare statement, `void`, or a variable read only as `.ok`, `.value`, `.refused`,
 * `.reason` or `.pending`.
 * Anything else is reported, outside the files that define requests (gm-bridge.mjs,
 * bridge-guards.mjs) and the helpers that do (`askTraps` in traps.mjs). Its fixture,
 * audit/harness/lint-fixtures/bridge-result.mjs, holds seven reported uses and
 * three allowed ones, and run-all's lint part is red unless exactly the seven are.
 */
const PRODUCER_FILES = new Set(["./gm-bridge.mjs", "./bridge-guards.mjs", "./search-tokens.mjs"]);
const READS = new Set(["ok", "value", "refused", "reason", "pending"]);
const DEFINING = /(?:^|[\\/])scripts[\\/](?:gm-bridge|bridge-guards)\.mjs$/;
const HELPERS = { "traps.mjs": ["askTraps"] };
const isProducerName = name => ["bridgeRequest", "ask", "sendDespairToPrimary"].includes(name)
    || (/^request[A-Z]/.test(name) && !["requestCleanableTraces", "requestObserveTarget"].includes(name));
const BRIDGE_RESULT = {
    meta: {
        type: "problem", schema: [],
        messages: { leaves: "{{name}}() answers the bridge's result, which is truthy whatever it says: read .ok, .value, .refused, .reason or .pending where it is asked, and do not {{how}} it" }
    },
    create(context) {
        const file = context.filename;
        if (DEFINING.test(file)) return {};
        const helpers = HELPERS[file.split(/[\\/]/).pop()] ?? [];
        // The helpers are producers wherever the file calls them - above their own declaration too.
        const producers = new Set(helpers);
        const bind = (imported, local) => { if (isProducerName(imported)) producers.add(local); };
        const inHelper = node => {
            for (let n = node.parent; n; n = n.parent) {
                const name = n.type === "FunctionDeclaration" ? n.id?.name
                    : n.type === "VariableDeclarator" && /Function/.test(n.init?.type ?? "") ? n.id?.name : null;
                if (name && helpers.includes(name)) return true;
            }
            return false;
        };
        // What becomes of the call's answer: null when it is read where it was asked.
        const fate = call => {
            let node = call, parent = call.parent;
            while (parent.type === "AwaitExpression" || parent.type === "ChainExpression") { node = parent; parent = node.parent; }
            switch (parent.type) {
                case "ExpressionStatement": return null;
                case "UnaryExpression": return parent.operator === "void" ? null : "test";
                case "MemberExpression": return parent.object === node && !parent.computed && READS.has(parent.property.name) ? null : "read";
                case "ReturnStatement": return "return";
                case "ArrowFunctionExpression": return "return";
                case "IfStatement": case "ConditionalExpression": case "LogicalExpression":
                case "WhileStatement": case "DoWhileStatement": case "ForStatement": return "test";
                case "CallExpression": case "NewExpression": case "ArrayExpression": case "SpreadElement": case "Property": return "pass on";
                case "VariableDeclarator": return parent.init === node ? stored(parent) : "use";
                case "AssignmentExpression": return "store";
                default: return "use";
            }
        };
        // A variable: every later read must be one of READS; a destructuring may take only those.
        const stored = declarator => {
            if (declarator.id.type === "ObjectPattern") {
                return declarator.id.properties.every(p => p.type === "Property" && !p.computed && READS.has(p.key.name)) ? null : "take apart";
            }
            if (declarator.id.type !== "Identifier") return "take apart";
            const [variable] = context.sourceCode.getDeclaredVariables(declarator);
            const reads = (variable?.references ?? []).filter(ref => ref.identifier !== declarator.id);
            return reads.every(ref => {
                const parent = ref.identifier.parent;
                return parent.type === "MemberExpression" && parent.object === ref.identifier && !parent.computed && READS.has(parent.property.name);
            }) ? null : "read the whole of";
        };
        return {
            ImportDeclaration(node) {
                if (!PRODUCER_FILES.has(node.source.value)) return;
                for (const spec of node.specifiers) if (spec.type === "ImportSpecifier") bind(spec.imported.name, spec.local.name);
            },
            VariableDeclarator(node) {
                const init = node.init?.type === "AwaitExpression" ? node.init.argument : null;
                if (init?.type !== "ImportExpression" || !PRODUCER_FILES.has(init.source?.value) || node.id.type !== "ObjectPattern") return;
                for (const p of node.id.properties) {
                    if (p.type === "Property" && !p.computed && p.value.type === "Identifier") bind(p.key.name, p.value.name);
                }
            },
            "CallExpression:exit"(node) {
                if (node.callee.type !== "Identifier" || !producers.has(node.callee.name) || inHelper(node)) return;
                const how = fate(node);
                if (how) context.report({ node, messageId: "leaves", data: { name: node.callee.name, how } });
            }
        };
    }
};
const DRPG = { rules: { "bridge-result": BRIDGE_RESULT } };

const LANG = { ecmaVersion: "latest", sourceType: "module" };
export default [
    { ignores: ["**/node_modules/**", "audit/harness/results/**", "audit/gate/evidence/**", "audit/gate/.work/**",
        "docs/**",                         // design papers (docs/design/glass-recipe.js), not code that runs
        "macros/**",                       // Foundry macro bodies: top-level return and await, which a module parser refuses
        "audit/handoff/**",                // a temporary hand-over folder, deleted in the 1.2.61 release commit
        "audit/harness/lib/dh-relay.mjs",  // Daggerheart's relay, copied verbatim and never edited (CLAUDE.md)
        "audit/harness/lint-fixtures/**"]  // planted violations, linted by run-all's lint part as a file of scripts/
    },
    { files: ["scripts/**/*.mjs"], languageOptions: { ...LANG, globals: { ...BROWSER, ...FOUNDRY } },
      linterOptions: { reportUnusedDisableDirectives: "error" }, plugins: { drpg: DRPG },
      rules: { ...RULES, "drpg/bridge-result": "error" } },
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
