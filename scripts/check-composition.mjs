/**
 * Checks composition: function length, repeated blocks, branch shape.
 *
 * The canon is `skills/composition/SKILL.md`; this is its executable half.
 *
 * Two of the three rules are RATCHETS. A budget may fall and the entry follows
 * it down; nothing may rise. A ratchet raised to make a build pass has stopped
 * being one — which is why the entries carry the measured number rather than a
 * round one, and why lowering them is the only edit this file invites.
 *
 * Run: node scripts/check-composition.mjs
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const ROOT = ["core", "modules", "plugins", "tools"];

/**
 * Longest function per file, where it exceeds the general budget.
 *
 * Each entry states WHY the shape is right, because a number with no reason is a
 * number someone will raise.
 */
const LONG_FUNCTION_BUDGET = new Map([
	[
		"core/src/bootstrap/_factories/create-lanka/createLanka.ts",
		{
			lines: 140,
			why: "an object literal of delegating methods, plus a teardown closing over its state",
		},
	],
	[
		"core/src/viewmodel/_internal/create-lanka-blind-spot-trap/createLankaBlindSpotTrap.ts",
		{
			lines: 90,
			why: "three methods closing over one trap state; extracting any of them would pass that state as parameters",
		},
	],
	[
		"core/src/viewmodel/_internal/create-lanka-tracked-hook/createLankaTrackedHook.ts",
		{
			lines: 95,
			why: "one hook: subscribe, read tracked, read untracked — splitting hides the ordering",
		},
	],
	[
		"core/src/locator/scenario/lanka-scenario-locator/LankaScenarioLocator.ts",
		{ lines: 72, why: "a constructor configuring one base with four named strategies" },
	],
	[
		"plugins/bootstrap-steps/src/_factories/create-lanka-bootstrap-pipeline/createLankaBootstrapPipeline.ts",
		{ lines: 60, why: "the pipeline closure: its steps read each other's locals" },
	],
	[
		"plugins/http/src/lanka-http/lankaHttp.ts",
		{ lines: 55, why: "one install() wiring six middlewares in a fixed order" },
	],
	[
		"core/src/locator/_factories/create-lanka-scope/createLankaScope.ts",
		{ lines: 52, why: "one scope closure over its own cache" },
	],
	[
		"modules/browser/src/cookies/lanka-cookies/LankaCookies.ts",
		{ lines: 50, why: "one branch per platform capability, each with its own fallback" },
	],
	[
		"tools/di/src/verify-lanka-di/verifyLankaDi.ts",
		{ lines: 50, why: "one report assembled from checks that must run in order" },
	],
	[
		"modules/async/src/_factories/create-lanka-burst-coalescer/createLankaBurstCoalescer.ts",
		{ lines: 48, why: "one coalescer closure over its pending map" },
	],
	[
		"modules/storage/src/cache-storage-polyfill/installLankaCacheStoragePolyfill.ts",
		{ lines: 48, why: "one object literal standing in for a browser API" },
	],
	[
		"modules/storage/_playground/create-playground-secret-notes/createPlaygroundSecretNotes.ts",
		{
			lines: 46,
			why: "one scene holding two ciphers — the ambient one and a second built from the class — and the pair is the subject",
		},
	],
	[
		"modules/collection/_playground/create-playground-employee-list/createPlaygroundEmployeeList.ts",
		{
			lines: 55,
			why: "one screen closing over its own list, sort, filters and page — the shape the package is about, and splitting it would pass all four as parameters",
		},
	],
	[
		"core/src/gateway/request/_abstractions/lanka-request/ALankaRequest.ts",
		{ lines: 45, why: "classifyTransportError: one decision per failure kind, each explained" },
	],
]);

/** Functions may run this long anywhere else. */
const DEFAULT_BUDGET = 40;

/** Files whose repetition is not a copy, with the reason. */
const ALLOWED_REPEATS = [
	// Every vitest config states the same coverage preamble. Sharing it would put
	// a package's thresholds outside the package that has to meet them.
	/vitest\.config\.ts$/,
	// A test's arrange block is meant to be read where it is used.
	/\.(test|spec)\.tsx?$/,
	// Generated from scripts/registry.mjs. Identical by construction, and
	// deduplicating the OUTPUT would put a shared part inside a file the
	// scaffolder rewrites wholesale.
	/tsup\.config\.ts$/,
];

/**
 * Blocks allowed to repeat, by their first line.
 *
 * Three identical CALLS to a shared abstraction are the point of extracting it,
 * not a copy of it. Nothing else belongs here: a repeated block that is not a
 * call to something already shared is the third occurrence the canon names.
 */
const ALLOWED_BLOCKS = [
	"const { initializeScenario, resetScenario } = createLankaScenarioBinder({",
];

const files = execSync("git ls-files", { cwd: ".", encoding: "utf8" })
	.trim()
	.split("\n")
	.filter((path) => /\.tsx?$/.test(path) && ROOT.some((root) => path.startsWith(root + "/")))
	// Still on disk: the index remembers a path until its deletion is staged, and
	// reading one mid-rename crashes the guard instead of reporting anything.
	.filter((path) => existsSync(path));

const problems = [];
const fail = (rule, where, message) => problems.push(`[${rule}] ${where}\n    ${message}`);

const withoutComments = (source) =>
	source
		.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""))
		.replace(/^\s*\/\/.*$/gm, "");

// ── 1. Function length ───────────────────────────────────────────────────────

