import { lankaDiContract } from "@lankajs/tool-di";
import type { ILankaInitChoices } from "../../_interfaces/ILankaInitChoices";
import type { ILankaInitFile } from "../../_interfaces/ILankaInitFile";
import type { ILankaInitTemplate } from "../../_interfaces/ILankaInitTemplate";

/**
 * The files a BUILD reads: the alias, the paths, the rules and the test runner.
 *
 * One of them is not optional and the rest are. The framework imports
 * `@lanka_di/Gateways` and three siblings at module level, so a build with no
 * alias does not degrade — it fails to resolve, on the first of them, before any
 * of the application has run. WHICH file carries the alias is the only thing
 * that differs between the eleven templates, and it is a lookup below rather
 * than a branch.
 *
 * None of this creates the host application. `create-vite`, `create-next-app`
 * and `create-expo-app` exist and are better at it; what is written here is the
 * part they cannot know about.
 */

const DIR = lankaDiContract.dirname;

/**
 * What the compiler has to be told about JSX, and nothing more.
 *
 * `DOM` stays in `lib` for every template, the node one included, and that is a
 * TYPECHECKER setting rather than a claim about where the code runs: the
 * framework's own sources name the fetch vocabulary — `RequestInfo`, `BodyInit`,
 * `HeadersInit` — and all of those live in `lib.dom` while node implements the
 * ones that matter.
 */
const jsxOptions = (template: ILankaInitTemplate): string => {
	if (template.framework === "react") return `\n\t\t"jsx": "react-jsx",`;
	if (template.framework === "solid") {
		return `\n\t\t"jsx": "preserve",\n\t\t"jsxImportSource": "solid-js",`;
	}
	if (template.framework === "angular") return `\n\t\t"experimentalDecorators": true,`;

	return "";
};

const tsconfigText = (template: ILankaInitTemplate): string => `{
	"//include": "TypeScript's wildcard include SKIPS dot-directories, so ${DIR} is named explicitly. Without it the barrels are typed only because something imports them: no strict, no editor errors, in the one file that wires the whole application.",
	"//strictness": "The framework's own settings, and no stricter. verbatimModuleSyntax in particular is deliberately absent: the code written here uses \`import type\` everywhere it should, and turning the flag on makes a workspace that links the framework from SOURCE fail in files nobody here wrote.",
	"compilerOptions": {
		"target": "ES2022",
		"module": "ESNext",
		"moduleResolution": "bundler",
		"lib": ["ES2023", "DOM", "DOM.Iterable"],
		"strict": true,
		"noEmit": true,
		"skipLibCheck": true,
		"esModuleInterop": true,${jsxOptions(template)}
		"paths": {
			"${lankaDiContract.alias}/*": ["./${DIR}/*"]
		}
	},
	"include": ["src/**/*", "${DIR}/**/*"]
}
`;

const TSCONFIG_KEPT =
	`add \`"${lankaDiContract.alias}/*": ["./${DIR}/*"]\` under compilerOptions.paths, and ` +
	`"${DIR}/**/*" to include. Neither is optional and neither fails loudly: a missing ` +
	"mapping silently un-types the files that wire the whole application.";

const viteText = (template: ILankaInitTemplate): string => {
	const plugin = template.vitePlugin;

	return `${plugin === undefined ? "" : `${plugin.importLine}\n`}import { defineConfig } from "vite";
import { lankaDiVite } from "@lankajs/tool-di/vite";

/**
 * The build.
 *
 * \`lankaDiVite\` is not optional: the framework imports \`@lanka_di/Gateways\`
 * and its siblings at module level, so a build without the alias fails on the
 * first of them. It also sets two things whose absence does NOT fail loudly —
 * the dependency optimiser's exclusion, and the SSR externalisation — which is
 * why this is a plugin rather than a line in a guide.
 *
 * \`scaffold: !process.env.CI\` because a build that quietly repairs itself
 * hides a \`${DIR}/\` nobody committed, until the day it is built somewhere else.
 */
export default defineConfig({
	plugins: [${plugin === undefined ? "" : `${plugin.call}, `}lankaDiVite({ scaffold: !process.env.CI })],
});
`;
};

