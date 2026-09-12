/**
 * Checks names: folders, files, symbols, config keys.
 *
 * The canon is `skills/naming/SKILL.md`; this is its executable half. Each check
 * catches ONE class of divergence and names what to fix — a bare "does not
 * follow the canon" forces reading the whole canon for one line.
 */
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const ROOTS = ["core/src", "modules", "plugins", "tools", "scripts"];
const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".git", ".idea", "_fixtures"]);

/** Subject-less names: everything without a home ends up in such a folder. */
/**
 * Names that group nothing in particular.
 *
 * `utils` is NOT among them any more, and the reason is a definition rather than
 * a preference: `_utils` holds a pure function over plain values, named after
 * what it does to them and using no word from the domain. Membership is decided
 * by that sentence, which is what the others still lack.
 */
const THEMELESS = ["helpers", "common", "shared", "misc", "lib", "constants"];

/**
 * Unbranded exports allowed BY NAME.
 *
 * Deliberately short, and grows only together with the reason recorded in
 * `skills/naming/SKILL.md`: "except utilities" is not machine-checkable, because
 * what counts as a utility is decided differently by everyone.
 */
const UNBRANDED = new Set([
	"isRecord",
	"getStringField",
	"generateUuid",
	"stringToBigInt",
	"bigIntToString",
	"safeFireAndForget",
	"createObjectUrlSafely",
	"revokeObjectUrlSafely",
]);

/**
 * Package barrels: what the consumer sees.
 *
 * NOT written by hand but derived from each `package.json`'s `exports`, so it
 * covers every subpath entry and not only package roots. A hand-written list
 * eventually falls behind the code, and a check that cannot fail reports
 * success.
 */
const barrelsOf = (packageJsonPath) => {
	const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8"));
	const dir = dirname(packageJsonPath);
	return Object.values(manifest.exports ?? {})
		.filter((target) => typeof target === "string" && target.endsWith(".ts"))
		.map((target) => join(dir, target).replace(/\\/g, "/"));
};

/**
 * Every manifest under a bucket, one level deep or two.
 *
 * Two because of a FAMILY — `modules/validators/zod` — where the directory under
 * the bucket holds packages rather than being one. A one-level walk found no
 * manifest there and silently checked nothing, which is the fourth way a gate
 * reports success: it looked in the wrong place and found no problems.
 */
const manifestsUnder = (root) => {
	if (existsSync(join(root, "package.json"))) return [join(root, "package.json")];

	return readdirSync(root).flatMap((name) => {
		const child = join(root, name);
		if (!existsSync(child) || !statSync(child).isDirectory()) return [];
		if (existsSync(join(child, "package.json"))) return [join(child, "package.json")];

		return readdirSync(child)
			.map((leaf) => join(child, leaf, "package.json"))
			.filter((path) => existsSync(path));
	});
};

const BARRELS = ["core", "modules", "plugins", "tools"].flatMap(manifestsUnder).flatMap(barrelsOf);

const problems = [];
const fail = (rule, where, message) => problems.push(`[${rule}] ${where}\n    ${message}`);

const walk = (dir) =>
	readdirSync(dir).flatMap((name) => {
		if (SKIP_DIRS.has(name)) return [];
		const path = join(dir, name);
		return statSync(path).isDirectory() ? [path, ...walk(path)] : [path];
	});

const entries = ROOTS.flatMap(walk);
const dirs = entries.filter((path) => statSync(path).isDirectory());
const files = entries.filter((path) => /\.(ts|tsx|mjs)$/.test(path) && statSync(path).isFile());

// ── 1. Folders: kebab-case, with an optional bucket underscore ───────────────

/**
 * A leading underscore marks a GROUPING bucket — see `skills/structure/SKILL.md`.
 * Which names may carry it is that skill's rule; here it is only allowed to
 * exist, and the name under it is checked as any other.
 */
const KEBAB = /^_?[a-z0-9]+(-[a-z0-9]+)*$/;

for (const dir of dirs) {
	const name = basename(dir);
	if (name.startsWith(".")) continue;

	if (!KEBAB.test(name)) {
		fail(
			"folder-kebab",
			dir,
			`"${name}" is not kebab-case. Mixed case makes a path unguessable: you have ` +
				"to remember which folder is which instead of simply naming it.",
		);
	}

	// The underscore is stripped first: it says a folder GROUPS, and grouping
	// nothing in particular is exactly what these names do. `_helpers` is
	// `helpers` with a marker on it, not a subject.
	if (THEMELESS.includes(name.replace(/^_/, ""))) {
		fail(
			"folder-without-subject",
			dir,
			`"${name}" has no subject, so everything without a home lands in it. ` +
				"A leading underscore does not give one: it marks a bucket, and a bucket " +
				"still has to name the KIND of what it holds.",
		);
	}
}

// ── 2. Files: named after the main export ────────────────────────────────────

