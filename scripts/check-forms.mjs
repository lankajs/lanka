/**
 * Checks the FORM every published thing takes.
 *
 * The canon is `skills/forms/SKILL.md`; this is its executable half. It answers
 * one question per rule, and each answer used to be a matter of taste settled per
 * pull request: is this a class or a namespace, may a consumer construct it, can
 * a consumer patch a published table, and is an ambient object wearing a class's
 * name.
 *
 * Run: node scripts/check-forms.mjs
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const ROOTS = ["core", "modules", "plugins", "tools"];

/**
 * Concrete classes a facade may export, each with the file that invites it.
 *
 * A list without the invitation is an opt-out, and an opt-out is a rule reporting
 * success. So every entry names the file whose header says what a consumer is
 * meant to DO with the class, and the check reads that header: an entry whose
 * file stops explaining itself fails here.
 */
export const SUBCLASSABLE = new Map([
	[
		"LankaFetchJsonRequest",
		{
			file: "core/src/gateway/request/lanka-fetch-json-request/LankaFetchJsonRequest.ts",
			why: "a request kind a gateway holds one of; the factory beside it is the same class",
		},
	],
	[
		"LankaFetchRequest",
		{
			file: "core/src/gateway/request/lanka-fetch-request/LankaFetchRequest.ts",
			why: "a request kind a gateway holds one of; the factory beside it is the same class",
		},
	],
	[
		"LankaFetchFormDataRequest",
		{
			file: "core/src/gateway/request/lanka-fetch-form-data-request/LankaFetchFormDataRequest.ts",
			why: "a request kind a gateway holds one of; the factory beside it is the same class",
		},
	],
	[
		"LankaStorage",
		{
			file: "modules/storage/src/lanka-storage/LankaStorage.ts",
			why: "the ambient one is `lankaStorage`; the class takes its own handlers, which is what a second key space needs",
		},
	],
	[
		"LankaEncryptedStorage",
		{
			file: "modules/storage/src/lanka-encrypted-storage/LankaEncryptedStorage.ts",
			why: "the ambient one is `lankaEncryptedStorage`; a second vault has its own key",
		},
	],
	[
		"LankaIdRegistry",
		{
			file: "modules/storage/src/id-registry/lanka-id-registry/LankaIdRegistry.ts",
			why: "one registry per set of ids; the factory beside it is the same class",
		},
	],
	[
		"LankaPolling",
		{
			file: "modules/async/src/polling/lanka-polling/LankaPolling.ts",
			why: "one per screen; the factory beside it is the same class",
		},
	],
	[
		"LankaOptimisticActions",
		{
			file: "modules/optimistic/src/lanka-optimistic-actions/LankaOptimisticActions.ts",
			why: "one per screen; the factory beside it is the same class",
		},
	],
	[
		"LankaDevtoolsCollector",
		{
			file: "plugins/devtools/src/collector/LankaDevtoolsCollector.ts",
			why: "an application with its own panel builds one and reads it; the factory beside it is the same class",
		},
	],
	[
		"LankaSseTransport",
		{
			file: "plugins/sse/src/lanka-sse-transport/LankaSseTransport.ts",
			why: "an application may build the connection itself and hand it to the plugin",
		},
	],
	[
		"LankaLogger",
		{
			file: "core/src/logger/lanka-logger/LankaLogger.ts",
			why: "the ambient one is `lankaLogger`; the class is what a second logger with its own sinks, flags and printers needs — `Console` beside `console`",
		},
	],
	[
		"LankaFetchTransport",
		{
			file: "core/src/gateway/transport/lanka-fetch-transport/LankaFetchTransport.ts",
			why: "the default network seam, handed to a request kind; an application swapping it writes an `ILankaTransport` and hands that over instead",
		},
	],
	[
		"LankaFetchJsonTransport",
		{
			file: "core/src/gateway/transport/lanka-fetch-json-transport/LankaFetchJsonTransport.ts",
			why: "the same seam with JSON headers, handed to a request kind",
		},
	],
	[
		"LankaFetchFormDataTransport",
		{
			file: "core/src/gateway/transport/lanka-fetch-form-data-transport/LankaFetchFormDataTransport.ts",
			why: "the same seam for a multipart body, which is the one that must NOT set `content-type`",
		},
	],
	[
		"LankaCacheStorageAdapter",
		{
			file: "modules/storage/src/_adapters/lanka-cache-storage-adapter/LankaCacheStorageAdapter.ts",
			why: "a handler `LankaStorage` is given; substituting one is how a platform or a test puts something else behind the same calls",
		},
	],
	[
		"LankaIndexedDbAdapter",
		{
			file: "modules/storage/src/_adapters/lanka-indexed-db-adapter/LankaIndexedDbAdapter.ts",
			why: "a handler `LankaStorage` is given",
		},
	],
	[
		"LankaWebStorageAdapter",
		{
			file: "modules/storage/src/_adapters/lanka-web-storage-adapter/LankaWebStorageAdapter.ts",
			why: "a handler `LankaStorage` is given",
		},
	],
	[
		"LankaCipher",
		{
			file: "modules/storage/src/crypt/lanka-cipher/LankaCipher.ts",
			why: "one cipher per key; an application encrypting something of its own holds one",
		},
	],
	[
		"LankaEncryptor",
		{
			file: "modules/storage/src/crypt/lanka-encryptor/LankaEncryptor.ts",
			why: "the primitive under the cipher, published so an application can encrypt what is not going into storage",
		},
	],
	[
		"LankaBlobCachePolicy",
		{
			file: "modules/blob-cache/src/lanka-blob-cache-policy/LankaBlobCachePolicy.ts",
			why: "the budget an application sets for itself; a second cache has a second policy",
		},
	],
	[
		"LankaBlobCacheStore",
		{
			file: "modules/blob-cache/src/store/lanka-blob-cache-store/LankaBlobCacheStore.ts",
			why: "the cache itself, held by whoever owns its lifetime",
		},
	],
	[
		"LankaCacheStorageBlobAdapter",
		{
			file: "modules/blob-cache/src/lanka-cache-storage-blob-adapter/LankaCacheStorageBlobAdapter.ts",
			why: "the tier a store is given; an application with its own backend hands over another",
		},
	],
	[
		"LankaRingBuffer",
		{
			file: "plugins/devtools/src/ring-buffer/LankaRingBuffer.ts",
			why: "what the collector keeps its entries in; an application with its own panel holds one",
		},
	],
	[
		"LankaIntentPrefetch",
		{
			file: "plugins/prefetch/src/lanka-intent-prefetch/LankaIntentPrefetch.ts",
			why: "one per surface that predicts navigation; the plugin builds one and an application may build its own",
		},
	],
	[
		"LankaChunkPreload",
		{
			file: "plugins/prefetch/src/lanka-chunk-preload/LankaChunkPreload.ts",
			why: "one per route table; the plugin builds one and an application may build its own",
		},
	],
	[
		"LankaDataWarmup",
		{
			file: "plugins/prefetch/src/warmup/LankaDataWarmup.ts",
			why: "one per set of warm-up requests; the plugin builds one and an application may build its own",
		},
	],
]);

