import js from "@eslint/js";
import globals from "globals";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

/**
 * Lint policy for the monorepo.
 *
 * ## One config for everything
 *
 * Sixteen packages, one rule set. A config per package would be sixteen copies,
 * fifteen of which eventually fall behind — and a glob that matches nothing does
 * not fail, it silently lints nobody.
 *
 * ## The rule this file exists for
 *
 * `NO_CONSUMER_IMPORTS`. The framework may not reach into the application using
 * it, and inside a package no type error stops that. `@lanka_di/*` is the only
 * permitted inversion, and it is a CONTRACT: five barrels the consumer
 * publishes, verified at build time.
 *
 * Layer-direction rules and "a gateway is called only from a ViewModel" belong
 * to `@lankajs/tool-eslint`.
 */
const NO_CONSUMER_IMPORTS = {
	group: ["@App/*", "@Core/*", "@Gateways/*", "@Modules/*", "@Scenarios/*", "@ViewModels/*"],
	message:
		"The framework does not import from the consuming application. The only permitted direction is `@lanka_di/*`, the barrels a consumer publishes to the framework (tools/vite/src/lankaDiContract.ts).",
};

/**
 * A plugin may not import another plugin: they occupy different extension points
 * of one core and know nothing about each other. Shared code moves to a module,
 * which by definition needs no hook.
 */
const NO_PLUGIN_TO_PLUGIN = {
	group: ["@lankajs/plugin-*"],
	message:
		"A plugin does not depend on another plugin. Shared code moves to a module (`modules/`), which nobody needs as a peer.",
};

/**
 * Core knows about neither modules nor plugins — otherwise it stops being core.
 * The machine-checked form of the same distinction `peerDependencies` express:
 * dependencies point one way.
 */
const CORE_KNOWS_NOTHING = {
	group: ["@lankajs/*"],
	message:
		"Core depends on neither a module nor a plugin. If core needs something, it is either part of core or an extension point a plugin will occupy.",
};