/**
 * Code with comments stripped.
 *
 * Required: docblocks here carry code EXAMPLES, and parsing without stripping
 * finds `export const x` inside them — checking the example instead of the file.
 */
const withoutComments = (source) => source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");

/** Every name a file exports. */
const declaredExportsOf = (source) => {
	const code = withoutComments(source);
	const names = new Set();
	const patterns = [
		/export\s+(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/g,
		/export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
		/export\s+(?:const|let)\s+([A-Za-z_$][\w$]*)/g,
		/export\s+interface\s+([A-Za-z_$][\w$]*)/g,
		/export\s+type\s+([A-Za-z_$][\w$]*)/g,
	];
	for (const pattern of patterns) {
		for (const [, name] of code.matchAll(pattern)) names.add(name);
	}
	return names;
};

/** A group file: a camelCase subject name holding several related exports. */
const GROUP_FILE = /^[a-z][A-Za-z0-9]*$/;
const CONFIG_FILE = /\.(config|test|spec)\.(ts|tsx|mjs)$/;

for (const file of files) {
	const name = basename(file);
	if (CONFIG_FILE.test(name) || name === "index.ts" || name.endsWith(".mjs")) continue;

	const bare = name.replace(/\.(ts|tsx)$/, "");
	if (THEMELESS.includes(bare)) {
		fail("file-without-subject", file, `"${bare}" has no subject; name the file after it.`);
		continue;
	}

	const source = readFileSync(file, "utf8");
	const declared = declaredExportsOf(source);
	if (declared.size === 0) continue;

	// A file is named after what people come to it for.
	if (declared.has(bare)) continue;

	// A group file: several related exports under a camelCase subject name.
	if (declared.size > 1 && GROUP_FILE.test(bare)) continue;

	fail(
		"file-named-after-export",
		file,
		`the file declares ${[...declared].map((exported) => `"${exported}"`).join(", ")} ` +
			`but not "${bare}". Name the file after what people come to it for, ` +
			"or give the group a camelCase subject name.",
	);
}

// ── 3. Declaration prefixes ──────────────────────────────────────────────────

for (const file of files) {
	if (/\.(test|spec)\.(ts|tsx)$/.test(file) || file.endsWith(".mjs")) continue;
	const source = readFileSync(file, "utf8");

	for (const [, name] of source.matchAll(/export\s+interface\s+([A-Za-z_$][\w$]*)/g)) {
		if (!/^I[A-Z]/.test(name)) {
			fail("prefix-I", file, `interface "${name}" must start with I.`);
		}
	}
	for (const [, name] of source.matchAll(/export\s+type\s+([A-Za-z_$][\w$]*)/g)) {
		if (!/^T[A-Z]/.test(name)) {
			fail("prefix-T", file, `type "${name}" must start with T.`);
		}
	}
	for (const [, name] of source.matchAll(/export\s+abstract\s+class\s+([A-Za-z_$][\w$]*)/g)) {
		if (!/^A[A-Z]/.test(name)) {
			fail("prefix-A", file, `abstract class "${name}" must start with A.`);
		}
	}
}

// ── 4. Forbidden suffixes ────────────────────────────────────────────────────

const BANNED_SUFFIX = /(Service|Manager|Util|Utils|Helper|Helpers|Impl)$/;

/**
 * `Data`/`Info` are forbidden for NAMES OF THINGS, not for values.
 *
 * `TUserInfo` is a type that said nothing about itself; `deviceInfo` is a
 * variable holding device information, and there is no other word for it.
 */
const BANNED_TYPE_SUFFIX = /^[A-Z].*(Data|Info)$/;

/**
 * EVERY declaration is checked, not only exports.
 *
 * A config key is surface too: everyone writing their own locator types it, so a
 * name that fits anything — and therefore means nothing — is as costly there as
 * on a class.
 */
const DECLARATION =
	/(?:abstract\s+class|class|interface|type|function|const|let)\s+([A-Za-z_$][\w$]*)/g;

for (const file of files) {
	if (/\.(test|spec)\.(ts|tsx)$/.test(file) || file.endsWith(".mjs")) continue;
	const source = withoutComments(readFileSync(file, "utf8"));

	for (const [, name] of source.matchAll(DECLARATION)) {
		if (BANNED_SUFFIX.test(name) || BANNED_TYPE_SUFFIX.test(name)) {
			fail(
				"empty-suffix",
				file,
				`"${name}": the suffix says nothing — a thing is named after WHAT IT IS.`,
			);
		}
	}
}

// ── 5. Brand on the package surface ──────────────────────────────────────────

const exportedNamesOf = (source) => {
	const names = new Set();
	for (const [, list] of source.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)) {
		for (const part of list.split(",")) {
			const name = part
				.trim()
				.split(/\s+as\s+/)
				.pop()
				?.trim();
			if (name) names.add(name);
		}
	}
	for (const [, name] of source.matchAll(
		/export\s+(?:declare\s+)?(?:const|class|abstract class|function|interface|type)\s+([A-Za-z_$][\w$]*)/g,
	)) {
		names.add(name);
	}
	return names;
};