/**
 * Published objects that are NOT tables: state behind methods, not values.
 *
 * Freezing one would stop the framework configuring it, which is rule 4 of the
 * canon: an ambient instance is not frozen.
 */
export const AMBIENT_OBJECTS = new Set(["lankaLogger", "lankaHttpInFlight"]);

/** Everything the repository publishes, as source paths. */
export const sourceFiles = () =>
	execSync("git ls-files", { encoding: "utf8" })
		.trim()
		.split("\n")
		.filter(
			(path) =>
				/\.tsx?$/.test(path) &&
				ROOTS.some((root) => path.startsWith(root + "/")) &&
				!/\.(test|spec)\.tsx?$/.test(path) &&
				!path.includes("/_playground/") &&
				!path.includes("/dist/"),
		)
		.filter((path) => existsSync(path));

const withoutComments = (source) =>
	source
		.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ""))
		.replace(/^\s*\/\/.*$/gm, "");

/** The body of a class declaration, from its opening brace to the matching one. */
const classBodyOf = (source, openIndex) => {
	let depth = 0;
	for (let i = openIndex; i < source.length; i += 1) {
		if (source[i] === "{") depth += 1;
		if (source[i] === "}") {
			depth -= 1;
			if (depth === 0) return source.slice(openIndex + 1, i);
		}
	}
	return "";
};

/**
 * Classes whose every member is `static`.
 *
 * `abstract` is exempt and not by kindness: an abstract class exists to be
 * extended, so it is a contract even when its only member is a static helper —
 * `ALankaSingleton.is` is the framework's own case.
 */