const NEXT = `import { lankaDiTurbopack } from "@lankajs/tool-di/turbopack";
import { lankaDiWebpack } from "@lankajs/tool-di/webpack";

const scaffold = !process.env.CI;

/**
 * Both halves, in one file, because Next uses two bundlers.
 *
 * Turbopack runs \`next dev\` and webpack may still run the production build, so
 * a project that wired only one has an alias in development and none in CI —
 * which arrives as "module not found" for \`@lanka_di/Gateways\` at the least
 * convenient moment.
 *
 * @type {import("next").NextConfig}
 */
export default {
	turbopack: { ...lankaDiTurbopack({ scaffold }) },
	webpack: (config) => {
		config.plugins.push(lankaDiWebpack({ scaffold }));
		return config;
	},
};
`;

const NUXT = `import { defineNuxtConfig } from "nuxt/config";
import { lankaDiVite } from "@lankajs/tool-di/vite";

/**
 * Nuxt's build, with the one plugin the framework needs.
 *
 * It goes into \`vite.plugins\` rather than into a Nuxt module, because Nuxt's
 * build IS Vite: the plugin a single-page application uses is the plugin this
 * uses.
 */
export default defineNuxtConfig({
	vite: { plugins: [lankaDiVite({ scaffold: !process.env.CI })] },
});
`;

const METRO = `const { getDefaultConfig } = require("expo/metro-config");
const { lankaDiMetro } = require("@lankajs/tool-di/metro");

/**
 * Metro has no plugin array, so the integration is a FUNCTION of the config.
 *
 * It MERGES into \`resolver.extraNodeModules\` rather than replacing it, which
 * is what lets it compose with whatever else a project has written there.
 */
module.exports = lankaDiMetro(getDefaultConfig(__dirname), { scaffold: !process.env.CI });
`;

const BUNDLER_KEPT =
	"this build config is yours. Add the alias plugin to it — the package's guide has the " +
	"three lines — or the first import of `@lanka_di/Gateways` fails to resolve.";

/** Which file carries the alias, by build. A template with no bundler has none. */
const BUNDLER: Readonly<Record<string, (template: ILankaInitTemplate) => ILankaInitFile | null>> = {
	vite: (template) => ({
		path: "vite.config.ts",
		text: viteText(template),
		gist: "the alias, the optimiser exclusion and the SSR externalisation",
		whenKept: BUNDLER_KEPT,
	}),
	sveltekit: (template) => ({
		path: "vite.config.ts",
		text: viteText(template),
		gist: "the alias, beside Kit's own plugin",
		whenKept: BUNDLER_KEPT,
	}),
	next: () => ({
		path: "next.config.mjs",
		text: NEXT,
		gist: "the alias, in both of Next's bundlers",
		whenKept: BUNDLER_KEPT,
	}),
	nuxt: () => ({
		path: "nuxt.config.ts",
		text: NUXT,
		gist: "the alias, in Nuxt's vite",
		whenKept: BUNDLER_KEPT,
	}),
	metro: () => ({
		path: "metro.config.js",
		text: METRO,
		gist: "the alias, as a config function",
		whenKept: BUNDLER_KEPT,
	}),
	none: () => null,
};

const ESLINT = `import { lankaBoundaries } from "@lankajs/tool-eslint";

/**
 * The framework's main promise, checked rather than agreed: imports go one way.
 *
 * A ViewModel may reach a gateway and a gateway may not know ViewModels exist;
 * nothing below the top layer reaches into it; and your own code does not read
 * the \`${DIR}/\` barrels, which are the framework's to read.
 *
 * The paths in the rules are SETTINGS. A tree laid out differently configures
 * them — it does not switch them off.
 */
export default [lankaBoundaries];
`;