for (const barrel of BARRELS) {
	const names = exportedNamesOf(readFileSync(barrel, "utf8"));
	for (const name of names) {
		if (UNBRANDED.has(name)) continue;
		if (/lanka/i.test(name)) continue;
		fail(
			"brand",
			barrel,
			`"${name}" carries no brand. Holds state, registers itself or gets extended — ` +
				"add Lanka; a pure function — list it in UNBRANDED here and in the canon.",
		);
	}
}

// ── 6. Config keys are not UPPER_SNAKE ───────────────────────────────────────

for (const file of files) {
	if (/\.(test|spec)\.(ts|tsx)$/.test(file) || file.endsWith(".mjs")) continue;
	const source = readFileSync(file, "utf8");

	// A defaults object: `export const X_CONFIG = { … }` — its keys are overridden
	// by the consumer, so they are config, not constants.
	for (const [, body] of source.matchAll(
		/export\s+const\s+[A-Z_]*CONFIG[A-Z_]*\s*=\s*\{([\s\S]*?)\n\}/g,
	)) {
		for (const [, key] of body.matchAll(/^\t([A-Z][A-Z0-9_]{2,}):/gm)) {
			fail(
				"config-camelCase",
				file,
				`key "${key}" is UPPER_SNAKE. Config is what gets overridden; ` +
					"UPPER_SNAKE pretends it is a constant.",
			);
		}
	}
}

// ── 7. Units in the name ─────────────────────────────────────────────────────

const TIME_WORDS = /(timeout|delay|ttl|interval|expiry|duration|gap|backoff)$/i;

for (const file of files) {
	if (file.endsWith(".mjs")) continue;
	const source = readFileSync(file, "utf8");

	for (const [, name] of source.matchAll(
		/^\t+(?:readonly\s+)?([a-z][A-Za-z0-9]*)\??:\s*number/gm,
	)) {
		if (TIME_WORDS.test(name)) {
			fail(
				"units-in-name",
				file,
				`"${name}" is a time value without a unit — an invitation to pass seconds ` +
					"where milliseconds are expected. Name it `…Ms`.",
			);
		}
	}
}

// ── 8. Case in GIT'S INDEX, not on disk ──────────────────────────────────────

/**
 * Every check above reads the filesystem, and on Windows that is
 * case-insensitive: renaming `Interfaces/` to `interfaces/` looks done while the
 * git index keeps the old name — and on a case-sensitive filesystem (CI, and
 * anyone installing the package) the import does not resolve.
 *
 * So case is asked of git: a check looking where the error is invisible cannot
 * fail.
 */
const trackedPaths = execSync("git ls-files", { encoding: "utf8" }).trim().split("\n");

for (const path of trackedPaths) {
	if (!/^(core|modules|plugins|tools|scripts)\//.test(path)) continue;

	const segments = path.split("/");

	for (const folder of segments.slice(0, -1)) {
		// A leading underscore marks a grouping bucket and is not case.
		if (/[A-Z]/.test(folder)) {
			fail(
				"case-in-index",
				path,
				`folder "${folder}" is recorded upper-case in git's index. Invisible on ` +
					"Windows, unresolvable on a case-sensitive filesystem.",
			);
			break;
		}
	}

	// The FILE too, not only its folders. Three files sat in the index spelled
	// `Sleep.ts`, `IsRecord.ts`, `GetStringField.ts` while the disk had them in
	// camelCase: every import resolved on Windows and none would elsewhere. A
	// rule checking folders alone could not see it.
	const file = segments.at(-1);
	const directory = dirname(path);
	// A tracked path whose directory is gone from the working tree: a folder
	// deleted and not yet staged, which is the ordinary state of the minute
	// after deleting one. `git ls-files` still lists it, and reading it threw —
	// so the whole check DIED on the first such path and said nothing about the
	// thousand files after it. A crash is not a failing check; it is no check.
	if (!existsSync(directory)) continue;

	const onDisk = readdirSync(directory).find(
		(entry) => entry.toLowerCase() === file.toLowerCase(),
	);

	if (onDisk !== undefined && onDisk !== file) {
		fail(
			"case-in-index",
			path,
			`the index spells this file "${file}" and the disk spells it "${onDisk}". ` +
				"Rename through a temporary name so git records the change.",
		);
	}
}

// ── Result ───────────────────────────────────────────────────────────────────

if (problems.length > 0) {
	console.error(
		`NAMES DIVERGE FROM THE CANON (${String(problems.length)})\n\n` +
			problems.join("\n\n") +
			"\n\nCanon: skills/naming/SKILL.md",
	);
	process.exit(1);
}

console.log(
	`names follow the canon: ${String(files.length)} files, ${String(dirs.length)} folders`,
);
