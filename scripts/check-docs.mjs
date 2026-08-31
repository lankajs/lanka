/**
 * Checks that documentation follows `skills/documentation/SKILL.md`.
 *
 * Two rules, both of the kind that rot silently:
 *
 * 1. **One language.** Any non-Latin script in a comment, doc, config or string
 *    means the corpus is mixed, and a mixed corpus makes every reader translate
 *    half of what they read.
 * 2. **A deprecation carries its four facts.** The tag alone is an apology: it
 *    tells a reader that something is wrong and nothing about what to do. The
 *    version the replacement shipped in, the replacement's NAME and one clause of
 *    why turn it into an instruction.
 *
 *    The rule used to be a flat ban — "remove the thing or remove the tag" — and
 *    that was right for a framework nobody consumed. Once published, removal is
 *    the expensive option and a deprecated export that keeps working IS the
 *    compatibility promise; see `skills/surface/SKILL.md` §7.
 *
 * A line carrying the marker `check-docs:allow` is exempt from both rules. It
 * exists for the two cases where the pattern IS the subject: this file, and
 * fixture data asserting a non-Latin round-trip. Grep for the marker before
 * adding one — every occurrence is a line the check does not run on.
 *
 * Run: node scripts/check-docs.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["core", "modules", "plugins", "tools", "scripts", "skills", ".github", ".claude"];
const ROOT_FILES = [
	"README.md",
	"CHANGELOG.md",
	"AGENTS.md",
	"CONTRIBUTING.md",
	"eslint.config.js",
];
const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".git", ".idea"]);
const CHECKED = /\.(ts|tsx|mjs|js|md|ya?ml|json)$/;

const ESCAPE_MARKER = "check-docs:allow";

/**
 * Cyrillic, Arabic, Kana and CJK, written as escapes so the rule is stated here
 * without an instance of it. Latin-1 punctuation (em dash, quotes) is NOT a
 * script and is allowed: it is typography, not a second language.
 */
const NON_LATIN = /[\u0400-\u052F\u0600-\u06FF\u3040-\u30FF\u4E00-\u9FFF]/;

/** The tag that supersedes a name without removing it. */
const DEPRECATION_TAG = "@deprecated"; // check-docs:allow

/**
 * The four facts, in the order they are read.
 *
 * `since` is the version the REPLACEMENT shipped in, which is what a consumer
 * needs to know to plan an upgrade; the version the old name appeared in helps
 * nobody.
 */
const DEPRECATION_FORM = /@deprecated since \d+\.\d+\.\d+ - use [A-Za-z_$][\w$.]*[ ,.]/; // check-docs:allow

/**
 * Prose ABOUT the tag is not a use of it.
 *
 * The rule is about a promise made in code. A markdown file quoting the tag is
 * citing the rule, and forcing an escape marker onto every such line would make
 * the canon that documents deprecation the file least able to discuss it.
 */
const CODE_FILE = /\.(ts|tsx|mjs|js)$/;

const walk = (dir) =>
	readdirSync(dir).flatMap((name) => {
		if (SKIP_DIRS.has(name)) return [];
		const path = join(dir, name);
		return statSync(path).isDirectory() ? walk(path) : [path];
	});

const files = [
	...ROOTS.flatMap((root) => {
		try {
			return walk(root);
		} catch {
			return [];
		}
	}),
	...ROOT_FILES,
].filter((path) => CHECKED.test(path));

const problems = [];

for (const path of files) {
	let source;
	try {
		source = readFileSync(path, "utf8");
	} catch {
		continue;
	}

	source.split("\n").forEach((line, index) => {
		if (line.includes(ESCAPE_MARKER)) return;

		if (NON_LATIN.test(line)) {
			problems.push(
				`[language] ${path.replace(/\\/g, "/")}:${String(index + 1)}\n    ${line.trim().slice(0, 100)}`,
			);
		}
		if (
			line.includes(DEPRECATION_TAG) &&
			CODE_FILE.test(path) &&
			!DEPRECATION_FORM.test(line)
		) {
			problems.push(
				`[deprecation-form] ${path.replace(/\\/g, "/")}:${String(index + 1)}\n` +
					"    Write it as: @deprecated since <version> - use <name>, <why>.\n" + // check-docs:allow
					"    The version the REPLACEMENT shipped in, the replacement's name, and one\n" +
					"    clause of why. A tag without a replacement is an apology, not an\n" +
					"    instruction: it tells a reader something is wrong and nothing about what\n" +
					"    to do. Canon: skills/surface/SKILL.md",
			);
		}
	});
}

if (problems.length > 0) {
	console.error(
		`DOCUMENTATION DIVERGES FROM THE CANON (${String(problems.length)})\n\n` +
			problems.slice(0, 40).join("\n\n") +
			(problems.length > 40 ? `\n\n…and ${String(problems.length - 40)} more` : "") +
			"\n\nCanon: skills/documentation/SKILL.md",
	);
	process.exit(1);
}

console.log(`documentation follows the canon: ${String(files.length)} files`);
