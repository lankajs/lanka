import js from "@eslint/js";
import globals from "globals";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import pluginSvelte from "eslint-plugin-svelte";
import pluginVue from "eslint-plugin-vue";
import reactHooks from "eslint-plugin-react-hooks";
import svelteParser from "svelte-eslint-parser";
import vueParser from "vue-eslint-parser";
import tseslint from "typescript-eslint";
import { PACKAGES, pkgDir } from "./scripts/registry.mjs";

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
			// A host framework's build output, under `_playgrounds/`. `dist/` above
			// covers what this repository builds; these are what Next, Astro and Expo
			// write, and they are generated the same way — `.next/types/*.d.ts` is a
			// file nobody here wrote and nobody here can fix.
			"**/.next/**",
			"**/.astro/**",
			"**/.nuxt/**",
			"**/.output/**",
			"**/.expo/**",
			"**/.svelte-kit/**",
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
		rules: {
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

	/**
	 * React's rules, applied to React's packages and to nothing else.
	 *
	 * `react-hooks` reads the `use…` prefix as a promise that React's rules apply.
	 * Every member of `modules/bindings/` publishes `useLankaVM` — deliberately, so
	 * a consumer moving a screen between frameworks reads one guide — and the
	 * plugin therefore reported `rules-of-hooks` against Vue's `setup()`, where the
	 * word means "read this" and React has no jurisdiction.
	 *
	 * The scoping is by what the registry says a package REQUIRES, not by a path
	 * guess: `framework: "react"` is the same declaration `check-runtime.mjs`
	 * reads, so a sixth binding is a registry line here too, and a Vue package can
	 * never quietly inherit a React rule. `skills/hosts/SKILL.md` 1a owns the field.
	 */
	{
		files: [
			...PACKAGES.filter((pkg) => pkg.framework === "react").flatMap((pkg) => [
				`${pkgDir(pkg)}/**/*.ts`,
				`${pkgDir(pkg)}/**/*.tsx`,
			]),
			// The APPLICATIONS that render React, named one ecosystem at a time. It
			// was `_playgrounds/**/*.tsx` until a Solid application arrived and
			// inherited `rules-of-hooks` over `useLankaVM`, which in Solid is a plain
			// call with no ordering rule attached to it — the same mistake this block
			// already records against Vue, made a second time by a glob.
			"_playgrounds/react/**/*.tsx",
			"_playgrounds/astro/**/*.tsx",
		],
		plugins: { "react-hooks": reactHooks },
		rules: { ...reactHooks.configs.recommended.rules },
	},

	/**
	 * Vue single-file components, under `_playgrounds/` and nowhere else.
	 *
	 * A `.vue` file is markup, script and style in one, and no TypeScript parser
	 * reads it: without `vue-eslint-parser` the whole file is skipped, which is the
	 * quiet kind of gap this repository's gates exist to close — `pnpm lint` would
	 * pass a component with anything in it at all.
	 *
	 * Scoped to the applications because they are the only place SFCs live: a
	 * BINDING is a hook and a render helper, and `modules/bindings/vue` needs no
	 * compiler for either. What an SFC proves is a consumer's build, and that is
	 * what an application is for.
	 *
	 * The plugin's own config ENTRIES are spread rather than its rules, because a
	 * `.vue` file needs its PROCESSOR too: without one, `vue/comment-directive`
	 * reports the template's boundaries as errors, which is the plugin saying it
	 * was handed a file nobody split into blocks.
	 *
	 * `flat/essential` and not `flat/recommended`: the recommended set carries
	 * stylistic rules, and prettier owns formatting everywhere else here. Two
	 * formatters over one file disagree, and the one that runs last wins by
	 * accident rather than by decision.
	 */
	...pluginVue.configs["flat/essential"].map((one) => ({
		...one,
		files: ["_playgrounds/**/*.vue"],
	})),
	{
		files: ["_playgrounds/**/*.vue"],
		languageOptions: {
			parser: vueParser,
			parserOptions: {
				parser: tseslint.parser,
				ecmaVersion: "latest",
				sourceType: "module",
				// No project service: a `.vue` file is checked for TYPES by `vue-tsc`,
				// which the package's own `typecheck` script runs and which understands
				// the format. Asking eslint's service to load every SFC as well doubles
				// the work and — measured here — exhausts the heap.
				projectService: false,
				project: false,
			},
			globals: { ...globals.browser },
		},
	},
	/**
	 * Svelte components, under `_playgrounds/` and nowhere else.
	 *
	 * The same arrangement the Vue block above makes, for the same reason: a
	 * `.svelte` file is markup and script in one, no TypeScript parser reads it,
	 * and without `svelte-eslint-parser` the file is skipped WHOLE — reported as
	 * zero problems, which is the way a lint gate lies.
	 *
	 * Scoped to the applications: `modules/bindings/svelte` is `createSubscriber`
	 * and a render helper, and needs no compiler for either. What a component
	 * proves is a consumer's build.
	 *
	 * `extraFileExtensions` is the one line Vue's block does not need — Svelte's
	 * parser hands the script block to the TypeScript parser, which refuses a file
	 * whose extension it was not told about.
	 */
	...pluginSvelte.configs["flat/base"].map((one) => ({
		...one,
		files: ["_playgrounds/**/*.svelte"],
	})),
	{
		files: ["_playgrounds/**/*.svelte"],
		languageOptions: {
			parser: svelteParser,
			parserOptions: {
				parser: tseslint.parser,
				ecmaVersion: "latest",
				sourceType: "module",
				// No project service: a `.svelte` file is checked for TYPES by
				// `svelte-check`, which the package's own `typecheck` script runs and
				// which understands the format.
				projectService: false,
				project: false,
				extraFileExtensions: [".svelte"],
			},
			globals: { ...globals.browser },
		},
	},
);