const vitestText = (isBrowser: boolean): string => `import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * The alias again, for the one build that is not the application's.
 *
 * A test run resolves \`${lankaDiContract.alias}/*\` itself: vitest does not read the bundler
 * config's plugin, and without this every test touching the locator fails with a
 * module it cannot find. Pointed at the project's REAL barrels rather than at a
 * fixture, so that the wiring is part of what is tested.
 */
const barrels = fileURLToPath(new URL("./${DIR}", import.meta.url));

export default defineConfig({
	resolve: { alias: { "${lankaDiContract.alias}": barrels } },
	test: {
		globals: true,
		environment: ${isBrowser ? '"jsdom"' : '"node"'},
		alias: { "${lankaDiContract.alias}": barrels },
		setupFiles: ["@lankajs/tool-testing/setupTests"],
	},
});
`;

/** What a project of this shape is usually run with. */
const SCRIPTS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
	vite: { dev: "vite", build: "vite build", preview: "vite preview" },
	sveltekit: { dev: "vite dev", build: "vite build", preview: "vite preview" },
	next: { dev: "next dev", build: "next build", start: "next start" },
	nuxt: { dev: "nuxt dev", build: "nuxt build", preview: "nuxt preview" },
	metro: { start: "expo start", android: "expo run:android", ios: "expo run:ios" },
	none: { start: "tsx src/main.ts" },
};

/** The last segment of a path, whichever slash the caller's machine writes. */
const projectName = (root: string): string =>
	root.split(/[\\/]/).filter(Boolean).pop() ?? "lanka-app";

/**
 * A manifest, for the one case where there is none: an empty directory.
 *
 * Written only when the project has no `package.json` at all, which is what
 * "nothing is overwritten" already guarantees. It exists because the install
 * needs one — `pnpm add` in a directory without a manifest is an error, and the
 * whole command would end on it.
 *
 * `type: "module"` everywhere but Metro, whose config file is CommonJS and whose
 * ecosystem still is.
 */
const manifestText = (choices: ILankaInitChoices): string => {
	const { template } = choices;
	const took = (id: string): boolean => choices.extras.some((extra) => extra.id === id);

	return `${JSON.stringify(
		{
			name: projectName(choices.root),
			private: true,
			...(template.build === "metro" ? {} : { type: "module" }),
			scripts: {
				...SCRIPTS[template.build],
				typecheck: "tsc -p tsconfig.json --noEmit",
				...(took("testing") ? { test: "vitest run" } : {}),
				...(took("eslint") ? { lint: "eslint ." } : {}),
			},
		},
		null,
		"\t",
	)}\n`;
};

/**
 * Every file a build reads, for one set of choices.
 *
 * The conditional ones are conditional on an ANSWER rather than on a template: a
 * project that did not take the boundary rules gets no `eslint.config.mjs`,
 * because a config naming a package they have not installed is a file that fails
 * the first time anything runs it.
 */
export const lankaInitBuildFiles = (choices: ILankaInitChoices): readonly ILankaInitFile[] => {
	const { template } = choices;
	const bundler = BUNDLER[template.build]?.(template) ?? null;
	const took = (id: string): boolean => choices.extras.some((extra) => extra.id === id);

	return [
		{
			path: "package.json",
			text: manifestText(choices),
			gist: "a manifest, so there is something to install into",
			whenKept:
				"your manifest, untouched. The dependencies are added to it by the package " +
				"manager; the scripts above are not, and the guide lists them.",
		},
		{
			path: "tsconfig.json",
			text: tsconfigText(template),
			gist: `the ${lankaDiContract.alias} path mapping, and the include that reaches ${DIR}`,
			whenKept: TSCONFIG_KEPT,
		},
		...(bundler === null ? [] : [bundler]),
		...(took("eslint")
			? [{ path: "eslint.config.mjs", text: ESLINT, gist: "imports go one way" }]
			: []),
		...(took("testing")
			? [
					{
						path: "vitest.config.ts",
						text: vitestText(template.runtime.includes("browser")),
						gist: "the alias for the test run, and the reset between tests",
					},
				]
			: []),
	];
};
