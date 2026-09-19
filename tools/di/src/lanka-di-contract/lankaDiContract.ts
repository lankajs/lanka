/**
 * The contract — what a consumer must put on the table.
 *
 * ## Why the framework does not simply import the app
 *
 * Gateways, scenarios, singletons and shared stores are resolved BY NAME, which
 * requires seeing the classes — and a package cannot import its own consumer. So
 * the direction is inverted: the app publishes barrels at one well-known path
 * and the framework reads them through the `@lanka_di` alias.
 *
 * That path is at the CONSUMER'S ROOT, beside `package.json`, where `.storybook/`
 * and `.husky/` live and for the same reason: it is wiring, not application
 * source, and a tool that must find it needs to know only the project root.
 *
 * The leading dot says "generated wiring, not code you browse". It costs
 * something: TypeScript's wildcard `include` skips dot-directories, so the
 * mapping must be explicit. `verifyLankaDi` checks that it is, because a missing
 * mapping does not fail — it silently un-types the one file that wires the whole
 * application.
 *
 * ## Why the directory has two names and the alias has one
 *
 * `.lanka` is what a new project gets; `.lanka_di` is what the first consumers
 * got. Both are read, neither is deprecated, and which one a project uses is a
 * layout choice it makes once. `resolveLankaDiDir` answers it from what is on
 * disk, so upgrading moves nothing and a project that never chooses is never
 * asked.
 *
 * The ALIAS is not part of that choice. `@lanka_di` is written into the
 * framework's own source — `import * as GatewaysModule from "@lanka_di/Gateways"`
 * — so it is a name the framework promises rather than a layout a consumer picks,
 * and it stays the same whichever directory it points at.
 */

export interface ILankaBarrelSpec {
	/** File name inside the barrel directory. */
	readonly file: string;
	/**
	 * A named export the framework calls by name, if any.
	 *
	 * `null` means the module is read as a NAMESPACE and everything is derived
	 * from what it exports: adding a gateway is one export line and no
	 * registration. Such barrels are legal while empty, which is what lets a
	 * scaffolded project boot before it has any gateways at all.
	 */
	readonly requiredExport: string | null;
	/** What is written in place of a missing file. */
	readonly stub: string;
}

/**
 * The contract version.
 *
 * Inside a monorepo a version means nothing: package and consumer update in one
 * commit. Published to npm, "file present, export present, different semantics"
 * becomes possible — barrels written for a previous contract that the check
 * accepts while the framework reads something else.
 *
 * Bump it when what the framework EXPECTS of the barrels changes: a new required
 * export, a different shape for an existing one, a different set of files. Not
 * for framework-internal edits the barrels never see.
 */
const VERSION = 1;

/**
 * Every directory name this tool recognises, in the order it prefers them.
 *
 * `.lanka` first because it is what a new project gets: one word, like every
 * other tool's directory at a project root, and room for whatever else the
 * framework ever needs to keep beside the barrels.
 *
 * `.lanka_di` second because it is what the first consumers got. It is an
 * ALTERNATIVE, not a deprecation: a project on it is correct, stays correct, and
 * is never nagged. Nothing here is allowed to prefer one at the cost of breaking
 * the other — the preference decides a project that has NEITHER, and nothing
 * else.
 *
 * The list is closed at two on purpose. A free-form directory name would make
 * the tsconfig check unable to say what to add, and would put a project's layout
 * beyond what a reader of this file can know.
 */
const DIRNAMES = Object.freeze([".lanka", ".lanka_di"] as const);

/** A directory name the tool recognises. */
export type TLankaDiDirname = (typeof DIRNAMES)[number];

const NAMESPACE_STUB = (what: string, example: string): string =>
	`/**\n * ${what} this app publishes to \`lanka\`.\n *\n * Add one export line per class; the framework derives the locator from these\n * exports, so there is nothing else to register.\n *\n * @example export { ${example} } from "../src/...";\n */\nexport {};\n`;

