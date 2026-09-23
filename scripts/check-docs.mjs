/**
 * Checks that documentation follows `skills/documentation/SKILL.md`.
 *
 * Five rules, all of the kind that rot silently. The last three are about a
 * package's own three documents, and they are here rather than in
 * `check-llms.mjs` because that gate owns what a MACHINE reads — the index and
 * the marketplace — and these are about what a person opens.
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
 * 3. **Every package carries its three documents.** `README.md`, `GUIDE.md` and
 *    `SKILL.md` answer three different questions, and a missing one sends the
 *    reader to whichever of the other two is nearest — which is how the five view
 *    bindings shipped a README linking a `SKILL.md` that was not there.
 * 4. **Every guide is in the shape every package's shares.** The three headings
 *    drifted one guide at a time, and a missing heading fails no build.
 * 5. **A guide's install line agrees with the generated one.** `reference.md` is
 *    the header plus the guide, so a guide naming fewer peers tells one reader
 *    two different things on one page.
 *
 * Rules 1 and 2 read every file; 3 to 5 read a package directory, and only one
 * that holds a `package.json`.
 *
 * A line carrying the marker `check-docs:allow` is exempt from the first two. It
 * exists for the two cases where the pattern IS the subject: this file, and
 * fixture data asserting a non-Latin round-trip. Grep for the marker before
 * adding one — every occurrence is a line the check does not run on.
 *
 * Run: node scripts/check-docs.mjs
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { PACKAGES, pkgDir } from "./registry.mjs";
import { installLine } from "./skills.mjs";

/**
 * `.changeset`, `api` and `perf` are here because the rule is about what a
 * person opens, and all three hold prose a person opens. `.changeset/README.md`
 * shipped in the first commit written in a second language and stayed that way
 * through two majors, because no root on this list contained it.
 *
 * `_playgrounds` is NOT here, and its own `README.md` is on the list below
 * instead: the walk reads the filesystem rather than the index, and a playground
 * that has been built holds `.nuxt`, `.astro` and `.next` trees full of vendored
 * text. A gate whose result depends on whether someone ran a dev server is worse
 * than the hole it closes.
 */
const ROOTS = [
	"core",
	"modules",
	"plugins",
	"tools",
	"scripts",
	"skills",
	"api",
	"perf",
	".changeset",
	".github",
	".claude",
];
const ROOT_FILES = [
	"README.md",
	"CHANGELOG.md",
	"AGENTS.md",
	"ARCHITECTURE.md",
	"CONTRIBUTING.md",
	"eslint.config.js",
	"_playgrounds/README.md",
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

/**
 * The three headings every consumer guide carries, in this order.
 *
 * `skills/documentation/SKILL.md` §"A consumer guide" owns the shape. The reason
 * it is checked rather than described: fourteen guides had drifted off it one
 * heading at a time — the five view bindings never had an adoption section at
 * all, and the four storage adapters were still titled "Using `<pkg>`" — and
 * nothing said so, because a missing heading fails no build.
 *
 * `## Install` is deliberately NOT on this list. The install line is the
 * generated header's to state, and the rule below checks the guide's copy of it
 * against that owner rather than demanding a section.
 */
const GUIDE_SECTIONS = ["## You will learn", "## When to reach for this", "## Recap"];

/** The three documents every package carries, and the question each answers. */
const PACKAGE_DOCS = [
	["README.md", "what this is and why it is shaped this way"],
	["GUIDE.md", "how a consumer uses it"],
	["SKILL.md", "what may not change in it"],
];

for (const pkg of PACKAGES) {
	const dir = pkgDir(pkg);
	// The manifest, not the folder, is what says a package is here. The guard's
	// own spec drives it against temporary trees that hold a `core/` directory
	// with one source file in it, and a rule keyed on the folder alone would
	// demand three documents of every one of them.
	if (!existsSync(join(dir, "package.json"))) continue;

	for (const [file, answers] of PACKAGE_DOCS) {
		if (existsSync(join(dir, file))) continue;

		problems.push(
			`[package-docs] ${dir}/${file}\n` +
				`    does not exist, and it is the file that answers "${answers}".\n` +
				"    Three documents sit in every package and answer three different\n" +
				"    questions; a missing one sends the reader to whichever of the other\n" +
				"    two is nearest. Canon: skills/README.md",
		);
	}

	const guide = join(dir, "GUIDE.md");
	if (!existsSync(guide)) continue;

	const text = readFileSync(guide, "utf8");

	for (const heading of GUIDE_SECTIONS) {
		if (text.includes(`\n${heading}\n`)) continue;

		problems.push(
			`[guide-shape] ${dir}/GUIDE.md → ${heading}\n` +
				"    is missing. The shape is the same in every guide so a reader who\n" +
				"    has read one knows where to look in the next, and the adoption\n" +
				"    decision is the one a consumer arrives with.\n" +
				"    Canon: skills/documentation/SKILL.md",
		);
	}

	// The line that installs THIS package, wherever the page put it. A guide may
	// carry several `npm install` lines — core's names the binding a reader picks
	// next — so the one held to the header is the one naming the package itself.
	const expected = installLine(pkg);
	const first = expected.split(" ")[expected.startsWith("-D ") ? 1 : 0];
	// Everything after `&&` is a SECOND command — `lanka-skills` runs its sync
	// on the same line — and it is not part of what npm is being asked to add.
	const stated = [...text.matchAll(/^npm\s+install\s+([^\n#]+)/gm)]
		.map((hit) =>
			hit[1]
				.split("&&")[0]
				.trim()
				.replace(/\s{2,}/g, " "),
		)
		.find((line) => line.replace(/^-D /, "").split(" ")[0] === first);
	if (stated !== undefined && stated !== expected) {
		problems.push(
			`[guide-install] ${dir}/GUIDE.md\n` +
				`    says \`npm install ${stated}\`\n` +
				`    and the generated header above it says \`npm install ${expected}\`.\n` +
				"    They ship in one document — `reference.md` is that header plus this\n" +
				"    guide — so the reader is told two different things on one page. The\n" +
				"    peers come from the registry; edit the guide, or the registry.\n" +
				"    Canon: skills/documentation/SKILL.md",
		);
	}
}

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
