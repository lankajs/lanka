/**
 * Checks structure: what shares a file, what a barrel holds, where a test lives.
 *
 * The canon is `skills/structure/SKILL.md`; this is its executable half. Each
 * check catches ONE class of divergence and names the remedy — a bare "violates
 * the structure" forces reading the whole canon for one line.
 *
 * Run: node scripts/check-structure.mjs
 */
import { execSync } from "node:child_process";
import { readSurface } from "./check-api.mjs";
import { PACKAGES, pkgDir } from "./registry.mjs";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const ROOTS = ["core/src", "modules", "plugins", "tools"];
const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".git", ".idea", "_fixtures"]);

/**
 * Files allowed several runtime exports, each by one of the three shapes the
 * canon admits — A: a symmetric pair over one representation; B: module state
 * declared in the file, with what writes and reads it; C: a factory and its
 * applied result.
 *
 * Grows only together with the shape recorded beside the entry, and the reason
 * in `skills/structure/SKILL.md`. "It felt related" is none of the three.
 */
const ONE_SUBJECT = new Map([
	[
		"core/src/_internal/active-runtime/activeRuntime.ts",
		"B: set/get/require over the active-runtime slot",
	],
	["core/src/gateway/inflight/lankaHttpInFlight.ts", "C: createInFlightCounter and its default"],
	[
		"modules/blob-cache/src/_utils/object-url/objectUrl.ts",
		"A: create/revoke over one object URL",
	],
	[
		"modules/storage/src/id-registry/_utils/string-big-int-codec/stringBigIntCodec.ts",
		"A: encode/decode over one number",
	],
	[
		"modules/storage/src/lanka-encrypted-state-storage/lankaEncryptedStateStorage.ts",
		"B: the secret and purge-list slots, with the store that reads them",
	],
]);

/**
 * Tests asserting an invariant across many units. They have no single owner, so
 * they stay at the level they speak for.
 *
 * A test that merely covers two units is NOT cross-cutting — it needs splitting.
 */
const CROSS_CUTTING = new Set([
	"core/src/brand.test.ts",
	"core/src/publicSurface.test.ts",
	"core/src/locator/locator.contract.test.ts",
	// The kit is asserted as a kit: reset, render and the doubles have to agree
	// with each other, and no one of them owns that agreement.
	"tools/testing/src/lankaTestToolkit.test.tsx",
]);

/**
 * A package's miniature application — canon rule 6.
 *
 * It obeys every per-file rule, because it is the EXAMPLE of how an application
 * on this framework is laid out: a playground that ignored the canon would teach
 * the opposite of what the canon says.
 *
 * What it is excused from is unit-test placement: its tests are SCENES over the
 * whole application, so they belong to the package rather than to any one unit.
 */
const isPlayground = (path) => path.includes("/_playground/");

/** Kits imported whole. Rule 1 does not apply; the size ratchet still does. */
const isTestSupport = (path) =>
	/(^|\/)testing\//.test(path) || /(TestDoubles|TestFakes|Harness)\.tsx?$/.test(path);

const walk = (dir) =>
	readdirSync(dir).flatMap((name) => {
		if (SKIP_DIRS.has(name)) return [];
		const path = join(dir, name);
		return statSync(path).isDirectory() ? [path, ...walk(path)] : [path];
	});

const toPosix = (path) => path.replace(/\\/g, "/");
const entries = ROOTS.flatMap((root) => walk(root)).map(toPosix);

const isTest = (path) => /\.(test|spec)\.tsx?$/.test(path);
const isSource = (path) => /\.tsx?$/.test(path) && !isTest(path);
const isBarrel = (path) => /(^|\/)index\.tsx?$/.test(path);

const files = entries.filter((path) => statSync(path).isFile());
const sources = files.filter(isSource);
const tests = files.filter(isTest);

const problems = [];
const fail = (rule, where, message) => problems.push(`[${rule}] ${where}\n    ${message}`);

