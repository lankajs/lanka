/**
 * The `.lanka_di` contract — what a consumer must put on the table.
 *
 * ## Why the framework does not simply import the app
 *
 * Gateways, scenarios, singletons and shared stores are resolved BY NAME, which
 * requires seeing the classes — and a package cannot import its own consumer. So
 * the direction is inverted: the app publishes barrels at one well-known path
 * and the framework reads them through the `@lanka_di` alias.
 *
 * That path is `.lanka_di/` at the CONSUMER'S ROOT, beside `package.json`, where
 * `.storybook/` and `.husky/` live and for the same reason: it is wiring, not
 * application source, and a tool that must find it needs to know only the
 * project root.
 *
 * The leading dot says "generated wiring, not code you browse". It costs
 * something: TypeScript's wildcard `include` skips dot-directories, so the
 * mapping must be explicit. `verifyLankaDi` checks that it is, because a missing
 * mapping does not fail — it silently un-types the one file that wires the whole
 * application.
 */

export interface ILankaBarrelSpec {
	/** File name inside `.lanka_di/`. */
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
 */
export const lankaDiContract = Object.freeze({
	version: VERSION,

	/** The directory a consumer publishes its barrels in, relative to its root. */
	dirname: ".lanka_di",

	/** The import alias the framework reads those barrels through. */
	alias: "@lanka_di",

	/** Every file `.lanka_di/` must hold, in the order a reader should meet them. */
	barrels: [
		{
			file: "Contract.ts",
			requiredExport: "lankaDiContractVersion",
			stub:
				`/**\n * The \`.lanka_di\` contract version these barrels are written for.\n *\n * Updated when the framework is updated, not by hand: the number tells it\n * the barrels beside it are shaped as it expects. Out of step, they give\n * the most expensive failure — file present, export present, different\n * semantics.\n */\nexport const lankaDiContractVersion = ` +
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
	] satisfies readonly ILankaBarrelSpec[],
} as const);