const OPENS_BODY = /(function\s+\w+|=>\s*\{|\b\w+\s*\([^)]*\)\s*\{|=\s*\()/;

for (const file of files) {
	// A `describe` block is a LIST of cases, not a function with a body: measuring
	// its length measures how many things a file covers. True of a bench for the
	// same reason it is true of a test.
	if (/\.(test|spec|bench)\.tsx?$/.test(file)) continue;

	const lines = readFileSync(file, "utf8").split("\n");
	const budget = LONG_FUNCTION_BUDGET.get(file)?.lines ?? DEFAULT_BUDGET;

	let open = null;
	let depth = 0;

	for (let i = 0; i < lines.length; i += 1) {
		const line = lines[i];
		const opens = (line.match(/\{/g) ?? []).length;
		const closes = (line.match(/\}/g) ?? []).length;

		if (open === null) {
			if (OPENS_BODY.test(line) && opens > closes) {
				open = { line: i + 1, name: line.trim().slice(0, 60) };
				depth = opens - closes;
			}
			continue;
		}

		depth += opens - closes;
		if (depth > 0) continue;

		const span = i + 1 - open.line;
		if (span > budget) {
			fail(
				"long-function",
				`${file}:${String(open.line)}`,
				`${String(span)} lines, budget ${String(budget)} — "${open.name}". ` +
					'Look for a block with a comment above it, a name containing "and", or a ' +
					"local used in one block: each is a function. If the shape is right, add " +
					"the file to LONG_FUNCTION_BUDGET with the reason.",
			);
		}
		open = null;
	}
}

// ── 2. A block repeated across three or more files ───────────────────────────

const WINDOW = 6;
const windows = new Map();

for (const file of files) {
	if (ALLOWED_REPEATS.some((pattern) => pattern.test(file))) continue;

	const code = withoutComments(readFileSync(file, "utf8"))
		.split("\n")
		.map((line, i) => [i + 1, line.replace(/\s+/g, " ").trim()])
		.filter(([, line]) => line.length > 3 && !line.startsWith("import"));

	for (let i = 0; i + WINDOW <= code.length; i += 1) {
		const slice = code.slice(i, i + WINDOW);
		const key = slice.map(([, line]) => line).join("\n");
		if (!windows.has(key)) windows.set(key, new Map());
		windows.get(key).set(file, slice[0][0]);
	}
}

const reported = new Set();
for (const [key, sites] of windows) {
	if (sites.size < 3) continue;

	if (ALLOWED_BLOCKS.some((allowed) => key.startsWith(allowed))) continue;

	const signature = [...sites.keys()].sort().join("|");
	if (reported.has(signature)) continue;
	reported.add(signature);

	fail(
		"duplicate-block",
		[...sites].map(([file, line]) => `${file}:${String(line)}`).join("\n    "),
		`the same ${String(WINDOW)} lines appear in ${String(sites.size)} files. The third ` +
			"occurrence is the abstraction: name it, and put it where all three already " +
			`look.\n    ${key.split("\n")[0].slice(0, 80)}…`,
	);
}

// ── 3. An else-if chain on one subject ───────────────────────────────────────

/**
 * Branches of ONE chain, grouped by indentation.
 *
 * Counting consecutive `else if` LINES cannot work: every branch has a body, and
 * a body is lines that are neither blank nor a closing brace. The chain is the
 * run of `else if` at one indentation, ended by the first line that dedents out
 * of the block.
 */
const indentOf = (line) => /^(\t*)/.exec(line)?.[1].length ?? 0;

for (const file of files) {
	const lines = withoutComments(readFileSync(file, "utf8")).split("\n");

	const open = new Map();

	for (let i = 0; i < lines.length; i += 1) {
		const line = lines[i];
		if (line.trim().length === 0) continue;

		const indent = indentOf(line);

		// A line dedenting to or past a chain's level closes it, unless it is the
		// chain continuing.
		for (const [level, chain] of open) {
			if (indent > level) continue;
			if (indent === level && /\belse\s+if\s*\(/.test(line)) continue;
			if (indent === level && /^\s*\}\s*else\b/.test(line)) continue;

			if (chain.branches >= 3) {
				fail(
					"else-if-chain",
					`${file}:${String(chain.start)}`,
					`${String(chain.branches)} branches. Branch on data instead: a ` +
						"Record<TKind, THandler> puts the cases side by side and lets a consumer " +
						"add one; polymorphism removes the branch entirely.",
				);
			}
			open.delete(level);
		}

		if (/\belse\s+if\s*\(/.test(line)) {
			const chain = open.get(indent);
			if (chain) {
				chain.branches += 1;
			} else {
				// The `if` this continues opened the chain; it is branch one.
				open.set(indent, { start: i + 1, branches: 2 });
			}
		}
	}

	for (const chain of open.values()) {
		if (chain.branches < 3) continue;
		fail(
			"else-if-chain",
			`${file}:${String(chain.start)}`,
			`${String(chain.branches)} branches. Branch on data instead: a ` +
				"Record<TKind, THandler> puts the cases side by side and lets a consumer " +
				"add one; polymorphism removes the branch entirely.",
		);
	}
}

// ── Result ───────────────────────────────────────────────────────────────────

if (problems.length > 0) {
	console.error(
		`COMPOSITION DIVERGES FROM THE CANON (${String(problems.length)})\n\n` +
			problems.join("\n\n") +
			"\n\nCanon: skills/composition/SKILL.md",
	);
	process.exit(1);
}

console.log(`composition follows the canon: ${String(files.length)} files`);