/**
 * Code with comments AND string literals stripped.
 *
 * Both carry things that parse as declarations and are not: a docblock holds
 * examples, and a scaffolder holds the source it generates — `verifyLankaDi`
 * writes `export const lankaDiContractVersion = …` into a file it creates, and
 * counting that as its own export made the checker demand a split of a file with
 * one export.
 *
 * Newlines are preserved so reported line numbers stay true.
 */
const asDeclarationsOnly = (source) =>
	source
		.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (match) => match.replace(/[^\n]/g, ""))
		.replace(/`(?:\\.|\$\{[^}]*\}|[^\\`])*`/g, (match) => match.replace(/[^\n]/g, ""))
		.replace(/"(?:\\.|[^\\"\n])*"/g, "")
		.replace(/'(?:\\.|[^\\'\n])*'/g, "");

const RUNTIME = [
	/\bexport\s+(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/g,
	/\bexport\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
	/\bexport\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g,
];

const TYPES = [
	/\bexport\s+interface\s+([A-Za-z_$][\w$]*)/g,
	/\bexport\s+type\s+([A-Za-z_$][\w$]*)\s*[=<]/g,
];

const namesOf = (code, patterns) => {
	const names = new Set();
	for (const pattern of patterns) {
		for (const [, name] of code.matchAll(pattern)) names.add(name);
	}
	return names;
};

/**
 * A class and the single module-level instance of it — shape D.
 *
 * Checked rather than listed, because the relationship is machine-visible: the
 * const is `new Class()` and its name is the class's own with a lower-case
 * first letter. A second instance would not be a second thing, it would be an
 * event nobody listens to.
 *
 * It cannot be split, either: the two names differ only in their first letter,
 * and a case-insensitive filesystem cannot hold both files.
 */
const isClassWithItsInstance = (code, runtime) => {
	if (runtime.size !== 2) return false;

	const names = [...runtime];
	const className = names.find((name) => /^[A-Z]/.test(name));
	const instanceName = names.find((name) => /^[a-z]/.test(name));
	if (!className || !instanceName) return false;

	if (instanceName !== className[0].toLowerCase() + className.slice(1)) return false;

	return new RegExp(`const\\s+${instanceName}\\s*(?::[^=]*)?=\\s*new\\s+${className}\\b`).test(
		code,
	);
};

// ── 1. One runtime export per file ───────────────────────────────────────────

for (const file of sources) {
	if (isBarrel(file) || isTestSupport(file)) continue;

	const code = asDeclarationsOnly(readFileSync(file, "utf8"));
	const runtime = namesOf(code, RUNTIME);
	if (runtime.size < 2) continue;
	if (ONE_SUBJECT.has(file)) continue;
	if (isClassWithItsInstance(code, runtime)) continue;

	fail(
		"one-runtime-export",
		file,
		`exports ${String(runtime.size)} runtime declarations — ${[...runtime].join(", ")}. ` +
			"One file, one runtime identity: split into a folder per subject, fold a " +
			"predicate into a static, or make the inner one module-private.",
	);
}

// ── 2. A type in a file nothing there references ─────────────────────────────

for (const file of sources) {
	if (isBarrel(file) || isTestSupport(file)) continue;

	const code = asDeclarationsOnly(readFileSync(file, "utf8"));
	const runtime = namesOf(code, RUNTIME);
	if (runtime.size === 0) continue;

	for (const type of namesOf(code, TYPES)) {
		// The declaration itself is one occurrence; a used type has more.
		const occurrences = code.split(new RegExp(`\\b${type}\\b`)).length - 1;
		if (occurrences > 1) continue;

		// Ownership also runs the other way: a type DERIVED from this file's
		// runtime export belongs to it even though nothing here names the type.
		// `TLankaBlobCacheBackend = (typeof BLOB_CACHE_BACKEND)[…]` is the shape.
		//
		// Bounded by the semicolon that ends the alias, NOT by the next blank line:
		// a paragraph-wide match swallowed the declarations after it, found an
		// export name in one of them, and excused every orphan in the file.
		const declaration = new RegExp(`\\btype\\s+${type}\\b[^;]*;`).exec(code)?.[0];
		if (declaration && [...runtime].some((name) => declaration.includes(name))) continue;

		fail(
			"orphan-type",
			file,
			`"${type}" is exported here but referenced by nothing in this file. A type ` +
				"travels with its owner; one with another owner belongs in interfaces/ or types/.",
		);
	}
}

// ── 3. A barrel declares nothing ─────────────────────────────────────────────

const DECLARATION =
	/^(?:export\s+)?(?:default\s+)?(?:abstract\s+)?(?:class|interface|function|const|let|var)\s+([A-Za-z_$][\w$]*)|^export\s+type\s+([A-Za-z_$][\w$]*)\s*[=<]/gm;

for (const file of sources.filter(isBarrel)) {
	const code = asDeclarationsOnly(readFileSync(file, "utf8"));
	const declared = [...code.matchAll(DECLARATION)].map(([, a, b]) => a ?? b);
	if (declared.length === 0) continue;

	fail(
		"barrel-declares",
		file,
		`declares ${declared.join(", ")}. A barrel answers "what does this expose" and ` +
			"is only a cheap answer while it can be read without reading code. Move the " +
			"implementation to a folder named after the export, beside this file.",
	);
}

// ── 4. One tested unit per directory ─────────────────────────────────────────

/**
 * A unit's folder name.
 *
 * The type marker is dropped — `ALankaGateway` lives in `lanka-gateway/`, not
 * `alanka-gateway/` — and a run of capitals splits before the last one, so
 * `LankaScenarioVMRegistry` gives `lanka-scenario-vm-registry`.
 */
const kebabOf = (name) =>
	name
		.replace(/^[AIT](?=[A-Z])/, "")
		.replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.toLowerCase();

/** `X.test.ts` and `X.concern.test.ts` are both the unit `X`. */
const unitOf = (testPath) =>
	basename(testPath)
		.replace(/\.(test|spec)\.tsx?$/, "")
		.split(".")[0];

const unitsByDir = new Map();
for (const test of tests) {
	if (CROSS_CUTTING.has(test) || isPlayground(test)) continue;
	const dir = dirname(test);
	if (!unitsByDir.has(dir)) unitsByDir.set(dir, new Set());
	unitsByDir.get(dir).add(unitOf(test));
}

for (const [dir, units] of unitsByDir) {
	if (units.size < 2) continue;

	fail(
		"flat-tested-units",
		dir,
		`holds tests for ${String(units.size)} units — ${[...units].join(", ")}. Give each ` +
			"tested unit its own kebab-case folder together with its tests.",
	);
}

// ── 5. A test with no unit ───────────────────────────────────────────────────

const sourceSet = new Set(sources);

for (const test of tests) {
	if (CROSS_CUTTING.has(test) || isPlayground(test)) continue;

	const dir = dirname(test);
	const unit = unitOf(test);
	if ([".ts", ".tsx"].some((ext) => sourceSet.has(`${dir}/${unit}${ext}`))) continue;

	fail(
		"orphan-test",
		test,
		`no sibling "${unit}.ts" for this test to belong to. Name it after the unit it ` +
			"asserts, or list it in CROSS_CUTTING here if it asserts an invariant no " +
			"single unit owns.",
	);
}

// ── 6. A folder whose only content is one folder ─────────────────────────────

for (const dir of entries.filter((path) => statSync(path).isDirectory())) {
	const contents = readdirSync(dir);
	if (contents.length !== 1) continue;
	if (!statSync(join(dir, contents[0])).isDirectory()) continue;
	// A bucket is structural: `_abstractions` holding one base says what that
	// folder is FOR, and the second base does not have to arrive for the answer to
	// be true. Only a subject folder has to earn its level.
	if (basename(dir).startsWith("_")) continue;
	// A package's shipped consumer skill lives at `<pkg>/skills/<skill>/`, and the
	// shape is an EXTERNAL contract: a plugin's skills are discovered under
	// `skills/`, one directory each. Collapsing the level would make the skill
	// undiscoverable, so the rule cannot apply to a name this repository does not
	// get to choose.
	if (basename(dir) === "skills") continue;

	fail(
		"wrapper-folder",
		dir,
		`contains only "${contents[0]}/", so it names a subject that folder already ` +
			"names and adds a level. Collapse it; a grouping folder earns its level " +
			"when a second thing joins it.",
	);
}

// ── 7. A bucket carries an underscore, and only a bucket does ────────────────

/**
 * Folder names that name a KIND rather than a thing.
 *
 * Each has a real edge: "interface" and "type" are syntactic categories,
 * "adapter" and "factory" are roles the code states. A name whose membership is
 * a matter of opinion — `helpers`, `utils` — is refused outright by
 * `check-naming`, underscore or not.
 */
const BUCKET_NAMES = new Set([
	"abstractions",
	"facades",
	"utils",
	"types",
	"interfaces",
	"guards",
	"factories",
	"registries",
	"rules",
	"adapters",
	"internal",
	"extend",
	"testing",
	"fixtures",
	"playground",
]);

for (const dir of entries.filter((path) => statSync(path).isDirectory())) {
	const name = basename(dir);
	const bare = name.replace(/^_/, "");
	const marked = name.startsWith("_");

	// `tools/testing/` is a package, not a bucket inside one.
	const isPackageRoot = /^(tools|modules|plugins)\/[^/]+$/.test(dir);

	if (BUCKET_NAMES.has(bare) && !marked && !isPackageRoot) {
		fail(
			"bucket-without-underscore",
			dir,
			`"${bare}" names a KIND, not a thing, so it is a grouping bucket and reads ` +
				`as one only with the marker: rename it to "_${bare}".`,
		);
	}

	if (marked && !BUCKET_NAMES.has(bare)) {
		fail(
			"underscore-without-bucket",
			dir,
			`"${name}" carries the bucket marker but "${bare}" names a thing, not a ` +
				"kind. Drop the underscore, or add the name to BUCKET_NAMES here and to " +
				"the canon if it really is a kind.",
		);
	}
}

// ── 8. Case in git's index, as in check-naming ───────────────────────────────

/**
 * The index, less anything no longer on disk.
 *
 * Case is asked of git because a Windows filesystem cannot answer it. But the
 * index also remembers a path until the deletion is staged, so a half-staged
 * rename made this rule see a unit as both moved and not moved.
 */
const tracked = execSync("git ls-files", { encoding: "utf8" })
	.trim()
	.split("\n")
	.filter((path) => existsSync(path));

for (const path of tracked) {
	if (!/^(core|modules|plugins|tools)\//.test(path)) continue;
	if (!isTest(path) || isPlayground(path)) continue;

	const dir = dirname(path);
	const unit = unitOf(path);
	if (!tracked.includes(`${dir}/${unit}.ts`) && !tracked.includes(`${dir}/${unit}.tsx`)) continue;
	if (basename(dir) === kebabOf(unit)) continue;

	// Reported by rule 4 only when the directory holds a SECOND unit; a lone
	// tested unit sitting outside its own folder is invisible without this.
	if ((unitsByDir.get(dir)?.size ?? 0) > 1) continue;
	if (CROSS_CUTTING.has(path)) continue;

	fail(
		"unit-outside-folder",
		path,
		`"${unit}" is tested but does not live in its own folder. Move the unit and its ` +
			`tests into "${dir}/${kebabOf(unit)}/".`,
	);
}

// ── 9. A protected member is an inheritance contract ─────────────────────────

/**
 * Classes allowed a `protected` member without being designed for inheritance.
 *
 * A ratchet with a reason per entry, and the reason has to name what makes the
 * class an exception rather than what makes the member convenient.
 */
const INHERITANCE_BY_EXCEPTION = new Map([
	[
		"modules/storage/src/lanka-storage/LankaStorage.ts",
		"the static API an application calls AND the base `LankaEncryptedStorage` extends, in one class. Splitting the two is a storage refactor, not a rename",
	],
]);

/** `ALankaGateway` — designed for inheritance, by the naming canon. */
const IS_DESIGNED_BASE = /^A[A-Z]/;

for (const file of sources) {
	if (isPlayground(file)) continue;

	const lines = readFileSync(file, "utf8").split("\n");

	let open = null;
	let depth = 0;

	for (let i = 0; i < lines.length; i += 1) {
		const line = lines[i];

		if (open === null) {
			const declaration =
				/^export\s+(?:abstract\s+)?class\s+(\w+)(?:<[^>]*>)?(?:\s+extends\s+(\w+))?/.exec(
					line,
				);
			if (declaration) {
				open = { name: declaration[1], base: declaration[2], line: i + 1, protectedAt: 0 };
				depth = (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
			}
			continue;
		}

		if (
			/^\s*(?:protected|public protected)\s/.test(line) ||
			/^\s*protected\s+static\s/.test(line)
		) {
			open.protectedAt ||= i + 1;
		}

		depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
		if (depth > 0) continue;

		const inherited = open.base !== undefined && IS_DESIGNED_BASE.test(open.base);
		const declared = IS_DESIGNED_BASE.test(open.name);

		if (
			open.protectedAt > 0 &&
			!declared &&
			!inherited &&
			!INHERITANCE_BY_EXCEPTION.has(file)
		) {
			fail(
				"inheritance-not-declared",
				`${file}:${String(open.protectedAt)}`,
				`"${open.name}" is not designed for inheritance and declares a protected ` +
					"member. A protected member IS the contract a subclass sees, so there are two " +
					"honest shapes: make the class abstract and A-prefixed and say what a subclass " +
					"must implement, or make the member private. The third — a protected member on " +
					"a concrete class — is the fragile base class, and it is discovered by a " +
					"consumer, in a minor, as a compile error in code they did not touch.",
			);
		}

		open = null;
	}
}

// ── 10. A declaration bucket declares nothing that runs ──────────────────────

/**
 * `_types/` and `_interfaces/` hold declarations and nothing else.
 *
 * The rule is worth checking because something depends on it: coverage excludes
 * these folders, since a file that compiles to nothing is reported as 0% and
 * drags the number that gates real code. One runtime export in there would be
 * unmeasured — the exclusion has to stay true to stay honest.
 */
for (const file of sources) {
	if (!/\/(_types|_interfaces)\//.test(file)) continue;

	const runtime = namesOf(asDeclarationsOnly(readFileSync(file, "utf8")), RUNTIME);
	if (runtime.size === 0) continue;

	fail(
		"runtime-in-declaration-bucket",
		file,
		`declares ${[...runtime].join(", ")}. A "_types" or "_interfaces" folder holds ` +
			"declarations only, and coverage excludes it for exactly that reason: a file " +
			"that compiles to nothing is measured as 0% and drags the number that gates " +
			"real code. Move the value beside what uses it.",
	);
}

// ── 11. Every package has a playground ───────────────────────────────────────

/**
 * A package with no `_playground/` is a package nothing exercises whole.
 *
 * Its units may each be green while the package is broken, which is precisely
 * what a refactor produces. The playground is where a regression that needs the
 * whole chain is reproduced, and where a new capability is shown being used.
 */
const packages = tracked
	.filter((path) => /^(modules|plugins|tools)\/[^/]+\/package\.json$/.test(path))
	.map((path) => dirname(path))
	.concat("core");

for (const pkg of packages) {
	const hasApp = tracked.some((path) => path.startsWith(`${pkg}/_playground/app.`));
	const hasTest = tracked.some(
		(path) => /_playground\/.*\.test\.tsx?$/.test(path) && path.startsWith(pkg + "/"),
	);

	if (hasApp && hasTest) continue;

	fail(
		"package-without-playground",
		pkg,
		"has no `_playground/` with an app and its tests. Every package is exercised " +
			"as a consumer uses it, not only one unit at a time: units all green while " +
			"the package is broken is what a refactor produces.",
	);
}

// ── 9. A kind lives in its bucket ────────────────────────────────────────────

/**
 * What a file IS decides which folder it is in.
 *
 * A subsystem root holds the domain: the classes and functions an application
 * would recognise by name. Everything that is a KIND rather than a subject — the
 * abstract bases a consumer extends, the factories that build them, the facades
 * that only delegate, the utilities over plain values — sits in the bucket for
 * that kind, so a reader learns what they are looking at from the path.
 *
 * A file already inside a bucket is left alone: `_internal/create-…` is internal
 * first, and a bucket inside a bucket says nothing.
 */
for (const file of sources) {
	if (/\/_[a-z]+\//.test(file)) continue;

	const name = basename(file).replace(/\.tsx?$/, "");

	if (
		/^A[A-Z]/.test(name) &&
		readFileSync(file, "utf8").includes("export abstract class " + name)
	) {
		fail(
			"kind-outside-its-bucket",
			file,
			`"${name}" is an abstract base — the contract a consumer extends — so it ` +
				"belongs in _abstractions, beside the others rather than among the " +
				"implementations it is the contract for.",
		);
	}

	if (/^create[A-Z]/.test(name)) {
		fail(
			"kind-outside-its-bucket",
			file,
			`"${name}" builds something, so it belongs in _factories. A root that ` +
				"lists makers beside what they make asks a reader to open a file to " +
				"learn which is which.",
		);
	}
}

// ── 10. `_factories/` is what a consumer calls; machinery is `_internal/` ────

/**
 * A factory in `_factories/` is one the package PUBLISHES.
 *
 * Both are `create…`, so rule 9 puts them in the same bucket and a reader opening
 * `_factories/` cannot tell the seven calls an application makes from the four
 * pieces those calls are built out of. `viewmodel/_factories/` held eleven
 * folders for exactly that reason.
 *
 * The split is not by audience — that would be a matter of opinion, and
 * `skills/structure/SKILL.md` §5a refuses a bucket whose membership is one. It is
 * by the edge the surface canon already draws and `api/` already records: a name
 * the package exports, or a name it does not. `_internal/` is defined as "what
 * the package does not export", so the machinery has a bucket already and this
 * rule only says which side each factory is on.
 *
 * The surface is read through `check-api.mjs`, not through `api/*.api.md`: the
 * report is generated, and a gate that trusted a generated file would go quiet
 * the moment somebody forgot to regenerate it.
 */