export default tseslint.config(
	{
		ignores: [
			"**/node_modules/**",
			"**/dist/**",
			"**/coverage/**",
			// The fixture is generated from the DI contract and compared byte for
			// byte. Linting it means formatting it, and a formatted fixture no longer
			// matches the text the framework writes into a consumer's repository.
			"tools/testing/_fixtures/.lanka_di/**",
		],
	},
	eslintPluginPrettierRecommended,
	{
		extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
		files: ["**/*.{ts,tsx}"],
		languageOptions: {
			ecmaVersion: 2022,
			globals: globals.browser,
			// Type-aware: without it the whole promise family sleeps
			// (no-floating-promises / no-misused-promises / await-thenable), and an
			// async bootstrap, the gateway transport and the scenario bus live here.
			parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
		},
		plugins: { "react-hooks": reactHooks },
		rules: {
			...reactHooks.configs.recommended.rules,
			"no-restricted-imports": ["error", { patterns: [NO_CONSUMER_IMPORTS] }],
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
					ignoreRestSiblings: true,
				},
			],
		},
	},
	{
		// Dependency direction between packages. Stated here rather than left to
		// `package.json`: an installer catches a missing dependency but not a
		// superfluous one added "to make it work".
		//
		// Core's RUNTIME, not its tests. Core specs need the host stub from
		// `@lankajs/tool-testing` — the only permitted upward look, dev-only and
		// never shipped; the alternative is a second copy of `lankaTestHost` in
		// core, two truths about what stands in for a host. Tests are excepted
		// below, not amnestied: `NO_CONSUMER_IMPORTS` still applies to them.
		//
		// The playground is excepted for the same reason and no other: it starts
		// the framework the way an application does, which requires a host, and it
		// is not published either. Nothing under `core/src` is excepted.
		files: ["core/**/*.ts", "core/**/*.tsx"],
		// A bench is a test that reports a number instead of a verdict, and it
		// needs the same host stub for the same reason.
		ignores: [
			"core/**/*.test.ts",
			"core/**/*.test.tsx",
			"core/**/*.bench.ts",
			"core/**/*.bench.tsx",
			"core/_playground/**",
		],
		rules: {
			"no-restricted-imports": [
				"error",
				{ patterns: [NO_CONSUMER_IMPORTS, CORE_KNOWS_NOTHING] },
			],
		},
	},
	{
		files: ["plugins/**/*.ts"],
		rules: {
			"no-restricted-imports": [
				"error",
				{ patterns: [NO_CONSUMER_IMPORTS, NO_PLUGIN_TO_PLUGIN] },
			],
		},
	},
	{
		// `tools/` and `scripts/` run before runtime: node globals, no browser.
		files: ["tools/**/*.ts", "scripts/**/*.mjs"],
		languageOptions: { globals: globals.node },
	},
	{
		// LEDGER 1 — untyped boundaries. These files talk to things without types:
		// the raw fetch/Response pipeline, the browser console, IndexedDB, and a
		// store factory generic over a whole VM state shape. `any` there is the
		// shape of the outside world, and narrowing it IS each file's job: every
		// consumer below receives a real type.
		//
		// Do NOT add a file here. If a module needs an entry, the narrowing is
		// missing in one of the files listed.
		files: [
			"core/src/logger/LankaLogger.ts",
			"core/src/errors/api-error-handler/lankaApiErrorHandler.ts",
			"core/src/viewmodel/factories/**/*.ts",
			"modules/storage/src/**/*.ts",
		],
		rules: {
			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/no-unsafe-member-access": "off",
			"@typescript-eslint/no-unsafe-call": "off",
			"@typescript-eslint/no-unsafe-return": "off",
			"@typescript-eslint/no-unsafe-argument": "off",
		},
	},
	{
		// LEDGER 2 — the logger is the only place where console is an output
		// device; `no-console` exists so everything else goes through it.
		files: ["core/src/logger/LankaLogger.ts"],
		rules: { "no-console": "off" },
	},
	{
		// LEDGER 3 — conformance to an async port. These files implement an
		// interface whose methods return promises because ANOTHER implementation of
		// the same port really is async (IndexedDB / Cache Storage). The
		// synchronous one has nothing to await, but dropping `async` would break
		// the port. Same for bootstrap services: one signature lets the runner
		// `await` them uniformly.
		//
		// `@lankajs/blob-cache` is here for the same reason: its test doubles
		// implement THE SAME port as the real adapter and must share its signature,
		// or the double would verify a different interface from the one it replaces.
		files: [
			"modules/storage/src/**/*.ts",
			"modules/blob-cache/src/**/*.ts",
			"core/src/bootstrap/Lanka.ts",
		],
		rules: { "@typescript-eslint/require-await": "off" },
	},
	{
		// LEDGER 4 — `{}` meaning "a stateless ViewModel has no state".
		//
		// `no-empty-object-type` suggests `object` or `Record<string, never>`; both
		// were tried. `Record<string, never> & Actions` is uninhabited, and the lazy
		// stateless factory stops type-checking against its own call to the eager
		// one. `{}` is the only type that vanishes cleanly in an intersection, which
		// is exactly what a slot contributing nothing must do.
		files: [
			"core/src/viewmodel/factories/create-lazy-stateless-lanka-vm/createLazyStatelessLankaVM.ts",
			"core/src/viewmodel/factories/create-stateless-lanka-vm/createStatelessLankaVM.test.ts",
		],
		rules: { "@typescript-eslint/no-empty-object-type": "off" },
	},
	{
		// Tests rely on `vi.fn()` doubles and `as any` fixtures, which legitimately
		// trip the type-aware unsafe-* family and `unbound-method`
		// (`expect(obj.method).toHaveBeenCalled()`). `require-await` is noise here
		// too — helpers are often `async` for one signature. Everything else — dead
		// code, the promise family, the direction rules above — DOES apply to tests.
		files: ["**/*.test.{ts,tsx}", "tools/testing/src/**/*.ts"],
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/no-unsafe-member-access": "off",
			"@typescript-eslint/no-unsafe-call": "off",
			"@typescript-eslint/no-unsafe-return": "off",
			"@typescript-eslint/no-unsafe-argument": "off",
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/unbound-method": "off",
			"@typescript-eslint/require-await": "off",
			"@typescript-eslint/no-base-to-string": "off",
			"@typescript-eslint/restrict-template-expressions": "off",
			"no-console": "off",
		},
	},
);