export const staticOnlyClasses = (source) => {
	const code = withoutComments(source);
	const found = [];

	const pattern = /(export\s+)?(abstract\s+)?class\s+([A-Za-z_$][\w$]*)[^{]*\{/g;
	for (const match of code.matchAll(pattern)) {
		if (match[2]) continue;

		const body = classBodyOf(code, match.index + match[0].length - 1);
		const members = body.match(
			/^\s{1,2}(?:public |private |protected |static |readonly |abstract |get |set |async )*[\w$[]/gm,
		);
		if (!members || members.length === 0) continue;

		const isStatic = members.every((member) => /\bstatic\b/.test(member));
		if (isStatic) found.push(match[3]);
	}

	return found;
};

/**
 * Exported object literals that are not frozen.
 *
 * A published table is a VALUE, and a consumer who patches one changes behaviour
 * for every caller including the framework's own — in a package nobody edited.
 * Freezing turns that into an error at the line that did it.
 */
export const unfrozenTables = (source) => {
	const code = withoutComments(source);
	const found = [];

	for (const match of code.matchAll(/export\s+const\s+([a-zA-Z_$][\w$]*)\s*(?::[^=]+)?=\s*\{/g)) {
		found.push(match[1]);
	}

	return found;
};

/**
 * Module-level things named like a class without being one.
 *
 * An instance and an object literal both count: what makes the name wrong is
 * that a consumer reading `LankaX` cannot tell whether they may construct it.
 */
export const pascalCaseInstances = (source) => {
	const code = withoutComments(source);
	const found = [];

	for (const match of code.matchAll(
		/export\s+const\s+([A-Z][\w$]*)\s*(?::[^=]+)?=\s*(?:new\s+|\{)/g,
	)) {
		// SCREAMING_SNAKE is a constant, and nobody reads one as a class.
		if (/^[A-Z0-9_]+$/.test(match[1])) continue;

		found.push(match[1]);
	}

	return found;
};

/** Names a barrel re-exports as values, with the file each comes from. */
export const barrelExports = (source) => {
	const found = [];

	for (const match of source.matchAll(/export\s*\{([^}]*)\}\s*from\s*"([^"]+)"/g)) {
		for (const part of match[1].split(",")) {
			const name = part
				.trim()
				.split(/\s+as\s+/)
				.pop()
				?.trim();
			if (!name || name.startsWith("type ") || part.trim().startsWith("type ")) continue;
			found.push({ name, from: match[2] });
		}
	}

	return found;
};

/**
 * Whether a class's own file says what a consumer is meant to do with it.
 *
 * The doc comment immediately above the declaration, three lines or more of it.
 * Not a search for the class's name: a header that names its subject in the first
 * sentence and then explains it would pass a name search while explaining
 * nothing, and one that explains itself well may never repeat the name.
 */
export const invites = (source, name) => {
	const declaration = source.search(new RegExp(`export\\s+(abstract\\s+)?class\\s+${name}\\b`));
	if (declaration < 0) return false;

	const before = source.slice(0, declaration);
	const opened = before.lastIndexOf("/**");
	const closed = before.lastIndexOf("*/");
	if (opened < 0 || closed < opened) return false;

	// Anything but whitespace between the comment and the class means the comment
	// belongs to something else.
	if (before.slice(closed + 2).trim().length > 0) return false;

	return before.slice(opened, closed).split("\n").length >= 3;
};

/** A facade barrel: the file a consumer's import path resolves to. */
/**
 * A facade barrel: the file a consumer's import path resolves to.
 *
 * `core` sits at the repository root while every other package sits one level
 * down, and a pattern that assumed the second shape silently skipped the largest
 * package in the repository — the classic glob that matches nothing and reports
 * success.
 */
export const isFacadeBarrel = (path) => {
	// `_extend` and `_internal` are the other two tiers: what they publish may
	// change in a minor or in any release, so the questions this gate asks of a
	// promise do not apply to them.
	if (path.includes("/_extend/") || path.includes("/_internal/")) return false;

	return (
		/^core\/src\/(.+\/)?index\.ts$/.test(path) ||
		/^(modules|plugins|tools)\/[^/]+\/src\/(.+\/)?index\.ts$/.test(path)
	);
};

const problems = [];
const fail = (rule, where, message) => problems.push(`[${rule}] ${where}\n    ${message}`);

const run = () => {
	const files = sourceFiles();

	for (const file of files) {
		const source = readFileSync(file, "utf8");

		for (const name of staticOnlyClasses(source)) {
			fail(
				"static-only-class",
				`${file} → ${name}`,
				"every member is static: a namespace in a class's clothes. It cannot be " +
					"instantiated, has no polymorphism, and is ONE binding to a bundler — " +
					"importing it for a single method retains all of it. Export the functions, " +
					"or give the class instance members and a default instance.",
			);
		}

		for (const name of pascalCaseInstances(source)) {
			fail(
				"ambient-in-pascal-case",
				`${file} → ${name}`,
				"a module-level instance named like its class. The pair is `LankaX` for the " +
					"class and `lankaX` for the ready-made one, as node has `Console` and " +
					"`console`; one name for both leaves a consumer unable to say which they mean.",
			);
		}
	}

	// ── The facade: what a consumer can reach, and in what form ────────────────

	/** Admissions actually reached, so an unreachable one can be reported. */
	const consulted = new Set();

	for (const file of files.filter(isFacadeBarrel)) {
		const source = readFileSync(file, "utf8");

		for (const { name, from } of barrelExports(source)) {
			const declaredIn = from.startsWith(".")
				? `${file.replace(/\/[^/]+$/, "")}/${from.replace(/^\.\//, "")}.ts`.replace(
						/\/\.\.\//g,
						"/../",
					)
				: null;

			const resolved = declaredIn ? normalise(declaredIn) : null;
			if (!resolved || !existsSync(resolved)) continue;

			const declaration = readFileSync(resolved, "utf8");

			if (!/^[A-Z]/.test(name)) {
				if (AMBIENT_OBJECTS.has(name)) continue;
				if (!unfrozenTables(declaration).includes(name)) continue;

				fail(
					"namespace-not-frozen",
					`${file} → ${name}`,
					"a published table that a consumer can patch. `Object.freeze` it: " +
						"extending is by copy — `{ ...table, mine }` — and a patch changes " +
						"behaviour for every caller, in a package nobody edited. If it holds " +
						"state behind methods rather than values, it is an ambient object: " +
						"name it in AMBIENT_OBJECTS here with that reason.",
				);
				continue;
			}

			const isClass = new RegExp(`export\\s+(abstract\\s+)?class\\s+${name}\\b`).test(
				declaration,
			);
			if (!isClass) continue;
			if (/^A[A-Z]/.test(name)) continue;
			if (new RegExp(`class\\s+${name}\\s+extends\\s+\\w*Error\\b`).test(declaration))
				continue;

			const admitted = SUBCLASSABLE.get(name);
			if (!admitted) {
				fail(
					"class-without-reason",
					`${file} → ${name}`,
					"a concrete class in the facade. A class a consumer holds is fine — say " +
						"so: add it to SUBCLASSABLE in this script with the file whose header " +
						"invites it, or publish a factory and keep the class in `lanka/extend`.",
				);
				continue;
			}

			if (!existsSync(admitted.file)) {
				fail(
					"class-without-reason",
					`${file} → ${name}`,
					`SUBCLASSABLE names ${admitted.file}, which does not exist.`,
				);
				continue;
			}

			if (!invites(readFileSync(admitted.file, "utf8"), name)) {
				fail(
					"class-without-reason",
					`${file} → ${name}`,
					`${admitted.file} no longer explains what a consumer does with ${name}. ` +
						"A list without the invitation is an opt-out, and an opt-out is a rule " +
						"reporting success.",
				);
			}

			consulted.add(name);
		}
	}

	// An admission for a class the facade does not publish is an exemption that
	// can never be consulted — and the next entry written beside it inherits the
	// assumption that this list is read.
	for (const name of SUBCLASSABLE.keys()) {
		if (consulted.has(name)) continue;

		fail(
			"admission-unused",
			`SUBCLASSABLE → ${name}`,
			"no facade barrel publishes this class, so the entry exempts nothing. " +
				"Take it out, or publish the class it was written for.",
		);
	}

	return problems;
};

/** Collapses `a/b/../c` so a relative barrel path can be read from disk. */
const normalise = (path) => {
	const parts = [];
	for (const part of path.split("/")) {
		if (part === "..") parts.pop();
		else if (part !== ".") parts.push(part);
	}
	return parts.join("/");
};

export { run };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	run();

	if (problems.length > 0) {
		console.error(
			`FORMS DIVERGE FROM THE CANON (${String(problems.length)})\n\n` +
				problems.join("\n\n") +
				"\n\nCanon: skills/forms/SKILL.md",
		);
		process.exit(1);
	}

	console.log(`forms follow the canon: ${String(sourceFiles().length)} files`);
}