const publishedNames = new Map();

for (const pkg of PACKAGES) {
	const dir = pkgDir(pkg);
	// A package the tree does not have is skipped rather than fatal: this script
	// is run by its own spec over a FIXTURE tree, which holds the files a case is
	// about and no manifests. A gate that threw there could not be tested at all.
	if (!existsSync(`${dir}/package.json`)) continue;

	const names = new Set();
	for (const entry of readSurface(pkg)) {
		for (const item of entry.exports) names.add(item.name);
	}
	publishedNames.set(dir, names);
}

for (const file of sources) {
	if (!/\/_factories\/[^/]+\/create[A-Z]/.test(file)) continue;
	// A bench is not a unit: `isSource` above counts one, and a bench beside a
	// published factory would otherwise be read as an unexported factory called
	// `createX.bench`. Widening `isSource` to exclude benches everywhere would
	// change what four other rules here count, which is its own decision.
	if (/\.bench\.tsx?$/.test(file)) continue;

	const name = basename(file).replace(/\.tsx?$/, "");
	const owner = [...publishedNames.keys()].find((dir) => file.startsWith(`${dir}/`));
	if (!owner || publishedNames.get(owner).has(name)) continue;

	fail(
		"factory-not-published",
		file,
		`"${name}" is not exported by ${owner}, so it is machinery rather than a ` +
			"call an application makes. Move it to `_internal/`, where `create…` is " +
			"allowed and a reader knows what they are looking at.",
	);
}

// ── Result ───────────────────────────────────────────────────────────────────

if (problems.length > 0) {
	console.error(
		`STRUCTURE DIVERGES FROM THE CANON (${String(problems.length)})\n\n` +
			problems.join("\n\n") +
			"\n\nCanon: skills/structure/SKILL.md",
	);
	process.exit(1);
}

console.log(
	`structure follows the canon: ${String(sources.length)} sources, ${String(tests.length)} tests`,
);