/**
 * The whole contract as one value: version, location, alias, and every barrel.
 *
 * One object rather than four constants, because the parts mean something only
 * together — a version without the barrels it versions says nothing. The barrel
 * list in particular is the single declaration: the plugin verifies against it,
 * the scaffolder writes from it, and its spec asserts both, so another barrel is
 * one entry here rather than an edit in three places that may disagree.
 *
 * **Every array inside is frozen too.** `Object.freeze` is SHALLOW and `as const`
 * is erased at build, so the outer call alone leaves `dirnames` and `barrels`
 * as globals that anybody importing this package can push to — and six adapters,
 * the scaffolder, the verifier and the migration would all quietly obey on their
 * next run. Its spec asserts each one.
 */
export const lankaDiContract = Object.freeze({
	version: VERSION,

	/**
	 * The directory a project gets when it has none — the DEFAULT, not the only one.
	 *
	 * Reading this to find where a given project's barrels are is the mistake this
	 * field cannot prevent on its own: a project on `.lanka_di` is equally
	 * correct and this says `.lanka`. Ask `resolveLankaDiDir(root)`, which looks.
	 */
	dirname: DIRNAMES[0] satisfies TLankaDiDirname,

	/**
	 * Every directory name that is a valid answer, preferred first.
	 *
	 * The preference orders `resolveLankaDiDir`'s search and nothing more: what a
	 * project HAS always beats what this list would rather it had.
	 */
	dirnames: DIRNAMES,

	/** The import alias the framework reads those barrels through. */
	alias: "@lanka_di",

	/**
	 * The npm package whose published code contains that alias.
	 *
	 * Named here because a bundler sometimes has to be told which package to
	 * PROCESS rather than hand to the runtime. Vite's SSR build externalises
	 * anything under `node_modules` by default, and an externalised module is
	 * loaded by node — which knows nothing of vite's aliases, and answers
	 * `Cannot find package '@lanka_di/Gateways'`. The alias alone cannot say
	 * this: it names what is imported, not who imports it.
	 *
	 * One name and not a list: `lanka` is the only published package whose
	 * output carries the alias. The modules and plugins reach the barrels
	 * THROUGH it, so processing it is enough for all of them.
	 */
	packageName: "lanka",

	/** Every file the directory must hold, in the order a reader should meet them. */
	barrels: Object.freeze([
		{
			file: "Contract.ts",
			requiredExport: "lankaDiContractVersion",
			stub:
				`/**\n * The lanka contract version these barrels are written for.\n *\n * Updated when the framework is updated, not by hand: the number tells it\n * the barrels beside it are shaped as it expects. Out of step, they give\n * the most expensive failure — file present, export present, different\n * semantics.\n */\nexport const lankaDiContractVersion = ` +
				String(VERSION) +
				";\n",
		},
		{
			file: "Host.ts",
			requiredExport: "lankaHost",
			stub: `import type { ILankaHost } from "lanka";\n\n/**\n * What this app supplies to \`lanka\`.\n *\n * The framework ships the layers and deliberately knows neither where this app\n * talks to, how it phrases a failure, nor how it phrases a timeout. Every\n * field is required, so that it is wrong loudly rather than defaulted quietly.\n */\nexport const lankaHost: ILankaHost = {\n\tapiBaseUrl: "/api",\n\thttpErrorMessage: (status: number): string => \`Request failed with status \${status}\`,\n\tnetworkErrorMessage: (): string => "Network error",\n\ttimeoutErrorMessage: (): string => "Request timed out",\n};\n`,
		},
		{
			file: "Gateways.ts",
			requiredExport: null,
			stub: NAMESPACE_STUB("The gateways", "UserGateway"),
		},
		{
			file: "Scenarios.ts",
			requiredExport: null,
			stub: NAMESPACE_STUB("The scenarios", "SessionScenario"),
		},
		{
			file: "SharedStores.ts",
			requiredExport: null,
			stub: NAMESPACE_STUB("The shared stores", "UserSharedStore"),
		},
		{
			file: "Singletons.ts",
			requiredExport: null,
			stub: NAMESPACE_STUB("The singletons", "AnalyticsService"),
		},
	] satisfies readonly ILankaBarrelSpec[]),
} as const);
